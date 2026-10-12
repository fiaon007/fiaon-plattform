// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DIE FACHBEREICHE DES GLOBAL-PORTALS (E-341, 12.10.2026)
//
//   npx tsx scripts/pruef-global-fach.ts
//
// Liest die Inhalte (Strategie, Recht, Steuern) und prüft JEDEN Kundensatz
// gegen die Hauswand (wandPruefen) und die schärferen Global-Regeln
// (globalWortPruefen): nichts garantieren, nicht „beraten“, nichts empfehlen,
// kein „bis zu“, kein Bankname, keine Frist mit Ziffer, kein Steuerversprechen.
// Dazu der Aufbau: Pflichtfelder, eindeutige ids, Quellen als https-Adressen,
// Platzhalter jeder Vorlage haben ein Feld.
// Ohne Datenbank, ohne Netz.
// ═══════════════════════════════════════════════════════════════════════════
import { wandPruefen } from "../shared/fiaon-wortverbote";
import { globalWortPruefen } from "../shared/fiaon-global-wortregeln";
import type { FachKapitel, FachFormular, FachVorlage } from "../shared/fiaon-global-fach";

let ok = 0; const fehler: string[] = [];
const pruef = (bed: boolean, text: string) => { if (bed) ok++; else fehler.push(text); };

// In Vorlagen (englische Vertragstexte) gelten die deutschen Wortregeln nicht — dort nur der Aufbau.
function satzPruefen(wo: string, text: string) {
  if (!text) return;
  const funde = wandPruefen(text, ["notiz_an_betreuer", "aufgabe_an_betreuer"]);
  const hart = funde.filter((f) => f.art === "verboten");
  pruef(hart.length === 0, `${wo}: Hauswand „${hart.map((f) => f.treffer).join("“, „")}“ — ${text.slice(0, 120)}`);
  const g = globalWortPruefen(text).filter((f) => f.quelle === "global");
  pruef(g.length === 0, `${wo}: Global-Regel „${g.map((f) => f.treffer).join("“, „")}“ (${g[0]?.hinweis ?? ""}) — ${text.slice(0, 120)}`);
}

function kapitelPruefen(name: string, liste: FachKapitel[]) {
  const ids = new Set<string>();
  pruef(liste.length >= 8, `${name}: mindestens acht Kapitel (hat ${liste.length})`);
  for (const k of liste) {
    pruef(!ids.has(k.id), `${name}: doppelte id ${k.id}`); ids.add(k.id);
    pruef(!!k.titel && !!k.kurz && !!k.gruppe && k.abschnitte.length >= 2 && !!k.stand, `${name}/${k.id}: Pflichtfelder`);
    for (const q of k.quellen ?? []) pruef(/^https:\/\//.test(q.url), `${name}/${k.id}: Quelle ohne https (${q.url})`);
    satzPruefen(`${name}/${k.id}/titel`, k.titel); satzPruefen(`${name}/${k.id}/kurz`, k.kurz);
    for (const a of k.abschnitte) {
      if (a.titel) satzPruefen(`${name}/${k.id}`, a.titel);
      for (const s of a.absaetze) satzPruefen(`${name}/${k.id}`, s);
      for (const s of a.liste ?? []) satzPruefen(`${name}/${k.id}`, s);
      if (a.merke) satzPruefen(`${name}/${k.id}`, a.merke);
    }
    for (const s of k.umsetzen ?? []) satzPruefen(`${name}/${k.id}/umsetzen`, s);
  }
}

function formularePruefen(liste: FachFormular[]) {
  const ids = new Set<string>();
  pruef(liste.length >= 8, `Formulare: mindestens acht (hat ${liste.length})`);
  for (const f of liste) {
    pruef(!ids.has(f.id), `Formulare: doppelte id ${f.id}`); ids.add(f.id);
    pruef(!!f.nummer && !!f.titel && !!f.wer && !!f.wann && !!f.was && f.schritte.length >= 2 && !!f.fiaon && /^https:\/\//.test(f.quelle?.url ?? ""), `Formular ${f.id}: Pflichtfelder/Quelle`);
    for (const s of [f.titel, f.wer, f.wann, f.folgen ?? "", f.was, f.fiaon, ...f.schritte]) satzPruefen(`Formular ${f.id}`, s);
  }
}

function vorlagenPruefen(liste: FachVorlage[]) {
  const ids = new Set<string>();
  pruef(liste.length >= 6, `Vorlagen: mindestens sechs (hat ${liste.length})`);
  for (const v of liste) {
    pruef(!ids.has(v.id), `Vorlagen: doppelte id ${v.id}`); ids.add(v.id);
    pruef(!!v.titel && !!v.dokumentTitel && !!v.wozu && !!v.wann && v.text.length >= 4 && v.unterschriften.length >= 1 && !!v.art, `Vorlage ${v.id}: Pflichtfelder`);
    const keys = new Set(v.felder.map((f) => f.key));
    const benutzt = new Set(v.text.join("\n").match(/\{\{([a-zA-Z0-9_]+)\}\}/g)?.map((m) => m.slice(2, -2)) ?? []);
    for (const b of benutzt) pruef(keys.has(b), `Vorlage ${v.id}: Platzhalter {{${b}}} ohne Feld`);
    for (const k of keys) pruef(benutzt.has(k), `Vorlage ${v.id}: Feld ${k} wird im Text nicht benutzt`);
    for (const s of [v.titel, v.wozu, v.wann, ...v.felder.map((f) => f.label), ...v.felder.map((f) => f.hilfe ?? "")]) satzPruefen(`Vorlage ${v.id}`, s);
    // Pdf-Schrift (WinAnsi): keine Zeichen außerhalb Latin-1 + typografische Anführungszeichen
    const roh = v.text.join("\n");
    pruef(!/[^\u0000-ÿ–—‘’‚“”„•…€]/.test(roh), `Vorlage ${v.id}: Zeichen außerhalb der PDF-Schrift`);
  }
}

const laden = async (pfad: string) => { try { return await import(pfad); } catch (e) { fehler.push(`${pfad} fehlt oder kompiliert nicht: ${String(e).slice(0, 160)}`); return null; } };

const strategie = await laden("../shared/fiaon-global-fach-strategie");
if (strategie) kapitelPruefen("Strategie", strategie.FACH_STRATEGIE_KAPITEL ?? []);
const recht = await laden("../shared/fiaon-global-fach-recht");
if (recht) { kapitelPruefen("Recht", recht.FACH_RECHT_KAPITEL ?? []); vorlagenPruefen(recht.FACH_VORLAGEN ?? []); }
const steuern = await laden("../shared/fiaon-global-fach-steuern");
if (steuern) { kapitelPruefen("Steuern", steuern.FACH_STEUERN_KAPITEL ?? []); formularePruefen(steuern.FACH_FORMULARE ?? []); }

console.log(`\nFACHBEREICHE: ${ok} ok, ${fehler.length} rot`);
for (const f of fehler.slice(0, 60)) console.log("  ✗", f);
if (fehler.length > 60) console.log(`  … und ${fehler.length - 60} weitere`);
process.exit(fehler.length ? 1 : 0);
