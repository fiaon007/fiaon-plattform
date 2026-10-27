// ═══════════════════════════════════════════════════════════════════════════
// DIE ALPEN-BÜHNE — der Hero von /business (E-442, 27.10.2026)
//
// Justin (27.10., mit dem Bild des Chefbüro-Sperrbildschirms): „Wir brauchen
// Apple Glas, Animationen, clean — mehr Abstände — mehr WOW — baue es im Apple
// Stil, wie hier die Zahlen in unserem Admin-Dashboard.“
//
// Genau das: die Alpen als Film hinter allem (derselbe Higgsfield-Film wie im
// Chefbüro, hier in einer besseren Webfassung), darauf eine kleine Zeile, EINE
// riesige dünne Zahl mit Glasschimmer — der Festpreis „ab 2.499 €“ —, darunter
// in Kapitälchen der Satz dazu (einmalig, alle Gebühren des Pakets inklusive),
// die Überschrift dünn, zwei Glaspillen, drei Milchglas-Widgets: Kapitalrahmen
// (mit „das Institut entscheidet“, Blickfang-Regel), der echte Ansprechpartner
// (VISITENKARTEN, wie der frühere Hero „Ihr Auftrag“) und die Vertrauensleiste
// als Vertrag-Widget. Alle Sätze kommen aus i18n/global.ts — die Wortwand liest
// sie dort; hier steht kein eigener deutscher Satz.
//
// Film: nur mit erlaubter Bewegung, ohne Datensparmodus und nur solange die
// Bühne im Bild ist (IntersectionObserver); am Telefon hochkant und klein.
// Erstes Bild immer das Standbild (gleiches Bild wie Bild 1 des Films — kein
// Sprung). Während die Bühne im Bild ist, trägt <html> die Klasse fg-film:
// die Kopfzeile wird dann dunkles Glas mit weißer Schrift (global-rahmen-apple.css).
// Auftakt erst nach dem Ladebildschirm (nachLadebild), wie der frühere Hero.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { nachLadebild, ruhigGewuenscht } from "@/components/site/global/bewegung";
import { VISITENKARTEN } from "@shared/fiaon-visitenkarte";
import "@/styles/global-hero-alpen.css";

/** Dateien mit Datum im Namen (30-Tage-Cache): neue Fassung = neuer Name. Quelle: 08_Medien_Higgsfield/2026-10-13_Chefbuero_Apple_Hintergrund. */
const ALPEN = {
  film: "/global/alpen-2026-10-27.mp4",
  filmHoch: "/global/alpen-2026-10-27-m.mp4",
  bild: "/global/alpen-2026-10-27.jpg",
  bildHoch: "/global/alpen-2026-10-27-hoch.jpg",
};

export interface HeroAlpenTexte {
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

function Pfeil() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

export default function HeroAlpen({ t, en, onPakete, onGespraech }: { t: HeroAlpenTexte; en: boolean; onPakete: () => void; onGespraech: () => void }) {
  const ref = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [an, setAn] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  // Der Film: nur mit Bewegung, ohne Datensparmodus. Entscheidung einmal beim Einhängen (kein Server-Rendering).
  const [film, setFilm] = useState<string | null>(null);
  const person = VISITENKARTEN.daniel;

  useLayoutEffect(() => {
    if (ruhigGewuenscht()) { setAn(true); return; }
    let raf = 0;
    const weg = nachLadebild(() => { raf = requestAnimationFrame(() => setAn(true)); });
    return () => { weg(); cancelAnimationFrame(raf); };
  }, []);

  useEffect(() => {
    if (ruhigGewuenscht()) return;
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return;
    const hoch = window.matchMedia?.("(max-width: 720px) and (orientation: portrait)").matches;
    setFilm(hoch ? ALPEN.filmHoch : ALPEN.film);
  }, []);

  // Solange die Bühne im Bild ist: Film läuft, <html> trägt fg-film (Kopfzeile dunkel). Außer Sicht: Film steht.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = document.documentElement;
    let imBild = false;
    const anwenden = () => {
      const v = video.current;
      const sichtbar = imBild && document.visibilityState === "visible";
      if (v) { if (sichtbar) { v.play().catch(() => {}); } else { v.pause(); } }
    };
    const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([e]) => {
      imBild = e.isIntersecting;
      html.classList.toggle("fg-film", e.isIntersecting);
      anwenden();
    }, { threshold: 0, rootMargin: "-72px 0px 0px 0px" });
    if (io) io.observe(el); else { imBild = true; html.classList.add("fg-film"); }
    document.addEventListener("visibilitychange", anwenden);
    return () => { io?.disconnect(); document.removeEventListener("visibilitychange", anwenden); html.classList.remove("fg-film"); };
  }, [film]);

  const sp = en ? "en" : "de";
  return (
    <section ref={ref} className={`ha${laeuft ? " laeuft" : ""}`} data-an={an ? "1" : "0"}>
      <div className="ha-film" aria-hidden="true">
        <picture>
          <source media="(max-width: 720px) and (orientation: portrait)" srcSet={ALPEN.bildHoch} />
          {/* React 18 kennt fetchPriority nicht als Prop — klein geschrieben kommt es als Attribut an. */}
          <img className="ha-bild" src={ALPEN.bild} alt="" width={1920} height={1080} decoding="async" {...({ fetchpriority: "high" } as Record<string, string>)} />
        </picture>
        {film && (
          <video ref={video} className="ha-video" src={film} muted loop playsInline autoPlay preload="auto" disablePictureInPicture
            onPlaying={() => setLaeuft(true)} onError={() => setFilm(null)} />
        )}
      </div>
      <div className="ha-schleier" aria-hidden="true" />

      <div className="ha-inhalt">
        <p className="ha-auge">{t.auge}</p>
        <p className="ha-zahl" aria-label={`${t.ab} ${t.preis}`}><span className="ha-zahl-ab" aria-hidden="true">{t.ab}</span>{t.preis}</p>
        <p className="ha-label">{t.label}</p>
        <h1 className="ha-h1">{t.h1a} <em>{t.h1b}</em></h1>
        <div className="ha-pillen">
          <button type="button" className="ha-pille voll" onClick={onPakete}>{t.knopfPakete}<Pfeil /></button>
          <button type="button" className="ha-pille" onClick={onGespraech}>{t.knopfGespraech}</button>
        </div>
        <p className="ha-mikro">{t.mikro}</p>

        <div className="ha-widgets">
          <div className="ha-widget" style={{ ["--i" as string]: 0 }}>
            <span className="ha-w-auge">{t.kapitalTitel}</span>
            <b>{t.kapitalWert}</b>
            <small>{t.kapitalSatz}</small>
            <span className="ha-w-chip">{t.kapitalFrei}<sup>{t.fussnoteNr}</sup></span>
          </div>
          <div className="ha-widget ha-w-person" style={{ ["--i" as string]: 1 }}>
            <img src="/portraits/daniel.jpg" alt="" width={54} height={54} loading="lazy" decoding="async" />
            <div>
              <span className="ha-w-auge">{t.personTitel}</span>
              <b>{person.name}</b>
              <small>{person.rolle[sp]}</small>
            </div>
            <button type="button" className="ha-w-knopf" aria-label={t.knopfGespraech} onClick={onGespraech}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="ha-widget ha-w-vertrag" style={{ ["--i" as string]: 2 }}>
            <ul>
              {t.vertrag.map((x, i) => (
                <li key={x}>{i === 1 ? <a href={t.mustervertragHref}>{x}</a> : <span>{x}</span>}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="ha-fussnote"><sup>{t.fussnoteNr}</sup> {t.fussnote}</p>
      </div>

      <a className="ha-weiter" href="#pakete" aria-label={t.weiter} onClick={(e) => { e.preventDefault(); onPakete(); }}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </a>
    </section>
  );
}
