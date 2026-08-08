-- ═══════════════════════════════════════════════════════════════════════════
-- 034 — Datenfundament: Antrags-Archiv, Merge-Herkunft, Dubletten-Entscheidungen
--
-- Drei Bausteine, alle additiv. Es wird nichts gelöscht und nichts umbenannt.
--
-- 1. ARCHIV statt Löschen. Eine Bestellung, die es nicht geben dürfte (doppelt
--    angelegt, Testeintrag, Widerruf), verschwindet aus Arbeitslisten — bleibt
--    aber in der Akte lesbar. `archived_at` ist die einzige Wahrheit dafür.
--
-- 2. HERKUNFT eines Alias. Bisher hielt `fiaon_person_aliases` fest, WELCHE
--    Adresse eine Person je hatte. Nach einem Merge muss auch nachvollziehbar
--    sein, VON WELCHER Person ein Wert stammt — sonst ist ein falscher
--    Zusammenschluss nicht mehr sauber auflösbar. Dazu `quelle_person_id` und
--    `feld_wert` (der abweichende Wert im Original-Wortlaut, z. B. ein
--    Geburtsdatum oder eine Straße, für die `value_norm` keine Norm hat).
--
-- 3. „KEINE DUBLETTE" muss von Dauer sein. Ein Paar, das ein Mensch geprüft und
--    verworfen hat, darf nie wieder vorgeschlagen werden — sonst prüft nächste
--    Woche jemand dasselbe Paar erneut und die Liste wird nie leer.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Antrags-Archiv ──────────────────────────────────────────────────────
ALTER TABLE fiaon_applications
  ADD COLUMN IF NOT EXISTS archived_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archived_reason     TEXT,
  ADD COLUMN IF NOT EXISTS archived_note       TEXT,
  ADD COLUMN IF NOT EXISTS archived_by         TEXT,
  ADD COLUMN IF NOT EXISTS archived_by_agent_id INTEGER;

-- Teilindex: Arbeitslisten fragen fast immer „NICHT archiviert" — der Index
-- deckt genau die Ausnahme ab und bleibt winzig.
CREATE INDEX IF NOT EXISTS fiaon_app_archived_idx
  ON fiaon_applications (archived_at)
  WHERE archived_at IS NOT NULL;

-- ── 2. Herkunft der gesicherten Werte ──────────────────────────────────────
ALTER TABLE fiaon_person_aliases
  ADD COLUMN IF NOT EXISTS quelle_person_id INTEGER,
  ADD COLUMN IF NOT EXISTS feld_wert        TEXT;

CREATE INDEX IF NOT EXISTS fiaon_person_alias_quelle_idx
  ON fiaon_person_aliases (quelle_person_id)
  WHERE quelle_person_id IS NOT NULL;

-- ── 3. Geprüfte Paare: „Keine Dublette" ────────────────────────────────────
-- person_a/person_b werden immer sortiert gespeichert (a < b). Ohne diese
-- Normalisierung wäre (12,34) ein anderes Paar als (34,12) und der Vorschlag
-- käme aus der anderen Richtung zurück.
CREATE TABLE IF NOT EXISTS fiaon_dubletten_entschieden (
  id            SERIAL PRIMARY KEY,
  person_a      INTEGER NOT NULL,
  person_b      INTEGER NOT NULL,
  entscheidung  VARCHAR NOT NULL,
  begruendung   TEXT,
  akteur        TEXT NOT NULL,
  akteur_agent_id INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fiaon_dubletten_paar_sortiert CHECK (person_a < person_b)
);

CREATE UNIQUE INDEX IF NOT EXISTS fiaon_dubletten_paar_idx
  ON fiaon_dubletten_entschieden (person_a, person_b);
