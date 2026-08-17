-- ═══════════════════════════════════════════════════════════════════════════
-- DIE AUSNAHME VON DER ONBOARDING-PFLICHT
--
-- ── DER AUFTRAG (20.08.2026) ───────────────────────────────────────────────
-- „Auch die bezahlten Bestandskunden ohne erledigtes Startgespräch stehen auf
-- wartet_auf_onboarding. AUSNAHME-Schalter je Kunde in der Akte (mit Grund,
-- auditiert) für Härtefälle."
--
-- ── WARUM ES DIESEN SCHALTER BRAUCHT ───────────────────────────────────────
-- GEMESSEN: 364 bezahlte Kunden ohne erledigtes Startgespräch. Die meisten
-- werden es führen. Aber es gibt Fälle, in denen es nicht geht: ein Kunde im
-- Krankenhaus, einer, der ausdrücklich kein Telefonat will, einer, mit dem
-- längst gesprochen wurde, ohne dass es einen Termin gab.
--
-- Ohne Ausnahme müsste die Verwaltung entweder einen Termin fälschen (einen
-- „erledigten" Termin anlegen, den es nie gab) oder den Kunden aussperren.
-- Beides ist schlechter als ein sichtbarer, begründeter Schalter.
--
-- ── WARUM MIT GRUND UND NAMEN ──────────────────────────────────────────────
-- Ein Schalter ohne Begründung wird zur Gewohnheit. Nach drei Monaten steht er
-- bei zweihundert Kunden, und niemand weiß mehr, warum. Der Grund ist deshalb
-- PFLICHT (die Route lehnt ohne ihn ab), und er steht in der Akte, wo die
-- nächste Person ihn liest.
--
-- Und er trägt den Namen dessen, der ihn gesetzt hat. Nicht als Misstrauen,
-- sondern damit man ihn fragen kann.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_applications
  -- Warum ist die Pflicht ausgesetzt? Ohne Text gilt sie (siehe
  -- `stufeAbleiten`: Ausnahme greift nur MIT Grund).
  ADD COLUMN IF NOT EXISTS onboarding_ausnahme_grund TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_ausnahme_von TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_ausnahme_am TIMESTAMPTZ;

COMMENT ON COLUMN fiaon_applications.onboarding_ausnahme_grund IS
  'Warum die Onboarding-Pflicht ausgesetzt ist. Leer = Pflicht gilt. Ohne Grund keine Ausnahme.';

-- Wer hat Ausnahmen? Die Verwaltung muss das nachzählen können, damit der
-- Schalter nicht zur Gewohnheit wird.
CREATE INDEX IF NOT EXISTS fiaon_applications_ausnahme_idx
  ON fiaon_applications (onboarding_ausnahme_am DESC)
  WHERE onboarding_ausnahme_grund IS NOT NULL;

-- ── DIE STUFE WIRD ABGELEITET, ABER AUCH GESPEICHERT ──────────────────────
-- `onboarding_stufe` bleibt als ABSCHRIFT der Ableitung (Listen brauchen sie,
-- sonst wären es 360 Abfragen). Sie kennt jetzt drei Werte statt zwei.
COMMENT ON COLUMN fiaon_applications.onboarding_stufe IS
  'ABSCHRIFT der Ableitung aus server/lib/fiaon-kundenstufe.ts. Nie als Wahrheit lesen — stufeAbleiten() gilt.';
