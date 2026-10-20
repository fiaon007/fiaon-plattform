// ═══════════════════════════════════════════════════════════════════════════
// BILDER, SPRACHNACHRICHTEN UND DOKUMENTE IM WHATSAPP-RAUM (20.10.2026)
//
// Justin: „das es schön, cleanes WhatsApp ist, wie man es kennt … schau das
// ALLES 100 % funktioniert!“
//
// GEMESSEN vorher: Schickte ein Kunde ein Foto (z. B. seinen Überweisungsbeleg),
// eine Sprachnachricht oder ein PDF, speicherte waEingang nur die ART
// („image“) — ohne Kennung der Datei und ohne Bildunterschrift. Im Raum stand
// deshalb nur „Bild — nur auf dem Handy des Kunden sichtbar“; die Datei sah bei
// FIAON niemand, und die Unterschrift („Hier mein Beleg“) war verloren.
//
// JETZT, ohne an fiaon_whatsapp oder an Mara etwas zu ändern:
// · medienAusMeldung (rein) liest aus der Meta-Meldung, WAS kam: Bild, Sticker,
//   Sprachnachricht, Video, Dokument (Name, Typ, Größe, Unterschrift),
//   Standort, Kontakt, Reaktion.
// · medienMerken legt das in einer EIGENEN Tabelle ab (fiaon_wa_medien, eine
//   Zeile je Nachricht). Sie wirft nie: Scheitert sie, ist die Nachricht
//   trotzdem gespeichert — der Raum zeigt dann den Platzhalter wie bisher.
// · Die Datei selbst bleibt bei Meta. Erst wenn jemand im Raum hinsieht, holt
//   medienLaden sie dort ab (Kennung → kurzlebige Adresse → Bytes) und reicht
//   sie durch. Gespeichert wird bei uns nichts — kein Ausweisfoto liegt
//   doppelt herum. Ist sie bei Meta nicht mehr da, sagt der Raum das ehrlich.
// · Ausgeliefert wird nur, was ein Browser gefahrlos zeigt (Bild, Ton, Video
//   mit festem Typ); alles andere als Download. Nie HTML, nie SVG.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { graph, MetaFehler } from "./fiaon-meta";

type Lauf = typeof sqlPool;

export type MedienArt = "bild" | "sticker" | "audio" | "video" | "dokument" | "standort" | "kontakt" | "reaktion";

export interface MedienInfo {
  art: MedienArt;
  /** Metas Kennung der Datei (nur bei Bild, Sticker, Ton, Video, Dokument). */
  mediaId?: string | null;
  mime?: string | null;
  /** Dateiname (Dokument). */
  name?: string | null;
  /** Bildunterschrift (Bild, Video, Dokument). */
  titel?: string | null;
  /** Sprachnachricht (aufgenommen) statt Audiodatei. */
  sprache?: boolean;
  /** Standort. */
  lat?: number | null; lng?: number | null; ort?: string | null;
  /** Kontaktkarte(n). */
  kontakte?: { name: string; nummer: string | null }[];
  /** Reaktion: das Zeichen und die Nachricht (wa_id), auf die reagiert wurde. */
  emoji?: string | null; auf?: string | null;
}

const kurz = (s: unknown, n: number): string | null => {
  const t = String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return t ? t.slice(0, n) : null;
};
const zahl = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);
const MEDIA_ID = /^[A-Za-z0-9_.:-]{1,128}$/;
const MIME = /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i;

/** Was eine eingehende Meta-Meldung (messages[i]) an Datei, Ort, Kontakt oder Reaktion trägt — sonst null. Rein. */
export function medienAusMeldung(m: any): MedienInfo | null {
  if (!m || typeof m !== "object") return null;
  const typ = String(m.type ?? "");
  const datei = (art: MedienArt, o: any): MedienInfo | null => {
    if (!o || typeof o !== "object") return null;
    const id = String(o.id ?? "");
    const mime = String(o.mime_type ?? "").split(";")[0].trim().toLowerCase();
    return {
      art,
      mediaId: MEDIA_ID.test(id) ? id : null,
      mime: MIME.test(mime) ? mime : null,
      name: art === "dokument" ? kurz(String(o.filename ?? "").replace(/[\\/]/g, "_"), 160) : null,
      titel: kurz(o.caption, 1000),
      sprache: art === "audio" ? o.voice === true : undefined,
    };
  };
  switch (typ) {
    case "image": return datei("bild", m.image);
    case "sticker": return datei("sticker", m.sticker);
    case "audio": return datei("audio", m.audio);
    case "video": return datei("video", m.video);
    case "document": return datei("dokument", m.document);
    case "location": {
      const l = m.location ?? {};
      const lat = zahl(l.latitude); const lng = zahl(l.longitude);
      if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      return { art: "standort", lat, lng, ort: kurz([l.name, l.address].filter(Boolean).join(" · "), 240) };
    }
    case "contacts": {
      const kontakte = (Array.isArray(m.contacts) ? m.contacts : []).slice(0, 5).map((k: any) => ({
        name: kurz(k?.name?.formatted_name ?? [k?.name?.first_name, k?.name?.last_name].filter(Boolean).join(" "), 120) ?? "Kontakt",
        nummer: kurz(k?.phones?.[0]?.phone ?? k?.phones?.[0]?.wa_id, 40),
      }));
      return kontakte.length ? { art: "kontakt", kontakte } : null;
    }
    case "reaction": {
      const r = m.reaction ?? {};
      return { art: "reaktion", emoji: kurz(r.emoji, 16), auf: kurz(r.message_id, 200) };
    }
    default: return null;
  }
}

// ── Speicher ────────────────────────────────────────────────────────────────
let tabelle: Promise<void> | null = null;
export function medienTabelle(lauf: Lauf = sqlPool): Promise<void> {
  if (!tabelle) {
    tabelle = (async () => {
      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_wa_medien (
          zeile_id BIGINT PRIMARY KEY,
          nummer TEXT NOT NULL,
          art TEXT NOT NULL,
          media_id TEXT,
          mime TEXT,
          name TEXT,
          titel TEXT,
          daten JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return;
      tabelle = null;
      throw e;
    });
  }
  return tabelle;
}

/** Zu einer gespeicherten Nachricht (fiaon_whatsapp.id) festhalten, was sie trug. Wirft NIE. */
export async function medienMerken(zeileId: number, nummer: string, info: MedienInfo | null, lauf: Lauf = sqlPool): Promise<boolean> {
  if (!info || !Number.isFinite(zeileId) || zeileId <= 0) return false;
  try {
    await medienTabelle(lauf);
    const daten = {
      sprache: info.sprache ?? null, lat: info.lat ?? null, lng: info.lng ?? null, ort: info.ort ?? null,
      kontakte: info.kontakte ?? null, emoji: info.emoji ?? null, auf: info.auf ?? null,
    };
    await lauf`
      INSERT INTO fiaon_wa_medien (zeile_id, nummer, art, media_id, mime, name, titel, daten)
      VALUES (${zeileId}, ${nummer}, ${info.art}, ${info.mediaId ?? null}, ${info.mime ?? null}, ${info.name ?? null}, ${info.titel ?? null},
              ${lauf.json(daten as any)})
      ON CONFLICT (zeile_id) DO NOTHING`;
    return true;
  } catch (e) {
    console.error("[WHATSAPP-MEDIEN] merken:", e);
    return false;
  }
}

/** Was der Raum je Nachricht zeigt — ohne Metas Kennung (die bleibt auf dem Server). */
export interface MedienAnzeige {
  art: MedienArt; mime: string | null; name: string | null; titel: string | null; datei: boolean;
  sprache: boolean; lat: number | null; lng: number | null; ort: string | null;
  kontakte: { name: string; nummer: string | null }[] | null; emoji: string | null; auf: string | null;
}

export function medienAnzeige(z: any): MedienAnzeige {
  const d = z?.daten && typeof z.daten === "object" ? z.daten : {};
  return {
    art: String(z?.art ?? "dokument") as MedienArt,
    mime: z?.mime ?? null, name: z?.name ?? null, titel: z?.titel ?? null, datei: !!z?.media_id,
    sprache: d.sprache === true, lat: zahl(d.lat), lng: zahl(d.lng), ort: d.ort ?? null,
    kontakte: Array.isArray(d.kontakte) ? d.kontakte : null, emoji: d.emoji ?? null, auf: d.auf ?? null,
  };
}

/** Die Medien zu einer Reihe von Nachrichten (fiaon_whatsapp.id) — leer, wenn es die Tabelle (noch) nicht gibt. */
export async function medienFuerZeilen(ids: number[], lauf: Lauf = sqlPool): Promise<Map<number, MedienAnzeige>> {
  const aus = new Map<number, MedienAnzeige>();
  const liste = ids.filter((x) => Number.isFinite(x) && x > 0);
  if (!liste.length) return aus;
  await medienTabelle(lauf);
  const zeilen = (await lauf`SELECT * FROM fiaon_wa_medien WHERE zeile_id = ANY(${liste}::bigint[])`) as any[];
  for (const z of zeilen) aus.set(Number(z.zeile_id), medienAnzeige(z));
  return aus;
}

// ── Ausliefern ──────────────────────────────────────────────────────────────
/** Typen, die der Browser direkt zeigen darf — alles andere geht als Download. */
const ZEIGBAR = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "audio/ogg", "audio/mpeg", "audio/mp4", "audio/aac", "audio/amr", "audio/opus", "audio/webm",
  "video/mp4", "video/3gpp", "video/webm",
]);

/** Wie die Datei an den Browser geht: fester Typ, inline nur bei Bild/Ton/Video. */
export function auslieferung(mime: string | null | undefined, name: string | null | undefined): { typ: string; inline: boolean; dateiname: string } {
  const m = String(mime ?? "").toLowerCase().split(";")[0].trim();
  const inline = ZEIGBAR.has(m);
  const endung = m === "application/pdf" ? ".pdf" : "";
  // Nur Zeichen, die in einem Dateinamen nichts anrichten (keine Pfade, keine Steuerzeichen, keine Anführungszeichen).
  const roh = String(name ?? "").replace(/[\u0000-\u001f\u007f\\/:*?"<>|;]+/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  const dateiname = roh ? (endung && !roh.toLowerCase().endsWith(endung) ? `${roh}${endung}` : roh) : `whatsapp-datei${endung}`;
  return { typ: inline ? m : (m === "application/pdf" ? "application/pdf" : "application/octet-stream"), inline, dateiname };
}

/** Die Adresse, die Meta für die Bytes nennt, darf nur zu Meta führen (oder zum eingestellten Graph-Ersatz im Prüfstand). */
export function medienAdresseErlaubt(adresse: unknown): boolean {
  let u: URL;
  try { u = new URL(String(adresse ?? "")); } catch { return false; }
  const graphBasis = process.env.META_GRAPH_URL ? (() => { try { return new URL(process.env.META_GRAPH_URL!).origin; } catch { return null; } })() : null;
  if (graphBasis && u.origin === graphBasis) return true;
  if (u.protocol !== "https:") return false;
  return /(^|\.)(fbsbx\.com|facebook\.com|fbcdn\.net|whatsapp\.net)$/i.test(u.hostname);
}

export const MEDIEN_HOECHSTENS = 25 * 1024 * 1024;

export type MedienErgebnis =
  | { ok: true; mime: string | null; daten: Buffer }
  | { ok: false; status: number; grund: string };

// Ein kleiner Zwischenspeicher im Prozess (10 Minuten, höchstens 64 MB): Safari holt Ton und Video in Teilen (Range),
// und wer im Raum hin- und herklickt, soll nicht jedes Mal bei Meta anklopfen. Nichts davon landet auf der Platte.
const ZWISCHEN_MS = 10 * 60_000;
const ZWISCHEN_BYTES = 64 * 1024 * 1024;
const zwischen = new Map<string, { bis: number; mime: string | null; daten: Buffer }>();
function zwischenLesen(id: string): { mime: string | null; daten: Buffer } | null {
  const e = zwischen.get(id);
  if (!e) return null;
  if (e.bis < Date.now()) { zwischen.delete(id); return null; }
  return e;
}
function zwischenMerken(id: string, mime: string | null, daten: Buffer): void {
  zwischen.delete(id);
  zwischen.set(id, { bis: Date.now() + ZWISCHEN_MS, mime, daten });
  let summe = 0;
  zwischen.forEach((e) => { summe += e.daten.length; });
  // Die ältesten zuerst hinaus (Map behält die Reihenfolge des Einfügens).
  for (const k of Array.from(zwischen.keys())) {
    if (summe <= ZWISCHEN_BYTES) break;
    summe -= zwischen.get(k)?.daten.length ?? 0;
    zwischen.delete(k);
  }
}
/** Für Prüfstände: den Zwischenspeicher leeren. */
export function medienZwischenspeicherLeeren(): void { zwischen.clear(); }

/** Die Datei bei Meta abholen: Kennung → kurzlebige Adresse → Bytes (höchstens 25 MB). Wirft nie. */
export async function medienLaden(mediaId: string): Promise<MedienErgebnis> {
  const da = zwischenLesen(String(mediaId ?? ""));
  if (da) return { ok: true, mime: da.mime, daten: da.daten };
  const token = process.env.META_SYSTEM_TOKEN || process.env.META_TOKEN || "";
  if (!token) return { ok: false, status: 503, grund: "WhatsApp ist hier nicht eingerichtet — die Datei liegt bei Meta." };
  if (!MEDIA_ID.test(String(mediaId ?? ""))) return { ok: false, status: 404, grund: "Zu dieser Nachricht gibt es keine Datei." };
  let info: any;
  try {
    info = await graph(String(mediaId), { zeitMs: 12_000 });
  } catch (e) {
    const code = e instanceof MetaFehler ? e.code : null;
    const weg = e instanceof MetaFehler && (e.status === 404 || code === 100);
    console.warn("[WHATSAPP-MEDIEN] Kennung:", e instanceof MetaFehler ? `${e.status} ${e.code} ${e.klartext}` : String(e));
    return weg
      ? { ok: false, status: 410, grund: "Die Datei ist bei WhatsApp nicht mehr abrufbar." }
      : { ok: false, status: 502, grund: "WhatsApp hat die Datei gerade nicht herausgegeben — gleich noch einmal versuchen." };
  }
  const adresse = String(info?.url ?? "");
  if (!medienAdresseErlaubt(adresse)) return { ok: false, status: 502, grund: "WhatsApp hat keine gültige Adresse für die Datei genannt." };
  const groesse = Number(info?.file_size ?? 0);
  if (groesse > MEDIEN_HOECHSTENS) return { ok: false, status: 413, grund: "Die Datei ist zu groß für die Anzeige im Raum (über 25 MB)." };
  try {
    const r = await fetch(adresse, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "FIAON-WhatsApp-Raum/1.0" },
      signal: AbortSignal.timeout(30_000),
    });
    // Leitet Meta weiter, muss auch das Ziel bei Meta liegen.
    if (r.url && !medienAdresseErlaubt(r.url)) return { ok: false, status: 502, grund: "WhatsApp hat keine gültige Adresse für die Datei genannt." };
    if (!r.ok) {
      console.warn("[WHATSAPP-MEDIEN] Abholen:", r.status);
      return r.status === 404 || r.status === 410
        ? { ok: false, status: 410, grund: "Die Datei ist bei WhatsApp nicht mehr abrufbar." }
        : { ok: false, status: 502, grund: "WhatsApp hat die Datei gerade nicht herausgegeben — gleich noch einmal versuchen." };
    }
    const laenge = Number(r.headers.get("content-length") ?? 0);
    if (laenge > MEDIEN_HOECHSTENS) return { ok: false, status: 413, grund: "Die Datei ist zu groß für die Anzeige im Raum (über 25 MB)." };
    const daten = Buffer.from(await r.arrayBuffer());
    if (daten.length > MEDIEN_HOECHSTENS) return { ok: false, status: 413, grund: "Die Datei ist zu groß für die Anzeige im Raum (über 25 MB)." };
    const mime = String(info?.mime_type ?? r.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase() || null;
    zwischenMerken(String(mediaId), mime, daten);
    return { ok: true, mime, daten };
  } catch (e) {
    console.warn("[WHATSAPP-MEDIEN] Abholen:", String(e).slice(0, 200));
    return { ok: false, status: 502, grund: "WhatsApp hat die Datei gerade nicht herausgegeben — gleich noch einmal versuchen." };
  }
}
