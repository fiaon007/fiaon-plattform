// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: EINE PARTNER-AKTE (Geschäftspartner-CRM) AUS EINER PRIVATEN DATEI ANLEGEN — E-425, 22.10.2026
//
// Das Repo ist öffentlich (E-242): Hier steht KEIN Partnerdatum. Firma, Kontakte, Verlauf, Aufgaben und
// Dokumente kommen aus einer JSON-Datei AUSSERHALB des Repos:
//   {
//     "firma":     { name, art, status, website, email, telefon, strasse, hausnummer, adresszusatz, plz, ort, region, landCode,
//                    registerNr, steuerNr, ustId, leistung, konditionen: [{label, value}], tags: [], notizen, vertraulich },
//     "kontakte":  [{ name, rolle, email, telefon, durchwahl, mobil, erreichbarkeit, sprache, notizen, haupt }],
//     "verlauf":   [{ typ, am, titel, text }],
//     "aufgaben":  [{ titel, faelligAm, zustaendig, notiz }],
//     "dokumente": [{ pfad (relativ zur JSON-Datei), art, titel, gueltigAb, gueltigBis, notiz }]
//   }
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   npx tsx scripts/partner-crm-anlegen.ts <partner.json>                 → Vorschau: prüft alles, schreibt nichts (ohne DB)
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… \
//     npx tsx scripts/partner-crm-anlegen.ts <partner.json> --schreiben   → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion                                           → gegen die Produktion, NUR mit Justins Go
// Alles in EINER Transaktion. Gibt es schon einen (nicht archivierten) Partner mit gleichem Namenskern oder gleicher
// Haupt-E-Mail, wird NICHTS geschrieben — die Akte wird dann in der Oberfläche gepflegt.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import {
  firmaPruefen, kontaktPruefen, verlaufPruefen, aufgabePruefen, dokumentMetaPruefen, firmenNameKern, textFuer, PARTNER_ARTEN, PARTNER_STATUS,
} from "../shared/fiaon-partner-crm";

const datei = process.argv.slice(2).find((a) => !a.startsWith("--"));
const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
if (!datei) { console.error("ABBRUCH: Pfad zur JSON-Datei fehlt (npx tsx scripts/partner-crm-anlegen.ts <partner.json>)."); process.exit(2); }
const basis = path.dirname(path.resolve(datei));
const roh = JSON.parse(fs.readFileSync(datei, "utf8"));
const HEUTE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

// ── 1. Prüfen (ohne Datenbank) ───────────────────────────────────────────
const fehler: string[] = [];
const f = firmaPruefen(roh.firma);
if (!f.ok) fehler.push(`Firma: ${f.error}`);
const kontakte = (Array.isArray(roh.kontakte) ? roh.kontakte : []).map((k: unknown, i: number) => {
  const p = kontaktPruefen(k); if (!p.ok) fehler.push(`Kontakt ${i + 1}: ${p.error}`); return p.ok ? p.wert : null;
}).filter(Boolean);
if (kontakte.filter((k: any) => k.haupt).length > 1) fehler.push("Mehr als ein Hauptkontakt.");
const verlauf = (Array.isArray(roh.verlauf) ? roh.verlauf : []).map((v: any, i: number) => {
  const p = verlaufPruefen({ ...v, firmaId: 1 }, HEUTE); if (!p.ok) fehler.push(`Verlauf ${i + 1}: ${p.error}`); return p.ok ? p.wert : null;
}).filter(Boolean);
const aufgaben = (Array.isArray(roh.aufgaben) ? roh.aufgaben : []).map((a: any, i: number) => {
  const p = aufgabePruefen({ ...a, firmaId: 1 }); if (!p.ok) fehler.push(`Aufgabe ${i + 1}: ${p.error}`); return p.ok ? p.wert : null;
}).filter(Boolean);
const dokumente = (Array.isArray(roh.dokumente) ? roh.dokumente : []).map((d: any, i: number) => {
  const p = dokumentMetaPruefen({ ...d, firmaId: 1 }); if (!p.ok) { fehler.push(`Dokument ${i + 1}: ${p.error}`); return null; }
  const pfad = path.resolve(basis, String(d.pfad ?? ""));
  if (!d.pfad || !fs.existsSync(pfad)) { fehler.push(`Dokument ${i + 1}: Datei fehlt (${d.pfad})`); return null; }
  return { meta: p.wert, pfad, groesse: fs.statSync(pfad).size };
}).filter(Boolean) as { meta: any; pfad: string; groesse: number }[];

if (!f.ok || fehler.length) { console.error(`FEHLER:\n  ${fehler.join("\n  ")}`); process.exit(1); }
const firma = f.wert;
console.log(`Partner: ${firma.name} · ${textFuer(PARTNER_ARTEN, firma.art)} · ${textFuer(PARTNER_STATUS, firma.status)}${firma.vertraulich ? " · vertraulich" : ""}`);
console.log(`  ${[firma.strasse, firma.hausnummer].filter(Boolean).join(" ")}${firma.adresszusatz ? `, ${firma.adresszusatz}` : ""}, ${firma.plz} ${firma.ort}, ${firma.region} ${firma.landCode}`);
console.log(`  ${firma.konditionen.length} Konditionen · ${firma.tags.length} Tags`);
console.log(`Kontakte: ${kontakte.map((k: any) => `${k.name}${k.haupt ? " (Haupt)" : ""}`).join(", ") || "keine"}`);
console.log(`Verlauf: ${verlauf.length} Einträge · Aufgaben: ${aufgaben.length} · Dokumente: ${dokumente.length} (${(dokumente.reduce((s, d) => s + d.groesse, 0) / 1024 / 1024).toFixed(1)} MB)`);

if (!schreiben) { console.log("Nur Vorschau — zum Anlegen --schreiben (lokal) bzw. --schreiben --produktion (nur mit Justins Go)."); process.exit(0); }

// ── 2. Schreiben ─────────────────────────────────────────────────────────
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (und Justins Go).`); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const C = await import("../server/lib/fiaon-partner-crm");
const WER = "Skript partner-crm-anlegen";
await C.ensurePartnerTabellen();
const bestand = await C.bestandFuerTreffer();
const kern = firmenNameKern(firma.name);
const doppelt = bestand.find((b) => firmenNameKern(b.name) === kern || (firma.email && (b.email ?? "").toLowerCase() === firma.email));
if (doppelt) { console.log(`Schon da: „${doppelt.name}“ (id ${doppelt.id}) — nichts geschrieben. Bitte in der Oberfläche pflegen.`); await sqlPool.end(); process.exit(0); }

try {
  const id = await sqlPool.begin(async (tx: any) => {
    const nimm = <T extends { ok: boolean }>(e: T, wo: string): T => { if (!e.ok) throw new Error(`${wo}: ${(e as any).error}`); return e; };
    const firmaId = (nimm(await C.firmaAnlegen(firma, WER, tx), "Firma") as any).id as number;
    for (const k of kontakte as any[]) nimm(await C.kontaktSpeichern(null, { ...k, firmaId }, WER, tx), `Kontakt ${k.name}`);
    const dokIds: number[] = [];
    for (const d of dokumente) {
      const e = nimm(await C.dokumentAblegen({ ...d.meta, firmaId }, { buffer: fs.readFileSync(d.pfad), originalname: path.basename(d.pfad) }, WER, { ohneVerlauf: true }, tx), `Dokument ${d.meta.titel}`);
      dokIds.push((e as any).id);
    }
    for (const v of verlauf as any[]) {
      // Ein Verlaufseintrag kann auf ein Dokument der Datei zeigen: "dokument": <Index in dokumente, ab 0>.
      const idx = (roh.verlauf as any[]).find((x) => x.titel === v.titel)?.dokument;
      nimm(await C.verlaufAnlegen({ ...v, firmaId, dokumentId: Number.isInteger(idx) ? dokIds[idx] ?? null : null }, WER, tx), `Verlauf ${v.titel}`);
    }
    for (const a of aufgaben as any[]) nimm(await C.aufgabeSpeichern(null, { ...a, firmaId }, WER, tx), `Aufgabe ${a.titel}`);
    return firmaId;
  });
  console.log(`Angelegt: „${firma.name}“ (id ${id}) — Chefbüro › Global-Aufträge › Geschäftspartner (?reiter=partner&partner=${id}).`);
} catch (e) {
  console.error(`FEHLER — nichts geschrieben (Transaktion zurückgerollt): ${e instanceof Error ? e.message : e}`);
  await sqlPool.end(); process.exit(1);
}
await sqlPool.end();
process.exit(0);
