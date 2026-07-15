import { useState, type ReactNode } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════
// P4-D — JEDE SEITE ERKLÄRT SICH SELBST (Vorbild: Leads-Seite).
// Einheitliches Muster für alle Admin-Seiten:
//   <PageIntro id="zahlungen" title="Zahlungszentrale"
//     subtitle="Hier prüfst du angekündigte Zahlungen und schaltest sie frei."
//     steps={["…", "…"]} />
// - Titel + Untertitel in Du-Form
// - Einklappbares „Wie funktioniert diese Seite?" — beim ERSTEN Besuch offen,
//   danach merkt sich localStorage die Entscheidung (pro Seite).
// - <Tip text="…"/> = kleines ⓘ mit Klartext-Definition (native title,
//   funktioniert auf Desktop-Hover und Mobile-Longpress).
// ═══════════════════════════════════════════════════════════════════

export function Tip({ text }: { text: string }) {
  return (
    <span
      title={text}
      aria-label={text}
      className="inline-flex items-center justify-center w-3.5 h-3.5 ml-1 rounded-full border border-slate-300 text-slate-400 text-[9px] font-bold cursor-help align-middle select-none"
    >
      i
    </span>
  );
}

export function PageIntro({
  id, title, subtitle, steps, right,
}: {
  /** eindeutiger Seiten-Schlüssel für den localStorage-Merker */
  id: string;
  title: string;
  /** Du-Form: „Hier machst du X." */
  subtitle: string;
  /** Klartext-Schritte für „Wie funktioniert diese Seite?" */
  steps: string[];
  /** optionaler Bereich rechts neben dem Titel (z. B. Primär-Button) */
  right?: ReactNode;
}) {
  const key = `fiaon-help-${id}`;
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(key) == null; } catch { return true; }
  });
  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      try { localStorage.setItem(key, next ? "open" : "closed"); } catch {}
      return next;
    });
  };
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>
        </div>
        {right}
      </div>
      <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={toggle}
          className="w-full px-4 py-2.5 flex items-center gap-2 text-left"
        >
          <HelpCircle size={14} className="text-slate-400 shrink-0" />
          <span className="text-[12.5px] font-semibold text-slate-600 flex-1">Wie funktioniert diese Seite?</span>
          <ChevronDown size={14} className={`text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <ol className="px-4 pb-3.5 pt-0.5 space-y-1.5 border-t border-slate-100 mt-0">
            {steps.map((s, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] text-slate-600 leading-relaxed first:pt-3">
                <span className="shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10.5px] font-bold flex items-center justify-center mt-[1px]">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
