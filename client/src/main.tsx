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
// ═══════════════════════════════════════════════════════════════════════════
// NACH EINEM DEPLOY: NEU LADEN STATT UNGESTALTET (06.10.2026, E-291)
//
// Justin, iPhone, 00:33 — eine Minute nach dem Deploy: Ladeanimation, danach eine
// ungestaltete Seite (Times, nackte Links, weißer Schleier). Während Render umschaltet,
// laufen alte und neue Instanz kurz parallel: Das neue HTML verlangt
// /assets/index-<neu>.css, die Anfrage landet bei der alten Instanz — dort gibt es die
// Datei nicht. Dasselbe gilt für Seiten-Bausteine (vite:preloadError).
// Jetzt: Fehlt das Stilblatt (Fehler ODER geladen, aber ohne Regeln), lädt die Seite frisch
// neu — höchstens dreimal in zwei Minuten, mit wachsender Pause. Die Startbühne bleibt
// solange stehen; erst danach startet die App notfalls ohne Stil, wie früher.
// ═══════════════════════════════════════════════════════════════════════════
const NEU_SCHLUESSEL = "fiaon-neu-geladen";
function neuLadenErlaubt(): number | null {
  try {
    const alt = JSON.parse(sessionStorage.getItem(NEU_SCHLUESSEL) || "null") as { n: number; t: number } | null;
    const frisch = alt && Date.now() - alt.t < 120_000 ? alt : { n: 0, t: Date.now() };
    if (frisch.n >= 3) return null;
    sessionStorage.setItem(NEU_SCHLUESSEL, JSON.stringify({ n: frisch.n + 1, t: frisch.t }));
    return 600 + frisch.n * 1400;
  } catch {
    return null;
  }
}
function frischLaden(): boolean {
  const pause = neuLadenErlaubt();
  if (pause === null) return false;
  window.setTimeout(() => window.location.reload(), pause);
  return true;
}
window.addEventListener("vite:preloadError", (e) => { if (frischLaden()) e.preventDefault(); });

function stilblattBereit(): Promise<void> {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-fiaon-stil]"));
  return Promise.all(links.map((link) => new Promise<void>((fertig) => {
    let erledigt = false;
    const pruefen = () => {
      if (erledigt) return;
      erledigt = true;
      let regeln = 0;
      try { regeln = link.sheet?.cssRules.length ?? 0; } catch { regeln = 1; }
      if (regeln > 0) { link.media = "all"; return fertig(); }
      // Geladen, aber leer (z. B. HTML statt CSS) oder Fehler: frisch laden; sonst wie früher weiter.
      if (!frischLaden()) fertig();
    };
    if (link.sheet) return pruefen();
    link.addEventListener("load", pruefen, { once: true });
    link.addEventListener("error", pruefen, { once: true });
  }))).then(() => undefined);
}

stilblattBereit().then(() => createRoot(document.getElementById("root")!).render(<App />));
