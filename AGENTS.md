# Arbeitsregeln für dieses Repo

Kurz, verbindlich, und aus echten Schäden entstanden. Wer hier arbeitet — Mensch
oder Agent —, hält sich daran.

## Die Datenbank ist PRODUKTION

`DATABASE_URL` in `.env` zeigt auf die **echte** Datenbank (Render, Oregon). Es
gibt keine Kopie zum Üben.

- **Prüfstände laufen in einer Transaktion, die am Ende zurückgerollt wird.**
  Muster: `scripts/pruef-merge.ts`, `scripts/pruef-fundament-b.ts`. Dann wird nie
  etwas geschrieben und es gibt auch nichts aufzuräumen.
- **Keine Hard-Deletes, nirgends.** Nicht bei Kunden, nicht bei Bestellungen,
  nicht bei Nachweisen. Es gibt immer eine Spalte: `archived_at`,
  `merged_into_person_id`, `widerrufen_am`, `entfernt_am`.
- Läufe, die den Bestand ändern, brauchen **erst eine Vorschau** (CSV in
  `reports/`) und schreiben nur mit `--schreiben`.

## Browser-Tests dürfen keine echten Vorgänge erzeugen

Am 06.08.2026 hat ein Playwright-Testlauf die Verpflichtungserklärung der
Vertriebsleitung als „Daniel Stripling" **echt angenommen** — gegen die
Produktionsdatenbank, von 127.0.0.1 mit HeadlessChrome. Ein Rechtsnachweis, den
ein Roboter erzeugt, ist wertlos; er stand aber in der Tabelle und der geschützte
Bereich war offen.

Deshalb gilt:

1. **Ein Browser-Test erzeugt NIE eine echte Annahme, Buchung, Unterschrift,
   Zahlung oder Mail.**
2. **Screenshots von Zustimmungs- oder Buchungsstrecken enden VOR dem letzten
   Klick.** Der Dialog wird gezeigt, nicht bestätigt.
3. Wo ein Vorgang wirklich durchlaufen werden muss: gegen **Testdaten**, die im
   selben Lauf zurückgerollt oder entfernt werden — niemals an echten Kunden,
   Agenten oder Nachweisen.
4. Der Server wehrt sich zusätzlich selbst: `istRoboterUnterschrift`
   (`server/lib/fiaon-vertrieb-zusage.ts`) lehnt Annahmen von localhost oder mit
   automatisierter Browserkennung ab. Eine Regel, die man vergessen kann, hat man
   schon vergessen — die Wand steht im Code.

## Test-Mitarbeiterkonten legen sich am Ende selbst still

Jeder Browser-Prüfstand braucht eine Anmeldung, und er darf **keine echte**
benutzen (siehe die Regel darüber). Also legt er ein Mitarbeiterkonto an. Am
17.08.2026 stand der Betreiber vor seiner Team-Zentrale und sah **11 Karten**:
sechs Menschen und fünf Prüfstands-Konten. Insgesamt lagen **43 Testkonten**
neben den 6 echten in der Tabelle.

Drei Prüfstände hatten drei handgeschriebene Fassungen des Abschlusses — und
keine setzte `is_test_account`. Ein Konto ohne diese Marke fällt durch jeden
Filter.

Deshalb:

- **Am Ende jedes Laufs `testkontoStilllegen(id)` aufrufen**
  (`server/lib/fiaon-mitarbeiter-sicht.ts`). Sie setzt `active = FALSE`,
  `is_test_account = TRUE`, löscht das Passwort und nimmt das Konto aus der
  Verteilung. **Nicht löschen** — an einem Konto hängen Provisionen, Stunden
  und Verlaufseinträge.
- **Jede Team-Ansicht filtert über `echteMitarbeiterSql()`.** Die Grenze steht
  in der WHERE-Bedingung, nicht in der Oberfläche: Sonst holt die Abfrage die
  Zeilen, die Anzeige wirft sie weg — und die Kennzahl hat schon gezählt.
  `ORDER BY … is_test_account` ist **keine** Grenze, sondern eine Sortierung.
- Testkonten sind nicht verboten, nur nicht im Weg: Der Filter „Testkonten" in
  der Team-Zentrale zeigt sie ausdrücklich.

## Handwerk

- **Jede Änderung bekommt einen `CHANGELOG.md`-Eintrag** im selben Commit:
  Datum, was geändert, warum, wo zu finden. In Klartext für Nicht-Entwickler.
- **Ist die Änderung für Agenten sichtbar**, kommt ein Eintrag in
  `client/src/pages/agent/updates-data.ts` dazu.
- **Keine Emojis, keine Icon-Bibliotheken.** Ordnung entsteht durch Ziffern,
  Haarlinien und Weißraum. Wenn ein Symbol nötig ist: selbst gezeichnetes SVG,
  1,5 px Strich, `currentColor` (Muster: `client/src/lib/fiaon-zeichen.tsx`).
- **Zeitzone ist Europe/Berlin** — über `server/lib/fiaon-time.ts`, nie über
  `new Date().toISOString().slice(0,10)`.
- **Eine Definition, ein Ort.** Filterbedingungen stehen in
  `server/lib/fiaon-bestand-filter.ts`, Statustexte in
  `server/lib/fiaon-kundenstatus.ts`, Einstufung in `server/lib/tier.ts`.
  Zwei Definitionen für dasselbe Wort sind schlimmer als eine fehlende Zahl.
- Deutsche Bezeichner in neuem Code (`personenZusammenfuehren`, nicht
  `mergePersons`) — das Repo ist konsequent deutschsprachig.

## Befehle

```
npx tsx scripts/<name>.ts          # Läufe und Prüfstände
node scripts/run-migrations.mjs    # SQL-Migrationen (db/migrations, idempotent)
npx tsc --noEmit                   # Typcheck
npx vite build                     # Client-Build
npx esbuild <datei.ts> > /dev/null # Syntaxprobe einer Serverdatei
npx tsx scripts/pruef-schmal.ts    # 380-px-Ansicht (braucht laufenden Server)
set -a && . ./.env && set +a && PORT=5188 npm run dev   # Server lokal
```

**`npx vite build` ist NICHT die Abnahme des Servers.** Es baut nur `client/`.
Am 08.08.2026 stand in einem SQL-Kommentar in `server/routes/fiaon-finance.ts`
ein Wort in Backticks — das beendete das umgebende Template-Literal. Der
Client-Build blieb grün, der Typcheck ging im Alt-Bestand unter, und der
Serverstart hing danach still in `registerRoutes`: kein Fehler, keine Zeile, nur
ein Prozess, der nie „serving on port" meldete. Der fehlgeschlagene
`await import()` einer Routendatei bricht den Start nicht ab, er hält ihn an.

Deshalb gilt nach jeder Änderung an `server/`:

1. **Server wirklich starten** und auf `serving on port` warten. Bleibt er
   stehen, die Routen-Importe in `server/routes.ts` mit Zwischenmeldungen
   eingrenzen — der letzte geladene Name nennt die Nachbarschaft des Fehlers.
2. Schneller Vorabtest ohne Start: `npx esbuild <datei>` über die geänderten
   Serverdateien. Ein Syntaxfehler fällt dort in Sekunden auf.
3. Keine Backticks in Kommentaren innerhalb von Template-Literalen. Für
   zitierte Bedingungen die deutschen Anführungszeichen „…" nehmen.
   **Das gilt auch für SQL-Kommentare (`-- …`) innerhalb einer Abfrage** — sie
   stehen im Template-Literal und beenden es genauso. Am 17.08.2026 dreimal
   an einem Tag passiert: einmal in einem `-- …`-Kommentar in fiaon-team.ts,
   zweimal in `--`-Kommentaren mitten in einem UPDATE. Jedes Mal fiel es erst
   auf, als der Lauf nicht startete.
4. **Regex-Literale niemals über zwei Zeilen.** Wer aus einem mehrzeiligen
   Kommentar zitiert, muss den Text einzeilig machen — sonst
   „Unterminated regular expression", und der Prüfstand startet nicht.
   Am 11.08.2026 zehnmal passiert.

**`npx tsx scripts/pruef-backticks.ts` prüft beides.** Der zweite Teil lässt
`esbuild` über alle 321 Dateien in `scripts/` und `server/` laufen — es weiß
besser als jeder Regex, was ein Regex ist. Ein erster Entwurf suchte selbst
danach und meldete 13 Fehlalarme.
   **`npx tsx scripts/pruef-backticks.ts` prüft das.** Die Regel wurde seit
   dem 08.08.2026 neunmal vergessen — eine Regel, die man neunmal vergisst,
   braucht keine zehnte Erinnerung, sondern eine Wand.

## Eine Invariante darf nicht den Betrieb mitmessen

Ein Massenlauf gegen die Produktion braucht Abbruchbedingungen — aber sie dürfen
nur zählen, was der Lauf selbst anfasst. Am 08.08.2026 stoppte die
Zusammenführung nach der ersten Welle, weil die Zahl der Bestellungen ohne
Person von 3.550 auf 3.551 gestiegen war. Ursache: fünf echte Besucher hatten
ein Formular begonnen. Ein Entwurf hat noch keine Person — das ist der Trichter,
nicht der Lauf.

- **Je Einheit exakt** (hier: je Gruppe, in derselben Transaktion) — dort ist die
  Zahl aussagekräftig und immun gegen Nebenläufigkeit.
- **Global nur „darf nicht schrumpfen"** — Wachstum ist der Betrieb.
- Wer zweimal grundlos gestoppt wurde, schaltet die Bremse ab. Eine Bremse, die
  falsch auslöst, ist gefährlicher als keine.

## Eine Funktion ist erst geliefert, wenn ein Mensch sie anklicken kann

Am 11.08.2026 meldete der Betreiber zum zweiten Mal, dass „Alle prüfen" auf
`/admin/events` fehlt. Der Server konnte es seit Tagen — die Route
`POST /admin/mail/alle-pruefen` war fertig, getestet und grün. Es gab nur
keinen Knopf.

Der Prüfstand von damals lautete:

```ts
ok("Die Route existiert", /router\.post\("\/admin\/mail\/alle-pruefen"/.test(mailRouten));
```

Alle vier Prüfungen dieser Gruppe sahen ausschließlich in den
**Serverquelltext**. Keine einzige prüfte, ob ein Mensch etwas anklicken kann.
Der Prüfstand war grün, die Funktion unerreichbar.

Daraus die Regel:

- **Für jede Funktion, die der Betreiber oder ein Teammitglied benutzt, muss
  ein BROWSERTEST den Bedienknopf FINDEN und DRÜCKEN** — `getByRole("button",
  { name: … })`, dann `click()`, dann das Ergebnis am gerenderten Text messen.
  Ein Quelltext-Grep über die Route beweist nur, dass Code existiert.
- **Fremde Aufrufe im Browsertest abfangen** (`page.route`), damit keine
  echten Mails, Anrufe oder Buchungen entstehen. Die Attrappe liefert genau
  das, was der Betreiber in Produktion sähe — inklusive Fehlerfall.
- **Der Screenshot ist Teil der Abnahme.** Wer ihn nicht angesehen hat, hat
  nicht geliefert. `innerText` gibt bei `text-transform: uppercase` den
  TRANSFORMIERTEN Text zurück — Prüfungen auf Beschriftungen deshalb ohne
  Rücksicht auf Groß- und Kleinschreibung.

## Ein Prüfstand muss rot werden können

Nach jedem neuen Prüfstand: **den Fehler absichtlich wieder einbauen und
schauen, ob er rot wird.** `scripts/pruef-schmal.ts` bestand am 08.08.2026 im
ersten Entwurf auch mit eingebautem Fehler — er sah nur Blätter im Dokument
(die Fundstelle war eine Zeile aus drei Knöpfen) und suchte sich seinen Prüffall
zufällig aus. Beides sah nach Prüfung aus und war keine.

Daraus die zwei Regeln:

- **Der ungünstigste Fall, nicht der erstbeste.** Prüffälle gezielt wählen
  (längster Statustext, meiste Bestellungen), nicht „LIMIT 1" auf eine Liste.
- **Erst warten, dann messen.** Eine Seite, die noch lädt, hat nichts, was
  falsch sein könnte. Auf eine Marke im Inhalt warten — und ihr Ausbleiben als
  Fehlschlag melden, nicht als Übersprungen.

## Ein Prüfstand in einer Transaktion trifft auf drei Fallen

Am 16.08.2026 beim Bau von `scripts/pruef-abo-motor.ts` — alle drei kosten
Minuten, wenn man sie kennt, und eine halbe Stunde, wenn nicht:

1. **DDL wartet auf die offene Transaktion.** `ensureAboTabellen` und
   `ensureAgentTables` führen `ALTER TABLE` über den GLOBALEN Pool aus, also
   auf einer zweiten Verbindung. Hat der Prüfstand dieselbe Tabelle in seiner
   Transaktion schon angefasst, warten beide aufeinander bis zum
   Statement-Zeitlimit — ohne Fehlermeldung, die das erklärt. **Beide Prüfungen
   vor `sqlPool.begin` einmal aufrufen**; sie merken sich, dass sie gelaufen
   sind.
2. **Eine Gegenprobe, die einen Constraint verletzt, tötet die ganze
   Transaktion.** Danach scheitert jede weitere Abfrage mit „current
   transaction is aborted". Solche Prüfungen gehören in einen
   **`tx.savepoint(...)`**, dann überlebt der Rest.
3. **Funktionen, die den Bestand ändern, brauchen einen `lauf`-Parameter**
   (`lauf: Lauf = sqlPool`). Ohne ihn arbeiten sie am globalen Pool und sehen
   die Testdaten der Transaktion nicht — der Prüfstand prüft dann die
   Produktion statt seines Prüffalls.

Und: **Ein Prüfstand darf nicht am ersten Fehler abbrechen.** Ein `[rate]` aus
einem leeren Ergebnis wirft beim nächsten Feldzugriff einen TypeError, und alle
folgenden Prüfungen bleiben ungeprüft. Rückfallobjekt anhängen, dann werden sie
rot statt unsichtbar.

## React-Haken stehen ÜBER dem ersten `return`

Am 16.08.2026 zum zweiten Mal in `client/src/components/Softphone.tsx`
passiert: ein `useEffect` hinter `if (!stand) return null;`. Der Browser meldet
„Rendered more hooks than during the previous render", die halbe Verwaltung ist
weiß — und **weder Typcheck noch Client-Build noch der Serverstart sehen es**.
Gefunden hat es der Screenshot der Browser-Abnahme.

Deshalb: Neue `useState`/`useEffect` immer zu den anderen Haken oben in die
Komponente, nie an die Stelle, wo man sie gerade braucht.

## Eine Attrappe muss liefern, was der Server liefert

Am 18.08.2026 zeigte ein Browsertest die Terminwahl mit dem Satz „Wähl eine Zeit
für ein **-minütiges** Gespräch". Es sah nach einem Fehler in der Oberfläche aus.
Es war die Attrappe: Sie lieferte `slots` und `betreuer`, aber nicht
`slotMinuten` — ein Feld, das der echte Server immer mitschickt.

Eine Attrappe, die WENIGER liefert als der Server, erzeugt Fehler, die es nicht
gibt — und verdeckt die, die es gibt. Wer sie schreibt, liest vorher die
Antwortform der echten Route und liefert **alle** Felder, die die Oberfläche
liest.

## Ein Teilindex mit einer Bedingung zu viel ist keine Wand

Die Onboarding-Vergütung soll genau einmal je Kunde entstehen. Die Grenze gehört
in die Datenbank und nicht in den Code: Zwei gleichzeitige Abschlüsse lesen beide
„noch keine da" und schreiben beide.

Der erste Entwurf lautete:

```sql
CREATE UNIQUE INDEX … ON fiaon_commissions (onboarding_person_id)
  WHERE kind = 'onboarding' AND onboarding_person_id IS NOT NULL;
```

Fachlich richtig, technisch unbrauchbar: PostgreSQL verwendet einen Teilindex für
`ON CONFLICT` nur, wenn das `WHERE` der Anweisung dem Index-Prädikat
**entspricht**. Der Aufruf scheiterte mit `infer_arbiter_indexes` (42P10) — die
Wand stand, aber niemand konnte sie benutzen.

- **Index-Prädikat und `ON CONFLICT … WHERE` müssen übereinstimmen.**
- `IS NOT NULL` ist in einem Unique-Index überflüssig: Mehrere NULL-Werte sind
  dort ohnehin erlaubt.
- Und: **Eine Wand, die man nicht benutzen kann, wird beim ersten Fehlschlag
  umgangen.** Deshalb prüft `scripts/pruef-kundenweg.ts` sie zweimal — einmal
  gegen `pg_indexes`, einmal durch einen echten doppelten Aufruf in einer
  Transaktion, die zurückgerollt wird.

## Zwei Motoren an einer Liste schicken zwei Mails

Die ewige Lead-Strecke (18.08.2026) hat die alte Sechser-Strecke abgelöst. Beim
Einbau standen zwei Fallen im Weg, die beide leicht zu übersehen waren:

1. Die alte Strecke markierte Leads nach sechs Mails als „tot". Die neue
   überspringt tote Leads — sie hätte also **genau die verloren, für die sie
   gebaut wurde** (gemessen: 1.483).
2. Der alte Stapelversand hätte weiter gesendet. Derselbe Mensch bekäme zwei
   Mails am selben Morgen.

Wer einen bestehenden Automatismus ersetzt, sucht deshalb zuerst dessen
**Abbruch- und Markierungslogik** — nicht nur seine Sendestelle. Und der Ersatz
bekommt einen Schalter in den Einstellungen (`lead_strecke_ewig`), damit der
Betreiber zurückkann, ohne einen Entwickler zu brauchen.

## Bekannter Bestand, damit niemand erschrickt

- `npx tsc --noEmit` meldet rund **240 Alt-Typfehler** (u. a. aus
  Dropbox-Konfliktkopien „… in Konflikt stehende Kopie …"). Sie sind Bestand.
  **Neue Dateien müssen fehlerfrei sein**; `target` liegt unter ES2015, deshalb
  `Array.from(map.entries())` statt direkter Map-Iteration.
- `db/migrations/006_service_orders.sql` wird vom Migrationslauf **absichtlich
  verweigert** (enthält DROP). Das „Failed: 1" am Ende ist normal.
- `/admin/hub/badges` braucht kalt rund zehn Sekunden. Bekannt, nicht schön.
