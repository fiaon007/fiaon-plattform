-- ═══════════════════════════════════════════════════════════════════════════
-- TELEFON — Gespräche, die das System kennt
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS fiaon_calls (
  id               SERIAL PRIMARY KEY,
  person_id        INTEGER,
  ref              TEXT,
  agent_id         INTEGER NOT NULL,
  nummer           TEXT NOT NULL,
  -- Nur 'raus'. Eingehende Rufe laufen über einen externen Annahmedienst;
  -- die Spalte steht trotzdem hier, damit ein späterer Ausbau keine
  -- Migration braucht.
  richtung         TEXT NOT NULL DEFAULT 'raus',
  beginn           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ende             TIMESTAMPTZ,
  dauer_sek        INTEGER,
  twilio_sid       TEXT UNIQUE,
  recording_url    TEXT,
  recording_sid    TEXT,
  -- gewaehlt | laeuft | beendet | fehlgeschlagen | abgelehnt
  status           TEXT NOT NULL DEFAULT 'gewaehlt',
  -- Das dokumentierte Gesprächsergebnis aus dem BESTEHENDEN Katalog
  -- (server/lib/fiaon-kontakt-ergebnis.ts). NULL heißt: noch offen — und
  -- genau daran hängt die Erinnerungsmarke am Telefon-Knopf.
  ergebnis         TEXT,
  ergebnis_am      TIMESTAMPTZ,
  -- offen | laeuft | fertig | fehlgeschlagen
  transkript_status TEXT NOT NULL DEFAULT 'offen',
  transkript       TEXT,
  transkript_grund TEXT,
  zusammenfassung  TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- „Welche Anrufe warten noch auf ein Ergebnis?" ist die Frage, die diese
-- Tabelle bei jedem Seitenaufruf beantworten muss.
CREATE INDEX IF NOT EXISTS fiaon_calls_offen_idx
  ON fiaon_calls (agent_id, ergebnis_am NULLS FIRST, beginn DESC)
  WHERE ergebnis IS NULL;
CREATE INDEX IF NOT EXISTS fiaon_calls_person_idx ON fiaon_calls (person_id, beginn DESC);
CREATE INDEX IF NOT EXISTS fiaon_calls_transkript_idx
  ON fiaon_calls (transkript_status, beginn DESC)
  WHERE transkript_status IN ('offen', 'laeuft');

-- ── Protokoll jeder Wahl ───────────────────────────────────────────────────
-- Getrennt von `fiaon_calls`: Auch eine ABGELEHNTE Wahl (falsche Vorwahl,
-- Testkonto, Tageslimit) muss nachlesbar sein — und die erzeugt gerade keinen
-- Anruf-Datensatz.
CREATE TABLE IF NOT EXISTS fiaon_call_versuche (
  id          SERIAL PRIMARY KEY,
  agent_id    INTEGER NOT NULL,
  agent_name  TEXT,
  nummer      TEXT NOT NULL,
  person_id   INTEGER,
  erlaubt     BOOLEAN NOT NULL,
  grund       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_call_versuche_idx ON fiaon_call_versuche (created_at DESC);

-- ── Gesprächsblatt-Abrufe ──────────────────────────────────────────────────
-- Jeder Abruf kostet Geld und liest eine ganze Kundenakte. Beides gehört
-- protokolliert.
CREATE TABLE IF NOT EXISTS fiaon_gespraechsblatt_log (
  id         SERIAL PRIMARY KEY,
  person_id  INTEGER NOT NULL,
  agent_id   INTEGER,
  akteur     TEXT NOT NULL,
  aus_cache  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_gespraechsblatt_log_idx
  ON fiaon_gespraechsblatt_log (created_at DESC);
