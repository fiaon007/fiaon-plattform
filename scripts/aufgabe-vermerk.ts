// ═══════════════════════════════════════════════════════════════════════════
// VERMERK AN EINER AUFGABE — Hinweis anhängen oder mit Ergebnis schließen, über den EINEN Weg (E-460, 29.10.2026)
//
// Anlass: Ein Prüffehler (Zustellstand der Vertragsbestätigung, kapitalCZustellStand) legte Aufgaben an, die zum falschen Handeln
// rieten („ERST Vertragsbestätigung senden“, obwohl sie zugestellt war). Die Korrektur gehört an die Aufgabe selbst — als Beitrag
// in ihrer Zeitleiste (auftragBeitrag) bzw. als Erledigung mit Ergebnis (auftragErledigen), so wie im Chefbüro.
//
//   --id <n>          die Aufgabe (fiaon_betreiber_todos.id)
//   --text "<…>"      der Vermerk (mindestens 20 Zeichen)
//   --erledigen       die Aufgabe mit dem Vermerk als Ergebnis schließen (sonst nur Beitrag)
//
// Vorgabe: NUR VORSCHAU (Verbindung „nur lesen“). Geschrieben wird mit --schreiben (lokal, nur Prüf-DB) bzw.
// --schreiben --produktion. Verschickt nichts — kein Netz, keine Mail-Schlüssel.
// ═══════════════════════════════════════════════════════════════════════════

const MIT_WERT = ["--id", "--text"];
const OHNE_WERT = ["--erledigen", "--schreiben", "--produktion"];
const argv = process.argv.slice(2);
const werte = new Map<string, string>();
const schalter = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (MIT_WERT.includes(a)) {
    const w = argv[i + 1];
    if (w == null || w.startsWith("--")) abbruch(`${a} braucht einen Wert.`);
    werte.set(a, w);
    i++;
    continue;
  }
  if (OHNE_WERT.includes(a)) { schalter.add(a); continue; }
  abbruch(`Unbekannter Schalter „${a}“.`);
}
const schreiben = schalter.has("--schreiben");
const produktion = schalter.has("--produktion");
const erledigen = schalter.has("--erledigen");
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }

let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
let host = ""; let dbName = "";
try { const u = new URL(url); host = u.hostname; dbName = u.pathname.replace(/^\//, ""); } catch { abbruch("DATABASE_URL ist keine gültige Adresse."); }
const lokal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!lokal && !produktion) abbruch("DATABASE_URL zeigt auf eine fremde Datenbank — gegen die Produktion nur mit --produktion.");
if (lokal && produktion) abbruch("--produktion, aber DATABASE_URL zeigt auf 127.0.0.1/localhost — bitte prüfen.");
if (schreiben && lokal && !/^fiaon_pruefstand_/.test(dbName)) abbruch(`Lokal schreibt das Skript nur in eine Prüf-DB (fiaon_pruefstand_…), nicht in „${dbName}“.`);
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN", "GOOGLE_SA_KEY", "VAPID_PRIVATE_KEY"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async () => { throw new Error("Vermerk-Skript: kein Netz"); }) as typeof fetch;
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}

const id = Number(werte.get("--id"));
const text = String(werte.get("--text") ?? "").trim();
if (!Number.isInteger(id) || id <= 0) abbruch("--id fehlt oder ist keine Zahl.");
if (text.length < 20) abbruch("--text fehlt oder ist zu kurz (mindestens 20 Zeichen).");

const { sqlPool } = await import("../server/lib/db-pool");
const VON = "System (E-460, Vermerk von Hand)";
const ende = async (code: number): Promise<never> => { await sqlPool.end?.().catch(() => {}); process.exit(code); };

const [t] = (await sqlPool`SELECT id, titel, status FROM fiaon_betreiber_todos WHERE id = ${id}`) as any[];
if (!t) abbruch(`Aufgabe #${id} gibt es nicht.`);
console.log(`Vermerk · Datenbank ${produktion ? "PRODUKTION" : "lokal"} · ${schreiben ? "SCHREIBT" : "nur Vorschau (Verbindung nur lesend)"}`);
console.log(`  Aufgabe #${t.id} „${t.titel}“ · ${t.status}`);
console.log(`  ${erledigen ? "Schließen mit Ergebnis" : "Beitrag"}: ${text}`);
if (erledigen && String(t.status) === "erledigt") {
  console.log("  [schon da] Die Aufgabe ist erledigt — nichts zu tun.");
  console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: false, schon: true, id })}`);
  await ende(0);
}
if (!schreiben) {
  console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: false, id })}`);
  await ende(0);
}

const { auftragBeitrag, auftragErledigen } = await import("../server/lib/fiaon-auftraege");
const ok = erledigen
  ? await auftragErledigen(id, { art: "verwaltung", von: VON, autorArt: "system", ergebnis: text })
  : await auftragBeitrag(id, { autorArt: "system", autorName: VON, art: "kommentar", text });
console.log(`  ${ok ? "[erledigt]" : "[schon da]"} ${erledigen ? "geschlossen" : "Beitrag angehängt"}.`);
console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: ok, id, erledigt: erledigen && ok })}`);
await ende(0);
