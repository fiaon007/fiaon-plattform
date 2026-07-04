import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  CreditCard, Banknote, FileText, Database, Users, UserPlus, BookOpen,
  Settings, ScrollText, Scale, ChevronRight,
} from "lucide-react";
import { ACCENT } from "@/components/admin/AdminShell";

// ═══════════════════════════════════════════════════════════════════
// /admin — Kommandozentrale (Paket O)
// Von hier ist JEDE Admin-Seite erreichbar: 4 Tages-Kennzahlen +
// logisch gruppierte Bereichs-Karten mit Live-Badges.
// Read-only — alle Aktionen passieren auf den Zielseiten.
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

interface CardDef {
  href: string;
  label: string;
  desc: string;
  icon: typeof CreditCard;
  badge?: string | null;
}

function AreaCard({ c }: { c: CardDef }) {
  const Icon = c.icon;
  return (
    <Link
      href={c.href}
      className="group bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-3.5 hover:border-slate-400 transition-colors"
    >
      <span className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 shrink-0 group-hover:border-slate-300">
        <Icon size={17} strokeWidth={1.7} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[13.5px] font-bold text-slate-900">{c.label}</span>
          {c.badge && (
            <span className="px-2 py-0.5 rounded-full border border-slate-400 text-[10px] font-bold text-slate-700">{c.badge}</span>
          )}
        </span>
        <span className="block text-[12px] text-slate-400 leading-snug mt-0.5">{c.desc}</span>
      </span>
      <ChevronRight size={15} className="text-slate-300 shrink-0 mt-2 group-hover:text-slate-500 transition-colors" />
    </Link>
  );
}

export default function AdminHubPage() {
  const [stats, setStats] = useState<HubStats | null>(null);
  const [dupGroups, setDupGroups] = useState<number>(0);

  useEffect(() => {
    fetch("/api/fiaon/admin/hub/stats", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setStats(j); })
      .catch(() => {});
    fetch("/api/fiaon/admin/duplicates/preview", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setDupGroups(Number(j.mergeable || 0)); })
      .catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Guten Morgen" : hour < 18 ? "Guten Tag" : "Guten Abend";

  const groups: { title: string; cards: CardDef[] }[] = [
    {
      title: "Umsatz & Zahlungen",
      cards: [
        {
          href: "/admin/zahlungen",
          label: "Zahlungszentrale",
          desc: "Offene Zahlungen prüfen, als bezahlt freischalten, Erinnerungen, Timeline je Kunde.",
          icon: CreditCard,
          badge: stats && stats.claimed.count > 0 ? `${stats.claimed.count} angekündigt` : null,
        },
        {
          href: "/admin/zahlungen#auszahlungen",
          label: "Auszahlungen",
          desc: "Provisions-Anforderungen der Mitarbeiter prüfen, freigeben oder ablehnen.",
          icon: Banknote,
          badge: stats && stats.openPayouts > 0 ? `${stats.openPayouts} offen` : null,
        },
        {
          href: "/admin/rechnungen",
          label: "Rechnungen",
          desc: "Alle erzeugten Rechnungen im Nummernkreis durchsuchen und als PDF laden.",
          icon: FileText,
          badge: stats && stats.invoiceCount > 0 ? String(stats.invoiceCount) : null,
        },
      ],
    },
    {
      title: "Kunden & Anträge",
      cards: [
        {
          href: "/admin/database",
          label: "Kunden & Anträge",
          desc: "Antrags-Cockpit: alle Anträge, KYC/Prüfbereit, Aufgaben, Investoren, Buchhaltung.",
          icon: Database,
          badge: dupGroups > 0 ? `${dupGroups} Duplikate` : null,
        },
      ],
    },
    {
      title: "Team",
      cards: [
        {
          href: "/admin/team",
          label: "Team-Übersicht",
          desc: "Leistung, Provisionen und Kunden-Zuweisungen aller Mitarbeiter.",
          icon: Users,
          badge: stats && stats.bankChanges > 0 ? `${stats.bankChanges} Bankdaten prüfen` : stats ? `${stats.activeAgents} aktiv` : null,
        },
        {
          href: "/admin/team?einladen=1",
          label: "Agent anlegen",
          desc: "Neuen Mitarbeiter per E-Mail-Einladung anlegen (Link 48 h gültig).",
          icon: UserPlus,
        },
        {
          href: "/admin/team#skripte",
          label: "Skripte & Leitfäden",
          desc: "Gesprächsvorlagen für das Telefon-Team pflegen und sortieren.",
          icon: BookOpen,
        },
      ],
    },
    {
      title: "System & Recht",
      cards: [
        {
          href: "/admin/einstellungen",
          label: "Einstellungen",
          desc: "Provisionssatz, Mindest-Auszahlung, Base-URL- und Make-Webhook-Diagnose.",
          icon: Settings,
        },
        {
          href: "/admin/audit",
          label: "Audit-Log",
          desc: "Jede Mitarbeiter-Aktion nachvollziehen — durchsuchbar.",
          icon: ScrollText,
        },
        {
          href: "/admin/recht",
          label: "Rechtstexte-Status",
          desc: "Review-Stand der Rechtstexte (LEGAL_REVIEW_PACKAGE, read-only).",
          icon: Scale,
        },
      ],
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* O1: Kopf + Tages-Kennzahlen */}
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] mb-1" style={{ color: ACCENT }}>Kommandozentrale</p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{greeting}.</h1>
        <p className="text-[13px] text-slate-500 mt-1">
          Von hier erreichst du jeden Bereich der Verwaltung — Suche jederzeit mit <kbd className="text-[11px] font-semibold border border-slate-200 rounded px-1 py-0.5 bg-white">⌘K</kbd>.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Neue Anträge heute</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? stats.todayNew : "—"}</p>
        </div>
        <Link href="/admin/zahlungen" className="text-left bg-white border border-slate-300 rounded-2xl p-4 hover:border-slate-400 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Zahlung angekündigt</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? eur(stats.claimed.sum) : "—"}</p>
          <p className="text-[11px] text-slate-400">{stats ? `${stats.claimed.count} warten auf Freischaltung` : ""}</p>
        </Link>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Heute bestätigt</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? eur(stats.todayPaid.sum) : "—"}</p>
          <p className="text-[11px] text-slate-400">{stats ? `${stats.todayPaid.count} Zahlung(en)` : ""}</p>
        </div>
        <Link href="/admin/zahlungen#auszahlungen" className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-slate-400 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Offene Auszahlungen</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums">{stats ? stats.openPayouts : "—"}</p>
          <p className="text-[11px] text-slate-400">Anforderungen des Teams</p>
        </Link>
      </div>

      {/* O2: Bereichs-Karten */}
      {groups.map((g) => (
        <section key={g.title} className="mb-7">
          <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">{g.title}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.cards.map((c) => <AreaCard key={c.href} c={c} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
