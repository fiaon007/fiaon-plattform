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
// ── DIE PREISE STEHEN NICHT MEHR HIER ──────────────────────────────────────
// Hier stand eine zweite Preisliste, und sie war bei Ultra und High End
// VERTAUSCHT gegenüber der Kaufpreisliste in `server/routes/fiaon-antrag.ts`:
// Ein Ultra-Kunde kaufte für 79,99 € und bekam Monatsrechnungen über 99,99 €.
//
// Die Begründung war eine Häufigkeitsauszählung des Kontoauszugs
// (`statement_165031496_EUR_2026-07-03_2026-08-11.csv`, 327 Eingänge):
// 99,99 € kam 75-mal vor, 79,99 € 46-mal. Daraus wurde geschlossen, 99,99 €
// sei Ultra. Das ist der Fehler: Eine Häufigkeit sagt, welche BETRÄGE
// vorkommen — nicht, zu welchem PAKET sie gehören.
//
// Entscheidung des Betreibers (16.08.2026): Ultra 79,99 €, High End 99,99 €.
// Eine Quelle, in `shared/fiaon-pakete.ts`.
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
import { PAKET_PREISE_CENTS } from "@shared/fiaon-pakete";

type Lauf = typeof sqlPool;

/**
 * Der Monatspreis je Paket, in Cent.
 *
 * Nur noch ein Durchreichen an den Katalog. Der Export bleibt, damit
 * bestehende Aufrufer nicht brechen — aber der Wert kommt von genau einer
 * Stelle.
 */
export const PAKET_PREIS_CENTS: Record<string, number> = PAKET_PREISE_CENTS;

/**
 * Der Zyklus ist KEINE Tageszahl mehr.
 *
 * Er ist der monatliche Jahrestag des Buchungstags und wird in
 * `server/lib/fiaon-abo-zyklus.ts` gerechnet. Die alte Konstante `ZYKLUS_TAGE`
 * (30) ist absichtlich entfernt: Wer sie noch importiert, soll es beim
 * Typcheck merken und nicht in einem stillen Rechenfehler.
 */
export { faelligkeit as aboFaelligkeit } from "./fiaon-abo-zyklus";

import { ankerTag, faelligkeit, zyklenBis } from "./fiaon-abo-zyklus";
import { berlinToday } from "./fiaon-time";

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
  /** Der Verwendungszweck, aus dem die Ratenreferenzen gebildet werden. */
  zahlungsreferenz: string;
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
           a.payment_reference,
           TRIM(COALESCE(a.first_name, '') || ' ' || COALESCE(a.last_name, '')) AS name,
           (SELECT MIN(t.booked_at)::date FROM fiaon_bank_txns t
             WHERE t.matched_ref = a.ref AND t.applied) AS bank_tag,
           a.paid_at::date AS verbucht_tag,
           a.completed_at::date AS anlage_tag
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
    ORDER BY COALESCE(a.paid_at::date,
      (SELECT MIN(t.booked_at)::date FROM fiaon_bank_txns t
        WHERE t.matched_ref = a.ref AND t.applied), a.completed_at::date)
  `)) as any[];

  const heute = berlinToday();

  return zeilen.flatMap((z) => {
    // Der Anker in derselben Rangfolge wie überall: Verbuchung, dann
    // Bankbuchung, dann Antragsabschluss. `created_at` steht bewusst NICHT
    // mehr dabei — der Tag, an dem jemand ein Formular geöffnet hat, ist kein
    // Zahlungstag, und er hat Kunden um Wochen verschoben.
    const start = ankerTag(z.verbucht_tag) ?? ankerTag(z.bank_tag) ?? ankerTag(z.anlage_tag);
    if (!start) return [];

    // Der Betrag: erst das Paket, dann der Bestellbetrag, dann nichts.
    const ausPaket = z.pack_key ? PAKET_PREIS_CENTS[String(z.pack_key)] : undefined;
    const ausBestellung = z.amount_due != null && Number(z.amount_due) > 0
      ? Math.round(Number(z.amount_due) * 100) : undefined;
    const betragCents = ausPaket ?? ausBestellung ?? 0;

    // ── DER VERWENDUNGSZWECK IST PFLICHT ─────────────────────────────────
    // `fiaon_abo_raten.zahlungsreferenz` ist NOT NULL. Das Muster steht in den
    // bestehenden 514 Raten: Rate 1 trägt die `payment_reference` der
    // Bestellung, Rate 2 dieselbe mit „-2", Rate 3 mit „-3". So erkennt die
    // Bankzuordnung, WELCHE Rate ein Kunde gezahlt hat.
    //
    // Fehlt die payment_reference, wird aus der langen `ref` eine gebildet —
    // sonst bricht der Eintrag ab, und der Kunde bleibt unsichtbar.
    const zahlungsreferenz = String(z.payment_reference ?? "").trim()
      || `FIAON-${String(z.ref).split("-").slice(1).join("").slice(0, 8)}`;

    const problem = betragCents === 0
      ? (z.pack_key
        ? `Paket „${z.pack_key}" hat keinen hinterlegten Preis.`
        : "Weder Paket noch Betrag hinterlegt — der Monatsbeitrag ist nicht ableitbar.")
      : null;

    // Wie viele Raten wären seit dem Start fällig geworden? Die erste liegt
    // einen Monat NACH der Verbuchung: Am Tag der Verbuchung hat er gezahlt.
    const ratenFaellig = zyklenBis(start, heute);

    return [{
      ref: String(z.ref),
      personId: z.person_id != null ? Number(z.person_id) : null,
      name: String(z.name).trim() || "Ohne Namen",
      packKey: z.pack_key ?? null,
      packName: z.pack_name ?? null,
      start,
      ausBank: z.bank_tag != null,
      betragCents,
      ratenFaellig,
      ratenUeberfaellig: ratenFaellig,
      zahlungsreferenz,
      problem,
    }];
  });
}

/**
 * Die fehlenden Raten anlegen.
 *
 * ── WIE VIELE RATEN? GENAU EINE ────────────────────────────────────────────
 * Die NÄCHSTE Fälligkeit. Nicht mehr.
 *
 * Hier stand bis zum 16.08.2026 „alle seit der Verbuchung fälligen plus die
 * nächste", mit der Begründung, sonst kehre man die Vergangenheit unter den
 * Teppich. Das Ergebnis stand dann im Forderungsmanagement:
 *
 *   Peter Zußner, person_id 3417, zwei bezahlte Pro-Bestellungen,
 *   je DREI offene Raten auf Mahnstufe 1 — für Monate, in denen ihm nie
 *   jemand eine Rechnung geschickt hat.
 *
 * Genau das meldete das Team als „Mahnung, ohne je eine Rate gezahlt zu
 * haben". Es war keine Zahlungsverweigerung, es war unsere Buchhaltung.
 *
 * Für einen Monat, in dem keine Rechnung rausging, kann man niemanden mahnen.
 * Rechnungen entstehen ab jetzt AM FÄLLIGKEITSTAG durch den Tageslauf — dann
 * mit Mail, und deshalb mahnbar.
 *
 * `rueckwirkend: true` legt die verstrichenen Monate trotzdem an. Das ist eine
 * bewusste Entscheidung des Betreibers und bekommt eine Notiz an der Rate.
 *
 * ── OHNE `schreiben` PASSIERT NICHTS ───────────────────────────────────────
 * Angelegte Raten lösen Mahnungen aus und stellen Kunden ins
 * Forderungsmanagement. Wer diesen Lauf zum ersten Mal ansieht, will sehen,
 * was passieren WÜRDE.
 */
export async function abosNachtragen(
  opts: { schreiben?: boolean; nurRef?: string | null; rueckwirkend?: boolean } = {},
  lauf: Lauf = sqlPool,
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

  // Eine Rate je Kunde — außer der Betreiber will die Vergangenheit.
  const ratenJe = (k: FehlendeAbo) => (opts.rueckwirkend ? Math.max(1, k.ratenFaellig) : 1);
  const ratenGesamt = machbar.reduce((s, k) => s + ratenJe(k), 0);

  if (!opts.schreiben) {
    return {
      kandidaten, angelegt: 0, ratenGesamt, uebersprungen,
      hinweis: kandidaten.length === 0
        ? "Jeder abopflichtige Kunde hat Raten. Nichts nachzutragen."
        : `${machbar.length} Kunden bekommen zusammen ${ratenGesamt} Raten `
          + `(${opts.rueckwirkend ? "rückwirkend, sofort überfällig" : "nur die nächste Fälligkeit"}). `
          + `${uebersprungen.length} übersprungen (kein ableitbarer Betrag). `
          + "Das ist die Vorschau — es wurde nichts angelegt.",
    };
  }

  let angelegt = 0;
  for (const k of machbar) {
    // Welche Zyklusnummern werden angelegt? Ohne `rueckwirkend` genau eine:
    // die nächste, die noch nicht verstrichen ist.
    const von = opts.rueckwirkend ? 1 : k.ratenFaellig + 1;
    const bis = opts.rueckwirkend ? Math.max(1, k.ratenFaellig) : k.ratenFaellig + 1;
    for (let i = von; i <= bis; i++) {
      // Dasselbe Muster wie die bestehenden Raten: Rate 1 ohne Zusatz,
      // ab Rate 2 mit „-N". Danach erkennt die Bankzuordnung, welche Rate
      // gezahlt wurde.
      const zr = i === 1 ? k.zahlungsreferenz : `${k.zahlungsreferenz}-${i}`;
      await lauf`
        INSERT INTO fiaon_abo_raten
          (ref, rate_nr, betrag_cents, faellig_am, status, zahlungsreferenz, quelle, notiz, created_at)
        VALUES (${k.ref}, ${i}, ${k.betragCents},
                ${faelligkeit(k.start, i)}::date, 'offen', ${zr}, 'nachgezogen',
                ${opts.rueckwirkend
                  ? "Bestandsaufnahme, rückwirkend angelegt — für diesen Monat ging nie eine Rechnung raus"
                  : "Bestandsaufnahme (nächste Fälligkeit)"},
                NOW())
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
