// ═══════════════════════════════════════════════════════════════════════════
// ARAS — „Ergebnisse“ je Gesprächsart und Tag (Go-live G, Koordination 20.10.2026)
//
// Justin (20.10.2026): „… und natürlich auch dass wir eine Übersicht haben zu den Gesprächen, zu den Ergebnissen, das muss
// alles clean dargestellt werden.“ Je Gesprächsart (Willkommen, Rate offen, Termin …) für EINEN Tag (Berlin):
//   Anrufe · erreicht · Zusagen · Zahlungen binnen 48 h (in €) · Aufgaben für Justin · Kündigungsfälle · Beschwerden/„nicht
//   mehr anrufen“/Streitfall (Betrug, Anzeige, Anwalt — Auswertung 21./22.10.) — und zu JEDER Zahl die Anrufe
//   (fiaon_aras_anruf.id), damit die Oberfläche die Gespräche dazu öffnet.
// Rein lesend. Probeanrufe zählen nur auf Wunsch (dann unter der gespielten Gesprächsart).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";

type Lauf = typeof sqlPool;

export const ERGEBNIS_SPALTEN = ["anrufe", "erreicht", "zusagen", "zahlungen", "aufgaben", "kuendigung", "beschwerde"] as const;
export type ErgebnisSpalte = (typeof ERGEBNIS_SPALTEN)[number];
export interface ErgebnisZelle { n: number; ids: number[] }
export interface ErgebnisZeile { spielart: string; zellen: Record<ErgebnisSpalte, ErgebnisZelle>; euro48h: number }
export interface Ergebnisse { tag: string; mitProbe: boolean; zeilen: ErgebnisZeile[]; summe: ErgebnisZeile }

const ERREICHT = /^(erreicht|rueckruf)/;
const ZUSAGE = new Set(["erreicht_zahlt_am", "erreicht_zahlt_gleich"]);

function leereZeile(spielart: string): ErgebnisZeile {
  return { spielart, zellen: Object.fromEntries(ERGEBNIS_SPALTEN.map((s) => [s, { n: 0, ids: [] as number[] }])) as Record<ErgebnisSpalte, ErgebnisZelle>, euro48h: 0 };
}

/** Ein Tag (JJJJ-MM-TT, Berlin). mitProbe: Probeanrufe zählen unter der gespielten Art mit. */
export async function ergebnisseTag(tag: string, opt: { mitProbe?: boolean } = {}, lauf: Lauf = sqlPool): Promise<Ergebnisse> {
  await arasSchema(lauf);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : new Date().toISOString().slice(0, 10);
  const mitProbe = opt.mitProbe === true;
  const rows = (await lauf`
    WITH a AS (
      SELECT an.id, an.spielart, an.briefing, an.ergebnis, c.person_id, COALESCE(c.beginn, an.created_at) AS beginn
        FROM fiaon_aras_anruf an JOIN fiaon_calls c ON c.id = an.call_id
       WHERE (an.created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date AND (${mitProbe} OR an.spielart <> 'probe')
    )
    SELECT a.id, a.beginn,
           CASE WHEN a.spielart = 'probe' THEN COALESCE(NULLIF(a.briefing->>'probeSpielart', ''), 'probe') ELSE a.spielart END AS art,
           a.ergebnis,
           EXISTS (SELECT 1 FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = a.id AND w.werkzeug = 'zahlungszusage_merken' AND w.ok) AS zusage_wz,
           EXISTS (SELECT 1 FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = a.id AND w.werkzeug = 'aufgabe_fuer_justin' AND w.ok) AS aufgabe,
           EXISTS (SELECT 1 FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = a.id AND (w.werkzeug = 'nicht_mehr_anrufen' AND w.ok
                     OR w.werkzeug = 'mensch_verbinden' AND COALESCE(w.eingabe->>'grund', '') ~* 'beschwer'
                     OR w.werkzeug = 'aufgabe_fuer_justin' AND w.ok AND COALESCE(w.eingabe->>'art', '') = 'streitfall')) AS beschwerde,
           (jsonb_typeof(a.briefing->'kuendigung') = 'object'
             OR EXISTS (SELECT 1 FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = a.id AND w.werkzeug = 'mensch_verbinden'
                          AND COALESCE(w.eingabe->>'grund', '') ~* '(kuendig|kündig|widerruf)')) AS kuendigung,
           COALESCE((SELECT json_agg(json_build_object('id', r.id, 'cents', r.betrag_cents, 'nr', r.rate_nr))
                       FROM fiaon_abo_raten r JOIN fiaon_applications ap ON ap.ref = r.ref
                      WHERE a.person_id IS NOT NULL AND ap.person_id = a.person_id AND r.bezahlt_am IS NOT NULL
                        AND r.bezahlt_am BETWEEN a.beginn AND a.beginn + INTERVAL '48 hours'), '[]'::json) AS zahlungen
      FROM a ORDER BY a.id`) as any[];

  const zeilen = new Map<string, ErgebnisZeile>();
  const summe = leereZeile("alle");
  const zaehl = (z: ErgebnisZeile, s: ErgebnisSpalte, id: number) => { z.zellen[s].n += 1; if (z.zellen[s].ids.length < 300) z.zellen[s].ids.push(id); };
  // Jede Zahlung zählt GENAU EINMAL — beim passendsten Anruf davor: erst die passende Gesprächsart (Rate 2 ff. → Rate offen/
  // Zusage, Rate 1 = Aktivierung → Willkommen), dann ein erreichter, dann der jüngste.
  const passt = (art: string, nr: number) => (nr >= 2 ? art === "rate" || art === "zusage" : art === "willkommen" || art === "stufe_a");
  const kandidaten = new Map<number, { anruf: number; art: string; erreicht: boolean; passt: boolean; beginn: number; cents: number }[]>();
  for (const r of rows) {
    for (const p of (Array.isArray(r.zahlungen) ? r.zahlungen : []) as { id: number; cents: number; nr: number }[]) {
      const l = kandidaten.get(Number(p.id)) ?? [];
      const art = String(r.art ?? "probe");
      l.push({ anruf: Number(r.id), art, erreicht: ERREICHT.test(String(r.ergebnis ?? "")), passt: passt(art, Number(p.nr) || 0), beginn: Date.parse(String(r.beginn)) || 0, cents: Number(p.cents) || 0 });
      kandidaten.set(Number(p.id), l);
    }
  }
  const zahlungAnruf = new Map<number, number>(); // Anruf → Cent (zugeordnete Zahlungen)
  const euroJeArt = new Map<string, number>();
  let euroAlle = 0;
  for (const l of Array.from(kandidaten.values())) {
    const best = l.slice().sort((a, b) => (Number(b.passt) - Number(a.passt)) || (Number(b.erreicht) - Number(a.erreicht)) || (b.beginn - a.beginn))[0];
    zahlungAnruf.set(best.anruf, (zahlungAnruf.get(best.anruf) ?? 0) + best.cents);
    euroJeArt.set(best.art, (euroJeArt.get(best.art) ?? 0) + best.cents);
    euroAlle += best.cents;
  }
  for (const r of rows) {
    const art = String(r.art ?? "probe");
    const z = zeilen.get(art) ?? leereZeile(art);
    zeilen.set(art, z);
    const id = Number(r.id);
    const treffer: ErgebnisSpalte[] = ["anrufe"];
    const erg = String(r.ergebnis ?? "");
    if (ERREICHT.test(erg)) treffer.push("erreicht");
    if (ZUSAGE.has(erg) || r.zusage_wz) treffer.push("zusagen");
    if (zahlungAnruf.has(id)) treffer.push("zahlungen");
    if (r.aufgabe) treffer.push("aufgaben");
    if (r.kuendigung) treffer.push("kuendigung");
    if (r.beschwerde) treffer.push("beschwerde");
    for (const s of treffer) { zaehl(z, s, id); zaehl(summe, s, id); }
  }
  for (const [art, cents] of Array.from(euroJeArt.entries())) {
    const z = zeilen.get(art);
    if (z) z.euro48h = Math.round(cents) / 100;
  }
  summe.euro48h = Math.round(euroAlle) / 100;
  // Reihenfolge: Willkommen und Rate offen zuerst (die zwei Szenarien des Go-live), dann nach Anzahl.
  const vorne = ["willkommen", "rate"];
  const liste = Array.from(zeilen.values()).sort((a, b) => {
    const ia = vorne.indexOf(a.spielart), ib = vorne.indexOf(b.spielart);
    if (ia !== ib) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    return b.zellen.anrufe.n - a.zellen.anrufe.n;
  });
  return { tag: t, mitProbe, zeilen: liste, summe };
}
