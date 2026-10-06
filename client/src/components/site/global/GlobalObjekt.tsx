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
//
// 06.10.2026 (E-293, Scheibe C) — die Bilder sind da (lib/global-bilder.ts):
// · `stapel` = die Kartenleiter (III): drei deckungsgleiche Bilder hinten →
//   vorn; die hinteren sitzen per transform versetzt (Treppe) und treten in der
//   Wegleiste aus der vorderen hervor (styles/global-grafik.css).
// · `licht` = ein Lichtstreif über dem Bild, nur per transform bewegt:
//   „siegel“ (Hero) ist auf den Siegelkreis maskiert (Mitte und Radius aus
//   GLOBAL_BILDER) und läuft 2,25 s nach dem Einstieg, danach alle 12 s — nur
//   solange das Bild im Bild ist; „bild“ (Navy-Karte in II) ist auf die Form
//   des Bildes selbst maskiert (Alphakanal) und läuft einmal.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef } from "react";
import { GLOBAL_BILDER } from "@/lib/global-bilder";
import { beobachteSichtbar } from "@/components/site/global/bewegung";

export type GlobalObjektArt = "urkunde" | "karte" | "karten" | "termsheet";

/** Ein freigestelltes Bild (Scheibe C): Pfad ohne Breite und Endung, Breiten, Seitenverhältnis. */
export interface GlobalBildQuelle {
  pfad: string; breiten: readonly number[]; seite: readonly [number, number]; version?: number;
  /** Nur Urkunde: Siegelmitte (x/y in %) und Radius als Farbstopp des radial-gradient (rStopp). */
  siegel?: { x: string; y: string; rStopp: string };
}

const datei = (bild: GlobalBildQuelle, w: number) => `${bild.pfad}-${w}.webp?v=${bild.version ?? GLOBAL_BILDER.version}`;

/** Ein Bild mit festen Maßen (CLS 0): größte Breite als width/height, alle Breiten im srcset. */
function Bild({ bild, sizes, hero, className }: { bild: GlobalBildQuelle; sizes: string; hero: boolean; className?: string }) {
  const [b, h] = bild.seite;
  const gross = Math.max(...bild.breiten);
  return (
    <img className={className} src={datei(bild, gross)} srcSet={bild.breiten.map((w) => `${datei(bild, w)} ${w}w`).join(", ")} sizes={sizes}
      width={gross} height={Math.round((gross * h) / b)} decoding="async" loading={hero ? "eager" : "lazy"}
      {...(hero ? ({ fetchpriority: "high" } as Record<string, string>) : {})} alt="" />
  );
}

export default function GlobalObjekt({ art, bild, stapel, licht, nachweis, hero = false, className = "", groesse }: {
  art: GlobalObjektArt;
  bild?: GlobalBildQuelle | null;
  /** Kartenleiter: drei deckungsgleiche Bilder, hinten → vorn (die hinteren tragen „tritt t2/t1“). */
  stapel?: readonly GlobalBildQuelle[];
  /** Lichtstreif über dem Bild: auf das Siegel maskiert (Hero) oder auf die Form des Bildes (Karte). */
  licht?: "siegel" | "bild";
  /** Redaktioneller Bildnachweis („Abbildung mit KI erstellt“) — nur zusammen mit einem echten Bild. */
  nachweis?: string;
  hero?: boolean;
  className?: string;
  /** Anzeigebreite: Zahl in px oder ein sizes-Ausdruck (z. B. „(max-width: 720px) 160px, 400px“). */
  groesse?: number | string;
}) {
  const ref = useRef<HTMLElement>(null);
  const sizes = groesse === undefined ? "100vw" : typeof groesse === "number" ? `${groesse}px` : groesse;
  const lichtBild = licht === "siegel" ? (bild?.siegel ? bild : null) : licht === "bild" ? bild ?? null : null;
  // Das Siegel-Licht ist eine Schleife: Sie hält an, solange die Urkunde außer Sicht oder der Tab im Hintergrund ist (Bauplan 2.1).
  useEffect(() => {
    const el = ref.current;
    if (!el || licht !== "siegel" || !lichtBild) return;
    return beobachteSichtbar(el, (sichtbar) => el.setAttribute("data-sicht", sichtbar ? "1" : "0"));
  }, [licht, lichtBild]);

  if (bild || stapel?.length) {
    const lichtStil = !lichtBild ? undefined : licht === "siegel" && lichtBild.siegel
      ? ({ "--sx": lichtBild.siegel.x, "--sy": lichtBild.siegel.y, "--sr": lichtBild.siegel.rStopp } as React.CSSProperties)
      : ({ WebkitMaskImage: `url("${datei(lichtBild, Math.min(...lichtBild.breiten))}")`, maskImage: `url("${datei(lichtBild, Math.min(...lichtBild.breiten))}")` } as React.CSSProperties);
    return (
      // Ohne eigenen Nachweis ist das Objekt reiner Schmuck (Wegleiste: eine gemeinsame Zeile) — sonst läse ein
      // Bildschirmleser vier leere „Abbildung“ zwischen den Etappen-Knöpfen.
      <figure ref={ref} className={`fg-objekt mit-bild ${art} ${className}`} aria-hidden={nachweis ? undefined : true}>
        {stapel?.length ? (
          <span className="fg-stapel">
            {stapel.map((q, i) => {
              const rang = stapel.length - 1 - i; // 0 = vorn
              return <Bild key={q.pfad} bild={q} sizes={sizes} hero={hero} className={rang ? `tritt t${rang}` : undefined} />;
            })}
          </span>
        ) : bild ? (
          <picture><Bild bild={bild} sizes={sizes} hero={hero} /></picture>
        ) : null}
        {lichtBild && <span className={`fg-licht ${licht}`} style={lichtStil} aria-hidden="true"><i /></span>}
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
  // Drei Karten als Treppe: Navy, Graphit, Champagner — je 14 px nach oben links versetzt. Graphit und Champagner
// tragen `tritt t1/t2`: In der Wegleiste treten sie nacheinander aus der Navy-Karte hervor (Scheibe B, 06.10.2026).
  return (
    <svg viewBox="0 0 170 128" className="fg-objekt-svg">
      <rect x="32" y="4" width="134" height="82" rx="9" className="karte champagner tritt t2" />
      <rect x="18" y="20" width="134" height="82" rx="9" className="karte graphit tritt t1" />
      <rect x="4" y="36" width="134" height="82" rx="9" className="karte navy" />
      <rect x="16" y="62" width="20" height="15" rx="3" className="chip" />
    </svg>
  );
}
