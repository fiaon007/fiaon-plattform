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

### Update: Mobile-Optimierung + Zahlungs-Tracking (claimed_paid)

**Datenmodell**
- Neuer Status `claimed_paid` (zwischen `pending_payment` und `paid`) + Spalte `claimed_paid_at`. Löst NIEMALS Freischaltung/Willkommensmail aus. Claims sind von Reminder-/Expiry-Cron ausgenommen (Admin verifiziert manuell).

**Zahlungsseite `/zahlung/[ref]` (v2 — QR-Speichern-Lösung, ersetzt „Alles kopieren")**
- „Alles kopieren" wurde **komplett entfernt** (Textblock landet ungeparst im ersten Feld der Banking-App → Fehlerquelle). Ebenso der unzuverlässige Deep-Link-Button.
- **Haupt-Baustein:** GiroCode prominent + Button **„QR-Code speichern"** — exportiert NUR das QR-Bild als PNG (verstecktes 640px-Canvas mit Quiet Zone, immer weißer Hintergrund → auch im Darkmode scanbar), Dateiname `FIAON-Ueberweisung-[ref].png`. Mobile: Web Share API (`navigator.share` mit Bilddatei → „In Fotos sichern"), sonst PNG-Download; Share-Abbruch zeigt keine falsche Bestätigung. Kunde lädt den Code in der Banking-App per „Rechnung fotografieren / QR aus Galerie" hoch — alle Felder inkl. Verwendungszweck automatisch ausgefüllt.
- Erklär-Box „So bezahlst du – ganz einfach" mit zwei sauber getrennten Wegen: Empfohlen (QR speichern → Galerie-Upload, 3 Schritte) / Alternativ (Einzelfelder von Hand, mit Referenz-Hinweis). Desktop-Zusatz: „…oder scanne den Code mit deiner Banking-App am Handy."
- **Design:** Überschriften mit dezent animiertem Gradient-Shimmer (7s, `background-clip: text`, `prefers-reduced-motion` → Animation aus). Ruhige Vertrauens-Badges (SSL-verschlüsselt / SEPA-Überweisung / EU-Konto) unter Headline und auf der Danke-Seite. Clean, viel Weißraum, große Touch-Targets.
- Einzel-Copy-Felder bleiben (feldgenaues Einfügen ist unproblematisch; Verwendungszweck hervorgehoben).
- **Tracking:** „Ich habe die Überweisung getätigt" → `POST /payment-order/:ref/claim-paid` → Redirect `/zahlung/[ref]/danke` (exakter Danke-Text lt. Spez). Bei erneutem Seitenbesuch mit Status `claimed_paid`: grüner Hinweis, Daten bleiben sichtbar.

**Admin `/admin/zahlungen`**
- Kennzahlenblock: Offen (Anzahl+Summe) / Erwarteter Umsatz unbestätigt / Bestätigter Umsatz / **Bestätigungsquote** (basiert auf `claimed_paid_at`, bleibt daher auch nach mark-paid korrekt).
- Neuer Tab „Zahlung gemeldet" mit `claimed_paid_at`-Spalte und „Als bezahlt markieren" (echte Freischaltung + Willkommensmail).
- Backend: `GET /admin/payments/stats`, `GET /admin/payments?status=claimed_paid`.

**Getestet (echter Server + DB)**
1. ✅ claim-paid: `payment_status='claimed_paid'`, `claimed_paid_at` gesetzt, `status` bleibt `submitted` — **keine Freischaltung, keine Willkommensmail** (Logs geprüft).
2. ✅ Stats: nach Claim „erwartet 59,99 €", nach mark-paid „bestätigt 59,99 €", Quote 100 %.
3. ✅ claim auf bereits bezahlte Bestellung → 404 (kein Downgrade möglich).
4. ✅ Zwei Bestellungen → zwei eindeutige Referenzen; Typecheck 0 Fehler.
5. ⚠️ Manuell zu prüfen (echtes Gerät/HTTPS): „QR-Code speichern" auf iOS/Android (Share-Sheet → Fotos), gespeichertes PNG per Galerie-Upload in echter Banking-App einlesen (Sparkasse/VR/ING o. ä.), Einzel-Copy-Buttons, Shimmer bei `prefers-reduced-motion` aus.

### Offene Punkte
- [ ] **Env-Variablen entfernen**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`/`VITE_STRIPE_PUBLIC_KEY` aus dem Deployment löschen (Code ist mit Null-Guards abgesichert).
- [ ] **Stripe Payment Links im Stripe-Dashboard deaktivieren** (alte gespeicherte URLs könnten sonst noch funktionieren).
- [ ] **AGB §5** (Rechtsabteilung): „Zahlungsabwicklung über Stripe" ersetzen. Ebenso `privacy.tsx` / `cookie-einstellungen.tsx`.
- [ ] Admin-Umsatz-Dashboards (`/admin/stripe/*`) zeigen nach Env-Entfernung keine Daten mehr — bei Bedarf auf `fiaon_applications.amount_due/paid` umstellen.
- [ ] `FIAON_BASE_URL` env setzen (Default `https://fiaon.de`) für korrekte Links in E-Mails.
- [ ] Admin-Routen (`/api/fiaon/admin/*`) sind — wie die bestehenden Admin-Endpoints — nicht zusätzlich authentifiziert; folgt dem bestehenden Muster von `/admin/database`.
