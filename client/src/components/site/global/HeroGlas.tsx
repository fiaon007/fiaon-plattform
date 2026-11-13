// ═══════════════════════════════════════════════════════════════════════════
// DIE BÜHNE — das erste Bild der Startseite von FIAON Global (E-442, 27.10.2026; Kanzlei-Ton E-510, 13.11.2026)
//
// Justin (27.10.): „Apple Glas, Animationen, clean — mehr Abstände — mehr WOW“ … „aber nicht mit dem Berg-Hintergrund —
// CLEAN!“ Und am 12.11.: „keine Magie, sondern knallharte Fakten — präsentiere uns wie eine Kanzlei, wie internationale
// Unternehmensberater.“
//
// Also: kein Film, kein Foto, keine Schleife. Die Bühne ist der helle, ruhige Glasgrund der Seite selbst.
//   · DER SATZ IST DAS GRÖSSTE (UX-Prüfung 3.10, Fassung 2): die Überschrift dünn und groß, linksbündig an derselben Kante
//     wie Kopfleiste, Abschnitte und Fuß. Darunter die Einleitung, die EINE Haupt-Handlung („Angebot anfordern“) und die
//     zweite („Gespräch vereinbaren“), dann die kleine Zeile.
//   · DIE TATSACHENREIHE an einer Haarlinie, am unteren Rand des ersten Bilds: zwei dünne Zahlen, jede mit ihrem Satz im
//     selben Blick — das Honorar zum Auftrag (mit der Zeile zum Erfolgshonorar) und die Spanne des Kapitalrahmens
//     (mit S9 und dem Miami-Satz). Die dünne Zahl bleibt Justins Handschrift — als Tatsache, nicht als Preisschild.
//   · Unter der Bühne der Kasten „Auf einen Blick“ (GlobalBlick.tsx): die vier Antworten der 30-Sekunden-Probe.
// Jeder Satz kommt als Eigenschaft herein (shared/fiaon-global-verkauf.ts); hier steht kein eigener Wortlaut.
//
// BEWEGUNG: Der Auftakt läuft einmal, erst nach dem Ladebildschirm (nachLadebild): Zeile, Überschrift, Einleitung,
// Knöpfe gleiten gestaffelt 12 px hoch, dann zeichnet sich die Haarlinie der Tatsachenreihe von links und die beiden
// Tatsachen folgen. Kein Betrag zählt hoch, kein Glanz kehrt wieder, kein Winkel wippt (UX-Prüfung, Abschnitt 5).
// Bei „weniger Bewegung“, ohne JavaScript und im Druck steht sofort das Endbild.
// Stil: styles/global-hero-glas.css, Maße aus styles/global-tokens.css.
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { nachLadebild, ruhigGewuenscht, useEinmalSichtbar } from "@/components/site/global/bewegung";
import GlobalBlick, { type GlobalBlickPunkt } from "@/components/site/global/GlobalBlick";
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import "@/styles/global-tokens.css";
import "@/styles/global-hero-glas.css";

export interface HeroGlasTexte {
  /** Die kleine Zeile über der Überschrift (die Augenzeile der Seite). */
  auge: ReactNode;
  /** Die Überschrift in zwei Teilen — beide sichtbar, beide in der h1. */
  h1a: string;
  h1b: string;
  /** Die Einleitung: was wir tun und wer entscheidet. */
  lead: ReactNode;
  knopfAngebot: string;
  knopfGespraech: string;
  mikro: string;
  /** „2.799 €“ (aus der Preisquelle) — die erste Tatsache. */
  preis: string;
  /** Der Satz zur Zahl: wann sie fällig wird und was im ersten Jahr enthalten ist. */
  label: string;
  /** Die zweite Zeile zur Zahl: das Erfolgshonorar mit seinem Mindestbetrag — die Zahl steht nie für das ganze Honorar. */
  honorarZeile: string;
  /** Die Spanne des Kapitalrahmens mit ihrem Satz (S9 und der Miami-Satz) — die zweite Tatsache. */
  kapitalTitel: string;
  kapitalWert: string;
  kapitalSatz: string;
  /** Der Kasten „Auf einen Blick“: Name des Abschnitts und die vier Antworten der 30-Sekunden-Probe. */
  blickName: string;
  blick: readonly GlobalBlickPunkt[];
}

function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function HeroGlas({ t, onAngebot, onGespraech }: { t: HeroGlasTexte; onAngebot: () => void; onGespraech: () => void }) {
  const [an, setAn] = useState(false);
  // E-442 (28.10.2026, Justin): „Man soll nur den Hero am Anfang sehen — erst wenn man scrollt“ das, was darunter steht.
  // Der Kasten „Auf einen Blick“ steht darum in einem eigenen Abschnitt UNTER der Bühne und erscheint beim Hineinscrollen.
  const blick = useRef<HTMLElement>(null);
  useEinmalSichtbar(blick, 0, "0px 0px -18% 0px");

  useLayoutEffect(() => {
    if (ruhigGewuenscht()) { setAn(true); return; }
    let raf = 0;
    const weg = nachLadebild(() => { raf = requestAnimationFrame(() => setAn(true)); });
    return () => { weg(); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
    <section className="hg" data-an={an ? "1" : "0"}>
      <div className="hg-licht" aria-hidden="true" />
      <div className="hg-rahmen">
        <div className="hg-inhalt">
          <p className="hg-auge">{t.auge}</p>
          {/* Die ganze Überschrift ist sichtbar und trägt das Suchwort (Leitfaden 9.1 Nr. 9). */}
          <h1 className="hg-h1">{t.h1a} <em>{t.h1b}</em></h1>
          <p className="hg-lead">{t.lead}</p>
          <div className="hg-pillen">
            <button type="button" className="hg-pille voll" onClick={onAngebot}>{t.knopfAngebot}<Pfeil /></button>
            <button type="button" className="hg-pille" onClick={onGespraech}>{t.knopfGespraech}</button>
          </div>
          <p className="hg-mikro">{W(t.mikro)}</p>
        </div>

        {/* Die Tatsachenreihe: jede Zahl mit ihrem Satz im selben Blick (kein Betrag im Blickfang ohne seinen Satz). */}
        <dl className="hg-fakten">
          <div className="hg-fakt">
            <dt>{t.label}</dt>
            <dd className="hg-fakt-zahl">{t.preis}</dd>
            <dd className="hg-fakt-satz">{W(t.honorarZeile)}</dd>
          </div>
          <div className="hg-fakt">
            <dt>{t.kapitalTitel}</dt>
            <dd className="hg-fakt-zahl">{t.kapitalWert}</dd>
            <dd className="hg-fakt-satz">{W(t.kapitalSatz)}</dd>
          </div>
        </dl>
      </div>
    </section>

    {/* „Auf einen Blick“: die vier Antworten der 30-Sekunden-Probe direkt unter der Bühne (Leitfaden 1.3). */}
    <section ref={blick} id="auf-einen-blick" className="hg-blick" aria-labelledby="hg-blick-titel" style={{ scrollMarginTop: 96 }}>
      <GlobalBlick titel={t.blickName} titelId="hg-blick-titel" punkte={t.blick} />
    </section>
    </>
  );
}
