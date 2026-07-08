# FIAON — INTERACTION AUDIT (Phase 0)

Route-für-Route-Audit nach `SITE_MAP.md`. Legende Zustände: **P** = Press-Feedback, **L** = Ladezustand (Async-Button/Skeleton), **E/F** = Erfolg/Fehler-Feedback, **In** = Eintritts-Animation, **Ø** = Empty-State.
„—" = nicht zutreffend (keine Interaktion/Daten). Status: ☐ offen → ☑ erledigt.

## Zentrale Befunde (vor Umsetzung)

- **Kein plattformweites Press-Feedback**: Buttons reagieren nur mit Farb-Hover, kein Active-State → Klicks wirken „tot". Einzige Ausnahme: Agent-Portal (`active:scale-[.99]` in `SubmitButton`).
- **Kein Navigations-Feedback**: Routenwechsel (wouter) springen hart, keine Fortschrittsleiste, kein Seiten-Eintritt (nur Agent-Portal + einzelne Seiten haben eigene Reveals).
- **Toast-System vorhanden aber ungenutzt**: shadcn `<Toaster/>` ist in `App.tsx` gemountet, aber KEINE Seite ruft `toast()` auf. Erfolge zeigen sich nur durch Daten-Reload.
- **Skeletons fehlen fast überall**: nur `admin-database` (7×), `dashboard` (8×), `antrag` (3×) nutzen `animate-pulse`; Admin-Zahlungstabelle, Team, Rechnungen, Audit, Events laden in leere Flächen.
- **Async-Buttons uneinheitlich**: teils `disabled={loading}` + Textwechsel (Login), teils gar nichts (`abo-kuendigen`, Antrag-Absenden), nirgends Erfolg-Häkchen oder Fehler-Shake.
- **Agent-Portal (Paket S)** hat bereits: `Reveal`, `CountUp`, `SubmitButton` mit Spinner, `agent-skeleton`, `SuccessPulse`, reduced-motion — dient als Vorbild, wird NICHT angefasst, nur Lücken ergänzt.

## Admin (`/admin/*`, AdminShell)

| Route | Interaktive Elemente | Fehlende Zustände | Status |
|---|---|---|---|
| `/admin` (Hub) | KPI-Kacheln, Navigations-Karten | P (Karten ohne Press), L (KPIs laden ohne Skeleton), In | ☑ |
| `/admin/zahlungen` | Suche, Filter-Tabs, Zeilen→Drawer, mark-paid, Erinnerung, Bulk-Job, Duplikate, Auszahlungen | P, L (Tabelle ohne Skeleton; mark-paid/Mail ohne Button-Spinner), E/F (kein Toast/Häkchen/Shake), Drawer poppt hart, Timeline ungestaffelt, In | ☑ |
| `/admin/rechnungen` | Suche, PDF-Download | P, L (Tabelle ohne Skeleton), In | ☑ |
| `/admin/database` | Alt-Cockpit (eigenes Dark-UI, hat pulse-Loader) | bewusst unverändert (SITE_MAP: „bewusst unverändert") — nur globales Press-Feedback via Basis-Layer | ☑ |
| `/admin/team` | Agent-Liste→Drawer, Einladen, Zuweisung, Skripte, IBAN-Reveal, Payout-Aktionen | P, L (Liste ohne Skeleton; Aktionen ohne Spinner), E/F (kein Toast), Drawer/Modal hart, In | ☑ |
| `/admin/verbuchungen` | Liste, Aktionen | P, L (hat teils pulse), E/F, In | ☑ |
| `/admin/events` | Event-Auswahl, Test-Send, Real-Send + Preview-Modal | P, L (Buttons haben busy-Flags, aber kein Spinner), E/F (Ergebnis nur als Textzeile), Modal hart, In | ☑ |
| `/admin/einstellungen` | Speichern-Buttons, Toggles | P, L (Speichern ohne Spinner), E/F (kein Erfolgs-Feedback), In | ☑ |
| `/admin/audit` | Suche, Liste | P, L (Liste ohne Skeleton), Ø vorhanden, In | ☑ |
| `/admin/recht` | Links (read-only) | P, In | ☑ |
| AdminShell selbst | Sidebar-Punkte, ⌘K-Suche, Breadcrumb, Zurück | P (Menüpunkte ohne Press), Navigations-Fortschritt fehlt, ⌘K-Modal poppt hart, Seiten-Eintritt fehlt | ☑ |

## Agent (`/agent/*`, AgentShell) — Paket S größtenteils vorhanden

| Route | Interaktive Elemente | Fehlende Zustände | Status |
|---|---|---|---|
| `/agent` (Login + Start) | Login-Form (SubmitButton ✓), Arbeitsliste, Kontakt-Ergebnis-Buttons | Kontakt-Buttons: Press ≤150ms fehlt teils (global gelöst); Listen-Skeleton vorhanden ✓ | ☑ |
| `/agent/setup/:token` | Passwort-Form | SubmitButton ✓, Reveal ✓ — keine Lücke | ☑ |
| `/agent/passwort` | Reset-Form | SubmitButton ✓ — keine Lücke | ☑ |
| `/agent/kalender` | Tag/Woche-Tabs, Erledigen/Verschieben | P (global), busy-Flags vorhanden ✓ | ☑ |
| `/agent/skripte` | Suche, PDF-Viewer | Loading vorhanden ✓, P global | ☑ |
| `/agent/auszahlung` | Auszahlung beantragen | busy vorhanden ✓; Erfolgs-Toast fehlt (SuccessPulse vorhanden) | ☑ |
| `/agent/profil` | Avatar, Telefon, Passwort, Bank | busy-Flags vorhanden ✓, P global | ☑ |

## Öffentlich / Kunde

| Route | Interaktive Elemente | Fehlende Zustände | Status |
|---|---|---|---|
| `/` (FiaonHome) | CTAs, Karten | P (global), In (hat eigene Scroll-Reveals ✓) | ☑ |
| `/start`, `/karte-sichern` | Funnel-CTAs | P, L (Submit ohne Spinner), In | ☑ |
| `/privatkunden` (fiaon-landing) | CTAs | P, In | ☑ |
| `/business`, `/business-antrag` | Funnel + Mehrschritt-Form | P, L (Submit teils ohne Zustand), Schrittwechsel hart | ☑ |
| `/antrag` | Mehrschritt-Antrag: Weiter/Zurück, Pakete, Absenden, Passwort-Setup | P, Schrittwechsel HART (kein Slide/Fade), Absenden ohne Ladezustand, Fortschrittsbalken springt | ☑ |
| `/login` | Login-Form | L (Textwechsel, aber kein Spinner), F (Fehler poppt hart, kein Shake), Erfolg = harter Redirect | ☑ |
| `/dashboard` | Viele Aktionen, KYC-Upload, Timeline | Skeletons teils vorhanden (pulse ✓), P, E/F (kein Toast), In | ☑ |
| `/passwort-vergessen` | 2-Schritt-Reset | P, L (kein Spinner), E/F | ☑ |
| `/zahlung/:ref` | Copy-Buttons (haben „Kopiert ✓" ✓), QR-speichern, „Überweisung getätigt" (claiming-Flag ✓) | QR-speichern ohne Lade→Erfolg-Zustand, Claim-Button ohne Spinner (Flag existiert, nicht sichtbar), Übergang zur Danke-Seite hart | ☑ |
| `/zahlung/:ref/danke` | statisch | In | ☑ |
| `/abo-kuendigen` | Kündigungsformular | P, L (KEIN Ladezustand bei fetch!), E/F, Doppelklick-Schutz fehlt | ☑ |
| `/bonitaet*` (4 Routen) | Funnel-Form | P, L (Submit ohne Zustand), In | ☑ |
| `/was-ist-fiaon`, `/plattform-konzept` | statisch | P (Links), In | ☑ |
| Rechtstexte (6 Routen) | statisch | In (global gelöst) | ☑ |
| `/banking`, `/banking/dashboard` | Investor-Login + Portfolio | P, L (Login ohne Spinner; Dashboard hat busy-Flags), E/F | ☑ |
| `*` (404, rollenbewusst) | Auswege-Buttons | P, In | ☑ |
| Fehlerseiten Agent-Token (403 in AdminShell), Setup/Reset-Token abgelaufen | Erklärseiten mit CTA | In (Agent hat Reveal ✓; Admin-403 In fehlt) | ☑ |

## Umsetzungs-Ergebnis

**Global (wirkt auf JEDER Route, ohne Einzel-Edit):**
- **Press-Feedback**: `:where(button:not(:disabled), [role=button], .fx-press)` → scale(.98) + brightness(.96), 100ms — jeder Button der Plattform reagiert jetzt spürbar. `:where()` hält Spezifität bei 0, bestehende Tailwind-Transitions bleiben intakt.
- **Seiten-Eintritt**: `PageEnter` (keyed auf wouter-Location) einmal in `App.tsx` — opacity + 8px Y, 250ms, ease-out, jede Route.
- **Navigations-Feedback**: `RouteProgress` (2px-Leiste oben, Akzent, blendet nach ~800ms aus) einmal in `App.tsx`.
- **Formular-Fokus**: weicher border/box-shadow-Übergang (150ms) für alle `input/select/textarea`.
- **reduced-motion**: zentraler Block deaktiviert alle `fx-*`-Dekorationen; Spinner + Fortschritt bleiben (funktional).

**Gezielt ergänzt (über die Globals hinaus):**
- **Logins** (`/login`, `/banking`): Spinner-Button breitenstabil (`BtnLabel`), Fehler-Shake (`useShakeClass`), Fehler-Einblendung. `/passwort-vergessen`, `/abo-kuendigen`: hatten bereits Spinner — Fehler-Einblendung ergänzt.
- **`/antrag`**: keyed `fx-step-in`-Wrapper (horizontaler Slide/Fade 250ms je Schrittwechsel), Progress-Füllung blendet weich, „Konto erstellen" mit Ladezustand + Doppelklick-Schutz, Paket-Switcher-Modal mit Overlay-/Sheet-Animation.
- **`/zahlung/:ref`**: „QR-Code speichern" mit Lade→Erfolg-Zustand + Doppelklick-Schutz; Claim-Button mit sichtbarem Spinner; Copy-Feedback („Kopiert ✓") war vorhanden.
- **`/bonitaet-antrag`, `/business-antrag`**: Spinner beim Weiterleiten zur Zahlung (Zustand existierte, war unsichtbar).
- **AdminShell**: ⌘K-Modal + Mobile-Drawer mit Scale/Fade bzw. Slide, Suchergebnisse gestaffelt, Sidebar-Punkte mit Press, 403-Seite mit Eintritt.
- **`/admin/zahlungen`**: Tabellen-Skeleton (6 pulsierende Zeilen), Zeilen + Timeline gestaffelt, mark-paid/Reaktivieren mit Spinner, Detail-Drawer + Bulk-Dialog weich, Flash-Meldung mit Toast-Bewegung, Empty-State blendet ein.
- **`/admin/team`**: Drawer/Einladungs-Modal weich, IBAN-Reveal mit Spinner, Flash mit Toast-Bewegung.
- **`/admin` (Hub)**: KPI-Skeletons statt „—" (Werte blenden ein), Karten mit Press + Staffelung.
- **`/admin/rechnungen`, `/admin/audit`, `/admin/verbuchungen`, `/admin/events`**: Skeletons statt „Lädt …", Zeilen gestaffelt; Events: Send-Buttons mit Spinner, Bestätigungs-Modal weich.
- **`/admin/einstellungen`**: Speichern-Buttons mit Spinner, Flash mit Toast-Bewegung.
- **Agent**: nur Lücke geschlossen — Auszahlung-Beantragen-Button mit Spinner (Rest war Paket S); Kontakt-Ergebnis-Buttons bekommen das globale ≤100ms-Press (bewusst KEINE langen Animationen).

**Bewusst nur global abgedeckt (dokumentierte Ausnahmen):**
- `/admin/database` (Alt-Cockpit, lt. SITE_MAP „bewusst unverändert", hat eigene pulse-Loader) — nur globales Press/Eintritt.
- `/admin/recht` (read-only, eine „Lädt …"-Textzeile) — nur global.
- Kunden-`/dashboard` + `/banking/dashboard` (hatten bereits eigene pulse-Skeletons + busy-Flags) — global Press/Eintritt; kein Toast-System nachgerüstet (bestehende Inline-Feedbacks bleiben die Wahrheit).
- Statische Seiten (Rechtstexte, Info, 404, Danke) — Eintritt + Press global, mehr braucht es nicht.
- Toasts: einheitliche Helfer `notifySuccess/notifyError` stehen in `fx.tsx` bereit (shadcn-Toaster ist gemountet); die Admin-Seiten behalten ihr bestehendes Flash-System (jetzt mit Toast-Bewegung) — kein Doppel-System eingeführt.

## Umsetzung (zentrale Schicht — „aus einem Guss")

1. **Timing-Tokens + Basis-Layer** (`index.css`): `--fx-fast:120ms / --fx-base:220ms / --fx-slow:400ms`, ease-out Standard; globales Press-Feedback für `button`/`[role=button]`/`.fx-press` (scale .98 + brightness, 100ms); nur transform/opacity.
2. **`fx.tsx`** (`client/src/components/feedback/fx.tsx`): `RouteProgress` (2px-Leiste oben bei Routenwechsel), `PageEnter` (Seiten-Eintritt opacity+8px, 250ms, über App gelöst), `Spinner`, `useAsyncFx` (busy→ok→shake, Doppelklick-Schutz rein visuell an bestehende Handler angebunden), `SkeletonRows`, `notify` (Toast-Wrapper auf vorhandenes shadcn-System).
3. **Skeletons**: pulsierende Platzhalter in Form des Inhalts für Admin-Tabellen/Listen (zahlungen, team, rechnungen, audit, hub-KPIs).
4. **Staffelung**: `.fx-stagger` (30ms Versatz, max. 10 Kinder).
5. **Modals/Drawer**: `.fx-modal`/`.fx-overlay`/`.fx-drawer`-Klassen (scale/fade bzw. slide, 200–250ms).
6. **reduced-motion**: ein zentraler Block deaktiviert alle `fx-*`-Dekorationen; Spinner/Fortschritt bleiben (funktional).
