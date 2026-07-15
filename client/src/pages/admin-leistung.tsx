import { useState, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Copy as CopyIcon, RefreshCw } from "lucide-react";
import { ACCENT } from "@/components/admin/AdminShell";
import { PageIntro, Tip } from "@/components/admin/PageHelp";

// ═══════════════════════════════════════════════════════════════════
// /admin/leistung — ARBEITSBERICHTE (Phase 4, P4-C).
// Offen, nicht heimlich: ausgewertet werden nur ARBEITSERGEBNISSE aus Logs,
// die die Agenten selbst erzeugen. KEINE Arbeitszeit-, Pausen- oder
// Anwesenheits-Daten (Scheinselbstständigkeit/DSGVO). Jeder Agent sieht
// seine eigenen Zahlen im Portal (Spiegelansicht /agent/leistung).
// KI-Analyse: nur aggregierte Kennzahlen, Agenten anonymisiert.
// ═══════════════════════════════════════════════════════════════════

const OUTCOME_LABEL: Record<string, string> = {
  erreicht_interesse: "Erreicht – Interesse",
  erreicht_kein_interesse: "Erreicht – kein Interesse",
  nicht_erreicht: "Nicht erreicht",
  mailbox: "Mailbox",
  rueckruf_termin: "Rückruf-Termin",
  nummer_falsch: "Nummer falsch",
};

function eur(cents: number): string {
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`;
}

async function apiF(path: string, init?: RequestInit): Promise<{ ok: boolean; json: any }> {
  const r = await fetch(`/api/fiaon${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
  const json = await r.json().catch(() => null);
  return { ok: r.ok && json?.ok, json };
}

type RangeKey = "heute" | "7t" | "30t" | "custom";
function computeRange(key: RangeKey, custom: { from: string; to: string }): { from: string; to: string } {
  const now = new Date();
  const start = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
  const end = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
  if (key === "custom" && custom.from && custom.to) return { from: new Date(custom.from).toISOString(), to: end(new Date(custom.to)).toISOString() };
  if (key === "heute") return { from: start(now).toISOString(), to: end(now).toISOString() };
  const days = key === "7t" ? 7 : 30;
  return { from: start(new Date(now.getTime() - days * 864e5)).toISOString(), to: end(now).toISOString() };
}

/** Mini-Balkenverlauf (Team-Zeitverlauf) — bewusst schlicht, monochrom. */
function Trend({ points, color = ACCENT }: { points: { date: string; count: number }[]; color?: string }) {
  const max = Math.max(1, ...points.map((p) => p.count));
  if (points.length === 0) return <p className="text-[12px] text-slate-400">Keine Daten im Zeitraum.</p>;
  return (
    <div className="flex items-end gap-[2px] h-16">
      {points.map((p) => (
        <div key={p.date} title={`${new Date(p.date).toLocaleDateString("de-DE")}: ${p.count}`}
          className="flex-1 min-w-[3px] rounded-t" style={{ height: `${Math.max(4, (p.count / max) * 100)}%`, background: color, opacity: 0.85 }} />
      ))}
    </div>
  );
}

export default function AdminLeistungPage() {
  const [rangeKey, setRangeKey] = useState<RangeKey>("30t");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => computeRange(rangeKey, custom), [rangeKey, custom]);
  const qs = `from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [detail, setDetail] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    apiF(`/admin/leistung?${qs}`).then((r) => {
      if (r.ok) { setData(r.json); if (r.json.lastSummary) setSummary(r.json.lastSummary); }
    }).finally(() => setLoading(false));
  }, [qs]);
  useEffect(load, [load]);

  const runAi = async () => {
    setAiBusy(true); setAiError(null);
    const r = await apiF(`/admin/leistung/ai-summary?${qs}`, { method: "POST" });
    setAiBusy(false);
    if (r.ok) setSummary(r.json.summary);
    else setAiError(r.json?.error || "KI-Zusammenfassung fehlgeschlagen — die Zahlen unten bleiben davon unberührt.");
  };
  const copySummary = () => {
    if (!summary?.text) return;
    navigator.clipboard?.writeText(summary.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const RANGES: { key: RangeKey; label: string }[] = [
    { key: "heute", label: "Heute" }, { key: "7t", label: "7 Tage" }, { key: "30t", label: "30 Tage" }, { key: "custom", label: "Custom" },
  ];
  const th = "text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 whitespace-nowrap";
  const td = "px-3 py-2.5 text-[13px] text-slate-700 tabular-nums";

  return (
    <div className="px-4 sm:px-6 py-5 max-w-6xl mx-auto">
      <PageIntro
        id="leistung"
        title="Leistung — Arbeitsberichte"
        subtitle="Hier siehst du, was jeder Agent im Zeitraum erreicht hat — Ergebnisse, nicht Anwesenheit."
        steps={[
          "Wähle oben den Zeitraum. Alle Zahlen stammen aus den Arbeits-Logs der Agenten (Akten, Kontakt-Ergebnisse, Links, Abschlüsse) — es gibt KEINE Arbeitszeit- oder Pausen-Erfassung.",
          "Die Tabelle vergleicht das Team. Klick auf eine Zeile zeigt die Kontakt-Ergebnisse nach Typ.",
          "„Reaktionszeit\" = Ø Stunden von Lead-Eingang bis zum ersten dokumentierten Kontakt des Agenten — die aussagekräftigste Kennzahl.",
          "„KI-Analyse\" fasst die Zahlen in Klartext zusammen (was lief gut, wo bricht es ab, Empfehlungen). An die KI gehen NUR anonymisierte Summen — keine Kunden- oder Agentennamen.",
          "Jeder Agent sieht seine eigenen Zahlen im Agent-Portal unter „Mehr → Meine Leistung\" — Transparenz statt Geheim-Logs.",
        ]}
        right={
          <button onClick={runAi} disabled={aiBusy || loading}
            className="px-3.5 py-2 rounded-lg text-white text-[12.5px] font-semibold inline-flex items-center gap-2 disabled:opacity-50 shrink-0" style={{ background: ACCENT }}>
            <Sparkles size={14} /> {aiBusy ? "Analysiert …" : "KI-Analyse erstellen"}
          </button>
        }
      />

      {/* Zeitraum */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
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
        <button onClick={load} className="ml-auto w-9 h-9 rounded-lg border border-slate-200 text-slate-400 flex items-center justify-center" aria-label="Neu laden"><RefreshCw size={15} /></button>
      </div>

      {aiError && (
        <div className="mb-4 px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 text-[13px] text-amber-800">
          <b>KI nicht verfügbar:</b> {aiError}
        </div>
      )}

      {/* KI-Zusammenfassung (kopierbar, letzte bleibt gespeichert) */}
      {summary && (
        <div className="mb-5 bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-slate-400" />
            <p className="text-[13px] font-bold text-slate-900 flex-1">KI-Analyse</p>
            <span className="text-[11px] text-slate-400">{new Date(summary.at).toLocaleString("de-DE")} · {summary.provider}</span>
            <button onClick={copySummary} className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11.5px] font-semibold text-slate-500 inline-flex items-center gap-1.5 hover:border-slate-300">
              <CopyIcon size={12} /> {copied ? "Kopiert" : "Kopieren"}
            </button>
          </div>
          <div className="text-[13px] text-slate-700 leading-relaxed whitespace-pre-wrap">{summary.text}</div>
        </div>
      )}

      {loading && !data ? <p className="text-[13px] text-slate-400">Lädt…</p> : data && (
        <>
          {/* Team-Summen */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
            {([
              ["Übernommene Akten", data.totals.akten, "Lead-Akten, die ein Agent im Zeitraum bewusst übernommen hat (protokollierte Übernahme)."],
              ["Dokumentierte Kontakte", data.totals.kontakte, "Kontakt-Ergebnisse an Leads UND Kunden — nur dokumentierte Arbeit zählt."],
              ["Antragslinks", data.totals.links, "Von Agenten versendete Antrags-/Zahlungslinks (Verkaufsarbeit)."],
              ["Konversionen", data.totals.konversionen, "Leads, die im Zeitraum zu einem Antrag wurden (betreuender Agent)."],
              ["Abschlüsse", data.totals.abschluesse, "Bezahlte Kunden im Zeitraum (eine Wahrheit: bezahlt + Zahlungsreferenz)."],
              ["Umsatz", eur(data.totals.umsatzCents), "Summe der bezahlten Beträge im Zeitraum (Zeit-Anker: Bezahl-Zeitpunkt)."],
            ] as [string, any, string][]).map(([label, value, tip]) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-3.5" title={tip}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center">{label}<Tip text={tip} /></p>
                <p className="text-lg font-bold text-slate-900 tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Team-Tabelle */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden mb-5">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50/70 border-b border-slate-100">
                  <tr>
                    <th className={th}>Agent</th>
                    <th className={th}>Akten<Tip text="Übernommene Lead-Akten (protokollierte Übernahme)" /></th>
                    <th className={th}>Kontakte<Tip text="Dokumentierte Kontakt-Ergebnisse (Leads + Kunden)" /></th>
                    <th className={th}>Links<Tip text="Versendete Antrags-/Zahlungslinks" /></th>
                    <th className={th}>Konversionen<Tip text="Leads → Antrag im Zeitraum" /></th>
                    <th className={th}>Abschlüsse<Tip text="Bezahlte Kunden (eine Wahrheit)" /></th>
                    <th className={th}>Umsatz</th>
                    <th className={th}>Provision</th>
                    <th className={th}>Reaktion<Tip text="Ø Stunden von Lead-Eingang bis erstem dokumentierten Kontakt dieses Agenten. Der Zuweisungs-Zeitpunkt wird historisch nicht gespeichert — Anker ist ehrlich der Lead-Eingang." /></th>
                    <th className={th}>Rückgaben<Tip text="Akten ohne Ergebnis geschlossen ÷ übernommene Akten" /></th>
                    <th className={th}>Direktzahler<Tip text="Anteil eigener Leads, die OHNE dokumentierten Kontakt selbst gezahlt haben — hohe Werte heißen: Chancen liegen ungenutzt." /></th>
                  </tr>
                </thead>
                <tbody>
                  {data.agents.length === 0 && (
                    <tr><td colSpan={11} className="px-4 py-10 text-center text-[13px] text-slate-400">
                      Keine Aktivität im gewählten Zeitraum. Wähle oben einen größeren Zeitraum — oder es wurde schlicht noch nichts dokumentiert.
                    </td></tr>
                  )}
                  {data.agents.map((a: any) => (
                    <>
                      <tr key={a.agentId} onClick={() => setDetail(detail === a.agentId ? null : a.agentId)}
                        className="border-b border-slate-50 hover:bg-slate-50/60 cursor-pointer transition-colors">
                        <td className={td}>
                          <span className="font-semibold text-slate-900">{a.name}</span>
                          {!a.active && <span className="ml-1.5 text-[10px] text-slate-400">(inaktiv)</span>}
                        </td>
                        <td className={td}>{a.akten}</td>
                        <td className={td}>{a.kontakte}</td>
                        <td className={td}>{a.links}</td>
                        <td className={td}>{a.konversionen}</td>
                        <td className={td + " font-bold"}>{a.abschluesse}</td>
                        <td className={td + " font-bold"}>{eur(a.umsatzCents)}</td>
                        <td className={td}>{eur(a.provisionCents)}</td>
                        <td className={td}>{a.reaktionStunden != null ? `${a.reaktionStunden} h` : "—"}</td>
                        <td className={td}>{a.rueckgabeQuote != null ? `${a.rueckgabeQuote} %` : "—"}</td>
                        <td className={td}>{a.direktzahlerQuote != null ? `${a.direktzahlerQuote} %` : "—"}</td>
                      </tr>
                      {detail === a.agentId && (
                        <tr key={`${a.agentId}-d`} className="border-b border-slate-100 bg-slate-50/40">
                          <td colSpan={11} className="px-4 py-3">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1.5">Kontakt-Ergebnisse nach Typ</p>
                            <div className="flex flex-wrap gap-2">
                              {Object.keys(a.outcomes).length === 0 && <span className="text-[12px] text-slate-400">Keine dokumentierten Ergebnisse im Zeitraum.</span>}
                              {Object.entries(a.outcomes).map(([k, v]) => (
                                <span key={k} className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-[12px] text-slate-600">
                                  {OUTCOME_LABEL[k] || k}: <b className="tabular-nums">{v as number}</b>
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Zeitverlauf + Quellen */}
          <div className="grid lg:grid-cols-2 gap-4 mb-5">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[13px] font-semibold text-slate-800 mb-1 flex items-center">Dokumentierte Kontakte / Tag<Tip text="Team-Summe aller dokumentierten Lead-Kontakt-Ergebnisse pro Tag" /></p>
              <Trend points={data.series.kontakte} />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-[13px] font-semibold text-slate-800 mb-1 flex items-center">Abschlüsse / Tag<Tip text="Bezahlte Kunden pro Tag (eine Wahrheit)" /></p>
              <Trend points={data.series.abschluesse} color="#64748b" />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-[13px] font-semibold text-slate-800 flex items-center">Quellen im Zeitraum<Tip text="Leads nach Quelle: wie viele kamen rein, wie viele wurden Antrag, wie viele haben bezahlt. Quelle mit vielen Leads aber 0 Konversion = möglicher technischer Ausfall." /></p>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50/70 border-b border-slate-100">
                <tr><th className={th}>Quelle</th><th className={th}>Leads</th><th className={th}>Konvertiert</th><th className={th}>Zahlend</th></tr>
              </thead>
              <tbody>
                {data.sources.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[13px] text-slate-400">Keine Leads im Zeitraum eingegangen.</td></tr>}
                {data.sources.map((s: any) => (
                  <tr key={s.quelle} className="border-b border-slate-50">
                    <td className={td}>{s.quelle}</td>
                    <td className={td}>{s.leads}</td>
                    <td className={td}>{s.konvertiert}</td>
                    <td className={td + " font-bold"}>{s.zahlend}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-[11.5px] text-slate-400 mt-4 leading-relaxed">
            Rechtlicher Rahmen: Diese Seite wertet ausschließlich Arbeitsergebnisse aus, die die Agenten selbst dokumentieren.
            Es gibt keine Erfassung von Arbeitszeit, Pausen, Anwesenheit oder Inaktivität. Jeder Agent sieht seine eigenen Zahlen
            im Portal (Spiegelansicht) — keine Geheim-Logs.
          </p>
        </>
      )}
    </div>
  );
}
