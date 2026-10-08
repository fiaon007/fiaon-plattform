// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS FIRMENANGEBOT (B2B): DIE TEXTE, ZAHLEN UND RECHENREGELN AN EINER STELLE
// Register E-301 (07.10.2026) — Ausbau des Individualangebots E-268 für Unternehmen.
//
// ── EIN WORTLAUT, ZWEI AUSGABEN ───────────────────────────────────────────
// Bildschirm (/business/angebot/:token, Seite business-angebot-firma.tsx) und PDF entstehen aus
// DEN FUNKTIONEN HIER. Der Server (server/lib/fiaon-global-angebot-firma.ts) rechnet nur die
// Prüfsumme (docHash) über firmaRumpfHtml und druckt das PDF — er schreibt keinen eigenen Satz.
// Die Schnittstelle Server ↔ Seite steht in shared/fiaon-global-angebot-firma-typen.ts.
//
// ── DAS MODELL (Justin, 07.10.2026 abends) ────────────────────────────────
//   Gründungskosten einmalig bei Auftrag · gemeinsames Wachstumsbudget (Runde 2, Justin 08.10.2026): die
//   Kundin trägt die Hälfte eines Monatsbudgets, FIAON die andere — monatlich im Voraus ab dem Tag „Shop live“
//   (Starttag, setzt die Leitung im Chefbüro), Mindestlaufzeit vierundzwanzig Monate ab dann, Verlängerung um je
//   zwölf Monate, Kündigung drei Monate vor Ablauf · Umsatzbeteiligung auf den Netto-Umsatz über der Jahresschwelle
//   (erstes Jahr anteilig, quartalsweise mit Jahresabgleich) · Verkaufsbeteiligung bei Verkauf, auch vierundzwanzig
//   Monate nach dem Ende · erste Finanzierungsrunde der US-Gesellschaft GARANTIERT binnen drei Monaten ab der
//   Annahme (Runde 2; vorher ab erfüllten Bedingungen), sonst Erstattung der Gründungskosten; fehlen die Unterlagen
//   der Bürgschaft trotz Aufforderung, ruht die Frist · Bürgschaft der Schwarzott Global LLC ohne gesondertes
//   Entgelt, mit aufschiebenden Bedingungen und Sonderfreigabe-Vermerk · englisches Recht, Gerichtsstand London,
//   Unternehmergeschäft ohne Widerruf, Reverse Charge · Annahme nur mit Unterschrift (gezeichnet oder getippt).
//   Justin (07.10.2026): Die erste Runde ist kein Ziel — deshalb sagt die Seite „garantiert“, nie „Ziel“.
//   Gegenprüfung (07.10.2026): Die Seite sagt nie mehr als Ziffer 7 — „vertraglich garantiert nach Ziffer 7“,
//   mit der Frist (seit Runde 2: ab der Annahme) und der Erstattung der Gründung als Folge; keine Wahrscheinlichkeit
//   („sehr sicher“), kein „sobald“, und über Finanzierung und Konditionen entscheidet das Institut.
//   Alle Sätze mit „garant…“ kommen aus firmaGarantie() und FIRMA_GARANTIE_FEST (eine Quelle, Prüfstand
//   scripts/pruef-angebot-firma.ts).
//
// ── DATENSCHUTZ (E-242: das Repo ist öffentlich) ───────────────────────────
// Hier steht KEIN Kundendatum. Firma, Marke, Ziele, Bilder, Sonderfreigabe und Prüfbericht kommen aus
// der Datenbank (fiaon_global_angebote.kunde / .parameter.inhalt / .pruefbericht), angelegt vom Skript
// scripts/angebot-firma-anlegen.ts aus einer privaten Datei außerhalb des Repos.
//
// ── WORTWAND ──────────────────────────────────────────────────────────────
// Hauswand (shared/fiaon-wortverbote.ts), Global-Regeln (shared/fiaon-global-wortregeln.ts) und die
// Regeln aus dem Kopf von shared/fiaon-global-angebot.ts: kein „bis zu“, nichts „vermitteln“, kein
// Bankname, Fristen als Wort (zahlwort hier, bis neunundneunzig), keine Karte „bekommen“, „Sonderfreigabe“
// statt einer Genehmigung, kein „0 %“. Vertrag und Anlage 1 in Vertragssprache (ohne Ihr/wir), die Seite siezt.
//
// Diese Datei fasst keine Datenbank an und importiert nichts aus Node — die Seite darf sie laden.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { GLOBAL_ROLLEN } from "./fiaon-global";
import {
  ANGEBOT_PFLICHTHINWEIS, ANGEBOT_ANSPRECHPARTNER, BUERGIN_VORGABE, BUERGIN_FELDER, angebotVersandSperre, buerginOhneNummer,
  type AngebotBuergin, type AngebotZiffer, type AngebotAbsatz,
} from "./fiaon-global-angebot";
import { portraitUrl, portraitMitKi, KI_PORTRAIT_HINWEIS } from "./fiaon-portraits";
import {
  FIRMA_FASSUNG_PRAEFIX, istFirmenFassung,
  type FirmaKunde, type FirmaLand, type BildRef, type GlasKonfig, type FirmaPhase, type FirmaLeistung, type FirmaInvestPosten,
  type FirmaRechner, type FirmaFrage, type FirmaSeite, type FirmaSonderfreigabe, type Ampel, type ComplianceKundenfassung,
  type ComplianceBereich, type FirmaAnsprechpartner, type FirmaAnnahmeTexte, type FirmaBestellUebersicht, type FirmaTeam, type FirmaBudget,
} from "./fiaon-global-angebot-firma-typen";

export { FIRMA_FASSUNG_PRAEFIX, istFirmenFassung };

// ═══════════════════════════════════════════════════════════════════════════
// FASSUNG, KNOPF, NAMEN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Fassung B (Justins Änderungen nach der Live-Vorschau, 07.10.2026 abends, vor jedem Versand): keine Etappe „Ihre neue
 * Rolle“ und keine Begleitung einer neuen Geschäftsführung (Ziffer 4), das Kapital in EINER Auszahlung, nur noch die
 * Bedingungen der Bürgschaft aus den Angebotsdaten plus die Jahresabschlüsse, keine Sicherheiten, eigener Knopf der Firmenfassung.
 * Die Fassung ohne Buchstaben bleibt in FIRMA_FASSUNGEN, damit ein Angebot, das sie schon trägt, lesbar bleibt.
 * Wortlaut 08.10.2026 (Nachprüfung, vor jeder Freigabe — noch kein Angebot trägt die Fassung): Die Auszahlung in einem Betrag
 * ist VORGESEHEN, kein Tatbestand — sie gehört weder zur Bestimmung „erhalten“ in Ziffer 7 Absatz 2 noch zum Umfang der
 * Bürgschaft (Ziffer 8 Absatz 3, Anlage 1); zahlt ein Institut in Teilbeträgen aus, bleiben Garantie und Bürgschaft unberührt.
 * Die Freigabe des Anwalts hängt an der Prüfsumme (firmaVersandSperre), nicht am Namen der Fassung.
 */
/*
 * Fassung C (Justins Änderungen Runde 2, 08.10.2026 — die Live-Seite trug B, noch kein Angebot ist angenommen):
 *   · Garantie: die Frist der ersten Runde läuft ab der Annahme (Ziffer 7 Absatz 1 und 3); Empfängerin ist die US-Gesellschaft der
 *     Auftraggeberin; fehlen die Unterlagen der Bürgschaft nach Aufforderung, ruht sie (Ziffer 7 Absatz 4, bestehende Regel).
 *   · Statt der Monatspauschale „Plattform & Team“ ein gemeinsames Wachstumsbudget: die Auftraggeberin trägt die Hälfte, FIAON die
 *     andere; es beginnt am Tag „Shop live“ (Starttag), mit Aufstellung der Planwerte (Ziffer 10 Absatz 2 bis 4); Mehrbudget über das
 *     gemeinsame Budget hinaus nach Absprache (Ziffer 10 Absatz 6). Ziffern 3, 5, 6, 13 und 14 verweisen darauf.
 *   · Annahme mit Unterschrift (gezeichnet oder getippt) — der Annahmeblock nennt sie; keine Startwahl mehr.
 *   Anlage 1 bleibt Wort für Wort (Fassung D): Ihr Wortlaut hängt nicht an der Frist der Garantie.
 */
/*
 * Fassung D (Justins Änderungen Runde 3, 08.10.2026 — Endfassung zum Versand; die Live-Seite trug C, noch kein Angebot ist angenommen):
 *   · Ziffer 7: Garantiert ist die AUSZAHLUNG der ersten Runde an die US-Gesellschaft innerhalb der Frist ab der Annahme — eine
 *     verbindliche Zusage eines Instituts genügt nicht mehr (Absatz 1, 2 und 5). Ruhen bei fehlender Mitwirkung und Folge bleiben.
 *   · Ziffer 10 Absatz 2: Der Starttag (Beginn des Wachstumsbudgets) ist der Tag „Shop live“, spätestens aber der Tag sechs Monate
 *     nach der Annahme, es sei denn, die Verzögerung beruht auf Umständen, die FIAON zu vertreten hat (budgetSpaetestensMonate).
 *   Anlage 1 bleibt Wort für Wort (Fassung D der Anlage, Prüfsumme gleich): Sie verweist nur auf Ziffer 7 und Ziffer 8 Absatz 5/6.
 */
export const FIRMA_FASSUNG = `${FIRMA_FASSUNG_PRAEFIX}2026-10-08-D`;
export const FIRMA_FASSUNGEN = [`${FIRMA_FASSUNG_PRAEFIX}2026-10-07`, `${FIRMA_FASSUNG_PRAEFIX}2026-10-07-B`, `${FIRMA_FASSUNG_PRAEFIX}2026-10-08-C`, FIRMA_FASSUNG] as const;
/**
 * Fassung D: Zählt für die Garantie nur die Auszahlung (keine verbindliche Zusage)? Und gilt der späteste Starttag des Wachstumsbudgets
 * (Ziffer 10 Absatz 2)? Ein angenommenes Angebot behält seine Fassung; ein offenes zeigt immer die aktuelle.
 */
export function garantieNurAuszahlung(fassung: string | null | undefined): boolean {
  const f = String(fassung ?? "");
  return f.startsWith(FIRMA_FASSUNG_PRAEFIX) && f >= `${FIRMA_FASSUNG_PRAEFIX}2026-10-08-D`;
}
export const budgetSpaetestensGilt = garantieNurAuszahlung;
/** Der späteste Starttag des Wachstumsbudgets (Ziffer 10 Absatz 2, Fassung D): Tag der Annahme + budgetSpaetestensMonate, monatsende-sicher. */
export function budgetSpaetesterStart(annahmeTag: string, par: Pick<FirmaParameter, "budgetSpaetestensMonate">): string {
  return plusMonate(annahmeTag, par.budgetSpaetestensMonate);
}
/**
 * Läuft die Frist der Garantie ab der Annahme (Fassung C) — oder, wie in den Fassungen bis B, ab dem Tag der erfüllten Bedingungen?
 * Ein angenommenes Angebot behält seine Fassung; ein offenes zeigt immer die aktuelle (also C).
 */
export function garantieAbAnnahme(fassung: string | null | undefined): boolean {
  const f = String(fassung ?? "");
  return f.startsWith(FIRMA_FASSUNG_PRAEFIX) && f >= `${FIRMA_FASSUNG_PRAEFIX}2026-10-08-C`;
}
/**
 * Anlage 1 (Bürgschaftszusage Firma) hat ihren EIGENEN Fassungsstand — ihre Prüfsumme steht auf dem
 * eigenhändig unterschriebenen Original. Ändert sich ihr Wortlaut, hier eine neue Kennung setzen.
 */
export const ANLAGE1_FIRMA_FASSUNG = "IA-FIRMA-ANLAGE1-2026-10-08-D";
// Fassung B (Nachbesserung 07.10.2026, vor jedem Versand): Tag der erfüllten Bedingungen nach Vertrag Ziffer 8 Absatz 5,
// Kontrollwechsel bestimmt, Ausfertigung als deed vor einem Zeugen.
// Fassung C (Justin, 07.10.2026 abends): nur noch die aufschiebenden Bedingungen aus den Angebotsdaten und die
// Jahresabschlüsse der letzten zwei Jahre (in Fassung B gestrichen: alle übrigen Bedingungen), die Ziffer „Sicherheiten“
// entfällt, Auszahlung in einem Betrag; die Ziffern zählen danach fortlaufend weiter.
// Fassung D (Nachprüfung 08.10.2026): Die Auszahlung in einem Betrag ist vorgesehen, aber keine Grenze der Zusage — die Bürgin
// knüpft sie weder an Teilbeträge noch an einen Verwendungsplan, und bei Teilbeträgen gilt sie für alle.
export const FIRMA_MARKE = "Firmenangebot (07.10.2026)";
/**
 * Der Knopf der Firmenfassung — EINE Quelle für Seite, Annahmevermerk im PDF, Verlauf und Prüfstand (Justin, 07.10.2026:
 * B2B; die Zahlungspflicht steht im Satz direkt darunter, annahmeTexte.unterKnopf). Das Individualangebot behält
 * ANGEBOT_KNOPF („Auftrag zahlungspflichtig erteilen“) unverändert.
 */
export const FIRMA_KNOPF = "Zusammenarbeit und Kapital verbindlich annehmen";
/**
 * Die Überschrift über den Posten (Runde 2, Punkt 6: „Ihre Investition“ klang nach Ausgabe). Justins eigener Vorschlag war
 * „Ihre Erfüllungen“ — will er ihn, hier tauschen: FIRMA_VEREINBARUNG_TITEL = "Ihre Erfüllungen".
 */
export const FIRMA_VEREINBARUNG_TITEL = "Unsere Vereinbarung";
/** Wie die Bestellzeilen heißen — Rechnung, Zahlungsseite, Liste. */
export const FIRMA_PAKETNAME = "FIAON Global – Firmenangebot";
/** „Starten ab“: frühestens morgen, spätestens in neunzig Tagen (Berlin). */
export const FIRMA_START_SPAETESTENS_TAGE = 90;
/** Mindestfrist einer Aufforderung, bevor die Frist der Garantie ruht. */
export const FIRMA_AUFFORDERUNG_TAGE = 7;

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
/** Kundenspezifisch und frei — kommt NUR aus der Datenbank (parameter.inhalt). */
export interface FirmaInhalt {
  heroUnter?: string;
  ziele?: { titel: string; text: string }[];
  glas?: GlasKonfig | null;
  /**
   * Szenenbilder: herkunft (Phase „Aufbau“), usa (Phase „Erste Runde“, Leistung „Vertrieb“), rolle (Leistung „Strategie &
   * Wachstum“ — der Schlüssel heißt aus dem ersten Bau so; das Bild steht seit Fassung B ohne Text über einen Rollenwechsel).
   * src/srcset (und glas.etikett, glas.foto) tragen NUR Bildnamen („szene-a-1920.webp“): Die Bilder liegen in der Datenbank
   * am Angebot (fiaon_global_angebot_bilder); die Kundensicht macht daraus Adressen hinter dem Link (firmaInhaltMitBildLinks).
   */
  bilder?: Partial<Record<string, BildRef>>;
  sonderfreigabe?: { aktiv: boolean; text: string; unterzeichner?: string; funktion?: string; datum?: string };
  /** Kürzel aus ANGEBOT_ANSPRECHPARTNER, Vorgabe „justin“. */
  ansprechpartner?: string;
  /** Ergänzungen je Phase (Schlüssel = Nummer der Phase), an den Text gehängt. */
  phasenZusatz?: Record<string, string>;
  /** Bedingungen der Bürgschaft, die für dieses Angebot NICHT gelten (Schlüssel aus FIRMA_BEDINGUNGEN oder bedingungen). */
  bedingungenAus?: string[];
  /**
   * Kundenbezogene Bedingungen der Bürgschaft (Wortlaut für Vertrag/Anlage 1, Titel und „warum“ für die Seite) — sie stehen
   * vor den allgemeinen (FIRMA_BEDINGUNGEN). Kundendaten: nur in der privaten Datei und in der Datenbank, nie im Code.
   */
  bedingungen?: FirmaBedingung[];
  /**
   * „Ihr Team bei FIAON Global“ (Runde 2, Punkt 9) — Name, Rolle, optional foto. Namen NUR hier (private Datei → Datenbank), nie
   * im Code. foto: nur ein ECHTES Foto der Person — ein Bildname am Angebot („team-name.webp“, hinter dem Link) oder „haus:<kürzel>“
   * für ein echtes Porträt des Hauses (shared/fiaon-portraits.ts; ein KI-Porträt wird abgewiesen). Sonst ein Monogramm.
   */
  team?: FirmaTeamEintrag[];
  /** Die Aufstellung des Wachstumsbudgets, falls sie für dieses Angebot anders ist (Summe = budgetGesamtCents). Vorgabe: FIRMA_BUDGET_POSTEN. */
  budgetPosten?: FirmaBudgetPosten[];
}
/**
 * Runde 3 (Punkt 6): bestaetigt = false blendet die Person aus, bis Justin bestätigt, dass sie echt ist und am Mandat mitwirkt
 * (dann in der privaten Datei auf true stellen, ggf. Foto liefern). Fehlt das Feld, gilt die Person als bestätigt.
 */
export interface FirmaTeamEintrag { name: string; rolle: string; foto?: string; bestaetigt?: boolean; /** Justin 08.10.2026 abends: Foto ist ein Symbolbild (nur mit Bildname am Angebot) — der Bildnachweis nennt es. */ ki?: boolean }
export interface FirmaParameter {
  startCents: number;
  /** Seit Runde 2: der ANTEIL der Auftraggeberin am gemeinsamen Wachstumsbudget je Monat (die Hälfte von budgetGesamtCents). */
  monatCents: number;
  /** Das gemeinsame Wachstumsbudget je Monat (Runde 2: 4.000 €) — FIAON trägt budgetGesamtCents − monatCents. */
  budgetGesamtCents: number;
  /** Wann das Budget beginnt: am Tag „Shop live“ (Runde 2). Ein anderer Wert ist nicht vorgesehen (firmaParameterFehler). */
  budgetStart: "shop-live";
  /** Ab wann die Frist der Garantie läuft: ab der Annahme (Runde 2). Ein anderer Wert ist nicht vorgesehen. */
  garantieAb: "annahme";
  /**
   * Spätester Beginn des Wachstumsbudgets (Runde 3, Punkt 5): so viele Monate nach der Annahme, es sei denn, die Verzögerung
   * beruht auf Umständen, die FIAON zu vertreten hat (Ziffer 10 Absatz 2). Vorgabe sechs.
   */
  budgetSpaetestensMonate: number;
  mindestMonate: number;
  verlaengerungMonate: number;
  kuendigungMonate: number;
  umsatzSatzProzent: number;
  umsatzSchwelleCents: number;
  verkaufSatzProzent: number;
  verkaufNachlaufMonate: number;
  kapitalUsd: number;
  garantieMonate: number;
  buergschaftUsd: number;
  buergschaftHoechstMonate: number;
  weitereRundenAbMonaten: number;
  zahlungszielTage: number;
  /** Erstattung der Gründung im Garantiefall binnen … Tagen nach Fristende (neu, Vorgabe vierzehn). */
  erstattungTage: number;
  inhalt: FirmaInhalt;
}
export const FIRMA_VORGABEN: FirmaParameter = {
  startCents: 690000,
  monatCents: 200000,
  budgetGesamtCents: 400000,
  budgetStart: "shop-live",
  garantieAb: "annahme",
  budgetSpaetestensMonate: 6,
  mindestMonate: 24,
  verlaengerungMonate: 12,
  kuendigungMonate: 3,
  umsatzSatzProzent: 10,
  umsatzSchwelleCents: 60000000,
  verkaufSatzProzent: 5,
  verkaufNachlaufMonate: 24,
  kapitalUsd: 250000,
  garantieMonate: 3,
  buergschaftUsd: 250000,
  buergschaftHoechstMonate: 60,
  weitereRundenAbMonaten: 12,
  zahlungszielTage: 7,
  erstattungTage: 14,
  inhalt: {},
};
/** Wie lange ein Firmenangebot gilt, wenn nichts anderes eingetragen ist. */
export const FIRMA_GUELTIG_TAGE = 21;

export interface FirmaDaten {
  ref: string;
  fassung: string;
  kunde: FirmaKunde;
  parameter: FirmaParameter;
  buergin: AngebotBuergin;
  compliance: ComplianceKundenfassung | null;
  /** JJJJ-MM-TT */
  gueltigBis: string;
}
/** Die Freigaben im Chefbüro (fiaon_global_angebote.freigaben, Migration 096). */
export interface FirmaFreigaben {
  /**
   * Freigabe des Anwalts — gebunden an die FASSUNG, die er gesehen hat (Gegenprüfung 07.10.2026): Prüfsumme des Vertrags
   * (firmaTextHash) und der Anlage 1 zum Zeitpunkt der Freigabe. Ändert sich danach ein Wort (Parameter, Bürgin, Prüfbericht,
   * neue Fassung nach einem Deploy), sperrt firmaVersandSperre den Versand wieder, bis die Freigabe neu eingetragen ist.
   * buergin (Nachprüfung 08.10.2026): Prüfsumme der Bürgin-Angaben bei der Freigabe (firmaBuerginPruefsumme) — auch eine
   * spätere Änderung an Registerauszug/Status sperrt den Versand wieder.
   */
  anwalt?: { name: string; am: string; von?: string; fassung?: string; textHash?: string; anlage1?: string; buergin?: string } | null;
  bedingungenErfuelltAm?: string | null;
  sunbiz?: { am: string } | null;
  /**
   * Kündigung. seite: wer gekündigt hat; art: ordentlich (Ziffer 14 Absatz 2) oder aus wichtigem Grund. garantieEntfaellt nur bei
   * einer außerordentlichen Kündigung (Ziffer 14 Absatz 3) — eine ordentliche Kündigung lässt die Garantie stehen.
   * „von“ ist wie überall die eintragende Person im Chefbüro. Alte Einträge ohne art gelten als ordentlich.
   */
  kuendigung?: { am: string; zum: string; von?: string; seite?: FirmaKuendigungSeite; art?: FirmaKuendigungArt; garantieEntfaellt?: boolean } | null;
  /** Verkauf. endetUmsatz: mehr als die Hälfte der Anteile oder der Betrieb im Ganzen (Ziffer 11 Absatz 8) — dann endet die Umsatzbeteiligung. */
  verkauf?: { am: string; von?: string; endetUmsatz?: boolean } | null;
  /** Jede Umsatzmeldung (Schlüssel „Q2 2027“ bzw. „Jahr 2027“) — auch ohne Rechnung, damit sie nicht zweimal zählt. */
  umsatzMeldungen?: Record<string, { am: string; kumuliertCents: number; ergebnisCents: number; von?: string }> | null;
}
export type FirmaKuendigungSeite = "auftraggeberin" | "fiaon";
export type FirmaKuendigungArt = "ordentlich" | "ausserordentlich";
/** Schließt eine eingetragene Kündigung den Garantiefall aus? Nur eine außerordentliche, die vor dem Fristende wirkt (Ziffer 14 Absatz 3). */
export function kuendigungSperrtGarantie(k: FirmaFreigaben["kuendigung"], fristEnde: string | null): boolean {
  return !!k && k.art === "ausserordentlich" && k.garantieEntfaellt === true && !!fristEnde && k.zum < fristEnde;
}
/** Was bei der Annahme gewählt wurde (nur Fassungen bis B). startAm null = sofort (Starttag = Tag der Annahme). */
export interface FirmaWahl { startAm: string | null }
/** Die gespeicherte Unterschrift (Runde 2, Punkt 11): Art, getippter Name, Bild (data:image/png;base64,…), Zeit und IP. */
export interface FirmaUnterschriftVermerk { art: "gezeichnet" | "getippt"; name?: string | null; png?: string | null; am?: string; ip?: string }
/**
 * Der Vermerk unter dem Vertrag nach dem Klick — steht NICHT in der Prüfsumme. starttag/sofort nur bei Fassungen bis B (Startwahl
 * bei der Annahme); seit Fassung C setzt die Leitung den Starttag („Shop live“) später. unterschrift seit Fassung C Pflicht.
 */
export interface FirmaAnnahmeVermerk { am: Date; ip: string; userAgent: string; hash: string; starttag?: string | null; sofort?: boolean; unterschrift?: FirmaUnterschriftVermerk | null }

export const FIRMA_LAND_NAME: Record<FirmaLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const REGISTER_NAME: Record<FirmaLand, string> = { DE: "Handelsregister", AT: "Firmenbuch", CH: "Handelsregister" };

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN ALS TEXT, BETRÄGE, DATEN
// ═══════════════════════════════════════════════════════════════════════════
const EINER = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
  "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const ZEHNER = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
/** Eine Frist als Wort (Wortregel FIAON Global) — null bis neunundneunzig. Darüber gibt es keinen Wortlaut: dann wirft sie. */
export function zahlwort(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new Error(`Kein Zahlwort für ${n}`);
  if (n < 20) return EINER[n];
  const e = n % 10; const z = Math.floor(n / 10);
  return e === 0 ? ZEHNER[z] : `${e === 1 ? "ein" : EINER[e]}und${ZEHNER[z]}`;
}
/** „vierundzwanzig Monate“ / „ein Monat“ */
export function monateWort(n: number): string { return n === 1 ? "ein Monat" : `${zahlwort(n)} Monate`; }
/** „drei Monaten“ (Dativ) / „einem Monat“ */
export function monatenWort(n: number): string { return n === 1 ? "einem Monat" : `${zahlwort(n)} Monaten`; }
/** „sieben Tagen“ (Dativ) */
export function tagenWort(n: number): string { return n === 1 ? "einem Tag" : `${zahlwort(n)} Tagen`; }

/** „6.900,00 €“ — wie auf der Rechnung. */
export function firmaEur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
/** „6.900 €“ — ohne Cent, für Fließtext und die großen Zahlen der Seite. */
export function firmaEurKurz(cents: number): string {
  return cents % 100 === 0 ? `${(cents / 100).toLocaleString("de-DE")} €` : firmaEur(cents);
}
/** „250.000 US-Dollar“ */
export function firmaUsd(usd: number): string { return `${Math.round(usd).toLocaleString("de-DE")} US-Dollar`; }
/** „250.000 USD“ — die große Zahl auf der Seite. */
export function firmaUsdKurz(usd: number): string { return `${Math.round(usd).toLocaleString("de-DE")} USD`; }
/** „10 %“ */
export function firmaProzent(p: number): string { return `${String(p).replace(".", ",")} %`; }
/** „07.10.2026“ aus „2026-10-07“ */
export function firmaTag(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
function tageImMonat(jahr: number, monat1: number): number { return new Date(Date.UTC(jahr, monat1, 0)).getUTCDate(); }
/**
 * Monatsende-sicher n Monate weiter (n auch negativ): 31.01. + 1 → 28.02. (29.02. im Schaltjahr), 31.03. − 1 → 28./29.02.
 * Gerechnet wird immer vom Ausgangstag aus (nicht verkettet): 31.01. + 2 → 31.03.
 */
export function plusMonate(iso: string, n: number): string {
  if (!ISO.test(iso) || !Number.isInteger(n)) throw new Error(`plusMonate: ${iso} / ${n}`);
  const [j, m, t] = iso.split("-").map(Number);
  const gesamt = (j * 12 + (m - 1)) + n;
  const zj = Math.floor(gesamt / 12); const zm = (gesamt % 12) + 1;
  const tag = Math.min(t, tageImMonat(zj, zm));
  return `${String(zj).padStart(4, "0")}-${String(zm).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}
export function plusTageIso(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
/** Ganze Tage von a nach b (b − a). */
export function tageZwischen(a: string, b: string): number {
  return Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 864e5);
}

// ═══════════════════════════════════════════════════════════════════════════
// RECHENREGELN (rein — Server, Chefbüro und Prüfstand rechnen damit)
// ═══════════════════════════════════════════════════════════════════════════
/** Fälligkeit des Monatsanteils für Monat k (k ≥ 1): Starttag („Shop live“) + (k − 1) Monate, monatsende-sicher. */
export function monatFaelligAm(starttag: string, k: number): string { return plusMonate(starttag, k - 1); }
/** Der Zeitraum, den Monat k abdeckt: „07.10.2026–06.11.2026“. */
export function monatZeitraum(starttag: string, k: number): { von: string; bis: string; text: string } {
  const von = plusMonate(starttag, k - 1); const bis = plusTageIso(plusMonate(starttag, k), -1);
  return { von, bis, text: `${firmaTag(von)}–${firmaTag(bis)}` };
}
/** Ende der Laufzeit nach insgesamt `monate` Monaten ab Starttag (letzter Tag). */
export function laufzeitEnde(starttag: string, monate: number): string { return plusTageIso(plusMonate(starttag, monate), -1); }
/**
 * Spätester Tag, an dem eine Kündigung zum Laufzeitende `ende` eingehen muss: „spätestens drei Monate vor Ablauf“.
 * Der Vertrag läuft bis zum Ende des Tages `ende`; drei Monate davor ist der Beginn des Tages (ende + 1) − 3 Monate —
 * eingehen muss die Kündigung also bis zum Tag davor. Beispiel: Ende 06.10.2028 → spätestens 06.07.2028.
 */
export function kuendigungSpaetestens(ende: string, kuendigungMonate: number): string { return plusTageIso(plusMonate(plusTageIso(ende, 1), -kuendigungMonate), -1); }
/**
 * Zu welchem Laufzeitende wirkt eine Kündigung, die am Tag `am` eingeht? Erst die Mindestlaufzeit, dann je eine
 * Verlängerung — das erste Ende, dessen Kündigungsfrist am Tag `am` noch offen ist.
 */
export function kuendigungWirksamZum(starttag: string, par: Pick<FirmaParameter, "mindestMonate" | "verlaengerungMonate" | "kuendigungMonate">, am: string): { zum: string; monateGesamt: number } {
  let monate = par.mindestMonate;
  for (let i = 0; i < 200; i++) {
    const ende = laufzeitEnde(starttag, monate);
    if (am <= kuendigungSpaetestens(ende, par.kuendigungMonate)) return { zum: ende, monateGesamt: monate };
    monate += par.verlaengerungMonate;
  }
  throw new Error("kuendigungWirksamZum: keine Laufzeit gefunden");
}
/**
 * Die Umsatzschwelle eines Kalenderjahres (Ziffer 11 Absatz 4). Im ersten, angebrochenen Jahr anteilig nach Monaten ab dem
 * Monat des Starttags (einschließlich); endet die Umsatzbeteiligung im Lauf eines Jahres (`endeTag`), ebenso anteilig bis zum
 * Monat des Endes (einschließlich): Schwelle × Monate / 12, auf ganze Cent gerundet. Vor dem Startjahr und nach dem Jahr des
 * Endes gibt es keine.
 */
export function umsatzSchwelleJahr(par: Pick<FirmaParameter, "umsatzSchwelleCents">, jahr: number, starttag: string, endeTag: string | null = null): { schwelleCents: number; monate: number } {
  const startJahr = Number(starttag.slice(0, 4)); const startMonat = Number(starttag.slice(5, 7));
  const endeJahr = endeTag ? Number(endeTag.slice(0, 4)) : null; const endeMonat = endeTag ? Number(endeTag.slice(5, 7)) : 12;
  if (jahr < startJahr || (endeJahr != null && jahr > endeJahr)) return { schwelleCents: 0, monate: 0 };
  const von = jahr === startJahr ? startMonat : 1;
  const bis = endeJahr != null && jahr === endeJahr ? endeMonat : 12;
  const monate = Math.max(0, bis - von + 1);
  return { schwelleCents: Math.round((par.umsatzSchwelleCents * monate) / 12), monate };
}
/** Letzter Tag des Kalenderquartals, in dem `tag` liegt. */
export function quartalsEnde(tag: string): string {
  const j = tag.slice(0, 4); const q = Math.floor((Number(tag.slice(5, 7)) - 1) / 3);
  return `${j}-${["03-31", "06-30", "09-30", "12-31"][q]}`;
}
/**
 * Wann endet die Umsatzbeteiligung (Ziffer 11 Absatz 8)? Am Ende des Kalenderquartals, in dem Vertrag UND Bürgschaft geendet
 * haben — oder in dem ein Verkauf der Mehrheit bzw. des Betriebs im Ganzen vollzogen wurde. Besteht eine Bürgschaft, ist
 * ihr Ende nicht im System — dann zählt nur der Verkauf (null = läuft weiter, die Leitung entscheidet).
 */
export function umsatzBeteiligungEnde(fr: Pick<FirmaFreigaben, "kuendigung" | "verkauf">, buergschaftBesteht: boolean): string | null {
  const kandidaten: string[] = [];
  if (fr.verkauf?.endetUmsatz && fr.verkauf.am) kandidaten.push(fr.verkauf.am);
  if (fr.kuendigung?.zum && !buergschaftBesteht) kandidaten.push(fr.kuendigung.zum);
  if (!kandidaten.length) return null;
  return quartalsEnde(kandidaten.sort()[0]);
}
/**
 * Die Umsatzbeteiligung einer Meldung: Satz × max(0, kumulierter Netto-Umsatz − Schwelle) − bereits für dieses Jahr
 * abgerechnet. Positiv = Rechnung, negativ (nur im Jahresabgleich möglich) = Gutschrift.
 */
export function umsatzBeteiligungRechnen(ein: { kumuliertCents: number; schwelleCents: number; satzProzent: number; bereitsCents: number }):
  { beteiligungJahrCents: number; differenzCents: number; rechnungCents: number; gutschriftCents: number } {
  const ueber = Math.max(0, ein.kumuliertCents - ein.schwelleCents);
  const beteiligungJahrCents = Math.round((ueber * ein.satzProzent) / 100);
  const differenzCents = beteiligungJahrCents - ein.bereitsCents;
  return { beteiligungJahrCents, differenzCents, rechnungCents: Math.max(0, differenzCents), gutschriftCents: Math.max(0, -differenzCents) };
}
/** Die Verkaufsbeteiligung: Satz × Gegenleistung, auf ganze Cent gerundet. */
export function verkaufBeteiligungRechnen(gegenleistungCents: number, satzProzent: number): number {
  return Math.round((gegenleistungCents * satzProzent) / 100);
}
/** Ende der Garantiefrist: Tag der erfüllten Bedingungen + Garantiemonate + geruhte Tage. */
export function garantieFristEnde(bedingungenErfuelltAm: string, garantieMonate: number, ruhtTage = 0): string {
  return plusTageIso(plusMonate(bedingungenErfuelltAm, garantieMonate), Math.max(0, ruhtTage));
}
/** Was der Rechner auf der Seite rechnet — nur Schwelle × Satz, keine Annahmen über Margen. */
export function rechnerBeteiligung(umsatzCents: number, schwelleCents: number, satzProzent: number): number {
  return Math.round((Math.max(0, umsatzCents - schwelleCents) * satzProzent) / 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER UND PFLICHTFELDER PRÜFEN
// ═══════════════════════════════════════════════════════════════════════════
/** Die Parameter, die Text sind (nicht Zahl) — mit ihrem einzigen erlaubten Wert in Fassung C. */
const FIRMA_TEXT_PARAMETER = { budgetStart: "shop-live", garantieAb: "annahme" } as const;
export function firmaParameterAus(roh: any, basis: FirmaParameter = FIRMA_VORGABEN): FirmaParameter {
  const zahl = (v: unknown, alt: number) => (v === undefined || v === null || v === "" ? alt : Math.round(Number(v)));
  const r = roh && typeof roh === "object" ? roh : {};
  const inhalt = r.inhalt && typeof r.inhalt === "object" ? (r.inhalt as FirmaInhalt) : basis.inhalt;
  const out: any = { inhalt };
  for (const k of Object.keys(FIRMA_VORGABEN) as (keyof FirmaParameter)[]) {
    if (k === "inhalt") continue;
    if (k in FIRMA_TEXT_PARAMETER) { out[k] = r[k] === undefined || r[k] === null || r[k] === "" ? basis[k] : String(r[k]); continue; }
    out[k] = zahl(r[k], basis[k] as number);
  }
  return out as FirmaParameter;
}
/** Grenzen, in denen der Wortlaut trägt (Zahlwörter, Beträge). Erster Fehler oder null. */
export function firmaParameterFehler(p: FirmaParameter): string | null {
  const ganz = (n: unknown) => Number.isInteger(n);
  const zw = (n: number) => ganz(n) && n >= 1 && n <= 99;
  if (!ganz(p.startCents) || p.startCents < 10000 || p.startCents > 10_000_000) return "Gründung: zwischen 100 € und 100.000 €.";
  if (!ganz(p.monatCents) || p.monatCents < 10000 || p.monatCents > 5_000_000) return "Anteil am Wachstumsbudget: zwischen 100 € und 50.000 € im Monat.";
  if (!ganz(p.budgetGesamtCents) || p.budgetGesamtCents !== p.monatCents * 2) return "Wachstumsbudget: budgetGesamtCents muss genau das Doppelte des Anteils (monatCents) sein — die Auftraggeberin trägt die Hälfte, FIAON die andere.";
  if (p.budgetStart !== FIRMA_TEXT_PARAMETER.budgetStart) return "budgetStart: nur „shop-live“ (das Budget beginnt am Tag „Shop live“).";
  if (p.garantieAb !== FIRMA_TEXT_PARAMETER.garantieAb) return "garantieAb: nur „annahme“ (die Frist der Garantie läuft ab der Annahme).";
  if (!zw(p.mindestMonate) || !zw(p.verlaengerungMonate) || !zw(p.kuendigungMonate)) return "Laufzeit, Verlängerung und Kündigung: ein bis neunundneunzig Monate.";
  if (!zw(p.budgetSpaetestensMonate) || p.budgetSpaetestensMonate > 24) return "Spätester Beginn des Wachstumsbudgets (budgetSpaetestensMonate): ein bis vierundzwanzig Monate nach der Annahme.";
  if (p.kuendigungMonate >= p.mindestMonate) return "Die Kündigungsfrist muss kürzer sein als die Mindestlaufzeit.";
  if (!ganz(p.umsatzSatzProzent) || p.umsatzSatzProzent < 1 || p.umsatzSatzProzent > 50) return "Umsatzbeteiligung: ein bis fünfzig Prozent.";
  if (!ganz(p.umsatzSchwelleCents) || p.umsatzSchwelleCents < 0 || p.umsatzSchwelleCents > 100_000_000_000) return "Umsatzschwelle ungültig.";
  if (!ganz(p.verkaufSatzProzent) || p.verkaufSatzProzent < 1 || p.verkaufSatzProzent > 50) return "Verkaufsbeteiligung: ein bis fünfzig Prozent.";
  if (!zw(p.verkaufNachlaufMonate) || !zw(p.garantieMonate) || !zw(p.buergschaftHoechstMonate) || !zw(p.weitereRundenAbMonaten)) return "Monatsangaben: ein bis neunundneunzig.";
  if (!ganz(p.kapitalUsd) || p.kapitalUsd < 10000 || p.kapitalUsd > 10_000_000) return "Erste Runde: 10.000 bis 10.000.000 US-Dollar.";
  if (!ganz(p.buergschaftUsd) || p.buergschaftUsd < 0 || p.buergschaftUsd > 10_000_000) return "Höchstbetrag der Bürgschaft ungültig.";
  if (!zw(p.zahlungszielTage) || !zw(p.erstattungTage)) return "Zahlungsziel und Erstattung: ein bis neunundneunzig Tage.";
  const bed = p.inhalt?.bedingungen;
  if (bed !== undefined && (!Array.isArray(bed) || firmaBedingungenAusInhalt(bed).length !== bed.length)) {
    return "Bedingungen der Bürgschaft (inhalt.bedingungen): jede mit schluessel (klein, ohne Leerzeichen), vertrag, titel und warum — Texte, nicht leer, jeder Schlüssel einmal.";
  }
  const bp = p.inhalt?.budgetPosten;
  if (bp !== undefined) {
    const gut = Array.isArray(bp) && bp.length > 0 && bp.every((x) => x && typeof x.titel === "string" && x.titel.trim() && typeof x.schluessel === "string" && Number.isInteger(x.cents) && x.cents > 0);
    if (!gut) return "Wachstumsbudget (inhalt.budgetPosten): jeder Posten mit schluessel, titel und cents (ganze Zahl über null).";
  }
  const summe = firmaBudgetPosten(p).reduce((a, x) => a + x.cents, 0);
  if (summe !== p.budgetGesamtCents) return `Wachstumsbudget: Die Aufstellung ergibt ${firmaEurKurz(summe)}, das Budget ist ${firmaEurKurz(p.budgetGesamtCents)} — beides muss gleich sein.`;
  const team = p.inhalt?.team;
  if (team !== undefined && (!Array.isArray(team) || team.some((t) => !t || typeof t.name !== "string" || !t.name.trim() || typeof t.rolle !== "string" || !t.rolle.trim() || (t.foto !== undefined && !firmaTeamFotoOk(t.foto)) || (t.ki !== undefined && (typeof t.ki !== "boolean" || (t.ki && !FIRMA_BILD_NAME.test(String(t.foto ?? ""))))) || (t.bestaetigt !== undefined && typeof t.bestaetigt !== "boolean")))) {
    return "Team (inhalt.team): jede Person mit name und rolle; foto nur als Bildname am Angebot („team-x.webp“) oder „haus:<kürzel>“ eines ECHTEN Porträts (kein KI-Porträt); bestaetigt nur true oder false.";
  }
  const falsch = firmaBildVerweise(p.inhalt).filter((n) => !FIRMA_BILD_NAME.test(n));
  if (falsch.length) return `Bilder: nur Bildnamen wie „szene-a-1920.webp“ (klein, ohne Pfad) — die Bilder liegen in der Datenbank am Angebot. Nicht erlaubt: ${falsch.slice(0, 3).join(", ")}`;
  return null;
}
/** Was der Annahme noch fehlt — in Sätzen für das Chefbüro (kein gesperrter Knopf ohne Grund). Leer = annehmbar. */
export function firmaPflichtFehlen(d: Pick<FirmaDaten, "buergin" | "compliance" | "kunde">): string[] {
  const fehlt: string[] = [];
  for (const f of BUERGIN_FELDER) {
    const w = d.buergin[f.schluessel];
    if (w == null || String(w).trim() === "") fehlt.push(`Bürgin: ${f.bezeichnung}`);
  }
  if (d.buergin.unterzeichnetAm && !ISO.test(d.buergin.unterzeichnetAm)) fehlt.push("Bürgin: Datum der Unterschrift (JJJJ-MM-TT)");
  if (!d.buergin.bestaetigt) fehlt.push("Bürgin: Bundesstaat, Anschrift und Vertretung bestätigt (Haken)");
  if (!d.compliance) fehlt.push("Anlage 2: Prüfbericht (Kundenfassung)");
  const f = d.kunde?.firma; const v = d.kunde?.vertretung;
  if (!f?.name || !f.strasse || !f.plz || !f.ort || !f.uid || !f.registernummer || !f.registergericht) fehlt.push("Firma: Name, Anschrift, Register und UID");
  if (!v?.vorname || !v.nachname || !v.funktion || !d.kunde?.email) fehlt.push("Vertretung: Name, Funktion und E-Mail");
  return fehlt;
}
/**
 * Justin (07.10.2026): Versand an die Kundin erst bei Sunbiz „Active“. angebotVersandSperre (E-268, unverändert) verlangt nur
 * einen Registerauszug als Grundlage — für das Firmenangebot muss die Grundlage auch den Status nennen: „Active“ als eigenes
 * Wort, und kein „Inactive“ (auch nicht „Status Inactive, Reinstatement beantragt“). Beispiel: „Sunbiz-Auszug vom 09.10.2026: Status Active“.
 * Nachprüfung 08.10.2026 (N4): Auch was „Active“ verneint oder überholt, sperrt — „not/nicht/kein Active“, „früher/ehemals
 * Active“, Auflösung (Dissolution), Widerruf (revoked), Löschung, Aussetzung. Im Zweifel gesperrt: Die Leitung schreibt die
 * Grundlage dann so, wie der Auszug sie nennt.
 */
export const FIRMA_REGISTER_VERNEINT = /inact|\b(?:not|nicht|kein\w*|non|never|nie|früher|ehemals|formerly|previously|no\s+longer|nicht\s+mehr|not\s+(?:yet|currently|longer))\b[\s\-–—:,„“"'()]*active\b|dissol|aufgel[öo]|revok|widerruf|withdr[ae]w|cancel|gelöscht|erlosch|suspend|ruhend|lapse|expir|abgelaufen/i;
export function firmaRegisterAktiv(grundlage: unknown): boolean {
  const g = String(grundlage ?? "");
  return /\bactive\b/i.test(g) && !FIRMA_REGISTER_VERNEINT.test(g);
}
/**
 * VERSANDSPERRE FIRMA: die Sperre der Bürgin (Registerauszug, angebotVersandSperre), der Status „Active“ im Auszug
 * (firmaRegisterAktiv) PLUS die Freigabe des Anwalts — und die
 * Freigabe gilt nur für die Fassung, die er gesehen hat: Mit `aktuell` (Prüfsummen von Vertrag und Anlage 1 jetzt) sperrt
 * jede Abweichung; eine Freigabe ohne Prüfsumme gilt dann als abweichend. Ohne `aktuell` (reine Prüfung) nur Name und Datum.
 * Nachprüfung 08.10.2026 (N4): Mit `aktuell.buergin` (Prüfsumme der Bürgin-Angaben jetzt, firmaBuerginPruefsumme) hängt die
 * Freigabe auch an den Angaben der Bürgin, die bei der Freigabe standen — Registerauszug, Status, Vertretung. Ändert die Leitung
 * sie danach (etwa die Grundlage auf „Active“), sperrt der Versand, bis der Inhaber die Freigabe neu einträgt.
 * Rückgabe: alle Gründe als Satz fürs Chefbüro — oder null (frei).
 */
export function firmaVersandSperre(b: AngebotBuergin, fr: FirmaFreigaben | null | undefined, aktuell?: { textHash: string; anlage1: string; buergin?: string }): string | null {
  // Justin 08.10.2026 abends: Der Registernachweis der Bürgin (Registerauszug, Status „Active“) sperrt den Versand des
  // Firmenangebots NICHT mehr — er hat mit der Annahme nichts zu tun. Es bleibt allein die Freigabe des Anwalts für genau
  // diese Fassung (Vertrag, Anlage 1, Bürgin-Angaben). Das Individualangebot (E-268, angebotVersandSperre) bleibt unverändert.
  void b;
  const gruende: string[] = [];
  if (!fr?.anwalt?.name || !fr.anwalt.am) gruende.push("Die Freigabe des Vertrags durch den Anwalt fehlt — Name und Datum unter „Freigabe Anwalt“ eintragen, erst dann geht der Link raus.");
  else if (aktuell && (fr.anwalt.textHash !== aktuell.textHash || fr.anwalt.anlage1 !== aktuell.anlage1)) {
    gruende.push("Vertrag oder Anlage 1 haben sich seit der Freigabe des Anwalts geändert — die aktuelle Fassung (Prüfsumme im Chefbüro) freigeben lassen und die Freigabe neu eintragen.");
  } else if (aktuell?.buergin && fr.anwalt.buergin !== aktuell.buergin) {
    gruende.push("Die Angaben der Bürgin (Registerauszug, Status, Vertretung) haben sich seit der Freigabe geändert — die Freigabe neu eintragen (nur Justin), erst dann geht der Link raus.");
  }
  return gruende.length ? gruende.join(" ") : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BILDER: NUR NAMEN IN DEN DATEN, ADRESSE NUR HINTER DEM LINK (E-301, Gegenprüfung 07.10.2026)
// Bilder eines Angebots zeigen Marke und Produkte der Kundin — sie gehören nicht ins öffentliche Repo und nicht unter
// eine öffentliche Adresse. Die Angebotsdaten nennen deshalb nur Namen; die Bilder liegen in der Datenbank am Angebot
// (fiaon_global_angebot_bilder, eingespielt vom Import-Skript mit --bilder) und gehen über
// GET /api/fiaon/global/angebot/:token/bild/:name raus — mit derselben Prüfung des Links wie Seite und PDFs.
// ═══════════════════════════════════════════════════════════════════════════
/** Ein Bildname: klein, Ziffern und Bindestriche, Endung webp/png/jpg/jpeg — kein Pfad, kein Punkt davor. */
export const FIRMA_BILD_NAME = /^[a-z0-9][a-z0-9-]{0,80}\.(webp|png|jpe?g)$/;
/** Die Adresse eines Bildes hinter dem Link (dieselbe Wurzel wie vertragPdf in der Kundensicht). */
export function firmaBildPfad(token: string, name: string): string {
  return `/api/fiaon/global/angebot/${encodeURIComponent(token)}/bild/${encodeURIComponent(name)}`;
}
function srcsetNamen(srcset: unknown): string[] {
  return String(srcset ?? "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => t.split(/\s+/)[0]);
}
/** Alle Bildnamen, auf die die Angebotsdaten zeigen (Szenen, Produktfoto, Etikett, echte Teamfotos) — für Import und Prüfung. */
export function firmaBildVerweise(inhalt: FirmaInhalt | null | undefined): string[] {
  const namen: string[] = [];
  const ref = (b: unknown) => { if (b && typeof b === "object") { const r = b as BildRef; if (r.src) namen.push(String(r.src)); namen.push(...srcsetNamen(r.srcset)); } };
  for (const b of Object.values(inhalt?.bilder ?? {})) ref(b);
  if (inhalt?.glas) { if (inhalt.glas.etikett) namen.push(String(inhalt.glas.etikett)); ref(inhalt.glas.foto); }
  for (const t of Array.isArray(inhalt?.team) ? inhalt!.team! : []) if (t?.foto && !String(t.foto).startsWith(TEAM_HAUS)) namen.push(String(t.foto));
  return Array.from(new Set(namen));
}
/** Ein Teamfoto aus dem Haus: „haus:<kürzel>“ (shared/fiaon-portraits.ts). */
const TEAM_HAUS = "haus:";
/**
 * Ist das foto eines Teameintrags zulässig? Ein Bildname am Angebot (echtes Foto, vom Import eingespielt) oder „haus:<kürzel>“ für
 * ein echtes Porträt des Hauses. Ein KI-Porträt des Hauses (portraitMitKi) ist hier NICHT zulässig (Justin 08.10.2026, Punkt 9).
 */
export function firmaTeamFotoOk(foto: unknown): boolean {
  const f = String(foto ?? "");
  if (f.startsWith(TEAM_HAUS)) { const k = f.slice(TEAM_HAUS.length); return /^[a-z][a-z0-9-]{1,30}$/.test(k) && !portraitMitKi(k); }
  return FIRMA_BILD_NAME.test(f);
}
function bildMitLink(b: BildRef | null | undefined, token: string): BildRef | undefined {
  if (!b || typeof b !== "object" || !FIRMA_BILD_NAME.test(String(b.src ?? ""))) return undefined;
  const teile = String(b.srcset ?? "").split(",").map((t) => t.trim()).filter(Boolean).map((t) => t.split(/\s+/));
  const srcsetOk = teile.length > 0 && teile.every(([n, w]) => FIRMA_BILD_NAME.test(n) && /^\d+w$/.test(String(w ?? "")));
  const aus: BildRef = { ...b, src: firmaBildPfad(token, b.src) };
  if (srcsetOk) aus.srcset = teile.map(([n, w]) => `${firmaBildPfad(token, n)} ${w}`).join(", "); else delete aus.srcset;
  return aus;
}
/**
 * Die Angebotsdaten für die Kundensicht: Bildnamen → Adressen hinter dem Link. Was kein Bildname ist (etwa ein alter
 * öffentlicher Pfad), fällt weg — die Seite zeigt nie eine Adresse außerhalb des Links. Ohne Etikett oder Foto kein Glas
 * (die Seite zeigt dann den Kopf ohne 3D).
 */
export function firmaInhaltMitBildLinks(inhalt: FirmaInhalt | null | undefined, token: string): FirmaInhalt {
  const i: FirmaInhalt = { ...(inhalt ?? {}) };
  if (i.bilder) {
    const bilder: Partial<Record<string, BildRef>> = {};
    for (const [k, b] of Object.entries(i.bilder)) { const m = bildMitLink(b, token); if (m) bilder[k] = m; }
    i.bilder = bilder;
  }
  if (i.glas) {
    const foto = bildMitLink(i.glas.foto, token);
    i.glas = foto && FIRMA_BILD_NAME.test(String(i.glas.etikett ?? "")) ? { ...i.glas, etikett: firmaBildPfad(token, i.glas.etikett), foto } : null;
  }
  // Teamfotos: ein Bildname geht hinter den Link; „haus:<kürzel>“ bleibt (firmaTeam macht daraus das echte Porträt des Hauses).
  if (Array.isArray(i.team)) {
    i.team = i.team.map((t) => {
      const f = String(t?.foto ?? "");
      if (!f || f.startsWith(TEAM_HAUS)) return t;
      if (!FIRMA_BILD_NAME.test(f)) { const { foto: _weg, ...rest } = t; return rest; }
      return { ...t, foto: firmaBildPfad(token, f) };
    });
  }
  return i;
}

// ═══════════════════════════════════════════════════════════════════════════
// ANREDE, NAMEN
// ═══════════════════════════════════════════════════════════════════════════
export function firmaVertreterName(k: FirmaKunde): string {
  return [k.vertretung?.vorname, k.vertretung?.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
}
/** „Frau Muster“ — für Begrüßung und Glückwunsch. */
export function firmaGruss(k: FirmaKunde): string {
  const nach = String(k.vertretung?.nachname || "").trim();
  return k.vertretung?.anrede && nach ? `${k.vertretung.anrede} ${nach}` : firmaVertreterName(k);
}
/** „Sehr geehrte Frau Muster“ / „Sehr geehrter Herr Muster“ / „Guten Tag Alex Muster“ */
export function firmaKundeAnrede(k: FirmaKunde): string {
  const nach = String(k.vertretung?.nachname || "").trim();
  if (k.vertretung?.anrede === "Frau" && nach) return `Sehr geehrte Frau ${nach}`;
  if (k.vertretung?.anrede === "Herr" && nach) return `Sehr geehrter Herr ${nach}`;
  return `Guten Tag ${firmaVertreterName(k)}`.trim();
}
function marke(k: FirmaKunde): string { return String(k.firma?.marke || k.firma?.name || "").trim(); }
function anschrift(k: FirmaKunde): string {
  const f = k.firma; return `${f.strasse}, ${f.plz} ${f.ort}, ${FIRMA_LAND_NAME[f.land] ?? f.land}`;
}
/** Der Ansprechpartner aus der einen Liste (shared/fiaon-global-angebot.ts) — Vorgabe Justin. */
export function firmaAnsprechpartner(par: Pick<FirmaParameter, "inhalt">): FirmaAnsprechpartner {
  const kz = String(par.inhalt?.ansprechpartner || "justin");
  const p = ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === kz) ?? ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === "justin")!;
  return {
    name: p.name, rolle: p.rolle, email: p.email, telefon: p.telefon,
    portrait: portraitUrl(p.kuerzel), portraitHinweis: portraitMitKi(p.kuerzel) ? KI_PORTRAIT_HINWEIS.de : "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE GARANTIE — EINE QUELLE
// Jeder Satz mit „garant…“ steht hier (oder in FIRMA_GARANTIE_FEST). Der Prüfstand nimmt genau diese
// Sätze vor der Wortwand heraus; jedes andere „garant…“ in Seite, Vertrag oder Anlage bleibt rot.
// ═══════════════════════════════════════════════════════════════════════════
export function firmaGarantie(par: Pick<FirmaParameter, "kapitalUsd" | "garantieMonate" | "startCents" | "erstattungTage" | "weitereRundenAbMonaten"> & { inhalt?: FirmaInhalt }) {
  const usd = firmaUsd(par.kapitalUsd);
  const usdKurz = firmaUsdKurz(par.kapitalUsd);
  const frist = monatenWort(par.garantieMonate);
  const gruendung = firmaEur(par.startCents);
  const gruendungKurz = firmaEurKurz(par.startCents);
  // Die Unterlagen der Bürgschaft (Ziffer 8 Absatz 4) — Titel aus den Angebotsdaten bzw. der allgemeinen Bedingung, nie fest im Code.
  const unterlagen = firmaBedingungen({ inhalt: par.inhalt ?? {} }).map((b) => b.titel);
  const unterlagenText = unterlagen.length ? unterlagen.join(" und ") : "die Unterlagen der Bürgschaft";
  /**
   * Justins Satz (Runde 2, 08.10.2026, Punkt 3) — wörtlich, ohne Verstärker. Er steht auf der Seite an erster Stelle (Hero und Kapital).
   * Seit Fassung D (Runde 3, Punkt 4) sagt Ziffer 7 dasselbe: garantiert ist die Auszahlung — eine bloße Zusage genügt nicht.
   */
  const satz = `Vertraglich garantiert nach Ziffer 7: eine erste Runde über ${usdKurz} für Ihre Gesellschaft. Auszahlung innerhalb von ${frist} nach Annahme.`;
  return {
    // ── Vertrag (Vertragssprache) ──
    vertragTitel: "Erste Finanzierungsrunde und Garantie",
    // Fassung C: Frist ab der Annahme; Empfängerin ist die US-Gesellschaft der Auftraggeberin (Ziffer 1 Absatz 3).
    // Fassung D (Runde 3, Punkt 4): garantiert ist die AUSZAHLUNG innerhalb der Frist — eine Zusage allein genügt nicht mehr.
    vertragGarantie: `FIAON garantiert der Auftraggeberin, dass an die US-Gesellschaft der Auftraggeberin (Ziffer 1 Absatz 3) innerhalb von ${frist} nach dem Tag, an dem die Auftraggeberin diesen Vertrag angenommen hat (Tag der Annahme), eine erste Finanzierungsrunde über ${usd} ausgezahlt wird (erste Runde). Empfängerin der Auszahlung ist allein die US-Gesellschaft.`,
    vertragErhalten: `Ausgezahlt ist die erste Runde, wenn ein Institut der US-Gesellschaft Finanzierungsmittel von insgesamt mindestens ${usd} ausgezahlt hat, gleich ob in einem Betrag oder in Teilbeträgen; eine Zusage allein genügt nicht. Beträge in anderer Währung werden zum Referenzkurs der Europäischen Zentralbank am Tag der jeweiligen Auszahlung umgerechnet. Institute sind Banken und gewerbliche Finanzierer, die nicht mit FIAON verbunden sind; die Bürgin nach Ziffer 8 ist kein Institut. Lehnt die Auftraggeberin oder die US-Gesellschaft eine ihr angebotene erste Runde ab, gilt die Garantie als erfüllt. Als angeboten gilt eine erste Runde nur, wenn ein Institut sie der US-Gesellschaft in Textform zu marktüblichen Bedingungen anbietet und dafür keine persönliche Haftung der Gesellschafter oder der Geschäftsführung der Auftraggeberin verlangt.`,
    vertragBeginn: "Die Frist der Garantie beginnt mit dem Tag der Annahme; sie hängt nicht davon ab, wann die Bedingungen der Bürgschaft nach Ziffer 8 Absatz 4 erfüllt sind. FIAON teilt der Auftraggeberin Beginn und Ende der Frist in Textform mit.",
    vertragRuhen: `Die Frist ruht nur, solange die Auftraggeberin eine Mitwirkung nach Ziffer 15 — insbesondere die Unterlagen für die Bedingungen nach Ziffer 8 Absatz 4 —, die FIAON für die erste Runde in Textform mit einer Frist von mindestens ${tagenWort(FIRMA_AUFFORDERUNG_TAGE)} angefordert hat, nach Ablauf dieser Aufforderungsfrist schuldhaft nicht erbringt, und zwar vom Ablauf der Aufforderungsfrist an, bis die Mitwirkung erbracht ist; FIAON teilt das neue Fristende in Textform mit. Verzögerungen bei Instituten, Behörden, der Bürgin oder Partnern von FIAON lassen die Frist weiterlaufen.`,
    vertragFolge: `Wird die erste Runde nicht innerhalb der Frist an die US-Gesellschaft ausgezahlt, erstattet FIAON der Auftraggeberin die gezahlte Vergütung für die Gründung (${gruendung}) vollständig, ohne Abzug und ohne dass es einer Aufforderung bedarf, binnen ${tagenWort(par.erstattungTage)} nach Fristende auf das Konto, von dem gezahlt wurde. Diese Erstattung ist die abschließende Folge der Garantie: Weitergehende Ansprüche aus der Garantie, insbesondere auf Schadensersatz, entgangenen Gewinn oder Kosten einer anderen Finanzierung, bestehen nicht. Die übrigen Vereinbarungen dieses Vertrags bleiben unberührt.`,
    vertragWeitere: `Weitere Finanzierungsrunden sind frühestens ${monateWort(par.weitereRundenAbMonaten)} nach der ersten Runde möglich; jede braucht eine neue Freigabe der Bürgin. Für weitere Runden gilt die Garantie nach Absatz 1 nicht.`,
    vertragInstitut: "Den Finanzierungsvertrag schließt die US-Gesellschaft selbst mit dem Institut. FIAON ist keine Bank und kein Kreditgeber, nimmt keine Kundengelder entgegen und verfügt nicht über Konten der Auftraggeberin oder der US-Gesellschaft. FIAON bereitet die Unterlagen der ersten Runde vollständig vor und begleitet sie bis zur Auszahlung; die Garantie nach Absatz 1 gilt unabhängig davon, aus welchem Grund ein Institut einen Antrag ablehnt.",
    vertragHaftung: "Für Entscheidungen von Instituten über die erste Runde gilt allein die Garantie nach Ziffer 7 mit der Erstattung nach Ziffer 7 Absatz 5.",
    vertragMitwirkung: "Verzögert sich eine Mitwirkung, verschieben sich vereinbarte Termine entsprechend; für die Frist der Garantie gilt allein Ziffer 7 Absatz 4.",
    vertragKuendigung: "Endet dieser Vertrag vor dem Ende der Frist der Garantie durch eine Kündigung aus wichtigem Grund — durch die Auftraggeberin, ohne dass FIAON dafür einen wichtigen Grund gegeben hat, oder durch FIAON aus einem wichtigen Grund, den die Auftraggeberin zu vertreten hat —, entfällt die Garantie nach Ziffer 7. Eine ordentliche Kündigung nach Absatz 2 lässt die Garantie unberührt.",
    anlage1Bezug: "Für die erste Runde gilt die Garantie der FIAON LTD nach Ziffer 7 des Vertrags; diese Zusage selbst schuldet die Abgabe der Bürgschaft nach ihren Bedingungen.",
    // ── Seite und Übersicht (Ansprache) — nie mehr als Ziffer 7: Frist ab Annahme, Ruhen bei fehlender Mitwirkung, sonst Erstattung ──
    satz,
    nutzenKapital: satz,
    // Runde 3 (Punkt 2): Im Kapital steht kein Betrag der Gründungskosten — nur, dass sie erstattet werden. Satz 3 klappt auf.
    kapital: [
      satz,
      "Kommt die Auszahlung nicht rechtzeitig, erstatten wir Ihnen die Gründungskosten vollständig — das ist die Folge der Garantie. Über die Konditionen der Finanzierung entscheidet das Institut.",
      `Ihre Mitwirkung: ${unterlagenText}. Fehlen diese Unterlagen trotz schriftlicher Aufforderung mit mindestens ${tagenWort(FIRMA_AUFFORDERUNG_TAGE)} Zeit, ruht die Frist, bis sie da sind — nie wegen Instituten, Behörden oder uns. Lehnen Sie eine Runde ab, die Ihnen ein Institut schriftlich zu marktüblichen Bedingungen und ohne persönliche Haftung anbietet, gilt die Garantie als erfüllt.`,
    ],
    leistungKapital: `Eine erste Runde über ${usdKurz} für Ihre US-Gesellschaft — die Bürgin steht dafür ein, wir begleiten sie bis zur Auszahlung.`,
    phaseKapital: `Ab Ihrer Annahme läuft die Frist nach Ziffer 7: Auszahlung einer ersten Runde über ${usdKurz} an Ihre US-Gesellschaft innerhalb von ${frist}.`,
    investGruendung: `Und wird die erste Runde nicht innerhalb von ${frist} nach Ihrer Annahme ausgezahlt, erhalten Sie die Gründungskosten zurück — so steht es in Ihrer Garantie nach Ziffer 7.`,
    uebersicht: `Erste Runde über ${usd} für Ihre US-Gesellschaft — Auszahlung garantiert nach Ziffer 7 innerhalb von ${frist} nach Annahme; sonst Erstattung der Gründungskosten (${gruendung}). Fehlen die Unterlagen der Bürgschaft trotz Aufforderung, ruht die Frist.`,
    annahmeUnterKnopf: `Mit Ihrer Annahme beginnt die Frist der Garantie nach Ziffer 7 — wird die erste Runde nicht innerhalb von ${frist} ausgezahlt, erhalten Sie die Gründungskosten zurück.`,
    // Runde 3 (Punkt 3): sichtbare Antworten höchstens zwei Sätze.
    frageSicher: [
      `Vertraglich garantiert nach Ziffer 7: Ab Ihrer Annahme garantieren wir die Auszahlung einer ersten Runde über ${usd} an Ihre US-Gesellschaft innerhalb von ${frist} — die Bürgin steht dem Institut gegenüber ein. Kommt die Auszahlung nicht rechtzeitig, erstatten wir Ihnen die Gründungskosten über ${gruendungKurz} vollständig.`,
    ],
    frageSicherMehr: `Über die Finanzierung und ihre Konditionen entscheidet das Institut. Lehnen Sie eine Runde ab, die Ihnen ein Institut schriftlich zu marktüblichen Bedingungen und ohne persönliche Haftung anbietet, gilt die Garantie als erfüllt; fehlen Ihre Unterlagen für die Bürgschaft trotz Aufforderung, ruht die Frist.`,
    bedingungenSub: "Diese Unterlagen machen die Bürgschaft wirksam. Fehlen sie trotz schriftlicher Aufforderung, ruht die Frist Ihrer Garantie, bis sie da sind.",
    frageBedingungen: "Es sind Unterlagen, die Sie haben oder schnell bekommen. Erfüllt ist eine Bedingung, wenn Sie die Unterlage vorgelegt haben; den Tag bestätigen wir Ihnen binnen vierzehn Tagen schriftlich. Die Frist Ihrer Garantie läuft ab der Annahme — fehlen die Unterlagen trotz Aufforderung, ruht sie, bis sie da sind.",
    frageRotTitel: ["Warum steht ein Bereich auf Rot — und gilt die Garantie trotzdem?", "Warum stehen Bereiche auf Rot — und gilt die Garantie trotzdem?"],
    frageRot: "Ja. Ihre Garantie nach Ziffer 7 hängt nicht an der Ampel von heute: Ihre Frist läuft ab der Annahme — wird die erste Runde nicht rechtzeitig ausgezahlt, erstatten wir Ihnen die Gründungskosten.",
  };
}
/** Garantie-Sätze ohne Parameter — dieselbe Regel wie firmaGarantie. */
export const FIRMA_GARANTIE_FEST = {
  fertigFuss: "Ihre Garantie nach Ziffer 7 läuft ab heute: Wird die erste Runde nicht rechtzeitig ausgezahlt, erstatten wir Ihnen die Gründungskosten. Fragen? Schreiben Sie uns an support@fiaon.com.",
  metaBeschreibung: "Persönliches Angebot von FIAON Global für Ihr Unternehmen: eigene US-Gesellschaft, eine erste Finanzierungsrunde, garantiert nach Ziffer 7 ab Annahme, und ein ganzes Team für Ihr Wachstum.",
} as const;
/** Kurze Etiketten, die als Ganzes „Garantie“ tragen — der Prüfstand nimmt sie mit heraus. */
export const FIRMA_GARANTIE_ETIKETTEN = ["Ihre Garantie", "Garantie erfüllt", "Garantiefall"] as const;

// ═══════════════════════════════════════════════════════════════════════════
// BÜRGSCHAFT: DIE BEDINGUNGEN (Seite, Vertrag Ziffer 8, Anlage 1)
// Justin (07.10.2026 abends, seine Entscheidung): wenige aufschiebende Bedingungen, keine Sicherheiten (Seite, Vertrag,
// Anlage 1, Fragen). Das Prüfrecht der Umsatzbeteiligung (Ziffer 11 Absatz 7) ist keine Bedingung.
// E-242 (Repo öffentlich): Hier steht nur die ALLGEMEINE Bedingung (Jahresabschlüsse). Eine Bedingung, die zur Lage einer
// bestimmten Kundin gehört, ist ein Kundendatum — sie steht in den Angebotsdaten (parameter.inhalt.bedingungen, private
// Datei → scripts/angebot-firma-anlegen.ts → Datenbank) und kommt VOR den allgemeinen in die Liste. So bleiben Wortlaut
// und Reihenfolge im Vertrag gleich, und kein Kundenmerkmal steht im Code.
// ═══════════════════════════════════════════════════════════════════════════
export interface FirmaBedingung { schluessel: string; vertrag: string; titel: string; warum: string }
export const FIRMA_BEDINGUNGEN: readonly FirmaBedingung[] = [
  { schluessel: "jahresabschluesse", vertrag: "die Jahresabschlüsse der Auftraggeberin für die letzten zwei Geschäftsjahre",
    titel: "Jahresabschlüsse der letzten zwei Jahre", warum: "Sie zeigen, wie Ihr Unternehmen wirtschaftet — und sind die Grundlage, auf der jedes Institut über eine Finanzierung entscheidet." },
];
const BEDINGUNG_SCHLUESSEL = /^[a-z0-9][a-z0-9-]{1,39}$/;
const BEDINGUNG_LAENGE = { vertrag: 400, titel: 120, warum: 600 } as const;
/** Ist dieser Eintrag eine gültige Bedingung aus den Angebotsdaten? (nur Texte, nichts leer, Längen begrenzt) */
function bedingungOk(b: any): b is FirmaBedingung {
  return !!b && typeof b === "object" && BEDINGUNG_SCHLUESSEL.test(String(b.schluessel ?? ""))
    && (["vertrag", "titel", "warum"] as const).every((f) => typeof b[f] === "string" && b[f].trim().length > 0 && b[f].length <= BEDINGUNG_LAENGE[f]);
}
/** Die Bedingungen aus den Angebotsdaten — nur gültige, jeder Schlüssel einmal, Texte getrimmt. */
export function firmaBedingungenAusInhalt(roh: unknown): FirmaBedingung[] {
  if (!Array.isArray(roh)) return [];
  const gesehen = new Set<string>(); const aus: FirmaBedingung[] = [];
  for (const b of roh) {
    if (!bedingungOk(b) || gesehen.has(b.schluessel)) continue;
    gesehen.add(b.schluessel);
    aus.push({ schluessel: b.schluessel, vertrag: b.vertrag.trim(), titel: b.titel.trim(), warum: b.warum.trim() });
  }
  return aus;
}
/** Bedingungen der Bürgschaft: zuerst die aus den Angebotsdaten, dann die allgemeinen (ohne Doppel), ohne die abgewählten. */
export function firmaBedingungen(par: Pick<FirmaParameter, "inhalt">): FirmaBedingung[] {
  const aus = new Set((par.inhalt?.bedingungenAus ?? []).map(String));
  const eigene = firmaBedingungenAusInhalt(par.inhalt?.bedingungen);
  const schon = new Set(eigene.map((b) => b.schluessel));
  return [...eigene, ...FIRMA_BEDINGUNGEN.filter((b) => !schon.has(b.schluessel))].filter((b) => !aus.has(b.schluessel));
}
/** Die Sonderfreigabe aus den Parametern — oder null, wenn sie nicht erscheint. */
export function firmaSonderfreigabe(par: Pick<FirmaParameter, "inhalt">, b: Pick<AngebotBuergin, "vertreter">): FirmaSonderfreigabe | null {
  const s = par.inhalt?.sonderfreigabe;
  if (!s || !s.aktiv || !String(s.text || "").trim()) return null;
  return {
    titel: "Sonderfreigabe der Geschäftsleitung",
    text: String(s.text).trim(),
    unterzeichner: String(s.unterzeichner || b.vertreter || FIAON_FIRMA.director),
    funktion: String(s.funktion || "Director der FIAON LTD · Manager der Schwarzott Global LLC"),
    datum: s.datum && ISO.test(s.datum) ? s.datum : "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE — spricht die Kundin an („Sie“, „wir“)
// ═══════════════════════════════════════════════════════════════════════════
const ZIELE_VORGABE = [
  { titel: "Mehr Kapazität", text: "Neue Maschinen, mehr Fläche, mehr Menge — in der Qualität, für die man Ihr Unternehmen kennt." },
  { titel: "Neue Märkte", text: "Mit Ihrer eigenen US-Gesellschaft der Weg in die USA — und neue Handelswege in Europa." },
  { titel: "Ein Auftritt, der verkauft", text: "Shop, Plattform, Social Media und Partner, die Ihre Produkte in die Welt tragen." },
];

function bild(par: Pick<FirmaParameter, "inhalt">, schluessel: string): BildRef | undefined {
  const b = par.inhalt?.bilder?.[schluessel];
  return b && typeof b === "object" && b.src ? b : undefined;
}

/**
 * Die Etappen des Zeitstrahls. Runde 2 (Justin 08.10.2026, Punkt 4): keine Fotos im Zeitstrahl — „Aufbau“ trägt eine eigene
 * Animation (illustration), die anderen Etappen stehen als Text. Weil die Frist der ersten Runde seit Fassung C ab der Annahme
 * läuft, steht „Erste Runde“ vor dem Strategietag (Reihenfolge = Zeit).
 */
export function firmaPhasen(d: Pick<FirmaDaten, "parameter">): FirmaPhase[] {
  const par = d.parameter; const G = firmaGarantie(par);
  const zusatz = (nr: number) => { const z = par.inhalt?.phasenZusatz?.[String(nr)]; return z ? ` ${String(z).trim()}` : ""; };
  const liste: FirmaPhase[] = [
    { nr: 0, titel: "Start & Prüfung", dauer: "zum Start", abzeichen: "Start",
      text: "Sie nehmen an, wir legen los — Startgespräch, Unterlagen und die Nachweise für die Bürgschaft." },
    { nr: 1, titel: "Ihre US-Gesellschaft", dauer: "in den ersten Wochen",
      text: "Gründung, EIN, US-Konto und Office mit Empfang in Miami — wir erledigen jeden Schritt, Sie unterschreiben." },
    { nr: 2, titel: "Aufbau", dauer: "die ersten zwölf Monate", illustration: "aufbau",
      text: `Ihr Shop entsteht mit Website, SEO und Social Media — ab dem Starttag („Shop live“, spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Ihrer Annahme) beginnt unser gemeinsames Wachstumsbudget.` },
    { nr: 3, titel: "Erste Runde", dauer: `innerhalb von ${monatenWort(par.garantieMonate)} nach Annahme`, abzeichen: "Kapital",
      text: G.phaseKapital },
    { nr: 4, titel: "Strategietag vor Ort", dauer: "im ersten Halbjahr",
      text: "Ein Tag in Ihrem Betrieb, an dem wir den Plan für Kapital, Kapazität und Märkte gemeinsam festlegen." },
    { nr: 5, titel: "Skalierung", dauer: "ab der ersten Runde",
      text: "Vertrieb, Influencer, Messen und neue Handelswege — damit aus Kapazität Umsatz wird." },
    { nr: 6, titel: "Weitere Runden", dauer: `frühestens nach ${monatenWort(par.weitereRundenAbMonaten)}`,
      text: "Wächst Ihr Unternehmen nach Plan, öffnen wir weitere Runden — jede mit eigener Freigabe." },
  ];
  return liste.map((ph) => ({ ...ph, text: ph.text + zusatz(ph.nr) }));
}

export function firmaLeistungen(d: Pick<FirmaDaten, "parameter" | "buergin">): FirmaLeistung[] {
  const par = d.parameter; const G = firmaGarantie(par); const ap = firmaAnsprechpartner(par);
  // Runde 3 (Punkt 3): je Karte ein Satz und höchstens drei Punkte sichtbar — der Rest steht unter „Mehr erfahren“ (mehr).
  const liste: FirmaLeistung[] = [
    // Runde 2, Punkt 2: Justins Untertitel wörtlich, die Punkte passend dazu.
    { schluessel: "gesellschaft", titel: "Ihre US-Gesellschaft — komplett",
      text: "Ihre US-Gesellschaft komplett — mit Office, Empfangsdame, Telefonannahme, rechtlichen Unterlagen, Dokumenten und einem direkten Ansprechpartner für Sie",
      punkte: [
        "Office in Miami mit Geschäftsadresse — besetzt, mit Empfangsdame",
        "Telefonannahme unter Ihrer US-Nummer während der Geschäftszeiten",
        "Rechtliche Unterlagen und alle Dokumente geordnet in einem Dokumentenraum",
      ],
      mehr: [
        "Gründung und Eintragung, Operating Agreement, Gründungsbeschlüsse, EIN und, soweit nötig, ITIN",
        "Pflichtenkalender mit allen US-Fristen",
        "Ein direkter Ansprechpartner für Sie und Ihre US-Gesellschaft",
        "US-Bankkonto vorbereitet und begleitet; Beantragung von US-Firmenkarten begleiten — die Herausgeber entscheiden",
        "FDA-U.S.-Agent und Registered Agent, Anwalt und Steuerberater, jährliche US-Steuererklärung",
      ] },
    { schluessel: "kapital", titel: "Kapital für Ihr Wachstum", text: G.leistungKapital,
      punkte: [
        `Erste Runde: ${firmaUsd(par.kapitalUsd)}`,
        `Bürgin: ${d.buergin.name} — ohne gesondertes Entgelt`,
        "Vorgesehen: eine Auszahlung in einem Betrag",
      ],
      mehr: [
        `Höchstbetrag der Bürgschaft: ${firmaUsd(par.buergschaftUsd)}`,
        `Weitere Runden frühestens nach ${monatenWort(par.weitereRundenAbMonaten)}`,
      ] },
    { schluessel: "strategie", titel: "Strategie & Wachstum",
      text: "Betriebswirtschaftliche Begleitung an Ihrer Seite — für mehr Menge, neue Märkte und gesunde Zahlen.",
      punkte: ["Skalierung und Kapazitätsplanung", "Einkauf und Preise", "Ein Strategietag bei Ihnen vor Ort"],
      mehr: ["Mittelverwendungsplan und Kennzahlen"] },
    { schluessel: "plattform", titel: "Plattform & Marketing",
      text: "Ihr Shop ist der größte Hebel — wir entwickeln ihn und bringen Menschen dorthin, die kaufen.",
      punkte: ["Entwicklung von Shop und Plattform", "Website, SEO und Anzeigen (SEA)", "Social Media und Influencer-Kampagnen"],
      mehr: ["Backlinks und PR-Platzierungen", "Beiträge, Texte und Design für Social Media", "Influencer: Auswahl, Planung, Steuerung"] },
    { schluessel: "vertrieb", titel: "Vertrieb",
      text: "Wir verkaufen mit — neue Handelswege, Gespräche, Messen.",
      punkte: ["Aktive Mitarbeit im Verkauf", "Neue Handelswege im In- und Ausland", "Messen: Auswahl, Vorbereitung, Begleitung"] },
    { schluessel: "ansprechpartner", titel: "Ein fester Ansprechpartner",
      text: `${ap.name} kennt Ihren Auftrag von Anfang an und ist Ihr direkter Draht für jede Frage.`,
      punkte: ["Direkt per E-Mail und Telefon", "Ein monatlicher Durchgang mit Ihnen", "Ein ganzes Team dahinter"] },
  ];
  // Runde 2, Punkt 5: keine Fotos auf den Karten — jede trägt ihre eigene Linien-Illustration (Oberfläche, nach schluessel).
  return liste;
}

export function firmaInvestPosten(d: Pick<FirmaDaten, "parameter" | "compliance">): FirmaInvestPosten[] {
  const par = d.parameter; const G = firmaGarantie(par);
  const schwelle = firmaEurKurz(par.umsatzSchwelleCents);
  const offenePunkte = d.compliance && d.compliance.gesamt.ampel !== "GRÜN";
  const spaetestens = monateWort(par.budgetSpaetestensMonate);
  return [
    // Runde 2, Punkt 7: positiv und klar — Justins Aussage vom 08.10.2026 als Satz, die Bestandteile ohne Einzelbeträge.
    // Runde 3, Punkt 2: keine große Karte mehr — eine ruhige Zeile (satz) am Ende der Konditionen, Bestandteile nur aufklappbar.
    { schluessel: "gruendung", titel: "Gründungskosten", betrag: firmaEurKurz(par.startCents), einheit: "einmalig",
      satz: `Einmalige Gründungskosten ${firmaEurKurz(par.startCents)} — wir verdienen daran nichts; sie decken Gründung und Start.`,
      hinweis: "Wir verdienen an den Gründungskosten nichts — sie decken ausschließlich, was Gründung und Start kosten.",
      bestandteile: [...FIRMA_GRUENDUNG_BESTANDTEILE],
      was: "Ihre US-Gesellschaft, gegründet und startklar — einmal bezahlt, danach gehört sie Ihnen.",
      wann: "Einmalig, fällig mit der Annahme. Die Rechnung steht direkt danach für Sie bereit.",
      warum: `Gründung und Start kosten Geld bei Behörden, Anwalt, Steuerberater und Banken — genau das decken die Gründungskosten, nicht mehr. ${G.investGruendung}`,
      wie: "Überweisung auf Rechnung, ohne Umsatzsteuer (Reverse Charge)." },
    // Runde 2, Punkt 8: statt „Plattform & Team“ das gemeinsame Wachstumsbudget — die Hälfte trägt FIAON.
    { schluessel: "monat", titel: "Gemeinsames Wachstumsbudget", betrag: firmaEurKurz(par.monatCents), einheit: `Ihr Anteil pro Monat — die Hälfte von ${firmaEurKurz(par.budgetGesamtCents)}`,
      // Runde 3, Punkt 5: der späteste Start in einem Satz (Ziffer 10 Absatz 2).
      satz: `Die Hälfte eines gemeinsamen Budgets von ${firmaEurKurz(par.budgetGesamtCents)} im Monat — ab „Shop live“, spätestens ${spaetestens} nach Ihrer Annahme, es sei denn, die Verzögerung liegt bei uns.`,
      was: `Ein gemeinsames Budget von ${firmaEurKurz(par.budgetGesamtCents)} im Monat für Anzeigen, Inhalte, Ihre US-Gesellschaft, PR, Software, Shop, Technik und Recht. Sie tragen die Hälfte, wir die andere — Sie zahlen nicht für Personal.`,
      wann: `Erst wenn Ihr Shop live ist — spätestens ${spaetestens} nach Ihrer Annahme, es sei denn, die Verzögerung liegt bei uns: Die erste Monatsrechnung kommt an diesem Tag, danach monatlich im Voraus, Zahlungsziel ${zahlwort(par.zahlungszielTage)} Tage.`,
      warum: "Wachstum braucht jeden Monat Reichweite und Werkzeuge. Weil wir die Hälfte selbst tragen, ziehen wir am selben Strang — jeder Euro geht in Ihr Wachstum.",
      wie: `Mindestlaufzeit ${monateWort(par.mindestMonate)} ab dem Starttag („Shop live“, spätestens ${spaetestens} nach Ihrer Annahme), danach jeweils ${monateWort(par.verlaengerungMonate)} mehr, wenn Sie nicht ${monateWort(par.kuendigungMonate)} vor Ablauf in Textform kündigen.` },
    { schluessel: "umsatz", titel: "Umsatzbeteiligung", betrag: firmaProzent(par.umsatzSatzProzent), einheit: `auf den Netto-Umsatz über ${schwelle} im Jahr`,
      satz: `Nur auf den Teil Ihres Netto-Jahresumsatzes über ${schwelle} — kein Wachstum über die Schwelle, keine Beteiligung.`,
      was: `${zahlwort(par.umsatzSatzProzent).replace(/^./, (c) => c.toUpperCase())} Prozent auf den Teil Ihres Netto-Jahresumsatzes, der über ${schwelle} liegt — gerechnet über Ihr Unternehmen, Ihre US-Gesellschaft und künftige verbundene Gesellschaften, ohne Umsätze untereinander.`,
      wann: "Quartalsweise: Sie melden bis zum 15. des Folgemonats den bisherigen Jahresumsatz aus Ihrer Umsatzsteuervoranmeldung; einmal im Jahr gleichen wir mit dem Jahresabschluss ab. Im ersten Jahr zählen nur die Umsätze ab Ihrem Startmonat, und die Schwelle gilt anteilig.",
      warum: offenePunkte
        ? "Ein ganzes Team, Plattform und Vertrieb tragen Ihr Wachstum mit. Weil Ihr Prüfbericht noch offene Punkte zeigt, verzichten wir auf einen hohen Festpreis und verdienen nur, wenn Sie wachsen."
        : "Ein ganzes Team, Plattform und Vertrieb tragen Ihr Wachstum mit. Statt eines hohen Festpreises verdienen wir nur, wenn Sie wachsen.",
      wie: "Kein Wachstum über die Schwelle — keine Beteiligung. Sie läuft, solange der Vertrag läuft oder die Bürgschaft besteht, und endet bei einem Verkauf." },
    { schluessel: "verkauf", titel: "Verkaufsbeteiligung", betrag: firmaProzent(par.verkaufSatzProzent), einheit: "nur bei einem Verkauf",
      satz: "Nur wenn Sie verkaufen — fällig erst, wenn der Kaufpreis bei Ihnen ist; einen Verkaufszwang gibt es nicht.",
      was: `${zahlwort(par.verkaufSatzProzent).replace(/^./, (c) => c.toUpperCase())} Prozent der Gegenleistung, wenn Anteile Ihres Unternehmens oder Ihrer US-Gesellschaft, Ihre Marke oder Ihr Betrieb verkauft werden — bei einem Teilverkauf auf den Preis des verkauften Teils.`,
      wann: `Mit dem Zufluss des Kaufpreises — während der Laufzeit und ${monateWort(par.verkaufNachlaufMonate)} danach.`,
      warum: "Wir bauen mit Ihnen Wert auf. Sie kostet nur etwas, wenn Sie verkaufen — und dann haben Sie das Geld.",
      wie: "Kein Verkaufszwang: Ob und wann Sie verkaufen, entscheiden allein Sie. Nicht bei Übertragungen ohne Gegenleistung und nicht bei Kapitalerhöhungen." },
  ];
}

/** Woraus die Gründungskosten bestehen (Runde 2, Punkt 7) — ohne Einzelbeträge. */
export const FIRMA_GRUENDUNG_BESTANDTEILE: readonly string[] = [
  "Gründung und Eintragung", "EIN und ITIN", "Registered Agent", "Anwalt", "Steuerberater", "Bank- und Kontoeröffnung", "Unterlagen", "Behörden",
];

/**
 * Das gemeinsame Wachstumsbudget (Runde 2, Justin 08.10.2026, Punkt 8): Planwerte je Monat, zusammen 4.000 €. Dieselbe Aufstellung
 * steht auf der Seite und in Ziffer 10 Absatz 3. Weicht sie für ein Angebot ab, kommt sie aus parameter.inhalt.budgetPosten.
 */
export interface FirmaBudgetPosten { schluessel: string; titel: string; text?: string; cents: number }
export const FIRMA_BUDGET_POSTEN: readonly FirmaBudgetPosten[] = [
  { schluessel: "anzeigen", titel: "Werbebudget Anzeigen", text: "Google, Meta, Pinterest", cents: 150000 },
  { schluessel: "inhalte", titel: "Influencer-Kooperationen und Content-Produktion", text: "Foto, Video, Texte", cents: 60000 },
  { schluessel: "us-gesellschaft", titel: "US-Gesellschaft laufend", text: "Office Miami, Empfang und Telefonannahme, Registered Agent, US-Buchhaltung und Steuererklärung", cents: 60000 },
  { schluessel: "pr", titel: "Backlinks und PR-Platzierungen", cents: 40000 },
  { schluessel: "software", titel: "Marketing-Software", text: "SEO-Werkzeuge, E-Mail-Marketing, Social-Planung, Design-Software", cents: 35000 },
  { schluessel: "shop", titel: "Shop-Plattform, Apps und Plugins", text: "Shop-Abo, Zahlung, Versand, Bewertungen, Übersetzung", cents: 25000 },
  { schluessel: "technik", titel: "Server, Hosting, CDN, Domains und E-Mail", cents: 15000 },
  { schluessel: "recht", titel: "Recht und Compliance laufend", text: "Impressum, AGB, Datenschutz, Lebensmittel-Kennzeichnung", cents: 15000 },
];
export function firmaBudgetPosten(par: Pick<FirmaParameter, "inhalt">): FirmaBudgetPosten[] {
  const eigen = par.inhalt?.budgetPosten;
  return Array.isArray(eigen) && eigen.length ? eigen.map((x) => ({ schluessel: String(x.schluessel), titel: String(x.titel).trim(), text: x.text ? String(x.text).trim() : undefined, cents: Number(x.cents) })) : FIRMA_BUDGET_POSTEN.map((x) => ({ ...x }));
}
/** Eine Zeile der Aufstellung als Vertragstext: „Werbebudget Anzeigen (Google, Meta, Pinterest): 1.500,00 €“. */
function budgetZeileVertrag(x: FirmaBudgetPosten): string { return `${x.titel}${x.text ? ` (${x.text})` : ""}: ${firmaEur(x.cents)}`; }
export function firmaBudget(par: FirmaParameter): FirmaBudget {
  const fiaon = par.budgetGesamtCents - par.monatCents;
  return {
    titel: "Gemeinsames Wachstumsbudget",
    sub: `Kein Geld für Personal: ${firmaEurKurz(par.budgetGesamtCents)} im Monat gehen in Reichweite, Werkzeuge und Ihre US-Gesellschaft. Sie tragen die Hälfte, wir die andere.`,
    gesamt: firmaEurKurz(par.budgetGesamtCents), gesamtText: "gemeinsames Budget pro Monat",
    ihrAnteil: firmaEurKurz(par.monatCents), ihrAnteilText: "Ihr Anteil",
    fiaonAnteil: firmaEurKurz(fiaon), fiaonAnteilText: "trägt FIAON",
    start: `Beginnt erst, wenn Ihr Shop live ist — spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Ihrer Annahme, es sei denn, die Verzögerung liegt bei uns. Ab diesem Tag kommt die erste Monatsrechnung, und die Mindestlaufzeit von ${monatenWort(par.mindestMonate)} läuft.`,
    zeilen: firmaBudgetPosten(par).map((x) => ({ schluessel: x.schluessel, titel: x.titel, text: x.text ?? "", betrag: firmaEurKurz(x.cents), cents: x.cents })),
    summeText: "Planwerte je Monat",
    fein: [
      "Die Beträge sind Planwerte. Wie das Budget eingesetzt wurde, sehen Sie in unserem monatlichen Durchgang; Verschiebungen zwischen den Posten stimmen wir dort mit Ihnen ab.",
      "Mehr Werbebudget über das gemeinsame Budget hinaus nur nach Absprache — es steht in Ziffer 10 Absatz 6 Ihres Vertrags.",
    ],
  };
}

/** „1 Mio.“, „2,5 Mio.“ — die Beschriftung der Skala ab einer Million. */
function mioText(cents: number): string { return `${(cents / 100_000_000).toLocaleString("de-DE", { maximumFractionDigits: 1 })} Mio.`; }
/** Die Skala des Reglers: die Schwelle (voll ausgeschrieben) und jede volle Million bis zum Ende. */
function rechnerSkala(min: number, max: number): FirmaRechner["skala"] {
  const punkte: FirmaRechner["skala"] = [{ cents: min, text: firmaEurKurz(min), schwelle: true }];
  for (let m = Math.ceil((min + 1) / 100_000_000) * 100_000_000; m <= max; m += 100_000_000) punkte.push({ cents: m, text: mioText(m) });
  return punkte;
}
export function firmaRechner(par: FirmaParameter): FirmaRechner {
  const min = par.umsatzSchwelleCents; const max = Math.max(min * 5, min + 100_000_00);
  return {
    titel: "Was die Umsatzbeteiligung ausmacht",
    sub: "Ziehen Sie den Regler auf einen Netto-Jahresumsatz. Der Rechner nimmt nur Schwelle und Satz — keine Annahmen über Ihre Marge.",
    schwelleCents: par.umsatzSchwelleCents, satzProzent: par.umsatzSatzProzent,
    minCents: min, maxCents: max, schrittCents: 1_000_000, startCents: Math.min(max, min * 2),
    zahlTitel: "Beteiligung pro Jahr",
    zeileUmsatz: "Netto-Jahresumsatz",
    zeileBeteiligung: "bei {umsatz} Netto-Jahresumsatz — von jedem Euro über {schwelle} gehen {cent} Cent an uns.",
    zeileUnterSchwelle: "bei {umsatz} Netto-Jahresumsatz — bis {schwelle} im Jahr fällt keine Beteiligung an.",
    schwelleText: "Schwelle",
    skala: rechnerSkala(min, max),
  };
}

/**
 * Was die Auftraggeberin direkt zahlt — steht NUR im Vertrag (seit Fassung C Ziffer 10 Absatz 6). Justin (07.10.2026): nicht als
 * Liste auf der Seite; die Seite verweist auf die Ziffer. Runde 2: Werbebudget und Influencer stehen jetzt im gemeinsamen Budget —
 * hier nur, was darüber hinausgeht (Mehrbudget nach Absprache).
 */
export const FIRMA_EXTRA_VERTRAG: readonly string[] = [
  "Werbebudget für bezahlte Anzeigen über das gemeinsame Wachstumsbudget nach Absatz 3 hinaus (Mehrbudget nach Absprache)",
  "Honorare von Influencern über das gemeinsame Wachstumsbudget nach Absatz 3 hinaus",
  "Gebühren von Behörden und Markenämtern, soweit sie nicht die Gründung und den Bestand der US-Gesellschaft nach Ziffer 3 betreffen (etwa Markenanmeldungen, Produktregistrierungen und Zulassungen)",
  "Labortests",
  "Etikettendruck",
  "Lager und Logistik in den USA",
  "Reisekosten Dritter, einschließlich Standgebühren auf Messen",
];

export function firmaFragen(d: Pick<FirmaDaten, "parameter" | "buergin" | "kunde" | "compliance">): FirmaFrage[] {
  const par = d.parameter; const G = firmaGarantie(par);
  const schwelle = firmaEurKurz(par.umsatzSchwelleCents); const satz = firmaProzent(par.umsatzSatzProzent);
  const frau = d.kunde.vertretung?.anrede === "Frau"; const herr = d.kunde.vertretung?.anrede === "Herr";
  const gf = frau ? "Geschäftsführerin" : herr ? "Geschäftsführer" : "Geschäftsführung";
  const eigen = frau ? "Eigentümerin" : herr ? "Eigentümer" : "Eigentum";
  // „100 %“ nur, wenn die Vertretung laut Angebot allein beteiligt ist (Funktion aus der Datenbank) — sonst bleibt es bei „Ihre Anteile“.
  const allein = /Alleingesellschafter|Alleineigentümer/i.test(String(d.kunde.vertretung?.funktion ?? ""));
  const bedingungen = firmaBedingungen(par).map((b) => b.titel);
  const sf = firmaSonderfreigabe(par, d.buergin);
  const bsp = Math.max(par.umsatzSchwelleCents * 2, par.umsatzSchwelleCents + 100_000_00);
  // Die Ampel kommt aus dem Prüfbericht — nie fest im Text (beim nächsten Angebot kann sie Grün oder Rot sein).
  const ampel: Ampel = d.compliance?.gesamt.ampel ?? "GELB";
  const AW = COMPLIANCE_AMPEL[ampel];
  const rote = (d.compliance?.bereiche ?? []).filter((b) => b.ampel === "ROT");
  const offen = !!d.compliance && d.compliance.gesamt.ampel !== "GRÜN";
  // Runde 3 (Punkt 3): Die ersten FIRMA_FRAGEN_SICHTBAR Fragen stehen offen — je eine kurze Antwort (höchstens zwei Sätze).
  // Der Rest steht unter „Weitere Fragen“; dort dürfen die Antworten länger sein.
  return [
    { frage: "Was zahle ich wann?", antwort: [
      `Mit der Annahme einmalig die Gründungskosten über ${firmaEurKurz(par.startCents)}; Ihren Anteil am Wachstumsbudget — ${firmaEurKurz(par.monatCents)} im Monat, die Hälfte von ${firmaEurKurz(par.budgetGesamtCents)} — erst ab „Shop live“, spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Ihrer Annahme, es sei denn, die Verzögerung liegt bei uns. Umsatz- und Verkaufsbeteiligung fallen nur an, wenn Ihr Netto-Jahresumsatz über ${schwelle} liegt oder Sie verkaufen.`,
    ] },
    { frage: "Wie ist die erste Runde abgesichert?", antwort: [...G.frageSicher] },
    { frage: "Ist die erste Runde ein Kredit?", antwort: [
      "Ja, eine Finanzierung: Ihre US-Gesellschaft nimmt sie bei einem Institut auf und zahlt sie mit Zinsen aus dem Wachstum zurück, das sie möglich macht. Die Konditionen legt das Institut fest — Sie sehen sie vor der Unterschrift und entscheiden selbst.",
    ] },
    { frage: "Was steckt im gemeinsamen Wachstumsbudget?", antwort: [
      `${firmaEurKurz(par.budgetGesamtCents)} im Monat für Anzeigen, Inhalte, Ihre US-Gesellschaft, PR, Software, Shop, Technik und Recht — Sie tragen die Hälfte, wir die andere. Unsere Arbeit zahlen Sie nicht als Personal: Wir verdienen über die Beteiligungen, wenn Sie wachsen.`,
    ] },
    { frage: "Warum eine Umsatzbeteiligung?", antwort: [
      offen
        ? "Ein ganzes Team trägt Ihr Wachstum mit — statt eines hohen Festpreises verdienen wir mit, wenn es funktioniert. Gerade weil Ihr Prüfbericht offene Punkte zeigt, hängt unser größter Teil an Ihrem Erfolg."
        : "Ein ganzes Team trägt Ihr Wachstum mit — statt eines hohen Festpreises verdienen wir mit, wenn es funktioniert. Unser größter Teil hängt an Ihrem Erfolg, nicht an unserem Aufwand.",
    ] },
    { frage: "Was, wenn der Umsatz nicht wächst?", antwort: [
      `Dann zahlen Sie keine Umsatzbeteiligung — sie gilt nur für den Teil des Netto-Jahresumsatzes über ${schwelle}, im ersten Jahr anteilig. Ein Beispiel: Bei ${firmaEurKurz(bsp)} Netto-Jahresumsatz beträgt sie ${firmaEurKurz(rechnerBeteiligung(bsp, par.umsatzSchwelleCents, par.umsatzSatzProzent))} im Jahr (${satz} auf ${firmaEurKurz(bsp - par.umsatzSchwelleCents)}), unter der Schwelle null Euro.`,
    ] },
    { frage: frau || herr ? `Bleibe ich ${gf} und ${eigen}?` : "Bleiben Geschäftsführung und Eigentum bei mir?", antwort: [
      frau || herr
        ? `Ja. Sie bleiben ${gf} und ${allein ? `zu 100 % ${eigen}` : eigen} Ihrer Gesellschaft — FIAON erwirbt keine Anteile, übernimmt keine Geschäftsführung, und auch die US-Gesellschaft gehört Ihnen.`
        : `Ja. Geschäftsführung und ${allein ? "alle Anteile" : "Anteile"} Ihrer Gesellschaft bleiben, wie sie sind — FIAON erwirbt keine Anteile, übernimmt keine Geschäftsführung, und auch die US-Gesellschaft gehört Ihnen.`,
    ] },
    { frage: "Wie lange läuft der Vertrag, und wie kündige ich?", antwort: [
      `Mindestens ${monateWort(par.mindestMonate)} ab dem Starttag („Shop live“, spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Ihrer Annahme), danach jeweils ${monateWort(par.verlaengerungMonate)} mehr, wenn Sie nicht ${monateWort(par.kuendigungMonate)} vor Ablauf kündigen. Eine E-Mail an Ihren Ansprechpartner genügt — Ihre US-Gesellschaft, Ihr Shop und alle Unterlagen bleiben Ihre.`,
    ] },
    // ── Weitere Fragen ──
    { frage: "Muss ich verkaufen?", antwort: [
      "Nein. Es gibt keinen Verkaufszwang und keine Pflicht, einen Verkauf vorzubereiten. Ob und wann Sie verkaufen, entscheiden allein Sie.",
      `Verkaufen Sie während der Laufzeit oder ${monateWort(par.verkaufNachlaufMonate)} danach Anteile, Marke oder Betrieb, erhalten wir ${firmaProzent(par.verkaufSatzProzent)} der Gegenleistung — fällig erst, wenn der Kaufpreis bei Ihnen eingegangen ist.`,
    ] },
    { frage: "Was gilt, wenn ich eine angebotene Runde ablehne?", antwort: [G.frageSicherMehr] },
    { frage: "Welche Bedingungen hat die Bürgschaft — und warum?", antwort: [
      `Die Bürgschaft der ${d.buergin.name} über ${firmaUsd(par.buergschaftUsd)} wird wirksam, sobald ${bedingungen.length === 1 ? "diese Bedingung erfüllt ist" : `diese ${zahlwort(bedingungen.length)} Bedingungen erfüllt sind`}: ${bedingungen.join(" und ")}.`,
      `${bedingungen.length === 1 ? "Sie macht" : "Beides macht"} Ihr Unternehmen für Institute lesbar. Die Gründe stehen oben unter „Ihr Kapital“ bei jeder Bedingung.`,
      G.frageBedingungen,
    ] },
    { frage: sf ? `Was heißt Sonderfreigabe — und warum steht im Prüfbericht ${AW.wort}?` : `Was heißt ${AW.wort} im Prüfbericht?`, antwort: [
      ampel === "GRÜN"
        ? "Grün heißt im Prüfbericht: unauffällig."
        : `${AW.wort} heißt im Prüfbericht: ${AW.satz}. Es ist eine Liste dessen, was vor einer Finanzierung geklärt sein muss.`,
      sf
        ? `Die Geschäftsleitung hat die Bürgschaft trotz offener Punkte freigegeben — das ist die Sonderfreigabe, unterzeichnet von ${sf.unterzeichner}. Für die Bürgschaft zählen allein die Bedingungen in Ziffer 8 Ihres Vertrags: ${bedingungen.join(" und ")}.`
        : `Für die Bürgschaft zählen allein die Bedingungen in Ziffer 8 Ihres Vertrags: ${bedingungen.join(" und ")}. Sind sie erfüllt, wird die Bürgschaft wirksam.`,
    ] },
    ...(rote.length ? [{ frage: G.frageRotTitel[rote.length === 1 ? 0 : 1], antwort: [
      `${rote.map((b) => `„${b.titel}“`).join(" und ")}: ${rote.length === 1 ? "Der Bereich zeigt" : "Die Bereiche zeigen"} den Stand vor dem Vertrag — mit den Zahlen, die heute öffentlich sind. Für die Bürgschaft zählen allein die Bedingungen in Ziffer 8 Ihres Vertrags: ${bedingungen.join(" und ")}.`,
      G.frageRot,
    ] }] : []),
    { frage: "Gehört die US-Gesellschaft mir?", antwort: [
      "Ja. Gesellschafterin der US-Gesellschaft wird Ihr Unternehmen — oder, wenn Sie das vor der Gründung bestimmen, Sie persönlich. FIAON erwirbt keine Anteile.",
      `Auch Shop, Website, Texte und Designs gehören Ihnen: Die Rechte gehen mit der Zahlung Ihres Monatsanteils auf Sie über — was vor dem Starttag („Shop live“, spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Ihrer Annahme) entsteht, mit dem ersten Anteil.`,
    ] },
    { frage: "Was muss ich selbst tun?", antwort: [
      "Wenig: Unterlagen bereitstellen, unterschreiben, was wir fertig vorbereiten, Ihre Ausweise für die gesetzlich vorgeschriebene Identifizierung — und einmal im Quartal Ihre Umsatzzahlen aus der Umsatzsteuervoranmeldung schicken.",
      "Alles Weitere — Behörden, Partner, Anträge, Plattform, Kampagnen — übernehmen wir.",
    ] },
    { frage: "Wie kommen die Rechnungen — und was ist mit der Umsatzsteuer?", antwort: [
      `Jede Rechnung geht an Ihr Unternehmen, mit Firma, Anschrift und UID — Zahlungsziel ${zahlwort(par.zahlungszielTage)} Tage, per Überweisung, keine Lastschrift.`,
      "Unsere Rechnungen weisen keine Umsatzsteuer aus: Die Leistungen kommen aus London an Ihr Unternehmen in der EU, die Steuer schuldet Ihr Unternehmen selbst (Reverse Charge). Wie Sie das in Ihrer Umsatzsteuervoranmeldung erfassen, klärt Ihr Steuerberater.",
    ] },
    { frage: "Was zahle ich direkt an Dritte?", antwort: [
      "Was nicht im Wachstumsbudget steckt, steht in Ziffer 10 Absatz 6 Ihres Vertrags — etwa mehr Werbebudget über das gemeinsame Budget hinaus, nur nach Absprache. Solche Kosten nennen wir vorab; beauftragt wird nur mit Ihrer Zustimmung.",
    ] },
    { frage: "Wer ist die Bürgin?", antwort: [
      `Die ${d.buergin.name} mit Sitz in Miami, Florida. Sie ist mit FIAON über unseren Gründer ${FIAON_FIRMA.director} verbunden, der sie vertritt. Ihre Zusage liegt diesem Angebot als Anlage 1 bei.`,
      "Für die Bürgschaft zahlen Sie kein gesondertes Entgelt — sie ist Teil Ihres Auftrags.",
    ] },
  ];
}
/** Runde 3 (Punkt 3): so viele Fragen stehen offen, der Rest unter „Weitere Fragen“. */
export const FIRMA_FRAGEN_SICHTBAR = 8;

/**
 * „Ihr Team bei FIAON Global“ (Runde 2, Justin 08.10.2026, Punkt 9): die Personen kommen AUS DEN ANGEBOTSDATEN
 * (parameter.inhalt.team) — Namen stehen nie im Code. Ein Bild nur, wenn ein ECHTES Foto der Person geliefert ist: ein Bildname
 * am Angebot (hinter dem Link) oder „haus:<kürzel>“ für ein echtes Porträt des Hauses. KI-Porträts gibt es hier nicht (KI-VO
 * Art. 50) — ohne Foto ein Monogramm. Ohne inhalt.team: die Leitung aus ANGEBOT_ANSPRECHPARTNER mit ihren echten Porträts.
 * Der Ansprechpartner steht groß darüber und nicht noch einmal im Raster.
 */
export function firmaTeam(par: Pick<FirmaParameter, "inhalt">): FirmaTeam {
  const ap = firmaAnsprechpartner(par).name;
  const initialen = (name: string) => {
    const t = name.replace(/\b(Dr|Mag|Prof|Dipl|Ing)\.\s*/g, "").split(/\s+/).filter(Boolean);
    return ((t[0]?.[0] ?? "") + (t.length > 1 ? t[t.length - 1][0] : "")).toUpperCase();
  };
  const fotoAus = (f: unknown): string | null => {
    const x = String(f ?? "");
    if (x.startsWith(TEAM_HAUS)) { const k = x.slice(TEAM_HAUS.length); return firmaTeamFotoOk(x) ? portraitUrl(k) : null; }
    // Hinter dem Link (firmaInhaltMitBildLinks) — sonst (roher Bildname, etwa in der Vorschau ohne Link) kein Bild.
    return x.startsWith("/api/fiaon/global/angebot/") ? x : null;
  };
  // Runde 3 (Punkt 6): nur bestätigte Personen (bestaetigt !== false) — die übrigen bleiben in den Angebotsdaten, unsichtbar.
  const daten = Array.isArray(par.inhalt?.team) ? par.inhalt!.team!.filter((t) => t && t.bestaetigt !== false && String(t.name ?? "").trim() && String(t.rolle ?? "").trim()) : null;
  const personen = daten && daten.length
    ? daten.filter((t) => t.name.trim() !== ap).map((t) => { const foto = fotoAus(t.foto); return { name: t.name.trim(), rolle: t.rolle.trim(), foto, initialen: initialen(t.name.trim()), ki: !!foto && t.ki === true && !String(t.foto ?? "").startsWith(TEAM_HAUS) }; })
    : ANGEBOT_ANSPRECHPARTNER.filter((p) => p.name !== ap).map((p) => ({ name: p.name, rolle: p.rolle, foto: portraitMitKi(p.kuerzel) ? null : portraitUrl(p.kuerzel), initialen: initialen(p.name), ki: false }));
  return {
    titel: "Ihr Team bei FIAON Global",
    sub: "Mit Ihrem Ansprechpartner arbeiten diese Menschen an Ihrem Auftrag — jede und jeder in ihrem Fach.",
    personen,
  };
}

/** Das Inhaltsverzeichnis des Vertrags für den Leser der Seite — dieselben Ziffern wie im Rumpf (Anker = id im HTML). */
export function firmaVertragInhalt(d: FirmaDaten): { anker: string; marke: string; titel: string }[] {
  return [
    { anker: "praeambel", marke: "", titel: "Präambel" },
    ...firmaZiffern(d).map((z) => ({ anker: `ziffer-${z.nr}`, marke: String(z.nr), titel: z.titel })),
    { anker: "anlage-1", marke: "Anlage 1", titel: "Bürgschaftszusage" },
    { anker: "anlage-2", marke: "Anlage 2", titel: "Prüfbericht" },
  ];
}

/**
 * Das eine Stimmungsbild zwischen zwei Abschnitten (Runde 2, Punkt 5: KI-Szenen höchstens einmal groß, mit KI-Hinweis). Aus
 * inhalt.bilder.stimmung, sonst die Szene „usa“ — oder keins.
 */
export function firmaStimmung(par: Pick<FirmaParameter, "inhalt">): BildRef | null {
  return bild(par, "stimmung") ?? bild(par, "usa") ?? null;
}
/** Der Bildnachweis — aus den Bildern abgeleitet, die die Seite zeigt, nie getippt. Der KI-Hinweis zu Justins Porträt steht NUR hier. */
export function firmaBildnachweis(par: Pick<FirmaParameter, "inhalt">): string {
  const stimmung = firmaStimmung(par);
  const glas = par.inhalt?.glas;
  const teile: string[] = [];
  if (stimmung?.ki) teile.push("Stimmungsbild mit KI erstellt");
  if (glas?.foto || (stimmung && !stimmung.ki)) teile.push("Produktfotos und Etikett: echte Aufnahmen Ihres Unternehmens");
  if (glas) teile.push("das Glas im Kopf der Seite ist eine 3D-Darstellung nach diesen Fotos");
  const ap = firmaAnsprechpartner(par);
  if (ap.portraitHinweis) teile.push(`Porträt ${ap.name}: ${ap.portraitHinweis}`);
  if ((par.inhalt?.team ?? []).some((t) => t && t.ki === true && t.bestaetigt !== false)) teile.push("Teamfotos teils Symbolbilder");
  return teile.length ? `Bildnachweis: ${teile.join(" · ")}.` : "";
}

export function firmaSeite(d: FirmaDaten): FirmaSeite {
  const par = d.parameter; const k = d.kunde; const G = firmaGarantie(par);
  const m = marke(k);
  const ap = firmaAnsprechpartner(par);
  const sf = firmaSonderfreigabe(par, d.buergin);
  const ziele = Array.isArray(par.inhalt?.ziele) && par.inhalt!.ziele!.length ? par.inhalt!.ziele! : ZIELE_VORGABE;
  return {
    auftakt: { auge: "Ihr persönliches Angebot", gruss: `Herzlichen Glückwunsch, ${firmaGruss(k)}.`, zeile: `${m} geht in die Welt — und wir gehen mit.`, weiter: "weiter" },
    hero: {
      auge: `FIAON Global · Persönliches Angebot für ${k.firma.name}`,
      titel: "Ihr Weg in die Welt: eigene US-Gesellschaft, Kapital und ein ganzes Team an Ihrer Seite.",
      unter: String(par.inhalt?.heroUnter || `${m} wächst — mit eigener US-Gesellschaft, Kapital für den nächsten Schritt und einem Team, das jeden Monat daran arbeitet.`),
      // Runde 3 (Punkt 1): die große Zahl und Justins Garantie-Satz (eine Quelle) — keine Gründungskosten (Punkt 2).
      kapital: { betrag: firmaUsdKurz(par.kapitalUsd), satz: G.satz, titel: "Ihr Kapital" },
      // Runde 3 (Punkt 3): höchstens drei Punkte — das Kapital steht schon groß darüber.
      nutzen: [
        "Ihre US-Gesellschaft komplett — mit Office, Empfang und Telefonannahme in Miami",
        `Eine Bürgin, die gegenüber dem Institut einsteht — ohne gesondertes Entgelt`,
        `Shop, Marketing und Vertrieb — mit ${ap.name} als festem Ansprechpartner`,
      ],
      glas: par.inhalt?.glas ?? null,
    },
    ziele: { titel: "Ihre Ziele", sub: "Was Sie uns im Gespräch gesagt haben — darauf ist dieses Angebot gebaut.", punkte: ziele.slice(0, 3).map((z) => ({ titel: String(z.titel), text: String(z.text) })) },
    stimmung: firmaStimmung(par),
    phasen: { titel: "Ihr Weg in die Welt", sub: `${zahlwort(firmaPhasen(d).length).replace(/^./, (c) => c.toUpperCase())} Etappen — vom Start bis in weitere Runden.`, liste: firmaPhasen(d) },
    leistungen: { titel: "Was Sie bekommen", sub: "Sechs Bereiche, ein Team an Ihrer Seite.", karten: firmaLeistungen(d) },
    kapital: {
      titel: "Ihr Kapital",
      sub: "Eine erste Runde für Ihre US-Gesellschaft — mit einer Bürgin, die dafür einsteht.",
      garantie: [...G.kapital],
      betrag: firmaUsdKurz(par.kapitalUsd),
      auszahlung: "Vorgesehen in einer Auszahlung — das ganze Kapital auf einmal, für Ihren nächsten Schritt.",
      bedingungen: firmaBedingungen(par).map((b) => ({ titel: b.titel, text: b.warum })),
      bedingungenSub: G.bedingungenSub,
      ohneEntgelt: "Für die Bürgschaft zahlen Sie kein gesondertes Entgelt — sie ist Teil Ihres Auftrags.",
      buergin: { name: d.buergin.name, sitz: "Miami, Florida (USA)", vertreter: String(d.buergin.vertreter || FIAON_FIRMA.director), funktion: String(d.buergin.funktion || "") },
      sonderfreigabe: sf ?? { titel: "", text: "", unterzeichner: "", funktion: "", datum: "" },
    },
    pruefbericht: {
      titel: "Ihr Prüfbericht",
      sub: "Wir haben Ihr Unternehmen vor diesem Angebot aus öffentlichen Quellen geprüft — Bereich für Bereich, jede Aussage mit Quelle.",
      download: "Prüfbericht herunterladen (PDF)",
      hinweis: firmaPruefberichtHinweis(d.compliance),
    },
    investition: {
      titel: FIRMA_VEREINBARUNG_TITEL,
      sub: "Erst, was Sie bekommen — dann die Konditionen. Jede Zeile klappt auf: was sie umfasst, wann sie fällig wird, warum es sie gibt und wie sie läuft.",
      // Runde 3 (Punkt 1): zuerst „Was Sie bekommen: 250.000 USD + Gesellschaft + Team“, danach die Konditionen.
      bekommen: {
        titel: "Was Sie bekommen",
        punkte: [
          { wert: firmaUsdKurz(par.kapitalUsd), text: "Eine erste Runde für Ihre US-Gesellschaft, mit Bürgin — Auszahlung nach Ziffer 7" },
          { wert: "Ihre US-Gesellschaft", text: "Komplett, mit Office, Empfang und Telefonannahme in Miami" },
          { wert: "Ein ganzes Team", text: "Strategie, Plattform, Marketing und Vertrieb — mit einem festen Ansprechpartner" },
        ],
      },
      konditionenTitel: "Die Konditionen",
      // Justin 08.10.2026 abends: Das Wachstumsbudget steht NICHT in den Konditionen der Seite — nur im Vertrag (Ziffer 10).
      // Umsatz- und Verkaufsbeteiligung bleiben; die Gründung steht als ruhige Zeile darunter.
      posten: firmaInvestPosten(d).filter((p) => p.schluessel !== "monat"),
      budget: firmaBudget(par),
      rechner: firmaRechner(par),
      fein: [
        "Alle Beträge netto. Unsere Rechnungen weisen keine Umsatzsteuer aus; die Steuer schuldet Ihr Unternehmen selbst (Reverse Charge).",
        `Zahlungsziel unserer Rechnungen: ${zahlwort(par.zahlungszielTage)} Tage. Überweisung auf Rechnung, keine Lastschrift.`,
        "Kosten Dritter nennen wir vorab — beauftragt wird nur mit Ihrer Zustimmung.",
      ],
    },
    fragen: { titel: "Fragen & Antworten", sub: "Das Wichtigste in zwei Sätzen — alles Weitere steht im Vertrag.", liste: firmaFragen(d), sichtbar: FIRMA_FRAGEN_SICHTBAR },
    ansprechpartner: { titel: "Ihr Ansprechpartner", sub: "Ein Mensch kennt Ihren Auftrag von Anfang an — vor der Annahme bei jeder Frage zum Vertrag und danach bei jedem Schritt." },
    team: firmaTeam(par),
    vertrag: {
      titel: "Ihr Vertrag mit zwei Anlagen",
      sub: "Vertrag, Bürgschaftszusage (Anlage 1) und Prüfbericht (Anlage 2) — derselbe Text wie im PDF. Lesen Sie in Ruhe, Ziffer für Ziffer.",
      dokument: firmaVertragTitel(),
      unterzeile: firmaVertragUnterzeile(d),
      inhalt: firmaVertragInhalt(d),
    },
    pflicht: firmaPflichthinweise(d),
    bildnachweis: firmaBildnachweis(par),
  };
}

/** Der Satz unter der Bühne des Prüfberichts — aus der Gesamtampel, nie fest. */
export function firmaPruefberichtHinweis(c: Pick<ComplianceKundenfassung, "gesamt"> | null): string {
  const a = COMPLIANCE_AMPEL[c?.gesamt.ampel ?? "GELB"];
  return c?.gesamt.ampel === "GRÜN"
    ? "Grün heißt: unauffällig. Für die Bürgschaft zählen allein die Bedingungen in Ziffer 8 Ihres Vertrags."
    : `${a.wort} heißt: ${a.satz}. Für die Bürgschaft zählen allein die Bedingungen in Ziffer 8 Ihres Vertrags — und die arbeiten wir gemeinsam mit Ihnen ab.`;
}

/** Die Pflichthinweise der Seite — wörtlich aus dem Haus (ohne Institut-Satz, ANGEBOT_PFLICHTHINWEIS) und die Rollen. */
export function firmaPflichthinweise(d: Pick<FirmaDaten, "buergin">): string[] {
  return [
    ...ANGEBOT_PFLICHTHINWEIS,
    GLOBAL_ROLLEN.de.fiaon,
    `Die ${d.buergin.name} ist mit FIAON über unseren Gründer ${FIAON_FIRMA.director} verbunden. Ihr Vertragspartner ist in jedem Fall die ${FIAON_FIRMA.name}.`,
    "Geschäft unter Unternehmern: Es gilt englisches Recht, Gerichtsstand ist London. Ein Widerrufsrecht für Verbraucher besteht nicht.",
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG — Ziffern als Struktur (Vertragssprache, ohne Ihr/wir)
// ═══════════════════════════════════════════════════════════════════════════
const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function firmaVertragTitel(): string { return "FIAON Global — Vereinbarung über Aufbau, Kapital und Wachstum"; }
export function firmaVertragUnterzeile(d: Pick<FirmaDaten, "ref" | "fassung" | "gueltigBis">): string {
  return `${FIRMA_MARKE} · Vertragsfassung ${d.fassung} · Angebot ${d.ref} · gültig bis ${firmaTag(d.gueltigBis)}`;
}

export const FIRMA_ZIFFER_TITEL = [
  "Parteien", "Unternehmergeschäft, kein Widerrufsrecht", "Leistungen — US-Gesellschaft", "Leistungen — Strategie & Wachstum",
  "Leistungen — Plattform & Marketing", "Leistungen — Vertrieb und Ansprechpartner", "Erste Finanzierungsrunde und Garantie",
  "Bürgschaft und aufschiebende Bedingungen", "Partner und Abgrenzung", "Vergütung", "Umsatzbeteiligung", "Verkaufsbeteiligung",
  "Rechnungen, Zahlung und Umsatzsteuer", "Laufzeit, Verlängerung und Kündigung", "Mitwirkung und Reporting", "Vertraulichkeit",
  "Datenschutz", "Haftung", "Pflichthinweise", "Recht, Gerichtsstand und Schlussbestimmungen",
] as const;

export function firmaPraeambel(d: FirmaDaten): string[] {
  const par = d.parameter;
  return [
    `Die Auftraggeberin stellt Produkte her und vertreibt sie. Sie will wachsen — mit mehr Kapazität, neuen Märkten und einer eigenen Gesellschaft in den USA. FIAON gründet diese Gesellschaft, begleitet das Wachstum der Auftraggeberin mit einem Team für Strategie, Plattform, Marketing und Vertrieb und bereitet die erste Finanzierungsrunde der US-Gesellschaft über ${firmaUsd(par.kapitalUsd)} vor, für die die ${d.buergin.name} eine Bürgschaft zusagt.`,
    "Die Vergütung besteht aus einem einmaligen Betrag für die Gründung, dem Anteil der Auftraggeberin an einem gemeinsamen Wachstumsbudget, dessen andere Hälfte FIAON trägt, und Beteiligungen, die nur bei Wachstum über eine Schwelle oder bei einem Verkauf anfallen.",
  ];
}

export function firmaZiffern(d: FirmaDaten): AngebotZiffer[] {
  const par = d.parameter; const k = d.kunde; const f = k.firma; const G = firmaGarantie(par);
  const buergin = d.buergin.name;
  const vertreter = firmaVertreterName(k);
  const register = `${REGISTER_NAME[f.land] ?? "Register"} beim ${f.registergericht} unter ${f.registernummer}`;
  const sf = firmaSonderfreigabe(par, d.buergin);
  const ap = firmaAnsprechpartner(par);
  const schwelle = firmaEur(par.umsatzSchwelleCents);
  const satzU = firmaProzent(par.umsatzSatzProzent); const satzV = firmaProzent(par.verkaufSatzProzent);
  const ziel = zahlwort(par.zahlungszielTage);
  return [
    { nr: 1, titel: "Parteien", absaetze: [
      p(`${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}, eingetragen im ${FIAON_FIRMA.register} unter der Company No. ${FIAON_FIRMA.companyNo}, vertreten durch den Director ${FIAON_FIRMA.director}, E-Mail ${FIAON_FIRMA.email} — nachfolgend „FIAON“.`),
      p(`${f.name}, ${anschrift(k)}, eingetragen im ${register}, UID ${f.uid}, vertreten durch ${vertreter}, ${k.vertretung.funktion}, E-Mail ${k.email} — nachfolgend „Auftraggeberin“.`),
      p(`Die Gesellschaft, die FIAON nach Ziffer 3 in den USA gründet, heißt nachfolgend „US-Gesellschaft“. Gesellschafterin der US-Gesellschaft wird die Auftraggeberin oder, wenn die Auftraggeberin es vor der Gründung in Textform bestimmt, ihre Gesellschafterin oder ihr Gesellschafter; FIAON erwirbt keine Anteile. Die ${buergin} („Bürgin“) ist nicht Partei dieses Vertrags; sie gibt die Bürgschaftszusage in Anlage 1 ab und ist mit FIAON über deren Director ${FIAON_FIRMA.director} verbunden.`),
    ] },
    { nr: 2, titel: "Unternehmergeschäft, kein Widerrufsrecht", absaetze: [
      p("Die Auftraggeberin schließt diesen Vertrag in Ausübung ihrer gewerblichen Tätigkeit (Unternehmerin). Ein Widerrufsrecht für Verbraucher besteht deshalb nicht."),
      p(`Die für die Auftraggeberin handelnde Person, ${vertreter}, erklärt mit der Annahme, zur alleinigen Vertretung der Auftraggeberin bei diesem Vertrag berechtigt zu sein.`),
    ] },
    { nr: 3, titel: "Leistungen — US-Gesellschaft", absaetze: [
      liste([
        "Vergleich der in Frage kommenden US-Bundesstaaten und Wahl des Bundesstaats durch die Auftraggeberin nach Prüfung durch einen Partner-Steuerberater von FIAON",
        "Gründung der US-Gesellschaft als Limited Liability Company bis zur Eintragung, Operating Agreement und Gründungsbeschlüsse durch einen Partner-Anwalt von FIAON; die staatlichen Gründungsgebühren trägt FIAON",
        "EIN: Antrag beim IRS vorbereitet und eingereicht, bis zur Bestätigung; ITIN, soweit für die Vertretung der US-Gesellschaft erforderlich",
        "US-Geschäftskonto: Auswahl geeigneter Institute, vollständige Vorbereitung des Kontoantrags und Begleitung bis zur Entscheidung des Instituts",
        "Begleitung der Beantragung von US-Firmenkarten für die US-Gesellschaft; über die Ausgabe entscheidet der jeweilige Herausgeber",
        "Geschäftsadresse und Telefonnummer der US-Gesellschaft in einem besetzten Büro in Miami, mit Telefonassistenz während der Geschäftszeiten",
        "U.S. Agent gegenüber der Food and Drug Administration (FDA) mit Präsenz in den USA, soweit die Produkte der Auftraggeberin der FDA unterliegen",
        "Registered Agent im Bundesstaat der Gründung und alle laufenden Meldungen und staatlichen Jahresgebühren der US-Gesellschaft während der Laufzeit",
        "Laufende Betreuung der US-Gesellschaft durch Partner-Anwalt, Partner-Steuerberater und US-CPA im Umfang dieser Ziffer, einschließlich der jährlichen US-Steuererklärung der US-Gesellschaft",
        "Pflichtenkalender mit allen US-Fristen und ein Dokumentenraum mit allen Unterlagen der US-Gesellschaft",
      ], "FIAON gründet für die Auftraggeberin eine Gesellschaft in den USA und betreut sie während der Laufzeit. Die Leistungen umfassen:"),
      p("Die Gebühren und Honorare für die Leistungen nach Absatz 1 sind in der Vergütung nach Ziffer 10 enthalten: für die Gründung in der Vergütung nach Ziffer 10 Absatz 1, für den laufenden Betrieb der US-Gesellschaft im gemeinsamen Wachstumsbudget nach Ziffer 10 Absatz 2 und 3; bis zum Starttag trägt FIAON die laufenden Kosten. Was nicht enthalten ist, nennt Ziffer 10 Absatz 6."),
    ] },
    { nr: 4, titel: "Leistungen — Strategie & Wachstum", absaetze: [
      liste([
        "Planung der Skalierung, der Produktionskapazität und der Investitionen",
        "Einkauf und Preisgestaltung",
        "Mittelverwendungsplan für die erste Runde nach Ziffer 7 und die Kennzahlen, die Institute und die Bürgin verlangen",
        "Ein Strategietag im Betrieb der Auftraggeberin im ersten Halbjahr der Laufzeit; die Reisekosten von FIAON trägt FIAON",
        "Vorbereitung der Unterlagen für Finanzierungsrunden",
      ], "FIAON begleitet die Auftraggeberin betriebswirtschaftlich auf dem Weg zu mehr Menge, neuen Märkten und tragfähigen Zahlen. Die Begleitung umfasst:"),
      p("Die Entscheidungen trifft die Auftraggeberin. Geschäftsführung und Anteile der Auftraggeberin bleiben von diesem Vertrag unberührt; FIAON erwirbt keine Anteile und übernimmt keine Geschäftsführung. FIAON erbringt keine Rechts- und keine Steuerberatung; diese Leistungen erbringen Partner nach Ziffer 9."),
    ] },
    { nr: 5, titel: "Leistungen — Plattform & Marketing", absaetze: [
      liste([
        "Entwicklung, Betrieb und Weiterentwicklung eines Online-Shops und einer Vertriebsplattform der Auftraggeberin",
        "Website und Suchmaschinenoptimierung (SEO) einschließlich Aufbau von Verweisen anderer Seiten (Backlinks)",
        "Planung, Gestaltung und Betreuung bezahlter Anzeigen (SEA); das Werbebudget kommt aus dem gemeinsamen Wachstumsbudget nach Ziffer 10 Absatz 3, ein Mehrbudget nach Ziffer 10 Absatz 6",
        "Social Media mit Beiträgen, Texten und Gestaltung",
        "Influencer-Kampagnen: Auswahl, Planung und Steuerung; die Honorare der Influencer kommen aus dem gemeinsamen Wachstumsbudget nach Ziffer 10 Absatz 3, was darüber hinausgeht, nach Ziffer 10 Absatz 6",
      ], "FIAON entwickelt die digitalen Vertriebswege der Auftraggeberin und bringt Kundschaft dorthin. Die Leistungen umfassen:"),
      p("Die Rechte an den Arbeitsergebnissen dieser Ziffer — insbesondere Shop, Website, Texte, Gestaltungen und Inhalte — gehen mit der Zahlung des Anteils am Wachstumsbudget nach Ziffer 10 Absatz 2 für den Monat, in dem sie entstanden sind, auf die Auftraggeberin über; Arbeitsergebnisse aus der Zeit vor dem Starttag mit der Zahlung des ersten Anteils. Zugänge und Konten werden auf den Namen der Auftraggeberin eingerichtet."),
    ] },
    { nr: 6, titel: "Leistungen — Vertrieb und Ansprechpartner", absaetze: [
      liste([
        "Aktive Mitarbeit im Verkauf, einschließlich Gesprächen mit Handelspartnern im Namen und auf Rechnung der Auftraggeberin, soweit sie dem im Einzelfall zustimmt",
        "Öffnen neuer Handelswege im In- und Ausland",
        "Messen: Auswahl, Vorbereitung und Begleitung; Standgebühren und Reisekosten Dritter zahlt die Auftraggeberin nach Ziffer 10 Absatz 6",
      ], "FIAON unterstützt den Vertrieb der Auftraggeberin. Die Leistungen umfassen:"),
      p(`Fester persönlicher Ansprechpartner der Auftraggeberin ist ${ap.name}. Er führt mit der Auftraggeberin einen monatlichen Durchgang über den Stand aller Leistungen.`),
    ] },
    { nr: 7, titel: G.vertragTitel, absaetze: [
      p(G.vertragGarantie), p(G.vertragErhalten), p(G.vertragBeginn), p(G.vertragRuhen), p(G.vertragFolge), p(G.vertragWeitere), p(G.vertragInstitut),
    ] },
    { nr: 8, titel: "Bürgschaft und aufschiebende Bedingungen", absaetze: [
      p(`Die ${buergin} sagt in Anlage 1 zu, auf Anforderung des Instituts, das der US-Gesellschaft die erste Runde gewährt, eine Bürgschaft für die Verbindlichkeiten der US-Gesellschaft aus der ersten Runde zu übernehmen — Höchstbetrag ${firmaUsd(par.buergschaftUsd)}, Laufzeit höchstens ${monateWort(par.buergschaftHoechstMonate)}.`),
      p(`Für die Bürgschaft verlangen weder FIAON noch die ${buergin} ein gesondertes Entgelt; sie ist mit der Vergütung nach Ziffer 10 abgegolten.`),
      p("Die erste Runde ist für eine Auszahlung in einem Betrag vorgesehen. Weder FIAON noch die Bürgin knüpfen die Bürgschaft an eine Auszahlung in Teilbeträgen oder an einen Plan über die Verwendung der Mittel."),
      liste(firmaBedingungen(par).map((b) => b.vertrag), "Die Zusage der Bürgin ist aufschiebend bedingt. Sie wird erst wirksam, wenn alle folgenden Bedingungen erfüllt sind:"),
      p(`Eine Bedingung ist erfüllt, sobald die Auftraggeberin die verlangte Unterlage vorgelegt hat. Den Tag, an dem die letzte Bedingung erfüllt ist („Tag der erfüllten Bedingungen“), stellt FIAON binnen ${tagenWort(14)} nach Vorlage der letzten Unterlage fest und teilt ihn der Auftraggeberin in Textform mit; hält FIAON eine Unterlage für unzureichend, nennt FIAON den Mangel binnen derselben Frist in Textform. Unterbleibt beides, gilt der vierzehnte Tag nach dieser Vorlage als Tag der erfüllten Bedingungen.`),
      p("Wird die Auftraggeberin oder die US-Gesellschaft verkauft oder wechselt die Kontrolle über sie, wird die erste Runde aus dem Kaufpreis abgelöst; die Auftraggeberin wirkt darauf hin, dass die Ablösung im Kaufvertrag vereinbart wird. Ein Kontrollwechsel liegt vor, wenn ein Dritter mehr als fünfzig Prozent der Stimmrechte oder auf andere Weise einen beherrschenden Einfluss erwirbt. Mit der Ablösung endet die Bürgschaft."),
      ...(sf ? [p(`Sonderfreigabe: ${sf.text} — ${sf.unterzeichner}, ${sf.funktion}${sf.datum ? `, ${firmaTag(sf.datum)}` : ""}.`)] : []),
    ] },
    { nr: 9, titel: "Partner und Abgrenzung", absaetze: [
      p("Steuerliche und rechtliche Leistungen im Umfang der Ziffern 3 und 4 erbringen Steuerberater, US-CPA und Anwälte aus dem Partnernetz von FIAON auf eigenes Mandat der Auftraggeberin bzw. der US-Gesellschaft. Die Honorare der Partner für diese Leistungen trägt FIAON; sie sind in der Vergütung enthalten. Erhält FIAON von einem Partner eine Vergütung dafür, dass es ihm die Auftraggeberin oder die US-Gesellschaft zuführt, legt FIAON das der Auftraggeberin vor der Beauftragung dieses Partners offen. Leistungen darüber hinaus vereinbart die Auftraggeberin unmittelbar mit dem Partner."),
      p(GLOBAL_ROLLEN.de.fiaon),
    ] },
    { nr: 10, titel: "Vergütung", absaetze: [
      p(`Für die Gründung nach Ziffer 3 zahlt die Auftraggeberin einmalig ${firmaEur(par.startCents)}. Der Betrag ist mit Vertragsschluss fällig; FIAON stellt die Rechnung bei der Annahme, sie ist sofort ohne Abzug zu zahlen.`),
      // Fassung C (Runde 2, Justin 08.10.2026): gemeinsames Wachstumsbudget statt Monatspauschale; Beginn am Tag „Shop live“.
      // Fassung D (Runde 3, Punkt 5): spätestens budgetSpaetestensMonate nach der Annahme, es sei denn, die Verzögerung liegt bei FIAON.
      p(`Für die laufenden Leistungen nach den Ziffern 3 bis 6 bilden die Parteien ab dem Starttag ein gemeinsames Wachstumsbudget von ${firmaEur(par.budgetGesamtCents)} im Monat. Die Auftraggeberin trägt davon die Hälfte, ${firmaEur(par.monatCents)} im Monat (Anteil der Auftraggeberin); FIAON trägt die andere Hälfte. Starttag ist der Tag, an dem der Online-Shop nach Ziffer 5 live ist — für Kundinnen und Kunden erreichbar und bereit, Bestellungen anzunehmen; FIAON teilt ihn der Auftraggeberin in Textform mit. Ist der Online-Shop ${monateWort(par.budgetSpaetestensMonate)} nach dem Tag der Annahme (Ziffer 7 Absatz 1) nicht live, ist Starttag dieser Tag (spätester Starttag), es sei denn, die Verzögerung beruht auf Umständen, die FIAON zu vertreten hat; dann bleibt es beim Tag, an dem der Online-Shop live ist. Der Anteil ist monatlich im Voraus zu zahlen: erstmals am Starttag, danach jeweils am selben Kalendertag der folgenden Monate; fehlt dieser Tag in einem Monat, am letzten Tag dieses Monats. FIAON stellt jede Rechnung am Fälligkeitstag; sie ist binnen ${tagenWort(par.zahlungszielTage)} zu zahlen.`),
      liste(firmaBudgetPosten(par).map(budgetZeileVertrag), `Das Wachstumsbudget ist nach folgender Aufstellung geplant (Planwerte je Monat, zusammen ${firmaEur(par.budgetGesamtCents)}):`),
      p("Die Beträge der Aufstellung sind Planwerte. FIAON setzt das Wachstumsbudget nach dieser Aufstellung für die Auftraggeberin ein und legt die Verwendung im monatlichen Durchgang nach Ziffer 6 Absatz 2 offen; Verschiebungen zwischen den Posten stimmt FIAON dort mit der Auftraggeberin ab. Personal von FIAON wird aus dem Wachstumsbudget nicht bezahlt."),
      p("Dazu kommen die Umsatzbeteiligung nach Ziffer 11 und die Verkaufsbeteiligung nach Ziffer 12."),
      liste([...FIRMA_EXTRA_VERTRAG],
        "Nicht in der Vergütung enthalten sind die folgenden Kosten; die Auftraggeberin zahlt sie unmittelbar an den jeweiligen Anbieter. FIAON nennt sie vorab und beauftragt sie nur mit Zustimmung der Auftraggeberin in Textform:"),
      p("Alle Beträge dieses Vertrags sind Nettobeträge; für die Umsatzsteuer gilt Ziffer 13."),
    ] },
    { nr: 11, titel: "Umsatzbeteiligung", absaetze: [
      p(`FIAON erhält ${satzU} des Netto-Umsatzes der Gruppe, soweit er in einem Kalenderjahr ${schwelle} übersteigt (Schwelle).`),
      p("Gruppe sind die Auftraggeberin, die US-Gesellschaft und jedes Unternehmen, das mit einer von ihnen verbunden ist oder während der Umsatzbeteiligung verbunden wird (verbundene Unternehmen nach dem für die Auftraggeberin geltenden Unternehmensrecht). Unternehmen ihrer Gesellschafter gehören nur dazu, soweit sie Produkte unter einer Marke der Auftraggeberin herstellen oder vertreiben. Umsätze zwischen Unternehmen der Gruppe bleiben außer Betracht."),
      p("Netto-Umsatz sind die Umsatzerlöse ohne Umsatzsteuer, gemindert um Rabatte, Skonti, Gutschriften und Rücksendungen. Umsätze in anderer Währung werden zum Monatsdurchschnitt der Referenzkurse der Europäischen Zentralbank in Euro umgerechnet."),
      p("Im ersten Kalenderjahr zählen nur die Netto-Umsätze ab dem Monat des Starttags, und die Schwelle gilt anteilig: Schwelle × Zahl der Monate vom Monat des Starttags bis Dezember (jeweils einschließlich) ÷ zwölf. Endet die Umsatzbeteiligung im Lauf eines Kalenderjahres, gilt die Schwelle für dieses Jahr ebenso anteilig bis zum Monat des Endes."),
      p(`Abgerechnet wird quartalsweise. Die Auftraggeberin meldet FIAON bis zum 15. Tag nach Ende jedes Kalenderquartals den kumulierten Netto-Umsatz der Gruppe seit Beginn des Kalenderjahres (im ersten Kalenderjahr seit Beginn des Monats des Starttags), belegt durch die Umsatzsteuervoranmeldungen und, für Unternehmen ohne solche, durch die entsprechende Buchhaltungsauswertung. Die Beteiligung für die Meldung ist: ${satzU} × (kumulierter Netto-Umsatz − Schwelle, mindestens null) − die für dasselbe Kalenderjahr bereits abgerechnete Beteiligung. Ist das Ergebnis nicht größer als null, entsteht keine Rechnung. FIAON stellt die Rechnung nach Eingang der Meldung; sie ist binnen ${tagenWort(par.zahlungszielTage)} zu zahlen.`),
      p(`Nach Feststellung des Jahresabschlusses, spätestens neun Monate nach Ende des Kalenderjahres, rechnen die Parteien das Kalenderjahr auf Grundlage der Jahresabschlüsse der Gruppe endgültig ab (Jahresabgleich). Ein Mehrbetrag wird mit Rechnung fällig; einen Minderbetrag erstattet FIAON binnen ${tagenWort(14)}. Weicht das Geschäftsjahr vom Kalenderjahr ab, gelten für den Jahresabgleich die Umsatzsteuervoranmeldungen des Kalenderjahres.`),
      p("FIAON darf die Meldungen prüfen. Die Auftraggeberin gewährt dazu auf Anforderung Einsicht in Umsatzsteuervoranmeldungen, betriebswirtschaftliche Auswertungen, Summen- und Saldenlisten und Jahresabschlüsse der Gruppe — einmal je Kalenderjahr auch durch einen zur Verschwiegenheit verpflichteten Wirtschaftsprüfer oder Steuerberater. Ergibt die Prüfung eine Abweichung von mehr als fünf Prozent zulasten von FIAON, trägt die Auftraggeberin die Kosten der Prüfung."),
      p("Die Umsatzbeteiligung läuft, solange dieser Vertrag läuft oder die Bürgschaft nach Ziffer 8 besteht, und endet mit dem Ende des Kalenderquartals, in dem beides geendet hat. Sie endet außerdem mit dem Ende des Kalenderquartals, in dem ein Verkauf nach Ziffer 12 vollzogen wird, durch den mehr als die Hälfte der Anteile an der Auftraggeberin oder ihr Betrieb im Ganzen übergeht; bei anderen Verkäufen läuft sie weiter, und ein verkauftes Unternehmen der Gruppe scheidet mit dem Vollzug aus der Gruppe aus. Übersteigt der Netto-Umsatz die Schwelle nicht, fällt keine Umsatzbeteiligung an."),
    ] },
    { nr: 12, titel: "Verkaufsbeteiligung", absaetze: [
      p(`FIAON erhält ${satzV} der Gegenleistung, wenn Anteile an der Auftraggeberin oder an der US-Gesellschaft, eine Marke der Auftraggeberin oder ihr Betrieb oder wesentliche Teile davon verkauft werden. Bei einem Teilverkauf bemisst sich die Beteiligung nach der Gegenleistung für den verkauften Teil.`),
      p("Gegenleistung ist alles, was die Veräußernden für den Verkauf erhalten, einschließlich späterer Kaufpreisteile im Zeitpunkt ihres Zuflusses; Sachleistungen zählen mit ihrem Verkehrswert."),
      p(`Die Verkaufsbeteiligung entsteht, wenn der Kaufvertrag während der Laufzeit dieses Vertrags oder innerhalb von ${monatenWort(par.verkaufNachlaufMonate)} nach ihrem Ende geschlossen wird. Sie wird mit dem Zufluss der Gegenleistung fällig, jeweils in Höhe von ${satzV} des zugeflossenen Betrags; FIAON stellt die Rechnung nach dem Zufluss, sie ist binnen ${tagenWort(par.zahlungszielTage)} zu zahlen.`),
      p("Keine Verkaufsbeteiligung entsteht bei Übertragungen ohne Gegenleistung, insbesondere Schenkung und Erbfolge, bei Kapitalerhöhungen und bei Umstrukturierungen innerhalb der Gruppe ohne Gegenleistung von Dritten."),
      p("Die Verkaufsbeteiligung schuldet, wer veräußert. Veräußert die Auftraggeberin — eine Marke, ihren Betrieb oder wesentliche Teile davon oder Anteile an der US-Gesellschaft —, schuldet sie die Beteiligung. Veräußern Gesellschafter der Auftraggeberin Anteile an der Auftraggeberin oder an der US-Gesellschaft, schulden sie die Beteiligung nach ihrer gesonderten Beitrittserklärung zu dieser Ziffer; eine Zahlungspflicht der Auftraggeberin für Veräußerungen ihrer Gesellschafter besteht nicht. Die Auftraggeberin teilt FIAON den Abschluss eines Kaufvertrags, von dem sie Kenntnis hat, binnen sieben Tagen in Textform mit und weist die Gegenleistung nach, soweit sie ihr bekannt ist."),
      p("Eine Pflicht zum Verkauf besteht nicht. Ob und wann verkauft wird, entscheiden allein die Auftraggeberin und ihre Gesellschafter."),
    ] },
    { nr: 13, titel: "Rechnungen, Zahlung und Umsatzsteuer", absaetze: [
      p("FIAON stellt jede Rechnung an die Auftraggeberin mit Firma, Anschrift und UID. Gezahlt wird per Überweisung auf das in der Rechnung genannte Konto."),
      p("Die Leistungen von FIAON mit Sitz im Vereinigten Königreich an die Auftraggeberin als Unternehmerin mit Sitz in der Europäischen Union sind am Sitz der Auftraggeberin steuerbar; die Umsatzsteuer schuldet die Auftraggeberin als Leistungsempfängerin (Reverse Charge). Die Rechnungen weisen keine Umsatzsteuer aus. Ändert sich die Rechtslage, gilt die gesetzliche Umsatzsteuer zusätzlich."),
      p("Ist die Auftraggeberin mit zwei Monatsanteilen nach Ziffer 10 Absatz 2 in Verzug, kann FIAON nach Mahnung in Textform mit einer Frist von vierzehn Tagen die Leistungen nach den Ziffern 4 bis 6 bis zur Zahlung ruhen lassen."),
    ] },
    { nr: 14, titel: "Laufzeit, Verlängerung und Kündigung", absaetze: [
      p("Der Vertrag beginnt mit der Annahme durch die Auftraggeberin. Startgespräch, Vorbereitung und die Leistungen nach den Ziffern 4 bis 6 beginnen sofort nach der Annahme; mit der Gründung nach Ziffer 3 beginnt FIAON nach Eingang der Zahlung nach Ziffer 10 Absatz 1. Das gemeinsame Wachstumsbudget und der Anteil der Auftraggeberin beginnen am Starttag (Ziffer 10 Absatz 2)."),
      p(`Die Mindestlaufzeit beträgt ${monateWort(par.mindestMonate)} ab dem Starttag. Danach verlängert sich der Vertrag um jeweils ${monateWort(par.verlaengerungMonate)}, wenn ihn keine Partei spätestens ${monateWort(par.kuendigungMonate)} vor Ablauf in Textform kündigt.`),
      p(`Das Recht beider Parteien zur Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund für FIAON liegt insbesondere vor, wenn die Auftraggeberin vorsätzlich falsche Angaben macht, mit drei Monatsanteilen in Verzug ist oder sie oder die US-Gesellschaft auf einer Sanktionsliste der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs oder der USA geführt wird. ${G.vertragKuendigung}`),
      p("Mit dem Ende des Vertrags übergibt FIAON alle Zugänge, Konten und Unterlagen. Die US-Gesellschaft bleibt bei ihrer Gesellschafterin. Dienste in den USA, die FIAON für die US-Gesellschaft erbringt (Geschäftsadresse, Telefon, Registered Agent, U.S. Agent), enden mit dem Vertrag; FIAON unterstützt den Wechsel zu einem neuen Anbieter während der letzten drei Monate der Laufzeit. Die Bürgschaft besteht nach ihren Bedingungen fort; für die Umsatzbeteiligung gilt Ziffer 11 Absatz 8, für die Verkaufsbeteiligung Ziffer 12 Absatz 3."),
    ] },
    { nr: 15, titel: "Mitwirkung und Reporting", absaetze: [
      liste([
        "Unterlagen und Auskünfte, die FIAON für die Leistungen und die Bedingungen nach Ziffer 8 anfordert, in angemessener Frist bereitstellen",
        "unterschreiben, was FIAON fertig vorbereitet vorlegt, nach eigener Prüfung",
        "die gesetzlich vorgeschriebene Identifizierung der Vertretung und der wirtschaftlich Berechtigten ermöglichen",
        "die Umsatzmeldungen nach Ziffer 11 Absatz 5 fristgerecht übermitteln",
        "FIAON über wesentliche Ereignisse unterrichten, insbesondere über Insolvenz- und Gerichtsverfahren, einen Kontrollwechsel und den Abschluss eines Kaufvertrags nach Ziffer 12",
        "wahre und vollständige Angaben machen",
      ], "Die Auftraggeberin wirkt wie folgt mit:"),
      p(G.vertragMitwirkung),
    ] },
    { nr: 16, titel: "Vertraulichkeit", absaetze: [
      p(`Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags. FIAON gibt Unterlagen nur weiter, soweit es die Leistung erfordert: an Behörden, an den Registered Agent und den U.S. Agent, an die mandatierten Steuerberater und Anwälte, an Institute für die erste Runde und weitere Runden und an die ${buergin} für die Bürgschaft. Anlage 2 gibt FIAON nur mit Zustimmung der Auftraggeberin an Dritte weiter.`),
    ] },
    { nr: 17, titel: "Datenschutz", absaetze: [
      p("FIAON verarbeitet personenbezogene Daten der Ansprechpersonen der Auftraggeberin, um diesen Vertrag zu erfüllen, nach der Datenschutzerklärung unter fiaon.com/datenschutz (Art. 6 Abs. 1 Buchst. b und f DSGVO; im Vereinigten Königreich nach UK GDPR). Dazu gehört vor Vertragsschluss und vor jeder Finanzierung ein Abgleich mit Sanktionslisten."),
      p("Soweit FIAON für Shop, Plattform, Website oder Marketing personenbezogene Daten von Kundinnen und Kunden der Auftraggeberin in deren Auftrag verarbeitet, schließen die Parteien vor Beginn dieser Verarbeitung einen Vertrag über die Auftragsverarbeitung nach Art. 28 DSGVO; bis dahin verarbeitet FIAON solche Daten nicht."),
      p("Für Gründung, Konten, Bürgschaft und Finanzierung gehen Daten in die USA. Für Empfänger, die nicht nach dem EU-U.S. Data Privacy Framework zertifiziert sind, stützt sich die Übermittlung darauf, dass sie für die Erfüllung dieses Vertrags erforderlich ist (Art. 49 Abs. 1 Buchst. b DSGVO)."),
    ] },
    { nr: 18, titel: "Haftung", absaetze: [
      p(`FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Im Übrigen haftet FIAON nur bei der Verletzung wesentlicher Vertragspflichten, begrenzt auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden und der Höhe nach auf die Vergütung, die die Auftraggeberin in den zwölf Monaten vor dem Schadensereignis nach Ziffer 10 Absatz 1 und 2 gezahlt hat. ${G.vertragHaftung}`),
      p("Für Entscheidungen von Behörden, Handelspartnern, Plattformbetreibern und Kartenherausgebern haftet FIAON nicht. Ein bestimmter Umsatz ist nicht geschuldet."),
    ] },
    { nr: 19, titel: "Pflichthinweise", absaetze: [
      liste([...ANGEBOT_PFLICHTHINWEIS], "Die Auftraggeberin nimmt die folgenden Hinweise zur Kenntnis:"),
      p(`Die Bürgschaft der ${buergin} ersetzt eine von einem Institut verlangte persönliche Haftung nur, wenn das Institut dem zustimmt.`),
      p("Während der Laufzeit sind die staatlichen Jahresgebühren und die Kosten des Registered Agent der US-Gesellschaft nach Ziffer 3 in der Vergütung enthalten."),
    ] },
    { nr: 20, titel: "Recht, Gerichtsstand und Schlussbestimmungen", absaetze: [
      p(`Dieser Vertrag ist eine Individualvereinbarung; Allgemeine Geschäftsbedingungen von FIAON gelten für ihn nicht. Beigefügt sind Anlage 1 (Bürgschaftszusage der ${buergin}) und Anlage 2 (Prüfbericht von FIAON, Fassung für die Auftraggeberin). Anlage 2 gibt den Stand der Prüfung vor Vertragsschluss wieder; die Bedingungen der Bürgschaft regelt allein Ziffer 8.`),
      p("Vertragssprache ist Deutsch. Für diesen Vertrag und alle Ansprüche aus oder im Zusammenhang mit ihm gilt das Recht von England und Wales. Ausschließlicher Gerichtsstand sind die Gerichte von England und Wales in London. Rechte Dritter aus diesem Vertrag nach dem Contracts (Rights of Third Parties) Act 1999 bestehen nicht."),
      p(`Textform bedeutet eine lesbare Erklärung, die die erklärende Person nennt, insbesondere eine E-Mail. Erklärungen an FIAON, auch Kündigungen, gehen an ${FIAON_FIRMA.email} oder an den Ansprechpartner nach Ziffer 6 Absatz 2; Erklärungen an die Auftraggeberin gehen an die E-Mail-Adresse in Ziffer 1.`),
      p("Änderungen und Ergänzungen bedürfen der Textform. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung tritt eine Regelung, die ihrem wirtschaftlichen Zweck am nächsten kommt."),
    ] },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLAGE 1 FIRMA — BÜRGSCHAFTSZUSAGE (Vertragssprache, eigene Fassung ANLAGE1_FIRMA_FASSUNG)
// ═══════════════════════════════════════════════════════════════════════════
const LUECKE = (was: string) => `[noch einzutragen: ${was}]`;
function bf(b: AngebotBuergin, k: keyof AngebotBuergin, was: string): string {
  const w = b[k]; return w == null || String(w).trim() === "" ? LUECKE(was) : String(w);
}
export function firmaAnlage1Titel(d: Pick<FirmaDaten, "buergin">): string { return `Anlage 1 — Bürgschaftszusage der ${d.buergin.name}`; }
export function firmaAnlage1Parteien(d: FirmaDaten): string[] {
  const b = d.buergin; const k = d.kunde;
  const register = buerginOhneNummer(b) ? "" : `, eingetragen bei ${bf(b, "registerstelle", "Registerstelle")} unter der Nummer ${bf(b, "registernummer", "Registernummer")}`;
  return [
    `${b.name}, Limited Liability Company nach dem Recht des Bundesstaats ${bf(b, "bundesstaat", "Bundesstaat")}, ${bf(b, "anschrift", "Anschrift")}${register}, vertreten durch ${bf(b, "vertreter", "Vertreter")}, ${bf(b, "funktion", "Funktion")} — nachfolgend „Bürgin“,`,
    `gegenüber ${k.firma.name}, ${anschrift(k)}, ${REGISTER_NAME[k.firma.land] ?? "Register"} ${k.firma.registernummer} — nachfolgend „Auftraggeberin“ —, und der US-Gesellschaft, die die FIAON LTD nach dem Vertrag für sie gründet — nachfolgend „US-Gesellschaft“.`,
  ];
}
export function firmaAnlage1Ziffern(d: FirmaDaten): AngebotZiffer[] {
  const par = d.parameter; const G = firmaGarantie(par);
  const hb = firmaUsd(par.buergschaftUsd);
  const sf = firmaSonderfreigabe(par, d.buergin);
  // Die Ziffern zählen fortlaufend — mit oder ohne Sonderfreigabe (Fassung C ohne die frühere Ziffer „Sicherheiten“).
  const ziffern: Omit<AngebotZiffer, "nr">[] = [
    { titel: "Zusage", absaetze: [
      p("Die Bürgin verpflichtet sich gegenüber der Auftraggeberin und der US-Gesellschaft, auf Anforderung des Instituts, das der US-Gesellschaft die erste Finanzierungsrunde nach Ziffer 7 des Vertrags gewährt (erste Runde), gegenüber diesem Institut eine Bürgschaft (englisch: Guaranty) für die Verbindlichkeiten der US-Gesellschaft aus der ersten Runde zu übernehmen."),
      p(G.anlage1Bezug),
    ] },
    { titel: "Höchstbetrag und Höchstdauer", absaetze: [
      p(`Die Bürgschaft ist auf den Höchstbetrag von ${hb} begrenzt; er umfasst Hauptforderung, Zinsen, Kosten und sonstige Nebenforderungen. Sie wird für höchstens ${monateWort(par.buergschaftHoechstMonate)} ab ihrer Abgabe übernommen.`),
    ] },
    { titel: "Aufschiebende Bedingungen", absaetze: [
      liste(firmaBedingungen(par).map((b) => b.vertrag), "Diese Zusage wird erst wirksam, wenn alle folgenden Bedingungen erfüllt sind:"),
      p("Wann eine Bedingung erfüllt ist und welcher Tag als Tag der erfüllten Bedingungen gilt, bestimmt Ziffer 8 Absatz 5 des Vertrags; die FIAON LTD teilt diesen Tag der Auftraggeberin und der Bürgin in Textform mit. Vorher besteht keine Pflicht der Bürgin."),
    ] },
    { titel: "Auszahlung in einem Betrag", absaetze: [
      p("Die erste Runde ist für eine Auszahlung in einem Betrag vorgesehen. Die Bürgin knüpft diese Zusage weder an eine Auszahlung in Teilbeträgen noch an einen Plan über die Verwendung der Mittel; zahlt das Institut die erste Runde in Teilbeträgen aus, gilt die Zusage für alle Teilbeträge."),
    ] },
    { titel: "Kein gesondertes Entgelt", absaetze: [
      p("Für die Bürgschaft fällt kein gesondertes Entgelt an: Die Bürgin verlangt dafür weder von der Auftraggeberin noch von der US-Gesellschaft eine Vergütung; ihre Leistung ist mit der Vergütung nach dem Vertrag abgegolten."),
    ] },
    { titel: "Ersatzanspruch der Bürgin", absaetze: [
      p("Zahlt die Bürgin aufgrund der Bürgschaft an das Institut, geht dessen Forderung gegen die US-Gesellschaft in Höhe der Zahlung auf die Bürgin über; die US-Gesellschaft hat der Bürgin den gezahlten Betrag zu erstatten."),
    ] },
    { titel: "Verkauf und Kontrollwechsel", absaetze: [
      p("Wird die Auftraggeberin oder die US-Gesellschaft verkauft oder wechselt die Kontrolle über sie (Ziffer 8 Absatz 6 des Vertrags), wird die erste Runde aus dem Kaufpreis abgelöst. Mit der Ablösung endet die Bürgschaft."),
    ] },
    { titel: "Weitere Runden", absaetze: [
      p(`Für weitere Finanzierungsrunden gilt diese Zusage nicht. Sie sind frühestens ${monateWort(par.weitereRundenAbMonaten)} nach der ersten Runde möglich und brauchen jeweils eine neue Freigabe der Bürgin.`),
    ] },
    ...(sf ? [{ titel: "Sonderfreigabe", absaetze: [
      p(`${sf.text} Vermerk: ${sf.unterzeichner}, ${sf.funktion}${sf.datum ? `, ${firmaTag(sf.datum)}` : ""}.`),
    ] }] : []),
    { titel: "Verbindung zu FIAON", absaetze: [
      p(`Die Bürgin ist mit der FIAON LTD über ${FIAON_FIRMA.director} verbunden, der Director der FIAON LTD ist und die Bürgin vertritt.`),
    ] },
    { titel: "Recht und Form", absaetze: [
      p("Für diese Zusage gilt das Recht von England und Wales; Gerichtsstand sind die Gerichte von England und Wales in London. Die einzelne Bürgschaft gegenüber dem Institut unterliegt dem Recht, das sie selbst bestimmt. Die Bürgin gibt diese Zusage als Urkunde (deed) ab: Der Vertreter der Bürgin unterzeichnet sie eigenhändig in Gegenwart eines Zeugen, der die Unterschrift mit Namen und Anschrift bezeugt; die Bürgin übersendet das Original der Auftraggeberin. Sollten einzelne Bestimmungen unwirksam sein, bleibt die Zusage im Übrigen wirksam."),
    ] },
  ];
  return ziffern.map((z, i) => ({ nr: i + 1, ...z }));
}
export function firmaAnlage1Unterschrift(d: FirmaDaten): { kopf: string; zeile: string; zeuge: string; vermerk: string } {
  const b = d.buergin;
  return {
    kopf: `Executed as a deed — für die ${b.name}`,
    zeuge: "In Gegenwart von (Zeuge): Name, Anschrift und Unterschrift",
    zeile: `${bf(b, "vertreter", "Vertreter")}, ${bf(b, "funktion", "Funktion")}`,
    vermerk: b.unterzeichnetAm
      ? `Abschrift. Das Original ist am ${firmaTag(b.unterzeichnetAm)} eigenhändig unterzeichnet worden; die Auftraggeberin erhält es per Post.`
      : LUECKE("Datum der eigenhändigen Unterschrift"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLAGE 2 — DER PRÜFBERICHT, KUNDENFASSUNG
// Quelle: compliance-daten.json des Unternehmensberater-Werkzeugs (bericht-bauen.mjs). Die Kundenfassung lässt
// weg, was FIAON-intern ist: Bereich 8 („Fit mit FIAON“), gesamt.zusatz, den Methodik-Satz „Interne Fassung …“,
// Urteil-Absätze zur eigenen Haftung bzw. zum eigenen Mandat von FIAON (KUNDENFASSUNG_INTERN) und im Fuß
// den Vermerk „interne Fassung“ (wird „Kundenfassung“). Dazu jeder Satz, der eine Finanzierung ein „Ziel“ nennt
// (ohneZielSatz), und jeder Satz, in dem FIAON intern bewertet, ob für eine eigene Haftung oder ein Funding die
// Grundlage fehlt (ohneGrundlageSatz) — Justin (07.10.2026): „Es ist kein Ziel, die 250.000 $ kommen, sicher.“ Der
// Bericht ist Anlage 2 des Vertrags und darf der Garantie in Ziffer 7 nicht widersprechen. Die Befunde selbst, die Ampel
// je Bereich und das, was fehlt, bleiben vollständig stehen; nur FIAONs eigene Entscheidungsbewertung geht heraus (dieselbe
// Klasse wie die schon ausgenommene „Haftungsübernahme durch eine FIAON-Gesellschaft“).
// ═══════════════════════════════════════════════════════════════════════════
export const COMPLIANCE_UNTERTITEL = "Prüfbericht zu Ihrem Angebot";
const AMPELN: Ampel[] = ["GRÜN", "GELB", "ROT"];
function ampelAus(v: unknown): Ampel { const s = String(v ?? "").toUpperCase(); return (AMPELN as string[]).includes(s) ? (s as Ampel) : "GELB"; }
const txt = (v: unknown) => String(v ?? "");
/** Ein Urteil-Absatz, der die eigene Position von FIAON bewertet (Mandat, Haftung einer FIAON-Gesellschaft) — intern. */
export const KUNDENFASSUNG_INTERN = /FIAON-Gesellschaft|(?:Beratungs|Aufbau)\S*\s*(?:und\s+\S+)?mandat/i;
/**
 * Sätze eines Absatzes. Ein Satz endet an „.“, „!“ oder „?“ (auch vor „**“), gefolgt von Leerraum und einem großen
 * Anfang — so bleiben Zahlen wie „250.000 €“ und Abkürzungen wie „z. B.“ in ihrem Satz.
 */
function saetze(s: string): string[] { return s.split(/(?<=[.!?](?:\*\*)?)\s+(?=[A-ZÄÖÜ„"*(\d])/); }
/** Ein Satz, der eine Finanzierung (Runde, Kapital) als bloßes „Ziel“ bezeichnet — widerspricht der Garantie. */
const ZIEL_SATZ = (x: string) => /\b(?:Finanzierung|Finanzierungsrunde|Runde|Kapital)\b/.test(x) && /\bZiel\b/.test(x);
/** Ein Satz, in dem FIAON intern bewertet, dass für eine Haftung oder ein Funding die Grundlage fehlt — widerspricht der Garantie. */
const GRUNDLAGE_SATZ = (x: string) => /\b(?:Haftung\w*|Funding|Bürgschaft|Finanzierung)\b/.test(x) && /\bGrundlage\b/.test(x) && /\bfehl\w*/.test(x);
function ohneSaetze(s: string, weg: (x: string) => boolean): string {
  return saetze(s).filter((x) => !weg(x.replace(/\*\*/g, ""))).join(" ").replace(/\s{2,}/g, " ").trim()
    // Ein Absatz, von dem nur der fette Vorspann bleibt („**Bewertung.**“), ist leer.
    .replace(/^\*\*[^*]+\*\*$/, "");
}
/** Text ohne „Ziel“-Sätze zur Finanzierung (leer, wenn nichts bleibt). */
export function ohneZielSatz(s: string): string { return ohneSaetze(s, ZIEL_SATZ); }
/** Text ohne interne „Grundlage fehlt“-Sätze zu Haftung oder Funding (leer, wenn nichts bleibt). */
export function ohneGrundlageSatz(s: string): string { return ohneSaetze(s, GRUNDLAGE_SATZ); }
const kundenSatz = (s: string) => ohneGrundlageSatz(ohneZielSatz(s));
const ohneZielListe = (l: string[]) => l.map(kundenSatz).filter((x) => x.length > 0);
/** Aus den Rohdaten (compliance-daten.json) die Kundenfassung — rein, wiederholbar, ohne interne Punkte. */
export function complianceKundenfassung(roh: any): ComplianceKundenfassung {
  const m = roh?.meta ?? {}; const g = roh?.gesamt ?? {};
  const bereiche: ComplianceBereich[] = (Array.isArray(roh?.bereiche) ? roh.bereiche : [])
    .filter((b: any) => Number(b?.nr) !== 8 && !/fit mit fiaon/i.test(txt(b?.titel)))
    .map((b: any): ComplianceBereich => ({
      nr: Number(b.nr), titel: txt(b.titel), ampel: ampelAus(b.ampel), kurz: kundenSatz(txt(b.kurz)),
      urteil: ohneZielListe((b.urteil ?? []).map(txt).filter((u: string) => !KUNDENFASSUNG_INTERN.test(u))),
      befunde: (b.befunde ?? []).map((f: any) => ({ id: txt(f.id), aussage: txt(f.aussage), quelle_name: txt(f.quelle_name), quelle_url: txt(f.quelle_url), stand: txt(f.stand), art: txt(f.art), pruefung: txt(f.pruefung) })),
      nicht_geprueft: (b.nicht_geprueft ?? []).map((n: any) => ({ punkt: txt(n.punkt), grund: txt(n.grund) })),
      chancen: ohneZielListe((b.chancen ?? []).map(txt)), risiken: ohneZielListe((b.risiken ?? []).map(txt)),
    }));
  const methodik = (Array.isArray(roh?.methodik) ? roh.methodik : []).map(txt)
    .map((s: string) => s.replace(/\s*Interne Fassung\b[\s\S]*$/, "").trim())
    .filter((s: string) => s.length > 0);
  return {
    art: "compliance",
    meta: {
      firma: txt(m.firma), kurz: txt(m.kurz), anlass: COMPLIANCE_UNTERTITEL, pruefdatum: txt(m.pruefdatum), datenstand: txt(m.datenstand),
      kopf: (Array.isArray(m.kopf) ? m.kopf : []).map((z: any) => [txt(z?.[0]), txt(z?.[1])] as [string, string]),
    },
    gesamt: {
      ampel: ampelAus(g.ampel), titel: txt(g.titel), text: ohneZielListe((g.text ?? []).map(txt)),
      kernzahlen: (g.kernzahlen ?? []).map((k: any) => ({ wert: txt(k.wert), text: txt(k.text) })),
      auflagen: ohneZielListe((g.auflagen ?? []).map(txt)),
    },
    bereiche,
    chancen: (roh?.chancen ?? []).map((c: any) => ({ titel: txt(c.titel), text: kundenSatz(txt(c.text)) })),
    schwaechen: (roh?.schwaechen ?? []).map((c: any) => ({ titel: txt(c.titel), text: kundenSatz(txt(c.text)) })),
    methodik,
    fuss: txt(roh?.fuss).replace(/\binterne Fassung\b/gi, "Kundenfassung"),
  };
}
/** Der Anteil „belegt“ eines Bereichs (bestätigt, korrigiert, neu belegt) — für Kachel und Balken. */
export function complianceBelegt(b: Pick<ComplianceBereich, "befunde">): { ok: number; n: number } {
  const n = b.befunde.length;
  return { n, ok: b.befunde.filter((f) => ["bestätigt", "korrigiert", "neu"].includes(f.pruefung)).length };
}
export const COMPLIANCE_AMPEL: Record<Ampel, { farbe: string; wort: string; satz: string }> = {
  "GRÜN": { farbe: "#0ca30c", wort: "Grün", satz: "unauffällig" },
  "GELB": { farbe: "#fab219", wort: "Gelb", satz: "lösbare offene Punkte" },
  "ROT": { farbe: "#d03b3b", wort: "Rot", satz: "Ausschluss- oder schwerer Grund" },
};
const PRUEF_TEXT: Record<string, string> = { "bestätigt": "bestätigt", "korrigiert": "korrigiert", "neu": "bestätigt", "unbelegt": "unbelegt", "lt. Kundin": "lt. Kundin", "eigene Rechnung": "eigene Rechnung" };

/** HTML-Escaping — rein, ohne Node. */
export function escHtml(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
const fl = (s: string) => escHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
const ersteUrl = (u: string) => String(u || "").split(/\s*;\s*|\s+/).find((x) => /^https?:\/\//i.test(x)) || "";

function ampelIcon(a: Ampel, gr = 18): string {
  const f = COMPLIANCE_AMPEL[a].farbe;
  if (a === "GRÜN") return `<svg width="${gr}" height="${gr}" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="${f}"/><path d="M5.8 10.4l2.7 2.7 5.7-6" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if (a === "GELB") return `<svg width="${gr}" height="${gr}" viewBox="0 0 20 20" aria-hidden="true"><path d="M10 1.6l8.6 15.4H1.4z" fill="${f}" stroke="${f}" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 7.2v4.6" stroke="#0c1a2e" stroke-width="1.9" stroke-linecap="round"/><circle cx="10" cy="14.4" r="1.15" fill="#0c1a2e"/></svg>`;
  return `<svg width="${gr}" height="${gr}" viewBox="0 0 20 20" aria-hidden="true"><path d="M6.3 1h7.4L19 6.3v7.4L13.7 19H6.3L1 13.7V6.3z" fill="${f}"/><path d="M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4" stroke="#fff" stroke-width="1.9" stroke-linecap="round"/></svg>`;
}
const pille = (a: Ampel) => `<span class="cb-pille">${ampelIcon(a, 15)}<span>${COMPLIANCE_AMPEL[a].wort}</span></span>`;
function ampelTurm(a: Ampel, id: string): string {
  const k = (x: Ampel) => (x === "GRÜN" ? "g" : x === "GELB" ? "y" : "r");
  const lampe = (x: Ampel, y: number) => {
    const an = x === a; const f = COMPLIANCE_AMPEL[x].farbe;
    return `<g>${an ? `<circle cx="44" cy="${y}" r="27" fill="${f}" opacity=".28" filter="url(#${id}-glow)"/>` : ""}<circle cx="44" cy="${y}" r="19" fill="${an ? `url(#${id}-${k(x)})` : "rgba(255,255,255,.07)"}" stroke="${an ? "rgba(255,255,255,.55)" : "rgba(255,255,255,.12)"}" stroke-width="1"/>${an ? `<ellipse cx="38" cy="${y - 8}" rx="7" ry="4" fill="#fff" opacity=".45"/>` : ""}</g>`;
  };
  const grad = (x: Ampel) => `<radialGradient id="${id}-${k(x)}" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".35" stop-color="${COMPLIANCE_AMPEL[x].farbe}"/><stop offset="1" stop-color="${COMPLIANCE_AMPEL[x].farbe}" stop-opacity=".85"/></radialGradient>`;
  return `<svg class="cb-turm" width="88" height="196" viewBox="0 0 88 196" role="img" aria-label="Gesamtampel ${COMPLIANCE_AMPEL[a].wort}"><defs>${grad("ROT")}${grad("GELB")}${grad("GRÜN")}<filter id="${id}-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><linearGradient id="${id}-geh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e3a64"/><stop offset="1" stop-color="#0b1c36"/></linearGradient></defs><rect x="8" y="6" width="72" height="184" rx="36" fill="url(#${id}-geh)" stroke="rgba(255,255,255,.14)"/>${lampe("ROT", 44)}${lampe("GELB", 98)}${lampe("GRÜN", 152)}</svg>`;
}

/** Die Gestaltung des Prüfberichts — alle Regeln unter .cb, damit sie im Vertrag (.gv) nichts anderes treffen. */
export const COMPLIANCE_CSS = `
.cb{--cb-papier:#fff;--cb-stein:#f5f7fa;--cb-linie:#e3e7ee;--cb-linie-2:#cdd5e0;--cb-tinte:#0c1a2e;--cb-text:#3b4658;--cb-leise:#6b7587;--cb-navy:#12284a;--cb-blau:#1d4ed8;color:var(--cb-text);font-weight:300;line-height:1.6}
.cb *{box-sizing:border-box}
.cb a{color:var(--cb-blau);text-decoration:none;word-break:break-word}
.cb .cb-auge{font-size:10.5px;font-weight:500;letter-spacing:.18em;text-transform:uppercase;color:var(--cb-navy);margin:0}
.cb h2.cb-h1{margin:8px 0 0;font-weight:300;font-size:24px;line-height:1.15;color:var(--cb-tinte);letter-spacing:-.01em}
.cb .cb-unter{margin:6px 0 0;color:var(--cb-text)}
.cb .cb-meta{margin:16px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));border-top:1px solid var(--cb-linie);border-left:1px solid var(--cb-linie);background:var(--cb-papier)}
.cb .cb-meta div{padding:8px 11px;border-right:1px solid var(--cb-linie);border-bottom:1px solid var(--cb-linie)}
.cb .cb-meta dt{font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--cb-leise);font-weight:500}
.cb .cb-meta dd{margin:2px 0 0;font-size:12.5px;color:var(--cb-tinte);font-weight:400}
.cb .cb-tafel{margin-top:20px;display:grid;grid-template-columns:auto 1fr;gap:24px;align-items:center;padding:22px 24px;border-radius:14px;background:radial-gradient(120% 140% at 0% 0%,#1d3b66 0%,#12284a 45%,#0b1c36 100%);color:#dfe7f3;break-inside:avoid;page-break-inside:avoid}
.cb .cb-tafel h3{margin:6px 0 0;font-weight:300;font-size:20px;line-height:1.2;color:#fff}
.cb .cb-tafel p{margin:8px 0 0;font-size:12.5px;line-height:1.6;color:#c9d5e6}
.cb .cb-urteil{display:inline-flex;align-items:center;gap:8px;padding:5px 11px 5px 8px;border-radius:999px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.16);font-size:11.5px;letter-spacing:.06em;color:#fff}
.cb .cb-kern{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px}
.cb .cb-kern div{padding:9px 11px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
.cb .cb-kern b{display:block;font-weight:300;font-size:19px;color:#fff;line-height:1.1}
.cb .cb-kern span{display:block;margin-top:3px;font-size:10.5px;line-height:1.4;color:#a9bad2}
.cb h3.cb-sek{margin:26px 0 0;font-weight:400;font-size:18px;color:var(--cb-tinte)}
.cb .cb-sek-sub{margin:4px 0 0;font-size:12px;color:var(--cb-leise)}
.cb .cb-legende{margin-top:8px;display:flex;flex-wrap:wrap;gap:6px 16px;font-size:11.5px}
.cb .cb-legende span{display:inline-flex;align-items:center;gap:6px}
.cb .cb-kacheln{margin-top:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:9px}
.cb .cb-kachel{display:block;padding:13px;border-radius:10px;background:var(--cb-papier);border:1px solid var(--cb-linie);color:inherit;break-inside:avoid;page-break-inside:avoid}
.cb .cb-kkopf{display:flex;justify-content:space-between;align-items:center}
.cb .cb-knr{font-size:10.5px;letter-spacing:.14em;color:var(--cb-leise)}
.cb .cb-kachel h4{margin:9px 0 0;font-weight:400;font-size:14.5px;color:var(--cb-tinte);letter-spacing:0;text-transform:none}
.cb .cb-kachel p{margin:5px 0 0;font-size:11.5px;line-height:1.5}
.cb .cb-pille{display:inline-flex;align-items:center;gap:5px;padding:2px 9px 2px 5px;border-radius:999px;background:var(--cb-stein);border:1px solid var(--cb-linie);font-size:10.5px;font-weight:500;color:var(--cb-tinte);white-space:nowrap}
.cb .cb-beleg{margin-top:9px;display:flex;align-items:center;gap:8px}
.cb .cb-bahn{flex:1;height:4px;border-radius:4px;background:var(--cb-linie);overflow:hidden}
.cb .cb-bahn span{display:block;height:100%;background:var(--cb-navy)}
.cb .cb-beleg-txt{font-size:10.5px;color:var(--cb-leise);white-space:nowrap}
.cb .cb-auflagen{margin-top:10px;padding:13px 16px;border-radius:10px;background:var(--cb-papier);border:1px solid var(--cb-linie);border-left:3px solid var(--cb-navy)}
.cb .cb-auflagen ol{margin:0;padding-left:18px}.cb .cb-auflagen li{margin-top:5px;font-size:12.5px;color:var(--cb-tinte)}
.cb .cb-bereich{margin-top:22px;padding-top:12px;border-top:1px solid var(--cb-linie-2)}
.cb .cb-bkopf{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.cb .cb-bnr{font-size:22px;font-weight:300;color:var(--cb-linie-2)}
.cb .cb-bereich h4.cb-btitel{margin:0;flex:1;min-width:180px;font-weight:400;font-size:17px;color:var(--cb-tinte);text-transform:none;letter-spacing:0}
.cb .cb-bkurz{margin:9px 0 0;font-size:14px;font-weight:300;line-height:1.5;color:var(--cb-navy)}
.cb .cb-bereich>p{margin:8px 0 0;font-size:12.5px}
.cb strong{font-weight:500;color:var(--cb-tinte)}
.cb .cb-tab{margin-top:12px;overflow-x:auto;border:1px solid var(--cb-linie);border-radius:8px}
.cb table{width:100%;border-collapse:collapse;font-size:11px;line-height:1.45;table-layout:fixed}
.cb th{text-align:left;padding:7px 9px;background:var(--cb-stein);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--cb-leise);font-weight:500;border-bottom:1px solid var(--cb-linie)}
.cb td{padding:7px 9px;border-bottom:1px solid var(--cb-linie);vertical-align:top;color:var(--cb-tinte);overflow-wrap:break-word;hyphens:auto}
.cb tr{break-inside:avoid;page-break-inside:avoid}
.cb tr:last-child td{border-bottom:0}
.cb td.cb-num{color:var(--cb-leise)}
.cb .cb-pr{display:inline-block;padding:1px 7px;border-radius:999px;font-size:10px;white-space:nowrap;border:1px solid var(--cb-linie);background:var(--cb-stein)}
.cb .cb-pr-bestaetigt{background:#ecfdf3;border-color:#bbe6c8;color:#14532d}
.cb .cb-pr-korrigiert{background:#eef3fe;border-color:#c7d6fb;color:#1e3a8a}
.cb .cb-pr-unbelegt{background:#fff7ed;border-color:#fed7aa;color:#7c2d12}
.cb .cb-ng{margin-top:12px;padding:11px 13px;border-radius:9px;background:var(--cb-stein);border:1px dashed var(--cb-linie-2)}
.cb h5{margin:0;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--cb-leise);font-weight:500}
.cb .cb-ng ul,.cb .cb-cr ul{margin:6px 0 0;padding-left:17px}
.cb .cb-ng li,.cb .cb-cr li{margin-top:4px;font-size:12px}
.cb .cb-cr{margin-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cb .cb-zwei{margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px}
.cb .cb-liste{padding:13px 15px;border-radius:10px;background:var(--cb-papier);border:1px solid var(--cb-linie)}
.cb .cb-liste ul{margin:0;padding:0}.cb .cb-liste li{list-style:none;margin-top:9px;font-size:12px}
.cb .cb-liste li b{display:block;font-weight:400;font-size:13.5px;color:var(--cb-tinte)}
.cb .cb-methodik{margin:8px 0 0;padding-left:18px}.cb .cb-methodik li{margin-top:5px;font-size:12px}
.cb .cb-fuss{margin-top:20px;padding-top:9px;border-top:1px solid var(--cb-linie-2);font-size:10.5px;color:var(--cb-leise)}
@media (max-width:640px){.cb .cb-tafel{grid-template-columns:1fr;padding:18px 16px}.cb .cb-cr,.cb .cb-zwei{grid-template-columns:1fr}.cb table{min-width:560px}}
@media print{.cb .cb-tab{overflow:visible}.cb .cb-bereich{break-before:page}}
`;

/**
 * Der Prüfbericht als HTML — gestaltet wie das Werkzeug des Unternehmensberaters (Ampelturm, Kernzahlen, Kacheln mit
 * „belegt“-Balken, Tabellen je Bereich), Kundenfassung. Für Anlage 2 im Vertrag und für das PDF allein.
 */
export function complianceHtml(c: ComplianceKundenfassung, opts: { titel?: string; ref?: string } = {}): string {
  const m = c.meta; const g = c.gesamt;
  const id = `cb${Math.abs(String(opts.ref ?? m.firma).split("").reduce((h, z) => (h * 31 + z.charCodeAt(0)) | 0, 7)).toString(36)}`;
  const kacheln = c.bereiche.map((b) => {
    const z = complianceBelegt(b);
    return `<a class="cb-kachel" href="#${id}-b${b.nr}"><div class="cb-kkopf"><span class="cb-knr">${String(b.nr).padStart(2, "0")}</span>${pille(b.ampel)}</div><h4>${escHtml(b.titel)}</h4><p>${fl(b.kurz)}</p>${z.n ? `<div class="cb-beleg"><div class="cb-bahn"><span style="width:${Math.round((z.ok / z.n) * 100)}%"></span></div><span class="cb-beleg-txt">${z.ok}/${z.n} belegt</span></div>` : ""}</a>`;
  }).join("");
  const bereich = (b: ComplianceBereich) => `<section class="cb-bereich" id="${id}-b${b.nr}">
<div class="cb-bkopf"><span class="cb-bnr">${String(b.nr).padStart(2, "0")}</span><h4 class="cb-btitel">${escHtml(b.titel)}</h4>${pille(b.ampel)}</div>
<p class="cb-bkurz">${fl(b.kurz)}</p>
${b.urteil.map((x) => `<p>${fl(x)}</p>`).join("")}
${b.befunde.length ? `<div class="cb-tab"><table><colgroup><col style="width:8%"><col style="width:47%"><col style="width:21%"><col style="width:12%"><col style="width:12%"></colgroup><thead><tr><th>#</th><th>Befund</th><th>Quelle</th><th>Stand</th><th>Prüfung</th></tr></thead><tbody>${b.befunde.map((f, i) => {
    const pr = PRUEF_TEXT[f.pruefung] ?? f.pruefung; const kl = pr === "bestätigt" ? "bestaetigt" : pr === "korrigiert" ? "korrigiert" : pr === "unbelegt" ? "unbelegt" : "andere";
    const url = ersteUrl(f.quelle_url);
    return `<tr><td class="cb-num">${b.nr}.${i + 1}</td><td>${fl(f.aussage)}</td><td>${url ? `<a href="${escHtml(url)}">${escHtml(f.quelle_name)}</a>` : escHtml(f.quelle_name)}</td><td class="cb-num">${escHtml(f.stand)}</td><td><span class="cb-pr cb-pr-${kl}">${escHtml(pr)}</span></td></tr>`;
  }).join("")}</tbody></table></div>` : ""}
${b.nicht_geprueft.length ? `<div class="cb-ng"><h5>Nicht geprüft</h5><ul>${b.nicht_geprueft.map((n) => `<li><strong>${escHtml(n.punkt)}</strong> — ${escHtml(n.grund)}</li>`).join("")}</ul></div>` : ""}
${b.chancen.length || b.risiken.length ? `<div class="cb-cr"><div><h5>Chancen</h5><ul>${b.chancen.map((x) => `<li>${fl(x)}</li>`).join("")}</ul></div><div><h5>Risiken</h5><ul>${b.risiken.map((x) => `<li>${fl(x)}</li>`).join("")}</ul></div></div>` : ""}
</section>`;
  return `<div class="cb" lang="de">
<p class="cb-auge">FIAON Global · Prüfbericht</p>
<h2 class="cb-h1">${escHtml(opts.titel ?? m.firma)}</h2>
<p class="cb-unter">${escHtml(m.anlass)} · Prüfdatum ${escHtml(m.pruefdatum)} · Datenstand ${escHtml(m.datenstand)}</p>
${m.kopf.length ? `<dl class="cb-meta">${m.kopf.map(([k, v]) => `<div><dt>${escHtml(k)}</dt><dd>${escHtml(v)}</dd></div>`).join("")}</dl>` : ""}
<section class="cb-tafel" aria-label="Gesamtergebnis">${ampelTurm(g.ampel, id)}<div>
<span class="cb-urteil">${ampelIcon(g.ampel, 15)} Gesamtampel ${COMPLIANCE_AMPEL[g.ampel].wort.toUpperCase()}</span>
<h3>${escHtml(g.titel)}</h3>${g.text.map((x) => `<p>${fl(x)}</p>`).join("")}
${g.kernzahlen.length ? `<div class="cb-kern">${g.kernzahlen.map((k) => `<div><b>${escHtml(k.wert)}</b><span>${escHtml(k.text)}</span></div>`).join("")}</div>` : ""}
</div></section>
<h3 class="cb-sek">Ampel je Bereich</h3>
<p class="cb-sek-sub">Jeder Bereich mit eigener Ampel. Der Balken zeigt, wie viele Aussagen an der Quelle gegengeprüft und bestätigt wurden.</p>
<div class="cb-legende">${AMPELN.map((a) => `<span>${ampelIcon(a, 14)} ${COMPLIANCE_AMPEL[a].wort} — ${COMPLIANCE_AMPEL[a].satz}</span>`).join("")}</div>
<div class="cb-kacheln">${kacheln}</div>
${g.auflagen.length ? `<h3 class="cb-sek">Auflagen vor der Finanzierung</h3><div class="cb-auflagen"><ol>${g.auflagen.map((a) => `<li>${fl(a)}</li>`).join("")}</ol></div>` : ""}
${c.bereiche.map(bereich).join("\n")}
${c.chancen.length || c.schwaechen.length ? `<h3 class="cb-sek">Chancen und Schwächen auf einen Blick</h3><div class="cb-zwei"><div class="cb-liste"><h5>Chancen</h5><ul>${c.chancen.map((x) => `<li><b>${escHtml(x.titel)}</b>${fl(x.text)}</li>`).join("")}</ul></div><div class="cb-liste"><h5>Schwächen</h5><ul>${c.schwaechen.map((x) => `<li><b>${escHtml(x.titel)}</b>${fl(x.text)}</li>`).join("")}</ul></div></div>` : ""}
${c.methodik.length ? `<h3 class="cb-sek">Methodik und Grenzen</h3><ul class="cb-methodik">${c.methodik.map((x) => `<li>${fl(x)}</li>`).join("")}</ul>` : ""}
${c.fuss ? `<p class="cb-fuss">${fl(c.fuss)}</p>` : ""}
</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER RUMPF (Vertrag + Annahmeblock + Anlage 1 + Anlage 2) — dieselbe Quelle für Bildschirm, Prüfsumme und PDF
// ═══════════════════════════════════════════════════════════════════════════
function ziffernHtml(ziffern: AngebotZiffer[], klasse = "gv-ziffer"): string {
  return ziffern.map((z) => {
    const mehrere = z.absaetze.length > 1;
    const bloecke = z.absaetze.map((a, i) => {
      // Die Absatznummer steht in eigenem Element: Der Leser der Seite rückt sie in den Rand (hängender Einzug), das PDF setzt sie im Fluss.
      const nr = mehrere ? `<span class="gv-abs">(${i + 1})</span> ` : "";
      if (a.art === "p") return `<p>${nr}${escHtml(a.text)}</p>`;
      const kopf = a.einleitung ? `<p>${nr}${escHtml(a.einleitung)}</p>` : "";
      return `${kopf}<ul>${a.zeilen.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>`;
    });
    const [erster, ...rest] = bloecke.join("").match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [];
    return `<section class="${klasse}" id="ziffer-${z.nr}"><div class="gv-anfang"><h2><span class="gv-nr">${z.nr}</span>${escHtml(z.titel)}</h2>${erster ?? ""}</div>${rest.join("")}</section>`;
  }).join("\n");
}
function zeitText(am: Date): string {
  const tag = am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const zeit = am.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return `${tag} um ${zeit} Uhr (Europe/Berlin)`;
}
/** Eine gespeicherte Unterschrift als data:-Adresse — nur ein echtes PNG in Base64 (nie fremder Inhalt im src-Attribut). */
function unterschriftBild(png: unknown): string | null {
  const m = String(png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]{100,})$/);
  return m ? `data:image/png;base64,${m[1]}` : null;
}
/** Die Unterschrift im Annahmevermerk (Runde 2, Punkt 11): das Bild (gezeichnet bzw. aus dem getippten Namen gesetzt) oder der Name in Schreibschrift. */
function unterschriftHtml(u: FirmaUnterschriftVermerk): string {
  const bild = unterschriftBild(u.png);
  const art = u.art === "gezeichnet" ? "von Hand gezeichnet" : `Name getippt: ${escHtml(u.name ?? "")}`;
  const zeichen = bild
    ? `<img class="gv-unterschrift-bild" src="${bild}" alt="Unterschrift" style="display:block;max-width:240px;max-height:80px;margin:4px 0 2px" />`
    : `<span class="gv-unterschrift-getippt" style="display:block;font-family:'Mrs Saint Delafield','Snell Roundhand','Apple Chancery','Dancing Script',cursive;font-size:30px;line-height:1.1;color:#1b3866;margin:4px 0 2px">${escHtml(u.name ?? "")}</span>`;
  return `${zeichen}<span class="gv-leise" style="font-size:8pt">Unterschrift (${art})</span>`;
}
function firmaAnnahmeBlock(d: FirmaDaten, a: FirmaAnnahmeVermerk | null): string {
  const k = d.kunde; const name = firmaVertreterName(k);
  // Fassung C: Angenommen wird mit Unterschrift und Klick — der Satz steht im Rumpf (Prüfsumme), die Unterschrift im Vermerk (nicht).
  const kunde = a
    ? `${a.unterschrift ? unterschriftHtml(a.unterschrift) : ""}<span>Angenommen mit Unterschrift und Klick auf „${escHtml(FIRMA_KNOPF)}“</span>`
    : `<span class="gv-leise">Wird mit Unterschrift und Klick auf „${escHtml(FIRMA_KNOPF)}“ angenommen.</span>`;
  const start = a?.starttag ? `<br/>Starttag: ${escHtml(firmaTag(a.starttag))}${a.sofort ? " (sofort mit der Annahme)" : " (gewählt)"}` : "";
  const zeichnung = a?.unterschrift ? `<br/>Unterschrift: ${a.unterschrift.art === "gezeichnet" ? "von Hand gezeichnet" : `Name getippt („${escHtml(a.unterschrift.name ?? "")}“)`}, gespeichert mit Zeit und IP-Adresse` : "";
  const meta = a
    ? `<div class="meta">Angenommen für ${escHtml(k.firma.name)} von ${escHtml(name)}, ${escHtml(k.vertretung.funktion)}, am ${escHtml(zeitText(a.am))}${start}${zeichnung}<br/>Bestätigt: Unternehmergeschäft ohne Widerrufsrecht; Vertretungsbefugnis<br/>IP-Adresse: ${escHtml(a.ip || "—")}<br/>Browser: ${escHtml(String(a.userAgent || "—").slice(0, 220))}<br/>Prüfsumme des Vertragstextes einschließlich der Anlagen (SHA-256): <span class="hash">${escHtml(a.hash)}</span></div>`
    : "";
  return `
  <div class="sig-grid gv-sig">
    <div class="sig-col">
      <div class="gv-sig-kopf">Für FIAON</div>
      <div class="gv-sig-feld">FIAON LTD — elektronisch ausgefertigt</div>
      <div class="sig-line">${escHtml(FIAON_FIRMA.director)}, Director</div>
    </div>
    <div class="sig-col">
      <div class="gv-sig-kopf">Für die Auftraggeberin</div>
      <div class="gv-sig-feld">${kunde}</div>
      <div class="sig-line">${escHtml(k.firma.name)}, vertreten durch ${escHtml(name)}${a ? `, ${escHtml(k.firma.ort)}, ${escHtml(a.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}` : ""}</div>
      ${meta}
    </div>
  </div>`;
}
/** Der Wortlaut der Anlage 1 ohne Unterschriftsblock — das, was das unterschriebene Original tragen muss. */
export function firmaAnlage1Wortlaut(d: FirmaDaten): string {
  return `<h2>${escHtml(firmaAnlage1Titel(d))}</h2>
    <p class="gv-leise">zum Vertrag „${escHtml(firmaVertragTitel())}“ zwischen der FIAON LTD und ${escHtml(d.kunde.firma.name)} · Angebot ${escHtml(d.ref)}</p>
    ${firmaAnlage1Parteien(d).map((x) => `<p>${escHtml(x)}</p>`).join("\n    ")}
    ${ziffernHtml(firmaAnlage1Ziffern(d), "gv-ziffer gia-anlage-ziffer")}`;
}
/** Anlage 1 mit Unterschriftsblock. `pruefsumme` rechnet der Server (docHash über firmaAnlage1Wortlaut). */
export function firmaAnlage1Html(d: FirmaDaten, pruefsumme: string): string {
  const u = firmaAnlage1Unterschrift(d);
  return `
  <section class="gv-anlage" id="anlage-1">
    ${firmaAnlage1Wortlaut(d)}
    <div class="gv-schluss gia-buergin-sig">
      <div class="gv-sig-kopf">${escHtml(u.kopf)}</div>
      <div class="gv-sig-feld"><span class="gv-leise">Ort, Datum und eigenhändige Unterschrift auf dem Original</span></div>
      <div class="sig-line">${escHtml(u.zeile)}</div>
      <div class="gv-sig-feld"><span class="gv-leise">${escHtml(u.zeuge)}</span></div>
      <p class="gv-leise">${escHtml(u.vermerk)}</p>
      <p class="gv-leise">Prüfsumme dieser Fassung der Anlage 1 (SHA-256): <span class="hash">${escHtml(pruefsumme)}</span></p>
    </div>
  </section>`;
}
export const FIRMA_ANLAGE2_TITEL = "Anlage 2 — Prüfbericht (Fassung für die Auftraggeberin)";
export function firmaAnlage2Html(d: FirmaDaten): string {
  if (!d.compliance) return `<section class="gv-anlage" id="anlage-2"><h2>${escHtml(FIRMA_ANLAGE2_TITEL)}</h2><p class="gv-leise">[noch einzutragen: Prüfbericht]</p></section>`;
  return `<section class="gv-anlage" id="anlage-2"><h2>${escHtml(FIRMA_ANLAGE2_TITEL)}</h2>${complianceHtml(d.compliance, { ref: d.ref })}</section>`;
}
/**
 * Der Rumpf: Präambel, zwanzig Ziffern, Annahmeblock, Anlage 1, Anlage 2. Die Prüfsumme läuft über den Rumpf OHNE
 * Annahmevermerk (annahme = null). `anlage1Summe` = Prüfsumme des Wortlauts der Anlage 1 (vom Server gerechnet).
 */
export function firmaRumpfHtml(d: FirmaDaten, anlage1Summe: string, annahme: FirmaAnnahmeVermerk | null = null): string {
  const ziffern = ziffernHtml(firmaZiffern(d)).split("\n");
  const letzte = ziffern.pop() ?? "";
  return `<div class="gv" lang="de"><section class="gia-praeambel" id="praeambel"><h2>Präambel</h2>${firmaPraeambel(d).map((x) => `<p>${escHtml(x)}</p>`).join("")}</section>
${ziffern.join("\n")}
<div class="gv-schluss">${letzte}${firmaAnnahmeBlock(d, annahme)}</div>
${firmaAnlage1Html(d, anlage1Summe)}
${firmaAnlage2Html(d)}</div>`;
}
/** Was in die Prüfsumme des Vertrags geht — der Server rechnet docHash(firmaHashEingabe(…)). */
export function firmaHashEingabe(d: Pick<FirmaDaten, "ref" | "fassung">, rumpfOhneAnnahme: string): string {
  return `global-angebot-firma|${d.ref}|${d.fassung}|${rumpfOhneAnnahme}`;
}
export function firmaAnlage1HashEingabe(d: FirmaDaten): string {
  return `global-angebot-firma-anlage1|${d.ref}|${ANLAGE1_FIRMA_FASSUNG}|${firmaAnlage1Wortlaut(d)}`;
}
/** Reiner Text aus HTML — für Prüfstand und Wortwand. */
export function htmlZuText(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<\/(p|li|h2|h3|h4|h5|section|div|tr|th|td|dd|dt)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// BESTELLÜBERSICHT UND ANNAHME (unmittelbar über dem Knopf)
// ═══════════════════════════════════════════════════════════════════════════
export function firmaBestellUebersicht(d: FirmaDaten): FirmaBestellUebersicht {
  const par = d.parameter; const k = d.kunde; const G = firmaGarantie(par);
  return {
    titel: "Unsere Zusammenarbeit im Überblick",
    zeilen: [
      { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}` },
      { label: "Auftraggeberin", wert: `${k.firma.name}, ${anschrift(k)}, UID ${k.firma.uid} — vertreten durch ${firmaVertreterName(k)}, ${k.vertretung.funktion}` },
      { label: "Leistung", wert: "US-Gesellschaft komplett, Strategie & Wachstum, Plattform & Marketing, Vertrieb und ein fester Ansprechpartner — nach dem Vertrag mit zwei Anlagen" },
      { label: "Gründungskosten", wert: `${firmaEur(par.startCents)} einmalig — fällig mit der Annahme` },
      { label: "Wachstumsbudget", wert: `Gemeinsam ${firmaEur(par.budgetGesamtCents)} im Monat, davon Ihr Anteil ${firmaEur(par.monatCents)} — die andere Hälfte trägt FIAON. Ab dem Tag „Shop live“ — spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Annahme, es sei denn, die Verzögerung liegt bei FIAON — monatlich im Voraus, Rechnung am Fälligkeitstag, Zahlungsziel ${zahlwort(par.zahlungszielTage)} Tage` },
      { label: "Umsatzbeteiligung", wert: `${firmaProzent(par.umsatzSatzProzent)} auf den Netto-Umsatz der Gruppe über ${firmaEur(par.umsatzSchwelleCents)} je Kalenderjahr (erstes Jahr anteilig), quartalsweise mit Jahresabgleich — solange der Vertrag läuft oder die Bürgschaft besteht` },
      { label: "Verkaufsbeteiligung", wert: `${firmaProzent(par.verkaufSatzProzent)} der Gegenleistung bei einem Verkauf — während der Laufzeit und ${monateWort(par.verkaufNachlaufMonate)} danach, fällig mit dem Zufluss` },
      { label: "Erste Runde", wert: G.uebersicht },
      { label: "Bürgschaft", wert: `${d.buergin.name}, Höchstbetrag ${firmaUsd(par.buergschaftUsd)}, höchstens ${monateWort(par.buergschaftHoechstMonate)}, ohne gesondertes Entgelt, mit aufschiebenden Bedingungen (Anlage 1)` },
      { label: "Laufzeit", wert: `Beginn mit der Annahme; mindestens ${monateWort(par.mindestMonate)} ab dem Starttag („Shop live“, spätestens ${monateWort(par.budgetSpaetestensMonate)} nach Annahme), danach Verlängerung um je ${monateWort(par.verlaengerungMonate)}; Kündigung ${monateWort(par.kuendigungMonate)} vor Ablauf in Textform` },
      { label: "Umsatzsteuer", wert: "Alle Beträge netto — Steuerschuldnerschaft der Leistungsempfängerin (Reverse Charge)" },
      { label: "Zahlung", wert: "Überweisung auf Rechnung — keine Lastschrift" },
      { label: "Recht", wert: "Englisches Recht, Gerichtsstand London, Vertragssprache Deutsch — Geschäft unter Unternehmern, kein Widerrufsrecht" },
    ],
    fein: [
      "Den Tag „Shop live“ teilen wir Ihnen schriftlich mit — erst dann beginnt das Wachstumsbudget, spätestens aber zum spätesten Starttag nach Ziffer 10 Absatz 2.",
      "Kosten Dritter zahlen Sie direkt und nur nach Ihrer Zustimmung — welche das sind, steht in Ziffer 10 Absatz 6 des Vertrags.",
    ],
  };
}
export function firmaAnnahmeTexte(d: FirmaDaten): FirmaAnnahmeTexte {
  const f = d.kunde.firma; const G = firmaGarantie(d.parameter);
  return {
    titel: "Angebot annehmen",
    sub: "Lesen Sie Vertrag und Anlagen in Ruhe. Mit dem Knopf nehmen Sie das Angebot für Ihr Unternehmen verbindlich an.",
    unternehmer: `Ich nehme dieses Angebot für ${f.name} in Ausübung ihrer gewerblichen Tätigkeit an (Geschäft unter Unternehmern). Mir ist bekannt, dass kein Widerrufsrecht für Verbraucher besteht.`,
    vertretung: `Ich bin berechtigt, ${f.name} bei diesem Vertrag allein zu vertreten.`,
    unterschrift: {
      titel: "Ihre Unterschrift",
      sub: `Zeichnen Sie mit Finger oder Maus — oder tippen Sie Ihren Namen. Sie unterschreiben für ${f.name}.`,
      zeichnen: "Zeichnen", tippen: "Namen tippen", neu: "Neu", platz: "Hier unterschreiben",
      tippenFeld: "Ihr Name", tippenHinweis: `Vor- und Nachname, wie im Vertrag: ${firmaVertreterName(d.kunde)}`,
      vorschau: "So steht Ihre Unterschrift im Vertrag",
      fehlt: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
      fehltName: `Bitte tippen Sie Ihren Namen mit Nachnamen (${String(d.kunde.vertretung?.nachname ?? "").trim()}).`,
    },
    knopf: FIRMA_KNOPF,
    unterKnopf: `Mit Klick nehmen Sie das Angebot verbindlich an; die Gründungskosten von ${firmaEurKurz(d.parameter.startCents)} werden mit der Rechnung fällig, Ihr Anteil am Wachstumsbudget erst ab dem Starttag („Shop live“, spätestens ${monateWort(d.parameter.budgetSpaetestensMonate)} nach Annahme). ${G.annahmeUnterKnopf}`,
    gesperrt: "Dieses Angebot wird gerade vervollständigt. Ihr Ansprechpartner gibt Ihnen Bescheid, sobald Sie es annehmen können.",
  };
}
/** Fehler- und Bestätigungssätze der Annahme (Server-Antworten). */
export const FIRMA_ANNAHME = {
  fehltHaken: "Bitte bestätigen Sie beide Punkte: das Geschäft unter Unternehmern und Ihre Vertretungsbefugnis.",
  fehltUnterschrift: "Bitte unterschreiben Sie — zeichnen Sie im Feld oder tippen Sie Ihren Namen.",
  fehltName: (nachname: string) => `Bitte tippen Sie Ihren Namen mit Nachnamen (${nachname}).`,
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: "Herzlichen Dank. Ihr Auftrag steht.",
  // Fassung D (Ziffer 10 Absatz 2): mit dem spätesten Start („sechs Monate“); ohne ihn (Fassung C) der Satz wie bisher.
  fertigText: (email: string, spaetestens: string | null = null) => `Ihr Vertrag gilt ab heute. Mit der Gründung Ihrer US-Gesellschaft legen wir los, sobald die Gründungskosten eingegangen sind; Ihr Anteil am Wachstumsbudget beginnt erst, wenn Ihr Shop live ist${spaetestens ? `, spätestens ${spaetestens} nach Ihrer Annahme` : ""}. Vertrag und Rechnung finden Sie hier; Ihr Ansprechpartner schickt beides zusätzlich an ${email}.`,
  // Fassungen bis B (Startwahl bei der Annahme) — nur noch für Angebote, die so angenommen wurden.
  fertigSofort: (email: string) => `Ihr Starttag ist heute. Mit der Gründung Ihrer US-Gesellschaft legen wir los, sobald Ihre Zahlung eingegangen ist. Vertrag und Rechnung finden Sie hier; Ihr Ansprechpartner schickt beides zusätzlich an ${email}.`,
  fertigAb: (email: string, tag: string) => `Wie gewünscht ist Ihr Starttag der ${tag}. Mit der Gründung Ihrer US-Gesellschaft legen wir los, sobald Ihre Zahlung eingegangen ist. Vertrag und Rechnung finden Sie hier; Ihr Ansprechpartner schickt beides zusätzlich an ${email}.`,
  fertigFaellig: (betrag: string) => `Heute fällig sind die Gründungskosten über ${betrag}. Bankverbindung, Verwendungszweck und einen QR-Code für Ihre Banking-App finden Sie auf Ihrer Zahlungsseite.`,
  fertigBezahlt: "Ihre Zahlung für die Gründung ist eingegangen — vielen Dank.",
  fertigRechnungFolgt: (betrag: string) => `Heute fällig sind die Gründungskosten über ${betrag}. Ihre Rechnung mit Bankverbindung und Verwendungszweck wird gerade erstellt — Sie müssen nichts weiter tun.`,
  fertigFuss: FIRMA_GARANTIE_FEST.fertigFuss,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// RECHNUNGSTEXTE JE TEIL (server/fiaon-invoice.ts → rechnungsSpracheSetzen → angebotRechnungsZeile)
// ═══════════════════════════════════════════════════════════════════════════
export type FirmaFaelligkeit = "sofort" | "monatlich" | "umsatz" | "verkauf";
export const FIRMA_TEIL_TITEL = {
  gruendung: "Gründung",
  monat: (n: number) => `Wachstumsbudget — Ihr Anteil, Monat ${n}`,
  umsatz: (jahr: number, quartal: number | "jahr") => quartal === "jahr" ? `Umsatzbeteiligung — Jahresabgleich ${jahr}` : `Umsatzbeteiligung — Q${quartal} ${jahr}`,
  verkauf: "Verkaufsbeteiligung",
} as const;
export function firmaTeilPaketname(titel: string): string { return `${FIRMA_PAKETNAME}, ${titel}`; }
export function firmaRechnungsText(z: { angebotRef: string; auftragRef: string; faelligkeit: string; titel: string; zeitraum: string | null; bemessungCents: number | null }): { beschreibung: string; zeitraum: string } {
  const kopf = `${FIRMA_PAKETNAME} ${z.angebotRef}`;
  if (z.faelligkeit === "monatlich") {
    return { beschreibung: `${kopf}: ${z.titel} — Anteil der Auftraggeberin (die Hälfte) am gemeinsamen Wachstumsbudget nach Ziffer 10 Absatz 2 und 3 des Vertrags, monatlich im Voraus, gemäß Auftrag ${z.auftragRef}`, zeitraum: z.zeitraum || "1 Monat" };
  }
  if (z.faelligkeit === "umsatz") {
    return { beschreibung: `${kopf}: ${z.titel} — auf den Netto-Umsatz der Gruppe über der Jahresschwelle${z.bemessungCents != null ? `, gemeldeter kumulierter Netto-Umsatz ${firmaEur(z.bemessungCents)}` : ""}, gemäß Ziffer 11 des Vertrags (Auftrag ${z.auftragRef})`, zeitraum: z.zeitraum || "Quartal" };
  }
  if (z.faelligkeit === "verkauf") {
    return { beschreibung: `${kopf}: ${z.titel}${z.bemessungCents != null ? ` — auf die zugeflossene Gegenleistung von ${firmaEur(z.bemessungCents)}` : ""}, gemäß Ziffer 12 des Vertrags (Auftrag ${z.auftragRef})`, zeitraum: z.zeitraum || "einmalig" };
  }
  return { beschreibung: `${kopf}: Gründung der US-Gesellschaft gemäß Auftrag ${z.auftragRef}`, zeitraum: "einmalig" };
}

/** Für die Seite: die Pflichtfelder der Bürgin aus der Vorgabe (dieselbe Quelle wie das Individualangebot). */
export const FIRMA_BUERGIN_VORGABE: AngebotBuergin = { ...BUERGIN_VORGABE };
