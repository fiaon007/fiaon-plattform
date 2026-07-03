import { useState, useEffect, useCallback } from "react";

// ============================================================================
// /admin/zahlungen — Manuelle Freischaltung von Vorkasse-Bestellungen
// Abgleich mit dem Kontoauszug per Referenz-Suche. Siehe MIGRATION_INVENTORY.md
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
  pack_name: string | null;
  created_at: string;
  reminder_sent_at_24h: string | null;
  reminder_sent_at_72h: string | null;
  claimed_paid_at: string | null;
}

interface PaymentStats {
  pending: { count: number; sum: number };
  claimed: { count: number; sum: number };
  paid: { count: number; sum: number };
  confirmationRate: number | null;
}

function customerName(r: PaymentRow): string {
  if (r.company_name) return r.company_name;
  const name = [r.first_name, r.last_name].filter(Boolean).join(" ");
  return name || r.contact_name || "—";
}

function customerEmail(r: PaymentRow): string {
  return r.email || r.contact_email || r.billing_email || "—";
}

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "—";
  }
}

function fmtAmount(v: string | null): string {
  const n = Number(v);
  if (!v || isNaN(n)) return "—";
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

type TabKey = "pending_payment" | "claimed_paid" | "expired";

export default function AdminZahlungenPage() {
  const [tab, setTab] = useState<TabKey>("pending_payment");
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionRef, setActionRef] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reminderRunning, setReminderRunning] = useState(false);

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
      const res = await fetch(`/api/fiaon/admin/payments?status=${status}`, { credentials: "include" });
      const json = await res.json().catch(() => null);
      setRows(res.ok && json?.ok ? json.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
    loadStats();
  }, [tab, load, loadStats]);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
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
          customerName(r).toUpperCase().includes(q),
      )
    : rows;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
            {reminderRunning ? "Läuft…" : "Reminder-Lauf jetzt starten"}
          </button>
        </div>

        {message && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 text-[13px] font-semibold text-blue-800">
            {message}
          </div>
        )}

        {/* Forecast-Kennzahlen */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Offen (noch keine Reaktion)</p>
              <p className="text-xl font-bold text-slate-900">{stats.pending.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
              <p className="text-[11px] text-slate-400">{stats.pending.count} Bestellungen</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500 mb-1">Erwarteter Umsatz (unbestätigt)</p>
              <p className="text-xl font-bold text-amber-600">{stats.claimed.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
              <p className="text-[11px] text-slate-400">{stats.claimed.count} Zahlungen gemeldet</p>
            </div>
            <div className="bg-white border border-emerald-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 mb-1">Bestätigter Umsatz</p>
              <p className="text-xl font-bold text-emerald-600">{stats.paid.sum.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</p>
              <p className="text-[11px] text-slate-400">{stats.paid.count} bezahlt</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bestätigungsquote</p>
              <p className="text-xl font-bold text-slate-900">{stats.confirmationRate === null ? "—" : `${stats.confirmationRate} %`}</p>
              <p className="text-[11px] text-slate-400">wie viele Zahlungs-Behauptungen echt waren</p>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { key: "pending_payment", label: "Offen (wartet auf Zahlung)" },
              { key: "claimed_paid", label: `Zahlung gemeldet${stats ? ` (${stats.claimed.count})` : ""}` },
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
            placeholder="Suche nach Referenz (z. B. FIAON-K7M2X9), Antrags-Ref oder Name…"
            className="w-full sm:max-w-md px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[14px]"
          />
        </div>

        {/* Tabelle */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70">
                  {["Referenz", "Kunde", "E-Mail", "Paket", "Betrag", "Bestellt", tab === "claimed_paid" ? "Gemeldet am" : "Fällig", "Aktion"].map((h) => (
                    <th key={h} className="px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-slate-400">
                      Lädt…
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-slate-400">
                      {q ? "Keine Treffer für deine Suche." : "Keine Bestellungen in diesem Status."}
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((r) => (
                    <tr key={r.payment_reference} className="border-b border-slate-50 hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <span className="font-mono text-[13px] font-bold text-[#2563eb]">{r.payment_reference}</span>
                        <p className="text-[11px] text-slate-400 font-mono">{r.ref}</p>
                      </td>
                      <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap">{customerName(r)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500">{customerEmail(r)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                        {(r.pack_name || "—").replace(/\n/g, " ")}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold whitespace-nowrap">{fmtAmount(r.amount_due)}</td>
                      <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                        {tab === "claimed_paid" ? (
                          <span className="text-amber-600 font-bold">{fmtDate(r.claimed_paid_at)}</span>
                        ) : (
                          <>
                            <span
                              className={
                                r.payment_due_date && new Date(r.payment_due_date) < new Date()
                                  ? "text-red-500 font-bold"
                                  : "text-slate-500"
                              }
                            >
                              {fmtDate(r.payment_due_date)}
                            </span>
                            <p className="text-[10px] text-slate-400">
                              {r.reminder_sent_at_24h ? "24h ✓ " : ""}
                              {r.reminder_sent_at_72h ? "72h ✓" : ""}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tab === "expired" ? (
                          <button
                            type="button"
                            onClick={(e) => reactivate(e, r.payment_reference)}
                            disabled={actionRef === r.payment_reference}
                            className="px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-blue-700 text-white text-[12px] font-bold whitespace-nowrap transition-all disabled:opacity-50"
                          >
                            {actionRef === r.payment_reference ? "…" : "Reaktivieren"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => markPaid(e, r.payment_reference)}
                            disabled={actionRef === r.payment_reference}
                            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold whitespace-nowrap transition-all disabled:opacity-50"
                          >
                            {actionRef === r.payment_reference ? "…" : "Als bezahlt markieren"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[12px] text-slate-400 mt-4">
          Bankkonto: Fiaon Ltd · BE09 9058 9276 3957 · TRWIBEB1XXX — Zuordnung ausschließlich über den Verwendungszweck.
        </p>
      </div>
    </div>
  );
}
