// ═══════════════════════════════════════════════════════════════════════════
// DIE WORTWAND AUS DEM SPRACHLEITFADEN — FIAON GLOBAL (Register E-510, 13.11.2026)
//
// WAS IST DAS?
//   Ein Prüfprogramm. Es liest jeden öffentlichen TEXT von FIAON Global (deutsch und englisch) und hält ihn gegen
//   den Sprachleitfaden: gegen die Wortliste für ein Prüfprogramm (Leitfaden, Abschnitt 14 — alle Zeilen, mit ihren
//   Stufen und Ausnahmen) und gegen die Punkte der Prüfliste (Abschnitt 13), die ein Programm prüfen kann.
//
// WAS WIRD GEPRÜFT?
//   Texte, nicht Quellcode-Zeilen. Bei Daten-Dateien die Zeichenketten der exportierten Objekte (mit Pfad zum Feld),
//   bei .tsx-Dateien die Zeichenketten und der sichtbare Text im JSX. Kommentare, Bezeichner, Klassennamen, Pfade
//   und Schlüssel zählen nicht. Dazu: der Text von /llms.txt, die Datenblöcke (JSON-LD) aus dem Vorab-HTML und die
//   Wörter der Vorschaubilder.
//   NICHT geprüft: der Vertrag und das persönliche Angebot (shared/fiaon-global-angebot*.ts), /start, die
//   Privat-Seiten, das Kundenportal, Mails und das Chefbüro.
//
// DIE STUFEN (wie im Leitfaden)
//   SPERRE      auf jeder öffentlichen Global-Seite verboten — ein Treffer ist ein Fehler
//   ORT         nur an den genannten Orten verboten (etwa: Österreich-Seite) — DORT ist ein Treffer ein Fehler
//   SPERRE-WIR  verboten nur mit FIAON oder „wir“ als Handelndem — das Programm zeigt die Stelle, ein Mensch entscheidet
//   EINMAL      höchstens einmal je Seite — gemeldet wird jedes weitere Vorkommen
//   HINWEIS     kein Fehler — die Stelle wird einem Menschen gezeigt
//
// BEDIENUNG
//   env -i PATH="$PATH" HOME="$HOME" node_modules/.bin/tsx scripts/pruef-global-leitfaden.ts            alle Quellen
//   … scripts/pruef-global-leitfaden.ts shared/fiaon-global-verkauf.ts client/src/pages/site/business.tsx   nur diese Dateien
//   … --zaehlen          nur die Tabelle (Zählung je Datei und Stufe)
//   … --nur SPERRE,ORT   nur Treffer dieser Stufen ausgeben (die Tabelle zählt immer alles)
//   … --knapp            ohne die Zeile mit dem Satz unter jedem Treffer
//   … --texte            zeigt nur, welche Texte das Programm aus den Dateien liest (Sprache, Rolle, Fläche)
//   … --text entwurf.txt --sprache en [--flaeche unterseite]   einen Entwurf prüfen (eine Zeile = ein Text)
//   Ausgabe je Treffer: Stufe · Datei · Feld oder Zeile · Fundwort · Ersatz laut Leitfaden.
//   Rückgabewert: 1 bei Treffern der Stufe SPERRE oder ORT (auch wenn eine genannte Datei nicht lädt), 2 wenn die
//   Gegenprobe scheitert, sonst 0.
//
// WO DAS PROGRAMM GENAUER HINSIEHT, ALS DIE TABELLE ES KANN
//   Einige Zeilen der Tabelle tragen eine Einschränkung in Klammern („für unser Entgelt“, „über uns“, „für unser Ziel“).
//   Die kann ein Programm nur am Ort festmachen. Deshalb gilt in Wissens-Artikeln (und, wo genannt, auf Zielgruppen- und
//   Staaten-Seiten) HINWEIS statt SPERRE für: Preis ohne „Ihr/unser“ (14-33b) · bestellen, buchen, kaufen (14-44) ·
//   Kreditlinie (14-09) · kostenlos bei Dritten (14-37) · Partnerbank eines fremden Anbieters (14-58) · transparent (14-70) ·
//   etabliert ohne „wir“ im Satz (14-78) · Bewertungen (14-79) · Mandanten von Anwälten (14-42) · Ziffer vor Wochen, Monaten,
//   Tagen bei gesetzlichen Fristen Dritter (14-32; „innerhalb von 10 Tagen“ bleibt überall SPERRE). An jeder dieser Regeln steht
//   ein Satz Begründung; wer es strenger will, ändert dort eine Zeile (stufeFuer).
//
// GEGENPROBE (läuft bei jedem Aufruf zuerst)
//   Eine Liste absichtlich falscher Sätze MUSS erkannt werden, eine Liste erlaubter Sätze (die Ausnahmen des
//   Leitfadens und jeder freigegebene feste Satz) darf NICHT anschlagen — sonst bricht das Programm ab.
//
// EINE ZEILE AUSNEHMEN
//   Steht in einer öffentlichen Datei ein Satz, den kein Besucher sieht (Meldung ans Team, Protokollzeile), dann
//   bekommt die Zeile den Kommentar  // wortwand: intern — <Grund>  (in derselben Zeile oder direkt darüber).
//   Das Programm zählt und nennt jede so markierte Zeile.
//
// OHNE DATENBANK, OHNE NETZ: Das Programm löscht DATABASE_URL, bevor es eine Server-Datei lädt.
// Regeln ändern heißt: zuerst den Leitfaden ändern, dann diese Datei — nie umgekehrt.
// ═══════════════════════════════════════════════════════════════════════════
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";

// Ohne Datenbank, ohne Netz: Nichts von hier aus darf eine Verbindung öffnen (die Liste der Redaktionsartikel lädt nur mit DATABASE_URL).
delete process.env.DATABASE_URL;
process.env.CRONS = "aus";
process.env.DOTENV_CONFIG_PATH = "/dev/null";

const WURZEL = path.resolve(import.meta.dirname, "..");
const relativ = (p: string): string => path.relative(WURZEL, path.resolve(WURZEL, p)).split(path.sep).join("/");
const lade = (datei: string): Promise<any> => import(pathToFileURL(path.join(WURZEL, datei)).href);
const quelltextCache = new Map<string, string>();
const quelltext = (datei: string): string => {
  if (!quelltextCache.has(datei)) quelltextCache.set(datei, fs.existsSync(path.join(WURZEL, datei)) ? fs.readFileSync(path.join(WURZEL, datei), "utf8") : "");
  return quelltextCache.get(datei)!;
};

// ═══════════════════════════════════════════════════════════════════════════
// 1  TYPEN
// ═══════════════════════════════════════════════════════════════════════════
type Stufe = "SPERRE" | "ORT" | "SPERRE-WIR" | "EINMAL" | "HINWEIS";
const STUFEN: readonly Stufe[] = ["SPERRE", "ORT", "SPERRE-WIR", "EINMAL", "HINWEIS"];
type Sprache = "de" | "en";
/** Auf welcher Fläche ein Text steht — danach richten sich die Regeln der Stufe ORT und einige Ausnahmen. */
type Flaeche =
  | "startseite" | "rechner" | "karte" | "fragen" | "fuss" | "menue" | "unterseite" | "wissen" | "landingpage"
  | "vertrauen" | "oesterreich" | "schweiz" | "llms" | "datenblock" | "vorschaubild" | "saetze";
type Rolle = "titel" | "beschreibung" | "h1" | "h2" | "titelartig" | "knopf" | "text";

interface Einheit {
  datei: string;
  /** Pfad zum Feld (Daten-Dateien) oder Beschreibung der Stelle. */
  feld: string;
  zeile?: number;
  sprache: Sprache;
  text: string;
  /** Adresse der Seite, zu der der Text gehört — für „höchstens einmal je Seite“. */
  seite?: string;
  /** Art der Registerseite (leistung, wissen, zielgruppe …). */
  art?: string;
  flaechen: readonly Flaeche[];
  rolle: Rolle;
  /** true = die Quelle der festen Sätze selbst (dort zählt „einmal je Seite“ nicht). */
  quelleSaetze?: boolean;
}
interface Treffer { stufe: Stufe; datei: string; feld: string; zeile?: number; fund: string; ersatz: string; regel: string; satz: string }
interface Kontext { e: Einheit; fund: string; index: number; satz: string; davor: string; danach: string }
interface Regel {
  /** Zeile der Tabelle in Abschnitt 14 („14-07“) oder Punkt der Prüfliste („13-…“). */
  id: string;
  stufe: Stufe;
  de?: RegExp;
  en?: RegExp;
  ersatzDe: string;
  ersatzEn: string;
  /** Die Regel gilt nur für diese Texte (Ort, Rolle). */
  wo?: (e: Einheit) => boolean;
  /** true = dieser Fund ist eine Ausnahme des Leitfadens. */
  ausnahme?: (k: Kontext) => boolean;
  /** Stufe für diesen einen Fund (null = kein Treffer) — wo der Leitfaden nach Ort oder Zusammenhang unterscheidet. */
  stufeFuer?: (k: Kontext) => Stufe | null;
}

const hat = (e: Einheit, ...f: Flaeche[]): boolean => f.some((x) => e.flaechen.includes(x));
/** Wissens-Artikel und Übersichten erklären den Markt — dort beschreibt manches Wort fremde Dinge. */
const erklaerend = (e: Einheit): boolean => hat(e, "wissen") || e.art === "wissen" || e.art === "hub";
const suchRolle = (e: Einheit): boolean => e.rolle === "titel" || e.rolle === "beschreibung" || e.rolle === "h1";
const titelArtig = (e: Einheit): boolean => ["h1", "h2", "titelartig", "titel"].includes(e.rolle) || e.text.trim().split(/\s+/).length <= 3;

// ═══════════════════════════════════════════════════════════════════════════
// 2  HILFEN: Suchbegriffe wie im Leitfaden („Kartenleiter*“ = jede Endung; ganzes Wort; Groß und Klein zählt nicht)
// ═══════════════════════════════════════════════════════════════════════════
const VOR = "(?<![\\p{L}\\p{N}])";
const NACH = "(?![\\p{L}\\p{N}])";
function w(...begriffe: string[]): RegExp {
  const teile = [...begriffe].sort((a, b) => b.length - a.length).map((b) => b.trim().split(/\s+/)
    .map((x) => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[\\p{L}\\p{N}]*").replace(/-/g, "[-‑–]").replace(/'/g, "['’]"))
    .join("[\\s\\u00a0]+"));
  return new RegExp(`${VOR}(?:${teile.join("|")})${NACH}`, "giu");
}
/** Der Satz um eine Fundstelle (Punkt, Frage- und Ausrufezeichen, Strichpunkt, Zeilenwechsel begrenzen ihn). */
function satzUm(t: string, von: number, bis: number): string {
  const grenze = (i: number): boolean => t[i] === "\n" || t[i] === ";" || (/[.!?…]/.test(t[i]) && (i + 1 >= t.length || /\s/.test(t[i + 1])));
  let a = von; while (a > 0 && !grenze(a - 1)) a--;
  let b = bis; while (b < t.length && !grenze(b)) b++;
  return t.slice(a, Math.min(t.length, b + 1)).replace(/\s+/g, " ").trim();
}
const glatt = (t: string): string => t.replace(/[\s ]+/g, " ").trim();
const kurz = (t: string, n = 150): string => { const g = glatt(t); return g.length > n ? `${g.slice(0, n - 1)}…` : g; };

// ═══════════════════════════════════════════════════════════════════════════
// 3  DIE REGELN — Abschnitt 14 des Leitfadens, Zeile für Zeile (Nummer = Zeile der Tabelle)
// ═══════════════════════════════════════════════════════════════════════════
function r(nr: number | string, stufe: Stufe, de: RegExp | null, en: RegExp | null, ersatzDe: string, ersatzEn: string, mehr: Partial<Regel> = {}): Regel {
  return { id: typeof nr === "number" ? `14-${String(nr).padStart(2, "0")}` : nr, stufe, de: de ?? undefined, en: en ?? undefined, ersatzDe, ersatzEn, ...mehr };
}

// Wörter zur Bürgschaft (dieselbe Wand wie scripts/pruef-global-seiten.ts, Abschnitt 14 dort) — und was einen Satz zu UNSEREM macht.
const BUERG = /b(?:ü|ue)rgschaft\p{L}*|b(?:ü|ue)rgin|(?<![\p{L}])b(?:ü|ue)rg(?:t|en|e)(?![\p{L}])|verb(?:ü|ue)rg\p{L}*|guarantor\p{L}*|surety|guaranty/giu;
const UNSERE = /FIAON|(?<![\p{L}])(?:wir|uns|unser\p{L}*|we|our)(?![\p{L}])|Partnergesellschaft|partner company|Erfolgshonorar|success fee|(?<![\p{L}])(?:enthalten|inklusive|eingeschlossen|included?|includes)(?![\p{L}])/iu;
/** Spricht der Satz von uns? (FIAON, wir, unser — we, our) */
const VON_UNS = /FIAON|(?<![\p{L}])(?:wir|uns|unser\p{L}*|we|our)(?![\p{L}])/iu; // ohne “us”: Das träfe jedes „US-…“
const VERNEINT_DE = /(?<![\p{L}])(?:kein|keine|keiner|keinen|nicht|weder|noch|nie)(?![\p{L}])[^.;!?]*$/iu;
const VERNEINT_EN = /(?<![\p{L}])(?:not|no|neither|nor|never)(?![\p{L}])[^.;!?]*$/iu;
const KARTE_IM_SATZ = /karte|card/iu;
// Banknamen: die Liste der bestehenden Wand (E-188), dazu einige eindeutige Namen.
const BANKNAMEN = /(?<![\p{L}])(?:capital one|american express|amex|bank of america|chase|mercury|brex|ramp|wells fargo|jpmorgan|j\.\s?p\.\s?morgan|citibank|deutsche bank|commerzbank|revolut|dkb)(?![\p{L}])/giu;
// Österreich-Seite: Konto, Karte, Finanzierung und alles, was dasselbe meint — auch als Teil eines Worts.
const AT_DE = /(?<![\p{L}])[\p{L}‑-]*(?:konto|konten|karte(?!ll)|finanzier|partnerbank|darlehen|kredit|kapitalrahmen|funding)[\p{L}‑-]*|geld[-‑\s]zurück\p{L}*/giu;
const AT_EN = /(?<![\p{L}])(?:(?:bank\s+)?accounts?|(?:credit\s+)?cards?|financing|partner banks?|money[-‑]back|loans?|lenders?|funding|credit\s+(?:lines?|applications?|limits?)|capital\s+(?:range|target|framework|part|stage))(?![\p{L}])/giu;
const AT_BETRAG = /\d[\d.,]*\s?(?:€|Euro|EUR)(?![\p{L}])|€\s?\d[\d.,]*/giu;
const CH_DE = /(?<![\p{L}])[\p{L}‑-]*(?:konto|konten|karte(?!ll))[\p{L}‑-]*/giu;
const CH_EN = /(?<![\p{L}])(?:(?:bank\s+)?accounts?|(?:credit\s+)?cards?)(?![\p{L}])/giu;
// Leitplanke 7: nur „Schwarzott Group“ (und der Name des Gründers in Satz S13) — kein anderer Name, keine Rechtsform.
const SCHWARZOTT = /(?<!Justin\s)Schwarzott(?!\s+Group(?![\p{L}]))|Schwarzott\s+Group\s+(?:AG|LLC|GmbH|Ltd\.?|Inc\.?|Corp\.?)(?![\p{L}])/gu;
/** Ist diese Zahl einer der Honorar-Beträge aus der Preisquelle? (gefüllt, sobald die Sätze geladen sind) */
let HONORAR_ZAHLEN: string[] = [];
const honorarZahl = (fund: string): boolean => HONORAR_ZAHLEN.includes(fund.replace(/[^\d]/g, ""));
const NAME_ERLAUBT = (e: Einheit): boolean => hat(e, "startseite", "rechner", "saetze") && !suchRolle(e) && !hat(e, "datenblock");

const REGELN: Regel[] = [
  // ── A. Jargon rund um Karten und Kapital ──
  r(1, "SPERRE", w("Kartenleiter*"), w("card ladder*"), "Kreditkarten auf Wunsch", "credit cards on request"),
  r(2, "SPERRE", w("Stacking", "Kartenstapel*", "gestapelt*"), w("stacking", "card stack*"), "viele Kartenanträge in kurzer Zeit", "multiple card applications in quick succession", {
    // Ausnahme: das Suchwort einmal in Anführungszeichen im einen Wissens-Artikel (die Zählung „einmal“ übernimmt die Seitenprüfung).
    ausnahme: (k) => /stacking/.test(k.e.seite ?? "") && /^stacking$/i.test(k.fund) && /[„“"”«‘']\s?(?:Kreditkarten[-‑]|credit card )?$/iu.test(k.davor),
  }),
  r(3, "SPERRE", w("Trick*", "Kniff*", "Geheimtipp*", "Hack", "Hacks"), w("trick*", "hack*", "secret", "secrets"), "geordnetes Vorgehen", "an orderly process"),
  r(4, "SPERRE", w("Hebel*", "hebeln", "Turbo", "Booster", "Leverage"), w("leverage*", "boost*"), "Finanzierung · Spielraum für Investitionen", "financing · scope for investment"),
  r(5, "SPERRE", w("Kapitalaufbau*", "Kapital aufbauen", "Weg zum Kapital", "Kapital-Etappe*", "Weiter wachsen"), w("building capital", "route to capital", "capital stage*", "keep growing"), "Finanzierung · Finanzierungsphase", "financing · financing phase"),
  r(6, "HINWEIS", w("Kapital"), w("Capital"), "Finanzierung (als Titel von Bereich, Kachel, Schritt)", "Financing (as a heading)", { wo: (e) => titelArtig(e) && e.text.trim().split(/\s+/).length <= 4 }),
  r(7, "SPERRE", w("Funding*"), w("funding programme*", "funding program*", "get funded"), "Finanzierung · Aufstockung", "financing · an increase", {
    // Ausnahme: „US Funding“ in Titel, H1 und erstem Absatz des einen Wissens-Artikels.
    ausnahme: (k) => /us-funding/.test(k.e.seite ?? "") && /US[\s‑-]$/iu.test(k.davor.slice(-3)) && (k.e.rolle === "titel" || k.e.rolle === "h1" || /\.(lead|kurz)$|bloecke\[0\]\.absaetze\[0\]$/.test(k.e.feld)),
  }),
  r(8, "SPERRE", w("Deal*"), w("deal*"), "Mandat · Vereinbarung", "engagement · agreement", { ausnahme: (k) => /^(?:s|ing|t)?\s+with(?![\p{L}])/iu.test(k.fund.replace(/^deal/i, "") + k.danach.slice(0, 8)) || /great\s+$/iu.test(k.davor) }),
  r(9, "SPERRE", w("Ziel-Limit*", "Ziellimit*", "Wunschlimit*", "Zielrahmen*", "Kreditlinie*"), w("target limit*", "funding limit*", "credit line*"), "Kapitalrahmen — von Ihnen gewählt · beim Herausgeber: Kartenrahmen", "funding target — chosen by you · at the issuer: card limit", {
    // „Kreditlinie“ / “credit line” ist gesperrt für UNSER Ziel; in Wissens-Artikeln kann es ein Produkt eines Instituts meinen.
    stufeFuer: (k) => (/kreditlinie|credit line/i.test(k.fund) && erklaerend(k.e) ? "HINWEIS" : "SPERRE"),
  }),
  r(10, "HINWEIS", w("skalier*", "hochskalier*"), w("scale", "scales", "scaling"), "aufstocken · Aufstockung", "increase"),
  r(11, "SPERRE", w("Etappe*", "Journey"), w("stage", "stages", "journey*"), "Schritt · Ablauf", "step · process"),
  r(12, "HINWEIS", w("Investor*", "Geldgeber*"), w("funder*", "investor*"), "das finanzierende Institut", "the lender", { wo: (e) => !erklaerend(e), ausnahme: (k) => /Banken und Investoren|banks and investors/i.test(k.satz) }),

  // ── B. Zusagen und Ergebnisse ──
  r(13, "SPERRE", w("garantier*", "zugesichert*", "zusicher*", "wir versprechen", "versprechen wir"), w("guaranteed", "we guarantee", "assured", "we promise"), "Über … entscheidet …", "… rests with …"),
  r(14, "SPERRE", w("Garantie", "Garantien"), w("guarantee", "guarantees", "guaranteeing"), "der Anspruch auf Erstattung · auf Unterseiten die Kurz-Form S7 ohne das Hauptwort", "the right to a refund · “money-back commitment”", {
    ausnahme: (k) => (k.e.sprache === "de"
      ? /Geld[-‑]zurück[-‑]$/iu.test(k.davor) && NAME_ERLAUBT(k.e)
      : /personal\s+$/i.test(k.davor)),
  }),
  r(15, "SPERRE", w("bis zu"), w("up to"), "von … bis … (Achtung: trifft auch „bis zu den Steuernummern“ — dann „bis zur Steuernummer“)", "from … to …"),
  r(16, "SPERRE", BUERG, BUERG, "Satz S5-B — steht nur im persönlichen Angebot und im Vertrag", "sentence S5-B — only in the personal proposal and the agreement", {
    // Ausnahme: Marktwissen in Wissens-Artikeln (Bürgschaft einer Muttergesellschaft, die Bürgen beim SBA-Kredit) — nie mit FIAON, „wir“, Partnergesellschaft, Honorar.
    stufeFuer: (k) => (erklaerend(k.e) && !UNSERE.test(k.satz) ? null : "SPERRE"),
  }),
  r(17, "ORT", w("Partnergesellschaft*", "inaktiv*", "als aktiv geführt"), w("partner company", "partner companies", "inactive", "listed as active"), "(nichts) · Schwarzott Group mit S13, nur auf der Partnerseite", "(nothing) · Schwarzott Group with S13", {
    wo: (e) => hat(e, "startseite", "rechner", "karte", "fragen", "fuss", "menue"),
  }),
  r(18, "SPERRE", w("bis zur Auszahlung"), w("payout", "payouts", "through to payout"), "bis zur Entscheidung des finanzierenden Instituts", "through to the lender’s decision"),
  r(19, "SPERRE-WIR", w("wir eröffnen", "eröffnen wir", "Konto aus einer Hand"), w("we open", "open your account"), "Satz S2", "sentence S2"),
  r(20, "SPERRE", w("Sie bekommen", "Karte inklusive", "Kreditkarten kommen"), w("you get", "cards are added"), "Wir bereiten Ihren Kartenantrag vor; über die Karte entscheidet der Herausgeber.", "We prepare your card application; the issuer decides.", {
    ausnahme: (k) => /^cards are added$/i.test(k.fund) && /^\s+together/i.test(k.danach),
  }),
  r("14-20b", "SPERRE", w("Sie erhalten"), w("you receive"), "Wir bereiten Ihren Kartenantrag vor; über die Karte entscheidet der Herausgeber.", "We prepare your card application; the issuer decides.", { stufeFuer: (k) => (KARTE_IM_SATZ.test(k.satz) ? "SPERRE" : null) }),
  r(21, "SPERRE-WIR", new RegExp(`${w("besorg*", "verschaff*", "Nummern einholen").source}|Steuernummern?\\s+ein(?![\\p{L}])|${VOR}hol(?:en|t)\\s+(?:wir\\s+)?(?:die|Ihre|eine)\\s+(?:EIN|ITIN|Steuernummern?)${NACH}`, "giu"), w("obtain*", "secure", "secures", "secured", "get you"), "beantragen", "apply for", {
    // „verboten nur mit FIAON oder wir als Handelndem“: ohne uns im Satz (eine Gesellschaft „obtains“ etwas) ist es kein Treffer.
    stufeFuer: (k) => (VON_UNS.test(k.satz) ? "SPERRE-WIR" : null),
  }),
  r(22, "HINWEIS", w("eingetragen"), w("registered"), "angemeldet und dokumentiert; über die Eintragung entscheidet der Bundesstaat", "filed and documented; registration is decided by the state", {
    ausnahme: (k) => /^\s+im Companies House/i.test(k.danach) || /^\s+(?:agents?|office|address|in England|with Companies House|with the UK)/i.test(k.danach),
  }),
  r(23, "SPERRE", w("alle 18 Monate", "alle achtzehn Monate"), w("every 18 months", "every eighteen months"), "ab dem achtzehnten Monat", "from the eighteenth month"),
  r(24, "SPERRE",
    new RegExp(`${w("niedrige* Zins*", "niedrigere* Zins*", "Zinsen niedrig", "Zinslast niedrig", "zinsfrei*", "fast null Prozent").source}|${VOR}0\\s?%|\\d+(?:[.,]\\d+)?\\s?%\\s?(?:p\\.\\s?a\\.|pro Jahr|Zins|Sollzins|effektiv)|${VOR}Zins\\p{L}*\\s+(?:von\\s+)?(?:ca\\.\\s+|rund\\s+|etwa\\s+)?\\d+(?:[.,]\\d+)?\\s?(?:%|Prozent)`, "giu"),
    new RegExp(`${w("low interest", "low-interest", "interest costs low", "interest-free").source}|${VOR}0\\s?%|${VOR}(?:0|zero)\\s?per\\s?cent${NACH}|\\d+(?:\\.\\d+)?\\s?(?:%|per\\s?cent)\\s?(?:p\\.\\s?a\\.|APR|a year|per year|interest)|${VOR}interest(?: rates?)?\\s+(?:of\\s+)?(?:approx\\.\\s+|around\\s+|about\\s+)?\\d+(?:\\.\\d+)?\\s?(?:%|per\\s?cent)`, "giu"),
    "(keine Zinsaussage — höchstens die Absicht aus 2.7)", "(no statement on interest — at most the aim in 2.7)"),
  r(25, "SPERRE", w("ohne Sicherheiten", "ohne Bareinlage"), w("unsecured", "no collateral", "collateral-free", "no cash deposit"), "Welche Sicherheiten ein Institut verlangt, entscheidet das Institut; in der Regel haften Sie persönlich.", "The institution decides what security it requires; as a rule, you are personally liable."),
  r(26, "SPERRE", w("Steuern sparen", "steuerfrei*", "Steuervorteil*", "Steuerersparnis*"), w("save tax", "tax-free", "tax advantage*", "tax saving*"), "Satz S10", "sentence S10", {
    // Wie in der bestehenden Wand: „steuerfrei“ / “tax-free” nur als zitierte Behauptung anderer (in Anführungszeichen).
    ausnahme: (k) => /^(?:steuerfrei|tax[-‑]free)/i.test(k.fund) && /[„“"«‘]$/u.test(k.davor),
  }),
  r(27, "SPERRE", w("alles inklusive", "Alles darin", "alles enthalten", "kümmern uns um alles", "jeden Schritt", "Rundum-sorglos*", "Komplettpaket*", "Komplettlösung*"), w("all-inclusive", "everything in it", "take care of everything", "every step", "one-stop shop"), "Im ersten Jahr enthalten: (Liste) · Wir übernehmen: … Sie selbst: …", "Included in the first year: (list)"),
  r(28, "SPERRE", w("unterschreiben, was wir vorbereiten"), w("sign what we prepare"), "Wir legen Ihnen jede Unterlage unterschriftsreif vor.", "We present every document ready for your signature."),
  r(29, "SPERRE", w("klappt", "gelingt", "Erfolgsquote*", "erfolgreich*"), w("success rate*", "it works", "proven"), "es entscheidet … (erlaubt bleibt das Vertragswort „Erfolgshonorar“)", "… decides (“success fee” remains)"),
  r(30, "HINWEIS", w("aus der Ferne", "Sie bleiben, wo Sie sind"), w("remotely", "you stay where you are"), "Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami. — nie als Zusage für Konto, Karte, Finanzierung", "From US$1 million, we work with you in person in Miami."),
  r(31, "SPERRE", new RegExp(`${VOR}für jeden(?![\\p{L}])(?!\\s+(?!Unternehmer|Gründer|Selbständigen|Selbstständigen|Kunden|Klienten|Inhaber|Fall)\\p{Lu})|${w("für alle Vorhaben", "lohnt sich immer").source}`, "giu"), w("for everyone"), "für Unternehmer mit einem Vorhaben, das eine eigene US-Gesellschaft trägt", "for business owners whose plans warrant a US company of their own"),
  r(32, "SPERRE",
    /(?<![\p{L}\p{N}.,])\d[\d.,]*[\s ‑-]?(?:(?:bis|–|-)\s?\d[\d.,]*\s?)?(?:Wochen?|Monat(?:e|en|s)?|Tag(?:e|en|es)?|Stunden?|Werktag(?:e|en)?|Arbeitstag(?:e|en)?|Kalendertag(?:e|en)?)(?![\p{L}])/giu,
    /(?<![\p{L}\p{N}.,$€£])\d[\d,.]*[\s ‑-]?(?:(?:to|–|-)\s?\d[\d,.]*[\s‑-]?)?(?:working\s+|business\s+|calendar\s+)?(?:hours?|days?|weeks?|months?)(?![\p{L}])/giu,
    "Zahlwort („acht Wochen“, „achtzehnter Monat“); für Dauern Satz S15", "number in words; otherwise sentence S15", {
    // Gemeint sind UNSERE Zeitangaben (5.5). In Wissens-Artikeln und auf Staaten-Seiten stehen gesetzliche Fristen Dritter mit
    // Quelle — dort ist nur gesperrt, was auch die bestehende Wand sperrt („innerhalb von 10 Tagen“, „in 3–5 Wochen“); der Rest wird gezeigt.
    stufeFuer: (k) => {
      if (!(erklaerend(k.e) || k.e.art === "staat")) return "SPERRE";
      const frist = k.e.sprache === "de"
        ? /(?<![\p{L}])(?:innerhalb|binnen)\s+(?:von\s+)?$/iu.test(k.davor) || (/(?<![\p{L}])in\s+$/iu.test(k.davor) && /\d\s?(?:–|-|bis)\s?\d/.test(k.fund))
        : /(?<![\p{L}])(?:within|in)\s+$/iu.test(k.davor);
      return frist ? "SPERRE" : "HINWEIS";
    },
  }),
  r("14-32b", "HINWEIS", /(?<![\p{L}\p{N}.,])\d[\d.,]*[\s ‑-]?Minuten?(?![\p{L}])/giu, /(?<![\p{L}\p{N}.,])\d[\d,.]*[\s ‑-]?minutes?(?![\p{L}])/giu, "Zahlwort („dreißig Minuten“)", "number in words (“thirty minutes”)"),

  // ── C. Geld und Honorar ──
  r(33, "SPERRE", w("Ihr Preis", "Ihre Preise", "Ihren Preis", "Ihrem Preis", "Ihres Preises", "unser Preis", "unsere Preise", "unseren Preis"), w("your price", "your prices", "our price", "our prices"), "Honorar · Ihre Honorarübersicht", "fee · schedule of fees"),
  r("14-33b", "SPERRE", w("Preis", "Preise", "Preises", "Preisen"), w("price", "prices"), "Honorar (unser Entgelt) · Gebühr (Staat, Institut) · Kosten (Dritte) — „Endpreis“ bleibt", "fee (ours) · charge (third parties)", {
    // „Preis (für unser Entgelt)“: In Wissens-Artikeln kann das Wort fremde Preise meinen — dort zeigt das Programm die Stelle nur.
    stufeFuer: (k) => (erklaerend(k.e) ? "HINWEIS" : "SPERRE"),
  }),
  r(34, "SPERRE", w("Festpreis*", "ein Preis"), w("fixed price*", "one price"), "Ihr Honorar steht fest, bevor Sie unterzeichnen.", "Your fees are set out in full before you sign."),
  r(35, "SPERRE", w("Paket*", "Tarif*"), w("package*", "tier", "tiers", "tiered"), "Mandat · Leistung und Honorar", "engagement · services and fees"),
  r(36, "SPERRE", new RegExp(`${w("günstig*", "billig*", "preiswert*", "Rabatt*", "schon ab").source}|${VOR}(?:ab|nur)\\s+(?:nur\\s+)?\\d[\\d.]*(?:,\\d+)?\\s?(?:€|Euro|EUR)(?![\\p{L}])`, "giu"),
    new RegExp(`${w("cheap*", "affordable", "discount*", "from just").source}|${VOR}only\\s+(?:€|US\\$|\\$|£)\\s?\\d[\\d,.]*|${VOR}from\\s+€\\s?\\d[\\d,.]*(?!\\s*(?:to|–|-))`, "giu"),
    "den Betrag nennen, mit Fälligkeit · „mindestens“ statt „ab“", "state the fee and when it falls due · “at least”"),
  r("14-36b", "HINWEIS", new RegExp(`${VOR}ab\\s+(?:etwa\\s+|rund\\s+)?\\d[\\d.]*(?:,\\d+)?\\s?(?:Mio\\.?\\s?)?(?:US-Dollar|US-\\$|USD|\\$)`, "giu"), null, "bei einem Honorar „mindestens“ statt „ab“; eine Schwelle (Umsatz, Kapitalrahmen) darf bleiben", "", {
    ausnahme: (k) => /^ab\s+1\s+Mio/i.test(k.fund),
  }),
  r(37, "SPERRE", w("keine Mehrkosten", "ohne Mehrkosten", "kostenlos*", "gratis"), new RegExp(`(?<![\\p{L}\\p{N}‑-])free(?![\\p{L}\\p{N}‑-])|${w("at no cost").source}`, "giu"), "ohne zusätzliches Honorar von FIAON (erlaubt: „Erstgespräch … kostenfrei“)", "at no additional fee from FIAON (allowed: “free of charge”)", {
    ausnahme: (k) => /^\s+of charge/iu.test(k.danach) || /^\s+to(?![\p{L}])/iu.test(k.danach) || /feel\s+$/iu.test(k.davor),
    // 4.2 Nr. 37 meint unsere Leistung und die Karten. Was ein Dritter nichts kosten lässt (Auskunft einer Behörde), zeigt das Programm nur.
    stufeFuer: (k) => (/mehrkosten/i.test(k.fund) || VON_UNS.test(k.satz) || KARTE_IM_SATZ.test(k.satz) || !erklaerend(k.e) ? "SPERRE" : "HINWEIS"),
  }),
  r(38, "SPERRE", w("versteckte* Kosten"), w("hidden cost*"), "Nicht enthalten sind: …", "Not included: …"),
  r(39, "HINWEIS", w("Provision*", "Sie investieren"), w("commission*", "your investment"), "Honorar · Sie zahlen („Investitionen“ des Klienten bleiben erlaubt)", "fee · you pay"),
  r(40, "SPERRE", w("Abo", "Abos", "Abonnement*"), w("subscription*", "annual care"), "Jahresbetreuung — sie verlängert sich nicht von selbst", "annual administration — it does not renew automatically", {
    ausnahme: (k) => /(?<![\p{L}])(?:kein|keine|ohne)\s+$/iu.test(k.davor) || (/^subscription/iu.test(k.fund) && /(?<![\p{L}])(?:no|without)\s+(?:a\s+)?$/iu.test(k.davor)),
  }),
  r(41, "SPERRE", null, w("final price*"), "(deutsch bleibt: Endpreis)", "stated in full; nothing is added"),

  // ── D. Rollen und Begriffe ──
  r(42, "SPERRE", w("Mandant*"), null, "Klient · Sie", "client", {
    // „Mandant“ ist das Wort der Anwälte und Steuerberater — für DEREN Mandanten darf es stehen (das Programm zeigt die Stelle).
    stufeFuer: (k) => (/Anw[aä]lt|Steuerberater|Kanzlei/i.test(k.satz) ? "HINWEIS" : "SPERRE"),
  }),
  r(43, "HINWEIS", w("Kunde*", "Kundin*"), w("customer*"), "Klient · Sie (erlaubt für die Kunden des Klienten)", "client (allowed for the client’s own customers)", {
    // Gezeigt wird, wo das Wort unsere Auftraggeber meinen kann — nicht in Wissens- und Zielgruppen-Texten über die Kunden des Klienten.
    stufeFuer: (k) => (/(?<![\p{L}])(?:unser\p{L}*|our)\s+$/iu.test(k.davor) || !(erklaerend(k.e) || ["zielgruppe", "land", "staat"].includes(k.e.art ?? "")) ? "HINWEIS" : null),
  }),
  r(44, "SPERRE", w("Bestellung*", "bestell*", "buchen", "bucht", "gebucht", "kaufen", "kauft", "gekauft", "Jetzt beauftragen"), w("order", "Order now", "My order", "book", "buy"), "Mandat erteilen · Angebot anfordern", "instruct us · request your proposal", {
    ausnahme: (k) => /in\s+$/i.test(k.davor) && /^order$/i.test(k.fund),
    // Shop-Sprache ist gesperrt für UNSER Mandat; auf Wissens- und Zielgruppen-Seiten kann sie das Geschäft des Klienten beschreiben.
    stufeFuer: (k) => (erklaerend(k.e) || ["zielgruppe", "land", "staat"].includes(k.e.art ?? "") ? "HINWEIS" : "SPERRE"),
  }),
  r(45, "SPERRE", null, new RegExp(`${VOR}(?:(?:your|the|an|our|this|that|my|personal|new|binding|written)\\s+offer(?:\\s+page)?|offer\\s+page)${NACH}`, "giu"), "(deutsch bleibt: Angebot)", "proposal · proposal page", {
    ausnahme: (k) => /financing offer|loan offer|such an offer|offer (?:from|of) (?:the |a |an |your )?(?:lender|institution|bank|issuer)/i.test(k.satz),
  }),
  r(46, "SPERRE", null, w("mandate", "mandates"), "(deutsch bleibt: Mandat)", "engagement"),
  r(47, "SPERRE", w("Konfigurator*"), w("configurator*"), "Honorarrechner · Abschnittstitel „Ihr Angebot“", "fee calculator"),
  r(48, "SPERRE", w("Angebot zusammenstellen", "selbst zusammen", "Mein Angebot öffnen"), w("Build your offer", "Prepare your proposal", "Put it together"), "Angebot anfordern", "Request your proposal"),
  r(49, "SPERRE", w("Erst sprechen", "Kick-off", "Kickoff", "Call", "Calls", "Kennenlernen"), w("Talk first", "kick-off", "kickoff", "discovery call"), "Gespräch vereinbaren · Erstgespräch", "Arrange a call · initial call"),
  r(50, "SPERRE", new RegExp(`${w("Rechtsberatung*", "Steuerberatung*").source}|${VOR}unser(?:e|en|em|er|es)?\\s+(?:Anw[aä]lt\\p{L}*|Steuerberater\\p{L}*|US-CPAs?)${NACH}`, "giu"), w("legal advice", "tax advice", "our lawyers", "our lawyer", "our accountant", "our accountants"), "Partner-Anwälte · US-Steuerberater (CPA) aus unserem Partnernetz", "partner lawyers · US certified public accountant (CPA) from our partner network"),
  r(51, "SPERRE", w("berät", "berate", "beraten", "beratet", "Beratung", "Beratungen", "Berater", "Beraters", "Beratern", "Beraterin", "Beraterinnen"), w("advise", "advises", "advised", "advising", "advice"), "erklären · vorbereiten · begleiten (erlaubt: Unternehmensberatung, Steuerberater)", "explain · prepare · support"),
  r(52, "SPERRE", w("im eigenen Mandat", "auf Ihr Mandat", "für Sie tätig"), w("under their own mandate", "under your engagement", "act for you", "acts for you"), "in eigener Verantwortung", "in their own professional capacity"),
  r(53, "SPERRE-WIR", w("Kanzlei", "Kanzleien", "Sozietät*"), w("law firm", "law firms", "solicitors"), "Unternehmensberatung (erlaubt: „keine Kanzlei“)", "business consultancy (allowed: “not a law firm”)", {
    ausnahme: (k) => (k.e.sprache === "de" ? VERNEINT_DE : VERNEINT_EN).test(k.davor.slice(-80)),
  }),
  r(54, "ORT", w("Unternehmensberat*"), w("consultancy", "consultancies", "consulting", "consultant*"), "FIAON Global", "FIAON Global", { wo: (e) => hat(e, "oesterreich") }),
  r(55, "ORT", AT_DE, AT_EN, "Satz S17 — auf der Österreich-Seite kein Wort zu Konto, Karte, Finanzierung", "sentence S17 — nothing on accounts, cards or financing on the Austria page", {
    wo: (e) => hat(e, "oesterreich"),
    // “take into account” ist kein Konto.
    ausnahme: (k) => /^accounts?$/iu.test(k.fund) && (/(?<![\p{L}])(?:into|on|of)\s+$/iu.test(k.davor) || /^\s+(?:for|of)(?![\p{L}])/iu.test(k.danach)),
  }),
  r("14-55b", "ORT", AT_BETRAG, AT_BETRAG, "kein Honorar-Betrag auf der Österreich-Seite: „Ihr Honorar steht in Ihrem persönlichen Angebot, bevor Sie unterzeichnen.“", "no fee amount on the Austria page", {
    wo: (e) => hat(e, "oesterreich"),
    // Ein Betrag aus der Preisquelle ist ein Honorar (Fehler); jeder andere Euro-Betrag (etwa eine Steuer-Schwelle) wird nur gezeigt.
    stufeFuer: (k) => (honorarZahl(k.fund) ? "ORT" : "HINWEIS"),
  }),
  r("14-55c", "ORT", CH_DE, CH_EN, "Schweiz: Konto und Karte nie in Titel, Beschreibung oder H1", "Switzerland: accounts and cards never in title, description or H1", { wo: (e) => hat(e, "schweiz") && suchRolle(e) }),
  r(56, "SPERRE", w("Experte", "Experten", "Expertin*", "Profi", "Profis", "Spezialist*"), w("expert", "experts", "specialist*"), "die Rolle nennen: Partner-Anwälte · US-Steuerberater (CPA) · Ihr Ansprechpartner", "name the role"),
  r(57, "SPERRE", w("Team vor Ort", "Team in Miami", "Büro in London", "Büro in Miami", "Büro in Zürich", "Partner in Zürich"), w("team on the ground", "Miami office", "London office", "team in Miami"), "unsere Partner in den USA · Sitz London", "our partners in the United States · registered office in London"),
  r(58, "SPERRE", new RegExp(`${w("Partnerbank*", "unsere Bank*", "unserer Bank", "unseren Banken", "mit der Bank abgestimmt").source}|${BANKNAMEN.source}`, "giu"), new RegExp(`${w("partner bank*", "our bank*").source}|${BANKNAMEN.source}`, "giu"), "das finanzierende Institut · das jeweilige Institut · der Herausgeber", "the lender · each institution · the card issuer", {
    // „Partnerbank“ ist gesperrt als UNSERE; in Wissens-Artikeln kann das Wort die Bank eines fremden Anbieters meinen.
    stufeFuer: (k) => (/^partner\s?bank/iu.test(k.fund) && erklaerend(k.e) && !/(?<![\p{L}])(?:unser\p{L}*|our)\s+$/iu.test(k.davor) ? "HINWEIS" : "SPERRE"),
  }),
  r(59, "SPERRE", w("führen ihr Büro", "führen Ihre Gesellschaft", "führt Ihre Gesellschaft"), w("run its office", "runs its office", "actively managed", "active management"), "mit aktiver Betreuung · Wir stellen Ihr US-Büro.", "ongoing administration · we provide its US office"),
  r(60, "SPERRE", null, w("fast track", "fast-track"), "(deutsch bleibt: Fast-Track)", "priority handling"),
  r(61, "HINWEIS", w("Ordnung"), w("Order"), "Pflichten und Fristen (als Titel)", "Compliance (as a title)", { wo: (e) => /^(?:[IVX]+\.?\s+)?(?:Ordnung|Order)\.?$/i.test(e.text.trim()) }),
  r(62, "SPERRE", w("Mustervertrag*", "Vertrag vorab"), w("model contract", "specimen agreement", "sample contract"), "Vertrag im Überblick", "Agreement at a glance"),
  r(63, "SPERRE", w("Affiliate*"), w("affiliate", "affiliates"), "Partner", "partner"),

  // ── E. Tempo und Werbesprache ──
  r(64, "SPERRE", w("sofort", "in einer Minute", "blitzschnell", "ohne Wartezeit", "ohne Termin"), w("instantly", "in a minute", "no waiting", "no appointment"), "unmittelbar (nur für das, was unser eigenes System tut)", "immediately (our own system only)", {
    // „ohne Termin beim Notar“ ist eine Auskunft zum Recht, kein Tempo-Versprechen.
    ausnahme: (k) => /^\s+(?:beim|bei einem|vor dem|with a|at a|before a)\s+notar/i.test(k.danach),
  }),
  r(65, "SPERRE", w("schnell*", "zügig*", "in wenigen Wochen"), w("fast", "faster", "fastest", "quick*", "within weeks"), "Satz S15", "sentence S15"),
  r(66, "SPERRE", w("einfach", "kinderleicht", "unkompliziert*", "stressfrei", "mühelos"), w("easy", "simple", "hassle-free"), "sagen, wer was tut", "say who does what"),
  r(67, "SPERRE", w("Hexenwerk", "Magie"), w("magic"), "Jeder mit seiner Bedingung.", "Each with its condition."),
  r(68, "SPERRE", w("Keine Pakete", "keine Stufen"), w("No packages", "no tiers"), "Ein Mandat, ein Vertrag, ein Ansprechpartner.", "One engagement, one agreement, one dedicated contact."),
  r(69, "SPERRE", w("Jetzt starten", "Los geht", "Sichern Sie sich", "nur heute"), w("Get started", "Secure your", "today only"), "Angebot anfordern", "Request your proposal"),
  r(70, "SPERRE", w("ehrlich*", "offen gesagt", "transparent*"), w("honest*", "candid", "transparent*"), "Zur Einordnung: · mit Quellen und Stand", "For context: · stated plainly, with sources", {
    // „steuerlich transparent“ ist ein Fachbegriff des Steuerrechts, keine Beteuerung über uns.
    ausnahme: (k) => /^transparent/iu.test(k.fund) && /steuer|besteuer|typenvergleich|personengesellschaft|behandelt|(?<![\p{L}])tax|fiscal|treated|disregarded|partnership|entity|entities/iu.test(k.satz),
    stufeFuer: (k) => (/^transparent/i.test(k.fund) && erklaerend(k.e) ? "HINWEIS" : "SPERRE"),
  }),
  r(71, "HINWEIS", w("seriös*"), w("legit", "reputable"), "(den Beleg nennen)", "(state the evidence)", { wo: (e) => !hat(e, "vertrauen"), stufeFuer: (k) => (VON_UNS.test(k.satz) ? "HINWEIS" : null) }),
  r(72, "EINMAL", w("statt acht"), w("instead of eight"), "ein fester Ansprechpartner", "one dedicated contact"),
  r(73, "EINMAL", w("aus einer Hand"), w("from one source", "under one roof"), "in einem Mandat", "under one engagement"),
  r(74, "SPERRE", w("Abzocke", "Wette", "Wetten", "geschenktes Geld", "steht und fällt", "Hinterkopf", "Diese Tür"), w("rip-off", "gamble", "stands or falls"), "unseriöse Angebote · Sachtitel", "unsound offers · plain titles"),
  r(75, "SPERRE", w("Premium", "exklusiv*", "VIP", "Elite", "führend*", "erstklassig*", "maßgeschneidert*", "ganzheitlich*"), w("premium", "exclusive", "VIP", "leading", "bespoke", "holistic"), "(streichen — die Leistung beschreiben)", "(remove — describe the service)", {
    ausnahme: (k) => (/^leading$/iu.test(k.fund) && /^\s+(?:to|up)(?![\p{L}])/iu.test(k.danach)) || (/^exclusive$/iu.test(k.fund) && (/^\s+of(?![\p{L}])/iu.test(k.danach) || /(?:mutually|non)[\s‑-]$/iu.test(k.davor))),
  }),
  r(76, "SPERRE", w("So läuft es", "Ihre Sicherheit"), w("How it works", "Your protection"), "Ablauf · Wenn die Finanzierung ausbleibt", "Process · If the financing does not arrive"),

  // ── F. Selbstdarstellung und Belege ──
  r(77, "SPERRE", w("bekannt aus", "in den Medien"), w("as seen in", "featured in"), "Zitiert in Die Presse (02.11.2026)", "Quoted in Die Presse (2 November 2026)"),
  r(78, "SPERRE", w("langjährig*", "etabliert*", "seit Jahren", "Jahre Erfahrung", "Jahren Erfahrung"), w("long-standing", "long-established", "well-established", "established", "years of experience"), "gegründet 2026, eingetragen im Companies House unter Nr. 17318250", "incorporated in 2026, registered in England and Wales, company number 17318250", {
    // “is established under …” ist ein Tätigkeitswort der Rechtssprache, kein Eigenlob.
    ausnahme: (k) => /^established$/iu.test(k.fund) && (/(?<![\p{L}])(?:is|are|was|were|be|been|being|has|have|had|not|as)\s+$/iu.test(k.davor) || /^\s+(?:under|in|by|as|through|for|abroad)(?![\p{L}])/iu.test(k.danach)),
    // „etabliert“ / “established” ist Eigenlob, wenn der Satz von uns spricht; sonst beschreibt es Dritte (etwa die Historie einer Gesellschaft).
    stufeFuer: (k) => (/^(?:etabliert|established)/i.test(k.fund) && !VON_UNS.test(k.satz) ? "HINWEIS" : "SPERRE"),
  }),
  r(79, "SPERRE", new RegExp(`${w("Kundenstimme*", "Sterne", "Bewertungen").source}|${VOR}über\\s+\\d[\\d.]*\\s+Gründungen`, "giu"), new RegExp(`${w("testimonial*", "ratings").source}|${VOR}over\\s+\\d[\\d,]*\\s+formations`, "giu"), "(nichts — nicht belegt)", "(nothing)", {
    // In Wissens-Artikeln können „Bewertungen“ / “ratings” die Einstufung durch Auskunfteien meinen.
    stufeFuer: (k) => (/^(?:Bewertungen|Sterne|ratings)$/i.test(k.fund) && erklaerend(k.e) ? "HINWEIS" : "SPERRE"),
  }),
  r(80, "SPERRE", w("besten Ruf"), w("strongest reputation", "best reputation"), "Banken und Investoren ist Delaware vertraut.", "Delaware is familiar to banks and investors."),
  r(81, "SPERRE", w("empfehl*", "empfiehl*", "empfohlen*", "Empfehlung*"), w("recommend*"), "die Möglichkeit beschreiben, die Wahl überlassen", "describe the option"),
  r(82, "SPERRE", w("anwaltlich geprüft*"), w("reviewed by lawyers", "reviewed by a lawyer"), "(nichts)", "(nothing)"),
  r(83, "SPERRE", w("Kreditvermittlung*", "Kredite vermitteln"), w("credit broker*", "loan broker*", "we arrange loans"), "FIAON vergibt und vermittelt keine Kredite. (das Wort ist auch verneint gesperrt)", "FIAON does not lend and does not broker loans."),
  r(84, "HINWEIS", w("Prüfung", "Prüfungen", "geprüft*", "Due Diligence", "Due-Diligence*"), w("due diligence", "reviewed"), "nur mit V1 — heute Satz S5-B", "only with V1 — today sentence S5-B", {
    ausnahme: (k) => /ITIN[-‑ ]Check|Prüfung (?:der|Ihrer) Unterlagen|steuerliche oder rechtliche Prüfung|rechtliche oder steuerliche Prüfung/i.test(k.satz)
      || /Institut|Herausgeber|Bank|Behörde|IRS|Finanzamt|Steuerberater|Anw[aä]lt|lender|issuer|institution|authority/i.test(k.satz),
  }),
  r(85, "HINWEIS", w("unterschreiben", "unterschreibt", "unterschreibe", "unterschrieben"), null, "unterzeichnen („unterschriftsreif“ bleibt)", "sign"),

  // ── Dazu aus den Abschnitten 0.3, 5 und 9 (Vorbehalte, Leitplanken, Regeln für Suchmaschinen) ──
  r("V1", "SPERRE", /Fällt\s+unsere\s+Prüfung[^.]*positiv\s+aus|nach\s+positiver\s+Prüfung|bei\s+positiver\s+Prüfung|positive[nr]?\s+Prüfung|positiv\p{L}*\s+Due[\s‑-]Diligence/giu, /subject\s+to\s+satisfactory\s+due\s+diligence|satisfactory\s+due\s+diligence|(?:after|following)\s+(?:a\s+)?(?:positive|successful)\s+(?:review|due\s+diligence)/giu,
    "Vorbehalt V1 ist offen — heute gilt Satz S5-B: „Wir bereiten jeden Antrag … vollständig vor und begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts.“", "reservation V1 is open — today sentence S5-B applies"),
  r("9.1-6", "SPERRE", w("Due Diligence", "Due-Diligence*"), w("due diligence"), "„Prüfung“ / “due diligence” in Titel, Beschreibung und Menü erst mit V1 — die Fassung ohne das Wort", "not in title, description or menu before V1", { wo: (e) => e.rolle === "titel" || e.rolle === "beschreibung" || hat(e, "menue") }),
  r("9.1-5a", "SPERRE", w("Umschuldung*", "umschulden", "Aufstockung*", "aufstocken", "achtzehn Monate*", "achtzehnten Monat"), w("refinanc*", "eighteen months", "eighteenth month"), "Umschuldung und Aufstockung nie in Titel, Beschreibung, H1 oder Datenblock (5.10)", "never in title, description, H1 or structured data", { wo: (e) => suchRolle(e) || hat(e, "datenblock") }),
  r("9.1-5b", "SPERRE", w("Kanzlei*"), w("law firm*"), "„Kanzlei“ nie in Titel, Beschreibung oder H1", "never in title, description or H1", { wo: suchRolle }),
  r("9.1-5c", "SPERRE", /Kredit\p{L}*\s+(?:erhalten|bekommen|vermitteln|sichern)|Darlehen\s+(?:erhalten|bekommen|vermitteln)/giu, /(?:get|obtain|receive)\s+(?:a\s+)?(?:loan|credit)(?![\p{L}])|arrange\s+(?:a\s+)?loan/giu, "Kredit oder Darlehen nie als Leistung von FIAON in Titel, Beschreibung, H1 oder Datenblock", "never a loan as a FIAON service", { wo: (e) => suchRolle(e) || hat(e, "datenblock") }),
  r("9.1-8", "SPERRE", /Österreich|Schweiz|(?<![\p{L}])(?:AT|CH|DACH)(?![\p{L}])/gu, /Austria|Switzerland|(?<![\p{L}])(?:AT|CH|DACH)(?![\p{L}])/gu, "keine Trefferzeile, kein Datenblock und keine Zeile in /llms.txt nennt Österreich oder die Schweiz zusammen mit Konto, Karte oder Finanzierung — im Zweifel die Länder weglassen", "no line names Austria or Switzerland together with accounts, cards or financing", {
    wo: (e) => suchRolle(e) || hat(e, "datenblock", "llms"),
    stufeFuer: (k) => (!/Österreich|Schweiz|Austria|Switzerland|(?<![\p{L}])(?:AT|CH|DACH)(?![\p{L}])/u.test(k.davor) && (k.e.sprache === "de" ? /konto|konten|karte|finanzier|kapital/iu : /accounts?(?![\p{L}])|cards?(?![\p{L}])|financ|capital/iu).test(k.e.text) ? "SPERRE" : null),
  }),
  r("L7", "SPERRE", SCHWARZOTT, SCHWARZOTT,
    "die Partnergesellschaft heißt öffentlich nur „Schwarzott Group“ — kein anderer Name, keine Nummer, keine Anschrift, kein Ort (Leitplanke 7)", "publicly only “Schwarzott Group” — no other name, number, address or place"),
  r("L7b", "SPERRE", /Schwarzott\s+Group/gu, /Schwarzott\s+Group/gu, "„Schwarzott Group“ ohne Ort: nicht im selben Satz wie Zürich oder Miami (Leitplanke 7)", "“Schwarzott Group” without a place", {
    stufeFuer: (k) => (/Zürich|Zurich|Miami/.test(k.satz) ? "SPERRE" : null),
  }),
  r("4.1", "HINWEIS", null, w("capital range*", "capital target*", "capital framework*"), "", "funding target — je Seite ein Wort; wer eine Seite anfasst, stellt sie ganz um (4.1, 11 Nr. 6)"),
  r("9.4", "HINWEIS", w("LLC oder Corporation"), w("LLC or corporation"), "der Vertrag nennt die LLC — in /llms.txt und Datenblock kein „LLC oder Corporation“ (offene Entscheidung 12)", "the agreement names the LLC", { wo: (e) => hat(e, "llms", "datenblock") }),
];

// ═══════════════════════════════════════════════════════════════════════════
// 4  DIE FESTEN SÄTZE: was noch nicht freigegeben ist, steht auf keiner Seite — und die Presse-Zeile nur wortgenau
// ═══════════════════════════════════════════════════════════════════════════
interface SaetzeWissen {
  /** Sätze aus SAETZE_NICHT_FREIGEGEBEN, die in keinem freigegebenen Text vorkommen — mit Nummer und Vorbehalt. */
  geparkt: { satz: string; nr: string; vorbehalt: string }[];
  presse: { de: string; en: string; adresse: string };
  modul: any;
}
let SAETZE: SaetzeWissen | null = null;
const SAETZE_DATEI = "shared/fiaon-global-saetze.ts";
/** Exporte der Sätze-Datei, die keine Seitentexte sind (Schalter, Regeln je Land) oder absichtlich geparkt liegen. */
const SAETZE_KEIN_TEXT = new Set(["SAETZE_VORBEHALTE", "SAETZE_NICHT_FREIGEGEBEN", "LAENDER_REGELN", "LAENDER_SEITEN", "SAETZE_ERFOLG_MIN_CENTS"]);

function alleTexte(wert: unknown, aus: string[] = [], ohne: readonly string[] = ["wofuer", "vorbehalt", "art", "adresse"]): string[] {
  if (typeof wert === "string") aus.push(wert);
  else if (Array.isArray(wert)) for (const x of wert) alleTexte(x, aus, ohne);
  else if (wert && typeof wert === "object") for (const [k, v] of Object.entries(wert)) if (!ohne.includes(k)) alleTexte(v, aus, ohne);
  return aus;
}
const inSaetze = (t: string): string[] => glatt(t).split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter((x) => x.length >= 40);

async function saetzeLaden(): Promise<SaetzeWissen> {
  if (SAETZE) return SAETZE;
  const m = await lade(SAETZE_DATEI);
  const frei = new Set<string>();
  for (const [name, wert] of Object.entries(m)) if (!SAETZE_KEIN_TEXT.has(name) && typeof wert !== "function") for (const t of alleTexte(wert)) for (const s of inSaetze(t)) frei.add(s);
  const geparkt: SaetzeWissen["geparkt"] = [];
  for (const [nr, eintrag] of Object.entries(m.SAETZE_NICHT_FREIGEGEBEN as Record<string, { vorbehalt: string }>)) {
    // Ist der Vorbehalt geklärt (Schalter auf true), ist der Satz freigegeben und keine Sperre mehr.
    if (m.SAETZE_VORBEHALTE[eintrag.vorbehalt]) continue;
    for (const t of alleTexte(eintrag)) for (const s of inSaetze(t)) {
      // V1 sperrt die Sätze, die eine Prüfung als Bedingung nennen — nicht die Nachbarsätze, die auch ohne sie stimmen.
      if (eintrag.vorbehalt === "V1" && !/Prüfung|prüfen|due diligence|verify/i.test(s)) continue;
      if (!frei.has(s) && !geparkt.some((g) => g.satz === s)) geparkt.push({ satz: s, nr, vorbehalt: eintrag.vorbehalt });
    }
  }
  SAETZE = { geparkt, presse: m.PRESSE_ZEILE, modul: m };
  return SAETZE;
}

// ═══════════════════════════════════════════════════════════════════════════
// 5  DIE PRÜFMASCHINE
// ═══════════════════════════════════════════════════════════════════════════
const TITEL_MAX = 60;
const BESCHREIBUNG_MAX = 155;

function pruefeEinheit(e: Einheit, s: SaetzeWissen): Treffer[] {
  const aus: Treffer[] = [];
  const belegt: { von: number; bis: number; stufe: Stufe }[] = [];
  const t = e.text;
  const melde = (stufe: Stufe, regel: string, fund: string, ersatz: string, satz: string) => aus.push({ stufe, datei: e.datei, feld: e.feld, zeile: e.zeile, fund: kurz(fund, 70), ersatz, regel, satz: kurz(satz, 220) });

  for (const regel of REGELN) {
    const muster = e.sprache === "de" ? regel.de : regel.en;
    if (!muster || (regel.wo && !regel.wo(e))) continue;
    muster.lastIndex = 0;
    for (const m of t.matchAll(muster)) {
      const index = m.index ?? 0;
      const fund = m[0];
      if (!fund.trim()) continue;
      const k: Kontext = { e, fund, index, satz: satzUm(t, index, index + fund.length), davor: t.slice(0, index), danach: t.slice(index + fund.length) };
      if (regel.ausnahme?.(k)) continue;
      const stufe = regel.stufeFuer ? regel.stufeFuer(k) : regel.stufe;
      if (!stufe) continue;
      // Dieselbe Stelle nur einmal je Stufe melden (die genauere Regel steht in der Liste weiter oben).
      if (belegt.some((b) => b.stufe === stufe && index < b.bis && index + fund.length > b.von)) continue;
      belegt.push({ von: index, bis: index + fund.length, stufe });
      melde(stufe, regel.id, fund, e.sprache === "de" ? regel.ersatzDe : regel.ersatzEn || regel.ersatzDe, k.satz);
    }
  }

  // Noch nicht freigegebene Sätze (S5-A, S16, Lang-Form der Garantie): stehen auf keiner Seite.
  const g = glatt(t);
  for (const p of s.geparkt) if (g.includes(p.satz)) melde("SPERRE", `0.3-${p.vorbehalt}`, p.satz, `noch nicht freigegeben (${p.nr}, Vorbehalt ${p.vorbehalt}) — es gilt die Fassung „heute“ aus shared/fiaon-global-saetze.ts`, p.satz);

  // Presse: nur die eine Zeile, wortgenau (6.3).
  if (/Die\s+Presse|diepresse/i.test(t)) {
    const rest = t.split(s.presse[e.sprache]).join(" ");
    if (/Die\s+Presse|diepresse/i.test(rest)) melde("SPERRE", "6.3", t.match(/[^.]{0,30}(?:Die\s+Presse|diepresse)[^.]{0,30}/i)?.[0] ?? "Die Presse", `nur wortgenau „${s.presse[e.sprache]}“ mit Link ${s.presse.adresse} — kein Logo, kein „bekannt aus“, kein Zitat aus dem Artikel`, satzUm(t, 0, t.length));
  }

  // Länge von Titel und Beschreibung (9.1 Nr. 1).
  if (e.rolle === "titel" && t.length > TITEL_MAX) melde("SPERRE", "9.1-1", `${t.length} Zeichen`, `Titel höchstens ${TITEL_MAX} Zeichen`, t);
  if (e.rolle === "beschreibung" && t.length > BESCHREIBUNG_MAX) melde("SPERRE", "9.1-1", `${t.length} Zeichen`, `Beschreibung höchstens ${BESCHREIBUNG_MAX} Zeichen`, t);
  return aus;
}

/** Alle Texte prüfen — einzeln und je Seite (höchstens einmal: „statt acht“, „aus einer Hand“, das Suchwort „Stacking“, die Presse-Zeile). */
function pruefe(einheiten: Einheit[], s: SaetzeWissen): Treffer[] {
  const aus: Treffer[] = [];
  const zaehler = new Map<string, number>();
  const seiteVon = (e: Einheit): string => `${e.seite ?? e.datei}|${e.sprache}`;
  for (const e of einheiten) {
    for (const t of pruefeEinheit(e, s)) {
      if (t.stufe === "EINMAL" && !e.quelleSaetze) {
        const schluessel = `${seiteVon(e)}|${t.regel}`;
        const n = (zaehler.get(schluessel) ?? 0) + 1;
        zaehler.set(schluessel, n);
        if (n === 1) continue; // das erste Vorkommen je Seite ist erlaubt
        t.ersatz = `${t.ersatz} — höchstens einmal je Seite (hier das ${n}. Vorkommen)`;
      } else if (t.stufe === "EINMAL") continue;
      aus.push(t);
    }
    if (e.quelleSaetze) continue;
    // Das Suchwort „Stacking“ im einen Wissens-Artikel: einmal in Anführungszeichen (die Ausnahme oben lässt jedes zitierte durch).
    if (/stacking/.test(e.seite ?? "")) {
      for (const m of e.text.matchAll(/[„“"”«‘']\s?(?:Kreditkarten[-‑]|credit card )?Stacking/giu)) {
        const schluessel = `${seiteVon(e)}|stacking`;
        const n = (zaehler.get(schluessel) ?? 0) + 1;
        zaehler.set(schluessel, n);
        if (n > 1) aus.push({ stufe: "SPERRE", datei: e.datei, feld: e.feld, zeile: e.zeile, fund: m[0], ersatz: `das Suchwort nur einmal je Seite in Anführungszeichen (hier das ${n}. Mal) — sonst „viele Kartenanträge in kurzer Zeit“`, regel: "14-02", satz: kurz(satzUm(e.text, m.index ?? 0, (m.index ?? 0) + m[0].length), 220) });
      }
    }
    // Die Presse-Zeile: je Seite höchstens einmal.
    const presse = e.text.split(s.presse[e.sprache]).length - 1;
    if (presse > 0) {
      const schluessel = `${seiteVon(e)}|presse`;
      const vorher = zaehler.get(schluessel) ?? 0;
      zaehler.set(schluessel, vorher + presse);
      if (vorher + presse > 1) aus.push({ stufe: "EINMAL", datei: e.datei, feld: e.feld, zeile: e.zeile, fund: s.presse[e.sprache], ersatz: `die Presse-Zeile steht je Seite genau einmal — im Vertrauens-Band (hier das ${vorher + presse}. Vorkommen)`, regel: "6.1", satz: kurz(e.text, 220) });
    }
  }
  return aus;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6  SAMMLER A — Daten-Dateien: die Zeichenketten der exportierten Objekte, mit Pfad zum Feld
// ═══════════════════════════════════════════════════════════════════════════
/** Felder ohne Seitentext: Adressen, Schlüssel, Datumsangaben, Notizen für uns. */
const KEIN_TEXT_FELD = /^(?:pfad|art|stand|erschienen|robots|key|kennung|url|paket|typ|id|schwester|sprache|auftraggeber|gruppe|bild|bildAlt|icon|href|slug|datei|vorbehalt|wofuer|adresse|extern|status|prio|zeitzone|schluessel|weiter|krumen|canonical|quellen|eigenerVorrenderer|werkzeug|nr)$/;
const keinText = (t: string): boolean => {
  const x = t.trim();
  if (x.length < 2 || !/\p{L}{2}/u.test(x)) return true;
  if (!/\s/.test(x) && /^(?:https?:|mailto:|tel:|\/|#|\.{1,2}\/|@)/.test(x)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(x)) return true;
  if (!/\s/.test(x) && /^[a-z0-9]+(?:[_-][a-z0-9]+)+$/.test(x)) return true; // kennung_mit_strich
  return false;
};

const AT_SCHLUESSEL = /(?:^|[a-z_.\-])AT$|[a-z]At$|[öÖ]sterreich|oesterreich|austria/;
const CH_SCHLUESSEL = /(?:^|[a-z_.\-])CH$|[a-z]Ch$|schweiz|switzerland/i;
let LAENDER: { AT: readonly string[]; CH: readonly string[] } = { AT: ["/business/aus-oesterreich", "/en/business/from-austria"], CH: ["/business/aus-der-schweiz", "/en/business/from-switzerland"] };
const VERTRAUEN_PFADE = ["/ist-fiaon-serioes", "/en/is-fiaon-legit"];

/** Sprache und Flächen einer Seite aus ihrer Adresse und Art. */
function seitenKontext(pfad: string, art?: string): { sprache: Sprache; flaechen: Flaeche[] } {
  const p = (pfad.split(/[?#]/)[0].replace(/\/+$/, "") || "/").toLowerCase();
  const sprache: Sprache = p === "/en" || p.startsWith("/en/") ? "en" : "de";
  let flaechen: Flaeche[];
  if (p === "/" || p === "/en") flaechen = ["startseite"];
  else if (/\/business\/start$/.test(p)) flaechen = ["rechner"];
  else if (LAENDER.AT.includes(p)) flaechen = ["oesterreich", "unterseite"];
  else if (LAENDER.CH.includes(p)) flaechen = ["schweiz", "unterseite"];
  else if (p.includes("/lp/")) flaechen = ["landingpage"];
  else if (VERTRAUEN_PFADE.includes(p)) flaechen = ["vertrauen", "unterseite"];
  else if (art === "wissen" || art === "hub" || /\/(?:wissen|knowledge)(?:\/|$)/.test(p)) flaechen = ["wissen", "unterseite"];
  else flaechen = ["unterseite"];
  return { sprache, flaechen };
}

interface Lauf { sprache: Sprache; seite?: string; art?: string; flaechen: Flaeche[]; quelleSaetze?: boolean }
interface DatenOptionen {
  /** Flächen aller Texte der Datei. */
  flaechen: Flaeche[];
  /** Nur diese Exporte lesen (sonst alle). */
  nurExporte?: (name: string) => boolean;
  /** Bei Tabellen mit Adressen als Schlüssel: nur diese Adressen. */
  nurSeiten?: (pfad: string) => boolean;
  /** Sprache, wenn nichts anderes sie verrät. */
  sprache?: Sprache;
}
const seiteObjekt = (o: any): boolean => !!o && typeof o === "object" && typeof o.pfad === "string" && o.pfad.startsWith("/") && (!!o.seo || Array.isArray(o.bloecke) || (typeof o.titel === "string" && typeof o.beschreibung === "string"));
/** Seiten, die schon einer Datei zugeordnet sind (damit index.ts und Sammel-Dateien nichts doppelt melden). */
const seiteGesehen = new WeakSet<object>();
const seiteDatei = new Map<string, { datei: string; seite: any }>();
let EN_PFADE: Record<string, string> = {};
let DE_PFADE: Record<string, string> = {};
const REGISTER_ORDNER = "shared/fiaon-global-seiten/";
const REGISTER_INDEX = "shared/fiaon-global-seiten/index.ts";
const FRAGEN_DATEI = "shared/fiaon-global-seiten/fragen.ts";

/** Welche Seiten sind in dieser Datei GESCHRIEBEN? Jedes Objekt mit „pfad“ und „seo“ oder „bloecke“ — gelesen aus dem Quelltext. */
const definiertCache = new Map<string, Set<string>>();
function definiert(datei: string): Set<string> {
  if (definiertCache.has(datei)) return definiertCache.get(datei)!;
  const aus = new Set<string>();
  const sf = ts.createSourceFile(datei, quelltext(datei), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const besuch = (n: ts.Node): void => {
    if (ts.isObjectLiteralExpression(n)) {
      const feld = (name: string) => n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === name);
      const pfad = feld("pfad");
      if (pfad && (feld("seo") || feld("bloecke"))) {
        const lies = (x: ts.Node): void => { if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) aus.add(x.text); ts.forEachChild(x, lies); };
        lies(pfad.initializer);
      }
    }
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  definiertCache.set(datei, aus);
  return aus;
}
let registerDateien: string[] | null = null;
/** Die Datei des Registers, in der diese Seite geschrieben ist — oder null. */
function geschriebenIn(pfad: string): string | null {
  registerDateien ??= findeDateien("shared/fiaon-global-seiten", /\.ts$/).filter((d) => d !== REGISTER_INDEX);
  return registerDateien.find((d) => definiert(d).has(pfad)) ?? null;
}
/** Die Fragen-Übersichten sammeln die Fragen aller Seiten — die stehen schon bei ihrer Seite. */
const fragenUebersicht = (pfad: string | undefined): boolean => !!pfad && definiert(FRAGEN_DATEI).has(pfad);

/** Gehört diese Registerseite in diese Datei? Ja, wenn sie dort geschrieben ist — oder nirgends sonst (dann dort, wo sie gefunden wird). */
function seiteGehoertIn(seite: any, datei: string): boolean {
  if (!datei.startsWith(REGISTER_ORDNER)) return true;
  const heimat = geschriebenIn(seite.pfad);
  return heimat ? heimat === datei : true;
}

function rolleVon(schluessel: string, eltern: any): Rolle {
  if (schluessel === "titel" && eltern && typeof eltern.beschreibung === "string") return "titel";
  if (schluessel === "beschreibung" && eltern && typeof eltern.titel === "string") return "beschreibung";
  if (/^h1[ab]?$/.test(schluessel)) return "h1";
  if (/^h2[ab]?$/.test(schluessel) || schluessel === "karteH2") return "h2";
  if (/knopf|absenden|button/i.test(schluessel)) return "knopf";
  if (/^(?:titel|auge|tag|label|name|kurz)$/.test(schluessel) && !(schluessel === "kurz" && eltern && Array.isArray(eltern.bloecke))) return "titelartig";
  return "text";
}

function zeileFinden(datei: string, text: string): number | undefined {
  const q = quelltext(datei);
  if (!q) return undefined;
  for (const n of [60, 32, 18]) {
    const probe = text.slice(0, n);
    if (probe.length < Math.min(n, 12)) continue;
    const i = q.indexOf(probe);
    if (i >= 0) return q.slice(0, i).split("\n").length;
  }
  return undefined;
}
const internMarke = /wortwand:\s*intern/i;
const internZeilen: string[] = [];
function istIntern(datei: string, zeile: number | undefined): boolean {
  if (!zeile) return false;
  const z = quelltext(datei).split("\n");
  if (internMarke.test(z[zeile - 1] ?? "") || internMarke.test(z[zeile - 2] ?? "")) {
    const marke = `${datei}:${zeile}`;
    if (!internZeilen.includes(marke)) internZeilen.push(marke);
    return true;
  }
  return false;
}

function gehe(wert: unknown, feld: string, schluessel: string, eltern: any, lauf: Lauf, datei: string, o: DatenOptionen, aus: Einheit[], roh: Set<string>, gesehen: WeakSet<object>, tiefe = 0): void {
  if (wert == null || tiefe > 14) return;
  if (typeof wert === "string") {
    roh.add(glatt(wert));
    if (KEIN_TEXT_FELD.test(schluessel) || keinText(wert)) return;
    // Der Titel einer Quelle ist der Name eines fremden Dokuments — kein eigener Satz.
    if (schluessel === "titel" && eltern && typeof eltern.url === "string" && /^https?:/.test(eltern.url)) return;
    const zeile = zeileFinden(datei, wert);
    if (istIntern(datei, zeile)) return;
    aus.push({ datei, feld, zeile, sprache: lauf.sprache, text: wert, seite: lauf.seite, art: lauf.art, flaechen: lauf.flaechen, rolle: rolleVon(schluessel, eltern), quelleSaetze: lauf.quelleSaetze });
    return;
  }
  if (typeof wert === "function") {
    // Felder, die einen Satz aus Werten bauen (etwa: Betrag einsetzen) — mit Platzhaltern aufgerufen. Exportierte Funktionen ruft niemand hier auf.
    if (tiefe === 0) return;
    try { gehe((wert as (...a: unknown[]) => unknown)(...Array(Math.max(1, wert.length)).fill("…")), `${feld}(…)`, schluessel, eltern, lauf, datei, o, aus, roh, gesehen, tiefe + 1); } catch { /* braucht echte Werte — bleibt ungeprüft */ }
    return;
  }
  if (typeof wert !== "object") return;
  if (gesehen.has(wert as object)) return;
  gesehen.add(wert as object);
  if (Array.isArray(wert)) { wert.forEach((x, i) => gehe(x, `${feld}[${i}]`, schluessel, wert, lauf, datei, o, aus, roh, gesehen, tiefe + 1)); return; }
  let hier = lauf;
  if (seiteObjekt(wert)) {
    const seite = wert as any;
    if (o.nurSeiten && !o.nurSeiten(seite.pfad)) { for (const t of alleTexte(seite, [], [])) roh.add(glatt(t)); return; }
    // Registerseiten gehören in die Datei, in der sie geschrieben sind — Sammel-Dateien (index.ts) melden sie nicht noch einmal.
    if (seite.seo && datei.startsWith(REGISTER_ORDNER)) {
      if (seiteGesehen.has(seite) || !seiteGehoertIn(seite, datei)) { for (const t of alleTexte(seite, [], [])) roh.add(glatt(t)); return; }
      seiteGesehen.add(seite);
      seiteDatei.set(seite.pfad, { datei, seite });
    }
    const k = seitenKontext(seite.pfad, seite.art);
    hier = { ...lauf, sprache: seite.sprache === "en" ? "en" : k.sprache, seite: seite.pfad, art: seite.art, flaechen: [...new Set([...k.flaechen, ...lauf.flaechen.filter((f) => f === "saetze")])] };
    feld = `${feld.replace(/\[\d+\]$/, "")}〈${seite.pfad}〉`;
  }
  for (const [k, v] of Object.entries(wert as Record<string, unknown>)) {
    if (KEIN_TEXT_FELD.test(k)) { if (typeof v === "string") roh.add(glatt(v)); else for (const t of alleTexte(v, [], [])) roh.add(glatt(t)); continue; }
    let naechster = hier;
    // Sprache aus dem Schlüssel: { de: …, en: … }, titelEn, GLOBAL_VERBUNDEN_EN
    if (k === "en" || k === "EN" || /[a-z]En$|_EN$/.test(k)) naechster = { ...naechster, sprache: "en" };
    else if (k === "de" || k === "DE" || /[a-z]De$|_DE$/.test(k)) naechster = { ...naechster, sprache: "de" };
    // Tabellen mit Adressen als Schlüssel (SEO_FRAGEN): der Schlüssel ist die Seite.
    if (k.startsWith("/") && !seiteObjekt(v)) {
      if (o.nurSeiten && !o.nurSeiten(k)) { for (const t of alleTexte(v, [], [])) roh.add(glatt(t)); continue; }
      const sk = seitenKontext(k);
      naechster = { ...naechster, sprache: sk.sprache, seite: k, flaechen: [...new Set([...sk.flaechen, ...(sk.flaechen.includes("startseite") ? (["fragen"] as Flaeche[]) : [])])] };
    }
    // Flächen aus dem Schlüssel: Honorarrechner, Karte, Fragen, Fuß, Österreich, Schweiz.
    const dazu: Flaeche[] = [];
    if (k === "konfig") dazu.push("rechner");
    if (k === "karte" && naechster.flaechen.includes("startseite")) dazu.push("karte");
    if (k === "fragen" && naechster.flaechen.includes("startseite")) dazu.push("fragen");
    if (/fuss|keineBank/i.test(k)) dazu.push("fuss");
    if (AT_SCHLUESSEL.test(k)) dazu.push("oesterreich");
    if (CH_SCHLUESSEL.test(k)) dazu.push("schweiz");
    if (dazu.length) naechster = { ...naechster, flaechen: [...new Set([...naechster.flaechen, ...dazu])] };
    // Die Fragen-Übersicht sammelt die Fragen aller Seiten — die stehen schon bei ihrer Seite.
    if (fragenUebersicht(hier.seite) && (k === "fragen" || k === "bloecke") && Array.isArray(v)) {
      if (k === "bloecke") v.forEach((b: any, i: number) => { for (const teil of ["h2", "lead"]) if (typeof b?.[teil] === "string") gehe(b[teil], `${feld}.bloecke[${i}].${teil}`, teil, b, naechster, datei, o, aus, roh, gesehen, tiefe + 2); });
      for (const t of alleTexte(v, [], [])) roh.add(glatt(t));
      continue;
    }
    gehe(v, /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(k) ? `${feld}.${k}` : `${feld}[${JSON.stringify(k)}]`, k, wert, naechster, datei, o, aus, roh, gesehen, tiefe + 1);
  }
}

/** Die Exporte, die in dieser Datei selbst angelegt sind (export const …) — was sie nur weiterreicht, prüft die Datei, in der es steht. */
function lokaleExporte(datei: string): Set<string> {
  const aus = new Set<string>();
  const sf = ts.createSourceFile(datei, quelltext(datei), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || !st.modifiers?.some((x) => x.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name)) aus.add(d.name.text);
  }
  return aus;
}

async function sammleDaten(datei: string, o: DatenOptionen): Promise<{ einheiten: Einheit[]; roh: Set<string> }> {
  const m = await lade(datei);
  const einheiten: Einheit[] = [];
  const roh = new Set<string>();
  const gesehen = new WeakSet<object>();
  const sprache: Sprache = o.sprache ?? (/\/en\/|-en\.tsx?$/.test(datei) ? "en" : "de");
  const eigene = lokaleExporte(datei);
  for (const [name, wert] of Object.entries(m)) {
    if (typeof wert === "function") continue;
    if (!eigene.has(name) || (o.nurExporte && !o.nurExporte(name))) { for (const t of alleTexte(wert, [], [])) roh.add(glatt(t)); continue; }
    let lauf: Lauf = { sprache, flaechen: [...o.flaechen], quelleSaetze: datei === SAETZE_DATEI };
    if (/_EN$|[a-z]En$/.test(name)) lauf = { ...lauf, sprache: "en" };
    const dazu: Flaeche[] = [];
    if (/FUSS/.test(name)) dazu.push("fuss");
    if (AT_SCHLUESSEL.test(name)) dazu.push("oesterreich");
    if (CH_SCHLUESSEL.test(name)) dazu.push("schweiz");
    if (dazu.length) lauf = { ...lauf, flaechen: [...new Set([...lauf.flaechen, ...dazu])] };
    gehe(wert, name, name, m, lauf, datei, o, einheiten, roh, gesehen, 0);
  }
  // Seiten, die hier geschrieben sind, aber erst eine Funktion baut (Fragen-Übersicht, Wahl des Bundesstaats): aus dem Register holen.
  if (datei.startsWith(REGISTER_ORDNER) && datei !== REGISTER_INDEX && [...definiert(datei)].some((p) => p.startsWith("/") && !seiteDatei.has(p))) {
    try {
      const reg = await lade(REGISTER_INDEX);
      for (const seite of [...reg.GLOBAL_SEITEN, ...reg.GLOBAL_SEITEN_EN, ...reg.LANDINGPAGES] as any[]) {
        if (definiert(datei).has(seite.pfad) && !seiteGesehen.has(seite)) gehe(seite, "Register", "Register", null, { sprache, flaechen: [...o.flaechen] }, datei, o, einheiten, roh, gesehen, 1);
      }
    } catch { /* das Register lädt gerade nicht — die gebauten Seiten bleiben in diesem Lauf ungeprüft */ }
  }
  return { einheiten, roh };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7  SAMMLER B — Quelltext lesen (.tsx und Daten ohne Export): Zeichenketten und sichtbarer JSX-Text, nie Kommentare
// ═══════════════════════════════════════════════════════════════════════════
const SICHTBARES_ATTRIBUT = /^(?:aria-label|aria-description|aria-roledescription|aria-valuetext|title|alt|placeholder|label|caption|summary)$/;
const KEIN_TEXT_ATTRIBUT = /^(?:className|class|id|href|to|src|srcSet|style|type|name|key|role|viewBox|d|fill|stroke|htmlFor|target|rel|loading|decoding|width|height|method|action|autoComplete|inputMode|pattern|lang|dir|as|variant|variante|size|groesse|farbe|color|xmlns|points|transform|preserveAspectRatio|strokeLinecap|strokeLinejoin|fillRule|clipRule|tabIndex|value|defaultValue|accept|sizes|media|crossOrigin|referrerPolicy|fetchPriority|rootMargin|data-.*|on[A-Z].*)$/;
const KEIN_TEXT_AUFRUF = /(?:^|\.)(?:cn|clsx|classNames|twMerge|cva|querySelector|querySelectorAll|getElementById|getElementsByClassName|addEventListener|removeEventListener|setAttribute|getAttribute|removeAttribute|hasAttribute|add|remove|toggle|contains|matchMedia|getItem|setItem|removeItem|fetch|navigate|setLocation|useRoute|useLocation|log|warn|error|info|debug|startsWith|endsWith|includes|indexOf|replace|replaceAll|split|match|matchAll|test|join|padStart|padEnd|createElement|createElementNS|getPropertyValue|setProperty|toLocaleString|toLocaleDateString|toLocaleTimeString|localeCompare|format|formatToParts|getContext|closest|matches|import|require|scrollIntoView|animate|postMessage|dispatchEvent|gtag|fbq|track|slice|at|get|set|has|delete)$/;
const KEIN_TEXT_NAME = /klass|class|stil$|style|farb|color|pfad|href|url$|^id$|Id$|key$|schluessel|^typ$|^art$|variant|icon|^bild|src$|^ref$|ereignis|event|kennung|selektor|selector|muster|regex|format$|ease|easing|kurve|font|schrift/i;

function siehtAusWieText(t: string): boolean {
  const s = t.trim();
  if (keinText(s)) return false;
  if (/<\/?[a-z][^>]*>/i.test(s)) return false; // Markup
  if (/[{};]/.test(s) && /[\w-]+\s*:\s*[^;]+;/.test(s)) return false; // CSS
  const tok = s.split(/\s+/);
  if (tok.length === 1) return /^\p{Lu}[\p{Ll}]+[.!?:…]?$/u.test(s) || (/[äöüßÄÖÜ]/.test(s) && /^[\p{L}‑-]+[.!?:…]?$/u.test(s));
  // Klassenlisten und CSS-Werte: alles klein, mit Bindestrich, Doppelpunkt, Klammer oder Ziffer.
  const klassig = tok.every((x) => /^[a-z0-9!@:\-_/.[\]()%#&>*,=+'"~^$|]+$/.test(x));
  if (klassig && tok.some((x) => /[-:[\]/.()%#=_]|\d/.test(x))) return false;
  if (!tok.some((x) => /^\p{L}{3,}[.,;:!?…]?$/u.test(x.replace(/^[„“"«(]+|[“”"»)]+$/g, "")))) return false;
  return true;
}
const DE_WOERTER = /(?<![\p{L}])(?:der|die|das|und|oder|nicht|mit|für|Ihr|Ihre|Ihren|Ihrer|Ihrem|Sie|wir|ist|sind|ein|eine|einen|einer|zu|zur|zum|von|vom|auf|im|dem|den|des|bei|nach|über|unter|auch|nur|wenn|wird|werden|kein|keine|ohne|bis|aus|Gespräch|Angebot|Gesellschaft|Vertrag|Jahr|Wunsch)(?![\p{L}])/gu;
const EN_WOERTER = /(?<![\p{L}])(?:the|and|or|not|with|for|your|you|we|is|are|a|an|to|of|on|in|at|by|from|this|that|it|be|our|no|company|agreement|call|proposal|year|request)(?![\p{L}])/giu;
function rateSprache(t: string): Sprache | null {
  const ohneKuerzel = t.replace(/(?<![\p{L}])\p{Lu}{2,}(?![\p{L}])/gu, " ");
  const de = (ohneKuerzel.match(DE_WOERTER)?.length ?? 0) + (/[äöüßÄÖÜ]/.test(t) ? 2 : 0);
  const en = ohneKuerzel.match(EN_WOERTER)?.length ?? 0;
  return de > en ? "de" : en > de ? "en" : null;
}

interface AstText { text: string; zeile: number; sprache: Sprache | null; rolle: Rolle; pfad: string; jsx: boolean }
interface AstErgebnis { texte: AstText[]; literale: { text: string; zeile: number }[] }

function astLesen(datei: string): AstErgebnis {
  const q = quelltext(datei);
  const sf = ts.createSourceFile(datei, q, ts.ScriptTarget.Latest, true, datei.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const texte: AstText[] = [];
  const literale: { text: string; zeile: number }[] = [];
  const zeileVon = (n: ts.Node): number => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const nameVon = (n: ts.Node | undefined): string => (!n ? "" : ts.isIdentifier(n) || ts.isPrivateIdentifier(n) ? n.text : ts.isStringLiteral(n) ? n.text : ts.isPropertyAccessExpression(n) ? `${nameVon(n.expression)}.${n.name.text}` : ts.isJsxNamespacedName(n) ? `${n.namespace.text}:${n.name.text}` : "");
  const durchlaessig = (p: ts.Node): boolean => ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p) || ts.isTemplateSpan(p) || ts.isTemplateExpression(p) || ts.isJsxExpression(p)
    || ts.isAsExpression(p) || ts.isNonNullExpression(p) || ts.isArrayLiteralExpression(p) || ts.isSatisfiesExpression(p)
    || (ts.isBinaryExpression(p) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.QuestionQuestionToken].includes(p.operatorToken.kind));

  /** Ist diese Zeichenkette Text für Besucher — oder ein Bezeichner, eine Klasse, ein Pfad, ein Schlüssel? */
  const sichtbar = (n: ts.Node, text: string): boolean => {
    const p = n.parent;
    if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p) || ts.isLiteralTypeNode(p) || ts.isCaseClause(p)) return false;
    if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isEnumMember(p)) && p.name === n) return false;
    if (ts.isElementAccessExpression(p) && p.argumentExpression === n) return false;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken, ts.SyntaxKind.InKeyword].includes(p.operatorToken.kind)) return false;
    let k: ts.Node = n;
    let e: ts.Node | undefined = p;
    while (e && durchlaessig(e)) {
      // Im Vergleich einer Bedingung („sprache === "en" ? … : …“) steht kein Seitentext.
      if (ts.isConditionalExpression(e) && e.condition === k) return false;
      k = e; e = e.parent;
    }
    if (!e) return false;
    if (ts.isJsxAttribute(e)) {
      const attribut = nameVon(e.name);
      if (KEIN_TEXT_ATTRIBUT.test(attribut)) return false;
      if (SICHTBARES_ATTRIBUT.test(attribut)) return !keinText(text);
      return siehtAusWieText(text);
    }
    if (ts.isCallExpression(e) || ts.isNewExpression(e)) {
      const aufruf = nameVon(e.expression);
      if (KEIN_TEXT_AUFRUF.test(aufruf) || ts.isNewExpression(e)) return false;
      if (e.expression.kind === ts.SyntaxKind.ImportKeyword) return false;
    }
    if (ts.isThrowStatement(e) || ts.isTypeOfExpression(e)) return false;
    if ((ts.isVariableDeclaration(e) || ts.isPropertyAssignment(e) || ts.isParameter(e) || ts.isBindingElement(e) || ts.isPropertyDeclaration(e)) && KEIN_TEXT_NAME.test(nameVon(e.name))) return false;
    return siehtAusWieText(text);
  };

  /** Sprache aus der Umgebung: en ? "…" : "…", { de: …, en: … }, const en = { … } */
  const spracheVon = (n: ts.Node): Sprache | null => {
    let k: ts.Node = n;
    for (let e: ts.Node | undefined = n.parent; e; k = e, e = e.parent) {
      if (ts.isConditionalExpression(e) && (e.whenTrue === k || e.whenFalse === k)) {
        const b = e.condition.getText(sf);
        const en = /(?:===?\s*"en"|^en$|\bistEn\b|\benglisch\b|\.en\b|^en\b|\ben$)/.test(b) && !/!==?\s*"en"|^!\s*en\b/.test(b);
        const de = /(?:===?\s*"de"|!==?\s*"en"|^!\s*en\b|^de$|\bdeutsch\b)/.test(b);
        if (en) return e.whenTrue === k ? "en" : "de";
        if (de) return e.whenTrue === k ? "de" : "en";
      }
      if (ts.isPropertyAssignment(e) || ts.isVariableDeclaration(e)) {
        const name = nameVon(e.name);
        if (/^(?:en|EN)$|[a-z]En$|_EN$|^EN_/.test(name)) return "en";
        if (/^(?:de|DE)$|[a-z]De$|_DE$|^DE_/.test(name)) return "de";
      }
    }
    return null;
  };
  /** Feld-Pfad aus der Umgebung (für Daten ohne Export): BEGRIFFE.de[…] */
  const pfadVon = (n: ts.Node): string => {
    const teile: string[] = [];
    for (let e: ts.Node | undefined = n.parent; e; e = e.parent) {
      if (ts.isPropertyAssignment(e) || ts.isVariableDeclaration(e) || ts.isFunctionDeclaration(e) || ts.isJsxAttribute(e)) { const name = nameVon(e.name as ts.Node | undefined); if (name) teile.unshift(name); }
      else if (ts.isJsxElement(e)) { teile.unshift(`<${nameVon(e.openingElement.tagName)}>`); if (teile.length > 3) break; }
    }
    return teile.slice(-4).join(".");
  };
  const rolleJsx = (n: ts.Node): Rolle => {
    for (let e: ts.Node | undefined = n.parent; e; e = e.parent) {
      if (ts.isJsxElement(e)) {
        const tag = nameVon(e.openingElement.tagName);
        if (tag === "h1") return "h1";
        if (/^h[2-4]$/.test(tag)) return "h2";
        if (tag === "button") return "knopf";
        if (tag === "title") return "titel";
        return "text";
      }
    }
    return "text";
  };
  const entitaet = (t: string): string => t.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&shy;/g, "").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&ndash;/g, "–").replace(/&mdash;/g, "—").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

  const besuch = (n: ts.Node): void => {
    if (ts.isJsxText(n)) {
      const t = glatt(entitaet(n.text));
      if (t) literale.push({ text: t, zeile: zeileVon(n) });
      if (t && /\p{L}{2}/u.test(t)) texte.push({ text: t, zeile: zeileVon(n), sprache: spracheVon(n), rolle: rolleJsx(n), pfad: pfadVon(n), jsx: true });
    } else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) {
      const t = ts.isTemplateExpression(n) ? n.head.text + n.templateSpans.map((x) => `…${x.literal.text}`).join("") : n.text;
      literale.push({ text: t, zeile: zeileVon(n) });
      if (sichtbar(n, t)) texte.push({ text: t, zeile: zeileVon(n), sprache: spracheVon(n), rolle: "text", pfad: pfadVon(n), jsx: false });
    }
    ts.forEachChild(n, besuch);
  };
  besuch(sf);
  return { texte, literale };
}

/** Getippte Beträge (Prüfliste 8): Jeder Betrag kommt aus der Preisquelle — im Quelltext steht keine der Honorar-Zahlen. */
function getippteBetraege(datei: string, ast: AstErgebnis, s: SaetzeWissen): Treffer[] {
  const b = s.modul.SAETZE_BETRAEGE;
  const zahlen = new Set<string>();
  for (const sp of ["de", "en"] as const) for (const f of ["honorarAuftrag", "fastTrack", "jahresbetreuung", "erfolgMin"] as const) zahlen.add(String(b[sp][f]).replace(/[^\d.,]/g, ""));
  const gross = [...zahlen].filter((z) => z.replace(/\D/g, "").length >= 4);
  const klein = [...zahlen].filter((z) => z.replace(/\D/g, "").length < 4);
  const esc = (z: string) => z.replace(/[.]/g, "\\.");
  const muster = new RegExp(`(?<![\\d.,])(?:${[...gross.map(esc), ...gross.map((z) => z.replace(/\D/g, ""))].join("|")})(?![\\d])(?:\\s?(?:€|Euro|EUR))?|€\\s?(?:${klein.map(esc).join("|")})(?!\\d)|(?<![\\d.,])(?:${klein.map(esc).join("|")})\\s?(?:€|Euro|EUR)(?![\\p{L}])`, "gu");
  const aus: Treffer[] = [];
  for (const l of ast.literale) {
    if (istIntern(datei, l.zeile)) continue;
    for (const m of l.text.matchAll(muster)) {
      // Jahreszahlen und Formularnummern sind keine Beträge: Die großen Zahlen zählen nur mit Tausender-Zeichen oder Währung.
      if (/^\d{4,}$/.test(m[0]) && !/€|Euro|EUR/.test(l.text.slice(Math.max(0, (m.index ?? 0) - 3), (m.index ?? 0) + m[0].length + 6))) continue;
      aus.push({ stufe: "SPERRE", datei, feld: `Zeile ${l.zeile}`, zeile: l.zeile, fund: m[0], ersatz: "kein Betrag wird getippt — aus der Preisquelle: SAETZE_BETRAEGE (shared/fiaon-global-saetze.ts) oder VERKAUF_PREISE mit verkaufEur()", regel: "13-8", satz: kurz(l.text, 220) });
    }
  }
  return aus;
}

function sammleQuelltext(datei: string, flaechen: Flaeche[], vorgabe: Sprache, abgedeckt?: Set<string>): { einheiten: Einheit[]; ast: AstErgebnis } {
  const ast = astLesen(datei);
  const einheiten: Einheit[] = [];
  const liste = abgedeckt ? [...abgedeckt] : [];
  for (const t of ast.texte) {
    if (istIntern(datei, t.zeile)) continue;
    // Ergänzung zu den Exporten: nur, was dort nicht schon als Feld gelesen wurde.
    if (abgedeckt) {
      const teile = t.text.split("…").map(glatt).filter((x) => x.length >= 4);
      if (!teile.length || teile.every((x) => abgedeckt.has(x) || liste.some((y) => y.includes(x)))) continue;
    }
    const sprache = t.sprache ?? rateSprache(t.text) ?? vorgabe;
    einheiten.push({ datei, feld: `${abgedeckt ? "ohne Export · " : ""}Zeile ${t.zeile}${t.pfad ? ` (${t.pfad})` : ""}`, zeile: t.zeile, sprache, text: t.text, flaechen, rolle: t.rolle });
  }
  return { einheiten, ast };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8  SAMMLER C — was Suchmaschinen und Assistenten wirklich bekommen: /llms.txt und die Datenblöcke im Vorab-HTML
// ═══════════════════════════════════════════════════════════════════════════
const LLMS_DATEI = "server/lib/fiaon-llms.ts";
const DATENBLOCK_DATEI = "server/lib/fiaon-seiten-seo.ts";

async function sammleLlms(): Promise<Einheit[]> {
  const { llmsTxt, llmsFullTxt } = await lade(LLMS_DATEI);
  const aus: Einheit[] = [];
  const q = quelltext(LLMS_DATEI);
  let sprache: Sprache = "de";
  let privat = false;
  (llmsTxt() as string).split("\n").forEach((zeile: string, i: number) => {
    if (/^## FIAON Global in English/.test(zeile)) sprache = "en";
    else if (/^## /.test(zeile) && sprache === "en") sprache = "de";
    // Die Privatkunden-Linie und der Kontakt gehören nicht zum Umbau; Seiten-Zeilen werden bei ihrer Seite geprüft.
    if (/^## FIAON Bonität/.test(zeile)) privat = true; else if (/^## /.test(zeile)) privat = /^## Kontakt/.test(zeile);
    const t = zeile.replace(/^[-#>\s]+/, "").trim();
    if (privat || !t || /^\[[^\]]+\]\(https?:\/\/[^)]+\):/.test(t) || /^(?:Stand|Volltext|E-Mail|Telefon|Impressum)\b/.test(t)) return;
    const wortgleich = q.includes(t.slice(0, 40));
    aus.push({ datei: LLMS_DATEI, feld: `/llms.txt Zeile ${i + 1}${wortgleich ? "" : " (zusammengesetzt)"}`, zeile: wortgleich ? q.slice(0, q.indexOf(t.slice(0, 40))).split("\n").length : undefined, sprache, text: t, seite: "/llms.txt", flaechen: ["llms"], rolle: zeile.startsWith("#") ? "titelartig" : "text" });
  });
  (llmsFullTxt() as string).split("\n").forEach((zeile: string, i: number) => {
    if (!/^(?:# |> )/.test(zeile)) return;
    const t = zeile.replace(/^[-#>\s]+/, "").trim();
    aus.push({ datei: LLMS_DATEI, feld: `/llms-full.txt Zeile ${i + 1}`, sprache: /full text in English/.test(t) ? "en" : "de", text: t, seite: "/llms-full.txt", flaechen: ["llms"], rolle: zeile.startsWith("#") ? "titelartig" : "text" });
  });
  return aus;
}

const LD_KEIN_TEXT = /^(?:@context|@type|@id|url|item|image|logo|sameAs|inLanguage|datePublished|dateModified|priceCurrency|price|lowPrice|highPrice|email|telephone|streetAddress|postalCode|addressCountry|addressLocality|propertyID|value|contactType|availableLanguage|applicationCategory|operatingSystem|position|identifier|width|height|target|urlTemplate|availability|validFrom|offerCount|isPartOf|mainEntityOfPage|publisher|author|provider|contentUrl|thumbnailUrl|foundingDate|legalName|areaServed)$/;

async function sammleDatenbloecke(pfade: string[], extra: Treffer[]): Promise<Einheit[]> {
  await lade("server/lib/fiaon-global-seo.ts");
  const { seitenHtml } = await lade(DATENBLOCK_DATEI);
  const aus: Einheit[] = [];
  const schon = new Set<string>();
  // Überschriften stehen im Datenblock als „H1 + zweite Zeile“ — auch das ist schon bei der Seite geprüft.
  try {
    const reg = await lade(REGISTER_INDEX);
    for (const x of [...reg.GLOBAL_SEITEN, ...reg.GLOBAL_SEITEN_EN, ...reg.LANDINGPAGES] as any[]) for (const t of [x.h1, `${x.h1} ${x.h1b ?? ""}`, x.seo?.titel, String(x.seo?.titel ?? "").replace(/\s+—\s+FIAON Global$/, "")]) if (t) merkeText(String(t), x.pfad);
  } catch { /* ohne Register wird hier eben doppelt gemeldet */ }
  for (const pfad of pfade) {
    const html = (seitenHtml(pfad) ?? "") as string;
    const { sprache, flaechen } = seitenKontext(pfad);
    const at = flaechen.includes("oesterreich");
    const bloecke = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => { try { return [JSON.parse(m[1])]; } catch { return []; } });
    const lauf = (knoten: unknown, weg: string): void => {
      if (Array.isArray(knoten)) { knoten.forEach((x, i) => lauf(x, `${weg}[${i}]`)); return; }
      if (!knoten || typeof knoten !== "object") return;
      const o = knoten as Record<string, unknown>;
      const typ = Array.isArray(o["@type"]) ? (o["@type"] as string[]).join("+") : String(o["@type"] ?? "");
      const hier = typ ? `${weg ? `${weg} › ` : ""}${typ}` : weg;
      // Österreich: kein Preis- und Leistungsblock im Datenblock (9.1 Nr. 7, 9.4).
      if (at && ("offers" in o || (("price" in o || "priceSpecification" in o) && !/offers/.test(weg)))) extra.push({ stufe: "ORT", datei: DATENBLOCK_DATEI, feld: `Datenblock ${pfad} › ${hier}`, fund: "offers / price", ersatz: "auf der Österreich-Seite kein Preis- und Leistungsblock im Datenblock", regel: "9.1-7", satz: kurz(JSON.stringify(o), 200) });
      // Länder im selben Block wie Konto, Karte, Finanzierung (5.12, 9.1 Nr. 8).
      const gebiet = JSON.stringify(o.areaServed ?? "");
      if (/"AT"|"CH"|Österreich|Schweiz|Austria|Switzerland/.test(gebiet)) {
        const eigene = Object.entries(o).filter(([k, v]) => typeof v === "string" && !LD_KEIN_TEXT.test(k)).map(([, v]) => v as string).join(" ");
        const m = eigene.match(sprache === "de" ? /[\p{L}‑-]*(?:konto|konten|karte(?!ll)|finanzier)[\p{L}‑-]*/iu : /(?<![\p{L}])(?:accounts?|cards?|financing)(?![\p{L}])/iu);
        const marke = `${hier}|${m?.[0]}|${at}`;
        if (m && !schon.has(marke)) { schon.add(marke); extra.push({ stufe: "SPERRE", datei: DATENBLOCK_DATEI, feld: `Datenblock ${pfad} › ${hier} › areaServed`, fund: `${gebiet.slice(0, 50)} + „${m[0]}“`, ersatz: "Österreich und die Schweiz stehen nie im selben Datenblock wie Konto, Karte oder Finanzierung — die Länder aus dem Block nehmen (5.12, 9.4)", regel: "9.1-8", satz: kurz(eigene, 200) }); }
      }
      for (const [k, v] of Object.entries(o)) {
        if (LD_KEIN_TEXT.test(k)) continue;
        if (typeof v === "string") {
          if (keinText(v)) continue;
          // Was wortgleich schon bei der Seite geprüft ist (Titel, Fragen, Beschreibung), wird hier nicht noch einmal gemeldet.
          const marke = `${at ? "AT|" : ""}${glatt(v)}`;
          if (schon.has(marke) || (at ? bekannteJeSeite.get(pfad)?.has(anfang(v)) : bekannteTexte.has(anfang(v)))) continue;
          schon.add(marke);
          aus.push({ datei: DATENBLOCK_DATEI, feld: `Datenblock ${pfad} › ${hier}.${k}`, zeile: zeileFinden(DATENBLOCK_DATEI, v), sprache, text: v, seite: pfad, flaechen: at ? ["datenblock", "oesterreich"] : ["datenblock"], rolle: "text" });
        } else lauf(v, `${hier}.${k}`);
      }
    };
    bloecke.forEach((b) => lauf(b, ""));
  }
  return aus;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9  DIE QUELLEN — welche Datei wie gelesen wird
// ═══════════════════════════════════════════════════════════════════════════
const NICHT_TEIL = /^shared\/fiaon-global-angebot|^shared\/fiaon-pakete\.ts$|^client\/src\/pages\/business-(?:auftrag|konto|angebot)|GlobalKontoLeiste\.tsx$|^client\/src\/pages\/(?:start|chef|agent|admin)|^scripts\/(?:pruef-|seo-wortverbote)/;
/** Nur reine Daten-Dateien werden geladen (ausgeführt). Alles andere — Skripte, Server, Bausteine — wird nur als Quelltext gelesen. */
const LADBAR = (datei: string): boolean => datei.startsWith("shared/") || datei.startsWith("client/src/i18n/");
const istGlobalSeoPfad = (p: string): boolean => p === "/" || p === "/en" || /^\/(?:en\/)?business(?:\/(?:start|mustervertrag|widerrufsbelehrung|privatpersonen|private-individuals))?$/.test(p) || VERTRAUEN_PFADE.includes(p);
const FLAECHEN_JE_DATEI: Record<string, Flaeche[]> = {
  "shared/fiaon-global-verkauf.ts": ["startseite"],
  [SAETZE_DATEI]: ["startseite", "saetze"],
  "shared/fiaon-global-seiten/ein-produkt.ts": ["karte", "unterseite"],
  "shared/fiaon-global-menue.ts": ["menue"],
  "client/src/i18n/global.ts": ["startseite"],
  "client/src/pages/site/business.tsx": ["startseite"],
  "client/src/pages/site/global-konfigurator.tsx": ["rechner"],
  "client/src/pages/site/global-lp.tsx": ["landingpage"],
  "client/src/components/site/GlobalFuss.tsx": ["fuss"],
  "client/src/components/site/GlobalNav.tsx": ["menue"],
  "client/src/components/site/global/HeroGlas.tsx": ["startseite"],
  "client/src/components/site/global/VerkaufKonfigurator.tsx": ["rechner", "startseite"],
  "client/src/components/site/global/VerkaufProdukt.tsx": ["startseite", "karte"],
  "scripts/og-business-bilder.ts": ["vorschaubild"],
};
function findeDateien(ordner: string, endung: RegExp, tief = true): string[] {
  const voll = path.join(WURZEL, ordner);
  if (!fs.existsSync(voll)) return [];
  const aus: string[] = [];
  for (const e of fs.readdirSync(voll, { withFileTypes: true })) {
    const p = `${ordner}/${e.name}`;
    if (e.isDirectory()) { if (tief) aus.push(...findeDateien(p, endung, tief)); } else if (endung.test(e.name)) aus.push(p);
  }
  return aus.sort();
}
function alleQuellen(): string[] {
  const seiten = findeDateien("shared/fiaon-global-seiten", /\.ts$/).filter((d) => !/\/typen\.ts$/.test(d));
  // Die Datei, in der eine Seite geschrieben ist, kommt vor den Sammel-Dateien: erst e439/, dann der Rest, index.ts zuletzt.
  const rang = (d: string): number => (d === REGISTER_INDEX ? 3 : /wissen-e439\.ts$/.test(d) ? 2 : /\/e439\//.test(d) ? 0 : 1);
  seiten.sort((a, b) => rang(a) - rang(b) || a.localeCompare(b));
  return [
    SAETZE_DATEI,
    "shared/fiaon-global-verkauf.ts",
    ...seiten,
    "shared/fiaon-global-menue.ts", "shared/fiaon-global-begriffe.ts", "shared/fiaon-global-partner.ts", "shared/fiaon-serioes-seite.ts",
    "shared/fiaon-seo-seiten.ts", "shared/fiaon-seo-fragen.ts",
    "client/src/i18n/global.ts", "client/src/i18n/global-seite.ts",
    ...["business.tsx", "global-konfigurator.tsx", "global-seite.tsx", "global-lp.tsx", "global-recht.tsx"].map((d) => `client/src/pages/site/${d}`),
    ...findeDateien("client/src/components/site", /^Global.*\.tsx$/, false),
    ...findeDateien("client/src/components/site/global", /\.tsx?$/),
    ...findeDateien("client/src/components/site/global-seite", /\.tsx?$/),
    // Der Server: /llms.txt (gebaut), die Datenblöcke im Vorab-HTML (gebaut), die Sätze der SEO-Anmeldung und die Wörter der Vorschaubilder (Quelltext).
    LLMS_DATEI, DATENBLOCK_DATEI, "server/lib/fiaon-global-seo.ts", "scripts/og-business-bilder.ts",
  ].filter((d) => !NICHT_TEIL.test(d) && fs.existsSync(path.join(WURZEL, d)));
}

/** Bausteine, die keine Seite lädt, werden nicht gezählt — nur genannt. */
let eingebunden: Set<string> | null = null;
function istEingebunden(datei: string): boolean {
  if (!/^client\/src\/components\//.test(datei)) return true;
  if (!eingebunden) {
    eingebunden = new Set();
    for (const d of findeDateien("client/src", /\.tsx?$/)) for (const m of fs.readFileSync(path.join(WURZEL, d), "utf8").matchAll(/(?:from|import)\s*\(?\s*["']([^"']+)["']/g)) eingebunden.add(`${path.basename(m[1]).replace(/\.tsx?$/, "")}|${d}`);
  }
  const name = path.basename(datei).replace(/\.tsx?$/, "");
  return [...eingebunden].some((x) => x.startsWith(`${name}|`) && !x.endsWith(`|${datei}`));
}

interface Lese { einheiten: Einheit[]; treffer: Treffer[]; notiz?: string }
/** Der Anfang eines Texts als Merkzeichen — ohne Auslassungspunkte und Satzzeichen am Ende. */
const anfang = (t: string): string => glatt(t).replace(/…$/, "").replace(/[.?!:]+$/, "").slice(0, 60);
const bekannteTexte = new Set<string>();
const bekannteJeSeite = new Map<string, Set<string>>();
const merkeText = (t: string, seite?: string): void => {
  bekannteTexte.add(anfang(t));
  if (seite) { if (!bekannteJeSeite.has(seite)) bekannteJeSeite.set(seite, new Set()); bekannteJeSeite.get(seite)!.add(anfang(t)); }
};
const merke = (einheiten: Einheit[]): void => { for (const e of einheiten) merkeText(e.text, e.seite); };

async function lese(datei: string, s: SaetzeWissen, alleSeitenPfade: () => Promise<string[]>): Promise<Lese> {
  if (NICHT_TEIL.test(datei)) return { einheiten: [], treffer: [], notiz: "nicht Teil der Wortwand (Vertrag, Angebot, Portal, /start, Privat-Seite oder ein Prüfprogramm)" };
  const flaechen = FLAECHEN_JE_DATEI[datei] ?? ["unterseite"];
  const vorgabe: Sprache = /\/en\/|-en\.tsx?$/.test(datei) ? "en" : "de";
  const treffer: Treffer[] = [];
  if (datei === LLMS_DATEI) return { einheiten: await sammleLlms(), treffer };
  if (datei === DATENBLOCK_DATEI) return { einheiten: await sammleDatenbloecke(await alleSeitenPfade(), treffer), treffer };
  // Bausteine und Seiten des Clients (und das Bilder-Skript) werden nie ausgeführt — nur ihr Quelltext wird gelesen.
  if (/\.tsx$/.test(datei) || !LADBAR(datei)) {
    if (!istEingebunden(datei)) return { einheiten: [], treffer, notiz: "keine Seite lädt diesen Baustein — nicht gezählt" };
    const { einheiten, ast } = sammleQuelltext(datei, flaechen, vorgabe);
    treffer.push(...getippteBetraege(datei, ast, s));
    return { einheiten, treffer };
  }
  // Daten-Dateien: Exporte lesen; dazu die Zeichenketten ohne Export (nur in reinen Global-Dateien).
  const gemischt = datei === "shared/fiaon-seo-seiten.ts" || datei === "shared/fiaon-seo-fragen.ts";
  const optionen: DatenOptionen = { flaechen, sprache: vorgabe };
  if (datei === "shared/fiaon-seo-seiten.ts") { optionen.nurExporte = (n) => n === "SEO_SEITEN"; optionen.nurSeiten = istGlobalSeoPfad; }
  if (datei === "shared/fiaon-seo-fragen.ts") { optionen.nurExporte = (n) => n === "SEO_FRAGEN"; optionen.nurSeiten = istGlobalSeoPfad; }
  if (datei === SAETZE_DATEI) optionen.nurExporte = (n) => !SAETZE_KEIN_TEXT.has(n);
  if (datei === "shared/fiaon-serioes-seite.ts") optionen.flaechen = ["vertrauen", "unterseite"];
  const { einheiten, roh } = await sammleDaten(datei, optionen);
  if (!gemischt) {
    const { einheiten: ohneExport, ast } = sammleQuelltext(datei, optionen.flaechen, vorgabe, roh);
    if (datei !== SAETZE_DATEI) { einheiten.push(...ohneExport); }
    treffer.push(...getippteBetraege(datei, ast, s));
  }
  return { einheiten, treffer };
}

// ═══════════════════════════════════════════════════════════════════════════
// 10  DAS REGISTER: Sprach-Gegenstück, Feld „stand“, Spiegel der Preisquelle
// ═══════════════════════════════════════════════════════════════════════════
const HEUTE = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Berlin" }).format(new Date());
function geaenderteDateien(): Set<string> {
  try { return new Set(execFileSync("git", ["status", "--porcelain"], { cwd: WURZEL, encoding: "utf8" }).split("\n").map((z) => z.slice(3).trim()).filter(Boolean)); } catch { return new Set(); }
}
async function registerProben(ziel: Set<string>, warnungen: string[]): Promise<Treffer[]> {
  const aus: Treffer[] = [];
  let register: any;
  try { register = await lade("shared/fiaon-global-seiten/index.ts"); } catch (e) { warnungen.push(`Das Register der Seiten lädt gerade nicht (${String(e).slice(0, 120)}) — Sprach-Gegenstück und „stand“ nicht geprüft.`); return aus; }
  const de = new Map<string, any>((register.GLOBAL_SEITEN as any[]).map((x) => [x.pfad, x]));
  const en = new Map<string, any>((register.GLOBAL_SEITEN_EN as any[]).map((x) => [x.pfad, x]));
  const geaendert = geaenderteDateien();
  const dateiVon = (pfad: string): string => seiteDatei.get(pfad)?.datei ?? geschriebenIn(pfad) ?? REGISTER_INDEX;
  for (const [pfad, seite] of [...de, ...en]) {
    const datei = dateiVon(pfad);
    if (!ziel.has(datei)) continue;
    const istEn = en.has(pfad);
    const schwester = istEn ? (DE_PFADE[pfad] ?? seite.schwester) : (EN_PFADE[pfad] ?? seite.schwester);
    const da = schwester && (istEn ? de : en).get(schwester);
    if (!da) aus.push({ stufe: "SPERRE", datei, feld: `〈${pfad}〉`, fund: schwester ? `Schwester ${schwester} fehlt` : "keine Schwester", ersatz: "jede Global-Seite hat ihr Sprach-Gegenstück — Deutsch und Englisch immer zusammen ändern (9.1 Nr. 12)", regel: "13-15", satz: pfad });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(seite.stand ?? "")) || seite.stand > HEUTE) aus.push({ stufe: "SPERRE", datei, feld: `〈${pfad}〉.stand`, fund: String(seite.stand ?? "(leer)"), ersatz: "das Feld „stand“ ist gesetzt: der Tag der letzten Änderung als JJJJ-MM-TT, nicht in der Zukunft", regel: "13-15", satz: pfad });
    else {
      if (da && da.stand !== seite.stand && (da.stand === HEUTE) !== (seite.stand === HEUTE)) aus.push({ stufe: "HINWEIS", datei, feld: `〈${pfad}〉.stand`, fund: `${seite.stand} ≠ ${da.stand}`, ersatz: `nur eine der beiden Sprachen trägt den Stand von heute (Schwester: ${schwester}) — Deutsch und Englisch werden zusammen geändert`, regel: "13-15", satz: pfad });
      if (geaendert.has(datei) && seite.stand < HEUTE) aus.push({ stufe: "HINWEIS", datei, feld: `〈${pfad}〉.stand`, fund: seite.stand, ersatz: `die Datei ist geändert und noch nicht gespeichert: bei jeder inhaltlich geänderten Seite „stand“ auf ${HEUTE} setzen (sonst erfährt die Suchmaschine nichts)`, regel: "13-15", satz: pfad });
    }
  }
  return aus;
}

/** Deutsch und Englisch gleich gebaut? Ein Feld, das nur in einer Sprache steht, wird gezeigt (HINWEIS). */
async function gleichGebaut(datei: string, name: string): Promise<Treffer[]> {
  const aus: Treffer[] = [];
  try {
    const paar = (await lade(datei))[name];
    if (!paar?.de || !paar?.en) return aus;
    const felder = (x: unknown, p: string, f: Set<string>, tiefe = 0): Set<string> => {
      if (x && typeof x === "object" && !Array.isArray(x) && tiefe < 6) for (const [k, v] of Object.entries(x)) { f.add(`${p}.${k}`); felder(v, `${p}.${k}`, f, tiefe + 1); }
      return f;
    };
    const a = felder(paar.de, "", new Set()); const b = felder(paar.en, "", new Set());
    for (const k of a) if (!b.has(k)) aus.push({ stufe: "HINWEIS", datei, feld: `${name}.en${k}`, fund: "fehlt englisch", ersatz: "Deutsch und Englisch sind gleich gebaut — das Feld steht nur deutsch", regel: "13-15", satz: `${name}.de${k}` });
    for (const k of b) if (!a.has(k)) aus.push({ stufe: "HINWEIS", datei, feld: `${name}.de${k}`, fund: "fehlt deutsch", ersatz: "Deutsch und Englisch sind gleich gebaut — das Feld steht nur englisch", regel: "13-15", satz: `${name}.en${k}` });
  } catch { /* lädt nicht — meldet der Hauptlauf */ }
  return aus;
}

/** Die Sätze-Datei spiegelt drei Dinge, die sie nicht einbinden darf (Kreis). Hier wird verglichen. */
async function spiegelProbe(s: SaetzeWissen, warnungen: string[]): Promise<string[]> {
  const fehler: string[] = [];
  const m = s.modul;
  const versuch = async (was: string, f: () => Promise<void>) => { try { await f(); } catch (e) { warnungen.push(`Spiegel-Probe „${was}“ übersprungen: ${String(e).slice(0, 140)}`); } };
  await versuch("Mindestbetrag des Erfolgshonorars", async () => {
    const kc = await lade("shared/fiaon-global-angebot-kapital-c.ts");
    if (kc.KAPITAL_C_STAFFEL.mindestCents !== m.SAETZE_ERFOLG_MIN_CENTS) fehler.push(`SAETZE_ERFOLG_MIN_CENTS (${m.SAETZE_ERFOLG_MIN_CENTS}) weicht vom Vertragsmotor ab (KAPITAL_C_STAFFEL.mindestCents = ${kc.KAPITAL_C_STAFFEL.mindestCents})`);
  });
  await versuch("Spanne des Kapitalrahmens", async () => {
    const { EIN_PRODUKT } = await lade("shared/fiaon-global-seiten/ein-produkt.ts");
    for (const sp of ["de", "en"] as const) if (EIN_PRODUKT[sp].rahmen !== m.SAETZE_BETRAEGE[sp].rahmen) fehler.push(`SAETZE_BETRAEGE.${sp}.rahmen („${m.SAETZE_BETRAEGE[sp].rahmen}“) weicht von EIN_PRODUKT.${sp}.rahmen ab („${EIN_PRODUKT[sp].rahmen}“)`);
    const { VERKAUF_RAHMEN } = await lade("shared/fiaon-global-verkauf-preise.ts");
    if (VERKAUF_RAHMEN.maxUsd !== 1_000_000) fehler.push(`Der Miami-Satz nennt 1 Mio. US-Dollar, die Preisquelle sagt ${VERKAUF_RAHMEN.maxUsd}`);
  });
  await versuch("Satz S13 und Register-Adresse", async () => {
    const p = await lade("shared/fiaon-global-partner.ts");
    if (p.GLOBAL_VERBUNDEN !== m.FESTE_SAETZE.S13.de || p.GLOBAL_VERBUNDEN_EN !== m.FESTE_SAETZE.S13.en) fehler.push("S13 weicht von GLOBAL_VERBUNDEN / GLOBAL_VERBUNDEN_EN ab (shared/fiaon-global-partner.ts)");
    const ser = await lade("shared/fiaon-serioes.ts");
    if (m.VERTRAUENS_BAND.de[0].adresse !== ser.COMPANIES_HOUSE_URL) fehler.push("Die Register-Adresse im Vertrauens-Band weicht von COMPANIES_HOUSE_URL ab (shared/fiaon-serioes.ts)");
  });
  await versuch("Österreich-Seiten", async () => {
    const wr = await lade("shared/fiaon-global-wortregeln.ts");
    if ([...wr.OESTERREICH_SEITEN].sort().join() !== [...m.LAENDER_SEITEN.AT].sort().join()) fehler.push("LAENDER_SEITEN.AT weicht von OESTERREICH_SEITEN ab (shared/fiaon-global-wortregeln.ts)");
    for (const p of [...m.LAENDER_SEITEN.AT, ...m.LAENDER_SEITEN.CH]) if (!p.startsWith("/en/") ? !(p in EN_PFADE) : !(p in DE_PFADE)) fehler.push(`LAENDER_SEITEN nennt ${p} — die Adresse steht nicht in shared/fiaon-global-pfade.ts`);
  });
  return fehler;
}

// ═══════════════════════════════════════════════════════════════════════════
// 11  DIE GEGENPROBE — falsche Sätze müssen erkannt werden, erlaubte dürfen nicht anschlagen
// ═══════════════════════════════════════════════════════════════════════════
interface Probe { text: string; sprache: Sprache; flaechen?: Flaeche[]; rolle?: Rolle; seite?: string; art?: string }
const P = (sprache: Sprache, text: string, mehr: Omit<Probe, "text" | "sprache"> = {}): Probe => ({ sprache, text, ...mehr });
const AT: Flaeche[] = ["oesterreich", "unterseite"];
const WISSEN: Omit<Probe, "text" | "sprache"> = { flaechen: ["wissen", "unterseite"], art: "wissen" };

const FALSCH: Record<Exclude<Stufe, "EINMAL">, Probe[]> = {
  SPERRE: [
    P("de", "Die Kartenleiter in vier Etappen"),
    P("de", "Ihr Preis steht in einer Minute. Unterschreiben können Sie online."),
    P("de", "Keine Pakete, keine Stufen."),
    P("de", "Wir begleiten Sie bis zur Auszahlung."),
    P("de", "Vier Schritte. Kein Hexenwerk."),
    P("de", "Finanzierung garantiert — bis zu 1.000.000 US-Dollar."),
    P("de", "Unser Team vor Ort in Miami reicht die Gründung ein."),
    P("de", "Die Gründung dauert 3 Wochen."),
    P("de", "Unsere US-Partnergesellschaft übernimmt die Bürgschaft."),
    P("de", "Mit der US-LLC Steuern sparen."),
    P("de", "Bekannt aus Die Presse."),
    P("de", "Zitiert in Die Presse (2.11.2026)"),
    P("de", "Es wächst nicht mit der Zahl der Anträge."),
    P("de", "Nach positiver Prüfung begleiten wir Ihre Gesellschaft bis zur Finanzierung."),
    P("de", "Geld-zurück-Garantie: Kommt die Auszahlung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles."),
    P("de", "US-Gesellschaft gründen mit aktiver Betreuung und allem Drum und Dran — FIAON Global", { rolle: "titel" }),
    P("de", "Rechtsberatung durch Anwälte aus unserem Partnernetz."),
    P("de", "Alle 18 Monate schulden Sie um — für niedrige Zinsen."),
    P("de", "Das Erfolgshonorar gibt es schon ab 2.990 €."),
    P("de", "Schwarzott Group, Miami"),
    P("de", "Das Konto steht innerhalb von 10 Tagen.", WISSEN),
    P("de", "Unsere Mandanten zahlen per Rechnung."),
    P("de", "US-Gesellschaft für Unternehmer aus Deutschland, Österreich und der Schweiz: Gründung, Konto und Karten.", { rolle: "beschreibung" }),
    P("en", "The card ladder in four stages"),
    P("en", "Your price is ready in a minute."),
    P("en", "One mandate. Everything in it."),
    P("en", "We support you through to payout."),
    P("en", "Financing guaranteed — up to US$1,000,000."),
    P("en", "Build your offer"),
    P("en", "Annual care for a fixed price."),
    P("en", "Formation takes 3 weeks."),
    P("en", "Subject to satisfactory due diligence, we support your company through to financing."),
    P("en", "With the surety of our US partner company."),
    P("en", "Legal advice from our lawyers, and it is free."),
    P("en", "Quoted in Die Presse, 2 November 2026"),
    P("en", "It does not rise with the number of applications."),
    P("en", "Money-back guarantee: we refund everything."),
  ],
  "SPERRE-WIR": [
    P("de", "Wir eröffnen Ihr Geschäftskonto."),
    P("de", "Wir besorgen Ihre Steuernummern."),
    P("de", "Ihre Kanzlei für die Gründung in den USA."),
    P("en", "We open your account."),
    P("en", "We obtain the tax numbers for you."),
    P("en", "Your law firm for US formation."),
  ],
  ORT: [
    P("de", "Unternehmensberatung für Ihre US-Gesellschaft", { flaechen: AT }),
    P("de", "Wir bereiten Ihr Geschäftskonto und Ihre Firmenkreditkarte vor.", { flaechen: AT }),
    P("de", "Ihr weiteres Vorhaben, etwa eine Finanzierung, besprechen wir persönlich.", { flaechen: AT }),
    P("de", "Gründung für 2.799 € mit Ihrem Auftrag.", { flaechen: AT }),
    P("de", "Unsere US-Partnergesellschaft begleitet Sie.", { flaechen: ["startseite"] }),
    P("de", "US-Gesellschaft mit Konto aus der Schweiz — FIAON Global", { flaechen: ["schweiz", "unterseite"], rolle: "titel" }),
    P("en", "Business consultancy for your US company", { flaechen: AT }),
    P("en", "We prepare your account and card applications.", { flaechen: AT }),
    P("en", "Our partner company supports you.", { flaechen: ["fuss"] }),
  ],
  HINWEIS: [
    P("de", "Kapital", { rolle: "h2" }),
    P("de", "Unsere Kunden unterschreiben online."),
    P("de", "Das läuft aus der Ferne."),
    P("de", "Ihre Gesellschaft wird angemeldet, eingetragen, dokumentiert."),
    P("en", "Capital", { rolle: "h2" }),
    P("en", "Our customers work with us remotely."),
  ],
};
const EINMAL_PROBEN: Probe[][] = [
  [P("de", "Ein Ansprechpartner statt acht."), P("de", "Ein Ansprechpartner statt acht Anlaufstellen.")],
  [P("de", "Alles aus einer Hand."), P("de", "Gründung und Betreuung aus einer Hand.")],
  [P("en", "One contact instead of eight."), P("en", "A single contact instead of eight.")],
  [P("de", "Zitiert in Die Presse (02.11.2026)"), P("de", "Zitiert in Die Presse (02.11.2026)")],
];
/** Erlaubte Sätze — die Ausnahmen des Leitfadens. Keiner darf SPERRE, ORT, SPERRE-WIR oder EINMAL auslösen. */
const ERLAUBT: Probe[] = [
  P("de", "Geld-zurück-Garantie: Kommt die Auszahlung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben.", { flaechen: ["startseite"] }),
  P("de", "Firmenkreditkarten setzen in der Regel die persönliche Haftung des Inhabers voraus."),
  P("de", "FIAON ist keine Bank und keine Kanzlei. FIAON vergibt und vermittelt keine Kredite."),
  P("de", "Was FIAON ist — und was nicht: keine Bank, kein Kreditvermittler, kein Steuermodell, keine Kanzlei."),
  P("de", "Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami."),
  P("de", "Sie zahlen per Rechnung und Überweisung an die FIAON LTD. Kein Abo, keine Abbuchung."),
  P("de", "Erstgespräch: dreißig Minuten, kostenfrei."),
  P("de", "Zitiert in Die Presse (02.11.2026)"),
  P("de", "Alle Beträge sind Endpreise. Kommt es nicht zur Eintragung, entfällt das Erfolgshonorar."),
  P("de", "Einlage, Bürgschaft der Muttergesellschaft, Immobilie", WISSEN),
  P("de", "Kann eine Muttergesellschaft in Europa für die US-Gesellschaft bürgen?", WISSEN),
  P("de", "FIAON LTD, London · eingetragen im Companies House (England und Wales), Nr. 17318250"),
  P("de", "Von der Eintragung bis zur Steuernummer."),
  P("de", "Banken und Investoren ist Delaware vertraut."),
  P("de", "Steuerlich wird die Gesellschaft transparent behandelt.", WISSEN),
  P("de", "Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.", WISSEN),
  P("de", "Die Schwarzott Group ist mit FIAON über unseren Gründer Justin Schwarzott verbunden. Ihr Vertragspartner ist in jedem Fall die FIAON LTD."),
  P("de", "Wir prüfen zuerst Ihre Unterlagen. Danach erhalten Sie Ihr Angebot."),
  P("de", "Die Meldung ist spätestens 45 Kalendertage nach dem Erwerb fällig.", WISSEN),
  P("de", "„Steuerfrei“ oder „ohne Steuern“ verschweigt den Ort der Geschäftsleitung.", WISSEN),
  P("de", "Die EIN ist bei der US-Steuerbehörde kostenlos.", WISSEN),
  P("de", "Anders als eine GmbH braucht die LLC kein Mindestkapital; die Gründung geht ohne Termin beim Notar."),
  P("de", "US-Gesellschaft (LLC) gründen mit Betreuung — FIAON Global", { rolle: "titel", flaechen: ["startseite"] }),
  P("de", "Unternehmensberatung für Ihre US-Gesellschaft: LLC-Gründung, EIN und ITIN, US-Büro, vorbereitete Anträge. Ihr Honorar sehen Sie vorab und vollständig.", { rolle: "beschreibung", flaechen: ["startseite"] }),
  P("de", "US-Gesellschaft aus Österreich: Gründung, Steuernummern und Meldungen im ersten Jahr. Ihr weiteres Vorhaben besprechen wir persönlich.", { rolle: "beschreibung", flaechen: AT }),
  P("de", "FIAON Global gründet Ihre US-Gesellschaft, holt jede Unterlage ein und übernimmt im ersten Jahr Fristen und Meldungen.", { flaechen: AT }),
  P("de", "US-Gesellschaft aus der Schweiz: tatsächliche Verwaltung, Steuerpflicht und Meldungen — Gründung und Steuernummern in einem Mandat.", { rolle: "beschreibung", flaechen: ["schweiz", "unterseite"] }),
  P("en", "Money-back commitment: if the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us.", { flaechen: ["startseite"] }),
  P("en", "Business credit cards generally require a personal guarantee from the owner."),
  P("en", "FIAON is neither a bank nor a law firm. FIAON does not lend and does not broker loans."),
  P("en", "What FIAON is — and is not: not a bank, does not broker loans, not a tax scheme, not a law firm."),
  P("en", "Your company submits the application and decides on any financing offer from the lender."),
  P("en", "You pay by invoice and bank transfer to FIAON LTD. No subscription, no direct debit."),
  P("en", "Quoted in Die Presse (2 November 2026)"),
  P("en", "A funding target is a goal, not a promise. You choose it yourself."),
  P("en", "Deposit, parent company surety, property", WISSEN),
  P("en", "Your initial call: thirty minutes, free of charge."),
  P("en", "Some issuers offer introductory periods; each issuer sets its own terms.", WISSEN),
  P("en", "In order to apply, you sign the documents we present."),
  P("en", "The report falls due 45 calendar days after the acquisition.", WISSEN),
  P("en", "FIAON is not affiliated with companies of a similar name."),
  P("en", "The limits of the approved cards are added together.", WISSEN),
  P("en", "For US tax purposes the company is treated as tax-transparent.", WISSEN),
  P("en", "FIAON LTD, London · registered in England and Wales, company number 17318250"),
  P("en", "Business consultancy for your US company: LLC formation, EIN and ITIN, US office and prepared applications. Your fees are set out in full before you sign.", { rolle: "beschreibung", flaechen: ["startseite"] }),
  P("en", "FIAON Global forms your US company, assembles its documents in full and handles deadlines and filings in the first year.", { flaechen: AT }),
  P("en", "Request your proposal"),
  P("en", "Arrange a call"),
];
/** Erlaubte Sätze, die auch keinen HINWEIS auslösen dürfen (genannte Ausnahmen von HINWEIS-Zeilen). */
const OHNE_HINWEIS: Probe[] = [
  P("de", "FIAON LTD, London · eingetragen im Companies House (England und Wales), Nr. 17318250"),
  P("de", "Banken und Investoren ist Delaware vertraut."),
  P("de", "Für Ihre ITIN prüfen wir vorab, ob die Voraussetzungen vorliegen (ITIN-Check)."),
  P("de", "Diese Seite erklärt Grundlagen und ersetzt keine steuerliche oder rechtliche Prüfung Ihres Falls.", WISSEN),
  P("en", "FIAON LTD, London · registered in England and Wales, company number 17318250"),
];

function probeEinheit(p: Probe, i: number, seite = `/probe/${i}`): Einheit {
  return { datei: "(Gegenprobe)", feld: `Probe ${i + 1}`, sprache: p.sprache, text: p.text, seite: p.seite ?? seite, art: p.art, flaechen: p.flaechen ?? ["unterseite"], rolle: p.rolle ?? "text" };
}
function gegenprobe(s: SaetzeWissen): { fehler: string[]; falsch: number; erlaubt: number } {
  const fehler: string[] = [];
  let falsch = 0; let erlaubt = 0;
  for (const stufe of Object.keys(FALSCH) as (keyof typeof FALSCH)[]) FALSCH[stufe].forEach((p, i) => {
    falsch++;
    const t = pruefe([probeEinheit(p, i)], s);
    if (!t.some((x) => x.stufe === stufe)) fehler.push(`NICHT ERKANNT (${stufe}, ${p.sprache}): „${p.text}“${t.length ? ` — gemeldet nur: ${t.map((x) => `${x.stufe} ${x.fund}`).join(", ")}` : ""}`);
  });
  EINMAL_PROBEN.forEach((paar, i) => {
    falsch++;
    const t = pruefe(paar.map((p, j) => probeEinheit(p, j, `/probe/einmal/${i}`)), s);
    if (t.filter((x) => x.stufe === "EINMAL").length !== 1) fehler.push(`NICHT ERKANNT (EINMAL, ${paar[0].sprache}): „${paar[0].text}“ + „${paar[1].text}“ — erwartet genau ein Treffer für das zweite Vorkommen`);
    if (pruefe([probeEinheit(paar[0], 0, `/probe/einmal-allein/${i}`)], s).some((x) => x.stufe === "EINMAL")) fehler.push(`ZU STRENG (EINMAL): das erste Vorkommen ist erlaubt — „${paar[0].text}“`);
  });
  // Jeder noch nicht freigegebene Satz muss als SPERRE erkannt werden, sobald er auf einer Seite steht.
  for (const p of s.geparkt) {
    falsch++;
    const sprache: Sprache = rateSprache(p.satz) ?? "de";
    if (!pruefe([probeEinheit(P(sprache, `Davor ein Satz. ${p.satz} Danach ein Satz.`, { flaechen: ["startseite"] }), 0)], s).some((x) => x.stufe === "SPERRE" && x.regel.startsWith("0.3"))) fehler.push(`NICHT ERKANNT (nicht freigegeben, ${p.nr}): „${p.satz}“`);
  }
  const hart = (t: Treffer[]): Treffer[] => t.filter((x) => x.stufe !== "HINWEIS");
  ERLAUBT.forEach((p, i) => {
    erlaubt++;
    const t = hart(pruefe([probeEinheit(p, i)], s));
    if (t.length) fehler.push(`SCHLÄGT AN (erlaubt, ${p.sprache}): „${p.text}“ — ${t.map((x) => `${x.stufe} „${x.fund}“ [${x.regel}]`).join(", ")}`);
  });
  OHNE_HINWEIS.forEach((p, i) => {
    erlaubt++;
    const t = pruefe([probeEinheit(p, i)], s);
    if (t.length) fehler.push(`SCHLÄGT AN (erlaubt, auch kein HINWEIS, ${p.sprache}): „${p.text}“ — ${t.map((x) => `${x.stufe} „${x.fund}“ [${x.regel}]`).join(", ")}`);
  });
  return { fehler, falsch, erlaubt };
}
/** Liest das Programm aus einer .tsx-Datei das Richtige? Sichtbarer Text ja — Klassen, Pfade, Kommentare und „intern“ markierte Zeilen nein. */
function quelltextProbe(s: SaetzeWissen): string[] {
  const datei = "(Gegenprobe).tsx";
  const b = s.modul.SAETZE_BETRAEGE.de.honorarAuftrag;
  quelltextCache.set(datei, [
    'import { x } from "./kein-hexenwerk-im-pfad";',
    "// Kein Hexenwerk im Kommentar",
    "export function Probe({ en }: { en: boolean }) {",
    '  const klasse = "fg-knopf hell schnell-einblenden";',
    '  console.log("Kein Hexenwerk im Protokoll"); // wortwand: intern — nur fürs Protokoll',
    "  return (",
    '    <section className="paket-raster" id="kartenleiter" aria-label={en ? "Your price in a minute" : "Ihr Angebot"}>',
    "      <h2>Vier Schritte. Kein Hexenwerk.</h2>",
    `      <p>{en ? "One mandate" : "Gründung für ${b} mit Ihrem Auftrag"}</p>`,
    '      <a className={klasse} href="/business/start">Angebot anfordern</a>',
    "    </section>",
    "  );",
    "}",
  ].join("\n"));
  const fehler: string[] = [];
  const { einheiten, ast } = sammleQuelltext(datei, ["unterseite"], "de");
  const texte = einheiten.map((e) => `${e.sprache}:${e.text}`);
  const soll = ["en:Your price in a minute", "de:Ihr Angebot", "de:Vier Schritte. Kein Hexenwerk.", "en:One mandate", `de:Gründung für ${b} mit Ihrem Auftrag`, "de:Angebot anfordern"];
  for (const x of soll) if (!texte.includes(x)) fehler.push(`QUELLTEXT: sichtbarer Text nicht gelesen — „${x}“ (gelesen: ${texte.join(" | ")})`);
  for (const x of texte) if (!soll.includes(x)) fehler.push(`QUELLTEXT: als Text gelesen, was keiner ist — „${x}“`);
  const t = pruefe(einheiten, s);
  for (const [fund, regel] of [["Hexenwerk", "14-67"], ["Your price", "14-33"], ["mandate", "14-46"]] as const) if (!t.some((x) => x.regel === regel && x.fund.includes(fund))) fehler.push(`QUELLTEXT: „${fund}“ im sichtbaren Text nicht erkannt (${regel})`);
  if (getippteBetraege(datei, ast, s).length !== 1) fehler.push(`QUELLTEXT: der getippte Betrag „${b}“ wurde nicht (genau einmal) erkannt`);
  quelltextCache.delete(datei);
  internZeilen.length = 0;
  return fehler;
}

/** Jeder freigegebene feste Satz besteht die Wand — auf seiner Fläche (Österreich-Fassungen auf der Österreich-Seite). */
async function saetzeProbe(s: SaetzeWissen): Promise<{ fehler: string[]; anzahl: number }> {
  const { einheiten } = await sammleDaten(SAETZE_DATEI, { flaechen: FLAECHEN_JE_DATEI[SAETZE_DATEI], nurExporte: (n) => !SAETZE_KEIN_TEXT.has(n) });
  const fehler = pruefe(einheiten, s).filter((x) => x.stufe !== "HINWEIS").map((x) => `FESTER SATZ SCHLÄGT AN: ${x.feld} — ${x.stufe} „${x.fund}“ [${x.regel}] in „${x.satz}“`);
  return { fehler, anzahl: einheiten.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// 12  DER LAUF
// ═══════════════════════════════════════════════════════════════════════════
const argv = process.argv.slice(2);
const schalter = (name: string): boolean => argv.includes(name);
const wertVon = (name: string): string | undefined => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const MIT_WERT = ["--nur", "--text", "--sprache", "--flaeche"];
const pfadArgs = argv.filter((a, i) => !a.startsWith("--") && !MIT_WERT.includes(argv[i - 1] ?? ""));
const NUR = wertVon("--nur")?.split(",").map((x) => x.trim().toUpperCase()) as Stufe[] | undefined;

if (schalter("--hilfe") || schalter("--help")) {
  console.log(quelltext("scripts/pruef-global-leitfaden.ts").split("\n").slice(0, 54).map((z) => z.replace(/^\/\/ ?/, "")).join("\n"));
  process.exit(0);
}

const start = Date.now();
const warnungen: string[] = [];
const saetze = await saetzeLaden();
LAENDER = saetze.modul.LAENDER_SEITEN;
HONORAR_ZAHLEN = (["de", "en"] as const).flatMap((sp) => (["honorarAuftrag", "fastTrack", "jahresbetreuung", "erfolgMin"] as const).map((f) => String(saetze.modul.SAETZE_BETRAEGE[sp][f]).replace(/[^\d]/g, "")));
try { const pf = await lade("shared/fiaon-global-pfade.ts"); EN_PFADE = pf.GLOBAL_EN_PFADE; DE_PFADE = pf.GLOBAL_DE_PFADE; } catch (e) { warnungen.push(`shared/fiaon-global-pfade.ts lädt nicht (${String(e).slice(0, 100)})`); }

// ── Gegenprobe ──
{
  const g = gegenprobe(saetze);
  const f = await saetzeProbe(saetze);
  const fehler = [...g.fehler, ...f.fehler, ...quelltextProbe(saetze)];
  if (fehler.length) {
    console.log(`GEGENPROBE NICHT BESTANDEN — ${fehler.length} Fehler. Das Prüfprogramm selbst ist falsch; es prüft nichts, bis das behoben ist.`);
    for (const x of fehler) console.log(`  ${x}`);
    process.exit(2);
  }
  if (!schalter("--zaehlen")) console.log(`Gegenprobe bestanden: ${g.falsch} falsche Sätze erkannt, ${g.erlaubt} erlaubte Sätze und ${f.anzahl} feste Sätze ohne Treffer.`);
}

// ── Ein Entwurf als Textdatei ──
const textDatei = wertVon("--text");
let einheiten: Einheit[] = [];
let treffer: Treffer[] = [];
const notizen: string[] = [];
const geprueft: string[] = [];
let ladeFehler = 0;

if (textDatei) {
  const sprache: Sprache = wertVon("--sprache") === "en" ? "en" : "de";
  const flaeche = (wertVon("--flaeche") ?? "unterseite") as Flaeche;
  const name = path.resolve(textDatei);
  fs.readFileSync(name, "utf8").split("\n").forEach((zeile, i) => {
    if (zeile.trim()) einheiten.push({ datei: path.basename(name), feld: `Zeile ${i + 1}`, zeile: i + 1, sprache, text: zeile.trim(), seite: name, flaechen: flaeche === "unterseite" ? ["unterseite"] : [flaeche, "unterseite"], rolle: "text" });
  });
  geprueft.push(path.basename(name));
} else {
  const alle = alleQuellen();
  const ziel = pfadArgs.length ? pfadArgs.map(relativ) : alle;
  const zielMenge = new Set(ziel);
  let seitenPfade: string[] | null = null;
  const alleSeitenPfade = async (): Promise<string[]> => {
    if (seitenPfade) return seitenPfade;
    const reg = await lade("shared/fiaon-global-seiten/index.ts");
    seitenPfade = ["/", "/en", "/business/start", "/en/business/start", "/business/mustervertrag", "/en/business/mustervertrag", ...VERTRAUEN_PFADE,
      ...(reg.GLOBAL_SEITEN as any[]).map((x) => x.pfad), ...(reg.GLOBAL_SEITEN_EN as any[]).map((x) => x.pfad), ...(reg.LANDINGPAGES as any[]).map((x) => x.pfad)];
    return seitenPfade;
  };
  // Für die Datenblöcke muss bekannt sein, was schon bei den Seiten steht — auch wenn nur die Server-Datei geprüft wird.
  if (zielMenge.has(DATENBLOCK_DATEI) && pfadArgs.length) {
    for (const d of alle) if (/^shared\/|^client\/src\/i18n\//.test(d) && !zielMenge.has(d)) { try { merke((await sammleDaten(d, { flaechen: ["unterseite"] })).einheiten); } catch { /* lädt nicht — dann wird dort eben doppelt gemeldet */ } }
    seiteDatei.clear();
  }
  // Die Server-Dateien zuletzt (sie brauchen die Texte der Seiten); sonst in der Reihenfolge der Quellenliste.
  const rang = (d: string): number => (d === DATENBLOCK_DATEI ? 2 : d === LLMS_DATEI ? 1 : 0);
  const reihenfolge = [...ziel].sort((a, b) => rang(a) - rang(b) || (alle.indexOf(a) < 0 ? 1e6 : alle.indexOf(a)) - (alle.indexOf(b) < 0 ? 1e6 : alle.indexOf(b)));
  for (const datei of reihenfolge) {
    if (!fs.existsSync(path.join(WURZEL, datei))) { treffer.push({ stufe: "SPERRE", datei, feld: "—", fund: "Datei fehlt", ersatz: "Pfad prüfen (relativ zur Arbeitskopie)", regel: "Lade-Probe", satz: "" }); ladeFehler++; continue; }
    try {
      const l = await lese(datei, saetze, alleSeitenPfade);
      if (l.notiz) notizen.push(`${datei}: ${l.notiz}`); else geprueft.push(datei);
      merke(l.einheiten);
      einheiten.push(...l.einheiten);
      treffer.push(...l.treffer);
    } catch (e) {
      ladeFehler++;
      treffer.push({ stufe: "SPERRE", datei, feld: "—", fund: "LÄDT NICHT", ersatz: "die Datei muss laden (Lade-Probe) — vielleicht schreibt gerade jemand an einer eingebundenen Datei: 20 Sekunden warten und neu starten", regel: "Lade-Probe", satz: String((e as Error)?.message ?? e).split("\n")[0].slice(0, 200) });
    }
  }
  // Register: Sprach-Gegenstück und „stand“; Deutsch und Englisch gleich gebaut; Spiegel der Preisquelle.
  if (ziel.some((d) => /^shared\/fiaon-global-seiten\//.test(d))) treffer.push(...await registerProben(zielMenge, warnungen));
  for (const [datei, name] of [["shared/fiaon-global-verkauf.ts", "VERKAUF_TEXTE"], ["client/src/i18n/global.ts", "GLOBAL_WOERTER"], ["client/src/i18n/global-seite.ts", "GLOBAL_SEITE_WOERTER"], ["shared/fiaon-global-seiten/ein-produkt.ts", "EIN_PRODUKT"]] as const) if (zielMenge.has(datei)) treffer.push(...await gleichGebaut(datei, name));
  if (!pfadArgs.length || zielMenge.has(SAETZE_DATEI)) {
    const spiegel = await spiegelProbe(saetze, warnungen);
    for (const x of spiegel) treffer.push({ stufe: "SPERRE", datei: SAETZE_DATEI, feld: "Spiegel der Preisquelle", fund: "weicht ab", ersatz: x, regel: "0.5", satz: "" });
  }
  // Wer die noch nicht freigegebenen Sätze im Quelltext anfasst, wird genannt — keine Seite benutzt sie.
  for (const datei of geprueft) if (datei !== SAETZE_DATEI && /SAETZE_NICHT_FREIGEGEBEN/.test(quelltext(datei).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, ""))) treffer.push({ stufe: "SPERRE", datei, feld: "Quelltext", fund: "SAETZE_NICHT_FREIGEGEBEN", ersatz: "keine Seite benutzt die noch nicht freigegebenen Sätze — satz(), sechsSchritte() und geldZurueck() liefern die Fassung, die heute gilt", regel: "0.3", satz: "" });
  // Der Link zur Presse: nur die eine Adresse.
  for (const datei of geprueft) for (const m of quelltext(datei).matchAll(/https?:\/\/[^\s"'`)]*diepresse\.com[^\s"'`)]*/g)) if (m[0] !== saetze.presse.adresse) treffer.push({ stufe: "SPERRE", datei, feld: `Zeile ${quelltext(datei).slice(0, m.index).split("\n").length}`, fund: m[0], ersatz: `der Link der Presse-Zeile ist genau ${saetze.presse.adresse} — aus PRESSE_ZEILE.adresse`, regel: "6.3", satz: "" });
}

treffer.push(...pruefe(einheiten, saetze));

// ── Welche Texte wurden gelesen? (--texte: zum Nachsehen, was das Programm aus einer Datei herausliest) ──
if (schalter("--texte")) {
  for (const e of einheiten) console.log(`${e.datei} · ${e.zeile && !/Zeile \d+/.test(e.feld) ? `Z. ${e.zeile} · ` : ""}${e.feld} · ${e.sprache} · ${e.rolle} · ${e.flaechen.join("+")} · „${kurz(e.text, 160)}“`);
  console.log(`${einheiten.length} Texte.`);
  process.exit(0);
}

// ── Ausgabe ──
const rangStufe = (x: Stufe): number => STUFEN.indexOf(x);
treffer.sort((a, b) => a.datei.localeCompare(b.datei) || rangStufe(a.stufe) - rangStufe(b.stufe) || (a.zeile ?? 0) - (b.zeile ?? 0) || a.feld.localeCompare(b.feld));
if (!schalter("--zaehlen")) {
  let letzte = "";
  for (const t of treffer) {
    if (NUR && !NUR.includes(t.stufe)) continue;
    if (t.datei !== letzte) { console.log(`\n── ${t.datei} ${"─".repeat(Math.max(3, 96 - t.datei.length))}`); letzte = t.datei; }
    const stelle = t.zeile && !/Zeile \d+/.test(t.feld) ? `${t.feld} (Z. ${t.zeile})` : t.feld;
    console.log(`${t.stufe} · ${t.datei} · ${stelle} · „${t.fund}“ → ${t.ersatz} [${t.regel}]`);
    if (!schalter("--knapp") && t.satz && glatt(t.satz) !== glatt(t.fund)) console.log(`      „${t.satz}“`);
  }
}

const jeDatei = new Map<string, Record<Stufe, number>>();
const leer = (): Record<Stufe, number> => ({ SPERRE: 0, ORT: 0, "SPERRE-WIR": 0, EINMAL: 0, HINWEIS: 0 });
for (const d of geprueft) jeDatei.set(d, leer());
for (const t of treffer) { if (!jeDatei.has(t.datei)) jeDatei.set(t.datei, leer()); jeDatei.get(t.datei)![t.stufe]++; }
const summe = leer();
for (const z of jeDatei.values()) for (const st of STUFEN) summe[st] += z[st];
const breite = Math.max(40, ...[...jeDatei.keys()].map((d) => d.length));
const spalte = (n: number | string, b = 10): string => String(n).padStart(b);
console.log(`\n── Zählung je Datei und Stufe ${"─".repeat(70)}`);
console.log(`${"Datei".padEnd(breite)}${STUFEN.map((x) => spalte(x, 11)).join("")}`);
for (const [d, z] of [...jeDatei].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`${d.padEnd(breite)}${STUFEN.map((x) => spalte(z[x] || "·", 11)).join("")}`);
console.log(`${"SUMME".padEnd(breite)}${STUFEN.map((x) => spalte(summe[x], 11)).join("")}`);

if (notizen.length) { console.log("\nNicht gezählt:"); for (const n of notizen) console.log(`  · ${n}`); }
if (internZeilen.length) { console.log(`\nAls intern markiert (// wortwand: intern) — ${internZeilen.length} Zeilen, nicht geprüft:`); for (const z of internZeilen) console.log(`  · ${z}`); }
if (warnungen.length) { console.log("\nWarnungen:"); for (const x of warnungen) console.log(`  · ${x}`); }
const fehlerZahl = summe.SPERRE + summe.ORT;
console.log(`\n${geprueft.length} Dateien, ${einheiten.length} Texte geprüft in ${((Date.now() - start) / 1000).toFixed(1)} s — SPERRE ${summe.SPERRE} · ORT ${summe.ORT} · SPERRE-WIR ${summe["SPERRE-WIR"]} · EINMAL ${summe.EINMAL} · HINWEIS ${summe.HINWEIS}.`);
console.log(fehlerZahl ? `NICHT BESTANDEN: ${fehlerZahl} Treffer der Stufen SPERRE und ORT (ORT zählt wie SPERRE: an diesem Ort ist das Wort verboten).${ladeFehler ? ` Davon ${ladeFehler} Datei(en), die nicht laden.` : ""}` : "BESTANDEN: kein Treffer der Stufen SPERRE und ORT. SPERRE-WIR und HINWEIS liest ein Mensch.");
process.exit(fehlerZahl ? 1 : 0);
