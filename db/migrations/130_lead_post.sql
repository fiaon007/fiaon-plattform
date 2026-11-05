-- 130 — FIAON Global: Lead-Mails aus einem Guss (E-476 Scheibe 4, 05.11.2026) — Willkommen sofort (auch nachts), Nachfass
-- N1–N3 (+1/+3/+7 Werktage, Mo–Fr 9–18 Uhr), Antworten in js@ landen richtig, Privatkunden-Weiche.
-- Laufzeit-Gegenstück: leadPostSchema in server/lib/fiaon-global-lead-post.ts (gleiche Anweisungen, idempotent).
-- Sie läuft im Lauf lead_post, im Lead-Motor und im Cockpit — NIE im Eingang (globalAnfrageAnnehmen, Meta-Einspielen,
-- Buchung). Die Spalten hängen an fiaon_lead_weg (eine Zeile je Global-Anfrage, Migration 129), nicht an fiaon_anfragen.
--
-- fiaon_lead_weg (neu):
--   willkommen_*   die Willkommens-Mail aus js@ (Justins echte Unterschrift): wann, Stand, Grund, Versuche, Anspruch
--   gmail_faden    der Faden in js@ — Nachfass und Antworten hängen daran
--   gmail_erste_id die Gmail-Kennung der Willkommens-Mail (N1–N3 antworten darauf)
--   nachfass_*     Stufe (0–3), wann zuletzt, wann fällig, Anspruch
--   stopp_*        warum keine Lead-Mail mehr kommt (termin, antwort, abgemeldet, unzustellbar, ergebnis, kunde, …)
--   abgemeldet_am  „keine Mails“ — nie wieder eine Lead-Mail an diese Anfrage
-- fiaon_lead_post: jede Lead-Mail (aus) und jede gelesene Antwort/jeder Rückläufer (ein) — EINMAL je Gmail-Nachricht.
ALTER TABLE fiaon_lead_weg
  ADD COLUMN IF NOT EXISTS willkommen_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS willkommen_status TEXT,
  ADD COLUMN IF NOT EXISTS willkommen_grund TEXT,
  ADD COLUMN IF NOT EXISTS willkommen_versuche INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS willkommen_laeuft TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gmail_faden TEXT,
  ADD COLUMN IF NOT EXISTS gmail_erste_id TEXT,
  ADD COLUMN IF NOT EXISTS nachfass_stufe INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nachfass_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nachfass_faellig TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS nachfass_laeuft TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stopp_am TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stopp_grund TEXT,
  ADD COLUMN IF NOT EXISTS abgemeldet_am TIMESTAMPTZ,
  -- Nachbesserung (Gutachten Lead-Sicht, Mangel 5): N1 wurde einmal um einen Werktag geschoben (angekündigter Anruf fehlte)
  ADD COLUMN IF NOT EXISTS nachfass_verschoben_am TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS fiaon_lead_weg_nachfass_idx ON fiaon_lead_weg (nachfass_faellig) WHERE nachfass_faellig IS NOT NULL AND stopp_am IS NULL;
CREATE INDEX IF NOT EXISTS fiaon_lead_weg_faden_idx ON fiaon_lead_weg (gmail_faden) WHERE gmail_faden IS NOT NULL;

CREATE TABLE IF NOT EXISTS fiaon_lead_post (
  id BIGSERIAL PRIMARY KEY,
  anfrage_id INTEGER NOT NULL,
  -- aus = unsere Lead-Mail · ein = Antwort, Rückläufer, Abmeldung
  richtung TEXT NOT NULL,
  -- willkommen | n1 | n2 | n3 | antwort | abmeldung | absage | ruecklaeufer | von_hand | automatisch
  art TEXT NOT NULL,
  gmail_id TEXT UNIQUE,
  thread_id TEXT,
  betreff TEXT,
  auszug TEXT,
  am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_lead_post_anfrage_idx ON fiaon_lead_post (anfrage_id, am DESC);
