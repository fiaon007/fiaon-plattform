// ═══════════════════════════════════════════════════════════════════════════
// FlugHero — der cinematische Eintritt (22.08.2026, nach scroll-world).
//
// Die Kamera ist der Scroll: Ein Video (Anflug aus dem Orbit über DACH, durch
// die Glasfassade, bis zum KI-Hirn) wird nicht abgespielt, sondern mit der
// Scroll-Position durchgespult (video.currentTime). Der Abschnitt ist 320 vh
// hoch, die Bühne klebt (sticky) — man fliegt, solange man scrollt.
//
// Damit das überall flüssig ist: Das Video wird EINMAL komplett geladen (Blob)
// — erst dann wird gespult, denn Spulen in nicht geladene Bereiche bleibt hängen.
// Bis dahin läuft das Video einfach als Film (nie ein stehendes Bild).
// iOS braucht ein kurzes play()/pause(), bevor es Einzelbilder zeigt.
//
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
  const pRef = useRef(0);
  const [p, setP] = useState(0);
  const [land, setLand] = useState<string>("DE");
  const [modus, setModus] = useState<"film" | "spulen">("film");
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const handy = typeof window !== "undefined" && window.innerWidth < 768;
  const quelle = handy ? video.replace(/\.mp4$/, "-m.mp4") : video;
  const poster = handy ? bild.replace(/\.jpg$/, "-m.jpg") : bild;

  useEffect(() => { landErkennen().then((l) => { if (l && (LAENDER as readonly string[]).includes(l)) setLand(l); }).catch(() => {}); }, []);
  const landWaehlen = (l: string) => { setLand(l); try { sessionStorage.setItem("fiaon_land", l); } catch { /* egal */ } };

  // Scroll → Fortschritt 0..1 über die Strecke des Abschnitts (abzüglich der klebenden Bildschirmhöhe)
  useEffect(() => {
    // Direkt rechnen, nicht erst im nächsten Frame — das Spulen soll am Finger hängen.
    const raf = 0;
    const fn = () => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const strecke = el.offsetHeight - window.innerHeight;
      const wert = Math.min(1, Math.max(0, -r.top / Math.max(1, strecke)));
      if (Math.abs(wert - pRef.current) < 0.0005) return;
      pRef.current = wert; setP(wert);
    };
    // Die App scrollt in #root (html/body/#root haben overflow-y:auto), nicht im Fenster —
    // deshalb Scroll-Ereignisse im Capture-Modus am Dokument abgreifen: so kommen sie
    // an, egal welches Element scrollt.
    fn(); document.addEventListener("scroll", fn, { passive: true, capture: true }); window.addEventListener("resize", fn);
    return () => { document.removeEventListener("scroll", fn, { capture: true } as EventListenerOptions); window.removeEventListener("resize", fn); cancelAnimationFrame(raf); };
  }, []);

  // Video komplett laden, dann in den Spul-Modus wechseln
  useEffect(() => {
    const v = videoRef.current; if (!v || ruhe) return;
    let url: string | null = null; let weg = false;
    (async () => {
      try {
        const r = await fetch(quelle, { cache: "force-cache" });
        if (!r.ok) return;
        const blob = await r.blob();
        if (weg) return;
        url = URL.createObjectURL(blob);
        v.pause();
        v.src = url;
        v.load();
        await new Promise<void>((res) => { const f = () => { v.removeEventListener("loadeddata", f); res(); }; v.addEventListener("loadeddata", f); });
        // iOS: erst nach play/pause liefert das Video Einzelbilder beim Spulen
        try { await v.play(); v.pause(); } catch { /* Autoplay verweigert — Spulen geht trotzdem */ }
        if (!weg) setModus("spulen");
      } catch { /* bleibt im Film-Modus */ }
    })();
    return () => { weg = true; if (url) URL.revokeObjectURL(url); };
  }, [quelle, ruhe]);

  // Spul-Modus: Fortschritt → Videozeit, weich nachgezogen, nie in ein laufendes Spulen hinein
  useEffect(() => {
    const v = videoRef.current; if (!v || ruhe || modus !== "spulen") return;
    let ist = 0, raf = 0, aktiv = true;
    const lauf = () => {
      if (!aktiv) return;
      raf = requestAnimationFrame(lauf);
      const dauer = v.duration; if (!dauer || !isFinite(dauer)) return;
      const ziel = pRef.current * (dauer - 0.06);
      ist += (ziel - ist) * 0.14;
      if (!v.seeking && Math.abs(v.currentTime - ist) > 0.012) { try { v.currentTime = ist; } catch { /* noch nicht bereit */ } }
    };
    lauf();
    return () => { aktiv = false; cancelAnimationFrame(raf); };
  }, [modus, ruhe]);

  const sicht = (von: number, bis: number, rand = 0.08) => {
    if (p < von - rand || p > bis + rand) return 0;
    if (p < von) return (p - (von - rand)) / rand;
    if (p > bis) return 1 - (p - bis) / rand;
    return 1;
  };

  return (
    <section ref={ref} className="flug" style={{ height: "320vh" }}>
      <div className="flug-buehne">
        {!ruhe ? (
          <video ref={videoRef} className="flug-video" src={quelle} poster={poster} muted playsInline preload="auto"
                 autoPlay={modus === "film"} loop={modus === "film"} />
        ) : (
          <img className="flug-poster" src={poster} alt="" />
        )}
        <div className="flug-schleier" style={{ opacity: 0.35 + p * 0.25 }} />

        {/* Land — oben, immer sichtbar */}
        <div className="flug-land" role="group" aria-label="Land wählen">
          {LAENDER.map((l) => (
            <button key={l} type="button" data-an={land === l ? "1" : undefined} onClick={() => landWaehlen(l)}>{LANDNAME[l]}</button>
          ))}
        </div>

        {/* Satz 1 */}
        <div className="flug-text" style={{ opacity: sicht(0, 0.28), transform: `translate(-50%, calc(-50% - ${p * 60}px))` }}>
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
