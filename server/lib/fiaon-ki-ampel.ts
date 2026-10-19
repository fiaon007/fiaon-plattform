// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUG-AMPEL (E-409, 19.10.2026)
//
// Grün = Mara macht es allein · gelb = sie macht es, es steht in „Heute“ ·
// rot = nur per Karte an Justin. Gespeichert in fiaon_settings.mara_ampel (und
// aras_ampel für Team 1) als JSON { stufen, verlauf }. Gelesen wird die Stufe
// an drei Stellen, die Maras Werkzeuge wirklich ausführen:
//   · fiaon-whatsapp-mara.ts  werkzeugAusfuehren   (rot → „gesperrt“ ans Modell)
//   · fiaon-postmeister-agent.ts  Werkzeug-Rufe     (rot → wie „bestaetigen“)
//   · fiaon-mara-auftrag.ts  auftragAusfuehren      (rot → Schritt abgelehnt)
// Gelb schreibt eine Protokoll-Zeile (art ampel_gelb) — die Heute-Seite listet sie.
// Nur Stufen, die die Liste erlaubt, gelten; feste Zeilen (Geld, Erstattung …)
// kann niemand umschalten. Eine Ampel macht nichts freier, als der Code es heute ist.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  MARA_AMPEL, MARA_AMPEL_SCHALTER, ARAS_AMPEL_SCHALTER, ampelStandLesen, ampelStufeAus, ampelZeilen,
  type AmpelStand, type AmpelStufe, type AmpelWerkzeug, type AmpelZeile,
} from "@shared/fiaon-ki-team";
import { aras } from "./fiaon-ki-aras-anbindung";

type Wer = "mara" | "aras";
const HALT_MS = 20_000;
const speicher = new Map<Wer, { bis: number; stand: AmpelStand }>();

function schluesselFuer(wer: Wer): string { return wer === "mara" ? MARA_AMPEL_SCHALTER : ARAS_AMPEL_SCHALTER; }
export function ampelListe(wer: Wer): readonly AmpelWerkzeug[] {
  return wer === "mara" ? MARA_AMPEL : (aras()?.konstanten?.ARAS_AMPEL ?? []);
}

export async function ampelStand(wer: Wer, frisch = false): Promise<AmpelStand> {
  const da = speicher.get(wer);
  if (!frisch && da && da.bis > Date.now()) return da.stand;
  let stand: AmpelStand = { stufen: {}, verlauf: [] };
  try {
    const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluesselFuer(wer)}`) as any[];
    stand = ampelStandLesen(z?.value);
  } catch (e) {
    console.error("[KI-AMPEL] nicht lesbar — Vorgaben gelten:", String((e as Error)?.message ?? e).slice(0, 160));
  }
  speicher.set(wer, { bis: Date.now() + HALT_MS, stand });
  return stand;
}

/** Die wirksame Stufe eines Werkzeugs — unbekanntes Werkzeug oder Lesefehler = grün (die Ampel bremst nur, was sie kennt). */
export async function ampelStufe(wer: Wer, key: string): Promise<AmpelStufe> {
  const liste = ampelListe(wer);
  if (!liste.some((w) => w.key === key)) return "gruen";
  return ampelStufeAus(liste, await ampelStand(wer), key);
}

export async function ampelZeilenLesen(wer: Wer): Promise<AmpelZeile[]> {
  return ampelZeilen(ampelListe(wer), await ampelStand(wer, true));
}

/** Eine Stufe setzen — nur Stufen, die die Liste für dieses Werkzeug erlaubt; feste Zeilen nie. */
export async function ampelSetzen(wer: Wer, key: string, stufe: AmpelStufe, von: string): Promise<{ ok: true; zeile: AmpelZeile } | { ok: false; fehler: string }> {
  const liste = ampelListe(wer);
  const w = liste.find((x) => x.key === key);
  if (!w) return { ok: false, fehler: "Dieses Werkzeug gibt es nicht." };
  if (w.fest) return { ok: false, fehler: "Diese Stufe ist fest — sie lässt sich nicht umschalten." };
  if (!w.stufen.includes(stufe)) return { ok: false, fehler: `Erlaubt für „${w.label}“: ${w.stufen.join(", ")}.` };
  const stand = await ampelStand(wer, true);
  const vorher = ampelStufeAus(liste, stand, key);
  const neu: AmpelStand = {
    stufen: { ...stand.stufen, [key]: stufe },
    verlauf: [...stand.verlauf, { am: new Date().toISOString(), key, von: vorher, nach: stufe, wer: von }].slice(-50),
  };
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluesselFuer(wer)}, ${JSON.stringify(neu)}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  speicher.delete(wer);
  const zeile = ampelZeilen(liste, neu).find((z) => z.key === key)!;
  console.log(`[KI-AMPEL] ${wer} · ${key}: ${vorher} → ${stufe} (${von})`);
  return { ok: true, zeile };
}

/** Der Satz, den ein rotes Werkzeug dem Modell zurückgibt. */
export const AMPEL_ROT_TEXT = "Dieses Werkzeug ist gerade gesperrt (Ampel rot) — sag dem Kunden, dass sich ein Kollege kümmert, und übergib den Fall (Aufgabe/Notiz). Nichts versprechen.";

/**
 * Vor einem Werkzeug-Ruf: rot → Satz zurück (der Aufrufer bricht ab), gelb → Protokollzeile
 * (die Heute-Seite listet sie), grün → nichts. Lesefehler = grün.
 */
export async function ampelPruefen(wer: Wer, key: string, ein: { kanal: "whatsapp" | "mail" | "auftrag"; personId?: number | null; nummer?: string | null; von?: string }): Promise<{ stufe: AmpelStufe; gesperrt: boolean; text: string | null }> {
  const stufe = await ampelStufe(wer, key).catch(() => "gruen" as AmpelStufe);
  if (stufe === "rot") {
    console.log(`[KI-AMPEL] ${wer} · ${key} ist ROT — abgelehnt (${ein.kanal}${ein.personId ? `, Person ${ein.personId}` : ""}).`);
    void protokoll("ampel_rot", ein, `Werkzeug „${key}“ abgelehnt — Ampel rot.`, { werkzeug: key, stufe });
    return { stufe, gesperrt: true, text: AMPEL_ROT_TEXT };
  }
  if (stufe === "gelb") void protokoll("ampel_gelb", ein, `Werkzeug „${key}“ ausgeführt — Ampel gelb (steht in „Heute“).`, { werkzeug: key, stufe });
  return { stufe, gesperrt: false, text: null };
}

async function protokoll(art: "ampel_rot" | "ampel_gelb", ein: { kanal: string; personId?: number | null; nummer?: string | null }, text: string, daten: Record<string, unknown>): Promise<void> {
  try {
    const { protokollieren } = await import("./fiaon-mara-termin");
    await protokollieren({ art, kanal: ein.kanal, personId: ein.personId ?? null, nummer: ein.nummer ?? null, text, daten, ok: art !== "ampel_rot" });
  } catch (e) {
    console.error("[KI-AMPEL] Protokoll:", String((e as Error)?.message ?? e).slice(0, 120));
  }
}

/** Nur für Prüfstände. */
export function ampelZwischenspeicherLeeren(): void { speicher.clear(); }
