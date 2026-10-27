// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS KAPITAL-ANGEBOT, FASSUNG C: FÜR PRIVATPERSONEN (Register E-432, 27.10.2026)
//
// Justin (27.10.2026): „JEDER eine US Gesellschaft … JEDER 250.000 EUR (umgerechnet in Dollar) Finanzierung mit uns als
// Bürgen für ein Immo Projekt in den VAE … die ersten 6 Monate Ratenfrei, danach wählbar bei einer Laufzeit von 5-15 Jahren,
// die ersten 16 Monate sind Zinsfrei, danach startet der Zins bei 1.5% und jedes Jahr erhöht sich dieser um 0.5% … Wir
// brauchen für beide eine eigene Vertragsseite, wo sie die Laufzeit wählen können und daraus auch die monatliche Rate sehen
// und den LLC Namen. … nur noch Laufzeit, Name und Unterschrift, es muss sich perfekt anfühlen.“
//
// ── WARUM EINE EIGENE FASSUNG ──────────────────────────────────────────────
// Fassung A/B (E-399/E-400) schließen mit einem UNTERNEHMEN (kein Widerruf, Reverse Charge, Prüfbericht als Anlage).
// Fassung C schließt mit einer PRIVATPERSON: Verbrauchervertrag mit Widerrufsbelehrung und Muster-Formular (Anlage),
// Informationen vor Vertragsschluss (Art. 246a EGBGB), Knopf „zahlungspflichtig“ (§ 312j BGB), Endpreise, Fast-Track nur mit
// ausdrücklichem Verlangen des Sofortbeginns (§ 356 Abs. 4, § 357a Abs. 2 BGB). Alles ist PARAMETER — der zweite Kunde
// bekommt dieselbe Fassung mit seiner eigenen privaten Angebotsdatei (scripts/angebot-kapital-anlegen.ts).
//
// ── JUSTINS ENTSCHEIDUNGEN (27.10.2026), HIER UMGESETZT ─────────────────────
//   · Kosten OFFEN und vollständig, aber ruhig: Finanzierung und Monatsrate stehen groß oben, „Ihre Investition“ weiter unten
//     (heute 2.790 € + 499 € Fast-Track, mit der Eintragung 6.890 € Erfolgshonorar inkl. Bürgschaft, ab Jahr 2 699 €/Jahr).
//   · KEIN Bankname — „eine US-Bank“ / „das finanzierende Institut“. Keine Kartenrahmen, kein „bis zu“, kein „60x“.
//   · Geld-zurück-Garantie: Wird die Finanzierung nicht binnen acht Wochen ab Auftragserteilung ausgezahlt, erhält der Kunde alles
//     Gezahlte zurück (Ruhen wie Fassung B, enger). Ziel mit Fast-Track: vier Wochen — als Ziel, nie als Garantie.
//   · Bürgschaft der US-Partnergesellschaft wie Fassung B, Ziffer 5 — MIT dem Satz zum Registerstand der Bürgin.
//   · Banking stellt der Kunde selbst; FIAON bereitet vor und begleitet (global-alles-abnehmen-vollmacht).
//
// ── NACHPRÜFUNG (27.10.2026, vier Gutachten: Recht, Rechnung, Gestaltung, Daten) ─────────────────────
//   · FIAON BEGLEITET bis zur Finanzierung (kein „führt zu“, keine „eigene Finanzierungsbank“); über die Finanzierung entscheidet das
//     Institut. Der Gründungspreis deckt Ziffer 2 und 3 — für die Finanzierung weist der Vertrag keine eigene Vergütung aus.
//   · Die Garantie heißt überall „Geld-zurück-Garantie“ — nie „Auszahlung garantiert“, nie „sicher“.
//   · Persönliche Haftung offen: „Ihre Verantwortung“ am Rechner, in Übersicht und Informationen; keine Ausstattungspflicht ohne Grenze.
//   · Registerstand der Bürgin offen (Parameter buerginAktiv/buerginStandAm): inaktiv → Satz in Ziffer 5 und in den Fragen.
//   · Gesamtpreis des ersten Jahres (10.179 €) in Investition, Übersicht, Informationen. ITIN nur nach ITIN-Check (E-437).
//   · Auf der Seite und im Entwurfs-PDF stehen die Ausweisnummern gekürzt; vollständig nur im angenommenen Vertrag und in der Akte.
//
// ── NACHPRÜFUNG RUNDE 2 (27.10.2026, Recht, Gestaltung, Technik, Kundensicht) ─────────────────────
//   · Bürgschaft offen erklärt: verbundenes Unternehmen beim Namen, längstens 36 Monate, Rückgriff nur über Ziffer 5 Abs. 5,
//     Registerstand MIT Folge (bürgt sie nicht rechtzeitig, greift die Geld-zurück-Garantie — auch für das Erfolgshonorar).
//   · Ruhen der Frist mit Ende: Ein Angebot nach Absatz 2 lässt sie ruhen, solange es offensteht; lehnt die Gesellschaft es ab,
//     entfällt die Garantie. Begleitung bei Aufstockung/Umschuldung (ab Monat 18) gehört zur Jahresbetreuung (Ziffer 6 Abs. 3).
//   · Die erste Jahresmeldung beim Bundesstaat (Annual Report) ist im ersten Jahr enthalten — „Im ersten Jahr ist alles enthalten“.
//   · „Mit Ihrem Auftrag“ statt „heute“; Haken „gelesen“ entfällt — die Unterschrift bestätigt den Satz darüber (ein Haken bleibt:
//     Fast-Track). Kundensicht ohne interne Kennung („Vertragsstand 27.10.2026“), Beschwerdeweg in Ziffer 14.
//
// ── DER RECHNER (rein, kapitalCPlan) ───────────────────────────────────────
// Laufzeit T Jahre = N = 12·T Monatsraten ab Monat (ratenfrei + 1). Zins je Monat m: 0 für m ≤ zinsfrei, sonst
// (Start + Schritt · floor((m − zinsfrei − 1) / 12)) / 12. Gleichbleibende Rate R aus den Abzinsungsfaktoren
// (Saldo nach den ratenfreien Monaten = Σ R · D_m), auf Cent gerundet; der Restbetrag (bis rund 1 €) steht in der letzten Rate —
// sie wird überall offen genannt, sobald sie von der Monatsrate abweicht. Der Monatszins in Cent rechnet aus ganzen Zahlen
// (Saldo · Basispunkte / 120.000, kaufmännisch gerundet) — Kommazahlen runden halbe Cent sonst manchmal ab.
// Prüfstand: scripts/pruef-kapital-fassung-c.ts (unabhängige Nachrechnung in BigInt für T = 5 … 15 und viele Beträge, Grenzfälle).
//
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Kundendaten. Alles Persönliche kommt aus der privaten
// Angebotsdatei in die Datenbank (fiaon_global_angebote.kunde / .parameter) und nur über den persönlichen Link auf die Seite.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { GLOBAL_KAPITAL_FREI, globalAgentVertrag } from "./fiaon-global";
import { BEFUGNISSE_TITEL, befugnisseAbsaetze } from "./fiaon-global-befugnisse";
import { ANGEBOT_PFLICHTHINWEIS, ANGEBOT_ANSPRECHPARTNER, type AngebotAbsatz, type AngebotZiffer } from "./fiaon-global-angebot";
import { zahlwort } from "./fiaon-global-angebot-firma";
import { escHtml, BEGLEIT_LLC_TEXTE, type BegleitLlcWahl } from "./fiaon-global-angebot-begleit";
import { globalWiderrufsbelehrung } from "./fiaon-global-widerruf";
import type { FirmaAnnahmeTexte, FirmaPhase, FirmaUnterschriftEingabe } from "./fiaon-global-angebot-firma-typen";
import {
  KAPITAL_C_FASSUNG, KAPITAL_KNOPF, kapitalEur, kapitalTag, kapitalProzent,
  type KapitalBuergin, type KapitalUnterschriftVermerk,
} from "./fiaon-global-angebot-kapital";

export { KAPITAL_C_FASSUNG };
export const KAPITAL_C_MARKE = "FIAON Global · Ihre Finanzierung";
export const KAPITAL_C_GUELTIG_TAGE = 14;
// Kein „Finanzierungsbegleitung“ im Rechnungstitel: Der Gründungspreis deckt Ziffer 2 und 3 (Nachprüfung 27.10., § 34c GewO).
export const KAPITAL_C_TEIL1_TITEL = "Gründung, Konto und Karten sowie Fast-Track";
export const KAPITAL_C_TEIL2_TITEL = "Erfolgshonorar einschließlich Bürgschaft";

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
export type KapitalCLand = "DE" | "AT" | "CH";
export interface KapitalCAusweis {
  art: "reisepass" | "personalausweis";
  nummer: string;
  /** JJJJ-MM-TT */
  gueltigBis: string;
  behoerde: string;
}
/** Der Auftraggeber: eine Privatperson. Anrede/Vor-/Nachname/E-Mail stehen OBEN (Aufruf-Meldungen, Konto-Suche lesen sie dort). */
export interface KapitalCKunde {
  art: "privat";
  anrede: "Herr" | "Frau" | "";
  vorname: string;
  nachname: string;
  /** JJJJ-MM-TT */
  geburtsdatum: string;
  geburtsort: string;
  staatsangehoerigkeit: string;
  strasse: string;
  plz: string;
  ort: string;
  land: KapitalCLand;
  email: string;
  telefon: string;
  ausweise: KapitalCAusweis[];
}
export interface KapitalCProjekt {
  /** z. B. „Immobilienprojekt“ */
  art: string;
  /** z. B. „in den Vereinigten Arabischen Emiraten“ (mit Präposition, so steht es im Satz) */
  wo: string;
  /** kurz für Überschriften: „in den Emiraten“ */
  woKurz: string;
  bezahltProzent: number;
  /** JJJJ-MM-TT */
  fertigstellung: string;
}
export interface KapitalCParameter {
  /** Endpreise in Cent: Gründung (Jahr 1), Fast-Track, Erfolgshonorar bei Eintragung, Jahresbetreuung ab Jahr 2 */
  gruendungCents: number;
  fastTrackCents: number;
  erfolgCents: number;
  jahresCents: number;
  zahlungszielTage: number;
  /** Die Finanzierung: Betrag in Euro (Cent), ausgezahlt in US-Dollar zum EZB-Referenzkurs des Auszahlungstags */
  betragCents: number;
  /** EZB-Referenzkurs beim Anlegen (1 € = x US-$) und sein Tag — nur für die Schätzung in US-Dollar auf der Seite */
  kursUsdJeEur: number;
  kursDatum: string;
  ratenfreiMonate: number;
  zinsfreiMonate: number;
  zinsStartBp: number;
  zinsSchrittBp: number;
  laufzeitMinJahre: number;
  laufzeitMaxJahre: number;
  /** Die Laufzeit, mit der die Seite öffnet (der Kunde wählt; erst seine Wahl steht im Vertrag) */
  laufzeitVorschlagJahre: number;
  /** Ab diesem Monat Aufstockung oder Umschuldung auf Wunsch */
  aufstockungAbMonat: number;
  projekt: KapitalCProjekt;
  /** Garantie: Auszahlung binnen so vielen Wochen ab Auftragserteilung, Erstattung binnen so vielen Tagen; Ziel mit Fast-Track */
  garantieWochen: number;
  erstattungTage: number;
  zielWochen: number;
  bundesstaat: string;
  /** Längste Laufzeit der Bürgschaft in Monaten (wie Fassung B, Ziffer 5) */
  buergschaftMonate: number;
  /**
   * Registerstand der Bürgin beim Anlegen (Sunbiz o. Ä.): true = aktiv. Vorgabe false — dann sagt Ziffer 5 offen, dass sie derzeit
   * als inaktiv geführt wird und erst nach der Reaktivierung bürgt (Verbraucher, § 5a UWG). Nach dem Reinstatement: true setzen.
   */
  buerginAktiv: boolean;
  /** Tag der letzten Registerprüfung (JJJJ-MM-TT) — steht als „Stand …“ im Satz; leer = ohne Datum */
  buerginStandAm: string;
  /**
   * Justin 27.10.2026: „wenn ich GO sage, dann live stellen, sodass er unterschreiben kann“. Die Seite ist vorher schon sichtbar,
   * unterschreiben (annehmen) geht erst mit true. Vorgabe false: Knopf gesperrt („wird gerade vervollständigt“), die Annahme
   * antwortet 409. Freigeben: private Datei mit true neu einlesen (scripts/angebot-kapital-anlegen.ts trägt ins offene Angebot ein).
   */
  unterschriftFrei: boolean;
  /** Begleitung ab der Eintragung (Monate) */
  begleitMonate: number;
  /** Die Unterlagen, die bei Vertragsschluss vorliegen — nur Titel und Eingangstag, nie die Dateien */
  unterlagen: { titel: string; am: string }[];
  ddAbgeschlossen: boolean;
  ansprechpartner: string[];
}
export const KAPITAL_C_VORGABEN: KapitalCParameter = {
  gruendungCents: 279_000,
  fastTrackCents: 49_900,
  erfolgCents: 689_000,
  jahresCents: 69_900,
  zahlungszielTage: 7,
  betragCents: 25_000_000,
  kursUsdJeEur: 1.1188,
  kursDatum: "2026-10-26",
  ratenfreiMonate: 6,
  zinsfreiMonate: 16,
  zinsStartBp: 150,
  zinsSchrittBp: 50,
  laufzeitMinJahre: 5,
  laufzeitMaxJahre: 15,
  laufzeitVorschlagJahre: 10,
  aufstockungAbMonat: 18,
  projekt: { art: "Immobilienprojekt", wo: "in den Vereinigten Arabischen Emiraten", woKurz: "in den Emiraten", bezahltProzent: 60, fertigstellung: "2026-12-31" },
  garantieWochen: 8,
  erstattungTage: 14,
  zielWochen: 4,
  bundesstaat: "Florida",
  buergschaftMonate: 36,
  buerginAktiv: false,
  buerginStandAm: "",
  unterschriftFrei: false,
  begleitMonate: 12,
  unterlagen: [],
  ddAbgeschlossen: true,
  ansprechpartner: ["justin"],
};
export interface KapitalCDaten {
  ref: string;
  fassung: string;
  kunde: KapitalCKunde;
  buergin: KapitalBuergin;
  parameter: KapitalCParameter;
  gueltigBis: string;
}
/** Was der Kunde bei der Annahme wählt — steht im Annahmevermerk, NICHT in der Prüfsumme (der Vertrag regelt die Wahl). */
export interface KapitalCWahl { llc: BegleitLlcWahl; laufzeitJahre: number; sofortBeginn: true }
export interface KapitalCAnnahmeVermerk { am: Date; ip: string; userAgent: string; hash: string; wahl: KapitalCWahl; unterschrift: KapitalUnterschriftVermerk }
export interface KapitalCAnnahmeEingabe {
  textHash: string;
  llc: BegleitLlcWahl;
  laufzeitJahre: number;
  gelesen: boolean;
  sofortBeginn: boolean;
  unterschrift: FirmaUnterschriftEingabe;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN UND NAMEN
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Geschütztes Leerzeichen zwischen Zahl und Einheit (€, US-$, %) und nach „≈“ — damit am Handy nie „≈ | 2.611 US-$“ oder
 * „2.333,86 | €“ umbricht (Nachprüfung 27.10.). Prüfstände glätten es mit /\s+/ (\s trifft auch U+00A0).
 */
export const KAPITAL_C_NB = " ";
const NB = KAPITAL_C_NB;
/** „2.333,86 €“ — Rate und Rechenwerte immer mit Cent. */
export function kapitalCEurCent(cents: number): string {
  return `${(Math.round(cents) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${NB}€`;
}
/** „250.000 €“ / „699 €“ — wie kapitalEur (ganze Euro ohne Cent), mit geschütztem Leerzeichen. */
export function kapitalCEur(cents: number): string {
  return kapitalEur(cents).replace(/ €$/, `${NB}€`);
}
/** „2.611 US-$“ — ganze Dollar (eine Umrechnung ist eine Schätzung). */
export function kapitalCUsd(usd: number): string {
  return `${Math.round(usd).toLocaleString("de-DE")}${NB}US-$`;
}
/** „London, EC1V 2NX“ — die Postleitzahl bleibt beisammen (geschütztes Leerzeichen; Übersicht und Informationen, Runde 2). */
export function kapitalCOrtZeileNb(): string {
  return FIAON_FIRMA.ortZeile.replace(/([A-Z0-9]{2,4}) ([0-9][A-Z]{2})$/, `$1${NB}$2`);
}
/** „≈ 2.611 US-$“ — die Umrechnung, nie getrennt vom Zeichen. */
export function kapitalCUngefaehr(text: string): string {
  return `≈${NB}${text}`;
}
export function kapitalCInUsd(cents: number, kurs: number): number {
  return Math.round((cents / 100) * kurs);
}
/** „1,1188“ */
export function kapitalCKurs(kurs: number): string {
  return kurs.toLocaleString("de-DE", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}
/** „31. Dezember 2026“ */
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export function kapitalCTagLang(iso: string): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${Number(m[3])}. ${MONATE[Number(m[2]) - 1]} ${m[1]}` : "—";
}
/** Ordnungszahl im Dativ: „dem siebzehnten Monat“ — eins bis neunundneunzig. */
export function kapitalCOrdnung(n: number): string {
  const fest: Record<number, string> = { 1: "ersten", 3: "dritten", 7: "siebten", 8: "achten" };
  if (fest[n]) return fest[n];
  return n < 20 ? `${zahlwort(n)}ten` : `${zahlwort(n)}sten`;
}
export function kapitalCName(k: Pick<KapitalCKunde, "vorname" | "nachname">): string {
  return `${String(k.vorname ?? "").trim()} ${String(k.nachname ?? "").trim()}`.trim();
}
export function kapitalCGruss(k: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  return k.anrede && nach ? `${k.anrede} ${nach}` : kapitalCName(k);
}
/** „Herrn Mustermann“ / „Frau Muster“ — nach „für“. */
export function kapitalCGrussAkk(k: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede === "Herr" && nach) return `Herrn ${nach}`;
  if (k.anrede === "Frau" && nach) return `Frau ${nach}`;
  return kapitalCName(k);
}
export function kapitalCAnrede(k: Pick<KapitalCKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede === "Herr" && nach) return `Sehr geehrter Herr ${nach}`;
  if (k.anrede === "Frau" && nach) return `Sehr geehrte Frau ${nach}`;
  return `Guten Tag ${kapitalCName(k)}`;
}
const LAND_NAME: Record<KapitalCLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
const AUSWEIS_NAME: Record<KapitalCAusweis["art"], string> = { reisepass: "Reisepass", personalausweis: "Personalausweis" };
/**
 * Die Ausweisnummer gekürzt — „••••••XYZ“ (nur die letzten drei Zeichen). Für die Seite und das Entwurfs-PDF: Der Link kann
 * weitergeleitet werden, die vollständige Nummer steht nur im angenommenen Vertrag und in der Akte (§ 20 PAuswG, Art. 5 DSGVO).
 */
export function kapitalCAusweisKurz(nummer: string): string {
  const n = String(nummer ?? "").trim();
  return n.length > 3 ? `${"•".repeat(n.length - 3)}${n.slice(-3)}` : "•••";
}
/** Darstellung des Vertrags: `ausweiseGekuerzt` für alles, was über den Link erreichbar ist, solange das Angebot offen ist. */
export interface KapitalCDarstellung { ausweiseGekuerzt?: boolean }
/** „Herr Max Mustermann, geboren am … in …, … Staatsangehöriger, wohnhaft …, ausgewiesen durch …“ — die Vertragszeile. */
export function kapitalCKundeZeile(k: KapitalCKunde, opt: KapitalCDarstellung = {}): string {
  const staat = k.staatsangehoerigkeit ? `, ${k.staatsangehoerigkeit}${k.anrede === "Frau" ? "e Staatsangehörige" : "er Staatsangehöriger"}` : "";
  const ausweise = k.ausweise.map((a) => `${AUSWEIS_NAME[a.art]} Nr. ${opt.ausweiseGekuerzt ? kapitalCAusweisKurz(a.nummer) : a.nummer} (${a.behoerde}, gültig bis ${kapitalTag(a.gueltigBis)})`);
  return `${k.anrede ? `${k.anrede} ` : ""}${kapitalCName(k)}, geboren am ${kapitalTag(k.geburtsdatum)}${k.geburtsort ? ` in ${k.geburtsort}` : ""}${staat}, wohnhaft ${k.strasse}, ${k.plz} ${k.ort}, ${LAND_NAME[k.land] ?? k.land}${ausweise.length ? `, ausgewiesen durch ${ausweise.join(" und ")}` : ""}`;
}
export function kapitalCHeuteCents(par: Pick<KapitalCParameter, "gruendungCents" | "fastTrackCents">): number {
  return par.gruendungCents + par.fastTrackCents;
}
/** Der Gesamtpreis des ersten Jahres: heute fällig + Erfolgshonorar bei Eintragung (§ 3 PAngV, Art. 246a EGBGB). */
export function kapitalCErstesJahrCents(par: Pick<KapitalCParameter, "gruendungCents" | "fastTrackCents" | "erfolgCents">): number {
  return kapitalCHeuteCents(par) + par.erfolgCents;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUFZEIT-RECHNER (rein — Seite, Annahmevermerk, Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
export type KapitalCKonditionen = Pick<KapitalCParameter, "betragCents" | "ratenfreiMonate" | "zinsfreiMonate" | "zinsStartBp" | "zinsSchrittBp" | "laufzeitMinJahre" | "laufzeitMaxJahre" | "kursUsdJeEur">;
/** Zins im Jahr (Basispunkte) im Monat m — 0 in den zinsfreien Monaten, danach die Treppe. */
export function kapitalCZinsBp(monat: number, k: Pick<KapitalCKonditionen, "zinsfreiMonate" | "zinsStartBp" | "zinsSchrittBp">): number {
  if (monat <= k.zinsfreiMonate) return 0;
  return k.zinsStartBp + k.zinsSchrittBp * Math.floor((monat - k.zinsfreiMonate - 1) / 12);
}
export interface KapitalCPlanStufe {
  vonMonat: number; bisMonat: number; zinsBp: number; ratenfrei: boolean;
  /** Zinsen in dieser Stufe und die Restschuld an ihrem Ende (Cent) */
  zinsenCents: number; restschuldCents: number;
}
export interface KapitalCPlan {
  jahre: number; raten: number; ersteRateMonat: number; letzteRateMonat: number;
  monatsrateCents: number; letzteRateCents: number;
  zinsenCents: number; rueckzahlungCents: number;
  /** Der Zins der letzten Rate und der Monat, ab dem er gilt */
  zinsZuletztBp: number; zinsZuletztAbMonat: number;
  treppe: KapitalCPlanStufe[];
  usd: { monatsrate: number; zinsen: number; rueckzahlung: number };
}
export function kapitalCLaufzeitGueltig(jahre: unknown, k: Pick<KapitalCKonditionen, "laufzeitMinJahre" | "laufzeitMaxJahre">): jahre is number {
  return typeof jahre === "number" && Number.isInteger(jahre) && jahre >= k.laufzeitMinJahre && jahre <= k.laufzeitMaxJahre;
}
export function kapitalCLaufzeiten(k: Pick<KapitalCKonditionen, "laufzeitMinJahre" | "laufzeitMaxJahre">): number[] {
  const aus: number[] = [];
  for (let j = k.laufzeitMinJahre; j <= k.laufzeitMaxJahre; j++) aus.push(j);
  return aus;
}
/**
 * Der Plan für T Jahre: gleichbleibende Rate, die das Darlehen unter der Zinstreppe genau tilgt.
 * Geschlossen: Saldo nach den ratenfreien Monaten S = R · Σ_{m} D_m mit D_m = Π_{j ≤ m} (1 + i_j)⁻¹ ab der ersten Rate.
 * Dann monatlich in Cent: Zins gerundet, Rate abgezogen; die letzte Rate nimmt den Rest — der Saldo endet genau bei null.
 */
export function kapitalCPlan(k: KapitalCKonditionen, jahre: number): KapitalCPlan {
  if (!kapitalCLaufzeitGueltig(jahre, k)) throw new RangeError(`Laufzeit ${jahre} liegt nicht zwischen ${k.laufzeitMinJahre} und ${k.laufzeitMaxJahre} Jahren.`);
  const raten = 12 * jahre;
  const erste = k.ratenfreiMonate + 1;
  const letzte = k.ratenfreiMonate + raten;
  const i = (m: number) => kapitalCZinsBp(m, k) / 10_000 / 12;
  // Zins eines Monats in Cent aus GANZEN Zahlen: Saldo (Cent) · Basispunkte / 120.000, kaufmännisch gerundet. Mit Kommazahlen
  // (saldo · 0,075/12) lag der Faktor knapp unter dem exakten Wert — halbe Cent rundeten dann manchmal ab (Nachprüfung 27.10.).
  // Saldo · bp ist eine ganze Zahl < 2^53, die Division ist korrekt gerundet: ein exakt halber Cent bleibt exakt halb.
  const zinsCent = (saldoCents: number, m: number) => Math.round((saldoCents * kapitalCZinsBp(m, k)) / 120_000);
  // Ratenfreie Monate: Zins (falls je einer anfällt) wächst dem Saldo zu.
  let saldo = Math.round(k.betragCents);
  let zinsen = 0;
  const treppe: KapitalCPlanStufe[] = [];
  const stufe = (m: number, ratenfrei: boolean): KapitalCPlanStufe => {
    const bp = kapitalCZinsBp(m, k);
    const letzteStufe = treppe[treppe.length - 1];
    if (!letzteStufe || letzteStufe.zinsBp !== bp || letzteStufe.ratenfrei !== ratenfrei) {
      treppe.push({ vonMonat: m, bisMonat: m, zinsBp: bp, ratenfrei, zinsenCents: 0, restschuldCents: saldo });
    }
    return treppe[treppe.length - 1];
  };
  for (let m = 1; m < erste; m++) {
    const s = stufe(m, true);
    const z = zinsCent(saldo, m);
    saldo += z; zinsen += z;
    s.bisMonat = m; s.zinsenCents += z; s.restschuldCents = saldo;
  }
  let summe = 0; let faktor = 1;
  for (let m = erste; m <= letzte; m++) { faktor /= 1 + i(m); summe += faktor; }
  const rate = Math.round(saldo / summe);
  let letzteRate = rate;
  for (let m = erste; m <= letzte; m++) {
    const s = stufe(m, false);
    const z = zinsCent(saldo, m);
    saldo += z; zinsen += z;
    const zahlung = m === letzte ? saldo : rate;
    if (m === letzte) letzteRate = zahlung;
    saldo -= zahlung;
    s.bisMonat = m; s.zinsenCents += z; s.restschuldCents = saldo;
  }
  const rueckzahlung = Math.round(k.betragCents) + zinsen;
  const zuletzt = treppe[treppe.length - 1];
  return {
    jahre, raten, ersteRateMonat: erste, letzteRateMonat: letzte,
    monatsrateCents: rate, letzteRateCents: letzteRate, zinsenCents: zinsen, rueckzahlungCents: rueckzahlung,
    zinsZuletztBp: kapitalCZinsBp(letzte, k), zinsZuletztAbMonat: zuletzt.vonMonat,
    treppe,
    usd: { monatsrate: kapitalCInUsd(rate, k.kursUsdJeEur), zinsen: kapitalCInUsd(zinsen, k.kursUsdJeEur), rueckzahlung: kapitalCInUsd(rueckzahlung, k.kursUsdJeEur) },
  };
}
/** „vier“ → „Vier“ */
export function gross(t: string): string { return t ? t[0].toUpperCase() + t.slice(1) : t; }
/** „1,5 %“ / „2 %“ — nie „2,0 %“ (die Wortwand liest „0 %“ als Zinsversprechen). */
export function kapitalCProzent(bp: number): string {
  return `${kapitalProzent(bp)}${NB}%`;
}
/** Weicht die letzte Rate (Restbetrag, bis rund 1 €) von der Monatsrate ab? Dann wird sie überall offen genannt. */
export function kapitalCLetzteRateAnders(plan: Pick<KapitalCPlan, "monatsrateCents" | "letzteRateCents">): boolean {
  return plan.letzteRateCents !== plan.monatsrateCents;
}
/** Die Zeile für den Annahmevermerk und die Übersicht: „zehn Jahre (120 Monatsraten ab dem siebten Monat); Monatsrate nach dem Rechenbeispiel …“ */
export function kapitalCLaufzeitSatz(par: KapitalCParameter, jahre: number): string {
  const plan = kapitalCPlan(par, jahre);
  const letzte = kapitalCLetzteRateAnders(plan) ? `, letzte Rate ${kapitalCEurCent(plan.letzteRateCents)}` : "";
  return `${zahlwort(jahre)} Jahre (${plan.raten} Monatsraten ab dem ${kapitalCOrdnung(plan.ersteRateMonat)} Monat nach der Auszahlung); Monatsrate nach dem Rechenbeispiel ${kapitalCEurCent(plan.monatsrateCents)} (${kapitalCUngefaehr(kapitalCUsd(plan.usd.monatsrate))}${letzte}), Zinsen insgesamt ${kapitalCEurCent(plan.zinsenCents)}, Rückzahlung insgesamt ${kapitalCEurCent(plan.rueckzahlungCents)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE GELD-ZURÜCK-GARANTIE — EINE QUELLE
// Sie sichert das GELD des Kunden, nicht die Auszahlung: nie „Auszahlung garantiert“, nie „sicher“ (Nachprüfung 27.10., § 5 UWG).
// Der Prüfstand lässt „Garantie“ nur als Hauptwort an dieser Garantie stehen; „garantiert/garantieren“ bleibt überall rot.
// ═══════════════════════════════════════════════════════════════════════════
export const KAPITAL_C_GARANTIE_NAME = "Geld-zurück-Garantie";
export function kapitalCGarantie(par: Pick<KapitalCParameter, "garantieWochen" | "erstattungTage" | "zielWochen" | "betragCents">) {
  const w = zahlwort(par.garantieWochen); const t = zahlwort(par.erstattungTage); const z = zahlwort(par.zielWochen);
  return {
    name: KAPITAL_C_GARANTIE_NAME,
    vertrag: `${KAPITAL_C_GARANTIE_NAME}: Wird der Gesellschaft die Finanzierung nach Absatz 1 und 2 nicht binnen ${w} Wochen ab Auftragserteilung ausgezahlt, erstattet FIAON dem Auftraggeber alles, was er bis dahin an FIAON gezahlt hat (Ziffer 6 Absatz 1 und 2), binnen ${t} Tagen nach Fristende; noch nicht gezahlte Vergütungen entfallen. Die Gesellschaft bleibt dem Auftraggeber; auf seinen Wunsch löst FIAON sie dann auf und trägt die Kosten dafür; bis dahin bestehen ihre US-Meldepflichten nach Ziffer 8 fort.`,
    karte: `${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht binnen ${w} Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben.`,
    ziel: `Unser Ziel ist die Auszahlung in Woche ${z}.`,
    seite: `Kommt die Auszahlung nicht binnen ${w} Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles, was Sie an uns gezahlt haben — binnen ${t} Tagen.`,
    uebersicht: `Kommt die Auszahlung nicht binnen ${w} Wochen ab Auftragserteilung, erhalten Sie alles Gezahlte zurück — binnen ${t} Tagen`,
    frage: `Dann erstatten wir Ihnen alles, was Sie an uns gezahlt haben — binnen ${t} Tagen nach Ablauf der ${w} Wochen. So steht es als ${KAPITAL_C_GARANTIE_NAME} in Ziffer 4 Ihres Vertrags.`,
    /** Die Garantie mit ihren Ruhensgründen in einem Satz — für die Informationen vor Vertragsschluss (Art. 246a § 1 EGBGB). */
    info: `Kommt die Auszahlung nicht binnen ${w} Wochen ab Ihrem Auftrag, erstatten wir Ihnen alles Gezahlte binnen ${t} Tagen. Die Frist ruht nur, solange Gründung und Fast-Track nicht bezahlt sind, für die Tage, um die Sie die Frist für von der Bank angeforderte Unterlagen überschreiten, und solange Ihrer Gesellschaft ein Angebot zu den Bedingungen nach Ziffer 4 ohne weitere Sicherheiten oder Kosten für Sie zur Annahme vorliegt; lehnt sie ein solches Angebot ab oder lässt sie es verfallen, entfällt die Geld-zurück-Garantie (Ziffer 4).`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG
// ═══════════════════════════════════════════════════════════════════════════
const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function kapitalCVertragTitel(): string {
  return "FIAON Global — Vertrag über US-Gesellschaft, Konto und Karten, Begleitung zur Finanzierung und Bürgschaft";
}
/** Runde 2 (Kundensicht): „Vertragsstand 27.10.2026“ statt der internen Kennung „IA-KAPITAL-…-C“ (die bleibt in Prüfsumme und Akte). */
export function kapitalCVertragUnterzeile(d: Pick<KapitalCDaten, "ref" | "fassung" | "gueltigBis">): string {
  const stand = kapitalCVertragsstand(d.fassung);
  return `${KAPITAL_C_MARKE} · Angebot ${d.ref} · gültig bis ${kapitalTag(d.gueltigBis)}${stand ? ` · Vertragsstand ${stand}` : ""}`;
}
/** Der Satz zu den Konditionen — eine Quelle für Vertrag (Ziffer 4 Absatz 2), Seite und Übersicht. */
export function kapitalCKonditionenSatz(par: KapitalCParameter): string {
  const s1 = par.zinsfreiMonate + 1; const s2 = s1 + 12; const s3 = s2 + 12;
  return `Die ersten ${zahlwort(par.ratenfreiMonate)} Monate nach der Auszahlung sind ratenfrei. Danach zahlt die Gesellschaft das Darlehen in gleichbleibenden Monatsraten über die Laufzeit zurück, die der Auftraggeber bei der Annahme wählt: ${zahlwort(par.laufzeitMinJahre)} bis ${zahlwort(par.laufzeitMaxJahre)} Jahre. Die ersten ${zahlwort(par.zinsfreiMonate)} Monate sind zinsfrei; ab dem ${kapitalCOrdnung(s1)} Monat beträgt der Zins ${kapitalCProzent(par.zinsStartBp)} im Jahr und steigt danach mit jedem weiteren Jahr um ${kapitalProzent(par.zinsSchrittBp)} Prozentpunkte (ab dem ${kapitalCOrdnung(s2)} Monat ${kapitalCProzent(par.zinsStartBp + par.zinsSchrittBp)}, ab dem ${kapitalCOrdnung(s3)} Monat ${kapitalCProzent(par.zinsStartBp + 2 * par.zinsSchrittBp)} und so fort). Ab dem ${kapitalCOrdnung(par.aufstockungAbMonat)} Monat kann die Gesellschaft auf Wunsch eine Aufstockung beantragen oder die Finanzierung über ein anderes Institut umschulden; darüber entscheidet das jeweilige Institut. Solange die Jahresbetreuung nach Ziffer 6 Absatz 3 läuft, begleitet FIAON die Gesellschaft dabei.`;
}
/** „Ausgezahlt wird in US-Dollar zum Referenzkurs der EZB am Tag der Auszahlung; zum Kurs vom … sind das rund … US-$“ */
export function kapitalCBetragSatz(par: KapitalCParameter): string {
  return `Ausgezahlt wird in US-Dollar zum Referenzkurs der Europäischen Zentralbank am Tag der Auszahlung; zum Kurs vom ${kapitalTag(par.kursDatum)} sind das rund ${kapitalCUsd(kapitalCInUsd(par.betragCents, par.kursUsdJeEur))}`;
}
/**
 * Das Projekt im Satz — `art` ist ein sächliches Wort („Immobilienprojekt“): „sein …“ (Präambel, Akkusativ) bzw.
 * „dem … des Auftraggebers“ (Ziffer 4, Dativ).
 */
export function kapitalCProjektSatz(par: KapitalCParameter, fall: "sein" | "dativ" = "dativ"): string {
  const pr = par.projekt;
  const kopf = fall === "sein" ? `sein ${pr.art}` : `dem ${pr.art} des Auftraggebers`;
  return `${kopf} ${pr.wo} (zu ${pr.bezahltProzent} % bezahlt, Fertigstellung vorgesehen zum ${kapitalTag(pr.fertigstellung)})`;
}
export const KAPITAL_C_SOFORT_TEXT = "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt (Fast-Track). Mir ist bekannt, dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.";
export const KAPITAL_C_GELESEN_TEXT = "Ich habe den Vertrag, die Informationen vor Vertragsschluss und die Widerrufsbelehrung mit dem Muster-Widerrufsformular gelesen.";
// Runde 2 (27.10.): „für die Finanzierung gilt …“ statt „für sie gilt …“ — „sie“ ließ sich auf Konto und Karten lesen (Ziffer 3 Abs. 2).
const KAPITAL_C_PFLICHT_ZUSATZ = "Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut, über die Finanzierung das finanzierende Institut; für die Finanzierung gilt die Geld-zurück-Garantie nach Ziffer 4.";
const KAPITAL_C_KARTEN_SOLLZINS = "Einführungszeiträume ohne Sollzins bieten manche Herausgeber an; die Bedingungen legt jeder Herausgeber selbst fest.";
/**
 * Ihre Verantwortung — der persönliche Rückgriff in einem ruhigen Satz, mit Obergrenze (Rechner, Übersicht, Fragen, Informationen;
 * Ziffer 5 Absatz 1 und 5: Höchstbetrag der Bürgschaft ist das ausgezahlte Darlehen, der Rückgriff umfasst die Kosten).
 */
export const KAPITAL_C_VERANTWORTUNG = "Muss unsere Partnergesellschaft als Bürgin einspringen, weil Ihre Gesellschaft nicht zahlt, ersetzen Sie ihr den gezahlten Betrag persönlich — höchstens in Höhe des ausgezahlten Darlehens, zuzüglich der Kosten (Ziffer 5). Solange Ihre Gesellschaft ihre Raten zahlt, kommt es dazu nicht.";

/**
 * Der Registerstand der Bürgin als Satz — null, wenn sie als aktiv geführt wird. Vertrag (Ziffer 5 Absatz 1), Fragen und
 * Informationen nennen ihn offen, solange sie inaktiv ist; mit buerginAktiv = true verschwindet er überall.
 * Runde 2 (Kundensicht): Auf der Seite mit Folge und Schutz — bürgt sie nicht rechtzeitig, greift die Geld-zurück-Garantie, auch für
 * das Erfolgshonorar. `staat` = Bundesstaat der Bürgin („im Register von Florida“).
 */
export function kapitalCBuerginStand(par: Pick<KapitalCParameter, "buerginAktiv" | "buerginStandAm" | "ddAbgeschlossen" | "garantieWochen">, art: "vertrag" | "seite", staat = ""): string | null {
  if (par.buerginAktiv) return null;
  const stand = par.buerginStandAm ? ` (Stand ${kapitalTag(par.buerginStandAm)})` : "";
  return art === "vertrag"
    ? `Die Bürgin wird im Register ihres Bundesstaats derzeit als inaktiv geführt${stand}; die Bürgschaft übernimmt sie erst nach ihrer Reaktivierung, wenn sie dort wieder als aktiv geführt wird (Absatz ${kapitalCZ5(par).bedingungen}).`
    : `Offen gesagt: Die Bürgin wird im Register ${staat ? `von ${staat}` : "ihres Bundesstaats"} derzeit als inaktiv geführt${stand}. Bürgen wird sie erst, wenn sie dort wieder als aktiv geführt wird (Ziffer 5). Bürgt sie nicht rechtzeitig, greift Ihre ${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht binnen ${zahlwort(par.garantieWochen)} Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben — auch das Erfolgshonorar.`;
}
/** Der Ort der Bürgin aus ihrer Anschrift („…, Miami, FL 33145, USA“ → „Miami“) — sonst ihr Bundesstaat. */
export function kapitalCBuerginOrt(b: Pick<KapitalBuergin, "anschrift" | "bundesstaat">): string {
  const teile = String(b.anschrift ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  const i = teile.findIndex((x) => /^[A-Z]{2}\s+\d{5}(-\d{4})?$/.test(x));
  return i > 0 && /^[A-Za-zÀ-ÿ .'-]{2,40}$/.test(teile[i - 1]) ? teile[i - 1] : String(b.bundesstaat ?? "");
}
/** „27.10.2026“ aus der Fassung „IA-KAPITAL-2026-10-27-C“ — die Kundensicht nennt den Vertragsstand, nie die interne Kennung. */
export function kapitalCVertragsstand(fassung: string): string {
  const m = String(fassung ?? "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "";
}
/** Die Absatznummern in Ziffer 5 — der Absatz zur Prüfung entfällt ohne abgeschlossene Due Diligence, die Verweise folgen. */
function kapitalCZ5(par: Pick<KapitalCParameter, "ddAbgeschlossen">): { bedingungen: number; sicherheiten: number; rueckgriff: number } {
  const bedingungen = par.ddAbgeschlossen ? 3 : 2;
  return { bedingungen, sicherheiten: bedingungen + 1, rueckgriff: bedingungen + 2 };
}

export function kapitalCPraeambel(d: KapitalCDaten): string[] {
  const par = d.parameter;
  return [
    `Der Auftraggeber möchte ${kapitalCProjektSatz(par, "sein")} finanzieren und dafür eine eigene US-Gesellschaft nutzen.`,
    `FIAON gründet diese Gesellschaft, bereitet Konto und Karten vor und begleitet sie bis zur Finanzierung über ${kapitalCEur(par.betragCents)} durch eine US-Bank. Die US-Partnergesellschaft von FIAON übernimmt dafür eine Bürgschaft, und FIAON gibt dem Auftraggeber eine ${KAPITAL_C_GARANTIE_NAME}: Kommt die Auszahlung nicht rechtzeitig, erhält er alles Gezahlte zurück.`,
  ];
}

export function kapitalCZiffern(d: KapitalCDaten, opt: KapitalCDarstellung = {}): AngebotZiffer[] {
  const par = d.parameter; const b = d.buergin; const k = d.kunde;
  const G = kapitalCGarantie(par);
  const Z5 = kapitalCZ5(par);
  const unterlagen = par.unterlagen.map((u) => u.titel);
  const buerginStand = kapitalCBuerginStand(par, "vertrag");
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind die ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}, eingetragen im ${FIAON_FIRMA.register} unter Nr. ${FIAON_FIRMA.companyNo}, vertreten durch ${FIAON_FIRMA.director}, Director (nachfolgend „FIAON“), und ${kapitalCKundeZeile(k, opt)} (nachfolgend „Auftraggeber“).`),
      p(`Gegenstand sind die Gründung einer US-Gesellschaft (Ziffer 2), ihre Ausstattung mit Konto und Karten (Ziffer 3), die Begleitung bis zur Finanzierung mit ${KAPITAL_C_GARANTIE_NAME} (Ziffer 4) und die Bürgschaft der US-Partnergesellschaft von FIAON (Ziffer 5). Die Gesellschaft gehört allein dem Auftraggeber; FIAON erwirbt an ihr keine Anteile. Der Auftraggeber schließt diesen Vertrag als Verbraucher.`),
    ] },
    { nr: 2, titel: "Die US-Gesellschaft", absaetze: [
      p(`FIAON gründet für den Auftraggeber eine Limited Liability Company (LLC) nach dem Recht des Bundesstaats ${par.bundesstaat}; einziger Gesellschafter ist der Auftraggeber. Den Namen bestimmt der Auftraggeber bei der Annahme (Annahmevermerk). FIAON prüft die Verfügbarkeit im Register und meldet die Gesellschaft unter dem Wunschnamen an, sonst unter dem ersten verfügbaren Ausweichnamen; ist keiner verfügbar, stimmt FIAON einen neuen Namen mit dem Auftraggeber in Textform ab. Bis zur Prüfung im Register ist der Name vorgemerkt.`),
      liste([
        "die Anmeldung beim Bundesstaat (Articles of Organization) einschließlich der Staatsgebühr",
        "das Operating Agreement und die Gründungsunterlagen in digitaler Form",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer im ersten Jahr",
        "die Assistenz der Gesellschaft im ersten Jahr: Post, Anrufe und Termine",
        "die Beantragung der US-Steuernummer der Gesellschaft (EIN) und — soweit die Voraussetzungen der US-Steuerbehörde vorliegen, was FIAON vorab prüft (ITIN-Check) — der persönlichen US-Steuernummer des Auftraggebers (ITIN)",
        "der Pflichtenkalender, die erste Jahresmeldung der Gesellschaft beim Bundesstaat (Annual Report) einschließlich der Staatsgebühr und die erste jährliche US-Meldung der Gesellschaft durch einen US-CPA aus dem Partnernetz von FIAON",
      ], "Die Gründung umfasst:"),
      p(`Fast-Track: FIAON bearbeitet den Auftrag mit Vorrang — die Anmeldung beim Bundesstaat und der Antrag auf die EIN laufen beschleunigt, die Unterlagen für das finanzierende Institut entstehen parallel zur Gründung. FIAON reicht die Anmeldung binnen fünf Werktagen nach dem Eingang der Vergütung nach Ziffer 6 Absatz 1 ein.`),
      p("Über die Eintragung entscheidet der Bundesstaat, über EIN und ITIN die US-Steuerbehörde. Liegen die Voraussetzungen für eine ITIN nicht vor, zeigt FIAON dem Auftraggeber die Wege für Konto und Karten ohne ITIN; entsteht während der Begleitung ein Grund für eine ITIN, beantragt FIAON sie dann. Gegenüber Behörden handelt FIAON nach Ziffer 13."),
    ] },
    { nr: 3, titel: "Konto und Karten", absaetze: [
      liste([
        "ein privates US-Konto des Auftraggebers",
        "private US-Kreditkarten des Auftraggebers mit Reise- und Meilenprogrammen",
        "das Geschäftskonto der Gesellschaft",
        "eine Firmenkreditkarte der Gesellschaft",
      ], "FIAON bereitet für den Auftraggeber und die Gesellschaft vollständig vor und begleitet bis zur Eröffnung:"),
      p(`Die Anträge stellen der Auftraggeber bzw. die Gesellschaft selbst; FIAON bereitet sie vollständig vor. Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut. ${KAPITAL_C_KARTEN_SOLLZINS} Für Konto und Karten gilt die ${KAPITAL_C_GARANTIE_NAME} nach Ziffer 4 nicht.`),
    ] },
    { nr: 4, titel: `Begleitung zur Finanzierung und ${KAPITAL_C_GARANTIE_NAME}`, absaetze: [
      p(`FIAON begleitet die Gesellschaft bis zur Finanzierung über ${kapitalCEur(par.betragCents)} durch eine US-Bank (nachfolgend „finanzierendes Institut“). ${kapitalCBetragSatz(par)}. Die Mittel dienen ${kapitalCProjektSatz(par, "dativ")}. FIAON bereitet jeden Antrag vollständig vor und begleitet bis zur Auszahlung; über die Finanzierung entscheidet das finanzierende Institut nach seiner Prüfung. Den Darlehensvertrag schließt die Gesellschaft im eigenen Namen, und ob sie ein Angebot annimmt, entscheidet sie allein.`),
      p(`Ziel der Begleitung ist eine Finanzierung zu folgenden Bedingungen: ${kapitalCKonditionenSatz(par)}`),
      p("Die Raten zahlt die Gesellschaft pünktlich zu jedem Fälligkeitstag an das finanzierende Institut. Zeichnet sich ab, dass sie eine Rate nicht pünktlich zahlen kann, teilt der Auftraggeber dies FIAON unverzüglich in Textform mit. Darlehen und Raten lauten auf US-Dollar; Euro-Beträge sind Umrechnungen, ihr Gegenwert in Euro kann sich mit dem Wechselkurs ändern — steigt der Kurs des US-Dollars um zehn Prozent, steigt jede Rate in Euro ebenfalls um zehn Prozent. Maßgeblich ist der Darlehensvertrag des finanzierenden Instituts; das Rechenbeispiel der Angebotsseite folgt den Bedingungen nach Absatz 2."),
      p(`Die Mittel sind nicht an die USA gebunden: Die Gesellschaft kann sie im Rahmen der Bedingungen des finanzierenden Instituts ${par.projekt.wo} oder in Europa einsetzen. Wie Überweisungen und Investitionen steuerlich zu behandeln sind, klärt der Partner-Steuerberater von FIAON vorab mit dem Auftraggeber. Eine US-Gesellschaft ist kein Steuermodell.`),
      p(G.vertrag),
      p(`Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist. Sie ruht außerdem nur für die Tage, um die der Auftraggeber die Frist nach Ziffer 7 Absatz 2 überschreitet, und solange ein der Gesellschaft vorgelegtes Finanzierungsangebot über den Betrag zu den Bedingungen nach Absatz 2 ohne weitere Sicherheiten oder Kosten des Auftraggebers zur Annahme offensteht; lehnt die Gesellschaft ein solches Angebot ab oder lässt sie es verfallen, entfällt die ${KAPITAL_C_GARANTIE_NAME}. Die Unterlagen nach Ziffer 7 Absatz 1 liegen FIAON bei Vertragsschluss vor; ihretwegen ruht die Frist nicht. Die ${KAPITAL_C_GARANTIE_NAME} entfällt auch, wenn der Auftraggeber vorsätzlich falsche Angaben macht.`),
      p(`Ziel der Parteien ist die Auszahlung binnen ${zahlwort(par.zielWochen)} Wochen ab Auftragserteilung; diesem Ziel dient der Fast-Track (Ziffer 2 Absatz 3). Verbindlich ist allein die Frist der ${KAPITAL_C_GARANTIE_NAME} nach Absatz 5.`),
    ] },
    { nr: 5, titel: "Bürgschaft der US-Partnergesellschaft", absaetze: [
      p(`Die ${b.name}, ${b.anschrift}, eingetragen im Bundesstaat ${b.bundesstaat} unter ${b.registernummer} (nachfolgend „Bürgin“), übernimmt auf Anforderung des finanzierenden Instituts eine Bürgschaft für die Finanzierung nach Ziffer 4. Höchstbetrag ist der ausgezahlte Darlehensbetrag; die Bürgschaft lautet auf die Währung der Finanzierung und läuft längstens ${zahlwort(par.buergschaftMonate)} Monate. Die Bürgin ist ein mit FIAON verbundenes Unternehmen und tritt diesem Vertrag für Ziffer 5 bei.${buerginStand ? ` ${buerginStand}` : ""}`),
      ...(par.ddAbgeschlossen ? [p("FIAON hat die Due-Diligence-Prüfung des Auftraggebers mit positivem Ergebnis abgeschlossen; über die Finanzierung entscheidet das finanzierende Institut.")] : []),
      liste([
        "die Vergütung nach Ziffer 6 Absatz 1 ist bezahlt",
        "die Identifizierung des Auftraggebers ist abgeschlossen, und die Unterlagen nach Ziffer 7 liegen vor",
        "die Finanzierung dient dem Zweck nach Ziffer 4 Absatz 1",
        "die Bürgin ist zum Zeitpunkt der Übernahme im Register ihres Bundesstaats als aktiv geführt",
      ], "Die Bürgin übernimmt die Bürgschaft, sobald Folgendes vorliegt:"),
      p(`Eine Bareinlage oder dingliche Sicherheit verlangen FIAON und die Bürgin nicht; für den Rückgriff nach Absatz ${Z5.rueckgriff} haftet der Auftraggeber persönlich. Die Vergütung für die Bürgschaft ist im Erfolgshonorar nach Ziffer 6 Absatz 2 enthalten. Die Form der Bürgschaft stimmt die Bürgin mit dem finanzierenden Institut ab.`),
      p("Nimmt das finanzierende Institut die Bürgin in Anspruch, ersetzen die Gesellschaft und der Auftraggeber der Bürgin als Gesamtschuldner den gezahlten Betrag mit den Kosten der Inanspruchnahme (Rückgriff). Solange die Bürgschaft besteht, teilt der Auftraggeber FIAON einmal im Quartal den Stand der Finanzierung und der Rückzahlungen in Textform mit."),
    ] },
    { nr: 6, titel: "Vergütung und Fälligkeit", absaetze: [
      p(`Für die Leistungen nach Ziffer 2 und 3 im ersten Jahr (Gründung, Konto und Karten) zahlt der Auftraggeber einmalig ${kapitalCEur(par.gruendungCents)} und für den Fast-Track (Ziffer 2 Absatz 3) einmalig ${kapitalCEur(par.fastTrackCents)}, zusammen ${kapitalCEur(kapitalCHeuteCents(par))}. Der Betrag ist mit Vertragsschluss fällig; FIAON stellt die Rechnung bei Annahme dieses Vertrags, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen ohne Abzug per Überweisung. FIAON beginnt mit dem Zahlungseingang (Ziffer 10 Absatz 2).`),
      p(`Mit der erfolgreichen Gründung der Gesellschaft — ihrer Eintragung beim Bundesstaat — wird das Erfolgshonorar von ${kapitalCEur(par.erfolgCents)} fällig; es schließt die Bürgschaft nach Ziffer 5 ein. FIAON berechnet es mit Rechnung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen. Kommt es nicht zur Eintragung, entfällt es. Im ersten Jahr zahlt der Auftraggeber damit insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}.`),
      p(`Ab dem zweiten Jahr nach der Eintragung betreut FIAON die Gesellschaft für ${kapitalCEur(par.jahresCents)} je Jahr (Jahresbetreuung): Registered Agent und US-Geschäftsadresse, US-Telefonnummer und Assistenz, die jährliche US-Meldung (Form 5472 mit Form 1120) durch einen US-CPA aus dem Partnernetz von FIAON, die Jahresmeldung beim Bundesstaat einschließlich der Staatsgebühr, der Pflichtenkalender, die Begleitung bei einer Aufstockung oder Umschuldung nach Ziffer 4 Absatz 2 und ein fester Ansprechpartner. Die Jahresbetreuung wird jährlich im Voraus berechnet und verlängert sich nicht von selbst: Mit der Zahlung der Jahresrechnung beginnt das jeweilige Betreuungsjahr. Bleibt die Zahlung aus, endet die Jahresbetreuung; die laufenden Kosten der Gesellschaft trägt der Auftraggeber dann selbst.`),
      p("Alle Beträge sind Endpreise; eine etwa anfallende Umsatzsteuer ist darin enthalten. Die Honorare der Partner von FIAON für die hier genannten Leistungen trägt FIAON. Zinsen und Kosten der Finanzierung richten sich nach Ziffer 4 und dem Darlehensvertrag des finanzierenden Instituts."),
    ] },
    { nr: 7, titel: "Mitwirkung des Auftraggebers", absaetze: [
      ...(unterlagen.length ? [liste(unterlagen, "Folgende Unterlagen des Auftraggebers liegen FIAON bei Vertragsschluss vor:")] : [p("Der Auftraggeber stellt FIAON binnen sieben Tagen nach der Annahme eine Farbkopie seines Reisepasses und einen Adressnachweis bereit.")]),
      p("Verlangen das finanzierende Institut oder eine Behörde weitere Unterlagen, stellt der Auftraggeber sie binnen sieben Tagen bereit, nachdem FIAON sie ihm in Textform genannt hat."),
      p("Der Auftraggeber macht wahre und vollständige Angaben, unterschreibt die vorbereiteten Unterlagen nach Prüfung und teilt Änderungen, die für die Gesellschaft, die Finanzierung oder die Bürgschaft erheblich sind, unverzüglich in Textform mit."),
      p(globalAgentVertrag("nutzung", false)),
    ] },
    { nr: 8, titel: "Pflichthinweise", absaetze: [
      liste([...ANGEBOT_PFLICHTHINWEIS, KAPITAL_C_PFLICHT_ZUSATZ], "Der Auftraggeber nimmt die folgenden Hinweise zur Kenntnis:"),
      p("FIAON reicht keine Unterlagen ein, deren Angaben es für unzutreffend hält. Vor Beginn gleicht FIAON den Auftraggeber mit den Sanktionslisten der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs und der USA ab."),
    ] },
    { nr: 9, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme. Die Begleitung endet ${zahlwort(par.begleitMonate)} Monate nach der Eintragung der Gesellschaft; die Bürgschaft endet nach Ziffer 5, die Jahresbetreuung nach Ziffer 6 Absatz 3.`),
      p(`Das Recht beider Parteien zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt, insbesondere wenn der Auftraggeber vorsätzlich falsche Angaben macht oder auf einer Sanktionsliste geführt wird. Eine bereits übernommene Bürgschaft bleibt davon unberührt; der Rückgriff nach Ziffer 5 Absatz ${Z5.rueckgriff} gilt fort. Das Widerrufsrecht nach Ziffer 10 bleibt unberührt.`),
    ] },
    { nr: 10, titel: "Widerrufsrecht", absaetze: [
      p("Der Auftraggeber kann diesen Vertrag als Verbraucher binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in der Anlage widerrufen; die Anlage enthält auch das Muster-Widerrufsformular. Mit dem Widerruf endet auch der Beitritt der Bürgin. Eine bereits gegründete Gesellschaft bleibt dem Auftraggeber; auf seinen Wunsch löst FIAON sie auf und trägt die Kosten dafür; bis dahin bestehen ihre US-Meldepflichten nach Ziffer 8 fort."),
      p("Der Auftraggeber hat bei der Annahme ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt (Fast-Track). Ihm ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat."),
    ] },
    { nr: 11, titel: "Haftung", absaetze: [
      p(`FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Entscheidungen von Behörden haftet FIAON nicht. Bleibt die Finanzierung aus, gilt die ${KAPITAL_C_GARANTIE_NAME} nach Ziffer 4; die Haftung nach Satz 1 bleibt unberührt. Für die Leistungen der Partner haften diese aus ihrem eigenen Mandat.`),
      p(globalAgentVertrag("haftung", false)),
    ] },
    { nr: 12, titel: "Vertraulichkeit und Datenschutz", absaetze: [
      p("Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags. FIAON gibt Unterlagen nur weiter, soweit es die Leistung erfordert: an Behörden, an den Registered Agent, an die Partner von FIAON, an die Bürgin und an Institute, bei denen ein Antrag gestellt wird."),
      p("FIAON verarbeitet personenbezogene Daten, um diesen Vertrag zu erfüllen, nach der Datenschutzerklärung unter fiaon.com/datenschutz und im Einklang mit der DSGVO. Für Gründung und Anträge gehen Daten in die USA; die Übermittlung stützt sich darauf, dass sie für die Erfüllung dieses Vertrags erforderlich ist."),
    ] },
    { nr: 13, titel: BEFUGNISSE_TITEL.de, absaetze: befugnisseAbsaetze("auftraggeber") },
    { nr: 14, titel: "Schlussbestimmungen", absaetze: [
      p(`Weitere Allgemeine Geschäftsbedingungen gelten nicht. Beigefügt ist die Anlage (Widerrufsbelehrung und Muster-Widerrufsformular). Vertragssprache ist Deutsch; FIAON speichert den Vertragstext, und der Auftraggeber erhält ihn nach der Annahme als PDF per E-Mail. Beschwerden richtet der Auftraggeber an ${FIAON_FIRMA.email}.`),
      p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; diese Rechtswahl gilt nur, soweit dem Auftraggeber dadurch nicht der Schutz der zwingenden Bestimmungen des Staates seines gewöhnlichen Aufenthalts entzogen wird. FIAON ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
    ] },
  ];
}

// ── HTML des Vertrags (dieselbe Gestalt wie Fassung A/B: gv-Klassen aus GLOBAL_VERTRAG_CSS/ANGEBOT_VERTRAG_CSS) ──
function ziffernHtml(ziffern: AngebotZiffer[]): string {
  return ziffern.map((z) => {
    const mehrere = z.absaetze.length > 1;
    const bloecke = z.absaetze.map((a, i) => {
      const nr = mehrere ? `<span class="gv-abs">(${i + 1})</span> ` : "";
      if (a.art === "p") return `<p>${nr}${escHtml(a.text)}</p>`;
      const kopf = a.einleitung ? `<p>${nr}${escHtml(a.einleitung)}</p>` : "";
      return `${kopf}<ul>${a.zeilen.map((x) => `<li>${escHtml(x)}</li>`).join("")}</ul>`;
    });
    const [erster, ...rest] = bloecke.join("").match(/<(p|ul)\b[\s\S]*?<\/\1>/g) ?? [];
    return `<section class="gv-ziffer" id="ziffer-${z.nr}"><div class="gv-anfang"><h2><span class="gv-nr">${z.nr}</span>${escHtml(z.titel)}</h2>${erster ?? ""}</div>${rest.join("")}</section>`;
  }).join("\n");
}
/** Die Anlage — das gesetzliche Muster WÖRTLICH (shared/fiaon-global-widerruf.ts). */
export function kapitalCWiderrufHtml(): string {
  const w = globalWiderrufsbelehrung("de");
  return `<section class="gv-anlage" id="anlage-widerruf"><h2>${escHtml(w.titel)}</h2><p class="gv-leise">${escHtml(w.gilt)}</p>${
    w.abschnitte.map((a) => `<h3>${escHtml(a.h)}</h3>${a.absaetze.map((x) => `<p>${escHtml(x)}</p>`).join("")}`).join("")
  }<h3>${escHtml(w.formular.titel)}</h3><p>${escHtml(w.formular.hinweis)}</p><p>${escHtml(w.formular.an)}</p><ul>${w.formular.zeilen.map((z) => `<li>${escHtml(z)}</li>`).join("")}</ul><p class="gv-leise">${escHtml(w.formular.fuss)}</p></section>`;
}
function zeitText(am: Date): string {
  const tag = am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" });
  const zeit = am.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
  return `${tag} um ${zeit} Uhr (Europe/Berlin)`;
}
function unterschriftHtml(u: KapitalUnterschriftVermerk): string {
  const m = String(u.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]{100,})$/);
  const art = u.art === "gezeichnet" ? "von Hand gezeichnet" : `Name getippt: ${escHtml(u.name ?? "")}`;
  const zeichen = m
    ? `<img class="gv-unterschrift-bild" src="data:image/png;base64,${m[1]}" alt="Unterschrift" style="display:block;max-width:240px;max-height:80px;margin:4px 0 2px" />`
    : `<span class="gv-unterschrift-getippt" style="display:block;font-family:'Mrs Saint Delafield','Snell Roundhand','Apple Chancery','Dancing Script',cursive;font-size:30px;line-height:1.1;color:#1b3866;margin:4px 0 2px">${escHtml(u.name ?? "")}</span>`;
  return `${zeichen}<span class="gv-leise" style="font-size:8pt">Unterschrift (${art})</span>`;
}
function annahmeBlock(d: KapitalCDaten, a: KapitalCAnnahmeVermerk | null): string {
  const name = kapitalCName(d.kunde);
  const fiaon = `<div class="sig-col"><div class="gv-sig-kopf">Für FIAON</div><div class="gv-sig-feld"><span class="gv-leise">Angebot der ${escHtml(FIAON_FIRMA.name)}, vertreten durch ${escHtml(FIAON_FIRMA.director)}, Director</span></div><div class="sig-line">${escHtml(FIAON_FIRMA.name)}</div></div>`;
  const buergin = `<div class="sig-col"><div class="gv-sig-kopf">Für die Bürgin (Ziffer 5)</div><div class="gv-sig-feld"><span class="gv-leise">Beitritt der ${escHtml(d.buergin.name)}, vertreten durch ${escHtml(d.buergin.vertreter)}, ${escHtml(d.buergin.funktion)}</span></div><div class="sig-line">${escHtml(d.buergin.name)}</div></div>`;
  if (!a) {
    return `
  <div class="gv-unterschriften">
    ${fiaon}
    ${buergin}
    <div class="sig-col"><div class="gv-sig-kopf">Für den Auftraggeber</div><div class="gv-sig-feld"><span class="gv-leise">Annahme mit dem Knopf „${escHtml(KAPITAL_KNOPF)}“ — Laufzeit und Name der Gesellschaft stehen dann hier im Annahmevermerk.</span></div><div class="sig-line">${escHtml(name)}</div></div>
  </div>`;
  }
  const w = a.wahl;
  const namen = [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean);
  return `
  <div class="gv-unterschriften">
    ${fiaon}
    ${buergin}
    <div class="sig-col"><div class="gv-sig-kopf">Für den Auftraggeber</div><div class="gv-sig-feld">${unterschriftHtml(a.unterschrift)}</div><div class="sig-line">${escHtml(name)}, ${escHtml(d.kunde.ort)}, ${escHtml(a.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}</div></div>
  </div>
  <div class="gv-annahme">
    <h3>Annahmevermerk</h3>
    <p>Angenommen am ${escHtml(zeitText(a.am))} mit dem Knopf „${escHtml(KAPITAL_KNOPF)}“.</p>
    <ul>
      <li>Laufzeit der Finanzierung (Ziffer 4 Absatz 2): <strong>${escHtml(kapitalCLaufzeitSatz(d.parameter, w.laufzeitJahre))}</strong></li>
      <li>Name der Gesellschaft (Ziffer 2): Wunschname <strong>${escHtml(w.llc.wunsch)}</strong>${namen.length > 1 ? `; Ausweichnamen in dieser Reihenfolge: ${namen.slice(1).map(escHtml).join("; ")}` : "; keine Ausweichnamen"}</li>
      <li>Beginn vor Ablauf der Widerrufsfrist (Ziffer 10 Absatz 2), ausdrücklich verlangt: „${escHtml(KAPITAL_C_SOFORT_TEXT)}“</li>
      <li>Mit der Unterschrift bestätigt: „${escHtml(KAPITAL_C_GELESEN_TEXT)}“</li>
    </ul>
    <p class="gv-leise">IP-Adresse ${escHtml(a.ip)} · Prüfsumme des Vertragstextes (SHA-256): <span class="hash">${escHtml(a.hash)}</span></p>
  </div>`;
}
/**
 * Der Rumpf: Präambel, vierzehn Ziffern, Unterschriften/Annahmevermerk, Anlage (Widerruf). Die Prüfsumme läuft über den Rumpf
 * OHNE Vermerk und mit den VOLLSTÄNDIGEN Ausweisnummern (so steht er im angenommenen Vertrag). `opt.ausweiseGekuerzt` nur für
 * die Darstellung, die über den Link erreichbar ist (Seite, Entwurfs-PDF) — die Nummern sind dann bis auf drei Zeichen verdeckt.
 */
export function kapitalCRumpfHtml(d: KapitalCDaten, annahme: KapitalCAnnahmeVermerk | null = null, opt: KapitalCDarstellung = {}): string {
  const ziffern = ziffernHtml(kapitalCZiffern(d, opt)).split("\n");
  const letzte = ziffern.pop() ?? "";
  return `<div class="gv" lang="de"><section class="gia-praeambel" id="praeambel"><h2>Präambel</h2>${kapitalCPraeambel(d).map((x) => `<p>${escHtml(x)}</p>`).join("")}</section>
${ziffern.join("\n")}
<div class="gv-schluss">${letzte}${annahmeBlock(d, annahme)}</div>
${kapitalCWiderrufHtml()}</div>`;
}
export function kapitalCHashEingabe(d: Pick<KapitalCDaten, "ref" | "fassung">, rumpfOhneAnnahme: string): string {
  return `global-angebot-kapital-c|${d.ref}|${d.fassung}|${rumpfOhneAnnahme}`;
}
export function kapitalCVertragInhalt(d: KapitalCDaten): { anker: string; marke: string; titel: string }[] {
  return [
    { anker: "praeambel", marke: "", titel: "Präambel" },
    ...kapitalCZiffern(d).map((z) => ({ anker: `ziffer-${z.nr}`, marke: String(z.nr), titel: z.titel })),
    { anker: "anlage-widerruf", marke: "A", titel: "Anlage — Widerrufsbelehrung und Muster-Widerrufsformular" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// Reihenfolge (Nachprüfung 27.10.): Ihre Finanzierung mit Monatsrate · Laufzeit-Rechner mit den Konditionen (die EINE Navy-Stelle) ·
// Name · Paket · Weg · Investition (ruhig, vollständig) · Unterlagen · Fragen · Ansprechpartner · Vertrag · Auftrag erteilen.
// Die Geld-zurück-Garantie steht sichtbar nur in der Karte oben und in der Übersicht über dem Knopf (dazu Fragen, Informationen, Vertrag).
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalCPaketKachel { schluessel: string; titel: string; zeile: string; details: string[] }
export interface KapitalCSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  hero: { auge: string; titel: string; lead: string; betrag: string; umrechnung: string; kurs: string; siegel: string;
    eckdaten: { wert: string; titel: string }[]; garantie: string; knopf: string; knopfLeise: string; staat: string;
    /** Die Monatsrate in der Karte — sie folgt der Wahl im Rechner. Platzhalter {monat} und {jahre}. */
    rateAuge: string; rateBei: string; rateKnopf: string };
  /** Die Konditionen — als Leiste im Rechner (kein eigener Abschnitt mehr). */
  konditionen: { auge: string; schritte: { wann: string; titel: string; text: string }[]; fein: string[] };
  rechner: { auge: string; titel: string; sub: string; laufzeitLabel: string; jahre: string; jahr: string;
    rateAuge: string; usdPraefix: string; usdImMonat: string;
    werte: { zinsen: string; rueckzahlung: string; zinsfreiBis: string; zinsfreiWert: string; raten: string; letzteRate: string };
    monatPraefix: string; treppeKnopf: string; treppeZu: string; treppeKopf: { zeitraum: string; zins: string; zinsen: string; rest: string };
    ratenfrei: string; ratenfreiZinsfrei: string; zinsfrei: string;
    puenktlich: string; verantwortung: string; waehrung: string; hinweis: string; kursZeile: string;
    /** Für Vorleseprogramme: nur der Endwert (Platzhalter {jahre} {rate} {zinsen}). */
    vorlesen: string };
  llc: Record<keyof typeof BEGLEIT_LLC_TEXTE, string> & { aendern: string; ausweichAuf: string; ausweichZu: string };
  paket: { auge: string; titel: string; sub: string; gruppen: { titel: string; kacheln: KapitalCPaketKachel[] }[]; fein: string; mehr: string; weniger: string };
  weg: { auge: string; titel: string; sub: string; liste: FirmaPhase[] };
  investition: { titel: string; sub: string; zeilen: { wann: string; betrag: string; text: string }[]; summe: string; fein: string };
  unterlagen: { auge: string; titel: string; sub: string; liste: { titel: string; stand: string }[]; fein: string };
  fragen: { titel: string; sub: string; liste: { frage: string; antwort: string[] }[]; sichtbar: number };
  ansprechpartner: { titel: string; sub: string };
  vertrag: { titel: string; sub: string; dokument: string; unterzeile: string; inhalt: { anker: string; marke: string; titel: string }[] };
  widerruf: { titel: string; text: string; knopf: string };
  informationen: { titel: string; sub: string; zeilen: { titel: string; text: string }[] };
  pflicht: string[];
}
export function kapitalCSeite(d: KapitalCDaten): KapitalCSeite {
  const par = d.parameter; const k = d.kunde; const G = kapitalCGarantie(par);
  const betrag = kapitalCEur(par.betragCents);
  const usd = kapitalCUsd(kapitalCInUsd(par.betragCents, par.kursUsdJeEur));
  // Die ganze Gleichung bricht nie um („1 € =“ | „1,1188 US-$“, Nachprüfung Runde 2).
  const kursZeile = `EZB-Referenzkurs vom ${kapitalTag(par.kursDatum)}: 1${NB}€${NB}=${NB}${kapitalCKurs(par.kursUsdJeEur)}${NB}US-$`;
  const s1 = par.zinsfreiMonate + 1;
  const projektKurz = `${par.projekt.art} ${par.projekt.woKurz}`;
  const buerginStand = kapitalCBuerginStand(par, "seite", d.buergin.bundesstaat);
  const Z5 = kapitalCZ5(par);
  const buerginOrt = kapitalCBuerginOrt(d.buergin);
  return {
    auftakt: {
      auge: "FIAON Global · Persönlich für Sie",
      gruss: `Willkommen, ${kapitalCGruss(k)}.`,
      zeile: `Ihre Finanzierung über ${betrag} — für Ihr ${projektKurz}.`,
      weiter: "Weiter",
    },
    hero: {
      auge: `Persönlich für ${kapitalCGrussAkk(k)}`,
      titel: `Die Finanzierung für Ihr Projekt ${par.projekt.woKurz}.`,
      // Runde 2: zwei Sätze (am Handy kürzer), „Restzahlung“ statt „letzter Schritt“, „Sie“ statt „sie“, Bürgschaft ohne Präsens-Zusage.
      lead: `Ihr ${par.projekt.art} ist zu ${par.projekt.bezahltProzent}${NB}% bezahlt und soll zum ${kapitalCTagLang(par.projekt.fertigstellung)} fertig sein. Für die Restzahlung gründen wir Ihre eigene US-Gesellschaft und begleiten Sie bis zur Auszahlung — mit der Bürgschaft unserer US-Partnergesellschaft gegenüber der Bank und Ihrer ${KAPITAL_C_GARANTIE_NAME}.`,
      betrag, umrechnung: kapitalCUngefaehr(usd), kurs: `${kursZeile}. Ausgezahlt wird in US-Dollar zum Kurs des Auszahlungstags.`,
      siegel: "Ihre Finanzierung",
      eckdaten: [
        { wert: `${par.ratenfreiMonate} Monate`, titel: "ratenfrei" },
        { wert: `${par.zinsfreiMonate} Monate`, titel: "zinsfrei" },
        { wert: `${par.laufzeitMinJahre}–${par.laufzeitMaxJahre} Jahre`, titel: "Laufzeit nach Ihrer Wahl" },
      ],
      garantie: G.karte,
      rateAuge: "Ihre Monatsrate ab Monat {monat} nach Auszahlung · Rechenbeispiel",
      rateBei: "bei {jahre} Jahren",
      rateKnopf: "Laufzeit wählen",
      knopf: "Laufzeit wählen", knopfLeise: "Zum Vertrag", staat: par.bundesstaat,
    },
    konditionen: {
      auge: "Ihre Konditionen · gezählt ab der Auszahlung · Ziffer 4",
      schritte: [
        { wann: `Monat 1–${par.ratenfreiMonate}`, titel: "Ratenfrei", text: "Ihre Gesellschaft zahlt in dieser Zeit nichts zurück." },
        { wann: `Monat 1–${par.zinsfreiMonate}`, titel: "Zinsfrei", text: `Auf die ersten ${zahlwort(par.zinsfreiMonate)} Monate fällt kein Zins an.` },
        { wann: `Ab Monat ${s1}`, titel: `${kapitalCProzent(par.zinsStartBp)} im Jahr`, text: `Danach steigt der Zins mit jedem Jahr um ${kapitalProzent(par.zinsSchrittBp)} Prozentpunkte.` },
        { wann: `Ab Monat ${par.aufstockungAbMonat}`, titel: "Aufstocken oder umschulden", text: "Auf Wunsch beantragt Ihre Gesellschaft eine Aufstockung oder wechselt zu einer anderen Bank — die Entscheidung liegt bei der Bank. Mit der Jahresbetreuung begleiten wir Sie dabei." },
      ],
      // Erst das Projekt („Und die Emirate?“), dann der Pflichtsatz wörtlich aus der einen Quelle (E-199).
      fein: [`Ihre Gesellschaft setzt die Finanzierung für Ihr ${projektKurz} ein. ${GLOBAL_KAPITAL_FREI.de.satz}`, GLOBAL_KAPITAL_FREI.de.steuer],
    },
    rechner: {
      auge: "Laufzeit und Rate",
      titel: "Wählen Sie Ihre Laufzeit.",
      sub: "Ihre Monatsrate sehen Sie sofort.",
      laufzeitLabel: "Laufzeit in Jahren", jahre: "Jahre", jahr: "Jahr",
      rateAuge: "Ihre Monatsrate · Rechenbeispiel", usdPraefix: "≈", usdImMonat: "im Monat",
      werte: { zinsen: "Zinsen", rueckzahlung: "Rückzahlung", zinsfreiBis: "Zinsfrei bis", zinsfreiWert: `Monat ${par.zinsfreiMonate}`, raten: "Monatsraten", letzteRate: "letzte Rate" },
      monatPraefix: "Monat",
      treppeKnopf: "Zinstreppe ansehen", treppeZu: "Zinstreppe schließen",
      treppeKopf: { zeitraum: "Zeitraum", zins: "Zins im Jahr", zinsen: "Zinsen", rest: "Restschuld danach" },
      ratenfrei: "ratenfrei", ratenfreiZinsfrei: "ratenfrei, zinsfrei", zinsfrei: "zinsfrei",
      puenktlich: "Die Raten zahlt Ihre Gesellschaft vom Geschäftskonto an die Bank — das Geld dafür überweisen Sie ihr, am einfachsten per Dauerauftrag.",
      verantwortung: `Ihre Verantwortung: ${KAPITAL_C_VERANTWORTUNG}`,
      waehrung: `Darlehen und Raten lauten auf US-Dollar; Euro-Beträge sind Umrechnungen. Steigt der Kurs des Dollars um 10${NB}%, steigt Ihre Rate in Euro um 10${NB}%.`,
      hinweis: "Rechenbeispiel nach den Bedingungen in Ziffer 4, auf die wir Ihre Finanzierung ausrichten; über die Finanzierung entscheidet die Bank, maßgeblich ist ihr Darlehensvertrag.",
      kursZeile,
      vorlesen: "{jahre} Jahre: Monatsrate {rate}, Zinsen insgesamt {zinsen}.",
    },
    llc: {
      ...BEGLEIT_LLC_TEXTE,
      sub: "Die Gesellschaft gehört allein Ihnen. Tippen Sie den Wunschnamen — „LLC“ setzen wir dahinter.",
      hinweis: `Vor der Anmeldung prüfen wir den Namen im Register von ${par.bundesstaat}; bis dahin ist er für Sie vorgemerkt. Englische Namen funktionieren in den USA am besten, Umlaute sind dort nicht möglich.`,
      alternative1: "Ausweichname 1 (freiwillig)",
      alternative2: "Ausweichname 2 (freiwillig)",
      doppelt: "Diesen Namen haben Sie schon eingetragen — bitte einen anderen.",
      aendern: "ändern",
      ausweichAuf: "Zwei Ausweichnamen angeben (freiwillig)",
      ausweichZu: "Ausweichnamen ausblenden",
    },
    paket: {
      auge: "Ihr Paket",
      titel: "Alles, was Ihre Gesellschaft braucht.",
      sub: "Wir bereiten jeden Schritt vor. Die Anträge bei Banken und Kartenherausgebern stellen Sie selbst — fertig ausgefüllt, Sie unterschreiben nur.",
      gruppen: [
        { titel: "Ihre Gesellschaft", kacheln: [
          { schluessel: "gesellschaft", titel: "Ihre US-Gesellschaft", zeile: `Gegründet in ${par.bundesstaat}, mit allen Unterlagen.`, details: ["Anmeldung beim Bundesstaat mit Staatsgebühr", "Operating Agreement und Gründungsunterlagen digital", "Pflichtenkalender, die erste Jahresmeldung beim Bundesstaat mit Staatsgebühr und die erste US-Jahresmeldung durch unseren US-Steuerberater (CPA)"] },
          { schluessel: "adresse", titel: "US-Adresse und Telefonnummer", zeile: "Eine Geschäftsadresse und eine US-Nummer für Ihre Gesellschaft.", details: ["Registered Agent und US-Geschäftsadresse", "Eigene US-Telefonnummer", "Post und Zustellungen digital in Ihrem Portal"] },
          { schluessel: "assistenz", titel: "Assistenz", zeile: "Eine Assistenz für Post, Anrufe und Termine.", details: ["Nimmt Anrufe Ihrer Gesellschaft entgegen", "Ordnet Post und Fristen", "Koordiniert Termine vor Ort — Sie müssen nicht reisen"] },
          { schluessel: "steuernummern", titel: "EIN und ITIN", zeile: "Die Steuernummer Ihrer Gesellschaft und — nach unserem ITIN-Check — Ihre persönliche US-Steuernummer.", details: ["EIN-Antrag vollständig vorbereitet, mit Vorrang", "ITIN-Check vorab: Wir prüfen, ob die Voraussetzungen der US-Steuerbehörde vorliegen", "ITIN über unseren zertifizierten Partner im DACH-Raum — persönlich oder im Videotermin", "Über die Erteilung entscheidet die US-Steuerbehörde"] },
        ] },
        { titel: "Konto und Karten", kacheln: [
          { schluessel: "privatkonto", titel: "Privates US-Konto", zeile: "Ihr eigenes Konto in den USA.", details: ["Antrag vollständig vorbereitet", "Wir begleiten Sie bis zur Eröffnung", "Über das Konto entscheidet das jeweilige Institut"] },
          { schluessel: "privatkarten", titel: "Private Kreditkarten", zeile: "Karten mit starken Reise- und Meilenprogrammen.", details: ["Auswahl der Herausgeber und Anträge vollständig vorbereitet", KAPITAL_C_KARTEN_SOLLZINS, "Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut."] },
          { schluessel: "geschaeftskonto", titel: "Geschäftskonto", zeile: "Das Konto Ihrer Gesellschaft — für Auszahlung und Raten.", details: ["Antrag vollständig vorbereitet", "Auf dieses Konto wird Ihre Finanzierung ausgezahlt", "Von hier zahlt Ihre Gesellschaft ihre Raten"] },
          { schluessel: "firmenkarte", titel: "Firmenkarte", zeile: "Die Kreditkarte Ihrer Gesellschaft.", details: ["Antrag vollständig vorbereitet", "US-Firmenkarten setzen in der Regel die persönliche Haftung des Inhabers voraus.", "Über Karte und Rahmen entscheidet der jeweilige Herausgeber."] },
        ] },
      ],
      fein: "Im ersten Jahr ist alles enthalten — auch die erste Jahresmeldung beim Bundesstaat. Ab dem zweiten Jahr hält die Jahresbetreuung Ihre Gesellschaft am Laufen — Sie finden sie unten unter „Ihre Investition“.",
      mehr: "Mehr erfahren", weniger: "Weniger",
    },
    weg: {
      auge: "Ihr Weg",
      titel: `${gross(zahlwort(par.zielWochen))} Wochen. Das ist unser Ziel.`,
      sub: "Mit dem Fast-Track laufen Gründung, Unterlagen und Bürgschaft parallel.",
      liste: [
        { nr: 1, titel: "Ihre Gesellschaft entsteht", dauer: "Woche eins", text: `Anmeldung in ${par.bundesstaat} unter Ihrem Wunschnamen, EIN mit Vorrang, US-Adresse, Telefonnummer und Assistenz. Sie unterschreiben, was wir vorbereiten.` },
        { nr: 2, titel: "Alles für die Bank", dauer: "Wochen zwei und drei", text: "Geschäftskonto, Unterlagen und Bürgschaft — wir bereiten jeden Antrag vollständig vor und stimmen alles mit der finanzierenden Bank ab." },
        { nr: 3, titel: "Auszahlung", dauer: "Woche vier — unser Ziel", text: `Ihre Finanzierung über ${betrag} auf dem Konto Ihrer Gesellschaft, in US-Dollar zum Kurs des Auszahlungstags. Zahlungen an Ihren Bauträger sagen Sie am besten erst danach zu.` },
        { nr: 4, titel: "Konto und Karten", dauer: "Danach", text: "Ihr privates US-Konto, Ihre Kreditkarten und die Firmenkarte — Schritt für Schritt, fertig vorbereitet." },
      ],
    },
    investition: {
      titel: "Ihre Investition",
      sub: "Alle Beträge sind Endpreise. Überweisung auf Rechnung — keine Lastschrift, kein Abo.",
      zeilen: [
        // „Mit Ihrem Auftrag“ statt „heute“ (fällig mit der Rechnung bei der Annahme, zahlbar binnen sieben Tagen — Runde 2).
        { wann: "Mit Ihrem Auftrag", betrag: kapitalCEur(kapitalCHeuteCents(par)), text: `Gründung, Konto und Karten${NB}${kapitalCEur(par.gruendungCents)} · Fast-Track${NB}${kapitalCEur(par.fastTrackCents)}` },
        { wann: "Mit der Eintragung Ihrer Gesellschaft", betrag: kapitalCEur(par.erfolgCents), text: `Erfolgshonorar für die erfolgreiche Gründung, einschließlich Bürgschaft — nach unserem Plan in Woche eins oder zwei. Kommt die Auszahlung nicht binnen ${zahlwort(par.garantieWochen)} Wochen, erhalten Sie auch diesen Betrag zurück.` },
        { wann: "Ab dem zweiten Jahr", betrag: `${kapitalCEur(par.jahresCents)} je Jahr`, text: "Jahresbetreuung: Adresse, Telefonnummer, Assistenz und alle US-Meldungen, solange Ihre Gesellschaft besteht — Sie zahlen jedes Jahr neu, nichts verlängert sich von selbst." },
      ],
      summe: `Im ersten Jahr insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}.`,
      fein: "Die Honorare unserer Partner sind enthalten. Zinsen und Kosten der Finanzierung richten sich nach Ziffer 4 und dem Darlehensvertrag der Bank.",
    },
    unterlagen: {
      auge: "Ihre Unterlagen",
      titel: "Ihre Unterlagen liegen vor.",
      sub: "Alles, was wir für den Start brauchen, haben Sie uns schon gegeben.",
      liste: par.unterlagen.map((u) => ({ titel: u.titel, stand: u.am ? `liegt vor seit ${kapitalTag(u.am)}` : "liegt vor" })),
      fein: "Ihre Unterlagen liegen nur bei uns, verschlüsselt — auf dieser Seite erscheinen sie nie.",
    },
    fragen: {
      titel: "Fragen und Antworten",
      sub: "Kurz und klar.",
      sichtbar: 6,
      // Runde 2 (Kundensicht): Bürgschaft offen (verbunden, 36 Monate, Rückgriff aus Ziffer 5 Abs. 5, Registerstand mit Folge), die Frage
      // nach anderen Bedingungen der Bank an Platz 2, Raten mit Dauerauftrag und Quartalsmeldung, vorzeitige Rückzahlung.
      liste: [
        { frage: "Was, wenn die Auszahlung nicht kommt?", antwort: [G.frage, "Unser Rat: Sagen Sie Zahlungen an Ihren Bauträger erst zu, wenn die Finanzierung auf dem Konto Ihrer Gesellschaft ist."] },
        { frage: "Und wenn die Bank andere Bedingungen anbietet?", antwort: [
          "Dann entscheiden Sie. Bevor Ihre Gesellschaft etwas unterschreibt, sehen Sie das Angebot der Bank schwarz auf weiß. Ein Angebot mit schlechteren Bedingungen, weiteren Sicherheiten oder Kosten für Sie muss Ihre Gesellschaft nicht annehmen — Ihre Geld-zurück-Garantie läuft dann weiter.",
          "Nur ein Angebot genau zu den Bedingungen aus Ziffer 4, ohne weitere Sicherheiten oder Kosten für Sie, lässt die Frist ruhen, solange es offensteht; lehnt Ihre Gesellschaft ein solches Angebot ab, entfällt die Geld-zurück-Garantie (Ziffer 4).",
        ] },
        { frage: "Was bedeutet die Bürgschaft für mich?", antwort: [
          `Die Bürgschaft gegenüber der Bank übernimmt unsere US-Partnergesellschaft, die ${d.buergin.name}${buerginOrt ? ` in ${buerginOrt}` : ""} — ein mit FIAON verbundenes Unternehmen —, längstens für ${zahlwort(par.buergschaftMonate)} Monate. Ihre Vergütung steckt im Erfolgshonorar; eine Bareinlage oder dingliche Sicherheit (etwa eine Grundschuld) verlangen wir nicht.`,
          `Für Sie heißt das: Solange Ihre Gesellschaft ihre Raten zahlt, kommt es auf die Bürgschaft nicht an. Müsste die Bürgin einmal für sie zahlen, ersetzen Ihre Gesellschaft und Sie persönlich ihr den gezahlten Betrag mit den Kosten — das vereinbaren Sie ausdrücklich in Ziffer 5 Absatz ${Z5.rueckgriff}.`,
          ...(buerginStand ? [buerginStand] : []),
        ] },
        { frage: "Wer zahlt die Raten?", antwort: [
          `Ihre Gesellschaft — pünktlich zu jedem Fälligkeitstag vom Geschäftskonto an die Bank. Das Geld dafür überweisen Sie ihr, am einfachsten per Dauerauftrag; wie das steuerlich zu behandeln ist, klärt unser Partner-Steuerberater vorab mit Ihnen. Die ersten ${zahlwort(par.ratenfreiMonate)} Monate nach der Auszahlung sind ratenfrei.`,
          "Solange die Bürgschaft läuft, schicken Sie uns einmal im Quartal kurz den Stand der Rückzahlungen — eine E-Mail genügt.",
        ] },
        { frage: "Kann ich die Laufzeit später ändern?", antwort: [`Über eine Umschuldung: Ab dem ${kapitalCOrdnung(par.aufstockungAbMonat)} Monat kann Ihre Gesellschaft zu einer anderen Bank wechseln oder eine Aufstockung beantragen — darüber entscheidet die Bank; mit der Jahresbetreuung begleiten wir Sie dabei. Was dann gilt, steht im neuen Vertrag der Bank.`] },
        { frage: "Kann meine Gesellschaft früher zurückzahlen?", antwort: ["Ob und wann vorzeitig zurückgezahlt werden kann, regelt der Darlehensvertrag der Bank. Diese Bedingungen zeigen wir Ihnen, bevor Ihre Gesellschaft das Angebot annimmt."] },
        { frage: "Warum Dollar?", antwort: [`Ihre Gesellschaft ist eine US-Gesellschaft: Darlehen und Raten lauten auf US-Dollar. Wir rechnen Ihnen alles in Euro um; steigt der Kurs des Dollars um 10${NB}%, steigt Ihre Rate in Euro um 10${NB}% — und umgekehrt.`] },
        { frage: "Muss das Geld in den USA bleiben?", antwort: [`Nein. Ihre Gesellschaft setzt die Finanzierung für Ihr ${projektKurz} ein. ${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer} Eine US-Gesellschaft ist kein Steuermodell.`] },
        { frage: "Muss ich in die USA reisen?", antwort: ["Nein. Unsere Partner in den USA erledigen die Termine vor Ort; Sie steuern jeden Schritt von zu Hause. Für Ihre ITIN prüft unser zertifizierter Partner im DACH-Raum vorab die Voraussetzungen — persönlich oder im Videotermin."] },
        { frage: "Wem gehört die Gesellschaft?", antwort: ["Allein Ihnen. FIAON erwirbt keine Anteile. Eine US-Gesellschaft ist kein Steuermodell — wie sie steuerlich behandelt wird, klärt unser Partner-Steuerberater vorab mit Ihnen."] },
        { frage: "Kann ich widerrufen?", antwort: ["Ja, binnen vierzehn Tagen — Belehrung und Muster-Widerrufsformular stehen in der Anlage Ihres Vertrags. Dieses Angebot gibt es mit Fast-Track: Mit Ihrer Annahme verlangen Sie, dass wir sofort beginnen; bei einem Widerruf bezahlen Sie dann nur die bis dahin erbrachten Leistungen anteilig."] },
      ],
    },
    ansprechpartner: { titel: "Ihr Ansprechpartner", sub: "Sie erreichen uns direkt — vor der Annahme bei jeder Frage, danach bei jedem Schritt." },
    vertrag: {
      titel: "Ihr Vertrag",
      sub: "Vierzehn klare Ziffern mit Widerrufsbelehrung und Muster-Widerrufsformular als Anlage — derselbe Text wie im PDF. Ihre Ausweisnummern zeigen wir hier gekürzt; im angenommenen Vertrag stehen sie vollständig.",
      dokument: kapitalCVertragTitel(),
      unterzeile: kapitalCVertragUnterzeile(d),
      inhalt: kapitalCVertragInhalt(d),
    },
    widerruf: {
      titel: "Ihr Widerrufsrecht",
      text: "Sie können den Vertrag binnen vierzehn Tagen widerrufen — ohne Angabe von Gründen. Belehrung und Muster-Widerrufsformular stehen in der Anlage.",
      knopf: "Belehrung und Formular lesen",
    },
    informationen: {
      titel: "Informationen vor Vertragsschluss",
      sub: "Alles Wesentliche auf einen Blick (Art. 246a EGBGB).",
      zeilen: [
        { titel: "Ihr Vertragspartner", text: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${kapitalCOrtZeileNb()}, ${FIAON_FIRMA.land} · ${FIAON_FIRMA.register}, Nr. ${FIAON_FIRMA.companyNo} · vertreten durch ${FIAON_FIRMA.director}, Director · Telefon ${FIAON_FIRMA.telefon} · ${FIAON_FIRMA.email}` },
        { titel: "Die Leistung", text: `Gründung Ihrer US-Gesellschaft (LLC) in ${par.bundesstaat} mit Adresse, Telefonnummer, Assistenz, EIN und — nach dem ITIN-Check — ITIN, im ersten Jahr mit der ersten Jahresmeldung beim Bundesstaat; Vorbereitung von privatem Konto, privaten Karten, Geschäftskonto und Firmenkarte; Begleitung bis zur Finanzierung über ${betrag} durch eine US-Bank mit der Bürgschaft unserer US-Partnergesellschaft (Ziffer 2 bis 5). Über die Finanzierung entscheidet die Bank.` },
        { titel: "Die Preise", text: `Mit Ihrem Auftrag fällig ${kapitalCEur(kapitalCHeuteCents(par))} (Gründung, Konto und Karten ${kapitalCEur(par.gruendungCents)}, Fast-Track ${kapitalCEur(par.fastTrackCents)}); mit der Eintragung Ihrer Gesellschaft ${kapitalCEur(par.erfolgCents)} Erfolgshonorar einschließlich Bürgschaft; im ersten Jahr insgesamt ${kapitalCEur(kapitalCErstesJahrCents(par))}; ab dem zweiten Jahr ${kapitalCEur(par.jahresCents)} je Jahr. Alle Beträge sind Endpreise.` },
        { titel: "Zahlung", text: `Per Überweisung auf Rechnung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen. Die Rechnung über ${kapitalCEur(kapitalCHeuteCents(par))} kommt mit der Annahme.` },
        { titel: "Beginn und Zeitplan", text: `Mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist (Fast-Track). Unser Ziel ist die Auszahlung in Woche ${zahlwort(par.zielWochen)}.` },
        { titel: KAPITAL_C_GARANTIE_NAME, text: G.info },
        { titel: "Sicherheiten und Bürgschaft", text: `Eine Bareinlage oder dingliche Sicherheit verlangen wir nicht. Die Bürgschaft gegenüber der Bank übernimmt unsere US-Partnergesellschaft, ein mit FIAON verbundenes Unternehmen (Ziffer 5)${buerginStand ? `, sobald sie im US-Register wieder als aktiv geführt wird; derzeit wird sie dort als inaktiv geführt` : ""}. ${KAPITAL_C_VERANTWORTUNG}` },
        { titel: "Vertragsdauer", text: `Die Begleitung läuft ${zahlwort(par.begleitMonate)} Monate ab der Eintragung. Die Jahresbetreuung ab dem zweiten Jahr — mit der Begleitung bei einer Aufstockung oder Umschuldung — beginnt nur mit Ihrer Zahlung und verlängert sich nicht von selbst. Die Finanzierung läuft über die Laufzeit, die Sie wählen.` },
        { titel: "Widerrufsrecht", text: "Vierzehn Tage ab Vertragsschluss — Belehrung und Muster-Widerrufsformular in der Anlage. Bei einem Widerruf nach Beginn zahlen Sie die bis dahin erbrachten Leistungen anteilig." },
        { titel: "Gewährleistung und Beschwerden", text: `Es gilt die gesetzliche Mängelhaftung. Beschwerden an ${FIAON_FIRMA.email}. FIAON nimmt nicht an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teil.` },
        { titel: "Vertragstext und Sprache", text: "Deutsch. Wir speichern den Vertragstext; Sie erhalten ihn nach der Annahme als PDF mit Ihrem Annahmevermerk per E-Mail." },
      ],
    },
    pflicht: [...ANGEBOT_PFLICHTHINWEIS, KAPITAL_C_PFLICHT_ZUSATZ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERSICHT (§ 312j Abs. 2 BGB) UND ANNAHME — unmittelbar über dem Knopf
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalCBestellUebersicht(d: KapitalCDaten, laufzeitJahre: number | null): { titel: string; zeilen: { label: string; wert: string }[] } {
  const par = d.parameter; const k = d.kunde;
  const plan = laufzeitJahre != null && kapitalCLaufzeitGueltig(laufzeitJahre, par) ? kapitalCPlan(par, laufzeitJahre) : null;
  return {
    titel: "Ihr Auftrag im Überblick",
    zeilen: [
      // Postleitzahlen und Orte bleiben zusammen (geschütztes Leerzeichen, Runde 2).
      { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${kapitalCOrtZeileNb()}, ${FIAON_FIRMA.land}` },
      { label: "Auftraggeber", wert: `${kapitalCName(k)}, ${k.strasse}, ${k.plz}${NB}${k.ort}` },
      { label: "Leistung", wert: `Gründung Ihrer US-Gesellschaft (LLC) in ${par.bundesstaat} mit Adresse, Telefonnummer, Assistenz, EIN und ITIN (nach ITIN-Check); Konto und Karten vorbereitet; Begleitung bis zur Finanzierung mit Bürgschaft (Ziffer 2 bis 5)` },
      { label: "Finanzierung", wert: `${kapitalCEur(par.betragCents)}, ausgezahlt in US-Dollar · ${par.ratenfreiMonate} Monate ratenfrei, ${par.zinsfreiMonate} Monate zinsfrei, ab Monat ${par.zinsfreiMonate + 1}: ${kapitalCProzent(par.zinsStartBp)} im Jahr, danach jedes Jahr ${kapitalProzent(par.zinsSchrittBp)} Prozentpunkte mehr — über die Finanzierung entscheidet die Bank (Ziffer 4)` },
      { label: KAPITAL_C_LAUFZEIT_LABEL, wert: kapitalCLaufzeitZeile(par, plan ? plan.jahre : null) },
      { label: "Ihre Verantwortung", wert: KAPITAL_C_VERANTWORTUNG },
      { label: `${KAPITAL_C_GARANTIE_NAME} (Ziffer 4)`, wert: kapitalCGarantie(par).uebersicht },
      { label: "Fällig mit Ihrem Auftrag", wert: `${kapitalCEur(kapitalCHeuteCents(par))} (Gründung, Konto und Karten ${kapitalCEur(par.gruendungCents)} + Fast-Track ${kapitalCEur(par.fastTrackCents)}) — Rechnung mit der Annahme, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen` },
      { label: "Mit der Eintragung", wert: `${kapitalCEur(par.erfolgCents)} Erfolgshonorar einschließlich Bürgschaft (Ziffer 6 Absatz 2)` },
      { label: "Im ersten Jahr insgesamt", wert: `${kapitalCEur(kapitalCErstesJahrCents(par))} — Endpreise, eine etwa anfallende Umsatzsteuer ist enthalten` },
      { label: "Ab dem zweiten Jahr", wert: `Jahresbetreuung ${kapitalCEur(par.jahresCents)} je Jahr` },
      { label: "Vertragsdauer", wert: `Begleitung ${zahlwort(par.begleitMonate)} Monate ab der Eintragung; die Jahresbetreuung ab Jahr 2 nur mit Ihrer Zahlung, keine automatische Verlängerung` },
      { label: "Beginn", wert: "sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist (Fast-Track)" },
      { label: "Widerruf", wert: "vierzehn Tage, Belehrung und Muster-Widerrufsformular in der Anlage" },
    ],
  };
}
/** Die Zeile „Laufzeit der Finanzierung“ der Übersicht — eine Quelle für Server (Vorschlag) und Seite (Wahl des Kunden). */
export const KAPITAL_C_LAUFZEIT_LABEL = "Laufzeit der Finanzierung";
export function kapitalCLaufzeitZeile(k: KapitalCKonditionen, jahre: number | null): string {
  if (jahre == null || !kapitalCLaufzeitGueltig(jahre, k)) return "bitte oben wählen";
  const plan = kapitalCPlan(k, jahre);
  const letzte = kapitalCLetzteRateAnders(plan) ? `, letzte Rate ${kapitalCEurCent(plan.letzteRateCents)}` : "";
  // Der Punkt vor „Rechenbeispiel“ hängt nie allein am Zeilenende (geschütztes Leerzeichen davor, Runde 2).
  return `${zahlwort(plan.jahre)} Jahre · Monatsrate ${kapitalCEurCent(plan.monatsrateCents)} (${kapitalCUngefaehr(kapitalCUsd(plan.usd.monatsrate))}${letzte})${NB}· Rechenbeispiel, maßgeblich ist der Darlehensvertrag der Bank`;
}
export interface KapitalCAnnahmeTexte {
  auge: string; titel: string; sub: string;
  laufzeit: string; laufzeitAendern: string;
  /** „Monatsrate {rate} (Rechenbeispiel)“ */
  rateZeile: string;
  name: string; nameAendern: string;
  gelesen: string;
  /**
   * Runde 2: KEIN Haken „gelesen“ mehr — der Satz steht direkt über der Unterschrift, die Unterschrift bestätigt ihn
   * („Mit Ihrer Unterschrift bestätigen Sie: „Ich habe …gelesen.““). Im Annahmevermerk: „Mit der Unterschrift bestätigt: …“.
   */
  gelesenVorsatz: string;
  /** Die Wörter im Satz „gelesen“, die zum Text führen (Vertrag öffnet den Leser, die anderen klappen ihren Block auf). */
  gelesenLinks: { vertrag: string; informationen: string; widerruf: string };
  sofort: string; sofortUnter: string;
  unterschrift: FirmaAnnahmeTexte["unterschrift"];
  knopf: string; knopfSendet: string; unterKnopf: string; gesperrt: string;
  /** Am Ende des Vertragslesers: ein ruhiger Sprung-Knopf (nie „zahlungspflichtig“ — der echte Knopf steht unten) und sein Satz. */
  leserKnopf: string; leserSatz: string;
}
export function kapitalCAnnahmeTexte(d: KapitalCDaten): KapitalCAnnahmeTexte {
  const par = d.parameter; const name = kapitalCName(d.kunde);
  return {
    auge: "Ihr Auftrag",
    titel: "Auftrag erteilen",
    sub: "Laufzeit, Name, ein Haken und Ihre Unterschrift — dann ist alles auf dem Weg.",
    laufzeit: KAPITAL_C_LAUFZEIT_LABEL, laufzeitAendern: "ändern",
    rateZeile: "Monatsrate {rate} (Rechenbeispiel)",
    name: "Ihre Gesellschaft", nameAendern: "ändern",
    gelesen: KAPITAL_C_GELESEN_TEXT,
    gelesenVorsatz: "Mit Ihrer Unterschrift bestätigen Sie:",
    gelesenLinks: { vertrag: "Vertrag", informationen: "Informationen vor Vertragsschluss", widerruf: "Widerrufsbelehrung" },
    sofort: KAPITAL_C_SOFORT_TEXT,
    sofortUnter: `Dieses Angebot gibt es nur mit Fast-Track: Ohne diesen Haken dürften wir erst nach Ablauf der Widerrufsfrist beginnen — für die Fertigstellung Ihres Projekts zum ${kapitalCTagLang(par.projekt.fertigstellung)} zählt aber jede Woche. Ohne den Haken können Sie das Angebot deshalb nicht annehmen.`,
    unterschrift: {
      titel: "Ihre Unterschrift",
      sub: "Zeichnen Sie mit Finger oder Maus — oder tippen Sie Ihren Namen.",
      zeichnen: "Zeichnen", tippen: "Namen tippen", neu: "Neu", platz: "Hier unterschreiben",
      tippenFeld: "Ihr Name", tippenHinweis: `Vor- und Nachname, wie im Vertrag: ${name}`,
      vorschau: "So steht Ihre Unterschrift im Vertrag",
      fehlt: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
      fehltName: `Bitte tippen Sie Ihren Namen mit Nachnamen (${String(d.kunde.nachname ?? "").trim()}).`,
    },
    knopf: KAPITAL_KNOPF,
    knopfSendet: "Ihr Auftrag wird übermittelt …",
    unterKnopf: `Mit dem Klick erteilen Sie den Auftrag. Fällig mit Ihrem Auftrag: ${kapitalCEur(kapitalCHeuteCents(par))} — per Überweisung binnen ${zahlwort(par.zahlungszielTage)} Tagen. Ihren Vertrag als PDF und die Rechnung erhalten Sie per E-Mail.`,
    gesperrt: "Dieses Angebot wird gerade vervollständigt. Ihr Ansprechpartner gibt Ihnen Bescheid, sobald Sie es annehmen können.",
    leserKnopf: "Zur Annahme",
    leserSatz: "Angenommen wird unten auf der Seite — mit einem Haken für den Fast-Track und Ihrer Unterschrift. Der Knopf bringt Sie direkt dorthin.",
  };
}
export const KAPITAL_C_ANNAHME = {
  fehltLaufzeit: "Bitte wählen Sie Ihre Laufzeit.",
  fehltGelesen: "Bitte bestätigen Sie, dass Sie Vertrag, Informationen und Widerrufsbelehrung gelesen haben.",
  fehltSofort: "Dieses Angebot gibt es nur mit Fast-Track — bitte bestätigen Sie, dass wir vor Ablauf der Widerrufsfrist beginnen.",
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: (gruss: string) => `Willkommen bei FIAON Global, ${gruss}.`,
  fertigText: (email: string, llc: string, laufzeit: string) => `Ihr Auftrag steht: ${llc}, Laufzeit ${laufzeit}. Ihren Vertrag als PDF und die Rechnung schicken wir Ihnen an ${email}. Mit Ihrem Zahlungseingang beginnen wir — und die Frist Ihrer ${KAPITAL_C_GARANTIE_NAME} läuft.`,
  fertigZahlung: (betrag: string) => `Fällig mit Ihrem Auftrag: ${betrag} für Gründung, Konto und Karten sowie Fast-Track.`,
  fertigFuss: "Fragen? Ihr Ansprechpartner ist für Sie da — oder schreiben Sie uns an support@fiaon.com.",
  /** Runde 2: der Fuß nach der Annahme mit dem Ansprechpartner aus dem Angebot (Name, Telefon, E-Mail). */
  fertigFussMit: (p: { name: string; telefon: string; email: string }) => `Fragen? ${p.name} ist für Sie da: ${p.telefon} · ${p.email}.`,
  fertigZweck: (zweck: string) => `Verwendungszweck: ${zweck}`,
  fertigDateien: { vertrag: "Vertrag mit Widerrufsbelehrung (PDF)", rechnung: (betrag: string) => `Rechnung über ${betrag} (PDF)` },
  fertigKnopf: "Zur Zahlungsseite", fertigMeinAuftrag: "Zu „Mein Auftrag“", fertigAnsprech: "Ihr Ansprechpartner",
  fertigAuge: "FIAON Global · Ihr Auftrag",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DIE VERTRAGSBESTÄTIGUNG (§ 312f Abs. 2, § 312i Abs. 1 Nr. 3 BGB) — automatisch direkt nach der Annahme
// Der Vertrag mit Annahmevermerk, Widerrufsbelehrung und Formular als PDF plus Rechnung, auf einem dauerhaften Datenträger, BEVOR
// FIAON beginnt (Beginn = Zahlungseingang). Bewusste Ausnahme zu E-301 („keine automatische Mail an Firmenkunden“): Fassung C
// schließt mit einem Verbraucher, die Bestätigung ist Pflicht — wie die Zugangs-Einladung E-423 transaktional, keine Werbung.
// Versand: server/lib/fiaon-global-angebot-kapital-c.ts (kapitalCVertragsbestaetigung), Absender welcome@.
// ═══════════════════════════════════════════════════════════════════════════
export const KAPITAL_C_BESTAETIGUNG = {
  betreff: (ref: string) => `Ihr Vertrag mit FIAON Global — Bestätigung und Unterlagen (${ref})`,
  preheader: "Ihr Vertrag als PDF — mit Widerrufsbelehrung, Muster-Widerrufsformular und Ihrer Rechnung.",
  titel: "Ihre Vertragsbestätigung",
  absaetze: (ein: { anrede: string; angenommen: string; llc: string }) => [
    `${ein.anrede}, vielen Dank für Ihr Vertrauen. Hiermit bestätigen wir Ihren Vertrag mit FIAON Global, den Sie am ${ein.angenommen} angenommen haben — mit Ihrer Gesellschaft ${ein.llc}.`,
    "Im Anhang finden Sie Ihren Vertrag mit Annahmevermerk, der Widerrufsbelehrung und dem Muster-Widerrufsformular sowie die Rechnung über Gründung, Konto und Karten und den Fast-Track.",
    "Sie können den Vertrag binnen vierzehn Tagen ohne Angabe von Gründen widerrufen; die Einzelheiten stehen in der Widerrufsbelehrung im Anhang. Sie haben verlangt, dass wir schon vor Ablauf der Widerrufsfrist beginnen (Fast-Track): Wir beginnen mit Ihrem Zahlungseingang, und widerrufen Sie danach, zahlen Sie für die bis dahin erbrachten Leistungen einen angemessenen Betrag.",
  ],
  daten: (ein: { ref: string; llc: string; laufzeit: string; heute: string; zweck: string | null; faellig: string | null }) => [
    { label: "Angebot", wert: ein.ref },
    { label: "Ihre Gesellschaft", wert: ein.llc },
    { label: KAPITAL_C_LAUFZEIT_LABEL, wert: ein.laufzeit },
    { label: "Fällig mit Ihrem Auftrag", wert: ein.heute },
    ...(ein.zweck ? [{ label: "Verwendungszweck", wert: ein.zweck }] : []),
    ...(ein.faellig ? [{ label: "Zahlbar bis", wert: ein.faellig }] : []),
  ],
  knopf: "Zur Zahlungsseite",
  knopf2: "Zu „Mein Auftrag“",
  fussnote: `Ihre ${KAPITAL_C_GARANTIE_NAME} steht in Ziffer 4 Ihres Vertrags.`,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER, KUNDE, PFLICHTFELDER (rein — Skript und Server prüfen dasselbe)
// ═══════════════════════════════════════════════════════════════════════════
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const textAus = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
export function kapitalCParameterAus(roh: Partial<KapitalCParameter> | null | undefined, basis: KapitalCParameter = KAPITAL_C_VORGABEN): KapitalCParameter {
  const r = (roh ?? {}) as Record<string, unknown>;
  const zahl = (key: keyof KapitalCParameter, min: number, max: number, ganz = true): number => {
    const v = Number(r[key]);
    return Number.isFinite(v) && v >= min && v <= max ? (ganz ? Math.round(v) : v) : (basis[key] as number);
  };
  const pr = (r.projekt && typeof r.projekt === "object" ? r.projekt : {}) as Record<string, unknown>;
  const bp = basis.projekt;
  const unterlagen = Array.isArray(r.unterlagen)
    ? (r.unterlagen as any[]).slice(0, 12).map((u) => ({ titel: textAus(u?.titel, 120), am: ISO.test(String(u?.am ?? "")) ? String(u.am) : "" })).filter((u) => u.titel)
    : basis.unterlagen;
  const ap = Array.isArray(r.ansprechpartner) ? (r.ansprechpartner as unknown[]).map(String).filter((kz) => ANGEBOT_ANSPRECHPARTNER.some((x) => x.kuerzel === kz)).slice(0, 3) : basis.ansprechpartner;
  const minJ = zahl("laufzeitMinJahre", 1, 30); const maxJ = Math.max(minJ, zahl("laufzeitMaxJahre", 1, 30));
  const vorschlag = zahl("laufzeitVorschlagJahre", 1, 30);
  return {
    gruendungCents: zahl("gruendungCents", 10_000, 10_000_000),
    fastTrackCents: zahl("fastTrackCents", 0, 1_000_000),
    erfolgCents: zahl("erfolgCents", 0, 10_000_000),
    jahresCents: zahl("jahresCents", 0, 1_000_000),
    zahlungszielTage: zahl("zahlungszielTage", 0, 30),
    betragCents: zahl("betragCents", 100_000, 10_000_000_000),
    kursUsdJeEur: zahl("kursUsdJeEur", 0.5, 2.5, false),
    kursDatum: ISO.test(String(r.kursDatum ?? "")) ? String(r.kursDatum) : basis.kursDatum,
    ratenfreiMonate: zahl("ratenfreiMonate", 0, 24),
    zinsfreiMonate: zahl("zinsfreiMonate", 0, 60),
    zinsStartBp: zahl("zinsStartBp", 0, 3_000),
    zinsSchrittBp: zahl("zinsSchrittBp", 0, 1_000),
    laufzeitMinJahre: minJ,
    laufzeitMaxJahre: maxJ,
    laufzeitVorschlagJahre: Math.min(maxJ, Math.max(minJ, vorschlag)),
    aufstockungAbMonat: zahl("aufstockungAbMonat", 1, 99),
    projekt: {
      art: textAus(pr.art, 60) || bp.art,
      wo: textAus(pr.wo, 100) || bp.wo,
      woKurz: textAus(pr.woKurz, 60) || bp.woKurz,
      bezahltProzent: Number.isFinite(Number(pr.bezahltProzent)) && Number(pr.bezahltProzent) >= 0 && Number(pr.bezahltProzent) <= 100 ? Math.round(Number(pr.bezahltProzent)) : bp.bezahltProzent,
      fertigstellung: ISO.test(String(pr.fertigstellung ?? "")) ? String(pr.fertigstellung) : bp.fertigstellung,
    },
    garantieWochen: zahl("garantieWochen", 1, 52),
    erstattungTage: zahl("erstattungTage", 1, 60),
    zielWochen: zahl("zielWochen", 1, 52),
    bundesstaat: textAus(r.bundesstaat, 40) || basis.bundesstaat,
    buergschaftMonate: zahl("buergschaftMonate", 1, 240),
    buerginAktiv: typeof r.buerginAktiv === "boolean" ? r.buerginAktiv : basis.buerginAktiv,
    buerginStandAm: ISO.test(String(r.buerginStandAm ?? "")) ? String(r.buerginStandAm) : basis.buerginStandAm,
    unterschriftFrei: typeof r.unterschriftFrei === "boolean" ? r.unterschriftFrei : basis.unterschriftFrei,
    begleitMonate: zahl("begleitMonate", 1, 60),
    unterlagen,
    ddAbgeschlossen: typeof r.ddAbgeschlossen === "boolean" ? r.ddAbgeschlossen : basis.ddAbgeschlossen,
    ansprechpartner: ap.length ? ap : basis.ansprechpartner,
  };
}
export function kapitalCParameterFehler(par: KapitalCParameter): string | null {
  if (!par.gruendungCents) return "Preis der Gründung fehlt.";
  if (!par.bundesstaat) return "Bundesstaat fehlt.";
  if (par.zielWochen > par.garantieWochen) return "Das Ziel liegt hinter der Garantiefrist.";
  if (par.laufzeitMinJahre > par.laufzeitMaxJahre) return "Laufzeit: kürzeste über längster.";
  if (par.laufzeitMaxJahre * 12 + par.ratenfreiMonate > 99 * 12) return "Laufzeit zu lang.";
  return null;
}
/** Der Kunde aus der privaten Datei — bereinigt, oder der erste Fehler. Geprüft wird, was im Vertrag steht. */
export function kapitalCKundePruefen(roh: any): { ok: true; kunde: KapitalCKunde } | { ok: false; error: string } {
  const land = String(roh?.land ?? "DE").toUpperCase() as KapitalCLand;
  if (!["DE", "AT", "CH"].includes(land)) return { ok: false, error: "Land: Deutschland, Österreich oder Schweiz." };
  const ausweise: KapitalCAusweis[] = Array.isArray(roh?.ausweise)
    ? (roh.ausweise as any[]).slice(0, 3).map((a) => ({
      art: a?.art === "personalausweis" ? "personalausweis" as const : "reisepass" as const,
      nummer: textAus(a?.nummer, 20).toUpperCase().replace(/\s+/g, ""),
      gueltigBis: ISO.test(String(a?.gueltigBis ?? "")) ? String(a.gueltigBis) : "",
      behoerde: textAus(a?.behoerde, 80),
    }))
    : [];
  const kunde: KapitalCKunde = {
    art: "privat",
    anrede: ["Herr", "Frau"].includes(String(roh?.anrede)) ? (String(roh.anrede) as "Herr" | "Frau") : "",
    vorname: textAus(roh?.vorname, 80), nachname: textAus(roh?.nachname, 80),
    geburtsdatum: ISO.test(String(roh?.geburtsdatum ?? "")) ? String(roh.geburtsdatum) : "",
    geburtsort: textAus(roh?.geburtsort, 80), staatsangehoerigkeit: textAus(roh?.staatsangehoerigkeit, 40).toLowerCase(),
    strasse: textAus(roh?.strasse, 160), plz: textAus(roh?.plz, 10), ort: textAus(roh?.ort, 120), land,
    email: textAus(roh?.email, 160).toLowerCase(), telefon: textAus(roh?.telefon, 40),
    ausweise,
  };
  if (!kunde.vorname || !kunde.nachname) return { ok: false, error: "Vorname und Nachname fehlen." };
  if (!kunde.geburtsdatum) return { ok: false, error: "Geburtsdatum fehlt (JJJJ-MM-TT)." };
  if (kunde.strasse.length < 3 || !kunde.ort) return { ok: false, error: "Anschrift unvollständig." };
  if (!(land === "DE" ? /^\d{5}$/ : /^\d{4}$/).test(kunde.plz)) return { ok: false, error: "Postleitzahl passt nicht zum Land." };
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(kunde.email)) return { ok: false, error: "E-Mail-Adresse ungültig." };
  if (!ausweise.length) return { ok: false, error: "Mindestens ein Ausweisdokument fehlt." };
  for (const a of ausweise) {
    if (!/^[A-Z0-9]{6,12}$/.test(a.nummer)) return { ok: false, error: `${AUSWEIS_NAME[a.art]}: Nummer ungültig.` };
    if (!a.gueltigBis || !a.behoerde) return { ok: false, error: `${AUSWEIS_NAME[a.art]}: Gültigkeit oder Behörde fehlt.` };
  }
  return { ok: true, kunde };
}
export function kapitalCBuerginFehler(b: Partial<KapitalBuergin> | null | undefined): string | null {
  if (!b || !b.name || !b.bundesstaat || !b.registernummer || !b.anschrift || !b.vertreter || !b.funktion) return "Angaben zur Bürgin (Name, Bundesstaat, Registernummer, Anschrift, Vertreter, Funktion)";
  return null;
}
export function kapitalCPflichtFehlen(d: Pick<KapitalCDaten, "kunde" | "parameter" | "buergin">): string[] {
  const fehlt: string[] = [];
  const k = kapitalCKundePruefen(d.kunde);
  if (!k.ok) fehlt.push(`Auftraggeber: ${k.error}`);
  const pf = kapitalCParameterFehler(d.parameter); if (pf) fehlt.push(pf);
  const bf = kapitalCBuerginFehler(d.buergin); if (bf) fehlt.push(bf);
  if (!d.parameter.unterschriftFrei) fehlt.push("Freigabe zur Unterschrift (Justins GO) — Parameter unterschriftFrei");
  return fehlt;
}
export function kapitalCAnsprechpartner(par: Pick<KapitalCParameter, "ansprechpartner">): { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[] {
  const aus = par.ansprechpartner.map((kz) => ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === kz)).filter(Boolean) as { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[];
  return aus.length ? aus : ANGEBOT_ANSPRECHPARTNER.filter((x) => x.kuerzel === "justin");
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DER ANNAHME — Rechnung Teil 2, „Mein Auftrag“, Aufgaben, Fristwarnung (rein, Texte nach Fassung C)
// ═══════════════════════════════════════════════════════════════════════════
/** Teil 2 = Erfolgshonorar bei Eintragung (Chefbüro-Knopf „Gesellschaft eingetragen“). Fassung C kennt keinen Teil 3. */
export const KAPITAL_C_TEIL2 = { nr: 2 as const, titel: "Erfolgshonorar", ziffer: "Ziffer 6 Absatz 2", ereignis: "Gesellschaft beim Bundesstaat eingetragen", knopf: "Gesellschaft eingetragen", datumLabel: "Eingetragen am" };
export const KAPITAL_C_KEIN_TEIL3 = "Fassung C: keine Vergütung bei Auszahlung — das Erfolgshonorar wird mit der Eintragung fällig.";
/**
 * Der zweite Knopf der Fassung C (Route …/kapital/auszahlung): hält die Auszahlung fest — KEINE Rechnung. Er setzt
 * garantie_erfuellt_am; damit enden die Fristwarnungen (kapitalFristSchritt) und „Mein Auftrag“ sagt „Garantie erfüllt“.
 */
export const KAPITAL_C_AUSZAHLUNG = { knopf: "Finanzierung ausgezahlt", datumLabel: "Ausgezahlt am", hinweis: "Ziffer 4: hält die Auszahlung fest — die Garantie ist erfüllt, die Fristwarnungen enden. Keine Rechnung." };
export function kapitalCAuszahlungPruefen(
  lage: { status: string; angenommenAm: string | null; heute: string; garantieErfuelltAm: string | null; erstattungAusgeloest: boolean;
    /** Beginn der Garantiefrist (Zahlung Teil 1) — vorher ist der Knopf zu (Runde 2: ein Fehlklick setzte sonst „Garantie erfüllt“). */
    fristBeginn: string | null }, ein: any,
): { ok: true; daten: { datum: string; beleg: string } } | { ok: false; error: string; schon?: true } {
  if (lage.status !== "angenommen") return { ok: false, error: "Erst nach der Annahme." };
  if (lage.garantieErfuelltAm) return { ok: false, error: `Die Auszahlung ist schon eingetragen (${kapitalTag(lage.garantieErfuelltAm)}).`, schon: true };
  if (lage.erstattungAusgeloest) return { ok: false, error: "Der Garantiefall ist vorgemerkt — die Auszahlung bitte mit der Leitung klären." };
  if (!lage.fristBeginn) return { ok: false, error: "Erst wenn Gründung und Fast-Track bezahlt sind — dann läuft die Frist der Geld-zurück-Garantie (Ziffer 4)." };
  const datum = String(ein?.datum ?? "").trim();
  if (!ISO.test(datum)) return { ok: false, error: `${KAPITAL_C_AUSZAHLUNG.datumLabel}: Datum fehlt (JJJJ-MM-TT).` };
  if (datum > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (lage.angenommenAm && datum < lage.angenommenAm) return { ok: false, error: `Das Datum liegt vor der Annahme (${kapitalTag(lage.angenommenAm)}).` };
  if (datum < lage.fristBeginn) return { ok: false, error: `Das Datum liegt vor dem Beginn der Frist (${kapitalTag(lage.fristBeginn)}).` };
  return { ok: true, daten: { datum, beleg: String(ein?.beleg ?? "").replace(/\s+/g, " ").trim().slice(0, 600) } };
}
export function kapitalCTeil2Pruefen(
  lage: { status: string; parameter: Pick<KapitalCParameter, "erfolgCents">; angenommenAm: string | null; heute: string; teil1Bezahlt: boolean; vorhanden: { rechnungSteht: boolean } | null },
  ein: any,
): { ok: true; daten: { datum: string; beleg: string; betragCents: number } } | { ok: false; error: string; schon?: true } {
  if (lage.status !== "angenommen") return { ok: false, error: "Erst nach der Annahme." };
  const betragCents = lage.parameter.erfolgCents;
  if (!(betragCents > 0)) return { ok: false, error: "Im Vertrag ist kein Erfolgshonorar vereinbart." };
  if (lage.vorhanden?.rechnungSteht) return { ok: false, error: "Das Erfolgshonorar ist schon berechnet.", schon: true };
  if (!lage.teil1Bezahlt) return { ok: false, error: "Erst wenn Gründung und Fast-Track bezahlt sind (Ziffer 6 Absatz 1) — vorher meldet FIAON nicht an." };
  const datum = String(ein?.datum ?? "").trim();
  if (!ISO.test(datum)) return { ok: false, error: `${KAPITAL_C_TEIL2.datumLabel}: Datum fehlt (JJJJ-MM-TT).` };
  if (datum > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (lage.angenommenAm && datum < lage.angenommenAm) return { ok: false, error: `Das Datum liegt vor der Annahme (${kapitalTag(lage.angenommenAm)}).` };
  const beleg = String(ein?.beleg ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  return { ok: true, daten: { datum, beleg, betragCents } };
}
/** „Ihr Weg“ in „Mein Auftrag“ (fiaon-global-bereich.ts) — dieselben Etappen-Nummern, die Texte dieses Vertrags. */
export const KAPITAL_C_ETAPPEN: Record<1 | 2 | 3 | 4, { titel: string; text: string }> = {
  1: { titel: "Gründung und Dokumente", text: "Ihre LLC mit Staatsgebühr und Operating Agreement, EIN und — nach dem ITIN-Check — ITIN, US-Adresse, Telefonnummer und Assistenz. Wir bereiten alles vor und reichen ein; Sie unterschreiben, was wir Ihnen fertig zuschicken." },
  2: { titel: "Alles für die Bank", text: "Geschäftskonto, Unterlagen und Bürgschaft — wir bereiten jeden Antrag vollständig vor und stimmen alles mit der finanzierenden Bank ab." },
  3: { titel: "Konto und Karten", text: "Ihr privates US-Konto, Ihre Kreditkarten und die Firmenkarte — fertig vorbereitet; die Anträge stellen Sie selbst." },
  4: { titel: "Ihre Finanzierung", text: `Die Auszahlung auf das Konto Ihrer Gesellschaft, mit der Bürgschaft unserer US-Partnergesellschaft — und Ihrer ${KAPITAL_C_GARANTIE_NAME} aus Ziffer 4.` },
};
/**
 * Die öffentliche Zahlungsseite (/zahlung/<Zweck>, angebotTeilZahlungsKontext) für TEIL 2 der Fassung C — das Erfolgshonorar mit der
 * Eintragung. Runde 2 (Technik): Die Seite zeigte die Texte der Fassung B („Die Bürgschaft … steht“, „Bürgschaft zugesagt“) — bei C ist
 * die Bürgin inaktiv, und Teil 2 hängt an der Eintragung. Rein, damit der Prüfstand die Texte liest. Teil 1 nutzt die allgemeinen Texte.
 */
export function kapitalCZahlungsseiteTeil2(ein: { bezahlt: boolean; angebotRef: string; titel: string; eingetragenAm: string | null; zielWochen: number }): {
  satz: string; pruefung: { titel: string; text: string }; schritte: { titel: string; text: string }[];
} {
  return {
    satz: ein.bezahlt
      ? `Ihre Zahlung ist eingegangen — vielen Dank. Angebot ${ein.angebotRef}, ${ein.titel}.`
      : `Ihre Gesellschaft ist eingetragen — offen ist das Erfolgshonorar (Ziffer 6 Absatz 2, Angebot ${ein.angebotRef}).`,
    pruefung: { titel: "Gesellschaft eingetragen", text: `${ein.eingetragenAm ? `am ${kapitalTag(ein.eingetragenAm)} ` : ""}beim Bundesstaat (Ziffer 6 Absatz 2)` },
    schritte: [
      { titel: "Ihre Zahlung", text: "Überweisen Sie die Rechnung mit Ihrem Verwendungszweck — am schnellsten als Echtzeitüberweisung." },
      { titel: KAPITAL_C_ETAPPEN[2].titel, text: KAPITAL_C_ETAPPEN[2].text },
      { titel: "Auszahlung", text: `Unser Ziel ist die Auszahlung in Woche ${zahlwort(ein.zielWochen)} — und Ihre ${KAPITAL_C_GARANTIE_NAME} gilt (Ziffer 4).` },
    ],
  };
}
export interface KapitalCAuftragTeilEin { nr: number; titel: string; betragCents: number; stand: string; rechnungsnummer: string | null; bestellRef: string | null; ereignisAm: string | null; bezahltAm: string | null }
export function kapitalCMeinAuftrag(ein: {
  parameter: KapitalCParameter;
  angenommenAm: string | null;
  teile: KapitalCAuftragTeilEin[];
  garantieErfuelltAm: string | null;
  erstattungAusgeloest: boolean;
  gespeichert?: { beginn: string | null; ende: string | null };
  laufzeitJahre: number | null;
}) {
  const par = ein.parameter;
  const roh = (nr: number) => ein.teile.find((t) => Number(t.nr) === nr) ?? null;
  const t1 = roh(1), t2 = roh(2);
  const teile: { nr: number; titel: string; betragCents: number; stand: string; rechnungsnummer: string | null; bestellRef: string | null; hinweis: string | null }[] = [{
    nr: 1, titel: "Gründung und Fast-Track", betragCents: t1?.betragCents ?? kapitalCHeuteCents(par), stand: t1?.stand ?? "offen",
    rechnungsnummer: t1?.rechnungsnummer ?? null, bestellRef: t1?.bestellRef ?? null,
    hinweis: `Gründung, Konto und Karten im ersten Jahr (${kapitalCEur(par.gruendungCents)}) und Fast-Track (${kapitalCEur(par.fastTrackCents)})`,
  }];
  if (t2) teile.push({ nr: 2, titel: KAPITAL_C_TEIL2.titel, betragCents: t2.betragCents, stand: t2.stand, rechnungsnummer: t2.rechnungsnummer, bestellRef: t2.bestellRef, hinweis: t2.ereignisAm ? `Gesellschaft eingetragen am ${kapitalTag(t2.ereignisAm)}` : null });
  else if (par.erfolgCents > 0) teile.push({ nr: 2, titel: KAPITAL_C_TEIL2.titel, betragCents: par.erfolgCents, stand: ein.erstattungAusgeloest ? "entfallen" : "noch nicht fällig", rechnungsnummer: null, bestellRef: null,
    hinweis: ein.erstattungAusgeloest ? "entfällt nach Ziffer 4" : "fällig mit der Eintragung Ihrer Gesellschaft (Ziffer 6 Absatz 2) — die Bürgschaft ist darin enthalten" });
  const wochen = par.garantieWochen; const betrag = kapitalCEur(par.betragCents);
  const bezahltAm = t1?.bezahltAm ?? null;
  const beginn = bezahltAm ? (ein.angenommenAm && ein.angenommenAm > bezahltAm ? ein.angenommenAm : bezahltAm) : null;
  const plus = (iso: string, n: number) => { const x = new Date(`${iso.slice(0, 10)}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const endeRoh = beginn ? plus(beginn, wochen * 7) : null;
  const g = ein.gespeichert;
  const ende = beginn && endeRoh && g?.ende && g.beginn === beginn && g.ende >= endeRoh ? g.ende : endeRoh;
  const zurueck = "erstatten wir Ihnen alles, was Sie an uns gezahlt haben (Ziffer 4)";
  // Die Geld-zurück-Garantie sichert das Geld des Kunden — nie „wir garantieren die Auszahlung“ (Nachprüfung 27.10.).
  const garantieSatz = ein.garantieErfuelltAm ? `Ihre Finanzierung über ${betrag} ist ausgezahlt (${kapitalTag(ein.garantieErfuelltAm)}) — die ${KAPITAL_C_GARANTIE_NAME} ist damit erfüllt.`
    : ein.erstattungAusgeloest ? "Die Frist ist abgelaufen, ohne dass Ihre Finanzierung ausgezahlt wurde. Wir erstatten Ihnen alles, was Sie an uns gezahlt haben (Ziffer 4)."
    : beginn && ende ? `Ihre ${KAPITAL_C_GARANTIE_NAME}: Ist Ihre Finanzierung über ${betrag} nicht bis zum ${kapitalTag(ende)} ausgezahlt, ${zurueck}. Die ${zahlwort(wochen)} Wochen laufen seit dem ${kapitalTag(beginn)}; ruht die Frist nach Ziffer 4 Absatz 6, verschiebt sich dieser Tag entsprechend.`
    : `Ihre ${KAPITAL_C_GARANTIE_NAME}: Ist Ihre Finanzierung über ${betrag} nicht binnen ${zahlwort(wochen)} Wochen ausgezahlt, ${zurueck}. Die Wochen laufen ab Ihrer Zahlung von Gründung und Fast-Track.`;
  const summeCents = teile.filter((t) => t.nr === 1 || (t.bestellRef && !["storniert", "entfallen", "noch nicht fällig"].includes(t.stand))).reduce((s, t) => s + t.betragCents, 0);
  const plan = ein.laufzeitJahre != null && kapitalCLaufzeitGueltig(ein.laufzeitJahre, par) ? kapitalCPlan(par, ein.laufzeitJahre) : null;
  return {
    teile, garantieSatz,
    garantieZiel: `${KAPITAL_C_GARANTIE_NAME}: Ist die Finanzierung über ${betrag} nicht binnen ${zahlwort(wochen)} Wochen ab Auftragserteilung ausgezahlt, erhalten Sie alles Gezahlte zurück (Ziffer 4)`,
    fristBeginn: beginn, fristEnde: ende, summeCents,
    teil2Bedingung: teile.find((t) => t.nr === 2)?.hinweis ?? "",
    seiteHinweis: `Ihre ${KAPITAL_C_GARANTIE_NAME} steht in Ziffer 4 Ihres Vertrags.${plan ? ` Ihre Laufzeit: ${zahlwort(plan.jahre)} Jahre, Monatsrate nach dem Rechenbeispiel ${kapitalCEurCent(plan.monatsrateCents)}.` : ""}`,
    jahresZeile: par.jahresCents > 0 ? `Ab dem zweiten Jahr betreuen wir Ihre Gesellschaft für ${kapitalCEur(par.jahresCents)} je Jahr (Ziffer 6): Adresse, Telefonnummer, Assistenz und alle Meldungen — die Jahresbetreuung verlängert sich nicht von selbst.` : "",
  };
}
/** Die Aufgabe an Justin, wenn Teil 1 bezahlt ist (wie kapitalStartAufgabe, Fassung C). */
export function kapitalCStartAufgabe(ein: {
  angebotRef: string; name: string; parameter: KapitalCParameter; bezahltAm: string; zweck: string | null;
  frist: { beginn: string; ende: string } | null; llc: string | null; laufzeitJahre: number | null;
  /** Ist die Vertragsbestätigung (§ 312f BGB) beim Kunden? Ohne sie beginnt FIAON nicht — die Aufgabe sagt es dann zuerst. */
  bestaetigung?: { da: boolean; grund: string | null } | null;
}): { titel: string; text: string } {
  const par = ein.parameter;
  const unterlagen = par.unterlagen.length ? par.unterlagen.map((u) => u.titel).join(", ") : "—";
  const ohneBestaetigung = ein.bestaetigung ? !ein.bestaetigung.da : false;
  return {
    titel: `${ohneBestaetigung ? "ERST Vertragsbestätigung senden — " : ""}Kapital-Angebot ${ein.angebotRef}: Gründung bezahlt — LLC anmelden (${ein.name}, privat)`,
    text: [
      ...(ohneBestaetigung ? [`VERTRAGSBESTÄTIGUNG FEHLT (§ 312f BGB): Die Mail mit Vertrag (PDF) und Rechnung ist nicht nachweislich beim Kunden (${ein.bestaetigung?.grund ?? "unbekannt"}). Bitte Adresse prüfen und im Office „Auftragsmail nachholen“ drücken — das schickt Vertrag und Rechnung genau einmal. Kam sie nachweislich an (Brevo „zugestellt“, oder von Hand geschickt und vom Kunden bestätigt), ist nichts zu tun. Erst wenn auch das Nachholen scheitert, von Hand schicken. Vorher nicht anmelden.`] : []),
      `${ein.name} hat Gründung und Fast-Track bezahlt (${kapitalEur(kapitalCHeuteCents(par))}, Teil 1${ein.zweck ? `, Verwendungszweck ${ein.zweck}` : ""}, eingegangen am ${kapitalTag(ein.bezahltAm)}). Der Auftrag läuft — Fast-Track, Sofortbeginn ausdrücklich verlangt.`,
      `ANMELDUNG (Ziffer 2): ${ein.llc ?? "Wunschname siehe Annahmevermerk"} in ${par.bundesstaat} — binnen fünf Werktagen nach Zahlungseingang einreichen, also bis ${kapitalTag(plusWerktageRein(ein.bezahltAm, 5))}. Die Unterlagen nach Ziffer 7 Absatz 1 liegen vor (${unterlagen}) — bitte in der Akte ablegen, falls noch nicht geschehen. ITIN nur nach ITIN-Check (Ziffer 2).`,
      ein.frist ? `GELD-ZURÜCK-GARANTIE (Ziffer 4): Auszahlung über ${kapitalEur(par.betragCents)} — die ${zahlwort(par.garantieWochen)} Wochen laufen seit dem ${kapitalTag(ein.frist.beginn)}, die Frist endet am ${kapitalTag(ein.frist.ende)}. Ziel mit Fast-Track: Woche ${zahlwort(par.zielWochen)}. Kommt sie nicht, erstattet FIAON alles Gezahlte binnen ${zahlwort(par.erstattungTage)} Tagen. Ruhezeiten (Tage, um die der Kunde die Frist für Unterlagen der Bank nach Ziffer 7 Absatz 2 überschreitet; nicht angenommenes Angebot ohne weitere Sicherheiten oder Kosten) bitte mit Datum im Verlauf festhalten.` : "GELD-ZURÜCK-GARANTIE: keine Frist gesetzt.",
      `LAUFZEIT: ${ein.laufzeitJahre ? kapitalCLaufzeitSatz(par, ein.laufzeitJahre) : "—"}.`,
      ...(par.buerginAktiv ? [] : ["BÜRGIN: im Register als inaktiv vermerkt — die Bürgschaft erst nach der Reaktivierung (Ziffer 5); Reinstatement mit Beleg in die Akte."]),
      `DANACH: Ist die Gesellschaft eingetragen → Knopf „${KAPITAL_C_TEIL2.knopf}“ (Rechnung Erfolgshonorar ${kapitalEur(par.erfolgCents)}).`,
      "Keine automatische Kundenmail zum Start — den Start bitte persönlich mitteilen.",
    ].join("\n"),
  };
}
function plusWerktageRein(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  let rest = n;
  while (rest > 0) { d.setUTCDate(d.getUTCDate() + 1); const w = d.getUTCDay(); if (w !== 0 && w !== 6) rest--; }
  return d.toISOString().slice(0, 10);
}
/** Die Fristwarnung (wie kapitalFristAufgabe, Fassung C — Euro statt CHF, Erfolgshonorar statt Auszahlungsvergütung). */
export function kapitalCFristAufgabe(ein: {
  schritt: "warnung14" | "warnung3" | "abgelaufen"; tageBis: number; angebotRef: string; name: string;
  fristBeginn: string | null; fristEnde: string; parameter: KapitalCParameter;
}): { titel: string; text: string; dringend: boolean } {
  const par = ein.parameter; const ende = kapitalTag(ein.fristEnde);
  const bisD = new Date(`${ein.fristEnde.slice(0, 10)}T12:00:00Z`); bisD.setUTCDate(bisD.getUTCDate() + par.erstattungTage);
  const bis = kapitalTag(bisD.toISOString().slice(0, 10));
  const ziel = kapitalEur(par.betragCents);
  const ruhen = "Ruhte die Frist (der Kunde hat die Frist für Unterlagen der Bank nach Ziffer 7 Absatz 2 überschritten — nur diese Tage — oder ein vorgelegtes Angebot zu den Bedingungen nach Ziffer 4 ohne weitere Sicherheiten oder Kosten wurde nicht angenommen), die Tage bitte mit Datum im Verlauf festhalten.";
  const ohne = "Das System hat KEIN Geld bewegt und keine Mail an den Kunden geschickt.";
  if (ein.schritt === "abgelaufen") {
    return {
      titel: `Frist abgelaufen — Garantie Ziffer 4 prüfen (Kapital-Angebot ${ein.angebotRef}, ${ein.name})`,
      text: [`Die Garantiefrist (Ziffer 4) des Kapital-Angebots ${ein.angebotRef} endete am ${ende}.`, `Wurde die Finanzierung über ${ziel} bis zum ${ende} ausgezahlt: Knopf „${KAPITAL_C_AUSZAHLUNG.knopf}“ mit dem Tag der Auszahlung.`, ruhen,
        `Sonst ist der Garantiefall da: FIAON erstattet alles Gezahlte (Gründung, Fast-Track und ein bezahltes Erfolgshonorar) binnen ${zahlwort(par.erstattungTage)} Tagen nach Fristende, also bis ${bis}. Die Gesellschaft bleibt dem Auftraggeber.`, ohne].join("\n"),
      dringend: true,
    };
  }
  return {
    titel: `Kapital-Angebot ${ein.angebotRef}: Garantiefrist endet am ${ende} (noch ${ein.tageBis} ${ein.tageBis === 1 ? "Tag" : "Tage"}) — ${ein.name}`,
    text: [`Die Garantie aus Ziffer 4 läuft am ${ende} ab: Auszahlung über ${ziel} binnen ${zahlwort(par.garantieWochen)} Wochen${ein.fristBeginn ? ` (seit dem ${kapitalTag(ein.fristBeginn)})` : ""}.`,
      `Stand prüfen: Ist die Finanzierung ausgezahlt, Knopf „${KAPITAL_C_AUSZAHLUNG.knopf}“ — dann endet diese Erinnerung.`, ruhen,
      `Kommt die Auszahlung bis zum ${ende} nicht, erstattet FIAON alles Gezahlte binnen ${zahlwort(par.erstattungTage)} Tagen nach Fristende (bis ${bis}).`, ohne].join("\n"),
    dringend: ein.schritt === "warnung3",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSICHT (GET /api/fiaon/global/angebot/:token für ein offenes Kapital-Angebot der Fassung C)
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalCKundenSicht {
  ok: true; status: "offen"; art: "kapital"; variante: "privat";
  ref: string; fassung: string; gueltigBis: string;
  kunde: { anrede: string; vorname: string; nachname: string; email: string };
  kundeAnrede: string;
  seite: KapitalCSeite;
  /** Die Konditionen für den Rechner im Browser (dieselbe Funktion kapitalCPlan wie Server und Vertrag) */
  konditionen: KapitalCKonditionen & { laufzeitVorschlagJahre: number };
  /** Porträt mit Stand (?v=) und — bei einem KI-Porträt — dem Hinweis am Bild (E-288, Art. 50 Abs. 4 KI-VO). */
  ansprechpartner: { kuerzel: string; name: string; rolle: string; email: string; telefon: string; portrait: string; alt?: string; kiHinweis?: string | null }[];
  uebersicht: { titel: string; zeilen: { label: string; wert: string }[] };
  annahme: KapitalCAnnahmeTexte;
  annahmeBereit: boolean;
  gesperrtGrund: string | null;
  vorschauLeitung?: boolean;
  fehlt?: string[];
  html: string;
  textHash: string;
  vertragPdf: string;
}
