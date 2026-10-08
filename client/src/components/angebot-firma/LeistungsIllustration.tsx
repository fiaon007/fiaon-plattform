// ═══════════════════════════════════════════════════════════════════════════
// „WAS SIE BEKOMMEN“ — JE KARTE EINE EIGENE LINIEN-ILLUSTRATION (E-301, Runde 2)
//
// Justin (08.10.2026, Punkt 5): Fotos raus, alle sechs Karten einheitlich mit
// einer kleinen, eigenen, thematisch passenden Linien-Illustration — 1,5 px,
// Gold-Akzent, beim Hover leicht bewegt, nicht überladen:
//   gesellschaft  Gebäude, Flagge, Dokument
//   kapital       Münzstapel und steigende Linie
//   strategie     Pfad zur Zielmarke
//   plattform     Browserfenster mit Signal
//   vertrieb      Weltkugel mit Routen
//   ansprechpartner  Person und Sprechblase
// currentColor = Navy, Gold über die Klasse „g“. Die Bewegung beim Hover steht im
// CSS (.gaf-leistung:hover .gaf-il-…), bei „weniger Bewegung“ ist sie aus.
// ═══════════════════════════════════════════════════════════════════════════
import type { FirmaLeistung } from "@shared/fiaon-global-angebot-firma-typen";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Inhalt({ art }: { art: FirmaLeistung["schluessel"] }) {
  switch (art) {
    case "gesellschaft":
      return <>
        <path {...S} d="M22 74h76" opacity=".35" />
        <g className="il-haus">
          <path {...S} d="M30 74V40l24-12 24 12v34" />
          <path {...S} d="M38 74V46M48 74V46M60 74V46M70 74V46" opacity=".55" />
          <path {...S} d="M30 40h48" />
        </g>
        <g className="il-flagge">
          <path {...S} d="M54 28V12" />
          <path {...S} className="g" d="M54 12c4-2 8 2 12 0v8c-4 2-8-2-12 0" />
        </g>
        <g className="il-blatt">
          <path {...S} d="M84 44h16l6 6v24H84z" fill="#fff" />
          <path {...S} className="g" d="M89 56h12M89 62h12M89 68h7" />
        </g>
      </>;
    case "kapital":
      return <>
        <path {...S} d="M18 76h84" opacity=".35" />
        {/* Münzstapel: nur die vorderen Kanten jeder Münze, oben eine ganze Fläche */}
        <g className="il-stapel">
          <path {...S} d="M22 52v16a16 5 0 0 0 32 0V52" />
          <path {...S} d="M22 60a16 5 0 0 0 32 0" opacity=".7" />
          <ellipse {...S} cx="38" cy="52" rx="16" ry="5" fill="#fff" />
        </g>
        <g className="il-muenze"><ellipse {...S} className="g" cx="38" cy="42" rx="16" ry="5" /></g>
        <g className="il-linie">
          <path {...S} className="g" d="M62 66l10-10 8 6 16-20" />
          <path {...S} className="g" d="M88 42h8v8" />
        </g>
      </>;
    case "strategie":
      return <>
        <path {...S} className="il-pfad" d="M16 70c14 0 14-22 30-22s14 18 30 12 10-24 22-30" strokeDasharray="3 5" opacity=".7" />
        <circle cx="16" cy="70" r="3" fill="currentColor" />
        <g className="il-ziel">
          <circle {...S} cx="98" cy="28" r="12" />
          <circle {...S} className="g" cx="98" cy="28" r="6.5" />
          <circle cx="98" cy="28" r="2" fill="#b8892e" />
        </g>
      </>;
    case "plattform":
      return <>
        <g className="il-fenster">
          <rect {...S} x="18" y="22" width="66" height="48" rx="6" fill="#fff" />
          <path {...S} d="M18 32h66" opacity=".45" />
          <circle cx="25" cy="27" r="1.4" fill="currentColor" /><circle cx="30" cy="27" r="1.4" fill="currentColor" />
          <rect {...S} className="g" x="26" y="40" width="22" height="20" rx="3" />
          <path {...S} d="M54 42h22M54 49h16M54 56h20" opacity=".55" />
        </g>
        <g className="il-signal">
          <path {...S} className="g" d="M92 34c5 4 5 12 0 16" />
          <path {...S} className="g" d="M98 28c9 7 9 21 0 28" opacity=".6" />
          <path {...S} className="g" d="M104 22c13 10 13 30 0 40" opacity=".3" />
        </g>
      </>;
    case "vertrieb":
      return <>
        <g className="il-kugel">
          <circle {...S} cx="58" cy="46" r="28" />
          <path {...S} d="M30 46h56M58 18c-11 9-11 47 0 56M58 18c11 9 11 47 0 56" opacity=".5" />
          <path {...S} d="M34 32h48M34 60h48" opacity=".3" />
        </g>
        <g className="il-routen">
          <path {...S} className="g" d="M18 62c10-30 34-40 58-36" strokeDasharray="2 4" />
          <path {...S} className="g" d="M76 26c14 4 22 16 24 30" strokeDasharray="2 4" />
          <circle cx="18" cy="62" r="2.6" fill="#b8892e" /><circle cx="76" cy="26" r="2.6" fill="#b8892e" /><circle cx="100" cy="56" r="2.6" fill="#b8892e" />
        </g>
      </>;
    case "ansprechpartner":
      return <>
        <g className="il-person">
          <circle {...S} cx="40" cy="38" r="11" />
          <path {...S} d="M20 76c2-14 10-21 20-21s18 7 20 21" />
        </g>
        <g className="il-blase">
          <path {...S} d="M64 18h36a6 6 0 0 1 6 6v18a6 6 0 0 1-6 6H80l-9 8v-8h-7a6 6 0 0 1-6-6V24a6 6 0 0 1 6-6z" fill="#fff" />
          <circle className="il-p1" cx="73" cy="33" r="2.2" fill="#b8892e" />
          <circle className="il-p2" cx="82" cy="33" r="2.2" fill="#b8892e" />
          <circle className="il-p3" cx="91" cy="33" r="2.2" fill="#b8892e" />
        </g>
      </>;
  }
}

export default function LeistungsIllustration({ art }: { art: FirmaLeistung["schluessel"] }) {
  return (
    <svg className={`gaf-il gaf-il-${art}`} viewBox="0 0 120 88" width="120" height="88" aria-hidden="true" focusable="false">
      <Inhalt art={art} />
    </svg>
  );
}
