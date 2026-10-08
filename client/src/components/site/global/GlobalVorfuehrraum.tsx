// ═══════════════════════════════════════════════════════════════════════════
// DER VORFÜHRRAUM — Filme im iPhone, Kino mit Ton, das Konzept als Mappe (E-313, 08.10.2026)
//
// Justin: „beide Videos auf der /business-Startseite … nicht einfach nur ein Video einfügen … perfekt modern … und unsere
// Präsentation soll man ebenfalls cool herunterladen können.“
//
// · Ein dunkles Navy-Band direkt unter dem Kopf. Durch das Band zieht sich der blaue Faden (das Leitmotiv des Trailers)
//   und endet am iPhone. Wie alle Grafiken der Business-Welt startet die Bewegung GENAU EINMAL, wenn das Band ins Bild
//   kommt (useEinmalSichtbar) — nie an die Scrollposition gekoppelt (Justin: Scroll-Effekte „ruckeln“).
// · Jeder Film aus lib/global-filme.ts steht in einem iPhone; dort läuft nur eine stumme 10-Sekunden-Schleife (220 KB),
//   und nur, solange das Telefon im Bild ist. Der ganze Film (mit Ton) lädt erst im Kino.
// · Das Kino ist ein <dialog> am <body> (Portal, außerhalb von zoom); Fokus, Esc und Zurückgeben des Fokus macht der Browser. Der Fortschritt ist eine blaue
//   Linie mit leuchtendem Kopf — der Faden läuft mit. Tasten: Leertaste/K, M, ←/→, Esc.
// · Die Mappe: drei echte Folien des Konzepts, gefächert; ein Klick lädt das PDF.
// · Ohne Bewegungswunsch: Titelbild statt Schleife, kein Fächern, kein Faden-Zeichnen.
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { useWoerter, useSprache } from "@/i18n/sprache";
import { GLOBAL_FILM_WOERTER } from "@/i18n/global";
import { GLOBAL_FILME, GLOBAL_KONZEPT, filmDauer, type GlobalFilm } from "@/lib/global-filme";
import { werbeEreignis } from "@/lib/werbung";
import { useEinmalSichtbar, ruhigGewuenscht } from "./bewegung";
import "@/styles/global-vorfuehrraum.css";

type Woerter = (typeof GLOBAL_FILM_WOERTER)["de"];
type Sp = "de" | "en";

const Abspielen = ({ g = 18 }: { g?: number }) => (
  <svg width={g} height={g} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.6v12.8a.8.8 0 0 0 1.2.7l10.2-6.4a.8.8 0 0 0 0-1.4L9.2 4.9a.8.8 0 0 0-1.2.7z" fill="currentColor" /></svg>
);
const Anhalten = ({ g = 18 }: { g?: number }) => (
  <svg width={g} height={g} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" /><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" /></svg>
);
const Ton = ({ an }: { an: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor" stroke="none" />
    {an ? <><path d="M15.5 9a4 4 0 0 1 0 6" /><path d="M18.2 6.5a7.6 7.6 0 0 1 0 11" /></> : <><path d="m16 9.5 5 5" /><path d="m21 9.5-5 5" /></>}
  </svg>
);
const Vollbild = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>
);
const Zu = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg>
);
const Laden = () => (
  <svg className="gv-laden-pfeil" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M12 4v11" /><path d="m7 10.5 5 5 5-5" /><path d="M5 19.5h14" /></svg>
);

export default function GlobalVorfuehrraum() {
  const t = useWoerter(GLOBAL_FILM_WOERTER);
  const sp: Sp = useSprache() === "en" ? "en" : "de";
  const ref = useRef<HTMLElement>(null);
  // Hohes Band: Schwelle 0 mit eigenem Rand, wie die anderen hohen Abschnitte (bewegung.ts).
  useEinmalSichtbar(ref, 0, "0px 0px -22% 0px");
  const [kino, setKino] = useState<number | null>(null);
  const filme = GLOBAL_FILME;
  if (!filme.length) return null;
  const erster = filme[0];

  return (
    <section ref={ref} id="film" className="gv" style={{ scrollMarginTop: 72 }} aria-labelledby="gv-titel">
      <svg className="gv-faden" viewBox="0 0 1200 800" preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {/* Unter der Mappe entlang (ihre Unterkante liegt bei ≈ 695 von 800), dann hinter das Telefon und rechts hinaus. */}
        <path d="M-40 742 C 200 752, 420 762, 600 736 S 720 640, 790 600 S 1080 520, 1260 470" pathLength={1} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="fg-rahmen gv-raster">
        <div className="gv-text">
          <span className="fg-auge gv-auge">{t.auge}</span>
          <h2 id="gv-titel" className="fg-h2 gv-h2">{t.h2} <em>{t.h2Kursiv}</em></h2>
          <p className="fg-lead gv-lead">{t.lead}</p>
          <div className="gv-knoepfe">
            <button type="button" className="fg-knopf gv-ansehen" onClick={() => setKino(0)}>
              <span className="gv-ansehen-zeichen"><Abspielen g={14} /></span>{t.ansehen}
            </button>
            <span className="gv-zeile">{t.filmZeile(filmDauer(erster.dauerSek))}</span>
          </div>
        </div>
        <div className={`gv-buehne${filme.length > 1 ? " zwei" : ""}`}>
          {filme.map((f, i) => (
            <Telefon key={f.schluessel} film={f} index={i} t={t} sp={sp} onOeffnen={() => setKino(i)} />
          ))}
        </div>
        <Mappe t={t} sp={sp} />
      </div>
      {/* Das Kino hängt direkt am <body>: /business steht ab 1.024 px unter `zoom: .95` (E-311) — darin würde auch das
          Vollbild um 5 % schrumpfen. */}
      {kino !== null && typeof document !== "undefined" && createPortal(
        <Kino filme={filme} index={kino} onWechsel={setKino} onZu={() => setKino(null)} t={t} sp={sp} />, document.body)}
    </section>
  );
}

/** Ein iPhone mit stummer Schleife; die Schleife lädt und läuft nur, solange das Telefon im Bild ist. */
function Telefon({ film, index, t, sp, onOeffnen }: { film: GlobalFilm; index: number; t: Woerter; sp: Sp; onOeffnen: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [laeuft, setLaeuft] = useState(false);
  useEffect(() => {
    const el = video.current;
    if (!el || ruhigGewuenscht() || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        if (!el.getAttribute("src")) el.setAttribute("src", film.vorschau);
        el.play().catch(() => { /* Sparmodus oder Autoplay gesperrt: das Titelbild bleibt stehen */ });
      } else el.pause();
    }, { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [film.vorschau]);
  const dauer = filmDauer(film.dauerSek);
  return (
    <button type="button" className={`gv-telefon${index ? " hinten" : ""}${laeuft ? " laeuft" : ""}`} style={{ "--i": index } as CSSProperties}
      onClick={onOeffnen} aria-label={t.filmLabel(film.titel[sp], dauer)}>
      <span className="gv-geraet">
        <span className="gv-schirm">
          <img className="gv-titelbild" src={film.titelbild} alt="" width={720} height={1280} decoding="async" />
          <video ref={video} className="gv-schleife" muted loop playsInline preload="none" aria-hidden="true" tabIndex={-1}
            onPlaying={() => setLaeuft(true)} />
          <span className="gv-insel" aria-hidden="true" />
          <span className="gv-schirm-fuss" aria-hidden="true">
            <span className="gv-play"><Abspielen g={16} /></span>
            <span className="gv-schirm-text"><b>{film.titel[sp]}</b><small>{t.mitTon} · {dauer}</small></span>
          </span>
          <span className="gv-spiegel" aria-hidden="true" />
        </span>
      </span>
    </button>
  );
}

/** Das Konzept als Mappe: drei echte Folien gefächert, ein Klick lädt das PDF. */
function Mappe({ t, sp }: { t: Woerter; sp: Sp }) {
  const k = GLOBAL_KONZEPT;
  const geladen = () => werbeEreignis("global_konzept_pdf", { seite: typeof window !== "undefined" ? window.location.pathname : "" });
  const mb = sp === "en" ? String(k.groesseMb) : String(k.groesseMb).replace(".", ",");
  return (
    <div className="gv-mappe">
      {/* Der Stapel ist ein zweiter Weg zum selben PDF — für Maus und Finger; Tastatur und Screenreader nehmen den Knopf. */}
      <a className="gv-stapel" href={k.datei} download={k.dateiname} onClick={geladen} aria-hidden="true" tabIndex={-1}>
        {k.bilder.map((b, i) => (
          <img key={b} src={b} alt="" className={`gv-folie f${i}`} width={960} height={540} loading="lazy" decoding="async" />
        ))}
        <span className="gv-pdf">PDF</span>
      </a>
      <span className="gv-unsichtbar">{t.mappeBild}</span>
      <div className="gv-mappe-text">
        <span className="gv-mappe-auge">{t.mappeAuge}</span>
        <b className="gv-mappe-titel">{t.mappeTitel}</b>
        <p>{t.mappeText}</p>
        <div className="gv-mappe-knoepfe">
          <a className="gv-laden" href={k.datei} download={k.dateiname} onClick={geladen}><Laden /><span>{t.laden}</span></a>
          <a className="gv-browser" href={k.datei} target="_blank" rel="noopener" onClick={geladen}>{t.imBrowser}</a>
        </div>
        <small className="gv-mappe-zeile">{t.ladenZeile(k.folien, mb)}</small>
      </div>
    </div>
  );
}

/** Das Kino: der ganze Film mit Ton in einem <dialog>; der Fortschritt läuft als blauer Faden. */
function Kino({ filme, index, onWechsel, onZu, t, sp }: {
  filme: GlobalFilm[]; index: number; onWechsel: (i: number) => void; onZu: () => void; t: Woerter; sp: Sp;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const leiste = useRef<HTMLDivElement>(null);
  const film = filme[index];
  const [spielt, setSpielt] = useState(false);
  const [stumm, setStumm] = useState(false);
  const [zeit, setZeit] = useState(0);
  const [dauer, setDauer] = useState(film.dauerSek);

  // Öffnen als Modal; die Seite dahinter scrollt nicht mit.
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (!d.open) { try { d.showModal(); } catch { d.setAttribute("open", ""); } }
    const html = document.documentElement;
    const vorher = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { html.style.overflow = vorher; };
  }, []);

  // Jeder Film beginnt vorn und spielt mit Ton (der Klick zum Öffnen erlaubt das).
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    setZeit(0);
    setDauer(film.dauerSek);
    leiste.current?.style.setProperty("--anteil", "0");
    el.play().catch(() => setSpielt(false));
    werbeEreignis("global_film_start", { film: film.schluessel });
  }, [film.schluessel, film.dauerSek]);

  // Der Faden folgt dem Bild flüssig (je Bild), die Zeitangabe reicht viermal je Sekunde (timeupdate).
  useEffect(() => {
    if (!spielt) return;
    let bild = 0;
    const lauf = () => {
      const el = video.current;
      if (el && el.duration) leiste.current?.style.setProperty("--anteil", String(el.currentTime / el.duration));
      bild = requestAnimationFrame(lauf);
    };
    bild = requestAnimationFrame(lauf);
    return () => cancelAnimationFrame(bild);
  }, [spielt]);

  const schliessen = () => dialog.current?.close();
  const umschalten = useCallback(() => {
    const el = video.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {}); else el.pause();
  }, []);
  const ton = () => { const el = video.current; if (!el) return; el.muted = !el.muted; setStumm(el.muted); };
  const springenAuf = (sek: number) => {
    const el = video.current;
    if (!el) return;
    const d = el.duration || dauer;
    el.currentTime = Math.max(0, Math.min(d - 0.05, sek));
    leiste.current?.style.setProperty("--anteil", String(el.currentTime / d));
    setZeit(el.currentTime);
  };
  const vollbild = () => {
    const el = video.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (!el) return;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => el.webkitEnterFullscreen?.());
    else el.webkitEnterFullscreen?.();
  };
  const tasten = (e: KeyboardEvent<HTMLDialogElement>) => {
    const ziel = e.target as HTMLElement;
    const imKnopf = ziel.tagName === "BUTTON" || ziel.tagName === "A";
    if ((e.key === " " && !imKnopf) || e.key === "k" || e.key === "K") { e.preventDefault(); umschalten(); }
    else if (e.key === "m" || e.key === "M") { e.preventDefault(); ton(); }
    else if (e.key === "ArrowRight") { e.preventDefault(); springenAuf((video.current?.currentTime ?? 0) + 5); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); springenAuf((video.current?.currentTime ?? 0) - 5); }
  };
  const ziehen = (e: PointerEvent<HTMLDivElement>) => {
    const el = leiste.current;
    if (!el || (e.type === "pointermove" && !(e.buttons & 1))) return;
    if (e.type === "pointerdown") el.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const anteil = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    springenAuf(anteil * (video.current?.duration || dauer));
  };

  return (
    <dialog ref={dialog} className="gv-kino" aria-label={t.kinoLabel(film.titel[sp])} onClose={onZu} onKeyDown={tasten}
      onClick={(e) => { if (e.target === dialog.current) schliessen(); }}>
      <button type="button" className="gv-kino-zu" onClick={schliessen} aria-label={t.schliessen}><Zu /></button>
      <div className="gv-kino-innen">
        {filme.length > 1 && (
          <div className="gv-kino-wahl">
            {filme.map((f, i) => (
              <button key={f.schluessel} type="button" className={i === index ? "an" : ""} aria-pressed={i === index} onClick={() => onWechsel(i)}>
                {f.titel[sp]}
              </button>
            ))}
          </div>
        )}
        <div className="gv-kino-bild">
          <video ref={video} key={film.schluessel} src={film.datei} poster={film.titelbild} playsInline preload="auto"
            aria-describedby="gv-kino-beschreibung" onClick={umschalten}
            onPlay={() => setSpielt(true)} onPause={() => setSpielt(false)} onEnded={() => setSpielt(false)}
            onTimeUpdate={(e) => setZeit(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => { if (e.currentTarget.duration) setDauer(e.currentTarget.duration); }} />
          {!spielt && (
            <button type="button" className="gv-kino-gross" onClick={umschalten} aria-label={t.abspielen}><Abspielen g={26} /></button>
          )}
        </div>
        <p id="gv-kino-beschreibung" className="gv-unsichtbar">{film.beschreibung[sp]}</p>
        <div className="gv-kino-leiste">
          <button type="button" className="gv-kino-knopf" onClick={umschalten} aria-label={spielt ? t.anhalten : t.abspielen}>
            {spielt ? <Anhalten /> : <Abspielen />}
          </button>
          <div ref={leiste} className="gv-faden-leiste" role="slider" tabIndex={0} aria-label={t.stelle}
            aria-valuemin={0} aria-valuemax={Math.round(dauer)} aria-valuenow={Math.round(zeit)}
            aria-valuetext={`${filmDauer(zeit)} / ${filmDauer(dauer)}`}
            onPointerDown={ziehen} onPointerMove={ziehen}>
            <span className="spur" /><span className="gefuellt" /><span className="kopf" />
          </div>
          <span className="gv-kino-zeit">{filmDauer(zeit)} / {filmDauer(dauer)}</span>
          <button type="button" className="gv-kino-knopf" onClick={ton} aria-label={stumm ? t.tonAn : t.tonAus}><Ton an={!stumm} /></button>
          <button type="button" className="gv-kino-knopf gv-nur-breit" onClick={vollbild} aria-label={t.vollbild}><Vollbild /></button>
        </div>
      </div>
    </dialog>
  );
}
