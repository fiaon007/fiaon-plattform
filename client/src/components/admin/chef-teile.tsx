// ═══════════════════════════════════════════════════════════════════════════
// DIE BAUTEILE DES CHEFBÜROS (26.08.2026)
//
// Alle Chef-Räume verwenden dieselben vier Dinge: eine Glaskarte, die sich
// zum Zeiger neigt, eine Zahl, die einmal hochzählt, die Zahlenformate und
// den Zugriff auf die Schnittstelle.
//
// WARUM AN EINER STELLE: Wären sie je Raum kopiert, hätte der zweite Raum
// nach der ersten Änderung anders ausgesehen als der erste — und genau das
// nimmt einem Dashboard die Ruhe, von der es lebt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";

export const API = "/api/fiaon";

// ── Zahlenformate ─────────────────────────────────────────────────────────
export const eur = (cents: number) =>
  (Number(cents || 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export const eurKurz = (cents: number) => {
  const v = Number(cents || 0) / 100;
  if (Math.abs(v) >= 1000) return (v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 }) + "k €";
  return v.toLocaleString("de-DE", { maximumFractionDigits: 0 }) + " €";
};

export const zahl = (n: number) => Number(n || 0).toLocaleString("de-DE");

export const datum = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

export const datumZeit = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/** Wie lange ist das her — in Worten, wie ein Mensch es sagen würde. */
export const seit = (s: string | null | undefined): string => {
  if (!s) return "—";
  const ms = Date.now() - new Date(s).getTime();
  const tage = Math.floor(ms / 86_400_000);
  if (tage <= 0) {
    const std = Math.floor(ms / 3_600_000);
    if (std <= 0) return "gerade eben";
    return `vor ${std} ${std === 1 ? "Stunde" : "Stunden"}`;
  }
  if (tage === 1) return "gestern";
  if (tage < 31) return `vor ${tage} Tagen`;
  const monate = Math.floor(tage / 30);
  return `vor ${monate} ${monate === 1 ? "Monat" : "Monaten"}`;
};

/** Hat der Betrachter Bewegung abbestellt? */
export const ruhig = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// ── Eine Zahl, die beim Erscheinen einmal hochzählt ───────────────────────
// Nicht als Spielerei: Der Blick folgt der Bewegung und bleibt an der Zahl
// hängen — genau dort, wo er hin soll. Danach ist Ruhe.
export function Hochzaehler({ ziel, dauer = 1100, formatieren }: {
  ziel: number; dauer?: number; formatieren: (n: number) => string;
}) {
  const [wert, setWert] = useState(0);
  const gelaufen = useRef(false);
  useEffect(() => {
    if (gelaufen.current) { setWert(ziel); return; }
    if (ruhig()) { setWert(ziel); return; }
    gelaufen.current = true;
    const start = performance.now();
    let laeuft = true;
    const tick = (t: number) => {
      if (!laeuft) return;
      const p = Math.min(1, (t - start) / dauer);
      setWert(Math.round(ziel * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    return () => { laeuft = false; };
  }, [ziel, dauer]);
  return <>{formatieren(wert)}</>;
}

// ── Eine Glaskarte, die sich leicht zum Zeiger neigt ──────────────────────
export function Karte({ children, klasse = "", href, onClick, titel }: {
  children: ReactNode; klasse?: string; href?: string; onClick?: () => void; titel?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const neigen = (e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || ruhig()) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--kx", String(-y * 5));
    el.style.setProperty("--ky", String(x * 5));
    el.style.setProperty("--lx", `${(x + 0.5) * 100}%`);
    el.style.setProperty("--ly", `${(y + 0.5) * 100}%`);
  };
  const zurueck = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--kx", "0");
    el.style.setProperty("--ky", "0");
  };
  const inhalt = (
    <div ref={ref} className={`cl-karte ${klasse}`} onMouseMove={neigen} onMouseLeave={zurueck} title={titel}>
      <span className="cl-glanz" aria-hidden="true" />
      {children}
    </div>
  );
  if (href) return <a href={href} className="cl-karte-link">{inhalt}</a>;
  if (onClick) return <button type="button" className="cl-karte-link" onClick={onClick}>{inhalt}</button>;
  return inhalt;
}

/**
 * Ein Ladezustand, der die spätere Form schon andeutet.
 * Ein Spinner sagt „warte"; eine angedeutete Form sagt „hier kommt eine
 * Tabelle" — und der Sprung beim Erscheinen fällt weg.
 */
export function Geruest({ zeilen = 6 }: { zeilen?: number }) {
  return (
    <div className="cl-geruest" aria-hidden="true">
      {Array.from({ length: zeilen }).map((_, i) => (
        <span key={i} style={{ animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  );
}

/** Kurzer Fehlerhinweis im Ton des Hauses: was ist, und was man tun kann. */
export function Fehlermeldung({ text, erneut }: { text: string; erneut?: () => void }) {
  return (
    <div className="cl-fehler" role="alert">
      <b>{text}</b>
      {erneut && <button type="button" onClick={erneut}>Nochmal versuchen</button>}
    </div>
  );
}

/** Holt Daten und hält Ladezustand und Fehler — dasselbe Muster in jedem Raum. */
export function useDaten<T>(pfad: string, abhaengig: unknown[] = []): {
  daten: T | null; laedt: boolean; fehler: string | null; neu: () => void;
} {
  const [daten, setDaten] = useState<T | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [runde, setRunde] = useState(0);

  useEffect(() => {
    let weg = false;
    setLaedt(true);
    setFehler(null);
    fetch(`${API}${pfad}`, { credentials: "include" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (weg) return;
        if (r.status === 401) { setFehler("Die Anmeldung ist abgelaufen. Bitte neu anmelden."); return; }
        if (r.status === 403) { setFehler(j?.error || "Dafür reicht deine Stufe nicht."); return; }
        if (j?.ok) setDaten(j as T);
        else setFehler(j?.error || "Das ließ sich nicht laden.");
      })
      .catch(() => { if (!weg) setFehler("Keine Verbindung zum Server."); })
      .finally(() => { if (!weg) setLaedt(false); });
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pfad, runde, ...abhaengig]);

  return { daten, laedt, fehler, neu: () => setRunde((r) => r + 1) };
}
