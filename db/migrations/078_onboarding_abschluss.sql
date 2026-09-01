-- P10 (01.09.2026, Team-Feedback): „Termin stattgefunden" ≠ „Onboarding
-- abgeschlossen". Der Stempel trennt beides; die Vergütung (15 €) hängt ab
-- jetzt am Abschluss, nicht am Termin-Haken.
ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS onboarding_abgeschlossen_am TIMESTAMPTZ;

-- Backfill: Alle VOR dieser Regel erledigten Startgespräche gelten als
-- abgeschlossen (erledigt_am) — sonst fluten Hunderte Alt-Kunden zurück in
-- den Onboarding-Bereich und jeder alte Fall sähe aus wie offene Arbeit.
UPDATE fiaon_termine
   SET onboarding_abgeschlossen_am = COALESCE(erledigt_am, updated_at, NOW())
 WHERE quelle = 'onboarding_call' AND status = 'erledigt'
   AND onboarding_abgeschlossen_am IS NULL;
