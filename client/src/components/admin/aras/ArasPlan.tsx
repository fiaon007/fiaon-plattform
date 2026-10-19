// Reiter „Plan“ (E-409): Stundenplan je Spielart, Mengen, Lernvorschlag — Tagesplan aus /chef/aras/plan.
import { useState } from "react";
import { useTakt, Fehler, NichtVerbunden, zahl } from "../ki-teile";
import { ARAS_SPIELARTEN, SPIELART_TEXT } from "./aras-teile";

interface Tagesplan { ok: boolean; tag: string; stunden: { h: number; je: Record<string, { geplant: number; gewaehlt: number; erreicht: number; gespraeche: number }> }[]; mengen: Record<string, { pool: number; geplant: number }>; lernvorschlag: any }

export default function ArasPlan({ verbunden }: { verbunden: boolean }) {
  const [tag, setTag] = useState(new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }));
  const { daten, fehler, status, neu } = useTakt<Tagesplan>(verbunden ? `/chef/aras/plan?tag=${tag}` : null, 60_000);
  if (!verbunden || status === 404) return <NichtVerbunden />;
  if (fehler && !daten) return <Fehler text={fehler} erneut={neu} />;
  if (!daten) return <div className="ki-leer">lädt …</div>;
  const stunden = (daten.stunden ?? []).filter((s) => s.h >= 8 && s.h <= 19);
  const summe = (s: Tagesplan["stunden"][number], k: "geplant" | "gewaehlt" | "erreicht") => Object.values(s.je ?? {}).reduce((a, b) => a + (Number(b?.[k]) || 0), 0);
  const max = Math.max(1, ...stunden.map((s) => summe(s, "geplant")));
  return (
    <div>
      <div className="ki-chips" style={{ marginBottom: 12 }}>
        <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} aria-label="Tag (JJJJ-MM-TT)" style={{ width: 130 }} />
        <span className="ki-still ki-klein">Stunden 8–19 Uhr · Höhe = geplant, Zahl = erreicht</span>
      </div>
      <div className="ki-karte">
        <h2>Stundenplan</h2>
        <div className="ki-stunden" role="img" aria-label="Geplante Anrufe je Stunde">
          {stunden.map((s) => <div key={s.h} title={`${s.h} Uhr: ${summe(s, "geplant")} geplant · ${summe(s, "gewaehlt")} gewählt · ${summe(s, "erreicht")} erreicht`}><i style={{ ["--h" as any]: `${Math.round((summe(s, "geplant") / max) * 100)}%` }} />{s.h}<br /><span className="ki-leise">{summe(s, "erreicht") || ""}</span></div>)}
        </div>
      </div>
      <div className="ki-karte ki-abstand">
        <h2>Mengen je Spielart</h2>
        <div className="ki-tabelle-rahmen">
          <table className="ki-tabelle">
            <thead><tr><th>Spielart</th><th className="zahl">Pool</th><th className="zahl">geplant</th><th className="zahl">gewählt</th><th className="zahl">erreicht</th><th className="zahl">Gespräche</th></tr></thead>
            <tbody>
              {ARAS_SPIELARTEN.filter((sp) => daten.mengen?.[sp] || stunden.some((s) => s.je?.[sp])).map((sp) => {
                const g = (k: "geplant" | "gewaehlt" | "erreicht" | "gespraeche") => stunden.reduce((a, s) => a + (Number(s.je?.[sp]?.[k]) || 0), 0);
                return <tr key={sp}><td>{SPIELART_TEXT[sp]}</td><td className="zahl">{zahl(daten.mengen?.[sp]?.pool)}</td><td className="zahl">{zahl(daten.mengen?.[sp]?.geplant ?? g("geplant"))}</td><td className="zahl">{zahl(g("gewaehlt"))}</td><td className="zahl">{zahl(g("erreicht"))}</td><td className="zahl">{zahl(g("gespraeche"))}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="ki-karte ki-abstand">
        <h2>Lernvorschlag <span className="ki-still ki-klein">· sonntags, nur Anzeige</span></h2>
        {daten.lernvorschlag ? <pre className="ki-klein" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{typeof daten.lernvorschlag === "string" ? daten.lernvorschlag : JSON.stringify(daten.lernvorschlag, null, 1)}</pre> : <p className="ki-still">Noch keiner — der Plan lernt aus den ersten zwei Wochen.</p>}
      </div>
    </div>
  );
}
