# Betreiber-TODO — Make-Zweige & Brevo-Templates

FIAON verschickt **keine E-Mails selbst**. Für jedes E-Mail-Ereignis feuert die
Plattform einen Webhook an Make.com (`MAKE_WEBHOOK_URL`); dort entscheidet ein
Zweig anhand von `event_type`, welches Brevo-Template mit welchen Platzhaltern
rausgeht. Neue Events müssen daher in Make **einmal** eingerichtet werden.

Test ohne echten Empfänger: **`/admin/events`** (Event-Test-Konsole) sendet die
Beispiel-Payload an deine Test-Adresse — so lernt Make die Struktur, bevor der
echte Workflow existiert.

---

## NEU (04.08.2026): `abo_payment_reminder` — monatliche Paketrate

**Wann:** Für jede offene Abo-Rate. Die Rate ist **30 Tage nach dem Tag fällig,
an dem die Zahlung als bezahlt gebucht wurde**, danach im gleichen Abstand.
Versendet wird in drei Stufen:

| Stufe | Zeitpunkt | Gedanke |
| --- | --- | --- |
| 1 | am Fälligkeitstag | freundliche Erinnerung |
| 2 | 7 Tage nach Fälligkeit | zweite Erinnerung |
| 3 | 14 Tage nach Fälligkeit | letzte Erinnerung |

Danach geht **keine weitere Mail** raus; der Fall erscheint in der
Zahlungszentrale als „Entscheidung nötig". Es wird **nie** automatisch ein Konto
gesperrt. Versand nur zwischen **08 und 20 Uhr Berliner Zeit**, höchstens **eine
Mail je Rate pro 20 Stunden**. Der Bonitäts-Check (74 €) ist ein Einmalkauf und
löst dieses Event **nie** aus.

**Payload — alle Felder, die in der Mail gebraucht werden:**

| Feld | Beispiel | Bedeutung |
| --- | --- | --- |
| `event_type` | `abo_payment_reminder` | Zweig-Auswahl in Make |
| `email` | `max.mustermann@example.com` | Empfänger |
| `vorname` / `nachname` | `Max` / `Mustermann` | Anrede |
| `antrag_id` | `FIAON-MB2XK4LQ-7T9A` | interne Bestellreferenz |
| `payment_reference` | `FIAON-A1B2C3-2` | **Verwendungszweck der Rate** (Bestellreferenz + Ratennummer) |
| `verwendungszweck` | `FIAON-A1B2C3-2` | derselbe Wert, sprechend benannt |
| `betrag` | `59.99` | Ratenbetrag in Euro (Punkt als Dezimaltrenner) |
| `paket` | `FIAON Pro (Standard)` | gebuchtes Paket |
| `rate_nr` | `2` | Nummer der Rate (1 = Startzahlung) |
| `faellig_am` | `2026-09-03` | Fälligkeit technisch (ISO) |
| `faellig_am_text` | `03.09.2026` | Fälligkeit für die Mail |
| `tage_ueberfaellig` | `0` | 0 = heute fällig, sonst Tage seit Fälligkeit |
| `mahnstufe` | `1` | 1, 2 oder 3 |
| `mahnstufe_text` | `Freundliche Erinnerung — heute ist Ihre Monatsrate fällig.` | fertiger Satz je Stufe |
| `empfaenger` | `Fiaon Ltd` | Kontoinhaber |
| `iban` | `BE09 9058 9276 3957` | IBAN |
| `bic` | `TRWIBEB1XXX` | BIC |
| `portal_url` | `https://www.fiaon.com/login` | Login-Link fürs Kundenportal |

**In Make + Brevo anlegen:**

1. Brevo-Template „Abo-Rate fällig" anlegen. Pflicht-Platzhalter:
   `{{ params.vorname }}`, `{{ params.betrag }}`, `{{ params.faellig_am_text }}`,
   `{{ params.verwendungszweck }}`, `{{ params.empfaenger }}`, `{{ params.iban }}`,
   `{{ params.bic }}`, `{{ params.mahnstufe_text }}`, `{{ params.portal_url }}`.
   **Der Verwendungszweck muss im Text stehen** — ohne ihn kann die Überweisung
   nicht zugeordnet werden.
2. Im Make-Szenario einen Zweig mit Filter `event_type = abo_payment_reminder`
   anlegen und auf das Template mappen.
3. Vorher testen: `/admin/events` → Event `abo_payment_reminder` → an die
   Test-Adresse senden.

**Bis der Make-Zweig steht, passiert nichts Schädliches:** Die Plattform feuert
den Webhook, Make kennt den Typ nicht und verwirft ihn — es geht nur keine Mail
raus. Fälligkeiten und Mahnstufen laufen trotzdem korrekt mit.

**Bedienung (ohne Make):** In der Zahlungszentrale → Abo-Tafel kann jede Rate
einzeln erinnert und als bezahlt gebucht werden; „bezahlt" erzeugt automatisch
die nächste Fälligkeit.

---

## NEU (Prompt „E-Mail-Inventur"): `number_update_request` — kundenfertig

**Wann:** Ein Mitarbeiter wählt beim Kunden/Lead das Kontakt-Ergebnis
**„Falsche Nummer"** und es ist eine E-Mail hinterlegt. Es geht **max. 1× pro Tag
pro Person** ein Webhook raus.

**Zweck:** Der Kunde bekommt einen Button „Telefonnummer aktualisieren" zu einer
schlanken, signierten Seite (`/nummer-aktualisieren`). Trägt er die Nummer ein,
landet sie sofort im Datensatz und der Lead/Kunde wird wieder anrufbar.

**Payload:**

| Feld | Beispiel | Bedeutung |
| --- | --- | --- |
| `event_type` | `number_update_request` | Zweig-Auswahl in Make |
| `email` | `interessent@example.com` | Empfänger (Kunde/Lead) |
| `vorname` | `Lena` | Anrede |
| `update_url` | `https://www.fiaon.com/nummer-aktualisieren?token=…` | signierter Button-Link (14 Tage gültig) |
| `antrag_id` / `lead_id` | `FIAON-…` / `1234` | Kontext (je nach Quelle) |

**In Make + Brevo anlegen:**

1. Brevo-Template aus `docs/brevo-templates/number_update_request.html` anlegen
   (Design ist FIAON-CI, Sie-Form). Platzhalter: `{{ params.vorname }}`,
   `{{ params.update_url }}`. **Template-ID notieren.**
2. Im Make-Szenario den bestehenden Zweig **klonen**, Filter auf
   `event_type = number_update_request` setzen.
3. Brevo „Send a transactional email": Template-ID eintragen, `to = {{email}}`,
   Params `vorname` und `update_url` durchreichen.
4. Betreff-Vorschlag: **„Wir haben versucht, Sie zu erreichen"**.
5. Test über `/admin/events` → Event „Telefonnummer aktualisieren" → Test an die
   eigene Adresse; Link öffnen, Nummer testweise ändern.

---

## NEU (Prompt 2/3): `agent_feedback_reply`

**Wann:** Der Betreiber antwortet im Feedback-Thread eines Mitarbeiters
(`/admin` → „Agent-Updates & Feedback" → Ticket → Antworten).

**Zweck:** Der Agent bekommt eine Mail, dass es eine neue Antwort gibt, und
antwortet im selben Ticket weiter (kein neues Ticket).

**Payload:**

| Feld | Beispiel | Bedeutung |
| --- | --- | --- |
| `event_type` | `agent_feedback_reply` | Zweig-Auswahl in Make |
| `email` | `anna.schmidt@example.com` | Empfänger (Agent) |
| `vorname` | `Anna` | Anrede |
| `feedback_id` | `11` | Ticketnummer |
| `feedback_titel` | `Kalender: Wochenansicht …` | Betreff-Kontext |
| `antwort` | `Danke für den Hinweis …` | gekürzter Antworttext (max. 500 Z.) |
| `portal_url` | `https://www.fiaon.com/agent/feedback` | Link „Antwort ansehen" |

**In Make anzulegen:**

1. Neuen Router-Zweig: `event_type = agent_feedback_reply`.
2. Brevo-Template „Neue Antwort auf dein Feedback" mit Platzhaltern
   `{{vorname}}`, `{{feedback_titel}}`, `{{antwort}}`, Button → `{{portal_url}}`.
3. Empfänger = `{{email}}`.
4. Test über `/admin/events` → Event „Antwort auf Feedback-Ticket".

---

## Noch offen (bereits im Code, Zweig/Template prüfen)

| Event | Wann | Status |
| --- | --- | --- |
| `agent_feedback_rewarded` | Feedback-Bonus gutgeschrieben | Zweig + Template anlegen |
| `lead_followup` | automatisierter Lead-Nachfass | Zweig + Template (+ ggf. WhatsApp) |
| `lead_application_link` | Mitarbeiter schickt Antrags-Link an Lead | Zweig + Template |

Die vollständige, im Code gepflegte Liste aller Events mit Beispiel-Payloads:
`server/make-events-registry.ts` (Quelle für `/admin/events`).
