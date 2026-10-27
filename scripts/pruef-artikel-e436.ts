/**
 * PRÜFSTAND FÜR EINEN NEUEN BUSINESS-RATGEBER (27.10.2026, E-436)
 *
 *   npx tsx scripts/pruef-artikel-e436.ts <datei.ts> [<datei.ts> …]
 *
 * Jede Datei exportiert `SEITE` (eine GlobalSeite, deutsch ODER englisch). Geprüft wird ohne DB und ohne Netz,
 * was die Schreib-Agenten vor der Abgabe selbst bestehen müssen — dieselben Grenzen wie pruef-global-seiten.ts
 * und pruef-global-en.ts, nur für EINEN Beitrag und mit klaren Meldungen:
 *   Kopf (Titel ≤ 60 Zeichen / 580 px, Beschreibung 110–155 Zeichen / 1000 px), Aufbau (Blick, Kurz, Bausteine,
 *   Pflichtbausteine „fiaon“, Paket, Hinweis), Fragen, Quellen, Weiterlesen (genau vier bestehende Seiten),
 *   Länge, Wortregeln (deutsch: Hauswand + GLOBAL_SCHAERFER; englisch: GLOBAL_SCHAERFER_EN), keine Superlative.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import type { GlobalBlock, GlobalSeite } from "../shared/fiaon-global-seiten/typen";
import { GLOBAL_SEITEN, GLOBAL_SEITEN_EN } from "../shared/fiaon-global-seiten";
import { globalWortPruefen, globalWortPruefenEn } from "../shared/fiaon-global-wortregeln";
import { titelPixel, beschreibungPixel, TITEL_MAX_PX, BESCHREIBUNG_MAX_PX } from "../shared/fiaon-pixel";

/** Pfade der neuen Beiträge dieser Runde — sie dürfen einander im Weiterlesen nennen, bevor sie im Register stehen. */
const NEU_DE = (process.env.E436_NEU_DE ?? "").split(",").filter(Boolean);
const NEU_EN = (process.env.E436_NEU_EN ?? "").split(",").filter(Boolean);

function texteVon(b: GlobalBlock): string[] {
  const t: string[] = [];
  const x = b as any;
  for (const k of ["h2", "lead", "text", "nach", "quelle"]) if (typeof x[k] === "string") t.push(x[k]);
  for (const k of ["absaetze", "punkte", "fiaon", "partner", "sie", "kopf", "fuss"]) if (Array.isArray(x[k])) t.push(...x[k]);
  if (Array.isArray(x.zeilen)) for (const z of x.zeilen) t.push(...z);
  if (Array.isArray(x.etappen)) for (const e of x.etappen) t.push(e.titel, e.dauer ?? "", e.text);
  if (Array.isArray(x.karten)) for (const k of x.karten) t.push(k.tag ?? "", k.titel, k.text);
  if (Array.isArray(x.fragen)) for (const f of x.fragen) t.push(f.f, f.a);
  return t.filter(Boolean);
}

async function pruefe(datei: string): Promise<string[]> {
  const fehler: string[] = [];
  const f = (bed: boolean, text: string) => { if (!bed) fehler.push(text); };
  const mod = await import(pathToFileURL(resolve(datei)).href);
  const s: GlobalSeite = mod.SEITE;
  if (!s) return [`${datei}: kein Export SEITE`];
  const en = s.sprache === "en";

  // ── Adresse, Art, Kennung
  // Drei Arten in dieser Runde: Ratgeber (wissen), die Länderseite Österreich (land) und die Konzeptseite (leistung).
  const land = /^\/business\/aus-[a-z-]+$/.test(s.pfad) || /^\/en\/business\/from-[a-z-]+$/.test(s.pfad);
  const konzept = s.pfad === "/business/was-ist-fiaon-global" || s.pfad === "/en/business/what-is-fiaon-global";
  const artSoll = land ? "land" : konzept ? "leistung" : "wissen";
  f(s.art === artSoll, `art muss "${artSoll}" sein (ist ${s.art})`);
  if (!land && !konzept) f(en ? /^\/en\/business\/knowledge\/[a-z0-9-]+$/.test(s.pfad) : /^\/business\/wissen\/[a-z0-9-]+$/.test(s.pfad), `pfad ${s.pfad} passt nicht zum Muster ${en ? "/en/business/knowledge/<slug>" : "/business/wissen/<slug>"}`);
  f(/^FG · (4[3-9]|5[0-9])$/.test(s.kennung), `kennung „${s.kennung}“ — erwartet FG · 43 … FG · 59`);
  const bestehend = new Set([...GLOBAL_SEITEN, ...GLOBAL_SEITEN_EN].map((x) => x.pfad));
  f(!bestehend.has(s.pfad), `pfad ${s.pfad} gibt es schon im Register`);
  if (en) f(!!s.schwester && /^\/business\//.test(s.schwester), `englische Seite braucht schwester = deutscher Pfad`);
  f(s.stand === "2026-10-27" && s.erschienen === "2026-10-27", `stand/erschienen müssen "2026-10-27" sein`);

  // ── Kopf für Google
  const t = s.seo.titel; const d = s.seo.beschreibung;
  f(t.endsWith(" — FIAON Global"), `Titel endet nicht auf „ — FIAON Global“`);
  f(t.length <= 60, `Titel ${t.length} Zeichen (höchstens 60): ${t}`);
  f(titelPixel(t) <= TITEL_MAX_PX, `Titel ${Math.round(titelPixel(t))} px (höchstens ${TITEL_MAX_PX})`);
  f(d.length >= 110 && d.length <= 155, `Beschreibung ${d.length} Zeichen (110–155)`);
  f(beschreibungPixel(d) <= BESCHREIBUNG_MAX_PX, `Beschreibung ${Math.round(beschreibungPixel(d))} px (höchstens ${BESCHREIBUNG_MAX_PX})`);

  // ── Aufbau
  f(!!s.h1 && !!s.h1b, `h1 und h1b (kursive zweite Zeile) sind Pflicht`);
  f(s.lead.length >= 180 && s.lead.length <= 520, `lead ${s.lead.length} Zeichen (180–520)`);
  f((s.ziffern?.length ?? 0) >= 2 && (s.ziffern?.length ?? 0) <= 3, `ziffern: zwei oder drei Kennziffern`);
  f(s.blick.length >= 4 && s.blick.length <= 7, `blick: vier bis sieben Zeilen (hat ${s.blick.length})`);
  f(s.blick.some(([l]) => /FIAON Global/.test(l)), `blick: eine Zeile „Mit FIAON Global“ / „With FIAON Global“ fehlt`);
  f(s.kurz.length >= 250 && s.kurz.length <= 750, `kurz ${s.kurz.length} Zeichen (250–750) — beantwortet die Suchfrage in zwei, drei Sätzen`);
  f(s.bloecke.length >= 7, `mindestens sieben Bausteine (hat ${s.bloecke.length})`);
  const ids = s.bloecke.map((b) => b.id);
  f(new Set(ids).size === ids.length, `Baustein-ids doppelt: ${ids.join(", ")}`);
  const fiaon = s.bloecke.find((b) => b.id === "fiaon");
  f(!!fiaon && fiaon.typ === "text" && (en ? /^How FIAON Global /.test((fiaon as any).h2) : /^So übernimmt FIAON Global /.test((fiaon as any).h2)),
    `Baustein id "fiaon" (typ text, h2 „${en ? "How FIAON Global …" : "So übernimmt FIAON Global …"}“) fehlt — Justin: FIAON als die Lösung`);
  f(s.bloecke.some((b) => b.typ === "paket" || (konzept && b.typ === "pakete")), `Baustein typ "paket" fehlt`);
  f(s.bloecke.some((b) => b.typ === "hinweis"), `Baustein typ "hinweis" (ehrliche Grenzen) fehlt`);
  f(s.bloecke.some((b) => b.typ === "tabelle" || b.typ === "etappen"), `mindestens eine Tabelle oder Etappen (zitierfähig für KI-Suchen)`);
  if (!konzept) f(!!s.paket, `paket fehlt (auf welches Paket zeigen die Knöpfe?)`);

  // ── Fragen, Quellen, Weiterlesen
  f(s.fragen.length >= 5 && s.fragen.length <= 8, `fragen: fünf bis acht (hat ${s.fragen.length})`);
  for (const q of s.fragen) f(q.a.length <= 480, `Antwort zu lang (${q.a.length} > 480): ${q.f}`);
  f((s.quellen?.length ?? 0) >= 3, `quellen: mindestens drei Primärquellen`);
  for (const q of s.quellen ?? []) f(/^https:\/\//.test(q.url) && q.titel.length > 5, `Quelle ohne https/Titel: ${q.url}`);
  f(s.weiter.length === 4, `weiter: genau vier Ziele (das Raster hat vier Spalten), hat ${s.weiter.length}`);
  const erlaubt = new Set([...bestehend, ...(en ? NEU_EN : NEU_DE)]);
  for (const w of s.weiter) f(erlaubt.has(w) && w !== s.pfad, `weiter ${w}: keine bestehende ${en ? "englische" : "deutsche"} Seite`);
  for (const b of s.bloecke) {
    const x = b as any;
    for (const k of x.karten ?? []) if (k.pfad) f(erlaubt.has(k.pfad), `Karte verlinkt ${k.pfad} — keine bestehende Seite`);
    for (const e of x.eintraege ?? []) f(erlaubt.has(e.pfad), `Verzeichnis verlinkt ${e.pfad} — keine bestehende Seite`);
  }

  // ── Länge und Wortregeln über ALLES, was der Leser sieht
  const alle = [s.seo.titel, s.seo.beschreibung, s.auge, s.h1, s.h1b ?? "", s.lead, s.kurz, ...(s.ziffern ?? []).flatMap((z) => [z.wert, z.label]),
    ...s.blick.flat(), ...s.bloecke.flatMap(texteVon), ...s.fragen.flatMap((q) => [q.f, q.a]), ...(s.schluss ? [s.schluss.a, s.schluss.b, s.schluss.text] : [])];
  const woerter = alle.join(" ").split(/\s+/).filter(Boolean).length;
  f(woerter >= (en ? 1250 : 1300), `nur ${woerter} Wörter (mindestens ${en ? 1250 : 1300} — die Suchfrage gründlich beantworten)`);
  const superlativ = /game ?changer|platz ?1|nummer ?(eins|1)|nr\.? ?1|marktführer|bester anbieter|beste[rn]? lösung|number one|market leader|best provider|#1/i;
  for (const x of alle) {
    if (superlativ.test(x)) fehler.push(`Superlativ/Platz-Werbung: „${x.match(superlativ)![0]}“ — Kanzlei-Ton, YMYL`);
    if (en) for (const h of globalWortPruefenEn(x, "up to $1,000,000")) fehler.push(`Wortregel EN: „${h.treffer}“ — ${h.hinweis}`);
    else for (const h of globalWortPruefen(x)) fehler.push(`Wortregel DE (${h.quelle}): „${h.treffer}“ — ${h.hinweis}`);
    if (/\b\d{1,3}(?:[.,]\d+)?\s?%\s*(zins|interest|apr|sollzins)/i.test(x) || /(zins|interest rate|apr)\D{0,20}\d+(?:[.,]\d+)?\s?%/i.test(x)) fehler.push(`Zinssatz als Zahl: „${x.slice(0, 80)}“ — verbotene Aussage 1`);
    if (/(wir|fiaon)\s+(vermitteln|beschaffen|besorgen)\s+(ihnen\s+)?(kredit|kapital|darlehen|finanzierung)/i.test(x) && !/(nicht|kein)/i.test(x)) fehler.push(`„FIAON vermittelt Kapital“: „${x.slice(0, 90)}“ — verbotene Aussage 2`);
    if (/(steuer\w*\s+(sparen|vermeiden|senken)|steuerfrei\b|tax[- ]free|avoid(ing)? tax)/i.test(x) && !/(kein|nicht|never|not|no |myth|mythos|„|“|")/i.test(x)) fehler.push(`Steuerversprechen: „${x.slice(0, 90)}“ — verbotene Aussage 3`);
    if (en && /\b(color|organization|organize|center|favor|license(?!e)|analyze|program(?!me))\b/.test(x)) fehler.push(`amerikanische Schreibung: „${x.match(/\b(color|organization|organize|center|favor|license|analyze|program)\b/)![0]}“ — britisches Englisch`);
  }
  return fehler.map((x) => `${s.pfad}: ${x}`);
}

const dateien = process.argv.slice(2);
if (!dateien.length) { console.error("Aufruf: npx tsx scripts/pruef-artikel-e436.ts <datei.ts> …"); process.exit(2); }
let summe = 0;
for (const d of dateien) {
  const fehler = await pruefe(d);
  summe += fehler.length;
  console.log(fehler.length ? fehler.map((x) => `  FEHLER  ${x}`).join("\n") : `  ok      ${d}`);
}
console.log(`\n${dateien.length} Beitrag/Beiträge geprüft, ${summe} Fehler.`);
process.exit(summe ? 1 : 0);
