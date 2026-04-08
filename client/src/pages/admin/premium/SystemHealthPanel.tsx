import { Database, Heart } from "lucide-react";

interface SystemHealthPanelProps {
  stats: any;
  totalUsers: number;
  onlineCount: number;
  reducedMotion: boolean;
}

export function SystemHealthPanel({ stats, totalUsers, onlineCount, reducedMotion }: SystemHealthPanelProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* API Status */}
      <HealthCard>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>API Status</CardTitle>
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full bg-emerald-400"
              style={!reducedMotion ? { animation: "pulse 2s infinite" } : {}}
            />
            <span className="text-xs font-medium text-emerald-400">Online</span>
          </span>
        </div>
        <div className="space-y-2">
          <Row label="Admin API" value="Healthy" valueColor="#10B981" />
          <Row label="Auth System" value="Healthy" valueColor="#10B981" />
          <Row label="Sessions" value={`${stats?.sessions || "—"} aktiv`} />
        </div>
      </HealthCard>

      {/* Database */}
      <HealthCard>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Database</CardTitle>
          <Database className="w-4 h-4" style={{ color: "var(--aras-soft)", opacity: 0.5 }} />
        </div>
        <div className="space-y-2">
          <Row label="Users" value={stats?.users || totalUsers} />
          <Row label="Leads" value={stats?.leads || "—"} />
          <Row label="Calls" value={stats?.callLogs || "—"} />
          <Row label="AI Messages" value={stats?.totalAiMessages || "—"} />
        </div>
      </HealthCard>

      {/* Overview */}
      <HealthCard>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Overview</CardTitle>
          <Heart className="w-4 h-4" style={{ color: "var(--aras-soft)", opacity: 0.5 }} />
        </div>
        <div className="space-y-2">
          <Row label="Feedback" value={stats?.feedback || "—"} />
          <Row label="Campaigns" value={stats?.campaigns || "—"} />
          <Row label="Voice Agents" value={stats?.voiceAgents || "—"} />
          <Row label="Online Now" value={onlineCount} valueColor="#10B981" bold />
        </div>
      </HealthCard>
    </div>
  );
}

function HealthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--aras-glass-border)" }}>
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--aras-soft)" }}>{children}</span>;
}

function Row({ label, value, valueColor, bold }: { label: string; value: any; valueColor?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "var(--aras-soft)" }}>{label}</span>
      <span style={{ color: valueColor || "var(--aras-muted)", fontWeight: bold ? 500 : undefined }}>{value}</span>
    </div>
  );
}
