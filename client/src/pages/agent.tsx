import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Link } from "wouter";
import {
  Phone, ChevronRight, CalendarClock, Clock, CheckCircle2, ArrowRight,
  Award, TrendingUp, Trophy, Gift,
} from "lucide-react";
import {
  AgentShell, FlashMessage, api, fmtCents, fmtTime, fmtD, isToday,
  inputCls, btnPrimary, ACCENT,
} from "./agent/shared";
import {
  AuthLayout, SubmitButton, Reveal, SignatureCore, LiveCount, GoalRing, useReducedMotion,
} from "./agent/motion";
import { CustomerDetail, custName, custPhone, type Customer } from "./agent/kunden";
import { FeedPanel, SalarySimulatorCard, FirstStepsPanel } from "./agent/motivation";

// ============================================================================
// /agent — Dashboard „Mein Tag" (Paket AG): drei Zonen in Glas-Optik.
// AG1 Kopf „Heute" (Verdienst + Ziel-Ring + 3D-Signature) · AG2 „Jetzt dran"
// (priorisierte Arbeitsliste, max. 5) · AG3 „Meine Abschlüsse" · AG4 Partner-
// Teaser. Seitenspalte: Erste Schritte (AO), Wunschgehalt (AK), Feed (AH).
// Aktualisierung per Polling (AJ, 45 s) — kein neuer Realtime-Stack.
// Alle Beträge kommen fertig gerechnet vom Server (Integer-Cents).
// ============================================================================

const POLL_MS = 45_000;

interface DashboardData {
  todayCents: number;
  weekCents: number;
  prevWeekCents: number;
  monthCents: number;
  monthlyGoalCents: number | null;
  dailyGoalCents: number;
  dailyContactsGoal: number;
  todayContacts: number;
  monthDeals: number;
  todayDeals: number;
  bestDayDeals: number;
  monthBonusCount: number;
  monthBonusCents: number;
  closes: {
    id: number; ref: string; pack_name: string | null; amount_cents: number;
    kind: string; status: string; created_at: string; is_bonus: boolean;
    first_name: string | null; last_name: string | null; contact_name: string | null; company_name: string | null;
  }[];
  partner: {
    status: { key: string; label: string; bonusBp: number };
    revenueCents: number;
    next: { key: string; label: string; minCents: number; remainingCents: number; prize: { title: string } | null } | null;
  };
}

/** Kartei-Kurzstand für die Handlungskarte oben (aus /agent/kartei/status). */
interface KarteiStatus {
  activeCardId: string | null;
  freieKarten: number;
  meineKarten: number;
  ruecklaeufer: { anzahl: number; inTagen: number | null; fristTage: number };
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 18) return "Guten Tag";
  return "Guten Abend";
}

const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

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
  return <Dashboard agentName={agent.name} />;
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
      window.location.reload();
    } else setError(r.json?.error || "Anmeldung fehlgeschlagen");
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
      title={forgotMode ? "Passwort zurücksetzen" : "Mitarbeiter-Anmeldung"}
      subtitle={forgotMode ? "Gib deine Login-E-Mail ein — wir senden dir einen Link." : "Dein Vertriebs-Cockpit wartet."}
    >
      {forgotMode ? (
        <form onSubmit={forgot} className="space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Login-E-Mail</label>
            <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} autoComplete="username" style={{ minHeight: 46 }} />
          </div>
          {info && <p className="text-[12px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed">{info}</p>}
          <SubmitButton loading={busy} disabled={!form.email}>
            {busy ? "Sende …" : "Reset-Link anfordern"}
          </SubmitButton>
          <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(false); setInfo(null); }}
            className="block w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
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
          <SubmitButton loading={busy} disabled={!form.email || !form.password}>
            {busy ? "Anmelden …" : "Anmelden"}
          </SubmitButton>
          <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(true); setError(null); }}
            className="block w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors">
            Passwort vergessen?
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

/**
 * Die EINE wichtigste Handlung des Tages — ganz oben, groß, ohne Ablenkung.
 * Reihenfolge der Dringlichkeit:
 *   1. Überfällige Rückrufe (jemand wartet auf einen Anruf)
 *   2. Eine Akte ist noch in Bearbeitung (erst zu Ende bringen)
 *   3. Freie Karten in der Kartei (neue Arbeit holen)
 *   4. Nichts offen — ehrlich sagen statt künstlich beschäftigen
 */
function NaechsterSchritt({
  firstName, faelligeRueckrufe, kartei, onRueckruf,
}: {
  firstName: string;
  faelligeRueckrufe: Customer[];
  kartei: KarteiStatus | null;
  onRueckruf: () => void;
}) {
  const rueckrufe = faelligeRueckrufe.length;
  const frei = kartei?.freieKarten ?? 0;
  const aktiv = !!kartei?.activeCardId;

  // Lagebericht in EINEM Satz — nur, was tatsächlich zutrifft.
  const teile: string[] = [];
  if (rueckrufe > 0) teile.push(`${rueckrufe} ${rueckrufe === 1 ? "Rückruf ist fällig" : "Rückrufe sind fällig"}`);
  if (frei > 0) teile.push(`${frei} freie ${frei === 1 ? "Karte wartet" : "Karten warten"}`);
  const lage = teile.length > 0 ? teile.join(" · ") : "Nichts überfällig — sauber gearbeitet.";

  let aktion: { label: string; href?: string; onClick?: () => void; icon: typeof Phone } | null = null;
  if (rueckrufe > 0) {
    aktion = { label: "Rückruf jetzt erledigen", onClick: onRueckruf, icon: Phone };
  } else if (aktiv) {
    aktion = { label: "Offene Akte weiterbearbeiten", href: "/agent/kartei?tab=meine", icon: ArrowRight };
  } else if (frei > 0) {
    aktion = { label: "Nächste Akte öffnen", href: "/agent/kartei", icon: ArrowRight };
  }

  return (
    <div className="relative overflow-hidden rounded-2xl agent-glass-strong mb-4 px-5 py-4 sm:px-6 sm:py-5">
      <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-slate-400">
        {greeting()}, {firstName}
      </p>
      <p className="text-[17px] sm:text-[19px] font-bold tracking-tight text-slate-900 mt-1.5 leading-snug">
        {lage}
      </p>

      {aktion && (
        aktion.href ? (
          <Link
            href={aktion.href}
            className="mt-3.5 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-semibold text-white transition-transform duration-150 active:scale-[.985]"
            style={{ background: ACCENT, minHeight: 50 }}
          >
            {aktion.label} <aktion.icon size={16} strokeWidth={2.2} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); aktion!.onClick?.(); }}
            className="mt-3.5 w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 text-[14px] font-semibold text-white transition-transform duration-150 active:scale-[.985]"
            style={{ background: ACCENT, minHeight: 50 }}
          >
            {aktion.label} <aktion.icon size={16} strokeWidth={2.2} />
          </button>
        )
      )}

      {/* Rückläufer-Vorwarnung: ehrlich, aber ohne Drohton. */}
      {kartei && kartei.ruecklaeufer.anzahl > 0 && (
        <p className="mt-2.5 text-[11.5px] text-slate-500 leading-relaxed">
          {kartei.ruecklaeufer.anzahl} deiner Akten {kartei.ruecklaeufer.anzahl === 1 ? "wurde" : "wurden"} noch nicht bearbeitet
          {kartei.ruecklaeufer.inTagen != null && kartei.ruecklaeufer.inTagen > 0
            ? ` und gehen in ${kartei.ruecklaeufer.inTagen} ${kartei.ruecklaeufer.inTagen === 1 ? "Tag" : "Tagen"} zurück in die Kartei.`
            : " und gehen demnächst zurück in die Kartei."}
        </p>
      )}
    </div>
  );
}

/** Eine Zeile in „Meine Abschlüsse" — für echte Abschlüsse und für Boni. */
function AbschlussRow({ k }: { k: DashboardData["closes"][number] }) {
  const kName = k.company_name || [k.first_name, k.last_name].filter(Boolean).join(" ") || k.contact_name
    || (k.kind === "feedback_bonus" ? "Feedback-Dankschön" : k.ref);
  const zusatz = k.kind === "override" ? "Team-Beteiligung"
    : k.kind === "feedback_bonus" ? "Bonus" : "";
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <span
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={k.is_bonus
            ? { background: "rgb(248 250 252)", color: "rgb(100 116 139)" }
            : { background: "rgba(37,99,235,.10)", color: ACCENT }}
        >
          {k.is_bonus ? <Gift size={15} strokeWidth={2} /> : <CheckCircle2 size={15} strokeWidth={2} />}
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-slate-900 truncate">{kName}</p>
          <p className="text-[11px] text-slate-400 truncate">
            {[(k.pack_name || "").replace(/\n/g, " ").trim(),
              isToday(k.created_at) ? `heute ${fmtTime(k.created_at)}` : fmtD(k.created_at),
              zusatz].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
      <p
        className="text-[14px] font-bold tabular-nums shrink-0"
        style={{ color: k.is_bonus ? "rgb(71 85 105)" : ACCENT }}
      >
        +{fmtCents(k.amount_cents)}
      </p>
    </div>
  );
}

// ═══════════════ Dashboard „Mein Tag" ═══════════════

function Dashboard({ agentName }: { agentName: string }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [kartei, setKartei] = useState<KarteiStatus | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [detailRef, setDetailRef] = useState<string | null>(null);
  const [glow, setGlow] = useState(false);
  const lastCloseId = useRef<number | null>(null);
  const reduced = useReducedMotion();

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  const load = useCallback(async () => {
    const [d, c, k] = await Promise.all([
      api("/agent/dashboard"),
      api("/agent/customers"),
      api("/agent/kartei/status"),
    ]);
    if (k.ok) setKartei(k.json);
    if (d.ok) {
      const next: DashboardData = d.json;
      // Erfolgs-Moment (AH1): neuer eigener Abschluss seit dem letzten Poll →
      // kurzer edler Glanz (≤2 s), kein Konfetti; reduced-motion → nur Text.
      const newestId = next.closes[0]?.id ?? null;
      if (lastCloseId.current !== null && newestId !== null && newestId !== lastCloseId.current) {
        if (!reduced) { setGlow(true); setTimeout(() => setGlow(false), 1700); }
      }
      lastCloseId.current = newestId;
      setData(next);
    }
    if (c.ok) setCustomers(c.json.data);
  }, [reduced]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const firstName = agentName.split(" ")[0];

  // Fällige Rückrufe — der stärkste Grund, sofort loszulegen.
  const faelligeRueckrufe = useMemo(
    () => customers.filter((c) => c.next_appointment && new Date(c.next_appointment).getTime() <= Date.now()),
    [customers],
  );
  const naechsterRueckruf = faelligeRueckrufe[0] || null;

  // AG2: Priorisierung — überfällige Rückrufe → Zahlung angekündigt → Zusage
  // heute → Termin heute → Rest (Eingangsdatum). Max. 5 sichtbar.
  const focusItems = useMemo(() => {
    const now = Date.now();
    const score = (c: Customer): number => {
      if (c.next_appointment && new Date(c.next_appointment).getTime() < now) return 0; // überfällig
      if (c.payment_status === "claimed_paid") return 1;
      if (isToday(c.promised_pay_date)) return 2;
      if (isToday(c.next_appointment)) return 3;
      return 4;
    };
    return [...customers]
      .sort((a, b) => score(a) - score(b) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(0, 5);
  }, [customers]);

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="agent-skeleton h-44 rounded-2xl" />
        <div className="agent-skeleton h-64 rounded-2xl" />
      </div>
    );
  }

  // Trennung Abschluss / Bonus — der Zähler oben darf der Liste nicht
  // widersprechen (frueher stand „1 im Juli" ueber zwei Eintraegen).
  const echteAbschluesse = data.closes.filter((k) => !k.is_bonus);
  const boni = data.closes.filter((k) => k.is_bonus);

  const weekDelta = data.prevWeekCents > 0
    ? Math.round(((data.weekCents - data.prevWeekCents) / data.prevWeekCents) * 100)
    : null;
  const moneyPct = data.dailyGoalCents > 0 ? (data.todayCents / data.dailyGoalCents) * 100 : 0;
  const activityPct = data.dailyContactsGoal > 0 ? (data.todayContacts / data.dailyContactsGoal) * 100 : 0;
  const monthName = MONTHS[new Date().getMonth()];
  const partnerPct = data.partner.next
    ? Math.max(0, Math.min(100, (data.partner.revenueCents / data.partner.next.minCents) * 100))
    : 100;

  return (
    <div>
      <FlashMessage message={message} />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_350px] lg:gap-5 lg:items-start">
        {/* ════ Hauptspalte ════ */}
        <div className="min-w-0">
          {/* ── Die EINE wichtigste Handlung. Muss auf 380 px ohne Scrollen
                 sichtbar sein, deshalb steht sie ganz oben und bleibt kompakt. ── */}
          <Reveal index={0}>
            <NaechsterSchritt
              firstName={firstName}
              faelligeRueckrufe={faelligeRueckrufe}
              kartei={kartei}
              onRueckruf={() => { if (naechsterRueckruf) setDetailRef(naechsterRueckruf.ref); }}
            />
          </Reveal>

          {/* ── AG1: Kopf „Heute" — Glas, Ziel-Ring, 3D-Signature ── */}
          <Reveal index={1}>
            <div className="relative overflow-hidden rounded-2xl agent-glass-strong mb-4 px-5 py-5 sm:px-7 sm:py-6">
              <div className="pointer-events-none absolute -right-12 -top-16 opacity-[.45] hidden sm:block">
                <SignatureCore size={220} facet />
              </div>
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Heute verdient</p>
                  <p className="text-[34px] sm:text-[40px] leading-none font-black tracking-tight text-slate-900 mt-1">
                    <LiveCount value={data.todayCents} format={fmtCents} />
                  </p>
                  <div className="flex items-center gap-3 mt-3 flex-wrap">
                    <span className="text-[12.5px] text-slate-500">
                      Diese Woche <span className="font-semibold text-slate-800 tabular-nums">{fmtCents(data.weekCents)}</span>
                    </span>
                    {weekDelta !== null && (
                      <span className={`inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-full border ${
                        weekDelta >= 0 ? "border-slate-200 text-slate-600" : "border-slate-200 text-slate-400"
                      }`}>
                        <TrendingUp size={11} strokeWidth={2} className={weekDelta < 0 ? "rotate-180" : ""} />
                        {weekDelta >= 0 ? "+" : ""}{weekDelta} % zur Vorwoche
                      </span>
                    )}
                  </div>
                </div>
                {/* Ziel-Ring: Provision (außen, Akzent) + Aktivität (innen, Slate) */}
                <div className="flex items-center gap-4 shrink-0">
                  <GoalRing
                    moneyPct={moneyPct}
                    activityPct={activityPct}
                    centerTop={`${Math.min(999, Math.round(moneyPct))} %`}
                    centerBottom="Tagesziel"
                  />
                  <div className="space-y-2">
                    <p className="text-[11px] leading-tight">
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: ACCENT }} />
                      <span className="text-slate-500">Provision</span><br />
                      <span className="font-semibold text-slate-800 tabular-nums ml-3.5">{fmtCents(data.todayCents)} / {fmtCents(data.dailyGoalCents)}</span>
                    </p>
                    <p className="text-[11px] leading-tight">
                      <span className="inline-block w-2 h-2 rounded-full bg-slate-400 mr-1.5" />
                      <span className="text-slate-500">Kontakte</span><br />
                      <span className="font-semibold text-slate-800 tabular-nums ml-3.5">{data.todayContacts} / {data.dailyContactsGoal}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>

          {/* ── AG2: Fokus „Jetzt dran" (Arbeitszone — schnell, kein schweres Motion) ── */}
          <Reveal index={2}>
            <div className="rounded-2xl agent-glass mb-4 overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100/80 flex items-center gap-2">
                <CalendarClock size={15} strokeWidth={1.8} className="text-slate-400" />
                <h2 className="text-[13px] font-semibold text-slate-900">Jetzt dran</h2>
                {customers.length > 0 && <span className="text-[11px] font-semibold text-slate-400">{customers.length} offen</span>}
                <Link href="/agent/meine-kunden" className="ml-auto text-[12px] font-semibold inline-flex items-center gap-1 hover:underline" style={{ color: ACCENT }}>
                  Alle anzeigen <ArrowRight size={12} strokeWidth={2} />
                </Link>
              </div>
              {focusItems.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <CheckCircle2 size={22} strokeWidth={1.6} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-[13px] font-medium text-slate-500">Alles erledigt — starke Arbeit.</p>
                  <p className="text-[12px] text-slate-400 mt-0.5">Keine offenen Vorgänge in deiner Liste.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {focusItems.map((c) => <FocusRow key={c.ref} c={c} onOpen={() => setDetailRef(c.ref)} />)}
                </div>
              )}
            </div>
          </Reveal>

          {/* ── AG3: Erfolge „Meine Abschlüsse" (mit Erfolgs-Glanz bei neuem Abschluss) ── */}
          <Reveal index={3}>
            <div className={`rounded-2xl agent-glass mb-4 overflow-hidden ${glow ? "agent-glow" : ""}`}>
              <div className="px-5 py-3.5 border-b border-slate-100/80 flex items-center gap-2">
                <Trophy size={15} strokeWidth={1.8} className="text-slate-400" />
                <h2 className="text-[13px] font-semibold text-slate-900">Meine Abschlüsse</h2>
                <span className="text-[11px] font-semibold text-slate-400">
                  {data.monthDeals} im {monthName}
                </span>
                <Link href="/agent/verdienst" className="ml-auto text-[12px] font-semibold inline-flex items-center gap-1 hover:underline" style={{ color: ACCENT }}>
                  Verdienst <ArrowRight size={12} strokeWidth={2} />
                </Link>
              </div>
              {/* Abschlüsse und Boni sind getrennt: Der Zähler oben zählt echte
                  Abschlüsse (kind='own'). Boni sind Verdienst, aber kein
                  Abschluss — vorher standen beide vermischt unter einer Zahl. */}
              {data.closes.length === 0 ? (
                <p className="px-5 py-8 text-center text-[12px] text-slate-400">
                  Hier erscheinen deine Abschlüsse, sobald ein Kunde bezahlt hat.
                </p>
              ) : (
                <>
                  {echteAbschluesse.length === 0 ? (
                    <p className="px-5 py-6 text-center text-[12px] text-slate-400">
                      Noch kein eigener Abschluss — deine erste Zahlung erscheint hier.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-50">
                      {echteAbschluesse.slice(0, 6).map((k) => (
                        <AbschlussRow key={k.id} k={k} />
                      ))}
                    </div>
                  )}
                  {boni.length > 0 && (
                    <>
                      <div className="px-5 py-2 bg-slate-50/70 border-y border-slate-100/80">
                        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
                          Boni und Gutschriften · zählen nicht als Abschluss
                        </p>
                      </div>
                      <div className="divide-y divide-slate-50">
                        {boni.slice(0, 3).map((k) => (
                          <AbschlussRow key={k.id} k={k} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </Reveal>

          {/* ── AG4: Partner-Fortschritt (Teaser) ── */}
          <Reveal index={4}>
            <Link href="/agent/partner-programm" className="block rounded-2xl agent-glass mb-4 px-5 py-4 transition-transform duration-150 active:scale-[.995] hover:shadow-[0_20px_44px_-26px_rgba(15,23,42,.32)]">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <Award size={17} strokeWidth={1.8} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-slate-900">
                    {data.partner.status.label}
                    {data.partner.next && (
                      <span className="font-medium text-slate-400"> · Noch {fmtCents(data.partner.next.remainingCents)} bis {data.partner.next.label}</span>
                    )}
                  </p>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mt-2">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${partnerPct}%`, background: ACCENT }} />
                  </div>
                  {data.partner.next?.prize && (
                    <p className="text-[11px] text-slate-400 mt-1.5 truncate">Nächste Prämie: {data.partner.next.prize.title}</p>
                  )}
                </div>
                <ChevronRight size={16} className="text-slate-300 shrink-0" />
              </div>
            </Link>
          </Reveal>

          {/* ── AK: Wunschgehalt-Simulator ── */}
          <Reveal index={5}>
            <SalarySimulatorCard className="mb-4" />
          </Reveal>
        </div>

        {/* ════ Seitenspalte (Desktop) / gestapelt (Mobile) ════ */}
        <div className="min-w-0">
          <Reveal index={2}>
            <FirstStepsPanel className="mb-4" />
          </Reveal>
          <Reveal index={3}>
            <FeedPanel />
          </Reveal>
        </div>
      </div>

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

// ── Fokus-Zeile „Jetzt dran": Name, Kontext, Anrufen (≤150 ms Feedback) ──
function FocusRow({ c, onOpen }: { c: Customer; onOpen: () => void }) {
  const phone = custPhone(c);
  const overdue = !!(c.next_appointment && new Date(c.next_appointment).getTime() < Date.now());
  const detail = overdue
    ? `Rückruf überfällig (${fmtTime(c.next_appointment!)})`
    : isToday(c.next_appointment)
      ? `Termin heute ${fmtTime(c.next_appointment!)}`
      : isToday(c.promised_pay_date)
        ? "Zahlungs-Zusage heute"
        : c.payment_status === "claimed_paid" ? "Zahlung angekündigt — prüfen" : "Offene Zahlung";
  return (
    <div className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-white/50 transition-colors duration-150">
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="min-w-0 text-left flex items-center gap-3 flex-1 active:opacity-70 transition-opacity duration-100">
        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 text-[12px] font-semibold flex items-center justify-center shrink-0">
          {(custName(c).match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase()}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-semibold text-slate-900 truncate">{custName(c)}</span>
          <span className={`text-[11.5px] truncate flex items-center gap-1.5 ${overdue ? "text-slate-600 font-medium" : "text-slate-400"}`}>
            {overdue ? <Clock size={11} strokeWidth={2} /> : <CalendarClock size={11} strokeWidth={1.8} />}
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
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="w-8 h-8 rounded-lg border border-slate-200 bg-white/60 text-slate-400 hover:border-slate-300 hover:text-slate-600 flex items-center justify-center transition-colors duration-150">
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
