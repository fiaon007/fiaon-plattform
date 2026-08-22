// ═══════════════════════════════════════════════════════════════════════════
// FlugHero — der cinematische Eintritt (22.08.2026, nach scroll-world).
//
// Die Kamera ist der Scroll: Ein Video (Anflug aus dem Orbit über DACH, durch
// die Glasfassade, bis zum KI-Hirn) wird nicht abgespielt, sondern mit der
// Scroll-Position durchgespult (video.currentTime). Der Abschnitt ist 320 vh
// hoch, die Bühne klebt (sticky) — man fliegt, solange man scrollt.
// Wenig Text: ein Satz am Anfang, ein Satz in der Mitte, die Knöpfe am Ende.
// Land (DE/AT/CH) wird erkannt und kann oben umgeschaltet werden — der Antrag
// liest dieselbe Vorauswahl (sessionStorage „fiaon_land").
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { landErkennen, LANDNAME } from "@/lib/land-erkennen";

const LAENDER = ["DE", "AT", "CH"] as const;
const AUSKUNFTEI: Record<string, string> = { DE: "SCHUFA", AT: "KSV", CH: "CRIF" };

export function FlugHero({ video, bild, knoepfe }: { video: string; bild: string; knoepfe: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [p, setP] = useState(0);
  const [land, setLand] = useState<string>("DE");
  const [bereit, setBereit] = useState(false);
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // Am Handy die 720p-Fassung (halb so groß), am Rechner 1600 px.
  const quelle = typeof window !== "undefined" && window.innerWidth < 768 ? video.replace(/\.mp4$/, "-m.mp4") : video;

  useEffect(() => { landErkennen().then((l) => { if (l && (LAENDER as readonly string[]).includes(l)) setLand(l); }).catch(() => {}); }, []);
  const landWaehlen = (l: string) => { setLand(l); try { sessionStorage.setItem("fiaon_land", l); } catch { /* egal */ } };

  // Scroll → Fortschritt 0..1 über die Höhe des Abschnitts (abzüglich einer Bildschirmhöhe, die klebt)
  useEffect(() => {
    let raf = 0;
    const fn = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const strecke = el.offsetHeight - window.innerHeight;
      setP(Math.min(1, Math.max(0, -r.top / Math.max(1, strecke))));
    }); };
    fn(); window.addEventListener("scroll", fn, { passive: true }); window.addEventListener("resize", fn);
    return () => { window.removeEventListener("scroll", fn); window.removeEventListener("resize", fn); cancelAnimationFrame(raf); };
  }, []);

  // Fortschritt → Videozeit, weich nachgezogen (kein Ruckeln beim schnellen Scrollen)
  useEffect(() => {
    const v = videoRef.current; if (!v || ruhe) return;
    let ziel = 0, ist = 0, raf = 0, aktiv = true;
    const lauf = () => {
      if (!aktiv) return;
      raf = requestAnimationFrame(lauf);
      const dauer = v.duration; if (!dauer || !isFinite(dauer)) return;
      ziel = p * (dauer - 0.05);
      ist += (ziel - ist) * 0.12;
      if (Math.abs(v.currentTime - ist) > 0.02 && v.readyState >= 2) { try { v.currentTime = ist; } catch { /* noch nicht bereit */ } }
    };
    lauf();
    return () => { aktiv = false; cancelAnimationFrame(raf); };
  }, [p, ruhe]);

  const sicht = (von: number, bis: number, rand = 0.08) => {
    if (p < von - rand || p > bis + rand) return 0;
    if (p < von) return (p - (von - rand)) / rand;
    if (p > bis) return 1 - (p - bis) / rand;
    return 1;
  };

  return (
    <section ref={ref} className="flug" style={{ height: "320vh" }}>
      <div className="flug-buehne">
        {!ruhe && (
          <video ref={videoRef} className="flug-video" src={quelle} poster={bild} muted playsInline preload="auto"
                 onLoadedData={() => setBereit(true)} style={{ opacity: bereit ? 1 : 0 }} />
        )}
        <img className="flug-poster" src={bild} alt="" style={{ opacity: bereit && !ruhe ? 0 : 1 }} />
        <div className="flug-schleier" style={{ opacity: 0.35 + p * 0.25 }} />

        {/* Land — oben, immer sichtbar */}
        <div className="flug-land" role="group" aria-label="Land wählen">
          {LAENDER.map((l) => (
            <button key={l} type="button" data-an={land === l ? "1" : undefined} onClick={() => landWaehlen(l)}>{LANDNAME[l]}</button>
          ))}
        </div>

        {/* Satz 1 */}
        <div className="flug-text" style={{ opacity: sicht(0, 0.28), transform: `translateY(${p * -60}px)` }}>
          <p className="flug-ueber">Bonität in {LANDNAME[land]}</p>
          <h1 className="flug-h1">Wissen, was die {AUSKUNFTEI[land]} <span className="dk-verlauf">über Sie</span> gespeichert hat.</h1>
        </div>

        {/* Satz 2 */}
        <div className="flug-text" style={{ opacity: sicht(0.42, 0.62) }}>
          <h2 className="flug-h1">Und es <span className="dk-verlauf">ändern.</span></h2>
          <p className="flug-satz">Löschanträge, Widersprüche, Ratenvereinbarungen – vorbereitet, anwaltlich geprüft, mit einem Klick versendet.</p>
        </div>

        {/* Ende: Zugang + Knöpfe */}
        <div className="flug-text" style={{ opacity: sicht(0.78, 1, 0.1), pointerEvents: p > 0.72 ? "auto" : "none" }}>
          <h2 className="flug-h1">Dann die <span className="dk-verlauf">Tür.</span></h2>
          <p className="flug-satz">Girokonto, Kreditkarte bis 25.000 €, Finanzierung. Konto in zwei Minuten, Einsicht in 24 Stunden.</p>
          <div className="dk-knoepfe" style={{ justifyContent: "center" }}>{knoepfe}</div>
        </div>

        <div className="kino-scroll" style={{ opacity: Math.max(0, 1 - p * 4) }} aria-hidden="true"><span /></div>
      </div>
    </section>
  );
}
