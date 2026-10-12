// ═══════════════════════════════════════════════════════════════════════════
// E-331 (12.10.2026): „IHRE UNTERLAGEN" AUF DER ANGEBOTSSEITE (FIAON GLOBAL)
//
// Justin nach dem Gespräch mit William Hildbrand: Er braucht Sicherheiten — Vertrag,
// Bürgschaftszusage, Justins Reisepass und die Unterlagen der FIAON LTD. Alles im
// Anhang einer Mail UND auf seiner Angebotsseite unter „Ihre Unterlagen".
//
// Regeln:
// · Die Dateien liegen NUR in der Datenbank (Repo ist öffentlich — ein Reisepass hat
//   in client/public nichts verloren) und NUR hinter dem Angebotslink: dieselbe
//   Prüfung wie Seite, PDFs und Bilder (Signatur, Ablauf, nicht zurückgezogen).
// · Hochladen und Entfernen nur aus dem Chefbüro (Leitung) — ein Mensch entscheidet,
//   was ein Kunde sieht. Kein Skript schreibt hier in die Produktion.
// · Erlaubt sind PDF, PNG und JPEG, geprüft am Dateikopf, nicht an der Endung.
// · Titel und Reihenfolge kommen aus dem Dateinamen: „03 FIAON LTD – Certificate.pdf"
//   → Platz 3, Titel „FIAON LTD – Certificate".
// ═══════════════════════════════════════════════════════════════════════════
import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { angebotLesen, angebotLinkAbgelaufen, angebotStatusAus, angebotTokenPruefen } from "./fiaon-global-angebot";

export const UNTERLAGE_MAX_BYTES = 15 * 1024 * 1024;
export const UNTERLAGEN_MAX_JE_ANGEBOT = 30;

export interface UnterlageKurz { id: number; titel: string; dateiname: string; mime: string; groesse: number; reihenfolge: number; hochgeladenAm: string; von: string | null }

let tabelle: Promise<void> | null = null;
/** Neue Tabelle ohne Fremdschlüssel — sperrt nichts Bestehendes. */
export function unterlagenTabelleSichern(): Promise<void> {
  if (!tabelle) {
    tabelle = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_global_angebot_unterlagen (
          id SERIAL PRIMARY KEY,
          angebot_id INTEGER NOT NULL,
          titel TEXT NOT NULL,
          dateiname TEXT NOT NULL,
          mime TEXT NOT NULL CHECK (mime IN ('application/pdf', 'image/png', 'image/jpeg')),
          daten BYTEA NOT NULL,
          groesse INTEGER NOT NULL,
          sha256 TEXT NOT NULL,
          reihenfolge INTEGER NOT NULL DEFAULT 0,
          hochgeladen_von TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_global_angebot_unterlagen_angebot ON fiaon_global_angebot_unterlagen (angebot_id, reihenfolge, id)`;
    })().catch((e) => { tabelle = null; throw e; });
  }
  return tabelle;
}

/** Die Art am Dateikopf — die Endung kann lügen. */
export function unterlageArt(daten: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (daten.length >= 5 && daten.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (daten.length >= 8 && daten.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (daten.length >= 3 && daten[0] === 0xff && daten[1] === 0xd8 && daten[2] === 0xff) return "image/jpeg";
  return null;
}

/** „03 FIAON LTD – Certificate.pdf" → { reihenfolge: 3, titel: "FIAON LTD – Certificate" }. */
export function unterlageTitelAus(dateiname: string): { titel: string; reihenfolge: number | null } {
  const ohneEndung = String(dateiname ?? "").replace(/\.[a-z0-9]{2,5}$/i, "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const m = ohneEndung.match(/^(\d{1,3})[\s.\-–]+(.+)$/);
  const titel = (m ? m[2] : ohneEndung).trim().slice(0, 140) || "Unterlage";
  return { titel, reihenfolge: m ? Number(m[1]) : null };
}

const kurz = (r: any): UnterlageKurz => ({
  id: Number(r.id), titel: String(r.titel), dateiname: String(r.dateiname), mime: String(r.mime), groesse: Number(r.groesse),
  reihenfolge: Number(r.reihenfolge), hochgeladenAm: new Date(r.created_at).toISOString(), von: r.hochgeladen_von ?? null,
});

export async function unterlagenListe(angebotId: number): Promise<UnterlageKurz[]> {
  await unterlagenTabelleSichern();
  const zeilen = (await sqlPool`
    SELECT id, titel, dateiname, mime, groesse, reihenfolge, hochgeladen_von, created_at
      FROM fiaon_global_angebot_unterlagen WHERE angebot_id = ${angebotId} ORDER BY reihenfolge, id`) as any[];
  return zeilen.map(kurz);
}

export async function unterlagenHinzufuegen(angebotId: number, dateien: { buffer: Buffer; name: string }[], von: string): Promise<{ ok: boolean; text: string; neu: number }> {
  await unterlagenTabelleSichern();
  const z = await angebotLesen({ id: angebotId });
  if (!z) return { ok: false, text: "Dieses Angebot gibt es nicht.", neu: 0 };
  if (!dateien.length) return { ok: false, text: "Keine Datei gewählt.", neu: 0 };
  const [{ n, maxr }] = (await sqlPool`
    SELECT COUNT(*)::int AS n, COALESCE(MAX(reihenfolge), 0)::int AS maxr FROM fiaon_global_angebot_unterlagen WHERE angebot_id = ${angebotId}`) as any[];
  if (Number(n) + dateien.length > UNTERLAGEN_MAX_JE_ANGEBOT) return { ok: false, text: `Höchstens ${UNTERLAGEN_MAX_JE_ANGEBOT} Unterlagen je Angebot.`, neu: 0 };
  // Erst alle prüfen, dann schreiben — eine falsche Datei hält den ganzen Stapel an.
  const fertig: { titel: string; dateiname: string; mime: string; daten: Buffer; sha256: string; reihenfolge: number }[] = [];
  let naechste = Number(maxr);
  for (const d of dateien) {
    const mime = unterlageArt(d.buffer);
    if (!mime) return { ok: false, text: `„${d.name}" ist kein PDF, PNG oder JPEG.`, neu: 0 };
    if (d.buffer.length > UNTERLAGE_MAX_BYTES) return { ok: false, text: `„${d.name}" ist größer als 15 MB.`, neu: 0 };
    const t = unterlageTitelAus(d.name);
    const reihenfolge = t.reihenfolge ?? ++naechste;
    fertig.push({ titel: t.titel, dateiname: d.name.slice(0, 160), mime, daten: d.buffer, sha256: createHash("sha256").update(d.buffer).digest("hex"), reihenfolge });
  }
  let neu = 0;
  for (const f of fertig) {
    // Dieselbe Datei noch einmal: nicht doppelt ablegen.
    const [da] = (await sqlPool`SELECT 1 FROM fiaon_global_angebot_unterlagen WHERE angebot_id = ${angebotId} AND sha256 = ${f.sha256} LIMIT 1`) as any[];
    if (da) continue;
    await sqlPool`
      INSERT INTO fiaon_global_angebot_unterlagen (angebot_id, titel, dateiname, mime, daten, groesse, sha256, reihenfolge, hochgeladen_von)
      VALUES (${angebotId}, ${f.titel}, ${f.dateiname}, ${f.mime}, ${f.daten}, ${f.daten.length}, ${f.sha256}, ${f.reihenfolge}, ${von})`;
    neu++;
  }
  const doppelt = fertig.length - neu;
  return { ok: true, neu, text: `${neu} ${neu === 1 ? "Unterlage" : "Unterlagen"} hinzugefügt${doppelt ? ` · ${doppelt} lag${doppelt === 1 ? "" : "en"} schon vor` : ""}.` };
}

export async function unterlageEntfernen(angebotId: number, id: number): Promise<{ ok: boolean; text: string }> {
  await unterlagenTabelleSichern();
  const weg = (await sqlPool`DELETE FROM fiaon_global_angebot_unterlagen WHERE angebot_id = ${angebotId} AND id = ${id} RETURNING titel`) as any[];
  return weg.length ? { ok: true, text: `„${weg[0].titel}" entfernt — der Kunde sieht sie nicht mehr.` } : { ok: false, text: "Diese Unterlage gibt es nicht." };
}

/** Dieselbe Tür wie Seite und PDFs: Signatur, Ablauf, Angebot da, nicht zurückgezogen. */
async function angebotFuerToken(token: string): Promise<{ status: number; error?: string; id?: number }> {
  const t = angebotTokenPruefen(token);
  if (!t) return { status: 403, error: "Dieser Link ist ungültig." };
  if (t.urteil === "abgelaufen") return { status: 410, error: "Dieser Link ist abgelaufen." };
  const z = await angebotLesen({ ref: t.ref });
  if (!z) return { status: 404, error: "Kein Angebot zu diesem Link." };
  if (angebotLinkAbgelaufen(z)) return { status: 410, error: "Dieser Link ist abgelaufen." };
  if (angebotStatusAus(z) === "zurueckgezogen") return { status: 410, error: "Dieses Angebot gilt nicht mehr." };
  return { status: 200, id: Number(z.id) };
}

export async function unterlagenFuerToken(token: string): Promise<{ status: number; error?: string; unterlagen?: Omit<UnterlageKurz, "von">[] }> {
  const a = await angebotFuerToken(token);
  if (!a.id) return { status: a.status, error: a.error };
  const liste = await unterlagenListe(a.id);
  return { status: 200, unterlagen: liste.map(({ von: _von, ...rest }) => rest) };
}

export async function unterlageDateiFuerToken(token: string, id: number): Promise<{ status: number; error?: string; daten?: Buffer; mime?: string; dateiname?: string; sha256?: string }> {
  const a = await angebotFuerToken(token);
  if (!a.id) return { status: a.status, error: a.error };
  await unterlagenTabelleSichern();
  const [r] = (await sqlPool`
    SELECT dateiname, mime, daten, sha256 FROM fiaon_global_angebot_unterlagen WHERE angebot_id = ${a.id} AND id = ${id} LIMIT 1`) as any[];
  if (!r) return { status: 404, error: "Diese Unterlage gibt es nicht." };
  return { status: 200, daten: Buffer.from(r.daten), mime: String(r.mime), dateiname: String(r.dateiname), sha256: String(r.sha256) };
}
