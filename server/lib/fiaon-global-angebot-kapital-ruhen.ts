// FIAON GLOBAL — Ruhetage der Garantiefrist im Kapital-Angebot eintragen (Register E-512, 13.11.2026).
// Regeln und Rechnung: shared/fiaon-global-angebot-kapital-ruhen.ts (rein, Prüfstand scripts/pruef-kapital-ruhen.ts).
// Das Fristende rückt um genau die gezählten Tage; Verlauf des Angebots und des Auftrags halten Grund und Zeitraum fest.
// Keine Kundenmail: Kapital-Kunden bekommen keine Automatik-Mails (firmaGlobalMailSperre), und Ziffer 4 (ab E-512) sagt
// „die Tage nennt FIAON dem Auftraggeber auf Wunsch mit Datum“.
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { angebotLesen, verlaufAngebot } from "./fiaon-global-angebot";
import { globalVerlauf } from "./fiaon-global-auftrag";
import { kapitalCDatenAus } from "./fiaon-global-angebot-kapital-c";
import { istKapitalFassung, istKapitalCFassung } from "@shared/fiaon-global-angebot-kapital";
import { kapitalCRuhenErweitert } from "@shared/fiaon-global-angebot-kapital-c";
import { kapitalRuhenLage, kapitalRuhenRechnen, kapitalRuhenVermerk, type KapitalRuhenGrund } from "@shared/fiaon-global-angebot-kapital-ruhen";

type Ergebnis = { ok: true; tage: number; von: string; bisGezaehlt: string; offen: boolean; fristEnde: string } | { ok: false; status: number; error: string };

const isoTag = (v: unknown): string | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};
const tagText = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;

/** Die Lage für eine Angebotszeile — dieselbe Rechnung wie im Chefbüro (Zeile aus fiaon_global_angebote). */
export function kapitalRuhenLageAus(z: any) {
  const fassungC = istKapitalCFassung(z.fassung);
  const par = fassungC ? kapitalCDatenAus(z).parameter : null;
  return kapitalRuhenLage({
    fassungC, ruhenErweitert: !!par && kapitalCRuhenErweitert(par), datenVomKunden: !!par?.datenVomKunden, status: String(z.status),
    fristBeginn: isoTag(z.frist_beginn), fristEnde: isoTag(z.frist_ende), hemmungTage: Number(z.frist_hemmung_tage || 0),
    garantieErfuellt: !!z.garantie_erfuellt_am, erstattung: !!z.erstattung_ausgeloest_am,
    verlauf: Array.isArray(z.verlauf) ? z.verlauf : (() => { try { return JSON.parse(String(z.verlauf ?? "[]")); } catch { return []; } })(),
  });
}

export async function kapitalFristRuhen(id: number, ein: any, wer: string): Promise<Ergebnis> {
  const z = await angebotLesen({ id });
  if (!z) return { ok: false, status: 404, error: "Dieses Angebot gibt es nicht." };
  if (!istKapitalFassung(z.fassung)) return { ok: false, status: 409, error: "Ruhetage über diesen Knopf nur für Kapital-Angebote." };
  const lage = kapitalRuhenLageAus(z);
  if (lage.sperre) return { ok: false, status: 409, error: lage.sperre };
  const grund = String(ein?.grund ?? "") as KapitalRuhenGrund;
  if (!lage.gruende.some((g) => g.key === grund)) return { ok: false, status: 400, error: "Dieser Grund steht nicht im Vertrag dieses Kunden — bitte einen der angebotenen Gründe wählen." };
  const text = String(ein?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (text.length < 20) return { ok: false, status: 400, error: "Worauf wurde gewartet? Bitte in einem Satz mit Beleg (mindestens 20 Zeichen), z. B. „Bitte um Zwischenzahlen per Mail vom 13.11., Eingang 18.11.“." };
  const heute = berlinToday();
  const bisRoh = String(ein?.bis ?? "").trim();
  const r = kapitalRuhenRechnen({ von: String(ein?.von ?? "").trim(), bis: bisRoh || null, heute, fristBeginn: lage.fristBeginn!, bisher: lage.bisher });
  if (!r.ok) return { ok: false, status: 400, error: r.error };
  const [neu] = (await sqlPool`
    UPDATE fiaon_global_angebote SET
      frist_hemmung_tage = frist_hemmung_tage + ${r.tage},
      frist_ende = frist_ende + ${r.tage}::int,
      frist_warnung_14_am = CASE WHEN frist_ende + ${r.tage}::int - ${heute}::date > 14 THEN NULL ELSE frist_warnung_14_am END,
      frist_warnung_3_am = CASE WHEN frist_ende + ${r.tage}::int - ${heute}::date > 3 THEN NULL ELSE frist_warnung_3_am END,
      frist_abgelaufen_am = CASE WHEN frist_ende + ${r.tage}::int >= ${heute}::date THEN NULL ELSE frist_abgelaufen_am END,
      updated_at = NOW()
     WHERE id = ${id} AND frist_ende IS NOT NULL AND garantie_erfuellt_am IS NULL AND erstattung_ausgeloest_am IS NULL
     RETURNING frist_ende`) as any[];
  if (!neu) return { ok: false, status: 409, error: "Die Frist hat sich gerade geändert (Garantie erfüllt oder Garantiefall) — bitte neu laden." };
  const fristEnde = isoTag(neu.frist_ende)!;
  await verlaufAngebot(id, wer, kapitalRuhenVermerk({ grund, von: r.von, bisGezaehlt: r.bisGezaehlt, tage: r.tage, offen: r.offen, text, fristEndeNeu: fristEnde }),
    { ruhenVon: r.von, ruhenBis: r.bisGezaehlt, ruhenGrund: grund, ruhenTage: r.tage, ruhenOffen: r.offen });
  if (z.auftrag_ref) {
    await globalVerlauf(String(z.auftrag_ref), `FIAON Global: Garantiefrist des Kapital-Angebots ${z.angebot_ref} ruhte vom ${tagText(r.von)} bis ${tagText(r.bisGezaehlt)} (${r.tage} ${r.tage === 1 ? "Tag" : "Tage"}, ${wer}). Neues Fristende ${tagText(fristEnde)}.`)
      .catch((e: unknown) => console.error(`[KAPITAL-RUHEN] ${z.angebot_ref}: Auftragsverlauf:`, e));
  }
  return { ok: true, tage: r.tage, von: r.von, bisGezaehlt: r.bisGezaehlt, offen: r.offen, fristEnde };
}
