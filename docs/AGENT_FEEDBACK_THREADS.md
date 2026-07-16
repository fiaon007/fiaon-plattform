# Agent-Feedback als Konversation (Prompt 2/3)

Aus jedem Feedback-**Ticket** wird ein **Thread**: Betreiber und Agent schreiben
abwechselnd im selben Ticket, chronologisch, mit Autor + Zeitstempel (deutsche
Geschäftszeit `Europe/Berlin`, wie T13). Kein neues Ticket mehr für eine Antwort.

---

## Datenmodell

**`fiaon_agent_feedback`** (unverändert) = das Ticket (Titel, Kategorie, Status,
Screenshot, Bonus). Neue Spalten:

- `duplicate_of INTEGER` — Verknüpfung „gehört zu #X" (kein Schließen/Löschen).
- `agent_last_read_at TIMESTAMPTZ` — Gelesen-Zeitpunkt des Agenten (Ungelesen-Logik).

**`fiaon_agent_feedback_messages`** (neu) = der Verlauf:

| Spalte | Bedeutung |
| --- | --- |
| `feedback_id` | Ticket |
| `author` | `agent` \| `admin` \| `system` |
| `body` | Freitext (agent/admin) bzw. Klartext des Ereignisses (system) |
| `event` | system: `status` \| `duplicate` \| `reward` |
| `meta` | system: JSON-Detail, z. B. `{"status":"umgesetzt"}` |
| `created_at` | Zeitstempel |

## Migration (idempotent, nichts geht verloren)

Beim ersten Start (`ensurePortalTables`) wird pro Ticket **ohne Verlauf**:

1. die bisherige `description` als **erster Agent-Eintrag** übernommen,
2. ein vorhandener `admin_comment` als **erste Betreiber-Antwort**.

Läuft nur, wo noch keine Nachricht existiert → mehrfaches Starten ist gefahrlos.
Der Bestand (16 Tickets) wird so automatisch zu Threads.

## „Wartet auf Antwort" / „Ungelesen"

- **Betreiber-Badge** (`/admin/hub/badges` → `feedback`): zählt Tickets, deren
  **jüngster echter Beitrag** (agent/admin) vom **Agenten** stammt — also die,
  die auf eine Antwort des Betreibers warten. Nicht mehr „alle offenen".
- **Agent-Badge** (Nav „Mehr", `/agent/feedback/state`): Anzahl Tickets mit
  Admin-/System-Nachrichten **neuer** als `agent_last_read_at`. Öffnen eines
  Threads setzt `agent_last_read_at = NOW()` und aktualisiert das Badge.

## Endpunkte

**Agent**
- `GET /agent/feedback` — Tickets inkl. `messages[]`, `unread`, `duplicate_of`.
- `GET /agent/feedback/state` — `{ unread }` fürs Nav-Badge.
- `POST /agent/feedback` — neues Ticket (erste Nachricht wird mit angelegt).
- `POST /agent/feedback/:id/reply` — Antwort im Thread (kein neues Ticket).
- `POST /agent/feedback/:id/read` — Thread als gelesen markieren.

**Betreiber (Admin)**
- `GET /admin/agent-feedback` — Tickets inkl. `messages[]`, `awaiting_reply`, `awaitingCount` (wartende zuerst).
- `POST /admin/agent-feedback/:id/reply` — Antwort im Thread **+ Make-Mail** `agent_feedback_reply`.
- `PATCH /admin/agent-feedback/:id` — Statuswechsel → System-Eintrag „Status auf … gesetzt".
- `POST /admin/agent-feedback/:id/duplicate` — `duplicateOf` setzen/entfernen → System-Eintrag.
- `POST /admin/agent-feedback/:id/reward` — Bonus (unverändert) + System-Eintrag.

## Benachrichtigung

Betreiber-Antwort feuert `sendMakeWebhook("agent_feedback_reply", …)`. Zweig +
Brevo-Template: siehe `docs/BETREIBER_TODO_MAKE.md`. Fehlt `MAKE_WEBHOOK_URL`
oder der Zweig, blockiert das **nichts** — die Antwort steht trotzdem im Thread.

## Bonus-Logik

Unverändert: eine einmalige Gutschrift pro Ticket (`kind='feedback_bonus'`,
`reward_commission_id`), fließt ins normale Guthaben. Zusätzlich als System-
Ereignis im Verlauf sichtbar.

## Abnahme-Test

1. Betreiber antwortet auf ein Ticket → Eintrag erscheint im Thread; Make-Event
   `agent_feedback_reply` wird ausgelöst (Log/`/admin/events`).
2. Agent sieht die Antwort (Nav-Badge + Punkt am Ticket) und öffnet den Thread.
3. Agent antwortet im selben Ticket → **kein neues Ticket**; Betreiber-Badge
   „wartet auf Antwort" zählt das Ticket wieder.
4. Bestehende 16 Tickets erscheinen als Threads mit ihrem alten Text als erstem
   Eintrag — nichts fehlt.
