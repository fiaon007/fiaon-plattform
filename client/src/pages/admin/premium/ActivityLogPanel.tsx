import { useQuery } from "@tanstack/react-query";
import { History, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "./constants";

const ACTION_COLORS: Record<string, string> = {
  role_change: "#8B5CF6",
  password_reset: "#F59E0B",
  user_delete: "#EF4444",
  plan_change: "#06B6D4",
  bulk_role_change: "#EC4899",
};

export function ActivityLogPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const res = await fetch("/api/admin/audit?limit=50", { credentials: "include" });
      if (!res.ok) return { entries: [], pagination: {} };
      return res.json();
    },
  });

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--aras-glass-border)" }}>
      <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--aras-glass-border)", background: "rgba(255,255,255,0.02)" }}>
        <h3 className="text-sm font-medium" style={{ color: "var(--aras-text)" }}>Admin Activity Log</h3>
        <p className="text-xs" style={{ color: "var(--aras-soft)" }}>Alle Admin-Aktionen werden protokolliert.</p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-8 h-8 rounded-full bg-white/[0.06]" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-48 bg-white/[0.06]" />
                <Skeleton className="h-2.5 w-32 bg-white/[0.04]" />
              </div>
              <Skeleton className="h-3 w-20 bg-white/[0.04]" />
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!data?.entries || data.entries.length === 0) && (
        <div className="py-16 text-center">
          <History className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
          <p className="text-sm font-medium" style={{ color: "var(--aras-muted)" }}>Noch keine Audit-Einträge</p>
          <p className="text-xs mt-1" style={{ color: "var(--aras-soft)" }}>Änderungen an Usern werden hier protokolliert.</p>
        </div>
      )}

      {/* Entries */}
      {!isLoading && data?.entries && data.entries.length > 0 && (
        <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
          {data.entries.map((entry: any, i: number) => {
            const color = ACTION_COLORS[entry.action] || "#6B7280";
            return (
              <div key={entry.id || i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
                  <Activity className="w-3.5 h-3.5" style={{ color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: "var(--aras-text)" }}>{entry.actor_username || "System"}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ background: `${color}15`, color }}>
                      {(entry.action || "").replace(/_/g, " ")}
                    </span>
                  </div>
                  {entry.target_username && (
                    <span className="text-xs" style={{ color: "var(--aras-soft)" }}>→ {entry.target_username}</span>
                  )}
                </div>
                <span className="text-xs flex-shrink-0" style={{ color: "var(--aras-soft)" }}>{timeAgo(entry.created_at)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
