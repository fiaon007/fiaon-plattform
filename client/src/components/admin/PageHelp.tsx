import { useState, useRef, useEffect, useLayoutEffect, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
// - <Tip text="…"/> = kleines ⓘ mit Klartext-Definition.
//   KLICK-/TAP-basiert (kein natives title-Attribut) → funktioniert auch auf
//   dem Handy (kein Hover). Wird per Portal an <body> gehängt und positioniert
//   sich selbst im Viewport, damit es NIE von overflow-hidden-Tabellen oder
//   Karten abgeschnitten wird. Schließt bei Klick daneben oder ESC.
// ═══════════════════════════════════════════════════════════════════

export function Tip({ text, label }: { text: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; placement: "top" | "bottom" } | null>(null);

  const place = useCallback(() => {
    const b = btnRef.current?.getBoundingClientRect();
    if (!b) return;
    const margin = 8;
    const width = Math.min(280, window.innerWidth - margin * 2);
    let left = b.left + b.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    const estHeight = (cardRef.current?.offsetHeight ?? 0) || 120;
    const roomBelow = window.innerHeight - b.bottom;
    const placement: "top" | "bottom" = roomBelow > estHeight + margin || roomBelow > b.top ? "bottom" : "top";
    const top = placement === "bottom" ? b.bottom + 6 : b.top - 6;
    setPos({ top, left, width, placement });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onMove = () => place();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || cardRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <span
        ref={btnRef}
        role="button"
        tabIndex={0}
        aria-label={label || text}
        aria-expanded={open}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }
        }}
        className="inline-flex items-center justify-center align-middle ml-1 shrink-0 p-1.5 -m-1.5 cursor-pointer"
      >
        <span
          className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border text-[9px] font-bold select-none transition-colors duration-150 ${open ? "border-slate-400 bg-slate-100 text-slate-600" : "border-slate-300 text-slate-400"}`}
        >
          i
        </span>
      </span>
      {open && pos && createPortal(
        <div
          ref={cardRef}
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: pos.placement === "bottom" ? pos.top : undefined,
            bottom: pos.placement === "top" ? window.innerHeight - pos.top : undefined,
            left: pos.left,
            width: pos.width,
            zIndex: 90,
          }}
          className="fiaon-tip-card rounded-xl border border-slate-200 bg-white p-3 text-[12px] font-normal leading-relaxed text-slate-600 shadow-[0_10px_30px_-8px_rgba(15,23,42,0.22)]"
        >
          {text}
        </div>,
        document.body,
      )}
    </>
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
