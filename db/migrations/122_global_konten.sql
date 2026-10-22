-- E-423 (22.10.2026): der persönliche Zugang für FIAON-Global-Kunden — Anmeldung mit E-Mail, Passwort und Code per Mail.
-- Dieselbe DDL steht in server/lib/fiaon-global-konto.ts (ensureGlobalKonto). Additiv, ganz getrennt vom Privatkunden-Login:
-- keine Spalte an fiaon_persons oder fiaon_applications. Nichts wird gelöscht (beendet_am, verworfen_am, entfernt_am).
CREATE TABLE IF NOT EXISTS fiaon_global_konten (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL CHECK (email = LOWER(email)),
  name TEXT, anrede TEXT, nachname TEXT, firma TEXT,
  sprache TEXT NOT NULL DEFAULT 'de' CHECK (sprache IN ('de', 'en')),
  passwort_hash TEXT CHECK (passwort_hash IS NULL OR passwort_hash LIKE 'scrypt$%'),
  status TEXT NOT NULL DEFAULT 'eingeladen' CHECK (status IN ('eingeladen', 'aktiv', 'gesperrt')),
  einladung_nonce TEXT, passwort_nonce TEXT,
  eingeladen_am TIMESTAMPTZ, einladung_anzahl INTEGER NOT NULL DEFAULT 0, einladung_von TEXT,
  eingerichtet_am TIMESTAMPTZ, passwort_geaendert_am TIMESTAMPTZ, letzte_anmeldung_am TIMESTAMPTZ,
  fehlversuche INTEGER NOT NULL DEFAULT 0, gesperrt_bis TIMESTAMPTZ,
  quelle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_global_konten_email_uidx ON fiaon_global_konten (email);

-- Was ein Konto sehen darf: eine Akte (fiaon_global_auftraege.ref) oder ein angenommenes Angebot (fiaon_global_angebote.angebot_ref).
CREATE TABLE IF NOT EXISTS fiaon_global_konto_refs (
  id BIGSERIAL PRIMARY KEY,
  konto_id BIGINT NOT NULL REFERENCES fiaon_global_konten(id),
  art TEXT NOT NULL CHECK (art IN ('auftrag', 'angebot')),
  ref TEXT NOT NULL,
  quelle TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  entfernt_am TIMESTAMPTZ,
  UNIQUE (konto_id, art, ref)
);
CREATE INDEX IF NOT EXISTS fiaon_global_konto_refs_ref_idx ON fiaon_global_konto_refs (ref);

-- Die Codes (sechs Ziffern, zehn Minuten, fünf Versuche): nur als HMAC mit Server-Geheimnis und Vorgang gespeichert.
CREATE TABLE IF NOT EXISTS fiaon_global_konto_codes (
  id BIGSERIAL PRIMARY KEY,
  konto_id BIGINT NOT NULL REFERENCES fiaon_global_konten(id),
  zweck TEXT NOT NULL CHECK (zweck IN ('anmeldung', 'einrichtung', 'passwort')),
  vorgang_hash TEXT NOT NULL UNIQUE,
  code_hash TEXT NOT NULL,
  gueltig_bis TIMESTAMPTZ NOT NULL,
  versuche INTEGER NOT NULL DEFAULT 0,
  neu_gesendet INTEGER NOT NULL DEFAULT 0,
  letzter_versand_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bleiben BOOLEAN NOT NULL DEFAULT TRUE,
  neues_passwort_hash TEXT,
  link_nonce TEXT,
  eingeloest_am TIMESTAMPTZ, verworfen_am TIMESTAMPTZ,
  ip TEXT, user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_global_konto_codes_konto_idx ON fiaon_global_konto_codes (konto_id, created_at DESC);

-- Sitzungen (Cookie fiaon_global_sitzung): nur der SHA-256 des Zufallswerts. Abmelden setzt beendet_am.
CREATE TABLE IF NOT EXISTS fiaon_global_konto_sitzungen (
  id BIGSERIAL PRIMARY KEY,
  konto_id BIGINT NOT NULL REFERENCES fiaon_global_konten(id),
  token_hash TEXT NOT NULL UNIQUE,
  bleiben BOOLEAN NOT NULL DEFAULT TRUE,
  erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zuletzt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  gueltig_bis TIMESTAMPTZ NOT NULL,
  beendet_am TIMESTAMPTZ, beendet_grund TEXT,
  ip TEXT, user_agent TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_global_konto_sitzungen_konto_idx ON fiaon_global_konto_sitzungen (konto_id, beendet_am);

-- Das Anmeldeprotokoll: jede Anmeldung, jeder falsche Versuch, jede Einladung. Ohne Konto nur ein Hash der Adresse.
CREATE TABLE IF NOT EXISTS fiaon_global_konto_protokoll (
  id BIGSERIAL PRIMARY KEY,
  konto_id BIGINT,
  email_hash TEXT,
  ereignis TEXT NOT NULL,
  erfolg BOOLEAN NOT NULL DEFAULT TRUE,
  ip TEXT, user_agent TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_global_konto_protokoll_konto_idx ON fiaon_global_konto_protokoll (konto_id, created_at DESC);
