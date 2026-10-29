// ═══════════════════════════════════════════════════════════════════════════
// MAIL-MOTOR: VORBEREITETE MAILS NACH NEUEN REGELN NEU SCHREIBEN (E-458, 29.10.2026)
//
// Anlass: Nach einer neuen Regel (z. B. der Sprachregel RADAR_SPRACHE_REGEL, live 29.10. 20:33) liegen in der Warteschlange
// Mails, die noch nach den alten Regeln geschrieben und geprüft wurden. Der Versand prüft nicht neu (Senden ruft keine KI).
// Dieses Skript schickt jede solche Mail durch denselben Weg wie Motor, Stapel und Akte: radarMailFertig (schreiben →
// Prüf-KI → höchstens einmal neu). Der Stand der Warteschlange bleibt; besteht eine Mail nicht, hält sie der Versand auf.
//
//   --vor <ISO-Zeit>   nur Mails, deren Prüfung älter ist (z. B. der Deploy der neuen Regel)
//
// Vorgabe: NUR VORSCHAU (Verbindung „nur lesen“, keine KI). Geschrieben wird mit --schreiben --produktion. Verschickt nichts:
// keine Mail-Schlüssel im Lauf; die KI läuft über den Anbieter der Produktion (OPENAI_API_KEY im Aufruf, nie ausgegeben).
// ═══════════════════════════════════════════════════════════════════════════

const argv = process.argv.slice(2);
const werte = new Map<string, string>();
const schalter = new Set<string>();
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--vor") { const w = argv[i + 1]; if (!w) abbruch("--vor braucht eine Zeit."); werte.set(a, w); i++; continue; }
  if (["--schreiben", "--produktion"].includes(a)) { schalter.add(a); continue; }
  abbruch(`Unbekannter Schalter „${a}“.`);
}
const schreiben = schalter.has("--schreiben");
const produktion = schalter.has("--produktion");
function abbruch(text: string): never { console.error(`ABBRUCH: ${text}`); process.exit(2); }

let url = String(process.env.DATABASE_URL ?? "");
if (!url) abbruch("DATABASE_URL fehlt.");
let host = "";
try { host = new URL(url).hostname; } catch { abbruch("DATABASE_URL ist keine gültige Adresse."); }
const lokal = ["127.0.0.1", "localhost", "::1", "[::1]"].includes(host);
if (!lokal && !produktion) abbruch("DATABASE_URL zeigt auf eine fremde Datenbank — gegen die Produktion nur mit --produktion.");
const vor = new Date(String(werte.get("--vor") ?? ""));
if (Number.isNaN(vor.getTime())) abbruch("--vor fehlt oder ist keine Zeit (ISO, z. B. 2026-10-29T19:33:45Z).");
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN", "GOOGLE_SA_KEY", "VAPID_PRIVATE_KEY"]) delete process.env[k];
process.env.CRONS = "aus";
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}

const { sqlPool } = await import("../server/lib/db-pool");
const zeilen = (await sqlPool`
  SELECT id, strom, name, motor_status, pruef_ki->>'am' AS geprueft_am FROM fiaon_radar_firmen
   WHERE motor_status = 'bereit' AND (pruef_ki IS NULL OR (pruef_ki->>'am')::timestamptz < ${vor})
   ORDER BY motor_am`) as any[];
console.log(`Nachprüfen · ${produktion ? "PRODUKTION" : "lokal"} · ${schreiben ? "SCHREIBT (KI)" : "nur Vorschau"} · Prüfung älter als ${vor.toISOString()}: ${zeilen.length}`);
for (const z of zeilen) console.log(`  #${z.id} ${z.strom} · ${String(z.name).slice(0, 40)} · geprüft ${z.geprueft_am ?? "—"}`);
if (!schreiben) { console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: false, anzahl: zeilen.length })}`); await sqlPool.end?.().catch(() => {}); process.exit(0); }

const P = await import("../server/lib/fiaon-radar-pruef");
let bestanden = 0, durchgefallen = 0, fehler = 0;
for (const z of zeilen) {
  try {
    const e: any = await P.radarMailFertig(Number(z.id));
    if (e.ok) bestanden++; else durchgefallen++;
    console.log(`  ${e.ok ? "[besteht]" : "[NEIN]   "} #${z.id} · Versuche ${e.versuche ?? "?"} · KI-Klang ${e.pruefung?.urteil?.ki_klang ?? "—"}${e.ok ? "" : ` · ${e.grund ?? (e.pruefung?.gruende ?? []).slice(0, 2).join(" | ")}`}`);
  } catch (err: any) {
    fehler++;
    console.log(`  [FEHLER]  #${z.id}: ${String(err?.message || err).slice(0, 160)}`);
    if (err?.status === 429 || err?.status === 503) break;
  }
}
console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: true, anzahl: zeilen.length, bestanden, durchgefallen, fehler })}`);
await sqlPool.end?.().catch(() => {});
process.exit(fehler ? 1 : 0);
