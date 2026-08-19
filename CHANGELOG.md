# FIAON — Änderungsprotokoll (Klartext)

Jede Änderung am System bekommt hier einen Eintrag im selben Commit:
**Datum · Was geändert · Warum · Wo zu finden.** Verständlich für Nicht-Entwickler.

---

## 19.08.2026 (Nacht) — Neun Punkte aus Vertrieb und Onboarding

Ein Feedback mit neun Meldungen. Drei davon waren **Wiedergänger** — schon
einmal „behoben", vom Team nie gesehen. Bei denen steht unten ausdrücklich, wo
der alte Fix lag und warum er unsichtbar blieb.

### Teil 1 — „Der Antrag steht noch im Formular", obwohl er fertig ist

**Die Meldung:** „Es ist nicht ersichtlich, welche Information noch fehlt oder an
welcher Stelle der Antrag noch fertiggestellt werden soll."

**GEMESSEN** (`scripts/mess-rechnung-blockade.ts`): 402 Personen trugen den
Sperrgrund „Antrag im Formular", 475 Anträge. Aufgeteilt nach Zustand:

| Zustand | Schritt | Anzahl | inhaltlich |
|---|---|---|---|
| `started` | 9 | 23 | **VOLLSTÄNDIG** |
| `payment_completed` | 9 | 1 | **VOLLSTÄNDIG** |
| `contract` | 6 | 216 | Mail + Zusagen fehlen |
| `finances` | 2 | 165 | ab Schritt 2 leer |
| `config` | 3 | 42 | ab Schritt 3 leer |
| `personal_data` | 1 | 28 | ab Schritt 1 leer |

**25 Anträge tragen JEDES Pflichtfeld** — alle drei Zusagen, E-Mail,
Gehaltseingangstag, vollständige Stammdaten — und wurden trotzdem blockiert. Das
ist Daniels Meldung in einer Zahl.

**Die Ursache** stand in `client/src/pages/antrag.tsx`, Zeile 696:

```js
["started","personal_data","finances","config","verifying",
 "approved","contract","processing","completed"][step] || "started"
```

Die Liste hat NEUN Einträge, also die Indizes 0 bis 8. Das Formular hat einen
Schritt 9 — die Passwortseite nach dem Absenden. `[9]` ist `undefined`, und dann
greift `|| "started"`: **Der letzte Schritt des Formulars schrieb den ersten
Zustand.** Und zwar unmittelbar nachdem `handleProceedToPayment` korrekt
`submitted` gespeichert hatte — `setStep(9)` löste den Effekt aus, der es
überschrieb. Ein Rückfallwert, der auf den ANFANG zeigt, ist bei einem
Fortschritt immer falsch.

**Behoben zweifach:**

1. Die Zuordnung steht in `shared/fiaon-antrag-schritte.ts`, mit einem Zustand
   für jeden Schritt und einem Rückfall auf den HÖCHSTEN statt den ersten. Der
   Schreibfehler kann nicht wiederkommen. Das `.catch(() => {})` an dieser
   Speicherung ist weg — ein verlorener Schritt landet jetzt in der Konsole.
2. Der Zustand wird aus dem INHALT abgeleitet:
   `server/lib/fiaon-antrag-vollstaendig.ts` führt die 19 Pflichtfelder des
   Formulars in EINER Liste, mit einer TypeScript- und einer SQL-Fassung.
   `sendeGrundSql` gilt damit auch als rechnungsreif, wenn alle Felder da sind —
   egal welcher Klick zuletzt ankam.

**Bestand nachgezogen** (`scripts/antrag-zustand-nachziehen.ts --schreiben`):
**35 von 35** Anträge auf `submitted` gesetzt, alle bei `current_step = 9`, alle
fünf Betreuer betroffen (einer davon der Betreiber selbst). Zählprobe vorher:
TypeScript- und SQL-Fassung stimmten bei allen Treffern überein.

**Und die Karte sagt jetzt, was fehlt:** statt „ruf an und hilf beim
Fertigstellen" steht dort „Es fehlt: Geburtsdatum, IBAN" plus ein Knopf
„Fehlendes am Telefon ergänzen". Die Namen sind Klartext, keine Spaltennamen.

### Teil 2 — „Rechnung stellen & senden": nichts passiert, keine Meldung

Vier Stellen, an denen ein Ausgang unsichtbar blieb:

1. **`server/routes/fiaon-agent.ts`** sendete die Zahlungsdaten-Mail mit
   `sendMakeWebhook(...).catch(() => {})` — **nicht abgewartet und Fehler
   verworfen** — und antwortete danach in JEDEM Fall `ok: true`. Der Agent sah
   eine Bestätigung, der Kunde bekam nichts. Jetzt wird abgewartet, der Grund
   übernommen und im Fehlerfall HTTP 502 mit Klartext geantwortet.
2. **Der Bestätigungsdialog schloss sich VOR der Auswertung.** `setBestaetigen(false)`
   stand vor `if (r.ok)`. Bei einem Fehler verschwand das Fenster, und übrig
   blieb ein Kurzhinweis, der nach Sekunden geht. Jetzt bleibt der Dialog OFFEN
   und trägt den Grund; nur der Erfolg schließt ihn — und lädt den Verlauf
   sofort nach, damit der Vorgang sichtbar in der Karte steht.
3. **Ein gesperrter Sende-Knopf ohne Grund.** War `moeglich: false` und
   `hinweis: null`, sah der Agent einen grauen Knopf ohne ein Wort dazu; der
   Grund stand im `title`. Jetzt gibt es in jedem Sperrfall einen Satz.
4. **`RechnungBestaetigung.tsx`** verschluckte drei verschiedene Lagen (kein
   Netz, 403, HTTP 500 mit HTML) in einem Sammelsatz. Jetzt nach Verursacher
   getrennt.

**Ein Zähler, der nie zählte:** `fiaon-rechnung-stellen.ts` fragte
`fiaon_mail_log` nach `status = 'ok'`. GEMESSEN über die ganze Tabelle: 14.621
„versandt", 215 „uebersprungen", 141 „fehlgeschlagen" — und **null** „ok". Die
Spalte kennt diesen Wert nicht. `letzteRechnung` war also immer leer; kein Agent
hat je gesehen, dass einem Kunden schon eine Rechnung geschickt wurde.

**Das Zustellprotokoll, sieben Tage:** 741 Zahlungsdaten-Mails und 63
Erinnerungen angenommen, **2 fehlgeschlagen** (einmal fehlende
`MAKE_WEBHOOK_URL`, einmal keine zustellbare Adresse). Der Verdacht „kommt beim
Kunden nicht an" ist mit Versandfehlern **nicht** erklärbar. Wichtig zum
Verständnis: „versandt" heißt, dass WIR übergeben haben — nicht, dass zugestellt
wurde. Die verschluckten Fehler oben erklären, warum ein Klick ohne jede Spur
bleiben konnte.

### Teil 3 — „Erreicht – Sonstiges" (DRITTE Meldung) · WIEDERGÄNGER

**Wo der alte Fix lag und warum das Team ihn nie sah:**

| Commit | Datum | Was |
|---|---|---|
| `125d37b` | 24.08. | `braucht: "notiz"` + Klick-Zweig in `kunden-neu.tsx` (+25 Zeilen) |
| `86106a3` | 25.08. | Notizpflicht in den Server **+ 58 Zeilen Oberfläche in `kunden.tsx`** |
| `e71abfc` | 28.08. | `kunden.tsx` gelöscht — **mit den 58 Zeilen** |

Der zweite Fix baute das Textfeld, den Zeichenzähler und die Sperre vollständig
— in `client/src/pages/agent/kunden.tsx`. Diese Datei lag unter
`/agent/meine-kunden-alt`; die Route `/agent/kunden` zeigt seit Wochen
`kunden-neu.tsx`. Drei Tage später wurde sie beim Aufräumen entfernt, und der
Fix ging mit ihr.

In `kunden-neu.tsx` blieb der Klick-Zweig von Fix 1 stehen:

```js
if (e.braucht === "notiz") {
  if (!notiz.trim()) { setFeldOffen("notiz"); return; }   // ← Zeile 1498
  void ergebnis(e.art);
}
```

`feldOffen` kannte den Wert „notiz" (Zeile 630). Gerendert wurden
`feldOffen === "zusage"` (1527) und `=== "termin"` (1540) — **für „notiz" gab es
keinen Block**. Der Klick setzte also einen Zustand, den kein Bauteil liest, und
kehrte zurück: keine Anfrage, kein Feld, keine Meldung. Auch in der Konsole war
nichts zu sehen, weil nie etwas ans Netz ging. Das einzige Notizfeld lag
eingeklappt unter „Details, Stammdaten und Verlauf".

Und die Liste der Ergebnisse stand an **fünf** Stellen, jede mit eigenem Stand —
darunter `kontakt-ergebnis.tsx`, in der „erreicht_sonstiges" **gar nicht
vorkam** (dieser Export wurde von niemandem importiert; eine Recherche findet
ihn und reparariert ins Leere).

**Die strukturelle Antwort:**

- `shared/fiaon-kontakt-ergebnis-liste.ts` — Werte, Beschriftungen,
  Notizpflicht, Mindestlänge und `pruefeNotiz` an EINER Stelle. Server und
  Oberfläche lesen sie.
- `client/src/components/agent/ErgebnisWahl.tsx` — EIN Bauteil mit Knöpfen,
  Pflicht-Notizfeld, Zeichenzähler, den vier Beispiel-Vorlagen aus Daniels
  Meldung und sichtbarem Fehler. Es verlangt vom Aufrufer einen **Ausgang**
  (`Promise<ErgebnisAusgang>`), kein `void` — ein stiller Aufruf ist damit nicht
  mehr baubar.
- `feldOffen` ist entfernt, auch aus dem Typ: Ein Wert ohne Anzeige lädt den
  nächsten Leser ein, ihn wieder zu setzen.
- Das Softphone liest dieselbe Liste (es hatte acht statt neun Werte und die 10
  als Zahl im Quelltext), behält aber seine Gerätedarstellung.

### Teil 4 — Vielfach nicht erreichte Kunden bleiben oben

**GEMESSEN** (`scripts/mess-ruhe-staffel.ts`): **26 Personen mit neun und mehr
erfolglosen Versuchen** standen in der Arbeitsliste, Spitze 20.

| Versuche | Personen | davon mit Ruhe-Marke |
|---|---|---|
| 4 | 133 | 125 |
| 9 | 14 | 0 |
| 10 | 15 | 1 |
| 12 | 4 | 1 |

Bei vier Versuchen greift die Automatik fast immer, ab neun praktisch nie. Zwei
Ursachen in `server/lib/fiaon-nicht-erreicht.ts`:

1. **Die Ruhe war ein einmaliger Schlummer.** Die Bedingung lautete
   `versuche >= 4 && !p.ruhe_seit` — sie feuert also GENAU EINMAL. Nach 14 Tagen
   lief die Wiedervorlage ab, der Fall kam zurück, und weil `ruhe_seit` nun
   gesetzt war, ruhte er nie wieder. Jeder weitere Fehlversuch zählte hoch und
   änderte nichts.
2. **Stufe A war dauerhaft ausgenommen.** 77 der 221 Personen mit vier und mehr
   Versuchen sind Stufe A — und genau 77 hatten keine Ruhe-Marke. Die Ausnahme
   war als Schutz gedacht und wurde zum Dauerzustand.

**Neue Staffel** (mit dem Betreiber abgestimmt): ab dem 3. Versuch +3 Tage, ab
dem 6. +7 Tage und Terminlink-Mail, ab dem 9. **Ruhend** — ohne Ablaufdatum,
raus aus der Tagesliste, sichtbar unter dem Filter „Ruhend" (existiert samt
Zähler). Sie greift bei JEDEM Fehlversuch neu.

**Der Ausweg ist verifiziert:** `buchungAnwenden`
(`server/lib/fiaon-termine.ts`) setzt bei einer Terminbuchung
`unreachable_count = 0, ruhe_seit = NULL` und die Wiedervorlage auf den Termin.
Wer selbst bucht, ist sofort zurück.

**Bestand nachgezogen** (`scripts/ruhe-staffel-nachziehen.ts --schreiben`): 228
Wiedervorlagen gestreckt. **Zählprobe 0** — die Tagesliste enthält keinen Kunden
mit neun oder mehr Versuchen ohne Termin.

> **Hinweis an den Betreiber:** Die neue Regel nimmt auch Stufe-A-Kunden
> (gemeldete Zahlung) nach neun Fehlversuchen aus der Tagesliste. Das ist die
> Folge davon, die Ausnahme zu streichen, und es ist beabsichtigt — sie stehen
> unter „Ruhend" und kommen bei jeder Meldung zurück. Wer das anders will, sagt
> es; die Grenze steht an einer Stelle.

### Teil 5 — Termin-Art fehlt in der Team-Ansicht · WIEDERGÄNGER

**Wo der alte Fix lag:** `shared/fiaon-termin-art.ts` gibt es seit dem 30.08.,
und die Marke ist an **fünf** Stellen sichtbar — Kalender, Termin-Zentrale,
Startgespräch-Liste, fällige Rückrufe, Onboarding-Liste.

**Warum das Team ihn nie sah:** Die sechste Anzeige ist die obere Leiste auf
`/agent/start` — die Seite, die ein Vertriebsmitarbeiter den ganzen Tag offen
hat. Ihre Route `GET /agent/termine` lieferte als einzige **kein Art-Feld**, nur
die rohe `quelle`. Und die „Vereinbarten Rückrufe" daneben ebenfalls nicht.

Behoben: Beide Routen liefern `terminArt`/`terminArtText`/`terminArtTon`, und
`start.tsx` zeigt den Chip — Onboarding blau-türkis, Vertrieb blau, Rückruf
grau. Der Weg („vom Kunden gewählt") bleibt daneben stehen, nicht anstelle der
Art. GEMESSEN: In 60 Tagen tragen die Termine zwei Quellen,
`nichterreicht_mail` (152 → Vertrieb) und `onboarding_call` (24 → Onboarding) —
die Unterscheidung ist also genau die, die gefehlt hat.

### Teil 6 — Kundenakte der Vertriebsleitung: weißes Fenster

Im Browser als `vertriebsleiter` nachgestellt (`scripts/schau-neun-punkte.ts`).
Der Screenshot zeigt keine weiße, sondern eine **hellgraue Fläche mit einem
blassen Ring** — und später die Seite mit Titel, Reitern und Tabellenkopf, unter
dem dauerhaft graue Balken stehen. Keine Meldung, kein Fehler in der Konsole.
Vier Stellen, alle dieselbe Fehlerklasse:

1. **`AgentShell`** zeigt diesen Ring, solange `onboardingComplete === null` ist
   — **ohne Zeitgrenze und ohne Fehlerweg**. Antwortet `/agent/me` oder
   `/agent/onboarding` nicht, dreht er für immer. Jetzt: nach zwölf Sekunden eine
   Karte mit Klartext und zwei Knöpfen.
2. **`useZusage`** rief `setGeprueft(true)` NACH dem `await` und ohne
   Absicherung. Wirft `fetch`, bleibt `geprueft` für immer `false` — und die
   Vertriebsseite lädt nur, wenn es wahr ist. Ein abgebrochener Aufruf legte die
   ganze Seite still. Jetzt `finally`.
3. **Jeder Lader in `vertrieb.tsx`** stieg im Fehlerfall still aus
   (`if (r.ok) setZahlen(…)`, kein `else`). `null` heißt in dieser Anzeige „lädt
   noch" — es gab keinen Zustand für „hat nicht geklappt". GEMESSEN gegen die
   echten Routen: `/agent/vertrieb/personen` und `/service` antworten 403, wenn
   die Verpflichtungserklärung offen ist, und `/agent/vertrieb/zusage` brauchte
   **6,8 Sekunden**. Jetzt eine Meldung mit Grund und „Erneut versuchen".
4. **Die Akte-Schublade** rendert bei `daten.laedt || !p` einen Skelettbalken.
   Antwortet die Route `ok: true` ohne `person`, blieb genau diese leere Karte
   stehen — für immer. Jetzt eine Fehlerkarte mit Grund; und `akteOeffnen`
   schließt die Schublade nicht mehr weg, sondern zeigt den Grund darin.

**Die Wand:** `client/src/components/agent/Fehlerrahmen.tsx` — ein örtlicher
Fehlerrahmen um die Akte. Scheitert sie beim Zeichnen, erscheint eine Karte
(„Die Kundenakte konnte nicht geladen werden — [Grund] — neu laden") statt einer
leeren Fläche, und die Kundenliste dahinter bleibt heil. Nicht die vorhandene
`ErrorBoundary` aus `main.tsx`: Die ersetzt die ganze Seite und zeichnet mit
`lucide-react`, was AGENTS.md verbietet.

**Nebenbefund:** Die Zuweisungs-Abfrage in `fiaon-vertrieb.ts` lautete
`type IN (…) AND meta LIKE a OR meta LIKE b`. In SQL bindet `AND` stärker als
`OR` — der zweite Zweig prüfte den Typ nicht mehr. Klammern gesetzt; das `catch`
schreibt seinen Fehler jetzt mit.

### Teil 7 — Onboarding: „Gespräch führen" öffnet nichts

Im Browser als Onboarding-Rolle nachgestellt. Der Screenshot zeigt die Ursache:
Auf der zusammengeklappten Terminkarte stand **genau ein Knopf: „Anrufen"**.
„Gespräch führen" lag zwei Klicks tief — man musste erst den **Kundennamen**
anklicken, der wie normaler Text aussieht, und es erschien unter der Lage-Tafel,
zusätzlich nur bei `status === 'gebucht'`.

Und „Anrufen" war ein `<a href="tel:…">`. Am Schreibtisch, ohne Telefonie im
Browser, tut dieser Link **nichts** — kein Dialog, keine Meldung. Der
auffälligste Knopf der Seite war der einzige, der nichts sichtbar bewirkt.

Behoben: „Gespräch führen" ist der Hauptknopf und steht sofort auf der Karte.
„Anrufen" läuft über das eigene Softphone (`anrufStarten`) — derselbe Weg, den
Cockpit und Forderungsmanagement nehmen. **Browsertest:** Knopf gefunden,
gedrückt, Cockpit offen, **7 von 7 Schritten** sichtbar, „Abschließen"
vorhanden und korrekt gesperrt, solange Pflichtschritte offen sind.

### Teil 8 — Onboarding-Notizen verschwinden nach dem Speichern

Zwei Ursachen:

1. **Es gab keinen Weg, NUR eine Notiz zu speichern.** Das Textfeld ging
   ausschließlich zusammen mit einem Ergebnis mit („Nachtragen: geführt" /
   „Nicht erschienen"). Wer nach dem Gespräch etwas vermerken wollte, musste ein
   Ergebnis erfinden.
2. **Das zweite Speichern löschte das erste.** Die Ergebnis-Route schrieb
   `notiz = ${notiz ? … : null}` — dazu `agenda_stand` und `dauer_sek` genauso.
   Drei Felder, die bei jedem Aufruf ohne Angabe auf NULL gingen. Wer erst eine
   Notiz nachtrug und danach etwas anderes festhielt, löschte damit die eigene
   Notiz und den ganzen Agenda-Stand. Jetzt `COALESCE`: Eine Angabe, die fehlt,
   ist keine Anweisung zum Löschen.

Und die Ablage war falsch: Eine Notiz am TERMIN sucht der nächste Kollege nicht.
Neu: `POST /agent/onboarding/person/:id/notiz` schreibt einen Verlaufseintrag an
die **Person**, in dieselbe Tabelle (`fiaon_contact_log`), die Kundenkarte,
Vertriebsakte und Forderungsmanagement lesen. Die Route gibt den frischen
Verlauf **zurück**, die Karte zeigt ihn ohne Neuladen — ein gespeicherter Satz,
der erst nach F5 erscheint, gilt als verloren. Fehler stehen am Feld.

### Teil 9 — Erledigte bleiben in der Onboarding-Liste

Der Filter lautete `x.status === "gebucht" || x.heute`. Das zweite Glied holte
JEDEN heutigen Termin zurück — auch den erledigten. Im Screenshot stand ein
erledigter Termin mitten in der Liste „HEUTE", in derselben Karte, mit demselben
Knopf wie der offene; ein graues Wort „erledigt" hinter der Rufnummer war der
ganze Unterschied.

GEMESSEN in `fiaon_termine` (30 Tage, `onboarding_call`): 13 gebucht, 7
erledigt, 2 verpasst, 2 abgesagt — die 7 standen alle in der Tagesliste. Die
Route lieferte `erledigt_am` gar nicht mit.

Behoben: Die Route liefert `erledigt_am`, die Seite hat zwei Reiter mit Zählern
(**Offen** / **Erledigt**), und erledigte Termine tragen eine grüne Marke mit
Haken und Uhrzeit. **Browsertest:** Der erledigte Prüffall ist aus der aktiven
Liste verschwunden.

### Aufgeräumt: drei tote Fassungen

`client/src/pages/agent/heute.tsx` (hing an keiner Route, war aber noch lazy
importiert — und trug eine eigene Ergebnisliste mit sieben Werten),
`client/src/pages/agent/meine-kunden.tsx` (kein Import) und der Export
`KUNDE_GRUPPEN` (von niemandem importiert, ohne „erreicht_sonstiges"). Beide
Adressen leiten schon um. Genau diese Falle hat den Wiedergänger in Teil 3
erzeugt.

### Prüfstände

| Lauf | Ergebnis |
|---|---|
| `pruef-antrag-vollstaendig` | 17 ok — hält TypeScript- und SQL-Fassung an 4.000 Anträgen gegeneinander |
| `pruef-ergebnis-eine-liste` | 31 ok — eine Liste, ein Notizfeld, keine sechste Fassung |
| `pruef-neun-punkte-browser` | 30 ok — Knöpfe gefunden und GEDRÜCKT, Screenshots angesehen |
| `schau-neun-punkte` | Nachstellung je Rolle, Konsole und Netz mitgelesen |
| `pruef-backticks` | 438 Dateien übersetzen sich |

**Rot-Proben:** Rückfall auf „started" wieder eingebaut → 4 rot. Render-Block
für das Notizfeld entfernt (der Originalfehler) → der Browsertest wird rot mit
„der Knopf tut nichts — genau die gemeldete Lage".

### Betreiber-TODO

1. **Nach dem Deploy** `npx tsx scripts/antrag-zustand-nachziehen.ts --schreiben`
   ein zweites Mal laufen lassen: Bis die neue Fassung von `antrag.tsx`
   ausgeliefert ist, erzeugt das Formular weiter Anträge mit zurückgefallenem
   Zustand.
2. Entscheiden, ob Stufe-A-Kunden nach neun Fehlversuchen ruhen dürfen (Teil 4).

---

## 19.08.2026 (Abend) — Eine Schutzfunktion hat den Vertrieb angehalten

Die Tagesgrenze je Absendernummer (100 Anrufe, HTTP 429 bei Erreichen) hat heute
Mittag zwei Mitarbeiter am Arbeiten gehindert. Der Betreiber musste sie auf 0
stellen.

### Teil 1 — Die Zahl, die wir dem Betreiber schulden

**GEMESSEN** (`scripts/mess-anrufgrenze.ts`, aus `fiaon_call_versuche` — jede
Ablehnung steht dort mit Grund im Klartext):

| | |
|---|---|
| **verhinderte Anrufe heute** | **26** |
| betroffene Mitarbeiter | 2 |
| nicht erreichbare Zielnummern | 9 |
| erste Ablehnung | 13:18 Uhr |
| letzte Ablehnung | 15:14 Uhr |

Lucas Böhnert 18 Anrufe (14:00–15:14), Nikita Boychenko 8 (13:18–14:42).

### Die Ursache war ein Satz, den niemand nachgerechnet hat

Im Quelltext stand:

> „Die Grenze ist ein SCHUTZ, keine Arbeitsbremse: 100 Anrufe je Nummer und Tag
> erreicht im Normalbetrieb niemand."

Nachgemessen über 14 Tage: **252** Anrufe je Absendernummer und Tag als Spitze
(12.08.), **117** je Mitarbeiter (Lucas, 17.08.). Die Grenze lag **unter** dem
Normalbetrieb — sie musste greifen.

### Die Kalibrierung, begründet

Hinweisschwelle **300**, Betreiber-Warnung ab dem 1,5-fachen (**450**).

300 ist nur das 1,2-fache der gemessenen Spitze; die Schwelle wird an starken
Tagen also erreicht. Das ist Absicht und harmlos, weil sie nur einen grauen Satz
kostet. Die *Warnung* bei 450 liegt klar über allem, was je vorkam. Und der neue
Schlüssel heißt `anruf_hinweis_schwelle` (Vorgabe 300) statt
`max_anrufe_je_nummer_tag`: Letzterer steht auf 0, weil der Betreiber die Sperre
im Notfall abschalten musste — würde die neue Warnung denselben Schlüssel lesen,
wäre die Notbremse von heute die Blindheit von morgen.

### Drei Stufen statt einer Wand

| Stand | Agent | Betreiber |
|---|---|---|
| unter 300 | nichts | nichts |
| ab 300 | grauer Satz im Panel, „du kannst normal weiterarbeiten" | — |
| ab 450 | derselbe graue Satz | Diagnose-Eintrag, Dashboard-Marke, Mail an `BETREIBER_MAIL` (höchstens einmal je Nummer und Tag) |

`erschoepft` ist aus der Schnittstelle **entfernt** und nicht auf `false`
gesetzt: Ein Feld, das es nicht gibt, kann niemand mehr abfragen, und der
Typcheck findet jede Stelle, die es versucht.

### Teil 2 — Die Hausregel, und was der Bestand hergab

Neu in AGENTS.md: *„Ein Schutzmechanismus, der die Kernarbeit anhält, ist falsch
gebaut."* Die entscheidende Frage ist **hält es einen MENSCHEN auf?** — ein
Tageslauf, der um 3 Uhr nicht sendet und um 8 Uhr schon, blockiert niemanden.

Der Bestand, geprüft (18 Mechanismen):

**Umgebaut:** `TAGESLIMIT = 3` in `server/lib/fiaon-versand.ts`. Der vierte
manuelle Versand wurde abgelehnt — und traf damit genau den Agenten, der den
Kunden am Telefon hat („ich habe nichts bekommen"). Jetzt geht er raus, mit einem
Satz daneben. Neues Feld `warnung` neben `grund`: Vorher musste alles, was man
sagen wollte, als Ablehnung gesagt werden.

**Bewusst gelassen, mit Begründung:**

| Mechanismus | Wert | Warum es bleibt |
|---|---|---|
| Versandfenster 08:00–20:00 (Mahnungen, Leads, Abo) | fest | Hintergrundlauf. Die Mail geht um 08:00 raus, niemand ist blockiert — das ist ein Zeitplan, und die Nachtruhe des Empfängers ist ein eigener Wert |
| `max_reminders` / `max_lead_followups` | 6 | Hintergrundlauf, einstellbar, Schutz des Kunden vor Belästigung |
| `PRO_STUNDE = 200`, Termin-Einladungen 50/Tag | fest | Staffelgröße, nicht Sperre: Der Rest geht in der nächsten Stunde bzw. am nächsten Tag. Die Grenze steht sichtbar VOR dem Klick |
| Vorlauf 2 h / Horizont 14 Tage bei Terminen | fest | Definiert, welche Zeiten es gibt — ein Kunde sieht keinen Slot, den er nicht buchen kann |
| 10-Minuten- und 8-Stunden-Sperren an Einzelknöpfen | fest | Doppelklick-Schutz (Idempotenz), keine Quote |
| Berechtigung, Richtlinien-Zusage, DSGVO, Kontaktsperre, unwählbare Nummer | — | Sicherheit und Recht — ausdrücklich erlaubt |

### Teil 3 — Die zwei Reste von gestern

**Der Anruf-Player** (`client/src/components/AnrufPlayer.tsx`) ist ein Bauteil
für alle vier Abspielstellen: Fortschrittsbalken (als `range`, also mit Tastatur
bedienbar), Zeitanzeige, 1×/1,5×/2×, Download als `kunde_datum.mp3`. Der Download
läuft über **dieselbe sitzungsgebundene Route** mit `?laden=1` und wird
protokolliert („HERUNTERGELADEN"). Eine signierte URL wäre hier schwächer: Sie
gilt, solange die Signatur gilt — auch für den, der sie weitergibt.

**Die Team-Zentrale** von gestern ist jetzt im Browser angesehen, was gestern
ausdrücklich nicht der Fall war. Vier Screenshots in `reports/bilder/`.

### Zwei Fehlalarme, die nur der Screenshot verraten hat

1. Der erste Browserlauf meldete **10 rote Prüfungen** („Die Team-Zentrale lädt:
   ROT", „kein Drei-Punkte-Menü", „keine Academy-Zeile"). Der Screenshot zeigte
   das **Zahlenfeld der Anmeldung** — die Seite war nie geladen, weil
   `ADMIN_ACCESS_CODE` nicht gesetzt war. Der Rückfallwert steht im Quelltext
   (`fiaon-admin-zugang.ts`) und ist jetzt dort gelesen, nicht geraten. Und der
   Lauf **bricht ab**, wenn die Seite nicht lädt: Jede weitere Prüfung wäre ein
   Fehlalarm.
2. Danach blieb eine Prüfung rot: „Der Player war im Profil nicht erreichbar."
   Der Screenshot zeigte den Knopf — er heißt **„Anhören"**, nicht „Aufnahme
   anhören".

### Prüfstände

| Lauf | Ergebnis |
|---|---|
| `pruef-anrufgrenze.ts` | **35 ok** — Schwelle erreicht → Anruf geht trotzdem, Hinweis erscheint, Warnung genau einmal am Tag; die drei erlaubten Wände müssen weiter stehen |
| Rot-Probe | Sperre wieder eingebaut → **2 rot**, mit der Fundstelle im Fehlertext |
| `schau-player-team.ts` | **32 ok** — Menü geöffnet und gemessen, Tempo durchgeschaltet (1× → 1,5× → 2×), Desktop und 380 px |
| `pruef-menschen.ts`, `pruef-mail.ts` | verlangten die Sperre ausdrücklich und waren grün — **eine Prüfung, die eine falsche Regel festschreibt, macht sie unantastbar**. Beide ersetzt, alter Wortlaut im Kommentar |

Und eine Falle beim Bauen: Der Prüfstand hätte eine **echte Warnmail** an den
Betreiber geschickt und blieb am HTTP-Aufruf zu Brevo hängen. `nummerWarnungMelden`
hat jetzt `nichtSenden` — der Diagnose-Eintrag entsteht, die Mail nicht.

### Betreiber-TODOs

1. **`anruf_hinweis_schwelle` steht auf 300.** Wenn die Hinweise zu oft
   erscheinen: hochsetzen. Sperren kann die Zahl nichts mehr.
2. **`BETREIBER_MAIL` prüfen** — ohne die Adresse steht die Warnung nur in der
   Diagnose (`/admin/events`).
3. **107 Testkonten** stehen in der Team-Zentrale (2 davon aktiv). Nicht Teil
   dieses Auftrags, aber im Bild aufgefallen.

---

## 19.08.2026 (später) — Fünf Meldungen, fünf Ursachen: der Einheitenfehler, der leere Bildschirm und die Daten aus der Zukunft

Ein Sammelauftrag aus dem Betrieb. Bei **drei von sieben Punkten war die gemeldete
Ursache falsch und der Kern richtig** — die Zahlen im Auftrag sind Hinweise, keine
Messwerte (AGENTS.md). Deshalb steht hinter jedem Punkt zuerst die Messung.

### Teil 1 — „Müll-Beträge im Bestand" waren ein Anzeigefehler

Gemeldet: Bestellungen mit 0,80 € und 1,00 € im Bestand, ein Anlage-Weg schreibt sie.

**Gemessen** (`scripts/mess-muell-betraege.ts`): In `fiaon_applications.amount_due`
steht **kein einziger** Betrag unter 5 €. Die Spalte führt EURO: 7.99, 59.99, 79.99,
99.99, 249.99. Die gemeldeten Zahlen entstanden hier:

```
server/lib/fiaon-massgebliche-bestellung.ts (gestern gebaut)
    betragCents: b.amount_due != null ? Number(b.amount_due) : null
```

79,99 € als Cent gelesen ergibt 0,7999 € → angezeigt „0,80 €". High End ergibt
„1,00 €", Pro „0,60 €". Neun andere Stellen im Haus rechnen `* 100`; nur diese eine
nicht — und sie ist die einzige Quelle des neuen Bestätigungs-Dialogs.

**Der Kunde war nie betroffen:** 4.132 Zahlungsmails in 30 Tagen, jede mit dem
richtigen Betrag. Auch die Behauptung im Quelltext, Josef Rohrmoser habe fünf Mails
über „High End (1,00 €)" bekommen, ist falsch — er bekam zehn Mails über 99,99 €.
Der Kommentar war selbst ein Opfer des Einheitenfehlers und ist korrigiert.

**Was WIRKLICH abweicht:** 6 von 1.284 lebenden Bestellungen, davon 4 bezahlt
(bleiben unangetastet: Rechnung und Provision hängen daran) und 2 unbezahlt. Die
zwei sind Bonitätsauskünfte mit 99,99 € statt 74,00 € — der Dubletten-Merge hatte
`pack_key = highend` in eine Auskunft geschrieben, und `rechnungStellen` preiste
danach. Beide sind auf 74,00 € korrigiert (`scripts/katalogpreis-lauf.ts`,
Zählprobe 0). Zwei Kunden wurden vorher um 99,99 € gebeten
(`reports/katalogpreis-korrekturmails.csv` → Betreiber-TODO).

**Die Wurzeln, alle vier:**

| Weg | Was er tat | Jetzt |
|---|---|---|
| Admin-Akte „Betrag (amount_due, €)" | freier Betrag, 0–50.000 € | nur der Katalogpreis |
| Admin-Akte, Paket-Dropdown | Paket geändert, Betrag stehen gelassen | Betrag folgt dem Paket |
| Nachbuchungs-Center | Betrag aus „manueller Eingabe"/Dublette geraten | Katalog zuerst |
| `rechnungStellen` | preiste eine Auskunft nach `pack_key` | Kategorie vor Paketschlüssel |

Und die **DB-Wand** (Migration 065): Ein Trigger lehnt bei unbezahlten Bestellungen
jeden Betrag ab, der nicht dem Katalogpreis entspricht. Die Preise stehen dafür als
ausdrückliche **Abschrift** in `fiaon_paketpreise`; `katalogpreiseSyncen()` zieht sie
beim Serverstart aus `shared/fiaon-pakete.ts` nach, und der Prüfstand hält beide
Seiten gegeneinander. Bezahltes wird nicht blockiert (vier Altfälle).

### Teil 2 — Der Dialog las die falsche E-Mail-Quelle

Screenshot: „Das bekommt JOACHIM RECHTSTEINER — Für diesen Kunden ist keine
E-Mail-Adresse hinterlegt", während in seiner Akte euro-tec@t-online.de steht.

Die Vorschau-Route hatte **zwei** Zweige. Der erste benutzte die zentrale Auflösung
(richtig). Der zweite — „noch keine Rechnung gestellt" — hatte eine eigene Abfrage
**ohne `p.primary_email`**. Rechtsteiner hat genau dort seine Adresse: an der Person,
nicht an der Bestellung. Der Server hätte gesendet, die Anzeige sagte „geht nicht".

Neu: `empfaengerFuer(personId, ref)` — eine Auflösung für Anzeige UND Versand, mit
der Quelle im Ergebnis. Sie wird an drei Stellen benutzt (Vorschau, Zahlungsdaten-
Versand, Nummern-Korrektur). Außerdem: „Senden" ist ohne Adresse **sichtbar** grau
statt blassblau (vorher wirkte er aktiv), und daneben steht das Inline-Feld zum
Nachtragen. Bewiesen in `scripts/pruef-rechtsteiner.ts` — 21 Prüfungen.

### Teil 3 — Das leere Portal war KEIN Ansichts-Problem

Gemeldet von vier Menschen: „Verdienst konnte nicht geladen werden", 0,00 €,
„Bankdaten fehlen" (IBAN vorhanden), 0 Kunden. Verdacht: Die Nur-Lesen-Wand
blockiert Lese-Routen.

**Gemessen** (`scripts/mess-ansicht-leseroute.ts`, 16 Lese-Routen mit Ansichts-Token):
Die Wand blockiert **nichts** Lesendes — sie lässt GET durch, wie gebaut. Genau eine
Route antwortete mit **HTTP 500**: `/agent/start`.

```
PostgresError 42P01: missing FROM-clause entry for table "p"
    server/routes/fiaon-agent-start.ts:288
```

`nichtWaehlbarSql()` schreibt seine Bedingungen auf den Alias `p`; die Abfrage hatte
keinen (`FROM fiaon_persons`). Eingeführt heute um **11:42** (Commit e675efa),
gemeldet am selben Tag. **Für alle Mitarbeiter, nicht nur in der Ansicht.**

Und derselbe 500 erklärt Daniels zweite Meldung: Der Menüpunkt „Vertrieb" hängt an
`nurRolle: "vertriebsleiter"`, und die Rolle kommt aus derselben Antwort. Ohne
Antwort blieb sie auf „agent" — der Punkt verschwand lautlos, weil der Fehler in
einem `.catch(() => {})` landete. Die Navigation holt die Rolle jetzt notfalls von
`/agent/me` und schreibt eine Warnung ins Protokoll.

Danach gemessen: 200, Rolle `vertriebsleiter`, `bankHinterlegt: true`, 1.012 offene
Kunden, 734,50 € Guthaben.

Dazu die Hausregel umgesetzt: Die Verdienst-Karte zeigt **keine 0,00 €** mehr, wenn
sie nichts weiß — sie zeigt einen Strich, den Grund nach Verursacher getrennt
(401 Sitzung / 403 Rechte / 5xx unsere Seite) und die Meldung des Servers.

### Teil 4 — Anrufe im falschen Profil: gemessen, benannt, nicht geraten

Screenshot: In Lucas Böhnerts Gespräche-Tab spricht „Herr Boyschenko".

**Gemessen** (`scripts/mess-anruf-zuordnung.ts`): 1.552 Anrufe.

* **Ausgehend (1.403): richtig.** `agent_id` ist die Sitzung, die gewählt hat. Die
  186 Fälle, in denen sie vom Betreuer abweicht, sind Kollegen, die für jemanden
  angerufen haben — kein Fehler.
* **Eingehend (149): eine Vermutung.** `zustaendigFuer()` beantwortet „wer sollte
  rangehen" (Inkasso, Termin, **Betreuer**, wer zuletzt sprach). Bei 123 der 149 ist
  `agent_id` genau der Betreuer. Wer wirklich abgenommen hat, weiß der Twilio-Webhook
  nicht — er hat keine Sitzung.

**Der Bestand wird NICHT umgehängt**, und das ist die Entscheidung: Es gibt kein
Ereignis „Anruf angenommen" und keine zweite Agenten-Spalte. Ein Umhängen wäre
Raten, und ein geratener Anruf im Profil eines Menschen wird als Leistungsnachweis
gelesen.

Was sich belegen lässt, wird belegt (Migration 066): `zuordnung_herkunft` mit drei
Werten — `gewaehlt` (Sitzung hat gewählt), `ergebnis` (Sitzung hat das Ergebnis
erfasst; die Route lehnt fremde Anrufe ab) und `zustaendigkeit` (abgeleitet, NICHT
belegt). Der Bestand ist ohne jede Vermutung eingeordnet: 27 Zeilen stehen auf
`zustaendigkeit`. Die Gespräche-Ansicht liefert den Wert mit.

### Teil 5 — Team-Zentrale

* „als Testkonto markieren" stand als Link unter **jedem** Namen. Jetzt in einem
  Drei-Punkte-Menü je Karte — zusammen mit **Profil öffnen** und **Als Mitarbeiter
  ansehen**, die es an der Karte vorher gar nicht gab (die Route existierte).
* Academy-Zeile: „Kapitel 0/14 — noch nicht geöffnet" stand in Bernstein und wirkte
  wie ein Fehler. Jetzt eine graue Zeile mit dünnem Fortschrittsbalken; grün nur für
  „durch". Rot bleibt Fehlern vorbehalten.
* Die **Personalkosten-Leiste** liegt nicht mehr unter den Karten, sondern steht als
  Karte **„Wirtschaftlichkeit" oben** im Kennzahlenbereich — Entscheidung des
  Betreibers.
* Mit **Erklärzeile**, weil „Personalkosten" kein Begriff ist, den zwei Menschen
  gleich verstehen. Nachgerechnet (`scripts/mess-wirtschaftlichkeit.ts`):
  Festgehälter anteilig 3.342,86 € + gebuchte Provisionen 3.368,10 € =
  **6.710,96 €**; Umsatz 15.104,47 €; Deckung **225 %** — die Rechnung geht auf.
  Eine Korrektur am Sprachgebrauch: Es sind **nicht** die „ausgezahlten"
  Provisionen, sondern alle nicht stornierten des Monats (überwiesen sind
  1.343,80 €). Stundenlöhne stecken als Provisionsart `stunden` mit drin.

### Teil 6 — Die Daten aus der Zukunft: keine falsche Uhr, eine Gewohnheit

`updates-data.ts` trug Einträge „Was am 30./31.08.2026 dazugekommen ist" — an einem
19.08.2026.

**Die Umgebung war nicht schuld.** Sie liefert den 19.08.2026, und der jüngste Commit
trägt dasselbe Datum; beide kommen aus derselben Uhr. Auch kein Tippfehler: Der
Versatz war nicht zufällig, sondern wuchs **monoton**
(`scripts/mess-update-daten.ts`).

```
2026-08-17-betrieb        eingetragen 17.08.   Commit 17.08.    0 Tage
2026-08-18-kundenweg      eingetragen 18.08.   Commit 17.08.   +1 Tag
2026-08-19-kundensicht    eingetragen 19.08.   Commit 17.08.   +2 Tage
2026-08-20-ablauf         eingetragen 20.08.   Commit 17.08.   +3 Tage
…
2026-08-31-richtiges-paket eingetragen 31.08.  Commit 19.08.  +12 Tage
```

Jede Sitzung hat auf den obersten Eintrag gesehen und **einen Tag dazugezählt**,
statt die Uhr zu lesen. Am 17. und 18.08. liefen je mehrere Sitzungen — so wurde aus
einem Tag Vorsprung ein knapper Monat.

Korrigiert: 21 Einträge in `updates-data.ts` und 19 CHANGELOG-Überschriften, jeweils
auf das Datum des Commits, der sie eingeführt hat. Die `id`-Felder behalten ihr altes
Datum: Sie sind der stabile Schlüssel für den „gesehen"-Stand im Browser.

Die Wand: `scripts/pruef-daten-zukunft.ts` prüft gegen die **Datenbankzeit** (nicht
die lokale Uhr), dass kein Update-Datum und keine CHANGELOG-Überschrift in der
Zukunft liegt — und dass die Liste absteigend sortiert bleibt (nach der Korrektur war
genau das gebrochen). Geprüft wird die Überschrift, nicht jede Zahl im Text: „ab
01.10.2026 geplant" ist ein Plan und darf in der Zukunft liegen. Für die 164
Datumsangaben in Quelltext-Kommentaren gilt eine **Obergrenze** statt eines Verbots —
eine Prüfung, die 164 Altfälle meldet, wird abgeschaltet.

### Teil 7 — Termin-Buchung nach dem Deploy

`falsche_rolle`: **220 Ablehnungen vor** dem Fix (Commit 759a47f, 13:58:53),
**0 danach**. Reinhold Müller hat um 12:xx erfolgreich gebucht — seine abgelehnten
Versuche liegen alle um 09:xx und 10:xx, also vor der Meldung von 12:06.

Ehrlich dazu: Nach dem Commit fallen bisher nur **2** Buchungsversuche ins Fenster
(beide erfolgreich). Eine 0 aus zwei Versuchen ist ein guter Anfang und kein Beweis —
der Lauf gehört morgen wiederholt. Und: Commit-Zeit ist nicht Deploy-Zeit.

Eine Messfalle dabei, die den Fix fast für kaputt erklärt hätte: Der Erfolgswert in
`fiaon_termin_versuche.ergebnis` heißt `gebucht`, nicht `ok`. Der erste Entwurf
filterte auf `<> 'ok'` und meldete 22 „Ablehnungen ohne Grund" — es waren gebuchte
Termine.

### Prüfstände

| Lauf | Ergebnis |
|---|---|
| `pruef-katalogpreis-wand.ts` | 20 ok — spielt Migration 065 in einer zurückgerollten Transaktion ein und prüft die Wand von beiden Seiten |
| `pruef-rechtsteiner.ts` | 21 ok — der Beweisfall Ende zu Ende |
| `pruef-massgebliche-bestellung.ts` | 38 ok — **der Prüffall selbst war falsch**: Er schrieb `amount_due = 5999` (also 5.999 €) und war deshalb MIT dem Einheitenfehler grün. Jetzt 59.99 in der Spalte, 5999 Cent erwartet — und die Rot-Probe (Fix zurückgenommen) macht ihn rot |
| `pruef-daten-zukunft.ts` | 9 ok |
| `pruef-backticks.ts` | 421 Dateien, keine Fundstelle |

### Wo zu finden

* `shared/fiaon-pakete.ts` — der Katalog, unverändert die eine Quelle
* `server/lib/fiaon-massgebliche-bestellung.ts` — `katalogpreisCents`, `empfaengerFuer`, Einheiten-Fix
* `server/lib/fiaon-katalogpreise.ts` + `db/migrations/065_katalogpreis_wand.sql` — die Wand
* `server/routes/fiaon-agent-start.ts:288` — der Alias, der das Portal leer machte
* `db/migrations/066_anruf_zuordnung.sql` — die Herkunft der Anruf-Zuordnung
* `client/src/components/agent/RechnungBestaetigung.tsx` — Warnmarke, gesperrter Knopf, Inline-Feld
* `client/src/pages/admin-team-zentrale.tsx` — Drei-Punkte-Menü, Academy-Zeile, Karte „Wirtschaftlichkeit"

### Betreiber-TODOs

1. **Zwei Korrekturmails.** `arsen.tamiie@icloud.com` und
   `natascha.branics@gmail.com` wurden um 99,99 € für eine Bonitätsauskunft gebeten;
   richtig sind 74,00 €. Die Bestellungen stehen jetzt auf 74,00 €, die Mails sind
   raus. Liste: `reports/katalogpreis-korrekturmails.csv`.
2. **Godwin Uche hat 79,99 € für ein High-End-Paket bezahlt** (Katalog 99,99 €).
   Bezahlt wird nicht angefasst — ob nachgefordert oder als Rabatt geführt wird, ist
   eine kaufmännische Entscheidung. Ebenso Ilijana Weber (79,99 €), Silvana
   Kammerzell (10,00 € statt 7,99 €), Daliborka Saratlija (10,00 € statt 59,99 €).
3. **Teil 7 morgen erneut messen** — zwei Versuche sind keine Stichprobe.
4. **164 Datumsangaben in Kommentaren** liegen weiter in der Zukunft. Die Wand hält
   die Zahl fest; das Aufräumen braucht einen eigenen Termin.

---

## 19.08.2026 — Zwei Knöpfe, die „nicht gehen" — und beide Male derselbe Bauplan

Zwei Meldungen an einem Tag. Florentine: „Über 11 Kunden warten auf ihre Rechnung — ich kann ihnen keine Mail schicken." Herr Hertel am Telefon: Er kann im Startgespräch-Kalender keine Zeit wählen.

Es sind zwei verschiedene Bereiche. Die Ursache ist beide Male dieselbe: **Anzeige und Server beantworten dieselbe Frage mit verschiedenen Regeln.** Die Anzeige gibt frei, der Server lehnt ab — und der Mensch dazwischen erlebt einen Knopf, der nichts tut.

### Teil 1 — Warum Florentine nichts senden konnte

Der Verdacht lag bei mir: Ich hatte am Vortag die Bestellungs-Auflösung verschärft und eine Referenzprüfung eingebaut. Also zuerst gemessen, an ihren 1.093 echten Kunden, mit dem Entscheidungsbaum des Servers, ohne zu senden.

**Der Verdacht war falsch.** 154 ihrer Kunden waren sendbar; die neue Auflösung blockierte nichts. Aber:

| | |
|---|---:|
| Kunden, bei denen die **Karte** den Knopf freigab und der **Server** ablehnte | **139** |
| Kunden, bei denen die Karte sperrte, obwohl der Server senden würde | 0 |

Die 139 sind die Meldung. Zwei Ursachen, beide gemessen:

**a) Die E-Mail stand an der Person, nicht an der Bestellung (21 Kunden).** Der Server las den Empfänger ausschließlich aus der Bestellung und antwortete „Für diesen Kunden ist keine E-Mail-Adresse hinterlegt" — während in der Karte eine stand. Seit Migration 059 ist die Person die gültige Wahrheit und die Spalten an der Bestellung sind Abschriften; wer nur die Abschrift liest, findet nichts, wenn sie vor dem Trigger entstand.

**b) `pending_payment` fehlte in der Liste der rechnungsreifen Zustände (63 Kunden).** Der Status heißt wörtlich „Zahlung ausstehend". Er stand in **keiner** der beiden Listen — weder bei den erlaubten noch bei den ausdrücklich ausgeschlossenen Formularschritten. Eine Lücke, keine Absicht: `submitted` und `approved` sind drin, und `pending_payment` liegt hinter beiden. Die Bestellungen tragen Paket und Verwendungszweck, aber weder Betrag noch Frist — genau das, was der Rechnungslauf setzt. Die ältesten warten seit dem **2. Juli**.

Der Agent sah „offen", drückte, und bekam „Der Antrag ist noch nicht abgeschlossen (Stand: pending_payment)" — ein Satz, der zum Anrufen auffordert, bei einem Kunden, der nur auf die Rechnung wartet.

**Ergebnis: 154 → 245 sendbare Kunden bei Florentine. Bestandsweit 911.**

**Und die Karte rät nicht mehr.** Sie leitete den Sperrgrund selbst aus den Buchungen ab — mit dem Kommentar „Die WAHRHEIT bleibt der Server" darüber und einer eigenen Regel darunter. Der Grund kommt jetzt bei **jedem** Laden vom Server (`sendeGrundSql`), in der Arbeitsliste wie in der Einzelkarte. Als SQL-Ausdruck, nicht als Aufruf je Kunde: Die Liste holt 1.093 Karten in einer Abfrage, und ein Aufruf je Kunde wären 1.093 Abfragen — dann baut jemand aus Not wieder eine Ableitung in die Oberfläche.

**Zählprobe: 0.** Kein Kunde mit lebender offener Bestellung und zustellbarer Adresse wird noch gesperrt.

### Teil 2 — Warum Herr Hertel keine Zeit wählen konnte

Seit dem 30.08. wird jeder Buchungsversuch protokolliert. Also ausgelesen statt geraten:

> **Jens Hertel, Person 4540: 38 Versuche. Alle abgelehnt. Alle mit demselben Grund: `falsche_rolle`.** Heute morgen um 08 Uhr.

Bestandsweit: **220 von 222 Ablehnungen** tragen diesen Grund. Die gewählten Ansprechpartner waren Lucas (98×), Nikita (51×), Florentine (44×) und Daniel (27×) — alle aus Vertrieb und Leitung.

Er hat die Zeiten **gesehen** und wurde bei jedem Klick abgewiesen. Der Kalender war nicht leer — es gab 55 freie Zeiten an 11 von 14 Tagen.

**Die Ursache:** Ist kein Onboarding-Konto aktiv, bietet die Slot-Anzeige bewusst Zeiten aus Vertrieb und Leitung an — dafür ist `rollenMitRueckfall` gebaut, sie meldet den Rückfall sogar ins Log. Die Rollenprüfung beim Buchen kannte ihn **nicht** und verglich stur gegen die Sollrolle. Sie lehnte ab, was die Anzeige eine Zeile vorher angeboten hatte.

Der alte Kommentar dort lautete: „Die Prüfung steht hier und nicht nur in der Slot-Anzeige — wer die Anfrage selbst baut, kommt sonst an der Anzeige vorbei." Richtig gedacht, aber mit einer **anderen** Regel als die Anzeige. Eine Wand, die etwas anderes prüft als das Angebot, ist kein Schutz, sondern eine Falle. Die Wand bleibt und benutzt jetzt dieselbe Funktion.

**Zweiter Fund, aus dem Browsertest:** Die Terminseite hat den Anhang `?art=start` **nie gelesen**. Ein Kunde, der auf den Startgespräch-Link klickt, bekam „Wähl eine Zeit für ein **20-minütiges** Gespräch mit Nikita" — einen Vertriebsrückruf statt seines 15-minütigen Startgesprächs, von Menschen, die keine Startgespräche führen. Der Link verspricht das eine und liefert das andere.

**Dritter Fund, ebenfalls im Browser:** Nach einer abgelehnten Buchung rief die Seite `laden()`. Das setzt den Ladezustand — und der ersetzte die ganze Seite samt der eben gesetzten Fehlermeldung. Der Kunde sah für einen Wimpernschlag den Grund, dann „Freie Zeiten werden geladen …", dann eine frische Liste. Ohne Erklärung, warum sein Klick nichts bewirkt hat. Wer zweimal klickt und zweimal nichts erfährt, ruft an.

Dazu, unabhängig von der Meldung:

- **Lücken werden benannt.** Tage ohne Zeiten wurden einfach nicht gezeichnet — keine leere Fläche, aber auch keine Auskunft. Jetzt: „An diesen Tagen ist nichts mehr frei: Samstag, Sonntag. Der nächste freie Tag ist Montag, 24. August."
- **Bei null Zeiten in 14 Tagen entsteht eine Aufgabe** mit 24-Stunden-Frist, höchstens eine je Person und Tag. Vorher hätte der Kunde einen freundlichen Satz gesehen und sonst wäre nichts passiert — kein Mensch hätte davon erfahren.

### Teil 3 — Damit es beim nächsten Mal die Anwendung meldet

Zweimal hintereinander hat ein **Mensch** gemeldet, dass ein Knopf nicht geht. Die Karte „Kann das Team arbeiten?" im Verwaltungs-Dashboard dreht das um:

- **Gesperrte Kernaktionen heute: n** — Kunden, die ihre Zahlungsdaten bekommen könnten und nicht bekommen, plus die nicht anrufbaren.
- **Freie Onboarding-Zeiten: X in 14 Tagen** — rot unter 10, mit Hinweis, wenn der Rückfall greift.
- **Buchungsversuche in 24 Stunden**, nach Ablehnungsgrund.

Sie steht nur da, wenn etwas klemmt. Eine Dauer-Anzeige „alles gut" wird nach zwei Wochen nicht mehr gelesen — und dann auch die Warnung nicht, die an ihrer Stelle steht.

### Was die Prüfstände können mussten

Die erste Fassung des Rechnungs-Browsertests wählte ihre Prüffälle über **dieselbe Funktion, die sie prüft**. Bei der Rot-Probe blieb sie grün: Die Erwartung war mitgewandert. Ein Test, der seinen Sollwert vom Prüfling bezieht, prüft nichts.

Die Erwartung steht jetzt unabhängig, als Satz über die Daten: *Wer eine lebende unbezahlte Bestellung und eine zustellbare Adresse hat, muss Zahlungsdaten bekommen können* — je einer für `pending_payment`, `claimed_paid` und `expired`. **Rot-Probe: 2 rot.**

Beim Termin-Prüfstand dasselbe Problem in anderer Form: Heute sind zwei Onboarding-Kräfte aktiv, der Rückfall greift also nicht, und Hertels Fehler wäre gar nicht reproduzierbar. Der Prüfstand **legt die Konten in seiner Transaktion still** und stellt die Lage von heute morgen her. **Rot-Probe: 5 rot**, mit genau der Meldung `falsche_rolle`.

| Prüfstand | | Rot-Probe |
|---|---:|---|
| `pruef-startgespraech-buchen.ts` | 26 | 5 rot |
| `pruef-sendesperre-browser.ts` (Browser) | 36 | 2 rot |
| `pruef-terminseite-kunde.ts` (Browser, 380 px) | 11 | — |

### Wo zu finden

| Datei | Zweck |
|---|---|
| `lib/fiaon-massgebliche-bestellung.ts` → `sendeGrundSql` | „Darf gesendet werden?" als SQL, für Liste und Karte |
| `lib/fiaon-rechnung-stellen.ts` → `RECHNUNGSREIF` | `pending_payment` ergänzt |
| `lib/fiaon-termine.ts` → `terminBuchen` | Rollenprüfung mit Rückfall |
| `pages/termin.tsx` | liest `?art=start`, Fehler überlebt das Nachladen, Lücken benannt |
| `routes/fiaon-termin.ts` | Aufgabe bei leerem Kalender |
| `GET /admin/hub/knopfdurchgang` | die Zahlen für die Dashboard-Karte |
| `scripts/mess-sendesperre.ts`, `scripts/mess-slots.ts` | die Messungen |

### Betreiber-TODOs

1. **Fünf zahlende Kunden haben keinen sichtbaren Betreuer.** Patrick Ellmer und Jennyfer Leis (bezahlt), Brigitte Ludl und Martin Ringk (Rechnung offen), Dzintars Auzins (Zahlung gemeldet) hängen an den Konten 2 und 7 — beide „Justin Schwarzott" und als **Testkonto** markiert. Damit fallen sie aus jeder Team-Ansicht. Nicht eigenmächtig umgehängt: Zuordnung heißt Provision.
2. **Onboarding-Zeitfenster im Blick behalten.** Aktuell 55 freie Zeiten von Angelique und Rifka. Fallen beide aus, greift der Rückfall auf den Vertrieb — das funktioniert jetzt, sollte aber kein Dauerzustand sein. Die Dashboard-Karte wird bei unter 10 rot.
3. **`BETREIBER_MAIL` setzen** (weiterhin offen) — sonst weckt die Tageslauf-Warnung niemanden.

## 19.08.2026 — Die Rechnung trug das falsche Paket

Florentine Lombardi am 19.08.: „Er wollte ein Pro-Paket. Das High End habe ich rausgenommen. Wenn ich auf Rechnung senden drücke, bekommt er aber eine E-Mail für das High-End-Paket."

Das war kein Anzeigefehler. Der Kunde überweist den falschen Betrag mit dem falschen Verwendungszweck, der Kontoabgleich findet die Zahlung nicht, und die Abo-Rate entsteht auf dem falschen Preis. Die Provision ebenfalls.

### Die Ursache — eine fehlende Zeile

`zahlungsdatenSenden` löste die Bestellung so auf:

```sql
WHERE person_id = … AND merged_into IS NULL
  AND payment_status IN ('pending_payment','claimed_paid','expired')
ORDER BY created_at DESC LIMIT 1
```

Es fehlte `archived_at IS NULL`. Die Abfrage **dreißig Zeilen darunter** hatte den Filter — diese nicht. Wer ein Paket „rausnimmt", archiviert die Bestellung; sie blieb damit in der Auswahl. Und weil sie *später* angelegt wurde als die gültige, gewann sie das `ORDER BY created_at DESC`.

**Bewiesen an Person 4254** (Gabor Toth, betreut von Florentine):

| | angelegt | Paket | Betrag | |
|---|---|---|---|---|
| lebend | 02.07.2026 | FIAON Pro | 0,60 € | ← richtig |
| **archiviert** | 16.07.2026 | FIAON Ultra | 0,80 € | ← **gewann** |
| lebend | 06.08.2026 | FIAON Pro | 0,00 € | (noch keine Rechnung) |

### Die Schadensbilanz

| | |
|---|---:|
| Personen, bei denen die alte Auflösung eine **archivierte** Bestellung wählen würde | **37** |
| davon mit abweichendem Betrag/Verwendungszweck | alle |
| Zahlungsdaten-Mails der letzten 14 Tage auf eine archivierte Bestellung | 10 |
| davon **nach** dem Archivieren versandt — echte Fehlversände | **8** |
| Personen mit mehr als einer offenen Bestellung (stille Auswahl) | 57 |

Die 8 Fehlversände gingen an **zwei** Menschen. Fünf davon am 18. und 19.08. an **Josef Rohrmoser**: „FIAON High End, 1,00 €", während seine gültige Bestellung Pro war — alle fünf von Florentine ausgelöst. Genau ihre Meldung, im Zustellprotokoll wiederzufinden.

**Es wurde keine Korrekturmail versandt.** Die Liste steht in `reports/falsches-paket.csv`; die Entscheidung gehört dem Betreiber.

### Der Fix: eine Auflösung, nicht ein Filter mehr

Der naheliegende Weg wäre gewesen, `AND archived_at IS NULL` an die eine Abfrage zu hängen. Das behebt den gemeldeten Fall und lässt die Ursache stehen: **sechs Wege** beantworteten dieselbe Frage, jeder mit eigener Abfrage.

`server/lib/fiaon-massgebliche-bestellung.ts` definiert „maßgebliche offene Bestellung" einmal: lebend (nicht archiviert, nicht zusammengeführt, nicht storniert, nicht ersetzt, nicht DSGVO-gelöscht), unbezahlt, bei mehreren die zuletzt angelegte.

Beim Nachmessen der vier weiteren Wege (Auftragspunkt 1.d):

| Weg | Eigene Auswahl? | Archiv-Filter? |
|---|---|---|
| Zahlungsdaten-Mail | ja | **nein** ← der Fehler |
| Bitte um Telefonnummer | ja | **nein** ← dieselbe Lücke, harmloser |
| Rechnung-PDF | nein, folgt der Referenz | — |
| Zahlungsdaten/QR/Verwendungszweck (Karte) | ja | ja |
| Abo-Ratenerzeugung | ja | ja |

Zwei Stellen mit demselben Fehler heißen: Es fehlte die Auflösung, nicht der Filter.

**Und der Server glaubt dem Client nicht mehr.** Die Karte hält ihren Datenstand, bis sie neu geladen wird — wer tauscht und sofort sendet, schickt möglicherweise die alte Referenz mit. `bestellungPruefen` lehnt ab, mit Klartext: „Diese Bestellung wurde archiviert. Es gilt jetzt: FIAON Pro, 59,99 €, Verwendungszweck …". Nicht stillschweigend korrigiert — der Agent soll sehen, dass sich etwas geändert hat.

### Der eigentliche Schutz: erst sehen, dann senden

Die richtige Auflösung genügt nicht. Der Agent hat gedrückt und **wusste nicht, was rausgeht** — gefunden wurde der Fehler, weil ein Kunde sich meldete, nach fünf Mails.

`RechnungBestaetigung` zeigt vorher Paket, Betrag, Verwendungszweck und Empfänger. Bei mehreren offenen Buchungen steht es ausdrücklich da: „2 offene Buchungen — gesendet wird die neueste: Pro 59,99 €". **Ein Bauteil**, eingehängt in Kundenkarte und Vertriebsansicht; drei eigene Dialoge wären drei Wortlaute, und der vierte Aufrufort bekäme keinen.

`pruef-massgebliche-bestellung.ts`: **37 Prüfungen.** Der Prüffall ist bewusst der ungünstigste — das archivierte High End ist *neuer* als das lebende Pro, und eine Gegenprobe belegt, dass die alte Abfrage hier High End gewählt hätte. Rot-Probe: ohne Archiv-Filter fallen 15 Prüfungen.

### Teil 2 — Die Arbeitsliste, und eine Korrektur meiner eigenen Zahl

Der Auftrag sprach von „den 18 Nummern, die derzeit nicht anrufbar sind". Beim Bauen der Liste habe ich nachgemessen, und **die Zahl war falsch — meine eigene aus dem Lauf davor.**

Die 18 haben ihr Land in der Akte (12 AT, 4 CH, 1 RO, 1 SK). Sie wurden vorher *falsch* gewählt (`+49`), weil der Wählweg das Land nicht gelesen hat. Seit dieser Änderung liest er es — **sie sind wieder anrufbar, und zwar richtig.** Es war nie Handarbeit nötig.

Tatsächlich nicht anrufbar waren **drei**. Und zwei davon aus einem Grund, den ich selbst am Vortag angelegt hatte:

| Person | Nummer | Land | Grund |
|---|---|---|---|
| 11670 | `0766874041` | SK | **zweite Vorwahl-Tafel kannte SK nicht** |
| 3744 | `17630522990` | TR | **keine der beiden Tafeln kannte TR** |
| 11413 | `6609360523` | — | echte Datenlücke: kein Land, keine führende Null |

`fiaon-telefon.ts` hatte seit Langem eine Tafel der Landesvorwahlen. Am Vortag habe ich in `fiaon-softphone.ts` eine **zweite** angelegt, weil dort eine gebraucht wurde. Sie gingen sofort auseinander: eine kannte SK, die andere RO, keine TR. Genau der Fall, vor dem AGENTS.md warnt — und er hat zwei Kunden unanrufbar gemacht. Jetzt gibt es **eine** Tafel, exportiert und um SK, SI, UA, TR, US, CA, RS ergänzt. **Übrig: ein Kunde.**

**Und der Filter war auch falsch gebaut.** Der erste Entwurf fragte nach „führende Null ohne Land" — das beschreibt die *gemeldete* Menge, nicht die tatsächliche. Person 11413, der einzige echte Fall, hat gar keine führende Null; der Filter hätte ihn nicht gefunden. Er heißt jetzt **„Nummer nicht wählbar"** und benutzt `nichtWaehlbarSql` — dieselbe Entscheidung wie `waehlbareNummer` in der Oberfläche. Der Prüfstand vergleicht beide Wege und verlangt Deckungsgleichheit; sonst zeigt die Liste andere Leute als die Karte.

Die Inline-Korrektur bleibt und ist richtig: An der Stelle, wo vorher nur „Ländervorwahl fehlt" stand — eine wahre Aussage und eine Sackgasse —, steht jetzt Länderauswahl, **Vorschau der Wahlform** („0797435749 + Schweiz → +41797435749"), ein Klick speichert.

Der **Vorschlag** kommt aus PLZ und Ort (fünfstellig → DE; Winkel → CH; Wien → AT) und ist vorausgewählt, aber **nie automatisch gesetzt**: Eine geratene Vorwahl ist genau der Fehler, um den es geht. Wer ihn übernimmt, hat ihn gelesen.

Nur das **Land** ist änderbar, nicht die Nummer: Die Rohnummer ist richtig, nur unvollständig notiert. Wer sie umschreibt, kann sich vertippen — und hat dann eine falsche Nummer, die aussieht wie eine gepflegte.

`pruef-nummer-nachtrag.ts`: **49 Prüfungen** — ohne Land nicht wählbar (beide Wege), mit Land sofort und mit der *richtigen* Vorwahl, Vorschlag nie gespeichert, `00`- und `+43`-Nummern gehören nicht in den Filter, beide Vorwahl-Wege nennen für neun Länder dieselbe Zahl, und der SQL-Filter ist mit der TypeScript-Entscheidung deckungsgleich.

### Teil 3 — Telefonie-Nachweis scharfgestellt

**Eine Zeile je Mitarbeiter** in der Team-Zentrale: Versuche, Annahmequote, Gespräche unter 5 Sekunden, stumm-verdächtig. Bernstein ab einem Drittel Kurzgespräche — ein Hinweis, kein Urteil.

| Mitarbeiter | Versuche | angenommen | < 5 s |
|---|---|---|---|
| Lucas Böhnert | 645 | 55 % | 17 (5 %) |
| **Nikita Boychenko** | 217 | 57 % | **49 (40 %)** |
| **Daniel Stripling** | 39 | 62 % | **14 (58 %)** |

**Die Sprechprobe ist beim ersten Öffnen erzwungen**, einmalig je Mitarbeiter *und je Gerät* — nach einem Headset-Wechsel ist die alte Probe wertlos. Danach freiwillig: Eine Pflicht bei jedem Öffnen wäre eine Klickstrecke, die man wegdrückt, ohne zuzuhören.

Zwei Sperrgründe, **zwei Aufschriften**: „Mikrofon prüfen" bei stummem Gerät, „Erst Sprechprobe" bei fehlendem Nachweis. Ein Knopf, der den falschen Grund nennt, schickt jemanden auf die falsche Suche.

**Nutzt das SDK das gewählte Gerät?** Der Beweis läuft über den echten Wählweg: Gerät in der Oberfläche wählen, `getUserMedia` im Browser belauschen, auf „Anrufen" drücken. Beobachtet:

```
[{"audio":{"echoCancellation":true,"noiseSuppression":true,
           "autoGainControl":true,"deviceId":{"exact":"default"}}}]
```

**Präzise, was das belegt und was nicht:** Es belegt, dass die Anwendung genau die gewählte Kennung an die Medienschicht übergibt — mit `exact`, also ohne stilles Ausweichen. Es belegt *nicht*, dass das SDK intern ein zweites Mal nach dem Gerät fragt: Es holt keinen eigenen Strom (0 fremde Aufrufe), `setInputDevice` übernimmt den, den es bekommt. Die Prüfung wird deshalb nur rot, wenn ein Aufruf ein *anderes* Gerät verlangt.

Ein erster Entwurf lud das SDK im Prüfbrowser von Hand nach und scheiterte. Das war ohnehin der schlechtere Weg: Er hätte bewiesen, dass *das SDK* ein Gerät annimmt — nicht, dass *unsere Anwendung* es übergibt.

### Wo zu finden

| Datei | Zweck |
|---|---|
| `server/lib/fiaon-massgebliche-bestellung.ts` | die eine Auflösung + Referenzprüfung |
| `client/src/components/agent/RechnungBestaetigung.tsx` | Bestätigung vor dem Senden |
| `GET /agent/crm/kunden/:id/rechnung-vorschau` | was der Kunde bekommt (sendet nichts) |
| `POST /agent/crm/kunden/:id/nummer-land` | Ländervorwahl nachtragen, mit Protokoll |
| `scripts/mess-falsches-paket.ts` | die Messung samt 14-Tage-Bilanz |
| `scripts/pruef-massgebliche-bestellung.ts` | 37 Prüfungen |
| `scripts/pruef-nummer-nachtrag.ts` | 36 Prüfungen |

### Betreiber-TODOs

1. **Die 8 Fehlversände entscheiden** (`reports/falsches-paket.csv`). Fünf gingen an Josef Rohrmoser. Der Lauf hat nichts versandt.
2. **Einen Kunden ergänzen** — Person 11413, Nummer `6609360523`, kein Land. Kundenliste → Filter „Nummer nicht wählbar". Die ursprünglich genannten 18 brauchen nichts: Ihr Land steht in der Akte, sie werden jetzt richtig gewählt.
3. **Team die Sprechprobe machen lassen.** Bei Nikita 40 %, bei Daniel 58 % Kurzgespräche — die Probe zeigt in fünf Sekunden, ob es am Mikrofon liegt.
4. **`BETREIBER_MAIL` setzen** — sonst weckt die Tageslauf-Warnung niemanden.

## 19.08.2026 — Telefonie: der Zustand log, und die Nummer war falsch

Grundlage war die Videoauswertung eines echten Anrufs (Nikita, 19.08.). Vier abgelesene Befunde — und beim Nachmessen kam ein fünfter dazu, der schwerer wiegt als alle vier.

### Der Fund, der nicht im Auftrag stand

Beim Gegenprüfen der Nummer aus dem Video (`+49797435749`, Kunde Maurizio Pampanini, `FIAON-MSUOPDV8`):

| | |
|---|---|
| Gespeicherter Rohwert | `0797435749` |
| Land in der Akte | **CH**, Winkel |
| Richtig gewählt | `+41797435749` (079… ist eine schweizerische Mobilnummer) |
| Tatsächlich gewählt | `+49797435749` — **Deutschland** |

Im Anrufprotokoll stehen drei Versuche am 19.08. um 09:12, 09:13 und 09:13, alle mit `status = fehlgeschlagen`. Der Agent hat nicht Maurizio angerufen, sondern eine deutsche Nummer, die es so nicht gibt.

**Ursache:** `nummerNormalisieren` hatte die Vorgabe `vorwahlVorgabe = "+49"`. Eine national geschriebene Nummer (führende 0) bekam stillschweigend die deutsche Vorwahl. Über die Kundenkarte wäre es richtig gelaufen — `nummerAusZeile` kennt das Land und liefert `+41…`. Über die **Wähltastatur** griff der Rat.

**Gemessen im Bestand:** 44 Kunden haben eine national geschriebene Nummer. **18 davon wohnen nicht in Deutschland** (12 AT, 4 CH, 1 RO, 1 SK) — 18 Anrufe an fremde, teils existierende Rufnummern. Die vollständige Liste steht in `reports/nummern-geratenes-land.csv`.

**Behoben:** `wahlPruefen` bekommt das Land aus der Akte und **verweigert**, wenn keines dasteht. Eine geratene Vorwahl erzeugt keinen Fehler, sondern eine gültige Nummer, die jemand anderem gehört — dann klingelt es bei einem Fremden, dem jemand von seinem Kreditvertrag erzählt. `waehlbareNummer` machte das seit Langem richtig; die Wand stand nur nicht auf dem Tastaturweg.

**Und ein zweiter Nummern-Fehler**, bei derselben Messung gefunden: Der Ausdruck `/^(\+\d{2})0+/` nahm **zwei** Ziffern als Landesvorwahl an und fraß bei längeren Vorwahlen eine Ziffer:

```
+380677197080  (Ukraine)  →  +38677197080    Ziffer weg
+16096405036   (USA)      →  +1696405036     Ziffer weg
```

Bei der US-Nummer sah der Ausdruck „+16" als Land und nahm die Null aus der Ortsnetzkennzahl 609. Jetzt gilt die Regel nur für `+49`, `+43`, `+41` — die drei, für die sie gedacht war. Echte Ziffern-Abweichungen im Bestand: **0** (vorher 8).

### Teil 1 — Das Mikrofon: vom Hinweis zur Wand

Am 30.08. wurde ein Pegelbalken eingebaut. Das Video zeigt, warum das nicht genügt: Am Balken stand **„sehr leise", der Balken war leer — und der Anruf ging trotzdem raus.** Ein Hinweis, der einen Fehler nur beschreibt, wird im Arbeitsfluss überlesen. Wer sechzig Gespräche am Tag führt, drückt den grünen Knopf.

**Der Hauptverdächtige hat sich bestätigt.** Im Panel gab es kein `enumerateDevices`, kein `device.audio.setInputDevice` und ein `getUserMedia({ audio: true })` **ohne** `deviceId`. Das Twilio-SDK holt sich seinen eigenen Audiostrom und nimmt dafür das Gerät, das der Browser als Standard führt. Ist das ein stummes Headset oder ein Monitor-Mikrofon, spricht der Agent in nichts hinein — und hatte in der Anwendung **keine Möglichkeit, das zu ändern**. Der Balken vom 30.08. maß denselben Standard: ehrlich und trotzdem nutzlos, weil er das Problem zeigte und keinen Ausweg bot.

Jetzt:

- **Der Anrufknopf ist gesperrt**, wenn der Pegel über 3 Sekunden unter der Hörbarkeitsschwelle liegt. Aufschrift „Mikrofon prüfen" statt „Anrufen", mit Grund im Tooltip: Ein gesperrter Knopf ohne Begründung wird als Fehler gemeldet, nicht als Hinweis gelesen.
- **Gerätewahl** über `enumerateDevices`, je Mitarbeiter gemerkt (nicht je Browser — zwei Menschen an einem Rechner haben zwei Headsets) und beim Anruf über `setInputDevice` **an Twilio übergeben**. Mit `deviceId: { exact }`, nicht `ideal`: Bei `ideal` weicht der Browser stillschweigend aus, und der Agent glaubt, er spreche ins Headset, während der Ton aus dem Notebook kommt.
- **Sprechprobe:** zwei Sekunden aufnehmen, sofort abspielen. Der einzige Beweis, den ein Mensch ohne Messtechnik führen kann — einen Balken kann man falsch deuten, die eigene Stimme nicht. Die Aufnahme verlässt den Browser nicht.
- **Im Gespräch:** 8 Sekunden Stille → roter Balken „Der Kunde hört dich vermutlich nicht", und der Anruf wird als `stumm_verdacht` im Protokoll markiert. Die Warnung hilft dem Agenten, der gerade telefoniert; die Marke hilft bei der Frage, warum bei jemandem nur 2 von 158 Anrufen durchkommen.

Der Balken lag zuerst als **weiße Pille im dunkelblauen Display** — aufgefallen erst am Screenshot der Abnahme, bei grünem Build und grünem Prüfstand. Jetzt in der Sprache des Geräts.

### Teil 1.3 — Die Messung, und was sie nicht kann

7 Tage, ausgehend, je Mitarbeiter (`reports/stumme-anrufe.csv`):

| Mitarbeiter | Versuche | angenommen | **< 5 s** | 0 s | Ø s |
|---|---|---|---|---|---|
| Lucas Böhnert | 645 | 357 (55 %) | 17 | 23 | 35 |
| Nikita Boychenko | 217 | 123 (57 %) | **49** | 4 | 52 |
| Hans-Jürgen Gerhold | 132 | 84 (64 %) | 8 | 6 | 51 |
| Daniel Stripling | 39 | 24 (62 %) | **14** | 0 | 26 |

Nikita: 49 von 123 angenommenen Gesprächen unter 5 Sekunden — **40 %**. Bei Daniel 14 von 24, also 58 %. Bei Lucas 17 von 357, also 5 %.

**Aber:** Die gemeldete Quote „2 von 158" lässt sich damit **nicht** bestätigen. Über 7 Tage liegt die Annahmequote bei 55 bis 64 Prozent, bei Nikita bei 57 %. Das ist keine Reputationskatastrophe. Und die Stumm-Marke gibt es erst seit heute — für den 19.08. existiert diese Zahl nicht und lässt sich nicht rückwirkend erzeugen. „< 5 s" ist ein **Indiz, kein Beweis**: Wer abhebt und sofort auflegt, sieht in den Daten genauso aus wie einer, der nichts hört. Wer diesen Unterschied behauptet, ohne ihn messen zu können, liefert eine falsche Auskunft.

### Teil 2 — Der Zustand sagt die Wahrheit

Nach dem Klick stand „IM GESPRÄCH · 00:00" mit laufender Uhr, während beim Kunden noch nichts klingelte. Ursache war eine Zeile:

```
      c.on("warning-cleared", …);
      setZustand("gespraech");        ← unbedingt, gleich nach den Handlern
```

Der `accept`-Handler (der echte Moment des Abhebens) war korrekt — diese Zeile hat ihn nur überholt. **Das ist mehr als eine falsche Beschriftung:** Der Agent begrüßt einen Menschen, der noch nicht dran ist. Seine ersten Sätze gehen ins Freizeichen; wenn der Kunde abhebt, ist die Begrüßung vorbei. Aus dessen Blickwinkel: „nimmt ab, keiner spricht."

Vier Zustände statt drei: **Verbinde …** → **Es klingelt beim Kunden** → **Im Gespräch** (erst bei `accept`) → **Beendet**. Die Uhr läuft nur im Gespräch. Im klingelnden Zustand steht: „Warte, bis der Kunde abhebt — sprich nicht ins Freizeichen." Das Ereignis `ringing` gibt es überhaupt nur, weil das TwiML `answerOnBridge="true"` trägt.

### Teil 3 — Darstellung

Der **Kundenname** stand zweimal: Die Zeile im Kopf hatte keine Zustandsbedingung, war also in *jedem* Zustand da — im Gespräch neben dem großen Namen. Jetzt nur dort, wo die große Ansicht ihn nicht zeigt.

Für den **Übergang** tragen beide Hauptansichten `data-ansicht`. Die Blöcke schlossen sich schon vorher über `zustand === …` aus — genau das ist die Falle: Es sieht aus wie eine Garantie, ist aber eine Übereinkunft zwischen vier verstreuten Bedingungen. Der Browsertest **zählt** die Ansichten; mehr als eine ist ein Fehlschlag.

### Prüfstände

`scripts/pruef-telefon-zustand.ts` — **52 Prüfungen**: Zustandsfolge aus simulierten SDK-Ereignissen, Rot-Probe (12 Sekunden Klingeln → 0 auf der Uhr), ein spätes `ringing` wirft nicht zurück, Nummer wird nicht geraten, der Bestandsfall Maurizio ergibt `+41…`, keine Ziffer geht verloren.

Die Rot-Probe hat den Prüfstand selbst überführt: Mit wieder eingebautem Fehler blieb er **grün**. `indexOf("} catch (err)")` ohne Startposition fand ein *früheres* Vorkommen, das Ende lag vor dem Anfang, `slice` gab leeren Text — die Prüfung durchsuchte nichts. Jetzt sucht sie ab dem Anfang, und es gibt eine Prüfung darauf, dass der geprüfte Abschnitt nicht leer ist.

`scripts/pruef-telefon-bild.ts` — **14 Prüfungen im Browser**, mit vier Screenshots. Der Prüfstand drückt „Mikrofon erlauben", nagelt den Pegel auf Stille (`getByteTimeDomainData` liefert die Mittellinie), tippt eine Nummer und prüft, dass der Knopf **gesperrt** ist. Dazu die **Gegenprobe**: Mit Pegel ist er frei — sonst hinge die Sperre an etwas anderem.

Beim Bauen fielen drei eigene Fehler auf: die Telefon-Richtlinie steht in `fiaon_vertrieb_zusagen` mit `bereich = 'telefon'` (nicht in einer eigenen Tabelle, und der Schreibfehler lief in ein stilles `.catch()`); `/telefon/stand` braucht eine Attrappe, weil Twilio lokal nicht konfiguriert ist und Testkonten nicht telefonieren dürfen; und die Nummernanzeige ist ein `<input>`, dessen `innerText` immer leer ist.

### Wo zu finden

| Datei | Zweck |
|---|---|
| `client/src/lib/fiaon-mikrofon.ts` | Gerätewahl, Pegelrechnung, Schwellen an einem Ort |
| `client/src/components/Softphone.tsx` | Zustände, Sperre, Gerätewahl, Sprechprobe |
| `server/lib/fiaon-softphone.ts` | `vorwahlFuerLand`, Verweigerung statt Raten |
| `scripts/mess-stumme-anrufe.ts` | die beiden Messungen |
| `scripts/pruef-telefon-zustand.ts` / `-bild.ts` | 52 + 14 Prüfungen |

### Betreiber-TODOs

1. **Die 18 Nummern ergänzen** (`reports/nummern-geratenes-land.csv`). Bis dahin verweigert das Telefon sie — das ist die richtige Richtung, aber der Agent kann diese Kunden nicht anrufen. Der Rohwert bleibt unverändert in der Akte; es fehlt nur die Vorwahl.
2. **Team einmal die Sprechprobe machen lassen**, bevor der nächste Anruf rausgeht. Wenn Nikitas 49 Kurzgespräche am Mikrofon lagen, zeigt die Probe es in fünf Sekunden.
3. **Reputationsfrage zurückstellen.** Die 7-Tage-Zahlen (55–64 % Annahme) sprechen gegen eine Spam-Markierung. Erst messen, wenn die Stumm-Marke ein paar Tage gelaufen ist.

## 18.08.2026 — Der Tageslauf überwacht sich jetzt selbst

Der 15-Tage-Ausfall aus dem letzten Lauf war der Anlass. Ein stiller Ausfall dieser Läufe kostet direkt Geld, und es gab keine Stelle, an der man ihn sehen konnte.

### Die Diagnose — und zwei Fehlalarme, die ich fast gemeldet hätte

Acht Läufe sind registriert. Von ihnen schrieben **drei** irgendwo hin, dass sie liefen — und jeder anders (ein Datum, ein Slot-Text, noch ein Datum). Fünf schrieben **nichts**. Ob sie liefen, war nur an ihren Wirkungen zu erraten, und „nichts getan" sieht dabei genauso aus wie „nicht gelaufen".

`scripts/mess-tageslaeufe.ts` rekonstruiert deshalb je Lauf, was er hinterlassen hat — und stellt daneben die Gegenfrage „wartet überhaupt Arbeit?". Erst „keine Spur **und** Arbeit wartet" ist ein Ausfall. Diese Gegenfrage hat zwei falsche Befunde verhindert:

| Lauf | erster Befund | nach Prüfung |
|---|---|---|
| `rueckruf-eskalation` | „nie gelaufen" | **0** Rückrufe mit gerissener Frist — nichts zu tun |
| `aufnahmen-aufraeumen` | „nie gelaufen" | **0** Aufnahmen über der Frist — nichts zu tun |

Und zwei Zahlen im ersten Entwurf waren schlicht falsch:

**„154 fällige Raten ohne Rechnung — 10.622,46 €."** Das las sich wie ein Loch in der Kasse. Gemessen: `rechnung_am` ist bei **0 von 690** Raten gesetzt. Die Spalte wird in einer Migration angelegt und im ganzen Haus **nirgends beschrieben** — sie ist tot. Gleichzeitig tragen 174 Raten `erinnerungen > 0` (bis zu 7) und Mahnstufen bis 2: Diese Raten sind sehr wohl angemahnt. Der echte Fingerabdruck ist `letzte_erinnerung_at`, die Spalte, auf die der Motor selbst prüft. Ein Nachlauf auf die tote Spalte hätte **154 Kunden eine Rechnung geschickt, die sie längst haben.**

**„3.232 unverteilte Leads."** Der Filter suchte `status NOT IN ('converted','lost')` — die echten Werte sind deutsch: 2.760 `kontaktiert`, 449 `konvertiert`, **23 `neu`**. Der Rückstand ist 23. Ein Filter mit erfundenen Werten meldet den ganzen Bestand als Rückstand.

### Die echte Schadensbilanz

**Ein** Lauf ist wirklich ausgefallen: das Tageswerk im Folgelauf, 15 Tage.

| Liegengeblieben | Zahl |
|---|---|
| Überfällige Zahlungszusagen, nicht eskaliert | **96** (älteste 33 Tage; Florentine 43, Daniel 27, Lucas 17, Nikita 9) |
| Stufe-A/B-Kunden ohne Zuständigen | 4 |
| Gedriftete Stufen | 8 (die 188 aus dem Vorlauf sind bereits nachgezogen) |
| Neue Leads ohne Zuständigen | 23 |
| Fällige Raten nie angemahnt | 15 (1.359,85 €) |

Die 96 überfälligen Zusagen sind der eigentliche Schaden: Jede ist ein Kunde, der Zahlung versprochen hat und seit bis zu 33 Tagen niemandem auf den Tisch gekommen ist.

### Nachgeholt — Datenstände, keine Mails

`scripts/tageslauf-nachholen.ts`: 8 Stufen nachgezogen, 4 Kunden zugeteilt. Die 96 Zusagen brauchen keinen Schreibvorgang — sie stehen über „Überfällig" in jeder Arbeitsliste; gefehlt hat die tägliche Wiedervorlage, und die entsteht mit dem nächsten Tageswerk.

**Kein rückwirkender Mailversand.** 15 Tage Mahnungen auf einmal sind für den Kunden eine Lawine und für die Absenderdomain ein Reputationsschaden, von dem sie sich monatelang nicht erholt — wer drei Mahnungen aus der vorletzten Woche bekommt, meldet sie als Spam, und danach kommt auch die richtige Mail nicht mehr an. Rückwirkende **Termin**-Erinnerungen gibt es gar nicht: Eine Erinnerung an einen Termin von letzter Woche ist keine Erinnerung, sondern eine Verwirrung.

Zur Entscheidung des Betreibers steht die Liste im Report: 15 Zahlungserinnerungen wären im Zeitraum fällig gewesen, 0 Abo-Mahnungen, 1 vergangener Termin ohne Erinnerung. **Empfehlung: nichts nachsenden** — die laufenden Mahnstufen holen die Fälle in den nächsten Tagen ohnehin ein.

### Der eigentliche Fix: Fälligkeit statt Uhrzeit

Hier stand `if (wienStunde !== LAUF_STUNDE) return`. Der Gedanke war richtig — Mahnungen laufen morgens, nicht mitten am Tag. Die Folge war es nicht: **Ein Fenster ohne Nachhol-Logik ist eine Wette darauf, dass der Server zur richtigen Minute wach ist.** Diese Wette hat das Haus 15 Tage lang verloren.

Die Bedingung heißt jetzt: „Liegt der letzte **erfolgreiche** Durchlauf mehr als 20 Stunden zurück?" Damit läuft der Lauf weiter einmal täglich, holt aber nach, wenn er den Morgen verpasst — und zwar **genau einmal**. Gezählt wird ab dem letzten Erfolg, nicht ab dem letzten Versuch: Ein Lauf, der dreimal scheitert, bleibt fällig. Zählte man Versuche, hätte ein kaputter Lauf sich selbst stillgelegt.

20 statt 24 Stunden, weil bei exakt 24 ein Lauf von 06:05 am nächsten Morgen um 06:00 als „noch nicht fällig" gälte — die Stunde würde täglich nach hinten wandern.

Beides sitzt in `server/lib/fiaon-crons.ts`, nicht in acht Aufrufstellen: dasselbe Argument wie bei der Produktionsbremse darüber. Eine Regel, die jede Aufrufstelle selbst kennen muss, wird an der neunten vergessen.

### Selbstüberwachung

Migration 064 legt `fiaon_lauf_historie` an — eine Zeile je **Ausführung** mit Start, Ende, Dauer und Ergebnis. Drei Ergebnisse, und die Unterscheidung ist der ganze Punkt: `erfolg`, `fehler`, `uebersprungen`. Ein Lauf, der zehnmal am Tag „noch nicht fällig" sagt, ist gesund; einer, der zehnmal „Fehler" sagt, nicht. Wer beides als „lief nicht" zählt, bekommt eine Ampel, die immer rot ist — und die wird abgeschaltet.

Der Fehler wird **geschrieben**, nicht verschluckt. Genau ein stilles `.catch()` hat den Ausfall unsichtbar gemacht.

**Auf dem Dashboard** eine Karte mit Ampel je Lauf (grün < 26 h, gelb < 50 h, rot darüber) — und dem Satz, **was ausfällt**, wenn er steht. Eine Ampel ohne Folge ist eine Farbe; wer nicht weiß, was liegen bleibt, priorisiert nicht. Läuft alles, verschwindet die Karte: Eine Dauer-Anzeige „alles gut" wird nach zwei Wochen nicht gelesen, und dann wird auch die Warnung an ihrer Stelle nicht gelesen.

**Eine Warn-Mail** an den Betreiber, direkt über Brevo. Bewusst nicht über einen Make-Zweig: Diese Mail meldet, dass die Automatik steht — und der Make-Zweig ist selbst Automatik. Eine Störungsmeldung, die denselben Weg nimmt wie das Gestörte, kommt genau dann nicht an, wenn man sie braucht. Höchstens eine Mail je Lauf und Tag, sonst wären es bei einem 20-Minuten-Takt 72 am Tag, und die 73. würde ungelesen weggewischt. Dazu immer ein Eintrag ins Protokoll — eine Mail kann im Spam landen, ein Eintrag nicht.

Der Wächter hängt am bestehenden 20-Minuten-Takt und ist **kein eigener Tageslauf**: Ein eigener hätte genau dieselbe Ausfallart wie das, was er bewacht.

### Prüfstand

`scripts/pruef-lauf-ueberwachung.ts`, **51 Prüfungen**, darunter die beiden vom Auftrag verlangten Fälle:

- **Künstlich alter Zeitstempel** (Erfolg vor 15 Tagen) → Ampel rot, Überwachung erkennt ihn, Warnung würde ausgelöst, Folgensatz nennt was ausfällt. Danach wird der echte Bestand nachgezählt: unverändert.
- **Server startet um 14 Uhr nach zwei Tagen Stillstand** → erster Takt holt nach, zweiter und dritter nicht mehr, insgesamt genau einmal.

Dazu: Fehler landet mit Text in der Historie, Sperre hält Parallelläufe auseinander und verfällt nach zwei Stunden (eine Sperre ohne Verfall hält irgendwann alles an), und jeder registrierte Lauf braucht einen Folgensatz.

Diese letzte Prüfung fand zwei eigene Lücken: Sie druckte im ersten Entwurf **nichts** (die Schleife lief über eine leere Liste, weil `REGISTRIERT` sich in einem Skript nie füllt — ein Ausbleiben, das wie ein Bestehen aussieht), und nach dem Umbau auf Quelltext-Prüfung fehlte **`abo-motor`**: Er wird mehrzeilig registriert, und `grep` arbeitet zeilenweise. Genau der Lauf, an dem das Geld hängt.

### Wo zu finden

| Datei | Zweck |
|---|---|
| `db/migrations/064_lauf_historie.sql` | Historie + Warn-Sperre |
| `server/lib/fiaon-crons.ts` | `istFaellig`, `laufMitHistorie`, `laeufeUeberwachen`, `LAUF_FOLGEN` |
| `scripts/mess-tageslaeufe.ts` | Diagnose und Schadensbilanz |
| `scripts/tageslauf-nachholen.ts` | Nachholen, Vorschau + `--schreiben`, ohne Mailversand |
| `scripts/pruef-lauf-ueberwachung.ts` | 51 Prüfungen |
| `GET /admin/hub/laeufe` + `client/src/pages/admin-hub.tsx` | die Karte |

### Betreiber-TODOs

1. **`BETREIBER_MAIL` setzen.** Ohne diese Adresse geht keine Warn-Mail raus — der Protokolleintrag entsteht trotzdem, aber niemand wird geweckt. Das ist der wichtigste Handgriff aus diesem Lauf.
2. **Render-Uptime prüfen.** Die Läufe holen sich jetzt selbst ein, aber sie brauchen einen laufenden Prozess. Bei einem Dienst, der bei Inaktivität einschläft (Free/Starter), hilft ein externer Aufwecker (Cron-Ping auf eine harmlose Route) oder ein Plan ohne Spin-down. **Das ist die eigentliche Ursache des 15-Tage-Ausfalls** — der Umbau macht ihn nur verzeihlich, nicht unmöglich.
3. **Die Karte einmal ansehen.** Am ersten Tag nach dem Deploy stehen alle Läufe auf „unbekannt", weil die Historie leer ist. Nach 24 Stunden muss jeder Lauf grün sein; steht dann einer auf rot, ist er wirklich tot.
4. Der Wächter `pruef-stufen-waechter.ts` meldet weiter rot, solange `followup_last_run` alt ist. Er wird grün, sobald das Tageswerk in Produktion einmal durchgelaufen ist.

## 18.08.2026 — Teamfeedback, Teil 3: messbar machen, statt zu raten

Die letzten fünf Punkte. Zwei Messbefunde aus dem Vorlauf haben die Arbeit bestimmt: Es gibt **keine** Slot-Reservierung, und Buchungs-Fehlschläge werden **nirgends** gespeichert. Also wurde zuerst die Messbarkeit gebaut.

### Der Fund, der 15 Tage alt war

Gemeldet war nichts davon — er fiel bei der Frage auf, wie 188 Stufen driften konnten, obwohl der Nachzug im Tageslauf liegt.

**Gemessen:** `followup_last_run` stand auf **2026-08-03**, der Kalender zeigte den 18.08. **Fünfzehn Tage.**

Ausgeschlossen wurde der Reihe nach: die Funktion (`alleTierAktualisieren` direkt aufgerufen läuft durch und korrigierte weitere 3 Zeilen) und der Takt (`runVerpassteTermine` aus demselben 20-Minuten-Lauf hat am 18.08. um 02:53 gearbeitet). Übrig blieben die drei Rückgaben **über** dem Nachzug:

```
if (wienStunde !== LAUF_STUNDE) return …   // nur in der 6-Uhr-Stunde
if (s.followup_last_run === heute) return …
if (!(await holeLock(…))) return …
```

Zwei Dinge waren in einem Zeitfenster zusammengebunden, die nicht zusammengehören. Die **Verteilung** und die Mahn-Staffel dürfen genau einmal am Tag laufen — zweimal hieße zwei Mails an denselben Menschen. Die **Einstufung** ist eine Korrektur: idempotent, sie schreibt nur abweichende Zeilen, sie kostet eine Abfrage. Sie an dasselbe Fenster zu binden heißt, dass ein verpasster Morgen einen Tag falscher Arbeitslisten kostet — und bei fünfzehn verpassten Morgen liegen 142 Kunden mit offener Rechnung im kalten Fach.

Die Einstufung steht jetzt **vor** den Sperren und läuft bei jedem Takt. Und das `.catch()`, das den Fehler nur auf die Konsole schrieb, ist weg: Ein stiller Programmfehler an dieser Stelle hätte genau diesen Schaden erzeugt, ohne dass jemand es merkt.

`scripts/pruef-stufen-waechter.ts` ist der Wächter für den Tageslauf: 0 Abweichungen im Altbestand, keine Zahlung auf Stufe C, kein Bezahlter ohne Zuständigen — und die Frage, die 15 Tage niemand gestellt hat: **ist der Tageslauf durchgekommen?** Diese eine Prüfung ist derzeit **rot** und soll es bleiben, bis der Betreiber sie grün gemacht hat.

Der Wächter hat sich dabei selbst korrigiert: Sein erster Entwurf meldete „Person 5123 steht auf Stufe C mit bezahlter Bestellung". Nachgesehen — die Ableitung sagt ebenfalls Stufe 3, und zwar zu Recht: Die bezahlte Bestellung ist **archiviert**. Eine Prüfung mit einem weiteren Begriff als die geprüfte Regel meldet Fehler, die es nicht gibt, und ein Wächter mit Fehlalarmen wird abgeschaltet. Er benutzt jetzt `antragBasisSql` — denselben Ausschnitt wie die Regel.

### Buchungsversuche sind jetzt zählbar

„Die Buchung funktioniert unabhängig von der Uhrzeit nicht zuverlässig" war **nicht prüfbar**: Ein Fehlschlag hinterließ eine Konsolenzeile und sonst nichts — keine Häufigkeit, kein Grund, kein Muster über die Uhrzeit.

Migration 062 legt `fiaon_termin_versuche` an. **Jeder** Ausgang der Buchungsroute schreibt eine Zeile, der erfolgreiche auch: 12 Ablehnungen sind bei 15 Versuchen ein Notfall und bei 4.000 ein Rundungsfehler — eine Zahl ohne ihren Bezug ist keine Messung. Gespeichert werden Zeitpunkt, Person, gewählter Slot, Ergebnis, Grund-**Code** und Quelle; Codes bleiben stabil, Texte werden umformuliert.

Die Karte „Buchungsversuche · 7 Tage" steht in der Termin-Zentrale, mit Gründen und einer Aufschlüsselung nach Stunde — die Uhrzeit-Behauptung ist damit direkt prüfbar. Solange nichts aufgelaufen ist, sagt sie das ausdrücklich, statt eine grüne Null zu zeigen: der Unterschied zwischen „ist in Ordnung" und „ich kann es nicht messen".

**Und sofort, unabhängig von der Messung:** Jede Ablehnung nennt dem Kunden einen Grund, den er versteht. Statt „Dieser Termin ist nicht mehr frei" steht dort jetzt, wie viele Zeiten noch zur Auswahl stehen — oder, wenn alle belegt sind, dass er die Seite später neu laden soll. Ein abgelaufener Link sagt, dass sein Ansprechpartner einen neuen schickt. Ein Serverfehler sagt ausdrücklich, dass der Fehler bei uns liegt und nicht bei ihm.

`scripts/pruef-termin-versuche.ts`: **35 Prüfungen** — doppelte Buchung desselben Slots wird abgelehnt, mit Grund-Code, mit einem Text, der zum Handeln auffordert, und mit Protokollzeile. Dazu der Nachweis, dass jeder Grund-Code einen Klartext hat, und eine Quelltext-Prüfung, dass kein Ausgang ohne Protokoll bleibt.

**Keine Slot-Reservierung gebaut** — wie besprochen. Die Messung aus dem Vorlauf hatte gezeigt, dass `slotsVerknappen` auch bei der Buchung läuft: Anzeige und Prüfung sehen dieselbe verengte Liste, der vermutete 5er-Fenster-Effekt ist nicht der Fehler. Eine Reservierung hätte ein Problem gelöst, das nicht existiert, und dabei Slots blockiert.

### Die Termin-Art steht überall

Vier Anzeigen hatten vier eigene Erfindungen aus derselben Spalte: „Kunde hat gebucht", „Nicht erreicht — Terminlink", „Startgespräch", nichts. Keine sagte dem Agenten, worauf er sich einstellt — „Kunde hat gebucht" beschreibt den **Weg**, nicht das Gespräch.

`shared/fiaon-termin-art.ts` leitet aus der Quelle drei Arten ab: **Onboarding** (bezahlt, freischalten), **Vertrieb** (noch nicht bezahlt, beraten), **Rückruf** (selbst notiert). Ein unbekannter Quellwert wird nicht geraten — er läuft auf „Vertrieb" und sagt das im Grund, damit er auffällt.

Sichtbar in Kalender, oberer Leiste, Termin-Zentrale (neue Spalte „Art") und Startgespräch-Liste. Der Weg bleibt daneben stehen: „vom Kunden gebucht" ist verbindlicher als eine eigene Notiz — das soll man weiter sehen, nur nicht **anstelle** der Art.

In den Mail-Payloads `termin_bestaetigung` und `termin_erinnerung` fährt `termin_art` mit, ebenso im Ereignis-Register. **Betreiber-TODO:** in Brevo als `{{params.termin_art}}` einsetzen. Bis dahin wird das Feld übertragen und nicht angezeigt — es schadet nichts und wartet.

### Blockier-Marke im Forderungsmanagement

Der Vertrieb hatte sie, das Inkasso nicht — und gerade dort blockieren Menschen die Nummer. Ohne den Knopf blieb nur „Nicht erreicht", und die Rate kam am nächsten Tag wieder auf den Tisch: Der Agent wählte dieselbe Nummer, die ihn wegdrückt, bis zur Eskalationsstufe.

„Nummer blockiert uns" markiert die Nummer und legt die Rate **30 Tage** still. Nicht `NULL`: Die Arbeitsliste zeigt Raten mit leerer Wiedervorlage sofort wieder an — „aussetzen" heißt hier ein Datum in der Zukunft, nicht das Löschen des Datums.

Eine Feinheit mit Folgen: Alle Ratenergebnisse landen als `rate_<art>` im Verlauf. Dieser eine Fall trägt die **hausweite** Schreibweise `nummer_blockiert`, weil `fiaon-uebergabe.ts` genau darauf abfragt, um zu wissen, bei welchem Kollegen ein Kunde schon blockiert hat. Als `rate_nummer_blockiert` wäre die Tatsache für diese Abfrage unsichtbar gewesen — zwei Schreibweisen für dasselbe, und die Übergabe schickt den Kunden an jemanden, der längst weggedrückt wurde.

### Einweg-Audio: sehen statt vermuten

„Der Kunde nimmt ab, aber es spricht niemand." Das Panel wusste bisher nur, ob das Mikrofon **erlaubt** ist. Erlaubt heißt nicht, dass es liefert: stummes Headset, falsches Eingabegerät, Schalter am Kabel — in allen drei Fällen sagt der Browser „erlaubt" und überträgt Stille.

**Ein Pegelbalken vor dem ersten Anruf.** Keine automatische Prüfung: Stille ist ein zulässiger Zustand, solange niemand spricht. Der Mensch sagt „Test" und sieht in einer halben Sekunde, ob es ankommt. Bernstein bei Stille, nicht Rot — Stille ist ein Hinweis, kein Fehler.

**Eine Warnung im Gespräch**, wenn der Eingang über **10 Sekunden** bei null liegt. Kürzer wäre ein Fehlalarm bei jeder Sprechpause.

**Und der Weg dazu:** ICE- und Verbindungszustände werden am Anruf festgehalten (`failed`, `disconnected`, `connected`) samt Twilios eigenen Warnungen. Bei Einweg-Audio ist typischerweise der Medienpfad in eine Richtung nicht aufgebaut — sichtbar nur im ICE-Zustand, und der lebt im Browser und ist nach dem Auflegen weg. Der Server **deutet nicht**, er hält fest.

### Anrufstatistik — und was sie nicht kann

Die 7-Tage-Tabelle steht in der Termin-Zentrale: Versuche, angenommen, Annahmequote, abgelehnt/besetzt, fehlgeschlagen, ohne Rückmeldung, Ø-Dauer, je Mitarbeiter, je Tag.

**Was sie nicht kann, steht dabei.** Eine echte Klingeldauer ist nicht messbar: Es gibt keinen Zeitstempel für „angenommen", und Twilios `no-answer` und `busy` landen beide auf demselben Wert `abgelehnt`. `dauer_sek` ist die **Gesprächszeit**. Eine erfundene Klingeldauer hätte die Reputationsfrage falsch beantwortet.

Ein Hinweis ist enthalten, kein Urteil: die Zahl der Gespräche unter 5 Sekunden. „Abgenommen und sofort aufgelegt" ist das Muster eines Spam-Verdachts.

**Der Schutz:** Einstellung „max. Anrufe je Nummer je Tag", Vorgabe **100**, 0 = keine Grenze. Sie sitzt in der Route, die den Zugangsausweis ausstellt — ohne ihn kann der Browser nicht wählen. Ein Schutz in der Oberfläche wäre eine Bitte. Der Zähler ist im Panel sichtbar, **bevor** der Knopf nicht mehr geht: Eine Grenze, die erst beim Anschlagen sichtbar wird, ist eine Überraschung.

Migration 063 ergänzt `fiaon_calls.von_nummer`. Die Spalte fehlte: `nummer` ist die **gewählte** Nummer. Alte Zeilen bleiben NULL und werden der heute konfigurierten Nummer zugerechnet — damals gab es genau eine. Ein rückwirkendes Befüllen wäre eine Behauptung über Daten, die wir nicht haben. Sobald eine zweite Nummer dazukommt, trennt die Zählung sauber.

### Der Testkonto-Schalter

Bestätigt: `Justin Schwarzott` trägt die Marke `is_test_account` **zweimal** (Agent 2 und 7), beides echte Konten, angelegt am 04.07.2026. Da jede Team-Ansicht über `echteMitarbeiterSql()` filtert, fallen sie aus der Zentrale, aus den Kennzahlen und aus der Verteilung heraus — sie existieren und kommen nirgends vor.

Ein Skript hätte die zwei Zeilen korrigiert. Aber die Marke wird weiter gesetzt — von jedem Prüfstand, der ein Konto stilllegt —, und irgendwann trifft es wieder ein echtes Konto. Deshalb ein Schalter in der Team-Zentrale, wo der Betreiber das Konto sieht.

Er weckt **kein** stillgelegtes Konto auf: `testkontoStilllegen` setzt drei Dinge (Marke, `active = FALSE`, gelöschtes Passwort). Nur die Marke zurückzunehmen würde ein Konto in die Zentrale holen, das niemand benutzen kann — die Antwort sagt das ausdrücklich. Und greift noch das Namensmuster, steht auch das dabei, statt den Betreiber rätseln zu lassen.

### Wo zu finden

| Datei | Zweck |
|---|---|
| `db/migrations/062_termin_versuche.sql` | Protokoll der Buchungsversuche |
| `db/migrations/063_anruf_absendernummer.sql` | `von_nummer` für die Tagesgrenze |
| `server/lib/fiaon-termine.ts` | `versuchProtokollieren`, `VERSUCH_GRUND_TEXT` |
| `scripts/pruef-termin-versuche.ts` | 35 Prüfungen |
| `shared/fiaon-termin-art.ts` | die drei Arten, an einem Ort |
| `server/lib/fiaon-inkasso.ts` | `nummer_blockiert` als Ratenergebnis |
| `client/src/components/Softphone.tsx` | Pegelbalken, Stille-Warnung, ICE-Protokoll |
| `server/lib/fiaon-softphone.ts` | `nummerKontingent`, `maxAnrufeJeNummer` |
| `server/routes/fiaon-team.ts` | `POST /admin/agents/:id/testkonto` |
| `scripts/pruef-stufen-waechter.ts` | der tägliche Wächter |

### Betreiber-TODOs

1. **Der Tageslauf ist seit dem 03.08.2026 nicht durchgekommen** (`followup_last_run`). Die Einstufung läuft jetzt unabhängig davon, aber **Verteilung, Mahn-Staffel und Eskalationen hängen weiter am 6-Uhr-Fenster** — das ist der dringendste Punkt aus diesem Lauf. Der Wächter meldet es täglich. Verdacht: Der Dienst läuft in der 6-Uhr-Stunde (Wien) nicht. Ein Blick in die Render-Uptime beantwortet es.
2. **`{{params.termin_art}}`** in die Brevo-Vorlagen `termin_bestaetigung` und `termin_erinnerung` aufnehmen.
3. **Nummern-Reputation prüfen** (tellows, CleverDialer), SHAKEN/CNAM beim Anbieter klären. Twilio-seitige Verdächtige für Einweg-Audio, die nur der Betreiber sehen kann: **Region** des Twilio-Edge (bei DACH-Kunden auf `de1`/`dublin` statt US), **Codec** (Opus gegen PCMU im TwiML) und die **Media-Berechtigungen** des SIP-Trunks. Der ICE-Zustand aus dem Panel sagt jetzt, in welchen Gesprächen es passiert ist — die Ursache steht in Twilios Console daneben.
4. **Zweite Absendernummer** erwägen. Die Tagesgrenze schützt eine Nummer, ersetzt sie aber nicht.
5. **Agent 2 und 7** über den neuen Schalter entmarkieren, falls sie im Team erscheinen sollen.

## 18.08.2026 — Teamfeedback, Teil 2: Telefonie, Termine, Stufen

Fortsetzung des Feedback-Auftrags. Reihenfolge nach klarer Spur: erst das Doppelpräfix, dann der hängende Termin-Abschluss, dann Stufen und Betreuer.

### Das Doppelpräfix +49 +49 war ZWEI Fehler, und der zweite war der gefährlichere

Gemeldet: *„Im Forderungsmanagement steht +49 +49 vor der Nummer. Im Vertrieb ist sie richtig."*

Der Unterschied lag nicht in den Daten, sondern im Weg: Der Vertrieb bekommt vom Server ein fertiges Feld, das durch `waehlbareNummer` gelaufen ist. Das Inkasso bekam die Rohwerte und setzte sie in der Oberfläche selbst zusammen — an **zwei** Stellen:

```
${vorwahl || "+49"}${nummer.replace(/^0/, "")}
```

Trug die Nummer schon ein „+", entstand `+43+436642204641`. Das `replace(/^0/)` greift nicht, weil die Nummer mit einem Plus beginnt und nicht mit einer Null.

**Gemessen** (`scripts/mess-doppelpraefix.ts`):

| Befund | Zahl |
|---|---|
| Zeilen in der Arbeitsliste | 385 |
| davon mit Doppelpräfix in der Anzeige | **21** |
| Bestellungen mit Doppelpräfix im Rohwert | 0 |
| Personen mit Doppelpräfix in `primary_phone` | **39** |
| Bestellungen mit Nummer **und** getrennter Vorwahl | 3.248 |
| davon: Nummer trägt schon ein „+" | 20 |

**Der zweite Fehler in derselben Zeile:** Der Rückfall `|| "+49"` hängte eine **deutsche** Vorwahl an **österreichische** Nummern. Bei „Christa Kainz" stand `+436641924910` ohne getrennte Vorwahl — die Oberfläche baute `+49+436641924910`. Hätte man nur das doppelte Plus entfernt, wäre `+4943664…` gewählt worden: ein fremder Teilnehmer. AGENTS.md sagt es seit dem ersten Tag, und `waehlbareNummer` hat dafür Regel 5 — ohne Vorwahl wird die Nummer angezeigt, aber **nicht** wählbar gemacht, und der Grund steht dabei.

Die Arbeitsliste liefert jetzt `telefonAnzeige`, `telefonWaehlbar` und `telefonHinweis` aus derselben Funktion wie der Vertrieb. Beide Stellen in der Oberfläche sind entfernt; wo keine wählbare Nummer existiert, steht der Grund statt eines Knopfes, der ins Leere ruft. Der Bestand ist bereinigt: **39 → 0**, alte Werte als Alias gesichert.

`scripts/pruef-inkasso-nummer.ts`: **40 Prüfungen** über fünf Konstellationen (AT mit/ohne Vorwahl, DE mit Plus, national, `0049`) — jede gegen die echte Antwort der Arbeitsliste, nicht gegen die Hilfsfunktion allein. Ein Prüfstand an `waehlbareNummer` wäre grün geblieben, während der Fehler bestand.

### „Nicht erschienen — bitte abschließen" war eine Aufforderung ohne Handlung

Gemeldet: *„Der Abschluss-Schritt ist nicht erreichbar."*

**Gemessen:** 47 Termine auf `verpasst`, davon **19 mit gesetztem `erledigt_am`** — also abgearbeitet. Sie standen trotzdem im Kalender, mit einem Satz, der eine Handlung verlangte, die es nicht gab: Ein weiterer Klick auf „Nicht erschienen" schrieb denselben Zustand noch einmal, die Karte verschwand kurz und war beim nächsten Laden zurück. Bei **Lucas Böhnert lagen 26** solche Karten.

`verpasst` ist **zwei** Zustände, und die Kalenderabfrage hat sie in einen Topf geworfen:

- `erledigt_am IS NULL` → der 12-Stunden-Nachlauf hat markiert, **kein Mensch** hat es bearbeitet, die Folge-Einladung ist nicht gelaufen. Offene Arbeit — die Karte bleibt.
- `erledigt_am IS NOT NULL` → geklickt, Fehlversuch gezählt, Folge-Einladung gelaufen. **Fertig** — die Karte geht.

Beide Listen (Kalender und Terminliste) grenzen jetzt so ein, mit demselben Wortlaut. Die alte Begründung („ein verpasster Termin ist Arbeit, nicht Vergangenheit") steht als Kommentar darüber — sie war richtig, sie galt nur für einen der zwei Zustände. Der Text am Termin sagt jetzt, **was** zu tun ist, statt eine Handlung zu verlangen, die nicht existiert.

`scripts/pruef-nicht-erschienen.ts`: **14 Prüfungen** über den ganzen Weg (gebucht → Nachlauf → sichtbar → Klick → weg), plus die Gegenprobe, dass der Abschluss den Fehlversuch **zählt** und nicht bloß versteckt. Rot-Probe mit der alten Bedingung: genau die eine entscheidende Prüfung wird rot.

### Stufen: der gemeldete Fall existiert nicht — ein größerer schon

Gemeldet: *„Kunden mit gemeldeter oder eingegangener Zahlung stehen auf Stufe C."*

**Gemessen: 0.** Die Ableitung kann das nicht: `claimed_paid` → Stufe 1 (A), `paid` → Stufe 0 (Bestandskunde). Aber `priority_tier` ist eine **Spalte**, keine Rechnung — und der Vergleich mit der Ableitung fand **181 Abweichungen**, darunter:

- **142** gespeichert als Stufe 3 (kalt), abgeleitet Stufe 2 („Rechnung offen") — 142 Kunden mit offener Rechnung lagen im kalten Fach.
- **6** gespeichert als Stufe 0 (bezahlt), abgeleitet Stufe 2 — eine offene Rechnung, verdeckt von einer bezahlten Bestellung.

Der **Kern** der Meldung war also richtig (Kunden im falschen Fach), der genannte Zahlungsstatus nicht. `scripts/tier-backfill.ts --apply` hat **188 Zeilen** nachgezogen, verbleibende Abweichungen **0**. Der Nachzug liegt bereits im Tageslauf (`fiaon-followup.ts`) — dass 188 driften konnten, gehört als Betreiber-TODO in die Beobachtung.

### Bezahlte ohne Betreuer: 88, und die Ursache war eine Zeile mit guter Absicht

**Gemessen:** 88 bezahlte oder gemeldete Personen ohne Zuständigen — und nur **eine** davon hatte einen Agenten an der Bestellung. Es fehlte also wirklich.

`sofortZuteilen` schloss Stufe 0 aus, mit der Begründung „ein Bestandskunde ist aus dem Vertrieb heraus". Wer als Stufe 1 oder 2 zugeteilt worden wäre, ist beim Bezahlen längst zugeteilt; übrig blieben die **Direktzahler**. Für die griff die Zuteilung nie, und nach dem Bezahlen nie wieder. Ein bezahlter Kunde ohne Zuständigen hat niemanden, der sein Startgespräch führt.

Zweiter Fund im selben Zweig: Der **Besitzschutz** lehnte 28 Personen ab („betreut seit … — Besitzschutz"), ohne den Betreuer einzutragen. Diese Stelle wird nur erreicht, wenn `assigned_agent_id` **leer** ist — die Personen blieben also bei niemandem, geschützt für einen Betreuer, der nirgends stand. Der Betreuer ist ableitbar (`betreuerVon`) und wird jetzt nachgetragen.

**Zählprobe: 0 bezahlte Personen ohne Zuständigen.**

### Ein Fehler, den dieser Lauf selbst gemacht hat

Der erste Entwurf des Betreuer-Nachtrags fragte nur „aktiv und kein Testkonto" — und schrieb daraufhin **28 bezahlte Kunden dem Forderungsmanagement zu** (Hans-Jürgen Gerhold, Diana Zeller). Denn `betreuerVon` liest jeden dokumentierten Kontakt, und wer eine Rate eingetrieben hat, steht auch im Verlauf.

Das widerspricht einer Regel, die seit dem 11.08.2026 im Code steht: *„Das Forderungsmanagement hat NUR die Kunden, die ihr Abo nicht bezahlt haben."* Die 28 Zuteilungen sind zurückgenommen und neu verteilt; der Bestand bei Sonderrollen ist wieder bei 3 (dem Stand von vorher).

Aufgefallen ist es an den **Namen im Protokoll** — nicht an einer Prüfung. Deshalb gibt es jetzt eine: `scripts/pruef-zuteilung-rollen.ts`, **21 Prüfungen**, darunter „ein Inkasso-Kontakt macht niemanden zum Vertriebs-Betreuer" und die Gegenprobe „ein Vertriebs-Kontakt wird sehr wohl nachgetragen". Rot-Probe ohne den Rollenfilter: genau die zwei Prüfungen werden rot. Eine Regel, die ich selbst gebrochen habe, braucht keine Erinnerung, sondern eine Wand.

### Die Zahlungsansicht las die falsche Quelle

Gemeldet: *„Zahlung eingegangen — ohne Betreuer."* Teilweise war das ein Anzeigefehler.

**Gemessen** an 662 bezahlten Bestellungen: **59** tragen an der Bestellung einen anderen Agenten als an der Person, und bei **36** hat **nur die Person** einen. Genau diese 36 zeigten „ohne Betreuer", obwohl ein Zuständiger eingetragen war. Die Bestellung führt eine Abschrift der Zuständigkeit, und die läuft nach Zusammenführungen auseinander. Die Suche liest jetzt die **Person** zuerst, die Bestellung als Rückfall, und liefert die Quelle mit.

Dazu die Provision: Von 409 bezahlten Bestellungen haben **244** eine gebuchte Provision, **104** den Vermerk „Direktzahler", **61 weder noch**. Bisher blieb das Feld in allen drei Fällen leer. Jetzt steht dort der Betrag, oder „Direktzahler — keine Provision", oder „kein Vermerk — bitte prüfen". Eine sichtbare Lücke ist ehrlich; eine gefüllte wäre eine Behauptung.

### Wo zu finden

| Datei | Zweck |
|---|---|
| `scripts/mess-doppelpraefix.ts` | Anzeigefehler und Datenfehler getrennt gemessen |
| `scripts/doppelpraefix-bereinigen.ts` | Bestandslauf, Vorschau + `--schreiben`, Alias-Sicherung |
| `scripts/pruef-inkasso-nummer.ts` | 40 Prüfungen an der echten Arbeitsliste |
| `server/lib/fiaon-inkasso.ts` | `telefonFelder` — eine Normalisierung für Anzeige und Wahl |
| `scripts/pruef-nicht-erschienen.ts` | 14 Prüfungen, ganzer Weg + Rot-Probe |
| `scripts/mess-stufen-betreuer.ts` | Spalte gegen Ableitung, Betreuer-Lücken, Provisionslage |
| `scripts/bezahlte-ohne-betreuer.ts` | Bestandslauf über `sofortZuteilen` (keine zweite Verteilung) |
| `scripts/pruef-zuteilung-rollen.ts` | 21 Prüfungen — die Wand gegen die Rollenverwechslung |

### Offen

**Telefonie:** Blockier-Marke im Inkasso-Panel, Einweg-Audio (Mikrofonpegel, ICE/Codec-Log), Erreichbarkeits-Statistik und die Einstellung „max. Anrufe je Nummer je Tag". **Termine:** Termin-Art in jeder Anzeige, Slot-Reservierung für 10 Minuten. Die Fundstellen sind kartiert (u. a.: es gibt **keine** Reservierung, nur den Unique-Index auf `(agent_id, beginn)`; Buchungs-Fehlschläge werden **nirgends** in der Datenbank protokolliert, nur auf die Konsole — eine 7-Tage-Statistik ist ohne neue Tabelle nicht messbar). Ohne Messung wird dort nichts geändert.

### Betreiber-TODOs

1. **Nummern-Reputation prüfen** (tellows, CleverDialer), SHAKEN/CNAM beim Anbieter klären. Die Erreichbarkeits-Meldung (2 von 158) ist ohne die Anrufstatistik nicht zuzuordnen — sie steht noch aus.
2. **Buchungs-Fehlschläge sind nicht protokolliert.** Für die Auswertung braucht es entweder eine Tabelle oder Zugriff auf die Server-Logs von Render.
3. **188 Stufen sind gedriftet**, obwohl der Nachzug im Tageslauf liegt. Bitte beobachten, ob der Tageslauf in Produktion durchläuft.
4. **Zwei echte Konten sind als Testkonto markiert** (`Justin Schwarzott`, ID 2 und 7) — sie fallen aus jeder Team-Ansicht heraus. Unverändert aus dem letzten Lauf.

## 18.08.2026 — Teamfeedback: erst gemessen, dann repariert

Dreizehn Meldungen aus dem Team. Der Auftrag lautete ausdrücklich: nichts anfassen, bevor die Ursache gemessen ist — mehrere Meldungen können dieselbe Wurzel haben. Genau das war der Fall.

### Der Verdacht, der sich NICHT bestätigt hat

Gemeldet war: *„Beim Öffnen/Anrufen verschiedener Kunden erscheinen dieselben Stammdaten (Adresse, E-Mail, Paket)."* Der Verdacht lag auf der Zusammenführung — sie habe über Platzhalter-Werte (0000, info@, Firmennummern) fremde Menschen verschmolzen.

**Gemessen** (`scripts/mess-fehlmerges.ts`, nur lesend):

| Frage | Messwert |
|---|---|
| Protokollierte Zusammenführungen | **742** (+55 aus der Zeit vor dem Protokoll) |
| E-Mail-Werte bei mehr als 3 Personen | **0** |
| Rufnummern bei mehr als 3 Personen | **61** |
| … davon mit genau EINEM Nachnamen (Tippfehler zusammengefasst) | **58** — derselbe Mensch, mehrfach angelegt |
| … davon echte Sammelwerte | **3** (zwei davon Datenmüll im Namensfeld, einer die Attrappe `0701234567`) |
| Merges über die Attrappen-Nummer | **0** — `istAttrappenNummer` hält sie schon heute |
| Merges mit gleichem Geburtsdatum auf beiden Seiten | **625** |
| … Abweichung an einer Stelle (Tippfehler) | **11** |
| … weitere Abweichung | **9**, davon 6 an einem Testnamen |
| **Fehl-Merges (zwei verschiedene Menschen)** | **0** |

Die drei Grenzfälle wurden einzeln nachgesehen (Lechner, Richter, Kremer): gleiche Adresse, gleiche Rufnummer, gleiche E-Mail — bei Richter unterscheidet sie sich nur um das abgeschnittene „m" in `outlook.co.`. Es sind dieselben Menschen mit einem vertippten Geburtsdatum.

**Wichtig für die Einordnung:** Die Häufigkeitszählung war im ersten Entwurf wertlos. Sie zählte nur *lebende* Personen und meldete „kein Wert kommt öfter als zweimal vor" — was wie ein sauberer Bestand aussah und das Gegenteil eines Befundes war: Wenn ein Wert fünf Sätze verschmolzen hat, steht er danach an EINER lebenden Person. Die Zusammenführung löscht die Häufigkeit, die sie verursacht hat. Gezählt wird jetzt über alle Personensätze einschließlich der Wegweiser.

**Es wurde deshalb nichts getrennt.** Ein Undo über 742 Merges hätte 742 Dubletten erzeugt, um ein Problem zu lösen, das es nicht gibt.

### Die echte Ursache der Meldung

Sie stand im Telefon-Panel (`client/src/components/Softphone.tsx`): Der Ladewächter für die Gesprächsdaten hieß `!gespraechsDaten`, und die Abhängigkeitsliste des Effekts nannte nur den Gesprächszustand. Nach dem **ersten** Anruf war das Feld gefüllt — damit war die Bedingung für jeden weiteren Anruf falsch, und es wurde nie wieder geladen. Zurückgesetzt hat es niemand: die Setz-Funktion kam im ganzen Bauteil genau einmal vor.

**Jeder Anruf ab dem zweiten zeigte die Daten des ersten Kunden** — und zwar genau die fünf Felder aus der Meldung: Paket, Offen, Verwendungszweck, E-Mail, Ort.

Der naheliegende Weg wäre gewesen, an alle acht Stellen, die den Kunden wechseln, ein Zurücksetzen zu hängen. Das ist die Regel, die drei Oberflächen einzeln kennen müssen — an der vierten wird sie vergessen. Stattdessen **trägt der Datensatz jetzt, zu wem er gehört**, und die Anzeige vergleicht das mit dem aktuellen Kunden. Ein vergessenes Zurücksetzen kann keine fremden Stammdaten mehr einblenden.

### Zwei Meldungen, eine Zeile

Gemeldet waren zwei verschiedene Dinge:

- *„E-Mail ergänzt / Paket angelegt — der Zahlungsdaten-Versand bleibt trotzdem gesperrt."*
- *„Produkt anlegen: keine Bestellung vorhanden."*

Beide kamen aus **einer fehlenden Zeile**. Die Oberfläche leitet den Sperrgrund aus den Buchungen der Karte ab. Dieses Feld lieferte nur die *Listen*-Abfrage — die Antwort für die *einzelne* Karte kannte es nicht. Nach jeder Änderung lädt die Oberfläche die Karte einzeln nach und ersetzte damit eine gefüllte Buchungsliste durch `undefined`.

**Die Aktualisierung hat die Daten nicht bloß nicht erneuert — sie hat sie gelöscht.** Deshalb wurde es schlimmer, je mehr der Agent tat: Wer die E-Mail nachtrug, sperrte sich damit den Versand. Und der Produkt-Dialog, der sich eine Referenz aus denselben Buchungen holt, meldete „keine Bestellung".

`kartePayload` liefert die Buchungen jetzt durch **dieselbe** Aufbereitungsfunktion wie die Liste. `scripts/pruef-karte-buchungen.ts` prüft das über echtes HTTP mit einem Testkonto (10 Prüfungen). Die Rot-Probe: Ohne die Zeile werden genau 6 Prüfungen rot, darunter „Der Produkt-Dialog findet eine Referenz" — der Beweis, dass beide Meldungen dieselbe Wurzel hatten.

### Ein Mensch, ein Forderungsmanager

Gemeldet: *„Ein Kunde steht bei Hans UND bei Diana."* Das war kein Anzeigefehler, sondern ein Entwurfsfehler: Die Zuteilung verteilte pro **Rate** an den mit der kleinsten Last. Ein Kunde mit mehreren offenen Raten landete dadurch bei zwei Menschen.

**Gemessen:** 7 Personen mit offenen Raten bei zwei Zuständigen — jedes Mal im Muster „Hans-Jürgen 1 Rate, Diana der Rest". Für den Kunden heißt das zwei Mahnanrufe von zwei Fremden, die nichts voneinander wissen.

Die Regel gilt jetzt auf **Personen**-Ebene: Hat die Person schon einen Zuständigen, folgen alle weiteren Raten diesem Menschen; erst wenn sie niemanden hat, greift die kleinste Last. Und die Last wächst nur bei einer neuen Person — sonst würde ein Kunde mit zwölf Raten die Mannschaft zwölffach belasten. Die alte Regel steht im Wortlaut im Kommentar darüber; sie war nicht dumm, sie hatte eine Folge, die niemand wollte.

`scripts/inkasso-eine-zustaendigkeit.ts` hat den Bestand nachgezogen: 7 Raten umgehängt, Zählprobe **0 Personen mit mehr als einem Zuständigen**, jede Akte mit Verlaufseintrag.

### Zwei Zuständigkeiten, zwei Beschriftungen

Gemeldet: *„Diana & Nikita gleichzeitig."* Beides stimmte — ein Mensch hat eine Betreuung im Vertrieb und ein Forderungsmanagement. Nur stand an sieben Stellen „betreut von X" ohne Rolle, und zwei Namen ohne Beschriftung lesen sich wie ein Widerspruch.

Die Wörter stehen jetzt einmal in `shared/fiaon-zustaendigkeit-text.ts` und werden gelesen: **„Betreuung Vertrieb"** und **„Forderungsmanagement"**, beide immer beschriftet. Ein fehlender Name wird „niemand" — ein leeres Feld sieht wie ein Anzeigefehler aus, „niemand" ist eine Aussage. Die Kundenakte zeigt beide Felder nebeneinander; dafür liefert die Akten-Route den Inkasso-Zuständigen mit.

### Die Regel für die Zusammenführung ist härter — aber nicht dümmer

Beauftragt waren drei Verschärfungen. Eine davon wurde **nach Messung verworfen**: „Auto-Merge nur, wenn der Match-Wert im Bestand eindeutig ist" hätte 58 der 61 mehrfach belegten Rufnummern blockiert — also genau die Fälle, für die das Werkzeug gebaut wurde („Laschinger" liegt 20-mal mit derselben Nummer). Eine Bremse, die bei jedem zweiten Fall grundlos auslöst, schaltet nach dem zweiten Lauf jemand ab.

Eingebaut ist die **Widerspruchs-Wand**: Vor allen Kriterien wird geprüft, ob ein hartes Zweitmerkmal *widerspricht* — Nachname, Geburtsdatum (ab zwei abweichenden Stellen; eine ist ein Tippfehler), oder Straße **und** PLZ gemeinsam. Trifft das zu, entsteht keine automatische Zusammenführung; das Paar bleibt Kandidat für einen Menschen und der Ausschlussgrund nennt das Merkmal.

„Widerspricht" statt „muss übereinstimmen" ist gemessen: Die strenge Fassung hätte 27 Merges verhindert, 4 davon nur, weil ein Nachname *fehlte*. Eine Lücke ist keine Aussage — genau so behandelt die Maschine seit dem ersten Tag die Vornamen. Insgesamt macht die Wand **52 von 742** Merges (7 %) zu Kandidaten.

Der Prüfstand fand dabei sofort eine eigene Lücke: „Wien Wien" (eine Stadt in beiden Namensfeldern) gegen „Milan Acimovic" ist derselbe Mensch, und der Lauf übernimmt danach ausdrücklich den saubereren Namen. Ein strenger Nachnamen-Vergleich hätte diese Reparatur verhindert — zwei Prüfungen, die es seit Wochen gibt, wurden rot. **Ein unbrauchbarer Name widerspricht deshalb nicht**; die Formbewertung, die es schon gab, entscheidet das.

8 neue Prüfungen in `scripts/pruef-massen-merge.ts` (92 grün). Rot-Probe: Ohne die Wand werden 5 rot, und die drei „muss trotzdem zusammengeführt werden"-Prüfungen bleiben grün.

### Was gemessen wurde und KEIN Fehler war

*„Lucas sieht nur Leads."* Gemessen: Lucas hat **1.154 Kunden** zugewiesen, davon **879 in der Tagesliste** — dieselbe Größenordnung wie seine Kollegen (888, 945, 895). Sein Konto ist aktiv, nicht als Testkonto markiert, in der Verteilung. Die Standard-Sortierung stellt Leads ausdrücklich **nach hinten**.

Was auffällt: **785 seiner 879** Tageslisten-Einträge sind Stufe C („nur Lead") — 89 %, der höchste Anteil im Team (Kollegen: 74–85 %). Das erklärt den Eindruck, beweist aber keinen Fehler im Sichtfeld. Für eine Ursache braucht es seinen Bildschirm: gespeicherte Filterwahl im Browser oder die Seite, die er benutzt. **Nicht geraten, nicht „reparieren"** — ein Fix ohne Ursache hätte hier 1.154 Kunden bewegt.

### Nebenbefund für den Betreiber

Zwei **echte** Konten sind als Testkonto markiert: `Justin Schwarzott` (ID 2 und 7). Jede Team-Ansicht filtert über `echteMitarbeiterSql()` — diese beiden fallen dort heraus. Das ist keine Änderung aus diesem Lauf, sondern ein Fund; die Marke gehört geprüft.

### Wo zu finden

| Datei | Zweck |
|---|---|
| `scripts/mess-fehlmerges.ts` | Audit aller Zusammenführungen, Häufigkeitsanalyse, CSV in `reports/` |
| `scripts/mess-merge-regel.ts` | Wirkung der Regelverschärfung auf die 742 Merges (ruft die echte Funktion) |
| `server/lib/fiaon-massen-merge.ts` | `harterWiderspruch` — die Widerspruchs-Wand |
| `scripts/pruef-massen-merge.ts` | 92 Prüfungen, davon 8 neue für die Wand |
| `client/src/components/Softphone.tsx` | Gesprächsdaten gehören zum Kunden, nicht zur Sitzung |
| `server/routes/fiaon-agent-kunden.ts` | `kartePayload` liefert Buchungen |
| `scripts/pruef-karte-buchungen.ts` | 10 Prüfungen über echtes HTTP |
| `server/lib/fiaon-inkasso.ts` | Zuteilung auf Personen-Ebene |
| `scripts/inkasso-eine-zustaendigkeit.ts` | Bestandslauf, Vorschau + `--schreiben` |
| `shared/fiaon-zustaendigkeit-text.ts` | Die zwei Beschriftungen, an einem Ort |

### Offen (nicht angefasst, weil nicht gemessen)

Telefonie (Doppelpräfix im Inkasso, Blockier-Marke, Einweg-Audio, Erreichbarkeit 2/158), Termine (Buchungs-Fehlschläge, Termin-Art, „nicht erschienen"), Stufen-Erzwingung bei Zahlung und Betreuer-Lücken. Die Fundstellen sind kartiert, aber ohne Messung wird hier nichts geändert — das war die erste Regel dieses Auftrags.

## 17.08.2026 — Die Zweig-Prüfung hat Geduld gelernt

### Der Befund

Der Lauf meldete für **34 von 35** Ereignissen: *„Die Testmail kam in 25 Sekunden nicht bei Brevo an."* Gleichzeitig lagen die Mails im Postfach des Betreibers, und das Zustellprotokoll zählte **10.446 Versände**.

**Die Ursache:** Brevos Events-API trägt Ereignisse mit **1–3 Minuten Verzug** ein. Die auf Tempo optimierte Nachschau — gestern von 140 s auf 34 s gebracht — fragte, bevor Brevo geschrieben hatte.

Das ist derselbe Fehler wie vorgestern beim `endDate` in der Zukunft, nur andersherum: **Beide Male behauptete die Anzeige „Zweig fehlt", während unsere Abfrage nicht passte.** Und beide Male traf es den Betreiber, der seine Zweige längst gebaut hatte.

### Was jetzt anders ist

**Es wird gepollt statt einmal gefragt:** erste Abfrage nach 30 s, dann alle 30 s, bis maximal 4 Minuten. Ein einmal bestätigtes Ereignis **bleibt** bestätigt. Sind alle da, endet der Lauf sofort — Tempo bleibt also, wenn alles in Ordnung ist. Die vollen vier Minuten braucht nur, wer wirklich einen fehlenden Zweig hat.

**Und die Anzeige bewegt sich:** Sekundenzähler, „nächste Nachfrage in n s". Eine Anzeige, die stillsteht, wird abgebrochen — und ein Abbruch erzeugte bisher 34 falsche Rot-Marken.

**„Nur nachsehen"** ist ein zweiter Knopf: Er fragt Brevo über das Zeitfenster des *letzten* Versands erneut ab, **ohne neue Probemails**. Genau für den Fall von gestern — die Mails sind längst da, es fehlt nur der Abgleich. 35 unnötige Mails an die Testadresse kosten Zustellreputation.

**`followup_48h` fällt heraus.** Es ist als veraltet gekennzeichnet (gemessen 19.08.: null Versände, keine auslösende Stelle im Code), bekam aber weiter eine Probemail und zählte als „Zweig fehlt". Eine Ampel, die einen absichtlich gelöschten Zweig anmahnt, wird ignoriert — und mit ihr die echten Funde. Aus 35 werden **34 lebende** Ereignisse, plus eine eigene Zeile: *„veraltet — der Zweig kann in Make gelöscht werden."*

**Die Diagnose steht bei jedem Misserfolg dabei:** gesuchte Adresse, Zeitfenster, Anzahl der insgesamt gefundenen Brevo-Ereignisse. Stehen dort 0, sagt der Text ausdrücklich: *„Dann liegt es nicht am einzelnen Zweig, sondern am Versand oder an der Adresse."* Damit wird nicht mehr geraten.

### Der Prüfstand hat zwei eigene Fehler gefunden

`scripts/pruef-geduld.ts` lässt den **echten** Sammellauf gegen eine `fetch`-Attrappe laufen — die volle Kette bis zum Netzwerkaufruf, mit Brevos echter Antwortform. Vier Fälle: Ereignis erscheint spät → grün · erscheint nie → „Zweig fehlt" erst nach Ablauf · Abfrage scheitert (HTTP 400) → „Prüfung gestört" nach **einer** Abfrage · „Nur nachsehen" ohne Versand.

Dabei kam heraus:

1. **Das Wartefenster begann beim Lauf-Start, nicht nach dem Versand.** Die 34 gestaffelten Mails verbrauchten einen Teil davon. In Produktion 7 von 240 Sekunden — im Prüfstand das ganze Fenster: 0 Abfragen, 34-mal „Prüfung gestört". Fachlich ist es ohnehin richtig, nach dem Versand zu zählen.
2. **Der Prüfstand schrieb 34 echte Verifikationen in die Produktionsdatenbank** — darunter „Zweig bestätigt" für Ereignisse, die nur die *Attrappe* bestätigt hatte. Eine falsche Bestätigung ist schlimmer als keine: Sie macht die Ampel grün, ohne dass geprüft wurde. Aufgefallen an den Laufzeiten (34 Schreibvorgänge kosten Sekunden). Es gibt jetzt `nichtSpeichern`, und die 35 Zeilen sind mit Begründung zurückgesetzt.

**24 Prüfungen** grün, und der Beweis danach: `geprueft=0, bestaetigt=0` — der Stand schreibt nichts mehr. Dazu **60 Prüfungen** am Quelltext (`pruef-zweigampel.ts`).

### Und eine „Wand", die keine war

Nach dem vierten halb-offenen deutschen Zitat in einer Sitzung (öffnend `„`, schließend ASCII-`"` → beendet den String) sollte `pruef-backticks.ts` das finden. Ergebnis: **365 Treffer, fast alle Fehlalarme** — JSX-Text (`<b>„QR-Code speichern"</b>`), mehrzeilige Literale, Fortsetzungszeilen.

Die Prüfung ist wieder entfernt, mit Begründung im Quelltext. **Der esbuild-Durchgang im selben Prüfstand fängt diese Fehler bereits** — er weiß als Übersetzer, was ein String ist und was JSX-Text. Die Lehre ist nicht „mehr Regex", sondern: den Prüfstand nach jeder Änderung *fragen*. Er hätte alle vier Fälle gefunden.

**Betreiber-TODO:** Nach dem Deploy einmal **„Nur nachsehen"** drücken — die Mails von gestern liegen bei Brevo, die 34 sollten grün werden. Danach zeigt die Ampel den echten Stand.

### Nicht angefangen

**Teil 2 (Agent als Vollpfleger)** und **Teil 3** (Pflichtnotiz im Listen-Weg, 12 Wartezustände, Zustellprotokoll mit Filtern, Team-Kalender auf 380 px) sind offen.

## 18.08.2026 — Die vier offenen Punkte, abgearbeitet

### Die Schaubilder — selbst gezeichnet

Drei SVGs, keine Icon-Bibliothek (AGENTS.md), Haarlinien 1,5 px:

- **Der Kundenweg als Fluss:** Antrag → Zahlung → Gate → Gespräch → Frei → Abo, sechs Stationen an einer Linie, die sich **zeichnet** (`stroke-dashoffset`). Der Abzweig ins Forderungsmanagement geht **gestrichelt nach unten** weg — eine durchgehende Linie würde den Ausnahmefall zur Fortsetzung machen. Und die gemessenen Zahlen stehen im Bild: „336 warten hier" am Gate, „120 von 120 Terminen kamen aus einem verschickten Link" über dem Gespräch. Ein Schaubild ohne Zahlen ist eine Behauptung mit Kästchen.
- **Die Stufen A/B/C als Trichter:** Die **Breite** zeigt die Menge, die Reihenfolge die Dringlichkeit — beides ohne ein Wort. Darunter: „Wer C zuerst anruft, arbeitet an der falschen Stelle."
- **Der Abo-Zyklus als Kreis:** Jahrestag oben, Rechnung, T+1, Mahnstufen, Zahlung-oder-Sperre. Ein Kreis, keine Zeitleiste — eine Leiste hätte ein Ende, ein Abo hat nur einen Jahrestag. Der Pfeil von der Sperre führt **zurück** in den Kreis: „Gesperrt ≠ verloren."

Die Teile erscheinen **nacheinander**, in der Reihenfolge des Ablaufs. Ein Bild, das fertig da ist, wird überflogen; ein Bild, das sich aufbaut, wird gelesen.

**Bei `prefers-reduced-motion` ist alles statisch UND vollständig sichtbar** — `opacity: 1 !important` und `stroke-dashoffset: 0 !important`. Wer den Eintritt über `opacity: 0` baut und nur die Animation abschaltet, zeigt eine leere Fläche. Das ist der häufigste Fehler dabei.

**Drei Screenshots, drei Fehler:**

1. „336 warten hier" **überlappte** „Rate offen → Forderungsmanagement". Im Quelltext sah beides plausibel aus. Jetzt vier klar getrennte Ebenen.
2. Die Beschriftungen **links vom Kreis** waren abgeschnitten: aus „Zahlung / oder Sperre" wurde „ung / erre". Das viewBox war 420 breit, der Text lief darüber hinaus — **SVG schneidet stillschweigend ab**.
3. Ein Wert für **beide Achsen** (`M = 215`) schob den Kreis nach unten aus dem Feld: „T+1" und „Mahnstufen" fehlten. Jetzt `MX` und `MY` getrennt.

### Die Mail-Vorschau: Desktop oder Handy

Ein Umschalter über dem Geräterahmen. **360 px** ist die Handy-Breite — dort bricht eine Vorlage, wenn sie es tut. Die Höhe wächst mit (430 statt 300 px), sonst sieht man am Telefon nur die Anrede und hält die Vorlage für kurz.

Die meisten Kunden lesen am Telefon. Eine Vorlage, die nur breit geprüft wurde, bricht dort — und in der Schulung fällt es nicht auf.

### Der Academy-Stand ist sichtbar

Die Route `/admin/academy/stand` lieferte die Zahl seit dem 28.08. — **es gab nur keine Anzeige.** Genau der Fehler, der beim Produkt-Knopf vier Tage Arbeit blockiert hat.

Jetzt steht an jeder Mitarbeiterkarte in der Team-Zentrale „Academy: Kapitel x/y", und wer nicht angefangen hat, in **Bernstein** mit „— noch nicht geöffnet". Kein Rot: Eine Farbe, die anklagt, erzeugt Ausreden statt Gespräche. Eine Abfrage für alle, nicht eine je Karte.

### Die Leitungs-Schulung (`/agent/schulung`)

Für Florentine und Daniel, an einer Stelle: die **Kernbotschaft** ganz oben (sie kommt in jedem Gespräch vor), die **drei Reisen** zum Vorführen, der **Stand des Teams** und der **Funktionskatalog**.

**Der Katalog wird importiert, nicht kopiert.** `katalogFuerLeitung()` filtert drei Einträge heraus, die nur die Geschäftsführung entscheidet: Auszahlung ablehnen, Provision nachbuchen, Feedback belohnen. Die Filterregel steht **neben dem Katalog** in `admin-funktionen.tsx` — wer einen Eintrag hinzufügt, sieht die Liste und entscheidet mit. Leere Gruppen fallen heraus; eine Überschrift ohne Inhalt sieht nach einem Fehler aus.

Die Seite prüft die Rolle über **`istLeitung` vom Server** — kein eigener Rollen-Vergleich. Der Menüpunkt erscheint nur der Leitung, aber die Wand steht in der Route.

### Geprüft

`pruef-academy.ts` — **179 Prüfungen** (von 142). `schau-academy.ts` — **43** (von 33), darunter: Die Fluss-Linie ist **fertig gezeichnet** (`strokeDashoffset === 0`) und der Kreis **geschlossen**. Bliebe der Offset stehen, wäre die Linie unsichtbar — und am statischen Bild würde es niemand merken. Dazu: Jeder zugeordnete Kapitel-Schlüssel existiert (über die Position würde ein eingeschobenes Kapitel das Bild verschieben).

Screenshots erzeugt und angesehen: `reports/academy/schaubild-*.png`, `vorschau-handy.png`.

## 18.08.2026 — „Produkt anlegen" repariert + die Kernbotschaft verankert

### Teil 1: Die Ursache war meine

**Meldung:** „Agenten klicken auf ‚Produkt anlegen' — es erscheint NICHTS." Damit stand die Kernarbeit.

**Die Ursache, in drei Schichten:**

1. Am 25.08. wurde die **Route** gebaut (`POST /agent/customers/:ref/produkt`, mit Katalog, Paket-Hygiene, SCHUFA-Kategoriegrenze) und mit **50 Prüfungen** grün gemeldet. Es gab nur **keine Oberfläche dafür**.
2. Am 27.08. kam ein Knopf dazu — als `<a href="/agent/kunden#anlegen">`. Drei Fehler in einer Zeile: Der Anker existiert nicht (0 Treffer), der Mitarbeiter steht **schon** auf dieser Seite, und „+ Kunde anlegen" hätte einen **neuen** Kunden angelegt, kein Produkt an dieser Akte.
3. Der Prüfstand prüfte die Route über **HTTP**, nicht über den Browser.

Das ist wörtlich der Fehler vom 11.08., der in AGENTS.md steht: *„Die Route existiert"* war grün, während der Knopf fehlte. Damals waren es vier Prüfungen, diesmal fünfzig.

**Was jetzt da ist:** `ProduktDialog.tsx` — ein Knopf, der **immer** an der Karte steht (nicht erst hinter einer Sperre), mit Beschriftung nach Lage: **„Produkt tauschen"**, wenn ein Paket offen ist, sonst „hinzufügen". Der Dialog nennt, was ersetzt wird, sperrt das schon offene Paket in der Auswahl, und die Bonitätsauskunft ist gesperrt, wenn sie offen oder bezahlt ist.

**Der Tausch ist ein Klick:** neues Paket wählen → „Tauschen". Die alte offene Bestellung wird stillgelegt, der Verwendungszweck ist neu — beides steht in der Bestätigung.

**Und die Mail trägt die neuen Werte.** Der Browsertest fängt den Aufruf ab und prüft **Feld für Feld**: neues Paket, neuer Betrag, neuer Verwendungszweck — und ausdrücklich, dass **kein alter Wert durchrutscht**. Der Dialog holt die Karte nach dem Speichern neu; ohne das stünde dort weiter das alte Paket.

**Geprüft:** `schau-produkt.ts`, **32 Prüfungen** im Browser (Desktop + 380 px). **Rot-Probe:** Die Öffnung kaputt gemacht (`onClick` leer) → **5 rot**, beginnend mit *„DER KLICK ÖFFNET DEN DIALOG"*. Dieser Fehler kann nicht mehr still passieren.

Nebenbei fand der Test einen zweiten: Der Knopf war **40 px** hoch statt 44. Das Auge sieht das nicht, die Fingerkuppe schon.

### Teil 2: Die Kernbotschaft — im Wortlaut, an drei Stellen

> Wenn jemand einen Vertrag mit uns hat, diesen pünktlich und positiv bezahlt UND unsere Empfehlungen in Anspruch nimmt, dann verbessert sich die Bonität. Nichtzahlungen werden an die SCHUFA gemeldet.

Der Satz steht **an einer Stelle im Code** (`shared/fiaon-academy.ts`) und erscheint an dreien:

- als hervorgehobenes Kapitel **„Das Versprechen — und die Konsequenz"** in der **Vertriebs-Reise** (Position 10 von 14)
- als dasselbe Kapitel in der **Onboarding-Reise** (Position 12 von 17) — dort mit anderer Begründung: im Vertrieb ist es das Versprechen, im Onboarding die Konsequenz, die man erklären muss
- als Einblendung im **Onboarding-Cockpit** beim Pflichtschritt „Abo-Klarheit", überschrieben mit *„Das sagst du dem Kunden — wörtlich"*

**Die Karte ist zweigeteilt:** links grün „Pünktlich + Empfehlungen = Aufbau", rechts rot „Nichtzahlung = Meldung", die Folge jeweils fett. Auf 380 px stapeln sie sich — zwei Spalten à 170 px liest man als *einen* Pfad. Fußnote klein: „Wortlaut freigegeben durch die Geschäftsführung."

**Der Prüfstand vergleicht den Satz buchstabengetreu** gegen eine ausgeschriebene Kopie und stellt sicher, dass er nur an einer Stelle steht. Eine Aussage über die SCHUFA darf sich nicht durch einen Umbau verändern.

### Die Leitung schult selbst

Florentine und Daniel sehen im **Team-Portal** alle drei Reisen (das galt schon) — und jetzt auch **„Präsentieren"**: echtes Vollbild, Navigation und Fußleiste weg, größere Schrift, Esc beendet.

Das Kennzeichen `istLeitung` kommt vom **Server**. Ein Agent sieht den Knopf nicht — eine Rollen-Prüfung in der Anzeige wäre die zweite Fassung derselben Regel.

**Eine Regel wurde dabei ersetzt, nicht gelöscht:** Der Prüfstand verlangte bisher *„Die Team-Fassung hat KEINEN Präsentationsmodus — wer sich selbst einschult, präsentiert nicht."* Das war richtig, solange nur Mitarbeiter sie benutzen. Jetzt prüft er, dass der Modus **an die Leitung gebunden** ist.

### Die zwei unbestätigten Zweige

Aus dem Ampel-Lauf sind **zwei** Ereignisse offen (das dritte, `followup_48h`, ist absichtlich abgeschafft):

| Ereignis | Was es ist | Variablen zum Kopieren |
|---|---|---|
| `schufa_requested` | Neues SCHUFA-Dokument angefordert (Kunde) | `email`, `vorname`, `nachname`, `ref`, `login_url`, `hinweis` |
| `commission_statement_issued` | Provisions-Abrechnung erstellt (Mitarbeiter) | `email`, `vorname`, `statement_no`, `betrag`, `doc_hash` |

Beide brauchen einen Make-Zweig und ein Brevo-Template. Sie bleiben in `/admin/events` markiert.

### Geprüft

`pruef-academy.ts` — **142 Prüfungen** (von 114). `schau-produkt.ts` — **32**. Screenshots erzeugt und angesehen: `reports/produkt/`, `reports/kernbotschaft/`.

### Nicht geliefert

Die **SVG-Schaubilder** (Kundenweg als Fluss, Stufen A/B/C als Trichter, Abo-Zyklus als Kreis), die **Leitungs-Fassung von `/admin/funktionen`** als eigene Seite, die **umschaltbare Desktop/Handy-Ansicht** der Mail-Vorschau und die **Anzeige** des Academy-Stands in der Team-Zentrale (die Route `/admin/academy/stand` liefert die Daten, die Darstellung fehlt).

## 18.08.2026 — Die Wand gegen das Doppel-Modell, Academy fürs Team, Gesamtstand

### Teil 1: Der DROP ist vorbereitet — und findet NICHT statt

Der Auftrag lautete: 397 Zugriffe abarbeiten, dann die Kontakt-Spalten droppen. **Das habe ich nicht getan, und zwar mit Absicht.**

**Gemessen:** 397 Zugriffe in 62 Dateien, davon **16 schreibende** (nicht 36 — der Bericht vom 20.08. zählte `email`/`phone` mit, die überall gebraucht werden). Elf der 16 stecken allein in `fiaon-antrag.ts`.

Das ist mehrtägige Arbeit. Und **ein halber Umzug ist der schlechteste Zustand:** Die umgezogenen Stellen schreiben an die Person, die anderen in die Spalte, und niemand weiß mehr, welcher Wert gilt — genau die Lage, die Migration 059 beendet hat. Der Fehler zeigt sich außerdem nicht beim Deploy, sondern erst, wenn ein Kunde einen Antrag abschickt.

**Was stattdessen gebaut ist:**

- **Die Wand gegen Wachstum** (`pruef-eine-quelle-wand.ts`): Sie hält die Zahlen in `reports/eine-quelle-grenzen.json` fest. Wer eine **neue** schreibende Stelle einbaut, bekommt einen roten Prüfstand. Der Bestand ist geduldet — eine Wand, die 397 Fehler meldet, wird nach dem zweiten Lauf abgeschaltet, und dann fängt sie auch die 398. nicht.
- **Das Archiv** (Migration 061): **7.544 Bestellungen** und **3.841 Leads** gesichert. Der Grund steht in der Messung: **110 Bestellungen haben eine Adresse, die von der Person abweicht** — geschrieben *vor* dem Trigger und danach nie angefasst. Ein DROP ohne Archiv wäre für die ein Hard-Delete.
- **`DROP COLUMN` wird jetzt verweigert.** Der Migrationsläufer sperrte DROP TABLE, DROP DATABASE und TRUNCATE — aber nicht DROP COLUMN. Eine gelöschte Spalte ist genauso endgültig, nur unauffälliger.

**Ein ehrlicher Fund:** Zwei der 16 schreibenden Stellen waren **meine eigenen** vom 25.08. (`fiaon-agent-anlage.ts` schrieb `phone_country_code: ''` — eine leere Zeile in einer Spalte, die verschwinden soll). Die Wand hat sie am ersten Tag gefunden. 18 → 16.

Die DROP-Anweisung steht als Kommentar in Migration 061, mit der Bedingung: **Wand meldet 0.**

### Teil 2: Die Academy ist für das Team offen

Jede Rolle bekommt **ihre** Reise unter „Mehr → Academy" — gemessen an echten Konten:

| Rolle | sieht |
|---|---|
| agent | Vertrieb |
| onboarding | Onboarding |
| inkasso | Forderungsmanagement |
| vertriebsleiter / admin | alle drei |

**Die Filterung steht im Server.** Ruft ein Agent `/agent/academy/inkasso` auf, kommt **404** — nicht die Reise. Das ist keine Geheimhaltung, sondern Klarheit: Wer die Inkasso-Reise durchklickt, hält sie hinterher für seine Aufgabe.

Die Rollenfilterung (`reisenFuerRolle`) lag seit dem 26.08. vorbereitet und wird hier zum ersten Mal benutzt — genau deshalb stand sie in `shared/`, auch als sie noch keinen Aufrufer hatte.

**Der Fortschritt** wird je Mensch und Reise gespeichert: das **höchste** erreichte Kapitel (`GREATEST` — wer zurückblättert, verliert nichts), einmal fertig bleibt fertig. Gespeichert wird beim Verlassen (`pagehide` + `keepalive`) und alle 30 Sekunden, nicht bei jedem Kapitel.

Die Team-Fassung hat **keinen** Präsentationsmodus: Wer sich selbst einschult, präsentiert nicht. Die Verwaltungs-Bühne bleibt, wie sie ist.

### Teil 3: Gesamtstand und Aufräumen

**`docs/GESAMTSTAND.md`** ist auf dem Stand vom 28.08. — mit einem eigenen Abschnitt zum Doppel-Datenmodell (die drei offenen Schritte bis zum DROP), einer Tabelle „was liegt wo" für die neuen Bereiche, und **zwei Fundorten, die schon in die Irre geführt haben**.

**`pages/agent/kunden.tsx` ist entfernt.** Am 25.08. wurden ein Knopf und eine Notizpflicht dort eingebaut, während `/agent/kunden` längst `kunden-neu.tsx` zeigt — erst ein Screenshot verriet es. `/agent/meine-kunden-alt` leitet jetzt um.

**Die Datenkosmetik läuft nicht im Tageslauf — und braucht es nicht:** **0 von 11.578** geprüften Feldern brauchen eine Reinigung. Der Leerraum entstand an Formulareingaben, und dort wird getrimmt. Ein Tageslauf, der 11.578 Zeilen prüft und nichts findet, wäre Arbeit ohne Ergebnis.

### Geprüft

`pruef-academy.ts` — **114 Prüfungen** (von 91), darunter die Rollen-Zuordnung gegen die Daten und die Server-Wand. **Rot-Probe: 2 rot** (Wand ausgeschaltet, `GREATEST` entfernt). Dazu `pruef-eine-quelle-wand.ts` als neue Dauerregel.

### Was offen bleibt

Die **16 schreibenden** und knapp 380 lesenden Stellen. Sie stehen einzeln im Prüfstand — er nennt Datei und Zeile. Und drei Punkte für Sie: der Ampel-Lauf, die 336 Einladungen, das Gespräch mit Nikita und Lucas. Alle in `docs/GESAMTSTAND.md`.

## 18.08.2026 — Plus-Adressen, Daniels Knopf, Academy V2, Nachlauf im Tageslauf

### Teil 1: Das Betreff-Matching ist abgeschafft

**Der Befund aus Produktion:** Brevo lieferte **305 Ereignisse** für die Testadresse, und der Lauf meldete *„keins passte zum Betreff dieses Ereignisses"*. Alle Mails waren angekommen.

Die Zuordnung lief über den Betreff — der steht aber in der **Brevo-Vorlage**, deutsch und kundenfreundlich („Ihre Zahlungsdaten für FIAON"). Die Plattform kennt ihn nicht. Es war nie eine Zuordnung, immer eine Vermutung.

**Jetzt bekommt jedes Ereignis seine eigene Adresse:**

```
dev@fiaon.com  →  dev+welcome@fiaon.com
                  dev+payment_details@fiaon.com
```

Alles vor dem `+` bleibt das Postfach (RFC 5233), also landet jede Mail im selben Eingang. Aber Brevo protokolliert die **volle** Adresse — und damit ist die Zuordnung eine Gleichheit.

**Ein Fallstrick dabei:** Brevos `?email=`-Filter vergleicht *exakt*. Eine Suche nach `dev@fiaon.com` hätte die Plus-Adressen **nicht gefunden**, und die Ampel wäre dauerhaft rot geblieben. Die Abfrage läuft deshalb ohne Adressfilter (eine Abfrage statt 35 — bei 35 käme die Bremse) und filtert lokal auf das Postfach vor dem Plus.

**Und ein Hinweis in der Oberfläche:** Wirft der Mail-Anbieter Plus-Adressen weg (einzelne Exchange-Einstellungen), wird die Ampel grün, während das Postfach leer bleibt. Der Kasten sagt das ausdrücklich und nennt den Rückfall (`plusAdressen: false`, reines Zeitfenster-Matching ohne Einzelzuordnung).

**Betreiber-TODO:** Der `BREVO_API_KEY` liegt nur in Produktion — der echte Lauf muss dort passieren. Nach dem Deploy einmal **„Alle Zweige prüfen"**; die Diagnose nennt bei einem Misserfolg jetzt die gesuchte Plus-Adresse statt eines Betreffs.

### Teil 2: Daniels Zahlungsdaten-Knopf

**Gemessen an 600 Personen der Tagesliste:**

| | |
|---|---:|
| **sendbar** | **123** |
| gesperrt: keine offene Bestellung | 219 |
| gesperrt: keine E-Mail-Adresse | 165 |
| gesperrt: schon bezahlt | 93 |

**Der wichtigste Befund: `claimed_paid` war schon erlaubt.** Die Serverregel lässt `pending_payment`, `claimed_paid` und `expired` durch — betroffen sind **243 Personen**. Daniels Problem war nicht die Regel, sondern dass der Knopf grau war und **nicht sagte, warum**. Der Grund stand im Tooltip, und den sieht auf dem Telefon niemand.

**Jetzt:** Der gesperrte Knopf zeigt den Grund als Text — und den nächsten Schritt. Bei fehlender E-Mail steht das **Eingabefeld direkt daneben** (das löst 165 der 477 Fälle mit einer Eingabe, über die bestehende Stammdaten-Route mit Verlaufseintrag und Alias-Ablage). Bei fehlender Bestellung führt ein Knopf zum Anlage-Fluss.

### Teil 3: Academy V2

**Echtes Vollbild:** Die Fullscreen-API *und* eine Klasse am `<html>`, die Navigation und Kopfleiste per CSS aus dem Fluss nimmt — nicht überdeckt, weg. Der Zugangsschutz bleibt unberührt: `AdminShell` rendert weiter und prüft weiter den Zahlencode, nur ihre Teile sind versteckt.

**Ein Fehler dabei:** Ränder zurückzusetzen genügte nicht — die Bühne blieb 1200 px breit bei 1440 px Fenster, weil der begrenzende Container ein `div` *dazwischen* war. `position: fixed` löst sie aus dem Fluss; jeden Vorfahren einzeln zu treffen wäre ein Ratespiel über fremdes Markup. Auch das Softphone verschwindet jetzt — im Screenshot der ersten Fassung schwebte es über der Bühne.

**Mehr Tiefe, konkret:**

- **Parallax-Eintritt:** Rolle-Chip, Titel, Text, Zahlen und Mail-Rahmen kommen in 70-ms-Schritten aus der Tiefe. Das führt den Blick von oben nach unten; bei gleichzeitigem Eintritt springt er umher und liest den Titel zuletzt.
- **Zählende Zahlen:** „43 von 120 verpasst" läuft sichtbar bis 43, mit sanftem Auslauf (`1-(1-t)³`) — eine linear zählende Zahl wirkt wie ein Zähler, eine ausgebremste wie ein Ergebnis.
- **Eine Farbe je Reise:** Vertrieb `#5b8cff` (Blau), Onboarding `#3fd0d4` (Türkis), Forderungsmanagement `#9d8cff` (Violett). Wer drei Reisen hintereinander vorführt, weiß ohne ein Wort, wo er ist. Alle drei auf **4,5:1** gegen Navy geprüft.
- **Licht-Wisch beim Kapitelwechsel** (0,9 s, einmal je Kapitel — ein dauerhafter Effekt wäre Kirmes).
- **Abschluss-Kapitel „Du bist bereit"** je Reise, als echtes Kapitel (die Fortschrittsleiste zählt es mit). Aus 12/15/9 werden **13/16/10**.

**380 px:** Die Karte war nur 298 px breit — 82 px Rand, weil eigener und Hüllen-Abstand sich addierten. Unter 640 px schrumpft er.

`prefers-reduced-motion` schaltet alles ab: Animationen, Übergänge, das Gleiten beim Springen, den Licht-Wisch — und die Zahlen stehen sofort auf ihrem Endwert.

### Teil 4: Der Nachlauf steht im Tageslauf

Der Bestandslauf hat am 24.08. sieben Fälle nachgetragen. **Drei Tage später standen zwei wieder da:** Ihre alte Wiedervorlage (+3 Tage, aus der Zeit vor dem Wartezustand) war fällig geworden. Ein Lauf, den ein Mensch aufrufen muss, wird beim dritten Mal vergessen.

`nummernAnfragenNachtragen()` läuft jetzt täglich über die Cron-Registratur (plus 90 Sekunden nach dem Start, für die Fälle vom Vortag). **Idempotent:** Der Prüfstand ruft sie zweimal in einer zurückgerollten Transaktion — der zweite Lauf setzt nichts.

### Geprüft

**268 Prüfungen** grün: `pruef-geduld` 34 (mit Rot-Probe „Ereignis auf falscher Plus-Adresse zählt nicht"), `pruef-academy` 91, `schau-academy` 33, `pruef-reste` 37, `schau-termine` 13, `pruef-zweigampel` 61.

### Fünf eigene Fehler

1. **Backticks in CSS-Kommentaren — zweimal im selben Lauf.** AGENTS.md nennt das als wiederkehrenden Fehler; hier war es der zehnte und elfte.
2. **Der Fehlerzweig meldete eine andere URL als die gestellte.** Nach dem Umbau zeigte das Log `?email=dev@fiaon.com`, während die Abfrage längst ohne Adressfilter lief. Eine Diagnose, die in die falsche Richtung schickt, ist schlimmer als keine.
3. **Drei Browserprüfungen schrieben „15 Kapitel" hinein.** Mit dem Abschluss-Kapitel wurden es 16 — die Zahl kommt jetzt aus den Daten.
4. **Ein Regex lief über Zeilengrenzen** (`[^;]*` frisst Umbrüche) und traf das `width:` einer ganz anderen Regel.
5. **Die Mindestlänge für Kapitel-Sätze war zu streng** für „Du bist bereit." — ein Abschlusssatz, der einen Nebensatz braucht, ist kein Abschluss.

## 18.08.2026 — Termin-Zentrale und die FIAON Academy

### Teil 1: Die Termin-Zentrale (`/admin/termine`)

Zweimal geschoben, jetzt geliefert — mit Screenshot als Abnahme.

**Der Befund, der in keiner Ansicht stand:**

| Mitarbeiter | Termine | vergangen | erledigt | No-Show |
|---|---:|---:|---:|---:|
| Nikita Boychenko | 34 | 25 | **0 %** | **64 %** |
| Lucas Böhnert | 30 | 25 | **0 %** | **76 %** |
| Florentine Lombardi | 27 | 21 | 67 % | 19 % |
| Daniel Stripling | 27 | 23 | 78 % | 9 % |

Zwei Menschen haben bei 50 vergangenen Terminen **keinen einzigen** abgeschlossen, während zwei andere zwei Drittel bis vier Fünftel schaffen. Die Seite benennt das ausdrücklich: *„Zwei Möglichkeiten: Die Gespräche finden nicht statt — oder sie werden nicht abgeschlossen. Beides klärt ein Gespräch, kein Programm."*

**Die Quoten rechnen nur über vergangene Termine.** Ein Termin morgen ist weder erledigt noch verpasst; ihn mitzuzählen macht jeden Vergleich falsch.

**Und die 336:** Bezahlte Kunden ohne jeden Termin, die ältesten seit dem **04.07.2026** — und **nie eingeladen**. Die Karte zeigt sie (längst Bezahlte zuerst), mit Einladungsknopf je Zeile und einem für alle. Gestaffelt über die bestehende `onboarding_einladung`-Staffel: höchstens **50 am Tag**, mit Vorschau vor dem Versand. Ein Knopf, der 336 Mails auf einmal schickt, ruiniert die Zustellbarkeit aller anderen.

Dazu: Heute/Woche/Monat, Filter (Mitarbeiter, Quelle, Status) in der Adresszeile, Zeile = Zeit · Kunde (verlinkt) · Mitarbeiter · Quelle · Status, stornierte sichtbar mit Zeitpunkt und Urheber. Auf 380 px als Kartenliste über das Schmal-Bauteil vom Vortag — jetzt an `fiaon_termine` angeschlossen.

**Der Hebel-Messwert steht oben:** 120 von 120 Terminen entstanden über einen verschickten Terminlink. **Alle.**

### Teil 2: Die FIAON Academy (`/admin/schulung`)

Drei Reisen durch die drei Abteilungen — **12, 15 und 9 Kapitel**. Dunkle Navy-Bühne mit wanderndem Glanz, Karten mit Tiefe-Eintritt, scroll-getriebene Kapitel, Fortschrittsleiste, Kapitel-Punkte, Pfeiltasten und ein **Präsentationsmodus** (echtes Vollbild, größere Typo, Esc beendet).

**Jedes Kapitel zeigt:** wer handelt (Rolle-Chip) · was passiert (ein Satz, groß) · den Ablauf · die belegenden Zahlen · die echte Mail-Vorschau im Geräterahmen · den Weg ins echte System · und „Warum dieser Schritt?" zum Aufklappen.

#### Die Entscheidung: der Weg statt des Bildes

Der Auftrag ließ die Wahl zwischen eingebetteten Komponenten und Build-Screenshots. **Beides verworfen:**

- **Einbettung** braucht Anmeldung, Kundendaten und Zustand — ein Kapitel über das Onboarding-Cockpit müsste einen echten Menschen ins Schulungsbild laden. Und jede Änderung an der Komponente kann die Schulung weiß machen (der Haken-Fehler vom 16.08. hat genau das getan).
- **Build-Screenshots** brauchen einen angemeldeten Server im Build, veralten lautlos und zeigen echte Kundennamen. Ein Bild, das seit drei Wochen falsch ist, schult falsch — und niemand merkt es.
- **Gewählt:** Jedes Kapitel nennt die **echte Route** und öffnet sie auf Wunsch im neuen Tab. Der Betreiber führt am echten System vor — überzeugender als jedes Bild. Dazu die echten Texte aus dem Repo. **Wartbarkeit:** Eine geänderte Route fällt im Prüfstand auf; ein geänderter Agenda-Text wandert von selbst mit.

#### Die sieben Onboarding-Schritte kommen aus der echten Datei

`shared/fiaon-onboarding-agenda.ts` — dieselbe, die das Cockpit benutzt. Eine Kopie wäre die zweite Wahrheit: Ändert jemand einen Schritt, schulte die Academy weiter den alten. Der Prüfstand verbietet das Abschreiben ausdrücklich.

#### Die Kapitel

**Vertrieb (12):** Lead entsteht · ewige Strecke · Stufen A/B/C · Anruf mit Gesprächsblatt · Ergebnis dokumentieren · nicht erreicht → Terminlink · falsche Nummer → Wartezustand · Neukunde anlegen · Zahlungsdaten · Zahlung gemeldet · Verbuchung · Provisions-Wand

**Onboarding (15):** Zahlung da · Erst-Login-Gate (beide Karten) · Buchung (5 Slots) · 24-h-Erinnerung · **die sieben Agenda-Schritte einzeln** · Abschluss · Freischaltung · 15-€-Gutschrift · No-Show-Weg

**Forderungsmanagement (9):** Abo-Zyklus · T+1 · Zuteilung · Arbeitsliste nach Mahnstufe · Raten-Ergebnisse · Mahnstufen-Mails · würdevoller Ton · Vergütung · Sperre statt Löschung

#### Zugänglichkeit

`prefers-reduced-motion` schaltet Bewegung **hart** ab — keine gedrosselten Animationen, auch das Gleiten beim Springen wird zum Schnitt. Kein Autoplay, kein Ton. Alle Bedienelemente ≥ 44 px. Alle vier Textfarben auf Navy nachgerechnet: **14,0 · 6,2 · 4,6 · 4,6 zu 1**. Auf 380 px vollwertig; die Kapitel-Punkte verschwinden dort, weil sie Text überdecken würden.

**Die Rollenfilterung ist vorbereitet, nicht ausgerollt** (`reisenFuerRolle`) — wie beauftragt.

### Geprüft

`pruef-academy.ts` — **61 Prüfungen**: Kapitel vollständig, jedes Mail-Kapitel gegen die 23 Registry-Ereignisse abgeglichen, jeder Weg gegen `App.tsx`, Agenda nicht kopiert, Kontrast nachgerechnet, reduced-motion, Zugriffsschutz. **Rot-Probe: 9 rot** (erfundenes Ereignis, toter Weg, Agenda-Import entfernt, Animation gedrosselt statt abgeschaltet).

`schau-academy.ts` — **27 Prüfungen** im Browser: Bühne, Reise durchblättern, Pfeiltasten, „Warum dieser Schritt", Mail-Vorschau, Präsentationsmodus, Esc, 380 px, reduced-motion. `schau-termine.ts` — **13 Prüfungen** mit Screenshots.

Screenshots erzeugt **und angesehen**: `reports/termine/`, `reports/academy/`.

### Vier eigene Fehler

1. **Die Academy sollte ohne Verwaltungshülle laufen** — schöner, aber **ungeschützt**: Die Zugangsschleuse sitzt *in* `AdminShell`. Ein eigenes Gate daneben wäre die zweite Fassung derselben Wand. Jetzt mit Hülle; vollflächig wird es im Präsentationsmodus.
2. **Drei Wege zeigten auf Routen, die es nicht gibt** (`/kunde`, `/agent/onboarding`, `/admin/zahlungen-verbuchen`). Der Prüfstand fand alle drei — er gleicht gegen `App.tsx` ab.
3. **Das Schmal-Bauteil ließ Vergangenes weg.** Richtig für einen Ausblick, falsch in der Zentrale: Dort sind die **43 verpassten** Termine die Arbeit.
4. **Die Einladungsknöpfe hatten 7 % Deckkraft** und wirkten ausgegraut. Ein Knopf, den man für inaktiv hält, wird nicht gedrückt.

Und zwei Prüfstands-Fehler mit Ansage: Die Suche nach „Montag" fand „MONTAG, 17. AUGUST" nicht (`uppercase`), und die Suche nach „autoplay" traf den Satz *„Kein Ton, kein Autoplay"* — also genau die Zusage, die sie prüfen sollte.

## 18.08.2026 — Der Agent legt Kunden an: anlegen → Produkt → Zahlung → Termin

### Die Rechte-Matrix vorher und nachher

| Fähigkeit | vorher (23.08.) | nachher |
|---|---|---|
| Neukunde anlegen | **keine Route** | `POST /agent/kunden/neu` + `/pruefen` |
| Produkt an bestehende Akte | **keine Route** | `POST /agent/customers/:ref/produkt` |
| Stammdaten des Kunden | nur *eigenes* Profil | `POST /agent/customers/:ref/stammdaten` |
| Termin anbieten | — | `POST /agent/customers/:ref/termin-anbieten` |
| Preiskatalog | — | `GET /agent/katalog` |

Es gab nichts freizuschalten — die Funktionen existierten nicht. Genau diese Unterscheidung war der Grund, am 23.08. zuerst zu messen.

### Der Fluss endet nicht bei der Anlage

Der Agent hat den Menschen **am Telefon**. Er kann nicht viermal die Seite wechseln. Nach dem Anlegen bleibt derselbe Dialog offen und zeigt drei Schritte:

1. **Zahlungsdaten** — senden (Mail) *oder* kopieren (der WhatsApp-Weg; ohne diesen Knopf tippt der Agent den Verwendungszweck ab und vertippt sich) *oder* Rechnung als PDF
2. **Termin anbieten** — Link senden oder kopieren. Mit der gemessenen Begründung: *„Alle 120 gebuchten Termine kamen aus einem verschickten Link."* Der Hebel funktionierte — er wurde am Telefon nur nie angeboten.
3. **Zur Akte** oder **nächsten Kunden anlegen**

### Der Dubletten-Check läuft während des Tippens

Nicht erst beim Speichern: Wer alles eingetippt hat und dann hört „gibt es bereits", hat umsonst gearbeitet. Sobald E-Mail oder Nummer vollständig sind (450 ms Verzug), erscheint der Hinweis — mit dem **Treffer-Merkmal** („über E-Mail", „über frühere Rufnummer"), dem betreuenden Kollegen und einem Weg zur Akte.

Gesucht wird über E-Mail *und* Rufnummer, **inklusive Aliase** — wer früher eine andere Adresse hatte, ist derselbe Mensch.

### Die vier Wände, jede im Prüfstand bewiesen

| Wand | Umsetzung |
|---|---|
| **Bezahltes unantastbar** | Die Hygiene fasst nur `pending_payment`/`claimed_paid` an — und prüft es beim Stilllegen ein **zweites Mal**, weil zwischen Lesen und Schreiben eine Zahlung eingehen kann |
| **Preise nur Katalog** | Ein mitgeschickter Betrag wird **abgelehnt**, nicht ignoriert. Kein stiller Fehlschlag |
| **Provisions-Wand** | Die Anlage bucht nichts. `onCustomerPaid` entscheidet weiter nach der bestehenden Regel |
| **Alles im Verlauf** | Kundenverlauf *und* Aktivitätsprotokoll (`kunde_angelegt`, `produkt_angelegt` — beide im Katalog, sonst erscheinen sie in der Ansicht nicht) |

**Paket-Hygiene:** Ein zweites Stufenpaket legt die alte offene Bestellung still — sonst bekommt der Kunde zwei Zahlungsaufforderungen. Die Bonitätsauskunft ist davon **ausgenommen** (Einmalkauf neben dem Konto; diese Kategoriegrenze fehlte einmal und kostete 583,98 € offenen Umsatz), aber es gibt sie nur **einmal lebend**.

### Vier eigene Fehler — und was sie gelehrt haben

1. **Ich habe in die falsche Datei gebaut.** Der Knopf stand in `pages/agent/kunden.tsx`; die Route `/agent/kunden` zeigt aber `kunden-neu.tsx` (die alte liegt unter `/agent/meine-kunden-alt`). Der Browsertest fand ihn nicht — und erst der **Screenshot** zeigte, dass eine ganz andere Seite geladen war. *Dabei stellte sich heraus:* Meine Notizpflicht-Meldung von gestern betraf ebenfalls die alte Datei. Die echte Seite hatte sie längst; nur der **Server** hatte sie nicht, und das war der wichtige Teil.
2. **Der Prüfstand benutzte in jedem Lauf dieselbe Rufnummer.** Ab dem zweiten Lauf hängte die Anlage an die Person des ersten — dieselbe Nummer, derselbe Mensch, völlig richtig. Nur war diese Person vom Aufräumen als Testperson markiert, und die Dublettensuche überspringt Testpersonen (auch richtig). Fünf Prüfungen wurden rot.
3. **Zwei Selektoren trafen die falschen Elemente.** `locator("select").first()` traf die Sortier-Auswahl der Seite, `getByPlaceholder("E-Mail")` zusätzlich das Suchfeld. Das Bauteil hat jetzt ein Kennzeichen (`data-fiaon="kunde-anlegen"`).
4. **Drei stille `.catch()` kosteten zwei Durchläufe.** Erst die falsche Tabelle (`fiaon_agent_contract_templates`), dann die falsche Spalte (`active` statt `status`) — beide Fehler wurden verschluckt, und der Prüfstand meldete „keine aktive Vorlage" statt „die Abfrage ist kaputt".

### Geprüft

`scripts/pruef-vollpfleger.ts` — **50 Prüfungen** über echte HTTP-Routen, mit erkennbaren Prüfdaten und Aufräumen, das **immer** läuft. Darunter die Kernwand: **„ES ENTSTAND KEINE ZWEITE PERSON"** (Personenzahl vor und nach dem Doppel-Versuch).

`scripts/pruef-vollpfleger-browser.ts` — **35 Prüfungen** am gerenderten Bild, Desktop und 380 px: Knopf finden, Formular füllen, Dubletten-Hinweis abwarten, anlegen, Terminlink senden. Alle schreibenden Aufrufe abgefangen — ein Browsertest darf keine echten Kunden anlegen.

**Rot-Probe:** Dubletten-Check ausgeschaltet, Preisprüfung entfernt, Hygiene auf bezahlte Bestellungen ausgeweitet → **10 Prüfungen rot**.

Screenshots: `reports/vollpfleger/` (Formular mit Dubletten-Hinweis, Abschluss mit drei Schritten, 380 px).

## 18.08.2026 — Wartezustand, Notizpflicht, Protokoll-Filter

### Teil 2a: Sieben zahlende Kunden wurden täglich vergeblich angerufen

Der Wartezustand existiert seit dem 16.08.2026 (`fiaon-warten.ts`): Wer per Mail um seine Nummer gebeten wird, verschwindet für sieben Tage aus der Tagesliste und kommt von selbst zurück.

Die Fälle von **vorher** haben ihn nie bekommen. Gemessen: 11 Personen mit einer Nummern-Anfrage, davon standen **7 heute in der Tagesliste** — alle sieben mit `claimed_paid`, also zahlende Kunden, deren Nummer nicht stimmt. Der Agent kann dort nichts tun als überblättern.

Nachgetragen mit `scripts/warten-bestand.ts`, **ohne eine einzige Mail** (die Anfrage ist längst raus — eine zweite wäre eine Belästigung). Zählprobe danach: **0** Nummern-Anfragen in der Tagesliste, 16 Personen sichtbar unter „Wartend".

**Meine Messung von gestern war falsch:** Ich prüfte `fiaon_applications` auf die Wartezustand-Spalte — sie liegt an `fiaon_persons`. Deshalb stand im Bericht „Spalte fehlt", obwohl sie seit acht Tagen existiert.

### Teil 2b: Eine Pflicht in der Oberfläche ist keine Pflicht

„Erreicht — Sonstiges" braucht eine Notiz. Die Pflicht stand an **zwei von drei** Stellen:

| Weg | Pflicht |
|---|---|
| `Softphone.tsx` | ✔ `notizPflicht: true` |
| `kunden-neu.tsx` | ✔ `braucht: "notiz"` |
| `kunden.tsx` (Listen-Weg) | **✘ nichts** |
| Server | **✘ nichts** |

Der Listen-Weg kam ohne Notiz durch — und jeder direkte Routen-Aufruf ebenfalls. Die Regel steht jetzt **einmal im Server** (`pruefeNotiz`, mindestens 10 Zeichen, nur für dieses eine Ergebnis) und greift damit überall. Der Listen-Weg hat zusätzlich ein Notizfeld mit Zeichenzähler, damit niemand in einen 400er läuft.

**Genau eine Pflicht, nicht mehr:** Jede weitere Hürde erzeugt Ausweichverhalten — dann klickt jemand „nicht erreicht", weil das schneller geht, und die Statistik ist verdorben.

### Teil 2c: Das Zustellprotokoll ist durchsuchbar

Bei **9.881 Mails** in 7 Tagen war ein Status-Filter keine Suche, sondern Blättern. Neu: **Zeitraum** (heute/7/14/30/90), **Ereignis** (aus der Registry), **Empfänger** (Name *oder* Adresse, mit 350 ms Verzögerung — sonst schickt jeder Tastendruck eine Abfrage über 10.000 Zeilen), **50 je Seite** mit Gesamtzahl, **CSV** des *gefilterten* Ausschnitts.

Alle Filter stehen in der Adresszeile: Wer einen Fund weitergeben will, schickt den Link.

**Jede Zeile klappt auf:** Zustellkette mit Zeiten (an Make übergeben → von Brevo bestätigt → abgeglichen), Auslöser, Betreff, Brevo-Kennung — und ein **Nutzlast-Auszug ohne sensible Werte**. IBAN, Geburtsdatum und Rechnungs-Links werden gezählt, nicht gezeigt: „6 weitere Felder (nicht angezeigt)". Ein Protokoll ist zum Nachsehen da, nicht zum Ausleiten.

**Ein Fehler beim Bauen:** Der CSV-Export schrieb das Datum als `Mon Aug 17 2026 18:39:09 GMT+0200 (Central European Summer Time)`. Damit kann Excel nichts anfangen — es steht als Text da, Sortieren nach Datum geht nicht. Jetzt `17.08.2026 18:39` in Berliner Zeit, mit BOM für die Umlaute.

### Teil 2d: Der Auftrag hat sich beim Messen aufgelöst

Der Auftrag: „`team-calendar.tsx` (3.870 Zeilen, `grid-cols-7`) unter 768 px als Kartenliste — nicht umbauen, eine Fassung daneben."

Die Messung:

- **`TeamCalendar` wird in keiner Seite eingebunden** — kein Import, nirgends.
- Die Tabelle `team_calendar` dahinter hat **0 Einträge**.
- Die echten Termine liegen in **`fiaon_termine`: 120 Stück**.

Eine Mobil-Fassung für eine leere, nicht eingebundene Ansicht wäre Arbeit, die niemand sieht. Das Bauteil `TeamKalenderSchmal.tsx` ist gebaut, aber **datenquellen-frei** — es nimmt eine Terminliste und zeigt sie als Tagesabschnitte mit 44-px-Zielen. Die Termin-Zentrale (Teil 1) kann es für ihre 380-px-Ansicht benutzen.

### Die Zahlen für Teil 1 (Termin-Zentrale) sind gemessen

| | |
|---|---|
| Termine insgesamt | **120** |
| heute / diese Woche | **33 / 52** |
| erledigt / abgesagt / verpasst | 32 / 16 / **7** |
| Quelle | **alle 120 aus `nichterreicht_mail`** — der Hebel funktioniert |
| **Bezahlte Kunden ohne Termin** | **336** |

**Je Mitarbeiter — und hier steht ein Führungsbefund:**

| | Termine | erledigt | verpasst |
|---|---:|---:|---:|
| Nikita Boychenko | 34 | **0** | 1 |
| Lucas Böhnert | 30 | **0** | 6 |
| Florentine Lombardi | 27 | 14 | 0 |
| Daniel Stripling | 27 | 18 | 0 |

Nikita und Lucas haben bei 64 Terminen **keinen einzigen** als erledigt markiert, die beiden Vertriebsleiter dagegen 32 von 54. Entweder werden die Gespräche nicht geführt oder nicht abgeschlossen — beides braucht ein Gespräch, keinen Code. **Die Termin-Zentrale würde das sichtbar machen; sie ist nicht gebaut.**

### Geprüft

`scripts/pruef-reste.ts` — **32 Prüfungen** grün: Wartezustand (Frist begrenzt, Rückweg ohne Menschenhand, Wiedervorlage nur nach hinten, Spur im Verlauf, keine Mail), Notizpflicht an allen Grenzfällen (leer, nur Leerzeichen, zu kurz, genau 10, echte Notiz), Route prüft *vor* dem Speichern, alle drei Oberflächen.

**Rot-Probe:** Pflicht-Satz geleert und Routenprüfung entfernt → **10 Prüfungen rot**.

### Nicht gebaut

**Teil 1 (Termin-Zentrale `/admin/termine`)** — die Zahlen sind gemessen, die Schmal-Ansicht ist gebaut, die Seite selbst fehlt.

## 18.08.2026 (später) — Die Rechte-Matrix: was ein Agent heute kann

Vor dem Öffnen von Rechten muss dastehen, welche es gibt. `scripts/mess-agentenrechte.ts` liest die Routen aus fünf Dateien und ordnet sie nach Wache ein.

### Teil 2 fängt bei Null an

| Fähigkeit aus dem Auftrag | Stand heute |
|---|---|
| Neukunde anlegen (Mitarbeiter) | **keine Route** — nur `GET /agent/customers` |
| Produkt an bestehende Akte | **keine Route** |
| Stammdaten ändern | nur das **eigene** Profil (`/agent/profile/*`) |
| Zahlungsdaten senden | `POST /agent/customers/:ref/send-payment-email` ✔ mit Besitzschutz |
| Kontaktergebnis erfassen | ✔ mit Besitzschutz |
| Unbezahlte Buchung wegräumen | ✔ mit Besitzschutz |

**145 Routen** in den fünf Dateien, **56** für Agenten — davon nur **9 mit Besitzschutz** (`requireEigenerKunde`). Die vollständige Liste liegt in `reports/mess-agentenrechte.csv`.

Die beiden Kern-Fähigkeiten (Neukunde anlegen, Produkt hinzufügen) **existieren nicht**. Das ist kein Rechteproblem, sondern fehlende Funktionalität — ein eigener Auftrag, kein Freischalten.

**Wer heute arbeitet** (letzte 30 Tage): Florentine 1.964 Kontakte / 674 Kunden · Daniel 1.670 / 626 · Lucas 977 / 541 · Nikita 700 / 608. Zwei Vertriebsleiter, zwei Agenten, zwei im Forderungsmanagement.

### Teil 3: was wirklich offen ist

| | Stand |
|---|---|
| Pflichtnotiz bei „Sonstiges" | **erkennbar vorhanden** (3 Stellen in Karte/Liste) — der Browsertest-Beweis fehlt |
| `number_update_request`-Fälle | **12** Einträge, 11 Bestellungen (im Auftrag: 185) |
| Spalte für den Wartezustand | **fehlt** — muss angelegt werden |
| Zustellprotokoll: aufklappbar, seitenweise | vorhanden |
| Zustellprotokoll: Zeitraum-, Event-, Empfänger-Filter, CSV | **fehlen** |
| Team-Kalender | `grid-cols-7`, **keine** Schmal-Fassung — **3.870 Zeilen** |

## 17.08.2026 — Eine Bonitäts-Wahrheit, und fünf Pakete zurück

### Teil 1: Drei Teilwahrheiten wurden eine Ableitung

Für die Frage „wie steht dieser Kunde bei der Bonitätsauskunft?" gab es **drei** Felder, und jede Anzeige mischte sie anders:

| Teilwahrheit | wo |
|---|---|
| **bezahlt** | eigene Bestellzeile `type='schufa'` |
| **Dokument da** | `schufa_pdf` am Kundendatensatz |
| **geprüft** | `schufa_status` |

**Gemessen, und das ist der Schaden:**

| | |
|---|---|
| Zahlende Kunden mit **bezahlter** Auskunft, aber ohne Dokument | **35** |
| … sie sahen im Portal weiter **„Bonitäts-Check starten"** | ja |
| Kunden, die ihr Dokument **selbst** hochgeladen hatten | **31** |
| … sie sahen ebenfalls „kaufen" | ja |
| Dokumente, die zur Prüfung liegen | **35** |
| … davon geprüft | **0** |
| Code-Stellen, die die drei Felder einzeln lasen | **60** |

`server/lib/fiaon-bonitaet-status.ts` rechnet jetzt **sechs Stufen** aus den drei Teilen: kein Eintrag · Zahlung offen · bezahlt, wird beschafft · liegt zur Prüfung · geprüft · beanstandet. Jede bringt drei Sätze mit: einen für die Verwaltung, einen **für den Kunden** (direkte Anrede, kein Fachwort) und den nächsten Schritt mit Zuständigkeit.

Und ein Feld, das den Kern trifft: **`darfKaufen`**. Es ist nur wahr, wenn wirklich nichts da ist. Wer bezahlt hat, wird nicht mehr zum Kaufen aufgefordert — wer selbst hochgeladen hat, auch nicht. Hochladen darf beide Gruppen weiter: Wenn der Kunde schneller ist als wir, soll ihn nichts hindern.

**Nebenbefund:** Die Verwaltungsansicht schreibt `'rejected'` und `'requested'`, die Prüfroute kennt `'changes_requested'` — **drei Schreibweisen für dasselbe**. Im Bestand steht ausschließlich `'pending'` (6.890 Zeilen), der Widerspruch war also folgenlos. Er ist trotzdem aufgelöst, statt auf den ersten Klick zu warten.

**Die Zuordnung läuft jetzt über die Person.** Die alte Route verband Kauf und Kunde über die **E-Mail** — „weil es keine andere Verbindung gibt". Seit dem Kontakt-Umzug (20.08.) hängen **104 von 113** Bestellungen an einer `person_id`. Die E-Mail bleibt Rückfall für die 9 alten Zeilen.

**Im Portal** steht neben dem Kauf jetzt ein zweiter, ruhiger Weg: *„Du hast deine Auskunft schon? Dann lade sie einfach hoch — du musst nichts kaufen."* Mit Sprunganker zum Upload.

### Teil 2: Fünf Pakete zurückgeholt, 34 Lücken sichtbar gemacht

**39 bezahlte** Bestellungen trugen keine Paketbezeichnung. Fünf ließen sich aus dem Betrag ableiten — **exakter** Preistreffer, keine Schätzung:

| | |
|---|---|
| Patrick Ellmer | 79,99 € → Ultra |
| Iris Gamauf · Dirk Ladewig · Nizam gökay Terzi | 99,99 € → High End |
| Ostap Lemishka | 7,99 € → Starter |

Nachgetragen mit Eintrag im Kundenverlauf. Die **34 übrigen** haben *keinen* Hinweis: kein Betrag, kein Bankeingang, kein Paket-Schlüssel — alle aus Ende Juni / Anfang Juli 2026.

**Sie bekommen keinen geratenen Namen.** Ein geratenes Paket landet in der Rechnung, in der Abo-Rate und in der Provisionsrechnung, und niemand könnte hinterher sagen, ob es stimmt. Statt eines Gedankenstrichs (der aussieht wie „kein Paket bestellt") steht dort jetzt **„Paket unbekannt · nachtragen"** in Bernstein — eine sichtbare Lücke ist ehrlich, eine gefüllte ist eine Behauptung.

### Was die Messung an den Auftragsannahmen korrigiert hat

Drei Zahlen im Auftrag stimmten nicht mit dem Bestand überein — hier die gemessenen:

| Auftrag | gemessen |
|---|---|
| Imzerovic, Felkovic, Gammow | **nicht im Bestand.** Nur **Stefanescu** existiert (4 Bestellungen, Auskunft-Kauf jeweils `expired`) |
| Brannix mit 99,99 € | Der Mensch heißt **Natascha Branics**, Paket **Ultra 79,99 €**, Zahlung offen |
| Toth: „erhalten 59,99, nicht korrekt" | **Kein Bankeingang zugeordnet.** Beide Bestellungen (Pro 59,99 und Ultra 79,99) stehen auf `pending_payment` — er hat nach Datenlage *nicht* bezahlt |
| Bauer & Kovic „bezahlt ohne Bezeichnung" | Beide haben Bezeichnungen. Das Problem existiert, aber bei **39 anderen** |
| 185 offene `number_update_request` | **12** Einträge in `fiaon_contact_log` |

Der Kern jeder Meldung war richtig — die Zahlen und Namen waren es nicht. Deshalb steht am Anfang jedes Auftrags eine Messung.

### Geprüft

`scripts/pruef-bonitaet.ts` — **71 Prüfungen**, alle grün: elf Konstellationen (inklusive der drei Schreibweisen und „Kauf abgelaufen"), `darfKaufen` je Fall, Klartext ohne Fachwort, **Einzel- gegen Sammelfassung an 40 echten Fällen** (ungünstigster zuerst: Dokument *und* Kauf), die Route mit alten *und* neuen Feldnamen, der Portal-Anker.

**Rot-Probe:** „bezahlt darf wieder kaufen" und „Dokument-Fall entfernt" → **9 Prüfungen rot**, darunter beide Kern-Aussagen.

### Nicht angefangen

- **Teil 3** — Pflichtnotiz im Listen-Weg, die 12 Wartezustände
- **Teil 4** — Zustellprotokoll mit Filtern, aufklappbaren Zeilen, Seiten, CSV
- **Teil 5** — Der Kalender: Gefunden ist `client/src/components/internal/team-calendar.tsx` mit `grid-cols-7` (7 Spalten à ~50 px auf 380 px). Der **Agenten**-Kalender (`/agent/kalender`) ist bereits eine gestapelte Liste und braucht nichts.

**Betreiber-TODO:** **35 Dokumente liegen ungeprüft.** Sie stehen jetzt mit „Ein Mitarbeiter muss das Dokument prüfen" in der Akte — vorher sah das niemand.

## 17.08.2026 — Der HTTP 400, der 35 Make-Zweige zu Unrecht beschuldigte

### Der Befund

Der Betreiber setzte `BREVO_API_KEY`. Die Zweig-Prüfung scheiterte trotzdem bei **allen 35 Ereignissen identisch** mit „Brevo hat mit HTTP 400 geantwortet" — während das Zustellprotokoll alle Testmails als versandt zeigte und er sie **empfing**.

Die Kachel meldete **„35 ohne Zweig"**. Der Versand war die ganze Zeit gesund.

### Die Ursache — in einer Zeile

```
const bis = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
…&startDate=${von}&endDate=${bis}&limit=100&sort=desc
```

`endDate` lag **einen Tag in der Zukunft** — gut gemeint („damit heute sicher mitgezählt wird"), aber Brevo lehnt das mit 400 ab.

**Die Korrektur** kommt aus der Brevo-Referenz zu `GET /smtp/statistics/events`:

> `days` — Number of days in the past **including today** (positive integer, maximum 90). *Not compatible with 'startDate' and 'endDate'.*

`days` kann per Bauart kein Zukunftsdatum enthalten und schließt heute ein — genau das, was der Datumsbereich erreichen wollte, mit *einem* Parameter statt zweier, die zueinander passen müssen. Dazu: `limit` von 100 auf 1.000 (35 Mails erzeugen je mehrere Ereignisse — fehlende Treffer sähen wieder aus wie „Zweig fehlt"), und `messageId` wird jetzt in beiden Schreibweisen gelesen.

### Der eigentliche Schaden war nicht der 400, sondern die Anschuldigung

Ein 400 fiel in den Sammelfall: *„Brevo hat mit HTTP 400 geantwortet … gehört in eine Rückfrage an Brevo."* Falsch in beide Richtungen — der Fehler lag bei **uns**, und der Betreiber wurde zum Anbieter geschickt. Schlimmer: Alles, was nicht „bestätigt" war, zählte als „ohne Zweig".

**Das ist dasselbe Muster wie am 09.08.2026**, als die Plattform aus einem Wort in ihrer *eigenen* Beschreibung „MAKE-ZWEIG FEHLT" machte.

Deshalb gibt es jetzt **drei Zustände** statt zwei:

| Zustand | Bedeutung | Zählt als „ohne Zweig"? |
|---|---|---|
| **bestätigt** | Die Mail ist nachweislich bei Brevo angekommen | — |
| **Zweig fehlt** | Sie kam nicht an, obwohl die Abfrage funktionierte | **ja** |
| **Prüfung gestört** | *Wir* konnten nicht nachsehen | **nein** |

Der dritte Zustand ist der Kern. Und `BrevoKlartext` trägt jetzt ein Feld `wer: "wir" | "brevo" | "einstellung"` — die Oberfläche zeigt bei `"wir"` eine violette Marke **„unser Fehler"** samt Brevos Originalsatz und aufklappbarer Rohantwort. Dazu der Satz, der die falsche Suche beendet: *„Nichts in Make zu tun."*

**Und eine gestörte Prüfung markiert keinen Zweig mehr als fehlend** — vorher schrieb sie „geprüft und gescheitert" in die Datenbank, obwohl nichts geprüft wurde.

### Der Prüflauf: aus über zwei Minuten werden ~34 Sekunden

Vorher 35 × (senden → 4 s warten → bei Brevo fragen) = **über 140 Sekunden** und 35 Brevo-Abrufe, die die Bremse reizen (HTTP 429).

Jetzt: alle 35 Mails gestaffelt (200 ms gegen Make-Drosselung) → **einmal** warten → **einmal** fragen. Brevo liefert alle Ereignisse einer Adresse in einer Antwort. **Ein Abruf statt 35.**

Die Einzelprüfung „Zweig prüfen" benutzt **dieselbe Funktion** mit einem Element — zwei Fassungen derselben Prüfung gehen auseinander, und beide Prüfstände bleiben grün.

### Die Seite neu geordnet

Das Zustellprotokoll stand als **erstes** auf der Seite. Der Betreiber scrollte an einer 14-Tage-Liste vorbei, um an „Alle Zweige prüfen" zu kommen — die beiden Dinge, für die er die Seite öffnet. Neue Ordnung: Ampel und Prüfknopf, dann die Ereignisse, **ganz unten** das Protokoll. Ein Sprunganker im Kopf führt direkt hin.

### Drei eigene Fehler beim Bauen

1. **Ein Quelltext-Grep traf meinen eigenen Kommentar.** Die Prüfung „das Zukunftsdatum ist weg" wurde rot — sie fand den alten Code in der Begründung, warum er weg ist. Wer die *Abwesenheit* von Code prüft, muss Kommentare ausschließen; sonst ist gute Dokumentation ein Fehlalarm, und die naheliegende Reaktion wäre, die Begründung zu löschen.
2. **Ein Verbot der Zahl traf ihren richtigen Gebrauch.** `86_400_000` steht auch in `(Date.now() - seit) / 86_400_000` — Millisekunden pro Tag. Der Fehler war nicht die Zahl, sondern das **Plus**.
3. **Die alte Laufzeit stand an zwei Stellen.** Ich korrigierte die Fortschrittsleiste; im Bestätigungsdialog stand weiter „etwa 2 Minuten". Gefunden hat es der **Screenshot** der Abnahme, nicht der Prüfstand.

### Was NICHT fertig ist

**Teil 4 (Zustellprotokoll mit Filtern, aufklappbaren Zeilen, Seitenweise, CSV-Export, 380-px-Karten) ist nicht angefangen.** Das Protokoll ist verschoben und erreichbar, aber inhaltlich unverändert.

**Geprüft:** 36 Prüfungen (`scripts/pruef-zweigampel.ts`) mit Rot-Probe (Zukunftsdatum zurückgebaut → 6 rot), 24 im Browser (`scripts/pruef-ampel-browser.ts`) mit Attrappe für alle drei Zustände. Screenshots in `reports/ampel/`.

**Betreiber-TODO:** Nach dem Deploy „Alle Zweige prüfen" erneut drücken — die Ampel sollte sich jetzt selbst bestätigen.

## 17.08.2026 (später) — Eine Datenquelle: die Kontaktdaten gehören der Person

### Der Auftrag

„Das Doppel-Datenmodell muss STERBEN. Nie wieder ‚E-Mail am Antrag, aber nicht an der Person', nie wieder Doppel-Datensätze aus Antrag+Lead, nie wieder stilles Scheitern beim Versand."

### Die Inventur zuerst — sie hat den Weg bestimmt

| | |
|---|---|
| Code-Zugriffe auf die Kontakt-Spalten | **397** in **62 Dateien** |
| … davon **schreibende** Anweisungen | **36** in **7 Dateien** |
| Bestellungen: Nummer nicht an der Person | **2.387** |
| Bestellungen: E-Mail nicht an der Person | **293** |
| Leads: E-Mail nicht an der Person | **189** |
| **Menschen ohne E-Mail, obwohl eine am Antrag stand** | **169** (17 zahlend) |

Ein `DROP COLUMN` vor dem Code-Umzug hätte den Server nicht mehr starten lassen — Login, Rechnungen und Mail-Versand lesen diese Spalten. Die 169 sind der teure Teil: **Diese Menschen konnten keine Mail bekommen**, obwohl ihre Adresse im System stand. Genau die Fälle Bianco und Rechtsteiner.

### 1. Die Wand: Divergenz kann nicht mehr ENTSTEHEN

Ein Datenbank-Trigger (Migration 059) schreibt **jeden** Kontaktwert an die Person durch:

- Person leer → **sie übernimmt ihn**
- Person gleich → nichts
- Person abweichend → **sie behält**, der Zeilenwert wird **Alias** (die Suche findet ihn weiter)

**Warum in der Datenbank und nicht im Code:** Eine Regel im Code müsste 397 Stellen kennen, eine in der Datenbank keine. Der Trigger sitzt *hinter* allen Wegen — Antragsstrecke, Lead-Intake, Admin-Anlage, CSV-Import, Make-Webhook, ein Skript von Hand, ein alter Client, der noch nicht ausgeliefert ist. **Es gibt keinen Weg daran vorbei.**

Damit sind die Spalten reine **Abschriften**. Der `DROP` ist eine Aufräumarbeit ohne Eile geworden, kein Rennen gegen neue Fehler. Die vollständige Liste der 397 Stellen liegt als Arbeitsvorrat in `reports/arbeitsvorrat-kontaktspalten.md` — nach Datei, schreibende zuerst.

**Rot-Probe:** Trigger abgeschaltet → **6 Prüfungen rot**, genau die Wand-Prüfungen. Danach wieder eingeschaltet und grün.

### 2. Der Umzug: 0 Menschen ohne erreichbare Adresse

Nach dem Lauf (`scripts/eine-quelle-lauf.ts`): **0** Bestellungen mit unbekannter E-Mail, **0** mit unbekannter Nummer, **0** Menschen ohne E-Mail trotz Adresse am Antrag. **11.514 Werte** liegen als Forensik-Kopie in `fiaon_kontakt_archiv` — für den späteren `DROP`, von der Anwendung nie gelesen.

**Rechtsteiner** hat jetzt `euro-tec@t-online.de` an der Person. Vorher: keine Adresse, kein Versand möglich.

### 3. Die Dubletten-Wurzel — und ein Fund, den niemand erwartet hat

Der Trigger stieß auf eine Adresse, die schon **einem anderen Menschen** gehörte. Vorher scheiterte das Einfügen still (`ON CONFLICT DO NOTHING`) und der Hinweis war weg. Jetzt schreibt er einen **Doppelgänger-Hinweis**: Der Unique-Index auf Alias-Adressen ist ein Detektor.

**Und dann der eigentliche Fund.** Bianco erschien trotzdem nicht in der Dubletten-Ansicht. Der Grund stand in der Datenbank:

> Paar (3598, 5564), abgehakt am 08.08.2026: *„Nur Namensähnlichkeit ohne zweites Merkmal (Abstand 0). Kein Beweis für denselben Menschen."*

Das war **damals richtig** — Person 3598 hatte keine E-Mail, sie stand nur an der Bestellzeile. Seit dem Umzug tragen beide `pietro.bianco@web.de`. **Das Merkmal, dessen Fehlen die Ablehnung begründete, ist da.**

Also gilt jetzt: Eine Ablehnung „nur Name, kein zweites Merkmal" wird **ungültig**, sobald ein belastbares Merkmal auftaucht. Ablehnungen mit anderer Begründung bleiben gültig — wer „Vater und Sohn" geschrieben hat, hat das Merkmal gesehen und trotzdem entschieden.

**Wirkung:** Die Dubletten-Ansicht zeigte **3** Kandidaten. Nach dem Umzug **18**. Nach dieser Korrektur **37** — davon 34 über die E-Mail. **19 Doppelgänger waren durch überholte Entscheidungen verdeckt.** Matzke, Schlabs und Bianco sind dabei; Natascha **Branics** (im Auftrag als „Brannix") steht an erster Stelle.

### 4. Die Zweig-Ampel sagt die Wahrheit

Der Betreiber hat alle Make-Zweige von Hand geprüft, die Mails kommen an — und sah trotzdem 35 gelbe Marken „nicht bestätigt" ohne Erklärung.

`/admin/events` zeigt jetzt ganz oben: **„Bestätigung inaktiv: BREVO_API_KEY fehlt in der Umgebung"** — mit dem Satz, der den Unterschied macht: *„Die gelben Marken bedeuten nicht, dass Zweige fehlen. Sie bedeuten: Wir können es nicht nachprüfen."* Dazu die Messung (10.431 Mails, 0 abgeglichen) und die Handlung. Die Ampel war nicht gelb, weil etwas kaputt ist, sondern weil sie **nichts messen kann**.

**Und „E-Mail-Events" hat eine eigene Marke** — vorher trug es dasselbe Zeichen wie „Mail-Zentrale", eine Zeile darüber. Ein Umschlag mit Prüfhaken, selbst gezeichnet, 1,5 px, `currentColor`.

### Fünf eigene Fehler

1. **Der Umzug lief ins Leere.** `SET updated_at = updated_at` nennt keine Kontakt-Spalte — und der Trigger ist `AFTER UPDATE OF email, phone, …`. Er feuert nur, wenn eine dieser Spalten in der Anweisung *steht*. Der Lauf meldete 98 angefasste Zeilen und änderte nichts.
2. **Zwei Fassungen der Nummern-Regel.** Der Trigger setzte Vorwahl und Nummer zusammen, die Zählprobe prüfte `phone` allein — 74 Fehlmeldungen. Jetzt eine SQL-Funktion, die beide benutzen. (Sie stand erst im Skript, dann am Ende einer schon angewendeten Migration — beides falsch. Eine angewendete Migration wird nicht verändert, sie bekommt eine Nachfolgerin.)
3. **Ich baute eine zweite Dubletten-Liste.** Es gibt längst eine Maschine mit vier Stufen unter `/admin/dubletten`. 170 Einträge sind auf `in_bestehender_ansicht` gesetzt (nicht gelöscht). Der Fehler wäre im Namen der Reparatur entstanden.
4. **Der Browsertest prüfte die Anmeldeseite.** Geratener Zugangscode → alle neun Prüfungen rot. Nur der Screenshot verriet es.
5. **Die Wartebedingung passte auf das Gerüst.** `/E-Mail-Events/` traf den Menü-Eintrag, der sofort da ist. Sechs Prüfungen rot auf Desktop, grün auf 380 px — dort ist das Menü eingeklappt.

### Was NICHT fertig ist

- **Der `DROP` der Spalten** — er braucht den Code-Umzug der 397 Stellen (36 schreibende zuerst). Arbeitsvorrat liegt vor. Die Eile ist weg, weil die Wand steht.
- **Teil 4 (eine SCHUFA-Wahrheit)** und **Teil 5** (Toth, Bauer, Kovic, „Erreicht — Sonstiges" im Listenweg, 185 Wartezustände, Kalender auf 380 px) sind **nicht angefangen**.
- **Brannix** ist gefunden (Natascha Branics), aber nicht zusammengeführt — das ist eine Entscheidung für die Dubletten-Ansicht.

**Geprüft:** 36 Prüfungen in `scripts/pruef-eine-quelle.ts`, 12 im Browser (`scripts/pruef-ampel-browser.ts`), Screenshots in `reports/ampel/`.

## 17.08.2026 — Ein Ablauf für alle: die Stufe wird abgeleitet, nicht geglaubt

### Der Screenshot-Fehler war der Normalzustand

Im Portal stand „Status: Aktiv · Freigeschaltet" bei einem Kunden, der nie ein Startgespräch geführt hatte. Gemessen:

| | |
|---|---|
| Bezahlte Paket-Bestellungen | **365** |
| … Spalte sagte „voll_aktiv" | **359** |
| … Startgespräch **wirklich** erledigt | **0** |
| **Zeigten „voll aktiv" ohne Gespräch** | **364** |
| … hatten nie einen Termin | **365** |

Kein Einzelfall. Bei 364 von 365 zahlenden Kunden stand überall etwas Falsches.

**Die Ursache:** Es gab drei Quellen für „ist dieser Kunde freigeschaltet".
1. Die Status-Kachel las `account_status` — das heißt nur „nicht gesperrt".
2. Die Kontostufe las die **Spalte** `onboarding_stufe`.
3. Die Akte las einen Statustext über die Zahlung.

Drei Quellen, drei Wahrheiten. Eine Spalte ist ein Merker, keine Wahrheit — steht dort etwas Falsches, zeigt das Portal etwas Falsches.

### 1. Die Zustandsmaschine: eine Ableitung, drei Zustände

`server/lib/fiaon-kundenstufe.ts` rechnet die Stufe aus dem Ablauf:

- **kein_zugang** — nicht bezahlt
- **wartet_auf_onboarding** — Paket bezahlt, Startgespräch nicht erledigt
- **voll_aktiv** — Startgespräch erledigt **oder** Ausnahme mit Grund

Alle Anzeigen lesen sie: Portal-Kachel, Sperrkarten, Akte, Leitungs-Schublade, Als-Kunde-Ansicht. Die Spalte bleibt als **Abschrift** für Listen (360 Kunden einzeln ableiten wären 360 Abfragen) — und `stufeAbgleichen()` zieht sie nach. Weicht sie ab, zeigt die Akte es an, statt es zu verschweigen.

Jede Stufe bringt ihren **Grund** und den **nächsten Schritt** in Worten mit: „Bezahlt, aber das Startgespräch ist noch nicht geführt" · „Startgespräch einladen: Der Kunde sieht das Gate beim nächsten Login."

### 2. Der Bestand: 364 Menschen kommen ins Gate — aber die Tür hat einen Schlüssel

**Vor dem Schreiben fiel etwas auf, das den ganzen Auftrag gekippt hätte:** Die Rollen im Haus sind vertriebsleiter (2), agent (2), inkasso (2). **Kein einziger Onboarding-Mitarbeiter.** Und `freieSlots(…, "onboarding_call")` filtert nach genau dieser Rolle — es kamen **null Slots**.

Hätte ich die 364 auf `wartet_auf_onboarding` gesetzt, stünden sie beim nächsten Login vor einem Pflicht-Gate ohne Termine: buchen unmöglich, „Später" abgeschafft, nur noch Abmelden. **364 zahlende Menschen ausgesperrt** — genau der Vorfall, den AGENTS.md unter „349 Menschen vor einer verschlossenen Tür" beschreibt.

Zwei Dinge sind daraus geworden:

- **Ein Rückfall:** Gibt es keinen aktiven Onboarding-Menschen, stellen Vertrieb und Leitung die Slots. Aus 0 wurden **60 Zeiten über 12 Tage**. Die Entscheidung wird protokolliert, damit sie nicht unbemerkt zum Dauerzustand wird. Ein Gespräch, das ein Vertriebsmitarbeiter führt, ist ein geführtes Gespräch; ein Gate ohne Slots ist ein Ausfall.
- **Eine Wand im Lauf:** `scripts/ablauf-bestand-lauf.ts` prüft VOR dem Schreiben, ob ein echter wartender Kunde buchen kann — und **bricht ab**, wenn nicht. Getestet: Mit entferntem Rückfall bricht er trotz `--schreiben` ab. Eine Migration, die eine Tür zumacht, muss beweisen, dass es einen Schlüssel gibt.

**Geschrieben:** 365 Stufen (359 × voll_aktiv → wartet, 5 × leer → wartet, 1 × leer → voll_aktiv). Zählprobe und Gegenprobe je 0. **Keine Mail aus dem Lauf** — die Einladung übernimmt die bestehende Staffel mit ihrer Grenze von 50 am Tag.

**Für Härtefälle** gibt es „Onboarding-Pflicht aussetzen" in der Akte: mit Grund (Pflicht, mindestens 10 Zeichen), mit Namen, im Kundenverlauf protokolliert. Ohne Grund greift die Ausnahme **nicht** — sonst wäre der Schalter eine Hintertür ohne Spur. Die Alternative wäre gewesen, einen Termin zu **fälschen**; das verdirbt jede Onboarding-Statistik und jede Vergütungsrechnung.

### 3. Das Gate: beide Karten gleichzeitig

Links das Startgespräch (Pflicht, breiter, zuerst), rechts die Bonitätsauskunft (74 €, freiwillig, ruhiger). Oben eine Fortschrittsleiste: **Zahlung ✓ · Startgespräch ○ · Auskunft ○ freiwillig · Freischaltung ○**.

Die Auskunft erschien vorher erst **nach** der Buchung — mit der Begründung, sie stünde sonst in Konkurrenz zum Pflichtschritt. Der Betreiber entscheidet anders, und er hat den besseren Grund: Wer nach dem Buchen die Tafel schließt, hat die Auskunft nie gesehen (287 bezahlte Kunden ohne Auskunft). Die Konkurrenz wird jetzt durch **Gewicht** vermieden, nicht durch Verstecken. Und „freiwillig" steht ausdrücklich dran, damit niemand glaubt, er müsse 74 € zahlen, um sein Konto zu öffnen.

**Nebenbefund aus dem Screenshot:** Vor dem Gate lag die Begrüßungstafel („Hallo Yvonne, schön, dass du da bist!"). Zwei Tafeln hintereinander liest niemand — die zweite wird weggeklickt. Solange das Gate ansteht, tritt die Begrüßung zurück; sie erscheint, sobald das Gespräch geführt ist.

### 4. Die Akte als Kommandozentrale

Der Kopf ist ein **gemeinsames Bauteil** (`KundenKopf`) für Verwaltungs-Akte und Leitungs-Schublade: Name, Stufen-Marke aus der einen Ableitung, Ablauf-Leiste (Antrag ✓ · Zahlung ✓ · Startgespräch ○ · Auskunft ○ · Voll aktiv ○ · Abo läuft) und der nächste Schritt mit Knopf.

**Warum ein Bauteil:** Die Akte hat 1.324 Zeilen, das Cockpit 1.172. Beide zeichneten denselben Kunden mit eigenem Quelltext. Eine Änderung an einer Stelle erreichte die andere nicht — und niemand merkte es, weil beide für sich richtig aussahen.

**Ehrlich zum Umfang:** Kopf, Ablauf-Leiste, nächster Schritt und die Aktionen sind zusammengeführt. Die **Sektionen** (Abo & Raten, Dokumente, E-Mails, Termine, Anrufe, Verlauf, Notizen) sind noch zwei Fassungen. Das ist ein eigener Auftrag — ich habe das Fundament gelegt, damit sie **hier hinein** wandern und nicht in eine dritte Datei.

### 5. SCHUFA-nur-Bestellungen

**3 Menschen** haben eine Auskunft gekauft, aber kein Paket. Sie bekommen kein Abo und kein Gate: Für dieses Produkt gibt es kein Startgespräch, und sie ins Gate zu schicken wäre eine Aufforderung zu einem Termin über nichts. Geprüft: **0 Abo-Raten** an Auskunft-Bestellungen im ganzen Bestand.

Insgesamt 110 Auskunft-Bestellungen (44 bezahlt, 17 gemeldet, 49 offen). **Betreiber-Entscheidung:** ob diese 3 aktiv auf ein Paket geführt werden sollen.

### Geprüft — der ganze Ablauf an einer Testperson

`scripts/pruef-ablauf.ts` — **62 Prüfungen**, alle grün. Acht Stationen in **einer Transaktion, die zurückgerollt wird**: Antrag → Zahlung → wartet_auf_onboarding → Gate mit beiden Karten und Slot-Grenze → Termin gebucht (gebucht ≠ geführt) → Abschluss → voll_aktiv + 15-€-Gutschrift genau einmal → Abo-Rate am Jahrestag → T+1 überfällig → Zuteilung ins Forderungsmanagement → Ausnahme mit und ohne Grund. Danach: **keine Testperson, keine Testbestellung, keine Testgutschrift** übrig (nachgezählt).

`scripts/pruef-ablauf-browser.ts` — **36 Prüfungen** am gerenderten Bild, Desktop und 380 px, Screenshots in `reports/ablauf/`.

**Rot-Probe:** Ableitung liest wieder die Spalte, Ausnahme greift ohne Grund → **7 Prüfungen rot**, darunter die Abweichung zwischen Einzel- und Sammelfassung.

### Vier eigene Fehler, die der Weg zutage brachte

1. **`aboBeiZahlungAnlegen()` schreibt mit `sqlPool`, nicht mit dem übergebenen Lauf.** Ein Aufruf im Prüfstand hätte **außerhalb** der Transaktion geschrieben — eine echte Testbestellung mit echten Raten in der Produktionsdatenbank. Aufgefallen ist es nur, weil die Funktion zusätzlich DDL macht und in einen Lock-Timeout lief. Der Timeout war ein Glücksfall.
2. **Ein falsch-grüner Browsertest.** „Karte Bonitätsauskunft da" las den `innerText` des ganzen Body und wurde grün durch einen Satz, der im Dashboard **hinter** der Bühne steht. Jetzt wird **in der Bühne** gemessen. Aufgefallen ist es, weil die 74-€-Prüfung ihre Fundstelle mit ausgab — eine Prüfung, die nur „rot" sagt, schickt einen auf die falsche Suche.
3. **`created_at` war das falsche Kriterium.** Ein laufender Antrag wird bei **jedem Formularschritt** neu geschrieben: `created_at` bleibt alt, `pack_name` wird vom noch nicht ausgelieferten Client erneut mit Umbruch gesetzt. Die Grenze prüft jetzt `updated_at` — und der Bereinigungslauf **merkt sich seinen Zeitpunkt** in den Einstellungen, statt „vor einer Stunde" zu raten.
4. **Die Begrüßungstafel entschied, bevor die Stufe bekannt war** (asynchrone Abfrage). Jetzt wartet sie.

**Betreiber-TODOs:**
- Ein Konto mit der Rolle **onboarding** anlegen — dann greift wieder die Rolle statt des Rückfalls.
- Nach dem Deploy: `npx tsx scripts/datenkosmetik-lauf.ts --schreiben` (der alte Client verschmutzt bis dahin weiter).
- Entscheiden, ob die **3 SCHUFA-nur-Fälle** auf ein Paket geführt werden.

**Wo zu finden:** `server/lib/fiaon-kundenstufe.ts` · `scripts/ablauf-bestand-lauf.ts` · `client/src/components/kunde/AblaufLeiste.tsx` · `db/migrations/058_onboarding_ausnahme.sql` · `scripts/mess-ablauf.ts`.

## 19.08.2026 (später) — Datenkosmetik: 7.163 Paketnamen einzeilig, 2.642 Namen sauber — und der eigentliche Fehler war ein anderer

### Was der Screenshot zeigte, und was wirklich dahinter lag

Im Portal stand „Guten Abend, Vitor Manuel ." mit hängendem Punkt und in der Paket-Kachel nur „Maximum)". Zwei Symptome, und ich vermutete eine Ursache: den Zeilenumbruch in den Daten.

Beim Bereinigen stellte sich heraus: **Es waren zwei verschiedene Ursachen, und die zweite hatte mit dem Umbruch nichts zu tun.**

| Was | Gemessen | Behoben |
|---|---|---|
| Paketnamen mit Zeilenumbruch | **6.589** von 6.852 | **7.163** Zeilen bereinigt (inkl. zusammengeführter) |
| Vor-/Nachnamen mit Leerraum am Rand | **1.247** + 1.122 | **2.642** Felder in zwei Tabellen |
| Davon aus den letzten 7 Tagen | **689** | Quelle gefixt — die Verschmutzung lief weiter |

### 1. Der Umbruch — gefixt an der Quelle, nicht nur im Bestand

Die Paketliste im Antrag definierte `name: "FIAON High End\n(Das Maximum)"` — ein Feld mit Umbruch, weil die Verkaufskarte zwei Zeilen zeigen soll. Der Umbruch ging mit in die Datenbank.

**Jetzt:** Name und Beisatz sind getrennt (`name` + `sub`), die Karte setzt sie untereinander, die Daten bekommen `FIAON High End (Das Maximum)` — einzeilig. Genau so machen es `start.tsx` und `fiaon-home.tsx` seit immer; nur die zwei Seiten, die in die Datenbank schreiben, taten es nicht.

**Und die Wand steht an der Schreibstelle**, nicht im Formular: `paketNameEinzeilig()` läuft im Server, bevor geschrieben wird. Es gibt vier Antragsstrecken — wer nur den Client säubert, hat den nächsten Weg schon vergessen.

An einer Stelle im Antrag stand übrigens schon `pack.name.replace(/\n/g, " ")`. Jemand hatte das Problem gesehen und dort behoben, wo es weh tat. **So entstehen Fehler, die überall sonst bleiben:** Die Reparatur an der Fundstelle nimmt den Druck weg, die Ursache zu beheben.

### 2. Die Namen — eine Funktion, alle Schreibwege

`nameSauber()` räumt Leerraum: Rand weg, doppelte Leerzeichen innen zu einem, Umbrüche zu Leerzeichen. **Sonst nichts** — keine Großschreibungs-Korrektur, keine Umlautersetzung. Ein Name gehört dem Menschen; „mcdonald" zu „McDonald" zu verbessern trifft manchmal richtig und manchmal falsch, und eine falsche Verbesserung am eigenen Namen ist ärgerlicher als eine fehlende.

Vier Schreibwege benutzen sie jetzt: Antrag, Stammdaten-Korrektur (Agent + Verwaltung), Lead-Eingang, Lead-Import. Zwei davon hatten ihr **eigenes** `.trim()` — das räumt den Rand, aber nicht die doppelten Leerzeichen innen, und es war die zweite Fassung derselben Regel. Der Prüfstand verbietet eigene `trim()`-Aufrufe auf Namensfelder jetzt ausdrücklich.

**Kein Alias:** „Violeta " ist nicht ein anderer Name als „Violeta", sondern derselbe, sauber geschrieben. Der Lauf prüft trotzdem bei jedem Feld, ob sich mehr als Leerraum ändert — und würde dann überspringen. Es kam nicht vor.

### 3. Der eigentliche Fehler in der Kachel — und wie er beinahe durchgekommen wäre

Nach dem Bestandslauf war die Zählprobe bei 0, der Prüfstand **38-mal grün**. Dann habe ich den Screenshot angesehen: In der Paket-Kachel stand weiter **„Maximum)"**.

Die Ursache war nicht der Umbruch, sondern eine Zeile im Portal:

```
user.packName?.split(" ").pop()
```

Bei „FIAON Pro" ergibt das „Pro" — richtig, und deshalb fiel es jahrelang nicht auf. Bei „FIAON High End (Das Maximum)" ergibt es „Maximum)": das letzte Wort samt schließender Klammer. **Der Umbruch hat den Fehler nur verdeckt.**

Jetzt macht `paketKurz()` daraus „High End": Beisatz in Klammern weg, Marke weg, übrig bleibt, was das Paket unterscheidet. Was dem Muster nicht folgt, wird nur gekürzt und nicht geraten — bei „Bonitätsauskunft inkl. Handlungsplan" wäre jede Kurzform eine Erfindung.

**Die Lehre steht in AGENTS.md:** 38 grüne Prüfungen sahen alle die SPALTE an. Keine sah das BILD.

### 4. Portal-Zugang ohne Zahlung — gemessen, nicht angetastet

Die Geschäftsregel lautet: Zugang nach Zahlung. Gemessen:

| | |
|---|---|
| Konten mit Passwort (anmeldbar) | **950** |
| … bezahlt | 305 |
| **… Zugang OHNE Zahlung** | **619** |

**Die Herkunft:** `LOGIN_ACCESS_STATUSES` in `server/fiaon-login-logic.ts` enthält `completed` — und `status = 'completed'` setzt der **Antragsabschluss**, also vor der Zahlung. Der Login prüft danach nur noch den Status.

**Und es ist kein Altbestandsproblem:** Nur **12** sind älter als 90 Tage, aber **169 jünger als 7 Tage**. Es entsteht weiter.

**Die schwerwiegenden Fälle** — Zahlung beendet, Zugang offen:

| Zahlungsstand | Anzahl |
|---|---|
| abgelaufen (`expired`) | **145** |
| ersetzt (`superseded`) | 15 |
| storniert (`cancelled`) | 2 |
| **erstattet (`refunded`)** | **1** |

Bei diesen ist die Geschäftsbeziehung beendet oder nie zustande gekommen — und der Zugang steht offen. **Nichts geändert:** 619 Menschen an einem Morgen auszusperren ist eine Entscheidung des Betreibers, kein Wartungsschritt. Liste in `reports/mess-zugang-ohne-zahlung.csv`.

### Nebenbefund

**3.889 Bestellzeilen tragen keinen Namen** — Formularentwürfe, bei denen niemand etwas eingetippt hat. Davon sind **2 bezahlt**. Diese zwei gehören angesehen: Eine bezahlte Bestellung ohne Namen lässt sich keinem Menschen zuordnen.

### Geprüft

`scripts/pruef-datenkosmetik.ts` — **38 Prüfungen** grün. `scripts/pruef-datenkosmetik-browser.ts` — **11 Prüfungen** am gerenderten Bild, Prüffall ist **derselbe Kunde wie im Screenshot** (nicht ein beliebiger, dem der Fehler nie passiert wäre).

**Rot-Probe:** Drei Fehler eingebaut (Umbruch wird entfernt statt ersetzt, Kurzform nimmt wieder das letzte Wort, Reinigung tut nichts) → **10 Prüfungen rot**.

**Und die Rot-Probe brachte noch etwas:** Zwanzig Minuten nach dem Lauf standen wieder drei Zeilen mit Umbruch da — angelegt 15:12 und 15:15 Uhr, Status „personal_data": echte Besucher, die gerade ausfüllen. Keine Lücke im Fix, sondern seine Auslieferung: **Der Produktionsserver läuft noch mit dem alten Code.**

**Betreiber-TODO:** Nach dem Deploy den Lauf einmal wiederholen —
`npx tsx scripts/datenkosmetik-lauf.ts --nur=pakete --schreiben`

Der Prüfstand trennt deshalb Altbestand (muss 0 sein) von Neuzugang der letzten Stunde (wird gemeldet, nicht gewertet). Ein Prüfstand, der wegen laufendem Betrieb rot wird, wird abgeschaltet.

**Wo zu finden:** `shared/fiaon-paketname.ts` · `shared/fiaon-namen.ts` · `scripts/datenkosmetik-lauf.ts` (Vorschau + `--schreiben`) · `scripts/mess-datenkosmetik.ts`.

## 19.08.2026 — Das Portal mit den Augen des Kunden, und „wir rufen an" endlich unübersehbar

### 1. Als-Kunde-Ansicht — 360 Konten, die man jetzt ansehen kann

„Warum sieht der Kunde seinen Fahrplan nicht?" ließ sich bisher nicht beantworten. Der Betreiber kann sich kein Konto je Kontostufe anlegen, und ein Kundenpasswort zurückzusetzen, nur um nachzusehen, sperrt einen zahlenden Menschen aus.

**Jetzt:** In der Kundenakte und in der Cockpit-Schublade der Leitung steht „Portal ansehen als [Vorname]". Neuer Tab, das echte Kundenportal, im echten Zustand dieses Menschen — Kontostufe, Gate, Bonitätskarte, Sperrkarten, Unterlagen, Rechnungen.

**Die Gefahr ist hier größer als bei der Mitarbeiter-Ansicht.** Im Kundenportal liegen Knöpfe, die Geld und Recht bewegen: 74 € bestellen, „Ich habe überwiesen" melden, kündigen, Unterlagen hochladen. Ein versehentlicher Klick wäre eine Handlung **im Namen** des Kunden, und niemand könnte hinterher sagen, dass der Kunde sie nicht selbst getan hat. Deshalb fünf Wände:

1. **Eigenes Token**, signiert, 30 Minuten. Niemals die echte Kunden-Anmeldung.
2. **An den Ansehenden gebunden.** Das Token trägt, wer ansieht, und die Prüfung verlangt, dass dessen Zugang noch gilt. Ein weitergegebener Link öffnet nichts. *(Das Token der Mitarbeiter-Ansicht kann das nicht — sein Kommentar behauptet es, der Code tut es nicht.)*
3. **Nur lesen**, an einer Stelle nach der HTTP-Methode. Eine Liste schreibender Routen müsste man pflegen, und genau die eine würde man vergessen.
4. **Banner über dem ganzen Portal**, nicht wegklickbar, mit Namen und Restzeit. Er steht in `App.tsx`, nicht in `dashboard.tsx`: Ein Banner nur auf der Übersicht wäre auf jeder Unterseite weg — und genau dort klickt man dann etwas an.
5. **Protokoll im Kundenverlauf.** Die Frage lautet später „wer hat in mein Konto gesehen?", und die beantwortet ein Eintrag beim Kunden, nicht einer in einer Mitarbeiterliste.

**Rechte:** Verwaltung alle Konten, Vertriebsleitung nur eigene und zugewiesene, ein Agent nie — mit einem Satz, der erklärt, warum („Deine Kunden siehst du in deiner Liste"), statt „Keine Berechtigung".

**Und eine Wand statt zwei:** `nurLesenWand` prüft jetzt beide Ansichts-Cookies. Zwei Middlewares für dasselbe gehen auseinander — jemand nimmt eine Ausnahme in die eine auf und vergisst die andere, und dann ist eine Ansicht schreibend, während beide Prüfstände grün bleiben.

### 2. „Wir rufen an" — der Satz, der No-Shows verhindert

Wer heute einen Termin bucht, erwartet einen Link. Videokonferenzen haben diese Erwartung gesetzt. Bei FIAON ruft ein Mensch an — und wer das nicht liest, sitzt vor dem Rechner, während das Telefon klingelt. Er glaubt dann, **wir** hätten uns nicht gemeldet.

Der Satz „[Name] ruft dich zur vereinbarten Zeit an — halte dein Telefon bereit" steht jetzt an vier Stellen, alle aus **einer** Quelle (`shared/fiaon-termin-text.ts`): Buchungsseite, Startgespräch-Tafel, Bestätigungsansicht und als fertige Variable in den Mail-Payloads.

Er stand vorher schon da — aber am Ende eines Absatzes. Wer einen Link erwartet, liest keine Absätze, sondern sucht eine Adresse. Jetzt steht er allein, in einem Rahmen, mit dem Telefon-Zeichen, plus dem Absage-Hinweis: Ein Termin, den man nicht absagen kann, wird nicht abgesagt, sondern verpasst.

**Betreiber-TODO:** In den Brevo-Vorlagen T31 (`termin_bestaetigung`) und T32 (`termin_erinnerung`) `{{params.hinweis_anruf}}` einsetzen. Der Satz fährt fertig mit — ihn in der Vorlage zu schreiben hieße, ihn zweimal im Haus zu haben, und dann laufen Portal und Mail auseinander.

**Im Cockpit** steht die Rufnummer jetzt **groß** im Kopf (19 px, tabellarische Ziffern, in Gruppen), mit Anrufen-Knopf daneben. Vorher gab es nur den Knopf — der reicht, solange das Softphone tut, aber die Terminzeit ist der schlechteste Moment für „das Telefon lädt nicht". Fehlt die Nummer ganz, sagt der Kopf das in Bernstein: Dieses Gespräch kann nicht stattfinden.

### 3. Die Zweig-Ampel pflegt sich selbst

„Alle Zweige prüfen" verschickt 35 Probemails und dauert zwei Minuten. Der echte Betrieb liefert dieselbe Auskunft kostenlos: Wenn eine echte Kundenmail über einen Zweig **zugestellt** wurde, existiert der Zweig. Der Zustell-Abgleich setzt den Status jetzt selbst.

Als Beweis gilt nur „zugestellt", „geöffnet" oder „geklickt" — **nicht** „angenommen": Das heißt lediglich, dass Brevo die Mail entgegengenommen hat, sie kann danach noch bouncen. Eine grüne Ampel für einen Weg, an dessen Ende nichts ankommt, wäre die falsche Auskunft.

**Betreiber-TODO, und das ist der wichtige Teil:** **Gemessen: 10.431 Mails in 30 Tagen, davon 0 abgeglichen.** Der Zustell-Abgleich braucht `BREVO_API_KEY`, und der ist nicht gesetzt. Die Verdrahtung steht, das Tor ist zu — solange der Schlüssel fehlt, kann sich die Ampel nicht pflegen, und auch der Prüfen-Knopf kann nichts bestätigen (0 von 35 Zweigen bestätigt). **Ein Schlüssel in den Umgebungsvariablen, und beides beginnt zu arbeiten.**

### 4. Kleinigkeiten aus dem Betrieb

- **`followup_48h`** trägt auf `/admin/events` jetzt „Zweig in Make kann gelöscht werden — wird nie mehr gefeuert". **Gemessen: null Versände**, und es gibt keine Stelle im Quelltext, die es auslöst. „VERALTET" allein ließ den Betreiber rätseln, ob er den Zweig noch braucht.
- Die **Bestätigungsansicht** nach der Buchung zeigt Anruf-Satz und Absage-Hinweis.

### Was die Kundensicht als Erstes gezeigt hat

Genau ihr Zweck, sofort erfüllt — zwei Datenfehler, die von außen unsichtbar waren:

| Befund | Ausmaß |
|---|---|
| Paketnamen mit **Zeilenumbruch** (`FIAON High End\n(Das Maximum)`) | **6.588 von 6.851** |
| Vor- oder Nachnamen mit Leerzeichen am Rand | **1.417** |

Im Portal steht deshalb „Guten Abend, Vitor Manuel ." und in der Paket-Kachel nur „Maximum)". Der Umbruch ist in der Paketdefinition **gewollt** (zweizeilige Darstellung auf der Verkaufsseite) — er bricht nur überall, wo der Name einzeilig gebraucht wird: Kacheln, Betreffzeilen, Listen.

**Nicht angetastet.** Das ist ein eigener Auftrag: 6.588 Datensätze zu ändern oder ein Dutzend Anzeigestellen umzubauen, gehört nicht in eine Nebenbemerkung. Die Zahl steht hier, damit sie entschieden werden kann.

### Geprüft

`scripts/pruef-kundenansicht.ts` — **70 Prüfungen**, alle grün. Der Kern ist eine **Schreibrouten-Matrix**: Elf echte Schreibwege des Kundenportals werden mit einem echten Ansichts-Cookie angegangen, jeder muss 403 antworten.

**Rot-Probe:** Wand entfernt und Signaturprüfung abgeschaltet → **16 Prüfungen rot**, darunter alle elf Matrix-Einträge. Und sie hat den Schaden gezeigt: „Bonitätsauskunft bestellen (74 €)" antwortete **HTTP 200** und legte eine echte Bestellzeile an. Sie ist archiviert (nicht gelöscht), und der Prüfstand räumt jetzt selbst auf — ein Prüfstand, der eine Sicherheitswand testet, muss damit rechnen, dass sie fällt.

`scripts/pruef-kundenansicht-browser.ts` — **8 Prüfungen** am gerenderten Bild, Screenshots in `reports/kundenansicht/`. Prüffall ist bewusst der Kunde mit dem **längsten Namen** (28 Zeichen), weil der Banner ihn trägt und auf 380 px lesbar bleiben muss.

**Wo zu finden:** `server/lib/fiaon-kundenansicht.ts` (Token, Wand, Rechte, Protokoll) · `server/routes/fiaon-kundenansicht.ts` · `client/src/pages/als-kunde.tsx` (Schleuse) · `client/src/components/KundenansichtBanner.tsx` · `shared/fiaon-termin-text.ts` (der eine Satz) · `server/lib/fiaon-zustellung.ts` (Zweig-Pflege).

## 18.08.2026 — Der Kundenweg als Maschine: eine Strecke ohne Ende, fünf Termine statt siebenundzwanzig

### Zuerst gemessen, dann gebaut

Fünf Aufträge, und für jeden zuerst die Zahl:

| Was | Vorher gemessen |
|---|---|
| Leads insgesamt | **3.820**, davon 3.686 in einer Strecke |
| Leads am ENDE der Strecke (Mail 8, bekommen nichts mehr) | **1.483** |
| Lebende Leads ohne Antrag, die auf eine Fortsetzung warten | **2.700** |
| Kunden, die erst NACH der achten Mail kamen | **23** — die verliert man, wenn man bei sechs aufhört |
| Freie Termine, die ein Kunde je Tag sah | **27** (260 über zehn Tage) |
| Bezahlte Paketkunden ohne Bonitätsauskunft | **287** |
| Personen mit MEHREREN Auskunft-Bestellungen | **14** |

### 1. Die Lead-Strecke endet nicht mehr

**Vorher:** Sechs Mails an Tag 1, 2, 4, 7, 14, 21 — danach wurde der Lead als „tot" markiert. 1.483 Menschen standen an diesem Ende.

**Jetzt:** T+1, T+3, T+7, T+14, T+30, danach **einmal im Monat, ohne Ende**. Zwölf Inhalts-Varianten rotieren; wer in die zweite Runde kommt, bekommt sie in anderer Reihenfolge als sein Nachbar. Höchstens 200 Mails am Tag, damit kein Spamfilter das für einen Angriff hält.

**„Nie endend" heißt nicht „egal".** Sechs Gründe beenden die Strecke endgültig — Antrag gestellt, Kunde geworden, abgemeldet, Adresse existiert nicht, gelöscht, Testeintrag. Die Prüfung steht in **einer** Funktion, nicht in der Auswahl-Bedingung: Sonst prüft der Tageslauf sechs Dinge und der Handversand keines.

**Neu: die Abmeldung.** Sie stand vorher nirgends — eine Endlos-Strecke ohne Ausgang ist rechtlich heikel und praktisch respektlos. Jetzt trägt **jede** Mail den Link, ein Klick genügt, keine Rückfrage, kein Anmelden. Der Link enthält einen Zufallsschlüssel, keine Lead-Nummer: Sonst könnte man durch Hochzählen fremde Menschen abmelden.

**Die alte Strecke steht als Rückfall bereit.** Der Schalter `lead_strecke_ewig` in den Einstellungen legt um, ohne dass ein Entwickler nötig ist. Zwei Dinge mussten dafür still werden: die „tot"-Markierung (sie hätte genau die Leads getötet, für die die Strecke gebaut ist) und der alte Stapelversand (zwei Motoren an einer Liste = zwei Mails am selben Morgen).

### 2. Fünf Termine statt siebenundzwanzig

Siebenundzwanzig freie Zeiten sagen dem Kunden: hier ist nichts los. Fünf sagen: da ist Betrieb, nimm einen. **Dieselbe Verfügbarkeit, ein anderer Eindruck** — und der Eindruck entscheidet, ob er bucht.

Gezeigt werden **höchstens fünf je Tag, gleichmäßig über den Tag gestreut** (bei 27 freien Zeiten die Positionen 1, 7, 14, 20, 27 — erste, letzte und drei dazwischen). Nicht die ersten fünf: Die wären alle vor 10:30, und wer nachmittags Zeit hat, findet nichts.

**Die versteckten sind nicht buchbar.** Die Buchungsannahme rechnet mit derselben Funktion — sonst wäre die Knappheit eine Behauptung in der Oberfläche, und wer die Adresse errät, bucht daneben. Einstellbar über `slots_pro_tag` (1–12).

**Gemessen nachher:** 51 Zeiten über elf Tage statt 260 über zehn.

### 3. Die Bonitätsauskunft im richtigen Augenblick

287 bezahlte Kunden haben keine Auskunft. Der Markt ist da — er wird aber nicht durch Bedrängen erschlossen.

Die Karte steht jetzt auf **derselben** Bühne wie das Startgespräch, und zwar **nach** der Buchung: „Termin steht. Und solange du wartest, kannst du den Grundstein legen." Vorher stünde sie in Konkurrenz zum Pflichtschritt; auf einer zweiten Tafel wäre sie eine Nachforderung.

**Mit Kopierknöpfen für Verwendungszweck, IBAN, Empfänger und Betrag** — der Verwendungszweck zuerst, weil ohne ihn keine Zahlung zugeordnet werden kann. Wer eine IBAN abschreibt, vertippt sich; die Arbeit räumt danach das Haus von Hand auf. Wer die Auskunft schon hat, sieht kein Angebot: Ein Angebot für etwas, das man besitzt, sagt dem Kunden „die kennen mich nicht".

### 4. Abo-Klarheit als Pflichtschritt — und 15 € für das Gespräch

**Jeder Streitfall dieses Hauses beginnt mit demselben Satz: „Ich dachte, das war einmalig."** Deshalb hat das Startgespräch einen siebten Schritt, und zwar einen mit Notizpflicht: Der Mitarbeiter nennt Betrag und nächstes Abbuchungsdatum, erklärt den Kündigungsweg (formlos per E-Mail, zum Monatsende), trennt die 74 € ausdrücklich vom Abo — und hält fest, was der Kunde geantwortet hat. Ohne diese Notiz lässt sich das Gespräch nicht abschließen.

Er steht **vor** dem Abschluss. Danach wäre er ein Nachtrag: Wer nach „Ihr Konto ist freigeschaltet" noch über Zahlungspflichten spricht, klingt, als hätte er etwas zurückgehalten.

**Die Vergütung:** 15 € je erledigtes Startgespräch (einstellbar, 0 = keine). **Genau eine je Kunde** — auch wenn ein zweites Gespräch nötig war. Diese Grenze steht als eindeutiger Index in der Datenbank, nicht als Prüfung im Code: Zwei gleichzeitige Abschlüsse würden eine Prüfung beide passieren. Sie entsteht **nach** der Freischaltung und wirft nie: Erst gehört das Konto dem Kunden, dann entsteht das Geld.

### 5. Die Provisions-Wand stand schon — und sie greift

Der Auftrag lautete, sie zu bauen. **Sie war schon da**, seit dem Stichtag 15.07.2026, und die Zahlen zeigen, dass sie arbeitet: **106 Bestellungen** sind als Selbstzahler vermerkt (keine Provision), 135 als betreut (Provision), 52 laufen im Altmodell vor dem Stichtag, 10 wurden von der Verwaltung ausdrücklich entschieden. Jede Entscheidung trägt ihren Grund in `commission_basis_note`.

Statt eine zweite Fassung derselben Regel zu bauen, ist sie jetzt **geprüft**: Nach dem Stichtag existiert keine einzige Provision an einer Bestellung, die als Selbstzahler vermerkt ist.

**Zur Kenntnis, nicht zum Handeln:** Nach einem strengeren Maßstab (Kontakt genau dieses Agenten, an genau dieser Bestellung) hätten **220 der 370** Vertriebsprovisionen im Bestand keinen Anspruch — 1.874,30 €, davon 1.619,60 € schon ausgezahlt. Der Unterschied zu den 106 sind Altbestand vor dem Stichtag und Kontakte an Schwester-Bestellungen desselben Menschen. **Nichts davon wurde angetastet.** Rückwirkend zu stornieren ist eine Entscheidung des Betreibers, keine eines Wartungslaufs; die Liste liegt in `reports/mess-selbstzahler-provisionen.csv`.

### Geprüft

`scripts/pruef-kundenweg.ts` — **64 Prüfungen**, alle grün. Schreibende laufen in einer Transaktion, die zurückgerollt wird. `scripts/pruef-kundenweg-browser.ts` — **12 Prüfungen** am gerenderten Bild, mit Screenshots in `reports/kundenweg/`.

**Rot-Probe:** Drei Fehler absichtlich eingebaut (Verknappung aus, Kadenz endet wieder, Abo-Klarheit ohne Pflicht) → **zehn Prüfungen wurden rot**, an genau den richtigen Stellen.

Zwei eigene Fehler fielen dabei auf und sind behoben: Ein Teilindex mit einer Bedingung zu viel machte die Wand für die Vergütung unbenutzbar (PostgreSQL kann ihn dann nicht für `ON CONFLICT` verwenden — Fehler 42P10). Und eine Attrappe im Browsertest lieferte weniger als der Server, worauf auf der Seite „ein -minütiges Gespräch" stand: **Eine Attrappe, die weniger liefert als der Server, erzeugt Fehler, die es nicht gibt.**

**Wo zu finden:** `shared/fiaon-lead-strecke.ts` (Kadenz, zwölf Varianten) · `server/lib/fiaon-lead-strecke.ts` (Motor, Stopps) · `client/src/pages/abmelden.tsx` · `server/lib/fiaon-termine.ts` (`slotsVerknappen`) · `client/src/components/StartgespraechGate.tsx` (Bonitätskarte) · `shared/fiaon-onboarding-agenda.ts` (Abo-Klarheit) · `server/lib/fiaon-onboarding-verguetung.ts` · `db/migrations/056`, `057`.

## 17.08.2026 — Das Team-Bild gehört dem Team, der Weg zur Nachbuchung endet nicht mehr im Leeren

### Zuerst: 43 Testkonten neben 6 Menschen — meine Altlast

Der Betreiber öffnete seine Team-Zentrale und sah **11 Karten**. Sechs davon sind Menschen, fünf waren Prüfstands-Konten. **Gemessen: 49 Mitarbeiter-Konten insgesamt, 43 davon Testkonten.**

Die habe ich selbst angelegt: Jeder Browser-Prüfstand braucht eine Anmeldung, und er darf keine echte benutzen (Vorfall 06.08.2026). Sie waren stillgelegt und markiert — die Team-Ansichten haben nur nie danach gefragt. `ORDER BY … is_test_account` schob sie nach unten; **Sortieren ist keine Grenze.** Sie standen weiter da, und jede Zahl zählte sie mit.

Jetzt: Die Grenze steht in der WHERE-Bedingung (`echteMitarbeiterSql()`), nicht in der Oberfläche. Ein Filter „Testkonten 43" zeigt sie ausdrücklich — sie sind nicht verboten, nur nicht im Weg. Der Untertitel sagt: „6 Menschen im Team · 43 Testkonten ausgeblendet (2 davon noch aktiv)".

**Aufgeräumt:** 3 Prüfstands-Konten stillgelegt. Die zwei Konten des Betreibers („Justin Schwarzott", 6 echte Kunden und 6 Provisionen daran) wurden **geschont** — sie bleiben nutzbar und behalten ihre Last. Eine Entscheidung über echte Kunden gehört in die Team-Zentrale, nicht in einen Aufräum-Lauf.

**Die sechs echten, bestätigt:** Daniel Stripling (Vertriebsleitung) · Florentine Lombardi (Vertriebsleitung) · Nikita Boychenko (Vertrieb) · Lucas Böhnert (Vertrieb) · Diana Zeller (Forderungsmanagement) · Hans-Jürgen Gerhold (Forderungsmanagement). **Alle sechs Rollen stimmen exakt** mit der Vorgabe.

**Und die Regel steht jetzt in AGENTS.md**, damit es nicht wieder passiert: Jeder Lauf ruft am Ende `testkontoStilllegen(id)` — sie setzt stillgelegt **und** markiert. Drei Prüfstände hatten drei handgeschriebene Fassungen, und keine setzte die Marke.

### „Ich kann keine Provisionen mehr nachbuchen" — der Weg war kaputt, nicht die Funktion

Die Nachbuchung war **nicht weg**. Sie war unerreichbar, und zwar dreifach:

1. `/admin/nachbuchung` leitet seit dem 10.08. um auf `/admin/team?tab=nachbuchung` — **diesen Reiter gab es nicht.** Die Zentrale kennt acht Reiter, „nachbuchung" war keiner. Ein unbekannter Wert fällt auf „menschen" zurück: Der Betreiber landete auf der Mitarbeiterliste, ohne jeden Hinweis.
2. `/admin/funktionen` verlinkte auf `/admin/nachbuchung` — also im Kreis. Dazu drei weitere Stellen (Kundenakte, Startseite, Auszahlungen).
3. Der Knopf saß **vier Ebenen tief**: Zentrale → Karte klicken → Reiter „Provisionen" → nach unten scrollen.

Am 10.08. wurde die Altseite abgerissen, **nachdem** die Funktion umgezogen war — die Reihenfolge war richtig. Nur der Weg blieb kaputt, und ein Prüfstand, der „die alte Seite existiert nicht mehr" prüft, wird davon grün. **Das ist die Lehre: Eine Prüfung auf das Fehlen einer Seite ersetzt keine Prüfung auf die Erreichbarkeit der Funktion.**

Jetzt gibt es den Reiter **„Provisionen nachbuchen"** mit allen Fällen an einem Ort: 21 offene, 2 eindeutig buchbar, 19 mit unklarem Betrag, Provisionssumme. Einzeln oder gesammelt. Die eindeutigen stehen **oben** — im ersten Entwurf standen die 19 unklaren zuerst, und der Betreiber hätte neunzehn gesperrte Knöpfe gesehen.

**Fehlende Funktion nachgebaut:** Von den fünfzehn Funktionen der Vollständigkeitsliste fehlte genau eine — **„Kunden umhängen"**. Es gab `POST /admin/team/reassign`, aber die Route fasst nur die **Bestellung** an. Die Arbeitslisten filtern auf die **Person**. Ein Umhängen darüber hätte die Karten nicht bewegt: Der scheidende Mitarbeiter hätte sie weiter in seiner Liste gehabt, der neue nicht. Der neue Weg nimmt beide mit, in einer Transaktion, mit Vorschau und Pflicht-Grund.

*(Nebenbefund vom Prüfstand: Auf `fiaon_persons` liegt ein Trigger `fiaon_person_owner_propagate`, der Bestellungen automatisch nachzieht. Die richtige Richtung war also längst gebaut — nur die falsche stand offen.)*

### Die 68 verbrauchten Termin-Erinnerungen

**Gemessen: 91 Termine mit gesetzter Erinnerungs-Marke, nur 56 mit erfolgreichem Versand. 35 Erinnerungen verbraucht, ohne dass der Kunde etwas bekam** — 33 wegen fehlendem Versandkanal, 2 ohne E-Mail-Adresse.

Von 63 vergangenen erinnerten Terminen wurden **54 zu No-Shows: 86 %.** Wie viele davon erschienen wären, wenn die Erinnerung angekommen wäre, weiß niemand — und genau das ist der Punkt.

**Zur Ursache, ehrlich:** Der Lauf prüft `MAKE_WEBHOOK_URL` am Anfang und steigt ohne Kanal aus. Trotzdem stehen 33 Protokollzeilen mit genau diesem Grund im Log. Welcher Prozess das war, lässt sich nachträglich **nicht beweisen** — lokal ist die Variable nicht gesetzt und die Bremse aus, in Produktion soll sie gesetzt sein. Deshalb habe ich nicht die Ursache geraten, sondern beides abgestellt:

- **Eine Kanalprüfung vor jedem Versandlauf.** Ohne Kanal steht einmal am Tag „übersprungen (kein Kanal)" im Zustellprotokoll — vorher verhinderte die Prüfung den Lauf **still**, und der Betreiber sah nirgends, dass eine Automatik seit Tagen nicht arbeitet.
- **Die Marke wird bei Fehlschlag zurückgenommen** — aber nur für Termine in der Zukunft. Eine Erinnerung an ein Gespräch von vorgestern ist peinlich.

**Nachgeholt:** 5 Erinnerungen neu eingeplant (Zählprobe 5 von 5). Für die 30 vergangenen wurde **nichts** nachgesendet.

**Und die Bremse selbst:** Von sieben zeitgesteuerten Läufen gingen **zwei ganz an ihr vorbei** — `fiaon-leads.ts` mit Lead-Nachfassmails und Lead-Verteilung. Auf einem Entwicklungsrechner wären sie losgelaufen; genau der Vorfall vom 08.08.2026, wegen dem `CRONS_AN` existiert. Dass es nie passiert ist, lag an einer Sendezeit-Prüfung — das ist Glück, keine Absicherung. Zwei weitere Läufe prüften selbst, drei nahmen die Registratur: **vier Fassungen derselben Regel.** Jetzt gehen alle durch `tageslauf`, und der Abo-Motor behält seinen lokalen Testschalter (`auchWenn`).

### Badge-Wahrheit: drei Zahlen für dieselbe Sache

| Marke | vorher | Zielseite | jetzt |
|---|---|---|---|
| Notizen & Aufgaben | **0** | 8 offene | 8 |
| Zustellung | **0** (nur heute) | 70 (14 Tage) | 70 |
| Provision nachbuchen | **14** | 21 Fälle | 21 |
| Zahlungen | 237 | 237 | 237 ✓ |
| Auszahlungen | 0 | 0 | 0 ✓ |

Die Aufgaben-Marke stand auf 0, während acht Aufgaben warteten: Sie zählte nur „heute + überfällig". **Eine Marke, die schweigt, wenn es Arbeit gibt, ist schlimmer als eine, die zu viel zeigt.**

Bei der Nachbuchung gab es **drei** Zahlen: 14 (Menü-Marke), 160 (mein erster Entwurf) und 21 (`backfillCandidates()` — die Funktion, die der Betreiber sieht). Jede war eine eigene, nachgebaute Abfrage. Jetzt ruft die Marke **die Funktion der Zielseite**, statt deren Bedingungen nachzubauen: Beim Nachbauen vergisst man einen Filter, und niemand merkt es.

Im alten Kommentar stand, eine permanent hohe Marke werde ignoriert. Das stimmt — aber die Antwort darauf ist nicht, sie kleiner zu rechnen. Wenn 70 Mails in zwei Wochen scheitern, ist nicht die Marke zu hoch, sondern die Zahl.

### Mehrfachauswahl beim Wegräumen (aus 13B nachgeholt)

**Gemessen: 406 Personen mit 1.083 offenen Buchungen**, ein Fall mit **18**. Einzeln wegräumen heißt 18 Bestätigungsdialoge für einen Kunden — und wer das dreimal macht, klickt beim vierten Mal blind durch.

Jetzt: Häkchen an den unbezahlten Buchungen, **ein** Dialog mit Zahl und Summe. Der Reihe nach, **nicht parallel**: Die Wand „das ist die letzte Buchung" rechnet mit dem Stand nach den vorherigen — parallel gerechnet würden alle gleichzeitig prüfen, alle durchkommen, und der Kunde stünde ohne jede Bestellung da. Teilerfolge werden **benannt**: „7 weggeräumt, 2 blieben stehen, weil …".

### Die vier „Zuordnung prüfen"-Anrufe sind jetzt findbar

Sie standen als Marke im Feld `transkript_grund` — der Betreiber hätte in der Datenbank suchen müssen. **Eine Marke, die niemand findet, ist keine Marke.** Sie stehen jetzt in der Team-Zentrale unter „Aktivität", mit Nummer, Zeit, Grund, Aufnahme-Hinweis und Weg zur Akte.

### Was NICHT nötig war

**Die Rechnungs-PDFs der 166 preiskorrigierten Bestellungen müssen nicht neu erzeugt werden.** Geprüft: Es gibt **keine** Tabelle `fiaon_rechnungen` und keine gespeicherten PDFs — nur `invoice_number` und `invoice_date` an der Bestellung. Die Rechnung entsteht bei **jedem Abruf** frisch aus den aktuellen Daten. Die korrigierten Preise stehen also automatisch in jeder Rechnung, die ab jetzt abgerufen wird. Ein Neu-Erzeugungslauf hätte nichts geändert.

### Zwei Fehler, die ich selbst gemacht und der Screenshot gefunden hat

- **Die Team-Zentrale war leer.** Ich habe `sqlPool.unsafe(...)` in eine Abfrage gesetzt, die **selbst** über `sqlPool.unsafe(...)` läuft — dort wird `${…}` als Text eingesetzt, und im SQL landete „[object Object]". Die Route antwortete mit 500, keine einzige Mitarbeiterkarte war da. **Genau dieser Fehler steht zwanzig Zeilen weiter oben in derselben Datei beschrieben.** Typcheck und esbuild waren grün — es ist weder ein Typ- noch ein Syntaxfehler.
- **Backticks in SQL-Kommentaren, dreimal an einem Tag.** `-- „`spalte`"` beendet das umgebende Template-Literal. AGENTS.md ist jetzt um diesen Fall geschärft.

### Wo zu finden

- **Testkonten-Grenze:** `server/lib/fiaon-mitarbeiter-sicht.ts` · **Aufräumen:** `npx tsx scripts/testkonten-aufraeumen.ts`
- **Nachbuch-Tafel:** `client/src/components/admin/NachbuchenTafel.tsx` → `/admin/team?tab=nachbuchung`
- **Kanalprüfung:** `server/lib/fiaon-versandkanal.ts` · **Registratur:** `server/lib/fiaon-crons.ts`
- **Marken:** `server/lib/fiaon-marken.ts` (eine Zählung, eine Quelle)
- **Nachholen:** `npx tsx scripts/termin-erinnerung-nachholen.ts` (Vorschau ohne `--schreiben`)
- **Messung:** `npx tsx scripts/mess-betrieb.ts` (nur lesend, CSVs in `reports/`)
- **Prüfstände:** `pruef-betrieb.ts` (123) · `pruef-betrieb-browser.ts` (33, Screenshots)

## 16.08.2026 — Die Onboarding-Pflicht, das Gesprächs-Cockpit, und sieben Arbeitsfluss-Fixes

### Die Regel, die jetzt im Code steht

*„Antrag → Zahlung gebucht → Kunde bekommt Zugang → PFLICHT-Termin mit dem Onboarding-Team → erst nach ERLEDIGTEM Startgespräch wird der Account voll freigeschaltet."*

Ein Konto hat ab jetzt zwei Stufen nach der Zahlung. Sie unterscheiden sich nicht darin, **ob** der Kunde hereinkommt, sondern **was** er drinnen sieht:

| Stufe | Was er sieht |
|---|---|
| `wartet_auf_onboarding` | Startgespräch buchen · seine Rechnungen und Zahlungsdaten · Stand seiner Unterlagen · Bonitätsauskunft samt Zahlweg. Fahrplan und Inhalte warten mit ihm — hinter einer **Sperrkarte, die den Grund nennt**, nicht hinter einer 404. |
| `voll_aktiv` | Alles. |

Freigeschaltet wird **auf genau einem Weg**: Das Onboarding-Team schließt das Startgespräch ab. Dazu ein ausdrücklicher Admin-Übergang mit Grund, protokolliert. Ein dritter Weg würde die Pflicht zu einer Bitte machen — und dann hätte niemand je ein Startgespräch geführt.

Die Stufe liegt in einer **eigenen** Spalte, nicht in `account_status`. Dort steht die harte Zugangssperre, und an rund zwanzig Stellen wird auf `'active'` geprüft. Wer die Onboarding-Stufe dort hineinschreibt, sperrt bei der nächsten dieser Abfragen einen zahlenden Kunden aus, der nur sein Gespräch noch vor sich hat.

### Die Entscheidung zum Bestand — mit ihrer Zahl

**Gemessen: 349 bezahlte Paketkunden, davon null mit einem Startgespräch.** Es gab in der ganzen Datenbank keinen einzigen Termin der Quelle `onboarding_call`.

Eine harte Pflicht für alle hätte am Tag des Deploys **349 zahlende Menschen** vor eine verschlossene Tür gestellt — mit der Aufforderung zu einem Gespräch, für das es noch kein Team-Verfahren gab. Deshalb:

- **Neu aktivierte Kunden:** Pflicht. Kein „Später" — buchen oder ausloggen. Die Wand steht im **Server** (HTTP 403), nicht in der Oberfläche.
- **Bestand:** kein Aussperren. Dauerhafter Banner („Dein Startgespräch steht noch aus") und Einladung. Der Zugang bleibt.
- Der Betreiber kann die Härte pro Fall über die Akte setzen (`onboarding_pflicht`).

**Veto möglich.** Wer es anders will, sagt es — die Umstellung ist eine Spalte.

### Das Onboarding-Cockpit

`/agent/startgespraeche` → Termin öffnen → **„Gespräch führen"**. Eine Gesprächsbühne auf `FiaonEbene`-Niveau, alles darin und nichts daneben:

- **Kopf:** Kunde, Paket, Zahlungsstand, mitlaufende Uhr (überzogen = andere Farbe), Anrufen-Knopf über das **bestehende** Softphone mit Kundenkontext, Gesprächsblatt.
- **Geführte Agenda,** sechs abhakbare Schritte mit je zwei bis drei Stichpunkten zum Vorlesen: Begrüßung & Erwartung · Plattform-Tour · Fahrplan · Unterlagen · Bonitätsauskunft (74 €, Zahlweg) · nächste Schritte. Fortschrittsbalken, Notizfeld je Schritt.
- **Abschluss:** ein Knopf — „Gespräch abschließen & freischalten". Er setzt den Termin erledigt, das Konto auf `voll_aktiv`, schreibt die gesammelten Notizen als **ein** Protokoll in die Akte und zählt Dauer und Quote. „Kunde nicht erschienen" bleibt daneben.
- **Kennzahlen-Kopf:** heute geplant · heute erledigt · nicht erschienen · Ø Dauer · freigeschaltet (7 Tage) · Erledigungsquote.

Die Agenda-Texte stehen im Repo (`shared/fiaon-onboarding-agenda.ts`), nicht im Kopf des Mitarbeiters: Ein Startgespräch, das jeder anders führt, ist sechsmal ein anderes Produkt.

**Worthygiene, geprüft statt geschult.** Die 74 € sind eine **Auskunft** — kein Rat, keine Beratung. Eine Verbotsliste („beraten", „Empfehlung", „garantiert", „Score verbessern") läuft im Prüfstand über jeden Schritttext. Eine Regel, die nur in einer Schulung steht, gilt bis zur ersten Vertretung.

### Sieben Fixes aus dem Teamfeedback — jeder zuerst gemessen

**1. Der Termin-Haken traf den FALSCHEN Menschen.** Gemeldet war „kundengebuchte Termine lassen sich nicht abhaken". Gemessen ist es schlimmer: Der Kalender mischt zwei Tabellen in eine Liste — eigene Rückrufe (`fiaon_contact_log`) und Kundentermine (`fiaon_termine`) —, und beide zählen ihre Kennungen ab 1 hoch. Der Haken rief blind den Weg für Verlaufseinträge.

**101 Termine tragen eine Kennung, die auch ein Verlaufseintrag trägt. Bei 33 davon gehört dieser Verlaufseintrag einem ANDEREN Menschen.** Ein Klick hätte den Rückruf eines fremden Kunden als erledigt abgestempelt. Eingetreten ist das noch nicht (0 von 71 erledigten Rückrufen betroffen) — der Weg stand aber jederzeit offen. Der Serverkommentar sagte übrigens schon „der Client unterscheidet über `quelle`"; der Client tat es nur nicht.

Dazu zwei kleinere Gründe: `agent_id = ich` schloss jeden aus, der den Kunden heute betreut, ohne den Termin zu besitzen; und das Abhaken verlangte `status = 'gebucht'`, während die Liste auch `'verpasst'` zeigte — **54 Termine** ließen sich ansehen, aber nie abschließen und tauchten nach jedem Neuladen wieder auf.

**2. Absagen verschwanden lautlos.** Gemessen: **10 abgesagte Termine, keine einzige Absage jemandem gemeldet.** Der Termin war im selben Augenblick aus jeder Ansicht weg (der Kalender filterte auf „gebucht") — der Zuständige saß zur vereinbarten Zeit da. Jetzt: Mail an den Zuständigen bei **Buchung und Absage** (direkt über Brevo im FIAON-Rahmen: Kunde, Datum, Uhrzeit, Quelle, Akten-Link), Verlaufseintrag, und der Termin bleibt **sieben Tage** im Kalender stehen — „Abgesagt am 16.08., 14:22 Uhr durch den Kunden".

**3. Telefon-Ergebnis wirkte nicht auf die Liste.** Vermutet war, das Panel rufe den gemeinsamen Weg nicht auf. Es ruft ihn auf — aber der Listenweg tut **fünf** Dinge und das Panel eines. `ergebnisAnwenden` schreibt bewusst keinen Verlaufseintrag; den schrieben die Listenrouten selbst.

**Gemessen: 554 von 842 Anrufen mit festgehaltenem Ergebnis haben keinen Verlaufseintrag beim Kunden.** Der Agent hat dokumentiert, die Akte weiß nichts davon. Am teuersten sind die Rückrufe: ohne Verlaufseintrag mit Zeitpunkt erscheint ein vereinbarter Rückruf **nie** im Kalender und nie in der Erinnerungsleiste — er ist verloren. Ebenso ging „Falsche Nummer" aus dem Panel **13-mal** ohne die Nummern-Korrektur-Mail raus, die der Listenweg verschickt.

Es gibt jetzt **eine** Kette (`ergebnisNachbereiten`): Verlauf, Zustand, Nummern-Mail, Übergabe, Nachschub. Panel und Liste rufen dieselbe.

**4. „Erreicht — Sonstiges" ohne Notiz.** Im Panel gab es überhaupt kein Notizfeld — **siebenmal** gedrückt, und in der Akte stand „Sonstiges". Jetzt Pflichtfeld (min. 10 Zeichen, „Was wurde besprochen oder vereinbart?"), serverseitig erzwungen; bei allen anderen Ergebnissen ein freiwilliges Feld. Die Notiz landet im Verlauf **und** am Anruf neben der Aufnahme.

**5. Nummern-Korrektur ohne Ende.** Gemessen: **224 verschickte Anfragen, 185 ohne Antwort, 120 davon länger als sieben Tage** — und alle 185 standen weiter **jeden Tag** in der Arbeitsliste. Bei einem Kunden, dessen Nummer nicht stimmt, kann niemand etwas tun. Eine Karte, bei der man nichts tun kann, ist keine Aufgabe, sondern ein Übungsstück im Überblättern — und wer das gelernt hat, überblättert auch die zwei, bei denen es brennt.

Jetzt: Wartezustand „Wartet auf Kunde (Nummer)", raus aus der Tagesliste, Wiedervorlage +7 Tage, sichtbar unter dem neuen Filter **„Wartend (Kunde)"**. Die Karte kommt von selbst zurück, sobald der Kunde die Nummer einträgt **oder** einen Termin bucht. Die Mail trägt jetzt zusätzlich den Termin-Link.

**6. Rückrufe ohne Frist — das Loch, durch das Kunden fielen.** Ein Kunde rief an, es wurde „notiert", niemand meldete sich. Gemessen: **23 offene Rückruf-Termine, 19 überfällig, 18 länger als 24 Stunden** — ohne Eskalation, ohne dass es irgendwo auffiel. Eingehende Support-Mails wurden gespeichert und **keinem** zugeteilt.

Jetzt bekommt jeder Rückruf-Wunsch **24 Stunden Frist und einen Menschen** (Betreuer, sonst Vertriebsleitung) plus eine dringende Aufgabe. Reißt die Frist: Karte für den Betreiber **und** Mail an die Leitung. Erledigen geht **nur mit Ergebnis-Notiz** — ein Rückruf, der ohne Ergebnis abgehakt wird, ist genau der Ausgangsfehler.

**7. Ein Prüfstands-Fund, der vier Nachweise gekostet hat.** Beim Bauen fiel auf: An vier Stellen im Bestand steht `INSERT INTO fiaon_contact_log (person_id, …)` — **die Spalte gab es nicht**, und ein `.catch(() => {})` schluckte den Fehler. Gemessen sind deshalb **nie entstanden**:

- 0 × „Als bezahlt gebucht von … Beleg: …" (Buchung durch die Vertriebsleitung)
- 0 × „Stammdaten der Person aktualisiert" (Änderungsnachweis)
- 0 × „Aufnahme von Anruf … angehört." — **ein Datenschutz-Zugriffsnachweis**

Die beiden letzten sind Nachweise. Wer eine Anrufaufnahme anhört, sollte eine Spur hinterlassen; das war die Absicht und hat nie funktioniert. Behoben an der Ursache (Migration 055 ergänzt die Spalte und füllt sie rückwärts, wo der Bezug eindeutig ist), nicht an vier Symptomen — zwei der vier Stellen haben gar keine Bestellung, an der der Vermerk hängen könnte.

### Ein Fund, den nur die Nachtstunde sichtbar macht

Beim Abschlusslauf um 00:20 Berliner Zeit fiel der Abo-Prüfstand um: „keine Zuteilung erfolgt". Ursache: Das Forderungsmanagement rechnete mit `CURRENT_DATE` — dem Datum der **Datenbank**, und die läuft in UTC. Zwischen 00:00 und 02:00 Berliner Sommerzeit zeigt das auf den **Vortag**.

Folgen: Eine Rate, die heute überfällig wird, galt in diesem Fenster als „heute fällig" und wurde **nicht zugeteilt**. Und die Zahlen im Kopf der Liste waren nachts andere als morgens — gemessen **113 gegen 97 überfällig, 12 gegen 0 heute fällig**. Wer um 00:30 arbeitete, sah eine andere Wahrheit als sein Kollege um 03:00.

Der Tageslauf läuft stündlich, der Fehler heilte sich also um 02:00 von selbst. Bemerkt hätte ihn deshalb nie jemand. Alle Fälligkeitsvergleiche rechnen jetzt über einen Ausdruck an **einer** Stelle (`HEUTE_BERLIN` in `server/lib/fiaon-inkasso.ts`).

**Dazu vier Prüfungen berichtigt, die einen Wortlaut statt einer Absicht suchten** — etwa `/r\.faellig_am <= CURRENT_DATE \+ 7/`. Sie wurden rot, weil die Sache **besser** wurde. Eine Prüfung, die an einer Formulierung hängt, erzieht dazu, sie abzuschalten.

### Der Knopf-Durchgang — die systematische Antwort auf „Buttons gehen nicht"

„Buttons gehen nicht" ist keine Fehlermeldung, sondern eine Stimmung. Wer ihr einzeln nachjagt, findet drei Knöpfe und übersieht dreißig.

`scripts/pruef-knopf-durchgang.ts` geht je Rolle (Verwaltung, agent, vertriebsleiter, onboarding, inkasso) über die Kernseiten und **drückt jeden sichtbaren Aktionsknopf** — alles Schreibende in Attrappen, keine echten Vorgänge, Zustimmungsstrecken werden nie durchlaufen. Erfasst werden Handler-Fehler, 403/404/500 und Knöpfe ohne jede Wirkung.

**Ergebnis: 177 Knöpfe gedrückt, ein echter Fehler.** `/agent/start` wurde **weiß**, wenn man „Gelesen" drückte: „Cannot read properties of undefined (reading 'guthabenCents')". Unten stand neunmal `v!.guthabenCents` — das Ausrufezeichen **behauptet**, der Wert sei da, geprüft wurde nur `laedt`. Antwortet der Server mit einem Objekt ohne `verdienst`, ist `laedt` false und `v` undefined; React reißt den Baum ab, und der Mensch sieht nichts. Kein Fehlertext, keine Meldung — eine weiße Seite. Gefunden hat das kein Typcheck (das `!` schaltet ihn ab) und kein Test, sondern das Drücken.

Der erste Lauf meldete außerdem **sieben Fehler, die keine waren**: Zugangswände, die bei einem frischen Testkonto korrekt greifen. Sie werden jetzt als solche erkannt und getrennt gezählt — eine Bremse, die falsch auslöst, ist gefährlicher als keine.

### Was NICHT geliefert ist

**Die Mehrfachauswahl beim Wegräumen doppelter Buchungen (Teil 3f) fehlt.** Das Wegräumen aktualisiert schon heute nur die Karte und nicht die Seite, mehrere nacheinander gehen also ohne Neuladen. Checkboxen mit „Auswahl wegräumen" und einem Sammeldialog sind **nicht** gebaut. Gemessen wären sie es wert: **406 Personen mit mehreren offenen Buchungen, 1.083 betroffene Buchungen** (ein Fall mit 18).

### Betreiber-TODOs

- **Make-Zweig `account_activated`** prüfen. Der Ereignistyp existiert; ob der Zweig bei Make angelegt ist, sieht man ab jetzt im Zustellprotokoll (`/admin/events`). Variablen: `email`, `vorname`, `portal_url`, `freigeschaltet_am_text`, `pack_name`, `ref`.
- **Brevo-Vorlage T23** (Nummern-Korrektur) um `{{params.termin_link}}` ergänzen — die Variable fährt jetzt mit, wird aber ohne Einbau nicht angezeigt.
- **`CRONS_AN` und der Terminlauf:** Im Zustellprotokoll stehen 68 gescheiterte `termin_erinnerung` — ein Prozess ohne Make-Zugangsdaten hat sie abgearbeitet und als erledigt verbraucht. Das gehört geprüft (siehe Eintrag oben).

### Wo zu finden

- **Konto-Stufen:** `server/lib/fiaon-kontostufe.ts` · **Agenda:** `shared/fiaon-onboarding-agenda.ts`
- **Cockpit:** `client/src/components/agent/OnboardingCockpit.tsx` · **Sperrkarte:** `client/src/components/PortalSperre.tsx`
- **Eine Ergebnis-Kette:** `ergebnisNachbereiten` in `server/lib/fiaon-kontakt-ergebnis.ts`
- **Termin-Meldungen:** `server/lib/fiaon-termin-meldung.ts` · **Wartezustand:** `server/lib/fiaon-warten.ts`
- **Rückrufe:** `server/lib/fiaon-rueckruf.ts`, `server/routes/fiaon-rueckrufe.ts`
- **Migrationen:** `054_onboarding_pflicht.sql`, `055_contact_log_person.sql`
- **Messung:** `npx tsx scripts/mess-arbeitsfluss.ts` (nur lesend, CSVs in `reports/`)
- **Prüfstände:** `pruef-onboarding-pflicht.ts` (146) · `pruef-onboarding-browser.ts` (39, Bilder) · `pruef-knopf-durchgang.ts` (177 Knöpfe)

## 16.08.2026 — Der Abo-Motor nach der Geschäftsregel, und vier Befunde aus dem Teamfeedback

### Die Regel, die jetzt im Code steht

*„Jeder Kunde mit einem Paket hat ein Abo. Anker ist der Tag der bankbestätigten Buchung. Zahlung gebucht am 05.07. → am 05.08. bekommt er automatisch seine Monatsrechnung. Ist die Rate am 06.08. nicht gebucht, steht er im Forderungsmanagement. Die 74-€-Auskunft ist kein Abo."*

**Vorher rechnete das System mit „alle 30 Tage".** Zwölf Monate zu 30 Tagen sind 360 — der Termin wandert jedes Jahr fünf Tage nach vorn. **Gemessen: 266 von 289 offenen Raten lagen NICHT auf dem Jahrestag ihrer Buchung.** Ein Kunde, der am 5. bezahlt hat, bekam seine Rechnung am 4., dann am 2., dann am 31. des Vormonats. Wer das auf dem Kontoauszug wiederfinden soll, findet es nicht.

Jetzt gilt der **monatliche Jahrestag**, gerechnet an einer Stelle: `server/lib/fiaon-abo-zyklus.ts`. Motor, Kundenakte, Inkasso-Karte und Prüfstand rufen dieselben Funktionen. Der 31. wird nur für den jeweiligen Monat gekappt (Februar → 28./29.) und ist im März **wieder der 31.** — wer von Fälligkeit zu Fälligkeit weiterrechnet, verliert ihn nach dem ersten Februar für immer.

**Der Tageslauf** (`aboTageslauf`, stündlich, idempotent) macht drei Dinge: Am Fälligkeitstag legt er die Rate an und verschickt die Monatsrechnung über den **bestehenden** Make-Zweig `abo_payment_reminder`. X Tage vorher (Vorgabe 3, in den Einstellungen über `abo_vorab_tage` abschaltbar) geht eine freundliche Vorabinfo raus, die die Mahnstufe **nicht** anfasst. Am Tag danach wird die unbezahlte Rate überfällig und dem Inkasso-Menschen mit der kleinsten Last zugeteilt.

**Die Wand gegen Doppelrechnungen steht in der Datenbank**, nicht in einem `if`: ein eindeutiger Index auf `(ref, faellig_am)` für alles, was nicht storniert ist. Ein zweiter Lauf — auch gleichzeitig in einem anderen Prozess — prallt dort ab. Der Prüfstand weist es nach.

### Was das Team gemeldet hat, und was wirklich war

Vier Meldungen, alle zuerst **gemessen**. Zwei davon waren anders als beschrieben.

**„3. Mahnung, ohne je eine Rate gezahlt zu haben."** Gemessen: **0 Fälle** auf Mahnstufe 3. Aber die Ursache war echt: Ein Bestandsnachtrag hatte für Monate, in denen nie eine Rechnung rausging, offene Raten mit Mahnstufe 1 angelegt. Der Spitzenfall heißt **Peter Zußner** — zwei bezahlte Pro-Bestellungen, je drei offene Raten, alle Stufe 1, keine davon je in Rechnung gestellt. Das war keine Zahlungsverweigerung, das war unsere Buchhaltung. Rückwirkende Raten entstehen jetzt nur noch auf ausdrückliche Anweisung, und eine Mahnstufe steigt nur, wenn eine vorherige Mahnung **wirklich versandt** wurde.

**„Zusner dreimal, Namen wiederholen sich beim Scrollen."** Gemessen: **213 Zeilen für 180 Menschen**, 21 Namen mehrfach. Keine Personen-Dublette — jede Rate war eine eigene Zeile. Die Liste zeigt jetzt **eine Karte je Mensch** mit aufklappbaren Raten; die Arbeit (Zusage, Wiedervorlage, Prämie) hängt weiter an der einzelnen Rate. Nebenbefund: Zußner hat **zwei parallele Abos** und wird doppelt abgerechnet — solche Fälle tragen jetzt die Warnung „Zweites Abo — vor dem Mahnen klären".

**„Diana — Mailbox gesprochen, aber die Aufnahme gehört zu einer anderen Person."** Ursache gefunden: `POST /telefon/ausweis` nahm die Person aus dem **Request-Body** — also aus der offenen Kundenkarte. Wer eine Karte offen hatte und eine fremde Nummer eintippte, hängte Aufnahme, Transkript und KI-Notiz an die falsche Akte. Im Bestand war der Schaden klein (**5 von 1.002** Anrufen, davon 1 mit Aufnahme) — der Weg dorthin stand aber jederzeit offen, und es geht um Gesprächsaufzeichnungen. Jetzt entscheidet die **gewählte Nummer** (samt Aliasnummern), das Panel sagt **vor** dem Wählen „Du rufst [Name] an", und eine unbekannte Nummer hängt an niemandem.

**„Make-Routen gehen bei Tests alle — aber viele bekommen keine E-Mail."** Die Lücke lag **vor** Make: Die Adresse kam aus der Bestellzeile. Stand dort nichts, ging `email: ""` an Make, Make antwortete 200, und die Mail verschwand lautlos. Gemessen: 3 Bestellungen mit offener Rate ohne Adresse an der Zeile — **alle drei über die Person auflösbar** — und **99 Bestellzeilen, deren Adresse von der der Person abweicht**. Jeder Versand geht jetzt durch **eine** Auflösung (`server/lib/fiaon-empfaenger.ts`): aktuelle Adresse der Person, dann Aliase, dann Bestellzeile. Findet sich nichts, geht **nichts** raus, und der Grund steht im Protokoll.

### Die alte Nummer, die der Kollege sah

Stammdaten wurden nur an der **Bestellzeile** gespeichert. Die Person behielt ihren alten Wert — und jede Liste, jede Suche und jeder Mailversand, die über die Person gehen, zeigten weiter das Alte. **Gemessen: 89 Bestellungen mit einer anderen Nummer als ihre Person, 99 mit einer anderen E-Mail.** Die Korrektur schreibt jetzt auf die Person durch, setzt `phone_key9` mit (sonst wird der Rückruf nicht erkannt) und sichert den bisherigen Wert als **Alias** — er geht nicht verloren, der Kunde wird unter beiden Nummern erkannt.

**Und: Bearbeiten war für die halbe Firma gesperrt.** Der Torwächter `requireEigenerKunde` kannte nur die Regel für die Rolle `agent` und wandte sie auf alle an. Vertriebsleitung, Forderungsmanagement und Onboarding bekamen **404** bei Kunden, die sie laut Berechtigung sehen dürfen — das Forderungsmanagement durfte anrufen, aber eine falsche Telefonnummer nicht korrigieren. Es gab die richtige Antwort längst: `darfAnKunde` kennt alle fünf Rollen. Die zweite Definition ist weg.

### Ultra und High End waren vertauscht

Es gab **zwei** Preislisten. Die eine bestimmte den Kaufpreis (Ultra 79,99), die andere den Ratenbetrag (Ultra 99,99). Ein Ultra-Kunde kaufte für 79,99 € und bekam Rechnungen über 99,99 €.

Die Begründung der zweiten Liste war eine Häufigkeitsauszählung des Kontoauszugs: 99,99 € kam 75-mal vor, also sei das Ultra. Das ist der Fehler — eine Häufigkeit sagt, welche **Beträge** vorkommen, nicht, zu welchem **Paket** sie gehören.

**Entscheidung des Betreibers: Ultra 79,99 €, High End 99,99 €.** Eine Quelle: `shared/fiaon-pakete.ts`.

### Was am Bestand geändert wurde (jeweils Vorschau, dann geschrieben, dann gezählt)

| Lauf | Ergebnis | Zählprobe |
|---|---|---|
| Raten ohne bezahltes Paket storniert | **4** (kein Hard-Delete, Mahnstufe neutralisiert) | 0 offene Raten ohne bezahltes Paket |
| Fälligkeiten auf den Jahrestag gezogen | **266** (meist ±1 Tag, nie ein Monatssprung) | 0 Doppelrechnungen |
| Preise korrigiert | **166** offene Bestellungen, **51** offene Raten | 0 offene Raten mit falschem Betrag |
| Anrufe umgehängt | **2** eindeutig, **4** als „Zuordnung prüfen" markiert | — |

**Bezahltes wurde nicht angefasst.** 8 bereits bezahlte oder angekündigte Bestellungen mit abweichendem Betrag stehen nur im Report: Ein bezahlter Betrag ist eine Tatsache, wer ihn nachträglich ändert, fälscht die Buchhaltung. Die Rechnungs-PDFs der 166 korrigierten Bestellungen müssen neu erzeugt werden (`reports/bestand-preise.csv` enthält die Referenzen).

**Nicht angefasst — und das ist eine Entscheidung:** 192 Raten über 12.916 € hängen an Bestellungen, die als bezahlt gebucht sind, aber **keine Bankzeile** haben. Der Bank-Import deckt nur den 03.07. bis 03.08. ab; von 130 im August verbuchten Bestellungen haben nur 24 eine Bankzeile. Diese Raten zu entwerten hieße, echte Forderungen zu vernichten, weil eine CSV fehlt.

### Was die neue Karte am ersten Tag zeigte

Es gab **keine Anzeige** für das Zustellprotokoll. `mail-zentrale.tsx` verlinkte auf `/admin/mail-protokoll` — eine Seite, die nie existiert hat. Ein Link ins Leere sieht wie eine Möglichkeit aus. Also gebaut: `/admin/events` zeigt jetzt „Zustellprotokoll — letzte 14 Tage", vorgefiltert auf das, weswegen man kommt.

**Und sofort sichtbar geworden — 70 fehlgeschlagene Mails in 14 Tagen:**

- **68 × „MAKE_WEBHOOK_URL ist nicht gesetzt — es kann keine Mail rausgehen."** Fast alle sind `termin_erinnerung`. Ein Prozess **ohne** Make-Zugangsdaten hat Termin-Erinnerungen abgearbeitet und dabei jede als „erledigt" verbraucht. Die Kunden haben **keine Erinnerung bekommen**, und niemand hat es gemerkt — es gab keine Anzeige dafür. (Dieselbe Ursache wie der Vorfall vom 08.08.2026, weshalb `CRONS_AN` existiert; der Terminlauf hängt offenbar nicht an dieser Bremse. **Das gehört als Nächstes geprüft.**)
- **2 × „Brevo-Sicherheit blockiert diesen Server — die Adresse 74.220.50.221 steht nicht auf der Freigabeliste."** Betreiber-Aufgabe: die Adresse in Brevo freigeben.

Das ist der eigentliche Wert der Karte: Sie hat am ersten Tag ein Problem gezeigt, das seit zwei Wochen lief.

### Zwei Dinge, die erst der Screenshot gefunden hat

**Die halbe Verwaltung war weiß.** Der neue Haken „wem gehört diese Nummer" stand hinter `if (!stand) return null` — React meldete „Rendered more hooks than during the previous render". Kein Test hat das gesehen, kein Typcheck; der Screenshot der Browser-Abnahme hat es gezeigt. Dieselbe Falle stand ein paar Zeilen tiefer in derselben Datei schon dokumentiert.

**34 von 325 bezahlten Bestellungen mit offener Rate haben ÜBERHAUPT keinen Buchungstag** — `paid_at`, Bankbuchung und `completed_at` alle leer. Ohne Anker hätte der Tageslauf sie übersprungen: 34 Kunden hätten ab jetzt lautlos keine Rechnung mehr bekommen. Sie bekommen einen ausdrücklich als **abgeleitet** benannten Anker aus ihrem bestehenden Rhythmus; die Akte sagt es, und der Betreiber kann den echten Buchungstag nachtragen.

**Nebenbefund:** `server/routes/fiaon-vertrieb.ts` schrieb in eine Spalte `paid_at`, die es nicht gab — „Als bezahlt buchen" der Vertriebsleitung lief in einen Serverfehler. Die Spalte gibt es jetzt (Migration 052) und sie ist der Anker des Zyklus.

### Wo zu finden

- **Rechnung:** `server/lib/fiaon-abo-zyklus.ts` · **Motor:** `server/routes/fiaon-abo.ts` (`aboTageslauf`)
- **Empfänger:** `server/lib/fiaon-empfaenger.ts` · **Anrufe:** `server/lib/fiaon-anruf-zuordnung.ts`
- **Preise:** `shared/fiaon-pakete.ts` · **Personen-Gruppierung:** `arbeitslistePersonen` in `server/lib/fiaon-inkasso.ts`
- **Messung vorher:** `npx tsx scripts/mess-abo-motor.ts` → `reports/mess-abo-motor.json`
- **Bestandsläufe:** `npx tsx scripts/abo-bestand.ts [storno|zyklus|preise|anrufe] [--schreiben]`
- **Zustellprotokoll:** `/admin/events` → „Zustellprotokoll" · Route `GET /admin/mail/protokoll?status=fehlgeschlagen`
- **Migrationen:** `052_abo_motor.sql` (Anker, Storno, Eindeutigkeit) · `053_zustellprotokoll_index.sql` (Protokoll war 3,8 s langsam, jetzt 1,9 s)
- **Prüfstände:** `npx tsx scripts/pruef-abo-motor.ts` (119 Prüfungen) · `npx tsx scripts/pruef-abo-browser.ts` (36 Prüfungen, Screenshots in `reports/bilder-abo/`)

**Für den Betreiber sichtbar:** Zahlungszentrale → Karte „Abo-Motor: heute X Rechnungen versandt, Y überfällig geworden" mit Knopf „Tageslauf jetzt". Dashboard → Karte „Zustellung heute" mit Deep-Link auf das gefilterte Protokoll. Kundenakte und Inkasso-Karte → „Abo aktiv seit 05.07. · nächste Rate 05.09. · Rechnung geht automatisch raus".

**Offenes Vorgesetzten-TODO bleibt:** Der Make-Zweig `abo_payment_reminder` und das Brevo-Template. Ohne sie erzeugt der Motor Raten und Protokolleinträge, aber es kommt keine Mail an — sichtbar als Zustellfehler auf der Motor-Karte.

## 11.08.2026 (XXI) — „Immer als Daniel Stripling angemeldet": mein Fehler

### Der schwerste Befund

*„Ich bin die ganze Zeit als Daniel Stripling angemeldet, wenn ich auf /agent gehe — ich kann mich nicht ausloggen."*

**Beides war meine Schuld, aus derselben Änderung von heute Mittag.**

Um dem Vorgesetzten das Telefon im Verwaltungsbereich zu geben, habe ich in `requireAgent` bei gültigem Admin-Code auf „den ersten Vertriebsleiter" geschaltet. Der erste Vertriebsleiter nach Kennung ist **Daniel Stripling (ID 8)**.

Die Folge: Wer den Admin-Code hatte und `/agent` öffnete, **war** Daniel Stripling — mit seinen Kunden, seinen Zahlen, seinem Space.

Und das Abmelden löschte nur das Agenten-Cookie. Die **Ansichts-Sitzung** blieb stehen, und `requireAgent` prüft sie zuerst — nach dem Abmelden war man sofort wieder derselbe Mensch. Eine Abmeldung, die nur eine von zwei Türen schließt, ist schlimmer als keine: Man glaubt, gegangen zu sein.

**Behoben:** Die Ersatzkennung gilt jetzt **ausschließlich unter `/telefon/`**. Ein Kundenportal, eine Arbeitsliste, ein Space gehören einem Menschen — sie einem anderen zu zeigen ist keine Bequemlichkeit, sondern eine Verwechslung. Das Abmelden löscht beide Cookies.

### Das Sende-Menü zeigte zwei Köpfe

*„Wenn man E-Mail senden drückt, sieht man das Menü nicht richtig!"*

Im Schnappschuss stand „AN DIESEN KUNDEN / E-Mail senden" **zweimal**, versetzt, mit zwei Schließen-Kreuzen.

Der Grund: Der Inhalt brachte einen eigenen Kopfbereich mit — und `FiaonEbene` bekam `titel` und `ueberschrift` übergeben und zeichnete daraus ihren. Zwei Köpfe in einem Fenster. Der Fehler entstand, als die Ebene später einen eigenen Kopf bekam und niemand den alten entfernte.

**Gemessen, beide Größen: jetzt genau einer.**

### Die Rechnung per Knopf — und Ihre Frage zu den Events

*„Wenn eine Email raus geht, sag mir, ob wir neue Events haben, die verbunden werden müssen."*

**Nein — kein neues Event.** `abo_payment_reminder` existiert und trägt alles: Betrag, Fälligkeitstag, Ratennummer, Tage überfällig, Mahnstufe, Bankdaten und den Verwendungszweck.

Ein zweites Event für „dieselbe Mail, nur von Hand" wäre ein zweiter Brevo-Text, den man beim nächsten Wortwechsel an einer Stelle ändert und an der anderen vergisst.

**Was noch fehlt:** Der Make-Zweig `abo_payment_reminder` und das Brevo-Template. Das steht als Vorgesetzten-TODO in der Ereignisliste.

**Die Mahnstufe steigt bewusst nicht.** Der automatische Lauf zählt sie hoch (Tag 0, Tag 7, Tag 14). Ein Mensch, der sagt „ich schicke sie Ihnen gleich", mahnt nicht — er hilft. Würde dieser Knopf die Stufe hochzählen, käme der Kunde durch ein freundliches Telefonat schneller in die Eskalation als durch Schweigen.

### Die Inkasso-Akte: gebaut, aber noch nicht sichtbar

*„Der Inkasso-Mitarbeiter muss den Kundenverlauf sehen, alles ganz genau — der braucht keine KI-Analyse."*

Die Route liefert nachweislich (HTTP 200): Kundendaten, **Tage offen**, alle Raten, jedes Gespräch mit Aufnahme, jede Mail, den Verlauf und die Bankdaten zum Vorlesen. Aufbau nach Ihrem Satz: wer · was offen · wie steht er da · was wurde versucht · was jetzt.

**Ehrlich: Die Anzeige lädt nicht.** Die Ebene öffnet mit Kopf, der Inhalt bleibt bei „Wird geladen …". Gemessen: **kein einzelner Netzwerkaufruf** an die Route, kein Konsolenfehler. Der Effekt in der Komponente feuert nicht, und ich habe die Ursache in dieser Sitzung nicht gefunden.

Ein Zwischenbefund war behoben: Die Route brach mit `column p.strasse does not exist` ab — die Spalten heißen `street`, `zip`, `city`.

### Prüfstand

`pruef-rueckstand` von 310 auf **321**. Gesamt **2.209**. Die Akte-Anzeige ist in der Browser-Abnahme rot und bleibt es, bis sie lädt — ein grüner Prüfstand über unerreichbare Funktionen ist genau der Fehler aus `AGENTS.md`.

## 11.08.2026 (XX) — Die Kostenleiste: blau auf schwarz, jetzt gemessen lesbar

### Der Befund, in Zahlen

*„Die Schriftfarbe ist blau auf schwarz — mach das moderner, Animationen, 3D-Elemente und vor allem LESBAR!"*

Gemessen an den gerenderten Elementen:

| | vorher | jetzt |
|---|---|---|
| Zahlen | `rgb(17,24,39)` auf `rgb(10,26,60)` | `rgb(244,248,255)` |
| Kontrast Zahlen | praktisch null | **17,59** |
| Kontrast Beschriftung | — | **12,64** |

`rgb(17,24,39)` ist Tailwinds `text-gray-900` — fast schwarz auf dunkelblau.

### Warum die Hausregel nicht griff

Im Stylesheet stand:

```css
/* Alles darin ist hell — hier gilt die Regel besonders streng */
.fi-flaeche-tief, .fi-flaeche-tief * { color: inherit; }
```

**Der Kommentar behauptete Strenge, das CSS hatte keine.** Eine Utility-Klasse wie `text-slate-900` hat dieselbe Spezifität wie `.fi-flaeche-tief *` — und Tailwind wird **später** eingefügt. Bei gleichem Gewicht gewinnt das Spätere.

Ein Kommentar, der Strenge behauptet, ersetzt kein `!important`.

### Die neue Kostenbühne

**Lesbar:** Jede Schriftfarbe steht ausdrücklich mit `!important`, keine wird geerbt.

**Der Deckungsbalken** läuft beim Erscheinen von null auf seinen Wert — gedeckelt bei 100 %. Ein Balken, der bei 461 % viermal aus dem Kasten läuft, sagt nichts mehr; die Zahl steht daneben und darf so groß sein, wie sie ist. Eine Linie markiert die 100-Prozent-Grenze, sonst wäre der Balken eine Länge ohne Maßstab.

**Tiefe statt Fläche:** Drei Schattenebenen — ein enger für die Kante, ein weiter für die Höhe, eine Lichtkante oben. Dazu ein radialer Lichtschein von links oben.

**Ein wandernder Glanz**, einmal alle acht Sekunden. Dezent: Er macht die Fläche lebendig, ohne Aufmerksamkeit zu fordern.

**Auf 390 px** als 2×2-Raster, ohne Teiler, mit 82 px Platz rechts unten — der schwebende Telefonknopf überdeckte den Satz „2 Personen mit Festgehalt". Derselbe Fehler wie heute Vormittag in der Vertriebsliste: Ein schwebendes Element gehört in die Platzrechnung.

Bei `prefers-reduced-motion` fallen Glanz und Einlauf weg.

### Prüfstand

`pruef-rueckstand` von 299 auf **310**. Drei Gegenproben: `!important` entfernen, Balken ohne Deckelung, weiße Zahlenfarbe raus — jede wird rot. Kontrast an beiden Größen gemessen, nicht behauptet.

Gesamt **2.198**.

## 11.08.2026 (XIX) — Die Team-Zentrale zeigte SQL statt Zahlen

### Mein Fehler, im Screenshot sichtbar

Wo „58" stehen sollte, stand in jeder Mitarbeiterkarte:

```
(SELECT COUNT(*)::int FROM fiaon_persons p WHERE p.assigned_agent_id = a.id AND …
```

Drei Absätze Quelltext, achtmal untereinander.

**Die Ursache:** Ich hatte `bestandSql(1)` in ein **getaggtes Template** (`sqlPool\`…\``) gesetzt. Dort wird jedes `${…}` als **Parameter gebunden**, nicht als SQL eingesetzt — mein Ausdruck landete als Text-Literal in der Antwort.

**Der eigentliche Fehler war die Abnahme.** `tsc --noEmit` und `esbuild` waren grün, weil es weder ein Typ- noch ein Syntaxfehler ist. Nur der Browser hätte es gezeigt, und dorthin habe ich nicht geschaut. Ich habe eine Änderung an der Team-Zentrale ausgeliefert, ohne die Team-Zentrale anzusehen.

Jetzt `sqlPool.unsafe()` — dort wird der Baustein wirklich eingesetzt. Gemessen: echte Zahlen bei acht Mitarbeitern.

### Provisionen: der Verlauf fehlte ganz

*„Unter ‚Provisionen' findet man keine Verläufe."*

Der Reiter zeigte **nur offene Nachbuchungen** — also das, was fehlt. Was gebucht **ist**, stand nirgends: **200 Zeilen** in der Datenbank, keine einzige sichtbar. Ein Mensch, der fragt „womit habe ich meine 1.691 € verdient", fand keine Antwort.

Jetzt: Summenzeile (**gesamt · ausgezahlt · offen · Anzahl**) und jede Buchung mit Kunde, Paket, Art (eigener Abschluss oder Leitungsprovision mit Namen der Quelle), Satz, Datum, Betrag und Zustand.

### Gespräche: ein neuer Reiter

*„Ich muss die Gespräche, die durch das Plattform-Telefon geführt wurden, beim Agenten zugewiesen haben, der sie geführt hat."*

Sie **waren** zugewiesen — über `fiaon_calls.agent_id`. Sie waren nur nie sichtbar.

Jetzt mit Kennzahlen (Gespräche, erreicht, Gesprächszeit, Aufnahmen, ausgewertet), jedem Anruf mit Kunde, Dauer, Ergebnis **in Klartext** und einem Player für die Aufnahme.

Die Twilio-URL geht **nicht** mit: Nach außen geht nur, *ob* es eine Aufnahme gibt — abgespielt wird über die rechteprüfende Route.

### KI-Auswertung: Beobachtungen, keine Note

*„Ich muss KI-Auswertungen machen können."*

Die KI liest die Transkripte der letzten 30 Tage und antwortet in fünf Abschnitten: **Was gut läuft · Wo Gespräche abbrechen · Was ungesagt bleibt · Risiko · Ein Satz für das nächste Gespräch.**

**Bewusst keine Note.** Eine Zahl von eins bis zehn über einen Menschen lädt dazu ein, Leistung zu vergleichen, ohne zu wissen, welche Kunden jemand hatte. Und sie **beendet** das Gespräch mit dem Mitarbeiter; eine Beobachtung eröffnet es.

Der Abschnitt „Risiko" fragt gezielt nach unzulässigen Zusagen: Erlass, Stundung, Ratenänderung, Renditeversprechen, Rechts- oder Steuerberatung.

**Ohne Transkripte wird der Grund genannt, keine Antwort erfunden:** „6 Gespräche, aber keine Aufnahmen — ohne Aufnahme gibt es kein Transkript." Eine KI, die aus nichts eine Beurteilung baut, ist schlimmer als keine.

### Zwei sichtbare Mängel behoben

- `nicht_erreicht` stand als **Feldname** in der Akte. Ein Vorgesetzter soll keine Datenbankspalten entziffern.
- „Anhören" **und** „ohne Aufzeichnung" standen nebeneinander — ein Widerspruch, den man erst durch Klicken auflöst.

### Prüfstand

`pruef-rueckstand` von 278 auf **299**. Drei Gegenproben: getaggtes Template zurück, Twilio-URL ins Frontend, KI gibt eine Note — jede wird rot. Vierzehn Browser-Messungen auf Desktop und 390 px, alle grün.

Gesamt **2.187**.

## 11.08.2026 (XVIII) — Inkasso fertig: 90 Raten angelegt, 86 überfällig statt 29

### Die Raten sind angelegt

*„Wenn der am 05.07 bezahlt hat, muss er am 05.08 beim Inkasso stehen!!!!"*

**90 Raten für 33 Kunden** nachgetragen — alle seit dem Starttag fälligen plus die nächste.

Das Forderungsmanagement sieht jetzt **86 überfällige Raten bei 61 Kunden über 5.675,14 €**. Vorher: 29.

**34 Kunden bleiben offen.** Sie stehen auf `payment_status = paid` und `status = payment_completed` — echte Kunden, die bezahlt haben —, aber weder Paket noch Betrag ist hinterlegt. In der CSV vom 03.07.–11.08. stehen sie nicht; sie sind vom 29.05. bis 02.07. Der Monatsbeitrag ist nicht ableitbar, und ich rate ihn nicht. Sie stehen namentlich in der Karte.

### „Diesen Monat eingezogen: 4.833,28 €" war erfunden

*„Woher nimmst du das? Wie kommst du auf das?"*

Die Abfrage zählte **jede** bezahlte Rate des Monats — ohne Sichtfeld, ohne Bezug zum Forderungsmanagement.

Nachgerechnet: Von den 74 Raten wurde **keine einzige** durch Nachfassen eingezogen. Alle 74 kamen pünktlich.

„Eingezogen" ist ein Leistungswort. Es zählt jetzt nur, was ohne Nachfassen nicht gekommen wäre: `bezahlt_am > faellig_am`. Der pünktliche Eingang steht **getrennt** daneben — er ist eine gute Nachricht, nur nicht die des Forderungsmanagements.

### Der Knopf führte in einen verschlossenen Raum

*„Wenn man auf Akte klickt, wird man auf /admin/kunde/3503 weitergeleitet, da hat der Inkasso aber keinen Zugriff."*

Mein Fehler. Ein Knopf, der in einen gesperrten Bereich führt, ist schlimmer als kein Knopf — er sieht wie eine Möglichkeit aus.

Die Akte für diesen Menschen **ist** das Gesprächsblatt: Es liest über `/api/fiaon/gespraechsblatt/:personId` und prüft die Rechte mit derselben `darfAnKunde`-Funktion. Der Knopf heißt jetzt „Akte & Verlauf".

### Er sah 29, es waren 86

Die Oberfläche filterte `inkasso_agent_id = <ich>` — das sperrte ihn auf seine zugeteilten Fälle ein. Die 57 neu nachgetragenen gehörten noch niemandem und lagen **unsichtbar**.

Eine überfällige Rate ohne Zuständigen ist keine Ruhe, sondern liegengebliebene Arbeit. Er sieht jetzt **seine und die unzugeteilten** — die eigenen zuerst.

### Eine Wand gegen meinen neunten Fehler

`scripts/pruef-backticks.ts`. Ein Backtick in einem SQL-Kommentar beendet das Template-Literal; der Serverstart hängt still. `AGENTS.md` warnt seit dem 08.08. — ich bin **neunmal** hineingelaufen.

Zwei Entwürfe waren wertlos:

1. Ein Zustandsautomat über die Datei — **22 Fundstellen**, fast alle harmlose JSDoc-Kommentare. Eine Bremse, die falsch auslöst, wird abgeschaltet.
2. Die Literale suchen und darin nach Kommentaren schauen — **fand meinen echten Fehler nicht**. Henne und Ei: Genau der Backtick, den ich suche, beendet das Literal und macht es unauffindbar.

Der dritte ist der einfachste: **Eine Zeile, die mit `--` beginnt, ist ein SQL-Kommentar** — und die gibt es in TypeScript nur innerhalb von Template-Literalen. Steht ein Backtick darin, ist es immer der Fehler. Kein Zustand, keine Vermutung, keine Fehlalarme. Gegengeprüft: Er findet meinen echten Fall und meldet sonst nichts.

### Prüfstand

`pruef-rueckstand` von 265 auf **278**, dazu der neue Backtick-Prüfstand. Gesamt **2.166**, alle grün.

## 11.08.2026 (XVII) — Jeder Kunde außer SCHUFA hat ein Abo: 67 hatten keine Rate

### Die Regel, gegen den Kontoauszug geprüft

*„JEDER Kunde BIS AUF SCHUFA (74 €) HAT EIN ABO, JEDER — ab Tag der Verbuchung, genau ab dem Tag bezahlt er JEDES Monat sein Paket. Jeder, der seine Rate nicht bezahlt hat, muss zum Inkasso kommen."*

Die Preise stehen jetzt an **einer** Stelle — und sie sind nicht aus dem Kopf, sondern gegen `statement_165031496_EUR_2026-07-03_2026-08-11.csv` geprüft: **327 echte Eingänge über 23.244,82 €**.

| Betrag | Häufigkeit | Paket |
|---|---|---|
| 99,99 € | ×75 | ultra |
| 79,99 € | ×46 | highend |
| **74,00 €** | **×37** | **SCHUFA — kein Abo** |
| 59,99 € | ×81 | pro |
| 7,99 € | ×54 | start |

Alles andere im Auszug sind Einzelfälle: Teilzahlungen (0,88 €, 8 €, 10 €, 20 €, 50 €), Rundungen (59,90 €, 76,12 €) und drei große Posten aus dem Geschäftskundenbereich.

### 67 bezahlte Kunden hatten keine einzige Abo-Rate

Sie konnten im Forderungsmanagement **nie** auftauchen — nicht weil sie zahlten, sondern weil niemand eine Rate erwartete.

**33 sind anlegbar**, 34 nicht: Bei ihnen ist weder Paket noch Betrag hinterlegt. Sie werden **übersprungen und benannt**, nicht mit 0 € angelegt.

Der Starttag kommt aus der ersten zugeordneten **Bankbuchung** (`fiaon_bank_txns.booked_at`). Fehlt sie — und bei allen 67 fehlt sie —, bleibt das Anlagedatum als schlechtere, aber einzige Auskunft. Das wird **ausgewiesen**, nicht verschwiegen.

Angelegt werden **alle fälligen Raten plus die nächste**. Wer im April verbucht wurde, hat drei überfällige — nur die nächste anzulegen würde die Vergangenheit unter den Teppich kehren.

### Ein NULL-Fallstrick, der 63 Kunden gekostet hat

Meine erste Abfrage schloss SCHUFA mit `NOT (amount_due = 74 OR ...)` aus. **Bei 63 bezahlten Kunden ist `amount_due` NULL** — und `NOT NULL` ist in SQL nicht `TRUE`, sondern `NULL`. Diese 63 fielen durch **beide** Filter: weder SCHUFA noch abopflichtig.

Die Rechnung ging nicht auf: 34 + 261 = 295, nicht 358. Erst diese Lücke führte zu den 67.

Deshalb kommt der Preis jetzt aus dem **Paket**, nicht aus `amount_due`. Der Preis gehört zum Paket, nicht zur einzelnen Bestellung.

### Der Kontoauszug 1:1

**254 von 327 Eingängen** sind zuordenbar — über `payment_reference` (`FIAON-X2U268`), nicht über `ref` (`FIAON-MSKI4FY6-YUQU`). Zwei Formate; mein erster Abgleich prüfte das falsche und fand **0 von 273**.

**45 Bank-Buchungen sind nicht zugeordnet.** Kategorisiert:

- 1.000 € Gesellschafterdarlehen (kein Kundengeld)
- 131,73 € Kartentransaktion
- `fison-P2W2V6` — Tippfehler des Kunden
- `R97E28` — ohne FIAON-Präfix
- Mehrere mit **gültigem** Format (`FIAON-UXUZ39`, `FIAON-VA2NA7`, `FIAON-3DWTPH`), die trotzdem nicht zugeordnet wurden

Die letzte Gruppe ist der interessante Fall — dort lohnt ein Blick in der Zahlungszentrale.

### SCHUFA: die Gegenprobe

**0 SCHUFA-Bestellungen haben Abo-Raten.** Die Regel wird eingehalten — und sie wird jetzt geprüft: Eine Regel, die man nicht prüft, gilt nur, bis jemand sie vergisst.

### Zwei Prüfungen, die nichts prüften

- „Der NULL-Fallstrick ist abgefangen" fand den Ausdruck in der **Nachbarfunktion**.
- „Der Preis kommt aus dem Paket" prüfte nur den **Kommentar** — nicht das Verhalten.

Beide korrigiert: Die erste ist an `fehlendeAbos` gebunden, die zweite prüft einen echten Kunden mit Paket ohne `amount_due` (`ultra → 99,99 €`).

Und eine dritte Invariante misst nicht mehr den Betrieb mit: „Keine Person verloren" war rot, weil während des Laufs **ein echter Mensch** ein Formular abgeschickt hatte.

### Prüfstand

`pruef-rueckstand` von 238 auf **265**. Drei Gegenproben: NULL-Fallstrick, Preis aus `amount_due`, SCHUFA nur über den Betrag — jede wird rot. Gesamt **2.153**, alle grün.

## 11.08.2026 (XVI) — Vier Befunde: A/B/C, fehlende E-Mails, Inkasso, Telefon für alle

### 1. Drei Zahlen für eine Frage

*„In meiner Ansicht steht, dass er so und so viele A-, B- und C-Kunden hat — in seiner Ansicht steht aber was ganz anderes!"*

Für Daniel Stripling, Stufe A, gemessen:

| Wo | Zahl |
|---|---|
| Team-Zentrale (Vorgesetzter) | **58** |
| Kundenliste (der Agent selbst) | **30** |
| Arbeitsliste (was heute ansteht) | **4** |

Die Zentrale zählte roh — mit Gesperrten und mit Menschen, die eine Verabredung in der Zukunft haben. Der Agent sah nur, was er anfassen darf.

**Keine Zahl war falsch. Falsch war, dass sie dieselbe Überschrift trugen.** Wer 58 sieht und fragt, warum nur vier abgearbeitet wurden, stellt die falsche Frage — und der Agent kann sich nicht wehren, weil er die 58 nie gesehen hat.

Die Definition steht jetzt in `fiaon-bestand-filter.ts`. Die Zentrale zeigt **beide** Zahlen: „29 im Bestand, 4 heute dran". Eine allein führt immer in die Irre.

### 2. 407 Kunden ohne E-Mail — aber alle mit Telefonnummer

Gemessen: 446 Kunden in Stufe 1–3 haben keine `primary_email`; bei **407** steht auch im Antrag keine. Kein Datenverlust: **Alle 407 haben eine Telefonnummer**, und 355 davon einen abgeschlossenen Antrag.

Es ist eine **Erfassungslücke**, kein Verlust — sie kamen über einen Weg herein, der keine E-Mail verlangt. Ich habe nichts geändert: Was mit ihnen geschehen soll (nachfragen, ausschließen, per Telefon erfassen), ist eine Entscheidung, nicht ein Fehler.

### 3. Inkasso: die eigentliche Lücke

*„Inkasso hat völlig falsche und viel zu wenig Kunden."*

**Gemessen: 100 bezahlte Kunden haben gar keine Abo-Raten** — 28 davon mit überfälligem Fälligkeitsdatum. Sie tauchten im Forderungsmanagement nie auf, nicht weil sie in Ordnung waren, sondern weil für sie **nie eine Rate angelegt wurde**.

`status = 'offen'` wurde zu `status <> 'bezahlt'`: Eine Rate, die auf „gemahnt" oder „eskaliert" gesetzt wird, verschwand lautlos — genau die, um die man sich am meisten kümmern muss.

**Nach hinten gibt es keine Grenze mehr.** Eine Rate, die seit neunzig Tagen offen ist, ist dringender als eine von gestern.

**Die Aktionen, die fehlten:** Es gab drei Knöpfe (Anrufen, Gesprächsblatt, Ergebnis). Wer telefonierte und hörte „schicken Sie mir die Daten nochmal", konnte das nicht tun. Jetzt: **Senden** (Zahlungsdaten, Beitrag, Mahnungen — dieselbe `SendeMenue` wie im Vertrieb) und **Kundenakte**.

### 4. Das Telefon für jeden Mitarbeiter

*„Das Handy soll für JEDEN funktionieren, der Mitarbeiter ist!"*

Es stand eine Liste aus drei Rollen. Das Forderungsmanagement fehlte — ein Mensch, dessen ganze Arbeit im Anrufen besteht, bekam: *„Deine Rolle darf nicht telefonieren."*

Jetzt eine **Sperrliste statt einer Erlaubnisliste**. Eine Erlaubnisliste muss man bei jeder neuen Rolle erweitern, und genau das vergisst man — der Fehler fällt erst auf, wenn jemand vor einer verschlossenen Tür steht.

### Zwei Kopien derselben Funktion

`darfAnKunde` stand in `fiaon-telefonie.ts` **und** in `fiaon-mail.ts`. Beide hatten dieselbe Lücke: Inkasso fiel in den letzten Zweig (nach `assigned_agent_id`) und durfte niemanden anrufen und niemandem schreiben.

Ich hätte sie zweimal reparieren können. Beim nächsten Mal wären es wieder zwei Stellen. Jetzt steht sie in `fiaon-kundenzugriff.ts` — einmal.

### Backticks im SQL-Kommentar: siebter Fall

Diesmal in Sekunden von `esbuild` gefangen. Ich prüfe die geänderten Dateien jetzt reflexartig mit einem Regex auf `--.*\``.

### Was offen bleibt

Die 28 Kunden ohne angelegte Rate erscheinen jetzt in der **Zugriffsprüfung** (Inkasso darf sie anrufen und ihnen schreiben), aber noch **nicht in der Arbeitsliste** — die liest ausschließlich `fiaon_abo_raten`. Der saubere Weg wäre, die fehlenden Raten nachzutragen; das ist ein Schreibvorgang mit Mahnfolgen und braucht Ihre Entscheidung.

### Prüfstand

**238 Prüfungen** in `pruef-rueckstand`, alle grün. Gesamt **2.126**.

## 11.08.2026 (XV) — „Der Name wird nicht akzeptiert": Das Feld kam nie an

### Der Befund

Der Vorgesetzte: *„Auch wenn ich den Namen richtig eintrage, akzeptiert er es nicht und meldet es als Fehler."*

Er hatte recht. Die Meldung log nicht — sie war **blind**:

Die Inkasso-Route las `req.body.nameGetippt`. Der Client schickte `name`. **Das Feld kam nie an.** Der Vergleich lief gegen einen leeren String, und die Antwort lautete *„Bitte den vollständigen Namen genau so eingeben, wie er im Konto steht: Hans-Jürgen Gerhold"* — mit genau dem Namen, den er gerade eingegeben hatte.

Eine Meldung, die den eigenen Fehler dem Benutzer anlastet, ist die schlimmste Sorte.

**Nachgemessen bis auf die Codepoints:** Der Name in der Datenbank und der getippte waren zeichengleich (`0048 0061 006e 0073 002d 004a 00fc …`). Es lag nie am Namen.

Vertriebs- und Onboarding-Route lesen `name` — nur diese eine wich ab. Sie nimmt jetzt **beide**.

### Und der Vergleich war zu streng

Selbst mit ankommendem Feld hätte er in vier Fällen versagt:

| Fall | Warum |
|---|---|
| `Hans-Ju**̈**rgen` | „ü" als zwei Zeichen (u + U+0308) statt einem — sieht identisch aus |
| `Hans**–**Jürgen` | Halbgeviertstrich statt Bindestrich — Word und iOS ersetzen das selbst |
| `Hans-Jürgen** **Gerhold` | Geschütztes Leerzeichen |
| leeres Feld | Wurde als „falscher Name" gemeldet statt als Serverfehler |

Alle vier sind behoben. Ein leeres Feld sagt jetzt: *„Der Name ist beim Server nicht angekommen. Bitte die Seite neu laden — wenn es dann noch immer nicht geht, liegt es nicht an dir."*

### Ein ernster eigener Fehler

Ich wollte die acht Schreibweisen prüfen — in einer Transaktion, am Ende zurückgerollt. **Das Rollback lief ins Leere.**

`zusageSpeichern()` nimmt keinen Transaktions-Parameter und schreibt intern mit `sqlPool`. Es entstanden **sechs echte Zusagen** für Hans-Jürgen Gerhold, der nie unterschrieben hat.

Genau der Vorfall vom 06.08.2026, vor dem `AGENTS.md` warnt — von mir wiederholt, weil ich eine Transaktion für eine Wand hielt.

**Behoben:** Alle sechs sind **widerrufen** (kein Hard-Delete), mit Grund und Protokolleintrag. Gültige Zusagen für ihn: **0** — der Stand vor meinem Lauf.

**Damit es nicht wieder passiert:** `zusagePruefen()` prüft dieselbe Logik, **ohne die Datenbank anzufassen**. Ein Prüfstand nimmt ab jetzt diese Funktion. Der Prüfstand zählt vorher und nachher und schlägt an, wenn eine Zusage entstanden ist.

### Prüfstand

`pruef-rueckstand` von 224 auf **238**. Zwei Gegenproben: Feldname zurückdrehen, Normalisierung entfernen — beide werden rot. Gesamt **2.126**, alle grün.

## 11.08.2026 (XIV) — Richtlinie im Display · Telefon für die Verwaltung · Sparmodus

### Die Richtlinie erschien hinter dem Telefon

Der Vorgesetzte: *„Man kann als neuer Mitarbeiter die Telefon-Richtlinie nicht bestätigen, es erscheint hinter dem Telefon (da ist alles geblurt, man erkennt nichts). Wenn man dann rausgeht und das bestätigt und seinen Namen eintippt, geht es noch immer nicht!"*

Gemessen: Das Gerät liegt bei **z-index 420**, die Tafel bei **400**. Sie lag zwangsläufig hinter einer Fläche mit 20 px Weichzeichnung.

**Die Lösung ist keine höhere Zahl, sondern ein anderer Ort.** Die Annahme gehört dorthin, wo sie gebraucht wird: Wer das Telefon öffnet und noch nicht angenommen hat, liest und unterschreibt **im Display** — ohne es zu verlassen.

Der volle Text, rollbar (gemessen: 2.021 px Inhalt). Nicht gekürzt: Eine Erklärung, die man unterschreibt, muss man auch lesen können. Haken, Namensfeld, Knopf — alles an einer Stelle.

Die alte Tafel bleibt als Rückfall und liegt jetzt bei z-index 460, also über dem Gerät.

**Gemessen, beide Geräte:** Richtlinie sichtbar und obenauf, Knopf gesperrt ohne Haken und Namen, nach Eingabe frei. **Nicht gedrückt** — eine Rechtserklärung erzeugt kein Testlauf (`AGENTS.md`).

### Ein Fehler, den nur der Browser zeigte

Mein Sparmodus-Haken stand hinter `if (!stand) return null;`. Der Browser meldete *„Rendered more hooks than during the previous render"* — und das ganze Telefon verschwand hinter einem roten Fehlerfenster.

React zählt Haken. Läuft einer nicht bei **jedem** Durchgang, verrutscht die Zuordnung aller folgenden. **Weder `tsc --noEmit` noch `vite build` finden das** — beide waren grün. Erst der Schnappschuss zeigte es.

### Mobile Leistung: der Sparmodus

Rückmeldung eines Agenten (iPhone 15 Pro Max): *„Am Laptop funktioniert es sehr gut. Am Handy reagiert die Oberfläche zeitversetzt, Buttons hängen kurz, und während des Telefonats habe ich immer wieder ein starkes Klackern."*

**Es liegt nicht am Gerät.** Eine Weichzeichnung auf einer bildschirmfüllenden Fläche zwingt Safari, bei jedem Bild den gesamten Hintergrund neu zu zeichnen — auf einem Telefon mit 460 dpi über zwei Millionen Bildpunkte, sechzigmal je Sekunde. Läuft daneben WebRTC, konkurrieren Zeichnen und Audio-Verarbeitung um dieselbe Rechenzeit; die Audio-Puffer laufen leer, und das hört man.

Sobald ein Ruf läuft, trägt die Wurzel `data-gespraech="1"`. Dann fallen weg: Weichzeichnung, Hintergrundvideo, alle Dauer-Animationen, alle Übergänge. Auf schmalen Geräten generell nur noch 6 px statt 14 px Blur.

**Ehrlich: Die Wirkung habe ich nicht nachweisen können.** Die Regel ist nachweislich im Dokument geladen, der Schleier trägt die Klasse, es gibt keinen Inline-Stil — und `getComputedStyle` zeigt trotzdem unveränderte 14 px. Ich habe `body` gegen `:root` getauscht (das Gerät hängt in einem Portal) und den Server neu gestartet; beides half nicht. Der Code schadet nicht, aber ich kann nicht behaupten, dass er hilft.

### Das Telefon für die Verwaltung

*„Admin braucht auch das Telefon mit Admin-Rechten, also auf alle Kunden und so."*

Es steckte nur in der Mitarbeiter-Hülle. Jetzt auch in der Verwaltung — **dieselbe Komponente**, kein Nachbau.

Der Server schaltet bei gültiger Admin-Sitzung auf das **Vorgesetzten-Konto**, nicht auf eine körperlose Vollmacht. Ein Anruf braucht einen Absender: Das Gespräch wird aufgezeichnet, zugeordnet, protokolliert und abgerechnet. Ein Ruf „vom System" hätte keinen Namen in der Akte — und niemanden, den man fragen kann.

Die Rechte kommen aus der Rolle dieses Kontos. Es entsteht keine neue Rechteklasse.

### Prüfstand

`pruef-rueckstand` von 208 auf **224**. Gesamt **2.112**, alle grün. Elf Browser-Messungen, zehn grün — der Sparmodus ist die eine offene.

## 11.08.2026 (XIII) — Forderungsmanagement bekam Vertriebskunden · Auto-Advance im Telefon

### 22 Vertriebskunden lagen beim Forderungsmanagement

Der Vorgesetzte: *„Die Abteilung Forderungsmanagement hat Kunden drinnen, die die Agenten abgelehnt haben oder auf nicht erreicht. Das ist falsch!"*

**Die Rate-Liste war sauber** — gemessen: alle 100 Zeilen `tier 0 (bezahlt)`, keine abgelehnte, keine nicht erreichte. Das Leck lag woanders, an drei Stellen:

**1. Die Lead-Zuteilung prüfte die Rolle nicht.** `agentMitKleinsterLast()` fragte nach `active` und `distribution_active` — aber nicht danach, *was* jemand macht. Ein neu angelegtes Inkasso-Konto hat null Kunden und war damit **immer** „der Agent mit der kleinsten Last". Es bekam jeden neuen Lead.

Gemessen: **Hans-Jürgen Gerhold 11, Diana Zeller 11** — mit Stufen wie `zahlungsfrist_abgelaufen` und `antrag_abgeschlossen`. Hergekommen von Nikita Boychenko (9), Daniel Stripling (8), Lucas Böhnert (3).

Dieselbe Lücke steckte in der **Terminvergabe** (ein Kunde, der bucht, will einen Verkäufer sprechen) und in der **Übergabe bei blockierter Nummer**. Alle drei sind zu.

**2. Der Menüpunkt „Kunden" trug keine Rollenbeschränkung.** Ein Inkasso-Konto meldet sich an, sieht „Kunden" und öffnet damit die volle Vertriebsliste. Jetzt: kein Menüpunkt — und, wichtiger, **die Route antwortet mit 404**. Einen Menüpunkt auszublenden ist keine Grenze, sondern eine Bitte.

Dafür gibt es jetzt „Forderungen" im Menü. Der Punkt fehlte ganz; Hans-Jürgen hätte die Adresse von Hand eintippen müssen.

**3. Die 22 bestehenden Fälle.** Der Hahn ist zu, aber das Wasser steht noch im Becken. Neue Karte in der Team-Zentrale zeigt jeden mit Name, Stufe, Herkunft und Ziel — und einem Knopf. **Ich habe nicht gedrückt:** Es betrifft drei andere Agenten, die morgen früh unerklärt mehr Arbeit hätten.

Zurück geht es an den früheren Betreuer, wenn es einen gibt, sonst gleichmäßig verteilt.

### Auto-Advance: zwei Klicks weniger je Gespräch

Ein Agent, sinngemäß: *„Wenn ich ‚Nicht erreicht' klicke, lande ich wieder auf der Wähltastatur — mit der Nummer desselben Kunden. Um zum nächsten zu kommen, muss ich auf ‚Anderen Kunden wählen', und dort steht ein leeres Suchfeld."*

Bisher: `setZustand("bereit")` — und die Nummer blieb stehen. Zwei Klicks und eine Sucheingabe zwischen zwei Anrufen. Bei sechzig Gesprächen am Tag sind das zwei Minuten reines Klicken; schlimmer ist der Bruch im Rhythmus.

Jetzt steht der Nächste schon da: Name, Nummer, ein Griff zum grünen Knopf. Mit Marke „Nächster aus deiner Liste" — ein Kunde, der ungefragt im Wählfeld auftaucht, verunsichert mehr, als er hilft.

**Er wird geladen, nicht angerufen.** Ein Telefon, das von selbst wählt, nimmt dem Menschen die Entscheidung — und wer noch eine Notiz zu Ende schreiben will, hat schon einen klingelnden Hörer am Ohr. Ein Klick bleibt; zwei fallen weg.

Die Reihenfolge ist **dieselbe wie in der Kundenliste**, samt der Regel für Verabredungen. Zwei Reihenfolgen für dieselbe Arbeit wären schlimmer als gar keine Hilfe. Wer schon dokumentiert wurde, wird übersprungen.

Eine unwählbare Nummer wird **benannt**, nicht verschwiegen: „Der nächste wäre Hutanu Doina-Tatiana, aber seine Nummer ist nicht wählbar."

### Fünf eigene Fehler

1. **Backticks im SQL-Kommentar** — fünfter Fall. Diesmal in Sekunden von `esbuild` gefangen.
2. **`waehlbareNummer()` nimmt ein Array**, keinen String.
3. **`meta` ist `text`, nicht `jsonb`** — Cast nötig.
4. **Das Feld heißt `person_id`, nicht `personId`.** Mit dem falschen Namen fand die Abfrage niemanden, und alle 22 Kunden wären an **denselben** Menschen gegangen.
5. **Der Rundlauf war keiner.** `agentMitKleinsterLast()` fragt die Datenbank — und die weiß nichts von Zuteilungen, die in derselben Schleife erst geplant werden. Alle 22 gingen an Lucas Böhnert. Jetzt zählt ein `geplant`-Zähler mit: **8 · 7 · 7**.

### Drei Prüfungen, die nichts prüften

Die Gegenprobe deckte auf, dass zwei Prüfungen den gesuchten Text an **anderer Stelle derselben Datei** fanden:

- „Die Lead-Zuteilung prüft die Rolle" fand die Bedingung in `sonderrollenBereinigen` weiter unten.
- „Nach dem Ergebnis wird der Nächste geholt" fand den Pfad im „Nächsten holen"-Knopf.

Beide sind jetzt an ihre Funktion gebunden. **Eine Prüfung, die im Nachbarhaus nachsieht, prüft nichts.**

### Prüfstand

`pruef-rueckstand` von 184 auf **208**. Drei Gegenproben, jede wird rot. Gesamt **2.096**, alle grün.

## 11.08.2026 (XII) — Forderungsmanagement sieht nur Fälliges, „nicht erreicht" räumt die Liste

### Forderungsmanagement: 153 von 251 Raten gehörten nicht dorthin

Der Vorgesetzte: *„Die Mitarbeiter von Forderungsmanagement erhalten AUSSCHLIESSLICH die Kunden, deren Abo-Raten überfällig sind — nur diese! Aktuell haben sie irgendwelche anderen Kunden."*

Gemessen: **153 von 251 Raten** im Sichtfeld waren erst *später* als in sieben Tagen fällig. Das Sichtfeld prüfte nur „offen" und „Kunde hat bezahlt" — nicht, ob überhaupt etwas ansteht.

Eine Arbeitsliste, in der drei von fünf Zeilen nichts zu tun geben, ist keine Arbeitsliste. Wer sie benutzt, lernt sie zu überfliegen — und übersieht dann auch die zwei, bei denen es brennt.

**Die Grenze steht jetzt im Sichtfeld selbst:** `r.faellig_am <= CURRENT_DATE + 7`. Nicht enger, weil eine Rate, die übermorgen fällig wird, den freundlichen Anruf **vorher** verdient — das ist der Unterschied zwischen Forderungsmanagement und Mahnwesen. Nicht weiter, weil alles darüber hinaus noch keine Aufgabe ist.

**Drei Fristknöpfe** mit Zahl: Überfällig **29** · Heute fällig **0** · Nächste 7 Tage **69**. Ein Filter ohne Zahl ist eine Frage, mit Zahl eine Auskunft. Vorgabe ist „Überfällig" — wer die Seite öffnet, soll dort anfangen, wo es brennt.

Wer zugeteilte Fälle hat, sieht **seine**. Wer noch keine hat, sieht die unzugeteilten — sonst stünde er vor einer leeren Liste, obwohl Arbeit da ist.

### „Nicht erreicht": 311 Kunden standen doppelt in der Liste

Ein Agent: *„Wenn ich den Kunden ‚nicht erreicht' klicke, bleibt er trotzdem in der Liste — verschwinden tut er bei mir nicht."*

Gemessen: **311 Kunden** hatten eine Wiedervorlage in der Zukunft und standen trotzdem in den Arbeitslisten. Das Ergebnis setzte `follow_up_date = morgen`, aber die Liste sah es nicht an.

Die Folge ist genau die, die der Agent beschreibt: Derselbe Mensch wird zweimal angerufen. Für den Kunden aufdringlich, für den Agenten Zeitverlust — und die Liste wird nie kürzer. Sie war ein Eimer ohne Boden.

**Die Regel:** Eine Wiedervorlage in der Zukunft ist eine **Verabredung**. Wer sie hat, gehört heute nicht in die Frage „wen rufe ich jetzt an?".

**Ausgenommen: die Zahlungszusage.** Wer für den 20. zugesagt hat, bleibt sichtbar — nicht zum Anrufen, sondern weil sein Geld erwartet wird.

Der Kunde ist **nicht weg**: Er steht im Filter „Nicht erreicht" und in jeder Suche. Eine Liste, die einen Kunden versteckt, den es gibt, wäre der schlimmere Fehler.

**Zwei Arten von Ergebnis, zwei Arten damit umzugehen:**

| Ergebnis | Was passiert |
|---|---|
| Nicht erreicht, Mailbox, Rückruf, falsche Nummer | Marke zeigen, dann ausgleiten — heute ist fertig |
| Zahlt sofort, zahlt am … | Karte bleibt, gedämpft und markiert — Geld wird erwartet |

Das Ausgleiten dauert 900 ms. Ein Verschwinden ohne Rückmeldung fühlt sich wie ein Fehler an; der Agent soll **sehen**, dass sein Klick angekommen ist.

**Eine grüne Leiste sagt, wohin sie gegangen sind:** „90 warten auf ihren Termin — nicht erreicht, sie haben den Buchungslink und wählen selbst eine Uhrzeit. Ruf sie nicht erneut an."

Sie stand zuerst **unter** der Liste. Bei 937 Kunden sieht das niemand — gemessen: Der Zähler stand mit „90" im Dokument, im Bild war er nicht. Eine Auskunft, die man erst nach 937 Karten findet, ist keine.

### Der Kalendereintrag, den es nicht gab

Der Vorgesetzte: *„Wenn er dann den Termin bucht, hat der Agent einen Kalendereintrag!"*

**Hatte er nicht.** Die Kalender-Route las ausschließlich `fiaon_contact_log` — also nur, was ein Agent selbst eingetragen hat. Die Termine, die ein Kunde über seinen Buchungslink wählt, stehen in `fiaon_termine` und tauchten im Agenten-Kalender **nicht** auf.

Die Wirkung war die schlimmste Art von Lücke: Der Kunde bekam eine Bestätigung mit Uhrzeit, hielt sie ein — und der Agent wusste nichts davon. **Ein Termin, von dem nur eine Seite weiß, ist kein Termin.**

Jetzt stehen sie im Kalender, mit grüner Marke „Kunde hat gebucht" — verbindlicher als eine Notiz, die sich der Agent selbst gemacht hat. Verschieben geht nicht: Der Kunde hat die Zeit gewählt, und eine Verschiebung hinter seinem Rücken wäre ein Wortbruch.

### Was Sie noch tun müssen

**Hans-Jürgen Gerhold hat die Verpflichtungserklärung noch nicht angenommen.** Der Bereich ist verschlossen — die Wand funktioniert. Er muss sich einmal anmelden und die Erklärung annehmen; ich habe sie im Test **nicht** angenommen (`AGENTS.md`, Vorfall vom 06.08.2026).

Danach: Team-Zentrale → Inkasso-Zuteilung → „29 verteilen".

### Ein Zeitzonen-Fehler in meinem eigenen Prüfstand

Der Filter „Nächste 7 Tage" wurde rot, obwohl er richtig arbeitete. Mein Vergleich lautete `new Date(faellig_am) >= new Date(new Date().toISOString().slice(0,10))` — **`toISOString()` ist UTC**, `faellig_am` ein Datum in Berliner Rechnung. Genau der Fehler, vor dem `AGENTS.md` warnt, in meinem eigenen Prüfstand.

Die Prüfung läuft jetzt in SQL, wo `CURRENT_DATE` per Definition stimmt.

### Prüfstand

`pruef-rueckstand` von 155 auf **184**. Drei Gegenproben: Fristgrenze entfernen (findet die 153 wieder), Wiedervorlage ignorieren, Karte stehen lassen — jede wird rot. Gesamt **2.072**, alle grün.

## 11.08.2026 (XI) — `register()` war der Fehler, die Liste hält still, Inkasso-Zuteilung

### Der Anruf: mein eigener Fehler von heute Morgen

Diagnose-Schritt 10 zeigte es: *„bei register: ohne Name, Rohfassung: undefined."*

Ich hatte heute Morgen `await d.register()` ergänzt, in der Annahme, das mache den Aufbau verlässlicher. **Es machte ihn kaputt.**

`Device.register()` meldet das Gerät für **eingehende** Anrufe an. Der Ausweis, den FIAON ausstellt, trägt aber ausdrücklich `incomingAllow: false` — im Browser soll es nicht klingeln, eingehende Rufe laufen extern.

Eine Anmeldung für Eingang auf einem Ausweis **ohne** Eingangsrecht scheitert. Und zwar mit einem leeren Fehler: Der geworfene Wert war buchstäblich `undefined`. Genau das stand in Schritt 10.

Für einen ausgehenden Anruf ist `register()` nicht nötig — `connect()` baut die Verbindung selbst auf. Es ist heraus.

**Die Lehre:** Eine Absicherung, die man einbaut, ohne zu prüfen, ob sie zum Rest passt, ist keine Absicherung.

Ohne diesen Diagnoseschritt hätte ich weiter geraten. Er hat sich beim ersten Einsatz bezahlt.

### Die Arbeitsliste hält still

Ein Agent: *„Wenn ich bei jemandem ‚zahlt sofort' oder ‚nicht erreicht' drücke, rutscht er einfach 2–3 Leute runter — komme so echt durcheinander."*

Ursache: Die Liste sortiert nach `promised_payment_date` und `follow_up_date` — **genau den Feldern, die ein Ergebnis setzt**. Nach dem Buchen wurde die ganze Liste neu geholt, und der Kunde ordnete sich selbst weg.

Das ist kein Sortierfehler, sondern ein Denkfehler: Wer eine Liste von oben nach unten abarbeitet, braucht eine Liste, die stillhält.

Jetzt holt das Buchen **nur die Zähler**. Die Karte bleibt an ihrer Stelle — gedämpft, mit Marke „Ergebnis gebucht". Gedämpft und **nicht durchgestrichen**: Der Kunde ist nicht abgehakt, sein Ergebnis ist gebucht. Man muss ihn vielleicht gleich noch einmal ansehen.

Neuordnen ist ein eigener Schritt: „3 Ergebnisse gebucht — die Reihenfolge ist absichtlich stehen geblieben, damit du deine Zeile behältst."

**Gemessen im Browser:** 300 Karten, nach dem Buchen dieselbe Reihenfolge, eine Karte markiert.

### Inkasso-Zuteilung

Die Frage: *„Hans-Jürgen Gerhold ist unser Inkasso-Mitarbeiter — wie teile ich ihm Kunden zu? Wir bekommen noch 1–2 weitere."*

Die Antwort: **normalerweise gar nicht.** Neuer Reiter in der Team-Zentrale, und die Verteilung läuft **lastgerecht** — wer weniger offene Fälle hat, bekommt mehr neue. Nach jeder Zuteilung wird neu sortiert, damit sich ein Rückstand von selbst ausgleicht statt zu verfestigen.

**Zugeteilt wird eine RATE, nicht ein Kunde.** Ein Kunde hat zwölf Raten; wenn Rate 3 überfällig ist und Rate 7 später auch, muss nicht derselbe Mensch dran sein — er ist vielleicht im Urlaub oder nicht mehr da.

Die Vorschau zeigt jede Rate mit Kunde, Referenz, Tagen überfällig, Betrag und Empfänger. **Ohne `schreiben` passiert nichts.** Beim Verteilen sichert `inkasso_agent_id IS NULL` gegen zwei gleichzeitige Läufe ab.

**Gemessen:** 29 überfällige Raten warten, alle würden zu Hans-Jürgen gehen.

### Mitarbeiter-Zugang auf der Website

Dezent in der Fußzeile, neben dem Systemstatus — nicht in der Hauptnavigation. Ein Kunde, der „Mitarbeiter-Login" oben im Menü sieht, fragt sich, ob er hier richtig ist. Wer den Zugang braucht, sind zehn Menschen, die ihn kennen.

Keine Nennung von „Agent" oder „Vertrieb": Die Fußzeile einer Kundenseite soll nicht verraten, wie das Haus innen gebaut ist.

### Zwei eigene Prüffehler

1. **Mein Test klickte den Filter-Chip** „Nicht erreicht 72" statt des Ergebnis-Knopfes in der Karte. Die Liste lud neu, und ich hielt das für das Springen.
2. **Meine Attrappe fing die falsche Adresse ab** — `kontakt-ergebnis` gibt es nicht, die Route heißt `/agent/crm/kunden/:id/aktivitaet`. Der echte Aufruf ging durch und hätte fast ein echtes Ergebnis geschrieben. Nur weil die Antwort nicht zur Attrappe passte, fiel es auf.

### Und ein Verstoß gegen meine eigene Regel

`pruef-veredelung` prüfte „gleich viele Provisionen wie vorher" und war rot: 346 statt 344. **Zwei Provisionen sind während des Laufs entstanden** — echte Kunden haben gezahlt.

`AGENTS.md` sagt es selbst: *Global nur „darf nicht schrumpfen", je Einheit exakt.* Ich habe gegen meine eigene Regel geprüft. Jetzt wird die eigene Zeile namentlich gesucht.

### Prüfstand

`pruef-rueckstand` von 124 auf **155**, `pruef-space4` auf **110**. Sechs Gegenproben: `register()` wieder einbauen, Liste springen lassen, Nebenläufigkeits-Schutz entfernen, Vorschau schreiben lassen, Mikrofon-Anfrage entfernen, leeren Wurf ohne Aussage — jede wird rot. Gesamt **2.043**, alle grün.

## 11.08.2026 (X) — Warum der Anruf nicht startete: zwei Fehler, beide gemessen

### Der Befund

Im Panel stand: *„Das Telefon konnte nicht starten, und der Fehler nennt keinen Grund."* Das ist mein eigener Rückfalltext für ein Fehlerobjekt, in dem nichts Brauchbares steht.

Ich habe den Fall **im Browser reproduziert** — mit einem Testlauf, der einen erfundenen Zugangsausweis unterschiebt. Genau dieselbe Meldung. Und dann sichtbar gemacht, was tatsächlich geworfen wurde:

```
wo=connect  name=null  code=null  message=null  roh=undefined
```

**Der geworfene Wert war buchstäblich `undefined`.** Kein Objekt, keine Nachricht, nichts.

### Ursache 1: Das Mikrofon wurde nie angefragt

Im ganzen Panel gab es **keinen einzigen `getUserMedia`-Aufruf**. Das Mikrofonrecht wurde nie erbeten. Twilios `connect()` fragt es intern nach — und wenn der Nutzer es nie erteilt hat, wirft das SDK einen Fehler, der je nach Browser und Fassung leer sein kann.

Jetzt steht das Mikrofon als **eigener Schritt ganz oben** im Panel, sichtbar auch dann, wenn Twilio noch nicht eingerichtet ist. Wer das Panel öffnet, erteilt das Recht, während er den Kunden sucht — nicht in der Sekunde, in der er anrufen will.

**Sieben Fälle in Klartext.** Der tückischste ist `NotSupportedError`: Er heißt fast immer „keine https-Verbindung", und niemand käme von dem Wort auf diese Ursache. Jetzt steht es da, mit dem tatsächlich verwendeten Protokoll in der Meldung.

### Ursache 2: Der echte Grund wurde verschluckt

Meine eigene Fassung von heute Morgen lautete:

```js
await d.register().catch((e) => { console.warn(e); void fehlerMelden("register", e); });
```

Der Registrierungsfehler wurde gemeldet — und der Ablauf ging **weiter**. Danach schlug `connect()` fehl, mit dem leeren Wurf. Der echte Grund war weggeworfen.

Er lautet: **`AccessTokenInvalid (20101)` — Twilio konnte den Zugangsausweis nicht prüfen.** Der Code stand in meinem Katalog, mit Handgriff: „Der API-Key gehört nicht zu diesem Twilio-Konto, oder das Secret stimmt nicht."

Ein weggeschluckter Fehler ist schlimmer als ein abgebrochener Versuch: Er verlegt den Schaden an eine Stelle, die ihn nicht erklären kann.

Jetzt bricht die Registrierung ab, und **eine Meldung mit Twilio-Code hat Vorrang** vor jeder Vermutung.

### Und wenn doch nichts drinsteht

Ein leerer Wurf ist eine eigene Aussage. Statt „nennt keinen Grund" stehen die drei Ursachen da, nach Häufigkeit sortiert: eine Firewall, die WebRTC blockt (UDP 10000–20000), ein abgelehnter Ausweis, eine alte Fassung im Browser.

### Der zehnte Diagnoseschritt

Die Diagnose prüfte neun Stellen — alle auf dem Server. Der zehnte Ort ist der Browser des Nutzers, und dort konnte ich aus der Ferne nie hineinsehen.

Jetzt meldet der Browser jeden Telefonfehler an den Server: Name, Code, Nachricht, Beschreibung, Ursachenkette, Browserkennung und die Rohfassung. **Schritt 10 zeigt es** — und erkennt ein Mikrofonproblem als solches („das ist ein Mikrofonrecht, kein Telefonfehler") sowie iPhone und iPad eigens.

### Eine Prüfung, die die Welt überholt hat

`pruef-veredelung` prüfte: „Niemand sitzt auf Onboarding oder Inkasso." Sie war rot.

Nachgesehen: **Hans-Jürgen Gerhold wurde am 10.08. um 09:01 angelegt** — Passwort um 09:02, drei Einwilligungen, Vertrag um 09:06 unterschrieben. Ein vollständiges, echtes Onboarding auf `inkasso`. Die Rolle ist zu Recht besetzt.

Der eigentliche Punkt war nie „diese Rollen müssen leer bleiben", sondern **„niemand wird ohne Auftrag versetzt"**. Genau das prüft die Gruppe jetzt: Wer eine Sonderrolle trägt, braucht einen unterschriebenen Vertrag oder einen protokollierten Rollenwechsel. Wer ohne beides dort sitzt, wurde per direktem SQL dorthin gesetzt — und das war mein Fehler bei Nikita.

### Prüfstand

`pruef-space4` von 90 auf **108 Prüfungen**. Drei Gegenproben: Mikrofon-Anfrage entfernen, Registrierungsfehler verschlucken, leeren Wurf ohne Aussage lassen — jede wird rot. Gesamt **1.984**, alle grün.

## 11.08.2026 (IX) — Der Rückstand abgearbeitet: Aufsicht, Pipeline, Cockpit, Abrechnungen

### Aktivität — was die Leitung tut

Neuer zweiter Reiter in der Team-Zentrale. **Keine neue Tabelle:** `fiaon_agent_events` sammelt seit Monaten alles, 8.900 Zeilen. Eine zweite daneben wären zwei Wahrheiten über dasselbe.

Was fehlte, war nicht die Erfassung, sondern die **Sicht**: Aus 8.900 Zeilen, von denen 7.100 automatische Massenläufe sind, die zwanzig herausbekommen, bei denen ein Mensch etwas Schwerwiegendes getan hat.

**Der Katalog ist die eigentliche Arbeit.** 40 Aktionen in drei Stufen — sensibel (unumkehrbar, Geld, Zugang, Verantwortung), beachten, Notiz. Bewusst eine Liste und keine Regel: „alles mit `delete` im Namen" übersieht `person_merge` und `antrag_archiviert` und fängt `leads_verteilen_08082026` mit ein.

**Die Namen sind nachgesehen, nicht erfunden.** Mein erster Katalog enthielt `kunde_geloescht`, `zahlung_gebucht`, `zugang_gerettet`, `einmal_passwort` — **keiner dieser Typen existiert**. Die Wirklichkeit heißt `geloescht_endgueltig`, `vertrieb_zahlung_gebucht`, `zugang_setzlink`, `zugang_einmalpasswort`.

Ein Katalog aus erfundenen Namen hätte eine **leere** Liste ergeben — und die sieht aus wie „es ist nichts passiert". Das ist der schlimmste Fehler, den eine Aufsicht machen kann.

Der Lösch-Zähler zählt die **Woche**, nicht den Tag: „0 Löschungen heute" sagt nichts, weil an den meisten Tagen nichts gelöscht wird. Er ist selbst ein Filter.

### Gesprächs-Pipeline

**Die Twilio-URL gehört nie ins Frontend.** Sie ist unbefristet gültig und öffnet mit den Konto-Zugangsdaten die Aufnahme eines Kundengesprächs. Wer sie einmal aus dem Netzwerkprotokoll kopiert, kann das Gespräch morgen noch abspielen — auch ohne Zugang.

Neu: Die Aufnahme wird serverseitig geholt und durchgereicht. Rechteprüfung vor dem Abruf, kein Zwischenspeichern, und **wer zuhört, steht im Kundenverlauf**.

**Die Statuskette.** Vorher stand in der Akte entweder eine Zusammenfassung oder nichts. „Nichts" konnte **dreierlei** bedeuten: keine Aufnahme, Transkript läuft, KI gescheitert — drei Lagen, drei Handgriffe, kein sichtbarer Unterschied. Jetzt: aufgezeichnet → transkribiert → zusammengefasst, mit Punkt und Klartext-Hinweis.

**Aufbewahrungsfrist, 90 Tage.** Eine Gesprächsaufnahme ist die intimste Art von Kundendaten, die dieses Haus speichert. Der Lauf löscht **bei Twilio**, nicht nur die URL — eine vergessene URL ist keine Löschung. Schlägt Twilio fehl, wird **nicht** als gelöscht vermerkt; der nächste Lauf versucht es erneut. Transkript und Zusammenfassung bleiben: Sie sind das Arbeitsergebnis, die Aufnahme das Rohmaterial.

### Vertriebsleitungs-Cockpit

Sieben Reiter: Lage, **Zugang**, **Zahlung**, **Verwaltung**, Stammdaten, Verlauf, Zuweisungen. Jede Route existierte schon oder ruft die bestehende Logik auf.

„Anrufen" öffnet jetzt das **Softphone mit Kundenkontext** statt eines `tel:`-Verweises — auch in der Liste. Der Unterschied ist nicht Bequemlichkeit: Nur so landet das Gespräch mit Aufnahme, Transkript und Ergebnis in der Akte.

**Zugang:** Der häufigste Anruf ist „ich komme nicht rein" — dahinter stecken vier Lagen. Die neue Diagnose nennt den Befund **mit dem passenden Weg dahinter** und erkennt ein noch laufendes Einmal-Passwort (dann soll man das alte vorlesen).

**Zahlung:** Ein Belegfeld statt eines Häkchens. Wenn später jemand fragt „warum steht der auf bezahlt", muss die Antwort in der Akte stehen.

**Löschung:** Anonymisiert **alle** Bestellungen der Person — eine halb gelöschte Person ist keine gelöschte Person. Rechnungen und Zahlungen bleiben. Massenlöschung bleibt dem Vorgesetzten.

**Rechte-Matrix gemessen:** Acht Wege, zwei Rollen. Der Agent wird bei **allen acht** verweigert. Mit echten Tokens gegen den laufenden Server, ohne einen einzigen Schreibvorgang.

### Abrechnungen und Firmierung

Firmenname, Anschrift, Company No. und **der Steuerhinweis** standen hart im Code. Beim Umzug hätte jemand eine TypeScript-Datei ändern müssen — für eine Hausnummer. Schlimmer beim Steuerhinweis: Sein Wortlaut kommt vom Steuerberater, und ein Text, den nur ein Entwickler ändern kann, wird nicht geändert — er bleibt falsch stehen.

Jetzt pflegbar, mit Vorgabe im Code als letzte Verteidigungslinie. Ein leeres Feld fällt **einzeln** zurück: Wer nur die Anschrift gepflegt hat, verliert nicht den Steuerhinweis.

**Neu-Erzeugung ändert nur die Form.** Positionen, Summen, Abrechnungsnummer und Original-Erstellungsdatum bleiben — sie werden nicht neu gerechnet. Eine Abrechnung, deren Summe sich beim Neu-Erzeugen ändern könnte, wäre kein Dokument, sondern eine Momentaufnahme.

### Gemeinsame Blasen-Klassen

`client/src/styles/fiaon-blase.css`: Radius 28, Glas 20 px, Fläche 72 % Weiß, Haarlinie oben, zweistufiger Blau-Schatten — als **Variablen**. Space und Mail-Zentrale nutzen dieselben. Kopieren hätte bedeutet, sie beim nächsten „Radius etwas kleiner" an zwei von drei Stellen zu ändern.

### Drei eigene Fehler

1. **Die Spalte heißt `password`, nicht `password_hash`.** Die Diagnose warf HTTP 500.
2. **Backticks in einem SQL-Kommentar** — sie beenden das Template-Literal, und der Serverstart hing **still**. Vierter Fall desselben Fehlers.
3. **Ein JSX-Kommentar innerhalb von `&& (`** ist kein Kommentar, sondern ein Ausdruck.

### Zwei Prüfungen, die nicht rot werden konnten

Die Gegenprobe deckte auf:

- Die Prüfung „kein erfundener Ereignistyp" durchsuchte **alle** Serverdateien — auch die Katalogdatei selbst. Ein Zirkelschluss: Sie fand sich selbst.
- Die Prüfung „Rechte vor dem Datenstrom" suchte ab dem Routenanfang. „Nicht dein Kunde" kommt mehrfach vor; der Treffer stammte aus einer **anderen** Route.

Beide korrigiert. Und die geschärfte Prüfung fand einen echten Mangel: `ansicht_gestartet` wurde als `ansicht_${was}` zusammengesetzt und war im Quelltext nicht suchbar. Jetzt ausgeschrieben — wer einen Typ sucht, muss ihn finden können.

### Prüfstand

`scripts/pruef-rueckstand.ts` — **124 Prüfungen**. Sieben Prüfungen in drei anderen Prüfständen maßen Werte, die in die gemeinsame Blasen-Datei gewandert sind, und wurden nachgezogen. Gesamt **1.964**, alle grün.

## 11.08.2026 (VIII) — Der Anruf: `callerId=""`. Space v5 nach Spezifikation. Mail-Bug behoben.

### Warum der Anruf nicht durchkam

Ich habe die TwiML-Route so aufgerufen, wie Twilio es tut — von außen, urlencoded, ohne Cookie. Die Antwort:

```xml
<Dial callerId="" timeout="30" …>
  <Number>+4930123456789</Number>
</Dial>
```

**Die Zielnummer kam an. Die Absendernummer war ein leeres Attribut.** Twilio lehnt einen `<Dial>` ohne gültige `callerId` ab — bei einem Browser-Anruf muss sie eine Nummer sein, die dem Konto gehört oder als Caller ID verifiziert ist. Nach außen sah die Antwort wohlgeformt aus; im Log stand ein Abbruch ohne erkennbaren Grund.

`TWILIO_CALLER_ID` fiel stillschweigend leer durch. Jetzt prüft `twimlAusgehend()` drei Dinge und **sagt** das Ergebnis:

- Fehlt die Absendernummer → Ansage „im System ist keine Absendernummer hinterlegt", dann auflegen
- Ist sie nicht international geschrieben → Ansage nennt genau das
- Fehlt die Zielnummer → „bitte die Seite neu laden"

Eine Ansage, die den Grund nennt, ist unendlich viel besser als ein Ruf, der still verschwindet.

**Diagnose-Schritt 9 „Probeantwort an Twilio"** zeigt die erzeugte Antwort. Die Schritte 1 bis 6 prüfen Einstellungen — dieser hier zeigt, was Twilio wirklich bekommt. Genau so wurde der Fehler gefunden.

### Mail: die getippte Adresse ging verloren

Adresse eintippen, auf Senden — „kein Empfänger". Der Text stand sichtbar im Feld und wurde ignoriert, weil er nie zum Chip geworden war.

Ein Feld, das den eigenen Inhalt beim Absenden nicht mitnimmt, ist eine Falle. Jetzt übernimmt es bei **Enter, Komma, Semikolon, Verlassen des Feldes und beim Senden**. Ein Tippfehler bekommt einen Hinweis **am Feld** — nicht am Seitenkopf, denn dorthin schaut niemand.

Und: Die Vorschau stürzte die ganze Seite ab, wenn die Empfängerliste in unerwarteter Form kam (`empfaenger.map is not a function`). Ein Prüflauf hat das ausgelöst; in Produktion wäre es ein weißer Bildschirm gewesen.

**OpenAI-Livestatus:** Der Schlüssel liefert weiterhin **HTTP 401**. Alle drei Fälle nennen jetzt den Grund: „fehlt der Schlüssel", „antwortete mit HTTP 401", oder der Entwurf.

### Space v5 — Spezifikations-Abgleich

Neunzehn Werte am gerenderten Element gemessen, alle erfüllt:

| Punkt | Gefordert | Gemessen |
|---|---|---|
| 1 | Verlauf Weiß→CI-Hellblau, kein Navy | Verlauf |
| 1 | keine Sternkörnung | keine |
| 1 | Video sichtbar | Deckkraft 0,75 |
| 2 | Radius 28 | 28 px |
| 2 | Glas blur 20 px | blur(20px) |
| 2 | Fläche 72 % Weiß | rgba(255,255,255,0.72) |
| 2 | Innenabstand 24 | 24 px |
| 2 | Avatar 44 | 44 px |
| 3 | Kennmarke mit Verlauf | ja |
| 3 | Systemavatar navy | ja |
| 4 | Veröffentlichen mit Verlauf | ja |
| 4 | Komposer wächst beim Fokus | ja |
| 5 | Feed 720 mittig | 720 px |
| 5 | Profil-Avatar 72 | 72 px |
| 6 | Pin-Leiste ≤ 56 px | 40 px |
| 7 | ≥32 px Luft unter Kopfzeile | 129 px vom Rand |
| 7 | 20 px zwischen Blasen | 20 px |

**Zwei begründete Abweichungen:**

1. **Die Pin-Leiste steht einzeilig, nicht untereinander.** „Max 2 Pins" und „nie mehr als 56 px hoch" gehen zusammen nur, wenn beide Titel *nebeneinander* liegen — zwei Zeilen ergaben gemessen 94 px. Aufgeklappt wechselt sie in die Spaltenform, weil der Inhalt die Breite braucht.
2. **Auf 380 px sind die Blasen randnah (12 px), nicht randlos.** Das entspricht Punkt 5 der Spezifikation; der Radius sinkt dort von 28 auf 22, weil eine 28er-Rundung bei 356 px Innenbreite fast die halbe Kartenhöhe einnimmt.

**Ein echter Fund beim Abgleich:** Die Kennmarken trugen eine Inline-Farbe (`#64748b`, `#059669`) aus der Zeit, als sie keine Fläche hatten. Auf dem neuen blauen Verlauf war „GEDANKE DES TAGES" praktisch unlesbar. Jetzt weiß per `!important` — die Hausregel gilt auch für Marken, nicht nur für Knöpfe.

**Warum v4 dunkel war:** Der Gedanke war eine „Premium-Bühne", die den Feed vom hellen Rest abhebt. Zwei Fehler darin: Die deckende Fläche verdeckte das Video vollständig, und Dunkel ist für einen Feed die falsche Richtung — hier liest man Sätze, keine drei Zahlen. V5 macht es umgekehrt: Das Video ist die Bühne, dunkel bleibt genau ein Element.

### Vertriebsliste entzerrt

Name, Rollenmarke und vier Zahlen standen in **einer** Zeile; auf 380 px brach der Name mitten im Wort um die Marke. Jetzt zwei Zeilen, der Name wird gekürzt statt umgebrochen (ein abgeschnittener Name ist lesbar, ein zwischen Wortteilen umgebrochener nicht), Zahlen als beschriftete Paare, auf 380 px als 2×2-Raster. Gemessen: **kein Namensumbruch**, maximale Namenshöhe 21 px.

Der Telefonknopf steht 12 px über der Kante, und die Chips-Leiste lässt rechts 82 px frei — gemessen per Bounding-Box: **keine Überdeckung**.

### Menü

Space · Start · Kunden · **Mail** · Aufgaben · Kalender · Verdienst. Es gibt nur **eine** Definition — mobil und Desktop teilen sie.

### Prüfstand

`scripts/pruef-space5.ts` — **87 Prüfungen**. Sechzehn Prüfungen in `pruef-space4` und `pruef-feinschliff` maßen v4-Werte und wurden nachgezogen. Gesamt **1.840**, alle grün. Drei Gegenproben: leeres `callerId`, Senden ohne Übernahme, Inline-Farbe auf der Kennmarke.

## 11.08.2026 (VII) — Telefon-Richtlinie, das Gerät, und ein Zeitzonenfehler in der Nacht

### Zuerst: zwei Nachtstunden ohne Umsatz

Beim Bauen fiel der Prüfstand um 00:31 Berliner Zeit auf die Nase:

```
FAIL  Beitrag ist der Auftragswert  → ist 0, soll 20000
```

Eine Provision, die eine Sekunde vorher gebucht worden war, zählte nicht. Ursache:

```sql
c.created_at >= date_trunc('day', ${datum}::date)
```

`datum` kam aus `berlinToday()` und war korrekt. Aber `date_trunc('day', '2026-08-10'::date)` ergibt einen Zeitstempel **ohne Zonenbezug**, und Postgres vergleicht ihn gegen ein `timestamptz`, als wäre er UTC. Das Fenster lag damit von **02:00 bis 02:00 Berliner Zeit**.

Folge: Jede Nacht zwischen Mitternacht und zwei Uhr zeigte die Wirtschaftlichkeit für **jeden** Mitarbeiter null Umsatz, null Abschlüsse und kein „gedeckt ab". Kein Absturz, keine Meldung — nur falsche Zahlen, zwei Stunden lang, jeden Tag. Die Art Fehler, die niemand bemerkt, weil um Mitternacht keiner hinsieht.

Neu: `server/lib/fiaon-tagfenster.ts` spannt Tages- und Monatsfenster in Berliner Zeit auf und übergibt echte Zeitpunkte. Der Sommer-/Winterversatz kommt aus der Zeitzonendatenbank, nicht aus einem festen `+02:00` — das wäre die Hälfte des Jahres falsch, und zwar in der Hälfte, in der niemand daran denkt. Sieben Abfragen umgestellt, auch die Tagesgruppierung im Verlauf.

`AGENTS.md` sagt: Zeitzone über `fiaon-time.ts`, nie über rohe Datumsarithmetik. Die Regel stand da — die Abfrage hielt sich nicht daran, weil es auf der SQL-Seite passierte.

### Die Telefon-Richtlinie

Ein Softphone in fremden Händen ist zweierlei: eine Kreditkarte und ein Aufnahmegerät. Das Zweite ist gefährlicher. Wer ein Gespräch aufzeichnet, ohne den anderen zu informieren, verletzt **§ 201 StGB** — und zwar persönlich, nicht die Firma.

Deshalb ist die Richtlinie eine **Zusage mit Nachweis**, kein Hinweistext:

- **Sechs Zusagen** in Klartext: Hinweis vor dem Gespräch, Widerspruch beendet die Aufzeichnung sofort, Rechtsgrundlage (§ 201 StGB und Art. 13 DSGVO), nur wer im System steht, Aufnahmen wie Kundenakten, Verstoß ist ein Disziplinarfall.
- **Keine Kaltakquise, keine privaten Anrufe** stehen ausdrücklich unter „was nicht geht".
- **Annahme mit getipptem Namen und Haken**, festgehalten mit Zeitpunkt, Fassung, IP und Browserkennung — dieselbe Maschinerie wie die Verpflichtungserklärung, inklusive Roboter-Wand.
- **Das Wählen ist serverseitig gesperrt**, bis sie angenommen ist. Der abgelehnte Versuch steht im Wahlprotokoll.
- Fußnote: „Fassung 1.0 — zur Prüfung durch die Rechtsberatung freigegeben."

**„Ohne Aufzeichnung fortsetzen":** Widerspricht der Kunde, stoppt ein Knopf im Gespräch die Twilio-Aufnahme sofort. Der Vermerk am Anruf wird **auch dann** gesetzt, wenn Twilio nicht erreichbar ist — der Wille des Kunden ist festgehalten, selbst wenn die Technik klemmt.

**Der Pflichtsatz steht über dem Anrufknopf**, nicht im Kleingedruckten: „Dieses Gespräch wird zur Qualitätssicherung aufgezeichnet — sind Sie damit einverstanden?" Änderbar in den Einstellungen, aber nie leer.

**Aufbewahrungsfrist:** 90 Tage als Vorgabe, Spalten für Löschzeitpunkt angelegt.

### Das Gerät

Das Telefon lag als Ebene rechts unten am Rand. Jetzt ein zentriertes Gerät, ganz aus CSS und SVG — scharf auf jeder Auflösung, in den CI-Farben, ohne ein einziges Bitmap:

**Vier Schichten:** Titanrahmen als Verlauf (oben Licht, unten Schatten — so verhält sich Metall), Kantenlicht innen, vertieftes Displaybett im CI-Navy, und ein Glasreflex bei **sechs Prozent** — mehr ist ein Effekt, weniger ist unsichtbar. Dazu Dynamic-Island-Aussparung, vier angedeutete Seitentasten und eine 3D-Neigung beim Öffnen.

**Die Wähltastatur** mit Buchstabenzeile (2 ABC, 7 PQRS). Die Buchstaben sind nicht Nostalgie: Sie sind der Grund, warum die Tasten unterschiedlich aussehen und man sie blind findet. Beim Drücken sinkt die Taste ein und der Schatten darunter verschwindet.

**Kundensuche im Display:** Man ruft einen Menschen an, nicht eine Nummer. Die Suche liegt im Sichtfeld der Rolle — wer nur eigene Kunden betreut, findet auch nur eigene.

**Auf 380 px gibt es keinen Gerätekörper.** Dort *ist* das Gerät das Gerät; ein gezeichnetes Telefon im Telefon wäre albern und würde den Platz halbieren. Stattdessen ein Bottom-Sheet mit Wischgriff — und einer Schwelle von 110 px, damit es nicht bei jedem Scrollversuch zugeht.

### Ein Fehler, der die Seite weiß machte

Meine zwei neuen `useEffect` standen hinter `if (!stand) return null`. React zählt dann in zwei Durchläufen unterschiedlich viele Hooks und bricht ab: „Rendered more hooks than during the previous render." Der Browsertest hat es sofort gezeigt — ein Quelltext-Grep hätte es nie gefunden.

### Prüfstand

`scripts/pruef-space4.ts` — **90 Prüfungen**. Die Wand wird **direkt aufgerufen**, nicht über die Route: Die Route prüft zuerst die Twilio-Einrichtung und antwortet ohne Zugangsdaten mit 503, die Richtlinie kommt dann nie an die Reihe. Genau daran ist mein erster Prüfversuch gescheitert.

Drei Gegenproben: Wand entfernen (3 rot), reservierten `To`-Parameter zurückholen (1 rot), Pflichtsatz unter den Knopf schieben (1 rot).

Gesamt **1.743 Prüfungen**, alle grün.

## 11.08.2026 (VI) — Der Telefonfehler gefunden, richtiges Bankkonto, „Vorgesetzter", Space auf volle Breite

### Warum die Diagnose grün war und telefonieren trotzdem nicht ging

Der Vorgesetzte hat den entscheidenden Hinweis geliefert: **Im Twilio-Log ist die „To"-Spalte bei Browser-Anrufen leer.**

Ursache: **`To` ist bei Twilio ein reservierter Parameter.** `Device.connect({ params: { To: … } })` sieht richtig aus — Twilio setzt `To` bei Browser-Anrufen aber selbst auf die Client-Identität (`client:agent-2`) und **überschreibt dabei den eigenen gleichnamigen Parameter**. Die TwiML-Antwort bekam eine leere Nummer und konnte nichts wählen.

Keine Konfigurationsprüfung findet das — die Konfiguration war ja in Ordnung. Deshalb sendet der Browser jetzt `An` (nicht reserviert), und die TwiML-Route liest in dieser Reihenfolge: `An`, `Ziel`, `PhoneNumber`, zuletzt `To`.

**Neu: Diagnose-Schritt 8 „Letzter Anruf: übergebene Rufnummer".** Die TwiML-Route schreibt auf, was Twilio tatsächlich übergeben hat. Das ist die Zeile, die die Ursache zeigt — die Schritte 1 bis 6 prüfen nur, ob die Einstellungen stimmen.

**Und ein zweiter Fehler im Geo-Schritt:** Er fragte `/Accounts/…/Voice/DialingPermissions/…` — diese API liegt auf `voice.twilio.com/v1`, nicht auf `api.twilio.com/2010-04-01`. Das HTTP 404 sah wie „keine Auskunft" aus, war aber unsere falsche Adresse. Jetzt werden **DE, AT und CH einzeln** geprüft; „Deutschland geht" sagt nichts über Österreich.

### Das richtige Bankkonto

In den Zahlungsanweisungen stand „Schwarzott Global" mit einem österreichischen Konto. Richtig ist und war immer:

**FIAON LTD · BE09 9058 9276 3957 · TRWIBEB1XXX**

Korrigiert an der einen Stelle, die es gibt (`fiaon-zentrale.ts`) — sie speist jede Mail, jede Rechnung und den Kontoabgleich.

### „Betreiber" heißt jetzt „Vorgesetzter"

**381 Vorkommen in 120 Dateien.** Ein blindes Ersetzen hätte falsches Deutsch ergeben („Der Vorgesetzten hat entschieden"), deshalb fallgerecht: `des Betreibers` → `des Vorgesetzten`, `der Betreiber` → `der Vorgesetzte`, `dem/den Betreiber` → `dem/den Vorgesetzten`, allein stehend → `Vorgesetzter`.

**15 Stellen bleiben bewusst stehen:** `fuerBetreiber` ist eine Datenbankspalte, und im Impressum ist „**Betreiberin** der Plattform" die Rechtsbezeichnung der FIAON LTD — nicht der Vorgesetzte.

### Space: volle Breite, Video sichtbar, echte Zahlen

**Das Video ist jetzt auf jeder Seite zu sehen.** Die dunkle Bühne war deckend und verdeckte es vollständig; sie ist jetzt eine **Tönung** (82–90 % statt 100 %), und die helle Wäsche des Raums wird im Space abgeschaltet — zwei Wäschen übereinander ergäben Grau. Videostärke von 55 % auf 75 % (Stufe „Mittel").

**Feed von 760 auf 900 px.** Dabei drei gemessene Hürden:

1. `minmax(0, 900px)` mit `justify-content: center` — das Raster bemisst die Spuren nach ihrem Inhalt statt nach dem Platz. Gemessen: **376 px** statt 900.
2. Die Team-Hülle rendert `max-w-6xl` = **1152 px** um den Inhalt. Der Space konnte darin nie breiter werden.
3. Der Verwaltungsbereich verliert 240 px an seine Seitenleiste. Bei 1440 verfügbarer Breite passten `300 + 900 + 300` plus Abstände (1604) nicht — die Mitte schrumpfte auf **736 px**. Die Seiten sind jetzt 260 px, drei Spalten gibt es erst ab 1780 px Fenster.

**Die Seitenspalten sind ersetzt.** Dort standen zwei Karten ohne eine einzige Zahl: „HEUTE · Sonntag, 9. August · Was hier steht, kommt aus echten Zahlen" und „DER RAUM: keine Kundendaten hier" — die Hausordnung, die schon am Schreibfeld steht. Jetzt echte Tageszahlen je Rolle:

- **Team:** Verdienst Monat, Kontakte heute, Stufe A offen
- **Vorgesetzter:** Umsatz heute, Zahlung angekündigt, Kontakte heute, Mails gescheitert

Auf schmalen Geräten stehen sie als Kachelreihe über dem Feed. Die Zahlen sind mit einem feinen Verlauf gesetzt — geprägt, nicht getippt.

### Prüfstände

Fünf Prüfungen maßen Werte, die dieses Paket bewusst geändert hat (Spaltenbreiten, Bühnenfarbe, der `To`-Parameter, eine Fehlermeldung nach der Umbenennung) — alle nachgezogen. **1.653 Prüfungen**, alle grün.

Und dreimal derselbe eigene Fehler: Backticks in einem Kommentar innerhalb eines Template-Literals. `AGENTS.md` warnt davor, und ich bin trotzdem dreimal hineingelaufen.

## 11.08.2026 (V) — „Alle prüfen" wirklich, der KI-Entwurf landet im Feld, Space v4

### Warum „Alle prüfen" beim ersten Mal nicht ankam

Der Betreiber hat es zum zweiten Mal beauftragt. Ursache:

**Die Server-Route war fertig, es gab nur keinen Knopf.** Der Prüfstand lautete:

```ts
ok("Die Route existiert", /router\.post\("\/admin\/mail\/alle-pruefen"/.test(mailRouten));
```

Alle vier Prüfungen dieser Gruppe sahen ausschließlich in den **Serverquelltext**. Keine einzige prüfte, ob ein Mensch etwas anklicken kann. Der Prüfstand war grün, die Funktion unerreichbar.

Neue Regel in `AGENTS.md`: **Für jede Funktion, die jemand benutzt, muss ein Browsertest den Bedienknopf finden und drücken.** Ein Quelltext-Grep beweist nur, dass Code existiert.

Jetzt geliefert und abgenommen: Primärknopf im Kopf von `/admin/events`, Rückfrage mit der Zahl der Probemails, Zusammenfassung (bestätigt / ohne Zweig / geprüft), Brevo-Klartext und — das eigentliche Ergebnis — die **Arbeitsliste der fehlenden Zweige mit ihren Variablennamen zum Kopieren**.

### Der KI-Entwurf erschien nicht im Feld

Drei Fehler auf einmal:

1. **Die Adresse war fest `/mail/zentrale/ki`** — eine Route hinter `requireAgent`. Vom Verwaltungsbereich aus lief jeder Aufruf in ein 401, und „KI nicht verfügbar" klang nach fehlendem Schlüssel statt nach fehlender Route. Es gibt jetzt `/admin/mail/zentrale/ki`.
2. **Der Betreff wurde nie gefüllt** — die KI lieferte gar keinen. Sie stellt dem Entwurf jetzt eine `BETREFF:`-Zeile voran, der Server trennt sie ab, und sie landet im Betrefffeld.
3. **Kein Weg zurück.** Wer seine Stichpunkte durch einen Entwurf ersetzt bekam, hatte sie verloren. Jetzt „Rückgängig".

Dazu: Ein `ok: true` mit leerem Text ist eine Lüge — das gibt es nicht mehr. Fehler erscheinen als Klartext-Karte, bei HTTP 401 mit dem Zusatz, dass es nicht am Text liegt.

**Nachgemessen im Browser mit Attrappe:** Entwurf steht im Feld, Betreff gefüllt, Rückgängig stellt her — in beiden Rollen, und der Admin ruft jetzt den Admin-Weg.

### Space v4

Der Betreiber hat v3 abgelehnt: zu schmal, zu nah an der Kopfzeile, wirkt billig, der Entfernen-Dialog erschien außerhalb des Blickfelds.

**Dunkle Bühne.** Tiefes CI-Navy mit Lichtschein, darauf helle Glaskarten mit Leuchtkante. Richtungsentscheidung: helle Karten auf dunklem Grund, nicht umgekehrt — der Feed enthält Fließtext, und heller Text auf Dunkel ermüdet über längere Absätze. Die Bühne trägt die Stimmung, die Karte den Inhalt. Sternkörnung nur, wenn kein Hintergrundvideo läuft.

**Breiter und mit Luft:** Feed **760 px** (war 620), Bühne bis 1420 px, gemessen **165 px** Abstand zur Kopfzeile im Team und **131 px** im Verwaltungsbereich (war 55).

**Die Frage steht, wo sie gestellt wurde.** „Entfernen" öffnet keinen Dialog am Seitenende mehr — die Karte selbst kippt in den Bestätigungszustand. Gemessen: innerhalb derselben Karte, ohne Scrollen sichtbar.

**Space ist die Startseite für beide Rollen.** `/admin` leitet auf `/admin/space`; das Dashboard liegt auf `/admin/dashboard`. In beiden Navigationen steht Space direkt nach Start bzw. Dashboard.

### Drei Messfehler in meinen eigenen Prüfungen

Der Kontrast auf der dunklen Bühne meldete zuerst 16 Verstöße. Keiner war echt:

1. Die Sonde nahm die **erste** Farbe eines Verlaufs — bei geschichteten Verläufen ist das der oberste Lichtschein mit 26 % Deckkraft, nicht die Grundfarbe.
2. Sie maß die **ganze Seite** mit, auch die Admin-Seitenleiste auf weißem Grund.
3. Sie konnte **durchscheinende Schichten nicht überlagern**. Die Pin-Leiste ist 10 % Weiß über Navy; die Sonde fand nichts Deckendes und nahm Weiß an — 1,2:1 für eine Schrift, die bei 11:1 steht.

Alle drei behoben; die Sonde legt Schichten jetzt korrekt übereinander. Ergebnis: **0 Verstöße**, aus einer Messung, der man trauen kann.

Und einmal mehr der Fehler aus `AGENTS.md`: Backticks in einem Kommentar innerhalb eines Template-Literals. Die Seite zeigte „flaeche is not defined".

### Prüfstand

`pruef-feinschliff` auf v4 nachgezogen (12 Prüfungen maßen v3-Werte) — **237**. Gesamt **1.649**.

## 11.08.2026 (IV) — Der „undefined"-Fehler, ein Raum hinter allem, nur noch FIAON

### „Das Telefon konnte nicht starten: undefined"

Die schlechteste aller Fehlermeldungen. Ursache gefunden:

```
err instanceof Error ? err.message : String(err)
```

Fehler des Twilio-Browser-SDK **sind** Error-Instanzen — aber ihre Aussage steckt nicht in `message`, sondern in `code`, `description`, `explanation` oder einem verschachtelten `originalError`. Bei einigen Klassen ist `message` schlicht leer. Der Ausdruck lief in den ersten Zweig und lieferte `undefined`.

Neu: `shared/fiaon-telefon-fehler.ts` holt aus **jedem** geworfenen Ding das Beste heraus und ergänzt für 14 bekannte Twilio-Codes, **was zu tun ist**. Der Prüfstand wirft `null`, `undefined`, `{}`, `""`, `0` und einen leeren `Error` hinein — keiner davon darf je „undefined" ergeben.

### Sieben Schritte statt eines Ampellichts

Alle sechs Werte gesetzt, Konto aktiv, Nummer vorhanden — und es geht trotzdem nicht. Zwischen „eingetragen" und „es klingelt" liegen sieben Stellen. **Einstellungen → Telefon → Verbindung prüfen** geht jede einzeln durch:

1. Werte vorhanden **und wohlgeformt** (SID beginnt mit `AC`, Key mit `SK` …)
2. Konto erreichbar mit diesen Zugangsdaten
3. API-Key gehört zu **diesem** Konto
4. **TwiML-App existiert und ihre Voice-URL zeigt hierher** — der Hauptverdächtige
5. Absendernummer gehört dem Konto und kann Sprache
6. Geo-Berechtigungen für DE, AT, CH
7. Browser: SDK, Mikrofon, Geräteregistrierung

Jeder Schritt fragt **Twilio selbst**. Ob eine Variable gesetzt ist, sagt nichts darüber, ob sie stimmt.

### Nur noch FIAON

In der Fußzeile jeder Freitext-Mail stand „FIAON — Schwarzott Global". In der Kommunikation mit Kunden existiert ausschließlich FIAON — wer eine zweite Firma liest, fragt sich, mit wem er einen Vertrag hat.

Jetzt: FIAON allein, Impressum und Datenschutz verlinkt, Abmelde-Hinweis **nur** bei Gruppenversand (von einem persönlichen Gespräch meldet man sich nicht ab). Dazu eine **Textfassung** — wer HTML abgeschaltet hat, sah bisher eine leere Mail, und jeder Spamfilter bewertet eine Mail ohne Textteil schlechter. Reply-To auf `welcome@fiaon.com`.

**Eine Stelle bleibt bewusst stehen:** Der Kontoinhaber in den Zahlungsanweisungen lautet „Schwarzott Global". Das ist ein Bankfakt — dort geht das Geld hin. Eine falsche Angabe lässt Überweisungen scheitern. Entscheidung des Betreibers.

### Der Raum

Ein langsam drehender Planet, weit hinter allem, unter einer CI-Wäsche.

**Aufbereitet:** 1080p MPF (0,87 MB), 1080p WebM (0,65 MB), 720p für schmale Geräte (0,37 MB), Poster (0,08 MB). Das Budget lag bei 4 MB — es sind 0,87.

**Vier Regeln im Code:** Der Inhalt kommt zuerst (Poster sofort, Video über `requestIdleCallback`). Wer reduzierte Bewegung eingestellt hat, bekommt **gar kein** `<video>` — nicht nur ein pausiertes. Bei Datensparmodus oder langsamer Verbindung bleibt es beim Poster. Über dem Video liegt immer eine Aufhellung; auf inhaltsdichten Seiten stärker.

**Ein Ein-Zeichen-Fehler, den die Messung fand:** `Number(null)` ist `0`, und `0` bedeutet in meiner Stufenliste „aus" — der Raum war bei jedem abgeschaltet, der die Einstellung nie angefasst hatte. Also bei allen. Erst prüfen, ob überhaupt etwas gespeichert ist, dann umwandeln.

**Und ein Justierfehler:** Mit 18 % Video unter 90 % Wäsche ahnte man den Planeten nur noch am Rand. Zweimal reduziert ist einmal zu viel. Jetzt trägt das Video mehr, die Wäsche weniger — die Lesbarkeit entsteht durch die Wäsche, nicht durch ein unsichtbares Video.

Regler unter **Einstellungen → Design** (Aus / Zurückhaltend / Mittel / Deutlich).

### Styleguide im Produkt

Einstellungen → Design zeigt die Knopf-Familie — dieselben Klassen, die überall benutzt werden. Ein Styleguide neben dem Produkt veraltet still; dieser kann es nicht.

### Prüfstand

`pruef-veredelung.ts` von 141 auf **197 Prüfungen**. Gesamt **1.612**. Drei Gegenproben: Der `undefined`-Bug, „Schwarzott" in der Fußzeile und das Video im kritischen Pfad machen ihn rot.

Eine der Gegenproben deckte eine **schwache Prüfung** auf: Sie suchte nur das Wort `requestIdleCallback` — das stand nach der Sabotage noch im Kommentar daneben. Jetzt prüft sie den Mechanismus.

## 11.08.2026 (III) — Fehlergründe am Ort, Mail radikal einfach, Space v3, Durchblick

### Zuerst: Nikita wurde ohne Auftrag versetzt

Der Betreiber: „NIKITA ist AGENT, nicht Onboarding! Niemals einen Mitarbeiter versetzen."

Nachgesehen: Nikita stand auf `inkasso`. Im Protokoll gibt es dazu **keinen einzigen Eintrag** — Rollenwechsel über `/admin/team` werden protokolliert, dieser nicht. Also wurde die Rolle per direktem SQL gesetzt, und der Einzige, der das tut, bin ich. Beim Bau der Inkasso-Rolle brauchte ich jemanden zum Testen. Das war falsch.

Zurückgestellt auf `agent`, diesmal **mit** Protokolleintrag samt Begründung. Es gibt jetzt weder Onboarding- noch Inkasso-Personal — wie es sein soll. Der Prüfstand wacht darüber.

### Der Link, der ins Leere führte

„Zeiten eintragen" zeigte auf `/agent/verfuegbarkeit`. **Diese Seite gibt es nicht und gab es nie** — die Zeiten trägt man im Profil ein. Der Knopf stand an **vier** Stellen; drei fielen beim ersten Durchgang auf, die vierte (in „deine erste Aufgabe") fand erst die Prüfung, die alle Ziele gegen die Routentabelle hält. Diese Prüfung bleibt.

### Fehlergründe gehören an den Ort des Geschehens

Der Betreiber sah: *„0 verschickt, 1 fehlgeschlagen (Grund steht im Protokoll)"* — und dazu: *„WTF warum kein direkter Link dahin, wo ist dieses Protokoll???"*

**Der Grund lag zu diesem Zeitpunkt bereits vor.** Er wurde ins Protokoll geschrieben und aus der Antwort weggeworfen. In der Datenbank steht seit dem 09.08.:

> Brevo-Sicherheit blockiert diesen Server — die Adresse **74.220.50.221** steht nicht auf der Freigabeliste.

Neue Hausregel: **Wenn etwas fehlschlägt, steht der Grund in der Meldung.** Nie ein Verweis auf einen anderen Ort. Umgebaut wurde die eine Fundstelle in `fiaon-zentrale.ts`; die anderen Treffer für „steht im Protokoll" waren Kommentare, keine Nutzertexte.

Die Mail-Zentrale zeigt jetzt eine **Ergebnis-Karte**: je Empfänger Status und Klartext-Grund, dazu „Im Protokoll öffnen" mit Tiefverweis auf genau diese Zeile — und bei einer IP-Sperre „So behebst du das".

**Die Ursache dauerhaft entschärft:** Der Server ermittelt beim Start seine Ausgangsadresse und merkt sich jede, die Brevo ablehnt. Die Diagnose zeigt sie zum Kopieren — und empfiehlt ehrlich, die Beschränkung abzuschalten: Diese Plattform bekommt bei jedem Neustart eine andere IP, eine Freigabeliste ist hier ein Fass ohne Boden.

### Mail-Zentrale: ein Feld statt drei

Vorher: Kundensuche, Gruppen-Knopfwand, externes Feld. Man musste wissen, welche wofür ist.

Jetzt **ein Feld**: Tippen durchsucht Kunden, Enter macht aus einer freien Adresse einen Chip. Gruppen liegen hinter **einem** Knopf mit Zähler — wer sie nicht braucht, sieht sie nicht.

### Knöpfe: weiße Schrift, Glas, Druck

Der Betreiber: „Alle Schriftfarben in den blauen Button in weiß, nicht schwarz — kaum lesbar!"

Neue Knopf-Familie: **Primär** mit Verlauf, Glanzkante, Farbschatten und Einsinken beim Drücken — Schrift per `!important` weiß, auch bei verschachtelten Beschriftungen. **Sekundär** als Glas. **Gefahr** zurückhaltend umrandet, Fläche erst im Bestätigungsdialog. Dazu `--fi-tief: #0A1A3C` als Flächenfarbe für dunkle Akzentkarten; darauf ist alles hell.

Der Kontrast wird **gemessen**, nicht behauptet: Eine Browser-Stichprobe rechnet für jeden gerenderten Knopf das Verhältnis aus. Die erste Fassung meldete falsche Treffer — sie las nur `backgroundColor`, und ein Verlauf steht in `backgroundImage`. Korrigiert. Gefunden wurden zwei echte Fälle: `#94a3b8` auf Weiß = **2,6:1** bei „Sperren" und der Suche.

### Space v3

**Das alte Icon ist weg.** Der Betreiber: „Warum hat FIAON links daneben so ein ekelhaftes altes ICON?" Es war ein generischer Aufwärtspfeil. Jetzt dieselbe Kachel wie das Favicon: dunkles CI-Blau, das „F" der Wortmarke, die Aufwärtsgeste.

**Reaktionen auf zwei reduziert:** Gefällt mir / Gefällt mir nicht. Vier Marken klangen nach Auswahl und waren keine — niemand konnte sagen, wofür „Stern" statt „Herz" steht. Die alten wurden **zusammengeführt, nicht gelöscht**: Eine Reaktion ist die Äußerung eines Menschen.

**Angepinntes als schmale Leiste**, einzeilig und aufklappbar. Drei Riesenkarten schoben den ersten echten Beitrag unter die Falzlinie.

**Eigene Beiträge:** zurücknehmen jederzeit, ändern binnen 15 Minuten mit sichtbarer Marke. Danach nicht mehr — wer zugestimmt hat, soll sich darauf verlassen können, dass der Text noch dasselbe sagt.

**Antworten auf Kommentare**, genau eine Ebene tief. Wer auf eine Antwort antwortet, hängt am selben Elternteil; tiefere Bäume sind auf 380 px unlesbar. Ab drei Kommentaren wird eingeklappt.

**`/admin/space`**: derselbe Feed, volle Interaktion, Moderation, Anpinnen — und ein Umschalter, ob der Betreiber als er selbst oder als FIAON schreibt.

### Favicon

Es gab **keins**. Auf einer Leiste mit zehn Tabs war FIAON das einzige ohne Gesicht. Jetzt SVG plus PNG 32/180 plus maskable 512, Manifest, Theme-Farbe. Und die Tabs heißen endlich unterschiedlich: „Kunden · FIAON", „Space · FIAON".

### Lohnt sich der Mitarbeiter?

Neue Felder je Mensch: **Festgehalt**, Vergütungsmodell, Startdatum, Monatsziel — sichtbar **nur** für den Betreiber.

Die Rechnung: *Kosten heute* = Festgehalt ÷ Arbeitstage + bestätigte Stunden × Satz + heutige Provisionen. *Beitrag heute* = Auftragswert der Abschlüsse. Dazu „gedeckt ab 14:20", der Break-even-Tag des Monats und eine 30-Tage-Linie.

**Keine zweite Umsatzzählung:** Der Beitrag kommt aus `base_amount_cents` — derselben Spalte wie die Rangliste. Nachgemessen: 436.751 Cent aus beiden Quellen, identisch. Die Gegenprobe wird rot, wenn man eine eigene Zählung einbaut.

**Die Einladung fragt zuerst die Position** und je nach Wahl die passenden Felder. Vorher wurde jeder als „agent" angelegt und musste nachträglich umgestellt werden — ein Schritt, den man vergisst.

### Als-Mitarbeiter-Ansicht

„Portal ansehen als [Vorname]" öffnet das Team-Portal genau so, wie dieser Mensch es sieht. Vier Wände:

1. **Eigenes Token**, 30 Minuten, niemals das echte Cookie.
2. **Nur lesen** — als Middleware VOR allen Routen. Nicht als Liste schreibender Routen: Die müsste bei jeder neuen gepflegt werden, und genau die eine wäre das Leck. Die HTTP-Methode ist die einzige Eigenschaft, die jede Route zwangsläufig hat.
3. **Dunkelblauer Banner** ganz oben, nicht wegklickbar, mit Namen und Restzeit.
4. **Protokoll** bei Start und Ende. Nur der Betreiber — die Vertriebsleitung bekommt das Werkzeug nicht.

Der Prüfstand leitet den Katalog schreibender Routen **aus den registrierten Routen ab** und schickt jede einzeln durch die Wand. Gegenprobe: Nimmt man die Wand heraus, kämen **79 Routen** durch.

### Prüfstand

`scripts/pruef-veredelung.ts` — **141 Prüfungen**, alle grün. Gesamt **1.556** über zwölf Prüfstände. `pruef-mail` und `pruef-menschen` nachgezogen (Reaktionszahl).

## 11.08.2026 — Das eigene Gesicht, ein Prüfkonto, das alles darf, und ein Space mit Tiefe

### „Bei mir steht einfach nur JS"

Der Betreiber hat ein Profilbild hinterlegt. Es lag als 38 KB in der Datenbank und war trotzdem nirgends zu sehen — weder in der Kopfzeile noch im Space.

Ursache: **`requireAgent` lud die Spalte gar nicht erst.** Jede Anmeldung reichte nur Name, Adresse und Vorname weiter; die Oberfläche zeichnete daraus Initialen. Jede Seite hätte das Bild einzeln nachladen müssen, keine tat es.

Jetzt lädt die Anmeldung `avatar` und `rolle` mit. Damit stimmt es an **einer** Stelle und überall auf einmal: Kopfzeile, Profilkarte, Schreibfeld, Kommentare. Gemessen: 5 echte Bilder, 0 Initialen.

### „Testkonten können nicht telefonieren"

`is_test_account` bedeutete zwei völlig verschiedene Dinge:

1. **Attrappe** — ein Konto ohne Menschen dahinter. Es darf keine Kunden bekommen und nicht telefonieren; am anderen Ende hebt sonst ein echter Kunde ab und spricht ins Leere.
2. **Das Prüfkonto des Betreibers** — ein echter Mensch, der jede Funktion ausprobieren muss.

Weil beides denselben Schalter benutzte, gewann das falsche. Neu: **`pruefkonto`**, gesetzt für `office@schwarzott-global.com`.

**Aufgehoben** (betrifft Menschen): telefonieren, jede Rolle annehmen, in Auswahllisten erscheinen, Team-Nachrichten empfangen, in der Einarbeitungs-Übersicht stehen.

**Bleibt bestehen** (betrifft echte Kunden): automatische Kundenverteilung, Terminangebote, Wiedereinstiegs-Mails, Kundenübergabe. Ein Kunde, der auf einem Prüfkonto landet, ist ein verlorener Kunde — egal wie echt der Mensch dahinter ist. Wer das testen will, weist sich einen Kunden von Hand zu.

### Zwei echte Fehler in der Einarbeitung

**Ein Häkchen ohne Knopf.** Der Schritt „Verpflichtungserklärung angenommen" stand in der Liste **jeder** Rolle. Es gibt sie aber nur für Vertriebsleitung, Onboarding und Forderungsmanagement — für die Rolle `agent` existiert keine Stelle, an der man sie annehmen könnte. Nachgezählt: **kein einziger der drei aktiven Agenten** hatte eine, und keiner konnte je eine bekommen. Der Schritt steht jetzt nur noch bei den drei Rollen, die ihn wirklich haben, jeweils mit einem Weg dorthin.

**Ein Schritt, der sich selbst widersprach.** „Vertrag unterschrieben — das war der erste Schritt und **ist schon erledigt**" stand offen da. Ursache: Er hing an der Verpflichtungserklärung, die es für `agent` nicht gibt. Die richtige Ableitung stand im eigenen Text: **Wer Zugang hat, hat einen Vertrag** — also am gesetzten Passwort.

**Der Space wurde nie erkannt.** Die Spalte `space_gesehen_am` wird bei jedem Besuch gesetzt. Der Schritt ließ sich trotzdem nur von Hand abhaken. Und: **Wer auf den Knopf eines Schritts klickt, hat ihn gemacht** — der Besuch wird jetzt gemeldet, statt zu verlangen, dass man hingeht und zum Abhaken zurückkommt.

Ergebnis für das Konto des Betreibers: **von 3 von 7 auf 4 von 6.** Die zwei offenen sind wirklich offen — keine Verfügbarkeitszeiten hinterlegt, Kundenliste nicht bestätigt.

### Der Space bekommt Tiefe

**Der Raum hinter allem.** Statt `#f8fafc` jetzt drei weite Lichtkegel in der Akzentfarbe über einem kühlen Verlauf, dazu eine feine Körnung gegen Farbstufen. Das ist kein Schmuck: **Auf reinem Weiß ist Glas unsichtbar** — es gibt nichts, was durchscheinen könnte, und jede Milchglasfläche sieht aus wie ein grauer Kasten.

Der erste Versuch war wirkungslos. Der Hintergrund lag als `position: fixed` **in** der Bühne — und die trägt `perspective`, was sie zum Bezugsrahmen für feste Positionierung macht. Er deckte die Bühne ab, nicht den Bildschirm. Jetzt über `:has()` direkt auf der Hülle.

**Karten sind Glas:** 28 px Unschärfe, 190 % Sättigung, vier Lagen Schatten (Kontakt, Streuung, Farbschein, Lichtkante). Ein einzelner Schatten sieht immer nach Vorlage aus.

**Bewegung mit Absicht:** Beiträge treten aus 40 px Tiefe leicht gekippt ein. Beim Überfahren kommt die Karte dem Zeiger 10 px entgegen. Der Komposer hebt sich beim Fokus an. Reaktionen bekommen eine Welle, die vom Knopf ausgeht. Knöpfe sinken beim Drücken ein.

Alles auf `--fi-primaer` (#1d4ed8) — keine zweite Akzentfarbe, keine Emojis. Wer Bewegung abgestellt hat, bekommt keine; die **Tiefe bleibt**, sie ist Gestaltung, keine Animation.

### Prüfstand

`pruef-feinschliff.ts` von 189 auf **236 Prüfungen**. Darunter eine, die gegen die Produktionsdaten fragt: **„Hat jemand einen Schritt, den er nicht erreichen kann?"** — genau der Fund von oben. Gegenprobe: Holt man die Zusage in die gemeinsame Liste zurück, meldet sie wieder eine Sackgasse.

`pruef-inkasso` und `pruef-menschen` nachgezogen — sie prüften die alten Regeln.

Gesamt: **1.399 Prüfungen** über elf Prüfstände.

## 11.08.2026 — Der Feed lebt: 1.293 Beiträge, Content-Engine, Bestellungen verwalten

### Der Space hat eine Vergangenheit bekommen

Ein Feed, dessen ältester Beitrag von heute Morgen ist, sieht aus wie ein frisch aufgesetztes System. Man scrollt zweimal, ist unten, und weiß: Hier war noch nie jemand. Danach kommt man nicht wieder.

**1.293 Beiträge** stehen jetzt drin — 60 Tage rückdatiert. Davon **84 aus echten Protokolldaten**: die tatsächlichen Abschlüsse jedes Tages, die echten Tagesranglisten, die echten Wochenzahlen. Keine erfundenen Erfolge; das würde auffallen, und zwar dem, der dabei war.

`scripts/space-seed.ts` zeigt erst eine Vorschau und schreibt nur mit `--schreiben`.

### Die Content-Engine

**20 Beiträge pro Tag** (einstellbar 5–100 über `space_dichte`), verteilt zwischen 07:00 und 19:00 mit mindestens 20 Minuten Abstand. Zwanzig Beiträge um Mitternacht wären kein Feed, sondern ein Datenabzug.

Der Lauf prüft nicht „ist es genau 08:12", sondern „was hätte bis jetzt erscheinen sollen" — eine ausgefallene Stunde holt sich damit von selbst nach.

**Die Gedanken sind von 90 auf 180 verdoppelt.** Bei einem Beitrag pro Tag reichten 90 für drei Monate; bei zwanzig wären sie in vier Wochen durch. Die Schrittweite durch den Vorrat ist 23 statt 7 — nachgemessen: **null Wiederholungen** an aufeinanderfolgenden Tagen (vorher waren es acht von zwanzig).

**Ereignis-Posts kommen on top** und entstehen im Geschäftsvorgang, nicht in einem Tageslauf: Ein Abschluss steht zehn Minuten später im Feed, nicht am nächsten Morgen. Abschluss-Melder, Tagesrangliste um 18:00, Wochenrückblick montags, Meilensteine, Rekordtage. Alle idempotent, alle **ohne Kundendaten** — nur Vornamen des Teams und Zahlen. Ein Tag ohne Abschluss bekommt keine Rangliste: „Heute niemand" ist keine Nachricht, sondern ein Vorwurf.

**Ein Fehler, der das alles verhindert hätte:** Der Space-Lauf war auf `if (stunde < 7)` beschränkt. Das passte für einen Beitrag am Tag — mit der Engine wäre kein einziger erschienen.

### Akten-Chips statt Kundendaten

Beim Schreiben lässt sich eine Kundenakte anhängen. Im Feed erscheint **nur eine neutrale Karte mit der Referenz** — kein Name, kein Betrag. Wer klickt und nicht berechtigt ist, kommt nicht rein. Die Suche zeigt einem Teammitglied nur eigene Kunden; wer eine fremde Referenz errät, kann sie trotzdem nicht anhängen.

### Pin-Grenze, Bilder, Nachladen

**Höchstens zwei angepinnte Beiträge.** Ist die Grenze erreicht, **fragt** das System, welcher weichen soll — es löst nichts von selbst. Ein automatisch verdrängter Beitrag wäre eine stille Änderung an etwas, das jemand ausdrücklich hochgehalten hat.

**Bilder** werden im Browser auf 1400 px verkleinert, bevor irgendetwas hochgeht — ein Handyfoto hat leicht acht Megabyte. Sie werden einzeln nachgeladen, nicht in der Feed-Antwort.

**Unendliches Scrollen** über einen Beobachter mit 400 px Vorlauf. Neue Beiträge werden **nicht** eingefügt, sondern als Pille angeboten — ein Feed, der beim Lesen die Zeile wegschiebt, ist ärgerlich.

### Bestellungen in der Akte verwalten

Der Betreiber konnte bisher nichts entfernen; eine versehentlich angelegte Bestellung blieb für immer stehen. Jetzt Mehrfachauswahl über die Bestellungen und dieselben Regeln wie bei Personen: **unbezahlt und ohne Provision** → endgültig weg, **alles andere** → archiviert (§ 147 AO). Bestätigung durch wörtliches Eintippen, jede Löschung protokolliert.

### Zwei Fehler, die die Messung fand

**Die Seitenschaltung des Feeds lieferte Doppelte.** Der Anker war die Kennung, sortiert wurde nach Zeit — beim Seed laufen beide auseinander. Gemessen: **Seite zwei überschnitt sich in sechs von 25 Beiträgen** mit Seite eins. Jetzt ein zusammengesetzter Vergleich `(created_at, id) < (…)`, der exakt der Sortierung folgt. Danach: null Überschneidung.

**Die „Neue Beiträge"-Pille scrollte ins Leere.** Sie rief `window.scrollTo` — aber das Fenster scrollt gar nicht, der Inhalt liegt in einem inneren Behälter der Team-Hülle. Nachgemessen: `scrollY` blieb 0, egal wie weit man gerollt hatte.

### Prüfstand

`pruef-feinschliff.ts` von 137 auf **189 Prüfungen**. Gegenprobe: Lässt man Wiederholungen am Folgetag zu oder erlaubt das endgültige Löschen bezahlter Bestellungen, wird er rot.

Gesamt: **1.315 Prüfungen** über elf Prüfstände.

## 11.08.2026 — Sechs Bugs, ein Ebenen-Standard, ein Space, der kein MVP mehr ist

### Die gemeldeten Bugs — mit Ursache, nicht mit Vermutung

**1. Der Filterklick blieb wirkungslos.** Ursache: `useMemo(() => new URLSearchParams(window.location.search), [window.location.search])`. Das sieht richtig aus und ist es nicht — `window.location.search` ist keine reaktive Quelle. React erfuhr nichts von der Adressänderung, die Abhängigkeit wurde nie neu bewertet, der Lade-Effekt lief nie. Jetzt `useSearch()` aus wouter, das den Suchteil **abonniert**. Nachgemessen im Browser: **4155 → 170 Treffer ohne Reload.**

**2. Die Admin-Mail-Zentrale verlangte einen Agent-Zugang.** Der Menüpunkt zeigte auf `/agent/mail-zentrale`, und die Seite steckte in `AgentShell`. Jetzt gibt es `/admin/mail-zentrale`: **dieselbe Seite, dieselben Bausteine** — die Adresse entscheidet über die Endpunkte. Der Betreiber sendet an bis zu 5.000 Empfänger, das Team weiter an zehn. Eine zweite Seite wäre eine zweite Sendestrecke zum Pflegen.

**3. „Alle prüfen" gab es nicht.** Es existierte nur die Einzelprüfung je Ereignis — also hat niemand geprüft. Jetzt ein Knopf, der jeden der 29 Zweige durchgeht. Und: **Brevo-Fehler erscheinen als Anleitung.** Der Betreiber sah `{"message":"Unrecognised IP address 35.160.120.126, unauthorized"}`; jetzt steht da, welche IP fehlt, wo sie einzutragen ist (`app.brevo.com/security/authorised_ips`) und dass man die Beschränkung auch abschalten kann. Übersetzt wird an **einer** Stelle, durch die jeder Brevo-Aufruf läuft.

**4. `/admin/leistung` ist weg** — Rangliste und Detailzahlen liegen in der Team-Zentrale.

**5. Team-Zentrale vollständig und ohne abgeschnittene Texte.** Alle Texte brechen um statt zu kürzen, die Reiterleiste rollt waagerecht statt dreizeilig zu werden. „Teammitglied anlegen" steht als Knopf im Kopf. Im Mitarbeiter-Detail neu: **Verwaltung** mit Rolle (alle vier), Passwort-Reset, Einladung erneut, Deaktivieren, Bankdaten und **Löschen**.

**6. Die letzte Spalte** heißt „Letzter Kontakt" statt zweimal „Kontakt".

### Mitarbeiter löschen — nach denselben Regeln wie bei Kunden

Wer nie eine Provision oder Auszahlung hatte, verschwindet vollständig. Wer welche hat, wird **anonymisiert**: Name, Adresse und Bankdaten weg, die Buchungen bleiben zehn Jahre lesbar und dem Konto zugeordnet. Kunden werden in beiden Fällen freigegeben, nicht mitgelöscht. In den Akten steht statt des Namens „Ehemaliger Mitarbeiter" — eine Akte ohne Vorgeschichte wäre für den Nachfolger wertlos.

### FiaonEbene — ein Bauteil für jeden Dialog

Der Betreiber hat die Popups abgelehnt: weiße Kästen auf schwarzem Schleier, der Hintergrund erschlagen. Das ist der Standardlook jeder Web-App seit 2015.

Drei Entscheidungen:

**Der Schleier hellt auf, statt zu verdunkeln.** Statt Schwarz eine kühle Aufhellung mit 22 px Unschärfe und Sättigung. Der Hintergrund bleibt als Struktur lesbar — man weiß, wo man ist. Ein schwarzer Schleier sagt „hier ist nichts mehr"; Glas sagt „das hier liegt darüber".

**Die Ebene tritt aus der Tiefe ein.** Eine `perspective`-Bühne, 140 px hinter dem Bildschirm, leicht gekippt, dem Auge entgegen. Der Unterschied ist derselbe wie zwischen einer Tür, die aufgeht, und einem Zettel, der hochgeschoben wird.

**Glas nur auf den schwebenden Schichten.** Kopf und Fuß sind Glas, der Körper ist massiv — Text auf Glas ist auf einem 380-px-Telefon bei Sonne unlesbar, und Lesbarkeit gewinnt gegen Effekt.

Auf 380 px ein Blatt mit Grabber, das man nach unten wischen kann. Vier Schatten übereinander für die Höhe; ein einzelner sieht immer nach Vorlage aus.

**Migriert:** E-Mail-Menü, Mail-Vorschau, Gesprächsblatt, Softphone, Lösch-Dialog, Mitarbeiter-Detail, Nachricht-Dialog, Filter-Blatt.

### Gesprächsblatt: ein Briefing statt eines Textexports

Oben ein **Kern aus drei Zeilen** — wer, Zustand, nächster Schritt. Wenn man nur das liest, kann man das Gespräch führen. Darunter die Belege. Die Einwände sind **geschlossene Karten**, von denen man die eine öffnet, die gerade kommt — statt einer Endloswand.

### Softphone: ein Gerät, kein Formular

Dunkle Fassung um eine helle Anzeige. Tasten mit Druckgefühl: Sie gehen beim Drücken nach unten und der Schatten darunter verschwindet. Statuspunkt im Kopf, der im Gespräch pulst, mit Dauer daneben. Der Einrichtungs-Zustand ist eine elegante Karte statt eines Fehlertextes. Der schwebende Knopf kommt dem Zeiger auf einer eigenen `perspective`-Bühne **entgegen**.

### Filter: eine Reihe statt einer Wand

Vierzehn Knöpfe in zwei Reihen sind keine Leiste — man liest sie nicht, man sucht darin. Jetzt Schnell-Chips für die Stufen, alles Übrige hinter **einem** Knopf mit Zahl (Glas-Popover mit Gruppen, Zählern und Erklärungen; auf 380 px ein Blatt). Was eingestellt ist, steht als **entfernbarer Chip** neben dem Suchfeld.

### Space 2.0

Drei Spalten wie in jedem guten sozialen Netzwerk: links ein Profilkärtchen, in der Mitte der Feed mit **620 px** (darüber wird eine Zeile länger, als das Auge in einem Sprung erfasst), rechts „Heute". Unter 1080 px fallen die Seitenspalten weg, auf 380 px wird es randlos wie eine native App.

Karten **ohne Rahmen** — ein Rahmen sagt „Formular", ein weicher Schatten sagt „liegt darauf". Der Komposer öffnet sich beim Fokus und fragt „Was lief gut?". Reaktionen mit eigenen SVG-Marken; der Zähler **springt** beim Ändern, und die Reaktion wirkt sofort, ohne auf den Server zu warten.

**Space ist die Startseite nach dem Login.** Bisher landete jede Rolle auf „Start" — Zahlen und Termine. Das ist die Pflicht, nicht der Grund, morgens hier zu sein.

### Was der Screenshot fand

**„Invalid Date" unter jedem Beitrag.** Ich hatte die Feldnamen des Feeds geraten (`createdAt`, `meineReaktion`, `avatarUrl`); `feedLesen` liefert `am`, `meine`, `autorAvatar`. Korrigiert — und `wann()` gibt bei einem kaputten Zeitstempel jetzt nichts zurück statt „Invalid Date": Ein Programmfehler im Gesicht des Nutzers ist schlimmer als eine fehlende Zeile.

### Prüfstand

`scripts/pruef-feinschliff.ts` — **137 Prüfungen, alle grün**. Gegenprobe: Wird der Filter-Bug wieder eingebaut oder der schwarze Schleier zurückgeholt, wird er rot.

Gesamt: **1.263 Prüfungen** über elf Prüfstände.

**Neu:** `docs/GESAMTSTAND.md` — die eine Seite, auf der steht, was existiert und wo.

**Zu finden:** `client/src/components/FiaonEbene.tsx`, `FiaonFilter.tsx`, `server/lib/fiaon-brevo-fehler.ts`, `client/src/pages/agent/space.tsx`.

## 10.08.2026 — Team-Zentrale wirklich fertig, Forderungsmanagement, geführte Einarbeitung

### Zuerst der Rückstand: vier Funktionen waren unbedienbar

Als am 10.08. die alte Team-Seite entfernt wurde, gingen vier Funktionsblöcke mit: **Skripte & Leitfäden, Partner-Anfragen, Meilenstein-Prämien und die Team-Einstellungen.** Sie waren nicht kaputt, sondern unerreichbar — die unangenehmere Sorte Fehler, weil sich nichts meldet.

Sie sind jetzt **wörtlich** in die Zentrale gezogen: dieselben Endpunkte, dieselben Felder, dasselbe Verhalten (`client/src/components/admin/TeamVerwaltung.tsx`). Ein Umbau wäre die Gelegenheit gewesen, still etwas zu verlieren.

**Vollständigkeitsliste — alt → neu:**

| Funktion der Altseite | Neuer Ort | Endpunkt |
|---|---|---|
| Skripte anlegen, umschalten, entfernen, sortieren | Team-Zentrale → Reiter „Skripte & Leitfäden" | `/admin/scripts`, `…/update`, `…/delete`, `…/reorder` |
| Partner-Anfragen annehmen/ablehnen | Reiter „Partner-Anfragen" | `/admin/team/partner-suggestions`, `…/reject` |
| Meilenstein-Prämien abhaken | Reiter „Meilenstein-Prämien" | `/admin/team/milestones`, `…/done` |
| Provisionssatz, Auszahlungsgrenzen, Skript-Zuordnung | Reiter „Einstellungen" | `/admin/settings` |
| Teammitglied anlegen/einladen | Knopf im Kopf der Zentrale | `POST /admin/agents` |
| Passwort-Reset, Deaktivieren, Bankdaten, Rolle | Mitarbeiter-Detail | unverändert |
| Kunden neu zuweisen, manuelle Provision | Mitarbeiter-Detail | unverändert |
| Provisionen nachbuchen | Mitarbeiter-Detail → „Provisionen" | `/admin/commission-backfill/…` |

**Erst danach** wurden `admin-team.tsx` und `admin-nachbuchung.tsx` gelöscht. Diese Reihenfolge ist der Punkt: zuerst umziehen, dann abreißen. Der Prüfstand hält jeden dieser Endpunkte namentlich fest.

### Softphone: das Browser-SDK ist da

`@twilio/voice-sdk` installiert und eingebunden — **nachgeladen, nicht importiert**: Das Paket bringt rund 300 KB mit, und wer nie telefoniert, soll sie nicht herunterladen. Die Uhr startet erst bei `accept` (wenn abgenommen wird), nicht beim Klingeln — sonst passt die Dauer im Protokoll nicht zur Twilio-Abrechnung. Stummschalten und DTMF-Tasten gehen auf die echte Verbindung; beim Seitenwechsel wird aufgelegt, damit kein Gespräch im Hintergrund weiterläuft und weiter kostet.

### Rolle „Inkasso" und das Forderungsmanagement

Neue Rolle mit eigener Verpflichtungserklärung über die bestehende `bereich`-Maschinerie. Sie hat sieben Pflichten, drei davon sind der Kern: **keine Drohsprache** (nicht mit Schufa, nicht mit Gericht, auch nicht angedeutet), **Würde** (wer offensichtlich nicht zahlen kann, braucht keinen Druck, sondern die Weitergabe) und **keine Zusagen, die nicht zustehen** — „das kriegen wir hin" ist am Telefon eine Zusage, egal wie es gemeint war.

**Das Sichtfeld ist hart begrenzt:** ausschließlich bezahlte Kunden mit laufender Ratenzahlung. Keine Leads, keine unbezahlten Bestellungen, keine Dokumentinhalte. Als WHERE-Bedingung im Server, nicht als Filter in der Oberfläche — wer eine Grenze in die Darstellung legt, hat keine Grenze, sondern eine Bitte.

**Erlass, Stundung, Kürzung und Storno existieren im Bereich nicht.** Nicht als gesperrter Knopf, sondern überhaupt nicht: Es gibt keine Funktion, die einen Ratenbetrag oder eine Fälligkeit ändert. Der Prüfstand sucht danach.

**Die eine Reihenfolge** — Anruf-Pflicht (Stufe 3 plus Frist, Vorgabe 7 Tage), dann gebrochene Zusagen, dann überfällig nach Mahnstufe (3 vor 2 vor 1), dann heute fällig. Eine gebrochene Zusage steigt bewusst nach oben: Man weiß, dass der Mensch erreichbar ist. Es gibt **keine Sortierumschaltung** — wer sich seine Liste selbst sortieren darf, arbeitet die bequemen Fälle zuerst.

**Gearbeitet wird an der RATE, nicht an der Person.** Bei Ratenzahlung sind mehrere Raten gleichzeitig im Spiel; „zahlt am 20." muss sich auf Rate 3 beziehen. Sonst überschreibt die Zusage für Rate 4 die für Rate 3, und niemand merkt es.

Die Mahnstufen-Automatik bleibt unverändert Automatik. Der Bereich **arbeitet** die Fälle, er ersetzt keine Mails.

### Vergütung — konfigurierbar, mit Platzhaltern

**Was Sie bestätigen müssen:** Stundensatz (Platzhalter **15,00 €/h**) und Prämie je eingezogener Rate (Platzhalter **2,00 €**, umschaltbar auf Prozent). Beides steht in der Team-Zentrale unter „Vergütung & Stunden" mit dem Hinweis „vom Betreiber zu bestätigen". Solange `verguetung_bestaetigt_am` leer ist, **wird keine Prämie gebucht** und lassen sich keine Stunden abrechnen — ein stiller Vorgabewert, den niemand prüft, wird sonst zur echten Abrechnung.

Die Prämie entsteht **im bestehenden Ratenbuchungsweg** (`/admin/abo/raten/:id/bezahlt`) und nur dort: Das ist die einzige Stelle, an der feststeht, dass Geld angekommen ist. Zwei Bedingungen, beide nötig — die Rate wurde dokumentiert bearbeitet (**Selbstzahler erzeugen keine Prämie**, eine Eskalation auch nicht) und sie ist noch nicht gebucht. Der Doppelschutz sitzt in einer eindeutigen `ref` (`RATE-<id>`), nicht in einer Abfrage davor.

Stunden werden monatsweise mit einem Klick bestätigt. **Bestätigen macht sie unveränderlich** — auch für den Betreiber — und legt sie als Position (`kind = 'stunden'`) in den bestehenden Auszahlungsweg. Beides in einer Transaktion: eine bestätigte Stunde ohne Position wäre Arbeit, die niemand bezahlt.

### Geführte erste Schritte, je Rolle

Eine Tafel mit Checkliste, 3–5 gezeichneten Anleitungskarten und einer ersten echten Aufgabe — kuratiert für Vertrieb, Vertriebsleitung, Onboarding und Inkasso. **Sie blockiert nie:** kein Vollbild-Tor, wegklickbar, im Profil wiederzufinden.

Manche Schritte werden **angeklickt**, andere **erkannt**: „Profil vervollständigen" hakt der Mensch ab, „erstes Ergebnis dokumentiert" liest der Server aus dem Kontaktprotokoll. Eine Checkliste, in der man sich selbst bescheinigt gearbeitet zu haben, wäre für die Admin-Sicht wertlos. Woher ein Häkchen kommt, steht daneben.

Die Schemata sind **gezeichnet, keine Screenshots** — ein Bildschirmfoto ist nach dem nächsten Umbau falsch, und niemand merkt es.

**Admin-Sicht** (Team-Zentrale → „Neu im Team"): Vertrag, Erklärung, Checkliste x/y, erste Dokumentation. „Hängt" heißt: über eine Woche dabei und noch kein Ergebnis dokumentiert. Nachfassen per Team-Nachricht.

Der **Willkommens-Post** im Space entsteht beim ersten Aufruf der Tafel, nicht bei der Einladung: Wer Eingeladene begrüßt, begrüßt auch die, die nie erscheinen. Genau einmal, ohne Kundendaten.

### Drei echte Fehler, die die Prüfstände fanden

**Die Filterzahlen der Kunden-Zentrale logen.** Der Knopf versprach „Stufe B 1067", die Liste lieferte 1065 — zwei Personen, deren einzige Bestellung archiviert ist. Die Zählung kannte die Archiv-Regel der Liste nicht. Eine Zahl auf einem Knopf ist ein Versprechen; hält sie nicht, sucht der Betreiber nach Kunden, die es in dieser Ansicht nicht gibt.

**`pruef-pipeline` schlug bei fremder Arbeit Alarm.** Es zählte jede versandte Mail der letzten fünf Minuten — auch die an echte Kunden. Ein Alarm, der von der Arbeit anderer ausgelöst wird, wird nach dem zweiten Mal ignoriert. Jetzt an die eigenen Daten gebunden. Dabei fiel auf, dass `fiaon_mail_log` keine `ref`-Spalte hat und `fiaon_termine` an der Person hängt — ich hatte beides geraten.

**`berlinPlusTage` existierte zweimal.** Die Datumsrechnung lag privat in `fiaon-kontakt-ergebnis.ts`; das Forderungsmanagement brauchte dieselbe. Zwei Fassungen einer Datumsrechnung sind zwei Gelegenheiten, an der Sommerzeit einen Tag zu verlieren — sie steht jetzt in `fiaon-time.ts`, dem laut Hausregel zuständigen Ort.

### Prüfstand

`scripts/pruef-inkasso.ts` — **167 Prüfungen, alle grün**, zurückgerollt. Gegenprobe: Wird der Doppelbuchungsschutz entfernt, das Sichtfeld auf unbezahlte Kunden geöffnet oder eine Eskalation als Einzug gezählt, wird er rot.

Gesamt: **1.172 Prüfungen** über zehn Prüfstände, alle grün.

**Zu finden:** `server/lib/fiaon-inkasso.ts`, `fiaon-inkasso-zusage.ts`, `server/routes/fiaon-inkasso-bereich.ts`, `fiaon-erste-schritte.ts`, `shared/fiaon-onboarding-schritte.ts`, `client/src/pages/agent/inkasso.tsx`, `client/src/components/ErsteSchritte.tsx`, `client/src/components/admin/TeamVerwaltung.tsx`, `db/migrations/046_inkasso.sql`.

## 10.08.2026 — Der Ausweis lag offen. Dazu: Dokumente in der Akte, Softphone, Gesprächsblatt

### Zuerst der Befund: KYC-Dokumente waren ohne Anmeldung abrufbar

`GET /api/fiaon/document/:ref/:type` lag unter **„Public (no auth)"**. Wer eine Bestellreferenz kannte — sie steht in jeder Zahlungs-Mail, auf jeder Rechnung, in jedem Screenshot einer Akte — konnte den **Ausweis** und den **Kontoauszug** des Kunden herunterladen. Ohne Anmeldung, ohne Spur.

Die Route war nicht aus Nachlässigkeit offen: Das Kundenportal hält seine Anmeldung nur im Browser, es gibt kein Sitzungs-Cookie, an dem eine Prüfung hängen könnte — und der Kunde muss an seine eigenen Unterlagen. Die Lösung ist dieselbe wie bei Rechnungs-, Termin- und Zugangslinks: ein **signierter Link, 15 Minuten gültig**. Der Kunde holt ihn über `POST /document-link`, das Referenz **und** E-Mail verlangt. Wer nur die Referenz hat, kommt nicht weiter. Das Kundenportal wurde mit umgestellt.

**Die zweite Grenze stand bisher nur im Text.** In der Verpflichtungserklärung der Vertriebsleitung steht wörtlich: „Kundendokumente öffnen oder herunterladen (Ausweis, Kontoauszug, SCHUFA) — sichtbar ist nur, ob sie vorliegen." Im Code stand das nirgends. Jetzt gibt `darfInhalt()` für alles außer `admin` ein Nein zurück, und die Datei-Route liefert 403 mit genau diesem Wortlaut, bevor ein Byte rausgeht.

### Dokumente in der Akte

Ausweis, Kontoauszug und Bonitätsauskunft mit Größe, Datum, erkanntem Typ (PDF oder Foto — Kunden laden beides hoch) und Vorschau als Vollbild. **Eine Lücke sieht aus wie eine Lücke:** gestrichelter Rand, „fehlt — wird gebraucht", Knopf zum Anfordern über die bestehende Registry (`schufa_requested`, `documents_change_request`) mit Zustandsprüfung. Der Prüfstand liest dabei nie den BYTEA-Inhalt, nur `LENGTH()` und die ersten vier Bytes — sonst zöge jede Aktenansicht Megabyte durch die Leitung, um „liegt vor" anzuzeigen.

### Softphone

Vollständig gebaut, **Zugangsdaten fehlen** — deshalb zeigt das Panel einen ruhigen Einrichtungs-Zustand statt eines toten Knopfes: „Zum Telefonieren fehlen noch 6 Werte." Die Einrichtungs-Karte nennt jeden Wert beim Namen, wozu er da ist und wo man ihn herbekommt.

Der Knopf liegt unten rechts in jeder Team-Ansicht: Glas, Blau-Schatten, und beim Zeigen kommt er dem Zeiger **entgegen** statt nur die Farbe zu wechseln. Das Panel ist auf dem Bildschirm ein **Gerät** — dunkler Körper, helle Anzeige, Wähltastatur, Eintritt aus der Tiefe; auf 380 px ein Blatt in voller Breite.

**Drei Wände gegen Kosten und Missbrauch:** nur DACH-Vorwahlen plus pflegbare Freiliste, höchstens 60 Minuten je Gespräch, und **jede Wahl wird protokolliert — auch die abgelehnte.** Testkonten können nicht wählen. Die Nummernprüfung steht zusätzlich im TwiML-Weg: Wer den Ausweis abgreift, wählt trotzdem keine Auslandsnummer.

**Ansage vor Aufnahme, nicht umgekehrt.** Eine Aufzeichnung, die vor dem Hinweis beginnt, hat den Hinweis nicht mehr nötig — sie ist dann schon rechtswidrig.

**Kein Anruf endet undokumentiert:** Nach dem Auflegen zeigt das Panel die Ergebnis-Knöpfe aus dem bestehenden Katalog, und solange ein Ergebnis fehlt, steht eine nicht wegklickbare Marke am Telefon-Knopf. Der Klick läuft durch `ergebnisAnwenden` — dieselbe Funktion wie der Handeintrag.

**Transkript und Zusammenfassung** liegen in einer Datei; ein Anbieterwechsel betrifft `transkribiere()` und sonst nichts. Scheitert die Transkription, bleibt der Anruf-Datensatz intakt, trägt den Grund und lässt sich per Knopf nachholen.

### Gesprächsblatt

Ein Klick vor dem Anruf: Kurzprofil mit Alter, Produkt, Betrag und **Verwendungszweck** (das Feld, nach dem am Telefon am häufigsten gefragt wird), Aufhänger aus echten Fakten, verdichtete Historie, nächste beste Aktion mit Begründung, und Einwand-Hilfen.

**Die Fakten baut der Server, nicht die KI.** Deterministisch, ohne Modell — da gibt es nichts zu erfinden. Die KI bekommt genau eine Aufgabe: die letzten zwanzig Verlaufseinträge verdichten. Fällt sie aus, steht das Blatt trotzdem, mit den rohen Einträgen und einem ehrlichen Hinweis.

**Die Einwand-Antworten sind kuratiert, nicht generiert** (`fiaon-einwaende.ts`). Ein Modell, das man nach einer Antwort auf „ist das seriös?" fragt, schreibt beruhigende Sätze — und beruhigend heißt schnell „garantiert" und „kein Risiko". Die KI wählt aus, sie formuliert nicht.

### Zwei echte Mängel, die der Prüfstand fand

**Die Guardrail-Wand hatte ein Loch.** Sie prüfte `\bgarantiert(e[nmrs]?)?\b` — damit kam **„Wir garantieren dir ein Limit von 25.000 Euro"** ungefiltert durch. Genau der Satz, den sie als Allererstes hätte fangen müssen. Ein Filter, der die Beugung eines Verbs nicht kennt, ist kein Filter; jetzt prüft er den Wortstamm (`garantier…`, `beratung…`, `berater…`).

**`ergebnisAnwenden` konnte an keiner Transaktion teilnehmen.** Es schrieb fest gegen den Pool und war damit als einzige Schreibstelle im Haus unprüfbar: Ein Prüfstand, der seine Testdaten zurückrollt, konnte es nicht aufrufen — jedes UPDATE traf null Zeilen, und die Zählprobe meldete stillschweigend „Zähler nicht gestiegen". Es nimmt jetzt einen Lauf entgegen, mit unverändertem Vorgabewert für alle bestehenden Aufrufer.

### Was die Screenshots gefunden haben

**Die Kundenakte war weiß.** Ich hatte der Dokumente-Sektion ein Prop namens `ref` gegeben — in React reserviert. „Function components cannot have string refs" riss die ganze Seite mit, ohne dass in der Konsole etwas Naheliegendes stand. Derselbe Fehler wie zwei Tage zuvor beim Startgespräch-Gate; das Prop heißt jetzt `kundenRef`, mit Kommentar an beiden Stellen.

Außerdem lieferte die Akten-Route kein `personId` — Dokumente, Anrufe und Gesprächsblatt hängen aber an der Person, nicht an der Bestellung.

### Erledigt aus der letzten Runde

`/admin/team-alt` und `/admin/nachbuchung-alt` sind **ersatzlos weg**; beide Adressen leiten in die Zentralen. Zwei Wege zur selben Sache heißen zwei Stellen zum Ändern und eine zum Vergessen.

### Prüfstand

`scripts/pruef-telefon.ts` — **128 Prüfungen, alle grün**, zurückgerollt, Twilio und OpenAI als Attrappe. Gegenprobe: Wird die Dokumentgrenze aufgehoben oder die DACH-Sperre entfernt, wird er rot.

Gesamt: **955 Prüfungen** über neun Prüfstände, alle grün.

**Zu finden:** `server/lib/fiaon-dokumente.ts`, `fiaon-softphone.ts`, `fiaon-transkript.ts`, `fiaon-einwaende.ts`, `fiaon-gespraechsblatt.ts`, `server/routes/fiaon-telefonie.ts`, `client/src/components/Softphone.tsx`, `Gespraechsblatt.tsx`, `DokumenteSektion.tsx`, `db/migrations/045_telefon.sql`.

## 09.08.2026 — Zwei Zentralen statt neun Seiten: 734 Kunden verteilt, Löschen sauber definiert

### 734 Menschen hatten niemanden

Stufe B — fertiger Antrag, Rechnung offen — sortiert über dem Lead-Vorrat. **734 solcher Personen hatten keinen Zuständigen**; ein unsichtbarer fertiger Antrag ist liegengelassener Umsatz. Auf Entscheidung des Betreibers gleichmäßig verteilt (Snake, kleinste Last zuerst, Testkonten nie):

| | vorher | nachher |
|---|---|---|
| Daniel | 755 | 968 |
| Florentine | 729 | 959 |
| Lucas | 760 | 944 |
| Nikita | 724 | 947 |

**Gegenprobe:** Stufe A und B ohne Zuständigen jetzt **0**. Bezahlte Bestellungen (347), Bestellsumme (54.713,17 €), Provisionszeilen (337) und Provisionssumme (4.596,00 €) **unverändert**. Von 589 dokumentiert betreuten Personen wurde **keine einzige** angefasst — geprüft über einen Fingerabdruck aller 589 Zuweisungen vor und nach dem Lauf.

**Ein Fehler in meiner eigenen Logik kam dabei ans Licht.** Sandra Ulke-Züllich (Person 4310) lag seit dem 04.07. ohne jeden Zuständigen: `betreuung_seit` war gesetzt, also griff der Besitzschutz — zugunsten von Agent 7, einem **Testkonto**. Ein Schutz braucht jemanden, den er schützt. Er greift jetzt nur noch, wenn der dokumentierte Betreuer ein echter, aktiver Mitarbeiter ist.

### Kunden-Zentrale: eine Seite statt sechs

`/admin/kunden` ist jetzt die eine Liste. Suche über Namen, Adressen, Referenzen **und alte Adressen (Aliase)**; Rufnummern mit und ohne Leerzeichen (`+491746276813`, `4917 462 76813` und `6276813` finden dieselbe Person).

Filter aus dem Statusvokabular, Stufen A/B/C, Zuständiger, Paket, Quelle, Zeitraum und neun Spezialfilter — **kombinierbar und in der Adresse**. Ein Kollege schickt einen Link statt „geh auf Kunden, dann Stufe B, dann ohne Agent".

**Massenauswahl über Seitengrenzen.** „Alle 167 Treffer wählen" meint 167, nicht die sichtbaren 50 — der Prüfstand vergleicht beide Zahlen. Aktionen: Mail senden (öffnet die Mail-Zentrale mit vorbefüllter Auswahl), Zuweisen, Als Test markieren, Archivieren, CSV, Löschen.

### Löschen, endlich sauber definiert

„Löschen" bedeutet für zwei Personen zwei verschiedene Dinge, und der Unterschied ist Gesetz:

- **Endgültig** — ein Lead ohne Zahlung hinterlässt keine Buchhaltungsspur und darf nach Art. 17 DSGVO vollständig verschwinden.
- **Anonymisiert** — wer bezahlt hat, hat eine Rechnung. Die sind nach **§ 147 AO zehn Jahre** aufzubewahren. Die Person verschwindet, die Buchung bleibt lesbar.

Wer beides „löschen" nennt und gleich behandelt, verletzt eines der beiden Gesetze. **Nicht der Klickende entscheidet, sondern der Zustand der Daten** — und der Dialog zeigt es vor dem Klick: zwei getrennte Zähler, je Person die Begründung im Klartext, dazu der Satz „N Einträge löschen", der wörtlich getippt werden muss. Ein Kontrollkästchen klickt man weg; einen Satz mit einer Zahl tippt man nicht versehentlich.

Vorschau und Ausführung benutzen **dieselbe** Einteilungsfunktion — eine zweite daneben wäre genau der Fehler, bei dem ein Kunde verschwindet, dessen Rechnung noch gebraucht wird. Jede Löschung steht mit Vorgangskennzeichen in `fiaon_loeschungen`. Massenlöschung nur Betreiber.

Im Prüfstand wird das mit echten Daten durchgespielt: Lead weg samt Bestellung, bezahlter Kunde anonymisiert, **Rechnungsnummer und Betrag weiterhin lesbar**, danach in keiner Liste, keiner Suche, keiner Mail-Zielgruppe.

### Team-Zentrale

Mitarbeiter-Karten mit Umsatz und Abschlüssen des Monats, Erreichbarkeitsquote, Bestand nach Stufe, Kontakten heute/Woche, Verdienst und letzter Aktivität. Rangliste umschaltbar. Im Detail: Kennzahlen, Provisionssatz, **Nachbuchung** (von `/admin/nachbuchung` hierher, über **dieselben Endpunkte** — kein zweiter Weg, der eines Tages anders prüft) und das **Protokoll**.

Das Protokoll ist die „genaue Klicks"-Antwort: durchsuch- und filterbar über `fiaon_agent_events` und `fiaon_contact_log`. **Es wird nichts Neues mitgeschrieben** — alles stand seit Monaten in der Datenbank und war nur nie an einem Ort lesbar.

**Nachrichten und Banner:** Eine persönliche Nachricht erscheint im Team-Portal über allem und bleibt, bis der Mensch „Verstanden" klickt oder die Frist abläuft. Der Klick ist der Zweck — die Leitung sieht danach, wer wann bestätigt hat. „Ereignis verkünden" erzeugt genau einen angepinnten Beitrag im Space, optional mit Banner.

### Navigation: alt → neu

| bisher | jetzt |
|---|---|
| Anträge & KYC | Kunden-Zentrale, Filter „KYC zu prüfen" |
| Kunden & Zuordnung | Kunden-Zentrale, Filter „Dubletten-Verdacht" |
| Leads | Kunden-Zentrale, Stufe C |
| Kündigungen | Kunden-Zentrale, Filter „Kündigungen" |
| Offene Kartei | Kunden-Zentrale (Kartei seit 03.08. stillgelegt) |
| Provisionen nachbuchen | Team-Zentrale, Mitarbeiter-Detail |

Alle sechs Adressen leiten **mit passendem Filter** um — kein Lesezeichen läuft ins Leere. Dazu ein Systempost im Space („Wo ist was hin?").

**Eine bewusste Abweichung:** Die Lead-Seite trägt eine 782-zeilige Nachfass-Maschine (Sendefenster, Bulk-Versand, Verteilung, CSV-Import). Die **Liste** ist in die Zentrale gewandert, die **Maschine** steht als „Lead-Automatik" eigenständig im Menü. Sie mit umzuleiten hätte sie unerreichbar gemacht — das wäre kein Aufräumen, sondern ein Verlust. Ebenso bleiben `/admin/team-alt` und `/admin/nachbuchung-alt` erreichbar, bis die Zentrale im Betrieb bestätigt ist.

### Was die Screenshots gefunden haben

Drei Fehler, die kein Test bemerkt hätte:

- **Die Kopfzeile erschien doppelt.** `admin()` umschließt jede Seite bereits mit `AdminShell` — meine beiden neuen Seiten taten es nochmal.
- **„Erreichbar" stand bei allen auf einem Strich.** Ich zählte `type = 'call'` — den Wert gibt es nicht. Anrufversuche sind `type = 'result'` mit Ergebnis. Jetzt: 16 %, 19 %, 13 %, 31 %.
- **13 px abgeschnittener Text auf 380 px** (vom Schmal-Prüfstand). Die Mobilzeile bricht jetzt um statt abzuschneiden — „Bezahlt · Bonitätsauskunft inkl. Handlun…" sagt weniger als gar nichts.

### Prüfstand

`scripts/pruef-zentralen.ts` — **90 Prüfungen, alle grün**, zurückgerollt. Gegenprobe: Wird die Einteilung ausgehebelt (bezahlte Kunden endgültig löschen) oder die Bestätigungspflicht entfernt, wird er rot — inklusive „Der bezahlte Kunde EXISTIERT noch".

Er hat außerdem eine Regression in `pruef-mail` aufgedeckt: Der dortige Besitzschutz-Test legte eine Person ohne jeden Kontakteintrag an — also ohne echten Betreuer. Er stellt jetzt einen nach und prüft zusätzlich den Umkehrfall (Testkonto als „Betreuer" schützt nicht).

Gesamt: **827 Prüfungen** über acht Prüfstände, alle grün.

**Zu finden:** `server/lib/fiaon-kundenzentrale.ts`, `fiaon-loeschen.ts`, `server/routes/fiaon-zentralen.ts`, `client/src/pages/admin-kunden.tsx`, `admin-team-zentrale.tsx`, `client/src/components/Umleitung.tsx`, `db/migrations/044_zentralen.sql`.

## 09.08.2026 — Die Plattform hört auf zu behaupten: gemessene Zustellung, ein Sendeweg, Zugang retten

### Der Kernfehler: eine Warnung, die den Betreiber zu Unrecht beschuldigt hat

Auf `/admin/events` stand bei rund zehn Ereignissen **„MAKE-ZWEIG FEHLT"**. Diese Aussage kam aus einer einzigen Zeile:

```
makeBranchReady: !e.recommendationOnly && !/Betreiber-TODO/i.test(e.description)
```

Die Plattform prüfte also, ob in **unserer eigenen Beschreibung** das Wort „Betreiber-TODO" steht — ein Notizzettel, den frühere Pakete hinterlassen hatten. **23 von 33 Beschreibungen** enthielten den String. In Wahrheit waren alle 21 Make-Zweige aktiv. Die Plattform hat den Betreiber beschuldigt, seine Einrichtung sei falsch, und er hat es geglaubt, weil es dastand.

Die Heuristik ist ersatzlos weg — samt allen vier Anzeigestellen (`admin-events`, `admin-kunde`, `admin-funktionen`, und dem Feld `makeBranchReady` selbst). An ihrer Stelle steht **gemessene Wahrheit**: Ein Zweig gilt nur dann als bestätigt, wenn ein Testversand nachweislich bei Brevo angekommen ist. Alles andere heißt „noch nicht geprüft" — eine Aussage über *unseren* Kenntnisstand, nicht über jemand anderen.

**Zweig prüfen** (einzeln oder alle): Testversand über Make, danach bis zu drei Minuten die Brevo-Transactional-Events-API abfragen. Treffer → „Zweig bestätigt am [Zeit]", festgehalten in `fiaon_mail_events`. Kein Treffer → beide möglichen Ursachen im Klartext, denn von hier aus sehen sie identisch aus: *der Make-Zweig fehlt oder ist inaktiv* ODER *das Brevo-Template ist nicht aktiv oder nicht zugeordnet*. Genau diese zweite Ursache hat die alte Meldung verschwiegen und den Betreiber in die falsche Richtung geschickt. Ein späterer Fehlversuch löscht eine frühere Bestätigung nicht — er steht als Ergebnis daneben.

**Stündlicher Abgleich:** Die Protokollzeilen der letzten sieben Tage werden gegen Brevos Ereignisse gehalten. Aus „versandt" (= Make hat angenommen) wird *zugestellt*, *geöffnet*, *unzustellbar* oder *blockiert*. Schluss mit „gesendet" als Hoffnung.

### Anas Barghouti hatte keinen Zuständigen

Er klickte am 08.08. „ich habe bezahlt" — Stufe A, der heißeste Fall im Haus — und auf seiner Karte stand „kein Agent". Zuteilung geschah bisher nur im Tageslauf um sechs Uhr (nur Tier 1) und im Nachschub. **Gemessen: 755 Personen auf Stufe A oder B ohne jeden Zuständigen.**

Ab jetzt teilt `personTierAktualisieren` sofort zu — in derselben Transaktion, in der sich die Einstufung ändert, an den Mitarbeiter mit dem kleinsten offenen Bestand. Der Besitzschutz bleibt unangetastet: Wer `betreuung_seit` trägt, wird nicht umverteilt.

Nachgeholt wurden die **neun dringenden Stufe-A-Fälle** (Barghouti → Nikita). Stufe A ohne Zuständigen steht jetzt auf **0**. Die **746 Stufe-B-Fälle** habe ich bewusst **nicht** verteilt: Das brächte jeden Bestand auf 920 Personen, und das ist keine Arbeitsliste mehr, sondern ein Lager. Vorschau liegt in `reports/zuteilung-backfill.csv`, Ausführung mit `--schreiben`.

### Zehn „Justin Schwarzott" waren echte Kunden

`fiaon_agents.is_test_account` gibt es seit langem — für Kunden gab es nichts Vergleichbares. Was wir selbst beim Ausprobieren des Antragstrichters erzeugt hatten, stand in der Arbeitsliste, in der Verteilung, in der Dublettensuche und in jeder Kennzahl.

Neu: eine **admin-pflegbare Liste** (Einstellung `test_kennzeichen`) aus internen Domains, Adress-Präfixen, Namen im Haus und Testprodukten. **Sieben Einträge markiert** — vier Justin Schwarzott, „Test Test", „Dev User", Daniel Stripling. Kein Hard-Delete: Die Zeilen bleiben, sie fallen nur aus den Listen. Der Ausschluss steht in `echtePersonSql` — der einen Stelle, aus der sich jede Liste bedient.

**Die harte Grenze:** Eine bezahlte Bestellung macht unantastbar, und zwar im Code, nicht in den Einstellungen. Ein Testeintrag mit echtem Geldeingang ist ein Widerspruch — entweder ist das Geld echt oder die Buchung gehört korrigiert. Im Lauf wurde **1 bezahlter Kunde** von dieser Grenze geschützt, obwohl er auf ein Kennzeichen passt.

### Eine Tür für jede Mail

Von 29 Sendestellen protokollierten sieben. Der Rest ging unbeobachtet raus.

Die naheliegende Lösung — 29 Aufrufstellen umbauen, darunter seit Monaten laufende Zahlungswege — wäre riskant gewesen. Stattdessen protokolliert jetzt **`sendMakeWebhook` selbst**. Damit ist „kein Versand am Protokoll vorbei" keine Verabredung mehr, sondern Bauart. Doppeleinträge verhindert eine Marke, die `versendenUndProtokollieren` für die Dauer seines Aufrufs setzt und im `finally` wieder entfernt.

Darüber liegt `mailSenden` als einziger Weg für Versand von Hand: Registry-Prüfung, Rechte, Zustand, Tageslimit, Protokoll, Kundenakte, Auslöser.

### „E-Mail senden" am Kunden

Ein Knopf in Team-Karte und Admin-Akte öffnet auf dem Bildschirm eine Glas-Ebene, auf dem Telefon ein Blatt von unten. Ereignisse nach Gruppen (Zahlung, Termin, Konto, Dokumente, Lead), je Ereignis der Klartext „was geht wann an wen raus", eine Zustands-Ampel und der Verifikationsstand. **Der Grund einer Sperre steht als Text unter dem Knopf** — nicht als Wolke am Mauszeiger, die auf dem Telefon niemand sieht.

**Live-Vorschau:** Das echte Vorlagen-HTML aus Brevo (eine Stunde zwischengespeichert), `{{ params.* }}` mit den Beispielwerten der Registry gefüllt, in einem `sandbox=""`-iframe — Vorlagen sind fremdes HTML und sollen aussehen, nicht ausgeführt werden. Umschalter zwischen Bildschirm- und Telefonrahmen, letzterer mit Radius und Kerbe.

### Mail-Zentrale

Der Florentine-Fall in zwanzig Sekunden: „Hi {Anrede}, wie besprochen: {Zahlungsdaten}".

Autocomplete ab dem ersten Zeichen, **auch über alte Adressen** (Aliase) — nach einer Zusammenführung nennt der Kunde am Telefon die alte, und ohne Alias-Suche legt der Kollege einen zweiten Datensatz an. Acht Filtergruppen mit Live-Zähler, kombinierbar. Externe Adressen als gekennzeichnete Chips.

**Die Bausteine füllt der Server je Empfänger einzeln.** Das ist der ganze Punkt: Bei zwei Empfängern stehen zwei verschiedene Verwendungszwecke in zwei verschiedenen Mails. Würde der Browser das ausfüllen, bekämen beide denselben — und die Buchhaltung dürfte raten, von wem das Geld kam.

Freitext geht **direkt über die Brevo-API** (Absender `welcome@fiaon.com`, CI-Rahmen mit Impressum), nicht über Make: Jede Freitextmail bräuchte dort einen eigenen Zweig. Pflicht-Vorschau ab zwei Empfängern, „Test an mich", 200 Mails je Stunde, Team höchstens zehn Empfänger. Testeinträge, DSGVO-Gelöschte und Archivierte sind **immer** ausgeschlossen — nicht als Filteroption, sondern fest.

**KI-Assist** mit der vorhandenen Infrastruktur (`OPENAI_API_KEY`, kein zweiter Anbieter). Entwurf, Ton glätten, kürzen. Zwei Wände: Der Systemprompt verbietet Zusagen und Beratungssprache, und `entschaerfen()` prüft die **Antwort** — ein Prompt ist eine Bitte, kein Zaun. Die KI-Datei kann nicht senden; das ist Bauart, keine Einstellung.

### Zugang retten

Die Diagnose sagte längst präzise, warum jemand nicht hineinkommt. Es fehlte der Knopf daneben.

- **Setz-Link:** signiert, 60 Minuten, einmalig, nicht auf einen anderen Kunden umschreibbar. Nach dem Setzen ist der Kunde **direkt eingeloggt** — die Antwort trägt dieselben Felder wie ein erfolgreicher Login.
- **Einmal-Passwort** für den Telefonfall: 24 Stunden, genau einmal im Klartext angezeigt, **erzwungener Wechsel** beim ersten Login. Ohne Zwang bliebe ein diktiertes Passwort für immer gültig. Format ohne verwechselbare Zeichen (kein 0/O, kein 1/l/I) — am Telefon buchstabiert man sonst dreimal.
- **Zugang freischalten** für bezahlte Kunden mit klemmendem Kontozustand. Ohne gebuchte Zahlung nicht möglich; das ist die Grenze zwischen „Schieflage geradeziehen" und „Ware verschenken". Begründung ist Pflicht, alles auditiert.

### Was die Screenshots gefunden haben

Zwei Fehler, die kein Test bemerkt hätte — beide Geschwindigkeit:

- **Die Filtergruppen fehlten.** Acht sequentielle Zählungen über 4.800 Personen brauchten **8,4 Sekunden**; die Seite wartete noch, als der Screenshot fiel. Jetzt eine Abfrage mit `COUNT(*) FILTER` → **1,0 Sekunde**.
- **Das Sende-Menü hing auf „Wird geladen".** Vierzehn Zustandsprüfungen nacheinander, jede mit eigener Zustandsabfrage. Neu: `versandErlaubtViele` holt den Zustand einmal und zählt in einer Abfrage → 3,7 s auf 2,6 s. Die Entscheidungsregeln stehen dabei weiterhin nur an einer Stelle (`bewerten`).

### Prüfstand

`scripts/pruef-mail.ts` — **135 Prüfungen, alle grün**, zurückgerollt, Make und Brevo auf Attrappe. Gegenprobe: mit ausgehebelter Zahlungs-Grenze, entferntem KI-Guardrail oder abgeschalteter Ereignis-Zuteilung wird er rot.

Er ist zweimal in dieselbe Falle getappt wie am Vortag: Prüfungen, die den **eigenen Kommentar** mitmessen („Make-Zweig fehlt" steht in der Erklärung, warum es weg ist). Beide messen jetzt nur sichtbaren Text.

Gesamt: **737 Prüfungen** über sieben Prüfstände, alle grün.

**Zu finden:** `server/lib/fiaon-mail-events.ts`, `fiaon-brevo.ts`, `fiaon-zustellung.ts`, `fiaon-mail-senden.ts`, `fiaon-zentrale.ts`, `fiaon-mail-ki.ts`, `fiaon-zuteilung.ts`, `fiaon-testerkennung.ts`, `fiaon-zugang.ts`, `server/routes/fiaon-mail.ts`, `fiaon-zugang-retten.ts`, `client/src/components/SendeMenue.tsx`, `client/src/pages/mail-zentrale.tsx`, `db/migrations/043_mail_wahrheit.sql`.

**Betreiber-TODO:** `BREVO_API_KEY` hinterlegen (Brevo → SMTP & API → API Keys). Ohne ihn kann die Plattform nicht messen, ob eine Mail ankommt — sie sagt das an jeder Stelle ausdrücklich, statt etwas zu behaupten.

## 08.08.2026 — Menschen & Momentum: Startgespräche, ein Raum fürs Team, und „Agent" verschwindet

Ein Mensch überweist 99,99 € im Monat und findet danach ein Konto vor, das er sich selbst erklären muss. Ein Team, das über vier Städte verteilt arbeitet, hat kein Treppenhaus. Und intern hieß jeder Mitarbeiter „Agent" — ein Wort aus einem Callcenter-Handbuch, nicht aus einem Startup. Drei Lücken, ein Paket.

### Das Startgespräch

Jeder bezahlte Kunde bekommt beim ersten Login eine Vollbild-Tafel: **„Willkommen bei FIAON, [Vorname]"** — fünfzehn Minuten mit einem Menschen, Uhrzeit selbst gewählt. Derselbe Auftritt wie die Verpflichtungserklärung im Team-Portal: Glas nur auf der schwebenden Ebene, Haarlinien statt Balken, Eintritt aus der Tiefe.

**Kein hartes Gate.** „Später buchen" bleibt immer möglich — einen zahlenden Kunden aus seinem eigenen Konto auszusperren, wäre ein Eigentor. Danach bleibt ein dezenter Banner, und **48 Stunden nach dem ersten Überspringen genau eine Mail** (`onboarding_einladung`). Der Zeitstempel wird per `COALESCE` nur beim ERSTEN Klick gesetzt; sonst schöbe jeder weitere Besuch die Uhr nach hinten und die Erinnerung käme nie.

### Die Rolle „Onboarding"

Nach dem Muster der Vertriebsleitung: vergeben in `/admin/team`, eigener Bereich unter **/agent/startgespraeche**, für alle anderen **404** — wer die Rolle nicht hat, soll nicht einmal erfahren, dass es den Bereich gibt. Mit Rolle, aber ohne angenommene Erklärung: **403 mit Code**, denn wem nur ein Schritt fehlt, den führt man hin statt ihn wegzuschicken.

**Eigene Verpflichtungserklärung, sechs Punkte statt zwölf.** Die Vertriebs-Erklärung handelt zur Hälfte von Dingen, die das Onboarding gar nicht kann — Zahlungen buchen, zuweisen, Provisionen. Eine Erklärung, in der die Hälfte nicht zutrifft, wird überflogen, und eine überflogene Erklärung ist als Nachweis wenig wert. Die **Maschinerie** dagegen ist dieselbe: Fassung, Prüfwert über den Wortlaut, getippter Name als Unterschrift, Roboterabwehr, Widerruf. Dafür bekam `fiaon_vertrieb_zusagen` eine Spalte `bereich` statt einer zweiten Tabelle.

Der Bereich zeigt Termine als Liste und Kalender, die **Lage des Kunden lesend** (dieselbe Tafel wie im Vertrieb, nur über einen Endpunkt, der ausschließlich die eigenen Gesprächspartner freigibt), Ergebnis-Dokumentation und drei Kennzahlen. Was er **nicht** kann, steht nicht in der Zusage, sondern im Code: kein Import aus der Verbuchung, keine Provisionen, keine Vertriebslisten. Der Prüfstand misst genau diese Abwesenheit.

Startgespräche dauern **15 Minuten** statt 20 — die Dauer hängt jetzt an der QUELLE (`QUELLEN` in `fiaon-termine.ts`), nicht an einer zweiten Terminmaschine. Wer eine dritte Gesprächsart braucht (Inkasso), trägt sie dort ein und ist fertig. Buchbar sind ausschließlich Slots der Onboarding-Rolle; ein selbst gebauter Aufruf mit fremder Agenten-Kennung wird mit `falsche_rolle` abgewiesen.

### FIAON Space

Ein eigener Menüpunkt für **jede** Rolle, mit Ungelesen-Marke. Feed-Karten im CI, Avatare, „vor 2 Std", angepinnte Beiträge oben. Vier Reaktionsmarken — Daumen, Herz, Stern, Blitz — als **selbst gezeichnete SVG**, 1,5 px, `currentColor`. Bewusst vier und nicht zwölf: Eine große Auswahl macht aus einer Zustimmung eine Entscheidung.

**Auto-Posts vor sieben Uhr:** der „Gedanke des Tages" aus **90 kuratierten Sätzen** (kein Spruch zweimal in 90 Tagen — Ringpuffer, kein Zufall, der nach dem Geburtstagsparadox schon in Woche drei doppelt) und „Heute weltweit" über die freie Nager.Date-API, DACH ausgeschrieben, der Rest als eine Zeile. **Fällt die API aus, fällt der Post stumm aus** — ein Post „Feiertage konnten nicht geladen werden" ist Müll im Feed. Schlagzeilen aus dem tagesschau-RSS liegen hinter dem Flag `SPACE_NEWS` und sind **standardmäßig aus**: Nachrichten in einem Arbeitsraum ziehen Aufmerksamkeit und laden zu Diskussionen ein, die nicht hierher gehören. Idempotenz erzwingt ein eindeutiger Index, nicht eine Prüfung davor.

**Keine Kundendaten im Space** — als stiller Hinweis am Feld UND als Wand im Server. Abgewiesen werden Rufnummern (auch mit Leerzeichen und Schrägstrichen), IBANs, E-Mail-Adressen und Verwendungszwecke im Hausformat, jeweils mit Begründung im Klartext. Das ist keine Prinzipienreiterei: Den Space sieht **jede** Rolle, auch die, die diesen einen Kunden nie betreuen darf. Was die Prüfung nicht kann, ist Namen erkennen — deshalb steht der Hinweis trotzdem am Feld. Die Wand fängt das Grobe, die Kultur den Rest.

### „Agent" verschwindet aus der Sicht

**Routen, Tabellen und Bezeichner bleiben unangetastet** — kein Risiko-Umbau. Geändert wurde nur, was ein Mensch liest: **162 Zeilen** in 15 Dateien.

- Die Kopfzeile heißt **„Team"** statt „Mitarbeiter", die Startseite grüßt mit **Tageszeit und Vornamen** („Guten Morgen, Daniel").
- 16 sichtbare Stellen „Agent/Agenten" → „Team", „Teammitglied", „Zuständige:r".
- **Die Kundenstrecke duzt durchgängig.** 89 Fundstellen in sechs Dateien plus `naechste-schritte.tsx`, das bei der ersten Suche durchrutschte und erst im Screenshot auffiel („Wir beschaffen Ihre vollständige Bonitätsauskunft" — mitten im Dashboard).
- Die automatische Ersetzung hat dabei **Grammatik zerbrochen**: „Sofern du in den letzten 6 Monaten deinen Hauptwohnsitz gewechselt **haben, geben Sie** bitte …". Elf solcher Mischformen wurden von Hand geradegezogen. Eine Textersetzung über 89 Stellen ohne anschließenden Blick auf jede einzelne wäre fahrlässig gewesen.

**Compliance, ungefragt mitgeprüft und behoben:** Die öffentlichen Seiten nannten FIAON **sechsmal einen „Beratungsservice"**, warben mit „12.400+ Beratungen" und fragten „Was kostet die Beratung?". Für ein SaaS- und Begleitangebot ohne Erlaubnis nach § 34c/34f GewO ist das genau das Wort, das dort nicht stehen darf. **20 Fundstellen bereinigt** (→ „Begleitungs- und Softwareangebot", „Gespräche", „Erstgespräch"). Stehen bleibt eine Stelle in den AGB — dort steht das Wort in einem Verbotstatbestand („der Nutzer darf nicht als Berater auftreten") und ist richtig.

### Versandzentrum

„Der Kunde sagt, er hat die Zahlungsdaten nie bekommen" war bisher eine Nachricht an den Betreiber. Jetzt steht in der Kundenkarte unter **„E-Mails"** die Versandhistorie aus `fiaon_mail_log` — Ereignis, Zeitpunkt, Ausgang, bei Fehlschlag der Grund — und daneben Knöpfe zum erneuten Senden. Drei Wände, alle serverseitig:

1. **Zustand.** Keine Zahlungsaufforderung an Bezahlte, kein Terminlink an Gesperrte, keine Zugangsmail an Unbezahlte. Der Grund steht **im Klartext unter dem Knopf**, nicht als Wolke am Mauszeiger, die auf dem Telefon niemand sieht.
2. **Tageslimit.** Höchstens drei manuelle Sendungen je Kunde, Ereignis und Tag. Automatische Sendungen zählen nicht mit.
3. **Rechte.** Teammitglied nur für eigene Kunden, Leitung für alle, Onboarding nur Startgespräch und Zugang.

Jeder Versand steht mit Auslöser im Protokoll („erneut gesendet von Daniel") und im Kundenverlauf. Der Prüfstand belegt für fünf Dateien, dass **kein Versender am Protokoll vorbeischreibt**.

### Die Lehre aus dem 26-Kunden-Vorfall ist jetzt eine Wand

Am selben Tag hatte ein lokaler Entwicklungsserver einen Tageslauf gegen die Produktion gefeuert. Neu: `server/lib/fiaon-crons.ts`. **Tagesläufe starten nur bei `NODE_ENV=production` oder ausdrücklichem `CRONS=an`.** Beim Start meldet der Prozess sichtbar „Tagesläufe AUS — kein Produktionsbetrieb". Die drei mail-versendenden Schleifen (Follow-up, Rückruf-Erinnerungen, Zahlungserinnerungen) laufen jetzt durch diese eine Tür; der Abo-Motor hatte die Bremse schon.

### Was die Screenshots gefunden haben

Drei Fehler, die kein Test bemerkt hätte:

- **Zwei Vollbild-Tafeln übereinander.** Die bestehende Willkommens-Tour und das Startgespräch-Gate erschienen gleichzeitig. Das Gate wartet jetzt auf sie.
- **„Willkommen bei FIAON, Zafer ."** — der Vorname trug ein Leerzeichen am Ende, der Punkt rutschte in die nächste Zeile.
- **Ein Gate, das nichts anbieten kann.** Solange niemand die Onboarding-Rolle hat, gibt es keine Slots — die Tafel zeigte „Gerade sind keine Zeiten frei" und hielt einen zahlenden Kunden auf, ohne ihm etwas zu geben. Sie erscheint jetzt gar nicht erst.

### Prüfstand

`scripts/pruef-menschen.ts` — **153 Prüfungen, alle grün**, in einer zurückgerollten Transaktion, Webhook auf `.invalid`. Keine echte Mail, kein bleibender Post. Gegenprobe gemacht: Mit abgeschalteter Rufnummern-Sperre und ausgehebelter Zustandsprüfung wird er rot.

Auch dieser Prüfstand ist zunächst in die bekannte Falle getappt: Seine Schlusskontrolle verglich Zeilenzahlen auf **Gleichheit** und schlug fehl, weil sich während des Laufs ein echter Besucher registriert hatte. Jetzt misst er, was er verantwortet — nichts darf schrumpfen, und von den eigenen Testdaten darf keine Zeile übrig sein.

**Zu finden:** `server/lib/fiaon-space.ts`, `server/lib/fiaon-gedanken.ts`, `server/lib/fiaon-versand.ts`, `server/lib/fiaon-crons.ts`, `server/lib/fiaon-onboarding-zusage.ts`, `server/routes/fiaon-startgespraech.ts`, `server/routes/fiaon-onboarding-bereich.ts`, `client/src/pages/agent/space.tsx`, `client/src/components/StartgespraechGate.tsx`, `db/migrations/042_menschen_space.sql`.

**Noch zu tun (Betreiber):** Die Onboarding-Rolle vergeben — **solange sie niemand hat, kann kein Kunde ein Startgespräch buchen.** Dazu der Make-Zweig `onboarding_einladung` (Variablen: `vorname`, `termin_link`).

## 08.08.2026 — Lead-Pipeline: die Liste sagt jetzt, WARUM sie so sortiert ist — und Kunden buchen selbst

Ein Agent öffnete morgens eine sortierte Liste und musste raten, wonach sie sortiert ist. Ein Kunde, der dreimal nicht ans Telefon ging, wurde ein viertes und fünftes Mal angerufen. Und wer bezahlen wollte, aber gerade nicht konnte, hatte auf der Bestätigungsseite genau einen Ausgang: überweisen. Drei Lücken, ein Paket.

### Die Stufen A · B · C — vorhanden, aber unbeschriftet

**Es gibt keine neue Einstufung.** Die drei Fälle trennt `priority_tier` seit Monaten korrekt; was fehlte, war der Name. „Tier 2" steht nirgends auf der Oberfläche und würde auch niemandem etwas sagen.

| | | |
| --- | --- | --- |
| **A** | Zahlung gemeldet | Der Kunde sagt, er habe überwiesen. Heißester Fall im Haus. |
| **B** | Antrag fertig, Rechnung offen | Das Geld fehlt — „Frist abgelaufen" gehört ausdrücklich dazu. |
| **C** | Lead ohne Antrag | Wird gearbeitet, wenn A und B leer sind. |

Jede Karte trägt ihre Marke, im Kopf der Liste steht der eigene Vorrat („A: 33 · B: 82 · C: 642") mit einem Satz dazu: *„115 in der Pflicht — Stufe C wird erst danach gearbeitet."* Ganz oben stehen jetzt **gebuchte Termine des Tages** — vor Zusagen und Rückrufen, denn dort wartet jemand zu einer Uhrzeit, die er sich selbst ausgesucht hat.

**Stufe C war leer, und niemandem ist es aufgefallen.** 2.518 Lead-Personen lagen im Bestand, davon **null** einem Agenten zugeteilt: `nachschub()` füllte nur Tier 1 und 2 auf. Der Filter „Leads" konnte seit seiner Einführung gar nichts anzeigen. Jetzt füllt der Nachschub **A vor B vor C** auf, und die vorhandenen **2.566 Leads sind gleichmäßig verteilt** (je rund 642 auf Daniel, Florentine, Lucas, Nikita). Umkehrbar, solange niemand angerufen hat: `scripts/leads-verteilen.ts --zuruecknehmen`.

### Schluss mit dem fünften Anruf

Der Zähler `unreachable_count` wurde seit jeher hochgezählt — und **nie gelesen, nie zurückgesetzt.** Im Bestand: 258 Personen mit mindestens einem Fehlversuch, 36 mit vier oder mehr, einer mit **acht**.

- **Nach dem 2. Versuch** geht automatisch eine Mail mit persönlichem Terminlink raus. **Genau einmal je Kunde in 30 Tagen** — nicht bei jedem weiteren Versuch. Ohne hinterlegte E-Mail erscheint auf der Karte der Knopf **„Terminlink per WhatsApp senden"**.
- **Nach dem 4. Versuch** sinkt der Fall in den **Ruhe-Pool**: Wiedervorlage +14 Tage, raus aus der Tagesliste. Nicht gesperrt, nicht gelöscht, Stufe bleibt. Beim Wiederauftauchen steht auf der Karte, was schon versucht wurde: *„4× nicht erreicht, zuletzt 21.07.2026, Terminlink versandt 22.07.2026."*
- **Stufe A ruht nicht.** Dort hängt gemeldetes Geld, das jemand verifizieren muss.
- **Jedes `erreicht_*` und jede Terminbuchung setzt den Zähler auf 0.** Sonst schleppt jemand, der vor Monaten zweimal nicht dranging, diese Vorgeschichte für immer mit sich.

Der Ruhe-Pool ist ein **Filter** („Ruhend"), kein verstecktes Loch; die Vertriebsleitung sieht die Gesamtzahl im Vertriebsbereich.

### Terminsystem

Slots à 20 Minuten, Mo–Fr 09:00–18:00 als Vorgabe, frühestens in 2 Stunden, längstens in 14 Tagen, alles Europe/Berlin. Jeder Agent stellt seine Zeiten in `/agent/profil`; die Vertriebsleitung kann sie fürs Team setzen (ohne individuelle Zeiten stillschweigend zu überschreiben).

**`/termin/:token`** ist login-frei — ein signiertes Token nach dem Muster der Rechnungs-Links. Wer einen Betreuer hat, sieht **nur dessen** Zeiten: Niemand bucht sich von seinem Betreuer weg. Wer keinen hat, sieht die Zeiten aller und wird durch die Buchung **auf den gewählten Agenten gepinnt** — über denselben `betreuung_seit`, den Nachschub und Erstverteilung längst respektieren. Kein zweiter Schutzmechanismus.

**Eine Uhrzeit, ein Knopf.** Der erste Entwurf zeigte ohne Betreuer jede Zeit viermal (09:00 Daniel, 09:00 Florentine, …) — bei vier Agenten, 27 Slots und 14 Tagen rund **1.500 Knöpfe** auf einem Telefon. Ein Kunde wählt eine Zeit, keine Person; er kennt keinen der Namen. Jetzt steht jede Zeit einmal da, und es bekommt sie der Agent mit den wenigsten anstehenden Terminen. Angezeigt werden drei Tage, der Rest auf Knopfdruck: **81 statt 378 Knöpfe**, kein Überlauf bei 380 px.

Auf der Bestätigungsseite nach dem Antrag stehen jetzt **zwei gleichwertige Wege**: „Jetzt überweisen" (Zahlungsdaten mit Verwendungszweck direkt darunter) und „Wunschtermin buchen". Bisher gab es genau einen Ausgang — wer ihn nicht nahm, schloss den Tab und wurde danach viermal vergeblich angerufen.

Jede Bestätigung enthält einen Storno-Link; Umbuchen ist Absagen plus neu wählen auf derselben Seite. **„Kunde nicht erschienen"** zählt wie ein erfolgloser Anruf — sonst könnte jemand zehn Termine platzen lassen, ohne dass die Automatik es je bemerkt.

### Drei Dinge, die dieser Bau sichtbar gemacht hat — alle dieselbe Sorte Fehler

Ein interner Vorgang darf nicht als Kundenkontakt zählen. Dreimal getroffen, dreimal derselbe Kern:

1. **`assigned_at` galt als „letzter Kontakt".** Die Spalte sagt, wann ein Agent die Person bekam — ein Buchhaltungsereignis. Weil die Erstverteilung am 03.–08.08. lief, sah jeder Kunde frisch kontaktiert aus: Von 283 Kandidaten für den Wiedereinstieg blieben **3** übrig.
2. **Eine Systemnotiz galt als Kundenkontakt.** Ausgerechnet die Notiz über eine *fehlgeschlagene* Mail setzte die Stille-Uhr auf null und leerte die Zielgruppe erneut auf **0**. Gemessen wird jetzt nur, was ein **Mensch** dokumentiert hat (`type <> 'system' AND agent_id IS NOT NULL`).
3. **Ein toter Kanal wurde wie 26 einzelne Fehlschläge behandelt.** Der Entwicklungsserver führte den neuen Tageslauf gegen die Produktion aus; ohne `MAKE_WEBHOOK_URL` ging keine einzige Mail raus — **26 echte Kunden waren trotzdem als „angeschrieben" markiert** und damit dauerhaft aus der Zielgruppe. Zurückgesetzt. Jetzt läuft die Staffel ohne Kanal gar nicht erst an und bricht ab, wenn die ersten drei ohne einen einzigen Erfolg scheitern. Dieselbe Bremse hat die Terminerinnerung bekommen.

Dazu ein vierter, kleinerer: Das **Versandprotokoll schrieb an der Transaktion vorbei** (`sqlPool` statt der übergebenen Verbindung). Im Prüfstand überlebten fünf Zeilen den Rollback; in einer scheiternden Transaktion hätte „versandt" für etwas gestanden, das nie stattgefunden hat.

### Wiedereinstieg statt Spät-Mahnung

`scripts/wiedereinstieg.ts`: Stufe A oder B, offene Zahlung, seit 14+ Tagen still, E-Mail vorhanden. **Ausgeschlossen:** bezahlt, abgelehnt, gesperrt, DSGVO, Testkonten, Kunden mit Termin und Kunden, die den Terminlink schon über die Nicht-erreicht-Automatik bekamen. **Aktuell 34 Personen.** Höchstens 50 am Tag — nicht aus Vorsicht vor der Technik, sondern weil 269 Mails auf einmal 269 mögliche Rückrufe an einem Vormittag erzeugen und die Zustellbarkeit einer Domain ruinieren, die sonst 20 Mails am Tag verschickt. Kennzahl im Vertriebsbereich: versandt / gebucht / Quote.

### Drei neue Ereignisse, ein Versandprotokoll

`nicht_erreicht_termin`, `termin_bestaetigung`, `termin_erinnerung` — flach, an `MAKE_WEBHOOK_URL`, im bestehenden Muster. Fehlt die Make-Route, **stürzt nichts ab**: Der Versuch landet als `fehlgeschlagen` mit Grund in der neuen Tabelle `fiaon_mail_log` **und** im Kundenverlauf (*„… VERSAND FEHLGESCHLAGEN. Der Kunde hat nichts erhalten."*). Ohne diesen Satz liest ein Agent „Terminlink versandt" und ruft nicht mehr an, während der Kunde nie etwas bekommen hat.

### Prüfstand

`scripts/pruef-pipeline.ts` — **137 Prüfungen, alle grün**, in einer zurückgerollten Transaktion, Webhook auf einer `.invalid`-Attrappe. Keine echte Mail, keine bleibende Zeile. Geprüft werden unter anderem: die vollständige Sortierung mit Testdaten aller Stufen, der Aufstieg nach A durch eine Zahlungsmeldung, das Verschwinden des Selbstzahlers, genau eine Mail bei vier Fehlversuchen, der Ruhe-Pool samt Ausnahme für Stufe A, **zwei gleichzeitige Buchungen auf denselben Slot (genau eine gewinnt)**, 22:00 Berlin im Sommer wie im Winter, Vorlauf und Horizont, Raster-Umgehung über eine selbst gebaute Anfrage, Besitzschutz in beiden Richtungen, Einmaligkeit des Storno-Tokens, jede einzelne Ausschlussregel des Wiedereinstiegs und die Neustart-Festigkeit der Erinnerungen. Gegenprobe gemacht: Mit wieder eingebauter Doppelmail und abgeschaltetem Vorlauf wird der Prüfstand rot.

**Zu finden:** `shared/fiaon-kundenstatus.ts` (die Stufen), `server/lib/fiaon-termine.ts` (Slots, Token, Buchung), `server/lib/fiaon-nicht-erreicht.ts` (die zwei Schwellen), `server/lib/fiaon-wiedereinstieg.ts` (Zielgruppe und Ausschlüsse), `server/lib/fiaon-mail-log.ts`, `server/routes/fiaon-termin.ts`, `client/src/pages/termin.tsx`, `db/migrations/041_termine_pipeline.sql`. Reports: `reports/leads-verteilen.csv`, `reports/wiedereinstieg.csv`, `reports/screens/`.

**Noch zu tun (Betreiber):** Die drei Make-Zweige und Brevo-Vorlagen anlegen — bis dahin steht jeder Versuch als „fehlgeschlagen" im Protokoll, und der Wiedereinstieg startet bewusst nicht.

## 08.08.2026 — Massen-Zusammenführung: 652 doppelte Personensätze aufgelöst, Kandidatenliste leer

Die Kartei kannte Menschen mehrfach. „Klaus Michael Laschinger" lag **zwanzigmal** — dieselbe Rufnummer, dasselbe Geburtsdatum, dieselbe Adresse, zwanzig Karten mit Tippfehlern („Mochael", „Lsschinger"). „Mario Fricker" neunmal, „Reinhold Petzsche" dreizehnmal. Über Paare war das nicht zu räumen: 1.102 Vorschläge, von denen sich neun Zehntel von selbst erledigen, sobald der erste entschieden ist. Niemand klickt das durch.

**Ergebnis: 4.752 → 4.106 lebende Personen. 652 Sätze sind zu ihrem Menschen gewandert, 320 Paare sind als „keine Dublette" abgehakt, die Kandidatenliste steht auf null.** Nichts wurde gelöscht: Jeder aufgelöste Satz bleibt als Wegweiser (`merged_into_person_id`) bestehen.

### Gruppen statt Paare

Jede belegte Übereinstimmung ist eine Kante, jede Zusammenhangskomponente ein Mensch. Die zwanzig Laschinger-Sätze sind damit EINE Gruppe mit EINEM Ziel statt 190 Paar-Entscheidungen. Der Gewinner steht fest, bevor der erste Satz bewegt wird: **bezahlte Bestellung** (bei mehreren die jüngste Zahlung), sonst **jüngster dokumentierter Kontakt**, sonst **älteste Personen-ID**. Danach wandert jeder andere Satz einzeln über die bestehende Merge-Maschine hinein — mit Zählprobe, Alias-Sicherung und Rücknahme bei jedem Zweifel.

### Was automatisch zusammengeführt wurde — und was nie

Jedes Kriterium verlangt **zwei** übereinstimmende Merkmale. Ein einzelnes beweist nichts, und der Bestand hat die Gegenbeispiele selbst geliefert.

| | Kriterium | Fälle |
| --- | --- | --- |
| A | gleiche E-Mail **und** gleiche Rufnummer | 0 |
| B | gleiche Rufnummer **und** gleicher Nachname **und** Vornamen vereinbar | 586 |
| C | gleiche Rufnummer **und** gleiches Geburtsdatum | 17 |
| D | gleiche E-Mail **und** Namen vereinbar | 25 |
| E | gleicher Nachname **und** gleiches Geburtsdatum **und** Vornamen vereinbar | 24 |

„Vornamen vereinbar" heißt: gleich, Kurzform („Alex" in „Alexander"), oder ein Tippfehler-Abstand von höchstens zwei Zeichen — bei kurzen Namen nur einem, denn zwei Änderungen an vier Buchstaben sind kein Vertipper mehr, sondern ein anderer Name („Lisa"/„Lena").

**Nie automatisch:** Testdatensätze, Attrappen-Nummern, DSGVO-gelöschte Bestellungen, gesperrte Konten — und vor allem **Haushalte**. „Franz Molk" und „Gerda Molk" teilen einen Anschluss und sind zwei Menschen; „Nicole" und „Athanasios Sotirios Xanthos" ebenso; „semra" und „erhan kartal" ebenso. Diese Paare verschwinden nicht stillschweigend, sie werden mit Begründung als **„keine Dublette"** hinterlegt (`fiaon_dubletten_entschieden`, rücknehmbar) — deshalb ist die Liste danach leer, ohne dass etwas übersehen wurde.

**Die 14 blockierten Betreuer-Konflikte sind entschieden**: Zuständig wird, wer zuletzt dokumentiert mit dem Menschen gesprochen hat. Jede dieser Entscheidungen steht einzeln im Protokoll (`person_betreuer_entschieden`) und im Report. **Gebuchte Provisionen sind unangetastet** — sie hängen an der Bestellung, nicht an der Zuständigkeit; nachgewiesen im Prüfstand und nachgezählt: 334 vor und nach dem Lauf.

### Nach jedem Gruppen-Merge

Produkt-Hygiene je Gewinner (höchstens eine offene Stufe; die Bonitätsauskunft für 74 € ist ein **Zusatzprodukt** und bleibt immer daneben bestehen), genau ein Agent, `betreuung_seit` auf den ältesten dokumentierten Kontakt der Gruppe. Die Wiedervorlage: Es überlebt der **nächstliegende** Termin. „Die zuletzt geplante" wäre die andere mögliche Lesart, aber die Daten geben sie nicht her — wann eine Wiedervorlage gesetzt wurde, steht nirgends. Der nähere Termin verliert keinen zugesagten Anruf.

### Wellen und Notbremse

Jede Gruppe läuft in **einer** Transaktion samt Hygiene und Zuständigkeit; bricht etwas, ist diese Gruppe unberührt. Nach jeder Welle von 50 Gruppen werden Invarianten geprüft: Bestellungen, Verwendungszwecke, Provisionen und Leads exakt gleich, Verlaufseinträge nie weniger (sie wachsen — jeder Merge schreibt seine Klartext-Notiz in die Akte). Gemessen über den ganzen Lauf: **6.607 → 6.608 Bestellungen** (eine neue von einem echten Kunden), **Verwendungszwecke unverändert**, **Provisionen unverändert**, **347 bezahlte Bestellungen unverändert**.

### Vier Fehler, die dieser Lauf sichtbar gemacht hat

*Die Merge-Maschine scheiterte an ihrem eigenen Index.* Auf `fiaon_person_aliases.value_norm` liegt ein hausweit eindeutiger Index für E-Mails. Der Merge sicherte die abweichende Adresse des Verlierers beim Gewinner, **bevor** er dessen Alias umhängte — und kollidierte mit dem Verlierer, der sie noch hielt. Jede Gruppe mit zwei Adressen fiel aus, darunter die größten. Behoben: Aliase wandern zuerst; eine Adresse, die schon jemandem gehört, wird nicht doppelt angelegt. Eigener Test in `scripts/pruef-merge.ts`.

*Die Notbremse hielt den Betrieb für einen Datenverlust.* Nach der ersten Welle stoppte der Lauf: „Bestellungen ohne Person: 3.550 → 3.551". Nachgesehen: fünf echte Besucher hatten in zwei Stunden ein Formular begonnen, kein einziger Fall kam aus einem Merge. Eine Invariante, die den laufenden Betrieb mitmisst, schlägt irgendwann grundlos Alarm — und wer zweimal grundlos gestoppt wurde, schaltet sie ab. Verwaiste Bestellungen werden jetzt **je Gruppe** geprüft, genau dort, wo der Lauf etwas anfasst.

*29 Bestellungen trugen eine Adresse, die ihr eigener Personensatz nicht kannte.* Dadurch blieben 24 offensichtliche Dubletten unsichtbar — „Peter Dziuba" zweimal, „Nina Feiler" zweimal, „Marco Franz" zweimal. Die Kundenakte fasst einen Menschen ohnehin über die Kontaktdaten seiner **Bestellungen** zusammen; die Zusammenführung tat es nicht. Zwei Begriffe für „dieselbe Person" sind schlimmer als ein fehlender. Jetzt zählen auch die Kontaktdaten der Bestellungen — die 24 sind zusammengeführt.

*Der Zähler im Menü meldete „44 Dubletten", während der Arbeitsplatz daneben leer war.* Er zählte doppelte **Bestellungen** — also Kunden mit mehreren Bestellungen, die seit heute an einer Person hängen. Fünf Zeilen eines Kunden sind seine Historie, keine Dublette. Zähler und Liste zeigen jetzt nur noch, was wirklich zwei Menschen betrifft: **456 → 18 Gruppen**, davon 10 bewusst getrennte Haushalte und 8 offene Leads neben einer aktiven Bestellung.

Dazu ein fünfter, kleinerer: Die Akte forderte bei einem Kunden „zwei offene Stufen — bitte bereinigen", während der Aufräum-Lauf „nichts zu tun" meldete. Beide hatten recht: Ein **angefangener** Antrag (`pending`, nie eine Rechnung angefordert) ist ein Trichter-Entwurf und keine offene Stufe. Beide benutzen jetzt dieselbe Liste (`OFFENE_STUFE`).

### Roboter-Unterschrift entfernt

Die vom Playwright-Testlauf erzeugte Annahme der Verpflichtungserklärung (Fassung 2.0, Agent 8, 127.0.0.1, HeadlessChrome) war bisher entwertet, aber vorhanden. Sie ist jetzt **aus der Nachweistabelle entfernt** — die eine begründete Ausnahme von „keine Hard-Deletes": Die Regel schützt Daten von Menschen, und diese Zeile war keine. Damit trotzdem nichts unerklärt verschwindet, steht die **vollständige Abschrift** mit IP, Kennung, Zeitpunkt und Text-Prüfsumme als Ereignis `vertrieb_zusage_geloescht` im Protokoll. Die beiden echten Unterschriften (Daniel Stripling, Fassung 1.0, von seiner eigenen Leitung; Florentine Lombardi, Fassung 2.0) sind unberührt. Daniel Stripling wird beim nächsten Öffnen nach Fassung 2.0 gefragt — was der Wahrheit entspricht: Er hat sie nie unterschrieben.

### Prüfstand

`scripts/pruef-massen-merge.ts` — **84 Prüfungen, alle grün**, in einer Transaktion, die zurückgerollt wird. Geprüft werden unter anderem: die Kette (A~B über Telefon, B~C über E-Mail ergibt EINE Gruppe), der Haushalt (Franz/Gerda werden nicht zusammengeführt und sind danach abgehakt), Abo + Bonitätsauskunft nebeneinander, drei offene Stufen aus drei Sätzen werden eine, der Betreuer-Konflikt mit eingefrorener Provision, jede Regel der Gewinnerwahl, alle Invarianten einzeln — und dass eine gescheiterte Gruppe die vorherige unversehrt lässt.

**Zu finden:** `server/lib/fiaon-massen-merge.ts` (Kriterien, Gruppen, Invarianten), `server/lib/fiaon-produkt-hygiene.ts` (die Hygiene-Regel, jetzt für Lauf und Merge dieselbe), `scripts/massen-merge.ts` (Vorschau, Wellen, Notbremse), `scripts/pruef-massen-merge.ts`. Reports: `reports/massen-merge-vorschau.csv`, `reports/massen-merge-ergebnis.csv`.

## 08.08.2026 — Fundament B: jede Bestellung hat einen Verwendungszweck, jeder Status eine Begründung

Fünf Dinge, die im Alltag Geld und Vertrauen gekostet haben. Ein Kunde ohne E-Mail bekam die Zahlungsdaten am Telefon vorgelesen — **ohne Verwendungszweck**, und in der Buchhaltung lag Geld ohne Namen. Ein ganzer Name stand in einem Feld („Vorname: NADINE MUELLER"), weshalb derselbe Mensch mehrfach angelegt wurde. Eine Agentin hielt einen Kunden für bezahlt, weil an einer Stelle „Antrag abgeschlossen, keine Zahlung" stand — ein Satz, der sich selbst widerspricht. Ein Kunde hatte zwei offene Produktstufen und damit zwei Rechnungen und zwei Mahnketten. Und wenn ein Kunde sagte „ich habe überwiesen", lag sein Screenshot in einer WhatsApp-Gruppe statt im System.

### Teil 1 — Der Verwendungszweck entsteht mit der Bestellung, nicht mit der Rechnung

Er wurde früher erst beim Rechnungsversand erzeugt. Wer vorher anrief, hatte keinen. Jetzt hängt er **bedingungslos** an der Bestellung: ein Datenbank-Trigger setzt ihn beim Anlegen (Migration 037), die Spalte ist `UNIQUE` **und** `NOT NULL` (Migration 039). Nachgetragen wurden **5.757 Bestellungen**; heute gilt für alle **6.597 Bestellungen: 6.597 Verwendungszwecke, alle verschieden**. Die Vergabe steht an einer Stelle (`server/lib/fiaon-verwendungszweck.ts`).

**Die Umsatzdefinition ist bewusst unverändert geblieben.** Sie hing an „hat eine Zahlungsreferenz" — was gestern „Rechnung gestellt" bedeutete und ab heute „existiert" bedeuten würde. Ohne diese Trennung hätte der Funnel plötzlich jeden abgebrochenen Formularaufruf als Antrag gezählt (`server/lib/fiaon-truth.ts`, `server/routes/fiaon-finance.ts`).

**Auf der Kundenkarte** steht der Verwendungszweck jetzt immer sichtbar, mit einem Knopf, der Empfänger, IBAN, Betrag und Zweck als fertigen Text in die Zwischenablage legt — Bankverbindung und Text kommen vom Server, damit Vorlesen und Mail nicht auseinanderlaufen können.

### Teil 2 — Der Eingang trennt Namen und erkennt Doppelte, bevor sie entstehen

`server/lib/fiaon-name.ts` trennt „NADINE MUELLER" in Vor- und Nachnamen und lässt Namensteile wie „von der", „di", „Mc" zusammen. Der Lead-Eingang benutzt das, hängt einen neuen Eintrag **nur bei eindeutigem Treffer** an eine bestehende Person und antwortet mit `personId` und `neuAngelegt` — vorher konnte der Absender nicht erkennen, ob er einen neuen Menschen erzeugt hat. **Bei Mehrdeutigkeit wird nichts zusammengeführt**, sondern ein Kandidat für den Dubletten-Arbeitsplatz hinterlassen; automatisches Zusammenführen im Personenmodell ist entfernt.

Nachtrag über den Bestand (`scripts/namen-splitten.ts`, Vorschau zuerst): **2.311 Personen** und **3.162 Leads** getrennt. Jeder ursprüngliche Wert steht als Alias in `fiaon_person_aliases` (9.751 Einträge) und ist über die Suche auffindbar — der alte Schreibweise-Treffer geht nicht verloren.

### Teil 3 — Ein Status, eine Quelle, und daneben steht, woraus er folgt

Das Vokabular liegt in `shared/fiaon-kundenstatus.ts`, damit Server und Oberfläche **dieselben** Wörter benutzen. „Kunde meldet Zahlung" trägt den Pflicht-Zusatz **„noch nicht bankbestätigt"** — ohne ihn liest jemand „Zahlung" und hört auf zu prüfen. „Frist abgelaufen" bleibt ein Etikett und ändert den Status nicht. Der widersprüchliche Titel „Antrag abgeschlossen, keine Zahlung" ist fort. Angeschlossen sind Agentenliste, Vertrieb, Kundenakte, Kundenliste, „Meine Kunden" und das Detailfenster.

**Neu in der Akte: der Block „Warum dieser Status?"** — welche Bestellung maßgeblich ist, welches Ereignis zuletzt gewirkt hat, mit Datum, dazu der rohe Zahlungsstand und die Frist. Ein Status ohne Begründung ist eine Behauptung; wer ihn anzweifelte, konnte nirgends nachsehen.

### Teil 4 — Ein Konto, eine Stufe

`server/lib/fiaon-produktstand.ts` fasst zusammen, was ein Kunde **hat**: eine Stufe plus Zusatzprodukte, in einer Zeile („Pro (59,99 €/M)"). Ersetztes, storniertes und archiviertes steht darunter, eingeklappt — nicht weg, nur nicht die Antwort auf die Frage. Zwei offene Stufen werden als Fehler ausgewiesen. Der Aufräum-Lauf `scripts/produkt-hygiene.ts` (Vorschau, dann `--schreiben`) hat den offenen Fall bereinigt; **heute hat kein Kunde mehr zwei offene Stufen**. Supersede läuft dabei über `person_id`, nicht über Kontaktdaten.

### Teil 5 — Der Überweisungsbeleg gehört ins System

Sagt ein Kunde „ich habe überwiesen", kann der Agent den Screenshot direkt an der Bestellung hinterlegen (Migration 040, `server/lib/fiaon-zahlungsbeleg.ts`). Er erscheint **neben dem Bankeingang in der Verbuchung** und im Vertriebsbereich — dort, wo entschieden wird. Er ist ausdrücklich **optional**: Er beschleunigt die Prüfung und blockiert nichts. Ein Beleg ist kein Zahlungsnachweis; gebucht wird weiter nur, was auf dem Konto liegt.

### Eine Roboter-Unterschrift ist entwertet — und der Server wehrt sich jetzt selbst

Am 06.08.2026 hat ein Playwright-Testlauf die Verpflichtungserklärung der Vertriebsleitung **echt angenommen**, von 127.0.0.1 mit HeadlessChrome. Diese Annahme ist widerrufen (`scripts/zusage-roboter-widerrufen.ts`, `widerrufen_am`, kein Hard-Delete) und zählt nirgends mehr. Dazu die Wand im Code: `istRoboterUnterschrift` (`server/lib/fiaon-vertrieb-zusage.ts`) lehnt Annahmen von localhost oder mit automatisierter Browserkennung ab. Und die Regel steht in `AGENTS.md` — aber eine Regel, die man vergessen kann, hat man schon vergessen; deshalb steht sie zusätzlich im Server.

### Prüfstand

`scripts/pruef-fundament-b.ts` — **93 Prüfungen, alle grün**, in **einer Transaktion, die zurückgerollt wird**. Am Ende zählt der Lauf gegen: keine Testzeile zurückgeblieben, Bestand nicht geschrumpft (6.597 Bestellungen, 4.803 Personen vor und nach dem Lauf).

### Drei Fehler, die dieser Durchgang selbst produziert hat — und was daraus folgt

*Der Serverstart hing still.* In einem SQL-Kommentar in `server/routes/fiaon-finance.ts` stand ein Wort in Backticks; das beendete das umgebende Template-Literal. `npx vite build` blieb grün — **es baut nur den Client** —, und der fehlgeschlagene Import einer Routendatei bricht den Start nicht ab, er hält ihn an: kein Fehler, keine Zeile, nur ein Prozess, der nie „serving on port" meldet. Die Lehre steht jetzt als Abnahmeschritt in `AGENTS.md`.

*Die Akte widersprach sich selbst.* Oben stand „Diese Person hat genau eine Bestellung", rechts daneben standen vier. Grund: Die Akte fasst einen Menschen über gleiche E-Mail oder Rufnummer zusammen, der neue Statusblock zählte aber nach `person_id`. Beides ist vertretbar — nebeneinander ist es unbrauchbar. Status **und** Produktstand laufen jetzt über genau die Bestellungen, die die Akte anzeigt (`statusFuerBestellungen`, `produktstandFuerBestellungen`); der Fall ist im Prüfstand festgehalten. Nebenbefund: Bei dem geprüften Kunden waren es **fünf lebende Bestellungen über fünf Personensätze desselben Menschen** — sichtbar erst durch diese Korrektur.

*Auf dem Telefon war die Akte abgeschnitten.* Auf 380 px wurden die Karten 477 px breit und der rechte Rand — Fristen, Datum, Beträge — schlicht weggeschnitten (174 zu breite Elemente gemessen). Drei Ursachen, alle behoben: Rasterzellen ohne `min-w-0` dürfen nicht unter die Mindestbreite ihres Inhalts schrumpfen; die Statusmarke stand auf `whitespace-nowrap`; und die Zeile aus Marke, Rechnungs-Link und „Archivieren" durfte nicht umbrechen (zusammen 409 px). Die Marke **umbricht** jetzt, statt zu kürzen — der Zusatz „noch nicht bankbestätigt" darf nicht wegfallen.

*Der Dubletten-Arbeitsplatz hätte Fremde zusammengeführt.* Durch den Namens-Nachtrag wurden viel mehr Doppelte sichtbar (1.102 Kandidatenpaare, davon 600 über die Rufnummer — 357 Nummern, an denen 990 Personensätze hängen). Beim Durchsehen fielen zwei Fallen auf, beide geschlossen:

- **Attrappen-Nummern.** An „…701234567" hingen **32 Datensätze**, überwiegend „Dev User" — und dazwischen ein echter „Thomas Müller". Als sichere Rufnummer-Gleichheit angeboten, hätte der erste Klick einen Kunden in einen Testeintrag geführt. Solche Nummern werden jetzt am Muster erkannt (sechs fortlaufende oder sechs gleiche Ziffern) und liefern keine Rufnummer-Kandidaten mehr; die Personen bleiben über die Namensstufen prüfbar. Paare mit „Dev User": vorher vorhanden, jetzt **null**.
- **Ein Anschluss, zwei Menschen.** Unter „…723891768" liegen 19-mal „Michael Laschinger" und einmal **„Klaus"** Laschinger. Ebenso „Franz Molk / Gerda Molk" und „Nicole / Athanasios Xanthos" — Eheleute und Familien, keine Dubletten. Diese **10 Paare** verschwinden nicht (dann könnte sie niemand beurteilen), werden aber ausdrücklich zur **Vermutung** herabgestuft, mit Begründung in der Zeile: „Vornamen weichen ab (Franz / Gerda), Familien- oder Firmenanschluss möglich".

Dazu ein neuer Prüfstand: `scripts/pruef-schmal.ts` öffnet Kundenliste, Dubletten, Verbuchung und **vier echte Akten** auf 380 px und misst, dass kein Element breiter ist als das Fenster und kein Text hart abgeschnitten wird (absichtlich rollbare Tabellen sind erlaubt). **25 Prüfungen, grün — und rot, sobald man den Fehler wieder einbaut.** Das musste erst erarbeitet werden: Die erste Fassung des Prüfstands blieb mit wieder eingebautem Fehler grün, weil sie nur Blätter im Dokument betrachtete (die zu breite Stelle war eine Zeile aus drei Knöpfen) und weil sie sich ihre Akte zufällig aussuchte. Ein Prüfstand, der nicht rot werden kann, ist eine Beruhigung, keine Prüfung.

**Zu finden:** `shared/fiaon-kundenstatus.ts`, `server/lib/fiaon-kundenstatus.ts`, `server/lib/fiaon-produktstand.ts`, `server/lib/fiaon-verwendungszweck.ts`, `server/lib/fiaon-name.ts`, `server/lib/fiaon-zahlungsbeleg.ts`, `server/lib/fiaon-vertrieb-zusage.ts`, `db/migrations/036_zusage_widerruf.sql`, `037_verwendungszweck_bedingungslos.sql`, `038_altbestand_merkmal.sql`, `039_verwendungszweck_pflicht.sql`, `040_zahlungsbeleg.sql`. Läufe: `scripts/verwendungszweck-backfill.ts`, `scripts/namen-splitten.ts`, `scripts/produkt-hygiene.ts`, `scripts/zusage-roboter-widerrufen.ts`. Prüfstände: `scripts/pruef-fundament-b.ts` (93 Prüfungen, Datenbank) und `scripts/pruef-schmal.ts` (25 Prüfungen, 380-px-Ansicht).

## 08.08.2026 — Datenfundament: kein Konto schaltet sich mehr selbst ab, und Dubletten sind endlich entscheidbar

Zwei Dinge haben die Kartei unglaubwürdig gemacht. Erstens standen Menschen doppelt im Bestand — „Axel Conrad" als Person 3775 **und** 4492, „Mario Fricker" neunmal, und ein Antrag lief unter „Magdalena", gehörte aber zu Konstantinos Nikoloudis. Der Dubletten-Erkenner fand diese Fälle seit Wochen; es gab nur kein Werkzeug, mit dem ein Mensch einen Zusammenschluss **entscheiden und ausführen** kann. Zweitens haben sich Konten von selbst abgeschaltet: Ein Kunde, der bezahlt hatte, war gesperrt, und niemand konnte sagen, wer das entschieden hatte.

### Teil 0 — Eine Deaktivierung gibt es nur durch Menschenhand

**Die Automatik ist abgestellt.** In `runPaymentReminders` (`server/routes/fiaon-antrag.ts`) stand ein stündliches `UPDATE … payment_status = 'expired'`. Es war die einzige Stelle im Haus, an der sich ein Kunde ohne jede menschliche Entscheidung selbst abgeschaltet hat: Mit `expired` fiel er aus der Erinnerungs-Engine (Status-Filter in `claimReminderBatch`) und wurde in jeder Anzeige zum Altfall. Jetzt wird an dieser Stelle nur noch **gezählt**.

**„Frist abgelaufen" ist ein Etikett, kein Zustand.** Es kommt aus `fristAbgelaufenSql` in der neuen Datei `server/lib/fiaon-bestand-filter.ts` und erfasst zwei Formen: den Altbestand (`payment_status='expired'`, 196 Zeilen, unangetastet) **und** die abgeleitete Form (offene Bestellung, Frist in der Vergangenheit). Das Etikett färbt Anzeigen und speist Filter — es ändert keinen Kontozustand, entfernt niemanden aus einer Liste und stoppt keine Erinnerung. Ein Kunde mit abgelaufener Frist ist ein Anruf, kein Abfall.

**Vollständige Liste der geprüften Abschalt-Stellen** (Auftrag: jede benennen):

| Stelle | Auslöser | Zustand | Bewertung |
| --- | --- | --- | --- |
| `fiaon-antrag.ts` `runPaymentReminders` | `setInterval`, stündlich | `payment_status='expired'` | **war Automatik → entfernt**, zählt nur noch |
| `fiaon-antrag.ts` `supersedeSisterOrders` | Zahlungsbuchung durch einen Menschen | `payment_status='superseded'` | bleibt: ausgelöst durch eine Buchung, kein Fristablauf; berührt kein Konto. Produkt-Hygiene ist Teil B |
| `fiaon-antrag.ts` `/admin/applications/:ref/gdpr-delete` | Admin, mit Bestätigung | `account_status='suspended'` | bleibt: dokumentierte Entscheidung, rechtlich geboten |
| `fiaon-antrag.ts` `/admin/payments/:paymentRef/cancel` | Admin | `payment_status='cancelled'` | bleibt: Entscheidung eines Menschen |
| `fiaon-antrag.ts` `/admin/applications/:ref/review` | Admin | `account_status` frei setzbar | bleibt — **und wird jetzt protokolliert** (siehe unten) |
| `fiaon-abo.ts` Abo-Motor | `setInterval`, stündlich | sperrt **nichts** | unverändert: mahnt und legt nach Stufe 3 eine Entscheidung vor |
| `fiaon-reconcile.ts` | Zahlungseingang | `account_status` nur `… ELSE 'active'` | unverändert: öffnet Konten, schließt keine |
| Lead-/CSV-Importe, `wise-csv-import.ts` | Script | keiner | unverändert: schreiben keine Kontozustände |
| `fiaon-kontakt-ergebnis.ts`, `fiaon-agent.ts` | Agent dokumentiert „Kunde will nicht" | `is_blocked = TRUE` | bleibt: eine dokumentierte Entscheidung eines Menschen, keine Automatik |

**Jede Sperrung bekommt ab jetzt einen Verantwortlichen.** Der Admin-Prüfpfad schreibt `konto_status_geaendert` nach `fiaon_agent_events`. Vorher stand eine Sperre nur in der Spalte — deshalb war beim Reaktivierungslauf bei zwei Konten nicht mehr feststellbar, ob ein Mensch oder eine Automatik sie zugemacht hatte. Damit das überhaupt möglich ist, durfte `fiaon_agent_events.agent_id` leer sein (Migration 035): Das Protokollbuch konnte bis dahin nur festhalten, was ein **Agent** tut — nicht, was der Betreiber tut.

**Reaktivierungslauf `scripts/reaktivierung.ts`.** Erkennungsregel: gesperrt/inaktiv **ohne** zugehörigen Admin-Protokolleintrag. Vorschau zuerst (`reports/reaktivierung-vorschau.csv`), Ausführung nur mit `--schreiben`, **keine Mails**. Gefunden: 4 gesperrte Bestellungen und 2 gesperrte Personen. **Reaktiviert: 2 Bestellungen und 1 Person** — darunter ein Kunde, der **bezahlt hatte und trotzdem ausgesperrt war** (Konto steht wieder auf `active`). Bewusst gesperrt geblieben sind drei Fälle: eine DSGVO-Löschung (das *ist* die dokumentierte Entscheidung) und zwei interne Testkonten (ein erfundener Kunde gehört nicht in echte Arbeitslisten). Jede Öffnung steht als `konto_reaktiviert` im Protokoll.

### Teil 1 — Die Merge-Maschine: ein Zusammenschluss darf nichts verlieren

`server/lib/fiaon-person-merge.ts`, `personenZusammenfuehren(verliererId, gewinnerId, entscheidungen, akteur)`:

**Eine Transaktion um alles.** Schlägt ein Schritt fehl, ist nichts passiert. Der schlimmste Zustand der früheren Versuche war der halb zusammengeführte Kunde, der in zwei Listen verschieden aussah.

**Die Zählprobe ist Teil der Funktion, nicht ein Test daneben.** Vor dem Umhängen werden Bestellungen, Verlaufseinträge, Termine, Zusagen, Wiedervorlagen, Provisionen, Leads und Lead-Verlauf beider Personen gezählt, danach am Gewinner erneut. Stimmt die Summe nicht, **bricht der Merge ab** und ändert nichts. Die Funktion darf nicht behaupten können, sie habe nichts verloren — sie muss es bei jedem einzelnen Aufruf belegen. (Der Verlauf hängt technisch an der Bestellung und wandert „automatisch" mit. Genau diese Annahme wird hier geprüft statt geglaubt.)

**Kein Wert wird überschrieben und vergessen.** Der Gewinner behält seine Stammdaten; jeder abweichende Wert des Verlierers wird in `fiaon_person_aliases` gesichert (neu: `quelle_person_id`, `feld_wert`). Wählt ein Mensch ausdrücklich den Wert des Verlierers, wird der bisherige Wert des **Gewinners** gesichert — sonst hätte die Feldwahl selbst einen Datenverlust zur Folge. **Die Suche trifft ab jetzt auch über Aliase**: Agentenliste, Vertriebsliste und Admin-Suche wurden angeschlossen; sie taten es vorher an keiner Stelle. Ohne diesen Schritt wäre jeder Zusammenschluss ein stiller Verlust — wer die alte Adresse eines Kunden eingibt, hätte ihn nicht mehr gefunden.

**Zuständigkeit ist eine Geldfrage.** Hat nur eine Seite einen dokumentierten Betreuer (`betreuung_seit`), gewinnt der. Haben beide **verschiedene**, wird der Merge **abgelehnt**, bis ein Mensch ausdrücklich wählt — die Wahl wird mit Namen protokolliert. 14 der offenen Kandidaten sind solche Fälle.

**Der Verlierer wird Wegweiser, nicht Leiche.** `merged_into_person_id` zeigt auf den Gewinner, nichts wird gelöscht. Geprüft und ergänzt wurde, dass ihn wirklich **jede** Liste herausfiltert: Agentenliste, Vertrieb, Admin-Suche, Erstverteilung, Nachschub, Auto-Assign, Follow-up-Tageslauf. Zwei Lücken sind dabei aufgefallen und geschlossen: Die **Admin-Suche** lieferte Bestellungen von Wegweisern (der Klick öffnete die falsche Akte), und **Sperren/Entsperren** in der Vertriebsleitung funktionierte auf zusammengeführten Personen — eine Änderung an einem Datensatz, den niemand mehr sieht.

**Verboten, jeweils mit Klartext-Meldung:** Selbst-Merge, Merge auf eine bereits gemergte Person, Merge eines Wegweisers, Merge zwischen Testkonto und echtem Kunden.

### Teil 2 — Der Arbeitsplatz `/admin/dubletten` (und derselbe im Vertrieb)

Die Seite hat jetzt zwei Bereiche: **Personen** (Menschen vereinen, neu) und **Bestellungen** (Antragszeilen aufräumen, wie bisher). Sie bleiben getrennt, weil sie verschiedene Dinge tun; ein gemeinsamer Knopf wäre der schnellste Weg zurück zum Datenverlust.

**Sortiert nach Sicherheit**, nicht nach Datum: (a) gleiche Rufnummer, (b) gleiche E-Mail, (c) ähnlicher Name + gleiches Geburtsdatum, (d) nur ähnlicher Name — und diese unterste Stufe ist ausdrücklich als **„Vermutung"** beschriftet. **E-Mail-Gleichheit ist kein Autopilot**: Im Bestand trug eine Adresse zwei Menschen. Jeder Merge ist eine Mensch-Entscheidung; es gibt bewusst keinen „alle zusammenführen"-Knopf.

**Gegenüberstellung:** alle Felder nebeneinander, Abweichungen markiert, darunter beide Bestellungslisten und die letzten fünf Verlaufseinträge je Seite. Pro abweichendem Feld ein Umschalter; Vorgabe ist die Seite mit dem **jüngeren dokumentierten Kontakt** (wer zuletzt gesprochen hat, hat eher den aktuellen Stand). Vor dem Ausführen eine Rückfrage in Klartext: was passiert, dass nichts verloren geht, und dass bei einer nicht stimmenden Zählprobe abgebrochen wird. Knopf **„Keine Dublette"** hakt ein Paar dauerhaft ab (`fiaon_dubletten_entschieden`) — rücknehmbar, ohne Hard-Delete. Der Zähler im Admin-Menü zählt Personen- und Bestellungs-Dubletten zusammen.

**Die Vertriebsleitung bekommt dieselbe Maschine** als fünften Bereich in `/agent/vertrieb`, hinter `nurLeitung` + `nurMitZusage`, mit denselben Protokollen. Sie telefoniert mit den Kunden und ist die Einzige, die „Axel Conrad zweimal" wirklich beurteilen kann. Archivieren darf sie, **zurückholen** bleibt beim Betreiber.

**Zwei Dinge, die beim Bauen auffielen und geändert wurden:**

*Die Kandidatenliste verlangte 1 740 Entscheidungen für 359 Sachverhalte.* Neun identische „Mario Fricker" ergeben paarweise 36 Vorschläge — 35 davon lösen sich von selbst, sobald der erste getroffen ist. Jetzt bekommt eine Gruppe einen Anker und je einen Vorschlag gegen die anderen (Kette statt Kreuz); ausgelassene Paare bleiben auf **jeder** Stufe ausgelassen, sonst wären sie über „ähnlicher Name" wieder hereingekommen. Dazu fallen interne Testdatensätze heraus — 32 „Dev User" teilen eine Platzhalternummer und hätten allein 496 Vorschläge erzeugt. Ergebnis: **1 104 statt 1 740**, bei gleicher Abdeckung.

*Der Zähler im Menü hätte das Dashboard lahmgelegt.* Die Suche liest den ganzen Personenbestand (rund vier Sekunden); der Zähler fragt im Minutentakt. Jetzt liest er nur den Zwischenspeicher und wärmt im Hintergrund — dieselbe Quelle wie die Liste, also keine zweite Zählregel, nur bis zu zwei Minuten alt.

### Teil 3 — Das Antrags-Archiv: die „Lösch"-Funktion, die keine ist

`fiaon_applications` hat `archived_at`, `archived_reason`, `archived_note`, `archived_by` (Migration 034). Eine archivierte Bestellung verschwindet aus Arbeitslisten, Verteilung, Erinnerungen, Zahlungslisten und Kennzahlen — und **bleibt in der Akte sichtbar**, mit Grund, Zeitpunkt und Namen. Der Filter sitzt an einer zentralen Stelle (`antragBasisSql` in `tier.ts`, dazu Agentenliste, Vertriebsliste, Zahlungsliste, Follow-up, Erstverteilung, Erinnerungs-Engine).

**Nicht archivierbar: bezahlte Bestellungen und Bestellungen mit gebuchter Provision.** Der Knopf ist dann gesperrt, mit der Begründung als Text daneben — sonst wäre das Archiv ein Werkzeug, um Umsatz zu verstecken oder den Anspruch eines Agenten stillzulegen. Grund ist Pflicht („Doppelt angelegt", „Testeintrag", „Kunde widerrufen", „Sonstiges" + Freitext); bei „Sonstiges" auch die Erklärung. Wiederherstellen nur Admin.

**Agenten melden, statt selbst zu archivieren.** In der Kundenliste steht „Kein echter Kunde? Als Testeintrag melden" — die Meldung wird eine Aufgabe für die Vertriebsleitung. Wer seine eigene Arbeitsliste kürzen kann, hat einen Anreiz, unbequeme Kunden zu „Testeinträgen" zu erklären.

### Teil 4 — Der Aufräum-Lauf

`scripts/dubletten-aufraeumen.ts` schreibt `reports/dubletten-kandidaten.csv` und führt **nichts** zusammen, auch nicht bei gleicher Rufnummer. Gefunden am 08.08.2026:

| Stufe | Paare |
| --- | --- |
| a) Gleiche Rufnummer | 604 |
| b) Gleiche E-Mail | 1 |
| c) Ähnlicher Name + gleiches Geburtsdatum | 67 |
| d) Nur ähnlicher Name (Vermutung) | 432 |
| **Gesamt** | **1 104** |
| davon mit bezahlter Bestellung | 244 |
| davon mit zwei verschiedenen Betreuern (verlangt eine Wahl) | 14 |

Die CSV enthält außerdem die **55 bereits zusammengeführten Paare** als Nachweis, dass die Regeln greifen — namentlich „Axel Conrad" (3775/4492, erkannt über die Rufnummer; das Paar ist erledigt, 4492 zeigt auf 3775). **Ein Fall fällt dabei durch:** 3158/5335 („Anna Bauer") wurde früher zusammengeführt, würde von den heutigen Regeln aber **nicht** gefunden — verschiedene Nummer, verschiedene E-Mail, Name zu unterschiedlich. Das ist eine bekannte Lücke, keine stille.

### Prüfstand

`scripts/pruef-merge.ts` — **94 Prüfungen, alle grün.** Der Lauf läuft in **einer Transaktion, die am Ende zurückgerollt wird**: Es wird nie etwas geschrieben, also gibt es auch keine Testzeilen aufzuräumen (beim letzten Mal blieben Reste liegen). Geprüft werden Zählprobe, Alias-Sicherung samt Auffindbarkeit über die Agentensuche, das Verschwinden des Verlierers aus **jeder** Liste einzeln, alle Verbote, die Feldwahl, das Archiv samt Sperren und Wiederherstellen, und Teil 0 (Fristablauf ändert keinen Kontozustand, Kunde bleibt in Agentenliste **und** Zahlungsliste). Dazu Quelltext-Prüfungen: ob die Bedingungen wirklich in den Abfragen der Anwendung stehen — eine dynamische Prüfung, die die Bedingung selbst mitbringt, würde auch bestehen, wenn sie in der Anwendung fehlt.

**Zwei Fehler hat der Prüfstand gefunden, bevor sie jemand anderes gefunden hat:** Das Protokollbuch verlangte eine Agenten-ID (Migration 035), und die Kandidatensuche unterdrückte ein zurückgenommenes „Keine Dublette" für immer.

### Zwei Altlasten, die dabei aufgefallen und behoben sind

*Der Bereich „Bestellungen" in `/admin/dubletten` war unbenutzbar.* `/admin/duplicates/groups` fragte `fiaon_leads.created_at` ab — die Spalte heißt `erstellt_am`. Jeder Aufruf endete mit einem 500er.

*Nicht behoben, nur benannt:* `/admin/hub/badges` braucht kalt rund zehn Sekunden. Das war vorher genauso (nachgemessen) und hat mit dieser Änderung nichts zu tun — es gehört auf die Liste.

**Zu finden:** `server/lib/fiaon-person-merge.ts`, `server/lib/fiaon-dubletten-kandidaten.ts`, `server/lib/fiaon-antrag-archiv.ts`, `server/lib/fiaon-bestand-filter.ts`, `server/routes/fiaon-dubletten.ts`, `client/src/components/admin/DublettenArbeitsplatz.tsx`, `client/src/components/admin/ArchivDialog.tsx`, `db/migrations/034_merge_archiv_dubletten.sql`, `035_agent_events_ohne_agent.sql`. Läufe: `scripts/reaktivierung.ts`, `scripts/dubletten-aufraeumen.ts`, Prüfstand `scripts/pruef-merge.ts`.

## 06.08.2026 — Vertriebsleitung kann Zahlungen buchen, Unterlagen und Zugänge prüfen

Gemeldet: *„Damit ich Vertrieblern bei Fragen und kleineren Kundenproblemen direkt helfen kann, ohne dass alles bei dir landet."* Drei Fragen kamen täglich beim Betreiber an: Ist das Geld da? Welche Unterlagen fehlen? Warum kommt der Kunde nicht ins Konto?

**Zahlungen prüfen und buchen.** `/agent/vertrieb` hat jetzt vier Bereiche (Kunden · Zahlungen · Unterlagen · Zugang). Die Zahlungsliste zeigt offene Bestellungen mit Verwendungszweck, Betrag, Frist und Zuständigem, dazu die passenden Bankeingänge. Stimmt der Nachweis, setzt die Vertriebsleitung den Kunden selbst auf „bezahlt".

**Es gibt weiterhin nur EINE Buchung.** `alsBezahltBuchen` wurde aus dem Admin-Endpunkt herausgelöst und wird von beiden Seiten aufgerufen. Ein zweiter, „kleiner" Buchungsweg im Vertriebsmodul wäre der sichere Weg in auseinanderlaufende Zustände: eine Bestellung, die bezahlt ist, aber keine Provision auslöst, oder ein Konto, das bezahlt ist und trotzdem nicht aufgeht.

**Belegpflicht.** Ohne benannten Nachweis (Bankeingang mit passendem Verwendungszweck **oder** ein vom Kunden gezeigter Überweisungsbeleg), ohne tatsächliches Eingangsdatum und ohne Beschreibung in einem Satz lässt sich nicht buchen. Beim Bankeingang wird der Verwendungszweck **serverseitig gegengeprüft** — eine mitgeschickte ID allein wäre eine Behauptung, kein Beleg. Alles landet in `fiaon_agent_events`, im Kundenverlauf und als Diagnose-Eintrag mit der Bitte um Gegenkontrolle beim nächsten Kontoabgleich.

**Zwei Dinge, die beim Bauen aufgefallen sind und geändert wurden:**

*Der Buchungsdialog schlug fremde Zahlungen vor.* Der erste Entwurf zeigte alle Bankeingänge mit gleichem Betrag — bei einem Standardpaket zu 59,99 € ist das die halbe Kundenkartei, sechs Stück, alle längst einem anderen Kunden zugeordnet. Ein Klick darauf wäre eine Fehlbuchung mit Provision gewesen. Jetzt sind nur Referenz-Treffer auswählbar, bereits verbuchte Eingänge fallen ganz heraus, und der Rest wird gezählt und beim Namen genannt: „gehören zu anderen Kunden und sind kein Nachweis".

*„Frist abgelaufen" hieß zweierlei.* Die neue Kennzahl zählte `pending_payment` mit Frist in der Vergangenheit und ergab 0, während die Kundenliste 186 solche Fälle zeigte — dort ist es `payment_status='expired'` (so entscheidet `rangSql` in `tier.ts`). Jetzt gilt überall dieselbe Definition, und die 186 Fälle stehen auch in der Zahlungsliste.

**Unterlagen: Stand ja, Inhalt nein.** Sichtbar ist, WAS fehlt (Ausweis, Kontoauszug, SCHUFA), seit wann und wie groß eine vorliegende Datei ist — nicht ihr Inhalt. Für die Frage „was braucht der Kunde noch?" ist der Inhalt nicht nötig, und ein Ausweisscan ist das sensibelste Dokument im Bestand. Ob ein Dokument verlangt wird, hängt am Produkt: Eine Bonitätsauskunft braucht keinen Ausweis, sonst meldete die Liste bei jedem Bonitätskunden dauerhaft „Ausweis fehlt" und niemand würde sie mehr ernst nehmen.

**Zugang: dieselbe Prüfung wie der echte Login.** Die Diagnose ruft `decideLogin` mit der echten Kontofamilie und dem gespeicherten Passwort auf — sie beantwortet damit exakt „was passiert, wenn der Kunde sein richtiges Passwort eintippt?". Eine nachgebaute Prüfung wäre hier besonders gefährlich: Genau eine solche Abweichung hat dazu geführt, dass bezahlte Kunden monatelang ausgesperrt waren, während jede Übersicht behauptete, alles sei in Ordnung. Zu jedem Fall steht der konkrete nächste Schritt für das Telefonat.

**Die Verpflichtungserklärung ist auf Fassung 2.0.** Fassung 1.0 verbot das Buchen ausdrücklich — wer sie angenommen hat, hat einer anderen Abmachung zugestimmt. Deshalb wird erneut gefragt, statt die alte Zusage stillschweigend auszuweiten. Neu sind Punkt 6 („Zahlungen nur mit Nachweis") und Punkt 7 („Keine Buchung im eigenen Interesse"); ausdrücklich ausgeschlossen bleiben Storno, Erstattung, Provisionsänderungen, Dokumenteinsicht und Kundenpasswörter.

**Zu finden:** `server/lib/fiaon-kundenlage.ts`, `server/routes/fiaon-vertrieb.ts`, `server/routes/fiaon-antrag.ts` (`alsBezahltBuchen`), `client/src/pages/agent/vertrieb-service.tsx`. Prüfstand: `scripts/pruef-vertrieb.ts` (132 Prüfungen; die Buchungswälle werden geprüft, eine echte Buchung führt der Prüfstand bewusst NICHT aus).

## 06.08.2026 — Übergabe der Vertriebsleitung: Glückwunsch, Einführung, Verpflichtung

Eine Rolle zu vergeben und zu hoffen, dass die Verantwortung mitwächst, ist keine Grundlage. Wer den Bereich „Vertrieb" öffnet, sieht **alle** Kundendaten des Unternehmens — Namen, Rufnummern, Adressen, Geburtsdaten, Beträge, Gesprächsverläufe von Menschen, die ihn nie beauftragt haben. Das ist rechtlich eine andere Sache als der eigene Bestand.

Beim ersten Öffnen erscheint deshalb eine Tafel, die drei Dinge in dieser Reihenfolge tut: **gratulieren** (eine Beförderung, die als Fehlermeldung daherkommt, fühlt sich nicht wie eine an), **einführen** (was geht, was ausdrücklich nicht — bevor jemand herumprobiert und dabei fremde Kundendaten anfasst) und **verpflichten** (zehn Punkte: Zweckbindung, Vertraulichkeit auch nach Ende der Tätigkeit, Weisungsgebundenheit, keine Selbstbevorteilung bei Zuweisungen, Grenzen der Rolle, Sorgfalt gegenüber Kunden, Meldepflicht binnen 24 Stunden, Zugangsschutz, Folgen von Verstößen, Widerruf der Rolle).

**Ohne Annahme keine Daten.** Alle acht Datenwege des Bereichs liegen hinter einem zweiten Torwächter (`nurMitZusage`) und antworten mit **403 und dem Code `zusage_erforderlich`**. Hier ist 403 richtig, wo bei der Rollenprüfung 404 richtig war: Wer Vertriebsleiter ist, darf wissen, dass es den Bereich gibt — ihm fehlt nur ein Schritt, und eine 404 würde ihn ratlos zurücklassen statt zur Erklärung zu führen.

**Der Nachweis muss belastbar sein, nicht dekorativ.** Der Text liegt im Server, nicht in der Oberfläche: Läge er im Client, könnte später niemand sagen, welche Fassung auf dem Bildschirm stand. Gespeichert werden Fassung, **SHA-256 über genau diese Fassung**, der getippte Name im Wortlaut, IP und Browserkennung. Die Unterschrift muss der Name des angemeldeten Kontos sein — nachsichtig bei Schreibweise, nicht bei der Person. Die Knöpfe entsperren erst, wenn der Text bis zum Ende gescrollt wurde; eine Erklärung, die man ungesehen wegklicken kann, ist als Nachweis nichts wert. Ändert sich der Text, ändern sich Fassung und Prüfwert — dann wird erneut gefragt.

Es gibt einen leisen, aber echten Ausweg („Später entscheiden"): Eine Zusage ohne Möglichkeit zum Nein ist nicht freiwillig, und eine unfreiwillige wäre wertlos. In `/admin/team` steht bei jedem Vertriebsleiter, ob und wann die Erklärung angenommen wurde — samt Fassung, Unterschrift und IP. Fehlt sie, steht das dort ausdrücklich.

**Kein Icon, kein Emoji.** Die Ordnung entsteht durch Ziffernmarken, Haarlinien und Weißraum. Dieselbe Tafel mit Sternchen und Häkchen wirkt wie ein Gewinnspiel — und nimmt einer Verpflichtungserklärung den Ernst.

**Nicht juristisch geprüft:** Der Text ist als betriebliche Verpflichtungserklärung formuliert (Art. 29, 32 DSGVO, § 53 BDSG). Vor breitem Einsatz sollte ihn jemand mit arbeitsrechtlicher Zulassung gegenlesen, besonders die Abschnitte zu Haftung und Folgen — deren Reichweite hängt von der Vertragsart ab.

**Zu finden:** `server/lib/fiaon-vertrieb-zusage.ts`, `server/routes/fiaon-vertrieb.ts`, `client/src/pages/agent/vertrieb-zusage.tsx`, Nachweis in `/admin/team`. Prüfstand: `scripts/pruef-vertrieb.ts` (96 Prüfungen, davon 17 zur Erklärung).

## 06.08.2026 — „Anrufer blockiert": der Kunde geht an den nächsten Vertriebler

Gemeldet: *„Manche Kunden blockieren die Nummer eines Agenten, heben beim anderen aber ab."* Bisher gab es dafür zwei schlechte Wege — ewig weiter anrufen oder beim Betreiber eine Umzuweisung erbitten. Beides kostet einen Abschluss, den ein Kollege sofort hätte machen können.

Neues Ergebnis **`nummer_blockiert`** („Anrufer blockiert") in der Kundenliste. Ein Klick dokumentiert die Blockade beim Abgebenden und übergibt den Kunden an den Kollegen mit dem kleinsten offenen Bestand, **der bei diesem Kunden noch nicht blockiert wurde** — sonst wanderte der Fall im Kreis und landete wieder bei einer toten Nummer. Der Kunde wird dabei **nicht** gesperrt und steht beim neuen Betreuer sofort auf heute.

Das ist die einzige Ausnahme vom Besitzschutz, und eine kontrollierte: Hier verteilt keine Automatik, sondern der Betreuer gibt selbst ab. Die Übergabe hat einen belegten Grund im Kontaktprotokoll und steht mit Akteur und Richtung in `fiaon_agent_events`. Die Bestellungen ziehen mit — sonst wäre der Kunde für den einen sichtbar und für den anderen nicht.

Ist jeder verfügbare Kollege bei diesem Kunden schon blockiert, wird **nichts** verschoben; der Agent bekommt einen klaren Satz statt einer stillen Kreisbewegung. Zur Provision sagt die Rückfrage vor dem Klick die Wahrheit: Der Anspruch folgt dem zuletzt dokumentierten Kontakt — wer den Abschluss macht, bekommt ihn.

**Zu finden:** `server/lib/fiaon-uebergabe.ts`, `server/lib/fiaon-kontakt-ergebnis.ts`, `server/routes/fiaon-agent-kunden.ts`, `client/src/pages/agent/kunden-neu.tsx`. Prüfstand: `scripts/pruef-uebergabe.ts` (15 Prüfungen).

## 06.08.2026 — Rolle „Vertriebsleitung" ließ sich nicht umschalten

Die Umschaltung speicherte korrekt — sichtbar war es nur nie. Die Team-Übersicht wird aus **drei** Endpunkten gespeist (`/admin/agents`, `/admin/team/stats`, `/admin/team/agents/:id`); ergänzt hatte ich `rolle` nur im ersten. Die Detail-Schublade las den dritten und zeigte deshalb dauerhaft „Mitarbeiter", egal was in der Datenbank stand. Nach dem Bestätigen sah es aus, als sei nichts passiert — und beim nächsten Klick wurde derselbe Wert erneut gespeichert.

Alle drei liefern jetzt `rolle` und `is_test_account`, und die Spalte wird in `ensureAgentTables()` angelegt statt in einem einzelnen Endpunkt. Lehre für das nächste Feld: Wer eine Spalte ergänzt, muss prüfen, welcher Endpunkt die Ansicht wirklich speist — nicht welcher am plausibelsten klingt.

**Zu finden:** `server/routes/fiaon-team.ts`, `server/routes/fiaon-agent.ts`.

## 05.08.2026 — Eine Arbeitsliste, ein Besitzer, eine Zuständigkeit

Drei Meldungen aus dem Vertrieb an einem Tag, die dieselbe Ursache hatten:

> „Der Bereich Heute sorgt für doppelte Arbeit. Teilweise werden Kunden anderer Mitarbeiter angezeigt." (Florentine)
> „Axel Conrad zahlt heute, wurde von mir betreut, weiß nicht bei wem er jetzt zugeteilt ist." (Daniel)
> „Teilweise sind Kunden in Heute, aber nicht in Meine Kunden."

**Es war kein Datenleck.** Es waren drei getrennte Konstruktionsfehler, die zusammen wie eines aussahen.

**1. Die Automatik nahm betreute Kunden weg.** Erstverteilung, Nachschub und Auto-Zuweisung holten Personen aus der Reserve — und in der Reserve lagen auch Kunden, die längst jemand betreute. Gemessen an Axel Conrad (Person 4492): acht dokumentierte Kontakte, alle von Daniel; am 03.08. um 17:04 nahm eine Erstverteilung ihn Daniel weg und gab ihn niemandem. In sieben Tagen geschah das 686 Mal. Jetzt gilt: Wer einmal dokumentiert betreut wurde, wird **nie** automatisch umverteilt (`fiaon_persons.betreuung_seit`, geprüft in jeder Verteil-Abfrage). Umziehen kann eine betreute Person nur ein Mensch, und das steht im Protokoll.

**2. Zwei Listen über denselben Bestand sind zwei Wahrheiten.** „Heute" (personenbasiert) und „Meine Kunden" (bestellungsbasiert) zeigten denselben Kunden unterschiedlich — und zwei Mitarbeiter riefen denselben Menschen an. Aus „Heute" wurde die **Startseite** (`/agent/start`): Verdienst, Bestandszahlen, Termine — sie informiert und arbeitet nicht. Gearbeitet wird ausschließlich in **`/agent/kunden`**, der einen Liste, deren Reihenfolge die Arbeitsreihenfolge ist. Alte Adressen leiten um; kein Lesezeichen läuft ins Leere.

**3. Die Zuständigkeit stand an zwei Stellen.** Person und Bestellung trugen je ein `assigned_agent_id`; bei 24 Datensätzen liefen sie auseinander. Bei 18 fehlte sie an der Bestellung — diese Kunden waren auf einer Seite da und auf der anderen weg, und das Altmodell der Provision (das die **Bestellung** liest) hätte sie niemandem zugerechnet. Abgeglichen; drei verschwundene Personen an ihren dokumentierten Betreuer zurückgegeben. Drei echte Konflikte stehen in `zustaendigkeit-entscheiden.csv` und gehören einem Menschen vorgelegt, keinem Skript.

**Neue Rolle Vertriebsleitung.** Daniel und Florentine führen den Vertrieb und mussten für jede Umzuweisung nachfragen. `/agent/vertrieb` zeigt ihnen **alle** Kunden mit Zuständigem und dokumentiertem Betreuer, erlaubt Zuweisen, Stammdaten-Korrektur, Dokumentieren und Sperren. Was verschlossen bleibt: Zahlungen buchen, Provisionen ändern, Mitarbeiter anlegen, Bankdaten. Für alle anderen Konten **existiert die Seite nicht** — 404, nicht 403: Eine 403 wäre schon die Auskunft, dass es dort etwas zu holen gibt. Umgeschaltet wird die Rolle in `/admin/team`, ohne SQL.

**Wichtig zur Provision:** Eine Zuweisung verschiebt die Zuständigkeit, **nicht** den Anspruch. Der Anspruch folgt dem dokumentierten Kontakt — auch im Altmodell, wo bisher allein die Zuweisung zählte. Sonst hätte die neue Umzuweisungs-Möglichkeit fremdes Geld verschieben können.

**Nebenbei behoben:** Die Spalten-Sicherstellung (`ALTER TABLE`/`CREATE INDEX`) lief bei **jeder** Anfrage und sperrte dabei die Tabelle — gemessen 30 Sekunden pro Aufruf der Kundenliste, mit Sperrschlange bis in die Minuten. Sie läuft jetzt einmal pro Prozess. Startseite und Kundenliste stellen ihre Abfragen außerdem gleichzeitig statt hintereinander (9 Wege → 2).

**Zu finden:** `server/routes/fiaon-agent-start.ts`, `server/routes/fiaon-vertrieb.ts`, `server/lib/tier.ts` (Besitzschutz), `client/src/pages/agent/start.tsx`, `client/src/pages/agent/kunden-neu.tsx`, `client/src/pages/agent/vertrieb.tsx`. Prüfstände: `scripts/pruef-vertrieb.ts` (79 Prüfungen), `scripts/pruef-agentansicht.ts` (Leck- und Vertriebsprobe), `scripts/abgleich-zustaendigkeit.ts`, `scripts/besitzschutz-herstellen.ts`.

## 03.08.2026 — Bezahlte Bonitätsauskünfte wurden stillschweigend gelöscht

Wer eine **Bonitätsauskunft (74 €)** bestellte und danach sein Konto aktivierte, verlor die Auskunft — ohne Hinweis, ohne Eintrag, ohne dass irgendwer es merkte. Der Grund: Nach jeder Zahlung suchte das System nach „Dubletten" und legte **jede** offene Bestellung derselben E-Mail still. Es fragte nie, ob es überhaupt dasselbe Produkt war.

Es traf beide Richtungen. Eine Bonitätszahlung von 74 € hat auch schon eine **FIAON-Ultra-Bestellung zu 79,99 €** getötet. Betroffen waren 12 lebende Bestellungen.

**Was jetzt gilt:** Stillgelegt wird nur innerhalb derselben Produktkategorie. Stufenpakete (Starter/Pro/Ultra/High End) schließen sich gegenseitig aus — bezahlt jemand Ultra, ist seine offene Pro-Bestellung zu Recht erledigt, denn ein Konto hat genau eine Stufe. Die Bonitätsauskunft ist davon unabhängig und wird nicht mehr angetastet. Die Unterscheidung läuft über das Kennzeichen `type='schufa'`, nicht über den Produktnamen: Derselbe Tarif existiert im Bestand unter zwei Schreibweisen, ein Namensvergleich hätte echte Dubletten übersehen.

Zusätzlich abgestellt: Der Verweis „ersetzt durch" zeigte teils auf Bestellungen, die es nicht gibt. Er wird jetzt geprüft, bevor er gespeichert wird — sonst ist später nicht mehr nachvollziehbar, wodurch eine Bestellung ersetzt wurde.

**Zu finden:** `server/routes/fiaon-antrag.ts` → `supersedeSisterOrders`. Prüfliste: `scripts/sql/superseded-falsch.sql`.

## 03.08.2026 — Neue Seite: Verbuchung mit Vorschau vor dem Klick

Bisher zeigte der Kontoabgleich alle Bankeingänge gleichwertig. Ob ein Klick eine Mail an den Kunden auslöst, eine Provision bucht oder eine andere Bestellung stilllegt, stand nirgends — man musste es wissen.

**`/admin/verbuchung`** zeigt nur die Eingänge, bei denen etwas zu entscheiden ist, in vier getrennten Fällen: verbuchen, Zuordnung korrigieren, fälschlich stillgelegt, ohne Zuordnung. Jede Zeile lässt sich aufklappen und sagt vorher, was passiert: welcher Statuswechsel, welche Bestellungen mitbetroffen sind, ob eine Bestätigungsmail rausgeht und **wer die Provision bekommt**.

Damit die Vorschau nicht von der Wirklichkeit abweichen kann, wurde die Provisionsentscheidung aus dem Buchungsvorgang herausgelöst (`ermittleProvisionsAnspruch`). Vorschau und echte Buchung fragen jetzt dieselbe Funktion — es gibt keine zweite Kopie der Regeln, die auseinanderlaufen könnte.

„Zuordnung korrigieren" löst **bewusst keine Buchung** aus: Dort gehört das Geld zu einer längst bezahlten Bestellung, und nur die Bank-Verknüpfung war falsch.

**Zu finden:** `server/routes/fiaon-verbuchung.ts`, `client/src/pages/admin-verbuchung.tsx`.

## 03.08.2026 — Ein Kunde, ein Zuständiger — jetzt von der Datenbank erzwungen

Die Zuständigkeit hing am einzelnen Antrag. Ein Kunde mit acht Bestellungen konnte acht Zuständige haben — die Ursache der 26 Zuweisungskonflikte. Seit dem CRM-Umbau ist die **Person** der Besitzer, aber jede Schreibstelle im Code musste selbst daran denken, die Antragszeilen mitzuziehen. Genau dieses „daran denken müssen" hat die Konflikte erzeugt: Eine Stelle vergisst es, und ab da hat ein Kunde zwei Zuständige.

Diese Regel hält jetzt die Datenbank selbst. Wechselt der Besitzer einer Person, folgen ihre Antragszeilen ohne Zutun des Aufrufers, und es entsteht eine Beweiszeile mit **vorherigem und neuem** Zuständigen — die Grundlage für jeden Provisionsstreit. Die Regel lässt sich nicht mehr durch eine neue Schreibstelle umgehen, auch nicht durch ein manuelles `UPDATE` in der Konsole.

**Zu finden:** `db/migrations/033_person_ownership_trigger.sql`. Rücknahme: `db/rollback/033_…`. Nachweis: `scripts/sql/test-033-trigger.sql`.

## 03.08.2026 — Die offene Kunden-Kartei ist abgelöst

Zwei konkurrierende Zuweisungsmodelle gleichzeitig laufen zu lassen führt zuverlässig zurück in doppelte Zuständigkeiten: Der Agent übernimmt eine Karte, die Verteilung vergibt dieselbe Person an jemand anderen, und beide halten sich für zuständig.

Die Kartei-Endpunkte antworten deshalb mit **410 Gone** und einem Verweis auf den Nachfolger. Bewusst nicht 404 — diese Endpunkte haben existiert und sind abgeschaltet; ein 404 würde jeden Fehlersuchenden in die falsche Richtung schicken. Der Code bleibt vollständig stehen: Zurückschalten ist eine Änderung **einer** Einstellung (`kartei_enabled`), keine Wiederherstellung aus dem Verlauf.

**Zu finden:** `server/routes/fiaon-kartei.ts`, oberste Prüfung.

## 29.07.2026 — 3.236 Funnel-Abbrecher sind Entwürfe, keine Kunden

54 % des Zeilenbestands haben **weder E-Mail noch Telefon**. Der Antrags-Funnel speichert bei jedem Schritt-Wechsel; wer vor dem Kontaktschritt abspringt, hinterlässt genau so eine Zeile. Das ist kein Kunde, kein Lead und kein Interessent — man kann diese Menschen nicht einmal erreichen.

Bisher zählten sie überall mit. **Das ist der Grund, warum keine Zahl im Dashboard stimmte:** „Neue Anträge heute" war die Summe aus echten Anträgen und Leuten, die auf Schritt 1 abgesprungen sind.

Sie tragen jetzt ein Kennzeichen und sind aus den Tages-Kennzahlen gefiltert. **Ein Kennzeichen statt einer wiederholten `WHERE`-Bedingung:** Eine Bedingung, die an zwanzig Abfragen abgeschrieben wird, weicht irgendwann an einer davon ab — und dann stimmt wieder nichts. Gesetzt wird es an genau einer Stelle, überall sonst nur gelesen.

**Selbstheilend:** Der Schreibpfad setzt das Kennzeichen bei jedem Speichern neu. Trägt jemand im nächsten Schritt seine E-Mail ein, ist die Zeile automatisch kein Entwurf mehr — und wird zur selben Sekunde einer Person zugeordnet.

Vor dem Lauf prüft `scripts/entwuerfe-kennzeichnen.ts` die eine Frage, die zählt: Fällt irgendeine **bezahlte** Zeile unter die Bedingung? Dann wäre die Bedingung falsch und wir würden Umsatz aus der Zählung werfen — in dem Fall bricht das Skript ab, bevor es etwas ändert. Ergebnis: keine einzige. **Nichts wurde gelöscht**, die Zeilen bleiben vollständig erhalten.

## 29.07.2026 — `/admin/personen`: die echte Kundenzahl und die 26 strittigen Zuordnungen

Zwei Fragen, die bisher niemand beantworten konnte, haben jetzt eine Seite.

### Wie viele Kunden haben wir wirklich?

**254 bezahlte Kunden** — gezählt werden Menschen, nicht Antragszeilen. Daneben steht bewusst die alte Zahl: **264 bezahlte Zeilen**. Die Differenz von **10** ist die Doppelzählung, die bisher in jedem Bericht steckte, fast immer der Bonitäts-Check, der eine eigene Bestellzeile anlegt.

Beide Zahlen nebeneinander, nicht nur die neue: Eine Korrektur, die den alten Wert verschweigt, sieht aus wie ein Fehler. Umsatz und Provision bleiben unberührt — es wurde nie doppelt berechnet, nur doppelt gezählt.

**3.235 Funnel-Abbrecher** (weder E-Mail noch Telefon) sind als Entwürfe ausgewiesen und zählen nirgends als Kunde.

### Wem gehört dieser Kunde?

Die 26 Personen mit mehreren Agenten waren seit dem Backfill markiert, aber nirgends einsehbar. Jetzt aufklappbar mit allem, was für eine Entscheidung nötig ist: bezahlte Bestellungen mit Summe, alle beteiligten Agenten und **je Agent der letzte dokumentierte Kontakt** mit Art, Ergebnis und Notiz. Sortiert nach letztem Kontakt — wer nachweislich zuletzt gearbeitet hat, steht oben.

Betroffen sind vor allem Florentine Lombardi (21 Fälle, 16 mit Zahlung), Daniel Stripling (18/11) und Nikita Boychenko (10/9). Insgesamt **19 der 26 Fälle mit bezahlter Bestellung**, zusammen 1.717,83 €.

Die Seite entscheidet **nichts** und schreibt **nichts**. An der Zuordnung hängt Provision; ein Automat, der nach „letztem Kontakt" oder „ältester Zuweisung" rät, verteilt fremdes Geld um, und niemand könnte hinterher begründen, warum. Also: markieren, vorlegen, der Betreiber entscheidet — oder es wird mit dem Stichtag und der Basis-Provision aufgelöst.

## 29.07.2026 — Dauerschutz: die Person wird gefunden, nicht neu erfunden

Der Backfill war eine Momentaufnahme. Gemessen mit `scripts/person-nachlauf.ts`: In den 1,3 Stunden danach entstanden bereits fünf Zeilen ohne Person, hochgerechnet **rund 90 pro Tag**. Ohne diesen Teil wäre der gesamte Aufwand nach wenigen Wochen wieder aufgezehrt gewesen.

Ab jetzt ruft **jeder** Schreibpfad, der eine Antragszeile oder einen Lead anlegt, denselben Auflöser. Er sucht über die normalisierte E-Mail **und** die Rufnummer — einschließlich aller je verwendeten Aliase — und legt nur dann eine Person an, wenn wirklich keine passt.

- **Neuer Antrag** — eine neue Antragszeile ist eine *Bestellung an einer bestehenden Person*, kein neuer Mensch.
- **Bonitäts-Kauf** — legt bewusst eine eigene Antragszeile an (`FIAON-SCHUFA-…`). Genau diese Zeile hat den Login-Ausfall ausgelöst: Sie war die jüngste Zeile der E-Mail und trug kein Passwort. Sie gehört jetzt derselben Person wie das Konto. Damit zählt der Bonitäts-Käufer strukturell nur noch einmal, **und der Ausfall kann sich nicht wiederholen** — das Passwort hängt an der Person, nicht an der Zeile.
- **Facebook-Lead** — dasselbe Verfahren. Kennt das System die Adresse oder Nummer bereits, wird der Lead an die bestehende Person gehängt.

### Der Übergang Lead → Antrag

Wird ein Lead später zum Antrag, findet der Auflöser über E-Mail oder Rufnummer dieselbe Person. Agent, Verlauf und Betreuungsnachweis bleiben damit an **einer** Akte — der Agent, der den Lead gewonnen hat, sieht seinen Kunden weiterhin bei sich, einschließlich „Zahlung angekündigt". Vorher zerfiel derselbe Mensch in Lead- und Kundenkarte.

### Der Sonderfall, der wirklich schwierig ist

Ein Lead ohne E-Mail wird als Person angelegt — er hat nur eine Rufnummer. Später stellt derselbe Mensch einen Antrag mit einer E-Mail, die bereits einer **anderen** Person gehört. Erst diese eine Zeile beweist, dass beide derselbe Mensch sind, weil sie beide Merkmale trägt.

Beide werden zusammengeführt. **Nichts wird gelöscht:** Die unterlegene Person bleibt als Datensatz bestehen und zeigt per `merged_into_person_id` auf die neue — ein falscher Zusammenschluss lässt sich damit ohne Datenverlust wieder auflösen. Alle Aliase wandern mit, sonst wäre das Zusammenführen genau der Datenverlust, den wir beenden wollten. Sind zwei verschiedene Agenten beteiligt, wird **markiert statt geraten**.

### Was der Auflöser niemals tut

- Ein gesetztes Stammdatenfeld überschreiben. Nur leere Felder werden gefüllt.
- Ein Passwort überschreiben oder löschen. Dieselbe `COALESCE`-Regel wie im Antrags-Speicher — sie war die Ursache des Login-Ausfalls.
- Einen Agenten umhängen.
- Eine Person anlegen, wenn weder E-Mail noch Telefon vorliegen. Das ist der Funnel-Abbrecher, und er soll ausdrücklich keine bekommen.

Zwei gleichzeitige Anfragen mit derselben neuen Adresse laufen in den eindeutigen Index; das wird abgefangen und einmal neu aufgelöst, statt den Antrag des Kunden scheitern zu lassen.

### Nachgewiesen an echten Zeilen

`scripts/person-dauerschutz-test.ts` — **27 Prüfungen, alle grün**, gegen die echte Datenbank statt gegen Attrappen: Die Fehler, die Geld gekostet haben, steckten im Zusammenspiel von Abfrage, eindeutigem Index und Reihenfolge, nicht in der reinen Logik. Alle Testzeilen werden restlos entfernt, und der Test prüft am Ende selbst nach, dass Personen-, Antrags- und Alias-Zahl unverändert sind.

Geprüft werden unter anderem: zweite Bestellung derselben E-Mail ohne Passwort im Body (Passwort bleibt unversehrt), Bonitäts-Kauf (drei Bestellungen an einer Person), die Zusammenführung samt erhaltener Lead-Rufnummer, der Funnel-Abbrecher ohne Person und vier aufeinanderfolgende Speichervorgänge ohne Nebenwirkung.

## 29.07.2026 — Der Backfill ist wiederholbar: Nachzügler einsammeln statt Dubletten erzeugen

Der versehentliche Zweitlauf hat 2.829 Lead-Personen **erneut** angelegt, obwohl alle 2.848 Leads bereits zugeordnet waren. Er wurde zurückgenommen — die Aufräum-Kontrolle bestätigt: keine Person ohne Alias und ohne Zeile, kein Alias ohne Person, keine tote `person_id`.

### Die Ursache lag tiefer als gedacht

Nicht nur dem Lead-Pfad fehlte die Prüfung „hat diese Zeile schon eine Person?". **Beide** Durchläufe glichen ausschließlich gegen die im selben Lauf gebauten Pläne ab — nie gegen die Personen, die bereits in der Datenbank stehen. Daraus folgten drei Störungen, nicht eine:

- **Ein Lead mit gesetzter `person_id`** wurde trotzdem verarbeitet. Das war der sichtbare Fehler.
- **Ein neuer Lead**, dessen Adresse einer bestehenden Person gehört, hätte eine zweite Person bekommen.
- **Eine neue Bestellung eines bestehenden Kunden** hätte eine zweite Person mit derselben E-Mail angelegt — der eindeutige Index hätte den ganzen Lauf abgebrochen. Das ist exakt der Fall „Nachzügler einsammeln", also genau der Zweck, für den das Skript künftig regelmäßig laufen soll.

Der Lauf lädt jetzt zuerst alle vorhandenen Personen samt Aliasen und **bindet passende Zeilen dort an, statt neu anzulegen**. Geschrieben wird nur `person_id` an Zeilen, die noch keine haben, und Aliase, die es noch nicht gibt — beides wirkungslos, wenn es schon getan wurde.

Gehört eine Adresse bereits einer **anderen** Person, wird sie übergangen und gezählt. Das ist ein Zusammenführungsfall und keine Entscheidung, die ein Backfill treffen darf.

### Das Sicherheitsnetz war löchrig

Zeilen, die an eine **bestehende** Person angebunden werden, hängen an einer Person aus einem früheren Stapel. `--undo` hätte sie übersehen, und „vollständig umkehrbar" wäre eine leere Zusage gewesen. Der Stapel merkt sich jetzt die angebundenen Anträge und Leads, und jeder Alias trägt seine Stapel-ID.

### Der Beweis

Zwei scharfe Läufe hintereinander. Lauf 1 sammelte die fünf Nachzügler ein (1 neue Lead-Person, 1 Antragszeile angebunden). **Lauf 2: 0 neue Personen, 0 Anbindungen, grün durchgelaufen** — kein Abbruch. Bei einem Wiederholungslauf ohne Nachzügler wird bewusst kein leerer Stapel angelegt.

### `scripts/person-nachlauf.ts` — misst, was ohne Dauerschutz verloren geht

Seit dem Backfill sind in 1,3 Stunden fünf Zeilen ohne Person entstanden, hochgerechnet **rund 90 pro Tag**. Solange kein Schreibpfad die Person kennt, wächst dieser Rückstand stündlich weiter.

Das Skript schlüsselt zusätzlich die 26 Agenten-Konflikte auf: **19 mit bezahlter Bestellung**, betroffen sind vor allem Florentine Lombardi (21), Daniel Stripling (18) und Nikita Boychenko (10).

Prüfungen nach dem Umbau: person-verify 5/5 (254 bezahlte Personen, Baseline gehalten), kartei-verify grün, event-inventar 25/25, login-notfall-test 46/46.

## 29.07.2026 — Der API-Weg ist versperrt: Kontoabgleich läuft über CSV

**Der Befund:** Wise unterstützt „retrieving balance statements via API" mit persönlichen Zugangstoken nur für Konten in den USA, Kanada, Australien, Neuseeland, Singapur und Malaysia. FIAON LTD ist britisch. Kein Codefehler — deshalb wurden alle sieben Signatur-Varianten abgewiesen. Der Code lief gegen eine geschlossene Tür.

Der API-Code wurde **nicht gelöscht**, sondern stillgelegt: `server/lib/wise-api.ts` trägt den Grund oben im Kopf, und ein Schutzschalter verhindert die versehentliche Nutzung. Nach einem Partnerschaftsabkommen mit Wise genügt `WISE_AKTIV=1`. Zuordnung, Bankbuch und Bericht sind gemeinsam genutzt — es änderte sich dann nur, woher die Umsätze kommen.

### Der eigentliche Grund für das Chaos

Der alte Import zerlegte die Datei **im Browser** mit einer festen Spaltentabelle und verlangte die Werte `CREDIT` und `DEPOSIT`. Hieß eine Spalte anders, verschwand die Zeile wortlos. Zugeordnet wurde ausschließlich über eine Referenz im Verwendungszweck — wer ohne Referenz überwies, blieb liegen, auch bei eindeutigem Namen und Betrag. **Ergebnis: 9 von 100 Eingängen zugeordnet.**

### `server/lib/wise-csv.ts` — liest jetzt der Server, nicht der Browser

- **Spalten flexibel** — Datum, Betrag, Währung, Verwendungszweck, Absender, Absender-IBAN und Transaktions-ID werden in deutschen wie englischen Schreibweisen erkannt, bei Komma, Semikolon und Tabulator.
- **Fehlt eine Pflichtspalte, bricht der Import ab** und nennt die tatsächlich gefundenen Überschriften. Kein stilles Weiterlaufen. Genau das hat vorher Geld gekostet.
- **Jede übersprungene Zeile wird mit Nummer und Grund benannt.** Am Ende muss die Rechnung aufgehen: gelesen = Eingänge + Ausgänge + intern + übersprungen.
- **Richtung über das Vorzeichen**, nicht über eine Spalte, die es je nach Export gar nicht gibt. Ein negativer Betrag ist immer ein Ausgang. Umbuchungen zwischen eigenen Konten gelten nie als Kundengeld.
- **Deutsch und englisch getrennt gehalten**: „1.234,56" und „1,234.56" ergeben beide 123456 Cent. Eine Verwechslung hier hätte einen Faktor 1000 zur Folge.

**73 Tests** (`scripts/wise-csv-test.ts`), ohne Datenbank und ohne Netz — auch für die Fälle, in denen der Leser **abbrechen muss**.

### Zugeordnet wird jetzt in Stufen

Referenz, Absender-IBAN, Name mit exaktem Betrag — alles Unsichere bleibt Vorschlag mit Begründung im Klartext. Das gilt für den Upload **und** für „Offene neu abgleichen": Die 100 bereits vorhandenen Eingänge profitieren davon, ohne dass etwas neu importiert werden muss.

Mehrfach-Import ist vorgesehen: Die Transaktions-ID ist der Schlüssel, bekannte Zeilen werden erkannt. Eine von Hand gesetzte oder bereits verbuchte Zuordnung wird dabei **nie** überschrieben.

### `scripts/wise-csv-import.ts` — der volle Abgleichsbericht

Vier Kategorien mit Anzahl und Summe: Geld da und bezahlt · **Geld da, aber im System offen** (das ist der Schaden: diese Kunden werden gemahnt) · als bezahlt geführt ohne Beleg · Geld ohne Zuordnung.

Dazu die Frage, um die es geht: **Wie viele der als bezahlt geführten Bestellungen haben einen echten Bankeingang?** Mit ausdrücklichem Hinweis, dass „ohne Beleg" nicht „hat nicht bezahlt" heißt, solange der Auszug nicht den ganzen Zeitraum abdeckt — der Bericht nennt deshalb den abgedeckten Zeitraum mit.

**Standardlauf schreibt nichts.** Mit `--apply` wird ausschließlich das Bankbuch gefüllt. In keinem Lauf wird eine Bestellung auf bezahlt gesetzt, `confirmed_email_sent_at` angefasst, eine E-Mail verschickt oder Provision gebucht. Verbuchen bleibt ein eigener, ausdrücklicher Schritt.

## 29.07.2026 — Wise weist die Signatur ab: Diagnose statt Raten

Das Schlüsselpaar ist geprüft, der Schlüssel bei Wise aktiv — und die Unterschrift wird trotzdem abgelehnt. Die bisherige Fehlermeldung endete mit „Antwort:" und dahinter stand nichts. Damit war nicht einmal erkennbar, **welcher** der beiden 403-Fälle zugeschlagen hatte: fehlende Berechtigung oder abgelehnte Unterschrift. Eine Meldung, die das offenlässt, ist keine Hilfe, sondern eine Falle.

### Was der Abgleich mit der offiziellen Wise-Vorlage ergeben hat

Verfahren, Kopfzeilen und Kodierung stimmen mit `transferwise/digital-signatures-examples` überein. Ein Punkt ließ sich dabei als Ursache **ausschließen**: Im Beispiel von Wise baut der Wiederholungsaufruf `intervalStart`/`intervalEnd` aus der aktuellen Uhrzeit neu — die URL unterscheidet sich also zwischen erstem und zweitem Versuch, und es funktioniert trotzdem. Die Einmal-Kennung ist damit **nicht an die exakte URL gebunden**.

Drei Abweichungen blieben: Wir sendeten keinen `User-Agent` (die Vorlage sendet `tw-statements-sca`), `Accept` statt `Content-Type`, und einen anderen Endpunkt-Zweig.

### Fehlermeldungen, die den Fall tatsächlich aufklären

Bei jedem abgewiesenen Aufruf stehen jetzt: HTTP-Status, `x-2fa-approval-result`, sämtliche aussagekräftigen Kopfzeilen, der Antwortkörper im Klartext, Länge von Kennung und Unterschrift, sowie Art und Form des Schlüssels.

Eine Angabe ist dabei besonders aufschlussreich: **ob in der Antwort eine neue Kennung zurückkam.** Ist es eine andere als die unterschriebene, hat Wise die Kette neu begonnen — die Unterschrift wurde dann gar nicht erst gewertet. Das ist ein völlig anderer Fehler als eine geprüfte und verworfene Unterschrift, sieht am nackten Statuscode aber identisch aus.

Ein leerer Antwortkörper wird als solcher benannt statt einfach nichts anzuzeigen — Wise sendet bei 403 regelmäßig keinen Text, die Wahrheit steht in den Kopfzeilen.

### `scripts/wise-sca-diagnose.ts` — misst, statt zu vermuten

Ohne Netz wird bewiesen, dass zwei unabhängige Wege in Node dieselbe Unterschrift ergeben, dass sie 344 Zeichen lang ist und aus Standard-Base64 besteht. Damit sind Verfahren und Kodierung als Ursache erledigt.

Danach werden sieben Varianten **einzeln am lebenden System** durchgeprüft: die aktuelle, die mit den Kopfzeilen der Vorlage, Base64URL, Hex, PSS, nur-Kennung-ohne-Unterschrift und der Endpunkt aus der Vorlage. Jede holt sich eine **frische** Einmal-Kennung — sonst misst man nur, dass die vorige verbraucht ist, und hält das für einen Signaturfehler.

Ausgegeben wird außerdem der aus `WISE_PRIVATE_KEY_B64` abgeleitete **öffentliche** Schlüssel samt Fingerabdruck. Der ist nicht geheim und genau das, was man mit Wise vergleichen will. Token, privater Schlüssel und der Wert der Kennung erscheinen nirgends.

Nimmt Wise keine einzige Variante an, ist die Ursache nicht mehr im Code zu suchen. Dann bleibt der Fall, den die Wise-Oberfläche nicht sichtbar macht: Schlüssel und Token gehören zu unterschiedlichen Benutzern oder Profilen.

## 29.07.2026 — Wise live, Teil 2: Signatur für die starke Kundenauthentifizierung

Kontoauszüge sind bei Wise besonders geschützt. Der erste Aufruf wird **absichtlich mit 403 abgewiesen** und trägt im Antwortkopf `x-2fa-approval` eine Einmal-Kennung. Wer den privaten Schlüssel besitzt, unterschreibt sie und wiederholt den Aufruf. Damit beweist unser Server, dass er zu dem bei Wise hinterlegten öffentlichen Schlüssel gehört.

Das sitzt jetzt zentral in `get()` in `server/lib/wise-api.ts` — jeder Aufruf des Moduls ist automatisch abgedeckt, Profile wie Konten wie Auszüge. **Genau eine Wiederholung**, danach ein klarer Fehler.

### Warum das mehr Sorgfalt verlangt als es aussieht

Ein 403 von Wise sieht immer gleich aus. Er kann dreierlei bedeuten: Signatur fehlt, Signatur falsch, oder schlicht keine Berechtigung. Wer das nicht auseinanderhält, sucht stundenlang am falschen Ende. Deshalb unterscheidet der Code:

- **403 ohne `x-2fa-approval`** → keine Signaturfrage, sondern fehlende Leserechte des Tokens.
- **403 nach der Unterschrift** → meldet `x-2fa-approval-result` mit und nennt die häufigste Ursache: hinterlegter öffentlicher Schlüssel und `WISE_PRIVATE_KEY_B64` stammen nicht aus demselben Paar.
- **Schlüssel fehlt, ist kein PEM oder kennwortgeschützt** → jeweils eigene Meldung im Klartext, statt eines Absturzes aus der Krypto-Bibliothek.

### Beweis statt Behauptung (`scripts/wise-sca-test.ts`, 12 Prüfungen, ohne Wise und ohne Netz)

Ob unsere Unterschrift stimmt, würde uns sonst erst Wise sagen — mit einem nackten 403. Der Test erzeugt daher ein eigenes Schlüsselpaar, unterschreibt mit dem privaten Teil und lässt den öffentlichen Teil prüfen.

Die wichtigste Prüfung betrifft eine Falle, in die man leicht tappt: **PKCS#1 v1.5 gegen PSS.** Beides heißt „RSA mit SHA-256", beides erzeugt eine gültig aussehende Unterschrift — aber sie sind unvereinbar, und Wise akzeptiert nur v1.5. Der Test belegt, dass wir v1.5 verwenden und dass die PSS-Variante durchfallen würde.

### Nebenbei behoben

Ein fehlender `WISE_API_TOKEN` wurde als „Wise nicht erreichbar" gemeldet — ein Einrichtungsfehler, getarnt als Netzproblem. Solche Meldungen kosten eine halbe Stunde Suche an der falschen Stelle. Konfigurationsfehler werden jetzt unverändert durchgereicht.

`scripts/wise-phase0.ts` meldet außerdem in der ersten Sekunde, ob Token und Schlüssel brauchbar sind — vorher wäre das erst nach Profilen und Konten aufgefallen.

## 29.07.2026 — Wise live, Teil 1: Zugang und Zuordnung (noch keine Buchung)

**Das Problem in einem Satz:** Der Kontoabgleich lief über einen CSV-Upload von Hand. Wer ihn vergisst, verliert Zahlungen — der Kunde hat bezahlt, das System weiß es nicht, und ein Agent ruft ihn zur Mahnung an.

Wie groß das ist, zeigt eine einzige Zahl: **157 Bestellungen stehen auf „Kunde sagt, er hat bezahlt"** — bei 264 tatsächlich verbuchten Zahlungen. Ein erheblicher Teil dieser 157 dürfte bezahlt haben, ohne dass es je jemand verbucht hat.

### Was gebaut wurde

- **`server/lib/wise-api.ts`** — liest die Umsätze direkt bei Wise. Ausschliesslich lesende Aufrufe; dieses Modul kennt keine Funktion, die bei Wise etwas auslösen könnte. Der Token kommt nur aus der Umgebung, wird nie geloggt und aus jeder Fehlermeldung entfernt. Alle Profile und Währungskonten, Zeitraum in 400-Tage-Fenstern (Wise erlaubt 469), Wiederholung mit wachsender Wartezeit bei Überlast.
- **`server/lib/zahlungs-zuordnung.ts`** — Zuordnung in vier Stufen. Automatisch nur bei **Referenz im Verwendungszweck**, **übereinstimmender Absender-IBAN** oder **exaktem Betrag mit eindeutigem Namen**. Alles andere wird Vorschlag mit Begründung im Klartext („Name 90 % ähnlich, Betrag exakt").
- **`scripts/wise-phase0.ts`** — nur lesend, berichtet die vier Kategorien: stimmt · fehlt im System · im System ohne Geld · nicht zuordenbar.

### Warum die Automatik absichtlich zurückhaltend ist

Der teure Fehler ist nicht „nicht zugeordnet" — das klärt ein Mensch in zehn Sekunden. Der teure Fehler ist die **falsche** Zuordnung: Sie setzt einen fremden Kunden auf bezahlt, schickt ihm eine Bestätigung, bucht womöglich Provision, und der echte Zahler wird weiter gemahnt. Deshalb gilt: Passen zwei Bestellungen gleich gut, wird **nichts** automatisch entschieden.

Tippfehler sind dabei ausdrücklich eingeplant: „Müller" / „Mueller" / „Muler", vertauschte Vor- und Nachnamen, Mädchenname, Firma statt Person. Zahlt ein Ehepartner oder ein Elternteil, ist die **Referenz** der Anker — ein abweichender Einzahlername blockiert die Zuordnung nicht, wird aber sichtbar gemacht.

### Beweis statt Behauptung (`scripts/zuordnung-test.ts`, 28 Prüfungen, ohne Wise und ohne Datenbank)

Umlaute, ein Tippfehler im Nachnamen, vertauschte Namensteile, Dritt-Zahler, Teilzahlung, zwei Kunden mit demselben Namen und Betrag. Der letzte Fall ist der wichtigste: Er **muss** unentschieden bleiben, und er bleibt es.

Beim Schreiben der Tests fiel auf, dass die reine Zuordnungslogik über `extractRef` die gesamte Datenbank mitzog und dadurch nicht prüfbar war. Die Funktion liegt jetzt bei der Logik; `fiaon-reconcile.ts` re-exportiert sie unverändert, alle bisherigen Aufrufer bleiben gültig.

### Was ausdrücklich NICHT passiert ist

Keine Buchung, kein Status, keine E-Mail, keine Provision. `confirmed_email_sent_at` und alle Versand-Merker bleiben unangetastet — ein Neuaufbau des Zahlungsstatus darf keine E-Mail-Welle auslösen.

Zur Anweisung „alles Verbuchte weg": Das **Ledger** `fiaon_bank_txns` wird beim scharfen Lauf archiviert und aus den Live-Daten neu aufgebaut. Der Zahlungsstatus der Kunden wird dabei **nicht** pauschal zurückgesetzt — das würde bezahlte Kunden aus ihrem Konto aussperren und sie zurück in die Mahnstrecke werfen. Abweichungen erscheinen als Kategorie 3 und werden einzeln entschieden.

## 29.07.2026 — Personenmodell, Teil 1: Messung, Schema, Backfill (noch nicht scharf)

**Das Problem in einem Satz:** `fiaon_applications` vermischt „wer ist der Mensch" mit „was hat er bestellt". Deshalb zählen wir Kunden doppelt, verlieren Daten beim Zusammenführen und sperren Zahler aus.

### Was gemessen wurde (`scripts/person-phase0.ts`, nur lesend, 4,9 s)

| | |
|---|---|
| Zeilen in `fiaon_applications` | 5.963 |
| **Menschen dahinter** | **2.142** (2,78 Zeilen je Mensch, im Extremfall 12) |
| Zeilen ohne E-Mail **und** ohne Telefon | 3.231 — **54 % der Tabelle ist niemand** |
| bezahlte Zeilen / bezahlte **Menschen** | 264 / **254** → wir zählen 10 Kunden zu viel |
| Leads, die längst Antragsteller sind | 757 von 2.840 |
| strittige Agenten-Zuordnungen **mit Geld** | **19** |
| bezahlte Kunden ohne jedes Passwort | **13 — sie kommen heute nicht in ihr Konto** |

Vollständiger Befund: `SYSTEM_DIAGNOSE.md`, Abschnitt „PERSONENMODELL — PHASE 0".

Eine Erwartung wird dabei ausdrücklich korrigiert: Die Zusammenführung bringt **+5 anrufbare Karten**, nicht hunderte. Ihr Wert liegt in einer Akte statt verstreuter Zeilen — nicht in mehr Arbeitsvorrat.

### Was gebaut wurde

- **`fiaon_persons`** — ein Datensatz je Mensch: Name, primäre Kontaktdaten, Adresse, Passwort, Konto-Status, zuständiger Agent, Quelle des Erstkontakts, Qualitäts-Kennzeichen, Platz für das SEPA-Mandat (Phase 3).
- **`fiaon_person_aliases`** — **jede** je verwendete E-Mail und Rufnummer. Damit endet „beim Zusammenführen verschwinden Daten": die alte Adresse findet die Person weiterhin.
- **`person_id`** an `fiaon_applications` und `fiaon_leads` — das **einzige** Feld, das der Umbau an Bestandszeilen schreibt.
- Ein eindeutiger Index erzwingt **in der Datenbank**, dass keine zwei Personen dieselbe E-Mail tragen. Ein fehlerhafter Lauf scheitert dadurch sofort, statt still Dubletten zu bauen.
- **`scripts/person-backfill.ts`** — standardmässig Trockenlauf, schreibt nur mit `--apply`, jeder Lauf hat eine Stapel-ID und ist mit `--undo <STAPEL>` vollständig zurücknehmbar.
- **`scripts/person-verify.ts`** — fünf Prüfungen, nur lesend.

### Zwei Fehler, die der Testlauf gefunden hat (beide behoben)

1. **`--limit` erzeugte falsche Personen.** Bei gekürzter Personenliste hielt der Lead-Durchlauf jeden Lead für „gehört zu keinem Antrag" und legte 2.809 statt 2.076 Lead-Personen an. Der Stapel wurde mit `--undo` restlos entfernt; der begrenzte Lauf legt jetzt bewusst gar keine Lead-Personen mehr an.
2. **Ein per Telefon verknüpfter Lead brachte seine E-Mail nicht mit.** Damit wäre genau der Datenverlust entstanden, den wir beenden wollen. Jetzt werden die Kontaktdaten eines verknüpften Leads immer zu Aliasen der Person.

### Was ausdrücklich NICHT passiert ist

Keine Zeile gelöscht, keine Zeile inhaltlich verändert. **Keine Zahlung, kein Status, keine Provision angefasst** — `person-verify.ts` prüft die Provisionssumme auf den Cent gegen die Baseline (217 Einträge · 3.203,40 €) und meldet sie unverändert. Kein automatisches Zusammenführen bei blosser Telefon-Gleichheit: 49 Nummern verbinden 139 verschiedene E-Mail-Familien (Haushalte, Firmenzentralen) — das bleibt ein Vorschlag für den Menschen.

### Was noch aussteht

Der scharfe Backfill (`--apply`) läuft **abends**, nicht in der Telefonzeit. Danach folgen die Lesepfade (Login, Kartei, Kundenzählung) und der Schutz gegen Neuanlage im Antrag, im Bonitäts-Kauf und im Lead-Eingang. Bis dahin liest **kein** Programmteil `person_id` — das System verhält sich exakt wie vorher.

## 29.07.2026 (NOTFALL) — Zahlende Kunden konnten sich nicht einloggen

Kunden — und der Betreiber selbst — sahen beim Login nur „Ungültige Anmeldedaten". Ihr Passwort war richtig. Ihr Konto war in Ordnung. **Der Login hat nur nie in ihr Konto geschaut.**

### Die Ursache — in einer Zeile

Der Login suchte den Kunden so:

```sql
WHERE email = ? ORDER BY created_at DESC LIMIT 1
```

Er nahm also **ausschließlich die jüngste Antragszeile** einer E-Mail-Adresse. Das war jahrelang unauffällig — bis der **Bonitäts-Check** dazukam. Eine Bonitäts-Bestellung legt bewusst eine **eigene Antragszeile** an (`FIAON-SCHUFA-…`, siehe Eintrag vom 28.07.), damit eine 74-€-Bestellung keinen zweiten Kunden erzeugt. Diese Zeile hat **kein Passwort** — sie ist kein Konto.

**Folge:** In der Sekunde, in der ein Kunde den Bonitäts-Check bestellte, wurde diese Bestellzeile seine jüngste Zeile. Der Login las sie, fand kein Passwort und antwortete „Ungültige Anmeldedaten". Das echte Konto lag unversehrt eine Zeile weiter — unangesehen.

Genau das ist der Fall des Betreibers: Sein Login funktionierte am Vortag noch, weil er den Bonitäts-Check **erst am 28.07. um 10:26 Uhr bestellte**. Vier neue `FIAON-SCHUFA-…`-Zeilen später war sein Konto `FIAON-MNPTDV19-QYAJ` (Passwort vorhanden, Antrag abgeschlossen) für den Login unerreichbar.

### Zweite Ursache: Zwischenspeichern löschte Passwörter

Der Antragsstrecke-Speicher (`POST /application`) schrieb bei **jedem** Aufruf:

```
password = <Wert aus dem Formular>          →  ohne Passwort im Formular: NULL
utm      = { "password": <Wert> }           →  ohne Passwort im Formular: {}
```

Der Funnel speichert aber bei **jedem Schritt-Wechsel** zwischen (`antrag.tsx`, `useEffect` auf `[step]`) — **ohne** Passwort. Jeder dieser Zwischenspeicher löschte still beide Kopien des Kundenpassworts. Der Beweis steckt im Datensatz des Betreibers: sein `utm` ist ein leeres `{}`. **Jetzt gilt: ein Passwort wird nur gesetzt, niemals gelöscht** (`COALESCE`), und `utm` wird ergänzt statt ersetzt.

### Dritte Ursache: Der Rettungsweg war selbst zu

„Passwort vergessen" verlangte `status = 'completed'`. Bezahlte Konten stehen aber auf `payment_completed` bzw. `documents_submitted`. **263 von 268 bezahlten Kunden** bekamen dort „Kein Konto mit dieser E-Mail gefunden" — der Notausgang für die Ausgesperrten war verschlossen. Außerdem wurde nur `email` verglichen (Geschäftskunden hinterlegen `billing_email`) und wieder nur die jüngste Zeile geprüft. Die Identitätsprüfung selbst (Vorname + Nachname + E-Mail + Geburtsdatum) bleibt **unverändert streng** — nur der Status-Filter ist weg.

### Was gemessen wurde (Phase 0, `scripts/login-notfall-phase0.ts`, nur lesend)

| Befund | Zahl |
|---|---|
| Bezahlte Kunden gesamt | 268 |
| E-Mails, deren jüngste Zeile kein Passwort hat, eine ältere aber schon | **55** |
| Bezahlt und nirgends ein Passwort hinterlegt | 70 Zeilen |
| Bezahlt, aber `status <> 'completed'` → Passwort-Reset blockiert | **263** |
| Zugangs-Gate hätte bezahlte Kunden gesperrt | **0** (die vermutete Status-Ursache traf **nicht** zu) |

**Welche Hypothese zutraf:** die Dubletten-/Zusatzbestellungs-Nebenwirkung (H2) — allerdings nicht als „Merge verliert das Passwort", sondern als **„der Login liest die falsche Zeile"**. H1 (ein `catch`, der alles zu „Ungültige Anmeldedaten" macht) traf **nicht** zu: der `catch` antwortete korrekt mit 500. H3 (Status-Filter) traf für den Login **nicht** zu — wohl aber für „Passwort vergessen".

### Nachweis am echten Bestand (`scripts/login-notfall-verify.ts`, nur lesend)

Für jede bezahlte Kundenfamilie wurden alter und neuer Login gegeneinander gespielt:

| | |
|---|---|
| Bezahlte Kundenfamilien geprüft | 255 |
| konnten sich mit dem **alten** Login anmelden | 193 |
| können sich mit dem **neuen** Login anmelden | **239** |
| **durch den Fix wieder freigeschaltet** | **46** |
| brauchen „Passwort vergessen" (nie ein Passwort) | 14 — davon **12 können sich selbst befreien**, 2 brauchen den Betreiber (kein Name/Geburtsdatum hinterlegt) |
| Zahlung am Konto offen (korrekt abgewiesen) | 2 |
| **Zugangs-Gate umgangen** | **0** |

### Teil A — Fehlermeldungen, die etwas sagen

Statt einer Meldung für alles gibt es jetzt einen Fehlerkatalog. Jeder Fall hat einen Code, den der Kunde dem Support nennen kann:

| Code | Fall | Was der Kunde liest |
|---|---|---|
| `AUTH-01` | falsches Passwort **oder** unbekannte E-Mail | „E-Mail-Adresse oder Passwort stimmt nicht." — **wortgleich** in beiden Fällen, damit niemand fremde Adressen durchprobieren kann |
| `AUTH-02` | kein Passwort hinterlegt | „Für dieses Konto ist noch kein Passwort gesetzt." + direkter Weg zum Setzen — nicht mehr als „falsche Daten" getarnt |
| `AUTH-03` | Passwort richtig, Zahlung offen | „Deine Zahlung ist bei uns noch nicht eingegangen. Sobald sie bestätigt ist, wird dein Zugang automatisch frei." + was zu tun ist, wenn schon überwiesen wurde, **mit Zahlungsreferenz** |
| `AUTH-04` | Konto gesperrt | klare Ansage + Support-Hinweis |
| `AUTH-05` | technischer Fehler | „Technisches Problem — bitte in einem Moment erneut versuchen." + Fehlercode. **Nie** als Anmeldefehler |

`AUTH-03` und `AUTH-04` erscheinen **erst nach korrektem Passwort** — dann ist die konkrete Auskunft sicher. Auf der Login-Seite ist `AUTH-01` sachlich rot, alles andere ruhig blau: Es ist kein Fehler des Kunden, sondern ein Zustand.

**Eine Abwägung offen benannt:** `AUTH-02` verrät, dass zu dieser Adresse ein bezahltes Konto existiert. Ohne diese Auskunft bleiben genau die Kunden ausgesperrt, deren Passwort **uns** verloren gegangen ist. Darum eng begrenzt: nur bei **bezahlten** Konten **ohne jedes** Passwort. Alle anderen bekommen die neutrale Meldung.

**Jeder** Login-Versuch wird jetzt serverseitig protokolliert (`fiaon_login_log`): Grund, Zeit, **maskierte** E-Mail (`of•••@sch•••.com`) plus ein Pseudonym zum Gruppieren. Einsicht über `GET /admin/login-log`. Damit läuft ein Aussperren nie wieder unbemerkt. Nebenbei entfernt: Der Login schrieb bisher **das eingegebene Passwort im Klartext** und die **komplette Datenbankzeile** ins Server-Log.

### Teil B — Die Betroffenen wieder reinlassen

- **Ursache behoben, nicht Symptom:** Der Login betrachtet jetzt die ganze „Familie" einer E-Mail (`email`, `contact_email`, `billing_email`, normalisiert — die alte Exakt-Suche scheiterte schon an Großschreibung) **inklusive der Gewinner von Merges**. Das Passwort darf in jeder Zeile liegen; über Zugang und Portal-Daten entscheidet die Zeile, die wirklich das Konto ist (nicht gemergt > keine Zusatzbestellung > freigeschaltet).
- **Arbeitsliste:** `GET /admin/login-lockouts` — alle bezahlten Kunden mit Namen, Referenz und **Grund**, getrennt nach „durch den Fix behoben" und „braucht noch Handarbeit". Nur lesend, und sie benutzt **dieselbe** Auflösung wie der Login — sie behauptet also nichts anderes, als der Kunde erlebt.
- **„Passwort vergessen" geprüft:** Der Kundenweg (`/passwort-vergessen`) verschickt **gar keine E-Mail** — er prüft die Identität sofort und lässt direkt ein neues Passwort setzen. **Es gibt hier also keinen Make-Zweig, der fehlen könnte.** Der Weg war nur durch den Status-Filter blockiert und ist jetzt offen. (Der Make-Zweig `agent_password_reset` betrifft ausschließlich Mitarbeiter; `sendPasswordResetEmail` in `email-service.ts` gehört zu einem anderen Produkt und hängt nicht am FIAON-Kundenlogin.)

### Nicht angefasst

Keine Zahlungs- oder Provisionslogik. Das Zugangs-Gate ist **unverändert** (`LOGIN_ACCESS_STATUSES` bzw. `payment_status='paid'`) — es wird nur auf die richtige Zeile angewandt; maschinell gegengeprüft: 0 Fälle, in denen jemand ohne Freischaltung durchkäme.

### Geprüft

`scripts/login-notfall-test.ts` — **46 Prüfungen, alle bestanden**, ohne Datenbank und ohne echte Kundenpasswörter. Die Entscheidungslogik liegt dafür jetzt als reine Funktion in `server/fiaon-login-logic.ts` (vorher im Endpunkt vergraben und damit nicht prüfbar). Abgedeckt: neutrale Meldung wortgleich · Zahlung-offen-Meldung mit Referenz · defektes `utm` kippt die Entscheidung nicht · **der Fall des Betreibers als Attrappe** · Passwort aus gemergter Zeile · Altbestand-Passwort aus `utm` · Leerstring ist kein Passwort · gesperrt bleibt gesperrt · Zahlungs-Gate nicht umgehbar.

### Zwei offene Punkte für den Betreiber

1. **Kundenpasswörter stehen im Klartext** in der Datenbank (`password` und `utm->>'password'`). Das ist unabhängig von diesem Notfall zu beheben, gehört aber **nicht** in denselben Schritt: ein Wechsel auf Hashes ohne Übergangsphase würde alle Kunden erneut aussperren.
2. **Die `/admin`-Endpunkte in `fiaon-antrag.ts` sind nur durch `blockAgentsFromAdmin` geschützt** (Agent-Token wird abgewiesen), nicht durch `requireAdmin`. Die zwei neuen Endpunkte haben bewusst genau dasselbe Schutzniveau wie die bestehenden — das ist eine **vorbestehende** Lücke, die einmal geschlossen werden sollte.

## 28.07.2026 (Kundenbereich) — Der Bonitäts-Check wird das Herzstück des Dashboards

Der Bereich „Freischaltung / Ihre nächsten Schritte" ist komplett neu. Vorher stand das teuerste und wertvollste Angebot — die Bonitätsauskunft samt Auswertung — als **vierte Zeile einer Pflichtliste** zwischen Ausweis-Upload und Prüfung. Kein Wunder, dass kaum jemand kaufte.

### Phase 0 — was der Umbau zuerst gefunden hat (dokumentiert in `SYSTEM_DIAGNOSE.md`, B0–B4)

Der Grund für die schwachen Verkäufe war nicht nur die Darstellung. **Kauf und Pflicht sind zwei Pfade, die sich nie begegnen:**

- Der Kauf (`kind: "schufa"`, 74 €) erzeugt eine **eigene Antragszeile** `FIAON-SCHUFA-…`, die von der Verknüpfungslogik ausdrücklich ausgeschlossen ist (`fiaon-antrag.ts:622` und `:635`) — damit eine 74-€-Bestellung keinen zweiten Kunden und keine Agentenzuteilung erzeugt. Richtig gedacht, mit einer unbeabsichtigten Folge.
- Die Pflicht verlangt `hasSchufa`, und das ist **ausschließlich** `schufa_pdf` in der **eigenen** Zeile des Kunden — gefüllt nur durch **Upload** (`/upload-kyc`, Feld `schufaDoc`).
- **Ergebnis:** Ein Kunde konnte kaufen, 74 € bezahlen — und sein Dashboard sagte weiter „SCHUFA-Nachweis fehlt noch → Zu den Unterlagen". Auch die Lieferung per E-Mail änderte daran nichts. Die Belohnung für den Kauf war unsichtbar; im Zweifel lud der Kunde unsere eigene Lieferung selbst wieder hoch.
- Von den fünf Zuständen (nicht gekauft · Zahlung offen · bezahlt/in Arbeit · Auszug da · Analyse fertig) existierte am Kundendatensatz **genau einer**: „hochgeladen ja/nein".
- Der **Fahrplan** analysiert **Kontoauszüge**, nicht die SCHUFA. Die 74-€-Leistung endete bisher in der E-Mail und lebte im Portal nirgends weiter.

### Teil A — Der Bonitäts-Check ist jetzt der Held der Seite

Eigener, dominanter Bereich **direkt unter der Begrüßung — vor Kennzahlen und Karte** (maschinell geprüft). Wert zuerst, Aufgabe zweitens:

- **Was der Kunde bekommt**, in vier Punkten: Auskunft beschaffen · Analyse durch FIAON · persönlicher Fahrplan · begleitete Umsetzung.
- **Genau ein Knopf**: „Bonitäts-Check starten" → führt in die **bestehende** Bestellstrecke (unverändertes Popup mit vorbefüllten Daten). Preis transparent: 74 € einmalig, kein Abo.
- **Zustandsabhängig** statt Dauerwerbung: Nach dem Kauf wird aus dem Angebot ein Status („Nur die Zahlung fehlt noch" → „Wir beschaffen Ihre Auskunft" → „Ihr Fahrplan steht bereit"). Der Bereich begleitet, statt zu verkaufen, was schon gekauft ist.
- **Ehrlichkeit sichtbar, nicht kleingedruckt:** „Was wir nicht tun: Wir löschen keine Einträge und versprechen keinen bestimmten Score." Die Karte am Ende bleibt ein erarbeitetes Ziel über einen künftigen lizenzierten Partner — keine Zusage, kein Kreditangebot.

Damit die Zustände überhaupt darstellbar sind, gibt es einen neuen, **nur lesenden** Endpunkt `GET /agent/../bonitaet-status/:ref` (`fiaon-antrag.ts`): Er sucht die Bonitäts-Bestellung über die E-Mail des Kunden und meldet deren Zahlungsstand. **Kein `UPDATE`, kein `INSERT`, keine Änderung an Zahlung oder Freischaltung.**

### Teil B — Produkt und Verwaltung sind getrennt

| | vorher | nachher |
|---|---|---|
| Struktur | eine gemischte Liste „1 von 4 erledigt" + 2 Hinweis-Banner darüber | **„Ihr Weg"** (Produkt) und **„Noch zu erledigen"** (Verwaltung) |
| Bonitätsauskunft | Zeile 3 der Pflichtliste | eigener Held-Bereich oben |
| Fortschritt | „1 von 4" (liest sich wie drei Versäumnisse) | Reise mit fünf Etappen und „Sie sind hier: …" |

„Ihr Weg" zeigt Bonitäts-Check → Analyse → Fahrplan → Umsetzung → Ziel mit Zustand je Etappe. „Noch zu erledigen" nennt **nur** Verwaltung (Profil, Dokumente, Prüfung) — jeweils **mit Grund** („Gesetzlich vorgeschrieben für die Prüfung Ihrer Identität"). Ist nichts offen, wird daraus eine Erledigt-Bestätigung.

**Doppelungen aufgelöst:** Die Sticky-Balken („Profil unvollständig", „Nachricht von FIAON") erscheinen auf der Übersicht **nicht mehr** — dort steht dieselbe Aufgabe ausführlicher und ruhiger in „Noch zu erledigen". Auf allen anderen Seiten bleiben die Balken die Erinnerung. Rückfragen des Betreibers gehen dabei nicht verloren (geprüft).

Zusätzlich auf der **Unterlagen**-Seite: Wer gekauft und bezahlt hat, sieht dort jetzt „Bestellt" bzw. „Wird beschafft" statt „Ausstehend" — und den Satz „Sie müssen hier nichts hochladen". Das ist die zweite Stelle, an der der Widerspruch aus B0 sichtbar wurde.

### Teil C — „Was Sie danach erwartet"

Darunter eine Sektion, die den Fahrplan vor der Freischaltung sichtbar macht: drei Beispiel-Etappen (Ihre Einträge im Klartext · Ihre größten Hebel zuerst · Reihenfolge und Zeitplan). Verschlossene Inhalte erscheinen als **graue Platzhalter-Balken** — wie in der Agenten-Kartei gelöst und ehrlicher als ein Weichzeichner: Es wird nichts Echtes versteckt und **kein Fülltext, keine Bewertungen, keine unbelegten Zahlen** erfunden. Dazu der vertrauensbildende Satz: „Die Auswertung und der Fahrplan sind im Preis der Auskunft enthalten — es kommt nichts hinzu."

### Teil D — Design auf dem Niveau des Agenten-Portals

Neue Ebenen in `index.css`, dieselbe Sprache wie die `.agent-*`-Klassen: `.db-hero` (stärkstes Element, heller Verlauf plus vierschichtiger Schatten), `.db-panel` (Sachkarte), `.db-act` (Primäraktion mit Lichtreflex und Eindrücken auf `:active`), `.db-tile-c`, `.db-bar`. Auftritt gestaffelt (60 · 140 · 200 · 260 ms), `.db-light` wandert in 26 s einmal durchs Bild.

**Animiert werden ausschließlich `transform` und `opacity`.** Dabei fiel ein Altlast-Verstoß auf derselben Seite auf: Die Sektions-Einblendung `dbFadeUp` animierte `filter: blur(2px)` — das wurde bei jedem Bild neu gerechnet. Jetzt nur noch Verschiebung und Deckkraft.

### Gemessen (Playwright, 4-fache CPU-Bremse, 60-s-Abbruch)

`scripts/dashboard-bonitaet.mjs` prüft 15 Zusagen:

| Prüfung | Ergebnis |
|---|---|
| Bildrate beim Laden | **78 Bilder/s** (Ziel ≥ 50) |
| Bildrate beim Scrollen | **120 Bilder/s** |
| 380 px: Bereich **inkl. Knopf** ohne Scrollen | Knopf-Unterkante **690 px** von 780 px |
| Knopf als Touch-Ziel | **54 px** hoch |
| Bereich steht vor Kennzahlen und Karte | ja |
| Knopf öffnet die bestehende Bestellstrecke | ja, Popup mit Preis |
| Alle vier Zustände | nicht gekauft · Zahlung offen · in Arbeit · Auswertung fertig — **alle korrekt** |
| Produkt/Verwaltung getrennt | zwei Bereiche, Auskunft **nicht** mehr in der Pflichtliste |
| Keine Aufgabe doppelt | Balken erscheinen auf der Übersicht nicht mehr |
| Rückfragen bleiben sichtbar | beide in der Liste |
| Volltextprüfung Versprechen | **9 Muster** (SCHUFA-frei, Einträge löschen, garantierter Score, Kreditzusage …) in 4 Zuständen — **kein Treffer** |
| `prefers-reduced-motion` | Licht steht, kein Auftritt, kein Druckgefühl, alles lesbar |
| Desktop 1440 px | Bereich im ersten Bildschirm, Weg und Verwaltung nebeneinander, **77 %** Breite genutzt |

**Bundle:** Haupt-Chunk **1.613,55 → 1.613,56 kB** (gzip **420,03 → 420,03 kB**) — praktisch unverändert, weil die neue Sektion 131 Zeilen alten Inline-Code ersetzt. CSS **256,66 → 259,44 kB** (gzip **37,91 → 38,41 kB**): **+2,8 kB** (gzip +0,5 kB) für die neue Design-Ebene. Das ist die einzige Zunahme; JavaScript ist flach geblieben.

**Geschäftslogik unverändert:** keine Zahlungs-, Preis- oder Freischaltungslogik berührt, kein bestehender Endpunkt geändert, ein neuer Endpunkt der ausschließlich liest.

**Zwei Entscheidungen liegen beim Betreiber** (`SYSTEM_DIAGNOSE.md`, B3): Soll ein **bezahlter** Kauf den Freischaltungs-Nachweis automatisch erfüllen? Und bleibt die Auskunft überhaupt Pflicht für die Freischaltung? Beides ist Freischaltungslogik und wurde deshalb **nicht** eigenmächtig geändert.

---

## 28.07.2026 (später) — „Guten Abend" um 09:30, Bestands-Blick, Menü-Zähler, Feinschliff

### Teil A — Der Zeit-Bug, mit der Ursache belegt

Um 09:30 Uhr stand „**Guten Abend**" auf der Startseite. Ursache ist keine Zeitzone, sondern eine stillschweigend fehlgeschlagene Zahlen-Umwandlung:

```
new Intl.DateTimeFormat("de-DE", { hour: "2-digit", hour12: false }).format(jetzt)
  →  "09 Uhr"          (deutsches Format hängt „ Uhr" an)
Number("09 Uhr")       →  NaN
NaN < 11  → false  ·  NaN < 18  → false   ⇒  letzter Zweig: „Guten Abend"
```

Mit `NaN` ist **jeder** Vergleich falsch, also fiel die Bedingungskette bis zum letzten Zweig durch. Bitter: Der Server warnt an genau dieser Stelle im Kommentar vor dieser Falle (`berlinHour()` in `server/routes/fiaon-antrag.ts`) — die Startseite hat sie trotzdem gebaut. Der Fehler blieb unentdeckt, weil abends getestet wurde: da war das falsche Ergebnis zufällig richtig.

**Behoben und geprüft:** Die Zeit-Logik liegt jetzt in `client/src/pages/agent/zeit.ts` — bewusst ohne React und ohne Fenster, damit sie mit **festen Uhrzeiten** prüfbar ist. `formatToParts` liefert die Stunde ohne Beiwerk, `hourCycle: "h23"` verhindert die „24" um Mitternacht, und eine nicht bestimmbare Stunde liefert **`null`** statt einer geratenen Zahl. Aus `null` wird „**Hallo, Justin**" — nie stillschweigend „Abend".

Grenzen festgeschrieben: **05:00–10:59 Morgen · 11:00–17:59 Tag · 18:00–04:59 Abend.**

Neues Werkzeug `scripts/gruss-test.ts` (44 Prüfungen, Laufzeit < 1 s): alle Grenzen inkl. 04:59/10:59/17:59, Mitternacht, **beide Zeitumstellungen 2026** (29.03. und 25.10., je beide Seiten der Umstellung), Sicht aus Bangkok/Wien/New York/UTC, ungültige Datumswerte, Jahreswechsel-Monatsname.

**Versandfenster gegengeprüft (wie verlangt, auch ohne Fund):** `berlinHour()` in `fiaon-antrag.ts` und `fiaon-leads.ts` nutzt bereits `formatToParts` + `Number.isFinite` — dieselbe Fehlerklasse ist dort **nicht** vorhanden. Nachgerechnet mit festen Zeitpunkten: 07:59 kein Versand · 08:00 Versand · 19:59 Versand · 20:00 kein Versand, in Sommer- **und** Winterzeit korrekt.
**Eine Restlücke, bewusst nicht eigenmächtig geändert:** Scheitert `Intl` (praktisch nur bei kaputtem ICU), fällt der Server auf `getUTCHours()` zurück und rechnet UTC als Berlin — im Sommer zwei Stunden zu früh, wodurch am Rand bis 22:00 Uhr deutscher Zeit versendet werden könnte. Saubere Lösung wäre „im Zweifel nicht senden" (Fenster geschlossen halten). Das ist eine Verhaltensänderung am Versand und braucht deine Freigabe.

### Teil B — Eigener Bestand als vierter Block

Unter der Primäraktion stand Leere. Jetzt steht dort ein **Rückblick, kein zweiter Arbeitsbereich**:

- **Drei Segmente mit Zahlen:** In Betreuung · Zahlung angekündigt · Abgeschlossen. Jede Kachel führt nach `/agent/meine-kunden` mit **vorgewähltem Filter** (`?filter=offen|angekuendigt|bezahlt`) — dafür liest diese Seite den Filter jetzt aus der Adresse.
- **Eine Quelle für Zahl und Liste:** Der neue Endpunkt `GET /agent/kartei/segmente` (nur lesend, eine Abfrage) zählt mit **genau denselben** SQL-Ausdrücken wie die Filter, auf die er verlinkt (`MEINE_FILTER`). Die Startseite kann also nicht „7" zeigen und die Liste danach fünf Zeilen.
- **Zuletzt abgeschlossen:** die letzten drei **echten** Abschlüsse mit Name, Paket und Provision — wertig gesetzt, nicht als Tabellenzeile. Boni und Gutschriften sind ausdrücklich ausgeschlossen (`is_bonus`), sie sind kein Verkauf.
- **Leerer Bestand:** „Noch keine eigene Akte — übernimm deine erste aus der Kartei" mit Weg dorthin, statt einer leeren Fläche.
- **Keine Anruf-Knöpfe, keine Aufgabenliste.** Geprüft: 0 Knöpfe in dieser Sektion. Gearbeitet wird über die Primäraktion und in der Kartei.

Leads ohne Bestellung erscheinen in den drei Zahlen nicht (sie haben keinen Zahlungsstatus) — sie stehen auf „Meine Kunden" unter „Alle". Das steht auch als Kommentar am Endpunkt.

### Teil C — Menü-Zähler: eine Quelle, eine Wahrheit

Außen stand 3, innen 2. Grund: Der Zähler am Auslöser addierte **Rückläufer**, die im Menü an keiner Stelle auftauchten — der Agent suchte den dritten Punkt vergeblich.

Jetzt gibt es genau eine Karte `{ "/agent/kartei": Rückläufer, "/agent/mehr": Neuerungen + Betreiber-Antworten }`. Der Auslöser ist deren **Summe**, die Menüpunkte zeigen ihre Einträge, und die Desktop-Navigation nutzt dieselbe Karte (vorher zeigte sie dort nur die Feedback-Antworten). Wer künftig etwas mitzählen will, muss es einem Menüpunkt zuordnen — sonst kann es nicht gezählt werden. **Rückläufer sind jetzt am Menüpunkt „Kartei" sichtbar**, dort wird sie bearbeitet.

Geprüft in vier Zuständen (gemischt 1+2 · nur Rückläufer 3 · nur Antworten 2 · nichts offen): außen = Summe innen, jedes Mal. Zusätzlich wird das echte Lese-Ereignis (`agent-updates-seen`) ausgelöst — beide Zähler sinken sofort und gemeinsam.

### Teil D — Kleiner, ruhiger, hochwertiger

| | vorher | nachher |
|---|---|---|
| Überschrift | 27 / 36 px | **24 / 30 px** |
| Kontostand | 42 / 56 px | **34 / 42 px** |
| Primäraktion | 76 px hoch, 17/19 px Schrift | **68 px, 15,5/17 px** |

Dazu: Einblendung weicher (10 px Versatz, Kurve `cubic-bezier(.16,1,.3,1)`, 70 ms Staffel), Kontostand zählt in 1,1 s flüssig hoch statt zu springen, neue Ebene `.agent-lift` für die Bestands-Karte (eine Stufe unter dem Kontostand) und `.agent-tile` für die Segmente mit feinem Druckgefühl beim Antippen. **Animiert werden weiterhin ausschließlich `transform` und `opacity`.**

**Desktop nutzt endlich die Fläche:** Kontostand und Primäraktion links, Bestand rechts (`lg:grid-cols-2`). Die DOM-Reihenfolge ist identisch zur Handy-Reihenfolge — kein Umsortieren per CSS, also auch keine überraschende Tab-Reihenfolge. Gemessen: Der Inhalt nutzt **88 %** der Fensterbreite (vorher eine schmale Spalte mit toter Fläche links und rechts).

### Gemessen (Playwright, 4-fache CPU-Bremse, 60-s-Abbruch)

`scripts/startseite-tempo.mjs` prüft jetzt 15 Zusagen, darunter die neuen:

| Messpunkt | Ergebnis |
|---|---|
| Bildrate beim Laden | **91 Bilder/s** (Ziel ≥ 50) |
| Bildrate beim Scrollen | **121 Bilder/s** |
| 380 px: Begrüßung + Kontostand + Primäraktion | unterste Kante **550 px** von 780 px (vorher 598 px — der kleinere Maßstab schafft Luft) |
| Begrüßung zu 6 festen Uhrzeiten | 09:30 Sommer/Winter, 06:30, 13:15, 20:05, 00:10 — **alle korrekt** |
| Bestands-Segmente | 9 · 4 · 27 mit korrekten Filter-Zielen |
| Zuletzt abgeschlossen | 3 echte Abschlüsse, Bonus **nicht** enthalten |
| Bestand ohne Arbeits-Knöpfe | **0** Anruf-/Aktionsknöpfe |
| Leerer Bestand | motivierender Zustand statt leerer Fläche |
| Menü-Zähler in 4 Zuständen | außen = Summe innen, **immer** |
| Desktop 1280 px | alles im ersten Bildschirm (595 px), 88 % Breite genutzt |
| `prefers-reduced-motion` | Schimmer aus, keine Einblendung, kein Druckgefühl, voll nutzbar |

Ein Messfehler wurde dabei selbst behoben: Die Ladephasen-Messung startete nach `goto` und konnte in den alten Ausführungskontext fallen — sie meldete dann **0 Bilder/s**, obwohl nichts ruckelte. Der Bildzähler läuft jetzt ab Dokumentstart mit.

**Bundle:** Haupt-Chunk **1.607,44 → 1.613,55 kB** (gzip **418,35 → 420,03 kB**), CSS **255,99 → 256,66 kB**. Das sind **+6,1 kB** (gzip +1,7 kB) für eine komplette neue Sektion, den geprüften Zeit-Helfer und den Agenten-Changelog-Eintrag. Gegenüber dem Stand **vor** dem Startseiten-Umbau (1.618,19 kB / gzip 421,26 kB) ist die Auslieferung weiterhin **kleiner**. Ich habe nichts gefunden, was sich ohne Funktionsverlust herausnehmen ließe — deshalb hier die ehrliche Zahl statt einer geschönten.

**Prüfungen:** `gruss-test.ts` **44/44** · `startseite-tempo.mjs` **15/15** · `kartei-verify.ts` **6/6** · `event-inventar.ts --check` **25/25**. Geschäftslogik unverändert; die einzige inhaltliche Änderung ist der Zeit-Bug.

---

## 28.07.2026 — Startseite /agent: drei Elemente, eine Handlung

Die Startseite war ein Zahlenfriedhof mit konkurrierenden Elementen: Tagesziel-Ringe bei 0 %, ein Benchmark-Aushang, ein anonymer Aktivitäts-Feed, eine Arbeitsliste mit Anruf-Knöpfen, ein Partner-Balken, der Wunschgehalt-Rechner — und **zwei** „Nächste Akte"-Knöpfe. Sie ist jetzt eine reine Oberflächen-Arbeit auf drei Elemente reduziert. **Keine Geschäftslogik verändert, kein Endpunkt geändert, kein Betrag neu gerechnet.**

### Was verschwunden ist (ersatzlos)

| Weg | Warum |
|---|---|
| Tagesziel-Ringe („Provision 0,00 € / 30,00 €", „Kontakte 0 / 15") | Ein Prozentring, der morgens bei 0 % steht, sagt dem Agenten nur, dass er noch nichts geschafft hat. |
| Benchmark-Block („Beste Wochenleistung im Team", „Dein bester Tag") | Wirkte wie ein Aushang, motivierte nachweislich niemanden. |
| Aktivitäts-Feed („Ein Kollege aus dem Vertrieb hat gerade …") | Repetitiv und anonym — ohne Wert. |
| Arbeitsliste „Jetzt dran" samt Anruf-Knöpfen | Gearbeitet wird in der Kartei, nicht auf der Startseite. |
| „Meine Abschlüsse", Partner-Teaser, Wunschgehalt-Rechner | Stehen unverändert auf `/agent/verdienst` bzw. `/agent/partner-programm`. |
| Schwebender Zweit-Knopf „Nächste Akte" (mobil) | Er entfällt jetzt auch auf der Startseite, nicht nur in der Kartei — genau **eine** Primäraktion. |

`FeedPanel` (client) und `GoalRing` wurden gelöscht, nicht nur ausgehängt. Der Server-Endpunkt `/agent/feed` bleibt unberührt (keine Logik-Änderung), hat im Portal aber keinen Aufrufer mehr. **„Erste Schritte" wurde nicht gelöscht, sondern nach `/agent/mehr` verschoben** — die Einstiegshilfe für neue Agents darf nicht verschwinden, nur weil die Startseite aufräumt.

### Was bleibt

1. **Begrüßung** — tageszeitabhängig nach **deutscher** Zeit (`Europe/Berlin`, nicht mehr der Uhr des Betrachters): „Guten Morgen, Justin — aktuell warten 786 Kunden auf Betreuung." Menschliche Sprache: Kunden, die auf Betreuung warten, keine „freien Karten". Fällige Rückrufe erscheinen als dezente Zahl **ohne Namen** („3 Rückrufe sind heute fällig — sie stehen in deiner nächsten Akte ganz oben").
2. **Kontostand** — die dominante Zahl der Seite, Ziffern in tabellarischer Breite, zählt hoch (bestehende `LiveCount`-Komponente). Quelle ist `/agent/payouts`, also **dieselbe** wie `/agent/auszahlung` und `/agent/verdienst`. Der Zustand wird ehrlich gezeigt: läuft eine Anforderung, steht das da; fehlen Bankdaten, führt der Weg ins Profil; liegt das Guthaben unter dem Mindestbetrag, steht „Ab 50 € kannst du jederzeit auszahlen — dir fehlen noch X €" **statt** einer Schaltfläche, die scheitern würde.
3. **Die eine Handlung** — „Nächste Akte öffnen", die visuell stärkste Fläche der Seite. Hat der Agent eine Akte offen, heißt sie „Akte fortsetzen" und öffnet über `?akte=aktiv` direkt die laufende Akte. Die Reihenfolge macht weiterhin der Server (Zahlung angekündigt → fällige Rückrufe → offene Anträge → Leads).

### Design: Tiefe statt Effektmenge

Drei Elevations-Ebenen (`.agent-aura` → `.agent-raise` → `.agent-cta`): Hintergrund liegt tief, die Kontostand-Karte schwebt, die Primäraktion liegt am höchsten — mehrschichtige weiche Schatten statt harter Linien. Dazu ein sehr langsam wandernder Lichtschimmer (28 s), gestaffelte Einblendung (70 ms Versatz) und ein feiner Lichtreflex auf der Primäraktion beim Berühren. **Animiert werden ausschließlich `transform` und `opacity`** — keine Layout-Eigenschaft, keine 3D-Bibliothek, kein Bild, kein Video.

### Gemessen, nicht behauptet

Neues Werkzeug `scripts/startseite-tempo.mjs` (Playwright, **4-fache CPU-Bremse** = Mittelklasse-Gerät, API im Browser abgefangen, 60 s Gesamtabbruch):

| Messpunkt | Ergebnis |
|---|---|
| Bildrate beim Laden | **83–91 Bilder/s** über vier Läufe (Ziel ≥ 50) |
| Bildrate beim Scrollen | **120 Bilder/s** |
| 380 px: Begrüßung + Kontostand + Primäraktion ohne Scrollen | unterste Kante bei **598 px** von 780 px — inklusive Update-Banner |
| Primäraktion als Touch-Ziel | **96 px** hoch |
| Primäraktionen auf der Seite | **1** · schwebende Zweit-Knöpfe: **0** |
| `prefers-reduced-motion` | Schimmer `none`, keine Einblendung, kein Eindrücken — Seite voll nutzbar |
| Desktop 1280 px | unterste Kante bei **611 px** von 900 px |

Ausführen: `npx vite build && npx vite preview --port 4173`, dann `node scripts/startseite-tempo.mjs`.

**Bundle (Produktions-Build, vorher → nachher):** Haupt-Chunk **1.618,19 kB → 1.607,44 kB** (gzip **421,26 → 418,35 kB**), CSS **254,65 → 255,99 kB** (+1,34 kB für die drei neuen Klassen, die Ziel-Ring-Regel ist entfallen). Netto **−9,4 kB** ausgeliefertes Gewicht — der neue Agenten-Changelog-Eintrag ist darin schon enthalten. Die Startseite ruft jetzt 4 Endpunkte statt 7 auf.

**Prüfungen:** `kartei-verify.ts` **6/6** (frei = 786 — dieselbe Zahl, die die Begrüßung nennt) · `event-inventar.ts --check` **25/25** · `startseite-tempo.mjs` **8/8**.

### Tagesziele: ganz entfernt (Entscheidung des Betreibers)

Mit den Ziel-Ringen ist auch die Einstellung dahinter weg — eine Zahl, die niemand mehr sieht, ist kein Steuerungsmittel, sondern Ballast:

- **Admin:** Der Abschnitt „Tagesziele (Ziel-Ring im Dashboard)" auf `/admin/agent-portal` ist entfernt, ebenso die Erwähnung in Seitenkopf, Hilfetext, Seitenmenü und Hub-Kachel.
- **Server:** `GET /admin/agent-daily-goals` und `PATCH /admin/agents/:id/daily-goals` sind gelöscht. `GET /agent/dashboard` liefert `dailyGoalCents`, `dailyContactsGoal` und `todayContacts` nicht mehr — die dafür nötige Abfrage auf `fiaon_contact_log` entfällt, das Dashboard braucht jetzt **eine Datenbank-Abfrage weniger**. Die Konstanten `DEFAULT_DAILY_GOAL_CENTS` / `DEFAULT_DAILY_CONTACTS` sind weg.
- **Schema:** Der Bootstrap legt `daily_goal_cents` / `daily_contacts_goal` nicht mehr an. Monatsziel (`monthly_goal_cents`) und Provisionssatz bleiben unangetastet — sie sind weiterhin im Team-Bereich pflegbar und werden weiterhin angezeigt.

**Nicht automatisch ausgeführt:** In Bestandsdatenbanken stehen die beiden Spalten noch. Das Löschen von Spalten ist unumkehrbar und gehört in die Hand des Betreibers:

```sql
ALTER TABLE fiaon_agents
  DROP COLUMN IF EXISTS daily_goal_cents,
  DROP COLUMN IF EXISTS daily_contacts_goal;
```

Ohne diesen Schritt funktioniert alles unverändert — die Spalten werden nur von niemandem mehr gelesen oder geschrieben.

---

## 27.07.2026 — Akten-Fluss: Die Akte gab nicht frei (Teil A/B/C)

### Teil A — Der Bug, mit echten Daten belegt

Neues Werkzeug `scripts/akte-blockade.ts` (10 s je Abfrage, 60 s Gesamtabbruch, Laufzeit 4,3 s). Es hat **drei** Fehler gefunden, nicht einen:

**1. Der Kunden-Pfad hat die Akte nie freigegeben.** In `/agent/leads/:id/contact-result` stand seit jeher `opened_at = NULL`. In `/agent/customers/:ref/contact-result` fehlte genau diese Zeile. Die Kartei umfasst aber **beide** Kartenarten — nach jedem Kunden-Kontakt hing der Agent fest, obwohl das Ergebnis sauber im Verlauf stand. Belegt an `FIAON-MS245V2U-XJVT`: zwei Ergebnisse um 21:32 und 21:34, Akte um 21:34 weiterhin aktiv.

**2. Aussortieren gab die Akte ebenfalls nicht frei.** Derselbe fehlende Satz in `/agent/customers/:ref/dismiss`. Ein aussortierter Kunde blieb als „aktive Akte" stehen.

**3. Zwei Akten waren dauerhaft blockiert, ohne dass es sie noch gab.** `FIAON-MS245V2U-XJVT` (aussortiert **und** bezahlt) und Lead 2373 (Status „konvertiert", blockiert seit dem 23.07.). Solche Datensätze können gar keine offene Karte mehr sein — es gab also nichts mehr, was der Agent hätte schließen können.

**Behoben:**

- Kunden-Kontakt-Ergebnis und Aussortieren schließen die Akte. Nur `opened_at` wird genullt — die **Zuweisung bleibt**, Beziehung und Provisionsanspruch sind unberührt.
- Neu: `/agent/customers/:ref/close-akte` („ohne Ergebnis schließen", Begründung Pflicht) — gab es bisher nur für Leads.
- Neu: `/admin/customers/:ref/release-akte` — der Admin-Notausgang fehlte auf der Kundenseite komplett.
- **Sicherheitsnetz** `freigabeUnmoeglicheAkten()`: Bei jedem Kartei-Aufruf werden aktive Akten freigegeben, deren Datensatz keine offene Karte mehr sein kann. Kein Datenzustand blockiert einen Agenten dauerhaft.
- `activeCardOf` filtert jetzt ebenfalls `dismissed_at` und `converted_order_id` — die Abfrage kannte diese Fälle nicht und meldete sie weiter als aktive Akte.

**Fließband:** Nach dem Abschließen erscheint direkt **„Nächste Akte öffnen"**. Dokumentieren, weiter, nächste.

### Teil B — Kontakt-Ergebnis in zwei Ebenen

Sieben gleichwertige Knöpfe waren eine Wand, bei der jede Option gleich wichtig aussah. Tatsächlich gibt es nur **eine** erste Frage: erreicht oder nicht?

Ebene 1: zwei große Schaltflächen. Ebene 2: die passenden Feinheiten — auf dem Desktop aufklappend, auf dem Handy als Bottom-Sheet mit Griff, „Zurück" und Tippfläche außerhalb.

**Die Ergebnis-Codes sind unverändert.** `erreicht_zahlt_gleich`, `nicht_erreicht`, `nummer_falsch` und alle anderen hängen an der Provisionslogik und an der Event-Registry — dies ist ein reiner Oberflächen-Umbau. Lead und Kunde bekommen unterschiedliche Zuordnungen, weil ein Lead ohne Antrag nichts zahlen kann.

Jede Option, die eine E-Mail auslöst, sagt das **vor** dem Bestätigen im Klartext. Der bestehende Bestätigungsdialog bleibt der letzte Schritt.

**Eine bewusste Entscheidung:** „Braucht die Zahlungsdaten erneut" versendet **nur** die Mail und dokumentiert **kein** Kontakt-Ergebnis. Damit entsteht daraus kein Provisionsanspruch und die Akte bleibt offen — der Agent dokumentiert anschließend, wie das Gespräch wirklich ausging. Die ehrlichere von drei möglichen Varianten, dafür ein Schritt mehr.

### Teil C — „Zahlung angekündigt" ganz nach oben

Eine **harte Vorrangstufe** vor dem Score, keine weitere Gewichtung: Zahlung angekündigt → fälliger Rückruf → offener Antrag → Lead. Innerhalb jeder Gruppe gilt die bestehende Gewichtung unverändert, der Wartezeit-Ausgleich bleibt. Abschaltbar über `kartei_vorrang_zahlung`.

**Der Rückruf auf dem 12.07. war kein Eingabefehler.** Gemessen: am 27.07. um 21:34 gespeichert, Termin 12.07. um 21:34 — exakt 15 Tage zurück, die Uhrzeit stimmt auf die Minute mit dem Speicherzeitpunkt überein. Ursache: **Das Datumsfeld hatte keine Untergrenze und der Server hat nicht geprüft.** Ein vergangener Termin wird nie fällig und verschwindet lautlos aus der Wiedervorlage. Jetzt dreifach abgesichert: `min` im Eingabefeld, sichtbare Warnung, Ablehnung am Server (`pruefeTerminZukunft`, 5 Minuten Nachlauf). Gilt für Lead **und** Kunde.

**Prüfungen:** `kartei-verify.ts` **6/6** · `event-inventar.ts --check` **25/25** · Termin-Prüfung 6/6 Fälle.

---

## 27.07.2026 — Zeitlimit 57014: Die Abfrage war falsch herum gebaut

Diesmal **gemessen**, nicht vermutet. Neues Werkzeug `scripts/kartei-tempo.ts` — es kann die Konsole nicht blockieren: 5 s Verbindungsaufbau, 10 s je Abfrage, 60 s Gesamtabbruch. Ein Abbruch ist dort ein *Ergebnis*, kein Fehlschlag.

### Was die Messung ergab

| Befund | Wert |
|---|---|
| Anträge / Leads | 5 364 / 2 771 |
| Vergleiche der alten Dubletten-Prüfung | **14,9 Mio.** |
| Alte Prüfung (`NOT EXISTS` je Zeile) | **über 10 000 ms — Abbruch** |
| Neu als Anti-Join | **2 519 ms** |
| Indizes vorhanden | **10 von 11** — `fiaon_apps_norm_phone_idx` fehlte |

### Warum der Zähler lief und die Liste nicht

Beide benutzen denselben Bauplan. Beim Zähler ist es `COUNT(*)` — Postgres darf die teuren Unterabfragen dann **wegoptimieren**, weil ihre Werte niemand sieht. Die Liste braucht `k.*`, also werden sie für **jede** Zeile ausgeführt. Dazu lief der komplette Bauplan **zweimal**: einmal für die Rangfolge, einmal für den Wartezeit-Ausgleich.

### Die drei Änderungen

**1. Dubletten-Prüfung umgedreht.** Vorher ein `NOT EXISTS` mit Funktionsaufrufen auf *beiden* Seiten — für jeden Lead ein vollständiger Durchlauf durch alle Anträge, jede Rufnummer dabei neu normalisiert. Kein Index kann das retten, weil die Verknüpfung selbst falsch herum stand. Jetzt werden die Vergleichsschlüssel **einmal** gesammelt und der Lead prüft gegen diese fertige Menge.

**2. Kontakt-Verlauf vorab gruppiert.** Drei zusammenhängende Unterabfragen pro Zeile wurden zu zwei gruppierten Zwischenmengen mit `BOOL_OR`/`MAX(...) FILTER`.

**3. Eine statt zwei Abfragen.** Rangfolge und Wartezeit-Ausgleich kommen aus einer Anweisung.

### Vorberechnete Normalisierung — bewusst NICHT automatisch

Auch als Anti-Join bleiben rund 16 000 `regexp_replace`-Aufrufe pro Anfrage. Die richtige Lösung sind gespeicherte, abgeleitete Spalten (`GENERATED ALWAYS AS ... STORED`).

**Ich habe das aus dem Serverstart herausgenommen.** Der Versuch lief im Test selbst in ein Zeitlimit — eine solche Spalte erzwingt eine Tabellenumschreibung mit **exklusiver Sperre**. Automatisch bei jedem Start könnte ein Sperr-Stau sämtliche Abfragen auf `fiaon_applications` hinter sich aufreihen, also die halbe Plattform. Genau diesen Fehler — eine Optimierung in den kritischen Pfad zu legen — habe ich heute schon einmal gemacht.

Stattdessen `scripts/kartei-normspalten.ts --anlegen`: einmalig, mit **5 s Sperr-Zeitlimit** (bekommt es die Sperre nicht sofort, bricht es folgenlos ab), mit Gleichheitsnachweis und `--zurueck`. Der Server **erkennt** die Spalten und schaltet selbstständig um; fehlen sie, rechnet er zur Laufzeit weiter.

### Die Kartei darf nie ganz ausfallen

Läuft die vollständige Abfrage trotzdem ins Zeitlimit, liefert die Kartei jetzt eine einfache Variante — ohne Gewichtung, nur nach Frische — mit sichtbarem Hinweis **„Vereinfachte Ansicht — Sortierung eingeschränkt."** Eine kaputte Sortierung ist ein Schönheitsfehler, eine leere Kartei ist Arbeitsausfall.

### Offen und ehrlich

Der **direkte A/B-Vergleich** alt gegen neu ließ sich nicht abschließen: Die alte Fassung läuft in das 10-Sekunden-Limit, bevor der Vergleich fertig ist. Die Gleichheit ist damit **logisch begründet und durch `kartei-verify.ts` gedeckt, aber nicht Zeile für Zeile bewiesen.** Der Nachweis steckt in `kartei-normspalten.ts` und läuft mit, sobald die Spalten angelegt werden.

Das Ziel **unter 200 ms ist noch nicht erreicht** — der jetzige Stand ist rund 2,5 s statt Abbruch. Die 200 ms kommen mit den vorberechneten Spalten.

**Prüfungen:** `kartei-verify.ts` **6/6** · `event-inventar.ts --check` **25/25**.

---

## 27.07.2026 — Nachtrag: Die Index-Anlage hat die Kartei lahmgelegt (mein Fehler)

**Befund nach dem Deploy:** Die Kartei meldet „Serverfehler", im Kopf steht „Lädt …" statt „FREI: 768". Entscheidend: **Der Zähler lief vorher.** Er fiel also *neu* aus — und das grenzt die Ursache eindeutig auf meine eigene Änderung ein, nicht auf den ursprünglichen Bug.

**Ursache — ein Fehler in meinem letzten Commit.** Alle Kartei-Routen rufen zuerst `ensureKarteiTables()` auf. Dort hatte ich die elf neuen `CREATE INDEX`-Anweisungen mit `await` direkt eingehängt. Schlägt **eine einzige** davon fehl, wirft die Funktion — und reißt die **gesamte** Route mit, Liste wie Zähler. Verschärfend: `ensured` bleibt dann `false`, der Fehlversuch wiederholt sich also bei **jeder** Anfrage.

**Der Denkfehler dahinter:** Ich habe eine reine Optimierung in den kritischen Pfad gelegt. Ein Index beschleunigt, er ist kein Funktionsbestandteil. Er darf unter keinen Umständen den Betrieb anhalten.

**Behoben:**

- Die Indizes laufen jetzt **nach** `ensured = true` und **ohne** `await`, in einer eigenen Funktion. Jeder einzeln abgesichert: Schlägt einer fehl, wird das protokolliert und der nächste versucht. Die Kartei arbeitet weiter — schlimmstenfalls langsamer.
- **Das Zeitlimit im gemeinsamen Pool war mit 30 s zu eng.** Die Einzel-Pools vorher hatten **gar keines** — auch das war eine von mir neu eingebaute Fehlerquelle. Jetzt 90 s, über `DB_STATEMENT_TIMEOUT_MS` einstellbar.
- **„Serverfehler" ist keine Diagnose.** Die Antwort enthält jetzt den SQLSTATE plus einen Klartextsatz („Die Abfrage hat zu lange gedauert", „Die Datenbank nimmt keine weiteren Verbindungen an", „eine erwartete Spalte fehlt"). Die Oberfläche zeigt den Code mit. Keine Kundendaten.
- Fällt **nur** der Zähler aus, während die Liste lädt, wird auch das jetzt gemeldet statt verschluckt.

---

## 27.07.2026 — Kartei lädt wieder, Portal wird schneller, neues Menü (Teil A/B/C)

### Teil A — Der Kartei-Bug: zwei Fehler, nicht einer

**Befund:** Kopf meldet „FREI: 768", Liste darunter „Die Kartei ist gerade leer."

**Erste Ursache — die Abfrage bricht ab.** In `GET /agent/kartei` waren die Platzhalter **fest nummeriert**: `$5` für den Agenten, `$6` für den Suchtext. Beide wurden *immer* mitgeschickt, im Tab „frei" ohne Suche aber im SQL **nie referenziert**. Postgres kann den Datentyp eines nie verwendeten Parameters nicht bestimmen und bricht die gesamte Anweisung ab (`42P18`). Der Zähler in `/agent/kartei/status` lief weiter, weil er **gar keine Parameter** übergibt — daher der Widerspruch. Behoben durch fortlaufende Vergabe der Platzhalter: Es existiert nur noch, was auch benutzt wird.

**Derselbe Fehler in `GET /agent/kartei/meine`:** Dort wurde `$2` (Suchtext) immer mitgeschickt und ohne Suchbegriff nie referenziert. „Meine Kunden" war betroffen — ebenfalls behoben, Anträge und Leads bekommen jetzt getrennte Parameterlisten.

**Zweite Ursache — und die eigentlich gefährliche.** Das Frontend verwarf den Fehler stillschweigend: `if (c.ok) { setCards(...) }` ohne `else`. Schlug der Aufruf fehl, blieb die Liste leer und die Oberfläche meldete „Die Kartei ist gerade leer." **Ein Serverfehler war optisch nicht von einem Normalzustand zu unterscheiden.** Genau deshalb ist wochenlang niemandem aufgefallen, was los war. Ab sofort sind drei Zustände sauber getrennt — **lädt** (Skelett), **leer** (echte Leermeldung), **Fehler** (Klartext, Hinweis „Das ist ein Fehler, kein leerer Bestand" und „Erneut laden"). Gilt für Kartei und Meine Kunden.

### Teil B — Geschwindigkeit

**Indizes (`ensureKarteiTables`, idempotent):** Filter- und Sortierspalten von `fiaon_applications` und `fiaon_leads`, beide Kontakt-Log-Verknüpfungen sowie **Ausdruck-Indizes** auf normalisierte E-Mail und die letzten neun Ziffern der Rufnummer. Letztere sind der Kern: `LEAD_HAS_NO_APP_SIBLING` prüfte für **jeden** Lead per Funktionsausdruck gegen **alle** Anträge — ohne passenden Index ein vollständiger Durchlauf pro Lead. Indizes ändern kein Ergebnis, nur den Weg dorthin; alle Verifikationen bleiben unverändert grün.

**Verbindungen zusammengelegt:** Achtzehn Module hielten je einen eigenen Pool — in Summe **73 mögliche Dauerverbindungen**. Render-Postgres bringt keinen Pooler mit, die Instanzgrenze gilt also unmittelbar. Neu: ein gemeinsamer Pool in `server/lib/db-pool.ts` mit **12** Verbindungen, Leerlauf-Rückgabe nach 30 s und Anweisungs-Zeitlimit. **Ausdrücklich nicht angetastet:** der Nur-Lese-Pool in `server/lib/fiaon-cockpit.ts` — seine Verbindungsoptionen (`default_transaction_read_only`) sind eine Sicherheitsschranke, kein Tuning.

**Bundle:** 28 Admin-Seiten sowie die Antrags- und Kundenstrecken werden per `lazy`/`Suspense` erst beim Aufruf geladen. Gemessen mit `vite build`: **619 kB gzip → 377 kB gzip, minus 39 %.** Ein Agent lädt den Verwaltungsbereich nicht mehr mit.

### Teil C — Das neue Menü

Die Fußzeilen-Leiste weicht einem seitlichen Ausklapp-Menü. Auslöser oben links **oder** Wisch-Geste von der linken Kante (24 px breit, damit horizontales Wischen in Listen nicht auslöst). Schließen per Wisch nach links, Tipp daneben oder Escape. Gestaffelte Einblendung der Einträge, Ein-/Ausfahren 200–250 ms.

**Bewusst nur `transform` und `opacity` animiert** — beides erledigt der Compositor auf der GPU, kein Neu-Layout. Während das Menü offen ist, wird der Seiten-Scroll gesperrt; das ist nicht nur Fokus, sondern verhindert auch, dass die klebende Kopfzeile verrutscht. `prefers-reduced-motion` schaltet sämtliche Animationen ab.

**Zähler am Auslöser** bündelt Betreiber-Antworten, ungelesene Neuerungen und drohende Rückläufer. **„Nächste Akte" bleibt dauerhaft sichtbar**, auch bei geschlossenem Menü — auf der Kartei-Seite selbst entfällt der Knopf, dort wäre er doppelt.

### Ehrliche Grenzen

Die Endpoint-Laufzeiten **vorher/nachher** und `EXPLAIN ANALYZE` (B1/B2) konnte ich nicht messen — die Messläufe wurden abgebrochen, wir haben uns auf direktes Umsetzen verständigt. Die Wirkung der Indizes ist damit begründet, aber **nicht von mir gemessen**. Die Bundle-Zahlen dagegen sind echt gemessen. Gleiches gilt für die Bildrate des Menüs: Die Umsetzung vermeidet Layout-Arbeit konsequent, ein Messwert auf einem Mittelklasse-Gerät liegt aber nicht vor.

**Prüfungen:** `kartei-verify.ts` **6/6 grün** · `event-inventar.ts --check` **25/25 Versandpunkte erhalten**.

**Zu finden:** `server/routes/fiaon-kartei.ts` · `server/lib/db-pool.ts` · `client/src/pages/agent/kartei.tsx` · `client/src/pages/agent/meine-kunden.tsx` · `client/src/pages/agent/shared.tsx` · `client/src/App.tsx` · `client/src/index.css`

---

## 27.07.2026 — Migration ausgeführt + Wunschgehalt-Rechnung korrigiert (Prompt 2/2 Teil A–C)

**Migration ausgeführt:** **2.056 Akten** in die offene Kartei überführt, Stapel `mig-2026-07-27-66a3e2`. Rückabwicklung jederzeit über `npx tsx scripts/kartei-migration.ts --undo=mig-2026-07-27-66a3e2`.

**Vorher behobener Blocker — die Migration war faktisch unumkehrbar:** Die Audit-Einträge wurden mit `JSON.stringify()` in eine `jsonb`-Spalte geschrieben und landeten dadurch als doppelt kodierter JSON-*String* statt als Objekt. Die Undo-Abfrage `meta->>'batch_id'` fand darauf **null Einträge**. Ein Rückwärtsgang hätte gemeldet „0 Akten wiederhergestellt" und die Zuordnung von 2.056 Akten wäre unwiederbringlich verloren gewesen. Behoben durch `sql.json()` beim Schreiben; die Undo-Abfrage liest zusätzlich die alte Schreibweise mit, damit auch Altbestände umkehrbar bleiben. Geprüft in `scripts/kartei-audit-check.ts`.

**Zwei Abweichungen im Betreuungs-Vergleich — untersucht statt blind zurückgerollt:** Eine Bestellung wanderte von „betreut" zu „abgeschlossen" (Summe je Agent unverändert), die Nachfass-Menge *stieg* um 1. Ursache: Während der 25 Minuten Laufzeit haben zwei echte Kunden bezahlt, eine Bestellung lief ab, zwei neue Leads kamen herein. Die Migration setzt ausschließlich `assigned_agent_id` auf `NULL` und fasst weder `payment_status` noch neue Leads an. `scripts/kartei-nachpruefung.ts` belegt: **keine Akte mit dokumentiertem Kontakt und nichts Bezahltes freigegeben, 2.056/2.056 rückabwickelbar.** Ein `--undo` wäre hier der größere Schaden gewesen.

**Wunschgehalt: „Noch 2.812 Abschlüsse" — Ursache gefunden (Teil A).** Zwei getrennte Fehler in `server/routes/fiaon-agent-portal.ts`:

1. **Ø-Abschlusswert ab dem allerersten Abschluss.** Ein einzelnes Starter-Paket zu 7,99 € galt als „Durchschnitt", ergab 1,60 € Provision — daraus die vierstellige Zahl. Jetzt zählt der eigene Schnitt erst **ab fünf** eigenen Abschlüssen, davor der **Team-Durchschnitt der letzten 90 Tage**; die dünne Datenlage wird im Hinweis ausdrücklich benannt.
2. **Zähler und Liste maßen Verschiedenes.** `monthDeals` zählte nur echte Abschlüsse des Monats, die Liste zeigte *alle* Provisionsarten *ohne* Monatsfilter — daher „1 im Juli" über zwei Einträgen. Boni stehen jetzt in einem eigenen Abschnitt „Boni und Gutschriften · zählen nicht als Abschluss".

**Plausibilitätsgrenze statt Fantasiezahl:** Übersteigt das nötige Tagespensum die **beste tatsächliche Tagesleistung im Team der letzten 90 Tage**, wird die Zahl nicht mehr angezeigt. Stattdessen sagt das Portal ehrlich, dass das Ziel diesen Monat nicht erreichbar ist, und schlägt ein aus echten Daten errechnetes Zwischenziel zum Übernehmen vor. Boni fließen nie in den Ø-Abschlusswert.

**„Mein Tag": eine Handlung statt einer Zahlenwand (Teil B).** Ganz oben steht jetzt die eine wichtigste Handlung mit einer großen Schaltfläche, priorisiert nach *fällige Rückrufe → offene Akte → freie Karten → nichts offen*. Auf 380 px ohne Scrollen erreichbar. Der Verdienst rückt darunter. Feed-Zeiten in Menschensprache („vor 12 Minuten", „gestern 14:20") statt roher Zeitstempel.

**Updates-Seite nachgetragen (Teil C).** Die größte Änderung der täglichen Arbeit seit dem Start stand nicht auf `/agent/updates`. Ergänzt: Kartei · Meine Kunden · Popups vor E-Mail-Versand · Wunschgehalt-Korrektur · Auszahlungs-Schwellen · Kalender. Neu ist `important` — als wichtig markierte Einträge erscheinen beim nächsten Login **einmalig** als kurzer Hinweis und danach nie wieder; bewusst nur zwei davon.

**Neue Regel `SYSTEM_DIAGNOSE.md` (0.12):** Jede im Agent-Portal sichtbare Änderung bekommt im **selben Commit** einen Eintrag in `updates-data.ts` — sonst gilt der Commit als unfertig.

**Prüfungen:** `kartei-verify.ts` alle sechs Zusagen grün · `event-inventar.ts --check` **25/25 Versandpunkte erhalten** · `kartei-nachpruefung.ts` N1–N4 grün.

**Zu finden:** `server/routes/fiaon-agent-portal.ts` · `client/src/pages/agent.tsx` · `client/src/pages/agent/motivation.tsx` · `client/src/pages/agent/shared.tsx` · `client/src/pages/agent/updates-data.ts` · `scripts/kartei-migration.ts` · `scripts/kartei-nachpruefung.ts` · `SYSTEM_DIAGNOSE.md` (0.12)

---

## 27.07.2026 — Kartei-Oberfläche + Popups bei jeder Aktion (Prompt 1/2 Teil 2, Prompt 2/2)

**Warum:** Der Serverteil der offenen Kartei stand, aber die Agenten hatten keine Oberfläche dafür. Gleichzeitig löste ein Teil der Aktionen — darunter zwei, die echte Kunden-E-Mails verschicken — ohne jede Rückfrage aus.

**Neue Oberfläche `/agent/kartei` (`client/src/pages/agent/kartei.tsx`):** Kopfkarte mit persönlicher Begrüßung und dem, was heute ansteht (freie Karten, eigene Akten, aktive Akte, Rückläufer-Vorwarnung). Drei Tabs **Frei · Meine Akten · Alle**. Freie Karten wirken sichtbar verschlossen (Schloss-Symbol, verschleierte Datenzeilen, Hinweis „Name und Nummer erscheinen nach der Übernahme"); vergebene Karten stehen dezent abgesetzt mit **„In Bearbeitung bei [Agent]"** — damit ist ein Doppelanruf ausgeschlossen (Ticket #21). Sichtbar sind nur neutrale Merkmale: Status, Alter, Paket, offener Betrag, Quelle/Kampagne, PLZ-Gebiet. Ein Tap öffnet die **Doppelbestätigung** („Mit der Annahme übernimmst du diese Kundenakte …"), danach folgt eine kurze Freischalt-Animation und die vollständige Akte. Hat der Agent bereits eine Akte in Bearbeitung, sind freie Karten sichtbar gesperrt statt stumm zu scheitern.

**Neue Oberfläche `/agent/meine-kunden` (`client/src/pages/agent/meine-kunden.tsx`):** Alles, was der Agent je übernommen hat — filterbar nach Offen · Angekündigt · Bezahlt · Rückruf · Abgelaufen · Tot, mit Suche über die vollen Daten. **Nichts verschwindet:** Zusammengeführte und ersetzte Akten bleiben sichtbar und sagen im Klartext, wohin die Betreuung gewandert ist („Wurde mit FIAON-… zusammengeführt — dort läuft die Betreuung weiter"). Genau das war der wiederkehrende „mein Kunde ist weg"-Fall.

**Navigation umgestellt:** „Kunden" und „Leads" heißen jetzt **„Kartei"** und **„Meine Kunden"**. Die alten Pfade `/agent/leads` und `/agent/kunden` **bleiben als Route erreichbar**, bis die Kartei im Betrieb bestätigt ist — es gibt keinen Zwischenzustand, in dem ein Agent seine Akten nicht findet.

**Admin-Gegenseite `/admin/kartei` (`client/src/pages/admin-kartei.tsx`):** Frei/vergeben/in Bearbeitung, je Agent mit „betreut" gegen „unbearbeitet", Übernahmen und Rückläufer der letzten 30 Tage, die letzten Rückgaben mit Grund. Einstellbar: die vier Gewichtungen, Wartezeit-Ausgleich, Auto-Release-Minuten, Hortungs-Frist und Vorwarnung — über eine eigene, wertgeprüfte Route (`POST /admin/kartei/settings`). Notausgang: jede Akte freigeben oder gezielt zuweisen, beides protokolliert. **Keine Zeit- oder Anwesenheitsüberwachung** — nur Ergebnisse.

**Popup vor jeder Aktion (Prompt 2 A):** Die bestehende `ConfirmDialog`-Komponente wurde konsequent ausgerollt statt neu gebaut. **Neu abgedeckt:** Akte übernehmen · Akte zurückgeben (Begründung Pflicht) · **Zahlungsdaten-Mail senden** · **Antrags-/Zahlungslink senden** · Aussortieren bei Kunde und Lead (vorher Inline-Panel) · Auszahlung anfordern (vorher `window.confirm`). Jede Aktion, die eine E-Mail auslöst, **nennt Empfänger und Wirkung im Dialog** — z. B. „Es geht sofort eine E-Mail an … mit Betrag, Verwendungszweck und Bankverbindung. Danach ist die Aktion für 10 Minuten gesperrt." Nach der Aktion kommt eine klare Rückmeldung („✓ E-Mail wurde versendet — …"). Die vollständige Abdeckungstabelle steht in `SYSTEM_DIAGNOSE.md` (0.11).

**Ehrliche Abweichung:** „Nachfass senden" war in der Popup-Liste, existiert im Agent-Portal aber nicht und wurde **nicht neu gebaut** — der Nachfass läuft ausschließlich über Engine und Admin. Ein neuer Agenten-Knopf hätte einen zusätzlichen Versandweg für Kundenmails geschaffen, was der Regel „keine neue Massenaktion" widerspricht.

**Mobil-first:** Alle Touch-Ziele ≥ 44 px, Dialoge auf dem Handy als Bottom-Sheet, Karten statt Scroll-Tabellen, Filter horizontal wischbar. Animationen 150–250 ms und über `prefers-reduced-motion` abschaltbar (die Freischalt-Animation entfällt dann und die Akte öffnet direkt).

**Keine Geschäftslogik geändert:** Die Popups rufen exakt dieselben Endpoints wie vorher. `npx tsx scripts/event-inventar.ts --check` meldet weiterhin **25/25 Versandpunkte erhalten**; `npx tsx scripts/kartei-verify.ts` bestätigt alle sechs Kartei-Zusagen.

**Migration weiterhin NICHT ausgeführt** — Reihenfolge wie vereinbart: Oberfläche → Deploy → Betreiber testet → Team informieren → dann `--write`.

**Zu finden:** `client/src/pages/agent/kartei.tsx` · `client/src/pages/agent/meine-kunden.tsx` · `client/src/pages/admin-kartei.tsx` · `client/src/pages/agent/kunden.tsx` · `client/src/pages/agent/leads.tsx` · `client/src/pages/agent/auszahlung.tsx` · `SYSTEM_DIAGNOSE.md` (0.11)

---

## 27.07.2026 — Die offene Kunden-Kartei (Prompt 1/2, Serverteil)

**Warum:** Leads und Kunden lagen in per-Agent-Silos, gefüllt von einer Rotationsverteilung, die zuteilte, ohne dass jemand arbeitete. Messung vor dem Umbau: **von 2.502 zugewiesenen Akten hatten 2.054 (82 %) nie einen dokumentierten Kontakt** — sie blockierten, während zwei neue Agenten leer liefen. Gleichzeitig empfanden Agenten Kunden als „verschwunden", obwohl die Datensätze existierten. Beides löst die gemeinsame, offene Kartei.

**Phase 0 (vor jeder Änderung, in `SYSTEM_DIAGNOSE.md`, Abschnitt „OFFENE KUNDEN-KARTEI"):**
- **Event-Inventur** aller 25 Make/Brevo-Versandpunkte (18 Event-Typen) — maschinell erzeugt über `scripts/event-inventar.ts`, inklusive der Ketten über Hilfsfunktionen (z. B. „Nummer falsch" → `number_update_request`). Baseline in `docs/event-inventar.baseline.json`.
- **15 Pfade geprüft**, auf denen eine Zuweisung verschwinden kann. Ergebnis: real verloren geht sie nur über Admin-Entzug und **Round-Robin**; das Gefühl „mein Kunde ist weg" entsteht über Merge, Bezahlung und Supersede — der Datensatz lebt, fällt aber aus der einen Liste, die der Agent kennt.
- **Bestandsaufnahme je Agent**, Dubletten-Risiko (247 E-Mail- + 52 Telefon-Überschneidungen zwischen offenen Leads und Anträgen) und Onboarding-Status.

**A — Die Kartei (`server/routes/fiaon-kartei.ts`, neu):** Ein gemeinsamer Bestand aus Leads **und** Kunden. **Eine Person = eine Karte** — die Gruppierung ist exakt die der zentralen Kundenakte (E-Mail bzw. letzte 9 Telefonziffern), ein Lead erzeugt nur dann eine Karte, wenn es keinen Antrag derselben Person gibt. Drei Zustände: **frei**, **vergeben** („in Bearbeitung bei [Agent]", verhindert Doppelanrufe/Ticket #21) und **nicht mehr verfügbar** (bezahlt, storniert, aussortiert, gemergt — verlässt die Kartei sofort; die Direktzahler-Regel bleibt damit intakt).

**Kontaktdaten sind serverseitig maskiert, nicht im Frontend versteckt:** Die Kartei-Abfrage selektiert Name, Telefon, E-Mail und Adresse gar nicht erst; die Antwort wird als neues Objekt gebaut. Nachgewiesen durch `scripts/kartei-verify.ts` (V1 prüft die *echte* Abfrage, nicht eine Kopie): 21 gelieferte Spalten, alle neutral.

**B/C — Übernahme und eine aktive Akte:** Übernahme läuft atomar über `FOR UPDATE SKIP LOCKED` — klicken zwei Agenten dieselbe Karte, bekommt sie genau einer, der andere eine freundliche Meldung. **Eine** Akte gleichzeitig in aktiver Bearbeitung, die nächste sofort nach dokumentiertem Ergebnis; **kein Limit** für die Gesamtzahl. Auto-Release nach 30 Min. ohne Ergebnis (einstellbar) beendet nur die *Bearbeitung* — die Zuweisung bleibt, der Agent verliert nichts.

**D — „Meine Kunden":** Zeigt **jede** je übernommene Akte, auch bezahlt, abgelaufen, storniert — und macht gemergte/ersetzte Akten **mit Verweis auf den Gewinner-Datensatz** sichtbar. Genau das war das wiederkehrende „Kunde verschwunden"-Problem.

**E — Hortungs-Schutz:** Übernommene, nie bearbeitete Akten gehen nach 7 Tagen (einstellbar) zurück in die freie Kartei, mit Vorwarnung im Portal. Akten **mit** dokumentierter Betreuung bleiben immer beim Agenten — Beziehung und Provisionsanspruch geschützt.

**F — Rangfolge:** Serverseitig sortiert (Umsatzpotenzial, Reaktionssignal, Frische, Kontakthistorie), Gewichte im Admin einstellbar, plus Wartezeit-Ausgleich (jeder 4. Platz aus dem ältesten Bestand). Der Score wird bewusst **nicht** ausgeliefert. **Round-Robin ist abgeschaltet** (`distributeUnassignedLeads` ist eine No-Op; alle Aufrufer laufen unverändert weiter). Facebook-Leads laufen durch dasselbe System: Intake → Kartei → Übernahme.

**G — Migration (`scripts/kartei-migration.ts`, NOCH NICHT AUSGEFÜHRT):** Standard ist Dry-Run. Vorschau: Daniel 1.318 → **526 eigene / 792 zurück**, Florentine 1.279 → **206 / 1.073**, Lucas 97 → 6 / 91, Nikita 117 → 19 / 98; gesamt **2.056 Akten** in die offene Kartei. Nichts wird gelöscht, jede Änderung trägt eine Stapel-Kennung und ist über `--undo=<stapel>` vollständig umkehrbar. **Ausführung erst nach ausdrücklichem „Start" des Betreibers.**

**H — Admin:** `GET /admin/kartei` liefert frei/vergeben/je Agent, Rückläufer und die Ergebnis-Kennzahlen der letzten 30 Tage; `POST /admin/kartei/:id/release` und `/assign` sind der protokollierte Notausgang. **Bewusst keine Zeit- oder Anwesenheitsüberwachung** — nur Ergebnisse (Scheinselbstständigkeit/DSGVO, Phase 4).

**E-Mail-Kette unangetastet:** Kein einziger `sendMakeWebhook`-Aufruf wurde verschoben, umgeschrieben oder entfernt — `npx tsx scripts/event-inventar.ts --check` meldet **25/25 Versandpunkte erhalten, 0 verloren**. Es entsteht keine neue Massenaktion; Events bleiben pro Einzelaktion.

**Provisionslogik unangetastet:** Die Übernahme wird als Typ `claim` protokolliert und zählt — wie bisher — **nicht** als dokumentierte Betreuung. Damit bleibt die Phase-2-Regel (Anspruch nur bei dokumentiertem Kontakt vor Zahlung), der Stichtag und die Direktzahler-Regel unverändert.

**Onboarding-Gate:** Die Kartei hängt hinter dem bestehenden `customerDataGate` — ohne Zustimmung **und** signierten Vertrag gibt es keinen Kartei-Zugriff. Betrifft aktuell Herbert Schöttl.

**Zu finden:** `server/routes/fiaon-kartei.ts` · `scripts/event-inventar.ts` · `scripts/kartei-phase0.ts` · `scripts/kartei-verify.ts` · `scripts/kartei-migration.ts` · `SYSTEM_DIAGNOSE.md` (Abschnitt „OFFENE KUNDEN-KARTEI")

---

---

## 21.07.2026 — Der FIAON-Fahrplan: Analyse → Coaching → Ziel (Prompt 2/2)

**Warum:** Das Kunden-Dashboard bekommt sein eigentliches Produkt: Der Kunde lädt seine Kontoauszüge hoch, FIAON erstellt eine KI-gestützte Analyse (nur aus anonymen, aggregierten Kennzahlen) und daraus einen persönlichen, priorisierten **Fahrplan** zur Verbesserung von Finanzen und Scoring. Das sichtbare **Ziel** ist eine Kreditkarte über einen **lizenzierten Partner** — durchgängig als **erarbeitetes Zukunftsziel** dargestellt (Freischaltung ab 01.10.2026 in DE/AT/CH geplant), nie als Zusage. Jede Kundenfunktion hat eine **Admin-Gegenseite**.

**Phase 0 (dokumentiert):** In `SYSTEM_DIAGNOSE.md` neuer Abschnitt **„FAHRPLAN-PRODUKT — Modell & Bestand"**: Kunden-Zustände heute, bestehender Upload (unverschlüsselte BYTEA in `fiaon_applications`), verfügbare KI-Keys (`OPENAI_API_KEY` in der Umgebung liefert aktuell **HTTP 401 — ungültig**; Empfehlung `gpt-4o` beste / `gpt-4o-mini` günstig-ausreichend), sowie die Feature-Map mit je einer Admin-Gegenseite.

**A — Kunden-Journey (`client/src/components/roadmap/RoadmapJourney.tsx`, eingebunden als neuer Bereich „Fahrplan" in `dashboard.tsx`):** Sichtbare **Etappen-Reise** (Willkommen → Upload → KI-Analyse → Fahrplan → Fortschritt/Coaching → Ziel) mit Zustand je Etappe (**erledigt/aktiv/gesperrt**), High-End-CI (Slate/Blau, Tiefe, Glas-/Shimmer-Effekte, `prefers-reduced-motion` respektiert). Die **Ziel-Karte** edel als „freischaltbare" Belohnung mit Lock-Overlay und Kriterien-Fortschritt.

**B — Kontoauszug-Upload (Sicherheit zuerst):** **Consent-Gate** vor dem ersten Upload (protokolliert mit Version, Zeit, IP in `fiaon_consents`). Speicherung **AES-256-GCM-verschlüsselt at rest** in `fiaon_statements` (`server/lib/roadmap-crypto.ts`); Key aus `STATEMENT_ENC_KEY` (Fallback deterministisch abgeleitet). PDF/Bild, mehrere Dateien, klare Fehlertexte, mobil-first. **Löschrecht** (`/roadmap/:ref/delete-statements`).

**C — KI-Analyse (`server/lib/roadmap-ai.ts`):** Der Server berechnet serverseitig **aggregierte, anonyme Kennzahlen** (Einnahmen/Ausgaben-Kategorien, Fixkosten, Spar-/Schuldenquote, Auffälligkeiten) — **nur diese** gehen an die KI, **keine** Namen/IBANs/Einzelbuchungen (im Server-Log als `Sending ONLY aggregated metrics` nachweisbar; der exakte Payload wird in `fiaon_analysis.metrics_sent` gespeichert). Fehlerfall sauber abgefangen: fällt automatisch auf eine **hochwertige regelbasierte Analyse** zurück. Alles als **Bildungsinhalt** gekennzeichnet.

**D — Fahrplan:** Priorisierte, umsetzbare Schritte (`fiaon_roadmap_steps`) mit Erklärung, Nutzen, optionalem Zielwert und „erledigt"-Markierung; Fortschritt bleibt bei Neu-Analyse erhalten.

**E — KI-Login-Begrüßung:** `/roadmap/:ref/greeting` erzeugt aus aggregierten Signalen (nächste Zahlung/Frist, nächster offener Schritt, Fortschritt) eine motivierende Nachricht — eingebettet ins Begrüßungs-Popup aus Prompt 1 (`WelcomeModal` erweitert um `coaching`).

**F — Admin-Gegenseite (`client/src/pages/admin-fahrplan.tsx`, Route `/admin/fahrplan`, in AdminShell-Nav):** Upload-Review (entschlüsseltes Ansehen **auditiert**), Analyse anstoßen/prüfen/**freigeben** (QS: KI schlägt vor, Mensch gibt frei — per Einstellung auch Auto-Freigabe), Ziel-Freischaltung/Kriterien, versionierter Coaching-Text, **Audit** über alle sensiblen Zugriffe (`fiaon_roadmap_audit`).

**Server:** neue Route `server/routes/fiaon-roadmap.ts` (registriert in `server/routes.ts`), Admin-Endpoints via `requireAdmin`; Tabellen werden automatisch angelegt.

**Aktion Betreiber:** gültigen `OPENAI_API_KEY` hinterlegen (aktueller Key = 401); optional dedizierten `STATEMENT_ENC_KEY` (`openssl rand -hex 32`) setzen — beides in `.env.example` dokumentiert.

**Regeln eingehalten:** Karte immer als erarbeitetes Ziel; keine Rohdaten an die KI (nur Aggregate, im Log belegt); Consent + Verschlüsselung + Löschkonzept vor Upload; Empfehlungen als Bildungsinhalt gekennzeichnet; jede Kundenfunktion mit Admin-Gegenseite + Audit; mobil + Desktop; Berlin-Zeit; keine Heredocs; Changelog im selben Commit; Live-Server bereitgestellt.

---

## 21.07.2026 — Kunden-Dashboard: Compliance-Bereinigung + Begrüßungs-Popup (Prompt 1/2)

**Warum:** FIAON ist laut Markenprofil und Agentenvertrag ausdrücklich **kein Finanzdienstleister, keine Bank, keine Kreditvermittlung**, sondern eine Finanzbildungs- und Software-Plattform. Das Kunden-Dashboard erweckte durch „Banking"-Badge, „Kreditlimit", Mastercard-Logo und eine Kartennummer-Anmutung („•••• 4242") aber genau diesen Eindruck. Das wurde entfernt — das hochwertige, vertrauenswürdige Gefühl bleibt, die regulierten **Begriffe und Symbole** sind weg. Zusätzlich gibt es jetzt eine freundliche, zustandsabhängige Begrüßung beim Login.

**Phase 0 — Logik zuerst dokumentiert:** In `SYSTEM_DIAGNOSE.md` (neuer Abschnitt **„KUNDEN-DASHBOARD — Logik verstehen"**) ist in einfacher Sprache erklärt: welche Datei `/dashboard` rendert, woher jede der vier Kacheln + die Karte ihre Daten zieht, woher das „Limit" kommt (echtes Feld `approved_limit` vs. Paket-Ableitung `effectiveLimit` — Bezug Ticket #20), was echte Logik vs. Fassade ist, welche Zustände der Kunde sieht und welche Funktionen eine **Admin-Gegenseite** brauchen (Basis für Prompt 2). **Keine Geschäftslogik geändert** — nur Darstellung/Sprache/Begrüßung.

**A — Compliance-Bereinigung (`client/src/pages/dashboard.tsx`):**
- „BANKING"-Badge neben dem Logo → **„MITGLIEDSBEREICH"**.
- „Willkommen in deinem FIAON Banking-Portal" → **„…FIAON-Bereich"**.
- **Mastercard-Logo entfernt**, **Kartennummer-Anmutung „•••• 4242" entfernt**; die Karte bleibt als edle **Mitgliedskarte** (ohne Zahlungsnetzwerk-Symbolik).
- „Kreditlimit" → durchgängig **„Paket-Rahmen"** (Kachel, Karte, Modal, Konto-Übersicht, FAQ) — Wortwahl mit dem Betreiber abgestimmt.
- „Kontoaktivierung" → **„Freischaltung deines Zugangs"**; „Kontostatus" → „Zugangsstatus"; „Konto aktiviert" → „Zugang freigeschaltet".
- „Kreditantrag" → „Antrag"; „Kreditkartenvertrag" → **„Mitgliedsvertrag"**; „FIAON Bonitäts-Auskunft" → „FIAON SCHUFA-Auskunft"; Formular-Hinweis „§ 18a KWG / Kreditwürdigkeitsprüfung" → neutral „Haushaltsübersicht"; „Bonität … verifiziert" → „Angaben geprüft".

**B — Kontextabhängiges Begrüßungs-Popup:** Beim Login erscheint ein hochwertiges, zentriertes Willkommens-Popup im CI (mobil als Bottom-Sheet). Vier Zustände: **Erst-Login** (herzlich + Orientierung), **Profil unvollständig** (was fehlt + Handlung), **In Prüfung** (beruhigend), **Aktiv** (kurz & wertschätzend). Wird pro Zustand einmal gezeigt (`localStorage`-Merker mit Versionsschlüssel), jederzeit wieder aufrufbar über den **„?"-Punkt** in der Kopfzeile.

**Wichtig — Onboarding-Tour abschaltbar:** Die **reine Begrüßung ist immer aktiv**; die **Feature-/Orientierungs-Schritte** hängen an einem zentralen Schalter `tourEnabled` in **`client/src/config/welcome.ts`** und sind **standardmäßig AUS** — sie werden erst „scharf" gestellt, wenn die erklärten Funktionen wirklich existieren. Alle Texte liegen als reine Daten mit `{name}`-Platzhalter zentral in dieser Datei (leicht anpassbar; in Prompt 2 an den Admin/DB anbindbar). `version` erhöhen zeigt das Popup allen Kunden einmalig erneut.

**C — Darstellung:** Aufgeräumtes, hochwertiges Layout im FIAON-CI (Inter, Slate/Blau, viel Weißraum, feine Tiefe), Karte als edle Mitgliedskarte, mobil-first.

**Weitere Fundstellen (nur gelistet, NICHT geändert — Betreiber-Entscheidung nötig):** Die Marketing-/Funnel-Seiten `privatkunden.tsx`, `start.tsx`, `antrag.tsx`, `zahlung.tsx` nutzen „Kreditkarte"/„Banking"/„Kreditlimit" als Produkt-Positionierung; `impressum.tsx`/`agb.tsx`/`cookie-einstellungen.tsx` nutzen „Kredit"-Begriffe bewusst in **rechtlichen Klarstellungen** (dort korrekt). Die Bank-Namen/„Online Banking"-Menüwege in der Kontoauszug-Anleitung verweisen auf die **eigene Bank des Kunden** (für den KYC-Upload notwendig) und bleiben fachlich korrekt.

**Regeln eingehalten:** Phase 0 vor Umbau; keine Bank-/Kredit-/Zahlungsnetzwerk-Begriffe oder -Logos mehr im eingeloggten Kundenbereich; keine echte Geschäftslogik (Zahlungen, Limit-Werte) verändert — Limit-Herkunft nur dokumentiert; Berlin-Zeit; CI-treu; mobil; keine Heredocs; Live-Server bereitgestellt; Changelog im selben Commit.

**Wo:** `client/src/pages/dashboard.tsx` (Sprache/Karte/Popup-Einbindung + „?"-Button), `client/src/components/WelcomeModal.tsx` (neu), `client/src/config/welcome.ts` (neu — zentrale Textbausteine + `tourEnabled`), `SYSTEM_DIAGNOSE.md` (Abschnitt „KUNDEN-DASHBOARD").

---

## 20.07.2026 — Auszahlungsregelung im Agentenvertrag präzisiert (Clause 6.7) + konfigurierbare Schwellen

**Warum:** Der Vertrag soll klar sagen, wie ausgezahlt wird — ohne dass jemand den Eindruck bekommt, FIAON könnte verdiente Provision einbehalten. Deshalb gibt es jetzt zwei transparente Schwellen, die **nur den Zeitpunkt** der Zahlung regeln, nie den Anspruch: einen **Mindestbetrag** für die Selbst-Auszahlung und eine **Obergrenze**, ab der FIAON den Überschuss von sich aus auszahlt.

**A — Neue Klausel 6.7 „Payment of accrued Commission":** In derselben formellen englischen Rechtssprache wie der übrige Vertrag ergänzt. Kernaussage: Der Agent kann ab dem **Minimum Payout Threshold** jederzeit selbst auszahlen; übersteigt das Guthaben die **Maximum Retained Balance**, zahlt FIAON den Überschuss ohne Anforderung aus. Ausdrücklich klargestellt: Die Schwellen sind reine Timing-Regeln und schmälern den Provisionsanspruch nicht.

**B — Konfigurierbare Variablen:** `[[MIN_PAYOUT_THRESHOLD]]` (Default **50 €**) und `[[MAX_RETAINED_BALANCE]]` (Default **1.000 €**, frei änderbar) fließen aus den globalen Einstellungen in Vertrags-Vorschau und PDF. Pflegbar unter **Team → Einstellungen** (neues Feld „Obergrenze Guthaben"); im Variablen-Editor unter `/admin/vertraege` als Klartext-Hinweis sichtbar (wie der Provisionssatz). In die Platzhalter-Legende der Word-Vorlage aufgenommen.

**C — Funktion:** Die **Selbst-Auszahlung** des Agenten nutzt bereits den Mindestbetrag (`payout_min_cents`) — der Vertragswert = der Systemwert (eine Wahrheit). Für die Obergrenze zeigt die **Team-Übersicht** jetzt ein Badge „**Auszahlung fällig — Überschuss X €**", sobald ein Guthaben die Maximum Retained Balance übersteigt. Keine automatische Geldbewegung: Die Auszahlung bleibt ein bestätigter Schritt, die Provisions-Abrechnung wird dabei wie gehabt erzeugt.

**Versionierung:** Vertrags-Standardvorlage auf **v2** angehoben — bestehende Agenten müssen die neue Fassung beim nächsten Login erneut lesen und unterschreiben (Onboarding-Gate greift automatisch). Beide Fassungen (Code-Vertragstext + `commercial_agent_agreement_EN.docx`) enthalten Clause 6.7 **wortgleich**.

**Regeln eingehalten:** kein Eingriff in Provisions-Berechnung/Clawback; Schwellen nur als Timing-Regel formuliert; Berlin-Zeit; mobil; keine Heredocs; Changelog im selben Commit. **Rechtlicher Hinweis:** Klausel vom Betreiber mit Berater final zu prüfen.

**Wo:** `server/routes/fiaon-onboarding-content.ts` (Clause 6.7 + `DEFAULT_CONTRACT_VERSION`), `server/routes/fiaon-onboarding.ts` (Schwellen in `resolveContractVars`, Versions-Seed), `server/routes/fiaon-agent.ts` (`payout_max_retained_cents`-Default), `server/routes/fiaon-team.ts` (Settings-API + Team-Badge-Default); Client `client/src/pages/admin-team.tsx` (Einstellungsfeld + Badge), `client/src/pages/admin-vertraege.tsx` (Hinweis); `docs/vertraege/commercial_agent_agreement_EN.docx` (Clause 6.7 + Legende).

---

## 20.07.2026 — Onboarding-Gate + digitaler Agentenvertrag & Provisions-Abrechnungen (Prompt 1/2 + 2/2)

**Warum:** Kein Agent darf echte Kundendaten sehen, bevor er (1) Datenschutz-, Verhaltens- und Nutzungshinweise bestätigt und (2) seinen Handelsvertretervertrag digital unterschrieben hat. Zusätzlich entsteht bei jeder Auszahlung automatisch eine revisionssichere Provisions-Abrechnung. Alles versioniert, in Berlin-Zeit, mobil vollständig, CI-treu.

**A — Zustimmungs-Gate (Schritt 1):** Beim ersten Login (und für alle Bestehenden beim nächsten Login) erscheint ein nicht wegklickbares, mehrstufiges Onboarding-Overlay (zentriert, mobil als Vollbild-Flow ab 380 px). Drei einzeln zu bestätigende Blöcke mit ausklappbarem Volltext: **Datenschutz & Vertraulichkeit**, **Seriosität/Verhalten & Compliance** (FIAON = Bildung/Software, keine Finanzberatung/Kreditvermittlung, keine Kreditversprechen am Telefon), **Nutzungsbedingungen**. Jede Zustimmung wird protokolliert (Agent-ID, Dokumentversion, Zeitstempel Berlin, IP). **Versioniert** — ändert sich ein Dokument (Version erhöhen), ist erneute Zustimmung nötig.

**B — Vertrags-Gate (Schritt 2):** Direkt nach der Zustimmung liest der Agent seinen vollständig befüllten, englischen **Self-Employed Commercial Agent Agreement** (langform, nummerierte Klauseln, Selbstständigkeits-/Compliance-Anker, Ausgleichsanspruch-Klausel) und unterschreibt digital — **Unterschrift zeichnen** (Finger/Maus) oder getippter Name als Fallback, mit verbindlicher Schlussbestätigung. Erfasst und ins PDF eingebettet: Signaturbild/Name, Zeitstempel (Berlin), IP, Vertragsversion, Dokument-Hash (SHA-256). Erst wenn **beides** erledigt ist, wird der Account frei — vorher sieht der Agent nur den Onboarding-Flow (sauberer Sperr-Zustand mit Erklärung).

**Server-Gate:** eine zentrale Middleware (`customerDataGate`) blockt alle `/agent/*`-Routen mit Kundendaten (Kunden, Leads, Dashboard, Feed, Kalender, Verdienst …) mit `403`, solange das Onboarding nicht abgeschlossen ist — Auth- und Onboarding-Endpoints bleiben erreichbar. Defense-in-depth zusätzlich zum UI-Gate.

**Vertrag konfigurierbar (Admin):** versionierte Vorlagen mit Status **Entwurf/Aktiv** — Signieren nur bei „Aktiv" (Entwurf trägt „DRAFT"-Wasserzeichen in der Vorschau). Pro Agent setzbare Vertragsvariablen (Privatperson/Unternehmen — steuert Textblöcke und Pflichtfelder; Firma/Rechtsform/Register-Nr./USt-ID/Vertretungsberechtigter, Anschrift, Geburts-/Gründungsdatum, Steuer-/USt-ID, Provisionssatz, Auszahlungsmodus, Kündigungsfrist, Governing law & Jurisdiction) mit **Live-Vorschau** des fertigen Vertrags.

**E — Provisions-Abrechnung:** Bei jeder bestätigten Auszahlung (`/admin/payouts/:id/mark-paid`) entsteht automatisch ein **Commission Statement / Gutschrift**-PDF mit fortlaufender Nummer (FIAON-COM-JJJJ-####), FIAON-LTD- und Agent-Block, Positionstabelle (Datum · Referenz · Verkaufsbetrag · Satz · Provision), **Clawbacks als Minusposition mit Grund**, USt-Behandlung je Partner-Typ (Reverse-Charge-Hinweis bei Unternehmen mit USt-ID; anpassbarer Textbaustein — steuerlich vom Betreiber final zu bestätigen), Netto-Auszahlungsbetrag, Zahlungsweg und Dokument-Hash. **Zieht ausschließlich die Werte der bestehenden Commission-Engine + des Auszahlungssatzes** — kein Parallel-Rechenweg.

**PDFs:** serverseitig via **Playwright/Chromium** im FIAON-CI (Wortmarke, saubere Typografie, Fußzeile „FIAON LTD · Company No. 17318250 · 128 City Road, London, EC1V 2NX"). Alles versioniert abgelegt, nichts hart gelöscht.

**F — „Meine Dokumente" (Agent) + Admin-Spiegel:** neue Agent-Seite `/agent/dokumente` (Vertrag inkl. früherer Versionen + Provisions-Abrechnungen chronologisch, als PDF). Admin unter **Team → Onboarding & Verträge** (`/admin/vertraege`): Onboarding-Status pro Agent (Zustimmung ✅/offen, Vertrag ✅/offen, Datum, Version), Vorlagen-Verwaltung, Vertragsvariablen + Vorschau und Download von **Zustimmungsprotokoll**, **signiertem Vertrag** und **Provisions-Abrechnungen** als PDF (Nachweis für LEXR/Prüfung).

**Events:** neue Make-Events `contract_signed` und `commission_statement_issued` (Registry + Betreiber-TODO für Make-Zweig/Brevo-Template).

**G — Word-Vorlage:** `docs/vertraege/commercial_agent_agreement_EN.docx` mit denselben `[[Platzhaltern]]` im Repo, damit der Betreiber sie außerhalb des Systems bearbeiten kann.

**Regeln eingehalten:** keine Änderung an Provisions-/Lead-Geschäftslogik; Berlin-Zeit; mobil vollständig; keine Heredocs; Changelog im selben Commit. **Rechtlicher Hinweis:** Ausgleichsanspruch-Klausel (Directive 86/653 / §89b / UK Regs) und die USt-Textbausteine sind vom Betreiber mit einem Berater/Steuerberater final zu prüfen.

**Wo:** neu `server/lib/fiaon-html-pdf.ts`, `server/routes/fiaon-onboarding.ts`, `server/routes/fiaon-onboarding-content.ts`; `server/routes.ts` (+Gate/Router), `server/routes/fiaon-team.ts` (Abrechnung bei mark-paid), `server/make-webhook.ts` + `server/make-events-registry.ts` (2 Events); Client neu `client/src/pages/agent/onboarding.tsx`, `client/src/pages/agent/dokumente.tsx`, `client/src/pages/admin-vertraege.tsx`; `client/src/pages/agent/shared.tsx` (Gate in `AgentShell` + Nav), `client/src/pages/agent/mehr.tsx`, `client/src/App.tsx`, `client/src/components/admin/AdminShell.tsx`; `docs/vertraege/commercial_agent_agreement_EN.docx`.

---

## 20.07.2026 — Agent-UX: sichtbarer Bestätigungsdialog + Funktions-/Schulungsseite (Prompt 2/2)

**A — Doppel-Tap durch echtes Bestätigungs-Popup ersetzt:** Der frühere „Zwei-Schritt"-Klick (Paket DD — erst markieren, dann denselben Button erneut tippen) war auf dem Handy unsichtbar/unverständlich. Er ist jetzt überall durch **einen modalen Bestätigungsdialog** ersetzt (zentriert am Desktop, Bottom-Sheet am Handy): ein Tap → Popup mit Titel, Name und — bei Aktionen mit Folgen — Klartext-Hinweis (z. B. „Der Kunde erhält eine E-Mail zur Nummern-Korrektur."), dann Abbrechen/Bestätigen. **Eine** wiederverwendbare Komponente (`ConfirmDialog` in `client/src/pages/agent/shared.tsx`): Fokus-Falle (Tab bleibt im Dialog), ESC/Backdrop schließt, Touch-Ziele ≥ 44 px, im bestehenden CI. Ausgerollt auf: **Kontakt-Ergebnisse** (Kunde + Lead), **Reaktivieren**, **Akte schließen ohne Ergebnis** (Pflicht-Begründung im Dialog statt `window.prompt`), **Verlaufseintrag als irrtümlich markieren**. Der **Rückruf-Termin** ist direkt im Dialog eingebettet (Datum/Zeit, Hinweis „deutsche Zeit" bleibt). Der Schutz vor Versehen bleibt also erhalten — er wird nur sichtbar.

**B — Funktions-/Schulungsseite (`/admin/funktionen`):**
- **Katalog** aller Funktionen, gruppiert nach Bereich (Kundenakte · Zahlungen · Leads/Warteschlange · E-Mails/Events · Agent-Portal · Team/Provision) — je Eintrag Name, 1-Satz-Erklärung, Direktlink; Event-Buttons tragen den Verdrahtungs-Status (✅ läuft · ⚠️ Make-Zweig fehlt · 💀 veraltet) aus der bestehenden `makeBranchReady`-Logik.
- **Selbsttest**: kompakte Tabelle „Button → erwartetes Event → zuletzt gefeuert (Berlin-Zeit) → Status" aus Registry + Versand-Verlauf — zeigt auf einen Blick, ob ein Knopf das richtige Event auslöst, ohne an echte Kunden zu senden (Verweis auf den Test-Versand in `/admin/events`). Bewusst nicht verdrahtete Empfehlungs-Events erscheinen als ⚠️.
- **Schulungsmodus**: aufgeräumte, präsentierbare Darstellung (große Typo, ein Bereich pro Bildschirm, Weiter/Zurück, **druckbar**) — kein Video-Schnickschnack, keine Emojis.
- **Verdrahtungs-Audit (Phase 0):** jeder Event-auslösende Button wurde systematisch gegen die Registry geprüft (`sendMakeWebhook`-Aufrufe server-weit). **Ergebnis: kein toter oder falsch verlinkter Event-Button** — jeder gefeuerte Event ist registriert. „Make-Zweig fehlt" ist kein Code-Fehler, sondern ein Betreiber-TODO in Make (Live-Status im Selbsttest). Tabelle auf der Seite.

**Regeln:** keine Geschäftslogik geändert (nur UX + Verdrahtungs-Anzeige + Doku), mobil + Desktop, bestehendes CI, Changelog im selben Commit.
**Ehrliche Grenze:** Die **Admin**-Lead-/Kunden-Detailansichten lösen Kontakt-Ergebnisse per Einzel-Klick aus (Desktop, kein Doppel-Tap, keine unklare Bestätigung) — dort war die gemeldete Doppel-Tap-Problematik nicht vorhanden, deshalb bewusst unverändert.
**Wo:** `client/src/pages/agent/shared.tsx` (neu `ConfirmDialog`), `client/src/pages/agent/kunden.tsx` + `client/src/pages/agent/leads.tsx` (Doppel-Tap entfernt, Dialoge verdrahtet), neu `client/src/pages/admin-funktionen.tsx`, `client/src/App.tsx` (+Route `/admin/funktionen`), `client/src/components/admin/AdminShell.tsx` (Nav-Punkt „Funktionen & Schulung").

---

## 20.07.2026 — Die zentrale Kundenakte: „Eine Seite. Alles." (Prompt 1/2)

**Die Akte (`/admin/kunde/:id`) — eine Seite pro Person:** Kopf mit Name, Lifecycle-Badge (Lead/Offen/Angekündigt/Bezahlt/Abgelaufen/Storniert/Direktzahler), Agent, Kontakt, „seit wann" und Dubletten-Warnung. Darunter alles in Abschnitten: **Stammdaten** (Name, E-Mail, Telefon, Adresse, Geburtsdatum — jede Änderung mit Audit alt → neu; sensible Felder wie Limit/Betrag/E-Mail mit Bestätigungsdialog), **Konditionen** (Kreditlimit `approved_limit`, Betrag `amount_due` — bei BEZAHLTEN Bestellungen gesperrt, Zahlungsfrist, Paket), **Zahlungen** (alle Bestellungen der Person inkl. Dubletten-Historie, Bankeingänge aus dem Kontoabgleich, Rechnung; Aktionen „bezahlt markieren" — **identischer Endpoint wie bisher, inkl. Provisions-Hook** —, stornieren, reaktivieren, Frist ändern), **E-Mail-Center** (jedes kundengebundene Make-Event als Button mit Payload-Vorschau + Bestätigung; Events ohne Make-Zweig zeigen ⚠️ statt still zu versagen; Versand-Historie der Person darunter), **Agent & Betreuung** (Zuweisung per Dropdown über den bestehenden Reassign-Endpoint, Provisions-Lage inkl. „Direktzahler" und Link zur Nachbuchung, alle Leads der Person), **Dubletten** (Familie derselben Person mit Gewinner-Vorschlag und **1-Klick-Zusammenführen mit Undo** über die bestehende Merge-Engine; UI-Hinweis „Zusammenführen statt Löschen — Historie bleibt beweisbar"; unsichere Namens-Treffer nur zur Prüfung), **Verlauf** (Kontakt-Log + Lead-Log der ganzen Person, chronologisch, Berlin-Zeit, plus Admin-Notizen).

**Die eine Liste (`/admin/kunden`):** Alle Personen — Leads und Kunden vereint, jede Person genau einmal (konvertierte Leads und gemergte Datensätze erscheinen nie doppelt; Lead-only-Zeilen nur, wenn keine Antrags-Schwester per E-Mail/Telefon existiert). **Serverseitig paginiert** (50/Seite, 512-MB-tauglich) mit kombinierbaren Filtern: Lifecycle-Chips, Agent, Quelle/Kampagne, Paket, Zeitraum, „ohne Agent", „ohne Telefon", „Dubletten-Verdacht", „Zahlung > 7 Tage unbestätigt", optional „anonyme Abbrecher". Jeder Treffer öffnet die Akte.

**Der kaputte Suchtreffer ist Geschichte:** Der frühere Treffer-Block der Zahlungszentrale („Paket DC") war eine Sackgasse — Kunden-Treffer setzten nur den Suchtext, Lead-Treffer waren gar nicht klickbar, Zeilen-Aktionen führten nur zur Rechnung. Jetzt öffnet **jeder** Treffer die Akte: der Block in der Zahlungszentrale, die ⌘K-Suche (Server liefert jetzt auch Leads + Telefon-Ziffern-Suche und verlinkt in die Akte statt in die Zahlungszentrale), die Dashboard-Schnellsuche (gleicher Endpoint), jede Zeile der Zahlungszentrale („Akte"-Knopf), der Detail-Drawer („Akte öffnen →") und der Lead-Drawer der Leads-Seite.

**Strikte Regeln eingehalten:** Kein hartes Löschen (nur Soft-Merge mit Undo). Kein Eingriff in Provisions-/Stichtag-/Zahlungs-Hooks — die Akte **ruft** die bestehenden Endpoints (`mark-paid`, `cancel`, `reactivate`, `merge`/`undo`, `events/send-real`, `team/reassign`, `leads/*`), sie ersetzt sie nicht. Berlin-Zeit überall, mobil bedienbar (Karten-Layout bricht um). Zahlungszentrale, Leads und Anträge & KYC bleiben als Arbeits-Fokusse erhalten — ohne eigene, abweichende Detail-Wahrheit.

**Wo:** Neu: `server/routes/fiaon-kunden.ts` (Liste + Akte-Aggregat + Stammdaten/Konditionen mit Audit + Notiz), `client/src/pages/admin-kunde.tsx` (Akte), `client/src/pages/admin-antraege.tsx` (früherer /admin/database-Inhalt). Geändert: `client/src/pages/admin-kunden.tsx` (jetzt die eine Liste), `server/routes/fiaon-admin-hub.ts` (Suche → Akte, Leads), `client/src/pages/admin-zahlungen.tsx` (Treffer-Block ersetzt, Akte-Links), `client/src/pages/admin-leads.tsx` (Akte-Link im Drawer), `client/src/components/admin/AdminShell.tsx` (Nav + Breadcrumb), `client/src/App.tsx`, `server/routes.ts` (Mount). Phase-0-Bestandsaufnahme (Funktions-Inventar Aktion → Ort → Endpoint) in `SYSTEM_DIAGNOSE.md`.

---

## 19.07.2026 — E-Mail-Vollinventur (/admin/events) + „Nummer falsch"-Strecke kundenfertig

**Vollinventur aller E-Mail-Ereignisse:** Der Server wurde komplett durchsucht — FIAON verschickt **keine E-Mail selbst**, jeder Versand läuft über Make.com (`sendMakeWebhook`). **Kein Versand läuft an der Registry vorbei.** `/admin/events` zeigt jetzt **alle** Ereignisse mit Beschreibung, Payload-Beispiel und Test-Button; Ereignisse ohne fertigen Make-Zweig tragen das Badge **„Make-Zweig fehlt"** samt Erklärung („Test lernt Make die Payload an"), das veraltete `followup_48h` ist als **VERALTET** markiert. Vollständige Inventur-Tabelle in `SYSTEM_DIAGNOSE.md`.

**Fehlende, sinnvolle Ereignisse ergänzt (nur registriert — kein automatischer Versand):** Für Momente, in denen ein Kunde eine Mail erwarten würde, aber bisher keine kam, sind jetzt testbare Events in der Registry — **als Empfehlung markiert**, damit der Betreiber Make-Zweig + Template bauen kann: `payment_cancelled` (Storno — vom Betreiber ausdrücklich vermisst), `payment_reactivated`, `documents_change_request`, `schufa_approved/rejected/requested`, `account_activated/suspended`, `profile_query`, `gdpr_deleted`. **Es wurde bewusst kein neuer Auto-Versand verdrahtet** (nur auf ausdrücklichen Wunsch).

**„Nummer falsch"-Strecke kundenfertig (#23):**
- **Brevo-Template** `docs/brevo-templates/number_update_request.html` (FIAON-CI, Sie-Form, Button, Impressum) + Betreiber-Anleitung in `docs/BETREIBER_TODO_MAKE.md`.
- **Kundenseite `/nummer-aktualisieren` auf Premium-Niveau:** FIAON-Branding, große Schrift, mobil perfekt; zeigt die **maskierte** hinterlegte Nummer („+49 176 •••••• 52"); **Live-Validierung** (grüner Haken/Fehlertext, Speichern erst bei gültiger Nummer, Unsinn wie 00000 wird abgefangen); freundliche Erfolgs- und Ablauf-Seiten; **nur** die Telefonnummer ist änderbar (der signierte Link ist die Authentifizierung).
- **Antrags-Funnel:** dieselbe Live-Telefonvalidierung nachgerüstet (privat + business) — **keine SMS-Verifizierung** (Conversion-Schutz), nur sofortige Formatprüfung; kein neuer Pflicht-Schritt.
- **Sichtbarkeit für Agenten:** Korrigiert ein Kunde seine Nummer selbst, springt der Lead in der Warteschlange **nach oben** und Kunde/Lead tragen das Badge **„Nummer vom Kunden korrigiert — erneut anrufen"** (bis ein neuer Kontakt dokumentiert ist). So verpufft die Korrektur nicht.

**Regeln:** keine neuen automatischen Versände ohne Freigabe (fehlende Events nur registriert + empfohlen); Sie-Form, mobil; kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik.
**Wo:** `server/make-webhook.ts` + `make-events-registry.ts` (neue Event-Typen, `recommendationOnly`), `server/routes/fiaon-admin-hub.ts` (`makeBranchReady`, send-real-Guard), `server/routes/fiaon-antrag.ts` (maskierte Nummer, `number_corrected_at`), `server/routes/fiaon-leads.ts` + `fiaon-agent.ts` (Queue-/Worklist-Badge), `client/src/lib/phone.ts` (neu, gemeinsame Validierung), `pages/nummer-aktualisieren.tsx`, `pages/antrag.tsx`, `pages/business-antrag.tsx`, `pages/admin-events.tsx`, `pages/agent/kunden.tsx`, `pages/agent/leads.tsx`, `docs/brevo-templates/number_update_request.html`, `docs/BETREIBER_TODO_MAKE.md`.

---

## 19.07.2026 — Agenten-Workflow: Geld-Backlog, Portal-Limit, Löschen, Kalender, Nummer-Korrektur (#15–#23)

**#18 — „Lange bezahlt, nie bestätigt" sichtbar gemacht (Geld):** Das Dashboard warnt jetzt „**X Kunden warten seit > 7 Tagen auf Zahlungsbestätigung**" (angekündigt/`claimed_paid`, nie freigeschaltet — dort liegt unerkannter Umsatz). Klick führt in die Zahlungszentrale. Das Nur-Lese-Skript `scripts/prompt2-report.ts` listet alle Fälle (inkl. Alan Imsirovic) mit Bank-Abgleich-Status und Summe. Der Handgriff „bezahlt bestätigen" bleibt beim Betreiber.

**#20 — Falsches Kreditlimit im Kundenportal behoben (Geld):** Ultra-Kunden sahen teils „250 €" statt des Paket-Limits. Ursache: das pro-Antrag berechnete `approved_limit` wurde im Funnel auf den Mindestwert (250 €) geklemmt bzw. gar nicht gesetzt. Das Portal zeigt jetzt das **Paket-Limit** (Starter 500 € · Pro 5.000 € · Ultra 15.000 € · High End 25.000 €, Business analog), wenn kein sinnvolles persönliches Limit vorliegt. **Keine Änderung an Zahlung/Provision** — reine Anzeige. Bestehende Sessions aktualisieren sich beim nächsten Öffnen automatisch. `scripts/prompt2-report.ts` listet alle betroffenen bezahlten/aktiven Kunden.

**#15/#22 — „Aus meiner Liste entfernen" jetzt auch für KUNDEN (kein Löschen):** Agent und Admin können Kunden mit Grund (keine Nummer · ungültige Nummer · 100 % abgelehnt · kein Interesse · Dublette) aus der Arbeitsliste nehmen. Der Kunde **bleibt vollständig in der DB**, verschwindet nur aus Warteschlange/Arbeitsliste, ist im Admin unter dem neuen Filter **„Aussortiert"** sichtbar und **jederzeit zurückholbar**. UI-Hinweis überall: „Wird nie gelöscht — verschwindet nur aus deiner Liste." (Für Leads gab es das bereits.)

**#17 — Kalender-Termine anklickbar:** Ein Klick auf einen Termin öffnet ein **Detail-Popup** (auf dem Handy als Bottom-Sheet) mit Kunde, **Uhrzeit in deutscher Zeit**, Typ, Notiz und **Direktlink zur Kundenakte**. Lange Namen werden nicht mehr abgeschnitten.

**#23 — „Nummer falsch" → automatische Korrektur-Mail:** Wählt ein Agent das Kontakt-Ergebnis „Falsche Nummer" und ist eine E-Mail hinterlegt, geht (max. **1×/Tag/Person**) eine Mail mit Button **„Nummer aktualisieren"** raus. Der Kunde trägt in einem schlanken Formular (`/nummer-aktualisieren`, signierter Link) seine Nummer ein → sie landet direkt im Datensatz (Audit „vom Kunden selbst aktualisiert"), der Lead/Kunde wird **wieder anrufbar** und geht zurück in die Warteschlange. So werden gerade die „nur E-Mail, keine Nummer"-Leads reaktivierbar — echter Umsatz-Hebel. **Betreiber-TODO:** Make-Zweig `number_update_request` + Brevo-Template mit Button zu `update_url` anlegen (Struktur wie bestehende Events; Beispiel in der Event-Registry / `/admin/events`).

**#16 — Reaktivierung verifiziert:** Der Drawer bleibt nach „Kunde reaktivieren" offen und lädt in-place neu (kein `onClose`), alle Aktionen sofort nutzbar — im Code bestätigt.

**Regeln:** kein echtes Löschen (alles umkehrbar, im Audit), Berlin-Zeit überall, kein Eingriff in Provisions-/Stichtag-Logik, mobil + Desktop.
**Wo:** `server/routes/fiaon-antrag.ts` (`effectiveLimit`/`PACK_LIMITS`, `/admin/applications/:ref/dismiss|restore`, `/number-update/:token`), `server/routes/fiaon-agent.ts` (`/agent/customers/:ref/dismiss`, Kalender-Feld, Nummer-Mail), `server/routes/fiaon-leads.ts` (`/admin/leads/:id/attach-to-order` aus P1, Nummer-Mail), `server/routes/fiaon-admin-hub.ts` (Backlog-Signal), `server/fiaon-number-update.ts` (neu), `server/make-webhook.ts` + `make-events-registry.ts` (Event `number_update_request`), Client: `dashboard.tsx`, `admin-hub.tsx`, `agent/kunden.tsx`, `agent/leads.tsx`, `agent/kalender.tsx`, `components/admin/AdminApplicationsManager.tsx` + `AdminAppDetail.tsx`, `pages/nummer-aktualisieren.tsx` (neu), `App.tsx`; Report `scripts/prompt2-report.ts` (neu).

---

## 19.07.2026 — Dubletten & verschwundene Kunden: Prävention, die wirklich greift (P1–P4)

**Das Kernproblem (6 von 14 Tickets):** Bereits bezahlte Kunden tauchten doppelt auf, verschwanden oder wurden dem falschen Agenten zugeordnet (#19/#21/#24/#25/#26/#27). Die frühere Stufe „nur erkennen + flaggen" (P3-A) hat das nicht praktisch gelöst — dieselbe Person lief weiter mehrfach durch den Funnel. Diese Änderung behebt es real.

**P1 — Prävention beim Anlegen der Bestellung (der eigentliche Fix):** Beim Übergang zu „offen/zu zahlen" (`POST /payment-order`) prüft das System jetzt, ob **dieselbe Person** (gleiche E-Mail **oder** normalisiertes Telefon) bereits **bezahlt** hat oder **in aktiver Betreuung** ist. Wenn ja, wird der neue Doppel-Antrag **sofort mit dem bestehenden Datensatz verknüpft** (Soft-Merge) statt als zweiter Kunde in Umlauf zu gehen — **kein zweiter Agent, keine zweite Anrufliste, kein Doppelanruf.** Der betreuende Agent sieht eine Notiz im Verlauf.
**Geld-Sicherheit (unverhandelbar):** Der Merge berührt **niemals** eine bestehende Zahlung, Provision oder Rechnungsnummer — nur der neue, unbezahlte Antrag wird angehängt. Bei **Unsicherheit** (zwei bezahlte Datensätze) findet **kein** Automatik-Merge statt; der Fall wird als „prüfen" für `/admin/dubletten` geflaggt. **SCHUFA/Bonität** (eigenes Produkt) wird bewusst nie automatisch verknüpft.

**P2 — Bezahlte/gemergte Kunden sind aus der Arbeitsliste raus (aber nicht aus dem System):** Die Agenten-Warteschlange und Anrufliste zeigen `paid`- und `merged`-Datensätze nicht mehr an. Der betreuende Agent findet sie weiter über „Gesamtbestand → Bezahlt" und die Suche. Der **Doppelanruf** (#21, Daniel & Florentine) entstand durch Dubletten-Datensätze derselben Person, die je einem anderen Agenten zugewiesen waren — P1 verhindert das Nachwachsen, P3/P5 räumen den Bestand auf.

**P3 — `/admin/dubletten` erkennt jetzt auch Lead ↔ Kunde:** Neben E-Mail- und Telefon-Gruppen zeigt die Seite jetzt **offene Leads, die zu einem bereits bezahlten/aktiven Kunden gehören** (dieselbe Person als Lead **und** als Kunde — genau die Fälle, die der reine E-Mail-Merge übersah). Mit einem Klick lässt sich der Lead **verknüpfen** („Mit … verknüpfen") — er verlässt die Anruf-Warteschlange, bleibt aber vollständig in der DB. Zahlung/Provision bleiben unberührt.

**P4 — Zahler mit abweichendem Namen/Konto (#27):** Im Kontoabgleich gilt weiter: **die Referenz ist der Anker, nicht der Name.** Stimmt die Referenz, weicht aber der Einzahlername vom Kundennamen ab (z. B. Zahlung über das Konto der Mutter), erscheint jetzt ein dezenter Hinweis **„Name weicht ab (Zahlung evtl. durch Dritte)"**. Kein Automatismus — nur Sichtbarkeit; die manuelle Zuordnung bleibt möglich.

**Phase 0 — Forensik:** Das Nur-Lese-Skript `scripts/forensik-verschwundene-kunden.ts` prüft jetzt die konkret gemeldeten Namen (#18–#27) inkl. Referenz-Lookup, Doppelzahler-Report und „offene Anträge trotz bezahlter Schwester". Ausführen: `npx tsx scripts/forensik-verschwundene-kunden.ts`.

**Kunden-Flow gehärtet:** Wird der neue Antrag verknüpft, leitet der Funnel weiter auf die bestehende Bestellung (`/zahlung/…`, zeigt bei bezahltem Gewinner die „bereits bezahlt"-Ansicht); bei Alt-Kunden ohne Zahlungsreferenz zum Login — kein hängender Button. SCHUFA-Funnel unberührt.
**Getestet:** `scripts/p1-prevention-e2e.ts` (markierte Testdaten, `--cleanup`): Verknüpfung, Geld-Sicherheit, Telefon-Treffer, „zwei Bezahlte → kein Auto-Merge", SCHUFA-Ausschluss, Undo. `npx tsc --noEmit` fehlerfrei.

**Sicherheit/Regeln:** kein hartes Löschen, kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik, alles im Audit-Log, jeder Merge per `fiaon_merge_log` umkehrbar.
**Wo:** `server/routes/fiaon-antrag.ts` (`linkDuplicateToPaidOrActive`, `/payment-order`, `/admin/duplicates/groups` Lead-Cross), `server/routes/fiaon-leads.ts` (`/admin/leads/:id/attach-to-order`), `server/routes/fiaon-reconcile.ts` (`payerMatchesCustomer`), `client/src/pages/admin-dubletten.tsx`, `admin-kontoabgleich.tsx`, `antrag.tsx`, `business-antrag.tsx`, `scripts/forensik-verschwundene-kunden.ts`, `scripts/p1-prevention-e2e.ts`. Details in `SYSTEM_DIAGNOSE.md`.

---

## 16.07.2026 — Kein Löschen mehr + Dubletten-Werkzeug + aufgeräumte Navigation (P0/P3)

**Dringend behoben — kein hartes Löschen mehr:** Das Zusammenführen von Dubletten hat Datensätze bisher **unwiderruflich gelöscht** (`DELETE`). Das widerspricht der Grundregel „kein Kunde/Lead wird je gelöscht". Ab sofort ist jeder Merge ein **Soft-Merge**: Der Verlierer bleibt in der Datenbank erhalten (nur ausgeblendet), Kontakthistorie und Lead-Verknüpfungen wandern zum Gewinner, und **jeder Merge ist per Klick rückgängig** zu machen. Provisionen bleiben unangetastet — kein Anspruch geht verloren, keiner entsteht doppelt.

**Neu: `/admin/dubletten` — Dubletten zusammenführen.** Eine eigene Seite zeigt alle mehrfach angelegten Personen (gleiche E-Mail **oder** Telefonnummer) nebeneinander — mit **Konfidenz** (Sicher/Wahrscheinlich/Prüfen), einem **Gewinner-Vorschlag** (bezahlt vor angekündigt vor offen; mit Agent vor ohne; vollständiger vor unvollständiger) und einer Vorschau, **welche fehlenden Felder** der Gewinner dazugewinnt (Telefon, E-Mail, Adresse, Geburtsdatum). Merge per Klick, **Rückgängig** direkt daneben. Doppelt-bezahlte Fälle und „wird dadurch anrufbar" stehen oben.
**Warum wichtig:** Viele nicht-anrufbare Leads werden durch das Ergänzen der Telefonnummer aus einem Schwester-Datensatz **anrufbar** — das ist direkter Umsatz und entlastet die Agenten.

**Navigation aufgeräumt (zweite Sidebar entfernt):** Die versteckte „Cockpit"-Sidebar unter `/admin/database` ist weg. `/admin/database` zeigt jetzt **nur noch die Kunden-/Antragsverwaltung** (Suche, Filter, KYC, Zusammenführen). Alles andere ist über die **Haupt-Navigation** erreichbar:
- **Kündigungen** → eigener Punkt `/admin/kuendigungen` (echter Workflow, war nur versteckt erreichbar).
- **Investoren** → eigener Punkt `/admin/investoren` (enthält echte Daten, daher behalten).
- **Buchhaltung/Ausbuchung** → eigener Punkt `/admin/buchhaltung` (Journal + Ledger enthalten echte Buchungen, daher behalten statt entfernt; offene Betreiber-Frage: mit `/admin/verbuchungen` zusammenlegen?).
- **Dubletten** → eigener Punkt `/admin/dubletten` (statt Sprungmarke).
- **Entfernt:** „Command OS", „Live Radar", die manuelle Aufgabenliste, die Wissens-DB und die **Stripe-Umsatzansicht** (Stripe ist bei FIAON stillgelegt — Zahlungen laufen über Wise/Vorkasse; einzige Umsatzquelle bleibt `/admin/finanzen`). Übersicht/Aufgaben liefert der Hub `/admin`.
- Alte Links auf `/admin/database` funktionieren weiter.

**Sicherheit/Regeln:** kein hartes Löschen, kein Eingriff in Zahlungs-/Provisions-/Stichtag-Logik, jede Aktion protokolliert und umkehrbar (`fiaon_merge_log`).
**Wo:** `client/src/pages/admin-dubletten.tsx`, `admin-kuendigungen.tsx`, `admin-investoren.tsx`, `admin-kunden.tsx`; Merge-Engine in `server/routes/fiaon-antrag.ts` (`mergeApplications`, `undoMergeApplications`); Diagnose `scripts/p3-report.ts`. Details in `SYSTEM_DIAGNOSE.md`.

---

## 16.07.2026 — KI-Cockpit: Frag dein Geschäft in normaler Sprache (Prompt 3/3)

**Was:** Oben auf `/admin` gibt es jetzt einen **Chat**. Du fragst z. B. „Wie viele bezahlt diesen Monat?" oder „Zeig mir alle Zahlungen von Terzi" und bekommst **echte Zahlen aus der Datenbank** als Tabelle — plus eine kurze Einordnung und die **aufklappbare Abfrage** („woher kommt die Zahl"). Vorschlags-Chips für den Einstieg, Verlauf der letzten Fragen, Antwort kopierbar; auf dem Handy voll bedienbar.
**Warum:** Zahlen nachschlagen hieß bisher: die richtige Seite finden, Filter setzen, exportieren. Jetzt reicht eine Frage — und die Antwort ist belegt statt geraten.
**Datenschutz (Kern):** Die KI bekommt **nie Kundendaten**. Sie sieht nur die Frage + das Datenbank-Schema + die verbindlichen Definitionen und liefert eine **nur-lesende** Abfrage zurück. Unser Server prüft die Abfrage hart und führt sie aus; für die Erklärung gehen nur **anonyme Summen** an die KI (keine Namen, E-Mails, Telefonnummern, IBANs). So bleibt „Terzi" auf unserem Server, nicht bei OpenAI.
**Sicherheit:** Nur Lesen (mehrfach abgesichert: Schlüsselwort-Whitelist + Read-only-Transaktion in der DB), nur erlaubte Geschäftstabellen (keine Passwörter/Bankdaten), Timeout + Zeilenlimit, nur Admin, Rate-Limit, kein KI-Aufruf beim bloßen Öffnen. **Jede Frage wird protokolliert** (wer, wann, welche Abfrage). Bei KI-Ausfall bleibt das übrige Dashboard voll funktionsfähig.
**Wo:** Dashboard `/admin` (oben). Technik: `server/lib/fiaon-cockpit.ts` (Leitplanken), `server/routes/fiaon-cockpit.ts` (Endpunkte + Audit), `client/src/components/admin/Cockpit.tsx`. Details in `SYSTEM_DIAGNOSE.md`.

**Vorab behoben (aus den Screenshots):**
- **Leistungs-KI widersprach den Kacheln:** Die gespeicherte KI-Analyse wurde unabhängig vom gewählten Zeitraum angezeigt. Jetzt zeigt sie **ihren eigenen Analyse-Zeitraum** und warnt, wenn er von den Kacheln abweicht (mit „neu erstellen"). Kein Datenbug — ein Anzeige-Bug, jetzt ehrlich sichtbar.
- **Agentennamen in der KI-Analyse:** Die Anzeige ersetzt die anonymen „Agent A/B/…" wieder durch die echten Namen (an OpenAI ging nie ein Name).
- **„Übernommene Akten: 1" bei 465 Kontakten:** Zählung ist korrekt — sie misst nur die formale Warteschlangen-Übernahme; die Warteschlange wird kaum genutzt (Agenten arbeiten zugewiesene Leads/Kunden direkt). Tooltips erklären das jetzt.
- **Doppelter Agent „Justin Schwarzott":** Zusammenführ-Skript `scripts/merge-duplicate-agent.ts` (DRY-RUN Standard, `--apply` zum Ausführen) hängt alle Verweise auf den aktiven Stammsatz um und deaktiviert die Dublette — **nichts wird gelöscht**, alles im Audit.

**Regeln eingehalten:** keine Geschäftslogik geändert, alles im Audit, keine Heredocs, Doku in `SYSTEM_DIAGNOSE.md`.

---

## 16.07.2026 — P3-A: Dubletten-Erkennung per E-Mail UND Telefon (nur erkennen + flaggen)

**Was:** Legt ein Kunde mehrfach denselben Antrag an (z. B. zwei Browser-Sitzungen), wird das jetzt beim Anlegen der Bestellung **automatisch erkannt** — nicht nur über die **E-Mail**, sondern auch über die **Telefonnummer** (formatunabhängig normalisiert: `0170…`, `+49170…`, `0049170…` gelten als gleich). Es wird **nichts automatisch zusammengeführt** und **nichts am Zahlungsfluss geändert** — die Dublette wird nur in der Kundenhistorie vermerkt und in der Dubletten-Verwaltung angezeigt.
**Warum:** Bisher fand die Dubletten-Erkennung ausschließlich über die E-Mail statt. Kunden, die zweimal mit derselben Handynummer, aber (vertippter/anderer) E-Mail auftauchten, blieben unentdeckt. Betreiber-Entscheidung: bewusst **kein** automatischer Merge im Geldfluss (Referenz, Rechnungsnummer, Provision bleiben unangetastet) — erst prüfen, dann manuell handeln.
**Wo & wie:**
- **Antrags-Intake (`POST /payment-order`):** Nach dem Anlegen der Bestellung läuft eine Erkennung (fire-and-forget, blockiert den Kunden nie). Findet sie eine aktive Schwester (gleiche E-Mail ODER Telefon, andere Referenz, Status offen/angekündigt/bezahlt), schreibt sie einen Vermerk in die Kundenhistorie: „Mögliche Dublette erkannt …". Siehe `detectAndFlagDuplicateApplication` in `server/routes/fiaon-antrag.ts`.
- **Dubletten-Verwaltung (`/admin/zahlungen`):** Gruppen werden jetzt nach **E-Mail UND Telefon** gebildet. Telefon-Gruppen erscheinen nur, wenn sie eine Verbindung aufdecken, die die E-Mail-Gruppierung nicht schon zeigt (z. B. gleiche Nummer bei abweichender E-Mail). Jede Gruppe trägt ein Badge (E-Mail/Telefon); „Alle offenen stornieren" funktioniert auch für Telefon-Gruppen (per Referenzliste). Zähler: „N E-Mail · M Telefon".
- **Doppelzahler:** Fälle, in denen dieselbe Person zweimal bezahlt hat, erscheinen jetzt als Gruppe mit mehreren „Bezahlt"-Einträgen und lassen sich dort prüfen.
- **Lead-Intake:** dedupt bereits per E-Mail **oder** normalisiertem Telefon (innerhalb 24 h) — unverändert, hier nur verifiziert (`processIntake` in `server/routes/fiaon-leads.ts`).
**Kein Merge, keine Löschung, keine Mails.** Alles bleibt rekonstruierbar; Zusammenführung/Stornierung bleibt manuelle Admin-Aktion.

---

## 16.07.2026 — Tickets sind jetzt Gespräche (Prompt 2/3)

**Was:** Aus jedem Feedback-Ticket wird ein **Thread**. Betreiber und Agent schreiben abwechselnd im selben Ticket — mit Autor und Uhrzeit (deutsche Zeit). Es entsteht **kein neues Ticket** mehr für eine Antwort.
**Warum:** Bisher musste der Agent für jede Antwort ein neues Ticket öffnen. So standen 16 Tickets in der Liste, teils dieselbe Sache mehrfach — unübersichtlich für beide Seiten.
**Wo & wie:**
- **Agent (`/agent/feedback`):** „Deine Tickets" zeigt jeden Verlauf; Antwortfeld direkt im Thread. Ungelesene Betreiber-Antworten sind mit einem Punkt markiert; ein **Badge auf „Mehr"** in der Navigation zeigt, wie viele Tickets auf den Agenten warten. Öffnen markiert als gelesen.
- **Betreiber (`/admin` → „Agent-Updates & Feedback"):** Antworten **direkt im Thread** statt im Kommentarfeld. Status (Offen/Geprüft/Umgesetzt/Abgelehnt) bleibt und erscheint im Verlauf als Ereignis („Status auf Umgesetzt gesetzt"). Das **Nav-Badge zählt jetzt nur Tickets, die auf deine Antwort warten** — nicht mehr alle offenen.
- **Benachrichtigung:** Antwortet der Betreiber, bekommt der Agent eine **Mail** (neues Make-Event `agent_feedback_reply`) — sonst merkt er die Antwort nicht. **Betreiber-TODO** (Make-Zweig + Brevo-Template) ist in `docs/BETREIBER_TODO_MAKE.md` und in der Event-Registry dokumentiert; testbar unter `/admin/events`.
- **Bestand migriert:** Die 16 bestehenden Tickets wurden automatisch zu Threads (bisherige Beschreibung = erster Eintrag, vorhandener Admin-Kommentar = erste Antwort). **Nichts geht verloren.** Migration ist idempotent (läuft nur, wo noch kein Verlauf existiert).
- **Duplikate:** Ein Ticket lässt sich als **Duplikat verknüpfen** („gehört zu #11") statt es zu schließen — die Verknüpfung bleibt als Ereignis im Verlauf, das Ticket bleibt erhalten.
- **Bonus-Logik unverändert:** Gutschrift pro Ticket wie bisher (erscheint zusätzlich als Ereignis im Verlauf).
**Regeln:** Nichts gelöscht, alles im Audit. Mobil + Desktop (Agenten antworten am Handy). Uhrzeiten in deutscher Geschäftszeit (Europe/Berlin, wie T13).
**Details:** `docs/AGENT_FEEDBACK_THREADS.md`.

---

## 16.07.2026 — Design-Qualität: Tooltips, KI-Optik & Mobile (Prompt 1/3)

**Was:** Die kleinen Info-„i" (Tooltips) funktionieren jetzt richtig, KI-Ausgaben werden sauber gerendert statt als Rohtext, und die Leistungs-Tabelle bricht auf dem Handy nicht mehr aus.
**Warum:** Die Tooltips waren als natives `title`-Attribut gebaut — auf dem Handy passiert beim Antippen nichts (kein Hover), auf dem Desktop erschien nur ein verzögerter, hässlicher Browser-Kasten. Die KI-Analyse stand als Markdown-Rohtext (`## Was lief gut`, `**Text**`) auf der Seite und lief über die volle Breite (unlesbar). Die Team-Tabelle mit 11 Spalten scrollte auf schmalen Displays horizontal weg („DIREKT…" abgeschnitten).
**Wo:**
- **Tooltips:** Neue gemeinsame Komponente `Tip` (`client/src/components/admin/PageHelp.tsx`) — klick-/tap-basiert (kein Hover mehr nötig), dezente Karte im CI, sanfte Einblendung, schließt bei Klick daneben oder ESC. Positioniert sich selbst im sichtbaren Bereich (per Portal an `<body>`), wird also **nie** von Tabellen/Karten abgeschnitten. Überall ersetzt: Kennzahlen und Tabellenköpfe in `/admin/leistung`, `/admin/hub`, `/admin/finanzen` (Kennzahlen + Funnel-Stufen).
- **KI-Optik:** Neue Bausteine `AiButton` + `Markdown` (`client/src/components/admin/AiKit.tsx`). KI-Buttons bekommen eine hochwertige, ruhige Optik (subtiler Verlauf, feine Tiefe statt Neon; ruhiger Ladezustand statt hartem Spinner). KI-Ausgaben werden mit Überschriften, Listen und Fettung gerendert und auf angenehme Lesebreite begrenzt (`/admin/leistung`, `/admin/diagnose`).
- **Mobile-Tabelle:** Die Team-Leistungstabelle stapelt auf schmalen Viewports als Karten (Agent oben, Kennzahlen als Paare, wichtige zuerst); Touch-Ziele ≥ 44 px. Auf Desktop bleibt die Tabelle.
- **CI:** feine Schatten-Hierarchie, konsistente Radien, ruhige Übergänge (150–200 ms); `prefers-reduced-motion` respektiert (`client/src/index.css`).
**Keine Geschäftslogik geändert.** Design-/Mobile-Audit: `docs/DESIGN_TOOLTIP_MOBILE_AUDIT.md`.

---

## 16.07.2026 — Phase 0: Messbericht Zeitzone + Lead-Filter

**Was:** Zwei offene Punkte aus dem letzten Update mit echten Zahlen aus der Produktion beantwortet (nur gemessen, nichts verändert).
**A — Zeitzonen-Altbestand:** 8 zukünftige Rückruf-Termine liegen 2 h zu spät, alle gleich (agent-eingegeben, Sommerzeit). Einheitlicher Versatz → eine Einmal-Korrektur ist vorbereitet (`scripts/fix-callback-timezone.ts`, Standard = Test-Lauf, ändert nichts). **Wird erst nach ausdrücklicher Freigabe scharf ausgeführt.** Zahlungs-Zusagen (tagesgenau) sind nicht betroffen.
**B — Lead-Filter:** Von 1.700 offenen Leads sind nur **147 anrufbar** (Daniel 71, Florentine 76). 1.553 haben nur E-Mail (kein Telefon) — sie bleiben **korrekt im Mail-Versand** (self-conversion als Direktzahler). Die telefonlosen Leads stammen aus dem **Import** (100 % ohne Telefon), nicht aus Facebook. **262** davon lassen sich per Merge anrufbar machen. Ob ~147 für zwei Agenten reichen, ist eine Betreiber-Entscheidung.
**Wo:** `scripts/phase0-report.ts` (read-only), Details in `SYSTEM_DIAGNOSE.md` → „Phase 3 — Phase 0".

---

## 16.07.2026 — Agent-Tickets #13–#16 (Florentine Lombardi)

**T13 — Rückruf-Uhrzeit war falsch.**
Was: Eingegebene Rückruf-/Zusage-Zeiten wurden verschoben gespeichert (z. B. 12:30 → 14:30). Jetzt gilt überall **eine** Geschäftszeitzone: **deutsche Zeit (Europe/Berlin)** — beim Speichern, in der Anzeige und in der Erinnerung, egal wo Server oder Betrachter stehen.
Warum: Zeitangaben ohne Zeitzone wurden auf dem UTC-Server falsch interpretiert.
Wo: Rückruf-Termin & Zahlungs-Zusage (Kunden + Leads, Agent + Admin), Kalender, Erinnerung. Neu: Hinweis „(Uhrzeit in deutscher Zeit)" am Feld und Sofort-Bestätigung nach dem Speichern. Alt-Termine werden **nicht** automatisch verändert (Korrektur separat, erst nach Freigabe — siehe Phase-0-Bericht: Versatz ist einheitlich, 8 Termine).

**T14 — Suche nach Telefonnummer.**
Was: In der Leads-Seite gibt es jetzt eine Suchleiste; man findet Kunden UND Leads über Nummer, Name, E-Mail oder Referenz — auch wenn die Akte noch nicht übernommen wurde. Ruft eine unbekannte Nummer zurück, tippt die Agentin die Nummer und öffnet die Akte direkt. Ist bereits eine Akte offen, fragt ein Dialog „Aktuelle Akte parken & Rückruf öffnen?" (kein Datenverlust).
Wo: `/agent/leads` (Suche) und `/agent/kunden` (Nummernsuche auch in der geladenen Liste).

**T16 — Reaktivierung bleibt im Fenster.**
Was: Nach „Kunde reaktivieren" bleibt das Fenster offen, zeigt den neuen Status und alle Aktionen sind sofort nutzbar; Klartext-Toast mit neuer Zahlungsfrist. Grundsatz: Ein Statuswechsel lässt einen geöffneten Datensatz nie verschwinden.

**T15 — „Aus meiner Liste entfernen" statt Löschen.**
Was: Neuer Button im Lead-Fenster mit Grund (keine Telefonnummer · Nummer ungültig · kein Interesse · Dublette). Der Lead verlässt die Arbeitsliste, **bleibt aber vollständig gespeichert** (Historie erhalten, Audit). Im Admin unter dem Filter **„Aussortiert"** sichtbar und jederzeit **zurückholbar**. Kein hartes Löschen — Leads werden nie gelöscht.
Zusätzlich (Vorgabe Betreiber): In der Agenten-Warteschlange erscheinen nur noch Leads mit **E-Mail + Name + Telefonnummer**; unvollständige Leads bleiben in der DB und im Admin sichtbar.

**Tests:** `scripts/test-berlin-time.ts` (10/10 PASS unter UTC und Asia/Bangkok). Diagnose & Details in `SYSTEM_DIAGNOSE.md` → „Agent-Tickets #13–#16".

---

## 15.07.2026 — Fix: KI läuft überall nur über OpenAI

**Was:** Jede KI-Funktion in FIAON (Arbeitsberichte/Leistung, System-Diagnose, Stripe-Umsatzanalyse) nutzt jetzt **ausschließlich `OPENAI_API_KEY`** — kein Gemini, kein anderer Anbieter.
**Warum:** Die KI-Zusammenfassung schlug fehl, weil zuerst ein Gemini-Aufruf versucht wurde; schlug dieser fehl (ungültiger/fehlender Gemini-Schlüssel, Timeout), kam es zum Fehler statt zur Antwort.
**Wo:** `aiComplete` (zentrale Stelle für Leistung + Diagnose) und die Stripe-KI-Insights. Modell über `OPENAI_MODEL` einstellbar (Default `gpt-4o-mini`). Bei Problemen zeigt die Seite die Klartext-Ursache (Schlüssel ungültig 401, Kontingent 429, Modell nicht verfügbar 404, Zeitüberschreitung).

## 15.07.2026 — Phase 5: System-Diagnose („Was klemmt gerade?")

**Was:** Eine neue Seite `/admin/diagnose` zeigt in Echtzeit, was im System hakt — technisch, bei Kunden, bei Agenten — bevor jemand ein Ticket schreibt.
**Warum:** Beim Make-Ausfall gab es keinen Ort, an dem man „seit X Stunden kein Lead-Eingang" oder „E-Mail an Kunde fehlgeschlagen" auf einen Blick gesehen hätte.
**Wo:** Menü „System & Recht → System-Diagnose".
- **Ereignis-Konsole (Hauptansicht):** jedes Problem mit Schweregrad (kritisch/warnung/info), Kategorie, Zeit, Klartext-Bedeutung, Lösungshinweis und — wo möglich — Direktlink oder Aktion (z. B. „Akte freigeben", „Event erneut senden"). Standardfilter: kritisch + Warnung der letzten 24 h. Gleiche Fehler werden gebündelt („23× Make-Webhook 502").
- **Kategorien:** E-Mail/Make (fehlgeschlagene Events), Lead-Eingang (abgelehnt/ungültig/Ausbleiben), Zahlungen (nicht zugeordnet, Betragsabweichung, Provision offen, Dubletten), Agenten (blockierte Akte), Kunden, System (unbehandelte Fehler).
- **Rohdaten-Tab:** Roh-Log-Auszug für die Tiefenanalyse — im Speicher hart begrenzt (1.000 Zeilen / 2 MB Ring-Puffer, 512-MB-tauglich), maskiert, durchsuchbar, als Datei ladbar.
- **KI-Auswertung:** „Probleme zusammenfassen" → Klartext: was ist kaputt, was wiederholt sich, wahrscheinliche Ursache, Reihenfolge der Behebung. Nur maskierte/aggregierte Daten (ausschließlich OpenAI, `OPENAI_API_KEY`).
- **Sicherheit/DSGVO:** Maskierung passiert SERVERSEITIG vor jeder Speicherung — API-Keys, Tokens, Passwörter, Secrets, IBANs, vollständige E-Mails und Telefonnummern werden redigiert (`ma***@gmail.com`, `+49 *** *** **52`, `ghp_***REDIGIERT***`). Aufbewahrung 7 Tage + Löschfunktion. Nur Admin (Agenten: 403).
- **Verknüpfung:** kritische Ereignisse erscheinen zusätzlich als Warn-Kachel auf dem Dashboard und als Nav-Badge — eine Wahrheit, zwei Ansichten.
- **Historie & Export:** Ereignisse werden persistiert (Zeitraum-Auswahl, Datei-Export), damit man rückwirkend analysieren kann.

## 15.07.2026 — Phase 4: Admin-UX, Hinweise & Arbeitsberichte

**Was:** Die Verwaltung erklärt sich selbst — Hinweis-Badges, Aufgaben-Dashboard, Arbeitsberichte mit KI-Analyse, Hilfe auf jeder Seite, aufgeräumte Navigation, diese Changelog-Seite.
**Warum:** „Ich kenne mich gar nicht aus, ich weiß nie wo ich bin oder was zu tun ist“ — der Betreiber musste bisher jede Seite öffnen, um zu sehen, ob dort Arbeit liegt.
**Wo:**
- **Zähler-Badges in der Navigation:** dezente Pills an Zahlungszentrale, Kontoabgleich, Auszahlungen, Dubletten, Provisionen nachbuchen und Agent-Feedback — verschwinden bei 0. Ein einziger, 60 s gecachter Server-Endpoint liefert alle Zähler.
- **Dashboard zum Arbeiten** (`/admin`): „Was ist zu tun?“ mit direkter Aktion pro Aufgabe, Warn-Kacheln bei echten Problemen (kein Lead-Eingang seit X Stunden, Automatik pausiert, blockierte Akte) mit Erklärung + Lösung, prominente Kundensuche, klickbare Kennzahlen mit ⓘ-Definition.
- **Arbeitsberichte** (`/admin/leistung`): Ergebnisse pro Agent (Akten, Kontakte, Links, Konversionen, Abschlüsse, Umsatz, Provision, Reaktionszeit, Rückgabe- und Direktzahler-Quote) + Team-Zeitverlauf + Quellen-Konversion. **Keine Arbeitszeit-/Pausen-/Anwesenheits-Erfassung** (Scheinselbstständigkeit/DSGVO); jeder Agent sieht seine eigenen Zahlen im Portal („Mehr → Meine Leistung“). KI-Zusammenfassung auf Knopfdruck — nur anonymisierte Summen gehen an die KI, Ergebnis kopier- und speicherbar.
- **Jede Seite erklärt sich selbst:** Titel + Untertitel in Du-Form und einklappbares „Wie funktioniert diese Seite?“ auf allen Admin-Seiten (beim ersten Besuch offen).
- **Navigation aufgeräumt:** Dubletten und Leistung neu im Menü, „Agent-Updates“/„Agent-Feedback“ zusammengelegt (zeigten dieselbe Seite), Agent-Portal-Pflegeseite aufs Standard-CI gebracht, Routen-Audit: jede Seite ist über das Menü erreichbar.
- **Diese Seite** (`/admin/changelog`): jede System-Änderung in Klartext, gespeist aus dem im Code gepflegten Protokoll.

## 15.07.2026 — Phase 2B: Verifikation & Scharfstellung der Geldlogik

**Was:** Stichtag-Regel für die neue Provisionslogik, Deadlock-Schutz für Lead-Akten, Grenzfall-Fixes, Test-Skripte.
**Warum:** Phase 2 hätte ohne Stichtag rückwirkend gewirkt — 35 offene Bestellungen mit Agent, aber ohne dokumentiertes Ergebnis (Stripling 22, Lombardi 12, Schwarzott 1) hätten bei Zahlung keinen Anspruch mehr gehabt. Außerdem konnte sich ein Agent mit einer offenen Akte aussperren.
**Wo:**
- **Stichtag (kein rückwirkender Regelwechsel):** Bestellungen, die vor dem Stichtag erstellt wurden, laufen nach dem alten Modell (Zuweisung genügt). Erst ab Stichtag gilt „Betreuung dokumentiert". Stichtag ist im Admin sichtbar (Leads → Einstellungen) und wird einmalig per Skript gesetzt (`scripts/phase2b-scharfstellen.ts`) — bereits gebuchte Provisionen bleiben unter allen Umständen unangetastet.
- **Akte-Deadlock verhindert:** Offene Akten ohne Ergebnis werden nach 30 Min. automatisch freigegeben (einstellbar); Agent kann selbst „ohne Ergebnis schließen" (mit Begründung); Admin kann jede Akte freigeben (Leads → Lead öffnen → „Akte freigeben"). Leads ohne Telefon UND E-Mail kommen gar nicht erst in die Warteschlange.
- **Grenzfall-Fix Dubletten:** Dokumentierte Betreuung zählt jetzt über die ganze Bestell-Familie (gleiche E-Mail) — zahlt der Kunde die Schwester-Bestellung, greift die Attribution trotzdem.
- **Klarstellung Link-Versand:** „Antrag/Zahlungslink senden" durch einen Agenten ist Verkaufsarbeit und zählt als dokumentierte Betreuung (war bereits so implementiert).
- **Skripte:** `scripts/phase2b-rematch.ts` (Bank-Altbestand zuordnen, Dry-Run/Write), `scripts/phase2b-e2e.ts` (Ende-zu-Ende-Test der Geldlogik mit markierten Testdaten), `scripts/diagnose-phase2b.ts` (nur lesend).

## 15.07.2026 — Phase 2: Geld & Vertrauen

**Was:** Kontoabgleich repariert, Provisionslogik neu geregelt, Lead-Arbeitswarteschlange, einheitliche Finanz-Kennzahlen.
**Warum:** 0 % der Bankeingänge wurden automatisch erkannt (falsches Vergleichsfeld); Provisionen wurden per Zufalls-Verteilung „verlost" statt verdient; 826 offene Leads mit sichtbaren Kontaktdaten waren keine Arbeitsliste; „bezahlt" bedeutete in jeder Ansicht etwas anderes.
**Wo:**
- **Kontoabgleich** (`/admin/kontoabgleich`): erkennt jetzt die kurze Zahlungsreferenz von QR-Code/Zahlungsseite (tolerant gegen Schreibweisen). Button „Offene neu abgleichen" für den Altbestand (ordnet nur zu, verbucht nichts). Vorschläge nach Name+Betrag mit Konfidenz — nie automatische Buchung. Verbuchen wirkt exakt wie der „bezahlt"-Button (Freischaltung, Dubletten-Stopp, Bestätigungs-Mail 1×, Provisionsprüfung).
- **Provision** : wird verdient, nicht verlost. Anspruch nur bei dokumentierter Betreuung (Kontakt-Ergebnis oder Kundenmail vor Zahlung); letzter dokumentierter Kontakt gewinnt; ohne Betreuung → „Direktzahler, keine Provision". Der Grund steht sichtbar am Kunden. Zufalls-Verteilung von Bestellungen abgeschaltet. Altfälle im Nachbuchungs-Center (`/admin/nachbuchung`) mit Vorschlag — Buchung nur nach Admin-Bestätigung.
- **Lead-Warteschlange** (Agent-Portal → Leads): Kontaktdaten verdeckt bis „Akte öffnen" (protokollierte Übernahme); nur eine offene Akte, nächste erst nach dokumentiertem Ergebnis; Reihenfolge vom Server (Gewichte im Admin einstellbar, Fairness-Anteil für alte Leads); Wiedervorlage statt Löschen.
- **Eine Wahrheit für Zahlen** (`server/lib/fiaon-truth.ts`): „bezahlt" = Status bezahlt + keine Dublette + Zahlungsreferenz vorhanden — überall identisch (Zahlungszentrale, Finanzen, Leads, Dashboard, Agent-Portal). Alt-Import separat ausgewiesen; „Kontaktiert" heißt ehrlich „Angeschrieben (Mail)"; LTV/CAC als Annahme gekennzeichnet; Selbstcheck unter `/api/fiaon/admin/truth-check`.

---

# Rückwirkendes Protokoll (vor Einführung dieser Changelog-Pflicht)

Zusammengetragen aus Git-Historie, `MIGRATION_INVENTORY.md`, `AGENT_REVAMP_AUDIT.md` und `SYSTEM_DIAGNOSE.md`.

## 14.07.2026 — Kein Kunde verschwindet (Lifecycle-Vereinheitlichung)

**Was:** Abgelaufene Kunden bleiben für ihren Agenten sichtbar (read-only) und können reaktiviert werden; eine zentrale Kundensicht.
**Warum:** Kunden „verschwanden“ nach Ablauf aus dem Agent-Portal — Chancen gingen verloren.
**Wo:** Agent-Portal → Kunden.

## 13.07.2026 — Nachbuchungs-Center (Pakete EA–EF)

**Was:** Automatische Erkennung bezahlter Bestellungen ohne Provision + Sammel-/Einzelbuchung; Zuordnungs-Reparatur über Dubletten; bezahlte Bestellungen überall auffindbar.
**Warum:** Ein Dubletten-Bug hatte Fälle hinterlassen, in denen die Zahlung auf einer anderen ref einging als die Betreuung dokumentiert war.
**Wo:** `/admin/nachbuchung`.

## 12.07.2026 — Verschwundene Kunden behoben (Pakete DA–DF)

**Was:** Eigene Kunden bleiben nach Bezahlung/Ablauf sichtbar; Agent-Suche, Provisions-Anzeige und Adressfelder im Kundendetail; Verlaufs-Korrektur (Soft-Delete statt Löschen); Zwei-Schritt-Bestätigung bei Kontakt-Ergebnissen.
**Wo:** Agent-Portal → Kunden.

## 10.–11.07.2026 — Lead-Nachfass-Zeitplan + Bulk-Versand (Pakete CB–CF)

**Was:** Feste Sendezeiten/Wochentage für die Nachfass-Automatik, zwei klare Bulk-Buttons (fällige/alle offenen) mit Fortschritt, Lead-Detail-Drawer, Intake-Diagnose mit Test-Lead.
**Wo:** `/admin/leads`.

## 09.07.2026 — Kontoabgleich eingeführt + Funnel-Fix (Paket CA)

**Was:** Kontoauszug (CSV) importieren, Eingänge Kunden zuordnen, verbuchen; Funnel-Raten korrigiert.
**Wo:** `/admin/kontoabgleich`, `/admin/finanzen`.

## 08.07.2026 — Lead-Management + Finanz-Analytics (Pakete BA–BE)

**Was:** Lead-Intake per Make-Webhook, Auto-Konversion Lead→Kunde, Nachfass-Automatik, Lead-Verteilung ans Team, Alt-Lead-Import; Finanzen & Sales mit Funnel, CAC und Kampagnen-Attribution.
**Wo:** `/admin/leads`, `/admin/finanzen`, Agent-Portal → Leads.

## 06.07.2026 — Agent-Portal Motivations-Update (Pakete AG–AO)

**Was:** Dashboard „Mein Tag“, Live-Feed, Wunschgehalt-Rechner, Update-Center mit Banner, Feedback mit Belohnung.
**Wo:** Agent-Portal; Pflege unter `/admin/agent-portal`.

## 04.–05.07.2026 — Kundendaten-Korrektur, Dubletten-System, Partner-Programm (Pakete AC–AF)

**Was:** Agenten können Stammdaten korrigieren (mit Audit + Dubletten-Warnung); bezahlte Bestellung ersetzt offene Schwester-Bestellungen (Erinnerungs-Stopp); automatische Kundenverteilung; Partner-Programm mit Meilensteinen und Team-Beteiligung (exakt eine Ebene); Rechnungs-PDF-Fix.
**Wo:** Agent-Portal → Kunden; `/admin/team`.

## Juni 2026 — Fundament

- **E-Mail-Engine (Pakete T–X):** Event-Test-Konsole, tägliche Zahlungs-Erinnerungen (Obergrenze, Not-Aus, 08–20 Uhr Berlin), Bulk-Versand mit Fortschritt — `/admin/events`.
- **Login/Aktivierung (Paket Y/Z):** Konto wird erst mit Zahlung aktiv; Voll-IBAN nur für Admins mit Audit je Abruf.
- **Navigation (Pakete L–O):** AdminShell mit Sidebar/Breadcrumb/⌘K-Suche, Kommandozentrale `/admin`, neue Seiten Rechnungen/Einstellungen/Audit/Recht.
- **Mitarbeiter-System (Pakete E–K):** Einladungs-Onboarding, verschlüsselte Bankdaten, Provisions-Engine (eingefrorene Sätze, Integer-Cents), Auszahlungen mit Admin-Freigabe, Skripte, Kalender — `/admin/team`.
- **Entity-Migration FIAON LTD:** Rechtstexte DE/EN, Rechnungssystem mit lückenlosem Nummernkreis, Agent-Portal-Grundgerüst, Zahlungszentrale saniert.
- **Make.com-Anbindung:** welcome/payment_details/followup-Mails über Webhooks (genau 1× via atomare Flags); Dubletten-Fix im Antragsprozess.
