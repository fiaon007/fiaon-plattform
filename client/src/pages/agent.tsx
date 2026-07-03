import { useState, useEffect, useCallback, useMemo } from "react";

// ============================================================================
// /agent — Mitarbeiter-Portal (Telefon-Nachfass unbezahlter Kunden)
// - Eigener Login (Rolle "Agent"), sieht NUR pending_payment + claimed_paid
// - Mobile-first Karten + Desktop-Tabelle, Suche, Filter, "Heute fällig"
// - Notizen (append-only), Kontakt-Ergebnisse, Termin/Zusage-Daten
// - Ein-Klick "Zahlungsdaten-Mail" via Make-Webhook (10-Min-Sperre + Countdown)
// - Rechnungs-Download pro Kunde. Siehe MIGRATION_INVENTORY.md
// ============================================================================

interface Customer {
  ref: string;
  type: string;
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
  street?: string | null;
  zip?: string | null;
  city?: string | null;
  last_contact?: { type: string; outcome: string | null; note: string | null; agent_name: string; created_at: string } | null;
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

const OUTCOME_LABELS: Record<string, string> = {
  erreicht_zahlt_gleich: "Erreicht – zahlt gleich",
  erreicht_zahlt_am: "Erreicht – zahlt am …",
  erreicht_abgelehnt: "Erreicht – abgelehnt",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox besprochen",
  rueckruf_termin: "Rückruf vereinbart",
  nummer_falsch: "Nummer falsch",
};

const OUTCOME_STYLE: Record<string, string> = {
  erreicht_zahlt_gleich: "bg-emerald-50 border-emerald-200 text-emerald-700",
  erreicht_zahlt_am: "bg-blue-50 border-blue-200 text-blue-700",
  erreicht_abgelehnt: "bg-rose-50 border-rose-200 text-rose-600",
  nicht_erreicht: "bg-slate-50 border-slate-200 text-slate-600",
  mailbox: "bg-slate-50 border-slate-200 text-slate-600",
  rueckruf_termin: "bg-violet-50 border-violet-200 text-violet-700",
  nummer_falsch: "bg-amber-50 border-amber-200 text-amber-700",
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

function fmtAmount(v: string | null): string {
  const n = Number(v);
  if (!v || isNaN(n)) return "—";
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}

function fmtDT(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

function fmtD(v: string | null): string {
  if (!v) return "—";
  try { return new Date(v).toLocaleDateString("de-DE"); } catch { return "—"; }
}

function isToday(v: string | null | undefined): boolean {
  if (!v) return false;
  const d = new Date(v), n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

type Filter = "alle" | "claimed" | "termin" | "nicht_erreicht";

export default function AgentPortalPage() {
  const [agent, setAgent] = useState<{ name: string; email: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("alle");
  const [message, setMessage] = useState<string | null>(null);

  // Detail
  const [detail, setDetail] = useState<Customer | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState<string | null>(null);
  const [datePick, setDatePick] = useState<{ outcome: string; value: string } | null>(null);
  const [emailLockUntil, setEmailLockUntil] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const flash = (m: string) => { setMessage(m); setTimeout(() => setMessage(null), 4000); };

  // ── Auth ──
  useEffect(() => {
    fetch("/api/fiaon/agent/me", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setAgent(j.agent); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/fiaon/agent/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(loginForm),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setAgent(json.agent);
      else setLoginError(json?.error || "Anmeldung fehlgeschlagen");
    } catch {
      setLoginError("Netzwerkfehler — bitte erneut versuchen");
    } finally {
      setLoggingIn(false);
    }
  };

  const logout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch("/api/fiaon/agent/logout", { method: "POST", credentials: "include" }).catch(() => {});
    setAgent(null);
    setCustomers([]);
    setDetail(null);
  };

  // ── Daten ──
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/fiaon/agent/customers", { credentials: "include" });
      const json = await res.json().catch(() => null);
      setCustomers(res.ok && json?.ok ? json.data : []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (agent) load(); }, [agent, load]);

  const openDetail = async (c: Customer) => {
    setDetail(c);
    setLog([]);
    setNoteText("");
    setDatePick(null);
    try {
      const res = await fetch(`/api/fiaon/agent/customers/${encodeURIComponent(c.ref)}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setDetail(json.data);
        setLog(json.log || []);
      }
    } catch {}
  };

  const saveNote = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!detail || !noteText.trim()) return;
    setNoteSaving(true);
    try {
      const res = await fetch(`/api/fiaon/agent/customers/${encodeURIComponent(detail.ref)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ note: noteText.trim() }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setLog((l) => [json.entry, ...l]);
        setNoteText("");
        flash("✓ Notiz gespeichert");
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setNoteSaving(false);
    }
  };

  const saveOutcome = async (e: React.MouseEvent, outcome: string, dateValue?: string) => {
    e.stopPropagation();
    if (!detail) return;
    // Termin-/Zusage-Optionen brauchen ein Datum → Picker öffnen
    if ((outcome === "rueckruf_termin" || outcome === "erreicht_zahlt_am") && !dateValue) {
      setDatePick({ outcome, value: "" });
      return;
    }
    setOutcomeSaving(outcome);
    try {
      const body: any = { outcome };
      if (outcome === "rueckruf_termin") body.scheduledAt = dateValue;
      if (outcome === "erreicht_zahlt_am") body.promisedDate = dateValue;
      const res = await fetch(`/api/fiaon/agent/customers/${encodeURIComponent(detail.ref)}/contact-result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setLog((l) => [json.entry, ...l]);
        setDatePick(null);
        flash(`✓ ${OUTCOME_LABELS[outcome]} dokumentiert`);
        load();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setOutcomeSaving(null);
    }
  };

  const sendPaymentEmail = async (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/fiaon/agent/customers/${encodeURIComponent(c.ref)}/send-payment-email`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        setEmailLockUntil((m) => ({ ...m, [c.ref]: new Date(json.lockedUntil).getTime() }));
        setLog((l) => [{ id: Date.now(), type: "email_sent", outcome: null, note: "Zahlungsdaten-Mail ausgelöst", agent_name: agent?.name || "", scheduled_at: null, promised_date: null, created_at: new Date().toISOString() }, ...l]);
        flash("✓ Zahlungsdaten-Mail wird versendet (via Make)");
      } else if (res.status === 429 && json?.lockedUntil) {
        setEmailLockUntil((m) => ({ ...m, [c.ref]: new Date(json.lockedUntil).getTime() }));
        flash("E-Mail wurde vor Kurzem gesendet — Sperre aktiv");
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    }
  };

  const emailLockSeconds = (c: Customer): number => {
    const local = emailLockUntil[c.ref];
    const fromServer = c.agent_email_sent_at ? new Date(c.agent_email_sent_at).getTime() + 10 * 60 * 1000 : 0;
    const until = Math.max(local || 0, fromServer);
    return Math.max(0, Math.ceil((until - nowTick) / 1000));
  };

  // ── Filter + "Heute fällig" ──
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

  // ═══════════════ Login-Screen ═══════════════
  if (!authChecked) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400 text-sm">Lädt…</div>;
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-2xl font-bold text-[#2563eb] mb-1">FIAON</p>
            <h1 className="text-lg font-bold text-slate-900">Mitarbeiter-Portal</h1>
            <p className="text-[13px] text-slate-500 mt-1">Anmeldung nur für autorisierte Mitarbeiter</p>
          </div>
          <form onSubmit={login} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">E-Mail</label>
              <input
                type="email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((f) => ({ ...f, email: e.target.value }))}
                autoComplete="username"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[15px]"
                style={{ minHeight: 48 }}
              />
            </div>
            <div>
              <label className="block text-[12px] font-bold text-slate-600 mb-1.5">Passwort</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) => setLoginForm((f) => ({ ...f, password: e.target.value }))}
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[15px]"
                style={{ minHeight: 48 }}
              />
            </div>
            {loginError && <p className="text-[13px] font-semibold text-rose-600">{loginError}</p>}
            <button
              type="submit"
              disabled={loggingIn}
              className="w-full py-3.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-[15px] transition-all disabled:opacity-50"
              style={{ minHeight: 52 }}
            >
              {loggingIn ? "Anmelden…" : "Anmelden"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ═══════════════ Portal ═══════════════
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-100 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-bold text-[#2563eb] leading-none">FIAON <span className="text-slate-400 font-semibold text-[11px] uppercase tracking-wider">Mitarbeiter</span></p>
            <p className="text-[11px] text-slate-400 mt-0.5">{agent.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); load(); }}
              className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-[12px] font-bold text-slate-600 transition-colors"
            >
              ↻ Aktualisieren
            </button>
            <button
              type="button"
              onClick={logout}
              className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-[12px] font-bold text-slate-500 hover:border-slate-300 transition-colors"
            >
              Abmelden
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-4">
        {message && (
          <div className="mb-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] font-semibold text-blue-800">
            {message}
          </div>
        )}

        {/* Heute fällig */}
        {dueToday.length > 0 && (
          <div className="mb-4 bg-violet-50 border border-violet-200 rounded-2xl p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600 mb-2">📅 Heute fällig ({dueToday.length})</p>
            <div className="flex flex-wrap gap-2">
              {dueToday.map((c) => (
                <button
                  key={c.ref}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); openDetail(c); }}
                  className="px-3 py-2 rounded-xl bg-white border border-violet-200 text-[12px] font-bold text-violet-700 hover:border-violet-300 transition-colors"
                >
                  {custName(c)}
                  {isToday(c.next_appointment) && ` · Termin ${fmtDT(c.next_appointment!)}`}
                  {!isToday(c.next_appointment) && isToday(c.promised_pay_date) && " · Zahlungs-Zusage heute"}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Suche + Filter */}
        <div className="mb-4 space-y-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche: Name, E-Mail, Referenz…"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[14px]"
            style={{ minHeight: 48 }}
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
                className={`px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all ${
                  filter === f.key ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/25" : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <p className="py-12 text-center text-[13px] text-slate-400">Lädt Kundenliste…</p>}
        {!loading && filtered.length === 0 && (
          <p className="py-12 text-center text-[13px] text-slate-400">
            {search || filter !== "alle" ? "Keine Treffer." : "Aktuell keine unbezahlten Kunden — starke Arbeit! 🎉"}
          </p>
        )}

        {/* ── Mobile: Karten ── */}
        <div className="space-y-3 md:hidden">
          {filtered.map((c) => {
            const phone = custPhone(c);
            return (
              <div
                key={c.ref}
                onClick={() => openDetail(c)}
                className={`bg-white border rounded-2xl p-4 cursor-pointer transition-all active:scale-[0.99] ${
                  c.payment_status === "claimed_paid" ? "border-amber-300 shadow-[0_2px_12px_rgba(245,158,11,.12)]" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-bold text-slate-900 truncate">{custName(c)}</p>
                    <p className="text-[12px] text-slate-400 truncate">{c.email || "—"}</p>
                  </div>
                  <span className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                    c.payment_status === "claimed_paid" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                  }`}>
                    {c.payment_status === "claimed_paid" ? "Angekündigt" : "Offen"}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[12px] text-slate-500 mb-3 flex-wrap">
                  <span className="font-bold text-slate-800">{fmtAmount(c.amount_due)}</span>
                  <span>{(c.pack_name || "—").replace(/\n/g, " ")}</span>
                  {c.next_appointment && <span className="text-violet-600 font-bold">📅 {fmtDT(c.next_appointment)}</span>}
                  {c.promised_pay_date && <span className="text-blue-600 font-bold">Zusage: {fmtD(c.promised_pay_date)}</span>}
                </div>
                {c.last_contact && (
                  <p className="text-[11px] text-slate-400 mb-3 truncate">
                    Zuletzt: {c.last_contact.type === "note" ? "Notiz" : OUTCOME_LABELS[c.last_contact.outcome || ""] || c.last_contact.type} · {c.last_contact.agent_name} · {fmtDT(c.last_contact.created_at)}
                  </p>
                )}
                <div className="flex gap-2">
                  {phone ? (
                    <a
                      href={`tel:${phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 text-center py-3 rounded-xl bg-[#2563eb] text-white font-bold text-[14px] active:bg-blue-700"
                      style={{ minHeight: 48 }}
                    >
                      📞 Anrufen
                    </a>
                  ) : (
                    <span className="flex-1 text-center py-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-[13px]">Keine Nummer</span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openDetail(c); }}
                    className="px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 font-bold text-[13px]"
                    style={{ minHeight: 48 }}
                  >
                    Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Desktop: Tabelle ── */}
        <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                {["Name", "E-Mail", "Telefon", "Paket", "Betrag", "Status", "Zuletzt", "Aktion"].map((h) => (
                  <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const phone = custPhone(c);
                return (
                  <tr
                    key={c.ref}
                    onClick={() => openDetail(c)}
                    className={`border-b border-slate-50 cursor-pointer transition-colors ${
                      c.payment_status === "claimed_paid" ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-slate-50/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-bold">{custName(c)}</p>
                      <p className="text-[11px] font-mono text-slate-400">{c.payment_reference || c.ref}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-600 font-semibold whitespace-nowrap">{phone || "—"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{(c.pack_name || "—").replace(/\n/g, " ")}</td>
                    <td className="px-4 py-3 text-[13px] font-bold whitespace-nowrap">{fmtAmount(c.amount_due)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${
                        c.payment_status === "claimed_paid" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {c.payment_status === "claimed_paid" ? "Zahlung angekündigt" : "Offen"}
                      </span>
                      {c.next_appointment && <p className="text-[10px] text-violet-600 font-bold mt-1">📅 {fmtDT(c.next_appointment)}</p>}
                      {c.promised_pay_date && <p className="text-[10px] text-blue-600 font-bold mt-1">Zusage: {fmtD(c.promised_pay_date)}</p>}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-400 max-w-[180px]">
                      {c.last_contact
                        ? `${c.last_contact.type === "note" ? "Notiz" : OUTCOME_LABELS[c.last_contact.outcome || ""] || "—"} · ${fmtDT(c.last_contact.created_at)}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {phone && (
                          <a
                            href={`tel:${phone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-[12px] font-bold whitespace-nowrap transition-colors"
                          >
                            📞 Anrufen
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); openDetail(c); }}
                          className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-slate-300 text-[12px] font-bold transition-colors"
                        >
                          Details
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══════════════ Detail-Sheet ═══════════════ */}
      {detail && (
        <div className="fixed inset-0 z-50" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          <div
            className="absolute inset-x-0 bottom-0 max-h-[92vh] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[520px] bg-white rounded-t-3xl md:rounded-none shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
              <div className="min-w-0">
                <p className="text-[16px] font-bold text-slate-900 truncate">{custName(detail)}</p>
                <p className="font-mono text-[11px] text-slate-400">{detail.payment_reference || detail.ref}{detail.invoice_number ? ` · ${detail.invoice_number}` : ""}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDetail(null); }}
                className="w-10 h-10 shrink-0 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Kundendaten — ALLES für die Durchgabe */}
              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Status</p>
                  <p className={`font-bold ${detail.payment_status === "claimed_paid" ? "text-amber-600" : "text-slate-700"}`}>
                    {detail.payment_status === "claimed_paid" ? `Zahlung angekündigt (${fmtDT(detail.claimed_paid_at)})` : "Offen — keine Reaktion"}
                  </p>
                </div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Betrag</p><p className="font-bold">{fmtAmount(detail.amount_due)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">E-Mail</p><p className="font-semibold break-all">{detail.email || "—"}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Telefon</p><p className="font-semibold">{custPhone(detail) || "—"}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Paket</p><p className="font-semibold">{(detail.pack_name || "—").replace(/\n/g, " ")}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Antrag vom</p><p className="font-semibold">{fmtD(detail.created_at)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Zahlungsreferenz</p><p className="font-mono font-semibold">{detail.payment_reference || "—"}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Fällig bis</p><p className="font-semibold">{fmtD(detail.payment_due_date)}</p></div>
                {(detail.street || detail.city) && (
                  <div className="col-span-2"><p className="text-[10px] uppercase font-bold text-slate-400">Adresse</p>
                    <p className="font-semibold">{[detail.street, [detail.zip, detail.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</p>
                  </div>
                )}
              </div>

              {/* Aktionen */}
              <div className="grid grid-cols-2 gap-2">
                {custPhone(detail) && (
                  <a
                    href={`tel:${custPhone(detail)}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-center py-3 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white font-bold text-[14px] transition-colors"
                    style={{ minHeight: 48 }}
                  >
                    📞 Anrufen
                  </a>
                )}
                <a
                  href={`/api/fiaon/agent/customers/${encodeURIComponent(detail.ref)}/invoice.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-center py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-slate-300 font-bold text-[14px] transition-colors"
                  style={{ minHeight: 48 }}
                >
                  🧾 Rechnung (PDF)
                </a>
                {(() => {
                  const lock = emailLockSeconds(detail);
                  return (
                    <button
                      type="button"
                      onClick={(e) => sendPaymentEmail(e, detail)}
                      disabled={lock > 0}
                      className="col-span-2 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[14px] transition-colors disabled:opacity-50 disabled:bg-slate-400"
                      style={{ minHeight: 52 }}
                    >
                      {lock > 0
                        ? `✉️ Gesendet — erneut in ${Math.floor(lock / 60)}:${String(lock % 60).padStart(2, "0")}`
                        : "✉️ Zahlungsdaten-Mail senden („wie soeben besprochen…\u201c)"}
                    </button>
                  );
                })()}
              </div>

              {/* Kontakt-Ergebnis */}
              <div>
                <h3 className="text-[13px] font-bold text-slate-900 mb-2">Kontakt-Ergebnis dokumentieren</h3>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={(e) => saveOutcome(e, key)}
                      disabled={outcomeSaving !== null}
                      className={`px-3 py-2.5 rounded-xl border text-[12px] font-bold transition-all disabled:opacity-50 ${OUTCOME_STYLE[key]} hover:brightness-95`}
                      style={{ minHeight: 44 }}
                    >
                      {outcomeSaving === key ? "…" : label}
                    </button>
                  ))}
                </div>
                {datePick && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <p className="text-[12px] font-bold text-slate-700 mb-2">
                      {datePick.outcome === "rueckruf_termin" ? "Rückruf-Termin wählen:" : "Kunde zahlt am:"}
                    </p>
                    <div className="flex gap-2">
                      <input
                        type={datePick.outcome === "rueckruf_termin" ? "datetime-local" : "date"}
                        value={datePick.value}
                        onChange={(e) => setDatePick((d) => (d ? { ...d, value: e.target.value } : d))}
                        className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-[14px] bg-white focus:border-[#2563eb] outline-none"
                        style={{ minHeight: 44 }}
                      />
                      <button
                        type="button"
                        onClick={(e) => datePick.value && saveOutcome(e, datePick.outcome, datePick.value)}
                        disabled={!datePick.value || outcomeSaving !== null}
                        className="px-4 py-2.5 rounded-xl bg-[#2563eb] text-white text-[13px] font-bold disabled:opacity-40"
                      >
                        Speichern
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Notizen */}
              <div>
                <h3 className="text-[13px] font-bold text-slate-900 mb-2">Notizen</h3>
                <div className="flex gap-2 mb-3">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Neue Notiz… (nach dem Speichern nicht mehr änderbar)"
                    rows={2}
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-[14px] focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none resize-none"
                  />
                  <button
                    type="button"
                    onClick={saveNote}
                    disabled={noteSaving || !noteText.trim()}
                    className="px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold transition-colors disabled:opacity-40"
                  >
                    {noteSaving ? "…" : "Speichern"}
                  </button>
                </div>

                {/* Historie (chronologisch, neueste oben) */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto">
                  {log.length === 0 && <p className="text-[12px] text-slate-400">Noch keine Einträge.</p>}
                  {log.map((l) => (
                    <div key={l.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className={`text-[11px] font-bold ${
                          l.type === "note" ? "text-slate-600" : l.type === "email_sent" ? "text-emerald-600" : "text-[#2563eb]"
                        }`}>
                          {l.type === "note" ? "📝 Notiz" : l.type === "email_sent" ? "✉️ Zahlungsdaten-Mail" : `📞 ${OUTCOME_LABELS[l.outcome || ""] || l.outcome}`}
                        </span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{l.agent_name} · {fmtDT(l.created_at)}</span>
                      </div>
                      {l.scheduled_at && <p className="text-[12px] font-bold text-violet-600">Termin: {fmtDT(l.scheduled_at)}</p>}
                      {l.promised_date && <p className="text-[12px] font-bold text-blue-600">Zahlt am: {fmtD(l.promised_date)}</p>}
                      {l.note && <p className="text-[12px] text-slate-600 whitespace-pre-wrap">{l.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
