// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/aras — ARAS, DER TELEFON-KOLLEGE (E-409, 19.10.2026 · Cockpit-Umbau 20.10.2026)
//
// Justin (20.10.2026, Screenshot ?reiter=anrufe): „Also die gesamte Seite ist total unübersichtlich, vieles geht
// nicht – wenn ich auflege läuft der Kasten da mit ‚übernehmen‘ dennoch weiter … und das gesamte Layout, UI VIEL
// übersichtlicher, cleaner“.
//
// Aufbau jetzt:
//   1. Das Cockpit (aras/ArasCockpit.tsx): EINE Statusleiste — was Aras gerade tut, Stufe, Kunden an/aus, Kosten
//      heute, Leerlauf und Not-Aus. Live erscheint nur, wenn ein Gespräch läuft (dann groß: wer, wie lange, Text,
//      Übernehmen/Auflegen) und verschwindet Sekunden nach dem Auflegen (Regeln: aras/aras-live.ts).
//   2. Reiter: Probe (zuerst) · Anrufe · Ergebnisse (Go-live G) · Als Nächstes · Tagesplan · Ausbaustufe · Einstellungen (?reiter=… oder #probe —
//      die Schlüssel sind dieselben wie vorher, alte Links und Alarme gehen weiter).
// Der Grund hinter der Seite ist ruhig (chef-seiten.tsx: stillerGrund) — kein großes Foto hinter den Daten.
//
// E-409 × E-408 (20.10.2026, Justin: EIN Ort für Aras): Der Reiter „Probe“ IST die Probe-Ansicht aus Aras Teil 1
// (ChefArasProbe) — dieselben Routen /chef/aras/probe/*. /chef/s/aras-probe leitet hierher (#probe).
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { KiRundgang, Kopf, Stand, useTakt } from "./ki-teile";
import { ArasCockpit, type CockpitLage } from "./aras/ArasCockpit";
import { ArasLageKontext, ArasLiveKontext, useArasLive } from "./aras/ArasLive";
import { PROBE_SCHLUESSEL } from "./aras/aras-texte";
import "@/styles/chef-aras.css";

const ArasPlan = lazy(() => import("./aras/ArasPlan"));
const ArasWarteschlange = lazy(() => import("./aras/ArasWarteschlange"));
const ArasAnrufe = lazy(() => import("./aras/ArasAnrufe"));
const ArasErgebnisse = lazy(() => import("./aras/ArasErgebnisse"));
const ArasStufe = lazy(() => import("./aras/ArasStufe"));
const ArasEinstellungen = lazy(() => import("./aras/ArasEinstellungen"));
const ArasProbe = lazy(() => import("./ChefArasProbe"));

type Reiter = "probe" | "anrufe" | "ergebnisse" | "warteschlange" | "plan" | "stufe" | "einstellungen";
const REITER: { key: Reiter; label: string; titel: string }[] = [
  { key: "probe", label: "Probe", titel: "Mich anrufen, dein Urteil, Ton und Stimme" },
  { key: "anrufe", label: "Anrufe", titel: "Jedes Gespräch mit Ergebnis — Probe und Kunden" },
  { key: "ergebnisse", label: "Ergebnisse", titel: "Was die Gespräche gebracht haben — je Gesprächsart und Tag, jede Zahl öffnet die Gespräche" },
  { key: "warteschlange", label: "Als Nächstes", titel: "Wer als Nächstes dran ist (Warteschlange)" },
  { key: "plan", label: "Tagesplan", titel: "Wann ARAS wen anruft" },
  { key: "stufe", label: "Ausbaustufe", titel: "Wie weit ARAS schon darf — und die Ampel" },
  { key: "einstellungen", label: "Einstellungen", titel: "Die übrigen ARAS-Schalter" },
];
/** Was der Reiter „Probe“ selbst einstellt (Ton, Dialekt, Hintergrund, Zuhören, Stimme, Probe-Nummer, Deckel) — in „Einstellungen“ nicht noch einmal. */
export const IM_PROBE_REITER: readonly string[] = PROBE_SCHLUESSEL;
/** Der Start-Reiter: #probe (Weiterleitung von /chef/s/aras-probe), sonst ?reiter=…, sonst „Probe“. Rein. */
export function startReiter(hash: string, suche: string): Reiter {
  if (/^#probe\b/.test(hash)) return "probe";
  const r = new URLSearchParams(suche).get("reiter");
  return REITER.some((x) => x.key === r) ? (r as Reiter) : "probe";
}

export default function ChefKiAras() {
  const [location, navigate] = useLocation();
  const [reiter, setReiter] = useState<Reiter>(() => (typeof window !== "undefined" ? startReiter(window.location.hash, window.location.search) : "probe"));
  const [fokus, setFokus] = useState<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search); q.set("reiter", reiter);
    navigate(`${location.split("?")[0]}?${q.toString()}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reiter]);
  const [schnell, setSchnell] = useState(false);
  const { daten, neu, geladenAm, fehler } = useTakt<CockpitLage & { ok: boolean }>("/chef/aras/lage", schnell ? 5000 : 15_000);
  const verbunden = !!daten?.verbunden;
  const live = useArasLive(verbunden);
  // Läuft ein Gespräch, frischen Kosten und Zahlen oben alle 5 s auf (sonst alle 15 s).
  const laufend = live.sitzungen.length > 0;
  useEffect(() => { setSchnell(laufend); }, [laufend]);
  const zu = useCallback((r: "anrufe" | "stufe" | "einstellungen") => { setReiter(r); setFokus(r === "einstellungen" ? "aras_stufe" : null); }, []);
  const anzahl: Partial<Record<Reiter, number>> = daten?.verbunden ? {
    anrufe: (Number(daten.heute?.gewaehlt) || 0) + (Number(daten.heute?.proben) || 0) || undefined,
    warteschlange: Number(daten.plan?.wartet) || undefined,
  } : {};
  const lageSchluessel = daten ? `${daten.notaus}-${daten.leerlauf}-${daten.an}-${daten.stufe}` : "";
  return (
    <ArasLiveKontext.Provider value={live}>
      <ArasLageKontext.Provider value={lageSchluessel}>
      <div className="ki ki-aras ar">
        <KiRundgang schluessel="aras" raum="aras-cockpit" />
        <Kopf titel="ARAS" satz="Deine digitale Mitarbeiterin am Telefon." kinder={<Stand am={geladenAm} neu={neu} fehler={fehler} />} />
        <ArasCockpit lage={daten} live={live} onNeu={neu} onReiter={zu} />
        <nav className="ar-reiter" aria-label="ARAS-Reiter">
          {REITER.map((r) => (
            <button key={r.key} type="button" className={reiter === r.key ? "an" : ""} aria-pressed={reiter === r.key} data-ki-reiter={r.key} title={r.titel}
              onClick={() => { setReiter(r.key); setFokus(null); }}>
              {r.label}{anzahl[r.key] ? <span className="ar-anzahl">{anzahl[r.key]}</span> : null}
            </button>
          ))}
        </nav>
        <Suspense fallback={<div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div>}>
          {reiter === "probe" ? <ArasProbe eingebettet ohneSchalter={verbunden} />
            : reiter === "anrufe" ? <ArasAnrufe verbunden={verbunden} />
            : reiter === "ergebnisse" ? <ArasErgebnisse verbunden={verbunden} />
            : reiter === "warteschlange" ? <ArasWarteschlange verbunden={verbunden} />
            : reiter === "plan" ? <ArasPlan verbunden={verbunden} />
            : reiter === "stufe" ? <ArasStufe verbunden={verbunden} onEinstellungen={() => zu("einstellungen")} />
            : <ArasEinstellungen verbunden={verbunden} fokus={fokus} />}
        </Suspense>
      </div>
      </ArasLageKontext.Provider>
    </ArasLiveKontext.Provider>
  );
}
