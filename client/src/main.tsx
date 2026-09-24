import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// 19.09.2026 (E-191): Microsoft Clarity lief hier bei jedem Aufruf — ohne
// Einwilligung, obwohl Cookie-Seite und Datenschutzerklärung „keine Analyse-
// Tools" versprachen. Clarity lädt jetzt erst nach Zustimmung zur Statistik:
// client/src/lib/werbung.ts, Hinweis in components/site/EinwilligungsHinweis.tsx.

// ═══════════════════════════════════════════════════════════════════════════
// KEIN ZOOMEN AM TELEFON — AUCH NICHT AUF DEM iPHONE
//
// Justin, 24.08.2026: „Und am Handy nirgendwo raus- oder reinzoomen erlauben,
// auf keiner Seite!"
//
// Das Viewport-Meta trägt `maximum-scale=1, user-scalable=no` — und iOS Safari
// IGNORIERT beides seit iOS 10 aus Barrierefreiheitsgründen. Auf dem iPhone
// (dem Gerät, auf dem unsere Mitarbeiter tatsächlich arbeiten) zoomt die Seite
// also weiterhin, sobald zwei Finger sie berühren. Genau das passiert beim
// Wischen im Kalender oder beim Ziehen der Anrufbühne — und danach steht die
// Oberfläche schief, bis jemand doppeltippt.
//
// WebKit meldet Kneifgesten als `gesturestart` / `gesturechange` /
// `gestureend`. Wer sie abfängt, verhindert das Zoomen, ohne Scrollen oder
// Wischen anzufassen: Diese Ereignisse gibt es NUR für Zoom und Drehung.
// Zusätzlich wird der Doppeltipp abgefangen — er ist der zweite Weg zum Zoom
// und in einer Oberfläche voller Knöpfe ohnehin nur eine Quelle für Fehltipps.
//
// Bewusst NICHT über `touchmove` mit mehreren Fingern: Damit bräche man auch
// das seitliche Wischen im Karussell und in der Wochenansicht.
// ═══════════════════════════════════════════════════════════════════════════
function zoomAmTelefonSperren() {
  const stop = (e: Event) => e.preventDefault();
  document.addEventListener("gesturestart", stop, { passive: false });
  document.addEventListener("gesturechange", stop, { passive: false });
  document.addEventListener("gestureend", stop, { passive: false });

  // Doppeltipp: Zwei Berührungen innerhalb von 300 ms zoomen in WebKit heran.
  // Wir unterdrücken NUR die zweite, wenn sie schnell genug folgt — ein
  // normaler Tipp und ein Doppelklick auf Text bleiben unberührt.
  let letzte = 0;
  document.addEventListener("touchend", (e) => {
    const jetzt = Date.now();
    if (jetzt - letzte <= 300) e.preventDefault();
    letzte = jetzt;
  }, { passive: false });
}
zoomAmTelefonSperren();

// ═══════════════════════════════════════════════════════════════════════════
// ERST DAS STILBLATT, DANN DIE APP (24.09.2026)
//
// Das Haupt-Stilblatt lädt seit heute, ohne das erste Bild zu sperren
// (vite.config.ts, „stilblattOhneSperre"), damit das Vorab-HTML sofort in der
// Farbe der Seite steht statt weiß. Vorher wartete dieses Skript automatisch
// darauf (ein sperrendes Stilblatt hält auch Modul-Skripte an) — das
// übernimmt jetzt diese Schranke. Ohne sie könnte React auf einer langsamen
// Leitung ungestaltet erscheinen. Im Dev-Server gibt es den Link nicht.
// ═══════════════════════════════════════════════════════════════════════════
function stilblattBereit(): Promise<void> {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-fiaon-stil]"));
  return Promise.all(links.map((link) => new Promise<void>((fertig) => {
    const anwenden = () => { link.media = "all"; fertig(); };
    if (link.sheet) return anwenden();
    link.addEventListener("load", anwenden, { once: true });
    // Fehlgeschlagen: nicht ewig warten — die App startet, wie sie es bei einem 404 auch vorher tat.
    link.addEventListener("error", () => fertig(), { once: true });
  }))).then(() => undefined);
}

stilblattBereit().then(() => createRoot(document.getElementById("root")!).render(<App />));
