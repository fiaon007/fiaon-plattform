-- ═══════════════════════════════════════════════════════════════════════════
-- Welche Bestellungen hat der alte Dubletten-Fehler fälschlich stillgelegt?
--
-- `supersedeSisterOrders` legte bis zum Kategorie-Fix JEDE offene Bestellung
-- derselben E-Mail still, sobald irgendetwas bezahlt wurde. Es traf beide
-- Richtungen: eine Bonitätszahlung von 74 € tötete eine Ultra-Bestellung zu
-- 79,99 € genauso wie umgekehrt.
--
-- Entscheidend ist die KATEGORIE, nicht der Produktname:
--   Stufenpaket   Starter/Pro/Ultra/High End/Business — ein Konto hat genau
--                 eine Stufe, ein Upgrade beendet die alte Bestellung zu Recht.
--   Zusatzprodukt Bonitätsauskunft (`type='schufa'`) — unabhängig vom Konto.
--
-- Warum nicht `pack_name`: derselbe Tarif existiert im Bestand unter zwei
-- Schreibweisen („FIAON Pro“ und „FIAON Pro | (Standard)“). Ein Namensvergleich
-- würde echte Dubletten übersehen.
--
-- Klassifikation aus der Kategorie der AUSLÖSENDEN Bestellung:
--   andere_kategorie   Zusatzprodukt gegen Stufenpaket → Stilllegung war falsch
--   phantom            `superseded_by` zeigt ins Leere → nicht nachvollziehbar
--   gleiche_kategorie  Dublette oder Stufen-Upgrade    → Stilllegung war richtig
--
-- `reaktivierbar` verlangt ZWEI Bedingungen: Die Stilllegung war falsch UND dem
-- Kunden fehlt dieses Produkt tatsächlich noch. Wer seine Bonitätsauskunft
-- inzwischen bezahlt hat, braucht die alte Zeile nicht zurück — das wäre eine
-- Doppelbestellung samt Mahnlauf.
--
-- Verschmolzene Datensätze (`merged_into IS NOT NULL`) bleiben aussen vor: sie
-- leben in einem anderen Datensatz weiter und dürfen nicht reaktiviert werden.
--
-- Aufruf:
--   psql "$DATABASE_URL" --csv -o reports/superseded_falsch.csv \
--        -f scripts/sql/superseded-falsch.sql
-- ═══════════════════════════════════════════════════════════════════════════

WITH stillgelegt AS (
  SELECT a.*,
         t.ref       AS ausl_ref,
         t.pack_name AS ausl_pack,
         (COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%') AS ist_zusatz,
         CASE
           WHEN t.ref IS NULL THEN 'phantom'
           WHEN (COALESCE(t.type, '') = 'schufa' OR t.ref LIKE 'FIAON-SCHUFA-%')
              = (COALESCE(a.type, '') = 'schufa' OR a.ref LIKE 'FIAON-SCHUFA-%')
             THEN 'gleiche_kategorie'
           ELSE 'andere_kategorie'
         END AS klass
  FROM fiaon_applications a
  -- Der Zeiger wurde historisch teils als payment_reference, teils als ref
  -- gespeichert — beide Varianten müssen auflösen.
  LEFT JOIN fiaon_applications t
    ON (t.payment_reference = a.superseded_by OR t.ref = a.superseded_by)
  WHERE a.payment_status = 'superseded'
    AND a.merged_into IS NULL
)
SELECT
  s.klass AS klassifikation,
  CASE WHEN s.ist_zusatz THEN 'Zusatzprodukt' ELSE 'Stufenpaket' END AS kategorie,
  CASE
    WHEN s.klass IN ('andere_kategorie', 'phantom') AND NOT EXISTS (
      SELECT 1 FROM fiaon_applications p
      WHERE p.merged_into IS NULL AND p.payment_status = 'paid' AND p.ref <> s.ref
        AND (COALESCE(p.type, '') = 'schufa' OR p.ref LIKE 'FIAON-SCHUFA-%') = s.ist_zusatz
        AND ((s.email IS NOT NULL AND s.email <> ''
              AND LOWER(TRIM(p.email)) = LOWER(TRIM(s.email)))
             OR (s.person_id IS NOT NULL AND p.person_id = s.person_id))
    ) THEN 'ja' ELSE 'nein'
  END AS reaktivierbar,
  s.ref,
  s.payment_reference AS zahlungsreferenz,
  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', s.first_name, s.last_name)), ''), s.contact_name) AS kundenname,
  s.email,
  s.person_id,
  REPLACE(COALESCE(s.pack_name, ''), E'\n', ' ') AS produkt,
  s.amount_due AS betrag_eur,
  TO_CHAR(s.created_at, 'YYYY-MM-DD') AS bestellt_am,
  s.superseded_by AS zeiger_superseded_by,
  s.ausl_ref AS ausloeser_ref,
  REPLACE(COALESCE(s.ausl_pack, ''), E'\n', ' ') AS ausloeser_produkt,
  -- Was der Kunde tatsächlich bezahlt hat: macht sofort sichtbar, ob ihm ein
  -- bezahltes Produkt fehlt oder ob er nie etwas für diese Zeile überwies.
  COALESCE((
    SELECT STRING_AGG(REPLACE(p.pack_name, E'\n', ' ') || ' (' || p.amount_due || ' EUR)', ' | '
                      ORDER BY p.created_at)
    FROM fiaon_applications p
    WHERE p.merged_into IS NULL
      AND p.payment_status = 'paid'
      AND p.ref <> s.ref
      AND ((s.email IS NOT NULL AND s.email <> ''
            AND LOWER(TRIM(p.email)) = LOWER(TRIM(s.email)))
           OR (s.person_id IS NOT NULL AND p.person_id = s.person_id))
  ), '') AS bezahlte_produkte
FROM stillgelegt s
ORDER BY s.klass, s.created_at;
