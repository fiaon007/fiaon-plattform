-- ═══════════════════════════════════════════════════════════════════════════
-- DER ABO-MOTOR — Anker, Idempotenz, Storno, Sichtbarkeit
--
-- Die Geschäftsregel des Betreibers: Jeder Kunde mit einem Paket hat ein Abo.
-- Anker ist der Tag der bankbestätigten Buchung. Gebucht am 05.07. → fällig
-- am 05.08., 05.09., … Die 74-€-Bonitätsauskunft ist KEIN Abo.
--
-- Additiv und wiederholbar: nur ADD COLUMN IF NOT EXISTS, CREATE INDEX
-- IF NOT EXISTS und UPDATE-Nachträge, die beim zweiten Lauf nichts mehr
-- finden. Kein DROP, kein DELETE.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. DER ANKER ───────────────────────────────────────────────────────────
-- `paid_at` ist der Tag, an dem ein Mensch die Zahlung gegen den Kontoauszug
-- bestätigt hat („Als bezahlt markieren" in der Verbuchung, Kontoabgleich,
-- Buchung durch die Vertriebsleitung).
--
-- Warum nicht `completed_at`: Das wird beim Abschluss des Antrags gesetzt und
-- danach mit COALESCE nur noch verteidigt. Wer am 01.07. den Antrag abschickt
-- und am 05.07. überweist, hätte den 01.07. als Anker — vier Tage vor dem
-- Geld. Der Kunde bekäme seine Rechnung, bevor sein Monat um ist.
--
-- Warum es das gebraucht hätte: `server/routes/fiaon-vertrieb.ts` schrieb
-- bereits in `paid_at`. Die Spalte gab es nicht — die Buchung durch die
-- Vertriebsleitung lief seither in einen Serverfehler.
ALTER TABLE fiaon_applications
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

COMMENT ON COLUMN fiaon_applications.paid_at IS
  'Tag der bankbestätigten Buchung. Anker des Abo-Zyklus (monatlicher Jahrestag).';

-- Nachtrag für den Bestand, in dieser Rangfolge:
--   1. die früheste ANGEWENDETE Bankbuchung zu dieser Bestellung — das ist
--      die Buchung im Wortsinn,
--   2. ersatzweise `completed_at`, weil es die einzige andere Auskunft ist.
-- Ausgewiesen wird das nicht hier, sondern im Abgleichslauf: Wer keinen
-- Bankbeleg hat, steht dort in der Vorschau-CSV.
UPDATE fiaon_applications a
SET paid_at = t.erste
FROM (
  SELECT matched_ref, MIN(booked_at) AS erste
  FROM fiaon_bank_txns
  WHERE applied AND matched_ref IS NOT NULL
  GROUP BY matched_ref
) t
WHERE a.ref = t.matched_ref AND a.paid_at IS NULL;

UPDATE fiaon_applications
SET paid_at = completed_at
WHERE paid_at IS NULL AND payment_status = 'paid' AND completed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS fiaon_applications_paid_at_idx
  ON fiaon_applications (paid_at) WHERE payment_status = 'paid';

-- ── 2. STORNO STATT LÖSCHEN ────────────────────────────────────────────────
-- Eine Rate, die nie hätte entstehen dürfen, wird nicht entfernt — sie wird
-- entwertet und trägt den Grund. Sonst weiß in vier Wochen niemand mehr,
-- warum die Forderung verschwunden ist.
ALTER TABLE fiaon_abo_raten
  ADD COLUMN IF NOT EXISTS storniert_am   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS storno_grund   TEXT,
  -- Wann ging die Monatsrechnung raus? Ohne diese Spalte kann der Tageslauf
  -- nicht unterscheiden zwischen „heute fällig, Rechnung ist raus" und
  -- „heute fällig, Rechnung hängt".
  ADD COLUMN IF NOT EXISTS rechnung_am    TIMESTAMPTZ,
  -- Die freundliche Vorabinfo X Tage vor Fälligkeit. Eigene Spalte, damit sie
  -- die Mahnstufe nicht anfasst und nicht doppelt rausgeht.
  ADD COLUMN IF NOT EXISTS vorab_am       TIMESTAMPTZ,
  -- Ab wann steht die Rate im Forderungsmanagement? Gesetzt am Tag NACH der
  -- Fälligkeit, wenn keine Zahlung gebucht ist.
  ADD COLUMN IF NOT EXISTS ueberfaellig_seit DATE;

-- ── 3. IDEMPOTENZ: EINE RATE JE BESTELLUNG UND FÄLLIGKEIT ──────────────────
-- Der Tageslauf darf beliebig oft laufen. Die Wand dagegen steht hier, nicht
-- in einem `if` im Anwendungscode: Ein zweiter Lauf, ein zweiter Prozess oder
-- ein Klick auf „Motor jetzt laufen lassen" erzeugt keine zweite Rechnung
-- für denselben Zeitraum.
--
-- Stornierte Raten sind ausgenommen: Wird eine Rate entwertet und der Fall
-- später richtig neu angelegt, darf dieselbe Fälligkeit wieder entstehen.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_abo_raten_ref_faellig_uidx
  ON fiaon_abo_raten (ref, faellig_am)
  WHERE storniert_am IS NULL;

-- Der Tageslauf sucht „was ist heute fällig" und „was ist gestern fällig
-- geworden und nicht bezahlt". Beides über diesen Index.
CREATE INDEX IF NOT EXISTS fiaon_abo_raten_lauf_idx
  ON fiaon_abo_raten (faellig_am, status)
  WHERE storniert_am IS NULL;

-- ── 4. DER STATUS „storniert" IST KEIN OFFENER POSTEN ──────────────────────
-- Der Bestand kennt bereits `status = 'storniert'` (aus dem Abo-Stopp). Diese
-- Zeilen bekommen rückwirkend ihren Zeitstempel, damit „storniert" und
-- „storniert_am IS NOT NULL" dasselbe bedeuten — zwei Wahrheiten für einen
-- Zustand sind der Anfang jeder falschen Zahl.
UPDATE fiaon_abo_raten
SET storniert_am = COALESCE(updated_at, created_at, NOW()),
    storno_grund = COALESCE(storno_grund, 'Abo gestoppt (Bestand, vor Einführung der Storno-Spalte)')
WHERE status = 'storniert' AND storniert_am IS NULL;

-- ── 5. ÜBERFÄLLIG-STEMPEL FÜR DEN BESTAND ──────────────────────────────────
-- Damit die Inkasso-Karte auch bei Altfällen sagen kann, seit wann etwas
-- liegt — und nicht nur „überfällig".
UPDATE fiaon_abo_raten
SET ueberfaellig_seit = faellig_am + 1
WHERE ueberfaellig_seit IS NULL
  AND storniert_am IS NULL
  AND status = 'offen'
  AND faellig_am < CURRENT_DATE;
