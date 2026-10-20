// ═══════════════════════════════════════════════════════════════════════════
// REITER „TAGESPLAN“ (Cockpit, 20.10.2026) — wann Aras wen anruft
// Kalender statt Textfeld; Stunden 8–19 als ruhige Balken (geplant) mit der Zahl der Erreichten; Mengen je Art nur,
// wenn es welche gibt; der Lernvorschlag als Satz (vorher roher JSON-Text). Nur Anzeige — nichts ändert sich allein.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useTakt, NichtVerbunden, zahl } from "../ki-teile";
import { berlinHeute, spielartText } from "./aras-texte";
import { Karte, Leer, TagWahl } from "./aras-teile";

type Je = Record<string, { geplant: number; gewaehlt: number; erreicht: number; gespraeche: number }>;
interface Tagesplan { ok: boolean; tag: string; stunden: { h: number; je: Je }[]; mengen: Record<string, { pool: number; geplant: number }>; lernvorschlag: { text?: string; erzeugtAm?: string } | string | null }

export default function ArasPlan({ verbunden }: { verbunden: boolean }) {
  const [tag, setTag] = useState(berlinHeute());
  const { daten, fehler, status, neu } = useTakt<Tagesplan>(verbunden ? `/chef/aras/plan?tag=${tag}` : null, 60_000);
  if (!verbunden || status === 404) return <NichtVerbunden />;
  const stunden = (daten?.stunden ?? []).filter((s) => s.h >= 8 && s.h <= 19);
  // Nur Kundenanrufe zählen — Probeanrufe gehören in den Reiter „Probe“/„Anrufe“, nicht in den Plan.
  const summe = (s: { je: Je }, k: "geplant" | "gewaehlt" | "erreicht" | "gespraeche") => Object.entries(s.je ?? {}).filter(([sp]) => sp !== "probe").reduce((a, [, b]) => a + (Number(b?.[k]) || 0), 0);
  const max = Math.max(1, ...stunden.map((s) => Math.max(summe(s, "geplant"), summe(s, "gewaehlt"))));
  const gesamt = { geplant: stunden.reduce((a, s) => a + summe(s, "geplant"), 0), gewaehlt: stunden.reduce((a, s) => a + summe(s, "gewaehlt"), 0), erreicht: stunden.reduce((a, s) => a + summe(s, "erreicht"), 0) };
  const arten = Object.keys(daten?.mengen ?? {}).filter((sp) => sp !== "probe" && sp !== "eingehend").map((sp) => {
    const g = (k: "geplant" | "gewaehlt" | "erreicht" | "gespraeche") => stunden.reduce((a, s) => a + (Number(s.je?.[sp]?.[k]) || 0), 0);
    return { sp, pool: Number(daten!.mengen[sp]?.pool ?? 0), geplant: Number(daten!.mengen[sp]?.geplant ?? 0) || g("geplant"), gewaehlt: g("gewaehlt"), erreicht: g("erreicht"), gespraeche: g("gespraeche") };
  }).filter((a) => a.pool || a.geplant || a.gewaehlt);
  const lern = daten?.lernvorschlag ? (typeof daten.lernvorschlag === "string" ? daten.lernvorschlag : daten.lernvorschlag.text ?? "") : "";
  // Die Berliner Stunde aus „HH:MM:SS“ (sv-SE) — nicht aus einem „15 Uhr“-Text (Zeit-Falle: Number(...) = NaN).
  const jetztH = tag === berlinHeute() ? Number(new Date().toLocaleTimeString("sv-SE", { timeZone: "Europe/Berlin" }).slice(0, 2)) : -1;
  return (
    <div className="ar-reiter-inhalt" data-ki="plan">
      <div className="ar-werkzeugleiste">
        <TagWahl tag={tag} onTag={setTag} zukunft label="Tag des Plans" />
        {daten ? <span className="ar-leise">{gesamt.geplant ? `${zahl(gesamt.geplant)} geplant · ${zahl(gesamt.gewaehlt)} gewählt · ${zahl(gesamt.erreicht)} erreicht` : "Für diesen Tag ist nichts geplant."}</span> : null}
      </div>
      {fehler && !daten ? <Leer titel="Der Plan ließ sich nicht laden.">{fehler} <button type="button" className="ar-knopf-text" onClick={neu}>Nochmal</button></Leer> : null}
      {!daten && !fehler ? <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div> : null}
      {daten ? (
        <>
          <Karte titel="Stunden" satz="Balken = geplant, Zahl darunter = erreicht.">
            <div className="ar-stunden" role="img" aria-label="Geplante Anrufe je Stunde von 8 bis 19 Uhr">
              {stunden.map((s) => {
                const g = summe(s, "geplant"), w = summe(s, "gewaehlt"), e = summe(s, "erreicht");
                return (
                  <div key={s.h} className={s.h === jetztH ? "jetzt" : ""} title={`${s.h}–${s.h + 1} Uhr: ${g} geplant · ${w} gewählt · ${e} erreicht`}>
                    <span className="ar-saeule"><i style={{ height: `${Math.round((Math.max(g, w) / max) * 100)}%` }} /></span>
                    <small>{s.h}</small>
                    <b>{e || ""}</b>
                  </div>
                );
              })}
            </div>
          </Karte>
          <Karte titel="Je Gesprächsart">
            {arten.length ? (
              <div className="ar-tabelle-rahmen">
                <table className="ar-tabelle">
                  <thead><tr><th>Art</th><th className="zahl" title="Wartet insgesamt in der Liste">Wartet</th><th className="zahl">Geplant</th><th className="zahl">Gewählt</th><th className="zahl">Erreicht</th><th className="zahl" title="Gespräche ab 30 Sekunden">Gespräche</th></tr></thead>
                  <tbody>{arten.map((a) => <tr key={a.sp}><td>{spielartText(a.sp)}</td><td className="zahl">{zahl(a.pool)}</td><td className="zahl">{zahl(a.geplant)}</td><td className="zahl">{zahl(a.gewaehlt)}</td><td className="zahl">{zahl(a.erreicht)}</td><td className="zahl">{zahl(a.gespraeche)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="ar-leise">Noch keine Kundenanrufe geplant — in Stufe 0 ruft ARAS nur dich an.</p>}
          </Karte>
          <Karte titel="Lernvorschlag" satz="Sonntags ein Vorschlag, zu welchen Stunden ARAS besser anruft — nur zum Lesen.">
            {lern ? <p className="ar-text">{lern}</p> : <p className="ar-leise">Noch keiner — der Plan lernt aus den ersten zwei Wochen mit Kundenanrufen.</p>}
          </Karte>
        </>
      ) : null}
    </div>
  );
}
