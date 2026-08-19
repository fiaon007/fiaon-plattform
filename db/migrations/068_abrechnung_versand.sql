-- ═══════════════════════════════════════════════════════════════════════════
-- ABRECHNUNGEN: VERSAND PROTOKOLLIEREN UND NEU ERZEUGEN (19.08.2026)
--
-- ── DIE MELDUNG ───────────────────────────────────────────────────────────
-- „Keine zentrale Einsicht." Die zehn erzeugten Provisionsabrechnungen lagen in
-- `fiaon_commission_statements`, das PDF als base64 in der Zeile — es gab keine
-- Ansicht, in der der Betreiber sie sehen, prüfen oder verschicken konnte. Der
-- einzige Weg war der Mitarbeiter selbst über sein Portal.
--
-- ── WAS DIESE SPALTEN LEISTEN ─────────────────────────────────────────────
-- „An Mitarbeiter senden" muss nachvollziehbar sein: WANN, an WEN, und beim
-- zweiten Mal ausdrücklich als Wiederholung. Ohne Protokoll steht in einem
-- halben Jahr die Frage „hat er die Abrechnung bekommen?" ohne Antwort im Raum —
-- und ein Beleg, dessen Zustellung niemand belegen kann, ist ein halber Beleg.
--
-- Erneutes Senden ist ERLAUBT (Menschen verlieren Mails). Es wird nur gezählt
-- und datiert, damit die Wiederholung sichtbar ist.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_commission_statements
  -- Wann ging sie zuletzt an den Mitarbeiter?
  ADD COLUMN IF NOT EXISTS gesendet_am TIMESTAMPTZ,
  -- An welche Adresse? Die Adresse kann sich ändern; der Beleg hält fest,
  -- wohin er GING, nicht wohin er heute gehen würde.
  ADD COLUMN IF NOT EXISTS gesendet_an VARCHAR,
  -- Wie oft insgesamt? 1 = einmal, alles darüber ist eine Wiederholung.
  ADD COLUMN IF NOT EXISTS sende_anzahl INTEGER NOT NULL DEFAULT 0,
  -- Wer hat den Versand ausgelöst (Name aus der Verwaltung)?
  ADD COLUMN IF NOT EXISTS gesendet_von VARCHAR,
  -- Wann wurde das PDF zuletzt neu gebaut? Nur zulässig, solange die
  -- Auszahlung nicht ausgezahlt ist — danach ist das Dokument ein Beleg.
  ADD COLUMN IF NOT EXISTS neu_erzeugt_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS neu_erzeugt_anzahl INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN fiaon_commission_statements.sende_anzahl IS
  'Anzahl der Sendungen an den Mitarbeiter. Ab 2 ist es eine Wiederholung und '
  'wird in der Ansicht als „erneut gesendet am …" ausgewiesen.';

COMMENT ON COLUMN fiaon_commission_statements.neu_erzeugt_am IS
  'Neu erzeugen ist nur erlaubt, solange die zugehoerige Auszahlung nicht den '
  'Status ausgezahlt hat. Ein ausgezahlter Beleg wird nicht veraendert.';

CREATE INDEX IF NOT EXISTS fiaon_commission_statements_gesendet_idx
  ON fiaon_commission_statements (gesendet_am);
