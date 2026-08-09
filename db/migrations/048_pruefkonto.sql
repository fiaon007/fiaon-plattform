-- ═══════════════════════════════════════════════════════════════════════════
-- PRÜFKONTO — der Unterschied zwischen einer Attrappe und dem Betreiber
--
-- ── DAS PROBLEM ────────────────────────────────────────────────────────────
-- `is_test_account` bedeutete bisher zwei völlig verschiedene Dinge:
--
--   1. ATTRAPPE — ein Konto ohne Menschen dahinter. Es darf keine Kunden
--      zugeteilt bekommen, keine Termine anbieten, keine Mails auslösen.
--      Ein echter Kunde, der mit einer Attrappe telefonieren soll, wartet
--      auf jemanden, den es nicht gibt.
--
--   2. DAS PRÜFKONTO DES BETREIBERS — ein echter Mensch, der die Plattform
--      aus der Sicht des Teams sehen und JEDE Funktion ausprobieren muss.
--
-- Weil beides denselben Schalter benutzte, konnte der Betreiber über sein
-- eigenes Konto nicht telefonieren („Testkonten können nicht telefonieren")
-- und keine erhöhte Rolle bekommen. Ein Prüfkonto, das die Hälfte nicht
-- kann, prüft nichts.
--
-- ── DIE TRENNUNG ───────────────────────────────────────────────────────────
-- `pruefkonto` hebt die Sperren auf, die MENSCHEN betreffen: telefonieren,
-- Rolle wechseln, alles sehen, Nachrichten empfangen.
--
-- Es hebt NICHT die Ausschlüsse auf, die ECHTE KUNDEN betreffen: automatische
-- Zuteilung, Terminangebote, Wiedereinstiegs-Mails. Ein Kunde, der auf einem
-- Prüfkonto landet, ist ein verlorener Kunde — egal wie echt der Mensch
-- dahinter ist. Wer damit testen will, weist sich einen Kunden von Hand zu.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_agents
  ADD COLUMN IF NOT EXISTS pruefkonto BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN fiaon_agents.pruefkonto IS
  'Prüfkonto des Betreibers: darf alles wie ein Vollkonto, bekommt aber keine '
  'automatisch verteilten Kunden. Nicht zu verwechseln mit is_test_account '
  '(Attrappe ohne Menschen dahinter).';

-- Das Konto des Betreibers. Über die Adresse, nicht über die Kennung: Eine
-- Kennung kann sich beim Umzug ändern, die Adresse ist die Identität.
UPDATE fiaon_agents
   SET pruefkonto = TRUE
 WHERE LOWER(email) = 'office@schwarzott-global.com';
