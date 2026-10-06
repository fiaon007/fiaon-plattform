// ═══════════════════════════════════════════════════════════════════════════
// DIE WEGLEISTE — VIER ETAPPEN ÜBER DEN PAKETTAFELN (06.10.2026, E-293)
//
// Vorher stand „Der Weg“ als eigener Abschnitt mit 183 Wörtern vor den Paketen;
// die Etappen standen damit dreifach auf der Seite (Weg, Balken je Tafel,
// Tabelle). Jetzt ist der Weg eine Linie über den Tafeln, die in Stufen steigt —
// I bis IV — und über den Mitten der drei Tafeln (II, III, IV) senkrecht ins
// Brett fällt: Man sieht, bis wohin ein Paket begleitet, ohne einen Absatz zu
// lesen. Dauer und Text jeder Etappe stehen im Popover des Knotens (im DOM,
// nicht gezählt); ab Etappe II trägt der Knoten das Zeichen „Hier entscheidet
// das Institut“.
//
// Linie als SVG (nur die Linie wird gedehnt), Knoten und Texte als HTML — scharf
// und übersetzbar. Am Handy dieselbe Leiste in vier gleichen Spalten; gefüllt
// sind die Etappen des gewählten Pakets (`bis`). Scheibe A: Objekte als
// Haarlinien-Platzhalter (GlobalObjekt).
//
// 06.10.2026 (E-293, Scheibe B) — die Bewegung, einmal beim Hineinscrollen:
// Die Linie zeichnet sich von links nach rechts (clip-path, 1,2 s); jeder Knoten
// rastet ein, sobald die Linie ihn erreicht (Ring wächst, füllt sich navy), das
// Objekt darüber steigt 80 ms später auf, die Karten der Kartenleiter treten
// nacheinander aus der Navy-Karte hervor, das Institut-Zeichen folgt Knoten II,
// zuletzt fallen die Haarlinien in die Tafeln. Gesamt ≈ 1,9 s, danach Ruhe.
// Die Zeitpunkte der Knoten (T_D, T_M) sind aus der Kurve --fg-ease-io
// zurückgerechnet: Bei x = 16,7 % ist die Linie nach 417 ms, bei 50 % nach
// 600 ms. Die Zeiten stehen als --td/--tm am Knoten, das CSS wählt je Breite.
//
// 06.10.2026 (E-293, Scheibe C): Über den Knoten liegen die freigestellten
// Higgsfield-Objekte (lib/global-bilder.ts) — Urkunde, Navy-Karte (mit einem
// Lichtstreif, nachdem sie hereingeglitten ist), die Kartenleiter als Stapel
// aus drei Bildern und das Term Sheet. Der KI-Bildnachweis steht EINMAL rechts
// außen an der Leiste, nicht je Objekt (die vier stehen in einem Blickfeld).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import GlobalObjekt, { type GlobalObjektArt, type GlobalBildQuelle } from "@/components/site/global/GlobalObjekt";
import { useEinmalSichtbar } from "@/components/site/global/bewegung";
import { GLOBAL_BILDER } from "@/lib/global-bilder";

const ROEMISCH = ["I", "II", "III", "IV"];
const OBJEKTE: GlobalObjektArt[] = ["urkunde", "karte", "karten", "termsheet"];
// Die Bilder je Etappe (Scheibe C). Kartenleiter: hinten → vorn, die Navy-Karte vorn wie in Etappe II.
const BILDER: { bild?: GlobalBildQuelle; stapel?: readonly GlobalBildQuelle[]; licht?: "bild" }[] = [
  { bild: GLOBAL_BILDER.urkunde },
  { bild: GLOBAL_BILDER.karteNavy, licht: "bild" },
  { stapel: [GLOBAL_BILDER.karteChampagner, GLOBAL_BILDER.karteGraphit, GLOBAL_BILDER.karteNavy] },
  { bild: GLOBAL_BILDER.termsheet },
];
// Anzeigebreite der Objekte (styles/global-grafik.css: höchstens 110 px) — für die Wahl im srcset.
const OBJEKT_GROESSE = 110;
// Desktop: Knoten auf der steigenden Linie (viewBox 1000 × 60), II–IV über den Tafelmitten.
const PUNKTE_D = [[6, 52], [167, 40], [500, 26], [833, 12]] as const;
const LINIE_D = "M0 52 L6 52 L167 52 L167 40 L500 40 L500 26 L833 26 L833 12 L1000 6";
// Handy: vier gleiche Spalten (viewBox 1000 × 30).
const PUNKTE_M = [[125, 24], [375, 18], [625, 12], [875, 6]] as const;
const LINIE_M = "M0 26 L125 24 L375 18 L625 12 L875 6 L1000 4";
// Wann die Linie (1.200 ms, cubic-bezier(.65,0,.35,1)) den Knoten erreicht — Desktop- und Vier-Spalten-Linie.
const T_D = [120, 417, 600, 783];
const T_M = [375, 546, 654, 825];

export interface WegEtappe { titel: string; dauer: string; text: ReactNode; abzeichen?: string }

export default function WegLinie({ id, etappen, label, stempel, bis = 4, mitObjekten = true, titelInhalt, klammer, nachweis }: {
  /** Anker (auf /business „ablauf“ — von außen verlinkt). */
  id?: string;
  etappen: WegEtappe[];
  /** aria-label der Leiste („Der Weg in vier Etappen“). */
  label: string;
  /** Tooltip/aria-label des Institut-Zeichens ab Etappe II. */
  stempel: string;
  /** Bis zu welcher Etappe das gewählte Paket begleitet (Handy: gefüllt, die anderen blass). */
  bis?: number;
  mitObjekten?: boolean;
  /** Titel mit antippbaren Begriffen (optional, sonst der reine Titel). */
  titelInhalt?: (i: number) => ReactNode;
  /** Die Klammer über I–II („In jedem Paket“). */
  klammer?: string;
  /** KI-Bildnachweis der Objekte, eine Zeile rechts außen („Abbildungen mit KI erstellt“). */
  nachweis?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEinmalSichtbar(ref);
  const [offen, setOffen] = useState<number | null>(null);

  useEffect(() => {
    if (offen === null) return;
    const weg = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOffen(null); };
    const taste = (e: KeyboardEvent) => { if (e.key === "Escape") setOffen(null); };
    document.addEventListener("pointerdown", weg);
    document.addEventListener("keydown", taste);
    return () => { document.removeEventListener("pointerdown", weg); document.removeEventListener("keydown", taste); };
  }, [offen]);

  return (
    <div ref={ref} id={id} className={`fg-wegleiste${mitObjekten ? " mit-objekten" : ""}`} role="group" aria-label={label} style={{ scrollMarginTop: 96 }}>
      <svg className="fg-weg-linie d" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
        <path d={LINIE_D} pathLength={1} />
      </svg>
      <svg className="fg-weg-linie m" viewBox="0 0 1000 30" preserveAspectRatio="none" aria-hidden="true">
        <path d={LINIE_M} pathLength={1} />
      </svg>
      {klammer && <span className="fg-weg-klammer"><span>{klammer}</span></span>}
      {mitObjekten && nachweis && <span className="fg-weg-nachweis">{nachweis}</span>}
      {etappen.map((e, i) => {
        const auf = offen === i;
        const stil = {
          "--xd": `${PUNKTE_D[i][0] / 10}%`, "--yd": `${PUNKTE_D[i][1]}px`,
          "--xm": `${PUNKTE_M[i][0] / 10}%`, "--ym": `${PUNKTE_M[i][1]}px`, "--i": i,
          "--td": `${T_D[i]}ms`, "--tm": `${T_M[i]}ms`,
        } as React.CSSProperties;
        return (
          <div key={e.titel} className={`fg-weg-knoten k${i + 1}${i < bis ? " an" : " aus"}${auf ? " offen" : ""}`} style={stil}>
            {mitObjekten && <GlobalObjekt art={OBJEKTE[i]} {...BILDER[i]} groesse={OBJEKT_GROESSE} className="fg-weg-objekt" />}
            <button type="button" className="fg-weg-punkt" aria-expanded={auf} aria-controls={`${id ?? "weg"}-pop-${i}`}
              aria-label={`${ROEMISCH[i]} · ${e.titel}`} onClick={() => setOffen(auf ? null : i)}>
              <span aria-hidden="true">{ROEMISCH[i]}</span>
            </button>
            {i > 0 && (
              <span className="fg-weg-stempel" role="img" aria-label={stempel} title={stempel}>
                <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
                  <path d="M1.5 5.2 7 2l5.5 3.2M2.5 5.6h9M3.6 6.4v4.4M7 6.4v4.4M10.4 6.4v4.4M2 11.6h10M1.5 12.8h11" />
                </svg>
              </span>
            )}
            <span className="fg-weg-titel">{titelInhalt ? titelInhalt(i) : e.titel}</span>
            {e.abzeichen && <span className="fg-weg-abzeichen">{e.abzeichen}</span>}
            {i > 0 && <span className="fg-weg-fall" aria-hidden="true" />}
            <div id={`${id ?? "weg"}-pop-${i}`} className="fg-weg-pop" role="region" aria-label={e.titel} hidden={!auf}>
              <b>{e.dauer}</b>
              <p>{e.text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
