// ═══════════════════════════════════════════════════════════════════════════
// DIE PRESSE-BÜHNE — „Zitiert in Die Presse“ groß und edel (17.11.2026)
//
// Justin (17.11.): „Auch dass wir bei der Presse waren, kommt hier gar nicht zur Geltung.“ Bis heute stand die Nennung nur
// als eine kleine Zeile im Vertrauens-Band. Jetzt bekommt sie eine eigene Glasfläche direkt unter der Bühne:
//   · links: die Presse-Zeile GROSS als Überschrift — genau im festen Wortlaut (PRESSE_ZEILE, mit Link, je Seite einmal;
//     das Datum in der Klammer leiser gesetzt), ein Satz, worum es bei uns ging (sinngemäß, kein Zitat: Justin Schwarzott
//     „von der Londoner Unternehmensberatung Fiaon“ ordnet ein, ab welchem US-Umsatz sich eine eigene US-Gesellschaft
//     rechnet — Notiz fiaon-presse-artikel), ein Knopf „Artikel lesen“.
//   · rechts: ein Zeitungsblatt aus Glas — Spalten aus Linien, die sich einmal zeichnen, und EINE Zeile, die in Glasblau
//     aufleuchtet (die Stelle, an der FIAON steht). Rein dekorativ (aria-hidden), keine Kopie der echten Seite.
// Regeln (Notiz fiaon-presse-artikel, Sprachleitfaden 6.3): kein Logo und kein Schriftzug der Zeitung (auch nicht auf dem
// Glasblatt), kein „bekannt aus“, kein Zitat aus dem Artikel. Bewegung genau einmal beim Hineinscrollen (useEinmalSichtbar); bei „weniger Bewegung“ steht alles.
// Stil: styles/global-presse.css (Präfix gpr-).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { presseZeile, type SatzSprache } from "@shared/fiaon-global-saetze";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import "@/styles/global-tokens.css";
import "@/styles/global-presse.css";

const WORT = {
  de: {
    satz: "Justin Schwarzott von der Londoner Unternehmensberatung FIAON ordnet ein, ab welchem US-Umsatz sich eine eigene Gesellschaft in den USA rechnet — und was Exporteure bei Zöllen beachten sollten.",
    lesen: "Artikel lesen",
    fenster: "öffnet den Artikel in einem neuen Fenster",
  },
  en: {
    satz: "Justin Schwarzott of the London consultancy FIAON explains from what level of US revenue a company of your own in the United States pays off — and what exporters should watch for with tariffs.",
    lesen: "Read the article (in German)",
    fenster: "opens the article in a new window",
  },
} as const;

function Pfeil() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

/** Das Glas-Zeitungsblatt: Kopfzeile, Schlagzeile, drei Spalten aus Linien, eine leuchtende Zeile. */
function Blatt() {
  // Feste Längen je Zeile (in %), damit das Blatt wie gesetzt aussieht und bei jedem Laden gleich bleibt.
  const spalten = [
    [92, 100, 96, 88, 100, 74, 0, 98, 94, 100, 82, 100, 91, 0, 97, 100, 86, 64],
    [100, 90, 97, 100, 86, 0, 100, 93, 100, 96, 61, 0, 100, 94, 88, 100, 97, 72],
    [96, 100, 89, 100, 94, 100, 0, 91, 100, -1, 88, 100, 70, 0, 100, 92, 96, 58],
  ];
  return (
    <div className="gpr-blatt" aria-hidden="true">
      <div className="gpr-blatt-kopf"><i className="gpr-blatt-name" /><span className="gpr-blatt-datum">02.11.2026</span></div>
      <div className="gpr-blatt-linie" />
      <div className="gpr-blatt-titel"><i style={{ width: "94%" }} /><i style={{ width: "71%" }} /></div>
      <div className="gpr-blatt-spalten">
        {spalten.map((zeilen, s) => (
          <div key={s} className="gpr-blatt-spalte">
            {zeilen.map((w, z) => (w === 0
              ? <span key={z} className="gpr-blatt-luft" />
              // -1: die Stelle mit FIAON — sie leuchtet einmal in Glasblau auf und bleibt markiert.
              : w === -1 ? <span key={z} className="gpr-blatt-marke"><span>FIAON</span></span>
                : <i key={z} style={{ width: `${w}%`, ["--z" as string]: String(s * 18 + z) }} />))}
          </div>
        ))}
      </div>
      <span className="gpr-blatt-glanz" />
    </div>
  );
}

export default function GlobalPresse({ sprache }: { sprache: SatzSprache }) {
  const ref = useRef<HTMLElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -18% 0px");
  const w = WORT[sprache === "en" ? "en" : "de"];
  const zeile = presseZeile(sprache);
  const klammer = zeile.text.indexOf("(");
  return (
    <section ref={ref} className="fg-sek gpr-sek" aria-labelledby="gpr-titel">
      <div className="fg-rahmen">
        <div className="gpr">
          <div className="gpr-text">
            <span className="gpr-auge" aria-hidden="true"><span className="gpr-punkt" />{sprache === "en" ? "Press" : "Presse"}</span>
            {/* Die Presse-Zeile genau im festen Wortlaut (PRESSE_ZEILE) und mit ihrem Link — groß gesetzt, das Datum leiser. */}
            <h2 className="gpr-name" id="gpr-titel">
              <a href={zeile.adresse} target="_blank" rel="noopener noreferrer" aria-label={`${zeile.text} — ${w.fenster}`}>
                {klammer >= 0 ? <>{zeile.text.slice(0, klammer).trimEnd()} <span className="gpr-datum">{zeile.text.slice(klammer)}</span></> : zeile.text}
              </a>
            </h2>
            <p className="gpr-satz">{w.satz}</p>
            <div className="gpr-fuss">
              <a className="gpr-knopf" href={zeile.adresse} target="_blank" rel="noopener noreferrer" aria-label={`${w.lesen} — ${w.fenster}`}>{w.lesen}<Pfeil /></a>
            </div>
          </div>
          <div className="gpr-bild"><Blatt /></div>
        </div>
      </div>
    </section>
  );
}
