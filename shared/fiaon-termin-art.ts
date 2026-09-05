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

// ── DIE VIERTE ART (21.08.2026) ──────────────────────────────────────────
// Der Kommentar oben sagt: „eine sechste wird dazukommen". Hier ist die
// vierte Art — das Zahlungsgespräch. Sie musste dazu, weil die Zuständigkeit
// jetzt die Gesprächsart bestimmt und „Forderungsmanagement" eine der drei
// Zuständigkeiten ist. Ohne eigene Marke wäre ein Zahlungsgespräch im
// Kalender als „Vertrieb" erschienen — und der Mitarbeiter hätte sich auf ein
// Verkaufsgespräch eingestellt.
export type TerminArt = "onboarding" | "vertrieb" | "rueckruf" | "forderung" | "gruender";

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
  forderung: {
    art: "forderung",
    text: "Zahlung",
    erklaerung: "Gespräch über eine offene Rate. Der Mensch hat bezahlt und ist "
      + "in Rückstand — es geht um eine Vereinbarung, nicht um einen Verkauf.",
    // Bernstein statt Rot: Ein Zahlungsrückstand ist keine Verfehlung, und die
    // Marke soll den Mitarbeiter einstimmen, nicht den Kunden anklagen.
    ton: "#b45309",
  },
  gruender: {
    art: "gruender",
    text: "Gründer",
    erklaerung: "Gespräch mit Justin Schwarzott, selbst gebucht über /justin — Partner, Investoren, Presse oder Kunden, die den Gründer sprechen wollen.",
    ton: "#0B1220",
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
    // ── 24.08.2026: `nummer_korrektur` ist hier RAUS ──────────────────────
    // VORHER stand der Wert als zweiter Fall neben `agent_manuell` und sah aus
    // wie eine gelebte Quelle. NACHHER nicht mehr: In `fiaon_termine.quelle`
    // wird er NIE geschrieben — er ist ein BUCHUNGSWEG und steht seit heute in
    // `fiaon_termine.herkunft` (HERKUENFTE in server/lib/fiaon-termine.ts).
    // GRUND: Ein toter Fall in einer Ableitung liest sich wie ein lebender.
    // Genau das hat die Anzeige-Wörterbücher glauben lassen, es gäbe diesen
    // Quellwert — und den Admin-Filter „Nach Nummern-Korrektur" ins Leere
    // laufen lassen. Sollte der Wert je doch in `quelle` auftauchen, fällt er
    // jetzt in den `default`-Zweig und wird dort als unbekannt AUSGEWIESEN,
    // statt still als Rückruf durchzugehen.
    case "agent_manuell":
      return { ...MARKEN.rueckruf, grund: `Quelle „${q}“` };
    case "inkasso_call":
      return { ...MARKEN.forderung, grund: `Quelle „${q}“` };
    case "nichterreicht_mail":
    case "portal":
      return { ...MARKEN.vertrieb, grund: `Quelle „${q}“` };
    case "gruender":
      return { ...MARKEN.gruender, grund: `Quelle „${q}“` };
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

/** Alle Marken — für Filterleisten und Legenden. */
/**
 * Alle Arten in einer Liste — für Legenden und Auswahlfelder.
 *
 * 24.08.2026 (Justin: „Nicht JEDER Termin ist Onboarding, das muss deutlicher
 * kommuniziert werden"): Der Kalender zeigt diese Liste jetzt offen als
 * Legende. Reihenfolge nach dem Alltag: erst das Verkaufsgespräch, dann das
 * Startgespräch, dann Rückruf und Zahlung. Es gibt bewusst NUR diese eine
 * Liste — ein zweites Wörterbuch für dieselbe Sache war schon dreimal die
 * Ursache dafür, dass eine Auswahl garantiert nichts gefunden hat.
 */
export const TERMIN_ARTEN: TerminArtMarke[] = [
  { ...MARKEN.vertrieb, grund: "" },
  { ...MARKEN.onboarding, grund: "" },
  { ...MARKEN.rueckruf, grund: "" },
  { ...MARKEN.forderung, grund: "" },
];
