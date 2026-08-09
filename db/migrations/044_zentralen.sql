-- ═══════════════════════════════════════════════════════════════════════════
-- ZENTRALEN — Nachrichten ans Team, und ein Protokoll fürs Löschen
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Persönliche Nachrichten und Banner ─────────────────────────────────────
-- Bisher gab es genau zwei Wege, dem Team etwas zu sagen: einen Space-Post
-- (den man übersehen kann) und die Updates-Leiste (die von Produktänderungen
-- handelt). Was fehlte: „Diese eine Person muss das JETZT lesen, und ich will
-- sehen, dass sie es gelesen hat."
CREATE TABLE IF NOT EXISTS fiaon_team_nachrichten (
  id            SERIAL PRIMARY KEY,
  agent_id      INTEGER NOT NULL REFERENCES fiaon_agents(id) ON DELETE CASCADE,
  text          TEXT NOT NULL,
  -- Bis wann das Banner steht. NULL = bis zur Bestätigung.
  banner_bis    TIMESTAMPTZ,
  -- Wann der Mensch „Verstanden" geklickt hat. Das ist der eigentliche Zweck
  -- der Tabelle: nicht das Senden, sondern der Nachweis des Ankommens.
  bestaetigt_am TIMESTAMPTZ,
  created_by    TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Weich zurückgezogen, nie gelöscht.
  entfernt_am   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS fiaon_team_nachrichten_offen_idx
  ON fiaon_team_nachrichten (agent_id, bestaetigt_am)
  WHERE bestaetigt_am IS NULL AND entfernt_am IS NULL;

-- ── Löschprotokoll ─────────────────────────────────────────────────────────
-- Eine Massenlöschung ist der gefährlichste Knopf im Haus. Wer sie ausgelöst
-- hat, wann, wie viele Zeilen und in welcher Kategorie, muss in drei Jahren
-- noch nachlesbar sein — unabhängig davon, was mit den Zeilen selbst geschah.
CREATE TABLE IF NOT EXISTS fiaon_loeschungen (
  id           SERIAL PRIMARY KEY,
  -- endgueltig = DSGVO-Löschweg | anonymisiert = Rechnungsdaten bleiben
  art          TEXT NOT NULL,
  person_id    INTEGER,
  person_name  TEXT,
  refs         TEXT,
  grund        TEXT,
  akteur       TEXT NOT NULL,
  -- Die Sammelaktion, zu der diese Zeile gehört. Macht aus 200 Einzelzeilen
  -- einen nachvollziehbaren Vorgang.
  stapel       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_loeschungen_stapel_idx ON fiaon_loeschungen (stapel, created_at DESC);
