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
ok(kat(9) === "ueberweisung_aus", "Kfz-Steuer (Abbuchung) ist keine Sozialleistung");
ok(kat(10) === "miete", "Miete mit eigenem Namen im Zweck bleibt Miete (Name zählt nur bei Gutschriften)");
ok(kat(6) === "energie" && kat(11) === "bargeld", "Unauffälliges bleibt, wie es war");

const n = nebenkontoAus(b);
ok(n.nebenkonto && n.eigenEin === 179843, `Nebenkonto erkannt (eigene Eingänge ${(n.eigenEin / 100).toFixed(2)} €)`);
const z = auswerten(b as any, { saldoAnfang: null, saldoEnde: null, dispoLimit: null });
ok(z.gehalt == null, `Kein „Gehalt“ mehr aus eigenen Aufladungen (vorher 285,93 €; jetzt ${z.gehalt})`);
ok(z.einnahmen === 5772, `Einnahmen ohne Umbuchungen: nur die Erstattungen (${(z.einnahmen / 100).toFixed(2)} €)`);
ok(z.nebenkonto && z.warnungen[0]?.art === "nebenkonto", "Warnung „Nebenkonto“ steht vorn");
ok(z.inkassoAnzahl === 2 && z.warnungen.some((w) => w.art === "inkasso"), "Inkasso gezählt und gewarnt");
ok(merksaetzeAusZahlen(z)[0].includes("eigenen Konto") && !merksaetzeAusZahlen(z).join(" ").includes("Einkommen liegt"), "Merksatz sagt Nebenkonto statt eines falschen Einkommens");

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

console.log(`\n${fehler === 0 ? "✓" : "✗"} ${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler === 0 ? 0 : 1);
