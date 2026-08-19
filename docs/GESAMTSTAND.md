# FIAON — Gesamtstand

Die eine Seite, auf der steht, **was existiert und wo**. Stand: 19.08.2026.

Wer wissen will, *warum* etwas so gebaut ist, liest die `CHANGELOG.md`. Wer
wissen will, *wo* etwas liegt, liest hier.

---

## Was der Betreiber noch tun muss

| Was | Wo | Warum es wartet |
|---|---|---|
| **5 zahlende Kunden ohne sichtbaren Betreuer** | Konten 2 und 7 („Justin Schwarzott") | Beide sind als **Testkonto** markiert und fallen aus jeder Team-Ansicht. Daran hängen Patrick Ellmer und Jennyfer Leis (bezahlt), Brigitte Ludl und Martin Ringk (Rechnung offen), Dzintars Auzins (Zahlung gemeldet). Nicht eigenmächtig umgehängt: Zuordnung heißt Provision. |
| **Onboarding-Zeitfenster im Blick** | Dashboard → „Kann das Team arbeiten?" | Aktuell 55 freie Zeiten von Angelique und Rifka. Fallen beide aus, greift der Rückfall auf den Vertrieb — das funktioniert seit 19.08., sollte aber kein Dauerzustand sein. Die Karte wird bei unter 10 rot. |
| **Eine Nummer ergänzen** (Person 11413, `6609360523`) | Kundenliste → Filter „Nummer nicht wählbar" | Kein Land und keine führende Null — nicht entscheidbar, wohin sie gehört. Inline im Filter erledigbar. Die zuvor genannten 18 brauchen NICHTS: Ihr Land steht in der Akte, sie werden seit 31.08. richtig gewählt (vorher `+49` geraten). |
| **8 Kunden über falsche Rechnungsmails informieren?** | `reports/falsches-paket.csv` | In 14 Tagen gingen 8 Zahlungsdaten-Mails auf eine ARCHIVIERTE Bestellung — fünf davon an Josef Rohrmoser (High End 1,00 € statt Pro). Ursache behoben. Ob eine Korrekturmail rausgeht, entscheidet der Betreiber; der Lauf hat NICHTS versandt. |
| **`BETREIBER_MAIL` setzen** | Umgebungsvariablen | Ohne sie geht keine Warnmail raus, wenn ein Tageslauf ausbleibt. Der Protokolleintrag entsteht trotzdem, aber niemand wird geweckt. |
| **Render-Uptime prüfen** | Render → Dienst | Der Folgelauf stand vom 03. bis 18.08. still, weil der Dienst in der 6-Uhr-Stunde nicht lief. Die Läufe holen sich seit 30.08. selbst ein, brauchen aber einen laufenden Prozess. Bei Spin-down: externer Cron-Ping oder Plan ohne Spin-down. |
| **Team die Sprechprobe machen lassen** | Telefon → „Sprechprobe" | Seit 31.08. einmalig erzwungen. Bei Nikita liegen 40 % der angenommenen Gespräche unter 5 Sekunden, bei Daniel 58 % — die Probe zeigt in fünf Sekunden, ob es am Mikrofon liegt. |
| **`{{params.termin_art}}` in Brevo** | Vorlagen `termin_bestaetigung`, `termin_erinnerung` | Das Feld fährt seit 30.08. mit (Onboarding / Vertrieb / Rückruf) und wird bis dahin übertragen, aber nicht angezeigt. |
| **Twilio einrichten** (6 Werte) | Einstellungen → Telefon | Ohne sie zeigt das Softphone einen Einrichtungs-Zustand. Alles andere ist gebaut. |
| **OpenAI-Schlüssel erneuern** | `OPENAI_API_KEY` | Der hinterlegte Schlüssel antwortet mit HTTP 401. Gesprächsblatt und Anruf-Zusammenfassung fallen deshalb auf Rohdaten zurück. |
| **Brevo-IP-Sperre ABSCHALTEN** | app.brevo.com/security/authorised_ips | Der echte Grund der fehlgeschlagenen Mails: `74.220.50.221` steht nicht auf der Liste. Diese Plattform bekommt bei jedem Neustart eine andere Adresse — eine Freigabeliste ist hier ein Fass ohne Boden. Diagnose → Ausgangsadressen zeigt alle gesehenen. |
| **Vergütung Inkasso bestätigen** | Team-Zentrale → Mitarbeiter → Vergütung | Platzhalter 15,00 €/h und 2,00 € je Rate. Bis zur Bestätigung wird keine Prämie gebucht. |
| **Twilio in Produktion prüfen** | `/admin/einstellungen` → Telefon | Lokal sind die sechs Werte nicht gesetzt, daher hier nicht messbar. Die Sperre „Testkonten können nicht telefonieren" ist aufgehoben. |
| **Space-Dichte prüfen** | Einstellung `space_dichte` | Vorgabe 20 Beiträge pro Tag. Weniger als 10 lässt den Feed leer wirken, mehr als 40 wird zur Tapete. |
| **Drei alte Pins lösen** | Space → angepinnte Beiträge | Sie stammen aus der Zeit vor der Zwei-Grenze. Die Grenze greift erst beim nächsten Anpinnen. |
| **Zweig-Ampel einmal laufen lassen** | Verwaltung → E-Mail-Events → „Alle Zweige prüfen" | Seit 27.08. läuft die Zuordnung über Plus-Adressen (`dev+welcome@…`) statt über den Betreff. Der `BREVO_API_KEY` liegt nur in Produktion — der echte Lauf ist dort nötig. Danach steht der Endstand. |
| **Prüfen, ob Plus-Adressen ankommen** | Postfach der Testadresse | Wenige Anbieter werfen sie weg. Dann wird die Ampel grün, während das Postfach leer bleibt — bitte melden, es gibt einen Rückfall. |
| **336 Einladungen zum Startgespräch** | Verwaltung → Termin-Zentrale → Karte unten | Bezahlte Kunden ohne Termin, die ältesten seit 04.07.2026, nie eingeladen. Gestaffelt über „alle einladen", höchstens 50 am Tag. |
| **Gespräch mit Nikita und Lucas** | Verwaltung → Termin-Zentrale → „Je Mitarbeiter" | Bei 50 vergangenen Terminen kein einziger als erledigt markiert (No-Show 64 % und 76 %), während zwei Kollegen 67 % und 78 % abschließen. Das klärt ein Gespräch, kein Programm. |
| **Academy ansehen und ans Team geben** | Verwaltung → FIAON Academy | Drei Reisen (13/16/10 Kapitel). Das Team sieht seine eigene unter „Mehr → Academy". Wer noch nicht angefangen hat, steht in der Team-Zentrale. |

---

## Was am 19.08.2026 dazugekommen ist

Zwei Meldungen, ein Bauplan: **Anzeige und Server beantworteten dieselbe Frage
mit verschiedenen Regeln.** Die Anzeige gibt frei, der Server lehnt ab — und der
Mensch dazwischen erlebt einen Knopf, der nichts tut.

| Was | Wo | Prüfstand |
|---|---|---|
| „Darf gesendet werden?" als **SQL**, für Liste und Karte | `lib/fiaon-massgebliche-bestellung.ts` → `sendeGrundSql` | `pruef-sendesperre-browser.ts` (36) |
| Empfänger: Bestellung zuerst, **Person als Rückfall** (+21 Kunden) | ebd. + `routes/fiaon-agent-kunden.ts` | ebd. |
| `pending_payment` ist rechnungsreif (+63 Kunden) | `lib/fiaon-rechnung-stellen.ts` | ebd. |
| Rollenprüfung beim Buchen kennt den **Rückfall** | `lib/fiaon-termine.ts` → `terminBuchen` | `pruef-startgespraech-buchen.ts` (26) |
| Terminseite liest `?art=start` | `pages/termin.tsx` | `pruef-terminseite-kunde.ts` (11) |
| Fehler überlebt das Nachladen, Lücken benannt | ebd. | ebd. |
| Aufgabe bei leerem Kalender (24 h, einmal je Tag) | `routes/fiaon-termin.ts` | `pruef-startgespraech-buchen.ts` |
| Karte „Kann das Team arbeiten?" | `GET /admin/hub/knopfdurchgang`, `pages/admin-hub.tsx` | — |

**Die Zahlen:** 139 Karten gaben bei Florentine den Knopf frei, während der
Server ablehnte — jetzt 0. Sendbar 154 → 245 (bestandsweit 911). Jens Hertel
hatte 38 protokollierte Buchungsversuche, alle mit `falsche_rolle`;
bestandsweit 220 von 222 Ablehnungen.

---

## Was am 30./31.08.2026 dazugekommen ist

| Was | Wo | Prüfstand |
|---|---|---|
| **Eine Auflösung „welche Bestellung gilt?"** | `lib/fiaon-massgebliche-bestellung.ts` | `pruef-massgebliche-bestellung.ts` (37) |
| Bestätigung vor dem Senden (ein Bauteil, drei Orte) | `components/agent/RechnungBestaetigung.tsx` | ebd. + Vorschau-Route |
| Filter „Nummer nicht wählbar" mit Inline-Korrektur | `pages/agent/kunden-neu.tsx`, `routes/fiaon-agent-kunden.ts` | `pruef-nummer-nachtrag.ts` (49) |
| **Eine** Tafel der Landesvorwahlen (war zweimal da) | `lib/fiaon-telefon.ts` → `LAND_VORWAHL` | ebd., Gruppe 6 |
| Telefon: Gerätewahl, Sprechprobe, Sperre bei stummem Mikro | `lib/fiaon-mikrofon.ts`, `components/Softphone.tsx` | `pruef-telefon-zustand.ts` (54), `pruef-telefon-bild.ts` (20) |
| Vier Anrufzustände, Uhr erst beim Abheben | `components/Softphone.tsx` | ebd. |
| Selbstüberwachung der Tagesläufe (Historie, Ampel, Warnmail) | `lib/fiaon-crons.ts`, Migration 064 | `pruef-lauf-ueberwachung.ts` (51) |
| Buchungsversuche protokolliert | Migration 062, `lib/fiaon-termine.ts` | `pruef-termin-versuche.ts` (35) |
| Termin-Art an einem Ort | `shared/fiaon-termin-art.ts` | — |
| Tagesgrenze je Rufnummer | Migration 063, `lib/fiaon-softphone.ts` | — |

---

## Arbeitsvorrat — was bewusst offen ist

| Was | Warum es liegt | Was zuerst passieren muss |
|---|---|---|
| **Kontaktspalten-DROP** (`email`, `phone`, `contact_email`, `billing_email`, `contact_phone`, `phone_country_code` an `fiaon_applications`; `email`/`telefon` an `fiaon_leads`) | 397 Zugriffe in 62 Dateien, und **110 Bestellungen** tragen eine ANDERE Adresse als die Person. Ein DROP wäre für diese 110 ein Hard-Delete. | Archivtabelle (Migration 061 liegt bereit), dann die 110 einzeln entscheiden, dann die lesenden Zugriffe auf die Person umstellen. `pruef-eine-quelle-wand.ts` verhindert bis dahin NEUE Zugriffe. |
| **Klingeldauer messen** | `fiaon_calls` hat keinen Zeitstempel für „angenommen", und Twilios `no-answer` und `busy` landen auf demselben Wert. Eine erfundene Klingeldauer würde die Reputationsfrage falsch beantworten. | Zusätzliches Feld beim Status-Rückruf mitschreiben, oder Twilios eigene Sicht (Console) daneben legen. |
| **Reputationsfrage der Rufnummer** | Die 7-Tage-Zahlen (55–64 % Annahme) sprechen GEGEN eine Spam-Markierung. Die Stumm-Marke läuft erst seit 31.08. | Drei Tage Daten sammeln, dann die Zeile je Mitarbeiter in der Team-Zentrale lesen. |
| **Slot-Reservierung bei der Terminbuchung** | Gemessen: `slotsVerknappen` läuft auch beim Buchen, Anzeige und Prüfung sehen dieselbe Liste. Der vermutete Fensterfehler existiert nicht. | Erst die Ablehngründe aus `fiaon_termin_versuche` lesen — sie sagen, ob überhaupt ein Problem besteht. |

---

## Das Doppel-Datenmodell — der Stand der Amputation

Die Spalten `email`, `phone`, `contact_email`, `billing_email`, `contact_phone`,
`phone_country_code` an `fiaon_applications` und `email`/`telefon` an
`fiaon_leads` sind seit **Migration 059** (20.08.2026) **Abschriften**: Ein
Trigger schreibt jeden Wert an die Person durch. Die gültige Wahrheit steht an
`fiaon_persons`.

**Sie sind noch nicht gelöscht.** Stand 28.08.2026:

| | |
|---|---:|
| Zugriffe insgesamt | **397** in 62 Dateien |
| davon schreibend (die vier reinen Abschriften-Spalten) | **16** |
| Bestellungen mit **abweichender** Adresse zur Person | **110** |

Die 110 sind der Grund für das Archiv: Sie weichen ab, weil sie *vor* dem
Trigger geschrieben und danach nie angefasst wurden. Ein DROP ohne Sicherung
wäre für die ein Hard-Delete.

**Was gebaut ist:**

- `db/migrations/061_kontaktspalten_archiv.sql` — sichert **7.544** Bestellungen
  und **3.841** Leads in `*_kontakt_archiv`. Sie **droppt nichts**; die
  DROP-Anweisung steht als Kommentar darin, mit der Bedingung.
- `scripts/pruef-eine-quelle-wand.ts` — hält die Zahlen fest
  (`reports/eine-quelle-grenzen.json`). Wer eine **neue** schreibende Stelle
  einbaut, bekommt einen roten Prüfstand. Der Bestand ist geduldet, das
  Wachstum nicht. Eine Wand, die 397 Fehler meldet, wird abgeschaltet — deshalb
  Obergrenze statt Verbot.
- `scripts/run-migrations.mjs` verweigert jetzt auch **`DROP COLUMN`** (bisher
  nur DROP TABLE / DROP DATABASE / TRUNCATE). Eine gelöschte Spalte ist genauso
  endgültig, nur unauffälliger: Der Deploy läuft durch, und der Fehler zeigt
  sich erst beim nächsten Antrag.

**Die Reihenfolge bis zum DROP:**

1. ✅ Archiv angelegt und gefüllt
2. ⬜ Die **16 schreibenden** Stellen auf die Personen-Funktionen umziehen
   (`server/routes/fiaon-antrag.ts` hat 11 davon)
3. ⬜ Die lesenden Stellen nachziehen
4. ⬜ Wand meldet 0 → **dann** Migration 062 mit dem DROP

Schritt 2 und 3 sind mehrtägige Arbeit. **Ein halber Umzug ist der schlechteste
Zustand:** Die umgezogenen Stellen schreiben an die Person, die anderen in die
Spalte, und niemand weiß mehr, welcher Wert gilt. Genau diese Lage hat
Migration 059 beendet.

---

## Die Bereiche

### Verwaltung (`/admin`, Code-Gate)

| Seite | Adresse | Was sie kann |
|---|---|---|
| **Kunden-Zentrale** | `/admin/kunden` | Die eine Kundenliste. Suche über Namen, Referenzen und alte Adressen, Rufnummern mit und ohne Leerzeichen. Schnell-Chips für Stufen, alle weiteren Filter im Dropdown, aktive als entfernbare Chips. Filter stehen in der Adresse und sind teilbar. Massenauswahl über Seitengrenzen, Massenaktionen, CSV. |
| **Kundenakte** | `/admin/kunde/:ref` | Stammdaten, Zahlungen, **Dokumente**, **Anrufe**, E-Mail-Center, Dubletten, Verlauf. |
| **Team-Zentrale** | `/admin/team` | Reiter: Menschen · Neu im Team · Partner-Anfragen · Meilenstein-Prämien · Skripte · Einstellungen. Im Mitarbeiter-Detail: Zahlen, Verwaltung, Provisionen, Vergütung & Stunden, Protokoll. |
| **Mail-Zentrale** | `/admin/mail-zentrale` | Freitext an Kunden und Gruppen, bis 5.000 Empfänger. Gleiche Oberfläche wie die Team-Fassung, ohne deren 10er-Grenze. |
| **E-Mail-Events** | `/admin/events` | Jeder Zweig der Registry, einzeln oder **alle auf einmal** prüfbar. Brevo-Fehler erscheinen als Anleitung, nicht als JSON. |
| **Lead-Automatik** | `/admin/lead-automatik` | Nachfass-Maschine: Sendefenster, Bulk-Versand, Verteilung, Import. |
| Zahlungen, Kontoabgleich, Verbuchung, Auszahlungen, Buchhaltung, Rechnungen | `/admin/…` | unverändert |

**Umgezogen** — diese Adressen leiten automatisch weiter:

| alt | neu |
|---|---|
| `/admin/database` | Kunden-Zentrale, Filter „KYC zu prüfen" |
| `/admin/personen` | Kunden-Zentrale, Filter „Dubletten-Verdacht" |
| `/admin/leads` | Kunden-Zentrale, Stufe C |
| `/admin/kuendigungen` | Kunden-Zentrale, Filter „Kündigungen" |
| `/admin/kartei` | Kunden-Zentrale (Kartei seit 03.08. stillgelegt) |
| `/admin/nachbuchung` | Team-Zentrale → Mitarbeiter → Provisionen |
| `/admin/leistung` | Team-Zentrale, Rangliste |
| `/admin/team-alt` | Team-Zentrale |

### Team-Portal (`/agent`, Agent-Anmeldung)

| Seite | Adresse | Wer |
|---|---|---|
| **Space** | `/agent/space` | alle — **die Startseite nach dem Login** |
| Start | `/agent/start` | alle — Zahlen, Termine, erste Schritte |
| Kunden | `/agent/kunden` | Vertrieb, Leitung |
| Gesamtsicht | `/agent/vertrieb` | nur Vertriebsleitung |
| Startgespräche | `/agent/startgespraeche` | nur Onboarding |
| **Forderungsmanagement** | `/agent/inkasso` | nur Inkasso |
| Mail-Zentrale | `/agent/mail-zentrale` | alle, bis 10 Empfänger |
| Verdienst, Kalender, Aufgaben, Profil | `/agent/…` | alle |

---

## Die sieben Pakete

### 1 · Mail-Wahrheit (09.08.)
Registry mit 29 Ereignissen, ereignisgesteuerter Versand über `mailSenden`, Mail-Zentrale, gemessene Zustellung über Brevo statt behaupteter.
`server/lib/fiaon-mail-senden.ts`, `fiaon-zustellung.ts`, `fiaon-zentrale.ts`

### 2 · Zentralen (09.08.)
734 Stufe-B-Kunden ohne Zuständigen verteilt. Sechs Kundenseiten zur Kunden-Zentrale zusammengelegt, Team-Zentrale gebaut. Löschen sauber getrennt: endgültig (kein Zahlungsbezug) vs. anonymisiert (§ 147 AO).
`server/lib/fiaon-kundenzentrale.ts`, `fiaon-loeschen.ts`, `server/routes/fiaon-zentralen.ts`

### 3 · Dokumente, Telefon, Gesprächsblatt (10.08.)
**Sicherheitslücke geschlossen:** KYC-Dokumente waren ohne Anmeldung abrufbar. Jetzt signierte 15-Minuten-Links; die Grenze aus der Verpflichtungserklärung steht im Code. Softphone (Twilio, nur ausgehend, DACH-Sperre, 60-Minuten-Deckel), Gesprächsblatt mit kuratierten Einwand-Bausteinen.
`server/lib/fiaon-dokumente.ts`, `fiaon-softphone.ts`, `fiaon-transkript.ts`, `fiaon-gespraechsblatt.ts`

### 4 · Inkasso und Einarbeitung (10.08.)
Rolle `inkasso` mit eigener Verpflichtungserklärung. Sichtfeld hart auf bezahlte Kunden mit laufender Ratenzahlung. Erlass, Stundung und Storno existieren im Bereich **nicht**. Vergütung: Stundensatz plus Prämie je eingezogener Rate. Geführte erste Schritte je Rolle.
`server/lib/fiaon-inkasso.ts`, `server/routes/fiaon-inkasso-bereich.ts`, `shared/fiaon-onboarding-schritte.ts`

### 6 · Space-Content und Aktenverwaltung (11.08.)
**Der Feed lebt.** 1.293 Beiträge, davon 84 aus echten Abschlussdaten der letzten 60 Tage. Die Content-Engine setzt täglich 20 Beiträge (einstellbar 5–100), verteilt zwischen 07:00 und 19:00 mit mindestens 20 Minuten Abstand. Ereignis-Posts (Abschluss, Rangliste, Wochenrückblick, Meilenstein, Rekord) kommen on top und entstehen im jeweiligen Geschäftsvorgang. Dazu: Akten-Chips statt Kundendaten im Freitext, Pin-Grenze von zwei mit Verdrängungsfrage, Bild-Upload mit Verkleinerung im Browser, unendliches Scrollen, „Neue Beiträge"-Pille. In der Akte lassen sich Bestellungen einzeln und in Auswahl entfernen — unbezahlte endgültig, bezahlte nur archiviert.
`server/lib/fiaon-space-engine.ts`, `scripts/space-seed.ts`

### 5 · Feinschliff und Design (11.08.)
Sechs gemeldete Bugs behoben. **FiaonEbene**: ein Bauteil für jeden Dialog — Glas-Schleier statt schwarzem Vorhang, Eintritt aus der Tiefe, Bottom-Sheet mit Wischen auf 380 px. Filter als Dropdown mit Chips. Space als Feed mit Seitenkomposition und Startseite nach dem Login.
`client/src/components/FiaonEbene.tsx`, `FiaonFilter.tsx`, `client/src/pages/agent/space.tsx`

---

## Regeln, die im Code stehen

Diese sind nicht verhandelbar und durch Prüfstände abgesichert:

- **Keine Hard-Deletes.** Überall `archived_at`, `merged_into_person_id`, `entfernt_am`, `widerrufen_am`.
- **Bezahlte Kunden werden anonymisiert, nie gelöscht** — § 147 AO, zehn Jahre.
- **Kundendokumente öffnet nur der Betreiber.** Leitung und Team sehen, *dass* etwas vorliegt.
- **Kein Anruf ohne Ergebnis.** Solange eines fehlt, steht eine Marke am Telefon-Knopf.
- **Keine Kundendaten im Space.** Rufnummern, IBANs und Adressen werden abgewiesen.
- **Nur DACH-Vorwahlen**, höchstens 60 Minuten je Gespräch, jede Wahl protokolliert.
- **Bestätigte Stunden sind unveränderlich** — auch für den Betreiber.
- **Attrappen** (`is_test_account`) bekommen keine erhöhte Rolle und können nicht telefonieren.
- **Das Prüfkonto** (`pruefkonto`, office@schwarzott-global.com) darf alles, was Menschen betrifft —
  bekommt aber weiterhin keine automatisch verteilten Kunden, Termine oder Mails.
- **Ereignis-Posts nennen nie Kundendaten** — nur Vornamen des Teams und Zahlen.
- **Bezahlte Bestellungen werden archiviert, nie endgültig gelöscht.**
- **Fehlergründe stehen in der Meldung**, nie als Verweis auf ein Protokoll.
- **Festgehälter sieht nur der Betreiber** — sie tauchen in keiner Team-Antwort auf.
- **Eine Ansichts-Sitzung kann nichts schreiben** — geprüft an allen registrierten Routen.
- **Rollen ändert man nur über /admin/team** — jede Änderung wird protokolliert.

---

## Prüfstände

```
npx tsx scripts/pruef-veredelung.ts      141   Fehlergründe, Mail, Space v3, Ansicht, Gehalt
npx tsx scripts/pruef-feinschliff.ts     236   Bugs, Ebenen, Space, Engine, Akte, Prüfkonto
npx tsx scripts/pruef-inkasso.ts         174   Rolle, Sichtfeld, Prämien, Stunden
npx tsx scripts/pruef-telefon.ts         128   Dokumente, Softphone, Gesprächsblatt
npx tsx scripts/pruef-zentralen.ts        90   Filter, Löschen, Team
npx tsx scripts/pruef-mail.ts            136   Registry, Versand, Zustellung
npx tsx scripts/pruef-menschen.ts        156   Rollen, Zusagen, Onboarding
npx tsx scripts/pruef-pipeline.ts        142   Termine, Verfügbarkeit, Automatik
npx tsx scripts/pruef-merge.ts           107   Zusammenführen
npx tsx scripts/pruef-massen-merge.ts     84   Massen-Zusammenführung
npx tsx scripts/pruef-fundament-b.ts      93   Fundament
npx tsx scripts/pruef-schmal.ts           25   380-px-Ansicht
npx tsx scripts/pruef-academy.ts          91   Academy: Kapitel, Registry-Abgleich, Kontrast
npx tsx scripts/schau-academy.ts          33   Academy im Browser (Vollbild, 380 px)
npx tsx scripts/pruef-vollpfleger.ts      50   Kunden anlegen, Produkt, die vier Wände
npx tsx scripts/schau-termine.ts          13   Termin-Zentrale mit echten Zahlen
npx tsx scripts/pruef-geduld.ts           34   Zweig-Ampel: Polling, Plus-Adressen
npx tsx scripts/pruef-reste.ts            37   Wartezustand, Notizpflicht, Nachlauf
npx tsx scripts/pruef-eine-quelle-wand.ts  6   Kontakt-Spalten: keine NEUEN Zugriffe

# ── Neu, 30./31.08.2026 ───────────────────────────────────────────────────
npx tsx scripts/pruef-startgespraech-buchen.ts 26  Angebotene Zeit ist auch buchbar
npx tsx scripts/pruef-sendesperre-browser.ts   36  Browser: Rechnungsknopf an echten Kunden
npx tsx scripts/pruef-terminseite-kunde.ts     11  Browser: Kundensicht, Desktop + 380 px
npx tsx scripts/pruef-massgebliche-bestellung.ts 37  Rechnung traegt das richtige Paket
npx tsx scripts/pruef-nummer-nachtrag.ts     49   Nummer nicht waehlbar: Sperre, Weg heraus, eine Tafel
npx tsx scripts/pruef-telefon-zustand.ts     54   Zustandsfolge, Uhr, Nummernwahl
npx tsx scripts/pruef-telefon-bild.ts        20   Browser: Sperre, Geraetewahl, SDK-Beweis
npx tsx scripts/pruef-lauf-ueberwachung.ts   51   Tageslauf-Historie, Ampel, Nachholen
npx tsx scripts/pruef-termin-versuche.ts     35   Buchungsversuche protokolliert
npx tsx scripts/pruef-stufen-waechter.ts      7   TAEGLICH: Einstufung und Tageslauf
npx tsx scripts/pruef-inkasso-nummer.ts      40   Inkasso: eine Zustaendigkeit, Blockier-Marke
npx tsx scripts/pruef-nicht-erschienen.ts    14   „Nicht erschienen" haengt nicht mehr
npx tsx scripts/pruef-zuteilung-rollen.ts    21   Zuteilung achtet die Rolle
npx tsx scripts/pruef-karte-buchungen.ts     10   Karte traegt frische Buchungen
```

### Messläufe (nur lesend, für den Bestand)

```
npx tsx scripts/mess-sendesperre.ts               Warum geht keine Rechnung raus? (je Grund)
npx tsx scripts/mess-slots.ts                     Buchungsversuche + freie Zeiten je Tag
npx tsx scripts/mess-falsches-paket.ts            Welche Bestellung landet in der Mail?
npx tsx scripts/mess-stumme-anrufe.ts             Stumme Anrufe, Nummern-Abweichungen
npx tsx scripts/mess-tageslaeufe.ts               Welcher Tageslauf steht, was blieb liegen?
npx tsx scripts/tageslauf-nachholen.ts            Nachholen (Vorschau, dann --schreiben)
```

### Die neueren Bereiche und wo sie liegen

| Was | Oberfläche | Server | Prüfstand |
|---|---|---|---|
| Termin-Zentrale | `pages/admin-termine.tsx` | `routes/fiaon-termin-zentrale.ts` | `schau-termine.ts` |
| FIAON Academy (Verwaltung) | `pages/admin-schulung.tsx` | — (Daten in `shared/fiaon-academy.ts`) | `pruef-academy.ts`, `schau-academy.ts` |
| FIAON Academy (Team) | `pages/agent/academy.tsx` | `routes/fiaon-academy.ts` | `pruef-academy.ts` |
| Kunden anlegen (Vollpfleger) | `components/agent/KundeAnlegen.tsx` | `routes/fiaon-agent-anlage.ts` | `pruef-vollpfleger.ts` |
| Wartezustand | — | `lib/fiaon-warten.ts` | `pruef-reste.ts` |
| Zweig-Ampel | `pages/admin-events.tsx` | `lib/fiaon-zustellung.ts` | `pruef-geduld.ts` |

### Zwei Fundorte, die schon in die Irre geführt haben

- **`/agent/kunden` zeigt `pages/agent/kunden-neu.tsx`**, nicht `kunden.tsx`.
  Die alte Datei ist am 28.08.2026 **entfernt**; die Adresse
  `/agent/meine-kunden-alt` leitet auf `/agent/kunden` um. Am 25.08. wurden ein
  Knopf und eine Notizpflicht in die falsche Datei gebaut — erst ein Screenshot
  verriet es.
- **`team-calendar.tsx` (3.870 Zeilen) wird in keiner Seite eingebunden**, und
  die Tabelle `team_calendar` dahinter hat 0 Einträge. Die echten Termine liegen
  in `fiaon_termine`. Vor jeder Arbeit daran: `grep` auf den Komponentennamen.

### Läufe, die NICHT im Tageslauf stehen

- **`scripts/datenkosmetik-lauf.ts`** (Leerraum in Paketnamen und Namen). Er
  läuft nicht automatisch — und findet auch nichts mehr: **0 von 11.578**
  geprüften Feldern brauchen eine Reinigung (gemessen 28.08.2026). Der Leerraum
  entstand an Formulareingaben, und dort wird jetzt getrimmt. Ein Tageslauf, der
  11.578 Zeilen prüft und 0 findet, wäre tägliche Arbeit ohne Ergebnis; er
  bleibt als Werkzeug für den Fall, dass wieder etwas anfällt.
- **`scripts/warten-bestand.ts`** ist dagegen in den Tageslauf gewandert
  (`nummernAnfragenNachtragen`, 27.08.2026): Er hatte am 24.08. sieben Fälle
  nachgetragen, und drei Tage später standen zwei wieder da.

**1.556 Prüfungen.** Alle laufen gegen die Produktionsdatenbank in einer
Transaktion, die am Ende zurückgerollt wird — es bleibt nichts stehen.
