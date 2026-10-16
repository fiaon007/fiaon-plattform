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
import { JAHRESVERTRAG_AB } from "@shared/fiaon-antrag-stand";
import { KUENDIGUNG_UNGEBUCHT_SQL } from "@shared/fiaon-kuendigung-regel";

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
  | "abo_gestoppt"
  /** E-370: Mahnstopp-Karte „Raten stornieren (Kunde hat recht)“ — Einwand anerkannt, Abo gestoppt (fiaon-mara-entscheidungen.ts). */
  | "einwand_anerkannt";

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

// ── NUR DIE RATEN NACH DEM VERTRAGSENDE (E-370, 15.10.2026) ────────────────
// Justin: „offene Rechnung vor Kündigung bleibt“. ratenStornieren nimmt ALLE
// offenen Raten einer Bestellung — für den Altbestand der gekündigten
// Altverträge (vor dem 03.09.2026) wäre das falsch: Raten bis zum Vertragsende
// sind geschuldet, nur die danach nicht (AGB 04.07.2026 § 6). Gemessen am
// 15.10.2026 (nur lesend, mit vertragsendeAusZeile): 59 Menschen, 76 Raten,
// 4.719,24 € — seit E-368 nicht mehr gemahnt, aber noch offen in den Büchern. Neue Kündigungen storniert
// kuendigungSetzen selbst (Nachbesserung 2, 01.10.2026).
//
// Gleiche Nebenwirkungen wie ratenStornieren (Mahnstufe 0, Inkasso gelöst),
// eigener Grund STORNO_NACH_VERTRAGSENDE. Die Grenze steht in der Anweisung
// selbst: nur genannte Raten, nur noch offene, nur fällig NACH `endeTag` — eine
// Rate bis zum Ende fällt nie, auch wenn der Aufrufer sie mitschickt.
// kuendigungZuruecknehmen holt diesen Grund zurück (wie „kuendigung“): Nimmt
// der Kunde die Kündigung zurück, läuft der Vertrag weiter und die Raten gelten.
// ═══════════════════════════════════════════════════════════════════════════
export const STORNO_NACH_VERTRAGSENDE = "nach_vertragsende";

/**
 * Storniert die genannten offenen Raten einer Bestellung, soweit sie NACH `endeTag` (JJJJ-MM-TT) fällig sind.
 * Gibt die stornierten Raten zurück (Nummer, Betrag, Fälligkeit). `lauf` = Transaktion des Aufrufers.
 */
export async function ratenNachVertragsendeStornieren(ref: string, rateIds: readonly number[], endeTag: string, lauf: Lauf = sqlPool): Promise<{ id: number; rate_nr: number; betrag_cents: number; faellig: string }[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(endeTag) || !rateIds.length) return [];
  const zeilen = (await lauf`
    UPDATE fiaon_abo_raten
       SET status = 'storniert', storniert_am = NOW(), storno_grund = ${STORNO_NACH_VERTRAGSENDE},
           mahnstufe = 0,
           inkasso_agent_id = NULL, inkasso_wiedervorlage = NULL, inkasso_zusage_am = NULL,
           updated_at = NOW()
     WHERE ref = ${ref} AND id = ANY(${rateIds.map(Number)}::int[])
       AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL
       AND faellig_am IS NOT NULL AND faellig_am > ${endeTag}::date
    RETURNING id, rate_nr, betrag_cents, to_char(faellig_am, 'YYYY-MM-DD') AS faellig
  `) as any[];
  return zeilen.map((z) => ({ id: Number(z.id), rate_nr: Number(z.rate_nr), betrag_cents: Number(z.betrag_cents) || 0, faellig: String(z.faellig) }));
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

// ── IST DIE FORDERUNG NOCH AKTIV? (E-391, 16.10.2026) ─────────────────────
// E-368 (15.10.) hat den Mahnmotor auf die geschuldeten Raten beschränkt. Andere Stellen sahen dieselben Raten
// weiter als Forderung: „überfällig stellen“ (Übergabe ins Forderungsmanagement), die Inkasso-Liste und -Verteilung
// (SICHTFELD) und die Erinnerung von Hand im Inkasso — gemessen 16.10.: 61 Raten/54 Menschen nach dem Vertragsende,
// 10/8 mit ungebuchter Kündigung, 22/19 mit Mahnstopp in der Liste (Florentine: „Zahlung überfällig, obwohl
// fristgerecht gekündigt“). Eine Regel für alle — dieselbe Lesart wie RATE_MAHNBAR_SQL (ohne die Mail-Taktung).
// `a` = Alias der Bestellung, `r` = Alias der Rate.
export const RATE_NACH_ENDE_SQL_FUER = (a: string, r: string): string => `(${a}.gekuendigt_am IS NOT NULL AND ${a}.kuendigung_zurueckgenommen_am IS NULL
  AND (${a}.agb_stand IS NULL OR ${a}.agb_stand < DATE '${JAHRESVERTRAG_AB}')
  AND ${r}.faellig_am > COALESCE((${a}.vertrag_ende_am AT TIME ZONE 'Europe/Berlin')::date,
                              ((${a}.gekuendigt_am + INTERVAL '24 hours') AT TIME ZONE 'Europe/Berlin')::date))`;

export const FORDERUNG_AKTIV_SQL_FUER = (a: string, r: string): string => `(NOT ${RATE_NACH_ENDE_SQL_FUER(a, r)}
  AND NOT ${KUENDIGUNG_UNGEBUCHT_SQL(`${a}.person_id`)}
  AND NOT (${a}.mahnstopp_am IS NOT NULL AND ${a}.mahnstopp_am > COALESCE((SELECT MIN(fa_r1.bezahlt_am) FROM fiaon_abo_raten fa_r1
            WHERE fa_r1.ref = ${a}.ref AND fa_r1.status = 'bezahlt'), ${a}.paid_at, ${a}.created_at))
  AND NOT EXISTS (SELECT 1 FROM fiaon_persons fa_pm WHERE fa_pm.id = ${a}.person_id AND fa_pm.ist_test_am IS NOT NULL))`;

/** Für Probeläufe: Wie viele Raten würde ratenStornieren jetzt stornieren? */
export async function offeneRatenZaehlen(ref: string, lauf: Lauf = sqlPool): Promise<number> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_abo_raten
     WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL
  `) as any[];
  return Number(z?.n ?? 0);
}
