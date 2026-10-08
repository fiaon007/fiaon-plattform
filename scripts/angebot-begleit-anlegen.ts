// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: EINEN BEGLEITVERTRAG FÜR BESTANDSKUNDEN AUS EINER PRIVATEN DATEI ANLEGEN
// Register E-312 (08.10.2026) — Muster: scripts/angebot-firma-anlegen.ts
//
// Das Repo ist öffentlich (E-242). Deshalb steht hier KEIN Kundendatum: Kunde und Parameter kommen aus einer Datei
// AUSSERHALB des Repos:
//   --datei <angebot-daten.json>   { fassung?, gueltigBis?, personId?, kunde, parameter }
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… SESSION_SECRET=… \
//     npx tsx scripts/angebot-begleit-anlegen.ts --datei <privat.json>            → Vorschau (nichts geschrieben)
//   … --schreiben                → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion   → gegen die Produktion, NUR mit Justins Go
//   … --vorschau <datei.html>    → wohin die Vorschau des Vertrags geht (Vorgabe: neben der Datei)
// Ein zweiter Lauf legt kein zweites Angebot an: Gibt es für dieselbe E-Mail schon ein OFFENES Begleit-Angebot, trägt er
// Kunde, Parameter und Gültigkeit dort nach (begleitAendern — jede Änderung steht mit der alten Prüfsumme im Verlauf).
// Ein angenommenes fasst er nie an. Link und Name nur auf der Konsole.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
const datei = arg("--datei"); const vorschauDatei = arg("--vorschau");
if (!datei) { console.error("ABBRUCH: --datei <angebot-daten.json> fehlt."); process.exit(2); }
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (und Justins Go).`); process.exit(2); }
if (schreiben && lokal && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL)) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt. Lokal bitte mit env -i starten."); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const B = await import("../server/lib/fiaon-global-angebot-begleit");
const S = await import("../shared/fiaon-global-angebot-begleit");
const A = await import("../server/lib/fiaon-global-angebot");

const roh = JSON.parse(fs.readFileSync(datei, "utf8"));
const k = B.begleitKundePruefen(roh.kunde);
if (!k.ok) { console.error(`FEHLER Kunde: ${k.error}`); process.exit(1); }
const parameter = S.begleitParameterAus(roh.parameter);
const pf = S.begleitParameterFehler(parameter) ?? B.begleitAnspracheFehler(parameter);
if (pf) { console.error(`FEHLER Parameter: ${pf}`); process.exit(1); }

// Vorschau des Vertrags (dieselbe Funktion wie Seite und PDF)
const d = { ref: "FIAON-IA-BVORSCHAU", fassung: String(roh.fassung || S.BEGLEIT_FASSUNG), kunde: k.kunde, parameter, gueltigBis: String(roh.gueltigBis || "2026-12-31") };
const ziel = vorschauDatei ?? path.join(path.dirname(path.resolve(datei)), "vertrag-vorschau.html");
fs.writeFileSync(ziel, `<!doctype html><meta charset="utf-8"><title>Vorschau</title><body style="max-width:860px;margin:40px auto;font-family:Inter,Arial,sans-serif">${B.begleitVorschauHtml(d)}</body>`);
console.log(`Vorschau des Vertrags: ${ziel}`);
console.log(`Kunde: ${S.begleitKundeName(k.kunde)} · Prüfsumme der Vorschau ${B.begleitTextHash(d).slice(0, 16)}…`);
const fehlt = S.begleitPflichtFehlen(d);
console.log(fehlt.length ? `Für die Annahme fehlt: ${fehlt.join(" · ")}` : "Pflichtfelder vollständig.");

if (!schreiben) { console.log("Nur Vorschau — zum Anlegen --schreiben."); await sqlPool.end(); process.exit(0); }

await A.ensureAngebotTabellen();
const [offen] = (await sqlPool`
  SELECT id, angebot_ref FROM fiaon_global_angebote
   WHERE status = 'offen' AND fassung LIKE 'IA-BEGLEIT-%' AND lower(kunde->>'email') = ${k.kunde.email} ORDER BY id DESC LIMIT 1`) as any[];
if (offen) {
  const erg = await B.begleitAendern(Number(offen.id), { kunde: k.kunde, parameter, ...(roh.gueltigBis ? { gueltigBis: roh.gueltigBis } : {}) }, "Skript angebot-begleit-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  const z = (await A.angebotLesen({ id: Number(offen.id) }))!;
  const dz = B.begleitDatenAus(z);
  console.log(`Nachgetragen: ${offen.angebot_ref} · Link: ${A.angebotKundenPfad(A.angebotTokenErzeugen(dz.ref, dz.gueltigBis))}`);
} else {
  const erg = await B.begleitAnlegen({ ...roh, kunde: k.kunde, parameter }, "Skript angebot-begleit-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  console.log(`Angelegt: ${erg.ref} (id ${erg.id}) · Link: ${erg.link}`);
}
await sqlPool.end();
process.exit(0);
