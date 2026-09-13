// ═══════════════════════════════════════════════════════════════════════════
// SIGNATUR-PAD — Finger oder Maus auf einer Leinwand
//
// ── HERKUNFT (13.09.2026) ──────────────────────────────────────────────────
// Lag bis heute lokal in `pages/agent/onboarding.tsx` (Vertragsunterschrift
// beim Eintritt). Mit dem Abschluss der Mitarbeiterzeit (Kündigung lesen und
// den Erhalt unterschreiben, `pages/mitarbeiter-abschluss.tsx`) braucht eine
// zweite Seite dasselbe Bauteil. Eine Leinwand, ein Ort — das Verhalten ist
// unverändert: Zeichnen über Pointer-Events, `onChange` bekommt die PNG-
// Daten-URL nach jedem Strich und `null` nach „Zurücksetzen".
//
// Die Leinwand nimmt beim ersten Aufbau die Bildschirmdichte auf, damit die
// Unterschrift auf Handys nicht verpixelt. Sie wird NICHT nachskaliert, wenn
// sich die Breite später ändert — das war im Onboarding so und bleibt so.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";

export default function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
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
