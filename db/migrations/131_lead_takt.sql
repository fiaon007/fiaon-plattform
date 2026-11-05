-- 131 — FIAON Global: Ein Stand je Lead, Daniels Takt (Lead-Meldung, Erinnerung 15/60/120), Übersicht 18:30, Wächter
-- (E-476 Scheibe 5, 05.11.2026 — Entscheidung 3A: Daniels Lead-Meldungen an seine Firmenadresse, nie an ein privates Postfach).
-- Laufzeit-Gegenstück: leadTaktSchema in server/lib/fiaon-lead-takt.ts (gleiche Anweisungen, idempotent). Sie läuft im Lauf
-- lead_takt, im Lead-Motor und im Cockpit — NIE im Eingang (globalAnfrageAnnehmen, Meta-Einspielen, Buchung).
--
-- fiaon_lead_takt: EINE Zeile je Global-Anfrage ab dem Zählbeginn (lead_takt_ab) —
--   t1_*          die Lead-Meldung an die Adresse „Lead-Meldungen an“ (Chefbüro › Rückholung › FIAON Global): wann, an
--                 wen, Brevo-Kennung (die Erinnerung hängt im selben Faden), Stand, Grund, Versuche, Anspruch
--   geoeffnet_*   die Firma wurde im Cockpit geöffnet (zählt als Reaktion wie ein geöffneter Auftrag)
--   e15/e60/e120  die Erinnerungsleiter: Daniel nach 15 Dienstminuten, Justin nach 60, Zusage-Wächter nach 120 — je einmal
--   vertretung_*  der Rückruf als Aufgabe an die Vertretung (global_vertretung_agent_id) — einmal
--   abgesagt_am   schriftlich abgesagt („kein Interesse“, Nachbesserung 05.11.) — die Erinnerungsleiter schweigt
-- Einstellungen (fiaon_settings, keine Spalten): global_lead_meldung_an, lead_meldung_an, lead_takt_an, lead_takt_ab,
-- lead_uebersicht_an, lead_uebersicht_tag, meta_webhook_still_seit.
CREATE TABLE IF NOT EXISTS fiaon_lead_takt (
  anfrage_id INTEGER PRIMARY KEY,
  firma_id INTEGER,
  eingang_am TIMESTAMPTZ NOT NULL,
  t1_am TIMESTAMPTZ,
  t1_an TEXT,
  t1_id TEXT,
  t1_betreff TEXT,
  -- gesendet | fehler | nicht_noetig | laeuft
  t1_status TEXT,
  t1_grund TEXT,
  t1_versuche INTEGER NOT NULL DEFAULT 0,
  t1_laeuft TIMESTAMPTZ,
  geoeffnet_am TIMESTAMPTZ,
  geoeffnet_von TEXT,
  e15_am TIMESTAMPTZ,
  e60_am TIMESTAMPTZ,
  e120_am TIMESTAMPTZ,
  vertretung_am TIMESTAMPTZ,
  vertretung_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_lead_takt_firma_idx ON fiaon_lead_takt (firma_id) WHERE firma_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiaon_lead_takt_eingang_idx ON fiaon_lead_takt (eingang_am);
ALTER TABLE fiaon_lead_takt ADD COLUMN IF NOT EXISTS abgesagt_am TIMESTAMPTZ;

-- Nachbesserung 05.11.2026 (Gutachten Technik, Mangel 3): der Zählbeginn der Lead-Meldungen steht mit dem Deploy fest — sonst
-- setzte ihn der erste Eingang selbst (NACH seinem Eingang) und galt als Altbestand. Steht er schon, bleibt er.
INSERT INTO fiaon_settings (key, value, updated_at)
VALUES ('lead_takt_ab', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), NOW())
ON CONFLICT (key) DO NOTHING;
