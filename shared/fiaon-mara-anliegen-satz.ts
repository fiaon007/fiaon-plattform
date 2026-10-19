// ═══════════════════════════════════════════════════════════════════════════
// MARA UND DIE ANLIEGEN — DER SATZ FÜR DIE LISTE (19.10.2026, E-406 C1)
//
// Ohne Abhängigkeiten, damit /agent/anliegen nur diesen Satz lädt (die Regeln selbst: shared/fiaon-mara-anliegen.ts).
// Justin 12.10.: wenig Text — ein Satz je Anliegen, höchstens rund 80 Zeichen plus Grund.
// ═══════════════════════════════════════════════════════════════════════════
export type MaraStand = "beantwortet" | "entwurf" | "mensch" | "nie" | "fehler" | null;

/** Ein kurzer Satz für den Mitarbeiter. Rein. */
export function maraStandSatz(stand: MaraStand | string | null | undefined, grund?: string | null): string | null {
  const g = String(grund ?? "").trim();
  switch (stand) {
    case "beantwortet": return "Mara hat geantwortet.";
    case "entwurf": return "Mara hat einen Vorschlag geschrieben — bitte prüfen und senden.";
    case "mensch": return g ? `Mara antwortet nicht: ${g}` : "Mara antwortet nicht — bitte selbst antworten.";
    case "fehler": return "Mara kam noch nicht durch — sie versucht es gleich noch einmal.";
    default: return null;
  }
}
