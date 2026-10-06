// ═══════════════════════════════════════════════════════════════════════════
// DER WEG AUF DEN UNTERSEITEN — BAUSTEIN „etappen“ (06.10.2026, E-293, Scheibe D)
//
// Bauplan Kapitel 5, Punkt 4: Die 17 Etappen-Bausteine waren eine nummerierte
// Liste. Jetzt sprechen sie dieselbe Sprache wie die Wegleiste über den
// Pakettafeln auf /business (components/site/global/WegLinie.tsx): eine
// Haarlinie, die in Stufen steigt, Knoten mit römischer Ziffer — aber Titel,
// Dauer UND Text stehen sichtbar unter jeder Station (die Wegleiste auf
// /business versteckt den Text im Popover; hier ist er Inhalt der Seite und
// steht im Korpus für Suchmaschinen, blockAlsText in shared/fiaon-global-seiten).
//
// Warum eine eigene Komponente und nicht WegLinie: WegLinie kennt genau vier
// feste Etappen (I–IV des Pakets) mit festen Punkten; die Unterseiten haben
// drei bis zehn Stationen mit bis zu 65 Wörtern Text. Bis vier Stationen (und
// genug Breite) steht der Weg quer, sonst — und immer am Handy — als
// senkrechter Faden. Die Breite misst eine Container-Abfrage, nicht der
// Bildschirm: Der Text-Spalte ist es egal, wie breit das Fenster ist.
//
// Bewegung: einmal beim Hineinscrollen (useEinmalSichtbar → data-an="1"), nur
// clip-path (die quer liegende Linie, wie die Wegleiste — Safari) und transform;
// der Text der Stationen bleibt immer voll sichtbar (Korpus). „Weniger
// Bewegung“ zeigt sofort den Endzustand (styles/global-seiten.css).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

const ROEMISCH = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
/** Stufenhöhe der steigenden Linie in px (quer). */
const STUFE = 14;

export interface SeitenEtappe { titel: string; dauer?: string; text: string }

export default function SeitenWeg({ etappen }: { etappen: SeitenEtappe[] }) {
  const ref = useRef<HTMLDivElement>(null);
  // Schwelle 0 mit Rand: Ein langer Faden (zehn Stationen) ist am Handy höher als der Bildschirm (bewegung.ts).
  useEinmalSichtbar(ref, 0, "0px 0px -15% 0px");
  const n = etappen.length;
  const quer = n >= 2 && n <= 4;
  // Quer: Knoten i sitzt am linken Rand seiner Spalte (x = i/n), Höhe steigt nach rechts — die Linie läuft in Stufen
  // von Knoten zu Knoten und klingt in der letzten Spalte aus. viewBox-Höhe = Pixelhöhe, gedehnt wird nur die Breite.
  const hoehe = 26 + (n - 1) * STUFE;
  const y = (i: number) => 13 + (n - 1 - i) * STUFE;
  const x = (i: number) => (i / n) * 1000;
  let d = `M${x(0)} ${y(0)}`;
  for (let i = 1; i < n; i++) d += ` L${x(i)} ${y(i - 1)} L${x(i)} ${y(i)}`;
  d += ` L${x(n - 1) + 1000 / n / 2} ${y(n - 1)}`;

  return (
    <div ref={ref} className="fd-weg" style={{ "--n": n, "--fd-weg-h": `${hoehe}px` } as React.CSSProperties}>
      <div className={`fd-weg-buehne${quer ? " quer" : ""}`}>
        {quer && (
          <svg className="fd-weg-linie" viewBox={`0 0 1000 ${hoehe}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d={d} />
          </svg>
        )}
        <ol>
          {etappen.map((e, i) => (
            <li key={e.titel} className="fd-weg-station" style={{ "--i": i } as React.CSSProperties}>
              <span className="fd-weg-kopf" aria-hidden="true"><span className="fd-weg-knoten">{ROEMISCH[i] ?? String(i + 1)}</span></span>
              <div className="fd-weg-inhalt">
                <h3>{e.titel}</h3>
                {e.dauer && <span className="dauer">{e.dauer}</span>}
                <p>{e.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
