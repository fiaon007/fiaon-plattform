-- ═══════════════════════════════════════════════════════════════════════════
-- DIE WHATSAPP-BREMSE — 29.09.2026 (E-261)
--
-- Am 28.09. scheiterten 89 Vorlagen bei Meta mit „(#131042) Business eligibility
-- payment issue" (Meta konnte nicht abbuchen) — der Fehler kommt asynchron im
-- Status-Webhook, niemand hielt an, und fiaon_wa_aktion.ok blieb TRUE.
--
--   · fiaon_wa_kontofehler: jede Fehlermeldung von Meta (Webhook und Senden) —
--     die Bremse zählt hier „2 gleiche Kontofehler in 60 Minuten" bzw. pausiert
--     bei einer Kontosperre sofort (server/lib/fiaon-wa-bremse.ts). Dieselbe
--     wa_id zählt je Code nur einmal (Meta wiederholt Webhooks). gesendet_am =
--     wann die Nachricht an Meta ging: Meldungen zu Sendungen von VOR dem letzten
--     „wieder aktivieren" stehen hier, zählen aber nicht.
--   · fiaon_wa_aktion.fehler_code / fehler_am: Die Zeile folgt dem Webhook
--     (ok = FALSE bei „failed"), dazu der Index über wa_id für diesen Nachzug.
--
-- Nur additiv, wiederholbar (IF NOT EXISTS). Tabellen klein (fiaon_wa_aktion
-- ≈ 900 Zeilen) — die Sperren dauern Millisekunden. Die Einstellungen
-- wa_pause und wa_meta_stand (fiaon_settings) brauchen keine Tabellenänderung.
-- Dieselben Anweisungen legt der Server auf einer frischen Datenbank selbst an
-- (zentraleSchema in fiaon-wa-zentrale.ts, kontofehlerTabelle in fiaon-wa-bremse.ts).
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS fiaon_wa_kontofehler (
  id BIGSERIAL PRIMARY KEY,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  code INTEGER NOT NULL,
  art TEXT NOT NULL,              -- zahlung | gesperrt | zugang | spam | nummer | empfaenger | vorlage | voruebergehend | sonst
  quelle TEXT NOT NULL,           -- webhook | senden
  wa_id TEXT, nummer TEXT, person_id INTEGER, vorlage TEXT,
  text TEXT,
  gesendet_am TIMESTAMPTZ         -- Sendezeit der Nachricht (Webhook), NULL beim synchronen Fehler
);
ALTER TABLE fiaon_wa_kontofehler ADD COLUMN IF NOT EXISTS gesendet_am TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS fiaon_wa_kontofehler_code_am ON fiaon_wa_kontofehler (code, am DESC);
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_wa_kontofehler_wa_code ON fiaon_wa_kontofehler (wa_id, code) WHERE wa_id IS NOT NULL;

DO $$
BEGIN
  IF to_regclass('public.fiaon_wa_aktion') IS NOT NULL THEN
    ALTER TABLE fiaon_wa_aktion ADD COLUMN IF NOT EXISTS fehler_code INTEGER;
    ALTER TABLE fiaon_wa_aktion ADD COLUMN IF NOT EXISTS fehler_am TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS fiaon_wa_aktion_wa_idx ON fiaon_wa_aktion (wa_id) WHERE wa_id IS NOT NULL;
  END IF;
END $$;
