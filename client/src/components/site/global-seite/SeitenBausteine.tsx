// ═══════════════════════════════════════════════════════════════════════════
// BAUSTEINE DER UNTERSEITEN-VORLAGE (06.10.2026, E-293, Scheibe D)
//
// Bauplan Kapitel 5: Die 78 Unterseiten (DE und EN) sollen aussehen wie die neue
// /business — dieselben Pakettafeln, dieselbe Haarlinien-Grafik, weniger Kästen.
// Hier stehen die Bausteine, die global-seite.tsx dafür braucht:
//   · SeitenTafel / SeitenTafeln — die Pakettafel GlobalTafel von /business
//     (Punkt 8), für ein Paket (25×) oder alle vier (6×). Global VIP steht auf
//     den Unterseiten NICHT als Navy-Glas-Bühne, sondern als helle Zeile
//     (VipZeile): Auf den Unterseiten ist das Schlussband die eine dunkle Fläche
//     (Punkt 15), und WellenFeld (Canvas) soll nur auf /business laufen.
//   · OrteKarte — „Drei Orte“ wie im Fuß, hier ausführlich mit Adressen, hell
//     (Punkt 9).
//   · RollenDreieck — „Sie · FIAON · Partner“ als kleines Schaubild über den drei
//     Listen (Punkt 10).
// Alle Wörter kommen aus i18n/global.ts, i18n/global-seite.ts oder shared/ —
// kein Satz im JSX (pruef-wortwand-de.ts liest kein JSX).
// ═══════════════════════════════════════════════════════════════════════════
import { useRef } from "react";
import GlobalTafel, { Haken, Pfeil, TAFEL_ZUERST, tafelEtappenBis } from "@/components/site/global/GlobalTafel";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { UhrMini } from "@/components/site/GlobalUhren";
import { Auf } from "@/components/site/DunkleBuehne";
import { GLOBAL_WOERTER, GLOBAL_FUSS_WOERTER } from "@/i18n/global";
import { GLOBAL_PAKETE, globalKapital, globalPaket, globalPreisText, type GlobalSchluessel } from "@shared/fiaon-global";
import { globalStartPfad } from "@shared/fiaon-global-wege";
import { GLOBAL_STANDORTE, GLOBAL_VERBUNDEN, GLOBAL_VERBUNDEN_EN, standortNachweis } from "@shared/fiaon-global-partner";
import { GLOBAL_SEITE_WORTE } from "@shared/fiaon-global-seiten";
import { werbeEreignis } from "@/lib/werbung";

type Sp = "de" | "en";
const ROEMISCH = ["I", "II", "III", "IV"];

// Etappen und Leistungen je Tafel aus derselben Quelle wie /business (GlobalTafel.tsx, 06.10.2026, E-293):
// Eine Tafel sagt auf jeder Seite dasselbe.
const etappenBis = tafelEtappenBis;
const ZUERST = TAFEL_ZUERST;
const FOKUS: GlobalSchluessel = "global_kapital";

interface TafelWege {
  sp: Sp;
  /** Die Seite, von der aus beauftragt wird (Messpunkt global_beauftragen_klick). */
  seite: string;
  /** „privat“ auf Seiten für Privatpersonen — der Auftrag startet dann als Privatperson. */
  art?: "privat";
  /** Öffnet das Erstgespräch an seiner Stelle und füllt das Paket vor. */
  onGespraech: (paket?: GlobalSchluessel) => void;
}

const klick = (paket: GlobalSchluessel, seite: string) => () => werbeEreignis("global_beauftragen_klick", { paket, seite });

/** Das eine passende Paket (Baustein „paket“) — Tafel quer: links Zahlen und Knöpfe, rechts die Leistungen. */
export function SeitenTafel({ k, sp, seite, art, onGespraech }: TafelWege & { k: GlobalSchluessel }) {
  const p = globalPaket(k);
  if (!p) return null;
  if (k === "global_vip") return <VipZeile sp={sp} seite={seite} art={art} onGespraech={onGespraech} einzeln />;
  return (
    <Auf className="fd-tafel-eins">
      <GlobalTafel p={p} s={sp} t={GLOBAL_WOERTER[sp]} bis={etappenBis(k)} zuerst={ZUERST[k]}
        startHref={globalStartPfad(k, sp, art)} onBeauftragen={klick(k, seite)} onGespraech={() => onGespraech(k)} />
    </Auf>
  );
}

/** Alle vier Pakete (Baustein „pakete“) — drei Tafeln, Global VIP als helle Zeile darunter. */
export function SeitenTafeln({ sp, seite, art, onGespraech }: TafelWege) {
  const t = GLOBAL_WOERTER[sp];
  return (
    <div className="fd-tafeln-rahmen">
      <div className="fd-tafeln">
        {GLOBAL_PAKETE.filter((p) => p.key !== "global_vip").map((p, i) => (
          <Auf key={p.key} verzoegerung={i * 90}>
            <GlobalTafel p={p} s={sp} t={t} bis={etappenBis(p.key)} zuerst={ZUERST[p.key]} fokus={p.key === FOKUS}
              startHref={globalStartPfad(p.key, sp, art)} onBeauftragen={klick(p.key, seite)} onGespraech={() => onGespraech(p.key)} />
          </Auf>
        ))}
      </div>
      <VipZeile sp={sp} seite={seite} art={art} onGespraech={onGespraech} />
    </div>
  );
}

/**
 * Global VIP auf den Unterseiten: hell, eine Zeile über die volle Breite. Dieselben Angaben wie die Bühne auf /business —
 * Name, Etappen, „Kapitalrahmen bis zu“ (die eine erlaubte Stelle, E-190) mit „Ihr Ziel — … Institut“ direkt darunter,
 * Festpreis mit „alle Gebühren des Pakets inklusive“ — und wie dort zuerst das Gespräch, dann „Direkt beauftragen“.
 */
export function VipZeile({ sp, seite, art, onGespraech, einzeln = false }: TafelWege & { einzeln?: boolean }) {
  const t = GLOBAL_WOERTER[sp];
  const p = globalPaket("global_vip")!;
  const w = p[sp];
  const kapital = globalKapital("global_vip", sp);
  const bis = etappenBis("global_vip");
  return (
    <Auf className={`fd-vip${einzeln ? " einzeln" : ""}`}>
      <article id="paket-global_vip" className="fd-vip-zeile" aria-label={w.name}>
        <div className="fd-vip-kopf">
          <span className="fd-vip-marke"><b>{t.vipZeichen}</b>{w.marke}</span>
          <h3>{w.name}</h3>
          <div className="fg-tarif-weg">
            <span className="balken" aria-hidden="true">{ROEMISCH.map((r, j) => <i key={r} className={j < bis ? "an" : undefined} />)}</span>
            <span className="text">{t.etappenBis(ROEMISCH[bis - 1])} · {w.dauer}</span>
          </div>
        </div>
        <div className="fd-vip-zahl">
          <span>{kapital.bisZu ? `${t.planung} ${kapital.bisZu}` : t.planung}</span>
          <b className="fg-glanz">{kapital.wert}</b>
          <em>{t.planungZusatz}</em>
        </div>
        <div className="fd-vip-zahl">
          <span>{t.festpreis}</span>
          <b className="fg-glanz">{globalPreisText("global_vip", sp)}</b>
          <em className="inkl"><Haken groesse={12} />{t.inklusive}</em>
        </div>
        <div className="fd-vip-tun">
          <button type="button" className="fg-knopf" aria-label={t.vipGespraech(w.name)} onClick={() => onGespraech("global_vip")}>{t.vipGespraechKurz}<Pfeil /></button>
          <a className="fg-textknopf" href={globalStartPfad("global_vip", sp, art)} onClick={klick("global_vip", seite)}>{t.direktBeauftragen}</a>
        </div>
      </article>
    </Auf>
  );
}

// ── „Drei Orte“, ausführlich und hell ────────────────────────────────────────
const PUNKT = { sie: [150, 120], london: [300, 66], zuerich: [214, 150], miami: [810, 150] } as const;
const ZONE = { sie: "Europe/Berlin", london: "Europe/London", miami: "America/New_York" } as const;

export function OrteKarte({ sp }: { sp: Sp }) {
  const ref = useRef<HTMLDivElement>(null);
  useEinmalSichtbar(ref, 0.2);
  const en = sp === "en";
  const f = GLOBAL_FUSS_WOERTER[sp];
  const uhren = GLOBAL_WOERTER[sp].uhren;
  const ortName = (zone: string) => uhren.find((u) => u.zone === zone)?.ort ?? zone;
  const stadt = (k: string) => { const o = GLOBAL_STANDORTE.find((x) => x.schluessel === k); return o ? (en ? o.en.stadt : o.stadt) : ""; };
  const bogen = (a: readonly [number, number], b: readonly [number, number]) => `M${a[0]} ${a[1]} Q${(a[0] + b[0]) / 2} ${Math.min(a[1], b[1]) - 70} ${b[0]} ${b[1]}`;
  return (
    <div ref={ref} className="fd-orte" role="group" aria-label={f.standorte}>
      <svg className="fd-orte-karte" viewBox="0 0 960 200" aria-hidden="true" focusable="false">
        <path d={bogen(PUNKT.sie, PUNKT.london)} className="bogen" pathLength={1} />
        <path d={bogen(PUNKT.sie, PUNKT.miami)} className="bogen b2" pathLength={1} />
        <circle cx={PUNKT.zuerich[0]} cy={PUNKT.zuerich[1]} r="3" className="punkt neben" />
        <circle cx={PUNKT.sie[0]} cy={PUNKT.sie[1]} r="5" className="punkt sie" />
        <circle cx={PUNKT.london[0]} cy={PUNKT.london[1]} r="5" className="punkt" />
        <circle cx={PUNKT.miami[0]} cy={PUNKT.miami[1]} r="5" className="punkt miami" />
        {/* Beschriftung aus denselben Daten wie die Liste darunter (Fuß-Wörter, GLOBAL_STANDORTE). */}
        <text x={PUNKT.sie[0] - 14} y={PUNKT.sie[1] + 6} textAnchor="end" className="ort">{f.orteSie}</text>
        <text x={PUNKT.london[0]} y={PUNKT.london[1] - 16} textAnchor="middle" className="ort">{stadt("london")}</text>
        <text x={PUNKT.zuerich[0] + 12} y={PUNKT.zuerich[1] + 22} className="ort neben">{stadt("zuerich")}</text>
        <text x={PUNKT.miami[0]} y={PUNKT.miami[1] + 30} textAnchor="middle" className="ort">{stadt("miami")}</text>
      </svg>
      <ul className="fd-orte-liste">
        <li className="sie">
          <UhrMini zone={ZONE.sie} ort={ortName(ZONE.sie)} />
          <div>
            <b className="stadt">{f.orteSie}</b>
            <span className="land">{f.orteSieZusatz}</span>
          </div>
        </li>
        {GLOBAL_STANDORTE.map((o) => {
          const x = en ? o.en : o;
          const zone = o.schluessel === "london" ? ZONE.london : o.schluessel === "miami" ? ZONE.miami : null;
          return (
            <li key={o.schluessel} className={o.schluessel}>
              {zone ? <UhrMini zone={zone} ort={x.stadt} /> : <span className="fd-orte-ohne-uhr" aria-hidden="true" />}
              <div>
                <b className="stadt">{x.stadt}</b>
                <span className="land">{x.land}</span>
                <span className="ges">{o.gesellschaft}</span>
                <span className="rechtsform">{x.rechtsform}</span>
                <p className="rolle">{x.rolle}</p>
                <address>{o.adresse.map((z) => <span key={z}>{z}</span>)}</address>
                <span className="reg">{standortNachweis(o)}</span>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="fd-verbunden">{en ? GLOBAL_VERBUNDEN_EN : GLOBAL_VERBUNDEN}</p>
    </div>
  );
}

// ── Rollen: „Sie · FIAON · Partner“ ──────────────────────────────────────────
export function RollenDreieck({ sp }: { sp: Sp }) {
  const ref = useRef<SVGSVGElement>(null);
  useEinmalSichtbar(ref, 0.3);
  const [rFiaon, rPartner, rSie] = GLOBAL_SEITE_WORTE[sp].rollen;
  // Sie oben, FIAON links unten (gefüllt, die eine Stelle für Sie), Partner rechts unten; FIAON hält beide Linien.
  return (
    <svg ref={ref} className="fd-dreieck" viewBox="0 0 360 150" aria-hidden="true" focusable="false">
      <path d="M180 26 L70 116" className="kante fest" pathLength={1} />
      <path d="M70 116 L290 116" className="kante fest k2" pathLength={1} />
      <path d="M180 26 L290 116" className="kante leise" pathLength={1} />
      <circle cx="180" cy="26" r="7" className="knoten" />
      <circle cx="70" cy="116" r="9" className="knoten fiaon" />
      <circle cx="290" cy="116" r="7" className="knoten" />
      <text x="194" y="30" className="schrift">{rSie}</text>
      <text x="70" y="142" textAnchor="middle" className="schrift fiaon">{rFiaon}</text>
      <text x="290" y="142" textAnchor="middle" className="schrift">{rPartner}</text>
    </svg>
  );
}
