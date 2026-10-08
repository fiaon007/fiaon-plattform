// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND E-272 (02.10.2026): GLOBAL-KUNDEN STEHEN IN KEINEM PRIVAT-ABLAUF
//
// Justin (Fall Hildbrand, 02.10.2026): „nehme ihn bitte komplett aus den
// Workflows … Er soll Global bleiben, also keine unnötigen Mails.“ Die Regel
// steht EINMAL in server/lib/fiaon-global-kunde.ts (Individualangebot oder
// lebende Global-Zeile, und KEIN bezahltes Stufenpaket). Dieser Prüfstand
// beweist, dass jede geänderte Auswahl sie benutzt:
//
//   1  DIE REGEL — Global-only (Angebot offen + abgeschickter, unbezahlter
//      Privatantrag + Lead mit WhatsApp, der Fall Hildbrand), Global-Auftrag
//      über /business, gemischt (bezahltes Stufenpaket + Global), normal privat
//      (abgebrochen und offen), zusammengeführte Person (Angebot am Verlierer):
//      istGlobalKunde und globalKundeSql liefern das Erwartete; die Einstufung
//      (personTierSql) stellt Global-Kunden auf -1, Gemischte nicht.
//   2  JEDE GEÄNDERTE AUSWAHL — die Global-Person ist NICHT drin, die normale
//      Privatperson IST drin, die gemischte steht wie vorher drin (oder wie
//      vorher nicht). Wo es geht, über die echten exportierten Funktionen —
//      nur auswählende und zählende, NIE versendende. Ändernde Funktionen
//      (Zuteilung) laufen in einer Transaktion, die zurückgerollt wird. Was
//      nicht exportiert ist, prüft Teil Q im Quelltext — und sagt das.
//   3  TERMIN UND GLOBAL BLEIBEN FREI — die WhatsApp-Tür lässt die Termin-
//      Erinnerung durch, die Mail-Tür sperrt weder termin_* noch global_* noch
//      Pflichtpost, und kein Global-Ablauf fragt die Regel.
//   4  ROTPROBE — PRUEF_ROT=1 verbiegt die Regel IM SPEICHER (ein Lade-Haken
//      ersetzt fiaon-global-kunde.ts durch eine Attrappe, die nie „Global“
//      sagt). Dann MUSS dieser Prüfstand rot werden (Exit 1).
//
// NUR gegen eine lokale, LEERE Struktur-Kopie der Produktion (127.0.0.1; die
// Zählungen setzen voraus, dass außer den Testzeilen niemand drinsteht). Kein Netz:
// jeder fetch geht an eine Attrappe, die nur mitschreibt — am Ende wird
// geprüft, dass niemand es versucht hat. Kein Schlüssel darf gesetzt sein.
// Eigene Testzeilen (Personen 9272001–9272015, Leads 9272001–9272015,
// Mitarbeiter 927201–927203, Bestellungen FIAON-E272P-…, Angebote
// FIAON-IA-E272P-…), vor und nach dem Lauf wieder gelöscht.
//
//   cd /Users/Justin/Developer/fiaon-global-angebot && env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin \
//     DOTENV_CONFIG_PATH=/dev/null CRONS=aus \
//     DATABASE_URL="postgresql://fiaon@127.0.0.1:54329/fiaon_e272_test" npx tsx scripts/pruef-global-kunde.ts
//
//   Rotprobe: dieselbe Zeile mit PRUEF_ROT=1 davor — muss mit Exit 1 enden.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const URL_DB = String(process.env.DATABASE_URL || "");
if (!/@127\.0\.0\.1:\d+\//.test(URL_DB)) {
  console.error("ABBRUCH: DATABASE_URL muss eine lokale Prüf-Datenbank (127.0.0.1) sein — nie die Produktion.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "OPENAI_API_KEY", "WHATSAPP_TOKEN", "META_SYSTEM_TOKEN", "RESEND_API_KEY",
  "GMAIL_CLIENT_SECRET", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "MAKE_WEBHOOK_URL", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt — der Prüfstand darf nichts versenden.`); process.exit(3); }
}
const ROT = process.env.PRUEF_ROT === "1";

// ── ROTPROBE: DIE REGEL IM SPEICHER ABSCHALTEN ──────────────────────────────
// Ein Lade-Haken (node:module register) leitet JEDEN Import von
// fiaon-global-kunde — aus dem Server wie aus diesem Prüfstand — auf eine
// Attrappe um: globalKundeSql ist immer FALSE, istGlobalKunde immer false.
// Keine Datei wird geändert. Muss VOR dem ersten Server-Import stehen.
if (ROT) {
  const { register } = await import("node:module");
  const attrappe = [
    "export function globalKundeSql() { return '(FALSE)'; }",
    "export function globalKundeBereit() { return Promise.resolve(); }",
    "export async function istGlobalKunde() { return false; }",
  ].join("\n");
  const ziel = `data:text/javascript,${encodeURIComponent(attrappe)}`;
  const haken = `export async function resolve(s, c, n) {
    if (/(^|\\/)fiaon-global-kunde(\\.ts)?$/.test(s)) return { url: ${JSON.stringify(ziel)}, format: "module", shortCircuit: true };
    return n(s, c);
  }`;
  register(`data:text/javascript,${encodeURIComponent(haken)}`);
  console.log("ROTPROBE: Die Regel Global-Kunde ist im Speicher abgeschaltet — dieser Lauf MUSS rot werden.\n");
}

// ── KEIN NETZ ───────────────────────────────────────────────────────────────
const netz: string[] = [];
globalThis.fetch = (async (input: any) => {
  netz.push(String(input?.url ?? input));
  throw new Error("Prüfstand E-272: kein Netz");
}) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const regel = await import("../server/lib/fiaon-global-kunde");
const { personTierSql } = await import("../server/lib/tier");
const waz = await import("../server/lib/fiaon-wa-zentrale");
const wa = await import("../server/lib/fiaon-whatsapp");
const waMara = await import("../server/lib/fiaon-whatsapp-mara");
const rueck = await import("../server/lib/fiaon-rueckholung");
const aktion = await import("../server/lib/fiaon-mara-aktion");
const zentrale = await import("../server/lib/fiaon-zentrale");
const wieder = await import("../server/lib/fiaon-wiedereinstieg");
const karte = await import("../server/lib/fiaon-konto-karte");
const zut = await import("../server/lib/fiaon-zuteilung");
const followup = await import("../server/routes/fiaon-followup");
const kartei = await import("../server/routes/fiaon-kartei");
const tk = await import("../server/lib/fiaon-telefonkartei");
const dossier = await import("../server/lib/fiaon-postmeister-dossier");
const werkzeuge = await import("../server/lib/fiaon-postmeister-werkzeuge");
const make = await import("../server/make-webhook");
const mf = await import("../server/lib/fiaon-mail-frequenz");
const strecke = await import("../server/lib/fiaon-lead-strecke");
const abstreiten = await import("../server/lib/fiaon-mara-abstreiten");

// ── AUSGABE ─────────────────────────────────────────────────────────────────
let gesamt = 0, bestanden = 0;
const rot: string[] = [];
const pruef = (name: string, bed: boolean, info: unknown = "") => {
  gesamt++;
  if (bed) { bestanden++; console.log(`  ✓ ${name}`); return; }
  const zusatz = info !== "" ? ` — ${typeof info === "string" ? info : JSON.stringify(info)}` : "";
  rot.push(`${name}${zusatz}`);
  console.log(`  ✗ ${name}${zusatz}`);
};
const titel = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
/** Steht genau, was soll, in der Auswahl — die Global-Person nie, die normale immer, die gemischte wie vorher? */
const menge = (was: string, drin: Set<number | string>, soll: Record<string, [number | string, boolean]>) => {
  for (const [wer, [id, erwartet]] of Object.entries(soll)) {
    pruef(`${was}: ${wer} ${erwartet ? "drin" : "NICHT drin"}`, drin.has(id) === erwartet, `ist ${drin.has(id) ? "drin" : "nicht drin"}`);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTDATEN
// ═══════════════════════════════════════════════════════════════════════════
const ID = {
  G: 9272001,   // Global-only, Fall Hildbrand: Angebot offen + abgeschickter, unbezahlter Privatantrag + Lead mit WhatsApp
  N: 9272002,   // normal privat, offen: derselbe Antrag ohne Angebot
  GA: 9272003,  // Global-Auftrag über /business (Zeile global_struktur), alte Stufe 2
  M: 9272004,   // gemischt: bezahltes Stufenpaket mit fälliger Rate + offener Privatantrag + Global-Zeile + Angebot
  NA: 9272005,  // normal privat, abgebrochen (Schritt 3, nie abgeschickt)
  GAB: 9272006, // derselbe Abbruch mit Angebot
  NL: 9272007,  // normaler Lead ohne Antrag
  GL: 9272008,  // Lead ohne Antrag mit Angebot
  W: 9272009,   // Gewinner einer Zusammenführung: offener Privatantrag
  L: 9272010,   // Verlierer (aufgegangen in W) — trägt das Angebot
  P: 9272011,   // privat bezahlt, kein Global
  GP: 9272012,  // nur ein bezahlter Global-Auftrag
  GC: 9272013,  // Global + „Zahlung gemeldet“ (claimed_paid) zum Privatantrag, Stufe 1
  NC: 9272014,  // derselbe ohne Angebot
  NX: 9272015,  // archivierter Abbruch + Lead mit WhatsApp
} as const;
type Wer = keyof typeof ID;
const ALLE = Object.values(ID) as number[];
const AG = { normal: 927201, gesperrt: 927202, inkasso: 927203 };
const AGENTEN = Object.values(AG);
const REF = (k: string) => `FIAON-E272P-${k}`;
const MAIL = (w: Wer) => `e272-${w.toLowerCase()}@pruefstand-e272.test`;
const TEL = (w: Wer) => `+4915927${String(ID[w]).slice(-5)}`;
const NACHNAME = (w: Wer) => `Prueffall${w}`;
const TAG = 86_400_000;
const vor = (tage: number) => new Date(Date.now() - tage * TAG);
const datum = (tage: number) => vor(tage).toISOString().slice(0, 10);

async function aufraeumen(): Promise<void> {
  // Jede Tabelle mit person_id (Protokolle, Aliase, Kurzlinks, Angebote …) — nur unsere IDs.
  const tabellen = (await sqlPool`
    SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND c.column_name = 'person_id' AND t.table_type = 'BASE TABLE'`) as any[];
  for (const t of tabellen) {
    await sqlPool.unsafe(`DELETE FROM "${String(t.table_name)}" WHERE person_id = ANY($1::int[])`, [ALLE]).catch(() => {});
  }
  const mitRef = (await sqlPool`
    SELECT c.table_name FROM information_schema.columns c
      JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = c.table_schema
     WHERE c.table_schema = 'public' AND c.column_name = 'ref' AND t.table_type = 'BASE TABLE'`) as any[];
  for (const t of mitRef) {
    await sqlPool.unsafe(`DELETE FROM "${String(t.table_name)}" WHERE ref LIKE 'FIAON-E272P-%'`).catch(() => {});
  }
  await sqlPool`DELETE FROM fiaon_global_angebote WHERE angebot_ref LIKE 'FIAON-IA-E272P-%'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_leads WHERE id = ANY(${ALLE}) OR email LIKE '%@pruefstand-e272.test'`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_agent_verfuegbarkeit WHERE agent_id = ANY(${AGENTEN})`.catch(() => {});
  await sqlPool`UPDATE fiaon_persons SET merged_into_person_id = NULL, assigned_agent_id = NULL WHERE id = ANY(${ALLE})`.catch(() => {});
  await sqlPool`DELETE FROM fiaon_persons WHERE id = ANY(${ALLE})`;
  await sqlPool`DELETE FROM fiaon_agents WHERE id = ANY(${AGENTEN})`;
}

async function person(w: Wer, o: Record<string, unknown> = {}): Promise<void> {
  await sqlPool`INSERT INTO fiaon_persons ${sqlPool({
    id: ID[w], person_ref: `E272P-${ID[w]}`, first_name: "Erika", last_name: NACHNAME(w),
    primary_email: MAIL(w), primary_phone: TEL(w), country: "DE", birthdate: "1980-04-12",
    street: "Prüfweg 1", zip: "10115", city: "Berlin", account_status: "active",
    created_at: vor(20), updated_at: vor(20), priority_tier: 2, tier_reason: "rechnung_offen", ...o,
  } as any)}`;
}
async function antrag(w: Wer, k: string, o: Record<string, unknown> = {}): Promise<string> {
  await sqlPool`INSERT INTO fiaon_applications ${sqlPool({
    ref: REF(k), person_id: ID[w], pack_key: "pro", pack_name: "Pro", type: "private",
    status: "submitted", payment_status: "pending_payment", current_step: 8, submitted_at: vor(20),
    amount_due: 59.99, email: MAIL(w), phone: TEL(w), first_name: "Erika", last_name: NACHNAME(w),
    birthdate: "1980-04-12", street: "Prüfweg 1", zip: "10115", city: "Berlin",
    reminder_count: 0, created_at: vor(20), updated_at: vor(20), ...o,
  } as any)}`;
  return REF(k);
}
async function lead(w: Wer, o: Record<string, unknown> = {}): Promise<void> {
  await sqlPool`INSERT INTO fiaon_leads ${sqlPool({
    id: ID[w], person_id: ID[w], vorname: "Erika", nachname: NACHNAME(w), email: MAIL(w), telefon: TEL(w),
    status: "neu", whatsapp_erlaubt: true, quelle: "facebook_lead_ads", erstellt_am: vor(5), updated_at: vor(5), ...o,
  } as any)}`;
}
let angebote = 0;
async function angebot(personId: number, status = "offen"): Promise<void> {
  angebote++;
  await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, status, gueltig_bis)
    VALUES (${`FIAON-IA-E272P-${angebote}`}, ${personId}, 'pruefstand', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, ${status}, CURRENT_DATE + 14)`;
}

titel("AUFBAU");
await regel.globalKundeBereit();
await aufraeumen();
// Zählungen (Gruppenzahl = Liste, Segmentzahlen, Filtergruppen, Reiter-Zähler) sind nur auf einer
// LEEREN Struktur-Kopie eindeutig. Fremde Zeilen = falscher Prüfstand, kein Befund.
{
  const [fremd] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id <> ALL(${ALLE}))::int AS p,
           (SELECT COUNT(*) FROM fiaon_applications WHERE ref NOT LIKE 'FIAON-E272P-%')::int AS a,
           (SELECT COUNT(*) FROM fiaon_leads WHERE id <> ALL(${ALLE}))::int AS l`) as any[];
  if (fremd.p + fremd.a + fremd.l > 0) {
    console.error(`ABBRUCH: Die Datenbank ist nicht leer (${fremd.p} Personen, ${fremd.a} Bestellungen, ${fremd.l} Leads) — `
      + "dieser Prüfstand braucht eine leere Struktur-Kopie (z. B. fiaon_e272_test).");
    await sqlPool.end({ timeout: 5 }).catch(() => {});
    process.exit(2);
  }
}
await sqlPool`INSERT INTO fiaon_agents ${sqlPool([
  { id: AG.normal, name: "Prüf Normal E272", email: "ag-normal@pruefstand-e272.test", active: true, rolle: "agent", distribution_active: true, zugang_gesperrt_am: null },
  { id: AG.gesperrt, name: "Prüf Gesperrt E272", email: "ag-gesperrt@pruefstand-e272.test", active: true, rolle: "agent", distribution_active: true, zugang_gesperrt_am: vor(1) },
  { id: AG.inkasso, name: "Prüf Inkasso E272", email: "ag-inkasso@pruefstand-e272.test", active: true, rolle: "inkasso", distribution_active: false, zugang_gesperrt_am: null },
] as any)}`;

// G — Fall Hildbrand
await person("G"); await antrag("G", "G"); await lead("G", { erstellt_am: vor(20) }); await angebot(ID.G);
// N — derselbe ohne Angebot
await person("N"); await antrag("N", "N"); await lead("N", { erstellt_am: vor(20) });
// GA — Global-Auftrag über /business, Stufe noch 2 („alte Stufe“ bis zum Neurechnen)
await person("GA"); await antrag("GA", "GA", { pack_key: "global_struktur", pack_name: "FIAON Global Struktur", type: "business", amount_due: 2499 });
// M — gemischt
await person("M", { created_at: vor(60), priority_tier: 0, tier_reason: "bezahlt" });
await antrag("M", "M1", { payment_status: "paid", status: "payment_completed", paid_at: vor(55), created_at: vor(60), submitted_at: vor(60) });
await antrag("M", "M2", { pack_key: "highend", pack_name: "High End", amount_due: 99.99 });
await antrag("M", "M3", { pack_key: "global_banking", pack_name: "FIAON Global Banking", type: "business", amount_due: 4999 });
await lead("M", { erstellt_am: vor(60) }); await angebot(ID.M);
await sqlPool`INSERT INTO fiaon_abo_raten ${sqlPool([
  { ref: REF("M1"), rate_nr: 1, zahlungsreferenz: "FIAON-E272MA-1", betrag_cents: 5999, faellig_am: datum(55), status: "bezahlt", bezahlt_am: vor(55) },
  { ref: REF("M1"), rate_nr: 2, zahlungsreferenz: "FIAON-E272MA-2", betrag_cents: 5999, faellig_am: datum(5), status: "offen", bezahlt_am: null },
] as any)}`;
// NA / GAB — abgebrochen (Schritt 3, nie abgeschickt, seit zwei Tagen unberührt)
const abbruch = { status: "config", current_step: 3, submitted_at: null, payment_status: "pending", created_at: vor(2), updated_at: vor(2) };
await person("NA", { created_at: vor(2), tier_reason: "antrag_abgebrochen" }); await antrag("NA", "NA", abbruch); await lead("NA", { erstellt_am: vor(2) });
await person("GAB", { created_at: vor(2), tier_reason: "antrag_abgebrochen" }); await antrag("GAB", "GAB", abbruch); await lead("GAB", { erstellt_am: vor(2) }); await angebot(ID.GAB);
// NL / GL — Leads ohne Antrag
await person("NL", { created_at: vor(5), priority_tier: 3, tier_reason: "nur_lead" }); await lead("NL");
await person("GL", { created_at: vor(5), priority_tier: 3, tier_reason: "nur_lead" }); await lead("GL"); await angebot(ID.GL);
// W / L — zusammengeführt: die Zeile am Gewinner, das Angebot am Verlierer (wie fiaon-person-merge.ts)
await person("W"); await antrag("W", "W");
await person("L", { merged_into_person_id: ID.W, account_status: "merged", primary_email: "e272-l-alt@pruefstand-e272.test" });
await angebot(ID.L);
// P — privat bezahlt; GP — nur Global bezahlt (Einstufung schon heute -1)
await person("P", { created_at: vor(60), priority_tier: 0, tier_reason: "bezahlt" });
await antrag("P", "P", { payment_status: "paid", status: "payment_completed", paid_at: vor(55), created_at: vor(60), submitted_at: vor(60) });
await person("GP", { created_at: vor(60), priority_tier: -1, tier_reason: "ausgeschlossen" });
await antrag("GP", "GP", { pack_key: "global_struktur", pack_name: "FIAON Global Struktur", type: "business", amount_due: 2499,
  payment_status: "paid", status: "payment_completed", paid_at: vor(55), created_at: vor(60), submitted_at: vor(60) });
// GC / NC — Zahlung gemeldet (Stufe 1, herrenlos)
const gemeldet = { payment_status: "claimed_paid", claimed_paid_at: vor(2), created_at: vor(5), updated_at: vor(2), submitted_at: vor(5) };
await person("GC", { created_at: vor(5), priority_tier: 1, tier_reason: "zahlung_angekuendigt" }); await antrag("GC", "GC", gemeldet); await angebot(ID.GC);
await person("NC", { created_at: vor(5), priority_tier: 1, tier_reason: "zahlung_angekuendigt" }); await antrag("NC", "NC", gemeldet);
// NX — archivierter Abbruch (Archiv nimmt aus jeder Arbeitsliste, E-272 Nachtrag WA-Zentrale/Mara)
await person("NX", { created_at: vor(2), priority_tier: 3, tier_reason: "nur_lead" });
await antrag("NX", "NX", { ...abbruch, archived_at: vor(1) }); await lead("NX", { erstellt_am: vor(2) });
const ZAHLREF = new Map(((await sqlPool`SELECT ref, payment_reference FROM fiaon_applications WHERE ref LIKE 'FIAON-E272P-%'`) as any[])
  .map((z) => [String(z.ref), String(z.payment_reference)]));
pruef("Testdaten angelegt (15 Personen, 14 Bestellzeilen, 6 Angebote, 3 Mitarbeiter)",
  ZAHLREF.size === 14 && angebote === 6, { zeilen: ZAHLREF.size, angebote });

const { ...I } = ID;
const ids = (zeilen: any[], feld = "personId") => new Set<number>(zeilen.map((z) => Number(z[feld])));

try {
  // ═════════════════════════════════════════════════════════════════════════
  // TEIL 1 — DIE REGEL
  // ═════════════════════════════════════════════════════════════════════════
  titel("1 · DIE REGEL (istGlobalKunde und globalKundeSql)");
  const soll: [string, Wer, boolean][] = [
    ["Global-only (Fall Hildbrand: Angebot + offener Privatantrag + Lead mit WhatsApp)", "G", true],
    ["Global-Auftrag über /business", "GA", true],
    ["Global-Lead (nur Angebot, kein Antrag)", "GL", true],
    ["Abbrecher mit Angebot", "GAB", true],
    ["Zahlung gemeldet (claimed_paid) + Angebot — claimed_paid ist kein Geld", "GC", true],
    ["nur bezahlter Global-Auftrag", "GP", true],
    ["Gewinner einer Zusammenführung, Angebot am Verlierer", "W", true],
    ["Verlierer selbst (trägt das Angebot)", "L", true],
    ["gemischt: bezahltes Stufenpaket + Global-Zeile + Angebot", "M", false],
    ["normal privat, offen", "N", false],
    ["normal privat, abgebrochen", "NA", false],
    ["normaler Lead", "NL", false],
    ["privat bezahlt", "P", false],
    ["Zahlung gemeldet ohne Global", "NC", false],
  ];
  const satz = (await sqlPool.unsafe(`SELECT p.id, ${regel.globalKundeSql("p.id")} AS ja FROM fiaon_persons p WHERE p.id = ANY($1::int[])`, [ALLE])) as any[];
  const ausSatz = new Map(satz.map((z) => [Number(z.id), z.ja]));
  for (const [text, w, erwartet] of soll) {
    const einzeln = await regel.istGlobalKunde(ID[w]);
    pruef(`${text}: ${erwartet ? "Global-Kunde" : "kein Global-Kunde"}`, ausSatz.get(ID[w]) === erwartet && einzeln === erwartet,
      { satz: ausSatz.get(ID[w]), einzeln });
  }
  const [nul] = (await sqlPool.unsafe(`SELECT ${regel.globalKundeSql("NULL::int")} AS ja`)) as any[];
  pruef("ohne Person: FALSE, nie NULL („AND NOT …“ verliert keine Zeile)", nul?.ja === false, nul?.ja);

  titel("1b · EINSTUFUNG (personTierSql, tier.ts)");
  const stufen = (await sqlPool.unsafe(`SELECT person_id, priority_tier, tier_reason FROM (${personTierSql()}) t WHERE person_id = ANY($1::int[])`, [ALLE])) as any[];
  const st = new Map(stufen.map((z) => [Number(z.person_id), `${z.priority_tier}/${z.tier_reason}`]));
  for (const w of ["G", "GA", "GL", "GAB", "GC", "GP", "W"] as Wer[]) {
    pruef(`${w}: Stufe -1/ausgeschlossen (auch mit offenem Privatantrag)`, st.get(ID[w]) === "-1/ausgeschlossen", st.get(ID[w]));
  }
  // Gemischt: nie in firmenkunde — gerechnet wie vor E-272. Sein offener Privatantrag (M2) schlägt das
  // bezahlte Paket, also Stufe B; dieselbe Rechnung wie für jeden Privatkunden mit offener Rechnung.
  pruef("M (gemischt) wie vorher gerechnet: offene Privatrechnung → 2/rechnung_offen, nie -1", st.get(I.M) === "2/rechnung_offen", st.get(I.M));
  for (const w of ["N", "NA", "NL", "P", "NC"] as Wer[]) {
    pruef(`${w}: keine -1`, !!st.get(ID[w]) && !String(st.get(ID[w])).startsWith("-1"), st.get(ID[w]));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEIL 2 — JEDE GEÄNDERTE AUSWAHL
  // ═════════════════════════════════════════════════════════════════════════
  titel("2a · WA-ZENTRALE (kandidaten, gruppenZahlen — fiaon-wa-zentrale.ts)");
  const gruppe = async (g: any) => (await waz.kandidaten(g, 500, [], ALLE)) as any[];
  const neu = await gruppe("neu");
  menge("Gruppe „neu“", ids(neu), { "normaler Lead": [I.NL, true], "Global-Lead": [I.GL, false] });
  const abbrecher = await gruppe("abbrecher");
  menge("Gruppe „abbrecher“", ids(abbrecher), {
    "normaler Abbrecher": [I.NA, true], "Abbrecher mit Angebot": [I.GAB, false], "archivierter Abbruch": [I.NX, false],
  });
  const zahlung = await gruppe("zahlung_offen");
  menge("Gruppe „zahlung_offen“", ids(zahlung), {
    "normal offen": [I.N, true], "Global-only (Hildbrand)": [I.G, false], "Global-Auftrag /business": [I.GA, false],
    "Gewinner mit Angebot am Verlierer": [I.W, false], "gemischt (bezahlt, wie vorher)": [I.M, false],
  });
  const nZahlung = zahlung.find((k) => Number(k.personId) === I.N);
  pruef("„zahlung_offen“: Referenz und Betrag aus SEINER Privatbestellung", !!nZahlung && nZahlung.referenz === ZAHLREF.get(REF("N")),
    { referenz: nZahlung?.referenz, betrag: nZahlung?.betrag });
  const rate = await gruppe("rate_offen");
  menge("Gruppe „rate_offen“", ids(rate), { "gemischt mit fälliger Rate (wie vorher)": [I.M, true], "privat bezahlt ohne fällige Rate": [I.P, false] });
  const mRate = rate.find((k) => Number(k.personId) === I.M);
  pruef("„rate_offen“: die Rate des Stufenpakets, nie die Global-Zeile", mRate?.referenz === "FIAON-E272MA-2", mRate?.referenz);
  const zahlen = await waz.gruppenZahlen();
  pruef("Gruppenzahl = Liste (neu, abbrecher, zahlung_offen, rate_offen) — Vorschau und Lauf sehen dieselbe Menge",
    zahlen.neu === neu.length && zahlen.abbrecher === abbrecher.length && zahlen.zahlung_offen === zahlung.length && zahlen.rate_offen === rate.length,
    { zahlen, listen: [neu.length, abbrecher.length, zahlung.length, rate.length] });

  titel("2b · WHATSAPP-TÜR (waVorlagenSperre — fiaon-whatsapp.ts, Lead-WA-Kette und Raum)");
  const tuer = (v: string, w: Wer, z: { personId?: number; leadId?: number } = { personId: ID[w] }) => wa.waVorlagenSperre(v, TEL(w), z);
  const gG = await tuer("fiaon_kk_antrag_offen", "G");
  pruef("G: „fiaon_kk_antrag_offen“ gesperrt — Global-Kunde", /Global-Kunde/.test(String(gG)), gG);
  pruef("N: „fiaon_kk_antrag_offen“ frei", (await tuer("fiaon_kk_antrag_offen", "N")) === null);
  pruef("M (gemischt): „fiaon_kk_antrag_offen“ frei — wie vorher", (await tuer("fiaon_kk_antrag_offen", "M")) === null);
  pruef("Dublette L (Kopf W): am KOPF gelesen — gesperrt", /Global-Kunde/.test(String(await tuer("fiaon_kk_antrag_offen", "W", { personId: I.L }))));
  pruef("Global-Lead über die Lead-ID: gesperrt", /Global-Kunde/.test(String(await tuer("fiaon_kk_anfrage", "GL", { leadId: I.GL }))));
  pruef("G: „fiaon_kk_aktiviert“ (Service, aber Privatlinie) gesperrt", /Global-Kunde/.test(String(await tuer("fiaon_kk_aktiviert", "G"))));
  pruef("N: „fiaon_kk_aktiviert“ frei", (await tuer("fiaon_kk_aktiviert", "N")) === null);
  pruef("G: „fiaon_kk_termin“ (Einladung zur Privatberatung) gesperrt", /Global-Kunde/.test(String(await tuer("fiaon_kk_termin", "G"))));

  titel("2c · MARA AUF WHATSAPP (globalKundeWa, lageFuer — fiaon-whatsapp-mara.ts)");
  for (const [w, erwartet] of [["G", true], ["GA", true], ["GL", true], ["W", true], ["L", true], ["GC", true],
    ["N", false], ["M", false], ["NL", false], ["NC", false]] as [Wer, boolean][]) {
    pruef(`globalKundeWa(${w}) = ${erwartet} — Mara ${erwartet ? "antwortet nie, Aufgabe an Justin" : "antwortet wie bisher"}`,
      (await waMara.globalKundeWa(ID[w])) === erwartet);
  }
  const leadText = (l: any) => l.lage === "Hat noch keinen Antrag." || String(l.lage).startsWith("Hat das Formular ausgefüllt");
  const lageNX = await waMara.lageFuer(I.NX, I.NX, null);
  pruef("lageFuer: ein archivierter, nie abgeschickter Privatantrag ist kein Vorgang mehr", leadText(lageNX), lageNX.lage);
  const lageN = await waMara.lageFuer(I.N, I.N, null);
  pruef("lageFuer: der lebende Antrag von N wird gesehen (Gegenprobe)", !leadText(lageN), lageN.lage);
  // Dieselbe Wahl im Abstreiten (fiaon-mara-abstreiten.ts, Gegenprüfung E-272): archiviert und unbezahlt zählt nicht.
  const abNX = await abstreiten.abstreitenLage(I.NX, I.NX);
  const abNA = await abstreiten.abstreitenLage(I.NA, I.NA);
  pruef("abstreitenLage: archivierter Abbruch → Stufe Lead, lebender Abbruch → nicht Lead (dieselbe Wahl wie lageFuer)",
    abNX.stufe === "lead" && abNA.stufe !== "lead", { NX: abNX.stufe, NA: abNA.stufe });

  titel("2d · RÜCKHOLUNG (rueckholKandidaten, rueckholSegmente — fiaon-rueckholung.ts)");
  const s4 = new Set((await rueck.rueckholKandidaten("s4_nie_gemahnt", 500)).map((f) => f.ref));
  menge("S4 nie gemahnt", s4, {
    "normal offen": [REF("N"), true], "gemischt, offener Privatantrag (wie vorher)": [REF("M2"), true],
    "Global-only (Hildbrand)": [REF("G"), false], "Gewinner mit Angebot am Verlierer": [REF("W"), false],
  });
  const s1 = new Set((await rueck.rueckholKandidaten("s1_frisch", 500)).map((f) => f.ref));
  menge("S1 frisch gemeldet", s1, { "gemeldet ohne Global": [REF("NC"), true], "gemeldet mit Angebot": [REF("GC"), false] });
  const seg = await rueck.rueckholSegmente();
  pruef("Segmentzahlen = Listen (S4 = 2, S1 = 1)", seg.s4_nie_gemahnt.anzahl === 2 && seg.s1_frisch.anzahl === 1,
    { s4: seg.s4_nie_gemahnt.anzahl, s1: seg.s1_frisch.anzahl });

  titel("2e · MARA-AKTION (kandidatenLaden — fiaon-mara-aktion.ts)");
  const ak = ids(await aktion.kandidatenLaden(500, ["A", "B"]));
  menge("Mara-Aktion A+B", ak, {
    "normal offen (B)": [I.N, true], "gemeldet (A)": [I.NC, true], "Global-only (Hildbrand)": [I.G, false],
    "gemeldet mit Angebot": [I.GC, false], "Gewinner mit Angebot am Verlierer": [I.W, false], "gemischt (bezahlt, wie vorher)": [I.M, false],
  });

  titel("2f · MAIL-ZENTRALE (zielgruppeLaden, empfaengerSuche, filterGruppen — fiaon-zentrale.ts)");
  const zg = await zentrale.zielgruppeLaden({ personIds: ALLE });
  const zgIds = new Set(zg.empfaenger.map((e) => Number(e.personId)));
  menge("Zielgruppe (einzeln gewählt)", zgIds, {
    "normal offen": [I.N, true], "normal abgebrochen": [I.NA, true], "gemischt (wie vorher)": [I.M, true], "privat bezahlt": [I.P, true],
    "Global-only (Hildbrand)": [I.G, false], "Global-Auftrag /business": [I.GA, false], "nur Global bezahlt": [I.GP, false],
    "Gewinner mit Angebot am Verlierer": [I.W, false], "gemeldet mit Angebot": [I.GC, false],
  });
  pruef("Zielgruppe: genau N, NA, M, P, NC", zgIds.size === 5 && [I.N, I.NA, I.M, I.P, I.NC].every((x) => zgIds.has(x)), [...zgIds]);
  pruef("Suche findet den Global-Kunden nicht", (await zentrale.empfaengerSuche(NACHNAME("G"))).length === 0);
  pruef("Suche findet die normale Person", (await zentrale.empfaengerSuche(NACHNAME("N"))).some((e) => Number(e.personId) === I.N));
  const fg = new Map((await zentrale.filterGruppen()).map((g) => [g.schluessel, g.anzahl]));
  pruef("Filtergruppe „Alle Kunden“ = 5 (ohne Global-Kunden mit alter Stufe)", fg.get("alle_kunden") === 5, Object.fromEntries(fg));
  const extern = await zentrale.zielgruppeLaden({ extern: [MAIL("G"), MAIL("N"), MAIL("M"), "fremd@pruefstand-e272.test"] });
  const ext = new Set(extern.empfaenger.map((e) => e.email));
  pruef("Getippte Adresse eines Global-Kunden fällt heraus, die anderen bleiben",
    !ext.has(MAIL("G")) && ext.has(MAIL("N")) && ext.has(MAIL("M")) && ext.has("fremd@pruefstand-e272.test") && /Kunden von FIAON Global/.test(extern.ausgeschlossen),
    { ext: [...ext], hinweis: extern.ausgeschlossen });

  titel("2g · WIEDEREINSTIEG (wiedereinstiegKandidaten — fiaon-wiedereinstieg.ts)");
  const we = ids(await wieder.wiedereinstiegKandidaten(null));
  menge("Wiedereinstieg", we, { "normal offen": [I.N, true], "Global-only (Hildbrand, alte Stufe 2)": [I.G, false], "Gewinner mit Angebot am Verlierer": [I.W, false] });

  titel("2h · KONTO & KARTE (bereiteKunden, kartenStand — fiaon-konto-karte.ts)");
  const bereit = ids(await karte.bereiteKunden({ grenze: 500 }));
  menge("Bereit für die Einladung der Partnerbank", bereit, {
    "privat bezahlt": [I.P, true], "gemischt (bezahltes Stufenpaket, wie vorher)": [I.M, true], "nur Global bezahlt": [I.GP, false],
  });
  pruef("kartenStand(GP): ein bezahlter Global-Auftrag ist kein bezahltes Paket", (await karte.kartenStand(I.GP))?.zahlen.paketBezahlt === false);
  pruef("kartenStand(P): Paket bezahlt", (await karte.kartenStand(I.P))?.zahlen.paketBezahlt === true);

  titel("2i · LEAD-STRECKE (faellige — fiaon-lead-strecke.ts)");
  const fl = ids(await strecke.faellige(2000), "id");
  menge("Fällige Strecken-Mails", fl, { "normaler Lead": [I.NL, true], "Global-Lead": [I.GL, false] });

  titel("2j · OFFENE KARTEI (karteiCte — routes/fiaon-kartei.ts)");
  const cte = (kartei as any).__karteiCteForTests({
    wFresh: 40, wValue: 25, wReact: 50, wContact: 30, fairnessNth: 4, vorrangZahlung: true,
    hoardingDays: 7, hoardingWarnDays: 2, autoReleaseMin: 30, requireFullContact: true,
  });
  const karten = new Set(((await sqlPool.unsafe(`${cte} SELECT card_id FROM kartei`)) as any[]).map((z) => String(z.card_id)));
  menge("Kartei", karten, {
    "normal offen": [REF("N"), true], "gemeldet": [REF("NC"), true], "gemischt, offener Privatantrag (wie vorher)": [REF("M2"), true],
    "normaler Lead": [`lead-${I.NL}`, true], "Global-only (Hildbrand)": [REF("G"), false], "Global-Auftrag /business": [REF("GA"), false],
    "Global-Zeile des Gemischten": [REF("M3"), false], "Gewinner mit Angebot am Verlierer": [REF("W"), false],
    "gemeldet mit Angebot": [REF("GC"), false], "Global-Lead": [`lead-${I.GL}`, false],
  });

  titel("2k · TELEFONKARTEI (karteiListe, karteiZaehler, karteEinzeln — fiaon-telefonkartei.ts)");
  const reiter = async (g: any) => new Set((await tk.karteiListe({ gruppe: g })).karten.map((k: any) => Number(k.personId ?? k.id)));
  const rA = await reiter("A"), rB = await reiter("B"), rC = await reiter("C"), rRate = await reiter("rate"), rAlle = await reiter("alle");
  menge("Reiter A", rA, { "gemeldet": [I.NC, true], "gemeldet mit Angebot": [I.GC, false] });
  menge("Reiter B", rB, {
    "normal offen": [I.N, true], "normal abgebrochen": [I.NA, true], "Global-only (Hildbrand)": [I.G, false],
    "Global-Auftrag /business (alte Stufe 2)": [I.GA, false], "Abbrecher mit Angebot": [I.GAB, false], "Gewinner mit Angebot am Verlierer": [I.W, false],
  });
  menge("Reiter C", rC, { "normaler Lead": [I.NL, true], "Global-Lead": [I.GL, false] });
  menge("Reiter Rate offen", rRate, { "gemischt mit fälliger Rate (wie vorher)": [I.M, true] });
  menge("Reiter Alle", rAlle, { "gemischt": [I.M, true], "privat bezahlt": [I.P, true], "Global-only": [I.G, false], "nur Global bezahlt": [I.GP, false] });
  const zaehler = await tk.karteiZaehler(false);
  pruef("Zähler = Reiter (A, B, C, Rate, Alle)", zaehler.A === rA.size && zaehler.B === rB.size && zaehler.C === rC.size
    && zaehler.rate === rRate.size && zaehler.alle === rAlle.size, { zaehler, reiter: [rA.size, rB.size, rC.size, rRate.size, rAlle.size] });
  pruef("Einzelaufruf findet den Global-Kunden weiter (wie Gesperrte und Testkonten)", (await tk.karteEinzeln(I.G)) !== null);

  titel("2l · POSTMEISTER (Lage, Vertrag, Wand, Akte — fiaon-postmeister-dossier.ts / -werkzeuge.ts)");
  const lG = await dossier.kundenlageBerechnen(I.G, REF("G"));
  pruef("Lage G: „unklar“ mit Global-Grund — nie „interessent“ zum Privatantrag", lG.lage === "unklar" && /FIAON Global/.test(lG.grund), lG);
  const lN = await dossier.kundenlageBerechnen(I.N, REF("N"));
  pruef("Lage N: wie bisher (nicht „unklar“)", lN.lage !== "unklar", lN);
  const lM = await dossier.kundenlageBerechnen(I.M, REF("M1"));
  pruef("Lage M (gemischt): wie bisher (nicht „unklar“)", lM.lage !== "unklar", lM);
  const lGA = await dossier.kundenlageBerechnen(I.GA, REF("GA"));
  pruef("Lage GA: aus seiner Global-Zeile gerechnet (nicht „unklar“)", lGA.lage !== "unklar", lGA);
  pruef("Vertrag G: „KUNDE VON FIAON GLOBAL — KEIN PRIVATVERTRAG“", /KUNDE VON FIAON GLOBAL/.test((await dossier.vertragsfassung(REF("G"))).text));
  pruef("Vertrag N: Privatvertrag wie bisher", !/FIAON GLOBAL/i.test((await dossier.vertragsfassung(REF("N"))).text));
  pruef("Vertrag M (Stufenpaket): Privatvertrag wie bisher", !/KUNDE VON FIAON GLOBAL/.test((await dossier.vertragsfassung(REF("M1"))).text));
  pruef("Global-Wand: G mit Privat-Vorgang ist Global", (await werkzeuge.istGlobalVorgang({ personId: I.G, ref: REF("G") })) === true);
  pruef("Global-Wand: N ist nicht Global", (await werkzeuge.istGlobalVorgang({ personId: I.N, ref: REF("N") })) === false);
  pruef("Global-Wand: M mit Stufenpaket-Vorgang nicht Global (wie vorher)", (await werkzeuge.istGlobalVorgang({ personId: I.M, ref: REF("M1") })) === false);
  pruef("Global-Wand: M mit Global-Vorgang Global (wie vorher, je Zeile)", (await werkzeuge.istGlobalVorgang({ personId: I.M, ref: REF("M3") })) === true);
  pruef("Global-Wand: W über das Angebot am Verlierer", (await werkzeuge.istGlobalVorgang({ personId: I.W, ref: REF("W") })) === true);
  pruef("Zahlungsseite/Rechnung: Privatreferenz beim Global-Kunden gesperrt",
    typeof (await werkzeuge.privatReferenzBeiGlobal({ personId: I.G }, { firmenauftrag: false, produkt: "konto" })) === "string");
  pruef("Zahlungsseite/Rechnung: sein Global-Auftrag und eine Auskunft frei",
    (await werkzeuge.privatReferenzBeiGlobal({ personId: I.G }, { firmenauftrag: true })) === null
    && (await werkzeuge.privatReferenzBeiGlobal({ personId: I.G }, { produkt: "auskunft" })) === null);
  pruef("Zahlungsseite/Rechnung: N und M frei",
    (await werkzeuge.privatReferenzBeiGlobal({ personId: I.N }, { produkt: "konto" })) === null
    && (await werkzeuge.privatReferenzBeiGlobal({ personId: I.M }, { produkt: "konto" })) === null);
  try {
    const aG = await dossier.akteLesen(I.G, REF("G"));
    pruef("Akte G: Feld global gesetzt, kein Privat-Betreuer, kein Kartenziel", !!aG.global && aG.betreuer === null && aG.kartenziel == null,
      { global: !!aG.global, betreuer: aG.betreuer, kartenziel: aG.kartenziel });
    const aN = await dossier.akteLesen(I.N, REF("N"));
    pruef("Akte N: kein Feld global", aN.global === null);
    const aM = await dossier.akteLesen(I.M, REF("M1"));
    pruef("Akte M (gemischt): kein Feld global — wie vorher", aM.global === null);
  } catch (e) {
    pruef("Akte lesbar", false, String((e as Error)?.message || e).slice(0, 200));
  }

  titel("2m · MAIL-TÜR (personenSindGlobalKunde — make-webhook.ts)");
  pruef("G: Global-Kunde", (await make.personenSindGlobalKunde([I.G])) === true);
  pruef("GA: Global-Kunde", (await make.personenSindGlobalKunde([I.GA])) === true);
  pruef("L (Dublette, Kopf W): Global-Kunde über den Kopf", (await make.personenSindGlobalKunde([I.L])) === true);
  pruef("N: kein Global-Kunde", (await make.personenSindGlobalKunde([I.N])) === false);
  pruef("M (gemischt): kein Global-Kunde — seine Post geht wie vorher", (await make.personenSindGlobalKunde([I.M])) === false);
  pruef("Adresse mit Global-Kunde UND Privatkunde: frei (alle müssen Global sein)", (await make.personenSindGlobalKunde([I.G, I.N])) === false);
  pruef("Adresse von G: gesperrt", (await make.personenSindGlobalKunde(await mf.personenAnAdresse(MAIL("G")))) === true);
  pruef("Adresse von N: frei", (await make.personenSindGlobalKunde(await mf.personenAnAdresse(MAIL("N")))) === false);

  // ── ÄNDERNDE FUNKTIONEN: in einer Transaktion, die zurückgerollt wird ──
  titel("2n · ZUTEILUNG (sofortZuteilen, gesperrteFreigeben, neuVerteilen, sonderrollenBereinigen — fiaon-zuteilung.ts)");
  class Zurueck extends Error {}
  const inTx = async (f: (tx: any) => Promise<void>) => {
    try { await sqlPool.begin(async (tx: any) => { await f(tx); throw new Zurueck(); }); } catch (e) { if (!(e instanceof Zurueck)) throw e; }
  };
  const zustaendig = async (tx: any, w: Wer) => {
    const [z] = (await tx`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${ID[w]}`) as any[];
    return z?.assigned_agent_id == null ? null : Number(z.assigned_agent_id);
  };
  await inTx(async (tx) => {
    const g = await zut.sofortZuteilen(I.G, tx);
    pruef("sofortZuteilen(G): abgelehnt — Global-Kunde (trotz alter Stufe 2)", !g.zugeteilt && /Global-Kunde/.test(g.grund), g);
    const ga = await zut.sofortZuteilen(I.GA, tx);
    pruef("sofortZuteilen(GA): abgelehnt — Global-Kunde", !ga.zugeteilt && /Global-Kunde/.test(ga.grund), ga);
    const n = await zut.sofortZuteilen(I.N, tx);
    pruef("sofortZuteilen(N): an der Global-Regel vorbei (zugeteilt oder anderer Grund)", !/Global-Kunde/.test(n.grund), n);
    const m = await zut.sofortZuteilen(I.M, tx);
    pruef("sofortZuteilen(M, gemischt): an der Global-Regel vorbei (wie vorher)", !/Global-Kunde/.test(m.grund), m);
  });
  await inTx(async (tx) => {
    await tx`UPDATE fiaon_persons SET assigned_agent_id = ${AG.gesperrt}, assigned_at = NOW() WHERE id = ANY(${[I.G, I.N]})`;
    const erg = await zut.gesperrteFreigeben(tx, 40);
    pruef("gesperrteFreigeben: N wird gelöst, G bleibt (Global-Kunde)",
      (await zustaendig(tx, "N")) !== AG.gesperrt && (await zustaendig(tx, "G")) === AG.gesperrt && erg.geprueft === 1, erg);
  });
  await inTx(async (tx) => {
    await tx`UPDATE fiaon_persons SET assigned_agent_id = ${AG.normal}, assigned_at = NOW() WHERE id = ANY(${[I.G, I.N]})`;
    const erg = await zut.neuVerteilen([I.G, I.N], "Prüfstand E-272", tx);
    const vonN = await zustaendig(tx, "N");
    pruef("neuVerteilen: G bleibt bei seiner Person, N wird neu verteilt",
      (await zustaendig(tx, "G")) === AG.normal && erg.geprueft === 2 && erg.verteilt + erg.pool === 1, { erg, vonN });
  });
  await inTx(async (tx) => {
    await tx`UPDATE fiaon_persons SET assigned_agent_id = ${AG.inkasso}, assigned_at = NOW() WHERE id = ANY(${[I.G, I.N]})`;
    const b = await zut.sonderrollenBereinigen({ schreiben: false }, tx);
    const z = new Set(b.zeilen.map((x) => Number(x.personId)));
    menge("Sonderrollen-Bereinigung (Vorschau)", z, { "normal offen": [I.N, true], "Global-only (Hildbrand)": [I.G, false] });
  });

  titel("2o · AUTO-ASSIGN STUFE 1 (autoAssignTier1 — routes/fiaon-followup.ts)");
  const aGC = await followup.autoAssignTier1(I.GC);
  const [gcNach] = (await sqlPool`SELECT assigned_agent_id FROM fiaon_persons WHERE id = ${I.GC}`) as any[];
  pruef("autoAssignTier1(GC): nicht zugeteilt — Global-Kunde", aGC === null && gcNach?.assigned_agent_id == null, { aGC, nach: gcNach?.assigned_agent_id });
  const aNC = await followup.autoAssignTier1(I.NC);
  pruef("autoAssignTier1(NC): zugeteilt (Gegenprobe)", aNC !== null, aNC);
  await sqlPool`UPDATE fiaon_persons SET assigned_agent_id = NULL, follow_up_date = NULL WHERE id = ${I.NC}`;
  await sqlPool`DELETE FROM fiaon_contact_log WHERE ref LIKE 'FIAON-E272P-%'`;
} catch (e) {
  pruef("Teil 1/2 lief ohne Ausnahme durch", false, String((e as Error)?.stack || e).slice(0, 600));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL Q — QUELLTEXT: Auswahlen, die nicht exportiert sind oder versenden
// ═══════════════════════════════════════════════════════════════════════════
titel("Q · QUELLTEXT (nicht exportierte oder versendende Auswahlen)");
const WURZEL = new URL("..", import.meta.url).pathname;
const quelle = (p: string) => readFileSync(join(WURZEL, p), "utf8");
/** Der Rumpf ab `start` bis zum Ende der Funktion bzw. Route (erste Zeile, die mit „}“ beginnt). */
const rumpf = (text: string, start: string): string => {
  const i = text.indexOf(start);
  if (i < 0) return "";
  const rest = text.slice(i);
  const ende = rest.search(/\n\}\)?;?\n/);
  return ende < 0 ? rest : rest.slice(0, ende);
};
const vorher = (text: string, a: string | RegExp, b: string | RegExp) => {
  const ia = typeof a === "string" ? text.indexOf(a) : text.search(a);
  const ib = typeof b === "string" ? text.indexOf(b) : text.search(b);
  return ia >= 0 && ib >= 0 && ia < ib;
};
const zaehle = (text: string, muster: string) => text.split(muster).length - 1;

{
  const f = quelle("server/routes/fiaon-antrag.ts");
  const claim = rumpf(f, "async function claimReminderBatch(");
  pruef("Mahnkette (claimReminderBatch, Einzel- und Sammelversand): Regel an fa.person_id, Tabelle vorher sichergestellt",
    claim.includes(`AND NOT \${sqlPool.unsafe(globalKundeSql("fa.person_id"))}`) && vorher(claim, "await globalKundeBereit()", "return sqlPool`"));
  const vorschau = rumpf(f, `router.get("/admin/payments/bulk-reminder/preview"`);
  const start = rumpf(f, `router.post("/admin/payments/bulk-reminder/start"`);
  pruef("Mahnkette: Zählung der Vorschau und des Starts zählt ohne Global-Kunden (wie claimReminderBatch)",
    vorschau.includes(`globalKundeSql("fa.person_id")`) && start.includes(`globalKundeSql("fa.person_id")`));
}
{
  const f = rumpf(quelle("server/lib/fiaon-antrag-erinnerung.ts"), "export async function antragErinnerungenLauf(");
  // Mara-Topsales 08.10.2026: Die Auswahl steht jetzt in abbrecherSql (der Lauf ruft sie nach globalKundeBereit auf).
  const fa = rumpf(quelle("server/lib/fiaon-antrag-erinnerung.ts"), "export function abbrecherSql(");
  pruef("Antrag-Erinnerung (antragErinnerungenLauf): Regel an a.person_id vor der Auswahl",
    fa.includes(`AND NOT \${globalKundeSql("a.person_id")}`) && f.includes("abbrecherSql(") && vorher(f, "await globalKundeBereit()", "const kandidaten"));
}
{
  const f = quelle("server/lib/fiaon-lead-whatsapp.ts");
  const kette = rumpf(f, "export async function whatsappKetteLaufen(");
  pruef("Lead-WA-Kette (whatsappKetteLaufen): Regel in der Auswahl (unter dem Deckel)",
    kette.includes(`AND NOT \${sqlPool.unsafe(globalKundeSql("p.id"))}`) && vorher(kette, "globalKundeBereit()", "const kandidaten"));
  pruef("Lead-WA-Kette: offene Rechnung, Referenz und Betrag aus EINEM Baustein ohne Global-Zeile",
    /const RECHNUNG_OFFEN = [^;]*produktkategorieSql\(a\)\} <> 'global'/.test(f)
      && kette.includes(`RECHNUNG_OFFEN("a2")`) && kette.includes(`RECHNUNG_OFFEN("a4")`) && kette.includes(`RECHNUNG_OFFEN("a5")`));
  const erste = rumpf(f, "export async function ersteWhatsAppFuerLead(");
  pruef("Begrüßung (ersteWhatsAppFuerLead): Global-Prüfung vor Tagesplatz und Versand",
    vorher(erste, "istGlobalKunde(", "waTagesplatz(") && vorher(erste, "istGlobalKunde(", "waSenden("));
}
{
  const f = rumpf(quelle("server/lib/fiaon-lead-willkommen.ts"), "export async function willkommenSenden(");
  pruef("Begrüßungsmail (willkommenSenden): Regel an l.person_id, Auslassen vor dem Versand",
    f.includes(`globalKundeSql("l.person_id"))} AS global_kunde`) && vorher(f, "if (l.global_kunde === true) return auslassen(", "sendMakeWebhook"));
}
{
  const f = rumpf(quelle("server/lib/fiaon-nicht-erreicht.ts"), "export async function automatikNachFehlversuch(");
  pruef("Nicht-erreicht-Mail (automatikNachFehlversuch): Global-Kunde bekommt keinen Terminlink",
    vorher(f, "istGlobalKunde(personId)", `versendenUndProtokollieren(\n        "nicht_erreicht_termin"`) && f.includes("&& !globalKunde) {"));
}
{
  const f = rumpf(quelle("server/lib/fiaon-monatsbericht.ts"), "export async function monatsberichtLauf(");
  pruef("Monatsbericht (monatsberichtLauf): Auswahl UND Versand schon erzeugter Berichte ohne Global-Kunden",
    f.includes(`globalKundeSql("a.person_id")`) && f.includes(`globalKundeSql("b.person_id")`));
}
{
  // E-275 (02.10.2026): Die Ausschlüsse der Einladung stehen seit E-275 in EINER Abfrage (einladungPruefen) — für die
  // Automatik (einladungenAutomatisch) UND für Mara (karteEinladungFuerPerson); verschickt wird nur in einladungSchicken.
  // Vorher suchte diese Zeile die Regel im Rumpf von einladungenAutomatisch vor „mailSenden({“ — dort steht seit E-275
  // beides nicht mehr (die Zeile war rot, obwohl die Regel griff). Jetzt die vier Stellen einzeln, mit Rotprobe.
  const karteQ = (f: string) => {
    const pruefen = rumpf(f, "async function einladungPruefen(");
    const schicken = rumpf(f, "async function einladungSchicken(");
    const auto = rumpf(f, "export async function einladungenAutomatisch(");
    const mara = rumpf(f, "export async function karteEinladungFuerPerson(");
    return {
      regel: pruefen.includes(`globalKundeSql("p.id")`) && pruefen.includes("z.global ?") && vorher(pruefen, "await globalKundeBereit()", "sqlPool`"),
      auto: vorher(auto, "einladungPruefen(", "einladungSchicken(") && auto.includes("!z.sperre"),
      mara: vorher(mara, "einladungPruefen(", "einladungSchicken(") && vorher(mara, "if (pruefung.sperre)", "einladungSchicken("),
      versand: schicken.includes("mailSenden({") && !auto.includes("mailSenden(") && !mara.includes("mailSenden("),
    };
  };
  const f = quelle("server/lib/fiaon-konto-karte.ts");
  const q = karteQ(f);
  pruef("Konto & Karte (einladungPruefen): Regel an p.id in der einen Ausschluss-Abfrage, Global ist eine Sperre", q.regel);
  pruef("… Automatik (einladungenAutomatisch): einladungPruefen vor einladungSchicken, geschickt wird nur ohne Sperre", q.auto);
  pruef("… Mara (karteEinladungFuerPerson): einladungPruefen vor einladungSchicken, bei einer Sperre Schluss", q.mara);
  pruef("… verschickt wird nur in einladungSchicken (mailSenden), nie an der Prüfung vorbei", q.versand);
  // Rotprobe im Quelltext: ohne die Regel in der Abfrage bzw. ohne die Prüfung vor dem Versand muss die Zeile fallen.
  const ohneRegel = karteQ(f.replace(/\$\{sqlPool\.unsafe\(globalKundeSql\("p\.id"\)\)\} AS global,/, "FALSE AS global,"));
  const ohnePruefung = karteQ(f.replace("const geprueft = await einladungPruefen(", "const geprueft = await keinePruefung("));
  const maraOhne = karteQ(f.replace("const [pruefung] = await einladungPruefen(", "const [pruefung] = await keinePruefung("));
  pruef("… Rotprobe im Quelltext: ohne Regel, ohne Prüfung in der Automatik oder bei Mara fällt die jeweilige Zeile",
    !ohneRegel.regel && !ohnePruefung.auto && !maraOhne.mara && ohneRegel.auto && ohnePruefung.mara);
}
{
  const f = quelle("server/routes/fiaon-office-vertrieb.ts");
  pruef("Arbeitsliste/Pool/Rückfall/Sofort-Spur: KEIN_GLOBAL_KUNDE_SQL ist die Regel an p.id",
    f.includes("const KEIN_GLOBAL_KUNDE_SQL = `NOT ${globalKundeSql(\"p.id\")}`;"));
  pruef("… und steht in Rückfall (2×), Platzzählung, Pool-Zug und der Basis der Arbeitsliste (≥ 5 Stellen)",
    zaehle(f, "${KEIN_GLOBAL_KUNDE_SQL}") >= 4 && zaehle(f, "KEIN_GLOBAL_KUNDE_SQL,") >= 1, { stellen: zaehle(f, "KEIN_GLOBAL_KUNDE_SQL") - 1 });
  // E-IT-A (08.10.2026): Die Abfragen der Arbeitsliste stehen jetzt in arbeitslisteLesen()
  // (prüfbar mit lauf-Parameter); die Route ruft sie. Beide stellen die Tabelle vorher sicher.
  pruef("… die Arbeitsliste stellt die Tabelle vorher sicher",
    vorher(rumpf(f, `router.get("/agent/vertrieb/arbeitsliste"`), "await globalKundeBereit()", "await arbeitslisteLesen(")
      && vorher(rumpf(f, "export async function arbeitslisteLesen("), "await globalKundeBereit()", "KEIN_GLOBAL_KUNDE_SQL,"));
}
{
  const f = quelle("server/routes/fiaon-followup.ts");
  const lauf = rumpf(f, "export async function runFollowUpTageslauf(");
  pruef("Followup-Tageslauf: Auto-Assign (herrenlos) und Eskalation fragen die Regel",
    zaehle(lauf, `globalKundeSql("p.id")`) >= 2 && vorher(lauf, "await globalKundeBereit()", "const herrenlos"));
}
{
  const f = quelle("server/lib/fiaon-mara-aktion.ts");
  pruef("Mara-Aktion (maraAktionLauf): zweiter Blick direkt vor dem Senden (istGlobalKunde)",
    vorher(rumpf(f, "export async function maraAktionLauf("), "istGlobalKunde(k.personId)", "if (sperre) {"));
}
{
  const f = quelle("server/lib/fiaon-whatsapp-mara.ts");
  const antwort = rumpf(f, "export async function maraAntwortet(");
  pruef("Mara-WA (maraAntwortet): Global-Kunde VOR Abschluss-Weitergabe, Privat-Lage und Modell — Aufgabe an Justin (betreiber)",
    vorher(antwort, "await globalKundeWa(Number(personId))", `if (urteil.art === "weitergeben") {`)
      && vorher(antwort, "await globalKundeWa(Number(personId))", "await lageFuer(")
      && vorher(antwort, "await globalKundeWa(Number(personId))", "await entwerfen(")
      && /aufgabeFuerMenschen\([^;]*"global", \{ betreiber: true/.test(antwort));
  const versand = rumpf(f, "export async function versandLauf(");
  pruef("Mara-WA (versandLauf): vorbereitete Antwort an einen Global-Kunden wird verworfen, nicht gesendet",
    vorher(versand, "globalKundeWa(w?.person_id ?? null)", "waSenden(nummer"));
  pruef("Mara-WA (kuendigungAufnehmen): dieselbe Bestellung wie lageFuer — archiviert und unbezahlt zählt nicht",
    rumpf(f, "async function kuendigungAufnehmen(").includes("AND (archived_at IS NULL OR payment_status = 'paid')"));
  pruef("WhatsApp-Knopf „/zahlung/“ (waSenden): nie die Zahlungsseite einer Global-Zeile",
    rumpf(quelle("server/lib/fiaon-whatsapp.ts"), "export async function waSenden(").includes("AND ${lauf.unsafe(produktkategorieSql())} <> 'global'"));
}
{
  const f = quelle("server/lib/fiaon-postmeister-lauf.ts");
  pruef("Postmeister-Übergabe (aufgabeNachAufgabe, anBetreuerUebergeben): Global-Kunde → Justins Board",
    zaehle(f, "...(globalKunde ? { anBetreiber: true }") === 2 && zaehle(f, "await globalUebergabe(ein.personId)") === 2);
  const a = quelle("server/lib/fiaon-postmeister-agent.ts");
  pruef("Postmeister-Auftrag (systemPrompt): Global-Kunde bekommt GLOBAL_AUFTRAG statt Kreditkarten-Auftrag",
    a.includes("ein.akte?.global ? GLOBAL_AUFTRAG") && a.includes("if (ein.ruhe || ein.akte?.global) return ``;"));
  const w = quelle("server/lib/fiaon-postmeister-werkzeuge.ts");
  pruef("Postmeister-Werkzeuge: Zahlungsseite und Rechnung fragen privatReferenzBeiGlobal (2 Stellen)",
    zaehle(w, "await privatReferenzBeiGlobal(k, z)") === 2);
  pruef("Postmeister-Werkzeuge: Auskunft-Meldung fragt FIAON Global zuerst",
    vorher(rumpf(w, "export async function auskunftBetreuerMelden("), "if (await istGlobalVorgang(k))", "const service ="));
}
{
  const f = quelle("server/routes/fiaon-kartei.ts");
  pruef("Offene Kartei: Übernahme (claimApp/claimLead) mit denselben Global-Bedingungen",
    rumpf(f, "async function claimApp(").includes("OHNE_GLOBAL_APP_SQL") && rumpf(f, "async function claimLead(").includes("OHNE_GLOBAL_LEAD_SQL"));
}

{
  // E-283 (05.10.2026): Das Limit-Gespräch ist ein Privat-Ablauf (Pakete Pro, Ultra, High-End,
  // gebucht im Kundenbereich). Die Regel steht in der Tatsachen-Sammlung VOR der reinen Regel —
  // dort wird ein Global-Kunde zu „global“ (nie buchbar), und die Buchung fragt denselben Anspruch.
  // Bewusst NICHT in fiaon-termine.ts (der Termin-Kern fragt die Regel nicht, Teil 3).
  const f = quelle("server/lib/fiaon-limit-gespraech.ts");
  const anspruch = rumpf(f, "export async function limitAnspruchFuer(");
  pruef("Limit-Gespräch (limitAnspruchFuer): istGlobalKunde vor der Regel, das Ergebnis geht als globalKunde hinein",
    vorher(anspruch, "istGlobalKunde(personId, lauf)", "limitAnspruchAus(") && zaehle(anspruch, "globalKunde,") >= 2);
  pruef("… die Buchung (limitBuchen) prüft diesen Anspruch vor kundenBuchungAusfuehren",
    vorher(rumpf(f, "export async function limitBuchen("), "limitAnspruchFuer(ref)", "kundenBuchungAusfuehren("));
  // Rotprobe im Quelltext: ohne die Abfrage muss die Zeile fallen.
  const ohne = rumpf(f.replace("await istGlobalKunde(personId, lauf)", "false"), "export async function limitAnspruchFuer(");
  pruef("… Rotprobe im Quelltext: ohne istGlobalKunde fällt die Zeile", !vorher(ohne, "istGlobalKunde(personId, lauf)", "limitAnspruchAus("));
}

// ═══════════════════════════════════════════════════════════════════════════
// TEIL 3 — TERMIN-ERINNERUNG UND GLOBAL BLEIBEN FREI
// ═══════════════════════════════════════════════════════════════════════════
titel("3 · TERMIN UND GLOBAL BLEIBEN FREI");
try {
  pruef("WhatsApp-Tür: Termin-Erinnerung „fiaon_kk_termin_morgen“ an den Global-Kunden frei",
    (await wa.waVorlagenSperre("fiaon_kk_termin_morgen", TEL("G"), { personId: I.G })) === null);
  pruef("WhatsApp-Tür: Bildfassung „fiaon_kkb_termin_morgen“ frei",
    (await wa.waVorlagenSperre("fiaon_kkb_termin_morgen", TEL("G"), { personId: I.G })) === null);
  pruef("WhatsApp-Tür: Monatsrate „fiaon_kk_rate“ frei (Pflichtpost)",
    (await wa.waVorlagenSperre("fiaon_kk_rate", TEL("G"), { personId: I.G })) === null);
  pruef("WhatsApp-Tür: Vorlage außerhalb der Privatlinie frei", (await wa.waVorlagenSperre("hello_world", TEL("G"), { personId: I.G })) === null);
} catch (e) {
  pruef("WhatsApp-Tür lief ohne Ausnahme", false, String((e as Error)?.message || e).slice(0, 300));
}
{
  const f = quelle("server/make-webhook.ts");
  const block = f.slice(f.indexOf("const PRIVATLINIE_PERSON = new Set<string>(["));
  const liste = block.slice(0, block.indexOf("]);"));
  const namen = [...liste.matchAll(/"([a-z0-9_]+)"/g)].map((m) => m[1]);
  pruef("Mail-Tür: PRIVATLINIE_PERSON gelesen (≥ 15 Ereignisse)", namen.length >= 15, namen.length);
  pruef("Mail-Tür: keine termin_* und keine global_* darin (Termin-Pflicht, Global-Mails)",
    !namen.some((n) => n.startsWith("termin_") || n.startsWith("global_")), namen.filter((n) => /^(termin|global)_/.test(n)));
  const pflicht = namen.filter((n) => mf.PFLICHTMAILS.has(n));
  pruef("Mail-Tür: keine Pflichtmail darin (PFLICHTMAILS)", pflicht.length === 0, pflicht);
  const zahlungspost = ["abo_payment_reminder", "auskunft_zahlung_erinnerung", "global_zahlung_erinnerung"].filter((n) => namen.includes(n));
  pruef("Mail-Tür: keine Zahlungspost darin", zahlungspost.length === 0, zahlungspost);
  pruef("Mail-Tür: Werbung und Mahnung der Privatlinie darin (payment_reminder, antrag_erinnerung, rueckhol_s1, konto_karte_einladung, nicht_erreicht_termin, lead_followup)",
    ["payment_reminder", "antrag_erinnerung", "rueckhol_s1", "konto_karte_einladung", "nicht_erreicht_termin", "lead_followup"].every((n) => namen.includes(n)));
  const tuerRumpf = rumpf(f, "export async function sendMakeWebhookMitGrund(");
  pruef("Mail-Tür: die Wand steht VOR dem Versand (webhookRoh/Direktweg)",
    vorher(tuerRumpf, "PRIVATLINIE_PERSON.has(eventType)", "webhookRoh(eventType"));
  const termine = quelle("server/routes/fiaon-followup.ts");
  const erinnerung = rumpf(termine, "export async function runTerminErinnerungen(");
  pruef("Termin-Erinnerungen (runTerminErinnerungen): fragen die Regel nicht", erinnerung.length > 0 && !/globalKunde|istGlobalKunde/.test(erinnerung));
  pruef("Termin-Absagen: Mara-Termin und Termin-Kern fragen die Regel nicht",
    !/fiaon-global-kunde|globalKundeSql|istGlobalKunde/.test(quelle("server/lib/fiaon-mara-termin.ts") + quelle("server/lib/fiaon-termine.ts")));
  const storno = rumpf(quelle("server/lib/fiaon-telefonkartei.ts"), "export async function stornieren(");
  pruef("Telefonkartei-Storno: sagt nie einen Termin zu FIAON Global ab (quelle „global“, beim Global-Kunden auch „gruender“)",
    storno.includes("AND NOT (COALESCE(quelle, '') = 'global' OR (${globalKunde} AND quelle = 'gruender'))"));
  // Global-Abläufe dürfen NIE gebremst werden: keine Datei der Business-Linie fragt die Regel.
  const globalDateien = [
    ...readdirSync(join(WURZEL, "server/lib")).filter((d) => /^fiaon-global-.*\.ts$/.test(d) && d !== "fiaon-global-kunde.ts").map((d) => `server/lib/${d}`),
    ...readdirSync(join(WURZEL, "server/routes")).filter((d) => /^fiaon-global.*\.ts$/.test(d)).map((d) => `server/routes/${d}`),
    ...readdirSync(join(WURZEL, "server/mail/vorlagen")).filter((d) => /^global/.test(d)).map((d) => `server/mail/vorlagen/${d}`),
    "server/mail/motor.ts",
  ];
  const bremsen = globalDateien.filter((d) => /fiaon-global-kunde|globalKundeSql|istGlobalKunde|globalKundeWa|personenSindGlobalKunde/.test(quelle(d)));
  pruef(`Global-Abläufe ungebremst: keine der ${globalDateien.length} Dateien der Business-Linie fragt die Regel`, bremsen.length === 0, bremsen);
  const gm = rumpf(quelle("server/lib/fiaon-global-auftrag.ts"), "export async function globalMailSenden(");
  pruef("Global-Mails gehen am Motor direkt raus (globalMailSenden → mailDirektSenden), nicht durch die Make-Tür",
    gm.includes("mailDirektSenden") && !gm.includes("sendMakeWebhook"));
}

// ═══════════════════════════════════════════════════════════════════════════
// ABSCHLUSS
// ═══════════════════════════════════════════════════════════════════════════
titel("ABSCHLUSS");
pruef("kein Netz angefasst (kein fetch)", netz.length === 0, netz.slice(0, 5));
await aufraeumen().catch((e) => pruef("aufgeräumt", false, String(e)));
const [rest] = (await sqlPool`
  SELECT (SELECT COUNT(*) FROM fiaon_persons WHERE id = ANY(${ALLE}))::int AS p,
         (SELECT COUNT(*) FROM fiaon_applications WHERE ref LIKE 'FIAON-E272P-%')::int AS a,
         (SELECT COUNT(*) FROM fiaon_global_angebote WHERE angebot_ref LIKE 'FIAON-IA-E272P-%')::int AS g,
         (SELECT COUNT(*) FROM fiaon_leads WHERE id = ANY(${ALLE}))::int AS l,
         (SELECT COUNT(*) FROM fiaon_agents WHERE id = ANY(${AGENTEN}))::int AS m`) as any[];
pruef("aufgeräumt: keine Testzeile bleibt liegen", rest.p + rest.a + rest.g + rest.l + rest.m === 0, rest);
await sqlPool.end({ timeout: 5 }).catch(() => {});

console.log(`\n${bestanden}/${gesamt} bestanden${ROT ? " (ROTPROBE)" : ""}`);
if (rot.length) {
  console.log(`\nROT (${rot.length}):`);
  for (const r of rot) console.log(`  · ${r}`);
}
if (ROT) console.log(rot.length ? "\nROTPROBE ERFÜLLT: Ohne die Regel wird der Prüfstand rot." : "\nROTPROBE GESCHEITERT: Ohne die Regel blieb alles grün — der Prüfstand prüft die Regel nicht.");
process.exit(rot.length === 0 ? 0 : 1);
