// ════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MIT DATENBANK: globalScanZuruecknehmen (E-492, 10.11.2026)
//
// Fall 09.11.2026: Eine Kundin lud das LEERE Formular als „unterschrieben (Scan)“ hoch. Das Portal hakte das Pflichtformular sofort
// ab, ein neuer Scan wäre mit „liegt bereits unterschrieben vor“ abgewiesen worden. Alle Daten sind ausgedacht (Muster).
//
//   1  Saat: Auftrag mit Pflichtformular SS-4 (von Hand), wie die Produktion
//   2  Der Fehler: ein Scan hakt das Formular ab — ein zweiter Upload wird abgewiesen (Rotprobe)
//   3  Zurücknehmen: Original wieder offen (kein Datum, kein Nachweis), Scan-Fassung ausgeblendet (nicht gelöscht), Verlauf (Kunde + intern)
//   4  Danach: ein richtiger Scan wird angenommen, das Formular gilt wieder als unterschrieben
//   5  Schutz: nicht unterschrieben, digitale Unterschrift, falscher Auftrag, falsche Nummer, Grund zu kurz — nichts ändert sich
//   6  Quelltext: kein hartes DELETE
//
// ── NIE GEGEN DIE PRODUKTION ──
//   B=/opt/homebrew/opt/postgresql@18/bin   (oder @16)
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e408_basis fiaon_pruefstand_e492_scan
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e492_scan node_modules/.bin/tsx scripts/pruef-global-scan-zuruecknehmen.ts
//   $B/dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_e492_scan
// ════════════════════════════════════════════════════════════════════════
import { readFileSync } from "node:fs";
import path from "node:path";

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen eine lokale Kopie fiaon_pruefstand_… auf 127.0.0.1."); process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt. Bitte mit leerer Umgebung starten (env -i …).`); process.exit(2); }
}
globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

let gut = 0; const rot: string[] = []; let aktuell = "";
const abschnitt = (nr: string, t: string) => { aktuell = nr; console.log(`\n── ${nr}  ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); };
function ok(bed: unknown, text: string, fund?: unknown): void {
  if (bed) { gut++; return; }
  rot.push(`${aktuell}: ${text}`); console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${typeof fund === "string" ? fund.slice(0, 600) : JSON.stringify(fund).slice(0, 600)}` : ""}`);
}
const { sqlPool } = await import("../server/lib/db-pool");
const AK: any = await import("../server/lib/fiaon-global-akte-komplett");
const L: any = await import("../server/lib/fiaon-global-bereich");
const M: any = await import("../server/lib/fiaon-global-mandat");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const G: any = await import("../server/lib/fiaon-global-angebot");
const C: any = await import("../shared/fiaon-global-angebot-kapital-c");

abschnitt("1", "Saat: Auftrag mit Pflichtformular SS-4 (von Hand)");
await A.ensureGlobalTabelle(); await L.ensureGlobalBereich(); await M.ensureGlobalMandat(); await G.ensureAngebotTabellen();
const stempel = Date.now().toString(36).toUpperCase();
const REF = `FIAON-E492${stempel}-P1`, REF2 = `FIAON-E492${stempel}-P2`;
const MAIL = `erika.pruefmann.${stempel.toLowerCase()}@beispiel.example`;
const txt = (o: unknown) => JSON.stringify(o);
const RECHNUNG_AM = new Date(Date.now() - 2 * 3600_000);
for (const ref of [REF, REF2]) {
  const [ang] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, status, gueltig_bis, angenommen_am, auftrag_ref)
    VALUES (${`FIAON-IA-C${ref.slice(-8)}`}, 'IA-KAPITAL-2026-10-27-C', ${sqlPool.json({ art: "privat", vorname: "Erika", nachname: "Prüfmann", email: MAIL } as any)},
            ${sqlPool.json({ ...C.KAPITAL_C_VORGABEN, zahlungszielTage: 7 } as any)}, ${sqlPool.json({ name: "Muster Partner LLC" } as any)}, 'angenommen', '2026-12-31', NOW() - INTERVAL '2 hours', ${ref}) RETURNING id`) as any[];
  await sqlPool`INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, bestell_ref, rechnung_am)
    VALUES (${Number(ang.id)}, 1, 'Gründung, Konto und Karten sowie Fast-Track', 328900, 'sofort', 7, ${ref}, ${RECHNUNG_AM})`;
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, invoice_number, invoice_date, payment_due_date, email, first_name, last_name, country)
    VALUES (${ref}, 'business', 'submitted', 'global_individuell', 'Kapital-Angebot (Prüfstand)', ${"PAY" + ref.slice(-12)}, 'paid', 3289.00, ${"FIAON-INV-PRUEF-" + ref.slice(-6)}, ${RECHNUNG_AM}, ${RECHNUNG_AM}, ${MAIL}, 'Erika', 'Prüfmann', 'DE')`;
  await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email, rechnung_ust_modus, gesellschaft, jahresbetreuung)
    VALUES (${ref}, 'global_individuell', 'DE',
      to_jsonb(${txt({ art: "privat", land: "DE", name: "Erika Prüfmann", strasse: "Prüfweg 1", plz: "12345", ort: "Musterstadt" })}::text),
      to_jsonb(${txt({ anrede: "Frau", vorname: "Erika", nachname: "Prüfmann", funktion: "Privatperson", email: MAIL, telefon: "" })}::text),
      to_jsonb(${txt({ annahme: "x", kapitalangebot: true, kapitalPrivat: true, sofortBeginn: true })}::text),
      'IA-KAPITAL-2026-10-27-C', 'de', NOW() - INTERVAL '2 hours', 'individualangebot', 'offen', 'Erika Prüfmann', ${MAIL}, 'none',
      to_jsonb(${txt({ name: "MUSTERPOOL LLC", bundesstaat: "DE", geprueft: false })}::text), TRUE)`.catch(async () => {
      // Spaltenliste je nach Stand des Prüfstands: ohne jahresbetreuung noch einmal
      await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email, rechnung_ust_modus, gesellschaft)
        VALUES (${ref}, 'global_individuell', 'DE', to_jsonb(${txt({ art: "privat", land: "DE", name: "Erika Prüfmann" })}::text), to_jsonb(${txt({ anrede: "Frau", vorname: "Erika", nachname: "Prüfmann", email: MAIL })}::text),
          to_jsonb(${txt({ annahme: "x" })}::text), 'IA-KAPITAL-2026-10-27-C', 'de', NOW() - INTERVAL '2 hours', 'individualangebot', 'offen', 'Erika Prüfmann', ${MAIL}, 'none', to_jsonb(${txt({ name: "MUSTERPOOL LLC" })}::text))`;
    });
}
const pdf = (text: string) => Buffer.from(`%PDF-1.4\n% ${text}\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`, "latin1");
const LEER = pdf("leeres Formular " + stempel);
const agent = { id: 928, name: "Prüf-Agent" };
const kunde = { kunde: { ip: "203.0.113.9", userAgent: "Prüfstand" } };
async function formular(ref: string, inhalt: Buffer): Promise<number> {
  const d = await L.dokumentSpeichern({ ref, von: "fiaon", art: "steuer", dateiname: "IRS_Form_SS-4_MUSTERPOOL_LLC.pdf", mime: "application/pdf", inhalt, sichtbar: true, agentId: agent.id });
  await sqlPool`UPDATE fiaon_global_dokumente SET pflicht_key = 'irs_ss4', unterschrift_gefordert = TRUE, unterschrift_art = 'handschriftlich', titel = 'IRS Form SS-4 – Antrag auf die EIN der MUSTERPOOL LLC' WHERE id = ${d.id}`;
  return Number(d.id);
}
const ORIG = await formular(REF, LEER);
const ORIG2 = await formular(REF2, pdf("zweites Formular " + stempel));
const lies = async (id: number) => ((await sqlPool`SELECT id, unterschrieben_am, unterschrift_nachweis, unterschrift_art, geloescht_am, unterschrift_von_id FROM fiaon_global_dokumente WHERE id = ${id}`) as any[])[0];
ok((await lies(ORIG))?.unterschrieben_am == null, "Saat: Formular offen", await lies(ORIG));

abschnitt("2", "Der Fehler: leerer Scan hakt das Formular ab, ein zweiter Upload wird abgewiesen");
const e1 = await AK.globalScanHochladen(REF, ORIG, { buffer: pdf("Scan leer " + stempel), originalname: "scan.pdf" }, kunde);
ok(e1.ok === true, "leerer Scan wird angenommen (so geschah es am 09.11.)", e1);
const nachUpload = await lies(ORIG);
ok(nachUpload.unterschrieben_am != null && nachUpload.unterschrift_nachweis?.art === "handschriftlich_scan", "Formular gilt als unterschrieben (der Fehler)", nachUpload);
const e2 = await AK.globalScanHochladen(REF, ORIG, { buffer: pdf("richtiger Scan " + stempel), originalname: "scan2.pdf" }, kunde);
ok(e2.ok === false && e2.status === 409 && /bereits unterschrieben/.test(e2.error), "Rotprobe: ein neuer Scan wird mit „bereits unterschrieben“ abgewiesen", e2);
const scanId = Number(e1.id);

abschnitt("3", "Zurücknehmen");
const z = await AK.globalScanZuruecknehmen(REF, ORIG, "leeres Formular hochgeladen, keine Unterschrift", agent);
ok(z.ok === true && JSON.stringify(z.ausgeblendet) === JSON.stringify([scanId]), "zurückgenommen, die Scan-Fassung ist ausgeblendet", z);
const nachZ = await lies(ORIG), scanZ = await lies(scanId);
ok(nachZ.unterschrieben_am == null && nachZ.unterschrift_nachweis == null, "Original wieder offen: kein Datum, kein Nachweis", nachZ);
ok(scanZ.geloescht_am != null, "Scan-Fassung nur ausgeblendet (Zeile bleibt in der Datenbank)", scanZ);
const verl = (await sqlPool`SELECT art, sichtbar, text FROM fiaon_global_verlauf WHERE ref = ${REF} AND art IN ('dokument', 'dokument_neu') ORDER BY id DESC LIMIT 4`) as any[];
ok(verl.some((v) => v.sichtbar && v.art === "dokument_neu" && /nicht verwendbar/.test(v.text) && /noch einmal hoch/.test(v.text)), "Verlauf für den Kunden: bitte neu, freundlich", verl);
ok(verl.some((v) => !v.sichtbar && /zurückgenommen/.test(v.text) && /keine Unterschrift/.test(v.text)), "Verlauf intern mit Grund", verl);
const z2 = await AK.globalScanZuruecknehmen(REF, ORIG, "noch einmal", agent);
ok(z2.ok === false && z2.status === 409, "zweites Zurücknehmen: es gibt nichts mehr zurückzunehmen", z2);

abschnitt("4", "Danach: ein richtiger Scan wird angenommen");
const e3 = await AK.globalScanHochladen(REF, ORIG, { buffer: pdf("richtiger Scan " + stempel), originalname: "scan2.pdf" }, kunde);
ok(e3.ok === true, "richtiger Scan wird jetzt angenommen", e3);
const nachNeu = await lies(ORIG);
ok(nachNeu.unterschrieben_am != null && nachNeu.unterschrift_nachweis?.art === "handschriftlich_scan", "Formular gilt wieder als unterschrieben", nachNeu);
const sichtbar = (await sqlPool`SELECT count(*)::int n FROM fiaon_global_dokumente WHERE ref = ${REF} AND unterschrift_von_id = ${ORIG} AND geloescht_am IS NULL`) as any[];
ok(sichtbar[0].n === 1, "genau eine gültige Scan-Fassung", sichtbar);

abschnitt("5", "Schutz");
const a = await AK.globalScanZuruecknehmen(REF2, ORIG2, "offenes Formular", agent);
ok(a.ok === false && a.status === 409 && (await lies(ORIG2)).unterschrieben_am == null, "nicht unterschrieben → nichts zurückzunehmen", a);
await sqlPool`UPDATE fiaon_global_dokumente SET unterschrieben_am = NOW(), unterschrift_art = 'digital', unterschrift_nachweis = ${sqlPool.json({ art: "digital", code: "x" } as any)} WHERE id = ${ORIG2}`;
const dig = await AK.globalScanZuruecknehmen(REF2, ORIG2, "digitale Unterschrift", agent);
const digNach = await lies(ORIG2);
ok(dig.ok === false && dig.status === 409 && digNach.unterschrieben_am != null && digNach.unterschrift_nachweis?.art === "digital", "digitale Unterschrift lässt sich nie zurücknehmen", { dig, digNach });
const fremd = await AK.globalScanZuruecknehmen(REF2, ORIG, "falscher Auftrag", agent);
ok(fremd.ok === false && fremd.status === 404 && (await lies(ORIG)).unterschrieben_am != null, "Dokument eines anderen Auftrags → 404, nichts geändert", fremd);
const nr = await AK.globalScanZuruecknehmen(REF, 999999999, "gibt es nicht", agent);
ok(nr.ok === false && nr.status === 404, "unbekannte Nummer → 404", nr);
const kurz = await AK.globalScanZuruecknehmen(REF, ORIG, "x", agent);
ok(kurz.ok === false && kurz.status === 400 && (await lies(ORIG)).unterschrieben_am != null, "Grund zu kurz → 400, nichts geändert", kurz);
const ohneAuftrag = await AK.globalScanZuruecknehmen("FIAON-GIBTSNICHT-X", ORIG, "kein Auftrag", agent);
ok(ohneAuftrag.ok === false && ohneAuftrag.status === 404, "unbekannter Auftrag → 404", ohneAuftrag);

abschnitt("6", "Quelltext");
const q = readFileSync(path.join(path.resolve(import.meta.dirname ?? ".", ".."), "server/lib/fiaon-global-akte-komplett.ts"), "utf8");
const f = q.slice(q.indexOf("export async function globalScanZuruecknehmen"));
ok(!/DELETE\s+FROM/i.test(f.slice(0, f.indexOf("\n}\n") + 3)), "kein hartes DELETE in der Funktion");

// Aufräumen: nur die Prüf-Aufträge dieses Laufs
await sqlPool.end({ timeout: 2 });
console.log(`\n${gut} Prüfungen bestanden${rot.length ? `, ${rot.length} ROT:\n  · ${rot.join("\n  · ")}` : ""}.`);
process.exit(rot.length ? 1 : 0);
