// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER VERKAUFSMOTOR: EIN PRODUKT, EIN HONORARRECHNER, SELBSTABSCHLUSS (Register E-509, 12.11.2026)
// Seit E-510 (13.11.2026) im Ton des Sprachleitfadens: Mandat, Klient, Honorar, Kapitalrahmen — die festen Sätze kommen aus
// shared/fiaon-global-saetze.ts. Im Code heißt das Werkzeug weiter „Konfigurator“, sichtbar „Honorarrechner“.
//
// Justin (12.11.2026): „wir sollten die Pakete weg — die US LLC Gründung mit aktiver Betreuung (volle Package, perfekt
// animiert anführen aber clean halten … Rechtsberatung rein, Steuerberatung — all das) und wenn er dann gründen will kann
// man auswählen für was man sich interessiert — Funding, Kreditkarte, Unternehmensberatung … und dann soll er seine Funding
// Summe auswählen — beginnend bei 50k $ endet bei 1 Mio. Ab 1 Mio sollte man persönlich in Miami sein, der Rest ist remote
// abwickelbar — und dann eben unsere Preise — einfach so gestalten dass der Kunde selbstständig abschließen kann ohne dass
// wir jedes mal ein Individual-Angebot … machen müssen.“
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Bis E-509 gab es vier Pakete (shared/fiaon-global.ts) und daneben das persönliche Kapital-Angebot (Fassung C), das je
// Kunde von Hand aus einer privaten Datei entstand. Jetzt gibt es EIN Produkt, und der Besucher stellt sein Angebot selbst
// zusammen. Diese Datei ist die EINE Stelle für:
//   · das Produkt (was drin ist — jeder Satz steht so im Vertrag der Fassung C, Ziffer 2 bis 6),
//   · die Preise (Gründung, Fast-Track, Jahresbetreuung hier; das Erfolgshonorar NUR über kapitalCStaffelHonorarCents),
//   · den Kapitalrahmen des Reglers (50.000 bis 1.000.000 US-Dollar) und seine Rasterpunkte,
//   · die Weiche (verkaufWeg): Selbstabschluss oder persönlicher Weg,
//   · die Prüfung der Eingabe (rein — Server und Prüfstand lesen dieselbe Funktion),
//   · die Parameter, mit denen der Server das Angebot über den bestehenden Vertragsmotor anlegt,
//   · jeden eigenen Satz, den Startseite und Honorarrechner zeigen (deutsch und englisch) — die festen Sätze holt sie aus
//     shared/fiaon-global-saetze.ts (S1 bis S17, sechs Schritte, Geld-zurück-Formen, Namen der Handlungen).
//
// ── WAS HIER NICHT STEHT ───────────────────────────────────────────────────
// Kein Vertragstext (der bleibt in shared/fiaon-global-angebot-kapital-c.ts — bestehende Angebote lesen sich Zeichen für
// Zeichen wie bisher), keine Angabe zur Bürgin, kein Kurs des Tages (beides kommt aus der Server-Einstellung), kein Kundendatum.
//
// ── LEITPLANKE: KEIN WORT ZUR BÜRGSCHAFT AUF ÖFFENTLICHEN SEITEN (Regel seit 30.10.2026, hier eingezogen am 12.11.2026) ──
// Die Bürgschaft der US-Partnergesellschaft wird öffentlich nicht beworben. Sie steht nur dort, wo sie Vertragsinhalt ist:
// im persönlichen Angebot hinter dem privaten Link (Vertrag der Fassung C mit allen Hinweisen, auch zum Registerstand).
// Deshalb nennt KEIN Satz in VERKAUF_TEXTE (Startseite, Konfigurator, Karte, Vertrag im Überblick, Kopf für Suchmaschinen)
// sie — auch nicht als „inklusive“ und nicht als Antwort auf eine Frage. Kapital heißt hier: Begleitung bis zur Finanzierung
// im gewählten Kapitalrahmen, mit Geld-zurück-Garantie. Wer mehr wissen will, liest sein Angebot: Es zeigt den vollständigen
// Vertrag vor der Unterschrift. Die Wand dazu steht in scripts/pruef-verkaufsmotor.ts (Abschnitt 10).
//
// ── WORTGRENZEN ────────────────────────────────────────────────────────────
// Kein „bis zu“, nie „garantiert“ (nur „Geld-zurück-Garantie“ als Name der vertraglichen Garantie), kein Zinssatz als Zahl,
// kein Bankname, keine Frist mit Ziffer, kein getippter Betrag (SAETZE_BETRAEGE), „mindestens“ statt „ab“. Recht und Steuern leisten Partner-Anwälte und US-Steuerberater aus dem Partnernetz,
// nie FIAON selbst. Anträge bei Bank und Kartenherausgeber stellt der Kunde selbst. Über die Finanzierung entscheidet das
// finanzierende Institut. Die Wortwände (scripts/pruef-global-leitfaden.ts, scripts/pruef-wortwand-de.ts,
// scripts/pruef-verkaufsmotor.ts) lesen jeden Satz.
// ═══════════════════════════════════════════════════════════════════════════
import {
  kapitalCStaffelHonorarCents, kapitalCRahmenEuroCents, type KapitalCParameter,
} from "./fiaon-global-angebot-kapital-c";
import type { KapitalTeamEintrag } from "./fiaon-global-angebot-kapital";
import { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur, verkaufUsd, type VerkaufSprache } from "./fiaon-global-verkauf-preise";
import { FIAON_FIRMA } from "./fiaon-firma";
// Die festen Sätze des Sprachleitfadens (E-510): eine Quelle für jede öffentliche Seite — hier nur geholt, nie getippt.
import { SAETZE_BETRAEGE, SCHRITTE_KOPF, GELD_ZURUECK, satz, weitererSatz, beleg, handlung, hauptHandlung, sechsSchritte, satzLand } from "./fiaon-global-saetze";

// Preise, Kapitalrahmen und Zahlenbild stehen im Blatt ohne Importe (shared/fiaon-global-verkauf-preise.ts) — hier weitergereicht.
export { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur, verkaufUsd };
export type { VerkaufSprache };

export type VerkaufInteresse = "kapital" | "karten" | "konto" | "beratung";
export type VerkaufLand = "DE" | "AT" | "CH" | "ANDERES";
/** Wohin der Konfigurator führt: Selbstabschluss — oder ein persönlicher Weg mit seinem Grund. */
export type VerkaufWeg = "abschluss" | "miami" | "bestand" | "vorhaben" | "ohne_kapital";

// Die vier Schlüssel der Schwerpunkte und die vier Länder: Kennungen, die so an den Server gehen — kein Seitentext. Sichtbar
// stehen die Titel aus konfig.interessen und konfig.form.laender. Deshalb als Kennungsliste weitergereicht (export { … }) und
// nicht als Text-Export angelegt: Die Wortwand liest Text-Exporte Wort für Wort und hielte den Schlüssel „beratung“ für das
// gesperrte Wort (ihre Zeilen-Marke greift erst ab zwölf Zeichen).
// wortwand: intern — Schlüssel der Schwerpunkte, kein sichtbarer Text
const VERKAUF_INTERESSEN: readonly VerkaufInteresse[] = ["kapital", "karten", "konto", "beratung"];
const VERKAUF_LAENDER: readonly VerkaufLand[] = ["DE", "AT", "CH", "ANDERES"];
export { VERKAUF_INTERESSEN, VERKAUF_LAENDER };

/** Rückfall-Kurs für die Anzeige, bis die Server-Einstellung geladen ist (EZB-Referenzkurs vom 06.11.2026). */
export const VERKAUF_KURS_VORGABE = { kursUsdJeEur: 1.1165, kursDatum: "2026-11-06" } as const;
/** So lange gilt ein selbst erstelltes Angebot (Justin 12.11.2026: sieben Tage ab Versand). */
export const VERKAUF_GUELTIG_TAGE = 7;
/** Bundesstaat des Selbstabschlusses (E-465: ohne Angabe Delaware). */
export const VERKAUF_BUNDESSTAAT = "Delaware";

/**
 * Die Rasterpunkte des Reglers: fein, wo die meisten wählen (50.000 bis 250.000 in Zehntausendern), darüber in
 * Fünfzigtausendern, am Ende die Million. Jeder Punkt liegt auf dem Raster des Vertragsmotors.
 */
export function verkaufStopps(): number[] {
  const aus: number[] = [];
  for (let u = VERKAUF_RAHMEN.minUsd; u <= 250_000; u += 10_000) aus.push(u);
  for (let u = 300_000; u <= VERKAUF_RAHMEN.selbstMaxUsd; u += 50_000) aus.push(u);
  aus.push(VERKAUF_RAHMEN.maxUsd);
  return aus;
}
export function verkaufStoppGueltig(usd: unknown): usd is number {
  return typeof usd === "number" && verkaufStopps().includes(usd);
}
/** Der nächste Rasterpunkt zu einem beliebigen Wert (für ?rahmen= und die alten ?paket=-Links). */
export function verkaufStoppNahe(usd: number): number {
  const s = verkaufStopps();
  return s.reduce((best, x) => (Math.abs(x - usd) < Math.abs(best - usd) ? x : best), s[0]);
}
/** Alte Paket-Links (?paket=global_…) landen beim passenden Start-Rahmen — kein Link führt ins Leere. */
export function verkaufUsdAusPaket(key: unknown): number | null {
  const m: Record<string, number> = { global_struktur: 50_000, global_banking: 100_000, global_kapital: 250_000, global_vip: 1_000_000 };
  return m[String(key ?? "").trim().toLowerCase()] ?? null;
}

export interface VerkaufPreis {
  rahmenUsd: number;
  /** Der Rahmen in Euro (Cent, volle zehn Euro) zum Kurs — so steht er im Vertrag. */
  rahmenEurCents: number;
  gruendungCents: number;
  fastTrackCents: number;
  /** Erfolgshonorar nach Staffel (E-505), fällig mit der Eintragung (was es einschließt, steht im Vertrag, Ziffer 6). */
  erfolgCents: number;
  jahresCents: number;
  /** Gesamtpreis des ersten Jahres ohne und mit Fast-Track. */
  erstesJahrCents: number;
  erstesJahrMitFastTrackCents: number;
}
/** Der Preis zu einem Kapitalrahmen — rechnet mit denselben Funktionen wie der Vertrag. */
export function verkaufPreis(usd: number, kursUsdJeEur: number = VERKAUF_KURS_VORGABE.kursUsdJeEur): VerkaufPreis {
  const erfolgCents = kapitalCStaffelHonorarCents(usd, kursUsdJeEur);
  return {
    rahmenUsd: usd,
    rahmenEurCents: kapitalCRahmenEuroCents(usd, kursUsdJeEur),
    gruendungCents: VERKAUF_PREISE.gruendungCents,
    fastTrackCents: VERKAUF_PREISE.fastTrackCents,
    erfolgCents,
    jahresCents: VERKAUF_PREISE.jahresCents,
    erstesJahrCents: VERKAUF_PREISE.gruendungCents + erfolgCents,
    erstesJahrMitFastTrackCents: VERKAUF_PREISE.gruendungCents + VERKAUF_PREISE.fastTrackCents + erfolgCents,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE WEICHE — Selbstabschluss oder persönlicher Weg (rein)
//   bestand       Der Kunde hat schon eine US-Gesellschaft (E-506): erst Unterlagen prüfen, den Preis legt Justin je Fall fest.
//   ohne_kapital  Kein Kapital gewählt: Der Vertrag der Fassung C enthält immer Kapital, Bürgschaft und Geld-zurück-Garantie —
//                 wer kein Kapital will, bekommt ihn nicht zur Unterschrift.
//   miami         Ab 1 Mio. US-Dollar persönlich in Miami.
//   vorhaben      Wohnsitz Österreich (persönlicher Weg, kein Selbstabschluss) oder ein Land
//                 außerhalb von Deutschland, Österreich und der Schweiz (der Vertrag kennt nur diese drei).
//   abschluss     Alles andere: Das Angebot entsteht sofort.
// ═══════════════════════════════════════════════════════════════════════════
export function verkaufWeg(e: { interessen: readonly VerkaufInteresse[]; usd: number; land: VerkaufLand; bestand: boolean }): VerkaufWeg {
  if (e.bestand) return "bestand";
  if (!e.interessen.includes("kapital")) return "ohne_kapital";
  if (e.usd >= VERKAUF_RAHMEN.maxUsd) return "miami";
  if (e.land === "AT" || e.land === "ANDERES") return "vorhaben";
  return "abschluss";
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE EINGABE DES KONFIGURATORS (rein — Server und Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
export interface VerkaufEingabe {
  sprache: VerkaufSprache;
  interessen: VerkaufInteresse[];
  usd: number;
  land: VerkaufLand;
  bestand: boolean;
  anrede: "Herr" | "Frau" | "";
  vorname: string;
  nachname: string;
  email: string;
  telefon: string;
  nachricht: string;
}
export type VerkaufFeld = "interessen" | "usd" | "land" | "anrede" | "vorname" | "nachname" | "email" | "telefon";
const sauber = (v: unknown, max: number) => String(v ?? "").normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
// Lateinische Buchstaben mit Akzenten (Vertrag und Register führen lateinische Schrift), Leerzeichen, Punkt, Apostroph, Bindestrich —
// ohne das Regex-Flag „u“ (das Ziel der Übersetzung kennt es nicht).
const BUCHSTABE = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF";
const NAME = new RegExp(`^[${BUCHSTABE}][${BUCHSTABE} .'’-]{0,78}$`);
const MAIL = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;

export function verkaufEingabeLesen(roh: any): { ok: true; eingabe: VerkaufEingabe } | { ok: false; feld: VerkaufFeld; error: string; errorEn: string } {
  const nein = (feld: VerkaufFeld, error: string, errorEn: string) => ({ ok: false as const, feld, error, errorEn });
  const sprache: VerkaufSprache = String(roh?.sprache ?? "").toLowerCase().startsWith("en") ? "en" : "de";
  const interessen = Array.from(new Set((Array.isArray(roh?.interessen) ? roh.interessen : []).map(String)))
    .filter((x): x is VerkaufInteresse => (VERKAUF_INTERESSEN as readonly string[]).includes(x as string));
  if (!interessen.length) return nein("interessen", "Bitte wählen Sie mindestens einen Schwerpunkt.", "Please choose at least one priority.");
  const usd = typeof roh?.usd === "number" ? roh.usd : Number.NaN;
  if (!verkaufStoppGueltig(usd)) return nein("usd", "Bitte wählen Sie Ihren Kapitalrahmen.", "Please choose your funding target.");
  const land = String(roh?.land ?? "").toUpperCase() as VerkaufLand;
  if (!VERKAUF_LAENDER.includes(land)) return nein("land", "Bitte wählen Sie Ihren Wohnsitz.", "Please choose your country of residence.");
  const anrede = ["Herr", "Frau"].includes(String(roh?.anrede)) ? (String(roh.anrede) as "Herr" | "Frau") : "";
  const vorname = sauber(roh?.vorname, 80); const nachname = sauber(roh?.nachname, 80);
  if (!NAME.test(vorname)) return nein("vorname", "Bitte tragen Sie Ihren Vornamen ein.", "Please enter your first name.");
  if (!NAME.test(nachname)) return nein("nachname", "Bitte tragen Sie Ihren Nachnamen ein.", "Please enter your surname.");
  const email = sauber(roh?.email, 160).toLowerCase();
  if (!MAIL.test(email)) return nein("email", "Bitte tragen Sie Ihre E-Mail-Adresse ein.", "Please enter your email address.");
  const telefon = sauber(roh?.telefon, 40);
  if (telefon.replace(/\D/g, "").length < 7 || !/^[+0-9 ()/.-]+$/.test(telefon)) return nein("telefon", "Bitte tragen Sie Ihre Telefonnummer ein.", "Please enter your telephone number.");
  return { ok: true, eingabe: { sprache, interessen, usd, land, bestand: roh?.bestand === true, anrede, vorname, nachname, email, telefon, nachricht: sauber(roh?.nachricht, 1200) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE PARAMETER DES SELBSTABSCHLUSSES — was der Server an kapitalCAnlegen gibt
// Dieselbe Gestalt wie die Angebote, die seit E-505 von Hand entstehen: der Kunde wählt Rahmen (Regler), Laufzeit, Namen und
// Fast-Track auf seiner Angebotsseite, trägt Geburtsdatum und Anschrift selbst ein und lädt den Reisepass nach der Unterschrift
// hoch. Die Unterschrift ist frei (kein Warten auf uns). ddAbgeschlossen = false: Der Vertrag behauptet keine abgeschlossene
// Prüfung. Zinsen, Laufzeiten, Garantie- und Zielwochen kommen aus KAPITAL_C_VORGABEN (wie bei jedem Angebot).
// ═══════════════════════════════════════════════════════════════════════════
export interface VerkaufEinstellung {
  /** Notschalter: false = der Konfigurator nimmt Anfragen an, erzeugt aber kein Angebot. */
  an: boolean;
  /**
   * Probebetrieb (Schlüssel „nurLeitung“, Vorgabe false): true = nur ein angemeldeter Chefbüro-Browser schließt selbst ab;
   * jeder andere Besucher schickt eine Anfrage, sein Angebot kommt persönlich — wie beim Notschalter.
   */
  nurLeitung: boolean;
  kursUsdJeEur: number;
  kursDatum: string;
  /** Registerstand der Bürgin (true = aktiv) und der Tag der letzten Prüfung (leer = der Satz steht ohne Datum). */
  buerginAktiv: boolean;
  buerginStandAm: string;
  team: KapitalTeamEintrag[];
  /** Höchstens so viele neue Angebote am Tag (Schutz vor Flut). */
  tagesGrenze: number;
  /** Deckel des Reglers im Selbstabschluss (US-Dollar) — Vorgabe selbstMaxUsd; eine kleinere Zahl schneidet den Regler ab. */
  selbstMaxUsd: number;
}
export function verkaufAngebotParameter(usd: number, e: Pick<VerkaufEinstellung, "kursUsdJeEur" | "kursDatum" | "buerginAktiv" | "buerginStandAm" | "team" | "selbstMaxUsd">): Partial<KapitalCParameter> {
  const maxUsd = Math.min(VERKAUF_RAHMEN.selbstMaxUsd, Math.max(VERKAUF_RAHMEN.minUsd + VERKAUF_RAHMEN.schrittUsd, e.selbstMaxUsd));
  return {
    gruendungCents: VERKAUF_PREISE.gruendungCents,
    fastTrackCents: VERKAUF_PREISE.fastTrackCents,
    jahresCents: VERKAUF_PREISE.jahresCents,
    zahlungszielTage: 0,
    kursUsdJeEur: e.kursUsdJeEur,
    kursDatum: e.kursDatum,
    bundesstaat: VERKAUF_BUNDESSTAAT,
    buerginAktiv: e.buerginAktiv,
    buerginStandAm: e.buerginStandAm,
    unterschriftFrei: true,
    ddAbgeschlossen: false,
    datenVomKunden: true,
    fastTrackWahl: true,
    ansprechpartner: ["justin"],
    team: e.team,
    unterlagen: [],
    rahmenWahl: { minUsd: VERKAUF_RAHMEN.minUsd, maxUsd, schrittUsd: VERKAUF_RAHMEN.schrittUsd, gewaehltUsd: Math.min(usd, maxUsd), staffel: "E-505" },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEXTE — Startseite und Honorarrechner (deutsch und englisch)
//
// Seit E-510 (13.11.2026) im Ton des Sprachleitfadens FIAON Global: jede Zusage mit ihrer Bedingung, jeder Schritt mit dem,
// der entscheidet. Die festen Sätze (S1 bis S17, die sechs Schritte, die Geld-zurück-Formen, die Namen der Handlungen)
// stehen NICHT hier, sondern in shared/fiaon-global-saetze.ts — diese Datei holt sie von dort. Jeder Betrag kommt aus
// der Preisquelle (SAETZE_BETRAEGE). Im Code heißt das Werkzeug weiter „Konfigurator“ (konfig), sichtbar „Honorarrechner“.
// ═══════════════════════════════════════════════════════════════════════════
export interface VerkaufBereich { nr: string; titel: string; zeile: string; details: string[] }
export interface VerkaufSchritt { nr: string; titel: string; text: string }
export interface VerkaufInteresseText { titel: string; zeile: string; preis: string }
export interface VerkaufWegText { titel: string; text: string; knopf: string; danke: string }
/** Eine Frage der 30-Sekunden-Probe mit ihrer festen Antwort (Leitfaden 1.3, Fassung A in der Zeile „heute“). */
export interface VerkaufBlickPunkt { frage: string; antwort: string }
/**
 * Die Karte „Ein Mandat“ der Unterseiten. mitBetrag = false: kein Honorar-Betrag (Österreich). zumGespraech = true: Der Knopf
 * führt zum Erstgespräch statt zum Honorarrechner (Österreich).
 */
export interface VerkaufKarteText { auge: string; titel: string; zeile: string; punkte: string[]; preisLabel: string; knopf: string; fein: string; mitBetrag: boolean; zumGespraech: boolean }
export interface VerkaufTexte {
  seo: { titel: string; beschreibung: string };
  /**
   * Die Bühne: label und honorarZeile stehen an der großen Zahl (kein Betrag im Blickfang ohne seinen Satz, Leitfaden 5.6);
   * kapitalSatz steht an der Spanne des Kapitalrahmens (S9 und der Miami-Satz).
   */
  buehne: { auge: string; label: string; honorarZeile: string; h1a: string; h1b: string; lead: string; knopf: string; knopfGespraech: string; mikro: string; kapitalTitel: string; kapitalSatz: string };
  /** Der Kasten „Auf einen Blick“ direkt unter der Bühne (und unter dem Honorarrechner): die vier Antworten der 30-Sekunden-Probe. */
  blick: { titel: string; punkte: VerkaufBlickPunkt[] };
  produkt: { auge: string; name: string; kurz: string; h2a: string; h2b: string; lead: string; bereiche: VerkaufBereich[]; preisLabel: string; preisSatz: string; preisFein: string; knopf: string; mehr: string; weniger: string };
  /**
   * Die sechs Schritte: Kopf und eine Zeile je Schritt (Satz und Bedingung in einem Text) — für Zeitstrahl, Vorab-Text und Prüfstand.
   * Die Seite selbst zeigt die Schritte mit allen vier Teilen aus shared/fiaon-global-saetze.ts (GlobalSchritte.tsx).
   */
  ablauf: { auge: string; h2a: string; h2b: string; lead: string; schritte: VerkaufSchritt[]; mehr: string };
  konfig: {
    auge: string; h2a: string; h2b: string;
    /** Die Einleitung in zwei Sätzen: leadA gilt immer, leadB nur, wenn sich das Angebot für diesen Besucher öffnet (sonst persoenlich.leadB). */
    leadA: string; leadB: string;
    schritt1: string; schritt1Sub: string; schritt2: string; schritt2Sub: string; schritt3: string;
    interessen: Record<VerkaufInteresse, VerkaufInteresseText>;
    rahmenLabel: string; rahmenEuro: (eur: string) => string; rahmenMin: string; rahmenMax: string; rahmenHinweis: string; rahmenInstitut: string;
    blatt: { titel: string; heute: string; heuteText: string; eintragung: string; eintragungText: string; jahr1: string; jahr2: string; jahr2Text: string; fastTrack: (preis: string) => string; endpreise: string; garantie: string; finanzierung: string; kurs: (kurs: string, tag: string) => string };
    ohneKapitalBlatt: string;
    weiter: string; zurueck: string;
    form: { titel: string; sub: string; anrede: string; herr: string; frau: string; vorname: string; nachname: string; email: string; telefon: string; land: string; laender: Record<VerkaufLand, string>; bestand: string; bestandSub: string; nachricht: string; nachrichtPlatz: string; absenden: string; absendenWeg: string; laeuft: string; register: string; datenschutz: string; datenschutzLink: string; vertragssprache: string | null; bundesstaat: string };
    wege: Record<Exclude<VerkaufWeg, "abschluss">, VerkaufWegText>;
    fertig: { titel: string; text: string; knopf: string };
    mailGesendet: { titel: string; text: string };
    fehler: { netz: string; zuViel: string; aus: string };
    /** Die eine aufklappbare Frage unter der Honorarübersicht — sie führt zum Angebot, das den vollständigen Vertrag zeigt. */
    angebotFrage: { frage: string; antwort: string };
    /**
     * Der persönliche Weg für alle (Notschalter, Probebetrieb, Tagesgrenze): dieselbe Fläche, aber kein Satz verspricht,
     * dass sich das Angebot öffnet. leadB ersetzt den zweiten Satz der Einleitung, sub/absenden/laeuft die des Formulars,
     * titel steht über dem Schlusstext (fehler.aus).
     */
    persoenlich: { leadB: string; sub: string; absenden: string; laeuft: string; titel: string };
  };
  /** „Wenn die Finanzierung ausbleibt“: der Name als Überschrift, die Kurz-Form mit Fristbeginn und Ziffer 4, die Mittel-Form in drei Zeilen, darunter S1. */
  garantie: { auge: string; h2: string; text: string; mittel: string[]; fein: string };
  /** „Was FIAON ist — und was nicht“: die Einordnung vor dem Erstgespräch. */
  rolle: { auge: string; h2: string; lead: string; punkte: { titel: string; text: string }[] };
  /** Die Karte „Ein Mandat“ der Unterseiten (Deutschland und alle Seiten ohne eigene Länder-Fassung). */
  karte: VerkaufKarteText;
  /** Dieselbe Karte für die beiden Länderseiten: Schweiz ohne Konto und Karten, Österreich nur Gründung und Unterlagen, ohne Betrag (Leitfaden 5.12). */
  karteLand: { CH: VerkaufKarteText; AT: VerkaufKarteText };
  /**
   * „Ihr Vertrag im Überblick“ (/business/mustervertrag): der AUFBAU des Vertrags in Stichpunkten — nie sein Wortlaut und nie als
   * „der Vertrag“ ausgegeben. Den vollständigen Vertrag zeigt das persönliche Angebot vor der Unterschrift. Die Ziffern folgen
   * dem Vertrag der Fassung C (scripts/pruef-verkaufsmotor.ts vergleicht Zahl und Titel); Ziffer 4 und 5 stehen als ein Punkt.
   */
  vertrag: {
    seo: { titel: string; beschreibung: string };
    /** Name der Seite in Fußzeile und Links. */
    linkName: string;
    auge: string; h1a: string; h1b: string; lead: string;
    aufbauTitel: string; zifferWort: string; anlageWort: string;
    punkte: { nr: string; titel: string; text: string }[];
    vollTitel: string; vollText: string;
    weiter: string; widerruf: string; widerrufLink: string;
  };
  /** Die Leiste am Handy. zusammenstellen nennt die Haupt-Handlung — ohne Betrag (der Parameter bleibt für ältere Aufrufer). */
  leiste: { zusammenstellen: (preis: string) => string; gespraech: string };
  /** Der Rollen-Satz: wer Recht und Steuern verantwortet und wer die Honorare trägt (Leitfaden 5.11). */
  partnerSatz: string;
}

/** „FIAON LTD“ und die Registernummer — aus den Firmendaten, nie getippt. */
const FIRMA = FIAON_FIRMA.name;
const REGISTER_NR = FIAON_FIRMA.companyNo;
/** Die Sätze eines Textes (getrennt an „Punkt Leerzeichen“) — um einen Teil eines festen Satzes zu zeigen, ohne ihn neu zu tippen. */
const saetzeVon = (text: string): string[] => text.split(/(?<=\.)\s+/);
/** Eine Überschrift aus zwei kurzen Teilen („Sechs Schritte. Jeder mit seiner Bedingung.“) in ihre zwei Hälften. */
const zweiTeile = (h2: string): [string, string] => { const t = saetzeVon(h2); return [t[0] ?? h2, t.slice(1).join(" ")]; };
/** Die sechs Schritte in einer Zeile je Schritt: Satz und Bedingung — nie das eine ohne das andere. */
const schrittZeilen = (s: VerkaufSprache): VerkaufSchritt[] => sechsSchritte(s).schritte.map((x) => ({ nr: String(x.nr), titel: x.titel, text: `${x.satz} ${x.bedingung}` }));
/** Der Satz zum Kapitalrahmen: S9 und der Miami-Satz — die Spanne steht nie ohne ihn (Leitfaden 5.8). */
const rahmenSatz = (s: VerkaufSprache): string => `${satz("S9", s)} ${weitererSatz("MIAMI", s)}`;
const B = SAETZE_BETRAEGE;

const DE: VerkaufTexte = {
  seo: {
    titel: "US-Gesellschaft (LLC) gründen mit Betreuung — FIAON Global",
    beschreibung: "Unternehmensberatung für Ihre US-Gesellschaft: LLC-Gründung, EIN und ITIN, US-Büro, vorbereitete Anträge. Ihr Honorar sehen Sie vorab und vollständig.",
  },
  buehne: {
    auge: `FIAON Global · Unternehmensberatung · ${FIRMA}, London`,
    label: "Mit Ihrem Auftrag · im ersten Jahr enthalten: acht Bereiche",
    honorarZeile: `Mit der Eintragung Ihrer Gesellschaft: Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.de.erfolgMin}.`,
    h1a: "US-Gesellschaft gründen.",
    h1b: "In einem Mandat.",
    lead: "Wir gründen Ihre Gesellschaft in den USA, holen jede Unterlage ein und bereiten mit Ihnen die Anträge für Konten und Finanzierung vor. Wir begleiten Ihre Gesellschaft bis zur Entscheidung — über Konto und Finanzierung entscheidet das jeweilige Institut.",
    knopf: handlung("angebot", "de"),
    knopfGespraech: handlung("gespraech", "de"),
    mikro: "Ihre Honorarübersicht sehen Sie vorab. Ihren vollständigen Vertrag lesen Sie, bevor Sie unterzeichnen.",
    kapitalTitel: "Ihr Kapitalrahmen",
    kapitalSatz: rahmenSatz("de"),
  },
  blick: {
    titel: "Auf einen Blick",
    punkte: [
      { frage: "Was geschieht?", antwort: "Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein und bereiten Ihre Anträge für Konten, auf Wunsch Kreditkarten und Finanzierung vor. Wir begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts." },
      { frage: "Was kostet es — und wann?", antwort: `${B.de.honorarAuftrag} mit Ihrem Auftrag. Mit der Eintragung Ihrer Gesellschaft das Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.de.erfolgMin}. Ab dem zweiten Jahr auf Wunsch die Jahresbetreuung für ${B.de.jahresbetreuung} im Jahr. Alle Beträge sind Endpreise und stehen in Ihrem Angebot, bevor Sie unterzeichnen.` },
      { frage: "Was tue ich selbst?", antwort: "Sie wählen den Namen, laden Ihren Reisepass hoch und unterzeichnen die Unterlagen, die wir vorlegen. Die Anträge bei Institut und Kartenherausgeber stellen Sie selbst." },
      { frage: "Was gilt, wenn etwas ausbleibt?", antwort: "Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut. Kommt die Auszahlung Ihrer Finanzierung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben. Die Bedingungen stehen in Ziffer 4 Ihres Vertrags. Für Konten und Karten gilt das nicht." },
    ],
  },
  produkt: {
    auge: "Ein Mandat",
    name: weitererSatz("PRODUKTNAME", "de"),
    kurz: "US-Gesellschaft mit aktiver Betreuung",
    h2a: "Ihre US-LLC:",
    h2b: "ein Mandat, acht Bereiche.",
    lead: "Ein Mandat, ein Vertrag, ein Ansprechpartner. Wir legen Ihnen jede Unterlage unterschriftsreif vor.",
    bereiche: [
      { nr: "I", titel: "Gründung", zeile: "Ihre Gesellschaft (LLC) in Delaware, Florida oder Wyoming: angemeldet und dokumentiert. Über die Eintragung entscheidet der Bundesstaat.", details: [
        "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
        "Den Namen wählen Sie; wir sehen im Register nach, ob er frei ist",
        beleg("eigentum", "de"),
      ] },
      { nr: "II", titel: "Steuernummern", zeile: "Wir beantragen die EIN Ihrer Gesellschaft und, nach unserem ITIN-Check, Ihre ITIN. Es entscheidet die US-Steuerbehörde.", details: [
        "EIN: Antrag vorbereitet und eingereicht",
        weitererSatz("UEBERGANG-ITIN", "de"),
        "Die ITIN beantragen wir nur, wenn die Voraussetzungen vorliegen",
      ] },
      { nr: "III", titel: "Ihr US-Büro", zeile: "Registered Agent, Geschäftsadresse und Telefonnummer in den USA. Im ersten Jahr enthalten.", details: [
        "Registered Agent und US-Geschäftsadresse",
        "US-Telefonnummer",
        weitererSatz("UEBERGANG-ASSISTENZ", "de"),
      ] },
      { nr: "IV", titel: "Recht", zeile: "Operating Agreement und Gründungsunterlagen Ihrer Gesellschaft. Rechtsfragen liegen bei Partner-Anwälten, die in eigener Verantwortung arbeiten.", details: [
        "Operating Agreement Ihrer Gesellschaft",
        "Gründungsunterlagen, geordnet in Ihrem Portal",
        weitererSatz("ROLLEN", "de"),
      ] },
      { nr: "V", titel: "Steuern", zeile: "Die erste jährliche US-Meldung Ihrer Gesellschaft. Steuerfragen liegen bei US-Steuerberatern (CPA) aus unserem Partnernetz, die in eigener Verantwortung arbeiten.", details: [
        "Die erste jährliche US-Meldung ist im ersten Jahr enthalten",
        satz("S10", "de"),
      ] },
      { nr: "VI", titel: "Konten und Karten", zeile: "Wir bereiten vor, Sie stellen den Antrag, das Institut entscheidet. Kreditkarten auf Wunsch, ohne zusätzliches Honorar von FIAON.", details: [
        "Privates US-Konto und Geschäftskonto: jeder Antrag vollständig vorbereitet",
        satz("S11", "de"),
        beleg("keinZugriff", "de"),
      ] },
      { nr: "VII", titel: "Finanzierung", zeile: "Wir bereiten jeden Antrag vor und begleiten Ihre Gesellschaft bis zur Entscheidung. Es entscheidet das finanzierende Institut.", details: [
        `Ihr Kapitalrahmen: ${B.de.rahmen}. ${rahmenSatz("de")}`,
        GELD_ZURUECK.de.kurzMitNamen,
        satz("S6", "de"),
      ] },
      { nr: "VIII", titel: "Pflichten und Fristen", zeile: "Pflichtenkalender und erste Jahresmeldung beim Bundesstaat. Ab dem zweiten Jahr auf Wunsch: Jahresbetreuung.", details: [
        "Pflichtenkalender Ihrer Gesellschaft",
        "Die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
        `Jahresbetreuung ab dem zweiten Jahr: ${B.de.jahresbetreuung} im Jahr; sie verlängert sich nicht von selbst`,
      ] },
    ],
    preisLabel: "Mit Ihrem Auftrag",
    preisSatz: "Gründung mit aktiver Betreuung im ersten Jahr. Endpreis.",
    preisFein: `Mit der Eintragung Ihrer Gesellschaft wird das Erfolgshonorar fällig; es richtet sich nach Ihrem Kapitalrahmen und beträgt mindestens ${B.de.erfolgMin}. Ab dem zweiten Jahr auf Wunsch: Jahresbetreuung für ${B.de.jahresbetreuung} im Jahr. Alle Beträge sind Endpreise.`,
    knopf: handlung("angebot", "de"),
    mehr: "Einzelheiten",
    weniger: "Schließen",
  },
  ablauf: {
    auge: SCHRITTE_KOPF.de.auge,
    h2a: zweiTeile(SCHRITTE_KOPF.de.h2)[0],
    h2b: zweiTeile(SCHRITTE_KOPF.de.h2)[1],
    lead: SCHRITTE_KOPF.de.lead,
    schritte: schrittZeilen("de"),
    mehr: "Ihr Teil und Ihr Ergebnis",
  },
  konfig: {
    auge: "Ihr Angebot",
    h2a: "Ihr Angebot",
    h2b: "für die US-Gesellschaft.",
    leadA: "Sie wählen Ihre Schwerpunkte und Ihren Kapitalrahmen. Der Honorarrechner zeigt Ihr Honorar vollständig: mit Ihrem Auftrag, mit der Eintragung und ab dem zweiten Jahr.",
    leadB: "Danach öffnet sich Ihr persönliches Angebot; unterzeichnen können Sie online.",
    schritt1: "Ihre Schwerpunkte",
    schritt1Sub: "Mehrere sind möglich.",
    schritt2: "Ihr Kapitalrahmen",
    schritt2Sub: "Stellen Sie den Regler auf Ihren Kapitalrahmen.",
    schritt3: "Ihre Honorarübersicht",
    interessen: {
      kapital: { titel: "Finanzierung", zeile: "Begleitung bis zur Entscheidung des finanzierenden Instituts.", preis: "Erfolgshonorar nach Kapitalrahmen" },
      karten: { titel: "Kreditkarten", zeile: "Privat und für Ihre Gesellschaft, Anträge vorbereitet.", preis: "ohne zusätzliches Honorar" },
      konto: { titel: "US-Konten", zeile: "Privat und für Ihre Gesellschaft, Anträge vorbereitet.", preis: "enthalten" },
      beratung: { titel: "Unternehmensberatung", zeile: "Strategie für Ihren Markteintritt in den USA.", preis: "persönlich nach dem Start" },
    },
    rahmenLabel: "Kapitalrahmen",
    rahmenEuro: (eur) => `entspricht rund ${eur}`,
    rahmenMin: VERKAUF_RAHMEN.minUsd.toLocaleString("de-DE"),
    rahmenMax: "1 Mio.",
    rahmenHinweis: weitererSatz("MIAMI", "de"),
    rahmenInstitut: `${satz("S9", "de")} ${satz("S1", "de")}`,
    blatt: {
      titel: "Ihre Honorarübersicht",
      heute: "Mit Ihrem Auftrag",
      heuteText: "Gründung mit aktiver Betreuung im ersten Jahr",
      eintragung: "Mit der Eintragung",
      eintragungText: "Erfolgshonorar nach Ihrem Kapitalrahmen",
      jahr1: "Im ersten Jahr insgesamt",
      jahr2: "Ab dem zweiten Jahr, auf Wunsch",
      jahr2Text: "Jahresbetreuung, je Jahr",
      fastTrack: (preis) => `Fast-Track auf Wunsch: ${preis} für Vorrang in allen Schritten. Sie wählen ihn in Ihrem Angebot.`,
      endpreise: weitererSatz("HONORAR-SCHLUSS", "de"),
      garantie: GELD_ZURUECK.de.kurzMitNamen,
      finanzierung: satz("S5-C", "de"),
      kurs: (kurs, tag) => `Umgerechnet zum Referenzkurs der Europäischen Zentralbank vom ${tag} (1 € = ${kurs} US-$).`,
    },
    ohneKapitalBlatt: "Ohne Kapitalrahmen fällt kein Erfolgshonorar an. Ihr Angebot erhalten Sie persönlich.",
    weiter: handlung("angebot", "de"),
    zurueck: "Zurück",
    form: {
      titel: "Ihre Angaben",
      sub: "Ihr persönliches Angebot öffnet sich nach dem Absenden. Den Link erhalten Sie zusätzlich per E-Mail.",
      anrede: "Anrede", herr: "Herr", frau: "Frau",
      vorname: "Vorname", nachname: "Nachname", email: "E-Mail", telefon: "Telefon",
      land: "Wohnsitz",
      laender: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", ANDERES: "Anderes Land" },
      bestand: "Ich habe bereits eine US-Gesellschaft",
      bestandSub: weitererSatz("UNTERLAGEN-ZUERST", "de"),
      nachricht: "Ihre Nachricht an uns",
      nachrichtPlatz: "Freiwillig",
      absenden: handlung("angebot", "de"),
      absendenWeg: "Anfrage senden",
      laeuft: "Ihr Angebot wird erstellt …",
      register: `Vertragspartner: ${FIRMA}, London · Companies House Nr. ${REGISTER_NR}. Ihren vollständigen Vertrag lesen Sie, bevor Sie unterzeichnen.`,
      datenschutz: `Wir verwenden Ihre Angaben, um Ihr Angebot zu erstellen und Sie dazu zu erreichen. ${beleg("daten", "de")}`,
      datenschutzLink: "Datenschutzerklärung",
      vertragssprache: null,
      // In welchem Bundesstaat der Honorarrechner gründet — nur im Selbstabschluss gezeigt.
      bundesstaat: `Über den Honorarrechner gründen wir in ${VERKAUF_BUNDESSTAAT}. Florida oder Wyoming stimmen wir im Gespräch mit Ihnen ab.`,
    },
    wege: {
      miami: {
        titel: "Persönlich in Miami",
        text: `${weitererSatz("MIAMI", "de")} Senden Sie uns Ihre Anfrage; Justin Schwarzott stimmt den Termin mit Ihnen ab.`,
        knopf: "Termin anfragen",
        danke: "Wir haben Ihre Anfrage erhalten. Justin Schwarzott stimmt den Termin in Miami mit Ihnen ab.",
      },
      bestand: {
        titel: "Bestehende US-Gesellschaft",
        text: `Wir gründen nicht neu. ${weitererSatz("UNTERLAGEN-ZUERST", "de")}`,
        knopf: "Unterlagen prüfen lassen",
        danke: "Wir haben Ihre Anfrage erhalten. Wir nennen Ihnen die Unterlagen, die wir von Ihnen benötigen.",
      },
      vorhaben: {
        titel: "Ihr Vorhaben besprechen wir persönlich",
        text: "Für Ihren Wohnsitz besprechen wir Ihr Vorhaben persönlich. Senden Sie uns Ihre Anfrage; wir melden uns bei Ihnen.",
        knopf: "Anfrage senden",
        danke: "Wir haben Ihre Anfrage erhalten. Wir melden uns bei Ihnen und besprechen Ihr Vorhaben persönlich.",
      },
      ohne_kapital: {
        titel: "Ihre Gesellschaft, ohne Finanzierung",
        text: "Sie wünschen die Gesellschaft mit aktiver Betreuung, ohne Finanzierung. Senden Sie uns Ihre Anfrage; Ihr Angebot dazu erhalten Sie persönlich.",
        knopf: "Anfrage senden",
        danke: "Wir haben Ihre Anfrage erhalten. Ihr Angebot ohne Finanzierung erhalten Sie persönlich von uns.",
      },
    },
    fertig: {
      titel: "Ihr Angebot ist erstellt.",
      text: "Es öffnet sich jetzt. Den Link haben wir Ihnen zusätzlich per E-Mail gesendet.",
      knopf: "Angebot öffnen",
    },
    mailGesendet: {
      titel: "Bitte sehen Sie in Ihr Postfach.",
      text: "Zu dieser E-Mail-Adresse besteht bereits ein Angebot. Wir haben Ihnen den Link dorthin gesendet.",
    },
    fehler: {
      netz: "Die Übertragung ist nicht gelungen. Bitte senden Sie Ihre Angaben erneut.",
      zuViel: "Von Ihrem Anschluss kamen mehrere Versuche in kurzer Zeit. Bitte senden Sie Ihre Angaben in einigen Minuten erneut.",
      aus: "Vielen Dank. Ihr persönliches Angebot erhalten Sie von uns per E-Mail.",
    },
    angebotFrage: {
      frage: "Was steht in meinem Angebot?",
      antwort: "Ihr persönliches Angebot zeigt den vollständigen Vertrag: jede Leistung, Ihr Honorar, die Bedingungen der Finanzierung und die Geld-zurück-Garantie. Sie lesen ihn, bevor Sie unterzeichnen.",
    },
    persoenlich: {
      leadB: "Ihr persönliches Angebot erhalten Sie von uns per E-Mail; unterzeichnen können Sie online.",
      sub: "Ihr persönliches Angebot erhalten Sie von uns per E-Mail.",
      absenden: handlung("angebot", "de"),
      laeuft: "Ihre Anfrage wird gesendet …",
      titel: "Wir haben Ihre Anfrage erhalten.",
    },
  },
  garantie: {
    auge: GELD_ZURUECK.de.auge,
    h2: `${GELD_ZURUECK.de.name}.`,
    text: `${saetzeVon(satz("S7", "de"))[0]} Für Konten und Karten gilt das nicht.`,
    mittel: [...GELD_ZURUECK.de.mittel],
    fein: saetzeVon(satz("S7", "de"))[1],
  },
  rolle: {
    auge: "Klare Rollen",
    h2: "Was FIAON ist — und was nicht.",
    lead: weitererSatz("POSITIONIERUNG", "de"),
    punkte: [
      { titel: "Keine Bank", text: `${beleg("keinZugriff", "de")} Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut.` },
      { titel: "Kein Kreditvermittler", text: `${saetzeVon(satz("S8", "de"))[1]} ${satz("S9", "de")}` },
      { titel: "Kein Steuermodell", text: satz("S10", "de") },
      { titel: "Keine Kanzlei", text: weitererSatz("ROLLEN", "de") },
    ],
  },
  karte: {
    auge: "Ein Mandat",
    titel: weitererSatz("PRODUKTNAME", "de"),
    zeile: "Gründung, Steuernummern, US-Büro und vollständig vorbereitete Anträge für Konten, Kreditkarten auf Wunsch und Finanzierung.",
    punkte: [
      "Im ersten Jahr enthalten: acht Bereiche",
      `Ihr Kapitalrahmen: ${B.de.rahmen}. ${rahmenSatz("de")}`,
      "Über Konto, Karte und Finanzierung entscheidet das jeweilige Institut.",
    ],
    preisLabel: "Mit Ihrem Auftrag",
    knopf: handlung("angebot", "de"),
    fein: `Endpreis. Mit der Eintragung: Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.de.erfolgMin}. Ab dem zweiten Jahr auf Wunsch: Jahresbetreuung für ${B.de.jahresbetreuung} im Jahr.`,
    mitBetrag: true,
    zumGespraech: false,
  },
  karteLand: {
    CH: {
      auge: "Ein Mandat",
      titel: weitererSatz("PRODUKTNAME", "de"),
      zeile: "Gründung, Steuernummern, US-Büro und vollständig vorbereitete Anträge für die Finanzierung.",
      punkte: [
        "Im ersten Jahr enthalten: Gründung, Steuernummern, US-Büro, Pflichten und Fristen",
        `Ihr Kapitalrahmen: ${B.de.rahmen}. ${rahmenSatz("de")}`,
        satz("S1", "de"),
      ],
      preisLabel: "Mit Ihrem Auftrag",
      knopf: handlung("angebot", "de"),
      fein: `Endpreis. Mit der Eintragung: Erfolgshonorar nach Ihrem Kapitalrahmen, mindestens ${B.de.erfolgMin}. Ab dem zweiten Jahr auf Wunsch: Jahresbetreuung für ${B.de.jahresbetreuung} im Jahr.`,
      mitBetrag: true,
      zumGespraech: false,
    },
    AT: {
      auge: "Ein Mandat",
      titel: weitererSatz("PRODUKTNAME", "de"),
      zeile: "Wir gründen Ihre US-Gesellschaft, holen jede Unterlage ein und übernehmen im ersten Jahr Fristen und Meldungen.",
      punkte: [
        satz("S3", "de", "AT"),
        satz("S17", "de", "AT"),
      ],
      preisLabel: "Ihr Honorar",
      knopf: hauptHandlung("de", "AT"),
      fein: weitererSatz("HONORAR-AT", "de"),
      mitBetrag: false,
      zumGespraech: true,
    },
  },
  vertrag: {
    seo: {
      titel: "Ihr Vertrag im Überblick — FIAON Global",
      beschreibung: "Der Aufbau des Vertrags von FIAON Global in Stichpunkten. Den vollständigen Vertrag lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen.",
    },
    linkName: "Vertrag im Überblick",
    auge: "FIAON Global · Vertrag",
    h1a: "Ihr Vertrag,",
    h1b: "im Überblick.",
    lead: `Diese Seite zeigt, wie Ihr Vertrag aufgebaut ist — in Stichpunkten, nicht im Wortlaut. Den vollständigen Vertrag mit Ihren Zahlen lesen Sie in Ihrem persönlichen Angebot, bevor Sie unterzeichnen. Vertragspartner ist die ${FIRMA}, London.`,
    aufbauTitel: "Was Ihr Vertrag regelt",
    zifferWort: "Ziffer",
    anlageWort: "Anlage",
    punkte: [
      { nr: "1", titel: "Vertragsparteien und Gegenstand", text: "Wer den Vertrag schließt und was er umfasst. Ihre Gesellschaft gehört allein Ihnen; FIAON erwirbt keine Anteile." },
      { nr: "2", titel: "Die US-Gesellschaft", text: "Die Gründung Ihrer Gesellschaft: Anmeldung beim Bundesstaat mit Staatsgebühr, Operating Agreement, Ihr US-Büro im ersten Jahr, die Anträge für die EIN und, nach unserem ITIN-Check, für die ITIN, der Pflichtenkalender und die ersten Meldungen." },
      { nr: "3", titel: "Konto und Karten", text: "Privates US-Konto, private US-Kreditkarten, Geschäftskonto und Firmenkreditkarte: Wir bereiten jeden Antrag vollständig vor. Sie stellen ihn selbst; über Konto, Karten und Rahmen entscheidet das jeweilige Institut." },
      { nr: "4 und 5", titel: "Begleitung zur Finanzierung und Geld-zurück-Garantie", text: "Wir bereiten die Anträge für die Finanzierung in Ihrem Kapitalrahmen vor und begleiten Ihre Gesellschaft bis zur Entscheidung des finanzierenden Instituts. Der Vertrag nennt das Ziel der Begleitung, die Voraussetzungen der Geld-zurück-Garantie und alle weiteren Einzelheiten zur Finanzierung. Über die Finanzierung entscheidet das finanzierende Institut." },
      { nr: "6", titel: "Vergütung und Fälligkeit", text: "Das Honorar mit Ihrem Auftrag, das Erfolgshonorar mit der Eintragung Ihrer Gesellschaft und die Jahresbetreuung ab dem zweiten Jahr. Alle Beträge sind Endpreise." },
      { nr: "7", titel: "Mitwirkung des Auftraggebers", text: "Was wir von Ihnen benötigen: Ihren Reisepass, wahre und vollständige Angaben und Ihre Unterschrift unter die Unterlagen, die wir Ihnen vorlegen." },
      { nr: "8", titel: "Pflichthinweise", text: "Was Sie vor dem Mandat wissen müssen: Steuerpflicht im Wohnsitzland, jährliche Meldepflichten in den USA und die Entscheidung der Institute." },
      { nr: "9", titel: "Laufzeit und Ende", text: "Wann der Vertrag beginnt, wie lange die Begleitung läuft und wie er endet." },
      { nr: "10", titel: "Widerrufsrecht", text: "Ihr gesetzliches Widerrufsrecht als Verbraucher: vierzehn Tage. Belehrung und Muster-Formular stehen in der Anlage." },
      { nr: "11", titel: "Haftung", text: "Wofür FIAON haftet und wofür die Partner haften, die in eigener Verantwortung arbeiten." },
      { nr: "12", titel: "Vertraulichkeit und Datenschutz", text: "Wie wir mit Ihren Unterlagen und Ihren Daten umgehen." },
      { nr: "13", titel: "Befugnisse von FIAON", text: "Wozu Sie uns bevollmächtigen. Allein bei Ihnen bleiben: die Eröffnung von Konten, jede Verfügung über Geld und die Anträge auf Finanzierung." },
      { nr: "14", titel: "Schlussbestimmungen", text: "Vertragssprache Deutsch, deutsches Recht, Änderungen in Textform." },
      { nr: "A", titel: "Widerrufsbelehrung und Muster-Widerrufsformular", text: "Der gesetzliche Wortlaut, Ihrem Vertrag als Anlage beigefügt." },
    ],
    vollTitel: "Der vollständige Vertrag",
    vollText: "Ihr persönliches Angebot zeigt den Vertrag Wort für Wort: jede Ziffer, Ihr Honorar, die Bedingungen der Finanzierung und die Widerrufsbelehrung. Bitte lesen Sie ihn ganz, bevor Sie unterzeichnen — maßgeblich ist allein dieser Wortlaut.",
    weiter: "Fordern Sie Ihr Angebot an. Ihre Honorarübersicht sehen Sie unmittelbar. Ihren vollständigen Vertrag lesen Sie in Ihrem Angebot, bevor Sie unterzeichnen.",
    widerruf: "Die Widerrufsbelehrung können Sie bereits jetzt lesen:",
    widerrufLink: "Widerrufsbelehrung",
  },
  leiste: { zusammenstellen: () => handlung("angebot", "de"), gespraech: "Gespräch" },
  partnerSatz: weitererSatz("ROLLEN", "de"),
};

const EN: VerkaufTexte = {
  seo: {
    titel: "US LLC formation with ongoing administration — FIAON Global",
    beschreibung: "Business consultancy for your US company: LLC formation, EIN and ITIN, US office and prepared applications. Your fees are set out in full before you sign.",
  },
  buehne: {
    auge: `FIAON Global · Business consultancy · ${FIRMA}, London`,
    label: "On engagement · included in the first year: eight areas",
    honorarZeile: `On registration of your company: success fee set by your funding target, at least ${B.en.erfolgMin}.`,
    h1a: "Form your US company.",
    h1b: "Under one engagement.",
    lead: "We form your company in the United States, assemble every document and prepare the applications for accounts and financing with you. We support your company through to the decision; decisions on accounts and financing rest with the institution concerned.",
    knopf: handlung("angebot", "en"),
    knopfGespraech: handlung("gespraech", "en"),
    mikro: "Your schedule of fees is shown in advance. You read your complete agreement before you sign.",
    kapitalTitel: "Your funding target",
    kapitalSatz: rahmenSatz("en"),
  },
  blick: {
    titel: "At a glance",
    punkte: [
      { frage: "What happens?", antwort: "We form your US company, assemble every document and prepare your applications for accounts, credit cards on request and financing. We support your company through to the lender’s decision." },
      { frage: "What does it cost — and when?", antwort: `${B.en.honorarAuftrag} on engagement. On registration of your company, the success fee set by your funding target — at least ${B.en.erfolgMin}. From the second year, on request, annual administration for ${B.en.jahresbetreuung} a year. All fees are stated in full in your proposal before you sign.` },
      { frage: "What do I do myself?", antwort: "You choose the name, upload your passport and sign the documents we present. You submit the applications to the institution and the card issuer yourself." },
      { frage: "What applies if something does not come about?", antwort: "Decisions on accounts, cards and financing rest with the institution concerned. If the financing has not been disbursed within eight weeks of your engagement, we refund everything you have paid to us. The conditions are set out in clause 4 of your agreement. This does not apply to accounts and cards." },
    ],
  },
  produkt: {
    auge: "One engagement",
    name: weitererSatz("PRODUKTNAME", "en"),
    kurz: "US company, formed and administered",
    h2a: "Your US LLC:",
    h2b: "one engagement, eight areas.",
    lead: "One engagement, one agreement, one dedicated contact. We present every document ready for your signature.",
    bereiche: [
      { nr: "I", titel: "Formation", zeile: "Your company (LLC) in Delaware, Florida or Wyoming: filed and documented. Registration is decided by the state.", details: [
        "Filing with the state, state fee included",
        "You choose the name; we check the register to see whether it is available",
        beleg("eigentum", "en"),
      ] },
      { nr: "II", titel: "Tax identification numbers", zeile: "We apply for your company’s EIN and, following our ITIN check, your ITIN. The US tax authority decides.", details: [
        "EIN: application prepared and filed",
        weitererSatz("UEBERGANG-ITIN", "en"),
        "We apply for the ITIN only where the requirements are met",
      ] },
      { nr: "III", titel: "Your US office", zeile: "Registered agent, business address and telephone number in the United States. Included in the first year.", details: [
        "Registered agent and US business address",
        "US telephone number",
        weitererSatz("UEBERGANG-ASSISTENZ", "en"),
      ] },
      { nr: "IV", titel: "Legal", zeile: "Operating agreement and formation documents for your company. Legal questions rest with partner lawyers acting in their own professional capacity.", details: [
        "The operating agreement of your company",
        "Formation documents, organised in your portal",
        weitererSatz("ROLLEN", "en"),
      ] },
      { nr: "V", titel: "Tax", zeile: "The first annual US filing for your company. Tax questions rest with US certified public accountants (CPAs) from our partner network, acting in their own professional capacity.", details: [
        "The first annual US filing is included in the first year",
        satz("S10", "en"),
      ] },
      { nr: "VI", titel: "Accounts and cards", zeile: "We prepare, you submit the application, the institution decides. Credit cards on request, at no additional fee from FIAON.", details: [
        "Personal US account and business account: every application prepared in full",
        satz("S11", "en"),
        beleg("keinZugriff", "en"),
      ] },
      { nr: "VII", titel: "Financing", zeile: "We prepare each application and support your company through to the decision. The lender decides.", details: [
        `Your funding target: ${B.en.rahmen}. ${rahmenSatz("en")}`,
        GELD_ZURUECK.en.kurzMitNamen,
        satz("S6", "en"),
      ] },
      { nr: "VIII", titel: "Compliance", zeile: "Compliance calendar and the first annual report to the state. From the second year, on request: annual administration.", details: [
        "Compliance calendar for your company",
        "The first annual report to the state, state fee included",
        `Annual administration from the second year: ${B.en.jahresbetreuung} a year; it does not renew automatically`,
      ] },
    ],
    preisLabel: "On engagement",
    preisSatz: "Formation and administration in the first year. Stated in full; nothing is added.",
    preisFein: `The success fee falls due on registration of your company; it is set by your funding target and is at least ${B.en.erfolgMin}. From the second year, on request: annual administration for ${B.en.jahresbetreuung} a year. All fees are stated in full; nothing is added.`,
    knopf: handlung("angebot", "en"),
    mehr: "Details",
    weniger: "Close",
  },
  ablauf: {
    auge: SCHRITTE_KOPF.en.auge,
    h2a: zweiTeile(SCHRITTE_KOPF.en.h2)[0],
    h2b: zweiTeile(SCHRITTE_KOPF.en.h2)[1],
    lead: SCHRITTE_KOPF.en.lead,
    schritte: schrittZeilen("en"),
    mehr: "Your part and your outcome",
  },
  konfig: {
    auge: "Your proposal",
    h2a: "Your proposal",
    h2b: "for a US company.",
    leadA: "Choose your priorities and your funding target. The fee calculator sets out your fees in full: on engagement, on registration and from the second year.",
    leadB: "Your personal proposal then opens; you may sign online.",
    schritt1: "Your priorities",
    schritt1Sub: "You may choose several.",
    schritt2: "Your funding target",
    schritt2Sub: "Set the slider to your funding target.",
    schritt3: "Your schedule of fees",
    interessen: {
      kapital: { titel: "Financing", zeile: "Support through to the lender’s decision.", preis: "success fee set by your funding target" },
      karten: { titel: "Credit cards", zeile: "Personal and business, applications prepared.", preis: "at no additional fee" },
      konto: { titel: "US accounts", zeile: "Personal and business, applications prepared.", preis: "included" },
      beratung: { titel: "Business consultancy", zeile: "Strategy for your entry into the US market.", preis: "in person after the start" },
    },
    rahmenLabel: "Funding target",
    rahmenEuro: (eur) => `roughly ${eur}`,
    rahmenMin: VERKAUF_RAHMEN.minUsd.toLocaleString("en-GB"),
    rahmenMax: "1m",
    rahmenHinweis: weitererSatz("MIAMI", "en"),
    rahmenInstitut: `${satz("S9", "en")} ${satz("S1", "en")}`,
    blatt: {
      titel: "Your schedule of fees",
      heute: "On engagement",
      heuteText: "Formation and administration in the first year",
      eintragung: "On registration",
      eintragungText: "Success fee, set by your funding target",
      jahr1: "First year in total",
      jahr2: "From the second year, on request",
      jahr2Text: "Annual administration, per year",
      fastTrack: (preis) => `Priority handling on request: ${preis} for priority at each step. You choose it in your proposal.`,
      endpreise: weitererSatz("HONORAR-SCHLUSS", "en"),
      garantie: GELD_ZURUECK.en.kurzMitNamen,
      finanzierung: satz("S5-C", "en"),
      kurs: (kurs, tag) => `Converted at the European Central Bank reference rate of ${tag} (€1 = US$${kurs}).`,
    },
    ohneKapitalBlatt: "Without a funding target, there is no success fee. You receive your proposal from us in person.",
    weiter: handlung("angebot", "en"),
    zurueck: "Back",
    form: {
      titel: "Your details",
      sub: "Your personal proposal opens once you have sent your details. You also receive the link by email.",
      anrede: "Title", herr: "Mr", frau: "Ms",
      vorname: "First name", nachname: "Surname", email: "Email", telefon: "Telephone",
      land: "Country of residence",
      laender: { DE: "Germany", AT: "Austria", CH: "Switzerland", ANDERES: "Another country" },
      bestand: "I already have a US company",
      bestandSub: weitererSatz("UNTERLAGEN-ZUERST", "en"),
      nachricht: "Your message to us",
      nachrichtPlatz: "Optional",
      absenden: handlung("angebot", "en"),
      absendenWeg: "Send enquiry",
      laeuft: "Your proposal is being prepared …",
      register: `Contracting party: ${FIRMA}, London · company number ${REGISTER_NR}. You read your complete agreement before you sign.`,
      datenschutz: `We use your details to draw up your proposal and to contact you about it. ${beleg("daten", "en")}`,
      datenschutzLink: "Privacy policy",
      vertragssprache: "Your agreement and your proposal page are in German, the language of the contract.",
      bundesstaat: `Via the fee calculator, we form in ${VERKAUF_BUNDESSTAAT}. We agree Florida or Wyoming with you in a call.`,
    },
    wege: {
      miami: {
        titel: "In person in Miami",
        text: `${weitererSatz("MIAMI", "en")} Send us your enquiry; Justin Schwarzott arranges the appointment with you.`,
        knopf: "Request an appointment",
        danke: "We have received your enquiry. Justin Schwarzott arranges the appointment in Miami with you.",
      },
      bestand: {
        titel: "Existing US company",
        text: `We do not form a new company. ${weitererSatz("UNTERLAGEN-ZUERST", "en")}`,
        knopf: "Request a document review",
        danke: "We have received your enquiry. We name the documents we need from you.",
      },
      vorhaben: {
        titel: "We discuss your plans in person",
        text: "For your country of residence, we discuss your plans with you in person. Send us your enquiry; we contact you.",
        knopf: "Send enquiry",
        danke: "We have received your enquiry. We contact you and discuss your plans with you in person.",
      },
      ohne_kapital: {
        titel: "Your company, without financing",
        text: "You would like the company with ongoing administration, without financing. Send us your enquiry; you receive your proposal for this from us in person.",
        knopf: "Send enquiry",
        danke: "We have received your enquiry. You receive your proposal without financing from us in person.",
      },
    },
    fertig: {
      titel: "Your proposal is ready.",
      text: "It opens now. We have also sent you the link by email.",
      knopf: "Open proposal",
    },
    mailGesendet: {
      titel: "Please check your inbox.",
      text: "A proposal already exists for this email address. We have sent the link there.",
    },
    fehler: {
      netz: "The transmission did not succeed. Please send your details again.",
      zuViel: "Several attempts have come from your connection in a short time. Please send your details again in a few minutes.",
      aus: "Thank you. You receive your personal proposal from us by email.",
    },
    angebotFrage: {
      frage: "What does my proposal contain?",
      antwort: "Your personal proposal shows the complete agreement: each service, your fees, the terms of the financing and the money-back commitment. You read it before you sign.",
    },
    persoenlich: {
      leadB: "You receive your personal proposal from us by email; you may sign online.",
      sub: "You receive your personal proposal from us by email.",
      absenden: handlung("angebot", "en"),
      laeuft: "Sending your enquiry …",
      titel: "We have received your enquiry.",
    },
  },
  garantie: {
    auge: GELD_ZURUECK.en.auge,
    h2: `${GELD_ZURUECK.en.name}.`,
    text: `${saetzeVon(satz("S7", "en"))[0]} This does not apply to accounts and cards.`,
    mittel: [...GELD_ZURUECK.en.mittel],
    fein: saetzeVon(satz("S7", "en"))[1],
  },
  rolle: {
    auge: "Clear roles",
    h2: "What FIAON is — and is not.",
    lead: weitererSatz("POSITIONIERUNG", "en"),
    punkte: [
      { titel: "Not a bank", text: `${beleg("keinZugriff", "en")} Decisions on accounts, cards and financing rest with the institution concerned.` },
      { titel: "Does not broker loans", text: `${saetzeVon(satz("S8", "en"))[1]} ${satz("S9", "en")}` },
      { titel: "Not a tax scheme", text: satz("S10", "en") },
      { titel: "Not a law firm", text: weitererSatz("ROLLEN", "en") },
    ],
  },
  karte: {
    auge: "One engagement",
    titel: weitererSatz("PRODUKTNAME", "en"),
    zeile: "Formation, tax identification numbers, US office and fully prepared applications for accounts, credit cards on request and financing.",
    punkte: [
      "Included in the first year: eight areas",
      `Your funding target: ${B.en.rahmen}. ${rahmenSatz("en")}`,
      "Decisions on accounts, cards and financing rest with the institution concerned.",
    ],
    preisLabel: "On engagement",
    knopf: handlung("angebot", "en"),
    fein: `Stated in full; nothing is added. On registration: success fee set by your funding target, at least ${B.en.erfolgMin}. From the second year, on request: annual administration for ${B.en.jahresbetreuung} a year.`,
    mitBetrag: true,
    zumGespraech: false,
  },
  karteLand: {
    CH: {
      auge: "One engagement",
      titel: weitererSatz("PRODUKTNAME", "en"),
      zeile: "Formation, tax identification numbers, US office and fully prepared applications for financing.",
      punkte: [
        "Included in the first year: formation, tax identification numbers, US office, compliance",
        `Your funding target: ${B.en.rahmen}. ${rahmenSatz("en")}`,
        satz("S1", "en"),
      ],
      preisLabel: "On engagement",
      knopf: handlung("angebot", "en"),
      fein: `Stated in full; nothing is added. On registration: success fee set by your funding target, at least ${B.en.erfolgMin}. From the second year, on request: annual administration for ${B.en.jahresbetreuung} a year.`,
      mitBetrag: true,
      zumGespraech: false,
    },
    AT: {
      auge: "One engagement",
      titel: weitererSatz("PRODUKTNAME", "en"),
      zeile: "We form your US company, assemble its documents in full and handle deadlines and filings in the first year.",
      punkte: [
        satz("S3", "en", "AT"),
        satz("S17", "en", "AT"),
      ],
      preisLabel: "Your fees",
      knopf: hauptHandlung("en", "AT"),
      fein: weitererSatz("HONORAR-AT", "en"),
      mitBetrag: false,
      zumGespraech: true,
    },
  },
  vertrag: {
    seo: {
      titel: "Your agreement at a glance — FIAON Global",
      beschreibung: "How the FIAON Global agreement is structured, point by point. You read the complete agreement in your personal proposal before you sign.",
    },
    linkName: "Agreement at a glance",
    auge: "FIAON Global · Agreement",
    h1a: "Your agreement,",
    h1b: "at a glance.",
    lead: `This page shows how your agreement is structured — point by point, not word for word. You read the complete agreement with your own figures in your personal proposal before you sign. The agreement is in German, the language of the contract. Your contracting party is ${FIRMA}, London.`,
    aufbauTitel: "What your agreement covers",
    zifferWort: "Clause",
    anlageWort: "Annex",
    punkte: [
      { nr: "1", titel: "Parties and subject matter", text: "Who enters into the agreement and what it covers. Your company belongs to you alone; FIAON acquires no interest in it." },
      { nr: "2", titel: "The US company", text: "The formation of your company: filing with the state including the state fee, operating agreement, your US office in the first year, the applications for the EIN and, following our ITIN check, the ITIN, the compliance calendar and the first filings." },
      { nr: "3", titel: "Accounts and cards", text: "Personal US account, personal US credit cards, business account and business credit card: we prepare every application in full. You submit it yourself; each institution decides on accounts, cards and limits." },
      { nr: "4 and 5", titel: "Support through to financing and money-back commitment", text: "We prepare the applications for financing within your funding target and support your company through to the lender’s decision. The agreement sets out the aim of that support, the conditions of the money-back commitment and every further detail of the financing. All financing decisions rest with the lender." },
      { nr: "6", titel: "Fees and due dates", text: "The fee on engagement, the success fee on registration of your company, and annual administration from the second year. All fees are stated in full; nothing is added." },
      { nr: "7", titel: "Your cooperation", text: "What we need from you: your passport, true and complete information, and your signature on the documents we present." },
      { nr: "8", titel: "Mandatory information", text: "What you need to know before you instruct us: tax liability in your country of residence, annual filing duties in the United States and the decisions of the institutions." },
      { nr: "9", titel: "Term and end", text: "When the agreement begins, how long our support runs and how it ends." },
      { nr: "10", titel: "Right of withdrawal", text: "Your statutory right of withdrawal as a consumer: fourteen days. The instructions and the model form are in the annex." },
      { nr: "11", titel: "Liability", text: "What FIAON is liable for, and what the partners, who act in their own professional capacity, are liable for." },
      { nr: "12", titel: "Confidentiality and data protection", text: "How we handle your documents and your data." },
      { nr: "13", titel: "Authority of FIAON", text: "What you authorise us to do. Reserved to you alone: opening accounts, any disposal of funds and applications for financing." },
      { nr: "14", titel: "Final provisions", text: "German as the language of the contract, German law, changes in text form." },
      { nr: "A", titel: "Withdrawal instructions and model withdrawal form", text: "The statutory wording, attached to your agreement as an annex." },
    ],
    vollTitel: "The complete agreement",
    vollText: "Your personal proposal shows the agreement word for word: every clause, your fees, the terms of the financing and the withdrawal instructions. Please read it in full before you sign — only that wording is binding.",
    weiter: "Request your proposal. Your schedule of fees is shown immediately. You read your complete agreement in your proposal before you sign.",
    widerruf: "You can read the withdrawal instructions now:",
    widerrufLink: "Withdrawal instructions",
  },
  leiste: { zusammenstellen: () => handlung("angebot", "en"), gespraech: "Call" },
  partnerSatz: weitererSatz("ROLLEN", "en"),
};

export const VERKAUF_TEXTE: Record<VerkaufSprache, VerkaufTexte> = { de: DE, en: EN };

/**
 * Die Karte „Ein Mandat“ für eine Seite: die allgemeine Fassung — oder die der Länderseite (Schweiz ohne Konto und Karten,
 * Österreich nur Gründung und Unterlagen, ohne Betrag, mit dem Knopf zum Erstgespräch). `pfad` ist die Adresse der Seite.
 */
export function verkaufKarte(sprache: VerkaufSprache, pfad: string = ""): VerkaufKarteText {
  const land = satzLand(pfad);
  const T = VERKAUF_TEXTE[sprache];
  return land === "AT" ? T.karteLand.AT : land === "CH" ? T.karteLand.CH : T.karte;
}

/** Der Pfad des Konfigurators als eigene Seite — die alte Auftragsadresse bleibt, damit jeder Link und jede Anzeige ankommt. */
export function verkaufPfad(s: VerkaufSprache = "de", q?: { rahmen?: number }): string {
  const basis = s === "en" ? "/en/business/start" : "/business/start";
  return q?.rahmen ? `${basis}?rahmen=${q.rahmen}` : basis;
}

/**
 * Was Justin zu einem neuen Selbst-Angebot oder einer Anfrage aus dem Konfigurator liest (Mail und Aufgabe) — reine Funktion,
 * damit der Prüfstand den Wortlaut sieht. Kein Kundentext.
 */
export function verkaufMeldungZeilen(e: VerkaufEingabe, weg: VerkaufWeg, kursUsdJeEur: number): string[] {
  const p = verkaufPreis(Math.min(e.usd, VERKAUF_RAHMEN.maxUsd), kursUsdJeEur);
  const wegText: Record<VerkaufWeg, string> = {
    abschluss: "Selbstabschluss — das Angebot ist angelegt, die Unterschrift ist frei.",
    miami: "Persönlicher Weg: ab 1 Mio. US-Dollar in Miami — bitte Termin abstimmen.",
    bestand: "Persönlicher Weg: bestehende US-Gesellschaft — Unterlagen anfordern, prüfen, dann Angebot „übernehmen statt neu gründen“ (E-506).",
    vorhaben: e.land === "AT" ? "Persönlicher Weg: Wohnsitz Österreich — kein Selbstabschluss; Vorhaben persönlich besprechen." : "Persönlicher Weg: Wohnsitz außerhalb von Deutschland, Österreich und der Schweiz.",
    ohne_kapital: "Persönlicher Weg: ohne Kapital — Angebot nur Gesellschaft mit Betreuung.",
  };
  const namen: Record<VerkaufInteresse, string> = { kapital: "Kapital", karten: "Firmenkreditkarten", konto: "US-Konto", beratung: "Unternehmensberatung" };
  return [
    wegText[weg],
    `Schwerpunkte: ${e.interessen.map((i) => namen[i]).join(", ")}.`,
    e.interessen.includes("kapital") ? `Kapitalrahmen: ${verkaufUsd(e.usd)} — Erfolgshonorar nach Staffel ${verkaufEur(p.erfolgCents)}, erstes Jahr ${verkaufEur(p.erstesJahrCents)} (mit Fast-Track ${verkaufEur(p.erstesJahrMitFastTrackCents)}).` : "Kapitalrahmen: nicht gewählt.",
    `Wohnsitz: ${DE.konfig.form.laender[e.land]}${e.bestand ? " · hat schon eine US-Gesellschaft" : ""} · Sprache: ${e.sprache === "en" ? "Englisch" : "Deutsch"}.`,
    `Kontakt: ${e.anrede ? `${e.anrede} ` : ""}${e.vorname} ${e.nachname} · ${e.email} · ${e.telefon}.`,
    ...(e.nachricht ? [`Nachricht: ${e.nachricht}`] : []),
  ];
}
