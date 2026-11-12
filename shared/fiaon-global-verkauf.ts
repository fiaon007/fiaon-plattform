// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER VERKAUFSMOTOR: EIN PRODUKT, EIN KONFIGURATOR, SELBSTABSCHLUSS (Register E-509, 12.11.2026)
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
//   · jeden Satz, den Startseite und Konfigurator zeigen (deutsch und englisch).
//
// ── WAS HIER NICHT STEHT ───────────────────────────────────────────────────
// Kein Vertragstext (der bleibt in shared/fiaon-global-angebot-kapital-c.ts — bestehende Angebote lesen sich Zeichen für
// Zeichen wie bisher), keine Angabe zur Bürgin, kein Kurs des Tages (beides kommt aus der Server-Einstellung), kein Kundendatum.
//
// ── WORTGRENZEN ────────────────────────────────────────────────────────────
// Kein „bis zu“, nie „garantiert“ (nur „Geld-zurück-Garantie“ als Name der vertraglichen Garantie), kein Zinssatz als Zahl,
// kein Bankname, keine Frist mit Ziffer. Recht und Steuern leisten Partner-Anwälte und US-Steuerberater aus dem Partnernetz,
// nie FIAON selbst. Anträge bei Bank und Kartenherausgeber stellt der Kunde selbst. Über die Finanzierung entscheidet das
// finanzierende Institut. Die Wortwand (scripts/pruef-wortwand-de.ts, scripts/pruef-verkaufsmotor.ts) liest jeden Satz.
// ═══════════════════════════════════════════════════════════════════════════
import {
  kapitalCStaffelHonorarCents, kapitalCRahmenEuroCents, type KapitalCParameter,
} from "./fiaon-global-angebot-kapital-c";
import type { KapitalTeamEintrag } from "./fiaon-global-angebot-kapital";
import { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur, verkaufUsd, type VerkaufSprache } from "./fiaon-global-verkauf-preise";

// Preise, Kapitalrahmen und Zahlenbild stehen im Blatt ohne Importe (shared/fiaon-global-verkauf-preise.ts) — hier weitergereicht.
export { VERKAUF_PREISE, VERKAUF_RAHMEN, verkaufEur, verkaufUsd };
export type { VerkaufSprache };

export type VerkaufInteresse = "kapital" | "karten" | "konto" | "beratung";
export type VerkaufLand = "DE" | "AT" | "CH" | "ANDERES";
/** Wohin der Konfigurator führt: Selbstabschluss — oder ein persönlicher Weg mit seinem Grund. */
export type VerkaufWeg = "abschluss" | "miami" | "bestand" | "vorhaben" | "ohne_kapital";

export const VERKAUF_INTERESSEN: readonly VerkaufInteresse[] = ["kapital", "karten", "konto", "beratung"];
export const VERKAUF_LAENDER: readonly VerkaufLand[] = ["DE", "AT", "CH", "ANDERES"];

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
  /** Erfolgshonorar nach Staffel (E-505), fällig mit der Eintragung; schließt die Bürgschaft ein. */
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
//   vorhaben      Wohnsitz Österreich (laufendes Verfahren der Aufsicht: kein Selbstabschluss mit Bürgschaft) oder ein Land
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
  if (!interessen.length) return nein("interessen", "Bitte wählen Sie mindestens einen Schwerpunkt.", "Please choose at least one focus.");
  const usd = typeof roh?.usd === "number" ? roh.usd : Number.NaN;
  if (!verkaufStoppGueltig(usd)) return nein("usd", "Bitte wählen Sie Ihren Kapitalrahmen.", "Please choose your capital range.");
  const land = String(roh?.land ?? "").toUpperCase() as VerkaufLand;
  if (!VERKAUF_LAENDER.includes(land)) return nein("land", "Bitte wählen Sie Ihren Wohnsitz.", "Please choose your country of residence.");
  const anrede = ["Herr", "Frau"].includes(String(roh?.anrede)) ? (String(roh.anrede) as "Herr" | "Frau") : "";
  const vorname = sauber(roh?.vorname, 80); const nachname = sauber(roh?.nachname, 80);
  if (!NAME.test(vorname)) return nein("vorname", "Bitte tragen Sie Ihren Vornamen ein.", "Please enter your first name.");
  if (!NAME.test(nachname)) return nein("nachname", "Bitte tragen Sie Ihren Nachnamen ein.", "Please enter your surname.");
  const email = sauber(roh?.email, 160).toLowerCase();
  if (!MAIL.test(email)) return nein("email", "Bitte prüfen Sie Ihre E-Mail-Adresse.", "Please check your email address.");
  const telefon = sauber(roh?.telefon, 40);
  if (telefon.replace(/\D/g, "").length < 7 || !/^[+0-9 ()/.-]+$/.test(telefon)) return nein("telefon", "Bitte tragen Sie Ihre Telefonnummer ein.", "Please enter your phone number.");
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
// TEXTE — Startseite und Konfigurator (deutsch und englisch)
// ═══════════════════════════════════════════════════════════════════════════
export interface VerkaufBereich { nr: string; titel: string; zeile: string; details: string[] }
export interface VerkaufSchritt { nr: string; titel: string; text: string }
export interface VerkaufInteresseText { titel: string; zeile: string; preis: string }
export interface VerkaufWegText { titel: string; text: string; knopf: string; danke: string }
export interface VerkaufTexte {
  seo: { titel: string; beschreibung: string };
  buehne: { auge: string; label: string; h1a: string; h1b: string; wechsel: string[]; lead: string; knopf: string; knopfGespraech: string; mikro: string; kapitalTitel: string; kapitalSatz: string };
  produkt: { auge: string; name: string; kurz: string; h2a: string; h2b: string; lead: string; bereiche: VerkaufBereich[]; preisLabel: string; preisSatz: string; preisFein: string; knopf: string; mehr: string; weniger: string };
  ablauf: { auge: string; h2a: string; h2b: string; lead: string; schritte: VerkaufSchritt[] };
  konfig: {
    auge: string; h2a: string; h2b: string; lead: string;
    schritt1: string; schritt1Sub: string; schritt2: string; schritt2Sub: string; schritt3: string;
    interessen: Record<VerkaufInteresse, VerkaufInteresseText>;
    rahmenLabel: string; rahmenEuro: (eur: string) => string; rahmenMin: string; rahmenMax: string; rahmenHinweis: string; rahmenInstitut: string;
    blatt: { titel: string; heute: string; heuteText: string; eintragung: string; eintragungText: string; jahr1: string; jahr2: string; jahr2Text: string; fastTrack: (preis: string) => string; endpreise: string; garantie: string; kurs: (kurs: string, tag: string) => string };
    ohneKapitalBlatt: string;
    weiter: string; zurueck: string;
    form: { titel: string; sub: string; anrede: string; herr: string; frau: string; vorname: string; nachname: string; email: string; telefon: string; land: string; laender: Record<VerkaufLand, string>; bestand: string; bestandSub: string; nachricht: string; nachrichtPlatz: string; absenden: string; absendenWeg: string; laeuft: string; datenschutz: string; datenschutzLink: string; vertragssprache: string | null };
    wege: Record<Exclude<VerkaufWeg, "abschluss">, VerkaufWegText>;
    fertig: { titel: string; text: string; knopf: string };
    mailGesendet: { titel: string; text: string };
    fehler: { netz: string; zuViel: string; aus: string };
    buergin: { frage: string; aktiv: string; inaktiv: string };
  };
  garantie: { auge: string; h2: string; text: string; fein: string };
  karte: { auge: string; titel: string; zeile: string; punkte: string[]; preisLabel: string; knopf: string; fein: string };
  leiste: { zusammenstellen: (preis: string) => string; gespraech: string };
  /** Der Satz unter der Schaltzentrale: wer Recht und Steuern leistet und wer die Honorare trägt. */
  partnerSatz: string;
}

const DE: VerkaufTexte = {
  seo: {
    titel: "US-Gesellschaft gründen, aktiv betreut — FIAON Global",
    beschreibung: "Die Unternehmensberatung für Ihre US-Gesellschaft: Gründung, Steuernummern, US-Büro, Konto, Karten und Ihr Kapitalrahmen. Preis sofort sehen.",
  },
  buehne: {
    auge: "FIAON Global · Unternehmensberatung",
    label: "Ihre US-Gesellschaft mit aktiver Betreuung · im ersten Jahr ist alles enthalten",
    h1a: "Ihre US-Gesellschaft.",
    h1b: "Ihr Kapitalrahmen.",
    wechsel: ["Ihr Kapitalrahmen.", "Ihr US-Büro.", "Ihr Konto, Ihre Karten.", "Ihr Ansprechpartner."],
    lead: "Wir gründen Ihre Gesellschaft in den USA, führen ihr Büro und begleiten Sie bis zur Finanzierung — aus der Ferne, mit einem Ansprechpartner.",
    knopf: "Angebot zusammenstellen",
    knopfGespraech: "Erst sprechen",
    mikro: "Ihr Preis steht in einer Minute. Unterschreiben können Sie online.",
    kapitalTitel: "Ihr Kapitalrahmen",
    kapitalSatz: "Sie wählen ihn selbst. Über die Finanzierung entscheidet das finanzierende Institut.",
  },
  produkt: {
    auge: "Ein Mandat",
    name: "Ihre US-Gesellschaft — mit aktiver Betreuung",
    kurz: "US-Gesellschaft mit aktiver Betreuung",
    h2a: "Ein Mandat.",
    h2b: "Alles darin.",
    lead: "Keine Pakete, keine Stufen. Sie beauftragen uns einmal — wir übernehmen jeden Schritt, und Sie unterschreiben, was wir vorbereiten.",
    bereiche: [
      { nr: "I", titel: "Gründung", zeile: "Ihre Gesellschaft in Delaware, Florida oder Wyoming — angemeldet, eingetragen, dokumentiert.", details: [
        "Anmeldung beim Bundesstaat, Staatsgebühr enthalten",
        "Operating Agreement und Gründungsunterlagen",
        "Den Namen wählen Sie, wir prüfen das Register",
      ] },
      { nr: "II", titel: "Steuernummern", zeile: "Die EIN für Ihre Gesellschaft, die ITIN für Sie.", details: [
        "EIN: Antrag vorbereitet und eingereicht",
        "ITIN: beantragt, sobald unser ITIN-Check die Voraussetzungen bestätigt",
        "Über beide Nummern entscheidet die US-Steuerbehörde",
      ] },
      { nr: "III", titel: "Ihr US-Büro", zeile: "Adresse, Telefonnummer und Assistenz — vom ersten Tag an.", details: [
        "Registered Agent und US-Geschäftsadresse",
        "US-Telefonnummer",
        "Assistenz für Post, Anrufe und Termine",
      ] },
      { nr: "IV", titel: "Recht", zeile: "Rechtsberatung durch Anwälte aus unserem Partnernetz.", details: [
        "Operating Agreement Ihrer Gesellschaft",
        "Gründungsunterlagen, geordnet in Ihrem Portal",
        "Die Anwälte arbeiten im eigenen Mandat; ihr Honorar für diese Leistungen tragen wir",
      ] },
      { nr: "V", titel: "Steuern", zeile: "Steuerberatung durch US-Steuerberater (CPA) aus unserem Partnernetz.", details: [
        "Die erste jährliche US-Meldung Ihrer Gesellschaft",
        "Vorab geklärt, wie Überweisungen und Investitionen zu behandeln sind",
        "Eine US-Gesellschaft ist kein Steuermodell — Ihr Wohnsitzland bleibt maßgeblich",
      ] },
      { nr: "VI", titel: "Konto und Karten", zeile: "Privat und geschäftlich — jeder Antrag vollständig vorbereitet.", details: [
        "Privates US-Konto und private US-Kreditkarten",
        "Geschäftskonto und Firmenkreditkarte Ihrer Gesellschaft",
        "Sie stellen die Anträge selbst; über Konto, Karten und Rahmen entscheidet das jeweilige Institut",
      ] },
      { nr: "VII", titel: "Kapital", zeile: "Ihr Kapitalrahmen — mit der Bürgschaft unserer US-Partnergesellschaft.", details: [
        "Sie wählen Ihren Kapitalrahmen: 50.000 US-Dollar und mehr",
        "Wir bereiten jeden Antrag vor und begleiten bis zur Auszahlung",
        "Geld-zurück-Garantie: Kommt die Auszahlung nicht binnen acht Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben",
        "Über die Finanzierung entscheidet das finanzierende Institut",
      ] },
      { nr: "VIII", titel: "Ordnung", zeile: "Fristen, Meldungen, Pflichten — wir behalten sie im Blick.", details: [
        "Pflichtenkalender Ihrer Gesellschaft",
        "Die erste Jahresmeldung beim Bundesstaat, Staatsgebühr enthalten",
        "Ab dem zweiten Jahr auf Wunsch: Jahresbetreuung",
      ] },
    ],
    preisLabel: "Mit Ihrem Auftrag",
    preisSatz: "Gründung mit aktiver Betreuung im ersten Jahr. Endpreis.",
    preisFein: "Mit der Eintragung Ihrer Gesellschaft wird das Erfolgshonorar fällig; es richtet sich nach Ihrem Kapitalrahmen und schließt die Bürgschaft ein. Ab dem zweiten Jahr: Jahresbetreuung.",
    knopf: "Angebot zusammenstellen",
    mehr: "Einzelheiten",
    weniger: "Schließen",
  },
  ablauf: {
    auge: "So läuft es",
    h2a: "Vier Schritte.",
    h2b: "Kein Hexenwerk.",
    lead: "Sie bleiben, wo Sie sind. Wir erledigen die Wege in den USA.",
    schritte: [
      { nr: "1", titel: "Ihre Gesellschaft entsteht", text: "Sie wählen den Namen und unterschreiben online. Wir melden Ihre Gesellschaft an und beantragen ihre Steuernummer." },
      { nr: "2", titel: "Alles aus einer Hand", text: "Adresse, Telefonnummer, Assistenz, Verträge, Meldungen — von der ersten Nummer bis zum letzten Dokument." },
      { nr: "3", titel: "Konto, Karten, Kapital", text: "Wir bereiten jeden Antrag vor. Für die Finanzierung übernimmt unsere US-Partnergesellschaft die Bürgschaft." },
      { nr: "4", titel: "Weiter wachsen", text: "Ab dem achtzehnten Monat kann Ihre Gesellschaft eine Aufstockung beantragen oder umschulden. Wir begleiten sie dabei." },
    ],
  },
  konfig: {
    auge: "Ihr Angebot",
    h2a: "Stellen Sie es",
    h2b: "selbst zusammen.",
    lead: "Zwei Angaben, ein Preis. Danach unterschreiben Sie online — ohne Termin, ohne Wartezeit.",
    schritt1: "Was ist Ihnen wichtig?",
    schritt1Sub: "Mehrere Antworten sind möglich.",
    schritt2: "Ihr Kapitalrahmen",
    schritt2Sub: "Schieben Sie den Regler auf den Rahmen, den Ihre Gesellschaft aufnehmen soll.",
    schritt3: "Ihr Preis",
    interessen: {
      kapital: { titel: "Kapital", zeile: "Finanzierung für Ihre Gesellschaft, mit Bürgschaft.", preis: "Erfolgshonorar nach Rahmen" },
      karten: { titel: "Firmenkreditkarten", zeile: "Private und geschäftliche US-Karten, Anträge vorbereitet.", preis: "enthalten" },
      konto: { titel: "US-Konto", zeile: "Privates Konto und Geschäftskonto in den USA.", preis: "enthalten" },
      beratung: { titel: "Unternehmensberatung", zeile: "Strategie für Ihren Weg in die USA.", preis: "persönlich nach dem Start" },
    },
    rahmenLabel: "Kapitalrahmen",
    rahmenEuro: (eur) => `entspricht rund ${eur}`,
    rahmenMin: "50.000",
    rahmenMax: "1 Mio.",
    rahmenHinweis: "Ab 1 Mio. US-Dollar begleiten wir Sie persönlich in Miami.",
    rahmenInstitut: "Sie wählen den Rahmen. Über die Finanzierung entscheidet das finanzierende Institut.",
    blatt: {
      titel: "Ihre Honorarübersicht",
      heute: "Mit Ihrem Auftrag",
      heuteText: "Gründung mit aktiver Betreuung im ersten Jahr",
      eintragung: "Mit der Eintragung",
      eintragungText: "Erfolgshonorar, Bürgschaft enthalten",
      jahr1: "Im ersten Jahr insgesamt",
      jahr2: "Ab dem zweiten Jahr",
      jahr2Text: "Jahresbetreuung, je Jahr",
      fastTrack: (preis) => `Fast-Track auf Wunsch: ${preis}. Sie wählen ihn auf Ihrer Angebotsseite.`,
      endpreise: "Alle Beträge sind Endpreise.",
      garantie: "Geld-zurück-Garantie: Kommt die Auszahlung nicht binnen acht Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben.",
      kurs: (kurs, tag) => `Umgerechnet zum Referenzkurs der Europäischen Zentralbank vom ${tag} (1 € = ${kurs} US-$).`,
    },
    ohneKapitalBlatt: "Ohne Kapital entfällt das Erfolgshonorar. Ihr Angebot dazu erhalten Sie persönlich.",
    weiter: "Weiter zu Ihren Angaben",
    zurueck: "Zurück",
    form: {
      titel: "Wohin dürfen wir Ihr Angebot schicken?",
      sub: "Ihr Angebot öffnet sich sofort. Den Link erhalten Sie zusätzlich per E-Mail.",
      anrede: "Anrede", herr: "Herr", frau: "Frau",
      vorname: "Vorname", nachname: "Nachname", email: "E-Mail", telefon: "Telefon",
      land: "Wohnsitz",
      laender: { DE: "Deutschland", AT: "Österreich", CH: "Schweiz", ANDERES: "Anderes Land" },
      bestand: "Ich habe schon eine US-Gesellschaft",
      bestandSub: "Dann übernehmen wir sie, statt neu zu gründen.",
      nachricht: "Möchten Sie uns etwas mitgeben?",
      nachrichtPlatz: "Freiwillig",
      absenden: "Mein Angebot öffnen",
      absendenWeg: "Anfrage senden",
      laeuft: "Ihr Angebot entsteht …",
      datenschutz: "Wir verwenden Ihre Angaben, um Ihr Angebot zu erstellen und Sie dazu zu erreichen.",
      datenschutzLink: "Datenschutzerklärung",
      vertragssprache: null,
    },
    wege: {
      miami: {
        titel: "Persönlich in Miami",
        text: "Ab 1 Mio. US-Dollar treffen wir Sie in Miami. Senden Sie uns Ihre Anfrage — Justin Schwarzott meldet sich bei Ihnen und stimmt den Termin ab.",
        knopf: "Termin in Miami anfragen",
        danke: "Ihre Anfrage ist da. Justin Schwarzott meldet sich bei Ihnen und stimmt den Termin in Miami mit Ihnen ab.",
      },
      bestand: {
        titel: "Wir übernehmen Ihre Gesellschaft",
        text: "Wir gründen nicht neu. Wir prüfen zuerst die Unterlagen Ihrer Gesellschaft und sagen Ihnen, was in Ordnung zu bringen ist. Danach erhalten Sie Ihr Angebot.",
        knopf: "Prüfung anfragen",
        danke: "Ihre Anfrage ist da. Wir melden uns bei Ihnen und nennen Ihnen die Unterlagen, die wir für die Prüfung brauchen.",
      },
      vorhaben: {
        titel: "Ihr Vorhaben besprechen wir persönlich",
        text: "Für Ihren Wohnsitz stimmen wir den Weg in einem kurzen Gespräch mit Ihnen ab. Senden Sie uns Ihre Anfrage — wir melden uns bei Ihnen.",
        knopf: "Anfrage senden",
        danke: "Ihre Anfrage ist da. Wir melden uns bei Ihnen und besprechen Ihr Vorhaben persönlich.",
      },
      ohne_kapital: {
        titel: "Ihre Gesellschaft, ohne Kapital",
        text: "Sie möchten die Gesellschaft mit Betreuung, aber kein Kapital. Senden Sie uns Ihre Anfrage — Ihr Angebot dazu erhalten Sie persönlich.",
        knopf: "Anfrage senden",
        danke: "Ihre Anfrage ist da. Ihr Angebot ohne Kapital erhalten Sie persönlich von uns.",
      },
    },
    fertig: {
      titel: "Ihr Angebot ist fertig.",
      text: "Wir öffnen es jetzt für Sie. Den Link haben wir Ihnen auch per E-Mail geschickt.",
      knopf: "Angebot öffnen",
    },
    mailGesendet: {
      titel: "Bitte sehen Sie in Ihr Postfach.",
      text: "Zu dieser E-Mail-Adresse gibt es schon ein Angebot. Wir haben Ihnen den Link dorthin geschickt.",
    },
    fehler: {
      netz: "Das hat gerade nicht geklappt. Bitte versuchen Sie es noch einmal.",
      zuViel: "Von Ihrem Anschluss kamen gerade mehrere Versuche. Bitte versuchen Sie es in einigen Minuten noch einmal.",
      aus: "Ihr Angebot erstellen wir heute persönlich. Ihre Anfrage ist bei uns angekommen.",
    },
    buergin: {
      frage: "Wer übernimmt die Bürgschaft?",
      aktiv: "Unsere US-Partnergesellschaft, ein mit FIAON verbundenes Unternehmen. Die Einzelheiten stehen in Ziffer 5 Ihres Vertrags.",
      inaktiv: "Unsere US-Partnergesellschaft, ein mit FIAON verbundenes Unternehmen. Offen gesagt: Sie wird im Register ihres Bundesstaats derzeit als inaktiv geführt und bürgt erst, wenn sie dort wieder als aktiv geführt wird. Bürgt sie nicht rechtzeitig, greift Ihre Geld-zurück-Garantie.",
    },
  },
  garantie: {
    auge: "Ihre Sicherheit",
    h2: "Geld-zurück-Garantie.",
    text: "Kommt die Auszahlung Ihrer Finanzierung nicht binnen acht Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben.",
    fein: "Die Bedingungen stehen in Ziffer 4 Ihres Vertrags. Über die Finanzierung entscheidet das finanzierende Institut.",
  },
  karte: {
    auge: "Ein Mandat",
    titel: "Ihre US-Gesellschaft — mit aktiver Betreuung",
    zeile: "Gründung, Steuernummern, US-Büro, Recht und Steuern über Partner, Konto, Karten und Ihr Kapitalrahmen.",
    punkte: ["Im ersten Jahr ist alles enthalten", "Ihr Kapitalrahmen: 50.000 US-Dollar und mehr", "Online unterschreiben, aus der Ferne"],
    preisLabel: "Mit Ihrem Auftrag",
    knopf: "Angebot zusammenstellen",
    fein: "Endpreis. Erfolgshonorar mit der Eintragung, nach Ihrem Kapitalrahmen.",
  },
  leiste: { zusammenstellen: (preis) => `Angebot zusammenstellen · ${preis}`, gespraech: "Gespräch" },
  partnerSatz: "Steuerberater, US-Steuerberater (CPA) und Anwälte aus unserem Partnernetz arbeiten auf Ihr Mandat — ihre Honorare für die Leistungen Ihres Vertrags trägt FIAON.",
};

const EN: VerkaufTexte = {
  seo: {
    titel: "Form a US company, actively managed — FIAON Global",
    beschreibung: "The business consultancy for your US company: formation, tax numbers, US office, accounts, cards and your capital range. See your price now.",
  },
  buehne: {
    auge: "FIAON Global · business consultancy",
    label: "Your US company, actively managed · everything is included in the first year",
    h1a: "Your US company.",
    h1b: "Your capital range.",
    wechsel: ["Your capital range.", "Your US office.", "Your accounts and cards.", "Your one contact."],
    lead: "We form your company in the United States, run its office and stay with you through to financing — remotely, with one contact.",
    knopf: "Build your offer",
    knopfGespraech: "Talk first",
    mikro: "Your price is ready in a minute. You can sign online.",
    kapitalTitel: "Your capital range",
    kapitalSatz: "You choose it yourself. The financing institution decides on the financing.",
  },
  produkt: {
    auge: "One mandate",
    name: "Your US company — actively managed",
    kurz: "US company, actively managed",
    h2a: "One mandate.",
    h2b: "Everything in it.",
    lead: "No packages, no tiers. You instruct us once — we take every step, and you sign what we prepare.",
    bereiche: [
      { nr: "I", titel: "Formation", zeile: "Your company in Delaware, Florida or Wyoming — filed, registered, documented.", details: [
        "Filing with the state, state fee included",
        "Operating agreement and formation documents",
        "You choose the name, we check the register",
      ] },
      { nr: "II", titel: "Tax numbers", zeile: "The EIN for your company, the ITIN for you.", details: [
        "EIN: application prepared and filed",
        "ITIN: applied for once our ITIN check confirms the requirements",
        "The US tax authority decides on both numbers",
      ] },
      { nr: "III", titel: "Your US office", zeile: "Address, phone number and assistance — from day one.", details: [
        "Registered agent and US business address",
        "US phone number",
        "Assistance for post, calls and appointments",
      ] },
      { nr: "IV", titel: "Law", zeile: "Legal work by lawyers from our partner network.", details: [
        "The operating agreement of your company",
        "Formation documents, organised in your portal",
        "The lawyers act under their own mandate; we bear their fees for these services",
      ] },
      { nr: "V", titel: "Tax", zeile: "Tax work by US accountants (CPAs) from our partner network.", details: [
        "The first annual US filing of your company",
        "Clarified beforehand how transfers and investments are treated",
        "A US company is not a tax scheme — your country of residence remains decisive",
      ] },
      { nr: "VI", titel: "Accounts and cards", zeile: "Personal and business — every application fully prepared.", details: [
        "Personal US account and personal US credit cards",
        "Business account and company credit card for your company",
        "You file the applications yourself; each institution decides on accounts, cards and limits",
      ] },
      { nr: "VII", titel: "Capital", zeile: "Your capital range — with the surety of our US partner company.", details: [
        "You choose your capital range: US$50,000 and more",
        "We prepare every application and stay with you through to payout",
        "Money-back commitment: if the payout does not arrive within eight weeks, you receive back everything you have paid to us",
        "The financing institution decides on the financing",
      ] },
      { nr: "VIII", titel: "Order", zeile: "Deadlines, filings, duties — we keep them in view.", details: [
        "Compliance calendar for your company",
        "The first annual report to the state, state fee included",
        "From the second year, if you wish: annual care",
      ] },
    ],
    preisLabel: "With your order",
    preisSatz: "Formation with active management in the first year. Final price.",
    preisFein: "The success fee falls due when your company is registered; it follows your capital range and includes the surety. From the second year: annual care.",
    knopf: "Build your offer",
    mehr: "Details",
    weniger: "Close",
  },
  ablauf: {
    auge: "How it works",
    h2a: "Four steps.",
    h2b: "No magic.",
    lead: "You stay where you are. We take care of everything on the ground in the United States.",
    schritte: [
      { nr: "1", titel: "Your company is formed", text: "You choose the name and sign online. We file your company and apply for its tax number." },
      { nr: "2", titel: "Everything from one source", text: "Address, phone number, assistance, agreements, filings — from the first number to the last document." },
      { nr: "3", titel: "Accounts, cards, capital", text: "We prepare every application. For the financing, our US partner company provides the surety." },
      { nr: "4", titel: "Keep growing", text: "From the eighteenth month, your company can apply for an increase or refinance. We stay with it." },
    ],
  },
  konfig: {
    auge: "Your offer",
    h2a: "Put it together",
    h2b: "yourself.",
    lead: "Two choices, one price. Then you sign online — no appointment, no waiting.",
    schritt1: "What matters to you?",
    schritt1Sub: "You can choose more than one.",
    schritt2: "Your capital range",
    schritt2Sub: "Move the slider to the range your company is to take up.",
    schritt3: "Your price",
    interessen: {
      kapital: { titel: "Capital", zeile: "Financing for your company, with a surety.", preis: "success fee by range" },
      karten: { titel: "Company credit cards", zeile: "Personal and business US cards, applications prepared.", preis: "included" },
      konto: { titel: "US account", zeile: "Personal account and business account in the US.", preis: "included" },
      beratung: { titel: "Business consultancy", zeile: "Strategy for your route into the US.", preis: "in person after the start" },
    },
    rahmenLabel: "Capital range",
    rahmenEuro: (eur) => `roughly ${eur}`,
    rahmenMin: "50,000",
    rahmenMax: "1m",
    rahmenHinweis: "From US$1 million we work with you in person in Miami.",
    rahmenInstitut: "You choose the range. The financing institution decides on the financing.",
    blatt: {
      titel: "Your fee overview",
      heute: "With your order",
      heuteText: "Formation with active management in the first year",
      eintragung: "On registration",
      eintragungText: "Success fee, surety included",
      jahr1: "First year in total",
      jahr2: "From the second year",
      jahr2Text: "Annual care, per year",
      fastTrack: (preis) => `Fast track on request: ${preis}. You choose it on your offer page.`,
      endpreise: "All amounts are final prices.",
      garantie: "Money-back commitment: if the payout does not arrive within eight weeks, you receive back everything you have paid to us.",
      kurs: (kurs, tag) => `Converted at the European Central Bank reference rate of ${tag} (€1 = US$${kurs}).`,
    },
    ohneKapitalBlatt: "Without capital there is no success fee. You will receive your offer for this in person.",
    weiter: "Continue to your details",
    zurueck: "Back",
    form: {
      titel: "Where may we send your offer?",
      sub: "Your offer opens straight away. You will also receive the link by email.",
      anrede: "Title", herr: "Mr", frau: "Ms",
      vorname: "First name", nachname: "Surname", email: "Email", telefon: "Phone",
      land: "Country of residence",
      laender: { DE: "Germany", AT: "Austria", CH: "Switzerland", ANDERES: "Another country" },
      bestand: "I already have a US company",
      bestandSub: "Then we take it over instead of forming a new one.",
      nachricht: "Anything you would like us to know?",
      nachrichtPlatz: "Optional",
      absenden: "Open my offer",
      absendenWeg: "Send enquiry",
      laeuft: "Your offer is being prepared …",
      datenschutz: "We use your details to prepare your offer and to contact you about it.",
      datenschutzLink: "Privacy policy",
      vertragssprache: "Your agreement and your offer page are in German, the language of the contract. Your contact will take you through them in English.",
    },
    wege: {
      miami: {
        titel: "In person in Miami",
        text: "From US$1 million we meet you in Miami. Send us your enquiry — Justin Schwarzott will contact you and arrange the appointment.",
        knopf: "Request a Miami appointment",
        danke: "Your enquiry has arrived. Justin Schwarzott will contact you and arrange the appointment in Miami.",
      },
      bestand: {
        titel: "We take over your company",
        text: "We do not form a new one. We first review your company's documents and tell you what needs to be put in order. Then you receive your offer.",
        knopf: "Request the review",
        danke: "Your enquiry has arrived. We will contact you and name the documents we need for the review.",
      },
      vorhaben: {
        titel: "We discuss your plans in person",
        text: "For your country of residence we agree the route with you in a short conversation. Send us your enquiry — we will contact you.",
        knopf: "Send enquiry",
        danke: "Your enquiry has arrived. We will contact you and discuss your plans in person.",
      },
      ohne_kapital: {
        titel: "Your company, without capital",
        text: "You would like the company with active management, but no capital. Send us your enquiry — you will receive your offer for this in person.",
        knopf: "Send enquiry",
        danke: "Your enquiry has arrived. You will receive your offer without capital from us in person.",
      },
    },
    fertig: {
      titel: "Your offer is ready.",
      text: "We are opening it for you now. We have also sent you the link by email.",
      knopf: "Open offer",
    },
    mailGesendet: {
      titel: "Please check your inbox.",
      text: "There is already an offer for this email address. We have sent the link there.",
    },
    fehler: {
      netz: "That did not work just now. Please try again.",
      zuViel: "Several attempts have just come from your connection. Please try again in a few minutes.",
      aus: "Today we are preparing your offer in person. Your enquiry has reached us.",
    },
    buergin: {
      frage: "Who provides the surety?",
      aktiv: "Our US partner company, a company associated with FIAON. The details are in clause 5 of your agreement.",
      inaktiv: "Our US partner company, a company associated with FIAON. To be open: it is currently listed as inactive in the register of its state and will only act as surety once it is listed as active there again. If it does not do so in time, your money-back commitment applies.",
    },
  },
  garantie: {
    auge: "Your protection",
    h2: "Money-back commitment.",
    text: "If the payout of your financing does not arrive within eight weeks of your order, we refund everything you have paid to us.",
    fein: "The conditions are in clause 4 of your agreement. The financing institution decides on the financing.",
  },
  karte: {
    auge: "One mandate",
    titel: "Your US company — actively managed",
    zeile: "Formation, tax numbers, US office, law and tax through partners, accounts, cards and your capital range.",
    punkte: ["Everything is included in the first year", "Your capital range: US$50,000 and more", "Sign online, remotely"],
    preisLabel: "With your order",
    knopf: "Build your offer",
    fein: "Final price. Success fee on registration, according to your capital range.",
  },
  leiste: { zusammenstellen: (preis) => `Build your offer · ${preis}`, gespraech: "Call" },
  partnerSatz: "Tax advisers, US accountants (CPAs) and lawyers from our partner network act under your engagement — FIAON pays their fees for the services in your agreement.",
};

export const VERKAUF_TEXTE: Record<VerkaufSprache, VerkaufTexte> = { de: DE, en: EN };

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
    vorhaben: e.land === "AT" ? "Persönlicher Weg: Wohnsitz Österreich — kein Selbstabschluss mit Bürgschaft; Vorhaben persönlich besprechen." : "Persönlicher Weg: Wohnsitz außerhalb von Deutschland, Österreich und der Schweiz.",
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
