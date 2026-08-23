// ═══════════════════════════════════════════════════════════════════════════
// FIAON UI-BAUSTEINE
//
// Die Bewegungen des Design-Manifests, einmal gebaut und überall benutzt:
// /admin/verbuchung, später /agent und /admin. Jeder Baustein achtet selbst auf
// `prefers-reduced-motion` — die Entscheidung darf nicht an jeder Aufrufstelle
// wiederholt werden, sonst wird sie irgendwo vergessen.
//
// Animiert wird ausschliesslich `transform` und `opacity`. Höhenwechsel laufen
// über `grid-template-rows`, nie über `height` oder `top` — das erzwingt Layout
// und kostet Bilder pro Sekunde.
// ═══════════════════════════════════════════════════════════════════════════

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X, AlertTriangle, Info } from "lucide-react";

// ───────────────────────────────────────────────────────────────────────────
// Bewegungsvorliebe
// ───────────────────────────────────────────────────────────────────────────
export function useReduzierteBewegung(): boolean {
  const [reduziert, setReduziert] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduziert(mq.matches);
    const h = (e: MediaQueryListEvent) => setReduziert(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);
  return reduziert;
}

/**
 * Die Standardkurve des Hauses: schneller Start, sehr weiches Ausklingen.
 * Als Konstante, damit sie nicht an zwanzig Stellen leicht abweichend steht.
 */
export const KURVE = [0.32, 0.72, 0, 1] as [number, number, number, number];

/**
 * Eintritt: translateY(20px) + Deckkraft, gestaffelt. KEIN scale.
 *
 * Eine Karte, die aus 0.96 heranskaliert, sieht aus wie eine Folie in einer
 * Präsentationssoftware. Reine Vertikalbewegung wirkt wie Material, das sich
 * setzt — und genau das soll es sein.
 */
export function eintritt(reduziert: boolean, index = 0, stufeMs = 40) {
  if (reduziert) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.15, delay: (index * stufeMs) / 1000 },
    };
  }
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.28,
      delay: (index * stufeMs) / 1000,
      ease: KURVE,
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Zahlen zählen hoch — auch bei Aktualisierungen, nie harte Sprünge
// ───────────────────────────────────────────────────────────────────────────
export function Zahl({
  wert, dauer = 900, nachkomma = 0, suffix = "", className = "",
}: { wert: number; dauer?: number; nachkomma?: number; suffix?: string; className?: string }) {
  const reduziert = useReduzierteBewegung();
  const [anzeige, setAnzeige] = useState(reduziert ? wert : 0);
  const vorher = useRef(reduziert ? wert : 0);

  useEffect(() => {
    if (reduziert) { setAnzeige(wert); vorher.current = wert; return; }
    const von = vorher.current;
    const start = performance.now();
    let frame = 0;
    const tick = (jetzt: number) => {
      const t = Math.min(1, (jetzt - start) / dauer);
      // ease-out: schnell anfangen, sanft ankommen
      const e = 1 - Math.pow(1 - t, 3);
      setAnzeige(von + (wert - von) * e);
      if (t < 1) frame = requestAnimationFrame(tick);
      else vorher.current = wert;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [wert, dauer, reduziert]);

  return (
    <span className={`fi-zahl ${className}`}>
      {anzeige.toLocaleString("de-DE", {
        minimumFractionDigits: nachkomma, maximumFractionDigits: nachkomma,
      })}
      {suffix}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Skeleton — muss die Geometrie des späteren Inhalts haben, sonst springt es
// ───────────────────────────────────────────────────────────────────────────
export function Skelett({ h = 16, w = "100%", className = "" }: { h?: number; w?: number | string; className?: string }) {
  return <div className={`fi-skelett ${className}`} style={{ height: h, width: w }} />;
}

// ───────────────────────────────────────────────────────────────────────────
// Häkchen, das sich zeichnet
// ───────────────────────────────────────────────────────────────────────────
export function Haken({ groesse = 18, farbe = "var(--fi-erfolg)" }: { groesse?: number; farbe?: string }) {
  return (
    <svg className="fi-haken" width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12.5 L9.5 18 L20 6.5" stroke={farbe} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Halten zum Bestätigen — 3 Sekunden, sichtbarer Fortschritt, weicher Abbruch
//
// Bewusst kein einfacher Klick: Diese Aktion löst echte Buchungen, Mails und
// Provisionen aus. Der Widerstand ist Teil der Sicherheit.
// ───────────────────────────────────────────────────────────────────────────
export function HaltenZumBestaetigen({
  onFertig, label, laufendLabel, dauer = 3000, disabled = false,
}: {
  onFertig: () => void; label: string; laufendLabel?: string; dauer?: number; disabled?: boolean;
}) {
  const reduziert = useReduzierteBewegung();
  const [fortschritt, setFortschritt] = useState(0);
  const [haelt, setHaelt] = useState(false);
  const frame = useRef(0);
  const start = useRef(0);

  const stoppe = useCallback(() => {
    cancelAnimationFrame(frame.current);
    setHaelt(false);
    setFortschritt(0);
  }, []);

  const beginne = useCallback(() => {
    if (disabled) return;
    // Bei reduzierter Bewegung wäre ein unsichtbarer Fortschritt eine Falle:
    // dann genügt ein bewusster Klick, der Schutz bleibt durch die Rückfrage.
    if (reduziert) {
      if (window.confirm(`${label} — wirklich ausführen?`)) onFertig();
      return;
    }
    setHaelt(true);
    start.current = performance.now();
    const tick = (jetzt: number) => {
      const t = Math.min(1, (jetzt - start.current) / dauer);
      setFortschritt(t);
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        setHaelt(false);
        setFortschritt(0);
        if ("vibrate" in navigator) navigator.vibrate?.(30);
        onFertig();
      }
    };
    frame.current = requestAnimationFrame(tick);
  }, [disabled, reduziert, label, onFertig, dauer]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const umfang = 2 * Math.PI * 11;
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={beginne}
      onPointerUp={stoppe}
      onPointerLeave={stoppe}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") beginne(); }}
      onKeyUp={stoppe}
      className="group relative inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-[13px] font-bold text-white
                 transition-transform duration-150 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fi-border-aktiv)] focus-visible:ring-offset-2"
      style={{ background: "linear-gradient(180deg, var(--fi-primaer), var(--fi-primaer-hover))" }}
    >
      <svg width="26" height="26" viewBox="0 0 26 26" className="shrink-0 -rotate-90">
        <circle cx="13" cy="13" r="11" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
        <circle
          cx="13" cy="13" r="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"
          strokeDasharray={umfang} strokeDashoffset={umfang * (1 - fortschritt)}
        />
      </svg>
      <span>{haelt ? (laufendLabel || "Halten …") : label}</span>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Toasts — Einblenden mit leichtem Überschwingen, Zeitleiste läuft ab,
// Hovern hält sie an
// ───────────────────────────────────────────────────────────────────────────
type ToastArt = "erfolg" | "fehler" | "info";
type Toast = { id: number; art: ToastArt; titel: string; text?: string };

const ToastCtx = createContext<{ zeige: (art: ToastArt, titel: string, text?: string) => void }>({
  zeige: () => {},
});
export const useToast = () => useContext(ToastCtx);

// E-053 (Justin 24.08., Screenshot): VORHER erschien der Toast oben rechts als
// weißer Kasten — im Office lag er hinter dem Seitenkopf und war oben
// abgeschnitten; im dunklen Raum war er ein Fremdkörper. NACHHER wählt
// `ton="dunkel"` die Office-Fassung: fixed UNTEN MITTIG (bottom 24px +
// safe-area, max-width 480px, z über der Akte-Lade z 61), gleitet von unten
// ein und trägt dunkles Glas mit Lichtkante und farbigem Akzent. Helle
// Alt-Nutzungen (Admin) bleiben ohne den Prop exakt wie vorher (oben rechts,
// weiß).
export function ToastAnbieter({ children, ton = "hell" }: { children: ReactNode; ton?: "hell" | "dunkel" }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const naechsteId = useRef(1);
  const zeige = useCallback((art: ToastArt, titel: string, text?: string) => {
    const id = naechsteId.current++;
    setToasts((t) => [...t, { id, art, titel, text }]);
  }, []);
  const weg = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const dunkel = ton === "dunkel";

  return (
    <ToastCtx.Provider value={{ zeige }}>
      {children}
      <div
        className={dunkel
          ? "fixed bottom-0 left-1/2 -translate-x-1/2 z-[120] flex flex-col-reverse gap-2 w-[min(92vw,480px)]"
          : "fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]"}
        style={dunkel ? { paddingBottom: "calc(24px + env(safe-area-inset-bottom, 0px))" } : undefined}
        role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => <ToastKarte key={t.id} toast={t} onWeg={() => weg(t.id)} dunkel={dunkel} />)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastKarte({ toast, onWeg, dunkel }: { toast: Toast; onWeg: () => void; dunkel?: boolean }) {
  const reduziert = useReduzierteBewegung();
  const [pausiert, setPausiert] = useState(false);
  const [rest, setRest] = useState(1);
  const dauer = 5000;

  useEffect(() => {
    let frame = 0;
    let letzte = performance.now();
    let verbleibend = dauer;
    const tick = (jetzt: number) => {
      const delta = jetzt - letzte;
      letzte = jetzt;
      if (!pausiert) verbleibend -= delta;
      setRest(Math.max(0, verbleibend / dauer));
      if (verbleibend <= 0) onWeg();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pausiert, onWeg]);

  // E-053: In der Dunkel-Fassung kräftigere Akzentfarben — die hellen Töne
  // (#059669 …) versinken auf dunklem Glas.
  const farbe = dunkel
    ? (toast.art === "erfolg" ? "#34d399" : toast.art === "fehler" ? "#f87171" : "#60a5fa")
    : (toast.art === "erfolg" ? "var(--fi-erfolg)" : toast.art === "fehler" ? "var(--fi-fehler)" : "var(--fi-primaer)");
  const Ikon = toast.art === "erfolg" ? Check : toast.art === "fehler" ? AlertTriangle : Info;
  // E-053: Dunkel gleitet von UNTEN ein (der Stapel sitzt unten mittig).
  const versatz = dunkel ? { y: 24 } : { x: 24 };

  return (
    <motion.div
      initial={reduziert ? { opacity: 0 } : { opacity: 0, ...versatz, scale: 0.96 }}
      animate={reduziert ? { opacity: 1 } : { opacity: 1, x: 0, y: 0, scale: 1 }}
      exit={reduziert ? { opacity: 0 } : { opacity: 0, ...versatz, scale: 0.98 }}
      transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 26 }}
      onMouseEnter={() => setPausiert(true)}
      onMouseLeave={() => setPausiert(false)}
      className={`relative overflow-hidden rounded-xl ${dunkel ? "" : "bg-white border shadow-lg"}`}
      style={dunkel
        ? {
            background: "linear-gradient(180deg, rgba(17,26,46,.95), rgba(10,22,40,.97))",
            border: "1px solid rgba(255,255,255,.14)",
            boxShadow: "0 24px 60px rgba(2,6,23,.6), inset 0 1px 0 rgba(255,255,255,.1)",
            backdropFilter: "blur(20px) saturate(160%)",
            WebkitBackdropFilter: "blur(20px) saturate(160%)",
          }
        : { borderColor: "var(--fi-linie)" }}
    >
      <div className="flex items-start gap-2.5 p-3">
        <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: farbe }}>
          <Ikon size={12} style={{ color: dunkel ? "#0b1224" : "#fff" }} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: dunkel ? "#fff" : "var(--fi-text)" }}>{toast.titel}</p>
          {toast.text && <p className="text-[12px] mt-0.5" style={{ color: dunkel ? "#cbd5e1" : "var(--fi-text-leise)" }}>{toast.text}</p>}
        </div>
        <button onClick={onWeg} aria-label="Schließen"
                className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors ${dunkel ? "hover:bg-white/10" : "hover:bg-slate-100"}`}>
          <X size={13} style={{ color: dunkel ? "#94a3b8" : "var(--fi-text-still)" }} />
        </button>
      </div>
      {/* Der farbige Balken links unten bleibt in beiden Fassungen die Zeitleiste. */}
      <div className="absolute bottom-0 left-0 h-[2px] origin-left"
           style={{ background: farbe, width: "100%", transform: `scaleX(${rest})` }} />
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 3D-Tilt — nur mit Zeigegerät. Auf Touch wäre es sinnlos und träge.
// ───────────────────────────────────────────────────────────────────────────

/**
 * Erlaubnis zur Tiefenstaffelung, die `Tilt` an seine Kinder weitergibt.
 *
 * Steht bewusst VOR `Tilt` statt bei `Ebene`: Dieses Projekt hatte schon eine
 * Safari-Regression durch eine Referenz in der temporalen Todeszone, und dafür
 * existiert ein eigener Smoke-Test. Die Reihenfolge ist hier keine Kosmetik.
 */
const TiefeCtx = createContext(false);

/**
 * Neigung, die dem Zeiger folgt — Räumlichkeit als ORIENTIERUNG, nicht als
 * Effekt. Sie zeigt, was greifbar ist.
 *
 * Drei Entscheidungen, die den Unterschied zu einem Spielerei-Tilt ausmachen:
 *
 *  1. MAXIMAL 3 GRAD. Fünf sehen nach Demo aus, drei nach Material. Die
 *     Perspektive sitzt am Container (`.fi-buehne`, 1400px), nicht an jeder
 *     Karte — sonst hat jede Karte einen eigenen Fluchtpunkt und ein Stapel
 *     kippt auseinander statt gemeinsam.
 *
 *  2. DER SCHATTEN WANDERT ENTGEGEN DER NEIGUNG. Kippt die Karte nach rechts,
 *     muss der Schatten nach links. Bleibt er mittig, wirkt die Neigung wie
 *     ein aufgeklebtes Bild — das ist der häufigste Fehler bei 3D-Karten.
 *
 *  3. AUF TOUCH KEIN TILT, sondern Press-Depth: scale(.985) und Schatten
 *     zurück auf ruhend, wie ein physisch gedrückter Knopf. Eine Neigung ohne
 *     Zeiger müsste geraten werden und ruckelt.
 *
 * Gedrosselt über requestAnimationFrame, ausschließlich `transform` und
 * `box-shadow` — niemals etwas, das Layout auslöst.
 */
export function Tilt({
  children, max = 3, tiefe = false, className = "", style,
}: { children: ReactNode; max?: number; tiefe?: boolean; className?: string; style?: React.CSSProperties }) {
  const reduziert = useReduzierteBewegung();
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [zeigegeraet, setZeigegeraet] = useState(false);
  const [gedrueckt, setGedrueckt] = useState(false);

  useEffect(() => {
    setZeigegeraet(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);

  const bewege = (e: React.PointerEvent) => {
    if (!zeigegeraet || reduziert || !ref.current) return;
    const el = ref.current;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      el.style.transform = `rotateY(${x * max}deg) rotateX(${-y * max}deg)`;
      // Gegenläufig zur Neigung, Ausschlag proportional zum Winkel.
      const sx = -x * 18;
      const sy = -y * 18;
      el.style.boxShadow =
        `${sx * 0.2}px ${sy * 0.2 + 2}px 4px rgba(15,23,42,.04), ` +
        `${sx}px ${sy + 12}px 32px rgba(29,78,216,.10), ` +
        `var(--fi-glanzkante)`;
    });
  };

  const verlasse = () => {
    setGedrueckt(false);
    if (!ref.current) return;
    cancelAnimationFrame(frame.current);
    ref.current.style.transform = "rotateY(0deg) rotateX(0deg)";
    ref.current.style.boxShadow = "var(--fi-schatten-ruhe), var(--fi-glanzkante)";
  };

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const beweglich = zeigegeraet && !reduziert;

  return (
    <div
      ref={ref}
      onPointerMove={bewege}
      onPointerLeave={verlasse}
      onPointerDown={() => !beweglich && setGedrueckt(true)}
      onPointerUp={() => setGedrueckt(false)}
      onPointerCancel={() => setGedrueckt(false)}
      className={className}
      style={{
        ...style,
        // Federrückstellung mit leichtem Überschwingen: Die Karte fällt nicht
        // in die Ruhelage, sie schwingt einmal knapp darüber hinaus.
        transition: reduziert
          ? "box-shadow 150ms linear"
          : "transform 380ms cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 280ms var(--fi-kurve)",
        transform: gedrueckt ? "scale(0.985)" : undefined,
        boxShadow: "var(--fi-schatten-ruhe), var(--fi-glanzkante)",
        willChange: "transform",
        transformStyle: tiefe ? "preserve-3d" : undefined,
      }}
    >
      {/* Nur ein Tilt, das wirklich neigen kann, erlaubt seinen Kindern
          Tiefenstaffelung. Sonst wäre translateZ reiner Schaden. */}
      <TiefeCtx.Provider value={tiefe && beweglich}>
        {children}
      </TiefeCtx.Provider>
    </div>
  );
}

/**
 * Eine Inhaltsebene innerhalb einer GENEIGTEN Karte.
 *
 * Name, Metazeile und Aktionen liegen auf verschiedenen Z-Höhen. Beim Neigen
 * verschieben sie sich unterschiedlich stark gegeneinander — das ist echte
 * Tiefenstaffelung.
 *
 * Die Wirkung hängt an einem Kontext, den AUSSCHLIESSLICH ein drehendes `Tilt`
 * bereitstellt. Wer `Ebene` anderswo benutzt, bekommt ein gewöhnliches `div`.
 *
 * Der Grund für diese Fessel (03.08.2026): Auf der Kundenkarte von
 * /agent/heute standen drei `Ebene`-Ebenen, obwohl die Karte sich nie neigt.
 * Sie waren dort vollständig wirkungslos — die Karte hat `overflow: hidden`,
 * und das legt `preserve-3d` laut Spezifikation flach. Bezahlt wurden sie
 * trotzdem: drei GPU-Ebenen und ein Stapelkontext pro Karte, bei bis zu 300
 * Karten in der Liste.
 *
 * Schlimmer als die Kosten war die Verwechslungsgefahr: Ich hielt sie zunächst
 * für die Ursache eines schweren Bedienfehlers und hätte sie beinahe als solche
 * dokumentiert. Erst ein Reproduktionsversuch hat das widerlegt. Damit niemand
 * — auch ich nicht — erneut Tiefe an eine Karte schreibt, die sich nicht dreht,
 * ist die Voraussetzung jetzt im Typ- und Laufzeitverhalten verankert statt in
 * einem Kommentar, den man überliest.
 */
export function Ebene({
  z, className = "", children,
}: { z: number; className?: string; children: ReactNode }) {
  const an = useContext(TiefeCtx);
  return (
    <div className={className} style={an ? { transform: `translateZ(${z}px)` } : undefined}>
      {children}
    </div>
  );
}

/**
 * Scroll-Reveal per IntersectionObserver, Schwelle 0.15, einmalig.
 *
 * Framer Motions `whileInView` macht dasselbe, legt aber je Element einen
 * eigenen Observer an. Bei 60 Karten sind das 60 Observer — hier ist es einer
 * pro Abschnitt, und der trennt sich nach dem ersten Auslösen selbst.
 */
export function useImBild<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [drin, setDrin] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setDrin(true); return; }
    const b = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setDrin(true); b.disconnect(); } },
      // SCHWELLE 0, NICHT 0.15 — und der Unterschied ist kein Feinschliff.
      //
      // `threshold` misst den Anteil DER ELEMENTFLÄCHE, der im Bild liegt, nicht
      // einen Anteil des Bildschirms. Bei 0.15 folgen daraus zwei Fehler, und der
      // zweite ist schwer:
      //
      //  1. Man muss 15 % der Elementhöhe blind durchscrollen, bevor es
      //     erscheint. Ein Abschnitt mit 30 Kundenkarten liess über 1000 Pixel
      //     Weiss vor sich her.
      //
      //  2. Ist ein Element höher als Bildschirmhöhe / 0.15, kann das
      //     Verhältnis 0.15 NIE erreicht werden — mehr als die Bildschirmhöhe
      //     passt nicht gleichzeitig ins Bild. Das Element bleibt dann FÜR IMMER
      //     unsichtbar, so weit man auch scrollt. Bei 900 px Bildhöhe liegt die
      //     Grenze bei 6000 px, also rund 30 Karten — die Kundenliste lädt bis
      //     zu 300.
      //
      // Genau das war die gemeldete „ewig weisse Fläche" zwischen „Heute fällig"
      // und „Überfällig": Die Abschnitte waren nicht leer, sie waren da und
      // unsichtbar, denn `opacity: 0` nimmt keinen Platz weg.
      //
      // Schwelle 0 löst bei jedem sichtbaren Pixel aus und ist damit von der
      // Höhe unabhängig. Der POSITIVE untere `rootMargin` vergrössert den
      // Beobachtungsbereich nach unten: Der Abschnitt blendet ein, WÄHREND er
      // sich nähert, und steht fertig da, wenn der Blick ihn erreicht. Ein
      // negativer Wert wäre hier falsch — er würde später auslösen und für
      // Elemente am Dokumentende erneut ein Nie-Sichtbar erzeugen.
      //
      // Merksatz: Ein dekorativer Einblend-Effekt darf Inhalt niemals dauerhaft
      // verbergen. Abgesichert in tests/e2e/abschnitt-sichtbarkeit.spec.ts.
      { threshold: 0, rootMargin: "0px 0px 15% 0px" },
    );
    b.observe(el);
    return () => b.disconnect();
  }, []);
  return { ref, drin };
}

// ───────────────────────────────────────────────────────────────────────────
// Formate
// ───────────────────────────────────────────────────────────────────────────
export function eur(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `${(cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

/** Relativ für den Überblick, absolut im Tooltip für die Genauigkeit. */
export function ZeitAngabe({ wert, className = "" }: { wert: string | null; className?: string }) {
  if (!wert) return <span className={className}>—</span>;
  const d = new Date(wert);
  if (isNaN(d.getTime())) return <span className={className}>—</span>;
  const absolut = d.toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  const minuten = Math.round((Date.now() - d.getTime()) / 60000);
  let relativ: string;
  if (minuten < 1) relativ = "gerade eben";
  else if (minuten < 60) relativ = `vor ${minuten} Min.`;
  else if (minuten < 60 * 24) relativ = `vor ${Math.round(minuten / 60)} Std.`;
  else if (minuten < 60 * 24 * 30) relativ = `vor ${Math.round(minuten / (60 * 24))} Tg.`;
  else relativ = d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
  return <span className={className} title={absolut}>{relativ}</span>;
}

/** Nur Datum, ohne Uhrzeit — für Buchungsdaten aus dem Kontoauszug. */
export function datum(wert: string | null): string {
  if (!wert) return "—";
  const d = new Date(wert);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
