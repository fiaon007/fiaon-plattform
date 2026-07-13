# LEAD_FINANCE_AUDIT — Phase 0 (Bestandsaufnahme vor Code)

Grundlage für das Update „Lead-Management-System + Finanz- & Sales-Analytics-Zentrale".
Alle Angaben sind aus dem Ist-Code verifiziert (Datei:Zeile). Nichts hier Genanntes wird verändert,
sondern nur **additiv** erweitert.

---

## 1. Technischer Rahmen

- **DB-Zugriff:** `postgres` (postgres.js). Jede Route-Datei hält einen eigenen Pool
  `const sqlPool = postgres(process.env.DATABASE_URL!, { ssl: "require", max: … })`
  (`server/routes/fiaon-antrag.ts:40`, `server/routes/fiaon-agent.ts:26`). Zusätzlich Drizzle
  `db` aus `server/db.ts`, Schema `@shared/schema`.
- **Router-Mounting** (`server/routes.ts:216–239`): ALLE FIAON-Router hängen unter `/api/fiaon`.
  Reihenfolge: `fiaon-agent` (+ `blockAgentsFromAdmin`) → `fiaon-agent-portal` → `fiaon-team`
  → `fiaon-admin-hub` → `fiaon-antrag`.
  - `blockAgentsFromAdmin` (`fiaon-agent.ts:407`): Agent-Token auf Pfad `/admin*` ⇒ 403.
  - `requireAgent` (`fiaon-agent.ts:381`): Agent-Cookie `fiaon_agent_token`, 12h.
- **Geld:** Integer-Cents, kaufmännische Rundung. `eurToCents`/`commissionCents`
  (`fiaon-agent.ts:47–55`). Anzeige deutsch (1.234,56 €).
- **Zeit/Zone:** `berlinHour()` + hartes Fenster `withinHardWindow()` 08–20 Uhr Europe/Berlin
  (`fiaon-antrag.ts:693–702`).

## 2. Kunden-/Antrags-Datenmodell (`fiaon_applications`)

Zentrale Tabelle für Anträge UND Bestellungen. Relevante Spalten (aus `ensurePaymentColumns`
`fiaon-antrag.ts:88–120` + Insert/Update-Pfaden):

- Identität: `ref` (PK-artig, z. B. `FIAON-…`), `type` (private|business|schufa), `status`.
- Kontakt: `email`, `contact_email`, `billing_email`, `first_name`, `last_name`, `contact_name`,
  `phone`, `phone_country_code`, `contact_phone`.
- Paket/Geld: `pack_key`, `pack_name`, `amount_due` NUMERIC(10,2), `currency`.
- Zahlung: `payment_reference`, `payment_status`
  (`pending_payment|claimed_paid|paid|expired|superseded|cancelled`), `payment_due_date`,
  `claimed_paid_at`, `promised_pay_date`, `completed_at`, `invoice_number`, `invoice_date`.
- Webhook-Flags (Einmal-Claim): `welcome_sent_at`, `payment_email_sent_at`, `claim_email_sent_at`,
  `confirmed_email_sent_at`, `followup_sent_at`, `agent_email_sent_at`.
- Reminder: `last_reminder_at`, `reminder_count`, `reminder_sent_at_24h/72h`,
  `allow_reminders_despite_paid`.
- Attribution/Lifecycle: `assigned_agent_id`, `locked_by_agent_id`, `locked_until`,
  `merged_into`, `superseded_by`, `refunded_at`, `cancelled_at`, `gdpr_deleted_at`,
  `created_at`, `updated_at`, `utm` (jsonb; hält u. a. `password`).

**Antrag anlegen/aktualisieren:** `POST /api/fiaon/application` (`fiaon-antrag.ts:1155`).
Update per Direkt-SQL, Insert per Drizzle. `welcome`-Webhook via atomarem Flag-Claim
(`fiaon-antrag.ts:1360–1374`).
**Bestellung anlegen:** `POST /api/fiaon/payment-order` (`fiaon-antrag.ts:214`) → Übergang
`pending_payment`, Rechnungsnummer, `payment_details`-Webhook, und
`distributeUnassignedOrders()` (Round-Robin, fire-and-forget, `:266`).

**⇒ Auto-Konversions-Hook (BA3):** additiv in `POST /application` (email/telefon liegen dort vor)
UND in `POST /payment-order` (garantiert konvertiert, sobald Bestellung existiert).

## 3. Normalisierung

- **E-Mail:** `String(x).trim().toLowerCase()` — überall (`fiaon-agent.ts:656`, Dubletten-Queries
  `LOWER(TRIM(email))`).
- **Telefon:** `normalizePhone(raw)` (**exportiert**, `fiaon-agent.ts:610`): entfernt Trenner,
  `00…`→`+…`, führende `0`→`+49…`, validiert `^\+\d{7,15}$`. Leere Eingabe ⇒ `""`, ungültig ⇒ `null`.

## 4. Reminder-Engine (Vorbild für Lead-Nachfass)

- `runPaymentReminders({force})` (`fiaon-antrag.ts:745`): (1) `expired` schließen (immer),
  (2) Not-Aus `reminder_engine_enabled`, kleines Fenster `reminder_window_start/end`, hartes
  08–20-Fenster, `max_reminders`, Batch-Schleife `claimReminderBatch(50)`.
- `claimReminderBatch` (`:708`): atomarer `UPDATE … SET last_reminder_at=NOW(),
  reminder_count+1 … WHERE … (last_reminder_at IS NULL OR < NOW()-20h) … FOR UPDATE SKIP LOCKED`.
  ⇒ **Kein Full-Table-Load**, Dedupe 20h, Obergrenze, Doppelversand-Schutz.
- Cron stündlich (`:792`) + Manuell `POST /admin/payments/run-reminders` (`:797`).
- **Bulk (Paket W):** `GET /admin/payments/bulk-reminder/preview`, `POST …/start`,
  `GET …/status` (`:827–927`), `BULK_BATCH=20`/Minute, Hintergrund-Job-State, Audit-Log-Eintrag.

## 5. Agent-Verteilung (Round-Robin — Vorbild für Lead-Verteilung)

- `distributeUnassignedOrders()` (**exportiert**, `fiaon-agent.ts:734`): aktive Agents mit
  `distribution_active=TRUE`, Rotations-Zeiger `distribution_last_agent_id`, Kappe
  `distribution_cap`, atomarer Claim `WHERE assigned_agent_id IS NULL`, Audit in `fiaon_contact_log`.
  Not-Aus `distribution_enabled`. Cron stündlich (`:802`).
- Agent-Arbeitsliste: `GET /agent/customers` (`:1120`) → `worklist` (eigene + unzugewiesene)
  + `colleagues`. Aktionen mit `claimOrGuard` (Auto-Claim + Soft-Lock).
- Kontakt-Ergebnisse `VALID_OUTCOMES` (`:1294`): `erreicht_zahlt_gleich, erreicht_zahlt_am,
  erreicht_abgelehnt, nicht_erreicht, mailbox, rueckruf_termin, nummer_falsch`.
- Notizen `POST /agent/customers/:ref/notes`; Stammdaten-Korrektur
  `PATCH …/contact-data` via `updateCustomerContact` (**exportiert**, Audit je Feld).

## 6. Make-Webhook (`sendMakeWebhook`)

- `sendMakeWebhook(eventType, payload)` (`server/make-webhook.ts:43`) → `MAKE_WEBHOOK_URL`,
  Body `{ event_type, timestamp, ...payload }`, Timeout 10 s, Fehler blockieren nie.
- Payload-Standard `makePayloadFromRow(row)` (`:99`): `email, vorname, nachname, antrag_id (=ref),
  payment_reference, betrag, paket`.
- **Registry-Pflicht:** jedes neue Event MUSS in `MakeEventType` (`make-webhook.ts:13`) UND
  `MAKE_EVENT_REGISTRY` (`make-events-registry.ts:41`) eingetragen werden (Event-Test-Konsole
  `/admin/events`).
- **⇒ Neue Events:** `lead_followup`, `lead_application_link`.

## 7. Einstellungen (`fiaon_settings`, key/value)

- `getSettings()`/`setSetting()` (**exportiert**, `fiaon-agent.ts:325/333`), Defaults
  `SETTING_DEFAULTS` (`:295`). Bestehend u. a.: `max_reminders`, `reminder_window_start/end`,
  `reminder_engine_enabled`, `distribution_enabled/cap/last_agent_id`,
  `default_commission_rate_bp`, `partner_override_bp`, `partner_thresholds`.
- **⇒ Neue Keys (Defaults):** `lead_followup_enabled=1`, `lead_followup_days=1,2,4,7`,
  `lead_followup_window_start=10`, `lead_followup_window_end=11`, `max_lead_followups=5`,
  `lead_distribution_enabled=1`, `lead_distribution_last_agent_id=0`.

## 8. Zahlungszentrale-Statistik (Ist)

- `GET /admin/payments/stats` (`fiaon-antrag.ts:395`): serverseitig aggregiert
  (`COUNT(*) FILTER`, `SUM(amount_due) FILTER`) → pending/claimed/paid + Bestätigungsquote
  + `reminders_today`. **Muster für BD (serverseitige Aggregation, kein Full-Load).**
- Provisionen: `fiaon_commissions` (`amount_cents`, `kind` own|override, `status`
  bestaetigt|…|storniert). Netto FIAON = Umsatz(paid) − Σ Provisionen(≠storniert).
- Frontend Zahlungszentrale: `client/src/pages/admin-zahlungen.tsx`; Verbuchungen
  `admin-verbuchungen.tsx`.

## 9. Frontend-Rahmen

- Routing `client/src/App.tsx` (wouter). `/admin/*`-Seiten laufen in `AdminShell`
  (`components/admin/AdminShell.tsx`, Nav-Registry `ADMIN_NAV:33`).
- Agent-Portal `/agent/*`; Nav in `client/src/pages/agent/shared.tsx`.
- Design: monochrom slate, Akzent `#2563eb`, keine Emojis/bunten Icons (lucide-react),
  Seite = Titel + Zweckzeile + Breadcrumb (AdminShell liefert Breadcrumb).

## 10. Performance-Einschätzung (512 MB)

- Anträge und künftige Leads können mehrere Tausend Zeilen erreichen.
- **Regeln übernommen:** alle Analytics per SQL-`GROUP BY`/Aggregat, Reminder/Bulk per atomarem
  Batch-Claim `FOR UPDATE SKIP LOCKED` (nie ganze Tabellen in RAM). Teure Kennzahlen ggf. in
  `fiaon_settings`-JSON gecacht (kurze TTL).

---

## Betreiber-TODOs (Zusammenfassung → Details in MIGRATION_INVENTORY.md)

1. **Make „FIAON Lead #1"**: EIN zusätzliches Modul „HTTP POST" an `POST /api/leads/intake`
   (parallel, Sequenz sonst unverändert). Header `x-lead-secret: <LEAD_INTAKE_SECRET>`.
2. **Make-Zweig `lead_followup`** + Brevo-Template (+ optional WhatsApp via Superchat).
3. **Make-Zweig `lead_application_link`** + Brevo-Template (Antrags-Link an Lead).
4. **Env `LEAD_INTAKE_SECRET`** setzen (Intake-Token).
5. **Werbebudget für CAC** je Zeitraum/Kampagne im Admin eintragen (`/admin/finanzen`).

## Testplan-Bezug

Siehe Prompt Abschnitt TESTPLAN; Selbstcheck-Ergebnisse werden nach jedem Paket in
MIGRATION_INVENTORY.md unter „Lead & Finance" protokolliert.
