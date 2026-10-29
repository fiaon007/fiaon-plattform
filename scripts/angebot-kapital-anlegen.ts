// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: EIN KAPITAL-ANGEBOT FÜR FIRMENKUNDEN AUS PRIVATEN DATEIEN ANLEGEN
// Register E-399 (19.10.2026) — Muster: scripts/angebot-koop-anlegen.ts
//
// Das Repo ist öffentlich (E-242). Deshalb steht hier KEIN Kundendatum: alles kommt aus Dateien AUSSERHALB des Repos:
//   --datei <angebot-daten.json>        { fassung?, gueltigBis?, personId?, kunde, buergin, parameter? }
//   --compliance <compliance-daten.json> Prüfbericht im Schema der Firmenangebote (complianceKundenfassung)
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… SESSION_SECRET=… \
//     npx tsx scripts/angebot-kapital-anlegen.ts --datei <privat.json> --compliance <bericht.json>   → Vorschau (nichts geschrieben)
//   … --schreiben                → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion   → gegen die Produktion, NUR mit Justins Go
//   … --vorschau <datei.html>    → wohin die Vorschau des Vertrags geht (Vorgabe: neben der Datei)
//   … --bilder <ordner>          → E-402: die Teamfotos (parameter.team[].foto als Bildname, z. B. team-x.webp) aus dem Ordner prüfen,
//                                   ohne Metadaten an das Angebot binden (fiaon_global_angebot_bilder, nur hinter dem Link).
//                                   Gelesen werden NUR die Dateien, die das Team beim Namen nennt; ein Name, der nach einer
//                                   Unterlage aussieht (Ausweis, Pass, Gehalt, Konto), bricht ab. Fassung A/B und C (E-432).
// Ein zweiter Lauf legt kein zweites Angebot an: Gibt es für dieselbe E-Mail schon ein OFFENES Kapital-Angebot, trägt er
// Kunde, Bürgin, Parameter, Prüfbericht und Gültigkeit dort nach (kapitalAendern). Ein angenommenes fasst er nie an.
//
// ── FASSUNG C — PRIVATPERSONEN (E-432, 27.10.2026) ─────────────────────────
// Trägt die Datei kunde.art „privat“ (oder fassung IA-KAPITAL-…-C), läuft der Weg der Fassung C: Kunde als Privatperson
// (Name, Geburtsdatum/-ort, Staatsangehörigkeit, Anschrift, E-Mail, ausweise[]), parameter nach KapitalCParameter
// (Preise als Endpreise, Finanzierung, Kurs, Konditionen, Unterlagen-Titel; „projekt“ nur noch als Datenfeld — seit Justins Wort vom
// 27.10.2026, 17:40 zeigt kein Kundentext einen Verwendungszweck), buergin wie Fassung B. KEIN Prüfbericht
// (--compliance wird dort nicht gelesen). Die Vorschau schreibt den Vertrag UND die Raten je Laufzeit in die Ausgabe.
// Die Ausweis- und Gehaltsbilder bleiben in der privaten Ablage — dieses Skript lädt sie NIE hoch. Hochgeladen werden nur die
// Teamfotos mit --bilder (Justin 27.10.2026, abends: „Das gesamte Team mit Fotos noch anfügen“): wie A/B, geprüft schon in der
// Vorschau (fehlt ein Bild, bricht der Lauf ab, bevor etwas geschrieben ist); nach dem Anlegen/Nachtragen sagt das Skript, welches
// Teamfoto am Angebot noch fehlt. Das Team steht nur auf der Seite, nie im Vertrag — die Prüfsumme bleibt gleich.
// Runde 2 (27.10.2026): Die Doppel-Suche findet nur offene Angebote der Fassung C (ein Firmen-Kapital-Angebot derselben Adresse
// bleibt unberührt). Mit --schreiben --produktion bricht es ab, wenn SESSION_SECRET fehlt (der Link wäre in der Produktion ungültig)
// oder der Registerstand einer inaktiven Bürgin älter als sieben Tage ist. Der Link für die Mail kommt am sichersten aus dem
// Chefbüro („Link kopieren“, vom Server signiert); das Skript druckt ihn immer absolut.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
const datei = arg("--datei"); const complianceDatei = arg("--compliance"); const vorschauDatei = arg("--vorschau"); const bilderOrdner = arg("--bilder");
if (!datei) { console.error("ABBRUCH: --datei <angebot-daten.json> fehlt."); process.exit(2); }
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (und Justins Go).`); process.exit(2); }
if (schreiben && lokal && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL)) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt. Lokal bitte mit env -i starten."); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const C = await import("../server/lib/fiaon-global-angebot-kapital");
const S = await import("../shared/fiaon-global-angebot-kapital");
const F = await import("../server/lib/fiaon-global-angebot-firma");
const FS = await import("../shared/fiaon-global-angebot-firma");
const A = await import("../server/lib/fiaon-global-angebot");

const roh = JSON.parse(fs.readFileSync(datei, "utf8"));
if (roh?.kunde?.art === "privat" || /^IA-KAPITAL-.*-C$/.test(String(roh?.fassung ?? ""))) {
  const gut = await fassungC(roh);
  await sqlPool.end();
  process.exit(gut ? 0 : 1);
}
const k = F.firmaKundePruefen(roh.kunde);
if (!k.ok) { console.error(`FEHLER Kunde: ${k.error}`); process.exit(1); }
// E-465 (29.10.2026): neue Angebote mit Staaten-Wahl — „bundesstaat“ in der Datei: Delaware, Florida oder Wyoming (ohne Angabe Delaware).
// Ein schon offenes Angebot behält beim Nachtragen seine Staaten-Fassung (Server) und ohne Angabe seinen Staat.
const SB = await import("../shared/fiaon-global-bundesstaaten");
const parameter = S.kapitalParameterAus(SB.neuesAngebotParameter(roh.parameter));
console.log(`Bundesstaat: ${parameter.bundesstaat} (E-465: ${SB.staatenAufzaehlung()}; ohne Angabe ${SB.STAAT_VORGABE_NAME}) · Zeiten: ${SB.staatEintragungSatz(parameter.bundesstaat)}`);
const pf = S.kapitalParameterFehler(parameter);
if (pf) { console.error(`FEHLER Parameter: ${pf}`); process.exit(1); }
const buergin = C.kapitalBuerginAus(roh.buergin);
const bf = S.kapitalBuerginFehler(buergin);
if (bf) { console.error(`FEHLER Bürgin: ${bf}`); process.exit(1); }
const complianceRoh = complianceDatei ? JSON.parse(fs.readFileSync(complianceDatei, "utf8")) : null;
const compliance = complianceRoh ? FS.complianceKundenfassung(complianceRoh) : null;
if (compliance) console.log(`Prüfbericht: ${compliance.meta.firma} · Gesamtampel ${compliance.gesamt.ampel} · ${compliance.bereiche.length} Bereiche`);

const d = { ref: "FIAON-IA-CVORSCHAU", fassung: String(roh.fassung || S.KAPITAL_FASSUNG), kunde: k.kunde, buergin, parameter, compliance, gueltigBis: String(roh.gueltigBis || "2026-12-31") };
const ziel = vorschauDatei ?? path.join(path.dirname(path.resolve(datei)), "vertrag-vorschau.html");
fs.writeFileSync(ziel, `<!doctype html><meta charset="utf-8"><title>Vorschau</title><body style="max-width:860px;margin:40px auto;font-family:Inter,Arial,sans-serif">${C.kapitalVorschauHtml(d)}</body>`);
console.log(`Vorschau des Vertrags: ${ziel}`);
console.log(`Kunde: ${k.kunde.firma.name} · Prüfsumme der Vorschau ${C.kapitalTextHash(d).slice(0, 16)}…`);
const fehlt = S.kapitalPflichtFehlen(d);
console.log(fehlt.length ? `Für die Annahme fehlt: ${fehlt.join(" · ")}` : "Pflichtfelder vollständig.");

if (!schreiben) { console.log("Nur Vorschau — zum Anlegen --schreiben."); await sqlPool.end(); process.exit(0); }

// E-402: Teamfotos aus dem Ordner (nur Bildnamen aus den Daten) — geprüft und ohne Metadaten (teamBilderLesen, auch für Fassung C)
const bilder = await teamBilderLesen(parameter.team);

await A.ensureAngebotTabellen();
const [offen] = (await sqlPool`
  SELECT id, angebot_ref FROM fiaon_global_angebote
   WHERE status = 'offen' AND fassung LIKE 'IA-KAPITAL-%' AND lower(kunde->>'email') = ${k.kunde.email.toLowerCase()} ORDER BY id DESC LIMIT 1`) as any[];
if (offen) {
  const erg = await C.kapitalAendern(Number(offen.id), { kunde: k.kunde, buergin, parameter: { ...parameter, bundesstaat: roh.parameter?.bundesstaat ?? undefined } as typeof parameter, ...(complianceRoh ? { compliance: complianceRoh } : {}), ...(roh.gueltigBis ? { gueltigBis: roh.gueltigBis } : {}) }, "Skript angebot-kapital-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  const z = (await A.angebotLesen({ id: Number(offen.id) }))!;
  const dz = C.kapitalDatenAus(z);
  if (bilder.length) { const bs = await F.firmaBilderSpeichern(Number(offen.id), bilder, "Skript angebot-kapital-anlegen"); console.log(bs.ok ? `Bilder: ${bs.gespeichert} eingespielt` : `FEHLER Bilder: ${bs.error}`); }
  console.log(`Nachgetragen: ${offen.angebot_ref} · Link: ${A.angebotKundenPfad(A.angebotTokenErzeugen(dz.ref, dz.gueltigBis))}`);
} else {
  const erg = await C.kapitalAnlegen({ ...roh, kunde: k.kunde, buergin, parameter, compliance: complianceRoh }, "Skript angebot-kapital-anlegen");
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  if (bilder.length) { const bs = await F.firmaBilderSpeichern(erg.id, bilder, "Skript angebot-kapital-anlegen"); console.log(bs.ok ? `Bilder: ${bs.gespeichert} eingespielt` : `FEHLER Bilder: ${bs.error}`); }
  console.log(`Angelegt: ${erg.ref} (id ${erg.id}) · Link: ${erg.link}`);
}
await sqlPool.end();
process.exit(0);

// ═══════════════════════════════════════════════════════════════════════════
// FASSUNG C (Privatperson, E-432)
// ═══════════════════════════════════════════════════════════════════════════
async function fassungC(roh: any): Promise<boolean> {
  const KC = await import("../server/lib/fiaon-global-angebot-kapital-c");
  const SC = await import("../shared/fiaon-global-angebot-kapital-c");
  const k = SC.kapitalCKundePruefen(roh.kunde);
  if (!k.ok) { console.error(`FEHLER Kunde: ${k.error}`); await sqlPool.end(); process.exit(1); }
  const SB = await import("../shared/fiaon-global-bundesstaaten");
  const parameter = SC.kapitalCParameterAus(SB.neuesAngebotParameter(roh.parameter));
  console.log(`Bundesstaat: ${parameter.bundesstaat} (E-465: ${SB.staatenAufzaehlung()}; ohne Angabe ${SB.STAAT_VORGABE_NAME}) · Zeiten: ${SB.staatEintragungSatz(parameter.bundesstaat)}`);
  const pf = SC.kapitalCParameterFehler(parameter);
  if (pf) { console.error(`FEHLER Parameter: ${pf}`); await sqlPool.end(); process.exit(1); }
  const buergin = C.kapitalBuerginAus(roh.buergin);
  const bf = SC.kapitalCBuerginFehler(buergin);
  if (bf) { console.error(`FEHLER Bürgin: ${bf}`); await sqlPool.end(); process.exit(1); }
  if (complianceDatei) console.log("Hinweis: Fassung C hat keinen Prüfbericht — --compliance wird nicht gelesen.");
  const d = { ref: "FIAON-IA-CVORSCHAU", fassung: SC.KAPITAL_C_FASSUNG, kunde: k.kunde, buergin, parameter, gueltigBis: String(roh.gueltigBis || "2026-12-31") };
  const ziel = vorschauDatei ?? path.join(path.dirname(path.resolve(datei!)), "vertrag-vorschau.html");
  fs.writeFileSync(ziel, `<!doctype html><meta charset="utf-8"><title>Vorschau</title><body style="max-width:860px;margin:40px auto;font-family:Inter,Arial,sans-serif">${KC.kapitalCVorschauHtml(d)}</body>`);
  console.log(`Vorschau des Vertrags: ${ziel}`);
  console.log(`Kunde: ${SC.kapitalCName(k.kunde)} (Privatperson) · Prüfsumme der Vorschau ${KC.kapitalCTextHash(d).slice(0, 16)}…`);
  console.log(`Finanzierung ${SC.kapitalCEurCent(parameter.betragCents)} · Kurs ${parameter.kursUsdJeEur} (${parameter.kursDatum}) · heute ${SC.kapitalCEurCent(SC.kapitalCHeuteCents(parameter))}, bei Eintragung ${SC.kapitalCEurCent(parameter.erfolgCents)}, ab Jahr 2 ${SC.kapitalCEurCent(parameter.jahresCents)}`);
  for (const j of SC.kapitalCLaufzeiten(parameter)) {
    const pl = SC.kapitalCPlan(parameter, j);
    console.log(`  ${String(j).padStart(2)} Jahre: Rate ${SC.kapitalCEurCent(pl.monatsrateCents).padStart(12)} (≈ ${SC.kapitalCUsd(pl.usd.monatsrate)}) · Zinsen ${SC.kapitalCEurCent(pl.zinsenCents)} · Rückzahlung ${SC.kapitalCEurCent(pl.rueckzahlungCents)} · Zins zuletzt ${SC.kapitalCProzent(pl.zinsZuletztBp)}`);
  }
  const fehlt = SC.kapitalCPflichtFehlen(d);
  console.log(fehlt.length ? `Für die Annahme fehlt: ${fehlt.join(" · ")}` : "Pflichtfelder vollständig.");
  // Justin 27.10.2026, abends: das Team mit Fotos (wie A/B). Die Fotos prüft schon die Vorschau — fehlt eines, bricht der Lauf ab,
  // bevor etwas geschrieben ist. Das Team steht nur auf der Seite: Die Prüfsumme oben ist mit und ohne Team dieselbe.
  const teamNamen = teamBildNamen(parameter.team);
  const haus = parameter.team.filter((t) => String(t.foto ?? "").startsWith("haus:")).length;
  console.log(`Team: ${parameter.team.length} Person(en) · ${haus} Porträt(s) des Hauses · ${teamNamen.length} Foto(s) am Angebot · Prüfsumme ohne Team ${KC.kapitalCTextHash({ ...d, parameter: { ...parameter, team: [] } }) === KC.kapitalCTextHash(d) ? "gleich" : "ANDERS"}`);
  const bilder = await teamBilderLesen(parameter.team);
  if (teamNamen.length && !bilderOrdner) console.log(`Hinweis: ${teamNamen.length} Teamfoto(s) als Bildname, aber ohne --bilder — liegen sie noch nicht am Angebot, zeigt die Seite dort Initialen.`);
  // Runde 2: Der Satz „derzeit als inaktiv geführt (Stand …)“ steht im Vertrag — ein alter Stand ist beim Versand falsch oder veraltet.
  const standAlter = parameter.buerginStandAm ? Math.round((Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00Z`) - Date.parse(`${parameter.buerginStandAm}T12:00:00Z`)) / 864e5) : null;
  if (!parameter.buerginAktiv && (standAlter == null || standAlter > 7)) {
    const satz = `Registerstand der Bürgin ${standAlter == null ? "ohne Datum" : `älter als 7 Tage (${standAlter} Tage)`} — Sunbiz am Versandtag prüfen und buerginStandAm setzen (bei aktiv: buerginAktiv=true).`;
    if (schreiben && produktion) { console.error(`ABBRUCH: ${satz}`); await sqlPool.end(); process.exit(2); }
    console.log(`WARNUNG: ${satz}`);
  }
  if (!schreiben) { console.log("Nur Vorschau — zum Anlegen --schreiben."); return true; }
  // Der Link wird mit SESSION_SECRET signiert — ohne das Geheimnis der Produktion wäre er dort ungültig (403).
  if (produktion && !process.env.SESSION_SECRET) { console.error("ABBRUCH: --produktion ohne SESSION_SECRET — der gedruckte Link wäre in der Produktion ungültig. Link sonst aus dem Chefbüro („Link kopieren“)."); await sqlPool.end(); process.exit(2); }
  await A.ensureAngebotTabellen();
  // Runde 2 (Technik): NUR Fassung C — ein offenes Firmen-Kapital-Angebot (A/B) derselben Adresse darf hier nie überschrieben werden.
  const [offen] = (await sqlPool`
    SELECT id, angebot_ref, fassung FROM fiaon_global_angebote
     WHERE status = 'offen' AND fassung LIKE 'IA-KAPITAL-%-C' AND lower(kunde->>'email') = ${k.kunde.email.toLowerCase()} ORDER BY id DESC LIMIT 1`) as any[];
  let id: number;
  if (offen) {
    const erg = await KC.kapitalCAendern(Number(offen.id), { kunde: k.kunde, buergin, parameter: { ...parameter, bundesstaat: roh.parameter?.bundesstaat ?? undefined } as typeof parameter, ...(roh.gueltigBis ? { gueltigBis: roh.gueltigBis } : {}) }, "Skript angebot-kapital-anlegen");
    if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
    id = Number(offen.id);
    const z = (await A.angebotLesen({ id }))!;
    const dz = KC.kapitalCDatenAus(z);
    const { absoluteUrl } = await import("../server/fiaon-base-url");
    console.log(`Nachgetragen: ${offen.angebot_ref} · Link: ${absoluteUrl(A.angebotKundenPfad(A.angebotTokenErzeugen(dz.ref, dz.gueltigBis)))}`);
  } else {
    const erg = await KC.kapitalCAnlegen({ ...roh, kunde: k.kunde, buergin, parameter }, "Skript angebot-kapital-anlegen");
    if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
    id = erg.id;
    console.log(`Angelegt: ${erg.ref} (id ${erg.id}) · Link: ${erg.link}`);
  }
  // Die Teamfotos ans Angebot (wie A/B: firmaBilderSpeichern, nur hinter dem Link) — und sagen, welches dort noch fehlt.
  let gut = true;
  if (bilder.length) {
    const bs = await F.firmaBilderSpeichern(id, bilder, "Skript angebot-kapital-anlegen");
    if (bs.ok) console.log(`Bilder: ${bs.gespeichert} eingespielt`); else { console.error(`FEHLER Bilder: ${bs.error}`); gut = false; }
  }
  if (teamNamen.length) {
    const da = new Set(await F.firmaBilderNamen(id));
    const fehlen = teamNamen.filter((n) => !da.has(n));
    console.log(fehlen.length ? `WARNUNG: ${fehlen.length} Teamfoto(s) fehlen am Angebot (${fehlen.join(", ")}) — mit --bilder <ordner> nachholen; bis dahin stehen dort Initialen.` : `Teamfotos am Angebot: alle ${teamNamen.length} da.`);
  }
  return gut;
}

// ═══════════════════════════════════════════════════════════════════════════
// TEAMFOTOS (E-402, für Fassung C mit E-432) — NUR die Bilder, die das Team beim Namen nennt
// ═══════════════════════════════════════════════════════════════════════════
/** Die Bildnamen am Angebot, die das Team nennt (ohne „haus:“-Porträts), jeder einmal. */
function teamBildNamen(team: { foto?: string | null }[]): string[] {
  return Array.from(new Set(team.map((t) => String(t.foto ?? "")).filter((n) => FS.FIRMA_BILD_NAME.test(n))));
}
/** Mit --bilder: die genannten Teamfotos aus dem Ordner lesen, prüfen und ohne Metadaten zurückgeben — sonst nichts. */
async function teamBilderLesen(team: { foto?: string | null }[]): Promise<{ name: string; daten: Buffer; typ: "image/webp" | "image/png" | "image/jpeg" }[]> {
  const aus: { name: string; daten: Buffer; typ: "image/webp" | "image/png" | "image/jpeg" }[] = [];
  if (!bilderOrdner) return aus;
  // Ein Name, der nach einer Unterlage aussieht — solche Dateien lädt dieses Skript nie hoch (hier, nicht oben im Modul: die
  // Funktion läuft, bevor der Lauf das Modulende erreicht).
  const UNTERLAGE_NAME = /(ausweis|reisepass|passport|gehalt|lohn|konto|identit|(^|-)pass(-|\.)|(^|-)id(-|\.))/;
  const { bildOhneMetadaten } = await import("../server/lib/fiaon-bild-bereinigen");
  for (const n of teamBildNamen(team)) {
    if (UNTERLAGE_NAME.test(n)) { console.error(`ABBRUCH: „${n}“ sieht nach einer Unterlage aus (Ausweis, Pass, Gehalt, Konto) — Teamfotos tragen einen eigenen Namen (team-….webp).`); await sqlPool.end(); process.exit(2); }
    const pfad = path.join(bilderOrdner, n);
    if (!fs.existsSync(pfad)) { console.error(`FEHLER Bild fehlt: ${n}`); await sqlPool.end(); process.exit(1); }
    try {
      const b = bildOhneMetadaten(fs.readFileSync(pfad), n);
      aus.push({ name: n, daten: b.daten, typ: b.typ });
    } catch (e) { console.error(`FEHLER Bild: ${e instanceof Error ? e.message : String(e)}`); await sqlPool.end(); process.exit(1); }
  }
  console.log(`Teamfotos: ${aus.length} geprüft`);
  return aus;
}
