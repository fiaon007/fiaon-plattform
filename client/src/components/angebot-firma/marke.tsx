// Die Wortmarke „FIAON Global“ als SVG — Pfade und Ausschnitt aus der einen Quelle shared/fiaon-marke.ts (E-286).
import { MARKE_BOX, MARKE_NAME, MARKE_PFAD } from "@shared/fiaon-marke";

export function MarkeGlobal({ hoehe = 18, className = "" }: { hoehe?: number; className?: string }) {
  const m = MARKE_BOX.global;
  return (
    <svg className={className} viewBox={`${m.x} ${m.y} ${m.b} ${m.h}`} height={hoehe} width={Math.round((hoehe * m.b) / m.h)} role="img" aria-label={MARKE_NAME.global}>
      <path fill="currentColor" d={MARKE_PFAD.global} />
    </svg>
  );
}
