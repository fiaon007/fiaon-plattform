# Betreiber-TODO — Make-Zweige & Brevo-Templates

FIAON verschickt **keine E-Mails selbst**. Für jedes E-Mail-Ereignis feuert die
Plattform einen Webhook an Make.com (`MAKE_WEBHOOK_URL`); dort entscheidet ein
Zweig anhand von `event_type`, welches Brevo-Template mit welchen Platzhaltern
rausgeht. Neue Events müssen daher in Make **einmal** eingerichtet werden.

Test ohne echten Empfänger: **`/admin/events`** (Event-Test-Konsole) sendet die
Beispiel-Payload an deine Test-Adresse — so lernt Make die Struktur, bevor der
echte Workflow existiert.

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
