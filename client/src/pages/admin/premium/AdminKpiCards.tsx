import { Users, UserCheck, UserX, Zap, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AdminKpiCardsProps {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  onlineCount: number;
  loading: boolean;
  transition: string;
}

const KPI_DEFS: { label: string; key: keyof Omit<AdminKpiCardsProps, "loading" | "transition">; icon: LucideIcon; color: string }[] = [
  { label: "Total Users", key: "totalUsers", icon: Users, color: "var(--aras-orange)" },
  { label: "Aktiv", key: "activeUsers", icon: UserCheck, color: "#10B981" },
  { label: "Deaktiviert", key: "disabledUsers", icon: UserX, color: "#EF4444" },
  { label: "Online", key: "onlineCount", icon: Zap, color: "#06B6D4" },
];

export function AdminKpiCards(props: AdminKpiCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {KPI_DEFS.map((kpi) => (
        <div
          key={kpi.label}
          className={`p-4 rounded-2xl ${props.transition}`}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid var(--aras-glass-border)",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>
              {kpi.label}
            </span>
            <kpi.icon className="w-4 h-4" style={{ color: kpi.color, opacity: 0.6 }} />
          </div>
          {props.loading ? (
            <Skeleton className="h-8 w-16 bg-white/[0.06]" />
          ) : (
            <div className="text-2xl font-bold" style={{ color: kpi.color }}>
              {props[kpi.key]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
