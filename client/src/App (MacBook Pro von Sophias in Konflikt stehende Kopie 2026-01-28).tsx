import { useEffect, memo } from "react";
import backgroundVideo from "@/assets/background-video.mp4";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EarlyAccessBanner } from "@/components/ui/early-access-banner";
import { useAuth } from "@/hooks/useAuth";
import { initializeAnalytics } from "@/lib/analytics";
import { LanguageProvider } from "@/lib/auto-translate";
import { PageTransition } from "@/components/page-transition"; // HIGH-END PAGE TRANSITIONS
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import Welcome from "@/pages/welcome";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Demo from "@/pages/demo";
import Checkout from "@/pages/checkout";
import CheckoutSuccess from "@/pages/checkout-success";
import Space from "@/pages/space";
import VoiceCalls from "./pages/voice-calls";
import AdminDashboard from "@/pages/admin-dashboard";
import Power from "@/pages/power";
import VoiceAgents from "@/pages/voice-agents";
import Leads from "@/pages/leads";
import Campaigns from "@/pages/campaigns";
import Contacts from '@/pages/contacts'; // DIRECT IMPORT - NO LAZY! (FULL VERSION)
import Calendar from '@/pages/calendar'; // DIRECT IMPORT - NO LAZY! (FULL VERSION)
import Billing from "@/pages/billing";
// Settings loaded via AppPage lazy import
import AuthPage from "@/pages/auth-page";
import ArasMailingPage from "@/pages/aras-mailing";
import AppPage from "@/pages/app";
// Blog imports - SEO-optimized pages
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";

// Investor Pages (hidden, not in menu)
import InvestorSchwabPage from "@/pages/app/investor/schwab";

// ARAS Lab (hidden, experimental voice interface)
import ArasLab from "@/pages/aras-lab";

// 🎯 INTERNAL CRM SYSTEM - Command Center (admin/staff only)
import InternalDashboard from "@/pages/internal/dashboard";
import InternalContacts from "@/pages/internal/contacts";

// 🚀 CAMPAIGN STUDIO - Done-for-You Onboarding Wizard
import CampaignStudioPage from "@/pages/campaign-studio";

// 📦 SERVICE ORDERS - Admin/User Order Dashboard
import AdminDashboardServiceOrders from "@/pages/admin-dashboard-service-orders";

// 🔐 CLIENT PORTAL - Isolated customer dashboards (Leadely etc.)
import PortalLogin from "@/pages/portal/login";
import PortalReport from "@/pages/portal/report";
import PortalDashboard from "@/pages/portal/dashboard";
import PortalHelpCenter from "@/pages/portal/help";  // STEP 15

// Memoized video background component - never re-renders to keep video playing continuously
const VideoBackground = memo(() => {
  useEffect(() => {
    const video = document.querySelector('video') as HTMLVideoElement;
    if (video) {
      // Noch langsamer: 20% Geschwindigkeit statt 30%
      video.playbackRate = 0.2;
      
      // Verstecke alle Controls komplett
      video.controls = false;
      video.removeAttribute('controls');
      
      // Aggressive autoplay Strategie
      const forcePlay = () => {
        video.play().catch(err => {
          console.log('Video autoplay attempt:', err);
          // Retry nach kurzer Verzögerung
          setTimeout(() => video.play().catch(() => {}), 100);
        });
      };
      
      // Initial play
      forcePlay();
      
      // Force play bei verschiedenen Events
      video.addEventListener('loadeddata', forcePlay);
      video.addEventListener('canplay', forcePlay);
      video.addEventListener('pause', forcePlay);
      
      // Force play bei User-Interaktion (Fallback)
      const userInteractionHandler = () => {
        forcePlay();
        document.removeEventListener('click', userInteractionHandler);
        document.removeEventListener('touchstart', userInteractionHandler);
      };
      document.addEventListener('click', userInteractionHandler, { once: true });
      document.addEventListener('touchstart', userInteractionHandler, { once: true });
      
      return () => {
        video.removeEventListener('loadeddata', forcePlay);
        video.removeEventListener('canplay', forcePlay);
        video.removeEventListener('pause', forcePlay);
      };
    }
  }, []);

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }}>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        disableRemotePlayback
        src={backgroundVideo}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          transform: 'scale(1.0)',
          transformOrigin: 'center center',
          filter: 'contrast(1.1) brightness(0.7) saturate(0.9)',
          opacity: 1
        }}
      />
      {/* Dark overlay + gradient for better text readability */}
      <div className="pointer-events-none absolute inset-0 bg-black/50" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/35 via-black/55 to-black/75" />
      <div 
        className="pointer-events-none absolute inset-0" 
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.3) 100%)'
        }}
      />
    </div>
  );
});

function Router() {
  const { user, isLoading } = useAuth();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex h-screen bg-black items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-[#FE9100] border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <PageTransition>
      <Switch>
        {/* 🔐 CLIENT PORTAL ROUTES - Public, isolated auth */}
        <Route path="/portal/:portalKey/login" component={PortalLogin} />
        <Route path="/portal/:portalKey/report" component={PortalReport} />
        <Route path="/portal/:portalKey/help" component={PortalHelpCenter} />  {/* STEP 15: Help Center */}
        <Route path="/portal/:portalKey/calls/:callId" component={PortalDashboard} />  {/* STEP 11: Deep-link */}
        <Route path="/portal/:portalKey" component={PortalDashboard} />
        
        {/* Public routes - always accessible */}
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/demo" component={Demo} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/checkout-success" component={CheckoutSuccess} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/welcome" component={Welcome} />
        <Route path="/blog" component={Blog} />
        <Route path="/blog/:slug" component={BlogPost} />
        
        {/* 🔒 INVESTOR PAGES - Public but hidden (direct link only) */}
        <Route path="/app/investor/schwab" component={InvestorSchwabPage} />
        <Route path="/investor/schwab" component={InvestorSchwabPage} />
      
      {!user ? (
        <>
          {/* Unauthenticated - show auth page */}
          <Route path="/" component={AuthPage} />
          {/* Redirect protected routes to auth */}
          <Route path="/app" component={AuthPage} />
          <Route path="/space" component={AuthPage} />
          <Route path="/power" component={AuthPage} />
          <Route path="/voice-agents" component={AuthPage} />
          <Route path="/leads" component={AuthPage} />
          <Route path="/campaigns" component={AuthPage} />
          <Route path="/contacts" component={AuthPage} />
          <Route path="/billing" component={AuthPage} />
          <Route path="/settings" component={AuthPage} />
        </>
      ) : (
        <>
          {/* Authenticated routes */}
          <Route path="/" component={AppPage} />
          <Route path="/app" component={AppPage} />
          <Route path="/app/voice" component={VoiceCalls} />
          <Route path="/space" component={Space} />
          <Route path="/app/space" component={Space} />
          <Route path="/dashboard" component={AppPage} />
          <Route path="/app/dashboard" component={AppPage} />
          <Route path="/power" component={AppPage} />
          <Route path="/app/power" component={AppPage} />
          <Route path="/voice-agents" component={VoiceAgents} />
          <Route path="/app/voice-agents" component={VoiceAgents} />
          <Route path="/leads" component={AppPage} />
          <Route path="/app/leads" component={AppPage} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin-dashboard/activity" component={AdminDashboard} />
          <Route path="/admin-dashboard/users" component={AdminDashboard} />
          <Route path="/admin-dashboard/leads" component={AdminDashboard} />
          <Route path="/admin-dashboard/contacts" component={AdminDashboard} />
          <Route path="/admin-dashboard/emails" component={AdminDashboard} />
          <Route path="/admin-dashboard/calls" component={AdminDashboard} />
          <Route path="/admin-dashboard/campaigns" component={AdminDashboard} />
          <Route path="/admin-dashboard/chats" component={AdminDashboard} />
          <Route path="/admin-dashboard/agents" component={AdminDashboard} />
          <Route path="/admin-dashboard/feedback" component={AdminDashboard} />
          <Route path="/admin-dashboard/plans" component={AdminDashboard} />
          <Route path="/admin-dashboard/team-chat" component={AdminDashboard} />
          <Route path="/admin-dashboard/tasks" component={AdminDashboard} />
          <Route path="/admin-dashboard/staff" component={AdminDashboard} />
          <Route path="/admin-dashboard/exports" component={AdminDashboard} />
          <Route path="/admin-dashboard/settings" component={AdminDashboard} />
          <Route path="/admin-dashboard/service-orders" component={AdminDashboardServiceOrders} />
          <Route path="/admin-dashboard" component={AdminDashboard} />
          <Route path="/app/admin" component={AdminDashboard} />
          <Route path="/app/admin-dashboard" component={AdminDashboard} />
          <Route path="/campaigns" component={Campaigns} />
          <Route path="/app/campaigns" component={Campaigns} />
          <Route path="/contacts" component={Contacts} />
          <Route path="/app/contacts" component={Contacts} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/app/calendar" component={Calendar} />
          <Route path="/billing" component={Billing} />
          <Route path="/app/billing" component={Billing} />
          <Route path="/settings" component={AppPage} />
          <Route path="/app/settings" component={AppPage} />
          <Route path="/aras-mailing" component={ArasMailingPage} />
          <Route path="/app/aras-mailing" component={ArasMailingPage} />
          
          {/* 🎯 INTERNAL CRM ROUTES - Only for admin/staff */}
          <Route path="/internal/dashboard" component={InternalDashboard} />
          <Route path="/internal/contacts" component={InternalContacts} />
          <Route path="/internal" component={() => {
            window.location.href = '/internal/dashboard';
            return null;
          }} />
          
          {/* 🧪 ARAS LAB - Experimental Voice Interface (hidden) */}
          <Route path="/app/aras-lab" component={ArasLab} />
          <Route path="/aras-lab" component={ArasLab} />
          
          {/* 🚀 CAMPAIGN STUDIO - Done-for-You Onboarding Wizard */}
          <Route path="/campaign-studio" component={CampaignStudioPage} />
          <Route path="/app/campaign-studio" component={CampaignStudioPage} />
          
        </>
      )}
      
      <Route component={NotFound} />
      </Switch>
    </PageTransition>
  );
}

function App() {
  // Initialize Google Analytics on app mount
  useEffect(() => {
    initializeAnalytics();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <TooltipProvider>
          {/* Persistent video background - OUTSIDE everything, always visible */}
          <VideoBackground />
          
          <div className="dark relative min-h-screen">
            {/* Content Wrapper - positioned above video */}
            <div className="relative z-10">
              {/* Early Access Banner - Ganz oben fixiert */}
              <div className="fixed top-0 left-0 right-0 z-[9999]">
                <EarlyAccessBanner />
              </div>
              
              {/* Main Content - mit Padding-Top für Banner */}
              <div className="pt-10">
                <Toaster />
                <Router />
              </div>
            </div>
          </div>
        </TooltipProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
