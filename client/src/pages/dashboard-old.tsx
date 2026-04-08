import { Suspense, lazy } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { useAuth } from "@/hooks/useAuth";
import { markModule } from "@/lib/system/module-trace";

// Trace: dashboard page module loaded
markModule('dashboard:page:import');

// MISSION CONTROL: New unified dashboard with KPIs, Actions, Activity
const MissionControl = lazy(() => {
  markModule('dashboard:mission-control:lazy:begin');
  return import("@/components/dashboard/mission-control").then(m => {
    markModule('dashboard:mission-control:lazy:resolved');
    return { default: m.MissionControl };
  });
});

/**
 * Dashboard Page
 * IMPORTANT: NO Sidebar/TopBar here!
 * AppPage already renders layout components
 * Wrapped in ErrorBoundary to prevent blackscreen crashes
 * Uses lazy loading to isolate potential TDZ crashes
 */
export default function Dashboard() {
  markModule('dashboard:page:render');
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE9100]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <p className="text-gray-400">Nicht eingeloggt</p>
      </div>
    );
  }

  return (
    <ErrorBoundary fallbackTitle="Dashboard konnte nicht geladen werden">
      <div className="h-full overflow-y-auto bg-black">
        <Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FE9100]" />
          </div>
        }>
          <MissionControl user={user} />
        </Suspense>
      </div>
    </ErrorBoundary>
  );
}
