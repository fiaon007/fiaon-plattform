import { useState, useEffect, useRef, createContext, useContext, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Softphone } from "@/components/Softphone";
import { Users, Calendar, Wallet, LogOut, RefreshCw, LayoutDashboard, MoreHorizontal, Sparkles, X, PhoneCall, AlertTriangle, Menu, ChevronRight, ListChecks, Mail } from "lucide-react";
import OnboardingGate from "./onboarding";
import {
  AGENT_UPDATES, getUnseenCount, fmtUpdateDate,
  getUnseenImportant, markImportantSeen, type AgentUpdate,
} from "./updates-data";

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
// vom Standort des Betrachters (Vorgesetzter in Bangkok, Agenten in Deutschland).
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

/**
 * Die Leiste während einer Ansichts-Sitzung.
 *
 * Sie ist absichtlich unschön laut: dunkelblau, volle Breite, oben fixiert.
 * Ein dezenter Hinweis wäre nach zwei Minuten unsichtbar, und dann klickt
 * jemand auf einen Knopf und wundert sich, warum nichts passiert.
 */
function AnsichtsBanner({ agent }: { agent: AgentInfo }) {
  const [rest, setRest] = useState("");
  useEffect(() => {
    if (!agent.ansichtBis) return;
    const rechnen = () => {
      const m = Math.max(0, Math.round((new Date(agent.ansichtBis!).getTime() - Date.now()) / 60000));
      setRest(m > 0 ? `noch ${m} Min` : "abgelaufen");
    };
    rechnen();
    const uhr = setInterval(rechnen, 30_000);
    return () => clearInterval(uhr);
  }, [agent.ansichtBis]);

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9000,
      display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
      padding: "8px 16px", minHeight: 44,
      background: "linear-gradient(178deg, #14264f, #0a1a3c 62%, #071129)",
      color: "#eef3fb",
      boxShadow: "0 8px 22px -12px rgba(7,17,41,.7), inset 0 -1px 0 rgba(255,255,255,.08)",
    }}>
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor"
           strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
           style={{ flexShrink: 0, opacity: .8 }}>
        <path d="M1.8 10S4.9 4.5 10 4.5 18.2 10 18.2 10 15.1 15.5 10 15.5 1.8 10 1.8 10Z" />
        <circle cx="10" cy="10" r="2.4" />
      </svg>
      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 0 }}>
        Du siehst das Portal als {agent.name}
      </span>
      <span style={{ fontSize: 11.5, color: "rgba(226,236,250,.62)" }}>
        Nur-Ansicht · Aktionen sind abgeschaltet{rest && ` · ${rest}`}
      </span>
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/fiaon/agent/ansicht/beenden", { method: "POST", credentials: "include" })
            .catch(() => {});
          window.location.href = "/admin/team";
        }}
        style={{
          marginLeft: "auto", flexShrink: 0, border: 0, cursor: "pointer",
          padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 700,
          background: "rgba(255,255,255,.14)", color: "#fff",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,.18)",
        }}>
        Beenden
      </button>
    </div>
  );
}

// ── Auth-Context ─────────────────────────────────────────────────────────────
// `avatar` und `rolle` liefert /agent/me seit dem 11.08.2026 mit. Vorher
// zeichnete die Kopfzeile aus dem Namen Initialen — auch bei jedem, der ein
// Profilbild hinterlegt hatte.
export interface AgentInfo {
  name: string; email: string;
  avatar?: string | null; rolle?: string;
  is_test_account?: boolean; pruefkonto?: boolean;
  /** Läuft eine Ansichts-Sitzung des Vorgesetzten? */
  ansicht?: boolean; ansichtBis?: string | null;
}
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
const NAV: { href: string; label: string; icon: typeof Users; match: string[]; nurRolle?: string; marke?: string }[] = [
  // „Mein Tag“ (/agent) ist bewusst KEIN Menüpunkt mehr: Die Seite bezieht ihre
  // Zahlen aus /agent/kartei/status und /agent/kartei/segmente, und die Kartei
  // ist abgeschaltet. Sie wäre eine leere Seite mit Nullen. Angemeldete Agenten
  // werden von /agent direkt auf „Heute“ geleitet.
  // „Heute“ ersetzt die offene Kartei. Der Unterschied ist nicht die Optik: In
  // der Kartei suchte sich der Agent Akten aus einem gemeinsamen Bestand, hier
  // bekommt er seine Kunden zugewiesen. Der Kartei-Eintrag ist entfernt, weil
  // die Kartei abgeschaltet ist und ein Menüpunkt ins Leere zeigen würde.
  // ── UMSTELLUNG 05.08.2026 ─────────────────────────────────────────────────
  // Aus "Heute" wurde "Start". Der Vertrieb hat gemeldet, dass eine Tagesliste
  // NEBEN der Kundenliste doppelte Arbeit erzeugt: Zwei Listen ueber denselben
  // Bestand sind zwei Wahrheiten, und zwei Mitarbeiter riefen denselben Menschen
  // an. Die Startseite informiert jetzt (Verdienst, Zahlen, Termine) und
  // arbeitet nicht mehr — gearbeitet wird ausschliesslich unter "Kunden".
  { href: "/agent/start", label: "Start", icon: LayoutDashboard, match: ["/agent/start", "/agent/heute"] },
  // Space steht direkt nach Start — es ist die Startseite nach dem Login.
  { href: "/agent/space", label: "Space", icon: Users, match: ["/agent/space"], marke: "space" },
  // Zeigt auf /agent/kunden, NICHT auf /agent/meine-kunden: Letztere Seite holt
  // ihre Liste aus /agent/kartei/meine, und das antwortet mit 410. Ein
  // Menüpunkt, der auf eine leere Seite führt, ist schlimmer als keiner.
  // "Kunden" ist die EINZIGE Arbeitsliste. Der frueher hier verlinkte Bestand aus
  // Bestellungen (/agent/meine-kunden) bleibt als Treffer erhalten, damit ein
  // gemerkter Link nicht ins Leere fuehrt.
  { href: "/agent/kunden", label: "Kunden", icon: Users, match: ["/agent/kunden", "/agent/meine-kunden"] },
  // Aufgaben stehen bewusst VOR dem Kalender: Ein zugewiesener Auftrag mit
  // Frist ist verbindlicher als ein selbst gesetzter Termin.
  { href: "/agent/aufgaben", label: "Aufgaben", icon: ListChecks, match: ["/agent/aufgaben"] },
  { href: "/agent/kalender", label: "Kalender", icon: Calendar, match: ["/agent/kalender"] },
  { href: "/agent/verdienst", label: "Verdienst", icon: Wallet, match: ["/agent/verdienst", "/agent/auszahlung", "/agent/partner-programm"] },
  // Nur fuer die Vertriebsleitung. `nurRolle` filtert die Anzeige; die Tuer selbst
  // schliesst der Server (404 fuer alle anderen).
  // Der Space ist fuer JEDE Rolle da — er ist der einzige Ort im Portal, der
  // nichts abarbeitet. Die Marke zeigt ungelesene Beitraege.
  { href: "/agent/mail-zentrale", label: "Mail", icon: Mail, match: ["/agent/mail-zentrale"] },
  { href: "/agent/vertrieb", label: "Vertrieb", icon: LayoutDashboard, match: ["/agent/vertrieb"], nurRolle: "vertriebsleiter" },
  // Nur fuer das Onboarding. Wie beim Vertrieb: `nurRolle` blendet aus, die
  // Tuer selbst schliesst der Server (404 fuer alle anderen).
  { href: "/agent/startgespraeche", label: "Startgespräche", icon: Calendar, match: ["/agent/startgespraeche"], nurRolle: "onboarding" },
  { href: "/agent/mehr", label: "Mehr", icon: MoreHorizontal, match: ["/agent/mehr", "/agent/skripte", "/agent/updates", "/agent/feedback", "/agent/profil", "/agent/leistung", "/agent/dokumente"] },
];

/**
 * Update-Banner (Paket AM): erscheint NUR im Agent-Portal, wenn ungelesene
 * veröffentlichte Updates existieren. Klick → /agent/updates (markiert dort
 * als gelesen und feuert 'agent-updates-read', der Banner verschwindet sofort).
 */
/**
 * Banner für persönliche Nachrichten der Leitung.
 *
 * Steht über allem und bleibt, bis der Mensch „Verstanden" klickt oder die
 * Frist abläuft. Der Klick ist der eigentliche Zweck: Die Leitung sieht
 * danach in der Team-Zentrale, wer wann bestätigt hat.
 *
 * Ein Fehler beim Laden bleibt STILL. Eine Nachricht, die nicht kommt, ist
 * ärgerlich; eine Fehlermeldung über allem, wo eine Nachricht stehen sollte,
 * ist schlimmer.
 */
function TeamNachrichten() {
  const [liste, setListe] = useState<{ id: number; text: string; created_by: string }[]>([]);

  useEffect(() => {
    let weg = false;
    fetch("/api/fiaon/agent/nachrichten", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (!weg && j?.ok) setListe(j.nachrichten || []); })
      .catch(() => {});
    return () => { weg = true; };
  }, []);

  if (liste.length === 0) return null;
  const n = liste[0];

  return (
    <div className="px-4 pt-3">
      <div className="mx-auto max-w-6xl rounded-2xl px-4 py-3 flex flex-wrap items-center gap-3"
           style={{ background: "rgba(29,78,216,.06)", border: "1px solid rgba(29,78,216,.2)" }}>
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-bold uppercase tracking-[.14em]" style={{ color: "var(--fi-primaer)" }}>
            Von {n.created_by}
          </p>
          <p className="text-[13.5px] leading-relaxed mt-0.5" style={{ color: "var(--fi-text)" }}>{n.text}</p>
        </div>
        <button type="button"
                onClick={async () => {
                  setListe((l) => l.filter((x) => x.id !== n.id));
                  await fetch(`/api/fiaon/agent/nachrichten/${n.id}/verstanden`, {
                    method: "POST", credentials: "include",
                  }).catch(() => {});
                }}
                className="fi-primaerknopf shrink-0 px-4 py-2 text-[13px] font-semibold">
          Verstanden
        </button>
      </div>
    </div>
  );
}

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
 * Einmaliger Hinweis für als „wichtig" markierte Updates — erscheint beim
 * nächsten Login genau EINMAL und danach nie wieder. Bewusst zurückhaltend:
 * kein Zwang, kein Blockieren der Arbeit, mit einem Tipp weg.
 */
function ImportantUpdateHint() {
  const [items, setItems] = useState<AgentUpdate[]>([]);
  const [location] = useLocation();

  useEffect(() => {
    // Kurz warten, damit der Hinweis nicht in die Ladephase platzt.
    const t = setTimeout(() => setItems(getUnseenImportant()), 900);
    return () => clearTimeout(t);
  }, []);

  if (items.length === 0 || location === "/agent/updates") return null;

  const schliessen = () => {
    markImportantSeen(items.map((u) => u.id));
    setItems([]);
  };

  return (
    // 76px unterer Abstand hielten den schwebenden „Nächste Akte"-Knopf frei.
    // Der Knopf ist entfernt; die Meldung rückt jetzt bis an den Bildrand und
    // respektiert nur noch die Geräte-Sicherheitszone.
    <div className="fixed inset-x-0 bottom-0 z-[60] sm:bottom-4 sm:right-4 sm:left-auto sm:max-w-sm px-3 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-0 sm:px-0">
      <div className="agent-banner-in rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-24px_rgba(15,23,42,.35)] overflow-hidden">
        <div className="px-4 pt-3.5 pb-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0" style={{ color: ACCENT }}>
              <Sparkles size={16} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-slate-900">
                {items.length === 1 ? "Eine wichtige Neuerung" : `${items.length} wichtige Neuerungen`}
              </p>
              <ul className="mt-1 space-y-0.5">
                {items.slice(0, 3).map((u) => (
                  <li key={u.id} className="text-[12px] text-slate-600 leading-snug">{u.title}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="flex border-t border-slate-100">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); schliessen(); }}
            className="flex-1 px-4 py-3 text-[12.5px] font-semibold text-slate-500 hover:bg-slate-50 transition-colors"
            style={{ minHeight: 46 }}
          >
            Verstanden
          </button>
          <Link
            href="/agent/updates"
            onClick={schliessen}
            className="flex-1 px-4 py-3 text-[12.5px] font-semibold text-center border-l border-slate-100 hover:bg-slate-50 transition-colors"
            style={{ color: ACCENT, minHeight: 46 }}
          >
            Ansehen
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Respektiert die Systemeinstellung „Bewegung reduzieren". Bewusst lokal
 * definiert: `./motion` importiert aus dieser Datei, ein Gegenimport waere
 * ein Ringschluss.
 */
function useReduzierteBewegung(): boolean {
  const [reduziert, setReduziert] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const an = () => setReduziert(mq.matches);
    an();
    mq.addEventListener("change", an);
    return () => mq.removeEventListener("change", an);
  }, []);
  return reduziert;
}

/**
 * Seitliches Ausklapp-Menü — ersetzt die Fußzeilen-Leiste auf dem Handy.
 *
 * Bedienung mit einer Hand: Der Auslöser sitzt oben links, laesst sich aber
 * auch mit einer Wisch-Geste von der linken Kante oeffnen; geschlossen wird
 * per Wisch nach links, Tipp auf den Hintergrund oder Escape.
 *
 * Waehrend das Menue offen ist, wird der Seiteninhalt gesperrt und leicht
 * zurueckgesetzt. Das Sperren ist nicht nur Deko: Ohne Scrollen kann die
 * verschobene Kopfzeile nicht verrutschen.
 */
function AgentDrawer({
  open, onClose, location, zaehler, rolle,
}: {
  open: boolean;
  onClose: () => void;
  location: string;
  /** Pro Ziel-Pfad genau eine Zahl — dieselbe Quelle wie der Auslöser. */
  zaehler: Record<string, number>;
  /** Rolle des Angemeldeten — entscheidet nur über die ANZEIGE des
   *  Vertriebs-Punkts. Die Zugangsprüfung liegt im Server. */
  rolle: string;
}) {
  const reduziert = useReduzierteBewegung();
  const [zieh, setZieh] = useState(0);
  const start = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => {
      document.body.style.overflow = vorher;
      window.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);

  useEffect(() => { if (!open) setZieh(0); }, [open]);

  if (!open) return null;

  const onTouchStart = (e: React.TouchEvent) => { start.current = e.touches[0].clientX; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (start.current === null) return;
    const dx = e.touches[0].clientX - start.current;
    if (dx < 0) setZieh(Math.max(-320, dx));
  };
  const onTouchEnd = () => {
    if (zieh < -70) onClose();
    setZieh(0);
    start.current = null;
  };

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Menü">
      <button
        type="button"
        aria-label="Menü schließen"
        onClick={onClose}
        className="absolute inset-0 w-full h-full bg-slate-900/40 backdrop-blur-[2px] agent-drawer-backdrop"
        style={reduziert ? { animation: "none" } : undefined}
      />
      <div
        className="absolute inset-y-0 left-0 w-[82%] max-w-[320px] bg-white shadow-[0_24px_70px_-20px_rgba(15,23,42,.45)] flex flex-col agent-drawer-panel"
        style={{
          transform: zieh ? `translateX(${zieh}px)` : undefined,
          transition: zieh ? "none" : undefined,
          animation: reduziert ? "none" : undefined,
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="px-5 pt-5 pb-4 border-b border-slate-100">
          <span className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</span>
          <span className="ml-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Team</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV.filter((n) => !n.nurRolle || n.nurRolle === rolle).map((n, i) => {
            const aktiv = n.match.includes(location);
            const Icon = n.icon;
            const zahl = zaehler[n.href] || 0;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={onClose}
                className={`relative flex items-center gap-3 px-3 rounded-xl mb-1 transition-colors ${
                  aktiv ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"
                } ${reduziert ? "" : "agent-drawer-item"}`}
                style={{ minHeight: 48, animationDelay: reduziert ? undefined : `${40 + i * 32}ms` }}
              >
                {aktiv && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full" style={{ background: ACCENT }} />
                )}
                <Icon size={18} strokeWidth={aktiv ? 2 : 1.7} style={{ color: aktiv ? ACCENT : "#94a3b8" }} />
                <span className="text-[14px] font-medium flex-1">{n.label}</span>
                {zahl > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center tabular-nums" style={{ background: ACCENT }}>
                    {zahl}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-3 pt-2 border-t border-slate-100">
          <Link
            href="/agent/profil"
            onClick={onClose}
            className="flex items-center gap-3 px-3 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors"
            style={{ minHeight: 46 }}
          >
            <Users size={17} strokeWidth={1.7} className="text-slate-400" />
            <span className="text-[13.5px] font-medium">Mein Profil</span>
          </Link>
        </div>
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
  // Ausklapp-Menü (mobil) — ersetzt die Fußzeilen-Leiste.
  const [menueOffen, setMenueOffen] = useState(false);
  const [neueUpdates, setNeueUpdates] = useState(0);
  const [ruecklaeufer, setRuecklaeufer] = useState(0);
  const [aufgabenFaellig, setAufgabenFaellig] = useState(0);
  const [spaceNeu, setSpaceNeu] = useState(0);
  // Rolle des angemeldeten Mitarbeiters. Der Menuepunkt "Vertrieb" erscheint nur
  // fuer die Vertriebsleitung. Die Sicherheitsgrenze liegt aber im Server: Ein
  // normaler Agent, der die Adresse direkt aufruft, bekommt 404. Was hier
  // passiert, ist Aufraeumen der Ansicht, nicht Schutz.
  const [rolle, setRolle] = useState<string>("agent");

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

  // Ungelesene Space-Beiträge. Alle zwei Minuten — häufiger wäre Unruhe für
  // eine Zahl, die niemand sekundengenau braucht.
  useEffect(() => {
    if (!agent) return;
    const hole = () => api("/agent/space/ungelesen")
      .then((r) => { if (r.ok) setSpaceNeu(r.json.anzahl || 0); }).catch(() => {});
    hole();
    const t = setInterval(hole, 120_000);
    return () => clearInterval(t);
  }, [agent, location]);

  // Nav-Badge: Tickets mit ungelesener Vorgesetzten-Antwort. Aktualisiert beim
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

  // Zaehler am Menue-Ausloeser: ungelesene Neuerungen + Akten, die bald
  // zurueck in die Kartei laufen. Beides darf nicht untergehen, nur weil die
  // Navigation jetzt hinter einem Knopf liegt.
  useEffect(() => {
    setNeueUpdates(getUnseenCount());
    const gesehen = () => setNeueUpdates(0);
    window.addEventListener("agent-updates-seen", gesehen);
    return () => window.removeEventListener("agent-updates-seen", gesehen);
  }, []);

  useEffect(() => {
    if (!agent) return;
    // Quelle ist das CRM-Dashboard, NICHT mehr /agent/kartei/status: Die Kartei
    // ist abgeschaltet und antwortet dort mit 410. Ein Poll alle zwei Minuten
    // gegen einen 410er hätte den Zähler still auf 0 stehen lassen.
    // Gezählt wird ALLES, was auf „Heute" oben zu tun ist: heute fällig PLUS
    // gemeldete Zahlungen ohne Geldeingang PLUS überfällige Zusagen. Nur
    // `heuteFaellig` wäre irreführend — bei Daniel steht das auf 0, während
    // 26 gemeldete Zahlungen und 10 überfällige Zusagen auf ihn warten. Ein
    // Badge, der 0 zeigt, obwohl 36 Vorgänge offen sind, ist schlimmer als
    // keiner: der Agent hält die Seite für abgearbeitet.
    const holen = () => api("/agent/crm/dashboard")
      .then((r) => {
        if (!r.ok) return;
        const z = r.json.zahlen ?? {};
        setRuecklaeufer((z.heuteFaellig || 0) + (z.ohneDatum || 0) + (z.ueberfaellig || 0));
      })
      .catch(() => {});
    holen();
    const iv = setInterval(holen, 120_000);
    return () => clearInterval(iv);
  }, [agent]);

  useEffect(() => {
    if (!agent) return;
    api("/agent/start")
      .then((r) => { if (r.ok) setRolle(String(r.json.agent?.rolle || "agent")); })
      .catch(() => {});
  }, [agent]);

  // Zugewiesene Aufgaben: heute fällig + überfällig. Aktualisiert alle zwei
  // Minuten und sofort, wenn der Agent auf der Aufgabenseite abhakt.
  useEffect(() => {
    if (!agent) return;
    const holen = () => api("/agent/vermerke/zahlen")
      .then((r) => { if (r.ok) setAufgabenFaellig((r.json.heute || 0) + (r.json.ueberfaellig || 0)); })
      .catch(() => {});
    holen();
    const geaendert = () => holen();
    window.addEventListener("agent-aufgaben-geaendert", geaendert);
    const iv = setInterval(holen, 120_000);
    return () => { window.removeEventListener("agent-aufgaben-geaendert", geaendert); clearInterval(iv); };
  }, [agent]);

  // Menue schliesst sich beim Seitenwechsel — sonst bleibt es nach einem
  // Zurueck-Tipp des Browsers offen stehen.
  useEffect(() => { setMenueOffen(false); }, [location]);

  // Wisch-Geste von der linken Kante oeffnet das Menue. Bewusst schmal (24 px),
  // damit horizontales Wischen in Listen nicht versehentlich ausloest.
  useEffect(() => {
    if (!agent) return;
    let startX: number | null = null;
    let startY: number | null = null;
    const an = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX <= 24 ? t.clientX : null;
      startY = t.clientY;
    };
    const bewegt = (e: TouchEvent) => {
      if (startX === null || startY === null) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx > 60 && dy < 40) { setMenueOffen(true); startX = null; }
    };
    const aus = () => { startX = null; startY = null; };
    window.addEventListener("touchstart", an, { passive: true });
    window.addEventListener("touchmove", bewegt, { passive: true });
    window.addEventListener("touchend", aus);
    return () => {
      window.removeEventListener("touchstart", an);
      window.removeEventListener("touchmove", bewegt);
      window.removeEventListener("touchend", aus);
    };
  }, [agent]);

  useEffect(() => {
    if (checked && !agent && location !== "/agent") navigate("/agent");
  }, [checked, agent, location, navigate]);

  // Startseite nach dem Login ist „Start“ (bis 05.08.2026: „Heute“). /agent
  // bleibt die Anmeldeseite für Nichtangemeldete — deshalb hängt die
  // Weiterleitung an `agent`, nicht am Pfad allein, und kann nicht in einer
  // Schleife enden.
  useEffect(() => {
    // ── SPACE IST DIE STARTSEITE (11.08.2026) ─────────────────────────────
    // Vorher landete jede Rolle auf „Start" — Zahlen und Termine. Das ist die
    // Pflicht, nicht der Grund, morgens hier zu sein. Der Space zeigt zuerst,
    // was das Team gemacht hat; die Zahlen sind einen Klick entfernt und
    // stehen als Tagesleiste ohnehin über dem Feed.
    if (checked && agent && location === "/agent") navigate("/agent/space", { replace: true });
  }, [checked, agent, location, navigate]);

  const logout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/fiaon/agent/logout", { method: "POST", credentials: "include" }).catch(() => {});
    navigate("/agent");
    setAgent(null);
  };

  // EINE QUELLE, EINE WAHRHEIT (28.07.2026):
  // Der Zaehler am Ausloeser ist die Summe genau dieser Karte — er kann nicht
  // mehr von den Zahlen im Menue abweichen. Vorher wurden die Rueckläufer nur
  // aussen mitgezaehlt und tauchten im Menue nirgends auf: aussen 3, innen 2,
  // und der Agent suchte den dritten Punkt vergeblich.
  // Wer hier etwas eintraegt, muss es einem Menuepunkt zuordnen — sonst kann
  // es nicht gezaehlt werden.
  const zaehler: Record<string, number> = {
    // Kunden, die heute fällig sind. Der Zähler hängt jetzt an „Kunden“ und
    // nicht mehr an der Startseite: Gearbeitet wird in der Kundenliste, und eine
    // Zahl gehört dorthin, wo man sie abarbeitet — sonst schickt sie den Agenten
    // auf eine Seite, auf der er nichts tun kann.
    "/agent/kunden": ruecklaeufer,
    // Zugewiesene Aufgaben: gezählt wird, was heute oder früher fällig ist.
    // Eine Aufgabe für nächste Woche soll den Zähler nicht dauerhaft rot
    // halten — sonst gewöhnt man sich an die Zahl und sieht sie nicht mehr.
    "/agent/aufgaben": aufgabenFaellig,
    // Neuerungen und Vorgesetzten-Antworten liegen beide unter „Mehr".
    "/agent/mehr": neueUpdates + fbUnread,
    // Ungelesene Beiträge im Space. Sie zählen bewusst mit in die Menü-Marke
    // auf dem Telefon: Der Space ist kein Nebenschauplatz, sondern der Ort,
    // an dem etwas vom Team steht.
    "/agent/space": spaceNeu,
  };
  const menuBadge = Object.values(zaehler).reduce((s, n) => s + n, 0);

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
      {/* pb-20 hielt Platz für den entfernten schwebenden Knopf frei. Ohne ihn
          braucht die Seite unten nur noch normalen Auslauf. */}
      {/* ── NUR-ANSICHT: der Banner, den man nicht übersehen kann ─────────
          Dunkelblaue Leiste ganz oben, über allem, nicht wegklickbar. Wer
          sie übersieht, hat sie nicht gesehen — deshalb trägt sie den Namen
          des Menschen und die verbleibende Zeit. */}
      {agent?.ansicht && <AnsichtsBanner agent={agent} />}
      <div className={`agent-scope agent-ambient min-h-screen text-slate-900 pb-10 ${agent?.ansicht ? "pt-11" : ""}`}>
        {/* Kopfbereich ist eine SCHWEBENDE Ebene und deshalb Glas: blur(20px)
            mit saturate(180%), heller Innenrand oben, darunter eine haarfeine
            Linie. Der Inhalt darunter bleibt erahnbar — das verankert die
            Leiste räumlich, statt sie wie ein Deckel aufzusetzen.
            Karten bekommen dieses Glas NICHT; sie sind massiv. */}
        <header className="fi-glas sticky top-0 z-30">
          <div className="mx-auto px-4 h-14 flex items-center justify-between gap-4"
               style={{ maxWidth: "var(--fi-breite-max)" }}>
            <div className="flex items-center gap-3 md:gap-6 min-w-0">
              {/* Menue-Ausloeser: nur mobil, oben links im Daumenbereich. */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenueOffen(true); }}
                aria-label="Menü öffnen"
                aria-expanded={menueOffen}
                className="md:hidden relative -ml-1.5 w-11 h-11 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition-colors shrink-0"
              >
                <Menu size={20} strokeWidth={1.9} />
                {menuBadge > 0 && (
                  <span
                    className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9.5px] font-bold text-white flex items-center justify-center tabular-nums"
                    style={{ background: ACCENT }}
                  >
                    {menuBadge}
                  </span>
                )}
              </button>
              <Link href="/agent" className="shrink-0">
                <span className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</span>
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">Team</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {NAV.filter((n) => !n.nurRolle || n.nurRolle === rolle).map((n) => {
                  const active = n.match.includes(location);
                  const badge = zaehler[n.href] || 0;
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                        active ? "text-slate-900 bg-slate-100" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                      }`}
                    >
                      {n.label}
                      {/* Die Zahl steht NEBEN der Beschriftung, nicht darüber.
                          Absolut positioniert lag sie auf dem Wort — bei „Kunden 57"
                          war beides gleichzeitig unlesbar. */}
                      {badge > 0 && (
                        <span className="min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold text-white inline-flex items-center justify-center tabular-nums" style={{ background: ACCENT }}>
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
                <Avatar src={agent.avatar ?? null} name={agent.name} size={32} />
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

        {/* Persönliche Nachrichten der Leitung stehen ÜBER den Produkt-
            Updates: Eine Ansage an genau diesen Menschen ist dringlicher als
            eine Neuerung, die alle betrifft. */}
        <TeamNachrichten />
        <UpdateBanner />
        <ImportantUpdateHint />

        <main className="max-w-6xl mx-auto px-4 py-5">{children}</main>

        {/* Das Telefon liegt über allem — in jeder Team-, Vertriebs- und
            Onboarding-Ansicht. Es entscheidet selbst, ob es einsatzbereit ist
            oder den Einrichtungs-Zustand zeigt. */}
        <Softphone />

        {/* HIER STAND EIN SCHWEBENDER KNOPF „Nächste Akte" — entfernt am
            03.08.2026.
            ────────────────────────────────────────────────────────────────
            Er stammte aus dem Pool-System: Damals zog der Agent sich die
            nächste Akte selbst aus einem gemeinsamen Bestand, und dieser Knopf
            war die zentrale Handlung. Dieses System ist abgeschafft — Kunden
            sind heute fest zugewiesen. Es gibt keine „nächste Akte" mehr, die
            man ziehen könnte.

            Der Knopf zeigte auf /agent/kartei. Diese Route ist abgeschaltet und
            wird in App.tsx auf /agent/heute umgeleitet: Ein Tipp führte also im
            Kreis zurück auf die Seite, auf der man ohnehin landet. Auf dem Handy
            verdeckte er dabei dauerhaft den unteren Bildrand und damit die
            Aktionsreihe der letzten Kundenkarte.

            Ein Knopf, der nichts tut, ist schlimmer als kein Knopf: Er lässt den
            Agenten glauben, er habe etwas falsch gemacht. Ersatz braucht es
            keinen — „Heute" ist die Arbeitsliste und steht im Menü an erster
            Stelle. */}

        <AgentDrawer
          open={menueOffen}
          onClose={() => setMenueOffen(false)}
          location={location}
          zaehler={zaehler}
          rolle={rolle}
        />
      </div>
    </AgentCtx.Provider>
  );
}

// ── Kleine Bausteine ─────────────────────────────────────────────────────────
/**
 * Die Karte des Hauses. Zieht ihr Aussehen aus `.fi-karte` in
 * fiaon-design.css: massives Weiß, 14px Radius, dreistufiger Schatten mit
 * Blauanteil, Glanzkante oben.
 *
 * Bewusst über EINE Klasse statt über Tailwind-Utilities: Alle Agentenseiten
 * benutzen diese Komponente, und wenn die Gestaltung an einer Stelle definiert
 * ist, können /agent/heute und /agent/kunden gar nicht auseinanderlaufen.
 */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`fi-karte ${className}`}>{children}</div>;
}

export function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-4">
      <p className="fi-stat-label mb-3">{label}</p>
      <p className="fi-stat-zahl" style={{ color: "var(--fi-text)" }}>{value}</p>
      {sub && <p className="text-[12px] mt-1.5" style={{ color: "var(--fi-text-still)" }}>{sub}</p>}
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
  "w-full px-3.5 py-2.5 rounded-[10px] border bg-white text-[14px] text-[color:var(--fi-text)] " +
  "placeholder:text-[color:var(--fi-text-still)] border-[color:var(--fi-linie)] " +
  "hover:border-[color:var(--fi-linie-hover)] " +
  "focus:border-[color:var(--fi-primaer)] focus:ring-2 focus:ring-[color:var(--fi-primaer)]/10 " +
  "outline-none transition-colors duration-[120ms]";

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

// Primär- und Sekundäraktion kommen aus denselben Klassen wie auf
// /agent/heute. Der Blauverlauf ist der EINZIGE im Interface und ausschliesslich
// der Primäraktion vorbehalten.
export const btnPrimary =
  "fi-primaerknopf px-4 py-2.5 text-white text-[13px] font-semibold disabled:opacity-40";

export const btnGhost =
  "fi-zweitknopf px-4 py-2.5 text-[13px] font-medium";
