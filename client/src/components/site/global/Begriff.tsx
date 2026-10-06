// ═══════════════════════════════════════════════════════════════════════════
// BEGRIFFE ZUM ANTIPPEN (06.10.2026, E-293)
//
// Die Bestandsaufnahme vom 06.10. fand auf /business kein einziges <abbr>, keinen
// Tooltip — EIN und ITIN standen ohne Hilfe schon im ersten Bild. Ein Begriff
// ist jetzt ein Knopf mit gepunkteter Unterstreichung: Fokus, Tipp oder (mit
// Maus) Darüberfahren öffnet die Erklärung, Esc oder ein Klick daneben schließt
// sie. Die Erklärungen stehen in i18n/global.ts (`begriffe`), damit die
// Wortwand sie liest; sie zählen nicht zu den sichtbaren Wörtern der Seite.
// ═══════════════════════════════════════════════════════════════════════════
import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export function Begriff({ wort, erklaerung }: { wort: string; erklaerung: string }) {
  const id = useId();
  const [auf, setAuf] = useState(false);
  const rahmen = useRef<HTMLSpanElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  // Ein Tipp löst erst Fokus, dann Klick aus — der Fokus soll dann nicht schon öffnen, sonst schließt der Klick gleich wieder.
  const perZeiger = useRef(false);

  useEffect(() => {
    if (!auf) return;
    const weg = (e: PointerEvent) => { if (!rahmen.current?.contains(e.target as Node)) setAuf(false); };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setAuf(false); };
    document.addEventListener("pointerdown", weg);
    document.addEventListener("keydown", taste);
    return () => { document.removeEventListener("pointerdown", weg); document.removeEventListener("keydown", taste); };
  }, [auf]);

  // Die Erklärung bleibt im Bildschirm: am rechten Rand rückt sie nach links (kein seitliches Scrollen am Handy).
  useLayoutEffect(() => {
    const p = pop.current; if (!auf || !p) return;
    p.style.setProperty("--fg-begriff-x", "0px");
    const r = p.getBoundingClientRect();
    const rechts = window.innerWidth - 16;
    let x = 0;
    if (r.right > rechts) x = rechts - r.right;
    if (r.left + x < 16) x = 16 - r.left;
    p.style.setProperty("--fg-begriff-x", `${Math.round(x)}px`);
  }, [auf]);

  const fein = () => typeof window !== "undefined" && !!window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  return (
    <span className="fg-begriff-rahmen" ref={rahmen} onMouseEnter={() => fein() && setAuf(true)} onMouseLeave={() => fein() && setAuf(false)}>
      <button type="button" className="fg-begriff" aria-describedby={id} aria-expanded={auf}
        onPointerDown={() => { perZeiger.current = true; }}
        onFocus={() => { if (!perZeiger.current) setAuf(true); }}
        onBlur={() => { perZeiger.current = false; setAuf(false); }}
        onClick={() => { perZeiger.current = false; setAuf((a) => !a); }}>
        {wort}
      </button>
      <span ref={pop} id={id} role="tooltip" className={`fg-begriff-pop${auf ? " auf" : ""}`}>{erklaerung}</span>
    </span>
  );
}

/**
 * Macht in einem Satz die genannten Begriffe antippbar — jeweils das erste Vorkommen, Groß-/Kleinschreibung
 * egal, nur als ganzes Wort (davor kein Buchstabe, „US-Herausgeber“ zählt). Ohne Treffer bleibt der Satz Text.
 */
export function mitBegriffen(text: string, begriffe: { wort: string; erklaerung: string }[]): ReactNode {
  type Treffer = { von: number; bis: number; wort: string; erklaerung: string };
  const treffer: Treffer[] = [];
  for (const b of begriffe) {
    if (!b.wort) continue;
    const re = new RegExp(`(^|[^A-Za-zÄÖÜäöüß])(${b.wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?![A-Za-zÄÖÜäöüß])`, "i");
    const m = re.exec(text);
    if (!m) continue;
    const von = m.index + m[1].length;
    const bis = von + m[2].length;
    if (treffer.some((x) => von < x.bis && bis > x.von)) continue;
    treffer.push({ von, bis, wort: text.slice(von, bis), erklaerung: b.erklaerung });
  }
  if (!treffer.length) return text;
  treffer.sort((a, b) => a.von - b.von);
  const teile: ReactNode[] = [];
  let pos = 0;
  treffer.forEach((x, i) => {
    if (x.von > pos) teile.push(<Fragment key={`t${i}`}>{text.slice(pos, x.von)}</Fragment>);
    teile.push(<Begriff key={`b${i}`} wort={x.wort} erklaerung={x.erklaerung} />);
    pos = x.bis;
  });
  if (pos < text.length) teile.push(<Fragment key="ende">{text.slice(pos)}</Fragment>);
  return <>{teile}</>;
}
