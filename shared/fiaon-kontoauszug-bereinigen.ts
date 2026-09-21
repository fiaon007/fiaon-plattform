// ═══════════════════════════════════════════════════════════════════════════
// BUCHUNGEN BEREINIGEN — was das Modell nicht wissen kann (21.09.2026, E-207)
//
// Justin zur Ampel eines Kunden („Einkommen 286 € … laut Kontoauszug"):
// „Die KI muss den Kontoauszug RICHTIG analysieren — ich muss mich auf die
// Aussage verlassen können."
//
// ── WAS FALSCH WAR (gemessen, nur lesend) ─────────────────────────────────
// Der Auszug war auf den Cent gelesen — aber falsch GEDEUTET:
//   · Jeder Eingang war eine Aufladung vom EIGENEN Konto („Zahlung von <eigener
//     Name>") oder eine Temu-Erstattung. Drei Aufladungen legte das Modell als
//     „Sozialleistung" ab — daraus wurden 285,93 € „Gehalt".
//   · Eigenüberweisungen kannte die Analyse gar nicht: In 56 von 110 Analysen
//     zählten Gutschriften mit dem eigenen Namen als Einnahmen (639 Buchungen,
//     rund 281.000 €).
//   · Kategorie und Vorzeichen wurden nie gegeneinander geprüft: 182
//     Abbuchungen mit Einnahme-Kategorie (Kfz-Steuer als „Sozialleistung"),
//     1.016 Gutschriften mit Ausgabe-Kategorie.
//   · Inkassofirmen (PRA Group, Axactor) standen als „Kreditrate".
//
// ── WAS DIESE DATEI TUT ────────────────────────────────────────────────────
// Sie bereinigt die gelesenen Buchungen mit festen Regeln, BEVOR gerechnet
// wird — auf dem Server, mit dem Namen des Kunden aus der Akte (der Name geht
// nie ans Modell). Dieselbe Funktion rechnet die bestehenden Analysen neu,
// ohne einen einzigen Modellaufruf.
// ═══════════════════════════════════════════════════════════════════════════
import { flachText, markeDerBuchung, HAENDLER_TYPEN } from "./fiaon-kontoauszug-marken";
import { KATEGORIEN } from "./fiaon-kontoauszug-kategorien";

export { flachText };

export interface RohBuchung {
  datum: string;
  betragCents: number;
  empfaenger: string;
  zweck: string;
  kategorie: string;
  wiederkehrend: boolean;
  saldoDanachCents: number | null;
}

/** Kategorien, die Einnahmen sind — auf einer Abbuchung sind sie falsch. */
const EINNAHME_KATEGORIEN = new Set(["gehalt", "rente", "sozialleistung", "erstattung", "ueberweisung_ein", "sonstige_einnahme", "bareinzahlung"]);
/** Ausgabe-Kategorien von Händlern und Versorgern — eine Gutschrift von dort ist eine Erstattung. */
const HAENDLER = new Set(["freizeit", "lebensmittel", "abo_medien", "mobilitaet", "gesundheit", "telefon_internet", "energie", "versicherung", "miete", "gebuehren"]);
/** Einkommen im engeren Sinn — das, was die Ampel „Einkommen" nennt. */
export const EINKOMMEN_KATEGORIEN = new Set(["gehalt", "rente", "sozialleistung"]);

/** Inkasso- und Forderungskäufer (fest, weil das Modell sie als „Kreditrate" ablegte). */
const INKASSO = [
  // Nicht darin: Riverty — das ist „Rechnungskauf/Später bezahlen" (z. B. für Amazon), kein Inkasso
  // (gemessen 21.09.: 120 Riverty-Zahlungen wären sonst als Inkasso gezählt worden).
  "pra group", "axactor", "intrum", "lowell", "pair finance", "creditreform", "coeo", "paigo", "alektum",
  "hoist", "infoscore", "eos kso", "eos deutschland", "eos holding", "eos collect", "ksp", "procash", "pro cash",
  "inkasso", "forderungsmanagement", "mahnbescheid", "gerichtsvollzieher", "vollstreckung", "zahlungsaufforderung",
];

/** Aufladungen und Umbuchungen, die auf einer Gutschrift Geld vom eigenen Konto bedeuten. */
const EIGEN_EIN_WOERTER = ["top up", "topup", "aufladung", "aufgeladen", "umbuchung", "uebertrag", "kontouebertrag", "eigenes konto", "eigenuebertrag", "von eigenem konto"];
/** Auf einer ABBUCHUNG zählt nur das ausdrückliche Wort — der eigene Name steht dort oft im Zweck („Miete … Max Muster"). */
const EIGEN_AUS_WOERTER = ["umbuchung auf", "uebertrag auf", "auf eigenes konto", "an eigenes konto", "eigenuebertrag", "kontouebertrag"];
/**
 * Spartöpfe und Unterkonten derselben Bank — in BEIDE Richtungen Geld des Kunden (21.09.2026, E-207).
 * Gemessen an 216 Auswertungen: Revolut-„Pockets" („To pocket EUR Rainy Day", „Auszahlung bei Pocket"),
 * „Von EUR Tagesgeld", „Um EUR Portmonee von EUR einzustecken", „Worauf sparen Sie" — 3.700 Buchungen,
 * bei zwei Kunden je rund 900, zählten als Einnahme UND Ausgabe.
 */
const SPARTOPF = /\b(to|from|bei|aus|in|zu|an|von)\s+pocket\b|\bpocket\s+(eur|usd|gbp|chf)\b|\btagesgeld\b|\bportmonee\b|\beinzustecken\b|\bworauf sparen\b|\bspartopf\b|\bsparkonto\b|\bvault\b/;
/** Ämter, deren Gutschrift Einkommen ist — und welches (Name wie in fiaon-kontoauszug-marken.ts). */
const AMT_EINKOMMEN: Record<string, string> = {
  "Renten Service (Deutsche Post)": "rente", "Deutsche Rentenversicherung": "rente", "VBL (Zusatzrente)": "rente",
  "Jobcenter": "sozialleistung", "Familienkasse": "sozialleistung", "Bundesagentur für Arbeit": "sozialleistung", "AMS": "sozialleistung",
};
/** Echte Gehalts- und Rentenzeilen tragen manchmal den Namen des Empfängers — sie bleiben Einkommen. */
const LOHN_WOERTER = ["lohn", "gehalt", "bezuege", "entgelt", "rente", "pension", "versorgung", "arbeitgeber", "personalnr", "personalnummer", "verdienst", "besoldung", "verguetung"];

export interface PersonName { vorname: string | null; nachname: string | null }

/** Steht der Kunde selbst als Gegenpartei in der Zeile? Vor- UND Nachname (Familie mit gleichem Nachnamen zählt nicht). */
export function istEigenerName(text: string, p: PersonName): boolean {
  const t = ` ${flachText(text)} `;
  const vor = flachText(p.vorname ?? "").split(" ").filter((w) => w.length >= 2);
  const nach = flachText(p.nachname ?? "").split(" ").filter((w) => w.length >= 3);
  if (!vor.length || !nach.length) return false;
  // Ein verlorenes „ß" im Ausdruck: „MEI NER" oder „MEINER" steht für Meißner (flach: meissner).
  const varianten = (w: string) => (w.includes("ss") ? [w, w.replace(/ss/g, " "), w.replace(/ss/g, "")] : [w]);
  return nach.every((w) => varianten(w).some((v) => t.includes(` ${v} `))) && vor.some((w) => t.includes(` ${w} `));
}

export interface BereinigteBuchung extends RohBuchung {
  /** Was die Bereinigung geändert hat — für die Nachvollziehbarkeit („war: sozialleistung"). */
  korrektur?: string;
}

/**
 * Die Regeln, in dieser Reihenfolge:
 *  1. Eigenes Konto: auf einer GUTSCHRIFT Vor- und Nachname des Kunden — als
 *     Gegenpartei oder im Zweck einer Zahlung von einer Privatperson — oder
 *     eine Aufladung/Umbuchung (echte Lohn- und Rentenzeilen ausgenommen); auf
 *     einer ABBUCHUNG nur ausdrückliche Umbuchungswörter → „eigenes_konto";
 *     in beide Richtungen Spartöpfe der Bank (Pocket, Tagesgeld, Portmonee)
 *     → „spartopf". Beide neutral: weder Einnahme noch Ausgabe.
 *  2. Inkasso: bekannte Forderungskäufer oder Inkasso-Wörter auf einer
 *     Abbuchung → „inkasso_mahnung".
 *  2a. Marken (fiaon-kontoauszug-marken.ts): Wettanbieter → „gluecksspiel";
 *     Ämter auf einer Abbuchung → „abgaben"; „Einkommen" von einem Händler
 *     ohne Lohnwort → Erstattung; Rentenservice/Jobcenter/Familienkasse als
 *     „Überweisung" → Rente bzw. Sozialleistung.
 *  3. Vorzeichen: Einnahme-Kategorie auf einer Abbuchung → „ueberweisung_aus";
 *     Ausgabe-Kategorie auf einer Gutschrift → „erstattung" (Bargeld →
 *     „bareinzahlung", Rücklastschrift bleibt Rücklastschrift).
 */
export function buchungenBereinigen(buchungen: RohBuchung[], person: PersonName): BereinigteBuchung[] {
  return buchungen.map((b) => {
    const text = `${b.empfaenger} ${b.zweck}`;
    const flach = flachText(text);
    const alt = b.kategorie;
    let kategorie = alt;
    const echterLohn = (alt === "gehalt" || alt === "rente") && LOHN_WOERTER.some((w) => flach.includes(w));
    // ── DER NAME ZÄHLT NUR BEI EINER PRIVATPERSON (gemessen 21.09.2026) ──
    // Firmen und Kassen drucken den Begünstigten in den Zweck: „DB Fernverkehr
    // … Verdienstabrechnung … <Name>", „BARMER Pflegekasse … <Name>". Das ist
    // echtes Geld. Eine Eigenüberweisung kommt von einer Privatperson (so legt
    // das Modell private Namen ab) oder trägt den Namen als Gegenpartei selbst.
    const gegenueber = flachText(b.empfaenger);
    const vonPrivat = gegenueber === "" || gegenueber === "privatperson";
    const eigenerName = istEigenerName(b.empfaenger, person) || (vonPrivat && istEigenerName(text, person));
    const marke = markeDerBuchung(b.empfaenger, b.zweck, KATEGORIEN[alt]?.label ?? "");
    const lohnWort = LOHN_WOERTER.some((w) => flach.includes(w));
    if (!echterLohn && SPARTOPF.test(flach)) {
      kategorie = "spartopf";
    } else if (b.betragCents > 0 && !echterLohn && (eigenerName || EIGEN_EIN_WOERTER.some((w) => flach.includes(w)))) {
      kategorie = "eigenes_konto";
    } else if (b.betragCents < 0 && (istEigenerName(b.empfaenger, person) || EIGEN_AUS_WOERTER.some((w) => flach.includes(w)))) {
      // Der eigene Name als GEGENPARTEI einer Abbuchung: Geld aufs eigene andere Konto
      // (gemessen 21.09.: 21 Echtzeitüberweisungen „an <eigener Name>", 555 € im Monat als Ausgabe).
      kategorie = "eigenes_konto";
    } else if (b.betragCents < 0 && INKASSO.some((w) => ` ${flach} `.includes(` ${w} `) || (w.length > 6 && flach.includes(w)))) {
      kategorie = "inkasso_mahnung";
    } else if (b.betragCents < 0 && marke?.typ === "spiel") {
      kategorie = "gluecksspiel";
    } else if (b.betragCents < 0 && marke?.typ === "amt") {
      // Finanzamt, Kfz-Steuer, Rundfunkbeitrag, Stadtkasse — das Modell legte sie als „Kreditrate",
      // „Sozialleistung" (Vorzeichen falsch) oder „Sonstiges" ab.
      kategorie = "abgaben";
    } else if (b.betragCents > 0 && EINKOMMEN_KATEGORIEN.has(kategorie) && marke && (HAENDLER_TYPEN.has(marke.typ) || marke.typ === "spiel") && !lohnWort) {
      // Einkommen kommt nicht von PlayStation, Temu oder dem Lotto (gemessen: „Playstation … Dauerauftrag" als Sozialleistung).
      kategorie = marke.typ === "spiel" ? "sonstige_einnahme" : "erstattung";
    } else if (b.betragCents > 0 && marke?.typ === "amt" && (kategorie === "ueberweisung_ein" || kategorie === "sonstige_einnahme") && AMT_EINKOMMEN[marke.name]) {
      // Rente vom Renten Service, Bürgergeld vom Jobcenter, Kindergeld — auch wenn das Modell „Überweisung" schrieb.
      kategorie = AMT_EINKOMMEN[marke.name];
    } else if (b.betragCents < 0 && EINNAHME_KATEGORIEN.has(kategorie)) {
      kategorie = "ueberweisung_aus";
    } else if (b.betragCents > 0 && !EINNAHME_KATEGORIEN.has(kategorie) && kategorie !== "ruecklastschrift" && kategorie !== "eigenes_konto" && kategorie !== "spartopf") {
      // Geld zurück von einem Händler oder Versorger ist eine Erstattung; alles
      // andere (Kreditauszahlung, Gewinn, Überweisung) eine sonstige Einnahme.
      kategorie = kategorie === "bargeld" ? "bareinzahlung" : HAENDLER.has(kategorie) ? "erstattung" : "sonstige_einnahme";
    }
    // Die ERSTE Korrektur bleibt stehen: Sie nennt, was das Modell ursprünglich gelesen hat.
    return kategorie === alt ? { ...b } : { ...b, kategorie, korrektur: (b as BereinigteBuchung).korrektur ?? `war: ${alt}` };
  });
}

/** Ab diesem Anteil von Eingängen vom eigenen (anderen) Konto ist der Auszug ein Nebenkonto — das Gehaltskonto fehlt. */
export const NEBENKONTO_ANTEIL = 0.5;
/** … aber nur, wenn auf dem Konto kaum echtes Einkommen eingeht (unter diesem Anteil der Eingänge). */
export const NEBENKONTO_EINKOMMEN_HOECHSTENS = 0.2;

/** Neutrale Kategorien: Geld bleibt beim Kunden. */
export const NEUTRAL = new Set(["eigenes_konto", "spartopf"]);

/**
 * Umbuchungen und Nebenkonto.
 *  · eigenEin/eigenAus: alle neutralen Bewegungen (eigenes Konto UND Spartöpfe) — „nicht mitgezählt".
 *  · vomEigenenKonto: Eingänge von einem ANDEREN eigenen Konto (ohne Spartöpfe derselben Bank).
 *  · nebenkonto: überwiegend vom anderen eigenen Konto gespeist UND kaum echtes Einkommen. Ein Konto, auf
 *    dem das Bürgergeld eingeht und das zusätzlich vom Sparkonto aufgefüllt wird, ist kein Nebenkonto.
 */
export function nebenkontoAus(buchungen: { betragCents: number; kategorie: string }[]): { eigenEin: number; eigenAus: number; vomEigenenKonto: number; alleEin: number; nebenkonto: boolean } {
  let eigenEin = 0, eigenAus = 0, vomEigenenKonto = 0, alleEin = 0, einkommen = 0;
  for (const b of buchungen) {
    if (b.betragCents > 0 && b.kategorie !== "spartopf") alleEin += b.betragCents;
    if (b.betragCents > 0 && EINKOMMEN_KATEGORIEN.has(b.kategorie)) einkommen += b.betragCents;
    if (!NEUTRAL.has(b.kategorie)) continue;
    if (b.betragCents > 0) eigenEin += b.betragCents; else eigenAus -= b.betragCents;
    if (b.betragCents > 0 && b.kategorie === "eigenes_konto") vomEigenenKonto += b.betragCents;
  }
  const nebenkonto = alleEin > 0 && vomEigenenKonto / alleEin >= NEBENKONTO_ANTEIL && einkommen < alleEin * NEBENKONTO_EINKOMMEN_HOECHSTENS;
  return { eigenEin, eigenAus, vomEigenenKonto, alleEin, nebenkonto };
}
