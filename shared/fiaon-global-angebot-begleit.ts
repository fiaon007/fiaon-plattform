// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DER BEGLEITVERTRAG FÜR BESTANDSKUNDEN (Register E-312, 08.10.2026)
//
// Justin (08.10.2026): Ein Kunde aus dem alten Business-Konzept (Monatsbeitrag) wechselt zu FIAON Global. Er „muss keine
// weiteren Gebühren an uns bezahlen“ — kein Abo mehr. Er zahlt die Gründung seiner US-Gesellschaft zum Selbstkostenpreis
// (zwischen 500 und 700 € insgesamt, gesonderte Rechnung) und tippt den Namen seiner LLC direkt auf der Seite ein.
// Dazu (Justin, 08.10.2026 abends): „wie wir daran noch gut Geld verdienen können … gutes Win-Win“ → entschieden:
//   · Erfolgshonorar 5 % auf jedes Kapital, das die Gesellschaft durch die Begleitung erhält — fällig erst, wenn es da ist.
//   · Jahresbetreuung (699 € je Jahr ab dem zweiten Jahr, GLOBAL_JAHRESBETREUUNG) als freiwilliger Haken, nie vorangekreuzt.
// Alles steht OFFEN auf der Seite und im Vertrag — keine versteckte Klausel (§ 305c BGB; Justins Wahl „alles offen“).
//
// Eigener Pfad neben dem Individualangebot (E-268) und dem Firmenangebot (E-301): Fassungen mit dem
// Präfix IA-BEGLEIT- verzweigen in server/lib/fiaon-global-angebot-begleit.ts. Die anderen Wortlaute bleiben Byte für Byte.
//
// ── DIE WORTGRENZEN (wie FIAON Global, shared/fiaon-global-angebot.ts) ──────
//   · kein „bis zu“, kein „vermitteln/beschaffen“, kein „garant…“, keine Zusage eines Finanzierungserfolgs — FIAON schuldet
//     die Begleitung, über jede Finanzierung entscheidet allein das Institut (Ziffer 6).
//   · Fristen als Wort, Vertrag in Vertragssprache („der Auftraggeber“, „FIAON“ — kein Ihr/wir), Seite spricht den Kunden an.
//
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Kundendaten. Kunde und Parameter liegen nur in der
// Datenbank (fiaon_global_angebote) und kommen über den persönlichen Link.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_JAHRESBETREUUNG } from "./fiaon-global";
import { FIAON_FIRMA } from "./fiaon-firma";
import { globalWiderrufsbelehrung } from "./fiaon-global-widerruf";
import { ANGEBOT_PFLICHTHINWEIS, ANGEBOT_ANSPRECHPARTNER, ANGEBOT_ANNAHME, type AngebotAbsatz, type AngebotZiffer } from "./fiaon-global-angebot";
import { zahlwort, monateWort } from "./fiaon-global-angebot-firma";
import type { FirmaPhase, FirmaLeistung, FirmaFrage, FirmaAnnahmeTexte, FirmaUnterschriftEingabe } from "./fiaon-global-angebot-firma-typen";

// ═══════════════════════════════════════════════════════════════════════════
// FASSUNG
// ═══════════════════════════════════════════════════════════════════════════
export const BEGLEIT_FASSUNG_PRAEFIX = "IA-BEGLEIT-";
/** Eine neue Fassung = neuer Eintrag. ANGENOMMENE Angebote behalten ihre; ein OFFENES zeigt immer die aktuelle. */
export const BEGLEIT_FASSUNG = "IA-BEGLEIT-2026-10-08-A";
export const BEGLEIT_FASSUNGEN = [BEGLEIT_FASSUNG] as const;
export function istBegleitFassung(fassung: unknown): boolean {
  return String(fassung ?? "").startsWith(BEGLEIT_FASSUNG_PRAEFIX);
}
export const BEGLEIT_GUELTIG_TAGE = 14;
/** Der Knopf (§ 312j Abs. 3 BGB): Die Gründungskosten sind eine Zahlungspflicht — sie steht im Knopf selbst. */
export const BEGLEIT_KNOPF = "Auftrag zahlungspflichtig erteilen";
export const BEGLEIT_MARKE = "Begleitvertrag für Bestandskunden";

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
export type BegleitLand = "DE" | "AT" | "CH";
export interface BegleitKunde {
  art: "privat";
  anrede: "Herr" | "Frau" | "";
  vorname: string;
  nachname: string;
  /** JJJJ-MM-TT */
  geburtsdatum: string;
  strasse: string;
  plz: string;
  ort: string;
  land: BegleitLand;
  email: string;
  telefon: string;
}
/** Was der Kunde unter dem alten Konzept schon bezahlt hat — nur zur Darstellung „bereits erledigt“ (Text, keine Rechenbasis). */
export interface BegleitBisherPosten { titel: string; betrag: string }
export interface BegleitParameter {
  /** Gesamtrahmen des gemeinsamen Plans in USD */
  kapitalUsd: number;
  /** Erfolgshonorar in Prozent des Kapitals, das die Gesellschaft erhält */
  honorarProzent: number;
  /** Dauer der Kapital-Begleitung ab der Eintragung der Gesellschaft */
  begleitMonate: number;
  /** Anträge aus der Begleitzeit, die in diesen Monaten nach ihrem Ende eingeräumt werden, zählen noch */
  nachlaufMonate: number;
  /** Fälligkeit des Erfolgshonorars nach der Einräumung (Tage) */
  honorarZielTage: number;
  /** Gründungskosten zum Selbstkostenpreis: Spanne und Höchstbetrag (der obere Wert) */
  gruendungVonCents: number;
  gruendungBisCents: number;
  /** Zahlungsziel der Gründungsrechnung (Tage) */
  zahlungszielTage: number;
  /** Bundesstaat der Gründung */
  bundesstaat: string;
  /** Erste Karten zum Start: Rahmen je Karte (USD, Spanne) — nur als Erfahrungswert auf der Seite */
  ersteKartenVonUsd: number;
  ersteKartenBisUsd: number;
  /** Bezeichnung der bisherigen Mitgliedschaft und was davon schon bezahlt ist */
  bisherMitgliedschaft: string;
  bisher: BegleitBisherPosten[];
  /** Der nächste Monatsbeitrag, der entfällt (JJJJ-MM-TT) und sein Betrag als Text */
  entfaelltAb: string;
  entfaelltBetrag: string;
  /** Ansprechpartner (kuerzel aus ANGEBOT_ANSPRECHPARTNER) — der erste ist „Ihr Ansprechpartner“ */
  ansprechpartner: string[];
}
export const BEGLEIT_VORGABEN: BegleitParameter = {
  kapitalUsd: 250_000,
  honorarProzent: 5,
  begleitMonate: 24,
  nachlaufMonate: 6,
  honorarZielTage: 30,
  gruendungVonCents: 50_000,
  gruendungBisCents: 70_000,
  zahlungszielTage: 14,
  bundesstaat: "Florida",
  ersteKartenVonUsd: 25_000,
  ersteKartenBisUsd: 30_000,
  bisherMitgliedschaft: "FIAON Business",
  bisher: [],
  entfaelltAb: "",
  entfaelltBetrag: "",
  ansprechpartner: ["justin", "daniel"],
};
export interface BegleitDaten {
  ref: string;
  fassung: string;
  kunde: BegleitKunde;
  parameter: BegleitParameter;
  gueltigBis: string;
}

/** Der gewünschte Name der Gesellschaft — erste Wahl und zwei Ausweichnamen (Ausweichnamen freiwillig). */
export interface BegleitLlcWahl { wunsch: string; alternative1: string; alternative2: string }
/** Was der Kunde bei der Annahme wählt — steht im Annahmevermerk, NICHT in der Prüfsumme (der Vertrag regelt beide Fälle). */
export interface BegleitWahl { llc: BegleitLlcWahl; sofortBeginn: boolean; jahresbetreuung: boolean }
export interface BegleitUnterschriftVermerk { art: "gezeichnet" | "getippt"; name?: string | null; png?: string | null; am?: string; ip?: string }
export interface BegleitAnnahmeVermerk { am: Date; ip: string; userAgent: string; hash: string; wahl: BegleitWahl; unterschrift: BegleitUnterschriftVermerk }
export interface BegleitAnnahmeEingabe {
  textHash: string;
  llc: BegleitLlcWahl;
  sofortBeginn: boolean;
  jahresbetreuung: boolean;
  gelesen: boolean;
  unterschrift: FirmaUnterschriftEingabe;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN, BETRÄGE, NAMEN
// ═══════════════════════════════════════════════════════════════════════════
export function begleitEur(cents: number): string {
  const e = Math.round(cents) / 100;
  return `${e.toLocaleString("de-DE", { minimumFractionDigits: Number.isInteger(e) ? 0 : 2, maximumFractionDigits: 2 })} €`;
}
export function begleitUsd(usd: number): string {
  return `${Math.round(usd).toLocaleString("de-DE")} USD`;
}
export function begleitProzent(p: number): string {
  return `${String(p).replace(".", ",")} %`;
}
/** Das Erfolgshonorar zu einem Kapital (USD, gerundet auf ganze Dollar). */
export function begleitHonorarUsd(kapitalUsd: number, prozent: number): number {
  return Math.round((Math.max(0, kapitalUsd) * prozent) / 100);
}
export function begleitTag(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}
export function begleitKundeName(k: Pick<BegleitKunde, "vorname" | "nachname">): string {
  return `${String(k.vorname ?? "").trim()} ${String(k.nachname ?? "").trim()}`.trim();
}
export function begleitKundeGruss(k: Pick<BegleitKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  return k.anrede && nach ? `${k.anrede} ${nach}` : begleitKundeName(k);
}
export function begleitKundeAnrede(k: Pick<BegleitKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede === "Herr" && nach) return `Sehr geehrter Herr ${nach}`;
  if (k.anrede === "Frau" && nach) return `Sehr geehrte Frau ${nach}`;
  return `Guten Tag ${begleitKundeName(k)}`;
}
const gross = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const LAND_NAME: Record<BegleitLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
function anschrift(k: BegleitKunde): string {
  return `${k.strasse}, ${k.plz} ${k.ort}, ${LAND_NAME[k.land] ?? k.land}`;
}

// ── Der Name der Gesellschaft ────────────────────────────────────────────────
/** Zulässige Zeichen (wie das Register in Florida sie annimmt) — Buchstaben, Ziffern, Leerzeichen, & - , . ' */
const LLC_ZEICHEN = /^[A-Za-z0-9 &\-,.']+$/;
const LLC_ENDUNG = /\s*(,?\s*(L\.?L\.?C\.?|LIMITED LIABILITY COMPANY|LIMITED COMPANY|LTD\.?|INC\.?|CORP\.?|GMBH|UG))\s*$/i;
/** Aus der Eingabe den Stamm machen: Leerraum glätten, Rechtsform-Endungen entfernen, Großschreibung wie im Register. */
export function llcStamm(roh: unknown): string {
  let s = String(roh ?? "").normalize("NFKC").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3 && LLC_ENDUNG.test(s); i++) s = s.replace(LLC_ENDUNG, "").trim();
  return s.toUpperCase();
}
/** Der volle Name, wie er in den Articles of Organization steht: „<STAMM> LLC“. */
export function llcVollname(roh: unknown): string {
  const s = llcStamm(roh);
  return s ? `${s} LLC` : "";
}
/** Prüft einen Namen; null = in Ordnung, sonst der Satz für das Feld. `pflicht` nur für die erste Wahl. */
export function llcNameFehler(roh: unknown, pflicht: boolean): string | null {
  const s = llcStamm(roh);
  if (!s) return pflicht ? BEGLEIT_LLC_TEXTE.fehltWunsch : null;
  if (/[äöüÄÖÜß]/.test(s)) return BEGLEIT_LLC_TEXTE.umlaut;
  if (!LLC_ZEICHEN.test(s)) return BEGLEIT_LLC_TEXTE.zeichen;
  if (s.replace(/[^A-Z0-9]/g, "").length < 2) return BEGLEIT_LLC_TEXTE.kurz;
  if (s.length > 80) return BEGLEIT_LLC_TEXTE.lang;
  if (/\b(BANK|TRUST|INSURANCE|FEDERAL|NATIONAL|TREASURY|CREDIT UNION)\b/.test(s)) return BEGLEIT_LLC_TEXTE.geschuetzt;
  return null;
}
/** Die drei Namen bereinigt (Vollnamen) — oder der erste Fehler mit dem Feld. */
export function llcWahlPruefen(roh: any): { ok: true; wahl: BegleitLlcWahl } | { ok: false; feld: keyof BegleitLlcWahl; error: string } {
  const felder: (keyof BegleitLlcWahl)[] = ["wunsch", "alternative1", "alternative2"];
  for (const f of felder) {
    const fehler = llcNameFehler(roh?.[f], f === "wunsch");
    if (fehler) return { ok: false, feld: f, error: fehler };
  }
  const wahl = { wunsch: llcVollname(roh?.wunsch), alternative1: llcVollname(roh?.alternative1), alternative2: llcVollname(roh?.alternative2) };
  const gesehen = new Set<string>();
  for (const f of felder) {
    if (!wahl[f]) continue;
    if (gesehen.has(wahl[f])) return { ok: false, feld: f, error: BEGLEIT_LLC_TEXTE.doppelt };
    gesehen.add(wahl[f]);
  }
  return { ok: true, wahl };
}
export const BEGLEIT_LLC_TEXTE = {
  titel: "Wie soll Ihre Gesellschaft heißen?",
  sub: "Tippen Sie den Namen Ihrer US-Gesellschaft — genau so übernehmen wir ihn für die Gründung. „LLC“ setzen wir automatisch dahinter.",
  wunsch: "Ihr Wunschname",
  wunschPlatz: "z. B. Atlas Ventures",
  alternativen: "Zwei Ausweichnamen (freiwillig)",
  alternativenSub: "Ist Ihr Wunschname im Register schon vergeben, nehmen wir den ersten freien Ausweichnamen — ohne Rückfrage, damit nichts wartet.",
  alternative1: "Ausweichname 1",
  alternative2: "Ausweichname 2",
  vorschauZeile: "Name der Limited Liability Company",
  vorschauLeer: "IHR NAME LLC",
  vorschauFuss: "Vorschau — die Anmeldung reicht FIAON nach Ihrer Annahme ein.",
  hinweis: "Vor der Anmeldung prüfen wir die Verfügbarkeit im offiziellen Register von Florida (Sunbiz). Englische Namen funktionieren in den USA am besten; Umlaute sind dort nicht möglich.",
  fehltWunsch: "Bitte tippen Sie den Wunschnamen Ihrer Gesellschaft.",
  umlaut: "Umlaute und ß sind im US-Register nicht möglich — bitte ae, oe, ue oder ss verwenden.",
  zeichen: "Bitte nur Buchstaben, Ziffern, Leerzeichen und & - , . ' verwenden.",
  kurz: "Der Name ist zu kurz.",
  lang: "Der Name ist zu lang (höchstens achtzig Zeichen).",
  geschuetzt: "Wörter wie „Bank“, „Trust“, „Insurance“ oder „Federal“ sind in den USA geschützt — bitte einen anderen Namen wählen.",
  doppelt: "Bitte drei verschiedene Namen — dieser steht schon in einem anderen Feld.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG
// ═══════════════════════════════════════════════════════════════════════════
const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function begleitVertragTitel(): string {
  return "FIAON Global — Begleitvertrag: US-Gesellschaft und Kapital";
}
export function begleitVertragUnterzeile(d: Pick<BegleitDaten, "ref" | "fassung" | "gueltigBis">): string {
  return `${BEGLEIT_MARKE} · Vertragsfassung ${d.fassung} · Angebot ${d.ref} · gültig bis ${begleitTag(d.gueltigBis)}`;
}
function bisherSatz(par: BegleitParameter): string {
  const posten = par.bisher.map((x) => `${x.titel} (${x.betrag})`);
  return posten.length ? ` Bezahlt sind bereits: ${posten.join("; ")}.` : "";
}
export function begleitPraeambel(d: BegleitDaten): string[] {
  const par = d.parameter;
  return [
    `Der Auftraggeber ist Kunde von FIAON aus dem früheren Konzept „${par.bisherMitgliedschaft}“ mit monatlichem Beitrag.${bisherSatz(par)}`,
    `Mit diesem Vertrag wechselt der Auftraggeber zu FIAON Global: FIAON gründet für ihn eine US-Gesellschaft und begleitet diese Gesellschaft auf dem Weg zu Kapital über insgesamt ${begleitUsd(par.kapitalUsd)}. Als Bestandskunde zahlt der Auftraggeber dafür keinen Beitrag und keine Grundvergütung mehr: Die Gründung erfolgt zum Selbstkostenpreis, und FIAON erhält ein Erfolgshonorar nur auf Kapital, das die Gesellschaft tatsächlich erhält.`,
  ];
}
export function begleitZiffern(d: BegleitDaten): AngebotZiffer[] {
  const par = d.parameter;
  const J = GLOBAL_JAHRESBETREUUNG.de;
  const hz = zahlwort(par.honorarZielTage);
  const beispiel = begleitHonorarUsd(par.kapitalUsd, par.honorarProzent);
  return [
    { nr: 1, titel: "Vertragsparteien und Gegenstand", absaetze: [
      p(`Vertragsparteien sind die ${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land} (nachfolgend „FIAON“), und ${begleitKundeName(d.kunde)}, ${anschrift(d.kunde)} (nachfolgend „Auftraggeber“).`),
      p(`Gegenstand ist die Gründung einer US-Gesellschaft für den Auftraggeber (Ziffer 3) und die Begleitung dieser Gesellschaft auf dem Weg zu Kapital (Ziffer 5). Die Gesellschaft gehört allein dem Auftraggeber; FIAON erwirbt an ihr keine Anteile.`),
    ] },
    { nr: 2, titel: "Ende der bisherigen Mitgliedschaft", absaetze: [
      p(`Die bisherige Mitgliedschaft des Auftraggebers („${par.bisherMitgliedschaft}“) endet mit dem Abschluss dieses Vertrags. Ab diesem Tag schuldet der Auftraggeber FIAON keine Monatsbeiträge mehr${par.entfaelltAb ? `; der Beitrag zum ${begleitTag(par.entfaelltAb)}${par.entfaelltBetrag ? ` über ${par.entfaelltBetrag}` : ""} und alle folgenden Beiträge entfallen` : ""}. FIAON storniert die entsprechenden Rechnungen und zieht nichts mehr ein.`),
      p("Bereits gezahlte Beträge bleiben Gegenleistung für die bis dahin erbrachten Leistungen. Weitere Forderungen von FIAON aus der bisherigen Mitgliedschaft bestehen nicht."),
    ] },
    { nr: 3, titel: "Gründung der US-Gesellschaft", absaetze: [
      p(`FIAON gründet für den Auftraggeber eine Limited Liability Company (LLC) nach dem Recht des Bundesstaats ${par.bundesstaat} mit dem Auftraggeber als einzigem Gesellschafter. Den Namen bestimmt der Auftraggeber bei der Annahme (Annahmevermerk): FIAON prüft die Verfügbarkeit im Register des Bundesstaats und meldet die Gesellschaft unter dem Wunschnamen an; ist er nicht verfügbar, unter dem ersten verfügbaren Ausweichnamen. Ist keiner verfügbar, stimmt FIAON einen neuen Namen mit dem Auftraggeber in Textform ab.`),
      liste([
        "Anmeldung der Gesellschaft beim Bundesstaat (Articles of Organization) und Operating Agreement",
        "Registered Agent und US-Geschäftsadresse für das erste Jahr",
        "Beantragung der US-Steuernummer der Gesellschaft (EIN) bei der US-Steuerbehörde",
        "Vorbereitung und Begleitung der Eröffnung eines US-Geschäftskontos der Gesellschaft",
        "die Gründungsunterlagen in digitaler Form und ein Pflichtenkalender für das erste Jahr",
      ], "Die Gründung umfasst:"),
      p("Die Mitwirkung des Auftraggebers beschränkt sich darauf, seinen gültigen Reisepass und, soweit verlangt, einen Adressnachweis bereitzustellen, wahre und vollständige Angaben zu machen und die von FIAON vorbereiteten Unterlagen nach Prüfung zu unterschreiben. FIAON reicht die Anmeldung binnen fünf Werktagen ein, nachdem diese Unterlagen vorliegen."),
    ] },
    { nr: 4, titel: "Gründungskosten zum Selbstkostenpreis", absaetze: [
      p(`Für die Gründung zahlt der Auftraggeber allein die Kosten, die FIAON dafür an Dritte zahlt (Gebühren des Bundesstaats, Registered Agent und Geschäftsadresse für das erste Jahr, Kosten der EIN-Beantragung und der Unterlagen) — ohne Aufschlag und ohne Vergütung für FIAON. Nach dem heutigen Stand betragen sie insgesamt zwischen ${begleitEur(par.gruendungVonCents)} und ${begleitEur(par.gruendungBisCents)}.`),
      p(`Der Höchstbetrag ist ${begleitEur(par.gruendungBisCents)}. Höhere Kosten berechnet FIAON nur, wenn der Auftraggeber ihnen vorher in Textform zugestimmt hat.`),
      p(`FIAON berechnet die Gründungskosten mit einer gesonderten Rechnung mit Aufstellung der einzelnen Kosten, sobald die Anmeldung eingereicht ist. Die Rechnung ist binnen ${zahlwort(par.zahlungszielTage)} Tagen per Überweisung zu zahlen; eine Lastschrift erfolgt nicht. Die genannten Beträge sind Endbeträge.`),
    ] },
    { nr: 5, titel: "Kapital-Begleitung", absaetze: [
      p(`FIAON begleitet die Gesellschaft ab ihrer Eintragung ${monateWort(par.begleitMonate)} lang auf dem Weg zu Kapital über insgesamt ${begleitUsd(par.kapitalUsd)}. Der Weg verläuft in Stufen: zuerst Business-Kreditkarten der Gesellschaft mit kleineren Rahmen, dann weitere Karten und Kreditlinien, dann größere Finanzierungen — jeweils, sobald die Gesellschaft die Voraussetzungen der Institute erfüllt.`),
      liste([
        "Aufbau der Kreditwürdigkeit der Gesellschaft in den USA und ein Plan, welcher Antrag wann sinnvoll ist",
        "Auswahl geeigneter Institute und Produkte für die jeweilige Stufe",
        "vollständige Vorbereitung jedes Antrags mit den nötigen Unterlagen",
        "Begleitung bei Rückfragen der Institute bis zur Entscheidung",
        "ein fester Ansprechpartner bei FIAON für die gesamte Begleitzeit",
      ], "Die Begleitung umfasst:"),
      p("Für die Begleitung zahlt der Auftraggeber keine Grundvergütung und keinen Monatsbeitrag. FIAON erhält allein das Erfolgshonorar nach Ziffer 7."),
    ] },
    { nr: 6, titel: "Entscheidung der Institute", absaetze: [
      p(`FIAON schuldet die sorgfältige Begleitung nach Ziffer 5, nicht einen bestimmten Finanzierungserfolg. Über jede Karte, jede Kreditlinie und jede Finanzierung, ihren Rahmen und ihre Bedingungen entscheidet allein das jeweilige Institut. Der Betrag von ${begleitUsd(par.kapitalUsd)} ist der gemeinsame Plan der Parteien, keine Zusage von FIAON.`),
      p("Ob die Gesellschaft ein Angebot eines Instituts annimmt, entscheidet allein der Auftraggeber. Verlangt ein Institut eine Erklärung des Auftraggebers selbst — etwa die bei US-Firmenkarten übliche persönliche Haftung des Inhabers —, nennt FIAON das vor dem Antrag; ob er unterschreibt, entscheidet der Auftraggeber frei."),
    ] },
    { nr: 7, titel: "Erfolgshonorar", absaetze: [
      p(`Für jede Finanzierung, die der Gesellschaft während der Begleitzeit eingeräumt wird, erhält FIAON ein Erfolgshonorar von ${begleitProzent(par.honorarProzent)}. Maßgeblich ist bei Darlehen der zugesagte Betrag, bei Kreditkarten und Kreditlinien der eingeräumte Rahmen, bei einer Erhöhung der Betrag der Erhöhung. Beispiel: Erhält die Gesellschaft insgesamt ${begleitUsd(par.kapitalUsd)}, beträgt das Erfolgshonorar insgesamt ${begleitUsd(beispiel)}.`),
      p(`Das Erfolgshonorar fällt nur an für Finanzierungen, deren Antrag FIAON vorbereitet oder begleitet hat oder die bei einem Institut beantragt wurden, das FIAON dem Auftraggeber für die Gesellschaft genannt hat. Für Finanzierungen, die der Auftraggeber ohne FIAON erhält, fällt kein Erfolgshonorar an. Wird ein solcher Antrag aus der Begleitzeit erst danach eingeräumt, gilt Satz 1 noch, wenn die Einräumung binnen ${zahlwort(par.nachlaufMonate)} Monaten nach dem Ende der Begleitzeit erfolgt.`),
      p(`Das Erfolgshonorar wird binnen ${hz} Tagen nach der Einräumung fällig, damit die Gesellschaft es aus dem erhaltenen Kapital zahlen kann. FIAON berechnet es in Euro zum Referenzkurs der Europäischen Zentralbank am Tag der Einräumung; die Beträge sind Endbeträge. Schuldner ist der Auftraggeber; die Gesellschaft kann für ihn zahlen.`),
      p(`Der Auftraggeber teilt FIAON jede Einräumung binnen ${zahlwort(14)} Tagen in Textform mit, mit einem Beleg über Betrag oder Rahmen. Lehnt die Gesellschaft ein Angebot ab oder nimmt sie es nicht an, fällt kein Erfolgshonorar an.`),
    ] },
    { nr: 8, titel: "Jahresbetreuung ab dem zweiten Jahr (wahlweise)", absaetze: [
      p(`Hat der Auftraggeber bei der Annahme die Jahresbetreuung gewählt (Annahmevermerk), gilt: ${J.vertrag} ${J.vertragBedingungen}`),
      p("Hat der Auftraggeber die Jahresbetreuung nicht gewählt, trägt er die laufenden Kosten der Gesellschaft ab dem zweiten Jahr selbst (Staatsgebühr, Registered Agent, jährliche US-Meldung). Er kann die Jahresbetreuung später jederzeit in Textform dazubuchen."),
    ] },
    { nr: 9, titel: "Pflichthinweise und Angaben", absaetze: [
      liste([...ANGEBOT_PFLICHTHINWEIS, "Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut."], "Der Auftraggeber nimmt die folgenden Hinweise zur Kenntnis:"),
      p("Anträge bei Behörden und Instituten stellen der Auftraggeber bzw. die Gesellschaft im eigenen Namen; FIAON bereitet sie vor. Alle Angaben gegenüber Instituten und Behörden müssen wahr und vollständig sein; FIAON reicht keine Unterlagen ein, deren Angaben es für unzutreffend hält."),
      p("Vor Beginn identifiziert FIAON den Auftraggeber anhand eines gültigen Reisepasses und gleicht Name und Geburtsdatum mit den Sanktionslisten ab. Der Auftraggeber erklärt, dass weder er selbst noch ein Familienmitglied oder eine ihm bekanntermaßen nahestehende Person ein wichtiges öffentliches Amt ausübt oder in den letzten zwölf Monaten ausgeübt hat (§ 1 Abs. 12 bis 14 GwG); trifft das nicht zu, teilt er es FIAON vor der Annahme in Textform mit."),
    ] },
    { nr: 10, titel: "Laufzeit und Ende", absaetze: [
      p(`Der Vertrag beginnt mit der Annahme. Die Kapital-Begleitung endet ${monateWort(par.begleitMonate)} nach der Eintragung der Gesellschaft oder früher, sobald die Gesellschaft Finanzierungen über insgesamt ${begleitUsd(par.kapitalUsd)} erhalten hat. Der Vertrag verlängert sich nicht von selbst.`),
      p("Der Auftraggeber kann den Vertrag jederzeit in Textform beenden. Bereits entstandene Gründungskosten (Ziffer 4) und das Erfolgshonorar für Finanzierungen, die bis dahin eingeräumt wurden oder deren Antrag bis dahin gestellt war (Ziffer 7 Absatz 2 Satz 3), bleiben geschuldet."),
      p("FIAON kann den Vertrag nur aus wichtigem Grund beenden, insbesondere wenn der Auftraggeber vorsätzlich falsche Angaben macht oder wenn der Auftraggeber oder die Gesellschaft auf einer Sanktionsliste der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs oder der USA geführt wird."),
    ] },
    { nr: 11, titel: "Widerrufsrecht", absaetze: [
      p("Handelt der Auftraggeber als Verbraucher (§ 13 BGB), kann er diesen Vertrag binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in der Anlage widerrufen; die Anlage enthält auch das Muster-Widerrufsformular."),
      p("Hat der Auftraggeber bei der Annahme ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt (Annahmevermerk), beginnt FIAON sofort. Ihm ist dann bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt — bei der Gründung die bereits an Dritte gezahlten Kosten — und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat. Andernfalls beginnt FIAON nach Ablauf der Widerrufsfrist."),
    ] },
    { nr: 12, titel: "Haftung", absaetze: [
      p("FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Für Entscheidungen der Institute und Behörden haftet FIAON nicht."),
    ] },
    { nr: 13, titel: "Vertraulichkeit und Datenschutz", absaetze: [
      p("Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags. FIAON gibt Unterlagen nur weiter, soweit es die Leistung erfordert: an Behörden, an den Registered Agent, an den US-CPA aus dem Partnernetz von FIAON und an Institute, bei denen die Gesellschaft einen Antrag stellt."),
      p("FIAON verarbeitet personenbezogene Daten des Auftraggebers, um diesen Vertrag zu erfüllen (Art. 6 Abs. 1 Buchst. b DSGVO), und nach der Datenschutzerklärung unter fiaon.com/datenschutz. Für Gründung und Anträge gehen Daten in die USA; für Empfänger ohne Zertifizierung nach dem EU-U.S. Data Privacy Framework stützt sich die Übermittlung darauf, dass sie für die Erfüllung dieses Vertrags erforderlich ist (Art. 49 Abs. 1 Buchst. b DSGVO). Der Auftraggeber kann Auskunft, Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit verlangen und sich bei einer Aufsichtsbehörde beschweren."),
    ] },
    { nr: 14, titel: "Schlussbestimmungen", absaetze: [
      p("Dieser Vertrag ist eine Individualvereinbarung; Allgemeine Geschäftsbedingungen von FIAON gelten für ihn nicht. Beigefügt ist die Anlage (Widerrufsbelehrung und Muster-Widerrufsformular)."),
      p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der Auftraggeber Verbraucher, gilt diese Rechtswahl nur, soweit ihm dadurch nicht der Schutz entzogen wird, den ihm die zwingenden Bestimmungen des Rechts des Staates seines gewöhnlichen Aufenthalts gewähren. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
    ] },
  ];
}

// ── HTML des Vertrags ───────────────────────────────────────────────────────
export function escHtml(v: unknown): string {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
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
function unterschriftHtml(u: BegleitUnterschriftVermerk): string {
  const m = String(u.png ?? "").match(/^data:image\/png;base64,([A-Za-z0-9+/=]{100,})$/);
  const art = u.art === "gezeichnet" ? "von Hand gezeichnet" : `Name getippt: ${escHtml(u.name ?? "")}`;
  const zeichen = m
    ? `<img class="gv-unterschrift-bild" src="data:image/png;base64,${m[1]}" alt="Unterschrift" style="display:block;max-width:240px;max-height:80px;margin:4px 0 2px" />`
    : `<span class="gv-unterschrift-getippt" style="display:block;font-family:'Mrs Saint Delafield','Snell Roundhand','Apple Chancery','Dancing Script',cursive;font-size:30px;line-height:1.1;color:#1b3866;margin:4px 0 2px">${escHtml(u.name ?? "")}</span>`;
  return `${zeichen}<span class="gv-leise" style="font-size:8pt">Unterschrift (${art})</span>`;
}
function annahmeBlock(d: BegleitDaten, a: BegleitAnnahmeVermerk | null): string {
  const name = begleitKundeName(d.kunde);
  if (!a) {
    return `
  <div class="gv-unterschriften">
    <div class="sig-col"><div class="gv-sig-kopf">Für FIAON</div><div class="gv-sig-feld"><span class="gv-leise">Angebot der ${escHtml(FIAON_FIRMA.name)}, vertreten durch ${escHtml(FIAON_FIRMA.director)}, Director</span></div><div class="sig-line">${escHtml(FIAON_FIRMA.name)}</div></div>
    <div class="sig-col"><div class="gv-sig-kopf">Für den Auftraggeber</div><div class="gv-sig-feld"><span class="gv-leise">Annahme mit dem Knopf „${escHtml(BEGLEIT_KNOPF)}“ — Name der Gesellschaft, Wahl zum Beginn und zur Jahresbetreuung stehen dann hier im Annahmevermerk.</span></div><div class="sig-line">${escHtml(name)}</div></div>
  </div>`;
  }
  const w = a.wahl;
  const namen = [w.llc.wunsch, w.llc.alternative1, w.llc.alternative2].filter(Boolean);
  return `
  <div class="gv-unterschriften">
    <div class="sig-col"><div class="gv-sig-kopf">Für FIAON</div><div class="gv-sig-feld"><span class="gv-leise">Angebot der ${escHtml(FIAON_FIRMA.name)}, vertreten durch ${escHtml(FIAON_FIRMA.director)}, Director</span></div><div class="sig-line">${escHtml(FIAON_FIRMA.name)}</div></div>
    <div class="sig-col"><div class="gv-sig-kopf">Für den Auftraggeber</div><div class="gv-sig-feld">${unterschriftHtml(a.unterschrift)}</div><div class="sig-line">${escHtml(name)}, ${escHtml(d.kunde.ort)}, ${escHtml(a.am.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }))}</div></div>
  </div>
  <div class="gv-annahme">
    <h3>Annahmevermerk</h3>
    <p>Angenommen am ${escHtml(zeitText(a.am))} mit dem Knopf „${escHtml(BEGLEIT_KNOPF)}“.</p>
    <ul>
      <li>Name der Gesellschaft (Ziffer 3): Wunschname <strong>${escHtml(w.llc.wunsch)}</strong>${namen.length > 1 ? `; Ausweichnamen in dieser Reihenfolge: ${namen.slice(1).map(escHtml).join("; ")}` : "; keine Ausweichnamen"}</li>
      <li>Beginn (Ziffer 11): ${w.sofortBeginn ? "Der Auftraggeber hat ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt." : "Der Auftraggeber hat keinen Beginn vor Ablauf der Widerrufsfrist verlangt; FIAON beginnt nach ihrem Ablauf."}</li>
      <li>Jahresbetreuung ab dem zweiten Jahr (Ziffer 8): ${w.jahresbetreuung ? `gewählt — ${escHtml(GLOBAL_JAHRESBETREUUNG.de.gebucht)}` : "nicht gewählt"}</li>
    </ul>
    <p class="gv-leise">IP-Adresse ${escHtml(a.ip)} · Prüfsumme des Vertragstextes (SHA-256): <span class="hash">${escHtml(a.hash)}</span></p>
  </div>`;
}
function anlageHtml(): string {
  const b = globalWiderrufsbelehrung("de");
  const zeile = (text: string) => `<li><span>${escHtml(text)}</span><i aria-hidden="true"></i></li>`;
  return `
  <section class="gv-anlage" id="anlage" lang="de">
    <h2>Anlage — Widerrufsbelehrung</h2>
    <p class="gv-leise">${escHtml(b.gilt)}</p>
    ${b.abschnitte.map((x) => `<h3>${escHtml(x.h)}</h3>\n    ${x.absaetze.map((t) => `<p>${escHtml(t)}</p>`).join("\n    ")}`).join("\n    ")}
    <div class="gv-formular">
      <h3>${escHtml(b.formular.titel)}</h3>
      <p class="gv-leise">${escHtml(b.formular.hinweis)}</p>
      <ul>
        <li><span>${escHtml(b.formular.an)}</span></li>
        ${b.formular.zeilen.map(zeile).join("\n        ")}
      </ul>
      <p class="gv-leise">${escHtml(b.formular.fuss)}</p>
    </div>
  </section>`;
}
/** Der Rumpf: Präambel, vierzehn Ziffern, Annahmeblock, Anlage. Die Prüfsumme läuft über den Rumpf OHNE Vermerk. */
export function begleitRumpfHtml(d: BegleitDaten, annahme: BegleitAnnahmeVermerk | null = null): string {
  const ziffern = ziffernHtml(begleitZiffern(d)).split("\n");
  const letzte = ziffern.pop() ?? "";
  return `<div class="gv" lang="de"><section class="gia-praeambel" id="praeambel"><h2>Präambel</h2>${begleitPraeambel(d).map((x) => `<p>${escHtml(x)}</p>`).join("")}</section>
${ziffern.join("\n")}
<div class="gv-schluss">${letzte}${annahmeBlock(d, annahme)}</div>
${anlageHtml()}</div>`;
}
export function begleitHashEingabe(d: Pick<BegleitDaten, "ref" | "fassung">, rumpfOhneAnnahme: string): string {
  return `global-angebot-begleit|${d.ref}|${d.fassung}|${rumpfOhneAnnahme}`;
}
export function begleitVertragInhalt(d: BegleitDaten): { anker: string; marke: string; titel: string }[] {
  return [
    { anker: "praeambel", marke: "", titel: "Präambel" },
    ...begleitZiffern(d).map((z) => ({ anker: `ziffer-${z.nr}`, marke: String(z.nr), titel: z.titel })),
    { anker: "anlage", marke: "Anlage", titel: "Widerrufsbelehrung" },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE
// ═══════════════════════════════════════════════════════════════════════════
export interface BegleitVergleichZeile { titel: string; vorher: string; jetzt: string; fein?: string }
export interface BegleitSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  hero: { auge: string; titel: string; lead: string; nutzen: string[]; kapital: string; kapitalSatz: string; staat: string };
  llc: typeof BEGLEIT_LLC_TEXTE;
  vergleich: { titel: string; sub: string; vorherKopf: string; jetztKopf: string; zeilen: BegleitVergleichZeile[]; fein: string; erledigtTitel: string; erledigt: BegleitBisherPosten[] };
  rechner: { titel: string; sub: string; prozent: number; minUsd: number; maxUsd: number; schrittUsd: number; startUsd: number; kapital: string; honorar: string; bleibt: string; fein: string };
  phasen: { titel: string; sub: string; liste: FirmaPhase[] };
  leistungen: { titel: string; sub: string; karten: FirmaLeistung[] };
  jahresbetreuung: { titel: string; preis: string; lead: string; punkte: string[]; fein: string };
  fragen: { titel: string; sub: string; liste: FirmaFrage[]; sichtbar: number };
  ansprechpartner: { titel: string; sub: string };
  vertrag: { titel: string; sub: string; dokument: string; unterzeile: string; inhalt: { anker: string; marke: string; titel: string }[] };
  pflicht: string[];
}
export function begleitSeite(d: BegleitDaten): BegleitSeite {
  const par = d.parameter; const k = d.kunde; const J = GLOBAL_JAHRESBETREUUNG.de;
  const gruss = begleitKundeGruss(k);
  const spanne = `${begleitEur(par.gruendungVonCents)} bis ${begleitEur(par.gruendungBisCents)}`;
  const karten = `${begleitUsd(par.ersteKartenVonUsd)} und ${begleitUsd(par.ersteKartenBisUsd)}`;
  return {
    auftakt: {
      auge: "FIAON Global · Persönlich für Sie",
      gruss: `Herzlichen Glückwunsch, ${gruss}.`,
      zeile: "Ihre US-Gesellschaft ist startklar — und ab heute zahlen Sie kein Abo mehr.",
      weiter: "Weiter",
    },
    hero: {
      auge: `${par.bisherMitgliedschaft} → FIAON Global`,
      titel: "Ihre eigene US-Gesellschaft. Ihr Weg zu Kapital. Kein Abo mehr.",
      lead: `Als Bestandskunde wechseln Sie zu besonderen Konditionen: Wir gründen Ihre LLC in ${par.bundesstaat} zum Selbstkostenpreis und begleiten sie Stufe für Stufe — und wir verdienen erst, wenn bei Ihrer Gesellschaft Kapital ankommt.`,
      nutzen: ["Kein Monatsbeitrag mehr — ab heute", "Gründung zum Selbstkostenpreis, ohne Aufschlag", "Unser Honorar nur, wenn Kapital ankommt"],
      kapital: begleitUsd(par.kapitalUsd),
      kapitalSatz: "Unser gemeinsamer Plan für Ihre Gesellschaft — Stufe für Stufe, mit einem festen Ansprechpartner.",
      staat: `State of ${par.bundesstaat}`,
    },
    llc: BEGLEIT_LLC_TEXTE,
    vergleich: {
      titel: "Was sich für Sie ändert",
      sub: "Bisher ein Monatsbeitrag — jetzt zahlen Sie nur noch für das, was wirklich ankommt.",
      vorherKopf: "Bisher",
      jetztKopf: "Ab heute",
      zeilen: [
        { titel: "Monatsbeitrag", vorher: par.entfaelltBetrag ? `${par.entfaelltBetrag} im Monat` : "monatlich", jetzt: "0 €", fein: par.entfaelltAb ? `Der Beitrag zum ${begleitTag(par.entfaelltAb)} entfällt — wir stornieren ihn.` : "Alle weiteren Beiträge entfallen." },
        { titel: "Kapital-Begleitung", vorher: "—", jetzt: `${begleitProzent(par.honorarProzent)} vom Erfolg`, fein: "Keine Grundgebühr. Fällig erst, wenn eine Finanzierung eingeräumt ist — zahlbar aus dem Kapital." },
      ],
      // Justin 08.10.2026: die Gründungskosten nicht so präsent — keine eigene Zeile, nur ein ruhiger Satz (Pflichtangaben in Übersicht und Vertrag).
      fein: "Die Gründung Ihrer LLC berechnen wir einmalig zum Selbstkostenpreis, ohne Aufschlag — Einzelheiten im Vertrag.",
      erledigtTitel: "Bereits erledigt",
      erledigt: par.bisher,
    },
    rechner: {
      titel: "Wir gewinnen nur, wenn Sie gewinnen",
      sub: "Schieben Sie den Regler: So viel Kapital erhält Ihre Gesellschaft — so viel bleibt bei Ihnen.",
      prozent: par.honorarProzent,
      minUsd: 25_000, maxUsd: par.kapitalUsd, schrittUsd: 5_000, startUsd: par.kapitalUsd,
      kapital: "Kapital für Ihre Gesellschaft", honorar: `Unser Erfolgshonorar (${begleitProzent(par.honorarProzent)})`, bleibt: "Bleibt bei Ihnen",
      fein: "Rechenbeispiel. Über jede Finanzierung und ihren Rahmen entscheidet allein das jeweilige Institut.",
    },
    phasen: {
      titel: "Ihr Weg",
      sub: `In fünf Etappen zu ${begleitUsd(par.kapitalUsd)} für Ihre Gesellschaft.`,
      liste: [
        { nr: 1, titel: "Ihre LLC entsteht", dauer: "Woche eins bis zwei", text: `Anmeldung in ${par.bundesstaat} unter Ihrem Wunschnamen, Registered Agent, US-Adresse und Steuernummer (EIN).` },
        { nr: 2, titel: "Geschäftskonto", dauer: "Woche zwei bis vier", text: "Wir bereiten die Eröffnung Ihres US-Geschäftskontos vor und begleiten sie." },
        { nr: 3, titel: "Erste Business-Karten", dauer: "ab Monat zwei", text: `Zum Start kleinere Rahmen — erfahrungsgemäß zwischen ${karten} je Karte.` },
        { nr: 4, titel: "Weitere Karten und Kreditlinien", dauer: "ab Monat vier", text: "Mit wachsender Kredithistorie Ihrer Gesellschaft folgen höhere Rahmen und erste Kreditlinien." },
        { nr: 5, titel: "Größere Finanzierungen", dauer: "im Verlauf der Begleitung", text: `Schritt für Schritt zum Gesamtrahmen von ${begleitUsd(par.kapitalUsd)} — jeder Antrag vollständig vorbereitet.`, abzeichen: begleitUsd(par.kapitalUsd) },
      ],
    },
    leistungen: {
      titel: "Was Sie bekommen",
      sub: "Alles aus einer Hand — Sie unterschreiben, den Rest erledigen wir.",
      karten: [
        { schluessel: "gesellschaft", titel: "Ihre US-Gesellschaft", text: `Eine LLC in ${par.bundesstaat} — Ihnen gehören hundert Prozent.`, punkte: ["Anmeldung unter Ihrem Wunschnamen", "Registered Agent und US-Adresse im ersten Jahr", "US-Steuernummer (EIN) und Operating Agreement"], mehr: ["Gründungsunterlagen digital", "Pflichtenkalender für das erste Jahr", "Begleitung bei der Eröffnung des Geschäftskontos"] },
        { schluessel: "kapital", titel: "Kapital-Begleitung", text: `${gross(monateWort(par.begleitMonate))} lang auf dem Weg zu ${begleitUsd(par.kapitalUsd)}.`, punkte: ["Plan, welcher Antrag wann sinnvoll ist", "Auswahl passender Institute je Stufe", "Jeder Antrag vollständig vorbereitet"], mehr: ["Aufbau der US-Kredithistorie Ihrer Gesellschaft", "Begleitung bei Rückfragen bis zur Entscheidung"] },
        { schluessel: "ansprechpartner", titel: "Ein fester Ansprechpartner", text: "Ein Mensch, der Ihren Weg kennt — von der Gründung bis zur letzten Stufe.", punkte: ["Direkt per E-Mail und Telefon", "Regelmäßiger Stand Ihrer Anträge", "Persönliches Startgespräch"] },
      ],
    },
    jahresbetreuung: {
      titel: J.titel,
      preis: `${J.marke}: ${J.preisZeile}`,
      lead: "Damit Ihre Gesellschaft auch ab dem zweiten Jahr ohne Aufwand läuft — freiwillig, Sie wählen es unten bei der Annahme.",
      punkte: [...J.leistungen],
      fein: J.bedingungen,
    },
    fragen: {
      titel: "Fragen & Antworten",
      sub: "Kurz und ehrlich.",
      sichtbar: 6,
      liste: [
        { frage: "Zahle ich wirklich kein Abo mehr?", antwort: [`Ja. Ihre Mitgliedschaft endet mit der Annahme${par.entfaelltAb ? `, der Beitrag zum ${begleitTag(par.entfaelltAb)} entfällt` : ""}. Es kommen keine Monatsbeiträge mehr.`] },
        { frage: "Was kostet die Gründung genau?", antwort: [`Nur das, was wir an Dritte zahlen — insgesamt ${spanne}, höchstens ${begleitEur(par.gruendungBisCents)}. Sie bekommen eine Rechnung mit Aufstellung, sobald die Anmeldung eingereicht ist.`] },
        { frage: "Wann verdient FIAON an mir?", antwort: [`Erst, wenn Ihre Gesellschaft eine Finanzierung erhält: ${begleitProzent(par.honorarProzent)} davon, fällig ${zahlwort(par.honorarZielTage)} Tage nach der Einräumung. Kommt nichts an, zahlen Sie uns nichts.`] },
        { frage: "Wie schnell steht meine Gesellschaft?", antwort: ["Sobald Ihr Reisepass vorliegt, reichen wir die Anmeldung binnen fünf Werktagen ein. Florida trägt in der Regel innerhalb weniger Tage ein."] },
        { frage: "Was, wenn mein Wunschname vergeben ist?", antwort: ["Dann nehmen wir Ihren ersten freien Ausweichnamen. Haben Sie keinen angegeben oder ist keiner frei, stimmen wir uns kurz mit Ihnen ab."] },
        { frage: "Muss ich persönlich haften?", antwort: ["Bei US-Firmenkarten verlangen Institute in der Regel die persönliche Haftung des Inhabers. Wir sagen es Ihnen vor jedem Antrag — Sie entscheiden frei."] },
        { frage: "Wie verlässlich ist der Plan?", antwort: [`Die ${begleitUsd(par.kapitalUsd)} sind unser gemeinsamer Plan. Über jede Karte und jeden Rahmen entscheidet das jeweilige Institut — wir sorgen dafür, dass jeder Antrag vollständig und zur richtigen Zeit kommt.`] },
        { frage: "Was muss ich beim Finanzamt beachten?", antwort: ["Eine US-Gesellschaft, die Sie aus Deutschland führen, bleibt in Deutschland steuerpflichtig; die Gründung ist dem Finanzamt zu melden (§ 138 AO). Wir sagen Ihnen, was dafür nötig ist."] },
        { frage: "Kann ich den Vertrag beenden?", antwort: ["Jederzeit in Textform. Geschuldet bleiben nur die Gründungskosten und das Honorar für Finanzierungen, die bis dahin beantragt oder eingeräumt waren."] },
      ],
    },
    ansprechpartner: { titel: "Ihre Ansprechpartner", sub: "Sie erreichen uns direkt — vor der Annahme bei jeder Frage zum Vertrag und danach bei jedem Schritt." },
    vertrag: {
      titel: "Ihr Vertrag",
      sub: "Vierzehn kurze Ziffern und die Widerrufsbelehrung — derselbe Text wie im PDF.",
      dokument: begleitVertragTitel(),
      unterzeile: begleitVertragUnterzeile(d),
      inhalt: begleitVertragInhalt(d),
    },
    pflicht: [...ANGEBOT_PFLICHTHINWEIS, "Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut."],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BESTELLÜBERSICHT UND ANNAHME (unmittelbar über dem Knopf, § 312j Abs. 2 BGB)
// ═══════════════════════════════════════════════════════════════════════════
export function begleitBestellUebersicht(d: BegleitDaten): { titel: string; zeilen: { label: string; wert: string }[] } {
  const par = d.parameter; const k = d.kunde;
  return {
    titel: "Ihr Auftrag im Überblick",
    zeilen: [
      { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}` },
      { label: "Auftraggeber", wert: `${begleitKundeName(k)}, ${anschrift(k)}` },
      { label: "Leistung", wert: `Gründung einer LLC in ${par.bundesstaat} unter Ihrem Wunschnamen und Kapital-Begleitung der Gesellschaft für ${monateWort(par.begleitMonate)} ab Eintragung (Plan: ${begleitUsd(par.kapitalUsd)})` },
      { label: "Bisherige Mitgliedschaft", wert: `endet mit der Annahme — keine Monatsbeiträge mehr${par.entfaelltAb ? ` (der Beitrag zum ${begleitTag(par.entfaelltAb)} entfällt)` : ""}` },
      { label: "Gründungskosten", wert: `zum Selbstkostenpreis, insgesamt ${begleitEur(par.gruendungVonCents)} bis ${begleitEur(par.gruendungBisCents)}, höchstens ${begleitEur(par.gruendungBisCents)} — gesonderte Rechnung nach Einreichung der Anmeldung, zahlbar binnen ${zahlwort(par.zahlungszielTage)} Tagen` },
      { label: "Erfolgshonorar", wert: `${begleitProzent(par.honorarProzent)} jeder Finanzierung, die die Gesellschaft durch die Begleitung erhält — fällig ${zahlwort(par.honorarZielTage)} Tage nach der Einräumung` },
      { label: "Jahresbetreuung", wert: `freiwillig, ab dem zweiten Jahr ${GLOBAL_JAHRESBETREUUNG.de.preisZeile} — nur mit Ihrem Haken unten` },
      { label: "Zahlung", wert: "Überweisung auf Rechnung — keine Lastschrift" },
      { label: "Widerruf", wert: "Als Verbraucher vierzehn Tage Widerrufsrecht (Belehrung in der Anlage)" },
    ],
  };
}
export interface BegleitAnnahmeTexte {
  titel: string; sub: string;
  sofortBeginn: string; sofortBeginnUnter: string;
  jahresbetreuung: string; jahresbetreuungUnter: string;
  gelesen: string;
  unterschrift: FirmaAnnahmeTexte["unterschrift"];
  knopf: string; unterKnopf: string; gesperrt: string;
}
export function begleitAnnahmeTexte(d: BegleitDaten): BegleitAnnahmeTexte {
  const par = d.parameter; const name = begleitKundeName(d.kunde);
  return {
    titel: "Auftrag erteilen",
    sub: "Name Ihrer Gesellschaft prüfen, zwei freiwillige Häkchen, unterschreiben — fertig.",
    sofortBeginn: ANGEBOT_ANNAHME.sofortBeginn,
    sofortBeginnUnter: "Freiwillig. Damit Ihre Gesellschaft sofort entsteht. Ohne diesen Haken beginnen wir nach Ablauf der vierzehntägigen Widerrufsfrist.",
    jahresbetreuung: GLOBAL_JAHRESBETREUUNG.de.buchen,
    jahresbetreuungUnter: "Freiwillig. Heute wird dafür nichts fällig — die erste Jahresrechnung kommt erst zum zweiten Jahr.",
    gelesen: "Ich habe den Vertrag mit der Widerrufsbelehrung gelesen.",
    unterschrift: {
      titel: "Ihre Unterschrift",
      sub: "Zeichnen Sie mit Finger oder Maus — oder tippen Sie Ihren Namen.",
      zeichnen: "Zeichnen", tippen: "Namen tippen", neu: "Neu", platz: "Hier unterschreiben",
      tippenFeld: "Ihr Name", tippenHinweis: `Vor- und Nachname, wie im Vertrag: ${name}`,
      vorschau: "So steht Ihre Unterschrift im Vertrag",
      fehlt: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
      fehltName: `Bitte tippen Sie Ihren Namen mit Nachnamen (${String(d.kunde.nachname ?? "").trim()}).`,
    },
    knopf: BEGLEIT_KNOPF,
    unterKnopf: `Mit dem Klick erteilen Sie den Auftrag. Heute wird nichts fällig: Die Gründungskosten (höchstens ${begleitEur(par.gruendungBisCents)}) berechnen wir nach Einreichung der Anmeldung, das Erfolgshonorar erst, wenn Ihre Gesellschaft eine Finanzierung erhält.`,
    gesperrt: "Dieses Angebot wird gerade vervollständigt. Ihr Ansprechpartner gibt Ihnen Bescheid, sobald Sie es annehmen können.",
  };
}
export const BEGLEIT_ANNAHME = {
  fehltGelesen: "Bitte bestätigen Sie, dass Sie den Vertrag gelesen haben.",
  fehltUnterschrift: "Bitte unterschreiben Sie — zeichnen oder Namen tippen.",
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: "Glückwunsch — Ihr Auftrag steht.",
  fertigText: (email: string, llc: string) => `Wir melden ${llc} jetzt an. Ihren Vertrag schicken wir Ihnen an ${email}; Ihr Ansprechpartner meldet sich in Kürze für die nächsten Schritte.`,
  fertigTextWartet: (email: string, llc: string) => `Wir melden ${llc} nach Ablauf der Widerrufsfrist an. Ihren Vertrag schicken wir Ihnen an ${email}; Ihr Ansprechpartner meldet sich in Kürze.`,
  fertigZahlung: "Heute ist nichts zu zahlen. Ihr Monatsbeitrag ist beendet; die Gründungskosten berechnen wir mit Aufstellung, sobald die Anmeldung eingereicht ist.",
  fertigFuss: "Für die Anmeldung brauchen wir nur noch Ihren Reisepass — Ihr Ansprechpartner sagt Ihnen, wie Sie ihn sicher hochladen. Fragen? Schreiben Sie uns an support@fiaon.com.",
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// ANSPRECHPARTNER UND PFLICHTFELDER
// ═══════════════════════════════════════════════════════════════════════════
export function begleitAnsprechpartner(par: BegleitParameter): { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[] {
  const aus = par.ansprechpartner.map((kz) => ANGEBOT_ANSPRECHPARTNER.find((x) => x.kuerzel === kz)).filter(Boolean) as { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[];
  return aus.length ? aus : ANGEBOT_ANSPRECHPARTNER.filter((x) => x.kuerzel === "justin");
}
export function begleitParameterAus(roh: Partial<BegleitParameter> | null | undefined, basis: BegleitParameter = BEGLEIT_VORGABEN): BegleitParameter {
  const r = (roh ?? {}) as Record<string, unknown>;
  const zahl = (k: keyof BegleitParameter, min: number, max: number): number => {
    const v = Number(r[k]); return Number.isFinite(v) && v >= min && v <= max ? v : (basis[k] as number);
  };
  const text = (k: keyof BegleitParameter, max: number): string => (typeof r[k] === "string" ? String(r[k]).replace(/\s+/g, " ").trim().slice(0, max) : (basis[k] as string));
  const bisher = Array.isArray(r.bisher)
    ? (r.bisher as any[]).slice(0, 6).map((x) => ({ titel: String(x?.titel ?? "").trim().slice(0, 120), betrag: String(x?.betrag ?? "").trim().slice(0, 40) })).filter((x) => x.titel && x.betrag)
    : basis.bisher;
  const ap = Array.isArray(r.ansprechpartner) ? (r.ansprechpartner as unknown[]).map(String).filter((kz) => ANGEBOT_ANSPRECHPARTNER.some((x) => x.kuerzel === kz)).slice(0, 3) : basis.ansprechpartner;
  const entfaelltAb = typeof r.entfaelltAb === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.entfaelltAb) ? r.entfaelltAb : basis.entfaelltAb;
  return {
    kapitalUsd: zahl("kapitalUsd", 10_000, 5_000_000),
    honorarProzent: zahl("honorarProzent", 0, 20),
    begleitMonate: zahl("begleitMonate", 6, 60),
    nachlaufMonate: zahl("nachlaufMonate", 0, 24),
    honorarZielTage: zahl("honorarZielTage", 7, 60),
    gruendungVonCents: zahl("gruendungVonCents", 0, 500_000),
    gruendungBisCents: zahl("gruendungBisCents", 0, 500_000),
    zahlungszielTage: zahl("zahlungszielTage", 7, 30),
    bundesstaat: text("bundesstaat", 40),
    ersteKartenVonUsd: zahl("ersteKartenVonUsd", 0, 1_000_000),
    ersteKartenBisUsd: zahl("ersteKartenBisUsd", 0, 1_000_000),
    bisherMitgliedschaft: text("bisherMitgliedschaft", 80),
    bisher,
    entfaelltAb,
    entfaelltBetrag: text("entfaelltBetrag", 40),
    ansprechpartner: ap.length ? ap : basis.ansprechpartner,
  };
}
export function begleitParameterFehler(p: BegleitParameter): string | null {
  if (p.gruendungVonCents > p.gruendungBisCents) return "Gründungskosten: der untere Wert liegt über dem Höchstbetrag.";
  if (p.ersteKartenVonUsd > p.ersteKartenBisUsd) return "Erste Karten: der untere Wert liegt über dem oberen.";
  if (!p.bundesstaat) return "Bundesstaat fehlt.";
  if (!p.honorarProzent) return "Erfolgshonorar fehlt.";
  return null;
}
export function begleitPflichtFehlen(d: Pick<BegleitDaten, "kunde" | "parameter">): string[] {
  const k = d.kunde; const fehlt: string[] = [];
  if (!k.vorname || !k.nachname) fehlt.push("Name des Kunden");
  if (!k.strasse || !k.plz || !k.ort) fehlt.push("Anschrift des Kunden");
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(k.email ?? ""))) fehlt.push("E-Mail-Adresse des Kunden");
  const pf = begleitParameterFehler(d.parameter);
  if (pf) fehlt.push(pf);
  return fehlt;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE KUNDENSICHT (GET /api/fiaon/global/angebot/:token für ein offenes Begleit-Angebot)
// ═══════════════════════════════════════════════════════════════════════════
export interface BegleitKundenSicht {
  ok: true; status: "offen"; art: "begleit";
  ref: string; fassung: string; gueltigBis: string;
  kunde: { anrede: string; vorname: string; nachname: string; email: string };
  kundeAnrede: string;
  seite: BegleitSeite;
  ansprechpartner: { kuerzel: string; name: string; rolle: string; email: string; telefon: string; portrait: string }[];
  uebersicht: { titel: string; zeilen: { label: string; wert: string }[] };
  annahme: BegleitAnnahmeTexte;
  annahmeBereit: boolean;
  gesperrtGrund: string | null;
  vorschauLeitung?: boolean;
  fehlt?: string[];
  html: string;
  textHash: string;
  vertragPdf: string;
}
