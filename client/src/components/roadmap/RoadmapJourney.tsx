import { useCallback, useEffect, useRef, useState } from "react";

/* ── Journey-spezifische Animationen (reduced-motion wird respektiert) ── */
if (typeof document !== "undefined" && !document.head.querySelector("style[data-rm-anim]")) {
  const s = document.createElement("style");
  s.setAttribute("data-rm-anim", "true");
  s.textContent = `
    @keyframes rmFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-7px)} }
    @keyframes rmShimmer { 0%{transform:translateX(-160%)} 100%{transform:translateX(160%)} }
    @keyframes rmPulse { 0%,100%{opacity:.55} 50%{opacity:1} }
    @keyframes rmGrow { from{transform:scaleX(0)} to{transform:scaleX(1)} }
    @keyframes rmPop { from{opacity:0;transform:translateY(12px) scale(.97)} to{opacity:1;transform:none} }
    .rm-pop { animation: rmPop .5s cubic-bezier(.22,1,.36,1) both; }
    .rm-float { animation: rmFloat 6s ease-in-out infinite; }
    .rm-goal-shine::after { content:''; position:absolute; inset:0; background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,.28) 48%,transparent 66%); transform:translateX(-160%); animation: rmShimmer 5s ease-in-out infinite; }
    @media (prefers-reduced-motion: reduce) {
      .rm-pop,.rm-float,.rm-goal-shine::after { animation: none !important; }
    }
  `;
  document.head.appendChild(s);
}

const eur = (n: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(n || 0));

type StageStatus = "done" | "active" | "locked";
interface Stage { key: string; title: string; status: StageStatus }
interface Step { id: number; ord: number; title: string; why: string; benefit: string; category: string; target_value: string | null; status: string; source: string }
interface RoadmapState {
  ok: boolean; ref: string; firstName: string; consent: boolean; consentVersion: string;
  statementsCount: number; metrics: any; analysis: any; analysisPending: boolean;
  steps: Step[]; doneCount: number; stages: Stage[]; activeIdx: number;
  goal: { criteria: { key: string; label: string; met: boolean; current: string }[]; allMet: boolean };
  partner: { stage: string; availableFrom: string; unlocked: boolean };
  aiConfigured: boolean;
}

const EDU_NOTE = "Bildungsinhalt · keine Finanzberatung";

/* Dezenter Bildungs-Hinweis (rechtlich verbindlich) */
function EduBadge({ light }: { light?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${light ? "bg-white/10 text-white/70" : "bg-slate-100 text-slate-500"}`}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      {EDU_NOTE}
    </span>
  );
}

export default function RoadmapJourney({ userRef, firstName }: { userRef: string; firstName?: string }) {
  const [state, setState] = useState<RoadmapState | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/fiaon/roadmap/${userRef}`);
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Fehler");
      setState(d);
    } catch (e: any) { setErr(e.message || "Konnte Fahrplan nicht laden"); }
    finally { setLoading(false); }
  }, [userRef]);

  useEffect(() => { load(); }, [load]);

  const giveConsent = async () => {
    if (!consentChecked) return;
    setSavingConsent(true);
    try {
      const r = await fetch(`/api/fiaon/roadmap/${userRef}/consent`, { method: "POST" });
      if (r.ok) await load();
    } finally { setSavingConsent(false); }
  };

  const doUpload = async () => {
    if (files.length === 0) return;
    setUploading(true); setErr(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("statements", f));
      const r = await fetch(`/api/fiaon/roadmap/${userRef}/upload`, { method: "POST", body: fd });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Upload fehlgeschlagen");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setUploading(false); }
  };

  const doAnalyze = async () => {
    setAnalyzing(true); setErr(null);
    try {
      const r = await fetch(`/api/fiaon/roadmap/${userRef}/analyze`, { method: "POST" });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error || "Analyse fehlgeschlagen");
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setAnalyzing(false); }
  };

  const toggleStep = async (id: number) => {
    setState((prev) => prev ? { ...prev, steps: prev.steps.map((s) => s.id === id ? { ...s, status: s.status === "done" ? "open" : "done" } : s) } : prev);
    await fetch(`/api/fiaon/roadmap/${userRef}/step/${id}/toggle`, { method: "POST" });
    load();
  };

  const deleteStatements = async () => {
    if (!confirm("Möchtest du alle hochgeladenen Kontoauszüge unwiderruflich löschen? Deine Analyse bleibt bestehen.")) return;
    await fetch(`/api/fiaon/roadmap/${userRef}/delete-statements`, { method: "POST" });
    load();
  };

  if (loading) return <div className="space-y-4">{[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}</div>;
  if (err && !state) return <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-[13px] text-rose-700">{err}</div>;
  if (!state) return null;

  const analysis = state.analysis?.data;
  const hasAnalysis = !!analysis;

  return (
    <div className="space-y-6">
      {/* ── HERO ── */}
      <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8" style={{ background: "linear-gradient(135deg,#0b1f3f 0%,#12335f 45%,#1a4a8a 100%)", boxShadow: "0 24px 60px -20px rgba(11,31,63,.55)" }}>
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-25 pointer-events-none" style={{ background: "radial-gradient(circle,#3b82f6,transparent 70%)" }} />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-white/60">Dein FIAON-Fahrplan</span>
            <EduBadge light />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight leading-tight">
            {firstName ? `${firstName}, hier beginnt deine Reise.` : "Hier beginnt deine Reise."}
          </h1>
          <p className="text-[13px] sm:text-[14px] text-white/70 mt-2 max-w-xl leading-relaxed">
            Wir analysieren deine Finanzen, erstellen deinen persönlichen Fahrplan und begleiten dich Schritt für Schritt — bis du wieder voll handlungsfähig bist: für Finanzierungen, Leasing und als Ziel eine <strong className="text-white/90">Kreditkarte über einen lizenzierten Partner</strong>, die du dir Schritt für Schritt <em>erarbeitest</em>.
          </p>
        </div>
      </div>

      {/* ── ETAPPEN-RAIL (die Reise) ── */}
      <StageRail stages={state.stages} />

      {/* ── ETAPPE 2: UPLOAD (Consent-Gate) ── */}
      <StageCard n={2} title="Kontoauszüge hochladen" active={state.activeIdx === 1} done={state.statementsCount > 0}
        subtitle="Die letzten 6 Monate — sicher & Ende-zu-Ende verschlüsselt gespeichert.">
        {!state.consent ? (
          <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
            <h4 className="text-[13px] font-bold text-slate-800 mb-2">Einwilligung in die Verarbeitung</h4>
            <p className="text-[12px] text-slate-600 leading-relaxed mb-3">
              Zur Erstellung deiner Analyse verarbeiten wir die Angaben aus deinen Kontoauszügen. <strong>So gehen wir mit deinen Daten um:</strong>
            </p>
            <ul className="space-y-1.5 mb-4 text-[12px] text-slate-600">
              {[
                "Deine Kontoauszüge werden verschlüsselt gespeichert (AES-256) und sind nur für dich und berechtigte, protokollierte FIAON-Mitarbeiter einsehbar.",
                "An unsere KI gehen ausschließlich anonyme, aggregierte Kennzahlen — niemals Namen, IBANs oder einzelne Buchungen.",
                "Du kannst deine Einwilligung jederzeit widerrufen und deine Auszüge löschen.",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" className="mt-0.5 shrink-0"><path d="M20 6 9 17l-5-5"/></svg>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
              <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#2563eb]" />
              <span className="text-[12px] text-slate-700">Ich willige in die verschlüsselte Verarbeitung meiner Kontoauszüge zu Analyse- und Bildungszwecken ein (Version {state.consentVersion}).</span>
            </label>
            <button onClick={giveConsent} disabled={!consentChecked || savingConsent}
              className="px-5 py-3 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 active:scale-[.98]" style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
              {savingConsent ? "Speichern…" : "Einwilligen & fortfahren"}
            </button>
          </div>
        ) : (
          <div>
            <div onClick={() => fileRef.current?.click()} className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all p-6 text-center cursor-pointer">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </div>
              <p className="text-[13px] font-semibold text-slate-700">Dateien auswählen oder hierher ziehen</p>
              <p className="text-[11px] text-slate-400 mt-1">PDF oder Foto · mehrere Monate · max. 25 MB je Datei</p>
              <input ref={fileRef} type="file" accept="application/pdf,image/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            </div>
            {files.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px] text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="truncate flex-1">{f.name}</span>
                    <span className="text-slate-400">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                ))}
                <button onClick={doUpload} disabled={uploading} className="mt-2 w-full py-3 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 active:scale-[.98]" style={{ background: "linear-gradient(135deg,#1d4ed8,#2563eb)" }}>
                  {uploading ? "Wird verschlüsselt hochgeladen…" : `${files.length} Datei(en) sicher hochladen`}
                </button>
              </div>
            )}
            {state.statementsCount > 0 && (
              <div className="mt-3 flex items-center justify-between text-[12px]">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                  {state.statementsCount} Dokument(e) sicher gespeichert
                </span>
                <button onClick={deleteStatements} className="text-slate-400 hover:text-rose-500 font-semibold">Auszüge löschen</button>
              </div>
            )}
          </div>
        )}
      </StageCard>

      {/* ── ETAPPE 3: KI-ANALYSE ── */}
      <StageCard n={3} title="KI-Analyse" active={state.activeIdx === 2} done={hasAnalysis} locked={state.statementsCount === 0}
        subtitle="Wir werten deine aggregierten Kennzahlen aus — anonym, ohne Namen oder IBANs.">
        {state.statementsCount === 0 ? (
          <p className="text-[12px] text-slate-400">Lade zuerst deine Kontoauszüge hoch, dann können wir deine Analyse erstellen.</p>
        ) : !hasAnalysis ? (
          <div>
            {state.analysisPending
              ? <p className="text-[12px] text-amber-600 font-semibold mb-3">Deine Analyse wird gerade von unserem Team geprüft und in Kürze freigegeben.</p>
              : <p className="text-[12px] text-slate-600 mb-3">Bereit! Starte jetzt deine persönliche Finanz-Analyse.</p>}
            {!state.analysisPending && (
              <button onClick={doAnalyze} disabled={analyzing} className="px-5 py-3 rounded-xl text-[13px] font-bold text-white transition-all disabled:opacity-40 active:scale-[.98]" style={{ background: "linear-gradient(135deg,#0f2d5c,#2563eb)" }}>
                {analyzing ? "Analyse läuft…" : "Analyse starten"}
              </button>
            )}
            {!state.aiConfigured && <p className="text-[11px] text-slate-400 mt-2">Hinweis: Die KI-Anreicherung ist noch nicht konfiguriert — du erhältst eine regelbasierte Analyse.</p>}
          </div>
        ) : (
          <AnalysisView analysis={analysis} />
        )}
      </StageCard>

      {/* ── ETAPPE 4/5: FAHRPLAN & FORTSCHRITT ── */}
      <StageCard n={4} title="Dein persönlicher Fahrplan" active={state.activeIdx === 3 || state.activeIdx === 4} done={state.steps.length > 0 && state.doneCount === state.steps.length} locked={!hasAnalysis}
        subtitle="Priorisierte, umsetzbare Schritte — hake ab, was du erledigt hast.">
        {state.steps.length === 0 ? (
          <p className="text-[12px] text-slate-400">Dein Fahrplan erscheint hier, sobald deine Analyse vorliegt.</p>
        ) : (
          <StepsView steps={state.steps} doneCount={state.doneCount} onToggle={toggleStep} />
        )}
      </StageCard>

      {/* ── ETAPPE 6: ZIEL-KARTE ── */}
      <GoalCard state={state} />

      {err && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[12px] text-rose-700">{err}</div>}
    </div>
  );
}

/* ── Etappen-Rail (die sichtbare Reise) ── */
function StageRail({ stages }: { stages: Stage[] }) {
  const doneCount = stages.filter((s) => s.status === "done").length;
  const pct = Math.round((doneCount / stages.length) * 100);
  return (
    <div className="rounded-2xl bg-white border border-slate-100 shadow-sm p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-slate-400">Deine Etappen</p>
        <p className="text-[12px] font-bold text-slate-500">{doneCount} <span className="font-normal text-slate-300">von</span> {stages.length}</p>
      </div>
      {/* Fortschrittsbalken */}
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-5">
        <div className="h-full rounded-full origin-left" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#2563eb,#3b82f6)" }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {stages.map((s, i) => {
          const isGoal = s.key === "goal";
          const tone = s.status === "done" ? "done" : s.status === "active" ? "active" : "locked";
          return (
            <div key={s.key} className={`relative rounded-xl p-3 border transition-all ${tone === "done" ? "bg-emerald-50 border-emerald-100" : tone === "active" ? "bg-blue-50 border-blue-200 shadow-[0_4px_16px_rgba(37,99,235,.12)]" : "bg-slate-50 border-slate-100"}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${tone === "done" ? "bg-emerald-500" : tone === "active" ? "bg-[#2563eb]" : "bg-slate-200"}`}>
                {tone === "done"
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
                  : isGoal
                    ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={tone === "locked" ? "#94a3b8" : "white"} strokeWidth="2" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    : tone === "locked"
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                      : <span className="text-white text-[11px] font-bold">{i + 1}</span>}
              </div>
              <p className={`text-[11px] font-bold leading-tight ${tone === "locked" ? "text-slate-400" : "text-slate-800"}`}>{s.title}</p>
              <p className={`text-[9px] font-semibold uppercase tracking-wider mt-1 ${tone === "done" ? "text-emerald-500" : tone === "active" ? "text-blue-500" : "text-slate-300"}`}>
                {tone === "done" ? "Erledigt" : tone === "active" ? "Aktiv" : "Gesperrt"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Etappen-Karte (Wrapper) ── */
function StageCard({ n, title, subtitle, active, done, locked, children }: { n: number; title: string; subtitle?: string; active?: boolean; done?: boolean; locked?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rm-pop rounded-2xl border shadow-sm overflow-hidden ${locked ? "border-slate-100 opacity-70" : active ? "border-blue-200 shadow-[0_8px_28px_rgba(37,99,235,.10)]" : "border-slate-100"}`} style={{ background: "#fff" }}>
      <div className="px-5 sm:px-6 py-4 flex items-center gap-3 border-b border-slate-50">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${done ? "bg-emerald-500" : locked ? "bg-slate-100" : "bg-[#2563eb]"}`}>
          {done ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>
            : locked ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            : <span className="text-white text-[13px] font-bold">{n}</span>}
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-5 sm:px-6 py-5">{children}</div>
    </div>
  );
}

/* ── Analyse-Ansicht ── */
function AnalysisView({ analysis }: { analysis: any }) {
  const factorTone = (s: string) => s === "gut" ? "text-emerald-600 bg-emerald-50" : s === "kritisch" ? "text-rose-600 bg-rose-50" : "text-amber-600 bg-amber-50";
  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: "linear-gradient(145deg,#f8fafc,#eff6ff)", border: "1px solid #e2e8f0" }}>
        <p className="text-[13px] text-slate-700 leading-relaxed">{analysis.summary}</p>
        <div className="mt-3"><EduBadge /></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {analysis.strengths?.length > 0 && (
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 mb-2">Deine Stärken</p>
            <ul className="space-y-1.5">{analysis.strengths.map((t: string, i: number) => <li key={i} className="text-[12px] text-slate-600 flex gap-2"><span className="text-emerald-500">+</span>{t}</li>)}</ul>
          </div>
        )}
        {analysis.risks?.length > 0 && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 mb-2">Worauf du achten solltest</p>
            <ul className="space-y-1.5">{analysis.risks.map((t: string, i: number) => <li key={i} className="text-[12px] text-slate-600 flex gap-2"><span className="text-amber-500">!</span>{t}</li>)}</ul>
          </div>
        )}
      </div>
      {analysis.scoreFactors?.length > 0 && (
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Scoring-Faktoren</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {analysis.scoreFactors.map((f: any, i: number) => (
              <div key={i} className="rounded-xl border border-slate-100 p-3">
                <div className={`inline-block text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full mb-1.5 ${factorTone(f.status)}`}>{f.status}</div>
                <p className="text-[12px] font-semibold text-slate-700 leading-tight">{f.factor}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{f.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Schritte-Ansicht (Fahrplan) ── */
function StepsView({ steps, doneCount, onToggle }: { steps: Step[]; doneCount: number; onToggle: (id: number) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[12px] font-semibold text-slate-500">{doneCount} von {steps.length} Schritten erledigt</p>
        <EduBadge />
      </div>
      {steps.map((s) => {
        const done = s.status === "done";
        return (
          <div key={s.id} className={`rounded-2xl border p-4 transition-all ${done ? "border-emerald-100 bg-emerald-50/40" : "border-slate-100 bg-white hover:border-blue-200"}`}>
            <div className="flex items-start gap-3">
              <button onClick={() => onToggle(s.id)} className={`w-6 h-6 rounded-lg shrink-0 flex items-center justify-center mt-0.5 transition-all ${done ? "bg-emerald-500" : "border-2 border-slate-200 hover:border-blue-400"}`}>
                {done && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">{s.category}</span>
                  {s.target_value && <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-full">Ziel: {s.target_value}</span>}
                </div>
                <p className={`text-[13px] font-bold mt-1.5 ${done ? "text-slate-400 line-through" : "text-slate-800"}`}>{s.title}</p>
                {s.why && <p className="text-[12px] text-slate-500 mt-1 leading-relaxed"><strong className="text-slate-600">Warum:</strong> {s.why}</p>}
                {s.benefit && <p className="text-[12px] text-emerald-600 mt-0.5 leading-relaxed"><strong>Nutzen:</strong> {s.benefit}</p>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Ziel-Karte (edle, freischaltbare Belohnung) ── */
function GoalCard({ state }: { state: RoadmapState }) {
  const unlocked = state.partner.unlocked;
  const availFrom = state.partner.availableFrom ? new Date(state.partner.availableFrom).toLocaleDateString("de-DE", { month: "long", year: "numeric" }) : "Q4 2026";
  return (
    <div className="relative rm-goal-shine overflow-hidden rounded-3xl p-6 sm:p-8" style={{ background: "linear-gradient(145deg,#0d1117 0%,#161b27 55%,#1e2a44 100%)", boxShadow: "0 30px 70px -22px rgba(0,0,0,.6)" }}>
      <div className="absolute -bottom-16 -left-10 w-56 h-56 rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle,#2563eb,transparent 70%)" }} />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Karte-Visual */}
        <div className="w-full sm:w-56 shrink-0">
          <div className={`rm-float w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden ${unlocked ? "" : "grayscale-[.3]"}`} style={{ background: "linear-gradient(145deg,#0f2d5c,#1a4a8a,#2563eb)", border: "1px solid rgba(255,255,255,.12)", boxShadow: "0 20px 40px -10px rgba(37,99,235,.4)" }}>
            <div className="absolute inset-0 p-4 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <span className="text-sm font-bold text-white/90">FIAON</span>
                <span className="text-[8px] font-semibold uppercase tracking-widest text-white/50">Ziel</span>
              </div>
              <div className="w-8 h-6 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875)" }} />
              <div className="text-[9px] font-semibold uppercase tracking-[.15em] text-white/60">Deine künftige Karte</div>
            </div>
            {!unlocked && (
              <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(4,7,15,.45)", backdropFilter: "blur(1px)" }}>
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Text + Kriterien */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-white/50">Dein Ziel</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300">In Vorbereitung</span>
          </div>
          <h3 className="text-xl font-bold text-white tracking-tight">Kreditkarte über einen lizenzierten Partner</h3>
          <p className="text-[12px] text-white/60 mt-1.5 leading-relaxed">
            Die Vermittlung an einen lizenzierten Partner ist <strong className="text-white/80">für {availFrom} in DE, AT & CH geplant</strong>. Bis dahin arbeitest du hier gezielt auf die nötigen Parameter hin — dein Fortschritt bringt dich näher ans Ziel. Kein zugesagtes Produkt, kein garantiertes Limit.
          </p>
          <div className="mt-4 space-y-2">
            {state.goal.criteria.map((c) => (
              <div key={c.key} className="flex items-center gap-2.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${c.met ? "bg-emerald-500" : "bg-white/10"}`}>
                  {c.met ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><path d="M20 6 9 17l-5-5"/></svg> : <div className="w-1.5 h-1.5 rounded-full bg-white/30" />}
                </div>
                <span className={`text-[12px] flex-1 ${c.met ? "text-white/80" : "text-white/50"}`}>{c.label}</span>
                <span className="text-[11px] font-semibold text-white/40">{c.current}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <button disabled className="px-5 py-2.5 rounded-xl text-[12px] font-bold text-white/70 cursor-not-allowed" style={{ background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)" }}>
              {state.goal.allMet ? "Ziel erreicht — Partner-Vermittlung bald verfügbar" : "Partner-Vermittlung in Vorbereitung"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
