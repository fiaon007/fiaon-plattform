// ═══════════════════════════════════════════════════════════════════════════
// KUNDENSTATUS (Server) — Vokabular aus shared/, dazu die Herkunftsauskunft
//
// Das Vokabular selbst steht in `shared/fiaon-kundenstatus.ts`, damit Server und
// Oberfläche dieselben Texte benutzen. Hier liegt, was nur der Server kann:
//
//   · `statusFuerPerson` — welcher Antrag, welches Ereignis, welches Datum den
//     Status bestimmt. Das ist der Block „Warum dieser Status?" in der Akte.
//   · `statusSpalten` — SQL, das den Status direkt in einer Liste mitliefert.
//
// WARUM DIE HERKUNFT MITKOMMT
// „Antrag abgeschlossen, keine Zahlung" hat eine Agentin einen Kunden für
// bezahlt halten lassen. Ein Status ohne Begründung ist eine Behauptung; wer ihn
// anzweifelt, hat keine Möglichkeit nachzusehen. Ab jetzt steht neben dem Status,
// WORAUS er folgt — mit Referenz und Datum.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import {
  kundenstatus, statusAusTierGrund, zahlungsstatusText,
  KUNDENSTATUS, ETIKETT_FRIST_ABGELAUFEN,
  type Kundenstatus, type KundenstatusSchluessel,
} from "../../shared/fiaon-kundenstatus";

export {
  kundenstatus, statusAusTierGrund, zahlungsstatusText,
  KUNDENSTATUS, ETIKETT_FRIST_ABGELAUFEN,
};
export type { Kundenstatus, KundenstatusSchluessel };

type Lauf = typeof sqlPool;

export interface StatusHerkunft {
  status: Kundenstatus;
  /** Die Bestellung, die den Status bestimmt. */
  ref: string | null;
  verwendungszweck: string | null;
  paket: string | null;
  betragCent: number | null;
  /** Roher Zahlungsstand — für den Fall, dass jemand tiefer nachsehen will. */
  zahlungsstatus: string | null;
  antragsstatus: string | null;
  /** Das Ereignis, das zuletzt darauf gewirkt hat, im Klartext. */
  ereignis: string | null;
  ereignisAm: string | null;
  frist: string | null;
  /** Wie viele Bestellungen die Person hat (die anderen bestimmen den Status nicht). */
  bestellungen: number;
  /** Warum genau diese Bestellung maßgeblich ist. */
  begruendung: string;
}

/**
 * Der Status einer PERSON — und woraus er folgt.
 *
 * Maßgeblich ist die Bestellung mit dem stärksten Zustand: Geld schlägt Meldung,
 * Meldung schlägt offene Rechnung. Sonst würde ein Kunde mit einer bezahlten und
 * einer offenen Bestellung als „Rechnung offen" erscheinen und weiter Mahnungen
 * bekommen.
 */
export async function statusFuerPerson(personId: number, lauf: Lauf = sqlPool): Promise<StatusHerkunft | null> {
  const [p] = await lauf`SELECT id FROM fiaon_persons WHERE id = ${personId}`;
  if (!p) return null;

  const bestellungen = await lauf`
    SELECT ${lauf.unsafe(STATUS_SPALTEN)}
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL
    ORDER BY (a.archived_at IS NOT NULL), rang DESC, a.created_at DESC
  `;
  return herkunftAus(bestellungen as any[], lauf);
}

/**
 * Derselbe Status, aber über eine VORGEGEBENE Menge von Bestellungen.
 *
 * Die Kundenakte kennt eine Person nicht als `person_id`, sondern als
 * Bestell-Familie über gleiche E-Mail oder Telefonnummer (siehe Kopf von
 * `server/routes/fiaon-kunden.ts`). Beide Begriffe sind vertretbar — aber sie
 * dürfen sich nicht in derselben Ansicht widersprechen.
 *
 * Am 08.08.2026 zeigte die Akte oben „Diese Person hat genau eine Bestellung"
 * und rechts daneben vier. Der Statusblock zählte nach `person_id`, die Liste
 * nach Kontaktdaten. Wer so etwas sieht, glaubt der Seite nichts mehr. Deshalb
 * bekommt die Akte den Status jetzt über GENAU die Bestellungen, die sie auch
 * anzeigt.
 */
export async function statusFuerBestellungen(refs: string[], lauf: Lauf = sqlPool): Promise<StatusHerkunft | null> {
  const sauber = Array.from(new Set(refs.filter(Boolean).map(String)));
  if (sauber.length === 0) return null;
  const bestellungen = await lauf`
    SELECT ${lauf.unsafe(STATUS_SPALTEN)}
    FROM fiaon_applications a
    WHERE a.ref = ANY(${sauber}) AND a.merged_into IS NULL
    ORDER BY (a.archived_at IS NOT NULL), rang DESC, a.created_at DESC
  `;
  return herkunftAus(bestellungen as any[], lauf);
}

/** Die Spalten, aus denen der Status folgt — an einer Stelle, für beide Wege. */
const STATUS_SPALTEN = `
  a.ref, a.payment_reference, a.payment_status, a.status, a.pack_name,
  a.amount_due, a.payment_due_date, a.archived_at, a.created_at,
  a.claimed_paid_at, a.completed_at,
  CASE a.payment_status
    WHEN 'paid' THEN 60 WHEN 'claimed_paid' THEN 50
    WHEN 'pending_payment' THEN 40 WHEN 'expired' THEN 35
    WHEN 'pending' THEN 30 ELSE 10 END AS rang`;

/** Aus den geladenen Bestellungen den Status und seine Herkunft ableiten. */
async function herkunftAus(bestellungen: any[], lauf: Lauf): Promise<StatusHerkunft> {
  if (bestellungen.length === 0) {
    return {
      status: kundenstatus({ hatBestellung: false }),
      ref: null, verwendungszweck: null, paket: null, betragCent: null,
      zahlungsstatus: null, antragsstatus: null,
      ereignis: null, ereignisAm: null, frist: null,
      bestellungen: 0,
      begruendung: "Für diese Person gibt es keine Bestellung — sie ist ein Lead.",
    };
  }

  const b: any = bestellungen[0];
  const status = kundenstatus({
    zahlungsstatus: b.payment_status,
    antragsstatus: b.status,
    archiviertAm: b.archived_at,
    frist: b.payment_due_date,
    hatBestellung: true,
  });

  // Das letzte Ereignis, das auf diese Bestellung gewirkt hat. Bevorzugt ein
  // dokumentierter Vorgang, sonst der Zeitstempel des Zustands selbst.
  const [ereignis] = await lauf`
    SELECT c.created_at, c.type, c.outcome, c.note, c.agent_name
    FROM fiaon_contact_log c
    WHERE c.ref = ${b.ref} AND c.voided_at IS NULL
    ORDER BY c.created_at DESC LIMIT 1
  `.catch(() => []);

  const ereignisText = b.payment_status === "paid"
    ? `Zahlung bankbestätigt gebucht${b.completed_at ? "" : " (ohne Eingangsdatum)"}`
    : b.payment_status === "claimed_paid"
      ? "Kunde hat gemeldet, dass er überwiesen hat"
      : b.archived_at
        ? "Bestellung archiviert"
        : ereignis
          ? `${ereignis.outcome || ereignis.type}${ereignis.agent_name ? ` durch ${ereignis.agent_name}` : ""}`
          : "Bestellung angelegt";
  const ereignisAm = b.payment_status === "paid"
    ? (b.completed_at ?? b.created_at)
    : b.payment_status === "claimed_paid"
      ? (b.claimed_paid_at ?? b.created_at)
      : b.archived_at ?? ereignis?.created_at ?? b.created_at;

  const weitere = bestellungen.length - 1;
  const begruendung = weitere > 0
    ? `Von ${bestellungen.length} Bestellungen bestimmt diese den Status — sie hat den stärksten Zahlungsstand. `
      + `Die ${weitere} andere${weitere === 1 ? "" : "n"} ändern ihn nicht.`
    : "Diese Person hat genau eine Bestellung; sie bestimmt den Status.";

  return {
    status,
    ref: String(b.ref),
    verwendungszweck: b.payment_reference ?? null,
    paket: b.pack_name ? String(b.pack_name).split("\n")[0].trim() : null,
    betragCent: b.amount_due != null ? Math.round(Number(b.amount_due) * 100) : null,
    zahlungsstatus: b.payment_status ?? null,
    antragsstatus: b.status ?? null,
    ereignis: ereignisText,
    ereignisAm: ereignisAm ? new Date(ereignisAm).toISOString() : null,
    frist: b.payment_due_date ? new Date(b.payment_due_date).toISOString() : null,
    bestellungen: bestellungen.length,
    begruendung,
  };
}
