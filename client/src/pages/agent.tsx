import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import {
  Phone, FileText, X, ChevronDown, ChevronRight, Lock, CalendarClock,
  Wallet, User, Calendar, Users, TrendingUp, CheckCircle2, ArrowRight, Search,
  Clock, Send, CalendarPlus, Info,
} from "lucide-react";
import {
  AgentShell, Badge, Card, ProgressBar, FlashMessage, useAgentInfo,
  api, fmtCents, fmtEur, fmtD, fmtDT, isToday, inputCls, btnPrimary, btnGhost, ACCENT,
} from "./agent/shared";
import { AuthLayout, SubmitButton, Reveal, CountUp, SuccessPulse, SignatureCore } from "./agent/motion";

// ============================================================================
// /agent — Startseite: Verdienst-Kennzahlen (G4) + Arbeitsliste + Kundendetail
// Design nach Paket E: monochrom, Text-Badges, eine Akzentfarbe, keine Emojis.
// ============================================================================

interface Customer {
  ref: string;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  pack_name: string | null;
  amount_due: string | null;
  payment_reference: string | null;
  payment_status: string;
  payment_due_date: string | null;
  claimed_paid_at: string | null;
  promised_pay_date: string | null;
  agent_email_sent_at: string | null;
  invoice_number: string | null;
  created_at: string;
  assigned_agent_id: number | null;
  assigned_agent_name: string | null;
  locked_by_name: string | null;
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  last_contact?: { type: string; outcome: string | null; agent_name: string; created_at: string } | null;
  next_appointment?: string | null;
}

interface LogEntry {
  id: number;
  type: string;
  outcome: string | null;
  note: string | null;
  agent_name: string;
  scheduled_at: string | null;
  promised_date: string | null;
  created_at: string;
}

interface ContextScript { id: number; title: string; category: string; content_html: string | null; file_name: string | null }

interface Earnings {
  rateBp: number;
  potentialCents: number;
  potentialCount: number;
  confirmedCents: number;
  inPayoutCents: number;
  paidOutCents: number;
  monthCents: number;
  monthlyGoalCents: number | null;
  entries: { id: number; ref: string; pack_name: string | null; rate_bp: number; amount_cents: number; status: string; created_at: string }[];
}

const OUTCOME_LABELS: Record<string, string> = {
  erreicht_zahlt_gleich: "Erreicht – zahlt gleich",
  erreicht_zahlt_am: "Erreicht – zahlt am …",
  erreicht_abgelehnt: "Erreicht – abgelehnt",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Nummer falsch",
};

function custName(c: Customer): string {
  if (c.company_name) return c.company_name;
  return [c.first_name, c.last_name].filter(Boolean).join(" ") || c.contact_name || "—";
}

function custPhone(c: Customer): string | null {
  if (c.phone) return `${c.phone_country_code || ""}${c.phone}`.replace(/\s/g, "");
  if (c.contact_phone) return c.contact_phone.replace(/\s/g, "");
  return null;
}

type Filter = "alle" | "claimed" | "termin" | "nicht_erreicht";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

// ── Cinematische Verdienst-Kachel (Count-up beim ersten Laden) ──
function EarningsTile({ label, cents, sub, icon: Icon, accent }: {
  label: string; cents: number; sub?: string; icon: typeof TrendingUp; accent?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 h-full transition-shadow duration-200 hover:shadow-[0_12px_30px_-18px_rgba(15,23,42,.28)]">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 leading-tight">{label}</p>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={accent ? { background: "rgba(37,99,235,.10)", color: ACCENT } : { background: "#f1f5f9", color: "#94a3b8" }}
        >
          <Icon size={15} strokeWidth={1.9} />
        </span>
      </div>
      <p className="text-[22px] sm:text-[24px] font-bold tracking-tight text-slate-900">
        <CountUp value={cents} format={fmtCents} />
      </p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Bereichs-Kachel für die Navigation ──
function AreaTile({ href, label, desc, icon: Icon, badge, onClick }: {
  href: string; label: string; desc: string; icon: typeof Users; badge?: number; onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group relative rounded-2xl border border-slate-200 bg-white p-4 flex flex-col gap-2 transition-all duration-150 hover:border-slate-300 hover:shadow-[0_12px_30px_-20px_rgba(15,23,42,.3)] active:scale-[.99]"
    >
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 group-hover:text-slate-700 transition-colors">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        {badge != null && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: ACCENT }}>{badge}</span>
        )}
      </div>
      <div>
        <p className="text-[13px] font-semibold text-slate-900 flex items-center gap-1">
          {label}
          <ArrowRight size={13} className="text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all" />
        </p>
        <p className="text-[11.5px] text-slate-400 leading-tight mt-0.5">{desc}</p>
      </div>
    </Link>
  );
}

// ── Fokus-Zeile in der „Heute"-Zone ──
function FocusRow({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const phone = custPhone(c);
  const hasAppt = isToday(c.next_appointment);
  const detail = hasAppt
    ? `Termin ${fmtDT(c.next_appointment!)}`
    : isToday(c.promised_pay_date)
      ? "Zahlungs-Zusage heute"
      : c.payment_status === "claimed_paid" ? "Zahlung angekündigt" : "Fällig";
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors">
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="min-w-0 text-left flex items-center gap-3 flex-1">
        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 text-[12px] font-semibold flex items-center justify-center shrink-0">
          {(custName(c).match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-slate-900 truncate">{custName(c)}</span>
          <span className="block text-[11.5px] text-slate-400 truncate flex items-center gap-1.5">
            {hasAppt ? <Clock size={11} strokeWidth={1.8} /> : <CalendarClock size={11} strokeWidth={1.8} />}
            {detail}
          </span>
        </span>
      </button>
      <div className="flex items-center gap-1.5 shrink-0">
        {phone && (
          <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className={`${btnPrimary} px-3 py-2 inline-flex items-center gap-1.5`}>
            <Phone size={13} strokeWidth={2} /><span className="hidden sm:inline">Anrufen</span>
          </a>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 flex items-center justify-center transition-colors">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

export default function AgentPortalPage() {
  return (
    <AgentShell>
      <AgentHome />
    </AgentShell>
  );
}

function AgentHome() {
  const [agent, setAgent] = useState<{ name: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    api("/agent/me").then((r) => {
      setAgent(r.ok ? r.json.agent : null);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) return <p className="py-16 text-center text-[13px] text-slate-400">Lädt …</p>;
  if (!agent) return <LoginView onLogin={setAgent} />;
  return <Dashboard />;
}

// ═══════════════ Login (inkl. „Passwort vergessen", F2) ═══════════════

function LoginView({ onLogin }: { onLogin: (a: { name: string; email: string }) => void }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await api("/agent/login", { method: "POST", body: JSON.stringify(form) });
    setBusy(false);
    if (r.ok) {
      onLogin(r.json.agent);
      window.location.reload(); // Shell neu initialisieren (Navigation/Avatar)
    } else {
      setError(r.json?.error || "Anmeldung fehlgeschlagen");
    }
  };

  const forgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await api("/agent/forgot-password", { method: "POST", body: JSON.stringify({ email: form.email }) });
    setBusy(false);
    setInfo(r.json?.message || "Falls ein Konto existiert, wurde eine E-Mail versendet.");
  };

  return (
    <AuthLayout
      title="Mitarbeiter-Portal"
      subtitle={forgotMode ? "Wir senden dir einen Link zum Zurücksetzen." : "Willkommen zurück. Melde dich an, um weiterzuarbeiten."}
    >
      {forgotMode ? (
        <form onSubmit={forgot} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} autoComplete="username" style={{ minHeight: 46 }} />
          </div>
          {info && <p className="text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed">{info}</p>}
          <SubmitButton loading={busy} disabled={!form.email}>
            {busy ? "Sende …" : "Reset-Link anfordern"}
          </SubmitButton>
          <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(false); setInfo(null); }} className="w-full text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
            Zurück zur Anmeldung
          </button>
        </form>
      ) : (
        <form onSubmit={login} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} autoComplete="username" style={{ minHeight: 46 }} />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Passwort</label>
            <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={inputCls} autoComplete="current-password" style={{ minHeight: 46 }} />
          </div>
          {error && <p className="text-[12px] font-medium text-slate-700 border border-slate-300 rounded-lg px-3 py-2.5">{error}</p>}
          <SubmitButton loading={busy}>{busy ? "Anmelden …" : "Anmelden"}</SubmitButton>
          <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(true); }} className="w-full text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
            Passwort vergessen?
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

// ═══════════════ Dashboard ═══════════════

function Dashboard() {
  const { agent } = useAgentInfo();
  const firstName = (agent?.name || "").split(/\s+/)[0] || "";
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [colleagues, setColleagues] = useState<Customer[]>([]);
  const [colleaguesOpen, setColleaguesOpen] = useState(false);
  const [earnings, setEarnings] = useState<Earnings | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const [message, setMessage] = useState<string | null>(null);
  const [detailRef, setDetailRef] = useState<string | null>(null);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e] = await Promise.all([api("/agent/customers"), api("/agent/earnings")]);
    if (c.ok) { setCustomers(c.json.data); setColleagues(c.json.colleagues || []); }
    if (e.ok) setEarnings(e.json);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((c) => {
      if (q && !(custName(c).toLowerCase().includes(q) || (c.email || "").toLowerCase().includes(q) || (c.ref || "").toLowerCase().includes(q) || (c.payment_reference || "").toLowerCase().includes(q))) return false;
      if (filter === "claimed") return c.payment_status === "claimed_paid";
      if (filter === "termin") return !!c.next_appointment;
      if (filter === "nicht_erreicht") return c.last_contact?.outcome === "nicht_erreicht" || c.last_contact?.outcome === "mailbox";
      return true;
    });
  }, [customers, search, filter]);

  const dueToday = useMemo(
    () => customers.filter((c) => isToday(c.next_appointment) || isToday(c.promised_pay_date)),
    [customers],
  );

  const claimedCount = customers.filter((c) => c.payment_status === "claimed_paid").length;

  // Fokus „Heute": fällige Rückrufe/Zusagen + neu angekündigte Zahlungen, dedupliziert.
  const focusItems = useMemo(() => {
    const map = new Map<string, Customer>();
    for (const c of dueToday) map.set(c.ref, c);
    for (const c of customers) if (c.payment_status === "claimed_paid") map.set(c.ref, c);
    return Array.from(map.values());
  }, [dueToday, customers]);

  const AREAS = [
    { href: "/agent", label: "Kundenliste", desc: "Offene Zahlungen bearbeiten", icon: Users, badge: customers.length || undefined, onClick: () => { setFilter("alle"); document.getElementById("kundenliste")?.scrollIntoView({ behavior: "smooth" }); } },
    { href: "/agent/kalender", label: "Kalender", desc: "Rückrufe & Zusagen", icon: Calendar, badge: dueToday.length || undefined },
    { href: "/agent/skripte", label: "Skripte", desc: "Leitfäden fürs Telefonat", icon: FileText },
    { href: "/agent/auszahlung", label: "Auszahlung", desc: earnings && earnings.confirmedCents > 0 ? `${fmtCents(earnings.confirmedCents)} verfügbar` : "Guthaben & Anforderung", icon: Wallet },
    { href: "/agent/profil", label: "Profil", desc: "Konto & Auszahlungsdaten", icon: User },
  ];

  return (
    <div>
      <FlashMessage message={message} />

      {/* ── Q1: Begrüßung (cinematischer Kopf) ── */}
      <Reveal index={0}>
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white mb-4 px-5 py-5 sm:px-7 sm:py-6">
          <div className="pointer-events-none absolute -right-10 -top-14 opacity-[.5] hidden sm:block">
            <SignatureCore size={190} />
          </div>
          <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-slate-400">{greeting()}</p>
          <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-slate-900 mt-0.5">
            {firstName || "Willkommen"}
          </h1>
          <p className="text-[13px] text-slate-500 mt-1 max-w-md">
            {focusItems.length > 0
              ? `${focusItems.length} ${focusItems.length === 1 ? "Vorgang wartet" : "Vorgänge warten"} heute auf dich.`
              : "Kein offener Vorgang für heute — starke Arbeit."}
          </p>
        </div>
      </Reveal>

      {/* ── Q1: Verdienst-Kennzahlen mit Count-up ── */}
      {earnings && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <Reveal index={1}>
              <EarningsTile label="Potenziell" cents={earnings.potentialCents} icon={TrendingUp}
                sub={`${earnings.potentialCount} offen · ${(earnings.rateBp / 100).toLocaleString("de-DE")} %`} />
            </Reveal>
            <Reveal index={2}>
              <SuccessPulse trigger={earnings.confirmedCents}>
                <EarningsTile label="Bestätigt · Guthaben" cents={earnings.confirmedCents} icon={CheckCircle2} accent sub="auszahlbar" />
              </SuccessPulse>
            </Reveal>
            <Reveal index={3}>
              <EarningsTile label="In Auszahlung" cents={earnings.inPayoutCents} icon={Clock} sub="Anforderung läuft" />
            </Reveal>
            <Reveal index={4}>
              <EarningsTile label="Ausgezahlt" cents={earnings.paidOutCents} icon={Wallet} sub="seit Beginn" />
            </Reveal>
          </div>
          {earnings.monthlyGoalCents != null && earnings.monthlyGoalCents > 0 && (
            <Reveal index={5}>
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 mb-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Monatsziel</p>
                  <p className="text-[12px] text-slate-500 tabular-nums">
                    {fmtCents(earnings.monthCents)} / {fmtCents(earnings.monthlyGoalCents)}
                  </p>
                </div>
                <ProgressBar value={earnings.monthCents} max={earnings.monthlyGoalCents} />
              </div>
            </Reveal>
          )}
        </>
      )}

      {/* ── Q2: Arbeits-Fokus-Zone „Heute" ── */}
      <Reveal index={6}>
        <div className="rounded-2xl border border-slate-200 bg-white mb-5 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center gap-2">
            <CalendarClock size={15} strokeWidth={1.8} className="text-slate-400" />
            <h2 className="text-[13px] font-semibold text-slate-900">Heute</h2>
            {focusItems.length > 0 && (
              <span className="ml-1 text-[11px] font-semibold text-slate-400">{focusItems.length}</span>
            )}
          </div>
          {focusItems.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CheckCircle2 size={22} strokeWidth={1.6} className="mx-auto text-slate-300 mb-2" />
              <p className="text-[13px] font-medium text-slate-500">Alles erledigt — starke Arbeit.</p>
              <p className="text-[12px] text-slate-400 mt-0.5">Keine fälligen Rückrufe oder Zusagen für heute.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {focusItems.map((c) => <FocusRow key={c.ref} c={c} onOpen={() => setDetailRef(c.ref)} />)}
            </div>
          )}
        </div>
      </Reveal>

      {/* ── Q3: Bereichs-Navigation ── */}
      <Reveal index={7}>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          {AREAS.map((a) => <AreaTile key={a.label} {...a} />)}
        </div>
      </Reveal>

      {/* ── Kundenliste ── */}
      <div id="kundenliste" className="scroll-mt-20">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-[15px] font-bold tracking-tight text-slate-900">Deine Kunden</h2>
        <span className="text-[12px] text-slate-400">({customers.length})</span>
      </div>

      {/* ── Suche + Filter ── */}
      <div className="mb-4 space-y-2.5">
        <div className="relative" style={{ maxWidth: 420 }}>
          <Search size={15} strokeWidth={1.8} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Name, E-Mail, Referenz …"
            className={`${inputCls} pl-10`}
            style={{ minHeight: 46 }}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { key: "alle", label: `Alle offenen (${customers.length})` },
            { key: "claimed", label: `Zahlung angekündigt (${claimedCount})` },
            { key: "termin", label: "Termin vereinbart" },
            { key: "nicht_erreicht", label: "Nicht erreicht" },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilter(f.key); }}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-all duration-150 ${
                filter === f.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => <div key={i} className="agent-skeleton h-16 rounded-xl" />)}
        </div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="py-14 text-center">
          <p className="text-[13px] text-slate-400">
            {search || filter !== "alle" ? "Keine Treffer." : "Aktuell keine unbezahlten Kunden in deiner Liste."}
          </p>
        </div>
      )}

      {/* ── Mobile Karten ── */}
      <div className="space-y-2.5 md:hidden">
        {filtered.map((c) => (
          <CustomerCard key={c.ref} c={c} onOpen={() => setDetailRef(c.ref)} />
        ))}
      </div>

      {/* ── Desktop Tabelle ── */}
      {!loading && filtered.length > 0 && (
        <Card className="hidden md:block overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {["Name", "E-Mail", "Telefon", "Paket", "Betrag", "Status", "Zuletzt", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const phone = custPhone(c);
                return (
                  <tr key={c.ref} onClick={() => setDetailRef(c.ref)} className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-semibold text-slate-900">{custName(c)}</p>
                      <p className="text-[11px] font-mono text-slate-400">{c.payment_reference || c.ref}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 whitespace-nowrap tabular-nums">{phone || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{(c.pack_name || "—").replace(/\n/g, " ")}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap tabular-nums">{fmtEur(c.amount_due)}</td>
                    <td className="px-4 py-3">
                      <Badge status={c.payment_status} />
                      {c.locked_by_name && (
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><Lock size={10} /> {c.locked_by_name}</p>
                      )}
                      {c.next_appointment && <p className="text-[10px] text-slate-500 mt-1">Termin {fmtDT(c.next_appointment)}</p>}
                      {c.promised_pay_date && <p className="text-[10px] text-slate-500 mt-1">Zusage {fmtD(c.promised_pay_date)}</p>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[170px]">
                      {c.last_contact
                        ? `${c.last_contact.type === "note" ? "Notiz" : c.last_contact.type === "claim" ? "Zugewiesen" : OUTCOME_LABELS[c.last_contact.outcome || ""] || c.last_contact.type} · ${fmtDT(c.last_contact.created_at)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`${btnPrimary} px-3 py-2 inline-flex items-center gap-1.5`}
                          >
                            <Phone size={13} strokeWidth={2} /> Anrufen
                          </a>
                        )}
                        <button type="button" onClick={(e) => { e.stopPropagation(); setDetailRef(c.ref); }} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 flex items-center justify-center transition-colors">
                          <ChevronRight size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      </div>{/* /kundenliste */}

      {/* ── Von Kollegen betreut (read-only, G2) ── */}
      {colleagues.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setColleaguesOpen((v) => !v); }}
            className="flex items-center gap-2 text-[12px] font-semibold text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronDown size={14} className={`transition-transform ${colleaguesOpen ? "" : "-rotate-90"}`} />
            Von Kollegen betreut ({colleagues.length})
          </button>
          {colleaguesOpen && (
            <Card className="mt-2 divide-y divide-slate-50">
              {colleagues.map((c) => (
                <div key={c.ref} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-slate-600 truncate">{custName(c)}</p>
                    <p className="text-[11px] text-slate-400">Betreut von {c.assigned_agent_name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={c.payment_status} />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setDetailRef(c.ref); }}
                      className="text-[12px] font-semibold text-slate-400 hover:text-slate-600"
                    >
                      Ansehen
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {detailRef && (
        <CustomerDetail
          refId={detailRef}
          onClose={() => setDetailRef(null)}
          onChanged={() => { load(); }}
          flash={flash}
        />
      )}
    </div>
  );
}

function CustomerCard({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const phone = custPhone(c);
  return (
    <Card className={`p-4 cursor-pointer active:bg-slate-50 ${c.payment_status === "claimed_paid" ? "border-slate-300" : ""}`}>
      <div onClick={onOpen}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-slate-900 truncate">{custName(c)}</p>
            <p className="text-[12px] text-slate-400 truncate">{c.email || "—"}</p>
          </div>
          <Badge status={c.payment_status} />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-slate-500 mb-3 flex-wrap">
          <span className="font-semibold text-slate-800 tabular-nums">{fmtEur(c.amount_due)}</span>
          <span>{(c.pack_name || "—").replace(/\n/g, " ")}</span>
          {c.next_appointment && <span>Termin {fmtDT(c.next_appointment)}</span>}
          {c.promised_pay_date && <span>Zusage {fmtD(c.promised_pay_date)}</span>}
          {c.locked_by_name && <span className="flex items-center gap-1"><Lock size={11} /> {c.locked_by_name}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        {phone ? (
          <a
            href={`tel:${phone}`}
            onClick={(e) => e.stopPropagation()}
            className={`${btnPrimary} flex-1 text-center py-3 inline-flex items-center justify-center gap-2`}
            style={{ minHeight: 46 }}
          >
            <Phone size={15} strokeWidth={2} /> Anrufen
          </a>
        ) : (
          <span className="flex-1 text-center py-3 rounded-lg bg-slate-50 border border-slate-100 text-slate-400 text-[13px] font-medium">Keine Nummer</span>
        )}
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className={btnGhost} style={{ minHeight: 46 }}>
          Details
        </button>
      </div>
    </Card>
  );
}

// ═══════════════ Kundendetail (Sheet) ═══════════════

function CustomerDetail({ refId, onClose, onChanged, flash }: {
  refId: string;
  onClose: () => void;
  onChanged: () => void;
  flash: (m: string) => void;
}) {
  const [detail, setDetail] = useState<Customer | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [scripts, setScripts] = useState<ContextScript[]>([]);
  const [scriptsOpen, setScriptsOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [datePick, setDatePick] = useState<{ outcome: string; value: string } | null>(null);
  const [lockUntil, setLockUntil] = useState<number>(0);
  const [now, setNow] = useState(Date.now());
  const [mobileTab, setMobileTab] = useState<"stamm" | "aktion" | "verlauf">("aktion");
  const [checkKey, setCheckKey] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    api(`/agent/customers/${encodeURIComponent(refId)}`).then((r) => {
      if (r.ok) {
        setDetail(r.json.data);
        setLog(r.json.log || []);
        setReadOnly(!!r.json.readOnly);
        setScripts(r.json.contextScripts || []);
        if (r.json.data.agent_email_sent_at) {
          setLockUntil(new Date(r.json.data.agent_email_sent_at).getTime() + 10 * 60 * 1000);
        }
      } else {
        flash(r.json?.error || "Kunde nicht gefunden");
        onClose();
      }
    });
  }, [refId]);

  if (!detail) return null;

  const phone = custPhone(detail);
  const lockSec = Math.max(0, Math.ceil((lockUntil - now) / 1000));

  const saveNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!noteText.trim()) return;
    setBusy("note");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/notes`, { method: "POST", body: JSON.stringify({ note: noteText.trim() }) });
    setBusy(null);
    if (r.ok) {
      setLog((l) => [r.json.entry, ...l]);
      setNoteText("");
      if (r.json.claimed) { flash("Kunde wurde dir zugewiesen"); onChanged(); }
    } else flash(r.json?.error || "Fehler");
  };

  const saveOutcome = async (e: React.MouseEvent, outcome: string, dateValue?: string) => {
    e.stopPropagation();
    if ((outcome === "rueckruf_termin" || outcome === "erreicht_zahlt_am") && !dateValue) {
      setDatePick({ outcome, value: "" });
      return;
    }
    setBusy(outcome);
    const body: any = { outcome };
    if (outcome === "rueckruf_termin") body.scheduledAt = dateValue;
    if (outcome === "erreicht_zahlt_am") body.promisedDate = dateValue;
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/contact-result`, { method: "POST", body: JSON.stringify(body) });
    setBusy(null);
    if (r.ok) {
      setLog((l) => [r.json.entry, ...l]);
      setDatePick(null);
      setCheckKey(outcome);
      setTimeout(() => setCheckKey((k) => (k === outcome ? null : k)), 900);
      flash(`${OUTCOME_LABELS[outcome]} dokumentiert`);
      onChanged();
    } else flash(r.json?.error || "Fehler");
  };

  const sendEmail = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setBusy("email");
    const r = await api(`/agent/customers/${encodeURIComponent(refId)}/send-payment-email`, { method: "POST" });
    setBusy(null);
    if (r.ok) {
      setLockUntil(new Date(r.json.lockedUntil).getTime());
      flash("Zahlungsdaten-E-Mail wird versendet");
      onChanged();
    } else if (r.status === 429 && r.json?.lockedUntil) {
      setLockUntil(new Date(r.json.lockedUntil).getTime());
      flash("E-Mail wurde vor Kurzem gesendet — Sperre aktiv");
    } else flash(r.json?.error || "Fehler");
  };

  const lockPct = lockSec > 0 ? Math.max(0, Math.min(100, ((600 - lockSec) / 600) * 100)) : 0;

  // ── Stammdaten (linke Spalte / Mobile-Tab „Stammdaten") ──
  const stammBlock = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 text-[13px]">
        <Field label="E-Mail" value={detail.email || "—"} breakAll />
        <Field label="Telefon" value={phone || "—"} />
        <Field label="Paket" value={(detail.pack_name || "—").replace(/\n/g, " ")} />
        <Field label="Betrag" value={fmtEur(detail.amount_due)} />
        <Field label="Zahlungsreferenz" value={detail.payment_reference || "—"} mono />
        <Field label="Fällig bis" value={fmtD(detail.payment_due_date)} />
        {(detail.street || detail.city) && (
          <div className="col-span-2">
            <Field label="Adresse" value={[detail.street, [detail.zip, detail.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")} />
          </div>
        )}
      </div>
      <a
        href={`/api/fiaon/agent/customers/${encodeURIComponent(refId)}/invoice.pdf`}
        target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
        className={`${btnGhost} w-full py-3 inline-flex items-center justify-center gap-2`}
        style={{ minHeight: 46 }}
      >
        <FileText size={14} strokeWidth={1.8} /> Rechnung (PDF) öffnen
      </a>
    </div>
  );

  // ── Verlauf/Timeline (linke Spalte / Mobile-Tab „Verlauf") ──
  const verlaufBlock = (
    <div>
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Verlauf</h3>
      <div className="space-y-2">
        {log.length === 0 && <p className="text-[12px] text-slate-400">Noch keine Einträge.</p>}
        {log.map((l, i) => (
          <div key={l.id} className={`relative pl-4 ${i === 0 ? "agent-check-in" : ""}`}>
            <span className="absolute left-0 top-1.5 w-1.5 h-1.5 rounded-full" style={{ background: i === 0 ? ACCENT : "#cbd5e1" }} />
            <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  {l.type === "note" ? "Notiz"
                    : l.type === "email_sent" ? "Zahlungsdaten-E-Mail"
                    : l.type === "claim" ? "Zuweisung"
                    : l.type === "system" ? "System"
                    : OUTCOME_LABELS[l.outcome || ""] || l.outcome}
                </span>
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{l.agent_name} · {fmtDT(l.created_at)}</span>
              </div>
              {l.scheduled_at && <p className="text-[12px] font-medium text-slate-700">Termin: {fmtDT(l.scheduled_at)}</p>}
              {l.promised_date && <p className="text-[12px] font-medium text-slate-700">Zahlt am: {fmtD(l.promised_date)}</p>}
              {l.note && <p className="text-[12px] text-slate-600 whitespace-pre-wrap">{l.note}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── Aktionsbereich (rechte Spalte / Mobile-Tab „Aktion") ──
  const aktionBlock = (
    <div className="space-y-5">
      {/* Gesprächsleitfaden */}
      {scripts.length > 0 && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <button type="button" onClick={(e) => { e.stopPropagation(); setScriptsOpen((v) => !v); }}
            className="w-full px-4 py-3 flex items-center justify-between text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
            <span className="flex items-center gap-2"><FileText size={14} strokeWidth={1.8} /> Gesprächsleitfaden ({scripts.length})</span>
            <ChevronDown size={15} className={`text-slate-400 transition-transform ${scriptsOpen ? "" : "-rotate-90"}`} />
          </button>
          {scriptsOpen && (
            <div className="border-t border-slate-100 divide-y divide-slate-50 max-h-64 overflow-y-auto agent-scroll">
              {scripts.map((s) => (
                <div key={s.id} className="px-4 py-3">
                  <p className="text-[12px] font-semibold text-slate-800 mb-1">{s.title}</p>
                  {s.content_html && (
                    <div className="text-[12px] text-slate-600 leading-relaxed prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_b]:font-semibold" dangerouslySetInnerHTML={{ __html: s.content_html }} />
                  )}
                  {s.file_name && (
                    <a href={`/api/fiaon/agent/scripts/${s.id}/file`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                      className="text-[12px] font-semibold hover:underline" style={{ color: ACCENT }}>
                      PDF öffnen: {s.file_name}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {readOnly ? (
        <div className="px-3.5 py-3 rounded-xl border border-slate-200 bg-slate-50 text-[12px] font-medium text-slate-600 flex items-center gap-2">
          <Info size={14} strokeWidth={1.8} />
          {detail.assigned_agent_name
            ? `Betreut von ${detail.assigned_agent_name} — nur Lesezugriff`
            : `In Bearbeitung durch ${detail.locked_by_name} — nur Lesezugriff`}
        </div>
      ) : (
        <>
          {/* Kontakt-Ergebnis */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Kontakt-Ergebnis</h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                <button key={key} type="button" onClick={(e) => saveOutcome(e, key)} disabled={busy !== null}
                  className={`relative px-3 py-2.5 rounded-xl border text-[12px] font-medium transition-all duration-150 disabled:opacity-40 text-left active:scale-[.98] ${
                    checkKey === key ? "border-[#2563eb] text-slate-800" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
                  }`}
                  style={{ minHeight: 46 }}>
                  {busy === key
                    ? "…"
                    : checkKey === key
                      ? <span className="agent-check-in inline-flex items-center gap-1.5" style={{ color: ACCENT }}><CheckCircle2 size={14} strokeWidth={2} /> Erfasst</span>
                      : label}
                </button>
              ))}
            </div>
            {datePick && (
              <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50 agent-check-in">
                <p className="text-[12px] font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                  <CalendarPlus size={13} strokeWidth={1.8} />
                  {datePick.outcome === "rueckruf_termin" ? "Rückruf-Termin wählen" : "Kunde zahlt am"}
                </p>
                <div className="flex gap-2">
                  <input type={datePick.outcome === "rueckruf_termin" ? "datetime-local" : "date"} value={datePick.value}
                    onChange={(e) => setDatePick((d) => (d ? { ...d, value: e.target.value } : d))} className={inputCls} style={{ minHeight: 44 }} />
                  <button type="button" onClick={(e) => datePick.value && saveOutcome(e, datePick.outcome, datePick.value)}
                    disabled={!datePick.value || busy !== null} className={btnPrimary}>Speichern</button>
                </div>
              </div>
            )}
          </div>

          {/* Notiz schreiben */}
          <div>
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5">Notiz</h3>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder="Neue Notiz … (nach dem Speichern nicht mehr änderbar)" rows={3}
              className={`${inputCls} resize-none`} />
            <button type="button" onClick={saveNote} disabled={busy !== null || !noteText.trim()}
              className={`${btnPrimary} w-full mt-2 py-2.5 inline-flex items-center justify-center gap-2`}>
              {busy === "note" ? "Speichern …" : "Notiz speichern"}
            </button>
          </div>

          {/* Zahlungsdaten-E-Mail mit ruhigem Sperr-Fortschritt */}
          <div>
            <button type="button" onClick={sendEmail} disabled={lockSec > 0 || busy === "email"}
              className={`${btnGhost} w-full py-3 inline-flex items-center justify-center gap-2 relative overflow-hidden`} style={{ minHeight: 48 }}>
              {lockSec > 0 && (
                <span className="absolute left-0 top-0 bottom-0 bg-slate-100" style={{ width: `${lockPct}%`, transition: "width 1s linear" }} />
              )}
              <span className="relative inline-flex items-center gap-2">
                <Send size={14} strokeWidth={1.8} />
                {busy === "email" ? "Wird gesendet …" : lockSec > 0
                  ? `Gesendet — erneut in ${Math.floor(lockSec / 60)}:${String(lockSec % 60).padStart(2, "0")}`
                  : "Zahlungsdaten-E-Mail senden"}
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="agent-scope fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] agent-reveal" style={{ animationDuration: ".25s" }} />
      <div
        className="absolute inset-x-0 bottom-0 top-10 md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-[min(920px,100vw)] bg-white md:border-l border-slate-200 rounded-t-2xl md:rounded-none shadow-2xl flex flex-col agent-panel-in"
        style={{ animationDuration: ".3s" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (voll breit, Anruf-Button jederzeit erreichbar) */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between gap-3 z-10">
          <div className="min-w-0 flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-slate-100 text-slate-500 text-[13px] font-semibold hidden sm:flex items-center justify-center shrink-0">
              {(custName(detail).match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-slate-900 truncate">{custName(detail)}</p>
              <p className="font-mono text-[11px] text-slate-400 truncate">
                {detail.payment_reference || detail.ref}{detail.invoice_number ? ` · ${detail.invoice_number}` : ""}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {phone && (
              <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}
                className={`${btnPrimary} px-4 py-2.5 hidden md:inline-flex items-center gap-2`} style={{ minHeight: 42 }}>
                <Phone size={14} strokeWidth={2} /> Anrufen
              </a>
            )}
            <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-9 h-9 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Status-Strip (voll breit) + Erfolgs-Moment bei Statuswechsel */}
        <div className="shrink-0 px-5 py-3 border-b border-slate-100">
          <SuccessPulse trigger={detail.payment_status}>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={detail.payment_status} />
              {detail.promised_pay_date && <Badge label={`Zusage ${fmtD(detail.promised_pay_date)}`} />}
              {detail.assigned_agent_name && !readOnly && <Badge label={`Betreut von ${detail.assigned_agent_name}`} />}
            </div>
          </SuccessPulse>
        </div>

        {/* Mobile Segment-Control (einhändig, sticky unter Header) */}
        <div className="md:hidden shrink-0 px-3 py-2 border-b border-slate-100">
          <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-xl p-1">
            {([["stamm", "Stammdaten"], ["aktion", "Aktion"], ["verlauf", "Verlauf"]] as const).map(([k, lbl]) => (
              <button key={k} type="button" onClick={(e) => { e.stopPropagation(); setMobileTab(k); }}
                className={`py-2 rounded-lg text-[12px] font-semibold transition-all duration-150 ${
                  mobileTab === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Body: Desktop zweispaltig, Mobile per Segment-Control */}
        <div className="flex-1 overflow-y-auto agent-scroll">
          <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,400px)] md:divide-x md:divide-slate-100">
            {/* Links: Stammdaten + Verlauf */}
            <div className="px-5 py-5 space-y-6 md:min-h-full">
              <div className={`${mobileTab === "stamm" ? "block" : "hidden"} md:block`}>{stammBlock}</div>
              <div className={`${mobileTab === "verlauf" ? "block" : "hidden"} md:block`}>{verlaufBlock}</div>
            </div>
            {/* Rechts: Aktionen */}
            <div className={`px-5 py-5 bg-slate-50/40 ${mobileTab === "aktion" ? "block" : "hidden"} md:block`}>
              {aktionBlock}
            </div>
          </div>
        </div>

        {/* Mobile sticky Anruf-Aktion */}
        {phone && (
          <div className="md:hidden shrink-0 border-t border-slate-100 bg-white px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
            <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()}
              className={`${btnPrimary} w-full py-3 inline-flex items-center justify-center gap-2`} style={{ minHeight: 48 }}>
              <Phone size={15} strokeWidth={2} /> {custName(detail)} anrufen
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, mono, breakAll }: { label: string; value: string; mono?: boolean; breakAll?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`font-medium text-slate-800 ${mono ? "font-mono" : ""} ${breakAll ? "break-all" : ""}`}>{value}</p>
    </div>
  );
}
