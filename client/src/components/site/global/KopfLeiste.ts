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
// Am PC (Justins Wahl 25.11. abends aus drei Vorschlägen): „Linie · ein Menü“ — in der Linie nur Marke, Gespräch, Angebot und
// „Menü“; das Menü ist ein großes Glasblatt mit allen vier Themen nebeneinander. Stil: styles/global-kopf.css (ab 1121 px).
// ═══════════════════════════════════════════════════════════════════════════
import { useLayoutEffect } from "react";
import { ruhigGewuenscht } from "@/components/site/global/bewegung";

/** Setzt die Linie (vor dem ersten Bild) und lässt sie beim Runterscrollen ausweichen. `aktiv`: nur auf öffentlichen Seiten. */
export function useKopfLeiste(aktiv: boolean) {
  useLayoutEffect(() => {
    if (!aktiv) return;
    const html = document.documentElement;
    html.classList.add("kn-kopf");
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
      html.classList.remove("kn-kopf", "kn-kopf-weg");
    };
  }, [aktiv]);
}
