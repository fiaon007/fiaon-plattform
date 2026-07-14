# AGENT_REVAMP_AUDIT — Bestandsaufnahme vor dem Agent-Portal-Update (Pakete AG–AO)

Stand: Juli 2026 · Phase 0 (Pflicht-Audit) für das große Agent-Portal-Update.
Regel: NUR `/agent/*` + neue Admin-Pflegebereiche (Agent-Updates, Agent-Feedback) werden verändert.

---

## 1. Bestehende `/agent/*`-Routen (Client, wouter in `client/src/App.tsx`)

| Route | Datei | Zweck | Datenquellen (API `/api/fiaon/...`) |
|---|---|---|---|
| `/agent` | `client/src/pages/agent.tsx` | Login + Dashboard (Verdienst-KPIs, Fokus „Heute", Kundenliste, Abschlüsse, Kundendetail-Sheet) | `/agent/me`, `/agent/login`, `/agent/customers`, `/agent/customers/:ref` (+notes/contact-result/send-payment-email/contact-data/invoice.pdf), `/agent/earnings` |
| `/agent/setup/:token` | `client/src/pages/agent/setup.tsx` | Passwort-Setup nach Einladung | `/agent/setup/validate`, `/agent/setup` |
| `/agent/passwort` | `client/src/pages/agent/passwort.tsx` | Passwort-Reset per Token | `/agent/reset-password` |
| `/agent/profil` | `client/src/pages/agent/profil.tsx` | Avatar, Telefon, Passwort, Auszahlungsdaten (IBAN verschlüsselt) | `/agent/profile` (+phone/avatar/password/bank) |
| `/agent/auszahlung` | `client/src/pages/agent/auszahlung.tsx` | Guthaben + Auszahlungs-Anforderung (nur Anforderung, nie Transaktion) | `/agent/payouts`, `/agent/payouts/request` |
| `/agent/skripte` | `client/src/pages/agent/skripte.tsx` | Gesprächsleitfäden, durchsuchbar | `/agent/scripts`, `/agent/scripts/:id/file` |
| `/agent/kalender` | `client/src/pages/agent/kalender.tsx` | Rückrufe + Zahlungs-Zusagen (Tag/Woche) | `/agent/calendar` (+done/reschedule) |
| `/agent/partner-programm` | `client/src/pages/agent/partner-programm.tsx` | Partnerstatus, Meilensteine, Team-Beteiligung, Partner vorschlagen | `/agent/partner-program`, `/agent/partner-suggestions` |

Gemeinsame Bausteine:
- `client/src/pages/agent/shared.tsx`: `AgentShell` (Header, Desktop-Nav, Mobile-Bottom-Nav, Auth-Check via `/agent/me`), `Card`, `Badge`, `Avatar`, `ProgressBar`, `FlashMessage`, `api()`, Format-Helfer (`fmtCents` …), `ACCENT = #2563eb`.
- `client/src/pages/agent/motion.tsx`: `Reveal`, `CountUp` (nur beim Mount), `SuccessPulse`, `SignatureCore` (CSS-3D-Drahtsphäre, 0 Assets), `AuthLayout`, `SubmitButton`, `useReducedMotion`.
- CSS: `client/src/index.css` — Abschnitt „FIAON AGENT-PORTAL Cinematic Motion Layer" (`.agent-reveal`, `.agent-core*`, `.agent-float`, `.agent-success`, `.agent-skeleton`, reduced-motion-Block).

## 2. Provisions-/Status-/Override-Logik (EXAKT — Quelle: `server/routes/fiaon-agent.ts`)

- **Geld**: IMMER Integer-Cents. `eurToCents()`, `commissionCents(baseCents, rateBp) = Math.round(base*bp/10000)` (kaufmännisch).
- **Tabelle `fiaon_commissions`**: `agent_id, ref, base_amount_cents, rate_bp (EINGEFROREN), amount_cents, status (bestaetigt|in_auszahlung|ausgezahlt|storniert), kind (own|override), source_agent_id, payout_id, note`.
- **Satz je Agent**: `agentRateBp()` = `fiaon_agents.commission_rate_bp` ?? Setting `default_commission_rate_bp` (Default 1500 bp = 15 %).
- **Partnerstatus** (Paket AE3): Setting `partner_thresholds` (JSON): senior ab 2.500.000 Cents (+200 bp), executive ab 7.500.000 (+400 bp), managing ab 20.000.000 (+600 bp). **Bestätigter Eigenumsatz** = `ownRevenueCents()`: Σ `base_amount_cents` der Einträge `kind='own' AND status != 'storniert'` (negative Einträge mindern). Overrides zählen NICHT.
- **Abschluss-Hook** `onCustomerPaid(ref)` (aufgerufen aus `fiaon-antrag.ts` mark-paid): friert `rate_bp = agentRateBp + Meilenstein-Zuschlag (Status VOR dem Abschluss)` ein; idempotent (max. 1 positiver Eintrag pro ref). Danach: Override für direkten Werber (EXAKT eine Ebene, `override_rate_bp` ?? Setting `partner_override_bp` 500 bp = 5 % vom KUNDENumsatz) + Meilenstein-Erreichung (`fiaon_partner_milestones`, Event `milestone_reached`).
- **Clawback** `onCustomerRefunded(ref)`: nicht ausgezahlte Einträge → `storniert`; bereits ausgezahlte → NEGATIVER Verrechnungs-Eintrag (erbt kind/source). Offene Auszahlungen werden neu berechnet/geschlossen.
- **Guthaben** (`/agent/payouts`): Σ `amount_cents` mit `status='bestaetigt'` — OHNE kind-Filter ⇒ ein neuer kind `feedback_bonus` fließt automatisch ins Guthaben, ohne Partner-/Override-Logik zu berühren. Genau so umgesetzt (Paket AN).
- **`/agent/earnings`**: rateBp, potenziell (offene zugewiesene Kunden × Satz), bestätigt/in Auszahlung/ausgezahlt (Summen nach Status), `monthCents` (Kalendermonat, != storniert), `monthlyGoalCents` (`fiaon_agents.monthly_goal_cents`), Override-Summe, letzte 50 Einträge inkl. Kundenname.
- **Audit**: `fiaon_agent_events` (`logAgentEvent`) + `fiaon_contact_log` (Kunden-Timeline).

## 3. Realtime-Schicht

**Nicht vorhanden** (kein WebSocket/SSE im Agent-Bereich; nur `setInterval`-Crons serverseitig). Entscheidung gemäß Paket AJ: **Polling im Client (45 s)** für Dashboard/Feed/Banner — KEIN neuer Realtime-Stack.

## 4. CI (Farbtokens, Schrift, Radien)

- Akzent: `#2563eb` (genau EINE Akzentfarbe), Flächen: Weiß auf `slate-50`, Text: Slate-Skala (900/600/500/400), Borders `slate-200`.
- Radien: `rounded-lg` (Inputs/Buttons), `rounded-xl`/`rounded-2xl` (Karten/Panels).
- Schrift: System-/Tailwind-Default (Inter-Stack), `tabular-nums` für Zahlen. KEINE Emojis, monochrome Lucide-Icons.
- Neue Effekte (Glas, 3D, Timing-Tokens fast 120 ms / base 220 ms / slow 420 ms) leiten sich hieraus ab — keine neue Farbwelt.

## 5. Entscheidung: KEINE fiktiven Agenten im Feed (Paket AH — Begründung)

Die Idee, „Bewegung" über 10 Bot-Agenten mit erfundenen Abschlüssen zu erzeugen, wurde **bewusst verworfen**:
1. Echte Mitarbeiter würden über Existenz und Leistung von Kollegen getäuscht — das ist vertrauens- und vertragsschädlich (arglistige Täuschung im Beschäftigungsverhältnis, UWG-Risiko bei Provisionsanreizen auf Basis erfundener Vergleichszahlen).
2. Fliegt die Täuschung auf (und das tut sie in kleinen Teams), ist die Motivationswirkung dauerhaft zerstört.
3. Denselben Ansporn liefern wahrheitsgemäße, klar gekennzeichnete **Benchmark-/Ziel-Impulse** (AH3): Top-Wochenwert, eigener Bestwert vs. heute, Team-Wochensumme. Der Feed verdichtet sich automatisch, sobald mehr echte Agents aktiv sind — kein Umbau nötig.

## 6. Neu in diesem Update (Pakete AG–AO) — Implementierungs-Verzeichnis

**Server** — `server/routes/fiaon-agent-portal.ts` (neu, registriert in `server/routes.ts` unter `/api/fiaon`, Admin-Routen automatisch durch `blockAgentsFromAdmin` geschützt):
- Tabellen (idempotent): `fiaon_agent_updates`, `fiaon_agent_update_reads`, `fiaon_agent_feedback`; Spalten an `fiaon_agents`: `desired_salary_cents`, `daily_goal_cents`, `daily_contacts_goal`, `first_steps`.
- Agent: `GET /agent/dashboard`, `GET /agent/feed`, `GET|POST /agent/wunschgehalt` (Simulator serverseitig, gestaffelte Meilenstein-Rechnung), `GET /agent/updates` + `POST /agent/updates/read` + `GET /agent/updates/state` (Banner), `GET|POST /agent/feedback`, `GET|POST /agent/first-steps`.
- Admin: `GET|POST|PATCH|DELETE /admin/agent-updates`, `GET|PATCH /admin/agent-feedback/:id`, `POST /admin/agent-feedback/:id/reward` (Provisionseintrag `kind='feedback_bonus'`, Audit `agent_feedback_rewarded`, Make-Event `agent_feedback_rewarded`), `PATCH /admin/agents/:id/daily-goals`.

**Client**:
- `/agent` = neues Dashboard „Mein Tag" (AG1–AG4) + Feed-Spalte (AH) + Wunschgehalt-Karte (AK) + Erste-Schritte-Panel (AO) + Polling 45 s (AJ).
- `/agent/kunden` (neu) = bisherige Arbeitsliste + Kundendetail-Sheet (unverändert extrahiert aus `agent.tsx`).
- `/agent/verdienst` (neu) = Abschlüsse/Provisionen + Wunschgehalt + Links Auszahlung/Partner (Hub; Alt-Routen bleiben erreichbar).
- `/agent/updates` (neu, AM), `/agent/feedback` (neu, AN), `/agent/mehr` (neu, AO).
- Navigation reduziert auf: Mein Tag · Kunden · Kalender · Verdienst · Mehr (Desktop + Mobile-Bottom-Nav). Update-Banner in `AgentShell` (nur `/agent/*`).
- 3D-Signature (AL): bestehender CSS-`SignatureCore` verfeinert (Facetten-Ring, 0 Assets, < 5 KB CSS, reduced-motion-Fallback statisch) — three.js wird NICHT eingeführt (nicht im Projekt).
- Admin: `/admin/agent-portal` (Updates-Pflege + Feedback-Tickets), verlinkt in `AdminShell`-Nav (Gruppe „Team").

## 7. Betreiber-TODOs (nicht im Code)

- Make-Szenario: neuen Zweig für Event **`agent_feedback_rewarded`** anlegen (Payload: `email`, `vorname`, `betrag_eur`, `feedback_titel`) + Brevo-Template.
- Optional: Tagesziele pro Agent im Admin (Team → Agent → Tagesziele) setzen; Defaults: 30 €/Tag Provision, 15 Kontakte/Tag.

---

## 8. `/admin/leads` — Verständlichkeits-Revamp (Phase-0-Bestandsaufnahme)

**Bedienelemente & tatsächliche Funktion** (Datei `client/src/pages/admin-leads.tsx`, Endpoints `server/routes/fiaon-leads.ts`):

| Element | Endpoint | Funktion |
|---|---|---|
| Kachel „Leads gesamt / Konvertiert / Zahlend / Offen" | `GET /admin/leads` (`stats`) | Überblickszahlen (all-time). |
| Automatik an/aus, Nachfass-Tage, Uhrzeit-Fenster, Max. Nachfässe | `GET|POST /admin/leads/settings` | Steuert die automatische Nachfass-Engine (Cron stündlich). |
| „Jetzt ausführen" | `POST /admin/leads/run-followups` (`force`) | Manueller Nachfass-Lauf, ignoriert Soft-Fenster, respektiert Hard-Fenster 08–20. |
| „Alle offenen anschreiben" (Bulk) | `GET …/followup-bulk/preview`, `POST …/start`, `GET …/status` | Batch-Versand an offene Leads; 8h-Dedupe; nur 08–20 Uhr. |
| „Verteilen" | `POST /admin/leads/distribute` | Round-Robin-Zuweisung unzugewiesener Leads. |
| „Leads mit Kunden abgleichen" (vorher „Backfill-Konversion") | `POST /admin/leads/backfill-convert` | Rückwirkende Lead→Kunde-Erkennung. |
| „Heute versendet" | `GET /admin/leads/settings` (`sentToday`) | Zahl heute versandter Follow-ups. |
| Diagnose-Kacheln (letzter Intake, 24h/7d, abgelehnt, ungültig) | `GET /admin/leads/intake-diagnostics` | Eingangs-Statistik aus `fiaon_lead_intake_log`. |
| „Test-Lead simulieren" | `POST /admin/leads/test-intake` | Legt Test-Lead an (Quelle `test`). |
| „Test-Leads löschen" | `DELETE /admin/leads/test-leads` | Entfernt alle `quelle='test'`. |
| Zeilen-Klick → Drawer | `GET /admin/leads/:id(\d+)` + CC-Endpoints | Bearbeiten/Ergebnis/Notiz/Status/Zuweisung/Versand/Historie. |

**Ursache „Test-Lead funktioniert nicht" (Paket 4)**: `test-intake` machte einen **HTTP-Selbstaufruf**
auf `fiaonBaseUrl()/api/leads/intake` mit `x-lead-secret`. Das scheitert in vielen Hosting-Setups
(DNS/TLS/SSRF-Schutz/Proxy) und war zwingend an ein gesetztes `LEAD_INTAKE_SECRET` gekoppelt (sonst
503). **Fix**: Intake-Kern in `processIntake()` extrahiert; Webhook UND Test rufen ihn direkt
in-process auf — kein Netzwerk, kein Secret nötig, unabhängig vom Sendefenster. Test-Lead erscheint
sofort als „TEST" in der Liste und ist per „Test-Leads löschen" entfernbar. Bei Fehler wird der
konkrete Grund samt Statuscode angezeigt.

**Umgesetzt (nur Verständlichkeit/Design/Feedback, keine Logikänderung außer Paket 4)**:
Info-Tooltips (`InfoTip`) an allen Feldern/Buttons, Panel-Untertitel, Klartext-Fensterstatus (mit
Uhrzeit + Hinweis dass manueller Versand trotzdem geht), farbige Erfolg/Fehler-Meldungen (`Flash`),
Leerzustände, Bulk-Bestätigungsdialog, Test-Löschen-Dialog, Abschnittsüberschriften (Überblick /
Steuerung & Eingang / Lead-Liste), einklappbare Onboarding-Hilfe (`OnboardingHelp`,
localStorage-Merker), Umbenennung „Backfill-Konversion" → „Leads mit Kunden abgleichen".

## 9. Verschwundene Kunden — Forensik (Pakete DA–DF, Phase 0, 14.07.2026)

Auslöser: Agent-Feedback vom 14.07.26 (Daniel Stripling ×3 Bugs „Kunden verschwinden",
Florentine Lombardi „Kunde verschwunden hat jetzt aber bezahlt").

### 9.1 DB-Befund zu den vier gemeldeten Fällen (Direkt-SQL, temporäres Forensik-Skript)

| Kunde | Befund |
|---|---|
| **Gökay Terzi** | 8 Anträge. Daniel (Agent #8) betreute `FIAON-MR6PMQQC-B6OL` (claimed_paid 04.07., Notiz „Zahlt am Montag, Adresse muss geändert werden"). **Bezahlt wurde die ÄLTERE, UNZUGEWIESENE** `FIAON-MQPOE01Q-3CA0` (paid 06.07., `assigned_agent_id = NULL`, `amount_due = NULL`). Daniels Antrag erhielt **8 Zahlungserinnerungen bis 13.07.** (7 Tage NACH Zahlung) und wurde erst am 13.07. 14:10 supersedet → fiel damit aus JEDER Agent-Ansicht. **Provision: KEINE.** `confirmed_email_sent_at = NULL` → `payment_confirmed` nie gefeuert. |
| **Samura/Samira Jusic** | 11 Anträge (Dubletten-Kaskade, mehrfach `merged_into`). Noch keine bezahlte Bestellung — Daniels Sicht-Verlust durch Merge-Kette (`merged_into` gesetzt ⇒ unsichtbar in `/agent/customers`). |
| **Ilijana Weber** | 8 Anträge. Daniel betreute `FIAON-MR738BWX-EX3A` („Erreicht – zahlt gleich" 09.07.). Bezahlt: unzugewiesene `FIAON-MR339DDD-0VKP` (paid 06.07., Agent NULL, `amount_due NULL`). Daniels Antrag: **8 Erinnerungen bis 13.07. trotz bezahlter Schwester**, supersedet 13.07. **Provision: KEINE.** |
| **Martin Dambok** | 5 Anträge, identisches Muster: bezahlt `FIAON-MQWLVN7N-QH62` (paid 06.07., Agent NULL), Daniels `FIAON-MR5FUEKQ-CT43` 8 Erinnerungen bis 13.07., supersedet 13.07. **Provision: KEINE.** |

Alle drei bezahlten Bestellungen tragen `updated_at = 2026-07-06T08:23:29Z` (identisch)
⇒ Batch-Verbuchung über Kontoabgleich (`fiaon-reconcile.ts` applyTxn) bzw. Access-Backfill.

### 9.2 Sichtbarkeits-Analyse (warum „verschwinden" Kunden?)

Kunden verschwinden NICHT aus der DB — sie fallen aus allen gefilterten Listen:

- `GET /agent/customers` (fiaon-agent.ts): `WHERE payment_status IN ('pending_payment','claimed_paid') AND merged_into IS NULL` ⇒ **bezahlt / expired / superseded / gemergt = unsichtbar in JEDER Agent-Ansicht**.
- `GET /agent/customers/:ref` (Detail): identischer Filter ⇒ 404 „bereits bezahlt" — auch für den eigenen, gerade bezahlten Kunden.
- `GET /agent/leads`: `status IN ('neu','kontaktiert','nicht_erreichbar')` ⇒ konvertierte/tote Leads unsichtbar.
- Dubletten-Mechanik: `supersedeSisterOrders` + Admin-Merge verschieben die Zahlung häufig auf einen Antrag OHNE `assigned_agent_id` ⇒ Agent verliert Attribution UND Provision (`onCustomerPaid` bricht bei `assigned_agent_id IS NULL` ab).

### 9.3 Reminder-Kette + payment_confirmed (Kontoabgleich)

- `claimReminderBatch` stoppt bei `paid` der SELBEN Bestellung sofort; Schwester-Dubletten sind nur über AD2 (`NOT EXISTS paid mit gleicher email`) geschützt — griff hier zu spät (supersede erst 13.07.).
- `fiaon-reconcile.ts applyTxn` setzte `payment_status='paid'` per Direkt-SQL, rief aber **weder `supersedeSisterOrders` noch den `payment_confirmed`-Claim** auf ⇒ Erinnerungen an offene Schwester-Bestellungen liefen weiter, Kunde bekam keine Zahlungsbestätigung.

### 9.4 Umsetzung (Pakete DA–DF)

- **Root-Cause-Fix**: `supersedeSisterOrders` überträgt jetzt `assigned_agent_id` der geschlossenen Schwester auf die bezahlte Bestellung (nur wenn diese unzugewiesen ist) — Attribution bleibt stabil. `applyTxn` (Kontoabgleich) ruft supersede + `payment_confirmed`-Claim (Dedupe über `confirmed_email_sent_at`) auf.
- **DA**: `GET /agent/customers/all` (Gesamtbestand, alle Status, Filter-Chips) + Detail öffnet eigene bezahlte/geschlossene Kunden read-only; Toast erklärt beim Statuswechsel, wo der Kunde jetzt zu finden ist.
- **DB**: Zahlungsstand im Agent-Kundendetail (Status/bezahlt am/Betrag; KEIN Versandstatus — existiert im System nicht); manuelle Provisions-Buchung `POST /admin/agents/:id/commissions/manual` (±Betrag, Pflicht-Begründung, Audit, kind='manuell').
- **DC**: Serverseitige Suche `GET /agent/search` (eigener Bestand) + `GET /admin/customer-search` (global): Name (tokenisiert, Reihenfolge egal), E-Mail, Telefon (normalisiert, Ziffern-Suffix-Match) über Kunden UND Leads.
- **DD**: Kontakt-Ergebnis-Buttons mit Bestätigungs-Schritt (auswählen → bestätigen); Verlaufs-Einträge als „irrtümlich" markierbar (Soft-Delete `voided_at`, KEIN hartes Löschen).
- **DE**: Adresse (Straße/PLZ/Ort) im Kunden-Detail editierbar (Agent + Admin) über `updateCustomerContact` mit Audit alt→neu.
- **DF**: Feedback-Modul: Kopier-Button (Titel+Autor+Datum+Volltext), Status-Zähler je Filter-Chip, Umbrüche bereits korrekt (`whitespace-pre-wrap`).
- **GEPARKT**: Partnerlink/Referral (Florentine) — NICHT gebaut, wartet auf LEXR-Freigabe (MIGRATION_INVENTORY.md „Geparkt (Rechtsprüfung)").

### 9.5 Betreiber-TODOs (einmalig nach Deploy)

1. **`POST /api/fiaon/admin/payments/repair-attribution`** einmal aufrufen (Admin-Session):
   überträgt bei ALLEN bezahlten, unzugewiesenen Bestellungen die Agent-Zuweisung der
   superseded Schwester (heilt Gökay Terzi / Ilijana Weber / Martin Dambok → erscheinen
   danach in Daniels „Gesamtbestand → Bezahlt" + Admin-Suche). Antwort listet die Fälle auf.
2. **Provisionen für die geheilten Fälle prüfen**: Admin → Team → Agent-Detail →
   Tab „Provisionen" → „Provision manuell buchen" (Betrag, Pflicht-Begründung, optional
   Kunden-Referenz). Es wird bewusst KEINE Provision automatisch nachgebucht.
3. Optional: Feedback-Tickets von Daniel/Florentine im Admin (Agent-Portal → Feedback)
   auf „Umgesetzt" setzen + ggf. Feedback-Bonus.
