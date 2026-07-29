/**
 * ═══════════════════════════════════════════════════════════════════════════
 * KONTOAUSZUG AUS DER WISE-WEBOBERFLÄCHE LESEN
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WARUM DIESER WEG
 * Der API-Weg ist versperrt: Wise erlaubt „retrieving balance statements via
 * API" mit persönlichen Zugangstoken nur für Konten in den USA, Kanada,
 * Australien, Neuseeland, Singapur und Malaysia. FIAON LTD ist britisch. Kein
 * Codefehler, sondern eine geschlossene Tür. Also lesen wir den Auszug, den
 * die Weboberfläche ausgibt.
 *
 * WAS HIER ANDERS IST ALS BISHER
 * Der alte Leser stand im Browser und erwartete feste Spaltennamen sowie die
 * Werte „CREDIT" und „DEPOSIT". Fehlte eine Spalte, wurde die Zeile stumm
 * übersprungen — und niemand erfuhr davon. Genau so verschwindet Geld aus dem
 * Blick. Hier gilt das Gegenteil:
 *
 *   · Spalten werden über Namensvarianten erkannt, deutsch wie englisch, in
 *     mehreren Export-Formaten.
 *   · Fehlt eine PFLICHTSPALTE, bricht das Lesen ab und nennt die tatsächlich
 *     gefundenen Überschriften. Kein stilles Weiterlaufen.
 *   · Jede übersprungene Zeile wird mit Zeilennummer und Grund festgehalten.
 *     Am Ende muss die Rechnung aufgehen: gelesen = Eingänge + Ausgänge +
 *     intern + übersprungen.
 *
 * RICHTUNG
 * Nicht jeder Wise-Export hat eine Spalte dafür. Der Kontoauszug kodiert sie
 * im VORZEICHEN des Betrags. Deshalb ist das Vorzeichen die Grundlage; eine
 * vorhandene Richtungsspalte wird zusätzlich ausgewertet. Ein negativer Betrag
 * gilt IMMER als Ausgang, egal was daneben steht.
 *
 * Reine Logik, kein Datenbankzugriff — prüfbar über `scripts/wise-csv-test.ts`.
 */

import crypto from "node:crypto";

export class CsvFehler extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvFehler";
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Spaltenerkennung
// ═══════════════════════════════════════════════════════════════════════════

/** Überschrift auf Vergleichsform bringen: Kleinbuchstaben, nur Buchstaben und Ziffern. */
function normKopf(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Bekannte Schreibweisen je Feld.
 *
 * Die Reihenfolge ist Absicht: spezifische Namen zuerst, allgemeine zuletzt.
 * „id" steht am Ende der Liste für die Transaktionsnummer, damit ein Export
 * mit „TransferWise ID" nicht versehentlich eine andere Spalte namens „ID"
 * erwischt. Jede Spalte wird höchstens einem Feld zugeteilt.
 */
const SPALTEN: Record<string, string[]> = {
  txnId: [
    "transferwiseid", "wiseid", "transactionid", "transaktionsid", "transaktionsnummer",
    "referencenumber", "referenznummer", "belegnummer", "id",
  ],
  datum: [
    "date", "datetime", "datum", "buchungsdatum", "bookingdate", "valuedate", "wertstellung",
    "finishedon", "abgeschlossenam", "createdon", "erstelltam", "completedat",
  ],
  betrag: [
    "amount", "betrag", "amounteur", "betrageur", "netamount", "nettobetrag", "targetamount",
  ],
  waehrung: ["currency", "waehrung", "wahrung", "targetcurrency"],
  zweck: [
    "paymentreference", "zahlungsreferenz", "verwendungszweck", "reference", "referenz",
    "verwendung",
  ],
  beschreibung: ["description", "beschreibung", "details", "buchungstext", "note", "notiz"],
  absender: [
    "payername", "sendername", "absendername", "zahlername", "einzahler", "absender",
    "sourcename", "counterpartyname", "gegenpartei", "auftraggeber",
  ],
  absenderKonto: [
    "payeraccountnumber", "payeraccount", "senderaccount", "senderaccountnumber",
    "absenderkonto", "absenderiban", "sourceaccount", "counterpartyaccount", "iban",
  ],
  richtung: ["direction", "richtung", "transactiontype", "transaktionstyp", "typ", "type"],
  art: [
    "transactiondetailstype", "detailstype", "artderzahlung", "zahlungsart", "category",
    "kategorie",
  ],
};

/** Pflichtfelder — ohne sie ist der Auszug nicht verwertbar. */
const PFLICHT: Array<[string, string]> = [
  ["txnId", "Transaktions-ID (Idempotenz beim Mehrfach-Import)"],
  ["betrag", "Betrag"],
];

export type Spaltenzuordnung = Record<string, { index: number; kopf: string } | null>;

/** Ordnet den Überschriften einer Zeile die logischen Felder zu. */
export function erkenneSpalten(kopfzeile: string[]): Spaltenzuordnung {
  const norm = kopfzeile.map(normKopf);
  const zuordnung: Spaltenzuordnung = {};
  const belegt = new Set<number>();

  for (const [feld, namen] of Object.entries(SPALTEN)) {
    zuordnung[feld] = null;
    for (const name of namen) {
      const i = norm.findIndex((h, idx) => h === name && !belegt.has(idx));
      if (i >= 0) {
        zuordnung[feld] = { index: i, kopf: kopfzeile[i].trim() };
        belegt.add(i);
        break;
      }
    }
  }
  return zuordnung;
}

/** Wie viele Felder hat diese Zeile getroffen? Dient dem Auffinden der Kopfzeile. */
function kopfGuete(zeile: string[]): number {
  const z = erkenneSpalten(zeile);
  return Object.values(z).filter(Boolean).length;
}

// ═══════════════════════════════════════════════════════════════════════════
// Zerlegen
// ═══════════════════════════════════════════════════════════════════════════

/** Trennzeichen aus der Kopfzeile ableiten. */
export function erkenneTrennzeichen(text: string): string {
  const erste = text.split(/\r?\n/).find((z) => z.trim() !== "") ?? "";
  const zaehler: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQ = false;
  for (const c of erste) {
    if (c === '"') inQ = !inQ;
    else if (!inQ && c in zaehler) zaehler[c]++;
  }
  const best = Object.entries(zaehler).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ",";
}

/** CSV zerlegen — mit Anführungszeichen, doppelten Anführungszeichen und Zeilenumbrüchen im Feld. */
export function zerlege(text: string, trenn: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = "";
  let inQ = false;
  const roh = text.replace(/^\uFEFF/, ""); // Byte-Order-Mark aus Excel-Exporten

  for (let i = 0; i < roh.length; i++) {
    const c = roh[i];
    if (inQ) {
      if (c === '"') {
        if (roh[i + 1] === '"') { feld += '"'; i++; }
        else inQ = false;
      } else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === trenn) { zeile.push(feld); feld = ""; }
    else if (c === "\n") { zeile.push(feld); zeilen.push(zeile); zeile = []; feld = ""; }
    else if (c !== "\r") feld += c;
  }
  if (feld.length || zeile.length) { zeile.push(feld); zeilen.push(zeile); }
  return zeilen;
}

// ═══════════════════════════════════════════════════════════════════════════
// Werte lesen
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Betrag in Cent, mit Vorzeichen.
 *
 * Muss beide Welten beherrschen: „1.234,56" (deutsch) und „1,234.56" (englisch).
 * Die Regel dafür ist einfach und sicher: Sind BEIDE Zeichen vorhanden, ist das
 * WEITER HINTEN stehende das Dezimaltrennzeichen. Steht nur eines, entscheidet
 * die Zahl der Stellen dahinter — genau zwei bedeuten Dezimaltrennung, drei
 * bedeuten Tausendertrennung.
 *
 * Rundung über den absoluten Betrag, damit -0,005 nicht in die falsche
 * Richtung kippt.
 */
export function leseBetragCents(roh: unknown): number | null {
  let s = String(roh ?? "").trim();
  if (!s) return null;

  let negativ = false;
  if (/^\(.*\)$/.test(s)) { negativ = true; s = s.slice(1, -1); }   // (45,00) = Ausgang
  s = s.replace(/[^0-9.,+-]/g, "");                                  // €, £, Leerzeichen weg
  if (s.startsWith("-")) { negativ = true; s = s.slice(1); }
  else if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/[+-]/g, "");
  if (!s) return null;

  const letztesKomma = s.lastIndexOf(",");
  const letzterPunkt = s.lastIndexOf(".");
  let dezimal = -1;
  if (letztesKomma >= 0 && letzterPunkt >= 0) {
    dezimal = Math.max(letztesKomma, letzterPunkt);
  } else if (letztesKomma >= 0 || letzterPunkt >= 0) {
    const pos = Math.max(letztesKomma, letzterPunkt);
    const stellen = s.length - pos - 1;
    // Genau drei Stellen und nur ein Trenner: Tausenderpunkt („1.234").
    dezimal = stellen === 3 ? -1 : pos;
  }

  const ganz = (dezimal >= 0 ? s.slice(0, dezimal) : s).replace(/[.,]/g, "");
  const bruch = dezimal >= 0 ? s.slice(dezimal + 1).replace(/[.,]/g, "") : "";
  if (!/^\d*$/.test(ganz) || !/^\d*$/.test(bruch) || (ganz === "" && bruch === "")) return null;

  const cents = Math.round(Number(`${ganz || "0"}.${bruch || "0"}`) * 100);
  if (!Number.isFinite(cents)) return null;
  return negativ ? -cents : cents;
}

/**
 * Datum lesen.
 *
 * Wise gibt je nach Export ISO oder Tag-zuerst aus. Tag-zuerst ist die
 * europäische Schreibweise und für ein britisches Konto die richtige Annahme.
 * Rein amerikanische Monat-zuerst-Daten werden bewusst NICHT geraten: Wo
 * „03/04/2026" mehrdeutig ist, wäre eine falsche Annahme schlimmer als ein
 * fehlendes Datum. Das Datum ist für die Zuordnung ohnehin nicht tragend.
 */
export function leseDatum(roh: unknown): Date | null {
  const s = String(roh ?? "").trim();
  if (!s) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s.length <= 10 ? `${s}T00:00:00Z` : s);
    return isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    const [, tag, monat, jahr, std, min] = m;
    if (Number(monat) >= 1 && Number(monat) <= 12 && Number(tag) >= 1 && Number(tag) <= 31) {
      const d = new Date(Date.UTC(+jahr, +monat - 1, +tag, +(std ?? 0), +(min ?? 0)));
      return isNaN(d.getTime()) ? null : d;
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ═══════════════════════════════════════════════════════════════════════════
// Ergebnis
// ═══════════════════════════════════════════════════════════════════════════

export type Richtung = "eingang" | "ausgang" | "intern";

export interface CsvZeile {
  txnId: string;
  bookedAt: Date | null;
  /** Immer positiv. Die Richtung steht in `richtung`. */
  amountCents: number;
  currency: string;
  payerName: string | null;
  senderAccount: string | null;
  /** Verwendungszweck und Beschreibung zusammengefügt — Grundlage der Referenzsuche. */
  referenceRaw: string | null;
  description: string | null;
  art: string | null;
  richtung: Richtung;
  zeileNr: number;
}

export interface CsvBefund {
  eingaenge: CsvZeile[];
  ausgaenge: CsvZeile[];
  intern: CsvZeile[];
  uebersprungen: Array<{ zeileNr: number; grund: string }>;
  spalten: Spaltenzuordnung;
  trennzeichen: string;
  kopfzeile: string[];
  /** Datenzeilen insgesamt (ohne Kopfzeile). */
  datenzeilen: number;
  /** Zeilen mit unlesbarem Datum — Zuordnung geht trotzdem, Bericht wird ungenau. */
  ohneDatum: number;
  ersatzschluesselVerwendet: number;
}

/** Interne Umbuchung? Kein Kundengeld, darf nie als Zahlung gelten. */
function istIntern(art: string, text: string): boolean {
  const a = art.toUpperCase();
  if (a === "CONVERSION" || a === "BALANCE" || a === "BALANCE_TRANSFER") return true;
  return /\bconvert(ed)?\b|umbuchung|guthaben\s?umbuchung|balance\s?(transfer|cashback)|jar\b|zwischen eigenen konten/i
    .test(text);
}

// ═══════════════════════════════════════════════════════════════════════════

export interface LeseOptionen {
  /**
   * Falls der Export keine Transaktions-ID enthält: aus Datum, Betrag und
   * Verwendungszweck einen stabilen Ersatzschlüssel bilden.
   *
   * Standard AUS, und das mit Absicht. Zwei gleiche Zahlungen desselben Kunden
   * am selben Tag ergäben denselben Schlüssel — eine davon fiele beim Import
   * unter den Tisch. Lieber ein klarer Abbruch als ein leiser Verlust.
   */
  ersatzschluessel?: boolean;
}

/**
 * Kontoauszug lesen. Wirft `CsvFehler`, wenn eine Pflichtspalte fehlt oder die
 * Datei keine erkennbare Kopfzeile hat.
 */
export function leseWiseCsv(text: string, opt: LeseOptionen = {}): CsvBefund {
  const trenn = erkenneTrennzeichen(text);
  const alle = zerlege(text, trenn).filter((z) => z.some((f) => f.trim() !== ""));
  if (alle.length === 0) throw new CsvFehler("Die Datei ist leer.");

  // Kopfzeile suchen: Manche Exporte stellen Kontoinhaber und Zeitraum voran.
  // Genommen wird die erste Zeile, die mindestens drei Felder trifft.
  let kopfIndex = -1;
  let beste = 0;
  for (let i = 0; i < Math.min(alle.length, 15); i++) {
    const g = kopfGuete(alle[i]);
    if (g > beste) { beste = g; kopfIndex = i; }
  }
  if (kopfIndex < 0 || beste < 3) {
    throw new CsvFehler(
      "Keine Kopfzeile erkannt. Erwartet wird ein Kontoauszug mit Spaltenüberschriften " +
      `wie „Amount", „Date" und „TransferWise ID". Gefunden wurde in der ersten Zeile: ` +
      `${(alle[0] ?? []).map((h) => `„${h.trim()}"`).join(", ") || "(nichts)"}. ` +
      `Trennzeichen erkannt als „${trenn === "\t" ? "Tabulator" : trenn}".`,
    );
  }

  const kopfzeile = alle[kopfIndex].map((h) => h.trim());
  const spalten = erkenneSpalten(kopfzeile);

  const fehlend = PFLICHT.filter(([feld]) => !spalten[feld]);
  if (fehlend.length > 0 && !(opt.ersatzschluessel && fehlend.every(([f]) => f === "txnId"))) {
    throw new CsvFehler(
      `Im Kontoauszug fehlen Pflichtspalten: ${fehlend.map(([, t]) => t).join(", ")}.\n` +
      `Gefundene Überschriften: ${kopfzeile.map((h) => `„${h}"`).join(", ")}.\n` +
      "Der Import wurde abgebrochen — eine unvollständige Datei stillschweigend zu " +
      "verarbeiten würde Zahlungen verlieren.\n" +
      (fehlend.some(([f]) => f === "txnId")
        ? "Enthält der Export wirklich keine Transaktions-ID, kann ersatzweise ein " +
          "Schlüssel aus Datum, Betrag und Zweck gebildet werden (--ersatzschluessel). " +
          "Achtung: Zwei identische Zahlungen am selben Tag wären dann nicht unterscheidbar."
        : ""),
    );
  }

  const wert = (cols: string[], feld: string): string => {
    const s = spalten[feld];
    return s ? String(cols[s.index] ?? "").trim() : "";
  };

  const befund: CsvBefund = {
    eingaenge: [], ausgaenge: [], intern: [], uebersprungen: [],
    spalten, trennzeichen: trenn, kopfzeile,
    datenzeilen: 0, ohneDatum: 0, ersatzschluesselVerwendet: 0,
  };

  for (let i = kopfIndex + 1; i < alle.length; i++) {
    const cols = alle[i];
    const zeileNr = i + 1; // 1-basiert, wie in einem Tabellenprogramm
    befund.datenzeilen++;

    const betragRoh = wert(cols, "betrag");
    const cents = leseBetragCents(betragRoh);
    if (cents === null) {
      befund.uebersprungen.push({
        zeileNr,
        grund: betragRoh ? `Betrag „${betragRoh}" nicht lesbar` : "Betrag fehlt",
      });
      continue;
    }
    if (cents === 0) {
      befund.uebersprungen.push({ zeileNr, grund: "Betrag ist 0,00" });
      continue;
    }

    const zweck = wert(cols, "zweck");
    const beschreibung = wert(cols, "beschreibung");
    const bookedAt = leseDatum(wert(cols, "datum"));
    if (!bookedAt) befund.ohneDatum++;

    let txnId = wert(cols, "txnId");
    if (!txnId) {
      if (!opt.ersatzschluessel) {
        befund.uebersprungen.push({ zeileNr, grund: "Transaktions-ID fehlt in dieser Zeile" });
        continue;
      }
      txnId =
        "CSV-" +
        crypto.createHash("sha256")
          .update([bookedAt?.toISOString().slice(0, 10) ?? "", cents, zweck, beschreibung, wert(cols, "absender")].join("|"))
          .digest("hex")
          .slice(0, 20);
      befund.ersatzschluesselVerwendet++;
    }

    const richtungRoh = wert(cols, "richtung").toUpperCase();
    const art = wert(cols, "art");
    const text = `${zweck} ${beschreibung}`.trim();

    let richtung: Richtung;
    if (cents < 0) {
      richtung = "ausgang";
    } else if (/^(OUT|DEBIT|AUSGANG|WITHDRAWAL|ABBUCHUNG|SENT)$/.test(richtungRoh)) {
      richtung = "ausgang";
    } else if (istIntern(art, text)) {
      richtung = "intern";
    } else {
      richtung = "eingang";
    }

    const zeile: CsvZeile = {
      txnId,
      bookedAt,
      amountCents: Math.abs(cents),
      currency: (wert(cols, "waehrung") || "EUR").toUpperCase().slice(0, 3) || "EUR",
      payerName: wert(cols, "absender") || null,
      senderAccount: wert(cols, "absenderKonto") || null,
      referenceRaw: text || null,
      description: beschreibung || null,
      art: art || null,
      richtung,
      zeileNr,
    };

    if (richtung === "eingang") befund.eingaenge.push(zeile);
    else if (richtung === "ausgang") befund.ausgaenge.push(zeile);
    else befund.intern.push(zeile);
  }

  return befund;
}

/**
 * Doppelte Transaktions-IDs innerhalb EINER Datei zusammenfassen.
 *
 * Kommt vor, wenn zwei sich überlappende Zeiträume in eine Datei kopiert
 * wurden. Beim Import in die Datenbank fängt der eindeutige Schlüssel das
 * ohnehin ab — aber der Bericht soll nicht doppelt zählen.
 */
export function entdoppele<T extends { txnId: string }>(zeilen: T[]): { eindeutig: T[]; doppelt: number } {
  const gesehen = new Set<string>();
  const eindeutig: T[] = [];
  let doppelt = 0;
  for (const z of zeilen) {
    if (gesehen.has(z.txnId)) { doppelt++; continue; }
    gesehen.add(z.txnId);
    eindeutig.push(z);
  }
  return { eindeutig, doppelt };
}
