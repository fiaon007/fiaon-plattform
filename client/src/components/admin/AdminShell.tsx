import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, CreditCard, Banknote, FileText, Users, UserPlus,
  BookOpen, Settings, ScrollText, Scale, Database, Search, Menu, X,
  ArrowLeft, ChevronRight, ShieldAlert, Wallet, Send, Sparkles,
  Target, TrendingUp, Landmark, HandCoins, Copy, BarChart3, History, Activity,
  LogOut, PiggyBank, GraduationCap, Map, Layers, Receipt, UserCheck,
} from "lucide-react";
import AdminCodeGate from "./AdminCodeGate";

// ═══════════════════════════════════════════════════════════════════
// AdminShell (Paket N1) — persistentes Gerüst um ALLE /admin-Seiten:
// Sidebar (Desktop) / Burger (Mobile), Breadcrumb + Zurück, Cmd+K-Suche.
// Serverseitige Guards bleiben die Wahrheit — die Shell blendet nur aus
// und zeigt Agents auf Admin-Routen eine 403-Erklärseite (Probe unten).
// Designsprache wie Agent-Portal: monochrom slate, Akzent #2563eb.
// ═══════════════════════════════════════════════════════════════════

export const ACCENT = "#2563eb";

interface NavItem {
  path: string;
  label: string;
  desc: string;
  icon: typeof LayoutDashboard;
  /** exakter Router-Pfad für Aktiv-Markierung (Query/Hash ignoriert) */
  match?: string;
  /** P4-A: Schlüssel im /admin/hub/badges-Objekt — Zähler-Pill am Menüpunkt */
  badgeKey?: string;
}

interface NavGroup {
  title: string | null;
  items: NavItem[];
}

// P4-E Routen-Audit (15.07.2026) — jede /admin-Route hat einen Menüpunkt:
//   /admin ✓ · zahlungen ✓ · finanzen ✓ · verbuchungen ✓ · kontoabgleich ✓ ·
//   rechnungen ✓ · database ✓ · leads ✓ · team ✓ · nachbuchung ✓ · leistung ✓ (neu) ·
//   agent-portal ✓ (Updates+Feedback zusammengelegt — war doppelt) ·
//   einstellungen ✓ · events ✓ · audit ✓ · recht ✓ · changelog ✓ · diagnose ✓ (P5, neu) ·
//   Dubletten ✓ (neu verlinkt — lebt als Sektion in der Zahlungszentrale).
//   Karteileichen: keine (admin-leads-import ist Dialog-Komponente, keine Route).
export const ADMIN_NAV: NavGroup[] = [
  {
    title: null,
    items: [
      { path: "/admin", label: "Dashboard", desc: "Was ist zu tun? Aufgaben, Warnungen, Suche, Tageszahlen", icon: LayoutDashboard },
    ],
  },
  {
    title: "Umsatz & Zahlungen",
    items: [
      { path: "/admin/zahlungen", label: "Zahlungszentrale", desc: "Offene Zahlungen prüfen, freischalten, Timeline", icon: CreditCard, badgeKey: "zahlungen" },
      { path: "/admin/kontoabgleich", label: "Kontoabgleich", desc: "Bank-Eingänge exakt mit Kunden abgleichen und verbuchen", icon: Landmark, badgeKey: "kontoabgleich" },
      // Routen-Audit 04.08.2026: diese Seite war erreichbar, stand aber in KEINEM
      // Menü — man kam nur über einen gemerkten Link hin.
      { path: "/admin/verbuchung", label: "Zahlungen verbuchen", desc: "Vier Fälle, vier Reiter: verbuchen, Zuordnung korrigieren, fälschlich stillgelegt, ohne Zuordnung — mit Vorschau vor dem Klick", icon: Receipt },
      { path: "/admin/zahlungen#auszahlungen", label: "Auszahlungen", desc: "Provisions-Anforderungen der Mitarbeiter freigeben", icon: Banknote, match: "/admin/zahlungen", badgeKey: "auszahlungen" },
      { path: "/admin/dubletten", label: "Dubletten", desc: "Mehrfach angelegte Personen erkennen und zusammenführen (füllt fehlende Felder, umkehrbar)", icon: Copy, badgeKey: "dubletten" },
      { path: "/admin/verbuchungen", label: "Verbuchungen", desc: "Bestätigte Zahlungen: Umsatz, Provisionen, Netto", icon: Wallet },
      { path: "/admin/buchhaltung", label: "Buchhaltung", desc: "Buchungsjournal und Ausbuchung (Ledger)", icon: Landmark },
      { path: "/admin/finanzen", label: "Finanzen & Sales", desc: "Funnel, Umsatz, Marge, CAC, Kampagnen-Attribution", icon: TrendingUp },
      { path: "/admin/rechnungen", label: "Rechnungen", desc: "Alle erzeugten Rechnungen durchsuchen und laden", icon: FileText },
    ],
  },
  {
    title: "Kunden & Anträge",
    items: [
      { path: "/admin/kunden", label: "Kunden — die eine Liste", desc: "Jede Person genau einmal (Leads + Kunden vereint) — jeder Treffer öffnet die Akte", icon: Users },
      { path: "/admin/database", label: "Anträge & KYC", desc: "Arbeits-Fokus: Antrags-Details, KYC-Dokumente, SCHUFA-Review", icon: Database },
      // Routen-Audit 04.08.2026: ebenfalls ohne Menüpunkt gewesen.
      { path: "/admin/personen", label: "Kunden & Zuordnung", desc: "Wie viele Menschen sind wirklich Kunden (statt Antragszeilen) — und bei wem hängen mehrere Agenten an einer Person", icon: UserCheck },
      { path: "/admin/fahrplan", label: "Fahrplan / Kundenprodukt", desc: "Upload-Review, KI-Analyse freigeben, Fahrplan steuern, Ziel-Freischaltung, Audit", icon: Map },
      { path: "/admin/kartei", label: "Offene Kartei", desc: "Ein gemeinsamer Bestand für alle Agenten — frei/vergeben, Rückläufer, Rangfolge, Notausgang", icon: Layers },
      { path: "/admin/leads", label: "Leads", desc: "Interessenten aus Lead-Ads — Nachfass, Verteilung, Warteschlange", icon: Target },
      { path: "/admin/kuendigungen", label: "Kündigungen", desc: "Eingehende Kündigungsanträge prüfen, bestätigen oder ablehnen", icon: LogOut, badgeKey: "kuendigungen" },
      { path: "/admin/investoren", label: "Investoren", desc: "Investoren-Verwaltung: Anfragen, Investments, Dokumente", icon: PiggyBank },
    ],
  },
  {
    title: "Team",
    items: [
      { path: "/admin/team", label: "Team-Übersicht", desc: "Agents, Statistik, Provisionen, Zuweisungen", icon: Users },
      { path: "/admin/vertraege", label: "Onboarding & Verträge", desc: "Zustimmungs-/Vertragsstatus, Vorlagen (Entwurf/Aktiv), Vertragsvariablen, Nachweise", icon: ScrollText },
      { path: "/admin/leistung", label: "Leistung", desc: "Arbeitsberichte: Ergebnisse pro Agent — offen, nicht heimlich", icon: BarChart3 },
      { path: "/admin/nachbuchung", label: "Provisionen nachbuchen", desc: "Bezahlte Bestellungen ohne Provision erkennen und buchen", icon: HandCoins, badgeKey: "nachbuchung" },
      { path: "/admin/team?einladen=1", label: "Agent anlegen", desc: "Neuen Mitarbeiter per E-Mail einladen", icon: UserPlus, match: "/admin/team" },
      { path: "/admin/team#skripte", label: "Skripte & Leitfäden", desc: "Gesprächsvorlagen verwalten", icon: BookOpen, match: "/admin/team" },
      // P4-E: „Agent-Updates" + „Agent-Feedback" zeigten dieselbe Seite — zusammengelegt.
      { path: "/admin/agent-portal", label: "Agent-Updates & Feedback", desc: "Portal-Updates posten, Feedback prüfen und belohnen", icon: Sparkles, badgeKey: "feedback" },
    ],
  },
  {
    title: "System & Recht",
    items: [
      { path: "/admin/funktionen", label: "Funktionen & Schulung", desc: "Alle Funktionen mit Klartext + Direktlink, Selbsttest (Button → Event → Status), Schulungsmodus", icon: GraduationCap },
      { path: "/admin/diagnose", label: "System-Diagnose", desc: "Was klemmt gerade? Ereignis-Konsole, Rohdaten, KI-Auswertung", icon: Activity, badgeKey: "diagnose" },
      { path: "/admin/einstellungen", label: "Einstellungen", desc: "Provisionssatz, Auszahlung, Reminder-Engine, Diagnose", icon: Settings },
      { path: "/admin/events", label: "E-Mail-Events", desc: "Make-Events testen, Diagnose, Verlauf", icon: Send },
      { path: "/admin/audit", label: "Audit-Log", desc: "Alle Mitarbeiter-Aktionen durchsuchbar", icon: ScrollText },
      { path: "/admin/changelog", label: "Was ist neu?", desc: "Alle Änderungen am System in Klartext", icon: History },
      { path: "/admin/recht", label: "Rechtstexte-Status", desc: "LEGAL-Review-Stand (read-only)", icon: Scale },
    ],
  },
];

/** Seitentitel für Breadcrumb — erster Nav-Treffer auf den reinen Pfad. */
export function pageMeta(location: string): { label: string; desc: string } {
  const clean = location.split("?")[0].split("#")[0];
  if (clean.startsWith("/admin/kunde/")) {
    return { label: "Kundenakte", desc: "Eine Seite. Alles: Stammdaten, Zahlungen, Mails, Agent, Verlauf, Dubletten" };
  }
  for (const g of ADMIN_NAV) {
    for (const it of g.items) {
      if ((it.match || it.path.split("?")[0].split("#")[0]) === clean) return { label: it.label, desc: it.desc };
    }
  }
  return { label: "Admin", desc: "" };
}

// ── Cmd+K Schnellsuche (Paket O3) ────────────────────────────────────────────
function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (open) {
      setQ("");
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/fiaon/admin/search?q=${encodeURIComponent(q.trim())}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        setResults(res.ok && json?.ok ? json.results : []);
      } finally {
        setBusy(false);
      }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  const go = (url: string) => {
    onClose();
    // Harte Navigation: garantiert Remount + ?ref-Deep-Link-Verarbeitung,
    // auch wenn man bereits auf der Zielseite steht.
    window.location.href = url;
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div
        className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 border-b border-slate-100">
          <Search size={15} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && results[0]) go(results[0].url);
            }}
            placeholder="Kunde, Referenz, E-Mail oder Mitarbeiter suchen …"
            className="w-full py-3.5 text-[14px] outline-none placeholder:text-slate-400"
          />
          <kbd className="text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {busy && <p className="px-4 py-4 text-[12px] text-slate-400">Suche …</p>}
          {!busy && q.trim().length >= 2 && results.length === 0 && (
            <p className="px-4 py-4 text-[12px] text-slate-400">Keine Treffer.</p>
          )}
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={(e) => { e.stopPropagation(); go(r.url); }}
              className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 border-b border-slate-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                {r.type === "agent" ? <Users size={14} /> : <CreditCard size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800 truncate">{r.label}</span>
                <span className="block text-[11px] text-slate-400 truncate">{r.sub}</span>
              </span>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </button>
          ))}
          {q.trim().length < 2 && (
            <p className="px-4 py-4 text-[11px] text-slate-400">
              Mindestens 2 Zeichen — durchsucht Kunden (Name, E-Mail, Referenz, Telefon) und Mitarbeiter.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 403-Erklärseite für Agents auf Admin-Routen (Paket N4) ───────────────────
function AccessDenied() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <span className="inline-flex w-12 h-12 rounded-full border border-slate-200 items-center justify-center text-slate-400 mb-4">
          <ShieldAlert size={20} strokeWidth={1.7} />
        </span>
        <h1 className="text-[16px] font-bold text-slate-900 mb-1.5">Kein Zugriff auf den Admin-Bereich</h1>
        <p className="text-[13px] text-slate-500 leading-relaxed mb-6">
          Du bist als Mitarbeiter angemeldet — dieser Bereich ist der Verwaltung vorbehalten.
          Alles für deine Arbeit findest du in deinem Portal.
        </p>
        <Link
          href="/agent"
          className="inline-block px-5 py-3 rounded-xl text-white text-[13px] font-semibold"
          style={{ background: ACCENT }}
        >
          Zurück zum Mitarbeiter-Portal
        </Link>
      </div>
    </div>
  );
}

// ── Zugangsschleuse (Zahlencode) ─────────────────────────────────────────────
// Jede /admin-Seite läuft in dieser Shell — deshalb steht die Tür hier und
// nicht in 30 einzelnen Seiten. Ist das Cookie gesetzt, merkt man von der
// Schleuse nichts mehr; sonst kommt die Zifferntastatur. Serverseitig sind die
// Admin-Endpoints unabhängig davon gesperrt (fiaon-admin-zugang.ts).
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [zugang, setZugang] = useState<"pruefe" | "gesperrt" | "offen" | "agent">("pruefe");

  useEffect(() => {
    fetch("/api/fiaon/zugang/status", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setZugang(j?.agent ? "agent" : j?.entsperrt ? "offen" : "gesperrt"))
      // Antwortet der Server nicht, bleibt die Tür zu — im Zweifel geschlossen.
      .catch(() => setZugang("gesperrt"));
  }, []);

  // Dunkle Fläche statt Weißblitz: die Schleuse ist dunkel, ein weißes
  // Zwischenbild würde bei jedem Aufruf aufblitzen.
  if (zugang === "pruefe") return <div className="min-h-screen" style={{ background: "#070b16" }} />;
  if (zugang === "agent") return <AccessDenied />;
  if (zugang === "gesperrt") return <AdminCodeGate onOffen={() => setZugang("offen")} />;
  return <AdminShellRahmen>{children}</AdminShellRahmen>;
}

/** Abschliessen (fremdes Gerät, Feierabend) — Cookie weg, Schleuse zurück. */
async function sperren() {
  await fetch("/api/fiaon/zugang/schliessen", { method: "POST", credentials: "include" }).catch(() => {});
  window.location.href = "/admin";
}

// ── Shell ────────────────────────────────────────────────────────────────────
function AdminShellRahmen({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  // P4-A: Zähler-Badges — EIN gecachter Endpoint, 60-s-Polling, kein Realtime-Stack.
  const [badges, setBadges] = useState<Record<string, number>>({});

  useEffect(() => {
    let alive = true;
    const loadBadges = () => {
      fetch("/api/fiaon/admin/hub/badges", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { if (alive && j?.ok && j.badges) setBadges(j.badges); })
        .catch(() => {});
    };
    loadBadges();
    const t = setInterval(loadBadges, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const meta = pageMeta(location);
  const isHub = location.split("?")[0].split("#")[0] === "/admin";

  // Rollen-Probe: Agent-Token auf /admin ⇒ Server antwortet 403 (Wahrheit bleibt serverseitig)
  useEffect(() => {
    fetch("/api/fiaon/admin/hub/stats", { credentials: "include" }).then((r) => {
      if (r.status === 403) setForbidden(true);
    }).catch(() => {});
  }, []);

  // Cmd/Ctrl+K global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => setMobileOpen(false), [location]);

  const goBack = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    // Direkteinstieg per URL: leere/fremde History ⇒ Fallback auf Elternseite /admin
    if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
      window.history.back();
    } else {
      navigate("/admin");
    }
  }, [navigate]);

  if (forbidden) return <AccessDenied />;

  const isActive = (it: NavItem) => {
    const clean = location.split("?")[0].split("#")[0];
    return (it.match || it.path.split("?")[0].split("#")[0]) === clean;
  };

  const Nav = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex-1 overflow-y-auto py-3">
      {ADMIN_NAV.map((group, gi) => (
        <div key={gi} className="px-3 mb-1">
          {group.title && (
            <p className="px-2.5 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[.14em] text-slate-400">{group.title}</p>
          )}
          {group.items.map((it) => {
            const Icon = it.icon;
            const active = isActive(it) && (it.path.includes("#") || it.path.includes("?") ? location === it.path : true);
            const primaryActive = isActive(it) && !it.path.includes("#") && !it.path.includes("?");
            return (
              <Link
                key={it.path}
                href={it.path}
                onClick={() => onNavigate?.()}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors mb-0.5 ${
                  primaryActive || active
                    ? "bg-slate-900 text-white"
                    : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                <Icon size={15} strokeWidth={1.8} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate">{it.label}</span>
                {/* P4-A: dezente Zähler-Pill (monochrom, verschwindet bei 0) */}
                {it.badgeKey && (badges[it.badgeKey] || 0) > 0 && (
                  <span className={`shrink-0 min-w-[20px] text-center px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                    primaryActive || active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                  }`}>
                    {badges[it.badgeKey] > 99 ? "99+" : badges[it.badgeKey]}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      ))}
      <div className="px-5 pt-4 pb-2 border-t border-slate-100 mt-2">
        <a href="/" className="text-[11px] text-slate-400 hover:text-slate-600">Zur Website</a>
        <span className="text-slate-200 mx-2">·</span>
        <a href="/agent" className="text-[11px] text-slate-400 hover:text-slate-600">Agent-Portal</a>
        <span className="text-slate-200 mx-2">·</span>
        <button type="button" onClick={sperren} className="text-[11px] text-slate-400 hover:text-slate-600">Sperren</button>
      </div>
    </nav>
  );

  return (
    // `admin-flaeche` ist der Schalter für die Tiefen-Schicht (admin-3d.css):
    // Karten, Tabellen, Felder und Abstände aller Unterseiten hängen daran.
    <div className="admin-flaeche min-h-screen">
      {/* Desktop-Sidebar — liegt VOR dem Inhalt, deshalb ein Streuschatten nach
          rechts statt einer harten Linie. */}
      <aside
        className="hidden lg:flex fixed inset-y-0 left-0 w-60 flex-col z-40 border-r"
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #fbfcfe 100%)",
          borderColor: "var(--a3-linie, #e4e9f2)",
          boxShadow: "6px 0 24px -18px rgba(29,78,216,.35)",
        }}
      >
        <div className="px-5 py-4" style={{ boxShadow: "inset 0 -1px 0 var(--a3-linie, #e4e9f2)" }}>
          <Link href="/admin" className="text-lg font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</Link>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400 mt-0.5">Verwaltung</p>
        </div>
        <Nav />
      </aside>

      {/* Mobile-Topbar */}
      <header className="lg:hidden sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setMobileOpen(true); }}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500"
            aria-label="Menü öffnen"
          >
            <Menu size={17} />
          </button>
          <Link href="/admin" className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</Link>
          <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wide">Admin</span>
        </div>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setSearchOpen(true); }}
          className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500"
          aria-label="Suche"
        >
          <Search size={16} />
        </button>
      </header>

      {/* Mobile-Drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <div className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</p>
                <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-slate-400">Verwaltung</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMobileOpen(false); }}
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400"
                aria-label="Schließen"
              >
                <X size={16} />
              </button>
            </div>
            <Nav onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      {/* Inhalt */}
      <div className="lg:pl-60">
        {/* Breadcrumb-Leiste (N1/N3): Orientierung + Zurück + Suche.
            Echtes Glas: die Leiste schwebt über dem Inhalt, der darunter
            durchscheint — dadurch sieht man beim Scrollen, dass sie oben liegt
            und nicht Teil der Seite ist. */}
        <div
          className="sticky top-0 z-30 backdrop-blur-xl px-4 sm:px-6 py-2.5 flex items-center gap-3"
          style={{
            background: "rgba(246,248,252,.82)",
            boxShadow: "inset 0 -1px 0 rgba(15,23,42,.07), 0 8px 20px -18px rgba(29,78,216,.5)",
          }}
        >
          {!isHub && (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
            >
              <ArrowLeft size={13} /> Zurück
            </button>
          )}
          <nav className="flex items-center gap-1.5 text-[12px] min-w-0" aria-label="Breadcrumb">
            <Link href="/admin" className={`font-semibold ${isHub ? "text-slate-900" : "text-slate-400 hover:text-slate-700"}`}>
              Dashboard
            </Link>
            {!isHub && (
              <>
                <ChevronRight size={12} className="text-slate-300 shrink-0" />
                <span className="font-semibold text-slate-900 truncate">{meta.label}</span>
                {/* Ein Satz, was diese Seite tut — auf breiten Schirmen ist Platz
                    dafür, und er erspart das Raten beim Direkteinstieg. */}
                {meta.desc && (
                  <span className="hidden xl:inline text-slate-400 truncate max-w-[46ch]">— {meta.desc}</span>
                )}
              </>
            )}
          </nav>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSearchOpen(true); }}
            className="hidden lg:inline-flex ml-auto items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-400 hover:text-slate-600 hover:border-slate-300 transition-colors"
          >
            <Search size={13} /> Suche
            <kbd className="text-[10px] font-semibold border border-slate-200 rounded px-1 py-0.5">⌘K</kbd>
          </button>
        </div>
        {children}
      </div>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
