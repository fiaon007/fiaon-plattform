// ═══════════════════════════════════════════════════════════════════════════
// DER ANRUF-PLAYER — EIN BAUTEIL FÜR ALLE ABSPIELSTELLEN
//
// ── DER ANLASS (19.08.2026) ────────────────────────────────────────────────
// Aufnahmen liefen an vier Stellen über `<audio controls>`: im Profil eines
// Mitarbeiters (Karte und Akte), in der Kundenakte und im Forderungsmanagement.
// Vier Stellen, viermal die Standardleiste des Browsers — in Safari grau, in
// Chrome anders, ohne Geschwindigkeit und ohne Möglichkeit, ein Gespräch für
// eine Rückfrage mitzunehmen.
//
// ── WARUM EIN BAUTEIL UND NICHT VIER VERBESSERUNGEN ───────────────────────
// Weil die vierte vergessen wird. Genau so ist der Fehler entstanden, den
// dieses Haus zweimal beschrieben hat: eine Regel, die vier Oberflächen einzeln
// kennen müssen, wird an der fünften vergessen.
//
// ── WAS ER KANN ───────────────────────────────────────────────────────────
//   · Abspielen/Pause, Fortschrittsbalken zum Springen
//   · Zeitanzeige (verstrichen / gesamt)
//   · Geschwindigkeit 1x / 1,5x / 2x — für Menschen, die zwanzig Gespräche
//     am Tag nachhören
//   · Herunterladen als kunde_datum.mp3
//
// ── DER DOWNLOAD GEHT ÜBER DIESELBE GESCHÜTZTE ROUTE ──────────────────────
// `/api/fiaon/telefon/:id/aufnahme?laden=1`. Sie hängt an der Sitzung, prüft
// die Zuständigkeit und protokolliert den Zugriff — genauso wie das Anhören,
// nur mit dem Vermerk „HERUNTERGELADEN". Eine signierte Adresse wäre hier
// schwächer: Sie gilt, solange die Signatur gilt, auch für den, der sie
// weitergibt.
//
// ── KEINE ICON-BIBLIOTHEK ─────────────────────────────────────────────────
// Alle Zeichen sind selbst gezeichnet: 20×20, 1,5 px, `currentColor`
// (AGENTS.md). Die Dreiecke von Play/Pause sind gefüllt, weil sie bei 1,5 px
// Strich nicht erkennbar wären.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";

const TEMPI = [1, 1.5, 2] as const;

function ZeichenAbspielen({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M7 4.5 15.5 10 7 15.5V4.5Z" fill="currentColor" />
    </svg>
  );
}
function ZeichenPause({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="6" y="4.5" width="3" height="11" rx="1" fill="currentColor" />
      <rect x="11" y="4.5" width="3" height="11" rx="1" fill="currentColor" />
    </svg>
  );
}
function ZeichenLaden({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3v9" />
      <path d="M6.5 8.5 10 12l3.5-3.5" />
      <path d="M4 15.5h12" />
    </svg>
  );
}

/** Sekunden als m:ss — „—:—", solange die Länge unbekannt ist. */
function zeit(s: number | null): string {
  if (s == null || !Number.isFinite(s) || s < 0) return "—:—";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

interface Props {
  /** Die Kennung des Anrufs — daraus entsteht die geschützte Adresse. */
  anrufId: number;
  /** Auf dunklem Grund (Team-Zentrale) oder auf weißem (Akten)? */
  ton?: "hell" | "dunkel";
  /** Für Browsertests und zum Wiederfinden im DOM. */
  kennzeichen?: string;
}

export function AnrufPlayer({ anrufId, ton = "hell", kennzeichen }: Props) {
  const quelle = `/api/fiaon/telefon/${anrufId}/aufnahme`;
  const audio = useRef<HTMLAudioElement | null>(null);

  // ── ALLE HAKEN ÜBER DEM ERSTEN `return` ────────────────────────────────
  // AGENTS.md: In Softphone.tsx ist zweimal ein `useEffect` hinter einem
  // vorzeitigen `return` gelandet, und die halbe Verwaltung wurde weiß.
  const [laeuft, setLaeuft] = useState(false);
  const [jetzt, setJetzt] = useState(0);
  const [dauer, setDauer] = useState<number | null>(null);
  const [tempo, setTempo] = useState<number>(1);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    a.playbackRate = tempo;
  }, [tempo]);

  const dunkel = ton === "dunkel";
  const farbe = dunkel ? "rgba(233,241,255,.92)" : "#0f172a";
  const leise = dunkel ? "rgba(191,214,247,.62)" : "#64748b";
  const linie = dunkel ? "rgba(191,214,247,.20)" : "#e2e8f0";
  const rinne = dunkel ? "rgba(191,214,247,.16)" : "#eef2f7";

  const umschalten = async () => {
    const a = audio.current;
    if (!a) return;
    setFehler(null);
    if (laeuft) { a.pause(); return; }
    setLaedt(true);
    a.playbackRate = tempo;
    try {
      await a.play();
    } catch {
      // Ein abgelehntes `play()` ist kein Programmfehler (Autoplay-Regeln,
      // fehlende Datei). Der Grund gehört trotzdem auf den Bildschirm.
      setFehler("Die Aufnahme lässt sich nicht abspielen.");
    } finally {
      setLaedt(false);
    }
  };

  const anteil = dauer && dauer > 0 ? Math.min(1, jetzt / dauer) : 0;

  return (
    <div data-fiaon={kennzeichen ?? "anruf-player"}
         style={{
           display: "flex", alignItems: "center", gap: 10,
           padding: "8px 10px", borderRadius: 12,
           border: `1px solid ${linie}`,
           background: dunkel ? "rgba(191,214,247,.05)" : "#fff",
         }}>
      {/* Das Element selbst ist unsichtbar — die Bedienung steht daneben.
          `preload="none"`: Eine Seite mit zwanzig Gesprächen würde sonst
          zwanzig Aufnahmen laden, und jede erzeugt einen Protokolleintrag. */}
      <audio ref={audio} src={quelle} preload="none"
             onPlay={() => setLaeuft(true)}
             onPause={() => setLaeuft(false)}
             onEnded={() => { setLaeuft(false); setJetzt(0); }}
             onTimeUpdate={(e) => setJetzt((e.target as HTMLAudioElement).currentTime)}
             onLoadedMetadata={(e) => {
               const d = (e.target as HTMLAudioElement).duration;
               setDauer(Number.isFinite(d) ? d : null);
             }}
             onError={() => {
               setLaeuft(false);
               setFehler("Die Aufnahme ist nicht abrufbar.");
             }} />

      <button type="button" onClick={() => void umschalten()}
              aria-label={laeuft ? "Pause" : "Aufnahme abspielen"}
              data-fiaon="player-abspielen"
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 999,
                display: "grid", placeItems: "center",
                border: `1px solid ${linie}`, color: farbe,
                background: dunkel ? "rgba(191,214,247,.10)" : "#f8fafc",
                cursor: "pointer",
              }}>
        {laeuft ? <ZeichenPause /> : <ZeichenAbspielen />}
      </button>

      <div style={{ flex: 1, minWidth: 90 }}>
        {/* ── DER FORTSCHRITTSBALKEN ─────────────────────────────────────
            Ein `range` und kein selbstgebauter Balken: Er ist mit der Tastatur
            bedienbar, hat eine Rolle für Vorleseprogramme und springt auf
            Antippen — alles, was ein `div` mit `onClick` nicht hat. */}
        <input type="range" min={0} max={dauer && dauer > 0 ? dauer : 1}
               step={0.1} value={jetzt}
               disabled={!dauer}
               aria-label="Position in der Aufnahme"
               data-fiaon="player-fortschritt"
               onChange={(e) => {
                 const a = audio.current;
                 const v = Number(e.target.value);
                 setJetzt(v);
                 if (a) a.currentTime = v;
               }}
               style={{
                 width: "100%", height: 4, appearance: "none", cursor: dauer ? "pointer" : "default",
                 borderRadius: 999, outline: "none",
                 background: `linear-gradient(to right, ${dunkel ? "#7aa5ee" : "#1d4ed8"} `
                   + `${anteil * 100}%, ${rinne} ${anteil * 100}%)`,
               }} />
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: 10.5, color: leise, marginTop: 3,
          fontVariantNumeric: "tabular-nums",
        }}>
          <span data-fiaon="player-zeit">{zeit(jetzt)} / {zeit(dauer)}</span>
          {fehler && <span style={{ color: "#b45309" }}>{fehler}</span>}
          {!fehler && laedt && <span>lädt …</span>}
        </div>
      </div>

      {/* ── GESCHWINDIGKEIT ──────────────────────────────────────────────
          Ein Knopf, der durchschaltet — keine Auswahlliste. Drei Werte in einem
          Aufklappmenü sind zwei Klicks für etwas, das man im Vorbeigehen
          ändert. */}
      <button type="button"
              onClick={() => setTempo((t) => TEMPI[(TEMPI.indexOf(t as any) + 1) % TEMPI.length])}
              aria-label={`Abspielgeschwindigkeit, jetzt ${tempo}-fach`}
              data-fiaon="player-tempo"
              title="Abspielgeschwindigkeit umschalten"
              style={{
                flexShrink: 0, minWidth: 40, padding: "5px 7px", borderRadius: 8,
                fontSize: 11, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                border: `1px solid ${linie}`, color: tempo === 1 ? leise : farbe,
                background: dunkel ? "rgba(191,214,247,.08)" : "#f8fafc",
                cursor: "pointer",
              }}>
        {String(tempo).replace(".", ",")}×
      </button>

      {/* ── HERUNTERLADEN ────────────────────────────────────────────────
          Ein echter Link mit `download`, kein `fetch` mit Blob: Der Browser
          bekommt den Dateinamen aus der Kopfzeile des Servers, und der Download
          läuft auch bei einem langen Gespräch weiter, wenn die Seite wechselt.

          Der Zugriff wird protokolliert wie das Anhören — deshalb steht der
          Hinweis im `title`, nicht versteckt in einer Fußnote. */}
      <a href={`${quelle}?laden=1`} download
         aria-label="Aufnahme herunterladen"
         data-fiaon="player-laden"
         title="Als MP3 herunterladen — der Zugriff wird protokolliert"
         style={{
           flexShrink: 0, width: 32, height: 32, borderRadius: 8,
           display: "grid", placeItems: "center",
           border: `1px solid ${linie}`, color: leise,
           background: dunkel ? "rgba(191,214,247,.08)" : "#f8fafc",
         }}>
        <ZeichenLaden />
      </a>
    </div>
  );
}
