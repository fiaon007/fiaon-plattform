import type { CSSProperties } from "react";
import { MARKE_BOX, MARKE_NAME, MARKE_PFAD, type MarkeVariante } from "@shared/fiaon-marke";

/**
 * Die FIAON-Marke (Wortmarke A „Editorial“, E-286) — überall statt des alten Live-Texts.
 *
 * - `hoehe`: CSS-Länge der Markenhöhe. Standard "1em" — die Marke übernimmt damit die Schriftgröße
 *   der Umgebung (text-xl → 20 px, text-2xl → 24 px). `null`: Höhe kommt aus dem Stylesheet.
 * - `farbe`: Standard currentColor, also die Textfarbe der Umgebung. Navy auf hell, Weiß auf dunkel.
 * - `variante`: "fiaon" (Wortmarke), "global" (FIAON Global), "f" (Monogramm).
 */
export function FiaonWortmarke({
  variante = "fiaon",
  hoehe = "1em",
  farbe = "currentColor",
  className,
  style,
  dekorativ = false,
}: {
  variante?: MarkeVariante;
  hoehe?: string | number | null;
  farbe?: string;
  className?: string;
  style?: CSSProperties;
  /** true, wenn daneben schon „FIAON“ für Screenreader steht (dann aria-hidden). */
  dekorativ?: boolean;
}) {
  const m = MARKE_BOX[variante];
  const name = MARKE_NAME[variante];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`${m.x} ${m.y} ${m.b} ${m.h}`}
      className={className}
      style={{
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...(hoehe === null ? {} : { height: typeof hoehe === "number" ? `${hoehe}px` : hoehe }),
        width: "auto",
        aspectRatio: `${m.b} / ${m.h}`,
        overflow: "visible",
        ...style,
      }}
      {...(dekorativ ? { "aria-hidden": true, focusable: "false" } : { role: "img", "aria-label": name })}
    >
      {!dekorativ && <title>{name}</title>}
      <path fill={farbe} d={MARKE_PFAD[variante]} />
    </svg>
  );
}

export default FiaonWortmarke;

export { MARKE_NAVY, MARKE_WEISS } from "@shared/fiaon-marke";
