/**
 * ARAS Admin Dashboard — Premium Page Orchestrator
 * Wires all modular components together. No business logic lives here.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { createPortal } from "react-dom";
import { X, Check, Loader2, AlertCircle, Crown, Shield, Users } from "lucide-react";

import { AdminTopbar } from "./AdminTopbar";
import { AdminKpiCards } from "./AdminKpiCards";
import { AdminTabs } from "./AdminTabs";
import { UsersGrid } from "./UsersGrid";
import { UserControlCenter } from "./UserControlCenter";
import { ActivityLogPanel } from "./ActivityLogPanel";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { ArasConfirmDialog } from "./ArasConfirmDialog";
import {
  extractArray, snakeToCamel,
  PLAN_OPTIONS, STATUS_OPTIONS, ROLE_OPTIONS,
  type TabId, type ModalType,
} from "./constants";

export default function AdminPremiumPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { user: authUser } = useAuth() as { user: any };

  // Tab + Panel State
  const [activeTab, setActiveTab] = useState<TabId>("users");
  const [deepDiveUserId, setDeepDiveUserId] = useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [formPlan, setFormPlan] = useState("free");
  const [formStatus, setFormStatus] = useState("active");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("user");

  // Confirm Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string;
    variant: "danger" | "default"; action: () => void;
  }>({ open: false, title: "", description: "", variant: "default", action: () => {} });

  // Reduced motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  const transition = prefersReducedMotion ? "" : "transition-all duration-200";

  // ── DATA FETCHING ──

  const { data: usersRaw = [], isLoading: usersLoading, error: usersError, refetch: refetchUsers } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return snakeToCamel(extractArray(await res.json()));
    },
    refetchInterval: 30000,
  });

  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (!res.ok) return {};
      const d = await res.json();
      return d.stats || d;
    },
    refetchInterval: 30000,
  });

  const { data: onlineData } = useQuery({
    queryKey: ["admin-online"],
    queryFn: async () => {
      const res = await fetch("/api/admin/online-users", { credentials: "include" });
      return res.ok ? res.json() : { onlineUserIds: [] };
    },
    refetchInterval: 15000,
  });

  const isOnline = useCallback((id: string) => onlineData?.onlineUserIds?.includes(id), [onlineData]);
  const onlineCount = onlineData?.onlineUserIds?.length || 0;
  const totalUsers = usersRaw.length;
  const activeUsers = usersRaw.filter((u: any) => (u.subscriptionStatus || u.subscription_status) !== "disabled").length;
  const disabledUsers = totalUsers - activeUsers;

  // ── MUTATIONS ──

  const disableMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || "Disable failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast({ title: "User deaktiviert", description: "Login gesperrt. Daten bleiben erhalten." });
      setConfirmDialog((d) => ({ ...d, open: false }));
    },
    onError: (error: any) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setConfirmDialog((d) => ({ ...d, open: false }));
    },
  });

  const enableMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/enable`, { method: "POST", credentials: "include" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || err.message || "Enable failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: "User reaktiviert", description: "Login wieder möglich." });
      setConfirmDialog((d) => ({ ...d, open: false }));
    },
    onError: (error: any) => {
      toast({ title: "Fehler", description: error.message, variant: "destructive" });
      setConfirmDialog((d) => ({ ...d, open: false }));
    },
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ id, plan, status }: { id: string; plan: string; status: string }) => {
      const res = await fetch(`/api/admin/users/${id}/change-plan`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ plan, status }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Plan change failed"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users-list"] }); toast({ title: "Plan geändert" }); closeModal(); },
    onError: (error: any) => toast({ title: "Fehler", description: error.message, variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const res = await fetch(`/api/admin/users/${id}/change-password`, {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ newPassword: password }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Password change failed"); }
      return res.json();
    },
    onSuccess: () => { toast({ title: "Passwort geändert" }); closeModal(); },
    onError: (error: any) => toast({ title: "Fehler", description: error.message, variant: "destructive" }),
  });

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: string }) => {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Role change failed");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      toast({ title: "Rolle geändert", description: `${data.user?.username || "User"} → ${(data.user?.role || "").toUpperCase()}` });
      closeModal();
    },
    onError: (error: any) => toast({ title: "Fehler", description: error.message, variant: "destructive" }),
  });

  const resetUsageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/reset-usage`, { method: "POST", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users-list"] }); toast({ title: "Usage zurückgesetzt" }); },
    onError: () => toast({ title: "Fehler", variant: "destructive" }),
  });

  // ── MODAL HANDLERS ──

  const openModal = useCallback((type: ModalType, user: any) => {
    setSelectedUser(user);
    if (user) {
      setFormPlan(user.subscriptionPlan || user.subscription_plan || "free");
      setFormStatus(user.subscriptionStatus || user.subscription_status || "active");
      setFormRole((user.userRole || user.user_role || "user").toLowerCase());
    }
    setFormPassword("");
    setModalType(type);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setTimeout(() => { setModalType(null); setSelectedUser(null); setFormPassword(""); }, 150);
  }, []);

  // ── CONFIRM DIALOG HANDLERS ──

  const requestDisable = useCallback((user: any) => {
    setConfirmDialog({
      open: true,
      title: "User deaktivieren?",
      description: `Login für "${user.username || user.email}" wird sofort blockiert. Alle Daten bleiben erhalten.`,
      variant: "danger",
      action: () => disableMutation.mutate(user.id),
    });
  }, [disableMutation]);

  const requestEnable = useCallback((user: any) => {
    setConfirmDialog({
      open: true,
      title: "User reaktivieren?",
      description: `"${user.username || user.email}" kann sich wieder einloggen.`,
      variant: "default",
      action: () => enableMutation.mutate(user.id),
    });
  }, [enableMutation]);

  // ESC + scroll lock
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (confirmDialog.open && !disableMutation.isPending && !enableMutation.isPending) {
          setConfirmDialog((d) => ({ ...d, open: false }));
        } else if (deepDiveUserId) {
          setDeepDiveUserId(null);
        } else if (modalOpen) {
          closeModal();
        }
      }
    };
    window.addEventListener("keydown", handleEsc);
    if (modalOpen || deepDiveUserId || confirmDialog.open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { window.removeEventListener("keydown", handleEsc); document.body.style.overflow = ""; };
  }, [modalOpen, deepDiveUserId, confirmDialog.open, closeModal, disableMutation.isPending, enableMutation.isPending]);

  // ── RENDER ──

  return (
    <div className="min-h-screen text-white" style={{ background: "var(--aras-bg)" }}>
      <div className="max-w-[1280px] mx-auto px-6 py-6 max-md:px-4">

        <AdminTopbar
          totalUsers={totalUsers}
          onlineCount={onlineCount}
          onRefresh={refetchUsers}
          onNavigate={navigate}
          transition={transition}
        />

        <AdminKpiCards
          totalUsers={totalUsers}
          activeUsers={activeUsers}
          disabledUsers={disabledUsers}
          onlineCount={onlineCount}
          loading={usersLoading}
          transition={transition}
        />

        <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} transition={transition} />

        {activeTab === "users" && (
          <UsersGrid
            users={usersRaw}
            loading={usersLoading}
            error={usersError as Error | null}
            authUserId={authUser?.id}
            isOnline={isOnline}
            onRefetch={refetchUsers}
            onOpenDeepDive={setDeepDiveUserId}
            onOpenModal={openModal}
            onRequestDisable={requestDisable}
            onRequestEnable={requestEnable}
            transition={transition}
          />
        )}

        {activeTab === "audit" && <ActivityLogPanel />}

        {activeTab === "health" && (
          <SystemHealthPanel
            stats={stats}
            totalUsers={totalUsers}
            onlineCount={onlineCount}
            reducedMotion={prefersReducedMotion}
          />
        )}
      </div>

      {/* User Control Center (Deep Dive) */}
      {deepDiveUserId && (
        <UserControlCenter
          userId={deepDiveUserId}
          onClose={() => setDeepDiveUserId(null)}
          onOpenModal={openModal}
          onRequestDisable={requestDisable}
          onRequestEnable={requestEnable}
          reducedMotion={prefersReducedMotion}
        />
      )}

      {/* Confirm Dialog */}
      <ArasConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.variant === "danger" ? "Deaktivieren" : "Bestätigen"}
        loading={disableMutation.isPending || enableMutation.isPending}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((d) => ({ ...d, open: false }))}
      />

      {/* Edit Modal */}
      {modalOpen && selectedUser && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.8)",
            backdropFilter: prefersReducedMotion ? "none" : "blur(8px)",
            WebkitBackdropFilter: prefersReducedMotion ? "none" : "blur(8px)",
          }}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-w-md rounded-[20px] max-h-[85vh] overflow-y-auto"
            style={{
              background: "#1a1a1c",
              border: "1px solid var(--aras-stroke)",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.8)",
              ...(prefersReducedMotion ? {} : { animation: "scaleIn 150ms ease-out" }),
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-0">
              <h2 className="text-lg font-bold" style={{ color: "var(--aras-text)" }}>
                {modalType === "plan" && "Plan ändern"}
                {modalType === "password" && "Passwort ändern"}
                {modalType === "role" && "Rolle ändern"}
              </h2>
              <button onClick={closeModal} className="p-2 rounded-xl hover:bg-white/10">
                <X className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              <div className="p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <div className="text-sm font-medium" style={{ color: "var(--aras-text)" }}>{selectedUser.username || selectedUser.email || "?"}</div>
                <div className="text-xs font-mono mt-0.5" style={{ color: "var(--aras-soft)" }}>{selectedUser.id}</div>
              </div>

              {/* Plan */}
              {modalType === "plan" && (
                <>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--aras-soft)" }}>Plan</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {PLAN_OPTIONS.map((p) => (
                        <button key={p.key} onClick={() => setFormPlan(p.key)}
                          className={`p-3 rounded-xl text-center text-sm font-medium ${transition}`}
                          style={{
                            background: formPlan === p.key ? `${p.color}20` : "rgba(255,255,255,0.04)",
                            border: `1px solid ${formPlan === p.key ? `${p.color}40` : "var(--aras-glass-border)"}`,
                            color: formPlan === p.key ? p.color : "var(--aras-muted)",
                          }}
                        >{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--aras-soft)" }}>Status</label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {STATUS_OPTIONS.map((s) => (
                        <button key={s} onClick={() => setFormStatus(s)}
                          className={`p-2 rounded-xl text-center text-xs font-medium ${transition}`}
                          style={{
                            background: formStatus === s ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)",
                            border: `1px solid ${formStatus === s ? "rgba(16,185,129,0.3)" : "var(--aras-glass-border)"}`,
                            color: formStatus === s ? "#10B981" : "var(--aras-muted)",
                          }}
                        >{s}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Password */}
              {modalType === "password" && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--aras-soft)" }}>Neues Passwort</label>
                  <input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Min. 8 Zeichen" autoFocus className="w-full mt-2 px-4 py-3 rounded-xl text-sm"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
                    onFocus={(e) => (e.target.style.borderColor = "var(--aras-stroke-accent)")}
                    onBlur={(e) => (e.target.style.borderColor = "var(--aras-glass-border)")}
                  />
                  {formPassword.length > 0 && formPassword.length < 8 && (
                    <p className="text-xs mt-1 text-red-400">Mindestens 8 Zeichen erforderlich.</p>
                  )}
                </div>
              )}

              {/* Role */}
              {modalType === "role" && (
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--aras-soft)" }}>Neue Rolle</label>
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {ROLE_OPTIONS.map((r) => {
                      const Icon = r.icon;
                      return (
                        <button key={r.key} onClick={() => setFormRole(r.key)}
                          className={`p-4 rounded-xl text-center flex flex-col items-center gap-2 ${transition}`}
                          style={{
                            background: formRole === r.key ? `${r.color}20` : "rgba(255,255,255,0.04)",
                            border: `2px solid ${formRole === r.key ? r.color : "transparent"}`,
                            color: formRole === r.key ? r.color : "var(--aras-muted)",
                          }}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="text-xs font-medium">{r.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {(selectedUser.userRole || selectedUser.user_role || "").toLowerCase() === "admin" && formRole !== "admin" && (
                    <div className="mt-3 p-3 rounded-xl text-xs flex items-start gap-2"
                      style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>Admin wird herabgestuft. Das System verhindert die Entfernung des letzten Admins.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex gap-3">
              <button onClick={closeModal} className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${transition}`}
                style={{ background: "rgba(255,255,255,0.06)", color: "var(--aras-muted)" }}>
                Abbrechen
              </button>
              <button
                onClick={() => {
                  if (modalType === "plan") changePlanMutation.mutate({ id: selectedUser.id, plan: formPlan, status: formStatus });
                  else if (modalType === "password" && formPassword.length >= 8) changePasswordMutation.mutate({ id: selectedUser.id, password: formPassword });
                  else if (modalType === "role") changeRoleMutation.mutate({ id: selectedUser.id, role: formRole });
                }}
                disabled={
                  (modalType === "password" && formPassword.length < 8) ||
                  (modalType === "role" && formRole === (selectedUser.userRole || selectedUser.user_role || "user").toLowerCase()) ||
                  changePlanMutation.isPending || changePasswordMutation.isPending || changeRoleMutation.isPending
                }
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${transition} disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
                style={{ background: "var(--aras-orange)", color: "black" }}
              >
                {(changePlanMutation.isPending || changePasswordMutation.isPending || changeRoleMutation.isPending) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</>
                ) : (
                  <><Check className="w-4 h-4" /> Speichern</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
