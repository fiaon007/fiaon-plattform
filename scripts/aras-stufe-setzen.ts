// ═══════════════════════════════════════════════════════════════════════════
// ARAS-STUFE SETZEN — über denselben Weg wie das KI-Team (einstellungSetzen, mit Protokoll)
//
// Justin (30.10.2026): „ARAS Stufe go 1“. Aus Stufe 0 schaltet nur Justin hoch (fiaon-aras-stufe.ts). „Stufe hoch heißt immer
// aras_parallel + aras_tag_euro mitziehen“ — die Werte kommen aus STUFEN (shared/fiaon-aras.ts), nie geraten.
//   --stufe <0–3>   Zielstufe
// Vorgabe: NUR VORSCHAU (Verbindung „nur lesen“). Geschrieben wird mit --schreiben --produktion. Kein Anruf durch das Skript.
// ═══════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
let stufeRoh = "";
const schalter = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--stufe") { stufeRoh = String(argv[i + 1] ?? ""); i++; continue; }
  if (["--schreiben", "--produktion"].includes(argv[i])) { schalter.add(argv[i]); continue; }
  abbruch(`Unbekannter Schalter „${argv[i]}“.`);
}
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }
const schreiben = schalter.has("--schreiben");
const produktion = schalter.has("--produktion");
const stufe = Number(stufeRoh);
if (!/^[0-3]$/.test(stufeRoh)) abbruch("--stufe 0, 1, 2 oder 3 angeben.");
let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
const lokal = /@(127\.0\.0\.1|localhost)[:/]/.test(url);
if (!lokal && !produktion) abbruch("Gegen die Produktion nur mit --produktion.");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN", "GOOGLE_SA_KEY"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async () => { throw new Error("Stufen-Skript: kein Netz"); }) as typeof fetch;
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) { url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`; process.env.DATABASE_URL = url; }

const { sqlPool } = await import("../server/lib/db-pool");
const { STUFEN } = await import("../shared/fiaon-aras");
const regel = (STUFEN as any)[stufe];
const ziel: Record<string, string> = { aras_parallel: String(regel.parallel), aras_tag_euro: String(regel.tagEuro), aras_stufe: String(stufe) };
const lesen = async (k: string) => String(((await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[])[0]?.value ?? "—");
console.log(`ARAS-Stufe · ${produktion ? "PRODUKTION" : "lokal"} · ${schreiben ? "SCHREIBT" : "nur Vorschau"} · Ziel Stufe ${stufe} „${regel.name}“ (${regel.versucheJeTag}/Tag, ${regel.parallel} gleichzeitig, ${regel.tagEuro} €)`);
for (const k of [...Object.keys(ziel), "aras_an"]) console.log(`  ${k}: ${await lesen(k)}${ziel[k] ? ` → ${ziel[k]}` : ""}`);
if (!schreiben) { console.log("ERGEBNIS {\"geschrieben\":false}"); await sqlPool.end?.().catch(() => {}); process.exit(0); }
const { einstellungSetzen, arasEinstellungenVergessen } = await import("../server/lib/fiaon-aras-plan");
// Erst Leitungen und Deckel, ZULETZT die Stufe — so wählt ARAS nie mit den Werten der alten Stufe.
for (const k of ["aras_parallel", "aras_tag_euro", "aras_stufe"]) await einstellungSetzen(k, ziel[k], `Justin 30.10.2026: „ARAS Stufe go ${stufe}“ (Skript aras-stufe-setzen)`);
arasEinstellungenVergessen();
for (const k of Object.keys(ziel)) console.log(`  [erledigt] ${k} = ${await lesen(k)}`);
console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: true, stufe })}`);
await sqlPool.end?.().catch(() => {});
process.exit(0);
