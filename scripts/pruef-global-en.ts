// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE ENGLISCHEN UNTERSEITEN VON FIAON GLOBAL (24.09.2026, E-234)
//
// Jede englische Seite in shared/fiaon-global-seiten/en/ ist die Übersetzung
// GENAU einer deutschen Seite (schwester). Dieser Prüfstand hält die beiden
// gleich gebaut und die englische sauber:
//
//   1. Paar: Adresse aus shared/fiaon-global-pfade.ts, gleiche Art, Kennung,
//      Paket, Auftraggeber, Priorität; Stand/Erscheinen als Datum ≤ heute.
//   2. Aufbau: gleich viele Blick-Zeilen, Kennziffern, Fragen, Quellen (dieselben
//      Adressen), Bausteine mit gleichem Typ und GLEICHER id (Anker), gleich viele
//      Absätze, Punkte, Etappen, Zeilen, Spalten, Karten, Einträge.
//   3. Wege: Weiterlesen, Verzeichnis und Karten zeigen auf die englischen
//      Schwestern der deutschen Ziele — nie in die deutsche oder die Privatwelt.
//   4. SEO: Titel ≤ 60 Zeichen und ≤ 580 px mit „— FIAON Global", Beschreibung
//      110–155 Zeichen und ≤ 1000 px.
//   5. Worte: GLOBAL_SCHAERFER_EN + guarantee/advice nur verneint (die VIP-Zahl
//      darf „up to" tragen), keine deutschen Reste (Umlaute, Funktionswörter,
//      „125 $", „2.499 €", „15. April"), Kapital-Satz nur mit Steuersatz, Geld-
//      zurück nur mit Bedingungen.
//   Hinweise (kein Fehler): amerikanische Schreibweisen, „business card".
//
// Aufruf: npx tsx scripts/pruef-global-en.ts [datei …]   (ohne Datei: alle)
//         Exit 1 bei Fehlern.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import type { GlobalBlock, GlobalSeite } from "../shared/fiaon-global-seiten/typen";
import { GLOBAL_EN_PFADE, globalEnPfad } from "../shared/fiaon-global-pfade";
import { GLOBAL_GELD_ZURUECK, GLOBAL_KAPITAL_FREI, globalKapital } from "../shared/fiaon-global";
import { globalWortPruefenEn } from "../shared/fiaon-global-wortregeln";
import { titelPixel, beschreibungPixel, TITEL_MAX_PX, BESCHREIBUNG_MAX_PX } from "../shared/fiaon-pixel";

const WURZEL = path.resolve(import.meta.dirname, "..");
const HEUTE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
const VIP = `${globalKapital("global_vip", "en").bisZu} ${globalKapital("global_vip", "en").wert}`;

let fehler = 0; let geprueft = 0;
const hinweise: string[] = [];
const ok = (b: boolean, was: string) => { geprueft++; if (!b) { fehler++; console.log(`  FEHLER  ${was}`); } };

// Die deutschen Seiten — direkt aus den Dateien, nicht über index.ts (das lädt die englischen mit).
const { LEISTUNGEN } = await import("../shared/fiaon-global-seiten/leistungen");
const { KOSTEN } = await import("../shared/fiaon-global-seiten/kosten");
const { PREISE_UND_ABLAUF } = await import("../shared/fiaon-global-seiten/preise");
const { ZIELGRUPPEN } = await import("../shared/fiaon-global-seiten/zielgruppen");
const { STAATEN } = await import("../shared/fiaon-global-seiten/staaten");
const { WISSEN } = await import("../shared/fiaon-global-seiten/wissen");
const { WISSEN_GRUENDUNG } = await import("../shared/fiaon-global-seiten/wissen-gruendung");
const { WISSEN_KONTO_KARTEN } = await import("../shared/fiaon-global-seiten/wissen-konto-karten");
const { PARTNER_SEITE } = await import("../shared/fiaon-global-seiten/partner");
const { PRIVAT_SEITE } = await import("../shared/fiaon-global-seiten/privat");
const DEUTSCH: GlobalSeite[] = [...LEISTUNGEN, ...KOSTEN, ...PREISE_UND_ABLAUF, ...ZIELGRUPPEN, PRIVAT_SEITE, ...STAATEN, ...WISSEN, ...WISSEN_GRUENDUNG, ...WISSEN_KONTO_KARTEN, PARTNER_SEITE];
const DE = new Map(DEUTSCH.map((s) => [s.pfad, s]));

// Die englischen Seiten: aus den genannten Dateien oder aus allen in en/.
const EN_ORDNER = path.join(WURZEL, "shared/fiaon-global-seiten/en");
const dateien = process.argv.slice(2).length
  ? process.argv.slice(2).map((d) => path.resolve(d))
  : fs.readdirSync(EN_ORDNER).filter((d) => d.endsWith(".ts") && d !== "fragen.ts" && d !== "index.ts").map((d) => path.join(EN_ORDNER, d));
const englisch: { datei: string; s: GlobalSeite }[] = [];
for (const d of dateien) {
  const m = await import(pathToFileURL(d).href);
  for (const wert of Object.values(m)) {
    const liste = Array.isArray(wert) ? wert : [wert];
    for (const x of liste) if (x && typeof x === "object" && "pfad" in (x as object) && "bloecke" in (x as object)) englisch.push({ datei: path.relative(WURZEL, d), s: x as GlobalSeite });
  }
}

// ── Hilfen ───────────────────────────────────────────────────────────────────
function texte(wert: unknown, pfad: string, aus: [string, string][]) {
  if (typeof wert === "string") { if (wert.trim()) aus.push([pfad, wert]); return; }
  if (Array.isArray(wert)) { wert.forEach((x, i) => texte(x, `${pfad}[${i}]`, aus)); return; }
  if (wert && typeof wert === "object") for (const [k, v] of Object.entries(wert)) texte(v, `${pfad}.${k}`, aus);
}
const OHNE_TEXT = /\.(pfad|art|stand|erschienen|key|kennung|url|paket|typ|id|auftraggeber|sprache|schwester)$|\.weiter\[|\.eintraege\[\d+\]\.pfad$/;
const LINK_ERLAUBT = /^\/(en\/business(\/|#|\?|$)|impressum|datenschutz|cookie-einstellungen)/;
// Deutsche Reste. Erlaubt sind deutsche Fachbegriffe, die der Text bewusst in Klammern/kursiv nennt,
// und Namen (GmbH, Schwarzott, Zefix …) — alles andere mit Umlaut oder deutschem Funktionswort fällt auf.
const DEUTSCH_ERLAUBT = /\b(Typenvergleich|Hinzurechnungsbesteuerung|Körperschaftsteuer\w*|Gewerbesteuer|Abgabenordnung|Außensteuergesetz|Einkommensteuer\w*|Gesellschaftsvertrag|Handelsregister|Bundesfinanzministerium|Schifflände|Zürich|Aktiengesellschaft|GmbH|UG \(haftungsbeschränkt\)|Österreich|Bürgerliches Gesetzbuch|Finanzamt|Stammkapital|Steuerberater|Betriebsstätte|Ort der Geschäftsleitung|tatsächliche Verwaltung|Kapitalgesellschaft|Personengesellschaft)\b/g;
const DEUTSCHE_WOERTER = /\b(und|oder|nicht|der|die|das|den|dem|des|ein|eine|einer|eines|Ihr|Ihre|Ihren|Ihrem|Ihrer|Sie|wir|uns|mit|für|auf|von|zur|zum|ist|sind|wird|werden|bei|nach|über|auch|wie|dass|sich|kein|keine|Jahr|Seite|Frist)\b/;
const DEUTSCHE_ZAHL = /\b\d[\d.]*(,\d+)? ?(\$|€|US-Dollar|Euro)(?![\w])|\b\d{1,3}(\.\d{3})+ ?(\$|€)|\b\d+,\d+ ?%|\b\d{1,2}\. ?(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\b|\b(Januar|Februar|März|Mai|Juni|Juli|Oktober|Dezember)\b/;
const AMERIKANISCH = /\b(organiz\w*|authoriz\w*|recogniz\w*|realiz\w*|analyz\w*|color\w*|favor\w*|behavior\w*|center\w*|advisor\w*|licensed?|license(?! Tax)|fulfill\b|enrollment)\b/i;
const AMERIKANISCH_ERLAUBT = /Articles of Organization|Certificate of Organization|Customer Identification Program|License Tax|\bCenter\b(?= for)|articles of organization/g;

function aufbau(d: GlobalBlock, e: GlobalBlock, wo: string) {
  ok(d.typ === e.typ && d.id === e.id, `${wo}: Baustein ${d.id}/${d.typ} ↔ ${e.id}/${e.typ} (Typ und id müssen gleich sein)`);
  if (d.typ !== e.typ) return;
  const gleich = (a: unknown[] | undefined, b: unknown[] | undefined, was: string) => ok((a?.length ?? 0) === (b?.length ?? 0), `${wo} [${d.id}]: ${was} ${a?.length ?? 0} ↔ ${b?.length ?? 0}`);
  switch (d.typ) {
    case "text": { const x = e as typeof d; gleich(d.absaetze, x.absaetze, "Absätze"); gleich(d.punkte, x.punkte, "Punkte"); ok(!!d.nach === !!x.nach, `${wo} [${d.id}]: „nach" fehlt oder ist zu viel`); break; }
    case "etappen": { const x = e as typeof d; gleich(d.etappen, x.etappen, "Etappen"); ok(!!d.lead === !!x.lead, `${wo} [${d.id}]: lead`); d.etappen.forEach((et, i) => ok(!!et.dauer === !!x.etappen[i]?.dauer, `${wo} [${d.id}]: Etappe ${i + 1} dauer`)); break; }
    case "rollen": { const x = e as typeof d; gleich(d.fiaon, x.fiaon, "FIAON"); gleich(d.partner, x.partner, "Partner"); gleich(d.sie, x.sie, "Sie"); break; }
    case "tabelle": { const x = e as typeof d; gleich(d.kopf, x.kopf, "Spalten"); gleich(d.zeilen, x.zeilen, "Zeilen"); gleich(d.fuss, x.fuss, "Fußnoten"); ok(d.hervor === x.hervor, `${wo} [${d.id}]: hervor`); ok((d.kopf[0] === "") === (x.kopf[0] === ""), `${wo} [${d.id}]: leere erste Kopfzelle muss leer bleiben (Zeilenkopf)`); d.zeilen.forEach((z, i) => ok(z.length === x.zeilen[i]?.length, `${wo} [${d.id}]: Zeile ${i + 1} Zellen`)); break; }
    case "karten": { const x = e as typeof d; gleich(d.karten, x.karten, "Karten"); ok(d.spalten === x.spalten, `${wo} [${d.id}]: spalten`); d.karten.forEach((k, i) => { ok(!!k.tag === !!x.karten[i]?.tag, `${wo} [${d.id}]: Karte ${i + 1} tag`); if (k.pfad) ok(x.karten[i]?.pfad === globalEnPfad(k.pfad), `${wo} [${d.id}]: Karte ${i + 1} pfad ${x.karten[i]?.pfad} ≠ ${globalEnPfad(k.pfad)}`); }); break; }
    case "hinweis": { const x = e as typeof d; gleich(d.punkte, x.punkte, "Punkte"); break; }
    case "paket": { const x = e as typeof d; ok(d.paket === x.paket, `${wo} [${d.id}]: Paket ${d.paket} ↔ ${x.paket}`); break; }
    case "verzeichnis": { const x = e as typeof d; gleich(d.eintraege, x.eintraege, "Einträge"); d.eintraege.forEach((v, i) => ok(x.eintraege[i]?.pfad === globalEnPfad(v.pfad), `${wo} [${d.id}]: Eintrag ${i + 1} ${x.eintraege[i]?.pfad} ≠ ${globalEnPfad(v.pfad)}`)); break; }
    case "fragen": { const x = e as typeof d; gleich(d.fragen, x.fragen, "Fragen"); break; }
    default: break;
  }
}

// ── Prüfung je Seite ─────────────────────────────────────────────────────────
console.log(`\n── Englische Unterseiten (${englisch.length} aus ${dateien.length} Datei(en)) ──────────────────────`);
const gesehen = new Set<string>();
for (const { datei, s: e } of englisch) {
  const wo = `${e.pfad} (${datei})`;
  ok(!gesehen.has(e.pfad), `${wo}: doppelt`); gesehen.add(e.pfad);
  ok(e.sprache === "en", `${wo}: sprache ist nicht "en"`);
  const d = e.schwester ? DE.get(e.schwester) : undefined;
  ok(!!d, `${wo}: schwester ${e.schwester} ist keine deutsche Registerseite`);
  if (!d) continue;
  ok(e.pfad === GLOBAL_EN_PFADE[d.pfad], `${wo}: Adresse muss ${GLOBAL_EN_PFADE[d.pfad]} sein (shared/fiaon-global-pfade.ts)`);
  ok(e.art === d.art && e.kennung === d.kennung && (e.paket ?? null) === (d.paket ?? null) && (e.auftraggeber ?? null) === (d.auftraggeber ?? null) && (e.prio ?? null) === (d.prio ?? null),
    `${wo}: art/kennung/paket/auftraggeber/prio weichen von ${d.pfad} ab`);
  for (const [feld, wert] of [["stand", e.stand], ["erschienen", e.erschienen]] as const) ok(!!wert && /^\d{4}-\d{2}-\d{2}$/.test(wert) && wert <= HEUTE, `${wo}: ${feld} „${wert}" fehlt, ist kein Datum oder liegt in der Zukunft`);
  // SEO
  ok(/ — FIAON Global$/.test(e.seo.titel), `${wo}: Titel endet nicht auf „ — FIAON Global"`);
  ok(e.seo.titel.length <= 60 && titelPixel(e.seo.titel) <= TITEL_MAX_PX, `${wo}: Titel ${e.seo.titel.length} Zeichen / ${titelPixel(e.seo.titel)} px (max 60 / ${TITEL_MAX_PX})`);
  ok(e.seo.beschreibung.length >= 110 && e.seo.beschreibung.length <= 155 && beschreibungPixel(e.seo.beschreibung) <= BESCHREIBUNG_MAX_PX, `${wo}: Beschreibung ${e.seo.beschreibung.length} Zeichen / ${beschreibungPixel(e.seo.beschreibung)} px (110–155 / ≤ ${BESCHREIBUNG_MAX_PX})`);
  ok(e.kurz.trim().length >= 120 && !!e.h1.trim() && !!e.lead.trim(), `${wo}: H1, Lead oder „In brief" fehlt/zu kurz`);
  ok(!!d.h1b === !!e.h1b, `${wo}: h1b`);
  // Aufbau
  ok(e.blick.length === d.blick.length, `${wo}: Blick ${e.blick.length} ↔ ${d.blick.length}`);
  ok((e.ziffern?.length ?? 0) === (d.ziffern?.length ?? 0), `${wo}: Kennziffern ${e.ziffern?.length ?? 0} ↔ ${d.ziffern?.length ?? 0}`);
  ok(e.fragen.length === d.fragen.length, `${wo}: Fragen ${e.fragen.length} ↔ ${d.fragen.length}`);
  ok(e.bloecke.length === d.bloecke.length, `${wo}: Bausteine ${e.bloecke.length} ↔ ${d.bloecke.length}`);
  d.bloecke.forEach((b, i) => e.bloecke[i] && aufbau(b, e.bloecke[i], wo));
  ok(JSON.stringify((e.quellen ?? []).map((q) => q.url)) === JSON.stringify((d.quellen ?? []).map((q) => q.url)), `${wo}: Quellen (Adressen und Reihenfolge) weichen ab`);
  ok(JSON.stringify(e.weiter) === JSON.stringify(d.weiter.map(globalEnPfad)), `${wo}: weiter muss ${JSON.stringify(d.weiter.map(globalEnPfad))} sein`);
  ok(!!d.schluss === !!e.schluss, `${wo}: schluss`);
  // Wege
  const ziele = [...e.weiter, ...e.bloecke.flatMap((b) => (b.typ === "verzeichnis" ? b.eintraege.map((x) => x.pfad) : b.typ === "karten" ? b.karten.map((k) => k.pfad).filter((p): p is string => !!p) : []))];
  for (const z of ziele) ok(LINK_ERLAUBT.test(z) && (!z.startsWith("/en/business/") || Object.values(GLOBAL_EN_PFADE).includes(z.split("#")[0].split("?")[0])), `${wo}: Ziel ${z} ist keine englische Business-Seite`);
  // Worte
  const alle: [string, string][] = [];
  texte({ ...e, quellen: (e.quellen ?? []).map((q) => q.titel) }, e.pfad, alle);
  const volltext = alle.filter(([p]) => !OHNE_TEXT.test(p)).map(([, t]) => t);
  for (const [p, t] of alle) {
    if (OHNE_TEXT.test(p)) continue;
    for (const f of globalWortPruefenEn(t, VIP)) ok(false, `${p}: ${f.hinweis} — „${f.treffer}" in „${t.slice(0, 90)}"`);
    const ohneErlaubt = t.replace(DEUTSCH_ERLAUBT, "");
    const rest = ohneErlaubt.match(/[äöüÄÖÜß]/) ?? ohneErlaubt.match(DEUTSCHE_WOERTER);
    if (rest && !/\.quellen\[/.test(p)) ok(false, `${p}: deutscher Rest „${rest[0]}" in „${t.slice(0, 90)}"`);
    const zahl = t.match(DEUTSCHE_ZAHL);
    if (zahl) ok(false, `${p}: deutsches Zahlen-/Datumsformat „${zahl[0]}" in „${t.slice(0, 90)}"`);
    const us = t.replace(AMERIKANISCH_ERLAUBT, "").match(AMERIKANISCH);
    if (us) hinweise.push(`${p}: amerikanische Schreibweise? „${us[0]}"`);
    if (/\bbusiness cards?\b/i.test(t)) hinweise.push(`${p}: „business card" heißt im britischen Englisch Visitenkarte — „business credit card"`);
  }
  const text = JSON.stringify(volltext);
  const n = (x: string) => text.split(x).length - 1;
  ok(n(GLOBAL_KAPITAL_FREI.en.steuer) >= n(GLOBAL_KAPITAL_FREI.en.satz), `${wo}: Kapital-Satz ohne den Satz zum Partner-Steuerberater`);
  ok(n(GLOBAL_GELD_ZURUECK.en.bedingungen) >= n(GLOBAL_GELD_ZURUECK.en.text), `${wo}: Geld-zurück ohne seine Bedingungen`);
}

console.log(`\n── Ergebnis ──────────────────────────────────────────────────────────`);
if (hinweise.length) { console.log("  Hinweise (kein Fehler):"); for (const h of hinweise.slice(0, 60)) console.log(`    · ${h}`); if (hinweise.length > 60) console.log(`    … und ${hinweise.length - 60} weitere`); }
console.log(`  ${englisch.length} englische Seiten, ${geprueft} Prüfungen, ${fehler} Fehler.`);
process.exit(fehler ? 1 : 0);
