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
// GESTALT (E-510, Gestaltung Runde 2 — das Herzstück der Startseite: „keine Magie, eine Reihenfolge“):
//   · DIE BÜHNE (breite und hohe Bildschirme, Bewegung erlaubt): Der Abschnitt bleibt stehen, solange man durch die sechs
//     Schritte scrollt (position: sticky — die Seite scrollt ganz normal weiter, nichts wird festgehalten). Oben DIE REIHE:
//     eine blaue Linie füllt sich von Station zu Station. Darunter EIN Schritt im Bild: links eine große, dünne Ziffer, die
//     wie ein Zählwerk von 01 bis 06 rollt, Titel und Satz; rechts DIE AKTE als helle Glaskarte, deren Zeilen nacheinander
//     einrücken. Wer zurückscrollt, sieht dieselbe Bewegung rückwärts.
//   · DIE LISTE (Handy, kleine oder niedrige Fenster, „weniger Bewegung“, Druck, ohne JavaScript): alle Schritte
//     untereinander an der Schiene. Eine blaue Linie läuft mit dem Lesen von Nummer zu Nummer, erreichte Nummern füllen
//     sich. Passt der längste Schritt nicht in die Bühne, bleibt es bei der Liste.
//   · Je Schritt links, WAS WIR TUN (Titel und Satz), rechts DIE AKTE: Bedingung · Es entscheidet · Ihr Teil · Ihr Ergebnis —
//     der Entscheider mit einem blauen Punkt (sechsmal derselbe Platz: Man sieht auf einen Blick, dass an jedem Schritt
//     ein anderer entscheidet).
//
// AUFBAU (zugänglich, ohne Skript lesbar):
//   <section aria-labelledby> · Kopf mit h2 · <nav> mit der Reihe · <ol> mit einem <li value=Nummer> je Schritt · je
//   Schritt eine h3, der Satz als Absatz, die Akte als Beschreibungslisten (bei Schritt 5 darunter eine h4 mit dem Satz,
//   der gilt, wenn die Finanzierung ausbleibt). „Ihr Teil“ und „Ihr Ergebnis“ stehen auf breiten Bildschirmen immer offen
//   (reines CSS); am Handy liegen sie hinter einem Knopf und klappen weich auf — Titel, Satz und Bedingung bleiben dort
//   immer sichtbar (Leitfaden 2.1: auf kleinen Flächen dürfen „Ihr Teil“ und „Ihr Ergebnis“ fehlen, die Bedingung nie).
//
// BEWEGUNG: Der erste Auftritt läuft EINMAL, wenn ein Teil ins Bild kommt (Beobachter). Der Lauf der Linie und der Wechsel
// der Bühne folgen der Scroll-Lage: ein Lesevorgang je Bild (requestAnimationFrame), geschrieben werden nur zwei
// CSS-Variablen und ein Zustand — bewegt werden nur transform und opacity. Ohne JavaScript, im Druck und bei „weniger
// Bewegung“ steht alles sofort als Liste da. Alle sechs Schritte stehen immer im Dokument (Suchmaschine, Screenreader).
// Stil: styles/global-verkauf.css (Klassen .vk-sechs…) und styles/global-schritte-buehne.css, Maße aus global-tokens.css.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { SCHRITTE_KOPF, sechsSchritte, type SatzLand, type SatzSprache } from "@shared/fiaon-global-saetze";
import { ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import { useKinderEinmalSichtbar } from "@/components/site/global/VerkaufProdukt";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import "@/styles/global-tokens.css";
import "@/styles/global-verkauf.css";
import "@/styles/global-schritte-buehne.css";

/** Ab wann die Bühne trägt: breit genug für zwei Spalten, hoch genug für den längsten Schritt (dieselbe Abfrage steht im Stylesheet). */
const BUEHNE_AB = "screen and (min-width: 1100px) and (min-height: 640px)";
const zwei = (n: number) => String(n).padStart(2, "0");
const klemme = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

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
  const n = schritte.length;
  const ref = useRef<HTMLElement>(null);
  const reihe = useRef<HTMLElement>(null);
  const bahn = useRef<HTMLDivElement>(null);
  const buehneRef = useRef<HTMLDivElement>(null);
  const szene = useRef<HTMLDivElement>(null);
  const liste = useRef<HTMLOListElement>(null);
  useEinmalSichtbar(ref, 0, "0px 0px -22% 0px");
  useEinmalSichtbar(reihe, 0.6, "0px 0px -8% 0px");
  useKinderEinmalSichtbar(liste, "0px 0px -16% 0px");
  // Am Handy: welche Schritte „Ihr Teil“ und „Ihr Ergebnis“ zeigen (auf breiten Bildschirmen stehen sie immer offen).
  const [offen, setOffen] = useState<readonly number[]>([]);
  // Die Bühne trägt nur, wenn das Fenster breit und hoch genug ist und Bewegung erwünscht ist — sonst bleibt es die Liste.
  const [buehne, setBuehne] = useState(false);
  // Der Schritt, bei dem der Leser gerade ist (−1 = noch davor). Daraus: „vor“ · „aktiv“ · „nach“ je Schritt.
  const [aktiv, setAktiv] = useState(-1);
  /** Fenstergröße, bei der der längste Schritt nicht in die Bühne passte — dort bleibt die Liste, bis sich die Größe ändert. */
  const passtNicht = useRef("");

  const titelId = `${id}-titel`;
  const anker = (nr: number) => `${id}-schritt-${nr}`;
  const lage = (i: number) => (i < aktiv ? "vor" : i === aktiv ? "aktiv" : "nach");

  // 1) Bühne oder Liste? Dieselbe Abfrage wie im Stylesheet, dazu „weniger Bewegung“.
  useEffect(() => {
    if (n < 3 || typeof window.matchMedia !== "function") return;
    const gross = window.matchMedia(BUEHNE_AB);
    const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pruefen = () => setBuehne(gross.matches && !ruhig.matches && passtNicht.current !== `${window.innerWidth}x${window.innerHeight}`);
    pruefen();
    gross.addEventListener("change", pruefen);
    ruhig.addEventListener("change", pruefen);
    window.addEventListener("resize", pruefen);
    return () => { gross.removeEventListener("change", pruefen); ruhig.removeEventListener("change", pruefen); window.removeEventListener("resize", pruefen); };
  }, [n]);

  // 2) Passt der längste Schritt in die Bühne? Wenn nicht: Liste (nichts darf unter dem Bildrand unerreichbar liegen).
  useLayoutEffect(() => {
    const b = buehneRef.current, sz = szene.current;
    if (!buehne || !b || !sz) return;
    // Gemessen wird der Kasten der Szene (so hoch wie der längste Schritt) — nicht scrollHeight, das verschobene Teile mitzählt.
    const inhalt = sz.getBoundingClientRect().bottom - b.getBoundingClientRect().top;
    // Ohne Strecke keine Bühne: Kennt ein alter Browser das Maß der Bahn nicht, bliebe sonst Schritt 1 stehen.
    const strecke = (bahn.current?.offsetHeight ?? 0) - b.offsetHeight;
    if (inhalt > b.clientHeight + 1 || strecke < window.innerHeight) { passtNicht.current = `${window.innerWidth}x${window.innerHeight}`; setBuehne(false); }
  }, [buehne, sprache, land]);

  // 3) Der Lauf: Fortschritt und aktueller Schritt aus der Scroll-Lage — ein Lesevorgang je Bild.
  useEffect(() => {
    const sek = ref.current, b = bahn.current, st = buehneRef.current, sz = szene.current, ol = liste.current;
    if (!sek || !b || !st || !sz || !ol || ruhigGewuenscht()) return;
    let bild = 0;
    const messen = () => {
      bild = 0;
      if (buehne) {
        const oben = parseFloat(getComputedStyle(st).top) || 0;
        const r = b.getBoundingClientRect();
        const weg = r.height - st.offsetHeight;
        const p = weg > 0 ? klemme((oben - r.top) / weg, 0, 1) : 0;
        sek.style.setProperty("--f", String(n > 1 ? klemme((p * n - 0.5) / (n - 1), 0, 1) : 0));
        setAktiv(r.top < window.innerHeight * 0.72 ? Math.min(n - 1, Math.floor(p * n)) : -1);
        return;
      }
      // Liste: die Leselinie liegt etwas unter der Bildmitte; die blaue Linie reicht von der ersten Nummer bis dorthin.
      const linie = window.innerHeight * 0.58;
      const mitten = Array.from(ol.children, (li) => { const k = li.querySelector(".vk-sechs-punkt")?.getBoundingClientRect(); return k ? k.top + k.height / 2 : 0; });
      const y0 = mitten[0] ?? 0, yN = mitten[mitten.length - 1] ?? 0;
      sz.style.setProperty("--lauf-oben", `${Math.round(y0 - sz.getBoundingClientRect().top)}px`);
      sz.style.setProperty("--lauf-lang", `${Math.max(0, Math.round(yN - y0))}px`);
      sz.style.setProperty("--lauf", String(yN > y0 ? klemme((linie - y0) / (yN - y0), 0, 1) : 0));
      let i = -1;
      for (let k = 0; k < mitten.length; k++) if (mitten[k] <= linie) i = k;
      sek.style.setProperty("--f", String(n > 1 ? Math.max(0, i) / (n - 1) : 0));
      setAktiv(i);
    };
    const anstossen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    messen();
    window.addEventListener("scroll", anstossen, { passive: true });
    window.addEventListener("resize", anstossen);
    return () => { window.removeEventListener("scroll", anstossen); window.removeEventListener("resize", anstossen); if (bild) cancelAnimationFrame(bild); };
  }, [buehne, n]);

  /** Wohin die Seite scrollen muss, damit Schritt i (0 … n−1) auf der Bühne steht. */
  const buehnenLage = (i: number): number | null => {
    const b = bahn.current, st = buehneRef.current;
    if (!b || !st) return null;
    const oben = parseFloat(getComputedStyle(st).top) || 0;
    const r = b.getBoundingClientRect();
    return window.scrollY + r.top - oben + ((i + 0.5) / n) * (r.height - st.offsetHeight);
  };

  // 4) Wer mit einem Anker auf einen Schritt kommt (…#ablauf-schritt-3), landet auf der Bühne bei diesem Schritt.
  useEffect(() => {
    if (!buehne) return;
    const i = schritte.findIndex((s) => window.location.hash === `#${anker(s.nr)}`);
    const ziel = i >= 0 ? buehnenLage(i) : null;
    if (ziel !== null) window.scrollTo({ top: ziel, behavior: "auto" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buehne]);

  /** Eine Station der Reihe führt weich zu ihrem Schritt; der Schritt bekommt den Fokus (Tastatur und Screenreader). */
  const zumSchritt = (i: number, nr: number) => (ev: MouseEvent<HTMLAnchorElement>) => {
    const ziel = document.getElementById(anker(nr));
    if (!ziel) return;
    ev.preventDefault();
    const weich = ruhigGewuenscht() ? "auto" : "smooth";
    const top = buehne ? buehnenLage(i) : null;
    if (top !== null) window.scrollTo({ top, behavior: weich });
    else ziel.scrollIntoView({ behavior: weich, block: "start" });
    ziel.focus({ preventScroll: true });
  };

  return (
    <section className="fg-sek vk-ablauf vk-sechs-sek" id={id} ref={ref} aria-labelledby={titelId} data-buehne={buehne ? "1" : "0"}
      style={{ scrollMarginTop: 72, ["--n" as string]: String(n) } as CSSProperties}>
      <div className="fg-rahmen">
        <div className="fg-kopf">
          <div><span className="fg-auge">{kopf.auge}</span><h2 className="fg-h2" id={titelId}>{h2a} <em>{h2b}</em></h2></div>
          <p className="fg-lead">{W(kopf.lead)}</p>
        </div>

        {/* Die Bahn gibt der Bühne ihre Strecke (nur im Bühnen-Modus hoch); in der Liste sind Bahn und Bühne unsichtbare Hüllen. */}
        <div className="vk-sechs-bahn" ref={bahn}>
        <div className="vk-sechs-buehne" ref={buehneRef}>
        {/* Die Reihe: alle Schritte auf einer Linie — nur auf breiten Bildschirmen und nur, wenn es eine Reihe gibt. */}
        {n > 2 && (
          <nav className="vk-sechs-reihe" ref={reihe} aria-labelledby={titelId} style={{ ["--n" as string]: String(n) } as CSSProperties}>
            <ol>
              {schritte.map((s, i) => (
                <li key={s.nr} value={s.nr} data-lage={lage(i)} style={{ ["--i" as string]: String(i) } as CSSProperties}>
                  <a href={`#${anker(s.nr)}`} onClick={zumSchritt(i, s.nr)}>
                    <span className="vk-sechs-punkt" aria-hidden="true">{s.nr}</span>
                    <span className="vk-sechs-reihe-titel"><span className="vk-nur-sr">{kopf.spalten.schritt} {s.nr}: </span>{s.titel}</span>
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* Die Szene: die große Ziffer der Bühne (Schmuck), die Schritte, die mitlaufende Linie der Liste (Schmuck). */}
        <div className="vk-sechs-szene" ref={szene} data-da={aktiv >= 0 ? "1" : "0"}>
        <div className="vk-sechs-ziffer" aria-hidden="true">
          <span className="vk-sechs-fenster">
            <span className="vk-sechs-rolle" style={{ ["--a" as string]: String(Math.max(0, aktiv)) } as CSSProperties}>
              {schritte.map((s) => <b key={s.nr}>{zwei(s.nr)}</b>)}
            </span>
          </span>
          <i>/ {zwei(schritte[n - 1]?.nr ?? n)}</i>
        </div>
        {/* Die Schiene: je Schritt Nummer · was wir tun · die Akte. */}
        <ol className="vk-sechs" ref={liste}>
          {schritte.map((s, i) => {
            const auf = offen.includes(s.nr);
            const mehrId = `${id}-mehr-${s.nr}`;
            return (
              <li key={s.nr} value={s.nr} id={anker(s.nr)} tabIndex={-1} data-lage={lage(i)}>
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
        <span className="vk-sechs-lauf" aria-hidden="true" />
        </div>
        </div>
        </div>
        {zusatz && <p className="vk-sechs-zusatz">{W(zusatz)}</p>}
      </div>
    </section>
  );
}
