-- ═══════════════════════════════════════════════════════════════════════════
-- AGENTEN-MITTEILUNG zum CRM-Umbau (03.08.2026)
--
-- Erscheint unter /agent/updates. Bewusst in der Sprache der Agenten: Was
-- ändert sich an MEINER Arbeit, und was muss ich ab morgen anders machen.
-- Keine Tabellennamen, keine Dateipfade — das steht im CHANGELOG.
--
-- Idempotent: Der Titel ist der Schlüssel. Erneutes Ausführen legt keinen
-- zweiten Eintrag an, sondern aktualisiert den Text. Sonst stünde die
-- Mitteilung nach jedem Deploy mehrfach in der Liste.
--
-- Aufruf:
--   psql "$DATABASE_URL" -f scripts/sql/agent-update-crm-umbau.sql
-- ═══════════════════════════════════════════════════════════════════════════

WITH neu AS (
  SELECT
    'Neu: Deine Kunden kommen jetzt zu dir — die Kartei ist abgelöst'::varchar AS title,
    E'Ab heute arbeitet das Portal anders. Drei Dinge, die dich direkt betreffen.\n\n'
    '**1. Die offene Kartei gibt es nicht mehr.**\n'
    'Du suchst dir keine Akten mehr selbst heraus. Stattdessen bekommst du Kunden zugewiesen — '
    'sortiert nach Dringlichkeit. Wer eine offene Rechnung hat oder eine Zahlung zugesagt hat, '
    'liegt oben. Wer nur ein Lead ist, weiter unten. Du siehst zu jedem Kunden, WARUM er dort '
    'einsortiert ist.\n\n'
    'Der Grund für die Umstellung: In der Kartei konnte derselbe Kunde bei zwei Agenten landen. '
    'Beide haben angerufen, beide hielten sich für zuständig, und am Ende war strittig, wem die '
    'Provision gehört. Das kann jetzt nicht mehr passieren.\n\n'
    '**2. Ein Kunde hat genau einen Zuständigen — nicht mehr eine Bestellung.**\n'
    'Bisher hing die Zuständigkeit an der einzelnen Bestellung. Ein Kunde mit acht Bestellungen '
    'konnte acht Zuständige haben. Jetzt gehört der MENSCH dir, mit allem, was er bestellt hat. '
    'Bestellt er später etwas nach, gehört das automatisch auch zu dir — du musst nichts tun.\n\n'
    'Jeder Besitzwechsel wird mit Vorher und Nachher protokolliert. Falls es je um eine Provision '
    'geht, ist nachweisbar, wer den Kunden wann betreut hat.\n\n'
    '**3. Bonitätsauskünfte verschwinden nicht mehr.**\n'
    'Es gab einen Fehler: Wenn ein Kunde eine Bonitätsauskunft (74 €) bestellt hatte und danach '
    'sein Konto aktivierte, hat das System die Auskunft stillschweigend gelöscht. Ohne Hinweis. '
    'Das hat euch Abschlüsse gekostet, von denen ihr nie erfahren habt — bei genau den Kunden, '
    'die schon einmal gezahlt haben und am ehesten wieder kaufen.\n\n'
    'Der Fehler ist behoben. Bestellungen werden nur noch dann als Doppelbestellung behandelt, '
    'wenn es wirklich dasselbe Produkt ist. Ein Upgrade von Pro auf Ultra zählt weiterhin als '
    'Wechsel — ein Konto hat eine Stufe. Die Bonitätsauskunft ist davon unabhängig.\n\n'
    'Betroffene Bestellungen werden gerade geprüft und wieder geöffnet. Liegt eine davon bei dir, '
    'erscheint sie in deiner Liste mit dem Hinweis, dass der Kunde dieses Produkt bestellt und '
    'nie erhalten hat. Ruf ihn an — er hat es selbst ausgewählt.'::text AS body
)
INSERT INTO fiaon_agent_updates (title, body, published, published_at, created_at, updated_at)
SELECT title, body, TRUE, NOW(), NOW(), NOW() FROM neu
WHERE NOT EXISTS (
  SELECT 1 FROM fiaon_agent_updates u WHERE u.title = (SELECT title FROM neu)
);

-- Bewusst KEIN nachträgliches UPDATE des Textes: Hat ein Admin die Mitteilung
-- im Portal überarbeitet oder zurückgezogen, darf ein erneuter Deploy seine
-- Änderung nicht überschreiben. Soll der Text wirklich ersetzt werden, wird die
-- alte Mitteilung im Portal gelöscht und diese Datei erneut ausgeführt.

SELECT id, title, published, published_at, length(body)||' Zeichen' AS umfang
FROM fiaon_agent_updates
WHERE title LIKE 'Neu: Deine Kunden kommen%';
