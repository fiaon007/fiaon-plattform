-- ═══════════════════════════════════════════════════════════════════════════
-- 077 — WARUM EIN STARTGESPRÄCH NICHT STATTGEFUNDEN HAT (24.08.2026)
--
-- VORHER: Ein Termin war entweder erledigt oder verpasst. Der Mensch mit der
--   falschen Rufnummer, der Absager und der, der nicht mehr wollte, standen
--   alle als „verpasst" in derselben Zeile — und niemand konnte hinterher
--   sagen, welche Art No-Show wie oft vorkommt.
-- NACHHER: Der im Onboarding gewählte Grund steht am Termin.
--   Erlaubte Werte (Stand 24.08.2026, Liste im Server):
--     nicht_erschienen · nummer_falsch · kunde_abgesagt · kein_interesse
--   Bewusst OHNE CHECK-Constraint: Die Spalte steuert nichts. Sie ist
--   Buchführung, und ein neuer Grund soll nicht an einer Wanderfassung
--   scheitern. Geprüft wird beim Schreiben (server/routes/
--   fiaon-onboarding-bereich.ts, NICHT_ERSCHIENEN_GRUENDE).
--
-- GRUND: Auftrag des Inhabers vom 24.08.2026 — „dann wählt man aus WARUM, und
--   basierend darauf löst sich was aus".
--
-- Der Server legt die Spalte zusätzlich lazy an (ensureVerpasstSpalten), damit
-- ein Neustart ohne eingespielte Wanderfassung nicht auf die Nase fällt.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_termine ADD COLUMN IF NOT EXISTS verpasst_grund TEXT;

-- Für die Auswertung „welcher Grund wie oft" — nur die Zeilen, die einen
-- Grund tragen, alles andere wäre Index über NULL.
CREATE INDEX IF NOT EXISTS fiaon_termine_verpasst_grund_idx
  ON fiaon_termine (verpasst_grund)
  WHERE verpasst_grund IS NOT NULL;
