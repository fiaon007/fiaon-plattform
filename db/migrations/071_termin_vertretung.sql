-- ═══════════════════════════════════════════════════════════════════════════
-- EIN STARTGESPRÄCH BEIM VERTRIEB IST EINE VERTRETUNG — UND DAS MUSS MAN SEHEN
--
-- ── DIE MELDUNG (Betrieb, 21.08.2026) ─────────────────────────────────────
-- „Kunden buchen ein Startgespräch, der Termin landet beim Vertrieb."
--
-- ── GEMESSEN ──────────────────────────────────────────────────────────────
-- 15 Termine der Quelle „onboarding_call" gingen zwischen dem 19.08. 11:08 und
-- dem 20.08. 10:22 an Angelique Laukert (Rolle „agent"). Alle 15 waren echte
-- Kundenbuchungen. Der Rückfall auf Vertrieb und Leitung hat funktioniert wie
-- gebaut — aber er war NIRGENDS zu sehen: nicht am Termin, nicht in der Liste,
-- nicht in der Bestätigung. Deshalb hat es niemand bemerkt.
--
-- Diese Spalte macht die Vertretung zählbar. Sie ist additiv und idempotent.
--
-- ── WARUM KEIN NACHTRAGEN DER 15 ALTEN ────────────────────────────────────
-- Weil man es nicht sicher weiß: Ob am 19.08. um 11:08 tatsächlich keine
-- Onboarding-Zeit frei war, lässt sich heute nicht mehr rekonstruieren — das
-- erste Onboarding-Konto entstand erst um 12:29. Eine Marke, die geraten ist,
-- ist schlimmer als keine. Die 15 stehen namentlich im Report; der Betreiber
-- entscheidet, ob sie umgehängt werden.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_termine
  ADD COLUMN IF NOT EXISTS vertretung BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fiaon_termine.vertretung IS
  'TRUE, wenn dieses Gespräch jemand aus einer anderen Rolle führt, weil bei der zuständigen Rolle keine Zeit frei war (Startgespräch → Onboarding).';

-- ── DIE ÜBERGABE AN EINEN ANDEREN MITARBEITER ─────────────────────────────
-- Krankheit, Urlaub, Rollenwechsel: täglich gebraucht, bisher nur über einen
-- direkten UPDATE in der Datenbank möglich. Wer übergibt, hinterlässt einen
-- Grund — sonst steht am nächsten Tag ein Termin bei jemandem, und niemand
-- weiß, warum.
ALTER TABLE fiaon_termine
  ADD COLUMN IF NOT EXISTS uebergeben_am     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS uebergeben_von    INTEGER,
  ADD COLUMN IF NOT EXISTS uebergeben_grund  TEXT;

COMMENT ON COLUMN fiaon_termine.uebergeben_von IS
  'Der Mitarbeiter, der den Termin VORHER hatte. Kein Hard-Delete der Zuordnung: Die Übergabe bleibt nachvollziehbar.';

-- Für die Betreiber-Liste „falsch zugeordnete Startgespräche".
CREATE INDEX IF NOT EXISTS fiaon_termine_quelle_beginn_idx
  ON fiaon_termine (quelle, beginn)
  WHERE abgesagt_am IS NULL;
