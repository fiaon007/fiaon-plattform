// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS FIRMENANGEBOT (B2B): DIE SCHNITTSTELLE ZWISCHEN SERVER UND SEITE
// Register E-301 (07.10.2026) — Ausbau des Individualangebots E-268 für Unternehmen.
//
// Diese Datei enthält NUR Typen. Sie ist der Vertrag zwischen
//   · server/lib/fiaon-global-angebot-firma.ts  (liefert FirmaKundenSicht über GET /api/fiaon/global/angebot/:token)
//   · client/src/pages/business-angebot-firma.tsx (zeigt sie an)
// Texte, Zahlen und Rechenregeln stehen in shared/fiaon-global-angebot-firma.ts — nie in der Oberfläche.
//
// DATENSCHUTZ: Das Repo ist öffentlich (E-242). Hier und im ganzen Code stehen KEINE Kundendaten.
// Kunde, Inhalte und Prüfbericht eines Firmenangebots liegen ausschließlich in der Datenbank
// (fiaon_global_angebote.kunde / .parameter / .pruefbericht) und kommen über den persönlichen Link.
// ═══════════════════════════════════════════════════════════════════════════

/** Kennung der B2B-Fassung. Ein Angebot ist ein Firmenangebot, wenn seine Fassung mit diesem Präfix beginnt. */
export const FIRMA_FASSUNG_PRAEFIX = "IA-FIRMA-";
export function istFirmenFassung(fassung: string | null | undefined): boolean {
  return String(fassung ?? "").startsWith(FIRMA_FASSUNG_PRAEFIX);
}

export type FirmaLand = "AT" | "DE" | "CH";

/** Die Vertragspartnerin: eine Gesellschaft, vertreten durch eine natürliche Person. Kein Geburtsdatum. */
export interface FirmaKunde {
  art: "firma";
  firma: {
    /** Firmenwortlaut exakt wie im Register, z. B. „… GmbH“ */
    name: string;
    /** Kurzname für Überschriften und Anrede der Marke (z. B. die Marke auf dem Etikett) */
    marke: string;
    rechtsform: string;
    registergericht: string;
    registernummer: string;
    uid: string;
    strasse: string;
    plz: string;
    ort: string;
    land: FirmaLand;
  };
  vertretung: {
    anrede: "Frau" | "Herr" | "";
    vorname: string;
    nachname: string;
    /** z. B. „Geschäftsführerin“ oder „Geschäftsführer und Gesellschafter“ */
    funktion: string;
  };
  email: string;
  telefon: string;
}

/** Ein Bild auf der Seite. KI-Bilder tragen IMMER einen sichtbaren Hinweis (Hausregel, E-293). */
export interface BildRef {
  src: string;
  /** optional: „…-960.webp 960w, …-1920.webp 1920w“ */
  srcset?: string;
  breite: number;
  hoehe: number;
  alt: string;
  ki: boolean;
  /** Hinweistext, z. B. „Szene mit KI erstellt“ — Pflicht, wenn ki = true */
  hinweis?: string;
}

/** Das 3D-Glas im Hero (three.js). Fällt bei fehlendem WebGL oder „weniger Bewegung“ auf `foto` zurück. */
export interface GlasKonfig {
  /** Etikett als Bild (echtes Foto des Etiketts, flach), Seitenverhältnis Breite/Höhe */
  etikett: string;
  etikettVerhaeltnis: number;
  deckel: "silber" | "gold" | "schwarz";
  /** Farbe des Inhalts, z. B. „#2a1410“ */
  inhalt: string;
  /** Echtes Produktfoto (freigestellt oder auf Weiß) für den Rückfall */
  foto: BildRef;
  /** Alt-Text des Glases */
  name: string;
}

export interface FirmaPhase {
  nr: number;
  titel: string;
  /** als Wort oder Zeitraum, z. B. „Woche eins bis drei“ — keine Ziffernfristen (Wortwand) */
  dauer: string;
  text: string;
  abzeichen?: string;
  /** Seit Runde 2 (Justin 08.10.2026, Punkt 4) keine Fotos im Zeitstrahl — die Etappe „Aufbau“ trägt eine eigene Animation. */
  illustration?: "aufbau";
  bild?: BildRef;
}

export interface FirmaLeistung {
  schluessel: "gesellschaft" | "kapital" | "strategie" | "plattform" | "vertrieb" | "ansprechpartner";
  titel: string;
  text: string;
  /** Runde 3 (Punkt 3): höchstens drei Punkte sichtbar … */
  punkte: string[];
  /** … der Rest nur aufklappbar („Mehr erfahren“). */
  mehr?: string[];
  /** Seit Runde 2 (Punkt 5) ohne Foto: jede Karte trägt eine eigene Linien-Illustration (nach schluessel, in der Oberfläche). */
  bild?: BildRef;
}

/** Ein Vergütungsposten — jeder mit Was / Wann / Warum / Wie, damit keine Frage offen bleibt. */
export interface FirmaInvestPosten {
  schluessel: "gruendung" | "monat" | "umsatz" | "verkauf";
  titel: string;
  /** groß gesetzt, z. B. „6.900 €“, „1.990 €“, „10 %“, „5 %“ */
  betrag: string;
  /** klein darunter, z. B. „einmalig“, „pro Monat“, „auf den Umsatz über 600.000 €“ */
  einheit: string;
  /** Runde 3 (Punkt 3): die kompakte Zeile — ein Satz. Was / Wann / Warum / Wie stehen nur aufklappbar. */
  satz: string;
  was: string;
  wann: string;
  warum: string;
  wie: string;
  /** Gründungskosten (Runde 2, Punkt 7): woraus sie bestehen — ohne Einzelbeträge. */
  bestandteile?: string[];
  /** Ein Satz, groß gesetzt (z. B. „Wir verdienen an den Gründungskosten nichts …“). */
  hinweis?: string;
}

/** Ein Posten des gemeinsamen Wachstumsbudgets (Runde 2, Punkt 8) — Planwert je Monat. */
export interface FirmaBudgetZeile { schluessel: string; titel: string; text: string; betrag: string; cents: number }
/** „Gemeinsames Wachstumsbudget“: die Aufstellung auf der Seite (derselbe Wortlaut steht in Ziffer 10 Absatz 3). */
export interface FirmaBudget {
  titel: string;
  sub: string;
  /** „4.000 €“ */
  gesamt: string;
  gesamtText: string;
  /** „2.000 €“ — die Hälfte, die die Kundin trägt */
  ihrAnteil: string;
  ihrAnteilText: string;
  /** „2.000 €“ — die Hälfte, die FIAON trägt */
  fiaonAnteil: string;
  fiaonAnteilText: string;
  /** Wann das Budget beginnt (Tag „Shop live“) */
  start: string;
  zeilen: FirmaBudgetZeile[];
  summeText: string;
  fein: string[];
}

/** Der Rechner unter „Ihre Investition“: Umsatz wählen → Beteiligung pro Jahr. Rechnet nur mit Schwelle und Satz. */
export interface FirmaRechner {
  titel: string;
  sub: string;
  schwelleCents: number;
  satzProzent: number;
  minCents: number;
  maxCents: number;
  schrittCents: number;
  startCents: number;
  /** Überschrift der großen Zahl, z. B. „Beteiligung pro Jahr“ */
  zahlTitel: string;
  /** Beschriftung des Reglers (für Vorleser), z. B. „Netto-Jahresumsatz“ */
  zeileUmsatz: string;
  /** Satzbausteine unter der großen Zahl, die Oberfläche setzt nur Zahlen ein ({umsatz}, {beteiligung}, {schwelle}, {satz}, {cent}) */
  zeileBeteiligung: string;
  zeileUnterSchwelle: string;
  /** Wort an der Markierung der Schwelle auf der Skala */
  schwelleText: string;
  /** Skala unter dem Regler: Schwelle und volle Millionen (Text fertig aus der Textquelle) */
  skala: { cents: number; text: string; schwelle?: boolean }[];
}

/**
 * „Ihr Team bei FIAON Global“ unter dem Ansprechpartner (Runde 2, Punkt 9): die Personen kommen aus den Angebotsdaten
 * (parameter.inhalt.team) — nie hart im Code. Ein Bild NUR, wenn ein echtes Foto der Person geliefert ist (foto), sonst
 * ein Monogramm. Keine KI-Porträts (KI-VO Art. 50) — darum gibt es hier auch keinen KI-Hinweis.
 */
export interface FirmaTeam {
  titel: string;
  sub: string;
  /** ki: das Foto ist ein Symbolbild (Bildnachweis am Seitenende nennt es). */
  personen: { name: string; rolle: string; foto: string | null; initialen: string; ki?: boolean }[];
}

export interface FirmaFrage { frage: string; antwort: string[] }

export interface FirmaSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  /**
   * Runde 3 (Punkt 1): Das Kapital ist das Erste, was nach dem Glückwunsch ins Auge fällt — kapital.betrag groß in Gold-Serif,
   * kapital.satz = Justins Garantie-Satz (AUSSCHLIESSLICH aus firmaGarantie().satz). Keine Gründungskosten im Hero (Punkt 2).
   */
  hero: { auge: string; titel: string; unter: string; kapital: { betrag: string; satz: string; titel: string }; nutzen: string[]; glas: GlasKonfig | null };
  ziele: { titel: string; sub: string; punkte: { titel: string; text: string }[] };
  /** Höchstens EIN großes Stimmungsbild zwischen zwei Abschnitten (KI-Hinweis Pflicht) — Runde 2, Punkt 5. */
  stimmung: BildRef | null;
  phasen: { titel: string; sub: string; liste: FirmaPhase[] };
  leistungen: { titel: string; sub: string; karten: FirmaLeistung[] };
  kapital: {
    titel: string;
    sub: string;
    /** Die Garantie-Sätze — AUSSCHLIESSLICH aus firmaGarantie() (eine Quelle, Prüfstand). */
    garantie: string[];
    betrag: string;
    /** Eine Auszahlung (Justin, 07.10.2026) — keine Tranchen */
    auszahlung: string;
    /** Die aufschiebenden Bedingungen der Bürgschaft (seit Fassung B genau zwei), je mit ihrem Grund */
    bedingungen: { titel: string; text: string }[];
    bedingungenSub: string;
    ohneEntgelt: string;
    buergin: { name: string; sitz: string; vertreter: string; funktion: string };
    sonderfreigabe: FirmaSonderfreigabe;
  };
  pruefbericht: { titel: string; sub: string; download: string; hinweis: string };
  /**
   * „Unsere Vereinbarung“ (Runde 2, Punkt 6 — vorher „Ihre Investition“). Was die Kundin direkt an Dritte zahlt, steht NUR im
   * Vertrag (Ziffer 10 Absatz 6) — keine Liste auf der Seite. budget = die Aufstellung des gemeinsamen Wachstumsbudgets.
   */
  investition: {
    titel: string; sub: string;
    /** Runde 3 (Punkt 1): zuerst „Was Sie bekommen“ (Kapital, Gesellschaft, Team) — danach die Konditionen. */
    bekommen: { titel: string; punkte: { wert: string; text: string }[] };
    konditionenTitel: string;
    posten: FirmaInvestPosten[]; budget: FirmaBudget; rechner: FirmaRechner; fein: string[];
  };
  /** Runde 3 (Punkt 3): die ersten `sichtbar` Fragen stehen offen in der Liste, der Rest unter „Weitere Fragen“. */
  fragen: { titel: string; sub: string; liste: FirmaFrage[]; sichtbar: number };
  ansprechpartner: { titel: string; sub: string };
  team: FirmaTeam;
  /** inhalt: Präambel, Ziffern, Anlagen — anker = id im Vertrags-HTML (html), marke = Ziffer bzw. „Anlage 1“ */
  vertrag: { titel: string; sub: string; dokument: string; unterzeile: string; inhalt: { anker: string; marke: string; titel: string }[] };
  pflicht: string[];
  bildnachweis: string;
}

export interface FirmaSonderfreigabe {
  titel: string;
  text: string;
  unterzeichner: string;
  funktion: string;
  /** JJJJ-MM-TT */
  datum: string;
}

/** Die Kundenfassung des Compliance-Berichts (Datenquelle: compliance-daten.json, ohne FIAON-interne Punkte). */
export type Ampel = "GRÜN" | "GELB" | "ROT";
export interface ComplianceBefund {
  id: string;
  aussage: string;
  quelle_name: string;
  quelle_url: string;
  stand: string;
  art: string;
  pruefung: string;
}
export interface ComplianceBereich {
  nr: number;
  titel: string;
  ampel: Ampel;
  kurz: string;
  urteil: string[];
  befunde: ComplianceBefund[];
  nicht_geprueft: { punkt: string; grund: string }[];
  chancen: string[];
  risiken: string[];
}
export interface ComplianceKundenfassung {
  art: "compliance";
  meta: { firma: string; kurz: string; anlass: string; pruefdatum: string; datenstand: string; kopf: [string, string][] };
  gesamt: { ampel: Ampel; titel: string; text: string[]; kernzahlen: { wert: string; text: string }[]; auflagen: string[] };
  bereiche: ComplianceBereich[];
  chancen: { titel: string; text: string }[];
  schwaechen: { titel: string; text: string }[];
  methodik: string[];
  fuss: string;
}

export interface FirmaAnsprechpartner {
  name: string;
  rolle: string;
  email: string;
  telefon: string;
  portrait: string;
  portraitHinweis: string;
}

export interface FirmaAnnahmeTexte {
  titel: string;
  sub: string;
  /** Pflicht-Häkchen 1: handelt als Unternehmerin (kein Verbrauchergeschäft, kein Widerruf) */
  unternehmer: string;
  /** Pflicht-Häkchen 2: vertretungsbefugt für die Gesellschaft */
  vertretung: string;
  /** Die Unterschrift (Runde 2, Punkt 11): zeichnen ODER Namen tippen — Pflicht, vom Server geprüft. */
  unterschrift: {
    titel: string; sub: string; zeichnen: string; tippen: string; neu: string; platz: string;
    tippenFeld: string; tippenHinweis: string; vorschau: string; fehlt: string; fehltName: string;
  };
  knopf: string;
  unterKnopf: string;
  gesperrt: string;
}

/** „Unsere Zusammenarbeit im Überblick“ (Runde 2, Punkt 11) — unmittelbar über Unterschrift und Knopf. */
export interface FirmaBestellUebersicht { titel: string; zeilen: { label: string; wert: string }[]; fein: string[] }

/** GET /api/fiaon/global/angebot/:token für ein OFFENES Firmenangebot. (Angenommen → dieselbe Antwort wie E-268.) */
export interface FirmaKundenSicht {
  ok: true;
  status: "offen";
  art: "firma";
  ref: string;
  fassung: string;
  gueltigBis: string;
  kunde: { firma: string; marke: string; anrede: string; vorname: string; nachname: string; funktion: string; email: string };
  /** „Sehr geehrte Frau …“ / „Liebe Frau …“ — vom Server gebaut */
  kundeAnrede: string;
  seite: FirmaSeite;
  compliance: ComplianceKundenfassung | null;
  ansprechpartner: FirmaAnsprechpartner;
  uebersicht: FirmaBestellUebersicht;
  annahme: FirmaAnnahmeTexte;
  annahmeBereit: boolean;
  gesperrtGrund: string | null;
  vorschauLeitung?: boolean;
  fehlt?: string[];
  /** Vertrag als HTML (dieselbe Quelle wie das PDF) */
  html: string;
  textHash: string;
  vertragPdf: string;
  anlage1Pdf: string;
  pruefberichtPdf: string;
}

/**
 * Die Unterschrift bei der Annahme (Runde 2, Punkt 11). gezeichnet: PNG aus dem Feld (Finger/Maus). getippt: der Name in
 * Schreibschrift — dazu optional das Bild, das die Seite daraus gesetzt hat (für das PDF; der Name ist maßgeblich).
 */
export type FirmaUnterschriftEingabe =
  | { art: "gezeichnet"; png: string }
  | { art: "getippt"; name: string; png?: string | null };

/**
 * POST /api/fiaon/global/angebot/:token/annehmen für ein Firmenangebot. Seit Runde 2 ohne Startwahl: Der Vertrag beginnt mit
 * der Annahme; das gemeinsame Wachstumsbudget beginnt am Tag „Shop live“, den die Leitung im Chefbüro setzt.
 */
export interface FirmaAnnahmeEingabe {
  textHash: string;
  unternehmer: true;
  vertretung: true;
  unterschrift: FirmaUnterschriftEingabe;
}
