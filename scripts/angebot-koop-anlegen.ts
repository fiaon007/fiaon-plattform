// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: EINEN KOOPERATIONSVERTRAG („TERMINE FÜR IHRE BERATUNG“) AUS EINER PRIVATEN DATEI ANLEGEN
// Register E-384 (16.10.2026) — Muster: scripts/angebot-begleit-anlegen.ts
//
// Das Repo ist öffentlich (E-242). Deshalb steht hier KEIN Partnerdatum: Partner und Parameter kommen aus einer Datei
// AUSSERHALB des Repos:
//   --datei <angebot-daten.json>   { fassung?, gueltigBis?, personId?, partner, parameter? }
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… SESSION_SECRET=… \
//     npx tsx scripts/angebot-koop-anlegen.ts --datei <privat.json>            → Vorschau (nichts geschrieben)
//   … --schreiben                → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion   → gegen die Produktion, NUR mit Justins Go
//   … --vorschau <datei.html>    → wohin die Vorschau des Vertrags geht (Vorgabe: neben der Datei)
// Ein zweiter Lauf legt kein zweites Angebot an: Gibt es für dieselbe E-Mail schon ein OFFENES Kooperationsangebot, trägt er
// Partner, Parameter und Gültigkeit dort nach (koopAendern). Ein angenommenes fasst er nie an. Link und Name nur auf der Konsole.
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
const B = await import("../server/lib/fiaon-global-angebot-koop");
const S = await import("../shared/fiaon-global-angebot-koop");
const A = await import("../server/lib/fiaon-global-angebot");

const roh = JSON.parse(fs.readFileSync(datei, "utf8"));
const k = B.koopPartnerPruefen(roh.partner ?? roh.kunde);
if (!k.ok) { console.error(`FEHLER Partner: ${k.error}`); process.exit(1); }
const parameter = S.koopParameterAus(roh.parameter);
const pf = S.koopParameterFehler(parameter) ?? B.koopAnspracheFehler(parameter, k.partner);
if (pf) { console.error(`FEHLER Parameter: ${pf}`); process.exit(1); }

// Vorschau des Vertrags (dieselbe Funktion wie Seite und PDF)
const d = { ref: "FIAON-IA-KVORSCHAU", fassung: String(roh.fassung || S.KOOP_FASSUNG), partner: k.partner, parameter, gueltigBis: String(roh.gueltigBis || "2026-12-31") };
const ziel = vorschauDatei ?? path.join(path.dirname(path.resolve(datei)), "vertrag-vorschau.html");
fs.writeFileSync(ziel, `<!doctype html><meta charset="utf-8"><title>Vorschau</title><body style="max-width:860px;margin:40px auto;font-family:Inter,Arial,sans-serif">${B.koopVorschauHtml(d)}</body>`);
console.log(`Vorschau des Vertrags: ${ziel}`);
console.log(`Partner: ${S.koopPartnerName(k.partner)} · Prüfsumme der Vorschau ${B.koopTextHash(d).slice(0, 16)}…`);
const fehlt = S.koopPflichtFehlen(d);
console.log(fehlt.length ? `Für die Annahme fehlt: ${fehlt.join(" · ")}` : "Pflichtfelder vollständig.");

if (!schreiben) { console.log("Nur Vorschau — zum Anlegen --schreiben."); await sqlPool.end(); process.exit(0); }

await A.ensureAngebotTabellen();
const [offen] = (await sqlPool`
  SELECT id, angebot_ref FROM fiaon_global_angebote
   WHERE status = 'offen' AND fassung LIKE 'IA-KOOP-%' AND lower(kunde->>'email') = ${k.partner.email} ORDER BY id DESC LIMIT 1`) as any[];
if (offen) {
  const erg = await B.koopAendern(Number(offen.id), { partner: k.partner, parameter, ...(roh.gueltigBis ? { gueltigBis: roh.gueltigBis } : {}) }, "Skript angebot-koop-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  const z = (await A.angebotLesen({ id: Number(offen.id) }))!;
  const dz = B.koopDatenAus(z);
  console.log(`Nachgetragen: ${offen.angebot_ref} · Link: ${A.angebotKundenPfad(A.angebotTokenErzeugen(dz.ref, dz.gueltigBis))}`);
} else {
  const erg = await B.koopAnlegen({ ...roh, partner: k.partner, parameter }, "Skript angebot-koop-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  console.log(`Angelegt: ${erg.ref} (id ${erg.id}) · Link: ${erg.link}`);
}
await sqlPool.end();
process.exit(0);
