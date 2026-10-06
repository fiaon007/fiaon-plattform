// ═══════════════════════════════════════════════════════════════════════════
// DIE AUFWÄRTS-HAARLINIE IM HERO (06.10.2026, E-293, Bauplan 2.2, Scheibe C)
//
// Ein Pfad vom Siegel der Urkunde zum Festpreis: blaue Haarlinie (1 px, 45 %),
// die sich einmal zeichnet (1.200 ms ab 600 ms) und in einem Punkt am Preis
// endet. Sie liegt HINTER Text und Urkunde — am Siegel beginnt sie unter dem
// Papier und tritt an dessen linker Kante hervor. Sie nimmt die Haarlinien-
// Sprache der Startbühne „Fassade“ auf, ist aber eigenständig.
//
// Nur ab 1.024 px Breite. Die Punkte werden gemessen (Raster, Urkunde, Preis),
// nicht geraten: Die Siegelmitte kommt aus GLOBAL_BILDER und wird mit der
// Drehung der Urkunde (−4°, styles/global-grafik.css .fg-hero-objekt) um deren
// Mitte gedreht. Gemessen wird an der Layout-Lage (offset*), nicht am gerade
// laufenden Einstieg; nach Schrift-Laden, Größenänderung und dem Ende der
// Einblendungen wird nachgemessen. Das Raster ist das Elternelement der Linie
// (eigener Ref statt eines Refs vom Elternteil: Dessen Ref steht beim
// Layout-Effekt des Kindes noch nicht).
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState } from "react";
import { GLOBAL_BILDER } from "@/lib/global-bilder";

/** Drehung der Urkunde in Grad — wie .fg-hero-objekt (rotate(-4deg)). */
const DREHUNG = -4;

interface Lage { w: number; h: number; d: string; ex: number; ey: number }

export default function HeroLinie() {
  const [lage, setLage] = useState<Lage | null>(null);
  const ref = useRef<SVGSVGElement>(null);

  useLayoutEffect(() => {
    const el = ref.current?.parentElement;
    if (!el || typeof window === "undefined" || !window.matchMedia) return;
    const breit = window.matchMedia("(min-width: 1024px)");
    const messen = () => {
      const fig = el.querySelector<HTMLElement>(".fg-hero-objekt");
      const preis = el.querySelector<HTMLElement>(".fg-kopf-zahlen > div + div > b");
      const rahmen = fig?.offsetParent as HTMLElement | null;
      if (!breit.matches || !fig || !preis || !rahmen) { setLage(null); return; }
      const r = el.getBoundingClientRect();
      const rr = rahmen.getBoundingClientRect();
      const w = fig.offsetWidth, h = fig.offsetHeight;
      if (!w || !h) { setLage(null); return; }
      // Mitte der Urkunde (Drehpunkt) im Raster, dann das Siegel um sie gedreht.
      const cx = rr.left - r.left + fig.offsetLeft + w / 2, cy = rr.top - r.top + fig.offsetTop + h / 2;
      const { siegel } = GLOBAL_BILDER.urkunde;
      const ox = (parseFloat(siegel.x) / 100 - 0.5) * w, oy = (parseFloat(siegel.y) / 100 - 0.5) * h;
      const a = (DREHUNG * Math.PI) / 180;
      const sx = cx + ox * Math.cos(a) - oy * Math.sin(a), sy = cy + ox * Math.sin(a) + oy * Math.cos(a);
      // Ende: 16 px hinter dem Preistext, auf seiner Mitte (Textbreite, nicht Blockbreite).
      const bereich = document.createRange();
      bereich.selectNodeContents(preis);
      const p = bereich.getBoundingClientRect();
      if (!p.width) { setLage(null); return; }
      const ex = p.right - r.left + 16, ey = p.top - r.top + p.height / 2;
      const dx = sx - ex;
      if (dx < 80) { setLage(null); return; } // Urkunde steht nicht rechts vom Preis — keine Linie
      const z = (n: number) => n.toFixed(1);
      const d = `M${z(sx)} ${z(sy)} C${z(sx - dx * 0.45)} ${z(sy)} ${z(ex + dx * 0.45)} ${z(ey)} ${z(ex)} ${z(ey)}`;
      setLage((alt) => (alt && alt.d === d && alt.w === r.width && alt.h === r.height ? alt : { w: r.width, h: r.height, d, ex, ey }));
    };
    messen();
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(messen);
    ro?.observe(el);
    breit.addEventListener?.("change", messen);
    el.addEventListener("animationend", messen);
    el.addEventListener("transitionend", messen);
    let aus = false;
    document.fonts?.ready.then(() => { if (!aus) messen(); }).catch(() => {});
    return () => {
      aus = true;
      ro?.disconnect();
      breit.removeEventListener?.("change", messen);
      el.removeEventListener("animationend", messen);
      el.removeEventListener("transitionend", messen);
    };
  }, []);

  // Ohne Lage (Handy, schmal, noch nicht gemessen) bleibt die leere Hülle unsichtbar; der Pfad hängt sich erst mit
  // der Lage ein, damit das Zeichnen genau dann beginnt.
  return (
    <svg ref={ref} className={`fg-hero-linie${lage ? "" : " leer"}`} width={lage?.w ?? 0} height={lage?.h ?? 0}
      viewBox={lage ? `0 0 ${lage.w} ${lage.h}` : undefined} aria-hidden="true" focusable="false">
      {lage && <path d={lage.d} pathLength={1} />}
      {lage && <circle cx={lage.ex} cy={lage.ey} r={2.5} />}
    </svg>
  );
}
