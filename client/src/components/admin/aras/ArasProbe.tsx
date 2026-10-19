// Reiter „Probeanruf“ (E-409): nur deine Nummer (aras_probe_nummer, beim ersten Mal aus deinem Ausweis), Spielart, Knopf „Mich anrufen“.
import { useState } from "react";
import { useTakt, senden, useMeldung, Meldung, NichtVerbunden } from "../ki-teile";
import { SpielartWahl } from "./aras-teile";

export default function ArasProbe({ verbunden }: { verbunden: boolean }) {
  const { daten, neu } = useTakt<{ ok: boolean; verbunden: boolean; nummer: string | null; gesetzt: boolean; hinweis: string | null }>("/chef/aras/mich-anrufen", 0);
  const [spielart, setSpielart] = useState("probe");
  const [busy, setBusy] = useState(false);
  const meld = useMeldung();
  if (!verbunden || daten?.verbunden === false) return <NichtVerbunden />;
  const anrufen = async () => {
    if (!window.confirm(`Aras ruft jetzt ${daten?.nummer ?? "deine Nummer"} an (Spielart ${spielart}). Bereit?`)) return;
    setBusy(true);
    try { const r = await senden<{ callId: number }>("/chef/aras/mich-anrufen", { spielart }); meld.gut(`Aras wählt … (Anruf ${r.callId}). Sprich, unterbrich ihn, schweig drei Sekunden, sag „Nein“ zur Aufnahme.`); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="ki-karte" data-ki="probe">
      <h2>Mich anrufen <span className="ki-still ki-klein">· dein einziger Hörtest — nur in der Plattform, nie bei Drittanbietern</span></h2>
      <div className="ki-chips ki-abstand">
        <span className="ki-pille" title={daten?.gesetzt ? "aras_probe_nummer (Einstellungen › Aras)" : "Wird beim ersten Anruf aus deinem Mitarbeiter-Ausweis übernommen."}>{daten?.nummer ?? "keine Nummer"}</span>
        <SpielartWahl wert={spielart} onChange={setSpielart} />
        <button type="button" className="ki-knopf haupt" data-ki="mich-anrufen" disabled={busy || !daten?.nummer} onClick={anrufen}>Mich anrufen</button>
        <Meldung m={meld.m} />
      </div>
      {!daten?.nummer ? <p className="ki-krit-t ki-klein ki-abstand">Trage deine Nummer unter Einstellungen › Aras ein (aras_probe_nummer) — oder hinterlege sie in deinem Ausweis.</p> : null}
      <p className="ki-still ki-klein ki-abstand">Danach sag mir in einem Satz: „gut genug“ oder „klingt nach KI“. Erst wenn es für dich kaum zu unterscheiden ist, geht Aras an Kunden (Schalter „Aras wählt“).</p>
    </div>
  );
}
