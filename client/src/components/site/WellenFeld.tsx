// ═══════════════════════════════════════════════════════════════════════════
// WellenFeld — der Übergang dunkel ↔ hell als fließendes Punktfeld (23.08.2026)
//
// Justin: „Die Farbübergänge sollen so sein wie auf den Bildern — ein flüssiger
// Verlauf, Punkte, die als Welle schwingen, moderner." Also kein SVG-Bogen mehr,
// sondern eine Leinwand: Reihen leuchtender Punkte, die über zwei überlagerte
// Sinuswellen laufen (Cyan oben, Blau in der Mitte), dazu der weiche Farbverlauf
// von Nachtblau in das helle Papier. Das Feld rechnet nur, wenn es sichtbar ist.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";

export default function WellenFeld({ unten = false, className = "" }: { unten?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const ruhe = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let W = 0, H = 0, dpr = 1, raf = 0, sichtbar = false, t = 0;

    // Ein Leuchtpunkt als vorgerendertes Bild — viel schneller als shadowBlur.
    const punkt = (farbe: string) => {
      const s = document.createElement("canvas"); s.width = s.height = 24;
      const g = s.getContext("2d")!; const r = g.createRadialGradient(12, 12, 0, 12, 12, 12);
      r.addColorStop(0, "rgba(255,255,255,.95)"); r.addColorStop(.25, farbe); r.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = r; g.fillRect(0, 0, 24, 24); return s;
    };
    const cyan = punkt("rgba(94,231,255,.9)"), blau = punkt("rgba(96,165,250,.85)"), tief = punkt("rgba(37,99,235,.75)");

    const groesse = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = c.clientWidth; H = c.clientHeight;
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    groesse();
    const ro = new ResizeObserver(groesse); ro.observe(c);

    const zeichne = () => {
      ctx.clearRect(0, 0, W, H);
      const reihen = 11, abstand = Math.max(9, Math.min(14, W / 120));
      const spalten = Math.ceil(W / abstand) + 2;
      // Blickrichtung: oben dunkel, unten hell (bei `unten` gespiegelt)
      for (let r = 0; r < reihen; r++) {
        const f = r / (reihen - 1);                      // 0 = vorne/oben, 1 = hinten/unten
        const basis = H * (0.22 + f * 0.62);
        const amp1 = H * (0.16 - f * 0.07), amp2 = H * 0.06;
        const sprite = f < 0.35 ? cyan : f < 0.7 ? blau : tief;
        // Im dunklen Teil leuchten die Punkte, im hellen werden sie leise — so trägt das Feld den Übergang, statt ihn zu markieren.
        const alpha = (unten ? f : 1 - f) * 0.78 + 0.06;
        const gr = 4 + (1 - f) * 5;
        ctx.globalAlpha = alpha;
        for (let i = 0; i < spalten; i++) {
          const x = i * abstand - abstand;
          const p = x / W;
          const y = basis + Math.sin(p * 6.2 + t * 0.9 + r * 0.45) * amp1 + Math.sin(p * 13.1 - t * 1.4 + r * 0.2) * amp2;
          const yy = unten ? H - y : y;
          ctx.drawImage(sprite, x - gr / 2, yy - gr / 2, gr, gr);
        }
      }
      ctx.globalAlpha = 1;
    };
    const lauf = () => {
      raf = requestAnimationFrame(lauf);
      if (!sichtbar || document.hidden) return;
      t += 0.016; zeichne();
    };
    const io = new IntersectionObserver(([e]) => { sichtbar = e.isIntersecting; if (sichtbar) zeichne(); }, { threshold: 0.01 });
    io.observe(c);
    zeichne();
    if (!ruhe) lauf();
    return () => { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); };
  }, [unten]);

  return <canvas ref={ref} className={`dk-wellenfeld${unten ? " unten" : ""} ${className}`} aria-hidden="true" />;
}
