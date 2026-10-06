-- ═══════════════════════════════════════════════════════════════════════════
-- ALLE SOCIAL-POSTS FREIGEGEBEN UND AUF DER WEBSITE — 06.10.2026 (E-296)
--
-- Justin im Chat, 06.10.2026: „ja alle genehmigen, mach es fix und fertig“ — auf die Frage,
-- ob die 22 Posts des Social-Studios (Launch + Woche 1) freigegeben und auf der Website
-- gezeigt werden sollen. Claude hat keinen Chef-Zugang; darum hier dieselben Schritte wie die
-- Studio-Aktionen „freigeben“ und „website“ (server/lib/fiaon-social.ts), je Post mit Verlauf.
--
-- Eng gefasst:
--  · Freigabe nur aus „zur_freigabe“ und nur bei grünem Wort-Check („gruen“ oder
--    „gruen_mit_ausnahmen“) — kein Rot, kein „trotzdem“ (am 06.10. waren alle 21 offenen grün).
--  · Website-Schalter (vorgemerkt) nur für freigegebene Posts mit Instagram als Kanal, mit Bild
--    oder Titelbild und ohne roten Wort-Check. GEZEIGT wird ein Post erst, wenn er im Studio auf
--    Instagram als veröffentlicht gemeldet ist (mit Link), und nie vor seinem Plantag (Regel im
--    Feed, shared/fiaon-sozial-feed.ts; Prüfung 06.10.2026: kein Beitrag im Instagram-Handy, der
--    nicht wirklich auf Instagram steht).
--  · Läuft genau einmal (schema_migrations); spätere Posts gibt Justin im Studio frei.
-- ═══════════════════════════════════════════════════════════════════════════

WITH frei AS (
  UPDATE fiaon_social_posts
     SET status = 'freigegeben', version = version + 1,
         freigegeben_von = 'Inhaber', freigegeben_von_agent = NULL, freigegeben_am = NOW(),
         freigabe_grund = NULL, freigabe_trotz_rot = FALSE, updated_at = NOW()
   WHERE status = 'zur_freigabe'
     AND COALESCE(wortcheck->>'ergebnis', '') IN ('gruen', 'gruen_mit_ausnahmen')
  RETURNING id, version, fassung, wortcheck->>'ergebnis' AS wc
)
INSERT INTO fiaon_social_verlauf (post_id, version, fassung, art, von_agent_id, von, vorher, nachher, grund)
SELECT id, version, fassung, 'freigegeben', NULL, 'inhaber (Inhaber)',
       jsonb_build_object('status', 'zur_freigabe', 'wortcheck', wc),
       jsonb_build_object('status', 'freigegeben'),
       'Justin im Chat 06.10.2026: „ja alle genehmigen, mach es fix und fertig“ (eingespielt mit Migration 095)'
  FROM frei;

WITH web AS (
  UPDATE fiaon_social_posts p
     SET website_sichtbar = TRUE, version = version + 1, updated_at = NOW()
   WHERE p.status IN ('freigegeben', 'eingeplant', 'veroeffentlicht', 'ausgewertet')
     AND p.website_sichtbar = FALSE
     AND COALESCE(p.wortcheck->>'ergebnis', '') <> 'rot'
     AND 'instagram' = ANY(p.kanaele)
     AND EXISTS (
       SELECT 1 FROM fiaon_social_dateien d
        WHERE d.post_id = p.id AND d.geloescht_am IS NULL
          AND d.rolle IN ('bild', 'cover') AND d.mime LIKE 'image/%'
     )
  RETURNING p.id, p.version, p.fassung, p.plan_datum
)
INSERT INTO fiaon_social_verlauf (post_id, version, fassung, art, von_agent_id, von, vorher, nachher, grund)
SELECT id, version, fassung, 'website', NULL, 'inhaber (Inhaber)',
       jsonb_build_object('website_sichtbar', false),
       jsonb_build_object('website_sichtbar', true, 'ab', plan_datum::text),
       'Justin im Chat 06.10.2026: „ja alle genehmigen, mach es fix und fertig“ (eingespielt mit Migration 095)'
  FROM web;
