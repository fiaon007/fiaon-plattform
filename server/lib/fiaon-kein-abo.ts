// ═══════════════════════════════════════════════════════════════════════════
// KEIN ABO — WELCHE BESTELLUNG ERZEUGT NIE EINE RATE? (17.09.2026, E-188)
//
// ── WARUM DIESE DATEI ──────────────────────────────────────────────────────
// Bis heute gab es genau einen Einmalkauf im Haus: die Bonitätsauskunft für
// 74 €. Der Abo-Motor erkannte sie am WORT — `pack_key = 'schufa'`, „Bonität"
// im Paketnamen, 74,00 € als Betrag. Mit FIAON Global kommen vier Einmalpakete
// dazu (2.499 € bis 35.999 €), und keines davon heißt „schufa". Gemessen am
// Quelltext vom 17.09.2026: Ein bezahltes Global-Paket hätte nach mark-paid
// zwölf Monatsraten à 2.499 € bekommen — samt Dauermahnung (E-182).
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Ob ein Paket ein Abo ist, steht im Katalog (shared/fiaon-pakete.ts, Feld
// `abo`) — und nur dort. Diese Datei reicht die Antwort an den Server durch,
// einmal als Funktion und einmal als SQL-Ausdruck, damit beide nie
// verschieden antworten können: Beide lesen NICHT_ABO_SCHLUESSEL.
//
// ── WAS HIER BEWUSST NICHT STEHT ───────────────────────────────────────────
// `!istAboPaket(pack_key)` wäre die falsche Frage. Für einen UNBEKANNTEN oder
// LEEREN Schlüssel antwortet der Katalog „kein Abo" — aber genau diese
// Altbestellungen (63 bezahlte Kunden ohne sauberes Bestellfeld, siehe
// fiaon-abo-pflicht.ts) SIND Abos. „Kein Abo" heißt deshalb: Der Katalog
// KENNT das Paket, und es steht dort mit `abo: false`. Alles andere bleibt,
// was es war; die alte Erkennung der Bonitätsauskunft über Name und Betrag
// läuft daneben weiter (Altbestellungen ohne pack_key).
// ═══════════════════════════════════════════════════════════════════════════
import { NICHT_ABO_SCHLUESSEL, paket } from "@shared/fiaon-pakete";

/** Kennt der Katalog dieses Paket als Einmalkauf (Bonitätsauskunft, FIAON Global)? */
export function istKeinAboPaket(packKey: unknown): boolean {
  const p = paket(packKey);
  return p != null && p.abo === false;
}

/** Wie der Einmalkauf heißt — für Protokoll und Rückgaben („… ist kein Abo"). */
export function keinAboName(packKey: unknown): string {
  return paket(packKey)?.label ?? "Einmalkauf";
}

// Die Schlüssel landen als Literale in SQL. Sie kommen aus dem eigenen
// Katalog, nie aus einer Eingabe — trotzdem wird die Form geprüft: Ein
// Schlüssel mit Hochkomma soll beim Start auffallen, nicht in einer Abfrage.
const SCHLUESSEL_FORM = /^[a-z0-9_]+$/;

function schluesselListe(): string {
  const falsch = NICHT_ABO_SCHLUESSEL.filter((k) => !SCHLUESSEL_FORM.test(k));
  if (falsch.length > 0) {
    throw new Error(`[KEIN-ABO] Paketschlüssel mit unerlaubten Zeichen: ${falsch.join(", ")}`);
  }
  // Ohne Einträge wäre `IN ()` ein Syntaxfehler — der leere Schlüssel trifft nie.
  return NICHT_ABO_SCHLUESSEL.length > 0 ? NICHT_ABO_SCHLUESSEL.map((k) => `'${k}'`).join(", ") : "''";
}

/**
 * „Diese Bestellung ist ein Einmalkauf" als SQL-Ausdruck.
 *
 * ── DER NULL-FALLSTRICK ───────────────────────────────────────────────────
 * `pack_key <> ALL(…)` wird bei `pack_key IS NULL` zu NULL, und ein
 * `AND NOT (NULL)` wirft die Zeile lautlos aus dem Ergebnis — genau der
 * Fehler, der in fiaon-abo-pflicht.ts schon einmal 63 Kunden gekostet hat.
 * Deshalb COALESCE: Der Ausdruck ist immer TRUE oder FALSE, nie NULL, und
 * darf blank mit `AND NOT …` benutzt werden. Groß-/Kleinschreibung und
 * Leerzeichen behandelt er wie `paket()` im Katalog.
 */
export function keinAboSql(alias = "a"): string {
  if (!/^[a-z][a-z0-9_]*$/i.test(alias)) throw new Error(`[KEIN-ABO] Ungültiger Tabellenalias: ${alias}`);
  return `(LOWER(TRIM(COALESCE(${alias}.pack_key, ''))) IN (${schluesselListe()}))`;
}

/** Der Ausdruck für den üblichen Alias `a` (fiaon_applications a). */
export const KEIN_ABO_SQL = keinAboSql("a");
