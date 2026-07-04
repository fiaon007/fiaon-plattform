import { useState, useEffect, useRef } from "react";
import { FileText, Download } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// /admin/rechnungen — read-only Übersicht des Rechnungs-Nummernkreises
// mit Suche + PDF-Download (bestehender Admin-Download-Endpoint).
// ═══════════════════════════════════════════════════════════════════

interface InvoiceRow {
  ref: string;
  payment_reference: string | null;
  invoice_number: string;
  invoice_date: string | null;
  amount_due: string | null;
  payment_status: string;
  first_name: string | null;
  last_name: string | null;
  contact_name: string | null;
  company_name: string | null;
  email: string | null;
  contact_email: string | null;
}

function customerName(r: InvoiceRow): string {
  return r.company_name || [r.first_name, r.last_name].filter(Boolean).join(" ") || r.contact_name || r.ref;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Bezahlt",
  pending_payment: "Offen",
  claimed_paid: "Zahlung angekündigt",
  expired: "Abgelaufen",
  refunded: "Erstattet",
};

export default function AdminRechnungenPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const load = (query: string) => {
    setLoading(true);
    fetch(`/api/fiaon/admin/invoices?q=${encodeURIComponent(query)}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setRows(j.data); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(""); }, []);
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => load(q.trim()), 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-xl font-bold tracking-tight text-slate-900 mb-1">Rechnungen</h1>
      <p className="text-[13px] text-slate-500 mb-5">
        Alle automatisch erzeugten Rechnungen (lückenloser Nummernkreis). Erstellung und Storno laufen über die Zahlungszentrale — hier nur Übersicht und Download.
      </p>

      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Suche nach Rechnungsnummer, Referenz, Name oder E-Mail …"
        className="w-full sm:max-w-md px-4 py-3 rounded-xl border border-slate-200 bg-white focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none text-[14px] mb-4"
      />

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100">
                {["Rechnungsnr.", "Datum", "Kunde", "Betrag", "Zahlungsstatus", ""].map((h, i) => (
                  <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-slate-400">Lädt …</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-[13px] text-slate-400">
                  {q ? "Keine Treffer." : "Noch keine Rechnungen erzeugt."}
                </td></tr>
              )}
              {!loading && rows.map((r) => (
                <tr key={r.invoice_number} className="border-b border-slate-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-slate-900 font-mono">
                      <FileText size={13} className="text-slate-400" />{r.invoice_number}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap">
                    {r.invoice_date ? new Date(r.invoice_date).toLocaleDateString("de-DE") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[13px] font-medium text-slate-800">{customerName(r)}</p>
                    <p className="text-[11px] text-slate-400">{r.email || r.contact_email || ""}</p>
                  </td>
                  <td className="px-4 py-3 text-[13px] font-semibold tabular-nums whitespace-nowrap">
                    {r.amount_due != null ? `${Number(r.amount_due).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2.5 py-0.5 rounded-full border border-slate-200 text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                      {STATUS_LABEL[r.payment_status] || r.payment_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.payment_reference && (
                      <a
                        href={`/api/fiaon/admin/payments/${encodeURIComponent(r.payment_reference)}/invoice.pdf`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
                      >
                        <Download size={12} /> PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {rows.length >= 200 && <p className="text-[11px] text-slate-400 mt-2">Es werden maximal 200 Einträge angezeigt — bitte Suche eingrenzen.</p>}
    </div>
  );
}
