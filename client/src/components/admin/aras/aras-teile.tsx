// ═══════════════════════════════════════════════════════════════════════════
// ARAS-COCKPIT — kleine Bausteine (20.10.2026): Karte, Punkt, Tageswahl, Segment, Gesprächsverlauf als Sprechblasen,
// Knopf mit Rückfrage (ohne Browser-Dialog), Zeichen als eigenes SVG (AGENTS.md: keine Icon-Bibliothek, 1,5 px Strich).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ARAS_SPIELARTEN, type ArasSpielart } from "@shared/fiaon-ki-team";
import { istGesperrteSpielart } from "@shared/fiaon-aras";
import { berlinHeute, spielartText, tagName, tagPlus } from "./aras-texte";

/** Gesprächsarten, die man von Hand einreihen kann (der Server prüft dieselbe Liste; Probe/Eingehend nie). */
// „auftrag“ kommt nur aus der Akte (mit dem Text des Betreuers) — nie über das Einreihen im Cockpit. Zuruf, Lead, Stufe B und
// Rückholung sind gesperrt (Justin 20.10.2026: nur Vertragskunden) — sie stehen gar nicht erst zur Wahl.
export const EINREIH_ARTEN: readonly ArasSpielart[] = ARAS_SPIELARTEN.filter((s) => s !== "probe" && s !== "eingehend" && s !== "auftrag" && !istGesperrteSpielart(s));

export function SpielartWahl({ wert, onChange, arten = EINREIH_ARTEN, alle }: { wert: string; onChange: (s: string) => void; arten?: readonly string[]; alle?: string }) {
  return (
    <select className="ar-wahl" value={wert} onChange={(e) => onChange(e.target.value)} aria-label="Gesprächsart">
      {alle ? <option value="">{alle}</option> : null}
      {arten.map((s) => <option key={s} value={s}>{spielartText(s)}</option>)}
    </select>
  );
}

/** Eine matte Karte mit Überschrift, EINEM Satz und Platz rechts (z. B. ein Knopf). */
export function Karte({ titel, satz, rechts, children, data, klasse = "" }: { titel?: ReactNode; satz?: ReactNode; rechts?: ReactNode; children?: ReactNode; data?: string; klasse?: string }) {
  return (
    <section className={`ar-karte ${klasse}`.trim()} data-ap={data}>
      {titel || rechts ? (
        <header className="ar-karte-kopf">
          <div className="ar-karte-titel">{titel ? <h2>{titel}</h2> : null}{satz ? <p>{satz}</p> : null}</div>
          {rechts ? <div className="ar-karte-rechts">{rechts}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

/** Ampel-Punkt — Farbe nur als kleiner Punkt (Justin 13.10.: keine bunten Flächen). */
export function Punkt({ klasse = "", puls = false, titel }: { klasse?: string; puls?: boolean; titel?: string }) {
  return <span className={`ar-punkt ${klasse}${puls ? " puls" : ""}`.trim()} aria-hidden={titel ? undefined : true} title={titel} />;
}

/** Leerzustand: ein Satz, ruhig. */
export function Leer({ titel, children }: { titel: string; children?: ReactNode }) {
  return <div className="ar-leer" role="status"><b>{titel}</b>{children ? <span>{children}</span> : null}</div>;
}

/** Ein Segment-Schalter (Filter, Ton). `anzahl` erscheint als leise Zahl. */
export function Segment<T extends string>({ werte, wert, onWahl, label, busy, klein = false }: { werte: readonly { w: T; t: string; anzahl?: number; titel?: string }[]; wert: T; onWahl: (w: T) => void; label: string; busy?: boolean; klein?: boolean }) {
  return (
    <div className={`ar-segment${klein ? " klein" : ""}`} role="radiogroup" aria-label={label}>
      {werte.map((o) => (
        <button key={o.w} type="button" role="radio" aria-checked={wert === o.w} className={wert === o.w ? "an" : ""} disabled={busy} title={o.titel} onClick={() => wert !== o.w && onWahl(o.w)}>
          {o.t}{o.anzahl != null ? <span className="ar-anzahl">{o.anzahl}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Tageswahl: ‹ Kalender › und „Heute“ — statt eines Textfelds „JJJJ-MM-TT“. Zukunft nur, wenn `zukunft`. */
export function TagWahl({ tag, onTag, zukunft = false, label = "Tag" }: { tag: string; onTag: (t: string) => void; zukunft?: boolean; label?: string }) {
  const heute = berlinHeute();
  const max = zukunft ? undefined : heute;
  const vor = tagPlus(tag, 1);
  return (
    <div className="ar-tagwahl" role="group" aria-label={label}>
      <button type="button" className="ar-rund" aria-label="Einen Tag zurück" title="Einen Tag zurück" onClick={() => onTag(tagPlus(tag, -1))}><Zeichen art="links" /></button>
      <label className="ar-tag" title="Tag wählen">
        <span className="ar-tag-name">{tagName(tag, heute)}</span>
        <input type="date" value={tag} max={max} aria-label={label} onChange={(e) => { const v = e.target.value; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) onTag(max && v > max ? max : v); }} />
      </label>
      <button type="button" className="ar-rund" aria-label="Einen Tag vor" title="Einen Tag vor" disabled={!zukunft && vor > heute} onClick={() => onTag(vor)}><Zeichen art="rechts" /></button>
      {tag !== heute ? <button type="button" className="ar-knopf-text" onClick={() => onTag(heute)}>Heute</button> : null}
    </div>
  );
}

/** Der Gesprächsverlauf als Sprechblasen: Aras links, Kunde (beim Probeanruf: du) rechts. */
export function Verlauf({ zeilen, probe = false, kompakt = false }: { zeilen: readonly { wer: string; text: string }[]; probe?: boolean; kompakt?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Im Live-Kasten rückt der neueste Satz ins Bild — nur im Kasten, die Seite selbst rollt nicht mit.
    if (kompakt && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [zeilen.length, kompakt]);
  return (
    <div ref={ref} className={`ar-verlauf${kompakt ? " kompakt" : ""}`}>
      {zeilen.map((z, i) => (
        <div key={i} className={`ar-blase ${z.wer === "kunde" ? "kunde" : "aras"}`}>
          <small>{z.wer === "kunde" ? (probe ? "Du" : "Kunde") : "Aras"}</small>
          <p>{z.text}</p>
        </div>
      ))}
    </div>
  );
}

/**
 * Ein Knopf, der erst nachfragt — ohne Browser-Dialog: erster Klick zeigt „Frage? Ja · Nein“ (8 s), „Ja“ führt aus.
 * Für Not-Aus, „Wieder an“, Entfernen, Auflegen bei Kunden.
 */
export function FrageKnopf({ children, frage, ja = "Ja", onJa, klasse = "", disabled, titel, data }: { children: ReactNode; frage: string; ja?: string; onJa: () => void; klasse?: string; disabled?: boolean; titel?: string; data?: string }) {
  const [offen, setOffen] = useState(false);
  useEffect(() => { if (!offen) return; const t = window.setTimeout(() => setOffen(false), 8000); return () => window.clearTimeout(t); }, [offen]);
  if (offen) {
    return (
      <span className="ar-frage" role="group" aria-label={frage}>
        <span>{frage}</span>
        <button type="button" className={`ar-knopf klein ${klasse}`.trim()} onClick={() => { setOffen(false); onJa(); }} data-ar={data ? `${data}-ja` : undefined}>{ja}</button>
        <button type="button" className="ar-knopf klein still" onClick={() => setOffen(false)}>Nein</button>
      </span>
    );
  }
  return <button type="button" className={`ar-knopf klein ${klasse}`.trim()} disabled={disabled} title={titel} onClick={() => setOffen(true)} data-ar={data}>{children}</button>;
}

/** Zeichen (selbst gezeichnet, 1,5 px, currentColor). */
export function Zeichen({ art, groesse = 16 }: { art: "links" | "rechts" | "unten" | "neu" | "hoch" | "runter" | "telefon"; groesse?: number }) {
  const p = { width: groesse, height: groesse, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (art) {
    case "links": return <svg {...p}><path d="M15 6l-6 6 6 6" /></svg>;
    case "rechts": return <svg {...p}><path d="M9 6l6 6-6 6" /></svg>;
    case "unten": return <svg {...p}><path d="M6 9l6 6 6-6" /></svg>;
    case "neu": return <svg {...p}><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 5v6h-6" /></svg>;
    case "hoch": return <svg {...p}><path d="M7 11v9H4v-9h3z" /><path d="M7 11l4-7c1.5 0 2.5 1 2.5 2.5V10h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.3 20H7" /></svg>;
    case "runter": return <svg {...p}><path d="M7 13V4H4v9h3z" /><path d="M7 13l4 7c1.5 0 2.5-1 2.5-2.5V14h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 17.3 4H7" /></svg>;
    case "telefon": return <svg {...p}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /></svg>;
    default: return null;
  }
}

/** Eine Rückmeldung am Auslöser (verschwindet nach ein paar Sekunden; Fehler bleiben länger). */
export function useHinweis(): { h: { text: string; rot: boolean } | null; gut: (t: string) => void; rot: (t: string) => void; weg: () => void } {
  const [h, setH] = useState<{ text: string; rot: boolean } | null>(null);
  useEffect(() => { if (!h) return; const t = window.setTimeout(() => setH(null), h.rot ? 9000 : 4500); return () => window.clearTimeout(t); }, [h]);
  return { h, gut: (text) => setH({ text, rot: false }), rot: (text) => setH({ text, rot: true }), weg: () => setH(null) };
}
export function Hinweis({ h, onWeg }: { h: { text: string; rot: boolean } | null; onWeg?: () => void }) {
  if (!h) return null;
  return <p className={`ar-hinweis${h.rot ? " rot" : ""}`} role={h.rot ? "alert" : "status"} onClick={onWeg}>{h.text}</p>;
}
