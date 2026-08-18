-- ═══════════════════════════════════════════════════════════════════════════
-- DIE KONTAKT-SPALTEN SICHERN — VOR DEM DROP, ABER NICHT MIT IHM
--
-- ── WAS HIER PASSIERT ──────────────────────────────────────────────────────
-- Die Spalten `contact_email`, `billing_email`, `contact_phone` und
-- `phone_country_code` an `fiaon_applications` sowie `email`/`telefon` an
-- `fiaon_leads` sind seit Migration 059 Abschriften: Ein Trigger schreibt jeden
-- Wert an die Person durch. Sie sollen verschwinden.
--
-- Diese Migration sichert ihren Inhalt in Archiv-Tabellen. Sie DROPPT NICHTS.
--
-- ── WARUM DER DROP HIER NICHT DRINSTEHT ────────────────────────────────────
-- GEMESSEN am 28.08.2026: **397 Zugriffe in 62 Dateien** lesen oder schreiben
-- diese Spalten, davon **16 schreibende Anweisungen**.
--
-- Ein DROP vor dem Umzug bricht die Plattform beim ersten Kundenkontakt — und
-- zwar nicht sichtbar beim Deploy, sondern erst, wenn jemand einen Antrag
-- abschickt. 6.736 Bestellungen und 4.684 Personen hängen daran.
--
-- Ein HALBER Umzug ist dabei der schlechteste Zustand: Die umgezogenen Stellen
-- schreiben an die Person, die anderen in die Spalte, und niemand weiß mehr,
-- welcher Wert gilt. Genau diese Lage hat Migration 059 beendet.
--
-- ── DIE REIHENFOLGE ────────────────────────────────────────────────────────
--   1. Diese Migration: Archiv anlegen und füllen (idempotent, jederzeit)
--   2. Die 16 schreibenden Stellen auf die Personen-Funktionen umziehen
--   3. Die 397 lesenden Stellen nachziehen
--   4. `scripts/pruef-eine-quelle-wand.ts` zeigt 0 — erst DANN der DROP
--
-- Schritt 4 ist die Bedingung, nicht der Wunsch. Solange die Wand eine Zahl
-- über 0 nennt, bleibt der DROP aus.
--
-- ── UND WARUM ARCHIVIEREN, WENN DER TRIGGER DIE WERTE SCHON DURCHSCHREIBT ──
-- Weil der Trigger erst seit dem 20.08.2026 läuft. Werte, die VORHER
-- abwichen und danach nicht mehr angefasst wurden, stehen nur in der Spalte.
-- Gemessen wurden damals 89 Bestellungen mit abweichender Nummer und 99 mit
-- abweichender Adresse. Ein DROP ohne Archiv wäre für die ein Hard-Delete —
-- und Hard-Deletes gibt es in diesem Haus nicht.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── DAS ARCHIV FÜR fiaon_applications ────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiaon_applications_kontakt_archiv (
  ref                 TEXT PRIMARY KEY,
  person_id           INTEGER,
  email               TEXT,
  phone               TEXT,
  contact_email       TEXT,
  billing_email       TEXT,
  contact_phone       TEXT,
  phone_country_code  TEXT,
  -- Wann gesichert. Bei einem zweiten Lauf wird der Stand aktualisiert, und
  -- diese Zeit sagt, von wann er ist.
  gesichert_am        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiaon_applications_kontakt_archiv IS
  'Die Kontakt-Abschriften aus fiaon_applications, gesichert vor dem geplanten DROP. '
  'Die gueltigen Werte stehen an fiaon_persons; dieses Archiv ist fuer den Fall, '
  'dass ein Wert VOR dem Trigger (20.08.2026) abwich und danach nie angefasst wurde.';

-- ── DAS ARCHIV FÜR fiaon_leads ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fiaon_leads_kontakt_archiv (
  id            INTEGER PRIMARY KEY,
  person_id     INTEGER,
  email         TEXT,
  telefon       TEXT,
  gesichert_am  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE fiaon_leads_kontakt_archiv IS
  'Die Kontakt-Abschriften aus fiaon_leads, gesichert vor dem geplanten DROP.';

-- ── FÜLLEN, IDEMPOTENT ───────────────────────────────────────────────────
-- `ON CONFLICT … DO UPDATE`: Ein zweiter Lauf frischt den Stand auf, statt zu
-- scheitern. Migrationen in diesem Repo laufen bei jedem Deploy.
INSERT INTO fiaon_applications_kontakt_archiv
  (ref, person_id, email, phone, contact_email, billing_email, contact_phone,
   phone_country_code, gesichert_am)
SELECT ref, person_id, email, phone, contact_email, billing_email, contact_phone,
       phone_country_code, NOW()
FROM fiaon_applications
-- Nur Zeilen mit irgendeinem Kontaktwert. Leere zu sichern kostet Platz und
-- sagt nichts.
WHERE COALESCE(email, phone, contact_email, billing_email, contact_phone,
               phone_country_code) IS NOT NULL
ON CONFLICT (ref) DO UPDATE SET
  person_id          = EXCLUDED.person_id,
  email              = EXCLUDED.email,
  phone              = EXCLUDED.phone,
  contact_email      = EXCLUDED.contact_email,
  billing_email      = EXCLUDED.billing_email,
  contact_phone      = EXCLUDED.contact_phone,
  phone_country_code = EXCLUDED.phone_country_code,
  gesichert_am       = NOW();

INSERT INTO fiaon_leads_kontakt_archiv (id, person_id, email, telefon, gesichert_am)
SELECT id, person_id, email, telefon, NOW()
FROM fiaon_leads
WHERE COALESCE(email, telefon) IS NOT NULL
ON CONFLICT (id) DO UPDATE SET
  person_id    = EXCLUDED.person_id,
  email        = EXCLUDED.email,
  telefon      = EXCLUDED.telefon,
  gesichert_am = NOW();

-- ═══════════════════════════════════════════════════════════════════════════
-- HIER STÜNDE DER DROP — UND ER STEHT ABSICHTLICH NICHT HIER
--
--   ALTER TABLE fiaon_applications
--     DROP COLUMN contact_email,
--     DROP COLUMN billing_email,
--     DROP COLUMN contact_phone,
--     DROP COLUMN phone_country_code;
--
-- Bedingung: `npx tsx scripts/pruef-eine-quelle-wand.ts` meldet 0 Zugriffe.
-- Heute meldet er 16 schreibende und knapp 400 lesende. Wer den DROP vorher
-- ausführt, bricht die Antragsstrecke — und zwar erst beim nächsten Kunden,
-- nicht beim Deploy.
--
-- Die Zeilen oben sind KEIN Kommentar aus Bequemlichkeit: Sie sind die
-- Anweisung, die einzufügen ist, wenn die Bedingung erfüllt ist. Dann wird aus
-- diesem Block eine Migration 062 — nicht diese hier geändert, denn eine
-- gelaufene Migration wird nicht angefasst.
-- ═══════════════════════════════════════════════════════════════════════════
