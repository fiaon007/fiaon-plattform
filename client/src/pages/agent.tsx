import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { Phone, FileText, Mail, X, ChevronDown, ChevronRight, Lock, CalendarClock } from "lucide-react";
import {
  AgentShell, Badge, Card, KpiCard, ProgressBar, FlashMessage, Avatar,
  api, fmtCents, fmtEur, fmtD, fmtDT, isToday, inputCls, btnPrimary, btnGhost, ACCENT,
} from "./agent/shared";

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
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <a href="/" className="text-xl font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</a>
          <h1 className="text-[15px] font-semibold text-slate-900 mt-1">Mitarbeiter-Portal</h1>
          <p className="text-[12px] text-slate-400 mt-1">Anmeldung nur für autorisierte Mitarbeiter</p>
        </div>
        <Card className="p-6">
          {forgotMode ? (
            <form onSubmit={forgot} className="space-y-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">E-Mail</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputCls} autoComplete="username" />
              </div>
              {info && <p className="text-[12px] text-slate-500 border border-slate-200 rounded-lg px-3 py-2">{info}</p>}
              <button type="submit" disabled={busy || !form.email} className={`${btnPrimary} w-full py-3`}>
                {busy ? "Sende …" : "Reset-Link anfordern"}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(false); setInfo(null); }} className="w-full text-[12px] text-slate-400 hover:text-slate-600">
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
              {error && <p className="text-[12px] font-medium text-slate-700 border border-slate-300 rounded-lg px-3 py-2">{error}</p>}
              <button type="submit" disabled={busy} className={`${btnPrimary} w-full py-3`} style={{ minHeight: 48 }}>
                {busy ? "Anmelden …" : "Anmelden"}
              </button>
              <button type="button" onClick={(e) => { e.stopPropagation(); setForgotMode(true); }} className="w-full text-[12px] text-slate-400 hover:text-slate-600">
                Passwort vergessen?
              </button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════ Dashboard ═══════════════

function Dashboard() {
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

  return (
    <div>
      <FlashMessage message={message} />

      {/* ── G4: Verdienst-Kennzahlen ── */}
      {earnings && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <KpiCard label="Potenziell diesen Monat" value={fmtCents(earnings.potentialCents)} sub={`${earnings.potentialCount} offene Kunden · Satz ${(earnings.rateBp / 100).toLocaleString("de-DE")} %`} />
            <KpiCard label="Bestätigt (dein Guthaben)" value={fmtCents(earnings.confirmedCents)} sub="noch nicht ausgezahlt" />
            <KpiCard label="In Auszahlung" value={fmtCents(earnings.inPayoutCents)} sub="Anforderung läuft" />
            <KpiCard label="Insgesamt ausgezahlt" value={fmtCents(earnings.paidOutCents)} sub="seit Beginn" />
          </div>
          {earnings.monthlyGoalCents != null && earnings.monthlyGoalCents > 0 && (
            <Card className="px-4 py-3 mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Monatsziel</p>
                <p className="text-[12px] text-slate-500 tabular-nums">
                  {fmtCents(earnings.monthCents)} / {fmtCents(earnings.monthlyGoalCents)}
                </p>
              </div>
              <ProgressBar value={earnings.monthCents} max={earnings.monthlyGoalCents} />
            </Card>
          )}
        </>
      )}

      {/* ── Heute fällig ── */}
      {dueToday.length > 0 && (
        <Card className="p-4 mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2.5 flex items-center gap-1.5">
            <CalendarClock size={13} strokeWidth={1.8} /> Heute fällig ({dueToday.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {dueToday.map((c) => (
              <button
                key={c.ref}
                type="button"
                onClick={(e) => { e.stopPropagation(); setDetailRef(c.ref); }}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:border-slate-400 transition-colors"
              >
                {custName(c)}
                {isToday(c.next_appointment) && <span className="text-slate-400"> · Termin {fmtDT(c.next_appointment!)}</span>}
                {!isToday(c.next_appointment) && isToday(c.promised_pay_date) && <span className="text-slate-400"> · Zusage heute</span>}
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* ── Suche + Filter ── */}
      <div className="mb-4 space-y-2.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Suche: Name, E-Mail, Referenz …"
          className={inputCls}
          style={{ minHeight: 46, maxWidth: 420 }}
        />
        <div className="flex flex-wrap gap-2">
          {([
            { key: "alle", label: `Alle offenen (${customers.length})` },
            { key: "claimed", label: `Zahlung angekündigt (${customers.filter((c) => c.payment_status === "claimed_paid").length})` },
            { key: "termin", label: "Termin vereinbart" },
            { key: "nicht_erreicht", label: "Nicht erreicht" },
          ] as const).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setFilter(f.key); }}
              className={`px-3.5 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${
                filter === f.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="py-14 text-center text-[13px] text-slate-400">Lädt Kundenliste …</p>}
      {!loading && filtered.length === 0 && (
        <p className="py-14 text-center text-[13px] text-slate-400">
          {search || filter !== "alle" ? "Keine Treffer." : "Aktuell keine unbezahlten Kunden in deiner Liste."}
        </p>
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

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/30" />
      <div
        className="absolute inset-x-0 bottom-0 max-h-[92vh] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[500px] bg-white md:border-l border-slate-200 rounded-t-2xl md:rounded-none shadow-xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3.5 flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-slate-900 truncate">{custName(detail)}</p>
            <p className="font-mono text-[11px] text-slate-400">
              {detail.payment_reference || detail.ref}
              {detail.invoice_number ? ` · ${detail.invoice_number}` : ""}
            </p>
          </div>
          <button type="button" onClick={(e) => { e.stopPropagation(); onClose(); }} className="w-9 h-9 shrink-0 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {readOnly && (
            <div className="px-3.5 py-2.5 rounded-lg border border-slate-300 bg-slate-50 text-[12px] font-medium text-slate-600 flex items-center gap-2">
              <Lock size={13} strokeWidth={1.8} />
              {detail.assigned_agent_name
                ? `Betreut von ${detail.assigned_agent_name} — nur Lesezugriff`
                : `In Bearbeitung durch ${detail.locked_by_name} — nur Lesezugriff`}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={detail.payment_status} />
            {detail.promised_pay_date && <Badge label={`Zusage ${fmtD(detail.promised_pay_date)}`} />}
            {detail.assigned_agent_name && !readOnly && <Badge label={`Betreut von ${detail.assigned_agent_name}`} />}
          </div>

          {/* Stammdaten */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
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

          {/* Aktionen */}
          <div className="grid grid-cols-2 gap-2">
            {phone && (
              <a href={`tel:${phone}`} onClick={(e) => e.stopPropagation()} className={`${btnPrimary} text-center py-3 inline-flex items-center justify-center gap-2`} style={{ minHeight: 46 }}>
                <Phone size={14} strokeWidth={2} /> Anrufen
              </a>
            )}
            <a
              href={`/api/fiaon/agent/customers/${encodeURIComponent(refId)}/invoice.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={`${btnGhost} text-center py-3 inline-flex items-center justify-center gap-2`}
              style={{ minHeight: 46 }}
            >
              <FileText size={14} strokeWidth={1.8} /> Rechnung (PDF)
            </a>
            {!readOnly && (
              <button
                type="button"
                onClick={sendEmail}
                disabled={lockSec > 0 || busy === "email"}
                className={`${btnGhost} col-span-2 py-3 inline-flex items-center justify-center gap-2`}
                style={{ minHeight: 48 }}
              >
                <Mail size={14} strokeWidth={1.8} />
                {lockSec > 0
                  ? `Gesendet — erneut in ${Math.floor(lockSec / 60)}:${String(lockSec % 60).padStart(2, "0")}`
                  : "Zahlungsdaten-E-Mail senden"}
              </button>
            )}
          </div>

          {/* I2: Gesprächsleitfaden (Kontext-Panel) */}
          {scripts.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setScriptsOpen((v) => !v); }}
                className="w-full px-4 py-3 flex items-center justify-between text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="flex items-center gap-2"><FileText size={14} strokeWidth={1.8} /> Gesprächsleitfaden ({scripts.length})</span>
                <ChevronDown size={15} className={`text-slate-400 transition-transform ${scriptsOpen ? "" : "-rotate-90"}`} />
              </button>
              {scriptsOpen && (
                <div className="border-t border-slate-100 divide-y divide-slate-50">
                  {scripts.map((s) => (
                    <div key={s.id} className="px-4 py-3">
                      <p className="text-[12px] font-semibold text-slate-800 mb-1">{s.title}</p>
                      {s.content_html && (
                        <div className="text-[12px] text-slate-600 leading-relaxed prose-sm max-w-none [&_ul]:list-disc [&_ul]:pl-4 [&_b]:font-semibold" dangerouslySetInnerHTML={{ __html: s.content_html }} />
                      )}
                      {s.file_name && (
                        <a
                          href={`/api/fiaon/agent/scripts/${s.id}/file`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[12px] font-semibold hover:underline"
                          style={{ color: ACCENT }}
                        >
                          PDF öffnen: {s.file_name}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Kontakt-Ergebnis */}
          {!readOnly && (
            <div>
              <h3 className="text-[13px] font-semibold text-slate-900 mb-2">Kontakt-Ergebnis dokumentieren</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={(e) => saveOutcome(e, key)}
                    disabled={busy !== null}
                    className="px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-800 transition-colors disabled:opacity-40 text-left"
                    style={{ minHeight: 44 }}
                  >
                    {busy === key ? "…" : label}
                  </button>
                ))}
              </div>
              {datePick && (
                <div className="mt-3 p-3.5 rounded-xl border border-slate-200 bg-slate-50">
                  <p className="text-[12px] font-semibold text-slate-700 mb-2">
                    {datePick.outcome === "rueckruf_termin" ? "Rückruf-Termin wählen" : "Kunde zahlt am"}
                  </p>
                  <div className="flex gap-2">
                    <input
                      type={datePick.outcome === "rueckruf_termin" ? "datetime-local" : "date"}
                      value={datePick.value}
                      onChange={(e) => setDatePick((d) => (d ? { ...d, value: e.target.value } : d))}
                      className={inputCls}
                      style={{ minHeight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={(e) => datePick.value && saveOutcome(e, datePick.outcome, datePick.value)}
                      disabled={!datePick.value || busy !== null}
                      className={btnPrimary}
                    >
                      Speichern
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notizen + Historie */}
          <div>
            <h3 className="text-[13px] font-semibold text-slate-900 mb-2">Notizen &amp; Verlauf</h3>
            {!readOnly && (
              <div className="flex gap-2 mb-3">
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Neue Notiz … (nach dem Speichern nicht mehr änderbar)"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
                <button type="button" onClick={saveNote} disabled={busy !== null || !noteText.trim()} className={btnPrimary}>
                  {busy === "note" ? "…" : "Speichern"}
                </button>
              </div>
            )}
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {log.length === 0 && <p className="text-[12px] text-slate-400">Noch keine Einträge.</p>}
              {log.map((l) => (
                <div key={l.id} className="p-3 rounded-lg border border-slate-100 bg-slate-50/60">
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
              ))}
            </div>
          </div>
        </div>
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
