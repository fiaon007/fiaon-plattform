# Archivierte Migrationen

Dateien in diesem Ordner werden vom Migrations-Runner **nicht** gelesen.
`scripts/run-migrations.mjs` listet ausschliesslich `*.sql` direkt in
`db/migrations/` und steigt nicht in Unterordner ab.

## Warum hier etwas liegt

Der Runner verweigert jede Datei mit `DROP TABLE`, `DROP DATABASE` oder
`TRUNCATE` — richtig so. Er zählt sie danach aber als Fehlschlag und endet
trotzdem mit `exit 0`. Bei jedem Deploy entstand dadurch dieselbe
Fehlermeldung. Eine Meldung, die immer erscheint, wird nicht mehr gelesen;
sie macht den nächsten echten Fehler unsichtbar. Deshalb wandern dauerhaft
verweigerte Dateien hierher statt im Ordner zu bleiben.

## Inhalt

### 024_nuclear_knowledge_base_reset.sql

Enthält `DROP TABLE IF EXISTS knowledge_base CASCADE`. War im Tracker nie als
angewandt vermerkt und wurde vom Runner bei jedem Start verweigert. Die
Wissensdatenbank wurde inzwischen über `025_hybrid_search_setup.sql`
aufgebaut, das regulär angewandt ist. Ein nachträglicher Reset würde sie
zerstören.

Soll der Reset jemals wirklich laufen, dann von Hand und mit Backup:

```
psql "$DATABASE_URL" -f db/migrations/_archiv/024_nuclear_knowledge_base_reset.sql
```
