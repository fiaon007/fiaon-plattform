-- ═══════════════════════════════════════════════════════════════════════════
-- 123 · STATIONEN DES GLOBAL-FAHRPLANS (22.10.2026, Stationen-Editor)
-- Der Server macht dasselbe beim ersten Gebrauch (server/lib/fiaon-global-mandat.ts, ensureGlobalMandat).
--   · fiaon_global_schritte: Status „beantragt“ zusätzlich erlaubt (die Wand wird WEITER, nicht enger —
--     jede bestehende Zeile bleibt gültig) und das Datum des Antrags (beantragt_am).
--   · fiaon_global_kapital: inhaber = 'firma' | 'privat' (je Karte: Firmenkarte oder private Karte).
-- Die Werte der Stationen (EIN, ITIN verschlüsselt, D-U-N-S, Telefon, Adressen, Konto) stehen in
-- fiaon_global_auftraege.gesellschaft_plus (JSONB) — dafür braucht es keine Spalte.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE fiaon_global_schritte ADD COLUMN IF NOT EXISTS beantragt_am DATE;
ALTER TABLE fiaon_global_schritte
  DROP CONSTRAINT IF EXISTS fiaon_global_schritte_status_check,
  ADD CONSTRAINT fiaon_global_schritte_status_check CHECK (status IN ('offen', 'in_arbeit', 'beantragt', 'erledigt', 'entfaellt')) NOT VALID;
ALTER TABLE fiaon_global_kapital ADD COLUMN IF NOT EXISTS inhaber TEXT;
