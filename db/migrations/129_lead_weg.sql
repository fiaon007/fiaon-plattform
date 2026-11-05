-- 129 — FIAON Global: Lead-Weg (E-476 Scheibe 3, 05.11.2026) — Gespräch bei Justin, persönlicher Link, Cockpit-Knopf,
-- /justin-Weiche, „Termin steht“ (D2) und Anruf-Karte (D3).
-- Laufzeit-Gegenstück: leadWegSchema in server/lib/fiaon-lead-weg.ts (gleiche Anweisungen, idempotent, über die DDL-Wache).
-- Sie läuft beim Lesen des Links, im Cockpit, im Lauf global_gespraeche und im Dossier-Lauf — NIE im Eingang
-- (globalAnfrageAnnehmen, Meta-Einspielen) und nie innerhalb der Buchungs-Transaktion (Gutachten 0, Mangel 22).
--
-- fiaon_lead_weg: EINE Zeile je Global-Anfrage — der persönliche Terminlink fiaon.com/g/<code> (10 Zeichen, Zufall,
--   30 Tage gültig, keine Kundendaten in der Adresse) und was der Lead-Weg über die Anfrage weiß (Klicks, Antwort an
--   welcome@ — die Mara-Weiche). Scheibe 4 (Lead-Mails) hängt ihre Spalten hier an, nicht an fiaon_anfragen.
-- fiaon_lead_gespraech: EINE Zeile je Lead-Gespräch (fiaon_termine) — woran es hängt (Anfrage, Firma), wie es entstand
--   (eigener Link, Seite, Cockpit, /justin), was der Lead im Anruf selbst erzählt hat, und die Meldungen an Justin.
CREATE TABLE IF NOT EXISTS fiaon_lead_weg (
  anfrage_id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  code_bis TIMESTAMPTZ NOT NULL,
  firma_id INTEGER,
  klicks INTEGER NOT NULL DEFAULT 0,
  klick_am TIMESTAMPTZ,
  antwort_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_lead_weg_firma_idx ON fiaon_lead_weg (firma_id) WHERE firma_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS fiaon_lead_gespraech (
  termin_id INTEGER PRIMARY KEY,
  anfrage_id INTEGER,
  firma_id INTEGER,
  person_id INTEGER,
  -- link (persönlicher Link) · seite (Kalender ohne Link, per Mail/Telefon zugeordnet) · agent (Cockpit-Knopf) · justin (/justin-Weiche)
  weg TEXT NOT NULL,
  eingetragen_von TEXT,
  erzaehlt TEXT,
  einschaetzung TEXT,
  faden_betreff TEXT,
  d2_am TIMESTAMPTZ,
  d2_id TEXT,
  d2_versuche INTEGER NOT NULL DEFAULT 0,
  d2_laeuft TIMESTAMPTZ,
  d3_am TIMESTAMPTZ,
  d3_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Nachbesserung 05.11.2026 (Gutachten Technik, Mangel 4): die Anruf-Karte D3 mit eigener Laufzeit-Marke (10 Minuten Verfall).
ALTER TABLE fiaon_lead_gespraech ADD COLUMN IF NOT EXISTS d3_laeuft TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS fiaon_lead_gespraech_anfrage_idx ON fiaon_lead_gespraech (anfrage_id) WHERE anfrage_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiaon_lead_gespraech_firma_idx ON fiaon_lead_gespraech (firma_id) WHERE firma_id IS NOT NULL;
