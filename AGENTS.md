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

## Eine Rot-Probe an einer Sicherheitswand richtet echten Schaden an

Am 19.08.2026 wurde für die Rot-Probe die Nur-Lesen-Wand der Als-Kunde-Ansicht
absichtlich entfernt. Prompt antwortete „Bonitätsauskunft bestellen (74 €)" mit
**HTTP 200** — der Prüfstand hatte eine echte SCHUFA-Bestellzeile in der
Produktionsdatenbank angelegt. Sie ist archiviert, nicht gelöscht.

Das war kein Unglück, sondern der Beweis, dass die Matrix echte Wege prüft. Aber
daraus folgt eine Regel:

- **Ein Prüfstand, der eine Sicherheitswand testet, MUSS damit rechnen, dass sie
  fällt.** Sonst räumt er im Erfolgsfall nichts auf (weil nichts entsteht) und im
  Fehlerfall auch nicht (weil er es nicht kann) — und der Fehlerfall ist genau
  der, in dem etwas entsteht.
- **Erkennbare, garantiert fremde Nutzlasten.** Adressen auf `.invalid` (nach
  RFC 2606 reserviert, kann niemandem gehören), Kennungen mit `PRUEFSTAND` im
  Namen.
- **Aufräumen läuft immer**, nicht nur bei Durchbrüchen: Ein Aufräumen, das nur
  im Fehlerfall läuft, läuft nie, weil man den Fehlerfall nicht plant.

## Eine Wand für zwei Dinge, nicht zwei Wände

Es gab `ansichtNurLesen` für die Mitarbeiter-Ansicht. Für die Kundensicht wäre
eine zweite Middleware daneben der naheliegende Weg gewesen — und der falsche:

Zwei Middlewares, die dasselbe tun, gehen auseinander. Jemand nimmt eine
Ausnahme in die eine auf und vergisst die andere. Dann ist eine der beiden
Ansichten plötzlich schreibend, und **beide Prüfstände bleiben grün**, weil jeder
nur seine eigene Wand prüft.

`nurLesenWand` prüft deshalb beide Cookies. Die alte Funktion bleibt als
dokumentierter Hinweis stehen (ein entfernter Export ließe Importe ins Leere
laufen), aber sie ist nicht mehr eingehängt.

Gleiches gilt für Texte: Der Satz „… ruft dich zur vereinbarten Zeit an" steht
in `shared/fiaon-termin-text.ts` und wird an vier Stellen benutzt — Portal,
Tafel, Bestätigung, Mail-Payload. Vier Fassungen würden auseinanderlaufen, und
dann verspricht die Mail etwas anderes als die Seite.

## Ein Kommentar, der mehr behauptet als der Code tut, ist eine Lüge

`server/lib/fiaon-ansicht.ts` verspricht ein Token, „das den ANSEHENDEN
mitträgt". Der Code trägt nur die Kennung des ANGESEHENEN. Folge: Wer die
Zeichenkette abschreibt, kann sie in einem anderen Browser einsetzen, bis sie
abläuft.

Beim Bauen der Kundensicht wäre dieser Kommentar beinahe als Vorlage
übernommen worden — mit derselben Lücke, aber schwereren Folgen (fremde
Unterlagen, Rechnungen, Zahlungsdaten).

- **Wer ein Muster kopiert, liest den Code, nicht den Kommentar darüber.**
- Und wer eine Sicherheitseigenschaft behauptet, **prüft sie**: Der Prüfstand
  der Kundensicht verlangt ausdrücklich, dass ein Cookie ohne den passenden
  Zugang des Ansehenden nichts zeigt.

## Ein grüner Prüfstand, der die Spalte prüft, sagt nichts über das Bild

Am 19.08.2026 stand im Portal „Guten Abend, Vitor Manuel ." und in der
Paket-Kachel „Maximum)". Die Datenbereinigung räumte 7.163 Paketnamen und 2.642
Namensfelder, die Zählproben standen auf 0, **38 Prüfungen waren grün**.

Der Screenshot zeigte danach weiter „Maximum)".

Die Ursache war nicht der Umbruch in den Daten, sondern eine Zeile im Portal:
`user.packName?.split(" ").pop()`. Bei „FIAON Pro" ergibt das „Pro" — richtig,
und deshalb fiel es jahrelang nicht auf. Bei „FIAON High End (Das Maximum)"
ergibt es „Maximum)". **Der Datenfehler hat den Anzeigefehler verdeckt**, und
das Bereinigen der Daten legte ihn bloß, ohne ihn zu beheben.

- **Wenn der Auftrag aus einem BILD kommt, ist das Bild die Abnahme.** Alle 38
  Prüfungen sahen Spalten an. Keine sah, was ein Mensch liest.
- **Ein Symptom kann zwei Ursachen haben.** „Beide Symptome kommen vom Umbruch"
  war eine Vermutung, die nach dem ersten Fix nicht mehr überprüft wurde.
- Der Browsertest prüft jetzt auf **Klammer-Waisen**: ein „)" ohne öffnende
  Klammer im Text. Das ist eindeutig und trifft genau diese Fehlerklasse.

## Ein Prüfstand, der wegen laufendem Betrieb rot wird, wird abgeschaltet

Zwanzig Minuten nach dem Bereinigungslauf standen wieder drei Zeilen mit
Zeilenumbruch in der Datenbank — angelegt 15:12 und 15:15 Uhr, Status
`personal_data`: echte Besucher, die gerade einen Antrag ausfüllten. Keine
Lücke im Fix, sondern seine Auslieferung — der Produktionsserver lief noch mit
dem alten Code.

Der Prüfstand hätte ab jetzt bei jedem Lauf rot gezeigt, und beim dritten Mal
hätte ihn jemand abgeschaltet.

- **Bestandsprüfungen trennen Altbestand von Neuzugang.** Alt (älter als eine
  Stunde) muss sauber sein; frisch wird GEMELDET, nicht gewertet.
- **Ein Bestandslauf braucht einen zweiten Termin.** Zwischen Commit und Deploy
  schreibt die alte Fassung weiter. Das gehört als Betreiber-TODO in den
  Report, nicht in eine Fußnote.
- Verwandt mit der Regel weiter oben: Eine Invariante darf nicht den Betrieb
  mitmessen.

## Halb-deutsche Anführungszeichen brechen den String

Zweimal am selben Tag ist derselbe Fehler passiert:

```ts
"„Keine Berechtigung" bringt niemanden weiter"   // ← bricht ab
```

Das öffnende „ ist ungefährlich. Das SCHLIESSENDE muss ebenfalls typografisch
sein (`\u201c`), sonst beendet es den umgebenden String — und `esbuild` meldet
„Expected ) but found …" in einer Zeile, die harmlos aussieht.

`npx tsx scripts/pruef-backticks.ts` findet das nicht, weil die Datei syntaktisch
kaputt ist und der Übersetzungsversuch schon vorher scheitert. Wer einen deutschen
Zitatanfang tippt, tippt das Ende gleich mit.

## Ein Gedankenstrich sagt nicht dasselbe wie eine Lücke

39 bezahlte Bestellungen trugen keine Paketbezeichnung. In der Liste stand ein
„—“. Das sieht aus wie „kein Paket bestellt“ — bei einer BEZAHLTEN
Bestellung heißt es aber „wir wissen es nicht“, und das muss eine Nachfrage
auslösen.

- **Fehlende Information wird ANGEZEIGT, nicht gefüllt.** Fünf Pakete ließen
  sich aus dem Betrag ableiten (exakter Preistreffer). Die 34 übrigen hatten
  keinen Hinweis und bekamen KEINEN geratenen Namen: Ein geratenes Paket landet
  in der Rechnung, in der Abo-Rate und in der Provisionsrechnung, und niemand
  kann hinterher sagen, ob es stimmt.
- **Eine sichtbare Lücke ist ehrlich; eine gefüllte Lücke ist eine Behauptung.**

## Drei Schreibweisen für denselben Status finden sich erst beim ersten Klick

Die Prüfroute validiert `approved | pending | changes_requested`. Die
Verwaltungsansicht schreibt `rejected` und `requested` — Werte, die keine andere
Anzeige kennt.

Aufgefallen ist es nur, weil eine neue Ableitung alle Werte abbilden musste.
GEMESSEN: Im Bestand steht ausschließlich `pending` (6.890 Zeilen) — es hat also
noch nie jemand geprüft, und der Widerspruch war folgenlos. Beim ersten Klick
wäre er es nicht mehr gewesen.

- **Wer einen Status schreibt, prüft, welche Werte die Leser kennen.** Am besten
  aus einer gemeinsamen Liste, nicht aus einem Zeichenkettenliteral im Knopf.
- Und eine neue Ableitung nimmt die Werte aus der WIRKLICHKEIT auf, nicht die
  aus der Spezifikation.

## Die Zahlen im Auftrag sind Hinweise, nicht Messwerte

Am 22.08.2026 nannte ein Auftrag vier Kundennamen, eine Zahl 99,99 €, eine
Betragsmeldung und „185 offene Fälle“. Gemessen:

- Drei der vier Namen existierten im Bestand nicht.
- Der Mensch hieß „Branics“, nicht „Brannix“, und sein Paket kostet
  79,99 €.
- Die Betragsmeldung betraf einen Kunden, dem GAR KEIN Bankeingang zugeordnet
  war — er hatte nach Datenlage nicht bezahlt.
- Aus 185 wurden 12.

Der KERN jeder Meldung war richtig: Es gibt Bestellungen ohne Paketbezeichnung,
es gibt Betragsverwirrung, es gibt Wartezustände. Die Zahlen und Namen daneben
sind aus der Erinnerung — und wer sie ungeprüft übernimmt, sucht am falschen
Ort und behebt am falschen Fall.

**Erst messen, dann beheben** — und die Abweichung zwischen Auftrag und Messung
in den Bericht schreiben. Sie ist keine Kritik am Auftraggeber, sondern die
Beschreibung des wirklichen Problems.

## Eine fremde API antwortet nicht sofort — Tempo darf keine Wahrheit kosten

Am 22.08.2026 wurde der Zweig-Prüflauf von 140 auf 34 Sekunden gebracht: alle
Mails senden, EINMAL warten, EINMAL fragen. Am nächsten Tag meldete er für 34
von 35 Ereignissen „die Testmail kam nicht bei Brevo an“ — während die Mails
im Postfach lagen.

Brevos Events-API trägt Ereignisse mit **1–3 Minuten** Verzug ein.

- **Wer eine fremde API nach einem Ergebnis fragt, POLLT** — erste Frage nach
  30 s, dann im Takt, mit Obergrenze. Ein einmal gefundenes Ergebnis bleibt
  gefunden.
- **Tempo entsteht durch frühes Aufhören, nicht durch frühes Fragen.** Sind alle
  Antworten da, endet der Lauf sofort; die volle Wartezeit braucht nur der
  Fehlerfall.
- **Und das Wartefenster beginnt NACH dem Versand.** Ein erster Entwurf zählte
  ab Lauf-Start — die 34 gestaffelten Mails verbrauchten einen Teil davon.
- **Eine Anzeige, die stillsteht, wird abgebrochen.** Ein Abbruch erzeugte hier
  34 falsche Rot-Marken. Also Sekundenzähler und „nächste Nachfrage in n s“.

## Ein Prüfstand am Quelltext beweist nicht das Verhalten

`pruef-zweigampel.ts` prüfte: Steht dort eine Schleife, steht dort die Zahl
240_000. Beides war grün, als der Lauf trotzdem zu früh aufgab — weil niemand
GEMESSEN hatte, ob Brevo bis dahin antwortet.

- **Für Zeit- und Wiederholungslogik gehört ein Verhaltenstest dazu**: echter
  Code, Attrappe am Rand, verkürzte Zeiten.
- **Die Attrappe sitzt am `fetch`, nicht am Modul.** ES-Module sind
  schreibgeschützt (`Cannot assign to read only property of object '[object
  Module]'`) — und der fetch-Abfang prüft mehr: Registry, Payload, URL-Bau und
  Fehlerübersetzung laufen echt durch.
- **Der Import kommt NACH dem Abfang.** Sonst hat das Modul sich `fetch` schon
  gemerkt.
- **Zeiten an Abfragen messen, nicht an der Uhr.** Ein Vergleich der Gesamtdauer
  mit dem Fenster wurde rot, weil Versand und Attrappe selbst Zeit kosten. Die
  Zahl der Abfragen sagt dasselbe und ist maschinenunabhängig.

## Ein Prüfstand mit Attrappe darf nichts bestätigen

`pruef-geduld.ts` ließ den echten Sammellauf gegen eine Attrappe laufen — und
schrieb dabei 34 echte Verifikationen in die Produktionsdatenbank, darunter
„Zweig bestätigt“ für Ereignisse, die nur die ATTRAPPE bestätigt hatte.

**Eine falsche Bestätigung ist schlimmer als keine:** Sie macht die Ampel grün,
ohne dass ein Zweig geprüft wurde. Aufgefallen ist es an den Laufzeiten (34
Schreibvorgänge kosten Sekunden), nicht an einer Prüfung.

- **Funktionen, die einen Zustand festschreiben, brauchen einen Schalter
  dagegen** (`nichtSpeichern`) — und der Prüfstand setzt ihn.
- **Danach nachzählen**, dass wirklich nichts geschrieben wurde.

## Eine Prüfung mit Fehlalarmen ist schlechter als keine

Nach dem vierten halb-offenen deutschen Zitat in einer Sitzung sollte
`pruef-backticks.ts` das finden: „Zahl der „ muss zur Zahl der “ passen“.
Ergebnis: **365 Treffer, fast alle falsch** — JSX-Text, mehrzeilige Literale,
Fortsetzungszeilen von Kommentaren.

Eine Prüfung mit 365 Fehlalarmen wird nach dem dritten Mal abgeschaltet, und
dann fängt sie auch die echten Fälle nicht mehr.

- **Ein Regex beurteilt keinen Quelltext.** Der esbuild-Durchgang im selben
  Prüfstand fand alle vier Fälle — er weiß, was ein String ist und was
  JSX-Text.
- Die Lehre war nicht „mehr Regex“, sondern: **den Prüfstand fragen.** Er
  konnte es längst.

## HTTP 400 heißt: WIR haben den Fehler

Am 21.08.2026 setzte der Betreiber BREVO_API_KEY. Die Zweigprüfung scheiterte bei
ALLEN 35 Ereignissen identisch mit „Brevo hat mit HTTP 400 geantwortet“ —
während seine Testmails ankamen. Die Kachel meldete „35 ohne Zweig“.

Ursache war eine Zeile in `ereignisseFuer()`: `endDate` lag einen Tag in der
ZUKUNFT (`Date.now() + 86_400_000`), und Brevo lehnt das ab. Der Versand war
gesund; nur die Nachschau war kaputt.

- **Statuscodes nach VERURSACHER trennen, nicht nur nach Nummer.** 400/404/422 =
  unsere Abfrage. 401/403 = eine Einstellung. 429/5xx = die Gegenseite.
  `BrevoKlartext` trägt dafür ein Feld `wer`.
- **Ein Zustand „konnte nicht prüfen“ ist nicht derselbe wie „ist
  kaputt“.** Wer beides zusammenzählt, beschuldigt den Betreiber für einen
  Fehler im eigenen Code. Das ist bei FIAON zweimal passiert (09.08. und
  21.08.2026).
- **Eine Prüfung, die nicht stattfand, darf nichts als gescheitert
  markieren** — kein `verifikationSpeichern(…, false, …)`, wenn die Abfrage
  selbst scheiterte.
- **Die volle Antwort des Gegenübers ins Log UND aufklappbar in die Oberfläche.**
  Eine Fehlermeldung ohne sie schickt den nächsten Leser auf dieselbe Suche.
- Und bei fremden APIs: **die Referenz lesen, statt Parameter zu raten.** Brevo
  bietet `days` („in the past including today", max 90) — genau für diesen Zweck,
  und per Bauart ohne Zukunftsdatum. Aber NICHT zusammen mit startDate/endDate:
  laut Referenz unzulässig, und unzulässige Kombinationen sind der zweite
  häufige 400-Grund.

## Ein Grep auf die Abwesenheit von Code trifft die Begründung

Die Prüfung „das Zukunftsdatum ist weg“ wurde rot, obwohl es weg war: Sie
fand den alten Code in dem Kommentar, der erklärt, WARUM er weg ist.

Die naheliegende Reaktion wäre, die Begründung zu löschen. Genau falsch.

- **Wer prüft, dass etwas NICHT im Code steht, prüft den kommentarfreien Text.**
- **Und man verbietet keine Zahl, sondern ihren falschen Gebrauch.** Ein Verbot
  von `86_400_000` traf auch `(Date.now() - seit) / 86_400_000` — Millisekunden
  pro Tag. Der Fehler war das PLUS, nicht die Zahl.

## Dieselbe Zahl an zwei Stellen wird einmal korrigiert

Der Prüflauf wurde von „35 × 4 Sekunden“ auf einen Sammellauf umgebaut. Die
Fortschrittsleiste nannte danach die neue Zeit; der Bestätigungsdialog sagte
weiter „etwa 2 Minuten“.

Gefunden hat es der SCREENSHOT der Abnahme — kein Prüfstand, kein Typcheck.
Wer eine Angabe ändert, sucht sie im ganzen Bauteil (`grep` auf die Zahl und auf
das Wort „Minuten“).

## Ein Prüfstand muss die Bedingungen herstellen, die ein Mensch herstellt

Der Browsertest klickte „Alle Zweige prüfen“ und wurde achtmal rot. Grund:
Der Knopf im Dialog war deaktiviert — „Trag zuerst oben eine Testadresse
ein“. Das ist RICHTIGES Verhalten der Seite (ohne Adresse weiß niemand, wohin
35 Mails gehen).

Ein Prüfstand, der die Vorbedingungen nicht herstellt, prüft eine Sperre und
meldet sie als Fehler. Und wieder: **nur der Screenshot verriet es.**

## Eine Regel gegen 400 Code-Stellen gehört in die Datenbank

Am 20.08.2026 sollten die Kontakt-Spalten an `fiaon_applications` und
`fiaon_leads` verschwinden — „nie wieder E-Mail am Antrag, aber nicht an der
Person". Die Inventur ergab: **397 Zugriffe in 62 Serverdateien**, davon 36
schreibende. Login, Rechnungen und Mail-Versand lesen mit.

Ein `DROP COLUMN` vor dem Code-Umzug hätte den Serverstart beendet.

Das Ziel war aber nie „die Spalte ist weg", sondern „die Werte können nicht
auseinanderlaufen". Das leistet ein **Trigger**:

- Er sitzt HINTER allen Wegen — Antragsstrecke, Lead-Intake, Admin-Anlage,
  CSV-Import, Webhook, ein Skript von Hand, ein alter Client, der noch nicht
  ausgeliefert wurde. Eine Regel im Code müsste 397 Stellen kennen.
- Die Spalten werden damit **Abschriften**. Der `DROP` ist eine Aufräumarbeit
  ohne Eile, kein Rennen gegen neue Fehler.
- **Der Arbeitsvorrat wird geschrieben, nicht erinnert:**
  `reports/arbeitsvorrat-kontaktspalten.md`, nach Datei, schreibende zuerst.

Und die Falle dabei: **`AFTER UPDATE OF spalte` feuert nur, wenn die Spalte in
der Anweisung STEHT.** Ein `SET updated_at = updated_at` löst ihn nicht aus. Der
Bestandslauf meldete 98 angefasste Zeilen und änderte nichts.

## Eine Ablehnung gilt nur für den Wissensstand, zu dem sie fiel

Der Betreiber meldete Pietro Bianco als Doppelgänger. Die Dubletten-Ansicht
zeigte ihn nicht — das Paar war am 08.08.2026 abgehakt worden:

> „Nur Namensähnlichkeit ohne zweites Merkmal (Abstand 0). Kein Beweis für
> denselben Menschen."

**Das war damals richtig.** Person 3598 hatte keine E-Mail; sie stand nur an der
Bestellzeile. Es gab wirklich kein zweites Merkmal. Seit die Adresse an der
Person steht, tragen beide dieselbe.

- **Eine Ablehnung, die mit FEHLENDEN Daten begründet wurde, wird ungültig,
  sobald die Daten da sind.** Sonst konserviert das System einen alten
  Wissensstand und verbirgt einen Fund, den es selbst gemacht hat.
- **Ablehnungen mit anderer Begründung bleiben gültig.** Wer „Vater und Sohn"
  geschrieben hat, hat das Merkmal gesehen und trotzdem entschieden.
- Wirkung hier: 3 Kandidaten → 18 nach dem Umzug → **37** nach dieser Korrektur.
  **19 Doppelgänger waren durch überholte Entscheidungen verdeckt.**

## Vor dem Bau einer Liste: die bestehende suchen

Für die Dubletten-Kandidaten wurde eine neue Tabelle angelegt und mit 170 Paaren
gefüllt. Es gab längst `server/lib/fiaon-dubletten-kandidaten.ts` — vier Stufen
(Rufnummer, E-Mail, Name+Geburtsdatum, Name), live suchend, unter
`/admin/dubletten` bedienbar.

Zwei Listen für dieselbe Frage sind das Doppelmodell, das der Auftrag beseitigen
sollte — der Fehler wäre **im Namen der Reparatur** entstanden. Die Einträge
stehen jetzt auf `in_bestehender_ansicht` (kein Hard-Delete), und die neue
Tabelle hält nur noch, was die Live-Suche nicht sehen kann: eine Kollision im
Moment des Schreibens.

## Eine gelbe Marke ohne Erklärung schickt Menschen auf falsche Suche

Der Betreiber hat 35 Make-Zweige von Hand geprüft. Die Mails kommen an. Die
Ampel blieb gelb — „nicht bestätigt", ohne einen Hinweis, was fehlt.

Die Bestätigung läuft über die Brevo-API. Ohne `BREVO_API_KEY` läuft der
Abgleich nie: 10.431 Mails in 30 Tagen, 0 abgeglichen, 0 von 35 Zweigen
bestätigt.

**Eine Anzeige muss zwischen „es ist kaputt" und „ich kann es nicht messen"
unterscheiden.** Sonst sucht jemand einen Fehler, den es nicht gibt. Der Satz,
der den Unterschied macht, gehört ÜBER die Marken: „Die gelben Marken bedeuten
nicht, dass Zweige fehlen. Sie bedeuten: Wir können es nicht nachprüfen."

## Zwei Navigationseinträge mit demselben Zeichen sind einer zu viel

„Mail-Zentrale" und „E-Mail-Events" trugen beide `Send` aus lucide-react, direkt
untereinander. Die eine verschickt Freitext, die andere PRÜFT Zweige. Wer schnell
klickt, landet falsch.

Der Typ der Navigation war `typeof LayoutDashboard` — also genau die Bauform
eines lucide-Icons. Eine eigene SVG-Komponente passte nicht hinein, obwohl sie
dieselben Eigenschaften nimmt. **Ein Typ, der nur eine Bibliothek zulässt,
erzwingt die Bibliothek** — und AGENTS.md verlangt das Gegenteil.

## Eine Wartebedingung, die auf das Gerüst passt, wartet nicht

Ein Browsertest wartete auf `/BREVO_API_KEY|E-Mail-Events|Ereignis/`. Der
Ausdruck traf „E-Mail-Events" im MENÜ — das steht sofort da, lange vor den
Daten. Sechs Prüfungen wurden rot; dieselben Prüfungen auf 380 px waren grün,
weil das Menü dort eingeklappt ist.

**Auf eine Marke im INHALT warten**, am besten auf die geprüfte Überschrift
selbst (`getByRole("heading", …)`). Und: **Ein geratener Zugangscode prüft die
Anmeldeseite.** Der Rückfallwert gehört aus dem Quelltext gelesen, nicht
geraten — nur der Screenshot verrät es sonst.

## Eine Spalte ist ein Merker, keine Wahrheit

Am 20.08.2026 stand im Portal „Status: Aktiv · Freigeschaltet" bei einem Kunden
ohne Startgespräch. GEMESSEN: **364 von 365** bezahlten Bestellungen zeigten das,
und **null** davon hatte je ein Startgespräch geführt.

Es gab drei Quellen für „ist dieser Kunde freigeschaltet": `account_status`
(heißt nur „nicht gesperrt"), die Spalte `onboarding_stufe`, und einen
Statustext über die Zahlung. Drei Quellen, drei Wahrheiten.

- **Zustände, die sich ausrechnen lassen, werden AUSGERECHNET.** „Bezahlt und
  Gespräch erledigt" ist eine Rechnung, kein Wert, den man speichert und hofft.
- Wo eine Abschrift aus Geschwindigkeitsgründen nötig ist (Listen mit 360
  Kunden), ist sie ausdrücklich eine ABSCHRIFT: Ein Abgleich zieht sie nach, und
  eine Abweichung wird ANGEZEIGT, nicht stillschweigend korrigiert.
- Zwei Fassungen derselben Regel (TypeScript für die Akte, SQL für die Liste)
  sind nur zulässig, wenn ein Prüfstand sie **gegeneinander** hält — an jeder
  Konstellation.

## Eine Migration, die eine Tür zumacht, muss den Schlüssel vorzeigen

Vor der Bestands-Migration auf „wartet_auf_onboarding" fiel auf: Es gab keinen
Mitarbeiter mit der Rolle `onboarding`, und `freieSlots(…, "onboarding_call")`
filtert nach genau dieser Rolle — **null Slots**.

364 zahlende Menschen hätten beim nächsten Login vor einem Pflicht-Gate ohne
Termine gestanden: buchen unmöglich, „Später" abgeschafft, nur noch Abmelden.

- **Ein Lauf, der eine Pflicht einschaltet, prüft VORHER, ob sie erfüllbar ist**
  — und bricht ab, wenn nicht. Auch mit `--schreiben`.
- **Fehlende Personalentscheidungen dürfen das System nicht kaputt machen.**
  Gibt es die zuständige Rolle nicht, tritt ein begründeter Rückfall ein (hier:
  Vertrieb und Leitung stellen die Slots) — protokolliert, damit er nicht
  unbemerkt zum Dauerzustand wird.

## Wer eine Tafel im Vordergrund prüft, misst IN der Tafel

Ein Browsertest prüfte „Karte Bonitätsauskunft da" über den `innerText` des
ganzen Body — und wurde GRÜN durch einen Satz, der im Dashboard **hinter** der
Bühne stand. Die Karte in der Bühne war zu diesem Zeitpunkt noch nicht geladen.

Aufgefallen ist es nur, weil eine zweite Prüfung („die 74 € stehen dabei") ihre
**Fundstelle mit ausgab**.

- **Am Container messen** (`[role="dialog"]`), nicht am Body.
- **Fehlermeldungen nennen den gefundenen Text.** Eine Prüfung, die nur „rot"
  sagt, schickt einen auf die falsche Suche.

## `created_at` sagt nicht, wann eine Zeile verschmutzt wurde

Ein Bereinigungslauf meldete „0 übrig". Zwei Minuten später trug eine Zeile mit
`created_at` von vor zwei Stunden wieder einen Zeilenumbruch.

Die Erklärung: Ein laufender Antrag wird bei **jedem Formularschritt** neu
geschrieben. `created_at` bleibt alt, der Inhalt kommt frisch vom noch nicht
ausgelieferten Client.

- Bestandsprüfungen fragen nach `updated_at` — „wann wurde die Zeile zuletzt
  angefasst", nicht „wann entstand sie".
- Und der Lauf **merkt sich seinen Zeitpunkt** (`fiaon_settings`), statt dass
  der Prüfstand „vor einer Stunde" rät. Eine geratene Grenze hält genau eine
  Stunde.

## Eine Funktion mit `lauf = sqlPool` benutzt vielleicht trotzdem sqlPool

`aboBeiZahlungAnlegen(ref, lauf)` nimmt einen Lauf-Parameter — und schreibt
intern mit `sqlPool`. In einem Prüfstand, der in einer Transaktion arbeitet,
hätte der Aufruf also AUSSERHALB geschrieben: eine echte Testbestellung mit
echten Raten in der Produktionsdatenbank, die kein Rollback entfernt.

Aufgefallen ist es nur, weil dieselbe Funktion zusätzlich DDL macht und in einen
Lock-Timeout lief.

- **Wer in einer Transaktion eine fremde Funktion ruft, liest deren Rumpf** —
  nicht ihre Signatur.
- Ist sie nicht transaktionsfähig, wird ihre Wirkung im Prüfstand
  nachgezogen und ihre Regel am Quelltext plus am echten Bestand geprüft.

## Bekannter Bestand, damit niemand erschrickt

- `npx tsc --noEmit` meldet rund **240 Alt-Typfehler** (u. a. aus
  Dropbox-Konfliktkopien „… in Konflikt stehende Kopie …"). Sie sind Bestand.
  **Neue Dateien müssen fehlerfrei sein**; `target` liegt unter ES2015, deshalb
  `Array.from(map.entries())` statt direkter Map-Iteration.
- `db/migrations/006_service_orders.sql` wird vom Migrationslauf **absichtlich
  verweigert** (enthält DROP). Das „Failed: 1" am Ende ist normal.
- `/admin/hub/badges` braucht kalt rund zehn Sekunden. Bekannt, nicht schön.
