// ═══════════════════════════════════════════════════════════════════════════
// DIE KONTAKT-ERGEBNISSE — EINE LISTE FÜR SERVER UND OBERFLÄCHE
//
// ── DIE MELDUNG, ZUM DRITTEN MAL (Daniel Stripling, 19.08.2026) ────────────
// „Wenn ich bei einem Kunden auf ‚Erreicht – Sonstiges' klicke, passiert
// aktuell nichts bzw. der Status wird nicht entsprechend übernommen. Sinnvoll
// wäre hier zusätzlich ein Kommentarfeld."
//
// ── WARUM ES DREIMAL GEMELDET WURDE ───────────────────────────────────────
// Weil dieselbe Liste an VIER Stellen stand, jede mit eigenen Angaben:
//
//   server/lib/fiaon-kontakt-ergebnis.ts   9 Werte, BRAUCHT_NOTIZ, ERGEBNIS_TEXT
//   client/src/components/Softphone.tsx    8 Werte, `notizPflicht`
//   client/src/pages/agent/kunden-neu.tsx  9 Werte, `braucht: "notiz"`
//   client/src/pages/agent/kontakt-ergebnis.tsx  KUNDE_GRUPPEN — OHNE Sonstiges
//
// Vier Listen, vier Wortlaute, und die Pflichtangabe an drei von vier Stellen.
// Am 24.08. wurde die Pflicht in `kunden.tsx` gebaut — eine Datei, die keine
// Route mehr lud; am 28.08. wurde sie gelöscht und der Fix mit ihr. In
// `kunden-neu.tsx` blieb ein Zustandswert („notiz") ohne jedes Bauteil, das ihn
// anzeigt. Der Knopf setzte ihn und kehrte zurück: kein Feld, keine Anfrage,
// keine Meldung. Genau das, was ein Mensch als „nichts passiert" erlebt.
//
// ── DIE STRUKTURELLE ANTWORT ──────────────────────────────────────────────
// Diese Datei ist die Liste. `shared/`, damit Server UND Oberfläche sie lesen
// (AGENTS.md: „Eine Filterregel gehört in shared/"). Das Bauteil, das sie
// anzeigt, steht genau einmal in `client/src/components/agent/ErgebnisWahl.tsx`.
// Wer ein Ergebnis hinzufügt, ändert eine Zeile — und alle Wege haben es.
// ═══════════════════════════════════════════════════════════════════════════

export const ERGEBNISSE = [
  "erreicht_zahlt_gleich",
  "erreicht_zahlt_am",
  "erreicht_abgelehnt",
  "erreicht_sonstiges",
  "nicht_erreicht",
  "mailbox",
  "rueckruf_termin",
  "nummer_falsch",
  "nummer_blockiert",
] as const;

export type Ergebnis = (typeof ERGEBNISSE)[number];

export function istErgebnis(v: unknown): v is Ergebnis {
  return typeof v === "string" && (ERGEBNISSE as readonly string[]).includes(v);
}

/** Mindestlänge einer Pflichtnotiz. Kürzer ist keine Auskunft, sondern ein Haken. */
export const NOTIZ_MINDESTLAENGE = 10;

export interface ErgebnisAngabe {
  art: Ergebnis;
  /** Die Beschriftung am Knopf — kurz, für eine Reihe aus neun. */
  knopf: string;
  /** Der Klartext im Verlauf und in Meldungen — vollständig. */
  klartext: string;
  /** Was zusätzlich nötig ist, bevor gespeichert werden darf. */
  braucht: "zusage" | "termin" | "notiz" | null;
  /**
   * Nimmt der Kunde damit aus der eigenen Hand? Dann fragt die Oberfläche
   * vorher nach — eine Übergabe verschiebt auch die Provision.
   */
  gibtAb?: boolean;
}

/**
 * Die Reihenfolge ist die der Häufigkeit im Gespräch, nicht die alphabetische:
 * Was ein Agent zwanzigmal am Tag drückt, steht vorn.
 */
export const ERGEBNIS_LISTE: readonly ErgebnisAngabe[] = [
  {
    art: "erreicht_zahlt_gleich", knopf: "Zahlt sofort",
    klartext: "Erreicht — zahlt sofort", braucht: null,
  },
  {
    art: "erreicht_zahlt_am", knopf: "Zahlt am …",
    klartext: "Erreicht — zahlt am …", braucht: "zusage",
  },
  {
    art: "nicht_erreicht", knopf: "Nicht erreicht",
    klartext: "Nicht erreicht", braucht: null,
  },
  {
    art: "mailbox", knopf: "Mailbox besprochen",
    klartext: "Mailbox besprochen", braucht: null,
  },
  {
    art: "rueckruf_termin", knopf: "Rückruf vereinbart",
    klartext: "Rückruf vereinbart", braucht: "termin",
  },
  {
    art: "erreicht_abgelehnt", knopf: "Erreicht – abgelehnt",
    klartext: "Erreicht — abgelehnt", braucht: null,
  },
  // ── DER FALL, UM DEN ES DREIMAL GING ────────────────────────────────────
  // „Erreicht, aber es passt in keine Schublade." Ohne Notiz ist das kein
  // Ergebnis, sondern ein verlorenes Gespräch: Der nächste Anrufer fängt bei
  // Null an. Deshalb `braucht: "notiz"` — und deshalb prüft der Server es auch.
  {
    art: "erreicht_sonstiges", knopf: "Erreicht – Sonstiges",
    klartext: "Erreicht — Sonstiges", braucht: "notiz",
  },
  {
    art: "nummer_falsch", knopf: "Falsche Nummer",
    klartext: "Falsche Nummer", braucht: null,
  },
  {
    art: "nummer_blockiert", knopf: "Anrufer blockiert",
    klartext: "Anrufer blockiert — an Kollegen übergeben",
    braucht: null, gibtAb: true,
  },
] as const;

/** Nachschlagen ohne `find` an jeder Aufrufstelle. */
export const ERGEBNIS_TEXT: Record<Ergebnis, string> = Object.fromEntries(
  ERGEBNIS_LISTE.map((e) => [e.art, e.klartext]),
) as Record<Ergebnis, string>;

export function ergebnisAngabe(art: string): ErgebnisAngabe | null {
  return ERGEBNIS_LISTE.find((e) => e.art === art) ?? null;
}

/** Ergebnisse, die ohne Notiz nichts aussagen — abgeleitet, nicht zweitgepflegt. */
export const BRAUCHT_NOTIZ: ReadonlySet<Ergebnis> = new Set(
  ERGEBNIS_LISTE.filter((e) => e.braucht === "notiz").map((e) => e.art),
);

/** Braucht dieses Ergebnis ein Datum? */
export function brauchtDatum(e: Ergebnis): "zusage" | "termin" | null {
  const a = ergebnisAngabe(e)?.braucht ?? null;
  return a === "zusage" || a === "termin" ? a : null;
}

/**
 * Prüft die Notizpflicht. `null` heißt in Ordnung, sonst der Satz für den
 * Mitarbeiter. Server und Oberfläche rufen DIESE Funktion — sonst sagt die
 * Sperre etwas anderes als die Erklärung daneben.
 */
export function pruefeNotiz(ergebnis: string, notiz: unknown): string | null {
  if (!BRAUCHT_NOTIZ.has(ergebnis as Ergebnis)) return null;
  const text = String(notiz ?? "").trim();
  if (text.length >= NOTIZ_MINDESTLAENGE) return null;
  return `Für „${ERGEBNIS_TEXT[ergebnis as Ergebnis] ?? ergebnis}“ braucht es eine Notiz `
    + `(mindestens ${NOTIZ_MINDESTLAENGE} Zeichen). Ohne sie ist das Gespräch verloren — `
    + "der nächste Anrufer fängt bei Null an.";
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE BEISPIELE, DIE DANIEL GENANNT HAT — ALS ANTIPPBARE VORLAGEN
//
// Wörtlich aus der Meldung: „Kunde wartet noch auf eine Rückzahlung/Rückbuchung
// · Zahlung ist bereits intern weitergegeben worden · Kunde möchte sich noch
// einige Tage überlegen · Sonstige individuelle Absprachen."
//
// Sie stehen als Vorlage und nicht als Auswahlliste: Eine Auswahlliste erzeugt
// neun gleiche Notizen, und dann steht in der Akte „überlegt noch" ohne den
// Satz, der es erklärt. Angetippt füllt der Text das Feld und bleibt änderbar.
// ═══════════════════════════════════════════════════════════════════════════
export const NOTIZ_VORLAGEN: readonly { kurz: string; text: string }[] = [
  { kurz: "Rückzahlung erwartet", text: "Kunde wartet noch auf eine Rückzahlung/Rückbuchung — " },
  { kurz: "intern weitergegeben", text: "Zahlung ist bereits intern weitergegeben worden — " },
  { kurz: "überlegt noch", text: "Kunde möchte sich noch einige Tage überlegen — " },
  { kurz: "individuelle Absprache", text: "Individuelle Absprache: " },
] as const;
