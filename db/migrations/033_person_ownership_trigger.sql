-- ═══════════════════════════════════════════════════════════════════════════
-- 033 · DIE PERSON BESITZT DEN KUNDEN — jetzt auch erzwungen
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Migration 032 hat `fiaon_persons` zum Besitzer erklärt. Erklärt, nicht
-- erzwungen: Jede Schreibstelle im Anwendungscode musste selbst daran denken,
-- die Antragszeilen mitzuziehen. Genau dieses „daran denken müssen" hat die 26
-- Zuweisungskonflikte erzeugt — eine Stelle hat es vergessen, und ab da hatte
-- ein Kunde zwei Zuständige.
--
-- Ab hier hält die Datenbank die Regel selbst. Ändert sich der Besitzer einer
-- Person, folgen ihre Antragszeilen ohne Zutun des Aufrufers. Es ist unmöglich,
-- diese Regel durch eine neue Schreibstelle zu umgehen — auch nicht durch ein
-- manuelles UPDATE in der Konsole.
--
-- ZWEI TRIGGER, WEIL SIE ZWEI VERSCHIEDENE DINGE TUN
--   BEFORE: setzt `assigned_at` auf dem Datensatz, der gerade geschrieben wird.
--           Nur BEFORE darf NEW noch verändern.
--   AFTER:  zieht die Antragszeilen nach und schreibt die Beweiszeile. Das
--           gehört nach dem erfolgreichen Schreiben, nicht davor.
--
-- KEINE REKURSION: Der AFTER-Trigger schreibt ausschliesslich in
-- `fiaon_applications` und `fiaon_agent_events`. Auf keiner der beiden Tabellen
-- hängt ein Trigger, der wieder `fiaon_persons` anfasst.
--
-- HERKUNFT DER ÄNDERUNG: Der Aufrufer kann sie mitgeben, muss aber nicht:
--     SET LOCAL "fiaon.reason" = 'initial_redistribution';
--     SET LOCAL "fiaon.actor"  = 'admin:1';
-- Fehlt die Angabe, steht 'unbekannt' bzw. 'system:trigger' in der Beweiszeile.
-- Das ist bewusst kein Pflichtfeld: Ein fehlendes Etikett darf keine Zuweisung
-- verhindern, es soll nur die Nachvollziehbarkeit verschlechtern.
--
-- Rücknahme: db/rollback/033_person_ownership_trigger_rollback.sql
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1 · BEFORE — Besitzdauer mitschreiben
-- ───────────────────────────────────────────────────────────────────────────
-- Ohne dieses Datum lässt sich weder Horten noch Liegezeit messen. Es wird
-- genau dann neu gesetzt, wenn der Besitzer wirklich wechselt — ein beliebiges
-- anderes UPDATE auf der Person darf die Besitzdauer nicht zurückdrehen.

CREATE OR REPLACE FUNCTION fiaon_person_owner_stamp() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_agent_id IS DISTINCT FROM OLD.assigned_agent_id THEN
    IF NEW.assigned_agent_id IS NULL THEN
      -- Zuständigkeit entzogen: Die Person liegt wieder im Pool, eine
      -- Besitzdauer gibt es dann nicht.
      NEW.assigned_at := NULL;
    ELSE
      NEW.assigned_at := NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_person_owner_stamp_trg ON fiaon_persons;
CREATE TRIGGER fiaon_person_owner_stamp_trg
  BEFORE UPDATE OF assigned_agent_id ON fiaon_persons
  FOR EACH ROW
  EXECUTE FUNCTION fiaon_person_owner_stamp();


-- ───────────────────────────────────────────────────────────────────────────
-- 2 · AFTER — Antragszeilen nachziehen und Beweiszeile schreiben
-- ───────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fiaon_person_owner_propagate() RETURNS TRIGGER AS $$
DECLARE
  betroffene INTEGER := 0;
  grund      TEXT;
  wer        TEXT;
BEGIN
  IF NEW.assigned_agent_id IS NOT DISTINCT FROM OLD.assigned_agent_id THEN
    RETURN NULL;  -- AFTER-Trigger: Rückgabewert wird ohnehin verworfen
  END IF;

  -- Antragszeilen der Person folgen dem Besitzer. `IS DISTINCT FROM` verhindert
  -- sinnlose Schreibvorgänge auf Zeilen, die schon richtig stehen.
  UPDATE fiaon_applications
     SET assigned_agent_id = NEW.assigned_agent_id,
         updated_at = NOW()
   WHERE person_id = NEW.id
     AND assigned_agent_id IS DISTINCT FROM NEW.assigned_agent_id;
  GET DIAGNOSTICS betroffene = ROW_COUNT;

  grund := COALESCE(NULLIF(current_setting('fiaon.reason', true), ''), 'unbekannt');
  wer   := COALESCE(NULLIF(current_setting('fiaon.actor',  true), ''), 'system:trigger');

  -- `agent_id` ist NOT NULL. Beim Entziehen einer Zuständigkeit gibt es keinen
  -- neuen Agenten — dann trägt die Zeile den abgebenden. Sind beide leer, gibt
  -- es niemanden zu protokollieren und wir schreiben nichts.
  IF COALESCE(NEW.assigned_agent_id, OLD.assigned_agent_id) IS NOT NULL THEN
    INSERT INTO fiaon_agent_events
      (agent_id, type, from_agent_id, to_agent_id, reason, actor, meta, created_at)
    VALUES (
      COALESCE(NEW.assigned_agent_id, OLD.assigned_agent_id),
      'person_owner_changed',
      OLD.assigned_agent_id,
      NEW.assigned_agent_id,
      grund,
      wer,
      -- meta ist TEXT, nicht jsonb: als JSON-Text ablegen, damit es lesbar
      -- bleibt und später ohne Migration geparst werden kann.
      json_build_object(
        'person_id',      NEW.id,
        'priority_tier',  NEW.priority_tier,
        'tier_reason',    NEW.tier_reason,
        'antragszeilen',  betroffene
      )::text,
      NOW()
    );
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_person_owner_propagate_trg ON fiaon_persons;
CREATE TRIGGER fiaon_person_owner_propagate_trg
  AFTER UPDATE OF assigned_agent_id ON fiaon_persons
  FOR EACH ROW
  EXECUTE FUNCTION fiaon_person_owner_propagate();


-- ───────────────────────────────────────────────────────────────────────────
-- 3 · Index für den Rückweg
-- ───────────────────────────────────────────────────────────────────────────
-- Die Rücknahme der Erstverteilung liest alle Besitzwechsel eines Grundes in
-- zeitlicher Reihenfolge. Ohne Index wäre das ein Tabellendurchlauf über die
-- gesamte Ereignishistorie.

CREATE INDEX IF NOT EXISTS fiaon_agent_events_owner_change_idx
  ON fiaon_agent_events (reason, created_at)
  WHERE type = 'person_owner_changed';
