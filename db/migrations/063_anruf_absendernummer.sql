-- ═══════════════════════════════════════════════════════════════════════════
-- WELCHE NUMMER HAT ANGERUFEN?
--
-- ── WARUM DIESE SPALTE FEHLT ───────────────────────────────────────────────
-- `fiaon_calls.nummer` ist die GEWÄHLTE Nummer — die des Kunden. Wer ANGERUFEN
-- hat, steht nirgends: Die Absendernummer kommt aus `TWILIO_CALLER_ID` und wird
-- beim Wählen in das TwiML geschrieben, aber nicht mitgespeichert.
--
-- Solange es genau eine Absendernummer gibt, ist das kein Verlust — man kann sie
-- aus der Umgebung ablesen. Für den Schutz gegen Carrier-Spamflags („höchstens
-- N Anrufe je Nummer und Tag") reicht das aber nicht: Sobald eine ZWEITE Nummer
-- dazukommt — und genau das ist der empfohlene nächste Schritt, wenn eine Nummer
-- verbrannt ist —, zählt der Schutz beide in einen Topf und drosselt die
-- gesunde Nummer mit.
--
-- ── WAS MIT DEN ALTEN ZEILEN PASSIERT ─────────────────────────────────────
-- Sie bleiben NULL, und das ist richtig: Wir wissen nicht mit Beweis, über
-- welche Nummer sie liefen — wir wissen nur, dass es zu dieser Zeit genau eine
-- gab. Die Zählung behandelt NULL deshalb ausdrücklich als „die heute
-- konfigurierte Nummer" und sagt das im Kommentar an der Abfrage. Ein
-- rückwirkendes Befüllen wäre eine Behauptung über Daten, die wir nicht haben.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_calls ADD COLUMN IF NOT EXISTS von_nummer TEXT;

-- Die Frage des Schutzes: „wie viele Anrufe heute über diese Nummer?"
CREATE INDEX IF NOT EXISTS fiaon_calls_absender_tag_idx
  ON fiaon_calls (von_nummer, beginn DESC)
  WHERE richtung = 'raus';

COMMENT ON COLUMN fiaon_calls.von_nummer IS
  'Die ABSENDERNUMMER (TWILIO_CALLER_ID) zum Zeitpunkt des Anrufs. NULL bei Zeilen vor dem 30.08.2026 — damals gab es genau eine Nummer. Gebraucht fuer die Tagesgrenze je Nummer (Schutz gegen Carrier-Spamflag).';
