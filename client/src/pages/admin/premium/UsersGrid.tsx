import { useState, useEffect, useMemo } from "react";
import {
  Search, ChevronDown, ChevronUp, ArrowUpDown, Eye, CreditCard, Key,
  Ban, CheckCircle2, ChevronLeft, ChevronRight, Users, AlertCircle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ROLE_OPTIONS, PLAN_OPTIONS, getRoleColor, getPlanColor } from "./constants";
import type { SortField, SortDir, StatusFilter } from "./constants";

interface UsersGridProps {
  users: any[];
  loading: boolean;
  error: Error | null;
  authUserId: string | undefined;
  isOnline: (id: string) => boolean;
  onRefetch: () => void;
  onOpenDeepDive: (userId: string) => void;
  onOpenModal: (type: "plan" | "password" | "role", user: any) => void;
  onRequestDisable: (user: any) => void;
  onRequestEnable: (user: any) => void;
  transition: string;
}

const PAGE_SIZE = 25;

export function UsersGrid({
  users, loading, error, authUserId, isOnline, onRefetch,
  onOpenDeepDive, onOpenModal, onRequestDisable, onRequestEnable, transition,
}: UsersGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, sortField, sortDir]);

  const filtered = useMemo(() => {
    let result = [...users];
    if (statusFilter === "active") result = result.filter((u) => (u.subscriptionStatus || u.subscription_status) !== "disabled");
    else if (statusFilter === "disabled") result = result.filter((u) => (u.subscriptionStatus || u.subscription_status) === "disabled");
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((u) =>
        (u.username || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.firstName || "").toLowerCase().includes(q) ||
        (u.lastName || "").toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aVal = (a[sortField] || "").toString().toLowerCase();
      const bVal = (b[sortField] || "").toString().toLowerCase();
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    });
    return result;
  }, [users, statusFilter, searchQuery, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-white/20" />;
    return sortDir === "asc"
      ? <ChevronUp className="w-3 h-3 text-[var(--aras-orange)]" />
      : <ChevronDown className="w-3 h-3 text-[var(--aras-orange)]" />;
  };

  const canDisable = (user: any) => {
    const role = (user.userRole || user.user_role || "user").toLowerCase();
    return user.id !== authUserId && role !== "admin";
  };

  const getDisableTooltip = (user: any) => {
    if (user.id === authUserId) return "Du kannst dich nicht selbst deaktivieren.";
    if ((user.userRole || user.user_role || "user").toLowerCase() === "admin") return "Admin-Accounts können nicht deaktiviert werden.";
    return "User deaktivieren — Login wird sofort blockiert.";
  };

  const GRID_COLS = "44px 1fr 1fr 100px 100px 80px 140px";

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--aras-soft)" }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Suchen nach Name, Email..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-full text-sm ${transition}`}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
            onFocus={(e) => (e.target.style.borderColor = "var(--aras-stroke-accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--aras-glass-border)")}
          />
        </div>
        <div className="flex items-center gap-2">
          {(["all", "active", "disabled"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${transition}`}
              style={{
                background: statusFilter === f ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${statusFilter === f ? "rgba(255,255,255,0.15)" : "var(--aras-glass-border)"}`,
                color: statusFilter === f ? "white" : "var(--aras-soft)",
              }}
            >
              {f === "all" ? "Alle" : f === "active" ? "Aktiv" : "Deaktiviert"}
            </button>
          ))}
          <span className="text-xs pl-2" style={{ color: "var(--aras-soft)" }}>
            {filtered.length} Ergebnis{filtered.length !== 1 ? "se" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--aras-glass-border)" }}>
        {/* Header */}
        <div
          className="grid items-center px-4 py-3 text-xs font-medium uppercase tracking-wider"
          style={{ gridTemplateColumns: GRID_COLS, color: "var(--aras-soft)", borderBottom: "1px solid var(--aras-glass-border)", background: "rgba(255,255,255,0.02)" }}
        >
          <div />
          <button onClick={() => toggleSort("username")} className="flex items-center gap-1 hover:text-white">Name <SortIcon field="username" /></button>
          <button onClick={() => toggleSort("email")} className="flex items-center gap-1 hover:text-white max-md:hidden">Email <SortIcon field="email" /></button>
          <button onClick={() => toggleSort("userRole")} className="flex items-center gap-1 hover:text-white">Rolle <SortIcon field="userRole" /></button>
          <button onClick={() => toggleSort("subscriptionPlan")} className="flex items-center gap-1 hover:text-white max-md:hidden">Plan <SortIcon field="subscriptionPlan" /></button>
          <div>Status</div>
          <div className="text-right">Aktionen</div>
        </div>

        {/* Loading Skeleton */}
        {loading && (
          <div className="divide-y" style={{ borderColor: "var(--aras-glass-border)" }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="grid items-center px-4 py-3" style={{ gridTemplateColumns: GRID_COLS }}>
                <Skeleton className="w-8 h-8 rounded-full bg-white/[0.06]" />
                <Skeleton className="h-4 w-28 bg-white/[0.06]" />
                <Skeleton className="h-4 w-36 bg-white/[0.06] max-md:hidden" />
                <Skeleton className="h-5 w-14 rounded-full bg-white/[0.06]" />
                <Skeleton className="h-5 w-12 rounded-full bg-white/[0.06] max-md:hidden" />
                <Skeleton className="h-5 w-14 rounded-full bg-white/[0.06]" />
                <div className="flex justify-end gap-1">
                  {[1, 2, 3].map((j) => <Skeleton key={j} className="w-8 h-8 rounded-xl bg-white/[0.06]" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="py-16 text-center">
            <AlertCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(239,68,68,0.5)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--aras-muted)" }}>Fehler beim Laden</p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--aras-soft)" }}>{error.message}</p>
            <button
              onClick={onRefetch}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-muted)" }}
            >
              Erneut versuchen
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-16 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(255,255,255,0.15)" }} />
            <p className="text-sm font-medium" style={{ color: "var(--aras-muted)" }}>Keine Nutzer gefunden</p>
            <p className="text-xs mt-1 mb-4" style={{ color: "var(--aras-soft)" }}>Passe deine Filter an oder setze sie zurück.</p>
            {(searchQuery || statusFilter !== "all") && (
              <button
                onClick={() => { setSearchQuery(""); setStatusFilter("all"); }}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-muted)" }}
              >
                Filter zurücksetzen
              </button>
            )}
          </div>
        )}

        {/* Rows */}
        {!loading && !error && paginated.length > 0 && (
          <div className="divide-y" style={{ borderColor: "rgba(255,255,255,0.04)" }}>
            {paginated.map((user: any) => {
              const role = (user.userRole || user.user_role || "user").toLowerCase();
              const plan = user.subscriptionPlan || user.subscription_plan || "free";
              const status = user.subscriptionStatus || user.subscription_status || "active";
              const isDisabled = status === "disabled";
              const roleColor = getRoleColor(role);
              const planColor = getPlanColor(plan);

              return (
                <div
                  key={user.id}
                  className={`grid items-center px-4 py-3 group ${transition}`}
                  style={{ gridTemplateColumns: GRID_COLS, opacity: isDisabled ? 0.55 : 1 }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "var(--aras-muted)" }}>
                      {(user.username?.[0] || "?").toUpperCase()}
                    </div>
                    {isOnline(user.id) && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2" style={{ borderColor: "var(--aras-bg)" }} />
                    )}
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <button onClick={() => onOpenDeepDive(user.id)} className={`text-sm font-medium truncate block hover:underline ${transition}`} style={{ color: "var(--aras-text)" }}>
                      {user.username || "—"}
                    </button>
                    <span className="text-xs truncate block md:hidden" style={{ color: "var(--aras-soft)" }}>{user.email || "—"}</span>
                  </div>

                  {/* Email */}
                  <div className="text-xs truncate max-md:hidden" style={{ color: "var(--aras-soft)" }}>{user.email || "—"}</div>

                  {/* Role */}
                  <button
                    onClick={() => onOpenModal("role", user)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${transition}`}
                    style={{ background: `${roleColor}15`, color: roleColor, border: `1px solid ${roleColor}25` }}
                  >
                    {role.toUpperCase()}
                    <ChevronDown className="w-2.5 h-2.5" />
                  </button>

                  {/* Plan */}
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full w-fit max-md:hidden" style={{ background: `${planColor}12`, color: planColor }}>
                    {plan}
                  </span>

                  {/* Status */}
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full w-fit"
                    style={{
                      background: isDisabled ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)",
                      color: isDisabled ? "#EF4444" : "#10B981",
                      border: `1px solid ${isDisabled ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.18)"}`,
                    }}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isDisabled ? "bg-red-400" : "bg-emerald-400"}`} />
                    {isDisabled ? "Off" : "Aktiv"}
                  </span>

                  {/* Actions */}
                  <div className="flex justify-end gap-1">
                    <ActionBtn icon={Eye} onClick={() => onOpenDeepDive(user.id)} title="Details anzeigen" transition={transition} />
                    <ActionBtn icon={CreditCard} onClick={() => onOpenModal("plan", user)} title="Plan ändern" transition={transition} />
                    <ActionBtn icon={Key} onClick={() => onOpenModal("password", user)} title="Passwort ändern" transition={transition} />
                    {isDisabled ? (
                      <button
                        onClick={() => onRequestEnable(user)}
                        className={`p-1.5 rounded-xl ${transition}`}
                        style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.18)" }}
                        title="User reaktivieren"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      </button>
                    ) : (
                      <button
                        onClick={() => canDisable(user) && onRequestDisable(user)}
                        disabled={!canDisable(user)}
                        className={`p-1.5 rounded-xl ${transition} disabled:opacity-30 disabled:cursor-not-allowed`}
                        style={{
                          background: canDisable(user) ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.02)",
                          border: `1px solid ${canDisable(user) ? "rgba(239,68,68,0.18)" : "transparent"}`,
                        }}
                        title={getDisableTooltip(user)}
                      >
                        <Ban className="w-3.5 h-3.5" style={{ color: canDisable(user) ? "#EF4444" : "var(--aras-soft)" }} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--aras-glass-border)" }}>
            <span className="text-xs" style={{ color: "var(--aras-soft)" }}>Seite {page} von {totalPages}</span>
            <div className="flex gap-1">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="p-1.5 rounded-lg disabled:opacity-30" style={{ background: "rgba(255,255,255,0.04)" }}>
                <ChevronLeft className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) p = i + 1;
                else if (page <= 3) p = i + 1;
                else if (page >= totalPages - 2) p = totalPages - 4 + i;
                else p = page - 2 + i;
                return (
                  <button
                    key={p} onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium ${transition}`}
                    style={{ background: page === p ? "var(--aras-orange)" : "rgba(255,255,255,0.04)", color: page === p ? "black" : "var(--aras-muted)" }}
                  >
                    {p}
                  </button>
                );
              })}
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1.5 rounded-lg disabled:opacity-30" style={{ background: "rgba(255,255,255,0.04)" }}>
                <ChevronRight className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, onClick, title, transition }: { icon: typeof Eye; onClick: () => void; title: string; transition: string }) {
  return (
    <button
      onClick={onClick}
      className={`p-1.5 rounded-xl ${transition}`}
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid transparent" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--aras-glass-border)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "transparent")}
      title={title}
    >
      <Icon className="w-3.5 h-3.5" style={{ color: "var(--aras-muted)" }} />
    </button>
  );
}
