// ═══════════════════════════════════════════════════════════════════════════
// DIE KENNUNG EINER AKTE — Regeln und Texte an EINER Stelle
// (E-IT-E, 08.10.2026, Punkt 5 „Akte aus dem Chefbüro: nicht gefunden")
//
// ── WAS GEMELDET WURDE ────────────────────────────────────────────────────
// Ein Klick in der Chef-Kundenliste öffnete „Akte nicht gefunden". Gemessen
// am 07.10.2026: Von 5.781 echten Personen der Liste öffneten 3.024 (52 %)
// keine Akte — 3.022 reine Interessenten (nur Lead) und 2 leere Hüllen. In
// den „Kalten Leads" der Kunden-Zentrale waren es 3.024 von 3.369 Zeilen.
// Dazu kamen zusammengeführte Personen (WhatsApp-Gespräche, Anrufe und
// Termine zeigen weiter auf den Verlierer) und Links ohne Kennung („?id=null").
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Jede Tür übergibt, was sie in der Hand hat: Personen-Nummer, „person-N",
// „lead-N", Bestell-Referenz, Verwendungszweck oder Personen-Kennung
// (FIAON-P-…). EINE Auflösung (server/lib/fiaon-akte-aufloesen.ts) macht
// daraus die Akte — und sagt, wenn sie umleitet, WARUM. Hier stehen nur die
// reinen Regeln und Texte, damit Server und Oberfläche dieselben benutzen.
// ═══════════════════════════════════════════════════════════════════════════

/** Was in einer Kennung steckt — noch ohne Datenbank. */
export type AkteKennung =
  | { art: "leer" }
  | { art: "person"; personId: number }
  | { art: "lead"; leadId: number }
  | { art: "text"; wert: string };

/**
 * Wörter, die ein Link trägt, wenn der Aufrufer keine Kennung hatte: Aus
 * `href={"/chef/s/akte?id=" + z.personId}` wird bei fehlender Nummer
 * „?id=null" oder „?id=undefined". Das ist KEINE unbekannte Kennung, sondern
 * gar keine — und verdient eine andere Meldung als „nicht gefunden".
 */
const LEERWORTE = new Set(["", "null", "undefined", "nan", "none", "0", "-", "—"]);

/** Die Kennung lesen. Rein, ohne Datenbank — für Server UND Oberfläche. */
export function kennungLesen(eingabe: unknown): AkteKennung {
  const s = String(eingabe ?? "").trim();
  if (LEERWORTE.has(s.toLowerCase())) return { art: "leer" };
  // Höchstens neun Ziffern: fiaon_persons.id ist int4 — eine zehnstellige Zahl
  // (etwa eine eingetippte Rufnummer) würde in der Abfrage als Fehler enden.
  const person = s.match(/^(?:person-)?(\d{1,9})$/i);
  if (person) {
    const id = Number(person[1]);
    return id > 0 ? { art: "person", personId: id } : { art: "leer" };
  }
  const lead = s.match(/^lead-(.*)$/i);
  if (lead) {
    const id = /^\d{1,9}$/.test(lead[1]) ? Number(lead[1]) : 0;
    return id > 0 ? { art: "lead", leadId: id } : { art: "leer" };
  }
  const personLeer = s.match(/^person-(.*)$/i);
  if (personLeer) return { art: "leer" };
  return { art: "text", wert: s };
}

/** Warum die Akte nicht dort steht, wohin der Link zeigte. */
export type UmleitungsGrund =
  | "person_zusammengefuehrt"
  | "person_ohne_bestellung"
  | "lead_zur_person"
  | "lead_konvertiert"
  | "lead_kontaktgleich"
  | "bestellung_zusammengefuehrt"
  | "bestellung_ersetzt"
  | "kettenziel_fehlt"
  | "familie_kontaktgleich";

export interface Umleitung {
  grund: UmleitungsGrund;
  /** Wovon umgeleitet wurde (Personen-Nummer, lead-N oder Referenz). */
  von: string;
  /** Wohin (Personen-Nummer, lead-N oder Referenz). */
  nach: string;
  /** Wann es geschah — nur bekannt, wo ein Protokoll existiert. */
  am: string | null;
  /** Wer es entschieden hat — aus dem Merge-Protokoll. */
  wer: string | null;
}

/** Warum es keine Akte gibt. */
export type AkteFehlerGrund =
  | "kennung_leer"
  | "person_fehlt"
  | "person_ohne_vorgang"
  | "lead_fehlt"
  | "bestellung_fehlt"
  | "kette_kaputt";

/**
 * Überschriften der Fehlerseite — je GRUND, nicht ein „nicht gefunden" für
 * alles. Dazu die drei Fälle, die gar nicht von der Kennung kommen: Sitzung
 * abgelaufen (401/403), Server-Fehler (ab 500) und fehlende Freigabe.
 * Gemessen am 07.10.2026: Eine abgelaufene Chef-Sitzung (12 h) zeigte bisher
 * ebenfalls „Akte nicht gefunden" — und schickte Menschen auf die Suche nach
 * einem Kunden, den es gab.
 */
export const AKTE_FEHLER_TITEL: Record<AkteFehlerGrund | "sitzung" | "server" | "kein_zugriff", string> = {
  kennung_leer: "Der Link trägt keine Kundenkennung",
  person_fehlt: "Diese Personen-Nummer gibt es nicht",
  person_ohne_vorgang: "Angelegt, aber ohne Antrag und ohne Interessenten-Eintrag",
  lead_fehlt: "Diesen Interessenten-Eintrag gibt es nicht",
  bestellung_fehlt: "Zu dieser Referenz gibt es keine Bestellung",
  kette_kaputt: "Die Zusammenführung dieser Person ist fehlerhaft verkettet",
  sitzung: "Sitzung abgelaufen — bitte neu anmelden",
  server: "Server-Fehler — die Akte existiert vermutlich, bitte neu laden",
  kein_zugriff: "Diese Akte ist für dich nicht freigegeben",
};

/** Der Satz, wenn der Link ganz leer war. Eine Quelle für Server und Oberfläche. */
export const TEXT_KENNUNG_LEER = "Der Link trägt keine Kundenkennung — bitte über die Suche öffnen.";

/** Ein Datum für Menschen, Berliner Zeit. */
function tagText(am: string | null): string | null {
  if (!am) return null;
  const d = new Date(am);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Der Satz für das Hinweisband über der Akte. Eine Umleitung wird NIE still
 * gemacht: Nach einem falschen Zusammenführen sieht man sonst die Daten des
 * Gewinners und hält sie für die des Verlierers.
 */
export function umleitungText(u: Umleitung): string {
  const tag = tagText(u.am);
  const wann = tag ? ` am ${tag}` : "";
  const wer = u.wer ? ` (zusammengeführt von ${u.wer})` : "";
  switch (u.grund) {
    case "person_zusammengefuehrt":
      return `Person ${u.von} ist${wann} in Person ${u.nach} aufgegangen${wer} — du siehst die gemeinsame Akte.`;
    case "person_ohne_bestellung":
      return `Person ${u.von} hat noch keine Bestellung — du siehst die Interessenten-Akte (${u.nach}).`;
    case "lead_zur_person":
      return `Der Interessenten-Eintrag ${u.von} gehört zu einer Person mit Bestellung — du siehst deren Akte (${u.nach}).`;
    case "lead_konvertiert":
      return `Der Interessenten-Eintrag ${u.von} wurde zur Bestellung ${u.nach} — du siehst deren Akte.`;
    case "lead_kontaktgleich":
      return `Der Interessenten-Eintrag ${u.von} hat keine Personen-Nummer. Die Akte hängt über gleiche E-Mail oder Nummer an der Bestellung ${u.nach} — bitte prüfen, ob es derselbe Mensch ist.`;
    case "bestellung_zusammengefuehrt":
      return `Die Bestellung ${u.von} wurde${wann} mit ${u.nach} zusammengeführt — du siehst die gemeinsame Akte.`;
    case "bestellung_ersetzt":
      return `Die Bestellung ${u.von} wurde durch ${u.nach} ersetzt — du siehst die neuere.`;
    case "kettenziel_fehlt":
      return `Die Bestellung ${u.von} verweist auf ${u.nach}, das es nicht gibt — die Akte bleibt bei ${u.von}.`;
    case "familie_kontaktgleich":
      return `Die Akte zeigt die bezahlte Bestellung ${u.nach} einer anderen Person (gleiche E-Mail oder Nummer wie ${u.von}) — bitte prüfen, ob es derselbe Mensch ist.`;
    default:
      return `Umgeleitet von ${u.von} nach ${u.nach}.`;
  }
}

/**
 * Der Link in eine Akte. `null`, wenn keine Kennung da ist — dann zeigt der
 * Aufrufer den Namen ohne Link statt eines Links ins Leere.
 *
 * `ort`: „chef" bleibt im Chefbüro (/chef/s/akte?id=…), „admin" ist die
 * ältere Verwaltung (/admin/kunde/…). Beide öffnen dieselbe Seite.
 */
export function akteLinkFuer(kennung: unknown, ort: "chef" | "admin"): string | null {
  const k = kennungLesen(kennung);
  if (k.art === "leer") return null;
  const wert = k.art === "person" ? String(k.personId)
    : k.art === "lead" ? `lead-${k.leadId}`
    : k.wert;
  return ort === "chef"
    ? `/chef/s/akte?id=${encodeURIComponent(wert)}`
    : `/admin/kunde/${encodeURIComponent(wert)}`;
}
