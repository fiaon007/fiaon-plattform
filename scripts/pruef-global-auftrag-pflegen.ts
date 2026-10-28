// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND MIT DATENBANK: scripts/global-auftrag-pflegen.ts (E-432, 28.10.2026)
//
// Fährt das ECHTE Pflege-Skript (als eigener Prozess, wie im Betrieb) gegen eine LOKALE Kopie des Prüfstands — dazu die reinen
// Bausteine (server/lib/fiaon-global-pflege.ts), die Fristrechnung und die Zahlungsseite. Alle Daten sind ausgedacht (Muster).
//
//   0  Bausteine rein: Dateiname → Art/Titel, Metadaten heraus (JPEG, PNG, PDF; signiertes PDF unverändert; HEIC abgelehnt;
//      gleicher Inhalt = gleicher Hash), Staatsangehörigkeit, Fristende (0/7 Tage, Zeitumstellung), „sofort“-Wortlaut Fassung C
//   1  Saat: Kapital-Akte wie in der Produktion — firma, ansprechpartner, bestaetigungen, gesellschaft als JSON-TEXT (doppelt
//      kodiert), person_id leer; Bestellung offen, Rechnung, Frist +7 Tage; Kooperation mit zwei Empfehlungen
//   2  Rotprobe: das ALTE UPDATE für „geprüft“ trifft eine Akte mit JSON-Text nicht (darum blieb die Zahlungsseite bei „vorgemerkt“)
//   3  Vorschau: Exit 0, Plan vollständig, die Datenbank bleibt Byte für Byte gleich (Verbindung nur lesend)
//   4  Schreiben: Tresor (Arten, Titel, Mappen, sichtbar, keine Metadaten, keine Mail), „Name geprüft“ (Datum, Beleg intern,
//      Merker true, Gesellschaft jetzt Objekt), Akte (Person, Anrede, Staatsangehörigkeit, Pass — nur leere Felder), Empfehlung
//      zugeordnet; Zahlungsseite: „Name geprüft“, „Reisepass erhalten“, „spätestens bis zum …“
//   5  Zweiter Lauf: nichts Neues (kein Dokument, keine Verlaufszeile), Exit 0
//   6  Schutz: Frist vor dem Vertragstag abgelehnt (Exit 1, nichts geändert), späterer Tag gesetzt (Protokoll); fremde Datei für
//      die Akte abgelehnt; Empfehlung mit fremdem Namen abgelehnt; fremde Datenbank ohne --produktion und unbekannte Schalter
//      brechen ab
//
// ── NIE GEGEN DIE PRODUKTION ──────────────────────────────────────────────
// Der Lauf SCHREIBT. Er weigert sich, wenn DATABASE_URL nicht auf 127.0.0.1/localhost zeigt, die Datenbank nicht
// „fiaon_pruefstand_…“ heißt oder ein Mail-/Zahl-Schlüssel gesetzt ist.
//
//   B=/opt/homebrew/opt/postgresql@18/bin
//   $B/createdb -h 127.0.0.1 -p 54329 -U fiaon -T fiaon_pruefstand_e408_basis fiaon_pruefstand_e432_pflege
//   env -i PATH="$PATH" HOME="$HOME" TZ=Europe/Berlin CRONS=aus DOTENV_CONFIG_PATH=/dev/null \
//     DATABASE_URL=postgresql://fiaon@127.0.0.1:54329/fiaon_pruefstand_e432_pflege node_modules/.bin/tsx scripts/pruef-global-auftrag-pflegen.ts
//   $B/dropdb -h 127.0.0.1 -p 54329 -U fiaon fiaon_pruefstand_e432_pflege
// Am Ende „… Prüfungen bestanden“ bzw. die roten Zeilen; Exit 1 bei ROT.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const url = String(process.env.DATABASE_URL ?? "");
let ziel: URL | null = null;
try { ziel = new URL(url); } catch { /* unten */ }
if (!ziel || !["127.0.0.1", "localhost"].includes(ziel.hostname) || !/^fiaon_pruefstand_/.test(ziel.pathname.replace(/^\//, ""))) {
  console.error("ABBRUCH: Dieser Prüfstand schreibt. Er läuft nur gegen eine lokale Kopie fiaon_pruefstand_… auf 127.0.0.1.");
  process.exit(2);
}
for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "TWILIO_AUTH_TOKEN", "AIRWALLEX_API_KEY", "GOCARDLESS_ACCESS_TOKEN", "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "DATABASE_URL_EXTERN"]) {
  if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt. Bitte mit leerer Umgebung starten (env -i …).`); process.exit(2); }
}
globalThis.fetch = (async () => { throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const SKRIPT = path.join(WURZEL, "scripts/global-auftrag-pflegen.ts");
const TSX = path.join(WURZEL, "node_modules/.bin/tsx");

let gut = 0; const rot: string[] = [];
let aktuell = "";
const abschnitt = (nr: string, t: string) => { aktuell = nr; console.log(`\n── ${nr}  ${t} ${"─".repeat(Math.max(0, 66 - t.length))}`); };
function ok(bed: unknown, text: string, fund?: unknown): void {
  if (bed) { gut++; return; }
  rot.push(`${aktuell}: ${text}`);
  console.log(`  ROT   ${text}${fund !== undefined ? `  →  ${typeof fund === "string" ? fund.slice(0, 900) : JSON.stringify(fund).slice(0, 900)}` : ""}`);
}
const gleich = (ist: unknown, soll: unknown, text: string) => ok(JSON.stringify(ist) === JSON.stringify(soll), text, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);

const { sqlPool } = await import("../server/lib/db-pool");
const P = await import("../server/lib/fiaon-global-pflege");
const T = await import("../server/lib/fiaon-time");
const C = await import("../shared/fiaon-global-angebot-kapital-c");
const { PDFDocument, PDFName } = await import("pdf-lib");

// ── Musterdateien ────────────────────────────────────────────────────────────
function jpegMitExif(fuell: number): Buffer {
  const seg = (m: number, inhalt: Buffer) => { const k = Buffer.alloc(4); k[0] = 0xff; k[1] = m; k.writeUInt16BE(inhalt.length + 2, 2); return Buffer.concat([k, inhalt]); };
  return Buffer.concat([Buffer.from([0xff, 0xd8]), seg(0xe0, Buffer.from("JFIF\0\x01\x01")), seg(0xe1, Buffer.from("Exif\0\0GPS-Pruefstand Erika Muster")), seg(0xfe, Buffer.from("Kommentar Pruefstand")),
    seg(0xda, Buffer.from([0, 0, 0])), Buffer.alloc(200, fuell), Buffer.from([0xff, 0xd9])]);
}
function pngMitText(fuell: number): Buffer {
  const crcTab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Buffer) => { let c = 0xffffffff; for (const x of b) c = crcTab[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const block = (art: string, inhalt: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(inhalt.length); const ai = Buffer.concat([Buffer.from(art, "latin1"), inhalt]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(ai)); return Buffer.concat([l, ai, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), block("IHDR", ihdr), block("tEXt", Buffer.from("Author\0Erika Muster Pruefstand")),
    block("IDAT", Buffer.from([0x78, 0x9c, 0x63, fuell, 0, 0, 0, 2, 0, 1])), block("IEND", Buffer.alloc(0))]);
}
async function pdfMitMeta(titel: string, breite = 200): Promise<Buffer> {
  const d = await PDFDocument.create();
  d.addPage([breite, 200]); // verschiedene Seitengrößen = verschiedener Inhalt (sonst wären zwei bereinigte Muster gleich)
  d.setTitle(titel); d.setAuthor("Erika Muster Pruefstand"); d.setProducer("ScanApp Pruefstand"); d.setCreator("Telefon Pruefstand");
  const xmp = d.context.stream("<x:xmpmeta>Autor Erika Muster Pruefstand</x:xmpmeta>", { Type: "Metadata", Subtype: "XML" });
  d.catalog.set(PDFName.of("Metadata"), d.context.register(xmp));
  return Buffer.from(await d.save());
}
const SIGNIERT = Buffer.from("%PDF-1.7\n1 0 obj << /Type /Sig /ByteRange [0 10 20 30] /Author (Erika Muster Pruefstand) >> endobj\ntrailer << >>\n%%EOF\n", "latin1");
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(40, 1)]);
const ohneSpur = (b: Buffer) => !/Erika|Pruefstand|ScanApp|Exif|tEXt|xmpmeta/.test(b.toString("latin1"));
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

// ═══ 0 BAUSTEINE ══════════════════════════════════════════════════════════════
abschnitt("0", "Bausteine (rein)");
{
  const e = (n: string) => { const x = P.unterlageErkennen(n); return x ? [x.art, x.titel, x.dateiname] : null; };
  gleich(e("01 Reisepass.pdf"), ["reisepass", "Reisepass", "Reisepass"], "Reisepass");
  gleich(e("02 Personalausweis Vorderseite.png"), ["personalausweis", "Personalausweis – Vorderseite", "Personalausweis Vorderseite"], "Personalausweis vorn");
  gleich(e("03 Personalausweis Rueckseite.png"), ["personalausweis", "Personalausweis – Rückseite", "Personalausweis Rückseite"], "Personalausweis hinten (ue)");
  gleich(e("Ausweis Rückseite.jpg")?.[1], "Personalausweis – Rückseite", "Ausweis hinten (ü)");
  gleich(e("04 Gehaltsnachweis 2026-08.jpg"), ["einkommensnachweis", "Gehaltsnachweis August 2026", "Gehaltsnachweis 2026-08"], "Gehaltsnachweis mit Monat");
  gleich(e("Lohnabrechnung_2026_09.pdf")?.[1], "Gehaltsnachweis September 2026", "Lohnabrechnung mit Unterstrich");
  gleich(e("07 Kontoauszug Musterbank 2026-10.pdf"), ["kontoauszug", "Kontoauszug Oktober 2026", "Kontoauszug 2026-10"], "Kontoauszug ohne Banknamen im Titel");
  gleich(e("Meldebescheinigung.pdf")?.[0], "adressnachweis", "Adressnachweis");
  ok(e("Vertrag.pdf") === null && e("notiz.txt") === null && e("Passagierliste.pdf") === null && e("Kompass.jpg") === null, "Unbekanntes bleibt liegen (auch „Passagier“, „Kompass“)");

  const j = await P.unterlageOhneMetadaten(jpegMitExif(1), "a.jpg");
  ok(j.typ.mime === "image/jpeg" && ohneSpur(j.daten) && j.entfernt.join() === "APP1 (Exif/XMP),COM", "JPEG: Exif und Kommentar heraus", j.entfernt);
  const p = await P.unterlageOhneMetadaten(pngMitText(1), "b.png");
  ok(p.typ.mime === "image/png" && ohneSpur(p.daten) && p.entfernt.join() === "tEXt", "PNG: Text-Block heraus", p.entfernt);
  const roh = await pdfMitMeta("Geheimer Titel Pruefstand");
  const d1 = await P.unterlageOhneMetadaten(roh, "c.pdf"); const d2 = await P.unterlageOhneMetadaten(roh, "c.pdf");
  ok(d1.typ.mime === "application/pdf" && ohneSpur(d1.daten) && !/\/Info\b|\/Metadata\b/.test(d1.daten.toString("latin1")) && d1.entfernt.length === 2, "PDF: Info und XMP heraus", d1.entfernt);
  ok(sha(d1.daten) === sha(d2.daten), "PDF: gleiche Datei → gleiches Ergebnis (nie doppelt)");
  ok((await PDFDocument.load(d1.daten)).getPageCount() === 1 && d1.daten.subarray(0, 5).toString() === "%PDF-", "PDF bleibt lesbar (eine Seite, %PDF-)");
  const anders = await P.unterlageOhneMetadaten(await pdfMitMeta("Anderer Titel Pruefstand"), "c3.pdf");
  ok(sha(anders.daten) === sha(d1.daten), "zwei PDFs, die sich nur in den Metadaten unterscheiden, sind bereinigt gleich (der Tresor nimmt sie einmal)");
  const d3 = await P.unterlageOhneMetadaten(d1.daten, "c2.pdf");
  ok(d3.entfernt.length === 0 && sha(d3.daten) === sha(d1.daten), "PDF ohne Metadaten bleibt Byte für Byte gleich");
  const s = await P.unterlageOhneMetadaten(SIGNIERT, "s.pdf");
  ok(s.daten.equals(SIGNIERT) && /Signatur/.test(s.unveraendert ?? ""), "signiertes PDF bleibt unverändert (Signatur bleibt gültig)");
  let heic = ""; try { await P.unterlageOhneMetadaten(HEIC, "d.heic"); } catch (err) { heic = String((err as Error).message); }
  ok(/HEIC/.test(heic), "HEIC abgelehnt (Metadaten nicht sicher zu entfernen)", heic);
  let html = ""; try { await P.unterlageOhneMetadaten(Buffer.from("<html><script>alert(1)</script></html>          "), "e.pdf"); } catch (err) { html = String((err as Error).message); }
  ok(/weder PDF/.test(html), "HTML mit PDF-Endung abgelehnt (Inhalt zählt)", html);

  gleich([P.staatsangehoerigkeitAlsLand("deutsch"), P.staatsangehoerigkeitAlsLand("österreichisch"), P.staatsangehoerigkeitAlsLand("Deutschland"), P.staatsangehoerigkeitAlsLand(" "), P.staatsangehoerigkeitAlsLand("italienisch")],
    ["Deutschland", "Österreich", "Deutschland", null, "Italienisch"], "Staatsangehörigkeit → Land wie im Bestand");

  const fe = (tage: number, ab: string) => T.berlinFristEnde(tage, new Date(ab)).toISOString();
  gleich(fe(0, "2026-10-28T14:55:34Z"), "2026-10-28T22:59:59.000Z", "Fristende 0 Tage = heute 23:59:59 Berlin (Winterzeit)");
  gleich(fe(7, "2026-10-28T14:55:34Z"), "2026-11-04T22:59:59.000Z", "Fristende 7 Tage = 04.11. 23:59:59 Berlin");
  gleich(fe(0, "2026-10-24T22:30:00Z"), "2026-10-25T22:59:59.000Z", "kurz nach Mitternacht Berlin zählt schon der neue Tag (Umstellung 25.10.)");
  gleich(fe(7, "2026-03-25T10:00:00Z"), "2026-04-01T21:59:59.000Z", "über die Umstellung auf Sommerzeit: Ende in Sommerzeit");

  gleich([C.kapitalCZahlbar(0), C.kapitalCZahlbar(1), C.kapitalCZahlbar(7), C.kapitalCZahlbar(14)], ["sofort", "binnen eines Tages", "binnen sieben Tagen", "binnen vierzehn Tagen"], "Fassung C: Zahlungsziel als Wort (0 = sofort, nie „null Tagen“)");
  const kp = C.kapitalCKundePruefen({ art: "privat", anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-15", geburtsort: "Musterstadt", staatsangehoerigkeit: "deutsch", strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "DE", email: "max@beispiel.example", telefon: "", ausweise: [{ art: "reisepass", nummer: "C01X00T47", gueltigBis: "2033-01-01", behoerde: "Stadt Musterstadt" }] });
  if (!kp.ok) throw new Error(`Musterkunde: ${kp.error}`);
  const D = (tage: number) => ({ ref: "FIAON-IA-CPRUEF", fassung: "IA-KAPITAL-2026-10-27-C", gueltigBis: "2026-12-31", kunde: kp.kunde,
    buergin: { name: "Muster Partner LLC", bundesstaat: "Florida", anschrift: "1 Example Way", registernummer: "L00000000000", vertreter: "Erika Muster", funktion: "Manager" },
    parameter: C.kapitalCParameterAus({ ...C.KAPITAL_C_VORGABEN, zahlungszielTage: tage }) });
  const flach = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&nbsp;|\u00a0|\u202f/g, " ").replace(/\s+/g, " ");
  const v0 = flach(C.kapitalCRumpfHtml(D(0) as any, null)); const v7 = flach(C.kapitalCRumpfHtml(D(7) as any, null));
  ok(/zahlbar sofort ohne Abzug per Überweisung/.test(v0) && /FIAON berechnet es mit Rechnung, zahlbar sofort\./.test(v0) && !/null Tagen/.test(v0), "Vertrag bei 0 Tagen: „zahlbar sofort ohne Abzug“ (Ziffer 6 Abs. 1 und 2)");
  ok(/zahlbar binnen sieben Tagen ohne Abzug per Überweisung/.test(v7) && /FIAON berechnet es mit Rechnung, zahlbar binnen sieben Tagen\./.test(v7), "Vertrag bei 7 Tagen: Wortlaut wie bisher");
  gleich(C.KAPITAL_C_VORGABEN.zahlungszielTage, 0, "neue Fassung-C-Angebote: Vorgabe „sofort“");
  const best = C.KAPITAL_C_BESTAETIGUNG.daten({ ref: "R", llc: "L", laufzeit: "x", heute: "3.289 €", zweck: null, faellig: "28.10.2026", sofort: true });
  ok(best.some((x) => x.label === "Zahlbar" && x.wert === "sofort") && !best.some((x) => x.label === "Zahlbar bis"), "Bestätigung bei 0 Tagen: „Zahlbar: sofort“");
  const best7 = C.KAPITAL_C_BESTAETIGUNG.daten({ ref: "R", llc: "L", laufzeit: "x", heute: "3.289 €", zweck: null, faellig: "04.11.2026" });
  ok(best7.some((x) => x.label === "Zahlbar bis" && x.wert === "04.11.2026"), "Bestätigung bei 7 Tagen: „Zahlbar bis“ wie bisher");
}

// ═══ 1 SAAT ═══════════════════════════════════════════════════════════════════
abschnitt("1", "Saat: Kapital-Akte wie in der Produktion (JSON-Text, ohne Person an der Akte)");
const A: any = await import("../server/lib/fiaon-global-auftrag");
const L: any = await import("../server/lib/fiaon-global-bereich");
const M: any = await import("../server/lib/fiaon-global-mandat");
const G: any = await import("../server/lib/fiaon-global-angebot");
const K: any = await import("../server/lib/fiaon-koop-empfehlung");
await A.ensureGlobalTabelle();
await L.ensureGlobalBereich();
await M.ensureGlobalMandat();
await G.ensureAngebotTabellen();
await K.ensureEmpfehlungTabelle();
const stempel = Date.now().toString(36).toUpperCase();
const REF = `FIAON-E432${stempel}-P1`;
const REF2 = `FIAON-E432${stempel}-P2`;
const MAIL = `max.pruefmann.${stempel.toLowerCase()}@beispiel.example`;
const heute = T.berlinToday();
const [person] = (await sqlPool`
  INSERT INTO fiaon_persons (person_ref, kind, first_name, last_name, primary_email, birthdate, street, zip, city, country)
  VALUES (${`FIAON-P-PRUEF${stempel}`}, 'business', 'Max', 'Prüfmann', ${MAIL}, '1980-01-15', 'Prüfweg 1', '12345', 'Musterstadt', 'DE') RETURNING id`) as any[];
const PID = Number(person.id);
const txt = (o: unknown) => JSON.stringify(o);
const RECHNUNG_AM = new Date(Date.now() - 2 * 3600_000);
const FRIST = T.berlinFristEnde(7, RECHNUNG_AM);
// Erst Angebot und Teil (die Katalogpreis-Wand der Bestellzeilen verlangt einen angenommenen Teil), dann Bestellung und Akte.
const angebote: Record<string, number> = {};
for (const ref of [REF, REF2]) {
  const [ang] = (await sqlPool`
    INSERT INTO fiaon_global_angebote (angebot_ref, person_id, fassung, kunde, parameter, buergin, status, gueltig_bis, angenommen_am, auftrag_ref)
    VALUES (${`FIAON-IA-C${ref.slice(-8)}`}, ${ref === REF ? PID : null}, 'IA-KAPITAL-2026-10-27-C', ${sqlPool.json({ art: "privat", vorname: "Max", nachname: "Prüfmann", email: MAIL } as any)},
            ${sqlPool.json({ ...C.KAPITAL_C_VORGABEN, zahlungszielTage: 7 } as any)}, ${sqlPool.json({ name: "Muster Partner LLC" } as any)}, 'angenommen', '2026-12-31', NOW() - INTERVAL '2 hours', ${ref}) RETURNING id`) as any[];
  angebote[ref] = Number(ang.id);
  await sqlPool`INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, bestell_ref, rechnung_am)
    VALUES (${Number(ang.id)}, 1, 'Gründung, Konto und Karten sowie Fast-Track', 328900, 'sofort', 7, ${ref}, ${RECHNUNG_AM})`;
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, invoice_number, invoice_date, payment_due_date, person_id, email, first_name, last_name, country)
    VALUES (${ref}, 'business', 'submitted', 'global_individuell', 'Kapital-Angebot (Prüfstand)', ${"PAY" + ref.slice(-12)}, 'pending_payment', 3289.00, ${"FIAON-INV-PRUEF-" + ref.slice(-6)}, ${RECHNUNG_AM}, ${FRIST}, ${ref === REF ? PID : null}, ${MAIL}, 'Max', 'Prüfmann', 'DE')`;
  // Wie kapitalCFertigstellen bis heute schrieb: ${JSON.stringify(x)}::jsonb → eine JSON-ZEICHENKETTE in der Spalte (to_jsonb(text)).
  await sqlPool`INSERT INTO fiaon_global_auftraege (ref, paket_key, land, firma, ansprechpartner, bestaetigungen, vertrag_version, vertrag_sprache, unterschrieben_am, quelle, status, firma_name, email, rechnung_ust_modus, gesellschaft, jahresbetreuung, angebot_id)
    VALUES (${ref}, 'global_individuell', 'DE',
      to_jsonb(${txt({ art: "privat", land: "DE", name: "Max Prüfmann", strasse: "Prüfweg 1", plz: "12345", ort: "Musterstadt" })}::text),
      to_jsonb(${txt({ anrede: "Herr", vorname: "Max", nachname: "Prüfmann", funktion: "Privatperson", email: MAIL, telefon: "" })}::text),
      to_jsonb(${txt({ annahme: "x", kapitalangebot: true, kapitalPrivat: true, sofortBeginn: true })}::text),
      'IA-KAPITAL-2026-10-27-C', 'de', NOW() - INTERVAL '2 hours', 'individualangebot', 'offen', 'Max Prüfmann', ${MAIL}, 'none',
      to_jsonb(${txt({ name: "MUSTERPOOL LLC", bundesstaat: "FL", geprueft: false })}::text), TRUE, ${Number(ang.id)})`;
}
const [koop] = (await sqlPool`
  INSERT INTO fiaon_global_angebote (angebot_ref, fassung, kunde, parameter, buergin, status, gueltig_bis, angenommen_am)
  VALUES (${`FIAON-IA-K${stempel.slice(-6)}`}, 'IA-KOOP-2026-10-16-A', ${sqlPool.json({ anrede: "Herr", vorname: "Paul", nachname: "Partner", email: "partner@beispiel.example" } as any)},
          ${sqlPool.json({ bereich: "vorsorge" } as any)}, ${sqlPool.json({} as any)}, 'angenommen', '2027-12-31', NOW() - INTERVAL '6 days') RETURNING id`) as any[];
const [e1] = (await sqlPool`INSERT INTO fiaon_koop_empfehlungen (angebot_id, name, notiz, telefon, email, quelle, eingetragen_von) VALUES (${Number(koop.id)}, 'Max Prüfmann', 'interne Notiz Prüfstand', '+49 30 1234567', ${MAIL}, 'fiaon', 'Prüfstand') RETURNING id`) as any[];
const [e2] = (await sqlPool`INSERT INTO fiaon_koop_empfehlungen (angebot_id, name, quelle, eingetragen_von) VALUES (${Number(koop.id)}, 'Erika Andere', 'fiaon', 'Prüfstand') RETURNING id`) as any[];
const EID = Number(e1.id); const EID_FREMD = Number(e2.id);
const [typen] = (await sqlPool`SELECT jsonb_typeof(firma) AS f, jsonb_typeof(gesellschaft) AS g, person_id FROM fiaon_global_auftraege WHERE ref = ${REF}`) as any[];
ok(typen.f === "string" && typen.g === "string" && typen.person_id == null, "Saat wie in der Produktion: JSON-Text, person_id leer", typen);

// Unterlagen-Ordner und private Datei (ausgedacht)
const ORDNER = fs.mkdtempSync(path.join(os.tmpdir(), "pflege-e432-"));
const dateien: Record<string, Buffer> = {
  "01 Reisepass.pdf": await pdfMitMeta("Reisepass Pruefstand"),
  "02 Personalausweis Vorderseite.png": pngMitText(2),
  "03 Personalausweis Rueckseite.png": pngMitText(3),
  "04 Gehaltsnachweis 2026-08.jpg": jpegMitExif(4),
  "05 Gehaltsnachweis 2026-09.jpg": jpegMitExif(5),
  "07 Kontoauszug Musterbank 2026-10.pdf": await pdfMitMeta("Kontoauszug Pruefstand", 300),
  "08 Kontoauszug signiert 2026-09.pdf": SIGNIERT,
  ".lesebild.png": pngMitText(9),
  "notiz.txt": Buffer.from("nur eine Notiz"),
};
for (const [n, b] of Object.entries(dateien)) fs.writeFileSync(path.join(ORDNER, n), b);
const PRIVAT = path.join(ORDNER, "..", `pflege-e432-${stempel}.json`);
fs.writeFileSync(PRIVAT, JSON.stringify({ kunde: { art: "privat", anrede: "Herr", vorname: "Max", nachname: "Prüfmann", email: MAIL.toUpperCase(), staatsangehoerigkeit: "deutsch", telefon: "",
  ausweise: [{ art: "reisepass", nummer: "C01X00T47", gueltigBis: "2033-01-01", behoerde: "Stadt Musterstadt" }, { art: "personalausweis", nummer: "T22000129", gueltigBis: "2032-05-05", behoerde: "x" }] } }));
const FREMD = path.join(ORDNER, "..", `pflege-e432-${stempel}-fremd.json`);
fs.writeFileSync(FREMD, JSON.stringify({ kunde: { anrede: "Frau", vorname: "Erika", nachname: "Andere", email: "erika@andere.example", staatsangehoerigkeit: "deutsch" } }));

function lauf(args: string[], dbUrl = url): { code: number; out: string } {
  const r = spawnSync(TSX, [SKRIPT, ...args], { cwd: WURZEL, encoding: "utf8", env: { PATH: String(process.env.PATH), HOME: String(process.env.HOME), TZ: "Europe/Berlin", CRONS: "aus", DOTENV_CONFIG_PATH: "/dev/null", DATABASE_URL: dbUrl } });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}
const ergebnis = (out: string) => { const m = out.match(/ERGEBNIS (\{.*\})/); return m ? JSON.parse(m[1]) : null; };
async function schnappschuss(ref: string): Promise<string> {
  const teile = await Promise.all([
    sqlPool`SELECT id, art, titel, doc_hash, sichtbar_fuer_kunde FROM fiaon_global_dokumente WHERE ref = ${ref} ORDER BY id`,
    sqlPool`SELECT schluessel, status, datum, intern FROM fiaon_global_schritte WHERE ref = ${ref} ORDER BY schluessel`,
    sqlPool`SELECT id, art, text, sichtbar FROM fiaon_global_verlauf WHERE ref = ${ref} ORDER BY id`,
    sqlPool`SELECT person_id, gesellschaft::text AS g, firma::text AS f FROM fiaon_global_auftraege WHERE ref = ${ref}`,
    sqlPool`SELECT nationality, passport_number, passport_expiry, payment_due_date FROM fiaon_applications WHERE ref = ${ref}`,
    sqlPool`SELECT anrede, anrede_quelle, nationality FROM fiaon_persons WHERE id = ${PID}`,
    sqlPool`SELECT id, person_id FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(koop.id)} ORDER BY id`,
    sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log`,
    sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_contact_log WHERE ref = ${ref}`,
  ]);
  return JSON.stringify(teile);
}
const ALLE = ["--ref", REF, "--tresor", ORDNER, "--name-geprueft", heute, "--akte", PRIVAT, "--empfehlung", String(EID)];

// ═══ 2 ROTPROBE ═══════════════════════════════════════════════════════════════
abschnitt("2", "Rotprobe: das alte UPDATE für „geprüft“ trifft JSON-Text nicht");
{
  const r = await sqlPool`UPDATE fiaon_global_auftraege SET gesellschaft = jsonb_set(gesellschaft, '{geprueft}', 'true'::jsonb), updated_at = NOW()
                          WHERE ref = ${REF2} AND gesellschaft IS NOT NULL AND gesellschaft->>'geprueft' = 'false'`;
  ok(r.count === 0, "ALT: 0 Zeilen getroffen — der Merker blieb false, die Zahlungsseite bei „vorgemerkt“", r.count);
}

// ═══ 3 VORSCHAU ═══════════════════════════════════════════════════════════════
abschnitt("3", "Vorschau: Plan vollständig, Datenbank unverändert");
{
  const vorher = await schnappschuss(REF);
  const v = lauf(ALLE);
  const e = ergebnis(v.out);
  ok(v.code === 0 && e?.geschrieben === false && e?.neu === 4 && e?.nein === 0 && e?.fehler === 0, "Vorschau: Exit 0, vier Schritte neu", { code: v.code, e, out: v.out.slice(-1500) });
  ok(/nur Vorschau \(Verbindung nur lesend\)/.test(v.out) && /Nur Vorschau — nichts geschrieben/.test(v.out), "Vorschau sagt, dass nichts geschrieben wird", v.out.slice(0, 600));
  ok(/01 Reisepass\.pdf → „Reisepass“ \(Reisepass · Mappe „Ihre Nachweise“\)/.test(v.out) && /Metadaten entfernt: Info .*XMP/.test(v.out), "Plan: Reisepass mit Mappe und entfernten Metadaten", v.out);
  ok(/„Personalausweis – Rückseite“/.test(v.out) && /„Gehaltsnachweis September 2026“ \(Einkommensnachweis/.test(v.out) && /„Kontoauszug Oktober 2026“ \(Kontoauszug · Mappe „Bank und Konto“\)/.test(v.out), "Plan: Ausweis, Gehalt, Kontoauszug in ihren Mappen", v.out);
  ok(/signiert 2026-09\.pdf .*digitaler Signatur/.test(v.out), "Plan: signiertes PDF bleibt unverändert", v.out);
  ok(/notiz\.txt: Art nicht erkannt/.test(v.out) && /\+1 versteckte, bleiben liegen/.test(v.out) && !/lesebild/.test(v.out), "Plan: Unbekanntes und Verstecktes bleiben liegen", v.out);
  ok(/offen → erledigt am .* Beleg \(intern\) „Sunbiz .*: frei“ · Merker „geprüft“: nein → ja \(JSON-Text wird dabei zum Objekt\)/.test(v.out), "Plan: Name geprüft mit Beleg und Merker", v.out);
  ok(/Akte · Person: leer → Person \d+/.test(v.out) && /Person · Anrede: leer → Herr/.test(v.out) && /Bestellung · Reisepass-Nummer: leer → •{9} \(9 Zeichen\)/.test(v.out), "Plan: Akte, Anrede, Pass maskiert", v.out);
  ok(!/C01X00T47|1980-01-15|T22000129/.test(v.out), "Ausgabe ohne Ausweisnummern oder Geburtsdatum");
  ok(/Empfehlung \d+ \(Kooperation FIAON-IA-K.*\): Person — → \d+ · Name passt/.test(v.out), "Plan: Empfehlung mit Namensprobe", v.out);
  gleich(await schnappschuss(REF), vorher, "Datenbank Byte für Byte unverändert");
}

// ═══ 4 SCHREIBEN ══════════════════════════════════════════════════════════════
abschnitt("4", "Schreiben: Tresor, Name geprüft, Akte, Empfehlung — und die Zahlungsseite zieht mit");
{
  const mailVorher = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log`) as any[])[0].n);
  const s = lauf([...ALLE, "--schreiben"]);
  const e = ergebnis(s.out);
  ok(s.code === 0 && e?.geschrieben === true && e?.neu === 4 && e?.fehler === 0 && e?.nein === 0, "Schreiben: Exit 0, vier Schritte erledigt", { code: s.code, e, out: s.out.slice(-2500) });
  const doks = (await sqlPool`SELECT id, von, art, titel, dateiname, mime, inhalt, sichtbar_fuer_kunde FROM fiaon_global_dokumente WHERE ref = ${REF} AND geloescht_am IS NULL ORDER BY id`) as any[];
  gleich(doks.map((d) => [d.art, d.titel]), [["reisepass", "Reisepass"], ["personalausweis", "Personalausweis – Vorderseite"], ["personalausweis", "Personalausweis – Rückseite"],
    ["einkommensnachweis", "Gehaltsnachweis August 2026"], ["einkommensnachweis", "Gehaltsnachweis September 2026"], ["kontoauszug", "Kontoauszug Oktober 2026"], ["kontoauszug", "Kontoauszug September 2026"]], "Tresor: sieben Unterlagen mit Art und Titel");
  // Gutachten 28.10.2026: Ohne AKTIVES Kundenkonto öffnet der Link aus der Vertragsbestätigung das Portal ohne Anmeldung — darum intern.
  ok(doks.every((d) => d.von === "fiaon" && d.sichtbar_fuer_kunde === false), "Tresor: von FIAON abgelegt, INTERN (Kunde hat noch kein aktives Konto)");
  ok(doks.filter((d) => d.titel !== "Kontoauszug September 2026").every((d) => ohneSpur(Buffer.from(d.inhalt))), "Tresor: keine Metadaten in den gespeicherten Bytes");
  ok(Buffer.from(doks.find((d) => d.titel === "Kontoauszug September 2026")?.inhalt ?? []).equals(SIGNIERT), "Tresor: signiertes PDF Byte für Byte erhalten");
  gleich(doks.map((d) => d.dateiname), ["Reisepass.pdf", "Personalausweis Vorderseite.png", "Personalausweis Rückseite.png", "Gehaltsnachweis 2026-08.jpg", "Gehaltsnachweis 2026-09.jpg", "Kontoauszug 2026-10.pdf", "Kontoauszug 2026-09.pdf"], "Tresor: neutrale Dateinamen (ohne Nummer, ohne Bank)");
  const mailNach = Number(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log`) as any[])[0].n);
  ok(mailNach === mailVorher, "keine Mail (fiaon_mail_log unverändert)", { mailVorher, mailNach });
  const [st] = (await sqlPool`SELECT status, datum, intern, hinweis FROM fiaon_global_schritte WHERE ref = ${REF} AND schluessel = 'name'`) as any[];
  ok(st?.status === "erledigt" && T.berlinToday(new Date(st.datum)) === heute && /^Sunbiz .*: frei$/.test(String(st.intern)) && st.hinweis == null, "Station „Name geprüft“: erledigt, Datum, Beleg intern, kein Kundenhinweis", st);
  const [g] = (await sqlPool`SELECT jsonb_typeof(gesellschaft) AS typ, gesellschaft->>'geprueft' AS geprueft, gesellschaft->>'name' AS name, gesellschaft->>'bundesstaat' AS staat, person_id FROM fiaon_global_auftraege WHERE ref = ${REF}`) as any[];
  ok(g.typ === "object" && g.geprueft === "true" && g.name === "MUSTERPOOL LLC" && g.staat === "FL", "Gesellschaft jetzt Objekt, geprüft = true, Name und Staat erhalten", g);
  ok(Number(g.person_id) === PID, "Akte: Person eingetragen", g.person_id);
  const [pp] = (await sqlPool`SELECT anrede, anrede_quelle, nationality FROM fiaon_persons WHERE id = ${PID}`) as any[];
  ok(pp.anrede === "Herr" && pp.anrede_quelle === "vertrag" && pp.nationality === "Deutschland", "Person: Anrede (Quelle Vertrag), Staatsangehörigkeit", pp);
  const [ap] = (await sqlPool`SELECT nationality, passport_number, passport_expiry FROM fiaon_applications WHERE ref = ${REF}`) as any[];
  ok(ap.nationality === "Deutschland" && ap.passport_number === "C01X00T47" && T.berlinToday(new Date(ap.passport_expiry)) === "2033-01-01", "Bestellung: Staatsangehörigkeit und Reisepass", { ...ap, passport_number: ap.passport_number ? "gesetzt" : null });
  const emp = (await sqlPool`SELECT id, person_id FROM fiaon_koop_empfehlungen WHERE angebot_id = ${Number(koop.id)} ORDER BY id`) as any[];
  gleich(emp.map((x) => [Number(x.id), x.person_id == null ? null : Number(x.person_id)]), [[EID, PID], [EID_FREMD, null]], "Empfehlung zugeordnet, die fremde bleibt frei");
  const verlauf = (await sqlPool`SELECT text, sichtbar FROM fiaon_global_verlauf WHERE ref = ${REF} ORDER BY id`) as any[];
  ok(!verlauf.some((x) => x.sichtbar && /^Neues Dokument in Ihrem Tresor: /.test(x.text)) && verlauf.some((x) => x.sichtbar && x.text === "Erledigt: Name geprüft."), "Kunde liest im Verlauf: keine Tresor-Zeile (intern), „Erledigt: Name geprüft.“", verlauf.map((x) => x.text));
  ok(verlauf.some((x) => !x.sichtbar && /^Personendaten aus dem Vertrag nachgetragen/.test(x.text)) && !verlauf.some((x) => /C01X00T47/.test(x.text)), "intern: Zeile „Personendaten nachgetragen“, ohne Passnummer");
  // Die Zahlungsseite (E-320) — dieselbe Funktion wie /zahlung/<Zweck>
  const B: any = await import("../server/lib/fiaon-global-angebot-begleit");
  const [b] = (await sqlPool`SELECT ref, payment_reference, invoice_number, payment_status, payment_due_date FROM fiaon_applications WHERE ref = ${REF}`) as any[];
  const k: any = await B.angebotTeilZahlungsKontext(b);
  const titel = (k?.pruefungen ?? []).map((x: any) => x.titel);
  ok(titel.includes("Name geprüft") && !titel.includes("Wunschname vorgemerkt"), "Zahlungsseite: „Name geprüft“ statt „vorgemerkt“", titel);
  ok(titel.includes("Reisepass erhalten und geprüft") && titel.includes("Anmeldung vorbereitet"), "Zahlungsseite: Reisepass erhalten, Anmeldung vorbereitet", titel);
  const zahl = (k?.pruefungen ?? []).find((x: any) => x.titel === "Nur noch: Ihre Zahlung");
  const bis = T.berlinToday(FRIST);
  ok(zahl && zahl.text === `fällig mit Ihrem Auftrag — bitte jetzt überweisen, spätestens bis zum ${bis.slice(8, 10)}.${bis.slice(5, 7)}.${bis.slice(0, 4)}; mit dem Eingang melden wir Ihre Gesellschaft an` && !/binnen \d/.test(zahl.text), "Zahlungsseite: „fällig mit Ihrem Auftrag — bitte jetzt überweisen, spätestens bis zum …“", zahl);
  const heuteFaellig: any = await B.angebotTeilZahlungsKontext({ ...b, payment_due_date: new Date() });
  ok((heuteFaellig?.pruefungen ?? []).some((x: any) => x.text === "fällig mit Ihrem Auftrag — bitte heute überweisen; mit dem Eingang melden wir Ihre Gesellschaft an"), "Zahlungsseite bei „sofort“: „bitte heute überweisen“ (nie „überfällig“)");
  // Partnerbereich (E-432): Nach dem Zuordnen steht die Empfehlung „im Gespräch“ — und das JSON der Partnerseite trägt keine
  // interne Notiz, kein Telefon, keine E-Mail und keine Personennummer (Tippgeber-Vereinbarung Ziffer 5 Abs. 1).
  try {
    const KL: any = await import("../server/lib/fiaon-koop-lieferung");
    await KL.ensureKoopTabellen();
    const zk = await G.angebotLesen({ id: Number(koop.id) });
    const ps: any = await KL.koopPartnerSicht(zk);
    const x = (ps?.empfehlungen?.liste ?? []).find((y: any) => Number(y.id) === EID);
    ok(!!x && x.stand === "im_gespraech", "Partnerbereich: Empfehlung jetzt „im Gespräch“", x);
    ok(!!x && !("notiz" in x) && !("telefon" in x) && !("email" in x) && !("personId" in x) && !JSON.stringify(ps.empfehlungen).includes(String(PID)) && !JSON.stringify(ps.empfehlungen).includes("interne Notiz"),
      "Partnerbereich-JSON ohne Notiz, Telefon, E-Mail und Personennummer", x);
    const intern: any = await K.koopEmpfehlungSicht(zk);
    ok(intern.liste.some((y: any) => y.personId === PID && y.notiz === "interne Notiz Prüfstand"), "Chefbüro-Sicht behält Person und Notiz");
  } catch (err) { ok(false, `Partnerbereich warf: ${String((err as Error)?.message ?? err).slice(0, 200)}`); }
  // Formulare (Statement, Operating Agreement …) lesen die Akte: Privatperson = „Auftraggeber“ (nicht „für die Auftraggeberin“),
  // Gesellschaft aus der Akte (Name, Florida) — auch bei einer Akte, die als JSON-Text angelegt wurde.
  const U: any = await import("../server/lib/fiaon-global-unterschrift");
  const fk: any = await U.formularKontext(REF);
  ok(fk && fk.weiblich === false && fk.kundeName === "Max Prüfmann" && fk.llc?.name === "MUSTERPOOL LLC" && fk.llc?.bundesstaat === "FL", "Formulare: Privatperson „Auftraggeber“, Gesellschaft und Florida aus der Akte", fk && { weiblich: fk.weiblich, name: fk.kundeName, llc: fk.llc?.name, staat: fk.llc?.bundesstaat });
  // Chefbüro-Sicht: die Dokumente hängen in der Akte
  const chef: any = await M.globalMandatChefSicht(REF);
  ok((chef?.dokumente ?? []).length === 7, "Chefbüro-Akte zeigt die sieben Unterlagen", (chef?.dokumente ?? []).length);
}

// ═══ 5 ZWEITER LAUF ═══════════════════════════════════════════════════════════
abschnitt("5", "Zweiter Lauf: nichts Neues");
{
  const vorher = await schnappschuss(REF);
  const s = lauf([...ALLE, "--schreiben"]);
  const e = ergebnis(s.out);
  ok(s.code === 0 && e?.neu === 0 && e?.schon === 4 && e?.nein === 0 && e?.fehler === 0, "zweiter Lauf: Exit 0, alles „schon da“", { code: s.code, e, out: s.out.slice(-1500) });
  gleich(await schnappschuss(REF), vorher, "zweiter Lauf: Datenbank unverändert (kein Dokument, keine Verlaufszeile)");
}

// ═══ 6 SCHUTZ ═════════════════════════════════════════════════════════════════
abschnitt("6", "Schutz: Vertragsfrist, fremde Datei, fremde Empfehlung, falsche Datenbank");
{
  const [vor] = (await sqlPool`SELECT payment_due_date FROM fiaon_applications WHERE ref = ${REF}`) as any[];
  const frueh = lauf(["--ref", REF, "--faellig", heute, "--schreiben"]);
  const [nach] = (await sqlPool`SELECT payment_due_date FROM fiaon_applications WHERE ref = ${REF}`) as any[];
  ok(frueh.code === 1 && /Laut Vertrag .* zahlbar binnen 7 Tagen — spätester Zahltag/.test(frueh.out) && /§ 271 Abs\. 2 BGB/.test(frueh.out), "Frist vor dem Vertragstag: abgelehnt mit Begründung, Exit 1", frueh.out.slice(-900));
  ok(new Date(vor.payment_due_date).getTime() === new Date(nach.payment_due_date).getTime(), "… und nichts geändert");
  const gleicherTag = lauf(["--ref", REF, "--faellig", T.berlinToday(FRIST), "--schreiben"]);
  ok(gleicherTag.code === 0 && /steht schon so/.test(gleicherTag.out), "Frist = Vertragstag: steht schon so", gleicherTag.out.slice(-600));
  const spaeter = new Date(Date.UTC(Number(heute.slice(0, 4)), Number(heute.slice(5, 7)) - 1, Number(heute.slice(8, 10)) + 14)).toISOString().slice(0, 10);
  const [ag] = (await sqlPool`SELECT id, name FROM fiaon_agents ORDER BY id LIMIT 1`) as any[];
  const lang = lauf(["--ref", REF, "--faellig", spaeter, "--schreiben", ...(ag ? ["--agent", String(ag.id)] : [])]);
  const [neu] = (await sqlPool`SELECT payment_due_date, payment_status FROM fiaon_applications WHERE ref = ${REF}`) as any[];
  const [log] = (await sqlPool`SELECT agent_name, note FROM fiaon_contact_log WHERE ref = ${REF} ORDER BY id DESC LIMIT 1`) as any[];
  ok(lang.code === 0 && T.berlinToday(new Date(neu.payment_due_date)) === spaeter && neu.payment_status === "pending_payment" && /Zahlungsfrist geändert durch .*: .* → .* — Pflege-Skript \(E-432\)/.test(String(log?.note))
    && (!ag || log?.agent_name === String(ag.name)), "späterer Tag (zugunsten des Kunden): gesetzt, Protokoll mit Namen", { code: lang.code, neu, log, out: lang.out.slice(-600) });
  const ende = new Date(neu.payment_due_date);
  ok(T.berlinToday(new Date(ende.getTime() + 1000)) !== spaeter && T.berlinToday(ende) === spaeter, "… gespeichert als 23:59:59 Berlin (eine Sekunde später ist der nächste Tag)", ende.toISOString());
  const fremd = lauf(["--ref", REF2, "--akte", FREMD, "--schreiben"]);
  ok(fremd.code === 1 && /passt nicht zu diesem Auftrag/.test(fremd.out), "fremde Datei für die Akte: abgelehnt", fremd.out.slice(-600));
  const fremdeEmp = lauf(["--ref", REF, "--empfehlung", String(EID_FREMD), "--schreiben"]);
  const [ef] = (await sqlPool`SELECT person_id FROM fiaon_koop_empfehlungen WHERE id = ${EID_FREMD}`) as any[];
  ok(fremdeEmp.code === 1 && /Name der Empfehlung .* passt nicht/.test(fremdeEmp.out) && ef.person_id == null, "Empfehlung mit fremdem Namen: abgelehnt, nichts zugeordnet", fremdeEmp.out.slice(-600));
  const fremdeDb = lauf(["--ref", REF, "--name-geprueft", heute], "postgresql://x@db.beispiel.example:5432/irgendwas");
  ok(fremdeDb.code === 2 && /nur mit --produktion/.test(fremdeDb.out), "fremde Datenbank ohne --produktion: Abbruch", fremdeDb.out.slice(-400));
  const tipp = lauf(["--ref", REF, "--tresorr", ORDNER]);
  ok(tipp.code === 2 && /Unbekannter Schalter/.test(tipp.out), "Tippfehler im Schalter: Abbruch", tipp.out.slice(-300));
  const nichts = lauf(["--ref", REF]);
  ok(nichts.code === 2 && /Keine Aktion gewählt/.test(nichts.out), "ohne Aktion: Abbruch", nichts.out.slice(-300));
}

abschnitt("6b", "Tresor bei AKTIVEM Kundenkonto: sichtbar");
{
  const [k] = (await sqlPool`INSERT INTO fiaon_global_konten (email, name, status, quelle) VALUES (${("aktiv-" + stempel + "@beispiel.example").toLowerCase()}, 'Erika Aktiv', 'aktiv', 'pruefstand') RETURNING id`) as any[];
  await sqlPool`INSERT INTO fiaon_global_konto_refs (konto_id, art, ref, quelle) VALUES (${Number(k.id)}, 'auftrag', ${REF2}, 'pruefstand')`;
  const a = lauf(["--ref", REF2, "--tresor", ORDNER, "--schreiben"]);
  const d2 = (await sqlPool`SELECT sichtbar_fuer_kunde FROM fiaon_global_dokumente WHERE ref = ${REF2} AND geloescht_am IS NULL`) as any[];
  ok(a.code === 0 && d2.length === 7 && d2.every((d) => d.sichtbar_fuer_kunde === true), "aktives Konto: sieben Unterlagen, für den Kunden sichtbar", { code: a.code, n: d2.length, out: a.out.slice(-800) });
}

abschnitt("7", "Provision: der Fast-Track der Fassung C zählt nicht (Justin 28.10.2026)");
{
  // Bankbestätigte Zahlung der ersten Rechnung (3.289,00 €) — die Empfehlung ist seit Abschnitt 4 der Person zugeordnet.
  await sqlPool`UPDATE fiaon_applications SET payment_status = 'paid', paid_at = NOW() WHERE ref = ${REF}`;
  const sicht = await K.koopEmpfehlungSicht({ id: Number(koop.id), schalter: { provision: { prozent: 30, seit: "2026-10-22" } } });
  const z = sicht.liste.find((x: any) => Number(x.id) === EID);
  ok(z && z.umsatzCents === 328900 - C.KAPITAL_C_VORGABEN.fastTrackCents && z.provisionCents === Math.round((328900 - C.KAPITAL_C_VORGABEN.fastTrackCents) * 0.3),
    "Partnerbereich: Umsatz ohne Fast-Track (2.790,00 €), Provision 30 % = 837,00 €", z ? { umsatz: z.umsatzCents, provision: z.provisionCents } : null);
  const monat = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
  const posten = await K.koopGutschriftPosten(Number(koop.id), monat, 30);
  const pz = posten.filter((x: any) => x.ref === REF);
  ok(pz.length === 1 && pz[0].umsatzCents === 279000 && pz[0].provisionCents === 83700, "Gutschrift-Posten: 2.790,00 € → 837,00 €", pz);
  // Eine spätere Zahlung derselben Person (Erfolgshonorar, eigene Bestellung) zählt voll.
  // Wie Teil 2 im Betrieb: erst der angenommene Teil (Katalogpreis-Wand), dann die Bestellzeile.
  await sqlPool`INSERT INTO fiaon_global_angebot_teile (angebot_id, nr, titel, betrag_cents, faelligkeit, zahlungsziel_tage, bestell_ref, rechnung_am)
    VALUES (${angebote[REF]}, 2, 'Erfolgshonorar', 689000, 'sofort', 7, ${REF + "-T2"}, ${RECHNUNG_AM})`;
  await sqlPool`INSERT INTO fiaon_applications (ref, type, status, pack_key, pack_name, payment_reference, payment_status, amount_due, person_id, email, first_name, last_name, country, paid_at)
    VALUES (${REF + "-T2"}, 'business', 'submitted', 'global_individuell', 'Erfolgshonorar (Prüfstand)', ${"PAY2" + REF.slice(-10)}, 'paid', 6890.00, ${PID}, ${MAIL}, 'Max', 'Prüfmann', 'DE', NOW())`;
  const sicht2 = await K.koopEmpfehlungSicht({ id: Number(koop.id), schalter: { provision: { prozent: 30, seit: "2026-10-22" } } });
  const z2 = sicht2.liste.find((x: any) => Number(x.id) === EID);
  ok(z2 && z2.umsatzCents === 279000 + 689000, "Erfolgshonorar zählt voll (2.790 € + 6.890 €)", z2 ? z2.umsatzCents : null);
}

fs.rmSync(ORDNER, { recursive: true, force: true }); fs.rmSync(PRIVAT, { force: true }); fs.rmSync(FREMD, { force: true });
await sqlPool.end({ timeout: 5 }).catch(() => {});
console.log(`\n${gut} Prüfungen bestanden, ${rot.length} rot.`);
if (rot.length) { console.log(rot.map((r) => `  · ${r}`).join("\n")); process.exit(1); }
