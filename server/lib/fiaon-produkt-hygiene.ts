// ═══════════════════════════════════════════════════════════════════════════
// PRODUKT-HYGIENE — ein Kunde, eine Stufe (die Regel, an einer Stelle)
//
// Die Logik stand bis zum 08.08.2026 in `scripts/produkt-hygiene.ts`. Der
// Massen-Merge braucht sie ebenfalls: Führt man fünf Personensätze eines
// Menschen zusammen, hat der Gewinner danach womöglich drei offene
// Stufenpakete — also drei Rechnungen und drei Mahnketten für einen Vertrag.
//
// Zwei Aufrufer, eine Regel. Eine zweite Fassung im Merge-Lauf wäre der Anfang
// von zwei Wahrheiten darüber, was „ein Produkt" ist.
//
// WAS NIE ANGEFASST WIRD
//   · bezahlte Bestellungen — Geld ist geflossen,
//   · Zusatzprodukte (Bonitätsauskunft, `type='schufa'`, 74 €) — ein Kunde mit
//     Abo UND Auskunft ist richtig und keine Dublette,
//   · archivierte und bereits ersetzte Zeilen.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export interface HygieneFall {
  personId: number;
  kunde: string;
  /** Die Bestellung, die bleibt (die jüngste, bei Gleichstand die stärkere). */
  behalten: { ref: string; paymentReference: string | null; packName: string | null; status: string; angelegt: string | null };
  /** Die Bestellung, die stillgelegt wird. */
  stilllegen: { ref: string; paymentReference: string | null; packName: string | null; status: string; angelegt: string | null };
}

/**
 * Zahlungsstände, die eine Stufe als „offen" gelten lassen.
 *
 * `pending` ist ABSICHTLICH nicht dabei: Das ist ein angefangener Antrag, für
 * den nie eine Rechnung angefordert wurde — ein Trichter-Entwurf, kein Produkt.
 * Es gibt daran nichts stillzulegen, es mahnt niemand, und es kostet nichts.
 *
 * Diese Liste ist die EINE Definition von „offene Stufe". Der Produktstand
 * benutzt sie für seine Warnung „zwei offene Stufen", damit die Akte nicht etwas
 * anmahnt, das der Aufräum-Lauf gar nicht anfassen würde (gesehen am
 * 08.08.2026: Die Akte forderte zur Produkt-Hygiene auf, der Lauf meldete
 * „nichts zu tun" — beide hatten recht, und der Mensch davor war ratlos).
 */
export const OFFENE_STUFE = ["pending_payment", "claimed_paid", "expired"] as const;
const OFFEN: readonly string[] = OFFENE_STUFE;

/**
 * Offene Stufenpakete je Person — und welche davon zu viel sind.
 *
 * Ohne `personIds` läuft die Prüfung über den ganzen Bestand (so benutzt es der
 * Aufräum-Lauf), mit `personIds` nur über die genannten Personen (so benutzt es
 * der Massen-Merge für seinen frischen Gewinner).
 */
export async function hygieneFaelle(personIds: number[] | null, lauf: Lauf = sqlPool): Promise<HygieneFall[]> {
  const ids = personIds?.filter((n) => Number.isFinite(n)) ?? null;
  if (ids != null && ids.length === 0) return [];

  const offene = ids == null
    ? await lauf`
        SELECT a.person_id, a.ref, a.payment_reference, a.pack_name, a.payment_status, a.created_at,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.primary_email, p.person_ref) AS kunde
        FROM fiaon_applications a
        JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
        WHERE a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status = ANY(${OFFEN})
          AND COALESCE(a.type, '') <> 'schufa'
          AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        ORDER BY a.person_id, a.created_at DESC`
    : await lauf`
        SELECT a.person_id, a.ref, a.payment_reference, a.pack_name, a.payment_status, a.created_at,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                        p.company_name, p.primary_email, p.person_ref) AS kunde
        FROM fiaon_applications a
        JOIN fiaon_persons p ON p.id = a.person_id AND p.merged_into_person_id IS NULL
        WHERE a.person_id = ANY(${ids}::int[])
          AND a.merged_into IS NULL AND a.archived_at IS NULL
          AND a.payment_status = ANY(${OFFEN})
          AND COALESCE(a.type, '') <> 'schufa'
          AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
        ORDER BY a.person_id, a.created_at DESC`;

  const jePerson = new Map<number, any[]>();
  for (const o of offene as any[]) {
    const id = Number(o.person_id);
    const arr = jePerson.get(id) ?? [];
    arr.push(o);
    jePerson.set(id, arr);
  }

  const rang = (r: any): number =>
    ({ claimed_paid: 3, pending_payment: 2, expired: 1 } as Record<string, number>)[String(r.payment_status)] ?? 0;
  const alsZeile = (r: any) => ({
    ref: String(r.ref),
    paymentReference: r.payment_reference ?? null,
    packName: r.pack_name ? String(r.pack_name).split("\n")[0].trim() : null,
    status: String(r.payment_status ?? ""),
    angelegt: r.created_at ? new Date(r.created_at).toISOString() : null,
  });

  const faelle: HygieneFall[] = [];
  for (const [personId, liste] of Array.from(jePerson.entries())) {
    if (liste.length < 2) continue;
    // Die jüngste bleibt — der Kunde hat sich zuletzt so entschieden. Bei
    // gleichem Datum entscheidet der stärkere Zahlungsstand.
    const sortiert = liste.slice().sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || rang(b) - rang(a));
    const behalten = sortiert[0];
    for (const s of sortiert.slice(1)) {
      faelle.push({
        personId,
        kunde: String(behalten.kunde ?? personId),
        behalten: alsZeile(behalten),
        stilllegen: alsZeile(s),
      });
    }
  }
  return faelle;
}

/**
 * Die Fälle ausführen: stilllegen, Verweis setzen, im Verlauf erklären.
 *
 * @returns die tatsächlich stillgelegten Referenzen
 */
export async function hygieneAusfuehren(
  faelle: HygieneFall[],
  lauf: Lauf,
  akteur = "Produkt-Hygiene (Lauf)",
): Promise<string[]> {
  const stillgelegt: string[] = [];
  for (const f of faelle) {
    // Zeiger PRÜFEN, nicht glauben: bevorzugt der Verwendungszweck, aber nur,
    // wenn er auch auflösbar ist. Sonst die `ref` — sie ist Primärschlüssel.
    const kandidat = f.behalten.paymentReference || f.behalten.ref;
    const [treffer] = await lauf`
      SELECT 1 AS ok FROM fiaon_applications
      WHERE payment_reference = ${kandidat} OR ref = ${kandidat} LIMIT 1
    `;
    const zeiger = treffer ? kandidat : f.behalten.ref;

    const rows = await lauf`
      UPDATE fiaon_applications SET
        payment_status = 'superseded',
        superseded_by = ${zeiger},
        updated_at = NOW()
      WHERE ref = ${f.stilllegen.ref}
        AND payment_status = ANY(${OFFEN})
        AND archived_at IS NULL AND merged_into IS NULL
      RETURNING ref
    `;
    if (rows.length === 0) continue;
    stillgelegt.push(f.stilllegen.ref);

    await lauf`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, outcome, note)
      VALUES (${f.stilllegen.ref}, NULL, 'System', 'system', 'superseded',
              ${`Stillgelegt: Dieselbe Person hatte zwei offene Stufenpakete. Diese Bestellung wird durch ${zeiger} ersetzt (${akteur}). Keine weiteren Erinnerungen; die Bestellung bleibt in der Akte sichtbar.`})
    `;
    await lauf`
      INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
      VALUES (NULL, 'produkt_hygiene',
              ${JSON.stringify({ personId: f.personId, stillgelegt: f.stilllegen.ref, ersetztDurch: zeiger })},
              ${akteur},
              ${"Zweite offene Stufenpaket-Bestellung derselben Person stillgelegt"})
    `;
    const { personTierAktualisieren } = await import("./tier");
    await personTierAktualisieren(lauf, { personId: f.personId }).catch(() => {});
  }
  return stillgelegt;
}
