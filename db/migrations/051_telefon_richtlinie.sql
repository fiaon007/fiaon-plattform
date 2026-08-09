-- ═══════════════════════════════════════════════════════════════════════════
-- TELEFON-RICHTLINIE UND AUFBEWAHRUNG
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_calls
  -- Der Kunde hat der Aufzeichnung widersprochen. Der Zeitpunkt ist der
  -- Nachweis, dass FIAON auf den Widerspruch reagiert hat — und er ist der
  -- Grund, warum es zu diesem Anruf kein Transkript gibt.
  ADD COLUMN IF NOT EXISTS ohne_aufzeichnung_am TIMESTAMPTZ,
  -- Wann die Aufnahme gelöscht wurde. Eine Aufnahme ohne Ablaufdatum ist ein
  -- Datenschutzproblem, das nur älter wird.
  ADD COLUMN IF NOT EXISTS aufnahme_geloescht_am TIMESTAMPTZ;

-- Aufbewahrungsfrist in Tagen. 90 ist die Vorgabe: lang genug, um ein
-- Gespräch nachzuhören, kurz genug, um kein Archiv aufzubauen.
INSERT INTO fiaon_settings (key, value) VALUES ('aufnahme_frist_tage', '90')
ON CONFLICT (key) DO NOTHING;

-- Der Pflichtsatz zum Vorlesen. Änderbar, aber nie leer (siehe hinweisSatz()).
INSERT INTO fiaon_settings (key, value)
VALUES ('telefon_hinweis_satz',
        'Hinweis: Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet — sind Sie damit einverstanden?')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS fiaon_calls_aufnahme_frist_idx
  ON fiaon_calls (beginn)
  WHERE recording_url IS NOT NULL AND aufnahme_geloescht_am IS NULL;
