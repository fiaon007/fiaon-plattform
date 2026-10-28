// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: STATIONEN-EDITOR DES GLOBAL-FAHRPLANS (22.10.2026)
//
// Rein — keine Datenbank, kein Netz. Prüft:
//   1  FAHRPLAN    D-U-N-S nach dem Konto, vor den Karten; Status „beantragt“; jede Station mit Feldern bekannt
//   2  FORMATE     EIN, ITIN (IRS-Gruppen), D-U-N-S, US-Telefon E.164 — gut und schlecht
//   3  PRÜFUNG     stationWertePruefen: fremde Felder, Zukunft, Leeren, Grund vs. plus, Anbietername
//   4  KUNDENSICHT globalPlusFuerKunde: keine verschlüsselte ITIN, kein Institut, kein Anbieter; Maske
//   5  ITIN        encryptSecret/decryptSecret: Rundweg, nie Klartext im JSON
//   6  WORTWAHL    Verlauf- und Anzeigesätze de/en durch die Wände
//   7  VERDRAHTUNG Migration 123 = Laufzeit, Routen (Chef, Office, Kunde), Portal zeigt Werte, Kapital für Kunden
//   8  GEGENPROBE  jede Wand schlägt an
//
//   env -i HOME=$HOME PATH=$PATH npx tsx scripts/pruef-global-stationen.ts     (Exit 1 bei ROT)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const S = await import("../shared/fiaon-global-stationen");
const M = await import("../shared/fiaon-global-mandat");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { GLOBAL_SCHAERFER, globalWortPruefenEn } = await import("../shared/fiaon-global-wortregeln");

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);
const HEUTE = "2026-10-22";

// ═══ 1 FAHRPLAN ═══════════════════════════════════════════════════════════════
abschnitt("1 Fahrplan");
const keys = M.GLOBAL_FAHRPLAN.map((s) => s.schluessel);
ok(keys.includes("duns") && keys.indexOf("duns") === keys.indexOf("konto") + 1 && keys.indexOf("duns") < keys.indexOf("karte_1"), "D-U-N-S steht nach dem Konto, vor den Karten", keys.join(","));
ok(new Set(keys).size === keys.length, "kein Schlüssel doppelt");
gleich(M.GLOBAL_SCHRITT_STATUS, ["offen", "in_arbeit", "beantragt", "erledigt", "entfaellt"], "Status inkl. „beantragt“");
ok(M.globalSchrittStatus("beantragt") === "beantragt" && M.globalSchrittStatus("quatsch") === null, "globalSchrittStatus kennt „beantragt“, sonst null");
for (const k of Object.keys(S.GLOBAL_STATION_FELDER)) ok(keys.includes(k), `Felder gehören zu einer echten Station: ${k}`);
for (const k of Object.keys(S.GLOBAL_STATION_KAPITAL)) ok(keys.includes(k), `Kapital-Station existiert: ${k}`);
for (const k of ["eingetragen", "agent", "adresse", "ein", "itin", "konto", "duns"]) ok((S.GLOBAL_STATION_FELDER[k] ?? []).length > 0, `${k}: hat eigene Felder`);
for (const [k, art] of Object.entries(S.GLOBAL_STATION_DOKUMENT)) ok(keys.includes(k) && /^[a-z_]+$/.test(art), `Dokument zur Station ${k}: ${art}`);
const alleFelder = Object.values(S.GLOBAL_STATION_FELDER).flat();
gleich(alleFelder.filter((f) => f.intern).map((f) => f.feld).sort(), ["kontaktAdresse", "kontaktEmail", "kontaktRolle", "kontaktTelefon", "kontoInstitut", "registeredAgent"], "intern: Kontoinstitut, Anbieter des Agents und die vertraulichen Angaben der Kontaktperson");
for (const f of ["kontaktAdresse", "kontaktEmail", "kontaktTelefon", "kontaktRolle"]) ok(!(S.GLOBAL_PLUS_KUNDE as readonly string[]).includes(f), `E-424: ${f} geht nie ans Portal (vertraulich)`);

// ═══ 2 FORMATE ═══════════════════════════════════════════════════════════════
abschnitt("2 Formate");
gleich(S.stationEin("123456789"), "12-3456789", "EIN aus neun Ziffern");
gleich(S.stationEin(" 12-3456789 "), "12-3456789", "EIN mit Strich");
for (const x of ["12345678", "1234567890", "00-1234567", "", "ab-cdefghi"]) ok(S.stationEin(x) === null, `EIN abgelehnt: „${x}“`);
gleich(S.stationItin("912-70-1234"), "912-70-1234", "ITIN 9XX-70-XXXX");
gleich(S.stationItin("900501234"), "900-50-1234", "ITIN ohne Striche");
for (const g of ["50", "65", "70", "88", "90", "92", "94", "99"]) ok(S.stationItin(`912${g}1234`) !== null, `ITIN-Gruppe ${g} erlaubt`);
for (const x of ["812-70-1234", "912-66-1234", "912-89-1234", "912-93-1234", "912-49-1234", "91270123", "9127012345"]) ok(S.stationItin(x) === null, `ITIN abgelehnt: ${x}`);
gleich(S.stationItinMaske("1234"), "•••-••-1234", "Maske aus vier Ziffern");
ok(S.stationItinMaske("123") === null && S.stationItinMaske(null) === null, "Maske nur mit vier Ziffern");
gleich(S.stationDuns("123456789"), "12-345-6789", "D-U-N-S formatiert");
for (const x of ["000000000", "12345678", "1234567890"]) ok(S.stationDuns(x) === null, `D-U-N-S abgelehnt: ${x}`);
gleich(S.stationTelefon("(307) 555-0148"), "+13075550148", "Telefon (307) 555-0148 → E.164");
gleich(S.stationTelefon("+1 307 555 0148"), "+13075550148", "Telefon +1 … → E.164");
gleich(S.stationTelefon("13075550148"), "+13075550148", "Telefon mit 1 vorne");
for (const x of ["+49 30 1234567", "107 555 0148", "307 155 0148", "555-0148"]) ok(S.stationTelefon(x) === null, `Telefon abgelehnt: ${x}`);
gleich(S.stationTelefonText("+13075550148"), "+1 307 555 0148", "Anzeige +1 307 555 0148");

// ═══ 3 PRÜFUNG ═══════════════════════════════════════════════════════════════
abschnitt("3 Prüfung");
const p1 = S.stationWertePruefen("ein", { ein: "123456789", einBriefAm: "2026-09-16" }, HEUTE);
gleich(p1, { ok: true, werte: { grund: {}, plus: { ein: "12-3456789", einBriefAm: "2026-09-16" } } }, "EIN + Datum → plus, formatiert");
ok(!S.stationWertePruefen("ein", { ein: "123" }, HEUTE).ok, "falsche EIN → Fehler");
gleich((S.stationWertePruefen("ein", { ein: "123" }, HEUTE) as any).feld, "ein", "Fehler nennt das Feld");
ok(!S.stationWertePruefen("ein", { einBriefAm: "2026-10-23" }, HEUTE).ok, "Datum in der Zukunft → Fehler");
ok(!S.stationWertePruefen("ein", { einBriefAm: "2027-02-29" }, HEUTE).ok, "kein Kalendertag → Fehler");
ok(!S.stationWertePruefen("ein", { duns: "123456789" }, HEUTE).ok, "fremdes Feld an einer Station → Fehler");
gleich(S.stationWertePruefen("ein", { ein: "" }, HEUTE), { ok: true, werte: { grund: {}, plus: { ein: null } } }, "leer = leeren");
const p2 = S.stationWertePruefen("eingetragen", { name: "  Muster   LLC ", form: "llc", bundesstaat: "wy", gegruendetAm: "2026-09-02", aktenzeichen: "2026-001" }, HEUTE);
gleich(p2, { ok: true, werte: { grund: { name: "Muster LLC", form: "LLC", bundesstaat: "WY", gegruendetAm: "2026-09-02" }, plus: { aktenzeichen: "2026-001" } } }, "Gesellschaft: Grunddaten in grund, File Number in plus");
ok(!S.stationWertePruefen("eingetragen", { form: "GmbH" }, HEUTE).ok && !S.stationWertePruefen("eingetragen", { bundesstaat: "Wyoming" }, HEUTE).ok, "Form und Staat nur aus der Liste");
ok(!S.stationWertePruefen("agent", { agentAdresse: "Northwest Registered Agent\n30 N Gould St\nSheridan, WY 82801" }, HEUTE).ok, "Anbietername in der Adresse → Fehler");
ok(S.stationWertePruefen("agent", { registeredAgent: "Northwest Registered Agent" }, HEUTE).ok, "Anbieter im INTERNEN Feld erlaubt");
gleich(S.stationWertePruefen("agent", { agentAdresse: " 30 N Gould St \r\n\r\n Sheridan,   WY 82801 " }, HEUTE), { ok: true, werte: { grund: {}, plus: { agentAdresse: "30 N Gould St\nSheridan, WY 82801" } } }, "Adresse: Zeilen bleiben, Leerraum fällt");
ok(!S.stationWertePruefen("adresse", { usAdresse: "abc" }, HEUTE).ok, "zu kurze Adresse → Fehler");
gleich(S.stationWertePruefen("itin", { itin: "912 70 1234" }, HEUTE), { ok: true, werte: { grund: {}, plus: { itin: "912-70-1234" } } }, "ITIN formatiert (Klartext nur bis zum Server)");
gleich(S.stationWertePruefen("duns", { duns: "123456789" }, HEUTE), { ok: true, werte: { grund: {}, plus: { duns: "12-345-6789" } } }, "D-U-N-S → plus");
gleich(S.stationWertePruefen("adresse", { usTelefon: "(307) 555-0148" }, HEUTE), { ok: true, werte: { grund: {}, plus: { usTelefon: "+13075550148" } } }, "Telefon → E.164");
gleich(S.stationWertePruefen("operating_agreement", {}, HEUTE), { ok: true, werte: { grund: {}, plus: {} } }, "Station ohne Felder: nichts");

// ═══ 3b KONTAKTPERSON (E-424) UND EIN PER FAX ════════════════════════════════
abschnitt("3b Kontaktperson (E-424) und EIN per Fax");
gleich(S.stationTelefonInt("+41 79 123 45 67"), "+41791234567", "internationale Nummer → E.164");
gleich(S.stationTelefonInt("0041 79 123 45 67"), "+41791234567", "00 statt + erlaubt");
for (const x of ["079 123 45 67", "+0 123", "+1234567", ""]) ok(S.stationTelefonInt(x) === null, `ohne Landesvorwahl/zu kurz abgelehnt: „${x}“`);
gleich(S.stationWertePruefen("agent", { kontaktperson: "Erika Muster", kontaktRolle: "inhaber", kontaktEmail: " Erika@Example.com ", kontaktTelefon: "+41 79 123 45 67" }, HEUTE),
  { ok: true, werte: { grund: {}, plus: { kontaktperson: "Erika Muster", kontaktRolle: "inhaber", kontaktEmail: "erika@example.com", kontaktTelefon: "+41791234567" } } }, "Kontaktperson mit Rolle, E-Mail, Telefon");
ok(!S.stationWertePruefen("agent", { kontaktRolle: "fiaon" }, HEUTE).ok && !S.stationWertePruefen("agent", { kontaktEmail: "kein-at" }, HEUTE).ok, "Rolle nur aus der Liste, E-Mail geprüft");
ok(S.stationKontaktWarnungen("PO Box 12\nZürich", "").length === 1, "Warnung: Postfach");
ok(S.stationKontaktWarnungen("Regus Virtual Office, Bahnhofstr. 1", "").length >= 1, "Warnung: virtuelles Büro");
ok(S.stationKontaktWarnungen("30 N Gould St, Ste R\nSheridan", "30 N Gould St, Ste R\nSheridan, WY 82801").length >= 1, "Warnung: Adresse des Registered Agent");
gleich(S.stationKontaktWarnungen("Seestrasse 4\n8001 Zürich", "30 N Gould St"), [], "eine Wohnanschrift: keine Warnung");
gleich([S.stationStatusName("ein", "in_arbeit"), S.stationStatusName("ein", "beantragt"), S.stationStatusName("ein", "erledigt")], ["SS-4 zur Unterschrift", "Eingereicht (Fax)", "EIN erteilt"], "EIN per Fax: drei eigene Status-Namen");
ok(S.stationStatusName("ein", "offen") === null && S.stationStatusName("itin", "beantragt") === null, "sonst gilt der allgemeine Name");
ok(S.GLOBAL_STATION_UNTERSCHRIFT.ein?.pflichtKey === "irs_ss4", "SS-4 an der EIN ist das Formular irs_ss4");
{
  const g = await import("../shared/fiaon-global");
  ok(/Inhaber/.test(g.GLOBAL_AGENT.de.kontakt) && !/übernehmen wir das für Sie/.test(g.GLOBAL_AGENT.de.kontakt), "Kundensatz aus GLOBAL_AGENT (E-424): der Inhaber, nicht FIAON");
  const portalQuelle = datei("client/src/pages/global-portal.tsx");
  // E-452: der Satz passt zum Bundesstaat — Wyoming (oder ohne Staat) = GLOBAL_AGENT, sonst ohne fremde Rechtslage.
  ok(/globalAgentKontakt\(s, g\.bundesstaat\)/.test(portalQuelle), "Portal zeigt den Kontaktpersonen-Satz aus GLOBAL_AGENT (je Bundesstaat)");
  for (const sp of ["de", "en"] as const) {
    ok(g.globalAgentKontakt(sp, "WY") === g.GLOBAL_AGENT[sp].kontakt && g.globalAgentKontakt(sp, null) === g.GLOBAL_AGENT[sp].kontakt, `${sp}: Wyoming und ohne Staat = Satz aus GLOBAL_AGENT`);
    const fl = g.globalAgentKontakt(sp, "FL");
    ok(!/Wyoming/.test(fl) && (sp === "de" ? /Inhaber/ : /owner/).test(fl), `${sp}: Florida-Gesellschaft — kein „Wyoming verlangt …“, Inhaber bleibt`);
  }
  const libQ = datei("server/lib/fiaon-global-mandat.ts");
  ok(/FROM fiaon_agents WHERE COALESCE\(is_test_account, FALSE\) = FALSE/.test(libQ) && /jemand aus dem FIAON-Team/.test(libQ), "Server lehnt eine Kontaktperson aus dem FIAON-Team ab");
  ok(/stationKontaktWarnungen\(neu\.kontaktAdresse, neu\.agentAdresse\)/.test(libQ) && /export async function globalKontaktVorschlag/.test(libQ), "Server: Warnungen zur Anschrift + Vorschlag aus dem Auftrag");
}

// ═══ 4 KUNDENSICHT ═══════════════════════════════════════════════════════════
abschnitt("4 Kundensicht");
const plus = { aktenzeichen: "2026-001", ein: "12-3456789", itinEnc: "v1:abc:def:ghi", itinEnde: "1234", kontoInstitut: "Bank X", kontoEroeffnetAm: "2026-10-14", registeredAgent: "Northwest", agentAdresse: "30 N Gould St", duns: "12-345-6789", hinweis: "", usTelefon: "+13075550148" };
const k = S.globalPlusFuerKunde(plus as any);
ok(!("itinEnc" in k) && !("itinEnde" in k) && !("kontoInstitut" in k) && !("registeredAgent" in k), "Kunde sieht nie verschlüsselte ITIN, Ende, Institut, Anbieter", JSON.stringify(k));
ok(k.itinMaske === "•••-••-1234" && k.itinVorhanden === true, "Kunde sieht die Maske");
ok(!("hinweis" in k), "leere Felder fallen weg");
ok(k.ein === "12-3456789" && k.duns === "12-345-6789" && k.kontoEroeffnetAm === "2026-10-14", "freigegebene Werte kommen an");
ok(!JSON.stringify(k).includes("v1:"), "kein Schlüsseltext im Kunden-JSON");
const t = S.globalPlusFuerTeam(plus as any);
ok(!("itinEnc" in t) && !("itinEnde" in t) && t.itinMaske === "•••-••-1234" && t.kontoInstitut === "Bank X", "Team: Interna ja, ITIN nur maskiert");
ok(Object.keys(S.globalPlusFuerKunde({ itinEnde: "1234" } as any)).length === 0, "ohne verschlüsselte ITIN keine Maske");
const zeilen = S.stationZeilen("itin", {}, k, "de", (x) => x);
ok(zeilen.length === 1 && zeilen[0].geheim === "itin" && zeilen[0].wert === "•••-••-1234", "Portal-Zeile ITIN: geheim, maskiert");
ok(S.stationZeilen("konto", {}, k, "de", (x) => `T${x}`).every((z) => !/Bank X/.test(z.wert)), "Konto-Zeile ohne Institut");
gleich(S.stationZeilen("adresse", {}, k, "de", (x) => x).map((z) => z.wert), ["+1 307 555 0148"], "Telefon schön formatiert");

// ═══ 5 ITIN VERSCHLÜSSELT ═════════════════════════════════════════════════════
abschnitt("5 ITIN verschlüsselt");
{
  const { encryptSecret, decryptSecret } = await import("../server/routes/fiaon-agent");
  const enc = encryptSecret("912-70-1234");
  ok(enc.startsWith("v1:") && !enc.includes("1234"), "verschlüsselt, kein Klartext", enc.slice(0, 20));
  ok(decryptSecret(enc) === "912-70-1234", "Rundweg");
  ok(encryptSecret("912-70-1234") !== enc, "jedes Mal ein neuer IV");
  ok(decryptSecret("v1:kaputt:kaputt:kaputt") === null, "Kaputtes → null, kein Absturz");
}

// ═══ 6 WORTWAHL ══════════════════════════════════════════════════════════════
abschnitt("6 Wortwahl");
const deTreffer = (x: string) => [...wandPruefen(x, ["aufgabe_an_betreuer"]).map((f) => f.hinweis), ...GLOBAL_SCHAERFER.filter((r) => r.muster.test(x)).map((r) => r.grund)];
for (const [f, paar] of Object.entries(S.GLOBAL_STATION_VERLAUF)) {
  for (const h of deTreffer(paar.de)) ok(false, `Verlauf ${f}/de`, h);
  for (const h of globalWortPruefenEn(paar.en)) ok(false, `Verlauf ${f}/en`, h.hinweis);
  ok(!/\d/.test(paar.de) && !/\d/.test(paar.en), `Verlauf ${f}: kein Wert im Satz`);
}
for (const v of M.GLOBAL_FAHRPLAN) { for (const h of deTreffer(v.text.de)) ok(false, `Fahrplan ${v.schluessel}/de`, h); for (const h of globalWortPruefenEn(v.text.en)) ok(false, `Fahrplan ${v.schluessel}/en`, h.hinweis); }
gleich(S.stationVerlaufSaetze(["itin", "kontoInstitut", "ein"], "de"), ["Ihre ITIN ist da.", "Ihre EIN ist da."], "Verlauf: nur Kundensätze, internes Feld ohne Satz");

// ═══ 7 VERDRAHTUNG ═══════════════════════════════════════════════════════════
abschnitt("7 Verdrahtung");
const mig = datei("db/migrations/123_global_stationen.sql");
const lib = datei("server/lib/fiaon-global-mandat.ts");
ok(/ADD COLUMN IF NOT EXISTS beantragt_am DATE/.test(mig) && /ADD COLUMN IF NOT EXISTS beantragt_am DATE/.test(lib), "beantragt_am: Migration und Laufzeit");
ok(/ADD COLUMN IF NOT EXISTS inhaber TEXT/.test(mig) && /ADD COLUMN IF NOT EXISTS inhaber TEXT/.test(lib), "inhaber: Migration und Laufzeit");
const CHECK = "CHECK (status IN ('offen', 'in_arbeit', 'beantragt', 'erledigt', 'entfaellt'))";
ok(mig.includes(CHECK) && lib.split(CHECK).length >= 3, "Status-Wand gleich in Migration, Tabelle und Tausch");
ok(/pg_get_constraintdef/.test(lib) && /'beantragt'/.test(lib) && /NOT VALID/.test(lib), "Laufzeit tauscht die Wand nur, wenn „beantragt“ fehlt (NOT VALID, ohne Scan)");
const fn = lib.slice(lib.indexOf("export async function globalStationSpeichern"), lib.indexOf("export async function globalItinKlartext"));
ok(fn.indexOf("stationWertePruefen(") > 0 && fn.indexOf("stationWertePruefen(") < fn.indexOf("globalGesellschaftSetzen(") && fn.indexOf("globalGesellschaftSetzen(") < fn.indexOf("UPDATE fiaon_global_auftraege"), "Station: erst prüfen, dann Grunddaten (Fristen), dann Werte");
ok(/encryptSecret\(w\)/.test(fn) && /itinEnde/.test(fn) && !/text: `[^`]*itin[^`]*\$\{w\}/i.test(fn), "ITIN verschlüsselt gespeichert, nie im Verlauf");
ok(/stationVerlaufSaetze\(gesetzt, l\.sprache\)/.test(fn) && /sichtbar: false/.test(fn), "Kundensatz beim ersten Eintragen + interne Zeile");
ok(/l\.status === "storniert"/.test(fn), "Storno-Wand");
const kap = lib.slice(lib.indexOf("async function kapitalLesen"), lib.indexOf("async function nachrichtenLesen"));
ok(/institut: !kunde/.test(kap) && /produkt: !kunde/.test(kap) && /!kunde \|\| z\.status === "zugesagt" \|\| z\.status === "aktiv"/.test(kap), "Kunde: kein Institut, kein Produkt, Betrag erst ab zugesagt");
ok(/gesellschaftPlus: globalPlusFuerKunde\(/.test(lib) && /gesellschaftPlus: globalPlusFuerTeam\(/.test(lib), "Portal bekommt die Kundensicht, Chefbüro die Teamsicht");
const gpSetzen = lib.slice(lib.indexOf("export async function globalGesellschaftPlusSetzen"), lib.indexOf("export async function globalKapitalSpeichern"));
ok(/\.\.\.\(await plusRoh\(ref\)\)/.test(gpSetzen) && /if \(!\(f\.feld in roh\)\) continue;/.test(gpSetzen), "altes Formular überschreibt die Stationswerte nicht");
const chef = datei("server/routes/fiaon-chef-global.ts");
ok(/"\/chef\/global\/mandate\/:ref\/station", requireChef\("leitung"\)/.test(chef) && /"\/chef\/global\/mandate\/:ref\/itin", requireChef\("leitung"\)/.test(chef), "Chef-Routen station + itin");
const bereich = datei("server/routes/fiaon-global-bereich.ts");
for (const r of ["/agent/global/auftraege/:ref/stationen", "/agent/global/auftraege/:ref/station", "/agent/global/auftraege/:ref/itin", "/agent/global/auftraege/:ref/kapital"]) ok(bereich.includes(`"${r}", requireAgent`), `Office-Route ${r}`);
const kItin = bereich.slice(bereich.indexOf('router.post("/global/mein-auftrag/:ref/itin"'));
ok(kItin.indexOf("zutritt(req, res)") > 0 && kItin.indexOf("zutritt(req, res)") < kItin.indexOf("itinJeRef(") && kItin.indexOf("itinJeRef(") < kItin.indexOf("globalItinKlartext("), "Kunde: Token → Drossel → Klartext");
ok(/globalPortalNeuFrei/.test(kItin.slice(0, kItin.indexOf("globalItinKlartext("))) && /no-store/.test(kItin.slice(0, 600)), "Kunde: nur im freigeschalteten Portal, nie zwischengespeichert");
const portal = datei("client/src/pages/global-portal.tsx");
ok(/stationZeilen\(/.test(portal) && /data-fiaon="itin-anzeigen"/.test(portal) && /mitToken\("\/itin"\)/.test(portal), "Portal: Werte unter Stationen, ITIN „Anzeigen“");
ok(!/itinEnc|kontoInstitut/.test(portal), "Portal liest nie verschlüsselte ITIN oder Institut");
ok(/seite === "gesellschaft"/.test(portal) && /seite === "adressen"/.test(portal), "Portal: Seiten „Ihre Gesellschaft“ und „Nummer & Adressen“");
const ed = datei("client/src/components/global/GlobalStationen.tsx");
ok(/stationWertePruefen\(/.test(ed) && /`\$\{basis\}\/station`/.test(ed) && /`\$\{basis\}\/itin`/.test(ed) && /`\$\{basis\}\/kapital`/.test(ed), "Editor: prüft wie der Server, speichert über station/itin/kapital");
ok(/setOptimistisch\(null\); setZustand\("fehler"\)/.test(ed), "Editor: optimistisch, bei Fehler zurück und Fehler bleibt");
ok(/GlobalStationen/.test(datei("client/src/components/admin/ChefGlobal.tsx")) && /GlobalStationen/.test(datei("client/src/pages/agent/global-akte.tsx")), "Editor im Chefbüro und im Office");
const css = [datei("client/src/styles/global-stationen.css"), datei("client/src/styles/global-portal-nav.css")].join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
ok(/prefers-reduced-motion/.test(css) && !/gold|#c9a|#d4af|#b8860b|#daa520|#fbbf24/i.test(css), "CSS: Bewegung abschaltbar, kein Gold");

// ═══ 8 GEGENPROBE ════════════════════════════════════════════════════════════
abschnitt("8 Gegenprobe");
ok(deTreffer("Ihre ITIN kommt bis zu 3 Wochen schneller").length > 0, "Wand erkennt „bis zu“ / Frist");
ok(S.stationAnbieterImText("LegalZoom Inc") && !S.stationAnbieterImText("412 W 17th Street"), "Anbieter-Erkennung schlägt an, Adresse nicht");
ok(S.globalPlusFuerKunde({ itinEnc: "v1:x", itinEnde: "9999", kontoInstitut: "X" } as any).kontoInstitut === undefined, "Kundensicht entfernt Interna auch bei Mischdaten");
ok(netz.length === 0, "kein Netzzugriff", netz.join(", "));
console.log(`\n${gut} ok, ${rot.length} rot.`);
if (rot.length) process.exitCode = 1;
