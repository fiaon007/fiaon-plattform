// ═══════════════════════════════════════════════════════════════════════════
// DIE WERKZEUG-AMPEL (E-409, 19.10.2026) — EINE Ampel für Mara (und Aras)
//
// Grün = Mara macht es allein · gelb = sie macht es, es steht danach in „Heute“ ·
// rot = sie macht es nicht selbst (was dann passiert, sagt die Zeile: eine echte
// Karte an Justin oder Mara lässt es weg). Gespeichert in fiaon_settings.mara_ampel
// (und aras_ampel für Team 1, E-408) als JSON { stufen, verlauf }. Die Liste steht
// rein in shared/fiaon-ki-team.ts (MARA_AMPEL, echte Werkzeugnamen aus dem Code).
//
// E-409 × E-406 (Integration, 20.10.2026): Es gibt nur noch DIESE Ampel — die zweite
// aus E-406 B3 (eigene Namen wie termin_eintragen) ist in ihr aufgegangen.
// Gelesen wird die Stufe dort, wo Mara wirklich handelt:
//   · fiaon-whatsapp-mara.ts  werkzeugAusfuehren   (rot → Karte „vorlegen“ bzw. Werkzeug fällt weg)
//   · fiaon-postmeister-agent.ts  Werkzeug-Rufe     (rot → die Antwort wird eine Karte bzw. ohne Werkzeug)
//   · fiaon-mara-auftrag.ts  auftragAusfuehren      (rot → Schritt abgelehnt, Justin sieht es sofort)
//   · fiaon-postmeister-lauf.ts  Senden (antwort_senden), fiaon-mara-genannter-termin.ts
//     (vereinbarten_termin_eintragen), fiaon-postmeister-werkzeuge.ts (Rückruf-Termin, rueckruf_eintragen)
// Gelb schreibt eine Protokoll-Zeile (art ampel_gelb) — aber erst, NACHDEM das Werkzeug wirklich lief.
// Lesefehler = die strengste Stufe des Werkzeugs (nie „grün aus Versehen“). Feste Zeilen kann
// niemand umschalten; ihre Garantie setzt der Code selbst durch.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  MARA_AMPEL, MARA_AMPEL_SCHALTER, ARAS_AMPEL_SCHALTER, ampelStandLesen, ampelStufeAus, ampelStrengste, ampelZeilen, ampelStandSetzen,
  ampelSetzenPruefen, type AmpelStand, type AmpelStufe, type AmpelWerkzeug, type AmpelZeile,
} from "@shared/fiaon-ki-team";
import { aras } from "./fiaon-ki-aras-anbindung";

type Wer = "mara" | "aras";
type Lauf = typeof sqlPool;
const HALT_MS = 20_000;
const speicher = new Map<Wer, { bis: number; stand: AmpelStand }>();
const LEER: AmpelStand = { stufen: {}, verlauf: [] };

function schluesselFuer(wer: Wer): string { return wer === "mara" ? MARA_AMPEL_SCHALTER : ARAS_AMPEL_SCHALTER; }
export function ampelListe(wer: Wer): readonly AmpelWerkzeug[] {
  return wer === "mara" ? MARA_AMPEL : (aras()?.konstanten?.ARAS_AMPEL ?? []);
}
export function ampelWerkzeug(wer: Wer, key: string): AmpelWerkzeug | null {
  return ampelListe(wer).find((w) => w.key === key) ?? null;
}

/** Den gespeicherten Stand lesen — null = Lesefehler (dann gilt die strengste Stufe). Mit `lauf` (Prüfstand, Transaktion) ohne Zwischenspeicher. */
async function standLesen(wer: Wer, o: { frisch?: boolean; lauf?: Lauf } = {}): Promise<AmpelStand | null> {
  const da = speicher.get(wer);
  if (!o.frisch && !o.lauf && da && da.bis > Date.now()) return da.stand;
  try {
    const [z] = (await (o.lauf ?? sqlPool)`SELECT value FROM fiaon_settings WHERE key = ${schluesselFuer(wer)}`) as any[];
    const stand = ampelStandLesen(z?.value);
    if (!o.lauf) speicher.set(wer, { bis: Date.now() + HALT_MS, stand });
    return stand;
  } catch (e) {
    console.error(`[KI-AMPEL] ${wer} nicht lesbar — es gilt die strengste Stufe:`, String((e as Error)?.message ?? e).slice(0, 160));
    return null;
  }
}

/** Der Stand zur Anzeige (Lesefehler = leer, die Vorgaben stehen dann da). Mit `lauf` (Prüfstand) ohne Zwischenspeicher. */
export async function ampelStand(wer: Wer, frisch = false, lauf?: Lauf): Promise<AmpelStand> {
  return (await standLesen(wer, { frisch, lauf })) ?? LEER;
}

/**
 * Die wirksame Stufe eines Werkzeugs — unbekanntes Werkzeug = grün (die Ampel bremst nur, was sie kennt),
 * Lesefehler = die strengste Stufe des Werkzeugs. Team 1 (E-408) liest so: ampelStufe("aras", name).
 */
export async function ampelStufe(wer: Wer, key: string, lauf?: Lauf): Promise<AmpelStufe> {
  const liste = ampelListe(wer);
  const w = liste.find((x) => x.key === key);
  if (!w) return "gruen";
  const stand = await standLesen(wer, lauf ? { lauf } : {});
  return stand ? ampelStufeAus(liste, stand, key) : ampelStrengste(w);
}

/** Steht ein Mara-Werkzeug auf Rot? (die Server-Schritte: Rückruf-Termin, genannter Termin, Ratenpause …) */
export async function ampelRot(key: string, lauf?: Lauf): Promise<boolean> {
  return (await ampelStufe("mara", key, lauf)) === "rot";
}

export async function ampelZeilenLesen(wer: Wer): Promise<AmpelZeile[]> {
  return ampelZeilen(ampelListe(wer), (await standLesen(wer, { frisch: true })) ?? LEER);
}

/**
 * Eine Stufe setzen — nur Stufen, die die Liste für dieses Werkzeug erlaubt; feste Zeilen nie. In EINER Transaktion
 * mit Zeilensperre: zwei gleichzeitige Klicks verlieren nichts, und keine andere Zeile wird überschrieben.
 */
export async function ampelSetzen(wer: Wer, key: string, stufe: AmpelStufe, von: string, lauf: Lauf = sqlPool): Promise<{ ok: true; zeile: AmpelZeile; vorher: AmpelStufe } | { ok: false; fehler: string }> {
  const liste = ampelListe(wer);
  const fehler = ampelSetzenPruefen(liste, key, stufe);
  if (fehler) return { ok: false, fehler };
  const schluessel = schluesselFuer(wer);
  const r = (await lauf.begin(async (tx: any) => {
    await tx`INSERT INTO fiaon_settings (key, value) VALUES (${schluessel}, ${JSON.stringify(LEER)}) ON CONFLICT (key) DO NOTHING`;
    const [z] = (await tx`SELECT value FROM fiaon_settings WHERE key = ${schluessel} FOR UPDATE`) as any[];
    const neu = ampelStandSetzen(liste, ampelStandLesen(z?.value), key, stufe, von);
    await tx`UPDATE fiaon_settings SET value = ${JSON.stringify(neu.stand)}, updated_at = NOW() WHERE key = ${schluessel}`;
    return neu;
  })) as unknown as { stand: AmpelStand; vorher: AmpelStufe };
  speicher.delete(wer);
  const zeile = ampelZeilen(liste, r.stand).find((z) => z.key === key)!;
  console.log(`[KI-AMPEL] ${wer} · ${key}: ${r.vorher} → ${stufe} (${von})`);
  return { ok: true, zeile, vorher: r.vorher };
}

/** Der Satz, den ein rotes Werkzeug dem Modell zurückgibt — je nach Weg (Karte an Justin oder weglassen). */
export function ampelRotText(w: AmpelWerkzeug | null): string {
  if (w?.rotWeg === "weglassen") return "Dieses Werkzeug ist gerade ausgeschaltet (Ampel rot) — lass es weg und antworte ohne es. Nichts dazu versprechen.";
  return "Das entscheidet gerade unsere Geschäftsführung (Ampel rot) — sag dem Kunden ehrlich, dass unsere Geschäftsführung es klärt und er Bescheid bekommt. Nichts zusagen, keinen Termin und keine Uhrzeit nennen, nicht schreiben, dass es erledigt ist.";
}

/** Ergebnis der Prüfung VOR einem Werkzeug-Ruf. */
export interface AmpelUrteil { stufe: AmpelStufe; gesperrt: boolean; text: string | null; rotWeg: "karte" | "weglassen"; werkzeug: AmpelWerkzeug | null }

/**
 * Vor einem Werkzeug-Ruf: rot → gesperrt (der Aufrufer legt eine Karte vor oder lässt es weg, `rotWeg`) und eine
 * Zeile ampel_rot im Protokoll; gelb/grün → frei. Feste Zeilen bremst die Ampel nie (ihre Garantie macht der Code).
 * Gelb schreibt hier NICHTS — erst ampelGelbMerken nach dem Ruf, wenn er wirklich lief.
 */
export async function ampelPruefen(wer: Wer, key: string, ein: { kanal: "whatsapp" | "mail" | "auftrag" | "telefon"; personId?: number | null; nummer?: string | null; von?: string }): Promise<AmpelUrteil> {
  const w = ampelWerkzeug(wer, key);
  if (!w || w.fest) return { stufe: w?.vorgabe ?? "gruen", gesperrt: false, text: null, rotWeg: "weglassen", werkzeug: w };
  const stufe = await ampelStufe(wer, key);
  const rotWeg = w.rotWeg ?? "karte";
  if (stufe === "rot") {
    console.log(`[KI-AMPEL] ${wer} · ${key} ist ROT — nicht ausgeführt (${ein.kanal}${ein.personId ? `, Person ${ein.personId}` : ""}, ${rotWeg}).`);
    void protokoll("ampel_rot", ein, `${w.label}: nicht ausgeführt — Ampel rot (${rotWeg === "karte" ? "Karte an Justin" : "weggelassen"}).`, { werkzeug: key, stufe, rotWeg });
    return { stufe, gesperrt: true, text: ampelRotText(w), rotWeg, werkzeug: w };
  }
  return { stufe, gesperrt: false, text: null, rotWeg, werkzeug: w };
}

/** Nach dem Ruf: lief ein gelbes Werkzeug WIRKLICH (ok), steht es in „Heute“. Wirft nie. */
export async function ampelGelbMerken(urteil: Pick<AmpelUrteil, "stufe" | "werkzeug">, ok: boolean, ein: { kanal: string; personId?: number | null; nummer?: string | null }, ergebnis?: string | null): Promise<void> {
  if (urteil.stufe !== "gelb" || !ok || !urteil.werkzeug || urteil.werkzeug.fest) return;
  const w = urteil.werkzeug;
  const rest = ergebnis ? String(ergebnis).replace(/\s+/g, " ").trim().slice(0, 160) : "";
  await protokoll("ampel_gelb", ein, `${w.label} — lief (Ampel gelb)${rest ? `: ${rest}` : "."}`, { werkzeug: w.key, stufe: "gelb" });
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

/** Nur für Prüfstände ohne Datenbank: ein Stand, als wäre er gerade gelesen (ohne Angabe: die Vorgaben der Liste). */
export function ampelZwischenspeicherSetzen(wer: Wer, stand: AmpelStand = LEER): void { speicher.set(wer, { bis: Date.now() + HALT_MS, stand }); }
