// ═══════════════════════════════════════════════════════════════════════════
// DIE ERGEBNISSE DES FORDERUNGSMANAGEMENTS — EINE LISTE FÜR ALLE WEGE
//
// Sie stand in server/lib/fiaon-inkasso.ts. Das Softphone kannte sie nicht und
// zeigte nach einem Inkasso-Anruf die VERTRIEBS-Ergebnisse: Der Mitarbeiter
// dokumentierte zweimal (einmal im Panel, einmal an der Rate), oder er
// drückte „Anrufer blockiert" — und der Säumige landete im Vertrieb (P-13,
// P-14). Dieselbe Lehre wie bei fiaon-kontakt-ergebnis-liste.ts: Eine Liste,
// die zwei Oberflächen einzeln kennen, wird an der dritten vergessen.
// ═══════════════════════════════════════════════════════════════════════════
export type RatenErgebnis = "zahlt_am" | "ueberwiesen_beleg" | "nicht_erreicht"
  | "nummer_blockiert" | "eskalation";

/**
 * Wie viele Tage ruht eine Rate, deren Nummer uns blockiert?
 *
 * Nicht `null`: Die Arbeitsliste zeigt Raten mit LEERER Wiedervorlage sofort
 * wieder an („IS NULL OR <= heute"). „Aussetzen" heißt hier also ein Datum in
 * der Zukunft, nicht das Löschen des Datums — sonst stünde der Fall morgen
 * wieder da, und der Agent wählt eine Nummer, die ihn wegdrückt.
 */
export const BLOCKIERT_RUHE_TAGE = 30;

export const RATEN_ERGEBNISSE: {
  art: RatenErgebnis; label: string; braucht?: "datum" | "notiz"; hinweis: string;
}[] = [
  {
    art: "zahlt_am", label: "Zahlt Rate am …", braucht: "datum",
    hinweis: "Die Rate kommt an diesem Tag wieder auf deinen Tisch.",
  },
  {
    art: "ueberwiesen_beleg", label: "Rate überwiesen — Beleg da",
    hinweis: "Geht in die Verbuchungs-Warteschlange. Gebucht wird nach Kontoabgleich, nicht durch dich.",
  },
  {
    art: "nicht_erreicht", label: "Nicht erreicht",
    hinweis: "Zählt den Versuch und legt die Rate auf morgen.",
  },
  // ── DIE BLOCKIER-MARKE, JETZT AUCH HIER (30.08.2026) ────────────────────
  // Der Vertrieb hat sie seit Wochen, das Forderungsmanagement nicht — und
  // gerade dort blockieren Menschen die Nummer. Ohne diesen Knopf blieb dem
  // Agenten nur „Nicht erreicht", und die Rate kam am nächsten Tag wieder auf
  // den Tisch: Er wählte dieselbe Nummer, die ihn wegdrückt, bis zur
  // Eskalationsstufe.
  {
    art: "nummer_blockiert", label: "Nummer blockiert uns",
    hinweis: `Die Nummer wird markiert und die Rate ruht ${BLOCKIERT_RUHE_TAGE} Tage. `
      + "Anrufen bringt hier nichts mehr — der Weg läuft über Mail und Mahnung.",
  },
  {
    art: "eskalation", label: "Härtefall — an den Vorgesetzten", braucht: "notiz",
    hinweis: "Erzeugt eine Aufgabe für den Vorgesetzten. Nachlass und Stundung entscheidet nur er.",
  },
];

export function istRatenErgebnis(v: unknown): v is RatenErgebnis {
  return RATEN_ERGEBNISSE.some((e) => e.art === v);
}
