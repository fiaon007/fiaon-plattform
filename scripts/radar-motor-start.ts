// ═══════════════════════════════════════════════════════════════════════════
// MAIL-MOTOR STARTEN — Passung und Freigabe über die Wege des Chefbüros (E-458, 29.10.2026)
//
// Justin (29.10.2026): „wir schicken alles mal von Mara (also welcome) und meiner js weg bitte – komm, keine Zeit verlieren
// wir brauchen neukunden also gogogo“ — „go“ auf die Vorschläge: Passung 80 → 70, Freigabe des Motors.
// Dieselben Funktionen wie die Knöpfe unter Chefbüro › Firmen-Radar › Automatik: radarAutomatikSetzen (Passung) und
// radarMotorFreigeben („Freigeben und starten“). Gesendet wird danach nur im Fenster (Mo–Fr 07–19), über die Postfächer aus
// RADAR_POSTFAECHER, mit Hochfahren ab der Freigabe.
//
// Vorgabe: NUR VORSCHAU (Verbindung „nur lesen“). Geschrieben wird mit --schreiben (lokal, nur Prüf-DB) bzw.
// --schreiben --produktion. Wiederholbar: Die Freigabe behält ihren ersten Zeitpunkt.
// ═══════════════════════════════════════════════════════════════════════════

const argv = process.argv.slice(2);
for (const a of argv) if (!["--schreiben", "--produktion"].includes(a)) abbruch(`Unbekannter Schalter „${a}“.`);
const schreiben = argv.includes("--schreiben");
const produktion = argv.includes("--produktion");
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }

let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
let host = ""; let dbName = "";
try { const u = new URL(url); host = u.hostname; dbName = u.pathname.replace(/^\//, ""); } catch { abbruch("DATABASE_URL ist keine gültige Adresse."); }
const lokal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!lokal && !produktion) abbruch("DATABASE_URL zeigt auf eine fremde Datenbank — gegen die Produktion nur mit --produktion.");
if (lokal && produktion) abbruch("--produktion, aber DATABASE_URL zeigt auf 127.0.0.1/localhost — bitte prüfen.");
if (schreiben && lokal && !/^fiaon_(pruefstand|e458)_/.test(dbName)) abbruch(`Lokal schreibt das Skript nur in eine Prüf-DB, nicht in „${dbName}“.`);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN", "GOOGLE_SA_KEY", "VAPID_PRIVATE_KEY"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async () => { throw new Error("Start-Skript: kein Netz"); }) as typeof fetch;
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}

const PASSUNG = 70;
const { sqlPool } = await import("../server/lib/db-pool");
const F = await import("../server/lib/fiaon-radar-faden");
const M = await import("../server/lib/fiaon-radar-motor");
const { RADAR_MOTOR_SCHLUESSEL } = await import("../shared/fiaon-radar");

const vorher = await F.radarAutomatik();
const [fr] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${RADAR_MOTOR_SCHLUESSEL.freigabeAm}`) as any[];
console.log(`Mail-Motor starten · Datenbank ${produktion ? "PRODUKTION" : "lokal"} · ${schreiben ? "SCHREIBT" : "nur Vorschau (Verbindung nur lesend)"}`);
console.log(`  Mara verkauft (erste Mails): ${vorher.versand ? "an" : "AUS"} · Nachfassen: ${vorher.nachfass ? "an" : "aus"} · Mara antwortet: ${vorher.mara}`);
console.log(`  Passung: ${vorher.abPassung} → ${PASSUNG}`);
console.log(`  Freigabe: ${fr?.value ? `schon seit ${fr.value}` : "noch nicht → jetzt"}`);
if (!vorher.versand) console.log("  HINWEIS: „Mara verkauft“ ist aus — der Motor sendet erst, wenn er im Chefbüro an ist.");
if (!schreiben) { console.log("ERGEBNIS {\"geschrieben\":false}"); await sqlPool.end?.().catch(() => {}); process.exit(0); }

const nachher = await F.radarAutomatikSetzen({ abPassung: PASSUNG });
const seit = await M.radarMotorFreigeben();
console.log(`  [erledigt] Passung = ${nachher.abPassung} · freigegeben seit ${seit}`);
console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: true, passung: nachher.abPassung, freigabe: seit })}`);
await sqlPool.end?.().catch(() => {});
process.exit(0);
