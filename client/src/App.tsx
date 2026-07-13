import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import FiaonHome from "@/pages/fiaon-home";
import FiaonLanding from "@/pages/fiaon-landing";
import StartPage from "@/pages/start";
import BusinessPage from "@/pages/business";
import AntragPage from "@/pages/antrag";
import BusinessAntragPage from "@/pages/business-antrag";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import AdminDatabasePage from "@/pages/admin-database";
import WasIstFiaonPage from "@/pages/was-ist-fiaon";
import PlattformKonzeptPage from "@/pages/plattform-konzept";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import ImpressumPage from "@/pages/impressum";
import AGBPage from "@/pages/agb";
import WiderrufsbelehrungPage from "@/pages/widerrufsbelehrung";
import CookieEinstellungenPage from "@/pages/cookie-einstellungen";
import PasswortVergessenPage from "@/pages/passwort-vergessen";
import AboKuendigenPage from "@/pages/abo-kuendigen";
import BonitaetPage from "@/pages/bonitaet";
import BonitaetAntragPage from "@/pages/bonitaet-antrag";
import BonitaetServicePage from "@/pages/bonitaet-service";
import BonitaetDankePage from "@/pages/bonitaet-danke";
import InvestorLoginPage from "@/pages/investor-login";
import InvestorDashboardPage from "@/pages/investor-dashboard";
import ZahlungPage, { ZahlungDankePage } from "@/pages/zahlung";
import AdminZahlungenPage from "@/pages/admin-zahlungen";
import AdminTeamPage from "@/pages/admin-team";
import AdminHubPage from "@/pages/admin-hub";
import AdminRechnungenPage from "@/pages/admin-rechnungen";
import AdminVerbuchungenPage from "@/pages/admin-verbuchungen";
import AdminEventsPage from "@/pages/admin-events";
import AdminEinstellungenPage from "@/pages/admin-einstellungen";
import AdminAuditPage from "@/pages/admin-audit";
import AdminRechtPage from "@/pages/admin-recht";
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
import AgentVerdienstPage from "@/pages/agent/verdienst";
import AgentUpdatesPage from "@/pages/agent/updates";
import AgentFeedbackPage from "@/pages/agent/feedback";
import AgentMehrPage from "@/pages/agent/mehr";
import AdminAgentPortalPage from "@/pages/admin-agent-portal";

// Paket N1: JEDE /admin-Seite läuft in der AdminShell (Sidebar, Breadcrumb,
// Zurück, Cmd+K). Serverseitige Guards bleiben unberührt.
function admin(Component: () => JSX.Element) {
  return () => (
    <AdminShell>
      <Component />
    </AdminShell>
  );
}

function Router() {
  return (
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
      <Route path="/admin/database" component={admin(AdminDatabasePage)} />
      <Route path="/admin/zahlungen" component={admin(AdminZahlungenPage)} />
      <Route path="/admin/rechnungen" component={admin(AdminRechnungenPage)} />
      <Route path="/admin/verbuchungen" component={admin(AdminVerbuchungenPage)} />
      <Route path="/admin/events" component={admin(AdminEventsPage)} />
      <Route path="/admin/einstellungen" component={admin(AdminEinstellungenPage)} />
      <Route path="/admin/audit" component={admin(AdminAuditPage)} />
      <Route path="/admin/recht" component={admin(AdminRechtPage)} />
      <Route path="/agent" component={AgentPortalPage} />
      <Route path="/agent/setup/:token" component={AgentSetupPage} />
      <Route path="/agent/passwort" component={AgentPasswortPage} />
      <Route path="/agent/profil" component={AgentProfilPage} />
      <Route path="/agent/auszahlung" component={AgentAuszahlungPage} />
      <Route path="/agent/skripte" component={AgentSkriptePage} />
      <Route path="/agent/kalender" component={AgentKalenderPage} />
      <Route path="/agent/partner-programm" component={AgentPartnerProgrammPage} />
      <Route path="/agent/kunden" component={AgentKundenPage} />
      <Route path="/agent/verdienst" component={AgentVerdienstPage} />
      <Route path="/agent/updates" component={AgentUpdatesPage} />
      <Route path="/agent/feedback" component={AgentFeedbackPage} />
      <Route path="/agent/mehr" component={AgentMehrPage} />
      <Route path="/admin/agent-portal" component={admin(AdminAgentPortalPage)} />
      <Route path="/admin/team" component={admin(AdminTeamPage)} />
      <Route path="/zahlung/:paymentRef/danke" component={ZahlungDankePage} />
      <Route path="/zahlung/:paymentRef" component={ZahlungPage} />
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
