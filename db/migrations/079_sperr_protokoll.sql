-- ═══════════════════════════════════════════════════════════════════════════
-- SPERR-PROTOKOLL — jede Änderung von fiaon_persons.is_blocked wird festgehalten
-- (05.09.2026, Fall Cataldo Sapia)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Ein bezahlter, voll aktiver Kunde stand um 16:36:25 plötzlich auf
-- is_blocked — mitten im Startgespräch. Weder eine Anfrage noch ein Klick
-- stand dazu im Log. Sieben Stellen im Code können die Sperre setzen, keine
-- hinterlässt eine Spur an der Person.
--
-- Ab hier schreibt die Datenbank selbst mit: alter und neuer Wert, Zeitpunkt,
-- Anwendung, Verbindung, Transaktion und das auslösende SQL.
--
-- Der Server legt dasselbe beim Start an (server/lib/fiaon-kunde-aktiv.ts,
-- ensureSperrProtokoll); diese Datei ist die Abschrift für das Archiv.

CREATE TABLE IF NOT EXISTS fiaon_sperr_protokoll (
  id BIGSERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL,
  alt BOOLEAN,
  neu BOOLEAN,
  geaendert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  anwendung TEXT,
  verbindung INTEGER,
  transaktion BIGINT,
  anweisung TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_sperr_protokoll_person ON fiaon_sperr_protokoll (person_id, geaendert_am DESC);

CREATE OR REPLACE FUNCTION fiaon_sperr_protokoll_trg() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
    INSERT INTO fiaon_sperr_protokoll (person_id, alt, neu, anwendung, verbindung, transaktion, anweisung)
    VALUES (NEW.id, OLD.is_blocked, NEW.is_blocked, current_setting('application_name', true), pg_backend_pid(), txid_current(), LEFT(current_query(), 4000));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS fiaon_sperr_protokoll_aud ON fiaon_persons;
CREATE TRIGGER fiaon_sperr_protokoll_aud
  AFTER UPDATE OF is_blocked ON fiaon_persons
  FOR EACH ROW EXECUTE FUNCTION fiaon_sperr_protokoll_trg();
