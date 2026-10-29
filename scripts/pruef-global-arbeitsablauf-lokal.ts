// ═══════════════════════════════════════════════════════════════════════════
// PRAXIS-PRÜFSTAND MIT DATENBANK: E-462 — ARBEITSABLAUF JE GLOBAL-KUNDE (29.10.2026)
//
// Fährt die ECHTEN Server-Funktionen gegen eine LOKALE Kopie des Prüfstands:
//   A  Spalte arbeitsablauf_haken entsteht über ensureGlobalMandat (ADD COLUMN IF NOT EXISTS), Chef-Sicht liefert {}
//   B  Abhaken → jsonb-Objekt (nicht doppelt verpackt), am/von, interne Verlaufszeile; doppelt → keine zweite Zeile
//   C  Falsche Schlüssel (Station-Schritt, Unsinn) → 400; unbekannter Auftrag → 404
//   D  Wieder öffnen → Schlüssel weg, Verlaufszeile; Stand aus der Chef-Sicht (ablaufStand) stimmt; keine Mail, kein Netz
//
// NIE GEGEN DIE PRODUKTION: läuft nur gegen 127.0.0.1 und eine Datenbank „fiaon_pruefstand_e462…“, ohne Schlüssel.
//   B=/opt/homebrew/opt/postgresql@18/bin
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand fiaon_pruefstand_e462
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e462 node_modules/.bin/tsx scripts/pruef-global-arbeitsablauf-lokal.ts
// ═══════════════════════════════════════════════════════════════════════════
const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_e462/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen die lokale Kopie fiaon_pruefstand_e462 auf 127.0.0.1.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(2); }
}
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const { sqlPool } = await import("../server/lib/db-pool");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const M: any = await import("../server/lib/fiaon-global-mandat");
const { ablaufStand } = await import("../shared/fiaon-global-arbeitsablauf");

let gut = 0; const rot: string[] = [];
const ok = (bed: boolean, text: string, fund?: unknown) => {
  if (bed) { gut++; console.log(`  ok    ${text}`); } else { rot.push(text); console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${JSON.stringify(fund).slice(0, 500)}` : ""}`); }
};

const stempel = Date.now().toString(36).toUpperCase();
const REF = `FIAON-E462-${stempel}-1`;
const MAIL = `ablauf-${stempel.toLowerCase()}@pruefmuster.example`;
const CHEF = { id: 928, name: "Prüf-Leitung" };

await A.ensureGlobalTabelle();
console.log("\n── A  Spalte + Chef-Sicht");
const vorher = (await sqlPool`SELECT 1 FROM information_schema.columns WHERE table_name = 'fiaon_global_auftraege' AND column_name = 'arbeitsablauf_haken'`) as any[];
console.log(`  (Spalte vorher ${vorher.length ? "schon da" : "noch nicht da"})`);
await M.ensureGlobalMandat();
const spalte = (await sqlPool`SELECT data_type FROM information_schema.columns WHERE table_name = 'fiaon_global_auftraege' AND column_name = 'arbeitsablauf_haken'`) as any[];
ok(spalte[0]?.data_type === "jsonb", "Spalte arbeitsablauf_haken ist jsonb", spalte);

await sqlPool`
  INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, paid_at, completed_at, amount_due, contact_name, contact_email, email, created_at)
  VALUES (${REF}, 'privat', 'submitted', 'global_individuell', 'Prüfstand', ${"PAY-" + REF}, 'paid', NOW(), NOW(), 100, 'Anna Prüfmann', ${MAIL}, ${MAIL}, NOW())`;
await sqlPool`
  INSERT INTO fiaon_global_auftraege
    (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email, rechnung_ust_modus, created_at, gesellschaft)
  VALUES (${REF}, 'global_individuell', 'DE',
    ${sqlPool.json({ art: "privat", name: "Anna Prüfmann", strasse: "Prüfweg 1", plz: "12345", ort: "Musterstadt", land: "DE" } as any)},
    ${sqlPool.json({ anrede: "Frau", vorname: "Anna", nachname: "Prüfmann", funktion: "", email: MAIL, telefon: "+49301234567" } as any)},
    ${sqlPool.json({ annahme: "Auftrag zahlungspflichtig erteilen" } as any)}, 'PRUEF', 'de', NOW(), 'individualangebot', 'gestartet', 'Anna Prüfmann', ${MAIL}, 'none', NOW(),
    ${sqlPool.json({ name: "PRUEFMUSTER LLC", form: "llc", bundesstaat: "FL" } as any)})`;
const mailsVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE lower(empfaenger) = ${MAIL}`) as any[])[0].n);

let c: any = await M.globalMandatChefSicht(REF);
ok(c && typeof c.arbeitsablaufHaken === "object" && Object.keys(c.arbeitsablaufHaken).length === 0, "Chef-Sicht: arbeitsablaufHaken = {}", c?.arbeitsablaufHaken);
ok(c?.gesellschaft?.name === "PRUEFMUSTER LLC" && c?.gesellschaft?.bundesstaatName === "Florida", "Chef-Sicht trägt Name + Bundesstaat für die Werte", c?.gesellschaft);
ok(c?.kontakt?.nachname === "Prüfmann" && !!c?.kontaktVorschlag?.adresse, "Chef-Sicht trägt Kontakt + Wohnadresse", { k: c?.kontakt, v: c?.kontaktVorschlag });

console.log("\n── B  Abhaken");
const r1 = await M.globalArbeitsablaufHaken(REF, { schritt: "s04_bestellen", erledigt: true }, CHEF);
ok(r1.ok && r1.haken?.s04_bestellen?.von === "Prüf-Leitung" && !!r1.haken?.s04_bestellen?.am, "Abhaken → am/von zurück", r1);
const [roh] = (await sqlPool`SELECT jsonb_typeof(arbeitsablauf_haken) AS t, arbeitsablauf_haken->'s04_bestellen'->>'von' AS von FROM fiaon_global_auftraege WHERE ref = ${REF}`) as any[];
ok(roh?.t === "object" && roh?.von === "Prüf-Leitung", "In der DB ein jsonb-Objekt (nicht doppelt verpackt)", roh);
const r2 = await M.globalArbeitsablaufHaken(REF, { schritt: "v_einverstanden", erledigt: true }, CHEF);
ok(r2.ok && Object.keys(r2.haken).length === 2, "Zweiter Haken kommt dazu, erster bleibt", r2.haken);
const r3 = await M.globalArbeitsablaufHaken(REF, { schritt: "s04_bestellen", erledigt: true }, CHEF);
ok(r3.ok && /schon/.test(r3.meldung), "Noch einmal abhaken → „War schon abgehakt“", r3);
const zeilen = async () => (await sqlPool`SELECT text, sichtbar FROM fiaon_global_verlauf WHERE ref = ${REF} AND art = 'arbeitsablauf' ORDER BY id`) as any[];
let v = await zeilen();
ok(v.length === 2 && v.every((z) => z.sichtbar === false) && /Schritt 4 „Neue Firma anlegen“ abgehakt \(Prüf-Leitung\)/.test(v[0].text), "Zwei interne Verlaufszeilen mit wer", v);

console.log("\n── C  Abweisen");
const f1 = await M.globalArbeitsablaufHaken(REF, { schritt: "s03_name", erledigt: true }, CHEF);
ok(!f1.ok && f1.status === 400, "Station-Schritt von Hand → 400", f1);
const f2 = await M.globalArbeitsablaufHaken(REF, { schritt: "__proto__", erledigt: true }, CHEF);
ok(!f2.ok && f2.status === 400, "Unsinn → 400", f2);
const f3 = await M.globalArbeitsablaufHaken(`FIAON-E462-${stempel}-GIBTSNICHT`, { schritt: "s04_bestellen", erledigt: true }, CHEF);
ok(!f3.ok && f3.status === 404, "Unbekannter Auftrag → 404", f3);

console.log("\n── D  Wieder öffnen + Stand");
const r4 = await M.globalArbeitsablaufHaken(REF, { schritt: "s04_bestellen", erledigt: false }, CHEF);
ok(r4.ok && !r4.haken.s04_bestellen && !!r4.haken.v_einverstanden, "Wieder öffnen → Schlüssel weg, anderer bleibt", r4.haken);
v = await zeilen();
ok(v.length === 3 && /wieder geöffnet/.test(v[2].text), "Verlaufszeile „wieder geöffnet“", v.map((z) => z.text));
await M.globalSchrittSetzen(REF, { schluessel: "name", status: "erledigt" }, CHEF);
c = await M.globalMandatChefSicht(REF);
const st = ablaufStand({ status: c.status, bezahltAm: c.bezahltAm, schritte: c.schritte, plus: c.gesellschaftPlus, dokumentArten: c.dokumente.map((d: any) => d.art), haken: c.arbeitsablaufHaken });
ok(st.schritte.find((s) => s.key === "s03_name")?.zustand === "erledigt", "Station „Name geprüft“ → Schritt 3 erledigt (automatisch)", st.schritte[2]);
ok(st.schritte[0].zustand === "erledigt", "Zahlung bezahlt → Schritt 1 erledigt", st.schritte[0]);
ok(st.vorab.v_einverstanden.da && !st.vorab.v_taetigkeit.da && st.schritte.find((s) => s.key === "s07_ein_formular")?.zustand === "wartet", "EIN-Formular wartet auf die Tätigkeit", st.vorab);
ok(st.erledigt === 2 && st.naechster === "s02_akte", "2 von 20, nächster = Schritt 2", { e: st.erledigt, n: st.naechster });
const mailsNach = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE lower(empfaenger) = ${MAIL}`) as any[])[0].n);
ok(mailsNach === mailsVorher, "Keine Mail an den Kunden", { mailsVorher, mailsNach });
ok(netz.length === 0, "Kein Netzaufruf", netz);

console.log(`\nERGEBNIS pruef-global-arbeitsablauf-lokal: ${gut} grün, ${rot.length} rot`);
await sqlPool.end({ timeout: 2 }).catch(() => {});
process.exit(rot.length ? 1 : 0);
