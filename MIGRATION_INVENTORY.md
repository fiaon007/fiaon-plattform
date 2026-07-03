# MIGRATION_INVENTORY — Stripe → Banküberweisung (Vorkasse)

Stand: 2026-07-03 · Umstellung des gesamten Zahlungsflows von Stripe auf SEPA-Vorkasse mit manueller Freischaltung.

---

## PHASE 0 — Bestandsaufnahme (Stripe-Inventar)

### Aktiver Bestellablauf (vor Migration)

1. **Privatkunden** (`client/src/pages/antrag.tsx`): 9-Step-Wizard. Step 8 = „Konto aktivieren" → `handleProceedToStripe()` speicherte Antrag mit `status=pending_payment` und leitete auf externen Stripe Payment Link (`buy.stripe.com/...?client_reference_id=REF`) weiter. Nach Stripe-Return: Step 9 = Passwort-Setup → `status=completed` → `/login`.
2. **Business** (`client/src/pages/business-antrag.tsx`): Step 6 = eingebettetes Stripe Elements Checkout. `useEffect` rief `POST /api/fiaon/create-payment-intent` → `clientSecret` → `<Elements>` + `PremiumCheckoutForm`. Erfolg → `/dashboard`.
3. **Bonitätsauszug** (`client/src/pages/bonitaet-antrag.tsx`): KEIN Backend-Save; direkter Link auf `buy.stripe.com/3cI7sN51dftYa2v5QCfnO06` (74 €).
4. **Dashboard SCHUFA-Modal** (`client/src/pages/dashboard.tsx`): Gleicher 74 €-Payment-Link mit `prefilled_email`.
5. **Status-Modell** `fiaon_applications`: `status` (started/submitted/pending_payment/payment_completed/completed), `payment_status` (pending/paid/cancelled). Freischaltung passierte im Stripe-Webhook: `payment_status='paid'`, `status='payment_completed'`.
6. **E-Mails**: Kein automatischer Mailversand im Antragflow vorhanden. Infrastruktur: `server/email/mailer.ts` (Resend, `RESEND_API_KEY`, `EMAIL_FROM`). Es existierte KEINE „Willkommen/Zugang aktiv"-Mail — wird in Phase 3 neu erstellt.

### Stripe-Vorkommen (Datei / Funktion / Zweck)

| Datei | Stelle | Zweck | Maßnahme |
|---|---|---|---|
| `server/routes/fiaon-antrag.ts` | `POST /create-payment-intent` (Z. 49) | Subscription + PaymentIntent erstellen | → **410 Gone** |
| `server/routes/fiaon-antrag.ts` | `POST /stripe-webhook` (Z. 161) | Zahlungseingang → Freischaltung (`payment_status='paid'`, `status='payment_completed'`) | → **410 Gone**; Freischalt-Logik wiederverwendet in Admin „Als bezahlt markieren" |
| `server/routes/fiaon-antrag.ts` | `GET /admin/stripe/revenue`, `POST /admin/stripe/sync`, `GET /admin/stripe/ai-insights`, `GET /admin/applications/:ref/transactions` | Admin-Umsatz-Dashboards (lesend) | Deaktivieren sich selbst sobald `STRIPE_SECRET_KEY` entfernt ist (`stripe === null` Guard). Siehe „Offene Punkte" |
| `client/src/pages/antrag.tsx` | `PACKS[].pay`, `STRIPE_PAYMENT_LINKS`, `handleProceedToStripe`, Step-8-Texte („Powered by Stripe", „Weiterleitung zu Stripe") | Checkout-Redirect | Ersetzt durch Flow → `/zahlung/[payment_reference]` |
| `client/src/pages/business-antrag.tsx` | `loadStripe`, `Elements`, `PremiumCheckoutForm`, `clientSecret`-useEffect, `BUSINESS_PACKS[].pay` | Eingebettetes Checkout | Ersetzt durch Flow → `/zahlung/[payment_reference]` |
| `client/src/pages/bonitaet-antrag.tsx` | Direkter `buy.stripe.com`-Link (74 €), Text „Sichere Zahlung über Stripe" | Einmalzahlung Bonitätsauszug | Ersetzt durch Bestellung (`kind=schufa`) → `/zahlung/[payment_reference]` |
| `client/src/pages/dashboard.tsx` | `buy.stripe.com`-Link im SCHUFA-Modal, Text „Sichere Zahlung via Stripe" | Einmalzahlung SCHUFA | Ersetzt durch Bestellung (`kind=schufa`) → `/zahlung/[payment_reference]` |
| `client/src/lib/stripe.ts` | `loadStripe`-Wrapper | Legacy (ARAS-Plattform-Teil) | Nicht mehr von aktiven FIAON-Seiten importiert |
| `client/src/components/PremiumCheckoutForm.tsx` | Stripe Elements Form | Nur von business-antrag genutzt | Import entfernt; Datei bleibt als Legacy |
| `client/src/components/billing/*` (`payment-setup.tsx`, `pricing-cards.tsx`) | ARAS-Billing (anderer Plattform-Teil) | Nicht Teil des FIAON-Antragflows | Unverändert (siehe Offene Punkte) |
| `client/src/components/admin/AdminRevenueDashboard.tsx`, `AccountingDashboard.tsx`, `UserDeepDivePanel.tsx`, `AdminAppDetail.tsx`, `AdminApplicationsManager.tsx` | Anzeige von Stripe-Daten (lesend) | Admin-Analytics | Unverändert; zeigen nach Env-Entfernung leere Daten |
| `client/src/pages/privacy.tsx`, `cookie-einstellungen.tsx` | Stripe als Datenverarbeiter genannt | Rechtstexte | TODO Rechtsabteilung (siehe unten) |
| `client/src/pages/agb.tsx` | §5 „Zahlungsabwicklung über Stripe" | AGB | **NICHT geändert — TODO Rechtsabteilung** |
| `server/routes.ts`, `server/storage.ts`, `server/routes/admin-users.ts`, `server/routes/service-orders.ts`, `server/routes/founding.ts`, `server/index.ts` | ARAS-Plattform-Billing (anderes Produkt, gleiche Codebase) | Nicht Teil des FIAON-Antragflows | Unverändert |
| `*.backup*`, `*Konflikt stehende Kopie*` Dateien | Tote Backups | — | Ignoriert |

### Env-Variablen
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLIC_KEY` → **aus dem Deployment entfernen** (Code ist überall mit Null-Guards abgesichert).

---

## Neue Zahlungsdaten (Vorkasse)

- Empfänger: **Fiaon Ltd**
- IBAN: **BE09905892763957**
- BIC: **TRWIBEB1XXX**
- Verwendungszweck: `payment_reference` (Format `FIAON-XXXX`, Zeichensatz ohne 0/1/O/I/L)
- Frist: 7 Tage ab Bestellung, Erinnerungen nach 24 h und 72 h, danach `expired`.

## TODO Rechtsabteilung
- [ ] `client/src/pages/agb.tsx` §5: Passus „Zahlungsabwicklung über Stripe" ersetzen durch „Aktivierung per Banküberweisung – Zugang nach Zahlungseingang".
- [ ] `client/src/pages/privacy.tsx` + `cookie-einstellungen.tsx`: Stripe als Auftragsverarbeiter entfernen.

---

## Abschluss-Sektion

### Was geändert wurde

**Datenmodell (Phase 1)**
- `shared/schema.ts` + Auto-Migration (`ensurePaymentColumns` in `server/routes/fiaon-antrag.ts`): `payment_reference` (unique, indexed), `payment_due_date`, `amount_due`, `currency`, `reminder_sent_at_24h`, `reminder_sent_at_72h`. `payment_status` nutzt jetzt: `pending_payment` / `paid` / `expired` / `cancelled`.
- Referenz-Format: `FIAON-XXXXXX`, Zeichensatz `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (ohne 0/1/O/I/L), Eindeutigkeit per DB-Check.

**Backend (`server/routes/fiaon-antrag.ts`)**
- `POST /api/fiaon/payment-order` — Bestellung anlegen (idempotent pro ref), Betrag aus serverseitiger Preisliste (`PACK_PRICES`, SCHUFA 74 €), 7-Tage-Frist, versendet Template 1. `kind: "schufa"` erzeugt eigene Bestellzeile.
- `GET /api/fiaon/payment-order/:paymentRef` — öffentliche Zahlungsdaten (nur Vorname, Betrag, Frist, Status, Bankdaten).
- `GET /api/fiaon/admin/payments?status=…`, `POST …/mark-paid` (Freischaltung = frühere Webhook-Logik + Willkommensmail), `POST …/reactivate` (neue Frist + Template 1), `POST …/run-reminders` (manueller Trigger).
- Stündlicher Reminder-Cron: expired-Setzung, 24h-/72h-Mails (feuern exakt einmal via Timestamps).
- `POST /create-payment-intent` und `POST /stripe-webhook` → **410 Gone**.

**E-Mails (`server/email/fiaon-payment-emails.ts`)** — Resend-Infrastruktur (`server/email/mailer.ts`):
- Template 1 Zahlungsinformationen, Reminder 24h/72h, Willkommen/Zugang-aktiv.

**Client**
- Neu: `/zahlung/[payment_reference]` (`client/src/pages/zahlung.tsx`) — Headline, 7-Tage-Statuszeile, EPC-QR-Code (GiroCode, `qrcode.react` + `client/src/lib/epc-qr.ts`), Copy-Felder (IBAN kopiert OHNE Leerzeichen), Hinweisboxen (Verwendungszweck, BE-IBAN, Warum Überweisung, Ablauf), ohne Login aufrufbar, zeigt `paid`/`expired`-Zustände.
- Neu: `/admin/zahlungen` (`client/src/pages/admin-zahlungen.tsx`) — Tabs Offen/Abgelaufen, Referenz-Suche, „Als bezahlt markieren", „Reaktivieren", Reminder-Trigger.
- `antrag.tsx`: Step 8 „Konto aktivieren" → Passwort-Setup (Step 9) → Bestellung → Redirect `/zahlung/…`. Stripe-Links/-Texte entfernt, Hinweis auf Paketauswahl ergänzt.
- `business-antrag.tsx`: Stripe Elements komplett entfernt → „Weiter zur Zahlung"-CTA → `/zahlung/…`. Bugfix: `packKey: pack?.tier` → `pack?.key` (pack_key wurde nie gespeichert).
- `bonitaet-antrag.tsx` + `dashboard.tsx` (SCHUFA 74 €): Payment-Link ersetzt durch `kind:"schufa"`-Bestellung → `/zahlung/…`.
- Wartungsmodus deaktiviert (`MAINTENANCE_MODE = false`) — Anträge laufen wieder.

### Was getestet wurde (lokal, echter Server + DB)
1. ✅ Bestellflow: Antrag → `payment-order` → einzigartige Referenz (`FIAON-DARMB4`), korrekte Beträge (pro=59,99 / ultra=79,99 / schufa=74,00), 7-Tage-Frist, Bankdaten im Response.
2. ✅ Zwei Bestellungen → zwei unterschiedliche Referenzen; erneuter Aufruf → idempotent (gleiche Referenz).
3. ✅ Admin mark-paid → `payment_status='paid'`, `status='payment_completed'`, Zahlungsseite zeigt „bezahlt".
4. ✅ Reminder-Cron manuell: 24h-Mail und Ablauf feuern; **zweiter Lauf sendet 0** (einmalig). Reaktivieren setzt neue 7-Tage-Frist.
5. ✅ `create-payment-intent` und `stripe-webhook` liefern **410**; keine `buy.stripe.com`-Links mehr in aktivem Client-Code; 0 Stripe-Treffer in den Antragsseiten.
6. ✅ Typecheck: 0 Fehler in allen geänderten Dateien.
- QR-Code: Payload nach EPC069-12 (BCD/002/1/SCT) implementiert — **Scan mit echter deutscher Banking-App bitte einmal manuell verifizieren** (Betrag + Verwendungszweck werden vorausgefüllt).

### Offene Punkte
- [ ] **Env-Variablen entfernen**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`/`VITE_STRIPE_PUBLIC_KEY` aus dem Deployment löschen (Code ist mit Null-Guards abgesichert).
- [ ] **Stripe Payment Links im Stripe-Dashboard deaktivieren** (alte gespeicherte URLs könnten sonst noch funktionieren).
- [ ] **AGB §5** (Rechtsabteilung): „Zahlungsabwicklung über Stripe" ersetzen. Ebenso `privacy.tsx` / `cookie-einstellungen.tsx`.
- [ ] Admin-Umsatz-Dashboards (`/admin/stripe/*`) zeigen nach Env-Entfernung keine Daten mehr — bei Bedarf auf `fiaon_applications.amount_due/paid` umstellen.
- [ ] `FIAON_BASE_URL` env setzen (Default `https://fiaon.de`) für korrekte Links in E-Mails.
- [ ] Admin-Routen (`/api/fiaon/admin/*`) sind — wie die bestehenden Admin-Endpoints — nicht zusätzlich authentifiziert; folgt dem bestehenden Muster von `/admin/database`.
