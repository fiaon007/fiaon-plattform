// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: EIN KAPITAL-ANGEBOT FÜR FIRMENKUNDEN AUS PRIVATEN DATEIEN ANLEGEN
// Register E-399 (19.10.2026) — Muster: scripts/angebot-koop-anlegen.ts
//
// Das Repo ist öffentlich (E-242). Deshalb steht hier KEIN Kundendatum: alles kommt aus Dateien AUSSERHALB des Repos:
//   --datei <angebot-daten.json>        { fassung?, gueltigBis?, personId?, kunde, buergin, parameter? }
//   --compliance <compliance-daten.json> Prüfbericht im Schema der Firmenangebote (complianceKundenfassung)
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… SESSION_SECRET=… \
//     npx tsx scripts/angebot-kapital-anlegen.ts --datei <privat.json> --compliance <bericht.json>   → Vorschau (nichts geschrieben)
//   … --schreiben                → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion   → gegen die Produktion, NUR mit Justins Go
//   … --vorschau <datei.html>    → wohin die Vorschau des Vertrags geht (Vorgabe: neben der Datei)
//   … --bilder <ordner>          → E-402: die Teamfotos (parameter.team[].foto als Bildname, z. B. team-x.webp) aus dem Ordner prüfen,
//                                   ohne Metadaten an das Angebot binden (fiaon_global_angebot_bilder, nur hinter dem Link)
// Ein zweiter Lauf legt kein zweites Angebot an: Gibt es für dieselbe E-Mail schon ein OFFENES Kapital-Angebot, trägt er
// Kunde, Bürgin, Parameter, Prüfbericht und Gültigkeit dort nach (kapitalAendern). Ein angenommenes fasst er nie an.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
const datei = arg("--datei"); const complianceDatei = arg("--compliance"); const vorschauDatei = arg("--vorschau"); const bilderOrdner = arg("--bilder");
if (!datei) { console.error("ABBRUCH: --datei <angebot-daten.json> fehlt."); process.exit(2); }
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (und Justins Go).`); process.exit(2); }
if (schreiben && lokal && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL)) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt. Lokal bitte mit env -i starten."); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const C = await import("../server/lib/fiaon-global-angebot-kapital");
const S = await import("../shared/fiaon-global-angebot-kapital");
const F = await import("../server/lib/fiaon-global-angebot-firma");
const FS = await import("../shared/fiaon-global-angebot-firma");
const A = await import("../server/lib/fiaon-global-angebot");

const roh = JSON.parse(fs.readFileSync(datei, "utf8"));
const k = F.firmaKundePruefen(roh.kunde);
if (!k.ok) { console.error(`FEHLER Kunde: ${k.error}`); process.exit(1); }
const parameter = S.kapitalParameterAus(roh.parameter);
const pf = S.kapitalParameterFehler(parameter);
if (pf) { console.error(`FEHLER Parameter: ${pf}`); process.exit(1); }
const buergin = C.kapitalBuerginAus(roh.buergin);
const bf = S.kapitalBuerginFehler(buergin);
if (bf) { console.error(`FEHLER Bürgin: ${bf}`); process.exit(1); }
const complianceRoh = complianceDatei ? JSON.parse(fs.readFileSync(complianceDatei, "utf8")) : null;
const compliance = complianceRoh ? FS.complianceKundenfassung(complianceRoh) : null;
if (compliance) console.log(`Prüfbericht: ${compliance.meta.firma} · Gesamtampel ${compliance.gesamt.ampel} · ${compliance.bereiche.length} Bereiche`);

const d = { ref: "FIAON-IA-CVORSCHAU", fassung: String(roh.fassung || S.KAPITAL_FASSUNG), kunde: k.kunde, buergin, parameter, compliance, gueltigBis: String(roh.gueltigBis || "2026-12-31") };
const ziel = vorschauDatei ?? path.join(path.dirname(path.resolve(datei)), "vertrag-vorschau.html");
fs.writeFileSync(ziel, `<!doctype html><meta charset="utf-8"><title>Vorschau</title><body style="max-width:860px;margin:40px auto;font-family:Inter,Arial,sans-serif">${C.kapitalVorschauHtml(d)}</body>`);
console.log(`Vorschau des Vertrags: ${ziel}`);
console.log(`Kunde: ${k.kunde.firma.name} · Prüfsumme der Vorschau ${C.kapitalTextHash(d).slice(0, 16)}…`);
const fehlt = S.kapitalPflichtFehlen(d);
console.log(fehlt.length ? `Für die Annahme fehlt: ${fehlt.join(" · ")}` : "Pflichtfelder vollständig.");

if (!schreiben) { console.log("Nur Vorschau — zum Anlegen --schreiben."); await sqlPool.end(); process.exit(0); }

// E-402: Teamfotos aus dem Ordner (nur Bildnamen aus den Daten) — geprüft und ohne Metadaten
const { bildOhneMetadaten } = await import("../server/lib/fiaon-bild-bereinigen");
const bilder: { name: string; daten: Buffer; typ: "image/webp" | "image/png" | "image/jpeg" }[] = [];
if (bilderOrdner) {
  for (const t of parameter.team) {
    const n = String(t.foto ?? "");
    if (!FS.FIRMA_BILD_NAME.test(n)) continue;
    const pfad = path.join(bilderOrdner, n);
    if (!fs.existsSync(pfad)) { console.error(`FEHLER Bild fehlt: ${n}`); process.exit(1); }
    const b = bildOhneMetadaten(fs.readFileSync(pfad), n);
    bilder.push({ name: n, daten: b.daten, typ: b.typ });
  }
  console.log(`Teamfotos: ${bilder.length} geprüft`);
}

await A.ensureAngebotTabellen();
const [offen] = (await sqlPool`
  SELECT id, angebot_ref FROM fiaon_global_angebote
   WHERE status = 'offen' AND fassung LIKE 'IA-KAPITAL-%' AND lower(kunde->>'email') = ${k.kunde.email.toLowerCase()} ORDER BY id DESC LIMIT 1`) as any[];
if (offen) {
  const erg = await C.kapitalAendern(Number(offen.id), { kunde: k.kunde, buergin, parameter, ...(complianceRoh ? { compliance: complianceRoh } : {}), ...(roh.gueltigBis ? { gueltigBis: roh.gueltigBis } : {}) }, "Skript angebot-kapital-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  const z = (await A.angebotLesen({ id: Number(offen.id) }))!;
  const dz = C.kapitalDatenAus(z);
  if (bilder.length) { const bs = await F.firmaBilderSpeichern(Number(offen.id), bilder, "Skript angebot-kapital-anlegen"); console.log(bs.ok ? `Bilder: ${bs.gespeichert} eingespielt` : `FEHLER Bilder: ${bs.error}`); }
  console.log(`Nachgetragen: ${offen.angebot_ref} · Link: ${A.angebotKundenPfad(A.angebotTokenErzeugen(dz.ref, dz.gueltigBis))}`);
} else {
  const erg = await C.kapitalAnlegen({ ...roh, kunde: k.kunde, buergin, parameter, compliance: complianceRoh }, "Skript angebot-kapital-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  if (bilder.length) { const bs = await F.firmaBilderSpeichern(erg.id, bilder, "Skript angebot-kapital-anlegen"); console.log(bs.ok ? `Bilder: ${bs.gespeichert} eingespielt` : `FEHLER Bilder: ${bs.error}`); }
  console.log(`Angelegt: ${erg.ref} (id ${erg.id}) · Link: ${erg.link}`);
}
await sqlPool.end();
process.exit(0);
