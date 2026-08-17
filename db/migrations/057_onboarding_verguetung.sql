-- ═══════════════════════════════════════════════════════════════════════════
-- DIE ONBOARDING-VERGÜTUNG — genau eine Gutschrift je Kunde
--
-- ── DER AUFTRAG ────────────────────────────────────────────────────────────
-- „Für jedes erfolgreich abgeschlossene Startgespräch eine kleine Vergütung,
-- einstellbar, Vorgabe 15 €. Genau EINE je Kunde, auch bei zwei Gesprächen."
--
-- ── WARUM DER INDEX UND NICHT EINE PRÜFUNG IM CODE ─────────────────────────
-- „Schau vorher, ob schon eine Gutschrift da ist" hält genau so lange, wie
-- niemand zweimal gleichzeitig abschließt. Zwei Anfragen im selben Moment
-- lesen beide „keine da" und schreiben beide. Der Index kann das nicht.
--
-- Es ist ein TEILINDEX auf `kind = 'onboarding'`: Vertriebsprovisionen und
-- Team-Beteiligungen dürfen weiterhin mehrfach je Person entstehen — sie haben
-- eine andere Regel.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE fiaon_commissions
  -- Der Kunde, für den das Startgespräch geführt wurde. `ref` allein genügt
  -- nicht: Ein Mensch kann mehrere Bestellungen haben (Paket + Auskunft), und
  -- dann wäre „eine je ref" nicht „eine je Kunde".
  ADD COLUMN IF NOT EXISTS onboarding_person_id INTEGER;

COMMENT ON COLUMN fiaon_commissions.onboarding_person_id IS
  'Bei kind=onboarding: der Kunde. Eindeutig — genau eine Verguetung je Kunde.';

-- ── DIE WAND ───────────────────────────────────────────────────────────────
-- Vor dem Index den Bestand bereinigen, falls schon Onboarding-Gutschriften
-- ohne Personenbezug existieren (gemessen am 18.08.2026: keine). Der Index
-- würde sonst scheitern und die Migration mit ihm.
-- ── WARUM DAS PRÄDIKAT NUR „kind = 'onboarding'" LAUTET ───────────────────
-- Ein erster Entwurf hatte zusätzlich „AND onboarding_person_id IS NOT NULL".
-- Fachlich richtig, technisch fatal: PostgreSQL kann einen Teilindex nur dann
-- für ON CONFLICT verwenden, wenn das WHERE der Anweisung dem Index-Prädikat
-- entspricht. Der Aufruf scheiterte mit „infer_arbiter_indexes" (42P10) — die
-- Wand stand da, aber niemand konnte sie benutzen.
--
-- Die Zusatzbedingung war ohnehin überflüssig: In einem Unique-Index sind
-- mehrere NULL-Werte erlaubt. Zeilen ohne Personenbezug stören also nicht.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_commissions_onboarding_person_idx
  ON fiaon_commissions (onboarding_person_id)
  WHERE kind = 'onboarding';

-- Der Onboarding-Bereich zeigt „was habe ich diesen Monat verdient?".
CREATE INDEX IF NOT EXISTS fiaon_commissions_onboarding_agent_idx
  ON fiaon_commissions (agent_id, created_at DESC)
  WHERE kind = 'onboarding';
