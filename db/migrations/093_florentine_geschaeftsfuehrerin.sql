-- ═══════════════════════════════════════════════════════════════════════════
-- FLORENTINE LOMBARDI: GESCHÄFTSFÜHRERIN — 06.10.2026 (E-290)
--
-- Justin: „Florentine ist ab nächster Woche Geschäftsführerin, also das ändern bitte
-- überall (außer auf den alten Posts, aber auch auf Website und so!)“.
-- admin_titel ist reine Anzeige im Kopf des Chefbüros (fiaon-chef-zugang.ts); es gibt
-- dafür keinen Knopf — darum hier, eng gefasst: nur dieses Konto und nur der alte Wortlaut.
-- Das Impressum („Vertretungsberechtigt / Director“) folgt erst mit der Eintragung bei
-- Companies House (AP01) — nicht hier.
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE fiaon_agents
   SET admin_titel = 'Geschäftsführerin'
 WHERE name = 'Florentine Lombardi'
   AND admin_titel = 'Künftige Geschäftsführung';
