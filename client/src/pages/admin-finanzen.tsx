import { useState, useEffect, useCallback, useMemo } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { PageIntro } from "@/components/admin/PageHelp";

// ════════════════════════════════════════════════════════════════════
// /admin/finanzen — Finanz- & Sales-Analytics-Zentrale (Paket BD).
// ALLE Kennzahlen kommen serverseitig aggregiert; hier nur Anzeige.
// ════════════════════════════════════════════════════════════════════

const ACCENT = "#2563eb";

async function apiF(path: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok && json?.ok, json };
}

function eur(cents: number | null | undefined) {
  if (cents == null) return "—";
  return `${(Number(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
function pct(v: number | null | undefined) {
  return v == null ? "—" : `${v.toLocaleString("de-DE")} %`;
}

type RangeKey = "heute" | "gestern" | "7t" | "30t" | "monat" | "custom";
function computeRange(key: RangeKey, custom: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (key === "custom" && custom.from && custom.to) return { from: new Date(custom.from).toISOString(), to: endOfDay(new Date(custom.to)).toISOString() };
  if (key === "heute") return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
  if (key === "gestern") { const y = new Date(now.getTime() - 864e5); return { from: startOfDay(y).toISOString(), to: endOfDay(y).toISOString() }; }
  if (key === "monat") { const f = new Date(now.getFullYear(), now.getMonth(), 1); return { from: f.toISOString(), to: endOfDay(now).toISOString() }; }
  const days = key === "7t" ? 7 : 30;
  return { from: startOfDay(new Date(now.getTime() - days * 864e5)).toISOString(), to: endOfDay(now).toISOString() };
}

// P2-D: Jede Kennzahl bekommt einen Tooltip mit Klartext-Definition (tip).
function Kpi({ label, value, sub, tip }: { label: string; value: string; sub?: string; tip?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4" title={tip}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1 flex items-center gap-1">
        {label}
        {tip && <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-slate-300 text-slate-400 text-[9px] font-bold cursor-help" aria-label={tip}>i</span>}
      </p>
      <p className="text-lg font-bold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function FunnelBars({ title, hint, stages, color = ACCENT, footer }: { title: string; hint: string; stages: { label: string; value: number; rate: number | null; tip: string }[]; color?: string; footer?: string }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="text-[13px] font-semibold text-slate-800">{title}</p>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">{hint}</p>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3" title={s.tip}>
            <div className="w-36 text-[12px] text-slate-500 shrink-0">{s.label}</div>
            <div className="flex-1 h-7 rounded-lg bg-slate-100 overflow-hidden">
              <div className="h-full rounded-lg flex items-center px-2 text-[11px] font-semibold text-white" style={{ width: `${Math.max(6, (s.value / max) * 100)}%`, background: color }}>{s.value}</div>
            </div>
            <div className="w-20 text-right text-[12px] text-slate-400 shrink-0">{i > 0 ? pct(s.rate) : ""}</div>
          </div>
        ))}
      </div>
      {footer && <p className="text-[11px] text-slate-500 mt-3 pt-2 border-t border-slate-100">{footer}</p>}
    </div>
  );
}

function Funnels({ f, r }: { f: any; r: any }) {
  const lead = f.lead || {}, rl = r.lead || {};
  const ges = f.gesamt || {}, rg = r.gesamt || {};
  return (
    <div className="grid lg:grid-cols-2 gap-4 mb-5">
      <FunnelBars
        title="Lead-Funnel (nur Leads)"
        hint={`Nur aus Leads entstandene Anträge. Rate je Stufe = Stufe ÷ vorherige Stufe. Gesamt Lead→zahlend: ${pct(rl.gesamtLeadToBezahlt)}`}
        stages={[
          { label: "Leads", value: lead.leads || 0, rate: null, tip: "Alle Leads im Zeitraum (Bezugsgröße)" },
          // P2-D ehrlich: Massenmail ist KEIN Kontakt — diese Stufe heißt jetzt „Angeschrieben".
          { label: "Angeschrieben (Mail)", value: lead.angeschrieben ?? lead.kontaktiert ?? 0, rate: rl.leadToKontaktiert, tip: "Lead hat mindestens eine automatische Mail erhalten (Status nicht mehr 'neu'). Das ist KEIN persönlicher Kontakt." },
          { label: "Antrag gestellt", value: lead.antraege || 0, rate: rl.kontaktiertToAntrag, tip: "Konvertierte Leads ÷ angeschriebene Leads" },
          { label: "Zahlung angekündigt", value: lead.angekuendigt || 0, rate: rl.antragToAngekuendigt, tip: "Verknüpfte Order angekündigt/bezahlt ÷ Anträge" },
          { label: "Bezahlt", value: lead.bezahlt || 0, rate: rl.angekuendigtToBezahlt, tip: "Verknüpfte Order bezahlt ÷ angekündigt (nur echte, referenzierte Zahlungen)" },
        ]}
        footer={`Echt kontaktiert (dokumentiertes Agenten-Ergebnis): ${lead.kontaktiertEcht ?? "—"} von ${lead.leads || 0} Leads`}
      />
      <FunnelBars
        title="Gesamt-Funnel (inkl. Direkt)"
        hint={`ALLE Anträge im Zeitraum (auch Direktkunden ohne Lead). Antrag→bezahlt: ${pct(rg.antragToBezahlt)}`}
        color="#64748b"
        stages={[
          { label: "Antrag gestellt", value: ges.antraege || 0, rate: null, tip: "Alle Anträge/Bestellungen (Bezugsgröße)" },
          { label: "Zahlung angekündigt", value: ges.angekuendigt || 0, rate: rg.antragToAngekuendigt, tip: "Angekündigt/bezahlt ÷ Anträge" },
          { label: "Bezahlt", value: ges.bezahlt || 0, rate: rg.angekuendigtToBezahlt, tip: "Bezahlt ÷ angekündigt" },
        ]}
      />
    </div>
  );
}

function LineChart({ points, color = ACCENT }: { points: { date: string; v: number }[]; color?: string }) {
  const { path, max } = useMemo(() => {
    if (points.length === 0) return { path: "", max: 0 };
    const mx = Math.max(1, ...points.map((p) => p.v));
    const w = 100, h = 40;
    const step = points.length > 1 ? w / (points.length - 1) : 0;
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(2)},${(h - (p.v / mx) * h).toFixed(2)}`).join(" ");
    return { path: d, max: mx };
  }, [points]);
  if (points.length === 0) return <p className="text-[12px] text-slate-400">Keine Daten im Zeitraum.</p>;
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="w-full h-24">
      <path d={path} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function AdminFinanzenPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30t");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => computeRange(rangeKey, custom), [rangeKey, custom]);
  const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  const [ov, setOv] = useState<any>(null);
  const [attr, setAttr] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [showBudget, setShowBudget] = useState(false);
  const [bForm, setBForm] = useState({ campaign: "", amountEur: "", periodStart: "", periodEnd: "", note: "" });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiF(`/admin/finance/overview?${qs}`).then((r) => r.ok && setOv(r.json)),
      apiF(`/admin/finance/attribution?${qs}`).then((r) => r.ok && setAttr(r.json.data || [])),
      apiF(`/admin/finance/team?${qs}`).then((r) => r.ok && setTeam(r.json.data || [])),
      apiF(`/admin/finance/budget`).then((r) => r.ok && setBudgets(r.json.data || [])),
    ]).finally(() => setLoading(false));
  }, [qs]);
  useEffect(load, [load]);

  const addBudget = async () => {
    const r = await apiF("/admin/finance/budget", { method: "POST", body: JSON.stringify(bForm) });
    if (r.ok) { setShowBudget(false); setBForm({ campaign: "", amountEur: "", periodStart: "", periodEnd: "", note: "" }); load(); }
  };
  const delBudget = async (id: number) => { const r = await apiF(`/admin/finance/budget/${id}`, { method: "DELETE" }); if (r.ok) load(); };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: "heute", label: "Heute" }, { key: "gestern", label: "Gestern" }, { key: "7t", label: "7 Tage" },
    { key: "30t", label: "30 Tage" }, { key: "monat", label: "Dieser Monat" }, { key: "custom", label: "Custom" },
  ];

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <PageIntro
        id="finanzen"
        title="Finanzen & Sales"
        subtitle="Hier analysierst du Funnel, Umsatz, Marge und Kampagnen-Rentabilität — jede Kennzahl mit Klartext-Definition."
        steps={[
          "Wähle oben den Zeitraum. Zeit-Anker aller Umsatzzahlen ist der Bezahl-Zeitpunkt — „bezahlt“ heißt überall dasselbe (Status bezahlt + Zahlungsreferenz, ohne Dubletten und Alt-Import).",
          "Der Lead-Funnel zeigt nur Leads; „Angeschrieben (Mail)“ ist ehrlich benannt — eine Massenmail ist kein persönlicher Kontakt. „Echt kontaktiert“ zählt nur dokumentierte Agenten-Ergebnisse.",
          "CAC und Lead-Kosten brauchen ein eingetragenes Werbebudget (Abschnitt unten). LTV/CAC ist als ANNAHME gekennzeichnet — die 12 Monate Laufzeit sind nicht gemessen.",
          "Fahre mit der Maus über das ⓘ an jeder Kennzahl — dort steht die genaue Definition.",
          "Der Alt-Import (bezahlt importierte Alt-Kunden ohne Beleg) wird separat ausgewiesen und fließt bewusst in keine Kennzahl ein.",
        ]}
      />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        {RANGES.map((r) => (
          <button key={r.key} onClick={() => setRangeKey(r.key)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold border ${rangeKey === r.key ? "bg-slate-900 text-white border-slate-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}>{r.label}</button>
        ))}
        {rangeKey === "custom" && (
          <span className="flex items-center gap-1">
            <input type="date" value={custom.from} onChange={(e) => setCustom({ ...custom, from: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-[12px]" />
            <input type="date" value={custom.to} onChange={(e) => setCustom({ ...custom, to: e.target.value })} className="px-2 py-1.5 rounded-lg border border-slate-200 text-[12px]" />
          </span>
        )}
      </div>

      {loading && !ov ? <p className="text-[13px] text-slate-400">Lädt…</p> : ov && (
        <>
          <Funnels f={ov.funnel} r={ov.funnelRates} />

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <Kpi label="Umsatz (brutto)" value={eur(ov.revenue.umsatzCents)} sub={`${ov.revenue.bezahltCount} bezahlt`} tip={ov.kpiDefs?.umsatz} />
            <Kpi label="Provisionen (Team)" value={eur(ov.revenue.provisionenCents)} tip="Alle nicht-stornierten Provisionseinträge im Zeitraum (own + override)." />
            <Kpi label="Netto FIAON" value={eur(ov.revenue.nettoCents)} sub={`Marge ${pct(ov.revenue.margePct)}`} tip="Umsatz minus Team-Provisionen. Keine sonstigen Kosten enthalten." />
            <Kpi label="Ø Abschlusswert (AOV)" value={eur(ov.revenue.aovCents)} tip="Umsatz ÷ bezahlte Kunden im Zeitraum (nur echte, referenzierte Zahlungen)." />
            <Kpi label="CAC" value={ov.cac.hasBudget ? eur(ov.cac.cacCents) : "Budget eintragen"} sub={ov.cac.hasBudget ? `Werbebudget ${eur(ov.cac.spendCents)}` : undefined} tip={ov.kpiDefs?.cac} />
            <Kpi label="Lead-Kosten" value={ov.cac.hasBudget ? eur(ov.cac.leadCostCents) : "Budget eintragen"} tip="Werbebudget ÷ Leads im Zeitraum." />
            {/* P2-D ehrlich: LTV/CAC ist eine ANNAHME (12 Monate Laufzeit sind nicht gemessen) */}
            <Kpi label="LTV/CAC (Annahme)" value={ov.cac.ltvCacRatio != null ? `~${ov.cac.ltvCacRatio}×` : "—"} sub={`Annahme: Kunde bleibt ${ov.cac.assumedLifetimeMonths} Mon. — nicht gemessen`} tip={ov.kpiDefs?.ltv} />
            <Kpi label="Bestand (bezahlt)" value={String(ov.revenue.bestandCount)} sub="all-time · eine Wahrheit" tip={ov.kpiDefs?.bezahlt} />
          </div>

          {/* P2-D: Alt-Import GETRENNT ausgewiesen — ehrlich statt versteckt */}
          {ov.revenue.altbestandCount > 0 && (
            <div className="mb-5 px-4 py-3 rounded-xl border border-slate-200 bg-white text-[12.5px] text-slate-600" title={ov.kpiDefs?.altbestand}>
              <b className="text-slate-800">Alt-Import (nicht im Umsatz):</b> {ov.revenue.altbestandCount} als bezahlt importierte Alt-Kunden ohne Zahlungsreferenz,
              davon {ov.revenue.altbestandOhneBetrag} ohne Betrag. Diese Datensätze fließen bewusst in KEINE Umsatz- oder Funnel-Kennzahl ein.
            </div>
          )}

          <div className="grid lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Umsatz / Tag</p>
              <LineChart points={(ov.series.revenue || []).map((p: any) => ({ date: p.date, v: p.cents }))} />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Leads / Tag</p>
              <LineChart points={(ov.series.leads || []).map((p: any) => ({ date: p.date, v: p.count }))} color="#64748b" />
            </div>
          </div>

          {/* Umsatz je Paket-Tier */}
          {ov.revenue.perTier?.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
              <p className="text-[13px] font-semibold text-slate-800 mb-2">Umsatz je Paket</p>
              <table className="w-full text-[13px]">
                <tbody>
                  {ov.revenue.perTier.map((t: any, i: number) => (
                    <tr key={i} className="border-t border-slate-100 first:border-0">
                      <td className="py-1.5 text-slate-600">{t.pack}</td>
                      <td className="py-1.5 text-slate-400 text-right">{t.count}×</td>
                      <td className="py-1.5 text-slate-800 font-semibold text-right tabular-nums">{eur(t.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Attribution */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-800">Quellen- & Kampagnen-Attribution</p>
          <a href={`/api/fiaon/admin/finance/export/attribution.csv?${qs}`} className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 hover:text-slate-800"><Download size={13} /> CSV</a>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Kampagne/Quelle</th>
              <th className="text-right px-4 py-2 font-semibold">Leads</th>
              <th className="text-right px-4 py-2 font-semibold">Konv.</th>
              <th className="text-right px-4 py-2 font-semibold">CR</th>
              <th className="text-right px-4 py-2 font-semibold">Umsatz</th>
              <th className="text-right px-4 py-2 font-semibold">CAC</th>
            </tr>
          </thead>
          <tbody>
            {attr.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-center text-slate-400">Keine Daten.</td></tr>}
            {attr.map((a, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700">{a.bucket}</td>
                <td className="px-4 py-2 text-right text-slate-500">{a.leads}</td>
                <td className="px-4 py-2 text-right text-slate-500">{a.konversionen}</td>
                <td className="px-4 py-2 text-right text-slate-500">{pct(a.conversionRate)}</td>
                <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{eur(a.umsatzCents)}</td>
                <td className="px-4 py-2 text-right text-slate-500">{a.cacCents != null ? eur(a.cacCents) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Team-Performance */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden mb-5">
        <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100">
          <p className="text-[13px] font-semibold text-slate-800">Team-Performance</p>
          <a href={`/api/fiaon/admin/finance/export/team.csv?${qs}`} className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 hover:text-slate-800"><Download size={13} /> CSV</a>
        </div>
        <table className="w-full text-[13px]">
          <thead className="bg-slate-50 text-slate-400 text-[11px] uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2 font-semibold">Mitarbeiter</th>
              <th className="text-right px-4 py-2 font-semibold">Leads</th>
              <th className="text-right px-4 py-2 font-semibold">Kunden</th>
              <th className="text-right px-4 py-2 font-semibold">Abschl.</th>
              <th className="text-right px-4 py-2 font-semibold">Umsatz</th>
              <th className="text-right px-4 py-2 font-semibold">Provision</th>
            </tr>
          </thead>
          <tbody>
            {team.length === 0 && <tr><td colSpan={6} className="px-4 py-5 text-center text-slate-400">Keine Daten.</td></tr>}
            {team.map((t) => (
              <tr key={t.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-700 font-semibold">{t.name}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.leads}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.kunden}</td>
                <td className="px-4 py-2 text-right text-slate-500">{t.abschluesse}</td>
                <td className="px-4 py-2 text-right text-slate-800 font-semibold tabular-nums">{eur(t.umsatzCents)}</td>
                <td className="px-4 py-2 text-right text-slate-500 tabular-nums">{eur(t.provisionCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Werbebudget (CAC) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold text-slate-800">Werbebudget (für CAC)</p>
          <div className="flex items-center gap-2">
            <a href={`/api/fiaon/admin/finance/export/umsatz.csv?${qs}`} className="text-[12px] text-slate-500 inline-flex items-center gap-1.5 hover:text-slate-800"><Download size={13} /> Umsatz-CSV</a>
            <button onClick={() => setShowBudget((v) => !v)} className="text-[12px] font-semibold inline-flex items-center gap-1.5" style={{ color: ACCENT }}><Plus size={13} /> Budget eintragen</button>
          </div>
        </div>
        {showBudget && (
          <div className="grid sm:grid-cols-5 gap-2 mb-3">
            <input placeholder="Kampagne (leer = gesamt)" value={bForm.campaign} onChange={(e) => setBForm({ ...bForm, campaign: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <input placeholder="Betrag €" value={bForm.amountEur} onChange={(e) => setBForm({ ...bForm, amountEur: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <input type="date" value={bForm.periodStart} onChange={(e) => setBForm({ ...bForm, periodStart: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <input type="date" value={bForm.periodEnd} onChange={(e) => setBForm({ ...bForm, periodEnd: e.target.value })} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[13px]" />
            <button onClick={addBudget} className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold" style={{ background: ACCENT }}>Hinzufügen</button>
          </div>
        )}
        <div className="space-y-1">
          {budgets.length === 0 && <p className="text-[12px] text-slate-400">Noch kein Budget hinterlegt — CAC-Kennzahlen bleiben leer.</p>}
          {budgets.map((b) => (
            <div key={b.id} className="flex items-center gap-3 text-[12px] text-slate-600 border-t border-slate-100 py-1.5 first:border-0">
              <span className="font-semibold">{b.campaign || "Gesamt"}</span>
              <span>{eur(b.amount_cents)}</span>
              <span className="text-slate-400">{b.period_start} → {b.period_end}</span>
              <button onClick={() => delBudget(b.id)} className="ml-auto text-slate-400 hover:text-slate-700"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
