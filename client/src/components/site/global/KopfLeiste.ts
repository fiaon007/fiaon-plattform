// ═══════════════════════════════════════════════════════════════════════════
// DIE KOPFLEISTE DER ÖFFENTLICHEN GLOBAL-SEITEN (E-533, 25.11.2026)
//
// Justin wählte die „Linie“: eine hauchdünne Glasleiste über die ganze Breite, kleines ruhiges Schriftbild, großes Glas-Menü.
// Sie weicht beim Scrollen nach unten aus und kommt beim Zurückscrollen wieder — nie bei offenem Menü, nie bei „weniger Bewegung“.
//
// Die Leiste steuert das selbst: GlobalNav ruft useKopfLeiste() auf jeder öffentlichen Global-Seite — Startseite und
// Unterseiten tragen EINE Leiste (Justin 25.11. abends: „auch für den PC eine andere Menüleiste … cleaner und moderner“).
// Setzt html.kn-kopf (+ kn-kopf-weg beim Ausweichen); der Stil steht in styles/global-kopf.css.
//
// Vorschau der drei PC-Fassungen: ?leiste=a|b|c in der Adresse (bleibt beim Weiterklicken in diesem Tab) → html.kn-pc-a|b|c.
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect } from "react";
import { ruhigGewuenscht } from "@/components/site/global/bewegung";

export type PcLeiste = "a" | "b" | "c";
const SPEICHER = "fiaon_leiste_vorschau";

/** Die PC-Fassung zur Vorschau: aus der Adresse (?leiste=a|b|c), sonst die zuletzt in diesem Tab gewählte, sonst keine. */
export function pcLeisteWahl(): PcLeiste | null {
  if (typeof window === "undefined") return null;
  const ist = (x: string | null): x is PcLeiste => x === "a" || x === "b" || x === "c";
  const aus = new URLSearchParams(window.location.search).get("leiste");
  try {
    if (ist(aus)) { window.sessionStorage.setItem(SPEICHER, aus); return aus; }
    const gemerkt = window.sessionStorage.getItem(SPEICHER);
    if (ist(gemerkt)) return gemerkt;
  } catch { /* privates Fenster: nur die Adresse zählt */ }
  return ist(aus) ? aus : null;
}

/** Setzt die Linie (vor dem ersten Bild) und lässt sie beim Runterscrollen ausweichen. `aktiv`: nur auf öffentlichen Seiten. */
export function useKopfLeiste(aktiv: boolean) {
  useLayoutEffect(() => {
    if (!aktiv) return;
    const html = document.documentElement;
    const pc = pcLeisteWahl();
    const klassen = pc ? ["kn-kopf", `kn-pc-${pc}`] : ["kn-kopf"];
    html.classList.add(...klassen);
    let bild = 0, letzt = window.scrollY;
    const messen = () => {
      bild = 0;
      const y = window.scrollY;
      const offen = !!document.querySelector('.gk-panel:not([hidden]), #gk-mobil');
      if (offen || y < 140 || y < letzt - 4) html.classList.remove("kn-kopf-weg");
      else if (y > letzt + 4) html.classList.add("kn-kopf-weg");
      letzt = y;
    };
    const planen = () => { if (!bild) bild = requestAnimationFrame(messen); };
    if (!ruhigGewuenscht()) window.addEventListener("scroll", planen, { passive: true });
    return () => {
      window.removeEventListener("scroll", planen); cancelAnimationFrame(bild);
      html.classList.remove(...klassen, "kn-kopf-weg");
    };
  }, [aktiv]);
}
