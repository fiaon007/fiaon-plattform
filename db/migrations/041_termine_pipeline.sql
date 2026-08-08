-- ═══════════════════════════════════════════════════════════════════════════
-- LEAD-PIPELINE UND TERMINSYSTEM
--
-- Drei neue Tabellen und vier Spalten. Alles idempotent, nichts wird gelöscht.
--
--   fiaon_termine                Gebuchte Gespräche. Ein Slot, eine Buchung.
--   fiaon_agent_verfuegbarkeit   Wann ein Agent buchbar ist (Mo–Fr 09–18 Vorgabe).
--   fiaon_mail_log               Leichtes Versandprotokoll. Ein fehlgeschlagener
--                                Webhook darf nicht spurlos verschwinden.
--
-- Zeitrechnung: `beginn` ist TIMESTAMPTZ (ein echter Zeitpunkt), die
-- Verfügbarkeit dagegen TIME ohne Zone — sie ist eine Regel in Europe/Berlin
-- („montags ab neun"), kein Zeitpunkt. Die Umrechnung passiert an einer Stelle
-- in server/lib/fiaon-termine.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Termine ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiaon_termine (
  id            SERIAL PRIMARY KEY,
  person_id     INTEGER NOT NULL,
  agent_id      INTEGER NOT NULL,
  beginn        TIMESTAMPTZ NOT NULL,
  dauer_min     SMALLINT NOT NULL DEFAULT 20,
  -- gebucht | abgesagt | verpasst | erledigt
  status        VARCHAR NOT NULL DEFAULT 'gebucht',
  -- onboarding | nichterreicht_mail | agent_manuell
  quelle        VARCHAR NOT NULL DEFAULT 'onboarding',
  storno_token  VARCHAR,
  -- Ergebnis-Dokumentation des Agenten (freier Text, optional).
  notiz         TEXT,
  erledigt_am   TIMESTAMPTZ,
  abgesagt_am   TIMESTAMPTZ,
  -- Wann die 24-Stunden-Erinnerung rausging. Verhindert Doppelversand.
  erinnert_am   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EIN SLOT, EINE BUCHUNG. Der Index ist die Wand, nicht die Prüfung im Code:
-- Zwei gleichzeitige Buchungen auf denselben Slot enden hier, egal wie schnell
-- sie sind. Abgesagte Termine geben den Slot wieder frei, deshalb der WHERE-Teil.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_termine_slot_uniq
  ON fiaon_termine (agent_id, beginn)
  WHERE status IN ('gebucht', 'erledigt', 'verpasst');

CREATE INDEX IF NOT EXISTS fiaon_termine_person_idx ON fiaon_termine (person_id, beginn DESC);
CREATE INDEX IF NOT EXISTS fiaon_termine_agent_idx  ON fiaon_termine (agent_id, beginn);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_termine_storno_uniq
  ON fiaon_termine (storno_token) WHERE storno_token IS NOT NULL;

-- ── Verfügbarkeit ──────────────────────────────────────────────────────────
-- wochentag: 1 = Montag … 7 = Sonntag (ISO, wie EXTRACT(ISODOW)).
CREATE TABLE IF NOT EXISTS fiaon_agent_verfuegbarkeit (
  id         SERIAL PRIMARY KEY,
  agent_id   INTEGER NOT NULL,
  wochentag  SMALLINT NOT NULL,
  von        TIME NOT NULL,
  bis        TIME NOT NULL,
  aktiv      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS fiaon_verfuegbarkeit_uniq
  ON fiaon_agent_verfuegbarkeit (agent_id, wochentag, von);
CREATE INDEX IF NOT EXISTS fiaon_verfuegbarkeit_agent_idx
  ON fiaon_agent_verfuegbarkeit (agent_id) WHERE aktiv;

-- ── Versandprotokoll ───────────────────────────────────────────────────────
-- Bewusst schmal gehalten: Die Vollversion (Zustellung, Öffnung, Bounce) kommt
-- später. Erweiterbar heißt hier: neue Spalten, keine neue Tabelle. Deshalb
-- steht `payload` als JSONB dabei — was heute fehlt, ist morgen nachlesbar.
CREATE TABLE IF NOT EXISTS fiaon_mail_log (
  id         SERIAL PRIMARY KEY,
  event      VARCHAR NOT NULL,
  person_id  INTEGER,
  empfaenger VARCHAR,
  -- versandt | fehlgeschlagen | ausstehend | uebersprungen
  status     VARCHAR NOT NULL,
  grund      TEXT,
  payload    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fiaon_mail_log_person_idx ON fiaon_mail_log (person_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fiaon_mail_log_event_idx  ON fiaon_mail_log (event, created_at DESC);

-- ── Person: Nicht-erreicht-Automatik ───────────────────────────────────────
-- Wann zuletzt eine Terminlink-Mail rausging. Grundlage der Regel „genau
-- einmal je Kunde je 30 Tage" — ohne diese Spalte bekäme ein Kunde die Mail
-- bei jedem weiteren Fehlversuch erneut, und das ist der Weg in den Spam-Ordner.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS terminlink_mail_am TIMESTAMPTZ;

-- Seit wann die Person im Ruhe-Pool liegt (nach dem 4. erfolglosen Versuch).
-- NICHT „gesperrt": Sie bleibt in ihrer Stufe, in der Liste und im Bestand —
-- sie ist nur heute nicht dran. Der Unterschied ist der ganze Punkt.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS ruhe_seit TIMESTAMPTZ;

-- Wann zuletzt eine Wiedereinstiegs-Mail rausging (Teil 4, einmalig gestaffelt).
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS wiedereinstieg_am TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS fiaon_persons_ruhe_idx
  ON fiaon_persons (ruhe_seit) WHERE ruhe_seit IS NOT NULL;
