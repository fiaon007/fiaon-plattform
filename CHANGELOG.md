# FIAON — Änderungsprotokoll (Klartext)

Jede Änderung am System bekommt hier einen Eintrag im selben Commit:
**Datum · Was geändert · Warum · Wo zu finden.** Verständlich für Nicht-Entwickler.

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
