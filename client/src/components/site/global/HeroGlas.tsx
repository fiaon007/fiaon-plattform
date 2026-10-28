// ═══════════════════════════════════════════════════════════════════════════
// DIE GLAS-BÜHNE — der Hero von /business (E-442, 27.10.2026)
//
// Justin (27.10., mit dem Bild des Chefbüro-Sperrbildschirms): „Wir brauchen
// Apple Glas, Animationen, clean — mehr Abstände — mehr WOW — baue es im Apple
// Stil, wie hier die Zahlen in unserem Admin-Dashboard.“ Und direkt danach:
// „aber nicht mit dem Berg-Hintergrund — CLEAN!“
//
// Also: kein Film, kein Foto. Die Bühne ist der helle, ruhige Glasgrund der
// Seite selbst — eine kleine Zeile, EINE riesige dünne Zahl mit Glanz (der
// Festpreis „ab 2.499 €“), darunter in Kapitälchen der Satz dazu (einmalig,
// alle Gebühren des Pakets inklusive), die Überschrift dünn, zwei Pillen,
// drei Milchglas-Widgets: Kapitalrahmen (mit „das Institut entscheidet“,
// Blickfang-Regel), der echte Ansprechpartner (VISITENKARTEN) und die
// Vertrauensleiste als Vertrag-Widget. Alle Sätze kommen aus i18n/global.ts —
// die Wortwand liest sie dort; hier steht kein eigener deutscher Satz.
//
// Auftakt erst nach dem Ladebildschirm (nachLadebild), gestaffelt; danach
// steht alles — nur der Glanz zieht alle neun Sekunden über die Zahl.
// Bei „weniger Bewegung“ steht sofort das Endbild.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { beobachteSichtbar, nachLadebild, ruhigGewuenscht } from "@/components/site/global/bewegung";
import { VISITENKARTEN } from "@shared/fiaon-visitenkarte";
import "@/styles/global-hero-glas.css";

export interface HeroGlasTexte {
  /** Die kleine Zeile über der Zahl (die Augenzeile der Seite, ggf. mit Link). */
  auge: ReactNode;
  /** „ab“ */
  ab: string;
  /** „2.499 €“ (aus dem Katalog) */
  preis: string;
  /** Der Satz zur Zahl, in Kapitälchen: „Festpreis · Einmalig, alle Gebühren des Pakets inklusive“ */
  label: string;
  h1a: string;
  h1b: string;
  /** Die Sätze, die sich in der zweiten Zeile selbst tippen (ohne: h1b steht still). */
  wechsel?: string[];
  /** Der Lead-Satz der Seite (mit antippbaren Begriffen). */
  lead: ReactNode;
  knopfPakete: string;
  knopfGespraech: string;
  mikro: string;
  kapitalTitel: string;
  kapitalWert: string;
  kapitalSatz: string;
  /** „Auch in Europa einsetzbar“ mit Fußnotennummer */
  kapitalFrei: string;
  fussnoteNr: number;
  fussnote: string;
  personTitel: string;
  /** Vier Zeilen der Vertrauensleiste; die zweite verlinkt den Mustervertrag. */
  vertrag: string[];
  mustervertragHref: string;
  /** Beschriftung des Winkels nach unten (aria-label). */
  weiter: string;
}

/** Wie viele Zeichen zwei Sätze vorn teilen — „Ihr Weg “ bleibt stehen, nur der Rest wird gelöscht und neu getippt. */
function gemeinsam(a: string, b: string) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

/**
 * DIE TIPP-ZEILE (E-442, 28.10.2026) — Justin: „Den Weg zum Kapital planen. — da muss eine Animation her, mit Tipp-Animation:
 * ‚Ihr Weg zum Kapital‘, ‚Ihr Weg zur US-Gesellschaft‘, ‚Ihr Weg in das US-Finanzsystem‘ …“
 * Ablauf: Satz steht 2,6 s → nur der Teil hinter dem gemeinsamen Anfang wird gelöscht (28 ms je Zeichen) → kurze Pause →
 * der nächste Satz tippt sich (52 ms je Zeichen, leicht unregelmäßig wie von Hand). Der Strich blinkt nur, solange der Satz steht.
 * Die Zeile reserviert ihren Platz mit allen Sätzen unsichtbar übereinander — nichts darunter springt.
 * Läuft nur, wenn die Bühne im Bild und der Tab vorn ist; bei „weniger Bewegung“ steht der erste Satz still, ohne Strich.
 * Für Screenreader und Suchmaschinen steht die ruhige Fassung (h1b) unsichtbar in der Überschrift; die Tipp-Zeile ist aria-hidden.
 */
function TippZeile({ saetze, startbereit }: { saetze: string[]; startbereit: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [stand, setStand] = useState({ i: 0, n: saetze[0]?.length ?? 0, tippt: false });
  useEffect(() => {
    const el = ref.current;
    if (!el || !startbereit || saetze.length < 2 || ruhigGewuenscht()) return;
    let i = 0, n = saetze[0].length, modus: "halten" | "loeschen" | "pause" | "tippen" = "halten";
    let uhr = 0, sichtbar = false;
    const zeigen = (tippt: boolean) => setStand({ i, n, tippt });
    const plan = (ms: number) => { uhr = window.setTimeout(() => { uhr = 0; schritt(); }, ms); };
    const schritt = () => {
      if (!sichtbar) return;
      const naechster = (i + 1) % saetze.length;
      const bis = gemeinsam(saetze[i], saetze[naechster]);
      if (modus === "halten") { modus = "loeschen"; zeigen(false); plan(2600); return; }
      if (modus === "loeschen") {
        if (n > bis) { n--; zeigen(true); plan(28); return; }
        modus = "pause"; plan(360); return;
      }
      if (modus === "pause") { i = naechster; modus = "tippen"; zeigen(true); plan(90); return; }
      const satz = saetze[i];
      if (n < satz.length) { n++; zeigen(true); plan(satz[n - 1] === " " ? 90 : 40 + ((n * 37) % 30)); return; }
      modus = "halten"; zeigen(false); schritt();
    };
    const weg = beobachteSichtbar(el, (s) => {
      sichtbar = s;
      if (!s) { window.clearTimeout(uhr); uhr = 0; return; }
      if (!uhr) schritt();
    });
    return () => { weg(); window.clearTimeout(uhr); };
  }, [saetze, startbereit]);
  // „Ihr Weg “ steht ruhig in Navy, nur das wechselnde Ende leuchtet in Glasblau.
  const fest = saetze.reduce((p, s) => Math.min(p, gemeinsam(saetze[0], s)), saetze[0]?.length ?? 0);
  const text = (saetze[stand.i] ?? "").slice(0, stand.n);
  return (
    <span ref={ref} className="hg-tipp" aria-hidden="true">
      {saetze.map((s) => <span key={s} className="hg-tipp-mass">{s}</span>)}
      <span className="hg-tipp-text">
        <span className="fest">{text.slice(0, fest)}</span><span className="wechsel">{text.slice(fest)}</span>
        <i className={`hg-tipp-strich${stand.tippt ? "" : " blinkt"}`} />
      </span>
    </span>
  );
}

function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function HeroGlas({ t, en, onPakete, onGespraech }: { t: HeroGlasTexte; en: boolean; onPakete: () => void; onGespraech: () => void }) {
  const [an, setAn] = useState(false);
  const person = VISITENKARTEN.daniel;

  useLayoutEffect(() => {
    if (ruhigGewuenscht()) { setAn(true); return; }
    let raf = 0;
    const weg = nachLadebild(() => { raf = requestAnimationFrame(() => setAn(true)); });
    return () => { weg(); cancelAnimationFrame(raf); };
  }, []);

  const sp = en ? "en" : "de";
  return (
    <section className="hg" data-an={an ? "1" : "0"}>
      <div className="hg-licht" aria-hidden="true" />
      <div className="hg-inhalt">
        <p className="hg-auge">{t.auge}</p>
        {/* Kein aria-label auf <p> (für die Rolle „paragraph“ verboten) und kein aria-hidden am „ab“: Screenreader lesen „ab 2.499 €“ wie alle. */}
        <p className="hg-zahl"><span className="hg-zahl-ab">{t.ab} </span>{t.preis}</p>
        <p className="hg-label">{t.label}</p>
        {t.wechsel && t.wechsel.length > 1 ? (
          <h1 className="hg-h1">{t.h1a} <span className="hg-sr">{t.h1b}</span><TippZeile saetze={t.wechsel} startbereit={an} /></h1>
        ) : (
          <h1 className="hg-h1">{t.h1a} <em>{t.h1b}</em></h1>
        )}
        {/* Der eine Satz, was im Festpreis steckt — mit den antippbaren Begriffen EIN und ITIN (Prüfung 27.10.: ging mit dem alten Hero verloren). */}
        <p className="hg-lead">{t.lead}</p>
        <div className="hg-pillen">
          <button type="button" className="hg-pille voll" onClick={onPakete}>{t.knopfPakete}<Pfeil /></button>
          <button type="button" className="hg-pille" style={{ ["--i" as string]: 1 }} onClick={onGespraech}>{t.knopfGespraech}</button>
        </div>
        <p className="hg-mikro">{t.mikro}</p>

        <div className="hg-widgets">
          <div className="hg-widget" style={{ ["--i" as string]: 0 }}>
            <span className="hg-w-auge">{t.kapitalTitel}</span>
            <b>{t.kapitalWert}</b>
            <small>{t.kapitalSatz}</small>
            <span className="hg-w-chip">{t.kapitalFrei}<sup>{t.fussnoteNr}</sup></span>
          </div>
          <div className="hg-widget hg-w-person" style={{ ["--i" as string]: 1 }}>
            <img src="/portraits/daniel.jpg" alt="" width={54} height={54} loading="lazy" decoding="async" />
            <div>
              <span className="hg-w-auge">{t.personTitel}</span>
              <b>{person.name}</b>
              <small>{person.rolle[sp]}</small>
            </div>
            <button type="button" className="hg-w-knopf" aria-label={t.knopfGespraech} onClick={onGespraech}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="hg-widget hg-w-vertrag" style={{ ["--i" as string]: 2 }}>
            <ul>
              {t.vertrag.map((x, i) => (
                <li key={x}>{i === 1 ? <a href={t.mustervertragHref}>{x}</a> : <span>{x}</span>}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="hg-fussnote"><sup>{t.fussnoteNr}</sup> {t.fussnote}</p>
      </div>

      <a className="hg-weiter" href="#pakete" aria-label={t.weiter} onClick={(e) => { e.preventDefault(); onPakete(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </a>
    </section>
  );
}
