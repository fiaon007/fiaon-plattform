-- ═══════════════════════════════════════════════════════════════════════════
-- 109 · RATGEBER: BEREICH UND TAGESARTIKEL (15.10.2026, E-379)
--
-- Justin: „Die Redaktion erstellt keine Artikel mehr. Es muss jeden Tag 1 neuer
-- Artikel für die Privatkunden-Seite und 1 neuer Artikel für die Business-Kunden
-- live gehen — immer aktuell und PERFEKT passend."
--
--   bereich       'privat' (Seite /ratgeber) oder 'business' (FIAON Global, /business).
--                 Rückfüllung: Kategorie „firmen" ist Business, alles andere privat —
--                 dieselbe Regel wie bereichVonKategorie in shared/fiaon-ratgeber.ts.
--   tagesartikel  Der Berliner Tag, für den die Redaktion den Artikel als Tagesartikel
--                 schreibt. EINDEUTIG je Bereich: Zwei Läufe können denselben Tag nie
--                 doppelt beginnen — die Arbeitszeile entsteht vor der ersten KI-Anfrage.
--   recherche     Das gewählte Thema mit Anlass, Fakten und den Quellen der Websuche.
--   anlass        Warum das Thema gerade jetzt dran ist (für die Redaktion).
--   versuche      KI-Aufrufe an dieser Zeile — der Tagesdeckel (VERSUCHE_JE_TAG).
--   sprache       Lag auf der Produktion schon (Wanderung 083 des Zweigs vom 09.09.,
--                 nie auf main gelangt) — hier nur, wo sie fehlt.
--
-- Additiv und wiederholbar. Dieselben Anweisungen führt der Server beim ersten Gebrauch
-- aus (ensureRatgeberTabelle, server/lib/fiaon-ratgeber-redaktion.ts).
-- ═══════════════════════════════════════════════════════════════════════════
-- Auf einer frischen Datenbank legt sonst erst der Server die Tabelle an — die Wanderung läuft aber VOR ihm.
CREATE TABLE IF NOT EXISTS fiaon_ratgeber (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  titel TEXT NOT NULL,
  untertitel TEXT,
  teaser TEXT NOT NULL DEFAULT '',
  inhalt TEXT NOT NULL DEFAULT '',
  kategorie TEXT NOT NULL DEFAULT 'grundlagen',
  land TEXT NOT NULL DEFAULT 'DE',
  keyword TEXT NOT NULL DEFAULT '',
  schlagworte JSONB NOT NULL DEFAULT '[]'::jsonb,
  faq JSONB NOT NULL DEFAULT '[]'::jsonb,
  meta_titel TEXT NOT NULL DEFAULT '',
  meta_beschreibung TEXT NOT NULL DEFAULT '',
  lesezeit INTEGER NOT NULL DEFAULT 6,
  status TEXT NOT NULL DEFAULT 'entwurf',
  quelle TEXT NOT NULL DEFAULT 'hand',
  modell TEXT,
  pruefung JSONB,
  thema_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ
);
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS sprache TEXT NOT NULL DEFAULT 'de';
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS bereich TEXT NOT NULL DEFAULT 'privat';
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS tagesartikel DATE;
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS recherche JSONB;
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS anlass TEXT;
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS versuche INTEGER NOT NULL DEFAULT 0;

UPDATE fiaon_ratgeber SET bereich = 'business' WHERE kategorie = 'firmen' AND bereich <> 'business';

CREATE UNIQUE INDEX IF NOT EXISTS fiaon_ratgeber_tagesartikel_uq ON fiaon_ratgeber (bereich, tagesartikel) WHERE tagesartikel IS NOT NULL;
CREATE INDEX IF NOT EXISTS fiaon_ratgeber_bereich_idx ON fiaon_ratgeber (bereich, status, published_at DESC);
