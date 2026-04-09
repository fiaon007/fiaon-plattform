import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import FiaonLanding from "@/pages/fiaon-landing";
import BusinessPage from "@/pages/business";
import PrivatkundenPage from "@/pages/privatkunden";
import AntragPage from "@/pages/antrag";
import BusinessAntragPage from "@/pages/business-antrag";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import NotFound from "@/pages/not-found";
import AdminDatabasePage from "@/pages/admin-database";
import WasIstFiaonPage from "@/pages/was-ist-fiaon";

function Router() {
  return (
    <Switch>
      <Route path="/" component={FiaonLanding} />
      <Route path="/business" component={BusinessPage} />
      <Route path="/privatkunden" component={PrivatkundenPage} />
      <Route path="/antrag" component={AntragPage} />
      <Route path="/business-antrag" component={BusinessAntragPage} />
      <Route path="/admin/database" component={AdminDatabasePage} />
      <Route path="/was-ist-fiaon" component={WasIstFiaonPage} />
      <Route path="/terms" component={Terms} />
      <Route path="/privacy" component={Privacy} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-screen bg-white">
        <Toaster />
        <Router />
      </div>
    </QueryClientProvider>
  );
}

export default App;
