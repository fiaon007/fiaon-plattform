// ═══════════════════════════════════════════════════════════════════════════
// „DREI ORTE“ IM FUSS DER BUSINESS-WELT (06.10.2026, E-293)
//
// Ersetzt zwei Dinge auf einmal: den Abschnitt „Deutschland, Florida, London“
// mit drei großen Uhren (55 Wörter, 700 px) und die Standort-Liste im Fuß.
// Eine ruhige Karte aus Haarlinien: Sie in Deutschland, Österreich oder der
// Schweiz, die Bögen nach London (Vertragspartner) und Miami (Team vor Ort),
// Zürich als kleiner Nebenpunkt ohne Uhr. An Sie, London und Miami je eine
// Mini-Uhr (GlobalUhren.tsx, UhrMini) — die Zonen kommen aus
// GLOBAL_WOERTER[sp].uhren (pruef-global-seiten.ts §9 prüft sie). Unter jedem
// Standort Stadt, Gesellschaft, Rolle und Registernachweis wie bisher.
// Am Handy eine senkrechte Liste ohne Bögen.
//
// Bewegung (Scheibe B, 06.10.2026): einmal beim Hineinscrollen zeichnen sich die
// Bögen DACH → London und DACH → Miami (1.400 ms), danach pulst Miami EINMAL.
// Die Sekundenzeiger laufen nur, solange die Uhren im Bild sind (UhrMini).
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState } from "react";
import { GLOBAL_STANDORTE, standortNachweis } from "@shared/fiaon-global-partner";
import { UhrMini } from "@/components/site/GlobalUhren";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

const ZONE = { sie: "Europe/Berlin", london: "Europe/London", miami: "America/New_York" } as const;
// Höhe des Kartenstreifens über der Uhrenreihe; die Punkte liegen auf GRUND, die Bögen steigen darüber.
const HOEHE = 72, GRUND = 60;

/** Spaltenmitte der Uhr (bzw. des leeren Uhrenplatzes bei Zürich) relativ zum Rahmen, in px. */
interface Lage { breite: number; x: Partial<Record<"sie" | "london" | "zuerich" | "miami", number>> }

export default function GlobalOrte({ en, label, sie, sieZusatz, rollen, uhren }: {
  en: boolean;
  label: string;
  sie: string;
  sieZusatz: string;
  rollen: { london: string; zuerich: string; miami: string };
  /** GLOBAL_WOERTER[sp].uhren — Zone und Ortsname je Uhr. */
  uhren: readonly { zone: string; ort: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEinmalSichtbar(ref, 0.2);
  const ortName = (zone: string) => uhren.find((u) => u.zone === zone)?.ort ?? zone;

  // 06.10.2026 (E-293, Scheibe B): Die Punkte sitzen genau über ihren Uhren — gemessen, nicht geschätzt. In Scheibe A
  // schwebte ein festes SVG (viewBox 960 × 220) mittig über der Uhrenreihe, die Punkte standen neben ihren Uhren und
  // die Karte war deshalb aus. Jetzt misst ein ResizeObserver die Spalten; das SVG hat die Pixelmaße des Rahmens.
  const [lage, setLage] = useState<Lage | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const messen = () => {
      const r = el.getBoundingClientRect();
      const x: Lage["x"] = {};
      el.querySelectorAll<HTMLElement>("[data-ort]").forEach((li) => {
        const l = li.getBoundingClientRect();
        const uhr = li.querySelector<HTMLElement>(".fg-uhr-mini")?.getBoundingClientRect();
        // Zürich hat keine Uhr: der Punkt sitzt über dem freien Uhrenplatz der Spalte (Breite wie eine Uhr).
        const mitte = uhr && uhr.width ? uhr.left + uhr.width / 2 : l.left + Math.min(64, l.width) / 2;
        x[li.dataset.ort as keyof Lage["x"]] = Math.round((mitte - r.left) * 10) / 10;
      });
      setLage((alt) => (alt && alt.breite === Math.round(r.width) && JSON.stringify(alt.x) === JSON.stringify(x) ? alt : { breite: Math.round(r.width), x }));
    };
    messen();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(messen);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { sie: xs, london: xl, zuerich: xz, miami: xm } = lage?.x ?? {};
  /** Ein Bogen von Ihnen zu einem Ort; `hub` = wie hoch er über die Grundlinie steigt. */
  const bogen = (a: number, b: number, hub: number) => `M${a} ${GRUND} Q${(a + b) / 2} ${GRUND - 2 * hub} ${b} ${GRUND}`;

  return (
    <div ref={ref} className="gf-drei-orte" role="group" aria-label={label}>
      {/* 06.10.2026 (E-293): Bis gemessen ist, hält ein leerer Platz mit derselben Klasse die 72 px frei (ab 721 px
          sichtbar, darunter wie die Karte aus) — sonst schiebt sich der Fuß nach dem Start um ≈ 60 px. */}
      {!(lage && xs !== undefined && xl !== undefined && xm !== undefined) && <div className="gf-orte-karte gf-orte-platz" aria-hidden="true" />}
      {lage && xs !== undefined && xl !== undefined && xm !== undefined && (
        <svg className="gf-orte-karte" viewBox={`0 0 ${lage.breite} ${HOEHE}`} width={lage.breite} height={HOEHE} aria-hidden="true">
          <path d={bogen(xs, xl, 26)} className="bogen spur" />
          <path d={bogen(xs, xm, 50)} className="bogen spur" />
          <path d={bogen(xs, xl, 26)} className="bogen zug b1" pathLength={1} />
          <path d={bogen(xs, xm, 50)} className="bogen zug b2" pathLength={1} />
          {([["sie", xs], ["london", xl], ["miami", xm]] as const).map(([n, x]) => <line key={n} x1={x} x2={x} y1={GRUND + 6} y2={HOEHE} className="lot" />)}
          {xz !== undefined && <circle cx={xz} cy={GRUND} r="2.5" className="punkt neben" />}
          <circle cx={xs} cy={GRUND} r="4" className="punkt sie" />
          <circle cx={xl} cy={GRUND} r="4" className="punkt london" />
          <circle cx={xm} cy={GRUND} r="4" className="punkt miami" />
          <circle cx={xm} cy={GRUND} r="9" className="puls" />
        </svg>
      )}
      <ul className="gf-orte-liste">
        <li className="sie" data-ort="sie">
          <UhrMini zone={ZONE.sie} ort={ortName(ZONE.sie)} />
          <span className="gf-stadt">{sie}</span>
          <span>{sieZusatz}</span>
        </li>
        {GLOBAL_STANDORTE.map((o) => (
          <li key={o.schluessel} className={o.schluessel} data-ort={o.schluessel}>
            {o.schluessel !== "zuerich" && <UhrMini zone={ZONE[o.schluessel as "london" | "miami"]} ort={en ? o.en.stadt : o.stadt} />}
            <span className="gf-stadt">{en ? o.en.stadt : o.stadt}</span>
            <b>{o.gesellschaft}</b>
            <span>{rollen[o.schluessel as keyof typeof rollen]} · {standortNachweis(o)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
