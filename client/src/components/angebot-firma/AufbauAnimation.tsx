// ═══════════════════════════════════════════════════════════════════════════
// ETAPPE „AUFBAU“ — EINE EIGENE ANIMATION STATT EINES FOTOS (E-301, Runde 2)
//
// Justin (08.10.2026, Punkt 4): „kein Foto. Stattdessen eine eigene, motivierende
// Animation … ein Shop-Fenster, das sich aufbaut (Raster → Produktkarten →
// Warenkorb), dazu steigende Linie ‚Besucher/Umsatz‘ und kleine Kanal-Symbole
// (Suche, Social, Anzeigen), die einfliegen — Gold/Navy, dünne Linien, Reduced
// Motion = Standbild.“
//
// Reines SVG, 1,5 px Linien, currentColor = Navy, Gold als Akzent. Die Animation
// läuft EINMAL beim Hineinscrollen (Klasse „da“ von useEinmalDa); danach atmet
// nur der Live-Punkt ruhig. Der Grundzustand im CSS ist das fertige Bild — bei
// „weniger Bewegung“ ist jede Animation aus und das Standbild steht (AGENTS.md
// „Bewegung abschalten heißt abschalten“). Keine Daten, keine Texte aus dem
// Angebot: Die Beschriftungen sind Bedienwörter (WORTE).
// ═══════════════════════════════════════════════════════════════════════════
import { useEinmalDa } from "./gemeinsam";

const WORTE = { titel: "Ihr Shop entsteht — und die ersten Kanäle bringen Besucher", besucher: "Besucher", umsatz: "Umsatz", suche: "Suche", social: "Social", anzeigen: "Anzeigen", live: "live" };

export default function AufbauAnimation() {
  const ref = useEinmalDa<HTMLDivElement>("0px 0px -18% 0px");
  const karten = [0, 1, 2];
  return (
    <div ref={ref} className="gaf-aufbau" data-fiaon="firma-aufbau">
      <svg viewBox="0 0 560 380" role="img" aria-label={WORTE.titel} focusable="false">
        <defs>
          <linearGradient id="gaf-ab-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9b45a" /><stop offset="1" stopColor="#b8892e" /></linearGradient>
          <linearGradient id="gaf-ab-flaeche" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9b45a" stopOpacity=".28" /><stop offset="1" stopColor="#d9b45a" stopOpacity="0" /></linearGradient>
          <filter id="gaf-ab-schatten" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#12284a" floodOpacity=".10" /></filter>
        </defs>

        {/* Das Shop-Fenster */}
        <g className="ab-fenster" filter="url(#gaf-ab-schatten)">
          <rect className="ab-rahmen" x="150" y="36" width="380" height="268" rx="16" fill="#fff" stroke="currentColor" strokeWidth="1.5" pathLength={1} />
        </g>
        <g className="ab-leiste">
          <path d="M150 70h380" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
          <circle cx="172" cy="53" r="3.6" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
          <circle cx="186" cy="53" r="3.6" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
          <circle cx="200" cy="53" r="3.6" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="1.5" />
          <rect x="224" y="45" width="190" height="16" rx="8" fill="none" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.5" />
          <circle className="ab-live" cx="236" cy="53" r="3" fill="url(#gaf-ab-gold)" />
          <text x="246" y="57" className="ab-live-text">{WORTE.live}</text>
        </g>
        {/* Warenkorb oben rechts mit Zähler */}
        <g className="ab-korb">
          <path d="M478 46h5l4 14h17l3-10h-22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="490" cy="63.5" r="1.8" fill="currentColor" /><circle cx="502" cy="63.5" r="1.8" fill="currentColor" />
          <circle className="ab-korb-punkt" cx="511" cy="44" r="7.5" fill="url(#gaf-ab-gold)" />
          <text className="ab-korb-zahl ab-z1" x="511" y="47.2" textAnchor="middle">1</text>
          <text className="ab-korb-zahl ab-z2" x="511" y="47.2" textAnchor="middle">2</text>
          <text className="ab-korb-zahl ab-z3" x="511" y="47.2" textAnchor="middle">3</text>
        </g>

        {/* Raster, das sich aufbaut */}
        <g className="ab-raster" stroke="currentColor" strokeOpacity=".09" strokeWidth="1">
          {[190, 230, 270].map((x) => <path key={x} d={`M${x + 100} 84v204`} />)}
          {[110, 150, 190, 230, 270].map((y) => <path key={y} d={`M166 ${y}h348`} />)}
        </g>
        {/* Kopf des Shops */}
        <g className="ab-kopf">
          <rect x="170" y="86" width="44" height="7" rx="3.5" fill="currentColor" fillOpacity=".75" />
          <rect x="380" y="87" width="34" height="5" rx="2.5" fill="currentColor" fillOpacity=".2" />
          <rect x="422" y="87" width="34" height="5" rx="2.5" fill="currentColor" fillOpacity=".2" />
          <rect x="464" y="87" width="46" height="5" rx="2.5" fill="currentColor" fillOpacity=".2" />
          <rect className="ab-buehne" x="170" y="104" width="340" height="56" rx="10" fill="#fbf8f0" stroke="url(#gaf-ab-gold)" strokeWidth="1.2" />
          <rect x="186" y="118" width="120" height="8" rx="4" fill="currentColor" fillOpacity=".7" />
          <rect x="186" y="133" width="86" height="5" rx="2.5" fill="currentColor" fillOpacity=".25" />
          <rect x="430" y="122" width="62" height="20" rx="10" fill="url(#gaf-ab-gold)" />
        </g>
        {/* Produktkarten */}
        {karten.map((i) => {
          const x = 170 + i * 120;
          return (
            <g key={i} className={`ab-karte ab-k${i}`}>
              <rect x={x} y="172" width="100" height="116" rx="10" fill="#fff" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.5" />
              <rect x={x + 10} y="182" width="80" height="50" rx="7" fill="#eef1f5" />
              <path d={`M${x + 36} 222c4-14 24-14 28 0`} fill="none" stroke="url(#gaf-ab-gold)" strokeWidth="1.5" />
              <rect x={x + 44} y="196" width="12" height="18" rx="3" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
              <rect x={x + 10} y="242" width="62" height="6" rx="3" fill="currentColor" fillOpacity=".55" />
              <rect x={x + 10} y="254" width="40" height="5" rx="2.5" fill="currentColor" fillOpacity=".2" />
              <rect x={x + 10} y="268" width="30" height="8" rx="4" fill="url(#gaf-ab-gold)" fillOpacity=".9" />
              <circle cx={x + 82} cy="272" r="7" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1.5" />
              <path d={`M${x + 79} 272h6M${x + 82} 269v6`} stroke="currentColor" strokeOpacity=".6" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          );
        })}

        {/* Steigende Linie: Besucher und Umsatz */}
        <g className="ab-kurve" filter="url(#gaf-ab-schatten)">
          <rect x="18" y="226" width="200" height="130" rx="14" fill="#fff" stroke="currentColor" strokeOpacity=".14" strokeWidth="1.5" />
        </g>
        <g className="ab-kurve-inhalt">
          <path d="M34 246h10" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" /><text x="49" y="250" className="ab-label">{WORTE.besucher}</text>
          <path d="M122 246h10" stroke="#b8892e" strokeWidth="2" /><text x="137" y="250" className="ab-label ab-label-gold">{WORTE.umsatz}</text>
          <path d="M34 336h168" stroke="currentColor" strokeOpacity=".15" strokeWidth="1" />
          <path className="ab-flaeche" d="M34 330 L62 322 L90 326 L118 306 L146 298 L174 276 L202 262 L202 336 L34 336Z" fill="url(#gaf-ab-flaeche)" />
          <path className="ab-linie-b" d="M34 330 L62 322 L90 326 L118 306 L146 298 L174 276 L202 262" fill="none" stroke="currentColor" strokeOpacity=".55" strokeWidth="1.5" strokeLinejoin="round" pathLength={1} />
          <path className="ab-linie-u" d="M34 334 L62 330 L90 331 L118 318 L146 314 L174 296 L202 278" fill="none" stroke="url(#gaf-ab-gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" pathLength={1} />
          <circle className="ab-spitze" cx="202" cy="278" r="3.5" fill="url(#gaf-ab-gold)" />
        </g>

        {/* Kanäle, die einfliegen — mit gestrichelter Bahn ins Fenster */}
        {[
          { k: "suche", x: 52, y: 66, t: WORTE.suche, ziel: "M70 66 C 110 66, 120 96, 150 100" },
          { k: "social", x: 40, y: 128, t: WORTE.social, ziel: "M58 128 C 100 128, 110 146, 150 150" },
          { k: "anzeigen", x: 76, y: 180, t: WORTE.anzeigen, ziel: "M94 180 C 120 180, 126 196, 150 200" },
        ].map((c, i) => (
          <g key={c.k} className={`ab-kanal ab-c${i}`}>
            <path className="ab-bahn" d={c.ziel} fill="none" stroke="url(#gaf-ab-gold)" strokeWidth="1.2" strokeDasharray="2 4" />
            <circle cx={c.x} cy={c.y} r="17" fill="#fff" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.5" />
            <g transform={`translate(${c.x - 9} ${c.y - 9})`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {c.k === "suche" && <><circle cx="8" cy="8" r="5.5" /><path d="M12 12l5 5" stroke="#b8892e" /></>}
              {c.k === "social" && <><circle cx="4" cy="12" r="2.4" /><circle cx="14" cy="5" r="2.4" /><circle cx="14" cy="15" r="2.4" stroke="#b8892e" /><path d="M6.2 11l5.6-4.2M6.2 13l5.6 1.4" /></>}
              {c.k === "anzeigen" && <><path d="M3 7v5h3l7 4V3L6 7z" /><path d="M16 7.5c1 1 1 3 0 4" stroke="#b8892e" /></>}
            </g>
            <text x={c.x} y={c.y + 31} textAnchor="middle" className="ab-label">{c.t}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
