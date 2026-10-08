-- ═══════════════════════════════════════════════════════════════════════════
-- UNTERLAGEN: EINE DATEI IST EIN DATENSATZ (E-IT-C, 08.10.2026, Punkt 3 + 13)
--
-- Bisher hatte jede Unterlage EINE Spalte an der Bestellung (bank_statement_pdf,
-- id_card_pdf, schufa_pdf) und jeder Upload ersetzte sie. Ab jetzt ist jede
-- hochgeladene Datei eine Zeile in fiaon_dokumente (art = 'unterlage'); die
-- Spalte bleibt als gebundene Akte-Fassung aller aktiven Dateien einer Kategorie
-- (server/lib/fiaon-unterlagen.ts). Regeln und Texte: shared/fiaon-unterlagen.ts.
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- 1. fiaon_dokumente: kategorie, unterart, notiz, seiten, lese_befund,
--    zeitraum_von/bis, herkunft, agent_id, entfernt_am/_von/_grund.
--    „Entfernt" ist NICHT „gelöscht": geloescht_am bleibt der DSGVO-Löschung
--    vorbehalten (Inhalt geleert). Vom Team entfernte Dateien behalten ihren
--    Inhalt (Archiv); was der Kunde selbst entfernt (eigene, ungeprüfte Datei),
--    wird geleert — nur der Vermerk bleibt (Art. 5 Abs. 1 lit. c/e DSGVO).
-- 2. Zwei Teilindizes auf die aktiven Unterlagen: Liste je Person/Kategorie und
--    „dieselbe Datei zweimal" (person_id, kategorie, doc_hash).
-- 3. fiaon_unterlagen_akte (neu): je Person und Kategorie die zuletzt gebundene
--    Fassung (Träger-ref, Prüfsumme) und der dauerhafte, entprellte Anstoß von
--    Prüfung und Analyse (anstoss_faellig_am) — ein setTimeout überlebt keinen
--    Deploy, diese Zeile schon (Takt unterlagen_anstoss).
-- 4. fiaon_kontoauszug_analysen / fiaon_schufa_analysen: datei_hash (SHA-256 der
--    gelesenen Datei). Der Nachhol-Lauf rechnet dieselbe unveränderte Datei nicht
--    mehr neu (gemessen: 112 Läufe „kein Kontoauszug" für 22 Bestellungen in 30 Tagen).
--
-- ── SPERREN ───────────────────────────────────────────────────────────────
-- Nur ADD COLUMN IF NOT EXISTS ohne Vorgabewert (Katalogänderung) und kleine
-- Tabellen: fiaon_dokumente 50 Zeilen, Analysen ~500/~200 Zeilen (gemessen
-- 08.10.2026). lock_timeout begrenzt das Warten; die Analysetabellen entstehen
-- im Code erst beim ersten Gebrauch — deshalb dort per to_regclass geschützt.
-- Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

ALTER TABLE fiaon_dokumente
  ADD COLUMN IF NOT EXISTS kategorie TEXT,
  ADD COLUMN IF NOT EXISTS unterart TEXT,
  ADD COLUMN IF NOT EXISTS notiz TEXT,
  ADD COLUMN IF NOT EXISTS seiten INTEGER,
  ADD COLUMN IF NOT EXISTS lese_befund JSONB,
  ADD COLUMN IF NOT EXISTS zeitraum_von DATE,
  ADD COLUMN IF NOT EXISTS zeitraum_bis DATE,
  ADD COLUMN IF NOT EXISTS herkunft TEXT,
  ADD COLUMN IF NOT EXISTS agent_id BIGINT,
  ADD COLUMN IF NOT EXISTS entfernt_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entfernt_von TEXT,
  ADD COLUMN IF NOT EXISTS entfernt_grund TEXT;

CREATE INDEX IF NOT EXISTS fiaon_dokumente_unterlage_idx
  ON fiaon_dokumente (person_id, kategorie, hochgeladen_am)
  WHERE art = 'unterlage' AND entfernt_am IS NULL AND geloescht_am IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dokumente_unterlage_einmal_idx
  ON fiaon_dokumente (person_id, kategorie, doc_hash)
  WHERE art = 'unterlage' AND entfernt_am IS NULL AND geloescht_am IS NULL;

CREATE TABLE IF NOT EXISTS fiaon_unterlagen_akte (
  person_id          BIGINT NOT NULL,
  kategorie          TEXT NOT NULL,
  ref                TEXT,
  akte_hash          TEXT,
  dateien            INTEGER NOT NULL DEFAULT 0,
  gebunden_am        TIMESTAMPTZ,
  anstoss_faellig_am TIMESTAMPTZ,
  anstoss_lauf_am    TIMESTAMPTZ,
  anstoss_von        TEXT,
  anstoss_fehler     TEXT,
  letzter_upload_am  TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (person_id, kategorie)
);
CREATE INDEX IF NOT EXISTS fiaon_unterlagen_akte_faellig_idx
  ON fiaon_unterlagen_akte (anstoss_faellig_am) WHERE anstoss_faellig_am IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.fiaon_kontoauszug_analysen') IS NOT NULL THEN
    ALTER TABLE fiaon_kontoauszug_analysen ADD COLUMN IF NOT EXISTS datei_hash VARCHAR;
  END IF;
  IF to_regclass('public.fiaon_schufa_analysen') IS NOT NULL THEN
    ALTER TABLE fiaon_schufa_analysen ADD COLUMN IF NOT EXISTS datei_hash VARCHAR;
  END IF;
END $$;
