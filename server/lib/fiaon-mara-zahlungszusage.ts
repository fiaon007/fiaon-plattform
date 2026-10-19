// ═══════════════════════════════════════════════════════════════════════════
// MAIL-MARA HÄLT DEN GENANNTEN ZAHLTAG FEST (E-406 B1 Nachbesserung, 19.10.2026)
//
// Prüfer-Fund zu B1: Maras Raten-Mail sagt „Schreiben Sie mir einfach, wann Sie zahlen“ — die Antwort landet im
// Postfach, und Mail-Mara hatte kein Werkzeug, das die Zusage festhält. promised_payment_date blieb leer, die
// WhatsApp-Zentrale (RATE_ERINNERBAR) erinnerte weiter, „Zusage heute“ zeigte ihn nicht.
//
// Jetzt liest der SERVER seine Mail, bevor Mara schreibt (wie zahlung_suchen und angaben_aendern, E-401):
//   1. Erkennen: shared/fiaon-zahlungszusage.ts (rein, mit Prüfstand) — Bezugstag ist der Tag, an dem ER schrieb.
//   2. Lesen: seine offenen, GESCHULDETEN Raten (ERINNERBARE_BESTELLUNG_SQL + FORDERUNG_AKTIV_SQL_FUER — dieselben Wände
//      wie Mahnmotor und Inkasso: nie nach dem Vertragsende, nie bei ungebuchter Kündigung oder Mahnstopp, nie beim
//      Testkonto) und die Zusage, die schon an der Person steht.
//   3. Festhalten — dieselben Felder wie WhatsApp-Mara (zahlungszusage_merken) und das Inkasso („zahlt am“):
//        · fiaon_persons.promised_payment_date = Tag, follow_up_date = die EINE Regel (naechsterVersuch
//          „erreicht_zahlt_am“: Werktag nach dem Tag) — der Betreuer sieht ihn dann unter „Zusage prüfen“;
//        · fiaon_abo_raten.inkasso_zusage_am = Tag (Inkasso › „Zusagen“) und inkasso_wiedervorlage = Tag danach (nie
//          früher als eine schon stehende) — wie ratenErgebnisAnwenden; für jede offene Rate, die bis dahin fällig ist;
//        · ein Eintrag im Verlauf der Akte mit promised_date („Zusage: …“).
//      In EINER Transaktion. Mahnstufe, Fälligkeit, Erinnerungen und letzte_erinnerung_at bleiben unberührt — der
//      Mahnmotor wird nie gebremst (E-182). Geld bucht Mara nie.
//   4. Sagen: der Hinweis für Maras Auftrag; die Antwortprüfung (zusageAntwortFunde) hält jedes „notiert“, das nicht
//      stimmt, und jedes „bis dahin keine Erinnerung“.
//
// Nie bei Global-Kunden (E-272). Wirft nach außen: Der Aufrufer fängt (Postmeister: Warnung im Log, Mara schreibt ohne).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { ERINNERBARE_BESTELLUNG_SQL, FORDERUNG_AKTIV_SQL_FUER } from "./fiaon-raten-storno";
import { naechsterVersuch } from "@shared/fiaon-wiedervorlage";
import {
  ZUSAGE_AGENT_NAME, plusTage, tagText, zahlFrage, zahltagErkennen, zusageHandlung, zusageHinweis, zusageKurz, zusageUrteil,
  type ZahltagErkennung, type ZusageRate, type ZusageUrteil,
} from "@shared/fiaon-zahlungszusage";

type Lauf = typeof sqlPool;

/** Was der Server Mara, der Akte und der Antwortprüfung mitgibt. */
export interface ZusageLage {
  erkennung: ZahltagErkennung;
  urteil: ZusageUrteil;
  /** Der Block für Maras Auftrag (vorab). */
  hinweis: string;
  /** Für die Handlungsliste der Postmeister-Zeile. */
  handlung: string;
  /** Kurzform für werkzeugDaten.zahlungszusage_merken. */
  daten: Record<string, unknown>;
  /** In diesem Lauf geschrieben (false: stand schon so, oder nichts festzuhalten). */
  geschrieben: boolean;
  /** Der Tag, an dem er schrieb (Bezug für „Freitag“, „morgen“). */
  bezug: string;
}

/** Seine offenen, geschuldeten Raten und die Zusage an der Person. */
export async function zusageFaktenLesen(personId: number, lauf: Lauf = sqlPool): Promise<{ raten: ZusageRate[]; personZusage: string | null }> {
  const raten = (await lauf.unsafe(`
    SELECT r.id, r.rate_nr AS nr, r.ref, r.faellig_am::text AS faellig, r.inkasso_zusage_am::text AS zusage, r.betrag_cents AS cents
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL
     WHERE a.person_id = $1
       AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
       AND ${ERINNERBARE_BESTELLUNG_SQL("a")}
       AND ${FORDERUNG_AKTIV_SQL_FUER("a", "r")}
     ORDER BY r.faellig_am, r.rate_nr`, [personId])) as any[];
  const [p] = (await lauf`SELECT promised_payment_date::text AS zusage FROM fiaon_persons WHERE id = ${personId}`) as any[];
  return {
    raten: raten.map((r) => ({ id: Number(r.id), nr: Number(r.nr), ref: String(r.ref), faellig: String(r.faellig).slice(0, 10), zusage: r.zusage ? String(r.zusage).slice(0, 10) : null, cents: Number(r.cents ?? 0) })),
    personZusage: p?.zusage ? String(p.zusage).slice(0, 10) : null,
  };
}

/**
 * Den Zahltag festhalten — Person, Raten, Verlauf in EINER Transaktion. Dieselben Felder wie WhatsApp-Mara und das
 * Inkasso; nichts am Mahnstand. `heute` nur für den Prüfstand.
 */
export async function zusageSpeichern(e: {
  personId: number; datum: string; raten: ZusageRate[]; zitat: string; quelle?: string | null; heute?: string;
}, lauf: Lauf = sqlPool): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.datum) || !e.raten.length) return;
  const heute = e.heute ?? berlinToday();
  const wv = naechsterVersuch({ ergebnis: "erreicht_zahlt_am", heute, zusageDatum: e.datum }).datum;
  const tagDanach = plusTage(e.datum, 1);
  const ids = e.raten.map((r) => r.id);
  const note = `Zahlungszusage per E-Mail (Mara): zahlt ${e.raten.map((r) => `Rate ${r.nr}`).join(", ")} am ${tagText(e.datum)}`
    + `${e.zitat ? ` — „${e.zitat.slice(0, 160)}“` : ""}${e.quelle ? ` (${e.quelle})` : ""}`;
  await lauf.begin(async (tx: any) => {
    await tx`UPDATE fiaon_persons SET promised_payment_date = ${e.datum}::date, follow_up_date = ${wv}::date, updated_at = NOW() WHERE id = ${e.personId}`;
    await tx`
      UPDATE fiaon_abo_raten SET
        inkasso_zusage_am = ${e.datum}::date,
        inkasso_wiedervorlage = GREATEST(COALESCE(inkasso_wiedervorlage, ${tagDanach}::date), ${tagDanach}::date),
        updated_at = NOW()
      WHERE id = ANY(${ids}::int[]) AND status = 'offen' AND storniert_am IS NULL AND bezahlt_am IS NULL`;
    await tx`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, promised_date)
      VALUES (${e.raten[0].ref}, ${e.personId}, NULL, ${ZUSAGE_AGENT_NAME}, 'system', ${note.slice(0, 900)},
              (${e.datum}::date + TIME '12:00') AT TIME ZONE 'Europe/Berlin')`;
  });
}

/**
 * Seine Mail lesen, den Zahltag beurteilen und — wenn er klar ist — festhalten. null: kein Zahltag in seiner Mail.
 * Der Aufrufer prüft vorher die Lage (zusageErlaubt: Raten-Lage, kein Bestreiten/Widerruf/Anwalt, kein Global-Kunde).
 */
export async function zahlungszusageBehandeln(e: {
  personId: number;
  /** Sein eigener Text (ohne Zitat unserer Mail). */
  kundeText: string;
  betreff?: string | null;
  /** Maras letzte Antwort im Verlauf — für „Ja“ auf ihre Rückfrage. */
  letzteMara?: string | null;
  /** Wann er schrieb — Bezug für „Freitag“, „morgen“ (sonst jetzt). */
  geschriebenAm?: Date | string | null;
  quelle?: string | null;
  /** Nur für den Prüfstand. */
  heute?: string;
}, lauf: Lauf = sqlPool): Promise<ZusageLage | null> {
  const am = e.geschriebenAm ? new Date(e.geschriebenAm) : null;
  const bezug = berlinToday(am && Number.isFinite(am.getTime()) ? am : new Date());
  const erkennung = zahltagErkennen(e.kundeText, bezug, { zahlFrage: zahlFrage(e.betreff, e.letzteMara), letzteMara: e.letzteMara ?? null });
  if (!erkennung) return null;
  const heute = e.heute ?? berlinToday();
  const { raten, personZusage } = await zusageFaktenLesen(e.personId, lauf);
  const urteil = zusageUrteil({ erkennung, heute, raten, personZusage })!;
  let geschrieben = false;
  if (urteil.art === "merken" && !urteil.schon) {
    await zusageSpeichern({ personId: e.personId, datum: urteil.datum, raten: urteil.raten, zitat: erkennung.zitat, quelle: e.quelle ?? null, heute }, lauf);
    geschrieben = true;
  }
  return {
    erkennung, urteil, bezug, geschrieben,
    hinweis: zusageHinweis(urteil, erkennung),
    handlung: zusageHandlung(urteil, { geschrieben }),
    daten: zusageKurz(urteil),
  };
}
