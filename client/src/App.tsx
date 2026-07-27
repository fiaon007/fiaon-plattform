import { lazy, Suspense, type ComponentType } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import MaintenanceBanner from "@/components/MaintenanceBanner";
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
import WasIstFiaonPage from "@/pages/was-ist-fiaon";
import PlattformKonzeptPage from "@/pages/plattform-konzept";
import LoginPage from "@/pages/login";
const DashboardPage = lazy(() => import("@/pages/dashboard"));
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
const AdminTeamPage = lazy(() => import("@/pages/admin-team"));
const AdminNachbuchungPage = lazy(() => import("@/pages/admin-nachbuchung"));
const AdminHubPage = lazy(() => import("@/pages/admin-hub"));
const AdminRechnungenPage = lazy(() => import("@/pages/admin-rechnungen"));
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
import AgentKundenPage from "@/pages/agent/kunden";
import AgentKarteiPage from "@/pages/agent/kartei";
import AgentMeineKundenPage from "@/pages/agent/meine-kunden";
import AgentVerdienstPage from "@/pages/agent/verdienst";
import AgentUpdatesPage from "@/pages/agent/updates";
import AgentFeedbackPage from "@/pages/agent/feedback";
import AgentMehrPage from "@/pages/agent/mehr";
const AdminAgentPortalPage = lazy(() => import("@/pages/admin-agent-portal"));
const AdminLeadsPage = lazy(() => import("@/pages/admin-leads"));
const AdminFinanzenPage = lazy(() => import("@/pages/admin-finanzen"));
const AdminKontoabgleichPage = lazy(() => import("@/pages/admin-kontoabgleich"));
const AdminLeistungPage = lazy(() => import("@/pages/admin-leistung"));
const AdminChangelogPage = lazy(() => import("@/pages/admin-changelog"));
const AdminDiagnosePage = lazy(() => import("@/pages/admin-diagnose"));
const AdminDublettenPage = lazy(() => import("@/pages/admin-dubletten"));
const AdminKuendigungenPage = lazy(() => import("@/pages/admin-kuendigungen"));
const AdminInvestorenPage = lazy(() => import("@/pages/admin-investoren"));
const AdminBuchhaltungPage = lazy(() => import("@/pages/admin-buchhaltung"));
import AgentLeistungPage from "@/pages/agent/leistung";
import AgentLeadsPage from "@/pages/agent/leads";
import AgentDokumentePage from "@/pages/agent/dokumente";
const AdminVertraegePage = lazy(() => import("@/pages/admin-vertraege"));
const AdminFahrplanPage = lazy(() => import("@/pages/admin-fahrplan"));
const AdminKarteiPage = lazy(() => import("@/pages/admin-kartei"));

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
  return (
    <Suspense fallback={<SeiteLaedt />}>
    <Switch>
      <Route path="/" component={FiaonHome} />
      <Route path="/start" component={StartPage} />
      <Route path="/karte-sichern" component={StartPage} />
      <Route path="/business" component={BusinessPage} />
      <Route path="/privatkunden" component={FiaonLanding} />
      <Route path="/antrag" component={AntragPage} />
      <Route path="/business-antrag" component={BusinessAntragPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/admin" component={admin(AdminHubPage)} />
      <Route path="/admin/database" component={admin(AdminAntraegePage)} />
      <Route path="/admin/kunden" component={admin(AdminKundenPage)} />
      <Route path="/admin/kunde/:id" component={admin(AdminKundeAktePage)} />
      <Route path="/admin/zahlungen" component={admin(AdminZahlungenPage)} />
      <Route path="/admin/finanzen" component={admin(AdminFinanzenPage)} />
      <Route path="/admin/kontoabgleich" component={admin(AdminKontoabgleichPage)} />
      <Route path="/admin/leads" component={admin(AdminLeadsPage)} />
      <Route path="/admin/dubletten" component={admin(AdminDublettenPage)} />
      <Route path="/admin/kuendigungen" component={admin(AdminKuendigungenPage)} />
      <Route path="/admin/investoren" component={admin(AdminInvestorenPage)} />
      <Route path="/admin/rechnungen" component={admin(AdminRechnungenPage)} />
      <Route path="/admin/verbuchungen" component={admin(AdminVerbuchungenPage)} />
      <Route path="/admin/buchhaltung" component={admin(AdminBuchhaltungPage)} />
      <Route path="/admin/events" component={admin(AdminEventsPage)} />
      <Route path="/admin/einstellungen" component={admin(AdminEinstellungenPage)} />
      <Route path="/admin/audit" component={admin(AdminAuditPage)} />
      <Route path="/admin/recht" component={admin(AdminRechtPage)} />
      <Route path="/admin/funktionen" component={admin(AdminFunktionenPage)} />
      <Route path="/admin/fahrplan" component={admin(AdminFahrplanPage)} />
      <Route path="/admin/kartei" component={admin(AdminKarteiPage)} />
      <Route path="/agent" component={AgentPortalPage} />
      <Route path="/agent/setup/:token" component={AgentSetupPage} />
      <Route path="/agent/passwort" component={AgentPasswortPage} />
      <Route path="/agent/profil" component={AgentProfilPage} />
      <Route path="/agent/auszahlung" component={AgentAuszahlungPage} />
      <Route path="/agent/skripte" component={AgentSkriptePage} />
      <Route path="/agent/kalender" component={AgentKalenderPage} />
      <Route path="/agent/partner-programm" component={AgentPartnerProgrammPage} />
      {/* Offene Kartei (neu) — löst /agent/leads und /agent/kunden ab. */}
      <Route path="/agent/kartei" component={AgentKarteiPage} />
      <Route path="/agent/meine-kunden" component={AgentMeineKundenPage} />
      {/* Alte Ansichten bleiben erreichbar, bis die Kartei im Betrieb bestätigt
          ist — kein Zwischenzustand, in dem ein Agent seine Akten nicht findet. */}
      <Route path="/agent/kunden" component={AgentKundenPage} />
      <Route path="/agent/leads" component={AgentLeadsPage} />
      <Route path="/agent/verdienst" component={AgentVerdienstPage} />
      <Route path="/agent/updates" component={AgentUpdatesPage} />
      <Route path="/agent/feedback" component={AgentFeedbackPage} />
      <Route path="/agent/mehr" component={AgentMehrPage} />
      <Route path="/agent/dokumente" component={AgentDokumentePage} />
      <Route path="/admin/agent-portal" component={admin(AdminAgentPortalPage)} />
      <Route path="/admin/team" component={admin(AdminTeamPage)} />
      <Route path="/admin/vertraege" component={admin(AdminVertraegePage)} />
      <Route path="/admin/nachbuchung" component={admin(AdminNachbuchungPage)} />
      <Route path="/admin/leistung" component={admin(AdminLeistungPage)} />
      <Route path="/admin/changelog" component={admin(AdminChangelogPage)} />
      <Route path="/admin/diagnose" component={admin(AdminDiagnosePage)} />
      <Route path="/agent/leistung" component={AgentLeistungPage} />
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
      <div className="relative min-h-screen bg-white">
        <MaintenanceBanner />
        <Toaster />
        <Router />
      </div>
    </QueryClientProvider>
  );
}

export default App;
