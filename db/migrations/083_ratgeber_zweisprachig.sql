-- ============================================================================
-- Ratgeber zweisprachig (E-100, 09.09.2026)
-- ============================================================================
-- Bis hierher kannte der Ratgeber keine Sprachen: kein Feld, eine Route
-- /ratgeber/:slug, kein hreflang. Englische Artikel brauchen beides —
-- eine Sprachangabe und die Verbindung zur Schwesterfassung.
--
-- Additiv und idempotent. Bestehende 62 Artikel bekommen 'de'; nichts wird
-- ueberschrieben, nichts geloescht.
-- ============================================================================

ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS sprache TEXT NOT NULL DEFAULT 'de';
ALTER TABLE fiaon_ratgeber ADD COLUMN IF NOT EXISTS schwester_slug TEXT;

-- Ein Artikel zeigt auf hoechstens eine Schwester, und zwei Artikel duerfen
-- nicht dieselbe Schwester beanspruchen.
CREATE UNIQUE INDEX IF NOT EXISTS fiaon_ratgeber_schwester_idx
  ON fiaon_ratgeber (schwester_slug) WHERE schwester_slug IS NOT NULL;

-- Der Ratgeber-Index und die Sitemap filtern nach Sprache.
CREATE INDEX IF NOT EXISTS fiaon_ratgeber_sprache_status_idx
  ON fiaon_ratgeber (sprache, status);

COMMENT ON COLUMN fiaon_ratgeber.sprache IS 'de | en — bestimmt Route (/ratgeber/:slug oder /en/guide/:slug) und hreflang';
COMMENT ON COLUMN fiaon_ratgeber.schwester_slug IS 'Slug der Fassung in der anderen Sprache; beide Seiten zeigen aufeinander';
