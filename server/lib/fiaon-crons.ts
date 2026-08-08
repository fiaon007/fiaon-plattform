// ═══════════════════════════════════════════════════════════════════════════
// LAUFEN TAGESLÄUFE IN DIESEM PROZESS?
//
// DER VORFALL (08.08.2026)
// Auf einem Entwicklungsrechner lief `npm run dev` — gegen die
// PRODUKTIONSDATENBANK, denn eine andere gibt es nicht. Zwanzig Minuten später
// feuerte ein frisch eingebauter Tageslauf und markierte 26 echte Kunden als
// „angeschrieben", ohne dass eine einzige Mail rausging: Die
// Entwicklungsmaschine hat keinen Mail-Kanal. Reparabel, aber vermeidbar.
//
// DIE REGEL
// Ein Prozess führt nur dann Tagesläufe aus, wenn er der BETRIEB ist. Das ist
// keine Annahme über die Umgebung, sondern eine ausdrückliche Aussage:
//   NODE_ENV=production  → das hier ist der Betrieb
//   CRONS=an             → ich weiß, was ich tue (lokaler Test)
//
// Alles andere läuft ohne Automatik. Wer einen Lauf prüfen will, ruft ihn von
// Hand über sein Skript oder die Admin-Route auf — dann ist es eine
// Entscheidung und kein Nebeneffekt des Startens.
// ═══════════════════════════════════════════════════════════════════════════

export const CRONS_AN =
  process.env.NODE_ENV === "production" || String(process.env.CRONS || "").toLowerCase() === "an";

let gemeldet = false;

/**
 * Registriert einen Tageslauf — oder eben nicht.
 *
 * Statt jede Aufrufstelle mit einem `if` zu versehen (das man vergessen kann),
 * geht die Registrierung durch diese eine Tür.
 */
export function tageslauf(name: string, fn: () => void, intervallMs: number): void {
  if (!CRONS_AN) {
    if (!gemeldet) {
      console.log("[CRONS] Tagesläufe AUS — kein Produktionsbetrieb. Einschalten mit CRONS=an.");
      gemeldet = true;
    }
    return;
  }
  setInterval(() => {
    try {
      fn();
    } catch (err) {
      console.error(`[CRONS] ${name}:`, err);
    }
  }, intervallMs);
}
