// ═══════════════════════════════════════════════════════════════════════════
// RATEN-STORNO — WER DIE BESTELLUNG BEENDET, BEENDET AUCH IHRE RATEN (27.09.2026, E-245)
//
// ── DER FALL ───────────────────────────────────────────────────────────────
// Rate 1259 bekam am 26.09.2026 um 06:48 eine Zahlungserinnerung — zwei Tage,
// nachdem der Widerruf anerkannt und die Bestellung storniert war. Sie war nicht
// allein: Bei der Bereinigung am 26.09. (E-244) hingen sechs offene Raten an
// stornierten Bestellungen, und am 21.09. und 24.09. waren neue dazugekommen.
//
// ── DIE URSACHE ────────────────────────────────────────────────────────────
// Drei Wege setzen eine Bestellung auf „cancelled“ oder „refunded“ und ließen
// die Raten dabei stehen, wie sie waren — „offen“, mit Mahnstufe und Inkasso-
// Zuständigem:
//   · bestellungStornieren und die Dubletten-Stornos (routes/fiaon-antrag.ts),
//   · kuendigungSetzen Weg 1 „nie bezahlt“ (lib/fiaon-kuendigung.ts) — der
//     greift auch bei einer schon stornierten Bestellung mit bezahlter Rate 1,
//   · die Erstattung POST /admin/payments/:paymentRef/refund (routes/fiaon-team.ts).
// Der Erinnerungslauf fragte nur die RATE („offen“?), nie die Bestellung.
//
// ── DIE REGEL ──────────────────────────────────────────────────────────────
// Jeder dieser Wege ruft ratenStornieren in DERSELBEN Transaktion wie die
// Statusänderung der Bestellung. Entweder beides oder nichts — eine stornierte
// Bestellung mit offener Rate kann so nicht mehr entstehen.
//
// Angefasst werden nur Raten, die wirklich noch offen sind: status 'offen',
// kein storniert_am, kein bezahlt_am. Eine bezahlte Rate bleibt bezahlt — sie
// ist Geld, das da ist, und über Geld entscheidet die Erstattung, nicht der Storno.
//
// Die Mahnstufe geht auf 0 und die Inkasso-Zuständigkeit wird gelöst (Vorbild
// scripts/abo-bestand.ts): Sonst startet eine später richtig angelegte Rate
// desselben Kunden auf Stufe 2, und die Rate bleibt in der Liste eines
// Inkasso-Mitarbeiters stehen. inkasso_versuche und inkasso_letzte_arbeit
// bleiben — sie sind Geschichte, keine Zuständigkeit.
//
// ── WARUM DER GRUND EIN FESTER WERT IST ────────────────────────────────────
// Zwei Rücknahmewege holen stornierte Raten über ihren Grund zurück:
//   · kuendigungZuruecknehmen (lib/fiaon-kuendigung.ts): storno_grund = 'kuendigung'
//   · stornoZuruecknehmen (lib/fiaon-telefonkartei.ts): storno_grund = 'kuendigung_kulanz'
// Eine Rate, die wegen Storno, Erstattung oder Abo-Stopp entfallen ist, darf
// dort NICHT wieder aufleben. Der Typ RatenStornoGrund lässt deshalb nur Werte
// zu, die keiner der beiden Wege kennt — wer 'kuendigung' hineinschreiben will,
// scheitert schon beim Übersetzen.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export type RatenStornoGrund =
  /** bestellungStornieren — der Storno-Knopf der Zahlungsübersicht (auch FIAON Global). */
  | "bestellung_storniert"
  /** Dubletten-Werkzeug „Alle offenen stornieren“. */
  | "dublette_storniert"
  /** kuendigungSetzen Weg 1: Bestellung nie bezahlt → Storno, keine Forderung. */
  | "storno_unbezahlt"
  /** Erstattung: Die Zahlung geht zurück, es besteht kein Vertrag mehr. */
  | "erstattet"
  /** Abo-Stopp aus der Verwaltung (POST /admin/abo/:ref/stoppen). */
  | "abo_gestoppt";

/**
 * Storniert alle noch offenen Raten einer Bestellung. Gibt zurück, wie viele es waren.
 *
 * `lauf` ist die Transaktion des Aufrufers — die Rate fällt genau dann weg, wenn
 * auch die Bestellung storniert ist.
 */
export async function ratenStornieren(ref: string, grund: RatenStornoGrund, lauf: Lauf = sqlPool): Promise<number> {
  const zeilen = (await lauf`
    UPDATE fiaon_abo_raten
       SET status = 'storniert', storniert_am = NOW(), storno_grund = ${grund},
           mahnstufe = 0,
           inkasso_agent_id = NULL, inkasso_wiedervorlage = NULL, inkasso_zusage_am = NULL,
           updated_at = NOW()
     WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL
    RETURNING id
  `) as any[];
  return zeilen.length;
}

// ── DIE ZWEITE HÄLFTE: WEN DIE ERINNERUNGSLÄUFE ÜBERHAUPT ANSEHEN ─────────
// Der Storno oben verhindert neue Fälle. Die Erinnerungsläufe prüfen trotzdem
// selbst, ob die BESTELLUNG noch eine Forderung trägt — sonst genügt ein
// einziger vergessener Weg (oder ein Altfall), und die Mahnkette läuft weiter.
// Gemessen am 27.09.2026: vier offene Raten an drei archivierten, bezahlten
// Dubletten (u. a. MRNUIQYK Stufe 4, MRXAFKI5 Stufe 3) wurden bis zuletzt gemahnt.
// Vorbild ist ueberfaelligStellen (routes/fiaon-abo.ts), das schon nach
// payment_status = 'paid' fragte. `a` ist der Alias von fiaon_applications.
export const ERINNERBARE_BESTELLUNG_SQL = (a: string): string =>
  `(${a}.payment_status = 'paid' AND ${a}.cancelled_at IS NULL AND ${a}.archived_at IS NULL)`;

/** Für Probeläufe: Wie viele Raten würde ratenStornieren jetzt stornieren? */
export async function offeneRatenZaehlen(ref: string, lauf: Lauf = sqlPool): Promise<number> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten
     WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL
  `) as any[];
  return Number(z?.n ?? 0);
}
