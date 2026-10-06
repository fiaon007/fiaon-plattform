// ═══════════════════════════════════════════════════════════════════════════
// BEWEGUNG DER BUSINESS-WELT — EIN AUSLÖSER FÜR ALLE GRAFIKEN (06.10.2026, E-293)
//
// Warum ein eigener Hook: Justin hat an Scroll-gekoppelten Effekten bemängelt,
// dass sie „ekelhaft ruckeln“. Jede Grafik auf /business (Wegleiste, Stern,
// Beleg, Jahresring, Schaubild, Drei Orte) startet deshalb GENAU EINMAL, wenn
// ihr Abschnitt ins Bild kommt — nie an die Scrollposition gekoppelt. Der Hook
// setzt `data-an="1"` am Element und trennt den Beobachter; alles Weitere ist
// CSS (styles/global-grafik.css) mit transform, opacity, stroke-dashoffset und
// clip-path. Bei „weniger Bewegung“ steht der Endzustand sofort, ohne Beobachter.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, type RefObject } from "react";

export const ruhigGewuenscht = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Setzt einmal `data-an="1"`, sobald `schwelle` des Elements sichtbar ist (unten 10 % Rand).
 * Für hohe Abschnitte `schwelle = 0` mit eigenem `rand` (z. B. „0px 0px -25% 0px“): Die Schwelle ist ein Anteil der
 * Elementhöhe — bei einem 3.000 px hohen Abschnitt wird ein Anteil am Handy quer nie erreicht (06.10.2026, E-293).
 */
export function useEinmalSichtbar(ref: RefObject<HTMLElement | null>, schwelle = 0.35, rand = "0px 0px -10% 0px") {
  useEffect(() => {
    const el = ref.current;
    if (!el || el.getAttribute("data-an") === "1") return;
    const an = () => el.setAttribute("data-an", "1");
    if (ruhigGewuenscht() || typeof IntersectionObserver === "undefined") { an(); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { an(); io.disconnect(); }
    }, { threshold: schwelle, rootMargin: rand });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, schwelle, rand]);
}

/** Läuft etwas nur, solange es im Bild ist (Uhren, Schleifen)? true = sichtbar und Tab im Vordergrund. */
export function beobachteSichtbar(el: Element, bei: (sichtbar: boolean) => void): () => void {
  let imBild = false;
  const melden = () => bei(imBild && document.visibilityState === "visible");
  const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([e]) => { imBild = e.isIntersecting; melden(); }, { threshold: 0.05 });
  if (io) io.observe(el); else { imBild = true; melden(); }
  document.addEventListener("visibilitychange", melden);
  return () => { io?.disconnect(); document.removeEventListener("visibilitychange", melden); };
}
