/**
 * Section-level skeletons for Daily Briefing
 * Prevents layout shift during loading
 */

const DT = {
  panelBorder: 'rgba(255,255,255,0.06)',
};

export function PrioritiesSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-12 rounded-xl animate-pulse"
          style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${DT.panelBorder}` }}
        />
      ))}
    </div>
  );
}

export function QuickWinsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-8 w-24 rounded-lg animate-pulse"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      ))}
    </div>
  );
}

export function RiskFlagsSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="h-8 w-32 rounded-lg animate-pulse"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        />
      ))}
    </div>
  );
}
