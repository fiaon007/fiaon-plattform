// ═══════════════════════════════════════════════════════════════════════════
// REITER „ERGEBNISSE“ (Go-live G, Koordination 20.10.2026)
//
// Justin (20.10.2026): „… dass wir eine Übersicht haben zu den Gesprächen, zu den Ergebnissen, das muss alles clean dargestellt
// werden.“ Je Gesprächsart und Tag: Anrufe · erreicht · Zusagen · Zahlung in 48 h · Aufgaben für Justin · Kündigung ·
// Beschwerde/„nicht mehr anrufen“. JEDE Zahl ist ein Knopf: darunter erscheinen genau die Gespräche dazu — mit derselben
// Zeile und demselben Detail wie im Reiter „Anrufe“ (Zusammenfassung, Gespräch, was ARAS erledigt hat, Prüf-Mara).
// Nur lesen (GET /chef/aras/ergebnisse). Probeanrufe zählen nur, wenn „mit Probe“ gewählt ist.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { holen, NichtVerbunden, type RouteFehler } from "../ki-teile";
import { berlinHeute, euroText, spielartText } from "./aras-texte";
import { Leer, Segment, TagWahl } from "./aras-teile";
import { AnrufZeileAnsicht, type Zeile } from "./ArasAnrufe";

const SPALTEN = [
  { key: "anrufe", t: "Anrufe", titel: "Alle Gespräche dieser Art an diesem Tag" },
  { key: "erreicht", t: "Erreicht", titel: "Kunde am Telefon (auch Rückruf vereinbart)" },
  { key: "zusagen", t: "Zusagen", titel: "Zahlungszusage oder zahlt sofort" },
  { key: "zahlungen", t: "Zahlung ≤ 48 h", titel: "Gespräche, nach denen binnen 48 Stunden eine Zahlung gebucht wurde" },
  { key: "aufgaben", t: "Aufgabe für dich", titel: "ARAS hat eine Aufgabe für dich angelegt (z. B. „Karte nicht erhalten“)" },
  { key: "kuendigung", t: "Kündigung", titel: "Kunde mit Kündigung in der Akte — oder er wollte kündigen/widerrufen" },
  { key: "beschwerde", t: "Beschwerde / Sperre", titel: "„Nicht mehr anrufen“ oder Beschwerde (an einen Menschen übergeben)" },
] as const;
type Spalte = (typeof SPALTEN)[number]["key"];
interface Zelle { n: number; ids: number[] }
interface ErgZeile { spielart: string; zellen: Record<Spalte, Zelle>; euro48h: number }
interface Daten { ok: boolean; tag: string; mitProbe: boolean; zeilen: ErgZeile[]; summe: ErgZeile }

export default function ArasErgebnisse({ verbunden }: { verbunden: boolean }) {
  const [tag, setTag] = useState(berlinHeute());
  const [probe, setProbe] = useState<"kunden" | "probe">("kunden");
  const [daten, setDaten] = useState<Daten | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nichtDa, setNichtDa] = useState(false);
  const [runde, setRunde] = useState(0);
  const [wahl, setWahl] = useState<{ spielart: string; spalte: Spalte } | null>(null);
  const [anrufe, setAnrufe] = useState<Zeile[] | null>(null);
  const [offen, setOffen] = useState<number | null>(null);

  useEffect(() => {
    if (!verbunden) return;
    let weg = false;
    holen<Daten>(`/chef/aras/ergebnisse?tag=${tag}${probe === "probe" ? "&probe=1" : ""}`)
      .then((j) => { if (!weg) { setDaten(j); setFehler(null); } })
      .catch((e) => { if (weg) return; if ((e as RouteFehler).status === 404) setNichtDa(true); setFehler((e as Error).message); });
    const t = window.setInterval(() => { if (document.visibilityState === "visible") setRunde((r) => r + 1); }, 60_000);
    return () => { weg = true; window.clearInterval(t); };
  }, [verbunden, tag, probe, runde]);

  // Die Gespräche zu einer Zahl: die Anrufe des Tages laden (wie im Reiter „Anrufe“) und auf die Kennungen der Zahl filtern.
  useEffect(() => {
    if (!wahl || !verbunden) { setAnrufe(null); return; }
    let weg = false;
    (async () => {
      const alle: Zeile[] = [];
      for (let s = 0; s < 10; s++) {
        const j = await holen<{ zeilen: Zeile[] }>(`/chef/aras/anrufe?tag=${tag}&seite=${s}`).catch(() => ({ zeilen: [] as Zeile[] }));
        alle.push(...(j.zeilen ?? []));
        if ((j.zeilen ?? []).length < 50) break;
      }
      if (!weg) setAnrufe(alle);
    })();
    return () => { weg = true; };
  }, [wahl, tag, verbunden]);

  const gewaehlt = useMemo(() => {
    if (!wahl || !daten) return null;
    const zeile = wahl.spielart === "alle" ? daten.summe : daten.zeilen.find((z) => z.spielart === wahl.spielart);
    return zeile ? new Set(zeile.zellen[wahl.spalte].ids) : null;
  }, [wahl, daten]);
  const liste = useMemo(() => (anrufe && gewaehlt ? anrufe.filter((a) => gewaehlt.has(Number(a.id))) : null), [anrufe, gewaehlt]);

  if (!verbunden || nichtDa) return <NichtVerbunden />;
  const tagWechseln = (t: string) => { setTag(t); setDaten(null); setWahl(null); setOffen(null); };
  const zahl = (z: ErgZeile, s: Spalte) => {
    const n = z.zellen[s].n;
    const an = wahl?.spielart === z.spielart && wahl.spalte === s;
    const text = s === "zahlungen" && n ? `${n} · ${euroText(z.euro48h)}` : String(n);
    return n ? (
      <button type="button" className={`ar-erg-zahl${an ? " an" : ""}`} aria-pressed={an} title={`Die Gespräche dazu zeigen (${SPALTEN.find((x) => x.key === s)?.t})`}
        onClick={() => { setOffen(null); setWahl(an ? null : { spielart: z.spielart, spalte: s }); }}>{text}</button>
    ) : <span className="ar-erg-null">0</span>;
  };

  return (
    <div className="ar-reiter-inhalt" data-ki="ergebnisse">
      <div className="ar-werkzeugleiste">
        <TagWahl tag={tag} onTag={tagWechseln} label="Tag der Ergebnisse" />
        <Segment label="Welche Gespräche" wert={probe} onWahl={(w) => { setProbe(w); setDaten(null); setWahl(null); }} werte={[
          { w: "kunden", t: "Kunden" }, { w: "probe", t: "mit Probe", titel: "Deine Probeanrufe zählen unter der gespielten Gesprächsart mit" },
        ]} />
      </div>
      {fehler && !daten ? <Leer titel="Die Ergebnisse ließen sich nicht laden.">{fehler} <button type="button" className="ar-knopf-text" onClick={() => setRunde((r) => r + 1)}>Nochmal</button></Leer> : null}
      {!daten && !fehler ? <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div> : null}
      {daten ? (
        daten.zeilen.length === 0 ? (
          <Leer titel={probe === "kunden" ? "An diesem Tag noch kein Kundengespräch." : "An diesem Tag noch kein Gespräch."}>
            ARAS ruft Mo–Sa von 09:30 bis 21:00 an. {probe === "kunden" ? <button type="button" className="ar-knopf-text" onClick={() => setProbe("probe")}>Probeanrufe mitzählen</button> : null}
          </Leer>
        ) : (
          <div className="ar-karte ar-erg-karte">
            <div className="ar-erg-tabelle" role="table" aria-label="Ergebnisse je Gesprächsart">
              <div className="ar-erg-zeile kopf" role="row">
                <span role="columnheader">Gesprächsart</span>
                {SPALTEN.map((s) => <span key={s.key} role="columnheader" title={s.titel}>{s.t}</span>)}
              </div>
              {daten.zeilen.map((z) => (
                <div key={z.spielart} className="ar-erg-zeile" role="row">
                  <span role="rowheader"><b>{spielartText(z.spielart)}</b></span>
                  {SPALTEN.map((s) => <span key={s.key} role="cell" data-spalte={s.t}>{zahl(z, s.key)}</span>)}
                </div>
              ))}
              {daten.zeilen.length > 1 ? (
                <div className="ar-erg-zeile summe" role="row">
                  <span role="rowheader">Zusammen</span>
                  {SPALTEN.map((s) => <span key={s.key} role="cell" data-spalte={s.t}>{zahl(daten.summe, s.key)}</span>)}
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : null}
      {wahl ? (
        <div className="ar-karte ar-liste-karte" data-ki="ergebnisse-gespraeche">
          <p className="ar-leise">{`${wahl.spielart === "alle" ? "Alle Gesprächsarten" : spielartText(wahl.spielart)} · ${SPALTEN.find((x) => x.key === wahl.spalte)?.t ?? ""}`} — ein Klick öffnet das Gespräch.</p>
          {!liste ? <div className="ar-zeile-lade" aria-busy="true" /> : liste.length === 0 ? <p className="ar-leise">Keine Gespräche gefunden.</p> : (
            <ul className="ar-anrufe">
              {liste.map((z) => <AnrufZeileAnsicht key={z.id} z={z} offen={offen === z.id} onKlick={() => setOffen(offen === z.id ? null : z.id)} />)}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
