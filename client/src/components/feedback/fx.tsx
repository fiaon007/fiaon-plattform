import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";

// ============================================================================
// FIAON — Plattformweite Interaktions-Feedback-Primitive (fx-Layer)
// Rein visuell: KEINE Logik-, Routen- oder Datenänderungen. Die Primitive
// binden sich an bestehende Handler/Zustände an. Styles: index.css (fx-*).
// Timings zentral: --fx-fast 120ms / --fx-base 220ms / --fx-slow 400ms.
// ============================================================================

/** Dezente 2px-Fortschrittsleiste am oberen Rand bei jedem Routenwechsel. */
export function RouteProgress() {
  const [location] = useLocation();
  const [tick, setTick] = useState(0);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setTick((t) => t + 1);
  }, [location]);
  if (!tick) return null;
  return <div key={tick} className="fx-route-progress" aria-hidden="true" />;
}

/** Einheitlicher Seiten-Eintritt (opacity + 8px Y, 250ms) — einmal in App.tsx. */
export function PageEnter({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div key={location} className="fx-page-enter">
      {children}
    </div>
  );
}

/** Inline-Spinner, erbt die Textfarbe des Buttons. */
export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`fx-spinner ${className}`} aria-hidden="true" />;
}

/**
 * Stabile Button-Beschriftung für Async-Buttons: Label bleibt im Layout
 * (unsichtbar bei busy/ok) → Breite konstant, kein Layout-Shift.
 * In BESTEHENDE Buttons einsetzen — Button-Styling bleibt unangetastet.
 */
export function BtnLabel({
  busy,
  ok,
  children,
}: {
  busy?: boolean;
  ok?: boolean;
  children: ReactNode;
}) {
  const swap = busy || ok;
  return (
    <span className="relative inline-flex items-center justify-center">
      <span className={`inline-flex items-center gap-2 transition-opacity duration-150 ${swap ? "opacity-0" : "opacity-100"}`}>
        {children}
      </span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner />
        </span>
      )}
      {ok && !busy && (
        <span className="absolute inset-0 flex items-center justify-center fx-check-in">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
      )}
    </span>
  );
}

/**
 * Visuelles Async-Feedback um einen BESTEHENDEN Handler: busy (Spinner +
 * Doppelklick-Schutz) → ok-Häkchen ~600ms bzw. Fehler-Shake 300ms.
 * Ändert die Handler-Logik nicht; Fehler werden weitergereicht, wenn der
 * Handler wirft, sonst entscheidet der Rückgabewert (false = Fehler).
 */
export function useAsyncFx() {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [shake, setShake] = useState(0);
  const busyRef = useRef(false);

  const run = useCallback(async (fn: () => Promise<unknown> | unknown): Promise<void> => {
    if (busyRef.current) return; // Doppelklick-Schutz
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await fn();
      setBusy(false);
      busyRef.current = false;
      if (result === false) {
        setShake((s) => s + 1);
        return;
      }
      setOk(true);
      setTimeout(() => setOk(false), 600);
    } catch (e) {
      setBusy(false);
      busyRef.current = false;
      setShake((s) => s + 1);
      throw e;
    }
  }, []);

  return { busy, ok, shake, run };
}

/** CSS-Klasse, die bei jeder Änderung von `trigger` neu shaked (300ms). */
export function useShakeClass(trigger: unknown): string {
  const [cls, setCls] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (trigger === null || trigger === undefined || trigger === 0 || trigger === "") return;
    setCls("fx-shake");
    const t = setTimeout(() => setCls(""), 350);
    return () => clearTimeout(t);
  }, [trigger]);
  return cls;
}

/** Einzelner Skeleton-Block (Größe via className, z. B. "h-4 w-32"). */
export function Skel({ className = "" }: { className?: string }) {
  return <div className={`fx-skel ${className}`} aria-hidden="true" />;
}

/** Skeleton-Zeilen in Form einer Liste/Tabelle (kein Riesen-Spinner). */
export function SkelRows({
  rows = 6,
  height = "h-12",
  className = "",
}: {
  rows?: number;
  height?: string;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true" role="status" aria-label="Wird geladen">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={`fx-skel w-full ${height}`} style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

/** Erfolgs-Toast: 3,5s sichtbar, weiche Bewegung. */
export function notifySuccess(title: string, description?: string) {
  toast({ title, description, duration: 3500, className: "fx-toast-in" });
}

/** Fehler-Toast: bleibt bis zum Wegklicken stehen. */
export function notifyError(title: string, description?: string) {
  toast({ title, description, variant: "destructive", duration: 1000 * 60 * 60, className: "fx-toast-in" });
}
