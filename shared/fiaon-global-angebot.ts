// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — DAS INDIVIDUALANGEBOT: DIE TEXTE AN EINER STELLE
// Individualangebot (01.10.2026), Register E-268
//
// Justin (01.10.2026): „Ja ich erlaube dir alles, umsetzen bitte" — ein Angebot
// in zwei Teilen: Teil 1 „Gründung" (sofort fällig), Teil 2 „Kapital-Begleitung"
// (erst fällig, wenn die LLC eingetragen ist UND das erste Kapital ausgezahlt
// bzw. die erste Karte freigeschaltet ist). Dazu die Bürgschaftszusage der
// Schwarzott Global LLC, eine Frist mit vollständiger Erstattung von Teil 1 und
// — für Privatpersonen — das Widerrufsrecht. Erster Anwendungsfall: Herr
// William Hildbrand (Person 13411).
//
// ── EIN WORTLAUT, ZWEI AUSGABEN ───────────────────────────────────────────
// Bildschirm (/business/angebot/:token) und PDF entstehen aus DEN FUNKTIONEN
// HIER (server/lib/fiaon-global-angebot-vertrag.ts rendert nur). Ein Vertrag, der
// am Bildschirm anders lautet als im PDF, wäre im Streitfall zwei Verträge —
// derselbe Grundsatz wie im Global-Auftrag (fiaon-global-vertrag.ts).
// Der geprüfte Wortlaut stammt aus dem Teilauftrag „Schreiben" vom 01.10.2026
// (scratchpad angebot/texte, Wortwand grün); hier mit Zahlen aus den Parametern
// statt fester Beträge und mit drei Anlagen statt zwei: Anlage 2 ist der
// Prüfbericht (Justin: „Echter Prüfbericht"), die Widerrufsbelehrung wird Anlage 3.
//
// ── WAS WÖRTLICH AUS DEM HAUS KOMMT ───────────────────────────────────────
//   · Pflichthinweise, Rolle von FIAON, Jahresbetreuung: shared/fiaon-global.ts
//   · Widerrufsbelehrung + Formular: shared/fiaon-global-widerruf.ts (gesetzliches
//     Muster — nie „verbessern")
//   · Anbieter: shared/fiaon-firma.ts
//
// ── DIE WORTGRENZEN (FIAON Global, E-188 + Justin 01.10.2026, Nachtrag 10:50) ──
//   · KEIN „bis zu" — nirgends in Vertrag, Seite, Mail (Nachtrag b: „bis zu" nur an
//     der VIP-Zahl der Pakete; die Pakete nennen den Kapitalrahmen als feste Zahl).
//     Der Kapitalrahmen heißt „Kapitalrahmen von 800.000 US-Dollar" (angebotKapitalrahmen()),
//     die Bürgschaft „Höchstbetrag" (Deckelung, kein Marketing). Der Prüfstand
//     meldet jedes „bis zu" — nur das gesetzliche Widerrufs-Muster bleibt wörtlich.
//   · Der Satz, dass das jeweilige Institut entscheidet, steht im VERTRAG (Teil 2),
//     in der Bürgschaftszusage, in den Pflichthinweisen und unter „Ihr Schutz" —
//     NICHT in Überschrift, Hero oder Nutzenliste der Seite (Nachtrag b).
//   · „keine Sicherheiten" als „verlangen … keine Sicherheiten"; der Satz zur
//     persönlichen Haftung bei US-Firmenkarten steht auf der Seite unter „Was Sie
//     bekommen" (Karten) und in den Pflichthinweisen, im Vertrag in Ziffer 8 und 9.
//   · Fristen als Wort („zwölf Wochen"), nie als Ziffer; kein Bankname; kein
//     „vermitteln/beschaffen"; „Kapitalrahmen" statt Zusage. Kein „Unternehmensberater"
//     (Selbstbezeichnung, E-188) — der Partner heißt „betriebswirtschaftliche Begleitung".
//   · Vertrag und Anlage 1 in Vertragssprache (kein Ihr/unser/wir); Seite, Anlage 2
//     und Anlage 3 dürfen den Kunden ansprechen.
//
// ── NACHTRAG JUSTIN 01.10.2026 (10:50–10:58), hier umgesetzt ──────────────
//   (a) Bürgin: Registernummer „nicht erforderlich" (BUERGIN_NUMMER_NICHT_ERFOERDERLICH —
//       Anlage 1 nennt dann keine Nummer), Funktion „Manager (geschäftsführendes
//       Mitglied)", Bestätigung mit Grundlage (bestaetigtGrundlage).
//   (h) Erstes Jahr alles inklusive, Mitwirkung nur Unterschriften, Reisepass, wahre
//       Angaben (Ziffer 2 Abs. 2–3, Ziffer 6 Abs. 3, Ziffer 7 Abs. 1).
//   (i) Auftakt der Seite: persönliche Begrüßung (angebotSeite().auftakt).
//
// ── GEGENPRÜFUNG 01.10.2026 (nach dem Nachtrag), hier eingearbeitet ────────
//   · „alles inklusive" = alle Gebühren und Honorare für die VEREINBARTEN Leistungen; was
//     nicht dazugehört, steht in Ziffer 5 Abs. 5 und auf der Seite in einem Satz.
//   · Mitwirkung bleibt bei drei Dingen — die Unterschriften umfassen die Mandate der
//     Partner und die Meldung nach § 138 AO, der Reisepass einen Adressnachweis, wenn ein
//     Institut ihn zur Identifizierung verlangt (Anlage 2 Abschnitt V bleibt damit wahr).
//   · Kapitalrahmen und Karten sind auf der Seite als ZIEL gekennzeichnet (keine Zahl
//     verspricht mehr als Ziffer 3 Abs. 1); der Institut-Satz steht in „So läuft es",
//     „Ihr Schutz" und „Ihre Investition".
//   · Fristen auf der Seite: „ab unserem Start (mit sofortigem Beginn: ab Zahlungseingang)".
//   · „FIAON erhält von den Partnern keine Vergütung" war nicht belegt → Offenlegungspflicht
//     (Ziffer 4). Justin kann den alten Satz zurückholen, sobald er es schriftlich bestätigt.
//   · Prüfbericht: „bestanden" nennt die Auflagen im selben Satz (pruefberichtErgebnis).
//
// ── ENDABNAHME 01.10.2026 (Nachmittag), hier eingearbeitet ─────────────────
//   · Die Existenz der Bürgin ist im Haus nur über den EIN-Antrag SS-4 belegt — ein Antrag beim
//     IRS beweist keine Eintragung beim Florida Department of State. Deshalb trennt diese Datei
//     zwei Dinge: die ANNAHME (Pflichtfelder, Justins Entscheidung „Registernummer nicht
//     erforderlich" bleibt) und den VERSAND des Links (angebotVersandSperre): Ohne Document
//     Number aus dem Register und ohne Registerauszug als Grundlage der Bestätigung zeigt das
//     Chefbüro „Versand gesperrt" statt „Link kopieren". Die Saat sagt dasselbe.
//   · „Was Sie bekommen": Kapitalrahmen und Karten heißen auch in der Überschrift „Ihr Ziel: …"
//     (Ziffer 3 Abs. 1 schuldet kein Ergebnis; der Gesamteindruck darf nicht mehr versprechen).
//   · „Nicht enthalten sind …" ohne „nur" und mit allen vier Posten aus Ziffer 5 Abs. 5 —
//     wortgleich in der Mail.
//   · Anlage 2 Abschnitt V nennt genau die drei Mitwirkungen der Ziffer 7 Abs. 1 (Saat).
//
// ── NACHTRAG JUSTIN 01.10.2026 ABENDS: „KREDIT GARANTIERT“ (Register E-271) ──────
// Justin: „Der Vertrag soll sagen ‚Kredit garantiert‘ … Dr. Hepp und Dr. Laukermann haben bereits mit den
// Banken gesprochen … WIR GARANTIEREN ES IHM.“ Entscheidung (19:58): FIAON GARANTIERT, dass die Gesellschaft
// binnen der Frist einen Kreditrahmen von 800.000 US-Dollar UND drei Business-Kreditkarten erhält
// (Garantieziel, Ziffer 3 Abs. 1). Wird es nicht vollständig erreicht: alles Gezahlte zurück (Teil 1 und ein
// bezahlter Teil 2), eine offene Teil-2-Rechnung entfällt, die LLC bleibt (Ziffer 6 Abs. 2) — die Folge ist auf
// diese Erstattung begrenzt (Ziffer 6 Abs. 5, Justins Wahl „Alles Geld zurück“ statt „volle Haftung“).
// DAMIT ÜBERHOLT (bitte nicht zurückbauen): „Ihr Ziel“, „ein bestimmtes Ergebnis ist nicht geschuldet“, der
// Institut-Satz in Vertrag, Seite, Pflichthinweisen und Mails DIESES Angebots, „Erstattung nur von Teil 1, nur
// wenn gar nichts kommt“. Alle Sätze mit „garant…“ kommen aus EINER Quelle: angebotGarantie(par) und
// ANGEBOT_GARANTIE_FEST — der Prüfstand nimmt genau diese vor der Wortwand heraus; jedes andere „garant…“ bleibt rot.
// Die Hauswortwand, GLOBAL_PFLICHTHINWEIS und die vier Pakete bleiben OHNE Garantie (eigene Variante hier:
// ANGEBOT_PFLICHTHINWEIS). Anlage 1 (Bürgin) bleibt wörtlich, damit ihre Prüfsumme und Unterschrift gelten
// (ANLAGE1_FASSUNG); ihr Satz „ob es finanziert, entscheidet allein das Institut“ betrifft die Pflicht der Bürgin.
// Kartenlimits zählen NICHT zum Kreditrahmen (Justins Auftrag: „800.000 US-Dollar sowie 3 Kreditkarten“).
//
// Diese Datei fasst keine Datenbank an — Server, Oberfläche und Prüfstand lesen sie.
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, GLOBAL_JAHRESBETREUUNG, GLOBAL_KAPITAL_FREI } from "./fiaon-global";
import { FIAON_FIRMA } from "./fiaon-firma";
import { geburtsdatumIso } from "./fiaon-geburtsdatum";

export const ANGEBOT_MARKE = "Individualangebot (01.10.2026)";
/**
 * Die Fassung des Wortlauts. Eine neue Fassung = neuer Eintrag hier; ANGENOMMENE Angebote behalten ihre.
 * Ein OFFENES Angebot zeigt immer den aktuellen Wortlaut und damit die aktuelle Fassung (angebotDatenAus).
 * IA-2026-10-01-KG (01.10.2026 abends, E-271): Kreditgarantie. Am 01.10.2026 war kein Angebot angenommen.
 */
export const ANGEBOT_FASSUNG = "IA-2026-10-01-KG";
export const ANGEBOT_FASSUNGEN = ["IA-2026-10-01", ANGEBOT_FASSUNG] as const;
/**
 * Anlage 1 (Bürgschaftszusage) hat ihren EIGENEN Fassungsstand: Ihr Wortlaut ist seit IA-2026-10-01 unverändert,
 * und ihre Prüfsumme steht auf dem eigenhändig unterschriebenen Original (§ 766 BGB). Ändert sich der Wortlaut
 * der Anlage 1, hier eine neue Kennung setzen — dann muss sie neu unterschrieben werden.
 */
export const ANLAGE1_FASSUNG = "IA-2026-10-01";
/**
 * Der Knopf (§ 312j Abs. 3 BGB) — wortgleich auf Seite, im PDF-Vermerk und in der Prüfung.
 * Justin (01.10.2026, nachmittags): „Auftrag erteilen" statt „Zahlungspflichtig annehmen". Die Zahlungspflicht muss
 * im Knopf selbst stehen — sonst kommt mit einer Privatperson kein Vertrag zustande (§ 312j Abs. 4 BGB, EuGH C-249/21).
 * Deshalb „Auftrag zahlungspflichtig erteilen".
 */
export const ANGEBOT_KNOPF = "Auftrag zahlungspflichtig erteilen";
/** Wie die Bestellzeilen heißen — Rechnung, Zahlungsseite, Liste. */
export const ANGEBOT_PAKETNAME = "FIAON Global – Individualangebot";

// ── Feste Größen des Wortlauts (keine Parameter, weil sie im Text als Zusage stehen) ──
export const ANGEBOT_FEST = {
  /** Mindestfrist der Aufforderung, bevor die Frist ruht (Ziffer 6 Abs. 3). */
  hemmungAufforderungTage: 7,
  /** Die Bürgin gibt die Erklärung binnen zehn Werktagen ab (Anlage 1 Ziffer 3). */
  buergschaftAbgabeWerktage: 10,
  /** Bis E-271: Kapital-Begleitung nach dem Kapitalereignis höchstens zwölf Monate. Seit der Kreditgarantie
   *  endet sie mit dem Garantieziel, spätestens am Fristende (Ziffer 3 Abs. 5) — bleibt nur für Altbezüge stehen. */
  begleitungMonate: 12,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DATEN
// ═══════════════════════════════════════════════════════════════════════════
export type AngebotLand = "DE" | "AT" | "CH";
export interface AngebotKunde {
  anrede: "Herr" | "Frau" | "";
  vorname: string;
  nachname: string;
  /** JJJJ-MM-TT */
  geburtsdatum: string;
  strasse: string;
  plz: string;
  ort: string;
  land: AngebotLand;
  email: string;
  telefon: string;
}
export interface AngebotParameter {
  teil1Cents: number;
  teil2Cents: number;
  fristWochen: number;
  erstattungTage: number;
  teil2ZielTage: number;
  kapitalZielUsd: number;
  kartenZiel: number;
  buergschaftUsd: number;
}
/**
 * Die Bürgin. Jedes Feld außer `name` ist Pflicht — fehlt eines oder ist
 * `bestaetigt` falsch, sperrt der Server die Annahme (409) und die Seite zeigt
 * statt des Knopfs einen ruhigen Satz.
 * Stand nach dem Nachtrag (Justin, 01.10.2026, 10:50 — Grundlage: EIN-Antrag SS-4,
 * ~/Desktop/FIAON/11_Vertraege/2026-10-01_Global_Hildbrand/Schwarzott_Global_LLC_Stammdaten.md):
 * Bundesstaat Florida, Anschrift Miami, Vertreter Justin Schwarzott als Manager
 * (geschäftsführendes Mitglied). Die Florida Document Number liegt nicht vor und
 * ist nach Justins Entscheidung NICHT erforderlich — die LLC ist über Name,
 * Bundesstaat und Anschrift bestimmt; Anlage 1 nennt dann keine Nummer.
 * Je Angebot bleiben Pflicht: das Datum der eigenhändigen Unterschrift (§ 766 BGB)
 * und die Bestätigung mit ihrer Grundlage.
 */
export interface AngebotBuergin {
  name: string;
  bundesstaat: string | null;
  anschrift: string | null;
  registerstelle: string | null;
  /** Document Number — oder BUERGIN_NUMMER_NICHT_ERFORDERLICH (dann ohne Registerzeile in Anlage 1). */
  registernummer: string | null;
  vertreter: string | null;
  funktion: string | null;
  /** JJJJ-MM-TT — der Tag, an dem die Zusage eigenhändig unterschrieben wurde (Original geht per Post). */
  unterzeichnetAm: string | null;
  /** Justin hat Bundesstaat, Anschrift und Vertretung bestätigt — womit, sagt `bestaetigtGrundlage`. */
  bestaetigt: boolean;
  /** Grundlage der Bestätigung, z. B. „EIN-Antrag SS-4, vorgelegt 01.10.2026“ oder „Registerauszug vom …“. */
  bestaetigtGrundlage: string | null;
}
/** Justins Entscheidung (01.10.2026): Ohne Document Number — Anlage 1 bestimmt die LLC über Name, Bundesstaat und Anschrift. */
export const BUERGIN_NUMMER_NICHT_ERFORDERLICH = "nicht erforderlich";
export function buerginOhneNummer(b: Pick<AngebotBuergin, "registernummer">): boolean {
  return String(b.registernummer ?? "").trim().toLowerCase() === BUERGIN_NUMMER_NICHT_ERFORDERLICH;
}
export interface AngebotSchalter {
  /** Privatperson verlangt ausdrücklich den Beginn vor Ablauf der Widerrufsfrist (nie vorangekreuzt). */
  sofortBeginn: boolean;
  /** Jahresbetreuung ab dem zweiten Jahr dazugebucht (nie vorangekreuzt, § 312a Abs. 3 BGB). */
  jahresbetreuung: boolean;
  /**
   * „Starten ab" (Justin, 01.10.2026): der vom Kunden gewählte Starttag (JJJJ-MM-TT) — FIAON beginnt an diesem Tag,
   * frühestens mit dem Zahlungseingang. Liegt er vor dem Ende der Widerrufsfrist, ist sofortBeginn zugleich true
   * (der Server leitet das ab, nie der Browser). null/fehlt = „Sofort starten" bzw. Start nach der Widerrufsfrist.
   */
  startAm?: string | null;
}
/** „Starten ab": frühestens morgen, spätestens in neunzig Tagen (Berlin). */
export const ANGEBOT_START_SPAETESTENS_TAGE = 90;

// ── DER PRÜFBERICHT (Anlage 2) — eingefrorene Messwerte, nie getippte Zahlen ──
export interface PruefberichtZeile { merkmal: string; befund: string; quelle: string }
export interface PruefberichtListe { liste: string; herausgeber: string; stand: string; eintraege: number; personen: number; treffer: number }
export interface PruefberichtSanktionen {
  /** Wann abgerufen, z. B. „01.10.2026 zwischen 09:20 und 09:22 MESZ" */
  abruf: string;
  listen: PruefberichtListe[];
  verfahren: string;
  gegenprobe: string;
  quellen: { liste: string; stand: string; abruf: string; quelle: string }[];
  pruefsummen: { datei: string; sha256: string; zusatz?: string }[];
}
/** Wie BoniAmpel (shared/fiaon-boni-ampel.ts) — eingefroren mit Stand und Quelle. */
export interface PruefberichtBoni {
  farbe: "gruen" | "gelb" | "rot";
  punkte: number;
  label: string;
  teile: { key: string; label: string; punkte: number; quelle: "schufa" | "kontoauszug" | "antrag" | "annahme"; text: string }[];
  belegt: number;
  deckel: string | null;
  befunde: string[];
  geschaetzt: boolean;
  /** Woher die Zahlen kommen — z. B. „boniAmpelFuerPerson(13411), Produktion, 01.10.2026" */
  quelle: string;
  stand: string;
}
export interface Pruefbericht {
  erstellt: string;
  datenstand: string;
  pruefer: string;
  aktenzeichen: string;
  eigenschaft: string;
  vorhaben: string;
  stammdaten: PruefberichtZeile[];
  /** Fehlt der Abgleich, sagt der Bericht „steht aus" — und nie „bestanden". */
  sanktionen: PruefberichtSanktionen | null;
  pep: { status: "offen" | "erklaert"; text: string };
  boni: PruefberichtBoni | null;
  /** Abschnitt V (Eignung) — Absätze und die steuerlichen Hinweise als Liste. */
  eignung: { voraussetzungen: string; steuer: string[]; haftung: string; mitwirkung: string; einordnung: string };
  /** Auflagen und Hinweise am Anfang (Identifizierung, PEP, Datenpflege …). */
  auflagen: string[];
}

export interface AngebotDaten {
  ref: string;
  fassung: string;
  kunde: AngebotKunde;
  parameter: AngebotParameter;
  buergin: AngebotBuergin;
  pruefbericht: Pruefbericht | null;
  /** JJJJ-MM-TT */
  gueltigBis: string;
}

/** Die Vorgaben der Fassung IA-2026-10-01 — Justins Zahlen vom 01.10.2026. */
export const ANGEBOT_VORGABEN: AngebotParameter = {
  teil1Cents: 465000,
  teil2Cents: 685000,
  fristWochen: 12,
  erstattungTage: 14,
  teil2ZielTage: 7,
  kapitalZielUsd: 800000,
  kartenZiel: 3,
  buergschaftUsd: 800000,
};
/** Wie lange ein Angebot gilt, wenn der Chef nichts anderes einträgt. */
export const ANGEBOT_GUELTIG_TAGE = 14;

/**
 * Die Bürgin, soweit sie im Haus belegt ist — Stammdaten aus dem EIN-Antrag SS-4 (Justin, 01.10.2026).
 * Je Angebot bleiben offen: Datum der eigenhändigen Unterschrift und die Bestätigung mit Grundlage.
 */
export const BUERGIN_VORGABE: AngebotBuergin = {
  name: "Schwarzott Global LLC",
  bundesstaat: "Florida",
  anschrift: "3119 Coral Way, Suite 200, Miami, FL 33145, USA",
  registerstelle: "Florida Department of State, Division of Corporations",
  registernummer: BUERGIN_NUMMER_NICHT_ERFORDERLICH,
  vertreter: "Justin Schwarzott",
  funktion: "Manager (geschäftsführendes Mitglied)",
  unterzeichnetAm: null,
  bestaetigt: false,
  bestaetigtGrundlage: null,
};

export const BUERGIN_FELDER: { schluessel: keyof AngebotBuergin; bezeichnung: string; hinweis: string }[] = [
  { schluessel: "bundesstaat", bezeichnung: "Bundesstaat der Gründung", hinweis: "Florida laut EIN-Antrag SS-4 (01.10.2026) — eine LLC mit Sitz in Miami kann auch anderswo gegründet sein, deshalb unten bestätigen." },
  { schluessel: "anschrift", bezeichnung: "Anschrift", hinweis: "Mailing Address laut SS-4: 3119 Coral Way, Suite 200, Miami, FL 33145, USA." },
  { schluessel: "registerstelle", bezeichnung: "Registerstelle", hinweis: "Folgt aus dem Bundesstaat (Florida: Department of State, Division of Corporations). Steht in Anlage 1 nur mit einer Nummer." },
  { schluessel: "registernummer", bezeichnung: "Registernummer (Document Number)", hinweis: `Aus dem Registerauszug (Sunbiz, Status „Active“) — oder „${BUERGIN_NUMMER_NICHT_ERFORDERLICH}“ (Justin, 01.10.2026): Anlage 1 bestimmt die LLC dann über Name, Bundesstaat und Anschrift. Der Kunde kann dann annehmen, aber der Link wird erst verschickt, wenn die Nummer aus dem Register hier steht (Endabnahme 01.10.2026).` },
  { schluessel: "vertreter", bezeichnung: "Vertreten durch", hinweis: "Wer für die LLC unterschreibt." },
  { schluessel: "funktion", bezeichnung: "Funktion des Vertreters", hinweis: "Laut SS-4: Manager (geschäftsführendes Mitglied)." },
  { schluessel: "unterzeichnetAm", bezeichnung: "Zusage eigenhändig unterschrieben am", hinweis: "§ 766 BGB — erst eintragen, wenn das Original den ENDGÜLTIGEN Text trägt: „Anlage 1 zum Unterschreiben (PDF)“ drucken, von Hand unterschreiben, Scan in die Akte, Original per Post an den Kunden. Ändert sich Anlage 1 danach, ist neu zu unterschreiben (die Prüfsumme auf dem Blatt zeigt die Fassung)." },
  { schluessel: "bestaetigtGrundlage", bezeichnung: "Grundlage der Bestätigung", hinweis: "Womit Bundesstaat, Anschrift und Vertretung bestätigt sind — z. B. „EIN-Antrag SS-4, vorgelegt 01.10.2026“ oder „Registerauszug (Sunbiz) vom …“. Für den Versand des Links muss die Grundlage der Registerauszug sein: Er belegt, dass die LLC eingetragen und „Active“ ist — der EIN-Antrag belegt das nicht." },
];

/**
 * VERSANDSPERRE (Endabnahme 01.10.2026) — getrennt von den Pflichtfeldern der Annahme.
 * Anlage 1 behauptet eine „Limited Liability Company nach dem Recht des Bundesstaats …" und die
 * Seite „Eine Bürgin an Ihrer Seite". Beides ist nur wahr, wenn die LLC im Register steht und
 * aktiv ist. Belegen kann das nur der Registerauszug (Florida: Sunbiz — Document Number, Status
 * „Active"); der EIN-Antrag SS-4 ist ein Antrag beim IRS, kein Registernachweis. Justins
 * Entscheidung „Registernummer nicht erforderlich" lässt die ANNAHME zu (Nachtrag a), aber der
 * Link geht erst raus, wenn beides da ist: die Document Number im Feld und ein Registerauszug als
 * Grundlage der Bestätigung. Rückgabe: der Grund als Satz fürs Chefbüro — oder null (frei).
 */
export const BUERGIN_REGISTERNACHWEIS = /registerauszug|sunbiz/i;
export function angebotVersandSperre(b: Pick<AngebotBuergin, "name" | "registernummer" | "registerstelle" | "bestaetigt" | "bestaetigtGrundlage">): string | null {
  const nummer = String(b.registernummer ?? "").trim();
  const grundlage = String(b.bestaetigtGrundlage ?? "").trim();
  const register = b.registerstelle ? ` (${b.registerstelle})` : "";
  if (!nummer || buerginOhneNummer(b)) {
    return `Der Registernachweis der ${b.name} fehlt — die Eintragung ist nur über den EIN-Antrag belegt. Vor dem Versand den Registerauszug${register} beschaffen (Status „Active“), als PDF in die Akte legen und die Document Number hier eintragen.`;
  }
  if (!b.bestaetigt || !BUERGIN_REGISTERNACHWEIS.test(grundlage)) {
    return `Die Bestätigung der ${b.name} stützt sich nicht auf den Registerauszug${grundlage ? ` (Grundlage: „${grundlage}“)` : ""}. Vor dem Versand als Grundlage „Registerauszug vom …“ eintragen — er belegt Eintragung und Status „Active“.`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLEN ALS TEXT
// ═══════════════════════════════════════════════════════════════════════════
const ZAHLWOERTER = ["null", "eins", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
  "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig", "einundzwanzig", "zweiundzwanzig",
  "dreiundzwanzig", "vierundzwanzig", "fünfundzwanzig", "sechsundzwanzig", "siebenundzwanzig", "achtundzwanzig", "neunundzwanzig",
  "dreißig", "einunddreißig"];
/** Eine Frist als Wort, nie als Ziffer (Wortregel FIAON Global). Über 31 gibt es keinen Wortlaut — dann wirft sie. */
export function zahlwort(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n >= ZAHLWOERTER.length) throw new Error(`Kein Zahlwort für ${n}`);
  return ZAHLWOERTER[n];
}
/** „4.650,00 €" — wie auf der Rechnung. */
export function angebotEur(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}
/** „800.000 US-Dollar" */
export function angebotUsd(usd: number): string {
  return `${Math.round(usd).toLocaleString("de-DE")} US-Dollar`;
}
/** „800.000 $" — die große Zahl auf der Seite. */
export function angebotUsdKurz(usd: number): string {
  return `${Math.round(usd).toLocaleString("de-DE")} $`;
}
/** „drei Business-Kreditkarten" / „eine Business-Kreditkarte" */
export function angebotKarten(n: number): string {
  return n === 1 ? "eine Business-Kreditkarte" : `${zahlwort(n)} Business-Kreditkarten`;
}
/** „Kapitalrahmen von 800.000 US-Dollar" — als feste Zahl, ohne „bis zu" (Nachtrag b, Justin 01.10.2026). */
export function angebotKapitalrahmen(p: AngebotParameter): string {
  return `Kapitalrahmen von ${angebotUsd(p.kapitalZielUsd)}`;
}
/** „Kreditrahmen von 800.000 US-Dollar" — garantiert (E-271, Justin 01.10.2026 abends). */
export function angebotKreditrahmen(p: Pick<AngebotParameter, "kapitalZielUsd">): string {
  return `Kreditrahmen von ${angebotUsd(p.kapitalZielUsd)}`;
}
/** „Kreditrahmen von 800.000 US-Dollar und drei Business-Kreditkarten" — das Garantieziel (Ziffer 3 Abs. 1). */
export function angebotGarantieziel(p: Pick<AngebotParameter, "kapitalZielUsd" | "kartenZiel">): string {
  return `${angebotKreditrahmen(p)} und ${angebotKarten(p.kartenZiel)}`;
}

/**
 * ALLE Sätze dieses Angebots, die „garant…“ enthalten — EINE Quelle (E-271). Vertrag (dritte Person), Seite,
 * Übersicht und Mails setzen sie ein und tippen sie nicht ab. Der Prüfstand (pruef-individualangebot.ts, ohneGarantie)
 * nimmt genau diese Sätze und die Etiketten in ANGEBOT_GARANTIE_ETIKETTEN vor der Wortwand heraus; jedes andere
 * „garant…“ bleibt rot. Jeder Satz nennt Kreditrahmen und Karten oder verweist auf die Ziffer, die es tut.
 */
export function angebotGarantie(p: Pick<AngebotParameter, "kapitalZielUsd" | "kartenZiel" | "fristWochen">) {
  const w = zahlwort(p.fristWochen);
  const ziel = angebotGarantieziel(p);
  const rahmen = angebotKreditrahmen(p);
  const karten = angebotKarten(p.kartenZiel);
  return {
    // ── Vertrag (Vertragssprache, dritte Person) ──
    vertragTitel3: "Teil 2 — Kapital-Begleitung mit Kreditgarantie",
    vertragTitel6: "Frist, Garantie und vollständige Erstattung",
    vertragPraeambel: `FIAON garantiert dem Auftraggeber, dass die Gesellschaft innerhalb der vereinbarten Frist von ${w} Wochen einen ${ziel} erhält; erreicht sie das nicht vollständig, erstattet FIAON dem Auftraggeber alles, was er an FIAON gezahlt hat, und die Gesellschaft verbleibt beim Auftraggeber.`,
    vertragPraeambelInstitut: "Die Verträge über Kreditrahmen und Karten schließt die Gesellschaft selbst mit den Instituten; FIAON ist keine Bank und kein Kreditgeber und leistet bei nicht erreichtem Garantieziel die Erstattung nach Ziffer 6 Absatz 2.",
    vertragZiel: `FIAON garantiert dem Auftraggeber, dass die Gesellschaft bis zum Ende der Frist nach Ziffer 6 einen ${ziel} erhält (Garantieziel); die Garantie ist auf die Erstattung nach Ziffer 6 Absatz 2 gerichtet. Das Garantieziel ist erreicht, wenn Institute der Gesellschaft bis zum Ende der Frist Kreditrahmen, Kreditlinien oder Darlehen von insgesamt mindestens ${angebotUsd(p.kapitalZielUsd)} eingeräumt und ${karten} für sie freigeschaltet haben — gleich auf wessen Antrag; Kartenlimits zählen nicht zum Kreditrahmen. Eingeräumt ist ein Rahmen, wenn ein Institut ihn der Gesellschaft in Textform verbindlich zugesagt hat, auch wenn die Gesellschaft ihn nicht in Anspruch nimmt; Beträge in anderer Währung werden zum Referenzkurs der Europäischen Zentralbank am Tag der Zusage umgerechnet. Freigeschaltet ist eine Business-Kreditkarte, wenn der Herausgeber für die Gesellschaft ein eigenes Kartenkonto eröffnet und die Karte ausgegeben hat, unabhängig von ihrer Aktivierung; Charge-Karten zählen, Zusatz-, Debit- und Prepaid-Karten nicht. Institute sind Banken, Kartenherausgeber und gewerbliche Kreditgeber, die nicht mit FIAON oder der Bürgin verbunden sind. Was bis zum Ende der Frist eingeräumt oder freigeschaltet war, zählt auch bei späterer Kündigung oder Herabsetzung. Lehnt der Auftraggeber eine von einem Institut verlangte Erklärung nach Ziffer 8 Absatz 5 ab oder unterschreibt er einen ihm vollständig vorbereitet vorgelegten Kartenantrag oder Finanzierungsvertrag nicht, zählen die Karte oder der Rahmen, die das Institut der Gesellschaft dazu angeboten oder in Aussicht gestellt hat, für das Garantieziel als erhalten. Die Leistungen nach Absatz 2 dienen diesem Ziel.`,
    vertragKapitalereignis: "Das Kapitalereignis macht nur die Vergütung für Teil 2 fällig (Ziffer 5 Absatz 3); die Garantie nach Absatz 1 gilt bis zum Ende der Frist fort.",
    vertragBegleitung: "Die Kapital-Begleitung beginnt mit der Eintragung der Gesellschaft. FIAON setzt sie fort, bis das Garantieziel nach Absatz 1 erreicht ist; erreicht die Gesellschaft es bis zum Ende der Frist nach Ziffer 6 nicht vollständig, endet die Kapital-Begleitung mit dem Fristende, und es gilt Ziffer 6 Absatz 2.",
    vertragTeil2: "Erreicht die Gesellschaft das Garantieziel (Ziffer 3 Absatz 1) bis zum Ende der Frist nicht vollständig, entfällt eine noch nicht gezahlte Vergütung für Teil 2, und eine bereits gezahlte erstattet FIAON nach Ziffer 6 Absatz 2.",
    vertragFall: "Erreicht die Gesellschaft das Garantieziel nach Ziffer 3 Absatz 1 bis zum Ende der Frist nicht vollständig, gilt:",
    vertragEigeneZusage: "Die Garantie nach Ziffer 3 Absatz 1 und die Erstattung nach Absatz 2 sind eine eigene Zusage von FIAON; sie gelten, vorbehaltlich Absatz 4, unabhängig davon, aus welchem Grund ein Institut einen Antrag ablehnt oder einen geringeren Rahmen einräumt. Folge eines nicht vollständig erreichten Garantieziels ist die vollständige Erstattung nach Absatz 2: Erreicht die Gesellschaft das Garantieziel nicht vollständig, hat der Auftraggeber deswegen ausschließlich die Rechte nach Absatz 2; weitergehende Ansprüche wegen des Nichterreichens des Garantieziels, insbesondere auf Schadensersatz statt der Leistung, entgangenen Gewinn oder Kosten einer anderen Finanzierung, sind ausgeschlossen. Unberührt bleiben die Haftung nach Ziffer 12 Absatz 1 Satz 1 und das Widerrufsrecht nach Ziffer 11.",
    vertragKundenentscheidung: "(deren Folge für das Garantieziel regelt Ziffer 3 Absatz 1).",
    vertragTeil2Verzug: "Die Frist ruht ferner, solange die nach Ziffer 5 Absatz 3 fällige Vergütung für Teil 2 nicht gezahlt ist, und zwar vom Tag nach ihrer Fälligkeit bis zum Tag ihres Eingangs; FIAON teilt das neue Fristende in Textform mit.",
    vertragEigenerAntrag: "Stellt die Gesellschaft ohne FIAON einen Antrag bei einem Institut, teilt der Auftraggeber das FIAON mit, ebenso die Entscheidung des Instituts; was die Gesellschaft daraus erhält, zählt für das Garantieziel (Ziffer 3 Absatz 1). Vor der Erstattung nach Ziffer 6 Absatz 2 teilt der Auftraggeber FIAON auf Anforderung in Textform mit, was die Gesellschaft auf eigene Anträge erhalten hat.",
    vertragBuergschaft: "Ob ein Institut eine Bürgschaft verlangt oder annimmt und zu welchen Bedingungen es finanziert, legt das Institut fest; die Garantie nach Ziffer 3 Absatz 1 und Ziffer 6 bleibt davon unberührt.",
    vertragLaufzeit: "Die Kapital-Begleitung endet, sobald die Gesellschaft das Garantieziel nach Ziffer 3 Absatz 1 erreicht hat, spätestens mit dem Ende der Frist nach Ziffer 6 (Ziffer 3 Absatz 5). Für Anforderungen nach Anlage 1 Ziffer 7 endet die Kapital-Begleitung jedoch erst mit dem Ende der Frist nach Ziffer 6, wenn bis dahin kein Kapitalereignis eingetreten ist, sonst zwölf Monate nach dem Kapitalereignis.",
    vertragKuendigung: "Beendet er ihn vor dem Ende der Frist nach Ziffer 6, ohne dass FIAON ihm dafür einen wichtigen Grund gegeben hat, entfallen die Garantie und die Erstattung nach Ziffer 6 sowie eine Vergütung für Teil 2, die bis dahin noch nicht nach Ziffer 5 Absatz 3 fällig geworden ist; eine bereits fällig gewordene Vergütung für Teil 2 bleibt geschuldet.",
    vertragHaftung: "Für Entscheidungen von Behörden, Steuerberatern und Anwälten haftet FIAON nicht; für Entscheidungen von Banken und Kartenherausgebern gilt allein die Garantie nach Ziffer 3 Absatz 1 mit der Erstattung nach Ziffer 6 Absatz 2 und 5.",
    vertragHaftungUnberuehrt: "Die Erstattung nach Ziffer 6 Absatz 2 bleibt von dieser Ziffer unberührt.",
    vertragAnlage2: "Anlage 2 gibt den Stand der Prüfung vor Vertragsschluss wieder; sie ist keine Entscheidung eines Instituts und schränkt die Garantie nach Ziffer 3 Absatz 1 nicht ein.",
    // ── Seite und Übersicht (Ansprache des Kunden) ──
    seiteTitel: "Ihre US-Gesellschaft. Komplett gegründet, mit Ihrem Team vor Ort — Kreditrahmen und Karten garantiert.",
    seiteLead: `Und wir garantieren Ihnen: In ${w} Wochen ab unserem Start erhält Ihre Gesellschaft einen ${ziel} — mit einer Bürgin an Ihrer Seite.`,
    nutzenKredit: `Garantiert: ein Kreditrahmen von ${angebotUsdKurz(p.kapitalZielUsd)} für Ihre Gesellschaft`,
    nutzenKarten: `Garantiert: ${karten} für Ihre Gesellschaft`,
    siegel: `Kredit garantiert: Ihre Gesellschaft erhält in ${w} Wochen ab unserem Start einen ${ziel} — oder Sie erhalten alles zurück, was Sie uns gezahlt haben.`,
    bekommenKreditTitel: `Garantiert: ${rahmen}`,
    bekommenKreditText: `Wir garantieren Ihrer Gesellschaft einen ${rahmen} in ${w} Wochen ab unserem Start. Wir bereiten jeden Antrag vollständig vor und begleiten ihn, bis der Rahmen eingeräumt ist.`,
    bekommenKartenTitel: `Garantiert: ${karten}`,
    bekommenKartenText: `Dazu garantieren wir Ihrer Gesellschaft ${karten} in derselben Frist — nach einem Plan, der die Reihenfolge der Anträge auf Ihre Gesellschaft abstimmt (Kartenleiter).`,
    ablaufTitel: "Kreditrahmen und Karten — garantiert",
    ablaufGarantie: `Bis zum Ende der Frist erhält Ihre Gesellschaft den ${rahmen} und ${karten} — das garantieren wir.`,
    schutzErfolgFein: "Unsere Vergütung hängt an Ihrem Erfolg und nicht an unserem Aufwand — und erreicht Ihre Gesellschaft das garantierte Ziel nicht, erhalten Sie auch sie zurück.",
    schutzTitel: "Ihre Garantie: Kreditrahmen und Karten — oder alles zurück",
    tafelTeil2: "erreicht Ihre Gesellschaft das garantierte Ziel nicht, erhalten Sie auch diesen Betrag zurück",
    investitionGarantie: "Erreicht Ihre Gesellschaft das garantierte Ziel nicht, erhalten Sie beides zurück.",
    uebersichtLeistung: `mit Garantie: ${ziel} binnen ${w} Wochen ab unserem Start`,
    uebersichtLaufzeit: `Kapital-Begleitung, bis das Garantieziel erreicht ist, längstens bis zum Ende der Frist von ${w} Wochen`,
    // ── Mails (vom Server als fertiger Satz in {{params.garantie_text}}) ──
    mail: `Bis zum Ende Ihrer Frist erhält Ihre Gesellschaft einen ${ziel} — das garantieren wir Ihnen. Erreicht sie das nicht vollständig, erstatten wir Ihnen alles, was Sie uns gezahlt haben, und eine offene Rechnung über Teil 2 entfällt.`,
  };
}
/** Garantie-Sätze ohne Parameter (Annahme-Kasten, Mein Auftrag) — dieselbe Regel wie angebotGarantie. */
export const ANGEBOT_GARANTIE_FEST = {
  annahmeUnterKnopf: "Kreditrahmen und Karten garantieren wir — sonst erhalten Sie alles zurück.",
  meinAuftragFrist: "Erhält Ihre Gesellschaft bis dahin nicht den garantierten Kreditrahmen und die garantierten Karten, erstatten wir Ihnen alles, was Sie uns gezahlt haben; eine offene Rechnung über Teil 2 entfällt.",
  meinAuftragErstattung: "Die Frist ist abgelaufen, ohne dass das garantierte Ziel erreicht ist. Wir erstatten Ihnen alles, was Sie uns gezahlt haben; eine offene Rechnung über Teil 2 entfällt.",
  meinAuftragHinweis: "Für Kreditrahmen und Karten gilt Ihre Garantie aus Ziffer 3 und 6 Ihres Vertrags. Steuerliche und rechtliche Fragen beantworten Steuerberater und Anwälte auf eigenes Mandat.",
  fussnote: "Für Kreditrahmen und Karten gilt Ihre Garantie aus Ziffer 3 und 6 Ihres Vertrags.",
  // Meta-Beschreibung der Angebotsseite (Linkvorschau) — auch sie kommt aus der einen Quelle (Gegenprüfung, oberflaeche-5).
  metaBeschreibung: "Persönliches Angebot von FIAON Global: Gründung Ihrer US-Gesellschaft mit garantiertem Kreditrahmen und Business-Kreditkarten.",
  // Office (Global-Akte, Kasten „Was ich dem Kunden NICHT zusage“) bei Aufträgen aus dem Individualangebot.
  officeVerbot: "NIE einen Banknamen, Zinssatz oder Termin zusagen. Kreditrahmen und Karten sagst du nur so zu, wie der Vertrag es tut (Ziffer 3 Absatz 1, Ziffer 6): garantiert bis zum Fristende — sonst bekommt der Kunde alles zurück, was er gezahlt hat.",
  officeSatz: "„Ihr Vertrag garantiert Ihrer Gesellschaft bis zum Fristende den vereinbarten Kreditrahmen und die vereinbarten Karten — sonst erhalten Sie alles zurück, was Sie uns gezahlt haben.“",
  // Teil-2-Mails nach erfüllter Garantie (Gegenprüfung, logik-5) — dann gibt es keine Erstattung mehr.
  mailErfuellt: "Ihre Gesellschaft hat den Kreditrahmen und die Karten aus Ihrem Vertrag erhalten — Ihre Garantie ist erfüllt.",
} as const;
/** Kurze Etiketten, die als Ganzes „Garantie“ tragen — der Prüfstand nimmt sie mit heraus. */
export const ANGEBOT_GARANTIE_ETIKETTEN = ["Ihre Garantie", "Ihrer Garantie", "Kredit garantiert", "Garantie erfüllt"] as const;
/**
 * Pflichthinweise DIESES Angebots: wörtlich GLOBAL_PFLICHTHINWEIS.de, nur ohne den Institut-Satz (E-271) — der
 * Vertrag garantiert Kreditrahmen und Karten. GLOBAL_PFLICHTHINWEIS selbst bleibt unverändert (vier Pakete, ~40 Seiten).
 */
export const ANGEBOT_PFLICHTHINWEIS: readonly string[] = [
  GLOBAL_PFLICHTHINWEIS.de[0],
  GLOBAL_PFLICHTHINWEIS.de[1],
  GLOBAL_PFLICHTHINWEIS.de[2].replace(/\s*Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut\.\s*$/, ""),
];

/** „Herr Hildbrand" / „Frau …" / voller Name — für Begrüßung und Anrede auf der Seite. */
export function angebotKundeGruss(k: Pick<AngebotKunde, "anrede" | "vorname" | "nachname">): string {
  const nach = String(k.nachname || "").trim();
  if (k.anrede && nach) return `${k.anrede} ${nach}`;
  return angebotKundeName(k);
}
export function angebotGesamtCents(p: AngebotParameter): number {
  return p.teil1Cents + p.teil2Cents;
}
/** „04.11.1971" aus „1971-11-04" */
export function angebotTag(iso: string | null | undefined): string {
  const m = String(iso ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}
export const ANGEBOT_LAND_NAME: Record<AngebotLand, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
export function angebotKundeName(k: Pick<AngebotKunde, "vorname" | "nachname">): string {
  return [k.vorname, k.nachname].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
}
/** „Herrn William Hildbrand" (für …) */
export function angebotKundeAnrede(k: Pick<AngebotKunde, "anrede" | "vorname" | "nachname">): string {
  const a = k.anrede === "Herr" ? "Herrn " : k.anrede === "Frau" ? "Frau " : "";
  return `${a}${angebotKundeName(k)}`.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETER UND PFLICHTFELDER PRÜFEN (rein — Server und Prüfstand)
// ═══════════════════════════════════════════════════════════════════════════
/** Grenzen, in denen der Wortlaut trägt (Zahlwörter, Beträge). Gibt den ersten Fehler zurück oder null. */
export function angebotParameterFehler(p: AngebotParameter): string | null {
  const ganz = (n: unknown) => Number.isInteger(n);
  if (!ganz(p.teil1Cents) || p.teil1Cents < 10000 || p.teil1Cents > 10_000_000) return "Teil 1: Betrag zwischen 100 € und 100.000 €.";
  if (!ganz(p.teil2Cents) || p.teil2Cents < 10000 || p.teil2Cents > 10_000_000) return "Teil 2: Betrag zwischen 100 € und 100.000 €.";
  if (!ganz(p.fristWochen) || p.fristWochen < 4 || p.fristWochen > 26) return "Frist: vier bis sechsundzwanzig Wochen.";
  if (!ganz(p.erstattungTage) || p.erstattungTage < 7 || p.erstattungTage > 30) return "Erstattung: sieben bis dreißig Tage.";
  if (!ganz(p.teil2ZielTage) || p.teil2ZielTage < 3 || p.teil2ZielTage > 30) return "Zahlungsziel Teil 2: drei bis dreißig Tage.";
  if (!ganz(p.kartenZiel) || p.kartenZiel < 1 || p.kartenZiel > 5) return "Garantierte Karten: eine bis fünf.";
  if (!ganz(p.kapitalZielUsd) || p.kapitalZielUsd < 10000 || p.kapitalZielUsd > 5_000_000) return "Garantierter Kreditrahmen: 10.000 bis 5.000.000 US-Dollar.";
  if (!ganz(p.buergschaftUsd) || p.buergschaftUsd < 0 || p.buergschaftUsd > 5_000_000) return "Höchstbetrag der Bürgschaft: 0 bis 5.000.000 US-Dollar.";
  return null;
}

/**
 * Was der Annahme noch fehlt — in Sätzen, die im Chefbüro am gesperrten Knopf stehen
 * (AGENTS.md: kein gesperrter Knopf ohne sichtbaren Grund). Leer = annehmbar.
 */
export function angebotPflichtFehlen(d: Pick<AngebotDaten, "buergin" | "pruefbericht" | "kunde">): string[] {
  const fehlt: string[] = [];
  for (const f of BUERGIN_FELDER) {
    const w = d.buergin[f.schluessel];
    if (w == null || String(w).trim() === "") fehlt.push(`Bürgin: ${f.bezeichnung}`);
  }
  if (d.buergin.unterzeichnetAm && !/^\d{4}-\d{2}-\d{2}$/.test(d.buergin.unterzeichnetAm)) fehlt.push("Bürgin: Datum der Unterschrift (JJJJ-MM-TT)");
  if (!d.buergin.bestaetigt) fehlt.push("Bürgin: Bundesstaat, Anschrift und Vertretung bestätigt (Haken)");
  if (!d.pruefbericht) fehlt.push("Anlage 2: Prüfbericht");
  if (!angebotKundeName(d.kunde) || !d.kunde.strasse || !d.kunde.plz || !d.kunde.ort || !d.kunde.email || !geburtsdatumIso(d.kunde.geburtsdatum)) {
    fehlt.push("Kunde: Name, Anschrift, Geburtsdatum und E-Mail");
  }
  return fehlt;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER VERTRAG — Ziffern als Struktur (Vertragssprache)
// ═══════════════════════════════════════════════════════════════════════════
export type AngebotAbsatz = { art: "p"; text: string } | { art: "liste"; einleitung?: string; zeilen: string[] };
export interface AngebotZiffer { nr: number; titel: string; absaetze: AngebotAbsatz[] }

const p = (text: string): AngebotAbsatz => ({ art: "p", text });
const liste = (zeilen: string[], einleitung?: string): AngebotAbsatz => (einleitung ? { art: "liste", einleitung, zeilen } : { art: "liste", zeilen });

export function angebotVertragTitel(): string {
  return "FIAON Global — Individualvereinbarung Gründung & Kapital-Begleitung";
}
export function angebotVertragUnterzeile(d: Pick<AngebotDaten, "ref" | "fassung" | "gueltigBis">): string {
  // E-271: „Kredit garantiert“ steht in der Unterzeile (nicht im Titel — der Titel ist Teil des Wortlauts der Anlage 1).
  return `${ANGEBOT_MARKE} · Kredit garantiert · Vertragsfassung ${d.fassung} · Angebot ${d.ref} · gültig bis ${angebotTag(d.gueltigBis)}`;
}

export function angebotPraeambel(d: AngebotDaten): string[] {
  const G = angebotGarantie(d.parameter);
  return [
    "Der Auftraggeber möchte eine Gesellschaft in den USA in der Rechtsform einer Limited Liability Company (LLC) gründen und für diese Gesellschaft Kapital und Business-Kreditkarten bei US-Instituten beantragen.",
    `FIAON übernimmt die Gründung vollständig und begleitet anschließend die Anträge der Gesellschaft. Die Vereinbarung ist so aufgebaut, dass der größere Teil der Vergütung erst fällig wird, wenn das erste Kapital an die Gesellschaft ausgezahlt oder die erste Business-Kreditkarte für die Gesellschaft freigeschaltet ist. ${G.vertragPraeambel}`,
    G.vertragPraeambelInstitut,
  ];
}

/** Die fünfzehn Ziffern — Varianten nach den Haken des Kunden schon aufgelöst. */
export function angebotZiffern(d: AngebotDaten, s: AngebotSchalter): AngebotZiffer[] {
  const k = d.kunde; const par = d.parameter;
  const PH = ANGEBOT_PFLICHTHINWEIS;
  const JB = GLOBAL_JAHRESBETREUUNG.de;
  const G = angebotGarantie(par);
  const t1 = angebotEur(par.teil1Cents); const t2 = angebotEur(par.teil2Cents); const ges = angebotEur(angebotGesamtCents(par));
  const wochen = zahlwort(par.fristWochen);
  const hb = angebotUsd(par.buergschaftUsd);
  const buergin = d.buergin.name;
  // „Starten ab" (01.10.2026): der vom Kunden gewählte Starttag — „08.10.2026" oder null.
  const startTag = s.startAm && /^\d{4}-\d{2}-\d{2}$/.test(s.startAm) ? angebotTag(s.startAm) : null;
  return [
    { nr: 1, titel: "Parteien", absaetze: [
      p(`${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}, eingetragen im ${FIAON_FIRMA.register} unter der Company No. ${FIAON_FIRMA.companyNo}, vertreten durch den Director ${FIAON_FIRMA.director}, E-Mail ${FIAON_FIRMA.email} — nachfolgend „FIAON“.`),
      p(`${angebotKundeName(k)}, geboren am ${angebotTag(k.geburtsdatum)}, wohnhaft ${k.strasse}, ${k.plz} ${k.ort}, ${ANGEBOT_LAND_NAME[k.land] ?? k.land}, E-Mail ${k.email} — nachfolgend „Auftraggeber“.`),
      p(`Die US-Gesellschaft, die FIAON nach Ziffer 2 für den Auftraggeber gründet, heißt nachfolgend „Gesellschaft“. Die ${buergin} ist nicht Partei dieses Vertrags; sie gibt die Bürgschaftszusage in Anlage 1 ab. Die ${buergin} ist mit FIAON über deren Director ${FIAON_FIRMA.director} verbunden.`),
    ] },

    { nr: 2, titel: "Teil 1 — Gründung", absaetze: [
      liste([
        "Vorgespräch und Wahl des Bundesstaats: Vergleich der in Frage kommenden Bundesstaaten nach Gebühren, laufenden Pflichten und den Anforderungen der Institute; die Wahl trifft der Auftraggeber nach der Prüfung durch einen Partner-Steuerberater von FIAON",
        "Prüfung des gewünschten Namens der Gesellschaft beim Bundesstaat und, soweit nötig, dessen Reservierung",
        "Vorbereitung und Einreichung der Gründungsurkunde (Articles of Organization bzw. Certificate of Formation) bis zur Eintragung der Gesellschaft; die staatlichen Gründungsgebühren trägt FIAON",
        "Registered Agent im Bundesstaat der Gründung, US-Geschäftsadresse und US-Telefonnummer für das erste Jahr",
        "Operating Agreement, zugeschnitten auf den Auftraggeber als Gesellschafter, und die Gründungsbeschlüsse der Gesellschaft (Organizational Resolutions) durch einen Partner-Anwalt von FIAON",
        "EIN: Antrag beim IRS (Formular SS-4) vorbereitet und eingereicht, bis zur Bestätigung der EIN",
        "ITIN: Antrag (Formular W-7) vorbereitet und eingereicht, soweit der Auftraggeber eine ITIN für Konto- oder Kartenanträge benötigt",
        "Prüfung vor der Gründung durch einen Partner-Steuerberater von FIAON, einschließlich der Fragen zur Steuerpflicht im Wohnsitzstaat und zur Meldung der Gründung an das Finanzamt (§ 138 AO)",
        "Alle Meldungen beim Bundesstaat und alle staatlichen Gebühren der Gesellschaft, die bis zum ersten Jahrestag der Eintragung fällig werden",
        "Erste jährliche US-Meldung (Form 5472 mit Form 1120) durch einen US-CPA aus dem Partnernetz von FIAON",
        "US-Geschäftskonto: Auswahl geeigneter Institute für Gesellschafter ohne Wohnsitz in den USA, vollständige Vorbereitung des Kontoantrags und Begleitung bis zur Entscheidung des Instituts",
        "Betriebswirtschaftliche Begleitung durch einen Partner aus dem Netzwerk von FIAON: Geschäftsmodell und Geschäftsplan der Gesellschaft, Kennzahlen und die Unterlagen, die Institute verlangen",
        "Ein persönlicher Assistent als fester Ansprechpartner für den gesamten Auftrag und ein Dokumentenraum mit allen Unterlagen der Gesellschaft",
        "Pflichtenkalender mit allen US-Fristen des ersten Jahres",
        "Übergabe aller Gründungsunterlagen (Gründungsurkunde, Operating Agreement, Gründungsbeschlüsse, EIN-Bestätigung) im Dokumentenraum; Originale, soweit sie ausgestellt werden, per Post",
      ], "FIAON gründet für den Auftraggeber eine Limited Liability Company in einem US-Bundesstaat, mit dem Auftraggeber als Gesellschafter, und übernimmt jeden Schritt bis zur arbeitsfähigen Gesellschaft. Teil 1 umfasst:"),
      // Gegenprüfung 01.10.2026: „alle Kosten der Gesellschaft" wäre unwahr (Ziffer 5 Absatz 5 nennt, was nicht
      // enthalten ist) — zugesagt sind alle Gebühren und Honorare für die Leistungen nach Absatz 1.
      p("Für die Leistungen nach Absatz 1 entstehen dem Auftraggeber im ersten Jahr nach der Eintragung keine weiteren Kosten. Alle Gebühren und Honorare dafür — insbesondere die staatlichen Gründungs- und Jahresgebühren, Registered Agent, Geschäftsadresse und Telefonnummer, EIN, Operating Agreement, die Meldungen des ersten Jahres, der persönliche Assistent sowie die Honorare des Partner-Anwalts, des Partner-Steuerberaters, des US-CPA und des Partners für die betriebswirtschaftliche Begleitung — trägt FIAON; sie sind in der Vergütung für Teil 1 enthalten. Versteckte Gebühren gibt es nicht; was nicht zu den Leistungen gehört, nennt Ziffer 5 Absatz 5."),
      p("Für die Leistungen nach Absatz 1 hat der Auftraggeber im ersten Jahr nichts selbst zu veranlassen: FIAON bereitet jeden Schritt vollständig vor und reicht ihn ein. Die Mitwirkung des Auftraggebers beschränkt sich auf Ziffer 7 Absatz 1 — Unterschriften unter fertig vorbereitete Unterlagen (einschließlich der Mandate für die Partner nach Ziffer 4), seinen Reisepass für die gesetzlich vorgeschriebene Identifizierung und wahre Angaben."),
      p(GLOBAL_ROLLEN.de.fiaon),
    ] },

    { nr: 3, titel: G.vertragTitel3, absaetze: [
      p(G.vertragZiel),
      liste([
        "Plan für die Reihenfolge der Anträge bei Instituten und Kartenherausgebern, abgestimmt auf die Gesellschaft (Kartenleiter)",
        "Vollständige Vorbereitung jedes Antrags der Gesellschaft auf eine Finanzierung oder eine Business-Kreditkarte, einschließlich Unterlagen, Kennzahlen und Geschäftsplan",
        "Begleitung jedes Antrags bis zur Entscheidung des Instituts, einschließlich der Rückfragen des Instituts",
        `Stellung einer Bürgin: Die ${buergin} übernimmt auf Anforderung eines Instituts nach Maßgabe der Bürgschaftszusage in Anlage 1 eine Bürgschaft für Finanzierungen der Gesellschaft bis zum Höchstbetrag von insgesamt ${hb}; FIAON stimmt die Anforderung zwischen Institut und Bürgin ab`,
        "Monatlicher Durchgang mit dem Ansprechpartner",
        "Laufende Abstimmung mit Partner-Anwalt und Partner-Steuerberater zu Fragen der Kapital-Etappe, Honorare inklusive",
      ], "Teil 2 umfasst:"),
      p("Anträge bei Instituten stellt die Gesellschaft im eigenen Namen; FIAON bereitet sie vor und begleitet sie. FIAON ist keine Bank und kein Kreditgeber, nimmt keine Kundengelder entgegen und verfügt nicht über Konten des Auftraggebers oder der Gesellschaft. Verträge mit Instituten schließt die Gesellschaft selbst."),
      p("Kapitalereignis im Sinne dieses Vertrags ist, was zuerst eintritt: (a) die erste Auszahlung einer Finanzierung eines Instituts auf ein Konto der Gesellschaft oder (b) die Freischaltung der ersten Business-Kreditkarte, die ein Institut für die Gesellschaft ausgibt — jeweils auf einen Antrag, den FIAON vorbereitet oder begleitet hat. Maßgeblich ist der Tag der Auszahlung oder der Freischaltung. Eine Mindesthöhe gilt nicht: Jede erste Auszahlung und jede erste Karte zählt unabhängig von ihrer Höhe. " + G.vertragKapitalereignis),
      p(G.vertragBegleitung),
    ] },

    { nr: 4, titel: "Partner und Abgrenzung", absaetze: [
      p("Steuerliche und rechtliche Leistungen im Umfang der Ziffern 2 und 3 erbringen Steuerberater, US-CPA und Anwälte aus dem Partnernetz von FIAON auf eigenes Mandat des Auftraggebers bzw. der Gesellschaft. Den Partner für die betriebswirtschaftliche Begleitung beauftragt FIAON. Die Honorare aller Partner für diese Leistungen trägt FIAON; sie sind in der Vergütung enthalten. Erhält FIAON von einem Partner eine Vergütung dafür, dass es ihm den Auftraggeber oder die Gesellschaft zuführt, legt FIAON das dem Auftraggeber vor der Beauftragung dieses Partners offen. Leistungen darüber hinaus vereinbart der Auftraggeber unmittelbar mit dem Partner."),
    ] },

    { nr: 5, titel: "Vergütung und Fälligkeit", absaetze: [
      liste([`Teil 1 „Gründung“: ${t1}`, `Teil 2 „Kapital-Begleitung“: ${t2}`], `Die Vergütung beträgt insgesamt ${ges}. Sie besteht aus zwei Teilen:`),
      p(`Die Vergütung für Teil 1 ist mit Vertragsschluss fällig. FIAON stellt die Rechnung bei Annahme dieses Vertrags; sie ist sofort ohne Abzug per Überweisung auf das in der Rechnung genannte Konto zu zahlen. ${
        startTag
          ? `FIAON beginnt an dem vom Auftraggeber gewählten Starttag, dem ${startTag}, frühestens mit dem Zahlungseingang.`
          : s.sofortBeginn
            ? "FIAON beginnt mit dem Zahlungseingang."
            : "FIAON beginnt nach Ablauf der Widerrufsfrist (Ziffer 11), frühestens mit dem Zahlungseingang."}`),
      p(`Die Vergütung für Teil 2 wird erst fällig, wenn die Gesellschaft eingetragen ist und das Kapitalereignis (Ziffer 3 Absatz 4) innerhalb der Frist nach Ziffer 6 eingetreten ist. FIAON teilt den Eintritt in Textform mit und stellt die Rechnung danach; sie ist binnen ${zahlwort(par.teil2ZielTage)} Tagen nach Zugang per Überweisung zu zahlen. ${G.vertragTeil2}`),
      p(`Die Vergütung ist ein Festpreis. Sie umfasst alle Gebühren und Honorare für die Leistungen nach Ziffer 2 und 3 einschließlich der Bürgschaft nach Anlage 1; eine gesonderte Vergütung für die Bürgschaft verlangen weder FIAON noch die ${buergin}. Für den Auftraggeber als Privatperson ist die Vergütung ein Endpreis; eine etwa anfallende Umsatzsteuer ist darin enthalten.`),
      liste([
        "laufende Kosten der Gesellschaft ab dem zweiten Jahr nach der Eintragung (Staatsgebühr, Registered Agent und jährliche US-Meldung), soweit nicht die Jahresbetreuung nach Absatz 6 sie umfasst; FIAON nennt sie dem Auftraggeber rechtzeitig vorab",
        "die laufende Buchhaltung der Gesellschaft und die Steuererklärungen im Wohnsitzstaat",
        "Umsatzsteuer-Registrierungen in einzelnen US-Bundesstaaten",
        "Gebühren, Einlagen, Zinsen oder Jahresgebühren, die ein Institut selbst verlangt",
      ], "Nicht in der Vergütung enthalten sind:"),
      s.jahresbetreuung
        ? p(`${JB.vertrag} ${JB.vertragBedingungen} Für den Auftraggeber als Privatperson ist auch dieser Preis ein Endpreis; heute fällig ist er nicht.`)
        : p("Die Jahresbetreuung ab dem zweiten Jahr (699 € je Betreuungsjahr, alle Gebühren inklusive) ist nicht Teil dieses Vertrags; der Auftraggeber kann sie später gesondert dazubuchen."),
    ] },

    { nr: 6, titel: G.vertragTitel6, absaetze: [
      startTag
        ? p(`Die Frist beträgt ${wochen} Wochen. Sie beginnt mit dem Tag, an dem die Vergütung für Teil 1 bei FIAON eingeht, frühestens jedoch an dem vom Auftraggeber gewählten Starttag, dem ${startTag}. FIAON teilt dem Auftraggeber Beginn und Ende der Frist in Textform mit.`)
        : s.sofortBeginn
        ? p(`Die Frist beträgt ${wochen} Wochen. Sie beginnt mit dem Tag, an dem die Vergütung für Teil 1 bei FIAON eingeht. FIAON teilt dem Auftraggeber Beginn und Ende der Frist in Textform mit.`)
        : p(`Die Frist beträgt ${wochen} Wochen. Sie beginnt mit dem Tag, an dem die Vergütung für Teil 1 bei FIAON eingeht, frühestens jedoch mit dem Tag, an dem FIAON nach Ablauf der Widerrufsfrist mit der Ausführung beginnt. FIAON teilt dem Auftraggeber Beginn und Ende der Frist in Textform mit.`),
      liste([
        "Eine noch nicht gezahlte Vergütung für Teil 2 entfällt; eine bereits gestellte, noch offene Rechnung über Teil 2 storniert FIAON.",
        `FIAON erstattet dem Auftraggeber alles, was er an FIAON gezahlt hat — die Vergütung für Teil 1 (${t1}) und, soweit gezahlt, die Vergütung für Teil 2 (${t2}) —, vollständig, ohne Abzug für bereits erbrachte Leistungen und ohne dass es einer Aufforderung bedarf, binnen ${zahlwort(par.erstattungTage)} Tagen nach Fristende auf das Konto, von dem gezahlt wurde.`,
        "Die Gesellschaft und alle nach Ziffer 2 erbrachten Leistungen verbleiben beim Auftraggeber.",
      ], G.vertragFall),
      p(`Die Frist ruht nur, solange der Auftraggeber eine der drei Mitwirkungen nach Ziffer 7 Absatz 1 schuldhaft nicht erbringt: eine Unterschrift unter eine von FIAON vollständig vorbereitete Unterlage, die Vorlage seines gültigen Reisepasses zur gesetzlich vorgeschriebenen Identifizierung (und, soweit ein Institut oder eine Behörde ihn dafür verlangt, eines Adressnachweises) oder wahre Angaben. Das setzt voraus, dass FIAON die konkret benötigte Mitwirkung in Textform angefordert und dafür eine Frist von mindestens ${zahlwort(ANGEBOT_FEST.hemmungAufforderungTage)} Tagen gesetzt hat; die Frist ruht ab dem Ablauf dieser Aufforderungsfrist, bis die Mitwirkung erbracht ist. Verzögerungen bei Behörden, beim IRS, bei Instituten, bei der Bürgin oder bei Partnern von FIAON lassen die Frist weiterlaufen; ebenso die Ablehnung eines Antrags durch ein Institut und die Entscheidung des Auftraggebers nach Ziffer 8 Absatz 5 ${G.vertragKundenentscheidung} ${G.vertragTeil2Verzug}`),
      p("Beruht die Ablehnung eines Antrags auf vorsätzlich falschen Angaben des Auftraggebers, besteht kein Anspruch auf die Erstattung nach Absatz 2."),
      p(G.vertragEigeneZusage),
    ] },

    { nr: 7, titel: "Mitwirkung des Auftraggebers", absaetze: [
      p("Die Mitwirkung des Auftraggebers beschränkt sich auf drei Dinge: Er unterschreibt, was FIAON ihm fertig vorbereitet vorlegt (Gründungsunterlagen, die Mandate für Partner-Steuerberater, Partner-Anwalt und US-CPA, Steuerformulare einschließlich der Meldung der Gründung an das Finanzamt nach § 138 AO, Kontoanträge, Kartenanträge und Finanzierungsverträge); er stellt seinen gültigen Reisepass für die gesetzlich vorgeschriebene Identifizierung bereit — bei FIAON und, soweit ein Institut oder eine Behörde es verlangt, auch dort, dann zusammen mit einem Adressnachweis, wenn das Institut oder die Behörde ihn für die Identifizierung verlangt; und er macht wahre und vollständige Angaben. Alles Weitere erledigt FIAON. Jede Unterschrift leistet der Auftraggeber nach Prüfung der Unterlage und frei; verlangt ein Institut eine persönliche Haftung, gilt Ziffer 8 Absatz 5. Anträge bei Behörden und Instituten stellen der Auftraggeber bzw. die Gesellschaft im eigenen Namen; FIAON bereitet sie vor. Gegenüber Instituten und Behörden macht der Auftraggeber keine falschen Adress- oder Wohnsitzangaben."),
      p(G.vertragEigenerAntrag),
      p("Verzögert sich die Mitwirkung, verschieben sich vereinbarte Termine entsprechend; für die Frist nach Ziffer 6 gilt allein Ziffer 6 Absatz 3."),
      p("Vor Beginn der Leistungen identifiziert FIAON den Auftraggeber anhand eines gültigen Reisepasses und gleicht Name und Geburtsdatum erneut mit den Sanktionslisten ab. Der Auftraggeber erklärt, dass weder er selbst noch ein Familienmitglied oder eine ihm bekanntermaßen nahestehende Person ein wichtiges öffentliches Amt ausübt oder in den letzten zwölf Monaten ausgeübt hat (§ 1 Abs. 12 bis 14 GwG); trifft das nicht zu, teilt er es FIAON vor der Annahme in Textform mit."),
    ] },

    { nr: 8, titel: "Bürgschaft und keine Sicherheiten", absaetze: [
      p(`Die ${buergin} sagt in Anlage 1 zu, auf Anforderung eines finanzierenden Instituts eine Bürgschaft für Finanzierungen der Gesellschaft bis zum Höchstbetrag von insgesamt ${hb} zu übernehmen. Die Zusage ist von der ${buergin} eigenhändig unterzeichnet; der Auftraggeber erhält sie im Original, eine Abschrift ist diesem Vertrag als Anlage 1 beigefügt.`),
      p(G.vertragBuergschaft),
      p(`Zahlt die ${buergin} als Bürgin an ein Institut, kann sie von der Gesellschaft als Hauptschuldnerin Ersatz des gezahlten Betrags verlangen (Anlage 1 Ziffer 6). Das ist die gesetzliche Folge jeder Bürgschaft. Eine persönliche Haftung des Auftraggebers für diesen Ersatz wird nicht vereinbart.`),
      p(`Weder FIAON noch die ${buergin} verlangen vom Auftraggeber oder von der Gesellschaft Sicherheiten — keine Rückbürgschaft, keine Bareinlage, keine Verpfändung und keine Grundschuld.`),
      p("Verlangt ein Institut für eine Karte oder Finanzierung selbst eine Erklärung des Auftraggebers — etwa die bei US-Firmenkarten übliche persönliche Haftung des Inhabers (Ziffer 9) —, nennt FIAON das dem Auftraggeber vor dem Antrag. Ob er den Antrag dann unterschreibt, entscheidet der Auftraggeber frei; für die Frist gilt Ziffer 6 Absatz 3."),
    ] },

    { nr: 9, titel: "Pflichthinweise", absaetze: [
      liste([...PH], "Der Auftraggeber nimmt die folgenden Hinweise zur Kenntnis:"),
      p(`Die Bürgschaft der ${buergin} ersetzt eine vom Institut verlangte persönliche Haftung des Inhabers nur, wenn das Institut dem zustimmt.`),
    ] },

    { nr: 10, titel: "Laufzeit und Ende", absaetze: [
      p("Der Vertrag beginnt mit der Annahme durch den Auftraggeber. Die Leistungen für das erste Jahr nach Ziffer 2 (Registered Agent, Geschäftsadresse, Telefonnummer, Meldungen und Gebühren) laufen bis zum ersten Jahrestag der Eintragung; die erste jährliche US-Meldung ist in jedem Fall umfasst. " + G.vertragLaufzeit + " Der Vertrag verlängert sich nicht von selbst."),
      p("Der Auftraggeber kann den Vertrag jederzeit in Textform beenden. " + G.vertragKuendigung + " Für Teil 1 steht FIAON die Vergütung dann nur für die bis dahin erbrachten Leistungen zu (§ 628 BGB); ein darüber hinaus gezahlter Betrag wird erstattet."),
      p("FIAON kann den Vertrag nur aus wichtigem Grund beenden. Ein wichtiger Grund liegt insbesondere vor, wenn der Auftraggeber vorsätzlich falsche Angaben macht oder wenn der Auftraggeber oder die Gesellschaft auf einer Sanktionsliste der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs oder der USA geführt wird. Beendet FIAON den Vertrag vor dem Ende der Frist nach Ziffer 6 aus einem Grund, den der Auftraggeber nicht zu vertreten hat, erstattet FIAON dem Auftraggeber alles, was er an FIAON gezahlt hat, vollständig."),
      p("Das Recht beider Parteien zur Beendigung aus wichtigem Grund und das Widerrufsrecht nach Ziffer 11 bleiben unberührt."),
    ] },

    { nr: 11, titel: "Widerrufsrecht", absaetze: [
      p("Handelt der Auftraggeber als Verbraucher (§ 13 BGB), kann er diesen Vertrag binnen vierzehn Tagen nach Maßgabe der Widerrufsbelehrung in Anlage 3 widerrufen; Anlage 3 enthält auch das Muster-Widerrufsformular. Mit dem Widerruf endet auch die Bürgschaftszusage nach Anlage 1."),
      s.sofortBeginn
        ? p(`Der Auftraggeber hat ausdrücklich verlangt, dass FIAON vor Ablauf der Widerrufsfrist mit der Ausführung beginnt${startTag ? ` — an dem von ihm gewählten Starttag, dem ${startTag}` : ""}. Ihm ist bekannt, dass er im Fall des Widerrufs einen angemessenen Betrag für die bis dahin erbrachten Leistungen zahlt und dass sein Widerrufsrecht erlischt, wenn FIAON die Leistungen vollständig erbracht hat.`)
        : startTag
          ? p(`Der Auftraggeber hat nicht verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt. Er hat als Starttag den ${startTag} gewählt, der nach dem Ende der Widerrufsfrist liegt; FIAON beginnt an diesem Tag, frühestens mit dem Zahlungseingang.`)
          : p("Der Auftraggeber hat nicht verlangt, dass FIAON vor Ablauf der Widerrufsfrist beginnt. FIAON beginnt deshalb erst nach Ablauf der Widerrufsfrist, frühestens mit dem Zahlungseingang."),
    ] },

    { nr: 12, titel: "Haftung", absaetze: [
      p(`FIAON haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie bei der Verletzung von Leben, Körper oder Gesundheit. Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten ist die Haftung auf den vertragstypischen, bei Vertragsschluss vorhersehbaren Schaden begrenzt; im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. ${G.vertragHaftung}`),
      p(G.vertragHaftungUnberuehrt),
    ] },

    { nr: 13, titel: "Vertraulichkeit", absaetze: [
      p(`Beide Parteien behandeln nicht öffentliche Informationen der anderen Partei vertraulich, auch nach dem Ende des Vertrags. FIAON gibt Unterlagen nur weiter, soweit es die Leistung erfordert: an Behörden, an den Registered Agent, an die vom Auftraggeber mandatierten Steuerberater und Anwälte, an den Partner der betriebswirtschaftlichen Begleitung, an Institute, bei denen die Gesellschaft einen Antrag stellt, und an die ${buergin} für die Bürgschaft. Anlage 2 gibt FIAON nicht an Dritte weiter.`),
    ] },

    { nr: 14, titel: "Datenschutz", absaetze: [
      p("FIAON verarbeitet personenbezogene Daten des Auftraggebers, um diesen Vertrag zu erfüllen (Art. 6 Abs. 1 Buchst. b DSGVO), und nach der Datenschutzerklärung unter fiaon.com/datenschutz. Dazu gehört vor Vertragsschluss und vor jedem Antrag ein Abgleich von Name und Geburtsdatum mit Sanktionslisten (Art. 6 Abs. 1 Buchst. c und f DSGVO)."),
      p("Für Gründung, Anträge und Bürgschaft gehen Daten in die USA. Für Empfänger, die nicht nach dem EU-U.S. Data Privacy Framework zertifiziert sind, besteht kein Angemessenheitsbeschluss; die Übermittlung stützt sich dann darauf, dass sie für die Erfüllung dieses Vertrags erforderlich ist (Art. 49 Abs. 1 Buchst. b DSGVO)."),
      p("Der Auftraggeber kann Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und Datenübertragbarkeit verlangen, der Verarbeitung nach Art. 6 Abs. 1 Buchst. f DSGVO widersprechen und sich bei einer Datenschutz-Aufsichtsbehörde beschweren."),
    ] },

    { nr: 15, titel: "Schlussbestimmungen", absaetze: [
      p(`Dieser Vertrag ist eine Individualvereinbarung; Allgemeine Geschäftsbedingungen von FIAON gelten für ihn nicht. Beigefügt sind Anlage 1 (Bürgschaftszusage der ${buergin}), Anlage 2 (Prüfbericht von FIAON) und Anlage 3 (Widerrufsbelehrung und Muster-Widerrufsformular). ${G.vertragAnlage2}`),
      p("Änderungen und Ergänzungen bedürfen der Textform. Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Ist der Auftraggeber Verbraucher, gilt diese Rechtswahl nur, soweit ihm dadurch nicht der Schutz entzogen wird, den ihm die zwingenden Bestimmungen des Rechts des Staates seines gewöhnlichen Aufenthalts gewähren. Ist der Auftraggeber Kaufmann, eine juristische Person des öffentlichen Rechts oder ein öffentlich-rechtliches Sondervermögen, ist ausschließlicher Gerichtsstand für alle Streitigkeiten aus diesem Auftrag München. Sollten einzelne Bestimmungen unwirksam sein oder werden, bleibt die Gültigkeit im Übrigen unberührt; an die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften."),
    ] },
  ];
}

/** Die Ziffern, die kein Angebot verlieren darf — der Prüfstand zählt sie nach. */
export const ANGEBOT_ZIFFER_TITEL = [
  "Parteien", "Teil 1 — Gründung", "Teil 2 — Kapital-Begleitung mit Kreditgarantie", "Partner und Abgrenzung", "Vergütung und Fälligkeit",
  "Frist, Garantie und vollständige Erstattung", "Mitwirkung des Auftraggebers", "Bürgschaft und keine Sicherheiten", "Pflichthinweise",
  "Laufzeit und Ende", "Widerrufsrecht", "Haftung", "Vertraulichkeit", "Datenschutz", "Schlussbestimmungen",
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// ANLAGE 1 — BÜRGSCHAFTSZUSAGE DER SCHWARZOTT GLOBAL LLC (Vertragssprache)
// Eine eigene Erklärung der LLC zugunsten des Auftraggebers UND der Gesellschaft
// (§ 328 BGB). Eigenhändig zu unterschreiben: § 766 BGB gilt nach der
// Rechtsprechung auch für das Versprechen, sich zu verbürgen.
// ═══════════════════════════════════════════════════════════════════════════
const LUECKE = (was: string) => `[noch einzutragen: ${was}]`;
function bf(b: AngebotBuergin, k: keyof AngebotBuergin, was: string): string {
  const w = b[k];
  return w == null || String(w).trim() === "" ? LUECKE(was) : String(w);
}
export function buergschaftTitel(d: Pick<AngebotDaten, "buergin">): string {
  return `Anlage 1 — Bürgschaftszusage der ${d.buergin.name}`;
}
export function buergschaftParteien(d: AngebotDaten): string[] {
  const b = d.buergin; const k = d.kunde;
  // Ohne Document Number (Justin, 01.10.2026: „nicht erforderlich") bestimmt Name, Bundesstaat und Anschrift die LLC —
  // eine Registerzeile ohne Nummer wäre eine halbe Angabe, deshalb entfällt sie dann ganz.
  const register = buerginOhneNummer(b) ? "" : `, eingetragen bei ${bf(b, "registerstelle", "Registerstelle")} unter der Nummer ${bf(b, "registernummer", "Registernummer")}`;
  return [
    `${b.name}, Limited Liability Company nach dem Recht des Bundesstaats ${bf(b, "bundesstaat", "Bundesstaat")}, ${bf(b, "anschrift", "Anschrift")}${register}, vertreten durch ${bf(b, "vertreter", "Vertreter")}, ${bf(b, "funktion", "Funktion")} — nachfolgend „Bürgin“,`,
    `gegenüber ${angebotKundeName(k)}, geboren am ${angebotTag(k.geburtsdatum)}, wohnhaft ${k.strasse}, ${k.plz} ${k.ort}, ${ANGEBOT_LAND_NAME[k.land] ?? k.land} — nachfolgend „Auftraggeber“ —, und der US-Gesellschaft, die die FIAON LTD nach dem Vertrag für ihn gründet — nachfolgend „Gesellschaft“.`,
  ];
}
export function buergschaftZiffern(d: AngebotDaten): AngebotZiffer[] {
  const hb = angebotUsd(d.parameter.buergschaftUsd);
  return [
    { nr: 1, titel: "Zusage", absaetze: [
      p("Die Bürgin verpflichtet sich gegenüber dem Auftraggeber und der Gesellschaft, auf Anforderung eines Instituts, das der Gesellschaft eine Finanzierung gewährt oder gewähren will, gegenüber diesem Institut eine Bürgschaft (englisch: Guaranty) für die Verbindlichkeiten der Gesellschaft aus dieser Finanzierung zu übernehmen. Die Gesellschaft kann die Abgabe der Bürgschaft selbst verlangen, sobald sie eingetragen ist."),
      p("Finanzierungen im Sinne dieser Zusage sind Darlehen, Kreditlinien und Business-Kreditkarten der Gesellschaft, deren Antrag die FIAON LTD nach dem Vertrag vorbereitet oder begleitet hat."),
    ] },
    { nr: 2, titel: "Höchstbetrag", absaetze: [
      p(`Alle Bürgschaften nach dieser Zusage sind zusammen auf den Höchstbetrag von ${hb} begrenzt. Der Höchstbetrag umfasst Hauptforderung, Zinsen, Kosten und sonstige Nebenforderungen. Jede übernommene Bürgschaft wird mit ihrem Höchstbetrag angerechnet, solange sie besteht.`),
    ] },
    { nr: 3, titel: "Anforderung und Abgabe", absaetze: [
      p(`Die Anforderung stellt das Institut oder die FIAON LTD für die Gesellschaft in Textform an die Bürgin; sie nennt das Institut sowie Art und Höhe der Finanzierung. Die Bürgin gibt die Bürgschaftserklärung binnen ${zahlwort(ANGEBOT_FEST.buergschaftAbgabeWerktage)} Werktagen nach Zugang der vollständigen Anforderung ab — in der Form und nach dem Recht, die das Institut für Bürgschaften üblicherweise verlangt, höchstens bis zum noch nicht angerechneten Teil des Höchstbetrags.`),
    ] },
    { nr: 4, titel: "Voraussetzungen", absaetze: [
      liste([
        "die Gesellschaft eingetragen ist und der Auftraggeber an ihr mehrheitlich beteiligt ist,",
        "die Finanzierung dem Geschäftsbetrieb der Gesellschaft dient,",
        "die Angaben des Auftraggebers und der Gesellschaft gegenüber dem Institut, der FIAON LTD und der Bürgin wahr und vollständig sind,",
        "weder der Auftraggeber noch die Gesellschaft auf einer Sanktionsliste der Europäischen Union, der Vereinten Nationen, des Vereinigten Königreichs oder der USA geführt werden,",
        "die Bedingungen des Instituts keine Haftung der Bürgin über den noch nicht angerechneten Teil des Höchstbetrags hinaus und keine Haftung für Verbindlichkeiten anderer Personen als der Gesellschaft vorsehen und",
        "eine fällige Vergütung nach dem Vertrag bezahlt ist.",
      ], "Die Bürgin gibt die Bürgschaft ab, wenn"),
      p("Weitere Voraussetzungen bestehen nicht."),
    ] },
    { nr: 5, titel: "Keine Sicherheiten, keine Vergütung", absaetze: [
      p("Die Bürgin verlangt für die Bürgschaft weder vom Auftraggeber noch von der Gesellschaft eine Vergütung oder Sicherheiten — keine Avalprovision, keine Rückbürgschaft, keine Bareinlage, keine Verpfändung. Die Leistung der Bürgin ist mit der Vergütung nach dem Vertrag abgegolten. Eine persönliche Haftung, die ein Institut selbst vom Inhaber verlangt, ist davon nicht berührt (Ziffer 8 Absatz 5 und Ziffer 9 des Vertrags)."),
    ] },
    { nr: 6, titel: "Ersatzanspruch der Bürgin", absaetze: [
      p("Zahlt die Bürgin aufgrund einer Bürgschaft an ein Institut, geht die Forderung des Instituts gegen die Gesellschaft in Höhe der Zahlung auf die Bürgin über (nach deutschem Recht § 774 BGB, nach US-Recht entsprechend im Wege der Subrogation). Die Gesellschaft muss der Bürgin den gezahlten Betrag dann erstatten."),
      p("Das ist die gesetzliche Folge jeder Bürgschaft: Die Bürgin steht gegenüber dem Institut für die Gesellschaft ein; die Verbindlichkeit bleibt aber eine Verbindlichkeit der Gesellschaft. Der Auftraggeber haftet für diesen Ersatzanspruch nicht persönlich; gesetzliche Ansprüche wegen vorsätzlich falscher Angaben bleiben unberührt."),
    ] },
    { nr: 7, titel: "Geltungsdauer", absaetze: [
      p("Die Zusage wird mit dem Abschluss des Vertrags wirksam und gilt für Anforderungen, die bis zum Ende der Kapital-Begleitung nach Ziffer 10 Absatz 1 des Vertrags bei der Bürgin eingehen. Sie endet früher, wenn der Vertrag widerrufen oder vom Auftraggeber vorzeitig beendet wird. Bereits übernommene Bürgschaften bestehen nach ihren eigenen Bedingungen fort."),
    ] },
    { nr: 8, titel: "Entscheidung des Instituts", absaetze: [
      p("Die Bürgin schuldet die Abgabe der Bürgschaftserklärung, nicht die Finanzierung. Ob ein Institut eine Bürgschaft verlangt, ob es eine Bürgschaft der Bürgin annimmt und ob es finanziert, entscheidet allein das Institut."),
    ] },
    { nr: 9, titel: "Verbindung zu FIAON", absaetze: [
      p(`Die Bürgin ist mit der FIAON LTD über ${FIAON_FIRMA.director} verbunden, der Director der FIAON LTD ist und die Bürgin vertritt.`),
    ] },
    { nr: 10, titel: "Recht und Form", absaetze: [
      p("Für diese Zusage gilt das Recht der Bundesrepublik Deutschland. Die einzelne Bürgschaft gegenüber einem Institut unterliegt dem Recht, das sie selbst bestimmt. Die Bürgin unterzeichnet diese Zusage eigenhändig und übersendet sie dem Auftraggeber im Original; eine elektronische Fassung genügt für die Bürgschaftszusage nicht (§ 766 BGB). Sollten einzelne Bestimmungen unwirksam sein, bleibt die Zusage im Übrigen wirksam."),
    ] },
  ];
}
/** Die Zeile unter Anlage 1 — mit Datum der eigenhändigen Unterschrift, sobald es eingetragen ist. */
export function buergschaftUnterschrift(d: AngebotDaten): { kopf: string; zeile: string; vermerk: string } {
  const b = d.buergin;
  return {
    kopf: `Für die ${b.name}`,
    zeile: `${bf(b, "vertreter", "Vertreter")}, ${bf(b, "funktion", "Funktion")}`,
    vermerk: b.unterzeichnetAm
      ? `Abschrift. Das Original ist am ${angebotTag(b.unterzeichnetAm)} eigenhändig unterzeichnet worden; der Auftraggeber erhält es per Post.`
      : LUECKE("Datum der eigenhändigen Unterschrift"),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ANLAGE 2 — DER PRÜFBERICHT (Justin: „Echter Prüfbericht")
// Sachlich, mit dem ECHTEN Ergebnis. „Bestanden" steht nur dort, wo ein Abgleich
// ohne Treffer gemessen ist; nie „knapp", nie eine Zahl, die nicht aus dem
// eingefrorenen Ergebnis kommt. Die Boni-Ampel wird mit Grundlage gezeigt:
// welche Punkte aus Angaben, welche aus Annahmen kommen.
// ═══════════════════════════════════════════════════════════════════════════
export const PRUEFBERICHT_TITEL = "Anlage 2 — Prüfbericht: Compliance- und Eignungsprüfung";

/** Das Ergebnis in einem Satz — abgeleitet, nie getippt. */
export function pruefberichtErgebnis(pb: Pruefbericht): { satz: string; bestanden: boolean } {
  if (!pb.sanktionen) return { satz: "Vorläufiges Ergebnis — der Abgleich mit den Sanktionslisten steht noch aus.", bestanden: false };
  const treffer = pb.sanktionen.listen.reduce((s, l) => s + (Number(l.treffer) || 0), 0);
  if (treffer > 0) return { satz: `Abklärung erforderlich — ${treffer} Treffer im Abgleich mit den Sanktionslisten.`, bestanden: false };
  // Gegenprüfung 01.10.2026: „bestanden" sagt nicht, dass nichts mehr offen ist — die Auflagen (Identifizierung,
  // PEP-Erklärung) stehen im selben Satz, solange die PEP-Erklärung noch aussteht. Das Ergebnis selbst bleibt.
  const auflagen = pb.pep.status === "offen"
    ? " Vor Beginn der Leistungen gelten die Auflagen dieses Berichts: Identifizierung anhand des Reisepasses und PEP-Erklärung."
    : (pb.auflagen.length ? " Es gelten die Auflagen dieses Berichts." : "");
  return { satz: `Prüfung bestanden — keine Ausschlussgründe festgestellt.${auflagen}`, bestanden: true };
}

const BONI_GRUNDLAGE: Record<PruefberichtBoni["teile"][number]["quelle"], string> = {
  antrag: "Angabe im Antrag", annahme: "Annahme", kontoauszug: "Kontoauszug", schufa: "Auskunft",
};
const BONI_FARBE_TEXT: Record<PruefberichtBoni["farbe"], string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot" };

/** Abschnitt IV aus dem eingefrorenen Ampel-Ergebnis — Zahlen 1:1, Sätze aus den Zahlen. */
export function pruefberichtBoniText(b: PruefberichtBoni): { kopf: string; zeilen: { teil: string; punkte: string; grundlage: string; inhalt: string }[]; einordnung: string[] } {
  const angaben = b.teile.filter((t) => t.quelle === "antrag").reduce((s, t) => s + t.punkte, 0);
  const annahmen = b.teile.filter((t) => t.quelle === "annahme").reduce((s, t) => s + t.punkte, 0);
  const belegtPunkte = b.teile.filter((t) => t.quelle === "kontoauszug" || t.quelle === "schufa").reduce((s, t) => s + t.punkte, 0);
  const einordnung: string[] = [];
  const teilSaetze: string[] = [];
  if (angaben > 0) teilSaetze.push(`${angaben} der ${b.punkte} Punkte beruhen auf Selbstangaben aus dem Antrag, die nicht belegt sind.`);
  if (annahmen > 0) teilSaetze.push(`${annahmen} Punkte sind Standardannahmen für fehlende Angaben.`);
  if (belegtPunkte > 0) teilSaetze.push(`${belegtPunkte} Punkte beruhen auf gelesenen Unterlagen (Kontoauszug oder Auskunft).`);
  else teilSaetze.push("Weder eine Bonitätsauskunft noch ein Kontoauszug liegen vor.");
  einordnung.push(teilSaetze.join(" "));
  if (b.geschaetzt) einordnung.push("Die Einschätzung beruht vor allem auf Annahmen.");
  if (b.deckel) einordnung.push(`Begrenzt durch: ${b.deckel}.`);
  if (b.befunde.length) einordnung.push(`Harte Befunde: ${b.befunde.join("; ")}.`);
  else einordnung.push("Harte Befunde, die die Ampel begrenzen würden: keine.");
  // E-271 (Justin, 01.10.2026 abends: „‚entscheidet das Institut' ÄNDERN!"): Anlage 2 ohne Sätze, die das Ergebnis den
  // Instituten zuschreiben — Kreditrahmen und Karten sind nach Ziffer 3 Absatz 1 zugesagt. § 31 BDSG bleibt (Datenschutz).
  einordnung.push("Die Ampel ist deshalb keine Kreditwürdigkeitsprüfung und kein Score im Sinne von § 31 BDSG; sie wird nicht an Dritte weitergegeben. Belastbar wird die Einschätzung mit den Nachweisen, die finanzierende Institute ohnehin anfordern.");
  return {
    kopf: `Boni-Ampel: ${BONI_FARBE_TEXT[b.farbe]}, „${b.label}“ — ${b.punkte} von 100 Punkten.`,
    zeilen: b.teile.map((t) => ({ teil: t.label, punkte: `${t.punkte} / 20`, grundlage: BONI_GRUNDLAGE[t.quelle], inhalt: t.text.replace(/\.$/, "") })),
    einordnung,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE SEITE /business/angebot/:token — spricht den Kunden an („Sie", „wir")
//
// Reihenfolge nach dem Nachtrag (Justin, 01.10.2026, 10:50 — „er soll das Angebot
// mit einem Lächeln annehmen, nicht erschrecken"):
//   0 Auftakt (persönliche Begrüßung, animiert)       → auftakt
//   1 Hero — Nutzen, OHNE Beträge, OHNE Institut-Satz  → auge, fuer, titel, lead, nutzen
//   2 „Was Sie bekommen"                               → bekommen
//   3 „So läuft es" — vier Schritte, Zeitplan          → ablauf
//   4 „Ihr Schutz" — Erfolgsbasis, Erstattung, Widerruf → schutz
//   5 „Ihre Investition" — die dunkle Tafel, ruhig     → investition
//   6 Vertrag + Anlagen, davor die Pflichthinweise     → hinweise, dokumente
//   7 Bestellübersicht + Knopf (§ 312j BGB)            → angebotBestellUebersicht, ANGEBOT_ANNAHME
// Beträge stehen nur in 5 und 7. Der Name kommt aus dem Angebot, nie hart codiert.
// ═══════════════════════════════════════════════════════════════════════════
export function angebotSeite(d: Pick<AngebotDaten, "kunde" | "parameter" | "buergin">) {
  const par = d.parameter;
  const t1 = angebotEur(par.teil1Cents); const t2 = angebotEur(par.teil2Cents); const ges = angebotEur(angebotGesamtCents(par));
  const t1k = angebotEurKurz(par.teil1Cents); const t2k = angebotEurKurz(par.teil2Cents);
  const wochen = zahlwort(par.fristWochen);
  const buergin = d.buergin.name;
  const karten = angebotKarten(par.kartenZiel);
  const G = angebotGarantie(par);
  return {
    // 0 — Der Auftakt: baut sich auf, danach gleitet die Seite in den Hero (Nachtrag i).
    auftakt: { gruss: `Herzlich willkommen, ${angebotKundeGruss(d.kunde)}`, zeile: "Ihr Vertrag steht bereit.", ueberspringen: "Überspringen" },

    // 1 — Hero: nur Nutzen. Kein Betrag, kein Institut-Satz (Nachtrag b und c).
    auge: `FIAON Global · Persönliches Angebot`,
    fuer: `für ${angebotKundeAnrede(d.kunde)}`,
    // E-271 (Justin, 01.10.2026 abends): „Kredit garantiert“ — Kreditrahmen und Karten sind GARANTIERT (Ziffer 3 Abs. 1),
    // nicht mehr „Ihr Ziel“. Kein Betrag und kein Institut-Satz im Hero (Nachtrag b und c bleiben).
    titel: G.seiteTitel,
    lead: `Wir gründen Ihre Gesellschaft bis ins kleinste Detail; im ersten Jahr ist alles inklusive — Sie unterschreiben, wir erledigen den Rest. ${G.seiteLead}`,
    nutzen: [
      "Ihre US-Gesellschaft komplett — bis ins kleinste Detail",
      "Ihr Team vor Ort: persönlicher Assistent, Anwalt, Steuerberater, betriebswirtschaftliche Begleitung",
      G.nutzenKredit,
      G.nutzenKarten,
      `Eine Bürgin an Ihrer Seite: die ${buergin}`,
      "Keine Sicherheiten von Ihnen",
    ],
    // Das Siegel unter der Nutzenliste (Feldname historisch): „Kredit garantiert: …“ — immer mit dem, was garantiert
    // ist, und der Folge (alles zurück). Die Seite setzt den Teil vor dem ersten „: “ fett. Kein „0 %“ (Wortregel E-188).
    erstattungZeile: G.siegel,

    // 2 — Was Sie bekommen. Ohne Beträge; der Satz zur persönlichen Haftung steht bei den Karten.
    bekommenTitel: "Was Sie bekommen",
    bekommen: [
      { titel: "Ihre Gesellschaft — komplett, im ersten Jahr alles inklusive",
        text: "Wahl des Bundesstaats, Eintragung, Registered Agent, US-Geschäftsadresse und Telefonnummer, Operating Agreement, EIN, Unterstützung beim US-Geschäftskonto und alle Meldungen des ersten Jahres: Wir erledigen jeden Schritt und tragen im ersten Jahr alle Gebühren und Honorare dafür — keine Zusatzkosten, keine versteckten Gebühren.",
        // Endabnahme 01.10.2026: kein „nur" (das machte die Aufzählung zur abschließenden Zusage) und alle vier
        // Posten aus Ziffer 5 Absatz 5 — wortgleich in der Mail an Herrn Hildbrand.
        fein: "Um Gründung, Anträge und die Meldungen des ersten Jahres kümmern wir uns. Ihre einzige Mitwirkung: Sie unterschreiben, was wir Ihnen fertig vorbereitet zuschicken (auch die Mandate für Steuerberater und Anwalt), und stellen uns Ihren Reisepass für die gesetzlich vorgeschriebene Identifizierung zur Verfügung. Alles Weitere erledigen wir. Nicht enthalten sind die laufende Buchhaltung, Ihre Steuererklärungen zu Hause, Umsatzsteuer-Registrierungen in einzelnen US-Bundesstaaten und Gebühren, die ein Institut selbst verlangt — vollständig in Ziffer 5 Absatz 5." },
      { titel: "Ihr Team vor Ort",
        text: "Ein persönlicher Assistent als fester Ansprechpartner, ein Partner-Anwalt, ein Partner-Steuerberater, ein US-CPA und ein Partner für die betriebswirtschaftliche Begleitung Ihrer Gesellschaft — alle Honorare tragen wir.",
        fein: "Steuerberater, US-CPA und Anwalt arbeiten auf Ihr Mandat; ihre Honorare für diesen Auftrag trägt FIAON." },
      // E-271: Die Überschriften sagen „Garantiert: …“ — Ziffer 3 Absatz 1 garantiert Kreditrahmen und Karten.
      { titel: G.bekommenKreditTitel,
        text: G.bekommenKreditText,
        fein: "Die Anträge stellt Ihre Gesellschaft im eigenen Namen — vorbereitet und begleitet von uns. Das Kapital ist nicht an die USA gebunden." },
      { titel: G.bekommenKartenTitel,
        text: G.bekommenKartenText,
        fein: "Bei US-Firmenkarten verlangen Kartenherausgeber in der Regel die persönliche Haftung des Inhabers. Ist das bei einem Antrag so, sagen wir es Ihnen vorher — und Sie entscheiden frei." },
      { titel: "Eine Bürgin an Ihrer Seite",
        text: `Verlangt ein Institut eine Bürgschaft, übernimmt sie die ${buergin} für Finanzierungen Ihrer Gesellschaft — Höchstbetrag ${angebotUsd(par.buergschaftUsd)}, ohne Avalprovision. Die Zusage ist eigenhändig unterzeichnet und liegt diesem Angebot als Anlage 1 bei.`,
        fein: "Zahlt die Bürgin, kann sie den Betrag von Ihrer Gesellschaft zurückverlangen — so ist jede Bürgschaft gebaut; Sie persönlich haften dafür nicht." },
      { titel: "Keine Sicherheiten",
        text: "Weder wir noch die Bürgin verlangen Sicherheiten von Ihnen oder Ihrer Gesellschaft: keine Bareinlage, keine Rückbürgschaft, keine Grundschuld, keine Verpfändung.",
        fein: "Alles, was dieser Weg braucht, ist in diesem Angebot enthalten — es gibt nichts, was Sie zusätzlich stellen müssten." },
    ],

    // 3 — So läuft es: vier Schritte mit Zeitplan.
    ablaufTitel: "So läuft es",
    // Gegenprüfung 01.10.2026: Die Frist läuft ab unserem Start — mit sofortigem Beginn ist das der Zahlungseingang,
    // sonst der Tag nach der Widerrufsfrist (Ziffer 6 Absatz 1). E-271: kein Institut-Satz mehr — Kreditrahmen und Karten sind garantiert.
    ablaufZeitplan: `Ihr Zeitplan: ${wochen} Wochen ab unserem Start — mit sofortigem Beginn ab Ihrem Zahlungseingang`,
    ablauf: [
      { wann: "Heute", titel: "Annehmen",
        text: "Sie lesen Vertrag, Bürgschaftszusage, Prüfbericht und Widerrufsbelehrung in Ruhe und nehmen mit einem Klick an. Vertrag und Rechnung für die Gründung kommen sofort per E-Mail." },
      { wann: "Mit Ihrer Zahlung", titel: "Startgespräch und Gründung",
        text: `Mit Ihrer Zahlung beginnen wir — sofort oder ab dem Tag, den Sie unten wählen. Mit unserem Start läuft Ihre Frist von ${wochen} Wochen. Im Startgespräch mit ${FIAON_FIRMA.director} legen wir den Bundesstaat fest; danach erledigen wir Eintragung, Operating Agreement, EIN und Geschäftskonto. Sie unterschreiben nur, was wir vorbereiten.` },
      { wann: "Sobald Ihre LLC eingetragen ist", titel: "Kapital-Begleitung",
        text: `Wir bereiten jeden Antrag Ihrer Gesellschaft vor — Konto, Karten, Finanzierung — und begleiten ihn bis zur Entscheidung. Verlangt ein Institut eine Bürgin, steht die ${buergin} bereit. Für diese Begleitung zahlen Sie erst, wenn das erste Kapital oder die erste Karte da ist.` },
      { wann: `Innerhalb der ${wochen} Wochen`, titel: G.ablaufTitel,
        text: `Mit dem ersten Kapital oder der ersten Karte — gleich in welcher Höhe — wird unsere Vergütung für die Kapital-Begleitung fällig, zahlbar binnen ${zahlwort(par.teil2ZielTage)} Tagen. ${G.ablaufGarantie} Sonst erstatten wir Ihnen alles, was Sie uns gezahlt haben; Ihre LLC behalten Sie.` },
    ],

    // 4 — Ihr Schutz. E-271: Erfolgsbasis + Garantie (Kreditrahmen und Karten — oder alles zurück) + Widerruf.
    schutzTitel: "Ihr Schutz",
    schutz: [
      { titel: "Erfolgsbasis",
        text: "Unsere eigentliche Vergütung wird erst fällig, wenn Ihre LLC eingetragen ist und das erste Kapital an sie ausgezahlt oder die erste Business-Kreditkarte freigeschaltet ist — gleich in welcher Höhe. Bis dahin tragen Sie nur die Gründungskosten Ihrer Gesellschaft.",
        fein: G.schutzErfolgFein },
      { titel: G.schutzTitel,
        text: `Erhält Ihre Gesellschaft in ${wochen} Wochen ab unserem Start (mit sofortigem Beginn: ab Ihrem Zahlungseingang) nicht den ${angebotKreditrahmen(par)} und ${karten} — gleich, ob auf unseren oder einen eigenen Antrag —, erstatten wir Ihnen alles, was Sie uns gezahlt haben: die Gründungskosten und, falls schon gezahlt, unsere Vergütung für die Kapital-Begleitung — binnen ${zahlwort(par.erstattungTage)} Tagen, ohne Aufforderung, ohne Abzug. Eine offene Rechnung über die Kapital-Begleitung entfällt. Ihre LLC und alle Unterlagen bleiben Ihre.`,
        fein: "Die Frist ruht nur, wenn Sie trotz schriftlicher Aufforderung eine Unterschrift, Ihren Reisepass (oder einen von einem Institut für die Identifizierung verlangten Adressnachweis) oder wahre Angaben schuldig bleiben, und solange eine fällige Rechnung über die Kapital-Begleitung offen ist — nie wegen Behörden, Instituten oder uns. Lehnen Sie eine Karte oder einen Rahmen ab, den ein Institut Ihrer Gesellschaft anbietet, zählt er für das Ziel (Ziffer 3 Ihres Vertrags)." },
      { titel: "Widerrufsrecht",
        text: "Als Verbraucher können Sie den Vertrag binnen vierzehn Tagen widerrufen — Belehrung und Muster-Formular stehen in Anlage 3. Ob wir schon vor Ablauf dieser Frist beginnen, entscheiden Sie unten selbst.",
        fein: "Vor Ablauf der Widerrufsfrist beginnen wir nur auf Ihren ausdrücklichen Wunsch." },
    ],

    // 5 — Ihre Investition: die dunkle Tafel (Navy-Glas genau einmal), Beträge ruhig und als Vorteil.
    investitionTitel: "Ihre Investition",
    investition: {
      // Justins Satz (Nachtrag c) — wörtlich.
      satz: `${t1k} sind ausschließlich die Gründungskosten Ihrer Gesellschaft. Unsere eigentliche Vergütung von ${t2k} verdienen wir erst mit Ihrem Erfolg — wenn das erste Kapital oder die erste Karte da ist. Wir arbeiten also auf Erfolgsbasis. ${G.investitionGarantie}`,
      tafel: [
        { label: "Gründung Ihrer Gesellschaft", wert: t1, zusatz: "heute fällig — im ersten Jahr alles inklusive, keine Zusatzkosten" },
        { label: "Kapital-Begleitung", wert: t2, zusatz: `erst mit Ihrem Erfolg: nach Eintragung und erstem Kapital oder erster Karte, gleich in welcher Höhe; zahlbar binnen ${zahlwort(par.teil2ZielTage)} Tagen — ${G.tafelTeil2}` },
        { label: "Ihre Garantie", wert: "alles zurück", zusatz: `wenn Ihre Gesellschaft in den ${wochen} Wochen ab unserem Start (mit sofortigem Beginn: ab Ihrem Zahlungseingang) nicht den ${angebotKreditrahmen(par)} und ${karten} erhält: ${t1} für die Gründung und, falls schon gezahlt, ${t2} für die Kapital-Begleitung — eine offene Rechnung entfällt, Ihre LLC bleibt Ihnen` },
        { label: "Bürgin", wert: buergin, zusatz: `Höchstbetrag ${angebotUsd(par.buergschaftUsd)} — Sicherheiten verlangen wir keine` },
      ],
      gesamt: `Insgesamt ${ges} als Festpreis, Endpreis für Sie als Privatperson — davon heute nur ${t1}. Überweisung auf Rechnung, kein Abo.`,
      jahrZwei: "Ab dem zweiten Jahr übernehmen wir die laufenden Kosten Ihrer Gesellschaft auf Wunsch mit der Jahresbetreuung für 699 € im Jahr — nie vorausgewählt, ohne automatische Verlängerung; ohne sie tragen Sie die laufenden Kosten ab dem zweiten Jahr selbst.",
    },

    // 6 — Vor dem Vertrag: die Pflichthinweise (wörtlich aus dem Haus) und die Dokumente.
    hinweiseTitel: "Was Sie vorher wissen sollten",
    // E-271: die Hauspflichthinweise ohne den Institut-Satz (ANGEBOT_PFLICHTHINWEIS) — dieses Angebot garantiert.
    hinweise: [...ANGEBOT_PFLICHTHINWEIS],
    kapitalFrei: `${GLOBAL_KAPITAL_FREI.de.satz} ${GLOBAL_KAPITAL_FREI.de.steuer}`,
    verbunden: `Die ${buergin} ist mit FIAON über unseren Gründer ${FIAON_FIRMA.director} verbunden. Ihr Vertragspartner ist in jedem Fall die ${FIAON_FIRMA.name}.`,
    dokumenteTitel: "Ihr Vertrag mit drei Anlagen",
    dokumente: [
      { titel: "Vertrag", text: angebotVertragTitel() },
      { titel: "Anlage 1", text: `Bürgschaftszusage der ${buergin} — eigenhändig unterzeichnet, das Original kommt per Post` },
      { titel: "Anlage 2", text: "Prüfbericht: Sanktionslisten, Stammdaten und Ihre Ausgangslage — mit dem echten Ergebnis" },
      { titel: "Anlage 3", text: "Widerrufsbelehrung und Muster-Widerrufsformular" },
    ],
    vertragAuf: "Vertrag und Anlagen vollständig lesen",
    vertragZu: "Vertrag und Anlagen einklappen",
  };
}
/** „4.650 €" — ohne Cent, für Fließtext auf der Seite. */
export function angebotEurKurz(cents: number): string {
  return cents % 100 === 0 ? `${(cents / 100).toLocaleString("de-DE")} €` : angebotEur(cents);
}

// ── ANNAHME-KASTEN (§ 312j Abs. 2 und 3 BGB) ─────────────────────────────────
// Die Bestellübersicht steht UNMITTELBAR über dem Knopf: wesentliche Eigenschaften,
// Gesamtpreis, Fälligkeiten, Laufzeit. Häkchen gibt es nur, wo sie rechtlich etwas
// bewirken — der Wunsch nach sofortigem Beginn (§ 356 Abs. 4 BGB, Wertersatz) und
// die zusätzliche Jahresbetreuung (§ 312a Abs. 3 BGB). Keiner ist vorangekreuzt.
/**
 * Justin (01.10.2026): „Ihre Bestellung im Überblick soll man ein- und ausklappen können." § 312j Abs. 2 BGB verlangt
 * Leistung, Gesamtpreis (mit Fälligkeiten) und Laufzeit UNMITTELBAR über dem Knopf — diese Zeilen tragen kern: true
 * und bleiben immer sichtbar; alles Weitere klappt die Seite unter „Alle Einzelheiten" ein.
 */
export function angebotBestellUebersicht(d: Pick<AngebotDaten, "parameter" | "buergin">, s: AngebotSchalter): { label: string; wert: string; kern?: true }[] {
  const par = d.parameter;
  const JB = GLOBAL_JAHRESBETREUUNG.de;
  const wochen = zahlwort(par.fristWochen);
  const G = angebotGarantie(par);
  return [
    { label: "Vertragspartner", wert: `${FIAON_FIRMA.name}, ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land}` },
    // E-271: Die Garantie ist eine wesentliche Eigenschaft (§ 312j Abs. 2 BGB) — sie steht in der Kernzeile „Leistung“.
    { label: "Leistung", kern: true, wert: `Gründung Ihrer US-LLC (Teil 1) und Kapital-Begleitung Ihrer Gesellschaft (Teil 2) nach der Individualvereinbarung — ${G.uebersichtLeistung}` },
    { label: "Teil 1 · Gründung", kern: true, wert: `${angebotEur(par.teil1Cents)} — fällig mit Vertragsschluss, Rechnung sofort per E-Mail` },
    { label: "Teil 2 · Kapital-Begleitung", kern: true, wert: `${angebotEur(par.teil2Cents)} — nur fällig, wenn Ihre LLC eingetragen ist und das erste Kapital ausgezahlt oder die erste Karte freigeschaltet ist (gleich in welcher Höhe); zahlbar binnen ${zahlwort(par.teil2ZielTage)} Tagen nach Rechnung` },
    { label: "Gesamtpreis", kern: true, wert: `${angebotEur(angebotGesamtCents(par))} · Endpreis, eine etwaige Umsatzsteuer ist enthalten` },
    { label: "Ihre Garantie", kern: true, wert: `Erhält Ihre Gesellschaft binnen ${wochen} Wochen ab unserem Start nicht den ${angebotKreditrahmen(par)} und ${angebotKarten(par.kartenZiel)}: alles Gezahlte zurück binnen ${zahlwort(par.erstattungTage)} Tagen nach Fristende — ${angebotEur(par.teil1Cents)} und, falls gezahlt, ${angebotEur(par.teil2Cents)}; eine offene Rechnung über Teil 2 entfällt, die LLC bleibt Ihre` },
    { label: "Bürgschaft", wert: `${d.buergin.name}, auf Anforderung eines Instituts, Höchstbetrag ${angebotUsd(par.buergschaftUsd)} (Anlage 1)` },
    { label: "Laufzeit", kern: true, wert: `Leistungen des ersten Jahres bis zum ersten Jahrestag der Eintragung; ${G.uebersichtLaufzeit} — keine automatische Verlängerung` },
    s.jahresbetreuung
      ? { label: "Ab dem zweiten Jahr", kern: true, wert: `${JB.gebucht} — jährlich im Voraus, keine automatische Verlängerung, heute nicht fällig` }
      : { label: "Ab dem zweiten Jahr", wert: "Jahresbetreuung nicht gebucht (auf Wunsch 699 € im Jahr)" },
    { label: "Beginn", kern: true, wert: s.startAm && /^\d{4}-\d{2}-\d{2}$/.test(s.startAm)
      ? `am ${angebotTag(s.startAm)}, frühestens mit Ihrem Zahlungseingang${s.sofortBeginn ? " — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist" : ""}`
      : s.sofortBeginn ? "sofort mit Ihrem Zahlungseingang — auf Ihren ausdrücklichen Wunsch vor Ablauf der Widerrufsfrist" : "nach Ablauf der Widerrufsfrist, frühestens mit Ihrem Zahlungseingang" },
    { label: "Zahlung", wert: "Überweisung auf Rechnung — kein Abo, keine Lastschrift" },
    { label: "Widerruf", wert: "Gesetzliches Widerrufsrecht von vierzehn Tagen — Belehrung und Formular in Anlage 3" },
  ];
}

export const ANGEBOT_ANNAHME = {
  titel: "Ihre Bestellung im Überblick",
  beginnTitel: "Wann sollen wir beginnen?",
  // Justin (01.10.2026): zwei Kästchen — „Sofort starten" (darunter klein und grau die Erklärung zum Widerruf) oder
  // „Starten ab" mit Datum. Keins ist vorgewählt; ohne Wahl keine Annahme (die Seite sagt, was fehlt).
  beginnWahl: "Bitte wählen Sie eins von beiden — die Frist Ihrer Garantie läuft ab unserem Start.",
  beginnSofort: "Sofort starten",
  beginnSofortUnter: "mit Ihrem Zahlungseingang",
  beginnDatum: "Starten ab",
  beginnDatumUnter: "an Ihrem Wunschtag, frühestens mit Ihrem Zahlungseingang",
  beginnDatumFeld: "Ihr Starttag",
  beginnNachWiderruf: (ende: string) => `Ihr Starttag liegt nach dem Ende der Widerrufsfrist (${ende}) — Ihr Widerrufsrecht bleibt bis dahin vollständig erhalten.`,
  fehltTitel: "Für die Annahme fehlt noch:",
  fehltBeginn: "Bitte wählen Sie „Sofort starten“ oder „Starten ab“ mit einem Datum.",
  // In der Übersicht, solange noch nichts gewählt ist — statt eines Beginns, den der Kunde nicht gewählt hat.
  beginnOffen: "noch nicht gewählt — bitte oben „Sofort starten“ oder „Starten ab“ mit Datum wählen",
  fehltDatum: (von: string, bis: string) => `Bitte wählen Sie Ihren Starttag — einen Tag zwischen ${von} und ${bis}.`,
  uebersichtMehr: "Alle Einzelheiten anzeigen",
  uebersichtWeniger: "Einzelheiten ausblenden",
  beginnText: "Als Verbraucher haben Sie das gesetzliche Widerrufsrecht von vierzehn Tagen. Ohne Ihren ausdrücklichen Wunsch beginnen wir erst nach Ablauf dieser Frist — dann beginnt auch die Frist Ihrer Garantie erst mit unserem Start. Mit Ihrem Wunsch beginnen wir, sobald Ihre Zahlung eingegangen ist. Der Vertrag folgt Ihrer Wahl.",
  // Wortgleich mit client/src/i18n/global-start.ts (sofortBeginn) — nie vorangekreuzt.
  sofortBeginn: "Ich verlange ausdrücklich, dass FIAON vor Ablauf der Widerrufsfrist mit der Arbeit beginnt. Mir ist bekannt, dass ich bei einem Widerruf die bis dahin erbrachten Leistungen anteilig bezahle und dass mein Widerrufsrecht erlischt, wenn FIAON den Vertrag vollständig erfüllt hat.",
  // Wortgleich mit GLOBAL_JAHRESBETREUUNG.de.buchen — nie vorangekreuzt, nie per Link vorbelegt.
  jahresbetreuung: GLOBAL_JAHRESBETREUUNG.de.buchen,
  jahresbetreuungUnter: "Heute wird nur Teil 1 fällig; die Jahresbetreuung berechnen wir erst zum zweiten Jahr.",
  knopf: ANGEBOT_KNOPF,
  unterKnopf: (t1: string) => `Mit dem Klick nehmen Sie das Angebot an. Fällig wird heute nur Teil 1 (${t1}); Teil 2 erst nach dem ersten Kapital oder der ersten Karte. ${ANGEBOT_GARANTIE_FEST.annahmeUnterKnopf}`,
  gelesen: "Mit dem Klick bestätigen Sie, dass Sie Vertrag, Anlagen und die Hinweise oben gelesen haben.",
  gesperrt: "Dieses Angebot wird gerade vervollständigt. Sie erhalten eine Nachricht, sobald Sie es annehmen können.",
  neuLaden: "Das Angebot wurde inzwischen geändert — bitte laden Sie die Seite neu und lesen Sie die aktuelle Fassung.",
  fertigTitel: "Vielen Dank. Ihr Auftrag steht.",
  fertigFaellig: (t1: string) => `Heute fällig ist nur Teil 1 über ${t1}. Bankverbindung, Verwendungszweck und einen QR-Code für Ihre Banking-App finden Sie auf Ihrer Zahlungsseite.`,
  fertigBezahlt: "Ihre Zahlung für Teil 1 ist eingegangen — vielen Dank. Den Stand Ihres Auftrags sehen Sie jederzeit unter „Mein Auftrag“.",
  // Gegenprüfung 01.10.2026: Hängt die Rechnung nach der Annahme, sagt die Seite das ehrlich — statt auf eine Zahlungsseite zu verweisen, die es noch nicht gibt.
  fertigRechnungFolgt: (t1: string) => `Heute fällig ist nur Teil 1 über ${t1}. Ihre Rechnung mit Bankverbindung und Verwendungszweck folgt in Kürze per E-Mail — Sie müssen nichts weiter tun.`,
  // E-271: statt des Institut-Satzes die Garantie.
  fertigFuss: "Ihre Garantie gilt: Erhält Ihre Gesellschaft in der Frist nicht den vereinbarten Kreditrahmen und die vereinbarten Karten, erhalten Sie alles zurück, was Sie uns gezahlt haben. Fragen? Schreiben Sie uns an support@fiaon.com.",
  fertigSofort: (email: string) => `Vertrag und Rechnung gehen an ${email}. Mit Ihrem Zahlungseingang beginnen wir — und mit ihm die Frist Ihrer Garantie.`,
  fertigAb: (email: string, tag: string) => `Vertrag und Rechnung gehen an ${email}. Wie gewünscht beginnen wir am ${tag}, sobald Ihre Zahlung eingegangen ist — mit unserem Start beginnt die Frist Ihrer Garantie.`,
  fertigWartet: (email: string) => `Vertrag und Rechnung gehen an ${email}. Wie gewünscht beginnen wir nach Ablauf der Widerrufsfrist, sobald Ihre Zahlung eingegangen ist; die Frist Ihrer Garantie beginnt mit unserem Start.`,
} as const;

/**
 * Angebot-Aufrufe (01.10.2026): der Transparenz-Satz auf der Kundenseite — unter den Dokumenten und auf der
 * Bestätigung, AUSSERHALB des Vertragstextes (geht nicht in den Rumpf und damit nicht in text_hash).
 * Was er verspricht, hält server/lib/fiaon-global-angebot-aufrufe.ts: nur der Server protokolliert, keine
 * Cookies, keine Messung im Browser, IP gekürzt, Löschung 90 Tage nach Abschluss.
 */
export const ANGEBOT_AUFRUF_HINWEIS =
  "Aufrufe dieses persönlichen Links werden protokolliert (Zeitpunkt, Gerät, ungefähre Region; IP-Adresse gekürzt) — zur Dokumentation des Vertragswegs und damit Ihr Ansprechpartner sieht, wann er Sie beim nächsten Schritt begleiten kann. Löschung 90 Tage nach Abschluss.";

/**
 * „Ihre Ansprechpartner" (Justin, 01.10.2026, nachmittags): Florentine Lombardi, Daniel Stripling, Justin Schwarzott —
 * in dieser Reihenfolge, je mit E-Mail und Telefon, auf der Angebotsseite und auf der Bestätigung nach der Annahme.
 * Wie ANGEBOT_AUFRUF_HINWEIS AUSSERHALB des Vertragstextes (nicht im Rumpf, nicht in text_hash, nicht im PDF).
 * Namen, Rollen, Adressen und Nummern genau wie öffentlich auf /team (client/src/components/site/Team.tsx, PERSONEN);
 * Fotos unter /portraits/<kuerzel>.jpg — fehlt eins, steht das Monogramm.
 */
export const ANGEBOT_ANSPRECHPARTNER_TITEL = "Ihre Ansprechpartner";
export const ANGEBOT_ANSPRECHPARTNER_SATZ =
  "Drei Menschen kennen Ihren Auftrag persönlich — vor der Annahme bei jeder Frage zum Vertrag und danach bei jedem Schritt. Sie erreichen jeden von ihnen direkt per E-Mail oder Telefon.";
export const ANGEBOT_ANSPRECHPARTNER: readonly { kuerzel: string; name: string; rolle: string; email: string; telefon: string }[] = [
  { kuerzel: "florentine", name: "Florentine Lombardi", rolle: "Geschäftsführerin · Menschen & Onboarding", email: "florentine@fiaon.com", telefon: "+41 77 202 84 49" },
  { kuerzel: "daniel", name: "Daniel Stripling", rolle: "Gesellschafter · Leitung Vertrieb", email: "daniel@fiaon.com", telefon: "+41 77 281 18 34" },
  { kuerzel: "justin", name: "Justin Schwarzott", rolle: "Gründer · Geschäftsführer · Director", email: "js@fiaon.com", telefon: "+41 77 288 4902" },
];

// ═══════════════════════════════════════════════════════════════════════════
// RECHNUNGSZEILE JE TEIL (server/fiaon-invoice.ts → rechnungsSpracheSetzen)
// ═══════════════════════════════════════════════════════════════════════════
export function angebotTeilTitel(nr: 1 | 2): string {
  return nr === 1 ? "Teil 1: Gründung" : "Teil 2: Kapital-Begleitung";
}
export function angebotTeilPaketname(nr: 1 | 2): string {
  return `${ANGEBOT_PAKETNAME}, ${angebotTeilTitel(nr)}`;
}
export function angebotRechnungsText(z: { angebotRef: string; nr: 1 | 2; auftragRef: string; meilensteinArt?: string | null; meilensteinAm?: string | null }): { beschreibung: string; zeitraum: string } {
  if (z.nr === 1) {
    return { beschreibung: `${ANGEBOT_PAKETNAME} ${z.angebotRef}, Teil 1 von 2: Gründung der US-Gesellschaft gemäß Auftrag ${z.auftragRef}`, zeitraum: "einmalig" };
  }
  const ereignis = z.meilensteinArt === "karte" ? "erster freigeschalteter Business-Kreditkarte" : "erster Auszahlung von Kapital";
  return {
    beschreibung: `${ANGEBOT_PAKETNAME} ${z.angebotRef}, Teil 2 von 2: Kapital-Begleitung — fällig nach Eintragung der Gesellschaft und ${ereignis}${z.meilensteinAm ? ` am ${angebotTag(z.meilensteinAm)}` : ""} (Auftrag ${z.auftragRef})`,
    zeitraum: "einmalig",
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// „MEIN AUFTRAG" — der Block „Ihr Angebot" (client/src/pages/business-auftrag.tsx)
// ═══════════════════════════════════════════════════════════════════════════
export const ANGEBOT_MEIN_AUFTRAG = {
  titel: "Ihr Angebot",
  stand: { bezahlt: "bezahlt", offen: "Rechnung offen", "noch nicht fällig": "noch nicht fällig", entfallen: "entfällt", storniert: "storniert", erstattet: "wird erstattet" } as Record<string, string>,
  teil2Hinweis: "Teil 2 wird erst fällig, wenn Ihre Gesellschaft eingetragen ist und das erste Kapital ausgezahlt oder die erste Business-Kreditkarte freigeschaltet ist.",
  // E-271: Garantie — Kreditrahmen und Karten, sonst alles zurück.
  frist: (beginn: string, ende: string) => `Ihre Frist läuft vom ${angebotTag(beginn)} bis zum ${angebotTag(ende)}. ${ANGEBOT_GARANTIE_FEST.meinAuftragFrist}`,
  fristNochNicht: "Die Frist beginnt mit unserem Start — Beginn und Ende teilen wir Ihnen dann schriftlich mit.",
  erstattung: ANGEBOT_GARANTIE_FEST.meinAuftragErstattung,
  garantieErfuellt: (tag: string) => `Garantie erfüllt am ${angebotTag(tag)}: Kreditrahmen und Karten liegen vor.`,
  seiteHinweis: ANGEBOT_GARANTIE_FEST.meinAuftragHinweis,
  rechnung: "Rechnung",
} as const;
