// ═══════════════════════════════════════════════════════════════════════════
// DAS SIEGEL DER SONDERFREIGABE (E-301) — reines SVG, Navy und Gold
//
// Rundes Siegel mit Prägungs-Optik: goldener Rand, Perlenring, umlaufender Text
// (Titel der Sonderfreigabe · Geschäftsleitung · FIAON Global — „Geschäfts-
// leitung“ nur, wenn der Vermerk sie nennt), innen das F der Marke und das
// Datum. Daneben (Variante „voll“) Vermerk, Unterzeichner, Funktion und eine
// Unterschrift in Schreibschrift-Optik (Webfont, keine Bilddatei), die sich beim
// Hineinscrollen einmal von links nach rechts „schreibt“. Variante „klein“ für
// die Prüfbericht-Bühne: nur das Siegel. Alle Texte aus kapital.sonderfreigabe.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId } from "react";
import type { FirmaSonderfreigabe } from "@shared/fiaon-global-angebot-firma-typen";
import { MARKE_BOX, MARKE_NAME, MARKE_PFAD } from "@shared/fiaon-marke";
import { tagDe, useEinmalDa } from "./gemeinsam";

const SCHRIFT_HREF = "https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=swap";

/** Die Schreibschrift für die Unterschrift einmal nachladen (Google Fonts, wie Inter/Newsreader in index.html). */
function useSchreibschrift() {
  useEffect(() => {
    if (document.querySelector(`link[href="${SCHRIFT_HREF}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = SCHRIFT_HREF;
    document.head.appendChild(l);
  }, []);
}

export function SiegelGrafik({ sf, groesse = 188 }: { sf: FirmaSonderfreigabe; groesse?: number }) {
  const id = useId().replace(/:/g, "");
  // Fester Ring (Bauauftrag): „Sonderfreigabe · Geschäftsleitung · FIAON Global“ — nicht aus dem Titel abgeleitet, sonst doppelt.
  const ring = `${["Sonderfreigabe", "Geschäftsleitung", MARKE_NAME.global].join("  ·  ")}  ·  `;
  // Unter 150 px wäre der Ringtext etwa 6 px hoch und unlesbar — dann eine Punktreihe, innen F und Datum.
  const klein = groesse < 150;
  const f = MARKE_BOX.f;
  // Das F mittig: 34 Einheiten hoch.
  const fH = 34, fS = fH / f.h, fB = f.b * fS;
  return (
    <svg className="gaf-siegel-svg" viewBox="0 0 200 200" width={groesse} height={groesse} role="img" aria-label={`${sf.titel} · ${tagDe(sf.datum)}`}>
      <defs>
        <radialGradient id={`n-${id}`} cx="42%" cy="36%" r="70%"><stop offset="0" stopColor="#24467a" /><stop offset=".55" stopColor="#12284a" /><stop offset="1" stopColor="#081428" /></radialGradient>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e9c4" /><stop offset=".3" stopColor="#d9b45a" /><stop offset=".62" stopColor="#a87a26" /><stop offset="1" stopColor="#ecd394" /></linearGradient>
        <linearGradient id={`s-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28" /><stop offset=".45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity=".28" /></linearGradient>
        <path id={`r-${id}`} d="M100 100 m-73 0 a73 73 0 1 1 146 0 a73 73 0 1 1 -146 0" />
      </defs>
      {/* Rand mit feiner Zähnung (Prägestempel) */}
      <circle cx="100" cy="100" r="97" fill={`url(#g-${id})`} />
      <circle cx="100" cy="100" r="97" fill="none" stroke="#7a5716" strokeOpacity=".5" strokeWidth="1.2" strokeDasharray="1.1 2.1" />
      <circle cx="100" cy="100" r="91" fill={`url(#n-${id})`} />
      <circle cx="100" cy="100" r="88.5" fill="none" stroke={`url(#g-${id})`} strokeWidth=".8" />
      <circle cx="100" cy="100" r="60" fill="none" stroke={`url(#g-${id})`} strokeWidth=".8" />
      <circle cx="100" cy="100" r="56.5" fill="none" stroke={`url(#g-${id})`} strokeWidth="1.6" strokeLinecap="round" strokeDasharray=".1 4.2" />
      {klein
        ? <circle cx="100" cy="100" r="73" fill="none" stroke={`url(#g-${id})`} strokeWidth="2.4" strokeLinecap="round" strokeDasharray=".1 9" />
        : (
          <g className="gaf-siegel-ring">
            <text className="gaf-siegel-ringtext" fill={`url(#g-${id})`}>
              <textPath href={`#r-${id}`} textLength={Math.round(2 * Math.PI * 73) - 4} lengthAdjust="spacing">{ring.toUpperCase()}</textPath>
            </text>
          </g>
        )}
      <g transform={`translate(${100 - fB / 2} ${100 - fH / 2 - 8}) scale(${fS}) translate(${-f.x} ${-f.y})`}>
        <path d={MARKE_PFAD.f} fill={`url(#g-${id})`} />
      </g>
      <text x="100" y="128" textAnchor="middle" className="gaf-siegel-datum" fill="#ecd394">{tagDe(sf.datum)}</text>
      {/* Prägung: Licht oben, Schatten unten */}
      <circle cx="100" cy="100" r="97" fill={`url(#s-${id})`} pointerEvents="none" />
      <circle className="gaf-siegel-glanz" cx="100" cy="100" r="91" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1" strokeDasharray="40 532" />
    </svg>
  );
}

export default function SonderfreigabeSiegel({ sf, variante = "voll" }: { sf: FirmaSonderfreigabe; variante?: "voll" | "klein" }) {
  useSchreibschrift();
  const ref = useEinmalDa<HTMLDivElement>();
  if (variante === "klein") return <div ref={ref} className="gaf-siegel klein"><SiegelGrafik sf={sf} groesse={112} /></div>;
  return (
    <div ref={ref} className="gaf-siegel voll" data-fiaon="firma-siegel">
      <div className="gaf-siegel-buehne"><SiegelGrafik sf={sf} /></div>
      <div className="gaf-siegel-text">
        <p className="gaf-auge gaf-auge-gold">{sf.titel}</p>
        <p className="gaf-siegel-vermerk">{sf.text}</p>
        <div className="gaf-unterschrift">
          <span className="gaf-unterschrift-zug" aria-hidden="true">{sf.unterzeichner}</span>
          <span className="gaf-unterschrift-linie" aria-hidden="true" />
          <span className="gaf-unterschrift-name">{sf.unterzeichner}</span>
          <span className="gaf-unterschrift-funktion">{sf.funktion}</span>
          <span className="gaf-unterschrift-datum">{tagDe(sf.datum)}</span>
        </div>
      </div>
    </div>
  );
}
