import { useState, useEffect, createContext, useContext, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, Calendar, FileText, Wallet, User, LogOut, RefreshCw } from "lucide-react";

// ============================================================================
// Agent-Portal — gemeinsame Shell + Design-System (Paket E)
// Regeln: KEINE Emojis, KEINE bunten Icons. Monochrome Lucide-Linien-Icons in
// EINER neutralen Farbe (slate-400/500), genau EINE Akzentfarbe (#2563eb) für
// primäre Aktionen. Status = Text-Badges mit feinem Rahmen, keine Farbflächen.
// Ruhige Banking-/CRM-Anmutung, mobile-first, große aber schlichte Touch-Targets.
// ============================================================================

export const ACCENT = "#2563eb";

// ── Formatierung (Anzeige; Rechnen passiert NUR serverseitig) ────────────────
export function fmtCents(c: number | null | undefined): string {
  if (c == null || isNaN(Number(c))) return "—";
  return `${(Number(c) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function fmtEur(v: string | number | null | undefined): string {
  const n = Number(v);
  if (v == null || v === "" || isNaN(n)) return "—";
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

export function fmtD(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; }
}

export function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export function fmtTime(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export function isToday(v: string | null | undefined): boolean {
  if (!v) return false;
  const d = new Date(v), n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

export function initials(name: string | null | undefined): string {
  if (!name) return "–";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

// ── Status-Badges: Text mit feinem Rahmen (Paket E — keine Ampelflächen) ────
const BADGE_LABELS: Record<string, string> = {
  pending_payment: "Offen",
  claimed_paid: "Zahlung angekündigt",
  paid: "Bezahlt",
  expired: "Abgelaufen",
  refunded: "Erstattet",
  bestaetigt: "Bestätigt",
  in_auszahlung: "In Auszahlung",
  ausgezahlt: "Ausgezahlt",
  storniert: "Storniert",
  angefordert: "Angefordert",
  abgelehnt: "Abgelehnt",
  potenziell: "Potenziell",
};

export function Badge({ status, label }: { status?: string; label?: string }) {
  const text = label || BADGE_LABELS[status || ""] || status || "—";
  const emphasized = status === "claimed_paid" || status === "angefordert";
  return (
    <span
      className={`inline-block px-2.5 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${
        emphasized ? "border-slate-400 text-slate-700" : "border-slate-200 text-slate-500"
      }`}
    >
      {text}
    </span>
  );
}

// ── Avatar: dezenter Kreis, neutraler Hintergrund, Initialen-Fallback ───────
export function Avatar({ src, name, size = 36 }: { src?: string | null; name?: string | null; size?: number }) {
  return src ? (
    <img
      src={src}
      alt=""
      style={{ width: size, height: size }}
      className="rounded-full object-cover border border-slate-200 shrink-0"
    />
  ) : (
    <span
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.34) }}
      className="rounded-full bg-slate-100 border border-slate-200 text-slate-500 font-semibold flex items-center justify-center shrink-0"
    >
      {initials(name)}
    </span>
  );
}

// ── Auth-Context ─────────────────────────────────────────────────────────────
export interface AgentInfo { name: string; email: string }
const AgentCtx = createContext<{ agent: AgentInfo | null; reload: () => void }>({ agent: null, reload: () => {} });
export const useAgentInfo = () => useContext(AgentCtx);

export async function api(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

// ── Navigation ───────────────────────────────────────────────────────────────
const NAV = [
  { href: "/agent", label: "Kunden", icon: Users },
  { href: "/agent/kalender", label: "Kalender", icon: Calendar },
  { href: "/agent/skripte", label: "Skripte", icon: FileText },
  { href: "/agent/auszahlung", label: "Auszahlung", icon: Wallet },
  { href: "/agent/profil", label: "Profil", icon: User },
];

/**
 * Shell: prüft die Anmeldung, zeigt Kopfzeile + Navigation (Desktop oben,
 * Mobile als Bottom-Bar). Nicht angemeldet ⇒ Redirect auf /agent (Login).
 */
export function AgentShell({ children, onRefresh }: { children: ReactNode; onRefresh?: () => void }) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [location, navigate] = useLocation();

  const load = () => {
    api("/agent/me")
      .then((r) => setAgent(r.ok ? r.json.agent : null))
      .catch(() => setAgent(null))
      .finally(() => setChecked(true));
  };
  useEffect(load, []);

  useEffect(() => {
    if (checked && !agent && location !== "/agent") navigate("/agent");
  }, [checked, agent, location, navigate]);

  const logout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/fiaon/agent/logout", { method: "POST", credentials: "include" }).catch(() => {});
    navigate("/agent");
    setAgent(null);
  };

  if (!checked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="agent-core opacity-70" style={{ width: 64, height: 64 }} aria-hidden="true">
          <div className="agent-core__inner">
            <span className="agent-core__ring" /><span className="agent-core__ring" /><span className="agent-core__ring" />
            <span className="agent-core__ring" /><span className="agent-core__ring" /><span className="agent-core__glow" />
          </div>
        </div>
      </div>
    );
  }
  if (!agent) return <>{children}</>; // Login-Ansicht rendert die Seite selbst

  return (
    <AgentCtx.Provider value={{ agent, reload: load }}>
      <div className="agent-scope min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10">
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 min-w-0">
              <Link href="/agent" className="shrink-0">
                <span className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</span>
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Mitarbeiter</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {NAV.map((n) => {
                  const active = location === n.href;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        active ? "text-slate-900 bg-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="flex items-center gap-2">
              {onRefresh && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRefresh(); }}
                  title="Aktualisieren"
                  className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition-colors"
                >
                  <RefreshCw size={15} strokeWidth={1.8} />
                </button>
              )}
              <Link href="/agent/profil" className="hidden sm:block">
                <Avatar name={agent.name} size={32} />
              </Link>
              <button
                type="button"
                onClick={logout}
                title="Abmelden"
                className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 hover:border-slate-300 flex items-center justify-center transition-colors"
              >
                <LogOut size={15} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-5">{children}</main>

        {/* Mobile Bottom-Navigation */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 grid grid-cols-5" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map((n) => {
            const active = location === n.href;
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
                style={{ color: active ? ACCENT : "#94a3b8" }}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />}
                <Icon size={19} strokeWidth={active ? 2 : 1.6} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </AgentCtx.Provider>
  );
}

// ── Kleine Bausteine ─────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-slate-200 rounded-xl ${className}`}>{children}</div>;
}

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">{label}</p>
      <p className="text-xl font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </Card>
  );
}

/** Schmale Fortschrittsleiste (Monatsziel) — dezent, keine Gamification. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: ACCENT }} />
    </div>
  );
}

export function FlashMessage({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 px-4 py-3 rounded-xl bg-white border border-slate-300 text-[13px] font-medium text-slate-700">
      {message}
    </div>
  );
}

export const inputCls =
  "w-full px-3.5 py-2.5 rounded-lg border border-slate-200 bg-white text-[14px] text-slate-900 placeholder:text-slate-400 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-colors";

export const btnPrimary =
  "px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-colors disabled:opacity-40 bg-[#2563eb] hover:bg-[#1d4fd7]";

export const btnGhost =
  "px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors disabled:opacity-40";
