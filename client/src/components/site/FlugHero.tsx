// ═══════════════════════════════════════════════════════════════════════════
// FlugHero — der cinematische Eintritt (22./23.08.2026, nach scroll-world).
//
// Die Kamera ist der Scroll. Statt ein Video zu spulen (ruckelt, zeigt auf
// iOS einen Play-Knopf), liegt der Anflug als 80 Einzelbilder (WebP) vor und
// wird auf eine Leinwand gezeichnet — die Technik der Apple-Produktseiten:
// jedes Bild sofort da, kein Decoder-Sprung, kein Bedienelement.
//   Rechner: /kino/flug/d/001..080.webp (1280 px, 16:9)
//   Handy:   /kino/flug/m/001..080.webp (540 px, 9:16, nativ hochkant)
// Das erste Bild kommt sofort, der Rest lädt im Hintergrund nach; gezeichnet
// wird immer das nächste bereits geladene Bild. Zwischen den Bildern wird
// weich nachgezogen, damit auch schnelles Scrollen flüssig wirkt.
//
// Abschnitt 320 vh hoch, die Bühne klebt. Wenig Text: ein Satz am Anfang,
// ein Satz in der Mitte, die Knöpfe am Ende. Land (DE/AT/CH) erkannt und
// umschaltbar — der Antrag liest dieselbe Vorauswahl (sessionStorage).
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import { landErkennen, LANDNAME } from "@/lib/land-erkennen";

const LAENDER = ["DE", "AT", "CH"] as const;
const AUSKUNFTEI: Record<string, string> = { DE: "SCHUFA", AT: "KSV", CH: "CRIF" };
const BILDER = 80;

export function FlugHero({ knoepfe }: { knoepfe: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bilder = useRef<(HTMLImageElement | null)[]>(Array(BILDER).fill(null));
  const pRef = useRef(0);
  const istRef = useRef(0);
  const letztes = useRef(-1);
  const [p, setP] = useState(0);
  const [land, setLand] = useState<string>("DE");
  const [bereit, setBereit] = useState(false);
  const ruhe = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const handy = typeof window !== "undefined" && window.innerWidth < 768;
  const ordner = handy ? "/kino/flug/m" : "/kino/flug/d";
  const pfad = (i: number) => `${ordner}/${String(i + 1).padStart(3, "0")}.webp`;

  useEffect(() => { landErkennen().then((l) => { if (l && (LAENDER as readonly string[]).includes(l)) setLand(l); }).catch(() => {}); }, []);
  const landWaehlen = (l: string) => { setLand(l); try { sessionStorage.setItem("fiaon_land", l); } catch { /* egal */ } };

  /** Nächstes bereits geladenes Bild zu Index i (erst rückwärts, dann vorwärts). */
  const naechstes = (i: number): [HTMLImageElement | null, number] => {
    for (let d = 0; d < BILDER; d++) {
      if (bilder.current[i - d]) return [bilder.current[i - d], i - d];
      if (bilder.current[i + d]) return [bilder.current[i + d], i + d];
    }
    return [null, i];
  };
  const cover = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, W: number, H: number) => {
    const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  };
  /** Zeichnet die Position t (Bruchteil zwischen zwei Bildern): Bild a voll, Bild b darüber mit Anteil — so fließt es auch zwischen den Bildern. */
  const zeichne = (t: number) => {
    const c = canvasRef.current; if (!c) return;
    const i = Math.floor(t), anteil = t - i;
    const [a, ka] = naechstes(i); if (!a) return;
    const [b, kb] = naechstes(Math.min(BILDER - 1, i + 1));
    const schluessel = ka * 1000 + (b && kb !== ka ? Math.round(anteil * 40) : 0);
    if (schluessel === letztes.current) return;
    letztes.current = schluessel;
    const ctx = c.getContext("2d"); if (!ctx) return;
    const W = c.width, H = c.height;
    ctx.globalAlpha = 1; cover(ctx, a, W, H);
    if (b && kb !== ka && anteil > 0.02) { ctx.globalAlpha = anteil; cover(ctx, b, W, H); ctx.globalAlpha = 1; }
  };

  // Leinwandgröße an das Fenster (mit Pixeldichte, gedeckelt)
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const groesse = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.round(c.clientWidth * dpr); c.height = Math.round(c.clientHeight * dpr);
      letztes.current = -1; zeichne(istRef.current);
    };
    groesse();
    const ro = new ResizeObserver(groesse); ro.observe(c);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bilder laden: das erste sofort, dann der Rest mit vier Leitungen
  useEffect(() => {
    let weg = false;
    const lade = (i: number) => new Promise<void>((res) => {
      const img = new Image(); img.decoding = "async";
      img.onload = () => { if (!weg) { bilder.current[i] = img; if (i === 0) { setBereit(true); letztes.current = -1; zeichne(0); } else if (Math.abs(i - istRef.current) < 1.5) { letztes.current = -1; zeichne(istRef.current); } } res(); };
      img.onerror = () => res();
      img.src = pfad(i);
    });
    (async () => {
      await lade(0);
      let naechstes = 1;
      const leitung = async () => { while (!weg && naechstes < BILDER) { const i = naechstes++; await lade(i); } };
      await Promise.all([leitung(), leitung(), leitung(), leitung()]);
      if (!weg) { letztes.current = -1; zeichne(istRef.current); }
    })();
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordner]);

  // Scroll → Fortschritt 0..1 (die App scrollt in #root — deshalb Capture am Dokument)
  useEffect(() => {
    const fn = () => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const strecke = el.offsetHeight - window.innerHeight;
      const wert = Math.min(1, Math.max(0, -r.top / Math.max(1, strecke)));
      if (Math.abs(wert - pRef.current) < 0.0005) return;
      pRef.current = wert; setP(wert);
      if (ruhe) { istRef.current = wert * (BILDER - 1); zeichne(istRef.current); }
    };
    fn(); document.addEventListener("scroll", fn, { passive: true, capture: true }); window.addEventListener("resize", fn);
    return () => { document.removeEventListener("scroll", fn, { capture: true } as EventListenerOptions); window.removeEventListener("resize", fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruhe]);

  // Weich nachziehen und zeichnen
  useEffect(() => {
    if (ruhe) return;
    let raf = 0, aktiv = true;
    const lauf = () => {
      if (!aktiv) return;
      raf = requestAnimationFrame(lauf);
      const ziel = pRef.current * (BILDER - 1);
      const diff = ziel - istRef.current;
      if (Math.abs(diff) < 0.004) return;
      istRef.current += diff * 0.16;
      zeichne(istRef.current);
    };
    lauf();
    return () => { aktiv = false; cancelAnimationFrame(raf); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ruhe]);

  const sicht = (von: number, bis: number, rand = 0.08) => {
    if (p < von - rand || p > bis + rand) return 0;
    if (p < von) return (p - (von - rand)) / rand;
    if (p > bis) return 1 - (p - bis) / rand;
    return 1;
  };

  return (
    <section ref={ref} className="flug" style={{ height: "320vh" }}>
      <div className="flug-buehne">
        <canvas ref={canvasRef} className="flug-leinwand" style={{ opacity: bereit ? 1 : 0 }} aria-hidden="true" />
        <div className="flug-schleier" style={{ opacity: 0.35 + p * 0.25 }} />

        {/* Land — oben, immer sichtbar */}
        <div className="flug-land" role="group" aria-label="Land wählen">
          {LAENDER.map((l) => (
            <button key={l} type="button" data-an={land === l ? "1" : undefined} onClick={() => landWaehlen(l)}>{LANDNAME[l]}</button>
          ))}
        </div>

        {/* Satz 1 */}
        <div className="flug-text" style={{ opacity: sicht(0, 0.28), transform: `translate(-50%, calc(-50% - ${p * 60}px))` }}>
          <p className="flug-ueber">Bonität in {LANDNAME[land]} · Auskunft: {AUSKUNFTEI[land]}</p>
          <h1 className="flug-h1">Wissen, was <span className="dk-verlauf">über Sie</span> gespeichert ist.</h1>
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
