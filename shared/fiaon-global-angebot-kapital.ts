// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS KAPITAL-ANGEBOT FÜR FIRMENKUNDEN (Register E-399, 19.10.2026)
//
// Justin (19.10.2026, nach einem Gespräch mit einem Schweizer Agenturinhaber): „er möchte 50.000 CHF Kapital aufnehmen über
// eine US LLC — wir gründen die für ihn, stellen ihm Steuerberater, Anwalt, Unternehmensberater zur Seite und bürgen für sein
// Funding in Höhe der 50k CHF. Zu einem Preis von 2.799 € plus 699 € Jahresgebühr. Cinematische Vertrags- oder Angebotsseite,
// vorher eine Compliance-Prüfung, die wir wie bei jedem Kunden auf der Seite einbinden.“
//
// ── WARUM EIN EIGENER PFAD ─────────────────────────────────────────────────
// Das Firmenangebot (E-301) rechnet mit Monatsbudget, Umsatzanteil und Mindestlaufzeit — das passt hier nicht. Dieses
// Angebot ist kompakt: ein Festpreis, eine Jahresbetreuung ab dem zweiten Jahr, ein Team, eine Bürgschaft mit Höchstbetrag.
// Es nutzt aber alles Bewährte: die Bausteine der Firmenseite (Glückwunsch, Zeitstrahl, Compliance-Bühne mit Ampel,
// Vertragsleser, Unterschrift), den Prüfbericht in der Spalte pruefbericht, und nach der Annahme denselben Weg wie das
// Firmenangebot: Bestellzeile global_individuell aus Teil 1, Akte mit bestaetigungen.firmenangebot (keine automatische Mail,
// E-301/E-350), Rechnung mit Reverse Charge, Zahlungsseite mit Prüfliste (E-320).
//
// ── DIE ENTSCHEIDUNGEN DARIN ───────────────────────────────────────────────
//   · Bürgschaft in der Währung der Finanzierung (CHF) mit Höchstbetrag — kein Kursrisiko für den Kunden; USD nur als
//     Umrechnung mit Datum. Laufzeit höchstens sechsunddreißig Monate.
//   · Aufschiebende Bedingungen statt Versandsperre: Die Bürgschaft wird erst bei der Finanzierung gebraucht. Bis dahin
//     müssen Zahlung, Identifizierung, die Auflagen des Prüfberichts, ein Plan für die Mittel und eine im Register aktive
//     Bürgin vorliegen — so ist das Angebot heute versendbar und die Zusage trotzdem sauber.
//   · Rückgriff (Ersatzanspruch der Bürgin gegen Gesellschaft und Auftraggeberin) — der gesetzliche Normalfall, ausdrücklich
//     geschrieben. Keine Avalprovision, keine Sicherheiten, keine persönliche Haftung des Inhabers verlangt.
//   · Steuer- und Rechtsleistungen erbringen Partner auf eigenes Mandat; ihre Honorare trägt FIAON (wie E-268/E-312).
//   · Unternehmergeschäft: kein Widerrufsrecht; Rechnung ohne Umsatzsteuer (Leistung aus London an ein Unternehmen —
//     in der Schweiz Bezugsteuer beim Empfänger). Jahresbetreuung ab dem zweiten Jahr, jährlich kündbar.
//   · Wortgrenzen wie FIAON Global: kein „bis zu“, kein „vermitteln/beschaffen“, kein „garant…“, keine Zusage eines
//     Finanzierungserfolgs — über jede Finanzierung entscheidet allein das Institut.
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "./fiaon-firma";
import { ANGEBOT_PFLICHTHINWEIS, ANGEBOT_ANSPRECHPARTNER, type AngebotAbsatz, type AngebotZiffer } from "./fiaon-global-angebot";
import { zahlwort, monateWort } from "./fiaon-global-angebot-firma";
import type { FirmaKunde, FirmaPhase, FirmaLeistung, FirmaFrage, FirmaAnnahmeTexte, FirmaUnterschriftEingabe, ComplianceKundenfassung, FirmaSonderfreigabe } from "./fiaon-global-angebot-firma-typen";
import { portraitUrl, portraitMitKi } from "./fiaon-portraits";
import { FIRMA_BILD_NAME, firmaBildPfad } from "./fiaon-global-angebot-firma";
import { escHtml, BEGLEIT_LLC_TEXTE, type BegleitLlcWahl } from "./fiaon-global-angebot-begleit";
import { plusWerktage } from "./fiaon-wiedervorlage";

// ═══════════════════════════════════════════════════════════════════════════
// FASSUNG
// ═══════════════════════════════════════════════════════════════════════════
export const KAPITAL_FASSUNG_PRAEFIX = "IA-KAPITAL-";
// B (19.10.2026, E-400, Justin): Garantie „Finanzierung binnen acht Wochen — sonst alles zurück“, Bürgschaftsgebühr und Vergütung bei
// Auszahlung, Zeitplan in Wochen, Sonderfreigabe trotz offener Punkte im Prüfbericht, Kreditkarten dazu.
export const KAPITAL_FASSUNG = "IA-KAPITAL-2026-10-19-B";
export const KAPITAL_FASSUNGEN = ["IA-KAPITAL-2026-10-19-A", KAPITAL_FASSUNG] as const;
export function istKapitalFassung(fassung: unknown): boolean {
  return String(fassung ?? "").startsWith(KAPITAL_FASSUNG_PRAEFIX);
}
export const KAPITAL_GUELTIG_TAGE = 14;
export const KAPITAL_KNOPF = "Auftrag zahlungspflichtig erteilen";
export const KAPITAL_MARKE = "FIAON Global · Kapital für Ihr Unternehmen";
export const KAPITAL_TEIL_TITEL = "US-Gesellschaft, Experten-Team und Kapital-Begleitung";

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalBuergin {
  name: string;
  bundesstaat: string;
  anschrift: string;
  registernummer: string;
  vertreter: string;
  funktion: string;
}
export interface KapitalParameter {
  /** Festpreis (einmalig, netto) */
  preisCents: number;
  /** Jahresbetreuung ab dem zweiten Jahr (netto, je Jahr) */
  jahresCents: number;
  /** Ziel des gemeinsamen Kapitalplans in CHF und die Umrechnung in USD */
  kapitalChf: number;
  kapitalUsd: number;
  /** z. B. „1 CHF = 1,2132 USD (Mittelkurs vom 19.10.2026)“ */
  kursText: string;
  /** Höchstbetrag der Bürgschaft (CHF) und ihre längste Laufzeit (Monate) */
  buergschaftChf: number;
  buergschaftMonate: number;
  /** Dauer der Kapital-Begleitung ab Eintragung (Monate) */
  begleitMonate: number;
  /** Bundesstaat der Gründung */
  bundesstaat: string;
  /** Zahlungsziel der Rechnung über den Festpreis (Tage) */
  zahlungszielTage: number;
  /** Ansprechpartner (kuerzel aus ANGEBOT_ANSPRECHPARTNER) — der erste ist „Ihr Ansprechpartner“ */
  ansprechpartner: string[];
  /** B: Bürgschaftsgebühr (einmalig, netto) und Vergütung bei Auszahlung der Finanzierung (netto) */
  buergschaftCents: number;
  auszahlungCents: number;
  /** B: Garantie — Finanzierung binnen so vielen Wochen ab Auftragserteilung, sonst alles zurück (0 = keine Garantie) */
  garantieWochen: number;
  /** B: Business-Kreditkarten dazu — Rahmen je Karte (USD) und Herausgeber als Beispiel */
  kartenVonUsd: number;
  kartenBisUsd: number;
  kartenHerausgeber: string;
  /** B: das Team (aus der privaten Angebotsdatei — nie im Code); foto nur „haus:<kürzel>“ eines ECHTEN Porträts */
  team: { name: string; rolle: string; foto?: string | null }[];
  /** B: Sonderfreigabe der Leitung trotz offener Punkte im Prüfbericht (erscheint als Siegel an der Compliance-Bühne) */
  sonderfreigabe: FirmaSonderfreigabe | null;
  /**
   * E-417 (Kundenfragen WEiTSICHT, 22.10.2026): Konditionen der Finanzierung im Vertrag (Ziffer 4) — 0 = ohne Konditionen-Absatz.
   * Effektiver Jahreszins in Basispunkten bis zinsBasisJahre Laufzeit, Aufschlag je weiterem Laufzeitjahr, längste Laufzeit nach Wahl.
   */
  zinsBasisBp: number;
  zinsAufschlagBp: number;
  zinsBasisJahre: number;
  laufzeitMaxJahre: number;
  /** E-417: höchstens so viele Business-Kreditkarten insgesamt (Kartenleiter) — 0 = ohne Angabe. */
  kartenMax: number;
  /** E-417: Due Diligence abgeschlossen und positiv — dann kein Betreibungsauszug mehr in Ziffer 7. */
  ddAbgeschlossen: boolean;
}
export const KAPITAL_VORGABEN: KapitalParameter = {
  preisCents: 279_900,
  jahresCents: 69_900,
  kapitalChf: 50_000,
  kapitalUsd: 60_700,
  kursText: "1 CHF = 1,2132 USD (Mittelkurs vom 19.10.2026)",
  buergschaftChf: 50_000,
  buergschaftMonate: 36,
  begleitMonate: 12,
  bundesstaat: "Florida",
  zahlungszielTage: 7,
  ansprechpartner: ["justin", "daniel"],
  buergschaftCents: 49_900,
  auszahlungCents: 109_900,
  garantieWochen: 8,
  kartenVonUsd: 5_000,
  kartenBisUsd: 30_000,
  kartenHerausgeber: "Capital One oder Bank of America",
  team: [],
  sonderfreigabe: null,
  zinsBasisBp: 0,
  zinsAufschlagBp: 0,
  zinsBasisJahre: 0,
  laufzeitMaxJahre: 0,
  kartenMax: 0,
  ddAbgeschlossen: false,
};
export interface KapitalDaten {
  ref: string;
  fassung: string;
  kunde: FirmaKunde;
  buergin: KapitalBuergin;
  parameter: KapitalParameter;
  compliance: ComplianceKundenfassung | null;
  gueltigBis: string;
}
/** Was der Kunde bei der Annahme wählt — steht im Annahmevermerk, NICHT in der Prüfsumme. */
export interface KapitalWahl { llc: BegleitLlcWahl }
export interface KapitalUnterschriftVermerk { art: "gezeichnet" | "getippt"; name?: string | null; png?: string | null; am?: string; ip?: string }
export interface KapitalAnnahmeVermerk { am: Date; ip: string; userAgent: string; hash: string; wahl: KapitalWahl; unterschrift: KapitalUnterschriftVermerk }
export interface KapitalAnnahmeEingabe {
  textHash: string;
  llc: BegleitLlcWahl;
  vertretung: boolean;
  gelesen: boolean;
  unterschrift: FirmaUnterschriftEingabe;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN UND NAMEN
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalEur(cents: number): string {
  const e = Math.round(cents) / 100;
  return `${e.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(e) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}
export function kapitalChf(chf: number): string {
  return `${Math.round(chf).toLocaleString("de-CH").replace(/[’']/g, ".")} CHF`;
}
export function kapitalUsd(usd: number): string {
  return `${Math.round(usd).toLocaleString("de-DE")} USD`;
}
export function kapitalTag(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}
export function kapitalVertretungName(k: FirmaKunde): string {
  return `${String(k.vertretung.vorname ?? "").trim()} ${String(k.vertretung.nachname ?? "").trim()}`.trim();
}
export function kapitalGruss(k: FirmaKunde): string {
  const nach = String(k.vertretung.nachname || "").trim();
  return k.vertretung.anrede && nach ? `${k.vertretung.anrede} ${nach}` : kapitalVertretungName(k);
}
export function kapitalAnrede(k: FirmaKunde): string {
  const nach = String(k.vertretung.nachname || "").trim();
  if (k.vertretung.anrede === "Herr" && nach) return `Sehr geehrter Herr ${nach}`;
  if (k.vertretung.anrede === "Frau" && nach) return `Sehr geehrte Frau ${nach}`;
  return `Guten Tag ${kapitalVertretungName(k)}`;
}
const LAND_NAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
function firmaZeile(k: FirmaKunde): string {
  const f = k.firma;
  const register = [f.registergericht, f.registernummer].filter(Boolean).join(" ");
  return `${f.name}${f.rechtsform ? ` (${f.rechtsform})` : ""}, ${f.strasse}, ${f.plz} ${f.ort}, ${LAND_NAME[f.land] ?? f.land}${register ? `, eingetragen beim ${register}` : ""}${f.uid ? `, UID ${f.uid}` : ""}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG
// ═══════════════════════════════════════════════════════════════════════════
const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function kapitalVertragTitel(): string {
  return "FIAON Global — Vertrag über US-Gesellschaft, Experten-Team und Kapital-Begleitung mit Bürgschaft";
}
export function kapitalVertragUnterzeile(d: Pick<KapitalDaten, "ref" | "fassung" | "gueltigBis">): string {
  return `${KAPITAL_MARKE} · Vertragsfassung ${d.fassung} · Angebot ${d.ref} · gültig bis ${kapitalTag(d.gueltigBis)}`;
}
export function kapitalPraeambel(d: KapitalDaten): string[] {
  const par = d.parameter;
  return [
    `Die Auftraggeberin möchte für ihr Unternehmen Kapital über ${kapitalChf(par.kapitalChf)} aufnehmen und dafür eine eigene US-Gesellschaft nutzen.`,
    `FIAON gründet diese Gesellschaft, stellt der Auftraggeberin einen Steuerberater, einen Anwalt und einen Unternehmensberater zur Seite und führt sie zur Finanzierung. Die US-Partnergesellschaft von FIAON übernimmt dafür eine Bürgschaft${par.garantieWochen ? `, und FIAON steht für das Ergebnis mit einer Garantie ein: Kommt die Finanzierung nicht rechtzeitig, erhält die Auftraggeberin alles Gezahlte zurück` : ""}.`,
  ];
}
/** „1,8“ aus 180 Basispunkten. */
export function kapitalProzent(bp: number): string {
  return (bp / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 });
}
/** E-417: Hat dieses Angebot Konditionen (Zins/Laufzeit) im Vertrag? */
export function kapitalMitKonditionen(par: Pick<KapitalParameter, "zinsBasisBp" | "zinsBasisJahre" | "laufzeitMaxJahre">): boolean {
  return par.zinsBasisBp > 0 && par.zinsBasisJahre > 0 && par.laufzeitMaxJahre >= par.zinsBasisJahre;
}
/** E-417: der Konditionen-Satz — eine Quelle für Vertrag (Ziffer 4), Seite und Übersicht. */
export function kapitalKonditionenSatz(par: Pick<KapitalParameter, "zinsBasisBp" | "zinsAufschlagBp" | "zinsBasisJahre" | "laufzeitMaxJahre">): string {
  return `Laufzeit nach Wahl der Auftraggeberin, längstens ${zahlwort(par.laufzeitMaxJahre)} Jahre; effektiver Jahreszins ${kapitalProzent(par.zinsBasisBp)} % bei einer Laufzeit bis ${zahlwort(par.zinsBasisJahre)} Jahre${par.zinsAufschlagBp > 0 ? `, für jedes weitere Laufzeitjahr ${kapitalProzent(par.zinsAufschlagBp)} Prozentpunkte mehr` : ""}`;
}
/** E-417: Ausweis statt nur Reisepass — eine Quelle für Vertrag (Ziffer 7), Seite und Aufgaben. */
export const KAPITAL_AUSWEIS = "Reisepass oder Identitätskarte, noch mindestens sechs Monate gültig, mit vollständigem Namen und Geburtsdatum";
/** E-417: die Unterlagen nach Ziffer 7 als Liste — ohne Betreibungsauszug, wenn die Due Diligence abgeschlossen ist. */
export function kapitalUnterlagen(par: Pick<KapitalParameter, "ddAbgeschlossen">): string[] {
  return [
    `eine Farbkopie eines gültigen Ausweisdokuments ihres Vertreters (${KAPITAL_AUSWEIS}) und einen Adressnachweis, nicht älter als drei Monate`,
    "einen aktuellen Handelsregisterauszug",
    par.ddAbgeschlossen ? "die letzte Jahresrechnung" : "einen aktuellen Auszug aus dem Betreibungsregister und die letzte Jahresrechnung",
    "eine kurze Beschreibung der Geschäftstätigkeit der Gesellschaft",
  ];
}
const KAPITAL_PFLICHT_ZUSATZ = "Über Konto, Karten und deren Rahmen entscheidet das jeweilige Institut; für die Finanzierung gilt die Garantie nach Ziffer 4.";
export function kapitalZiffern(d: KapitalDaten): AngebotZiffer[] {
  const par = d.parameter; const b = d.buergin; const v = d.kunde.vertretung;
  const kapital = `${kapitalChf(par.kapitalChf)} (umgerechnet rund ${kapitalUsd(par.kapitalUsd)}; ${par.kursText})`;
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind die ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land} (nachfolgend „FIAON“), und die ${firmaZeile(d.kunde)}, vertreten durch ${v.anrede ? `${v.anrede} ` : ""}${kapitalVertretungName(d.kunde)}${v.funktion ? ` (${v.funktion})` : ""} (nachfolgend „Auftraggeberin“).`),
      p(`Gegenstand sind die Gründung einer US-Gesellschaft (Ziffer 2), das Experten-Team (Ziffer 3), die Kapital-Begleitung (Ziffer 4) und die Bürgschaft der US-Partnergesellschaft von FIAON (Ziffer 5). Die Gesellschaft gehört allein ihrem Gesellschafter; FIAON erwirbt an ihr keine Anteile.`),
    ] },
    { nr: 2, titel: "Gründung der US-Gesellschaft", absaetze: [
      p(`FIAON gründet eine Limited Liability Company (LLC) nach dem Recht des Bundesstaats ${par.bundesstaat}. Gesellschafter wird auf Wunsch der Auftraggeberin ihr Vertreter, ${v.anrede ? `${v.anrede} ` : ""}${kapitalVertretungName(d.kunde)}, persönlich; mit seiner Unterschrift unter diesem Vertrag erklärt er sich damit einverstanden. Empfiehlt der Steuerberater nach seiner Prüfung (Ziffer 3) eine andere Gestaltung, entscheidet die Auftraggeberin in Textform. Den Namen bestimmt die Auftraggeberin bei der Annahme (Annahmevermerk): FIAON prüft die Verfügbarkeit im Register und meldet die Gesellschaft unter dem Wunschnamen an, sonst unter dem ersten verfügbaren Ausweichnamen; ist keiner verfügbar, stimmt FIAON einen neuen Namen in Textform ab.`),
      liste([
        "Anmeldung der Gesellschaft beim Bundesstaat (Articles of Organization) einschließlich der Staatsgebühr",
        "Operating Agreement, erstellt vom Partner-Anwalt",
        "Registered Agent, US-Geschäftsadresse und US-Telefonnummer für das erste Jahr",
        "Beantragung der US-Steuernummer der Gesellschaft (EIN)",
        "Vorbereitung und Begleitung der Eröffnung eines US-Geschäftskontos",
        "die erste jährliche US-Meldung der Gesellschaft durch einen US-CPA aus dem Partnernetz von FIAON",
        "die Gründungsunterlagen in digitaler Form und ein Pflichtenkalender für das erste Jahr",
      ], "Die Gründung umfasst:"),
      p("FIAON reicht die Anmeldung binnen fünf Werktagen ein, nachdem die Vergütung nach Ziffer 6 Absatz 1 eingegangen ist und die Unterlagen nach Ziffer 7 vorliegen."),
    ] },
    { nr: 3, titel: "Das Experten-Team", absaetze: [
      liste([
        "Steuerberater: Prüfung der Struktur vor der Gründung — Besteuerung der Gesellschaft in den USA und der Beteiligung im Sitzstaat der Auftraggeberin, das Doppelbesteuerungsabkommen und die Meldepflichten — mit einer schriftlichen Zusammenfassung",
        "Anwalt: Operating Agreement der Gesellschaft und Durchsicht der Finanzierungsverträge, bevor die Gesellschaft oder die Auftraggeberin sie unterschreibt",
        "Unternehmensberater: Kapitalplan, Plan für die Verwendung der Mittel, Aufbereitung der Unterlagen für die Institute und Vorbereitung der Gespräche mit ihnen",
      ], "Der Auftraggeberin stehen für die Dauer der Kapital-Begleitung zur Seite:"),
      p("Steuerliche und rechtliche Leistungen erbringen Steuerberater, US-CPA und Anwälte aus dem Partnernetz von FIAON auf eigenes Mandat der Auftraggeberin bzw. der Gesellschaft. Die Honorare dieser Partner für die hier genannten Leistungen trägt FIAON; sie sind in der Vergütung enthalten. Leistungen darüber hinaus vereinbart die Auftraggeberin unmittelbar mit dem Partner."),
    ] },
    { nr: 4, titel: par.garantieWochen ? "Finanzierung und Garantie" : "Kapital-Begleitung", absaetze: [
      p(`FIAON führt die Auftraggeberin bzw. die Gesellschaft zu einer Finanzierung über ${kapital}: Auswahl geeigneter Institute und Produkte, vollständige Vorbereitung jedes Antrags, Begleitung bei Rückfragen bis zur Auszahlung, ein fester Ansprechpartner — und danach ${monateWort(par.begleitMonate)} lang ab der Eintragung bei jedem weiteren Schritt. Anträge stellen die Auftraggeberin bzw. die Gesellschaft im eigenen Namen; ob sie ein Angebot annehmen, entscheiden sie allein.`),
      p(`Zusätzlich beantragt FIAON für die Gesellschaft Business-Kreditkarten bei US-Herausgebern wie ${par.kartenHerausgeber}. Die Rahmen liegen je Karte erfahrungsgemäß zwischen ${kapitalUsd(par.kartenVonUsd)} und ${kapitalUsd(par.kartenBisUsd)} und kommen zur Finanzierung hinzu; über Karten und Rahmen entscheidet der jeweilige Herausgeber.${par.kartenMax > 0 ? ` Auf Wunsch beantragt FIAON jederzeit weitere Karten, insgesamt höchstens ${zahlwort(par.kartenMax)}.` : ""}`),
      ...(kapitalMitKonditionen(par) ? [p(`Für die Finanzierung gelten folgende Bedingungen: ${kapitalKonditionenSatz(par)}.`)] : []),
      ...(par.garantieWochen ? [
        p(`FIAON garantiert der Auftraggeberin, dass ihr oder der Gesellschaft binnen ${zahlwort(par.garantieWochen)} Wochen ab Auftragserteilung eine Finanzierung über ${kapitalChf(par.kapitalChf)} eingeräumt und ausgezahlt wird. Andernfalls erstattet FIAON der Auftraggeberin alles, was sie bis dahin an FIAON gezahlt hat (Ziffer 6 Absatz 1 und 2), binnen vierzehn Tagen nach Fristende; die Vergütung nach Ziffer 6 Absatz 3 entfällt, und die Gesellschaft bleibt der Auftraggeberin. Für die Kreditkarten nach Absatz 2 gilt die Garantie nicht.`),
        p(`Die Frist ruht, solange die Vergütung nach Ziffer 6 Absatz 1 nicht gezahlt ist, solange Unterlagen nach Ziffer 7 ausstehen und solange die Auftraggeberin ein ihr vorgelegtes Finanzierungsangebot über den Betrag zu ${kapitalMitKonditionen(par) ? "den Bedingungen nach Absatz 3" : "marktüblichen Bedingungen"} nicht annimmt. Die Garantie entfällt, wenn die Auftraggeberin vorsätzlich falsche Angaben macht.`),
      ] : [p(`Über jede Finanzierung, ihren Betrag und ihre Bedingungen entscheidet das jeweilige Institut; der Betrag von ${kapitalChf(par.kapitalChf)} ist der gemeinsame Plan der Parteien.`)]),
    ] },
    { nr: 5, titel: "Bürgschaft der US-Partnergesellschaft", absaetze: [
      p(`Die ${b.name}, ${b.anschrift}, eingetragen im Bundesstaat ${b.bundesstaat} unter ${b.registernummer} (nachfolgend „Bürgin“), übernimmt auf Anforderung eines Instituts eine Bürgschaft für eine Finanzierung, die der Gesellschaft oder der Auftraggeberin in der Kapital-Begleitung eingeräumt wird. Höchstbetrag ist ${kapitalChf(par.buergschaftChf)}; die Bürgschaft lautet auf die Währung der Finanzierung und läuft längstens ${zahlwort(par.buergschaftMonate)} Monate. Die Bürgin ist ein mit FIAON verbundenes Unternehmen und tritt diesem Vertrag für Ziffer 5 bei.`),
      p(`FIAON hat den Prüfbericht (Anlage) mit seinen offenen Punkten zur Kenntnis genommen und die Bürgschaft gleichwohl freigegeben${par.sonderfreigabe?.datum ? ` (Sonderfreigabe vom ${kapitalTag(par.sonderfreigabe.datum)})` : ""}; die offenen Punkte stehen der Übernahme nicht entgegen.`),
      liste([
        "die Vergütung nach Ziffer 6 Absatz 1 ist bezahlt",
        "die Identifizierung des Vertreters der Auftraggeberin und der wirtschaftlich Berechtigten ist abgeschlossen, und die Unterlagen nach Ziffer 7 liegen vor",
        "die Finanzierung dient dem Plan für die Verwendung der Mittel, den die Auftraggeberin mit dem Unternehmensberater aufgestellt hat",
        "die Bürgin ist zum Zeitpunkt der Übernahme im Register ihres Bundesstaats als aktiv geführt",
      ], "Die Bürgin übernimmt die Bürgschaft, sobald Folgendes vorliegt:"),
      p("Sicherheiten verlangen FIAON und die Bürgin nicht. Die Vergütung für die Bürgschaft regelt Ziffer 6 Absatz 2. Die Form der Bürgschaft stimmt die Bürgin mit dem Institut ab."),
      p("Nimmt ein Institut die Bürgin in Anspruch, ersetzen die Gesellschaft und die Auftraggeberin der Bürgin als Gesamtschuldner den gezahlten Betrag mit den Kosten der Inanspruchnahme (Rückgriff). Solange die Bürgschaft besteht, teilt die Auftraggeberin FIAON einmal im Quartal den Stand der Finanzierung und der Rückzahlungen in Textform mit."),
    ] },
    { nr: 6, titel: "Vergütung und Fälligkeit", absaetze: [
      p(`Die Vergütung für die Leistungen nach Ziffer 2 bis 4 im ersten Jahr beträgt einmalig ${kapitalEur(par.preisCents)}. Sie ist mit Vertragsschluss fällig. FIAON stellt die Rechnung bei Annahme dieses Vertrags; sie ist binnen ${zahlwort(par.zahlungszielTage)} Tagen ohne Abzug per Überweisung zu zahlen. FIAON beginnt mit dem Zahlungseingang.`),
      p(`Für die Bürgschaft (Ziffer 5) zahlt die Auftraggeberin einmalig ${kapitalEur(par.buergschaftCents)} (Bürgschaftsgebühr), fällig sobald die Bürgin die Bürgschaft gegenüber dem Institut zusagt; FIAON berechnet sie mit Rechnung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen.`),
      p(`Mit der Auszahlung der Finanzierung wird einmalig ${kapitalEur(par.auszahlungCents)} fällig; FIAON berechnet sie mit Rechnung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen, und die Auftraggeberin kann sie aus den ausgezahlten Mitteln zahlen.`),
      p(`Ab dem zweiten Jahr nach der Eintragung betreut FIAON die Gesellschaft für ${kapitalEur(par.jahresCents)} je Jahr (Jahresbetreuung): Registered Agent und US-Geschäftsadresse, US-Telefonnummer, die jährliche US-Meldung durch einen US-CPA aus dem Partnernetz von FIAON, die Jahresmeldung beim Bundesstaat einschließlich der Staatsgebühr, der Pflichtenkalender sowie die laufende Begleitung der Gesellschaft durch Steuerberater und Anwalt aus Ziffer 3. Die Jahresbetreuung wird jährlich im Voraus berechnet, jeweils zum Jahrestag der Eintragung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen. Die Auftraggeberin kann sie mit einer Frist von einem Monat zum Ende eines Betreuungsjahres in Textform beenden. Weitere Finanzierungen über den Plan nach Ziffer 4 hinaus vereinbaren die Parteien gesondert.`),
      p("Alle Beträge sind Nettobeträge. Die Leistungen erbringt FIAON aus dem Vereinigten Königreich an ein Unternehmen; die Rechnungen weisen deshalb keine Umsatzsteuer aus. Eine Steuer, die im Sitzstaat der Auftraggeberin auf den Bezug anfällt (in der Schweiz die Bezugsteuer), trägt die Auftraggeberin."),
    ] },
    { nr: 7, titel: "Mitwirkung der Auftraggeberin", absaetze: [
      liste(kapitalUnterlagen(par), "Die Auftraggeberin stellt FIAON binnen vierzehn Tagen nach der Annahme bereit:"),
      p("Die Auftraggeberin macht wahre und vollständige Angaben, unterschreibt die vorbereiteten Unterlagen nach Prüfung und teilt Änderungen, die für die Gesellschaft, die Finanzierung oder die Bürgschaft erheblich sind, unverzüglich in Textform mit."),
    ] },
    { nr: 8, titel: "Pflichthinweise", absaetze: [
      liste([...ANGEBOT_PFLICHTHINWEIS, KAPITAL_PFLICHT_ZUSATZ], "Die Auftraggeberin nimmt die folgenden Hinweise zur Kenntnis:"),
      p("FIAON reicht keine Unterlagen ein, deren Angaben es für unzutreffend hält. Vor Beginn gleicht FIAON die Auftraggeberin, ihren Vertreter und die wirtschaftlich Berechtigten mit den Sanktionslisten der Europäischen Union, der Vereinten Nationen, der Schweiz, des Vereinigten Königreichs und der USA ab."),
    ] },
    { nr: 9, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme. Die Kapital-Begleitung endet ${monateWort(par.begleitMonate)} nach der Eintragung der Gesellschaft; die Bürgschaft endet nach Ziffer 5, die Jahresbetreuung nach Ziffer 6 Absatz 4.`),
      p("Das Recht beider Parteien zur fristlosen Kündigung aus wichtigem Grund bleibt unberührt, insbesondere wenn die Auftraggeberin vorsätzlich falsche Angaben macht oder sie, ihr Vertreter oder ein wirtschaftlich Berechtigter auf einer Sanktionsliste geführt wird. Eine bereits übernommene Bürgschaft bleibt davon unberührt; der Rückgriff nach Ziffer 5 Absatz 5 gilt fort."),
    ] },
    { nr: 10, titel: "Haftung", absaetze: [
      p("FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Entscheidungen von Behörden haftet FIAON nicht; für das Ergebnis der Finanzierung gilt allein die Garantie nach Ziffer 4; für die Leistungen der Partner haften diese aus ihrem eigenen Mandat."),
    ] },
    { nr: 11, titel: "Vertraulichkeit und Datenschutz", absaetze: [
      p("Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags. FIAON gibt Unterlagen nur weiter, soweit es die Leistung erfordert: an Behörden, an den Registered Agent, an die Partner aus Ziffer 3, an die Bürgin und an Institute, bei denen ein Antrag gestellt wird."),
      p("FIAON verarbeitet personenbezogene Daten, um diesen Vertrag zu erfüllen, nach der Datenschutzerklärung unter fiaon.com/datenschutz, im Einklang mit der DSGVO und dem Schweizer Datenschutzgesetz. Für Gründung und Anträge gehen Daten in die USA; die Übermittlung stützt sich darauf, dass sie für die Erfüllung dieses Vertrags erforderlich ist."),
    ] },
    { nr: 12, titel: "Schlussbestimmungen", absaetze: [
      p("Dieser Vertrag ist ein Geschäft unter Unternehmern; ein Widerrufsrecht für Verbraucher besteht nicht. Allgemeine Geschäftsbedingungen einer Partei gelten nicht. Beigefügt ist die Anlage (Prüfbericht)."),
      p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts; es gelten die gesetzlichen Gerichtsstände. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
    ] },
  ];
}

// ── HTML des Vertrags ───────────────────────────────────────────────────────
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
function annahmeBlock(d: KapitalDaten, a: KapitalAnnahmeVermerk | null): string {
  const name = kapitalVertretungName(d.kunde);
  const fiaon = `<div class="sig-col"><div class="gv-sig-kopf">Für FIAON</div><div class="gv-sig-feld"><span class="gv-leise">Angebot der ${escHtml(FIAON_FIRMA.name)}, vertreten durch ${escHtml(FIAON_FIRMA.director)}, Director</span></div><div class="sig-line">${escHtml(FIAON_FIRMA.name)}</div></div>`;
  const buergin = `<div class="sig-col"><div class="gv-sig-kopf">Für die Bürgin (Ziffer 5)</div><div class="gv-sig-feld"><span class="gv-leise">Beitritt der ${escHtml(d.buergin.name)}, vertreten durch ${escHtml(d.buergin.vertreter)}, ${escHtml(d.buergin.funktion)}</span></div><div class="sig-line">${escHtml(d.buergin.name)}</div></div>`;
  if (!a) {
    return `
  <div class="gv-unterschriften">
    ${fiaon}
    ${buergin}
    <div class="sig-col"><div class="gv-sig-kopf">Für die Auftraggeberin</div><div class="gv-sig-feld"><span class="gv-leise">Annahme mit dem Knopf „${escHtml(KAPITAL_KNOPF)}“ — der Name der Gesellschaft steht dann hier im Annahmevermerk.</span></div><div class="sig-line">${escHtml(d.kunde.firma.name)}, vertreten durch ${escHtml(name)}</div></div>
  </div>`;
  }
  const w = a.wahl;
  const namen = [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean);
  return `
  <div class="gv-unterschriften">
    ${fiaon}
    ${buergin}
    <div class="sig-col"><div class="gv-sig-kopf">Für die Auftraggeberin</div><div class="gv-sig-feld">${unterschriftHtml(a.unterschrift)}</div><div class="sig-line">${escHtml(d.kunde.firma.name)}, vertreten durch ${escHtml(name)}, ${escHtml(d.kunde.firma.ort)}, ${escHtml(a.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}</div></div>
  </div>
  <div class="gv-annahme">
    <h3>Annahmevermerk</h3>
    <p>Angenommen am ${escHtml(zeitText(a.am))} mit dem Knopf „${escHtml(KAPITAL_KNOPF)}“. Der Vertreter hat bestätigt, die Auftraggeberin vertreten zu dürfen.</p>
    <ul>
      <li>Name der Gesellschaft (Ziffer 2): Wunschname <strong>${escHtml(w.llc.wunsch)}</strong>${namen.length > 1 ? `; Ausweichnamen in dieser Reihenfolge: ${namen.slice(1).map(escHtml).join("; ")}` : "; keine Ausweichnamen"}</li>
    </ul>
    <p class="gv-leise">IP-Adresse ${escHtml(a.ip)} · Prüfsumme des Vertragstextes (SHA-256): <span class="hash">${escHtml(a.hash)}</span></p>
  </div>`;
}
/** Der Rumpf: Präambel, zwölf Ziffern, Annahmeblock. Die Prüfsumme läuft über den Rumpf OHNE Vermerk. */
export function kapitalRumpfHtml(d: KapitalDaten, annahme: KapitalAnnahmeVermerk | null = null): string {
  const ziffern = ziffernHtml(kapitalZiffern(d)).split("\n");
  const letzte = ziffern.pop() ?? "";
  return `<div class="gv" lang="de"><section class="gia-praeambel" id="praeambel"><h2>Präambel</h2>${kapitalPraeambel(d).map((x) => `<p>${escHtml(x)}</p>`).join("")}</section>
${ziffern.join("\n")}
<div class="gv-schluss">${letzte}${annahmeBlock(d, annahme)}</div></div>`;
}
export function kapitalHashEingabe(d: Pick<KapitalDaten, "ref" | "fassung">, rumpfOhneAnnahme: string, compliance: ComplianceKundenfassung | null): string {
  // Der Prüfbericht ist Anlage des Vertrags — sein Ergebnis zählt mit (Gesamtampel, Auflagen, Prüfdatum).
  const anlage = compliance ? JSON.stringify({ ampel: compliance.gesamt.ampel, auflagen: compliance.gesamt.auflagen, pruefdatum: compliance.meta.pruefdatum }) : "ohne-anlage";
  return `global-angebot-kapital|${d.ref}|${d.fassung}|${anlage}|${rumpfOhneAnnahme}`;
}
export function kapitalVertragInhalt(d: KapitalDaten): { anker: string; marke: string; titel: string }[] {
  return [
    { anker: "praeambel", marke: "", titel: "Präambel" },
    ...kapitalZiffern(d).map((z) => ({ anker: `ziffer-${z.nr}`, marke: String(z.nr), titel: z.titel })),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  hero: { auge: string; titel: string; lead: string; nutzen: string[]; betrag: string; umrechnung: string; kurs: string; siegel: string; staat: string;
    saeulen: { titel: string; wert: string }[]; garantie: string };
  llc: typeof BEGLEIT_LLC_TEXTE;
  ablauf: { titel: string; sub: string; liste: FirmaPhase[] };
  team: { titel: string; sub: string; karten: FirmaLeistung[] };
  buergschaft: { auge: string; titel: string; lead: string; betrag: string; freigabe: string; punkte: { titel: string; text: string }[]; bedingungenTitel: string; bedingungen: string[]; fein: string };
  pruefbericht: { titel: string; sub: string; download: string; hinweis: string };
  sonderfreigabe: FirmaSonderfreigabe | null;
  investition: { titel: string; sub: string; heuteAuge: string; preis: string; preisZeile: string; spaeterTitel: string; posten: { wann: string; betrag: string; titel: string; text: string }[]; jahr: string; inklusive: string[]; garantie: string; fein: string };
  fragen: { titel: string; sub: string; liste: FirmaFrage[]; sichtbar: number };
  ansprechpartner: { titel: string; sub: string; teamTitel: string; teamSub: string; team: { name: string; rolle: string; foto: string | null; initialen: string }[] };
  vertrag: { titel: string; sub: string; dokument: string; unterzeile: string; inhalt: { anker: string; marke: string; titel: string }[] };
  pflicht: string[];
  bildnachweis: string;
}
function initialen(name: string): string {
  return name.replace(/^(Dr\.|Mag\.|Prof\.)\s+/g, "").split(/\s+/).filter(Boolean).map((t) => t[0]).join("").slice(0, 2).toUpperCase();
}
/**
 * Das Team aus den Angebotsdaten (wie E-301): „haus:<kürzel>“ = echtes Porträt des Hauses; ein Bildname („team-x.webp“) = Foto am
 * Angebot, ausgeliefert NUR hinter dem Link (token nötig, sonst Monogramm). Bildnamen-Fotos sind teils Symbolbilder — die Seite
 * nennt das im Bildnachweis (kapitalBildnachweis).
 */
export function kapitalTeam(par: KapitalParameter, token?: string): { name: string; rolle: string; foto: string | null; initialen: string }[] {
  return par.team.map((t) => {
    const f = String(t.foto ?? "");
    const k = f.startsWith("haus:") ? f.slice(5) : "";
    const foto = k ? (/^[a-z][a-z0-9-]{1,30}$/.test(k) && !portraitMitKi(k) ? portraitUrl(k) : null)
      : FIRMA_BILD_NAME.test(f) && token ? firmaBildPfad(token, f) : null;
    return { name: t.name, rolle: t.rolle, foto, initialen: initialen(t.name) };
  });
}
export function kapitalBildnachweis(par: KapitalParameter): string {
  return par.team.some((t) => FIRMA_BILD_NAME.test(String(t.foto ?? ""))) ? "Bildnachweis: Teamfotos teils Symbolbilder." : "";
}
export function kapitalSeite(d: KapitalDaten, token?: string): KapitalSeite {
  const par = d.parameter; const k = d.kunde;
  const betrag = kapitalChf(par.kapitalChf);
  const karten = `${kapitalUsd(par.kartenVonUsd)} bis ${kapitalUsd(par.kartenBisUsd)}`;
  const garantie = par.garantieWochen > 0;
  return {
    auftakt: {
      auge: "FIAON Global · Persönlich für Sie",
      gruss: `Willkommen, ${kapitalGruss(k)}.`,
      zeile: `${betrag} für ${k.firma.marke || k.firma.name} — mit eigener US-Gesellschaft und einem Team an Ihrer Seite.`,
      weiter: "Weiter",
    },
    hero: {
      auge: k.firma.marke || k.firma.name,
      titel: "Ihre US-Gesellschaft. Ihr Kapital. Ein Team, das den Weg kennt.",
      lead: `Wir gründen Ihre LLC in ${par.bundesstaat}, stellen Ihnen Steuerberater, Anwalt und Unternehmensberater zur Seite und bereiten jeden Antrag vollständig vor. Und damit Ihre Finanzierung ${garantie ? "garantiert " : ""}über die Bühne geht, bürgen wir mit unserer US-Partnergesellschaft für Sie.`,
      nutzen: ["Ihre US-Gesellschaft — in der ersten Woche", "Steuerberater, Anwalt und Unternehmensberater inklusive", "Auszahlung in Woche vier bis fünf — mit unserer Bürgschaft"],
      betrag,
      umrechnung: `≈ ${kapitalUsd(par.kapitalUsd)}`,
      kurs: par.kursText,
      siegel: "Ihr Funding",
      staat: par.bundesstaat,
      saeulen: [
        { titel: "Auszahlung", wert: "in Woche vier bis fünf" },
        { titel: "Bürgschaft", wert: kapitalChf(par.buergschaftChf) },
        { titel: "Dazu Kreditkarten", wert: `je ${kapitalUsd(par.kartenVonUsd)}–${kapitalUsd(par.kartenBisUsd).replace(" USD", "")} USD` },
      ],
      garantie: garantie ? "Mit Geld-zurück-Garantie im Vertrag" : "",
    },
    llc: BEGLEIT_LLC_TEXTE,
    ablauf: {
      titel: "Ihr Weg",
      sub: `In fünf Wochen zu ${betrag} für Ihr Unternehmen.`,
      liste: [
        { nr: 1, titel: "Ihre LLC entsteht", dauer: "Woche eins", text: `Anmeldung in ${par.bundesstaat} unter Ihrem Wunschnamen — Registered Agent, US-Adresse und Telefon inklusive.` },
        { nr: 2, titel: "Alle Dokumente", dauer: "Woche zwei", text: "Operating Agreement vom Anwalt, Steuernummer (EIN), Prüfung der Struktur durch den Steuerberater und Ihr Kapitalplan mit dem Unternehmensberater." },
        { nr: 3, titel: "Firmenkonto und Kreditkarten", dauer: "Woche drei", text: `Ihr US-Geschäftskonto — dazu Business-Kreditkarten von Herausgebern wie ${par.kartenHerausgeber}, mit Rahmen von ${karten} je Karte, zusätzlich zu Ihrer Finanzierung.` },
        { nr: 4, titel: "Finanzierung und Auszahlung", dauer: "Woche vier bis fünf", text: `Antrag mit unserer Bürgschaft über ${kapitalChf(par.buergschaftChf)} im Rücken — der Anwalt sieht den Vertrag, bevor Sie unterschreiben. Dann wird ausgezahlt.`, abzeichen: betrag },
      ],
    },
    team: {
      titel: "Ihr Experten-Team",
      sub: "Drei Fachleute, ein Ansprechpartner — alle Honorare sind im Preis enthalten.",
      karten: [
        { schluessel: "strategie", titel: "Steuerberater", text: "Damit Ihre Struktur in den USA und in der Schweiz sauber ist.", punkte: ["Prüfung vor der Gründung", "Doppelbesteuerung und Meldepflichten", "Schriftliche Zusammenfassung"], mehr: ["Erste US-Jahresmeldung durch einen US-CPA"] },
        { schluessel: "gesellschaft", titel: "Anwalt", text: "Damit jedes Dokument hält, was es verspricht.", punkte: ["Operating Agreement Ihrer LLC", "Durchsicht des Finanzierungsvertrags", "Vor jeder Unterschrift"] },
        { schluessel: "kapital", titel: "Unternehmensberater", text: "Damit Ihr Antrag überzeugt — und die Mittel wirken.", punkte: ["Kapitalplan und Mittelverwendung", "Unterlagen für das Institut", "Vorbereitung der Gespräche"] },
      ],
    },
    buergschaft: {
      auge: "Die Bürgschaft",
      titel: "Wir stehen mit Ihnen ein.",
      lead: `Unsere US-Partnergesellschaft bürgt gegenüber dem Institut für Ihre Finanzierung — damit die ${betrag} schnell und sicher auf Ihrem Konto ankommen.`,
      betrag: kapitalChf(par.buergschaftChf),
      freigabe: par.sonderfreigabe ? `Persönlich freigegeben von ${par.sonderfreigabe.unterzeichner}` : "",
      punkte: [
        { titel: "Höchstbetrag", text: `${kapitalChf(par.buergschaftChf)} in der Währung Ihrer Finanzierung — kein Kursrisiko.` },
        { titel: "Ohne Sicherheiten", text: "Keine Sicherheiten, keine laufende Gebühr — wir stehen für Sie ein." },
        { titel: "Klare Laufzeit", text: `Die Bürgschaft läuft längstens ${zahlwort(par.buergschaftMonate)} Monate. Die Laufzeit Ihrer Finanzierung wählen Sie selbst${par.laufzeitMaxJahre > 0 ? ` — bis ${zahlwort(par.laufzeitMaxJahre)} Jahre` : ""}.` },
      ],
      bedingungenTitel: "So einfach geht es",
      bedingungen: [
        "Ihre erste Rechnung ist bezahlt",
        "Ausweis und Unterlagen liegen vor",
        "Ihr Plan für die Mittel steht",
        "wir sagen die Bürgschaft dem Institut zu",
      ],
      fein: "Zahlt die Bürgin an das Institut, ersetzen Gesellschaft und Auftraggeberin ihr den Betrag — so ist es bei jeder Bürgschaft, und so steht es offen im Vertrag (Ziffer 5).",
    },
    pruefbericht: {
      titel: "Ihre Compliance-Prüfung",
      sub: "Bevor wir bürgen, prüfen wir jedes Unternehmen aus öffentlichen Quellen. Ihr Bericht zeigt offene Punkte — Herr Schwarzott hat dennoch zugestimmt, denn die Finanzierung ist im Verhältnis zu Ihrem Geschäft klein und Ihr Plan überzeugt.",
      download: "Prüfbericht als PDF",
      hinweis: "Der Prüfbericht ist Anlage Ihres Vertrags. Die offenen Punkte reichen Sie mit Ihren Unterlagen nach — sie stehen Ihrer Bürgschaft nicht im Weg.",
    },
    sonderfreigabe: par.sonderfreigabe,
    investition: {
      titel: "Ihre Investition",
      // E-404 (Justin): auf der Seite NUR die Gründungskosten — Bürgschaftsgebühr, Vergütung bei Auszahlung und Jahresbetreuung
      // stehen im Vertrag (Ziffer 6) und in der Übersicht direkt über dem Knopf.
      sub: "Ein Betrag für Ihren Start — alles für die ersten zwölf Monate inklusive.",
      heuteAuge: "Gründungskosten",
      preis: kapitalEur(par.preisCents),
      preisZeile: "inkl. aller Kosten für 12 Monate",
      spaeterTitel: "",
      posten: [],
      jahr: "",
      inklusive: [
        "Gründung Ihrer LLC mit Staatsgebühr und Operating Agreement",
        "Registered Agent, US-Adresse und Telefon im ersten Jahr",
        "Steuernummer (EIN), US-Geschäftskonto und Kreditkarten-Anträge",
        "Steuerberater, Anwalt und Unternehmensberater",
        "Begleitung bis zur Auszahlung und das ganze erste Jahr",
        "ein fester Ansprechpartner",
      ],
      garantie: garantie ? `Kommt Ihre Finanzierung nicht binnen ${zahlwort(par.garantieWochen)} Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben.` : "",
      fein: "Alle Beträge netto, Rechnung ohne Umsatzsteuer (Leistung aus London an Ihr Unternehmen; in der Schweiz Bezugsteuer). Überweisung, keine Lastschrift.",
    },
    fragen: {
      titel: "Fragen & Antworten",
      sub: "Kurz und ehrlich — so, wie unsere Kunden sie uns stellen.",
      sichtbar: 8,
      // E-417 (22.10.2026): die Fragen eines echten Kunden, mit den Antworten der Leitung — dieselben Aussagen wie Vertrag und Mail.
      liste: [
        { frage: `Bekomme ich die ${betrag} sicher?`, antwort: [garantie
          ? `Ja. Wir sind uns so sicher, dass es als Garantie in Ihrem Vertrag steht: Kommt Ihre Finanzierung nicht binnen ${zahlwort(par.garantieWochen)} Wochen, erhalten Sie alles zurück, was Sie an uns gezahlt haben.`
          : "Wir bereiten Ihren Antrag vollständig vor und stehen mit unserer Bürgschaft ein."] },
        { frage: "Wann ist das Geld auf meinem Konto?", antwort: ["Unser Plan: Woche eins die LLC, Woche zwei alle Dokumente, Woche drei Konto und Kreditkarten, Woche vier bis fünf Finanzierung und Auszahlung."] },
        { frage: "Muss ich dafür in die USA reisen?", antwort: ["Nein. Bei Finanzierungen unter einer Million erledigt unser Team vor Ort alles für Sie — Sie steuern jeden Schritt bequem von zu Hause. Auf Ihre Reisen hat die LLC keinen Einfluss."] },
        { frage: "Was ist eine LLC — und wem gehört sie?", antwort: ["Eine Limited Liability Company ist das amerikanische Gegenstück zur GmbH: eine eigene Gesellschaft mit beschränkter Haftung, schnell gegründet, günstig im Unterhalt und international anerkannt.", "Sie gehört Ihnen persönlich: Wir gründen die LLC auf Ihren Namen, den Vertrag schließen wir mit Ihrem Unternehmen. FIAON erwirbt keine Anteile."] },
        { frage: "Welche Haftung übernehme ich persönlich?", antwort: ["Keine. Kreditnehmerin ist Ihre LLC, und sie haftet nur mit ihrem eigenen Vermögen. Solange über die LLC nur die Finanzierung läuft und kein operatives Geschäft, entstehen keine weiteren Pflichten. Wie es wäre, wenn wir als Bürge einmal zahlen müssten, regelt Ziffer 5."] },
        { frage: "Was passiert, wenn ich zahlungsunfähig werde?", antwort: ["Mit der Finanzierung wird automatisch eine Risiko-Lebensversicherung abgeschlossen. Und sollte trotzdem einmal etwas schiefgehen, stehen wir als Bürge gegenüber dem Institut ein und melden unsere Forderung danach im Verfahren an — wie jeder andere Gläubiger auch."] },
        ...(kapitalMitKonditionen(par) ? [
          { frage: "Welchen Zins hat das Darlehen?", antwort: [`Effektiv ${kapitalProzent(par.zinsBasisBp)} % im Jahr bei einer Laufzeit bis ${zahlwort(par.zinsBasisJahre)} Jahre${par.zinsAufschlagBp > 0 ? `; für jedes weitere Laufzeitjahr kommen ${kapitalProzent(par.zinsAufschlagBp)} Prozentpunkte dazu` : ""}. So steht es in Ziffer 4 Ihres Vertrags.`] },
          { frage: "Bis wann muss ich zurückzahlen?", antwort: [`Die Laufzeit wählen Sie selbst — bis ${zahlwort(par.laufzeitMaxJahre)} Jahre. Die ${zahlwort(par.begleitMonate)} Monate im Vertrag sind unsere aktive Begleitung ab der Gründung, die ${zahlwort(par.buergschaftMonate)} Monate die längste Laufzeit der Bürgschaft.`] },
        ] : []),
        { frage: "Brauche ich Sicherheiten für die Bürgschaft?", antwort: ["Nein. Nur wenn das Institut die Bürgin tatsächlich in Anspruch nimmt, ersetzen Sie ihr den Betrag — wie bei jeder Bürgschaft. Alle Einzelheiten stehen in Ziffer 5 und 6 Ihres Vertrags."] },
        { frage: "Wie funktionieren die Kreditkarten?", antwort: [
          `Die Business-Kreditkarten lauten auf Ihre LLC — von Herausgebern wie ${par.kartenHerausgeber}, also Visa, Mastercard oder American Express, mit Rahmen von ${karten} je Karte, zusätzlich zu Ihrer Finanzierung.`,
          "Abgerechnet wird einmal im Monat. Zahlen Sie den Saldo bis zum Fälligkeitstag vollständig, fallen keine Zinsen an — am einfachsten per automatischer Abbuchung vom Geschäftskonto Ihrer LLC.",
          "Zusätzlich richten wir ein privates US-Konto für Sie ein; darüber sind auf Wunsch auch private Karten möglich. Viele Kunden nutzen das gern, weil die Punkte- und Meilenprogramme in den USA besonders großzügig sind."] },
        { frage: "Was heißt „Kartenleiter“?", antwort: [`In Ihrem Paket sind die klassischen Herausgeber enthalten. Für kurzfristigen Cashflow können Sie später jederzeit weitere Karten dazunehmen${par.kartenMax > 0 ? ` — insgesamt höchstens ${zahlwort(par.kartenMax)}` : ""}.`] },
        { frage: "Was kostet das insgesamt?", antwort: [
          `${kapitalEur(par.preisCents)} Gründungskosten — inklusive aller Kosten für die ersten zwölf Monate.`,
          ...(par.buergschaftCents > 0 ? [`${kapitalEur(par.buergschaftCents)} erst, wenn die Bürgschaft für Ihre Finanzierung gestellt wird — damit sind die Notarkosten der Bürgschaft gedeckt.`] : []),
          ...(par.auszahlungCents > 0 ? [`${kapitalEur(par.auszahlungCents)} mit der Auszahlung Ihrer Finanzierung, per Rechnung mit ${zahlwort(par.zahlungszielTage)} Tagen Zahlungsziel.`] : []),
          ...(par.jahresCents > 0 ? [`Ab dem zweiten Jahr ${kapitalEur(par.jahresCents)} im Jahr für die gesamte Betreuung: Registered Agent, US-Adresse und Telefon, Staatsgebühr, Jahresmeldungen, steuerliche und anwaltliche Begleitung. Sie können sie jedes Jahr mit einem Monat Frist beenden.`] : []),
          "Mehr nicht. Nur wenn Sie später eine weitere Finanzierung möchten, vereinbaren wir dafür gesondert eine Vergütung von 1,5 bis 3 % der Summe — fällig erst, wenn das Geld da ist."] },
        { frage: "Muss die LLC in der Schweiz eingetragen werden?", antwort: ["Nein. Die LLC ist eine eigenständige US-Gesellschaft ohne Niederlassung in der Schweiz — kein Handelsregister, keine Schweizer Gebühren. Ihre Beteiligung geben Sie in Ihrer Steuererklärung an; das übernimmt unser Steuerberater mit Ihnen."] },
        { frage: "Welche Meldungen muss ich in der Schweiz machen?", antwort: ["Im Kern eine: Ihre Beteiligung an der LLC gehört ins Wertschriftenverzeichnis Ihrer Steuererklärung. Gibt die LLC Geld an Ihre Firma weiter, wird das dort sauber gebucht, zum Beispiel als Darlehen. Die US-Meldungen erledigt unser US-CPA.", "Unser Steuerberater prüft die ganze Struktur vor der Gründung — einschließlich Doppelbesteuerungsabkommen — und gibt Ihnen das Ergebnis schriftlich. Das ist inklusive."] },
        { frage: "Muss ich Geld aus den USA besonders deklarieren?", antwort: ["Für jede Finanzierung gibt es einen Finanzierungsvertrag — er belegt die Herkunft des Geldes vollständig. Damit können Sie es problemlos in die Schweiz oder die EU überweisen; das dauert erfahrungsgemäß drei bis fünf Werktage."] },
        { frage: "Kann ein Teil des Geldes in den USA bleiben?", antwort: ["Ja. Wie viel Sie wann wohin überweisen, entscheiden Sie. Nur in Länder unter Sanktionen, etwa Russland, sind Zahlungen kaum möglich — nach Deutschland, Österreich oder in die Schweiz problemlos. Wie Sie das steuerlich am besten gestalten, bespricht unser Steuerberater mit Ihnen."] },
        { frage: "Was ist die Bezugsteuer?", antwort: ["So heißt in der Schweiz die Mehrwertsteuer auf Leistungen aus dem Ausland. Wir rechnen aus London ohne Mehrwertsteuer ab. Ist Ihre Firma mehrwertsteuerpflichtig, deklarieren Sie 8,1 % auf unseren Rechnungsbetrag und ziehen denselben Betrag in derselben Abrechnung als Vorsteuer wieder ab — unter dem Strich in aller Regel null. Ist sie es nicht, fällt die Bezugsteuer erst an, wenn Sie im Jahr Leistungen aus dem Ausland für mehr als CHF 10'000 beziehen."] },
        { frage: "Warum rechnen Sie in Euro ab?", antwort: ["Ihr Vertragspartner ist die FIAON LTD in London. Wir betreuen viele Kunden in Deutschland und Österreich und rechnen deshalb einheitlich in Euro ab."] },
        { frage: "Reicht eine Identitätskarte statt eines Passes?", antwort: [`Ja. Wir brauchen ein Ausweisdokument — ${KAPITAL_AUSWEIS}.`] },
        { frage: par.ddAbgeschlossen ? "Brauchen Sie noch einen Betreibungsauszug?" : "Mein Prüfbericht zeigt offene Punkte — ist das ein Problem?", antwort: [par.ddAbgeschlossen
          ? "Nein. Ihre Due-Diligence-Prüfung ist abgeschlossen und positiv entschieden — einen Betreibungsauszug brauchen wir nicht mehr."
          : "Nein. Herr Schwarzott hat die Bürgschaft persönlich freigegeben. Die Nachweise reichen Sie mit Ihren Unterlagen nach."] },
      ],
    },
    ansprechpartner: {
      titel: "Ihre Ansprechpartner",
      sub: "Sie erreichen uns direkt — vor der Annahme bei jeder Frage und danach bei jedem Schritt.",
      teamTitel: "Ihr Team",
      teamSub: "Diese Menschen arbeiten an Ihrem Auftrag mit.",
      team: kapitalTeam(par, token),
    },
    vertrag: {
      titel: "Ihr Vertrag",
      sub: "Zwölf klare Ziffern und der Prüfbericht als Anlage — derselbe Text wie im PDF.",
      dokument: kapitalVertragTitel(),
      unterzeile: kapitalVertragUnterzeile(d),
      inhalt: kapitalVertragInhalt(d),
    },
    pflicht: [...ANGEBOT_PFLICHTHINWEIS, KAPITAL_PFLICHT_ZUSATZ],
    bildnachweis: kapitalBildnachweis(par),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ÜBERSICHT UND ANNAHME (unmittelbar über dem Knopf)
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalBestellUebersicht(d: KapitalDaten): { titel: string; zeilen: { label: string; wert: string }[] } {
  const par = d.parameter;
  return {
    titel: "Ihr Auftrag im Überblick",
    zeilen: [
      { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}` },
      { label: "Auftraggeberin", wert: firmaZeile(d.kunde) },
      { label: "Leistung", wert: `Gründung einer LLC in ${par.bundesstaat}, Steuerberater, Anwalt und Unternehmensberater, Finanzierung über ${kapitalChf(par.kapitalChf)} mit Begleitung bis zur Auszahlung, Business-Kreditkarten dazu` },
      ...(par.garantieWochen ? [{ label: "Garantie", wert: `Finanzierung über ${kapitalChf(par.kapitalChf)} binnen ${zahlwort(par.garantieWochen)} Wochen ab Auftragserteilung — sonst alles Gezahlte zurück (Ziffer 4)` }] : []),
      ...(kapitalMitKonditionen(par) ? [{ label: "Finanzierung", wert: `${kapitalKonditionenSatz(par)} (Ziffer 4)` }] : []),
      { label: "Bürgschaft", wert: `${d.buergin.name}, Höchstbetrag ${kapitalChf(par.buergschaftChf)}, längstens ${zahlwort(par.buergschaftMonate)} Monate, ohne Sicherheiten (Ziffer 5)` },
      { label: "Vergütung", wert: `${kapitalEur(par.preisCents)} einmalig, netto — fällig mit Vertragsschluss, Rechnung sofort, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen` },
      { label: "Weitere Vergütung", wert: `laut Ziffer 6 Ihres Vertrags: ${kapitalEur(par.buergschaftCents)} Bürgschaftsgebühr mit der Zusage der Bürgschaft und ${kapitalEur(par.auszahlungCents)} mit der Auszahlung der Finanzierung — beide netto` },
      { label: "Ab dem zweiten Jahr", wert: `Jahresbetreuung ${kapitalEur(par.jahresCents)} je Jahr, netto — jährlich im Voraus, mit einem Monat zum Ende des Betreuungsjahres kündbar` },
      { label: "Umsatzsteuer", wert: "Rechnungen ohne Umsatzsteuer (Leistung aus London an ein Unternehmen; in der Schweiz Bezugsteuer beim Empfänger)" },
      { label: "Beginn", wert: "mit Ihrem Zahlungseingang" },
      { label: "Widerruf", wert: "Geschäft unter Unternehmern — kein Widerrufsrecht für Verbraucher" },
    ],
  };
}
export interface KapitalAnnahmeTexte {
  titel: string; sub: string;
  vertretung: string;
  gelesen: string;
  unterschrift: FirmaAnnahmeTexte["unterschrift"];
  knopf: string; unterKnopf: string; gesperrt: string;
}
export function kapitalAnnahmeTexte(d: KapitalDaten): KapitalAnnahmeTexte {
  const par = d.parameter; const name = kapitalVertretungName(d.kunde);
  return {
    titel: "Auftrag erteilen",
    sub: "Name Ihrer Gesellschaft, zwei Häkchen, unterschreiben — fertig.",
    vertretung: `Ich bin berechtigt, die ${d.kunde.firma.name} bei diesem Vertrag zu vertreten, und bin einverstanden, persönlich Gesellschafter der neuen LLC zu werden.`,
    gelesen: "Ich habe den Vertrag und den Prüfbericht gelesen.",
    unterschrift: {
      titel: "Ihre Unterschrift",
      sub: "Zeichnen Sie mit Finger oder Maus — oder tippen Sie Ihren Namen.",
      zeichnen: "Zeichnen", tippen: "Namen tippen", neu: "Neu", platz: "Hier unterschreiben",
      tippenFeld: "Ihr Name", tippenHinweis: `Vor- und Nachname, wie im Vertrag: ${name}`,
      vorschau: "So steht Ihre Unterschrift im Vertrag",
      fehlt: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
      fehltName: `Bitte tippen Sie Ihren Namen mit Nachnamen (${String(d.kunde.vertretung.nachname ?? "").trim()}).`,
    },
    knopf: KAPITAL_KNOPF,
    unterKnopf: `Mit dem Klick erteilen Sie den Auftrag. Fällig sind jetzt nur die Gründungskosten von ${kapitalEur(par.preisCents)} (netto, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen).`,
    gesperrt: "Dieses Angebot wird gerade vervollständigt. Ihr Ansprechpartner gibt Ihnen Bescheid, sobald Sie es annehmen können.",
  };
}
export const KAPITAL_ANNAHME = {
  fehltVertretung: "Bitte bestätigen Sie, dass Sie Ihr Unternehmen vertreten dürfen.",
  fehltGelesen: "Bitte bestätigen Sie, dass Sie Vertrag und Prüfbericht gelesen haben.",
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: "Glückwunsch — Ihr Auftrag steht.",
  fertigText: (email: string, llc: string) => `Ihre Rechnung über den Festpreis kommt gleich an ${email}. Mit Ihrem Zahlungseingang melden wir ${llc} an — Ihr Ansprechpartner meldet sich heute noch für die nächsten Schritte.`,
  fertigZahlung: "Fällig sind jetzt nur die Gründungskosten — inklusive aller Kosten für die ersten zwölf Monate.",
  fertigFuss: "Fragen? Ihr Ansprechpartner ist für Sie da — oder schreiben Sie uns an support@fiaon.com.",
  schrittTitel: "Nächster Schritt: Ihr Ausweis",
  schrittText: "Wir gründen Ihre LLC auf Ihren Namen. Laden Sie dafür jetzt eine Farbkopie Ihres Reisepasses oder Ihrer Identitätskarte hoch — noch mindestens sechs Monate gültig, in Ihrem persönlichen Auftragsbereich, sicher verschlüsselt. Dort sehen Sie auch Rechnung und jeden weiteren Schritt.",
  schrittKnopf: "Ausweis jetzt hochladen",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ANSPRECHPARTNER, PARAMETER, PFLICHTFELDER
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalAnsprechpartner(par: KapitalParameter): { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[] {
  const aus = par.ansprechpartner.map((kz) => ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === kz)).filter(Boolean) as { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[];
  return aus.length ? aus : ANGEBOT_ANSPRECHPARTNER.filter((x) => x.kuerzel === "justin");
}
export function kapitalParameterAus(roh: Partial<KapitalParameter> | null | undefined, basis: KapitalParameter = KAPITAL_VORGABEN): KapitalParameter {
  const r = (roh ?? {}) as Record<string, unknown>;
  const zahl = (k: keyof KapitalParameter, min: number, max: number): number => {
    const v = Number(r[k]); return Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : (basis[k] as number);
  };
  const text = (k: keyof KapitalParameter, max: number): string => (typeof r[k] === "string" ? String(r[k]).replace(/\s+/g, " ").trim().slice(0, max) : (basis[k] as string));
  const ap = Array.isArray(r.ansprechpartner) ? (r.ansprechpartner as unknown[]).map(String).filter((kz) => ANGEBOT_ANSPRECHPARTNER.some((x) => x.kuerzel === kz)).slice(0, 3) : basis.ansprechpartner;
  return {
    preisCents: zahl("preisCents", 10_000, 10_000_000),
    jahresCents: zahl("jahresCents", 0, 1_000_000),
    kapitalChf: zahl("kapitalChf", 1_000, 50_000_000),
    kapitalUsd: zahl("kapitalUsd", 1_000, 60_000_000),
    kursText: text("kursText", 120),
    buergschaftChf: zahl("buergschaftChf", 0, 50_000_000),
    buergschaftMonate: zahl("buergschaftMonate", 1, 120),
    begleitMonate: zahl("begleitMonate", 1, 60),
    bundesstaat: text("bundesstaat", 40),
    zahlungszielTage: zahl("zahlungszielTage", 0, 30),
    ansprechpartner: ap.length ? ap : basis.ansprechpartner,
    buergschaftCents: zahl("buergschaftCents", 0, 10_000_000),
    auszahlungCents: zahl("auszahlungCents", 0, 10_000_000),
    garantieWochen: zahl("garantieWochen", 0, 52),
    kartenVonUsd: zahl("kartenVonUsd", 0, 10_000_000),
    kartenBisUsd: zahl("kartenBisUsd", 0, 10_000_000),
    kartenHerausgeber: text("kartenHerausgeber", 120),
    zinsBasisBp: zahl("zinsBasisBp", 0, 3_000),
    zinsAufschlagBp: zahl("zinsAufschlagBp", 0, 1_000),
    zinsBasisJahre: zahl("zinsBasisJahre", 0, 30),
    laufzeitMaxJahre: zahl("laufzeitMaxJahre", 0, 30),
    kartenMax: zahl("kartenMax", 0, 30),
    ddAbgeschlossen: typeof r.ddAbgeschlossen === "boolean" ? r.ddAbgeschlossen : basis.ddAbgeschlossen,
    team: Array.isArray(r.team)
      ? (r.team as any[]).filter((t) => t && t.bestaetigt !== false).slice(0, 20)
        .map((t) => ({ name: String(t.name ?? "").replace(/\s+/g, " ").trim().slice(0, 80), rolle: String(t.rolle ?? "").replace(/\s+/g, " ").trim().slice(0, 100), foto: typeof t.foto === "string" ? t.foto.slice(0, 40) : null }))
        .filter((t) => t.name && t.rolle)
      : basis.team,
    sonderfreigabe: r.sonderfreigabe && typeof r.sonderfreigabe === "object" && String((r.sonderfreigabe as any).text ?? "").trim()
      ? { titel: String((r.sonderfreigabe as any).titel ?? "Sonderfreigabe").slice(0, 80), text: String((r.sonderfreigabe as any).text).slice(0, 900),
          unterzeichner: String((r.sonderfreigabe as any).unterzeichner ?? "").slice(0, 80), funktion: String((r.sonderfreigabe as any).funktion ?? "").slice(0, 120),
          datum: /^\d{4}-\d{2}-\d{2}$/.test(String((r.sonderfreigabe as any).datum ?? "")) ? String((r.sonderfreigabe as any).datum) : "" }
      : basis.sonderfreigabe,
  };
}
export function kapitalParameterFehler(p: KapitalParameter): string | null {
  if (!p.preisCents) return "Preis fehlt.";
  if (!p.bundesstaat) return "Bundesstaat fehlt.";
  if (p.buergschaftChf > p.kapitalChf) return "Bürgschaft über dem Kapitalplan.";
  return null;
}
export function kapitalBuerginFehler(b: Partial<KapitalBuergin> | null | undefined): string | null {
  if (!b || !b.name || !b.bundesstaat || !b.registernummer || !b.anschrift || !b.vertreter || !b.funktion) return "Angaben zur Bürgin (Name, Bundesstaat, Registernummer, Anschrift, Vertreter, Funktion)";
  return null;
}
export function kapitalPflichtFehlen(d: Pick<KapitalDaten, "kunde" | "parameter" | "buergin" | "compliance">): string[] {
  const k = d.kunde; const fehlt: string[] = [];
  if (!k.firma?.name || !k.firma.strasse || !k.firma.plz || !k.firma.ort) fehlt.push("Firma und Anschrift der Auftraggeberin");
  if (!k.vertretung?.vorname || !k.vertretung.nachname) fehlt.push("Vertreter der Auftraggeberin");
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(k.email ?? ""))) fehlt.push("E-Mail-Adresse");
  const pf = kapitalParameterFehler(d.parameter); if (pf) fehlt.push(pf);
  const bf = kapitalBuerginFehler(d.buergin); if (bf) fehlt.push(bf);
  if (!d.compliance) fehlt.push("Prüfbericht (Anlage)");
  return fehlt;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZWEI SPÄTEREN RECHNUNGEN (E-401, 19.10.2026) — Bürgschaftsgebühr (Ziffer 6 Absatz 2) und Vergütung bei Auszahlung
// (Ziffer 6 Absatz 3). Je ein Knopf im Chefbüro legt Teil 2 bzw. Teil 3 an und stellt darüber die Rechnung — wie der
// Meilenstein des Individualangebots, aber ohne Kundenmail (Firmenangebot). Fassung A kennt beide Beträge nicht.
// ═══════════════════════════════════════════════════════════════════════════
export type KapitalGebuehrArt = "buergschaft" | "auszahlung";
export const KAPITAL_GEBUEHREN: Record<KapitalGebuehrArt, { nr: 2 | 3; titel: string; ziffer: string; ereignis: string; knopf: string; datumLabel: string }> = {
  buergschaft: { nr: 2, titel: "Bürgschaftsgebühr", ziffer: "Ziffer 6 Absatz 2", ereignis: "Bürgschaft gegenüber dem Institut zugesagt", knopf: "Bürgschaft zugesagt", datumLabel: "Zugesagt am" },
  auszahlung: { nr: 3, titel: "Vergütung bei Auszahlung der Finanzierung", ziffer: "Ziffer 6 Absatz 3", ereignis: "Finanzierung ausgezahlt", knopf: "Finanzierung ausgezahlt", datumLabel: "Ausgezahlt am" },
};
/** Was die Knöpfe des Individualangebots (Meilenstein, Frist, Garantie, Erstattung) beim Kapital-Angebot sagen. */
export const KAPITAL_SPERRGRUND = "Kapital-Angebot: Rechnungen über „Bürgschaft zugesagt“ und „Finanzierung ausgezahlt“ im Block des Angebots; die Garantie (Ziffer 4) klärt die Leitung.";
export function istKapitalGebuehrArt(v: unknown): v is KapitalGebuehrArt { return v === "buergschaft" || v === "auszahlung"; }
/** Nur Fassungen ab B vereinbaren die zwei Beträge — Fassung A sagte „keine gesonderte Vergütung“ für die Bürgschaft. */
export function kapitalMitGebuehren(fassung: unknown): boolean {
  return istKapitalFassung(fassung) && String(fassung) !== "IA-KAPITAL-2026-10-19-A";
}
export function kapitalGebuehrCents(par: Pick<KapitalParameter, "buergschaftCents" | "auszahlungCents">, art: KapitalGebuehrArt): number {
  return art === "buergschaft" ? par.buergschaftCents : par.auszahlungCents;
}
/**
 * Darf die Rechnung entstehen? Rein — Knopf-Zustand in der Liste und Klick prüfen dasselbe. `vorhanden` ist der schon
 * angelegte Teil (null = noch keiner); steht seine Rechnung, ist nichts mehr zu tun (`schon`).
 */
export function kapitalGebuehrPruefen(
  lage: { status: string; fassung: string; parameter: Pick<KapitalParameter, "buergschaftCents" | "auszahlungCents">; angenommenAm: string | null; heute: string; teil1Bezahlt: boolean; vorhanden: { rechnungSteht: boolean } | null },
  art: KapitalGebuehrArt, ein: any,
): { ok: true; daten: { datum: string; beleg: string; betragCents: number } } | { ok: false; error: string; schon?: true } {
  const g = KAPITAL_GEBUEHREN[art];
  if (lage.status !== "angenommen") return { ok: false, error: "Erst nach der Annahme." };
  if (!kapitalMitGebuehren(lage.fassung)) return { ok: false, error: `Fassung ${lage.fassung} vereinbart keine ${g.titel} — keine Rechnung.` };
  const betragCents = kapitalGebuehrCents(lage.parameter, art);
  if (!(betragCents > 0)) return { ok: false, error: `Im Vertrag ist für die ${g.titel} kein Betrag vereinbart.` };
  if (lage.vorhanden?.rechnungSteht) return { ok: false, error: `${g.titel} ist schon berechnet.`, schon: true };
  if (art === "buergschaft" && !lage.teil1Bezahlt) return { ok: false, error: "Erst wenn die Vergütung nach Ziffer 6 Absatz 1 bezahlt ist — vorher übernimmt die Bürgin nicht (Ziffer 5)." };
  const datum = String(ein?.datum ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum)) return { ok: false, error: `${g.datumLabel}: Datum fehlt (JJJJ-MM-TT).` };
  if (datum > lage.heute) return { ok: false, error: "Das Datum liegt in der Zukunft." };
  if (lage.angenommenAm && datum < lage.angenommenAm) return { ok: false, error: `Das Datum liegt vor der Annahme (${kapitalTag(lage.angenommenAm)}).` };
  const beleg = String(ein?.beleg ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  return { ok: true, daten: { datum, beleg, betragCents } };
}
/** Die Zeile auf der Rechnung (fiaon-invoice über angebotRechnungsZeile) — je Teil des Kapital-Angebots. */
export function kapitalRechnungsText(z: { angebotRef: string; nr: number; auftragRef: string; ereignisAm?: string | null }): { beschreibung: string; zeitraum: string } {
  const am = z.ereignisAm ? ` am ${kapitalTag(z.ereignisAm)}` : "";
  if (z.nr === 2) return { beschreibung: `FIAON Global, Angebot ${z.angebotRef}: Bürgschaftsgebühr (Ziffer 6 Absatz 2) — Bürgschaft gegenüber dem Institut zugesagt${am} (Auftrag ${z.auftragRef})`, zeitraum: "einmalig" };
  if (z.nr === 3) return { beschreibung: `FIAON Global, Angebot ${z.angebotRef}: Vergütung bei Auszahlung der Finanzierung (Ziffer 6 Absatz 3) — ausgezahlt${am} (Auftrag ${z.auftragRef})`, zeitraum: "einmalig" };
  return { beschreibung: `FIAON Global, Angebot ${z.angebotRef}: ${KAPITAL_TEIL_TITEL} — Vergütung erstes Jahr (Ziffer 6 Absatz 1), Auftrag ${z.auftragRef}`, zeitraum: "einmalig" };
}

// ═══════════════════════════════════════════════════════════════════════════
// „MEIN AUFTRAG“ (E-407, 19.10.2026) — die drei Teile und die Garantie aus Ziffer 4, so wie der Kunde sie auf der Seite las:
// Teil 1 heißt „Gründungskosten“ (E-404), Teil 2 und 3 stehen von Anfang an da, mit einem ruhigen Satz, wann sie entstehen.
// Rein — der Server liest Teile und Bestellzeilen, diese Funktion baut Sätze, Frist und Summe. Kein „bis zu“, kein Bank-Vorbehalt.
// ═══════════════════════════════════════════════════════════════════════════
export const KAPITAL_MEIN_AUFTRAG = {
  teil1Titel: "Gründungskosten",
  teil1Hinweis: "inklusive aller Kosten für die ersten zwölf Monate",
  teil2Warten: "wird erst fällig, sobald die Bürgschaft für Ihre Finanzierung zugesagt ist (Ziffer 6 Absatz 2)",
  teil2Da: (tag: string) => `Bürgschaft zugesagt am ${kapitalTag(tag)}`,
  teil3Warten: "wird erst mit der Auszahlung Ihrer Finanzierung fällig; Sie können sie aus den ausgezahlten Mitteln zahlen (Ziffer 6 Absatz 3)",
  teil3Da: (tag: string) => `Finanzierung ausgezahlt am ${kapitalTag(tag)}`,
  teil3Entfaellt: "entfällt nach Ziffer 4",
  seiteHinweis: "Ihre Garantie steht in Ziffer 4 Ihres Vertrags. Steuerliche und rechtliche Fragen klären Ihr Steuerberater und Ihr Anwalt aus Ihrem Experten-Team (Ziffer 3).",
} as const;
/**
 * „Ihr Weg“ beim Kapital-Angebot (E-407): dieselben Etappen-Nummern wie bei den Paketen, die Texte nach diesem Vertrag —
 * nicht die Kartenleiter/den Kreditrahmen des Individualangebots (dort „Ziffer 3“ = Garantie, hier = Experten-Team).
 * Titel 1–3 bleiben, wie Office und Mails sie kennen; Etappe 4 heißt, was der Kunde gekauft hat: „Ihre Finanzierung“.
 */
export const KAPITAL_ETAPPEN: Record<1 | 2 | 3 | 4, { titel: string; text: string }> = {
  1: { titel: "Gründung und Dokumente", text: "Ihre LLC mit Staatsgebühr und Operating Agreement, Steuernummer (EIN), Registered Agent, US-Adresse und Telefon. Unser Team bereitet alles vor und reicht ein; Sie unterschreiben, was wir Ihnen fertig zuschicken, und laden hier Ihren Reisepass oder Ihre Identitätskarte hoch." },
  2: { titel: "Die erste Firmenkarte", text: "Wir bereiten das US-Geschäftskonto und den ersten Antrag für eine Business-Kreditkarte Ihrer Gesellschaft vollständig vor — Sie unterschreiben nur." },
  3: { titel: "Die Kartenleiter", text: "Weitere Business-Kreditkarten bei US-Herausgebern kommen Schritt für Schritt dazu — zusätzlich zu Ihrer Finanzierung (Ziffer 4 Absatz 2)." },
  4: { titel: "Ihre Finanzierung", text: "Wir bereiten jeden Antrag für Ihre Finanzierung vollständig vor und begleiten Sie bis zur Auszahlung — mit der Bürgschaft unserer US-Partnergesellschaft an Ihrer Seite (Ziffer 4 und 5)." },
};
export interface KapitalAuftragTeilEin { nr: number; titel: string; betragCents: number; stand: string; rechnungsnummer: string | null; bestellRef: string | null; ereignisAm: string | null; bezahltAm: string | null }
export interface KapitalAuftragTeil { nr: number; titel: string; betragCents: number; stand: string; rechnungsnummer: string | null; bestellRef: string | null; hinweis: string | null }
export interface KapitalMeinAuftrag {
  teile: KapitalAuftragTeil[];
  /** Der Satz unter den Teilen: Garantie, Frist oder Ergebnis. */
  garantieSatz: string;
  /** Kurz fürs Chefbüro/Office („Garantieziel“). */
  garantieZiel: string;
  fristBeginn: string | null; fristEnde: string | null;
  /** Die Summe der entstandenen Teile (heute groß, später leise — E-402/E-404). */
  summeCents: number;
  teil2Bedingung: string;
  seiteHinweis: string;
  jahresZeile: string;
}
function plusTage(iso: string, n: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
/** Die Garantie (Ziffer 4) kam mit Fassung B — Fassung A hatte keine, auch wenn die Vorgaben heute acht Wochen tragen. */
export function kapitalGarantieWochen(fassung: unknown, par: Pick<KapitalParameter, "garantieWochen">): number {
  return kapitalMitGebuehren(fassung) && par.garantieWochen > 0 ? par.garantieWochen : 0;
}
/**
 * Die Frist nach Ziffer 4 (E-411): „binnen N Wochen ab Auftragserteilung“, und sie ruht, solange Teil 1 nicht gezahlt ist —
 * also ab dem späteren der zwei Tage (Annahme, Zahlung von Teil 1). Ohne Zahlung oder ohne Garantie: keine Frist.
 * EINE Rechnung für den Zahlungsweg (schreibt frist_beginn/frist_ende) und „Mein Auftrag“.
 */
export function kapitalGarantieFrist(ein: { angenommenAm: string | null; bezahltAm: string | null; wochen: number }): { beginn: string; ende: string } | null {
  if (!ein.bezahltAm || !(ein.wochen > 0)) return null;
  const beginn = ein.angenommenAm && ein.angenommenAm > ein.bezahltAm ? ein.angenommenAm : ein.bezahltAm;
  return { beginn, ende: plusTage(beginn, ein.wochen * 7) };
}

// ═══════════════════════════════════════════════════════════════════════════
// NACH DER ZAHLUNG (E-411, 19.10.2026) — die Texte, die der Kapital-Zahlungsweg (server kapitalNachZahlung) schreibt. Rein.
// Teil 1 bezahlt: Aufgabe an Justin mit Ziffer 2 (Anmeldung binnen fünf Werktagen nach Zahlung UND Unterlagen nach Ziffer 7)
// und der Garantie aus Ziffer 4. Teil 2/3 bezahlt: nur ein Vermerk — die Frist bleibt, wie sie ist.
// ═══════════════════════════════════════════════════════════════════════════
export function kapitalStartAufgabe(ein: {
  angebotRef: string; firma: string; vertretung: string; fassung: string;
  parameter: Pick<KapitalParameter, "preisCents" | "kapitalChf" | "buergschaftCents" | "auszahlungCents" | "garantieWochen"> & Partial<Pick<KapitalParameter, "ddAbgeschlossen">>;
  bezahltAm: string; zweck: string | null;
  frist: { beginn: string; ende: string } | null;
  /** Tag, an dem der Reisepass im Auftragsbereich liegt (fiaon_global_dokumente) — null = fehlt noch. */
  reisepassAm: string | null;
}): { titel: string; text: string } {
  const par = ein.parameter; const wochen = kapitalGarantieWochen(ein.fassung, par);
  const unterlagenRest = par.ddAbgeschlossen
    ? "Adressnachweis, Handelsregisterauszug, Jahresrechnung, Beschreibung der Tätigkeit — Betreibungsauszug entfällt, Due Diligence abgeschlossen"
    : "Adressnachweis, Handelsregisterauszug, Betreibungsauszug mit Jahresrechnung, Beschreibung der Tätigkeit";
  const anmeldung = ein.reisepassAm
    ? `ANMELDUNG (Ziffer 2): Der Ausweis (Reisepass oder Identitätskarte) liegt seit dem ${kapitalTag(ein.reisepassAm)} im Auftragsbereich. FIAON reicht die Anmeldung binnen fünf Werktagen ein, nachdem bezahlt ist UND die Unterlagen nach Ziffer 7 vorliegen (dazu auch ${unterlagenRest}). Liegen sie heute vollständig vor: einreichen bis ${kapitalTag(plusWerktage(ein.reisepassAm > ein.bezahltAm ? ein.reisepassAm : ein.bezahltAm, 5))}.`
    : `ANMELDUNG (Ziffer 2): Der Ausweis (Reisepass oder Identitätskarte) fehlt noch — bitte anfordern (Upload in „Mein Auftrag“). FIAON reicht die Anmeldung binnen fünf Werktagen ein, nachdem bezahlt ist UND die Unterlagen nach Ziffer 7 vorliegen (Ausweis, ${unterlagenRest}).`;
  const garantie = wochen > 0 && ein.frist
    ? `GARANTIE (Ziffer 4): Finanzierung über ${kapitalChf(par.kapitalChf)} — die ${zahlwort(wochen)} Wochen laufen seit dem ${kapitalTag(ein.frist.beginn)}, die Garantie läuft bis ${kapitalTag(ein.frist.ende)}. Kommt sie bis dahin nicht, erstattet FIAON alles Gezahlte binnen vierzehn Tagen. Die Frist ruht, solange Unterlagen nach Ziffer 7 ausstehen oder ein marktübliches Finanzierungsangebot nicht angenommen wird — solche Tage bitte mit Datum im Verlauf festhalten.`
    : "GARANTIE: Diese Fassung hat keine Garantie (Ziffer 4 ohne Frist) — keine Frist gesetzt.";
  return {
    titel: `Kapital-Angebot ${ein.angebotRef}: Gründungskosten bezahlt — LLC anmelden (${ein.firma})`,
    text: [
      `${ein.vertretung} (${ein.firma}) hat die Gründungskosten bezahlt (${kapitalEur(par.preisCents)}, Teil 1${ein.zweck ? `, Verwendungszweck ${ein.zweck}` : ""}, eingegangen am ${kapitalTag(ein.bezahltAm)}). Der Auftrag läuft.`,
      anmeldung,
      garantie,
      ...(kapitalMitGebuehren(ein.fassung) ? [`DANACH: Sagt die Bürgin gegenüber dem Institut zu → Knopf „${KAPITAL_GEBUEHREN.buergschaft.knopf}“ (Rechnung ${kapitalEur(par.buergschaftCents)}). Ist die Finanzierung ausgezahlt → Knopf „${KAPITAL_GEBUEHREN.auszahlung.knopf}“ (Rechnung ${kapitalEur(par.auszahlungCents)}).`] : []),
      "Keine automatische Kundenmail (Firmenangebot) — den Start bitte persönlich mitteilen.",
    ].join("\n"),
  };
}
/** Der Vermerk, wenn Teil 2 oder Teil 3 bezahlt ist — ohne neue Frist (Ziffer 4 rechnet ab Teil 1). */
export function kapitalTeilBezahltVermerk(ein: { angebotRef: string; titel: string; betragCents: number; zweck: string | null; fristEnde: string | null; nachGarantiefall: boolean }): string {
  return `${ein.titel} des Kapital-Angebots ${ein.angebotRef} bezahlt (${kapitalEur(ein.betragCents)}${ein.zweck ? `, ${ein.zweck}` : ""}).`
    + (ein.nachGarantiefall ? " ACHTUNG: Der Teil ist entfallen bzw. der Garantiefall ist vorgemerkt — dieser Betrag ist zu erstatten."
      : ein.fristEnde ? ` Die Garantiefrist (Ziffer 4) bleibt beim ${kapitalTag(ein.fristEnde)}.` : "");
}

// ═══════════════════════════════════════════════════════════════════════════
// FRISTWARNUNG (E-412, 19.10.2026) — der Kapital-Fristlauf (server kapitalFristLauf, aus globalAngebotLauf). Rein.
// 14 und 3 Tage vor frist_ende eine Aufgabe an Justin, am Tag nach dem Fristende „Frist abgelaufen — Garantie Ziffer 4 prüfen“.
// Nichts mehr, sobald die Garantie erfüllt, die Erstattung vorgemerkt oder „Finanzierung ausgezahlt“ (Teil 3) eingetragen ist.
// Die Marken frist_warnung_14_am/frist_warnung_3_am/frist_abgelaufen_am machen jeden Schritt einmalig.
// KEINE Kundenmail, KEIN Geld: Die Garantie klärt die Leitung (KAPITAL_SPERRGRUND).
// ═══════════════════════════════════════════════════════════════════════════
export type KapitalFristSchritt = "warnung14" | "warnung3" | "abgelaufen";
/** Welcher Schritt heute dran ist — höchstens einer je Lauf; null = nichts zu tun. */
export function kapitalFristSchritt(ein: {
  fristEnde: string | null; heute: string;
  warnung14Am: unknown; warnung3Am: unknown; abgelaufenAm: unknown;
  garantieErfuelltAm: unknown; erstattungAusgeloestAm: unknown; teil3Eingetragen: boolean;
}): { schritt: KapitalFristSchritt; tageBis: number } | null {
  if (!ein.fristEnde || ein.garantieErfuelltAm || ein.erstattungAusgeloestAm || ein.teil3Eingetragen) return null;
  const tageBis = Math.round((new Date(`${ein.fristEnde.slice(0, 10)}T12:00:00Z`).getTime() - new Date(`${ein.heute.slice(0, 10)}T12:00:00Z`).getTime()) / 864e5);
  // „Am Tag nach Fristende“: Der letzte Tag der Frist zählt noch.
  if (tageBis < 0) return ein.abgelaufenAm ? null : { schritt: "abgelaufen", tageBis };
  if (tageBis <= 3) return ein.warnung3Am ? null : { schritt: "warnung3", tageBis };
  if (tageBis <= 14) return ein.warnung14Am || ein.warnung3Am ? null : { schritt: "warnung14", tageBis };
  return null;
}
/** Die Aufgabe an Justin zum Schritt — Erstattung „binnen vierzehn Tagen nach Fristende“ (Ziffer 4). */
export function kapitalFristAufgabe(ein: {
  schritt: KapitalFristSchritt; tageBis: number; angebotRef: string; firma: string;
  fristBeginn: string | null; fristEnde: string;
  parameter: Pick<KapitalParameter, "kapitalChf" | "garantieWochen" | "auszahlungCents">;
}): { titel: string; text: string; dringend: boolean } {
  const ende = kapitalTag(ein.fristEnde); const bis = kapitalTag(plusTage(ein.fristEnde, 14));
  const ziel = kapitalChf(ein.parameter.kapitalChf); const knopf = `„${KAPITAL_GEBUEHREN.auszahlung.knopf}“`;
  const ruhen = "Ruhte die Frist (Unterlagen nach Ziffer 7 standen aus oder ein vorgelegtes Finanzierungsangebot nach Ziffer 4 wurde nicht angenommen), die Tage bitte mit Datum im Verlauf festhalten.";
  const ohne = "Das System hat KEIN Geld bewegt und keine Mail an den Kunden geschickt.";
  if (ein.schritt === "abgelaufen") {
    return {
      titel: `Frist abgelaufen — Garantie Ziffer 4 prüfen (Kapital-Angebot ${ein.angebotRef}, ${ein.firma})`,
      text: [
        `Die Garantiefrist (Ziffer 4) des Kapital-Angebots ${ein.angebotRef} endete am ${ende}; ${knopf} ist nicht eingetragen.`,
        `Wurde die Finanzierung über ${ziel} bis zum ${ende} eingeräumt und ausgezahlt: Knopf ${knopf} mit dem Tag der Auszahlung (Rechnung ${kapitalEur(ein.parameter.auszahlungCents)}).`,
        ruhen,
        `Sonst ist der Garantiefall da: FIAON erstattet alles Gezahlte (Gründungskosten und eine bezahlte Bürgschaftsgebühr) binnen vierzehn Tagen nach Fristende, also bis ${bis}. Die Vergütung bei Auszahlung entfällt, die Gesellschaft bleibt der Auftraggeberin.`,
        ohne,
      ].join("\n"),
      dringend: true,
    };
  }
  const wochen = ein.parameter.garantieWochen;
  return {
    titel: `Kapital-Angebot ${ein.angebotRef}: Garantiefrist endet am ${ende} (noch ${ein.tageBis} ${ein.tageBis === 1 ? "Tag" : "Tage"}) — ${ein.firma}`,
    text: [
      `Die Garantie aus Ziffer 4 läuft am ${ende} ab: Finanzierung über ${ziel}${wochen > 0 ? ` binnen ${zahlwort(wochen)} Wochen` : ""}${ein.fristBeginn ? ` (seit dem ${kapitalTag(ein.fristBeginn)})` : ""}.`,
      `Stand prüfen: Ist die Finanzierung ausgezahlt, Knopf ${knopf} (Rechnung ${kapitalEur(ein.parameter.auszahlungCents)}) — dann endet diese Erinnerung.`,
      ruhen,
      `Kommt die Finanzierung bis zum ${ende} nicht, erstattet FIAON alles Gezahlte binnen vierzehn Tagen nach Fristende (bis ${bis}).`,
      ohne,
    ].join("\n"),
    dringend: ein.schritt === "warnung3",
  };
}
export function kapitalMeinAuftrag(ein: {
  fassung: string;
  parameter: Pick<KapitalParameter, "preisCents" | "jahresCents" | "buergschaftCents" | "auszahlungCents" | "garantieWochen" | "kapitalChf">;
  angenommenAm: string | null;
  teile: KapitalAuftragTeilEin[];
  garantieErfuelltAm: string | null;
  erstattungAusgeloest: boolean;
  /** frist_beginn/frist_ende aus der Datenbank (E-411) — gelten nur, wenn der Kapital-Weg sie geschrieben hat (siehe unten). */
  gespeichert?: { beginn: string | null; ende: string | null };
}): KapitalMeinAuftrag {
  const par = ein.parameter; const T = KAPITAL_MEIN_AUFTRAG;
  const roh = (nr: number) => ein.teile.find((t) => Number(t.nr) === nr) ?? null;
  const t1 = roh(1), t2 = roh(2), t3 = roh(3);
  const teile: KapitalAuftragTeil[] = [{
    nr: 1, titel: T.teil1Titel, betragCents: t1?.betragCents ?? par.preisCents, stand: t1?.stand ?? "offen",
    rechnungsnummer: t1?.rechnungsnummer ?? null, bestellRef: t1?.bestellRef ?? null, hinweis: T.teil1Hinweis,
  }];
  // Fassung A vereinbart weder Bürgschaftsgebühr noch Vergütung bei Auszahlung — dort stehen nur die Teile, die es gibt.
  const mit = kapitalMitGebuehren(ein.fassung);
  const spaeter = (nr: 2 | 3, t: KapitalAuftragTeilEin | null, betragCents: number, titel: string, warten: string, da: (tag: string) => string): KapitalAuftragTeil | null => {
    if (t) return { nr, titel, betragCents: t.betragCents, stand: t.stand, rechnungsnummer: t.rechnungsnummer, bestellRef: t.bestellRef, hinweis: t.ereignisAm ? da(t.ereignisAm) : null };
    if (!mit || !(betragCents > 0)) return null;
    if (nr === 3 && ein.erstattungAusgeloest) return { nr, titel, betragCents, stand: "entfallen", rechnungsnummer: null, bestellRef: null, hinweis: T.teil3Entfaellt };
    return { nr, titel, betragCents, stand: "noch nicht fällig", rechnungsnummer: null, bestellRef: null, hinweis: warten };
  };
  for (const x of [
    spaeter(2, t2, par.buergschaftCents, KAPITAL_GEBUEHREN.buergschaft.titel, T.teil2Warten, T.teil2Da),
    spaeter(3, t3, par.auszahlungCents, KAPITAL_GEBUEHREN.auszahlung.titel, T.teil3Warten, T.teil3Da),
  ]) if (x) teile.push(x);

  // Ziffer 4: binnen N Wochen ab Auftragserteilung; die Frist ruht, solange Teil 1 nicht gezahlt ist — die Wochen laufen also
  // ab dem späteren der zwei Tage (Annahme, Zahlung). Das Ruhen wegen fehlender Unterlagen nennt der Satz, ohne es zu rechnen.
  const wochen = kapitalGarantieWochen(ein.fassung, par); const ziel = kapitalChf(par.kapitalChf);
  const frist = kapitalGarantieFrist({ angenommenAm: ein.angenommenAm, bezahltAm: t1?.bezahltAm ?? null, wochen });
  const beginn = frist?.beginn ?? null;
  // E-411: Das gespeicherte Fristende gilt, wenn der Kapital-Weg es geschrieben hat — erkennbar am selben Beginn — und es nur
  // später liegt (eine Ruhezeit nach Ziffer 4 verlängert, nie verkürzt). Werte des alten Individualwegs (anderer Beginn,
  // zwölf Wochen) gelten nie.
  const g = ein.gespeichert;
  const ende = frist && g?.ende && g.beginn === frist.beginn && g.ende >= frist.ende ? g.ende : frist?.ende ?? null;
  const zurueck = "sonst erhalten Sie alles zurück, was Sie an uns gezahlt haben (Ziffer 4)";
  const garantieSatz = !(wochen > 0)
    ? (t3?.ereignisAm ? `Ihre Finanzierung ist am ${kapitalTag(t3.ereignisAm)} ausgezahlt.` : `Wir begleiten Sie bis zur Auszahlung Ihrer Finanzierung über ${ziel} (Ziffer 4).`)
    : ein.garantieErfuelltAm ? `Garantie erfüllt am ${kapitalTag(ein.garantieErfuelltAm)}: Ihre Finanzierung über ${ziel} ist ausgezahlt.`
    : t3?.ereignisAm ? `Ihre Finanzierung ist am ${kapitalTag(t3.ereignisAm)} ausgezahlt.`
    : ein.erstattungAusgeloest ? "Die Frist ist abgelaufen, ohne dass Ihre Finanzierung ausgezahlt wurde. Wir erstatten Ihnen alles, was Sie an uns gezahlt haben (Ziffer 4); die Vergütung bei Auszahlung entfällt."
    : beginn && ende ? `Wir garantieren Ihnen Ihre Finanzierung über ${ziel} bis zum ${kapitalTag(ende)} — ${zurueck}. Ihre ${zahlwort(wochen)} Wochen laufen seit dem ${kapitalTag(beginn)}; solange Unterlagen von Ihnen ausstehen, ruht die Frist.`
    : `Wir garantieren Ihnen Ihre Finanzierung über ${ziel} binnen ${zahlwort(wochen)} Wochen — ${zurueck}. Die ${zahlwort(wochen)} Wochen laufen ab Ihrer Zahlung der Gründungskosten.`;
  const garantieZiel = wochen > 0
    ? `Finanzierung über ${ziel} binnen ${zahlwort(wochen)} Wochen ab Auftragserteilung, sonst alles Gezahlte zurück (Ziffer 4)`
    : `Finanzierungsplan über ${ziel} (Fassung ohne Garantie)`;
  // Entstanden: Teil 1 immer, Teil 2/3 sobald ihre Rechnung steht (storniert/entfallen zählt nicht).
  const summeCents = teile.filter((t) => t.nr === 1 || (t.bestellRef && !["storniert", "entfallen", "noch nicht fällig"].includes(t.stand))).reduce((s, t) => s + t.betragCents, 0);
  return {
    teile, garantieSatz, garantieZiel, fristBeginn: beginn, fristEnde: ende, summeCents,
    teil2Bedingung: teile.find((t) => t.nr === 2)?.hinweis ?? "",
    seiteHinweis: T.seiteHinweis,
    jahresZeile: par.jahresCents > 0 ? `Ab dem zweiten Jahr betreuen wir Ihre Gesellschaft für ${kapitalEur(par.jahresCents)} je Jahr (Ziffer 6): Registered Agent, US-Adresse und Telefon, die jährlichen Meldungen und der Pflichtenkalender — beendbar mit einem Monat zum Ende eines Betreuungsjahres.` : "",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSICHT (GET /api/fiaon/global/angebot/:token für ein offenes Kapital-Angebot)
// ═══════════════════════════════════════════════════════════════════════════
export interface KapitalKundenSicht {
  ok: true; status: "offen"; art: "kapital";
  ref: string; fassung: string; gueltigBis: string;
  kunde: { firma: string; marke: string; anrede: string; vorname: string; nachname: string; email: string };
  kundeAnrede: string;
  seite: KapitalSeite;
  compliance: ComplianceKundenfassung | null;
  ansprechpartner: { kuerzel: string; name: string; rolle: string; email: string; telefon: string; portrait: string }[];
  uebersicht: { titel: string; zeilen: { label: string; wert: string }[] };
  annahme: KapitalAnnahmeTexte;
  annahmeBereit: boolean;
  gesperrtGrund: string | null;
  vorschauLeitung?: boolean;
  fehlt?: string[];
  html: string;
  textHash: string;
  vertragPdf: string;
  pruefberichtPdf: string | null;
}
