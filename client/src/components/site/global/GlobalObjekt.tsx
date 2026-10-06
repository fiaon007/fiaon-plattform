// ═══════════════════════════════════════════════════════════════════════════
// DIE GEGENSTÄNDE DER SEITE — URKUNDE, KARTEN, TERM SHEET (06.10.2026, E-293)
//
// Auf /business liegen vier freigestellte Objekte (Bauplan Kapitel 4, HF-1 bis
// HF-3): die Gründungsurkunde mit Prägesiegel, die Metallkarte, die Karten-
// treppe aus drei Farben und das Term Sheet mit Füller. Sie liegen auf Papier,
// sie schweben nicht (Kontaktschatten statt Glas, styles/global.css-Haltung).
//
// Scheibe A baut die Plätze — solange `bild` fehlt, steht dort ein ruhiger
// Platzhalter aus Haarlinien mit derselben Silhouette, damit Maße, Abstände und
// Bewegung schon stimmen. Ein Platzhalter trägt KEINEN KI-Bildnachweis (es ist
// ja kein KI-Bild). Kommt in Scheibe C das Bild (GLOBAL_BILDER), rendert die
// Komponente <picture> mit festen Maßen und den redaktionellen Bildnachweis
// senkrecht an der rechten Bildkante (Text aus i18n: bildKi/szeneKi). `alt=""`,
// weil das Objekt Schmuck ist — die Aussage steht im Text daneben.
// ═══════════════════════════════════════════════════════════════════════════

export type GlobalObjektArt = "urkunde" | "karte" | "karten" | "termsheet";

/** Ein freigestelltes Bild (Scheibe C): Pfad ohne Breite und Endung, Breiten, Seitenverhältnis. */
export interface GlobalBildQuelle { pfad: string; breiten: readonly number[]; seite: readonly [number, number]; version?: number }

export default function GlobalObjekt({ art, bild, nachweis, hero = false, className = "", groesse }: {
  art: GlobalObjektArt;
  bild?: GlobalBildQuelle | null;
  /** Redaktioneller Bildnachweis („Abbildung mit KI erstellt“) — nur zusammen mit einem echten Bild. */
  nachweis?: string;
  hero?: boolean;
  className?: string;
  /** Anzeigebreite in px (für sizes). */
  groesse?: number;
}) {
  if (bild) {
    const [b, h] = bild.seite;
    const gross = Math.max(...bild.breiten);
    const srcSet = bild.breiten.map((w) => `${bild.pfad}-${w}.webp?v=${bild.version ?? 1} ${w}w`).join(", ");
    return (
      <figure className={`fg-objekt mit-bild ${art} ${className}`}>
        <picture>
          <img src={`${bild.pfad}-${gross}.webp?v=${bild.version ?? 1}`} srcSet={srcSet} sizes={groesse ? `${groesse}px` : "100vw"}
            width={gross} height={Math.round((gross * h) / b)} decoding="async" loading={hero ? "eager" : "lazy"}
            {...(hero ? ({ fetchpriority: "high" } as Record<string, string>) : {})} alt="" />
        </picture>
        {nachweis && <figcaption className="fg-bildnachweis">{nachweis}</figcaption>}
      </figure>
    );
  }
  return (
    <span className={`fg-objekt platzhalter ${art} ${className}`} aria-hidden="true">
      <Platzhalter art={art} />
    </span>
  );
}

/** Silhouetten aus Haarlinien — dieselben Proportionen wie die späteren Objekte. */
function Platzhalter({ art }: { art: GlobalObjektArt }) {
  if (art === "urkunde" || art === "termsheet") {
    // 4:5-Blatt; Urkunde mit Guillochen-Rand und Siegel, Term Sheet mit Linien und Füller.
    return (
      <svg viewBox="0 0 160 200" className="fg-objekt-svg">
        <rect x="6" y="6" width="148" height="188" rx="3" className="blatt" />
        {art === "urkunde" ? (
          <>
            <rect x="16" y="16" width="128" height="168" rx="2" className="rand" />
            {[52, 64, 76, 88, 100].map((y, i) => <line key={y} x1="34" x2={i % 2 ? 108 : 126} y1={y} y2={y} className="zeile" />)}
            <circle cx="114" cy="152" r="17" className="siegel" />
            <circle cx="114" cy="152" r="11" className="siegel-innen" />
            <path d="M108 166 l-6 18 M120 166 l6 18" className="band" />
          </>
        ) : (
          <>
            {[34, 48, 62, 76, 90, 104, 118].map((y, i) => <line key={y} x1="24" x2={i % 3 === 2 ? 98 : 136} y1={y} y2={y} className="zeile" />)}
            <path d="M44 176 L132 128" className="fueller" />
            <path d="M132 128 l8 -4" className="fueller-spitze" />
          </>
        )}
      </svg>
    );
  }
  if (art === "karte") {
    return (
      <svg viewBox="0 0 150 100" className="fg-objekt-svg">
        <rect x="4" y="10" width="142" height="86" rx="9" className="karte navy" />
        <rect x="18" y="38" width="22" height="17" rx="3" className="chip" />
      </svg>
    );
  }
  // Drei Karten als Treppe: Navy, Graphit, Champagner — je 14 px nach oben links versetzt.
  return (
    <svg viewBox="0 0 170 128" className="fg-objekt-svg">
      <rect x="32" y="4" width="134" height="82" rx="9" className="karte champagner" />
      <rect x="18" y="20" width="134" height="82" rx="9" className="karte graphit" />
      <rect x="4" y="36" width="134" height="82" rx="9" className="karte navy" />
      <rect x="16" y="62" width="20" height="15" rx="3" className="chip" />
    </svg>
  );
}
