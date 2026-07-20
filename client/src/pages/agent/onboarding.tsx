import { useState, useEffect, useRef, useCallback } from "react";
import { ShieldCheck, ScrollText, FileSignature, Check, ChevronDown, Lock, AlertTriangle } from "lucide-react";
import { api, ACCENT, inputCls } from "./shared";
import { SignatureCore } from "./motion";

// ============================================================================
// Onboarding-Gate (Prompt 1) — Pflicht-Flow beim Login.
// Schritt 1: Zustimmung (3 Blöcke, je Checkbox + ausklappbarer Volltext).
// Schritt 2: personalisierter Vertrag (Prompt 2) lesen → digital unterschreiben.
// Nicht wegklickbar, zentriert/modern, mobil als Vollbild-Flow (ab 380 px).
// Erst wenn beides erledigt ist → onComplete() (Portal wird freigeschaltet).
// ============================================================================

interface DocMeta { key: string; title: string; version: number; summary: string; html: string; }
interface StatusDoc { key: string; title: string; version: number; accepted: boolean; acceptedAt: string | null; }
interface OnbStatus {
  complete: boolean;
  consent: { complete: boolean; docs: StatusDoc[] };
  contract: { complete: boolean; hasActiveTemplate: boolean; templateVersion: number | null; signedAt: string | null; contractId: number | null };
}
interface ContractInfo { hasActiveTemplate: boolean; templateVersion: number | null; title: string | null; html: string | null; missing: string[]; }

const DOC_ICON: Record<string, typeof ShieldCheck> = {
  datenschutz: ShieldCheck,
  verhalten: AlertTriangle,
  nutzung: ScrollText,
};

export default function OnboardingGate({ onComplete }: { onComplete: () => void }) {
  const [status, setStatus] = useState<OnbStatus | null>(null);
  const [documents, setDocuments] = useState<DocMeta[]>([]);
  const [contract, setContract] = useState<ContractInfo | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    api("/agent/onboarding").then((r) => {
      if (r.ok) {
        setStatus(r.json.status);
        setDocuments(r.json.documents || []);
        setContract(r.json.contract || null);
        if (r.json.status?.complete) onComplete();
      }
      setLoaded(true);
    });
  }, [onComplete]);

  useEffect(load, [load]);

  // Scroll sperren, solange das Gate offen ist.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const step: 1 | 2 = status && status.consent.complete ? 2 : 1;

  return (
    <div className="agent-scope fixed inset-0 z-[100] bg-slate-50 overflow-y-auto">
      <div className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[15px] font-bold tracking-tight" style={{ color: ACCENT }}>FIAON</span>
              <span className="text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400 truncate">Onboarding</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
              <Lock size={13} strokeWidth={2} />
              <span className="hidden sm:inline">Zugriff gesperrt bis Abschluss</span>
            </div>
          </div>
          <StepBar step={step} />
        </header>

        <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 pb-24">
          {!loaded ? (
            <div className="py-24 flex justify-center"><SignatureCore size={64} /></div>
          ) : step === 1 ? (
            <ConsentStep documents={documents} status={status!} onChanged={setStatus} />
          ) : (
            <ContractStep contract={contract} onSigned={() => { load(); onComplete(); }} />
          )}
        </main>
      </div>
    </div>
  );
}

function StepBar({ step }: { step: 1 | 2 }) {
  const items = [
    { n: 1, label: "Zustimmung" },
    { n: 2, label: "Vertrag" },
  ];
  return (
    <div className="max-w-2xl mx-auto px-4 pb-3 flex items-center gap-2">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        return (
          <div key={it.n} className="flex items-center gap-2 flex-1">
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition-colors"
              style={{
                background: done || active ? ACCENT : "#e2e8f0",
                color: done || active ? "#fff" : "#94a3b8",
              }}
            >
              {done ? <Check size={13} strokeWidth={3} /> : it.n}
            </span>
            <span className="text-[12px] font-semibold" style={{ color: active || done ? "#0f172a" : "#94a3b8" }}>{it.label}</span>
            {i === 0 && <span className="flex-1 h-0.5 rounded-full" style={{ background: step > 1 ? ACCENT : "#e2e8f0" }} />}
          </div>
        );
      })}
    </div>
  );
}

// ── Schritt 1: Zustimmung ────────────────────────────────────────────────────
function ConsentStep({ documents, status, onChanged }: {
  documents: DocMeta[];
  status: OnbStatus;
  onChanged: (s: OnbStatus) => void;
}) {
  const [open, setOpen] = useState<string | null>(documents[0]?.key || null);
  const [busy, setBusy] = useState<string | null>(null);

  const accepted = (key: string) => status.consent.docs.find((d) => d.key === key)?.accepted;

  const accept = async (key: string) => {
    if (accepted(key)) return;
    setBusy(key);
    const r = await api("/agent/onboarding/consent", { method: "POST", body: JSON.stringify({ docKey: key }) });
    setBusy(null);
    if (r.ok) onChanged(r.json.status);
  };

  const allDone = status.consent.complete;

  return (
    <div>
      <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Willkommen — kurz bestätigen, dann geht's los</h1>
      <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
        Bevor du echte Kundendaten siehst, bestätige bitte die folgenden Hinweise. Jede Zustimmung wird
        mit Datum, Uhrzeit (Berlin) und Version protokolliert.
      </p>

      <div className="mt-5 space-y-3">
        {documents.map((doc) => {
          const Icon = DOC_ICON[doc.key] || ScrollText;
          const isOpen = open === doc.key;
          const ok = accepted(doc.key);
          return (
            <div key={doc.key} className={`rounded-2xl border bg-white transition-colors ${ok ? "border-slate-300" : "border-slate-200"}`}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : doc.key)}
                className="w-full flex items-start gap-3 p-4 text-left"
              >
                <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                  <Icon size={17} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-slate-900">{doc.title}</span>
                    {ok && <Check size={15} strokeWidth={3} style={{ color: ACCENT }} />}
                  </span>
                  <span className="block text-[12px] text-slate-500 mt-0.5 leading-relaxed">{doc.summary}</span>
                </span>
                <ChevronDown size={17} className={`text-slate-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>

              {isOpen && (
                <div className="px-4 pb-4">
                  <div
                    className="onb-doc text-[12.5px] text-slate-600 leading-relaxed max-h-64 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-3.5"
                    dangerouslySetInnerHTML={{ __html: doc.html }}
                  />
                  <label className={`mt-3 flex items-center gap-3 rounded-xl border p-3 cursor-pointer select-none transition-colors ${ok ? "border-slate-300 bg-slate-50" : "border-slate-200 hover:border-slate-300"}`}>
                    <input
                      type="checkbox"
                      checked={!!ok}
                      disabled={!!ok || busy === doc.key}
                      onChange={() => accept(doc.key)}
                      className="w-5 h-5 rounded accent-[#2563eb] shrink-0"
                    />
                    <span className="text-[12.5px] font-semibold text-slate-700">
                      Ich habe „{doc.title}“ gelesen und stimme zu.
                    </span>
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3">
        {allDone ? (
          <>
            <Check size={18} strokeWidth={3} style={{ color: ACCENT }} />
            <span className="text-[13px] font-semibold text-slate-700">Alle Zustimmungen erteilt — weiter zum Vertrag.</span>
          </>
        ) : (
          <span className="text-[12.5px] text-slate-500">Bitte allen drei Hinweisen zustimmen, um fortzufahren.</span>
        )}
      </div>
    </div>
  );
}

// ── Schritt 2: Vertrag lesen + unterschreiben ────────────────────────────────
function ContractStep({ contract, onSigned }: { contract: ContractInfo | null; onSigned: () => void }) {
  const [readEnd, setReadEnd] = useState(false);
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"drawn" | "typed">("drawn");
  const [sigData, setSigData] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!contract?.hasActiveTemplate) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
        <Lock size={26} className="mx-auto text-slate-400" />
        <h2 className="mt-3 text-[16px] font-bold text-slate-900">Vertrag wird vorbereitet</h2>
        <p className="mt-1.5 text-[13px] text-slate-500 leading-relaxed">
          Dein persönlicher Vertrag wird gerade vom FIAON-Team fertiggestellt. Sobald er bereitsteht,
          kannst du ihn hier lesen und unterschreiben. Bitte in Kürze erneut anmelden.
        </p>
      </div>
    );
  }

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setReadEnd(true);
  };

  const canSign = readEnd && confirmed && name.trim().length >= 3 && (mode === "typed" || !!sigData);

  const sign = async () => {
    setError(null);
    setBusy(true);
    const r = await api("/agent/onboarding/sign", {
      method: "POST",
      body: JSON.stringify({
        signatureName: name.trim(),
        signatureMode: mode,
        signaturePng: mode === "drawn" ? sigData : null,
        confirm: true,
      }),
    });
    setBusy(false);
    if (r.ok) onSigned();
    else setError(r.json?.error || "Signatur fehlgeschlagen");
  };

  return (
    <div>
      <h1 className="text-[20px] font-bold text-slate-900 tracking-tight">Dein Handelsvertretervertrag</h1>
      <p className="text-[13px] text-slate-500 mt-1 leading-relaxed">
        Bitte lies den Vertrag vollständig durch (bis zum Ende scrollen) und unterschreibe anschließend digital.
      </p>

      {contract.missing.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12px] text-amber-800 leading-relaxed">
          Hinweis: Einige Vertragsangaben fehlen noch ({contract.missing.join(", ")}). Der Vertrag kann dennoch
          gelesen werden — bitte prüfe die Angaben und wende dich bei Fragen an das FIAON-Team.
        </div>
      )}

      <div
        onScroll={onScroll}
        className="onb-contract mt-4 max-h-[52vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 text-[12px] text-slate-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: contract.html || "" }}
      />
      <div className="mt-2 flex items-center gap-2 text-[11.5px]">
        {readEnd ? (
          <><Check size={14} strokeWidth={3} style={{ color: ACCENT }} /><span className="font-semibold text-slate-600">Vollständig gelesen</span></>
        ) : (
          <span className="text-slate-400">Bitte bis zum Ende scrollen, um die Signatur freizuschalten.</span>
        )}
      </div>

      <div className={`mt-5 rounded-2xl border border-slate-200 bg-white p-4 transition-opacity ${readEnd ? "" : "opacity-40 pointer-events-none"}`}>
        <div className="flex items-center gap-2 mb-3">
          <FileSignature size={16} style={{ color: ACCENT }} />
          <span className="text-[13px] font-bold text-slate-900">Digitale Signatur</span>
        </div>

        <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Vollständiger Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" className={inputCls} style={{ minHeight: 46 }} />

        <div className="mt-4 flex gap-2">
          <ModeButton active={mode === "drawn"} onClick={() => setMode("drawn")}>Unterschrift zeichnen</ModeButton>
          <ModeButton active={mode === "typed"} onClick={() => setMode("typed")}>Name tippen (Fallback)</ModeButton>
        </div>

        {mode === "drawn" ? (
          <SignaturePad onChange={setSigData} />
        ) : (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
            <span style={{ fontFamily: "'Brush Script MT', cursive", fontSize: 30 }} className="text-slate-800">
              {name || "Dein Name"}
            </span>
            <p className="text-[11px] text-slate-400 mt-1">Getippte Namensbestätigung als rechtsgültige Signatur.</p>
          </div>
        )}

        <label className="mt-4 flex items-start gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="w-5 h-5 rounded accent-[#2563eb] shrink-0 mt-0.5" />
          <span className="text-[12.5px] font-semibold text-slate-700 leading-relaxed">
            I sign this agreement legally and bindingly. / Ich unterzeichne diesen Vertrag rechtsverbindlich.
          </span>
        </label>

        {error && <p className="mt-3 text-[12px] font-medium text-red-700 border border-red-200 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <button
          type="button"
          disabled={!canSign || busy}
          onClick={sign}
          className="mt-4 w-full py-3.5 rounded-xl text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-all disabled:opacity-40 active:scale-[.99]"
          style={{ background: ACCENT, minHeight: 50, boxShadow: "0 8px 20px -10px rgba(37,99,235,.6)" }}
        >
          {busy ? "Wird signiert …" : "Vertrag rechtsverbindlich unterschreiben"}
        </button>
      </div>
    </div>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-[12px] font-semibold border transition-colors ${active ? "text-white border-transparent" : "text-slate-600 border-slate-200 hover:border-slate-300"}`}
      style={active ? { background: ACCENT } : undefined}
    >
      {children}
    </button>
  );
}

// ── Signatur-Pad (Finger/Maus) ───────────────────────────────────────────────
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#0f172a";
    }
  }, []);

  const pos = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk.current = true;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    onChange(hasInk.current ? canvasRef.current!.toDataURL("image/png") : null);
  };
  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange(null);
  };

  return (
    <div className="mt-3">
      <div className="relative rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
        <canvas
          ref={canvasRef}
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          className="w-full touch-none block"
          style={{ height: 150 }}
        />
        <span className="absolute bottom-2 left-0 right-0 text-center text-[10px] text-slate-300 pointer-events-none">Hier mit Finger oder Maus unterschreiben</span>
      </div>
      <button type="button" onClick={clear} className="mt-2 text-[11.5px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
        Zurücksetzen
      </button>
    </div>
  );
}
