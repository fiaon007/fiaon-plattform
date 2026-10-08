// ═══════════════════════════════════════════════════════════════════════════
// IMPORT: EIN FIRMENANGEBOT (B2B) AUS EINER PRIVATEN DATEI ANLEGEN
// Register E-301 (07.10.2026) — Muster: scripts/angebot-hildbrand-anlegen.ts
//
// Das Repo ist öffentlich (E-242). Deshalb steht hier KEIN Kundendatum: Firma, Vertretung, Parameter, Inhalte
// (Ziele, Bilder, Glas, Sonderfreigabe) und der Prüfbericht kommen aus zwei Dateien AUSSERHALB des Repos:
//   --datei <angebot-daten.json>        { fassung?, gueltigBis?, personId?, kunde, buergin?, parameter }
//   --compliance <compliance-daten.json> Rohdaten des Unternehmensberater-Werkzeugs (bericht-bauen.mjs) —
//                                        daraus wird die Kundenfassung (ohne Bereich 8, ohne gesamt.zusatz,
//                                        ohne den Methodik-Satz „Interne Fassung …“), Untertitel „Prüfbericht zu Ihrem Angebot“.
//   --bilder <ordner>                    die Bilder des Angebots (WebP/PNG/JPEG, Namen klein mit Bindestrichen) AUSSERHALB
//                                        des Repos. Die Angebotsdaten nennen nur die Namen (parameter.inhalt.bilder, .glas);
//                                        jedes Bild wird am Inhalt geprüft, ohne EXIF/XMP gespeichert (server/lib/
//                                        fiaon-bild-bereinigen.ts) und in der Datenbank an das Angebot gebunden
//                                        (fiaon_global_angebot_bilder). Ausgeliefert NUR hinter dem Link — nie unter client/public.
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… SESSION_SECRET=… \
//     npx tsx scripts/angebot-firma-anlegen.ts --datei <privat.json> --compliance <privat.json>            → Vorschau
//   … --schreiben                → legt an (nur gegen 127.0.0.1/localhost)
//   … --schreiben --produktion   → gegen die Produktion, NUR mit Justins Go (E-301: in diesem Bau nicht ausgeführt)
//   … --vorschau <datei.html>    → wohin die Vorschau des Vertrags geht (Vorgabe reports/, nicht im Repo)
//   … --bilder <ordner>          → Bilder prüfen (Vorschau) bzw. einspielen (--schreiben); fehlt ein Bild, auf das die
//                                   Daten zeigen, bricht --schreiben ab
//   --nur-vorbedingungen [--live <basis>] → NUR LESEN: Migration 096, Spalten, Bildtabelle, CHECKs der Teile und (mit
//                                   --live oder --produktion) ob der Live-Code das Firmenangebot kennt. Exit 0 = alles da.
// VORBEDINGUNGEN (Nachprüfung 08.10.2026, N6): --schreiben --produktion prüft dasselbe VOR jedem Schreiben und bricht ab, wenn
// etwas fehlt — Reihenfolge immer Deploy (npm start führt Migration 096 aus) → Vorbedingungen → Anlage. Live-Basis:
// --live, sonst APP_BASE_URL, sonst https://www.fiaon.com. Zurücknehmen: im Chefbüro „Zurückziehen“ (Link sofort tot,
// nichts gelöscht); Migration 096 bleibt — sie fügt nur Spalten und erlaubte Werte hinzu, E-268 läuft damit unverändert.
// Person (E-272): Ohne personId sucht das Skript die Vertretung NUR LESEND über E-Mail bzw. Telefon (fiaon_persons und
// E-Mail-Aliasse). Genau ein Treffer wird als personId übernommen — so greift die Global-Kunde-Regel schon ab dem Versand,
// nicht erst nach der Annahme. Mehrere Treffer: nur genannt, nichts übernommen (bitte personId in der Datei setzen).
// Ein zweiter Lauf legt kein zweites Angebot an: Gibt es für dieselbe E-Mail schon ein OFFENES Firmenangebot, trägt er
// Bürgin, Parameter, Firma und Prüfbericht dort nach (firmaAendern — jede Änderung steht mit der alten Prüfsumme im
// Verlauf). Ein angenommenes fasst er nie an.
// Die Ausgabe nennt Firma und Link nur auf der Konsole — nichts davon landet in einer Datei im Repo.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const arg = (name: string): string | null => { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null; };
const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
const nurVorbedingungen = process.argv.includes("--nur-vorbedingungen");
const datei = arg("--datei"); const complianceDatei = arg("--compliance"); const vorschauDatei = arg("--vorschau"); const bilderOrdner = arg("--bilder");
const liveBasis = String(arg("--live") ?? process.env.APP_BASE_URL ?? "https://www.fiaon.com").replace(/\/+$/, "");
if (!datei && !nurVorbedingungen) { console.error("ABBRUCH: --datei <angebot-daten.json> fehlt."); process.exit(2); }
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (!lokal && !produktion) { console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — gegen eine fremde Datenbank nur mit --produktion (und Justins Go).`); process.exit(2); }
if (schreiben && lokal && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL)) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt. Lokal bitte mit env -i starten."); process.exit(2); }

const { sqlPool } = await import("../server/lib/db-pool");
const F = await import("../server/lib/fiaon-global-angebot-firma");
const S = await import("../shared/fiaon-global-angebot-firma");
const A = await import("../server/lib/fiaon-global-angebot");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { GLOBAL_SCHAERFER } = await import("../shared/fiaon-global-wortregeln");
const { BUERGIN_VORGABE } = await import("../shared/fiaon-global-angebot");
const { bildOhneMetadaten } = await import("../server/lib/fiaon-bild-bereinigen");

// ── 0. Vorbedingungen (nur lesen) — vor --produktion Pflicht, einzeln mit --nur-vorbedingungen ─────────────────
async function vorbedingungen(mitLive: boolean): Promise<string[]> {
  const fehlt: string[] = [];
  const zeile = (da: boolean, was: string) => { console.log(`  ${da ? "ok   " : "FEHLT"}  ${was}`); if (!da) fehlt.push(was); };
  console.log(`\nVorbedingungen (nur lesen, Datenbank ${host}${mitLive ? `, Live ${liveBasis}` : ""}):`);
  let migration = false;
  try { migration = ((await sqlPool`SELECT 1 FROM schema_migrations WHERE filename = '096_global_angebot_firma.sql' LIMIT 1`) as any[]).length > 0; } catch { /* keine Tabelle schema_migrations */ }
  zeile(migration, "Migration 096 eingetragen (schema_migrations — läuft beim Deploy mit npm start)");
  const spalten = (await sqlPool`
    SELECT table_name, column_name FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND ((table_name = 'fiaon_global_angebote' AND column_name = 'freigaben')
         OR (table_name = 'fiaon_global_angebot_teile' AND column_name IN ('faellig_am', 'bemessung_cents', 'zeitraum', 'beleg', 'schuldner')))`) as any[];
  zeile(spalten.length === 6, `Spalten des Firmenangebots (${spalten.length} von 6)`);
  const [bt] = (await sqlPool`SELECT to_regclass('fiaon_global_angebot_bilder') IS NOT NULL AS da`) as any[];
  zeile(!!bt?.da, "Tabelle fiaon_global_angebot_bilder");
  zeile(await A.firmaTeileCheckLesen(), "CHECKs der Teile (nr bis 500; Fälligkeiten monatlich, umsatz, verkauf)");
  if (mitLive) {
    // Die Bild-Route gibt es nur im Code von E-301: Sie antwortet auf einen erfundenen Link mit JSON und „noimageindex“
    // (403/404/410). Ohne sie liefert der Server die Startseite (HTML) — dann ist der Live-Code älter.
    let live = false; let antwort = "";
    try {
      const r = await fetch(`${liveBasis}/api/fiaon/global/angebot/FIAON-IA-FVORAB.1.0/bild/vorab.webp`, { headers: { "user-agent": "fiaon-angebot-firma-anlegen (Vorbedingung)" }, signal: AbortSignal.timeout(15_000) });
      const typ = String(r.headers.get("content-type") ?? "").split(";")[0];
      live = [403, 404, 410].includes(r.status) && /noimageindex/i.test(String(r.headers.get("x-robots-tag") ?? "")) && /json/.test(typ);
      antwort = `${r.status}, ${typ || "ohne Typ"}`;
      await r.arrayBuffer().catch(() => null);
    } catch (e) { antwort = e instanceof Error ? e.message : String(e); }
    zeile(live, `Live-Code kennt das Firmenangebot (Bild-Route unter ${liveBasis}: ${antwort})`);
  }
  return fehlt;
}
if (nurVorbedingungen) {
  const fehlt = await vorbedingungen(produktion || !!arg("--live"));
  console.log(fehlt.length ? `\nNICHT bereit: ${fehlt.length} Punkt(e) fehlen — erst deployen (Migration 096 läuft mit npm start).` : "\nBereit: alle Vorbedingungen erfüllt.");
  await sqlPool.end();
  process.exit(fehlt.length ? 1 : 0);
}

const roh = JSON.parse(fs.readFileSync(datei!, "utf8"));
const complianceRoh = complianceDatei ? JSON.parse(fs.readFileSync(complianceDatei, "utf8")) : null;

// ── 1. Prüfen ─────────────────────────────────────────────────────────────────
const k = F.firmaKundePruefen(roh.kunde);
if (!k.ok) { console.error(`FEHLER Kunde: ${k.error}`); process.exit(1); }
const parameter = S.firmaParameterAus(roh.parameter);
const pf = S.firmaParameterFehler(parameter);
if (pf) { console.error(`FEHLER Parameter: ${pf}`); process.exit(1); }
const compliance = complianceRoh ? S.complianceKundenfassung(complianceRoh) : null;
const buergin = { ...BUERGIN_VORGABE, ...(roh.buergin ?? {}), name: BUERGIN_VORGABE.name };
const vorschau = { ref: "FIAON-IA-FVORSCH", fassung: S.FIRMA_FASSUNG, kunde: k.kunde, parameter, buergin, compliance, gueltigBis: String(roh.gueltigBis || "") || A.angebotStartRahmen().spaetestens };

console.log(`\nFirmenangebot — Fassung ${S.FIRMA_FASSUNG}`);
console.log(`  Auftraggeberin: ${k.kunde.firma.name}, vertreten durch ${S.firmaVertreterName(k.kunde)} (${k.kunde.vertretung.funktion})`);
console.log(`  Gründung ${S.firmaEur(parameter.startCents)} · Plattform & Team ${S.firmaEur(parameter.monatCents)}/Monat (${parameter.mindestMonate} Monate, +${parameter.verlaengerungMonate}, Kündigung ${parameter.kuendigungMonate} Monate vorher)`);
console.log(`  Umsatz ${parameter.umsatzSatzProzent} % über ${S.firmaEur(parameter.umsatzSchwelleCents)} · Verkauf ${parameter.verkaufSatzProzent} % · erste Runde ${S.firmaUsd(parameter.kapitalUsd)} in ${parameter.garantieMonate} Monaten nach erfüllten Bedingungen`);
console.log(`  Prüfbericht: ${compliance ? `Ampel ${compliance.gesamt.ampel}, ${compliance.bereiche.length} Bereiche in der Kundenfassung (Bereich 8 und interne Punkte entfernt)` : "FEHLT (--compliance)"}`);
const fehlt = S.firmaPflichtFehlen(vorschau);
console.log(`  Annahme ${fehlt.length ? `gesperrt, solange fehlt: ${fehlt.join("; ")}` : "möglich — alle Pflichtfelder sind da."}`);
console.log(`  Versand des Links: ${S.firmaVersandSperre(buergin, {}) ?? "frei"}`);

// Bilder: nur Namen in den Daten, die Dateien aus dem privaten Ordner — geprüft, ohne Metadaten (Gegenprüfung 07.10.2026).
const verweise = S.firmaBildVerweise(parameter.inhalt);
const bilder: { name: string; daten: Buffer; typ: "image/webp" | "image/png" | "image/jpeg" }[] = [];
let bilderFehlen: string[] = [];
if (bilderOrdner) {
  const namen = fs.readdirSync(bilderOrdner).filter((n) => !n.startsWith(".") && fs.statSync(path.join(bilderOrdner, n)).isFile()).sort();
  const uebersprungen: string[] = []; const bereinigt: string[] = []; const fehler: string[] = [];
  for (const n of namen) {
    if (!S.FIRMA_BILD_NAME.test(n)) { uebersprungen.push(n); continue; }
    try {
      const b = bildOhneMetadaten(fs.readFileSync(path.join(bilderOrdner, n)), n);
      bilder.push({ name: n, daten: b.daten, typ: b.typ });
      if (b.entfernt.length) bereinigt.push(`${n} (${b.entfernt.join(", ")})`);
    } catch (e) { fehler.push(e instanceof Error ? e.message : String(e)); }
  }
  bilderFehlen = verweise.filter((v) => !bilder.some((b) => b.name === v));
  console.log(`  Bilder: ${bilder.length} geprüft (${Math.round(bilder.reduce((x, b) => x + b.daten.length, 0) / 1024)} KB)${bereinigt.length ? ` · Metadaten entfernt: ${bereinigt.join("; ")}` : " · keine Metadaten gefunden"}${uebersprungen.length ? ` · übersprungen (kein Bildname): ${uebersprungen.length}` : ""}`);
  if (fehler.length) { console.error(`FEHLER Bilder: ${fehler.join(" · ")}`); process.exit(1); }
  if (bilderFehlen.length) console.log(`  Bilder FEHLEN im Ordner (die Daten zeigen darauf): ${bilderFehlen.join(", ")}`);
  const ungenutzt = bilder.filter((b) => !verweise.includes(b.name)).map((b) => b.name);
  if (ungenutzt.length) console.log(`  Bilder ohne Verweis in den Daten (werden trotzdem abgelegt): ${ungenutzt.join(", ")}`);
} else if (verweise.length) {
  console.log(`  Bilder: Die Daten zeigen auf ${verweise.length} Bilder — ohne --bilder werden keine eingespielt (vorhandene bleiben).`);
}

// Person der Vertretung — nur lesen (E-272).
let personId: number | null = Number.isInteger(Number(roh.personId)) && Number(roh.personId) > 0 ? Number(roh.personId) : null;
if (personId) console.log(`  Person: ${personId} (aus der Datei)`);
else {
  try {
    const { phoneKey9 } = await import("../server/fiaon-person-model");
    const key9 = k.kunde.telefon ? phoneKey9(k.kunde.telefon) : null;
    const treffer = (await sqlPool`
      SELECT p.id FROM fiaon_persons p
       WHERE p.merged_into_person_id IS NULL
         AND (p.primary_email = ${k.kunde.email}
              OR p.id IN (SELECT a.person_id FROM fiaon_person_aliases a WHERE a.kind = 'email' AND a.value_norm = ${k.kunde.email})
              OR (${key9}::text IS NOT NULL AND p.phone_key9 = ${key9}))
       ORDER BY p.id LIMIT 5`) as any[];
    if (treffer.length === 1) { personId = Number(treffer[0].id); console.log(`  Person: ${personId} gefunden (E-Mail/Telefon) — wird am Angebot gesetzt, die Global-Kunde-Regel greift ab dem Anlegen.`); }
    else if (treffer.length > 1) console.log(`  Person: ${treffer.length} Treffer (${treffer.map((t) => t.id).join(", ")}) — nichts übernommen; bitte personId in der Datei setzen.`);
    else console.log("  Person: keine bekannt — sie entsteht mit der Annahme (Bestellzeile).");
  } catch (e) { console.log(`  Person: Suche nicht möglich (${e instanceof Error ? e.message : e}) — sie entsteht mit der Annahme.`); }
}

// Wortwand über die Kundenfassung des Prüfberichts — Daten der Kundin, deshalb nur ein Hinweis (kein Abbruch):
// Was hier anschlägt, liest die Kundin auf der Seite. Vor dem Versand prüfen.
if (compliance) {
  const saetze: string[] = [];
  const sammle = (v: unknown) => { if (typeof v === "string") saetze.push(v); else if (Array.isArray(v)) v.forEach(sammle); else if (v && typeof v === "object") Object.values(v).forEach(sammle); };
  sammle({ ...compliance, bereiche: compliance.bereiche.map((b) => ({ ...b, befunde: b.befunde.map((f) => f.aussage) })) });
  const hinweise: string[] = [];
  for (const s of saetze) {
    for (const w of wandPruefen(s)) hinweise.push(`Hauswand „${w.treffer}“ in: ${s.slice(0, 90)}…`);
    for (const r of GLOBAL_SCHAERFER) { const m = s.match(r.muster); if (m) hinweise.push(`Global-Regel „${m[0]}“ in: ${s.slice(0, 90)}…`); }
  }
  console.log(hinweise.length ? `  Wortwand im Prüfbericht (Hinweis, kein Abbruch): ${hinweise.length} Stellen\n    · ${[...new Set(hinweise)].slice(0, 25).join("\n    · ")}` : "  Wortwand im Prüfbericht: keine Treffer.");
}

try {
  const ziel = vorschauDatei ?? path.join("reports", "angebot-firma-vorschau.html");
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  fs.writeFileSync(ziel, `<!doctype html><meta charset="utf-8"><title>Vorschau Firmenangebot</title><body style="max-width:900px;margin:30px auto;font-family:Inter,Arial">${F.firmaVorschauHtml(vorschau)}</body>`);
  console.log(`  Vorschau des Vertrags: ${ziel}`);
} catch (e) { console.error("  Vorschau-Datei nicht geschrieben:", e); }

if (!schreiben) {
  console.log("\nNur Vorschau. Anlegen mit --schreiben (lokal) — gegen die Produktion zusätzlich --produktion und nur mit Justins Go.");
  await sqlPool.end();
  process.exit(0);
}

// ── 2. Anlegen (idempotent je E-Mail) ─────────────────────────────────────────
if (produktion) {
  const fehltVor = await vorbedingungen(true);
  if (fehltVor.length) {
    console.error(`ABBRUCH: Vorbedingungen fehlen (${fehltVor.join("; ")}). Nichts geschrieben. Erst deployen — Migration 096 läuft mit npm start —, dann mit --nur-vorbedingungen --produktion nachsehen.`);
    await sqlPool.end(); process.exit(1);
  }
}
await A.ensureAngebotTabellen();
const [da] = (await sqlPool`
  SELECT id, angebot_ref, gueltig_bis, status FROM fiaon_global_angebote
   WHERE fassung LIKE 'IA-FIRMA-%' AND (kunde #>> '{}')::jsonb ->> 'email' = ${k.kunde.email} AND status IN ('offen', 'angenommen')
   ORDER BY created_at DESC LIMIT 1`) as any[];
const wer = `Import scripts/angebot-firma-anlegen.ts (${path.basename(datei!)})`;
if (bilderOrdner && bilderFehlen.length) { console.error(`ABBRUCH: Diese Bilder fehlen im Ordner: ${bilderFehlen.join(", ")}`); await sqlPool.end(); process.exit(1); }
let offen = true;
let id: number; let ref: string; let gueltigBis: string;
if (da) {
  id = Number(da.id); ref = String(da.angebot_ref);
  gueltigBis = da.gueltig_bis instanceof Date ? da.gueltig_bis.toISOString().slice(0, 10) : String(da.gueltig_bis).slice(0, 10);
  console.log(`\nEs gibt schon ein Firmenangebot für diese E-Mail: ${ref} (id ${id}, ${da.status}). Kein zweites angelegt.`);
  offen = String(da.status) === "offen";
  if (String(da.status) === "offen") {
    const ae = await F.firmaAendern(id, { buergin: roh.buergin ?? undefined, parameter: roh.parameter, compliance: complianceRoh ?? undefined, kunde: roh.kunde }, wer);
    console.log(ae.ok ? `Nachgetragen. ${ae.fehlt.length ? `Es fehlt noch: ${ae.fehlt.join("; ")}` : "Annehmbar."}` : `Nicht nachgetragen: ${ae.error}`);
  }
} else {
  const erg = await F.firmaAnlegen({ fassung: roh.fassung, gueltigBis: roh.gueltigBis, personId, kunde: roh.kunde, buergin: roh.buergin, parameter: roh.parameter, compliance: complianceRoh }, wer);
  if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
  id = erg.id; ref = erg.ref;
  const [g] = (await sqlPool`SELECT gueltig_bis FROM fiaon_global_angebote WHERE id = ${id}`) as any[];
  gueltigBis = g.gueltig_bis instanceof Date ? g.gueltig_bis.toISOString().slice(0, 10) : String(g.gueltig_bis).slice(0, 10);
  console.log(`\nAngelegt: ${ref} (id ${id}).`);
}
// Bilder an das Angebot binden (nur offen — ein angenommenes fasst das Skript nie an).
if (bilder.length && offen) {
  const eb = await F.firmaBilderSpeichern(id, bilder, wer);
  console.log(eb.ok ? `Bilder eingespielt: ${eb.gespeichert}.` : `Bilder NICHT eingespielt: ${eb.error}`);
  if (!eb.ok) { await sqlPool.end(); process.exit(1); }
}
const daBilder = await F.firmaBilderNamen(id);
const ohneBild = verweise.filter((v) => !daBilder.includes(v));
console.log(ohneBild.length ? `ACHTUNG: Am Angebot fehlen Bilder, auf die die Daten zeigen: ${ohneBild.join(", ")} — mit --bilder <ordner> einspielen.` : `Bilder am Angebot: ${daBilder.length} (alle Verweise gedeckt).`);
const token = A.angebotTokenErzeugen(ref, gueltigBis);
console.log(`REF=${ref}`);
console.log(`ID=${id}`);
console.log(`TOKEN=${token}`);
console.log(`PFAD=${A.angebotKundenPfad(token)}`);
console.log("Zurücknehmen, falls nötig: Chefbüro → Global-Aufträge → Individualangebote → „Zurückziehen“ (mit Grund). Der Link ist dann sofort tot, Bilder gehen nicht mehr raus, gelöscht wird nichts.");
await sqlPool.end();
