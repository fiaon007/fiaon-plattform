import { lazy, Suspense, type ComponentType } from "react";
import { Umleitung } from "@/components/Umleitung";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { useSeitenTitel } from "@/lib/fiaon-titel";
import { FiaonRaum } from "@/components/FiaonRaum";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import { KundenansichtBanner } from "@/components/KundenansichtBanner";
import FiaonHome from "@/pages/fiaon-home";
import FiaonLanding from "@/pages/fiaon-landing";
import StartPage from "@/pages/start";
import BusinessPage from "@/pages/business";
// Antrags- und Kundenstrecken: umfangreich und fuer Agenten irrelevant.
// Sie werden erst beim Aufruf geladen, damit das Agent-Portal auf dem Handy
// nicht die komplette Kundenstrecke mitziehen muss.
const AntragPage = lazy(() => import("@/pages/antrag"));
const BusinessAntragPage = lazy(() => import("@/pages/business-antrag"));
const Terms = lazy(() => import("@/pages/terms"));
const Privacy = lazy(() => import("@/pages/privacy"));
import NotFound from "@/pages/not-found";
const AdminKundenPage = lazy(() => import("@/pages/admin-kunden"));
const AdminKundeAktePage = lazy(() => import("@/pages/admin-kunde"));
const AdminAntraegePage = lazy(() => import("@/pages/admin-antraege"));
const AdminFunktionenPage = lazy(() => import("@/pages/admin-funktionen"));
const WasIstFiaonPage = lazy(() => import("@/pages/site/was-ist-fiaon"));
import PlattformKonzeptPage from "@/pages/plattform-konzept";
import LoginPage from "@/pages/login";
const DashboardPage = lazy(() => import("@/pages/dashboard"));
// Mein Bereich — der neue Kundenbereich (E-013). Bis zur Abnahme unter eigener Route.
const MeinBereichPage = lazy(() => import("@/pages/mein-bereich"));
import ImpressumPage from "@/pages/impressum";
import AGBPage from "@/pages/agb";
import WiderrufsbelehrungPage from "@/pages/widerrufsbelehrung";
import CookieEinstellungenPage from "@/pages/cookie-einstellungen";
import PasswortVergessenPage from "@/pages/passwort-vergessen";
const AboKuendigenPage = lazy(() => import("@/pages/abo-kuendigen"));
const BonitaetPage = lazy(() => import("@/pages/bonitaet"));
const BonitaetAntragPage = lazy(() => import("@/pages/bonitaet-antrag"));
const BonitaetServicePage = lazy(() => import("@/pages/bonitaet-service"));
const BonitaetDankePage = lazy(() => import("@/pages/bonitaet-danke"));
const InvestorLoginPage = lazy(() => import("@/pages/investor-login"));
const InvestorDashboardPage = lazy(() => import("@/pages/investor-dashboard"));
import ZahlungPage, { ZahlungDankePage } from "@/pages/zahlung";
import NummerAktualisierenPage from "@/pages/nummer-aktualisieren";
const AdminZahlungenPage = lazy(() => import("@/pages/admin-zahlungen"));
const AdminHubPage = lazy(() => import("@/pages/admin-hub"));
const AdminRechnungenPage = lazy(() => import("@/pages/admin-rechnungen"));
const AdminAbrechnungenPage = lazy(() => import("@/pages/admin-abrechnungen"));
const AdminVerbuchungenPage = lazy(() => import("@/pages/admin-verbuchungen"));
const AdminEventsPage = lazy(() => import("@/pages/admin-events"));
const AdminEinstellungenPage = lazy(() => import("@/pages/admin-einstellungen"));
const AdminAuditPage = lazy(() => import("@/pages/admin-audit"));
const AdminRechtPage = lazy(() => import("@/pages/admin-recht"));
import AdminShell from "@/components/admin/AdminShell";
import AgentPortalPage from "@/pages/agent";
import AgentSetupPage from "@/pages/agent/setup";
import AgentPasswortPage from "@/pages/agent/passwort";
import AgentProfilPage from "@/pages/agent/profil";
import AgentAuszahlungPage from "@/pages/agent/auszahlung";
import AgentSkriptePage from "@/pages/agent/skripte";
import AgentKalenderPage from "@/pages/agent/kalender";
import AgentPartnerProgrammPage from "@/pages/agent/partner-programm";
// Nachgeladen statt statisch importiert: Die Seite wird nur von den Agenten
// gebraucht und würde das Hauptbündel für alle anderen Besucher vergrössern.
const TerminPage = lazy(() => import("@/pages/termin"));
// Die Zustimmungsseite: Nur der Kunde selbst darf AGB, Bonitaetspruefung und
// Vertrag bestaetigen (server/lib/fiaon-zustimmung.ts).
const ZustimmungPage = lazy(() => import("@/pages/zustimmung"));
const TerminAbsagenPage = lazy(() => import("@/pages/termin").then((m) => ({ default: m.TerminAbsagenPage })));
const AbmeldenPage = lazy(() => import("@/pages/abmelden"));
const AlsKundePage = lazy(() => import("@/pages/als-kunde"));
// ══════════════════════════════════════════════════════════════════════════
// `pages/agent/heute.tsx` UND `pages/agent/meine-kunden.tsx` SIND WEG (19.08.2026)
//
// Beide hingen an KEINER Route mehr: `/agent/heute` leitet seit dem 05.08. auf
// `/agent/start` um, `/agent/meine-kunden` auf `/agent/kunden`. `heute.tsx` war
// hier noch lazy importiert — ein Import ohne Route, also toter Code mit
// Verwechslungsgefahr.
//
// Das ist die Falle, die AGENTS.md zweimal beschreibt: Am 25.08. wurden ein
// Knopf und eine Notizpflicht in `kunden.tsx` gebaut, während `/agent/kunden`
// längst `kunden-neu.tsx` zeigte. Genau dieser Fix wurde beim Aufräumen am
// 28.08. mitgelöscht — und „Erreicht – Sonstiges" ein drittes Mal gemeldet.
//
// `heute.tsx` trug eine eigene Fassung der Ergebnisliste (sieben Werte). Wer
// dort gesucht hätte, hätte sie gefunden und geändert — ohne Wirkung.
// `scripts/pruef-ergebnis-eine-liste.ts` hält die Zahl der Fassungen jetzt fest.
// ══════════════════════════════════════════════════════════════════════════
const AgentAufgabenPage = lazy(() => import("@/pages/agent/aufgaben"));
const AgentAnliegenPage = lazy(() => import("@/pages/agent/anliegen"));
const AgentStartPage = lazy(() => import("@/pages/agent/start"));
const AgentKundenNeuPage = lazy(() => import("@/pages/agent/kunden-neu"));
const AdminTerminePage = lazy(() => import("@/pages/admin-termine"));
const AdminSchulungPage = lazy(() => import("@/pages/admin-schulung"));
const AgentSpacePage = lazy(() => import("@/pages/agent/space"));
const AgentInkassoPage = lazy(() => import("@/pages/agent/inkasso"));
const AdminTeamZentralePage = lazy(() => import("@/pages/admin-team-zentrale"));
const MailZentralePage = lazy(() => import("@/pages/mail-zentrale"));
const AgentStartgespraechePage = lazy(() => import("@/pages/agent/startgespraeche"));
const AgentVertriebPage = lazy(() => import("@/pages/agent/vertrieb"));
import AgentVerdienstPage from "@/pages/agent/verdienst";
import AgentUpdatesPage from "@/pages/agent/updates";
import AgentFeedbackPage from "@/pages/agent/feedback";
import AgentMehrPage from "@/pages/agent/mehr";
const AgentAcademyPage = lazy(() => import("@/pages/agent/academy"));
const AgentSchulungPage = lazy(() => import("@/pages/agent/schulung"));
const AdminAgentPortalPage = lazy(() => import("@/pages/admin-agent-portal"));
const AdminLeadsPage = lazy(() => import("@/pages/admin-leads"));
const AdminFinanzenPage = lazy(() => import("@/pages/admin-finanzen"));
const AdminKontoabgleichPage = lazy(() => import("@/pages/admin-kontoabgleich"));
const AdminVerbuchungPage = lazy(() => import("@/pages/admin-verbuchung"));
const AdminPersonenPage = lazy(() => import("@/pages/admin-personen"));
const AdminChangelogPage = lazy(() => import("@/pages/admin-changelog"));
const AdminDiagnosePage = lazy(() => import("@/pages/admin-diagnose"));
const AdminDublettenPage = lazy(() => import("@/pages/admin-dubletten"));
const AdminKuendigungenPage = lazy(() => import("@/pages/admin-kuendigungen"));
const AdminInvestorenPage = lazy(() => import("@/pages/admin-investoren"));
const AdminBuchhaltungPage = lazy(() => import("@/pages/admin-buchhaltung"));
import AgentLeistungPage from "@/pages/agent/leistung";
import AgentDokumentePage from "@/pages/agent/dokumente";
const AdminVertraegePage = lazy(() => import("@/pages/admin-vertraege"));
const AdminFahrplanPage = lazy(() => import("@/pages/admin-fahrplan"));
const AdminKarteiPage = lazy(() => import("@/pages/admin-kartei"));
const AdminAuszahlungenPage = lazy(() => import("@/pages/admin-auszahlungen"));
const AdminAufgabenPage = lazy(() => import("@/pages/admin-aufgaben"));
const AdminTodoPage = lazy(() => import("@/pages/admin-todo"));
// Die neue Website (22.08.2026): Startseite + fünf Seiten für Investoren, Presse, Datenraum, Partner, Karriere.
const SiteInvestoren = lazy(() => import("@/pages/site/investoren"));
const SitePresse = lazy(() => import("@/pages/site/presse"));
const SiteDatenraum = lazy(() => import("@/pages/site/datenraum"));
const SitePartner = lazy(() => import("@/pages/site/partner"));
const SiteKarriere = lazy(() => import("@/pages/site/karriere"));
const SiteTeam = lazy(() => import("@/pages/site/team"));
const SiteDemo = lazy(() => import("@/pages/site/demo"));
const DemoKundenbereich = lazy(() => import("@/pages/demo-kundenbereich"));

// Paket N1: JEDE /admin-Seite läuft in der AdminShell (Sidebar, Breadcrumb,
// Zurück, Cmd+K). Serverseitige Guards bleiben unberührt.
//
// Die Admin-Seiten werden per `lazy` erst beim Aufruf geladen. Vorher lagen
// alle 28 im Haupt-Bundle — ein Agent auf dem Handy hat damit den kompletten
// Admin-Bereich mitgeladen, den er nie zu Gesicht bekommt.
function admin(Component: ComponentType) {
  return () => (
    <AdminShell>
      <Component />
    </AdminShell>
  );
}

/** Dezenter Platzhalter, solange ein nachgeladener Seitenteil unterwegs ist. */
function SeiteLaedt() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
      <div className="agent-skeleton h-8 w-52 rounded-lg" />
      <div className="agent-skeleton h-40 rounded-2xl" />
      <div className="agent-skeleton h-64 rounded-2xl" />
    </div>
  );
}

function Router() {
  // Der Tab bekommt den Bereichsnamen. Vorher trug jeder Tab denselben
  // Werbetitel — bei drei offenen Tabs half das niemandem.
  const [tabPfad] = useLocation();
  useSeitenTitel(tabPfad);

  return (
    <Suspense fallback={<SeiteLaedt />}>
    <Switch>
      <Route path="/" component={FiaonHome} />
      <Route path="/investoren" component={SiteInvestoren} />
      <Route path="/presse" component={SitePresse} />
      <Route path="/datenraum" component={SiteDatenraum} />
      <Route path="/partner" component={SitePartner} />
      <Route path="/karriere" component={SiteKarriere} />
      <Route path="/team" component={SiteTeam} />
      <Route path="/demo" component={SiteDemo} />
      <Route path="/demo/kundenbereich" component={DemoKundenbereich} />
      <Route path="/demo/produkt" component={MeinBereichPage} />
      <Route path="/start" component={StartPage} />
      <Route path="/karte-sichern" component={StartPage} />
      <Route path="/business" component={BusinessPage} />
      <Route path="/privatkunden" component={FiaonLanding} />
      <Route path="/antrag" component={AntragPage} />
      <Route path="/business-antrag" component={BusinessAntragPage} />
      <Route path="/login" component={LoginPage} />
      {/* Seit 22.08.2026 (E-013): /dashboard IST der neue Bereich. Das alte Dashboard
          bleibt unter /dashboard-alt erreichbar, bis die letzten Funktionen (KYC-
          Prüfansicht, Bank-Anleitungen) in den neuen Bereich gewandert sind. */}
      <Route path="/dashboard" component={MeinBereichPage} />
      <Route path="/mein-bereich" component={MeinBereichPage} />
      <Route path="/dashboard-alt" component={DashboardPage} />
      {/* Nach der Anmeldung landet auch der Vorgesetzte im SPACE — dort steht,
          was das Haus heute gemacht hat. Das Dashboard bleibt als eigener
          Punkt erreichbar: /admin/dashboard. */}
      <Route path="/admin" component={() => <Umleitung nach="/admin/space" />} />
      <Route path="/admin/dashboard" component={admin(AdminHubPage)} />
      {/* ── UMGEZOGEN (09.08.2026) ────────────────────────────────────
          „Anträge & KYC" ist in der Kunden-Zentrale aufgegangen. Der Filter
          „KYC zu prüfen" zeigt genau die Arbeit, für die es die Seite gab. */}
      <Route path="/admin/database" component={() => <Umleitung nach="/admin/kunden?kycOffen=1" />} />
      <Route path="/admin/kunden" component={admin(AdminKundenPage)} />
      <Route path="/admin/kunde/:id" component={admin(AdminKundeAktePage)} />
      <Route path="/admin/zahlungen" component={admin(AdminZahlungenPage)} />
      {/* Eigene Seite: Auszahlungen an Mitarbeiter waren vorher eine Sektion der
          Zahlungszentrale — zwei Geldrichtungen in einer Ansicht. */}
      <Route path="/admin/auszahlungen" component={admin(AdminAuszahlungenPage)} />
      {/* Notizen und Aufgaben an Personen — eigene und ans Team vergebene. */}
      <Route path="/admin/aufgaben" component={admin(AdminAufgabenPage)} />
      {/* Justins eigene Liste — was nur der Betreiber tun kann (E-025). */}
      <Route path="/admin/todo" component={admin(AdminTodoPage)} />
      <Route path="/admin/finanzen" component={admin(AdminFinanzenPage)} />
      <Route path="/admin/kontoabgleich" component={admin(AdminKontoabgleichPage)} />
      <Route path="/admin/verbuchung" component={admin(AdminVerbuchungPage)} />
      {/* „Kunden & Zuordnung" war eine reine Lesesicht auf Mehrfach-
          Zuständigkeiten — das ist jetzt der Dubletten-Filter. */}
      <Route path="/admin/personen" component={() => <Umleitung nach="/admin/kunden?dubletten=1" />} />
      {/* Die Lead-LISTE steht in der Zentrale unter Stufe C. Die
          Nachfass-Automatik (Sendefenster, Bulk-Versand, Verteilung, Import)
          bleibt vollständig erhalten und liegt unter /admin/lead-automatik —
          sie wegzuwerfen wäre kein Aufräumen, sondern ein Verlust. */}
      <Route path="/admin/leads" component={() => <Umleitung nach="/admin/kunden?stufe=C" />} />
      <Route path="/admin/lead-automatik" component={admin(AdminLeadsPage)} />
      <Route path="/admin/dubletten" component={admin(AdminDublettenPage)} />
      {/* Kündigungen sind ein Filter, keine Seite. Die Bearbeitung selbst
          (bestätigen/ablehnen) liegt in der Akte. */}
      <Route path="/admin/kuendigungen" component={() => <Umleitung nach="/admin/kunden?kuendigungen=1" />} />
      <Route path="/admin/investoren" component={admin(AdminInvestorenPage)} />
      <Route path="/admin/rechnungen" component={admin(AdminRechnungenPage)} />
      {/* Abrechnungs-Zentrale (19.08.2026) — die Provisionsabrechnungen lagen in
          der Datenbank, ohne Ort zum Ansehen. */}
      <Route path="/admin/abrechnungen" component={admin(AdminAbrechnungenPage)} />
      <Route path="/admin/verbuchungen" component={admin(AdminVerbuchungenPage)} />
      <Route path="/admin/buchhaltung" component={admin(AdminBuchhaltungPage)} />
      <Route path="/admin/events" component={admin(AdminEventsPage)} />
      {/* ── DIE TERMIN-ZENTRALE (26.08.2026) ────────────────────────────────
          Alle Termine aller Mitarbeiter mit dem Quoten-Vergleich, der bisher
          in keiner Ansicht stand. */}
      <Route path="/admin/termine" component={admin(AdminTerminePage)} />
      {/* ══════════════════════════════════════════════════════════════════
          DIE FIAON ACADEMY (26.08.2026)

          Die Einschulungs-Bühne: Der Betreiber teilt den Bildschirm und führt
          neue Mitarbeiter durch den perfekten Ablauf ihrer Abteilung.

          MIT `admin(...)`-Hülle, obwohl die Bühne bildschirmfüllend gedacht ist.

          Der erste Entwurf wollte sie ohne Hülle zeigen — schöner, aber
          UNGESCHÜTZT: Die Zugangsschleuse (Zahlencode) sitzt IN `AdminShell`
          (dort, Zeile 286 ff.). Ohne sie wäre /admin/schulung für jeden offen.
          Ein eigenes Gate daneben wäre die zweite Fassung derselben Wand —
          AGENTS.md: „Eine Wand für zwei Dinge, nicht zwei Wände."

          Vollflächig wird es beim Vorführen: Der Knopf „Präsentieren" geht in
          echtes Vollbild, und dann ist die Navigation ohnehin weg.

          Beide Adressen auf dieselbe Seite — sie entscheidet über den
          Routen-Parameter, ob Übersicht oder Reise. */}
      <Route path="/admin/schulung" component={admin(AdminSchulungPage)} />
      <Route path="/admin/schulung/:reise" component={admin(AdminSchulungPage)} />
      <Route path="/admin/einstellungen" component={admin(AdminEinstellungenPage)} />
      <Route path="/admin/audit" component={admin(AdminAuditPage)} />
      <Route path="/admin/recht" component={admin(AdminRechtPage)} />
      <Route path="/admin/funktionen" component={admin(AdminFunktionenPage)} />
      <Route path="/admin/fahrplan" component={admin(AdminFahrplanPage)} />
      {/* Die Kartei ist seit 03.08.2026 stillgelegt (fiaon-kartei.ts, 410). */}
      <Route path="/admin/kartei" component={() => <Umleitung nach="/admin/kunden" />} />
      <Route path="/agent" component={AgentPortalPage} />
      <Route path="/agent/setup/:token" component={AgentSetupPage} />
      <Route path="/agent/passwort" component={AgentPasswortPage} />
      <Route path="/agent/profil" component={AgentProfilPage} />
      <Route path="/agent/auszahlung" component={AgentAuszahlungPage} />
      <Route path="/agent/skripte" component={AgentSkriptePage} />
      <Route path="/agent/kalender" component={AgentKalenderPage} />
      <Route path="/agent/partner-programm" component={AgentPartnerProgrammPage} />
      {/* Offene Kartei (neu) — löst /agent/leads und /agent/kunden ab. */}
      {/* Die Arbeitsseite, die die offene Kartei abloest: zugewiesene Kunden
          nach Dringlichkeit statt gemeinsamer Bestand. */}
      {/* ── UMSTELLUNG 05.08.2026 ────────────────────────────────────────────
          Aus der Tagesliste "Heute" wurde die Startseite. Die alte Adresse
          bleibt bestehen und leitet um — gemerkte Links und offene Browser-Tabs
          duerfen nicht ins Leere laufen. */}
      <Route path="/agent/start" component={AgentStartPage} />
      <Route path="/agent/heute"><Redirect to="/agent/start" /></Route>
      {/* Der Space — fuer jede Mitarbeiterrolle. */}
      {/* Forderungsmanagement — nur fuer die Rolle 'inkasso'. Wer sie nicht
          hat, bekommt vom Server 404 und die Seite zeigt „gibt es nicht". */}
      <Route path="/agent/inkasso" component={AgentInkassoPage} />
      <Route path="/agent/space">{() => <AgentSpacePage />}</Route>
      {/* Mail-Zentrale — Team und Vorgesetzter. Die Rolle entscheidet der Server:
          ein Teammitglied sieht nur eigene Kunden und darf an höchstens zehn. */}
      <Route path="/agent/mail-zentrale" component={MailZentralePage} />
      {/* Der Vorgesetzte hat SEINE Mail-Zentrale: gleiche Oberflaeche, gleiche
          Bausteine, aber ohne Agent-Anmeldung und ohne 10-Empfaenger-Grenze.
          Der Menuepunkt zeigte bis zum 11.08.2026 auf die Team-Fassung und
          verlangte einen Zugang, den der Vorgesetzte nicht hat. */}
      <Route path="/admin/mail-zentrale" component={admin(MailZentralePage)} />
      {/* Der Space, aus der Sicht des Vorgesetzten: derselbe Feed, dieselbe
          Oberfläche, volle Rechte. Eine zweite Seite wäre eine zweite Seite
          zum Pflegen — und die eine würde bei jeder Änderung vergessen. */}
      <Route path="/admin/space" component={admin(() => <AgentSpacePage alsAdmin />)} />
      {/* Die Startgespräche. Der Pfad heißt bewusst NICHT /agent/onboarding —
          das ist seit jeher die Vertrags-Schranke für neue Mitarbeiter. Zwei
          Dinge mit demselben Namen sind eine Fehlerquelle mit Ansage. */}
      <Route path="/agent/startgespraeche" component={AgentStartgespraechePage} />
      <Route path="/agent/vertrieb" component={AgentVertriebPage} />
      {/* Aufgaben und Hinweise, die die Verwaltung dem Mitarbeiter zuweist. */}
      <Route path="/agent/aufgaben" component={AgentAufgabenPage} />
      <Route path="/agent/anliegen" component={AgentAnliegenPage} />
      {/* Die Kartei ist abgeschaltet. Beide Pfade zeigen NICHT mehr auf sie,
          sondern leiten weiter — ein Lesezeichen darf nicht auf einer Seite
          landen, deren Endpunkte mit 410 antworten. Die Seiten selbst bleiben
          im Repository, damit die Umschaltung rückholbar bleibt. */}
      <Route path="/agent/kartei"><Redirect to="/agent/start" /></Route>
      {/* /agent/meine-kunden speist sich aus /agent/kartei/meine — ebenfalls 410. */}
      {/* Führt auf die EINE Kundenliste — nicht auf die Startseite. Wer „meine
          Kunden" tippt, will Kunden sehen, keine Kennzahlen. */}
      <Route path="/agent/meine-kunden"><Redirect to="/agent/kunden" /></Route>
      {/* Alte Ansichten bleiben erreichbar, bis die Kartei im Betrieb bestätigt
          ist — kein Zwischenzustand, in dem ein Agent seine Akten nicht findet. */}
      {/* Die EINE Arbeitsliste (personenbasiert). Die alte, bestellungsbasierte
          Ansicht bleibt unter /agent/meine-kunden erreichbar, damit nichts
          verloren geht. */}
      <Route path="/agent/kunden" component={AgentKundenNeuPage} />
      {/* ══════════════════════════════════════════════════════════════════
          DIE ALTE KUNDENSEITE IST WEG (28.08.2026)

          `pages/agent/kunden.tsx` lag hier unter /agent/meine-kunden-alt. Am
          25.08. hat sie in die Irre geführt: Ein Knopf und eine Notizpflicht
          wurden DORT eingebaut, während /agent/kunden längst `kunden-neu.tsx`
          zeigt. Erst ein Screenshot verriet es.

          Zwei Dateien mit fast gleichem Namen, von denen eine niemand mehr
          braucht, sind eine Falle. Die Adresse leitet jetzt um — ein
          Lesezeichen soll nicht ins Leere laufen, aber auch nicht auf einen
          Stand von vor drei Wochen.
          ══════════════════════════════════════════════════════════════════ */}
      <Route path="/agent/meine-kunden-alt"><Redirect to="/agent/kunden" /></Route>
      {/* /agent/leads war seit der Kartei unerreichbar (kein Menüpunkt, 711
          Zeilen im Hauptbündel, zweites Ergebnis-Bauteil, Knopf im Kreis).
          Gelöscht am 22.08.2026 (E-022, Scheibe 3); gemerkte Links landen in
          der einen Arbeitsliste. */}
      <Route path="/agent/leads" component={() => <Umleitung nach="/agent/kunden?filter=leads" />} />
      <Route path="/agent/verdienst" component={AgentVerdienstPage} />
      <Route path="/agent/updates" component={AgentUpdatesPage} />
      <Route path="/agent/feedback" component={AgentFeedbackPage} />
      <Route path="/agent/mehr" component={AgentMehrPage} />
      {/* ── DIE ACADEMY FÜR DAS TEAM (28.08.2026) ──────────────────────────
          Jede Rolle bekommt IHRE Reise. Die Filterung liegt im SERVER
          (fiaon-academy.ts): Wer die Adresse einer fremden Reise eintippt,
          bekommt 404 — nicht die Reise. Das ist keine Geheimhaltung, sondern
          Klarheit: Wer die Inkasso-Reise durchklickt, hält sie hinterher für
          seine Aufgabe. */}
      {/* ── DIE LEITUNGS-SCHULUNG (29.08.2026) ─────────────────────────────
          Florentine und Daniel schulen selbst. Die Seite prüft `istLeitung`,
          das der Server liefert — kein eigener Rollen-Vergleich in der Anzeige. */}
      <Route path="/agent/schulung" component={AgentSchulungPage} />
      <Route path="/agent/academy" component={AgentAcademyPage} />
      <Route path="/agent/academy/:reise" component={AgentAcademyPage} />
      <Route path="/agent/dokumente" component={AgentDokumentePage} />
      <Route path="/admin/agent-portal" component={admin(AdminAgentPortalPage)} />
      <Route path="/admin/team" component={admin(AdminTeamZentralePage)} />
      {/* ── ZWEITER WEG ENTFERNT (10.08.2026) ──────────────────────────
          /admin/team-alt und /admin/nachbuchung-alt sind weg. Zwei Wege zur
          selben Sache heißt: Zwei Stellen, die man ändern muss, und eine, die
          man vergisst. Wer die alten Adressen im Lesezeichen hat, landet in
          der Zentrale. */}
      {/* Am 10.08.2026 ersatzlos entfernt. Erst wurden die vier fehlenden
          Funktionsblöcke in die Zentrale gezogen (Skripte, Partner-Anfragen,
          Meilenstein-Prämien, Einstellungen) — dann die Altseite gelöscht.
          Diese Reihenfolge ist der Punkt: Zuerst umziehen, dann abreißen. */}
      <Route path="/admin/team-alt" component={() => <Umleitung nach="/admin/team" />} />
      <Route path="/admin/vertraege" component={admin(AdminVertraegePage)} />
      {/* Provisionen nachbuchen sitzt jetzt im Mitarbeiter-Detail der
          Team-Zentrale — dort, wo auch der Provisionssatz steht. */}
      <Route path="/admin/nachbuchung" component={() => <Umleitung nach="/admin/team?tab=nachbuchung" />} />
      {/* ── UMGEZOGEN (11.08.2026) ──────────────────────────────────────
          „Leistung" war eine eigene Seite mit denselben Zahlen, die die
          Team-Zentrale je Mitarbeiter ohnehin zeigt. Der Vorgesetzte hat den
          Umzug zweimal angeordnet — hier ist er vollständig: Die Rangliste
          liegt in der Zentrale, die Detailzahlen im Mitarbeiter-Reiter. */}
      <Route path="/admin/leistung" component={() => <Umleitung nach="/admin/team?rang=1" />} />
      <Route path="/admin/changelog" component={admin(AdminChangelogPage)} />
      <Route path="/admin/diagnose" component={admin(AdminDiagnosePage)} />
      <Route path="/agent/leistung" component={AgentLeistungPage} />
      {/* Terminbuchung — oeffentlich, kein Login. Das signierte Token im Pfad
          ist der Ausweis (Muster der signierten Rechnungs-Links). */}
      {/* Die Schleuse in die Kundensicht (Verwaltung/Leitung, Nur-Ansicht). */}
      <Route path="/als-kunde" component={AlsKundePage} />
      {/* Abmeldung von der Lead-Strecke — kein Login, ein Klick. */}
      <Route path="/abmelden/:schluessel" component={AbmeldenPage} />
      <Route path="/termin/absagen/:stornoToken" component={TerminAbsagenPage} />
      <Route path="/termin/:token" component={TerminPage} />
      <Route path="/zustimmung/:token" component={ZustimmungPage} />
      <Route path="/zahlung/:paymentRef/danke" component={ZahlungDankePage} />
      <Route path="/zahlung/:paymentRef" component={ZahlungPage} />
      <Route path="/nummer-aktualisieren" component={NummerAktualisierenPage} />
      <Route path="/was-ist-fiaon" component={WasIstFiaonPage} />
      <Route path="/plattform-konzept" component={PlattformKonzeptPage} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/impressum" component={ImpressumPage} />
      <Route path="/agb" component={AGBPage} />
      <Route path="/widerrufsbelehrung" component={WiderrufsbelehrungPage} />
      <Route path="/cookie-einstellungen" component={CookieEinstellungenPage} />
      <Route path="/passwort-vergessen" component={PasswortVergessenPage} />
      <Route path="/abo-kuendigen" component={AboKuendigenPage} />
      <Route path="/bonitaet" component={BonitaetPage} />
      <Route path="/bonitaet-antrag" component={BonitaetAntragPage} />
      <Route path="/bonitaet-service" component={BonitaetServicePage} />
      <Route path="/bonitaet-danke" component={BonitaetDankePage} />
      <Route path="/banking" component={InvestorLoginPage} />
      <Route path="/banking/dashboard" component={InvestorDashboardPage} />
      <Route component={NotFound} />
    </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Der Raum liegt HINTER allem — eine Ebene, für Verwaltung,
          Team-Portal, Kundenportal und die öffentlichen Seiten gleichermaßen.
          Er lädt nach dem Inhalt und verschwindet bei reduzierter Bewegung
          oder Datensparmodus ganz. */}
      <FiaonRaum />
      <div className="relative min-h-screen" style={{ background: "transparent" }}>
        <MaintenanceBanner />
        {/* ── DIE KUNDENSICHT-WARNUNG ─────────────────────────────────────
            Hier und nicht in `dashboard.tsx`: Die Ansicht umfasst das GANZE
            Portal — Unterlagen, Rechnungen, Fahrplan, Konto. Ein Banner, der
            nur auf der Übersicht steht, wäre auf jeder Unterseite weg, und
            genau dort klickt man dann etwas an.

            Die Komponente zeigt sich selbst nur, wenn wirklich eine Ansicht
            läuft — sonst gibt sie `null` zurück und kostet nichts. */}
        <KundenansichtBanner />
        <Toaster />
        <Router />
      </div>
    </QueryClientProvider>
  );
}

export default App;
