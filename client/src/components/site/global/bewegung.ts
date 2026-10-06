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
import { useEffect, useLayoutEffect, type RefObject } from "react";

export const ruhigGewuenscht = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Setzt einmal `data-an="1"`, sobald `schwelle` des Elements sichtbar ist (unten 10 % Rand).
 * Für hohe Abschnitte `schwelle = 0` mit eigenem `rand` (z. B. „0px 0px -25% 0px“): Die Schwelle ist ein Anteil der
 * Elementhöhe — bei einem 3.000 px hohen Abschnitt wird ein Anteil am Handy quer nie erreicht (06.10.2026, E-293).
 */
export function useEinmalSichtbar(ref: RefObject<Element | null>, schwelle = 0.35, rand = "0px 0px -10% 0px") {
  // 06.10.2026 (E-293): useLayoutEffect statt useEffect — der Startzustand data-an="0" steht vor dem ersten Bild.
  // Sonst folgen bei einer Grafik, die schon beim Laden im Bild liegt, Endzustand → Startzustand → Ablauf
  // (GlobalStern macht es genauso). Kein Server-Rendering (main.tsx nutzt createRoot), also keine Warnung.
  // Element statt HTMLElement, damit auch SVG-Refs (Rollen-Dreieck) ohne Umwandlung passen.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || el.getAttribute("data-an") === "1") return;
    const an = () => el.setAttribute("data-an", "1");
    if (ruhigGewuenscht() || typeof IntersectionObserver === "undefined") { an(); return; }
    // 06.10.2026 (E-293, Scheibe B): Erst jetzt — mit JS und erlaubter Bewegung — steht der Startzustand (data-an="0":
    // Linien ungezeichnet, Knoten klein). Ohne JS, im Vorab-HTML und bei „weniger Bewegung“ bleibt der Endzustand.
    if (el.getAttribute("data-an") !== "0") el.setAttribute("data-an", "0");
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { an(); io.disconnect(); }
    }, { threshold: schwelle, rootMargin: rand });
    io.observe(el);
    // 06.10.2026 (E-293): Wer per Tastatur hineinkommt (Wegknoten sind Knöpfe), sieht sofort den Endzustand —
    // sonst trägt ein fokussierter Knopf bis zum Auslösen des Beobachters die Deckkraft 0.
    const perFokus = () => { an(); io.disconnect(); };
    el.addEventListener("focusin", perFokus, { once: true });
    return () => { io.disconnect(); el.removeEventListener("focusin", perFokus); };
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

/**
 * Neigung bei feinem Zeiger (Plakette ±4°, Bauplan 3.4): setzt --nx/--ny (−1 … 1) am Element, gedämpft über
 * requestAnimationFrame; CSS macht daraus rotateX/rotateY mit transition (06.10.2026, E-293). Bei Touch und
 * „weniger Bewegung“ geschieht nichts.
 */
export function useNeigung(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || ruhigGewuenscht() || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0, nx = 0, ny = 0;
    const setzen = () => { raf = 0; el.style.setProperty("--nx", nx.toFixed(3)); el.style.setProperty("--ny", ny.toFixed(3)); };
    const bewegen = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      nx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      ny = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
      if (!raf) raf = requestAnimationFrame(setzen);
    };
    const weg = () => { nx = 0; ny = 0; if (!raf) raf = requestAnimationFrame(setzen); };
    el.addEventListener("pointermove", bewegen);
    el.addEventListener("pointerleave", weg);
    return () => { if (raf) cancelAnimationFrame(raf); el.removeEventListener("pointermove", bewegen); el.removeEventListener("pointerleave", weg); };
  }, [ref]);
}
