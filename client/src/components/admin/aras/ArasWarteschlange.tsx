// Reiter „Warteschlange“ (E-409): wer als Nächstes dran ist und warum — verschieben, entfernen, einreihen.
import { useState } from "react";
import { akteLink } from "@/lib/akte-link";
import type { PlanZeile } from "@shared/fiaon-ki-team";
import { useTakt, senden, useMeldung, Meldung, Fehler, NichtVerbunden, tagZeit } from "../ki-teile";
import { SpielartWahl, SPIELART_TEXT } from "./aras-teile";

const STATUS = ["wartet", "gewaehlt", "laeuft", "fertig", "verfallen", "gesperrt", "verschoben"];

export default function ArasWarteschlange({ verbunden }: { verbunden: boolean }) {
  const [status, setStatus] = useState("wartet");
  const [spielart, setSpielart] = useState("");
  const { daten, fehler, status: http, neu } = useTakt<{ ok: boolean; zeilen: PlanZeile[] }>(verbunden ? `/chef/aras/warteschlange?status=${status}${spielart ? `&spielart=${spielart}` : ""}` : null, 20_000);
  const [busy, setBusy] = useState<number | null>(null);
  const [neuPerson, setNeuPerson] = useState(""), [neuSpielart, setNeuSpielart] = useState("termin"), [neuGrund, setNeuGrund] = useState("");
  const meld = useMeldung();
  if (!verbunden || http === 404) return <NichtVerbunden />;
  const tun = async (z: PlanZeile, was: "verschieben" | "entfernen") => {
    let body: any = { grund: "Chefbüro" };
    if (was === "verschieben") { const bis = window.prompt("Verschieben bis (JJJJ-MM-TT HH:MM)", ""); if (!bis) return; body = { bis: new Date(bis.replace(" ", "T")).toISOString(), grund: "Chefbüro" }; }
    setBusy(z.id);
    try { await senden(`/chef/aras/warteschlange/${z.id}/${was}`, body); meld.gut(was === "verschieben" ? "Verschoben." : "Entfernt."); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  const einreihen = async () => {
    setBusy(-1);
    try { await senden("/chef/aras/warteschlange/einreihen", { personId: Number(neuPerson), spielart: neuSpielart, grund: neuGrund }); meld.gut("Eingereiht."); setNeuPerson(""); setNeuGrund(""); neu(); }
    catch (e) { meld.fehler((e as Error).message); } finally { setBusy(null); }
  };
  return (
    <div>
      <div className="ki-chips" style={{ marginBottom: 12 }}>
        <div className="ki-segment" role="group" aria-label="Status">{STATUS.map((s) => <button key={s} type="button" className={status === s ? "an" : ""} onClick={() => setStatus(s)}>{s}</button>)}</div>
        <select value={spielart} onChange={(e) => setSpielart(e.target.value)} aria-label="Spielart"><option value="">alle Spielarten</option>{Object.entries(SPIELART_TEXT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <Meldung m={meld.m} />
      </div>
      {fehler && !daten ? <Fehler text={fehler} erneut={neu} /> : null}
      <div className="ki-karte">
        {!daten?.zeilen.length ? <p className="ki-still">Niemand in dieser Liste.</p> : (
          <ul className="ki-liste">
            {daten.zeilen.map((z) => {
              const link = z.personId ? akteLink(z.personId, "chef") : null;
              return (
                <li key={z.id} className="ki-zeile" data-ki-plan={z.id}>
                  <div className="ki-zeile-kopf"><span className="ki-pille akz">{SPIELART_TEXT[z.spielart] ?? z.spielart}</span>{link ? <a href={link}>{z.name || `#${z.personId}`}</a> : <span>{z.name || "—"}</span>}<span className="ki-still ki-klein">Prio {z.prioritaet} · Versuch {z.versuchNr} · {z.rechtsgrund}</span></div>
                  <div className="ki-chips">
                    {z.status === "wartet" ? <><button type="button" className="ki-knopf klein" disabled={busy === z.id} onClick={() => tun(z, "verschieben")}>Verschieben</button><button type="button" className="ki-knopf klein warn" disabled={busy === z.id} onClick={() => tun(z, "entfernen")}>Entfernen</button></> : <span className="ki-pille">{z.status}</span>}
                  </div>
                  <span className="ki-zeile-satz">{z.grund} · Fenster {tagZeit(z.fruehAb)} – {tagZeit(z.spaetBis)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="ki-karte ki-abstand" data-ki="einreihen">
        <h2>Von Hand einreihen</h2>
        <div className="ki-chips">
          <input type="text" placeholder="Personen-Nr." value={neuPerson} onChange={(e) => setNeuPerson(e.target.value)} style={{ width: 120 }} aria-label="Personen-Nummer" />
          <SpielartWahl wert={neuSpielart} onChange={setNeuSpielart} />
          <input type="text" className="breit" placeholder="Grund (ein Satz)" value={neuGrund} onChange={(e) => setNeuGrund(e.target.value)} aria-label="Grund" />
          <button type="button" className="ki-knopf klein haupt" disabled={busy === -1 || !neuPerson || neuGrund.length < 3} onClick={einreihen}>Einreihen</button>
        </div>
        <p className="ki-still ki-klein ki-abstand">Der Server prüft Sperre, Global, Rechtsgrund und Fenster — ohne Einwilligung keine Werbe-Spielart.</p>
      </div>
    </div>
  );
}
