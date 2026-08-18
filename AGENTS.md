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

## SVG schneidet stillschweigend ab — drei Screenshots für ein Schaubild

Beim Bau der Academy-Schaubilder fand jeder Screenshot einen Fehler, den der
Quelltext nicht verrät:

1. Zwei Beschriftungen **überlappten** („336 warten hier“ und „Rate
   offen → Forderungsmanagement“). Beide Koordinaten sahen einzeln plausibel
   aus.
2. Texte **links vom Kreis** liefen über den viewBox-Rand: Aus „Zahlung /
   oder Sperre“ wurde „ung / erre“. SVG wirft keinen Fehler, es
   schneidet ab.
3. Ein Wert für **beide Achsen** (`M = 215` für cx UND cy) schob den Kreis nach
   unten aus dem Feld. Die unteren zwei Marken fehlten.

- **Ein Schaubild ohne angesehenen Screenshot ist nicht geliefert.** Bei Text in
  SVG gilt das doppelt.
- **Ebenen planen, nicht Koordinaten raten.** In den Quelltext gehört, welcher
  y-Bereich wofür ist — sonst kollidiert die nächste Ergänzung wieder.
- **Und der Prüfstand kann etwas messen, das das Auge nicht sieht:**
  `strokeDashoffset === 0` beweist, dass die gezeichnete Linie fertig ist.
  Bliebe der Offset stehen, wäre sie unsichtbar — auf einem statischen Bild
  fällt das niemandem auf.

## Zwei Ansichten desselben Katalogs: exportieren und filtern

Die Vertriebsleitung braucht den Funktionskatalog aus `/admin/funktionen` — ohne
die drei Einträge, die nur die Geschäftsführung entscheidet.

- **Den Katalog EXPORTIEREN und filtern**, nicht kopieren. Eine zweite Fassung
  läuft beim nächsten neuen Eintrag auseinander, und dann schult die Leitung
  eine Funktion, die es nicht mehr gibt.
- **Die Filterregel steht NEBEN dem Katalog**, nicht in der zweiten Ansicht: Wer
  einen Eintrag hinzufügt, sieht die Liste der Ausnahmen und entscheidet mit.
- **Leere Gruppen fallen heraus.** Eine Überschrift ohne Inhalt sieht nach einem
  Fehler aus.

## Eine Route ohne Anzeige ist eine halbe Funktion — zum zweiten Mal

`/admin/academy/stand` lieferte „Academy: Kapitel x/y“ seit dem 28.08. Es
gab nur keine Anzeige. Zwei Tage vorher hatte genau dieses Muster vier Tage
Arbeit blockiert (der Produkt-Knopf).

**Wenn eine Route Daten für eine Anzeige liefert, gehört die Anzeige in denselben
Commit.** Sonst steht im Changelog „liefert die Daten“, und niemand merkt,
dass niemand sie sieht.

## 50 grüne Prüfungen an einer Route beweisen nicht, dass ein Mensch sie erreicht

Am 25.08. entstand die Route „Produkt an bestehende Akte“ mit 50
Prüfungen über echtes HTTP — alle grün. Am 29.08. meldete der Betreiber:
„Agenten klicken auf ‚Produkt anlegen' — es erscheint NICHTS.“

Es gab **keine Oberfläche**. Der Knopf, der zwei Tage später dazukam, war
`<a href="/agent/kunden#anlegen">`: Der Anker existierte nicht, der Mitarbeiter
stand schon auf dieser Seite, und „+ Kunde anlegen“ hätte einen NEUEN
Kunden angelegt.

Das ist wörtlich der Fehler vom 11.08.2026, der weiter oben in dieser Datei
steht. Damals waren es vier Prüfungen. Diesmal fünfzig.

- **Zu jeder Route, die ein Mensch benutzt, gehört im selben Commit ein
  Browsertest, der den Knopf FINDET und DRÜCKT** — und danach am DOM misst, dass
  etwas erscheint.
- **Ein `<a href>` auf die eigene Seite mit einem Anker ist kein Knopf.** Wenn
  etwas aufgehen soll, gehört ein `onClick` daran.
- **Und die Rot-Probe macht die ÖFFNUNG kaputt**, nicht die Logik dahinter. Sonst
  prüft man wieder nur, was schon geprüft war.

## Ein Satz, der rechtlich zählt, steht genau einmal im Code

Die Kernbotschaft über Bonität und SCHUFA-Meldung erscheint an drei Stellen: in
zwei Academy-Reisen und im Onboarding-Cockpit. Als drei Textblöcke wären es
irgendwann drei verschiedene Sätze — und bei einer Aussage über die SCHUFA ist
das kein Schönheitsfehler.

- **Der Wortlaut liegt in `shared/`**, die drei Stellen lesen ihn.
- **Der Prüfstand vergleicht ihn buchstabengetreu** gegen eine ausgeschriebene
  Kopie — nicht mit einem Regex, der Umformulierungen durchlässt.
- **Und er prüft, dass der Satz NICHT in den Anzeige-Dateien steht.** Eine Kopie
  dort wäre die zweite Wahrheit.
- **Freigegebene Formulierungen werden nicht „verbessert“.** Wer sie ändern
  will, ändert sie an der einen Stelle — mit derselben Freigabe.

## Eine Prüfstands-Regel darf ersetzt werden, wenn der Betreiber entscheidet

Der Prüfstand verlangte: „Die Team-Fassung der Academy hat KEINEN
Präsentationsmodus — wer sich selbst einschult, präsentiert nicht.“ Richtig,
solange nur Mitarbeiter sie benutzen. Dann entschied der Betreiber, dass die
Vertriebsleitung selbst schult.

- **Die Regel wird ERSETZT, nicht gelöscht** — mit dem alten Wortlaut im
  Kommentar. Sonst hält der nächste Leser das Fehlen für ein Versehen.
- **Und die neue Regel ist enger, nicht weiter:** Der Modus ist jetzt an
  `istLeitung` gebunden, das der SERVER liefert. Ein Agent sieht den Knopf nicht.

## Ein halber Umzug ist schlechter als keiner

Der Auftrag lautete: 397 Zugriffe auf die Kontakt-Abschriften abarbeiten, dann
die Spalten droppen. Gemessen: 16 schreibende Anweisungen, elf davon in einer
Datei, plus knapp 380 lesende — mehrtägige Arbeit.

**Nicht getan, mit Absicht.** Bei einem halben Umzug schreiben die umgezogenen
Stellen an die Person, die anderen in die Spalte, und niemand weiß mehr, welcher
Wert gilt. Genau diese Lage hat Migration 059 beendet. Und der Fehler zeigt sich
nicht beim Deploy, sondern erst, wenn ein Kunde einen Antrag abschickt.

- **Wenn ein Umbau nicht in einem Zug geht: die WAND bauen, nicht die Hälfte.**
  `pruef-eine-quelle-wand.ts` hält die Zahl fest — neue Stellen werden rot, der
  Bestand ist geduldet.
- **Obergrenze statt Verbot.** Eine Wand, die 397 Fehler meldet, wird nach dem
  zweiten Lauf abgeschaltet — und fängt dann auch die 398. nicht.
- **Und die DROP-Anweisung als Kommentar in die Migration**, mit der Bedingung
  daneben. Dann muss sie niemand neu erfinden, und niemand führt sie zu früh aus.

## Ein Prüfstand findet zuerst die eigenen Fehler

Am ersten Tag nannte die neue Wand 18 schreibende Stellen — **zwei davon waren
meine** aus der Woche davor (`phone_country_code: ''` in einer Spalte, die
verschwinden soll).

Wer eine Regel aufstellt, ist der erste, der sie bricht. Deshalb: **Die Wand
sofort laufen lassen, nicht erst nach dem nächsten Umbau.**

## `DROP COLUMN` gehört auf die Sperrliste

Der Migrationsläufer verweigerte DROP TABLE, DROP DATABASE und TRUNCATE — aber
nicht DROP COLUMN. Eine gelöschte Spalte ist genauso endgültig, nur
unauffälliger: Der Deploy läuft durch, und der Fehler zeigt sich beim nächsten
Kunden.

`ALTER … DROP CONSTRAINT` bleibt erlaubt: Eine Bedingung zu lösen ist umkehrbar,
Daten zu löschen nicht.

## Zwei Dateien mit fast gleichem Namen: eine muss weg

`pages/agent/kunden.tsx` lag unter `/agent/meine-kunden-alt`, während
`/agent/kunden` längst `kunden-neu.tsx` zeigte. Am 25.08. wurden ein Knopf und
eine Notizpflicht in die falsche gebaut — erst ein Screenshot verriet es.

- **Die alte Datei entfernen, die Adresse umleiten.** Ein Lesezeichen soll nicht
  ins Leere laufen, aber auch nicht auf einen Stand von vor drei Wochen.
- **Und die Falle in `docs/GESAMTSTAND.md` vermerken**, solange sie besteht.

## Eine Filterregel gehört in `shared/`, auch ohne Aufrufer

`reisenFuerRolle` stand seit dem 26.08. in `shared/fiaon-academy.ts` und wurde
nicht benutzt — der Auftrag lautete ausdrücklich „vorbereiten, nicht
ausrollen“. Zwei Tage später brauchte die Team-Route sie, und es war eine
Zeile.

Wer die Regel in der Seite gebaut hätte, hätte sie beim Ausrollen ein zweites
Mal geschrieben — und dann gehen zwei Fassungen auseinander.

## Ein Tageslauf, der nichts findet, ist Arbeit ohne Ergebnis

`datenkosmetik-lauf.ts` sollte in den Tageslauf. Gemessen: **0 von 11.578**
Feldern brauchen eine Reinigung. Der Leerraum entstand an Formulareingaben, und
dort wird jetzt getrimmt.

**Erst messen, ob ein Automatismus etwas zu tun hätte.** Ein täglicher Lauf über
11.578 Zeilen ohne Fund kostet Zeit und erzeugt Log-Rauschen, in dem echte
Meldungen untergehen.

## Eine Zuordnung über einen Text, den wir nicht schreiben, ist eine Vermutung

Die Zweig-Ampel ordnete Brevo-Ereignisse über den BETREFF einem Ereignis zu.
Der Betreff steht aber in der Brevo-Vorlage — deutsch, kundenfreundlich, von
Hand gepflegt. GEMESSEN: 305 gefundene Ereignisse, „keins passte zum
Betreff“, alle Mails angekommen.

- **Ein eigenes Kennzeichen mitgeben, statt fremden Text zu deuten.** Hier:
  eine Plus-Adresse je Ereignis (`dev+welcome@…`, RFC 5233). Alles landet im
  selben Postfach, aber der Protokolleintrag ist eindeutig.
- **Und prüfen, ob die Suche das Kennzeichen findet.** Brevos `?email=`-Filter
  vergleicht EXAKT — die Suche nach der Basisadresse hätte keine einzige
  Plus-Adresse geliefert, und die Ampel wäre dauerhaft rot geblieben.
- **Wenn ein Kennzeichen Nebenwirkungen haben kann, gehört ein Hinweis in die
  Oberfläche.** Manche Postfächer werfen Plus-Adressen weg: Dann wird die Ampel
  grün, während nichts ankommt. Das muss dastehen, sonst sucht der Betreiber am
  falschen Ende.

## Ein gesperrter Knopf ohne sichtbaren Grund ist ein Rätsel

Daniel Stripling: „Ich kann die Zahlungsdaten nicht jedem schicken.“
GEMESSEN an 600 Personen: 123 sendbar, 477 gesperrt — und in den meisten Fällen
ZU RECHT. Der Grund stand im `title`-Attribut, und einen Tooltip sieht auf dem
Telefon niemand.

- **Der Grund steht als TEXT am Knopf**, nicht im Tooltip.
- **Und der nächste Schritt daneben.** Bei fehlender E-Mail das Eingabefeld
  direkt dort: 165 der 477 Fälle lösen sich mit einer Eingabe. Ein
  Seitenwechsel für ein Feld ist die häufigste Stelle, an der jemand aufgibt.
- **Vor der Regeländerung messen.** Der Auftrag lautete „claimed_paid
  freigeben“ — die Regel ließ es längst durch. Ohne Messung hätte ich eine
  funktionierende Bedingung „reparieren“ können.

## Ein Bestandslauf, den ein Mensch aufrufen muss, wird vergessen

Der Wartezustand-Nachlauf hat am 24.08. sieben Fälle nachgetragen. Drei Tage
später standen ZWEI wieder da: alte Wiedervorlage fällig, kein Wartezustand.

- **Wiederkehrende Bestandskorrekturen gehören in den Tageslauf**, über die
  Registratur (`tageslauf(...)`), nicht als Skript zum Erinnern.
- **Und sie müssen idempotent sein** — der Prüfstand ruft sie ZWEIMAL in einer
  zurückgerollten Transaktion. Ein Nachlauf, der bei jedem Aufruf schreibt,
  verschiebt Wiedervorlagen endlos nach hinten.

## Ränder zurücksetzen macht keine Seite randlos

Der Präsentationsmodus sollte die Verwaltungshülle loswerden.
`margin: 0; max-width: none` an `main` und der Bühne — und sie blieb 1200 px
breit bei 1440 px Fenster. Der begrenzende Container war ein `div` DAZWISCHEN.

- **`position: fixed; inset: 0`** löst das Element aus dem Fluss; dann ist jeder
  Vorfahre gleichgültig. Jeden einzeln zu treffen wäre ein Ratespiel über
  fremdes Markup.
- **Und der Screenshot zeigt, was noch übrig ist.** Bei mir schwebte das
  Softphone über der Bühne — ein Präsentationsmodus, in dem Bedienelemente
  herumliegen, ist keiner.
- **Die Optik lösen, den Schutz lassen:** Die Zugangsschleuse sitzt in
  `AdminShell`. Sie rendert weiter und prüft weiter; nur ihre Teile sind per
  CSS versteckt.

## Ein Prüfstand darf keine Zahl abschreiben

Drei Browserprüfungen enthielten „15 Kapitel“. Mit einem
Abschluss-Kapitel wurden es 16 — drei rote Prüfungen, obwohl alles stimmte.

**Die Zahl aus den DATEN holen** (`reise("onboarding").kapitel.length`). Eine
Prüfung, die eine Zahl abschreibt, wird bei jeder Erweiterung rot — und dann
schaltet sie jemand ab.

## Ein `[^;]*` frisst Zeilenumbrüche

Eine Prüfung suchte `animation:[^;]*\b(top|left|height|width)\b` und traf das
`width:` einer ganz anderen CSS-Regel zwei Zeilen weiter. Wer innerhalb einer
Zeile sucht, schreibt `[^;\n]*`.

## Eine Zahl, die niemand sieht, ändert nichts

Die Termin-Zentrale zeigte am ersten Tag: Zwei Mitarbeiter hatten bei 50
vergangenen Terminen KEINEN EINZIGEN als erledigt markiert (No-Show 64 %% und
76 %%), zwei andere 67 %% und 78 %%. Die Daten lagen seit Wochen in
`fiaon_termine` — es gab nur keine Ansicht.

- **Eine Auswertung je Mensch, nebeneinander.** Eine Quote allein sagt wenig:
  Sie kann niedrig sein, weil viele Termine in der Zukunft liegen. 0 %% neben
  78 %% ist eine Aussage.
- **Quoten nur über VERGANGENES rechnen.** Ein Termin morgen ist weder erledigt
  noch verpasst.
- **Bernstein, nicht Rot.** Eine Farbe, die anklagt, erzeugt Ausreden statt
  Ursachen. Und der Text sagt ausdrücklich, dass ein Gespräch nötig ist, kein
  Programm.

## Ein Massenversand braucht die Grenze VOR dem Klick

336 bezahlte Kunden ohne Termin. Der erste Entwurf nannte die Tagesgrenze von
50 erst IN der Vorschau — wer einen Knopf „alle einladen“ sieht und 336
Kunden kennt, rechnet mit 336 Mails und traut sich nicht zu drücken.

- **Die Staffel und ihre Grenze stehen neben dem Knopf**, nicht dahinter.
- **Vorschau mit Namen und Zahl**, erst dann der Versand.
- Und der Beweis-Lauf fängt den Versand ab: Ein Screenshot-Lauf darf keine 50
  echten Mails auslösen.

## Ein Knopf mit 7 %% Deckkraft sieht deaktiviert aus

Die Einladungsknöpfe standen auf `background: ACCENT12`. Im Screenshot wirkten
alle 25 ausgegraut — ein Knopf, den man für inaktiv hält, wird nicht gedrückt,
und die Funktion ist so gut wie nicht vorhanden.

**Weißer Grund mit Rahmen in Akzentfarbe**: klarer Kontrast, ohne die Liste zu
übertönen. Und `disabled` muss SICHTBAR anders sein als aktiv, nicht ähnlich.

## Für eine Schulung: der Weg statt des Bildes

Die Academy sollte die echte Oberfläche zeigen — eingebettet oder als
Build-Screenshot. Beides verworfen:

- **Einbettung** braucht Anmeldung, Kundendaten und Zustand. Ein Kapitel über
  das Onboarding-Cockpit müsste einen echten Menschen ins Schulungsbild laden.
  Und jede Änderung an der Komponente kann die Schulung weiß machen.
- **Build-Screenshots** brauchen einen angemeldeten Server IM Build, veralten
  lautlos und zeigen echte Kundennamen. Ein Bild, das seit drei Wochen falsch
  ist, schult falsch — und niemand merkt es.
- **Gewählt: die echte Route nennen und im neuen Tab öffnen.** Der Betreiber
  führt am echten System vor. Der Prüfstand gleicht jeden genannten Weg gegen
  `App.tsx` ab — drei tote Pfade fand er sofort.

## Schulungstexte kommen aus derselben Datei wie die Oberfläche

Die sieben Onboarding-Schritte in der Academy sind KEINE Kopie: Sie werden aus
`shared/fiaon-onboarding-agenda.ts` importiert — derselben Datei, die das
Cockpit benutzt. Der Prüfstand verbietet das Abschreiben ausdrücklich.

Eine Schulung, die eine Kopie zeigt, schult nach der ersten Änderung den alten
Stand. Und niemand merkt es, weil beide Texte „irgendwie richtig“ klingen.

## Bewegung abschalten heißt abschalten, nicht drosseln

Auf einer scroll-getriebenen Seite ist Bewegung ein Ausschlussgrund. Bei
`prefers-reduced-motion` gilt deshalb:

- `animation: none !important` und `transition: none !important` — keine
  langsameren Animationen. Eine gedrosselte Animation ist immer noch Bewegung.
- **Auch das Gleiten beim Springen**: `scrollIntoView` mit `behavior: "auto"`
  statt `"smooth"`.
- **Und die Inhalte müssen sichtbar bleiben.** Wer den Eintritt über `opacity: 0`
  animiert und nur die Animation abschaltet, zeigt eine leere Seite.

## Wer die Abwesenheit von Code prüft, schließt Kommentare UND Anzeigetext aus

Zweimal in zwei Tagen: Eine Prüfung suchte „provision“ und traf den
Kommentar, der erklärt, dass hier keine gebucht wird. Am nächsten Tag suchte
eine nach „autoplay“ (mit `/i`) und traf den sichtbaren Satz „Kein Ton,
kein Autoplay“ — also genau die Zusage, die sie prüfen sollte.

- **Kommentarzeilen herausfiltern**, bevor man auf Abwesenheit prüft.
- **Und auf die genaue Schreibweise achten:** JSX-Attribute sind camelCase
  (`autoPlay`). Mit `/i` trifft man deutschen Anzeigetext mit.

## Zwei Dateien mit fast gleichem Namen — welche bedient die Route?

Der Anlage-Knopf entstand in `client/src/pages/agent/kunden.tsx`. Die Route
`/agent/kunden` zeigt aber `kunden-neu.tsx`; die alte liegt unter
`/agent/meine-kunden-alt`. Der Browsertest fand den Knopf nicht — und erst der
SCREENSHOT zeigte, dass eine völlig andere Seite geladen war.

Dabei fiel auf: Ein Befund vom Vortag („der Listen-Weg hat keine
Notizpflicht“) betraf ebenfalls die alte Datei. Die echte Seite hatte sie
längst.

- **Vor jeder Änderung an einer Seite: `grep` in `App.tsx`**, welche Datei die
  Route bedient. Zwei Befehle.
- **Ein Befund an einer Datei, die niemand lädt, ist kein Befund.** Er sieht nur
  wie einer aus — und die Reparatur wirkt nirgends.

## Ein Prüfstand darf über Läufe hinweg nicht dieselben Merkmale benutzen

`pruef-vollpfleger.ts` legte in jedem Lauf einen Kunden mit derselben Rufnummer
an. Ab dem zweiten Lauf hängte die Anlage die Bestellung an die Person des
ERSTEN — dieselbe Nummer, derselbe Mensch, völlig richtig.

Nur war diese Person vom Aufräumen als Testperson markiert, und die
Dublettensuche überspringt Testpersonen (auch richtig: ein Testdatensatz darf
keine echte Anlage blockieren). Ergebnis: Der Check fand nichts, HTTP 200 statt
409, fünf Prüfungen rot.

- **Merkmale je Lauf einmalig machen** (Zeitstempel in Nummer und Adresse).
- Ein Prüfstand, der beim zweiten Mal etwas anderes prüft als beim ersten, ist
  kein Prüfstand.

## Ein stilles `.catch()` kostet zwei Durchläufe

Beim Onboarding des Prüf-Testkontos: erst die falsche Tabelle
(`fiaon_agent_contract_templates`), dann die falsche Spalte (`active` statt
`status`). Beide Fehler landeten in einem `.catch(() => [])`, und der Prüfstand
meldete „keine aktive Vertragsvorlage“ — statt zu sagen, dass die Abfrage
kaputt ist.

- **Ein `.catch()` um eine Abfrage schreibt den Fehler mit**, wenigstens auf die
  Konsole. Sonst verwandelt es einen Programmfehler in eine falsche Auskunft.

## Ein Bauteil, das ein Browsertest prüft, braucht ein Kennzeichen

`locator("select").first()` traf die Sortier-Auswahl der Seite,
`getByPlaceholder("E-Mail")` zusätzlich das Suchfeld („Name, E-Mail, Nummer,
Referenz“). Zwei Fehlalarme, die wie Fehler aussahen.

- **`data-fiaon="…"` am Bauteil**, und der Test sucht darin. Dieselbe Lehre wie
  bei der Bühne im Vordergrund (20.08.2026): Wer eine Tafel prüft, misst IN der
  Tafel.

## Wer am Telefon arbeitet, kann nicht die Seite wechseln

Der Agent hat den Menschen in der Leitung. Anlegen, Zahlungsdaten, Termin —
das sind für ihn EIN Vorgang, nicht drei Seiten.

- **Ein Erfolgs-Dialog, der offen bleibt und die nächsten Schritte anbietet**,
  ist mehr wert als drei perfekte Einzelseiten.
- **Und jede Aktion braucht beide Wege: senden UND kopieren.** Viele Kunden
  bekommen die Daten über WhatsApp; ohne Kopierknopf tippt der Agent den
  Verwendungszweck ab und vertippt sich.

## Vor dem Bauen prüfen, ob es benutzt wird

Ein Auftrag lautete: „team-calendar.tsx (3.870 Zeilen, grid-cols-7) unter
768 px als Kartenliste“. Die Messung danach:

- `TeamCalendar` wird in KEINER Seite eingebunden — kein Import, nirgends.
- Die Tabelle `team_calendar` dahinter hat **0 Einträge**.
- Die echten Termine liegen in `fiaon_termine`: **120 Stück**.

Eine Mobil-Fassung für eine leere, nicht eingebundene Ansicht ist Arbeit, die
niemand sieht.

- **`grep` auf den Komponentennamen, bevor man ihn anfasst.** Zwei Befehle, und
  sie entscheiden über Stunden.
- **Und die Tabelle zählen.** Eine Ansicht ohne Daten hat kein Darstellungs-
  problem.
- Der KERN der Bitte gilt weiter („Termine am Telefon lesbar“) — nur für
  die richtigen Daten. Das Bauteil wurde datenquellen-frei gebaut, damit die
  Termin-Zentrale es benutzen kann.

## Eine Pflicht in der Oberfläche ist keine Pflicht

„Erreicht — Sonstiges“ braucht eine Notiz. Die Pflicht stand in
`Softphone.tsx` und in `kunden-neu.tsx` — aber NICHT im Listen-Weg
(`kunden.tsx`) und in keinem Fall im Server. Der Listen-Weg kam ohne Notiz
durch, und jeder direkte Routen-Aufruf ebenfalls.

- **Eine Regel, die drei Oberflächen einzeln kennen müssen, wird an der vierten
  vergessen.** Sie gehört in den Server, einmal — dieselbe Regel wie bei
  Filterbedingungen (`WHERE`, nicht Anzeige).
- Die Oberfläche muss sie dann nicht ERZWINGEN, aber SAGEN: Zeichenzähler und
  Begründung. Eine Sperre ohne Erklärung ist eine Sackgasse.
- **Und genau eine Pflicht, nicht mehr.** Jede weitere Hürde erzeugt
  Ausweichverhalten: Dann klickt jemand „nicht erreicht“, weil das
  schneller geht — und die Statistik ist verdorben.

## Ein Datum im CSV muss eine Tabellenkalkulation lesen können

Der Export schrieb `z.created_at` direkt: `Mon Aug 17 2026 18:39:09 GMT+0200
(Central European Summer Time)`. Excel nimmt das als Text — Sortieren nach Datum
geht nicht, und der halbe Nutzen des Exports ist weg.

- **`TT.MM.JJJJ HH:MM` in Europe/Berlin**, über `Intl.DateTimeFormat`.
- **Semikolon als Trennzeichen** (deutsches Excel) und **BOM** voranstellen,
  sonst stehen Umlaute als Buchstabensalat.
- **Der Export folgt den Filtern der Anzeige.** Wer nach einem Empfänger
  gefiltert hat, will DIESE Zeilen — nicht alles.

## Ein Protokoll ist zum Nachsehen da, nicht zum Ausleiten

Beim Aufklappen einer Protokollzeile lag es nahe, die ganze Nutzlast zu zeigen.
Sie enthält IBAN, Geburtsdatum und Rechnungs-Links mit Kennung.

- **Weißliste statt Schwarzliste:** Nur bekannte, harmlose Felder werden
  gezeigt. Eine Schwarzliste vergisst das nächste sensible Feld.
- **Und die Zahl der verborgenen dazu** („6 weitere Felder (nicht
  angezeigt)“) — sonst wirkt der Auszug vollständig, und niemand fragt nach.

## Wer eine Reihenfolge im Quelltext prüft, schneidet den Block heraus

Eine Prüfung verglich `indexOf("const notizFehler")` mit
`indexOf("const entry = await logAction")` über die GANZE Datei. Das zweite
Muster kommt dreimal vor, und der erste Treffer stand 120 Zeilen weiter oben in
einer anderen Route. Die Prüfung wurde rot, obwohl der Code stimmte.

Erst den relevanten Ausschnitt herausschneiden (`slice` ab der Routendefinition),
dann darin vergleichen.

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
