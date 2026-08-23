// ═══════════════════════════════════════════════════════════════════════════
// FlugHero — der cinematische Eintritt, als Film (23.08.2026, Justin:
// „es ruckelt beim Scrollen, der Text ist kaum zu lesen — lass das Video
// laufen und animiere den Text so, dass alle Elemente nacheinander kommen").
//
// Kein Scroll-Spulen mehr. Der Anflug auf die Weltkugel läuft als Video in
// Schleife (Rechner 16:9, Handy 9:16 nativ hochkant), darüber wechseln drei
// Textmomente von selbst: jeder steht sechs Sekunden, kommt aus der Tiefe und
// geht nach oben. Hinter dem Text liegt ein weicher Lichtkegel (dunkler,
// leicht verwischter Grund), damit die Schrift auf jedem Bild lesbar bleibt.
// Die Knöpfe stehen von Anfang an — niemand muss auf den dritten Satz warten.
// Land (DE/AT/CH) erkannt und umschaltbar; der Antrag liest dieselbe Vorwahl.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { landErkennen, LANDNAME } from "@/lib/land-erkennen";

const LAENDER = ["DE", "AT", "CH"] as const;
const AUSKUNFTEI: Record<string, string> = { DE: "SCHUFA", AT: "KSV", CH: "CRIF" };
const DAUER = 6000;
const ANZAHL = 3;

export function FlugHero({ knoepfe }: { knoepfe: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [land, setLand] = useState<string>("DE");
  const [bereit, setBereit] = useState(false);
  const [moment, setMoment] = useState(0);
  const [vorher, setVorher] = useState<number | null>(null);
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Die Höhe kommt aus dem echten Fenster — 100svh lief im Handy-Browser aus dem Ruder
  // (gemessen: 2.194 px statt 844) und schob den Text „viel zu weit nach unten".
  // Am Handy wird nur bei Breitenänderung (Drehen) neu gemessen, nicht beim Ein- und
  // Ausfahren der Adressleiste — sonst springt die Bühne beim Scrollen.
  const [hoehe, setHoehe] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  useEffect(() => {
    let breite = window.innerWidth;
    const fn = () => { if (window.innerWidth < 768 && window.innerWidth === breite) return; breite = window.innerWidth; setHoehe(window.innerHeight); };
    window.addEventListener("resize", fn); window.addEventListener("orientationchange", fn);
    return () => { window.removeEventListener("resize", fn); window.removeEventListener("orientationchange", fn); };
  }, []);
  // Hochkant-Fassung am Handy — und zwar nach dem tatsächlichen Fenster, auch wenn es sich dreht.
  const [handy, setHandy] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const fn = () => setHandy(mq.matches);
    mq.addEventListener("change", fn); return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => { landErkennen().then((l) => { if (l && (LAENDER as readonly string[]).includes(l)) setLand(l); }).catch(() => {}); }, []);
  const landWaehlen = (l: string) => { setLand(l); try { sessionStorage.setItem("fiaon_land", l); } catch { /* egal */ } };

  const MOMENTE = [
    { ueber: `Bonität in ${LANDNAME[land]} · Auskunft: ${AUSKUNFTEI[land]}`, h: <>Wissen, was <span className="dk-verlauf">über Sie</span> gespeichert ist.</>, satz: "Ihre Auskunft, beschafft und in Menschensprache erklärt – innerhalb von 24 Stunden." },
    { ueber: "Schicht 2 · Aktion", h: <>Und es <span className="dk-verlauf">ändern.</span></>, satz: "Löschanträge, Widersprüche, Ratenvereinbarungen – vorbereitet, anwaltlich geprüft, mit einem Klick versendet." },
    { ueber: "Schicht 3 · Zugang", h: <>Dann die <span className="dk-verlauf">Tür.</span></>, satz: "Girokonto, Kreditkarte bis 25.000 €, Finanzierung. Konto in zwei Minuten, Einsicht in 24 Stunden." },
  ];

  // Video: stumm, in Schleife, nur sichtbar laufen lassen
  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = true; v.defaultMuted = true; v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
    const spielen = () => { if (!ruhe && v.paused) v.play().catch(() => {}); };
    v.addEventListener("loadeddata", spielen);
    // iOS im Stromsparmodus spielt erst nach einer Berührung — die erste genügt.
    const beruehrt = () => { spielen(); window.removeEventListener("touchstart", beruehrt); };
    window.addEventListener("touchstart", beruehrt, { passive: true });
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) spielen(); else v.pause(); }, { threshold: 0.05 });
    io.observe(v);
    const sicht = () => { if (document.hidden) v.pause(); else spielen(); };
    document.addEventListener("visibilitychange", sicht);
    spielen();
    return () => { io.disconnect(); document.removeEventListener("visibilitychange", sicht); v.removeEventListener("loadeddata", spielen); window.removeEventListener("touchstart", beruehrt); };
  }, [ruhe, handy]);

  // Textmomente: alle sechs Sekunden weiter (nicht bei reduzierter Bewegung, nicht im Hintergrund)
  useEffect(() => {
    if (ruhe) return;
    const t = window.setInterval(() => {
      if (document.hidden) return;
      setMoment((m) => { setVorher(m); return (m + 1) % ANZAHL; });
    }, DAUER);
    return () => window.clearInterval(t);
  }, [ruhe]);
  useEffect(() => { if (vorher == null) return; const t = window.setTimeout(() => setVorher(null), 700); return () => window.clearTimeout(t); }, [vorher]);

  const springen = (i: number) => { if (i === moment) return; setVorher(moment); setMoment(i); };
  const aktuell = MOMENTE[moment];

  return (
    <section className="flug flug-film" style={{ height: Math.max(560, hoehe) }}>
      <img className="flug-poster" src={handy ? "/kino/flug-start-m.jpg" : "/kino/flug-start.jpg"} alt="" aria-hidden="true" style={{ opacity: bereit ? 0 : 1 }} decoding="async" fetchPriority="high" />
      <video ref={videoRef} className="flug-video" src={handy ? "/kino/flug-m.mp4" : "/kino/flug.mp4"} muted loop playsInline autoPlay preload="auto"
             onPlaying={() => setBereit(true)} onCanPlay={() => setBereit(true)} style={{ opacity: bereit ? 1 : 0 }} aria-hidden="true" />
      <div className="flug-schleier" />
      <div className="flug-lichtkegel" aria-hidden="true" />

      {/* Land — oben, immer sichtbar */}
      <div className="flug-land" role="group" aria-label="Land wählen">
        {LAENDER.map((l) => (
          <button key={l} type="button" data-an={land === l ? "1" : undefined} onClick={() => landWaehlen(l)}>{LANDNAME[l]}</button>
        ))}
      </div>

      <div className="flug-mitte">
        <div className="flug-momente" aria-live="polite">
          {vorher != null && (
            <div className="flug-text raus" aria-hidden="true">
              <p className="flug-ueber">{MOMENTE[vorher].ueber}</p>
              <h2 className="flug-h1">{MOMENTE[vorher].h}</h2>
              <p className="flug-satz">{MOMENTE[vorher].satz}</p>
            </div>
          )}
          <div className="flug-text rein" key={moment}>
            <p className="flug-ueber">{aktuell.ueber}</p>
            {moment === 0 ? <h1 className="flug-h1">{aktuell.h}</h1> : <h2 className="flug-h1">{aktuell.h}</h2>}
            <p className="flug-satz">{aktuell.satz}</p>
          </div>
        </div>
        <div className="dk-knoepfe flug-knoepfe">{knoepfe}</div>
        <div className="flug-punkte" role="tablist" aria-label="Textmomente">
          {MOMENTE.map((_, i) => <button key={i} type="button" role="tab" aria-selected={i === moment} data-an={i === moment ? "1" : undefined} onClick={() => springen(i)} aria-label={`Moment ${i + 1}`}><i style={{ animationDuration: `${DAUER}ms` }} /></button>)}
        </div>
      </div>

      <div className="kino-scroll" aria-hidden="true"><span /></div>
    </section>
  );
}
