// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND KONTOAUSZUG BEREINIGEN (21.09.2026, E-207) — ohne Netz, ohne DB
//
// Der Fall, der alles auslöste (Name hier erfunden): Revolut Juni 2026 — jeder Eingang
// eine Aufladung vom eigenen Konto oder eine Temu-Erstattung; drei Aufladungen
// als „Sozialleistung" → 285,93 € „Gehalt". Dazu die Fallen der Regel: echter
// Lohn mit eigenem Namen, Miete mit eigenem Namen im Zweck, Familie mit gleichem
// Nachnamen, Inkasso als „Kreditrate", Kfz-Steuer als „Sozialleistung".
//
//   npx tsx scripts/pruef-kontoauszug-bereinigen.ts
// ═══════════════════════════════════════════════════════════════════════════
import { buchungenBereinigen, nebenkontoAus, istEigenerName, flachText, type RohBuchung } from "../shared/fiaon-kontoauszug-bereinigen";

process.env.DATABASE_URL ||= "postgres://pruefstand@127.0.0.1:9/ins-leere";
const { auswerten, merksaetzeAusZahlen } = await import("../server/lib/fiaon-kontoauszug-analyse");

let geprueft = 0, fehler = 0;
const ok = (b: unknown, t: string) => { geprueft++; if (!b) { fehler++; console.log(`  ✗ ${t}`); } };
const B = (datum: string, euro: number, empfaenger: string, zweck: string, kategorie: string): RohBuchung =>
  ({ datum, betragCents: Math.round(euro * 100), empfaenger, zweck, kategorie, wiederkehrend: false, saldoDanachCents: null });
const P = { vorname: "Max", nachname: "Mustermann" };

ok(flachText("Zahlung von DOĞAN ÇENGİZ, Köln") === "zahlung von dogan cengiz koeln", `flachText: Akzente und Umlaute (${flachText("Zahlung von DOĞAN ÇENGİZ, Köln")})`);
ok(istEigenerName("Zahlung von MAX MUSTERMANN", P) && !istEigenerName("Zahlung von ERIKA MUSTERMANN", P), "Eigener Name nur mit Vor- UND Nachname (Familie zählt nicht)");

const juni: RohBuchung[] = [
  B("2026-06-02", 200, "Privatperson", "Zahlung von MAX MUSTERMANN", "sozialleistung"),
  B("2026-06-05", 84, "Privatperson", "Zahlung von MAX MUSTERMANN", "sozialleistung"),
  B("2026-06-09", 1.93, "Privatperson", "Zahlung von MAX MUSTERMANN", "sozialleistung"),
  B("2026-06-10", 1512.5, "Privatperson", "Zahlung von MAX MUSTERMANN", "ueberweisung_ein"),
  B("2026-06-11", 19.24, "Temu", "Refund", "erstattung"),
  B("2026-06-12", 38.48, "Temu", "Rückerstattung", "freizeit"),
  B("2026-06-03", -324.67, "EWR AG", "Ratenvereinbarung Kd 123", "energie"),
  B("2026-06-04", -100, "PRA Group Deutschland", "Forderung 4711", "kredit_rate"),
  B("2026-06-06", -75, "Axactor Germany", "Az 99", "kredit_rate"),
  B("2026-06-07", -136, "Bundeskasse", "Kfz-Steuer K-DC 123", "sozialleistung"),
  B("2026-06-08", -650, "Hausverwaltung Meier", "Miete Juni Max Mustermann Whg 3", "miete"),
  B("2026-06-13", -130, "Geldautomat", "Bargeld", "bargeld"),
];
const b = buchungenBereinigen(juni, P);
const kat = (i: number) => b[i].kategorie;
ok([0, 1, 2, 3].every((i) => kat(i) === "eigenes_konto"), "Aufladungen vom eigenen Konto → eigenes Konto (auch die drei „Sozialleistungen“)");
ok(b[0].korrektur === "war: sozialleistung", "Korrektur bleibt nachvollziehbar („war: …“)");
ok(kat(4) === "erstattung" && kat(5) === "erstattung", "Temu-Gutschriften → Erstattung (auch die als „Freizeit“ gelesene)");
ok(kat(7) === "inkasso_mahnung" && kat(8) === "inkasso_mahnung", "PRA Group und Axactor → Inkasso statt „Kreditrate“");
ok(kat(9) === "abgaben", `Kfz-Steuer an die Bundeskasse ist eine Abgabe, keine Sozialleistung (${kat(9)})`);
ok(kat(10) === "miete", "Miete mit eigenem Namen im Zweck bleibt Miete (Name zählt nur bei Gutschriften)");
ok(kat(6) === "energie" && kat(11) === "bargeld", "Unauffälliges bleibt, wie es war");

const n = nebenkontoAus(b);
ok(n.nebenkonto && n.eigenEin === 179843, `Nebenkonto erkannt (eigene Eingänge ${(n.eigenEin / 100).toFixed(2)} €)`);
const z = auswerten(b as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(z.gehalt == null, `Kein „Gehalt“ mehr aus eigenen Aufladungen (vorher 285,93 €; jetzt ${z.gehalt})`);
ok(z.einnahmen === 5772, `Einnahmen ohne Umbuchungen: nur die Erstattungen (${(z.einnahmen / 100).toFixed(2)} €)`);
ok(z.nebenkonto && z.warnungen[0]?.art === "nebenkonto", "Warnung „Nebenkonto“ steht vorn");
ok(z.inkassoAnzahl === 2 && z.warnungen.some((w) => w.art === "inkasso"), "Inkasso gezählt und gewarnt");
ok(merksaetzeAusZahlen(z)[0].includes("anderen Konto von Ihnen") && !merksaetzeAusZahlen(z).join(" ").includes("Einkommen liegt"), "Merksatz sagt Nebenkonto statt eines falschen Einkommens");

// Echter Lohn mit eigenem Namen bleibt Einkommen
const lohn = buchungenBereinigen([
  B("2026-06-28", 2350, "Muster GmbH", "Gehalt 06/2026 Max Mustermann Personalnr 12", "gehalt"),
  B("2026-07-28", 2350, "Muster GmbH", "Lohn 07/2026 Max Mustermann", "gehalt"),
  B("2026-07-02", 50, "Privatperson", "Erika Mustermann Geburtstag", "ueberweisung_ein"),
], P);
ok(lohn[0].kategorie === "gehalt" && lohn[1].kategorie === "gehalt", "Echter Lohn mit eigenem Namen bleibt Gehalt");
ok(lohn[2].kategorie === "ueberweisung_ein", "Familie (gleicher Nachname, anderer Vorname) bleibt eine Einnahme");
const zl = auswerten(lohn as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(zl.gehalt === 235000 && !zl.nebenkonto, `Gehalt 2.350 € erkannt, kein Nebenkonto (${zl.gehalt})`);

// Die Fälle aus der Probe auf echten Daten (21.09.): Firmen und Kassen drucken den Begünstigten in den Zweck.
const echt = buchungenBereinigen([
  B("2026-04-24", 2793.66, "Deutsche Bahn Aktiengesellschaft", "DB Fernverkehr AG Verdienstabrechnung 04.26 Max Mustermann", "gehalt"),
  B("2026-03-27", 347, "BARMER Ersatzkasse - Pflegekasse", "728668818246 347,00 MUSTERMANN, MAX", "sozialleistung"),
  B("2026-08-06", 250, "Max Mustermann", "Gutschrift Inv DE08", "gehalt"),
  B("2026-06-15", -49.9, "Riverty für Amazon", "Rechnung 123", "kredit_rate"),
], P);
ok(echt[0].kategorie === "gehalt", "Bahn-Gehalt mit Namen im Zweck bleibt Gehalt (Firma als Gegenpartei)");
ok(echt[1].kategorie === "sozialleistung", "Pflegegeld mit Namen des Versicherten bleibt Sozialleistung");
ok(echt[2].kategorie === "eigenes_konto", "Eigener Name als Gegenpartei → eigenes Konto");
ok(echt[3].kategorie === "kredit_rate", "Riverty (Rechnungskauf) ist kein Inkasso");

// Rücklastschrift als Gutschrift zählt
const rl = auswerten(buchungenBereinigen([
  B("2026-06-01", -59.99, "FIAON LTD", "Lastschrift Rate", "abo_medien"),
  B("2026-06-03", 59.99, "FIAON LTD", "Rücklastschrift mangels Deckung", "ruecklastschrift"),
], P) as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(rl.ruecklastschriften === 1, `Rücklastschrift als Gutschrift wird gezählt (${rl.ruecklastschriften})`);

// Aufladung (Top-up) ohne Namen
const top = buchungenBereinigen([B("2026-06-01", 300, "Revolut", "Top-Up by *1234", "sonstige_einnahme")], P);
ok(top[0].kategorie === "eigenes_konto", "Top-up ohne Namen → eigenes Konto");
// Handy-„Aufladung" als Abbuchung bleibt Ausgabe
const handy = buchungenBereinigen([B("2026-06-01", -15, "Lidl Connect", "Aufladung Guthaben", "telefon_internet")], P);
ok(handy[0].kategorie === "telefon_internet", "Handy-Aufladung (Abbuchung) bleibt Ausgabe");

// Spartöpfe der Bank (gemessen 21.09.: rund 3.700 Buchungen, bei zwei Kunden je ~900) — beide Richtungen neutral
const topf = buchungenBereinigen([
  B("2026-06-02", -40, "Pocket", "Auszahlung bei Pocket", "sonstige_ausgabe"),
  B("2026-06-03", 202, "Pocket", "Auszahlung bei Pocket", "sonstige_einnahme"),
  B("2026-06-04", -25, "Pocket EUR Rainy Day", "To pocket EUR Rainy Day from EUR", "sonstige_ausgabe"),
  B("2026-06-05", 25, "Revolut Bank UAB", "To pocket EUR Rainy Day from EUR", "erstattung"),
  B("2026-06-06", 300, "EUR Tagesgeld", "Von EUR Tagesgeld", "ueberweisung_ein"),
  B("2026-06-07", -300, "EUR Tagesgeld", "Von EUR Tagesgeld", "ueberweisung_aus"),
  B("2026-06-08", -50, "Portmonee", "Um EUR Portmonee von EUR einzustecken", "bargeld"),
  B("2026-06-09", -0.41, "Worauf sparen Sie", "zu POS McDonalds", "sonstige_ausgabe"),
  B("2026-06-10", -12.5, "Pocket Bar Berlin", "Kartenzahlung", "freizeit"),
], P);
ok(topf.slice(0, 8).every((b) => b.kategorie === "spartopf"), `Spartöpfe (Pocket, Tagesgeld, Portmonee, Worauf sparen) → Spartopf in beide Richtungen (${topf.slice(0, 8).map((b) => b.kategorie).join(", ")})`);
ok(topf[8].kategorie === "freizeit", "Eine Bar namens „Pocket“ bleibt eine Ausgabe");
const zt = auswerten(topf as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(zt.einnahmen === 0 && zt.ausgaben === 1250, `Spartöpfe zählen weder als Einnahme noch als Ausgabe (${zt.einnahmen}/${zt.ausgaben})`);
// Nebenkonto nur ohne echtes Einkommen — und Spartöpfe zählen im Anteil nicht
const buerger = auswerten(buchungenBereinigen([
  B("2026-06-01", 1200, "Jobcenter Hannover", "Bürgergeld 06/2026", "sozialleistung"),
  B("2026-06-10", 2000, "Privatperson", "Zahlung von MAX MUSTERMANN", "ueberweisung_ein"),
], P) as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(!buerger.nebenkonto && buerger.gehalt === 120000, `Konto mit Bürgergeld plus Aufstockung vom eigenen Konto ist kein Nebenkonto (${buerger.nebenkonto}, ${buerger.gehalt})`);
const hauptMitToepfen = auswerten(buchungenBereinigen([
  B("2026-06-28", 2100, "Muster GmbH", "Gehalt Juni", "gehalt"),
  ...Array.from({ length: 20 }, (_, i) => B(`2026-06-${String(i + 1).padStart(2, "0")}`, 300, "Pocket", "Auszahlung bei Pocket", "sonstige_einnahme")),
], P) as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(!hauptMitToepfen.nebenkonto && hauptMitToepfen.gehalt === 210000 && hauptMitToepfen.einnahmen === 210000, `Hauptkonto mit 6.000 € Spartopf-Bewegungen bleibt Hauptkonto, Einnahmen 2.100 € (${hauptMitToepfen.nebenkonto}, ${hauptMitToepfen.einnahmen})`);
const neben2 = auswerten(buchungenBereinigen([
  B("2026-06-02", 500, "Privatperson", "Zahlung von MAX MUSTERMANN", "sozialleistung"),
  B("2026-06-20", 12.99, "Temu", "Erstattung", "freizeit"),
], P) as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(neben2.nebenkonto && neben2.gehalt == null, "Nur Aufladungen vom eigenen Konto + Erstattung → Nebenkonto, kein Einkommen");

// Marken-Regeln (gemessen an echten Auszügen, 21.09.)
const marken = buchungenBereinigen([
  B("2026-06-29", 831.46, "Deutsche Post AG Renten Service", "RV-RENTE 06.2026", "ueberweisung_ein"),
  B("2026-06-12", 10.68, "Playstation", "RINP Dauerauftrag", "sozialleistung"),
  B("2026-06-15", -18.36, "ARD ZDF Deutschlandradio Beitragsservice", "Rundfunkbeitrag 06-08", "kredit_rate"),
  B("2026-06-16", -25, "Tipico Co. Ltd.", "Einzahlung", "sonstige_ausgabe"),
  B("2026-06-17", -40, "PayPal Europe", "PP.8812 Tipico Einzahlung", "sonstige_ausgabe"),
  B("2026-06-18", -300, "Max Mustermann", "Echtzeitüberweisung", "sonstige_ausgabe"),
  B("2026-06-28", 1850, "Lidl Dienstleistung GmbH", "Lohn Juni 2026", "gehalt"),
  B("2026-06-10", 1200, "Jobcenter Region Hannover", "Leistungen SGB II", "ueberweisung_ein"),
  B("2026-06-20", 350, "Finanzamt Hannover-Nord", "Einkommensteuer 2025 Erstattung", "ueberweisung_ein"),
  B("2026-06-21", -120, "Finanzamt Hannover-Nord", "Einkommensteuer Nachzahlung", "sonstige_ausgabe"),
], P);
ok(marken[0].kategorie === "rente", `Renten Service als „Überweisung“ → Rente (${marken[0].kategorie})`);
ok(marken[1].kategorie === "erstattung", `PlayStation als „Sozialleistung“ → Erstattung (${marken[1].kategorie})`);
ok(marken[2].kategorie === "abgaben", `Rundfunkbeitrag als „Kreditrate“ → Abgabe (${marken[2].kategorie})`);
ok(marken[3].kategorie === "gluecksspiel" && marken[4].kategorie === "gluecksspiel", "Tipico direkt und über PayPal → Glücksspiel");
ok(marken[5].kategorie === "eigenes_konto", "Abbuchung an den eigenen Namen → eigenes Konto");
ok(marken[6].kategorie === "gehalt", "Lohn von Lidl bleibt Gehalt (Arbeitgeber, nicht Händler)");
ok(marken[7].kategorie === "sozialleistung", "Jobcenter als „Überweisung“ → Sozialleistung");
ok(marken[8].kategorie === "ueberweisung_ein" && marken[9].kategorie === "abgaben", "Steuererstattung bleibt Eingang (kein Einkommen), Nachzahlung ist Abgabe");

// Verlorenes „ß" im Ausdruck (gemessen: „PIERRE MEI NER" als Eingang vom eigenen Konto)
ok(istEigenerName("PIERRE MEI NER", { vorname: "Pierre", nachname: "Meißner" }) && istEigenerName("Pierre Meiner", { vorname: "Pierre", nachname: "Meißner" }), "Eigener Name auch ohne das „ß“ erkannt");
ok(!istEigenerName("PIERRE MEI", { vorname: "Pierre", nachname: "Meißner" }), "… aber nicht aus einem halben Namen");

// Zweimal bereinigen ändert nichts (die Nachrechnung läuft über schon bereinigte Buchungen)
const zweimal = buchungenBereinigen(topf, P);
ok(JSON.stringify(zweimal) === JSON.stringify(topf), "Bereinigen ist idempotent — die Korrektur „war: …“ bleibt erhalten");

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
