-- ═══════════════════════════════════════════════════════════════════════════
-- EIN PRÜFSTANDS-KONTO DARF NICHTS PRODUKTIVES BESITZEN
--
-- ── DER VORFALL (gemessen 21.08.2026) ─────────────────────────────────────
-- Zwei echte Konten des Betreibers (#2, #7) trugen die Marke
-- `is_test_account`. Jede Team-Ansicht filtert über diese Marke — damit waren
-- fünf Kunden (drei davon zahlend), drei Termine, sechs Provisionen über
-- 591,60 €, ein Auszahlungsposten und drei Leads UNSICHTBAR. Nicht gelöscht,
-- nicht falsch zugeordnet: einfach aus jeder Liste heraus.
--
-- Der Fehler war ein Häkchen. Er stand seit dem 04.07.2026 und ist bei drei
-- Aufräumarbeiten niemandem aufgefallen.
--
-- ── ZWEI RICHTUNGEN, ZWEI ANTWORTEN ───────────────────────────────────────
-- Es gibt zwei Wege in diesen Zustand, und sie brauchen verschiedene Härte:
--
--   A) Jemand SETZT DIE MARKE auf ein Konto, an dem produktive Daten hängen.
--      Das ist genau der Vorfall. Dafür gibt es keinen berechtigten Fall —
--      wer ein Konto zum Testkonto erklärt, hat vorher aufgeräumt oder er
--      irrt sich. → HARTE SPERRE mit Klartext-Fehlermeldung.
--
--   B) Jemand HÄNGT einen produktiven Datensatz an ein Prüfstands-Konto.
--      Das tun unsere eigenen Browser-Prüfstände absichtlich und
--      vorübergehend: Sie leihen sich einen Kunden, klicken, und geben ihn im
--      `finally` zurück (scripts/pruef-vier-blocker.ts). Eine harte Sperre
--      würde jeden Browsertest dieses Hauses lahmlegen.
--      → WARNUNG mit Protokolleintrag. Der Tageslauf meldet, was liegen blieb.
--
-- Hausregel aus AGENTS.md: „Schutzmechanismen dürfen Kernarbeit niemals hart
-- blockieren — sie warnen. Harte Sperren nur bei Sicherheit oder Recht." Eine
-- Marke, die fünf zahlende Kunden verschwinden lässt, ist ein Sicherheitsfall
-- für den Bestand; ein geliehener Prüfstands-Kunde ist es nicht.
--
-- Additiv und idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── EIN PROTOKOLL FÜR RICHTUNG B ──────────────────────────────────────────
-- Ohne Tabelle wäre die Warnung eine Zeile auf einer Konsole, die niemand
-- liest. Hier steht sie, bis jemand sie erledigt.
CREATE TABLE IF NOT EXISTS fiaon_testkonto_warnungen (
  id           SERIAL PRIMARY KEY,
  bemerkt_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tabelle      TEXT NOT NULL,
  spalte       TEXT NOT NULL,
  datensatz_id TEXT,
  agent_id     INTEGER NOT NULL,
  agent_name   TEXT,
  erledigt_am  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fiaon_testkonto_warnungen_offen_idx
  ON fiaon_testkonto_warnungen (bemerkt_am DESC)
  WHERE erledigt_am IS NULL;

COMMENT ON TABLE fiaon_testkonto_warnungen IS
  'Produktive Datensätze, die an einem Prüfstands-Konto gelandet sind. Kein Fehler an sich (Prüfstände leihen sich Kunden) — aber was liegen bleibt, muss auffallen.';

-- ═══════════════════════════════════════════════════════════════════════════
-- RICHTUNG A — DIE HARTE SPERRE
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fiaon_testmarke_wand() RETURNS TRIGGER AS $$
DECLARE
  n_personen  INTEGER;
  n_provision INTEGER;
  n_termine   INTEGER;
BEGIN
  -- Nur wenn die Marke NEU gesetzt wird. Ein Konto, das sie schon trägt,
  -- lässt sich weiter bearbeiten (Namen ändern, stilllegen) — sonst wäre die
  -- Wand ein Schloss ohne Schlüssel.
  IF NEW.is_test_account IS NOT TRUE THEN RETURN NEW; END IF;
  IF COALESCE(OLD.is_test_account, FALSE) IS TRUE THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO n_personen FROM fiaon_persons p
   WHERE p.assigned_agent_id = NEW.id
     AND p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL;

  SELECT COUNT(*) INTO n_provision FROM fiaon_commissions c WHERE c.agent_id = NEW.id;

  SELECT COUNT(*) INTO n_termine FROM fiaon_termine t
   WHERE t.agent_id = NEW.id AND t.abgesagt_am IS NULL;

  IF n_personen > 0 OR n_provision > 0 OR n_termine > 0 THEN
    RAISE EXCEPTION
      'Konto % (%) kann nicht als Testkonto markiert werden: % echte Kunden, % Provisionen, % Termine haengen daran. Jede Team-Ansicht filtert Testkonten heraus — die Marke wuerde diese Datensaetze unsichtbar machen (Vorfall vom 21.08.2026). Erst umhaengen, dann markieren.',
      NEW.id, NEW.name, n_personen, n_provision, n_termine
      USING ERRCODE = 'raise_exception';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_testmarke_wand_trg ON fiaon_agents;
CREATE TRIGGER fiaon_testmarke_wand_trg
  BEFORE UPDATE OF is_test_account ON fiaon_agents
  FOR EACH ROW EXECUTE FUNCTION fiaon_testmarke_wand();

-- ═══════════════════════════════════════════════════════════════════════════
-- RICHTUNG B — WARNEN, NICHT SPERREN
--
-- Ein Trigger je Besitz-Spalte. Bewusst nur auf den drei Tabellen, bei denen
-- „unsichtbar" wirklich Geld kostet: Kunden, Termine, Provisionen. Ein
-- Protokolleintrag an einem Anrufversuch waere Rauschen.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fiaon_besitz_warnung() RETURNS TRIGGER AS $$
DECLARE
  ziel     INTEGER;
  ist_test BOOLEAN;
  a_name   TEXT;
BEGIN
  -- TG_ARGV[0] ist der Spaltenname. `to_jsonb` statt dynamischem SQL: Es
  -- braucht keinen zweiten Rundgang zur Datenbank und kann nichts einschleusen.
  ziel := NULLIF(to_jsonb(NEW) ->> TG_ARGV[0], '')::INTEGER;
  IF ziel IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(a.is_test_account, FALSE), a.name INTO ist_test, a_name
    FROM fiaon_agents a WHERE a.id = ziel;
  IF ist_test IS NOT TRUE THEN RETURN NEW; END IF;

  INSERT INTO fiaon_testkonto_warnungen (tabelle, spalte, datensatz_id, agent_id, agent_name)
  VALUES (TG_TABLE_NAME, TG_ARGV[0], (to_jsonb(NEW) ->> 'id'), ziel, a_name);

  RAISE WARNING 'Datensatz %.% = % zeigt auf das Testkonto % (%). Vorgemerkt in fiaon_testkonto_warnungen.',
    TG_TABLE_NAME, TG_ARGV[0], (to_jsonb(NEW) ->> 'id'), ziel, a_name;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS fiaon_persons_besitz_warnung ON fiaon_persons;
CREATE TRIGGER fiaon_persons_besitz_warnung
  AFTER INSERT OR UPDATE OF assigned_agent_id ON fiaon_persons
  FOR EACH ROW EXECUTE FUNCTION fiaon_besitz_warnung('assigned_agent_id');

DROP TRIGGER IF EXISTS fiaon_termine_besitz_warnung ON fiaon_termine;
CREATE TRIGGER fiaon_termine_besitz_warnung
  AFTER INSERT OR UPDATE OF agent_id ON fiaon_termine
  FOR EACH ROW EXECUTE FUNCTION fiaon_besitz_warnung('agent_id');

DROP TRIGGER IF EXISTS fiaon_commissions_besitz_warnung ON fiaon_commissions;
CREATE TRIGGER fiaon_commissions_besitz_warnung
  AFTER INSERT OR UPDATE OF agent_id ON fiaon_commissions
  FOR EACH ROW EXECUTE FUNCTION fiaon_besitz_warnung('agent_id');
