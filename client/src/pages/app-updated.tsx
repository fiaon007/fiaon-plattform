import { useState, useEffect, Suspense, useCallback } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { ChatInterface } from "@/components/chat/chat-interface";
import { FeedbackWidget } from "@/components/feedback/feedback-widget";
import { NewYearOverlay } from "@/components/overlays/new-year-overlay";
import { AppErrorBoundary } from "@/components/system/app-error-boundary";
import { PremiumLaunchpad } from "@/components/space/premium-launchpad";
import { CommandPalette } from "@/components/system/command-palette";
import { CommandProvider } from "@/lib/commands/command-context";
import { lazyWithRetry } from "@/lib/react/lazy-with-retry";
import { checkBuildIdAndReload } from "@/lib/system/build-id";
import { markModule } from "@/lib/system/module-trace";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { Menu, X } from "lucide-react";
import type { User, SubscriptionResponse } from "@shared/schema";

markModule('app:import');

const COLORS = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
};

checkBuildIdAndReload();

const Dashboard = lazyWithRetry(() => {
  markModule('route:dashboard:lazy:begin');
  return import("@/pages/dashboard").then(m => {
    markModule('route:dashboard:lazy:resolved');
    return m;
  });
}, { retries: 2 });
const PowerPage = lazyWithRetry(() => import("@/pages/power"), { retries: 2 });
const CampaignsPage = lazyWithRetry(() => import("@/pages/campaigns"), { retries: 2 });
const Contacts = lazyWithRetry(() => import('./contacts'), { retries: 2 });
const Calendar = lazyWithRetry(() => import('./calendar'), { retries: 2 });
const LeadsPage = lazyWithRetry(() => import("@/pages/leads"), { retries: 2 });
const BillingPage = lazyWithRetry(() => import("@/pages/billing"), { retries: 2 });
const SettingsPage = lazyWithRetry(() => import("@/pages/settings"), { retries: 2 });

export default function App() {
  const [location, setLocation] = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { user, isLoading } = useAuth();
  
  const getActiveSectionFromUrl = () => {
    if (location.includes('/dashboard')) return 'dashboard';
    if (location.includes('/power')) return 'power';
    if (location.includes('/campaigns')) return 'campaigns';
    if (location.includes('/contacts')) return 'contacts';
    if (location.includes('/calendar')) return 'calendar';
    if (location.includes('/leads')) return 'leads';
    if (location.includes('/billing')) return 'billing';
    if (location.includes('/settings')) return 'settings';
    return 'space';
  };
  
  const [activeSection, setActiveSection] = useState(getActiveSectionFromUrl());
  
  useEffect(() => {
    const section = getActiveSectionFromUrl();
    setActiveSection(section);
  }, [location]);
  
  useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeSection]);

  const handleNavigate = useCallback((path: string) => {
    const section = path.replace('/app/', '');
    setActiveSection(section || 'dashboard');
    setLocation(path);
  }, [setLocation]);

  const { data: subscriptionData } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    queryFn: async () => {
      try {
        const res = await fetch('/api/user/subscription', { credentials: 'include' });
        if (!res.ok) {
          console.warn('[App] Subscription API Error:', res.status);
          return null as any;
        }
        return await res.json();
      } catch (err) {
        console.error('[App] Subscription fetch error:', err);
        return null as any;
      }
    },
    enabled: !!user && !isLoading,
    retry: false,
  });

  const renderActiveSection = () => {
    const upgradeHref = '/app/billing';
    
    switch (activeSection) {
      case "space":
        return (
          <PremiumLaunchpad user={user as any} upgradeHref={upgradeHref}>
            <ChatInterface />
          </PremiumLaunchpad>
        );
      case "dashboard":
        return <Dashboard />;
      case "power":
        return <PowerPage />;
      case "campaigns":
        return <CampaignsPage />;
      case "contacts":
        return <Contacts />;
      case "calendar":
        return <Calendar />;
      case "leads":
        return <LeadsPage />;
      case "billing":
        return <BillingPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return (
          <PremiumLaunchpad user={user as any} upgradeHref={upgradeHref}>
            <ChatInterface />
          </PremiumLaunchpad>
        );
    }
  };

  if (isLoading) {
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(12,12,12,0.96) 0%, rgba(0,0,0,0.99) 100%)',
        }}
      >
        <div className="text-center">
          <div 
            className="w-12 h-12 mx-auto mb-4 rounded-full"
            style={{
              background: `conic-gradient(${COLORS.orange}, ${COLORS.gold}, ${COLORS.orange})`,
              animation: 'spin 1.5s linear infinite',
            }}
          >
            <div className="w-10 h-10 m-1 rounded-full bg-black" />
          </div>
          <p className="text-sm text-neutral-500">Wird geladen...</p>
        </div>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login?returnTo=${returnTo}`;
    return (
      <div 
        className="fixed inset-0 flex items-center justify-center"
        style={{
          background: 'radial-gradient(ellipse at 50% 40%, rgba(12,12,12,0.96) 0%, rgba(0,0,0,0.99) 100%)',
        }}
      >
        <p className="text-sm text-neutral-500">Weiterleitung zur Anmeldung...</p>
      </div>
    );
  }

  return (
    <AppErrorBoundary>
    <CommandProvider navigate={handleNavigate}>
    <div className="flex min-h-screen h-screen bg-transparent overflow-hidden">
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      <div className="hidden lg:block">
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section);
            setLocation(`/app/${section}`);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      <div 
        className={`fixed lg:hidden top-0 left-0 h-full z-50 transition-transform duration-300 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar
          activeSection={activeSection}
          onSectionChange={(section) => {
            setActiveSection(section);
            setLocation(`/app/${section}`);
          }}
          isCollapsed={false}
          onToggleCollapse={() => {}}
        />
      </div>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="lg:hidden fixed top-0 left-0 right-0 z-30 px-4 py-3 bg-black/80 backdrop-blur-md border-b border-white/10 flex items-center justify-between">
          <button
            onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            {isMobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="text-sm font-semibold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            ARAS AI
          </div>
          <div className="w-9" />
        </div>

        <div className="hidden lg:block">
          <TopBar
            currentSection={activeSection}
            subscriptionData={subscriptionData}
            user={user as User}
            isVisible={true}
          />
        </div>

        <div className="flex-1 overflow-hidden relative pt-[60px] lg:pt-0">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-neutral-500">Lädt...</div>
            </div>
          }>
            {renderActiveSection()}
          </Suspense>
        </div>

        <FeedbackWidget />
        <NewYearOverlay />
        <CommandPalette />
      </div>
    </div>
    </CommandProvider>
    </AppErrorBoundary>
  );
}
