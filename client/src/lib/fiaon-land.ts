// ═══════════════════════════════════════════════════════════════════════════
// DREI LÄNDER, EINE DEFINITION
//
// ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
// Der Vorgesetzte: „Wir starten mit der Werbekampagne in der Schweiz. Wenn man
// auf die Plattform kommt, muss gefragt werden (Österreich, Deutschland oder
// Schweiz). Wenn Schweizer Nutzer auf diese Seite kommen, entlarven derzeit
// mehrere Details die Plattform sofort als importiertes deutsches System."
//
// Er hat recht, und es sind mehr als Preise:
//
//   Währung          25.000 € → 25.000 CHF
//   Bonitätsregister SCHUFA → ZEK (Zentralstelle für Kreditinformation)
//   Städte           Köln, Berlin, Hamburg → Zürich, Bern, Zug, Luzern
//   Banken-Wording   „deutsche Banken" → „traditionelle Banken"
//
// ── WARUM EINE DATEI UND NICHT VIER SUCHEN-ERSETZEN ────────────────────────
// AGENTS.md: „Eine Definition, ein Ort." Ein Land steckt an zwölf Stellen in
// der Landingpage, an sechs im Antrag und in jeder Vertrauenszeile. Vier
// verstreute Fassungen wären vier Gelegenheiten, beim nächsten Land eine zu
// vergessen — und ein Schweizer, der „SCHUFA" liest, ist weg.
//
// ── KEINE LOGIK, NUR SPRACHE ───────────────────────────────────────────────
// Ausdrücklich verlangt: „es muss was angepasst werden (keine Logik oder so
// ändern!!!)". Diese Datei enthält deshalb NUR Wörter, Zeichen und Beispiele.
// Kein Preis wird gerechnet, kein Betrag umgerechnet, keine Prüfung verändert.
//
// Die Zahlen sind bewusst DIESELBEN: 25.000 heißt in Zürich 25.000 CHF, nicht
// 23.800. Ein Limit ist ein Versprechen über eine Größenordnung, kein
// Wechselkurs — und eine Kampagne, die krumme Zahlen zeigt, wirkt gerechnet.
// ═══════════════════════════════════════════════════════════════════════════

export type Land = "de" | "at" | "ch";

export interface LandProfil {
  code: Land;
  name: string;
  /** Für die Flaggenwahl — als SVG gezeichnet, nicht als Emoji (AGENTS.md). */
  kurz: string;
  /** „€" oder „CHF" — dort, wo es hinter der Zahl steht. */
  waehrung: string;
  /** Steht das Zeichen vor oder hinter dem Betrag? */
  waehrungVorn: boolean;
  /** Das Bonitätsregister des Landes. */
  register: string;
  registerLang: string;
  /** „Ohne SCHUFA." / „Ohne ZEK." */
  ohneRegister: string;
  /** Adjektiv für „… neutral": schufaneutral / ZEK-neutral */
  registerNeutral: string;
  /** Die Zeile über die trägen Banken. */
  bankenSatz: string;
  /** Beispielstädte für den Sozialbeweis. */
  staedte: string[];
  /** Namen, die im Land üblich sind. */
  namen: string[];
}

const DE: LandProfil = {
  code: "de", name: "Deutschland", kurz: "DE",
  waehrung: "€", waehrungVorn: false,
  register: "SCHUFA", registerLang: "SCHUFA",
  ohneRegister: "Ohne SCHUFA.",
  registerNeutral: "Schufaneutral",
  bankenSatz: "Während traditionelle Banken noch Formulare drucken, hast du dein Limit bereits aktiviert.",
  staedte: ["Köln", "Berlin", "Hamburg", "München", "Frankfurt"],
  namen: ["Markus K.", "Sarah M.", "Daniel R.", "Julia W.", "Thomas B."],
};

const AT: LandProfil = {
  code: "at", name: "Österreich", kurz: "AT",
  waehrung: "€", waehrungVorn: false,
  // In Österreich führt der KSV1870 die Bonitätsdaten — nicht die SCHUFA.
  // Wer in Wien „SCHUFA" liest, weiß, dass die Seite nicht für ihn gemacht ist.
  register: "KSV", registerLang: "KSV1870",
  ohneRegister: "Ohne KSV-Abfrage.",
  registerNeutral: "KSV-neutral",
  bankenSatz: "Während traditionelle Banken noch Formulare drucken, hast du dein Limit bereits aktiviert.",
  staedte: ["Wien", "Graz", "Linz", "Salzburg", "Innsbruck"],
  namen: ["Michael H.", "Anna P.", "Stefan G.", "Katharina L.", "Andreas F."],
};

const CH: LandProfil = {
  code: "ch", name: "Schweiz", kurz: "CH",
  // ── „CHF" STEHT VORN ──────────────────────────────────────────────────────
  // Schweizer Schreibweise: „CHF 59.99", nicht „59.99 CHF". Bei Limits ist
  // beides gebräuchlich („25'000 CHF"); für die Preise gilt CHF vorn.
  waehrung: "CHF", waehrungVorn: true,
  // Die ZEK (Zentralstelle für Kreditinformation) ist das schweizerische
  // Gegenstück. „Betreibung" wäre das Verfahren, nicht das Register — im
  // Marketingtext ist ZEK der Begriff, den jeder kennt.
  register: "ZEK", registerLang: "ZEK (Zentralstelle für Kreditinformation)",
  ohneRegister: "Ohne ZEK.",
  registerNeutral: "ZEK-neutral",
  bankenSatz: "Während Schweizer Filialbanken noch Formulare drucken, hast du dein Limit bereits aktiviert.",
  staedte: ["Zürich", "Bern", "Zug", "Luzern", "Basel"],
  namen: ["Marc L.", "Beat S.", "Lukas M.", "Pascal K.", "Nadine R."],
};

export const LAENDER: Record<Land, LandProfil> = { de: DE, at: AT, ch: CH };

/** Die Vorgabe, solange niemand gewählt hat. */
export const LAND_VORGABE: Land = "de";

const SCHLUESSEL = "fiaon_land";

/**
 * Welches Land gilt gerade?
 *
 * ── DIE REIHENFOLGE ────────────────────────────────────────────────────────
 *   1. `?land=ch` in der Adresse — damit eine Kampagne direkt landen kann,
 *      ohne dass der Besucher wählt.
 *   2. Was er zuletzt gewählt hat.
 *   3. Deutschland.
 *
 * Absichtlich KEINE IP-Erkennung: Sie ist bei VPN und Mobilfunk oft falsch,
 * und ein Schweizer, dem Deutschland gezeigt wird, klickt nicht weiter — er
 * geht. Die Kampagne liefert `?land=ch` mit; wer ohne Parameter kommt, wird
 * gefragt. Eine Frage ist ehrlicher als eine falsche Vermutung.
 */
export function landLesen(): Land {
  if (typeof window === "undefined") return LAND_VORGABE;
  const ausAdresse = new URLSearchParams(window.location.search).get("land");
  if (ausAdresse && ausAdresse in LAENDER) {
    landSchreiben(ausAdresse as Land);
    return ausAdresse as Land;
  }
  try {
    const gemerkt = window.localStorage.getItem(SCHLUESSEL);
    if (gemerkt && gemerkt in LAENDER) return gemerkt as Land;
  } catch { /* privater Modus */ }
  return LAND_VORGABE;
}

export function landSchreiben(l: Land): void {
  try { window.localStorage.setItem(SCHLUESSEL, l); } catch { /* egal */ }
}

/** Hat der Besucher schon gewählt — oder muss gefragt werden? */
export function landGewaehlt(): boolean {
  if (typeof window === "undefined") return true;
  if (new URLSearchParams(window.location.search).get("land")) return true;
  try { return !!window.localStorage.getItem(SCHLUESSEL); } catch { return true; }
}

/**
 * Einen Betrag mit Währung schreiben.
 *
 * ── DIE ZAHL BLEIBT, DAS ZEICHEN WECHSELT ─────────────────────────────────
 * `betrag("25.000")` ergibt „25.000 €" oder „CHF 25'000". Es wird NICHTS
 * umgerechnet — 25.000 heißt in Zürich 25.000 CHF.
 *
 * Der Apostroph als Tausendertrenner ist schweizerische Norm („25'000"). Ein
 * Punkt wäre dort ein Dezimaltrenner und liest sich falsch.
 */
export function betrag(zahl: string, land: Land): string {
  const p = LAENDER[land];
  const z = land === "ch" ? zahl.replace(/\./g, "'") : zahl;
  return p.waehrungVorn ? `${p.waehrung} ${z}` : `${z} ${p.waehrung}`;
}

/**
 * Eine monatliche Gebühr schreiben.
 *
 * Im deutschsprachigen Raum trennt ein Komma die Rappen bzw. Cent — in der
 * Schweiz ein Punkt: „CHF 59.99" gegen „59,99 €".
 */
export function gebuehr(zahl: string, land: Land): string {
  const p = LAENDER[land];
  const z = land === "ch" ? zahl.replace(",", ".") : zahl;
  return p.waehrungVorn ? `${p.waehrung} ${z}` : `${z} ${p.waehrung}`;
}
