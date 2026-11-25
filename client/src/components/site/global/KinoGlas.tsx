// ═══════════════════════════════════════════════════════════════════════════
// KINO-GLAS — das gemeinsame Glas- und Bewegungssystem der öffentlichen Global-Seiten (E-533, 25.11.2026)
//
// Justin (25.11.2026): „wie ein cinematisches Intro, einfach WOW und Gänsehaut“ — für Handy UND PC, viel mehr Apple-Glas,
// viel mehr Apple-Look, viel mehr und bessere Animationen und Scroll-Effekte. Maßstab ist die Startseite (E-521).
//
// Was hier steht (alles Weitere ist CSS in styles/global-kino.css):
//   useKinoEinstieg  Der Kino-Einstieg einer Bühne: data-kino="0" vor dem ersten Bild, "1" sobald der Ladebildschirm geht
//                    (nachLadebild, wie die Glas-Bühne der Startseite). Die Bühne baut sich dann in Stufen auf: Licht und
//                    Ring, Augenzeile, die Überschrift Wort für Wort, Lead, Knöpfe, Kennziffern, die schwebende Karteikarte.
//                    Ohne JS, im Vorab-HTML und bei „weniger Bewegung“ steht sofort das Endbild.
//   KinoWorte        Eine Überschrift Wort für Wort: Spannen um die Wörter, die Leerzeichen bleiben Text — der Satz bleibt
//                    Zeichen für Zeichen derselbe (Suchmaschinen, Screenreader, Kopieren).
//   useGlasZeiger    Licht und Neigung unter dem Zeiger (nur Maus und Trackpad): EIN Zuhörer an der Seite setzt am Glas unter
//                    dem Zeiger --kx/--ky (wo das Licht steht) und --nx/--ny (Neigung −1 … 1) — eine Messung je Bild.
//   KinoBuehne       Die Lichter, der Ring und die zwei Glasscheiben hinter einer Bühne (nur Schmuck, aria-hidden).
//
// Tiefe beim Scrollen (Parallax) ist reines CSS (animation-timeline: view()): Sie läuft auf dem Compositor, nur transform und
// opacity, nie an JS gekoppelt — kein Ruckeln. (Justin 23.08.: Das Spulen eines Films am Scrollrad „ruckelt ekelhaft“ —
// darum spult hier nichts, es verschieben sich nur Ebenen.) Inhalte erscheinen weiter EINMAL und zeitgesteuert (data-an).
// Regel aus E-346: nie filter oder opacity auf einem Vorfahren von Glas animieren (das schaltet backdrop-filter ab) —
// das Glas selbst blendet sich ein, seine Hülle steht still.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useLayoutEffect, type ReactNode, type RefObject } from "react";
import { nachLadebild, ruhigGewuenscht } from "@/components/site/global/bewegung";

/** Der Kino-Einstieg: data-kino="0" vor dem ersten Bild, "1" sobald der Ladebildschirm weg ist. */
export function useKinoEinstieg(ref: RefObject<HTMLElement | null>) {
  // useLayoutEffect: Der Startzustand steht vor dem ersten Bild — sonst blitzt die fertige Bühne kurz auf.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (ruhigGewuenscht()) { el.setAttribute("data-kino", "1"); return; }
    el.setAttribute("data-kino", "0");
    let bild = 0;
    let fertig = 0;
    const weg = nachLadebild(() => {
      // Zwei Bilder Abstand: Der Ladebildschirm beginnt seinen Ausgang, dann setzt der Auftakt ein (wie auf der Startseite).
      bild = requestAnimationFrame(() => { bild = requestAnimationFrame(() => el.setAttribute("data-kino", "1")); });
    });
    // Sicherung: Falls der Ladebildschirm nie geht (Fehler, Tab im Hintergrund), steht die Bühne nach 4 s trotzdem.
    fertig = window.setTimeout(() => el.setAttribute("data-kino", "1"), 4000);
    // Wer druckt oder per Tastatur hineinspringt, sieht sofort alles.
    const sofort = () => el.setAttribute("data-kino", "1");
    window.addEventListener("beforeprint", sofort);
    el.addEventListener("focusin", sofort, { once: true });
    return () => {
      weg(); cancelAnimationFrame(bild); window.clearTimeout(fertig);
      window.removeEventListener("beforeprint", sofort); el.removeEventListener("focusin", sofort);
    };
  }, [ref]);
}

/** Zählt die Wörter eines Satzes so, wie KinoWorte sie trennt — damit die zweite Zeile der Überschrift weiterzählt. */
export const kinoWortZahl = (text: string) => text.split(/[ \t\n\r]+/).filter(Boolean).length;

/**
 * Eine Überschrift Wort für Wort. Getrennt wird nur an gewöhnlichen Leerzeichen — ein geschütztes Leerzeichen („2.799 €“)
 * bleibt im Wort, damit nichts neu umbricht. Jedes Wort trägt seine Nummer (--w) für die Staffel im CSS.
 */
export function KinoWorte({ text, start = 0 }: { text: string; start?: number }): ReactNode {
  let n = start;
  return text.split(/([ \t\n\r]+)/).map((teil, i) => {
    if (!teil || /^[ \t\n\r]+$/.test(teil)) return teil;
    const w = n++;
    return <span key={i} className="kn-w" style={{ ["--w" as string]: w }}>{teil}</span>;
  });
}

/** Schmuck hinter einer Bühne: drei Lichter, ein Ring, zwei Glasscheiben. Steht still — nur der Bildlauf verschiebt Ebenen. */
export function KinoBuehne({ ring = true, scheiben = true }: { ring?: boolean; scheiben?: boolean }) {
  return (
    <div className="kn-buehne" aria-hidden="true">
      <i className="kn-licht a" /><i className="kn-licht b" /><i className="kn-licht c" />
      {ring && (
        <svg className="kn-ring" viewBox="0 0 600 600" focusable="false">
          <defs>
            <linearGradient id="kn-ring-verlauf" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
              <stop offset=".45" stopColor="#288dfa" stopOpacity=".55" />
              <stop offset="1" stopColor="#1d4ed8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <circle className="kn-ring-a" cx="300" cy="300" r="288" pathLength="100" />
          <circle className="kn-ring-b" cx="300" cy="300" r="236" pathLength="100" />
        </svg>
      )}
      {scheiben && <><span className="kn-scheibe a" /><span className="kn-scheibe b" /></>}
    </div>
  );
}

/** Welche Glasflächen dem Zeiger folgen (Licht + leichte Neigung). Ein Selektor für alle — keine Markierung je Baustein. */
const ZEIGER_ZIELE = [
  ".fd-karteikarte.breit", ".fd-karte", ".fd-rolle", ".fd-weiter-raster > a", ".fd-verzeichnis a", ".kn-glas",
  ".fd-gespraech-karte", ".gvt-liste > li", ".vk-karte", ".lp-karte", ".kn-zeiger",
].join(",");

/**
 * Licht und Neigung unter dem Zeiger — nur mit Maus oder Trackpad, nie am Telefon, nie bei „weniger Bewegung“.
 * Ein Zuhörer an der Wurzel der Seite; je Bild höchstens eine Messung (requestAnimationFrame).
 */
export function useGlasZeiger(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || ruhigGewuenscht() || !window.matchMedia?.("(hover: hover) and (pointer: fine)").matches) return;
    let bild = 0, x = 0, y = 0;
    let ziel: HTMLElement | null = null;
    const loesen = (t: HTMLElement | null) => {
      if (!t) return;
      t.style.removeProperty("--nx"); t.style.removeProperty("--ny");
      t.removeAttribute("data-zeiger");
    };
    const setzen = () => {
      bild = 0;
      if (!ziel) return;
      const r = ziel.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const px = Math.min(1, Math.max(0, (x - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (y - r.top) / r.height));
      ziel.style.setProperty("--kx", `${(px * 100).toFixed(1)}%`);
      ziel.style.setProperty("--ky", `${(py * 100).toFixed(1)}%`);
      ziel.style.setProperty("--nx", (px * 2 - 1).toFixed(3));
      ziel.style.setProperty("--ny", (py * 2 - 1).toFixed(3));
    };
    const bewegen = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
      const t = (e.target as Element | null)?.closest?.(ZEIGER_ZIELE) as HTMLElement | null;
      if (t !== ziel) { loesen(ziel); ziel = t; if (t) t.setAttribute("data-zeiger", "1"); }
      x = e.clientX; y = e.clientY;
      if (ziel && !bild) bild = requestAnimationFrame(setzen);
    };
    const raus = () => { loesen(ziel); ziel = null; };
    el.addEventListener("pointermove", bewegen, { passive: true });
    el.addEventListener("pointerleave", raus);
    window.addEventListener("blur", raus);
    return () => {
      cancelAnimationFrame(bild); raus();
      el.removeEventListener("pointermove", bewegen); el.removeEventListener("pointerleave", raus); window.removeEventListener("blur", raus);
    };
  }, [root]);
}
