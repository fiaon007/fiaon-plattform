import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════
// /admin/fahrplan — Fahrplan / Kundenprodukt (Admin-Gegenseite)
// Upload-Review (auditiert), Analyse anstoßen/prüfen/freigeben, Fahrplan
// steuern, Ziel-Freischaltung, Coaching-Texte, Audit über sensible Zugriffe.
// ═══════════════════════════════════════════════════════════════════

const api = (path: string, init?: RequestInit) =>
  fetch(`/api/fiaon${path}`, { credentials: "include", ...init }).then((r) => r.json());

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(n || 0));
const dt = (s: string) => (s ? new Date(s).toLocaleString("de-DE") : "—");

interface CustomerRow { ref: string; first_name: string; last_name: string; email: string; pack_name: string; account_status: string; statements: number; analysis_status: string | null; steps_total: number; steps_done: number }

export default function AdminFahrplanPage() {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [encKey, setEncKey] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [audit, setAudit] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"customers" | "settings" | "audit">("customers");

  const loadList = useCallback(() => { api("/admin/roadmap/customers").then((d) => d.ok && setCustomers(d.customers)); }, []);
  const loadSettings = useCallback(() => { api("/admin/roadmap/settings").then((d) => { if (d.ok) { setSettings(d.settings); setAiConfigured(d.aiConfigured); setEncKey(d.encryptionDedicatedKey); } }); }, []);
  const loadAudit = useCallback(() => { api("/admin/roadmap/audit").then((d) => d.ok && setAudit(d.audit)); }, []);
  const loadDetail = useCallback((ref: string) => { setDetail(null); api(`/admin/roadmap/${ref}`).then((d) => d.ok && setDetail(d)); }, []);

  useEffect(() => { loadList(); loadSettings(); loadAudit(); }, [loadList, loadSettings, loadAudit]);
  useEffect(() => { if (selected) loadDetail(selected); }, [selected, loadDetail]);

  const regenerate = async (ref: string) => { setBusy("regen"); await api(`/admin/roadmap/${ref}/analyze`, { method: "POST" }); await loadDetail(ref); setBusy(null); };
  const approve = async (ref: string) => { setBusy("approve"); await api(`/admin/roadmap/${ref}/analysis/approve`, { method: "POST" }); await loadDetail(ref); loadList(); setBusy(null); };

  const saveSettings = async (patch: any) => {
    setBusy("settings");
    const d = await api("/admin/roadmap/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (d.ok) setSettings(d.settings);
    setBusy(null);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Fahrplan / Kundenprodukt</h1>
        <div className="flex gap-2">
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${aiConfigured ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{aiConfigured ? "KI aktiv" : "KI nicht konfiguriert"}</span>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${encKey ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"}`}>{encKey ? "Dedizierter Enc-Key" : "Enc-Key: Fallback"}</span>
        </div>
      </div>
      <p className="text-[13px] text-slate-500 mb-5">Upload-Review, Analyse-Freigabe, Fahrplan-Steuerung, Ziel-Freischaltung und Audit. Zugriffe auf entschlüsselte Kontoauszüge werden protokolliert.</p>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100 p-1 rounded-xl w-fit">
        {([["customers", "Kunden"], ["settings", "Ziel & Texte"], ["audit", "Audit"]] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-lg text-[12px] font-semibold transition-all ${tab === id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>{label}</button>
        ))}
      </div>

      {tab === "customers" && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Liste */}
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">Kunden mit Fahrplan-Aktivität</div>
            <div className="max-h-[600px] overflow-y-auto divide-y divide-slate-50">
              {customers.length === 0 && <p className="p-4 text-[12px] text-slate-400">Noch keine Aktivität.</p>}
              {customers.map((c) => (
                <button key={c.ref} onClick={() => setSelected(c.ref)} className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selected === c.ref ? "bg-blue-50" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold text-slate-800 truncate">{c.first_name} {c.last_name}</span>
                    <span className="text-[10px] text-slate-400">{c.ref.slice(0, 14)}</span>
                  </div>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    <Tag>{c.statements} Auszüge</Tag>
                    {c.analysis_status && <Tag tone={c.analysis_status === "approved" ? "green" : "amber"}>Analyse {c.analysis_status === "approved" ? "frei" : "Entwurf"}</Tag>}
                    {c.steps_total > 0 && <Tag tone="blue">{c.steps_done}/{c.steps_total} Schritte</Tag>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-[13px] text-slate-400">Kunde auswählen, um Auszüge, Analyse und Fahrplan zu prüfen.</div>
            ) : !detail ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-[13px] text-slate-400">Lädt …</div>
            ) : (
              <Detail detail={detail} selected={selected} busy={busy} onRegenerate={regenerate} onApprove={approve} />
            )}
          </div>
        </div>
      )}

      {tab === "settings" && settings && (
        <SettingsPanel settings={settings} busy={busy === "settings"} onSave={saveSettings} />
      )}

      {tab === "audit" && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">Audit — Zugriffe auf sensible Kundendaten</div>
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase tracking-wider">
                <tr><th className="text-left px-4 py-2">Zeit</th><th className="text-left px-4 py-2">Akteur</th><th className="text-left px-4 py-2">Aktion</th><th className="text-left px-4 py-2">Kunde</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 text-slate-500 whitespace-nowrap">{dt(a.created_at)}</td>
                    <td className="px-4 py-2"><span className={`font-semibold ${a.actor_type === "admin" ? "text-blue-600" : "text-slate-600"}`}>{a.actor}</span><span className="text-slate-300 ml-1">({a.actor_type})</span></td>
                    <td className="px-4 py-2 text-slate-700">{a.action}</td>
                    <td className="px-4 py-2 text-slate-400">{a.ref || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "blue" }) {
  const map: Record<string, string> = { slate: "bg-slate-100 text-slate-500", green: "bg-emerald-50 text-emerald-600", amber: "bg-amber-50 text-amber-600", blue: "bg-blue-50 text-blue-600" };
  return <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${map[tone]}`}>{children}</span>;
}

function Detail({ detail, selected, busy, onRegenerate, onApprove }: { detail: any; selected: string; busy: string | null; onRegenerate: (r: string) => void; onApprove: (r: string) => void }) {
  const m = detail.state?.metrics;
  const raw = detail.analysisRaw;
  const analysis = raw?.data;
  return (
    <div className="space-y-4">
      {/* Consent */}
      <Card title="Einwilligungen (Consent-Protokoll)">
        {detail.consents.length === 0 ? <p className="text-[12px] text-slate-400">Keine Einwilligung erteilt.</p> : detail.consents.map((c: any, i: number) => (
          <div key={i} className="text-[12px] text-slate-600 flex justify-between"><span>{c.consent_type} · {c.version}</span><span className="text-slate-400">{dt(c.created_at)} · {c.ip || "—"}</span></div>
        ))}
      </Card>

      {/* Uploads */}
      <Card title="Hochgeladene Kontoauszüge (verschlüsselt)">
        {detail.statements.length === 0 ? <p className="text-[12px] text-slate-400">Keine Auszüge.</p> : (
          <div className="space-y-2">
            {detail.statements.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-[12px]">
                <span className="flex-1 truncate text-slate-700">{s.filename} <span className="text-slate-400">({(s.size_bytes / 1024 / 1024).toFixed(1)} MB · {dt(s.uploaded_at)})</span></span>
                {s.deleted_at ? <Tag tone="amber">gelöscht</Tag> : (
                  <a href={`/api/fiaon/admin/roadmap/${selected}/statement/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-blue-600 hover:underline">Ansehen (auditiert)</a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Metrics */}
      {m && (
        <Card title="Aggregierte Kennzahlen (das Einzige, was an die KI geht)">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12px]">
            <Metric label="Einnahmen" value={eur(m.totalIncome)} />
            <Metric label="Ausgaben" value={eur(m.totalExpenses)} />
            <Metric label="Saldo" value={eur(m.surplus)} tone={m.surplus < 0 ? "rose" : "emerald"} />
            <Metric label="Sparquote" value={`${m.savingsRatePct}%`} />
            <Metric label="Fixkostenquote" value={`${m.fixedCostRatioPct}%`} />
            <Metric label="Schuldenquote" value={`${m.debtToIncomePct}%`} />
          </div>
          {m.flags?.length > 0 && <div className="mt-2 flex gap-1.5 flex-wrap">{m.flags.map((f: string) => <Tag key={f} tone="amber">{f}</Tag>)}</div>}
        </Card>
      )}

      {/* Analyse */}
      <Card title="KI-Analyse (QS: Mensch gibt frei)">
        {!raw ? <p className="text-[12px] text-slate-400">Noch keine Analyse. Über „Analyse (neu)" erzeugen.</p> : (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Tag tone={raw.status === "approved" ? "green" : "amber"}>{raw.status === "approved" ? "Freigegeben" : "Entwurf"}</Tag>
              <span className="text-[11px] text-slate-400">{raw.generated_by === "openai" ? `KI (${raw.model})` : "Regelbasiert"} · {dt(raw.created_at)}</span>
            </div>
            <p className="text-[12px] text-slate-600 leading-relaxed">{analysis?.summary}</p>
            {analysis?.recommendations?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {analysis.recommendations.map((r: any, i: number) => <li key={i} className="text-[12px] text-slate-600"><strong>{i + 1}. {r.title}</strong> <span className="text-slate-400">— {r.category}</span></li>)}
              </ul>
            )}
          </div>
        )}
        <div className="flex gap-2 mt-3">
          <button onClick={() => onRegenerate(selected)} disabled={!!busy} className="px-3 py-2 rounded-lg text-[12px] font-semibold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40">{busy === "regen" ? "Erzeuge…" : "Analyse (neu)"}</button>
          {raw && raw.status !== "approved" && (
            <button onClick={() => onApprove(selected)} disabled={!!busy} className="px-3 py-2 rounded-lg text-[12px] font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#059669,#10b981)" }}>{busy === "approve" ? "Gebe frei…" : "Analyse + Fahrplan freigeben"}</button>
          )}
        </div>
      </Card>

      {/* Fahrplan-Schritte */}
      <Card title={`Fahrplan-Schritte (${detail.state.doneCount}/${detail.state.steps.length} erledigt)`}>
        {detail.state.steps.length === 0 ? <p className="text-[12px] text-slate-400">Noch keine Schritte (erst nach Freigabe der Analyse).</p> : (
          <div className="space-y-1.5">
            {detail.state.steps.map((s: any) => (
              <div key={s.id} className="flex items-center gap-2 text-[12px]">
                <span className={`w-4 h-4 rounded flex items-center justify-center ${s.status === "done" ? "bg-emerald-500" : "border border-slate-300"}`}>{s.status === "done" && <span className="text-white text-[9px]">✓</span>}</span>
                <span className="flex-1 text-slate-700">{s.title}</span>
                <Tag tone={s.source === "ai" ? "blue" : "slate"}>{s.source}</Tag>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Ziel-Status */}
      <Card title="Ziel-Etappe (Partner)">
        <div className="text-[12px] text-slate-600 space-y-1">
          {detail.state.goal.criteria.map((c: any) => (
            <div key={c.key} className="flex justify-between"><span className={c.met ? "text-emerald-600" : "text-slate-500"}>{c.met ? "✓" : "○"} {c.label}</span><span className="text-slate-400">{c.current}</span></div>
          ))}
          <div className="pt-2 mt-1 border-t border-slate-100 flex items-center gap-2">
            <Tag tone={detail.state.partner.stage === "unlocked" ? "green" : "amber"}>{detail.state.partner.stage === "unlocked" ? "freigeschaltet" : "in Vorbereitung"}</Tag>
            <span className="text-slate-400">Kein Live-Antrag, solange kein lizenzierter Partner angebunden ist.</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">{title}</h3>
      {children}
    </div>
  );
}

function Metric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "rose" }) {
  const c = tone === "emerald" ? "text-emerald-600" : tone === "rose" ? "text-rose-600" : "text-slate-800";
  return <div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] uppercase tracking-wider text-slate-400">{label}</p><p className={`text-[13px] font-bold ${c}`}>{value}</p></div>;
}

function SettingsPanel({ settings, busy, onSave }: { settings: any; busy: boolean; onSave: (p: any) => void }) {
  const [partnerStage, setPartnerStage] = useState(settings.partner_stage);
  const [autoApprove, setAutoApprove] = useState(settings.auto_approve_analysis !== false);
  const [minSteps, setMinSteps] = useState(settings.goal_min_completed_steps ?? 5);
  const [minSavings, setMinSavings] = useState(settings.goal_min_savings_rate ?? 10);
  const [maxDebt, setMaxDebt] = useState(settings.goal_max_debt_ratio ?? 35);
  const [coaching, setCoaching] = useState(settings.coaching_intro || "");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card title="Ziel-Freischaltung (Partner)">
        <p className="text-[12px] text-slate-500 mb-3">Solange kein lizenzierter Partner angebunden ist: global auf „in Vorbereitung" lassen. „Freigeschaltet" zeigt die Ziel-Etappe erst, wenn zusätzlich die Kriterien erfüllt sind.</p>
        <label className="flex items-center gap-2 mb-3 text-[13px] text-slate-700">
          <input type="radio" checked={partnerStage === "in_preparation"} onChange={() => setPartnerStage("in_preparation")} /> In Vorbereitung (Standard)
        </label>
        <label className="flex items-center gap-2 mb-4 text-[13px] text-slate-700">
          <input type="radio" checked={partnerStage === "unlocked"} onChange={() => setPartnerStage("unlocked")} /> Freigeschaltet (nur mit angebundenem Partner)
        </label>
        <div className="space-y-2.5">
          <Field label="Mind. abgeschlossene Schritte" value={minSteps} onChange={setMinSteps} />
          <Field label="Mind. Sparquote (%)" value={minSavings} onChange={setMinSavings} />
          <Field label="Max. Schuldenquote (%)" value={maxDebt} onChange={setMaxDebt} />
        </div>
      </Card>

      <Card title="Analyse-Freigabe & Coaching-Text">
        <label className="flex items-start gap-2 mb-4 text-[13px] text-slate-700 cursor-pointer">
          <input type="checkbox" checked={autoApprove} onChange={(e) => setAutoApprove(e.target.checked)} className="mt-0.5" />
          <span>KI-Analyse automatisch freigeben (aus = jede Analyse muss manuell geprüft/freigegeben werden)</span>
        </label>
        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Coaching-Intro (versioniert)</label>
        <textarea value={coaching} onChange={(e) => setCoaching(e.target.value)} rows={4} placeholder="Optionaler zentraler Coaching-Einleitungstext…" className="w-full text-[13px] rounded-xl border border-slate-200 p-3 focus:border-blue-400 outline-none" />
        <p className="text-[11px] text-slate-400 mt-1">Version {settings.coaching_version}. Bei Textänderung wird die Version automatisch erhöht.</p>
      </Card>

      <div className="lg:col-span-2">
        <button onClick={() => onSave({ partnerStage, autoApproveAnalysis: autoApprove, goalMinCompletedSteps: minSteps, goalMinSavingsRate: minSavings, goalMaxDebtRatio: maxDebt, coachingIntro: coaching })} disabled={busy} className="px-5 py-3 rounded-xl text-[13px] font-bold text-white disabled:opacity-40" style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>{busy ? "Speichern…" : "Einstellungen speichern"}</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: any; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-slate-600">{label}</span>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-24 text-[13px] rounded-lg border border-slate-200 px-2.5 py-1.5 text-right focus:border-blue-400 outline-none" />
    </div>
  );
}
