-- ═══════════════════════════════════════════════════════════════════════════
-- INKASSO — Raten abarbeiten, Stunden erfassen, Onboarding begleiten
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Arbeitsstand an der RATE ───────────────────────────────────────────────
-- Der Vertrieb dokumentiert an der PERSON (fiaon_contact_log, follow_up_date).
-- Inkasso arbeitet an der RATE: „Zahlt Rate 3 am 20.08." ist eine Aussage über
-- eine Rate, nicht über einen Menschen. Wer das an der Person festhielte,
-- könnte Rate 3 und Rate 4 nicht auseinanderhalten.
CREATE TABLE IF NOT EXISTS fiaon_raten_arbeit (
  id            SERIAL PRIMARY KEY,
  rate_id       INTEGER NOT NULL REFERENCES fiaon_abo_raten(id) ON DELETE CASCADE,
  ref           TEXT NOT NULL,
  agent_id      INTEGER NOT NULL,
  agent_name    TEXT,
  -- zahlt_am | ueberwiesen_beleg | nicht_erreicht | eskalation
  ergebnis      TEXT NOT NULL,
  -- Bei „zahlt am": das zugesagte Datum.
  zusage_am     DATE,
  -- Wann diese Rate wieder auf den Tisch kommt.
  wiedervorlage DATE,
  notiz         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- „Wer hat diese Rate zuletzt bearbeitet?" — die Frage, an der die Provision
-- hängt. Ohne Index wäre sie bei jeder Ratenbuchung ein Tabellendurchlauf.
CREATE INDEX IF NOT EXISTS fiaon_raten_arbeit_rate_idx
  ON fiaon_raten_arbeit (rate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fiaon_raten_arbeit_agent_idx
  ON fiaon_raten_arbeit (agent_id, created_at DESC);

-- Der Arbeitszustand der Rate selbst — damit die Liste nicht bei jedem Aufruf
-- die Arbeitshistorie durchsuchen muss.
ALTER TABLE fiaon_abo_raten
  ADD COLUMN IF NOT EXISTS inkasso_wiedervorlage DATE,
  ADD COLUMN IF NOT EXISTS inkasso_zusage_am     DATE,
  ADD COLUMN IF NOT EXISTS inkasso_versuche      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inkasso_agent_id      INTEGER,
  ADD COLUMN IF NOT EXISTS inkasso_letzte_arbeit TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS eskaliert_am          TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS fiaon_abo_raten_inkasso_idx
  ON fiaon_abo_raten (status, inkasso_wiedervorlage, faellig_am)
  WHERE status = 'offen';

-- ── Stunden ────────────────────────────────────────────────────────────────
-- Bestätigte Stunden sind UNVERÄNDERLICH. Wer eine bestätigte Zeile noch
-- ändern könnte, könnte eine Abrechnung nachträglich verschieben — und der
-- Vorgesetzter hätte etwas anderes bestätigt, als am Ende ausgezahlt wird.
CREATE TABLE IF NOT EXISTS fiaon_stunden (
  id             SERIAL PRIMARY KEY,
  agent_id       INTEGER NOT NULL REFERENCES fiaon_agents(id) ON DELETE CASCADE,
  tag            DATE NOT NULL,
  von            TIME NOT NULL,
  bis            TIME NOT NULL,
  minuten        INTEGER NOT NULL,
  notiz          TEXT,
  bestaetigt_am  TIMESTAMPTZ,
  bestaetigt_von TEXT,
  -- Die Provisionszeile, über die ausgezahlt wurde. Gesetzt heißt: abgerechnet.
  commission_id  INTEGER,
  entfernt_am    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_stunden_agent_idx ON fiaon_stunden (agent_id, tag DESC);
CREATE INDEX IF NOT EXISTS fiaon_stunden_offen_idx
  ON fiaon_stunden (agent_id, tag) WHERE bestaetigt_am IS NULL AND entfernt_am IS NULL;

-- ── Vergütung je Mitarbeiter ───────────────────────────────────────────────
-- PLATZHALTER. Die Werte sind bewusst so gesetzt, dass sie auffallen, und in
-- der Oberfläche als „vom Vorgesetzter zu bestätigen" markiert. Ein stiller
-- Vorgabewert, den niemand prüft, wird sonst zur echten Abrechnung.
ALTER TABLE fiaon_agents
  ADD COLUMN IF NOT EXISTS stundensatz_cents      INTEGER,
  -- 'euro' oder 'prozent'
  ADD COLUMN IF NOT EXISTS inkasso_praemie_art    TEXT,
  ADD COLUMN IF NOT EXISTS inkasso_praemie_wert   INTEGER,
  ADD COLUMN IF NOT EXISTS verguetung_bestaetigt_am TIMESTAMPTZ;

-- ── Onboarding-Schritte ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiaon_onboarding_schritte (
  id          SERIAL PRIMARY KEY,
  agent_id    INTEGER NOT NULL REFERENCES fiaon_agents(id) ON DELETE CASCADE,
  schluessel  TEXT NOT NULL,
  erledigt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, schluessel)
);
CREATE INDEX IF NOT EXISTS fiaon_onboarding_agent_idx ON fiaon_onboarding_schritte (agent_id);
