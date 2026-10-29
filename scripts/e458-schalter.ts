// ═══════════════════════════════════════════════════════════════════════════
// E-458 „go Plan“ — die Schalter des B2B-Fokus in EINEM Lauf (29.10.2026)
//
// Justin (29.10.2026): „WhatsApp nur noch beantworten statt rausschicken … ARAS telefoniert nur noch die Termine oder die
// Leute, die einen Anruf wollen“ und danach „go Plan“ (Plan E-458 §10: Nr. 3 WhatsApp nur antworten — auch Monatsrate und
// Sofort-Begrüßung, Nr. 4 Mara-Aktion nur Stufe A, Nr. 8 ARAS nur Termin, Nr. 9 Vorlagen ohne KI leiser).
//
// Jeder Schalter geht über den Weg, den auch sein Knopf im Chefbüro nimmt: das Register (einstellungSetzen), die Mara-Aktion,
// der ARAS-Plan, die WhatsApp-Zentrale (automatikSetzen) — nur wo der Knopf selbst ein einfaches Upsert ist (Lead-Motor,
// Mailwerk, Leitstand Rückholung), schreibt das Skript dasselbe Upsert.
//
// Vorgabe: NUR VORSCHAU — die Verbindung ist dann „nur lesen“. Geschrieben wird mit --schreiben (lokal) bzw.
// --schreiben --produktion. Wiederholbar: ein zweiter Lauf findet alles gesetzt.
// Reihenfolge ist Absicht: ZUERST die Lead-WhatsApp-Kette aus — sonst wacht sie wieder auf, sobald die Zentrale aus ist.
// An bleiben: „WhatsApp-Antworten“ (mara_wa_an) und „Nach dem Ja zum Anruf fragen“ (mara_wa_ja_frage).
//
// Aufruf (Vorschau gegen die Produktion, ohne die Adresse auszugeben):
//   sh ~/Developer/it-rettung/werkzeuge/ro-env.sh node_modules/.bin/tsx scripts/e458-schalter.ts --produktion
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
if (schreiben && lokal && !/^fiaon_pruefstand_/.test(dbName)) abbruch(`Lokal schreibt das Skript nur in eine Prüf-DB (fiaon_pruefstand_…), nicht in „${dbName}“.`);
// Ein Schalter verschickt nichts — die Wege werden trotzdem abgeklemmt.
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "WHATSAPP_TOKEN", "META_ACCESS_TOKEN"]) delete process.env[k];
process.env.CRONS = "aus";
globalThis.fetch = (async () => { throw new Error("Schalter-Skript: kein Netz"); }) as typeof fetch;
if (!schreiben && !/[?&]default_transaction_read_only=/.test(url)) {
  url += `${url.includes("?") ? "&" : "?"}default_transaction_read_only=on`;
  process.env.DATABASE_URL = url;
}

const { sqlPool } = await import("../server/lib/db-pool");
const KI = await import("../server/lib/fiaon-ki-einstellungen");
const REG = await import("../shared/fiaon-ki-schalter");
const AKTION = await import("../server/lib/fiaon-mara-aktion");
const ZENTRALE = await import("../server/lib/fiaon-wa-zentrale");
const LEAD_WA = await import("../server/lib/fiaon-lead-whatsapp");

const VON = "E-458 go Plan (Justin 29.10.2026, Skript e458-schalter)";
const lesen = async (k: string): Promise<string | null> => {
  const [z] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${k}`) as any[];
  return z?.value == null ? null : String(z.value);
};
const upsert = async (k: string, wert: string) => {
  await sqlPool`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${k}, ${wert}, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
};
/** Registerwert mit Vorgabe, wie ihn die Leser sehen. */
const registerWert = async (k: string): Promise<string> => (await lesen(k)) ?? String(REG.registerEintrag(k)?.vorgabe ?? "");

/** Die ARAS-Spielarten ({ art: "an" | "aus" }): Willkommen und Rate aus, Termin an — alle anderen Arten unverändert. */
function nurTermin(roh: string): string {
  const x = JSON.parse(roh);
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new Error(`aras_spielarten hat eine unbekannte Form: ${String(roh).slice(0, 80)}`);
  return JSON.stringify({ ...x, termin: "an", willkommen: "aus", rate: "aus" });
}

type Schritt = { schluessel: string; was: string; jetzt: () => Promise<string>; ziel: (jetzt: string) => string; setzen: (wert: string) => Promise<void> };

/** Ein Registerschlüssel: zuerst der Register-Weg; ist der Setzer ein eigener Knopf (409), dessen Upsert mit geprüftem Wert. */
const registerSetzen = (k: string) => async (wert: string) => {
  const r = await KI.einstellungSetzen(k, wert, VON);
  if (r.ok) return;
  if ((r as any).status !== 409) throw new Error(`${k}: ${(r as any).fehler}`);
  const e = REG.registerEintrag(k);
  if (!e) throw new Error(`${k}: nicht im Register`);
  const p = REG.wertPruefen(e, wert);
  if (!p.ok) throw new Error(`${k}: ${p.fehler}`);
  await upsert(k, p.wert);
  console.log(`[KI-EINSTELLUNG] ${k} = ${p.wert} (${VON}, Weg des Knopfs)`);
};

const SCHRITTE: Schritt[] = [
  { schluessel: LEAD_WA.SCHALTER, was: "Lead-WhatsApp: Sofort-Begrüßung und Kette aus (ZUERST)",
    jetzt: async () => (await lesen(LEAD_WA.SCHALTER)) ?? "aus", ziel: () => "aus",
    setzen: async (w) => { await upsert(LEAD_WA.SCHALTER, w); console.log(`[LEAD-WA] Kette AUS (${VON}).`); } },
  { schluessel: "wa_zentrale_automatik", was: "WhatsApp-Zentrale: Automatik aus (auch Monatsraten-WhatsApp)",
    jetzt: async () => ((await ZENTRALE.automatik()).an ? "an" : "aus"), ziel: () => "aus",
    setzen: async () => { const r = await ZENTRALE.automatikSetzen({ an: false }, VON); if (!r.ok) throw new Error(`Zentrale: ${(r as any).grund}`); } },
  { schluessel: "mara_wa_nachfass", was: "WhatsApp-Nachfassen aus",
    jetzt: () => registerWert("mara_wa_nachfass"), ziel: () => "aus", setzen: registerSetzen("mara_wa_nachfass") },
  { schluessel: "auskunft_verkauf_wa_pro_tag", was: "Auskunft: WhatsApp je Tag auf 0",
    jetzt: () => registerWert("auskunft_verkauf_wa_pro_tag"), ziel: () => "0", setzen: registerSetzen("auskunft_verkauf_wa_pro_tag") },
  { schluessel: "mara_aktion_stufen", was: "Mara-Aktion nur Stufe A (Klärung „habe bezahlt“)",
    jetzt: async () => (await AKTION.einstellungenLesen()).stufen.join(","), ziel: () => "A",
    setzen: async (w) => { await AKTION.einstellungSetzen("mara_aktion_stufen", w); console.log(`[MARA-AKTION] Stufen = ${w} (${VON}).`); } },
  { schluessel: "aras_spielarten", was: "ARAS: Willkommen und Rate aus, Termin an (Stufe bleibt 0)",
    jetzt: async () => { const w = await registerWert("aras_spielarten"); try { return JSON.stringify(JSON.parse(w)); } catch { return w; } },
    ziel: (j) => nurTermin(j),
    setzen: async (w) => { const PLAN = await import("../server/lib/fiaon-aras-plan"); await PLAN.einstellungSetzen("aras_spielarten", w, VON); console.log(`[ARAS] Spielarten = ${w} (${VON}).`); } },
  { schluessel: "auskunft_verkauf_mails_pro_tag", was: "Auskunft-Mails je Tag: 500 → 150",
    jetzt: () => registerWert("auskunft_verkauf_mails_pro_tag"), ziel: () => "150", setzen: registerSetzen("auskunft_verkauf_mails_pro_tag") },
  { schluessel: "rueckhol_s5_an", was: "Rückholung: Dauerpflege (S5) aus",
    jetzt: () => registerWert("rueckhol_s5_an"), ziel: () => "0", setzen: registerSetzen("rueckhol_s5_an") },
  { schluessel: "lead_followup_enabled", was: "Lead-Strecke (Mail-Kette an Leads ohne Antrag) aus",
    jetzt: async () => (await lesen("lead_followup_enabled")) ?? "1", ziel: () => "0",
    setzen: async (w) => { await upsert("lead_followup_enabled", w); console.log(`[MAILWERK] lead_followup_enabled = ${w} (${VON}).`); } },
  { schluessel: "max_reminders", was: "Mahnungen je Bestellung höchstens 6 (statt unbegrenzt)",
    jetzt: async () => (await lesen("max_reminders")) ?? "0", ziel: () => "6",
    setzen: async (w) => { await upsert("max_reminders", w); console.log(`[LEITSTAND] max_reminders = ${w} (${VON}).`); } },
];

console.log(`E-458 Schalter · Datenbank ${produktion ? "PRODUKTION" : "lokal"} · ${schreiben ? "SCHREIBT" : "nur Vorschau (Verbindung nur lesend)"}`);
const zaehler = { neu: 0, schon: 0, fehler: 0 };
for (const s of SCHRITTE) {
  try {
    const jetzt = await s.jetzt();
    const ziel = s.ziel(jetzt);
    if (jetzt === ziel) { zaehler.schon++; console.log(`  [schon da] ${s.was} — ${s.schluessel} = ${jetzt}`); continue; }
    if (schreiben) await s.setzen(ziel);
    zaehler.neu++;
    console.log(`  ${schreiben ? "[erledigt]" : "[neu]     "} ${s.was} — ${s.schluessel}: ${jetzt} → ${ziel}`);
  } catch (e) {
    zaehler.fehler++;
    console.log(`  [FEHLER]   ${s.was} — ${s.schluessel}: ${e instanceof Error ? e.message : e}`);
    if (schreiben) break; // Reihenfolge ist Absicht: nach einem Fehler nicht weiter schalten.
  }
}
console.log(`ERGEBNIS ${JSON.stringify({ geschrieben: schreiben, ...zaehler })}`);
await sqlPool.end?.().catch(() => {});
process.exit(zaehler.fehler ? 1 : 0);
