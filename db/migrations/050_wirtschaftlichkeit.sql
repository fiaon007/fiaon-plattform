-- ═══════════════════════════════════════════════════════════════════════════
-- FESTGEHALT UND WIRTSCHAFTLICHKEIT
--
-- Der Vorgesetzte: „ab jetzt bekommen unsere Angestellten (nicht jeder) einen
-- festen Gehalt … ich muss jeden Tag auf 1 Blick sehen: Lohnt sich der
-- Mitarbeiter? Sind die täglichen Kosten gedeckt? Ab wann macht er Gewinn?"
--
-- ── WARUM CENT UND NICHT EURO ──────────────────────────────────────────────
-- Wie überall im System: Geld in ganzen Cent als BIGINT. Ein NUMERIC(10,2)
-- rundet beim Teilen durch Arbeitstage anders als die Provisionsrechnung, und
-- dann stimmen zwei Zahlen auf derselben Seite nicht überein.
--
-- ── WARUM NUR DER BETREIBER DAS SIEHT ──────────────────────────────────────
-- Ein Festgehalt ist die persönlichste Zahl im ganzen System. Die
-- Vertriebsleitung führt das Team, aber sie verhandelt keine Verträge —
-- und wer es einmal gesehen hat, kann es nicht mehr vergessen.
-- Die Rechteprüfung sitzt serverseitig, nicht in der Oberfläche.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_agents
  -- Monatliches Festgehalt in Cent. NULL heißt: kein Festgehalt, reine
  -- Provision. Das ist der Regelfall und bleibt es.
  ADD COLUMN IF NOT EXISTS festgehalt_cents BIGINT,
  -- Ab wann es gilt. Wer am 20. anfängt, kostet im ersten Monat nicht das
  -- volle Gehalt — die Rechnung braucht das Datum.
  ADD COLUMN IF NOT EXISTS gehalt_ab DATE,
  -- Was sich der Mensch im Monat vornimmt (Cent Umsatz). Dient nur der
  -- Anzeige, nie einer Buchung.
  ADD COLUMN IF NOT EXISTS monatsziel_cents BIGINT,
  -- Das Vergütungsmodell in Klartext: „provision", "stunden", "fest",
  -- "fest_plus_provision". Wird bei der Einladung gesetzt.
  ADD COLUMN IF NOT EXISTS verguetungsmodell TEXT,
  ADD COLUMN IF NOT EXISTS startdatum DATE;

COMMENT ON COLUMN fiaon_agents.festgehalt_cents IS
  'Monatliches Festgehalt in Cent. NUR für den Vorgesetzten sichtbar — nie in '
  'Antworten an Team oder Vertriebsleitung aufnehmen.';

-- ── ARBEITSTAGE ────────────────────────────────────────────────────────────
-- Die Tageskosten sind Festgehalt geteilt durch Arbeitstage, nicht durch 30.
-- Ein Mensch, der am Sonntag nichts verkauft, hat am Sonntag auch keine
-- Kosten verursacht — sonst sähe jedes Wochenende nach Verlust aus.
CREATE TABLE IF NOT EXISTS fiaon_kalender_einstellung (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT INTO fiaon_kalender_einstellung (key, value)
VALUES ('arbeitstage_pro_monat', '21')
ON CONFLICT (key) DO NOTHING;
