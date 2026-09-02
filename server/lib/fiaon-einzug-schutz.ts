// ═══════════════════════════════════════════════════════════════════════════
// WIRD BEI DIESER RATE SCHON EINGEZOGEN? — DIE EINE QUELLE (02.09.2026)
//
// DER ANLASS: Ali Alfatlawi, Rate 2 über 7,99 €. Bei GoCardless am 28.08.
// abgebucht und bestätigt, in unserer Datenbank „offen", Mahnstufe 2, drei
// Erinnerungen. Der Kunde zahlt und wird gemahnt.
//
// WARUM DIESE DATEI EXISTIERT: Nach der Reparatur stand dieselbe Bedingung an
// drei Stellen im Code — im Mahnlauf, in der Zahllink-Sperre und in der
// Lagebestimmung des Mail-Agenten. Drei Kopien einer Regel sind drei Regeln,
// sobald jemand eine davon anfasst. Bei der Abnahme desselben Tages fiel auf,
// dass sie an drei WEITEREN Stellen fehlte: bei der stündlichen Vorabinfo,
// beim Handknopf im Ratenlauf und beim Erinnerungsknopf im
// Forderungsmanagement. Wer eine Regel sechsmal schreiben muss, schreibt sie
// irgendwo falsch.
//
// DIE SIEBEN TAGE VORLAUF sind gemessen, nicht geschätzt: Fälligkeit und
// Abo-Einzug fallen selten auf denselben Tag. Brandt, Schneider und Sheeraz
// 0 Tage, Sturm und Thoma 1 Tag, Weber 32. Ohne Vorlauf wäre Eva Sturm am
// 27.09. gemahnt und am 28.09. abgebucht worden — dieselbe Rate, ein Tag
// Versatz. Sieben Tage fangen das ab und lassen Webers 32 Tage draußen, wo
// sie hingehören: echte Altlast, die einzeln abgerufen wird.
//
// DIE ABWÄGUNG DAHINTER: Ein zu Unrecht nicht gemahnter Kunde kostet Tage.
// Ein zu Unrecht gemahnter kostet das Vertrauen.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * SQL-Bedingung: TRUE, wenn für die Rate bereits eingezogen wird.
 *
 * @param rate  Alias der Ratenzeile in der umgebenden Abfrage (meist "r").
 *
 * Verwendung im Mahnlauf — die Rate NICHT anfassen:
 *   WHERE ... AND NOT (${wirdEingezogenSql("r")})
 *
 * Verwendung in einer Auswertung — die Rate MARKIEREN:
 *   SELECT ..., (${wirdEingezogenSql("r")}) AS wird_eingezogen
 *
 * Zwei Zeichen sagen, dass eingezogen wird:
 *   · eine `gc_payment_id` an der Rate — der Einzug ist bereits ausgelöst
 *   · ein aktives Abo auf dem Vertrag, dessen Start zur Fälligkeit passt
 */
export function wirdEingezogenSql(rate = "r"): string {
  return `(
    ${rate}.gc_payment_id IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM fiaon_applications sub
       WHERE sub.ref = ${rate}.ref
         AND sub.gc_subscription_ref IS NOT NULL
         AND sub.gc_subscription_status = 'active'
         AND sub.gc_subscription_start IS NOT NULL
         AND ${rate}.faellig_am >= sub.gc_subscription_start - INTERVAL '7 days'
    )
  )`;
}

/**
 * Dieselbe Frage für EINE Rate, wenn sie schon geladen ist — für Stellen, die
 * keine SQL-Bedingung einhängen können (etwa ein Knopf, der eine Rate per id
 * holt und dann entscheidet).
 */
export async function wirdEingezogen(rateId: number): Promise<boolean> {
  const { sqlPool } = await import("./db-pool");
  const [r] = (await sqlPool.unsafe(
    `SELECT ${wirdEingezogenSql("r")} AS ja FROM fiaon_abo_raten r WHERE r.id = $1`,
    [rateId],
  ).catch(() => [])) as any[];
  return r?.ja === true;
}

/** Der Satz, den ein Mensch zu sehen bekommt, wenn er es trotzdem versucht. */
export const EINZUG_HINWEIS =
  "Für diese Rate läuft bereits ein Bankeinzug. Eine Zahlungsaufforderung würde den Kunden ein zweites Mal zur Kasse bitten.";
