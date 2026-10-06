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
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import { GLOBAL_STANDORTE, standortNachweis } from "@shared/fiaon-global-partner";
import { UhrMini } from "@/components/site/GlobalUhren";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";

const PUNKT = { sie: [170, 120], london: [300, 70], zuerich: [205, 150], miami: [800, 160] } as const;
const ZONE = { sie: "Europe/Berlin", london: "Europe/London", miami: "America/New_York" } as const;

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
  const bogen = (a: readonly [number, number], b: readonly [number, number]) => `M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${Math.min(a[1], b[1]) - 70} ${b[0]} ${b[1]}`;
  return (
    <div ref={ref} className="gf-drei-orte" role="group" aria-label={label}>
      <svg className="gf-orte-karte" viewBox="0 0 960 220" aria-hidden="true">
        <path d={bogen(PUNKT.sie, PUNKT.london)} className="bogen" pathLength={1} />
        <path d={bogen(PUNKT.sie, PUNKT.miami)} className="bogen" pathLength={1} />
        <circle cx={PUNKT.zuerich[0]} cy={PUNKT.zuerich[1]} r="3" className="punkt neben" />
        <circle cx={PUNKT.sie[0]} cy={PUNKT.sie[1]} r="5" className="punkt sie" />
        <circle cx={PUNKT.london[0]} cy={PUNKT.london[1]} r="5" className="punkt" />
        <circle cx={PUNKT.miami[0]} cy={PUNKT.miami[1]} r="5" className="punkt miami" />
      </svg>
      <ul className="gf-orte-liste">
        <li className="sie">
          <UhrMini zone={ZONE.sie} ort={ortName(ZONE.sie)} />
          <span className="gf-stadt">{sie}</span>
          <span>{sieZusatz}</span>
        </li>
        {GLOBAL_STANDORTE.map((o) => (
          <li key={o.schluessel} className={o.schluessel}>
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
