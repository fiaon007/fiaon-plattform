// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/aras — ARAS, DER TELEFON-KOLLEGE (E-409, 19.10.2026)
//
// Die Bühne ist die Live-Karte (laufende Gespräche als Wellen, Transkript tickt
// mit). Darunter Reiter: Probe · Plan · Warteschlange · Anrufe · Einstellungen
// (?reiter=… oder #probe). Plan, Warteschlange, Anrufe und Einstellungen laufen gegen
// die Routen des Vertrags § 5 — solange Team 1 den Kern (E-408) nicht angebunden hat,
// zeigen sie „Aras ist noch nicht verbunden“. Oben: an/aus, Not-Aus, Leerlauf.
//
// E-409 × E-408 (20.10.2026, Justin: EIN Ort für Aras): Der Reiter „Probe“ IST die Probe-Ansicht aus Aras Teil 1
// (ChefArasProbe: deine Nummer, „Mich anrufen“, live mitlesen, Daumen, Stimmen-Studio, Ton) — dieselben Routen
// /chef/aras/probe/*. Die frühere Seite /chef/s/aras-probe (Raum Vertrieb) leitet hierher (#probe); die doppelten
// Reiter „Stimme“ und „Probeanruf“ des KI-Teams sind weg. Ton, Stimme, Probe-Nummer und Tagesdeckel stellst du nur
// noch im Reiter „Probe“ ein — der Reiter „Einstellungen“ zeigt die übrigen Aras-Schalter.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { ArasLage } from "@shared/fiaon-ki-team";
import { setzerKoerper, type RegisterEintrag } from "@shared/fiaon-ki-schalter";
import { Rundgang } from "@/components/agent/Rundgang";
import { RUNDGANG_ARAS_PROBE } from "@/pages/agent/rundgaenge";
import { Kopf, KiRundgang, NichtVerbunden, Stand, Meldung, useMeldung, useTakt, senden, euro, zahl } from "./ki-teile";
import { Feld } from "./ChefKiEinstellungen";
import ArasLive from "./aras/ArasLive";

const ArasPlan = lazy(() => import("./aras/ArasPlan"));
const ArasWarteschlange = lazy(() => import("./aras/ArasWarteschlange"));
const ArasAnrufe = lazy(() => import("./aras/ArasAnrufe"));
const ArasProbe = lazy(() => import("./ChefArasProbe"));

type Reiter = "probe" | "plan" | "warteschlange" | "anrufe" | "einstellungen";
const REITER: { key: Reiter; label: string }[] = [
  { key: "probe", label: "Probe" }, { key: "plan", label: "Plan" }, { key: "warteschlange", label: "Warteschlange" },
  { key: "anrufe", label: "Anrufe" }, { key: "einstellungen", label: "Einstellungen" },
];
/** Was der Reiter „Probe“ selbst einstellt (Ton, Stimme, Probe-Nummer, Deckel) — im Reiter „Einstellungen“ nicht noch einmal. */
export const IM_PROBE_REITER: readonly string[] = ["aras_energie", "aras_fuellwoerter", "aras_lachen", "aras_tempo", "aras_zuhoerlaute", "aras_abschluss", "aras_stimme", "aras_probe_nummer", "aras_tag_euro"];
/** Der Start-Reiter: #probe (Weiterleitung von /chef/s/aras-probe), sonst ?reiter=…, sonst „Probe“. Rein. */
export function startReiter(hash: string, suche: string): Reiter {
  if (/^#probe\b/.test(hash)) return "probe";
  const r = new URLSearchParams(suche).get("reiter");
  return REITER.some((x) => x.key === r) ? (r as Reiter) : "probe";
}

function ArasEinstellungen({ verbunden }: { verbunden: boolean }) {
  const { daten, neu } = useTakt<{ ok: boolean; register: any[]; werte: Record<string, string>; gesetzt: Record<string, boolean>; arasVerbunden: boolean }>(verbunden ? "/chef/ki/einstellungen" : null, 0);
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  if (!verbunden) return <NichtVerbunden />;
  const liste = (daten?.register ?? []).filter((e) => e.dienst === "aras" && !IM_PROBE_REITER.includes(e.schluessel));
  const speichern = async (e: any, w: string) => {
    setBusy(e.schluessel);
    try { await senden(e.setzer.route, setzerKoerper(e as RegisterEintrag, w)); meld.gut(`${e.label}: gespeichert.`); neu(); }
    catch (err) { meld.fehler(`${e.label}: ${(err as Error).message}`); } finally { setBusy(null); }
  };
  return (
    <div className="ki-karte" data-ki="aras-einstellungen">
      <h2>Aras-Schalter <span className="ki-still ki-klein">· Vorgabe und Grenze im Tooltip · Ton, Stimme, deine Nummer und den Tagesdeckel stellst du im Reiter „Probe“ ein</span> <Meldung m={meld.m} /></h2>
      {liste.map((e) => <Feld key={e.schluessel} e={e} wert={daten!.werte[e.schluessel]} gesetzt={!!daten!.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />)}
    </div>
  );
}

export default function ChefKiAras() {
  const [location, navigate] = useLocation();
  const [reiter, setReiter] = useState<Reiter>(() => (typeof window !== "undefined" ? startReiter(window.location.hash, window.location.search) : "probe"));
  useEffect(() => {
    const q = new URLSearchParams(window.location.search); q.set("reiter", reiter);
    navigate(`${location.split("?")[0]}?${q.toString()}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reiter]);
  const { daten, neu, geladenAm } = useTakt<ArasLage & { ok: boolean; hinweis?: string }>("/chef/aras/lage", 15_000);
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  const verbunden = !!daten?.verbunden;
  const neuLage = useCallback(() => neu(), [neu]);
  const schalten = async (pfad: string, body: unknown, text: string, frage?: string) => {
    if (frage && !window.confirm(frage)) return;
    setBusy(pfad);
    try { await senden(pfad, body); meld.gut(text); neu(); } catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const h = daten?.heute;
  return (
    <div className="ki ki-aras">
      {/* Im Reiter „Probe“ der Rundgang der Probe (derselbe wie früher auf /chef/s/aras-probe), sonst der des Raums. */}
      {reiter === "probe" ? <Rundgang raum="aras-probe" titel="Aras · Probe" schritte={RUNDGANG_ARAS_PROBE} /> : <KiRundgang schluessel="aras" raum="aras" />}
      <Kopf titel="Aras" satz="Der Kollege am Telefon — menschlich, pünktlich, den ganzen Tag." kinder={
        <>
          {verbunden ? (
            <>
              <span className={`ki-pille ${daten!.notaus ? "krit" : daten!.an ? "gut" : "warn"}`} title={`Technik: ${daten!.adapter ?? "—"} · Stimme: ${daten!.stimme ?? "—"}`}><span className={`ki-punkt ${daten!.notaus ? "krit" : daten!.an ? "gut" : "warn"}`} aria-hidden="true" />{daten!.notaus ? "Not-Aus" : daten!.leerlauf ? "Leerlauf" : daten!.an ? "wählt" : "aus"}</span>
              {daten!.notaus
                ? <button type="button" className="ki-knopf klein haupt" disabled={!!busy} onClick={() => schalten("/chef/aras/start", {}, "Aras darf wieder wählen.")}>Wieder an</button>
                : <button type="button" className="ki-knopf klein krit" data-ki="notaus" disabled={!!busy} onClick={() => schalten("/chef/aras/notaus", { grund: "Chefbüro" }, "Aras gestoppt.", "Not-Aus? Laufende Gespräche enden mit einem Abschiedssatz.")}>Not-Aus</button>}
              <button type="button" className="ki-knopf klein" disabled={!!busy} title="Kein neues Wählen, laufende Gespräche enden normal — vor jedem Deploy." onClick={() => schalten("/chef/aras/leerlauf", { an: !daten!.leerlauf }, daten!.leerlauf ? "Leerlauf aus." : "Leerlauf an.")}>{daten!.leerlauf ? "Leerlauf aus" : "Leerlauf"}</button>
            </>
          ) : <span className="ki-pille">noch nicht verbunden</span>}
          <Meldung m={meld.m} />
          <Stand am={geladenAm} neu={neu} />
        </>
      } />
      {verbunden && h ? (
        <div className="ki-zahlen" style={{ marginBottom: 14 }}>
          <div><span className="ki-zahl klein">{zahl(h.gewaehlt)}</span><small title={`${zahl(h.erreicht)} erreicht`}>gewählt heute</small></div>
          <div><span className="ki-zahl klein">{zahl(h.gespraeche)}</span><small>Gespräche</small></div>
          <div><span className="ki-zahl klein">{zahl(h.zusagen)}</span><small>Zusagen</small></div>
          <div><span className="ki-zahl klein">{euro(h.euroKi + h.euroTelefon)}</span><small title={`KI ${euro(h.euroKi)} · Telefon ${euro(h.euroTelefon)}`}>{h.deckel ? `von ${euro(h.deckel)}` : "Kosten heute"}</small></div>
        </div>
      ) : null}
      <ArasLive verbunden={verbunden} start={daten?.laufend ?? []} darfUebernehmen={verbunden} onAenderung={neuLage} />
      <nav className="ki-reiter ki-abstand" aria-label="Aras-Reiter">
        {REITER.map((r) => <button key={r.key} type="button" className={reiter === r.key ? "an" : ""} aria-pressed={reiter === r.key} data-ki-reiter={r.key} onClick={() => setReiter(r.key)}>{r.label}</button>)}
      </nav>
      <Suspense fallback={<div className="ki-leer">lädt …</div>}>
        {reiter === "probe" ? <ArasProbe eingebettet ohneSchalter={verbunden} />
          : reiter === "plan" ? <ArasPlan verbunden={verbunden} />
          : reiter === "warteschlange" ? <ArasWarteschlange verbunden={verbunden} />
          : reiter === "anrufe" ? <ArasAnrufe verbunden={verbunden} />
          : <ArasEinstellungen verbunden={verbunden} />}
      </Suspense>
    </div>
  );
}
