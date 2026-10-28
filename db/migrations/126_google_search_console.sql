-- ═══════════════════════════════════════════════════════════════════════════
-- 126 · GOOGLE SEARCH CONSOLE IM CHEFBÜRO (28.10.2026, E-454)
--
-- Justin: „Ja Zugang — die Google-Zahlen landen automatisch im Chefbüro."
-- Der Tageslauf holt einmal am Morgen (Berlin) die Zahlen der Search Console
-- (server/lib/fiaon-search-console.ts) und legt sie hier ab. Das Chefbüro
-- (Besucher › Google) liest NUR von hier — nie direkt bei Google.
--
-- ── DIE ZWEI TABELLEN ─────────────────────────────────────────────────────
--   fiaon_gsc_tage      ein Schnappschuss je Berliner Tag: Summen der letzten
--                       28 Tage und der 28 davor, Verlauf je Tag, Suchanfragen,
--                       Seiten, Länder, Geräte, Sitemaps — oder der Zustand
--                       „zugang_fehlt" / „fehler" mit einem Satz dazu. Ein
--                       Fehlschlag überschreibt nie einen guten Stand desselben
--                       Tages (Bedingung im Upsert).
--   fiaon_gsc_adressen  eine Zeile je Adresse aus der Sitemap mit dem jüngsten
--                       Ergebnis der URL-Prüfung (urlInspection): bei Google
--                       ja/nein, Abdeckung, letzter Crawl. Daraus entstehen
--                       „Neu bei Google" und „Noch nicht bei Google".
--                       Höchstens 150 Prüfungen je Tag (Google erlaubt 2.000).
--
-- Neue Tabellen, sperren nichts Bestehendes. Keine Fremdschlüssel (Hausregel).
-- Dieselbe Datei führt der Server beim ersten Gebrauch aus, falls sie fehlt
-- (ensureGscTabellen). Wiederholbar.
-- ═══════════════════════════════════════════════════════════════════════════
SET lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS fiaon_gsc_tage (
  tag           DATE PRIMARY KEY,
  geholt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  zustand       VARCHAR(20) NOT NULL,
  grund_code    VARCHAR(40),
  grund         TEXT,
  von_hand      BOOLEAN NOT NULL DEFAULT FALSE,
  eigenschaft   TEXT NOT NULL,
  zeitraum      JSONB,
  summen        JSONB,
  verlauf       JSONB,
  anfragen      JSONB,
  seiten        JSONB,
  laender       JSONB,
  geraete       JSONB,
  sitemaps      JSONB,
  pruefung      JSONB
);
CREATE INDEX IF NOT EXISTS fiaon_gsc_tage_geholt ON fiaon_gsc_tage (geholt_am DESC);

CREATE TABLE IF NOT EXISTS fiaon_gsc_adressen (
  adresse           TEXT PRIMARY KEY,
  prio              NUMERIC(3, 2) NOT NULL DEFAULT 0.5,
  in_sitemap        BOOLEAN NOT NULL DEFAULT TRUE,
  zuerst_geprueft   TIMESTAMPTZ,
  zuletzt_geprueft  TIMESTAMPTZ,
  urteil            VARCHAR(30),
  abdeckung         TEXT,
  indexierung       VARCHAR(60),
  abruf             VARCHAR(60),
  robots            VARCHAR(30),
  letzter_crawl     TIMESTAMPTZ,
  kanonisch         TEXT,
  indexiert         BOOLEAN,
  indexiert_seit    TIMESTAMPTZ,
  neu_beobachtet    BOOLEAN NOT NULL DEFAULT FALSE,
  fehler            TEXT,
  pruef_link        TEXT
);
CREATE INDEX IF NOT EXISTS fiaon_gsc_adressen_geprueft ON fiaon_gsc_adressen (zuletzt_geprueft);
