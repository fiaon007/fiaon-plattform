import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// DER RAUM — die Ambient-Schicht hinter der ganzen Anwendung
//
// Ein langsam drehender Planet auf dunklem Grund, weit hinter allem, unter
// einer CI-Farbwäsche. Dezent, aber wahrnehmbar.
//
// ── DIE VIER REGELN, DIE HIER EINGEBAUT SIND ───────────────────────────────
// 1. INHALT ZUERST. Das Poster steht sofort im Markup, das Video wird erst
//    nach dem ersten Zeichnen nachgeladen. Ein Video im kritischen Pfad
//    verschiebt den LCP um Sekunden — und das Budget von 2,5 s auf dem
//    Telefon ist verbindlich.
// 2. WER KEINE BEWEGUNG WILL, BEKOMMT KEINE. Bei `prefers-reduced-motion`
//    wird gar kein <video> erzeugt — nicht nur pausiert. Ein pausiertes
//    Video hat trotzdem geladen.
// 3. NICHT AUF KOSTEN DER DATEN. Bei aktiviertem Datensparmodus oder einer
//    langsamen Verbindung bleibt es beim Poster. Niemand soll für eine
//    Hintergrunddekoration bezahlen.
// 4. LESBARKEIT SCHLÄGT WIRKUNG. Über dem Video liegt immer eine
//    Aufhellungsschicht. Auf inhaltsdichten Seiten (Tabellen) wird sie
//    stärker — dort zählt jede Zeile, nicht die Stimmung.
// ═══════════════════════════════════════════════════════════════════════════

/** Wie stark ist das Video zu sehen? 0 = aus. */
export type RaumStaerke = 0 | 1 | 2 | 3;

const SCHLUESSEL = "fiaon-raum-staerke";

/**
 * Die Deckkraft des Videos je Stufe.
 *
 * NACHGEMESSEN AM BILDSCHIRM: Mit 0,18 und einer 90-prozentigen Wäsche
 * darüber ahnte man den Planeten nur noch am Rand — zweimal reduziert ist
 * einmal zu viel. Das Video trägt jetzt mehr, die Wäsche weniger; die
 * Lesbarkeit entsteht durch die Wäsche, nicht durch ein unsichtbares Video.
 */
const DECKKRAFT: Record<RaumStaerke, number> = { 0: 0, 1: 0.5, 2: 0.75, 3: 1 };

export function raumStaerkeLesen(): RaumStaerke {
  if (typeof window === "undefined") return 2;
  const roh = window.localStorage.getItem(SCHLUESSEL);
  // ERST auf „nichts gespeichert" prüfen, DANN umwandeln.
  // `Number(null)` ist 0 — und 0 bedeutet hier „aus". Die erste Fassung
  // schaltete den Raum deshalb bei jedem Besucher ab, der die Einstellung
  // nie angefasst hatte. Also bei allen.
  if (roh === null || roh === "") return 2;
  const v = Number(roh);
  return ([0, 1, 2, 3] as number[]).includes(v) ? (v as RaumStaerke) : 2;
}

export function raumStaerkeSetzen(v: RaumStaerke): void {
  window.localStorage.setItem(SCHLUESSEL, String(v));
  window.dispatchEvent(new Event("fiaon-raum"));
}

/**
 * Hat der Browser gesagt, dass Daten kostbar sind?
 *
 * `saveData` setzt der Nutzer selbst; `effectiveType` schätzt der Browser aus
 * gemessener Latenz. Beides ist ein klares Nein zu einem Hintergrundvideo.
 */
function sparsam(): boolean {
  const c = (navigator as any).connection;
  if (!c) return false;
  if (c.saveData) return true;
  return ["slow-2g", "2g", "3g"].includes(String(c.effectiveType || ""));
}

export function FiaonRaum({ dicht = false }: { dicht?: boolean }) {
  const [staerke, setStaerke] = useState<RaumStaerke>(() => raumStaerkeLesen());
  const [videoAn, setVideoAn] = useState(false);
  const [schmal, setSchmal] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 820,
  );

  useEffect(() => {
    const neu = () => setStaerke(raumStaerkeLesen());
    window.addEventListener("fiaon-raum", neu);
    window.addEventListener("storage", neu);
    return () => {
      window.removeEventListener("fiaon-raum", neu);
      window.removeEventListener("storage", neu);
    };
  }, []);

  useEffect(() => {
    const messen = () => setSchmal(window.innerWidth < 820);
    window.addEventListener("resize", messen);
    return () => window.removeEventListener("resize", messen);
  }, []);

  // ── Das Video kommt NACH dem Inhalt ───────────────────────────────────────
  // `requestIdleCallback` wartet, bis der Hauptstrang nichts Wichtigeres tut.
  // Der Rückfall auf setTimeout ist für Safari, das es lange nicht kannte.
  useEffect(() => {
    if (staerke === 0) { setVideoAn(false); return; }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sparsam()) return;

    const start = () => setVideoAn(true);
    const ric = (window as any).requestIdleCallback;
    const kennung = ric ? ric(start, { timeout: 2500 }) : window.setTimeout(start, 1200);
    return () => {
      if (ric && (window as any).cancelIdleCallback) (window as any).cancelIdleCallback(kennung);
      else window.clearTimeout(kennung);
    };
  }, [staerke]);

  if (staerke === 0) return null;

  // Auf inhaltsdichten Seiten fünf Punkte weniger — dort zählt die Zeile.
  const deckkraft = Math.max(0, DECKKRAFT[staerke] - (dicht ? 0.12 : 0));

  return (
    <div aria-hidden="true" className="fi-raum" style={{
      position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden",
    }}>
      {/* Das Poster steht sofort da — es ist der sichtbare Teil des LCP. */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: "url(/raum-poster.jpg)",
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: deckkraft,
        transition: "opacity 900ms ease",
      }} />

      {videoAn && (
        <video
          autoPlay muted loop playsInline preload="none"
          poster="/raum-poster.jpg"
          style={{
            position: "absolute", inset: 0, width: "100%", height: "100%",
            objectFit: "cover", objectPosition: "center",
            opacity: deckkraft,
            transition: "opacity 1400ms ease",
          }}>
          {/* WebM zuerst: kleiner bei gleicher Güte, wo der Browser es kann. */}
          {!schmal && <source src="/raum-1080.webm" type="video/webm" />}
          <source src={schmal ? "/raum-720.mp4" : "/raum-1080.mp4"} type="video/mp4" />
        </video>
      )}

      {/* Die Wäsche: kühles CI-Blau plus Aufhellung. Ohne sie stünde weißer
          Text auf einem dunklen Planeten — und dunkler Text auf hellem
          Himmel. Beides unlesbar.

          Der Space schaltet sie ab (siehe space.tsx): Er bringt seine eigene
          dunkle Tönung mit, und zwei Wäschen übereinander ergäben Grau. */}
      <div className="fi-raum-waesche" style={{
        position: "absolute", inset: 0,
        background:
          // Die Wäsche bleibt für die HELLEN Bereiche zuständig. Der Space
          // bringt seine eigene dunkle Tönung mit und braucht sie nicht —
          // deshalb dort abgeschaltet (siehe :has-Regel unten).
          "linear-gradient(178deg, rgba(234,240,251,.8) 0%, rgba(226,235,249,.75) 46%, rgba(232,239,251,.8) 100%)",
        mixBlendMode: "normal",
      }} />
      <div style={{
        position: "absolute", inset: 0,
        background:
          "radial-gradient(1240px 720px at 14% -12%, rgba(59,130,246,.2), transparent 58%),"
          + "radial-gradient(1020px 640px at 92% 4%, rgba(29,78,216,.16), transparent 54%)",
      }} />
    </div>
  );
}
