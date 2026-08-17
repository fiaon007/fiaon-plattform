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
export function tageslauf(
  name: string,
  fn: () => void,
  intervallMs: number,
  opts: {
    /**
     * Ein ZWEITER Grund, warum dieser Lauf laufen darf — für Läufe mit eigenem
     * lokalen Testschalter (z. B. `ABO_MOTOR_LOKAL=1`).
     *
     * ── WARUM DAS HIER STEHT UND NICHT DORT (17.08.2026) ─────────────────
     * Der Abo-Motor hatte seine eigene `if (NODE_ENV === "production" ||
     * ABO_MOTOR_LOKAL)`-Zeile. Sie war richtig — aber sie war die vierte
     * Fassung derselben Regel im Haus. GEMESSEN: von sieben zeitgesteuerten
     * Läufen gingen zwei ganz an der Bremse vorbei, zwei prüften selbst, drei
     * nahmen die Registratur.
     *
     * Damit ALLE durch diese eine Tür gehen können, ohne ihren eigenen
     * Testschalter zu verlieren, nimmt die Tür ihn hier auf.
     */
    auchWenn?: boolean;
    /** Einmal kurz nach dem Start laufen (Millisekunden). 0 = nicht. */
    beimStartNach?: number;
  } = {},
): void {
  if (!CRONS_AN && !opts.auchWenn) {
    if (!gemeldet) {
      console.log("[CRONS] Tagesläufe AUS — kein Produktionsbetrieb. Einschalten mit CRONS=an.");
      gemeldet = true;
    }
    REGISTRIERT.push({ name, intervallMs, laeuft: false });
    return;
  }
  const sicher = () => {
    try {
      fn();
    } catch (err) {
      console.error(`[CRONS] ${name}:`, err);
    }
  };
  if (opts.beimStartNach && opts.beimStartNach > 0) setTimeout(sicher, opts.beimStartNach);
  setInterval(sicher, intervallMs);
  REGISTRIERT.push({ name, intervallMs, laeuft: true });
}

/**
 * Alle registrierten Läufe — für die Admin-Ansicht und den Prüfstand.
 *
 * Eine Regel, die man nicht nachzählen kann, glaubt man nicht. Diese Liste
 * beantwortet „welche Automatik läuft hier eigentlich?" ohne Grep.
 */
export const REGISTRIERT: { name: string; intervallMs: number; laeuft: boolean }[] = [];
