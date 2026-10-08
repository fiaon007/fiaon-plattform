-- ═══════════════════════════════════════════════════════════════════════════
-- FIAON FINANZ- UND BONITÄTSAUSWERTUNG · UPLOAD-LINK OHNE LOGIN
-- (E-IT-D, 08.10.2026 — Punkt 4b und 4c des Team-Feedbacks)
--
-- Fünf neue Tabellen, nichts an bestehenden Tabellen:
--
-- 1. fiaon_finanzauswertungen — jede Fassung einer Auswertung (je Person 1, 2, …).
--    Der Inhalt (Ampeln, FIAON-Finanzwert, Kriterien, Schritte, Texte) liegt
--    EINGEFROREN in `inhalt` — das Portal rechnet nie selbst nach. Das PDF liegt in
--    fiaon_dokumente (art 'finanzauswertung', quelle 'erzeugt'), hier nur die Id.
--    Höchstens ein Lauf je Person gleichzeitig (Teilindex auf status = 'laeuft').
-- 2. fiaon_unterlagen_links — der Upload-Link ohne Anmeldung (14 Tage, mehrfach
--    nutzbar, nur die angeforderten Arten, widerrufbar). Das Token ist signiert
--    und trägt die Id — gespeichert wird es nicht.
-- 3. fiaon_unterlagen_anfragen — das Protokoll jeder Anforderung aus der Akte
--    (wer, wann, an welche Adresse/Nummer, Ergebnis je Kanal). Daraus rechnet die
--    Drossel (höchstens drei je Kunde und Tag, mindestens 15 Minuten Abstand).
-- 4. fiaon_unterlagen_sichtpruefung — die Sichtprüfung eines Ausweises durch einen
--    Menschen (Reisepass-Datenseite, Personalausweis beidseitig, Aufenthaltstitel
--    nur mit Reisepass). Gebunden an den Prüfwert der Datei: Ein neuer Upload
--    macht sie ungültig. Keine Ausweisnummer, keine maschinenlesbare Zone.
--
-- ── SPERREN ───────────────────────────────────────────────────────────────
-- Nur CREATE TABLE/INDEX IF NOT EXISTS auf neuen Tabellen — keine Sperre auf
-- einer heißen Tabelle. Dieselbe DDL legt der Server beim ersten Gebrauch selbst
-- an (ensureFinanzauswertungTabellen / ensureUnterlagenLinkTabellen) — die
-- Reihenfolge Code/Migration ist gleichgültig. Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS fiaon_finanzauswertungen (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  ref TEXT,
  fassung INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'laeuft'
    CHECK (status IN ('laeuft', 'entwurf', 'freigegeben', 'ersetzt', 'verworfen', 'fehler')),
  regel_version TEXT,
  modell TEXT,
  texte_quelle TEXT,
  eingaben JSONB,
  inhalt JSONB,
  gesamt TEXT,
  finanzwert INTEGER,
  band TEXT,
  vorbehalt BOOLEAN NOT NULL DEFAULT FALSE,
  vier_augen BOOLEAN NOT NULL DEFAULT FALSE,
  pdf_dokument_id BIGINT,
  erstellt_von TEXT,
  erstellt_von_id BIGINT,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fertig_am TIMESTAMPTZ,
  freigegeben_von TEXT,
  freigegeben_von_id BIGINT,
  freigegeben_am TIMESTAMPTZ,
  verworfen_von TEXT,
  verworfen_am TIMESTAMPTZ,
  verworfen_grund TEXT,
  mail_status TEXT,
  mail_am TIMESTAMPTZ,
  kunde_gelesen_am TIMESTAMPTZ,
  kosten_cents NUMERIC,
  fehler TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, fassung)
);
CREATE INDEX IF NOT EXISTS fiaon_finanzauswertungen_person_idx ON fiaon_finanzauswertungen (person_id, erstellt_am DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_finanzauswertungen_ein_lauf_idx ON fiaon_finanzauswertungen (person_id) WHERE status = 'laeuft';
-- Höchstens EINE freigegebene Fassung je Person (Gegenprüfung 08.10.: zwei gleichzeitige Freigaben).
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_finanzauswertungen_eine_frei_idx ON fiaon_finanzauswertungen (person_id) WHERE status = 'freigegeben';

CREATE TABLE IF NOT EXISTS fiaon_unterlagen_links (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  ref TEXT,
  arten TEXT[] NOT NULL,
  gueltig_bis TIMESTAMPTZ NOT NULL,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  erstellt_von TEXT,
  erstellt_von_id BIGINT,
  nutzungen INTEGER NOT NULL DEFAULT 0,
  dateien INTEGER NOT NULL DEFAULT 0,
  letzte_nutzung TIMESTAMPTZ,
  widerrufen_am TIMESTAMPTZ,
  widerruf_grund TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_unterlagen_links_person_idx ON fiaon_unterlagen_links (person_id, erstellt_am DESC);

CREATE TABLE IF NOT EXISTS fiaon_unterlagen_anfragen (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  link_id BIGINT,
  arten TEXT[] NOT NULL,
  quelle TEXT NOT NULL DEFAULT 'akte',
  mail_status TEXT,
  whatsapp_status TEXT,
  adresse TEXT,
  nummer TEXT,
  grund TEXT,
  von TEXT,
  von_id BIGINT,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_unterlagen_anfragen_person_idx ON fiaon_unterlagen_anfragen (person_id, am DESC);

CREATE TABLE IF NOT EXISTS fiaon_unterlagen_sichtpruefung (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  art TEXT NOT NULL DEFAULT 'ausweis',
  doc_hash TEXT NOT NULL,
  dokumenttyp TEXT NOT NULL CHECK (dokumenttyp IN ('reisepass', 'personalausweis', 'aufenthaltstitel_pass')),
  von TEXT,
  von_id BIGINT,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  widerrufen_am TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS fiaon_unterlagen_sichtpruefung_person_idx ON fiaon_unterlagen_sichtpruefung (person_id, am DESC);

-- 5. fiaon_unterlagen_teile — welche hochgeladenen Dateien (Prüfwert je Datei) in der
--    zusammengesetzten Datei einer Unterlage stecken. Gilt nur, solange die Spalte genau
--    das Ergebnis (ergebnis_hash) hält. Damit hängt der Upload-Link dieselbe Datei nicht
--    zweimal an (Gegenprüfung 08.10.).
CREATE TABLE IF NOT EXISTS fiaon_unterlagen_teile (
  id BIGSERIAL PRIMARY KEY,
  person_id BIGINT NOT NULL,
  art TEXT NOT NULL,
  ergebnis_hash TEXT NOT NULL,
  teile TEXT[] NOT NULL,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_unterlagen_teile_idx ON fiaon_unterlagen_teile (person_id, art, ergebnis_hash);
