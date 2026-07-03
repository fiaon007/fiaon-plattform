import { useState, useEffect, useCallback } from "react";

// ============================================================================
// /admin/zahlungen — Zahlungszentrale (Vorkasse per Banküberweisung)
// - 4 Kennzahl-Kacheln, „Zahlung angekündigt" = Arbeitsliste (hervorgehoben)
// - Filter-Chips Alle/Offen/Angekündigt/Bezahlt/Abgelaufen, claimed_paid zuerst
// - Detail-Drawer mit Ereignis-Timeline + Rechnungs-Download
// - Duplikat-Altbestand: sichere Massen-Bereinigung (Soft-Delete)
// - Mitarbeiter-Zugänge (Agent-Portal /agent) + Audit-Trail
// Siehe MIGRATION_INVENTORY.md
// ============================================================================

interface PaymentRow {
  ref: string;
  type: string;
  payment_reference: string;
  payment_status: string;
  payment_due_date: string | null;
  amount_due: string | null;
  currency: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  contact_email: string | null;
  billing_email: string | null;
  phone: string | null;
  phone_country_code: string | null;
  contact_phone: string | null;
  pack_name: string | null;
  created_at: string;
  claimed_paid_at: string | null;
  promised_pay_date: string | null;
  invoice_number: string | null;
}

interface PaymentStats {
  pending: { count: number; sum: number };
  claimed: { count: number; sum: number };
  paid: { count: number; sum: number };
  confirmationRate: number | null;
}

interface TimelineEvent { at: string; label: string; type: string; meta?: string }
interface AgentRow { id: number; name: string; email: string; active: boolean; created_at: string }
interface DupPreview { groups: number; mergeable: number }

function customerName(r: PaymentRow): string {
  if (r.company_name) return r.company_name;
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
  return name || r.contact_name || "—";
}

function customerEmail(r: PaymentRow): string {
  return r.email || r.contact_email || r.billing_email || "—";
}

function customerPhone(r: PaymentRow): string {
  if (r.phone) return `${r.phone_country_code || ""} ${r.phone}`.trim();
  return r.contact_phone || "—";
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function fmtDateTime(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function fmtAmount(v: string | null): string {
  const n = Number(v);
  if (!v || isNaN(n)) return "—";
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending_payment: { label: "Offen", cls: "bg-slate-100 text-slate-600" },
  claimed_paid: { label: "Zahlung angekündigt", cls: "bg-amber-100 text-amber-700" },
  paid: { label: "Bezahlt", cls: "bg-emerald-100 text-emerald-700" },
  expired: { label: "Abgelaufen", cls: "bg-rose-100 text-rose-600" },
};

function StatusBadge({ status }: { status: string }) {
  const b = STATUS_BADGE[status] || { label: status, cls: "bg-slate-100 text-slate-500" };
  return <span className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${b.cls}`}>{b.label}</span>;
}

type TabKey = "alle" | "pending_payment" | "claimed_paid" | "paid" | "expired";
const STATUS_ORDER: Record<string, number> = { claimed_paid: 0, pending_payment: 1, expired: 2, paid: 3 };

export default function AdminZahlungenPage() {
  const [tab, setTab] = useState<TabKey>("claimed_paid");
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionRef, setActionRef] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reminderRunning, setReminderRunning] = useState(false);

  // Detail-Drawer
  const [detail, setDetail] = useState<PaymentRow | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[] | null>(null);

  // Duplikat-Bereinigung
  const [dup, setDup] = useState<DupPreview | null>(null);
  const [dupRunning, setDupRunning] = useState(false);

  // Mitarbeiter-Verwaltung
  const [agents, setAgents] = useState<AgentRow[]>([]);
  const [agentForm, setAgentForm] = useState({ name: "", email: "", password: "" });
  const [agentSaving, setAgentSaving] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<any[]>([]);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/payments/stats`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setStats(json);
    } catch {}
  }, []);

  const load = useCallback(async (status: TabKey) => {
    setLoading(true);
    try {
      const statuses = status === "alle" ? (["claimed_paid", "pending_payment", "expired", "paid"] as const) : ([status] as const);
      const results = await Promise.all(
        statuses.map((s) =>
          fetch(`/api/fiaon/admin/payments?status=${s}`, { credentials: "include" })
            .then((r) => r.json())
            .catch(() => null),
        ),
      );
      const all: PaymentRow[] = results.flatMap((j) => (j?.ok ? j.data : []));
      // Priorität: Angekündigt zuerst (älteste Ankündigung oben — warten am längsten auf Freischaltung)
      all.sort((a, b) => {
        const so = (STATUS_ORDER[a.payment_status] ?? 9) - (STATUS_ORDER[b.payment_status] ?? 9);
        if (so !== 0) return so;
        if (a.payment_status === "claimed_paid") {
          return new Date(a.claimed_paid_at || 0).getTime() - new Date(b.claimed_paid_at || 0).getTime();
        }
        return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
      setRows(all);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDup = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/duplicates/preview`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setDup(json);
    } catch {}
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const res = await fetch(`/api/fiaon/admin/agents`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) setAgents(json.data);
    } catch {}
  }, []);

  useEffect(() => {
    load(tab);
    loadStats();
  }, [tab, load, loadStats]);

  useEffect(() => {
    loadDup();
    loadAgents();
  }, [loadDup, loadAgents]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 5000);
  };

  const openDetail = async (r: PaymentRow) => {
    setDetail(r);
    setTimeline(null);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(r.payment_reference)}/timeline`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      setTimeline(res.ok && json?.ok ? json.events : []);
    } catch {
      setTimeline([]);
    }
  };

  const runDupCleanup = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dup) return;
    if (!confirm(
      `Duplikat-Bereinigung starten?\n\n${dup.groups} Gruppen · ${dup.mergeable} überflüssige Alt-Einträge werden als „merged" markiert (Soft-Delete, KEIN Löschen).\n\nPro E-Mail bleibt der vollständigste/neueste Antrag erhalten. Bezahlte/offene Zahlungen sind geschützt.`,
    )) return;
    setDupRunning(true);
    try {
      const res = await fetch(`/api/fiaon/admin/duplicates/cleanup-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmed: true }),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ Bereinigung: ${json.groupsProcessed} Gruppen verarbeitet, ${json.merged} Einträge zusammengeführt (Soft-Delete)${json.skippedProtected ? `, ${json.skippedProtected} geschützt übersprungen` : ""}`);
        loadDup();
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setDupRunning(false);
    }
  };

  const createAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!agentForm.name || !agentForm.email || agentForm.password.length < 8) {
      flash("Name, E-Mail und Passwort (min. 8 Zeichen) erforderlich");
      return;
    }
    setAgentSaving(true);
    try {
      const res = await fetch(`/api/fiaon/admin/agents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(agentForm),
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ Zugang angelegt: ${json.agent.email} — Login unter /agent`);
        setAgentForm({ name: "", email: "", password: "" });
        loadAgents();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setAgentSaving(false);
    }
  };

  const toggleAgent = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    const res = await fetch(`/api/fiaon/admin/agents/${id}/toggle`, { method: "POST", credentials: "include" });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok) {
      flash(`✓ ${json.agent.email} ${json.agent.active ? "aktiviert" : "deaktiviert"}`);
      loadAgents();
    }
  };

  const resetAgentPw = async (e: React.MouseEvent, id: number, email: string) => {
    e.stopPropagation();
    const pw = prompt(`Neues Passwort für ${email} (min. 8 Zeichen):`);
    if (!pw) return;
    const res = await fetch(`/api/fiaon/admin/agents/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: pw }),
    });
    const json = await res.json().catch(() => null);
    flash(res.ok && json?.ok ? `✓ Passwort für ${email} gesetzt` : `Fehler: ${json?.error || res.status}`);
  };

  const openAudit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditOpen((v) => !v);
    if (!auditOpen) {
      const res = await fetch(`/api/fiaon/admin/agent-log`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      setAudit(res.ok && json?.ok ? json.data : []);
    }
  };

  const markPaid = async (e: React.MouseEvent, paymentRef: string) => {
    e.stopPropagation();
    if (!confirm(`Zahlung ${paymentRef} wirklich als bezahlt markieren?\n\nDer Kundenzugang wird freigeschaltet und die Willkommens-E-Mail versendet.`)) return;
    setActionRef(paymentRef);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(paymentRef)}/mark-paid`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ ${paymentRef} als bezahlt markiert — Zugang freigeschaltet, Willkommensmail versendet`);
        setDetail(null);
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setActionRef(null);
    }
  };

  const reactivate = async (e: React.MouseEvent, paymentRef: string) => {
    e.stopPropagation();
    if (!confirm(`Bestellung ${paymentRef} reaktivieren?\n\nNeue 7-Tage-Frist, Zahlungs-E-Mail wird erneut versendet.`)) return;
    setActionRef(paymentRef);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/${encodeURIComponent(paymentRef)}/reactivate`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ ${paymentRef} reaktiviert — neue Frist, Zahlungsinfos erneut versendet`);
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setActionRef(null);
    }
  };

  const runReminders = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setReminderRunning(true);
    try {
      const res = await fetch(`/api/fiaon/admin/payments/run-reminders`, { method: "POST", credentials: "include" });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.ok) {
        flash(`✓ Lauf abgeschlossen: ${json.followupsSent}× Follow-up-Webhook (48h), ${json.expired}× abgelaufen`);
        load(tab);
        loadStats();
      } else {
        flash(`Fehler: ${json?.error || res.status}`);
      }
    } catch {
      flash("Netzwerkfehler");
    } finally {
      setReminderRunning(false);
    }
  };

  const q = search.trim().toUpperCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          (r.payment_reference || "").toUpperCase().includes(q) ||
          (r.ref || "").toUpperCase().includes(q) ||
          customerName(r).toUpperCase().includes(q) ||
          customerEmail(r).toUpperCase().includes(q),
      )
    : rows;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2563eb] mb-1">Admin</p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Zahlungen (Banküberweisung)</h1>
            <p className="text-[13px] text-slate-500 mt-1">
              Manuelle Freischaltung nach Zahlungseingang — Abgleich per Verwendungszweck mit dem Kontoauszug.
            </p>
          </div>
          <button
            type="button"
            onClick={runReminders}
            disabled={reminderRunning}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-[13px] font-semibold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {reminderRunning ? "Läuft…" : "Follow-up-Lauf jetzt starten"}
          </button>
        </div>

        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] font-semibold text-blue-800">
            {message}
          </div>
        )}

        {/* ── C1: Vier Kennzahl-Kacheln ── */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Offen — keine Reaktion</p>
              <p className="text-xl font-bold text-slate-900">{stats.pending.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
              <p className="text-[11px] text-slate-400">{stats.pending.count} Bestellungen</p>
            </div>
            {/* Arbeitsliste — visuell hervorgehoben */}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setTab("claimed_paid"); }}
              className="text-left bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-[0_4px_16px_rgba(245,158,11,.15)] hover:border-amber-400 transition-colors"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">⚡ Zahlung angekündigt</p>
              <p className="text-xl font-bold text-amber-700">{stats.claimed.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
              <p className="text-[11px] text-amber-600/80 font-semibold">{stats.claimed.count} warten auf Freischaltung — deine Arbeitsliste</p>
            </button>
            <div className="bg-white border border-emerald-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">Bestätigt bezahlt</p>
              <p className="text-xl font-bold text-emerald-600">{stats.paid.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
              <p className="text-[11px] text-slate-400">{stats.paid.count} bezahlt</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bestätigungsquote</p>
              <p className="text-xl font-bold text-slate-900">{stats.confirmationRate === null ? "—" : `${stats.confirmationRate} %`}</p>
              <p className="text-[11px] text-slate-400">bezahlt / Zahlung angekündigt</p>
            </div>
          </div>
        )}

        {/* ── C2: Filter-Chips ── */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { key: "alle", label: "Alle" },
              { key: "pending_payment", label: `Offen${stats ? ` (${stats.pending.count})` : ""}` },
              { key: "claimed_paid", label: `Angekündigt${stats ? ` (${stats.claimed.count})` : ""}` },
              { key: "paid", label: `Bezahlt${stats ? ` (${stats.paid.count})` : ""}` },
              { key: "expired", label: "Abgelaufen" },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setTab(t.key);
              }}
              className={`px-4 py-2 rounded-xl text-[13px] font-bold transition-all ${
                tab === t.key
                  ? "bg-[#2563eb] text-white shadow-md shadow-blue-500/25"
                  : "bg-white border border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Suchfeld */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Suche nach Referenz, Name oder E-Mail…"
            className="w-full sm:max-w-md px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[14px]"
          />
        </div>

        {/* ── C2: Tabelle ── */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Referenz", "Name", "E-Mail", "Telefon", "Paket", "Betrag", "Status", "Angekündigt am", "Aktionen"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-slate-400">
                      Lädt…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[13px] text-slate-400">
                      {q ? "Keine Treffer für deine Suche." : "Keine Bestellungen in diesem Status."}
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((r) => (
                    <tr
                      key={r.payment_reference}
                      onClick={() => openDetail(r)}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${
                        r.payment_status === "claimed_paid" ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-slate-50/50"
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-[13px] font-bold text-[#2563eb]">{r.payment_reference}</span>
                        <p className="text-[11px] text-slate-400 font-mono">{r.invoice_number || r.ref}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap">{customerName(r)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">{customerEmail(r)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{customerPhone(r)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                        {(r.pack_name || "—").replace(/\n/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold whitespace-nowrap">{fmtAmount(r.amount_due)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.payment_status} />
                        {r.promised_pay_date && r.payment_status !== "paid" && (
                          <p className="text-[10px] text-blue-600 font-bold mt-1 whitespace-nowrap">Zusage: {fmtDate(r.promised_pay_date)}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                        {r.claimed_paid_at ? (
                          <span className="text-amber-600 font-bold">{fmtDateTime(r.claimed_paid_at)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {(r.payment_status === "pending_payment" || r.payment_status === "claimed_paid") && (
                            <button
                              type="button"
                              onClick={(e) => markPaid(e, r.payment_reference)}
                              disabled={actionRef === r.payment_reference}
                              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold whitespace-nowrap transition-all disabled:opacity-50"
                            >
                              {actionRef === r.payment_reference ? "…" : "Als bezahlt markieren"}
                            </button>
                          )}
                          {r.payment_status === "expired" && (
                            <button
                              type="button"
                              onClick={(e) => reactivate(e, r.payment_reference)}
                              disabled={actionRef === r.payment_reference}
                              className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-[12px] font-bold whitespace-nowrap transition-all disabled:opacity-50"
                            >
                              {actionRef === r.payment_reference ? "…" : "Reaktivieren"}
                            </button>
                          )}
                          <a
                            href={`/api/fiaon/admin/payments/${encodeURIComponent(r.payment_reference)}/invoice.pdf`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Rechnung (PDF) herunterladen"
                            className="px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 text-[12px] font-bold transition-all"
                          >
                            Rechnung
                          </a>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openDetail(r); }}
                            className="px-2.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700 text-[12px] font-bold transition-all"
                          >
                            Details
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[12px] text-slate-400 mt-4">
          Bankkonto: FIAON LTD · BE09 9058 9276 3957 · TRWIBEB1XXX — Zuordnung ausschließlich über den Verwendungszweck.
        </p>

        {/* ── C3: Duplikat-Altbestand ── */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Duplikat-Altbestand bereinigen</h2>
              <p className="text-[12px] text-slate-500 mt-1 max-w-xl">
                Alt-Einträge aus der Zeit vor dem Dubletten-Fix. Pro E-Mail-Gruppe bleibt der vollständigste/neueste Antrag,
                der Rest wird als <span className="font-mono font-bold">merged</span> markiert (Soft-Delete — nichts wird gelöscht, alles bleibt rekonstruierbar).
                Bezahlte und offene Zahlungen sind geschützt.
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xl font-bold text-slate-900">{dup ? dup.groups : "—"}</p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Gruppen</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-rose-500">{dup ? dup.mergeable : "—"}</p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">überflüssig</p>
              </div>
              <button
                type="button"
                onClick={runDupCleanup}
                disabled={dupRunning || !dup || dup.mergeable === 0}
                className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[13px] font-bold transition-all disabled:opacity-40"
              >
                {dupRunning ? "Bereinige…" : "Alle abarbeiten"}
              </button>
            </div>
          </div>
        </div>

        {/* ── D1: Mitarbeiter-Zugänge (Agent-Portal) ── */}
        <div className="mt-6 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[15px] font-bold text-slate-900">Mitarbeiter-Zugänge (Telefon-Nachfass)</h2>
              <p className="text-[12px] text-slate-500 mt-1">
                Mitarbeiter melden sich unter <a href="/agent" className="font-bold text-[#2563eb] hover:underline">/agent</a> an
                und sehen ausschließlich unbezahlte Kunden. Jede Aktion wird protokolliert.
              </p>
            </div>
            <button
              type="button"
              onClick={openAudit}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[12px] font-bold text-slate-500 hover:border-slate-300 transition-all"
            >
              {auditOpen ? "Audit-Log ausblenden" : "Audit-Log anzeigen"}
            </button>
          </div>

          <form onSubmit={createAgent} className="grid sm:grid-cols-4 gap-2 mb-4">
            <input
              type="text"
              value={agentForm.name}
              onChange={(e) => setAgentForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Name"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] focus:border-[#2563eb] outline-none"
            />
            <input
              type="email"
              value={agentForm.email}
              onChange={(e) => setAgentForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Login-E-Mail"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] focus:border-[#2563eb] outline-none"
            />
            <input
              type="text"
              value={agentForm.password}
              onChange={(e) => setAgentForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Passwort (min. 8 Zeichen)"
              className="px-3 py-2.5 rounded-xl border border-slate-200 text-[13px] focus:border-[#2563eb] outline-none"
            />
            <button
              type="submit"
              disabled={agentSaving}
              className="px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-blue-700 text-white text-[13px] font-bold transition-all disabled:opacity-50"
            >
              {agentSaving ? "…" : "Zugang anlegen"}
            </button>
          </form>

          {agents.length > 0 && (
            <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
              {agents.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50/40">
                  <div>
                    <p className="text-[13px] font-bold text-slate-800">
                      {a.name}{" "}
                      <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${a.active ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"}`}>
                        {a.active ? "aktiv" : "deaktiviert"}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">{a.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => resetAgentPw(e, a.id, a.email)}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-500 hover:border-slate-300 transition-all"
                    >
                      Passwort setzen
                    </button>
                    <button
                      type="button"
                      onClick={(e) => toggleAgent(e, a.id)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                        a.active
                          ? "bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-100"
                          : "bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100"
                      }`}
                    >
                      {a.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {auditOpen && (
            <div className="mt-4 border border-slate-100 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {audit.length === 0 && <p className="px-4 py-6 text-center text-[12px] text-slate-400">Noch keine Agent-Aktionen protokolliert.</p>}
              {audit.map((l) => (
                <div key={l.id} className="px-4 py-2.5 border-b border-slate-50 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-slate-700">
                      <span className="text-[#2563eb]">{l.agent_name}</span>
                      {" · "}
                      {l.type === "note" ? "Notiz" : l.type === "email_sent" ? "Zahlungsdaten-Mail" : `Ergebnis: ${l.outcome || "—"}`}
                      {" · "}
                      <span className="font-mono text-slate-400">{l.ref}</span>
                    </p>
                    {l.note && <p className="text-[11px] text-slate-500 truncate">{l.note}</p>}
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">{fmtDateTime(l.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── C2: Detail-Drawer mit Timeline ── */}
      {detail && (
        <div className="fixed inset-0 z-50" onClick={() => setDetail(null)}>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />
          <div
            className="absolute right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div>
                <p className="font-mono text-[13px] font-bold text-[#2563eb]">{detail.payment_reference}</p>
                <p className="text-[15px] font-bold text-slate-900">{customerName(detail)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setDetail(null); }}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={detail.payment_status} />
                {detail.promised_pay_date && (
                  <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                    Zusage: {fmtDate(detail.promised_pay_date)}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-[13px]">
                <div><p className="text-[10px] uppercase font-bold text-slate-400">E-Mail</p><p className="font-semibold break-all">{customerEmail(detail)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Telefon</p><p className="font-semibold">{customerPhone(detail)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Paket</p><p className="font-semibold">{(detail.pack_name || "—").replace(/\n/g, " ")}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Betrag</p><p className="font-semibold">{fmtAmount(detail.amount_due)}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Rechnung</p><p className="font-mono font-semibold">{detail.invoice_number || "—"}</p></div>
                <div><p className="text-[10px] uppercase font-bold text-slate-400">Fällig</p><p className="font-semibold">{fmtDate(detail.payment_due_date)}</p></div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(detail.payment_status === "pending_payment" || detail.payment_status === "claimed_paid") && (
                  <button
                    type="button"
                    onClick={(e) => markPaid(e, detail.payment_reference)}
                    disabled={actionRef === detail.payment_reference}
                    className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold transition-all disabled:opacity-50"
                  >
                    Als bezahlt markieren
                  </button>
                )}
                <a
                  href={`/api/fiaon/admin/payments/${encodeURIComponent(detail.payment_reference)}/invoice.pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-center px-4 py-3 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-slate-300 text-[13px] font-bold transition-all"
                >
                  Rechnung (PDF)
                </a>
              </div>

              <div>
                <h3 className="text-[13px] font-bold text-slate-900 mb-3">Ereignis-Timeline</h3>
                {timeline === null && <p className="text-[12px] text-slate-400">Lädt…</p>}
                {timeline !== null && timeline.length === 0 && <p className="text-[12px] text-slate-400">Keine Ereignisse.</p>}
                {timeline !== null && timeline.length > 0 && (
                  <div className="relative pl-5 space-y-4 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
                    {timeline.map((ev, i) => (
                      <div key={i} className="relative">
                        <span
                          className={`absolute -left-5 top-1 w-[11px] h-[11px] rounded-full border-2 border-white shadow ${
                            ev.type === "paid" ? "bg-emerald-500"
                            : ev.type === "claimed" ? "bg-amber-500"
                            : ev.type === "agent" ? "bg-violet-500"
                            : ev.type === "invoice" ? "bg-slate-400"
                            : ev.type === "promise" ? "bg-blue-500"
                            : "bg-[#2563eb]"
                          }`}
                        />
                        <p className="text-[12px] font-semibold text-slate-800 leading-snug">{ev.label}</p>
                        {ev.meta && <p className="text-[11px] text-slate-500 whitespace-pre-wrap">{ev.meta}</p>}
                        <p className="text-[11px] text-slate-400">{fmtDateTime(ev.at)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
