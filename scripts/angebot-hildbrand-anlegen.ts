// ═══════════════════════════════════════════════════════════════════════════
// SAAT: DAS INDIVIDUALANGEBOT FÜR HERRN WILLIAM HILDBRAND
// Individualangebot (01.10.2026), Register E-268
//
// Justin (01.10.2026): Gründung 4.650 € sofort, Kapital-Begleitung 6.850 € beim
// Meilenstein, Bürgin Schwarzott Global LLC bis zum Höchstbetrag 800.000 USD,
// zwölf Wochen Frist mit vollständiger Erstattung, Privatperson mit Widerruf,
// „Echter Prüfbericht".
//
// ── WOHER DIE DATEN KOMMEN (Produktion, NUR LESEND, 01.10.2026) ───────────
//   · Person 13411 (FIAON-P-EPE9CUN5), Lead 4725, Antrag FIAON-MUMYUYJK-2SLV.
//     Name, Anschrift, Geburtsdatum aus dem ANTRAG — in der Personenakte stehen
//     Vor- und Nachname vertauscht (first_name „Hildbrand").
//   · Prüfbericht Teil A: Compliance-Prüfung vom 01.10.2026 (Sanktionslisten OFAC/
//     EU/UN/UK frisch beim Herausgeber geladen, Prüfsummen, kein Treffer;
//     Stammdaten-Abgleich). Teil IV: Boni-Ampel, gerechnet mit der einen Rechnung
//     (shared/fiaon-boni-ampel.ts) — 82 Punkte, 40 aus Angaben, 42 aus Annahmen.
//     Läuft die Saat gegen eine Datenbank MIT Person 13411, rechnet sie die Ampel
//     dort nach und bricht ab, wenn das Ergebnis vom Messwert abweicht.
//   · Bürgin (Nachtrag Justin 01.10.2026, 10:50 — Stammdaten aus dem EIN-Antrag SS-4,
//     ~/Desktop/FIAON/11_Vertraege/2026-10-01_Global_Hildbrand/Schwarzott_Global_LLC_Stammdaten.md):
//     SCHWARZOTT GLOBAL LLC, Florida, 3119 Coral Way, Suite 200, Miami, FL 33145, USA,
//     vertreten durch Justin Schwarzott als Manager (geschäftsführendes Mitglied).
//     Registernummer „nicht erforderlich" (Justins Entscheidung — Anlage 1 nennt keine
//     Nummer), Zusage eigenhändig unterschrieben am 01.10.2026, Bestätigung „Bundesstaat,
//     Anschrift und Vertretung bestätigt (Grundlage: EIN-Antrag SS-4, vorgelegt 01.10.2026)".
//     Damit ist die Annahme NICHT mehr gesperrt.
//   · ENDABNAHME 01.10.2026 (Nachmittag): Der EIN-Antrag belegt keine Eintragung beim Florida
//     Department of State. Ein öffentlicher Registerspiegel (OpenCorporates, Abruf 01.10.2026)
//     führt SCHWARZOTT GLOBAL LLC unter der Document Number L24000309016 mit Status „Inactive";
//     Sunbiz selbst war aus dem Skript nicht abrufbar (Cloudflare 403). Die Nummer wird hier NICHT
//     eingetragen — das täte so, als wäre die Eintragung belegt. Stattdessen trennt das Haus Annahme
//     und Versand (shared/fiaon-global-angebot.ts, angebotVersandSperre): Der Link geht erst raus,
//     wenn Justin den Registerauszug (Status „Active") in die Akte legt, die Document Number im
//     Chef-Reiter einträgt und als Grundlage „Registerauszug vom …" setzt. Die Saat druckt die Sperre.
//   · Anlage 2 Abschnitt V (Mitwirkung) nennt seit der Endabnahme genau die drei Mitwirkungen der
//     Ziffer 7 Absatz 1; ein zweiter Lauf setzt den Prüfbericht am offenen Angebot nach
//     (angebotPruefberichtSetzen — Ergebnis unverändert, nur die Einbindung).
//
// ── AUFRUF ────────────────────────────────────────────────────────────────
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… \
//     SESSION_SECRET=… npx tsx scripts/angebot-hildbrand-anlegen.ts            → Vorschau
//   … npx tsx scripts/angebot-hildbrand-anlegen.ts --schreiben                  → legt an
// Gegen eine Datenbank, die NICHT auf 127.0.0.1/localhost zeigt, schreibt die Saat
// nur mit --schreiben --produktion (und nur mit Justins Go). Ein zweiter Lauf legt
// kein zweites Angebot an: Gibt es für die E-Mail schon ein OFFENES, trägt er dort die
// Bürgin-Felder nach (angebotAendern — jede Änderung steht mit der alten Prüfsumme im
// Verlauf) und zeigt den Link; ein angenommenes Angebot fasst er nie an.
// Die Vorschau schreibt reports/angebot-hildbrand-vorschau.html (reports/ ist nicht im Repo).
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const schreiben = process.argv.includes("--schreiben");
const produktion = process.argv.includes("--produktion");
const url = String(process.env.DATABASE_URL ?? "");
let host = "";
try { host = new URL(url).hostname; } catch { /* unten */ }
const lokal = ["127.0.0.1", "localhost"].includes(host);
if (!url) { console.error("ABBRUCH: DATABASE_URL fehlt."); process.exit(2); }
if (schreiben && !lokal && !produktion) {
  console.error(`ABBRUCH: DATABASE_URL zeigt auf ${host || "?"} — die Saat schreibt dorthin nur mit --schreiben --produktion (und Justins Go).`);
  process.exit(2);
}
if (schreiben && (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL) && lokal) {
  console.error("ABBRUCH: Ein Mail-Weg ist gesetzt (BREVO_API_KEY / MAKE_WEBHOOK_URL). Lokal bitte mit env -i starten.");
  process.exit(2);
}

const { sqlPool } = await import("../server/lib/db-pool");
const A = await import("../server/lib/fiaon-global-angebot");
const V = await import("../server/lib/fiaon-global-angebot-vertrag");
const S = await import("../shared/fiaon-global-angebot");
type Pruefbericht = import("../shared/fiaon-global-angebot").Pruefbericht;
type AngebotDaten = import("../shared/fiaon-global-angebot").AngebotDaten;

const HILDBRAND = {
  personId: 13411,
  kunde: {
    anrede: "Herr" as const, vorname: "William", nachname: "Hildbrand", geburtsdatum: "1971-11-04",
    strasse: "Am Kirchwald 1b", plz: "69251", ort: "Gaiberg", land: "DE" as const,
    email: "williamhildbrand@me.com", telefon: "+491711616162",
  },
  // Die Bürgin — vollständig nach dem Nachtrag (a). Name, Bundesstaat, Anschrift, Registerstelle,
  // Vertreter und Funktion kommen aus BUERGIN_VORGABE (dieselbe Quelle für jedes Angebot).
  buergin: {
    ...S.BUERGIN_VORGABE,
    // Justin (01.10.2026, nachmittags): Document Number L24000309016, Reinstatement — aktiv ab 02.10.2026.
    registernummer: "L24000309016",
    funktion: "Manager (geschäftsführendes Mitglied)",
    unterzeichnetAm: "2026-10-01",
    bestaetigt: true,
    bestaetigtGrundlage: "Sunbiz (Florida Division of Corporations), Document Number L24000309016 — Reinstatement, aktiv ab 02.10.2026 (Angabe Justin Schwarzott, 01.10.2026)",
  },
};

/** Der Messwert der Boni-Ampel (Produktion, lesend, 01.10.2026) — wörtlich aus der einen Rechnung. */
const BONI_MESSWERT = {
  farbe: "gruen" as const, punkte: 82, label: "Gute Lage",
  teile: [
    { key: "adresse", label: "Adresse", punkte: 20, quelle: "antrag" as const, text: "Vollständige Anschrift im DACH-Raum, Wohneigentum." },
    { key: "einkommen", label: "Einkommen", punkte: 20, quelle: "antrag" as const, text: "7.500 € im Monat, angestellt, seit 5 Jahren." },
    { key: "ausgaben", label: "Ausgaben", punkte: 13, quelle: "annahme" as const, text: "Noch keine Angaben zu den festen Kosten." },
    { key: "schulden", label: "Schulden", punkte: 15, quelle: "annahme" as const, text: "Noch keine Angabe zu Schulden." },
    { key: "schufa", label: "SCHUFA", punkte: 14, quelle: "annahme" as const, text: "Noch keine Auskunft gelesen." },
  ],
  belegt: 2, deckel: null, befunde: [] as string[], geschaetzt: false,
};

const PRUEFBERICHT_HILDBRAND: Pruefbericht = {
  erstellt: "01.10.2026",
  datenstand: "01.10.2026, Datenstand 09:28 MESZ",
  pruefer: "Justin Schwarzott, Director, FIAON LTD",
  aktenzeichen: "FIAON-P-EPE9CUN5",
  eigenschaft: "Privatperson (Verbraucher), Interessent",
  vorhaben: "Gründung einer US-LLC (Teil 1) und Begleitung der Gesellschaft bei Kapital- und Kartenanträgen (Teil 2) laut Individualangebot vom 01.10.2026",
  auflagen: [
    "Identifizierung vor Leistungsbeginn. Ein amtliches Ausweisdokument liegt noch nicht vor; die Identität ist bisher nur über übereinstimmende Selbstangaben belegt. Die Identifizierung anhand des Reisepasses erfolgt vor Beginn der Leistung — sie wird für die US-Formulare ohnehin gebraucht.",
    "PEP-Status als Selbstauskunft. FIAON nutzt keine PEP-Datenbank. Die Erklärung gibt Herr Hildbrand mit dem Vertrag ab (Ziffer 7 Absatz 4).",
    "Bonität nur aus Selbstangaben. Die interne Boni-Ampel steht auf Grün (82 von 100 Punkten). Sie beruht auf Angaben im Antrag und auf Standardannahmen — nicht auf einer Auskunft oder einem Kontoauszug. Sie ist keine Kreditwürdigkeitsprüfung; jedes Institut prüft selbst.",
    "Steuerliche Pflichten in Deutschland und den USA bestehen ab der Gründung und werden vor der Gründung mit dem Partner-Steuerberater geklärt (Abschnitt V).",
    "Datenpflege. Im Lead- und Personendatensatz sind Vor- und Nachname vertauscht (aus dem Werbeformular übernommen). Maßgeblich für Vertrag und Rechnung ist die Schreibweise des Antrags: William Hildbrand.",
  ],
  stammdaten: [
    { merkmal: "Name", befund: "William Hildbrand. Im Lead- und Personendatensatz sind Vor- und Nachname vertauscht; der Antrag führt die richtige Reihenfolge.", quelle: "Antrag, Personenakte, Lead" },
    { merkmal: "Anschrift", befund: "Am Kirchwald 1b, 69251 Gaiberg — gleichlautend in Antrag und Personenakte. Die Straße liegt in 69251 Gaiberg (Rhein-Neckar-Kreis, Baden-Württemberg). Kein Umzug in letzter Zeit angegeben.", quelle: "Antrag, Personenakte; OpenStreetMap, Abruf 01.10.2026" },
    { merkmal: "Geburtsdatum, Alter", befund: "04.11.1971 — gleichlautend in Antrag und Personenakte. Am Prüftag 54 Jahre, volljährig.", quelle: "Antrag, Personenakte" },
    { merkmal: "Wohnsitz, Staatsangehörigkeit", befund: "Deutschland; deutsche Staatsangehörigkeit", quelle: "Antrag (Selbstangabe)" },
    { merkmal: "Kontakt", befund: "E-Mail (w…@me.com) und deutsche Mobilnummer (+49 171 … 162) — gleichlautend in Lead, Antrag und Personenakte. Nachrichten an die Mobilnummer wurden am 29.09.2026 zugestellt und gelesen.", quelle: "Lead, Antrag, Personenakte, Nachrichtenprotokoll" },
    { merkmal: "Herkunft", befund: "Werbeformular „FIAON Karte DE 09-2026“ (Meta) vom 29.09.2026, Lead #4725. Am selben Tag Antrag FIAON-MUMYUYJK-2SLV für ein Kartenpaket begonnen und bei Schritt 6 von 8 beendet — nicht abgeschickt, keine Zustimmung zu AGB oder Vertrag erteilt. Am 29.09.2026 hat Herr Hildbrand mitgeteilt, das Kartenpaket nicht weiterzuverfolgen.", quelle: "Lead, Antrag, Nachrichtenprotokoll" },
    { merkmal: "Vertriebs- und Werbesperre", befund: "Keine. Keine Vertriebssperre, keine Werbesperre, keine Abmeldung, keine unzustellbare Adresse, kein Eintrag im Sperrprotokoll.", quelle: "Personenakte, Lead, Sperrprotokoll" },
    { merkmal: "Forderungen", befund: "Keine. Kein Vertrag, keine Rate, keine Rechnung, kein Inkasso, kein Global-Auftrag.", quelle: "Ratenbuch, Antrag, Global-Aufträge" },
    { merkmal: "Weitere Datensätze", befund: "Keine weitere Person mit derselben E-Mail-Adresse, Telefonnummer oder Name und Geburtsdatum im gesamten Bestand.", quelle: "Personen, Leads, Anträge, Anfragen, Anrufe" },
    { merkmal: "Identitätsnachweis", befund: "Nicht vorhanden — kein Ausweis und kein Pass hinterlegt.", quelle: "Antrag, Dokumente" },
  ],
  sanktionen: {
    abruf: "01.10.2026 zwischen 09:20 und 09:22 MESZ",
    listen: [
      { liste: "SDN List", herausgeber: "U.S. Treasury, OFAC", stand: "30.09.2026", eintraege: 19452, personen: 7565, treffer: 0 },
      { liste: "Consolidated Non-SDN List", herausgeber: "U.S. Treasury, OFAC", stand: "14.09.2026", eintraege: 481, personen: 118, treffer: 0 },
      { liste: "Konsolidierte Finanzsanktionsliste (FSF)", herausgeber: "Europäische Kommission", stand: "22.09.2026 — laut Veröffentlichungsverzeichnis vom 01.10.2026 die geltende Fassung", eintraege: 6241, personen: 4465, treffer: 0 },
      { liste: "Consolidated Sanctions List", herausgeber: "UN-Sicherheitsrat", stand: "30.09.2026, 23:00 UTC", eintraege: 1011, personen: 736, treffer: 0 },
      { liste: "UK Sanctions List", herausgeber: "UK Government, FCDO", stand: "29.09.2026", eintraege: 6339, personen: 4032, treffer: 0 },
    ],
    verfahren: "Verglichen wurden alle Namensfelder einschließlich aller Aliasnamen, unabhängig von der Reihenfolge von Vor- und Nachname und unscharf (höchstens zwei abweichende Buchstaben je Namensteil). Geprüfte Nachnamensformen: Hildbrand, Hildebrand, Hildbrandt, Hildebrandt, Hilbrand, Hillbrand, Hildbrant, Hildebrant, Hildenbrand, Hiltbrand, Hiltebrand. Vornamensformen: William, Wilhelm, Willi, Willy, Will, Bill, Billy, Guillaume, Guillermo und Umschriften. Das Geburtsdatum 04.11.1971 wurde in allen Schreibweisen der Listen gesucht, dazu jeder Eintrag mit einer der Vornamensformen und dem Geburtsjahr 1971.",
    gegenprobe: "Das Verfahren wurde mit zwei tatsächlich gelisteten Personen und absichtlich falsch geschriebenen Namen wiederholt. Beide wurden in jeder Liste gefunden, die sie führt, jeweils mit Geburtsdatum.",
    quellen: [
      { liste: "OFAC SDN List", stand: "30.09.2026", abruf: "01.10.2026, 09:20", quelle: "treasury.gov/ofac/downloads (sdn.csv, alt.csv)" },
      { liste: "OFAC Consolidated Non-SDN List", stand: "14.09.2026", abruf: "01.10.2026, 09:20", quelle: "treasury.gov/ofac/downloads/consolidated (cons_prim.csv, cons_alt.csv)" },
      { liste: "EU-Finanzsanktionsliste (FSF), XML 1.1", stand: "22.09.2026", abruf: "01.10.2026, 09:22", quelle: "webgate.ec.europa.eu/fsd/fsf" },
      { liste: "UN Consolidated Sanctions List", stand: "30.09.2026", abruf: "01.10.2026, 09:22", quelle: "scsanctions.un.org/resources/xml/en/consolidated.xml" },
      { liste: "UK Sanctions List", stand: "29.09.2026", abruf: "01.10.2026, 09:22", quelle: "sanctionslist.fcdo.gov.uk" },
    ],
    pruefsummen: [
      { datei: "sdn.csv", sha256: "04e849cec43e2d1149fe8cafb24c5ba8c6d8f1442469d92ea19b8202e12a99d8" },
      { datei: "alt.csv", sha256: "85c9d8db3cf58c588060489cd843b23d444ff1b821f48b5beb4d39037e419924" },
      { datei: "cons_prim.csv", sha256: "0a3b74f6eb28450a9993b42a234c1801471d4dcb41220f6a7b8e466575bc3889" },
      { datei: "cons_alt.csv", sha256: "ee4e86b664c7a11aacd0fe227f35336cff3467602bb9607653bb4ce193811474" },
      { datei: "EU FSF XML", sha256: "cd59eccb0278d33181c1d87814236109287c9ea5925502f00acfd2e0fd7fe440", zusatz: "(SHA-1 24a260f97c24b68f5b4ba79f0da7a747c3cb8f62 — identisch mit der Prüfsumme im Veröffentlichungsverzeichnis der Kommission)" },
      { datei: "UN XML", sha256: "c08321270b3161382476dd0cb63f9d065490963f6fcaf2704c8dce4d535fa7e4" },
      { datei: "UK CSV", sha256: "e6e9be730f83c129c115119c4d6cf3f9f3e1a7f3418b7751a7398bf1d6bf84d8" },
    ],
  },
  pep: {
    status: "offen",
    text: "FIAON nutzt keine PEP-Datenbank. Der Status wird deshalb durch Selbstauskunft im Vertrag festgestellt (Ziffer 7 Absatz 4): Herr Hildbrand erklärt, ob er selbst, ein Familienmitglied oder eine ihm bekanntermaßen nahestehende Person ein wichtiges öffentliches Amt ausübt oder in den letzten zwölf Monaten ausgeübt hat (Begriffe nach § 1 Abs. 12 bis 14 GwG). In den bei FIAON vorhandenen Daten gibt es keinen Hinweis auf ein öffentliches Amt. Das ersetzt die Erklärung nicht.",
  },
  boni: {
    ...BONI_MESSWERT,
    quelle: "boniAmpelFuerPerson(13411) — eine Rechnung für alle Kunden (shared/fiaon-boni-ampel.ts), Produktion lesend",
    stand: "01.10.2026, 09:28 MESZ",
  },
  eignung: {
    voraussetzungen: "Vorhaben: Eine in Deutschland ansässige Privatperson gründet eine US-LLC und wird anschließend bei Kapital- und Kartenanträgen der Gesellschaft begleitet. Persönliche Voraussetzungen — erfüllt, soweit vor Vertragsschluss prüfbar: volljährig, Wohnsitz in Deutschland, kein Sanktionsbezug, erreichbar. Eine US-LLC kann von einer Person ohne US-Staatsangehörigkeit und ohne US-Wohnsitz gegründet und gehalten werden.",
    steuer: [
      "Eine US-Gesellschaft, die aus Deutschland geführt wird, bleibt in Deutschland steuerpflichtig (Ort der Geschäftsleitung, § 10 AO). Wie die LLC steuerlich eingeordnet wird und wie das Doppelbesteuerungsabkommen Deutschland–USA greift, ist vor der Gründung zu klären.",
      "Die Gründung ist dem Finanzamt zu melden (§ 138 AO).",
      "In den USA gelten jährliche Meldepflichten auch ohne Umsatz (Form 5472 mit Form 1120); Versäumnisse ziehen hohe Strafzahlungen nach sich. Die laufenden Kosten ab dem zweiten Jahr weist das Angebot offen aus.",
      "Herr Hildbrand ist laut Antrag angestellt. Ob die Stellung als Gesellschafter einer US-LLC eine anzeigepflichtige Nebentätigkeit ist, richtet sich nach seinem Arbeitsvertrag.",
    ],
    haftung: "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus. Im Individualangebot ist dafür die Bürgschaftszusage der Schwarzott Global LLC vorgesehen. Ob ein Institut sie anstelle oder zusätzlich zu einer persönlichen Haftung annimmt, entscheidet das Institut — ebenso wie über Konto, Karte und Kapitalrahmen.",
    // Endabnahme 01.10.2026: genau die drei Mitwirkungen der Ziffer 7 Absatz 1 — nicht mehr („Nachweise, die ein
    // Institut anfordert", „Erreichbarkeit" standen hier zusätzlich und widersprachen Vertrag, Seite und Mail).
    mitwirkung: "Nach Ziffer 7 Absatz 1 des Vertrags drei Dinge: Unterschriften unter fertig vorbereitete Unterlagen (Gründungsunterlagen, Mandate der Partner, Steuerformulare, Konto-, Karten- und Finanzierungsanträge); ein gültiger Reisepass für die gesetzlich vorgeschriebene Identifizierung — und ein Adressnachweis, wenn ein Institut oder eine Behörde ihn zur Identifizierung verlangt; wahre und vollständige Angaben. Mehr schuldet Herr Hildbrand nicht.",
    einordnung: "Für das Vorhaben geeignet. Es sind keine Gründe ersichtlich, die der Gründung oder der Begleitung entgegenstehen. Vor Leistungsbeginn erfolgen die Identifizierung anhand des Reisepasses und ein erneuter Sanktionslisten-Abgleich.",
  },
};

// ── 1. Gibt es Person 13411 in DIESER Datenbank? Dann die Ampel nachrechnen. ──
const [p] = (await sqlPool`SELECT id FROM fiaon_persons WHERE id = ${HILDBRAND.personId} AND merged_into_person_id IS NULL LIMIT 1`.catch(() => [])) as any[];
if (p) {
  const { boniAmpelFuerPerson } = await import("../server/lib/fiaon-boni-ampel");
  const ampel = await boniAmpelFuerPerson(HILDBRAND.personId);
  const gleich = ampel && ampel.punkte === BONI_MESSWERT.punkte && ampel.farbe === BONI_MESSWERT.farbe
    && ampel.teile.every((t, i) => t.punkte === BONI_MESSWERT.teile[i].punkte && t.quelle === BONI_MESSWERT.teile[i].quelle);
  if (!gleich) {
    console.error(`ABBRUCH: Die Boni-Ampel rechnet heute anders als am 01.10.2026 gemessen (${ampel?.punkte ?? "—"} statt ${BONI_MESSWERT.punkte}). Der Prüfbericht trägt nur echte Zahlen — bitte im Chefbüro „Bonitätsteil neu rechnen".`);
    process.exit(1);
  }
  console.log(`Boni-Ampel in dieser Datenbank nachgerechnet: ${ampel!.punkte} Punkte (${ampel!.label}) — gleich dem Messwert.`);
} else {
  console.log("Person 13411 gibt es in dieser Datenbank nicht (lokaler Prüfstand) — Prüfbericht mit dem Messwert aus der Produktion vom 01.10.2026.");
}

// ── 2. Vorschau ───────────────────────────────────────────────────────────────
const vorschau: AngebotDaten = {
  ref: "FIAON-IA-VORSCHAU", fassung: S.ANGEBOT_FASSUNG, kunde: HILDBRAND.kunde, parameter: S.ANGEBOT_VORGABEN,
  buergin: HILDBRAND.buergin, pruefbericht: PRUEFBERICHT_HILDBRAND, gueltigBis: "2026-10-15",
};
const fehlt = S.angebotPflichtFehlen(vorschau);
console.log(`\nIndividualangebot für ${S.angebotKundeAnrede(HILDBRAND.kunde)} — Fassung ${S.ANGEBOT_FASSUNG}`);
console.log(`  Teil 1 ${S.angebotEur(vorschau.parameter.teil1Cents)} sofort · Teil 2 ${S.angebotEur(vorschau.parameter.teil2Cents)} beim Meilenstein · gesamt ${S.angebotEur(S.angebotGesamtCents(vorschau.parameter))}`);
console.log(`  Prüfbericht: ${S.pruefberichtErgebnis(PRUEFBERICHT_HILDBRAND).satz} Boni-Ampel ${BONI_MESSWERT.punkte} (${BONI_MESSWERT.label}).`);
console.log(`  Bürgin: ${HILDBRAND.buergin.name}, ${HILDBRAND.buergin.bundesstaat}, vertreten durch ${HILDBRAND.buergin.vertreter}, ${HILDBRAND.buergin.funktion} · Zusage unterschrieben am ${S.angebotTag(HILDBRAND.buergin.unterzeichnetAm)} · bestätigt (${HILDBRAND.buergin.bestaetigtGrundlage})`);
console.log(`  Annahme ${fehlt.length ? `gesperrt, solange fehlt: ${fehlt.join("; ")}` : "möglich — alle Pflichtfelder sind da."}`);
const versandSperre = S.angebotVersandSperre(HILDBRAND.buergin);
console.log(`  Versand des Links: ${versandSperre ? `GESPERRT — ${versandSperre}` : "frei (Registernachweis liegt vor)."}`);
try {
  fs.mkdirSync("reports", { recursive: true });
  const datei = path.join("reports", "angebot-hildbrand-vorschau.html");
  fs.writeFileSync(datei, `<!doctype html><meta charset="utf-8"><title>Vorschau Individualangebot</title><body style="max-width:860px;margin:30px auto;font-family:Inter,Arial">${V.angebotVorschauHtml(vorschau, { sofortBeginn: false, jahresbetreuung: false })}</body>`);
  console.log(`  Vorschau des Vertrags: ${datei}`);
} catch (e) { console.error("  Vorschau-Datei nicht geschrieben:", e); }

if (!schreiben) {
  console.log("\nNur Vorschau. Anlegen mit --schreiben (lokal) — gegen die Produktion zusätzlich --produktion und nur mit Justins Go.");
  await sqlPool.end();
  process.exit(0);
}

// ── 3. Anlegen (idempotent je E-Mail) ─────────────────────────────────────────
await A.ensureAngebotTabellen();
const [da] = (await sqlPool`
  SELECT id, angebot_ref, gueltig_bis, status, buergin FROM fiaon_global_angebote
   WHERE (kunde #>> '{}')::jsonb ->> 'email' = ${HILDBRAND.kunde.email} AND status IN ('offen', 'angenommen')
   ORDER BY created_at DESC LIMIT 1`) as any[];
if (da) {
  const gb = da.gueltig_bis instanceof Date ? da.gueltig_bis.toISOString().slice(0, 10) : String(da.gueltig_bis).slice(0, 10);
  console.log(`\nEs gibt schon ein Angebot für diese E-Mail: ${da.angebot_ref} (id ${da.id}, ${da.status}). Kein zweites angelegt.`);
  if (String(da.status) === "offen") {
    // Nachtrag (a): die Bürgin-Felder nachtragen, solange niemand angenommen hat — über denselben Weg wie das Chefbüro.
    const alt = typeof da.buergin === "string" ? JSON.parse(da.buergin) : (da.buergin ?? {});
    const anders = (Object.keys(HILDBRAND.buergin) as (keyof typeof HILDBRAND.buergin)[]).filter((k) => (alt[k] ?? null) !== (HILDBRAND.buergin[k] ?? null));
    if (anders.length) {
      const ae = await A.angebotAendern(Number(da.id), { buergin: HILDBRAND.buergin }, "Saat scripts/angebot-hildbrand-anlegen.ts (Nachtrag Bürgin 01.10.2026)");
      if (!ae.ok) { console.error(`FEHLER beim Nachtragen der Bürgin: ${ae.error}`); await sqlPool.end(); process.exit(1); }
      console.log(`Bürgin nachgetragen (${anders.join(", ")}). ${ae.fehlt.length ? `Es fehlt noch: ${ae.fehlt.join("; ")}` : "Alle Pflichtfelder sind da — Herr Hildbrand kann annehmen."}`);
    } else {
      console.log("Bürgin-Felder sind schon vollständig und gleich — nichts geändert.");
    }
    // Endabnahme 01.10.2026: Anlage 2 nachziehen, wenn sich der Wortlaut geändert hat (z. B. Abschnitt V) — nur am offenen Angebot.
    const [pbZeile] = (await sqlPool`SELECT pruefbericht FROM fiaon_global_angebote WHERE id = ${Number(da.id)}`) as any[];
    const pbAlt = typeof pbZeile?.pruefbericht === "string" ? JSON.parse(pbZeile.pruefbericht) : pbZeile?.pruefbericht;
    if (JSON.stringify(pbAlt ?? null) !== JSON.stringify(PRUEFBERICHT_HILDBRAND)) {
      const pe = await A.angebotPruefberichtSetzen(Number(da.id), PRUEFBERICHT_HILDBRAND, "Saat scripts/angebot-hildbrand-anlegen.ts (Anlage 2 nachgezogen, Endabnahme 01.10.2026)");
      if (!pe.ok) { console.error(`FEHLER beim Nachziehen des Prüfberichts: ${pe.error}`); await sqlPool.end(); process.exit(1); }
      console.log(`Prüfbericht (Anlage 2) nachgezogen — Ergebnis unverändert: ${S.pruefberichtErgebnis(PRUEFBERICHT_HILDBRAND).satz}`);
    } else {
      console.log("Prüfbericht (Anlage 2) ist schon gleich — nichts geändert.");
    }
  }
  console.log(`Link: ${A.angebotKundenPfad(A.angebotTokenErzeugen(String(da.angebot_ref), gb))}`);
  if (versandSperre) console.log(`VERSAND GESPERRT — ${versandSperre}`);
  await sqlPool.end();
  process.exit(0);
}
const erg = await A.angebotAnlegen({ personId: HILDBRAND.personId, kunde: HILDBRAND.kunde, parameter: S.ANGEBOT_VORGABEN, buergin: HILDBRAND.buergin, pruefbericht: PRUEFBERICHT_HILDBRAND }, "Saat scripts/angebot-hildbrand-anlegen.ts");
if (!erg.ok) { console.error(`FEHLER: ${erg.error}`); await sqlPool.end(); process.exit(1); }
console.log(`\nAngelegt: ${erg.ref} (id ${erg.id}).`);
console.log(`Link für Herrn Hildbrand: ${erg.link}`);
console.log("Alle Pflichtfelder der Bürgin sind gesetzt — Herr Hildbrand kann annehmen. Vor dem Versand: das eigenhändig unterschriebene Original von Anlage 1 per Post bereitlegen (§ 766 BGB).");
if (versandSperre) console.log(`VERSAND GESPERRT — ${versandSperre}`);
await sqlPool.end();
