import { useQuery } from "@tanstack/react-query";
import { X, Copy, CreditCard, Key } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ROLE_OPTIONS, PLAN_OPTIONS, getRoleColor, getPlanColor, timeAgo } from "./constants";
import { createPortal } from "react-dom";

interface UserDeepDivePanelProps {
  userId: string;
  onClose: () => void;
  onOpenModal: (type: "plan" | "password", user: any) => void;
  reducedMotion: boolean;
}

export function UserDeepDivePanel({ userId, onClose, onOpenModal, reducedMotion }: UserDeepDivePanelProps) {
  const { toast } = useToast();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-deep-dive", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/deep-dive`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!userId,
  });

  return createPortal(
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div
        className={reducedMotion ? "fixed inset-0 bg-black/60" : "fixed inset-0 bg-black/60 backdrop-blur-sm"}
        style={reducedMotion ? {} : { animation: "fadeIn 200ms ease-out" }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed right-0 top-0 h-full w-full sm:w-[600px] overflow-y-auto"
        style={{
          background: "#111113",
          borderLeft: "1px solid var(--aras-glass-border)",
          boxShadow: "-20px 0 60px rgba(0,0,0,0.5)",
          ...(reducedMotion ? {} : { animation: "slideInRight 220ms ease-out" }),
        }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex items-center justify-between px-5 py-4"
          style={{ background: "#111113", borderBottom: "1px solid var(--aras-glass-border)" }}
        >
          <h2 className="text-base font-bold" style={{ color: "var(--aras-text)" }}>User Details</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10">
            <X className="w-4 h-4" style={{ color: "var(--aras-muted)" }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {isLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Skeleton className="w-14 h-14 rounded-full bg-white/[0.06]" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-36 bg-white/[0.06]" />
                  <Skeleton className="h-3 w-48 bg-white/[0.04]" />
                </div>
              </div>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl bg-white/[0.04]" />
              ))}
            </div>
          )}

          {!isLoading && data?.user && (() => {
            const u = data.user;
            const role = (u.user_role || u.userRole || "user").toLowerCase();
            const plan = u.subscription_plan || u.subscriptionPlan || "free";
            const status = u.subscription_status || u.subscriptionStatus || "active";
            const isDisabled = status === "disabled";
            const roleColor = getRoleColor(role);
            const planColor = getPlanColor(plan);

            return (
              <>
                {/* Profile */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold"
                    style={{ background: `${roleColor}20`, color: roleColor }}
                  >
                    {(u.username?.[0] || "?").toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: "var(--aras-text)" }}>{u.username || "—"}</h3>
                    <p className="text-sm" style={{ color: "var(--aras-soft)" }}>{u.email || "—"}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${roleColor}15`, color: roleColor }}>{role.toUpperCase()}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${planColor}12`, color: planColor }}>{plan}</span>
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: isDisabled ? "rgba(239,68,68,0.08)" : "rgba(16,185,129,0.08)", color: isDisabled ? "#EF4444" : "#10B981" }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isDisabled ? "bg-red-400" : "bg-emerald-400"}`} />
                        {isDisabled ? "Disabled" : "Active"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <QuickAction icon={Copy} label="ID kopieren" onClick={() => { navigator.clipboard.writeText(u.id); toast({ title: "ID kopiert" }); }} />
                  <QuickAction icon={CreditCard} label="Plan" onClick={() => { onClose(); onOpenModal("plan", u); }} />
                  <QuickAction icon={Key} label="Passwort" onClick={() => { onClose(); onOpenModal("password", u); }} />
                </div>

                {/* Account Card */}
                <InfoCard title="Account">
                  {[
                    { label: "ID", value: u.id },
                    { label: "Erstellt", value: u.created_at ? new Date(u.created_at).toLocaleDateString("de-DE") : "—" },
                    { label: "Name", value: [u.first_name, u.last_name].filter(Boolean).join(" ") || "—" },
                    { label: "Company", value: u.company || "—" },
                    { label: "AI Messages", value: u.ai_messages_used ?? "—" },
                    { label: "Voice Calls", value: u.voice_calls_used ?? "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between text-xs">
                      <span style={{ color: "var(--aras-soft)" }}>{row.label}</span>
                      <span className="font-mono" style={{ color: "var(--aras-muted)" }}>{row.value}</span>
                    </div>
                  ))}
                </InfoCard>

                {/* Stats */}
                {data.stats && (
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
                {data.calls && data.calls.length > 0 && (
                  <InfoCard title="Letzte Anrufe">
                    {data.calls.slice(0, 5).map((call: any) => (
                      <div key={call.id} className="flex justify-between text-xs">
                        <span style={{ color: "var(--aras-muted)" }}>{call.contact_name || call.contactName || call.phone_number || "—"}</span>
                        <span style={{ color: "var(--aras-soft)" }}>{timeAgo(call.created_at || call.createdAt)}</span>
                      </div>
                    ))}
                  </InfoCard>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}

function QuickAction({ icon: Icon, label, onClick }: { icon: typeof Copy; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--aras-glass-border)", color: "var(--aras-muted)" }}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--aras-glass-border)" }}>
      <h4 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: "var(--aras-soft)" }}>{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
