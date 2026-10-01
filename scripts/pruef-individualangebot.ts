// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DAS INDIVIDUALANGEBOT VON FIAON GLOBAL
// Individualangebot (01.10.2026), Register E-268
//
// ── TEIL 1 — OHNE DATENBANK (immer) ───────────────────────────────────────
//   Wortlaut: fünfzehn Ziffern, Vertragssprache in Vertrag und Anlage 1, Wortwand
//   und schärfere Global-Regeln (genau EINE „bis zu"-Stelle je Text, an der
//   Höchstzahl des Kapitalrahmens), keine Frist mit Ziffer, kein Bankname, kein
//   „vermitteln/beschaffen", Beträge, Pflichthinweise wörtlich, Widerrufsbelehrung
//   wörtlich, Prüfsumme (stabil, je Schalter verschieden, Annahmevermerk nicht im
//   Hash), Pflichtfelder sperren, Prüfbericht (echtes Ergebnis, „bestanden" nur mit
//   gemessenem Abgleich ohne Treffer, 40/42 aus der Ampel, keine Sperrwörter),
//   Frist-Rechnung, Meilenstein- und Erstattungsregel, Token, die fünf Mails.
//
// ── TEIL 2 — MIT --lokal (lokale Prüf-Datenbank + laufender lokaler Server) ─
//   Der ganze Ablauf über HTTP wie ein Mensch: Pflichtfelder (409) → eintragen →
//   falscher Hash (409) → Roboter (403) → Leitung (403) → Annahme mit Doppelklick
//   (eine Bestellung) → Akte, Rechnung Teil 1 (4.650,00 €, fällig heute, Nummernkreis,
//   Bankdaten aus shared/fiaon-bank.ts), PDF-Inhalte → Mails im Protokoll
//   („fehlgeschlagen: kein Schlüssel" = es wäre rausgegangen) + Vorschau-HTML →
//   Buchung Teil 1 → Start nach der Widerrufsfrist bzw. sofort, Frist → Meilenstein →
//   Rechnung Teil 2 (6.850,00 €, +7 Tage) → Buchung Teil 2 (kein Start) → Fristende →
//   Tageslauf → Erstattung vormerken (Storno-Weg, Aufgabe an Justin, Mail) → falscher,
//   abgelaufener, zurückgezogener Link → Datenbank-Wand (Migration 087, zurückgerollt)
//   → Browser-Durchlauf mit Fotos (1280 px und 380 px, Chef-Reiter, „Mein Auftrag",
//   Bestätigung). Der Browser nimmt NIE an (Roboter-Wand, AGENTS.md).
//
//   env -i PATH="$PATH" HOME="$HOME" DATABASE_URL=postgresql://…@127.0.0.1:…/… SESSION_SECRET=<wie Server> \
//     PRUEF_BASIS=http://127.0.0.1:5287 PRUEF_FOTOS=<Ordner> PLAYWRIGHT_BROWSERS_PATH=<.playwright> \
//     npx tsx scripts/pruef-individualangebot.ts --lokal
//   Ohne --lokal: npx tsx scripts/pruef-individualangebot.ts   (Exit 1 bei Fehlern)
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";

const LOKAL = process.argv.includes("--lokal");
if (!LOKAL) process.env.DATABASE_URL = "postgres://pruefstand:ohne@127.0.0.1:1/keine-datenbank";
else {
  let host = "";
  try { host = new URL(String(process.env.DATABASE_URL)).hostname; } catch { /* unten */ }
  if (!["127.0.0.1", "localhost"].includes(host)) { console.error("ABBRUCH: --lokal läuft nur gegen eine Datenbank auf 127.0.0.1/localhost."); process.exit(2); }
  if (process.env.BREVO_API_KEY || process.env.MAKE_WEBHOOK_URL) { console.error("ABBRUCH: Ein Mail-Weg ist gesetzt — bitte mit env -i starten."); process.exit(2); }
}

const S = await import("../shared/fiaon-global-angebot");
const V = await import("../server/lib/fiaon-global-angebot-vertrag");
const A = await import("../server/lib/fiaon-global-angebot");
const { wandPruefen } = await import("../shared/fiaon-wortverbote");
const { GLOBAL_SCHAERFER } = await import("../shared/fiaon-global-wortregeln");
const { GLOBAL_PFLICHTHINWEIS } = await import("../shared/fiaon-global");
const { globalWiderrufsbelehrung } = await import("../shared/fiaon-global-widerruf");
const { mailRendern } = await import("../server/mail/motor");
const { GLOBAL_ANGEBOT_VORLAGEN } = await import("../server/mail/vorlagen/global-angebot");
const { BANK } = await import("../shared/fiaon-bank");
const { paket, PAKETE, istAngebotsPaket, verkaufbarePakete, PAKET_PREISE_EURO } = await import("../shared/fiaon-pakete");
const { katalogpreisCents } = await import("../server/lib/fiaon-massgebliche-bestellung");

let fehler = 0; let n = 0;
const ok = (b: unknown, was: string, zusatz?: unknown) => { n++; if (!b) { fehler++; console.log(`  FEHLER  ${was}${zusatz !== undefined ? `  → ${String(typeof zusatz === "string" ? zusatz : JSON.stringify(zusatz)).slice(0, 400)}` : ""}`); } };
const titel = (t: string) => console.log(`\n── ${t}`);
const AUS = { sofortBeginn: false, jahresbetreuung: false };
const ALLE_SCHALTER = [AUS, { sofortBeginn: true, jahresbetreuung: false }, { sofortBeginn: false, jahresbetreuung: true }, { sofortBeginn: true, jahresbetreuung: true }];

const PB: import("../shared/fiaon-global-angebot").Pruefbericht = {
  erstellt: "01.10.2026", datenstand: "01.10.2026, 09:28 MESZ", pruefer: "Prüfstand", aktenzeichen: "FIAON-P-PRUEF", eigenschaft: "Privatperson (Verbraucher)",
  vorhaben: "Gründung einer US-LLC und Kapital-Begleitung", stammdaten: [{ merkmal: "Name", befund: "Prüfperson Angebot", quelle: "Antrag" }],
  sanktionen: { abruf: "01.10.2026", listen: [{ liste: "SDN List", herausgeber: "OFAC", stand: "30.09.2026", eintraege: 19452, personen: 7565, treffer: 0 }], verfahren: "Unscharfer Namensabgleich.", gegenprobe: "Zwei gelistete Personen gefunden.", quellen: [], pruefsummen: [] },
  pep: { status: "offen", text: "Selbstauskunft im Vertrag." },
  boni: { farbe: "gruen", punkte: 82, label: "Gute Lage", teile: [
    { key: "adresse", label: "Adresse", punkte: 20, quelle: "antrag", text: "Vollständige Anschrift im DACH-Raum, Wohneigentum." },
    { key: "einkommen", label: "Einkommen", punkte: 20, quelle: "antrag", text: "7.500 € im Monat, angestellt, seit 5 Jahren." },
    { key: "ausgaben", label: "Ausgaben", punkte: 13, quelle: "annahme", text: "Noch keine Angaben zu den festen Kosten." },
    { key: "schulden", label: "Schulden", punkte: 15, quelle: "annahme", text: "Noch keine Angabe zu Schulden." },
    { key: "schufa", label: "SCHUFA", punkte: 14, quelle: "annahme", text: "Noch keine Auskunft gelesen." },
  ], belegt: 2, deckel: null, befunde: [], geschaetzt: false, quelle: "Prüfstand", stand: "01.10.2026" },
  eignung: { voraussetzungen: "Volljährig, Wohnsitz in Deutschland.", steuer: ["Die Gründung ist dem Finanzamt zu melden (§ 138 AO)."], haftung: "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus.", mitwirkung: "Reisepass, Unterschriften.", einordnung: "Geeignet." },
  auflagen: ["Identifizierung vor Leistungsbeginn."],
};
// Nachtrag (a), 01.10.2026: Registernummer „nicht erforderlich" (Anlage 1 ohne Registerzeile), Bestätigung mit Grundlage.
const BUERGIN_VOLL = { ...S.BUERGIN_VORGABE, registernummer: S.BUERGIN_NUMMER_NICHT_ERFORDERLICH, funktion: "Manager (geschäftsführendes Mitglied)", unterzeichnetAm: "2026-10-01", bestaetigt: true, bestaetigtGrundlage: "EIN-Antrag SS-4, vorgelegt 01.10.2026" };
const BUERGIN_MIT_NUMMER = { ...BUERGIN_VOLL, registernummer: "L26000000000" };
const KUNDE = { anrede: "Herr" as const, vorname: "William", nachname: "Hildbrand", geburtsdatum: "1971-11-04", strasse: "Am Kirchwald 1b", plz: "69251", ort: "Gaiberg", land: "DE" as const, email: "w@example.de", telefon: "" };
const D = { ref: "FIAON-IA-PRUEF1", fassung: S.ANGEBOT_FASSUNG, kunde: KUNDE, parameter: S.ANGEBOT_VORGABEN, buergin: BUERGIN_VOLL, pruefbericht: PB, gueltigBis: "2026-10-15" };

// ═══ TEIL 1 ════════════════════════════════════════════════════════════════
titel("1. Ziffern und Vertragssprache");
{
  const z = S.angebotZiffern(D, AUS);
  ok(z.length === 15 && z.every((x, i) => x.nr === i + 1), "fünfzehn Ziffern, fortlaufend");
  ok(JSON.stringify(z.map((x) => x.titel)) === JSON.stringify(S.ANGEBOT_ZIFFER_TITEL), "Titel der Ziffern", z.map((x) => x.titel));
  for (const s of ALLE_SCHALTER) {
    const vertrag = S.angebotZiffern(D, s).flatMap((x) => x.absaetze.flatMap((a) => (a.art === "p" ? [a.text] : [a.einleitung ?? "", ...a.zeilen])));
    const anlage1 = [...S.buergschaftParteien(D), ...S.buergschaftZiffern(D).flatMap((x) => x.absaetze.flatMap((a) => (a.art === "p" ? [a.text] : [a.einleitung ?? "", ...a.zeilen])))];
    const ansprache = [...vertrag, ...anlage1, ...S.angebotPraeambel(D)].join("\n").match(/\b(Ihr|Ihre|Ihrer|Ihrem|Ihren|Ihres|Ihnen|[Uu]nser\w*|[Ww]ir)\b/g) ?? [];
    ok(ansprache.length === 0, `Vertragssprache (Schalter ${JSON.stringify(s)})`, ansprache);
  }
  const ohne = V.angebotText(D, AUS); const mit = V.angebotText(D, { sofortBeginn: true, jahresbetreuung: true });
  ok(ohne.includes("Der Auftraggeber hat nicht verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt") && !ohne.includes("hat ausdrücklich verlangt"), "ohne sofortigen Beginn: Ziffer 11 Absatz 2 richtig");
  ok(mit.includes("hat ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt") && mit.includes("angemessenen Betrag"), "mit sofortigem Beginn: Wertersatz-Satz");
  ok(ohne.includes("frühestens jedoch mit dem Tag, an dem FIAON nach Ablauf der Widerrufsfrist") && mit.includes("Sie beginnt mit dem Tag, an dem die Vergütung für Teil 1 bei FIAON eingeht. FIAON teilt"), "Fristbeginn je Schalter (Ziffer 6 Absatz 1)");
  ok(mit.includes("699 € je Betreuungsjahr") && mit.includes("verlängert sich nicht von selbst") && ohne.includes("ist nicht Teil dieses Vertrags"), "Jahresbetreuung nur gebucht im Vertrag, sonst „nicht Teil“");
  for (const h of GLOBAL_PFLICHTHINWEIS.de) ok(ohne.includes(h), `Pflichthinweis wörtlich: ${h.slice(0, 40)}`);
  for (const b of ["4.650,00 €", "6.850,00 €", "11.500,00 €", "Kapitalrahmen von 800.000 US-Dollar", "Höchstbetrag von insgesamt 800.000 US-Dollar", "zwölf Wochen", "binnen vierzehn Tagen nach Fristende", "binnen sieben Tagen nach Zugang", "Eine Mindesthöhe gilt nicht"]) ok(ohne.includes(b), `Vertrag enthält „${b}“`);
  // Nachtrag (h): erstes Jahr alles inklusive, Mitwirkung nur Unterschriften, Reisepass, wahre Angaben.
  for (const b of ["Versteckte Gebühren gibt es nicht", "im ersten Jahr nichts selbst zu veranlassen", "beschränkt sich auf drei Dinge", "Alles Weitere erledigt FIAON", "eine der drei Mitwirkungen nach Ziffer 7 Absatz 1"]) ok(ohne.includes(b), `Vertrag (Nachtrag h) enthält „${b}“`);
  ok(!ohne.includes("vollständige Unterlagen"), "Fristhemmung verlangt keine „vollständigen Unterlagen“ mehr");
  // Gegenprüfung 01.10.2026: „alles inklusive" meint die VEREINBARTEN Leistungen; Mandate und § 138 AO gehören zu den
  // Unterschriften; ein Adressnachweis zur Identifizierung gehört zum Reisepass; keine unbelegte Tatsache zur Partnervergütung.
  for (const b of ["Für die Leistungen nach Absatz 1 entstehen dem Auftraggeber", "nennt Ziffer 5 Absatz 5", "Mandate für Partner-Steuerberater, Partner-Anwalt und US-CPA", "§ 138 AO, Kontoanträge", "eines Adressnachweises", "legt FIAON das dem Auftraggeber vor der Beauftragung dieses Partners offen"]) ok(ohne.includes(b), `Vertrag (Gegenprüfung) enthält „${b}“`);
  ok(!ohne.includes("alle Kosten der Gesellschaft") && !ohne.includes("erhält von den Partnern keine Vergütung"), "Vertrag: keine „alle Kosten der Gesellschaft“, keine unbelegte Partner-Tatsache");
  // Nachtrag (a): ohne Document Number keine Registerzeile in Anlage 1; mit Nummer wie bisher.
  ok(ohne.includes("nach dem Recht des Bundesstaats Florida, 3119 Coral Way, Suite 200, Miami, FL 33145, USA, vertreten durch Justin Schwarzott, Manager (geschäftsführendes Mitglied) — nachfolgend „Bürgin“") && !ohne.includes("unter der Nummer"), "Anlage 1 ohne Registernummer: Name, Bundesstaat, Anschrift, Vertreter");
  ok(!/unter der Nummer nicht/.test(ohne) && !ohne.includes("(("), "Anlage 1: nie „unter der Nummer nicht …“, nie doppelte Klammer");
  ok(/Prüfsumme dieser Fassung der Anlage 1/.test(ohne) && /^[0-9a-f]{40,}$/.test(V.buergschaftPruefsumme(D)) && V.buergschaftPruefsumme(D) !== V.buergschaftPruefsumme({ ...D, buergin: BUERGIN_MIT_NUMMER }), "Anlage 1 trägt ihre eigene Prüfsumme; sie ändert sich mit dem Wortlaut");
  ok(V.angebotText({ ...D, buergin: BUERGIN_MIT_NUMMER }, AUS).includes("eingetragen bei Florida Department of State, Division of Corporations unter der Nummer L26000000000"), "Anlage 1 mit Registernummer: Registerzeile da");
  ok(!/nicht erforderlich/.test(ohne), "„nicht erforderlich“ steht nie im Vertragstext");
  ok(ohne.includes("Anlage 1 — Bürgschaftszusage") && ohne.includes("Anlage 2 — Prüfbericht") && ohne.includes("Anlage 3 — Widerrufsbelehrung"), "drei Anlagen im Rumpf");
  ok(ohne.includes("Ersatz des gezahlten Betrags verlangen") && ohne.includes("§ 774 BGB"), "Rückgriff der Bürgin offen gesagt (Ziffer 8 + Anlage 1)");
  ok(ohne.includes("Weder FIAON noch die Schwarzott Global LLC verlangen vom Auftraggeber oder von der Gesellschaft Sicherheiten") && ohne.includes("übliche persönliche Haftung des Inhabers"), "keine Sicherheiten — mit dem Satz zur persönlichen Haftung");
  ok(/§ 766 BGB/.test(ohne) && /eigenhändig/.test(ohne), "Schriftform der Bürgschaftszusage genannt");
  const wb = globalWiderrufsbelehrung("de");
  for (const a of wb.abschnitte) for (const t of a.absaetze) ok(ohne.includes(t), `Widerrufsbelehrung wörtlich: ${t.slice(0, 40)}`);
  for (const zeile of wb.formular.zeilen) ok(ohne.includes(zeile), `Muster-Formular wörtlich: ${zeile.slice(0, 30)}`);
}

titel("2. Wortwand und schärfere Global-Regeln");
{
  const wb = globalWiderrufsbelehrung("de");
  // Das gesetzliche Muster bleibt wörtlich („bis zu dem Zeitpunkt") — es wird vor den Global-Regeln herausgenommen.
  const ohneMuster = (t: string) => wb.abschnitte.flatMap((a) => a.absaetze).reduce((s, x) => s.split(x).join(""), t);
  const pruefe = (name: string, text: string, erlaubteBisZu: number, gedeckt: string[] = []) => {
    const w = wandPruefen(text, gedeckt);
    ok(w.length === 0, `${name}: Wortwand`, w.map((x) => `${x.treffer} (${x.hinweis.slice(0, 40)})`));
    const rest = ohneMuster(text);
    for (const r of GLOBAL_SCHAERFER) {
      const treffer = rest.match(new RegExp(r.muster.source, "gi")) ?? [];
      const erlaubt = /bis zu/.test(r.muster.source) ? erlaubteBisZu : 0;
      ok(treffer.length === erlaubt, `${name}: ${r.grund.slice(0, 50)} (${treffer.length}×, erlaubt ${erlaubt})`, treffer);
    }
    const ziffer = rest.match(/\b\d+\s*(Wochen|Tage|Tagen|Werktage|Werktagen|Monate|Monaten)\b/g) ?? [];
    ok(ziffer.length === 0, `${name}: keine Frist mit Ziffer`, ziffer);
    const heikel = rest.match(/\b(vermittel\w*|beschaff\w*|Zusicherung|garantiert?)\b/gi) ?? [];
    ok(heikel.length === 0, `${name}: kein „vermitteln/beschaffen/garantiert“`, heikel);
    ok(!/\bbis zu\b/i.test(rest), `${name}: kein „bis zu“ (Nachtrag b)`);
  };
  // Nachtrag (b), Justin 01.10.2026: KEIN „bis zu" mehr — auch nicht an der Höchstzahl (nur das gesetzliche Muster bleibt).
  for (const s of ALLE_SCHALTER) pruefe(`Vertrag ${JSON.stringify(s)}`, V.angebotText(D, s), 0);
  const seite = S.angebotSeite(D);
  const seitenText = JSON.stringify(seite);
  pruefe("Seite", seitenText, 0);
  // Nachtrag (b)+(c): Hero und Nutzenliste ohne Beträge und ohne den Institut-Satz; Kapitalrahmen als feste Zahl.
  const hero = [seite.titel, seite.lead, ...seite.nutzen].join("\n");
  ok(!/\d\.\d{3},\d{2} €|\d\.\d{3} €/.test(hero), "Hero/Nutzen: keine Beträge", hero);
  ok(!/Institut/.test(hero), "Hero/Nutzen: kein Institut-Satz", hero);
  ok(seite.nutzen.some((n) => /^Ihr Ziel: /.test(n) && n.includes("Kapitalrahmen von 800.000 $")) && seite.nutzen.some((n) => /^Ihr Ziel: drei Business-Kreditkarten/.test(n)) && seite.lead.includes("auf dem Weg zu einem Kapitalrahmen von 800.000 US-Dollar"), "Hero: Kapitalrahmen und Karten als feste Zahl, als ZIEL gekennzeichnet (Gegenprüfung)");
  ok(!/kümmern sich um (gar )?nichts/.test(JSON.stringify(seite)) && !/alle Kosten Ihrer Gesellschaft/.test(JSON.stringify(seite)), "Seite: kein „um nichts kümmern“, kein „alle Kosten Ihrer Gesellschaft“ (Gegenprüfung)");
  ok(seite.nutzen.some((n) => /Bürgin/.test(n)) && seite.nutzen.some((n) => /Keine Sicherheiten/.test(n)) && seite.nutzen.some((n) => /Team vor Ort/.test(n)), "Nutzenliste: Team, Bürgin, keine Sicherheiten");
  // Nachtrag (i): Begrüßung aus dem Angebot, nie hart codiert.
  ok(seite.auftakt.gruss === "Herzlich willkommen, Herr Hildbrand" && seite.auftakt.zeile === "Ihr Vertrag steht bereit.", "Auftakt: Name aus dem Angebot", seite.auftakt);
  ok(S.angebotSeite({ ...D, kunde: { ...KUNDE, anrede: "Frau", vorname: "Anna", nachname: "Muster" } }).auftakt.gruss === "Herzlich willkommen, Frau Muster", "Auftakt folgt Anrede und Namen");
  // Nachtrag (c): Reihenfolge und Beträge nur unter „Ihre Investition" (und in der Bestellübersicht).
  ok(seite.investition.satz.startsWith("4.650 € sind ausschließlich die Gründungskosten Ihrer Gesellschaft. Unsere eigentliche Vergütung von 6.850 € verdienen wir erst mit Ihrem Erfolg"), "„Ihre Investition“: Justins Satz wörtlich", seite.investition.satz);
  ok(JSON.stringify(seite.bekommen).includes("keine versteckten Gebühren") && JSON.stringify(seite.bekommen).includes("kümmern wir uns") && JSON.stringify(seite.bekommen).includes("alle Gebühren und Honorare dafür") && JSON.stringify(seite.bekommen).includes("Nicht enthalten sind die laufende Buchhaltung"), "„Was Sie bekommen“: alles inklusive (Gebühren und Honorare), wir kümmern uns, Ausnahmen in einem Satz (Nachtrag h + Gegenprüfung)");
  // Endabnahme 01.10.2026: kein „nur" (abschließende Zusage), alle vier Posten aus Ziffer 5 Absatz 5 — und die Überschriften als Ziel.
  const ausnahmen = seite.bekommen[0].fein;
  ok(!/Nicht enthalten sind nur/.test(ausnahmen) && /Umsatzsteuer-Registrierungen in einzelnen US-Bundesstaaten/.test(ausnahmen) && /Steuererklärungen zu Hause/.test(ausnahmen) && /Gebühren, die ein Institut selbst verlangt/.test(ausnahmen) && /Ziffer 5 Absatz 5/.test(ausnahmen), "„Was Sie bekommen“: Ausnahmen ohne „nur“, vier Posten, Verweis auf Ziffer 5 Absatz 5 (Endabnahme)", ausnahmen);
  ok(seite.bekommen.some((b) => b.titel === "Ihr Ziel: Kapitalrahmen von 800.000 US-Dollar") && seite.bekommen.some((b) => b.titel === "Ihr Ziel: drei Business-Kreditkarten") && !seite.bekommen.some((b) => /^(Kapitalrahmen|Drei Business)/.test(b.titel)), "„Was Sie bekommen“: Kapitalrahmen und Karten auch in der Überschrift als Ziel (Endabnahme)", seite.bekommen.map((b) => b.titel));
  ok(!/\d\.\d{3},\d{2} €/.test(JSON.stringify([seite.bekommen, seite.ablauf, seite.schutz])), "Abschnitte 2–4 ohne Beträge");
  ok(seite.schutz.some((x) => /entscheidet das jeweilige Institut/.test(x.fein)) && seite.hinweise.some((h) => /entscheidet allein das jeweilige Institut/.test(h)), "Institut-Satz unter „Ihr Schutz“ und in den Pflichthinweisen");
  ok(seite.ablauf.some((x) => /entscheidet das jeweilige Institut/.test(x.text)) && seite.investition.tafel.some((z) => /entscheidet das jeweilige Institut/.test(z.zusatz)), "Institut-Satz auch in „So läuft es“ und „Ihre Investition“ (Gegenprüfung)");
  ok(seite.ablauf.length === 4 && seite.ablauf.every((x) => x.wann && x.titel && x.text) && /zwölf Wochen ab unserem Start/.test(seite.ablaufZeitplan), "„So läuft es“: vier Schritte mit Zeitplan ab unserem Start");
  // Gegenprüfung: Frist ab unserem Start (nicht „ab Ihrer Zahlung"), „gleich in welcher Höhe" auch in 3 und 5, Erstattung entfällt auch bei eigenem Antrag.
  ok(!/Wochen ab Ihrer Zahlung/.test(JSON.stringify(seite)) && seite.schutz.some((x) => /ab unserem Start \(mit sofortigem Beginn: ab Ihrem Zahlungseingang\)/.test(x.text) && /auch nicht auf einen eigenen Antrag/.test(x.text)), "Seite: Frist ab unserem Start, Erstattung entfällt auch bei eigenem Antrag");
  ok(seite.ablauf[3].text.includes("gleich in welcher Höhe") && seite.investition.tafel.some((z) => z.zusatz.includes("gleich in welcher Höhe")) && seite.investition.tafel.some((z) => /ab unserem Start/.test(z.zusatz)), "„gleich in welcher Höhe“ in Ablauf und Tafel; Geld zurück ab unserem Start");
  ok(seite.schutz.some((x) => /Adressnachweis/.test(x.fein)) && seite.lead.includes("Sie unterschreiben, wir erledigen den Rest"), "Seite: Mitwirkung ehrlich (Reisepass, ggf. Adressnachweis), kein „um nichts kümmern“");
  for (const s of ALLE_SCHALTER) pruefe(`Bestellübersicht ${JSON.stringify(s)}`, JSON.stringify(S.angebotBestellUebersicht(D, s)), 0);
  pruefe("Annahme-Texte", JSON.stringify({ ...S.ANGEBOT_ANNAHME, unterKnopf: S.ANGEBOT_ANNAHME.unterKnopf("4.650,00 €"), fertigSofort: S.ANGEBOT_ANNAHME.fertigSofort("x@y.de"), fertigWartet: S.ANGEBOT_ANNAHME.fertigWartet("x@y.de") }), 0);
  pruefe("Mein Auftrag", JSON.stringify({ ...S.ANGEBOT_MEIN_AUFTRAG, frist: S.ANGEBOT_MEIN_AUFTRAG.frist("2026-10-01", "2026-12-24") }), 0);
  const pbText = V.pruefberichtHtml(D, PB).replace(/<[^>]+>/g, " ");
  pruefe("Prüfbericht", pbText, 0);
  ok(!/\b(knapp|durchgefallen|garantiert|sicher)\b/i.test(pbText), "Prüfbericht: keine Sperrwörter (knapp, durchgefallen, garantiert, sicher)");
  // Die Mail an Herrn Hildbrand (Entwurf) — wenn vorhanden.
  const mailDatei = process.env.PRUEF_MAILENTWURF;
  if (mailDatei && fs.existsSync(mailDatei)) {
    const t = fs.readFileSync(mailDatei, "utf8").split("\n").filter((z) => !z.startsWith(">") && !z.startsWith("<!--")).join("\n");
    pruefe("Mail-Entwurf Hildbrand", t, 0);
    ok(/Kapitalrahmen von 800\.000 US-Dollar/.test(t) && !/\bbis zu\b/.test(t), "Mail: Kapitalrahmen als feste Zahl, kein „bis zu“");
    ok(/alles inklusive/i.test(t) && /Reisepass/.test(t) && /15\.10\./.test(t), "Mail: alles inklusive, Reisepass, Link gilt bis 15.10.");
    // Endabnahme 01.10.2026: Ausnahmen wortgleich mit der Seite — ohne „nur", mit Umsatzsteuer-Registrierungen.
    ok(!/nicht dazugehört \(|Nicht enthalten sind nur/.test(t) && /Umsatzsteuer-Registrierungen in einzelnen US-Bundesstaaten/.test(t) && /Ziffer 5 Absatz 5/.test(t), "Mail: Ausnahmen ohne „nur“, vier Posten, Ziffer 5 Absatz 5 (Endabnahme)");
    ok(/1\.\s/.test(t) && /Zahlungspflichtig annehmen/.test(t) && /Verwendungszweck/.test(t) && /Startgespräch/.test(t), "Mail: nummerierte Schritte bis zum Startgespräch");
  }
}

titel("3. Prüfsumme");
{
  const h = ALLE_SCHALTER.map((s) => V.angebotTextHash(D, s));
  ok(new Set(h).size === 4, "vier Schalterstellungen, vier Prüfsummen");
  ok(V.angebotTextHash(D, AUS) === V.angebotTextHash({ ...D }, { ...AUS }), "Prüfsumme stabil");
  ok(V.angebotTextHash(D, AUS) !== V.angebotTextHash({ ...D, buergin: { ...BUERGIN_VOLL, registernummer: "L26999999999" } }, AUS), "Änderung an Anlage 1 ändert die Prüfsumme");
  ok(V.angebotTextHash(D, AUS) !== V.angebotTextHash({ ...D, ref: "FIAON-IA-PRUEF2" }, AUS), "andere Referenz, andere Prüfsumme");
  const rumpf = V.angebotRumpfHtml(D, AUS);
  ok(V.angebotVorschauHtml(D, AUS).includes(rumpf.replace(/^<div class="gv" lang="de">/, "").replace(/<\/div>$/, "")), "Bildschirm zeigt exakt den Rumpf des PDFs");
  const mitVermerk = V.angebotRumpfHtml(D, AUS, { am: new Date("2026-10-01T10:00:00Z"), ip: "203.0.113.7", userAgent: "Mozilla/5.0", hash: "abc" });
  ok(!rumpf.includes("Angenommen von") && mitVermerk.includes("Angenommen von William Hildbrand") && mitVermerk.includes("203.0.113.7") && mitVermerk.includes("SHA-256"), "Annahmevermerk nur im PDF, nicht im Hash-Rumpf");
}

titel("4. Pflichtfelder");
{
  // Die Vorgabe kennt die LLC (SS-4) — je Angebot fehlen Unterschrift-Datum und Bestätigung mit Grundlage.
  const f = S.angebotPflichtFehlen({ ...D, buergin: S.BUERGIN_VORGABE });
  for (const w of ["eigenhändig unterschrieben", "bestätigt (Haken)", "Grundlage der Bestätigung"]) ok(f.some((x) => x.includes(w)), `fehlt gemeldet: ${w}`, f);
  ok(f.length === 3, "Vorgabe: genau drei offene Punkte", f);
  const leer = { ...D, buergin: { ...S.BUERGIN_VORGABE, registernummer: null, funktion: null } };
  for (const w of ["Registernummer", "Funktion des Vertreters"]) ok(S.angebotPflichtFehlen(leer).some((x) => x.includes(w)), `fehlt gemeldet: ${w}`, S.angebotPflichtFehlen(leer));
  ok(S.angebotPflichtFehlen(D).length === 0, "vollständig → annehmbar", S.angebotPflichtFehlen(D));
  ok(S.angebotPflichtFehlen({ ...D, pruefbericht: null }).some((x) => x.includes("Prüfbericht")), "ohne Prüfbericht gesperrt");
  ok(S.angebotPflichtFehlen({ ...D, buergin: { ...BUERGIN_VOLL, bestaetigt: false } }).length === 1, "nur „bestätigt“ fehlt → genau ein Grund");
  ok(S.angebotPflichtFehlen({ ...D, buergin: { ...BUERGIN_VOLL, bestaetigtGrundlage: null } }).length === 1, "nur die Grundlage fehlt → genau ein Grund");
  ok(S.buerginOhneNummer(BUERGIN_VOLL) && !S.buerginOhneNummer(BUERGIN_MIT_NUMMER) && !S.buerginOhneNummer({ registernummer: null }), "„nicht erforderlich“ wird erkannt, leer und Nummer nicht");
  ok(V.angebotText(leer, AUS).includes("[noch einzutragen: Registernummer]"), "Lücke im Text sichtbar statt erfunden");
  // Endabnahme 01.10.2026: Annahme und Versand sind zwei Dinge — ohne Registernachweis bleibt der Link im Haus.
  const sperreVoll = S.angebotVersandSperre(BUERGIN_VOLL);
  ok(S.angebotPflichtFehlen(D).length === 0 && typeof sperreVoll === "string" && /Registernachweis/.test(sperreVoll) && /Active/.test(sperreVoll), "„nicht erforderlich“: annehmbar, aber Versand gesperrt (Registernachweis fehlt)", sperreVoll);
  const sperreSs4 = S.angebotVersandSperre({ ...BUERGIN_MIT_NUMMER, bestaetigtGrundlage: "EIN-Antrag SS-4, vorgelegt 01.10.2026" });
  ok(typeof sperreSs4 === "string" && /stützt sich nicht auf den Registerauszug/.test(sperreSs4) && /SS-4/.test(sperreSs4), "Nummer da, Grundlage nur SS-4 → Versand gesperrt", sperreSs4);
  ok(S.angebotVersandSperre({ ...BUERGIN_MIT_NUMMER, bestaetigtGrundlage: "Registerauszug (Sunbiz) vom 01.10.2026, Status Active" }) === null, "Nummer + Registerauszug → Versand frei");
  ok(S.angebotVersandSperre({ ...BUERGIN_MIT_NUMMER, bestaetigt: false, bestaetigtGrundlage: "Sunbiz-Auszug vom 01.10.2026" }) !== null, "ohne Haken bleibt der Versand gesperrt");
  ok(S.angebotVersandSperre({ ...S.BUERGIN_VORGABE, registernummer: null }) !== null, "leere Nummer → Versand gesperrt");
}

titel("5. Prüfbericht — echtes Ergebnis");
{
  ok(S.pruefberichtErgebnis(PB).satz.startsWith("Prüfung bestanden — keine Ausschlussgründe festgestellt.") && S.pruefberichtErgebnis(PB).bestanden, "bestanden nur mit gemessenem Abgleich ohne Treffer");
  // Gegenprüfung 01.10.2026: Solange die PEP-Erklärung aussteht, nennt der Ergebnis-Satz die Auflagen — das Ergebnis selbst bleibt.
  ok(/Auflagen dieses Berichts: Identifizierung anhand des Reisepasses und PEP-Erklärung/.test(S.pruefberichtErgebnis(PB).satz), "„bestanden“ nennt die Auflagen (Identifizierung, PEP) im selben Satz", S.pruefberichtErgebnis(PB).satz);
  ok(S.pruefberichtErgebnis({ ...PB, pep: { status: "erklaert", text: "x" }, auflagen: [] }).satz === "Prüfung bestanden — keine Ausschlussgründe festgestellt.", "ohne offene Auflagen: der schlichte Satz");
  ok(!S.pruefberichtErgebnis({ ...PB, sanktionen: null }).bestanden && /steht noch aus/.test(S.pruefberichtErgebnis({ ...PB, sanktionen: null }).satz), "ohne Abgleich: „steht noch aus“, nie „bestanden“");
  const mitTreffer = { ...PB, sanktionen: { ...PB.sanktionen!, listen: [{ ...PB.sanktionen!.listen[0], treffer: 1 }] } };
  ok(/Abklärung erforderlich/.test(S.pruefberichtErgebnis(mitTreffer).satz), "Treffer → „Abklärung erforderlich“");
  const b = S.pruefberichtBoniText(PB.boni!);
  ok(b.kopf === "Boni-Ampel: Grün, „Gute Lage“ — 82 von 100 Punkten.", "Kopf 1:1 aus der Ampel", b.kopf);
  ok(b.einordnung[0].includes("40 der 82 Punkte") && b.einordnung[0].includes("42 Punkte sind Standardannahmen") && b.einordnung[0].includes("Weder eine Bonitätsauskunft noch ein Kontoauszug"), "40 aus Angaben, 42 aus Annahmen, nichts belegt", b.einordnung[0]);
  ok(b.zeilen.length === 5 && b.zeilen.filter((z) => z.grundlage === "Annahme").length === 3, "fünf Teile, drei davon Annahme");
  const geschaetzt = S.pruefberichtBoniText({ ...PB.boni!, geschaetzt: true, deckel: "harter Befund", befunde: ["Rücklastschrift"] });
  ok(geschaetzt.einordnung.includes("Die Einschätzung beruht vor allem auf Annahmen.") && geschaetzt.einordnung.some((x) => x.includes("Rücklastschrift")), "geschätzt/Deckel/Befunde werden genannt");
  ok(!JSON.stringify(b).includes("Die Angaben sprechen für den Antrag"), "Ampel-Satz zur Privatkarte nicht übernommen");
}

titel("6. Frist, Meilenstein, Erstattung — Regeln");
{
  ok(JSON.stringify(A.angebotFristBerechnen({ bezahltAm: "2026-10-02", sofortBeginn: true, startAb: "2026-10-18", wochen: 12, hemmungTage: 0 })) === JSON.stringify({ beginn: "2026-10-02", ende: "2026-12-25" }), "sofort: ab Zahlung, zwölf Wochen");
  ok(JSON.stringify(A.angebotFristBerechnen({ bezahltAm: "2026-10-02", sofortBeginn: false, startAb: "2026-10-18", wochen: 12, hemmungTage: 0 })) === JSON.stringify({ beginn: "2026-10-18", ende: "2027-01-10" }), "ohne: ab Starttag nach der Widerrufsfrist");
  ok(A.angebotFristBerechnen({ bezahltAm: "2026-10-25", sofortBeginn: false, startAb: "2026-10-18", wochen: 12, hemmungTage: 5 }).ende === "2027-01-22", "Zahlung nach dem Starttag + Hemmung");
  const lage = { status: "angenommen", teil1Bezahlt: true, teil2: { bestell_ref: null, entfallen_am: null }, fristEnde: "2026-12-25", heute: "2026-11-01" };
  const gut = { art: "karte", datum: "2026-10-30", eingetragenAm: "2026-10-20", beleg: "Mitteilung des Instituts liegt im Dokumentenraum." };
  ok(A.meilensteinPruefen(lage, gut).ok, "Meilenstein: gültig");
  ok(!A.meilensteinPruefen({ ...lage, teil1Bezahlt: false }, gut).ok, "Meilenstein: nicht vor Zahlung Teil 1");
  ok(!A.meilensteinPruefen(lage, { ...gut, datum: "2026-11-05" }).ok, "Meilenstein: nicht in der Zukunft");
  ok(!A.meilensteinPruefen({ ...lage, heute: "2027-01-05" }, { ...gut, datum: "2026-12-30" }).ok, "Meilenstein: nicht nach Fristende");
  ok(A.meilensteinPruefen({ ...lage, heute: "2027-01-05" }, gut).ok, "Meilenstein vor Fristende darf auch danach eingetragen werden");
  ok(!A.meilensteinPruefen(lage, { ...gut, eingetragenAm: "2026-10-31" }).ok, "Meilenstein: Gesellschaft muss vorher eingetragen sein");
  ok(!A.meilensteinPruefen(lage, { ...gut, beleg: "kurz" }).ok, "Meilenstein: Beleg Pflicht");
  ok(!A.meilensteinPruefen({ ...lage, teil2: { bestell_ref: "X" } }, gut).ok, "Meilenstein: nur einmal");
  const el = { status: "angenommen", teil1Bezahlt: true, teil2: { bestell_ref: null }, fristEnde: "2026-12-25", heute: "2026-12-25", schon: false };
  ok(!A.erstattungPruefen(el).ok, "Erstattung: nicht am letzten Tag der Frist");
  ok(A.erstattungPruefen({ ...el, heute: "2026-12-26" }).ok, "Erstattung: ab dem Tag nach Fristende");
  ok(!A.erstattungPruefen({ ...el, heute: "2026-12-26", teil2: { bestell_ref: "X" } }).ok, "Erstattung: nicht nach Meilenstein");
  ok(!A.erstattungPruefen({ ...el, heute: "2026-12-26", teil1Bezahlt: false }).ok, "Erstattung: nur wenn Teil 1 bezahlt");
  ok(!A.erstattungPruefen({ ...el, heute: "2026-12-26", schon: true }).ok, "Erstattung: nur einmal");
  // Gegenprüfung 01.10.2026: Die Ruhezeit wird gerechnet (Ziffer 6 Absatz 3) — Aufforderung + sieben Tage bis zur Mitwirkung.
  const H = (e: Partial<Parameters<typeof A.hemmungRechnen>[0]>) => A.hemmungRechnen({ aufgefordertAm: "2026-11-01", erbrachtAm: null, heute: "2026-11-20", bisher: null, ...e });
  ok(!H({ aufgefordertAm: "2026-11-18" }).ok && /Aufforderungsfrist/.test((H({ aufgefordertAm: "2026-11-18" }) as any).error), "Hemmung: innerhalb der sieben Tage ruht nichts");
  ok(JSON.stringify(H({ erbrachtAm: "2026-11-12" })) === JSON.stringify({ ok: true, von: "2026-11-08", bis: "2026-11-11", tage: 4 }), "Hemmung: ab Tag 8 nach der Aufforderung bis zum Tag vor der Mitwirkung", H({ erbrachtAm: "2026-11-12" }));
  ok(JSON.stringify(H({})) === JSON.stringify({ ok: true, von: "2026-11-08", bis: "2026-11-20", tage: 13 }), "Hemmung: Mitwirkung offen → bis heute", H({}));
  ok(!H({ erbrachtAm: "2026-11-05" }).ok, "Hemmung: Mitwirkung vor Ablauf der Aufforderungsfrist → keine Ruhezeit");
  ok(!H({ erbrachtAm: "2026-11-08" }).ok, "Hemmung: Mitwirkung am Tag nach Ablauf → kein Tag");
  ok(JSON.stringify(H({ bisher: "2026-11-10", erbrachtAm: "2026-11-12" })) === JSON.stringify({ ok: true, von: "2026-11-11", bis: "2026-11-11", tage: 1 }), "Hemmung: schon gezählte Tage zählen nicht noch einmal");
  ok(!H({ bisher: "2026-11-11", erbrachtAm: "2026-11-12" }).ok, "Hemmung: alles schon gezählt → kein Tag dazu");
  ok(!H({ aufgefordertAm: "2026-11-25" }).ok && !H({ erbrachtAm: "2026-11-30" }).ok, "Hemmung: keine Daten in der Zukunft");
}

titel("7. Token, Parameter, Katalog");
{
  const t = A.angebotTokenErzeugen("FIAON-IA-ABC123", "2026-10-15");
  ok(A.angebotTokenPruefen(t)?.urteil === "gueltig" && A.angebotTokenPruefen(t)?.ref === "FIAON-IA-ABC123", "Token gültig, an die Referenz gebunden");
  ok(A.angebotTokenPruefen(t.slice(0, -1) + (t.endsWith("0") ? "1" : "0")) === null, "verändertes Token → ungültig");
  ok(A.angebotTokenPruefen(A.angebotTokenMitAblauf("FIAON-IA-ABC123", Date.now() - 1000))?.urteil === "abgelaufen", "abgelaufenes Token erkannt");
  ok(A.angebotTokenPruefen("FIAON-IA-ABC124" + t.slice("FIAON-IA-ABC123".length)) === null, "Token einer anderen Referenz passt nicht");
  ok(S.angebotParameterFehler(S.ANGEBOT_VORGABEN) === null, "Vorgaben gültig");
  ok(S.angebotParameterFehler({ ...S.ANGEBOT_VORGABEN, fristWochen: 40 }) !== null, "Frist über dem Wortlaut abgelehnt");
  ok(S.zahlwort(12) === "zwölf" && S.zahlwort(14) === "vierzehn" && S.zahlwort(7) === "sieben", "Zahlwörter");
  const k = paket("global_individuell");
  ok(k?.art === "global" && k.abo === false && k.eingestellt === true && istAngebotsPaket("global_individuell"), "Katalog: global, kein Abo, nicht im Verkauf, Preis je Angebot");
  ok(!verkaufbarePakete().some((p) => p.key === "global_individuell") && PAKET_PREISE_EURO.global_individuell === undefined, "nie in Auswahl oder Preisliste");
  ok(katalogpreisCents({ ref: "FIAON-X", type: "business", pack_key: "global_individuell" }) === null, "kein Katalogpreis ableitbar");
  ok(PAKETE.filter((p) => p.preisJeAngebot).every((p) => p.preisCents === 0), "preisCents 0 nur als Marke");
  ok(S.angebotRechnungsText({ angebotRef: "FIAON-IA-X", nr: 1, auftragRef: "R1" }).beschreibung.includes("Teil 1 von 2") && S.angebotRechnungsText({ angebotRef: "FIAON-IA-X", nr: 2, auftragRef: "R1", meilensteinArt: "karte", meilensteinAm: "2026-11-02" }).beschreibung.includes("Teil 2 von 2"), "Rechnungstext je Teil");
}

titel("8. Die fünf Mails");
{
  const nutzlast: Record<string, string> = {
    email: "w@example.de", sprache: "de", anrede_zeile: "Guten Tag Herr Hildbrand", firma: "William Hildbrand", paket: "FIAON Global – Individualangebot, Teil 1: Gründung",
    betrag_text: "4.650,00 €", antrag_id: "FIAON-ABC-1234", payment_reference: "FIAON-ABC123", faellig_am_text: "01.10.2026",
    zahlungsseite_url: "https://www.fiaon.com/zahlung/FIAON-ABC123?bereich=business", mein_auftrag_url: "https://www.fiaon.com/business/auftrag/X?t=y",
    ansprechpartner: "Daniel Stripling", unterlagen_liste: "· Reisepass", angebot_ref: "FIAON-IA-ABC123", teil1_text: "4.650,00 €", teil2_text: "6.850,00 €",
    gesamt_text: "11.500,00 €", frist_wochen_text: "zwölf", erstattung_tage_text: "vierzehn", teil2_ziel_text: "sieben", frist_beginn_text: "02.10.2026",
    frist_ende_text: "25.12.2026", buergin: "Schwarzott Global LLC", ereignis_text: "die erste Business-Kreditkarte für Ihre Gesellschaft freigeschaltet",
    ereignis_am_text: "02.11.2026", erstattung_bis_text: "08.01.2027",
    hemmung_von_text: "08.11.2026", hemmung_bis_text: "11.11.2026", hemmung_grund_text: "der Reisepass für die Identifizierung lag trotz Aufforderung nicht vor",
  };
  ok(Object.keys(GLOBAL_ANGEBOT_VORLAGEN).length === 6 && "global_angebot_hemmung" in GLOBAL_ANGEBOT_VORLAGEN, "sechs Vorlagen — mit der Mitteilung der Ruhezeit (Textform, Ziffer 6)");
  for (const ev of Object.keys(GLOBAL_ANGEBOT_VORLAGEN)) {
    const m = mailRendern(ev, nutzlast);
    ok(m && m.fehlend.length === 0, `${ev}: kein Platzhalter ohne Wert`, m?.fehlend);
    const text = (m?.text ?? "");
    const w = wandPruefen(text, ["aufgabe_an_betreuer", "rechnung_anhaengen"]);
    ok(w.length === 0, `${ev}: Wortwand`, w.map((x) => x.treffer));
    for (const r of GLOBAL_SCHAERFER) ok(!r.muster.test(text), `${ev}: ${r.grund.slice(0, 40)}`);
    ok(!text.includes(BANK.ibanDisplay) && !text.includes(BANK.iban), `${ev}: keine Bankdaten im Text`);
    ok(!/\b\d+\s*(Wochen|Tagen)\b/.test(text), `${ev}: keine Frist mit Ziffer`);
  }
  ok(mailRendern("global_angebot_start", nutzlast)!.text.includes("25.12.2026"), "Startmail nennt das Fristende als Datum (Textform, Ziffer 6)");
  // Nachtrag (h) + Gegenprüfung: Die Startmail verlangt keine Unterlagen — nur den Reisepass.
  const startText = mailRendern("global_angebot_start", { ...nutzlast, unterlagen_liste: "· Adressnachweis, nicht älter als drei Monate<br />· der gewünschte Name der US-Gesellschaft in drei Varianten" })!.text;
  ok(!/Adressnachweis|drei Varianten|halten Sie .* bereit/.test(startText) && /nichts vorbereiten/.test(startText) && /Reisepass/.test(startText), "Startmail des Individualangebots: nichts vorbereiten, nur Reisepass");
  const hemmText = mailRendern("global_angebot_hemmung", nutzlast)!.text;
  ok(/08\.11\.2026/.test(hemmText) && /11\.11\.2026/.test(hemmText) && /25\.12\.2026/.test(hemmText) && !/\d+ Tage/.test(hemmText), "Hemmungs-Mail: Ruhezeit und neues Fristende als Daten, keine Tageszahl");
  // Nachtrag (h): Die Unterlagenliste des Individualangebots kennt nur den Reisepass.
  const { globalUnterlagenListe, globalEtappeText } = await import("../shared/fiaon-global-bereich");
  ok(globalUnterlagenListe(true, true).length === 1 && globalUnterlagenListe(true, true)[0].art === "reisepass" && globalUnterlagenListe(true).length === 4, "Unterlagenliste: Individualangebot nur Reisepass, Privatauftrag wie bisher");
  ok(/laden hier nur Ihren Reisepass hoch/.test(globalEtappeText(1, "de", true).text) && /laden Sie auf dieser Seite hoch/.test(globalEtappeText(1, "de").text), "Etappe 1 beim Individualangebot: nur der Reisepass");
}

console.log(`\nTeil 1: ${n - fehler} von ${n} Prüfungen grün.`);

// ═══ TEIL 2 — LOKAL ════════════════════════════════════════════════════════
if (LOKAL) {
  const BASIS = process.env.PRUEF_BASIS || "http://127.0.0.1:5287";
  const FOTOS = process.env.PRUEF_FOTOS || "reports/bilder-individualangebot";
  const VORSCHAU = path.join(FOTOS, "..", "vorschau");
  fs.mkdirSync(FOTOS, { recursive: true }); fs.mkdirSync(VORSCHAU, { recursive: true });
  const { sqlPool } = await import("../server/lib/db-pool");
  const { pdfText } = await import("../server/lib/fiaon-pdf-lesen");
  const { berlinToday } = await import("../server/lib/fiaon-time");
  // Je Lauf und Fall eine eigene Dokumentations-Adresse (RFC 5737): Die Drossel des Servers zählt je IP
  // über Läufe hinweg — ein Prüfstand darf nicht dieselben Merkmale benutzen (AGENTS.md).
  const LAUF = Math.floor(Math.random() * 200);
  const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15";
  const ipFuer = (fall: number) => `198.51.100.${(LAUF + fall * 7) % 250 + 1}`;
  const menschFuer = (fall: number) => ({ "x-forwarded-for": ipFuer(fall), "user-agent": UA });
  const MENSCH = menschFuer(0);
  const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const heute = berlinToday();
  const plus = (iso: string, t: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + t); return d.toISOString().slice(0, 10); };

  // Leitung: Admin-Tor wie im Haus (Code aus dem Code-Fallback; lokal ohne ADMIN_ACCESS_CODE).
  const tor = await fetch(`${BASIS}/api/fiaon/zugang/oeffnen`, { method: "POST", headers: { "Content-Type": "application/json", ...MENSCH }, body: JSON.stringify({ code: process.env.PRUEF_ADMIN_CODE || "20032017" }) });
  const cookie = (tor.headers.get("set-cookie") || "").split(";")[0];
  ok(tor.ok && cookie.startsWith("fiaon_admin="), "Admin-Tor lokal geöffnet");
  const admin = async (pfad: string, body?: unknown, methode = body === undefined ? "GET" : "POST") => {
    const r = await fetch(`${BASIS}/api/fiaon${pfad}`, { method: methode, headers: { "Content-Type": "application/json", cookie, ...MENSCH }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, j: await r.json().catch(() => ({})) as any };
  };
  const kunde = async (token: string, q = "") => {
    const r = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}${q}`, { headers: MENSCH });
    return { status: r.status, j: await r.json().catch(() => ({})) as any };
  };
  const annehmen = async (token: string, body: unknown, kopf: Record<string, string> = MENSCH) => {
    const r = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(token)}/annehmen`, { method: "POST", headers: { "Content-Type": "application/json", ...kopf }, body: JSON.stringify(body) });
    return { status: r.status, j: await r.json().catch(() => ({})) as any };
  };
  const pdf = async (url: string) => { const r = await fetch(`${BASIS}${url}`, { headers: { cookie, ...MENSCH } }); return { status: r.status, buf: Buffer.from(await r.arrayBuffer()) }; };
  const nurText = (s: string) => s.replace(/\s+/g, " ");
  const tokenAus = (link: string) => decodeURIComponent(link.split("/business/angebot/")[1] || "");
  const stempel = Date.now().toString(36);
  const anlegen = async (suffix: string, extra: Record<string, unknown> = {}) => {
    const erg = await A.angebotAnlegen({
      kunde: { anrede: "Herr", vorname: "Prüfperson", nachname: `Angebot ${suffix}`, geburtsdatum: "1971-11-04", strasse: "Prüfweg 1", plz: "69251", ort: "Gaiberg", land: "DE", email: `pruef-angebot-${suffix}-${stempel}@fiaon.test`, telefon: "+49 171 0000000" },
      parameter: S.ANGEBOT_VORGABEN, pruefbericht: PB, ...extra,
    }, "Prüfstand pruef-individualangebot");
    if (!erg.ok) throw new Error(`anlegen ${suffix}: ${erg.error}`);
    return { id: erg.id, ref: erg.ref, token: tokenAus(erg.link) };
  };
  const zeile = async (ref: string) => ((await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${ref}`) as any[])[0];
  const angebotZeile = async (id: number) => ((await sqlPool`SELECT * FROM fiaon_global_angebote WHERE id = ${id}`) as any[])[0];
  const teile = async (id: number) => (await sqlPool`SELECT * FROM fiaon_global_angebot_teile WHERE angebot_id = ${id} ORDER BY nr`) as any[];
  const markPaid = async (zweck: string) => admin(`/admin/payments/${encodeURIComponent(zweck)}/mark-paid`, {});
  const bisDa = async (frage: () => Promise<boolean>, ms = 15000) => { const ende = Date.now() + ms; while (Date.now() < ende) { if (await frage()) return true; await warte(300); } return false; };

  // ── A: ohne sofortigen Beginn — Pflichtfelder, Hash, Roboter, Leitung, Doppelklick, Zahlung, Start, Meilenstein, Teil 2 ──
  titel("A1. Pflichtfelder sperren die Annahme (409), Leitung trägt ein");
  const a = await anlegen("a");
  let s1 = await kunde(a.token, "?sofortBeginn=0&jahresbetreuung=0");
  ok(s1.status === 200 && s1.j.annahmeBereit === false && /vervollständigt/.test(s1.j.gesperrtGrund), "Kunde sieht das Angebot, Annahme gesperrt", s1.j.gesperrtGrund);
  let r = await annehmen(a.token, { textHash: s1.j.textHash, sofortBeginn: false, jahresbetreuung: false });
  ok(r.status === 409 && r.j.code === "PFLICHTFELDER", "POST ohne Pflichtfelder → 409", r);
  let l = await admin("/admin/global/angebote");
  const zeileA = (l.j.angebote as any[]).find((x) => x.id === a.id);
  ok(zeileA && zeileA.fehlt.length >= 2 && zeileA.annahmeBereit === false && zeileA.link, "Liste der Leitung nennt, was fehlt", zeileA?.fehlt);
  r = await admin(`/admin/global/angebote/${a.id}`, { buergin: { unterzeichnetAm: heute, bestaetigt: true } }, "PUT");
  ok(r.status === 200 && r.j.fehlt.length === 1 && /Grundlage/.test(r.j.fehlt[0]), "ohne Grundlage der Bestätigung bleibt ein Punkt offen", r.j);
  r = await admin(`/admin/global/angebote/${a.id}`, { buergin: { registernummer: "L26000000001", funktion: "Manager", unterzeichnetAm: heute, bestaetigt: true, bestaetigtGrundlage: "Registerauszug vom 01.10.2026" } }, "PUT");
  ok(r.status === 200 && r.j.fehlt.length === 0, "Pflichtfelder eingetragen → annehmbar", r.j);
  r = await admin("/admin/global/angebote", { kunde: { vorname: "X", nachname: "Y", geburtsdatum: "1970-01-01", strasse: "Weg 1", plz: "12345", ort: "Ort", land: "DE", email: `pruef-angebot-api-${stempel}@fiaon.test` }, pruefbericht: { boni: { punkte: 100 } } });
  ok(r.status === 200 && (await angebotZeile(r.j.id)).pruefbericht === null, "Prüfbericht kommt nie aus dem Formular der Leitung", r.j);
  if (r.j.id) await admin(`/admin/global/angebote/${r.j.id}/zurueckziehen`, { grund: "Prüfstand: nur Formulartest" });

  titel("A2. Prüfsumme, Roboter, Leitung, Annahme mit Doppelklick");
  const s0 = await kunde(a.token, "?sofortBeginn=0&jahresbetreuung=0");
  const sJ = await kunde(a.token, "?sofortBeginn=0&jahresbetreuung=1");
  ok(s0.j.annahmeBereit === true && s0.j.textHash !== sJ.j.textHash, "Haken ändert Text und Prüfsumme");
  ok(JSON.stringify(sJ.j.uebersicht).includes("Jahresbetreuung ab dem zweiten Jahr: 699 €") && JSON.stringify(s0.j.uebersicht).includes("nicht gebucht"), "Bestellübersicht folgt dem Haken");
  r = await annehmen(a.token, { textHash: sJ.j.textHash, sofortBeginn: false, jahresbetreuung: false });
  ok(r.status === 409 && r.j.code === "GEAENDERT", "falsche Prüfsumme → 409 „neu laden“", r);
  r = await annehmen(a.token, { textHash: s0.j.textHash }, { "user-agent": "Mozilla/5.0 HeadlessChrome/140.0", "x-forwarded-for": ipFuer(9) });
  ok(r.status === 403, "Roboter-Kennung → 403", r);
  r = await annehmen(a.token, { textHash: s0.j.textHash }, { "user-agent": MENSCH["user-agent"] });
  ok(r.status === 403, "von der Maschine selbst (127.0.0.1) → 403", r);
  r = await annehmen(a.token, { textHash: s0.j.textHash }, { ...MENSCH, cookie });
  ok(r.status === 403 && /Chefbüro/.test(r.j.error), "mit Admin-Cookie → 403 (nur der Kunde nimmt an)", r);
  const sl = await kunde(a.token, ""); // ohne Cookie → kein Vorschau-Banner
  ok(sl.j.vorschauLeitung === undefined, "Kunde ohne Cookie sieht keine Leitungsvorschau");
  const lv = await fetch(`${BASIS}/api/fiaon/global/angebot/${encodeURIComponent(a.token)}`, { headers: { cookie, ...MENSCH } }).then((x) => x.json());
  ok(lv.vorschauLeitung === true && lv.annahmeBereit === false, "mit Cookie: Vorschau ohne Annahmeknopf");
  const [p1, p2] = await Promise.all([
    annehmen(a.token, { textHash: s0.j.textHash, sofortBeginn: false, jahresbetreuung: false }),
    annehmen(a.token, { textHash: s0.j.textHash, sofortBeginn: false, jahresbetreuung: false }),
  ]);
  ok(p1.status === 200 && p2.status === 200 && p1.j.auftragRef && p1.j.auftragRef === p2.j.auftragRef, "Doppelklick: beide 200, derselbe Auftrag", [p1.status, p2.status, p1.j.auftragRef, p2.j.auftragRef, p1.j.error, p2.j.error]);
  const p3 = await annehmen(a.token, { textHash: s0.j.textHash, sofortBeginn: false, jahresbetreuung: false });
  ok(p3.status === 200 && p3.j.schon === true && p3.j.auftragRef === p1.j.auftragRef, "dritter Klick später: dieselbe Antwort", p3);
  const ref1 = String(p1.j.auftragRef);
  const zahlA = (await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE pack_key = 'global_individuell' AND LOWER(email) = ${`pruef-angebot-a-${stempel}@fiaon.test`}`) as any[];
  ok(zahlA[0].n === 1, "genau EINE Bestellzeile", zahlA[0].n);

  titel("A3. Annahme gespeichert, Akte, Bestellung Teil 1");
  const aZ = await angebotZeile(a.id);
  ok(aZ.status === "angenommen" && aZ.ip === ipFuer(0) && /Safari/.test(aZ.user_agent) && aZ.text_hash === s0.j.textHash && aZ.angenommen_am, "Zeitpunkt, IP, Browser und Prüfsumme gespeichert");
  const t1 = (await teile(a.id))[0];
  ok(t1.bestell_ref === ref1 && Number(t1.betrag_cents) === 465000, "Teil 1 an die Bestellzeile gebunden");
  const b1 = await zeile(ref1);
  ok(b1.pack_key === "global_individuell" && b1.pack_name === "FIAON Global – Individualangebot, Teil 1: Gründung" && Number(b1.amount_due) === 4650 && b1.payment_status === "pending_payment", "Bestellzeile: Schlüssel, Name, 4.650,00 €, offen", { pack: b1.pack_key, name: b1.pack_name, betrag: b1.amount_due, st: b1.payment_status });
  ok(b1.payment_due_date && berlinToday(new Date(b1.payment_due_date)) === heute, "Zahlungsziel sofort (heute)", b1.payment_due_date);
  ok(/^FIAON-INV-\d{4}-\d{5}$/.test(String(b1.invoice_number)), "Rechnungsnummer aus dem einen Nummernkreis", b1.invoice_number);
  ok(!b1.company_name && b1.first_name === "Prüfperson", "Privatperson: kein Firmenname an der Bestellung");
  // Gegenprüfung 01.10.2026: Ziffer 15 schließt die AGB aus — die Akte behauptet keine AGB-Zustimmung; der Vertrag gilt als angenommen.
  ok(b1.consent_agb !== true && b1.consent_contract === true, "Bestellzeile: keine AGB-Zustimmung behauptet, Vertrag angenommen", { agb: b1.consent_agb, vertrag: b1.consent_contract });
  {
    const { fehlendeZustimmungen, fehlendeFelder } = await import("../server/lib/fiaon-antrag-vollstaendig");
    ok(!fehlendeZustimmungen(b1).includes("Zustimmung zu den AGB") && !fehlendeFelder(b1).includes("Zustimmung zu den AGB") && fehlendeZustimmungen({ ...b1, pack_key: "global_struktur" }).includes("Zustimmung zu den AGB"), "Vollständigkeit: beim Individualangebot fehlt keine AGB-Zustimmung (bei anderen Paketen schon)", fehlendeZustimmungen(b1));
    const [sq] = (await sqlPool.unsafe(`SELECT ${(await import("../server/lib/fiaon-antrag-vollstaendig")).fehlendeZustimmungenAusdruckSql("a")} AS z FROM fiaon_applications a WHERE a.ref = $1`, [ref1])) as any[];
    ok(!String(sq?.z ?? "").includes("AGB"), "Vollständigkeit (SQL): dieselbe Regel", sq);
  }
  // Gegenprüfung: Der Chef-Knopf „Daten aus dem Antrag holen" lebt (primary_email/primary_phone).
  {
    const vb = await admin(`/admin/global/angebote/vorbelegung?personId=${Number(b1.person_id)}`);
    ok(vb.status === 200 && vb.j.ok && vb.j.kunde?.vorname === "Prüfperson" && vb.j.kunde?.email === `pruef-angebot-a-${stempel}@fiaon.test` && vb.j.kunde?.plz === "69251", "Vorbelegung liefert Name, Anschrift, E-Mail aus dem jüngsten Antrag", vb);
    ok((await admin("/admin/global/angebote/vorbelegung?personId=999999999")).status === 404, "Vorbelegung: unbekannte Person → 404");
  }
  const akte = ((await sqlPool`SELECT * FROM fiaon_global_auftraege WHERE ref = ${ref1}`) as any[])[0];
  ok(akte && Number(akte.angebot_id) === a.id && akte.paket_key === "global_individuell" && akte.quelle === "individualangebot" && akte.doc_hash === s0.j.textHash && akte.vertrag_pdf, "Akte mit Angebot, Prüfsumme und Vertrag");
  ok(JSON.parse(typeof akte.bestaetigungen === "string" ? akte.bestaetigungen : JSON.stringify(akte.bestaetigungen)).sofortBeginn === false, "Akte: kein sofortiger Beginn vermerkt");
  ok(JSON.parse(typeof akte.firma === "string" ? akte.firma : JSON.stringify(akte.firma)).art === "privat", "Akte: Privatperson");
  // Endabnahme 01.10.2026: Annahme und Versand sind zwei Dinge — die Liste der Leitung trägt den Grund (direkt aus der Bibliothek,
  // damit der Prüfstand nicht am Stand des laufenden Servers hängt).
  {
    const liste = await A.angebotListe();
    const zA = liste.find((x: any) => Number(x.id) === a.id) as any;
    ok(zA && zA.versandSperre === null, "Liste der Leitung: Nummer + Registerauszug → Versand frei", zA?.versandSperre);
  }
  // Endabnahme 01.10.2026: Ein Meta-Lead an der Person — und trotzdem darf die Zahlung NICHTS an Meta melden (Nachtrag d).
  // Erst die Gegenprobe: Mit diesem Lead WÜRDE die Lead-Stufe gefunden (sonst wäre die Prüfung unten leer).
  const metaLeadId = `9${Date.now()}${LAUF}`;
  await sqlPool`INSERT INTO fiaon_leads (vorname, nachname, email, quelle, person_id, meta_lead_id) VALUES ('Prüfperson', 'Lead', ${`pruef-angebot-a-${stempel}@fiaon.test`}, 'pruefstand', ${Number(b1.person_id)}, ${metaLeadId})`;
  {
    const { crmEreignis } = await import("../server/lib/fiaon-meta-capi");
    const probe = await crmEreignis("qualified_lead", { ref: `PRUEF-ENDFIX-${stempel}`, personId: Number(b1.person_id) });
    ok(probe === "eingereiht", "Gegenprobe: Die Lead-Stufe würde über die Person gefunden (CRM-Schalter an)", probe);
    await sqlPool`DELETE FROM fiaon_meta_capi WHERE ereignis_id = ${`qualified_lead.${metaLeadId}`}`;
  }

  titel("A4. PDF-Inhalte: Vertrag mit Annahmevermerk, Rechnung Teil 1, Prüfbericht");
  const vt = nurText(await pdfText(Buffer.from(akte.vertrag_pdf)));
  for (const w of ["Angenommen durch Klick auf", "Zahlungspflichtig annehmen", ipFuer(0), s0.j.textHash.slice(0, 24), "Anlage 1 — Bürgschaftszusage", "Anlage 2 — Prüfbericht", "Anlage 3 — Widerrufsbelehrung", "4.650,00 €", "6.850,00 €", "11.500,00 €", "Der Auftraggeber hat nicht verlangt", "L26000000001", "Muster-Widerrufsformular"]) ok(vt.includes(w), `Vertrags-PDF enthält „${w}“`);
  ok(!vt.includes("nicht angenommen"), "Ausfertigung ohne Entwurfs-Wasserzeichen");
  fs.writeFileSync(path.join(FOTOS, "vertrag-angenommen.pdf"), Buffer.from(akte.vertrag_pdf));
  const mt = new URL(`http://x${p1.j.vertragUrl}`).searchParams.get("t");
  const rp = await pdf(`/api/fiaon/global/auftrag/${encodeURIComponent(ref1)}/rechnung.pdf?t=${encodeURIComponent(String(mt))}`);
  const rt = nurText(await pdfText(rp.buf));
  ok(rp.status === 200 && rt.includes("Teil 1 von 2") && rt.includes("4.650,00") && rt.includes(String(b1.invoice_number)) && rt.includes(BANK.ibanDisplay.replace(/\s/g, " ")), "Rechnung Teil 1: Text, Betrag, Nummer, Bank aus shared/fiaon-bank.ts", rt.slice(0, 600));
  const faelligDe = heute.split("-").reverse().join(".");
  ok(rt.includes(faelligDe) && rt.includes("einmalig"), "Rechnung Teil 1: Zahlungsziel heute, einmalig", faelligDe);
  fs.writeFileSync(path.join(FOTOS, "rechnung-teil1.pdf"), rp.buf);
  const ep = await pdf(`/api/fiaon/global/angebot/${encodeURIComponent(a.token)}/pruefbericht.pdf`);
  const et = nurText(await pdfText(ep.buf));
  ok(ep.status === 200 && et.includes("Prüfung bestanden") && et.includes("40 der 82 Punkte") && et.includes("42 Punkte"), "Prüfbericht als PDF mit echtem Ergebnis");
  const vp = await pdf(`/api/fiaon/global/angebot/${encodeURIComponent(a.token)}/vertrag.pdf`);
  ok(vp.status === 200 && nurText(await pdfText(vp.buf)).includes("Angenommen durch Klick"), "nach der Annahme liefert der Kundenlink die Ausfertigung");
  const zs = await pdf(`/zahlung/${b1.payment_reference}?bereich=business`);
  ok(zs.status === 200, "Zahlungsseite erreichbar");
  const za = await fetch(`${BASIS}/api/fiaon/payment-order/${encodeURIComponent(b1.payment_reference)}`, { headers: MENSCH }).then((x) => x.json()).catch(() => null);
  ok(za?.ok && za.packName === "FIAON Global – Individualangebot, Teil 1: Gründung" && Number(za.amountDue) === 4650 && za.firmenauftrag === true && za.bank?.iban, "Zahlungsseite: Teil-Titel, 4.650 €, Business-Rahmen, Bankdaten", za && { p: za.packName, b: za.amountDue, f: za.firmenauftrag });

  titel("A5. Nacharbeit: Aufgaben und Bestätigungsmail (Protokoll, nichts verschickt)");
  ok(await bisDa(async () => !!((await angebotZeile(a.id)).bestaetigung_mail_fehler || (await angebotZeile(a.id)).bestaetigung_mail_am)), "Bestätigungsmail versucht");
  const ml = (await sqlPool`SELECT event, status, grund, payload FROM fiaon_mail_log WHERE event = 'global_angebot_angenommen' AND empfaenger = ${`pruef-angebot-a-${stempel}@fiaon.test`} ORDER BY id DESC LIMIT 1`) as any[];
  ok(ml[0] && ml[0].status === "fehlgeschlagen" && /BREVO_API_KEY/.test(String(ml[0].grund)), "Mail im Protokoll: wäre rausgegangen, ohne Schlüssel nicht verschickt", ml[0]);
  const anh = (typeof ml[0]?.payload === "string" ? JSON.parse(ml[0].payload) : ml[0]?.payload)?.anhaenge ?? [];
  ok(anh.length === 2 && anh.some((x: string) => /Individualvereinbarung/.test(x)) && anh.some((x: string) => /\.pdf$/i.test(x)), "Anhänge: Vertrag + Rechnung", anh);
  const todos = (await sqlPool`SELECT schluessel, titel, zustaendig_art FROM fiaon_betreiber_todos WHERE schluessel IN (${`global:${ref1}:auftrag`}, ${`global:${ref1}:angebot-justin`})`) as any[];
  ok(todos.length === 2, "Aufgabe an die zuständige Person UND an Justin", todos);
  ok(todos.some((t) => t.schluessel.endsWith("angebot-justin") && t.zustaendig_art === "betreiber"), "Justins Aufgabe liegt beim Betreiber", todos);

  titel("A6. Zahlung Teil 1 → wartet auf die Widerrufsfrist, dann Start mit Frist");
  r = await markPaid(b1.payment_reference);
  ok(r.status === 200, "Teil 1 gebucht (mark-paid)", r.j);
  ok(await bisDa(async () => (await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${ref1}` as any[])[0].status === "bezahlt"), "Akte: bezahlt, nicht gestartet (ohne sofortigen Beginn)");
  ok((await angebotZeile(a.id)).frist_beginn === null, "Frist beginnt noch nicht");
  // Die Buchung läuft hinter der Antwort weiter (onCustomerPaid) — auf die Aufgabe warten, nicht raten.
  ok(await bisDa(async () => ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref1}:widerruf`}`) as any[])[0].n === 1), "Aufgabe „Start nach der Widerrufsfrist“");
  // Endabnahme 01.10.2026: kein Kauf, keine Lead-Stufe an Meta — trotz Meta-Lead an der Person (läuft im Server: onCustomerPaid).
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_meta_capi WHERE ref = ${ref1}`) as any[])[0].n === 0, "Zahlung Teil 1: keine Meldung an Meta (Nachtrag d, Ziffer 14) — braucht den Server im Stand der Endabnahme", await sqlPool`SELECT name, quelle FROM fiaon_meta_capi WHERE ref = ${ref1}`);
  const { globalWiderrufsfrist } = await import("../server/lib/fiaon-global-vertrag");
  const wf = globalWiderrufsfrist(new Date(aZ.angenommen_am));
  const st = await A.angebotNachZahlung(ref1, { jetzt: new Date(`${wf.startAb}T10:00:00+02:00`) });
  ok(st.gestartet, "am Starttag gestartet", st);
  const aZ2 = await angebotZeile(a.id);
  const fb = berlinToday(new Date(aZ2.frist_beginn)); const fe = berlinToday(new Date(aZ2.frist_ende));
  ok(fb === wf.startAb && fe === plus(wf.startAb, 84), "Frist: Beginn am Starttag, Ende nach zwölf Wochen", [fb, fe, wf.startAb]);
  const ms = (await sqlPool`SELECT status, payload FROM fiaon_mail_log WHERE event = 'global_angebot_start' AND empfaenger = ${`pruef-angebot-a-${stempel}@fiaon.test`} ORDER BY id DESC LIMIT 1`) as any[];
  const msp = typeof ms[0]?.payload === "string" ? JSON.parse(ms[0].payload) : ms[0]?.payload;
  ok(ms[0] && msp?.frist_ende_text === fe.split("-").reverse().join("."), "Startmail (Protokoll) nennt das Fristende", msp?.frist_ende_text);
  ok(ms[0] && /Reisepass/.test(String(msp?.unterlagen_liste)) && !/Adressnachweis|Varianten/.test(String(msp?.unterlagen_liste)), "Startmail-Nutzlast: Unterlagenliste nur Reisepass (Nachtrag h)", msp?.unterlagen_liste);
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref1}:start`} AND titel LIKE 'FIAON Global: Individualangebot starten%'`) as any[])[0].n === 1, "Aufgabe „Individualangebot starten“");
  r = await admin(`/admin/global/auftraege/${encodeURIComponent(ref1)}/stichtag`, { stichtag: plus(heute, 30), mitteilen: false });
  ok(r.status === 400 && /Individualangebot/.test(r.j.error), "Stichtag wird beim Individualangebot abgelehnt", r.j);

  titel("A7. Meilenstein → Rechnung Teil 2 (6.850,00 €, sieben Tage)");
  r = await admin(`/admin/global/angebote/${a.id}/meilenstein`, { art: "karte", datum: heute, eingetragenAm: heute, beleg: "kurz" });
  ok(r.status === 409 && /Beleg/.test(r.j.error), "ohne Beleg abgelehnt", r.j);
  r = await admin(`/admin/global/angebote/${a.id}/meilenstein`, { art: "karte", datum: heute, eingetragenAm: plus(heute, -3), beleg: "Freischaltung laut Mitteilung des Instituts, Scan im Dokumentenraum." });
  ok(r.status === 200 && r.j.ref2, "Meilenstein eingetragen", r.j);
  const ref2 = String(r.j.ref2);
  const b2 = await zeile(ref2);
  ok(b2 && Number(b2.amount_due) === 6850 && b2.pack_name === "FIAON Global – Individualangebot, Teil 2: Kapital-Begleitung" && b2.payment_status === "pending_payment", "Bestellzeile Teil 2", { b: b2?.amount_due, n: b2?.pack_name });
  ok(berlinToday(new Date(b2.payment_due_date)) === plus(heute, 7), "Teil 2 zahlbar binnen sieben Tagen", b2.payment_due_date);
  ok(String(b2.invoice_number) !== String(b1.invoice_number) && /^FIAON-INV-/.test(String(b2.invoice_number)), "eigene Rechnungsnummer");
  const r2 = await pdf(`/api/fiaon/admin/global/auftraege/${encodeURIComponent(ref2)}/rechnung.pdf`);
  const r2t = nurText(await pdfText(r2.buf));
  ok(r2.status === 200 && r2t.includes("Teil 2 von 2") && r2t.includes("6.850,00") && r2t.includes("Business-Kreditkarte"), "Rechnung Teil 2: Text und Betrag, kein Bankname des Instituts", r2t.slice(0, 400));
  fs.writeFileSync(path.join(FOTOS, "rechnung-teil2.pdf"), r2.buf);
  r = await admin(`/admin/global/angebote/${a.id}/meilenstein`, { art: "karte", datum: heute, eingetragenAm: heute, beleg: "Zweiter Versuch, darf nicht durchgehen, Prüfstand." });
  ok(r.status === 409, "Meilenstein nur einmal", r.j);
  const m2 = (await sqlPool`SELECT status FROM fiaon_mail_log WHERE event = 'global_angebot_teil2' AND empfaenger = ${`pruef-angebot-a-${stempel}@fiaon.test`}`) as any[];
  ok(m2.length === 1, "Mail mit Rechnung Teil 2 im Protokoll", m2);
  r = await admin(`/admin/global/angebote/${a.id}/erstattung`, {});
  ok(r.status === 409 && /Meilenstein/.test(r.j.error), "nach dem Meilenstein keine Erstattung", r.j);

  titel("A8. Datenbank-Wand (Migration 087) — in einer Transaktion, zurückgerollt");
  for (const [was, sql] of [
    ["Betrag Teil 2 auf 1 €", `UPDATE fiaon_applications SET amount_due = 1 WHERE ref = '${ref2}'`],
    ["neue Zeile ohne gebundenen Teil", `INSERT INTO fiaon_applications (ref, type, status, pack_key, amount_due, payment_status) VALUES ('FIAON-WAND-${stempel}', 'business', 'submitted', 'global_individuell', 4650, 'pending_payment')`],
  ] as const) {
    let wirft = "";
    await sqlPool.begin(async (tx: any) => { await tx.unsafe(sql).catch((e: any) => { wirft = String(e?.message || e); }); throw new Error("zurückrollen"); }).catch(() => {});
    ok(/Angebotsteil|angenommenen Teil/.test(wirft), `Wand wirft: ${was}`, wirft);
  }
  ok(Number((await zeile(ref2)).amount_due) === 6850, "nach der Rot-Probe unverändert");

  titel("A9. Zahlung Teil 2 → kein Start, keine „ohne Auftrag“-Meldung");
  r = await markPaid(b2.payment_reference);
  ok(r.status === 200, "Teil 2 gebucht", r.j);
  ok(await bisDa(async () => !!(await teile(a.id))[1].bezahlt_am), "Teil 2 als bezahlt vermerkt");
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_global_auftraege WHERE ref = ${ref2}`) as any[])[0].n === 0, "Teil 2 bekommt keine eigene Akte");
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref2}:ohne-auftrag`}`) as any[])[0].n === 0, "keine Aufgabe „Bestellung ohne Auftrag“");
  ok(await bisDa(async () => ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${ref1}:teil2-bezahlt`}`) as any[])[0].n === 1), "Aufgabe „Teil 2 bezahlt“");
  ok(((await sqlPool`SELECT payment_status FROM fiaon_applications WHERE ref = ${ref1}`) as any[])[0].payment_status === "paid", "Teil 1 bleibt bezahlt (keine Stilllegung durch Teil 2)");
  ok(((await sqlPool`SELECT status FROM fiaon_global_auftraege WHERE ref = ${ref1}`) as any[])[0].status === "gestartet", "Akte bleibt gestartet");
  const meinT = new URL(`http://x${p1.j.meinAuftrag}`).searchParams.get("t");
  const mein = await fetch(`${BASIS}/api/fiaon/global/mein-auftrag/${encodeURIComponent(ref1)}?t=${encodeURIComponent(String(meinT))}`, { headers: MENSCH }).then((x) => x.json());
  const ma = mein?.auftrag?.angebot;
  ok(ma && ma.teile.length === 2 && ma.teile.every((t: any) => t.stand === "bezahlt") && ma.teile[1].rechnungUrl && ma.fristEnde, "„Mein Auftrag“: Block mit beiden Teilen und Rechnung Teil 2", ma);
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_meta_capi WHERE ref IN (${ref1}, ${ref2})`) as any[])[0].n === 0, "Zahlung Teil 2: ebenfalls keine Meldung an Meta (Endabnahme)");

  titel("A10. Alte Links leben nicht länger als „gültig bis + sieben Tage“ (Endabnahme)");
  {
    // Ein Token wie vor der Verkürzung des Nachlaufs: Signatur gültig, exp weit in der Zukunft.
    const AUS_ = { sofortBeginn: false, jahresbetreuung: false };
    const altToken = A.angebotTokenMitAblauf(a.ref, Date.now() + 60 * 24 * 3600_000);
    const gbAlt = berlinToday(new Date(aZ.gueltig_bis));
    await sqlPool`UPDATE fiaon_global_angebote SET gueltig_bis = ${plus(heute, -8)}::date WHERE id = ${a.id}`;
    const alt = await A.angebotKundenSicht(altToken, AUS_);
    const altPdf = await A.angebotPdfFuerToken(altToken, "pruefbericht", AUS_);
    const altAn = await A.angebotAnnehmen(altToken, { textHash: "x" }, { ip: ipFuer(3), userAgent: UA, leitung: false });
    ok(alt.status === 410 && altPdf.status === 410 && altAn.status === 410, "acht Tage nach „gültig bis“: Seite, Prüfbericht-PDF und Annahme zu — obwohl der Token noch gilt", [alt.status, altPdf.status, altAn.status]);
    await sqlPool`UPDATE fiaon_global_angebote SET gueltig_bis = ${plus(heute, -6)}::date WHERE id = ${a.id}`;
    const noch = await A.angebotKundenSicht(altToken, AUS_);
    ok(noch.status === 200, "sechs Tage nach „gültig bis“: noch erreichbar", noch.status);
    await sqlPool`UPDATE fiaon_global_angebote SET gueltig_bis = ${gbAlt}::date WHERE id = ${a.id}`;
    ok(A.angebotTokenPruefen(A.angebotTokenErzeugen(a.ref, gbAlt))?.urteil === "gueltig" && A.angebotLinkSpaetestens("2026-10-15") === new Date("2026-10-22T21:59:59Z").getTime(), "Link aus dem Reiter: gültig bis + sieben Tage (15.10. → 22.10.2026, 23:59:59 MESZ)");
  }

  // ── B: mit sofortigem Beginn + Jahresbetreuung → Fristende → Tageslauf → Erstattung ──
  titel("B. Sofortiger Beginn, Fristende, Erstattung vormerken");
  const bA = await anlegen("b", { buergin: BUERGIN_VOLL });
  // Endabnahme 01.10.2026: Ein Meta-Lead mit derselben E-Mail wartet schon — die Annahme darf keine Lead-Stufe melden.
  await sqlPool`INSERT INTO fiaon_leads (vorname, nachname, email, quelle, meta_lead_id) VALUES ('Prüfperson', 'Lead B', ${`pruef-angebot-b-${stempel}@fiaon.test`}, 'pruefstand', ${`8${Date.now()}${LAUF}`})`;
  {
    const liste = await A.angebotListe();
    const zB = liste.find((x: any) => Number(x.id) === bA.id) as any;
    ok(zB && typeof zB.versandSperre === "string" && /Registernachweis/.test(zB.versandSperre), "Liste der Leitung: „nicht erforderlich“ → annehmbar, aber Versand gesperrt", zB?.versandSperre);
  }
  const sB = await kunde(bA.token, "?sofortBeginn=1&jahresbetreuung=1");
  r = await annehmen(bA.token, { textHash: sB.j.textHash, sofortBeginn: true, jahresbetreuung: true }, menschFuer(1));
  ok(r.status === 200 && r.j.sofortBeginn === true, "angenommen mit sofortigem Beginn", r.j);
  const refB = String(r.j.auftragRef);
  const pdfB = ((await sqlPool`SELECT vertrag_pdf FROM fiaon_global_angebote WHERE id = ${bA.id}`) as any[])[0]?.vertrag_pdf;
  const vB = pdfB ? nurText(await pdfText(Buffer.from(pdfB))) : "";
  ok(vB.includes("hat ausdrücklich verlangt") && vB.includes("699 € je Betreuungsjahr"), "PDF folgt den Haken (Wertersatz, Jahresbetreuung)");
  ok(((await sqlPool`SELECT jahresbetreuung FROM fiaon_global_auftraege WHERE ref = ${refB}`) as any[])[0].jahresbetreuung === true, "Akte: Jahresbetreuung gebucht");
  r = await admin(`/admin/global/angebote/${bA.id}/meilenstein`, { art: "kapital", datum: heute, eingetragenAm: heute, beleg: "Vor der Zahlung — muss abgelehnt werden, Prüfstand." });
  ok(r.status === 409 && /Teil 1/.test(r.j.error), "Meilenstein vor Zahlung Teil 1 abgelehnt", r.j);
  const bB = await zeile(refB);
  await markPaid(bB.payment_reference);
  ok(await bisDa(async () => !!(await angebotZeile(bA.id)).frist_ende), "sofort gestartet, Frist gesetzt");
  const bZ = await angebotZeile(bA.id);
  ok(berlinToday(new Date(bZ.frist_beginn)) === berlinToday(new Date(bB.completed_at ?? new Date())) || berlinToday(new Date(bZ.frist_beginn)) === heute, "Fristbeginn = Zahlungseingang", bZ.frist_beginn);
  r = await admin(`/admin/global/angebote/${bA.id}/erstattung`, {});
  ok(r.status === 409 && /Frist läuft bis/.test(r.j.error), "Erstattung vor Fristende abgelehnt", r.j);
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_meta_capi WHERE ref = ${refB}`) as any[])[0].n === 0, "B: Annahme und Zahlung ohne Meldung an Meta (Endabnahme) — braucht den Server im Stand der Endabnahme");
  // Gegenprüfung 01.10.2026: Ruhezeit gerechnet — Aufforderung + sieben Tage bis zum Tag vor der Mitwirkung; Mail in Textform im selben Schritt.
  r = await admin(`/admin/global/angebote/${bA.id}/hemmung`, { aufgefordertAm: heute, grund: "Reisepass trotz Aufforderung vom heutigen Tag nicht geliefert." });
  ok(r.status === 400 && /Aufforderungsfrist/.test(r.j.error), "Hemmung am Tag der Aufforderung abgelehnt (sieben Tage Frist)", r.j);
  r = await admin(`/admin/global/angebote/${bA.id}/hemmung`, { aufgefordertAm: plus(heute, -12), erbrachtAm: plus(heute, -2), grund: "Reisepass trotz Aufforderung erst nach Tagen geliefert (Prüfstand)." });
  ok(r.status === 200 && r.j.tage === 3 && r.j.von === plus(heute, -5) && r.j.bis === plus(heute, -3) && r.j.fristEnde === plus(berlinToday(new Date(bZ.frist_ende)), 3), "Ruhezeit gerechnet: drei Tage (Tag 8 bis Tag vor der Mitwirkung)", r.j);
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'global_angebot_hemmung' AND empfaenger = ${`pruef-angebot-b-${stempel}@fiaon.test`}`) as any[])[0].n === 1, "Mitteilung der Ruhezeit als Mail (Protokoll, Textform)");
  r = await admin(`/admin/global/angebote/${bA.id}/hemmung`, { aufgefordertAm: plus(heute, -12), erbrachtAm: plus(heute, -2), grund: "Zweiter Eintrag derselben Ruhezeit — darf nichts dazuzählen." });
  ok(r.status === 400 && /schon gezählt/.test(r.j.error), "dieselbe Ruhezeit zählt nicht doppelt", r.j);
  r = await admin(`/admin/global/angebote/${bA.id}/hemmung`, { aufgefordertAm: plus(heute, -9), grund: "Unterschrift unter das Operating Agreement fehlt noch (Prüfstand)." });
  ok(r.status === 200 && r.j.tage === 3 && r.j.bis === heute && (await angebotZeile(bA.id)).frist_hemmung_tage === 6, "offene Mitwirkung: ab dem Tag nach der letzten Ruhezeit bis heute", r.j);
  // Uhr vorstellen: das Fristende liegt gestern.
  await sqlPool`UPDATE fiaon_global_angebote SET frist_ende = ${plus(heute, -1)}::date WHERE id = ${bA.id}`;
  const lauf = await A.globalAngebotLauf();
  ok(lauf.fristende >= 1, "Tageslauf meldet das Fristende", lauf);
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${refB}:fristende`} AND zustaendig_art = 'betreiber'`) as any[])[0].n === 1, "dringende Aufgabe an Justin „Frist abgelaufen“");
  l = await admin("/admin/global/angebote");
  ok((l.j.angebote as any[]).find((x) => x.id === bA.id)?.knoepfe.erstattung === null, "Knopf „Erstattung vormerken“ frei (Server)");
  r = await admin(`/admin/global/angebote/${bA.id}/erstattung`, {});
  ok(r.status === 200 && /vorgemerkt/.test(r.j.meldung), "Erstattung vorgemerkt", r.j);
  const bB2 = await zeile(refB);
  ok(bB2.payment_status === "cancelled", "Teil 1 über den Storno-Weg storniert");
  const akB = ((await sqlPool`SELECT status, storno_erstattung FROM fiaon_global_auftraege WHERE ref = ${refB}`) as any[])[0];
  ok(akB.status === "storniert" && akB.storno_erstattung === true, "Akte: storniert mit Erstattung");
  ok((await teile(bA.id))[1].entfallen_am, "Teil 2 entfallen");
  const eT = ((await sqlPool`SELECT text, zustaendig_art, faellig_am FROM fiaon_betreiber_todos WHERE schluessel = ${`global:${refB}:erstattung`}`) as any[])[0];
  ok(eT && eT.zustaendig_art === "betreiber" && /bis spätestens/.test(eT.text) && /KEIN Geld/.test(eT.text), "Justin: „Erstattung veranlassen“ mit spätestem Datum, kein Geld bewegt", eT?.text?.slice(0, 300));
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_mail_log WHERE event = 'global_angebot_erstattung' AND empfaenger = ${`pruef-angebot-b-${stempel}@fiaon.test`}`) as any[])[0].n === 1, "Mail an den Kunden (Protokoll)");
  r = await admin(`/admin/global/angebote/${bA.id}/erstattung`, {});
  ok(r.status === 409, "Erstattung nur einmal", r.j);
  r = await admin(`/admin/global/angebote/${bA.id}/erstattung-ueberwiesen`, { am: heute, notiz: "Prüfstand-Überweisung 1" });
  ok(r.status === 200 && (await angebotZeile(bA.id)).erstattet_am, "Erstattung überwiesen eingetragen");

  // ── B2: Hängender Abschluss heilt sich — beim Lesen des Links und im Stundenlauf (Gegenprüfung 01.10.2026) ──
  titel("B2. Nacharbeit nachholen: Kundenlink und Stundenlauf");
  const zeilenVorher = ((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE pack_key = 'global_individuell' AND LOWER(email) = ${`pruef-angebot-a-${stempel}@fiaon.test`}`) as any[])[0].n;
  await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = 'Prüfstand: künstlich hängend' WHERE id = ${a.id}`;
  const heil = await kunde(a.token);
  ok(heil.status === 200 && heil.j.status === "angenommen" && heil.j.zahlungsseite && (await angebotZeile(a.id)).nacharbeit_fehler === null, "Kundenlink nach Fehler: Abschluss nachgeholt, Zahlungsseite da, Fehler gelöscht", { st: heil.status, z: heil.j.zahlungsseite, f: (await angebotZeile(a.id)).nacharbeit_fehler });
  await sqlPool`UPDATE fiaon_global_angebote SET nacharbeit_fehler = 'Prüfstand: künstlich hängend 2' WHERE id = ${a.id}`;
  const lauf2 = await A.globalAngebotLauf();
  ok(lauf2.nachgeholt >= 1 && (await angebotZeile(a.id)).nacharbeit_fehler === null, "Stundenlauf holt einen hängenden Abschluss nach", lauf2);
  ok(((await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_applications WHERE pack_key = 'global_individuell' AND LOWER(email) = ${`pruef-angebot-a-${stempel}@fiaon.test`}`) as any[])[0].n === zeilenVorher, "Nachholen legt keine weitere Bestellzeile an (Teil 1 und Teil 2 bleiben zwei)", zeilenVorher);

  // ── B3: Änderung durch die Leitung IM Sekundenfenster der Annahme (zwischen Lesen und Sichern) → „bitte neu laden" ──
  // Die Annahme läuft hier im Prüfstand-Prozess (derselbe Code wie hinter der Route), die Änderung trifft sie, während
  // Chromium das PDF druckt; die optimistische Sperre (updated_at) lässt die Annahme mit dem alten Text nicht durch.
  titel("B3. Änderung im Sekundenfenster der Annahme (optimistische Sperre)");
  const sA = await anlegen("sperre", { buergin: BUERGIN_VOLL });
  const sS = await kunde(sA.token);
  ok(sS.j.annahmeBereit === true, "Angebot „sperre“ annehmbar");
  {
    const lauf = A.angebotAnnehmen(sA.token, { textHash: sS.j.textHash, sofortBeginn: false, jahresbetreuung: false }, { ip: ipFuer(6), userAgent: UA, leitung: false });
    await warte(250);
    const ae = await A.angebotAendern(sA.id, { gueltigBis: plus(heute, 20) }, "Prüfstand (Änderung im Fenster)");
    ok(ae.ok, "Leitung ändert, während die Annahme druckt", ae);
    const rr = await lauf;
    ok(rr.status === 409 && rr.body.code === "GEAENDERT" && (await angebotZeile(sA.id)).status === "offen", "Annahme mit dem alten Stand → 409 „neu laden“, nichts angenommen, kein PDF gespeichert", { status: rr.status, body: rr.body, st: (await angebotZeile(sA.id)).status });
  }
  const sS2 = await kunde(sA.token);
  r = await annehmen(sA.token, { textHash: sS2.j.textHash }, menschFuer(6));
  ok(r.status === 200 && r.j.auftragRef, "nach dem Neuladen geht die Annahme", r);

  // ── C: falscher, abgelaufener, zurückgezogener Link; Ablauf der Gültigkeit ──
  titel("C. Falscher, abgelaufener und zurückgezogener Link");
  const cA = await anlegen("c");
  ok((await kunde(cA.token.slice(0, -2) + "zz")).status === 403, "falsche Signatur → 403");
  ok((await kunde("FIAON-IA-XXXXXX.123.abc")).status === 403, "erfundener Link → 403");
  ok((await kunde(A.angebotTokenMitAblauf(cA.ref, Date.now() - 60_000))).status === 410, "abgelaufener Link → 410");
  r = await admin(`/admin/global/angebote/${cA.id}/zurueckziehen`, { grund: "Prüfstand: zurückgezogen" });
  ok(r.status === 200 && (await kunde(cA.token)).status === 410, "zurückgezogen → 410");
  const dA = await anlegen("d", { buergin: BUERGIN_VOLL });
  const sD = await kunde(dA.token);
  await sqlPool`UPDATE fiaon_global_angebote SET gueltig_bis = ${plus(heute, -1)}::date WHERE id = ${dA.id}`;
  ok((await kunde(dA.token)).status === 410, "Gültigkeit abgelaufen → 410");
  r = await annehmen(dA.token, { textHash: sD.j.textHash }, menschFuer(3));
  ok(r.status === 410, "Annahme nach Ablauf → 410", r);
  await A.globalAngebotLauf();
  ok((await angebotZeile(dA.id)).status === "abgelaufen", "Tageslauf setzt „abgelaufen“");
  // Die Drossel: viele Versuche von einem Anschluss → 429 (vor jedem Speichern).
  {
    const eA = await anlegen("drossel", { buergin: BUERGIN_VOLL });
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) codes.push((await annehmen(eA.token, { textHash: "falsch" }, menschFuer(5))).status);
    ok(codes.includes(409) && codes[codes.length - 1] === 429, "Drossel je Anschluss: falsche Prüfsumme 409, danach 429", codes);
    ok((await angebotZeile(eA.id)).status === "offen", "nach der Drossel ist nichts angenommen");
    await admin(`/admin/global/angebote/${eA.id}/zurueckziehen`, { grund: "Prüfstand: Drossel" });
  }

  // ── D: Widerruf — der bestehende Storno-Weg der Leitung ──
  titel("D. Widerruf über den bestehenden Weg");
  const wA = await anlegen("w", { buergin: BUERGIN_VOLL });
  const sW = await kunde(wA.token);
  r = await annehmen(wA.token, { textHash: sW.j.textHash }, menschFuer(4));
  const refW = String(r.j.auftragRef);
  r = await admin(`/admin/global/auftraege/${encodeURIComponent(refW)}/storno`, { grund: "Widerruf des Kunden per E-Mail (Prüfstand)", erstattung: false });
  ok(r.status === 200 && (await zeile(refW)).payment_status === "cancelled", "Widerruf vor Zahlung: Bestellung storniert", r.j);
  l = await admin("/admin/global/angebote");
  const wl = (l.j.angebote as any[]).find((x) => x.id === wA.id);
  ok(wl && wl.teile[0].zahlungsstatus === "cancelled" && wl.knoepfe.meilenstein, "Liste zeigt Teil 1 storniert, Meilenstein gesperrt mit Grund", wl?.knoepfe);

  // ── Auftragsliste: Individualangebot mit Marke, Teil 2 nicht als eigene Zeile ──
  titel("E. Liste der Global-Aufträge");
  const gl = await admin("/admin/global/auftraege");
  const z1 = (gl.j.zeilen as any[]).find((x) => x.ref === ref1); const z2 = (gl.j.zeilen as any[]).find((x) => x.ref === ref2);
  ok(z1 && z1.angebotId === a.id && z1.paketName.includes("Teil 1") && z1.katalogCents === null, "Teil 1 in der Liste, mit Angebot, ohne Katalog-Warnung", z1 && { a: z1.angebotId, n: z1.paketName, k: z1.katalogCents });
  ok(!z2, "Teil 2 erscheint nicht als „ohne Auftrag“");

  // ── Mail-Vorschauen mit echten Feldern aus der Datenbank ──
  titel("F. Mail-Vorschauen (echte Felder) nach " + VORSCHAU);
  {
    const G = await import("../server/lib/fiaon-global-auftrag");
    const akte1 = await G.globalAkteLesen(ref1); const bb1 = await G.globalBestellungLesen(ref1); const bb2 = await G.globalBestellungLesen(ref2);
    const zA = (await A.angebotLesen({ id: a.id }))!; const dA2 = A.angebotDatenAus(zA);
    const zus = A.angebotMailZusatz(zA, dA2, { ereignis_text: "die erste Business-Kreditkarte für Ihre Gesellschaft freigeschaltet", ereignis_am_text: heute.split("-").reverse().join("."), erstattung_bis_text: "08.01.2027" });
    for (const [ev, b] of [["global_angebot_angenommen", bb1], ["global_angebot_start", bb1], ["global_angebot_teil2", bb2], ["global_angebot_teil2_bezahlt", bb2], ["global_angebot_erstattung", bb1]] as const) {
      const nl = G.globalMailNutzlast(akte1, b, { ansprechpartner: "Daniel Stripling", token: G.globalTokenErzeugen(ref1), zusatz: zus });
      const m = mailRendern(ev, nl)!;
      ok(m && m.fehlend.length === 0, `${ev}: vollständig mit echten Feldern`, m?.fehlend);
      fs.writeFileSync(path.join(VORSCHAU, `${ev}.html`), m.html);
    }
  }

  // ── Browser-Durchlauf mit Fotos — ohne Annahme-Klick ──
  titel("G. Browser-Durchlauf mit Fotos nach " + FOTOS);
  try {
    const { chromium } = await import("playwright");
    const browser = await chromium.launch({ headless: true });
    const fotoSeite = async (url: string, name: string, breite: number, opts: { cookie?: boolean; warteAuf?: string; hoehe?: number } = {}) => {
      const ctx = await browser.newContext({ viewport: { width: breite, height: opts.hoehe ?? (breite < 500 ? 800 : 900) }, deviceScaleFactor: 2, isMobile: breite < 500, hasTouch: breite < 500, locale: "de-DE" });
      // Der Rundgang startet beim ersten Besuch von selbst — fürs Foto gilt er als gesehen.
      await ctx.addInitScript(() => { try { for (const r of ["global-auftraege", "global-akte"]) localStorage.setItem(`fiaon_rundgang_${r}`, "ja"); } catch { /* ohne Speicher eben mit Rundgang */ } });
      if (opts.cookie) await ctx.addCookies([{ name: "fiaon_admin", value: decodeURIComponent(cookie.split("=").slice(1).join("=")), url: BASIS }]);
      const page = await ctx.newPage();
      const fehlerListe: string[] = [];
      page.on("pageerror", (e) => fehlerListe.push(String(e)));
      await page.goto(`${BASIS}${url}`, { waitUntil: "networkidle", timeout: 60000 });
      if (opts.warteAuf) await page.waitForSelector(opts.warteAuf, { timeout: 30000 }).catch(() => fehlerListe.push(`kein ${opts.warteAuf}`));
      // Der Auftakt (Nachtrag i) wird fürs Foto übersprungen — die Angebotsseite selbst zeigt KEINEN Einwilligungs-Hinweis (Nachtrag d).
      await page.evaluate(() => { (document.querySelector(".gia-auftakt-skip") as HTMLElement | null)?.click(); });
      await warte(1000);
      await page.evaluate(() => { document.querySelectorAll(".dk-auf").forEach((x) => x.classList.add("da")); });
      // Einwilligungs-Hinweis wegklicken, falls er steht (nur notwendige) — auf anderen Seiten.
      await page.getByRole("button", { name: /Nur notwendige/i }).click({ timeout: 1500 }).catch(() => {});
      if (/\/business\/angebot\//.test(url)) fehlerListe.push(...(await page.evaluate(() => (document.querySelector(".ew-karte") ? ["Einwilligungs-Hinweis auf der Angebotsseite"] : []))));
      await warte(600);
      const breiteIst = await page.evaluate(() => document.documentElement.scrollWidth);
      await page.screenshot({ path: path.join(FOTOS, `${name}.png`), fullPage: true });
      await ctx.close();
      return { fehlerListe, breiteIst };
    };
    const vollA = await anlegen("foto", { buergin: BUERGIN_VOLL });
    const f1 = await fotoSeite(`/business/angebot/${encodeURIComponent(vollA.token)}`, "kundenseite-1280", 1280, { warteAuf: "[data-fiaon=angebot]" });
    ok(f1.fehlerListe.length === 0 && f1.breiteIst <= 1280, "Kundenseite 1280 px ohne Fehler", f1);
    const f2 = await fotoSeite(`/business/angebot/${encodeURIComponent(vollA.token)}`, "kundenseite-380", 380, { warteAuf: "[data-fiaon=angebot]" });
    ok(f2.fehlerListe.length === 0 && f2.breiteIst <= 380, "Kundenseite 380 px ohne seitliches Scrollen", f2);
    // Reihenfolge am Bildschirm: Übersicht unmittelbar über dem Knopf.
    {
      const ctx = await browser.newContext({ viewport: { width: 380, height: 800 }, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      await page.goto(`${BASIS}/business/angebot/${encodeURIComponent(vollA.token)}`, { waitUntil: "networkidle" });
      await page.waitForSelector(".gia-annehmen");
      const lage = await page.evaluate(() => {
        const ue = document.querySelector(".gia-uebersicht")!.getBoundingClientRect(); const kn = document.querySelector(".gia-annehmen")!.getBoundingClientRect();
        const haken = Array.from(document.querySelectorAll(".gia-annahme input[type=checkbox]")).map((x) => (x as HTMLInputElement).checked);
        return { abstand: kn.top - ue.bottom, haken, text: (document.querySelector(".gia-annehmen") as HTMLElement).innerText };
      });
      ok(lage.abstand >= 0 && lage.abstand < 120 && lage.text.trim() === "Zahlungspflichtig annehmen", "Bestellübersicht unmittelbar über „Zahlungspflichtig annehmen“", lage);
      ok(lage.haken.length === 2 && lage.haken.every((x) => x === false), "zwei Häkchen, keiner vorangekreuzt", lage.haken);
      await page.locator(".gia-annahme").screenshot({ path: path.join(FOTOS, "annahme-380.png") });
      // Gegenprüfung 01.10.2026: Am Handy stapeln die Tabellen des Prüfberichts — kein Kasten scrollt seitlich.
      const tab = await page.evaluate(() => Array.from(document.querySelectorAll(".gia-vertrag .gia-tab")).map((t) => ({ breit: t.scrollWidth > (t.parentElement?.clientWidth ?? 0) + 1, thead: getComputedStyle(t.querySelector("thead") ?? t).display })));
      ok(tab.length >= 4 && tab.every((t) => !t.breit), "380 px: Prüfbericht-Tabellen ohne seitliches Scrollen", tab);
      await ctx.close();
    }
    // Das Blatt zum Unterschreiben (Anlage 1) für die Leitung.
    {
      const a1 = await pdf(`/api/fiaon/admin/global/angebote/${vollA.id}/anlage1.pdf`);
      const a1t = nurText(await pdfText(a1.buf));
      ok(a1.status === 200 && /zum Unterschreiben/.test(a1t) && /Prüfsumme dieser Fassung der Anlage 1/.test(a1t) && !/Anlage 2/.test(a1t), "Anlage 1 zum Unterschreiben als PDF, mit Prüfsumme, ohne die anderen Anlagen", a1t.slice(0, 300));
      fs.writeFileSync(path.join(FOTOS, "anlage1-zum-unterschreiben.pdf"), a1.buf);
    }
    const hild = (await sqlPool`SELECT angebot_ref, gueltig_bis FROM fiaon_global_angebote WHERE (kunde #>> '{}')::jsonb ->> 'email' = 'williamhildbrand@me.com' ORDER BY id LIMIT 1`) as any[];
    if (hild[0]) {
      const tH = A.angebotTokenErzeugen(String(hild[0].angebot_ref), berlinToday(new Date(hild[0].gueltig_bis)));
      // Seit dem Nachtrag (a) sind die Pflichtfelder gefüllt: der Knopf ist da — der Browser drückt ihn NIE.
      const f3 = await fotoSeite(`/business/angebot/${encodeURIComponent(tH)}`, "hildbrand-annehmbar-1280", 1280, { warteAuf: "[data-fiaon=angebot]" });
      const sH = await kunde(tH, "?sofortBeginn=0&jahresbetreuung=0");
      ok(f3.fehlerListe.length === 0 && sH.status === 200 && (sH.j.status === "angenommen" || sH.j.annahmeBereit === true), "Angebot Hildbrand: Pflichtfelder gefüllt, Annahme möglich (nicht geklickt)", { f3, bereit: sH.j.annahmeBereit, status: sH.j.status });
    }
    const f4 = await fotoSeite(`/business/angebot/${encodeURIComponent(a.token)}`, "bestaetigung-1280", 1280, { warteAuf: "[data-fiaon=angebot-fertig]" });
    ok(f4.fehlerListe.length === 0, "Bestätigung nach der Annahme", f4);
    const f5 = await fotoSeite(String(p1.j.meinAuftrag), "mein-auftrag-1280", 1280, { warteAuf: "[data-fiaon=mein-auftrag-angebot]" });
    ok(f5.fehlerListe.length === 0, "„Mein Auftrag“ mit Block „Ihr Angebot“", f5);
    // Das Chefbüro scrollt in einem inneren Kasten — ein hohes Fenster zeigt den ganzen Reiter.
    const f6 = await fotoSeite("/chef/s/global-auftraege?reiter=angebote", "chef-reiter-1440", 1440, { cookie: true, warteAuf: "[data-fiaon=global-angebote]", hoehe: 3400 });
    ok(f6.fehlerListe.length === 0, "Chef-Reiter „Individualangebote“", f6);
    const f7 = await fotoSeite(`/business/angebot/${encodeURIComponent(vollA.token)}`, "kundenseite-leitungsvorschau-1280", 1280, { cookie: true, warteAuf: "[data-fiaon=angebot]" });
    ok(f7.fehlerListe.length === 0, "Leitungsvorschau ohne Annahmeknopf", f7);
    await browser.close();
  } catch (e) {
    ok(false, "Browser-Durchlauf", String(e).slice(0, 300));
  }
  await sqlPool.end();
}

console.log(`\n${fehler ? `✗ ${fehler} von ${n} Prüfungen rot` : `✓ alle ${n} Prüfungen grün`}`);
process.exit(fehler ? 1 : 0);
