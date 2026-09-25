-- ═══════════════════════════════════════════════════════════════════════════
-- utm-Bereinigung (E-242, 25.09.2026) — Klartext-Passwörter raus aus
-- fiaon_applications.utm, danach nur noch die Erlaubnisliste als Objekt.
--
-- Befund (Produktion, nur lesend gezählt am 25.09.2026; Zahlen im internen
-- Register E-242): utm liegt überwiegend als JSON-Text oder Array vor, kaum als
-- Objekt. Einziger Schlüssel in allen Schichten: „password".
--   Entstanden durch 8518e421 (16.04., JSON.stringify(...)::jsonb → Text),
--   00fb0137 (29.07., „utm || …" auf Text → Array) und c616ee18 (09.08.).
--   E-152 (06.09.) beendete das Schreiben, putzte aber nur echte Objekte.
--
-- Was dieses Skript tut:
--   1. Jede utm-Zeile in ALLEN Schichten lesen (Objekt, JSON-Text, Array aus
--      Texten/Objekten), nur die erlaubten Schlüssel behalten, als Objekt
--      zurückschreiben ({} wenn nichts Erlaubtes da ist — so bleibt die
--      Dubletten-Wertung „utm gesetzt" in fiaon-antrag.ts unverändert).
--   2. Protokoll in fiaon_utm_bereinigung_protokoll: Zeile, alte Form,
--      Schlüsselnamen, Zahl der Passwort-Einträge — NIE Werte.
--   3. Prüfen, dass nichts übrig ist (sonst ROLLBACK).
--   4. CHECK fiaon_applications_utm_erlaubt: ab jetzt verweigert die
--      Datenbank jede andere Form und jeden fremden Schlüssel.
--   updated_at bleibt unberührt (kein Trigger auf utm, geprüft 25.09.).
--
-- Aufruf (psql 18, aus dem Arbeitsbaum):
--   Vorschau, nur lesend (Produktion erlaubt):
--     psql "$DATABASE_URL_EXTERN" -X -v vorschau=1 -f scripts/sql/utm-bereinigung.sql
--   Probelauf, alles und dann ROLLBACK (lokale Struktur-Kopie):
--     psql "<lokal>" -X -f scripts/sql/utm-bereinigung.sql
--   Ausführen — NUR mit Justins ausdrücklichem Go, Render-Sicherung vorher:
--     psql "$DATABASE_URL_EXTERN" -X -v go=1 -f scripts/sql/utm-bereinigung.sql
--
-- Rückweg: Die Daten sind bewusst nicht wiederherstellbar (es waren nur
-- Passwort-Kopien). Der CHECK lässt sich lösen mit
--   ALTER TABLE fiaon_applications DROP CONSTRAINT fiaon_applications_utm_erlaubt;
-- Die Erlaubnisliste MUSS gleich UTM_SCHLUESSEL in server/lib/fiaon-utm.ts sein
-- (scripts/pruef-utm-erlaubnisliste.ts vergleicht beide).
-- ═══════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\pset footer off
\set erlaubt '{utm_source,utm_medium,utm_campaign,utm_id,utm_content,utm_term,gclid,fbclid,landing,ref}'
\set pwmuster '^(pass(word|wort)?|passwd|pw|pwd|kennwort|new_?password|neues_?passwort)$'

\if :{?vorschau}
SET default_transaction_read_only = on;
\echo '== Vorschau: Formen von utm heute'
SELECT COALESCE(jsonb_typeof(utm), 'NULL') AS form, COUNT(*) AS zeilen FROM fiaon_applications GROUP BY 1 ORDER BY 2 DESC;
\echo '== Vorschau: was sich ändern würde (Zähler und Schlüsselnamen, keine Werte)'
-- >>> BERECHNUNG (identisch mit dem Ausführungsteil unten)
WITH schichten AS (
  SELECT a.id, s.nr, s.o
  FROM fiaon_applications a
  CROSS JOIN LATERAL (
    SELECT 0::bigint AS nr, a.utm AS o WHERE jsonb_typeof(a.utm) = 'object'
    UNION ALL
    SELECT 0::bigint, (a.utm #>> '{}')::jsonb WHERE jsonb_typeof(a.utm) = 'string' AND (a.utm #>> '{}') ~ '^\s*\{'
    UNION ALL
    SELECT e.nr, CASE WHEN jsonb_typeof(e.v) = 'object' THEN e.v ELSE (e.v #>> '{}')::jsonb END
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.utm) = 'array' THEN a.utm ELSE '[]'::jsonb END) WITH ORDINALITY AS e(v, nr)
    WHERE jsonb_typeof(e.v) = 'object' OR (jsonb_typeof(e.v) = 'string' AND (e.v #>> '{}') ~ '^\s*\{')
  ) s
  WHERE a.utm IS NOT NULL
),
schluessel AS (
  SELECT s.id, s.nr, kv.key AS k, kv.value AS v
  FROM schichten s
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.o) = 'object' THEN s.o ELSE '{}'::jsonb END) kv
),
neu AS (
  SELECT a.id, a.ref, a.created_at, jsonb_typeof(a.utm) AS alte_form, a.utm AS alt,
    COALESCE(array_agg(DISTINCT x.k ORDER BY x.k) FILTER (WHERE x.k IS NOT NULL), '{}'::text[]) AS alte_schluessel,
    (COUNT(DISTINCT x.nr) FILTER (WHERE x.k ~* :'pwmuster'))::int AS passwort_eintraege,
    COALESCE(jsonb_object_agg(x.k, to_jsonb(left(btrim(x.v #>> '{}'), 500)) ORDER BY x.nr)
      FILTER (WHERE x.k = ANY(:'erlaubt'::text[]) AND jsonb_typeof(x.v) IN ('string', 'number') AND btrim(x.v #>> '{}') <> ''),
      '{}'::jsonb) AS neu
  FROM fiaon_applications a
  LEFT JOIN schluessel x ON x.id = a.id
  WHERE a.utm IS NOT NULL
  GROUP BY a.id
)
-- <<< BERECHNUNG
SELECT alte_form, COUNT(*) AS zeilen_die_sich_aendern,
  COUNT(*) FILTER (WHERE passwort_eintraege > 0) AS davon_mit_passwort,
  SUM(passwort_eintraege) AS passwort_eintraege,
  COUNT(*) FILTER (WHERE neu <> '{}'::jsonb) AS behalten_erlaubte_schluessel,
  MIN(created_at)::date AS von, MAX(created_at)::date AS bis,
  (SELECT string_agg(DISTINCT k, ', ') FROM neu n2, unnest(n2.alte_schluessel) AS k
    WHERE n2.alte_form = neu.alte_form AND n2.alt IS DISTINCT FROM n2.neu) AS schluesselnamen
FROM neu WHERE alt IS DISTINCT FROM neu GROUP BY 1 ORDER BY 1;
\quit
\endif

-- ── Ausführung (Probelauf ohne -v go=1 endet mit ROLLBACK) ─────────────────
SET lock_timeout = '5s';
BEGIN;

CREATE TABLE IF NOT EXISTS fiaon_utm_bereinigung_protokoll (
  application_id integer PRIMARY KEY,
  ref varchar NOT NULL,
  alte_form text NOT NULL,
  alte_schluessel text[] NOT NULL,
  passwort_eintraege integer NOT NULL,
  behaltene_schluessel text[] NOT NULL,
  bereinigt_am timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE fiaon_utm_bereinigung_protokoll IS
  'E-242 (25.09.2026): welche Antragszeilen die utm-Bereinigung geändert hat. Nur Schlüsselnamen und Zähler — NIE Werte.';

\echo '== vorher'
SELECT COALESCE(jsonb_typeof(utm), 'NULL') AS form, COUNT(*) AS zeilen FROM fiaon_applications GROUP BY 1 ORDER BY 1;

-- >>> BERECHNUNG (identisch mit der Vorschau oben)
WITH schichten AS (
  SELECT a.id, s.nr, s.o
  FROM fiaon_applications a
  CROSS JOIN LATERAL (
    SELECT 0::bigint AS nr, a.utm AS o WHERE jsonb_typeof(a.utm) = 'object'
    UNION ALL
    SELECT 0::bigint, (a.utm #>> '{}')::jsonb WHERE jsonb_typeof(a.utm) = 'string' AND (a.utm #>> '{}') ~ '^\s*\{'
    UNION ALL
    SELECT e.nr, CASE WHEN jsonb_typeof(e.v) = 'object' THEN e.v ELSE (e.v #>> '{}')::jsonb END
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.utm) = 'array' THEN a.utm ELSE '[]'::jsonb END) WITH ORDINALITY AS e(v, nr)
    WHERE jsonb_typeof(e.v) = 'object' OR (jsonb_typeof(e.v) = 'string' AND (e.v #>> '{}') ~ '^\s*\{')
  ) s
  WHERE a.utm IS NOT NULL
),
schluessel AS (
  SELECT s.id, s.nr, kv.key AS k, kv.value AS v
  FROM schichten s
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.o) = 'object' THEN s.o ELSE '{}'::jsonb END) kv
),
neu AS (
  SELECT a.id, a.ref, a.created_at, jsonb_typeof(a.utm) AS alte_form, a.utm AS alt,
    COALESCE(array_agg(DISTINCT x.k ORDER BY x.k) FILTER (WHERE x.k IS NOT NULL), '{}'::text[]) AS alte_schluessel,
    (COUNT(DISTINCT x.nr) FILTER (WHERE x.k ~* :'pwmuster'))::int AS passwort_eintraege,
    COALESCE(jsonb_object_agg(x.k, to_jsonb(left(btrim(x.v #>> '{}'), 500)) ORDER BY x.nr)
      FILTER (WHERE x.k = ANY(:'erlaubt'::text[]) AND jsonb_typeof(x.v) IN ('string', 'number') AND btrim(x.v #>> '{}') <> ''),
      '{}'::jsonb) AS neu
  FROM fiaon_applications a
  LEFT JOIN schluessel x ON x.id = a.id
  WHERE a.utm IS NOT NULL
  GROUP BY a.id
)
-- <<< BERECHNUNG
, geaendert AS (
  UPDATE fiaon_applications a SET utm = n.neu
  FROM neu n
  WHERE a.id = n.id AND a.utm IS DISTINCT FROM n.neu
  RETURNING a.id
)
INSERT INTO fiaon_utm_bereinigung_protokoll
  (application_id, ref, alte_form, alte_schluessel, passwort_eintraege, behaltene_schluessel)
SELECT n.id, n.ref, n.alte_form, n.alte_schluessel, n.passwort_eintraege,
       ARRAY(SELECT jsonb_object_keys(n.neu) ORDER BY 1)
FROM geaendert g JOIN neu n ON n.id = g.id
ON CONFLICT (application_id) DO NOTHING;

\echo '== nachher'
SELECT COALESCE(jsonb_typeof(utm), 'NULL') AS form, COUNT(*) AS zeilen FROM fiaon_applications GROUP BY 1 ORDER BY 1;
\echo '== Protokoll (Zähler)'
SELECT alte_form, COUNT(*) AS zeilen, COUNT(*) FILTER (WHERE passwort_eintraege > 0) AS mit_passwort,
       SUM(passwort_eintraege) AS passwort_eintraege
FROM fiaon_utm_bereinigung_protokoll GROUP BY 1 ORDER BY 1;
\echo '== Protokoll (Schlüsselnamen)'
SELECT k AS schluessel, COUNT(*) AS zeilen FROM fiaon_utm_bereinigung_protokoll, unnest(alte_schluessel) AS k GROUP BY 1 ORDER BY 2 DESC;

-- Kontrolle: nichts darf übrig sein — sonst ROLLBACK und Abbruch.
SELECT
  COUNT(*) FILTER (WHERE utm IS NOT NULL AND jsonb_typeof(utm) <> 'object') AS rest_form,
  COUNT(*) FILTER (WHERE jsonb_typeof(utm) = 'object' AND (utm - :'erlaubt'::text[]) <> '{}'::jsonb) AS rest_fremd,
  COUNT(*) FILTER (WHERE utm::text ~* '(pass(word|wort)?|passwd|pwd?|kennwort)\\?"\s*:') AS rest_passwort
FROM fiaon_applications \gset
\echo 'Kontrolle: Nicht-Objekte' :rest_form ', fremde Schlüssel' :rest_fremd ', Passwort-Spuren' :rest_passwort
SELECT (:rest_form + :rest_fremd + :rest_passwort) = 0 AS sauber \gset
\if :sauber
\else
  \echo 'ABBRUCH: Bereinigung unvollständig — ROLLBACK, nichts geändert.'
  ROLLBACK;
  \quit
\endif

\if :{?go}
COMMIT;
\echo '== COMMIT. Jetzt der CHECK (kurze Sperre beim Anlegen, Prüfung ohne Sperre).'
ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_utm_erlaubt;
ALTER TABLE fiaon_applications ADD CONSTRAINT fiaon_applications_utm_erlaubt
  CHECK (utm IS NULL OR (jsonb_typeof(utm) = 'object' AND (utm - :'erlaubt'::text[]) = '{}'::jsonb)) NOT VALID;
ALTER TABLE fiaon_applications VALIDATE CONSTRAINT fiaon_applications_utm_erlaubt;
SELECT conname, convalidated FROM pg_constraint WHERE conname = 'fiaon_applications_utm_erlaubt';
\else
\echo '== Probelauf: CHECK wird in derselben Transaktion angelegt und geprüft, dann ROLLBACK.'
ALTER TABLE fiaon_applications DROP CONSTRAINT IF EXISTS fiaon_applications_utm_erlaubt;
ALTER TABLE fiaon_applications ADD CONSTRAINT fiaon_applications_utm_erlaubt
  CHECK (utm IS NULL OR (jsonb_typeof(utm) = 'object' AND (utm - :'erlaubt'::text[]) = '{}'::jsonb));
ROLLBACK;
\echo '== ROLLBACK — Probelauf beendet, nichts geändert.'
\endif
