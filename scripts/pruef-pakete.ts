// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER PAKETKATALOG UND SEINE LESER (17.09.2026, E-188)
//
// ── WARUM ES IHN GIBT ──────────────────────────────────────────────────────
// Mit FIAON Global stehen zum ersten Mal Einmalpakete über 2.499 € bis
// 35.999 € im Katalog. Der Abo-Motor erkannte „kein Abo" bis dahin am WORT
// schufa und am Betrag 74,00 € — ein bezahltes Global-Paket hätte zwölf
// Monatsraten à 2.499 € samt Dauermahnung bekommen. Den echten Prüfstand des
// Motors (scripts/pruef-abo-motor.ts) darf man dafür nicht starten: Er
// verschickt echte Mahnmails. Dieser hier läuft OHNE Datenbank und OHNE Netz.
//
// Er prüft vier Dinge:
//   1. DER KATALOG — Schlüssel, Preise, abo/art/eingestellt, die Helfer.
//   2. DIE TEXTE — jeder deutsche Kundensatz aus shared/fiaon-global.ts und
//      shared/fiaon-global-vertrieb.ts passiert die Wortwand; dazu die
//      Geist-Prüfung, die kein Regex der Wand abdeckt (bis zu, Banknamen,
//      Fristen mit Ziffer, Zinssatz).
//   3. DIE ABO-SICHERUNG — als Verhalten (istKeinAboPaket, SQL-Ausdruck) UND
//      am Quelltext, gebunden an die FUNKTION, nicht an die Datei: Eine
//      Prüfung, die den Nachbarn findet, prüft nichts (pruef-rueckstand.ts).
//   4. DIE LESER — Firmen-Abschluss, Anlage, Wissen, Wege, Preisseite: keine
//      harte business_*-Liste, kein /business-antrag, Einmalpreis statt Rate.
//
//   npx tsx scripts/pruef-pakete.ts        (Exit 1 bei ROT)
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  PAKETE, NICHT_ABO_SCHLUESSEL, PAKET_PREISE_EURO, PAKET_PREISE_CENTS,
  paket, paketPreisCents, istAboPaket, istGlobalPaket, verkaufbarePakete,
} from "../shared/fiaon-pakete";
import {
  GLOBAL_PAKETE, GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_GELD_ZURUECK,
  globalPaket, globalKatalog, globalPreisText, globalPlanungText,
} from "../shared/fiaon-global";
import { globalStartPfad, globalStartUrl, globalPaketePfad, globalGespraechPfad, globalSeitePfad } from "../shared/fiaon-global-wege";
import { globalLeitfaden, globalInfoMail, globalVorbereitungSystem, globalPreisZeile } from "../shared/fiaon-global-vertrieb";
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { wissenFakten, globalWissen } from "../shared/fiaon-wissen";
import { seoSeite } from "../shared/fiaon-seo-seiten";
import { istKeinAboPaket, keinAboSql, KEIN_ABO_SQL } from "../server/lib/fiaon-kein-abo";
import { produktkategorie, produktkategorieSql } from "../server/lib/fiaon-produktkategorie";

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string): string => readFileSync(path.join(WURZEL, p), "utf8");

let gut = 0;
let schlecht = 0;
const log = (s = "") => console.log(s);
function ok(text: string, bedingung: boolean, fund = ""): void {
  if (bedingung) { gut++; log(`  ok    ${text}`); }
  else { schlecht++; log(`  ROT   ${text}${fund ? `  →  ${fund}` : ""}`); }
}
function gleich(text: string, ist: unknown, soll: unknown): void {
  ok(text, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function titel(t: string): void { log(`\n${"─".repeat(74)}\n${t}\n${"─".repeat(74)}`); }

/**
 * Der Rumpf EINER Funktion — von ihrer Kopfzeile bis zur ersten Klammer, die in
 * Spalte 0 ALLEIN steht. „Allein" ist der Punkt: Ein mehrzeiliger Rückgabetyp
 * endet auf `}> {` — ebenfalls Spalte 0, aber nicht das Ende der Funktion. Der
 * erste Entwurf schnitt dort ab und fand in aboNachziehen nichts.
 */
function funktion(quelltext: string, kopf: string): string {
  const a = quelltext.indexOf(kopf);
  if (a < 0) return "";
  const rest = quelltext.slice(a);
  const m = /\n\}\)?;?[ \t]*(\r?\n|$)/.exec(rest);
  return m ? rest.slice(0, m.index) : rest;
}

const GLOBAL_SOLL: Record<string, number> = {
  global_struktur: 249900, global_banking: 499900, global_kapital: 699900, global_vip: 3599900,
};
const BUSINESS_ALT: Record<string, number> = {
  business_starter: 4999, business_pro: 9999, business_ultra: 14999, business_enterprise: 24999,
};

// ═══════════════════════════════════════════════════════════════════════════
titel("1. DER KATALOG");
for (const [key, cents] of Object.entries(GLOBAL_SOLL)) {
  const p = paket(key);
  ok(`${key} steht im Katalog`, p != null);
  gleich(`${key} kostet exakt ${cents} Cent`, p?.preisCents, cents);
  gleich(`${key} ist KEIN Abo`, p?.abo, false);
  gleich(`${key} hat art „global“`, p?.art, "global");
  ok(`${key} ist nicht eingestellt`, !p?.eingestellt);
  ok(`${key} heißt „FIAON Global …“`, /^FIAON Global /.test(p?.label ?? ""), p?.label);
  ok(`istAboPaket(${key}) ist false`, istAboPaket(key) === false);
  ok(`istGlobalPaket(${key}) ist true`, istGlobalPaket(key) === true);
}
for (const [key, cents] of Object.entries(BUSINESS_ALT)) {
  const p = paket(key);
  gleich(`${key} ist eingestellt`, p?.eingestellt, true);
  // Bestandskunden: Das Paket bleibt ein Abo mit seinem Preis — sonst enden ihre Raten.
  gleich(`${key} bleibt ein Abo (Bestandskunden zahlen weiter)`, p?.abo, true);
  gleich(`${key} behält seinen Preis ${cents}`, p?.preisCents, cents);
  ok(`istGlobalPaket(${key}) ist false`, !istGlobalPaket(key));
}
gleich("NICHT_ABO_SCHLUESSEL = schufa + die vier Global-Schlüssel",
  [...NICHT_ABO_SCHLUESSEL].sort(), ["schufa", ...Object.keys(GLOBAL_SOLL)].sort());
gleich("verkaufbarePakete(\"business\") ist leer", verkaufbarePakete("business").map((p) => p.key), []);
gleich("verkaufbarePakete(\"global\") sind genau die vier",
  verkaufbarePakete("global").map((p) => p.key).sort(), Object.keys(GLOBAL_SOLL).sort());
ok("verkaufbarePakete() enthält kein eingestelltes Paket", verkaufbarePakete().every((p) => !p.eingestellt));
gleich("verkaufbarePakete(\"privat\") unverändert",
  verkaufbarePakete("privat").map((p) => p.key).sort(), ["highend", "pro", "schufa", "start", "ultra"]);
ok("Ein unbekannter Schlüssel ist weder Abo noch Global", !istAboPaket("gibtsnicht") && !istGlobalPaket("gibtsnicht"));
ok("Schlüssel werden getrimmt und kleingeschrieben", paket("  GLOBAL_VIP ")?.key === "global_vip");
for (const key of Object.keys(GLOBAL_SOLL)) {
  gleich(`PAKET_PREISE_EURO[${key}] (= PACK_PRICES im Antrag)`, PAKET_PREISE_EURO[key], GLOBAL_SOLL[key] / 100);
  gleich(`PAKET_PREISE_CENTS[${key}]`, PAKET_PREISE_CENTS[key], GLOBAL_SOLL[key]);
}
ok("PAKET_PREISE_EURO führt die Auskunft weiterhin nicht", PAKET_PREISE_EURO.schufa === undefined);
ok("Kein Schlüssel steht zweimal im Katalog", new Set(PAKETE.map((p) => p.key)).size === PAKETE.length);

// ═══════════════════════════════════════════════════════════════════════════
titel("2. KATALOG ↔ LEISTUNGSTEXTE (shared/fiaon-global.ts)");
const katalogGlobal = PAKETE.filter((p) => p.art === "global").map((p) => p.key).sort();
gleich("Jedes Global-Paket des Katalogs hat Texte — und umgekehrt", GLOBAL_PAKETE.map((g) => g.key).sort(), katalogGlobal);
for (const g of GLOBAL_PAKETE) {
  ok(`${g.key}: globalKatalog() findet den Katalogeintrag`, globalKatalog(g.key)?.key === g.key);
  ok(`${g.key}: globalPaket() findet die Texte`, globalPaket(g.key)?.key === g.key);
  ok(`${g.key}: Planungsgröße ist eine positive Zahl`, Number.isFinite(g.planungUsd) && g.planungUsd > 0);
  ok(`${g.key}: DE und EN haben gleich viele Leistungen`, g.de.leistungen.length === g.en.leistungen.length && g.de.leistungen.length >= 3);
  ok(`${g.key}: Name, für wen, Dauer in beiden Sprachen`, [g.de.name, g.de.fuer, g.de.dauer, g.en.name, g.en.fuer, g.en.dauer].every((t) => String(t).trim().length > 3));
  ok(`${g.key}: Dauer ist ein Erfahrungswert, keine Frist`, /in der Regel|wie Global/i.test(g.de.dauer), g.de.dauer);
}
gleich("globalPreisText: 2.499 € / €2,499", [globalPreisText("global_struktur"), globalPreisText("global_struktur", "en")], ["2.499 €", "€2,499"]);
gleich("globalPreisText: 35.999 €", globalPreisText("global_vip"), "35.999 €");
gleich("globalPlanungText: 50.000 $ / $50,000", [globalPlanungText("global_struktur"), globalPlanungText("global_struktur", "en")], ["50.000 $", "$50,000"]);

// ═══════════════════════════════════════════════════════════════════════════
titel("3. DIE WORTWAND — alle deutschen Kundensätze");
const deTexte: [string, string][] = [];
for (const g of GLOBAL_PAKETE) {
  deTexte.push([`${g.key}.name`, g.de.name], [`${g.key}.fuer`, g.de.fuer], [`${g.key}.dauer`, g.de.dauer]);
  g.de.leistungen.forEach((l, i) => deTexte.push([`${g.key}.leistung[${i}]`, l]));
}
GLOBAL_PFLICHTHINWEIS.de.forEach((h, i) => deTexte.push([`pflichthinweis[${i}]`, h]));
deTexte.push(["rollen.fiaon", GLOBAL_ROLLEN.de.fiaon], ["rollen.partner", GLOBAL_ROLLEN.de.partner], ["rollen.kosten", GLOBAL_ROLLEN.de.kosten]);
deTexte.push(["geldZurueck.titel", GLOBAL_GELD_ZURUECK.de.titel], ["geldZurueck.text", GLOBAL_GELD_ZURUECK.de.text], ["geldZurueck.bedingungen", GLOBAL_GELD_ZURUECK.de.bedingungen]);

// Was kein Regex der Wand abdeckt, aber E-188 verbietet (garantie-recht.txt).
const GEIST: [RegExp, string][] = [
  [/\bbis\s+zu\b/i, "„bis zu“"],
  [/\b(capital\s*one|american\s+express|amex|chase|bank\s+of\s+america|boa|wells\s+fargo|citi(bank)?|mercury|brex)\b/i, "Bankname"],
  [/\b\d+\s*(%|prozent)/i, "Zinssatz/Prozent als Zahl"],
  [/\b(innerhalb|binnen)\s+(von\s+)?\d+/i, "Frist mit Ziffer"],
  [/\b\d+\s*(stunden|tage[n]?|werktage[n]?|wochen|monate[n]?)\b/i, "Dauer mit Ziffer"],
  [/\bziel-?(limit|rahmen)\b/i, "Ziel-Limit/Ziel-Rahmen"],
  [/\bempfohlen\b/i, "„empfohlen“"],
  [/unternehmensberatung|beratungsgruppe|\bgroup\b|\bgruppe\b/i, "Selbstbezeichnung Beratung/Gruppe"],
];
function wandUndGeist(name: string, text: string): void {
  const funde = wandPruefen(text);
  ok(`Wand: ${name}`, funde.length === 0, funde.map((f) => `${f.art} „${f.treffer}“`).join("; "));
  const geist = GEIST.filter(([m]) => m.test(text)).map(([, n]) => n);
  ok(`Geist: ${name}`, geist.length === 0, `${geist.join(", ")} in „${text.slice(0, 90)}…“`);
}
for (const [name, text] of deTexte) wandUndGeist(name, text);

// Englisch: dieselben Verbote wie scripts/seo-wortverbote-en.ts, das shared/fiaon-global.ts nicht liest.
const enTexte: string[] = [];
for (const g of GLOBAL_PAKETE) enTexte.push(g.en.name, g.en.fuer, g.en.dauer, ...g.en.leistungen);
enTexte.push(...GLOBAL_PFLICHTHINWEIS.en, GLOBAL_ROLLEN.en.fiaon, GLOBAL_ROLLEN.en.partner, GLOBAL_ROLLEN.en.kosten,
  GLOBAL_GELD_ZURUECK.en.titel, GLOBAL_GELD_ZURUECK.en.text, GLOBAL_GELD_ZURUECK.en.bedingungen);
// „personal guarantee" ist der Fachbegriff für die persönliche Haftung des Inhabers
// (Pflichthinweis) — kein Versprechen von FIAON. Alles andere mit guarantee bleibt verboten.
const EN_VERBOTEN = /(?<!personal )\bguarantee[sd]?\b|\badvice\b|\brecommend\w*|\baffiliate\w*|\bup\s+to\b|\b(capital\s*one|amex|american\s+express|chase|bank\s+of\s+america)\b|\b\d+\s*%/i;
const enTreffer = enTexte.filter((t) => EN_VERBOTEN.test(t));
ok(`Englisch: ${enTexte.length} Sätze ohne guarantee/advice/recommend/up to/Bankname/Prozent`, enTreffer.length === 0, enTreffer.join(" | "));

// ═══════════════════════════════════════════════════════════════════════════
titel("4. VERTRIEBSTEXTE (shared/fiaon-global-vertrieb.ts)");
const leitfaden = globalLeitfaden();
const kundensaetze = leitfaden.flatMap((b) => b.s.filter((s) => s.kunde).map((s) => [`Leitfaden „${b.t}“`, s.text] as [string, string]));
ok("Der Leitfaden hat Kundensätze UND Anweisungen", kundensaetze.length >= 10 && leitfaden.some((b) => b.s.some((s) => !s.kunde)));
for (const [name, text] of kundensaetze) {
  const funde = wandPruefen(text);
  ok(`Wand: ${name}: „${text.slice(0, 48)}…“`, funde.length === 0, funde.map((f) => `${f.art} „${f.treffer}“`).join("; "));
  const geist = GEIST.filter(([m, n]) => n !== "Dauer mit Ziffer" && m.test(text)).map(([, n]) => n);
  ok(`Geist: ${name}: „${text.slice(0, 48)}…“`, geist.length === 0, geist.join(", "));
}
ok("Der Leitfaden nennt die drei Pflichthinweise wörtlich", GLOBAL_PFLICHTHINWEIS.de.every((h) => kundensaetze.some(([, t]) => t.includes(h))));
ok("Der Leitfaden nennt alle vier Preise aus dem Katalog", GLOBAL_PAKETE.every((g) => globalPreisZeile().includes(globalPreisText(g.key))));
const mail = globalInfoMail({ ansprechpartner: "Frau Beispiel", firma: "Beispiel GmbH", agentName: "Nikita Prüfstand" });
{
  const funde = wandPruefen(mail.text);
  ok("Wand: Info-Mail nach dem Gespräch", funde.length === 0, funde.map((f) => `${f.art} „${f.treffer}“`).join("; "));
  const geist = GEIST.filter(([m]) => m.test(mail.text)).map(([, n]) => n);
  ok("Geist: Info-Mail nach dem Gespräch", geist.length === 0, geist.join(", "));
  ok("Info-Mail: Sie-Form, kein Du", !/\b(du|dein|deine|dir|dich)\b/i.test(mail.text));
  ok("Info-Mail nennt jeden Preis als „einmalig“", GLOBAL_PAKETE.every((g) => mail.text.includes(`${globalPreisText(g.key)} einmalig`)));
  ok("Info-Mail nennt die drei Pflichthinweise", GLOBAL_PFLICHTHINWEIS.de.every((h) => mail.text.includes(h)));
  ok("Info-Mail verlinkt /business/start und /business#gespraech", mail.text.includes("https://fiaon.com/business/start") && mail.text.includes("https://fiaon.com/business#gespraech"));
  ok("Info-Mail: kein /business-antrag, keine Monatsrate, keine Bankdaten", !/business-antrag|im Monat|\/Monat|IBAN|\bBIC\b/i.test(mail.text));
  ok("Info-Mail: Anrede und Absender stehen drin", mail.text.startsWith("Guten Tag Frau Beispiel,") && mail.text.includes("Nikita Prüfstand") && mail.betreff.includes("Beispiel GmbH"));
  ok("Info-Mail ohne Ansprechpartner: neutrale Anrede", globalInfoMail({ firma: "X", agentName: "Y" }).text.startsWith("Guten Tag,"));
}
{
  const system = globalVorbereitungSystem();
  ok("KI-Vorbereitung kennt die vier Global-Schlüssel, kein business_*", GLOBAL_PAKETE.every((g) => system.includes(g.key)) && !/business_(starter|pro|ultra|enterprise)/.test(system));
  ok("KI-Vorbereitung verbietet Zusagen und Banknamen", /NIEMALS versprechen/.test(system) && /KEINE Banknamen/.test(system) && /entscheidet allein/.test(system));
  ok("KI-Vorbereitung: Einmalpreis, keine Monatsrate als Angebot", /EINMALPREIS/.test(system) && !/€\/Monat|monatlich kündbar/.test(system));
}

// ═══════════════════════════════════════════════════════════════════════════
titel("5. DIE ABO-SICHERUNG — Verhalten");
for (const key of NICHT_ABO_SCHLUESSEL) ok(`istKeinAboPaket(${key}) ist true`, istKeinAboPaket(key));
for (const key of ["start", "pro", "ultra", "highend", ...Object.keys(BUSINESS_ALT)]) ok(`istKeinAboPaket(${key}) ist false — das Abo läuft`, !istKeinAboPaket(key));
// Der Kern der Regel: Ein UNBEKANNTER oder LEERER Schlüssel ist NICHT „kein Abo".
// Altbestellungen ohne pack_key sind Abos; `!istAboPaket()` hätte sie ausgesperrt.
for (const leer of [null, undefined, "", "  ", "standard", "gibtsnicht"]) ok(`istKeinAboPaket(${JSON.stringify(leer)}) ist false — Altbestellungen bleiben Abos`, !istKeinAboPaket(leer));
ok("istKeinAboPaket trimmt und schreibt klein wie der Katalog", istKeinAboPaket("  Global_Struktur "));
ok("KEIN_ABO_SQL nennt jeden Nicht-Abo-Schlüssel als Literal", NICHT_ABO_SCHLUESSEL.every((k) => KEIN_ABO_SQL.includes(`'${k}'`)));
ok("KEIN_ABO_SQL nennt kein Abo-Paket", PAKETE.filter((p) => p.abo).every((p) => !KEIN_ABO_SQL.includes(`'${p.key}'`)));
ok("KEIN_ABO_SQL ist NULL-fest (COALESCE) und liest pack_key wie paket()", /LOWER\(TRIM\(COALESCE\(a\.pack_key, ''\)\)\) IN \(/.test(KEIN_ABO_SQL));
ok("KEIN_ABO_SQL benutzt kein <> ALL (NULL-Falle)", !/<>\s*ALL/i.test(KEIN_ABO_SQL));
ok("keinAboSql(\"x\") setzt den Alias", keinAboSql("x").includes("x.pack_key") && !keinAboSql("x").includes("a.pack_key"));
ok("keinAboSql lehnt einen Alias mit Sonderzeichen ab", (() => { try { keinAboSql("a; DROP"); return false; } catch { return true; } })());

gleich("Kategorie: Auskunft an der Referenz", produktkategorie({ ref: "FIAON-SCHUFA-ABC", pack_key: "highend" }), "auskunft");
gleich("Kategorie: Auskunft am Typ", produktkategorie({ type: "schufa", ref: "FIAON-X" }), "auskunft");
gleich("Kategorie: Global am Paketschlüssel", produktkategorie({ type: "business", ref: "FIAON-X", pack_key: "global_kapital" }), "global");
gleich("Kategorie: Business-Altbestand ist „konto“", produktkategorie({ type: "business", pack_key: "business_pro" }), "konto");
gleich("Kategorie: Privatpaket ist „konto“", produktkategorie({ type: "private", pack_key: "pro" }), "konto");
gleich("Kategorie: ohne Paket ist „konto“", produktkategorie({}), "konto");
ok("produktkategorieSql nennt die vier Global-Schlüssel und endet nie in NULL", Object.keys(GLOBAL_SOLL).every((k) => produktkategorieSql().includes(`'${k}'`)) && /ELSE 'konto' END/.test(produktkategorieSql()));
ok("produktkategorieSql(\"s\") qualifiziert jede Spalte", ["s.type", "s.ref", "s.pack_key"].every((x) => produktkategorieSql("s").includes(x)));

// ═══════════════════════════════════════════════════════════════════════════
titel("6. DIE ABO-SICHERUNG — am Quelltext, je FUNKTION");
const abo = datei("server/routes/fiaon-abo.ts");
ok("fiaon-abo.ts: der alte Schlüssel-Filter auf 'schufa' allein ist weg", !abo.includes("a.pack_key IS DISTINCT FROM 'schufa'"));
ok("fiaon-abo.ts: die alte Erkennung über Name/Betrag bleibt (Altbestellungen ohne pack_key)", /function istBonitaetsCheck/.test(abo) && /=== 7400/.test(abo));
{
  const f = funktion(abo, "export async function aboBeiZahlungAnlegen");
  const wache = f.indexOf("istKeinAboPaket(app.pack_key)");
  const ersteRate = f.indexOf("INSERT INTO fiaon_abo_raten");
  ok("aboBeiZahlungAnlegen liest pack_key und fragt den Katalog", /SELECT[^`]*pack_key/.test(f) && wache > 0);
  ok("aboBeiZahlungAnlegen: die Katalog-Wache steht VOR dem ersten INSERT (auch keine Rate 1)", wache > 0 && ersteRate > 0 && wache < ersteRate);
}
ok("naechsteRateAnlegen endet für einen Einmalkauf", funktion(abo, "export async function naechsteRateAnlegen").includes("if (istKeinAboPaket(app.pack_key)) return;"));
ok("ketteSicherstellen schließt Einmalkäufe per Katalog-SQL aus", funktion(abo, "export async function ketteSicherstellen").includes("AND NOT ${sqlPool.unsafe(KEIN_ABO_SQL)}"));
{
  const f = funktion(abo, "export async function aboNachziehen");
  ok("aboNachziehen schließt Einmalkäufe per Katalog-SQL aus", f.includes("AND NOT ${sqlPool.unsafe(KEIN_ABO_SQL)}"));
  ok("aboNachziehen prüft je Zeile noch einmal (istEinmalkauf)", f.includes("if (istEinmalkauf(app))"));
}
{
  const f = funktion(abo, "async function ratenFuerHeuteErzeugen");
  ok("ratenFuerHeuteErzeugen (Tageslauf) schließt Einmalkäufe per Katalog-SQL aus", f.includes("AND NOT ${KEIN_ABO_SQL}"));
  ok("ratenFuerHeuteErzeugen prüft je Zeile noch einmal", f.includes("if (istKeinAboPaket(k.pack_key)) continue;"));
}
ok("faelligeRaten mahnt keine Rate an einem Einmalkauf", funktion(abo, "async function faelligeRaten").includes("AND NOT ${sqlPool.unsafe(KEIN_ABO_SQL)}"));
ok("Jede Stelle, die eine Rate anlegt, liegt in einer der geprüften Funktionen",
  // Nicht die Zahl ist die Regel, sondern: KEIN INSERT außerhalb der vier abgesicherten Funktionen.
  (abo.match(/INSERT INTO fiaon_abo_raten/g) ?? []).length
  === ["export async function aboBeiZahlungAnlegen", "export async function naechsteRateAnlegen", "export async function aboNachziehen", "async function ratenFuerHeuteErzeugen"]
    .reduce((n, k) => n + (funktion(abo, k).match(/INSERT INTO fiaon_abo_raten/g) ?? []).length, 0),
  "neue Anlagestelle? Dann hier aufnehmen UND absichern");
const pflicht = datei("server/lib/fiaon-abo-pflicht.ts");
{
  const f = funktion(pflicht, "export async function fehlendeAbos");
  ok("fehlendeAbos: SCHUFA-Ausschluss bleibt NULL-fest", f.includes("NOT COALESCE(${SCHUFA_SQL}, FALSE)"));
  ok("fehlendeAbos: Einmalkäufe des Katalogs sind ausgeschlossen", f.includes("AND NOT ${KEIN_ABO_SQL}") && f.includes("if (istEinmalkauf(z)) return [];"));
}
ok("Gegenprobe (Einmalkauf mit Raten) umfasst FIAON Global", funktion(pflicht, "export async function schufaMitRaten").includes("OR ${KEIN_ABO_SQL}"));
ok("Lastschrift: kein Mandat für einen Einmalkauf", funktion(datei("server/routes/fiaon-lastschrift.ts"), "async function flowStarten").includes("paketVon(a.pack_key)?.abo === false"));
ok("Lastschrift: GoCardless-Abo nur für Abo-Pakete", funktion(datei("server/routes/fiaon-lastschrift.ts"), "export async function gcAboAnlegen").includes("if (pk?.abo && pk.preisCents > 0)"));
ok("SEPA-Einladung geht nicht an Einmalkäufer", datei("server/lib/fiaon-sepa-werbung.ts").includes("AND NOT ${sqlPool.unsafe(KEIN_ABO_SQL)}"));
{
  const z = datei("server/routes/fiaon-chef-zahlen.ts");
  ok("Chefbüro: MRR und Vertragsbestand ohne Einmalkäufe (zwei Stellen)", (z.match(/AND NOT \$\{KEIN_ABO_SQL\}/g) ?? []).length === 2);
  ok("Chefbüro: FIAON Global zählt als eigener Einmalerlös zum Umsatz", z.includes("'global'") && z.includes("global_cents") && z.includes("IST_GLOBAL"));
}
ok("Chefbüro-Wahrheitscheck: Einmalkauf ist kein „bezahlt ohne Ratenkette“", (datei("server/routes/fiaon-chef-werkzeuge.ts").match(/AND NOT \$\{KEIN_ABO_SQL\}/g) ?? []).length === 2);
// Mahnung im weiteren Sinn: die drei Erinnerungsmaschinen der Privatlinie (zweimal täglich, seit E-182
// ohne Obergrenze) dürfen eine offene Global-Bestellung nicht anfassen.
ok("Zahlungserinnerung (payment_reminder, Einzel- UND Sammelversand) lässt FIAON Global aus",
  funktion(datei("server/routes/fiaon-antrag.ts"), "async function claimReminderBatch").includes("AND NOT (${sqlPool.unsafe(produktkategorieSql(\"fa\"))} = 'global')")
  && (datei("server/routes/fiaon-antrag.ts").match(/claimReminderBatch\(/g) ?? []).length === 3);
ok("Rückholung (S1–S5, Dauerpflege) lässt FIAON Global aus", funktion(datei("server/lib/fiaon-rueckholung.ts"), "function grundmenge").includes("AND NOT (${sqlPool.unsafe(produktkategorieSql(\"a\"))} = 'global')"));
ok("Abbruch-Erinnerung (antrag_erinnerung) lässt FIAON Global aus", funktion(datei("server/lib/fiaon-antrag-erinnerung.ts"), "export async function antragErinnerungenLauf").includes("AND NOT (${sqlPool.unsafe(produktkategorieSql(\"a\"))} = 'global')"));
ok("Stilllegen nur innerhalb der Kategorie (auskunft | global | konto)", funktion(datei("server/routes/fiaon-antrag.ts"), "export async function supersedeSisterOrders").includes("${sqlPool.unsafe(produktkategorieSql())} = ${kategorieSchluessel}::text"));

// ═══════════════════════════════════════════════════════════════════════════
titel("7. DIE LESER");
const firmen = datei("server/routes/fiaon-firmen.ts");
ok("Firmen-Abschluss: keine harte business_*-Liste mehr", !/"business_starter"|"business_pro"|"business_ultra"|"business_enterprise"/.test(firmen));
ok("Firmen-Abschluss: Pakete aus verkaufbarePakete(\"global\")", firmen.includes("verkaufbarePakete(\"global\").find"));
ok("Firmen-Abschluss: Betrag aus dem Katalog, als Einmalpreis gemeldet", firmen.includes("betrag: paketDef.preisCents / 100, einmalig: !paketDef.abo"));
ok("Firmen-Abschluss: keine Zustimmung vermerkt, die niemand gegeben hat (ag1–ag3 false) — und der Auftragslink geht mit",
  firmen.includes("ag1: false, ag2: false, ag3: false,") && !/ag[123]: true/.test(firmen) && firmen.includes("auftragslink: globalStartUrl(paket)"));
ok("Firmen-Route: Info-Mail und KI-Anweisung aus shared/fiaon-global-vertrieb.ts", firmen.includes("globalInfoMail(") && firmen.includes("globalVorbereitungSystem()") && !firmen.includes("Geschäftspakete ab 39,99"));
const firmenSeite = datei("client/src/pages/agent/firmen.tsx");
ok("Firmen-Cockpit: Auswahlfeld aus dem Katalog, „einmalig“ statt „/Monat“", firmenSeite.includes("verkaufbarePakete(\"global\")") && firmenSeite.includes("einmalig</option>") && !firmenSeite.includes("€/Monat") && !firmenSeite.includes("erste Rate"));
ok("Firmen-Cockpit: Leitfaden aus der gemeinsamen Quelle", firmenSeite.includes("globalLeitfaden()") && !firmenSeite.includes("39,99"));
const anlage = datei("server/routes/fiaon-agent-anlage.ts");
ok("Anlage: die alte Typ-Weiche (global → private) steht nirgends mehr als CODE",
  anlage.split("\n").filter((z) => !z.trim().startsWith("//")).every((z) => !/art === "business" \? "business" : "private"/.test(z)));
ok("Anlage: bestellTyp() an allen drei Anlagestellen", (anlage.match(/bestellTyp\(/g) ?? []).length >= 4 && /p\.art === "business" \|\| p\.art === "global"/.test(anlage));
ok("Anlage: eingestellte Pakete werden an allen drei Routen abgelehnt", (anlage.match(/nichtMehrImVerkauf\(/g) ?? []).length >= 4);
ok("Anlage: der Katalog für die Oberfläche zeigt nur Verkaufbares", funktion(anlage, "router.get(\"/agent/katalog\"").includes("verkaufbarePakete().map"));

const wissen = wissenFakten();
for (const g of GLOBAL_PAKETE) {
  ok(`Wissen: ${g.key} mit Einmalpreis`, wissen.includes(`${globalKatalog(g.key)?.label}: ${globalPreisText(g.key)} EINMALIG`));
}
ok("Wissen: Global nie als Monatsrate", !/FIAON Global [A-Za-z]+[^\n]*im Monat, zwölf/.test(wissen));
ok("Wissen: Business-Abos stehen NICHT mehr in der Verkaufsliste", !/FIAON Business [A-Za-z]+ \(Geschäftskunden\)/.test(wissen));
ok("Wissen: Business-Abos als „nicht mehr im Verkauf“, Bestand läuft weiter", /NICHT MEHR IM VERKAUF/.test(wissen) && Object.keys(BUSINESS_ALT).every((k) => wissen.includes(`${paket(k)?.label}: `)));
ok("Wissen: wer entscheidet, Mandat, Wege", /entscheidet allein das jeweilige US-Institut/.test(wissen) && /auf eigenes Mandat/.test(wissen) && wissen.includes("fiaon.com/business/start") && wissen.includes("fiaon.com/business#gespraech"));
ok("Wissen: die drei Pflichthinweise stehen drin", GLOBAL_PFLICHTHINWEIS.de.every((h) => wissen.includes(h)));
ok("Wissen: kein /business-antrag, kein alter Zielrahmen", !/business-antrag|Zielrahmen 5\.000/.test(wissen));
ok("Wissen: die Privatpakete stehen unverändert als Abo drin", ["start", "pro", "ultra", "highend"].every((k) => wissen.includes(`${paket(k)?.label} (Privatkunden): `)));
ok("globalWissen() ist Teil von wissenFakten()", wissen.includes(globalWissen()));

gleich("Weg: Direktauftrag mit Paket", globalStartPfad("global_vip"), "/business/start?paket=global_vip");
gleich("Weg: unbekanntes Paket führt in den Auftrag ohne Vorauswahl", globalStartPfad("business_pro"), "/business/start");
gleich("Weg: Englisch führt zu den Paketen der englischen Seite", globalStartPfad("global_vip", "en"), "/en/business#pakete");
gleich("Weg: Seite, Pakete, Gespräch", [globalSeitePfad(), globalPaketePfad(), globalGespraechPfad(), globalSeitePfad("en")], ["/business", "/business#pakete", "/business#gespraech", "/en/business"]);
gleich("Weg: volle Adresse für Mail und Zwischenablage", globalStartUrl("global_banking"), "https://fiaon.com/business/start?paket=global_banking");

const MEINE_DATEIEN = [
  "client/src/pages/site/preise.tsx", "client/src/pages/site/investoren.tsx", "client/src/pages/site/plattform-konzept.tsx",
  "client/src/pages/fiaon-home.tsx", "client/src/pages/agent/firmen.tsx", "client/src/pages/agent/tools/paketfinder.tsx",
  "client/src/i18n/preise.ts", "client/src/i18n/plattform-konzept.ts", "shared/fiaon-wissen.ts",
  "shared/fiaon-global-vertrieb.ts", "client/src/pages/agent/academy/kapitel-2-plattform.ts",
];
for (const d of MEINE_DATEIEN) {
  const code = datei(d).split("\n").filter((z) => !z.trim().startsWith("//")).join("\n");
  ok(`${d}: kein Link auf /business-antrag, kein harter business_*-Schlüssel`, !/\/business-antrag|business_(starter|pro|ultra|enterprise)/.test(code));
}
{
  const preise = seoSeite("/preise");
  const abschnitt = (preise?.abschnitte ?? []).find((a: any) => /FIAON Global/.test(String(a.h2)));
  ok("/preise (SEO-Tabelle): Abschnitt „FIAON Global“ statt „vier Stufen“", !!abschnitt && !(preise?.abschnitte ?? []).some((a: any) => /Business Starter/.test(String(a.text))));
  ok("/preise (SEO-Tabelle): die vier Preise stimmen mit dem Katalog", GLOBAL_PAKETE.every((g) => String((abschnitt as any)?.text ?? "").includes(`${g.de.name} ${globalPreisText(g.key)}`)));
  const funde = wandPruefen(String((abschnitt as any)?.text ?? ""));
  ok("/preise (SEO-Tabelle): der Abschnitt passiert die Wand", funde.length === 0, funde.map((f) => f.treffer).join("; "));
}
ok("Katalogpreis je Global-Paket > 0 (paketPreisCents)", Object.keys(GLOBAL_SOLL).every((k) => paketPreisCents(k) === GLOBAL_SOLL[k]));

// ═══════════════════════════════════════════════════════════════════════════
log(`\n${"═".repeat(74)}`);
log(schlecht === 0 ? `PAKETE: alle ${gut} Prüfungen grün.` : `PAKETE: ${schlecht} ROT, ${gut} grün.`);
process.exit(schlecht === 0 ? 0 : 1);
