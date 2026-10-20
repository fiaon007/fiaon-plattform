// ═══════════════════════════════════════════════════════════════════════════
// DIE VIER ETAPPEN ÜBER DEN PAKETTAFELN (E-387, neu gebaut 20.10.2026)
//
// Justin, 20.10.2026 (Bild von /en/business): „Entferne die 3D Projekte, die
// sehen total beschissen aus“ und „Mach es cleaner, mit Animationen und mit
// ausklappbaren Karten oder so, damit nicht so viel Text ist bitte“.
//
// Seitdem: vier ruhige Karten I–IV an einer feinen Linie — kein three.js, kein
// Canvas, keine Schatten-Ellipsen (etappen-szene.ts ist gelöscht). Sichtbar je
// Karte nur Abzeichen („In jedem Paket“ / „Ab …“), Titel, EIN Satz (`kurz`)
// und ab Etappe II „Hier entscheidet das Institut“. Ablauf und Dauer, der
// lange Text und wer dabei ist (nur Namen — „keine Icons“) stehen in der
// Klappe hinter „Mehr“. Die Texte selbst kommen unverändert aus i18n/global.ts.
//
// Rechner (ab 1024 px): oben die Linie mit den Knoten I–IV, darunter die vier
// Karten gleich hoch, darunter EINE Klappe über die volle Breite — dort liest
// sich der lange Text in zwei, drei Zeilen statt in einer schmalen Spalte.
// Immer nur eine Etappe offen; ein Zipfel zeigt auf ihre Karte. Technik: Die
// Hüllen sind dort `display: contents`, damit Knoten, Karten und Klappen
// Zellen EINES Rasters sind (Reihe 1 Linie, 2 Karten, 3 Klappe).
// Bis 1023 px: die Karten untereinander, die Linie läuft links senkrecht von
// Knoten zu Knoten, jede Karte klappt in sich auf (unabhängig voneinander).
// Am Handy (bis 720 px) werden Etappen außerhalb des gewählten Pakets blass
// (`bis`), wie bisher.
//
// Bewegung (bewegung.ts, einmal beim Hineinscrollen): die Linie zeichnet sich
// von I nach IV, die Knoten leuchten nacheinander auf, die Karten kommen
// gestaffelt (Einblenden + kleiner Weg nach oben). Hover: leichter Hub und die
// Lichtkante der Pakettafeln. Auf- und Zuklappen: Höhe über grid-template-rows.
// Bei „weniger Bewegung“ steht alles sofort im Endzustand, ohne Übergänge.
// Stil: styles/global-grafik.css, Block „DIE VIER ETAPPEN“ (Präfix fg-eb-).
//
// Das Navy-Band „Ihr Team im Festpreis“ bleibt: Namen sichtbar (der Zusatz
// „Global VIP“ steht immer am Namen), was jeder tut, klappt mit „Mehr“ auf;
// der Partnersatz (Mandat, Honorare trägt FIAON) steht immer offen da.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";

const ROEMISCH = ["I", "II", "III", "IV"];
/** Ab hier stehen die Karten nebeneinander und teilen sich EINE Klappe — dieselbe Grenze wie im Stilblatt. */
const BREIT = "(min-width: 1024px)";
/** Am Handy werden Etappen außerhalb des gewählten Pakets blass (dort wählt man darunter ein Paket). */
const HANDY = "(max-width: 720px)";
/** So lange dauert das Aufklappen im Stilblatt (.fg-eb-klappe) — danach dürfen Begriff-Erklärungen über den Rand. */
const AUFKLAPPEN_MS = 560;

const passt = (abfrage: string) => typeof window !== "undefined" && !!window.matchMedia?.(abfrage).matches;

export interface BuehnenEtappe {
  titel: string;
  /** Titel mit antippbaren Begriffen (optional). */
  titelInhalt?: ReactNode;
  kurz: string;
  leute: string[];
  /** „In jedem Paket“ bzw. „Ab Global Banking“. */
  abzeichen: string;
  /** Ab Etappe II: Hier entscheidet das Institut. */
  institut: boolean;
  dauer: string;
  text: ReactNode;
}

/** Der Winkel an „Mehr“: selbst gezeichnet, 1,5 px Strich, currentColor (AGENTS.md). */
function Winkel() {
  return (
    <svg className="fg-eb-winkel" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4.5 6 7.5 9 4.5" />
    </svg>
  );
}

/** „Mehr“ / „Weniger“ übereinander, sichtbar ist eins: Der Knopf ist immer so breit wie das längere Wort — so rutscht
 *  er beim Aufklappen nicht in die nächste Zeile. Das verdeckte Wort ist unsichtbar und zählt nicht zum Namen. */
function Wort({ auf, mehr, weniger }: { auf: boolean; mehr: string; weniger: string }) {
  return (
    <span className="fg-eb-wort">
      <span className={auf ? "weg" : undefined}>{mehr}</span>
      <span className={auf ? undefined : "weg"}>{weniger}</span>
    </span>
  );
}

export default function EtappenBuehnen({ id, label, etappen, bis = 4, stempel, ablauf, mehr, weniger, team }: {
  id?: string;
  label: string;
  etappen: BuehnenEtappe[];
  /** Bis zu welcher Etappe das gewählte Paket begleitet (Handy: die übrigen blass). */
  bis?: number;
  /** „Hier entscheidet das Institut“. */
  stempel: string;
  /** Überschrift in der Klappe: „Ablauf und Dauer“. */
  ablauf: string;
  /** Beschriftung der Klappen-Knöpfe: „Mehr“ / „Weniger“. */
  mehr: string;
  weniger: string;
  team: { titel: string; sub: string; satz: string; liste: { name: string; was: string; zusatz?: string }[] };
}) {
  const wurzel = useRef<HTMLDivElement>(null);
  const klappen = useRef<(HTMLDivElement | null)[]>([]);
  const gehtUhr = useRef(0);
  const kennung = useId();
  /** Welche Etappen offen sind — am Rechner höchstens eine. */
  const [offen, setOffen] = useState<number[]>([]);
  /** Am Rechner beim Wechsel: die bisher offene Etappe klappt erst zu, wenn die neue steht (sonst „atmet“ die Klappe). */
  const [geht, setGeht] = useState<number | null>(null);
  const [teamAuf, setTeamAuf] = useState(false);
  const [breit, setBreit] = useState(() => passt(BREIT));
  const [handy, setHandy] = useState(() => passt(HANDY));
  /** Der Auftritt ist durch (das Band kam als Letztes) — danach hängt keine Einblend-Animation mehr an den Elementen,
   *  sonst spielte ein Wechsel über 1024 px (Fenster ziehen, Tablet drehen) den Auftritt noch einmal ab. */
  const [aufgetreten, setAufgetreten] = useState(false);
  useEinmalSichtbar(wurzel, 0, "0px 0px -18% 0px");

  useEffect(() => {
    const mqBreit = window.matchMedia?.(BREIT);
    const mqHandy = window.matchMedia?.(HANDY);
    if (!mqBreit || !mqHandy) return;
    const neu = () => {
      setBreit(mqBreit.matches);
      setHandy(mqHandy.matches);
      // Am Rechner teilen sich alle Karten EINE Klappe: Waren am Handy mehrere offen, bleibt die zuletzt geöffnete.
      if (mqBreit.matches) setOffen((o) => o.slice(-1));
    };
    mqBreit.addEventListener?.("change", neu);
    mqHandy.addEventListener?.("change", neu);
    return () => { mqBreit.removeEventListener?.("change", neu); mqHandy.removeEventListener?.("change", neu); };
  }, []);

  useEffect(() => () => window.clearTimeout(gehtUhr.current), []);

  // Begriff-Erklärungen in einer offenen Klappe dürfen über ihren Rand hinaus — aber erst, wenn das Aufklappen fertig
  // ist (vorher schneidet overflow: hidden die Höhe zu). Beim Zuklappen wird sofort wieder abgeschnitten, vor dem Bild.
  useLayoutEffect(() => {
    const uhren: number[] = [];
    klappen.current.forEach((el, i) => {
      if (!el) return;
      if (!offen.includes(i)) { el.removeAttribute("data-fertig"); return; }
      if (el.hasAttribute("data-fertig")) return;
      uhren.push(window.setTimeout(() => el.setAttribute("data-fertig", ""), ruhigGewuenscht() ? 0 : AUFKLAPPEN_MS));
    });
    return () => uhren.forEach((u) => window.clearTimeout(u));
  }, [offen]);

  const umschalten = (i: number) => {
    const war = offen.includes(i);
    window.clearTimeout(gehtUhr.current);
    if (!breit) {
      setGeht(null);
      setOffen((o) => (war ? o.filter((x) => x !== i) : [...o, i]));
      return;
    }
    const vorher = offen[0];
    const wechsel = !war && vorher !== undefined && vorher !== i;
    setOffen(war ? [] : [i]);
    setGeht(wechsel ? vorher : null);
    if (wechsel) gehtUhr.current = window.setTimeout(() => setGeht(null), 1100);
  };

  /** Ein Klick irgendwo auf die Karte klappt — außer auf eigene Knöpfe (Mehr, Begriffe) und beim Markieren von Text. */
  const kartenKlick = (i: number) => (e: React.MouseEvent<HTMLElement>) => {
    if (e.detail > 1) return;
    if ((e.target as Element).closest("a,button,input,select,textarea,label,[role='tooltip'],.fg-begriff-rahmen")) return;
    if (window.getSelection && !window.getSelection()?.isCollapsed) return;
    umschalten(i);
  };

  const teamKnopf = `${kennung}-team-knopf`;
  const teamTitel = `${kennung}-team-titel`;
  const teamListe = `${kennung}-team-liste`;

  return (
    <div ref={wurzel} id={id} className={`fg-eb${aufgetreten ? " aufgetreten" : ""}`} role="group" aria-label={label} data-fiaon="etappen" style={{ scrollMarginTop: 96 }}>
      <div className={`fg-eb-reihe${breit && offen.length ? " mit-klappe" : ""}`}>
        {etappen.map((e, i) => {
          const auf = offen.includes(i);
          const an = !handy || i < bis;
          const titelId = `${kennung}-titel-${i}`;
          const knopfId = `${kennung}-knopf-${i}`;
          const klappeId = `${kennung}-klappe-${i}`;
          return (
            <div key={e.titel} className={`fg-eb-etappe${an ? "" : " aus"}${auf ? " auf" : ""}`} style={{ "--i": i, "--spalte": i + 1 } as React.CSSProperties}>
              <div className="fg-eb-spur" aria-hidden="true"><span className="fg-eb-knoten">{ROEMISCH[i]}</span></div>
              <div className="fg-eb-huelle">
                <div className="fg-eb-karte" onClick={kartenKlick(i)}>
                  <span className={`fg-eb-ab${i < 2 ? " jedes" : ""}`}>{e.abzeichen}</span>
                  <h3 className="fg-eb-titel" id={titelId}>{e.titelInhalt ?? e.titel}</h3>
                  <p className="fg-eb-kurz">{e.kurz}</p>
                  <div className="fg-eb-fuss">
                    {e.institut && <span className="fg-eb-institut">{stempel}</span>}
                    <button type="button" id={knopfId} className="fg-eb-mehr" aria-expanded={auf} aria-controls={klappeId}
                      aria-labelledby={`${knopfId} ${titelId}`} onClick={() => umschalten(i)}>
                      <Wort auf={auf} mehr={mehr} weniger={weniger} />
                      <span className="fg-eb-mehr-kreis"><Winkel /></span>
                    </button>
                  </div>
                </div>
                <div ref={(el) => { klappen.current[i] = el; }} id={klappeId} data-fiaon="etappe-klappe"
                  className={`fg-eb-klappe${auf ? " auf" : ""}${geht === i ? " geht" : ""}`}>
                  <div className="fg-eb-klappe-innen">
                    <div className="fg-eb-klappe-inhalt">
                      <div className="fg-eb-ablauf">
                        <span className="fg-eb-ablauf-titel">{ablauf}</span>
                        <b className="fg-eb-dauer">{e.dauer}</b>
                        <p className="fg-eb-text">{e.text}</p>
                      </div>
                      <ul className="fg-eb-leute">{e.leute.map((l) => <li key={l}>{l}</li>)}</ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`fg-eb-team${teamAuf ? " auf" : ""}`} data-fiaon="team-band"
        onAnimationEnd={(e) => { if (e.target === e.currentTarget && e.animationName === "fg-eb-rein") setAufgetreten(true); }}>
        <div className="fg-eb-team-kopf">
          <b id={teamTitel}>{team.titel}</b>
          <span>{team.sub}</span>
          <button type="button" id={teamKnopf} className="fg-eb-team-mehr" aria-expanded={teamAuf} aria-controls={teamListe}
            aria-labelledby={`${teamKnopf} ${teamTitel}`} onClick={() => setTeamAuf((a) => !a)}>
            <Wort auf={teamAuf} mehr={mehr} weniger={weniger} /><Winkel />
          </button>
        </div>
        <div className="fg-eb-team-rumpf">
          <ul className="fg-eb-team-liste" id={teamListe}>
            {team.liste.map((x) => (
              <li key={x.name}>
                <b>{x.name}{x.zusatz ? <em> · {x.zusatz}</em> : null}</b>
                <span className="fg-eb-team-was"><span>{x.was}</span></span>
              </li>
            ))}
          </ul>
          <p className="fg-eb-team-satz">{team.satz}</p>
        </div>
      </div>
    </div>
  );
}
