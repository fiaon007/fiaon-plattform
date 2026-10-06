// ═══════════════════════════════════════════════════════════════════════════
// DER BELEG „IM FESTPREIS“ (06.10.2026, E-293)
//
// Vorher: „Alles inklusive“ als Kasten mit acht langen Vertragssätzen und dem
// Satz zu den laufenden Kosten (≈ 100 Wörter). Gutachten 2 verbietet „Alles
// inklusive“ ohne Einschränkung (§ 5a UWG: ab dem zweiten Jahr fallen Kosten
// an). Jetzt ein Papierstreifen wie ein Kassenbeleg: acht kurze Zeilen mit
// Haken, Doppellinie, Summenzeile „Ihr Festpreis · einmalig“ — und darunter
// die Klappe „Wortlaut wie im Vertrag“ mit GLOBAL_INKLUSIVE und GLOBAL_LAUFEND
// wortgleich (im DOM, Vertrag und Seite sagen dasselbe).
//
// Die Klasse `fg-inkl` hängt business.tsx an (der Prüfstand hält die Reihenfolge
// Paketfuß → Europa-Satz → fg-inkl im Quelltext fest, pruef-global-seiten.ts).
// Bewegung (Scheibe B): Der Streifen „kommt aus dem Schlitz“ (clip-path).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

function Haken() {
  return (
    <svg className="fg-beleg-haken" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.8 8.4l2.6 2.6 5.8-6.2" pathLength={1} />
    </svg>
  );
}

export default function GlobalBeleg({ className = "", auge, titel, zeilen, summe, preis, klappe, vertrag, laufend }: {
  className?: string;
  auge: string;
  titel: string;
  zeilen: string[];
  summe: string;
  /** „ab 2.499 €“ — der Einstiegspreis aus dem Katalog. */
  preis: string;
  klappe: string;
  /** GLOBAL_INKLUSIVE[sprache] — wortgleich mit dem Vertrag. */
  vertrag: readonly string[];
  /** GLOBAL_LAUFEND[sprache]. */
  laufend: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEinmalSichtbar(ref, 0.25);
  return (
    <div ref={ref} className={`fg-beleg-rahmen ${className}`}>
      <div className="fg-beleg-kopf">
        <span className="fg-auge">{auge}</span>
        <h3>{titel}</h3>
      </div>
      <div className="fg-beleg-spalte">
        <span className="fg-beleg-schlitz" aria-hidden="true" />
        <div className="fg-beleg">
          <ul>
            {zeilen.map((z, i) => <li key={z} style={{ "--i": i } as React.CSSProperties}><Haken />{z}</li>)}
          </ul>
          <div className="fg-beleg-summe"><span>{summe}</span><b>{preis}</b></div>
        </div>
        <details className="fg-beleg-klappe">
          <summary>{klappe}</summary>
          <ul>{vertrag.map((x) => <li key={x}>{x}</li>)}</ul>
          <p>{laufend}</p>
        </details>
      </div>
    </div>
  );
}
