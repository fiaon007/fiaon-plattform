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
  bild?: BildRef;
}

export interface FirmaLeistung {
  schluessel: "gesellschaft" | "kapital" | "strategie" | "plattform" | "vertrieb" | "ansprechpartner";
  titel: string;
  text: string;
  punkte: string[];
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
  was: string;
  wann: string;
  warum: string;
  wie: string;
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

/** „Ihr Team bei FIAON Global“ unter dem Ansprechpartner — Leitung und aktive Mitarbeitende, Porträts mit KI-Hinweis. */
export interface FirmaTeam {
  titel: string;
  sub: string;
  personen: { name: string; rolle: string; portrait: string; portraitHinweis: string; initialen: string }[];
}

export interface FirmaFrage { frage: string; antwort: string[] }

export interface FirmaSeite {
  auftakt: { auge: string; gruss: string; zeile: string; weiter: string };
  hero: { auge: string; titel: string; unter: string; nutzen: string[]; glas: GlasKonfig | null };
  ziele: { titel: string; sub: string; punkte: { titel: string; text: string }[] };
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
  /** Was die Kundin direkt an Dritte zahlt, steht NUR im Vertrag (Ziffer 10 Absatz 4) — keine Liste auf der Seite. */
  investition: { titel: string; sub: string; posten: FirmaInvestPosten[]; rechner: FirmaRechner; fein: string[] };
  fragen: { titel: string; sub: string; liste: FirmaFrage[] };
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
  startTitel: string;
  startSofort: string;
  startAb: string;
  knopf: string;
  unterKnopf: string;
  gesperrt: string;
}

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
  beginn: { morgen: string; spaetestens: string };
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

/** POST /api/fiaon/global/angebot/:token/annehmen für ein Firmenangebot. */
export interface FirmaAnnahmeEingabe {
  textHash: string;
  unternehmer: true;
  vertretung: true;
  /** null = sofort starten, sonst JJJJ-MM-TT (morgen bis spaetestens) */
  startAm: string | null;
}
