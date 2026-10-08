// ═══════════════════════════════════════════════════════════════════════════
// DAS FIRMENANGEBOT (E-301) — GEMEINSAME BAUSTEINE DER SEITE
//
// Bild mit KI-Hinweis, eigene Zeichen (1,5 px, currentColor — keine Icon-Bibliothek),
// **fett** aus den Texten des Prüfberichts als <b> (ohne HTML aus Daten), das
// einmalige Einblenden beim Hineinscrollen und der Scroll-Fortschritt eines
// Elements. Gescrollt wird je nach Rahmen im Dokument (fg-dokument) oder in
// #root — darum hören wir Scroll-Ereignisse im Capture-Modus am document und
// rechnen über getBoundingClientRect, nie über window.scrollY.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import type { BildRef } from "@shared/fiaon-global-angebot-firma-typen";

export const ruhig = () => {
  try { return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

/** „**fett**“ in Texten aus den Daten → <b>. Alles andere bleibt reiner Text (kein HTML aus der Datenbank). */
export function Fett({ text }: { text: string }) {
  const teile = String(text ?? "").split(/(\*\*[^*]+\*\*)/g);
  return <>{teile.map((t, i) => (t.startsWith("**") && t.endsWith("**") && t.length > 4 ? <b key={i}>{t.slice(2, -2)}</b> : <span key={i}>{t}</span>))}</>;
}

/** Setzt einmal die Klasse „da“, sobald das Element ins Bild kommt. Bei „weniger Bewegung“ sofort. */
export function useEinmalDa<T extends Element>(rand = "0px 0px -12% 0px"): RefObject<T> {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (ruhig() || typeof IntersectionObserver === "undefined") { el.classList.add("da"); return; }
    el.classList.add("gaf-warte");
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { el.classList.add("da"); io.disconnect(); } }, { threshold: 0, rootMargin: rand });
    io.observe(el);
    return () => io.disconnect();
  }, [rand]);
  return ref as RefObject<T>;
}

/** Ein Abschnitt, der sich beim Hineinscrollen sanft aufbaut. */
export function Auf({ children, className = "", als = "div", verz = 0 }: { children: ReactNode; className?: string; als?: "div" | "li"; verz?: number }) {
  const ref = useEinmalDa<HTMLDivElement>();
  const Tag = als as "div";
  return <Tag ref={ref} className={`gaf-auf ${className}`} style={verz ? { transitionDelay: `${verz}ms` } : undefined}>{children}</Tag>;
}

/**
 * Ruft `bei(fortschritt)` bei jedem Scrollen und jeder Größenänderung (gebündelt pro Bild).
 * Fortschritt 0 = Oberkante des Elements an der Oberkante des Fensters, 1 = Unterkante an der Unterkante.
 * In einem versteckten Tab ruht requestAnimationFrame — dann rufen wir direkt.
 */
export function useScrollFortschritt(ref: RefObject<Element | null>, bei: (p: number, rect: DOMRect) => void) {
  const bei_ = useRef(bei);
  bei_.current = bei;
  useEffect(() => {
    let raf = 0;
    const rechnen = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const weg = Math.max(1, r.height - vh);
      bei_.current(Math.min(1, Math.max(0, -r.top / weg)), r);
    };
    const anstossen = () => {
      if (document.visibilityState !== "visible") { rechnen(); return; }
      if (!raf) raf = requestAnimationFrame(rechnen);
    };
    rechnen();
    document.addEventListener("scroll", anstossen, { capture: true, passive: true });
    window.addEventListener("resize", anstossen);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("scroll", anstossen, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", anstossen);
    };
  }, [ref]);
}

/** Ein Bild mit festen Maßen (kein Layout-Sprung), srcset und — bei KI — dem sichtbaren Hinweis. */
export function Bild({ bild, groessen = "(max-width: 760px) 100vw, 640px", sofort = false, className = "" }: { bild: BildRef; groessen?: string; sofort?: boolean; className?: string }) {
  return (
    <figure className={`gaf-bild ${className}`}>
      <img src={bild.src} srcSet={bild.srcset} sizes={bild.srcset ? groessen : undefined} width={bild.breite} height={bild.hoehe} alt={bild.alt}
        loading={sofort ? "eager" : "lazy"} decoding="async" style={{ aspectRatio: `${bild.breite} / ${bild.hoehe}` }} />
      {bild.ki && bild.hinweis && <figcaption className="gaf-ki">{bild.hinweis}</figcaption>}
    </figure>
  );
}

/** Die Marke „FIAON Global“ (eine Quelle: shared/fiaon-marke.ts). */
export { MarkeGlobal } from "./marke";

type ZeichenArt =
  | "gesellschaft" | "kapital" | "strategie" | "plattform" | "vertrieb" | "ansprechpartner"
  | "pfeil" | "plus" | "pdf" | "mail" | "telefon" | "haken" | "warnung" | "kreuz" | "schild" | "siegel" | "dokument" | "pfeilRunter";

const PFADE: Record<ZeichenArt, ReactNode> = {
  // Gebäude mit Flagge — die US-Gesellschaft
  gesellschaft: <><path d="M4 20.5h16M5.5 20.5V10l6.5-4 6.5 4v10.5" /><path d="M9.5 20.5v-5h5v5M12 6V2.8l3 1.2-3 1.2" /></>,
  // Münzstapel mit Glanz
  kapital: <><ellipse cx="12" cy="6.5" rx="6.5" ry="2.5" /><path d="M5.5 6.5v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4M5.5 10.5v4c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-4M5.5 14.5v3c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5v-3" /></>,
  // steigende Linie mit Zielpunkt
  strategie: <><path d="M3.5 19.5h17M4.5 16l4.5-4.5 3.5 3 7-7.5" /><path d="M15.5 7h4v4" /></>,
  // Bildschirm mit Fenster
  plattform: <><rect x="3" y="4.5" width="18" height="12.5" rx="1.5" /><path d="M8.5 20.5h7M12 17v3.5M3 8.5h18" /><circle cx="5.6" cy="6.5" r=".35" /></>,
  // Hände / Handschlag vereinfacht: zwei Pfeile, die sich treffen
  vertrieb: <><path d="M3 12h7.5M7.5 8.5 11 12l-3.5 3.5M21 12h-7.5" /><path d="M16.5 8.5 13 12l3.5 3.5" /><circle cx="12" cy="12" r="9" opacity=".35" /></>,
  ansprechpartner: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  pfeil: <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />,
  pfeilRunter: <path d="M12 5v14M6.5 13.5 12 19l5.5-5.5" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  pdf: <><path d="M6.5 3h8l4 4v14h-12z" /><path d="M14.5 3v4h4M9 13h6M9 16.5h6M9 9.5h2.5" /></>,
  dokument: <><path d="M6.5 3h8l4 4v14h-12z" /><path d="M14.5 3v4h4M9 11h6M9 14h6M9 17h4" /></>,
  mail: <><rect x="3.5" y="5.5" width="17" height="13" rx="1.5" /><path d="m4 6.5 8 6 8-6" /></>,
  telefon: <path d="M7.4 3.6 9.6 3.4l1.5 3.9-1.9 1.3a10.3 10.3 0 0 0 5.9 5.9l1.3-1.9 3.9 1.5-.2 2.2c-.1.8-.8 1.4-1.7 1.4A14.8 14.8 0 0 1 6 5.3c0-.9.6-1.6 1.4-1.7z" />,
  haken: <path d="m5.5 12.5 4.2 4.2 8.8-9.2" />,
  warnung: <><path d="M12 4.5 21 19.5H3z" /><path d="M12 10v4.5M12 17v.2" /></>,
  kreuz: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  schild: <><path d="M12 3 19.5 6v5.5c0 4.6-3.1 8.2-7.5 9.5-4.4-1.3-7.5-4.9-7.5-9.5V6z" /><path d="m8.8 12 2.3 2.3 4.3-4.6" /></>,
  siegel: <><circle cx="12" cy="10" r="6" /><path d="M8.5 15 7 21l5-2.5 5 2.5-1.5-6" /></>,
};

export function Zeichen({ art, groesse = 22, className = "" }: { art: ZeichenArt; groesse?: number; className?: string }) {
  return (
    <svg className={`gaf-zeichen ${className}`} viewBox="0 0 24 24" width={groesse} height={groesse} fill="none" stroke="currentColor" strokeWidth={1.5}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PFADE[art]}
    </svg>
  );
}

/**
 * Runde 3 (Justin 08.10.2026, Punkt 3: „kompakter, da zusätzlich noch der Vertrag gelesen werden muss“): EIN Baustein für alles,
 * was nur aufklappbar steht — Knopf mit aria-expanded, weiches Aufklappen über grid-template-rows (gaf-klapp), zugeklappt „inert“
 * (nichts darin ist per Tastatur erreichbar, Vorleser überspringen es). „Weniger Bewegung“: ohne Übergang (CSS).
 */
export function Mehr({ knopf, knopfZu, children, className = "", id }: { knopf: string; knopfZu?: string; children: ReactNode; className?: string; id: string }) {
  const [auf, setAuf] = useState(false);
  return (
    <div className={`gaf-mehr${auf ? " auf" : ""}${className ? ` ${className}` : ""}`}>
      <button type="button" className="gaf-mehr-knopf" aria-expanded={auf} aria-controls={id} onClick={() => setAuf((a) => !a)}>
        <span>{auf && knopfZu ? knopfZu : knopf}</span><span className="gaf-plus" aria-hidden="true" />
      </button>
      <div className="gaf-klapp" id={id} {...(auf ? {} : { inert: "" })}><div>{children}</div></div>
    </div>
  );
}

/** Ein Text mit Platzhaltern {name} — die Oberfläche setzt nur Zahlen ein, die Sätze kommen aus den Daten. */
export function einsetzen(satz: string, werte: Record<string, string>): string {
  return String(satz ?? "").replace(/\{(\w+)\}/g, (_, k: string) => (k in werte ? werte[k] : `{${k}}`));
}

export const tagDe = (iso?: string | null) => (iso ? String(iso).slice(0, 10).split("-").reverse().join(".") : "");

/** Ob ein Medienabfrage-Zustand gilt (z. B. Handy), mit Nachführen bei Änderung. */
export function useMedien(abfrage: string): boolean {
  const [an, setAn] = useState(() => { try { return window.matchMedia(abfrage).matches; } catch { return false; } });
  useEffect(() => {
    let m: MediaQueryList;
    try { m = window.matchMedia(abfrage); } catch { return; }
    const bei = () => setAn(m.matches);
    bei();
    m.addEventListener?.("change", bei);
    return () => m.removeEventListener?.("change", bei);
  }, [abfrage]);
  return an;
}
