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

### Update: Make.com-Webhooks + Dubletten-Fix

**Phase 0 — Dubletten-Ursache & Fix**
- **Ursache:** `ref` wurde in `antrag.tsx`/`business-antrag.tsx` per `useState(mkRef)` bei **jedem Seiten-Mount neu generiert** (nicht persistiert). Jeder Reload/Wiederbesuch → neue ref → der Autosave (`POST /application`, feuert pro Schrittwechsel) legte eine **neue Zeile** an statt zu aktualisieren. DB-Befund: 3416 Zeilen = 3416 distinct refs, aber bis zu 10 Zeilen pro E-Mail-Adresse. Innerhalb einer Session war die ref stabil (Server macht korrektes Update auf ref) — das Problem war ausschließlich der Seiten-Neustart.
- **Fix (minimal):** ref wird in `sessionStorage` persistiert (`fiaon_antrag_ref` / `fiaon_business_antrag_ref`, Helper `getPersistentRef`) und nach erfolgreichem Abschluss (`payment-order` ok → Redirect) via `clearPersistentRef` freigegeben. Pro Antrag existiert damit genau EIN Datensatz, der über alle Schritte hinweg aktualisiert wird.

**Phase 1 — Webhook-Infrastruktur (`server/make-webhook.ts`)**
- `sendMakeWebhook(eventType, payload)` → POST an `MAKE_WEBHOOK_URL` (**env, nicht hardcoded** — Wert muss im Deployment gesetzt werden!). Payload: `event_type`, `timestamp`, `email`, `vorname`, `nachname`, `antrag_id` (= ref), `payment_reference`, `betrag`, `paket`. 10s-Timeout; Fehler werden nur geloggt und blockieren NIE den Nutzerflow (getestet).

**Phase 2 — Die drei Trigger (jeweils genau 1×, atomare Flag-Claims per `UPDATE … WHERE flag IS NULL RETURNING`)**
- **`welcome`** (`welcome_sent_at`): in `POST /application`, sobald erstmals eine E-Mail gespeichert ist. Vor/Zurück-Navigation und parallele Saves feuern nicht erneut.
- **`payment_details`** (`payment_email_sent_at`): in `POST /payment-order` beim Übergang nach `pending_payment` (Payload mit `payment_reference`, `betrag`, `paket`, `email`, `vorname`). Idempotenter Zweitaufruf feuert nicht. Reactivate feuert bewusst erneut (neue Frist) und setzt `followup_sent_at` zurück.
- **`followup_48h`** (`followup_sent_at`): im bestehenden stündlichen Cron (`runPaymentReminders`). Kriterien: Status `pending_payment` ODER `claimed_paid`, Bestellung älter 48h (`payment_due_date < NOW() + 5 days`, da due = Bestellung + 7 Tage), Flag NULL. `paid`/`expired` feuern nie.
- **Direkte Plattform-Mails entfernt:** Zahlungsinstruktions-Mail (Template 1) und 24h/72h-Reminder-Mails sind ersetzt durch die Webhooks — Make versendet die E-Mails. **Ausnahme (bewusst):** die Willkommens-/Freischaltungsmail bei manuellem „Als bezahlt markieren" bleibt in der Plattform (kein Make-Event dafür definiert).

**Getestet (echter Server + Webhook-Catcher)**
1. ✅ 1 Save ohne E-Mail → 0× welcome; 4 Saves mit E-Mail (Vor/Zurück) → exakt 1× welcome.
2. ✅ payment-order + idempotenter Zweitaufruf → exakt 1× payment_details mit korrekter einzigartiger Referenz + Betrag.
3. ✅ Cron mit >48h altem Datensatz → 1× followup_48h; zweiter Lauf → 0.
4. ✅ `paid`-Datensatz (auch mit gelöschtem Flag) → kein followup_48h.
5. ✅ Webhook-Ausfall (Ziel down) → Application-Save und payment-order liefern HTTP 200, Fehler nur im Log.
6. ✅ Zwei Bestellungen → zwei eindeutige Referenzen.
7. Dubletten-Fix clientseitig (sessionStorage) — Code-Review-verifiziert; E2E: Antrag im Browser durchklicken, neu laden, prüfen dass nur 1 Zeile entsteht.

### Update: Großes Update — Entity-Migration, Admin-Sanierung, Agent-Portal, Rechnungen

**Paket A — Entity-Migration SCP Real Estate KG → FIAON LTD (überall)**
- Bestandsaufnahme: 9 Dateien mit alter Entity (Impressum, AGB, Widerruf, Datenschutz, Cookies, Footer, B2B-Vertragsvorlage, 2× Server-Vertrags-PDF, E-Mail-Footer). Volltextsuche nach `SCP|Gräfelfing|Pasinger|Gerhold|HRA 120072|DE123456789` in ausgelieferten Quellen: **0 Treffer** nach Migration (getestet).
- Impressum jetzt zweisprachig DE+EN mit Anker-Navigation; USt-ID-Panel ersatzlos entfernt (keine DE-USt-ID/UK-VAT vorhanden); Regulatorik-Disclaimer inhaltlich unverändert + EN-Übersetzung.
- AGB §5: Stripe-Passus ersetzt durch SEPA-Vorkasse-Klausel. §12 unverändert + `LEGAL REVIEW REQUIRED`-Marker.
- Alle Änderungen mit Vorher/Nachher in **`LEGAL_REVIEW_PACKAGE.md`** (Entwurf bis LEXR-Freigabe).

**Paket B — Schwebendes Admin-Menü entfernt**
- Ursache: `MinimalistGlassLauncher` (fixed `left-8 top-1/2 z-50`, Glas-Hamburger) wurde in `admin-database.tsx` gerendert und überlagerte die Sidebar (Buchhaltung/Ausbuchung). Auf Desktop UND Mobile überflüssig (Sidebar ist immer sichtbar) → Import + Rendering entfernt; Komponente selbst bleibt ungenutzt im Repo.

**Paket C — Admin-Zahlungsansicht saniert (`/admin/zahlungen`)**
- 4 Kacheln: Offen / **Zahlung angekündigt (hervorgehoben, klickbar = Arbeitsliste)** / Bestätigt bezahlt / Bestätigungsquote (paid je claimed).
- Filter-Chips Alle/Offen/Angekündigt/Bezahlt/Abgelaufen; Default-Tab = Angekündigt; Sortierung claimed zuerst, älteste Ankündigung oben; claimed-Zeilen amber hinterlegt.
- Tabelle: Referenz | Name | E-Mail | Telefon | Paket | Betrag | Status-Badge | Angekündigt am | Aktionen (Als bezahlt / Rechnung-PDF / Details).
- Detail-Drawer mit **Ereignis-Timeline** (`GET /admin/payments/:ref/timeline`): Antrag erstellt → welcome → Rechnung → Zahlungsseite/payment_details → claimed → followup → Zusage → bezahlt, plus alle Agent-Aktionen.
- **Duplikat-Altbestand**: `GET /admin/duplicates/preview` + `POST /admin/duplicates/cleanup-all` (confirmed-Pflicht). Soft-Delete via neuer Spalte `merged_into` (KEIN Hard-Delete); Keeper = höchster Score (Zahlstatus > payment_reference > Vertrag > Datenfülle > neuestes Update); paid/pending/claimed sind geschützt. Produktivlauf durchgeführt: **157 Gruppen, 311 Einträge gemerged, 9 geschützt**. `merged`-Zeilen sind aus `/admin/applications`, `/admin/payments`, Stats und Agent-Liste ausgeblendet.

**Paket D — Mitarbeiter-Portal `/agent` (Rolle "Agent")**
- Neue Tabellen `fiaon_agents` (bcrypt-Hash) + `fiaon_contact_log` (append-only Audit). Login: HMAC-signiertes httpOnly-Cookie (12h), eigener Screen unter `/agent`.
- **Rollentrennung serverseitig**: Middleware `blockAgentsFromAdmin` (in `server/routes.ts` vor allen fiaon-Routern) → Request mit Agent-Cookie auf `/api/fiaon/admin/*` = **403** (getestet). Hinweis: Admin-Routen selbst sind weiterhin ohne eigene Auth (bestehendes Muster, siehe offene Punkte).
- Agent sieht AUSSCHLIESSLICH `pending_payment` + `claimed_paid` (paid verschwindet automatisch, getestet) mit allen Durchgabe-Daten: Name, E-Mail, Telefon, Paket, Betrag, Referenz, Antragsdatum, Fälligkeit, Adresse, Rechnungsnummer, letzter Kontakt.
- UI mobile-first (Karten + großer `tel:`-Anruf-Button, Bottom-Sheet-Detail) + Desktop-Tabelle; Suche; Chips Alle/Angekündigt/Termin/Nicht erreicht; **„Heute fällig"**-Bereich (Termine + Zusagen des Tages).
- Kontakt-Doku: Freitext-Notizen (nach Speichern unveränderlich, Autor+Zeitstempel), 7 Ergebnis-Buttons (zahlt gleich / zahlt am [Datum] / abgelehnt / nicht erreicht / Mailbox / Rückruf am [Datum+Zeit] / Nummer falsch) mit Datums-Pickern; „zahlt am/gleich" setzt `promised_pay_date` → als „Zusage"-Badge auch im Admin sichtbar.
- **Ein-Klick-Mail**: `POST /agent/customers/:ref/send-payment-email` → Make-Webhook **`agent_payment_reminder`** (Payload wie payment_details + `agent_name` + `invoice_url`). KEINE Direkt-Mail. 10-Min-Sperre pro Kunde (atomarer DB-Claim, HTTP 429 + Countdown im UI), jeder Versand als Log-Eintrag.
- Admin-Verwaltung auf `/admin/zahlungen`: Agent anlegen/deaktivieren/Passwort setzen + einsehbarer Audit-Trail (`GET /admin/agent-log`).

**Paket D6 — Rechnungssystem (`server/fiaon-invoice.ts`)**
- Nummernkreis **lückenlos** über Counter-Tabelle `fiaon_counters` (atomares UPDATE…RETURNING), Format `FIAON-INV-2026-00001`, Jahr-Scope; Vergabe genau einmal beim Übergang zu `pending_payment` (idempotent). Rechnungsnummer+Datum am Datensatz (`invoice_number`, `invoice_date`); PDF wird deterministisch on-demand gerendert.
- PDF im CI (#2563eb, FIAON-Wortmarke, bankrechnungs-klar): Entity-Kopf, Empfänger, Rechnungsnr./Datum/Zahlungsreferenz/Antragsnr./Zahlungsziel, Leistungsbeschreibung „[Paket] – Monatlicher Zugang zur FIAON SaaS- und E-Learning-Plattform…" + Leistungszeitraum, Gesamtbetrag EUR, Zahlungsblock (FIAON LTD, BE09 9058 9276 3957, TRWIBEB1XXX, Verwendungszweck, Ziel), Companies-House-Fußzeile.
- **USt konfigurierbar** via env `INVOICE_VAT_MODE` (Default `none`: kein Steuerausweis + „Hinweis zur Umsatzsteuer: folgt nach steuerlicher Registrierung."). `TAX REVIEW REQUIRED`-Marker im Code — niemals 19 % vor Registrierung.
- Downloads: Admin (`GET /admin/payments/:payref/invoice.pdf`, Tabelle+Drawer), Agent (`GET /agent/customers/:ref/invoice.pdf`), öffentlich **signiert mit Ablauf** (`GET /invoice/:payref.pdf?exp&sig`, HMAC, 72h) — `invoice_url` hängt an `payment_details`- und `agent_payment_reminder`-Payloads.

**Betreiber-TODOs (Make.com / Brevo)**
- [ ] In Make.com **vierten Router-Zweig `event_type = agent_payment_reminder`** anlegen (eigenes Brevo-Template „wie soeben besprochen…", Felder: vorname, betrag, payment_reference, agent_name, invoice_url).
- [ ] Brevo-Templates (payment_details + agent_payment_reminder) optional um Button **„Rechnung herunterladen"** = `{{invoice_url}}` ergänzen (Link läuft nach 72h ab).
- [ ] `LEGAL_REVIEW_PACKAGE.md` an LEXR geben; `INVOICE_VAT_MODE` nach Steuer-Registrierung mit Steuerberater festlegen.

**Getestet (echter Server + DB + Webhook-Catcher, Testdaten danach entfernt)**
1. ✅ Volltextsuche alte Entity → 0 Treffer. 2. ✅ Impressum/AGB/Widerruf FIAON LTD zweisprachig, `LEGAL_REVIEW_PACKAGE.md` existiert. 3. ✅ Schwebendes Menü entfernt (keine Verwendung mehr). 4. ✅ claim-paid → sofort in Angekündigt-Liste/Kachel. 5. ✅ Duplikat-Testgruppe korrekt gemerged (Keeper behalten, Soft-Delete, aus Listen verschwunden, ohne confirmed → 400). 6. ✅ Agent-Login (falsches PW 401), sieht nur unbezahlte, Admin-URLs → 403, bezahlter Kunde verschwindet. 7. ✅ Notiz + Rückruf-Termin mit Autor/Zeitstempel, Zusage im Admin sichtbar. 8. ✅ agent_payment_reminder feuert mit agent_name+invoice_url, 2. Klick → 429 (10-Min-Sperre), Log-Eintrag. 9. ✅ Rechnung FIAON-INV-2026-00001 automatisch, PDF valide, ohne USt-Ausweis, Admin+Agent-Download, signierter Link 200 / manipuliert 403 / abgelaufen 403. 10. ✅ Audit-Log zeigt alle 4 Agent-Aktionen.
- Hinweis: Invoice-Counter nach Tests auf 0 zurückgesetzt (kein echter Kunde hatte eine Nummer) → erste echte Rechnung = FIAON-INV-2026-00001.

### Update: Vollausbau Mitarbeiter-System (Pakete E–K)

**Paket E — Design-Overhaul Agent-Portal**
- Komplett neu: monochrome Banking-/CRM-Optik. KEINE Emojis, KEINE bunten Icons — nur Lucide-Linien-Icons in slate, EINE Akzentfarbe (#2563eb) für Primär-Aktionen. Status = Text-Badges mit feinem Rahmen (`Badge` in `client/src/pages/agent/shared.tsx`), Monatsziel als schmale `ProgressBar`. Gemeinsame `AgentShell` (Desktop-Topnav + Mobile-Bottom-Bar, Avatar-Kreis mit Initialen-Fallback). Design-Audit getestet: 0 Emoji-/Ampelfarben-Treffer in `/agent`- und Team-Dateien.

**Paket F — Onboarding & Konto**
- **F1**: Admin legt Agent OHNE Passwort an (Vor-/Nachname, E-Mail, Telefon, Provisionssatz, Monatsziel) → 48h-Einladungs-Token (SHA-256-Hash in DB) + Make-Event **`agent_invite`** (email, vorname, nachname, invite_url, admin_name). „Einladung erneut senden" invalidiert den alten Token.
- **F2**: `/agent/setup/:token` (Policy: min. 10 Zeichen, Zahl, Groß/Klein; danach direkt eingeloggt, Token entwertet). „Passwort vergessen" auf Login + `/agent/passwort?token=` → Make **`agent_password_reset`** (1h-Token), Anti-Enumeration (immer identische Antwort). Admin-„Passwort-Reset erzwingen" erhöht `session_epoch` ⇒ ALLE laufenden Sessions sofort 401 (Token-Format `id.epoch.exp.sig`; Bestands-Sessions vor dem Update werden dadurch einmalig ausgeloggt).
- **F3**: `/agent/profil` — Profilbild (Canvas-Center-Crop auf 256×256 JPEG im Browser, Server validiert Format/Größe ≤600 KB; Hinweis: Verkleinerung clientseitig statt serverseitig, da keine Image-Library im Stack), Telefon selbst änderbar, Passwort ändern (altes nötig), **Bankdaten AES-256-GCM-verschlüsselt** (Key aus SESSION_SECRET, `encryptSecret/decryptSecret` in fiaon-agent.ts), IBAN-MOD-97-Prüfsumme, maskierte Anzeige `DE89 •••• •••• 3000`; jede Änderung → `fiaon_agent_events` + Banner in /admin/team (`bank_change_ack`).

**Paket G — Provisions-Engine**
- **G1**: `fiaon_settings`: `default_commission_rate_bp` (Default 1500 = 15 %), pro Agent überschreibbar. Satz + Basis werden am Provisionseintrag EINGEFROREN (getestet: Satzänderung 15→20 % ließ Alt-Eintrag unverändert).
- **G2**: `assigned_agent_id` + **Auto-Claim** bei erster Aktion (Notiz/Ergebnis/Mail, atomar, `claim`-Logeintrag). Fremd-zugewiesene Kunden: für andere nur read-only Sektion „Von Kollegen betreut", Aktionen serverseitig 403. **15-Min-Soft-Lock** beim Öffnen unzugewiesener Kunden (`locked_by_agent_id/locked_until`), Fremdaktion währenddessen 423, läuft automatisch ab (getestet).
- **G3**: `fiaon_commissions` — Integer-Cents, kaufmännische Rundung (`Math.round`; 99,99 € × 15 % = 1499,85 → **1500 Cents**, getestet). Lebenszyklus `bestaetigt → in_auszahlung → ausgezahlt`, `storniert` via Admin-„Zahlung stornieren/erstatten" (neuer Endpoint `POST /admin/payments/:payref/refund`, setzt `payment_status='refunded'`). Storno nach Auszahlung ⇒ **negativer Verrechnungs-Eintrag** (Guthaben kann negativ werden, nächste Provision gleicht aus — getestet). Hook: mark-paid ruft `onCustomerPaid()` (idempotent; läuft asynchron nach Response, Eintrag erscheint ≤1 s später).
- **G4**: Startseite `/agent` mit 4 Kennzahlen (Potenziell/Bestätigt/In Auszahlung/Ausgezahlt), Einträge-Liste, Monatsziel-Fortschritt (Admin-konfigurierbar je Agent).

**Paket H — Auszahlungen**
- **H1** `/agent/auszahlung`: Button nur aktiv bei Bankdaten + Guthaben ≥ Mindestbetrag (Setting `payout_min_cents`, Default 5000); beantragt IMMER volles Guthaben; nur EINE offene Anforderung (409). **Erzeugt NUR eine Anforderung, niemals eine Transaktion** (Hinweistext „…manuell überwiesen, i. d. R. innerhalb von 5 Werktagen"). Bankdaten-Snapshot verschlüsselt am Payout.
- **H2** in `/admin/zahlungen`: offene Anforderungen mit **voller IBAN (nur hier, nur solange `angefordert`)**, aufklappbaren Positionen, CSV-Export (`/admin/payouts/:id/export.csv`, Semikolon+BOM für Excel). „Als überwiesen markieren" → Einträge `ausgezahlt` + Make **`agent_payout_done`**; „Ablehnen mit Grund" → zurück auf `bestaetigt` + Make **`agent_payout_rejected`** (beides getestet).

**Paket I — Skripte**
- **I1** in `/admin/team`: Anlegen mit Titel/Kategorie (frei) + Text-Inhalt (Server-sanitisiert) ODER PDF ≤10 MB (Base64 in DB); Drag&Drop-Sortierung, aktiv/inaktiv, „zuletzt geändert", Soft-Delete.
- **I2** `/agent/skripte`: Suche + Kategorie-Gruppen, PDF im Viewer. **Kontext-Panel „Gesprächsleitfaden"** in der Kundendetail-Ansicht via Status→Kategorie-Mapping (Setting `script_status_map`, Admin-UI in /admin/team) — getestet.

**Paket J — Kalender**
- **J1** `/agent/kalender`: Tag/Woche (mobil Listen, Desktop Wochen-Spalten), speist sich aus `rueckruf_termin` + „zahlt am"; Überfällige oben mit dezentem Rahmen. Erledigen (`done_at`) + Verschieben direkt im Kalender (je Log-Eintrag; Verschieben setzt `reminder_sent_at` zurück). „Heute fällig" bleibt auf der Startseite.
- **J2**: stündlicher Cron (`runCallbackReminders`, zusätzlich im manuellen `run-reminders`-Lauf): Termine der nächsten 60 Min ohne Reminder → Make **`agent_callback_reminder`** (agent_email, vorname, kunde_name, referenz, termin_zeit), atomarer Claim ⇒ exakt einmal (getestet: Lauf 1 = 1, Lauf 2 = 0, nach Verschieben wieder 1).

**Paket K — Admin „Team" (`/admin/team`)**
- Übersicht je Agent: zugewiesene Kunden, Kontakte heute/Woche, Erreicht-Quote (`erreicht_*`/Ergebnisse), Conversions, generierter Umsatz, Provision offen/in Auszahlung/ausgezahlt, letzter Login, Einladungs-/Bankdaten-Status.
- Detail-Drawer: Einstellungen (Name/Telefon/Satz/Ziel), Deaktivieren, Einladung erneut senden, Passwort-Reset erzwingen, Aktivitäts-Log (Kontakte + Konto-Events), Provisions-Historie, **Kunden-Neuzuweisung einzeln/Auswahl/alle** (`POST /admin/team/reassign`, auch „Zuweisung entfernen").
- Alter Endpoint `POST /admin/agents` hat jetzt Invite-Signatur (firstName/lastName/email statt name/password); Agent-Verwaltung aus `/admin/zahlungen` nach `/admin/team` umgezogen (dort jetzt H2-Auszahlungen).

**Architektur**: Agent-Endpoints in `server/routes/fiaon-agent.ts`, alle neuen Admin-Endpoints in `server/routes/fiaon-team.ts` (hinter `blockAgentsFromAdmin` — Agent-Token auf allen neuen /admin-Routen 403-getestet). Neue Tabellen: `fiaon_commissions`, `fiaon_payouts`, `fiaon_scripts`, `fiaon_settings`, `fiaon_agent_events`; Spalten-Migrationen idempotent in `ensureAgentTables()`.

**Betreiber-TODOs (Make.com — 5 neue Router-Zweige + Brevo-Templates)**
- [ ] `agent_invite` — „Dein Zugang zum FIAON Agent-Portal" (Felder: vorname, nachname, invite_url [48 h], admin_name)
- [ ] `agent_password_reset` — Reset-Link (vorname, reset_url [1 h], optional forced)
- [ ] `agent_payout_done` — Auszahlungs-Bestätigung (vorname, betrag, iban_masked)
- [ ] `agent_payout_rejected` — Ablehnung (vorname, betrag, grund)
- [ ] `agent_callback_reminder` — kurze Erinnerung (agent_email = Empfänger, vorname, kunde_name, referenz, termin_zeit)

**Getestet (echter Server + DB + Webhook-Catcher; Testdaten/-Agents danach entfernt, Settings zurückgesetzt, Invoice-Counter unangetastet — 34 echte Rechnungen existieren)**
1. ✅ Invite-Event + Setup-URL; Token nach Nutzung/Reinvite 410. 2. ✅ Schwaches Passwort 400, Setup loggt ein. 3. ✅ Anti-Enumeration (identische Antworten, nur 1 Event), Force-Reset ⇒ alte Session 401, Reset-Token loggt ein. 4. ✅ Falsche IBAN-Prüfsumme 400; gültige maskiert; Admin-Banner (`bank_change_ack=false`); Avatar-Upload. 5. ✅ Soft-Lock (B: readOnly + 423), Auto-Claim per Notiz, B 403 + nur Kollegen-Sektion, Lock-Ablauf ⇒ B claimt. 6. ✅ 9999 Cents × 1500 bp = 1500 Cents; Satzwechsel friert Alt-Eintrag ein; Potenziell-Anzeige korrekt. 7. ✅ Storno vor Auszahlung ⇒ storniert; nach Auszahlung ⇒ −80 €-Verrechnungseintrag, Saldo negativ, Folgeprovision verrechnet. 8. ✅ Ohne IBAN 400 / unter Min 400 / Doppelantrag 409; Admin sieht volle IBAN + CSV; überwiesen ⇒ ausgezahlt + payout_done; abgelehnt ⇒ bestätigt + payout_rejected inkl. Grund. 9. ✅ Text+PDF-Skript, Mapping blendet Kontext-Skript nach Status ein, PDF-Auslieferung. 10. ✅ Termin in Kalender, Reminder exakt 1× im 60-Min-Fenster, Verschieben re-armiert Reminder, Erledigen. 11. ✅ Team-Statistik konsistent (Kontakte/Conversions/Umsatz/Provisionsstände/Login). 12. ✅ Design-Audit: 0 Emojis, 0 Ampelfarben-Klassen in /agent + /admin/team; Agent-403 auf allen neuen Admin-Routen.

### Offene Punkte
- [ ] **Env-Variablen entfernen**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY`/`VITE_STRIPE_PUBLIC_KEY` aus dem Deployment löschen (Code ist mit Null-Guards abgesichert).
- [ ] **Stripe Payment Links im Stripe-Dashboard deaktivieren** (alte gespeicherte URLs könnten sonst noch funktionieren).
- [x] ~~AGB §5 / privacy / cookie-einstellungen: Stripe-Passus ersetzen~~ — erledigt (siehe Paket A + `LEGAL_REVIEW_PACKAGE.md`).
- [ ] Admin-Umsatz-Dashboards (`/admin/stripe/*`) zeigen nach Env-Entfernung keine Daten mehr — bei Bedarf auf `fiaon_applications.amount_due/paid` umstellen.
- [ ] `FIAON_BASE_URL` env setzen (Default `https://fiaon.de`) für korrekte Links in E-Mails.
- [ ] **`MAKE_WEBHOOK_URL` im Deployment setzen** — ohne diese env werden die Make-Events (welcome/payment_details/followup_48h) nur geloggt und übersprungen.
- [ ] Admin-Routen (`/api/fiaon/admin/*`) sind — wie die bestehenden Admin-Endpoints — nicht zusätzlich authentifiziert; folgt dem bestehenden Muster von `/admin/database`.
