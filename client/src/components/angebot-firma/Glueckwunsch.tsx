// ═══════════════════════════════════════════════════════════════════════════
// DER AUFTAKT „HERZLICHEN GLÜCKWUNSCH“ (E-301)
//
// Justin (07.10.2026): „Es soll eine Freude für sie sein.“ Vollflächig auf
// Elfenbein, feiner Goldstaub (Canvas 2D, ~120 Teilchen steigen langsam und
// funkeln), darauf Auge → Goldlinie → großer Gruß → Zeile → „weiter“. Nach
// etwa 4,6 s, per Klick, „weiter“ oder Escape gleitet der Auftakt nach oben weg und
// gibt den Hero frei. Alles beginnt erst, wenn die Startbühne der App (#fi-start)
// geht — sonst lief der Gruß unsichtbar hinter ihr ab (Gutachten 07.10.2026). Liegt
// der Zeiger auf dem Auftakt oder der Fokus auf „weiter“, wartet er. „Weniger Bewegung“: kein Staub, keine Bewegung — nur
// stehen und dann ohne Gleiten verschwinden. Alle Texte aus seite.auftakt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { ruhig } from "./gemeinsam";

type Teilchen = { x: number; y: number; r: number; v: number; phase: number; drift: number; hell: number };

function staubStarten(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let b = 0, h = 0, raf = 0, letzte = performance.now();
  const teilchen: Teilchen[] = [];
  const groesse = () => {
    b = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(b * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  groesse();
  const anzahl = b < 600 ? 80 : 120;
  for (let i = 0; i < anzahl; i++) {
    teilchen.push({ x: Math.random() * b, y: Math.random() * h, r: 0.5 + Math.random() * 1.7, v: 6 + Math.random() * 16, phase: Math.random() * Math.PI * 2, drift: (Math.random() - 0.5) * 8, hell: 0.35 + Math.random() * 0.65 });
  }
  const zeichnen = (jetzt: number) => {
    const dt = Math.min(0.05, (jetzt - letzte) / 1000);
    letzte = jetzt;
    ctx.clearRect(0, 0, b, h);
    for (const t of teilchen) {
      t.y -= t.v * dt; t.x += Math.sin(jetzt / 1800 + t.phase) * t.drift * dt;
      if (t.y < -6) { t.y = h + 6; t.x = Math.random() * b; }
      const funkeln = 0.55 + 0.45 * Math.sin(jetzt / 520 + t.phase * 3);
      const a = t.hell * funkeln;
      const g = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, t.r * 3.2);
      g.addColorStop(0, `rgba(243,227,181,${a})`);
      g.addColorStop(0.35, `rgba(217,180,90,${a * 0.75})`);
      g.addColorStop(1, "rgba(184,137,46,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r * 3.2, 0, Math.PI * 2); ctx.fill();
    }
    raf = requestAnimationFrame(zeichnen);
  };
  raf = requestAnimationFrame(zeichnen);
  window.addEventListener("resize", groesse);
  return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", groesse); };
}

/** Steht die Startbühne der App noch (index.html, App.tsx StartbuehneWeg)? Mit der Klasse „zu“ blendet sie aus. */
function startbuehneSteht(): boolean {
  const el = document.getElementById("fi-start");
  return !!el && !el.classList.contains("zu");
}
/** Ruft `los` auf, sobald die Startbühne geht — spätestens nach sechs Sekunden. Rückgabe: aufräumen. */
function nachStartbuehne(los: () => void): () => void {
  if (!startbuehneSteht()) { los(); return () => {}; }
  let fertig = false;
  const einmal = () => { if (fertig) return; fertig = true; mo.disconnect(); window.clearTimeout(notfall); los(); };
  const mo = new MutationObserver(() => { if (!startbuehneSteht()) einmal(); });
  mo.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["class"] });
  const notfall = window.setTimeout(einmal, 6000);
  return () => { fertig = true; mo.disconnect(); window.clearTimeout(notfall); };
}
const STEHT_MS = 4600;

export default function Glueckwunsch({ auge, gruss, zeile, weiter, onWeg, onEnde }: { auge: string; gruss: string; zeile: string; weiter: string; onWeg: () => void; onEnde: () => void }) {
  const [weg, setWeg] = useState(false);
  const [los, setLos] = useState(false);
  const still = useRef(ruhig());
  const canvas = useRef<HTMLCanvasElement>(null);
  const halt = useRef(false);
  const steuer = useRef<{ anhalten: () => void; weiterLaufen: () => void } | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("gaf-auftakt-an");
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === "Enter") setWeg(true); };
    window.addEventListener("keydown", taste);
    let stopp = () => {};
    const ab = nachStartbuehne(() => {
      setLos(true);
      if (!still.current && canvas.current) stopp = staubStarten(canvas.current);
    });
    return () => { ab(); window.removeEventListener("keydown", taste); stopp(); document.documentElement.classList.remove("gaf-auftakt-an"); };
  }, []);

  // Die Standzeit läuft erst ab „los“ und wartet, solange Zeiger oder Fokus auf dem Auftakt liegen.
  useEffect(() => {
    if (!los || weg) return;
    let rest = STEHT_MS; let start = performance.now(); let t = 0;
    const planen = () => { window.clearTimeout(t); t = window.setTimeout(() => { if (halt.current) return; setWeg(true); }, rest); };
    const anhalten = () => { if (halt.current) return; halt.current = true; window.clearTimeout(t); rest = Math.max(1200, rest - (performance.now() - start)); };
    const weiterLaufen = () => { if (!halt.current) return; halt.current = false; start = performance.now(); planen(); };
    planen();
    steuer.current = { anhalten, weiterLaufen };
    return () => { window.clearTimeout(t); steuer.current = null; };
  }, [los, weg]);
  const halten = (an: boolean) => { const h = steuer.current; if (h) (an ? h.anhalten : h.weiterLaufen)(); };

  useEffect(() => {
    if (!weg) return;
    document.documentElement.classList.remove("gaf-auftakt-an");
    onWeg();
    const t = window.setTimeout(onEnde, still.current ? 0 : 1000);
    return () => window.clearTimeout(t);
  }, [weg, onWeg, onEnde]);

  return (
    <div className={`gaf-auftakt${los ? " los" : ""}${weg ? " weg" : ""}`} role="dialog" aria-modal="false" aria-label={auge} onClick={() => setWeg(true)} data-fiaon="firma-auftakt"
      onPointerEnter={(e) => { if (e.pointerType === "mouse") halten(true); }} onPointerLeave={(e) => { if (e.pointerType === "mouse") halten(false); }}
      onFocusCapture={() => halten(true)} onBlurCapture={() => halten(false)}>
      <canvas ref={canvas} className="gaf-auftakt-staub" aria-hidden="true" />
      <div className="gaf-auftakt-schein" aria-hidden="true" />
      <div className="gaf-auftakt-inner">
        <span className="gaf-auftakt-auge">{auge}</span>
        <i className="gaf-auftakt-linie" aria-hidden="true" />
        <p className="gaf-auftakt-gruss">{gruss}</p>
        <p className="gaf-auftakt-zeile">{zeile}</p>
        <button type="button" className="gaf-auftakt-weiter" onClick={(e) => { e.stopPropagation(); setWeg(true); }}>
          <span>{weiter}</span>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" /></svg>
        </button>
      </div>
    </div>
  );
}
