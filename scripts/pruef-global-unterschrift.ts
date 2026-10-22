// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: Befugnisse in jedem Vertrag, Ergänzung, digitales Unterschreiben,
// IRS SS-4/8821, Statement of Organizer, Operating Agreement (22.10.2026)
//
//   npx tsx scripts/pruef-global-unterschrift.ts            rein (ohne Datenbank, ohne Netz)
//   npx tsx scripts/pruef-global-unterschrift.ts --pdf DIR  legt die Muster-PDFs in DIR ab (zum Ansehen)
//   npx tsx scripts/pruef-global-unterschrift.ts --rot-probe  baut den Schaden nach (SS-4 digital erlaubt) — muss rot werden
//
// Alle Daten sind MUSTER (Repo öffentlich): Max Mustermann, MUSTER HOLDINGS LLC, *.example.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
const ROT = process.argv.includes("--rot-probe");
const pdfOrt = process.argv.indexOf("--pdf") > 0 ? String(process.argv[process.argv.indexOf("--pdf") + 1]) : "";

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: boolean, text: string, fund: unknown = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund ? `  →  ${typeof fund === "string" ? fund : JSON.stringify(fund).slice(0, 400)}` : ""}`); }
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const B = await import("../shared/fiaon-global-befugnisse");
const G = await import("../shared/fiaon-global");
const V = await import("../server/lib/fiaon-global-vertrag");
const IA = await import("../shared/fiaon-global-angebot");
const BG = await import("../shared/fiaon-global-angebot-begleit");
const KA = await import("../shared/fiaon-global-angebot-kapital");
const FI = await import("../shared/fiaon-global-angebot-firma");
const US = await import("../shared/fiaon-global-us-dokumente");
const IRS = await import("../shared/fiaon-global-irs");
const UW = await import("../shared/fiaon-global-unterschrift");
const AK = await import("../shared/fiaon-global-akte");
const W = await import("../shared/fiaon-global-wortregeln");
const SATZ = await import("../server/lib/fiaon-global-pdf-satz");
const IRSF = await import("../server/lib/fiaon-global-irs");
const SIEGEL = await import("../server/lib/fiaon-global-siegel");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

const absText = (z: { absaetze: { art: string; text?: string; einleitung?: string; zeilen?: string[] }[] }[]) =>
  z.flatMap((x) => x.absaetze.flatMap((a) => (a.art === "p" ? [a.text ?? ""] : [a.einleitung ?? "", ...(a.zeilen ?? [])]))).join("\n");
const ohneHtml = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ");
const flach = (s: string) => s.replace(/\s+/g, " ");

// ═══ 1 EINE QUELLE IN JEDEM VERTRAG ═══════════════════════════════════════════
abschnitt("1 Befugnisse: eine Quelle in jedem Global-Vertrag");
{
  const de = B.befugnisseSaetze("auftraggeber");
  const deW = B.befugnisseSaetze("auftraggeberin");
  const en = B.befugnisseSaetze("en");
  const enthaelt = (text: string, saetze: string[]) => saetze.filter((x) => x && !flach(text).includes(flach(x)));
  // Paketauftrag de/en, Unternehmen und Privatperson
  const firma = { name: "Muster GmbH", rechtsform: "GmbH", strasse: "Musterstraße 1", plz: "10115", ort: "Berlin", land: "DE", registergericht: "Amtsgericht Berlin", registernummer: "HRB 1" };
  const unterzeichner = { anrede: "Herr", vorname: "Max", nachname: "Mustermann", funktion: "Geschäftsführer", email: "m.muster@beispiel.example", telefon: "+49 30 1234567" };
  for (const sprache of ["de", "en"] as const) for (const art of ["unternehmen", "privat"] as const) {
    const d: any = { paket: "global_struktur", sprache, firma, ansprechpartner: unterzeichner, auftraggeber: art, sofortBeginn: true, ref: "FIAON-MUSTER1" };
    const text = ohneHtml(V.globalVertragRumpfHtml(d));
    const fehlt = enthaelt(text, sprache === "en" ? en : de.map((x) => x.replace(/Auftrags/g, "Auftrags")));
    const fehltA = enthaelt(text, B.befugnisseSaetze(sprache === "en" ? "en" : "auftraggeber", { vertragWort: "Auftrag" }));
    ok(fehltA.length === 0, `Paketauftrag ${sprache}/${art}: jeder Satz der Befugnisse wörtlich`, fehltA[0] ?? fehlt[0]);
    ok(new RegExp(`\\b${V.globalVertragZiffern(sprache, art).indexOf(sprache === "en" ? "Authority of FIAON" : "Befugnisse von FIAON") + 1} ${sprache === "en" ? "Authority of FIAON" : "Befugnisse von FIAON"}`).test(text), `Paketauftrag ${sprache}/${art}: Ziffer mit Titel`);
    ok(V.globalVertragZiffern(sprache, art).length === 13, `Paketauftrag ${sprache}/${art}: dreizehn Ziffern`);
    ok(sprache === "en" ? /Towards authorities FIAON acts under clause 12\./.test(text) : /Gegenüber Behörden handelt FIAON nach Ziffer 12\./.test(text), `Paketauftrag ${sprache}: Ziffer 4 verweist auf die Befugnisse (12)`);
  }
  // Individualangebot
  const KUNDE = { anrede: "Herr", vorname: "Max", nachname: "Mustermann", geburtsdatum: "1980-01-01", strasse: "Musterstraße 1", plz: "10115", ort: "Berlin", land: "DE", email: "m.muster@beispiel.example", telefon: "+49 30 1234567" };
  const ia: any = { ref: "FIAON-IA-MUSTER", fassung: IA.ANGEBOT_FASSUNG, kunde: KUNDE, parameter: IA.ANGEBOT_VORGABEN, buergin: { name: "Muster Guarantor Inc.", registernummer: "1", registerstelle: "X", bestaetigt: true, bestaetigtGrundlage: "x" }, pruefbericht: null, gueltigBis: "2026-11-30" };
  const iaZ = IA.angebotZiffern(ia, { sofortBeginn: true, jahresbetreuung: false } as any);
  ok(iaZ[14].titel === "Befugnisse von FIAON" && iaZ[15].titel === "Schlussbestimmungen" && enthaelt(absText(iaZ), de).length === 0, "Individualangebot: Ziffer 15 = Befugnisse (wörtlich), 16 = Schluss", enthaelt(absText(iaZ), de)[0]);
  ok(/Gegenüber Behörden handelt FIAON nach Ziffer 15\./.test(absText(iaZ)), "Individualangebot: Ziffer 7 verweist auf Ziffer 15");
  // Begleit
  const bgZ = BG.begleitZiffern({ ref: "FIAON-IA-BMUSTER", fassung: BG.BEGLEIT_FASSUNG, kunde: KUNDE, parameter: BG.BEGLEIT_VORGABEN, gueltigBis: "2026-11-30" } as any);
  ok(bgZ[13].titel === "Befugnisse von FIAON" && bgZ[14].titel === "Schlussbestimmungen" && enthaelt(absText(bgZ), de).length === 0, "Begleit: Ziffer 14 = Befugnisse (wörtlich), 15 = Schluss", enthaelt(absText(bgZ), de)[0]);
  ok(/Gegenüber Behörden handelt FIAON nach Ziffer 14\./.test(absText(bgZ)), "Begleit: Ziffer 9 verweist auf Ziffer 14");
  // Kapital und Firma: „Auftraggeberin“ — die Ziffer selbst aus derselben Quelle (Quelltext: ein Aufruf, keine Kopie)
  const kapQ = datei("shared/fiaon-global-angebot-kapital.ts"); const firQ = datei("shared/fiaon-global-angebot-firma.ts");
  ok(/\{ nr: 12, titel: BEFUGNISSE_TITEL\.de, absaetze: befugnisseAbsaetze\("auftraggeberin"\) \}/.test(kapQ) && /\{ nr: 13, titel: "Schlussbestimmungen"/.test(kapQ), "Kapital: Ziffer 12 = Befugnisse aus der Quelle, 13 = Schluss");
  ok(/\{ nr: 20, titel: BEFUGNISSE_TITEL\.de, absaetze: befugnisseAbsaetze\("auftraggeberin"\) \}/.test(firQ) && /\{ nr: 21, titel: "Recht, Gerichtsstand und Schlussbestimmungen"/.test(firQ) && (FI.FIRMA_ZIFFER_TITEL as readonly string[]).includes("Befugnisse von FIAON"), "Firma: Ziffer 20 = Befugnisse aus der Quelle, 21 = Recht/Schluss");
  for (const q of [kapQ, firQ, datei("shared/fiaon-global-angebot.ts"), datei("shared/fiaon-global-angebot-begleit.ts"), datei("server/lib/fiaon-global-vertrag.ts")]) {
    ok(!/beauftragt und bevollmächtigt FIAON/.test(q), "kein abgeschriebener Befugnis-Satz in einer Vertragsdatei (nur die Quelle)");
  }
  ok(deW.every((x) => !/\bder Auftraggeber\b|\bdes Auftraggebers\b/.test(x)), "„Auftraggeberin“-Form ohne männliche Reste");
  // Inhalt nach der Entscheidung des Gründers (22.10. abends)
  const alle = de.join(" ");
  ok(/zugelassene Partner \(US-CPA, Steuerberater, Rechtsanwälte\), die Steuererklärungen und -meldungen \(z\. B\. Form 5472\/1120\) erstellen und einreichen sowie rechtliche Leistungen erbringen/.test(alle), "Umfang: Steuern und Recht über Partner (5472/1120)");
  ok(/ihre Honorare trägt FIAON im Rahmen des Vertrags/.test(alle) && /im eigenen Mandat des Auftraggebers/.test(alle), "Partner im eigenen Mandat, Honorare trägt FIAON");
  const grenzen = de.find((x) => x.startsWith("Ausgenommen sind allein"))!;
  ok(/Eröffnung von Konten/.test(grenzen) && /Kredite, Kreditkarten, Darlehen/.test(grenzen) && /Bürgschaften/.test(grenzen) && /Gesellschaftsanteilen und die Auflösung/.test(grenzen), "Grenzen: Konten/Geld, Finanzierung/Bürgschaften, Anteile/Auflösung");
  ok(!/Steuererklärung|Rechtsberatung|Steuerberatung|beratung/i.test(grenzen), "Grenzen: KEINE Steuererklärungen und keine Rechts-/Steuerberatung (Gründer 22.10.)");
  ok(/bereiten FIAON oder der Partner alles vollständig vor; der Auftraggeber unterschreibt nur/.test(alle), "persönliche Unterschrift: FIAON/Partner bereitet vor, Kunde unterschreibt nur");
  ok(/Kontaktperson der Gesellschaft benennen — der Auftraggeber selbst oder eine von ihm bestimmte Person aus dem Kreis der Gesellschafter \(Member\) oder der Geschäftsführung \(Manager\)/.test(alle), "Kontaktperson = Kunde/Member/Manager (E-424)");
  ok(/Third Party Designee/.test(alle) && /Certifying Acceptance Agent/.test(alle) && /D-U-N-S/.test(alle) && /drei Monate lang/.test(alle) && /Untervollmacht/.test(alle) && /in Textform widerrufen/.test(alle), "EIN-Designee, CAA, D-U-N-S, Untervollmacht, Widerruf, drei Monate");
  ok(/stellen und unterschreiben wird sie der Auftraggeber selbst/.test(alle), "Institutsanträge: FIAON bereitet vor, Kunde stellt sie selbst");
}

// ═══ 2 FASSUNGEN ═════════════════════════════════════════════════════════════
abschnitt("2 Fassungen hochgezählt, angenommene behalten ihre");
{
  ok(G.GLOBAL_VERTRAG_VERSION === "2026-10-23", "Paketauftrag 2026-10-23");
  ok(IA.ANGEBOT_FASSUNG === "IA-2026-10-23" && (IA.ANGEBOT_FASSUNGEN as readonly string[]).includes("IA-2026-10-22"), "Individual IA-2026-10-23 (10-22 lesbar)");
  ok(BG.BEGLEIT_FASSUNG === "IA-BEGLEIT-2026-10-23" && (BG.BEGLEIT_FASSUNGEN as readonly string[]).includes("IA-BEGLEIT-2026-10-22"), "Begleit IA-BEGLEIT-2026-10-23");
  ok(KA.KAPITAL_FASSUNG === "IA-KAPITAL-2026-10-23" && (KA.KAPITAL_FASSUNGEN as readonly string[]).includes("IA-KAPITAL-2026-10-22"), "Kapital IA-KAPITAL-2026-10-23");
  ok(FI.FIRMA_FASSUNG === "IA-FIRMA-2026-10-23" && (FI.FIRMA_FASSUNGEN as readonly string[]).includes("IA-FIRMA-2026-10-22"), "Firma IA-FIRMA-2026-10-23");
  for (const f of [G.GLOBAL_VERTRAG_VERSION, IA.ANGEBOT_FASSUNG, BG.BEGLEIT_FASSUNG, KA.KAPITAL_FASSUNG, FI.FIRMA_FASSUNG]) ok(B.vertragHatBefugnisse(f), `${f}: trägt die Ziffer`);
  for (const f of ["2026-10-22", "IA-2026-10-22", "IA-2026-10-01-KG", "IA-BEGLEIT-2026-10-08-A", "IA-KAPITAL-2026-10-19-B", "IA-FIRMA-2026-10-08-D", "IA-KOOP-2026-10-30", "", null]) ok(!B.vertragHatBefugnisse(f), `${f || "(leer)"}: trägt die Ziffer nicht`);
}

// ═══ 3 ERGÄNZUNG ═════════════════════════════════════════════════════════════
abschnitt("3 Ergänzung für Bestandskunden");
const K: any = {
  ref: "FIAON-MUSTER1", sprache: "de", kundeName: "Max Mustermann", kundeAnschrift: "Musterstraße 1, 10115 Berlin, Germany", kundeEmail: "m.muster@beispiel.example", kundeTelefon: "+49 30 1234567",
  firmaName: "", weiblich: false, vertragFassung: "2026-10-22", vertragAm: "2026-10-20",
  llc: { name: "Muster Holdings LLC", bundesstaat: "WY", gegruendetAm: "2026-10-01", aktenzeichen: "2026-001234567", ein: "", usAdresse: "123 Example Avenue, Suite 100\nCheyenne, WY 82001", agentAdresse: "456 Sample Street\nCheyenne, WY 82001", usTelefon: "+13075550148", kontaktperson: "Max Mustermann" },
  itin: null,
  angaben: { county: "Laramie County", ss4: { geschaeftsart: "Online retail", taetigkeit: "retail", leistungen: "Online retail of sporting goods" } },
};
{
  ok(B.ergaenzungNoetig({ vertragVersion: "2026-10-22", angenommen: true }) === true, "alte Fassung → Ergänzung");
  ok(B.ergaenzungNoetig({ vertragVersion: "2026-10-23", angenommen: true }) === false, "neue Fassung → keine Ergänzung");
  ok(B.ergaenzungNoetig({ vertragVersion: "IA-2026-10-22", angenommen: true, weitereFassungen: ["IA-BEGLEIT-2026-10-23"] }) === false, "ein neuer angenommener Vertrag genügt");
  ok(B.ergaenzungNoetig({ vertragVersion: "2026-10-22", angenommen: false }) === false, "ohne Annahme keine Ergänzung");
  ok(B.ergaenzungNoetig({ vertragVersion: "IA-KOOP-2026-10-30", angenommen: true }) === true, "Kooperationsvertrag zählt nicht als Kundenauftrag");
  const e = B.ergaenzungInhalt({ sprache: "de", ref: K.ref, kunde: K.kundeName, unterzeichner: K.kundeName, anschrift: K.kundeAnschrift, vertragFassung: "2026-10-22", vertragAm: "2026-10-20", weiblich: false });
  ok(e.abschnitte[0].titel === "§ 1 Befugnisse von FIAON" && JSON.stringify(e.abschnitte[0].absaetze) === JSON.stringify(B.befugnisseAbsaetze("auftraggeber")), "Ergänzung § 1 = die Ziffer, wörtlich aus der Quelle");
  ok(/Rechtswahl und Gerichtsstand des Vertrags/.test(JSON.stringify(e)), "Ergänzung: Recht des Vertrags (auch Firma: England und Wales)");
  const p = AK.globalPflichtUnterlage("fiaon_befugnisse")!;
  ok(p.modus === "digital" && p.nurErgaenzung === true && p.titel.de === B.ERGAENZUNG_TITEL.de, "Pflichtliste: Ergänzung digital, nur bei älterer Fassung, Titel aus der Quelle");
  ok(AK.globalPflichtFuer(null, { gegruendet: false, bereit: [], ergaenzung: true }).map((x) => x.key).join() === "fiaon_befugnisse", "vor der Gründung: nur die Ergänzung (wenn nötig)");
  ok(AK.globalPflichtFuer(null, { gegruendet: true, bereit: [], ergaenzung: false, aus: ["irs_8821"] }).map((x) => x.key).join() === "irs_ss4,us_organizer,us_operating_agreement", "nach der Gründung: SS-4, SoO, OA (8821 abgeschaltet, keine Ergänzung)");
  const dok = US.ergaenzungDokument(K, "FG-AAAA-0001");
  const pdf = await SATZ.satzPdf(dok, { erzeugtAm: new Date("2026-10-23T10:00:00Z") });
  const t = await pdfText(pdf);
  ok(t.seiten >= 2 && t.alle.includes("Seite 1 von") && t.alle.includes("FG-AAAA-0001") && t.alle.includes("Befugnisse von FIAON"), "Ergänzung als PDF (FIAON-CI): Seitenzahl, Doc-ID, Ziffer", t.alle.slice(0, 200));
  if (pdfOrt) schreiben("Ergaenzung_Befugnisse.pdf", pdf);
}

// ═══ 4 DIGITAL UNTERSCHREIBEN ════════════════════════════════════════════════
abschnitt("4 Digital unterschreiben: Wand, Name, Nachweis, Zertifikat");
{
  const erlaubt = ROT ? (() => true) : UW.digitalErlaubt;
  ok(!erlaubt("irs_ss4") && !erlaubt("irs_8821"), "IRS SS-4 und 8821: nie digital");
  ok(UW.digitalErlaubt("us_operating_agreement") && UW.digitalErlaubt("fiaon_befugnisse") && UW.digitalErlaubt(null), "eigene Dokumente: digital");
  for (const key of ["irs_ss4", "irs_8821"]) ok(AK.globalPflichtUnterlage(key)!.modus === "handschriftlich", `${key}: Modus „handschriftlich“ in der Pflichtliste`);
  const lib = datei("server/lib/fiaon-global-unterschrift.ts");
  for (const fn of ["export async function unterschriftStarten", "export async function unterschriftAbschliessen"]) {
    const b = lib.slice(lib.indexOf(fn));
    ok(b.indexOf("digitalErlaubt(d.pflicht_key)") > 0 && b.indexOf("digitalErlaubt(d.pflicht_key)") < b.indexOf("kontoVorgang"), `${fn.split(" ").pop()}: IRS-Wand VOR Code und Unterschrift`);
    ok(b.indexOf("istRoboterUnterschrift(a.ip, a.userAgent)") > 0 && b.indexOf("istRoboterUnterschrift(a.ip, a.userAgent)") < b.indexOf("kontoVorgang"), `${fn.split(" ").pop()}: Roboter-Wand (localhost, Headless) VOR Code und Unterschrift`);
  }
  ok(UW.namePasst("max mustermann", "Max Mustermann") && UW.namePasst("Max  Müller", "Max Mueller") && !UW.namePasst("Max", "Max Mustermann") && !UW.namePasst("Erika Mustermann", "Max Mustermann"), "Name muss passen (Groß/klein, Umlaute egal)");
  ok(UW.zustimmungText("de").includes(UW.UNTERSCHRIFT_WOERTER.de.zustimmung) && UW.zustimmungText("en").includes("paper copy"), "Zustimmungstext mit Verbraucher-Hinweis (Papierfassung, Widerruf, Technik)");
  const akte: any = {
    art: "digital", docId: "FG-BBBB-0002", formular: "us_operating_agreement", fassung: US.US_DOKUMENTE_FASSUNG, titel: "Operating Agreement", sha256Inhalt: "a".repeat(64),
    signaturen: [{ nr: 1, art: "kunde", rolle: "Sole Member", name: "Max Mustermann", erwartet: "Max Mustermann", methode: "email_code", zugang: "link", kontoEmail: null, codeEmail: "m.muster@beispiel.example",
      codeGesendetAm: "2026-10-23T10:00:00.000Z", codeBestaetigtAm: "2026-10-23T10:01:00.000Z", unterschriebenAm: "2026-10-23T10:01:01.000Z", ip: "203.0.113.7", userAgent: "Mozilla/5.0 (Muster)",
      dokumentSha256: "b".repeat(64), dokumentId: 7, zustimmung: { fassung: UW.ESIGN_FASSUNG, textSha256: "c".repeat(64), sprache: "de" } }],
  };
  const z = UW.zertifikatZeilen(akte, "FIAON-MUSTER1");
  const flachZ = JSON.stringify(z);
  for (const muss of ["Max Mustermann", "m.muster@beispiel.example", "2026-10-23 10:00:00 UTC", "2026-10-23 10:01:00 UTC", "203.0.113.7", "Mozilla/5.0 (Muster)", "b".repeat(64), UW.ESIGN_FASSUNG, "FG-BBBB-0002", "a".repeat(64), "E-SIGN"])
    ok(flachZ.includes(muss), `Zertifikat enthält „${muss.slice(0, 24)}“`);
  const zert = await SATZ.satzPdf({ stil: "us", sprache: "en", titel: "Signature Certificate", fuss: "Doc-ID: FG-BBBB-0002 · Signature Certificate",
    bloecke: [{ art: "titel", text: "SIGNATURE CERTIFICATE" }, { art: "tabelle", zeilen: z.kopf }, ...z.je.flatMap((zz) => [{ art: "tabelle" as const, zeilen: zz }])] }, { erzeugtAm: new Date("2026-10-23T10:02:00Z"), stempelfeld: false });
  const zt = await pdfText(zert);
  ok(zt.alle.includes("SIGNATURE CERTIFICATE") && zt.alle.includes("Page 1 of 1") && zt.alle.includes("203.0.113.7"), "Zertifikatsseite setzt (US-Format, Page X of Y)");
  if (pdfOrt) schreiben("Signature_Certificate.pdf", zert);
  // Unterschrift im Dokument: „/s/ Name“ + „Electronically signed via FIAON on …“
  const oa = US.oaDokument(K, "FG-BBBB-0002");
  const signiert = await SATZ.satzPdf(oa, { signaturen: new Map([[1, { name: "Max Mustermann", am: "2026-10-23T10:01:01.000Z", docId: "FG-BBBB-0002" }]]), erzeugtAm: new Date("2026-10-23T10:01:01Z") });
  const st = await pdfText(signiert);
  ok(st.alle.includes("/s/ Max Mustermann") && st.alle.includes("Electronically signed via FIAON on 2026-10-23 10:01 UTC"), "unterschriebene Fassung: /s/ Name und Vermerk");
  // Reproduzierbar: dieselben Daten → dieselben Bytes (der Kunde unterschreibt genau, was er sah)
  const a1 = await SATZ.satzPdf(oa, { erzeugtAm: new Date("2026-10-23T09:00:00Z") });
  const a2 = await SATZ.satzPdf(oa, { erzeugtAm: new Date("2026-10-23T09:00:00Z") });
  ok(Buffer.from(a1).equals(Buffer.from(a2)), "Satz reproduzierbar (gleiche Daten = gleiche Datei)");
  // Wörter des Dialogs
  for (const s of ["de", "en"] as const) {
    const texte = Object.values(UW.UNTERSCHRIFT_WOERTER[s]).flatMap((v: any) => typeof v === "string" ? [v] : Array.isArray(v) ? v : typeof v === "function" ? [String(v("Max Mustermann", 3)), String(v(1))] : []).join("\n");
    const funde = s === "de" ? W.globalWortPruefen(texte).map((f) => f.treffer) : W.globalWortPruefenEn(texte).map((f) => f.treffer);
    ok(funde.length === 0, `Dialog-Texte ${s}: Wortregeln`, funde);
  }
}

// ═══ 5 IRS SS-4 / 8821 ═══════════════════════════════════════════════════════
abschnitt("5 IRS SS-4 und 8821: Felder aus der Akte, vollständig oder gesperrt");
{
  for (const art of ["irs_ss4", "irs_8821"] as const) {
    const namen = await IRSF.irsFeldnamen(art);
    const bel = IRS.irsBelegung(art, art === "irs_8821" ? { ...K, llc: { ...K.llc, ein: "12-3456789" } } : K);
    ok(bel.fehlend.length === 0, `${art}: Musterakte vollständig`, bel.fehlend);
    const unbekannt = bel.felder.filter((f) => !namen.has(f.feld)).map((f) => f.feld);
    ok(unbekannt.length === 0, `${art}: jedes Feld gibt es in der amtlichen Datei (${IRS.IRS_FORMULARE[art].revision})`, unbekannt);
    ok(bel.felder.every((f) => f.quelle), `${art}: jedes Feld nennt seine Herkunft`);
  }
  const ss4 = IRS.ss4Belegung(K);
  const w = (zeile: string, feld: string) => ss4.felder.find((f) => f.zeile === zeile && f.feld.endsWith(feld))?.wert;
  ok(w("1", "f1_2[0]") === "MUSTER HOLDINGS LLC", "SS-4 Zeile 1: Name in Großbuchstaben");
  ok(w("4a", "f1_5[0]") === "123 Example Avenue, Suite 100" && w("4b", "f1_6[0]") === "Cheyenne, WY 82001", "SS-4 Zeile 4a/4b: US-Geschäftsanschrift");
  ok(w("6", "f1_9[0]") === "Laramie County, Wyoming", "SS-4 Zeile 6: County und Staat");
  ok(w("7a", "f1_10[0]") === "Max Mustermann" && w("7b", "f1_11[0]") === "Foreign", "SS-4 Zeile 7a/7b: Mitglied, ohne ITIN „Foreign“");
  ok(IRS.ss4Belegung({ ...K, itin: "912-34-5678" }).felder.find((f) => f.zeile === "7b")?.wert === "912-34-5678", "SS-4 Zeile 7b: ITIN, wenn vorhanden");
  ok(w("8a", "c1_1[0]") === true && w("8b", "f1_12[0]") === "1" && w("8c", "c1_2[0]") === true, "SS-4 Zeile 8a/8b/8c: LLC, ein Mitglied, in den USA");
  ok(w("9a", "c1_3[15]") === true && w("9a", "f1_19[0]") === "Foreign-owned disregarded entity", "SS-4 Zeile 9a: Other — Foreign-owned disregarded entity");
  const zwei = { ...K, angaben: { ...K.angaben, mitglieder: [{ name: "Max Mustermann", anschrift: "Musterstraße 1, 10115 Berlin, Germany", anteil: 60 }, { name: "Erika Mustermann", anschrift: "Musterweg 2, 8001 Zürich, Switzerland", anteil: 40, email: "e.muster@beispiel.example" }] } };
  ok(IRS.ss4Belegung(zwei).felder.some((f) => f.feld.endsWith("c1_3[2]") && f.wert === true) && IRS.ss4Belegung(zwei).felder.find((f) => f.zeile === "8b")?.wert === "2", "SS-4: zwei Mitglieder → Partnership, 8b = 2");
  ok(w("10", "c1_4[0]") === true && w("11", "f1_31[0]") === "10/01/2026" && w("12", "f1_32[0]") === "December", "SS-4 Zeile 10–12: neu gegründet, Beginn, Dezember");
  ok(w("16", "c1_6[7]") === true && w("17", "f1_38[0]") === "Online retail of sporting goods", "SS-4 Zeile 16/17: Retail, Leistungen");
  ok(String(w("Designee", "f1_40[0]")).startsWith("FIAON LTD") && w("Designee", "f1_41[0]") === "+41 44 244 93 01", "SS-4 Third Party Designee: FIAON");
  ok(w("Name/Titel", "f1_44[0]") === "Max Mustermann, Sole Member" && w("Telefon", "f1_45[0]") === "+49 30 1234567", "SS-4: Name und Funktion, Telefon");
  ok(!ss4.felder.some((f) => /Signature|Datum|Date/i.test(f.zeile)), "SS-4: Unterschrift und Datum bleiben leer (von Hand)");
  ok(ss4.hinweise.some((h) => /Foreign/.test(h)) && ss4.hinweise.some((h) => /Designee-Fax leer/.test(h)), "SS-4: Hinweise für die rechtliche Prüfung (Foreign, Fax)");
  // Fehlt etwas: Liste statt halb ausgefülltem Formular
  const leer = IRS.ss4Belegung({ ...K, angaben: {}, llc: { ...K.llc, gegruendetAm: null } });
  const texte = leer.fehlend.map((f) => f.text).join(" | ");
  ok(/Zeile 6/.test(texte) && /Zeile 10/.test(texte) && /Zeile 11/.test(texte) && /Zeile 16/.test(texte) && /Zeile 17/.test(texte), "SS-4 unvollständig: County, Art, Beginn, Tätigkeit, Leistungen gemeldet", texte);
  const ohneEin = IRS.f8821Belegung(K);
  ok(ohneEin.fehlend.some((f) => /EIN/.test(f.text)), "8821 ohne EIN: gesperrt (kommt nach der EIN)");
  const f88 = IRS.f8821Belegung({ ...K, llc: { ...K.llc, ein: "12-3456789" } });
  const w8 = (feld: string) => f88.felder.find((f) => f.feld.endsWith(feld))?.wert;
  ok(String(w8("f1_6[0]")).startsWith("MUSTER HOLDINGS LLC\n123 Example Avenue") && w8("f1_7[0]") === "12-3456789", "8821 Zeile 1: Gesellschaft, Anschrift, EIN");
  ok(String(w8("f1_10[0]")).startsWith("FIAON LTD") && w8("f1_11[0]") === "None", "8821 Zeile 2: FIAON, CAF „None“");
  ok(w8("BodyRow1[0].f1_20[0]") === "Income" && w8("BodyRow1[0].f1_21[0]") === "1120, 5472" && w8("BodyRow1[0].f1_22[0]") === "2026 through 2028", "8821 Zeile 3: Income, 1120/5472, Jahre");
  ok(w8("f1_32[0]") === "Max Mustermann" && w8("f1_33[0]") === "Sole Member", "8821 Zeile 6: Name und Funktion (Unterschrift/Datum von Hand)");
  const { pdf } = await IRSF.irsFuellen("irs_ss4", K, { am: new Date("2026-10-23T10:00:00Z") });
  const ft = await pdfText(pdf, true);
  ok(ft.alle.includes("MUSTER HOLDINGS LLC") && ft.alle.includes("Laramie County, Wyoming") && ft.alle.includes("Foreign-owned disregarded entity"), "SS-4 gefüllt und flach (Werte stehen auf der Seite)");
  if (pdfOrt) { schreiben("IRS_SS-4_Muster.pdf", pdf); schreiben("IRS_8821_Muster.pdf", (await IRSF.irsFuellen("irs_8821", { ...K, llc: { ...K.llc, ein: "12-3456789" } })).pdf); }
}

// ═══ 6 STATEMENT OF ORGANIZER UND OPERATING AGREEMENT ════════════════════════
abschnitt("6 Statement of Organizer und Operating Agreement (US-Format)");
{
  const soo = US.organizerDokument(K, "FG-CCCC-0003");
  const pdf = await SATZ.satzPdf(soo, { erzeugtAm: new Date("2026-10-23T10:00:00Z") });
  const t = await pdfText(pdf);
  ok(t.groessen.every((g) => Math.round(g[0]) === 612 && Math.round(g[1]) === 792), "SoO: US Letter 8,5 × 11 Zoll", t.groessen);
  ok(t.alle.includes(`Page 1 of ${t.seiten}`) && t.alle.includes("Doc-ID: FG-CCCC-0003") && t.alle.includes("Principal: Max Mustermann"), "SoO: Fuß „Page X of Y“, Doc-ID, Unterzeichner");
  ok(t.ersteZeileY < 792 - 175, "SoO: Seite 1 oben 2,5 Zoll frei (Eingangsstempel)", String(t.ersteZeileY));
  ok(/STATEMENT ?OF ORGANIZER/.test(t.alle) && /IN LIEU OF ORGANIZATIONAL MEETING/.test(t.alle) && t.alle.includes("Wyo. Stat. § 17-28-107") && t.alle.includes("THE UNDERSIGNED ORGANIZER HOLDS NO MEMBERSHIP INTEREST"), "SoO: Titel, Wyoming-Kontakt, Klausel in Großbuchstaben");
  ok(t.alle.includes("By: Justin Schwarzott") && t.alle.includes("Title: Director") && t.alle.includes("ACKNOWLEDGED AND ACCEPTED"), "SoO: Organizer FIAON LTD durch den Director, Bestätigung des Mitglieds");
  ok(t.schriften.every((f) => /Times/.test(f)), "SoO: Times (schwarz-weiß, ohne Logo)", t.schriften);
  ok(!/\{\{|\[\[/.test(t.alle), "SoO: kein offener Platzhalter");
  const fl = US.organizerDokument({ ...K, llc: { ...K.llc, bundesstaat: "FL" } }, "FG-1");
  ok(!JSON.stringify(fl).includes("17-28-107") && JSON.stringify(fl).includes("Florida Secretary of State"), "SoO Florida: ohne Wyoming-Kontaktperson");
  const fremd = US.organizerVon({ ...K, angaben: { organizer: { name: "Example Filing Service Inc.", vertreter: "Jane Example", titel: "Authorized Signatory", istFiaon: false } } });
  ok(fremd.name === "Example Filing Service Inc." && !fremd.istFiaon, "Organizer im Mandat überschreibbar");
  const unterz = US.unterzeichnerVon("us_organizer", K);
  ok(unterz[0].art === "fiaon" && unterz[1].art === "kunde" && unterz[1].name === "Max Mustermann", "SoO: erst FIAON, dann das Mitglied");
  if (pdfOrt) schreiben("Statement_of_Organizer_Muster.pdf", pdf);

  const oa = US.oaDokument(K, "FG-DDDD-0004");
  const oaPdf = await SATZ.satzPdf(oa, { erzeugtAm: new Date("2026-10-23T10:00:00Z") });
  const o = await pdfText(oaPdf);
  ok(o.seiten >= 4 && o.alle.includes(`Page ${o.seiten} of ${o.seiten}`) && o.groessen.every((g) => Math.round(g[0]) === 612), "OA (ein Mitglied): US Letter, Page X of Y", `${o.seiten} Seiten`);
  ok(o.alle.includes("OPERATING AGREEMENT") && o.alle.includes("Muster Holdings LLC") && o.alle.includes("Max Mustermann") && o.alle.includes("2026-001234567"), "OA: aus der Akte vorbelegt");
  ok(o.alle.includes("The Company will apply for a federal Employer Identification Number"), "OA ohne EIN: Ziffer 1.4 sagt, dass sie beantragt wird");
  ok(!/\{\{|\[\[/.test(o.alle) && !/________/.test(o.alle.replace(/Date: _+/g, "")), "OA: vollständig — kein Platzhalter, keine Lücke außer dem Datum der Unterschrift");
  ok(!/northwest/i.test(o.alle) && o.alle.includes("the registered agent named in the articles of organization"), "OA: nie der Name des Registered-Agent-Anbieters");
  const vorlage = (await import("../shared/fiaon-global-fach-recht")).FACH_VORLAGEN.find((v) => v.id === "operating-agreement-smllc")!;
  ok(vorlage.text.filter((x) => !x.includes("{{") && !x.startsWith("## ") && !x.startsWith("1.4 ")).every((x) => o.alle.replace(/\s+/g, " ").includes(x.replace(/\s+/g, " ").slice(0, 60))), "OA = Vorlage aus „Recht & Verträge“ (eine Quelle)");
  const oa2 = US.oaDokument({ ...K, llc: { ...K.llc, ein: "12-3456789" }, angaben: { ...K.angaben, mitglieder: [{ name: "Max Mustermann", anschrift: "Musterstraße 1, 10115 Berlin, Germany", anteil: 60 }, { name: "Erika Mustermann", anschrift: "Musterweg 2, 8001 Zürich, Switzerland", anteil: 40, email: "e.muster@beispiel.example" }] } }, "FG-EEEE-0005");
  const oa2Pdf = await SATZ.satzPdf(oa2, { erzeugtAm: new Date("2026-10-23T10:00:00Z") });
  const o2 = await pdfText(oa2Pdf);
  ok(o2.alle.includes("MULTI-MEMBER") && o2.alle.includes("Percentage Interest 60%") && o2.alle.includes("Percentage Interest 40%") && o2.alle.includes("partnership representative"), "OA (zwei Mitglieder): Anteile, Partnership Representative");
  ok(US.unterzeichnerVon("us_operating_agreement", { ...K, angaben: oa2 ? { mitglieder: [{ name: "A B", anschrift: "x", anteil: 50 }, { name: "C D", anschrift: "y", anteil: 50 }] } : {} }).length === 2, "OA: jedes Mitglied unterschreibt");
  ok(US.formularFehlend("us_operating_agreement", { ...K, angaben: { mitglieder: [{ name: "A B", anschrift: "x", anteil: 50 }, { name: "C D", anschrift: "y", anteil: 50 }] } }).some((f) => /E-Mail von Mitglied 2/.test(f.text)), "OA: zweites Mitglied ohne E-Mail → gesperrt");
  ok(US.formularFehlend("us_organizer", { ...K, angaben: { mitglieder: [{ name: "A B", anschrift: "x", anteil: 60 }, { name: "C D", anschrift: "y", anteil: 30, email: "c@d.example" }] } }).some((f) => /ergeben 90%/.test(f.text)), "Anteile ≠ 100 % → gesperrt");
  const mgr = US.oaDokument({ ...K, angaben: { ...K.angaben, verwaltung: "manager", manager: "Max Mustermann" } }, "FG-1");
  ok(JSON.stringify(mgr).includes("5.1 Manager-Managed") && JSON.stringify(mgr).includes("signs under the title “Manager”"), "OA manager-managed: Ziffer 5.1/5.2 ersetzt");
  ok(US.formularFehlend("us_operating_agreement", K).length === 0 && US.formularFehlend("us_organizer", K).length === 0, "Musterakte: SoO und OA vollständig");
  ok(US.formularFehlend("us_organizer", { ...K, llc: { ...K.llc, aktenzeichen: "", gegruendetAm: null }, kundeAnschrift: "" }).length >= 3, "SoO ohne Filing Number, Gründungstag, Wohnanschrift → gesperrt");
  if (pdfOrt) { schreiben("Operating_Agreement_Muster.pdf", oaPdf); schreiben("Operating_Agreement_zwei_Mitglieder.pdf", oa2Pdf); }
  // Wortregeln in den Kundentexten (deutsch) und der englischen Quelle
  const deText = [...B.befugnisseSaetze("auftraggeber"), ...B.befugnisseSaetze("auftraggeberin"), B.ERGAENZUNG_TITEL.de, B.ERGAENZUNG_TEXT.de, ...AK.GLOBAL_PFLICHT_UNTERLAGEN.flatMap((p) => [p.titel.de, p.text.de])].join("\n");
  ok(W.globalWortPruefen(deText).length === 0, "Wortregeln (deutsch): Befugnisse, Ergänzung, Pflichtliste", W.globalWortPruefen(deText));
  const enText = [...B.befugnisseSaetze("en"), B.ERGAENZUNG_TITEL.en, B.ERGAENZUNG_TEXT.en, ...AK.GLOBAL_PFLICHT_UNTERLAGEN.flatMap((p) => [p.titel.en, p.text.en])].join("\n");
  ok(W.globalWortPruefenEn(enText).length === 0, "Wortregeln (englisch)", W.globalWortPruefenEn(enText));
  ok(!/\b(authoriz|organiz)ation\b/i.test(enText.replace(/Articles of Organization|tax information authorization/gi, "")), "britisches Englisch (ohne Eigennamen)");
}

// ═══ 7 SIEGEL ════════════════════════════════════════════════════════════════
abschnitt("7 Siegel (PAdES) — mit Wegwerf-Schlüssel, wenn openssl da ist");
{
  ok("fehlt" in SIEGEL.siegelSchluessel({} as any), "ohne Schlüssel: „fehlt“ (Unterschrift läuft trotzdem, Siegel ausstehend)");
  ok(/PEM/.test((SIEGEL.siegelSchluessel({ FIAON_SIGN_P12_BASE64: "x" } as any) as any).fehlt ?? ""), "nur P12: klarer Grund (als PEM hinterlegen)");
  let openssl = false;
  const dir = path.join(os.tmpdir(), `fiaon-siegel-${process.pid}`);
  try { mkdirSync(dir, { recursive: true }); execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", path.join(dir, "k.pem"), "-out", path.join(dir, "c.pem"), "-days", "2", "-subj", "/CN=FIAON Pruefstand/O=Muster"], { stdio: "ignore" }); openssl = true; } catch { console.log("  (openssl fehlt — Siegelprobe übersprungen)"); }
  if (openssl) {
    const s = SIEGEL.siegelSchluessel({ FIAON_SIGN_CERT_PEM: readFileSync(path.join(dir, "c.pem"), "utf8"), FIAON_SIGN_KEY_PEM: Buffer.from(readFileSync(path.join(dir, "k.pem"))).toString("base64") } as any);
    ok(!("fehlt" in s), "Schlüssel aus PEM (auch Base64) gelesen");
    if (!("fehlt" in s)) {
      const roh = await SATZ.satzPdf(US.organizerDokument(K, "FG-1"), { erzeugtAm: new Date("2026-10-23T10:00:00Z") });
      const v = await SIEGEL.pdfVersiegeln(roh, s, { grund: "Prüfstand", am: new Date("2026-10-23T10:00:00Z") });
      const p = SIEGEL.pdfSiegelPruefen(v);
      ok(p.versiegelt && p.gueltig, "versiegelt und gültig", p.grund);
      const k2 = Buffer.from(v); k2[400] = k2[400] === 0x41 ? 0x42 : 0x41;
      ok(!SIEGEL.pdfSiegelPruefen(k2).gueltig, "ein geändertes Byte → ungültig");
      ok((await SATZ.seitenZahl(v)) === (await SATZ.seitenZahl(roh)), "die Seiten bleiben dieselben");
    }
  }
}

// ═══ 8 VERDRAHTUNG ═══════════════════════════════════════════════════════════
abschnitt("8 Verdrahtung: Routen, Migration, Mail, Portal, Chefbüro, Office");
{
  const bereich = datei("server/routes/fiaon-global-bereich.ts");
  for (const r of ["/start", "/code-neu", "/ansicht"]) ok(bereich.includes(`"/global/mein-auftrag/:ref/unterschrift/:id${r}"`), `Kunde: Route …/unterschrift/:id${r}`);
  const start = bereich.slice(bereich.indexOf('"/global/mein-auftrag/:ref/unterschrift/:id/start"'));
  ok(start.indexOf("zutritt(req, res)") < start.indexOf("istVorschau(req)") && start.indexOf("istVorschau(req)") < start.indexOf("unterschriftJeRef(ref)"), "Start: Zutritt → Vorschau-Wand → Drossel");
  ok(!/globalKundeUnterschreibt/.test(bereich + datei("server/lib/fiaon-global-mandat.ts")), "Zeichenfeld-Weg entfernt (ein Weg)");
  const team = datei("server/routes/fiaon-global-unterschrift.ts");
  for (const p of ['"formulare"', '"formular-angaben"', '"formulare/:art/vorschau"', '"formulare/:art/erzeugen"', '"formulare/:art/fiaon-unterschreibt"', '"formulare/:art/freigeben"', '"dokument/:id/pruefen"']) ok(team.includes(p), `Team-Route ${p}`);
  ok(/requireChef\("leitung"\)/.test(team) && /globalOfficeZugriff/.test(team) && /schreibt && ansicht/.test(team), "Team: Chefbüro (Leitung) und Office (Zuständigkeit, Ansicht schreibt nie)");
  ok(/fiaon-global-unterschrift'\);\n  app\.use\('\/api\/fiaon', globalUnterschrift\.default\)/.test(datei("server/routes.ts")), "Routen gemountet");
  const mig = datei("db/migrations/125_global_unterschrift.sql");
  ok(/formular_angaben JSONB/.test(mig) && /formular_daten JSONB/.test(mig) && /fiaon_global_unterschrift_codes/.test(mig) && !/DROP|DELETE/i.test(mig), "Migration 125: nur hinzufügen");
  ok(/global_unterschrift_code/.test(datei("shared/fiaon-global-konto.ts")) && /global_unterschrift_code: \{/.test(datei("server/mail/vorlagen/global-konto.ts")), "Mail „Code zum Unterschreiben“: transaktional, Vorlage de/en");
  const portal = datei("client/src/pages/global-portal.tsx");
  ok(/UnterschriftDigital/.test(portal) && !/<canvas/.test(portal) && !/Zeichenfeld\(/.test(portal), "Portal: digitaler Dialog statt Zeichenfeld");
  const dlg = datei("client/src/pages/global-portal-unterschrift.tsx");
  ok(/data-fiaon="signatur-zustimmung"/.test(dlg) && /data-fiaon="signatur-name"/.test(dlg) && /data-fiaon="signatur-code"/.test(dlg) && /UNTERSCHRIFT_WOERTER/.test(dlg), "Dialog: Zustimmung, Name, Code — Texte aus shared/");
  ok(/key: "unterschriften", titel: "Dokumente & Unterschriften"/.test(datei("client/src/components/admin/ChefGlobal.tsx")), "Chefbüro: Reiter „Dokumente & Unterschriften“");
  ok(/GlobalFormulare/.test(datei("client/src/pages/agent/global-akte.tsx")), "Office: Dokumente & Unterschriften in der Global-Akte");
  const gf = datei("client/src/components/global/GlobalFormulare.tsx");
  ok(/data-fiaon="formular-erzeugen"/.test(gf) && /data-fiaon="formular-freigeben"/.test(gf) && /data-fiaon="formular-fehlend"/.test(gf) && /const kannErzeugen = z\.noetig && z\.fehlend\.length === 0/.test(gf) && /const kannFreigeben = !!z\.dokumentId && z\.fehlend\.length === 0/.test(gf) && /disabled=\{!kannErzeugen/.test(gf) && /disabled=\{!kannFreigeben/.test(gf), "Editor: Erzeugen und Bereitstellen gesperrt, solange etwas fehlt (Liste vom Server)");
}

console.log(`\n${gut} ok, ${rot.length} rot.${ROT ? "  (Rot-Probe — muss rot sein)" : ""}`);
if (netz.length) { console.log(`  ROT   Netzzugriff: ${netz.join(", ")}`); process.exitCode = 1; }
if (rot.length) process.exitCode = 1;

// ── Hilfen ───────────────────────────────────────────────────────────────────
async function pdfText(bytes: Uint8Array | Buffer, ohneSchrift = false): Promise<{ seiten: number; alle: string; groessen: [number, number][]; ersteZeileY: number; schriften: string[] }> {
  const doc = await (pdfjs as any).getDocument({ data: new Uint8Array(bytes), disableFontFace: true, verbosity: 0 }).promise;
  let alle = ""; const groessen: [number, number][] = []; let ersteZeileY = 0; const schriften = new Set<string>();
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const vp = p.getViewport({ scale: 1 }); groessen.push([vp.width, vp.height]);
    const tc = await p.getTextContent();
    if (i === 1) ersteZeileY = Math.max(...tc.items.filter((x: any) => x.str?.trim()).map((x: any) => x.transform[5]));
    if (!ohneSchrift) for (const st of Object.values(tc.styles ?? {}) as any[]) schriften.add(String(st.fontFamily ?? ""));
    if (!ohneSchrift) { const ops = await p.getOperatorList(); void ops; }
    alle += tc.items.map((x: any) => x.str).join(" ") + "\n";
    if (!ohneSchrift) for (const k of Object.keys((p as any).commonObjs?._objs ?? {})) if (/Times|Helvetica/.test(k)) schriften.add(k);
  }
  // Schriftnamen aus den Ressourcen (pdf-lib bettet die Standardschriften mit Namen ein)
  const roh = Buffer.from(bytes).toString("latin1");
  const basis = Array.from(roh.matchAll(/\/BaseFont \/([A-Za-z-]+)/g)).map((m) => m[1]);
  return { seiten: doc.numPages, alle: alle.replace(/\s+/g, " "), groessen, ersteZeileY, schriften: Array.from(new Set(basis)) };
}
function schreiben(name: string, b: Uint8Array | Buffer) { mkdirSync(pdfOrt, { recursive: true }); writeFileSync(path.join(pdfOrt, name), b); console.log(`  → ${path.join(pdfOrt, name)}`); }
