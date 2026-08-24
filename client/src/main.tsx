import { createRoot } from "react-dom/client";
import Clarity from "@microsoft/clarity";
import App from "./App";
import "./index.css";

// Initialize Microsoft Clarity (runs once at app startup)
const clarityProjectId = "wf58sx5vcm";
Clarity.init(clarityProjectId);

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

createRoot(document.getElementById("root")!).render(<App />);
