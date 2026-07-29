# FIAON — Änderungsprotokoll (Klartext)

Jede Änderung am System bekommt hier einen Eintrag im selben Commit:
**Datum · Was geändert · Warum · Wo zu finden.** Verständlich für Nicht-Entwickler.

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
