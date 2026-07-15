import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import {
  CreditCard, Banknote, FileText, Database, Users, UserPlus, BookOpen,
  Settings, ScrollText, Scale, ChevronRight, Wallet, Send, Search,
  AlertTriangle, ListChecks, Landmark, HandCoins, Copy, Sparkles,
  Target, TrendingUp, BarChart3, History, Activity,
} from "lucide-react";
import { ACCENT } from "@/components/admin/AdminShell";
import { PageIntro, Tip } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin — DASHBOARD ZUM ARBEITEN (Phase 4, P4-B).
// Reihenfolge nach Wichtigkeit:
//   1. „Was ist zu tun?" — offene Aufgaben mit direkter Aktion
//   2. Warn-Kacheln bei ECHTEN Problemen (Erklärung + Lösung)
//   3. Schnellsuche prominent (Name/E-Mail/Telefon/Referenz → Kunde)
//   4. Tages-Kennzahlen mit Tooltip-Definition + Klick zur Detailansicht
//   5. Bereichs-Karten (jede Admin-Seite erreichbar)
// Datenquellen: /admin/hub/stats + /admin/hub/badges (EIN gecachter Endpoint).
// ═══════════════════════════════════════════════════════════════════

interface HubStats {
  todayNew: number;
  claimed: { count: number; sum: number };
  todayPaid: { count: number; sum: number };
  invoiceCount: number;
  openPayouts: number;
  activeAgents: number;
  bankChanges: number;
}

function eur(v: number): string {
  return `${Number(v).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}

// ── Schnellsuche (prominent im Dashboard — zusätzlich zu ⌘K) ─────────────────
function QuickSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/fiaon/admin/search?q=${encodeURIComponent(q.trim())}`, { credentials: "include" });
        const json = await res.json().catch(() => null);
        setResults(res.ok && json?.ok ? json.results : []);
      } finally { setBusy(false); }
    }, 220);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div className="relative mb-6">
      <div className="flex items-center gap-2.5 px-4 bg-white border border-slate-200 rounded-2xl focus-within:border-slate-400 transition-colors">
        <Search size={16} className="text-slate-400 shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Kunde finden: Name, E-Mail, Telefon oder Referenz …"
          className="w-full py-3.5 text-[14px] outline-none placeholder:text-slate-400 bg-transparent"
        />
        <kbd className="hidden sm:block text-[10px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 shrink-0">⌘K</kbd>
      </div>
      {q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden max-h-80 overflow-y-auto">
          {busy && <p className="px-4 py-3 text-[12px] text-slate-400">Suche …</p>}
          {!busy && results.length === 0 && (
            <p className="px-4 py-3 text-[12px] text-slate-400">Keine Treffer — prüfe die Schreibweise oder suche mit der Referenz (FIAON-…).</p>
          )}
          {results.map((r, i) => (
            <a key={i} href={r.url} className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-slate-50 border-b border-slate-50">
              <span className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                {r.type === "agent" ? <Users size={14} /> : <CreditCard size={14} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-slate-800 truncate">{r.label}</span>
                <span className="block text-[11px] text-slate-400 truncate">{r.sub}</span>
              </span>
              <ChevronRight size={14} className="text-slate-300 shrink-0" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── „Was ist zu tun?" — Aufgabenzeile mit direkter Aktion ────────────────────
function TaskRow({ href, icon: Icon, count, label, action }: {
  href: string; icon: typeof CreditCard; count: number; label: string; action: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
      <span className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 text-[13px] text-slate-700">
        <b className="tabular-nums">{count}</b> {label}
      </span>
      <span className="shrink-0 text-[12px] font-semibold inline-flex items-center gap-1" style={{ color: ACCENT }}>
        {action} <ChevronRight size={13} />
      </span>
    </Link>
  );
}

// ── Warn-Kachel: echtes Problem, mit Erklärung + Lösung ─────────────────────
function WarnTile({ title, explain, href, action }: { title: string; explain: string; href: string; action: string }) {
  return (
    <Link href={href} className="block px-4 py-3.5 rounded-2xl border border-amber-300 bg-amber-50 hover:bg-amber-100/70 transition-colors">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold text-amber-800">{title}</p>
          <p className="text-[12px] text-amber-700/80 leading-snug mt-0.5">{explain}</p>
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-amber-800 inline-flex items-center gap-1 mt-0.5">{action} <ChevronRight size={13} /></span>
      </div>
    </Link>
  );
}

interface CardDef { href: string; label: string; desc: string; icon: typeof CreditCard; badge?: string | null }

function AreaCard({ c }: { c: CardDef }) {
  const Icon = c.icon;
  return (
    <Link href={c.href} className="group bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3.5 hover:border-slate-400 transition-colors">
      <span className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 group-hover:border-slate-300">
        <Icon size={17} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-bold text-slate-900">{c.label}</span>
          {c.badge && <span className="px-2 py-0.5 rounded-full border border-slate-300 text-[10px] font-bold text-slate-600">{c.badge}</span>}
        </span>
        <span className="block text-[12px] text-slate-400 leading-snug mt-0.5">{c.desc}</span>
      </span>
      <ChevronRight size={15} className="text-slate-300 shrink-0 mt-2 group-hover:text-slate-500 transition-colors" />
    </Link>
  );
}

export default function AdminHubPage() {
  const [stats, setStats] = useState<HubStats | null>(null);
  const [badges, setBadges] = useState<Record<string, number>>({});
  const [warn, setWarn] = useState<any>(null);

  useEffect(() => {
    fetch("/api/fiaon/admin/hub/stats", { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j?.ok) setStats(j); }).catch(() => {});
    fetch("/api/fiaon/admin/hub/badges", { credentials: "include" })
      .then((r) => r.json()).then((j) => { if (j?.ok) { setBadges(j.badges || {}); setWarn(j.warn || null); } }).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

  // Aufgaben nach Wichtigkeit (Geld zuerst) — nur anzeigen, wenn > 0.
  const tasks: { href: string; icon: typeof CreditCard; count: number; label: string; action: string }[] = [
    { href: "/admin/zahlungen", icon: CreditCard, count: badges.zahlungen || 0, label: "Zahlung(en) angekündigt — warten auf deine Freischaltung", action: "öffnen" },
    { href: "/admin/kontoabgleich", icon: Landmark, count: badges.kontoabgleich || 0, label: "Bank-Eingänge nicht zugeordnet — Geld liegt unverbucht auf dem Konto", action: "abgleichen" },
    { href: "/admin/kontoabgleich", icon: Landmark, count: warn?.bankMatchedUnapplied || 0, label: "zugeordnete Bank-Eingänge noch nicht verbucht", action: "verbuchen" },
    { href: "/admin/zahlungen#auszahlungen", icon: Banknote, count: badges.auszahlungen || 0, label: "Auszahlung(en) vom Team angefragt", action: "prüfen" },
    { href: "/admin/nachbuchung", icon: HandCoins, count: badges.nachbuchung || 0, label: "bezahlte Bestellung(en) ohne Provision", action: "nachbuchen" },
    { href: "/admin/zahlungen#dubletten", icon: Copy, count: badges.dubletten || 0, label: "Dubletten-Gruppe(n) mit offenen Bestellungen", action: "zusammenführen" },
    { href: "/admin/agent-portal", icon: Sparkles, count: badges.feedback || 0, label: "Feedback(s) vom Team offen", action: "ansehen" },
  ].filter((t) => t.count > 0);

  // Warn-Kacheln: nur ECHTE Probleme.
  const warns: { title: string; explain: string; href: string; action: string }[] = [];
  if ((warn?.criticalDiagnostics || 0) > 0) {
    warns.push({
      title: `${warn.criticalDiagnostics} kritische(s) System-Ereignis(se) (letzte 24 h)`,
      explain: "Die System-Diagnose hat kritische Probleme erfasst (z. B. fehlgeschlagene E-Mails, Lead-Ausfall). Klartext, Ursache und Reihenfolge der Behebung findest du dort.",
      href: "/admin/diagnose", action: "Diagnose öffnen",
    });
  }
  if (warn?.leadIntakeHours != null && warn.leadIntakeHours >= 24) {
    warns.push({
      title: `Seit ${warn.leadIntakeHours} Stunden kein Lead-Eingang`,
      explain: "Normalerweise kommen laufend Leads über Make herein. Prüfe, ob das Make-Szenario läuft und der Webhook erreichbar ist (E-Mail-Events → Diagnose).",
      href: "/admin/events", action: "Diagnose",
    });
  }
  if (warn?.followupPaused) {
    warns.push({
      title: "Nachfass-Automatik ist pausiert",
      explain: "Interessenten bekommen aktuell KEINE automatischen Erinnerungen. Wenn das nicht beabsichtigt ist, schalte die Automatik in den Lead-Einstellungen wieder ein.",
      href: "/admin/leads", action: "Einstellungen",
    });
  }
  if ((warn?.blockedAkten || 0) > 0) {
    warns.push({
      title: `${warn.blockedAkten} offene Lead-Akte(n)${warn.blockedAktenAgent ? ` (u. a. bei ${warn.blockedAktenAgent})` : ""}`,
      explain: "Ein Agent hat eine Akte übernommen, aber noch kein Ergebnis dokumentiert. Nach Ablauf der Auto-Freigabe löst sich das selbst — du kannst die Akte auch sofort freigeben (Lead öffnen → „Akte freigeben\").",
      href: "/admin/leads", action: "Leads öffnen",
    });
  }

  const groups: { title: string; cards: CardDef[] }[] = [
    {
      title: "Umsatz & Zahlungen",
      cards: [
        { href: "/admin/zahlungen", label: "Zahlungszentrale", desc: "Offene Zahlungen prüfen, als bezahlt freischalten, Erinnerungen, Timeline je Kunde.", icon: CreditCard },
        { href: "/admin/kontoabgleich", label: "Kontoabgleich", desc: "Kontoauszug hochladen, Eingänge exakt zuordnen und wie den „bezahlt\"-Button verbuchen.", icon: Landmark },
        { href: "/admin/verbuchungen", label: "Verbuchungen", desc: "Bestätigte Zahlungen des Tages: Umsatz, Team-Provisionen und Netto auf einen Blick.", icon: Wallet, badge: stats && stats.todayPaid.count > 0 ? `${stats.todayPaid.count} heute` : null },
        { href: "/admin/finanzen", label: "Finanzen & Sales", desc: "Funnel, Umsatz, Marge, CAC und Kampagnen-Rentabilität — mit Klartext-Definitionen.", icon: TrendingUp },
        { href: "/admin/rechnungen", label: "Rechnungen", desc: "Alle erzeugten Rechnungen im Nummernkreis durchsuchen und als PDF laden.", icon: FileText, badge: stats && stats.invoiceCount > 0 ? String(stats.invoiceCount) : null },
      ],
    },
    {
      title: "Kunden & Anträge",
      cards: [
        { href: "/admin/database", label: "Kunden & Anträge", desc: "Antrags-Cockpit: alle Anträge, KYC/Prüfbereit, Aufgaben, Investoren, Buchhaltung.", icon: Database },
        { href: "/admin/leads", label: "Leads", desc: "Interessenten aus Lead-Ads: Nachfass-Automatik, Verteilung, Warteschlange der Agenten.", icon: Target },
      ],
    },
    {
      title: "Team",
      cards: [
        { href: "/admin/team", label: "Team-Übersicht", desc: "Leistung, Provisionen und Kunden-Zuweisungen aller Mitarbeiter.", icon: Users, badge: stats && stats.bankChanges > 0 ? `${stats.bankChanges} Bankdaten prüfen` : stats ? `${stats.activeAgents} aktiv` : null },
        { href: "/admin/leistung", label: "Leistung", desc: "Arbeitsberichte pro Agent: Kontakte, Abschlüsse, Reaktionszeit — mit KI-Analyse.", icon: BarChart3 },
        { href: "/admin/team?einladen=1", label: "Agent anlegen", desc: "Neuen Mitarbeiter per E-Mail-Einladung anlegen (Link 48 h gültig).", icon: UserPlus },
        { href: "/admin/team#skripte", label: "Skripte & Leitfäden", desc: "Gesprächsvorlagen für das Telefon-Team pflegen und sortieren.", icon: BookOpen },
        { href: "/admin/agent-portal", label: "Agent-Updates & Feedback", desc: "Portal-Updates posten, Tagesziele pflegen, Feedback prüfen und belohnen.", icon: Sparkles },
      ],
    },
    {
      title: "System & Recht",
      cards: [
        { href: "/admin/diagnose", label: "System-Diagnose", desc: "Was klemmt gerade? Ereignis-Konsole mit Schweregrad, Rohdaten-Tail und KI-Auswertung.", icon: Activity, badge: (warn?.criticalDiagnostics || 0) > 0 ? `${warn.criticalDiagnostics} kritisch` : null },
        { href: "/admin/einstellungen", label: "Einstellungen", desc: "Provisionssatz, Mindest-Auszahlung, Base-URL- und Make-Webhook-Diagnose.", icon: Settings },
        { href: "/admin/events", label: "E-Mail-Events", desc: "Make-Events mit Beispieldaten testen — Diagnose, welcher Event-Typ noch nie gefeuert hat.", icon: Send },
        { href: "/admin/audit", label: "Audit-Log", desc: "Jede Mitarbeiter-Aktion nachvollziehen — durchsuchbar.", icon: ScrollText },
        { href: "/admin/changelog", label: "Was ist neu?", desc: "Jede System-Änderung in Klartext: Datum, was, warum, wo.", icon: History },
        { href: "/admin/recht", label: "Rechtstexte-Status", desc: "Review-Stand der Rechtstexte (LEGAL_REVIEW_PACKAGE, read-only).", icon: Scale },
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <PageIntro
        id="dashboard"
        title={`${greeting}.`}
        subtitle="Hier siehst du auf einen Blick, was zu tun ist — und erreichst jeden Bereich der Verwaltung."
        steps={[
          "„Was ist zu tun?\" zeigt alle offenen Aufgaben mit direkter Aktion — Geld-Themen stehen oben. Ist die Liste leer, ist nichts liegen geblieben.",
          "Gelbe Warn-Kacheln erscheinen NUR bei echten Problemen (z. B. kein Lead-Eingang seit Stunden) — mit Erklärung und Lösungsweg.",
          "Über die Suche findest du jeden Kunden per Name, E-Mail, Telefon oder Referenz — jederzeit auch mit ⌘K.",
          "Die Kennzahlen-Kacheln sind klickbar und führen direkt in die passende Detailansicht; das ⓘ erklärt jede Zahl.",
        ]}
      />

      <QuickSearch />

      {/* Warn-Kacheln — echte Probleme zuerst */}
      {warns.length > 0 && (
        <div className="space-y-2.5 mb-5">
          {warns.map((w) => <WarnTile key={w.title} {...w} />)}
        </div>
      )}

      {/* Was ist zu tun? */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <ListChecks size={15} className="text-slate-400" />
          <p className="text-[13px] font-bold text-slate-900">Was ist zu tun?</p>
          {tasks.length > 0 && <span className="ml-auto px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-bold text-slate-500 tabular-nums">{tasks.length}</span>}
        </div>
        {tasks.length === 0 ? (
          <p className="px-4 py-5 text-[13px] text-slate-400">Nichts offen — alle Zahlungen, Auszahlungen, Provisionen, Dubletten und Feedbacks sind abgearbeitet.</p>
        ) : (
          tasks.map((t, i) => <TaskRow key={i} {...t} />)
        )}
      </div>

      {/* Tages-Kennzahlen mit Tooltip + Klick zur Detailansicht */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Link href="/admin/database" className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">Neue Anträge heute<Tip text="Heute eingegangene Anträge/Bestellungen (ohne zusammengeführte Dubletten). Klick öffnet Kunden & Anträge." /></p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? stats.todayNew : "—"}</p>
        </Link>
        <Link href="/admin/zahlungen" className="text-left bg-white border border-slate-300 rounded-2xl p-4 hover:border-slate-400 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center">Zahlung angekündigt<Tip text="Kunden, die 'Ich habe bezahlt' gemeldet haben — Summe wartet auf deine Prüfung/Freischaltung. Klick öffnet die Zahlungszentrale." /></p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? eur(stats.claimed.sum) : "—"}</p>
          <p className="text-[11px] text-slate-400">{stats ? `${stats.claimed.count} warten auf Freischaltung` : ""}</p>
        </Link>
        <Link href="/admin/verbuchungen" className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">Heute bestätigt<Tip text="Heute als bezahlt bestätigte Zahlungen (eine Wahrheit: bezahlt + Zahlungsreferenz). Klick öffnet die Verbuchungen." /></p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? eur(stats.todayPaid.sum) : "—"}</p>
          <p className="text-[11px] text-slate-400">{stats ? `${stats.todayPaid.count} Zahlung(en) · Verbuchungen` : ""}</p>
        </Link>
        <Link href="/admin/zahlungen#auszahlungen" className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">Offene Auszahlungen<Tip text="Provisions-Auszahlungen, die das Team angefragt hat und die auf deine Freigabe warten. Klick öffnet die Auszahlungs-Sektion." /></p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? stats.openPayouts : "—"}</p>
          <p className="text-[11px] text-slate-400">Anforderungen des Teams</p>
        </Link>
      </div>

      {/* Bereichs-Karten */}
      {groups.map((g) => (
        <section key={g.title} className="mb-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">{g.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.cards.map((c) => <AreaCard key={c.href + c.label} c={c} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
