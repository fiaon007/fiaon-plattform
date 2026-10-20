// ═══════════════════════════════════════════════════════════════════════════
// /chef/s/ki-werkzeuge — DIE EINE WERKZEUG-AMPEL (E-409, 19.10.2026; E-409 × E-406, 20.10.2026)
//
// Je Werkzeug eine Zeile (echte Werkzeugnamen aus dem Code): grün (macht es allein) ·
// gelb (macht es, steht danach in „Heute“) · rot (macht es nicht selbst — die Zeile sagt
// ehrlich, was dann passiert: Karte an dich oder weggelassen). Nur Stufen, die der Server
// durchsetzt, sind klickbar; feste Zeilen sind Garantien (Kündigung annehmen, Werbesperre,
// Geld, Erstattung …). Das Mara-Steuerpult verlinkt nur hierher. Aras-Werkzeuge erscheinen,
// sobald der Kern angebunden ist.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { AMPEL_TEXT, type AmpelStufe, type AmpelZeile } from "@shared/fiaon-ki-team";
import { Kopf, KiRundgang, NichtVerbunden, Fehler, Stand, Meldung, useMeldung, useTakt, senden, seitKurz } from "./ki-teile";

const KANAL_TEXT: Record<string, string> = { whatsapp: "WhatsApp", mail: "Postfach", auftrag: "Aufträge", alle: "Überall" };
const STUFEN: AmpelStufe[] = ["gruen", "gelb", "rot"];
const STUFE_KURZ: Record<AmpelStufe, string> = { gruen: "grün", gelb: "gelb", rot: "rot" };

function Zeile({ z, wer, busy, onStufe }: { z: AmpelZeile; wer: "mara" | "aras"; busy: boolean; onStufe: (z: AmpelZeile, s: AmpelStufe) => void }) {
  return (
    <li className="ki-zeile" data-ki-werkzeug={z.key}>
      <div className="ki-zeile-kopf">
        <span className={`ki-punkt ${z.stufe}`} aria-hidden="true" />
        <b>{z.label}</b>
        <span className="ki-still ki-klein">{KANAL_TEXT[z.kanal] ?? z.kanal}{z.fest ? " · fest" : z.geaendertAm ? ` · geändert ${seitKurz(z.geaendertAm)}` : ""}</span>
      </div>
      <div className="ki-segment" role="group" aria-label={`Stufe für ${z.label}`}>
        {STUFEN.map((s) => (
          <button key={s} type="button" className={z.stufe === s ? "an" : ""} aria-pressed={z.stufe === s}
            disabled={busy || z.fest || !z.stufen.includes(s)} title={z.stufen.includes(s) ? AMPEL_TEXT[s] : "Diese Stufe setzt der Server für dieses Werkzeug nicht durch."}
            onClick={() => z.stufe !== s && onStufe(z, s)}>
            <span className={`ki-punkt ${s}`} aria-hidden="true" />{STUFE_KURZ[s]}
          </button>
        ))}
      </div>
      <span className="ki-zeile-satz" data-ki-wer={wer}>
        {z.satz}
        {z.stufe === "rot" && z.rot ? <><br /><span className="ki-leise">Rot: {z.rot}</span></> : null}
        {z.stufe === "gelb" && z.gelb ? <><br /><span className="ki-leise">Gelb: {z.gelb}</span></> : null}
        {z.hinweis ? <><br />{z.hinweis}</> : null}
      </span>
    </li>
  );
}

export default function ChefKiWerkzeuge() {
  const { daten, fehler, neu, geladenAm } = useTakt<{ ok: boolean; mara: AmpelZeile[]; aras: AmpelZeile[] | null; arasVerbunden: boolean }>("/chef/ki/werkzeuge", 60_000);
  const [busy, setBusy] = useState(false);
  const meld = useMeldung();
  const setzen = (wer: "mara" | "aras") => async (z: AmpelZeile, stufe: AmpelStufe) => {
    if (stufe === "rot" && !window.confirm(`„${z.label}“ auf rot?\n\n${z.rot ?? `${wer === "mara" ? "Mara" : "Aras"} macht es dann nicht mehr selbst.`}`)) return;
    setBusy(true);
    try { await senden(`/chef/ki/werkzeug/${encodeURIComponent(z.key)}`, { stufe, wer }); meld.gut(`${z.label}: ${STUFE_KURZ[stufe]}.`); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(false); }
  };
  const mara = daten?.mara ?? [];
  const gruppen: { kanal: string; zeilen: AmpelZeile[] }[] = ["whatsapp", "mail", "auftrag", "alle"].map((k) => ({ kanal: k, zeilen: mara.filter((z) => z.kanal === k) })).filter((g) => g.zeilen.length);
  const rot = mara.filter((z) => z.stufe === "rot").length, gelb = mara.filter((z) => z.stufe === "gelb").length;
  return (
    <div className="ki ki-werkzeuge">
      <KiRundgang schluessel="kiWerkzeuge" raum="ki-werkzeuge" />
      <Kopf titel="Werkzeuge" satz="Was Mara und Aras allein tun dürfen — grün, gelb, rot." kinder={<><span className="ki-pille" title="So viele Werkzeuge stehen auf gelb bzw. rot.">{gelb} gelb · {rot} rot</span><Stand am={geladenAm} neu={neu} fehler={fehler} /></>} />
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <section className="ki-buehne" data-ki="buehne" aria-label="Die drei Stufen">
        <div className="ki-raster drei">
          <div><span className="ki-punkt gruen" aria-hidden="true" /> <b className="ki-leise">Grün</b><p className="ki-still ki-klein">Macht es allein. Prüf-Mara schaut trotzdem hin.</p></div>
          <div><span className="ki-punkt gelb" aria-hidden="true" /> <b className="ki-leise">Gelb</b><p className="ki-still ki-klein">Macht es — und steht danach in „Heute“, damit du es siehst.</p></div>
          <div><span className="ki-punkt rot" aria-hidden="true" /> <b className="ki-leise">Rot</b><p className="ki-still ki-klein">Macht es nicht selbst — die Zeile sagt, was dann passiert. Geld und Erstattung sind immer rot.</p></div>
        </div>
        <Meldung m={meld.m} />
      </section>
      <section className="ki-karte ki-abstand" data-ki="mara" aria-label="Maras Werkzeuge">
        <h2>Mara</h2>
        {gruppen.map((g) => (
          <div key={g.kanal} className="ki-abstand">
            <span className="ki-etikett">{KANAL_TEXT[g.kanal]}</span>
            <ul className="ki-liste">{g.zeilen.map((z) => <Zeile key={z.key} z={z} wer="mara" busy={busy} onStufe={setzen("mara")} />)}</ul>
          </div>
        ))}
      </section>
      <section className="ki-karte ki-abstand" data-ki="aras" aria-label="Aras’ Werkzeuge">
        <h2>Aras</h2>
        {daten?.aras?.length ? <ul className="ki-liste">{daten.aras.map((z) => <Zeile key={z.key} z={z} wer="aras" busy={busy} onStufe={setzen("aras")} />)}</ul> : <NichtVerbunden />}
      </section>
    </div>
  );
}
