// ═══════════════════════════════════════════════════════════════════════════
// GIBT ES ÜBERHAUPT EINEN KANAL? — die Frage VOR jedem Versandlauf
//
// ── DER BEFUND (17.08.2026) ────────────────────────────────────────────────
// GEMESSEN: 91 Termine trugen `erinnert_am`, aber nur 56 hatten einen
// erfolgreichen Versand. **35 Erinnerungen waren verbraucht, ohne dass der
// Kunde etwas bekam** — 33 davon mit dem Grund „MAKE_WEBHOOK_URL ist nicht
// gesetzt", zwei ohne E-Mail-Adresse. Acht der Termine lagen noch in der
// Zukunft; die Kunden wären ohne Erinnerung dagestanden.
//
// Von 62 vergangenen erinnerten Terminen wurden **54 zu No-Shows**. Wie viele
// davon erschienen wären, wenn die Erinnerung angekommen wäre, weiß niemand —
// und genau das ist der Punkt.
//
// ── DIE URSACHE, SO WEIT SIE BEWEISBAR IST ────────────────────────────────
// Zwei Dinge, und nur das zweite ist sicher meine Erklärung:
//
//   1. `runTerminErinnerungen` prüft `MAKE_WEBHOOK_URL` am Anfang und steigt
//      ohne Kanal aus. Trotzdem stehen 33 Protokollzeilen mit genau diesem
//      Grund im Log — der Lauf hat also gearbeitet und ist erst beim Senden
//      auf den fehlenden Kanal gestoßen. Welcher Prozess das war, lässt sich
//      nachträglich nicht beweisen: Lokal ist die Variable nicht gesetzt und
//      die CRONS-Bremse aus, in Produktion soll sie gesetzt sein.
//
//   2. SICHER ist die zweite Ursache, und sie erklärt den Schaden vollständig:
//      Der Lauf setzt `erinnert_am = NOW()` in EINEM UPDATE für alle fälligen
//      Termine — und sendet DANACH. Scheitert der Versand aus irgendeinem
//      Grund (kein Kanal, Make lehnt ab, Zeitüberschreitung, keine Adresse),
//      bleibt die Marke stehen. Die Erinnerung ist verbraucht.
//
// Deshalb wird hier nicht die Ursache geraten, sondern beides abgestellt:
// eine Kanalprüfung, die JEDER Versandlauf am Anfang macht — und eine
// Rücknahme der Marke, wenn der Versand scheitert (in fiaon-followup.ts).
//
// ── WARUM „ÜBERSPRUNGEN" UND NICHT „FEHLGESCHLAGEN" ───────────────────────
// „Fehlgeschlagen" heißt: Wir haben es versucht, es ging schief. „Übersprungen"
// heißt: Wir haben es nicht versucht, weil es nicht gehen KANN. Der
// Unterschied entscheidet, ob eine Wiederholung sinnvoll ist — und ob der
// Betreiber einen Bug sucht oder eine Umgebungsvariable setzt.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export interface KanalStand {
  /** Kann überhaupt etwas rausgehen? */
  frei: boolean;
  /** Welche Wege stehen? */
  make: boolean;
  brevo: boolean;
  /** Klartext für Protokoll und Oberfläche. */
  grund: string;
}

/**
 * Steht ein Versandkanal?
 *
 * Bewusst zur AUFRUFZEIT gelesen und nicht als Modulkonstante: Eine
 * Umgebungsvariable, die beim Start fehlte und später gesetzt wurde, soll beim
 * nächsten Lauf wirken — ohne Neustart.
 */
export function kanalStand(): KanalStand {
  const make = !!process.env.MAKE_WEBHOOK_URL;
  const brevo = !!process.env.BREVO_API_KEY;
  if (make || brevo) {
    return {
      frei: true, make, brevo,
      grund: `Kanal steht (${[make ? "Make" : null, brevo ? "Brevo" : null].filter(Boolean).join(" + ")}).`,
    };
  }
  return {
    frei: false, make, brevo,
    grund: "Kein Versandkanal eingerichtet: Es fehlen MAKE_WEBHOOK_URL und BREVO_API_KEY. "
      + "Es kann keine Mail rausgehen — der Lauf wurde übersprungen, nichts wurde verbraucht.",
  };
}

/**
 * Die Wand für einen Versandlauf.
 *
 * Ruft man am Anfang JEDES Laufs, der Mails verschickt. Ohne Kanal wird
 * `uebersprungen` protokolliert — EINMAL pro Lauf und Tag, nicht je Empfänger:
 * Zwanzig Zeilen „kein Kanal" sind ein Problem, nicht zwanzig.
 *
 * Gibt `false` zurück, wenn der Lauf NICHT laufen darf.
 */
export async function versandErlaubtOderProtokoll(
  laufName: string, lauf: Lauf = sqlPool,
): Promise<boolean> {
  const stand = kanalStand();
  if (stand.frei) return true;

  // Heute schon gemeldet? Dann still bleiben. Der 20-Minuten-Takt würde sonst
  // 72 identische Zeilen am Tag erzeugen und das Protokoll unlesbar machen.
  try {
    const [schon] = (await lauf`
      SELECT 1 AS da FROM fiaon_mail_log
      WHERE event = 'lauf_uebersprungen'
        AND grund LIKE ${`${laufName}%`}
        AND (created_at AT TIME ZONE 'Europe/Berlin')::date
          = (NOW() AT TIME ZONE 'Europe/Berlin')::date
      LIMIT 1
    `) as any[];
    if (!schon) {
      await lauf`
        INSERT INTO fiaon_mail_log (event, empfaenger, status, grund, payload)
        VALUES ('lauf_uebersprungen', NULL, 'uebersprungen',
                ${`${laufName}: ${stand.grund}`},
                ${JSON.stringify({ lauf: laufName, make: stand.make, brevo: stand.brevo })}::jsonb)
      `;
      console.warn(`[KANAL] ${laufName} übersprungen — ${stand.grund}`);
    }
  } catch (err) {
    // Auch wenn das Protokoll klemmt: Der Lauf darf NICHT laufen.
    console.error("[KANAL] Protokoll:", err);
  }
  return false;
}

/**
 * Wie viele Läufe wurden heute wegen fehlendem Kanal übersprungen?
 * Für die Admin-Karte — der Betreiber soll es SEHEN.
 */
export async function uebersprungeneLaeufe(lauf: Lauf = sqlPool): Promise<{
  heute: number; laeufe: string[];
}> {
  const zeilen = (await lauf`
    SELECT DISTINCT grund FROM fiaon_mail_log
    WHERE event = 'lauf_uebersprungen'
      AND (created_at AT TIME ZONE 'Europe/Berlin')::date
        = (NOW() AT TIME ZONE 'Europe/Berlin')::date
  `.catch(() => [] as any[])) as any[];
  return {
    heute: zeilen.length,
    laeufe: zeilen.map((z) => String(z.grund).split(":")[0]),
  };
}
