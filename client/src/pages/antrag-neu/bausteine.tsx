// Die Bausteine des neuen Antrags — aus dem freigegebenen Prototyp v2 übernommen
// (Klassen „an-*", Stil in antrag-neu.css). Eigene Linien-Symbole (1.5 px), keine Bibliothek.
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { AntragNeuSchritt } from "@shared/fiaon-antrag-neu";
import type { Zustand } from "./zustand";
import type { KartenBuehne } from "./karte3d";

// ── Symbole (20 px, Linie) ───────────────────────────────────────────────
const ICO: Record<string, ReactNode> = {
  angestellt: <><path d="M4 8.5h12v8H4z" /><path d="M7.5 8.5V6.6c0-.9.7-1.6 1.6-1.6h1.8c.9 0 1.6.7 1.6 1.6v1.9" /><path d="M4 12h12" /></>,
  beamt: <><path d="M3.5 8L10 4l6.5 4" /><path d="M5 8.5v6M8.3 8.5v6M11.7 8.5v6M15 8.5v6" /><path d="M3.5 16h13" /></>,
  selbst: <><circle cx="10" cy="10" r="6.5" /><path d="M10 6.5v3.7l2.5 1.6" /></>,
  rente: <><path d="M5 16c0-3 2.2-5 5-5s5 2 5 5" /><circle cx="10" cy="6.8" r="2.6" /></>,
  ausbildung: <><path d="M2.5 8L10 4.5 17.5 8 10 11.5z" /><path d="M5.5 9.5v3.6c1.2 1.1 2.7 1.7 4.5 1.7s3.3-.6 4.5-1.7V9.5" /></>,
  suchend: <><circle cx="8.8" cy="8.8" r="4.8" /><path d="M12.4 12.4l4 4" /></>,
  sonst: <><circle cx="5" cy="10" r="1" /><circle cx="10" cy="10" r="1" /><circle cx="15" cy="10" r="1" /></>,
  alltag: <><path d="M4 6.5h12l-1.2 8.5H5.2z" /><path d="M7.3 6.5a2.7 2.7 0 0 1 5.4 0" /></>,
  online: <><rect x="3" y="4.5" width="14" height="9.5" rx="1.5" /><path d="M7 16.5h6" /></>,
  reisen: <path d="M3.5 11.2l13-5.2-3.4 9.5-3.3-3.1-3.6 1.5z" />,
  mobil: <><path d="M5 13.5V8.2l1.6-3h6.8l1.6 3v5.3" /><path d="M4 13.5h12v2H4z" /><circle cx="7" cy="11" r=".9" /><circle cx="13" cy="11" r=".9" /></>,
  abos: <><rect x="3" y="5" width="14" height="10" rx="2" /><path d="M8.7 8.2l3.4 1.8-3.4 1.8z" /></>,
  reserve: <path d="M10 3.5l5.5 2.2v4.1c0 3.4-2.3 5.6-5.5 6.7-3.2-1.1-5.5-3.3-5.5-6.7V5.7z" />,
  miete: <><path d="M3.5 9.2L10 4l6.5 5.2" /><path d="M5.5 8v8h9V8" /><path d="M8.5 16v-4h3v4" /></>,
  eigentum: <><path d="M3.5 9.2L10 4l6.5 5.2" /><path d="M5.5 8v8h9V8" /><path d="M8.2 12.2l1.3 1.3 2.4-2.6" /></>,
  familie: <><circle cx="7" cy="7.2" r="2.2" /><circle cx="13.4" cy="8.2" r="1.8" /><path d="M3 16c0-2.4 1.8-4.2 4-4.2s4 1.8 4 4.2" /><path d="M11.6 16c0-1.8 1-3.3 2.4-3.3s2.6 1.5 2.6 3.3" /></>,
  pin: <><path d="M10 17s5-4.6 5-8.7A5 5 0 0 0 5 8.3C5 12.4 10 17 10 17z" /><circle cx="10" cy="8.3" r="1.8" /></>,
  schloss: <><rect x="4.5" y="9" width="11" height="8" rx="2" /><path d="M7 9V6.8a3 3 0 0 1 6 0V9" /><path d="M10 12.3v1.9" /></>,
};
export function Ico({ name, klasse = "an-ico" }: { name: string; klasse?: string }) {
  return (
    <svg className={klasse} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICO[name]}
    </svg>
  );
}
export const Pfeil = () => (
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 10h11M11 5.5L15.5 10 11 14.5" /></svg>
);
export const ZurueckPfeil = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3.5L5.5 8l4.5 4.5" /></svg>
);

// ── Der Seiten-Kontext ───────────────────────────────────────────────────
export type GeheOpt = { richtung?: "vor" | "zurueck"; push?: boolean; ersetzen?: boolean; ohnePruefung?: boolean; hinweis?: { feld?: string; text: string } };
export interface AntragKontext {
  S: Zustand;
  setze: (teil: Partial<Zustand>) => void;
  /** Der aktuelle Zustand ohne Neu-Rendern (für Zeitgeber und Animationen). */
  aktuell: () => Zustand;
  jetzt: AntragNeuSchritt;
  gehe: (id: AntragNeuSchritt, opt?: GeheOpt) => void;
  weiter: () => void;
  toast: (t: string) => void;
  oeffneSheet: (inhalt: ReactNode, titel?: string) => void;
  schliesseSheet: () => void;
  buehne: () => KartenBuehne | null;
  lichtStreif: () => void;
  ruhig: () => boolean;
  sitzung: string;
  /** Speichert im Hintergrund (eine Anfrage zur Zeit, die letzte gewinnt). */
  speichern: (schritt: AntragNeuSchritt, teil?: Partial<Zustand>) => Promise<boolean>;
  ereignis: (ereignis: string, o?: { schritt?: string; detail?: string | number }) => void;
  /** Ein Hinweis, der beim nächsten Bildschirm an einem Feld steht (Rückführung vom Server). */
  hinweis: { schritt: AntragNeuSchritt; feld?: string; text: string } | null;
  hinweisGelesen: () => void;
  /** Text des Weiter-Knopfs — nach „Angaben ändern": „Speichern und zurück zum …". */
  weiterText: (standard: string) => string;
  /** Die Bühne (links) und ihr Orbit-Behälter — für die Prüf-Animation. */
  buehnenBox: () => HTMLDivElement | null;
  orbitBox: () => HTMLDivElement | null;
  /** Paket-Deck: angezeigtes Paket (Index) und Wechsel dorthin. */
  deckIndex: number;
  deckGehe: (i: number) => void;
  /** Paket wählen (setzt Limit passend, verwirft eine Unterschrift); gibt die geänderten Felder zurück. */
  paketWaehlen: (key: string, limit?: number) => Partial<Zustand>;
}
export const Kontext = createContext<AntragKontext | null>(null);
export function useAntrag(): AntragKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error("useAntrag außerhalb des Antrags");
  return k;
}

// ── Tipp-Effekt ohne Layoutsprung ────────────────────────────────────────
/**
 * Der Text steht unsichtbar in voller Länge (Geist) und hält die Höhe; darüber
 * wird er Zeichen für Zeichen geschrieben. Screenreader lesen das aria-label.
 */
export function Tippbar({ text, klasse = "", tag: Tag = "div", animiert = true, ms, verzoegerung = 0, onFertig, tabIndex, titelRef }: {
  text: string; klasse?: string; tag?: "div" | "p" | "span" | "h1"; animiert?: boolean; ms?: number; verzoegerung?: number;
  onFertig?: () => void; tabIndex?: number; titelRef?: React.Ref<HTMLElement>;
}) {
  const { ruhig } = useAntrag();
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = el.current;
    if (!t) return;
    if (!animiert || ruhig()) { t.textContent = text; onFertig?.(); return; }
    let weg = false;
    const schritt = ms || Math.max(9, Math.min(26, 560 / Math.max(1, text.length)));
    let i = 0;
    t.textContent = "";
    const zeit: number[] = [];
    const weiter = () => {
      if (weg) return;
      i++;
      t.textContent = text.slice(0, i);
      if (i < text.length) zeit.push(window.setTimeout(weiter, schritt + (/[,.–]/.test(text.charAt(i - 1)) ? schritt * 3 : 0)));
      else zeit.push(window.setTimeout(() => { if (!weg) { t.classList.remove("an-laeuft"); onFertig?.(); } }, 380));
    };
    zeit.push(window.setTimeout(() => { if (!weg) { t.classList.add("an-laeuft"); weiter(); } }, verzoegerung));
    return () => { weg = true; zeit.forEach((z) => clearTimeout(z)); t.classList.remove("an-laeuft"); t.textContent = text; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animiert]);
  return (
    <Tag className={`an-tippbar ${klasse}`} tabIndex={tabIndex} ref={titelRef as any}>
      {/* Für Screenreader der ganze Text sofort — aria-label gilt an span/p/div nicht verlässlich. */}
      <span className="an-sr">{text}</span>
      <span className="an-geist" aria-hidden="true">{text}</span>
      <span className="an-tipp-text" aria-hidden="true" ref={el} />
    </Tag>
  );
}

/** Die Überschrift eines Bildschirms (wird beim Erscheinen geschrieben und erhält den Fokus). */
export function Titel({ text, fokus = true }: { text: string; fokus?: boolean }) {
  const r = useRef<HTMLElement>(null);
  useEffect(() => { if (fokus) try { r.current?.focus({ preventScroll: true }); } catch { /* egal */ } }, [fokus]);
  return <Tippbar text={text} klasse="an-titel" tag="h1" tabIndex={-1} titelRef={r} />;
}

export const Lead = ({ children }: { children: ReactNode }) => <p className="an-lead">{children}</p>;

export function Knopf({ text, onClick, laedt = false, ohnePfeil = false, art = "haupt", children }: {
  text: ReactNode; onClick: () => void; laedt?: boolean; ohnePfeil?: boolean; art?: "haupt" | "leise"; children?: ReactNode;
}) {
  return (
    <div className="an-knoepfe">
      <button type="button" className={`an-knopf an-${art}`} onClick={onClick} disabled={laedt} aria-busy={laedt || undefined} data-weiter="">
        {laedt ? <span className="an-laden" aria-hidden="true" /> : null}
        {text}
        {!laedt && !ohnePfeil ? <Pfeil /> : null}
      </button>
      {children}
    </div>
  );
}

export function Warum({ text }: { text: string }) {
  const [offen, setOffen] = useState(false);
  return (
    <>
      <button type="button" className="an-warum" aria-expanded={offen} onClick={() => setOffen(!offen)}>Warum fragen wir das?</button>
      {offen ? <p className="an-warum-text">{text}</p> : null}
    </>
  );
}

export function Tipp({ text, id }: { text: string; id?: string }) {
  return <div className="an-tipp" id={id} role="alert">{text}</div>;
}

// ── Fehler an Feldern ────────────────────────────────────────────────────
/**
 * Ein Hinweis an genau einem Feld. Beim Setzen: Messung (nur der Feldname),
 * sichtbar machen, Fokus. Vom Server zurückgeführte Hinweise erscheinen beim
 * Betreten des Bildschirms.
 */
export function useFehler(schritt: AntragNeuSchritt) {
  const { ereignis, hinweis, hinweisGelesen, ruhig } = useAntrag();
  const [fehler, setFehler] = useState<{ feld: string; text: string } | null>(() => (hinweis && hinweis.schritt === schritt ? { feld: hinweis.feld || "", text: hinweis.text } : null));
  useEffect(() => { if (hinweis && hinweis.schritt === schritt) hinweisGelesen(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const zeigen = useCallback((feld: string, text: string) => {
    setFehler({ feld, text });
    ereignis("fehler", { schritt, detail: feld });
    requestAnimationFrame(() => {
      const el = (document.getElementById(`an-${feld}`) || document.querySelector(`[data-feld="${feld}"]`)) as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.top < 90 || r.bottom > window.innerHeight - 40) el.scrollIntoView({ behavior: ruhig() ? "auto" : "smooth", block: "center" });
      if (el.tagName === "INPUT" || el.tagName === "SELECT") try { el.focus({ preventScroll: true }); } catch { /* egal */ }
    });
    return false as const;
  }, [ereignis, schritt, ruhig]);
  const weg = useCallback((feld?: string) => setFehler((f) => (f && (!feld || f.feld === feld) ? null : f)), []);
  const bei = (feld: string) => (fehler && fehler.feld === feld ? fehler.text : null);
  return { fehler, zeigen, weg, bei };
}

/** Ein Eingabefeld mit Beschriftung und Hinweis. */
export function Feld({ id, label, wert, onWert, fehler, ...rest }: {
  id: string; label: string; wert: string; onWert: (v: string) => void; fehler?: string | null;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "id" | "value" | "onChange">) {
  return (
    <div className="an-feld">
      <label htmlFor={`an-${id}`}>{label}</label>
      <input className={`an-eingabe${fehler ? " an-fehlt" : ""}`} id={`an-${id}`} value={wert} onChange={(e) => onWert(e.target.value)} aria-invalid={!!fehler || undefined} {...rest} />
      {fehler ? <Tipp text={fehler} /> : null}
    </div>
  );
}

// ── Segment-Auswahl mit wandernder Pille ─────────────────────────────────
export function Seg<T extends string>({ name, werte, wahl, onWahl, fehlt, label }: {
  name: string; werte: [T, string][]; wahl: T | ""; onWahl: (v: T) => void; fehlt?: boolean; label?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const pille = useRef<HTMLSpanElement>(null);
  const setzen = useCallback(() => {
    const b = box.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
    const p = pille.current;
    if (!p) return;
    if (!b) { box.current?.classList.remove("an-gewaehlt"); return; }
    box.current?.classList.add("an-gewaehlt");
    p.style.width = `${b.offsetWidth}px`;
    p.style.transform = `translateX(${b.offsetLeft}px)`;
  }, []);
  useLayoutEffect(setzen, [wahl, werte, setzen]);
  useEffect(() => {
    const b = box.current;
    if (!b || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setzen());
    ro.observe(b);
    return () => ro.disconnect();
  }, [setzen]);
  return (
    <div className={`an-seg${wahl ? " an-gewaehlt" : ""}${fehlt ? " an-fehlt" : ""}`} role="radiogroup" aria-label={label} data-feld={name} ref={box}>
      <span className="an-seg-pille" ref={pille} />
      {werte.map(([w, t]) => (
        <button key={w} type="button" role="radio" aria-checked={wahl === w} onClick={() => onWahl(w)}>{t}</button>
      ))}
    </div>
  );
}

export function Haken({ an, onClick, fehlt, children, id }: { an: boolean; onClick: () => void; fehlt?: boolean; children: ReactNode; id?: string }) {
  return (
    <div className={`an-haken${fehlt ? " an-fehlt" : ""}`} role="checkbox" aria-checked={an} tabIndex={0} id={id}
      onClick={(e) => { if ((e.target as HTMLElement).closest("a,button.an-link")) return; onClick(); }}
      onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); onClick(); } }}>
      <span className="an-kasten" />
      <span>{children}</span>
    </div>
  );
}

export function Akk({ titel, offen: anfang = false, children }: { titel: string; offen?: boolean; children: ReactNode }) {
  const [offen, setOffen] = useState(anfang);
  return (
    <div className={`an-akk${offen ? " an-offen" : ""}`}>
      <button type="button" aria-expanded={offen} onClick={() => setOffen(!offen)}>{titel}</button>
      <div className={`an-klapp${offen ? " an-offen" : ""}`}><div>{children}</div></div>
    </div>
  );
}

export const Zeile = ({ a, b }: { a: string; b: ReactNode }) => <div className="an-zeile"><span>{a}</span><span>{b}</span></div>;

/** Feine Linien wie auf einer Urkunde. */
export function Guilloche() {
  const pfade: string[] = [];
  for (let i = 0; i < 24; i++) {
    let d = `M0 ${30 + i * 7}`;
    for (let x = 0; x <= 400; x += 10) d += ` L${x} ${(30 + i * 7 + Math.sin(x / 34 + i * 0.4) * 9 + Math.cos(x / 60 - i * 0.25) * 5).toFixed(1)}`;
    pfade.push(d);
  }
  return (
    <svg className="an-guilloche" viewBox="0 0 400 220" preserveAspectRatio="none" aria-hidden="true">
      <g fill="none" stroke="rgba(40,141,250,.13)" strokeWidth=".7">{pfade.map((d, i) => <path key={i} d={d} />)}</g>
    </svg>
  );
}

/** Das Siegel „Antrag bestätigt" (Stempel-Animation über .an-an). */
export function Siegel({ an }: { an: boolean }) {
  return (
    <svg className={`an-siegel${an ? " an-an" : ""}`} viewBox="0 0 70 70" aria-hidden="true">
      <defs><path id="an-kreisPfad" d="M35,35 m-24,0 a24,24 0 1,1 48,0 a24,24 0 1,1 -48,0" /></defs>
      <circle cx="35" cy="35" r="30" fill="rgba(40,141,250,.06)" stroke="#1D4ED8" strokeWidth="1.4" />
      <circle cx="35" cy="35" r="17" fill="none" stroke="#1D4ED8" strokeWidth=".8" strokeDasharray="1.5 2" />
      <text fontFamily="Inter, sans-serif" fontSize="5.6" letterSpacing="1.1" fill="#1D4ED8" fontWeight="600">
        <textPath href="#an-kreisPfad">FIAON · ANTRAG BESTÄTIGT · FIAON · ANTRAG · </textPath>
      </text>
      <path d="M28.5 35.5l4.5 4.5 9-9.5" fill="none" stroke="#1D4ED8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ein Fehler, der stehen bleibt — mit Weg zum Weitermachen. */
export function Fehlerkasten({ text, knopf, onKnopf }: { text: string; knopf?: string; onKnopf?: () => void }) {
  return (
    <div className="an-fehlerkasten" role="alert">
      {text}
      {knopf && onKnopf ? <> <button type="button" className="an-knopf an-text" style={{ fontSize: "inherit", minHeight: 0 }} onClick={onKnopf}>{knopf}</button></> : null}
    </div>
  );
}
