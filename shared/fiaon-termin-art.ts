// ═══════════════════════════════════════════════════════════════════════════
// WELCHE ART TERMIN IST DAS?
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Man sieht nicht, was für ein Termin das ist."
//
// ── WAS VORHER DASTAND ─────────────────────────────────────────────────────
// Vier Anzeigen, vier eigene Erfindungen aus derselben Spalte `quelle`:
//
//   Kalender          „Kunde hat gebucht" / „Rückruf" / „Zahlungs-Zusage"
//   Termin-Zentrale   „Nicht erreicht — Terminlink", „Startgespräch
//                     (Onboarding)", „Vom Agenten eingetragen", …
//   Obere Leiste      „Startgespräch" / „Rückruf" (aus einem anderen Feld)
//   Startgespräche    nichts
//   Bestätigungsmail  nichts
//
// Fünf Stellen, fünf Wortschätze — und keine sagte dem Agenten, worauf er sich
// einstellen muss. „Kunde hat gebucht" beschreibt den WEG, nicht das Gespräch.
//
// ── DIE DREI ARTEN ─────────────────────────────────────────────────────────
// Der Auftrag nennt sie: Onboarding, Vertrieb, Rückruf. Sie beschreiben, was
// gleich passiert:
//
//   ONBOARDING  Das Startgespräch nach der Zahlung. Der Mensch hat bezahlt und
//               wird freigeschaltet — kein Verkauf mehr.
//   VERTRIEB    Ein Beratungsgespräch. Der Mensch hat noch nicht bezahlt.
//   RÜCKRUF     Der Agent hat sich selbst notiert, zurückzurufen. Kein vom
//               Kunden gebuchter Termin.
//
// Die Ableitung steht HIER, weil sie an fünf Stellen gebraucht wird — und weil
// eine sechste dazukommen wird. Wer sie dort erfindet, erfindet die sechste
// Fassung.
// ═══════════════════════════════════════════════════════════════════════════

export type TerminArt = "onboarding" | "vertrieb" | "rueckruf";

export interface TerminArtMarke {
  art: TerminArt;
  /** Die Aufschrift. Kurz — sie steht in einer Zeile neben der Uhrzeit. */
  text: string;
  /** Ein Satz, der sagt, worauf sich der Agent einstellt. Für Titel/Tooltip. */
  erklaerung: string;
  /** Farbton für die Marke. Kein Rot: Eine Terminart ist keine Warnung. */
  ton: string;
  grund: string;
}

const MARKEN: Record<TerminArt, Omit<TerminArtMarke, "grund">> = {
  onboarding: {
    art: "onboarding",
    text: "Onboarding",
    erklaerung: "Startgespräch nach der Zahlung — freischalten, nicht verkaufen.",
    ton: "#047857",
  },
  vertrieb: {
    art: "vertrieb",
    text: "Vertrieb",
    erklaerung: "Beratungsgespräch. Der Mensch hat noch nicht bezahlt.",
    ton: "#1d4ed8",
  },
  rueckruf: {
    art: "rueckruf",
    text: "Rückruf",
    erklaerung: "Selbst notierter Rückruf — kein vom Kunden gebuchter Termin.",
    ton: "#92400e",
  },
};

/**
 * Die Art aus der Quelle ableiten.
 *
 * `quelle` ist die Spalte `fiaon_termine.quelle`. Unbekannte Werte werden
 * NICHT geraten: Sie fallen auf „Vertrieb" zurück, und das steht so im Grund —
 * damit ein neuer Quellwert auffällt, statt stillschweigend als Rückruf zu
 * erscheinen.
 */
export function terminArtAusQuelle(quelle: unknown): TerminArtMarke {
  const q = String(quelle ?? "").trim().toLowerCase();
  switch (q) {
    case "onboarding":
    case "onboarding_call":
      return { ...MARKEN.onboarding, grund: `Quelle „${q}“` };
    case "agent_manuell":
    case "nummer_korrektur":
      return { ...MARKEN.rueckruf, grund: `Quelle „${q}“` };
    case "nichterreicht_mail":
    case "portal":
      return { ...MARKEN.vertrieb, grund: `Quelle „${q}“` };
    default:
      return {
        ...MARKEN.vertrieb,
        grund: q ? `unbekannte Quelle „${q}“ — als Vertrieb geführt` : "ohne Quelle",
      };
  }
}

/**
 * Die Art für einen Eintrag, der KEIN Termin ist.
 *
 * Der Kalender mischt zwei Dinge: Termine aus `fiaon_termine` und
 * Wiedervorlagen aus dem Kontaktverlauf. Letztere sind immer Rückrufe — sie
 * haben keine `quelle`, und ohne diesen Weg müsste die Anzeige raten.
 */
export function terminArtRueckruf(): TerminArtMarke {
  return { ...MARKEN.rueckruf, grund: "Wiedervorlage aus dem Verlauf" };
}

/** Alle drei Marken — für Filterleisten und Legenden. */
export const TERMIN_ARTEN: TerminArtMarke[] = [
  { ...MARKEN.onboarding, grund: "" },
  { ...MARKEN.vertrieb, grund: "" },
  { ...MARKEN.rueckruf, grund: "" },
];
