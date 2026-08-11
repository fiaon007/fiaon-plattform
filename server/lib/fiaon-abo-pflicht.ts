// ═══════════════════════════════════════════════════════════════════════════
// WER HAT EIN ABO — UND WAS KOSTET ES?
//
// ── DIE REGEL, IN WORTEN DES VORGESETZTEN ──────────────────────────────────
// „JEDER Kunde BIS AUF SCHUFA (74 €) HAT EIN ABO, JEDER — ab Tag der
// Verbuchung, genau ab dem Tag bezahlt er JEDES Monat sein Paket. Jeder, der
// seine Rate nicht bezahlt hat, muss zum Inkasso kommen."
//
// „Die SCHUFA-Zahlungen brauchen auch kein Datum fürs Abo, nur das Paket, und
// ab Tag der Einzahlung 30 Tage Zyklus."
//
// ── DIE PREISE SIND GEGEN DEN KONTOAUSZUG GEPRÜFT ──────────────────────────
// Nicht aus dem Kopf, sondern gegen `statement_165031496_EUR_2026-07-03_
// 2026-08-11.csv` — 327 echte Eingänge über 23.244,82 €. Die Häufigkeiten
// sagen, welche Beträge wirklich vorkommen:
//
//      99,99 €  ×75      ultra
//      79,99 €  ×46      highend
//      74,00 €  ×37      SCHUFA — KEIN ABO
//      59,99 €  ×81      pro
//       7,99 €  ×54      start (und die Monatsrate der Zugänge)
//
// Alles andere im Auszug sind Einzelfälle: Teilzahlungen (0,88 €, 8 €, 10 €,
// 20 €, 50 €), Rundungen (59,90 €, 59,95 €, 76,12 €) und drei große Posten
// (249,99 €, 500 €, 1.000 €) aus dem Geschäftskundenbereich.
//
// ── WARUM DER PREIS NICHT AUS `amount_due` KOMMT ───────────────────────────
// Gemessen am 11.08.2026: **63 bezahlte Kunden haben `amount_due IS NULL`**,
// 58 davon auch keine Raten. Wer den Ratenbetrag aus diesem Feld nimmt, legt
// für sie eine Rate über null Euro an — oder gar keine.
//
// Der Preis gehört zum PAKET, nicht zur einzelnen Bestellung. Deshalb hier
// eine Tabelle: Sie gilt auch dann, wenn an der Bestellung nichts steht.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

/** Der Monatspreis je Paket, in Cent. */
export const PAKET_PREIS_CENTS: Record<string, number> = {
  start: 799,
  pro: 5999,
  highend: 7999,
  ultra: 9999,
  business_pro: 9999,
  business_enterprise: 24999,
};

/** Wie viele Tage liegen zwischen zwei Raten? */
export const ZYKLUS_TAGE = 30;

/**
 * Ist das eine SCHUFA-Bestellung — also OHNE Abo?
 *
 * Zwei Merkmale, weil keines allein genügt: Der Betrag 74 € ist eindeutig,
 * aber bei 63 Bestellungen fehlt er. Der Paketname „Bonitätsauskunft" trägt
 * die Auskunft dann.
 *
 * Als SQL-Ausdruck, damit dieselbe Regel in Abfragen gilt — nicht als zweite
 * Fassung in TypeScript, die irgendwann abweicht.
 */
export const SCHUFA_SQL = `(
  a.amount_due = 74
  OR a.pack_name ILIKE '%onitäts%'
  OR a.pack_name ILIKE '%onitaets%'
  OR a.pack_name ILIKE '%onitätsauskunft%'
  OR a.pack_key = 'schufa'
)`;

export function istSchufa(a: { amount_due?: unknown; pack_name?: unknown; pack_key?: unknown }): boolean {
  if (Number(a.amount_due) === 74) return true;
  if (String(a.pack_key ?? "") === "schufa") return true;
  const n = String(a.pack_name ?? "").toLowerCase();
  return n.includes("onitäts") || n.includes("onitaets");
}

export interface FehlendeAbo {
  ref: string;
  personId: number | null;
  name: string;
  packKey: string | null;
  packName: string | null;
  /** Der Tag, ab dem gezählt wird. */
  start: string;
  /** Kommt der Starttag aus einer echten Bankbuchung? */
  ausBank: boolean;
  betragCents: number;
  /** Wie viele Raten wären seit dem Start fällig geworden? */
  ratenFaellig: number;
  /** Wie viele davon liegen in der Vergangenheit — also sofort überfällig? */
  ratenUeberfaellig: number;
  /** Warum kein Betrag ableitbar war (dann wird nichts angelegt). */
  problem: string | null;
}

/**
 * Wer braucht ein Abo und hat keine Rate?
 *
 * ── DER STARTTAG ───────────────────────────────────────────────────────────
 * „Ab Tag der Verbuchung." Die erste zugeordnete Bankbuchung ist die
 * Verbuchung — sie steht in `fiaon_bank_txns.booked_at`. Fehlt sie (bei 148
 * von 358 bezahlten Kunden), bleibt `created_at` als schlechtere, aber
 * einzige Auskunft. Das wird ausgewiesen, nicht verschwiegen: `ausBank`.
 */
export async function fehlendeAbos(lauf: Lauf = sqlPool): Promise<FehlendeAbo[]> {
  const zeilen = (await lauf.unsafe(`
    SELECT a.ref, a.person_id, a.pack_key, a.pack_name, a.amount_due,
           TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')) AS name,
           (SELECT MIN(t.booked_at)::date FROM fiaon_bank_txns t
             WHERE t.matched_ref = a.ref AND t.applied) AS bank_tag,
           a.created_at::date AS anlage_tag
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid'
      AND a.merged_into IS NULL
      AND a.archived_at IS NULL
      AND a.gdpr_deleted_at IS NULL
      AND a.abo_gestoppt_am IS NULL
      -- KEIN SCHUFA. Ein blankes NOT (…) würde bei amount_due IS NULL zu NULL
      -- werden und die Zeile stillschweigend ausschließen — genau der Fehler,
      -- der mich 63 Kunden gekostet hat. Deshalb COALESCE.
      AND NOT COALESCE(${SCHUFA_SQL}, FALSE)
      AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref)
    ORDER BY COALESCE(
      (SELECT MIN(t.booked_at)::date FROM fiaon_bank_txns t
        WHERE t.matched_ref = a.ref AND t.applied), a.created_at::date)
  `)) as any[];

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  return zeilen.map((z) => {
    const startDatum: Date = new Date(z.bank_tag ?? z.anlage_tag);
    startDatum.setHours(0, 0, 0, 0);

    // Der Betrag: erst das Paket, dann der Bestellbetrag, dann nichts.
    const ausPaket = z.pack_key ? PAKET_PREIS_CENTS[String(z.pack_key)] : undefined;
    const ausBestellung = z.amount_due != null && Number(z.amount_due) > 0
      ? Math.round(Number(z.amount_due) * 100) : undefined;
    const betragCents = ausPaket ?? ausBestellung ?? 0;

    const problem = betragCents === 0
      ? (z.pack_key
        ? `Paket „${z.pack_key}" hat keinen hinterlegten Preis.`
        : "Weder Paket noch Betrag hinterlegt — der Monatsbeitrag ist nicht ableitbar.")
      : null;

    // Wie viele Raten wären seit dem Start fällig geworden? Die erste liegt
    // einen Zyklus NACH der Verbuchung: Am Tag der Verbuchung hat er gezahlt.
    const tageSeitStart = Math.floor((heute.getTime() - startDatum.getTime()) / 86_400_000);
    const ratenFaellig = Math.max(0, Math.floor(tageSeitStart / ZYKLUS_TAGE));

    return {
      ref: String(z.ref),
      personId: z.person_id != null ? Number(z.person_id) : null,
      name: String(z.name).trim() || "Ohne Namen",
      packKey: z.pack_key ?? null,
      packName: z.pack_name ?? null,
      start: startDatum.toISOString().slice(0, 10),
      ausBank: z.bank_tag != null,
      betragCents,
      ratenFaellig,
      ratenUeberfaellig: ratenFaellig,
      problem,
    };
  });
}

/**
 * Die fehlenden Raten anlegen.
 *
 * ── WIE VIELE RATEN? ───────────────────────────────────────────────────────
 * Alle, die seit der Verbuchung fällig geworden sind, PLUS die nächste. Wer
 * im Juni verbucht wurde, hat im Juli und August je eine Rate — beide
 * überfällig, beide gehören ins Forderungsmanagement. Nur die nächste
 * anzulegen würde die Vergangenheit unter den Teppich kehren.
 *
 * ── OHNE `schreiben` PASSIERT NICHTS ───────────────────────────────────────
 * Angelegte Raten lösen Mahnungen aus und stellen Kunden ins
 * Forderungsmanagement. Wer diesen Lauf zum ersten Mal ansieht, will sehen,
 * was passieren WÜRDE.
 */
export async function abosNachtragen(
  opts: { schreiben?: boolean; nurRef?: string | null } = {}, lauf: Lauf = sqlPool,
): Promise<{
  kandidaten: FehlendeAbo[];
  angelegt: number;
  ratenGesamt: number;
  uebersprungen: FehlendeAbo[];
  hinweis: string;
}> {
  const alle = await fehlendeAbos(lauf);
  const kandidaten = opts.nurRef ? alle.filter((k) => k.ref === opts.nurRef) : alle;
  const machbar = kandidaten.filter((k) => !k.problem && k.betragCents > 0);
  const uebersprungen = kandidaten.filter((k) => k.problem || k.betragCents === 0);

  const ratenGesamt = machbar.reduce((s, k) => s + k.ratenFaellig + 1, 0);

  if (!opts.schreiben) {
    return {
      kandidaten, angelegt: 0, ratenGesamt, uebersprungen,
      hinweis: kandidaten.length === 0
        ? "Jeder abopflichtige Kunde hat Raten. Nichts nachzutragen."
        : `${machbar.length} Kunden bekommen zusammen ${ratenGesamt} Raten. `
          + `${uebersprungen.length} übersprungen (kein ableitbarer Betrag). `
          + "Das ist die Vorschau — es wurde nichts angelegt.",
    };
  }

  let angelegt = 0;
  for (const k of machbar) {
    const start = new Date(`${k.start}T00:00:00Z`);
    // Alle fälligen plus die nächste.
    for (let i = 1; i <= k.ratenFaellig + 1; i++) {
      const faellig = new Date(start.getTime() + i * ZYKLUS_TAGE * 86_400_000);
      await lauf`
        INSERT INTO fiaon_abo_raten (ref, rate_nr, betrag_cents, faellig_am, status, created_at)
        VALUES (${k.ref}, ${i}, ${k.betragCents},
                ${faellig.toISOString().slice(0, 10)}::date, 'offen', NOW())
        ON CONFLICT DO NOTHING
      `;
    }
    angelegt++;
  }

  console.log(`[ABO] ${angelegt} Kunden nachgetragen, ${ratenGesamt} Raten. `
    + `${uebersprungen.length} übersprungen.`);
  return {
    kandidaten, angelegt, ratenGesamt, uebersprungen,
    hinweis: `${angelegt} Kunden bekamen zusammen ${ratenGesamt} Raten. `
      + `Wer eine überfällige Rate hat, steht ab jetzt im Forderungsmanagement.`,
  };
}

/**
 * Gegenprobe: Hat eine SCHUFA-Bestellung Raten, die sie nicht haben darf?
 *
 * Der Vorgesetzte: „Die SCHUFA-Zahlungen brauchen kein Datum fürs Abo."
 * Heute sind es null — aber eine Regel, die man nicht prüft, gilt nur, bis
 * jemand sie vergisst.
 */
export async function schufaMitRaten(lauf: Lauf = sqlPool): Promise<{
  ref: string; name: string; raten: number;
}[]> {
  return (await lauf.unsafe(`
    SELECT a.ref,
           TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')) AS name,
           (SELECT COUNT(*)::int FROM fiaon_abo_raten r WHERE r.ref = a.ref) AS raten
    FROM fiaon_applications a
    WHERE a.payment_status = 'paid' AND a.merged_into IS NULL
      AND a.gdpr_deleted_at IS NULL
      AND COALESCE(${SCHUFA_SQL}, FALSE)
      AND EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref)
  `)) as any[];
}
