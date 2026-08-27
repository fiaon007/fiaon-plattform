// ═══════════════════════════════════════════════════════════════════════════
// IST DER ANTRAG INHALTLICH FERTIG? — EINE DEFINITION, ZWEI FASSUNGEN
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Bei einigen Kunden wird angezeigt, dass sich der Antrag noch ‚im Formular'
// befindet. Das Problem ist, dass der Antrag aus meiner Sicht bereits
// vollständig ausgefüllt ist. Es ist nicht ersichtlich, welche Information noch
// fehlt oder an welcher Stelle der Antrag noch ‚fertiggestellt' werden soll."
//
// ── DER BEFUND (gemessen am 19.08.2026, scripts/mess-rechnung-blockade.ts) ──
// 402 Personen tragen den Sperrgrund `antrag_unfertig`. Aufgeteilt nach dem
// Zustand in der Zeile:
//
//     Zustand            Schritt  Anzahl  inhaltlich
//     started                  9      23  VOLLSTÄNDIG  ← Daniels Fälle
//     payment_completed        9       1   VOLLSTÄNDIG  ← auch
//     contract                 6     216  Schritt 6 fehlt (Mail, Zusagen)
//     finances                 2     165  ab Schritt 2 leer
//     config                   3      42  ab Schritt 3 leer
//     personal_data            1      28  ab Schritt 1 leer
//
// Die 24 Fälle mit `current_step = 9` tragen ALLE drei Zusagen, eine
// E-Mail-Adresse, den Gehaltseingangstag und vollständige Stammdaten. Sie sind
// fertig. Der Zustand sagt „started" — der ERSTE Schritt.
//
// ── DIE URSACHE ────────────────────────────────────────────────────────────
// `client/src/pages/antrag.tsx` schrieb den Zustand über einen Index:
//
//     ["started","personal_data","finances","config","verifying","approved",
//      "contract","processing","completed"][step] || "started"
//
// Die Liste hat NEUN Einträge, also die Indizes 0 bis 8. Das Formular hat einen
// Schritt 9 (Passwort, nach der Zahlung). `[9]` ist `undefined`, und dann
// greift `|| "started"`: **Der letzte Schritt des Formulars schreibt den ersten
// Zustand.** Ein Antrag, der ganz durchlaufen wurde, sieht danach aus wie einer,
// der nie begonnen hat.
//
// ── WARUM DER INHALT ENTSCHEIDET, NICHT DER LETZTE KLICK ───────────────────
// AGENTS.md: „Zustände, die sich ausrechnen lassen, werden AUSGERECHNET." Der
// Zustand ist ein Merker, den ein verlorenes Ereignis falsch stehen lässt — die
// Felder sind die Tatsache. Wer alle Pflichtfelder trägt, ist fertig, ganz
// gleich welcher Klick zuletzt ankam.
//
// ── ZWEI FASSUNGEN, EIN PRÜFSTAND ─────────────────────────────────────────
// Die Arbeitsliste holt über 1.000 Karten in EINER Abfrage — dort muss die
// Regel als SQL stehen. Die Akte bewertet eine Zeile — dort als TypeScript.
// AGENTS.md erlaubt das ausdrücklich nur, wenn ein Prüfstand beide
// GEGENEINANDER hält: `scripts/pruef-antrag-vollstaendig.ts` tut das an jeder
// Konstellation im Bestand.
// ═══════════════════════════════════════════════════════════════════════════

export interface Pflichtfeld {
  /** Die Spalte in `fiaon_applications`. */
  spalte: string;
  /**
   * Dieselbe Angabe an der PERSON, wo es sie dort gibt.
   *
   * ── WARUM DAS NÖTIG IST (27.08.2026) ────────────────────────────────────
   * Justin schickte die Akte von Godwin Uche: Die Lückenliste verlangte
   * Geburtsdatum, Telefonnummer, Straße, PLZ und Ort — und der Reiter „Daten"
   * daneben zeigte alle fünf. Beides stimmte: Die Angaben stehen an der
   * PERSON, die Prüfung las nur die BESTELLUNG.
   *
   * Seit Migration 059 ist die Person die gültige Wahrheit und die Spalten an
   * der Bestellung sind Abschriften (AGENTS.md). Genau diese Lehre steht seit
   * dem 19.08. in fiaon-massgebliche-bestellung.ts — für den Empfänger einer
   * Mail wurde sie gezogen, für die Lückenliste nicht.
   *
   * GEMESSEN über alle 1.893 Kunden mit offener Bestellung: 222-mal fehlt die
   * E-Mail an der Bestellung und steht an der Person, 88-mal die Telefonnummer,
   * je 82-mal Geburtsdatum, Straße, PLZ und Ort. So oft hat die Plattform
   * einem Mitarbeiter gesagt, er solle etwas erfragen, das längst dasteht.
   *
   * Fehlt der Eintrag hier, gibt es die Angabe an der Person nicht (etwa
   * Beschäftigung oder IBAN) — dann bleibt die Bestellung allein maßgeblich.
   */
  person?: string;
  /** Was ein Mensch am Telefon fragen würde. Steht so in der Karte. */
  name: string;
  /** `text` = Zeichenkette, die nicht leer sein darf; `ja` = Boolean-Zusage. */
  art: "text" | "ja";
  /**
   * Nur nötig, wenn diese Bedingung zutrifft (SQL-Ausdruck über `a`).
   * Die IBAN braucht nur, wer per Lastschrift zahlt — genau wie im Formular
   * (`if (d.billingMethod === "iban" && !d.iban)`).
   */
  nurWenn?: (zeile: Record<string, any>) => boolean;
  nurWennSql?: (a: string) => string;
  /**
   * Eine Willenserklärung, die NUR der Kunde selbst abgeben darf.
   *
   * ── WARUM DIESE MARKE (21.08.2026) ──────────────────────────────────────
   * Die drei Zustimmungen standen in derselben Liste wie „Ort" und „IBAN",
   * und die Oberfläche behandelte sie gleich: als etwas, das jemand
   * nachträgt. Ein Mitarbeiter, der am Telefon „ja, passt" hört und ein
   * Häkchen setzt, erzeugt aber keinen Nachweis, sondern eine Behauptung —
   * dieselbe Fehlerklasse wie der Roboter, der am 06.08.2026 eine
   * Verpflichtungserklärung „echt angenommen" hat (AGENTS.md).
   *
   * Wo diese Marke steht, gibt es in keiner Mitarbeiter-Oberfläche ein
   * Eingabefeld — nur einen Link an den Kunden.
   */
  nurKunde?: true;
}

/**
 * Die Pflichtfelder eines Privatantrags — in der Reihenfolge des Formulars.
 *
 * Abgeglichen mit `client/src/pages/antrag.tsx`, Funktion `next()`: Das sind
 * genau die Felder, die das Formular selbst verlangt, bevor es weiterlässt. Ein
 * Feld, das das Formular nicht erzwingt, darf hier nicht stehen — sonst
 * verlangt die Karte etwas, das der Kunde nie gefragt wurde.
 */
export const PFLICHTFELDER: readonly Pflichtfeld[] = [
  // Schritt 1 — persönliche Daten
  { spalte: "first_name", person: "first_name", name: "Vorname", art: "text" },
  { spalte: "last_name", person: "last_name", name: "Nachname", art: "text" },
  { spalte: "birthdate", person: "birthdate", name: "Geburtsdatum", art: "text" },
  { spalte: "phone", person: "primary_phone", name: "Telefonnummer", art: "text" },
  { spalte: "street", person: "street", name: "Straße", art: "text" },
  { spalte: "zip", person: "zip", name: "PLZ", art: "text" },
  { spalte: "city", person: "city", name: "Ort", art: "text" },
  { spalte: "country", person: "country", name: "Land", art: "text" },
  { spalte: "nationality", person: "nationality", name: "Staatsangehörigkeit", art: "text" },
  // Schritt 2 — Beschäftigung
  { spalte: "employment", name: "Beschäftigung", art: "text" },
  { spalte: "employed_since", name: "beschäftigt seit", art: "text" },
  { spalte: "housing", name: "Wohnsituation", art: "text" },
  // Schritt 3 — Verwendung
  { spalte: "purpose", name: "Verwendungszweck der Karte", art: "text" },
  // Schritt 6 — Abschluss
  { spalte: "email", person: "primary_email", name: "E-Mail-Adresse", art: "text" },
  { spalte: "salary_receipt_day", name: "Tag des Gehaltseingangs", art: "text" },
  {
    spalte: "iban", name: "IBAN", art: "text",
    nurWenn: (z) => String(z.billing_method ?? "") === "iban",
    nurWennSql: (a) => `${a}.billing_method = 'iban'`,
  },
  { spalte: "consent_agb", name: "Zustimmung zu den AGB", art: "ja", nurKunde: true },
  { spalte: "consent_schufa", name: "SCHUFA-Einwilligung", art: "ja", nurKunde: true },
  { spalte: "consent_contract", name: "Zustimmung zum Vertrag", art: "ja", nurKunde: true },
] as const;

/** Der Firmenantrag hat andere Pflichtfelder — dieselbe Bauform. */
export const PFLICHTFELDER_FIRMA: readonly Pflichtfeld[] = [
  { spalte: "company_name", name: "Firmenname", art: "text" },
  { spalte: "contact_name", name: "Ansprechpartner", art: "text" },
  { spalte: "contact_email", name: "E-Mail-Adresse", art: "text" },
  { spalte: "contact_phone", name: "Telefonnummer", art: "text" },
  { spalte: "consent_agb", name: "Zustimmung zu den AGB", art: "ja", nurKunde: true },
  { spalte: "consent_contract", name: "Zustimmung zum Vertrag", art: "ja", nurKunde: true },
] as const;

/**
 * Die Spalten, die ein Mitarbeiter NIE schreiben darf — als Wand für
 * Schreibrouten. Sie leitet sich aus der Marke ab und wird nicht abgeschrieben:
 * Eine zweite Liste hätte beim nächsten Zustimmungsfeld gefehlt.
 */
export const NUR_KUNDE_SPALTEN: readonly string[] = Array.from(new Set(
  [...PFLICHTFELDER, ...PFLICHTFELDER_FIRMA].filter((f) => f.nurKunde).map((f) => f.spalte),
));

export function pflichtfelderFuer(typ: unknown): readonly Pflichtfeld[] {
  return String(typ ?? "private") === "business" ? PFLICHTFELDER_FIRMA : PFLICHTFELDER;
}

/** Trägt die Zeile dieses Feld? Leerraum zählt als „nein" (AGENTS.md). */
function traegt(zeile: Record<string, any>, f: Pflichtfeld): boolean {
  const w = zeile[f.spalte];
  if (f.art === "ja") return w === true;
  return String(w ?? "").trim().length > 0;
}

/**
 * Welche Pflichtfelder fehlen? Klartext, in Formular-Reihenfolge.
 *
 * Der Rückgabewert wandert unverändert in die Karte: „Es fehlt: Geburtsdatum,
 * IBAN". Deshalb sind es Namen und keine Spaltenbezeichner — ein Agent am
 * Telefon liest keine `salary_receipt_day`.
 */
export function fehlendeFelder(zeile: Record<string, any>): string[] {
  const fehlt: string[] = [];
  for (const f of pflichtfelderFuer(zeile.type)) {
    if (f.nurWenn && !f.nurWenn(zeile)) continue;
    if (!traegt(zeile, f)) fehlt.push(f.name);
  }
  return fehlt;
}

/** Ist der Antrag inhaltlich fertig? */
export function antragVollstaendig(zeile: Record<string, any>): boolean {
  return fehlendeFelder(zeile).length === 0;
}

/**
 * Welche der drei Willenserklärungen fehlen noch?
 *
 * Getrennt von `fehlendeFelder`, weil sie einen anderen Weg haben: Sachangaben
 * trägt der Mitarbeiter am Telefon nach, Zustimmungen gibt nur der Kunde.
 */
export function fehlendeZustimmungen(zeile: Record<string, any>): string[] {
  return pflichtfelderFuer(zeile.type)
    .filter((f) => f.nurKunde && !traegt(zeile, f))
    .map((f) => f.name);
}

/**
 * Dieselbe Regel als SQL-Ausdruck — für Abfragen über den ganzen Bestand.
 *
 * Sie muss buchstäblich dasselbe sagen wie `antragVollstaendig`. Der Prüfstand
 * `scripts/pruef-antrag-vollstaendig.ts` vergleicht beide an jeder
 * Konstellation im Bestand; weicht eine ab, wird er rot.
 */
export function antragVollstaendigSql(a = "a"): string {
  const teil = (f: Pflichtfeld): string => {
    const da = f.art === "ja"
      ? `${a}.${f.spalte} IS TRUE`
      : `NULLIF(TRIM(${a}.${f.spalte}::text), '') IS NOT NULL`;
    return f.nurWennSql ? `(NOT (${f.nurWennSql(a)}) OR ${da})` : da;
  };
  const privat = PFLICHTFELDER.map(teil).join("\n      AND ");
  const firma = PFLICHTFELDER_FIRMA.map(teil).join("\n      AND ");
  return `(CASE WHEN ${a}.type = 'business'
      THEN (${firma})
      ELSE (${privat})
    END)`;
}

/**
 * Die fehlenden Felder als SQL-Ausdruck — ein Text wie
 * „Geburtsdatum, IBAN" oder `NULL`, wenn nichts fehlt.
 *
 * Dieselbe Reihenfolge wie `fehlendeFelder`, damit Liste und Akte denselben Satz
 * zeigen. Gebaut mit `concat_ws`, das NULL-Werte überspringt: Für jedes Feld
 * steht dort entweder sein Name (fehlt) oder NULL (ist da).
 */
export function fehlendeZustimmungenAusdruckSql(a = "a"): string {
  const bau = (liste: readonly Pflichtfeld[]) => {
    const nur = liste.filter((f) => f.nurKunde);
    return `NULLIF(CONCAT_WS(', ', ${nur
      .map((f) => `CASE WHEN NOT (${a}.${f.spalte} IS TRUE) THEN '${f.name}' END`)
      .join(", ")}), '')`;
  };
  return `(CASE WHEN ${a}.type = 'business'
      THEN ${bau(PFLICHTFELDER_FIRMA)}
      ELSE ${bau(PFLICHTFELDER)}
    END)`;
}

export function fehlendeFelderAusdruckSql(a = "a", pers?: string): string {
  const teil = (f: Pflichtfeld): string => {
    // Eine Angabe gilt als vorhanden, wenn sie an der Bestellung ODER an der
    // Person steht. Zustimmungen (`ja`) bleiben an der Bestellung: Sie gehören
    // zu DIESEM Vertrag, nicht zum Menschen.
    const anDerPerson = pers && f.person && f.art === "text"
      ? ` OR NULLIF(TRIM(${pers}.${f.person}::text), '') IS NOT NULL`
      : "";
    const da = f.art === "ja"
      ? `${a}.${f.spalte} IS TRUE`
      : `(NULLIF(TRIM(${a}.${f.spalte}::text), '') IS NOT NULL${anDerPerson})`;
    // Ein Feld, das gar nicht nötig ist, gilt als vorhanden.
    const noetig = f.nurWennSql ? `(${f.nurWennSql(a)})` : "TRUE";
    // Der Name wird als Literal eingesetzt; er kommt aus dieser Datei und
    // enthält keine Anführungszeichen — kein Platz für eine Einschleusung.
    return `CASE WHEN ${noetig} AND NOT (${da}) THEN '${f.name}' END`;
  };
  const bau = (liste: readonly Pflichtfeld[]) =>
    `NULLIF(CONCAT_WS(', ', ${liste.map(teil).join(", ")}), '')`;
  return `(CASE WHEN ${a}.type = 'business'
      THEN ${bau(PFLICHTFELDER_FIRMA)}
      ELSE ${bau(PFLICHTFELDER)}
    END)`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE ZUSTÄNDE, DIE EIN FORMULARSCHRITT SIND
//
// Sie stehen hier und nicht als Literal in der Abfrage: Der Nachzieh-Lauf und
// die Ableitung müssen dieselbe Menge meinen. `RECHNUNGSREIF` in
// `fiaon-rechnung-stellen.ts` ist die Gegenmenge — beide Listen zusammen
// müssen jeden Wert abdecken, der im Bestand vorkommt.
// ═══════════════════════════════════════════════════════════════════════════
export const FORMULAR_SCHRITTE = [
  "started", "config", "personal_data", "contract", "finances",
] as const;

export const FORMULAR_SCHRITTE_SQL =
  FORMULAR_SCHRITTE.map((s) => `'${s}'`).join(",");
