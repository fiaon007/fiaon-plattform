import { MARKE_BOX, MARKE_PFAD, type MarkeVariante } from "@shared/fiaon-marke";

/**
 * Die FIAON-Marke auf einem Canvas (E-286) — Kartentexturen der 3D-Karten, Teilen-Bilder.
 * Als Pfad statt fillText: keine Schrift nötig, überall dieselbe Form wie im Kopf der Website.
 */
const PFADE: Partial<Record<MarkeVariante, Path2D>> = {};

/**
 * Zeichnet die Marke mit Oberkante `y` und Höhe `hoehe` (px). `x` ist die linke Kante,
 * mit `rechts: true` die rechte. Liefert die Breite in px.
 */
export function markeAufCanvas(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  hoehe: number,
  farbe: string | CanvasGradient | CanvasPattern,
  opts: { rechts?: boolean; variante?: MarkeVariante } = {},
): number {
  const v = opts.variante ?? "fiaon";
  const m = MARKE_BOX[v];
  const s = hoehe / m.h;
  const breite = m.b * s;
  const pfad = (PFADE[v] ??= new Path2D(MARKE_PFAD[v]));
  ctx.save();
  ctx.translate((opts.rechts ? x - breite : x) - m.x * s, y - m.y * s);
  ctx.scale(s, s);
  ctx.fillStyle = farbe;
  ctx.fill(pfad);
  ctx.restore();
  return breite;
}
