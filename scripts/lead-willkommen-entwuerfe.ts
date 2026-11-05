// ═══════════════════════════════════════════════════════════════════════════
// JUSTINS WILLKOMMEN FÜR ALTE LEADS — NUR ALS GMAIL-ENTWURF IN js@, NIE GESENDET (E-476 Scheibe 4, 05.11.2026)
//
// Der Altbestand-Schutz: Automatische Lead-Mails gehen nur an Anfragen NACH dem Zählbeginn (lead_global_mails_ab). Für alte,
// nie kontaktierte Leads gibt es NUR dieses Skript: Es baut Justins Willkommen (die Nachtrag-Fassung: „Sie hatten sich am …
// gemeldet — entschuldigen Sie, dass Sie erst jetzt von mir hören“) und legt es — erst nach der Vorschau und mit Justins
// Wort — als ENTWURF in js@ ab. Justin liest, ändert und sendet selbst.
//
//   VORSCHAU (Pflicht, Vorgabe — kein Gmail, nichts geschrieben):
//     node_modules/.bin/tsx scripts/lead-willkommen-entwuerfe.ts 49 51 52
//   ENTWÜRFE (nur mit Justins Wort):
//     JUSTIN_GO=ja node_modules/.bin/tsx scripts/lead-willkommen-entwuerfe.ts 49 51 52 --entwuerfe
//   Optionen: --ordner <Pfad unter dem Temp-Verzeichnis> (HTML + Text ablegen) · --trotzdem (auch wenn schon eine Mail ging)
//             --lokal (Prüfstand: DATABASE_URL auf die lokale Prüf-Datenbank statt der Produktion)
//
// SCHUTZ:
//   · Produktion NUR LESEN: eigene Verbindung mit default_transaction_read_only=on (wie lead-dossier-vorschau.ts), geprüft
//     vor dem Start; keine Tabellen-Anweisung, kein Code angelegt (ohne persönlichen Link: der allgemeine Kalender).
//   · Aus der .env NUR DATABASE_URL_EXTERN — und für --entwuerfe GOOGLE_SA_KEY. Kein Mail-, KI- oder Zahlungsschlüssel;
//     steht einer in der Umgebung: Abbruch.
//   · Gmail: nur Entwürfe (users.drafts.create) und Lesen (Unterschrift, Gesendet-Ordner) — es gibt hier keinen Sende-Aufruf.
//   · Schon angeschrieben (Protokoll in 14 Tagen, Gesendet-Ordner js@/welcome@), Test, Privat-Weg, Termin → übersprungen.
//   · Jede Fassung durch die Wand (Platzhalter-Wache, Wortwand, kein Bank-Satz, keine Zahl) — mit Fund kein Entwurf.
// Repo öffentlich: Das Skript enthält keine Kundendaten; die Ausgabe nur ins Terminal bzw. unter das Temp-Verzeichnis.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync, realpathSync, existsSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const nummern = args.filter((a) => /^\d+$/.test(a)).map(Number);
const entwuerfe = args.includes("--entwuerfe");
const trotzdem = args.includes("--trotzdem");
const lokal = args.includes("--lokal");
const ordnerIdx = args.indexOf("--ordner");
const ordner = ordnerIdx >= 0 ? args[ordnerIdx + 1] : null;
if (!nummern.length) {
  console.error("Aufruf: lead-willkommen-entwuerfe.ts <Anfrage-Nr> [<Nr> …] [--entwuerfe] [--ordner <Pfad>] [--trotzdem] [--lokal]");
  process.exit(2);
}
if (entwuerfe && process.env.JUSTIN_GO !== "ja") {
  console.error("ABBRUCH: Entwürfe nur mit Justins Wort — erst die Vorschau lesen, dann JUSTIN_GO=ja … --entwuerfe.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "TWILIO_AUTH_TOKEN", "WHATSAPP_TOKEN", "META_SYSTEM_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — das Skript läuft ohne Mail-, KI- und Zahlungsschlüssel.`); process.exit(3); }
}
if (ordner) {
  // Kundendaten nie in einen Git-Arbeitsbaum (öffentliches Repo) — nur unter das Temp-Verzeichnis.
  const ziel = resolve(ordner);
  let vorhanden = ziel;
  while (!existsSync(vorhanden) && dirname(vorhanden) !== vorhanden) vorhanden = dirname(vorhanden);
  const echt = realpathSync(vorhanden);
  const tempWurzeln = [tmpdir(), "/tmp", "/private/tmp", "/private/var/folders", "/var/folders"].map((p) => { try { return realpathSync(p); } catch { return p; } });
  if (!tempWurzeln.some((w) => echt === w || echt.startsWith(`${w}/`))) { console.error(`ABBRUCH: --ordner muss unter dem Temp-Verzeichnis liegen — nicht ${ziel}.`); process.exit(2); }
  let imGit = false;
  try { execFileSync("git", ["-C", vorhanden, "rev-parse", "--show-toplevel"], { stdio: ["ignore", "pipe", "ignore"] }); imGit = true; } catch { imGit = false; }
  if (imGit) { console.error(`ABBRUCH: ${ziel} liegt in einem Git-Arbeitsbaum — dort dürfen keine Kundendaten liegen.`); process.exit(2); }
  mkdirSync(ziel, { recursive: true });
}

// ── Die Verbindung: nur lesend ────────────────────────────────────────────
let basisUrl: string;
if (lokal) {
  basisUrl = String(process.env.DATABASE_URL ?? "");
  if (!/@(127\.0\.0\.1|localhost):54329\/fiaon_pruefstand[A-Za-z0-9_]*(\?|$)/.test(basisUrl)) { console.error("ABBRUCH: --lokal nur gegen die lokale Prüf-Datenbank (127.0.0.1:54329/fiaon_pruefstand…)."); process.exit(3); }
} else {
  const env = readFileSync(join(homedir(), "Developer/fiaon-plattform/.env"), "utf8");
  const wert = (k: string) => (env.match(new RegExp(`^${k}=(.+)$`, "m"))?.[1] ?? "").trim().replace(/^["']|["']$/g, "");
  basisUrl = wert("DATABASE_URL_EXTERN");
  if (!basisUrl) { console.error("ABBRUCH: DATABASE_URL_EXTERN fehlt in der .env."); process.exit(3); }
  if (entwuerfe) {
    const sa = wert("GOOGLE_SA_KEY");
    if (!sa) { console.error("ABBRUCH: GOOGLE_SA_KEY fehlt in der .env — ohne Gmail keine Entwürfe."); process.exit(3); }
    process.env.GOOGLE_SA_KEY = sa;
  }
}
const url = new URL(basisUrl);
for (const [k, v] of Object.entries({
  default_transaction_read_only: "on", statement_timeout: "60000", lock_timeout: "5000",
  idle_in_transaction_session_timeout: "60000", application_name: "lead-willkommen-entwuerfe",
})) url.searchParams.set(k, v);
process.env.DATABASE_URL = url.toString();
process.env.CRONS = "aus";
process.env.POOL_MAX = "2";

const { sqlPool: sql } = await import("../server/lib/db-pool");
const [nurLesen] = (await sql`SHOW default_transaction_read_only`) as any[];
if (String(nurLesen?.default_transaction_read_only) !== "on") { console.error("ABBRUCH: die Verbindung ist nicht nur lesend."); process.exit(4); }

const T = await import("../shared/fiaon-global-lead-texte");
const L = await import("../shared/fiaon-global-lead");
const P = await import("../server/lib/fiaon-global-lead-post");
const { produktkategorie } = await import("../shared/fiaon-produktkategorie");

/** Die zuständige Person (heute Daniel) — dieselbe Wahl wie globalZustaendig, nur lesend. */
async function zustaendigName(): Promise<{ name: string; weiblich: boolean } | null> {
  const [s] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'global_zustaendig_agent_id'`.catch(() => [])) as any[];
  const [g] = (await sql`SELECT value FROM fiaon_settings WHERE key = 'gruender_termin_agent_id'`.catch(() => [])) as any[];
  const wunsch = Number(s?.value);
  const [a] = Number.isInteger(wunsch) && wunsch > 0
    ? ((await sql`SELECT id, name, anrede FROM fiaon_agents WHERE id = ${wunsch} AND active AND zugang_gesperrt_am IS NULL`.catch(() => [])) as any[])
    : ((await sql`SELECT id, name, anrede FROM fiaon_agents WHERE active AND NOT COALESCE(is_test_account, FALSE) AND zugang_gesperrt_am IS NULL
                   AND LOWER(COALESCE(NULLIF(first_name, ''), split_part(name, ' ', 1))) = 'daniel' ORDER BY id LIMIT 1`.catch(() => [])) as any[]);
  if (!a || Number(a.id) === Number(g?.value)) return null;
  return { name: String(a.name), weiblich: String(a.anrede ?? "") === "Frau" };
}

const tabelle = async (name: string) => !!((await sql`SELECT to_regclass(${`public.${name}`}) IS NOT NULL AS da`) as any[])[0]?.da;
const mitDossier = await tabelle("fiaon_lead_dossier");
const mitWeg = await tabelle("fiaon_lead_weg");
const mitMeta = await tabelle("fiaon_meta_leads") && await tabelle("fiaon_meta_formulare");
const kollege = await zustaendigName();
const jetzt = new Date();

let absender: { name: string; signaturHtml: string; signaturText: string } | null = null;
if (entwuerfe) {
  const { radarAbsenderLesen } = await import("../server/lib/fiaon-radar");
  const r = await radarAbsenderLesen(P.LEAD_POSTFACH);
  if (!r.absender || r.gestoert) { console.error("ABBRUCH: Justins Unterschrift in js@ ist gerade nicht lesbar (Gmail)."); process.exit(5); }
  absender = r.absender;
} else {
  const { radarKarteAbsender } = await import("../server/lib/fiaon-radar");
  const k = radarKarteAbsender(null);
  absender = { name: k.name, signaturHtml: k.signaturHtml, signaturText: k.signaturText };
}

let angelegt = 0, uebersprungen = 0;
for (const id of nummern) {
  const kopf = `── Anfrage #${id} ${"─".repeat(50)}`;
  console.log(`\n${kopf}`);
  const [a] = (await sql`
    SELECT id, name, email, firma, telefon, land, text, ip, created_at, COALESCE(ist_test, FALSE) AS ist_test, COALESCE(status, 'neu') AS status
      FROM fiaon_anfragen WHERE id = ${id} AND art = 'global'`) as any[];
  if (!a) { console.log("  übersprungen: keine Global-Anfrage"); uebersprungen++; continue; }
  const email = String(a.email ?? "").trim().toLowerCase();
  const grund = (t: string) => { console.log(`  übersprungen: ${t}`); uebersprungen++; };
  if (a.ist_test) { grund("Test-Anfrage"); continue; }
  if (a.status === "privat") { grund("Privat-Weg (Beschwerde oder Privatkunde) — keine Business-Mail"); continue; }
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email)) { grund("keine gültige Mail-Adresse"); continue; }
  // Termin? Dann ist die Bestätigung die erste Mail — kein Willkommen.
  const k9 = String(a.telefon ?? "").replace(/\D/g, "").slice(-9);
  const [termin] = (await sql`
    SELECT t.id FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
     WHERE t.quelle IN ('global', 'gruender') AND t.created_at > ${a.created_at}::timestamptz - INTERVAL '1 day'
       AND (LOWER(COALESCE(p.primary_email, '')) = ${email} OR (${k9.length === 9 ? k9 : ""} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(p.primary_phone, ''), '\\D', '', 'g'), 9) = ${k9.length === 9 ? k9 : ""}))
     LIMIT 1`.catch(() => [])) as any[];
  if (termin) { grund("hat schon ein Gespräch (Termin) — die Bestätigung war die erste Mail"); continue; }
  const [ml] = (await sql`
    SELECT event, created_at FROM fiaon_mail_log
     WHERE LOWER(TRIM(COALESCE(empfaenger, ''))) = ${email} AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
       AND created_at > NOW() - INTERVAL '14 days' ORDER BY created_at DESC LIMIT 1`.catch(() => [])) as any[];
  if (ml && !trotzdem) { grund(`schon angeschrieben (${ml.event}, ${L.berlinZeit(new Date(ml.created_at)).datum}) — mit --trotzdem dennoch`); continue; }
  // E-476 Nachbesserung (Gutachten Lead-Sicht, Mangel 10): Hat das Team inzwischen angerufen? Erreicht / kein Interesse / Nummer
  // falsch → kein Entwurf (der Mensch hat übernommen); nicht erreicht / Mailbox → der Einstieg „hat versucht, Sie anzurufen“.
  const [anruf] = (await sql`
    SELECT l.ergebnis, l.agent_name, l.created_at FROM fiaon_firmen_log l JOIN fiaon_firmen_leads f ON f.id = l.firma_id
     WHERE l.art = 'anruf' AND l.created_at > ${a.created_at}::timestamptz
       AND (LOWER(COALESCE(f.email, '')) = ${email} OR (${k9.length === 9 ? k9 : ""} <> '' AND RIGHT(REGEXP_REPLACE(COALESCE(f.telefon, ''), '\\D', '', 'g'), 9) = ${k9.length === 9 ? k9 : ""}))
     ORDER BY l.created_at DESC LIMIT 1`.catch(() => [])) as any[];
  const anrufErgebnis = String(anruf?.ergebnis ?? "");
  if (/^erreicht_/.test(anrufErgebnis) || ["kein_interesse", "nummer_falsch"].includes(anrufErgebnis)) {
    grund(`das Team hat schon angerufen (${anrufErgebnis}${anruf?.agent_name ? `, ${anruf.agent_name}` : ""}, ${L.berlinZeit(new Date(anruf.created_at)).datum}) — der Mensch hat übernommen`); continue;
  }
  const versucht = ["nicht_erreicht", "mailbox"].includes(anrufErgebnis);
  if (versucht) console.log(`  Hinweis: Anruf-Versuch am ${L.berlinZeit(new Date(anruf.created_at)).datum} (${anrufErgebnis}) — der Entwurf sagt „hat versucht, Sie anzurufen“.`);

  // SEINE Antworten: das Dossier, sonst der Meta-Block mit der gespeicherten Formular-Definition.
  let antworten: any[] = [];
  if (mitDossier) {
    const [d] = (await sql`SELECT antworten FROM fiaon_lead_dossier WHERE anlass = 'anfrage' AND anlass_id = ${id} LIMIT 1`) as any[];
    const g = typeof d?.antworten === "string" ? JSON.parse(d.antworten) : d?.antworten;
    if (Array.isArray(g)) antworten = g;
  }
  const text = String(a.text ?? "");
  const meta = a.ip === "meta-sofortformular" || text.includes("Über das Meta-Sofortformular");
  if (!antworten.length && meta && mitMeta) {
    const [f] = (await sql`
      SELECT f.fragen FROM fiaon_meta_leads m JOIN fiaon_meta_formulare f ON f.id = m.formular_id WHERE m.global_anfrage_id = ${id} LIMIT 1`) as any[];
    const defs = typeof f?.fragen === "string" ? JSON.parse(f.fragen) : f?.fragen;
    antworten = L.antwortenAusText(L.metaBlockAusText(text), Array.isArray(defs) ? defs : null);
  }
  // Der persönliche Link nur, wenn es ihn schon gibt (das Skript legt nichts an) — sonst der allgemeine Kalender.
  let link: { url: string; anzeige: string; bis: Date | null; vorausgefuellt: boolean } = { url: "https://fiaon.com/#gespraech", anzeige: "fiaon.com/#gespraech", bis: null, vorausgefuellt: false };
  if (mitWeg) {
    const [w] = (await sql`SELECT code, code_bis FROM fiaon_lead_weg WHERE anfrage_id = ${id} AND code_bis > NOW() + INTERVAL '3 days'`) as any[];
    if (w?.code) link = { url: `https://fiaon.com/g/${w.code}`, anzeige: `fiaon.com/g/${w.code}`, bis: new Date(w.code_bis), vorausgefuellt: true };
  }
  const bestand = (await sql`
    SELECT type, ref, pack_key FROM fiaon_applications
     WHERE merged_into IS NULL AND LOWER(COALESCE(email, '')) = ${email} LIMIT 5`.catch(() => [])) as any[];
  const tel = L.landAusTelefon(String(a.telefon ?? ""));
  const land = /^[A-Z]{2}$/.test(String(a.land ?? "").toUpperCase()) ? String(a.land).toUpperCase() : tel.land ?? null;
  const leer = text.indexOf("\n\n");
  const m = T.willkommenText({
    sprache: /^Sprache:\s*Englisch/m.test(text) ? "en" : "de", name: String(a.name ?? ""), kanal: meta ? "meta" : "website",
    antworten, mitNachricht: !meta && leer >= 0 && text.slice(leer + 2).trim().length >= 3,
    paketName: L.paketwunschAus(leer >= 0 ? text.slice(0, leer) : text), oesterreich: land === "AT",
    bestandskunde: bestand.some((b) => produktkategorie(b) !== "global"),
    // Nach einem Anruf-Versuch: kein „erst jetzt“ (der Einstieg zählt ab dem Versuch, nicht ab dem Eingang).
    link, eingangAm: versucht ? jetzt : new Date(a.created_at), jetzt,
    // Alter Lead: keine feste Anrufzeit — „meldet sich persönlich“; nach einem Versuch „hat schon versucht, Sie anzurufen“.
    ruf: { kollege: kollege?.name ?? null, weiblich: kollege?.weiblich, art: versucht ? "versucht" : "persoenlich" },
  });
  const funde = await P.leadMailPruefen(m);
  const html = await P.leadMailHtml(m, absender!.signaturHtml);
  const textVoll = await P.leadMailText(m, absender!.signaturText);
  console.log(`  An: ${email}\n  Betreff: ${m.betreff}\n${link.vorausgefuellt ? "" : "  (ohne persönlichen Link — der allgemeine Kalender; im Cockpit legt „Termin bei Justin eintragen“ den Link an)\n"}`);
  console.log(textVoll.split("\n").map((z) => `  │ ${z}`).join("\n"));
  if (funde.length) { console.log(`  ✗ Die Wand hält diese Fassung an: ${funde.join("; ")} — kein Entwurf.`); uebersprungen++; continue; }
  if (ordner) {
    writeFileSync(join(resolve(ordner), `willkommen-${id}.html`), html);
    writeFileSync(join(resolve(ordner), `willkommen-${id}.txt`), `An: ${email}\nBetreff: ${m.betreff}\n\n${textVoll}\n`);
  }
  if (!entwuerfe) continue;
  // Gesendet-Ordner (nur lesen): Hat Justin oder Mara in 14 Tagen schon geschrieben?
  const { nachrichtenSuchen, neueMailEntwurf } = await import("../server/lib/fiaon-gmail");
  let schon = false;
  for (const pf of [P.LEAD_POSTFACH, "welcome@fiaon.com"]) {
    if ((await nachrichtenSuchen(pf, `in:sent to:${email.replace(/[\s"()]/g, "")} newer_than:14d`, 1)).ids.length) schon = true;
  }
  if (schon && !trotzdem) { console.log("  übersprungen: im Gesendet-Ordner (js@/welcome@) steht schon eine Mail aus den letzten 14 Tagen — mit --trotzdem dennoch"); uebersprungen++; continue; }
  const entwurfId = await neueMailEntwurf(P.LEAD_POSTFACH, { vonName: absender!.name, an: email, betreff: m.betreff, text: textVoll, html });
  console.log(`  ✓ Entwurf in js@ angelegt (${entwurfId}) — NICHT gesendet. Justin liest und sendet selbst.`);
  angelegt++;
}
console.log(`\n${entwuerfe ? `${angelegt} Entwurf/Entwürfe angelegt` : "Vorschau — nichts angelegt, nichts gesendet"}, ${uebersprungen} übersprungen.`);
await sql.end?.({ timeout: 5 });
process.exit(0);
