-- ═══════════════════════════════════════════════════════════════════════════
-- 081 · Kundenbereich /app — Vollmachten und Vorgangs-Ereignisse (05.09.2026)
--
-- Scheibe 5 (Bauvorlage 3.5, 3.6, 3.14): Der Kunde erklärt, FIAON bereitet vor
-- und übermittelt, ein Mensch versendet und quittiert. Dafür braucht es zwei
-- neue Tische neben denen aus 080 (fiaon_vorgaenge, fiaon_dokumente,
-- fiaon_ansprueche, fiaon_anspruch_antworten):
--
--   · fiaon_vollmachten        — „Vollmacht zur Übermittlung“, vom Kunden mit dem
--                                Finger unterschrieben; Nachweis = Zeitpunkt, IP,
--                                Browserkennung, Hash über Text + Unterschrift;
--                                zwölf Monate gültig, jederzeit widerruflich
--   · fiaon_vorgang_ereignisse — die Zeitleiste eines Vorgangs; `text` ist intern,
--                                `text_fuer_kunden` liest der Kunde
--
-- KEIN ALTER an den Tabellen aus 080 (Hausregel). Idempotent (IF NOT EXISTS).
-- Dieselbe DDL steht in server/routes/fiaon-app-antraege.ts
-- (ensureAntraegeTabellen) und läuft beim ersten Aufruf nach dem Deploy.
-- ═══════════════════════════════════════════════════════════════════════════

-- Eine Zeile je erteilter Vollmacht. Aktiv = status 'unterschrieben', widerrufen_am
-- IS NULL, gueltig_bis >= heute (Berliner Datum, im Server gerechnet — nicht
-- CURRENT_DATE des DB-Servers). Eine neue Vollmacht ersetzt eine ältere aktive
-- (die ältere bekommt status 'widerrufen' + widerrufen_am). 'abgelaufen' wird
-- nie geschrieben, sondern gerechnet (unterschrieben, nicht widerrufen, gueltig_bis
-- vorbei). gueltig_bis = Unterschriftstag + 12 Monate, dieselbe Rechnung wie im
-- Vollmachttext (datumPlusMonate: 29.02. → 28.02.). Jede neue Zeile und jeder
-- Widerruf entwertet ältere Unterschriftslinks der Person (created_at/widerrufen_am
-- > Ausstellung des Links).
CREATE TABLE IF NOT EXISTS fiaon_vollmachten (
  id                BIGSERIAL PRIMARY KEY,
  person_id         BIGINT NOT NULL,
  ref               TEXT,
  template_version  INTEGER NOT NULL DEFAULT 1,
  -- Antragsarten, für die die Vollmacht gilt: ["p_konto","rundfunk",…]
  umfang            JSONB NOT NULL DEFAULT '[]'::jsonb,
  rendered_html     TEXT NOT NULL,
  -- data:image/png;base64,… (höchstens 400 KB, geprüft im Server)
  signature_png     TEXT,
  signature_name    TEXT,
  signed_at         TIMESTAMPTZ,
  ip                TEXT,
  user_agent        TEXT,
  doc_hash          TEXT,
  pdf_dokument_id   BIGINT,
  gueltig_bis       DATE,
  widerrufen_am     TIMESTAMPTZ,
  status            TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen','unterschrieben','widerrufen','abgelaufen')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_vollmachten_person_idx ON fiaon_vollmachten (person_id, status);

-- Die Zeitleiste eines Vorgangs — jeder Schritt mit Zeitpunkt.
CREATE TABLE IF NOT EXISTS fiaon_vorgang_ereignisse (
  id                BIGSERIAL PRIMARY KEY,
  vorgang_id        BIGINT NOT NULL,
  person_id         BIGINT NOT NULL,
  art               TEXT NOT NULL CHECK (art IN ('befund','entwurf','vollmacht','unterschrift_offen','unterschrieben','versandt','erinnert','nachfrage','antwort_da','bewilligt','abgelehnt','zurueckgezogen','eskaliert','notiz')),
  -- intern (Mitarbeiter, Chefbüro)
  text              TEXT,
  -- das, was der Kunde in seiner Zeitleiste liest (Sie-Form, Wortwand geprüft)
  text_fuer_kunden  TEXT,
  agent_id          BIGINT,
  am                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS fiaon_vorgang_ereignisse_vorgang_idx ON fiaon_vorgang_ereignisse (vorgang_id, am);
