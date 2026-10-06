// ═══════════════════════════════════════════════════════════════════════════
// DER STERN — EIN ANSPRECHPARTNER STATT ACHT ANLAUFSTELLEN (06.10.2026, E-293)
//
// Vorher beantworteten 172 Wörter (zwei Listen „ohne/mit“, ein langes „Ehrlich
// gesagt“) die Frage „Warum mehr als eine Online-Gründung?“. Jetzt ein Bild:
// „Sie“ links, acht Stellen auf einer Ellipse, in der Mitte Ihr Ansprechpartner.
// Der Schalter zeigt den Unterschied — „Ohne“: acht verschlungene Wege von Ihnen
// zu jeder Stelle; „Mit“: ein Weg zu Ihrem Ansprechpartner, acht Speichen von
// dort. Sechs Stellen tragen den Haken „Im Festpreis enthalten“, Banken und
// Kartenherausgeber nur den offenen Kreis „Antrag vorbereitet — das Institut
// entscheidet“: Die Grafik verspricht nicht mehr als der Vertrag.
//
// Alle Beschriftungen kommen aus i18n/global.ts (Wortwand). Ein Tipp auf eine
// Stelle zeigt den Satz aus GLOBAL_INKLUSIVE (im DOM, nicht gezählt). Ohne JS
// oder bei „weniger Bewegung“ steht „Mit“. Scheibe A: Linien statisch, der
// Wechsel blendet über; das Zeichnen der Speichen kommt mit Scheibe B.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef, useState } from "react";
import type { GlobalSternKnoten } from "@/i18n/global";
import { Begriff, mitBegriffen } from "@/components/site/global/Begriff";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

const C = [400, 230] as const;
const SIE = [40, 230] as const;
// θ = 22,5° + k·45° auf der Ellipse rx 250 / ry 170 — keiner genau links, damit „Sie“ frei steht.
// Reihenfolge im Uhrzeigersinn ab links oben: Gründung → … → Kartenherausgeber.
const ORTE: [number, number][] = [[169, 165], [304, 73], [496, 73], [631, 165], [631, 295], [496, 387], [304, 387], [169, 295]];
const STRICH = ["2 4", "6 3", "1 3", "8 4 2 4", "3 3", "10 5", "1 5", "5 2 1 2"];

/** Ein absichtlich verschlungener Weg von „Sie“ zur Stelle (Zustand „Ohne“). */
function umweg([x, y]: [number, number], i: number): string {
  const c1x = 140 + (i % 4) * 90, c1y = i % 2 ? 460 - y : y - 120;
  const c2x = x + (i % 2 ? -160 : 120), c2y = 460 - y + (i % 3) * 20;
  return `M${SIE[0]} ${SIE[1]} C${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`;
}

function Zeichen({ status }: { status: "fest" | "antrag" }) {
  return status === "fest" ? (
    <svg className="fg-stern-zeichen fest" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <circle cx="8" cy="8" r="7.25" /><path d="M4.8 8.2l2.1 2.1 4.3-4.6" />
    </svg>
  ) : (
    <svg className="fg-stern-zeichen antrag" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" /></svg>
  );
}

export default function GlobalStern({ knoten, ohne, schalter, mitte, sie, legende, label, inklusive, begriffe }: {
  knoten: GlobalSternKnoten[];
  /** Die acht Zeilen des Zustands „Ohne“ (je Knoten eine). */
  ohne: string[];
  schalter: [string, string];
  mitte: string;
  sie: string;
  legende: [string, string];
  label: string;
  /** GLOBAL_INKLUSIVE[sprache] — der Satz je Stelle für den Tooltip. */
  inklusive: readonly string[];
  /** Begriffe, die in Namen und Umfang antippbar werden (Registered Agent, Operating Agreement, US-CPA). */
  begriffe: { wort: string; erklaerung: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEinmalSichtbar(ref);
  const [mit, setMit] = useState(true);
  const erklaerung = (k: GlobalSternKnoten) => {
    const begriff = begriffe.find((b) => b.wort.toLowerCase() === k.name.toLowerCase())?.erklaerung;
    const satz = k.status === "fest" && k.inkl !== undefined ? inklusive[k.inkl] : legende[1];
    return [begriff, satz].filter(Boolean).join(" — ");
  };

  return (
    <div ref={ref} className={`fg-stern ${mit ? "zustand-mit" : "zustand-ohne"}`}>
      <div className="fg-stern-schalter" role="group" aria-label={label}>
        <button type="button" aria-pressed={!mit} onClick={() => setMit(false)}>{schalter[0]}</button>
        <button type="button" aria-pressed={mit} onClick={() => setMit(true)}>{schalter[1]}</button>
      </div>

      {/* ── Desktop: Ellipse mit Beschriftung als HTML darüber ── */}
      <div className="fg-stern-bild d" role="img" aria-label={label}>
        <svg viewBox="0 0 760 460" aria-hidden="true">
          <g className="ebene-ohne">
            {ORTE.map((o, i) => <path key={i} d={umweg(o, i)} style={{ strokeDasharray: STRICH[i] }} />)}
          </g>
          <g className="ebene-mit">
            <path d={`M${SIE[0]} ${SIE[1]} L${C[0] - 34} ${C[1]}`} className="zum-partner" pathLength={1} />
            {ORTE.map(([x, y], i) => <path key={i} d={`M${C[0]} ${C[1]} L${x} ${y}`} className="speiche" pathLength={1} />)}
          </g>
          {ORTE.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" className="knoten" />)}
          <circle cx={SIE[0]} cy={SIE[1]} r="5" className="sie" />
          <circle cx={C[0]} cy={C[1]} r="34" className="mitte" />
          <path d="M392 222 a8 8 0 1 1 16 0 a8 8 0 1 1 -16 0 M386 246 q14 -14 28 0" className="mitte-figur" />
        </svg>
        <span className="fg-stern-sie" style={{ left: `${(SIE[0] / 760) * 100}%`, top: `${(SIE[1] / 460) * 100}%` }}>{sie}</span>
        <span className="fg-stern-mitte" style={{ left: `${(C[0] / 760) * 100}%`, top: `${((C[1] + 44) / 460) * 100}%` }}>{mitte}</span>
        {knoten.map((k, i) => {
          const [x, y] = ORTE[i];
          const rechts = x > C[0];
          return (
            <span key={k.name} className={`fg-stern-label ${rechts ? "rechts" : "links"}`} style={{ left: `${(x / 760) * 100}%`, top: `${(y / 460) * 100}%` }}>
              <span className="mit-text">
                <Zeichen status={k.status} />
                <span className="name"><Begriff wort={k.name} erklaerung={erklaerung(k)} /></span>
                {k.umfang && <span className="umfang">{mitBegriffen(k.umfang, begriffe)}</span>}
              </span>
              <span className="ohne-text">{ohne[i]}</span>
            </span>
          );
        })}
      </div>

      {/* ── Handy: acht Chips, darunter laufen die Wege in Ihren Ansprechpartner zusammen ── */}
      <div className="fg-stern-bild m">
        <span className="fg-stern-sie-m"><i aria-hidden="true" />{sie}</span>
        <ul className="fg-stern-chips">
          {knoten.map((k, i) => (
            <li key={k.name} className={k.status}>
              <span className="mit-text">
                <Zeichen status={k.status} />
                <span className="name"><Begriff wort={k.name} erklaerung={erklaerung(k)} /></span>
                {k.umfang && <span className="umfang">{k.umfang}</span>}
              </span>
              <span className="ohne-text">{ohne[i]}</span>
            </li>
          ))}
        </ul>
        <svg className="fg-stern-trichter" viewBox="0 0 343 120" aria-hidden="true">
          <g className="ebene-ohne">
            {[20, 70, 120, 170, 200, 250, 290, 330].map((x, i) => <path key={i} d={`M${x} 0 C${340 - x} 40 ${x} 70 ${(i * 47) % 343} 118`} style={{ strokeDasharray: STRICH[i] }} />)}
          </g>
          <g className="ebene-mit">
            {[43, 129, 214, 300].map((x) => <path key={x} d={`M${x} 0 C${x} 50 171 50 171 92`} className="speiche" />)}
          </g>
          <circle cx="171" cy="100" r="16" className="mitte" />
        </svg>
        <span className="fg-stern-mitte-m">{mitte}</span>
      </div>

      <ul className="fg-stern-legende">
        <li><Zeichen status="fest" />{legende[0]}</li>
        <li><Zeichen status="antrag" />{legende[1]}</li>
      </ul>
    </div>
  );
}
