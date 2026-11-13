// ═══════════════════════════════════════════════════════════════════════════
// DIE SECHS SCHRITTE — „Sechs Schritte. Jeder mit seiner Bedingung.“ (Register E-510, 13.11.2026)
//
// Justin (12.11.2026): „keine Magie, sondern knallharte Fakten“ — und seine Reihenfolge: Gründung → Unterlagen → Konten →
// Kreditkarten auf Wunsch → Finanzierung → Umschuldung und Aufstockung. Der Baustein ersetzt „Vier Schritte. Kein Hexenwerk.“
//
// Jeder Schritt zeigt seine vier festen Teile (Sprachleitfaden 2.1): der Satz („Was wir tun“) · die Bedingung · Ihr Teil ·
// Ihr Ergebnis — dazu, wer entscheidet. Der Satz steht nie ohne seine Bedingung im selben Blick. Schritt 5 trägt den Satz,
// der gilt, wenn die Finanzierung ausbleibt — er gehört zu diesem Schritt und nur dorthin.
//
// WOHER DIE SÄTZE KOMMEN: aus shared/fiaon-global-saetze.ts (sechsSchritte, SCHRITTE_KOPF) — hier wird kein Wortlaut getippt.
// Mit `land` zeigt der Baustein die Fassung einer Länderseite: Schweiz Schritt 1, 2, 5, 6 (mit ihren festen Nummern) und den
// einen Satz für den Fließtext; Österreich nur Schritt 1 und 2, danach „Ihr weiteres Vorhaben besprechen wir persönlich.“
//
// GESTALT (E-510, Gestaltung — das Herzstück der Startseite: „keine Magie, eine Reihenfolge“):
//   · Oben, auf breiten Bildschirmen: DIE REIHE — alle Schritte auf einer feinen blauen Linie, die sich einmal von links
//     nach rechts zeichnet; jede Nummer erscheint, wenn die Linie sie erreicht. Jede Station führt zu ihrem Schritt.
//   · Darunter: DIE SCHIENE — dieselbe Linie läuft senkrecht durch die Nummern (am Handy genauso). Kommt ein Schritt ins
//     Bild, erscheint seine Nummer, sein Satz gleitet nach, die Zeilen seiner Akte folgen an Haarlinien, und die Linie
//     zeichnet sich weiter bis zum nächsten Schritt.
//   · Je Schritt links, WAS WIR TUN (Titel und Satz), rechts DIE AKTE: Bedingung · Es entscheidet · Ihr Teil · Ihr Ergebnis —
//     jede Zeile an ihrer Haarlinie, der Entscheider mit einem blauen Punkt (sechsmal derselbe Platz: Man sieht auf einen
//     Blick, dass an jedem Schritt ein anderer entscheidet).
//
// AUFBAU (zugänglich, ohne Skript lesbar):
//   <section aria-labelledby> · Kopf mit h2 · <nav> mit der Reihe · <ol> mit einem <li value=Nummer> je Schritt · je
//   Schritt eine h3, der Satz als Absatz, die Akte als Beschreibungslisten (bei Schritt 5 darunter eine h4 mit dem Satz,
//   der gilt, wenn die Finanzierung ausbleibt). „Ihr Teil“ und „Ihr Ergebnis“ stehen auf breiten Bildschirmen immer offen
//   (reines CSS); am Handy liegen sie hinter einem Knopf und klappen weich auf — Titel, Satz und Bedingung bleiben dort
//   immer sichtbar (Leitfaden 2.1: auf kleinen Flächen dürfen „Ihr Teil“ und „Ihr Ergebnis“ fehlen, die Bedingung nie).
//
// BEWEGUNG: Jede Bewegung läuft EINMAL, wenn ihr Teil ins Bild kommt (Beobachter, nie an die Scrollposition gekoppelt) —
// nur transform und opacity. Ohne JavaScript, im Druck und bei „weniger Bewegung“ steht alles sofort.
// Stil: styles/global-verkauf.css (Klassen .vk-sechs…), Maße aus styles/global-tokens.css.
// ═══════════════════════════════════════════════════════════════════════════
import { useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { SCHRITTE_KOPF, sechsSchritte, type SatzLand, type SatzSprache } from "@shared/fiaon-global-saetze";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { useKinderEinmalSichtbar } from "@/components/site/global/VerkaufProdukt";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import "@/styles/global-tokens.css";
import "@/styles/global-verkauf.css";

/** Die Überschrift aus zwei kurzen Teilen („Sechs Schritte. Jeder mit seiner Bedingung.“) in ihre zwei Hälften. */
function zweiTeile(h2: string): [string, string] {
  const t = h2.split(/(?<=\.)\s+/);
  return [t[0] ?? h2, t.slice(1).join(" ")];
}

export default function GlobalSchritte({ sprache, land = "DE", id = "ablauf", mehr }: {
  sprache: SatzSprache;
  /** Für welche Seite: „CH“ und „AT“ zeigen die Fassung der Länderseite (satzLand(pfad) aus shared/fiaon-global-saetze). */
  land?: SatzLand;
  /** Anker des Abschnitts. */
  id?: string;
  /** Beschriftung des Knopfs für „Ihr Teil“ und „Ihr Ergebnis“ am Handy (VERKAUF_TEXTE[s].ablauf.mehr). */
  mehr: string;
}) {
  const kopf = SCHRITTE_KOPF[sprache];
  const { schritte, zusatz } = sechsSchritte(sprache, land);
  const [h2a, h2b] = zweiTeile(kopf.h2);
  const ref = useRef<HTMLElement>(null);
  const reihe = useRef<HTMLElement>(null);
  const liste = useRef<HTMLOListElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -22% 0px");
  useEinmalSichtbar(reihe, 0.6, "0px 0px -8% 0px");
  useKinderEinmalSichtbar(liste, "0px 0px -16% 0px");
  // Am Handy: welche Schritte „Ihr Teil“ und „Ihr Ergebnis“ zeigen (auf breiten Bildschirmen stehen sie immer offen).
  const [offen, setOffen] = useState<readonly number[]>([]);

  const titelId = `${id}-titel`;
  const anker = (nr: number) => `${id}-schritt-${nr}`;
  /** Eine Station der Reihe führt weich zu ihrem Schritt; der Schritt bekommt den Fokus (Tastatur und Screenreader). */
  const zumSchritt = (nr: number) => (ev: MouseEvent<HTMLAnchorElement>) => {
    const ziel = document.getElementById(anker(nr));
    if (!ziel) return;
    ev.preventDefault();
    ziel.scrollIntoView({ behavior: ruhigGewuenscht() ? "auto" : "smooth", block: "start" });
    ziel.focus({ preventScroll: true });
  };

  return (
    <section className="fg-sek vk-ablauf vk-sechs-sek" id={id} ref={ref} aria-labelledby={titelId} style={{ scrollMarginTop: 72 }}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{kopf.auge}</span><h2 className="fg-h2" id={titelId}>{h2a} <em>{h2b}</em></h2></div>
          <p className="fg-lead">{W(kopf.lead)}</p>
        </div>

        {/* Die Reihe: alle Schritte auf einer Linie — nur auf breiten Bildschirmen und nur, wenn es eine Reihe gibt. */}
        {schritte.length > 2 && (
          <nav className="vk-sechs-reihe" ref={reihe} aria-labelledby={titelId} style={{ ["--n" as string]: String(schritte.length) } as CSSProperties}>
            <ol>
              {schritte.map((s, i) => (
                <li key={s.nr} value={s.nr} style={{ ["--i" as string]: String(i) } as CSSProperties}>
                  <a href={`#${anker(s.nr)}`} onClick={zumSchritt(s.nr)}>
                    <span className="vk-sechs-punkt" aria-hidden="true">{s.nr}</span>
                    <span className="vk-sechs-reihe-titel"><span className="vk-nur-sr">{kopf.spalten.schritt} {s.nr}: </span>{s.titel}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Die Schiene: je Schritt Nummer · was wir tun · die Akte. */}
        <ol className="vk-sechs" ref={liste}>
          {schritte.map((s) => {
            const auf = offen.includes(s.nr);
            const mehrId = `${id}-mehr-${s.nr}`;
            return (
              <li key={s.nr} value={s.nr} id={anker(s.nr)} tabIndex={-1}>
                <span className="vk-sechs-punkt" aria-hidden="true">{s.nr}</span>
                <div className="vk-sechs-was">
                  <h3><span className="vk-nur-sr">{kopf.spalten.schritt} {s.nr}: </span>{s.titel}</h3>
                  <p className="vk-sechs-satz">{W(s.satz)}</p>
                </div>
                <div className="vk-sechs-akte">
                  <dl className="vk-sechs-fest">
                    <div><dt>{kopf.teile.bedingung}</dt><dd>{W(s.bedingung)}</dd></div>
                    <div className="entscheidet"><dt>{kopf.spalten.entscheidet}</dt><dd>{s.entscheidet}</dd></div>
                  </dl>
                  <button type="button" className="vk-sechs-knopf" aria-expanded={auf} aria-controls={mehrId}
                    onClick={() => setOffen((alt) => (alt.includes(s.nr) ? alt.filter((n) => n !== s.nr) : [...alt, s.nr]))}>
                    {mehr}<i aria-hidden="true" />
                  </button>
                  <div className="vk-sechs-mehr" id={mehrId} data-auf={auf ? "1" : "0"}>
                    <div>
                      <dl>
                        <div><dt>{kopf.teile.ihrTeil}</dt><dd>{W(s.ihrTeil)}</dd></div>
                        <div><dt>{kopf.teile.ihrErgebnis}</dt><dd>{W(s.ihrErgebnis)}</dd></div>
                      </dl>
                    </div>
                  </div>
                  {s.ausbleiben && (
                    <div className="vk-sechs-folge">
                      <h4>{s.ausbleiben.titel}</h4>
                      <p>{W(s.ausbleiben.text)}</p>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {zusatz && <p className="vk-sechs-zusatz">{W(zusatz)}</p>}
      </div>
    </section>
  );
}
