// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER GRÜNDUNGSBOGEN (E-526, 17.11.2026)
//
//   npx tsx scripts/pruef-gruendungsbogen.ts              rein (ohne Datenbank, ohne Netz)
//   npx tsx scripts/pruef-gruendungsbogen.ts --pdf DIR    legt zusätzlich ein Muster-PDF in DIR ab (Chromium nötig)
//
// Geprüft wird, was Seite, Server und Skript gemeinsam benutzen: Links (Signatur, Bindung, Ablauf), Anlegen (Summe 100,
// zwei bis sechs Gesellschafter, eigene Adressen), gemeinsame und persönliche Angaben (Pflichtfelder je Stufe),
// Namensabgleich, Überholen bei Fassungswechsel, Status, Drossel, Maskierung, Wortlaut der Bestätigungen (buchstabengetreu),
// Hash, PDF-Text, Mail-Vorlage, Wortwand und die Wege (Client-Route, Server-Weg, keine Messung, Chef-Wand, Log-Maske).
// Alle Daten sind MUSTER (Repo öffentlich): *.example, Max Muster, Erika Beispiel.
// ═══════════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

for (const k of ["BREVO_API_KEY", "MAKE_WEBHOOK_URL", "OPENAI_API_KEY"]) if (process.env[k]) { console.error(`ABBRUCH: ${k} ist gesetzt.`); process.exit(3); }
process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
process.env.SESSION_SECRET = "pruefstand-geheimnis-nur-fuer-den-test";
const netz: string[] = [];
globalThis.fetch = (async (input: any) => { netz.push(String(input?.url ?? input)); throw new Error("Prüfstand: kein Netz"); }) as typeof fetch;
const pdfOrt = process.argv.indexOf("--pdf") > 0 ? String(process.argv[process.argv.indexOf("--pdf") + 1]) : "";

const WURZEL = path.resolve(import.meta.dirname ?? ".", "..");
const datei = (p: string) => readFileSync(path.join(WURZEL, p), "utf8");
let gut = 0; const rot: string[] = [];
function ok(bed: unknown, text: string, fund: unknown = ""): void { if (bed) { gut++; return; } rot.push(text); console.log(`  ROT   ${text}${fund !== "" ? `  →  ${typeof fund === "string" ? fund : JSON.stringify(fund).slice(0, 400)}` : ""}`); }
const abschnitt = (t: string) => console.log(`\n── ${t} ${"─".repeat(Math.max(0, 70 - t.length))}`);

const S = await import("../shared/fiaon-global-gruendungsbogen");
const TK = await import("../server/lib/fiaon-gruendungsbogen-token");
const PDF = await import("../server/lib/fiaon-global-gruendungsbogen-pdf");
const { mailRendern } = await import("../server/mail/motor");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { seiteUnbekannt } = await import("../server/lib/fiaon-seiten-seo");
const { BEREICH_OHNE_MESSUNG, besuchGezaehlt } = await import("../shared/fiaon-besuch");
const { createHash } = await import("node:crypto");

const HEUTE = "2026-11-17";
const IDS = [11, 12];

// ═══ 1 LINKS ═════════════════════════════════════════════════════════════════
abschnitt("1 Links: Signatur, Bindung an Bogen und Mitglied, Ablauf");
{
  const jetzt = Date.parse("2026-11-17T10:00:00Z");
  const bt = TK.gbBogenToken(7, jetzt);
  ok(!bt.includes(".") && /^[0-9a-z]+-[0-9a-z]+-[0-9a-f]{32}$/.test(bt), "Bogen-Link ohne Punkt, Form id-ablauf-signatur", bt);
  const p = TK.gbBogenTokenPruefen(bt, jetzt);
  ok(p?.id === 7 && p.status === "gueltig", "Bogen-Link ist gültig und trägt die Bogen-id", p);
  ok(TK.gbBogenTokenPruefen(bt, jetzt + 91 * 864e5)?.status === "abgelaufen", "Bogen-Link läuft nach 90 Tagen ab");
  ok(TK.gbBogenTokenPruefen(bt, jetzt + 89 * 864e5)?.status === "gueltig", "Bogen-Link gilt nach 89 Tagen noch");
  const falsch = bt.slice(0, -1) + (bt.endsWith("0") ? "1" : "0");
  ok(TK.gbBogenTokenPruefen(falsch, jetzt) === null, "verfälschte Signatur wird abgelehnt");
  const andereId = `8${bt.slice(1)}`;
  ok(TK.gbBogenTokenPruefen(andereId, jetzt) === null, "andere Bogen-id mit alter Signatur wird abgelehnt");
  ok(TK.gbBogenTokenPruefen(bt, jetzt, "anderes-geheimnis") === null, "anderes Geheimnis: Link ungültig");
  ok(TK.gbBogenTokenPruefen("", jetzt) === null && TK.gbBogenTokenPruefen("../../etc", jetzt) === null, "Unsinn wird abgelehnt");
  const mt = TK.gbMitgliedToken(7, 12, jetzt);
  ok(TK.gbMitgliedTokenPruefen(7, mt, jetzt)?.id === 12, "persönlicher Link gilt für seinen Bogen und trägt die Mitglied-id");
  ok(TK.gbMitgliedTokenPruefen(8, mt, jetzt) === null, "persönlicher Link öffnet keinen anderen Bogen");
  ok(TK.gbMitgliedTokenPruefen(7, mt, jetzt + 15 * 864e5)?.status === "abgelaufen", "persönlicher Link läuft nach 14 Tagen ab");
  ok(TK.gbBogenTokenPruefen(mt, jetzt) === null, "ein persönlicher Link ist kein gemeinsamer Link (eigene Nachricht)");
  ok(TK.gbMitgliedTokenPruefen(7, bt, jetzt) === null, "ein gemeinsamer Link ist kein persönlicher Link");
  const fremdMitglied = `${(13).toString(36)}${mt.slice(mt.indexOf("-"))}`;
  ok(TK.gbMitgliedTokenPruefen(7, fremdMitglied, jetzt) === null, "Mitglied-id im Link austauschen geht nicht (Seite eines anderen Mitglieds)");
  ok(TK.gbPersoenlichPfad(bt, mt) === `/business/gruendung/${bt}/m/${mt}`, "Pfad der persönlichen Seite");
}

// ═══ 2 ANLEGEN ═══════════════════════════════════════════════════════════════
abschnitt("2 Anlegen: Summe 100, zwei bis sechs, eigene Adressen, Vorgaben");
const anlage = {
  gruss: "Sehr geehrter Herr Muster, sehr geehrte Frau Beispiel", wunschname: "Muster Holdings LLC", gegenstand: "Beteiligungen und Beratung",
  mitglieder: [{ anzeigename: "Herr Max Muster", email: "Max@Beispiel.example", anteil: 50 }, { anzeigename: "Frau Erika Beispiel", email: "erika@beispiel.example", anteil: "50" }],
};
{
  const a = S.anlagePruefen(anlage);
  ok(a.ok, "gültige Anlage", a);
  if (a.ok) {
    ok(a.daten.bundesstaat === "delaware" && a.daten.kostenHinweis === S.GB_KOSTEN_VORGABE && a.daten.fuehrung === "member", "Vorgaben: Delaware, Kostenhinweis, member-managed");
    ok(a.daten.wunschname === "Muster Holdings", "„LLC“ am Ende fällt weg (Zusatz ist fest)", a.daten.wunschname);
    ok(a.daten.mitglieder[0].email === "max@beispiel.example", "E-Mail wird klein geschrieben");
  }
  const s90 = S.anlagePruefen({ ...anlage, mitglieder: [{ ...anlage.mitglieder[0], anteil: 40 }, anlage.mitglieder[1]] });
  ok(!s90.ok && s90.error.includes("90 %"), "Summe 90 % wird abgelehnt und genannt", s90);
  const drittel = S.anlagePruefen({ ...anlage, mitglieder: [
    { anzeigename: "Herr A Muster", email: "a@beispiel.example", anteil: 33.33 }, { anzeigename: "Herr B Muster", email: "b@beispiel.example", anteil: 33.33 }, { anzeigename: "Herr C Muster", email: "c@beispiel.example", anteil: "33,34" }] });
  ok(drittel.ok, "33,33 + 33,33 + 33,34 ergibt genau 100 (ohne Rundungsfehler)", drittel);
  ok(!S.anlagePruefen({ ...anlage, mitglieder: [anlage.mitglieder[0]] }).ok, "ein Gesellschafter allein: abgelehnt");
  const sieben = Array.from({ length: 7 }, (_, i) => ({ anzeigename: `Person ${i + 1}`, email: `p${i}@beispiel.example`, anteil: i === 0 ? 40 : 10 }));
  ok(!S.anlagePruefen({ ...anlage, mitglieder: sieben }).ok, "sieben Gesellschafter: abgelehnt");
  const doppelt = S.anlagePruefen({ ...anlage, mitglieder: [anlage.mitglieder[0], { ...anlage.mitglieder[1], email: "max@beispiel.example" }] });
  ok(!doppelt.ok && /eigene E-Mail-Adresse/.test(doppelt.error), "dieselbe Adresse für zwei Gesellschafter: abgelehnt (getrennte Unterschriften)", doppelt);
  ok(!S.anlagePruefen({ ...anlage, bundesstaat: "texas" }).ok, "nicht angebotener Bundesstaat: abgelehnt");
  ok(!S.anlagePruefen({ ...anlage, wunschname: "Müller Holding" }).ok, "Umlaut im Wunschnamen: abgelehnt (US-Behörden)");
  ok(!S.anlagePruefen({ ...anlage, gruss: "" }).ok, "ohne Anredezeile: abgelehnt");
  const k = S.kennungAus(new Uint8Array([0, 1, 2, 3, 4, 5]));
  ok(S.istKennung(k) && k.startsWith("GB-") && k.length === 9, "Kennung GB- plus sechs Zeichen", k);
  ok(!S.istKennung("GB-ABC10O"), "Kennung ohne Verwechsler (0/O, 1/I)");
}

// ═══ 3 GEMEINSAME ANGABEN ════════════════════════════════════════════════════
abschnitt("3 Gemeinsame Angaben: Stufen speichern/unterschrift, Anteile, Führung");
const gVoll = { wunschname1: "Muster Holdings", wunschname2: "Muster Ventures", wunschname3: "Muster Partners", bundesstaat: "delaware", gegenstand: "Beteiligungen und Beratung",
  fuehrung: "member", manager: [], anteile: { "11": 50, "12": 50 }, responsibleParty: 11, website: "muster-holdings.example", anmerkungen: "" };
{
  ok(S.gesellschaftPruefen(gVoll, IDS, "unterschrift").ok, "vollständige gemeinsame Angaben bestehen die Stufe „unterschrift“");
  const nurName = { ...gVoll, wunschname2: "", wunschname3: "", gegenstand: "", responsibleParty: null };
  ok(S.gesellschaftPruefen(nurName, IDS, "speichern").ok, "Zwischenstand ohne Ausweichnamen darf gespeichert werden");
  const fehlt = S.gesellschaftFehler(S.gesellschaftNormalisieren(nurName, IDS), IDS, "unterschrift").map((f) => f.feld);
  ok(["gesellschaft.wunschname2", "gesellschaft.wunschname3", "gesellschaft.gegenstand", "gesellschaft.responsibleParty"].every((f) => fehlt.includes(f)), "vor der Unterschrift Pflicht: Ausweichnamen, Gegenstand, Responsible Party", fehlt);
  const s = S.gesellschaftPruefen({ ...gVoll, anteile: { "11": 60, "12": 30 } }, IDS, "speichern");
  ok(!s.ok && s.feld === "gesellschaft.anteile" && s.error.includes("90 %"), "Anteile 60 + 30: abgelehnt, Summe genannt", s);
  ok(!S.gesellschaftPruefen({ ...gVoll, anteile: { "11": 100 } }, IDS, "speichern").ok, "ein Gesellschafter ohne Anteil: abgelehnt");
  ok(!S.gesellschaftPruefen({ ...gVoll, anteile: { "11": 100, "12": 0 } }, IDS, "speichern").ok, "Anteil 0 %: abgelehnt");
  ok(!S.gesellschaftPruefen({ ...gVoll, fuehrung: "manager", manager: [] }, IDS, "speichern").ok, "manager-managed ohne Manager: abgelehnt");
  const m = S.gesellschaftPruefen({ ...gVoll, fuehrung: "manager", manager: [12, 99, "11"] }, IDS, "speichern");
  ok(m.ok && JSON.stringify(m.daten.manager) === "[11,12]", "Manager: nur Mitglieder des Bogens, sortiert, ohne Fremde", m.ok ? m.daten.manager : m);
  const n = S.gesellschaftNormalisieren({ ...gVoll, anteile: { "11": 50, "12": 50, "99": 10 }, responsibleParty: 99 }, IDS);
  ok(!("99" in n.anteile) && n.responsibleParty === null, "fremde Mitglied-ids fallen aus Anteilen und Responsible Party");
  ok(!S.gesellschaftPruefen({ ...gVoll, wunschname2: "muster holdings" }, IDS, "unterschrift").ok, "drei Namen müssen verschieden sein");
  ok(!S.gesellschaftPruefen({ ...gVoll, website: "keine website" }, IDS, "speichern").ok, "kaputte Website: abgelehnt");
  ok(S.gesellschaftNormalisieren({ ...gVoll, bundesstaat: "nevada" }, IDS).bundesstaat === "delaware", "Nevada wird nicht angeboten → Vorgabe Delaware");
  ok(S.gesellschaftGleich(S.gesellschaftNormalisieren(gVoll, IDS), S.gesellschaftNormalisieren({ ...gVoll, anteile: { "12": 50, "11": 50 } }, IDS)), "Reihenfolge der Schlüssel ändert die Fassung nicht");
  ok(!S.gesellschaftGleich(S.gesellschaftNormalisieren(gVoll, IDS), S.gesellschaftNormalisieren({ ...gVoll, gegenstand: "Anderes" }, IDS)), "inhaltliche Änderung wird erkannt");
}

// ═══ 4 PERSÖNLICHE ANGABEN ═══════════════════════════════════════════════════
abschnitt("4 Persönliche Angaben: Zwischenspeichern, Pflicht vor der Unterschrift");
const aVoll = { anrede: "Herr", vornamen: "Max Peter", nachname: "Muster", geburtsdatum: "1985-04-12", geburtsort: "Musterstadt", staatsangehoerigkeit: "deutsch",
  strasse: "Musterweg 1", plz: "12345", ort: "Musterstadt", land: "Deutschland", steuerAnsaessig: "Deutschland", kontaktEmail: "", telefon: "+49 171 1234567",
  passNummer: "c01x 00t47", passStaat: "Deutschland", passGueltigBis: "2031-05-01", usSteuernummerVorhanden: false, usSteuernummer: "" };
{
  const a = S.angabenNormalisieren(aVoll);
  ok(S.angabenFehler(a, { heute: HEUTE, stufe: "unterschrift", reisepass: true }).length === 0, "vollständige Angaben mit Reisepass: nichts fehlt", S.angabenFehler(a, { heute: HEUTE, stufe: "unterschrift", reisepass: true }));
  ok(a.passNummer === "C01X00T47", "Reisepassnummer groß und ohne Leerzeichen", a.passNummer);
  ok(S.angabenPruefen({ vornamen: "Max" }, HEUTE).ok, "Zwischenspeichern mit nur einem Feld geht");
  const ohnePass = S.angabenFehler(a, { heute: HEUTE, stufe: "unterschrift", reisepass: false });
  ok(ohnePass.length === 1 && ohnePass[0].feld === "reisepass", "ohne hochgeladenen Reisepass fehlt genau der Reisepass", ohnePass);
  ok(!S.angabenPruefen({ ...aVoll, telefon: "0171 1234567" }, HEUTE).ok, "Telefon ohne Ländervorwahl: abgelehnt");
  ok(S.angabenPruefen({ ...aVoll, telefon: "0049 171 1234567" }, HEUTE).ok, "Telefon mit 0049 geht");
  ok(!S.angabenPruefen({ ...aVoll, geburtsdatum: "2010-01-01" }, HEUTE).ok, "unter 18 Jahren: abgelehnt");
  ok(!S.angabenPruefen({ ...aVoll, passGueltigBis: HEUTE }, HEUTE).ok, "Reisepass, der heute abläuft: abgelehnt (muss in der Zukunft liegen)");
  ok(!S.angabenPruefen({ ...aVoll, geburtsdatum: "2001-02-30" }, HEUTE).ok, "unmögliches Datum: abgelehnt");
  ok(S.angabenNormalisieren({ geburtsdatum: "12.04.1985" }).geburtsdatum === "1985-04-12", "TT.MM.JJJJ wird zu JJJJ-MM-TT");
  ok(!S.angabenPruefen({ ...aVoll, usSteuernummerVorhanden: true, usSteuernummer: "1234" }, HEUTE).ok, "SSN/ITIN mit vier Ziffern: abgelehnt");
  const fehltUs = S.angabenFehler(S.angabenNormalisieren({ ...aVoll, usSteuernummerVorhanden: null }), { heute: HEUTE, stufe: "unterschrift", reisepass: true });
  ok(fehltUs.some((f) => f.feld === "angaben.usSteuernummerVorhanden"), "die Frage nach der US-Steuernummer muss beantwortet sein");
  ok(S.angabenNormalisieren({ ...aVoll, usSteuernummerVorhanden: false, usSteuernummer: "123456789" }).usSteuernummer === "", "bei „Nein“ wird keine Nummer gespeichert");
  ok(S.usNummerMaskieren("123-45-6789") === "•••-••-6789" && S.angabenFuerBeleg(S.angabenNormalisieren({ ...aVoll, usSteuernummerVorhanden: true, usSteuernummer: "123456789" })).usSteuernummer === "•••-••-6789", "US-Steuernummer im Beleg maskiert");
}

// ═══ 5 NAMENSABGLEICH, MASKE, IP ═════════════════════════════════════════════
abschnitt("5 Namensabgleich, Maskierung, IP");
{
  ok(S.namenGleich("max  PETER muster", "Max Peter Muster"), "Groß-/Kleinschreibung und Leerzeichen sind egal");
  ok(S.namenGleich("MaxPeterMuster", "Max Peter Muster"), "fehlende Leerzeichen sind egal");
  ok(!S.namenGleich("Max Muster", "Max Peter Muster"), "fehlender Vorname zählt");
  ok(!S.namenGleich("", ""), "leer ist nie gleich");
  ok(S.namenGleich("Jürgen Müller", "JÜRGEN MÜLLER"), "Umlaute: Groß/klein egal");
  ok(S.emailMaskieren("Kim@Beispiel.example") === "k•••@beispiel.example", "Adresse maskiert wie „k•••@domain“", S.emailMaskieren("Kim@Beispiel.example"));
  ok(S.emailMaskieren("kaputt") === "•••", "kaputte Adresse wird ganz maskiert");
  ok(S.ipKuerzen("203.0.113.57") === "203.0.113.xxx" && S.ipKuerzen("2001:db8:85a3:0:0:8a2e:370:7334") === "2001:db8:85a3:…", "IP gekürzt (v4 und v6)");
}

// ═══ 6 FASSUNG, ÜBERHOLEN, STATUS, DROSSEL ═══════════════════════════════════
abschnitt("6 Fassungen: überholen, Status, alle unterschrieben, Drossel");
{
  const ms = [
    { id: 11, unterschriebenAm: "2026-11-17T09:00:00Z", unterschriftFassung: 1 },
    { id: 12, unterschriebenAm: null, unterschriftFassung: null },
  ];
  ok(JSON.stringify(S.zuUeberholen(ms, 2)) === "[11]", "neue Fassung überholt nur, wer eine ältere unterschrieben hat");
  ok(S.zuUeberholen(ms, 1).length === 0, "dieselbe Fassung überholt niemanden");
  ok(S.unterschriftStatus(ms[0], 1) === "unterschrieben" && S.unterschriftStatus(ms[1], 1) === "offen", "Status unterschrieben / offen");
  ok(S.unterschriftStatus({ id: 11, unterschriebenAm: null, unterschriftFassung: null, ueberholtAnzahl: 1 }, 2) === "neu_noetig", "nach dem Überholen: „Neue Unterschrift nötig“");
  ok(S.unterschriftStatus(ms[0], 2) === "neu_noetig", "Unterschrift einer alten Fassung zählt nicht als unterschrieben");
  ok(!S.alleUnterschrieben(ms, 1), "einer fehlt: nicht vollständig");
  ok(S.alleUnterschrieben([ms[0], { id: 12, unterschriebenAm: "2026-11-17T09:30:00Z", unterschriftFassung: 1 }], 1), "beide für die aktuelle Fassung: vollständig");
  ok(!S.alleUnterschrieben([ms[0], { id: 12, unterschriebenAm: "2026-11-17T09:30:00Z", unterschriftFassung: 2 }], 2), "einer auf alter Fassung: nicht vollständig");
  ok(!S.alleUnterschrieben([], 1), "leere Liste ist nie vollständig");
  const t0 = new Date("2026-11-17T10:00:00Z");
  let l = { fensterAb: null as Date | null, anzahl: 0 };
  const erlaubt: boolean[] = [];
  for (let i = 0; i < 6; i++) { const r = S.zugangDrossel({ ...l, jetzt: new Date(t0.getTime() + i * 60_000) }); erlaubt.push(r.erlaubt); if (r.erlaubt) l = { fensterAb: r.fensterAb, anzahl: r.anzahl }; }
  ok(JSON.stringify(erlaubt) === "[true,true,true,true,true,false]", "fünf Zugänge je Stunde, der sechste wird abgelehnt", erlaubt);
  ok(S.zugangDrossel({ ...l, jetzt: new Date(t0.getTime() + 61 * 60_000) }).erlaubt, "nach einer Stunde geht es wieder");
  const sql = datei("server/lib/fiaon-global-gruendungsbogen.ts");
  ok(/zugang_anzahl < \$\{GB_ZUGANG_MAX_JE_STUNDE\}/.test(sql) && /INTERVAL '1 hour'/.test(sql), "die Datenbank zählt mit derselben Grenze (5 je Stunde, Zähler in der Tabelle)");
}

// ═══ 7 WORTLAUT DER BESTÄTIGUNGEN (buchstabengetreu) ═════════════════════════
abschnitt("7 Bestätigungen: eine Quelle, nie vorangekreuzt, Wortlaut");
{
  ok(S.GB_BESTAETIGUNGEN.length === 5 && JSON.stringify(S.GB_BESTAETIGUNG_SCHLUESSEL) === JSON.stringify(["richtig", "auftrag", "datenschutz", "kosten", "keineBeratung"]), "fünf Bestätigungen in fester Reihenfolge");
  const AUFTRAG = "Ich beauftrage die FIAON LTD, London, die Gesellschaft mit den oben stehenden Angaben gemeinsam mit den übrigen Gesellschaftern zu gründen, die Gründungsunterlagen bei der zuständigen Behörde des Bundesstaats einzureichen, die gesetzlich vorgeschriebene Zustelladresse (Registered Agent) zu stellen und die Steuernummer EIN bei der US-Steuerbehörde IRS zu beantragen. Ich ermächtige sie, die dafür erforderlichen Erklärungen in meinem Namen abzugeben und Formulare vorzubereiten. Unterschriften auf Behördenformularen, die eine eigenhändige Unterschrift verlangen, leiste ich selbst.";
  ok(S.GB_BESTAETIGUNGEN[1].text("") === AUFTRAG, "Auftrag und Vollmacht: Wortlaut buchstabengetreu");
  ok(S.GB_BESTAETIGUNGEN[0].text("") === "Meine Angaben sind richtig und vollständig. Änderungen teile ich FIAON unverzüglich mit.", "Richtigkeit: Wortlaut buchstabengetreu");
  ok(S.GB_BESTAETIGUNGEN[3].text("Die Kosten trägt ein Dritter.") === "Die Kosten trägt ein Dritter. Das nehme ich zur Kenntnis.", "Kosten: Text des Bogens + Kenntnisnahme");
  ok(S.GB_BESTAETIGUNGEN[2].link?.href === "/datenschutz", "Datenschutz verweist auf die vorhandene Datenschutzerklärung");
  ok(S.bestaetigungFehlt({ richtig: true, auftrag: true, datenschutz: true, kosten: true, keineBeratung: true }) === null, "alle fünf echt bestätigt: nichts fehlt");
  ok(S.bestaetigungFehlt({ richtig: true, auftrag: "true", datenschutz: true, kosten: true, keineBeratung: true }) === "auftrag", "nur ein echtes true zählt (kein „true“ als Text)");
  ok(S.bestaetigungFehlt({}) === "richtig", "ohne Häkchen fehlt die erste");
  const seite = datei("client/src/pages/business-gruendung.tsx");
  ok(!seite.includes("Ich beauftrage die FIAON LTD") && !/checked=\{true\}|defaultChecked/.test(seite), "der Wortlaut steht NICHT in der Seite (eine Quelle) und kein Kästchen ist vorangekreuzt");
}

// ═══ 8 HASH UND PDF ══════════════════════════════════════════════════════════
abschnitt("8 Hash über die unterschriebenen Inhalte, PDF-Text");
const gN = S.gesellschaftNormalisieren(gVoll, IDS);
const aN = S.angabenFuerBeleg(S.angabenNormalisieren({ ...aVoll, usSteuernummerVorhanden: true, usSteuernummer: "123456789" }));
const inhalt = {
  kennung: "GB-MUSTER", fassung: 3, wortlautFassung: S.GB_WORTLAUT_FASSUNG, rechtsform: "LLC", kostenHinweis: S.GB_KOSTEN_VORGABE, gesellschaft: gN,
  mitglieder: [{ id: 11, name: "Herr Max Muster" }, { id: 12, name: "Frau Erika Beispiel" }], ich: { id: 11, anzeigename: "Herr Max Muster", email: "max@beispiel.example" },
  angaben: aN, reisepassSha256: "ab".repeat(32), bestaetigungen: S.bestaetigungsWortlaut(S.GB_KOSTEN_VORGABE), name: "Max Peter Muster", ort: "Musterstadt", zeitIso: "2026-11-17T10:00:00.000Z", ip: "203.0.113.57",
};
{
  const h = (x: unknown) => createHash("sha256").update(S.unterschriftInhaltText(x as any)).digest("hex");
  const umgestellt = Object.fromEntries(Object.entries(inhalt).reverse());
  ok(h(inhalt) === h(umgestellt), "Hash hängt nicht von der Reihenfolge der Felder ab");
  ok(h(inhalt) !== h({ ...inhalt, fassung: 4 }), "andere Fassung → anderer Hash");
  ok(h(inhalt) !== h({ ...inhalt, gesellschaft: { ...gN, gegenstand: "x" } }), "geänderte gemeinsame Angaben → anderer Hash");
  ok(h(inhalt) !== h({ ...inhalt, reisepassSha256: "cd".repeat(32) }), "anderer Reisepass → anderer Hash");
  ok(!S.unterschriftInhaltText(inhalt as any).includes("123456789"), "die volle US-Steuernummer steht nicht im unterschriebenen Inhalt");
  const pdfDaten = { kennung: "GB-MUSTER", fassung: 3, wortlautFassung: S.GB_WORTLAUT_FASSUNG, kostenHinweis: S.GB_KOSTEN_VORGABE, gesellschaft: gN, mitglieder: inhalt.mitglieder, ich: inhalt.ich, angaben: aN,
    reisepass: { name: "Reisepass.pdf", am: new Date("2026-11-17T09:00:00Z"), sha256: "ab".repeat(32) }, bestaetigungen: inhalt.bestaetigungen,
    unterschrift: { png: "data:image/png;base64,iVBORw0KGgo=", name: "Max Peter Muster", ort: "Musterstadt", am: new Date("2026-11-17T10:00:00Z"), ip: "203.0.113.57", hash: "f".repeat(64) } };
  const t = PDF.gbPdfText(pdfDaten);
  ok(t.includes("Muster Holdings LLC") && t.includes("Muster Ventures LLC") && t.includes("Delaware") && t.includes("Responsible Party (EIN)"), "PDF: gemeinsame Angaben (Namen mit LLC, Staat, Responsible Party)");
  ok(t.includes("Max Peter") && t.includes("C01X00T47") && t.includes("•••-••-6789") && !t.includes("123456789"), "PDF: eigene Angaben, US-Steuernummer nur maskiert");
  ok(S.bestaetigungsWortlaut(S.GB_KOSTEN_VORGABE).every((b) => t.replace(/\s+/g, " ").includes(b.text.replace(/\s+/g, " "))), "PDF: alle fünf Bestätigungen im Wortlaut");
  ok(t.includes("203.0.113.xxx") && !t.includes("203.0.113.57") && t.includes("f".repeat(64)), "PDF: IP gekürzt, Hash vollständig");
  ok(/um \d{2}:\d{2} Uhr/.test(t) && t.includes("Europe/Berlin"), "PDF: Zeit in Berliner Zeit");
  ok(t.includes("Angaben von Herrn Max Muster") && S.dativ("Frau Erika Beispiel") === "Frau Erika Beispiel", "PDF: „Angaben von Herrn …“ (Dativ)");
  ok(PDF.gbPdfUnterzeile(pdfDaten).includes("GB-MUSTER") && PDF.gbPdfUnterzeile(pdfDaten).includes("Fassung 3"), "PDF: Kennung und Fassung im Kopf");
  ok(!/<img[^>]*Reisepass/i.test(PDF.gbPdfRumpf(pdfDaten)) && PDF.gbPdfRumpf(pdfDaten).split("<img").length === 2, "PDF: kein Reisepassbild, nur das Unterschriftsbild");
  ok(datei("server/lib/fiaon-global-gruendungsbogen-pdf.ts").includes("keinNotbehelf: true"), "PDF ohne Ersatzdruck (Urkunde pixelgenau oder gar nicht)");
  if (pdfOrt) {
    process.env.PLAYWRIGHT_BROWSERS_PATH ||= "/Users/Justin/Developer/fiaon-plattform/.playwright";
    try {
      const png = readFileSync(path.join(WURZEL, "client/public/favicon-96.png"), "base64");
      const buf = await PDF.gbPdfErzeugen({ ...pdfDaten, unterschrift: { ...pdfDaten.unterschrift, png: `data:image/png;base64,${png}` } });
      mkdirSync(pdfOrt, { recursive: true });
      writeFileSync(path.join(pdfOrt, "gb-muster.pdf"), buf);
      ok(buf.length > 5000 && buf.subarray(0, 5).toString() === "%PDF-", "Muster-PDF gedruckt", buf.length);
      console.log(`  PDF: ${path.join(pdfOrt, "gb-muster.pdf")}`);
    } catch (e) { ok(false, "Muster-PDF gedruckt", String(e)); }
  }
}

// ═══ 9 MAIL ══════════════════════════════════════════════════════════════════
abschnitt("9 Mail: Zugang mit Link, ohne Lücken, ohne Anhang");
{
  const m = mailRendern("global_gruendungsbogen_zugang", { email: "max@beispiel.example", anrede_zeile: "Guten Tag Herr Max Muster", wunschname: "Muster Holdings LLC", kennung: "GB-MUSTER",
    zugang_url: "https://www.fiaon.com/business/gruendung/7-abc-0123456789abcdef0123456789abcdef/m/c-abc-0123456789abcdef0123456789abcdef", gueltig_text: "Dienstag, 1. Dezember 2026" });
  ok(m && m.fehlend.length === 0 && !m.knopfEntfallen, "Vorlage rendert ohne fehlende Platzhalter und mit Knopf", m?.fehlend);
  ok(m && m.html.includes("/business/gruendung/") && m.absender.name === "FIAON Global", "Link im Knopf, Absender „FIAON Global“", m?.absender);
  ok(m && !/Reisepassnummer|Geburtsdatum/.test(m.text), "keine persönlichen Daten in der Mail");
  const reg = datei("server/make-events-registry.ts") + datei("server/lib/fiaon-mail-events.ts") + datei("server/lib/fiaon-mail-frequenz.ts") + datei("server/make-webhook.ts");
  ok((reg.match(/global_gruendungsbogen_zugang/g) ?? []).length >= 4, "Ereignis im Register, in den Mail-Ereignissen, als Pflichtmail und im Typ");
  const lib = datei("server/lib/fiaon-global-gruendungsbogen.ts");
  ok(lib.includes("zugang_url: klar ? url : \"[verborgen]\"") && lib.includes("kontoMailWegFuer") && lib.includes("kontoMailUeber"), "Link nie im Klartext im Protokoll; zwei Wege wie E-441");
  ok(!/anhaenge|attachment/.test(lib), "kein Dokument reist per Mail");
}

// ═══ 10 WORTWAND ═════════════════════════════════════════════════════════════
abschnitt("10 Wortwand über alle Kundentexte");
{
  const texte: string[] = [];
  const sammle = (w: unknown) => {
    if (typeof w === "string") texte.push(w);
    else if (typeof w === "function") { try { sammle((w as any)("Muster", "Muster")); } catch { /* */ } }
    else if (Array.isArray(w)) w.forEach(sammle);
    else if (w && typeof w === "object") Object.values(w).forEach(sammle);
  };
  sammle(S.GB_TEXTE); sammle(S.bestaetigungsWortlaut(S.GB_KOSTEN_VORGABE)); sammle(S.GB_STATUS_TEXT); sammle(S.GB_UNTERSCHRIFT_TEXT);
  for (const st of ["delaware", "florida", "wyoming"]) texte.push(S.danachSatz(st));
  const treffer = texte.flatMap((t) => wandPruefen(t, ["aufgabe_an_betreuer"]).map((x: any) => `${t.slice(0, 60)} → ${x.hinweis ?? x.treffer}`));
  ok(treffer.length === 0, "keine Treffer der Wortwand", treffer);
  const scharf = texte.filter((t) => /\bbis zu\b|vermittel|garantier|\b(chase|mercury|bank of america|amex)\b|northwest/i.test(t));
  ok(scharf.length === 0, "kein „bis zu“, nichts „vermitteln“, keine Garantie, kein Bank- oder Partnername", scharf);
  ok(S.danachSatz("delaware").includes("zehn Werktage") && !/\b\d+\s*(Werktag|Woche)/.test(S.danachSatz("delaware")), "Dauer ehrlich aus der Quelle, Zahlen als Wort");
  ok(datei("scripts/pruef-wortwand-de.ts").includes("GB_TEXTE"), "die Wortwand des Hauses sammelt die Texte des Gründungsbogens");
}

// ═══ 11 WEGE ═════════════════════════════════════════════════════════════════
abschnitt("11 Wege: Route, Server-Weg, keine Messung, Chef-Wand, Log-Maske");
{
  const app = datei("client/src/App.tsx");
  ok(app.includes('path="/business/gruendung/:bt/m/:mt"') && app.includes('path="/business/gruendung/:bt"') && app.indexOf('"/business/gruendung/:bt/m/:mt"') < app.indexOf('"/business/:slug"'), "beide Client-Routen stehen vor /business/:slug");
  ok(!seiteUnbekannt("/business/gruendung/7-abc-0123") && !seiteUnbekannt("/business/gruendung/7-abc-0123/m/c-abc-0456") && seiteUnbekannt("/business/gruendung/x/y/z"), "Server liefert beide Seiten (kein 404), Unsinn darunter bleibt 404");
  ok(BEREICH_OHNE_MESSUNG.test("/business/gruendung/abc") && !besuchGezaehlt("/business/gruendung/abc/m/def"), "keine Messung auf den Seiten (Reisepass, Unterschrift)");
  ok(/business\\\/gruendung/.test(datei("client/src/components/site/EinwilligungsHinweis.tsx")), "auch Clarity und Pixel schweigen dort (Cookie-Hinweis)");
  const rt = datei("server/routes/fiaon-global-gruendungsbogen.ts");
  const chefRouten = (rt.match(/router\.(get|post)\(\s*[`"]\/chef\//g) ?? []).length;
  const mitWache = (rt.match(/router\.(get|post)\(\s*[`"]\/chef\/[^,]+,\s*wache,/g) ?? []).length;
  ok(chefRouten >= 9 && chefRouten === mitWache, `jede Chef-Route hinter requireChef („leitung“) (${mitWache}/${chefRouten})`);
  ok(rt.includes('requireChef("leitung")'), "die Wand ist die Leitung");
  const idx = datei("server/index.ts");
  const maske = /\.replace\(\/\\\/global\\\/gruendung\\\/\[\^\/\?\]\+\(\\\/m\\\/\[\^\/\?\]\+\)\?\/, "\/global\/gruendung\/…"\)/.test(idx);
  ok(maske, "Zugriffslog maskiert gemeinsamen und persönlichen Link");
  ok(datei("server/routes.ts").includes("fiaon-global-gruendungsbogen") && /X-Robots-Tag', 'noindex, nofollow'/.test(datei("server/routes.ts")), "Routen eingehängt, Seiten mit noindex-Kopfzeile");
  ok(datei("client/src/components/admin/chef-seiten.tsx").includes('slug: "gruendungsboegen"') && datei("client/src/pages/agent/rundgaenge.ts").includes("gruendungsboegen: { titel"), "Chefbüro-Seite im Raum Global, mit Rundgang");
  const lib = datei("server/lib/fiaon-global-gruendungsbogen.ts");
  ok(!/fiaon_applications|fiaon_persons|person_id\s*=|merge/i.test(lib.replace(/personId: null/g, "")), "keine Verknüpfung mit Antrag, Person oder Akte (keine Personenzusammenführung)");
  ok(lib.includes("istRoboterUnterschrift") && lib.includes("signaturPruefen") && lib.includes("FOR UPDATE"), "Roboter-Wand, Unterschriftsprüfung und Sperre der Bogen-Zeile");
  ok(!/\$\{JSON\.stringify\([^`]*?\)\}::jsonb/.test(lib) && (lib.match(/\.json\(/g) ?? []).length >= 5, "JSONB über sql.json geschrieben, nie als JSON-Text (jsonb doppelt verpackt, E-238/E-460)");
  ok(lib.includes("globalDateiTyp(buf)") && lib.includes("GB_REISEPASS_TYPEN"), "Reisepass am Inhalt erkannt (Magic Bytes), nur PDF/JPG/PNG");
  ok(lib.includes("gruendungEmpfaenger") && lib.includes("AUFRUF_MELDUNG_AN") && lib.includes("gemeldet_am IS NULL"), "nach allen Unterschriften: Aufgabe (Quelle wie E-520) und Leitungsmail genau einmal");
  ok(netz.length === 0, "kein Netzaufruf im Prüfstand", netz);
}

console.log(`\n${gut} von ${gut + rot.length} Prüfungen grün${rot.length ? `, ${rot.length} rot` : ""}.`);
if (rot.length) process.exitCode = 1;
process.exit();
