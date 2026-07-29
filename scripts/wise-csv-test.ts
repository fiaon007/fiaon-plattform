/**
 * ═══════════════════════════════════════════════════════════════════════════
 * TESTS FÜR DEN KONTOAUSZUG-LESER — ohne Datenbank, ohne Netz
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Der alte Leser hat Zeilen stumm übersprungen, wenn eine Spalte anders hiess.
 * Von 100 Eingängen wurden 9 zugeordnet. Dieser Leser darf das nicht wiederholen,
 * und das lässt sich vorher beweisen statt hinterher zu bemerken.
 *
 * Geprüft werden die Formate, die aus der Wise-Weboberfläche tatsächlich
 * herauskommen — englisch und deutsch, Komma und Semikolon, Punkt und Komma
 * als Dezimaltrennzeichen — und vor allem die Fälle, in denen der Leser
 * ABBRECHEN muss statt weiterzulaufen.
 *
 * Ausführen:  npx tsx scripts/wise-csv-test.ts
 */

import {
  CsvFehler,
  entdoppele,
  erkenneSpalten,
  erkenneTrennzeichen,
  leseBetragCents,
  leseDatum,
  leseWiseCsv,
} from "../server/lib/wise-csv";

let bestanden = 0, fehlgeschlagen = 0;

function ok(name: string, bedingung: boolean, detail = ""): void {
  if (bedingung) { bestanden++; console.log(`  ✓ ${name}`); }
  else { fehlgeschlagen++; console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}
function gleich(name: string, ist: unknown, soll: unknown): void {
  ok(name, JSON.stringify(ist) === JSON.stringify(soll), `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
}
function wirft(name: string, fn: () => unknown, enthaelt?: string): void {
  try {
    fn();
    fehlgeschlagen++;
    console.log(`  ✗ ${name} — es wurde KEIN Fehler geworfen (stilles Weiterlaufen)`);
  } catch (err: any) {
    const passt = err instanceof CsvFehler && (!enthaelt || String(err.message).includes(enthaelt));
    ok(name, passt, passt ? "" : `Meldung: ${String(err?.message).slice(0, 120)}`);
  }
}
function gruppe(titel: string): void {
  console.log(`\n── ${titel} ${"─".repeat(Math.max(0, 66 - titel.length))}`);
}

// ═══════════════════════════════════════════════════════════════════════════

function main(): void {
  console.log("\nKONTOAUSZUG-LESER — TESTS");
  console.log("═".repeat(74));

  // ── Beträge ───────────────────────────────────────────────────────────────
  gruppe("Beträge — deutsch und englisch dürfen nicht verwechselt werden");
  gleich("englisch  1,234.56", leseBetragCents("1,234.56"), 123456);
  gleich("deutsch   1.234,56", leseBetragCents("1.234,56"), 123456);
  gleich("schlicht  45.00", leseBetragCents("45.00"), 4500);
  gleich("schlicht  45,00", leseBetragCents("45,00"), 4500);
  gleich("ganzzahl  45", leseBetragCents("45"), 4500);
  gleich("Tausenderpunkt ohne Dezimale 1.234", leseBetragCents("1.234"), 123400);
  gleich("Tausenderkomma ohne Dezimale 1,234", leseBetragCents("1,234"), 123400);
  gleich("mit Währungszeichen € 49,00", leseBetragCents("€ 49,00"), 4900);
  gleich("negativ -45.00", leseBetragCents("-45.00"), -4500);
  gleich("Klammern (45,00) sind negativ", leseBetragCents("(45,00)"), -4500);
  gleich("drei Nachkommastellen 1.234.567,89", leseBetragCents("1.234.567,89"), 123456789);
  gleich("leer ergibt nichts", leseBetragCents(""), null);
  gleich("Text ergibt nichts", leseBetragCents("k. A."), null);

  // ── Datum ─────────────────────────────────────────────────────────────────
  gruppe("Datum");
  gleich("ISO", leseDatum("2026-03-04")?.toISOString().slice(0, 10), "2026-03-04");
  gleich("ISO mit Zeit", leseDatum("2026-03-04T10:15:00Z")?.toISOString().slice(0, 10), "2026-03-04");
  gleich("Tag zuerst, Bindestrich", leseDatum("04-03-2026")?.toISOString().slice(0, 10), "2026-03-04");
  gleich("Tag zuerst, Punkt", leseDatum("04.03.2026")?.toISOString().slice(0, 10), "2026-03-04");
  gleich("Tag zuerst, Schrägstrich", leseDatum("04/03/2026")?.toISOString().slice(0, 10), "2026-03-04");
  gleich("unlesbar ergibt nichts", leseDatum("keine Angabe"), null);

  // ── Trennzeichen und Spalten ──────────────────────────────────────────────
  gruppe("Trennzeichen und Spaltenerkennung");
  gleich("Komma", erkenneTrennzeichen("a,b,c\n1,2,3"), ",");
  gleich("Semikolon", erkenneTrennzeichen("a;b;c\n1;2;3"), ";");
  gleich("Tabulator", erkenneTrennzeichen("a\tb\tc"), "\t");
  ok(
    "Semikolon in Anführungszeichen zählt nicht als Trenner",
    erkenneTrennzeichen('"Meier; Anna",b,c') === ",",
  );

  const sp = erkenneSpalten(["TransferWise ID", "Date", "Amount", "Currency", "Payment Reference", "Payer Name"]);
  gleich("TransferWise ID wird als Transaktions-ID erkannt", sp.txnId?.index, 0);
  gleich("Payment Reference wird als Zweck erkannt", sp.zweck?.index, 4);
  gleich("Payer Name wird als Absender erkannt", sp.absender?.index, 5);

  const spDe = erkenneSpalten(["Transaktions-ID", "Datum", "Betrag", "Währung", "Verwendungszweck", "Absender"]);
  gleich("deutsche Überschriften: ID", spDe.txnId?.index, 0);
  gleich("deutsche Überschriften: Betrag", spDe.betrag?.index, 2);
  gleich("deutsche Überschriften: Währung mit Umlaut", spDe.waehrung?.index, 3);
  gleich("deutsche Überschriften: Verwendungszweck", spDe.zweck?.index, 4);

  const spDoppel = erkenneSpalten(["ID", "TransferWise ID", "Amount"]);
  ok(
    "Zwei ID-Spalten: die spezifischere gewinnt",
    spDoppel.txnId?.kopf === "TransferWise ID",
    `gewählt wurde „${spDoppel.txnId?.kopf}"`,
  );

  // ── Echter englischer Wise-Auszug ─────────────────────────────────────────
  gruppe("Wise-Auszug, englisch");
  const enCsv = [
    `"TransferWise ID","Date","Amount","Currency","Description","Payment Reference","Payer Name","Payer Account Number"`,
    `"CARD-1","04-03-2026","-12.99","EUR","Card transaction","","",""`,
    `"BALANCE-2","03-03-2026","49.00","EUR","Received money from ANNA MUELLER","FIAON-6AS4A5","ANNA MUELLER","DE89370400440532013000"`,
    `"BALANCE-3","02-03-2026","49.00","EUR","Received money from Peter Schmidt","Rechnung","Peter Schmidt","DE02120300000000202051"`,
    `"BALANCE-4","01-03-2026","-500.00","EUR","Sent money to Supplier Ltd","","",""`,
  ].join("\n");
  const en = leseWiseCsv(enCsv);
  gleich("Datenzeilen gezählt", en.datenzeilen, 4);
  gleich("zwei Eingänge", en.eingaenge.length, 2);
  gleich("zwei Ausgänge (negativer Betrag)", en.ausgaenge.length, 2);
  gleich("Betrag in Cent", en.eingaenge[0].amountCents, 4900);
  gleich("Zweck übernommen", en.eingaenge[0].referenceRaw?.includes("FIAON-6AS4A5"), true);
  gleich("Absender übernommen", en.eingaenge[0].payerName, "ANNA MUELLER");
  gleich("Absender-IBAN übernommen", en.eingaenge[0].senderAccount, "DE89370400440532013000");
  gleich("Datum gelesen", en.eingaenge[0].bookedAt?.toISOString().slice(0, 10), "2026-03-03");
  ok("Ausgänge sind nicht unter den Eingängen", en.eingaenge.every((z) => z.amountCents > 0));

  // ── Deutscher Export mit Semikolon ────────────────────────────────────────
  gruppe("Wise-Auszug, deutsch, Semikolon, Dezimalkomma");
  const deCsv = [
    `Transaktions-ID;Datum;Betrag;Währung;Verwendungszweck;Absender;Absender-IBAN`,
    `TW-10;03.03.2026;49,00;EUR;FIAON-6AS4A5;Anna Müller;DE89 3704 0044 0532 0130 00`,
    `TW-11;03.03.2026;-1.234,56;EUR;Miete;;`,
    `TW-12;02.03.2026;1.098,00;EUR;Sammelzahlung;Firma Groß GmbH;`,
  ].join("\n");
  const de = leseWiseCsv(deCsv);
  gleich("Semikolon erkannt", de.trennzeichen, ";");
  gleich("zwei Eingänge", de.eingaenge.length, 2);
  gleich("Dezimalkomma richtig gelesen", de.eingaenge[0].amountCents, 4900);
  gleich("Tausenderpunkt richtig gelesen", de.eingaenge[1].amountCents, 109800);
  gleich("negativ mit Tausenderpunkt ist Ausgang", de.ausgaenge[0].amountCents, 123456);
  gleich("Umlaut im Absender bleibt erhalten", de.eingaenge[0].payerName, "Anna Müller");
  gleich("IBAN mit Leerzeichen übernommen", de.eingaenge[0].senderAccount?.startsWith("DE89"), true);

  // ── Störfeuer aus der Praxis ──────────────────────────────────────────────
  gruppe("Störfeuer: Vorspann, BOM, Anführungszeichen, Zeilenumbruch im Feld");
  const wildCsv = [
    `Kontoauszug FIAON LTD`,
    `Zeitraum: 01.01.2026 - 31.03.2026`,
    ``,
    `"TransferWise ID","Date","Amount","Currency","Payment Reference","Payer Name"`,
    `"X-1","2026-01-05","49.00","EUR","FIAON-ABC123","Meier, Anna"`,
    `"X-2","2026-01-06","49.00","EUR","Zahlung` + "\n" + `zweite Zeile","Bäcker & Co, KG"`,
  ].join("\n");
  const wild = leseWiseCsv("\uFEFF" + wildCsv);
  gleich("Vorspann übersprungen, Kopfzeile gefunden", wild.eingaenge.length, 2);
  gleich("Komma im Namen bleibt ein Feld", wild.eingaenge[0].payerName, "Meier, Anna");
  gleich("Zeilenumbruch im Feld zerreisst die Zeile nicht", wild.eingaenge[1].payerName, "Bäcker & Co, KG");
  gleich("Byte-Order-Mark stört die erste Überschrift nicht", wild.spalten.txnId?.index, 0);

  // ── Interne Umbuchungen ───────────────────────────────────────────────────
  gruppe("Interne Umbuchungen zählen nicht als Kundengeld");
  const internCsv = [
    `TransferWise ID,Date,Amount,Currency,Description,Transaction details type`,
    `C-1,2026-01-05,1000.00,EUR,Converted 1000 GBP to EUR,CONVERSION`,
    `C-2,2026-01-06,49.00,EUR,Received money,DEPOSIT`,
    `C-3,2026-01-07,200.00,EUR,Balance transfer between jars,BALANCE`,
  ].join("\n");
  const it = leseWiseCsv(internCsv);
  gleich("nur eine echte Kundenzahlung", it.eingaenge.length, 1);
  gleich("zwei interne Umbuchungen", it.intern.length, 2);
  gleich("die Kundenzahlung ist die richtige", it.eingaenge[0].txnId, "C-2");

  // ── Was ABBRECHEN muss ────────────────────────────────────────────────────
  gruppe("Pflichtspalten fehlen — hier MUSS abgebrochen werden");
  wirft(
    "keine Transaktions-ID",
    () => leseWiseCsv(`Date,Amount,Currency,Payment Reference\n2026-01-05,49.00,EUR,FIAON-ABC123`),
    "Transaktions-ID",
  );
  wirft(
    "kein Betrag",
    () => leseWiseCsv(`TransferWise ID,Date,Currency,Payment Reference\nX-1,2026-01-05,EUR,FIAON-ABC123`),
    "Betrag",
  );
  wirft("leere Datei", () => leseWiseCsv(""), "leer");
  wirft(
    "unbekanntes Format",
    () => leseWiseCsv(`Spalte1,Spalte2,Spalte3\na,b,c`),
    "Keine Kopfzeile erkannt",
  );
  ok(
    "die Fehlermeldung nennt die gefundenen Überschriften",
    (() => {
      try { leseWiseCsv(`Date,Amount\n2026-01-05,49.00`); return false; }
      catch (e: any) { return String(e.message).includes("Date") && String(e.message).includes("Amount"); }
    })(),
  );

  gruppe("Ersatzschlüssel nur auf ausdrücklichen Wunsch");
  const ohneId = `Date,Amount,Currency,Payment Reference,Payer Name\n2026-01-05,49.00,EUR,FIAON-ABC123,Anna Müller`;
  wirft("ohne Schalter: Abbruch", () => leseWiseCsv(ohneId));
  const mitErsatz = leseWiseCsv(ohneId, { ersatzschluessel: true });
  gleich("mit Schalter: eine Zeile gelesen", mitErsatz.eingaenge.length, 1);
  ok("Ersatzschlüssel ist als solcher erkennbar", mitErsatz.eingaenge[0].txnId.startsWith("CSV-"));
  gleich("Ersatzschlüssel wird gezählt", mitErsatz.ersatzschluesselVerwendet, 1);
  gleich(
    "derselbe Inhalt ergibt denselben Schlüssel (kein Doppelimport)",
    leseWiseCsv(ohneId, { ersatzschluessel: true }).eingaenge[0].txnId,
    mitErsatz.eingaenge[0].txnId,
  );

  // ── Übersprungene Zeilen ──────────────────────────────────────────────────
  gruppe("Übersprungene Zeilen werden benannt, nicht verschluckt");
  const luecken = [
    `TransferWise ID,Date,Amount,Currency,Payment Reference`,
    `L-1,2026-01-05,49.00,EUR,FIAON-ABC123`,
    `L-2,2026-01-06,,EUR,ohne Betrag`,
    `L-3,2026-01-07,0.00,EUR,Nullbuchung`,
    `,2026-01-08,49.00,EUR,ohne ID`,
  ].join("\n");
  const lk = leseWiseCsv(luecken);
  gleich("ein Eingang", lk.eingaenge.length, 1);
  gleich("drei übersprungene Zeilen", lk.uebersprungen.length, 3);
  ok("mit Zeilennummer", lk.uebersprungen.every((u) => u.zeileNr > 0));
  ok(
    "mit Begründung im Klartext",
    lk.uebersprungen.some((u) => u.grund.includes("Betrag fehlt")) &&
    lk.uebersprungen.some((u) => u.grund.includes("0,00")) &&
    lk.uebersprungen.some((u) => u.grund.includes("Transaktions-ID")),
  );
  gleich(
    "die Rechnung geht auf: gelesen = Eingang + Ausgang + intern + übersprungen",
    lk.datenzeilen,
    lk.eingaenge.length + lk.ausgaenge.length + lk.intern.length + lk.uebersprungen.length,
  );

  // ── Mehrfach-Import ───────────────────────────────────────────────────────
  gruppe("Mehrfach-Import: gleiche Transaktions-ID nur einmal");
  const doppelt = entdoppele([{ txnId: "A" }, { txnId: "B" }, { txnId: "A" }, { txnId: "C" }]);
  gleich("drei eindeutige", doppelt.eindeutig.length, 3);
  gleich("eine Dublette", doppelt.doppelt, 1);
  gleich("Reihenfolge bleibt", doppelt.eindeutig.map((x) => x.txnId), ["A", "B", "C"]);

  const ueberlappung = leseWiseCsv(
    [
      `TransferWise ID,Date,Amount,Currency,Payment Reference`,
      `D-1,2026-01-05,49.00,EUR,FIAON-ABC123`,
      `D-1,2026-01-05,49.00,EUR,FIAON-ABC123`,
    ].join("\n"),
  );
  gleich(
    "zwei überlappende Zeiträume in einer Datei ergeben eine Zahlung",
    entdoppele(ueberlappung.eingaenge).eindeutig.length,
    1,
  );

  console.log("\n" + "═".repeat(74));
  console.log(`ERGEBNIS: ${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen`);
  if (fehlgeschlagen > 0) {
    console.log("Der Leser ist noch nicht verlässlich — kein Import damit.");
    process.exit(1);
  }
  console.log("Der Leser erkennt die Wise-Formate und bricht ab, statt still zu verlieren.");
}

main();
