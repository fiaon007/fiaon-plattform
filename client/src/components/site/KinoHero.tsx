// ═══════════════════════════════════════════════════════════════════════════
// KinoHero — der Einstieg der Startseite als Erlebnis (22.08.2026, Justin:
// „cinematisch, Gänsehaut, 3D, scroll-world").
//
// Drei Ebenen, die der Scroll gegeneinander bewegt (die Kamera ist der Scroll):
//   hinten  ein Video (am Rechner) bzw. ein Bild (am Handy) — gedimmt, mit
//           Schleier nach unten ins Nachtblau der Bühne
//   mitte   die FIAON-Karte als echter Körper (KartenSzene)
//   vorne   Text und Knöpfe
// Scrollt man, sinkt der Text langsamer als die Seite, das Video zoomt leicht,
// die Karte hebt sich — das gibt Tiefe ohne Effekthascherei.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import KartenSzene from "@/components/home3d/KartenSzene";

export function KinoHero({ pille, titel, lead, punkte, knoepfe, hinweis, video, bild }: {
  pille: string; titel: ReactNode; lead: ReactNode; punkte?: string[]; knoepfe: ReactNode; hinweis?: string; video?: string; bild: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [gross, setGross] = useState(false);
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const setze = () => setGross(mq.matches);
    setze(); mq.addEventListener("change", setze);
    return () => mq.removeEventListener("change", setze);
  }, []);

  useEffect(() => {
    if (ruhe) return;
    let raf = 0;
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const h = ref.current?.offsetHeight || window.innerHeight;
      setP(Math.min(1, Math.max(0, window.scrollY / h)));
    }); };
    fn(); window.addEventListener("scroll", fn, { passive: true });
    return () => { window.removeEventListener("scroll", fn); cancelAnimationFrame(raf); };
  }, [ruhe]);

  return (
    <section ref={ref} className="kino-hero">
      <div className="kino-hintergrund" style={{ transform: `scale(${1 + p * 0.12}) translateY(${p * 60}px)` }} aria-hidden="true">
        {gross && video && !ruhe
          ? <video className="kino-medium" src={video} poster={bild} autoPlay muted loop playsInline preload="metadata" />
          : <img className="kino-medium" src={bild} alt="" decoding="async" {...({ fetchpriority: "high" } as any)} />}
        <div className="kino-schleier" />
      </div>

      <div className="dk-rahmen kino-inhalt">
        <div className="kino-text" style={{ transform: `translateY(${p * -90}px)`, opacity: 1 - p * 1.1 }}>
          <span className="dk-pille">{pille}</span>
          <h1 className="dk-h1">{titel}</h1>
          <p className="dk-lead">{lead}</p>
          {punkte && (
            <ul className="kino-punkte">
              {punkte.map((t) => (
                <li key={t}><span className="haken" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg></span>{t}</li>
              ))}
            </ul>
          )}
          <div className="dk-knoepfe">{knoepfe}</div>
          {hinweis && <p className="dk-leise" style={{ marginTop: 16 }}>{hinweis}</p>}
        </div>
        <div className="kino-szene" style={{ transform: `translateY(${p * -140}px)`, opacity: 1 - p * 0.9 }}>
          <KartenSzene anzahl={1} className="absolute inset-0" />
        </div>
      </div>

      <div className="kino-scroll" style={{ opacity: 1 - p * 3 }} aria-hidden="true"><span /></div>
    </section>
  );
}
