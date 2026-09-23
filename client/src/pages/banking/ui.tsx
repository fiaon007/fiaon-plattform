// ═══════════════════════════════════════════════════════════════════════════
// FIAON BANKING — Bausteine (E-228)
// Zeichen im 24er-Raster mit 1,5er Strich, Knöpfe, Kopierfelder, Segment-
// eingaben für PIN und TAN, Schublade und Dialog, das Guilloche-Band.
// ═══════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

// ── Zeichen ─────────────────────────────────────────────────────────────────
const PFADE: Record<string, string> = {
  start: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  umsatz: "M4 7h16M4 12h16M4 17h10",
  senden: "M4 12h13M13 6l6 6-6 6",
  auftraege: "M9 6h10M9 12h10M9 18h10M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  team: "M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 19c.6-3 2.8-4.5 5.5-4.5S13.4 16 14 19M16 5.5a3 3 0 0 1 0 5.5M18 14.5c1.6.5 2.6 1.9 3 4.5",
  wiederholen: "M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4",
  dokument: "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4M9 12.5h6M9 16h6",
  kartei: "M4 6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5zM8.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 16c.4-1.4 1.3-2.2 2.5-2.2S10.6 14.6 11 16M14 10h3.5M14 13.5h3.5",
  schild: "M12 3.5 5 6.5v5c0 4.4 3 7.9 7 9 4-1.1 7-4.6 7-9v-5z M9 12l2 2 4-4",
  waage: "M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z",
  schloss: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1ZM12 15v2",
  kopieren: "M9 9h9.5a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5zM15 9V5.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H9",
  haken: "M5 12.5l4.5 4.5L19 7.5",
  kreuz: "M6 6l12 12M18 6 6 18",
  suche: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
  herunter: "M12 4v11M7 10.5 12 15.5l5-5M5 20h14",
  pdf: "M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5ZM14 3.5V8h4M8.5 16.5v-4h1.4a1.3 1.3 0 0 1 0 2.6H8.5M13 12.5v4h.9a1.6 1.6 0 0 0 1.6-1.6v-.8a1.6 1.6 0 0 0-1.6-1.6z",
  rein: "M18 6 6 18M6 9v9h9",
  raus: "M6 18 18 6M9 6h9v9",
  uhr: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 8v4.5l3 2",
  abmelden: "M14 5H6.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5H14M10 12h10M17 9l3 3-3 3",
  menue: "M4 7h16M4 12h16M4 17h16",
  links: "M15 6l-6 6 6 6",
  rechts: "M9 6l6 6-6 6",
  plus: "M12 5v14M5 12h14",
  warnung: "M12 4 3 19.5h18zM12 10v4.5M12 17.2h.01",
  info: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM12 11v5M12 8h.01",
  bank: "M3.5 9.5 12 4l8.5 5.5M5 10v7.5M9.5 10v7.5M14.5 10v7.5M19 10v7.5M3.5 20.5h17",
  karte: "M3.5 7A1.5 1.5 0 0 1 5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17zM3.5 9.5h17M7 15h4",
  person: "M12 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5",
  auge: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12ZM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
};

export function Zeichen({ n, g = 18, className }: { n: keyof typeof PFADE | string; g?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={g} height={g} aria-hidden="true" className={className}
      fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d={PFADE[n] ?? PFADE.info} />
    </svg>
  );
}

// ── Knöpfe ──────────────────────────────────────────────────────────────────
type KnopfArt = "primaer" | "neutral" | "warnung" | "still" | "hell";
export function Knopf({ art = "neutral", children, zeichen, klein, ...rest }: {
  art?: KnopfArt; children: ReactNode; zeichen?: string; klein?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...rest} className={`bk-knopf bk-knopf-${art}${klein ? " bk-knopf-klein" : ""} ${rest.className ?? ""}`}>
      {zeichen ? <Zeichen n={zeichen} g={klein ? 15 : 16} /> : null}
      <span>{children}</span>
    </button>
  );
}

export function KnopfLink({ href, children, zeichen, art = "neutral", klein, neu = true }: {
  href: string; children: ReactNode; zeichen?: string; art?: KnopfArt; klein?: boolean; neu?: boolean;
}) {
  return (
    <a href={href} target={neu ? "_blank" : undefined} rel={neu ? "noreferrer" : undefined}
      className={`bk-knopf bk-knopf-${art}${klein ? " bk-knopf-klein" : ""}`}>
      {zeichen ? <Zeichen n={zeichen} g={klein ? 15 : 16} /> : null}
      <span>{children}</span>
    </a>
  );
}

// ── Kopieren ────────────────────────────────────────────────────────────────
export function Kopieren({ wert, beschriftung, klein }: { wert: string; beschriftung?: string; klein?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className={`bk-kopier${klein ? " bk-knopf-klein" : ""}`} aria-label={`${beschriftung ?? "Wert"} kopieren`}
      onClick={async () => {
        try { await navigator.clipboard.writeText(wert); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* ohne Zwischenablage */ }
      }}>
      <Zeichen n={ok ? "haken" : "kopieren"} g={14} />
      <span>{ok ? "Kopiert" : "Kopieren"}</span>
    </button>
  );
}

/** Ein Wert zum Abschreiben: Beschriftung, Wert in Mono, Kopierknopf. */
export function Kopierfeld({ l, w, mono = true }: { l: string; w: string; mono?: boolean }) {
  return (
    <div className="bk-kopierfeld">
      <span className="bk-kf-l">{l}</span>
      <span className={`bk-kf-w${mono ? " bk-mono" : ""}`}>{w}</span>
      <Kopieren wert={w.replace(/\s+/g, mono ? "" : " ")} beschriftung={l} klein />
    </div>
  );
}

// ── Marken ──────────────────────────────────────────────────────────────────
export type ChipArt = "gut" | "warn" | "fehler" | "info" | "still" | "tief";
export const Chip = ({ art = "still", children, zeichen }: { art?: ChipArt; children: ReactNode; zeichen?: string }) => (
  <span className={`bk-chip bk-chip-${art}`}>{zeichen ? <Zeichen n={zeichen} g={12} /> : null}{children}</span>
);

// ── Leer / Laden / Fehler ───────────────────────────────────────────────────
export const Leer = ({ titel, text, children }: { titel: string; text?: string; children?: ReactNode }) => (
  <div className="bk-leer">
    <div className="bk-leer-t">{titel}</div>
    {text ? <div className="bk-leer-x">{text}</div> : null}
    {children}
  </div>
);

export const Laden = ({ zeilen = 5 }: { zeilen?: number }) => (
  <div className="bk-laden" aria-busy="true" aria-label="Wird geladen">
    {Array.from({ length: zeilen }, (_, i) => <div key={i} className="bk-laden-z" style={{ width: `${92 - (i % 3) * 14}%` }} />)}
  </div>
);

export const Meldung = ({ art, children, onZu }: { art: "gut" | "fehler" | "info" | "warn"; children: ReactNode; onZu?: () => void }) => (
  <div className={`bk-meldung bk-meldung-${art}`} role={art === "fehler" ? "alert" : "status"}>
    <Zeichen n={art === "gut" ? "haken" : art === "fehler" ? "warnung" : "info"} g={16} />
    <div className="bk-meldung-t">{children}</div>
    {onZu ? <button type="button" className="bk-meldung-zu" aria-label="Schließen" onClick={onZu}><Zeichen n="kreuz" g={14} /></button> : null}
  </div>
);

// ── Schublade (Detail von rechts, mobil von unten) ─────────────────────────
export function Schublade({ offen, titel, onZu, children, fuss }: {
  offen: boolean; titel: ReactNode; onZu: () => void; children: ReactNode; fuss?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // onZu über eine Referenz: Eine neue Funktion bei jedem Rendern darf den
  // Fokus nicht jedes Mal zurück auf die Schublade reißen.
  const zuRef = useRef(onZu);
  zuRef.current = onZu;
  useEffect(() => {
    if (!offen) return;
    const vorher = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") zuRef.current(); };
    window.addEventListener("keydown", taste);
    return () => { window.removeEventListener("keydown", taste); vorher?.focus?.(); };
  }, [offen]);
  if (!offen) return null;
  return (
    <div className="bk-schleier" onMouseDown={(e) => { if (e.target === e.currentTarget) onZu(); }}>
      <aside className="bk-schublade" role="dialog" aria-modal="true" tabIndex={-1} ref={ref}>
        <header className="bk-sch-kopf">
          <div className="bk-sch-titel">{titel}</div>
          <button type="button" className="bk-ikon-knopf" aria-label="Schließen" onClick={onZu}><Zeichen n="kreuz" /></button>
        </header>
        <div className="bk-sch-inhalt">{children}</div>
        {fuss ? <footer className="bk-sch-fuss">{fuss}</footer> : null}
      </aside>
    </div>
  );
}

// ── Dialog ──────────────────────────────────────────────────────────────────
export function Dialog({ offen, titel, onZu, children, breit }: {
  offen: boolean; titel: ReactNode; onZu: () => void; children: ReactNode; breit?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const zuRef = useRef(onZu);
  zuRef.current = onZu;
  useEffect(() => {
    if (!offen) return;
    const vorher = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const erstes = ref.current?.querySelector<HTMLElement>("input, button, [tabindex='0']");
      (erstes ?? ref.current)?.focus();
    }, 20);
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") zuRef.current(); };
    window.addEventListener("keydown", taste);
    return () => { clearTimeout(t); window.removeEventListener("keydown", taste); vorher?.focus?.(); };
  }, [offen]);
  if (!offen) return null;
  return (
    <div className="bk-schleier bk-schleier-mitte" onMouseDown={(e) => { if (e.target === e.currentTarget) onZu(); }}>
      <div className={`bk-dialog${breit ? " bk-dialog-breit" : ""}`} role="dialog" aria-modal="true" ref={ref} tabIndex={-1}>
        <header className="bk-dialog-kopf">
          <div className="bk-dialog-titel">{titel}</div>
          <button type="button" className="bk-ikon-knopf" aria-label="Schließen" onClick={onZu}><Zeichen n="kreuz" /></button>
        </header>
        <div className="bk-dialog-inhalt">{children}</div>
      </div>
    </div>
  );
}

// ── Segmenteingabe für PIN und TAN ──────────────────────────────────────────
/**
 * Einzelne Kästchen, wie bei einer Bank. `gruppen` = Anzahl Zeichen je Gruppe
 * (PIN: [4,4,4], TAN: [3,3]). Einfügen verteilt die ganze Zeichenkette.
 */
export function Segmente({ gruppen, wert, onWert, erlaubt, dunkel, autoFocus, beschriftung }: {
  gruppen: number[]; wert: string; onWert: (w: string) => void; erlaubt: RegExp; dunkel?: boolean; autoFocus?: boolean; beschriftung: string;
}) {
  const laenge = gruppen.reduce((s, n) => s + n, 0);
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const zeichen = wert.padEnd(laenge, " ").slice(0, laenge).split("");
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
  const setzen = (i: number, roh: string) => {
    const sauber = roh.toUpperCase().split("").filter((c) => erlaubt.test(c)).join("");
    if (!sauber) return;
    const neu = (wert.slice(0, i) + sauber).slice(0, laenge);
    onWert(neu);
    refs.current[Math.min(neu.length, laenge - 1)]?.focus();
  };
  let index = -1;
  return (
    <div className={`bk-segmente${dunkel ? " bk-seg-dunkel" : ""}`} role="group" aria-label={beschriftung}>
      {gruppen.map((n, g) => (
        <div className="bk-seg-gruppe" key={g}>
          {Array.from({ length: n }, () => {
            index += 1;
            const i = index;
            return (
              <input key={i} ref={(el) => { refs.current[i] = el; }}
                className="bk-seg" inputMode={erlaubt.test("A") ? "text" : "numeric"} autoComplete={i === 0 ? "one-time-code" : "off"}
                aria-label={`${beschriftung}, Stelle ${i + 1} von ${laenge}`}
                value={zeichen[i] === " " ? "" : zeichen[i]} maxLength={laenge}
                onChange={(e) => setzen(i, e.target.value.slice(-1) || "")}
                onPaste={(e) => { e.preventDefault(); setzen(0, e.clipboardData.getData("text")); }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    e.preventDefault();
                    const bis = wert.length > i ? i : Math.max(0, i - 1);
                    onWert(wert.slice(0, bis));
                    refs.current[bis]?.focus();
                  } else if (e.key === "ArrowLeft") refs.current[Math.max(0, i - 1)]?.focus();
                  else if (e.key === "ArrowRight") refs.current[Math.min(laenge - 1, i + 1)]?.focus();
                }} />
            );
          })}
          {g < gruppen.length - 1 ? <span className="bk-seg-strich" aria-hidden="true" /> : null}
        </div>
      ))}
    </div>
  );
}

// ── Guilloche ───────────────────────────────────────────────────────────────
/** Das Band eines Wertpapiers — überlagerte Wellen mit Phasenversatz. */
export function Guilloche({ linien = 20, className }: { linien?: number; className?: string }) {
  const pfade = useMemo(() => {
    const aus: string[] = [];
    const B = 800, H = 120, schritte = 220;
    for (let k = 0; k < linien; k++) {
      const phase = (k / linien) * Math.PI * 2;
      let d = "";
      for (let i = 0; i <= schritte; i++) {
        const t = (i / schritte) * Math.PI * 2;
        const x = (i / schritte) * B;
        const y = H / 2 + H * 0.34 * Math.sin(t * 2.5 + phase) * Math.cos(t * 1.25 - phase / 2) + H * 0.06 * Math.sin(t * 11 + phase * 2);
        d += `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      aus.push(d);
    }
    return aus;
  }, [linien]);
  return (
    <svg className={className} viewBox="0 0 800 120" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={0.6} vectorEffect="non-scaling-stroke">
        {pfade.map((d, i) => <path key={i} d={d} vectorEffect="non-scaling-stroke" />)}
      </g>
    </svg>
  );
}

// ── Kleine Hilfen ───────────────────────────────────────────────────────────
export function useEntprellt<T>(wert: T, ms = 200): T {
  const [w, setW] = useState(wert);
  useEffect(() => { const t = setTimeout(() => setW(wert), ms); return () => clearTimeout(t); }, [wert, ms]);
  return w;
}

export const Feld = ({ id, l, hinweis, fehler, children, breit }: {
  id: string; l: string; hinweis?: ReactNode; fehler?: string | null; children: ReactNode; breit?: boolean;
}) => (
  <div className={`bk-feld${breit ? " bk-breit" : ""}${fehler ? " bk-feld-fehler" : ""}`}>
    <label htmlFor={id}>{l}</label>
    {children}
    {fehler ? <span className="bk-feld-h bk-feld-h-fehler">{fehler}</span> : hinweis ? <span className="bk-feld-h">{hinweis}</span> : null}
  </div>
);
