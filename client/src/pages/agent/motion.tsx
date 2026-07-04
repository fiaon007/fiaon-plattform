import { useState, useEffect, useRef, type ReactNode, type ElementType } from "react";
import { Link } from "wouter";
import { ACCENT } from "./shared";

// ============================================================================
// Agent-Portal — Cinematic Motion-Primitive (Paket S)
// „Cinematisch beim Ankommen, ruhig und schnell beim Arbeiten."
// Alle Bewegungen respektieren prefers-reduced-motion (dann statische
// Endzustände). Nur transform/opacity → GPU-freundlich, kein Layout-Shift.
// Kein neues Farbsystem: EINE Akzentfarbe (#2563eb) + Slate.
// ============================================================================

/** True, wenn der Nutzer reduzierte Bewegung wünscht. Reaktiv. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() =>
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Gestaffelte Einblendung (fade + weicher Y-Versatz). `index` erzeugt einen
 * gestaffelten Delay (~70ms). Bei reduced-motion sofort sichtbar, ohne Motion.
 */
export function Reveal({
  children,
  index = 0,
  delay,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  index?: number;
  delay?: number;
  className?: string;
  as?: ElementType;
}) {
  const reduced = useReducedMotion();
  const ms = delay ?? index * 70;
  if (reduced) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag className={`agent-reveal ${className}`} style={{ animationDelay: `${ms}ms` }}>
      {children}
    </Tag>
  );
}

/**
 * Zahlen-Count-up beim ersten Erscheinen — nur EINMAL (nicht bei Re-Render).
 * `value` ist der Zielwert (z. B. Cents), `format` rendert die Anzeige.
 * Bei reduced-motion wird sofort der Endwert gezeigt.
 */
export function CountUp({
  value,
  format,
  className = "",
  durationMs = 900,
}: {
  value: number;
  format: (n: number) => string;
  className?: string;
  durationMs?: number;
}) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState<number>(reduced ? value : 0);
  const started = useRef(false);

  useEffect(() => {
    if (reduced || started.current) {
      setDisplay(value);
      return;
    }
    started.current = true;
    const from = 0;
    const to = value;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // easeOutExpo — schnelles Anlaufen, sanftes Ausklingen
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // Absicht: nur beim Mount animieren
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <span className={`tabular-nums ${className}`}>{format(display)}</span>;
}

/**
 * Signature-3D-Element: ruhig rotierende Draht-Sphäre, rein CSS (0 Assets).
 * Monochrom + Akzent, edel-geometrisch. Bei reduced-motion statisch (keine
 * Rotation), Glow gedämpft. Wird nur an Login + Dashboard-Kopf eingesetzt.
 */
export function SignatureCore({ size = 200, className = "" }: { size?: number; className?: string }) {
  return (
    <div className={`agent-core ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <div className="agent-core__inner">
        <span className="agent-core__ring" />
        <span className="agent-core__ring" />
        <span className="agent-core__ring" />
        <span className="agent-core__ring" />
        <span className="agent-core__ring" />
        <span className="agent-core__glow" />
      </div>
    </div>
  );
}

/**
 * Cinematischer Voll-Bildschirm-Rahmen für alle Auth-Seiten (Login, Setup,
 * Reset, Token-abgelaufen). Ruhiger heller CI-Hintergrund, ein Signature-Core
 * + zwei dezente Ambient-Orbs, schwebendes Glas-Panel. Mobile-first.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  homeHref = "/",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  homeHref?: string;
}) {
  return (
    <div className="agent-scope min-h-screen bg-slate-50 relative overflow-hidden flex items-center justify-center px-4 py-10">
      {/* Ambient-Hintergrund: Signature-Core + weiche Orbs (dezent, CI) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -right-16 opacity-60 agent-float" style={{ animationDelay: "0s" }}>
          <SignatureCore size={360} />
        </div>
        <div
          className="absolute -bottom-32 -left-24 rounded-full agent-float"
          style={{
            width: 420,
            height: 420,
            background: "radial-gradient(circle, rgba(37,99,235,.08), transparent 70%)",
            animationDelay: "3s",
          }}
        />
        <div
          className="absolute top-1/3 left-10 rounded-full"
          style={{ width: 260, height: 260, background: "radial-gradient(circle, rgba(100,116,139,.06), transparent 70%)" }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm">
        <div className="text-center mb-8">
          <Reveal index={0}>
            <a href={homeHref} className="text-2xl font-black tracking-tight" style={{ color: ACCENT }}>
              FIAON
            </a>
          </Reveal>
          <Reveal index={1}>
            <h1 className="text-[16px] font-semibold text-slate-900 mt-2">{title}</h1>
          </Reveal>
          {subtitle && (
            <Reveal index={2}>
              <p className="text-[12.5px] text-slate-400 mt-1 leading-relaxed">{subtitle}</p>
            </Reveal>
          )}
        </div>
        <Reveal index={3}>
          <div className="agent-panel-in rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,.04),0_24px_60px_-24px_rgba(15,23,42,.22)] p-6 sm:p-7">
            {children}
          </div>
        </Reveal>
        <Reveal index={4}>
          <p className="text-center text-[11px] text-slate-300 mt-6">Nur für autorisierte Mitarbeiter · FIAON</p>
        </Reveal>
      </div>
    </div>
  );
}

/** Vollbreiter Primärbutton mit Lade-Spinner. Verwendet die CI-Akzentfarbe. */
export function SubmitButton({
  loading,
  children,
  disabled,
  className = "",
}: {
  loading?: boolean;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`w-full py-3.5 rounded-xl text-white text-[14px] font-semibold inline-flex items-center justify-center gap-2 transition-all duration-150 disabled:opacity-40 active:scale-[.99] ${className}`}
      style={{ background: ACCENT, minHeight: 50, boxShadow: "0 8px 20px -10px rgba(37,99,235,.6)" }}
    >
      {loading && <span className="agent-spinner" />}
      {children}
    </button>
  );
}

/**
 * Erfolgs-Moment: legt kurz die `agent-success`-Animation über die Kinder,
 * sobald sich `trigger` ändert (z. B. Provision → bestätigt). ≤800ms, einmalig,
 * respektiert reduced-motion.
 */
export function SuccessPulse({ trigger, children, className = "" }: { trigger: unknown; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const [on, setOn] = useState(false);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (reduced) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 850);
    return () => clearTimeout(t);
  }, [trigger, reduced]);
  return <div className={`${on ? "agent-success" : ""} ${className}`}>{children}</div>;
}
