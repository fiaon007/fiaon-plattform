import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { TrendingUp, Banknote, Wallet, Receipt, Users, ChevronRight, Download } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin/verbuchungen — Tagesfinanzen auf einen Blick (read-only).
// Bestätigte Zahlungen (payment_status='paid') eines Zeitraums mit
// Umsatz, Team-Provisionen und Netto (= was bei uns bleibt).
// Datenquelle: GET /api/fiaon/admin/bookings?range=…  (Integer-Cents).
// ═══════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

interface Booking {
  ref: string;
  paymentReference: string | null;
  invoiceNumber: string | null;
  customer: string;
  email: string | null;
  packName: string | null;
  completedAt: string;
  agentId: number | null;
  agentName: string | null;
  rateBp: number | null;
  revenueCents: number;
  commissionCents: number;
  netCents: number;
}

interface AgentGroup {
  agentId: number | null;
  agentName: string;
  count: number;
  revenueCents: number;
  commissionCents: number;
}

interface BookingsResponse {
  ok: boolean;
  range: string;
  totals: { count: number; revenueCents: number; commissionCents: number; netCents: number };
  byAgent: AgentGroup[];
  bookings: Booking[];
  vatMode: string;
}

const RANGES: { key: string; label: string }[] = [
  { key: "today", label: "Heute" },
  { key: "yesterday", label: "Gestern" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "month", label: "Dieser Monat" },
];

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function initials(name: string): string {
  return (name.match(/\b\w/g) || []).slice(0, 2).join("").toUpperCase();
}

export default function AdminVerbuchungenPage() {
  const [range, setRange] = useState("today");
  const [data, setData] = useState<BookingsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((r: string) => {
    setLoading(true);
    fetch(`/api/fiaon/admin/bookings?range=${encodeURIComponent(r)}`, { credentials: "include" })
      .then((res) => res.json())
      .then((j) => { if (j?.ok) setData(j); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(range); }, [range, load]);

  const rangeLabel = RANGES.find((r) => r.key === range)?.label || "Heute";
  const t = data?.totals;
  const marginPct = t && t.revenueCents > 0 ? Math.round((t.netCents / t.revenueCents) * 100) : null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <PageIntro
            id="verbuchungen"
            title="Verbuchungen"
            subtitle={`Hier siehst du alle bestätigten Zahlungen ${rangeLabel.toLowerCase()} — Umsatz, Team-Provisionen und was netto bei FIAON bleibt.`}
            steps={[
              "Wähle rechts den Zeitraum — Zeit-Anker ist immer der Bestätigungs-Zeitpunkt der Zahlung (nicht das Änderungsdatum).",
              "Netto = Umsatz minus Team-Provisionen. Sonstige Kosten (z. B. Werbung) sind hier bewusst nicht enthalten — die stehen in Finanzen & Sales.",
              "Die Aufschlüsselung je Mitarbeiter zeigt, wer welchen Umsatz gebracht hat. „Direkt (ohne Agent)“ = Kunden ohne zugewiesenen Betreuer.",
              "Diese Seite ist reine Anzeige — freigeschaltet wird in der Zahlungszentrale oder im Kontoabgleich.",
            ]}
          />
        </div>
        {/* Zeitraum-Umschalter */}
        <div className="flex flex-wrap gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setRange(r.key); }}
              className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
                range === r.key ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi icon={TrendingUp} label="Umsatz (brutto)" value={t ? eur(t.revenueCents) : "—"} sub={t ? `${t.count} Verbuchung(en)` : ""} loading={loading} />
        <Kpi icon={Banknote} label="Provisionen (Team)" value={t ? eur(t.commissionCents) : "—"} sub="an Mitarbeiter" loading={loading} />
        <Kpi
          icon={Wallet}
          label="Netto für uns"
          value={t ? eur(t.netCents) : "—"}
          sub={marginPct != null ? `${marginPct}% Marge` : "Umsatz − Provisionen"}
          loading={loading}
          accent
        />
        <Kpi icon={Receipt} label="Verbuchungen" value={t ? String(t.count) : "—"} sub={rangeLabel} loading={loading} />
      </div>

      {/* Team-Aufschlüsselung */}
      <section className="mb-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5 flex items-center gap-1.5">
          <Users size={13} /> Provision je Mitarbeiter
        </h2>
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-[76px] rounded-2xl bg-white border border-slate-200 animate-pulse" />)}
          </div>
        ) : data && data.byAgent.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.byAgent.map((g) => (
              <div key={g.agentId ?? "direct"} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 text-[12px] font-semibold flex items-center justify-center shrink-0">
                    {g.agentId != null ? initials(g.agentName) : "—"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-slate-900 truncate">{g.agentName}</p>
                    <p className="text-[11px] text-slate-400">{g.count} Verbuchung(en) · {eur(g.revenueCents)} Umsatz</p>
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Provision</span>
                  <span className="text-[16px] font-bold tabular-nums" style={{ color: g.agentId != null ? ACCENT : "#94a3b8" }}>
                    {eur(g.commissionCents)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[13px] text-slate-400 bg-white border border-slate-200 rounded-2xl px-4 py-6 text-center">
            Keine bestätigten Zahlungen in diesem Zeitraum.
          </p>
        )}
      </section>

      {/* Buchungstabelle */}
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 mb-2.5">Alle Verbuchungen</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  {["Zeit", "Kunde", "Paket", "Umsatz", "Mitarbeiter", "Satz", "Provision", "Netto", ""].map((h, i) => (
                    <th key={i} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-[13px] text-slate-400">Lädt …</td></tr>
                )}
                {!loading && data && data.bookings.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-[13px] text-slate-400">Keine bestätigten Zahlungen in diesem Zeitraum.</td></tr>
                )}
                {!loading && data?.bookings.map((b) => (
                  <tr key={b.ref} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap tabular-nums">
                      {new Date(b.completedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium text-slate-800 truncate max-w-[200px]">{b.customer}</p>
                      <p className="text-[11px] font-mono text-slate-400">{b.invoiceNumber || b.paymentReference || b.ref}</p>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap max-w-[160px] truncate">{b.packName || "—"}</td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-900 whitespace-nowrap tabular-nums">{eur(b.revenueCents)}</td>
                    <td className="px-4 py-3 text-[12px] whitespace-nowrap">
                      {b.agentId != null
                        ? <span className="text-slate-700 font-medium">{b.agentName}</span>
                        : <span className="text-slate-400">Direkt</span>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-500 whitespace-nowrap tabular-nums">
                      {b.rateBp != null ? `${(b.rateBp / 100).toLocaleString("de-DE")} %` : "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold whitespace-nowrap tabular-nums" style={{ color: b.commissionCents > 0 ? ACCENT : "#cbd5e1" }}>
                      {b.commissionCents > 0 ? eur(b.commissionCents) : "—"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-slate-900 whitespace-nowrap tabular-nums">{eur(b.netCents)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {b.paymentReference && (
                          <a
                            href={`/api/fiaon/admin/payments/${encodeURIComponent(b.paymentReference)}/invoice.pdf`}
                            target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-[12px] font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-300 transition-colors"
                            title="Rechnung als PDF"
                          >
                            <Download size={12} /> PDF
                          </a>
                        )}
                        <Link
                          href={`/admin/zahlungen?ref=${encodeURIComponent(b.paymentReference || b.ref)}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-400 hover:text-slate-700 hover:border-slate-300 transition-colors"
                          title="In Zahlungszentrale öffnen"
                        >
                          <ChevronRight size={15} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {!loading && data && data.bookings.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-slate-100 bg-slate-50/50">
                    <td className="px-4 py-3 text-[12px] font-bold text-slate-700" colSpan={3}>Summe {rangeLabel.toLowerCase()}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-slate-900 tabular-nums">{eur(data.totals.revenueCents)}</td>
                    <td className="px-4 py-3" colSpan={2}></td>
                    <td className="px-4 py-3 text-[13px] font-bold tabular-nums" style={{ color: ACCENT }}>{eur(data.totals.commissionCents)}</td>
                    <td className="px-4 py-3 text-[13px] font-bold text-slate-900 tabular-nums">{eur(data.totals.netCents)}</td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
        {data && (
          <p className="text-[11px] text-slate-400 mt-2">
            „Netto für uns" = Umsatz abzüglich bestätigter Team-Provisionen.
            {data.vatMode === "none" ? " Beträge sind Bruttobeträge (keine USt.-Ausweisung aktiv)." : ` USt.-Modus: ${data.vatMode}.`}
          </p>
        )}
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, sub, loading, accent }: {
  icon: typeof TrendingUp; label: string; value: string; sub?: string; loading?: boolean; accent?: boolean;
}) {
  return (
    <div className={`rounded-2xl bg-white p-4 border ${accent ? "border-slate-300" : "border-slate-200"}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight">{label}</p>
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={accent ? { background: "rgba(37,99,235,.10)", color: ACCENT } : { background: "#f1f5f9", color: "#94a3b8" }}
        >
          <Icon size={15} strokeWidth={1.9} />
        </span>
      </div>
      {loading ? (
        <div className="h-7 w-24 rounded bg-slate-100 animate-pulse" />
      ) : (
        <p className={`text-xl font-bold tracking-tight tabular-nums ${accent ? "" : "text-slate-900"}`} style={accent ? { color: ACCENT } : undefined}>
          {value}
        </p>
      )}
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
