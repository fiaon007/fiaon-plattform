-- ═══════════════════════════════════════════════════════════════════════════
-- FIAON GLOBAL — DAS FIRMENANGEBOT (B2B) (07.10.2026, E-301)
--
-- Das Individualangebot (E-268) hatte genau zwei Teile (Gründung, Kapital-Begleitung).
-- Das Firmenangebot hat Gründung, Monatspauschale (vierundzwanzig Teile und mehr),
-- Umsatz- und Verkaufsbeteiligung — jede mit eigener Rechnung über denselben Weg
-- (Bestellzeile „global_individuell“, Katalogpreis-Wand über bestell_ref, Migration 087).
--
-- ── WAS DIESE MIGRATION TUT ───────────────────────────────────────────────
-- 1. fiaon_global_angebot_teile: CHECK nr 1…2 → 1…500; Fälligkeiten zusätzlich
--    'monatlich', 'umsatz', 'verkauf'; neue Spalten faellig_am, bemessung_cents,
--    zeitraum, beleg.
-- 2. fiaon_global_angebote.freigaben (JSONB): Anwaltsfreigabe (mit Prüfsumme der
--    freigegebenen Fassung), Tag der erfüllten Bedingungen, Kündigung, Verkauf.
-- 3. fiaon_global_angebot_teile.schuldner: NULL = die Auftraggeberin (Rechnung an die
--    Firma); 'gesellschafter' = ein Verkauf durch Gesellschafter (Ziffer 12 Absatz 5) —
--    dafür entsteht KEINE Rechnung an die Firma, nur der vorgemerkte Teil und eine Aufgabe.
-- 4. fiaon_global_angebot_bilder (neu): die Bilder eines Angebots als bytea, gebunden an
--    das Angebot (angebot_id, name). Sie gehen nur hinter dem Angebots-Link raus
--    (GET /api/fiaon/global/angebot/:token/bild/:name) — nie als öffentliche Datei im Repo.
--
-- ── SPERREN ───────────────────────────────────────────────────────────────
-- ADD COLUMN IF NOT EXISTS ohne Vorgabewert (reine Katalogänderung). Die CHECKs werden
-- in EINER Anweisung gelöst und NOT VALID neu gesetzt (kein Lesen der Tabelle in diesem
-- Schritt). scripts/run-migrations.mjs führt die ganze Datei in EINER Transaktion aus —
-- die starke Sperre aus DROP/ADD CONSTRAINT hält deshalb bis zum Ende, auch über VALIDATE
-- und CREATE INDEX. Das ist hier vertretbar: Die Tabelle ist sehr klein (wenige Teile je
-- Angebot), lock_timeout begrenzt das Warten. Bestehende Zeilen bleiben unverändert (nr 1/2, 'sofort'/'meilenstein' sind
-- weiter erlaubt). Dieselbe DDL legt der Server beim ersten Gebrauch selbst an
-- (ensureAngebotTabellen) — die Reihenfolge Code/Migration ist gleichgültig.
-- Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

ALTER TABLE fiaon_global_angebot_teile
  ADD COLUMN IF NOT EXISTS faellig_am DATE,
  ADD COLUMN IF NOT EXISTS bemessung_cents BIGINT,
  ADD COLUMN IF NOT EXISTS zeitraum TEXT,
  ADD COLUMN IF NOT EXISTS beleg TEXT,
  ADD COLUMN IF NOT EXISTS schuldner TEXT;

ALTER TABLE fiaon_global_angebote
  ADD COLUMN IF NOT EXISTS freigaben JSONB;

ALTER TABLE fiaon_global_angebot_teile
  DROP CONSTRAINT IF EXISTS fiaon_global_angebot_teile_nr_check,
  DROP CONSTRAINT IF EXISTS fiaon_global_angebot_teile_faelligkeit_check,
  ADD CONSTRAINT fiaon_global_angebot_teile_nr_check CHECK (nr BETWEEN 1 AND 500) NOT VALID,
  ADD CONSTRAINT fiaon_global_angebot_teile_faelligkeit_check CHECK (faelligkeit IN ('sofort', 'meilenstein', 'monatlich', 'umsatz', 'verkauf')) NOT VALID;

ALTER TABLE fiaon_global_angebot_teile VALIDATE CONSTRAINT fiaon_global_angebot_teile_nr_check;
ALTER TABLE fiaon_global_angebot_teile VALIDATE CONSTRAINT fiaon_global_angebot_teile_faelligkeit_check;

CREATE INDEX IF NOT EXISTS fiaon_global_angebot_teile_faellig_idx
  ON fiaon_global_angebot_teile (faellig_am) WHERE bestell_ref IS NULL AND entfallen_am IS NULL;

-- Die Bilder eines Angebots. Bewusst OHNE Fremdschlüssel auf fiaon_global_angebote: Ein
-- REFERENCES nähme beim Anlegen eine Sperre auf die Angebotstabelle (SHARE ROW EXCLUSIVE);
-- die neue Tabelle braucht gar keine. Gelöscht wird ohnehin nichts (keine Hard-Deletes) —
-- die Bindung trägt der Schlüssel (angebot_id, name), gelesen wird nur über den Link.
CREATE TABLE IF NOT EXISTS fiaon_global_angebot_bilder (
  angebot_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  mime TEXT NOT NULL CHECK (mime IN ('image/webp', 'image/png', 'image/jpeg')),
  daten BYTEA NOT NULL,
  groesse INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  eingespielt_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (angebot_id, name)
);
