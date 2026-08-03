-- ═══════════════════════════════════════════════════════════════════════════
-- 032 · CRM-UMBAU: DIE PERSON BESITZT DEN KUNDEN
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Bisher hing die Zuständigkeit am Antrag. Ein Kunde mit acht Bestellungen
-- konnte acht Zuständigkeiten haben — die Ursache der 26 Zuweisungskonflikte.
-- Ab hier ist `fiaon_persons` der Besitzer, alles andere folgt.
--
-- Diese Migration ist rein ADDITIV. Keine Spalte wird umbenannt, keine
-- gelöscht, keine bestehende Zuständigkeit verändert. Sie legt nur die Felder
-- an, die der Vertriebsprozess braucht, und setzt die Konfiguration.
--
-- Der Backfill von `priority_tier` und `tier_reason` passiert NICHT hier,
-- sondern in einem eigenen Schritt über `server/lib/tier.ts`, damit die
-- Rangfolge nur an einer Stelle existiert. Bis dahin trägt jede Person den
-- Vorgabewert Tier 3 / `nur_lead` — das ist der ungefährlichste Zustand:
-- niemand wird fälschlich als zahlungsnah eingestuft.
--
-- Rücknahme: db/rollback/032_crm_person_ownership_rollback.sql
-- Diese Datei liegt bewusst NICHT in db/migrations/, weil der Runner dort
-- jede .sql-Datei bei jedem Start ausführen würde.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1 · fiaon_persons — die Arbeitsfelder des Vertriebs
-- ───────────────────────────────────────────────────────────────────────────

-- Das Tier. Werte: -1 ausgeschlossen · 0 Bestandskunde · 1 · 2 · 3
-- Vorgabe 3, weil eine neu angelegte Person ohne Antrag genau das ist: ein Lead.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS priority_tier SMALLINT NOT NULL DEFAULT 3;

-- Warum die Person in diesem Tier liegt. Steuert Badge und Handlungshinweis
-- auf der Agentenkarte; die Texte stehen in server/lib/tier-hinweise.ts.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS tier_reason TEXT NOT NULL DEFAULT 'nur_lead';

-- Das vom Kunden zugesagte Zahlungsdatum. Genau EINES pro Person: das
-- neueste gewinnt. Die Historie aller Zusagen liegt in fiaon_contact_log.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS promised_payment_date DATE;

-- Wann der Agent wieder anrufen muss. Grundlage der Tagesliste „Heute fällig".
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS follow_up_date DATE;

-- Wie oft der Kunde nicht erreicht wurde. Ab 3 Kandidat für die Rotation.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS unreachable_count INTEGER NOT NULL DEFAULT 0;

-- Kunde will nicht kontaktiert werden. Erscheint in keiner Anrufliste.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Wie oft „Zahlungsdetails senden" ausgelöst wurde. Ab dem 3. Versand ohne
-- Zahlung warnt die Karte, damit der Button kein Ersatz für ein Gespräch wird.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS invoice_sent_count INTEGER NOT NULL DEFAULT 0;

-- Seit wann der aktuelle Agent die Person besitzt. Ohne dieses Datum lässt
-- sich weder Horten noch Liegezeit messen.
ALTER TABLE fiaon_persons
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Wertebereich absichern. Beide Mengen sind geschlossen und in tier.ts
-- definiert; ein Tippfehler im Anwendungscode soll hier auffallen und nicht
-- still eine unsichtbare Person erzeugen.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_persons_priority_tier_chk'
  ) THEN
    ALTER TABLE fiaon_persons
      ADD CONSTRAINT fiaon_persons_priority_tier_chk
      CHECK (priority_tier IN (-1, 0, 1, 2, 3));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fiaon_persons_tier_reason_chk'
  ) THEN
    ALTER TABLE fiaon_persons
      ADD CONSTRAINT fiaon_persons_tier_reason_chk
      CHECK (tier_reason IN (
        'bezahlt', 'zahlung_angekuendigt', 'rechnung_offen',
        'zahlungsfrist_abgelaufen', 'antrag_abgeschlossen',
        'antrag_abgebrochen', 'nur_lead', 'ausgeschlossen'
      ));
  END IF;
END $$;

-- Zugriffsmuster des neuen Systems: Pool-Abfragen nach Tier, Tagesliste nach
-- Agent und Fälligkeit, Zusagen-Feed nach zugesagtem Datum.
CREATE INDEX IF NOT EXISTS fiaon_persons_tier_agent_idx
  ON fiaon_persons (priority_tier, assigned_agent_id);

CREATE INDEX IF NOT EXISTS fiaon_persons_agent_followup_idx
  ON fiaon_persons (assigned_agent_id, follow_up_date)
  WHERE follow_up_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS fiaon_persons_promised_idx
  ON fiaon_persons (promised_payment_date)
  WHERE promised_payment_date IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 2 · fiaon_agents — Testkonten kennzeichnen
-- ───────────────────────────────────────────────────────────────────────────
--
-- Semantisch getrennt von `distribution_active`, und das mit Absicht:
--   is_test_account      = kein echter Mensch, dauerhaft
--   distribution_active  = nimmt aktuell an der Verteilung teil (Urlaub, Pause)
-- Die Verteilung filtert auf beides, die Leistungsauswertung nur auf das erste.

ALTER TABLE fiaon_agents
  ADD COLUMN IF NOT EXISTS is_test_account BOOLEAN NOT NULL DEFAULT FALSE;

-- #5 Herbert Schöttl (welcome@fiaon.com, nie eingeloggt),
-- #2 und #7 Justin Schwarzott — zwei Konten derselben Person, erkennbar an
-- identischer maskierter IBAN. Beide sind Testkonten, nicht nur eines.
UPDATE fiaon_agents SET is_test_account = TRUE
WHERE id IN (2, 5, 7) AND is_test_account = FALSE;

-- #7 ist das verwaiste Zweitkonto: zusätzlich aus Verteilung und Betrieb nehmen.
UPDATE fiaon_agents SET distribution_active = FALSE, active = FALSE
WHERE id = 7 AND (distribution_active OR active);


-- ───────────────────────────────────────────────────────────────────────────
-- 3 · fiaon_agent_events — Beweislage für Provisionsstreit
-- ───────────────────────────────────────────────────────────────────────────
--
-- Die Tabelle kannte bisher nur (agent_id, type, meta). Wer von wem bekommen
-- hat und warum, war nicht rekonstruierbar. Genau das braucht die
-- Erstverteilung, die Rotation und jede Eskalation. Additiv, nichts umbenannt.

ALTER TABLE fiaon_agent_events
  ADD COLUMN IF NOT EXISTS from_agent_id INTEGER;

ALTER TABLE fiaon_agent_events
  ADD COLUMN IF NOT EXISTS to_agent_id INTEGER;

-- Klartextgrund, z. B. 'initial_redistribution', 'nachschub', 'rotation',
-- 'eskalation', 'kontoabgleich_batch'.
ALTER TABLE fiaon_agent_events
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- Wer die Änderung ausgelöst hat: 'admin:<id>', 'agent:<id>', 'system:cron'.
ALTER TABLE fiaon_agent_events
  ADD COLUMN IF NOT EXISTS actor TEXT;

CREATE INDEX IF NOT EXISTS fiaon_agent_events_to_agent_idx
  ON fiaon_agent_events (to_agent_id, created_at)
  WHERE to_agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS fiaon_agent_events_reason_idx
  ON fiaon_agent_events (reason, created_at)
  WHERE reason IS NOT NULL;


-- ───────────────────────────────────────────────────────────────────────────
-- 4 · fiaon_settings — Konfiguration
-- ───────────────────────────────────────────────────────────────────────────
--
-- ON CONFLICT DO NOTHING ist hier die richtige Semantik: Wird die Migration
-- erneut ausgeführt, nachdem ein Admin einen Wert im Betrieb angepasst hat,
-- darf sie ihn nicht zurücksetzen.
--
--   kartei_enabled        Die alte Kartei wird stillgelegt. Ihre Routen
--                         antworten danach mit 410 Gone.
--   pool_cap_tier1  30    4 Agenten × 30 = 120 von 146 Tier-1-Personen,
--                         26 bleiben als Reserve für die Nachschub-Automatik.
--   pool_refill_threshold Fällt ein Agent unter 20 offene Tier-1, wird
--                    20    aus der Reserve auf den Cap aufgefüllt.
--   pool_cap_tier2  60    Bei über 1.600 Tier-2-Personen ist der Cap das
--                         wirksame Mittel gegen Horten.

INSERT INTO fiaon_settings (key, value, updated_at) VALUES
  ('kartei_enabled',        'false', NOW()),
  ('pool_cap_tier1',        '30',    NOW()),
  ('pool_refill_threshold', '20',    NOW()),
  ('pool_cap_tier2',        '60',    NOW())
ON CONFLICT (key) DO NOTHING;
