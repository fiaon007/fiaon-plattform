-- ═══════════════════════════════════════════════════════════════════════════
-- ZEIT BLOCKIEREN — SPERRZEITEN FÜR DIE BUCHUNGSSEITEN (E-498, 12.11.2026)
--
-- Ausfall: Die Buchungsseiten (Global-Erstgespräch auf /business, Terminlink,
-- /justin) rechnen ihre freien Zeiten nur gegen Termine in fiaon_termine. Was
-- ein Mensch von Hand vereinbart (Zoom, Treffen vor Ort, privater Termin),
-- steht in einem Apple-Kalender und ist für sie unsichtbar — zweimal in zwei
-- Tagen drohte eine Doppelbuchung.
--
-- Fix: eine Sperrzeit je Person (von – bis, kurze Notiz). Sie sperrt die Zeit
-- für alle Angebote, verschickt nie eine Mail, hat keinen Kunden und keine
-- Telefon-Wortwahl. Sie ist KEIN Termin (kein Eintrag in fiaon_termine), damit
-- keine Mail-Läufe, Erinnerungen, Ergebnis-Aufgaben oder Tagesdeckel an ihr
-- hängen.
--
-- Gelöscht wird weich (geloescht_am) — wie beim Kalender-Abo keine Hard-Deletes;
-- jede Abfrage der Buchungsseiten filtert auf geloescht_am IS NULL.
--
-- Reihenfolge der Spalten: wer, wann, warum, wer hat angelegt/gelöscht.
-- agent_id ohne Fremdschlüssel — wie fiaon_kalender_abo: Ein gelöschtes Konto
-- darf keine Buchungsabfrage zum Scheitern bringen.
-- Wiederholbar: nur IF NOT EXISTS. Rein additiv, keine Sperre auf Bestandstabellen.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_sperrzeiten (
  id            BIGSERIAL PRIMARY KEY,
  agent_id      INTEGER NOT NULL,
  beginn        TIMESTAMPTZ NOT NULL,
  ende          TIMESTAMPTZ NOT NULL,
  grund         TEXT,
  erstellt_von  INTEGER,
  erstellt_am   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geloescht_am  TIMESTAMPTZ,
  geloescht_von INTEGER,
  CONSTRAINT fiaon_sperrzeiten_zeit CHECK (ende > beginn)
);

-- Die Buchungsabfragen fragen immer: „Welche Sperren dieser Personen liegen im Fenster?"
CREATE INDEX IF NOT EXISTS fiaon_sperrzeiten_person_zeit
  ON fiaon_sperrzeiten (agent_id, beginn, ende) WHERE geloescht_am IS NULL;
