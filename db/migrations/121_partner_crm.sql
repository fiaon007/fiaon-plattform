-- E-425 (22.10.2026): Geschäftspartner-CRM im Chefbüro (Global-Aufträge › Reiter „Geschäftspartner“).
-- Dieselbe DDL steht in server/lib/fiaon-partner-crm.ts (ensurePartnerTabellen). Additiv, keine Hard-Deletes:
-- archiviert_am / entfernt_am statt DELETE. Dateien liegen als BYTEA in der Datenbank (Muster Global-Dokumente).
CREATE TABLE IF NOT EXISTS fiaon_partner_firmen (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  art VARCHAR(20) NOT NULL DEFAULT 'sonstige',
  status VARCHAR(20) NOT NULL DEFAULT 'gespraech',
  website TEXT,
  email TEXT,
  telefon TEXT,
  strasse TEXT,
  hausnummer TEXT,
  adresszusatz TEXT,
  plz TEXT,
  ort TEXT,
  region TEXT,
  land_code VARCHAR(2),
  register_nr TEXT,
  steuer_nr TEXT,
  ust_id TEXT,
  leistung TEXT,
  konditionen JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags TEXT[] NOT NULL DEFAULT '{}',
  notizen TEXT,
  betreuer_agent_id INTEGER,
  vertraulich BOOLEAN NOT NULL DEFAULT FALSE,
  angebot_id INTEGER,
  person_id INTEGER,
  suchtext TEXT NOT NULL DEFAULT '',
  erstellt_von TEXT,
  archiviert_am TIMESTAMPTZ,
  archiviert_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_partner_firmen_angebot_eins ON fiaon_partner_firmen (angebot_id) WHERE angebot_id IS NOT NULL AND archiviert_am IS NULL;

CREATE TABLE IF NOT EXISTS fiaon_partner_kontakte (
  id SERIAL PRIMARY KEY,
  firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
  name TEXT NOT NULL,
  rolle TEXT,
  email TEXT,
  telefon TEXT,
  mobil TEXT,
  durchwahl TEXT,
  erreichbarkeit TEXT,
  sprache TEXT,
  strasse TEXT,
  hausnummer TEXT,
  adresszusatz TEXT,
  plz TEXT,
  ort TEXT,
  region TEXT,
  land_code VARCHAR(2),
  notizen TEXT,
  haupt BOOLEAN NOT NULL DEFAULT FALSE,
  suchtext TEXT NOT NULL DEFAULT '',
  erstellt_von TEXT,
  entfernt_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_partner_kontakte_firma ON fiaon_partner_kontakte (firma_id) WHERE entfernt_am IS NULL;

CREATE TABLE IF NOT EXISTS fiaon_partner_dokumente (
  id SERIAL PRIMARY KEY,
  firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
  kontakt_id INTEGER REFERENCES fiaon_partner_kontakte(id),
  art VARCHAR(20) NOT NULL DEFAULT 'sonstiges',
  titel TEXT NOT NULL,
  dateiname TEXT NOT NULL,
  mime TEXT NOT NULL,
  groesse INTEGER NOT NULL,
  pruefsumme VARCHAR(64) NOT NULL,
  inhalt BYTEA NOT NULL,
  gueltig_ab DATE,
  gueltig_bis DATE,
  notiz TEXT,
  hochgeladen_von TEXT,
  entfernt_am TIMESTAMPTZ,
  entfernt_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_partner_dokumente_firma ON fiaon_partner_dokumente (firma_id) WHERE entfernt_am IS NULL;

CREATE TABLE IF NOT EXISTS fiaon_partner_verlauf (
  id SERIAL PRIMARY KEY,
  firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
  kontakt_id INTEGER REFERENCES fiaon_partner_kontakte(id),
  typ VARCHAR(20) NOT NULL DEFAULT 'notiz',
  am DATE NOT NULL,
  titel TEXT NOT NULL,
  text TEXT,
  autor TEXT,
  dokument_id INTEGER REFERENCES fiaon_partner_dokumente(id),
  suchtext TEXT NOT NULL DEFAULT '',
  entfernt_am TIMESTAMPTZ,
  entfernt_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_partner_verlauf_firma ON fiaon_partner_verlauf (firma_id, am DESC) WHERE entfernt_am IS NULL;

CREATE TABLE IF NOT EXISTS fiaon_partner_aufgaben (
  id SERIAL PRIMARY KEY,
  firma_id INTEGER REFERENCES fiaon_partner_firmen(id),
  kontakt_id INTEGER REFERENCES fiaon_partner_kontakte(id),
  titel TEXT NOT NULL,
  notiz TEXT,
  faellig_am DATE,
  zustaendig TEXT,
  erledigt_am TIMESTAMPTZ,
  erledigt_von TEXT,
  erstellt_von TEXT,
  entfernt_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_partner_aufgaben_firma ON fiaon_partner_aufgaben (firma_id) WHERE entfernt_am IS NULL;
