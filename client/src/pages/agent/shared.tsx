import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Users, Calendar, Wallet, LogOut, RefreshCw, LayoutDashboard, MoreHorizontal, Sparkles, X, PhoneCall, AlertTriangle } from "lucide-react";
import OnboardingGate from "./onboarding";
import { AGENT_UPDATES, getUnseenCount, fmtUpdateDate } from "./updates-data";

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

// Ticket #13: Anzeige IMMER in deutscher Geschäftszeit (Europe/Berlin) — unabhängig
// vom Standort des Betrachters (Betreiber in Bangkok, Agenten in Deutschland).
export function fmtD(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }); } catch { return "—"; }
}

export function fmtDT(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
}

export function fmtTime(v: string | null | undefined): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; }
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
  superseded: "Ersetzt (Dublette)",
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

// ── Navigation (Paket AO: 5 klare Punkte; Unterseiten markieren den Bereich) ─
const NAV: { href: string; label: string; icon: typeof Users; match: string[] }[] = [
  { href: "/agent", label: "Mein Tag", icon: LayoutDashboard, match: ["/agent"] },
  { href: "/agent/kunden", label: "Kunden", icon: Users, match: ["/agent/kunden"] },
  { href: "/agent/leads", label: "Leads", icon: PhoneCall, match: ["/agent/leads"] },
  { href: "/agent/kalender", label: "Kalender", icon: Calendar, match: ["/agent/kalender"] },
  { href: "/agent/verdienst", label: "Verdienst", icon: Wallet, match: ["/agent/verdienst", "/agent/auszahlung", "/agent/partner-programm"] },
  { href: "/agent/mehr", label: "Mehr", icon: MoreHorizontal, match: ["/agent/mehr", "/agent/skripte", "/agent/updates", "/agent/feedback", "/agent/profil", "/agent/leistung", "/agent/dokumente"] },
];

/**
 * Update-Banner (Paket AM): erscheint NUR im Agent-Portal, wenn ungelesene
 * veröffentlichte Updates existieren. Klick → /agent/updates (markiert dort
 * als gelesen und feuert 'agent-updates-read', der Banner verschwindet sofort).
 */
function UpdateBanner() {
  const [unseen, setUnseen] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setUnseen(getUnseenCount());
    const onSeen = () => setUnseen(0);
    window.addEventListener("agent-updates-seen", onSeen);
    return () => window.removeEventListener("agent-updates-seen", onSeen);
  }, []);

  if (dismissed || unseen === 0 || location === "/agent/updates") return null;

  const latest = AGENT_UPDATES[0];
  const dateStr = latest ? fmtUpdateDate(latest.date) : "";

  return (
    <div className="agent-banner-in relative border-b border-slate-200/80 overflow-hidden" style={{ background: "rgba(37,99,235,.06)" }}>
      <span className="agent-banner-shine" aria-hidden="true" />
      <div className="relative max-w-6xl mx-auto px-4 py-2.5 flex items-center gap-3">
        <span className="relative shrink-0 flex items-center justify-center">
          <span className="absolute inline-flex h-4 w-4 rounded-full opacity-40 animate-ping" style={{ background: ACCENT }} />
          <Sparkles size={15} strokeWidth={1.8} className="relative" style={{ color: ACCENT }} />
        </span>
        <Link href="/agent/updates" className="min-w-0 flex-1 text-[12.5px] font-medium text-slate-700 hover:text-slate-900 transition-colors truncate">
          <span className="font-semibold text-slate-900">{unseen} {unseen === 1 ? "neue Neuerung" : "neue Neuerungen"}</span>
          {dateStr ? ` (${dateStr})` : ""} — <span className="font-semibold" style={{ color: ACCENT }}>ansehen & lernen, wie du es bedienst</span>
        </Link>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }}
          title="Später lesen"
          className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/**
 * Shell: prüft die Anmeldung, zeigt Kopfzeile + Navigation (Desktop oben,
 * Mobile als Bottom-Bar). Nicht angemeldet ⇒ Redirect auf /agent (Login).
 */
export function AgentShell({ children, onRefresh }: { children: ReactNode; onRefresh?: () => void }) {
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [checked, setChecked] = useState(false);
  const [fbUnread, setFbUnread] = useState(0);
  // Onboarding-Gate (Prompt 1): solange nicht abgeschlossen, sieht der Agent
  // nur den Onboarding-Flow — keine Leads/Kunden/Kontaktdaten.
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [location, navigate] = useLocation();

  const load = () => {
    api("/agent/me")
      .then((r) => setAgent(r.ok ? r.json.agent : null))
      .catch(() => setAgent(null))
      .finally(() => setChecked(true));
  };
  useEffect(load, []);

  useEffect(() => {
    if (!agent) { setOnboardingComplete(null); return; }
    api("/agent/onboarding")
      .then((r) => setOnboardingComplete(r.ok ? !!r.json.status?.complete : true))
      .catch(() => setOnboardingComplete(true));
  }, [agent]);

  // Nav-Badge: Tickets mit ungelesener Betreiber-Antwort. Aktualisiert beim
  // Öffnen eines Threads (Event 'agent-feedback-read') und alle 60 s.
  useEffect(() => {
    if (!agent) return;
    const fetchState = () => api("/agent/feedback/state").then((r) => { if (r.ok) setFbUnread(r.json.unread); }).catch(() => {});
    fetchState();
    const onRead = () => fetchState();
    window.addEventListener("agent-feedback-read", onRead);
    const iv = setInterval(fetchState, 60_000);
    return () => { window.removeEventListener("agent-feedback-read", onRead); clearInterval(iv); };
  }, [agent]);

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

  // Onboarding-Status wird noch geladen → kurzer Ladezustand (kein Kurz-Aufblitzen
  // von Kundendaten, bevor das Gate greift).
  if (onboardingComplete === null) {
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
  // Pflicht-Gate: kein Portal, bis Zustimmung + Vertrag erledigt sind.
  if (!onboardingComplete) {
    return <OnboardingGate onComplete={() => window.location.reload()} />;
  }

  return (
    <AgentCtx.Provider value={{ agent, reload: load }}>
      <div className="agent-scope agent-ambient min-h-screen text-slate-900 pb-20 md:pb-10">
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 min-w-0">
              <Link href="/agent" className="shrink-0">
                <span className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</span>
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Mitarbeiter</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {NAV.map((n) => {
                  const active = n.match.includes(location);
                  const badge = n.href === "/agent/mehr" ? fbUnread : 0;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`relative px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        active ? "text-slate-900 bg-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {n.label}
                      {badge > 0 && (
                        <span className="absolute top-0.5 right-0 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center tabular-nums" style={{ background: ACCENT }}>
                          {badge}
                        </span>
                      )}
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

        <UpdateBanner />

        <main className="max-w-6xl mx-auto px-4 py-5">{children}</main>

        {/* Mobile Bottom-Navigation */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-slate-200 grid" style={{ gridTemplateColumns: `repeat(${NAV.length}, minmax(0,1fr))`, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map((n) => {
            const active = n.match.includes(location);
            const Icon = n.icon;
            const badge = n.href === "/agent/mehr" ? fbUnread : 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                className="relative flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors"
                style={{ color: active ? ACCENT : "#94a3b8" }}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full" style={{ background: ACCENT }} />}
                <span className="relative">
                  <Icon size={19} strokeWidth={active ? 2 : 1.6} />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 rounded-full text-[9px] font-bold text-white flex items-center justify-center tabular-nums" style={{ background: ACCENT }}>
                      {badge}
                    </span>
                  )}
                </span>
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

// ── PROMPT 2/2 · A — EIN modaler Bestätigungsdialog (ersetzt den Doppel-Tap) ──
// Zentriert auf Desktop, Bottom-Sheet auf Mobile. Fokus-Falle (Tab bleibt im
// Dialog), ESC/Backdrop schließt, Touch-Ziele ≥ 44 px. Der Schutz vor Versehen
// bleibt — er wird nur sichtbar. Zeigt optional die Folge der Aktion (z. B.
// „Der Kunde erhält eine E-Mail zur Nummern-Korrektur.") und kann ein Feld
// (Datum/Zeit) einbetten (children). Bestätigen ist erst möglich, wenn
// `confirmDisabled` false ist.
export interface ConfirmState {
  title: string;
  message?: string;
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({
  open, title, message, consequence, confirmLabel = "Bestätigen", cancelLabel = "Abbrechen",
  danger, busy, confirmDisabled, onConfirm, onCancel, children,
}: {
  open: boolean;
  title: string;
  message?: string;
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Fokus auf den primären Button (bzw. auf ein eingebettetes Feld, falls vorhanden)
    const t = setTimeout(() => {
      const firstField = panelRef.current?.querySelector<HTMLElement>("input, select, textarea");
      (firstField || confirmRef.current)?.focus();
    }, 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
      if (e.key === "Tab" && panelRef.current) {
        // Fokus-Falle: Tab zirkuliert nur innerhalb des Dialogs
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { clearTimeout(t); document.removeEventListener("keydown", onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="agent-scope fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px] agent-reveal" style={{ animationDuration: ".2s" }} />
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-sm bg-white border border-slate-200 rounded-t-2xl sm:rounded-2xl shadow-2xl agent-panel-in"
        style={{ animationDuration: ".24s", paddingBottom: "max(0px, env(safe-area-inset-bottom))" }}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            {danger && (
              <span className="mt-0.5 w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <AlertTriangle size={17} strokeWidth={1.9} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-[15.5px] font-bold text-slate-900">{title}</h3>
              {message && <p className="mt-1 text-[13px] text-slate-600 leading-relaxed">{message}</p>}
            </div>
          </div>

          {children && <div className="mt-3.5">{children}</div>}

          {consequence && (
            <div className="mt-3.5 px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-[12.5px] text-slate-600 leading-relaxed">
              {consequence}
            </div>
          )}

          <div className="mt-5 flex gap-2.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
              className="flex-1 rounded-xl border border-slate-200 bg-white text-[13.5px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors"
              style={{ minHeight: 48 }}
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmRef}
              type="button"
              disabled={busy || confirmDisabled}
              onClick={(e) => { e.stopPropagation(); onConfirm(); }}
              className={`flex-1 rounded-xl text-[13.5px] font-semibold text-white transition-colors disabled:opacity-40 ${danger ? "bg-slate-900 hover:bg-slate-800" : "bg-[#2563eb] hover:bg-[#1d4fd7]"}`}
              style={{ minHeight: 48 }}
            >
              {busy ? "…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export const btnPrimary =
  "px-4 py-2.5 rounded-lg text-white text-[13px] font-semibold transition-colors disabled:opacity-40 bg-[#2563eb] hover:bg-[#1d4fd7]";

export const btnGhost =
  "px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-[13px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 transition-colors disabled:opacity-40";
