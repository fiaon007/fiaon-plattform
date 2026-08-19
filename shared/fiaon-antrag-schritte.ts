// ═══════════════════════════════════════════════════════════════════════════
// WELCHER ZUSTAND GEHÖRT ZU WELCHEM FORMULARSCHRITT?
//
// ── DIE MELDUNG (Daniel Stripling, 19.08.2026) ─────────────────────────────
// „Bei einigen Kunden wird angezeigt, dass sich der Antrag noch ‚im Formular'
// befindet … Das Problem ist, dass der Antrag aus meiner Sicht bereits
// vollständig ausgefüllt ist."
//
// ── DIE URSACHE, GEMESSEN ──────────────────────────────────────────────────
// In `client/src/pages/antrag.tsx` stand der Zustand als Feldzugriff:
//
//     ["started","personal_data","finances","config","verifying","approved",
//      "contract","processing","completed"][step] || "started"
//
// Die Liste hat NEUN Einträge, also die Indizes 0 bis 8. Das Formular hat aber
// einen Schritt 9 — die Passwortseite nach der Zahlung. `[9]` ist `undefined`,
// und dann greift `|| "started"`.
//
// Damit schrieb der LETZTE Schritt des Formulars den ERSTEN Zustand. Und zwar
// unmittelbar NACHDEM `handleProceedToPayment` korrekt `submitted` gespeichert
// hatte: Die Funktion setzt `setStep(9)`, der Effekt auf `[step]` läuft einen
// Rendergang später und überschrieb das Ergebnis.
//
// GEMESSEN am 19.08.2026: 24 Anträge standen auf `started` bzw.
// `payment_completed` mit `current_step = 9` — alle mit allen drei Zusagen,
// E-Mail und Gehaltseingangstag, also inhaltlich fertig. Insgesamt 53 Zeilen im
// Bestand tragen `started` bei `current_step >= 9`. Einer davon gehört dem
// Betreiber selbst.
//
// ── DIE LEHRE ──────────────────────────────────────────────────────────────
// Ein Rückfallwert, der auf den ANFANG zeigt, ist bei einem Fortschritt immer
// falsch. Wer eine Reihenfolge über einen Index abbildet, muss den Überlauf
// benennen — sonst wird aus „ich weiß es nicht" ein „es hat nie begonnen".
//
// Deshalb: eine benannte Zuordnung, ein Zustand für JEDEN Schritt, und ein
// Rückfall auf den HÖCHSTEN bekannten statt auf den ersten.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Schritt → Antragszustand. Der Schlüssel ist `currentStep` aus dem Formular.
 *
 * Schritt 7 („processing") und 8 („completed") setzt das Formular selbst;
 * Schritt 9 ist die Passwortseite, die erst NACH dem Absenden erscheint — dort
 * ist der Antrag abgeschickt, nicht begonnen.
 */
export const SCHRITT_ZUSTAND: Readonly<Record<number, string>> = {
  0: "started",
  1: "personal_data",
  2: "finances",
  3: "config",
  4: "verifying",
  5: "approved",
  6: "contract",
  7: "processing",
  8: "completed",
  // ── SCHRITT 9 IST DER GRUND FÜR DIESE DATEI ────────────────────────────
  // Die Passwortseite. Wer hier steht, hat abgeschickt. „submitted" ist in
  // `RECHNUNGSREIF` (server/lib/fiaon-rechnung-stellen.ts) — der Agent kann
  // also eine Rechnung stellen, statt zum Anruf aufgefordert zu werden.
  9: "submitted",
};

/** Der höchste bekannte Schritt — der Rückfall für alles darüber. */
const HOECHSTER = Math.max(...Object.keys(SCHRITT_ZUSTAND).map(Number));

/**
 * Der Zustand zu einem Schritt. Ein unbekannter Schritt fällt auf den HÖCHSTEN
 * bekannten zurück, nicht auf den ersten: Wer weiter ist als wir wissen, ist
 * fertig — nicht am Anfang.
 */
export function zustandFuerSchritt(schritt: number): string {
  const n = Number.isFinite(schritt) ? Math.max(0, Math.trunc(schritt)) : 0;
  return SCHRITT_ZUSTAND[n] ?? SCHRITT_ZUSTAND[HOECHSTER];
}
