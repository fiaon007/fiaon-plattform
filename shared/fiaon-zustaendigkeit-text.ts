// ═══════════════════════════════════════════════════════════════════════════
// ZWEI ZUSTÄNDIGKEITEN, ZWEI BESCHRIFTUNGEN
//
// ── DIE MELDUNG (Team, 30.08.2026) ─────────────────────────────────────────
// „Bei dem Kunden stehen Diana UND Nikita gleichzeitig."
//
// ── WAS DARAN RICHTIG WAR ──────────────────────────────────────────────────
// Beides stimmte. Ein Mensch hat im Haus ZWEI Zuständige, und das ist Absicht:
//
//   · Die BETREUUNG VERTRIEB (`fiaon_persons.assigned_agent_id`) — wer den
//     Kunden begleitet, berät und den Abschluss macht.
//   · Das FORDERUNGSMANAGEMENT (`fiaon_abo_raten.inkasso_agent_id`) — wer eine
//     überfällige Rate eintreibt.
//
// Das sind verschiedene Aufgaben mit verschiedenen Gesprächen. Sie zu trennen
// ist richtig; sie unbeschriftet nebeneinander zu stellen ist der Fehler.
//
// ── WARUM DIE WÖRTER HIER STEHEN ───────────────────────────────────────────
// „Betreuer" allein ist mehrdeutig, und genau diese Mehrdeutigkeit hat die
// Meldung erzeugt: Wer zwei Namen ohne Beschriftung liest, hält es für einen
// Fehler im System statt für zwei Rollen.
//
// An sieben Stellen stand „betreut von X" oder nur ein Name in einer Spalte
// „Zuständig". Sieben Fassungen desselben Begriffs laufen auseinander — und
// dann heißt dasselbe Feld auf einer Seite anders als auf der nächsten.
// Deshalb: EIN Ort, zwei Beschriftungen, und eine Funktion, die aus einem
// fehlenden Namen keinen leeren Platz macht.
// ═══════════════════════════════════════════════════════════════════════════

/** Die Beschriftung der Vertriebs-Zuständigkeit. Nie nur „Betreuer". */
export const LABEL_VERTRIEB = "Betreuung Vertrieb";

/** Die Beschriftung der Inkasso-Zuständigkeit. */
export const LABEL_FORDERUNG = "Forderungsmanagement";

/**
 * Ein Name für eine Zuständigkeitszeile — oder ein ehrlicher Ersatz.
 *
 * Ein LEERES Feld liest sich wie ein Anzeigefehler; „niemand" ist eine Aussage
 * und dazu eine, die zum Handeln auffordert. Dieselbe Regel wie beim
 * Anruf-Hinweis: kein leerer Platz, wo ein Mensch einen Namen erwartet.
 */
export function zustaendigText(name?: string | null): string {
  return String(name || "").trim() || "niemand";
}

/**
 * Die vollständige Zeile, wie sie in Listen und Akten steht.
 *
 * @example zustaendigZeile("vertrieb", "Nikita Boychenko")
 *          → „Betreuung Vertrieb: Nikita Boychenko"
 */
export function zustaendigZeile(art: "vertrieb" | "forderung", name?: string | null): string {
  return `${art === "vertrieb" ? LABEL_VERTRIEB : LABEL_FORDERUNG}: ${zustaendigText(name)}`;
}

/**
 * Beschriftungen, die ohne Rolle auskommen wollen — der Prüfstand verbietet sie
 * dort, wo beide Zuständigkeiten vorkommen können.
 *
 * „Betreuer" und „betreut von" sind die Formulierungen, die die Meldung
 * ausgelöst haben. Sie stehen hier, damit ein Prüfstand sie FINDEN kann,
 * statt dass jemand sie beim nächsten Mal wieder eintippt.
 */
export const MEHRDEUTIGE_BESCHRIFTUNGEN = [
  "betreut von", "Betreut von", "Betreuer:", "Betreuer ",
] as const;
