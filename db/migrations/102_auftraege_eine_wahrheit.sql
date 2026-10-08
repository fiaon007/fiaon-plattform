-- ═══════════════════════════════════════════════════════════════════════════
-- AUFTRÄGE: EINE STATUSWAHRHEIT, KUNDE UND ART ALS DATENFELD, EINGANG
-- E-IT-F (08.10.2026), Punkte (6) bis (9) aus dem IT-Feedback
--
-- ── DER BEFUND (gemessen 07.10.2026, nur lesend) ───────────────────────────
-- status, erledigt_am, erledigt_von und ergebnis wurden an mindestens 15
-- Stellen unabhängig geschrieben. ensureTodoTabelle setzte bei JEDEM
-- Serverstart status = 'erledigt' für jede Zeile mit erledigt_am — eine zweite
-- Wahrheit: Ein wieder geöffneter Auftrag, dessen erledigt_am stehen blieb,
-- sprang nach dem nächsten Deploy still zurück auf „erledigt" (#967: dreimal
-- erledigt, sechsmal übergeben). Umgekehrt setzte fiaon-app-antraege.ts
-- status = 'erledigt' ohne erledigt_am. Und Erzeuger öffneten erledigte
-- Aufträge wieder, ohne dass irgendwo stand, warum.
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- 1. Neue Spalten (alle ohne Umschreiben der Tabelle):
--      person_id, ref, art, zugeordnet_am  Kunde und Art als Datenfeld; der
--                                          Server füllt sie (Art-Katalog in
--                                          shared/fiaon-auftrag-arten.ts) —
--                                          für neue und alte Zeilen.
--      eingang_am                          Beginn der jetzigen offenen Episode
--                                          (Sortierung, Spalte „Eingang").
--      neu_seit                            letzte ECHTE Neuigkeit (Anlage, neue
--                                          Kundennachricht, Justins Übergabe) —
--                                          nicht jede Übergabe oder Systemzeile.
--      erledigt_art, erledigt_ereignis     hand | auto | verwaltung, und wodurch.
--      wieder_offen_zahl/_am/_grund        jedes Wieder-Öffnen, sichtbar mit Grund.
-- 2. DIE WAND (Trigger fiaon_todo_status_wand, BEFORE INSERT OR UPDATE):
--      status = 'erledigt'  ⇒ erledigt_am wird gesetzt, falls er fehlt.
--      status ≠ 'erledigt'  ⇒ erledigt_am, erledigt_von, erledigt_art,
--                             erledigt_ereignis, ergebnis = NULL.
--      erledigt → offen     ⇒ wieder_offen_zahl + 1, wieder_offen_am, ein Grund
--                             (vom Code mitgegeben, sonst „vom System neu
--                             gemeldet") und EIN Beitrag „Wieder offen: …" in der
--                             Zeitleiste. Ein vorhandenes Ergebnis, das dort noch
--                             nicht steht, wird mitgeschrieben — es geht nie verloren.
--    Die Wand sitzt hinter ALLEN rund 30 Schreibwegen (Server, Skripte, alte
--    Clients) — keiner kann mehr still wieder öffnen oder halb erledigen.
-- 3. Bestand angleichen: offene Zeilen ohne Erledigt-Spuren (vorher Ergebnis in
--    die Zeitleiste), erledigte Zeilen mit erledigt_am; eingang_am und neu_seit
--    nachtragen. neu_seit bewusst NICHT aus letzte_aktivitaet: Der Übertrag vom
--    07.10. hat sie für 242 Aufträge auf „jetzt" gesetzt — das Popup zeigte
--    deshalb 251 „neue" Altfälle.
--
-- ── SPERREN (E-254) ───────────────────────────────────────────────────────
-- fiaon_betreiber_todos ist klein (1.435 Zeilen am 07.10.). ADD COLUMN ohne
-- bzw. mit konstantem Vorgabewert ist eine reine Katalogänderung; CREATE INDEX
-- und die Angleich-UPDATEs laufen über ~1.500 Zeilen in Millisekunden.
-- lock_timeout begrenzt das Warten hinter einer langen Transaktion; der Läufer
-- (scripts/run-migrations.mjs) versucht es dreimal. Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

ALTER TABLE fiaon_betreiber_todos
  ADD COLUMN IF NOT EXISTS person_id INTEGER,
  ADD COLUMN IF NOT EXISTS ref VARCHAR,
  ADD COLUMN IF NOT EXISTS art VARCHAR,
  ADD COLUMN IF NOT EXISTS zugeordnet_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eingang_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS neu_seit TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS erledigt_art VARCHAR,
  ADD COLUMN IF NOT EXISTS erledigt_ereignis TEXT,
  ADD COLUMN IF NOT EXISTS wieder_offen_zahl INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wieder_offen_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wieder_offen_grund TEXT;

CREATE INDEX IF NOT EXISTS idx_todos_zustaendig_status ON fiaon_betreiber_todos (zustaendig_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_person_offen ON fiaon_betreiber_todos (person_id) WHERE status <> 'erledigt';
CREATE INDEX IF NOT EXISTS idx_todos_ref_offen ON fiaon_betreiber_todos (ref) WHERE status <> 'erledigt';
CREATE INDEX IF NOT EXISTS idx_todos_ohne_zuordnung ON fiaon_betreiber_todos (id) WHERE zugeordnet_am IS NULL;

-- ── 3. BESTAND ANGLEICHEN (vor der Wand: dies sind keine Übergänge) ────────
-- Ein Ergebnis an einem offenen Auftrag, das in der Zeitleiste fehlt, wird dort
-- gesichert, bevor die Spalte geleert wird.
INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
SELECT t.id, 'system', 'System', 'status', 'Früheres Ergebnis (gesichert am 08.10.2026): ' || t.ergebnis
  FROM fiaon_betreiber_todos t
 WHERE t.status <> 'erledigt' AND t.ergebnis IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = t.id AND strpos(b.text, t.ergebnis) > 0);

UPDATE fiaon_betreiber_todos
   SET erledigt_am = NULL, erledigt_von = NULL, ergebnis = NULL
 WHERE status <> 'erledigt' AND (erledigt_am IS NOT NULL OR erledigt_von IS NOT NULL OR ergebnis IS NOT NULL);

UPDATE fiaon_betreiber_todos
   SET erledigt_am = COALESCE(updated_at, created_at, NOW())
 WHERE status = 'erledigt' AND erledigt_am IS NULL;

UPDATE fiaon_betreiber_todos
   SET erledigt_art = CASE WHEN COALESCE(erledigt_von, '') IN ('', 'System', 'Mara', 'Abo-Motor') THEN 'auto' ELSE 'hand' END
 WHERE status = 'erledigt' AND erledigt_art IS NULL;

UPDATE fiaon_betreiber_todos SET eingang_am = created_at WHERE eingang_am IS NULL;

-- Die letzte echte Neuigkeit: Anlage oder Maras letzter Nachtrag (eine weitere
-- Kundennachricht hängt sich als Mara-Kommentar an). Übergaben und Massenläufe
-- schreiben „System"-Statuszeilen und zählen nicht.
UPDATE fiaon_betreiber_todos t
   SET neu_seit = GREATEST(t.created_at, COALESCE((
         SELECT MAX(b.created_at) FROM fiaon_betreiber_todo_beitraege b
          WHERE b.todo_id = t.id AND b.autor_art = 'system' AND b.art = 'kommentar'
            AND b.autor_name IN ('Mara', 'Mara Lindner')), t.created_at))
 WHERE t.neu_seit IS NULL;

-- Erstbefüllung des Kunden für den Bestand — nur die SICHEREN Quellen, damit die
-- Listen schon beim ersten Laden nach dem Deploy Namen zeigen: der Link
-- (?person=), der WhatsApp-Schlüssel (wa-<person>-…) und die Referenz (über die
-- Bestellung). NIE „postmeister:<n>:aufgabe" — <n> ist teils eine Mail-Kennung
-- (10 Fehlzuordnungen gemessen). Die Person muss existieren. zugeordnet_am bleibt
-- leer: Art, Wurzel bei Dubletten und die Mail-Marke trägt danach der Server nach
-- (server/lib/fiaon-auftraege.ts, die Regel steht in shared/fiaon-auftrag-arten.ts).
UPDATE fiaon_betreiber_todos t
   SET person_id = p.id
  FROM fiaon_persons p
 WHERE t.person_id IS NULL
   AND p.id = COALESCE(
         NULLIF(substring(t.link FROM '[?&]person=([0-9]+)'), '')::int,
         NULLIF(substring(t.schluessel FROM '^wa-([0-9]+)-'), '')::int,
         NULLIF(substring(t.schluessel FROM '^wa-auskunft-([0-9]+)-'), '')::int);

UPDATE fiaon_betreiber_todos t
   SET ref = UPPER(COALESCE(substring(t.link FROM '[?&]ref=(FIAON-[A-Za-z0-9-]+)'), substring(t.link FROM '/kunde/(FIAON-[A-Za-z0-9-]+)')))
 WHERE t.ref IS NULL
   AND COALESCE(substring(t.link FROM '[?&]ref=(FIAON-[A-Za-z0-9-]+)'), substring(t.link FROM '/kunde/(FIAON-[A-Za-z0-9-]+)')) IS NOT NULL;

UPDATE fiaon_betreiber_todos t
   SET person_id = a.person_id
  FROM fiaon_applications a
 WHERE t.person_id IS NULL AND t.ref IS NOT NULL AND a.ref = t.ref AND a.person_id IS NOT NULL;

-- ── 2. DIE WAND ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fiaon_todo_status_wand() RETURNS trigger AS $$
DECLARE
  v_text TEXT;
BEGIN
  IF NEW.eingang_am IS NULL THEN NEW.eingang_am := COALESCE(NEW.created_at, NOW()); END IF;
  IF TG_OP = 'INSERT' AND NEW.neu_seit IS NULL THEN NEW.neu_seit := COALESCE(NEW.created_at, NOW()); END IF;

  IF NEW.status = 'erledigt' THEN
    NEW.erledigt_am := COALESCE(NEW.erledigt_am, NOW());
    IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'erledigt' THEN
      NEW.erledigt_art := COALESCE(NEW.erledigt_art,
        CASE WHEN COALESCE(NEW.erledigt_von, '') IN ('', 'System', 'Mara', 'Abo-Motor') THEN 'auto' ELSE 'hand' END);
    END IF;
    RETURN NEW;
  END IF;

  -- Nicht erledigt: keine Erledigt-Spuren, gleich wer schreibt.
  IF TG_OP = 'UPDATE' AND OLD.status = 'erledigt' THEN
    NEW.wieder_offen_zahl := COALESCE(OLD.wieder_offen_zahl, 0) + 1;
    NEW.wieder_offen_am := NOW();
    -- Ein Grund, den der Code in DIESER Anweisung mitgibt, zählt; sonst der Hinweis,
    -- dass ein Erzeuger ihn ohne Angabe geöffnet hat (nie still).
    IF NEW.wieder_offen_grund IS NULL OR NEW.wieder_offen_grund IS NOT DISTINCT FROM OLD.wieder_offen_grund THEN
      NEW.wieder_offen_grund := 'vom System neu gemeldet';
    END IF;
    v_text := 'Wieder offen: ' || NEW.wieder_offen_grund;
    IF OLD.ergebnis IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM fiaon_betreiber_todo_beitraege b WHERE b.todo_id = OLD.id AND strpos(b.text, OLD.ergebnis) > 0) THEN
      v_text := v_text || E'\nFrüheres Ergebnis: ' || OLD.ergebnis;
    END IF;
    INSERT INTO fiaon_betreiber_todo_beitraege (todo_id, autor_art, autor_name, art, text)
    VALUES (OLD.id, 'system', 'System', 'status', v_text);
  END IF;
  NEW.erledigt_am := NULL;
  NEW.erledigt_von := NULL;
  NEW.erledigt_art := NULL;
  NEW.erledigt_ereignis := NULL;
  NEW.ergebnis := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'fiaon_todo_status_wand' AND NOT tgisinternal) THEN
    CREATE TRIGGER fiaon_todo_status_wand
      BEFORE INSERT OR UPDATE ON fiaon_betreiber_todos
      FOR EACH ROW EXECUTE FUNCTION fiaon_todo_status_wand();
  END IF;
END $$;
