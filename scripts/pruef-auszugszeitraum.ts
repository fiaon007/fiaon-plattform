// ═══════════════════════════════════════════════════════════════════════════
// PRÜFSTAND: DER ZEITRAUM EINES KONTOAUSZUGS (11.09.2026, E-179)
//
// Die Zeilen sind den echten Auszügen aus dem Praxistest nachgebaut — je Bank
// die Form, an der die alte Erkennung („kleinstes bis größtes Datum im Text")
// gescheitert ist oder an der die neue scheitern könnte. Keine echten Namen,
// keine echten IBANs.
//
//   npx tsx scripts/pruef-auszugszeitraum.ts
// ═══════════════════════════════════════════════════════════════════════════
process.env.DATABASE_URL ||= "postgres://pruefstand@localhost/nicht-benutzt";
const { auszugsZeitraum } = await import("../server/lib/fiaon-dokument-pruefung");

const JETZT = Date.UTC(2026, 8, 11, 12);
let fehler = 0;
function fall(name: string, zeilen: string[], erwartet: { von: string | null; bis: string | null; quelle?: string; voll?: boolean }): void {
  const z = auszugsZeitraum(zeilen, JETZT);
  const voll = z.tage >= 75;
  const ok = z.von === erwartet.von && z.bis === erwartet.bis
    && (erwartet.quelle === undefined || z.quelle === erwartet.quelle)
    && (erwartet.voll === undefined || voll === erwartet.voll);
  if (!ok) fehler++;
  console.log(`${ok ? "  ok  " : "  FEHLER"} ${name}: ${z.von ?? "—"} … ${z.bis ?? "—"} (${z.tage} T, ${z.quelle}, ${voll ? "vollständig" : "unvollständig"})`
    + (ok ? "" : `\n         erwartet ${erwartet.von} … ${erwartet.bis}${erwartet.quelle ? `, ${erwartet.quelle}` : ""}${erwartet.voll !== undefined ? `, ${erwartet.voll ? "vollständig" : "unvollständig"}` : ""}`));
}
const tage = (von: number, bis: number, monat: number, form: (t: string) => string) =>
  Array.from({ length: bis - von + 1 }, (_, i) => form(`${String(von + i).padStart(2, "0")}.${String(monat).padStart(2, "0")}.2026`));

console.log("\nDer Befund und seine Verwandten — Randdaten dürfen nicht strecken:");
fall("Revolut, nur Juni, Druckdatum 10.09. auf jeder Seite (Dogan Cengiz)", [
  "Kontoauszug in EUR", "Generiert am 10.09.2026",
  ...tage(10, 30, 6, (d) => `${d} Überweisung an Muster 24,90€ 751,68€`),
  "Generiert am 10.09.2026", "Generiert am 10.09.2026",
], { von: "2026-06-10", bis: "2026-06-30", quelle: "buchungen", voll: false });
fall("Tomorrow, nur Juni, „Erstellt am 03.09.“ auf sechs Seiten", [
  "01.06.2026 – 30.06.2026 Kontoauszug",
  ...tage(1, 30, 6, (d) => `${d} / ${d} Kartenzahlung -€ 25,00`),
  ...Array.from({ length: 6 }, (_, i) => `Erstellt am 03.09.2026 Seite ${i + 1} von 6`),
], { von: "2026-06-01", bis: "2026-06-30", voll: false });
fall("Sparkasse-Umsatzanzeige, Fußzeile mit IBAN und Druckzeit 31 Tage nach der letzten Buchung", [
  ...tage(1, 30, 5, (d) => `Kartenzahlung 80,00 Karte 1 01.05. 01:05 ${d} 80,00-`),
  ...tage(1, 17, 6, (d) => `Lastschrift ${d} 12,80-`),
  ...Array.from({ length: 10 }, (_, i) => `DE12 3456 7890 1234 5678 90 18.07.2026 17:22 0 007 ${i + 1}`),
], { von: "2026-05-01", bis: "2026-06-17", voll: false });
fall("Sparkasse-Juni mit Gebührenquartal „Abrechnungszeitraum vom 01.04. bis 30.06.“", [
  "Kontostand am 29.05.2026, Auszug Nr. 5 875,55",
  ...tage(1, 30, 6, (d) => `${d} Kartenzahlung -57,83`),
  "Abrechnungszeitraum vom 01.04.2026 bis 30.06.2026",
  "30.06.2026 Entgeltabrechnung / Wert: 01.07.2026 -15,85",
], { von: "2026-06-01", bis: "2026-07-01", voll: false });
fall("N26, Juni: „Datum geöffnet 04.05.“ vorn, Adresszeile mit Druckdatum hinten", [
  "Datum geöffnet: 04.05.2026", "01.06.2026 bis 30.06.2026",
  ...tage(1, 30, 6, (d) => `An Muster ${d} -10,00€`), ...tage(1, 30, 6, (d) => `Wertstellung ${d}`),
  "Musterstraße 4, 49720 Musterstadt 19.07.2026",
], { von: "2026-06-01", bis: "2026-06-30", voll: false });
fall("VR-Märzauszug: Buchungen ohne Jahr, „Abschluss vom 01.01. bis 31.03.“", [
  "Abschluss vom 01.01.2026 bis 31.03.2026", "alter Kontostand vom 27.02.2026 2.958,68 H",
  ...tage(2, 30, 3, (d) => `${d} Kartenzahlung 04:56:06 Uhr 1234/5678`),
  "02.03. 02.03. Kartenzahlung 97,29 S",
  "erstellt am 31.03.2026 23:43 Seite 1 von 16", "neuer Kontostand vom 31.03.2026 2.244,36 H",
], { von: "2026-03-02", bis: "2026-03-30", quelle: "uebrige_daten", voll: false });
fall("PayPal: eine Rechnung von 2023 im Kopf, Mai-Auszug", [
  "Rechnung 551 vom 10.11.2023", "statement from 01.05.2026 to 29.05.2026",
  ...tage(4, 29, 5, (d) => `${d} Zahlung an Händler ${d} -50,72 EUR`),
], { von: "2026-05-01", bis: "2026-05-29", voll: false });
fall("Zwei Monate, Druckdatum 20 Tage später", [
  ...tage(1, 31, 7, (d) => `${d} Lastschrift -20,00`), ...tage(1, 31, 8, (d) => `${d} Lastschrift -20,00`),
  "Erstellt am 20.09.2026", "Stand: 20.09.2026",
], { von: "2026-07-01", bis: "2026-08-31", voll: false });

console.log("\nWas vollständig ist, bleibt vollständig:");
fall("Postbank-Art, sechs Monatsauszüge, Buchungstag über zwei Zeilen („02.02 .“ / „2026“)", [
  "Kontoauszug vom 31.01.2026 bis 27.02.2026", "Auszug Seite von IBAN Alter Saldo per 30.01.2026",
  "02.02 . 02.02 . Kartenzahlung - 29,24", "2026 2026 Verwendungszweck/ Kunden-Referenz",
  "Kontoauszug vom 28.02.2026 bis 31.03.2026", "Kontoauszug vom 01.04.2026 bis 30.04.2026",
  "Kontoauszug vom 01.05.2026 bis 29.05.2026", "Kontoauszug vom 30.05.2026 bis 30.06.2026",
], { von: "2026-01-31", bis: "2026-06-30", quelle: "auszugsangabe", voll: true });
fall("Drei Monate, wenig Umsatz, Kopfzeile ergänzt bis Monatsende", [
  "Zeitraum: 01.06.2026 - 31.08.2026",
  "01.06.2026 Gehalt 2.100,00", "02.06.2026 Miete -850,00", "30.06.2026 Gehalt 2.100,00", "01.07.2026 Miete -850,00",
  "31.07.2026 Gehalt 2.100,00", "03.08.2026 Miete -850,00", "29.08.2026 Kartenzahlung -19,00",
], { von: "2026-06-01", bis: "2026-08-31", quelle: "buchungen", voll: true });
fall("Drei Monate dicht, dazu ein Vertragsdatum von 2025 in einer Buchungszeile", [
  "07/2026 Darlehen Vertrag 1-05.06.2025 Rate: 05.08.2026 37,50",
  ...tage(1, 30, 6, (d) => `${d} Kartenzahlung -12,00`), ...tage(1, 31, 7, (d) => `${d} Kartenzahlung -12,00`),
  ...tage(1, 31, 8, (d) => `${d} Kartenzahlung -12,00`),
], { von: "2026-06-01", bis: "2026-08-31", voll: true });
fall("ING-Umsatzanzeige: Buchungen „19.02.“, volle Daten nur als Uhrzeitstempel", [
  "Kontoauszug 19.02.2026 - 19.08.2026", "19.02. Gutschrift 100.00 19.02.26 100.93",
  ...tage(19, 28, 2, (d) => `${d} 09:21`), ...tage(1, 19, 8, (d) => `${d} 15:35`),
], { von: "2026-02-19", bis: "2026-08-19", quelle: "auszugsangabe", voll: true });
fall("UBS: Beträge mit Hochkomma, Saldozeile hinter dem Buchungsdatum", [
  ...tage(1, 30, 6, (d) => `${d} Einkauf -25.80 ${d} 63.94`), ...tage(1, 31, 7, (d) => `${d} Einkauf -1'000.00 ${d} 0.00`),
  ...tage(1, 31, 8, (d) => `${d} Saldo -50.60 ${d} -50.60`), "Erstellt am 05.09.2026",
], { von: "2026-06-01", bis: "2026-08-31", voll: true });

// Die echte PDF trennt mit U+0001. Die Zeilen kommen aus pdfTextUndZeilen
// schon geglättet an; hier wird geprüft, dass sie ungeglättet NICHT tragen
// würden — damit der Fall merkt, wenn jemand das Glätten wieder entfernt.
{
  const roh = ["Kontoauszug\u0001vom\u000131.01.2026\u0001bis\u000127.02.2026\u0001", "Kontoauszug\u0001vom\u000130.05.2026\u0001bis\u000130.06.2026\u0001"];
  const z = auszugsZeitraum(roh, JETZT);
  const ok = z.quelle !== "auszugsangabe";
  if (!ok) fehler++;
  console.log(`${ok ? "  ok  " : "  FEHLER"} Steuerzeichen statt Leerzeichen: ungeglättet keine Auszugsangabe (${z.quelle}) — das Glätten in pdfTextUndZeilen ist nötig`);
}

console.log("\nBeträge — was als Betrag gilt und was nicht:");
// Drei Buchungszeilen tragen den Zeitraum. Die vier Zeilen danach dürfen ihn
// NICHT verlängern — hielte eine davon als Betrag her, endete er später.
fall("„-195 ,00“, „1'000.00“, „9,99-“ sind Beträge; Uhrzeit, Hausnummer, Zinssatz, Kurs nicht", [
  "01.07.2026 Gutschrift -195 ,00 EUR", "02.07.2026 Einkauf -1'000.00", "03.07.2026 Lastschrift 9,99-",
  "DATUM 04.07.2026, 20.42 UHR", "Musterweg 4, 49720 Ort 05.07.2026",
  "06.07.2026 neuer Zinssatz 14,2260 %", "07.07.2026 Umtausch EUR/1,18585",
], { von: "2026-07-01", bis: "2026-07-03", quelle: "buchungen" });

console.log(fehler ? `\n${fehler} Fall/Fälle FEHLERHAFT.\n` : "\nAlle Fälle bestanden.\n");
process.exit(fehler ? 1 : 0);
