# FIAON — SITE MAP (Paket M)

Vollständiges Routen-Inventar. Stand: Navigations-Überholung (Pakete L–O).
Zielgruppen: **Öff.** = öffentlich · **Kunde** = eingeloggter Kunde · **Agent** = Mitarbeiter-Portal · **Admin** = Verwaltung.

## Admin-Bereich (`/admin/*`) — alle in der `AdminShell` (Sidebar + Breadcrumb + Zurück + ⌘K-Suche)

| Pfad | Zweck | Verlinkt von |
|---|---|---|
| `/admin` | **Kommandozentrale**: 4 Tages-KPIs + Karten zu JEDER Admin-Seite | Sidebar, Breadcrumb, 404 |
| `/admin/zahlungen` | Zahlungszentrale: prüfen, freischalten, Timeline, Duplikate, **Auszahlungen** (`#auszahlungen`), Audit-Toggle | Hub, Sidebar, ⌘K (`?ref=` öffnet Drawer) |
| `/admin/rechnungen` | Rechnungs-Nummernkreis durchsuchen + PDF-Download (read-only) | Hub, Sidebar |
| `/admin/database` | Alt-Cockpit: Anträge, KYC/Prüfbereit, Aufgaben, Investoren, Buchhaltung (eigenes Dark-UI, bewusst unverändert) | Hub, Sidebar |
| `/admin/team` | Team-Übersicht: Statistik, Provisionen, Zuweisung; `?einladen=1` öffnet Einladung; `#skripte` = Skript-Verwaltung | Hub, Sidebar, ⌘K |
| `/admin/einstellungen` | Provisionssatz, Mindest-Auszahlung + System-Diagnose (Base-URL-Quelle, INVOICE_VAT_MODE read-only, Make-Webhook-Status je Event) | Hub, Sidebar |
| `/admin/audit` | Mitarbeiter-Audit-Log, durchsuchbar (read-only) | Hub, Sidebar |
| `/admin/recht` | Rechtstexte-Review-Status: LEGAL_REVIEW_PACKAGE.md + Links auf Live-Texte (read-only) | Hub, Sidebar |

Vor diesem Update waren **alle** Admin-Seiten Waisen (nur Direkt-URL); `/admin` selbst war 404. Keine Admin-Seite ist mehr ohne Hub-Karte **und** Sidebar-Eintrag.

## Agent-Bereich (`/agent/*`) — eingeloggt in der `AgentShell` (Topnav + Mobile-Bottom-Bar)

| Pfad | Zweck | Hinweis |
|---|---|---|
| `/agent` | Login **oder** Startseite (Kennzahlen, Arbeitsliste, „Heute fällig") | Wordmark → `/` (Login) bzw. `/agent` |
| `/agent/setup/:token` | Passwort festlegen nach Einladung (48 h) | ungültig/abgelaufen ⇒ Erklärseite + „Zur Anmeldung" |
| `/agent/passwort` | Reset anfordern (ohne Token) / neues Passwort (mit `?token=`, 1 h) | abgelaufener Token ⇒ Inline-CTA „Neuen Reset-Link anfordern" |
| `/agent/kalender` | Rückrufe + Zahlungs-Zusagen, Tag/Woche, erledigen/verschieben | AgentShell-Nav |
| `/agent/skripte` | Leitfäden, durchsuchbar, PDF-Viewer | AgentShell-Nav |
| `/agent/auszahlung` | Guthaben + Auszahlungs-Anforderung + Historie | AgentShell-Nav |
| `/agent/profil` | Avatar, Telefon, Passwort, Bankdaten (verschlüsselt) | AgentShell-Nav |

Agent-Token auf `/admin/*` ⇒ serverseitig 403; die AdminShell zeigt dazu eine Erklärseite mit Button zurück ins Agent-Portal.

## Öffentlich / Kunde

| Pfad | Zweck | Navigation |
|---|---|---|
| `/` | Startseite (FiaonHome) | GlassNav + Footer |
| `/start`, `/karte-sichern` (Alias) | Funnel-Start | GlassNav |
| `/privatkunden` | Landing (rendert `fiaon-landing.tsx`) | GlassNav |
| `/business`, `/business-antrag` | Business-Funnel | GlassNav |
| `/antrag` | Privat-Antrag | GlassNav |
| `/login`, `/dashboard` | Kunden-Login + Dashboard | GlassNav / eigenes Dashboard-UI |
| `/passwort-vergessen` | Kunden-Passwort-Reset (Identitätsprüfung) | GlassNav |
| `/zahlung/:paymentRef` (+ `/danke`) | Zahlungsseite mit QR (aus E-Mail verlinkt) | GlassNav |
| `/abo-kuendigen` | Kündigungsformular | GlassNav |
| `/bonitaet`, `/bonitaet-antrag`, `/bonitaet-service`, `/bonitaet-danke` | Bonitäts-Funnel | GlassNav |
| `/was-ist-fiaon`, `/plattform-konzept` | Info-Seiten | GlassNav |
| `/terms`, `/privacy`, `/impressum`, `/agb`, `/widerrufsbelehrung`, `/cookie-einstellungen` | Rechtstexte | GlassNav; verlinkt aus `/admin/recht` |
| `/banking`, `/banking/dashboard` | Investoren-Login + Portfolio (eigenes Banking-UI) | eigener Header mit Logout |
| Fallback `*` | **Rollenbewusste 404** (Admin-/Agent-/Öffentlich-Auswege) | — |

## Waisen / Altlasten

- **`client/src/pages/privatkunden.tsx`**: Datei existiert, ist aber in keiner Route registriert (`/privatkunden` nutzt `fiaon-landing.tsx`). Nicht gelöscht — als ungenutzter Alt-Stand markiert.
- **Keine toten Routen gefunden**, daher keine Redirects nötig. `/karte-sichern` ist ein bewusster Alias auf `/start` (kein Duplikat-Problem).
- KYC/Aufgaben/Prüfbereit sind **Sektionen innerhalb** von `/admin/database` (keine eigenen Routen).

## Server-Routen-Gruppen (API, `/api/fiaon/*`)

| Gruppe | Datei | Auth |
|---|---|---|
| Public: Antrag, Payment-Order, Zahlungsseite, Claim-paid, Invoice-Download (signiert) | `server/routes/fiaon-antrag.ts` | öffentlich / signierte Links |
| Agent-Portal (Login, Kunden, Provisionen, Auszahlung, Skripte, Kalender, Profil) | `server/routes/fiaon-agent.ts` | Agent-Cookie (12 h, Session-Epoch) |
| Admin: Zahlungen, Duplikate, Reminder, Refund | `server/routes/fiaon-antrag.ts` (admin-Teil) | Agent-Token ⇒ 403 |
| Admin: Team, Agents, Payouts, Skripte, Settings | `server/routes/fiaon-team.ts` | Agent-Token ⇒ 403 |
| Admin-Hub: KPIs, ⌘K-Suche, Rechnungen, System-Status, Legal-Review | `server/routes/fiaon-admin-hub.ts` | Agent-Token ⇒ 403 |

## Base-URL (Paket L)

Alle generierten absoluten Links (Invite, Reset, Rechnung, Zahlungsseite in Mails) laufen ausschließlich über `absoluteUrl()` aus `server/fiaon-base-url.ts`:
`APP_BASE_URL` → `FIAON_BASE_URL` (legacy) → Fallback **`https://www.fiaon.com`** (nie `.de`, nie localhost; fehlende ENV loggt Warnung).
