// ═══════════════════════════════════════════════════════════════════════════
// VORSCHAU DES LEAD-DOSSIERS FÜR ECHTE ANFRAGEN — NUR RENDERN, NIE SENDEN (E-476, 05.11.2026)
//
// Für den Praxistest vor dem Push (Justins Regel 27.08.: praxisnah gegen die echte Datenbank, nur lesend):
// baut das Dossier zu echten Anfrage-Nummern genau so, wie es an Justin ginge — und legt es als HTML und Text ab,
// dazu „vorher/nachher“ (alt: Codes im Anfrage-Text, neu: Klartext).
//
//   node_modules/.bin/tsx scripts/lead-dossier-vorschau.ts <ausgabeordner> <nr> [<nr> …] [--ohne-netz]
//
// SCHUTZ:
//   · Aus der .env werden NUR DATABASE_URL_EXTERN und OPENREGISTER_API_KEY gelesen — kein Mail-, KI- oder Zahlungs-
//     Schlüssel. Steht einer davon schon in der Umgebung: Abbruch.
//   · Die Verbindung ist NUR LESEND (default_transaction_read_only=on, Fristen wie ro.mjs) — geprüft vor dem Start.
//   · CRONS=aus, KI-Teil aus, kein Versand (leadDossierVorschau rendert nur), kein Firmensuche-Cache, kein
//     Credit-Zähler. Register und Impressum werden gelesen (Register: höchstens 11 Credits je Firma, nur lesend).
//   · Ohne gefundene Nummern: die vier neuesten Global-Anfragen.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const ordner = args.find((a) => !/^\d+$/.test(a) && !a.startsWith("--"));
const nummern = args.filter((a) => /^\d+$/.test(a)).map(Number);
const ohneNetz = args.includes("--ohne-netz");
if (!ordner) { console.error("Aufruf: lead-dossier-vorschau.ts <ausgabeordner> <nr> [<nr> …] [--ohne-netz]"); process.exit(2); }

// Nachbesserung (Gutachten Sicherheit 05.11.2026): Die Vorschau schreibt echte Kundendaten. Ein Ordner im Git-Arbeitsbaum
// (und ein „git add .“) brächte sie ins ÖFFENTLICHE Repo — erlaubt sind nur Ordner unter dem Temp-Verzeichnis
// (dort liegt auch der Scratchpad der Sitzung) und nie einer, der in einem Git-Arbeitsbaum liegt.
{
  const ziel = resolve(ordner);
  let vorhanden = ziel;
  while (!existsSync(vorhanden) && dirname(vorhanden) !== vorhanden) vorhanden = dirname(vorhanden);
  const echt = realpathSync(vorhanden);
  const tempWurzeln = [tmpdir(), "/tmp", "/private/tmp", "/private/var/folders", "/var/folders"].map((p) => { try { return realpathSync(p); } catch { return p; } });
  if (!tempWurzeln.some((w) => echt === w || echt.startsWith(`${w}/`))) {
    console.error(`ABBRUCH: Der Ausgabeordner muss unter dem Temp-Verzeichnis liegen (z. B. dem Scratchpad) — nicht ${ziel}.`); process.exit(2);
  }
  let imGit = false;
  try { execFileSync("git", ["-C", vorhanden, "rev-parse", "--show-toplevel"], { stdio: ["ignore", "pipe", "ignore"] }); imGit = true; } catch { imGit = false; }
  if (imGit) { console.error(`ABBRUCH: ${ziel} liegt in einem Git-Arbeitsbaum — dort dürfen keine Kundendaten liegen.`); process.exit(2); }
}

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_SYSTEM_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — die Vorschau läuft ohne Mail-, KI- und Zahlungsschlüssel.`); process.exit(3); }
}
const env = readFileSync(join(homedir(), "Developer/fiaon-plattform/.env"), "utf8");
const wert = (k: string) => (env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
const extern = wert("DATABASE_URL_EXTERN");
if (!extern) { console.error("ABBRUCH: DATABASE_URL_EXTERN fehlt in der .env."); process.exit(3); }
const url = new URL(extern);
for (const [k, v] of Object.entries({
  default_transaction_read_only: "on", statement_timeout: "60000", lock_timeout: "5000",
  idle_in_transaction_session_timeout: "60000", application_name: "lead-dossier-vorschau",
})) url.searchParams.set(k, v);
process.env.DATABASE_URL = url.toString();
process.env.CRONS = "aus";
process.env.POOL_MAX = "2";
if (!ohneNetz && wert("OPENREGISTER_API_KEY")) process.env.OPENREGISTER_API_KEY = wert("OPENREGISTER_API_KEY");

const { sqlPool } = await import("../server/lib/db-pool");
const [nurLesen] = (await sqlPool`SHOW default_transaction_read_only`) as any[];
if (String(nurLesen?.default_transaction_read_only) !== "on") { console.error("ABBRUCH: die Verbindung ist nicht nur lesend."); process.exit(4); }

const D = await import("../server/lib/fiaon-lead-dossier");
const L = await import("../shared/fiaon-global-lead");
mkdirSync(ordner, { recursive: true });

let ids = nummern.length
  ? ((await sqlPool`SELECT id FROM fiaon_anfragen WHERE id = ANY(${nummern}::int[]) AND art = 'global' ORDER BY array_position(${nummern}::int[], id)`) as any[]).map((r) => Number(r.id))
  : [];
if (!ids.length) {
  ids = ((await sqlPool`SELECT id FROM fiaon_anfragen WHERE art = 'global' AND NOT COALESCE(ist_test, FALSE) ORDER BY id DESC LIMIT 4`) as any[]).map((r) => Number(r.id));
  console.log(`Keine der Nummern gefunden — die vier neuesten Global-Anfragen: ${ids.join(", ")}`);
}

const zeilen: string[] = [];
for (const id of ids) {
  const start = Date.now();
  try {
    const v = await D.leadDossierVorschau(id, { netz: !ohneNetz });
    writeFileSync(join(ordner, `dossier-${id}.html`), v.html);
    writeFileSync(join(ordner, `dossier-${id}.txt`), `Betreff: ${v.betreff}\n\n${v.text}\n\nKnöpfe:\n${v.knoepfe.map((k) => `- ${k.text}: ${k.url}`).join("\n")}\n`);
    // Vorher/nachher: der gespeicherte Anfrage-Text (alt: Codes) gegen die Klartext-Zeilen, die ab jetzt dort stehen.
    const [a] = (await sqlPool`
      SELECT a.text, f.fragen FROM fiaon_anfragen a
        LEFT JOIN LATERAL (SELECT formular_id FROM fiaon_meta_leads WHERE global_anfrage_id = a.id LIMIT 1) m ON TRUE
        LEFT JOIN fiaon_meta_formulare f ON f.id = m.formular_id
       WHERE a.id = ${id}`) as any[];
    const defs = Array.isArray(a?.fragen) ? a.fragen : null;
    const neu = L.antwortenAusText(String(a?.text ?? ""), defs).map(L.antwortZeile);
    writeFileSync(join(ordner, `dossier-${id}-vorher-nachher.txt`),
      `VORHER (gespeicherter Anfrage-Text, so standen die Antworten in Anfrage, Cockpit und Daniels Auftrag):\n${String(a?.text ?? "")}\n\n`
      + `NACHHER (Klartext, so stehen sie ab jetzt dort und im Dossier):\n${neu.length ? neu.join("\n") : "(keine Auswahlfragen — Website-Anfrage)"}\n`);
    const b = v.basis;
    const kurz = `#${id} · ${b.kanal} · ${L.TEMPERATUR_WORT[b.temperatur.wert]} · Firma ${b.fakten.firma} · Mail ${b.fakten.mail} · ${b.kontakt.tel.text} · Register ${b.register.status}${b.register.credits ? ` (${b.register.credits} Credits)` : ""} · Impressum ${b.impressum.status}${b.hinweis ? " · HINWEIS Privat/Beschwerde" : ""} · ${Date.now() - start} ms`;
    zeilen.push(kurz);
    console.log(kurz);
  } catch (e) {
    const t = `#${id}: FEHLER ${String((e as Error)?.message ?? e).slice(0, 200)}`;
    zeilen.push(t);
    console.error(t);
  }
}
writeFileSync(join(ordner, "index.html"), `<!doctype html><meta charset="utf-8"><title>Lead-Dossier · Vorschau</title>
<body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:32px auto;padding:0 16px;color:#0f172a">
<h1 style="font-weight:500">Lead-Dossier — Vorschau (nur gerendert, nichts gesendet)</h1>
<p style="color:#64748b">Stand ${new Date().toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · Produktion nur lesend · KI-Teil aus</p>
<ul>${ids.map((id, i) => `<li><a href="dossier-${id}.html">Anfrage #${id}</a> · <a href="dossier-${id}-vorher-nachher.txt">vorher/nachher</a><br><small style="color:#64748b">${(zeilen[i] ?? "").replace(/</g, "&lt;")}</small></li>`).join("")}</ul></body>`);
await sqlPool.end?.({ timeout: 5 });
process.exit(0);
