import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Crown,
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Copy,
  ArrowLeft,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Claim {
  id: number;
  created_at: string;
  status: string;
  aras_login: string;
  stripe_email: string | null;
  notes: string | null;
  activated_at: string | null;
  activated_by_user_id: string | null;
  admin_note: string | null;
}

interface ClaimsResponse {
  claims: Claim[];
  total: number;
  limit: number;
  offset: number;
}

/* ─── Status Badge ──────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: "rgba(254,145,0,0.15)", text: "var(--aras-orange)", label: "Pending" },
    activated: { bg: "rgba(233,215,196,0.12)", text: "var(--aras-gold-light)", label: "Activated" },
    rejected: { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.4)", label: "Rejected" },
  };
  const c = config[status] || config.pending;
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-inter font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADMIN FOUNDING CLAIMS PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AdminFoundingClaims() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery), 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset offset when filters change
  useEffect(() => {
    setOffset(0);
  }, [statusFilter, debouncedQuery]);

  // Fetch claims
  const { data, isLoading, refetch } = useQuery<ClaimsResponse>({
    queryKey: ["/api/internal/founding/claims", statusFilter, debouncedQuery, offset],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedQuery) params.set("query", debouncedQuery);
      params.set("limit", String(LIMIT));
      params.set("offset", String(offset));
      const res = await fetch(`/api/internal/founding/claims?${params}`);
      if (!res.ok) throw new Error("Failed to fetch claims");
      return res.json();
    },
  });

  // Fetch stats for top cards
  const { data: stats } = useQuery<{ cap: number; pending: number; activated: number; total: number }>({
    queryKey: ["/api/public/founding/stats"],
    staleTime: 10000,
  });

  // Update claim mutation
  const updateClaim = useMutation({
    mutationFn: async ({ id, status, adminNote }: { id: number; status: string; adminNote?: string }) => {
      const res = await fetch(`/api/internal/founding/claims/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote }),
      });
      if (!res.ok) throw new Error("Failed to update claim");
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/internal/founding/claims"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public/founding/stats"] });
      toast({
        title: variables.status === "activated" ? "Marked as activated" : "Rejected",
        description: `Claim #${variables.id} updated.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Update failed.",
        variant: "destructive",
      });
    },
  });

  const handleActivate = useCallback(
    (id: number) => updateClaim.mutate({ id, status: "activated" }),
    [updateClaim]
  );

  const handleReject = useCallback(
    (id: number) => {
      if (confirm("Diesen Claim wirklich ablehnen?")) {
        updateClaim.mutate({ id, status: "rejected" });
      }
    },
    [updateClaim]
  );

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: text });
    },
    [toast]
  );

  const claims = data?.claims || [];
  const total = data?.total || 0;

  return (
    <div
      className="min-h-screen w-full px-4 md:px-6 lg:px-8 py-8 md:py-12"
      style={{ background: "var(--aras-bg)" }}
    >
      <div className="max-w-[1120px] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/admin")}
              className="p-2 rounded-lg border border-[rgba(233,215,196,0.12)] hover:border-[rgba(254,145,0,0.3)] transition-all"
              aria-label="Back to Admin"
            >
              <ArrowLeft className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
            </button>
            <div>
              <h1 className="font-orbitron font-bold text-xl md:text-2xl" style={{ color: "var(--aras-text)" }}>
                Founding Claims
              </h1>
              <p className="text-xs mt-1" style={{ color: "var(--aras-soft)" }}>
                Founding Member Pass — Manual Fulfillment Queue
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-[rgba(233,215,196,0.12)] hover:border-[rgba(254,145,0,0.3)] transition-all"
            aria-label="Refresh"
          >
            <RefreshCw className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {[
              { label: "Pending", value: stats.pending, icon: Clock, color: "var(--aras-orange)" },
              { label: "Activated", value: stats.activated, icon: CheckCircle, color: "var(--aras-gold-light)" },
              { label: "Total", value: stats.total, icon: Crown, color: "var(--aras-orange)" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-[20px] border border-[rgba(233,215,196,0.12)] bg-[rgba(255,255,255,0.03)] backdrop-blur-[12px] p-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-inter" style={{ color: "var(--aras-soft)" }}>
                      {label}
                    </p>
                    <p className="text-2xl font-orbitron font-bold mt-1" style={{ color }}>
                      {value}
                    </p>
                  </div>
                  <Icon className="w-6 h-6 opacity-40" style={{ color }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          {/* Search */}
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
              style={{ color: "var(--aras-soft)" }}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Suchen (Login / Email)"
              className="w-full h-[40px] rounded-[12px] pl-10 pr-4 text-sm font-inter bg-transparent outline-none transition-all"
              style={{
                border: "1px solid rgba(233,215,196,0.14)",
                color: "var(--aras-text)",
              }}
              onFocus={(e) => (e.target.style.boxShadow = "0 0 0 2px rgba(254,145,0,0.4)")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>

          {/* Status filter */}
          <div className="flex gap-1.5">
            {["all", "pending", "activated", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-inter font-medium transition-all ${
                  statusFilter === s
                    ? "border-[rgba(254,145,0,0.5)]"
                    : "border-[rgba(233,215,196,0.1)] hover:border-[rgba(254,145,0,0.25)]"
                }`}
                style={{
                  border: `1px solid ${statusFilter === s ? "rgba(254,145,0,0.5)" : "rgba(233,215,196,0.1)"}`,
                  color: statusFilter === s ? "var(--aras-orange)" : "var(--aras-muted)",
                  background: statusFilter === s ? "rgba(254,145,0,0.08)" : "transparent",
                }}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Claims Table */}
        <div className="rounded-[20px] border border-[rgba(233,215,196,0.12)] bg-[rgba(255,255,255,0.02)] backdrop-blur-[12px] overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--aras-orange)" }} />
            </div>
          ) : claims.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Crown className="w-8 h-8 mb-3 opacity-30" style={{ color: "var(--aras-muted)" }} />
              <p className="text-sm" style={{ color: "var(--aras-soft)" }}>
                Keine Claims gefunden.
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[rgba(233,215,196,0.08)]">
                      {["#", "Datum", "ARAS Login", "Stripe Email", "Status", "Actions"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-xs font-inter font-medium px-4 py-3"
                          style={{ color: "var(--aras-soft)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {claims.map((claim) => (
                      <motion.tr
                        key={claim.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-b border-[rgba(233,215,196,0.05)] hover:bg-[rgba(255,255,255,0.02)] transition-colors"
                      >
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: "var(--aras-soft)" }}>
                          {claim.id}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--aras-muted)" }}>
                          {new Date(claim.created_at).toLocaleDateString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-inter font-medium" style={{ color: "var(--aras-text)" }}>
                              {claim.aras_login}
                            </span>
                            <button
                              onClick={() => copyToClipboard(claim.aras_login)}
                              className="opacity-40 hover:opacity-100 transition-opacity"
                              aria-label="Copy login"
                            >
                              <Copy className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm" style={{ color: "var(--aras-muted)" }}>
                          {claim.stripe_email || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={claim.status} />
                        </td>
                        <td className="px-4 py-3">
                          {claim.status === "pending" && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleActivate(claim.id)}
                                disabled={updateClaim.isPending}
                                className="px-3 py-1 rounded-lg text-xs font-inter font-medium transition-all hover:shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                                style={{
                                  background: "rgba(34,197,94,0.12)",
                                  color: "#22c55e",
                                  border: "1px solid rgba(34,197,94,0.25)",
                                }}
                              >
                                <CheckCircle className="w-3 h-3 inline mr-1 -mt-0.5" />
                                Activate
                              </button>
                              <button
                                onClick={() => handleReject(claim.id)}
                                disabled={updateClaim.isPending}
                                className="px-3 py-1 rounded-lg text-xs font-inter font-medium transition-all"
                                style={{
                                  background: "rgba(255,255,255,0.04)",
                                  color: "var(--aras-soft)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                }}
                              >
                                <XCircle className="w-3 h-3 inline mr-1 -mt-0.5" />
                                Reject
                              </button>
                            </div>
                          )}
                          {claim.status === "activated" && (
                            <span className="text-xs" style={{ color: "var(--aras-soft)" }}>
                              {claim.activated_at
                                ? new Date(claim.activated_at).toLocaleDateString("de-DE")
                                : "—"}
                            </span>
                          )}
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-[rgba(233,215,196,0.06)]">
                {claims.map((claim) => (
                  <div key={claim.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-inter font-medium" style={{ color: "var(--aras-text)" }}>
                        {claim.aras_login}
                      </span>
                      <StatusBadge status={claim.status} />
                    </div>
                    {claim.stripe_email && (
                      <p className="text-xs" style={{ color: "var(--aras-soft)" }}>
                        {claim.stripe_email}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: "var(--aras-soft)" }}>
                      {new Date(claim.created_at).toLocaleDateString("de-DE")}
                    </p>
                    {claim.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleActivate(claim.id)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                          style={{
                            background: "rgba(34,197,94,0.12)",
                            color: "#22c55e",
                            border: "1px solid rgba(34,197,94,0.25)",
                          }}
                        >
                          Activate
                        </button>
                        <button
                          onClick={() => handleReject(claim.id)}
                          className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                          style={{
                            background: "rgba(255,255,255,0.04)",
                            color: "var(--aras-soft)",
                            border: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {total > LIMIT && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-[rgba(233,215,196,0.06)]">
                  <p className="text-xs" style={{ color: "var(--aras-soft)" }}>
                    {offset + 1}–{Math.min(offset + LIMIT, total)} von {total}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOffset(Math.max(0, offset - LIMIT))}
                      disabled={offset === 0}
                      className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-30 transition-all"
                      style={{
                        border: "1px solid rgba(233,215,196,0.12)",
                        color: "var(--aras-muted)",
                      }}
                    >
                      Zurück
                    </button>
                    <button
                      onClick={() => setOffset(offset + LIMIT)}
                      disabled={offset + LIMIT >= total}
                      className="px-3 py-1 rounded-lg text-xs font-medium disabled:opacity-30 transition-all"
                      style={{
                        border: "1px solid rgba(233,215,196,0.12)",
                        color: "var(--aras-muted)",
                      }}
                    >
                      Weiter
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
