// ═══════════════════════════════════════════════════════════════════════════
// NACHRICHTENLAGE — SCHLAGZEILEN IM ZEITUNGSSTIL (19.09.2026, E-196)
//
// Justin: „Richtig geil und aufregend gestaltet wie von der New York Times oder
// Forbes — sehr elegant, aber bewegend und aufregend." Die Anmutung einer
// Titelseite: Doppellinie, Serifen-Schlagzeile, Spitzmarke mit Quelle und
// Datum. Bewegung an zwei Stellen: Der Aufmacher wechselt alle sieben Sekunden
// (mit Fortschrittslinie, hält bei Maus oder Fokus an), unten läuft das Band.
// Bei „weniger Bewegung" steht alles still und bleibt vollständig lesbar.
//
// Nur echte Meldungen mit Quelle (shared/fiaon-global-schlagzeilen.ts). Ist die
// Liste leer, erscheint die Sektion nicht.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { globalSchlagzeilen, schlagzeileDatum, GLOBAL_SCHLAGZEILEN } from "@shared/fiaon-global-schlagzeilen";

const WECHSEL_MS = 7000;

function Pfeil() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>;
}

export default function GlobalSchlagzeilen({ sprache, auge, h2, stand, zurQuelle, hinweis, laufband, pause, weiter }: {
  sprache: "de" | "en"; auge: string; h2: string; stand: (datum: string) => string; zurQuelle: string;
  hinweis: string; laufband: string; pause: string; weiter: string;
}) {
  const meldungen = globalSchlagzeilen();
  const [aktiv, setAktiv] = useState(0);
  const [halt, setHalt] = useState(false);
  const [bandHalt, setBandHalt] = useState(false);
  const ruhig = useRef(typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  const aufmacher = meldungen.slice(0, Math.min(4, meldungen.length));

  useEffect(() => {
    if (ruhig.current || halt || aufmacher.length < 2) return;
    const w = window.setTimeout(() => setAktiv((a) => (a + 1) % aufmacher.length), WECHSEL_MS);
    return () => window.clearTimeout(w);
  }, [aktiv, halt, aufmacher.length]);

  if (!meldungen.length) return null;
  const m = aufmacher[aktiv] ?? aufmacher[0];
  const titel = (x: typeof m) => (sprache === "en" ? x.en : x.de);
  const kurz = (x: typeof m) => (sprache === "en" ? x.kurzEn : x.kurzDe);
  const quelle = (x: typeof m) => (sprache === "en" ? x.quelleEn ?? x.quelle : x.quelle);

  return (
    <section className="fg-presse" aria-labelledby="fg-presse-h2">
      <div className="fg-rahmen">
        <header className="fg-presse-kopf">
          <span className="fg-presse-marke"><i className="puls" aria-hidden="true" />{auge}</span>
          <h2 id="fg-presse-h2" className="fg-presse-h2">{h2}</h2>
          <span className="fg-presse-stand">{stand(schlagzeileDatum(GLOBAL_SCHLAGZEILEN.stand, sprache))}</span>
        </header>

        <div className="fg-presse-blatt" onMouseEnter={() => setHalt(true)} onMouseLeave={() => setHalt(false)}
             onFocusCapture={() => setHalt(true)} onBlurCapture={() => setHalt(false)}>
          <article className="fg-presse-aufmacher" key={`${m.datum}-${aktiv}`} aria-live="polite">
            <span className="spitzmarke">{quelle(m)} · <span className="tag">{schlagzeileDatum(m.datum, sprache)}</span></span>
            <h3><a href={m.url} target="_blank" rel="noopener noreferrer">{titel(m)}</a></h3>
            <p>{kurz(m)}</p>
            <a className="fg-presse-link" href={m.url} target="_blank" rel="noopener noreferrer">{zurQuelle}<Pfeil /></a>
            {!ruhig.current && aufmacher.length > 1 && (
              <span className={`fg-presse-uhr${halt ? " steht" : ""}`} style={{ animationDuration: `${WECHSEL_MS}ms` }} aria-hidden="true" />
            )}
          </article>
          <ol className="fg-presse-liste">
            {aufmacher.map((x, i) => (
              <li key={x.de} className={i === aktiv ? "aktiv" : undefined}>
                <button type="button" onClick={() => setAktiv(i)} aria-current={i === aktiv ? "true" : undefined}>
                  <span className="spitzmarke">{quelle(x)} · <span className="tag">{schlagzeileDatum(x.datum, sprache)}</span></span>
                  <b>{titel(x)}</b>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <p className="fg-presse-hinweis">{hinweis}</p>
      </div>

      <div className={`fg-presse-band${bandHalt ? " steht" : ""}`} role="region" aria-label={laufband}>
        <div className="fg-presse-band-spur">
          {[0, 1].map((kopie) => (
            <ul key={kopie} aria-hidden={kopie === 1 ? "true" : undefined}>
              {meldungen.map((x) => (
                <li key={`${kopie}-${x.de}`}>
                  <a href={x.url} target="_blank" rel="noopener noreferrer" tabIndex={kopie === 1 ? -1 : undefined}>
                    <span className="quelle">{quelle(x)}</span>{titel(x)}
                  </a>
                </li>
              ))}
            </ul>
          ))}
        </div>
        <button type="button" className="fg-presse-band-knopf" onClick={() => setBandHalt(!bandHalt)} aria-pressed={bandHalt}>
          {bandHalt ? weiter : pause}
        </button>
      </div>
    </section>
  );
}
