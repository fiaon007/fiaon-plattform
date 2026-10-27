/**
 * PRÜFSTAND FÜR EINEN NEUEN PRIVAT-RATGEBER (27.10.2026, E-439)
 *
 *   npx tsx scripts/pruef-privat-e439.ts <datei.ts> [<datei.ts> …]
 *
 * Jede Datei exportiert `ARTIKEL` (ein StartArtikel wie in server/lib/fiaon-ratgeber-werkzeuge-4.ts).
 * Es gilt das Tor der Redaktion — pruefstand(…, { streng: true }) aus shared/fiaon-ratgeber.ts, dasselbe,
 * durch das jeder Tagesartikel muss —, dazu: Slug frei (nicht in der Liste .arbeit/ratgeber-db.txt),
 * Abschnitt „Was nicht geht“, Quellenblock, FIAON als Lösung mit Link, Schuldnerberatung genannt.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { pruefstand } from "../shared/fiaon-ratgeber";

const vergeben = existsSync(".arbeit/ratgeber-db.txt") ? readFileSync(".arbeit/ratgeber-db.txt", "utf8") : "";
let summe = 0;
for (const d of process.argv.slice(2)) {
  const a = (await import(pathToFileURL(resolve(d)).href)).ARTIKEL;
  const fehler: string[] = [];
  if (!a) { console.log(`  FEHLER  ${d}: kein Export ARTIKEL`); summe++; continue; }
  const p = pruefstand({ titel: a.titel, teaser: a.teaser, inhalt: a.inhalt, faq: a.faq, metaTitel: a.metaTitel, metaBeschreibung: a.metaBeschreibung, keyword: a.keyword }, { streng: true });
  for (const x of p.punkte) if (x.art === "fehler") fehler.push(`Tor der Redaktion: ${x.text}`);
  if (vergeben.includes(`/ratgeber/${a.slug}|`)) fehler.push(`Slug ${a.slug} gibt es schon`);
  if (!/^[a-z0-9-]{8,90}$/.test(a.slug)) fehler.push(`Slug „${a.slug}“: nur a–z, 0–9, Bindestrich`);
  if (a.metaTitel.length > 60) fehler.push(`metaTitel ${a.metaTitel.length} Zeichen (höchstens 60)`);
  if (a.metaBeschreibung.length < 120 || a.metaBeschreibung.length > 158) fehler.push(`metaBeschreibung ${a.metaBeschreibung.length} Zeichen (120–158)`);
  if (!/^## Was nicht geht/m.test(a.inhalt)) fehler.push(`Abschnitt „## Was nicht geht“ fehlt (Hausregel)`);
  if (!/^## Quellen/m.test(a.inhalt)) fehler.push(`Abschnitt „## Quellen“ fehlt (E-034: jede Zahl mit Quelle)`);
  if (!/\]\(\/(preise|privatkunden|bonitaetsauskunft|antrag-neu|termin)[^)]*\)/.test(a.inhalt)) fehler.push(`FIAON als Lösung: ein Link auf /preise, /privatkunden, /bonitaetsauskunft, /antrag-neu oder /termin fehlt`);
  if (!/schuldnerberatung/i.test(a.inhalt)) fehler.push(`Die kostenlose Schuldnerberatung wird nicht genannt`);
  if (a.faq.length < 5) fehler.push(`nur ${a.faq.length} Fragen (mindestens 5)`);
  const worte = a.inhalt.split(/\s+/).filter(Boolean).length;
  if (worte < 1500) fehler.push(`nur ${worte} Wörter (mindestens 1.500)`);
  summe += fehler.length;
  console.log(fehler.length ? fehler.map((x) => `  FEHLER  ${a.slug}: ${x}`).join("\n") : `  ok      ${a.slug} (${worte} Wörter)`);
}
console.log(`\n${process.argv.length - 2} Artikel geprüft, ${summe} Fehler.`);
process.exit(summe ? 1 : 0);
