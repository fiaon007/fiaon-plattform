# Betreiber-TODO — Make-Zweige & Brevo-Templates

FIAON verschickt **keine E-Mails selbst**. Für jedes E-Mail-Ereignis feuert die
Plattform einen Webhook an Make.com (`MAKE_WEBHOOK_URL`); dort entscheidet ein
Zweig anhand von `event_type`, welches Brevo-Template mit welchen Platzhaltern
rausgeht. Neue Events müssen daher in Make **einmal** eingerichtet werden.

Test ohne echten Empfänger: **`/admin/events`** (Event-Test-Konsole) sendet die
Beispiel-Payload an deine Test-Adresse — so lernt Make die Struktur, bevor der
echte Workflow existiert.

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
