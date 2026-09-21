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

/** Kleinbuchstaben, Umlaute ausgeschrieben, nur Buchstaben/Ziffern/Leerzeichen. */
export function flachText(s: string): string {
  return String(s ?? "").toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim();
}

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
/** Echte Gehalts- und Rentenzeilen tragen manchmal den Namen des Empfängers — sie bleiben Einkommen. */
const LOHN_WOERTER = ["lohn", "gehalt", "bezuege", "entgelt", "rente", "pension", "versorgung", "arbeitgeber", "personalnr", "personalnummer", "verdienst", "besoldung", "verguetung"];

export interface PersonName { vorname: string | null; nachname: string | null }

/** Steht der Kunde selbst als Gegenpartei in der Zeile? Vor- UND Nachname (Familie mit gleichem Nachnamen zählt nicht). */
export function istEigenerName(text: string, p: PersonName): boolean {
  const t = ` ${flachText(text)} `;
  const vor = flachText(p.vorname ?? "").split(" ").filter((w) => w.length >= 2);
  const nach = flachText(p.nachname ?? "").split(" ").filter((w) => w.length >= 3);
  if (!vor.length || !nach.length) return false;
  return nach.every((w) => t.includes(` ${w} `)) && vor.some((w) => t.includes(` ${w} `));
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
 *     einer ABBUCHUNG nur ausdrückliche Umbuchungswörter → „eigenes_konto"
 *     (neutral: weder Einnahme noch Ausgabe).
 *  2. Inkasso: bekannte Forderungskäufer oder Inkasso-Wörter auf einer
 *     Abbuchung → „inkasso_mahnung".
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
    if (b.betragCents > 0 && !echterLohn && (eigenerName || EIGEN_EIN_WOERTER.some((w) => flach.includes(w)))) {
      kategorie = "eigenes_konto";
    } else if (b.betragCents < 0 && EIGEN_AUS_WOERTER.some((w) => flach.includes(w))) {
      kategorie = "eigenes_konto";
    } else if (b.betragCents < 0 && INKASSO.some((w) => ` ${flach} `.includes(` ${w} `) || (w.length > 6 && flach.includes(w)))) {
      kategorie = "inkasso_mahnung";
    } else if (b.betragCents < 0 && EINNAHME_KATEGORIEN.has(kategorie)) {
      kategorie = "ueberweisung_aus";
    } else if (b.betragCents > 0 && !EINNAHME_KATEGORIEN.has(kategorie) && kategorie !== "ruecklastschrift" && kategorie !== "eigenes_konto") {
      // Geld zurück von einem Händler oder Versorger ist eine Erstattung; alles
      // andere (Kreditauszahlung, Gewinn, Überweisung) eine sonstige Einnahme.
      kategorie = kategorie === "bargeld" ? "bareinzahlung" : HAENDLER.has(kategorie) ? "erstattung" : "sonstige_einnahme";
    }
    return kategorie === alt ? { ...b } : { ...b, kategorie, korrektur: `war: ${alt}` };
  });
}

/** Ab diesem Anteil eigener Eingänge ist der Auszug ein Nebenkonto — das Gehaltskonto fehlt. */
export const NEBENKONTO_ANTEIL = 0.5;

export function nebenkontoAus(buchungen: { betragCents: number; kategorie: string }[]): { eigenEin: number; eigenAus: number; alleEin: number; nebenkonto: boolean } {
  let eigenEin = 0, eigenAus = 0, alleEin = 0;
  for (const b of buchungen) {
    if (b.betragCents > 0) alleEin += b.betragCents;
    if (b.kategorie !== "eigenes_konto") continue;
    if (b.betragCents > 0) eigenEin += b.betragCents; else eigenAus -= b.betragCents;
  }
  return { eigenEin, eigenAus, alleEin, nebenkonto: alleEin > 0 && eigenEin / alleEin >= NEBENKONTO_ANTEIL };
}
