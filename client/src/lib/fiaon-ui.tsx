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

/** Eintritt: translateY + opacity, bei reduzierter Bewegung nur eine Blende. */
export function eintritt(reduziert: boolean, index = 0, stufeMs = 30) {
  if (reduziert) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      transition: { duration: 0.15, delay: (index * stufeMs) / 1000 },
    };
  }
  return {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.3,
      delay: (index * stufeMs) / 1000,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Zahlen zählen hoch — auch bei Aktualisierungen, nie harte Sprünge
// ───────────────────────────────────────────────────────────────────────────
export function Zahl({
  wert, dauer = 800, nachkomma = 0, suffix = "", className = "",
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

export function ToastAnbieter({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const naechsteId = useRef(1);
  const zeige = useCallback((art: ToastArt, titel: string, text?: string) => {
    const id = naechsteId.current++;
    setToasts((t) => [...t, { id, art, titel, text }]);
  }, []);
  const weg = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  return (
    <ToastCtx.Provider value={{ zeige }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[min(92vw,360px)]" role="status" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((t) => <ToastKarte key={t.id} toast={t} onWeg={() => weg(t.id)} />)}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

function ToastKarte({ toast, onWeg }: { toast: Toast; onWeg: () => void }) {
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

  const farbe =
    toast.art === "erfolg" ? "var(--fi-erfolg)" : toast.art === "fehler" ? "var(--fi-fehler)" : "var(--fi-primaer)";
  const Ikon = toast.art === "erfolg" ? Check : toast.art === "fehler" ? AlertTriangle : Info;

  return (
    <motion.div
      initial={reduziert ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
      animate={reduziert ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }}
      exit={reduziert ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.98 }}
      transition={reduziert ? { duration: 0.15 } : { type: "spring", stiffness: 420, damping: 26 }}
      onMouseEnter={() => setPausiert(true)}
      onMouseLeave={() => setPausiert(false)}
      className="relative overflow-hidden bg-white border rounded-xl shadow-lg"
      style={{ borderColor: "var(--fi-linie)" }}
    >
      <div className="flex items-start gap-2.5 p-3">
        <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center shrink-0"
              style={{ background: farbe }}>
          <Ikon size={12} className="text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: "var(--fi-text)" }}>{toast.titel}</p>
          {toast.text && <p className="text-[12px] mt-0.5" style={{ color: "var(--fi-text-leise)" }}>{toast.text}</p>}
        </div>
        <button onClick={onWeg} aria-label="Schließen"
                className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center transition-colors hover:bg-slate-100">
          <X size={13} style={{ color: "var(--fi-text-still)" }} />
        </button>
      </div>
      <div className="absolute bottom-0 left-0 h-[2px] origin-left"
           style={{ background: farbe, width: "100%", transform: `scaleX(${rest})` }} />
    </motion.div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// 3D-Tilt — nur mit Zeigegerät. Auf Touch wäre es sinnlos und träge.
// ───────────────────────────────────────────────────────────────────────────
/**
 * Neigung, die dem Zeiger folgt.
 *
 * `tiefe` schaltet echte Räumlichkeit zu: Die Karte bekommt `preserve-3d` und
 * der Inhalt wird um 20px nach VORNE gelegt. Der Unterschied ist deutlich —
 * ohne translateZ kippt ein flaches Bild, mit translateZ steht der Inhalt
 * sichtbar vor seiner Karte.
 *
 * Standardmässig aus, weil `preserve-3d` einen eigenen Stapelkontext erzeugt:
 * Overlays und `position: sticky` INNERHALB der Karte verhalten sich dann
 * anders. Wer es einschaltet, muss die Karte daraufhin ansehen.
 */
export function Tilt({
  children, max = 5, tiefe = false, className = "", style,
}: { children: ReactNode; max?: number; tiefe?: boolean; className?: string; style?: React.CSSProperties }) {
  const reduziert = useReduzierteBewegung();
  const ref = useRef<HTMLDivElement>(null);
  const frame = useRef(0);
  const [zeigegeraet, setZeigegeraet] = useState(false);

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
      el.style.transform = `perspective(1200px) rotateY(${x * max}deg) rotateX(${-y * max}deg)`;
      el.style.boxShadow = "var(--fi-schatten-hover), var(--fi-glanzkante)";
    });
  };
  const verlasse = () => {
    if (!ref.current) return;
    cancelAnimationFrame(frame.current);
    ref.current.style.transform = "perspective(1200px) rotateY(0deg) rotateX(0deg)";
    ref.current.style.boxShadow = "var(--fi-schatten-ruhe), var(--fi-glanzkante)";
  };
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return (
    <div
      ref={ref}
      onPointerMove={bewege}
      onPointerLeave={verlasse}
      className={`${className} ${!zeigegeraet ? "active:scale-[0.98]" : ""}`}
      style={{
        ...style,
        transition: "transform 300ms var(--fi-kurve), box-shadow 300ms var(--fi-kurve)",
        boxShadow: "var(--fi-schatten-ruhe), var(--fi-glanzkante)",
        willChange: "transform",
        transformStyle: tiefe ? "preserve-3d" : undefined,
      }}
    >
      {tiefe && zeigegeraet && !reduziert
        ? <div style={{ transform: "translateZ(20px)", transformStyle: "preserve-3d" }}>{children}</div>
        : children}
    </div>
  );
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
