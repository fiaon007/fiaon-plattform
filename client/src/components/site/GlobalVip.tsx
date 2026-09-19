// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL VIP — DIE BESONDERE TAFEL (19.09.2026)
//
// Justin: „Die vier Produkte sind mir zu lang, zu schmal … das VIP-Paket muss
// speziell angezeigt werden (vielleicht mehr Animationen) — mach es einfach
// attraktiver!" Die drei Pakete stehen nebeneinander, Global VIP darunter über
// die ganze Breite: die EINE dunkle Glasfläche des Abschnitts (Nachtblau, eine
// Lichtkante, die um die Tafel läuft, die Punktwellen aus WellenFeld, Glanz auf
// den Zahlen) und ein Ticket nach Miami, das sich mit der Maus neigt — denn
// Hin- und Rückflug und Hotel für den Auftakt trägt FIAON (GLOBAL_VIP_REISE).
//
// Bewegung nur, solange die Tafel zu sehen ist (auch die SVG-Animation hält
// an); bei „weniger Bewegung" steht alles still und bleibt vollständig lesbar.
// Die Neigung gibt es nur mit Maus (hover + feiner Zeiger), am Telefon nicht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, type ReactNode } from "react";
import WellenFeld from "@/components/site/WellenFeld";

const ruhigGewuenscht = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Die Tafel selbst: Hintergrund, Lichtkante, Neigung, Anhalten außer Sicht. */
export function GlobalVipBuehne({ id, className, label, children }: { id: string; className: string; label: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current; if (!el) return;
    // Außer Sicht steht alles: CSS über data-laeuft, die SVG-Bahn über pauseAnimations().
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.setAttribute("data-laeuft", ""); else el.removeAttribute("data-laeuft");
      el.querySelectorAll("svg").forEach((s) => { try { if (e.isIntersecting) s.unpauseAnimations(); else s.pauseAnimations(); } catch { /* ohne SMIL: nichts zu tun */ } });
    }, { threshold: 0.05 });
    io.observe(el);

    // Die Neigung folgt der Maus über der ganzen Tafel — das Ticket liest --nx/--ny (−1 … 1).
    const maus = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches && !ruhigGewuenscht();
    let raf = 0, nx = 0, ny = 0;
    const setzen = () => { raf = 0; el.style.setProperty("--nx", nx.toFixed(3)); el.style.setProperty("--ny", ny.toFixed(3)); };
    const bewegen = (ev: PointerEvent) => {
      const r = el.getBoundingClientRect();
      nx = Math.max(-1, Math.min(1, ((ev.clientX - r.left) / r.width) * 2 - 1));
      ny = Math.max(-1, Math.min(1, ((ev.clientY - r.top) / r.height) * 2 - 1));
      if (!raf) raf = requestAnimationFrame(setzen);
    };
    const weg = () => { nx = 0; ny = 0; if (!raf) raf = requestAnimationFrame(setzen); };
    if (maus) { el.addEventListener("pointermove", bewegen); el.addEventListener("pointerleave", weg); }
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", bewegen); el.removeEventListener("pointerleave", weg);
    };
  }, []);

  return (
    <article id={id} ref={ref} className={className} aria-label={label}>
      <span className="fg-vip-rand" aria-hidden="true" />
      <span className="fg-vip-licht a" aria-hidden="true" />
      <span className="fg-vip-licht b" aria-hidden="true" />
      <WellenFeld className="fg-vip-wellen" />
      <div className="fg-vip-inhalt">{children}</div>
    </article>
  );
}

export interface VipTicketTexte {
  titel: string; abflug: string; abflugOrte: string; ziel: string; zielOrt: string;
  enthalten: string; enthaltenText: string; fuer: string; fuerText: string;
}

const BAHN = "M6 34 Q60 -4 114 34";

/** Das Ticket: DACH → MIA, was enthalten ist, für wen. Text bleibt echter Text (lesbar für Screenreader). */
export function GlobalVipTicket({ texte }: { texte: VipTicketTexte }) {
  const bewegt = !ruhigGewuenscht();
  return (
    // Außen neigt und schwebt das Ticket (mit Schatten), innen sitzt das Blatt mit den ausgestanzten Kerben.
    <div className="fg-ticket">
      <div className="fg-ticket-blatt">
        <div className="fg-ticket-kopf"><span>FIAON Global</span><b>VIP</b></div>
        <p className="fg-ticket-titel">{texte.titel}</p>
        <div className="fg-ticket-route">
          <div className="ort"><small>{texte.abflug}</small><b>DACH</b><span>{texte.abflugOrte}</span></div>
          <svg className="bahn" viewBox="0 0 120 40" aria-hidden="true">
            <path d={BAHN} className="spur" />
            <g className="flieger" transform={bewegt ? undefined : "translate(60 15)"}>
              {bewegt && <animateMotion dur="6s" repeatCount="indefinite" rotate="auto" path={BAHN} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />}
              <path d="M-6 -1.1 L1.6 -1.1 L5.4 -5.2 L7.2 -5.2 L4.9 -1.1 L8.2 -1.1 Q10 -1.1 10 0 Q10 1.1 8.2 1.1 L4.9 1.1 L7.2 5.2 L5.4 5.2 L1.6 1.1 L-6 1.1 L-7.6 3.3 L-8.8 3.3 L-7.9 0 L-8.8 -3.3 L-7.6 -3.3 Z" />
            </g>
          </svg>
          <div className="ort rechts"><small>{texte.ziel}</small><b>MIA</b><span>{texte.zielOrt}</span></div>
        </div>
        <div className="fg-ticket-unten">
          <dl className="fg-ticket-fuss">
            <div><dt>{texte.enthalten}</dt><dd>{texte.enthaltenText}</dd></div>
            <div><dt>{texte.fuer}</dt><dd>{texte.fuerText}</dd></div>
          </dl>
          <span className="fg-ticket-strich" aria-hidden="true" />
        </div>
        <span className="fg-ticket-folie" aria-hidden="true" />
      </div>
    </div>
  );
}
