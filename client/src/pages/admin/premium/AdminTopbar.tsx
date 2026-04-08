import { Shield, LayoutGrid, RefreshCw } from "lucide-react";

interface AdminTopbarProps {
  totalUsers: number;
  onlineCount: number;
  onRefresh: () => void;
  onNavigate: (path: string) => void;
  transition: string;
}

export function AdminTopbar({ totalUsers, onlineCount, onRefresh, onNavigate, transition }: AdminTopbarProps) {
  return (
    <header
      className={`sticky top-0 z-40 -mx-6 px-6 max-md:-mx-4 max-md:px-4 py-4 mb-6 ${transition}`}
      style={{
        background: "rgba(15,15,15,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--aras-stroke)",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, var(--aras-orange), var(--aras-gold-dark))" }}
          >
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="font-orbitron text-lg font-bold tracking-tight text-white">
              ARAS Admin
            </h1>
            <p className="text-xs" style={{ color: "var(--aras-soft)" }}>
              Dashboard · {totalUsers} Users
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("/internal/dashboard")}
            className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${transition}`}
            style={{
              background: "rgba(254,145,0,0.08)",
              border: "1px solid var(--aras-stroke-accent)",
              color: "var(--aras-orange)",
            }}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Command Center
          </button>
          <div
            className="px-2.5 py-1 rounded-full text-xs font-medium"
            style={{
              background: onlineCount > 0 ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${onlineCount > 0 ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.08)"}`,
              color: onlineCount > 0 ? "#10B981" : "var(--aras-soft)",
            }}
          >
            {onlineCount} online
          </div>
          <button
            onClick={onRefresh}
            className={`p-2 rounded-xl ${transition}`}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--aras-glass-border)" }}
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
          </button>
        </div>
      </div>
    </header>
  );
}
