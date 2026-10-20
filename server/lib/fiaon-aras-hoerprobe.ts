// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Hörproben: das Stimmen-Studio (E-408, Vertrag § 4)
//
// Justin hört ARAS NUR in der Plattform (19.10., 21:55: „Ich nutze kein
// ChatGPT — bau mir einen Knopf“). Eine Hörprobe = derselbe Satz, eine
// Stimme, ein Adapter; das Audio liegt als WAV in fiaon_aras_hoerprobe.
// „Diese nehmen“ setzt aras_adapter + aras_stimme (+ Beschreibung).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema } from "./fiaon-aras-schema";
import { adapterFuer } from "./fiaon-aras-adapter";
import { arasEinstellungenLesen, einstellungSetzen } from "./fiaon-aras-plan";
import { nutzungMerken } from "./fiaon-postmeister-schema";
import { ADAPTER, ARAS_DIENSTE, stimmeGueltig, type AdapterName, type HoerprobeZeile } from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

export async function hoerprobeErzeugen(e: { adapter: AdapterName; stimme: string; beschreibung?: string; text: string }, lauf: Lauf = sqlPool): Promise<{ id: number }> {
  await arasSchema(lauf);
  if (!(ADAPTER as readonly string[]).includes(e.adapter)) throw new Error("Unbekannter Adapter.");
  const stimme = String(e.stimme ?? "").trim();
  if (!stimmeGueltig(stimme)) throw new Error("Stimme: flitz, nuri, juni oder eigene:<name>.");
  const text = String(e.text ?? "").trim().slice(0, 400);
  if (text.length < 10) throw new Error("Der Satz ist zu kurz.");
  const adapter = adapterFuer(e.adapter);
  const b = await adapter.bereit();
  if (!b.ok) throw new Error(b.grund ?? "Adapter nicht bereit.");
  const einst = await arasEinstellungenLesen(false, lauf);
  const probe = await adapter.hoerprobe({ stimme, beschreibung: e.beschreibung?.trim() || undefined, text, modell: einst.modellStimme });
  const [z] = (await lauf`
    INSERT INTO fiaon_aras_hoerprobe (adapter, stimme, beschreibung, text, audio, mime, dauer_ms, kosten_cents)
    VALUES (${e.adapter}, ${stimme}, ${e.beschreibung?.trim() || null}, ${text}, ${probe.bytes}, ${probe.mime}, ${probe.dauerMs}, ${probe.kostenCents})
    RETURNING id`) as any[];
  return { id: Number(z.id) };
}

/** Für den Prüfstand: eine Hörprobe aus fertigen Bytes ablegen (ohne Anbieter). */
export async function hoerprobeAblegen(e: { adapter: AdapterName; stimme: string; text: string; bytes: Buffer; mime?: string; dauerMs?: number }, lauf: Lauf = sqlPool): Promise<{ id: number }> {
  await arasSchema(lauf);
  const [z] = (await lauf`
    INSERT INTO fiaon_aras_hoerprobe (adapter, stimme, text, audio, mime, dauer_ms, kosten_cents)
    VALUES (${e.adapter}, ${e.stimme}, ${e.text.slice(0, 400)}, ${e.bytes}, ${e.mime ?? "audio/wav"}, ${e.dauerMs ?? null}, 0) RETURNING id`) as any[];
  await nutzungMerken({ dienst: ARAS_DIENSTE.stimme, modell: "attrappe", dauerMs: 0, ok: true, sekunden: 0, kostenCents: 0 } as any).catch(() => {});
  return { id: Number(z.id) };
}

export async function hoerprobenListe(lauf: Lauf = sqlPool): Promise<HoerprobeZeile[]> {
  await arasSchema(lauf);
  const zeilen = (await lauf`
    SELECT id, adapter, stimme, beschreibung, text, dauer_ms, kosten_cents, bewertung, kommentar, gewaehlt_am, created_at, (audio IS NOT NULL) AS hat_audio
      FROM fiaon_aras_hoerprobe ORDER BY created_at DESC LIMIT 60`) as any[];
  return zeilen.map((z) => ({
    id: Number(z.id), adapter: String(z.adapter), stimme: String(z.stimme), beschreibung: z.beschreibung ?? null, text: String(z.text),
    dauerMs: z.dauer_ms != null ? Number(z.dauer_ms) : null, kostenCents: z.kosten_cents != null ? Number(z.kosten_cents) : null,
    bewertung: z.bewertung != null ? Number(z.bewertung) : null, kommentar: z.kommentar ?? null,
    gewaehltAm: z.gewaehlt_am ? new Date(z.gewaehlt_am).toISOString() : null, am: new Date(z.created_at).toISOString(), createdAt: new Date(z.created_at).toISOString(), hatAudio: z.hat_audio === true,
  }));
}

export async function hoerprobeAudio(id: number, lauf: Lauf = sqlPool): Promise<{ mime: string; bytes: Buffer } | null> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT mime, audio FROM fiaon_aras_hoerprobe WHERE id = ${id}`) as any[];
  if (!z?.audio) return null;
  return { mime: String(z.mime), bytes: Buffer.from(z.audio) };
}

export async function hoerprobeWaehlen(id: number, von: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT adapter, stimme, beschreibung FROM fiaon_aras_hoerprobe WHERE id = ${id}`) as any[];
  if (!z) throw new Error("Hörprobe nicht gefunden.");
  await einstellungSetzen("aras_adapter", String(z.adapter), von, lauf);
  await einstellungSetzen("aras_stimme", String(z.stimme), von, lauf);
  await einstellungSetzen("aras_stimme_beschreibung", z.beschreibung ? String(z.beschreibung) : "", von, lauf);
  await lauf`UPDATE fiaon_aras_hoerprobe SET gewaehlt_am = CASE WHEN id = ${id} THEN NOW() ELSE NULL END`;
}

export async function hoerprobeBewerten(id: number, bewertung: number, kommentar?: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  const b = Math.max(1, Math.min(5, Math.round(Number(bewertung) || 0)));
  await lauf`UPDATE fiaon_aras_hoerprobe SET bewertung = ${b}, kommentar = ${kommentar?.trim().slice(0, 400) || null} WHERE id = ${id}`;
}
