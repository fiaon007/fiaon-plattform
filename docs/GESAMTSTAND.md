# FIAON — Gesamtstand

Die eine Seite, auf der steht, **was existiert und wo**. Stand: 11.08.2026.

Wer wissen will, *warum* etwas so gebaut ist, liest die `CHANGELOG.md`. Wer
wissen will, *wo* etwas liegt, liest hier.

---

## Was der Betreiber noch tun muss

| Was | Wo | Warum es wartet |
|---|---|---|
| **Twilio einrichten** (6 Werte) | Einstellungen → Telefon | Ohne sie zeigt das Softphone einen Einrichtungs-Zustand. Alles andere ist gebaut. |
| **OpenAI-Schlüssel erneuern** | `OPENAI_API_KEY` | Der hinterlegte Schlüssel antwortet mit HTTP 401. Gesprächsblatt und Anruf-Zusammenfassung fallen deshalb auf Rohdaten zurück. |
| **Brevo-IP-Sperre ABSCHALTEN** | app.brevo.com/security/authorised_ips | Der echte Grund der fehlgeschlagenen Mails: `74.220.50.221` steht nicht auf der Liste. Diese Plattform bekommt bei jedem Neustart eine andere Adresse — eine Freigabeliste ist hier ein Fass ohne Boden. Diagnose → Ausgangsadressen zeigt alle gesehenen. |
| **Vergütung Inkasso bestätigen** | Team-Zentrale → Mitarbeiter → Vergütung | Platzhalter 15,00 €/h und 2,00 € je Rate. Bis zur Bestätigung wird keine Prämie gebucht. |
| **Twilio in Produktion prüfen** | `/admin/einstellungen` → Telefon | Lokal sind die sechs Werte nicht gesetzt, daher hier nicht messbar. Die Sperre „Testkonten können nicht telefonieren" ist aufgehoben. |
| **Space-Dichte prüfen** | Einstellung `space_dichte` | Vorgabe 20 Beiträge pro Tag. Weniger als 10 lässt den Feed leer wirken, mehr als 40 wird zur Tapete. |
| **Drei alte Pins lösen** | Space → angepinnte Beiträge | Sie stammen aus der Zeit vor der Zwei-Grenze. Die Grenze greift erst beim nächsten Anpinnen. |

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
```

**1.556 Prüfungen.** Alle laufen gegen die Produktionsdatenbank in einer
Transaktion, die am Ende zurückgerollt wird — es bleibt nichts stehen.
