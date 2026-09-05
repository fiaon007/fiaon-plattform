-- ═══════════════════════════════════════════════════════════════════════════
-- 080 · Neuer Kundenbereich /app — Ansprüche, Vorgänge, Dokumente (05.09.2026)
--
-- Detailplan „Weg zum Rahmen" (04_Fahrplan/DETAILPLAN_2026-09-05.md), Abschnitt
-- 3.2: Tabellen 083 (Antworten), 084 (Ansprüche), 085 (Vorgänge), 087
-- (Dokumente) — hier zusammengefasst, weil sie gemeinsam den ersten sichtbaren
-- Nutzen tragen: Anspruchs-Check mit Beträgen, Brief-Knopf, Post-Reiter.
--
-- Die REGELN (Beträge, Rechtsgrundlage, Quelle, Prüfdatum) liegen vorerst als
-- Daten in shared/fiaon-ansprueche.ts, nicht in einer Tabelle (Plan 084
-- fiaon_anspruch_regeln) — eine Quelle für Client und Server, versioniert im
-- Git. Wandert in die Tabelle, sobald jemand sie im Chefbüro pflegen soll.
--
-- Idempotent (IF NOT EXISTS). Dieselbe DDL steht in
-- server/routes/fiaon-app.ts (ensureAppTabellen) und läuft beim ersten Aufruf.
-- ═══════════════════════════════════════════════════════════════════════════

-- Die zehn Fragen des Anspruchs-Checks — eine Zeile je Frage und Mensch.
CREATE TABLE IF NOT EXISTS fiaon_anspruch_antworten (
  id                   BIGSERIAL PRIMARY KEY,
  person_id            BIGINT NOT NULL,
  frage_schluessel     TEXT NOT NULL,
  wert                 JSONB,
  termin_id            BIGINT,
  erhoben_am           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erhoben_von_agent_id BIGINT,
  quelle               TEXT NOT NULL DEFAULT 'kunde' CHECK (quelle IN ('kunde','startgespraech','antrag')),
  UNIQUE (person_id, frage_schluessel)
);

-- Der Befund je Mensch und Regel — was er beantragen kann, in welcher Höhe.
CREATE TABLE IF NOT EXISTS fiaon_ansprueche (
  id               BIGSERIAL PRIMARY KEY,
  person_id        BIGINT NOT NULL,
  regel_schluessel TEXT NOT NULL,
  stand            TEXT NOT NULL DEFAULT 'offen'
                   CHECK (stand IN ('offen','verworfen','beantragt','bewilligt','abgelehnt','nicht_zutreffend')),
  betrag_cents     INTEGER,
  monatlich        BOOLEAN NOT NULL DEFAULT TRUE,
  begruendung      TEXT,
  frist_am         DATE,
  vorgang_id       BIGINT,
  erkannt_am       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  aktualisiert_am  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, regel_schluessel)
);
CREATE INDEX IF NOT EXISTS fiaon_ansprueche_person_idx ON fiaon_ansprueche (person_id, stand);

-- Vorgänge: eingegangene Briefe und gestellte Anträge, jeder mit Stand und Frist.
CREATE TABLE IF NOT EXISTS fiaon_vorgaenge (
  id                  BIGSERIAL PRIMARY KEY,
  person_id           BIGINT NOT NULL,
  art                 TEXT NOT NULL
                      CHECK (art IN ('brief','p_konto','p_konto_umwandlung','rundfunk','selbstauskunft','wohngeld','kfz','handy')),
  titel               TEXT NOT NULL,
  anspruch_id         BIGINT,
  stand               TEXT NOT NULL DEFAULT 'eingegangen'
                      CHECK (stand IN ('eingegangen','gelesen','entwurf','unterschrift_offen','versandbereit','versandt','nachfrage','bewilligt','abgelehnt','zurueckgezogen','erledigt')),
  stand_text          TEXT,
  empfaenger_name     TEXT,
  empfaenger_adresse  TEXT,
  versandt_am         TIMESTAMPTZ,
  frist_am            DATE,
  behoerden_az        TEXT,
  aktenzeichen        TEXT,
  erinnert_am         TIMESTAMPTZ,
  eskaliert_am        TIMESTAMPTZ,
  zustaendig_agent_id BIGINT,
  notiz_kunde         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_vorgaenge_person_idx ON fiaon_vorgaenge (person_id, created_at DESC);
-- Der Fristenwächter liest nur, was versandt ist und eine Frist trägt.
CREATE INDEX IF NOT EXISTS fiaon_vorgaenge_frist_idx ON fiaon_vorgaenge (stand, frist_am) WHERE stand IN ('versandt','nachfrage');

-- EIN Tisch für alle Dokumente: hochgeladen, erzeugt, eingegangen.
CREATE TABLE IF NOT EXISTS fiaon_dokumente (
  id                   BIGSERIAL PRIMARY KEY,
  person_id            BIGINT NOT NULL,
  ref                  TEXT,
  vorgang_id           BIGINT,
  art                  TEXT NOT NULL,
  dateiname            TEXT NOT NULL,
  mime                 TEXT NOT NULL,
  bytes                INTEGER NOT NULL,
  inhalt               BYTEA NOT NULL,
  quelle               TEXT NOT NULL CHECK (quelle IN ('kunde','mitarbeiter','erzeugt','eingegangen')),
  aktenzeichen         TEXT,
  doc_hash             TEXT NOT NULL,
  hochgeladen_am       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  geprueft_am          TIMESTAMPTZ,
  geprueft_von_agent_id BIGINT,
  urteil               JSONB,
  gesendet_am          TIMESTAMPTZ,
  gesendet_an          TEXT,
  sende_anzahl         INTEGER NOT NULL DEFAULT 0,
  ersetzt_dokument_id  BIGINT,
  geloescht_am         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS fiaon_dokumente_person_idx ON fiaon_dokumente (person_id, hochgeladen_am DESC);
CREATE INDEX IF NOT EXISTS fiaon_dokumente_vorgang_idx ON fiaon_dokumente (vorgang_id);
