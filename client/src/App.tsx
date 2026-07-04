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
import AgentPortalPage from "@/pages/agent";
import AgentSetupPage from "@/pages/agent/setup";
import AgentPasswortPage from "@/pages/agent/passwort";
import AgentProfilPage from "@/pages/agent/profil";
import AgentAuszahlungPage from "@/pages/agent/auszahlung";
import AgentSkriptePage from "@/pages/agent/skripte";
import AgentKalenderPage from "@/pages/agent/kalender";

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
      <Route path="/admin/database" component={AdminDatabasePage} />
      <Route path="/admin/zahlungen" component={AdminZahlungenPage} />
      <Route path="/agent" component={AgentPortalPage} />
      <Route path="/agent/setup/:token" component={AgentSetupPage} />
      <Route path="/agent/passwort" component={AgentPasswortPage} />
      <Route path="/agent/profil" component={AgentProfilPage} />
      <Route path="/agent/auszahlung" component={AgentAuszahlungPage} />
      <Route path="/agent/skripte" component={AgentSkriptePage} />
      <Route path="/agent/kalender" component={AgentKalenderPage} />
      <Route path="/admin/team" component={AdminTeamPage} />
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
