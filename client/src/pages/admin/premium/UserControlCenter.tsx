/**
 * ARAS Admin — User Control Center (Premium Slide-Over)
 * 5 Tabs: Overview · Identity · Usage · Settings · Knowledge Base
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Copy, CreditCard, Key, RefreshCw, Loader2, Check,
  RotateCcw, Search, Plus, Pencil, Trash2, FileText, Link, File,
  Ban, CheckCircle2, Globe, Bell, Shield, Eye, EyeOff,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { getRoleColor, getPlanColor, timeAgo, type ModalType } from "./constants";
import { ArasConfirmDialog } from "./ArasConfirmDialog";
import { createPortal } from "react-dom";

// ── Types ──

type TabId = "overview" | "identity" | "usage" | "settings" | "kb";

interface UserControlCenterProps {
  userId: string;
  onClose: () => void;
  onOpenModal: (type: ModalType, user: any) => void;
  onRequestDisable: (user: any) => void;
  onRequestEnable: (user: any) => void;
  reducedMotion: boolean;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Übersicht" },
  { id: "identity", label: "Identität" },
  { id: "usage", label: "Usage" },
  { id: "settings", label: "Settings" },
  { id: "kb", label: "Wissensdatenbank" },
];

// ── Main Component ──

export function UserControlCenter({
  userId, onClose, onOpenModal, onRequestDisable, onRequestEnable, reducedMotion,
}: UserControlCenterProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("overview");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-deep-dive", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/deep-dive`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!userId,
  });

  const user = data?.user;
  const role = user ? (user.user_role || user.userRole || "user").toLowerCase() : "";
  const plan = user ? (user.subscription_plan || user.subscriptionPlan || "free") : "";
  const status = user ? (user.subscription_status || user.subscriptionStatus || "active") : "";
  const isDisabled = status === "disabled";
  const roleColor = getRoleColor(role);
  const planColor = getPlanColor(plan);

  const refreshAll = useCallback(() => {
    refetch();
    qc.invalidateQueries({ queryKey: ["admin-users-list"] });
  }, [refetch, qc]);

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className={reducedMotion ? "fixed inset-0 bg-black/60" : "fixed inset-0 bg-black/60 backdrop-blur-sm"}
        style={reducedMotion ? {} : { animation: "fadeIn 200ms ease-out" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 h-full w-full sm:w-[600px] flex flex-col"
        style={{
          background: "#111113",
          borderLeft: "1px solid rgba(233,215,196,0.14)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
          ...(reducedMotion ? {} : { animation: "slideInRight 220ms ease-out" }),
        }}
      >
        {/* ── Header ── */}
        <div className="flex-shrink-0 px-5 py-4" style={{ borderBottom: "1px solid var(--aras-glass-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-orbitron text-lg font-bold" style={{ color: "var(--aras-text)" }}>
              User Control Center
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={() => refreshAll()} className="p-2 rounded-xl hover:bg-white/10">
                <RefreshCw className="w-3.5 h-3.5" style={{ color: "var(--aras-muted)" }} />
              </button>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10">
                <X className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
              </button>
            </div>
          </div>

          {/* Profile mini bar */}
          {user && (
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: `${roleColor}20`, color: roleColor }}
              >
                {(user.username?.[0] || "?").toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate" style={{ color: "var(--aras-text)" }}>{user.username || "—"}</div>
                <div className="text-xs truncate" style={{ color: "var(--aras-soft)" }}>{user.email || "—"}</div>
              </div>
              <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${roleColor}15`, color: roleColor }}>{role.toUpperCase()}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: `${planColor}12`, color: planColor }}>{plan}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ background: isDisabled ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)", color: isDisabled ? "#EF4444" : "#10B981" }}>
                  {isDisabled ? "Disabled" : "Active"}
                </span>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150"
                style={{
                  background: tab === t.id ? "rgba(254,145,0,0.12)" : "transparent",
                  color: tab === t.id ? "var(--aras-orange)" : "var(--aras-soft)",
                  border: tab === t.id ? "1px solid rgba(254,145,0,0.2)" : "1px solid transparent",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {isLoading && <LoadingSkeleton />}
          {!isLoading && user && (
            <>
              {tab === "overview" && (
                <OverviewTab
                  user={user} data={data} isDisabled={isDisabled}
                  onCopyId={() => { navigator.clipboard.writeText(user.id); toast({ title: "ID kopiert" }); }}
                  onOpenModal={onOpenModal}
                  onRequestDisable={() => onRequestDisable(user)}
                  onRequestEnable={() => onRequestEnable(user)}
                  onClose={onClose}
                />
              )}
              {tab === "identity" && <IdentityTab userId={userId} user={user} onRefresh={refreshAll} />}
              {tab === "usage" && <UsageTab userId={userId} user={user} onRefresh={refreshAll} />}
              {tab === "settings" && <SettingsTab userId={userId} onRefresh={refreshAll} />}
              {tab === "kb" && <KnowledgeBaseTab userId={userId} />}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Loading Skeleton ──

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-14 h-14 rounded-full bg-white/[0.06]" />
        <div className="space-y-2"><Skeleton className="h-5 w-36 bg-white/[0.06]" /><Skeleton className="h-3 w-48 bg-white/[0.04]" /></div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />)}
    </div>
  );
}

// ── Shared UI ──

function InfoCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--aras-glass-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--aras-soft)" }}>{title}</h4>
        {action}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: any; mono?: boolean }) {
  return (
    <div className="flex justify-between text-xs">
      <span style={{ color: "var(--aras-soft)" }}>{label}</span>
      <span className={mono ? "font-mono" : ""} style={{ color: "var(--aras-muted)" }}>{value}</span>
    </div>
  );
}

function SmallBtn({ children, onClick, variant = "default", disabled, loading }: {
  children: React.ReactNode; onClick: () => void; variant?: "default" | "primary" | "danger"; disabled?: boolean; loading?: boolean;
}) {
  const bg = variant === "primary" ? "rgba(254,145,0,0.12)" : variant === "danger" ? "rgba(239,68,68,0.1)" : "rgba(255,255,255,0.04)";
  const border = variant === "primary" ? "rgba(254,145,0,0.25)" : variant === "danger" ? "rgba(239,68,68,0.2)" : "var(--aras-glass-border)";
  const color = variant === "primary" ? "var(--aras-orange)" : variant === "danger" ? "#EF4444" : "var(--aras-muted)";
  return (
    <button onClick={onClick} disabled={disabled || loading}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150 disabled:opacity-40"
      style={{ background: bg, border: `1px solid ${border}`, color }}>
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}{children}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 1: OVERVIEW
// ══════════════════════════════════════════════════════════════

function OverviewTab({ user, data, isDisabled, onCopyId, onOpenModal, onRequestDisable, onRequestEnable, onClose }: any) {
  return (
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <SmallBtn onClick={onCopyId}><Copy className="w-3 h-3" /> ID kopieren</SmallBtn>
        <SmallBtn variant="primary" onClick={() => { onClose(); onOpenModal("plan", user); }}><CreditCard className="w-3 h-3" /> Plan</SmallBtn>
        <SmallBtn variant="primary" onClick={() => { onClose(); onOpenModal("password", user); }}><Key className="w-3 h-3" /> Passwort</SmallBtn>
        <SmallBtn variant="primary" onClick={() => { onClose(); onOpenModal("role", user); }}><Shield className="w-3 h-3" /> Rolle</SmallBtn>
        {isDisabled ? (
          <SmallBtn onClick={onRequestEnable}><CheckCircle2 className="w-3 h-3" /> Aktivieren</SmallBtn>
        ) : (
          <SmallBtn variant="danger" onClick={onRequestDisable}><Ban className="w-3 h-3" /> Deaktivieren</SmallBtn>
        )}
      </div>

      {/* Account */}
      <InfoCard title="Account">
        <Row label="ID" value={user.id} mono />
        <Row label="Erstellt" value={user.created_at ? new Date(user.created_at).toLocaleDateString("de-DE") : "—"} />
        <Row label="Name" value={[user.first_name, user.last_name].filter(Boolean).join(" ") || "—"} />
        <Row label="Company" value={user.company || "—"} />
        <Row label="Branche" value={user.industry || "—"} />
        <Row label="Telefon" value={user.phone || "—"} />
      </InfoCard>

      {/* Stats */}
      {data?.stats && (
        <InfoCard title="Nutzung">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Calls", value: data.stats.totalCalls },
              { label: "Chats", value: data.stats.totalChats },
              { label: "Leads", value: data.stats.totalLeads },
              { label: "Contacts", value: data.stats.totalContacts },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="text-lg font-bold" style={{ color: "var(--aras-orange)" }}>{s.value}</div>
                <div className="text-xs" style={{ color: "var(--aras-soft)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </InfoCard>
      )}

      {/* Recent Calls */}
      {data?.calls && data.calls.length > 0 && (
        <InfoCard title="Letzte Anrufe">
          {data.calls.slice(0, 5).map((call: any) => (
            <div key={call.id} className="flex justify-between text-xs">
              <span style={{ color: "var(--aras-muted)" }}>{call.contact_name || call.contactName || call.phone_number || "—"}</span>
              <span style={{ color: "var(--aras-soft)" }}>{timeAgo(call.created_at || call.createdAt)}</span>
            </div>
          ))}
        </InfoCard>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 2: IDENTITY
// ══════════════════════════════════════════════════════════════

function IdentityTab({ userId, user, onRefresh }: { userId: string; user: any; onRefresh: () => void }) {
  const { toast } = useToast();
  const [username, setUsername] = useState(user.username || "");
  const [email, setEmail] = useState(user.email || "");
  const hasChanges = username !== (user.username || "") || email !== (user.email || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (username !== (user.username || "")) body.username = username;
      if (email !== (user.email || "")) body.email = email;
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      return data;
    },
    onSuccess: () => { toast({ title: "Gespeichert" }); onRefresh(); },
    onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <InfoCard title="Identität bearbeiten">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>Username</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>E-Mail</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
            />
          </div>
        </div>
      </InfoCard>
      <SmallBtn variant="primary" onClick={() => mutation.mutate()} disabled={!hasChanges} loading={mutation.isPending}>
        <Check className="w-3 h-3" /> Speichern
      </SmallBtn>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 3: USAGE
// ══════════════════════════════════════════════════════════════

function UsageTab({ userId, user, onRefresh }: { userId: string; user: any; onRefresh: () => void }) {
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const resetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/reset-usage`, { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Usage zurückgesetzt", description: `AI: ${data.before?.aiMessagesUsed || 0} → 0, Voice: ${data.before?.voiceCallsUsed || 0} → 0` });
      setConfirmOpen(false);
      onRefresh();
    },
    onError: (e: any) => { toast({ title: "Fehler", description: e.message, variant: "destructive" }); setConfirmOpen(false); },
  });

  return (
    <div className="space-y-4">
      <InfoCard title="Aktuelle Nutzung">
        <Row label="AI Messages" value={user.ai_messages_used ?? user.aiMessagesUsed ?? 0} />
        <Row label="Voice Calls" value={user.voice_calls_used ?? user.voiceCallsUsed ?? 0} />
        <Row label="Trial Messages" value={user.trial_messages_used ?? user.trialMessagesUsed ?? 0} />
        <Row label="Reset Datum" value={
          (user.monthly_reset_date || user.monthlyResetDate)
            ? new Date(user.monthly_reset_date || user.monthlyResetDate).toLocaleDateString("de-DE")
            : "—"
        } />
      </InfoCard>

      <SmallBtn variant="danger" onClick={() => setConfirmOpen(true)}>
        <RotateCcw className="w-3 h-3" /> Limits zurücksetzen
      </SmallBtn>

      <ArasConfirmDialog
        open={confirmOpen}
        title="Usage zurücksetzen?"
        description={`Alle Nutzungszähler für "${user.username}" werden auf 0 gesetzt. Das monatliche Reset-Datum wird auf heute gesetzt.`}
        variant="danger"
        confirmLabel="Zurücksetzen"
        loading={resetMutation.isPending}
        onConfirm={() => resetMutation.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 4: SETTINGS
// ══════════════════════════════════════════════════════════════

function SettingsTab({ userId, onRefresh }: { userId: string; onRefresh: () => void }) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-settings", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const [language, setLanguage] = useState("");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [notif, setNotif] = useState<any>({});
  const [privacy, setPrivacy] = useState<any>({});
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data?.settings && !initialized) {
      setLanguage(data.settings.language || "de");
      setPrimaryGoal(data.settings.primaryGoal || "");
      setNotif(data.settings.notificationSettings || {});
      setPrivacy(data.settings.privacySettings || {});
      setInitialized(true);
    }
  }, [data, initialized]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/settings`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ language, primaryGoal, notificationSettings: notif, privacySettings: privacy }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || "Failed");
      return d;
    },
    onSuccess: () => { toast({ title: "Settings gespeichert" }); onRefresh(); },
    onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      <InfoCard title="Sprache & Ziel">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>Sprache</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>Primäres Ziel</label>
            <input value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
              placeholder="z.B. Mehr Leads generieren"
            />
          </div>
        </div>
      </InfoCard>

      <InfoCard title="Benachrichtigungen">
        {[
          { key: "emailNotifications", label: "E-Mail Benachrichtigungen" },
          { key: "campaignAlerts", label: "Kampagnen Alerts" },
          { key: "weeklyReports", label: "Wöchentliche Reports" },
          { key: "aiSuggestions", label: "KI Vorschläge" },
        ].map((item) => (
          <Toggle key={item.key} label={item.label} checked={!!notif[item.key]}
            onChange={(v) => setNotif({ ...notif, [item.key]: v })} />
        ))}
      </InfoCard>

      <InfoCard title="Datenschutz">
        {[
          { key: "dataCollection", label: "Datenerfassung" },
          { key: "analytics", label: "Analytics" },
          { key: "thirdPartySharing", label: "Drittanbieter-Sharing" },
        ].map((item) => (
          <Toggle key={item.key} label={item.label} checked={!!privacy[item.key]}
            onChange={(v) => setPrivacy({ ...privacy, [item.key]: v })} />
        ))}
      </InfoCard>

      <SmallBtn variant="primary" onClick={() => saveMutation.mutate()} loading={saveMutation.isPending}>
        <Check className="w-3 h-3" /> Speichern
      </SmallBtn>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs" style={{ color: "var(--aras-muted)" }}>{label}</span>
      <button onClick={() => onChange(!checked)} className="w-9 h-5 rounded-full relative transition-all duration-200"
        style={{ background: checked ? "rgba(254,145,0,0.3)" : "rgba(255,255,255,0.08)" }}>
        <span className="absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200"
          style={{ left: checked ? "18px" : "2px", background: checked ? "var(--aras-orange)" : "rgba(255,255,255,0.3)" }} />
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TAB 5: KNOWLEDGE BASE
// ══════════════════════════════════════════════════════════════

function KnowledgeBaseTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modalMode, setModalMode] = useState<"create" | "edit" | null>(null);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-user-kb", userId, debouncedSearch, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50", offset: "0" });
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (typeFilter) params.set("type", typeFilter);
      const res = await fetch(`/api/admin/users/${userId}/kb?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: number) => {
      const res = await fetch(`/api/admin/users/${userId}/kb/${entryId}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Gelöscht" });
      setDeleteConfirm(null);
      qc.invalidateQueries({ queryKey: ["admin-user-kb", userId] });
    },
    onError: () => { toast({ title: "Fehler", variant: "destructive" }); setDeleteConfirm(null); },
  });

  const entries = data?.entries || [];
  const TYPE_ICONS: Record<string, typeof FileText> = { text: FileText, url: Link, file: File };

  return (
    <div className="space-y-4">
      {/* Search + Filter + Create */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: "var(--aras-soft)" }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="px-2 py-2 rounded-xl text-xs"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-muted)", outline: "none" }}>
          <option value="">Alle</option>
          <option value="text">Text</option>
          <option value="url">URL</option>
          <option value="file">File</option>
        </select>
        <SmallBtn variant="primary" onClick={() => { setEditEntry(null); setModalMode("create"); }}>
          <Plus className="w-3 h-3" /> Neu
        </SmallBtn>
      </div>

      {/* Loading */}
      {isLoading && <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl bg-white/[0.04]" />)}</div>}

      {/* Empty */}
      {!isLoading && entries.length === 0 && (
        <div className="py-12 text-center">
          <FileText className="w-8 h-8 mx-auto mb-2" style={{ color: "rgba(255,255,255,0.1)" }} />
          <p className="text-sm" style={{ color: "var(--aras-soft)" }}>Keine Einträge</p>
          <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Erstelle den ersten Wissensbank-Eintrag.</p>
        </div>
      )}

      {/* Entries List */}
      {!isLoading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry: any) => {
            const Icon = TYPE_ICONS[entry.type] || FileText;
            return (
              <div key={entry.id} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: "rgba(255,255,255,0.025)", border: "1px solid var(--aras-glass-border)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(254,145,0,0.08)" }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: "var(--aras-orange)" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate" style={{ color: "var(--aras-text)" }}>
                    {entry.title || entry.fileName || entry.url || "Untitled"}
                  </div>
                  <div className="text-[10px] mt-0.5 line-clamp-1" style={{ color: "var(--aras-soft)" }}>
                    {entry.contentPreview || entry.content_preview || "—"}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ background: "rgba(255,255,255,0.04)", color: "var(--aras-soft)" }}>{entry.type}</span>
                    <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>{timeAgo(entry.updatedAt || entry.updated_at)}</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => { setEditEntry(entry); setModalMode("edit"); }}
                    className="p-1.5 rounded-lg hover:bg-white/10"><Pencil className="w-3 h-3" style={{ color: "var(--aras-muted)" }} /></button>
                  <button onClick={() => setDeleteConfirm(entry)}
                    className="p-1.5 rounded-lg hover:bg-white/10"><Trash2 className="w-3 h-3" style={{ color: "#EF4444" }} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalMode && (
        <KbModal
          mode={modalMode}
          entry={editEntry}
          userId={userId}
          onClose={() => { setModalMode(null); setEditEntry(null); }}
          onSuccess={() => {
            setModalMode(null); setEditEntry(null);
            qc.invalidateQueries({ queryKey: ["admin-user-kb", userId] });
          }}
        />
      )}

      {/* Delete Confirm */}
      <ArasConfirmDialog
        open={!!deleteConfirm}
        title="Eintrag löschen?"
        description={`"${deleteConfirm?.title || deleteConfirm?.fileName || "Untitled"}" wird unwiderruflich gelöscht.`}
        variant="danger"
        confirmLabel="Löschen"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.id)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}

// ── KB Create/Edit Modal ──

function KbModal({ mode, entry, userId, onClose, onSuccess }: {
  mode: "create" | "edit"; entry: any; userId: string; onClose: () => void; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [type, setType] = useState(entry?.type || "text");
  const [title, setTitle] = useState(entry?.title || "");
  const [contentText, setContentText] = useState(entry?.contentText || entry?.content_text || "");
  const [url, setUrl] = useState(entry?.url || "");

  const mutation = useMutation({
    mutationFn: async () => {
      const isCreate = mode === "create";
      const path = isCreate ? `/api/admin/users/${userId}/kb` : `/api/admin/users/${userId}/kb/${entry.id}`;
      const body: any = { title };
      if (isCreate) body.type = type;
      if (type === "text" || !isCreate) body.contentText = contentText;
      if (type === "url" || !isCreate) body.url = url;

      const res = await fetch(path, {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      return data;
    },
    onSuccess: () => { toast({ title: mode === "create" ? "Erstellt" : "Aktualisiert" }); onSuccess(); },
    onError: (e: any) => toast({ title: "Fehler", description: e.message, variant: "destructive" }),
  });

  return createPortal(
    <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-[20px] overflow-hidden"
        style={{ background: "#1a1a1c", border: "1px solid var(--aras-stroke)", boxShadow: "0 25px 60px -12px rgba(0,0,0,0.7)" }}
        onClick={(e) => e.stopPropagation()}>

        <div className="flex items-center justify-between px-6 pt-6">
          <h3 className="font-orbitron text-base font-bold" style={{ color: "var(--aras-text)" }}>
            {mode === "create" ? "Neuer KB-Eintrag" : "KB-Eintrag bearbeiten"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10"><X className="w-4 h-4" style={{ color: "var(--aras-muted)" }} /></button>
        </div>

        <div className="px-6 py-4 space-y-3">
          {mode === "create" && (
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>Typ</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["text", "url"] as const).map((t) => (
                  <button key={t} onClick={() => setType(t)}
                    className="p-2 rounded-xl text-xs font-medium text-center transition-all"
                    style={{
                      background: type === t ? "rgba(254,145,0,0.12)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${type === t ? "rgba(254,145,0,0.25)" : "var(--aras-glass-border)"}`,
                      color: type === t ? "var(--aras-orange)" : "var(--aras-muted)",
                    }}>
                    {t === "text" ? "Text" : "URL"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>Titel</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
              className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
            />
          </div>

          {(type === "text" || mode === "edit") && (
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>Inhalt</label>
              <textarea value={contentText} onChange={(e) => setContentText(e.target.value)}
                rows={6} maxLength={50000}
                className="w-full mt-1 px-3 py-2 rounded-xl text-sm font-mono resize-y"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
              />
            </div>
          )}

          {(type === "url" || mode === "edit") && (
            <div>
              <label className="text-xs font-medium" style={{ color: "var(--aras-soft)" }}>URL</label>
              <input value={url} onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full mt-1 px-3 py-2 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-text)", outline: "none" }}
              />
            </div>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "rgba(255,255,255,0.06)", color: "var(--aras-muted)" }}>Abbrechen</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending || (!title && !contentText && !url)}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40"
            style={{ background: "var(--aras-orange)", color: "black" }}>
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {mode === "create" ? "Erstellen" : "Speichern"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
