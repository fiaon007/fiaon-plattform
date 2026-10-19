// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/aras — ARAS, DER TELEFON-KOLLEGE (E-409, 19.10.2026)
//
// Die Bühne ist die Live-Karte (laufende Gespräche als Wellen, Transkript tickt
// mit). Darunter Reiter: Plan · Warteschlange · Anrufe · Stimme · Probeanruf ·
// Einstellungen (?reiter=…). Alles läuft gegen die Routen des Vertrags § 5 —
// solange Team 1 den Kern (E-408) nicht angebunden hat, zeigt jeder Reiter
// „Aras ist noch nicht verbunden“. Oben: an/aus, Not-Aus, Leerlauf, Adapter, Stimme.
// ═══════════════════════════════════════════════════════════════════════════
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import type { ArasLage } from "@shared/fiaon-ki-team";
import { setzerKoerper, type RegisterEintrag } from "@shared/fiaon-ki-schalter";
import { Kopf, KiRundgang, NichtVerbunden, Stand, Meldung, useMeldung, useTakt, senden, euro, zahl } from "./ki-teile";
import { Feld } from "./ChefKiEinstellungen";
import ArasLive from "./aras/ArasLive";

const ArasPlan = lazy(() => import("./aras/ArasPlan"));
const ArasWarteschlange = lazy(() => import("./aras/ArasWarteschlange"));
const ArasAnrufe = lazy(() => import("./aras/ArasAnrufe"));
const ArasStimme = lazy(() => import("./aras/ArasStimme"));
const ArasProbe = lazy(() => import("./aras/ArasProbe"));

type Reiter = "plan" | "warteschlange" | "anrufe" | "stimme" | "probe" | "einstellungen";
const REITER: { key: Reiter; label: string }[] = [
  { key: "plan", label: "Plan" }, { key: "warteschlange", label: "Warteschlange" }, { key: "anrufe", label: "Anrufe" },
  { key: "stimme", label: "Stimme" }, { key: "probe", label: "Probeanruf" }, { key: "einstellungen", label: "Einstellungen" },
];

function ArasEinstellungen({ verbunden }: { verbunden: boolean }) {
  const { daten, neu } = useTakt<{ ok: boolean; register: any[]; werte: Record<string, string>; gesetzt: Record<string, boolean>; arasVerbunden: boolean }>(verbunden ? "/chef/ki/einstellungen" : null, 0);
  const [busy, setBusy] = useState<string | null>(null);
  const meld = useMeldung();
  if (!verbunden) return <NichtVerbunden />;
  const liste = (daten?.register ?? []).filter((e) => e.dienst === "aras");
  const speichern = async (e: any, w: string) => {
    setBusy(e.schluessel);
    try { await senden(e.setzer.route, setzerKoerper(e as RegisterEintrag, w)); meld.gut(`${e.label}: gespeichert.`); neu(); }
    catch (err) { meld.fehler(`${e.label}: ${(err as Error).message}`); } finally { setBusy(null); }
  };
  return (
    <div className="ki-karte" data-ki="aras-einstellungen">
      <h2>Alle Aras-Schalter <span className="ki-still ki-klein">· Vorgabe und Grenze im Tooltip</span> <Meldung m={meld.m} /></h2>
      {liste.map((e) => <Feld key={e.schluessel} e={e} wert={daten!.werte[e.schluessel]} gesetzt={!!daten!.gesetzt[e.schluessel]} busy={busy === e.schluessel} onSpeichern={speichern} />)}
    </div>
  );
}

export default function ChefKiAras() {
  const [location, navigate] = useLocation();
  const such = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const start = (such?.get("reiter") as Reiter) || "plan";
  const [reiter, setReiter] = useState<Reiter>(REITER.some((r) => r.key === start) ? start : "plan");
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
      <KiRundgang schluessel="aras" raum="aras" />
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
        {reiter === "plan" ? <ArasPlan verbunden={verbunden} />
          : reiter === "warteschlange" ? <ArasWarteschlange verbunden={verbunden} />
          : reiter === "anrufe" ? <ArasAnrufe verbunden={verbunden} />
          : reiter === "stimme" ? <ArasStimme verbunden={verbunden} eigeneStimmen={daten?.adapter === "openai_live"} />
          : reiter === "probe" ? <ArasProbe verbunden={verbunden} />
          : <ArasEinstellungen verbunden={verbunden} />}
      </Suspense>
    </div>
  );
}
