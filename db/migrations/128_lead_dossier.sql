-- 128 — FIAON Global: Lead-Dossier an Justin (E-476 Scheibe 1+2, 05.11.2026)
-- Laufzeit-Gegenstück: leadDossierSchema in server/lib/fiaon-lead-dossier.ts (gleiche Anweisungen, idempotent) — sie
-- läuft im Dossier-Lauf und im Anstoß NACH dem Eingang, nie im Eingang selbst (Gutachten 0, Mangel 22).
-- Eine Zeile je Anlass: eine Global-Anfrage (anlass 'anfrage') oder eine Global-Buchung ohne Anfrage (anlass 'termin').
-- Alle Meldungen zu einem Lead hängen über firma_id am selben Mail-Faden (faden_betreff + Message-IDs).
-- basis/ki: JSON, immer über sql.json geschrieben (Falle E-238). Kein Schattenregister: basis hält nur die Kurzfassung
-- der Registerfunde, die in der Mail an Justin stand. Aufbewahrung: der Lauf leert basis/ki/antworten/hinweis nach 180
-- Tagen, wenn aus dem Lead kein Kunde wurde (Gutachten Sicherheit 05.11.2026).
CREATE TABLE IF NOT EXISTS fiaon_lead_dossier (
  id BIGSERIAL PRIMARY KEY,
  anlass TEXT NOT NULL,
  anlass_id INTEGER NOT NULL,
  anfrage_id INTEGER,
  termin_id INTEGER,
  firma_id INTEGER,
  person_id INTEGER,
  kanal TEXT,
  eingang_am TIMESTAMPTZ,
  antworten JSONB,
  hinweis JSONB,
  basis JSONB,
  ki JSONB,
  temperatur TEXT,
  status TEXT NOT NULL DEFAULT 'offen',
  versuche INTEGER NOT NULL DEFAULT 0,
  laeuft_seit TIMESTAMPTZ,
  -- Nachbesserung 05.11.2026: Wartezeit vor dem nächsten Versandversuch (2/15/60 Min.), nächster Blick des KI-Nachtrags,
  -- und wann Justin „Ich rufe selbst an“ gedrückt hat.
  naechster_versuch_am TIMESTAMPTZ,
  grund TEXT,
  ki_status TEXT,
  ki_versuche INTEGER NOT NULL DEFAULT 0,
  ki_grund TEXT,
  ki_kosten_cents NUMERIC,
  ki_am TIMESTAMPTZ,
  ki_naechster_am TIMESTAMPTZ,
  faden_betreff TEXT,
  mail_basis_am TIMESTAMPTZ,
  mail_basis_id TEXT,
  mail_ki_am TIMESTAMPTZ,
  mail_ki_id TEXT,
  selbst_am TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (anlass, anlass_id)
);
CREATE INDEX IF NOT EXISTS fiaon_lead_dossier_status_idx ON fiaon_lead_dossier (status, created_at);
CREATE INDEX IF NOT EXISTS fiaon_lead_dossier_firma_idx ON fiaon_lead_dossier (firma_id, created_at) WHERE firma_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiaon_lead_dossier_ki_idx ON fiaon_lead_dossier (ki_status, created_at);
-- Sperrzeilen (Nachbesserung 05.11.2026): höchstens EIN KI-Check gleichzeitig („ki“), je Firma eine Verarbeitung
-- („firma:<id>“). Eine Zeile mit Ablaufzeit statt einer gehaltenen Verbindung — ein abgestürzter Prozess sperrt höchstens bis „bis“.
CREATE TABLE IF NOT EXISTS fiaon_lead_dossier_sperre (
  schluessel TEXT PRIMARY KEY,
  bis TIMESTAMPTZ NOT NULL,
  wer TEXT
);
