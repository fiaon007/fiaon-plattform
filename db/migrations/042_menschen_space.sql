-- ═══════════════════════════════════════════════════════════════════════════
-- MENSCHEN & MOMENTUM — Onboarding-Rolle, Startgespräche, FIAON Space
--
-- Nichts wird gelöscht, nichts umbenannt. Alle Ergänzungen sind additiv und
-- idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Verpflichtungserklärung: jetzt für MEHRERE Bereiche ────────────────────
-- Die Tabelle heißt weiterhin fiaon_vertrieb_zusagen. Sie umzubenennen wäre
-- ein Risiko ohne Gegenwert: Der Name ist an einem Dutzend Stellen verdrahtet,
-- und der Inhalt ändert sich nicht — es kommt nur ein zweiter Bereich dazu.
-- Bestehende Zeilen sind allesamt Vertriebs-Zusagen, deshalb der Vorgabewert.
ALTER TABLE fiaon_vertrieb_zusagen
  ADD COLUMN IF NOT EXISTS bereich TEXT NOT NULL DEFAULT 'vertrieb';

CREATE INDEX IF NOT EXISTS fiaon_zusagen_bereich_idx
  ON fiaon_vertrieb_zusagen (agent_id, bereich, version);

-- ── Startgespräch: der Zustand am Kunden ───────────────────────────────────
-- Wann der Kunde das Gate zuletzt weggeklickt hat. Grundlage der einen
-- Erinnerungsmail 48 Stunden später — und des dezenten Dauerbanners.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS startgespraech_spaeter_am TIMESTAMPTZ;

-- Wann die Einladungsmail rausging. Genau eine, deshalb ein Zeitstempel und
-- kein Zähler.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS startgespraech_mail_am TIMESTAMPTZ;

-- ── FIAON Space ────────────────────────────────────────────────────────────
-- Der gemeinsame Raum aller Mitarbeiterrollen. Kein Kundendatenspeicher:
-- Was hier steht, geht jeden im Haus etwas an — und niemanden draußen.
CREATE TABLE IF NOT EXISTS fiaon_posts (
  id             SERIAL PRIMARY KEY,
  -- NULL bei Systemposts. Ein Systempost hat keinen Menschen als Autor, und
  -- ein erfundener Autor wäre eine Lüge in der Zeitleiste.
  autor_agent_id INTEGER,
  -- team | leitung | system
  autor_typ      TEXT NOT NULL DEFAULT 'team',
  text           TEXT NOT NULL,
  angepinnt      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Kennzeichnung automatischer Posts, damit ein Tageslauf erkennt, ob er
  -- heute schon gelaufen ist: 'gedanke' | 'feiertage' | 'news' | 'update'.
  auto_art       TEXT,
  -- Bei 'gedanke' die laufende Nummer des Spruchs, damit sich in 90 Tagen
  -- keiner wiederholt.
  auto_schluessel TEXT,
  geloescht_at   TIMESTAMPTZ,
  geloescht_von  INTEGER,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_posts_feed_idx
  ON fiaon_posts (angepinnt DESC, created_at DESC) WHERE geloescht_at IS NULL;
-- Ein Auto-Post je Art und Tag. Der eindeutige Index ist die Wand gegen den
-- Doppelpost beim Neustart — nicht die Prüfung im Code davor.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_posts_auto_uniq
  ON fiaon_posts (auto_art, auto_schluessel)
  WHERE auto_art IS NOT NULL AND auto_schluessel IS NOT NULL;

CREATE TABLE IF NOT EXISTS fiaon_post_reaktionen (
  id         SERIAL PRIMARY KEY,
  post_id    INTEGER NOT NULL,
  agent_id   INTEGER NOT NULL,
  -- daumen | herz | stern | blitz — eine kleine feste Auswahl eigener Marken.
  art        TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Eine Reaktion je Person und Post. Wer eine andere Marke wählt, ersetzt die
-- eigene — ein Mensch hat zu einer Sache eine Meinung, nicht vier.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_post_reaktion_uniq
  ON fiaon_post_reaktionen (post_id, agent_id);

CREATE TABLE IF NOT EXISTS fiaon_post_kommentare (
  id           SERIAL PRIMARY KEY,
  post_id      INTEGER NOT NULL,
  agent_id     INTEGER NOT NULL,
  text         TEXT NOT NULL,
  geloescht_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_post_kommentare_idx
  ON fiaon_post_kommentare (post_id, created_at) WHERE geloescht_at IS NULL;

-- Wann ein Mitarbeiter den Space zuletzt gesehen hat — Grundlage der
-- Ungelesen-Marke am Menüpunkt.
ALTER TABLE fiaon_agents
  ADD COLUMN IF NOT EXISTS space_gesehen_am TIMESTAMPTZ;

-- ── Versandzentrum ─────────────────────────────────────────────────────────
-- Wer den Versand ausgelöst hat. Bisher stand im Protokoll nur, DASS etwas
-- rausging — bei einer manuellen Wiederholung muss auch dabeistehen, wer sie
-- angestoßen hat, sonst ist das Tageslimit nicht nachvollziehbar.
ALTER TABLE fiaon_mail_log
  ADD COLUMN IF NOT EXISTS ausgeloest_von TEXT;

ALTER TABLE fiaon_mail_log
  ADD COLUMN IF NOT EXISTS ausgeloest_agent_id INTEGER;

CREATE INDEX IF NOT EXISTS fiaon_mail_log_limit_idx
  ON fiaon_mail_log (person_id, event, created_at DESC);
