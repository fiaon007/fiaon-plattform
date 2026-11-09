// ═══════════════════════════════════════════════════════════════════════════
// DATENRAUM FÜR INVESTOREN — BEFÜLLEN UND PRÜFEN VON JUSTINS RECHNER (E-489, 09.11.2026)
//
// Der Weg für Inhalte, die nie ins (öffentliche) Repo gehören: Räume, Projekte, Gäste und Unterlagen kommen
// aus Dateien auf diesem Rechner in die Datenbank. Dieselben Funktionen wie das Chefbüro
// (server/lib/fiaon-datenraum.ts) — es gibt keinen zweiten Schreibweg.
//
// FÜR DIE PRODUKTION gilt die Hausregel „Produktion schreiben nur als Plattform-Code“: Raum, Freigabe, Unterlagen und
// Einladung laufen dort über das Chefbüro (Akte › Datenraum: „Ordner hochladen“ liest denselben Ordner mit
// manifest.json und raum.json). Dieses Skript ist für den lokalen Prüfstand und für die PRÜFUNG der Fallsätze ohne
// Datenbank (nda-aus-papier, nda-vorschau --datei …). --produktion bleibt nur als Notweg mit Justins ausdrücklichem Go.
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=… [SESSION_SECRET=…] [APP_BASE_URL=https://fiaon.com] \
//     npx tsx scripts/datenraum.ts <befehl> [optionen] [--schreiben] [--produktion]
//
//   OHNE DATENBANK (nichts wird geschrieben ausser den genannten Dateien, die NIE im Repo liegen dürfen):
//   nda-aus-papier --html nda.html --raum-datei raum.json --gast-datei gast.json [--titel „Datenraum …“]
//                liest die Fallsätze aus der Papierfassung (Zusätze, Projekte mit §-1-Text und geschützter Gesellschaft,
//                Partei 3) und schreibt raum.json und gast.json. Danach Titel, Ordnerbeschreibungen und Schlüssel prüfen.
//   nda-vorschau --datei raum.json [--gast-datei gast.json] [--vergleich nda.html]
//                setzt die Vereinbarung wie ein Gast sie sieht und vergleicht sie Abschnitt für Abschnitt mit der
//                Papierfassung. Gewollt anders: § 8 Abs. 1, § 10 Abs. 5, Anlage 1. Grün = Ende 0, sonst 1.
//
//   MIT DATENBANK:
//   liste        [--raum <id>]                         Räume, Projekte, Unterlagen, Gäste (nur lesen)
//   raum-anlegen --datei raum.json [--raum <id>] [--partner <firmaId>]
//                raum.json: { "titel": "…", "partnerFirmaId": 12, "nda": { "vorgestellt": "…", "zweck": "…", "vorab": "…",
//                "partei2Zusatz": "…", "zusatz4": "…" }, "projekte": [{ "schluessel": "a", "titel": "…", "beschreibung": "…",
//                "ndaText": "…", "geschuetzt": "die …-Gesellschaft" }] } — Projekte werden über „schluessel“ abgeglichen;
//                ohne --raum gilt ein offener Raum mit gleichem TITEL als derselbe (hat er noch keinen Partner, bekommt er
//                --partner; hat er einen anderen, Abbruch mit Hinweis auf --raum).
//   nda-vorschau --raum <id> [--gast <id>] [--vergleich nda.html] [--freigeben --schreiben]
//                wie oben, aus der Datenbank; --freigeben gibt den Wortlaut frei (mit --vergleich nur, wenn grün).
//   gast-anlegen --raum <id> (--datei gast.json | --vorname … --nachname … --email … [--anrede herr|frau] [--firma …] …)
//                [--neuer-code] [--code-datei <pfad>] → Link und Code GENAU EINMAL (gespeichert wird nur die Prüfsumme).
//                Lokal auf dem Bildschirm; gegen die Produktion NUR in eine Datei (--code-datei, Rechte 600) — nie in den
//                Sitzungsverlauf. Der Raum braucht eine freigegebene Vereinbarung.
//   hochladen    --raum <id> --ordner <pfad>
//                je Unterordner ein Projekt: Name = „schluessel“ des Projekts oder beginnt mit seinem Buchstaben
//                („A“, „A_Alpha“, „b-beta“). Darin manifest.json = Liste
//                [{ "nr": 1, "titel": "…", "beschreibung": "…", "datei": "x.pdf", "sichtbar_standard": true }].
//                Idempotent über SHA-256: gleicher Inhalt → nichts Neues (Titel/Beschreibung/Reihenfolge werden
//                aufgefrischt, die Sichtbarkeit bleibt); neuer Inhalt unter gleichem „datei“ → ersetzt die alte Fassung.
//   sichtbar     (--dokument <id|kennung> | --raum <id> --alle [--projekt <Buchstabe>]) --an|--aus
//
// ── SCHUTZ ────────────────────────────────────────────────────────────────
//   Ohne --schreiben: Vorschau — nichts wird geschrieben (auch keine Tabellen angelegt).
//   DATABASE_URL auf 127.0.0.1/localhost: lokal. Jede andere Datenbank nur mit --produktion (Justins Go);
//   geschrieben wird auch dort nur mit --schreiben. Das Skript schickt nie eine Mail.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const argv = process.argv.slice(2);
const befehl = argv[0] ?? "";
const arg = (name: string): string | null => { const i = argv.indexOf(name); return i > 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : null; };
const hat = (name: string) => argv.includes(name);
const schreiben = hat("--schreiben");
const produktion = hat("--produktion");
const BEFEHLE = ["liste", "raum-anlegen", "gast-anlegen", "hochladen", "sichtbar", "nda-vorschau", "nda-aus-papier"];
if (!BEFEHLE.includes(befehl)) {
  console.error(`Befehl fehlt oder unbekannt. Möglich: ${BEFEHLE.join(", ")}. Einzelheiten im Kopf von scripts/datenraum.ts.`);
  process.exit(2);
}
function jsonLesen(datei: string): any {
  try { return JSON.parse(fs.readFileSync(datei, "utf8")); } catch (e) { console.error(`ABBRUCH: ${datei} lässt sich nicht als JSON lesen (${e instanceof Error ? e.message : e}).`); process.exit(2); }
}
/** Fallangaben gehören nie ins Repo — Dateien darin werden nicht geschrieben. */
function ausserhalbRepo(datei: string): boolean {
  const repo = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
  const ziel = path.resolve(datei);
  return !(ziel === repo || ziel.startsWith(`${repo}${path.sep}`));
}

// ═══════════════════════════════════════════════════════════════════════════
// OHNE DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
const ohneDb = befehl === "nda-aus-papier" || (befehl === "nda-vorschau" && !arg("--raum"));
if (ohneDb) {
  const N = await import("../shared/fiaon-datenraum-nda");
  const V = await import("../server/lib/fiaon-datenraum-vergleich");
  const bericht = (vergleich: ReturnType<typeof V.drVergleichen>) => {
    console.log(`\nVergleich mit der Papierfassung: ${vergleich.gleich.length} Abschnitte wortgleich, ${vergleich.anders.length} anders, ${vergleich.nurPapier.length} nur auf Papier, ${vergleich.nurVorlage.length} nur elektronisch.`);
    for (const a of vergleich.anders) console.log(`  ${a.erwartet ? "gewollt " : "ANDERS  "} ${a.schluessel}: ${a.diff.slice(0, 900)}`);
    for (const s of vergleich.nurPapier) console.log(`  ${(V.DR_ERWARTET_ANDERS as readonly string[]).includes(s) ? "gewollt " : "FEHLT   "} ${s} (nur auf Papier)`);
    for (const s of vergleich.nurVorlage) console.log(`  ${(V.DR_ERWARTET_ANDERS as readonly string[]).includes(s) ? "gewollt " : "ZUSATZ  "} ${s} (nur elektronisch)`);
    console.log(vergleich.gruen ? "\nGRÜN — nur die gewollten Abweichungen (§ 8 Abs. 1, § 10 Abs. 5, Anlage 1)." : "\nROT — es gibt Abweichungen, die nicht gewollt sind (siehe oben).");
  };
  if (befehl === "nda-aus-papier") {
    const html = arg("--html"); const raumDatei = arg("--raum-datei"); const gastDatei = arg("--gast-datei");
    if (!html || !raumDatei || !gastDatei) { console.error("ABBRUCH: --html, --raum-datei und --gast-datei sind Pflicht."); process.exit(2); }
    if (!ausserhalbRepo(raumDatei) || !ausserhalbRepo(gastDatei)) { console.error("ABBRUCH: raum.json und gast.json enthalten Fallangaben — sie dürfen nie im Repo liegen. Bitte einen Pfad ausserhalb wählen."); process.exit(2); }
    const papier = V.drPapierBloecke(fs.readFileSync(html, "utf8"));
    const a = V.drAusPapier(papier);
    for (const f of a.fehler) console.error(`  HINWEIS: ${f}`);
    const raum = { titel: arg("--titel") ?? "Datenraum", ...a.raum };
    fs.writeFileSync(raumDatei, `${JSON.stringify(raum, null, 2)}\n`, { mode: 0o600 });
    fs.writeFileSync(gastDatei, `${JSON.stringify(a.gast, null, 2)}\n`, { mode: 0o600 });
    console.log(`Geschrieben: ${raumDatei} (${raum.projekte.length} Projekte, ${Object.values(raum.nda).filter(Boolean).length} Zusätze) und ${gastDatei}.`);
    const bl = N.drNdaBloecke({ gast: a.gast, projekte: raum.projekte.map((p, i) => ({ buchstabe: N.drBuchstabe(i), titel: p.titel, text: p.ndaText, geschuetzt: p.geschuetzt || null })), raum: raum.nda });
    const v = V.drVergleichen(papier, V.drVorlageTextBloecke(bl, a.gast));
    bericht(v);
    console.log("Weiter: Titel des Raums und je Projekt eine kurze Ordnerbeschreibung in raum.json eintragen (die Titel stehen in § 1 — nur ändern, wenn auch die Vereinbarung sie so nennen soll), dann nda-vorschau --datei … --vergleich ….");
    process.exit(v.gruen && !a.fehler.length ? 0 : 1);
  }
  // nda-vorschau ohne Datenbank
  const datei = arg("--datei");
  if (!datei) { console.error("ABBRUCH: --datei raum.json (oder --raum <id> mit Datenbank) fehlt."); process.exit(2); }
  const j = jsonLesen(datei);
  const gastRoh = arg("--gast-datei") ? jsonLesen(arg("--gast-datei")!) : null;
  const gast = gastRoh ? { ...N.DR_GAST_LEER, ...gastRoh } : { ...N.DR_GAST_LEER, vorname: "‹Vorname›", nachname: "‹Nachname›", strasse: "‹Strasse›", plz: "‹PLZ›", ort: "‹Ort›", land: "‹Land›", email: "‹E-Mail›" };
  if (gastRoh) { const p = N.drGastAngabenPruefen(gast); if (!p.ok) console.error(`  HINWEIS: Die Angaben in gast.json bestehen die Prüfung der Seite nicht: ${JSON.stringify(p.fehler)}`); }
  const projekte = (Array.isArray(j.projekte) ? j.projekte : []).map((p: any, i: number) => ({ buchstabe: N.drBuchstabe(i), titel: String(p.titel ?? ""), text: String(p.ndaText || p.beschreibung || p.titel || ""), geschuetzt: p.geschuetzt || null }));
  const bl = N.drNdaBloecke({ gast, projekte, raum: j.nda ?? {} });
  console.log(`Vereinbarung (Fassung ${N.NDA_FASSUNG}) für „${j.titel ?? "?"}“ — ${projekte.length} Themen, Prüfsumme ${createHash("sha256").update(N.drNdaKanonisch(bl)).digest("hex")}`);
  for (const b of bl) if (b.art === "thema") console.log(`  ${b.bu} · ${b.titel} — ${b.text.slice(0, 140)}${b.text.length > 140 ? "…" : ""}`);
  const html = arg("--vergleich");
  if (!html) { console.log("\nOhne --vergleich kein Abgleich mit der Papierfassung."); process.exit(0); }
  const v = V.drVergleichen(V.drPapierBloecke(fs.readFileSync(html, "utf8")), V.drVorlageTextBloecke(bl, gastRoh ? gast : null));
  bericht(v);
  process.exit(v.gruen ? 0 : 1);
}

// ═══════════════════════════════════════════════════════════════════════════
// MIT DATENBANK
// ═══════════════════════════════════════════════════════════════════════════
const url = String(process.env.DATABASE_URL ?? "");
let host = ""; try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost", "::1"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (Justins Go). Für die Produktion gilt das Chefbüro (Akte › Datenraum).`); process.exit(2); }
// Code und Link gehören nie in den Sitzungsverlauf: gegen die Produktion nur in eine Datei — geprüft, BEVOR verbunden wird.
if (befehl === "gast-anlegen" && !lokal && !arg("--code-datei")) { console.error("ABBRUCH: Gegen die Produktion nur mit --code-datei <pfad> — Code und Link gehören nicht in den Sitzungsverlauf. Besser: im Chefbüro einladen (Code einmal, Entwurf in js@)."); process.exit(2); }
// Codes sind ein HMAC mit SESSION_SECRET (fiaon-datenraum-regeln.ts): Ohne den Schlüssel der Produktion passt der Code dort nie.
if (befehl === "gast-anlegen" && !lokal && !process.env.SESSION_SECRET) { console.error("ABBRUCH: SESSION_SECRET der Produktion fehlt — ein Code mit einem anderen Schlüssel öffnet den Datenraum nicht. Besser: im Chefbüro einladen."); process.exit(2); }
const schreibt = befehl !== "liste" && schreiben;
console.log(`Datenbank: ${lokal ? "lokal" : `PRODUKTION (${host})`} · ${befehl === "liste" ? "nur lesen" : schreibt ? "SCHREIBT" : "Vorschau (ohne --schreiben wird nichts geschrieben)"}`);

const { sqlPool } = await import("../server/lib/db-pool");
const L = await import("../server/lib/fiaon-datenraum");
const { drDateiTyp } = await import("../server/lib/fiaon-datenraum-regeln");
const { drVorbefuellungPruefen, drVollName } = await import("../shared/fiaon-datenraum-nda");
const WER = "Skript datenraum.ts";

async function tabellenDa(): Promise<boolean> {
  const [z] = (await sqlPool`SELECT to_regclass('public.fiaon_dr_raeume') IS NOT NULL AS da, to_regclass('public.fiaon_dr_gaeste') IS NOT NULL AS g`) as any[];
  return !!z?.da && !!z?.g;
}
const id = (v: string | null) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : 0; };
const kb = (b: number) => (b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
async function ende(code = 0): Promise<never> { await sqlPool.end({ timeout: 5 }).catch(() => {}); process.exit(code); }

const da = await tabellenDa();
if (!da && (befehl === "liste" || !schreibt)) {
  console.log("Die Tabellen des Datenraums gibt es in dieser Datenbank noch nicht (der Server legt sie beim Start an; --schreiben auch).");
  if (befehl === "liste") await ende(0);
}
if (schreibt) await L.drSchema();
/** Gibt es die Tabellen (vorher schon oder jetzt durch --schreiben angelegt)? */
const lesbar = da || schreibt;

// ── liste ──────────────────────────────────────────────────────────────────
if (befehl === "liste") {
  const raumId = id(arg("--raum"));
  const raeume = (await sqlPool`SELECT id, titel, partner_firma_id, archiviert_am, nda_freigabe, created_at FROM fiaon_dr_raeume WHERE (${raumId || null}::bigint IS NULL OR id = ${raumId || null}::bigint) ORDER BY id`) as any[];
  if (!raeume.length) console.log("Keine Räume.");
  for (const r of raeume) {
    console.log(`\nRaum ${r.id} · ${r.titel}${r.partner_firma_id ? ` · Partner ${r.partner_firma_id}` : " · ohne Partner"}${r.archiviert_am ? " · ARCHIVIERT" : ""}${r.nda_freigabe ? " · Vereinbarung freigegeben (Stand prüfen: nda-vorschau --raum)" : " · Vereinbarung NICHT freigegeben"}`);
    const projekte = (await sqlPool`SELECT id, buchstabe, schluessel, titel FROM fiaon_dr_projekte WHERE raum_id = ${r.id} AND entfernt_am IS NULL ORDER BY length(buchstabe), buchstabe`) as any[];
    for (const p of projekte) {
      console.log(`  ${p.buchstabe} · ${p.titel}  [schluessel ${p.schluessel}, id ${p.id}]`);
      const docs = (await sqlPool`SELECT id, kennung, nr, titel, groesse, sichtbar, vermerk_moeglich, mime FROM fiaon_dr_dokumente WHERE projekt_id = ${p.id} AND entfernt_am IS NULL ORDER BY nr, titel`) as any[];
      for (const d of docs) console.log(`     ${String(d.nr).padStart(2, "0")}. ${d.sichtbar ? "sichtbar  " : "UNSICHTBAR"} ${d.titel} · ${kb(Number(d.groesse))}${d.mime === "application/pdf" && d.vermerk_moeglich === false ? " · ohne Vermerk" : ""}  [id ${d.id}, ${d.kennung}]`);
      if (!docs.length) console.log("     (noch keine Unterlagen)");
    }
    const gaeste = (await sqlPool`
      SELECT g.id, g.vorname, g.nachname, g.email, g.code_hinweis, g.angaben_am, g.gesperrt_am,
             (SELECT MAX(n.unterzeichnet_am) FROM fiaon_dr_nda n WHERE n.gast_id = g.id) AS nda_am
        FROM fiaon_dr_gaeste g WHERE g.raum_id = ${r.id} ORDER BY g.id`) as any[];
    for (const g of gaeste) {
      const st = g.gesperrt_am ? "GESPERRT" : g.nda_am ? `NDA ${new Date(g.nda_am).toISOString().slice(0, 16)}` : g.angaben_am ? "Angaben gemacht" : "eingeladen";
      console.log(`  Gast ${g.id} · ${g.vorname} ${g.nachname} · ${g.email} · Code …${g.code_hinweis ?? "?"} · ${st}`);
    }
    if (!gaeste.length) console.log("  (noch kein Gast)");
  }
  await ende(0);
}

// ── raum-anlegen ───────────────────────────────────────────────────────────
if (befehl === "raum-anlegen") {
  const datei = arg("--datei");
  if (!datei) { console.error("ABBRUCH: --datei raum.json fehlt."); await ende(2); }
  const j = jsonLesen(datei!);
  const partner = id(arg("--partner")) || id(String(j.partnerFirmaId ?? "")) || null;
  const projekte: any[] = Array.isArray(j.projekte) ? j.projekte : [];
  if (!String(j.titel ?? "").trim()) { console.error("ABBRUCH: „titel“ fehlt in der Datei."); await ende(2); }
  for (const p of projekte) if (!String(p?.titel ?? "").trim() || !String(p?.schluessel ?? "").trim()) { console.error("ABBRUCH: Jedes Projekt braucht „schluessel“ und „titel“."); await ende(2); }
  let raumId = id(arg("--raum"));
  let partnerSetzen = !!partner;
  if (!raumId && lesbar) {
    // Abgleich NUR über den Titel (Gutachten: Titel + Partner legte nach einem Lauf ohne Partner einen zweiten Raum an).
    const gleich = (await sqlPool`SELECT id, partner_firma_id FROM fiaon_dr_raeume WHERE titel = ${String(j.titel).trim()} AND archiviert_am IS NULL ORDER BY id`) as any[];
    if (gleich.length > 1) { console.error(`ABBRUCH: Es gibt ${gleich.length} offene Räume mit diesem Titel (${gleich.map((g) => g.id).join(", ")}) — bitte mit --raum <id> wählen.`); await ende(2); }
    if (gleich[0]) {
      raumId = Number(gleich[0].id);
      const hatPartner = gleich[0].partner_firma_id != null ? Number(gleich[0].partner_firma_id) : null;
      if (partner && hatPartner && hatPartner !== partner) { console.error(`ABBRUCH: Raum ${raumId} mit diesem Titel gehört zu Partner ${hatPartner}, nicht ${partner}. Bitte mit --raum <id> bestätigen oder einen anderen Titel wählen.`); await ende(2); }
      partnerSetzen = !!partner && !hatPartner;
      console.log(`Raum mit diesem Titel gibt es schon (id ${raumId}) — er wird abgeglichen${partnerSetzen ? ` und Partner ${partner} zugeordnet` : ""}.`);
    }
  }
  console.log(`${raumId ? `Raum ${raumId} abgleichen` : "Neuer Raum"}: „${j.titel}“${partner ? ` · Partner ${partner}` : " · ohne Partner (im Chefbüro zuordnen oder --partner)"}`);
  for (const p of projekte) console.log(`  Projekt [${p.schluessel}] ${p.titel}${p.ndaText ? "" : " · § 1 nutzt die Beschreibung"}${p.geschuetzt ? ` · § 4: ${p.geschuetzt}` : ""}`);
  if (!schreibt) { console.log("\nVorschau — mit --schreiben wird angelegt."); await ende(0); }
  if (!raumId) {
    const e = await L.drRaumAnlegen({ titel: j.titel, firmaId: partner, nda: j.nda, projekte }, WER);
    if (!e.ok) { console.error(`FEHLER: ${e.error}`); await ende(1); }
    console.log(`Angelegt: Raum ${(e as any).id}.`);
    raumId = (e as any).id;
  } else {
    const e = await L.drRaumAendern(raumId, { titel: j.titel, nda: j.nda, ...(partnerSetzen ? { firmaId: partner } : {}) }, WER);
    if (!e.ok) { console.error(`FEHLER: ${e.error}`); await ende(1); }
    for (const p of projekte) {
      const r = await L.drProjektSpeichern(raumId, p, WER);
      console.log(r.ok ? `  ${r.buchstabe} · ${p.titel} ${r.neu ? "angelegt" : "aufgefrischt"}` : `  FEHLER bei ${p.schluessel}: ${r.error}`);
    }
  }
  console.log(`Fertig. Weiter: nda-vorschau --raum ${raumId} --vergleich <nda.html> [--freigeben --schreiben], dann hochladen --raum ${raumId} --ordner <pfad>`);
  await ende(0);
}

// ── nda-vorschau (mit Datenbank) ───────────────────────────────────────────
if (befehl === "nda-vorschau") {
  const raumId = id(arg("--raum"));
  const gastId = id(arg("--gast")) || null;
  if (!lesbar) { console.error("ABBRUCH: Die Tabellen gibt es noch nicht."); await ende(2); }
  const v = await L.drNdaVorschau(raumId, gastId);
  if (!v.ok) { console.error(`FEHLER: ${v.error}`); await ende(1); }
  const vv = v as any;
  console.log(`Vereinbarung für Raum ${raumId}${gastId ? ` mit den Angaben von Gast ${gastId}` : " mit Platzhaltern"} — Prüfsumme ${vv.hash}; Raum-Fassung ${String(vv.raumHash).slice(0, 12)} · ${vv.freigegeben ? "FREIGEGEBEN" : "nicht freigegeben"}`);
  for (const b of vv.bloecke) if (b.art === "thema") console.log(`  ${b.bu} · ${b.titel} — ${String(b.text).slice(0, 140)}${String(b.text).length > 140 ? "…" : ""}`);
  let gruen = true;
  const html = arg("--vergleich");
  if (html) {
    const V = await import("../server/lib/fiaon-datenraum-vergleich");
    const erg = V.drVergleichen(V.drPapierBloecke(fs.readFileSync(html, "utf8")), V.drVorlageTextBloecke(vv.bloecke, gastId ? vv.gast : null));
    console.log(`\nVergleich: ${erg.gleich.length} wortgleich, ${erg.anders.length} anders, ${erg.nurPapier.length} nur auf Papier, ${erg.nurVorlage.length} nur elektronisch.`);
    for (const a of erg.anders) console.log(`  ${a.erwartet ? "gewollt " : "ANDERS  "} ${a.schluessel}: ${a.diff.slice(0, 900)}`);
    for (const s of [...erg.nurPapier, ...erg.nurVorlage]) console.log(`  ${(V.DR_ERWARTET_ANDERS as readonly string[]).includes(s) ? "gewollt " : "ANDERS  "} ${s}`);
    gruen = erg.gruen;
    console.log(gruen ? "GRÜN — nur die gewollten Abweichungen." : "ROT — nicht gewollte Abweichungen (siehe oben).");
  }
  if (hat("--freigeben")) {
    if (html && !gruen) { console.error("ABBRUCH: Freigabe nur, wenn der Vergleich grün ist."); await ende(1); }
    if (!html) console.log("Hinweis: Freigabe ohne Vergleich mit einer Papierfassung.");
    if (!schreibt) { console.log("Vorschau — mit --schreiben wird freigegeben."); await ende(0); }
    const f = await L.drNdaFreigeben(raumId, WER, vv.raumHash);
    console.log(f.ok ? `FREIGEGEBEN (Raum-Fassung ${String(vv.raumHash).slice(0, 12)}).` : `FEHLER: ${(f as any).error}`);
    await ende(f.ok ? 0 : 1);
  }
  await ende(gruen ? 0 : 1);
}

// ── gast-anlegen ───────────────────────────────────────────────────────────
if (befehl === "gast-anlegen") {
  const raumId = id(arg("--raum"));
  if (!raumId) { console.error("ABBRUCH: --raum <id> fehlt."); await ende(2); }
  const codeDatei = arg("--code-datei");
  if (codeDatei && !ausserhalbRepo(codeDatei)) { console.error("ABBRUCH: Die Code-Datei darf nicht im Repo liegen."); await ende(2); }
  const datei = arg("--datei");
  const roh = datei ? jsonLesen(datei) : {
    anrede: arg("--anrede") ?? "", vorname: arg("--vorname"), nachname: arg("--nachname"), email: arg("--email"), firma: arg("--firma"),
    funktion: arg("--funktion"), strasse: arg("--strasse"), plz: arg("--plz"), ort: arg("--ort"), land: arg("--land"), telefon: arg("--telefon"),
  };
  const v = drVorbefuellungPruefen(roh);
  if (!v.ok) { console.error(`ABBRUCH: ${v.error}`); await ende(2); }
  const w = (v as any).wert;
  const [schon] = lesbar ? (await sqlPool`SELECT id FROM fiaon_dr_gaeste WHERE raum_id = ${raumId} AND lower(einladung_email) = lower(${w.email}) LIMIT 1`) as any[] : [];
  console.log(`Gast: ${drVollName(w)} · ${w.email}${w.firma ? ` · ${w.firma}` : ""} → Raum ${raumId}${schon ? ` (gibt es schon: Gast ${schon.id})` : ""}`);
  if (schon && !hat("--neuer-code")) { console.error("ABBRUCH: Diesen Gast gibt es in dem Raum schon. Mit --neuer-code bekommt er einen neuen Code (der alte wird ungültig)."); await ende(2); }
  if (!schreibt) { console.log("\nVorschau — mit --schreiben werden Code und Link erzeugt (und nur einmal ausgegeben)."); await ende(0); }
  const e = schon ? await L.drGastCodeNeu(Number(schon.id), WER) : await L.drGastEinladen(raumId, w, WER);
  if (!e.ok) { console.error(`FEHLER: ${e.error}`); await ende(1); }
  const r = e as any;
  if (codeDatei) {
    fs.writeFileSync(codeDatei, `Datenraum — Zugang für ${drVollName(w)} (nur einmal erzeugt, gespeichert ist nur die Prüfsumme)\nCode: ${r.code}\nLink: ${r.link}\n`, { mode: 0o600 });
    console.log(`Code und Link stehen in ${codeDatei} (Rechte 600). Nach dem Versand die Datei löschen.`);
  } else {
    console.log("\n══════════════════════════════════════════════════════════════");
    console.log("  NUR JETZT SICHTBAR — gespeichert ist nur die Prüfsumme.");
    console.log(`  Code:  ${r.code}`);
    console.log(`  Link:  ${r.link}`);
    console.log("══════════════════════════════════════════════════════════════\n");
  }
  await ende(0);
}

// ── hochladen ──────────────────────────────────────────────────────────────
if (befehl === "hochladen") {
  const raumId = id(arg("--raum"));
  const ordner = arg("--ordner");
  if (!raumId || !ordner) { console.error("ABBRUCH: --raum <id> und --ordner <pfad> sind Pflicht."); await ende(2); }
  if (!fs.existsSync(ordner!) || !fs.statSync(ordner!).isDirectory()) { console.error(`ABBRUCH: ${ordner} ist kein Ordner.`); await ende(2); }
  const projekte = lesbar ? (await sqlPool`SELECT id, buchstabe, schluessel, titel FROM fiaon_dr_projekte WHERE raum_id = ${raumId} AND entfernt_am IS NULL`) as any[] : [];
  if (lesbar && !projekte.length) { console.error(`ABBRUCH: Raum ${raumId} hat keine Projekte (erst raum-anlegen).`); await ende(2); }
  const zuordnen = (name: string) => {
    const n = name.toLowerCase();
    return projekte.find((p) => String(p.schluessel).toLowerCase() === n)
      ?? projekte.find((p) => { const b = String(p.buchstabe).toLowerCase(); return n === b || n.startsWith(`${b}_`) || n.startsWith(`${b}-`) || n.startsWith(`${b} `); });
  };
  const unter = fs.readdirSync(ordner!, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith(".")).map((d) => d.name).sort();
  if (!unter.length) { console.error("ABBRUCH: Keine Unterordner gefunden (je Projekt einer)."); await ende(2); }
  let fehler = 0; let neu = 0; let gleich = 0; let ersetzt = 0;
  for (const u of unter) {
    const p = zuordnen(u);
    const manifestPfad = path.join(ordner!, u, "manifest.json");
    if (!fs.existsSync(manifestPfad)) { console.error(`  ${u}: manifest.json fehlt — übersprungen.`); fehler++; continue; }
    const liste = jsonLesen(manifestPfad);
    if (!Array.isArray(liste)) { console.error(`  ${u}: manifest.json ist keine Liste — übersprungen.`); fehler++; continue; }
    if (lesbar && !p) { console.error(`  ${u}: passt zu keinem Projekt (${projekte.map((x) => `${x.buchstabe}/${x.schluessel}`).join(", ")}) — übersprungen.`); fehler++; continue; }
    console.log(`\n${u} → ${p ? `${p.buchstabe} · ${p.titel}` : "(Projekt wird beim Schreiben zugeordnet)"}`);
    for (const m of liste) {
      const dateiName = String(m?.datei ?? "");
      const pfad = path.join(ordner!, u, dateiName);
      if (!dateiName || dateiName.includes("..") || dateiName.includes("/") || !fs.existsSync(pfad)) { console.error(`  FEHLT: ${dateiName || "(ohne „datei“)"}`); fehler++; continue; }
      const buf = fs.readFileSync(pfad);
      const typ = drDateiTyp(buf);
      if ("fehler" in typ) { console.error(`  ABGELEHNT: ${dateiName} — ${typ.fehler}`); fehler++; continue; }
      const sha = createHash("sha256").update(buf).digest("hex");
      const sichtbar = m.sichtbar_standard !== false;
      if (!schreibt) {
        const [vorhanden] = p ? (await sqlPool`SELECT id, sichtbar FROM fiaon_dr_dokumente WHERE projekt_id = ${p.id} AND sha256 = ${sha} AND entfernt_am IS NULL`) as any[] : [];
        const [alt] = p && !vorhanden ? (await sqlPool`SELECT id FROM fiaon_dr_dokumente WHERE projekt_id = ${p.id} AND quelle = ${dateiName} AND entfernt_am IS NULL LIMIT 1`) as any[] : [];
        console.log(`  ${String(m.nr ?? "").padStart(2, " ")}. ${m.titel ?? dateiName} · ${typ.endung} · ${kb(buf.length)} · ${vorhanden ? "schon da (gleicher Inhalt)" : alt ? `ersetzt Dokument ${alt.id}` : sichtbar ? "neu, sichtbar" : "neu, unsichtbar"}`);
        continue;
      }
      const e = await L.drDokumentAblegen({
        projektId: Number(p.id), buffer: buf, dateiname: dateiName, titel: m.titel, beschreibung: m.beschreibung, sichtbar,
        nr: Number.isInteger(Number(m.nr)) ? Number(m.nr) : 0, quelle: dateiName,
      }, WER);
      if (!e.ok) { console.error(`  FEHLER: ${dateiName} — ${e.error}`); fehler++; continue; }
      const r = e as any;
      if (!r.neu) gleich++; else if (r.ersetzt) ersetzt++; else neu++;
      console.log(`  ${String(m.nr ?? "").padStart(2, " ")}. ${r.meldung}  [id ${r.id}]`);
    }
  }
  console.log(`\n${schreibt ? `Fertig: ${neu} neu, ${ersetzt} ersetzt, ${gleich} unverändert` : "Vorschau"}${fehler ? `, ${fehler} Probleme (siehe oben)` : ""}.`);
  await ende(fehler ? 1 : 0);
}

// ── sichtbar ───────────────────────────────────────────────────────────────
if (befehl === "sichtbar") {
  const an = hat("--an"); const aus = hat("--aus");
  if (an === aus) { console.error("ABBRUCH: genau eins von --an oder --aus."); await ende(2); }
  const dok = arg("--dokument");
  const raumId = id(arg("--raum"));
  const buchstabe = arg("--projekt");
  let ziele: any[] = [];
  if (dok) {
    ziele = (await sqlPool`SELECT id, titel, sichtbar FROM fiaon_dr_dokumente WHERE entfernt_am IS NULL AND (kennung = ${dok} OR id::text = ${dok}) LIMIT 1`) as any[];
  } else if (raumId && hat("--alle")) {
    ziele = (await sqlPool`
      SELECT d.id, d.titel, d.sichtbar FROM fiaon_dr_dokumente d JOIN fiaon_dr_projekte p ON p.id = d.projekt_id
       WHERE d.raum_id = ${raumId} AND d.entfernt_am IS NULL AND (${buchstabe}::text IS NULL OR upper(p.buchstabe) = upper(${buchstabe}::text)) ORDER BY d.id`) as any[];
  } else { console.error("ABBRUCH: --dokument <id|kennung> oder --raum <id> --alle [--projekt <Buchstabe>]."); await ende(2); }
  if (!ziele.length) { console.error("Nichts gefunden."); await ende(1); }
  for (const z of ziele) console.log(`  ${z.titel}: ${z.sichtbar ? "sichtbar" : "unsichtbar"} → ${an ? "sichtbar" : "unsichtbar"}`);
  if (!schreibt) { console.log("\nVorschau — mit --schreiben wird umgeschaltet."); await ende(0); }
  for (const z of ziele) { const e = await L.drDokumentAendern(Number(z.id), { sichtbar: an }, WER); if (!e.ok) console.error(`  FEHLER ${z.id}: ${e.error}`); }
  console.log("Fertig.");
  await ende(0);
}
