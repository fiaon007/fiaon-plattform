// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Quittungs-Laute (E-408, 20.10. abends — „Schnelligkeit ist Prio 3, sehr wichtig“)
//
// GPT-Live braucht nach dem letzten Laut des Kunden im Median ~1,4 s, bis es spricht (Rauchtest 20.10., unabhängig an
// dem gemessen, was Twilio wirklich spielt). Ein Mensch sagt in so einer Pause längst „Mhm,“. Darum gibt es einen kleinen
// Satz kurzer Laute in Aras' Stimme — „Mhm,“ „Okay,“ „Hm,“ —, je Stimme und Akzent EINMAL gesprochen (eine kurze
// GPT-Live-Sitzung je Laut, dieselbe Strecke wie die Hörprobe, nur roh) und in fiaon_aras_laut abgelegt. Die Brücke spielt
// einen davon, wenn GPT-Live 550 ms nach seinem letzten Laut noch schweigt; GPT-Lives Antwort folgt nahtlos dahinter.
//
// Pegel: roh wie GPT-Lives eigene Rede vor dem Ton-Werk (−24 dBFS) — das Ton-Werk regelt Laut und Rede gleich auf −16 dBFS.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { adapterFuer } from "./fiaon-aras-adapter";
import type { AdapterName } from "../../shared/fiaon-aras";
import { QUITTUNGEN, type Quittung } from "../../shared/fiaon-aras";

const ZIEL_DBFS = -24;
/** Ein 10-ms-Stück zählt als Rede ab diesem Pegel. */
const SCHWELLE_DBFS = -42;
const VOR_MS = 20, NACH_MS = 50, MIN_MS = 120, MAX_MS = 1100;
/** So lange gilt der Speicher je Stimme/Akzent (danach frisch aus der Datenbank). */
const SPEICHER_MS = 10 * 60_000;
/** Ein misslungener Versuch wird erst nach so langer Zeit wiederholt (kein Dauerfeuer auf GPT-Live). */
const NEUER_VERSUCH_MS = 60 * 60_000;

const SPEICHER = new Map<string, { laute: Map<Quittung, Int16Array>; bis: number }>();
const VERSUCHT = new Map<string, number>();
const LAEUFT = new Map<string, Promise<number>>();

const akzent = (dialekt: string | null | undefined) => String(dialekt || "hochdeutsch");
const schluessel = (stimme: string, dialekt: string | null | undefined) => `${stimme}|${akzent(dialekt)}`;

/** Die Laute dieser Stimme mit diesem Akzent (leer, wenn noch keine gesprochen sind). */
export async function lauteLaden(stimme: string, dialekt: string | null | undefined): Promise<Map<Quittung, Int16Array>> {
  const k = schluessel(stimme, dialekt);
  const da = SPEICHER.get(k);
  if (da && da.bis > Date.now()) return da.laute;
  await arasSchema();
  const zeilen = (await sqlPool`SELECT wort, pcm FROM fiaon_aras_laut WHERE stimme = ${stimme} AND dialekt = ${akzent(dialekt)}`) as any[];
  const laute = new Map<Quittung, Int16Array>();
  for (const z of zeilen) {
    if (!(QUITTUNGEN as readonly string[]).includes(String(z.wort))) continue;
    const b = Buffer.from(z.pcm as Buffer);
    laute.set(z.wort as Quittung, new Int16Array(b.buffer.slice(b.byteOffset, b.byteOffset + (b.byteLength & ~1))));
  }
  SPEICHER.set(k, { laute, bis: Date.now() + SPEICHER_MS });
  return laute;
}

/** PCM 16 bit, 8 kHz aus einer einfachen WAV (wie alsWav sie schreibt) — sonst null. Rein. */
export function wavZuPcm(wav: Buffer): Int16Array | null {
  if (!wav || wav.length <= 44 || wav.toString("latin1", 0, 4) !== "RIFF" || wav.toString("latin1", 36, 40) !== "data") return null;
  if (wav.readUInt32LE(24) !== 8000 || wav.readUInt16LE(34) !== 16 || wav.readUInt16LE(22) !== 1) return null;
  const daten = wav.subarray(44, 44 + Math.min(wav.readUInt32LE(40), wav.length - 44));
  return new Int16Array(daten.buffer.slice(daten.byteOffset, daten.byteOffset + (daten.byteLength & ~1)));
}

function dbfs(a: Int16Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) { const v = a[i] / 32768; s += v * v; }
  return 10 * Math.log10(s / Math.max(1, a.length) + 1e-12);
}

/**
 * Aus dem rohen Ton den Laut schneiden: vom ersten bis zum letzten Rede-Stück (10 ms über −42 dBFS), 20 ms davor und 50 ms
 * danach; die Rede auf −24 dBFS (wie GPT-Live roh), 5 ms ein- und 15 ms ausblenden. Zu kurz, zu lang oder stumm → null. Rein.
 */
export function lautZuschneiden(pcm: Int16Array): Int16Array | null {
  const F = 80;
  let erst = -1, letzt = -1;
  for (let i = 0; i + F <= pcm.length; i += F) if (dbfs(pcm.subarray(i, i + F)) > SCHWELLE_DBFS) { if (erst < 0) erst = i; letzt = i + F; }
  if (erst < 0) return null;
  const von = Math.max(0, erst - VOR_MS * 8), bis = Math.min(pcm.length, letzt + NACH_MS * 8);
  const ms = (bis - von) / 8;
  if (ms < MIN_MS || ms > MAX_MS) return null;
  const rede = pcm.subarray(erst, letzt);
  const g = Math.min(8, Math.max(0.1, Math.pow(10, (ZIEL_DBFS - dbfs(rede)) / 20)));
  const n = bis - von, ein = 5 * 8, aus = 15 * 8;
  const r = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    let v = pcm[von + i] * g;
    if (i < ein) v *= i / ein;
    if (i >= n - aus) v *= Math.max(0, n - 1 - i) / aus;
    r[i] = Math.max(-32768, Math.min(32767, Math.round(v)));
  }
  return r;
}

/** So bekommt die Stimme den Laut zum Sprechen — der zweite Weg, wenn der erste misslingt. */
const SCHREIBWEISEN: Record<Quittung, string[]> = { "Mhm,": ["Mhm.", "Mmh."], "Okay,": ["Okay.", "Okay!"], "Hm,": ["Hmm.", "Hm."] };
/** Hat die Stimme den Laut gesagt (laut ihrer Abschrift)? Ohne Abschrift zählt nur Länge und Pegel. Rein. */
const PASST: Record<Quittung, RegExp> = {
  "Mhm,": /^(?:m+h*m+|hm+|mhm+)$/,
  "Okay,": /^(?:okay|ok|okey|okeh|oke+)$/,
  "Hm,": /^(?:hm+|mhm+|m+)$/,
};
export function lautPasst(wort: Quittung, gesagt: string | null | undefined): boolean {
  const t = String(gesagt ?? "").toLowerCase().replace(/[^a-zäöüß]/g, "");
  return !t || PASST[wort].test(t);
}

/**
 * Fehlende Laute dieser Stimme mit diesem Akzent sprechen lassen und ablegen (im Hintergrund, je Stimme/Akzent nur EIN Lauf,
 * ein Fehlschlag frühestens nach einer Stunde wieder). Nur mit GPT-Live (die Attrappe hat keine Stimme). Liefert, wie viele
 * Laute jetzt da sind.
 */
export function lauteSicherstellen(stimme: string, dialekt: string | null | undefined, adapterName: AdapterName): Promise<number> {
  const k = schluessel(stimme, dialekt);
  const laeuft = LAEUFT.get(k);
  if (laeuft) return laeuft;
  const p = (async () => {
    const vorhanden = await lauteLaden(stimme, dialekt);
    const fehlt = QUITTUNGEN.filter((w) => !vorhanden.has(w));
    if (!fehlt.length) return vorhanden.size;
    if (Date.now() - (VERSUCHT.get(k) ?? 0) < NEUER_VERSUCH_MS) return vorhanden.size;
    VERSUCHT.set(k, Date.now());
    const adapter = adapterFuer(adapterName);
    if (adapter.name !== "openai_live") return vorhanden.size;
    const b = await adapter.bereit();
    if (!b.ok) return vorhanden.size;
    for (const wort of fehlt) {
      // Bis zu zwei Schreibweisen (Rauchtest 20.10.: „Hm.“ sprach Nuri doppelt — „Hmm.“ klappt eher).
      for (const text of SCHREIBWEISEN[wort]) {
        try {
          const aus = await adapter.hoerprobe({ stimme, text, dialekt: (dialekt as any) ?? null, roh: true });
          const pcm = wavZuPcm(aus.bytes);
          const laut = pcm ? lautZuschneiden(pcm) : null;
          if (!laut || !lautPasst(wort, aus.text)) { console.log(`[ARAS] Laut „${wort}“ als „${text}“ (${k}) verworfen — gesagt: „${aus.text ?? ""}“, ${pcm ? Math.round(pcm.length / 8) : 0} ms`); continue; }
          await sqlPool`INSERT INTO fiaon_aras_laut (stimme, dialekt, wort, pcm, ms, gesagt)
                        VALUES (${stimme}, ${akzent(dialekt)}, ${wort}, ${Buffer.from(laut.buffer, laut.byteOffset, laut.byteLength)}, ${Math.round(laut.length / 8)}, ${aus.text ?? null})
                        ON CONFLICT (stimme, dialekt, wort) DO NOTHING`;
          break;
        } catch (e) { console.error(`[ARAS] Laut „${wort}“ (${k}):`, String((e as Error)?.message ?? e).slice(0, 160)); }
      }
    }
    SPEICHER.delete(k);
    return (await lauteLaden(stimme, dialekt)).size;
  })().catch((e) => { console.error("[ARAS] Laute:", String((e as Error)?.message ?? e).slice(0, 160)); return 0; })
    .finally(() => LAEUFT.delete(k));
  LAEUFT.set(k, p);
  return p;
}

/** Für Prüfstände: Speicher und Versuche vergessen. */
export function lauteVergessen(): void { SPEICHER.clear(); VERSUCHT.clear(); }
