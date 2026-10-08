// ═══════════════════════════════════════════════════════════════════════════
// DER HERO MIT DEM GLAS DER KUNDIN (E-301)
//
// Justin (07.10.2026): „Vielleicht ein Glas von ihr, das sich beim Scrollen
// öffnet.“ Der Abschnitt ist hoch (CSS: 230 vh), darin eine Bühne
// position: sticky; top: 0; height: 100svh. Der Scroll-Fortschritt durch den
// Abschnitt (0…1) steuert das Glas (glas-szene.ts) und — als CSS-Variable --p
// an der Bühne — das Ausblenden des Hero-Textes und das Erscheinen der Zeile
// aus dem Licht (seite.phasen.titel). Vorfahren der Bühne dürfen kein
// overflow-x:hidden tragen (sonst klebt sticky nicht); der Rahmen nutzt clip.
//
// three.js kommt per import() als eigener Chunk, erst wenn WebGL da ist und
// „weniger Bewegung“ nicht gewünscht ist. Bis dahin — und als Rückfall — steht
// das echte Produktfoto (glas.foto) an derselben Stelle; dann ist der Abschnitt
// nur so hoch wie sein Inhalt, ohne Scroll-Bühne.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { GlasKonfig } from "@shared/fiaon-global-angebot-firma-typen";
import { beobachteSichtbar } from "@/components/site/global/bewegung";
import { ruhig, useScrollFortschritt } from "./gemeinsam";
import type { GlasSzene } from "./glas-szene";

const webglDa = () => {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; }
};
/** Gestapelt (Text oben, Glas unten) bei schmalen oder hochkanten Fenstern — GENAU die Medienabfrage aus dem CSS. */
const STAPEL = "(max-width: 899.98px), (orientation: portrait)";
/** Wo das Glas steht (NDC): Rechner rechts, gestapelt unten — jeweils zu Beginn und am Ende der Bühne. */
const lageSetzen = (s: GlasSzene) => { if (gestapelt()) s.lage(0, -0.36, 0, -0.08); else s.lage(0.44, -0.02, 0, -0.06); };
const gestapelt = () => { try { return window.matchMedia(STAPEL).matches; } catch { return window.innerWidth < 900; } };

export default function ProduktGlas3D({ glas, children, nach, wegZeile, wegSub, bereit }: {
  glas: GlasKonfig | null;
  /** Auge, Titel, Unterzeile, Nutzen — liegen links (Rechner) bzw. oben (Handy) auf der Bühne. */
  children: ReactNode;
  /** Was am Handy unter der Bühne steht (Nutzen) — auf der gestapelten Bühne wäre dafür kein Platz. */
  nach?: ReactNode;
  /** Die Zeile, die aus dem Licht erscheint (seite.phasen.titel) und die Unterzeile dazu. */
  wegZeile: string;
  wegSub?: string;
  /** Der Auftakt ist weg — erst dann bauen sich Text und Glas auf. */
  bereit: boolean;
}) {
  const sektion = useRef<HTMLElement>(null);
  const buehne = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const szene = useRef<GlasSzene | null>(null);
  const [modus, setModus] = useState<"foto" | "laedt" | "3d">(() => (glas && !ruhig() && webglDa() ? "laedt" : "foto"));
  const [stapel, setStapel] = useState(() => gestapelt());

  useScrollFortschritt(sektion, (p) => {
    const b = buehne.current;
    if (!b) return;
    b.style.setProperty("--p", p.toFixed(4));
    szene.current?.setzen(p);
  });

  // three.js laden und die Szene bauen; aufräumen beim Verlassen.
  useEffect(() => {
    if (modus === "foto" || !glas || !canvas.current) return;
    let aus = false;
    let stoppSicht = () => {};
    const zeiger = (e: PointerEvent) => szene.current?.zeiger((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    const fein = window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
    (async () => {
      try {
        const { glasSzeneBauen } = await import("./glas-szene");
        if (aus || !canvas.current) return;
        const s = await glasSzeneBauen(canvas.current, glas, gestapelt());
        if (aus) { s.dispose(); return; }
        szene.current = s;
        lageSetzen(s);
        const r = sektion.current?.getBoundingClientRect();
        if (r) s.setzen(Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight))));
        stoppSicht = beobachteSichtbar(buehne.current!, (an) => s.takt(an));
        if (fein) window.addEventListener("pointermove", zeiger, { passive: true });
        setModus("3d");
      } catch {
        if (!aus) setModus("foto");
      }
    })();
    return () => {
      aus = true;
      stoppSicht();
      window.removeEventListener("pointermove", zeiger);
      szene.current?.dispose();
      szene.current = null;
    };
    // Die Szene wird genau einmal gebaut (Wechsel foto ↔ Glas); ein anderes Glas lädt die Seite ohnehin neu.
  }, [modus === "foto"]);

  // Größe und Lage nachführen (Drehen des Handys, Fenster ziehen).
  useEffect(() => {
    const bei = () => {
      const st = gestapelt();
      setStapel(st);
      szene.current?.groesse();
      if (szene.current) lageSetzen(szene.current);
    };
    window.addEventListener("resize", bei);
    return () => window.removeEventListener("resize", bei);
  }, []);

  const foto = glas?.foto;
  return (
    <>
    <section ref={sektion} className={`gaf-hero gaf-hero--${modus === "foto" ? "foto" : "glas"}${bereit ? " bereit" : ""}`} data-fiaon="firma-hero" aria-label={wegZeile}>
      <div ref={buehne} className="gaf-hero-buehne" data-gestapelt={stapel ? "1" : "0"} data-modus={modus}>
        <div className="gaf-hero-licht" aria-hidden="true" />
        <div className="gaf-hero-text">{children}</div>
        <div className="gaf-hero-glas">
          {modus !== "foto" && <canvas ref={canvas} className="gaf-hero-canvas" role="img" aria-label={glas?.name ?? ""} />}
          {foto && (
            <img className="gaf-hero-foto" src={foto.src} srcSet={foto.srcset} sizes="(max-width: 900px) 90vw, 46vw" width={foto.breite} height={foto.hoehe}
              alt={modus === "3d" ? "" : foto.alt} aria-hidden={modus === "3d" || undefined} decoding="async" {...({ fetchpriority: "high" } as Record<string, string>)} />
          )}
        </div>
        {modus !== "foto" && (
          <div className="gaf-hero-weg" aria-hidden="true">
            <p className="gaf-hero-weg-zeile">{wegZeile}</p>
            {wegSub && <p className="gaf-hero-weg-sub">{wegSub}</p>}
          </div>
        )}
        {modus !== "foto" && (
          <span className="gaf-hero-scroll" aria-hidden="true"><i /></span>
        )}
      </div>
    </section>
    {nach && <div className={`gaf-hero-nach gaf-hero-nach--${modus}`}><div className="gaf-rahmen">{nach}</div></div>}
    </>
  );
}
