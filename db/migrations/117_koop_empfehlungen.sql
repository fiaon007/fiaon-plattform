-- ═══════════════════════════════════════════════════════════════════════════
-- 117 · EMPFEHLUNGEN DES PARTNERS AN FIAON (22.10.2026, E-419)
-- Der Server legt die Tabelle beim ersten Gebrauch selbst an (server/lib/fiaon-koop-empfehlung.ts, ensureEmpfehlungTabelle).
-- Je Empfehlung eine Zeile; Provision = Prozent (schalter.provision am Kooperationsvertrag) × Zahlungen der zugeordneten Person
-- aus der Umsatz-Quelle (E-343) in den ersten 12 Monaten ab Meldung, ohne Durchlaufposten.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_koop_empfehlungen (
  id BIGSERIAL PRIMARY KEY,
  angebot_id INTEGER NOT NULL,
  person_id INTEGER,
  name TEXT NOT NULL,
  telefon TEXT,
  email TEXT,
  notiz TEXT,
  quelle VARCHAR(20) NOT NULL DEFAULT 'fiaon',
  gemeldet_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ausgezahlt_cents INTEGER NOT NULL DEFAULT 0,
  entfernt_am TIMESTAMPTZ,
  eingetragen_von TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_koop_empfehlungen_angebot_idx ON fiaon_koop_empfehlungen (angebot_id) WHERE entfernt_am IS NULL;
