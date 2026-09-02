// ═══════════════════════════════════════════════════════════════════════════
// DER ZAHLUNGSAUFTRAG — eine Referenz, ein Ergebnis (02.09.2026)
//
// Die Zahlungsseite /zahlung/:ref und der QR-Code in den Mails brauchen
// dieselbe Antwort auf dieselbe Frage: „Was soll zu dieser Referenz bezahlt
// werden?" Bis heute kannte die Seite nur Bestellungen (FIAON-XXXXXX). Seit
// dem Kontowechsel und Justins Auftrag „so einfach zahlen wie möglich" gilt
// dasselbe für Monatsraten (FIAON-XXXXXX-N): eigene Seite, eigener QR-Code,
// Verwendungszweck = Ratenreferenz, damit der Eingang automatisch bucht.
//
// Was hier NICHT passiert: keine Kundendaten außer Vorname und Paket. Die
// Seite ist ohne Anmeldung erreichbar — die Referenz ist der Schlüssel.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { BANK } from "@shared/fiaon-bank";
import { epcQrNutzlast } from "@shared/fiaon-epc-qr";

export interface Zahlungsauftrag {
  art: "bestellung" | "rate";
  paymentReference: string;
  /** pending_payment | claimed_paid | paid | … (Bestellung) — Raten: offen → pending_payment, bezahlt → paid, storniert → cancelled */
  status: string;
  dueDate: string | null;
  amountDue: string;
  currency: string;
  firstName: string;
  packName: string;
  rateNr?: number;
  ratenVon?: number;
}

const RATEN_MUSTER = /^FIAON-[A-Z0-9]{6}-(\d{1,2})$/i;

export async function zahlungsauftragFinden(refRoh: string): Promise<Zahlungsauftrag | null> {
  const ref = String(refRoh || "").trim().toUpperCase();
  if (!ref) return null;

  if (RATEN_MUSTER.test(ref)) {
    const [r] = (await sqlPool`
      SELECT r.zahlungsreferenz, r.status, r.betrag_cents, r.faellig_am, r.rate_nr,
             a.first_name, a.pack_name, a.currency
      FROM fiaon_abo_raten r
      JOIN fiaon_applications a ON a.ref = r.ref
      WHERE UPPER(r.zahlungsreferenz) = ${ref}
      ORDER BY r.id DESC LIMIT 1
    `) as any[];
    if (!r) return null;
    const status = r.status === "bezahlt" ? "paid" : r.status === "storniert" ? "cancelled" : "pending_payment";
    return {
      art: "rate",
      paymentReference: r.zahlungsreferenz,
      status,
      dueDate: r.faellig_am ? new Date(r.faellig_am).toISOString() : null,
      amountDue: (Number(r.betrag_cents) / 100).toFixed(2),
      currency: r.currency || "EUR",
      firstName: r.first_name || "",
      packName: r.pack_name || "",
      rateNr: Number(r.rate_nr) || undefined,
      ratenVon: 12,
    };
  }

  const [a] = (await sqlPool`
    SELECT payment_reference, payment_status, payment_due_date, amount_due, currency, first_name, pack_name
    FROM fiaon_applications WHERE payment_reference = ${ref} LIMIT 1
  `) as any[];
  if (!a) return null;
  return {
    art: "bestellung",
    paymentReference: a.payment_reference,
    status: a.payment_status,
    dueDate: a.payment_due_date ? new Date(a.payment_due_date).toISOString() : null,
    amountDue: String(a.amount_due),
    currency: a.currency || "EUR",
    firstName: a.first_name || "",
    packName: a.pack_name || "",
  };
}

// ── SOFORTZAHLUNG PER BANK-APP (02.09.2026, Justin: „so innovativ wie möglich") ──
// Den signierten Link baut fiaon-lastschrift.ts (GoCardless Instant Bank Pay).
// Damit Mails, Zahlungsseite und Resolver ihn nutzen können, ohne dass sich
// zwei Module gegenseitig importieren, steckt sich das Lastschrift-Modul beim
// Laden hier ein. Solange nichts eingesteckt ist, gibt es keinen Link — und
// der Mail-Motor lässt den Knopf weg, statt ins Leere zu verlinken.
let sofortLinkQuelle: ((ref: string) => string | null) | null = null;
export function registriereSofortLink(fn: (ref: string) => string | null): void { sofortLinkQuelle = fn; }
export function sofortUrlFuer(ref: string | null | undefined): string | null {
  if (!ref || !sofortLinkQuelle) return null;
  try { return sofortLinkQuelle(String(ref)) || null; } catch { return null; }
}

/** Die GiroCode-Nutzlast zu einem Auftrag — Bankdaten IMMER aus der einen Quelle. */
export function zahlungsauftragQrNutzlast(z: Zahlungsauftrag): string {
  return epcQrNutzlast({
    recipient: BANK.empfaenger,
    iban: BANK.iban,
    bic: BANK.bic,
    amount: Number(z.amountDue) || 0,
    remittance: z.paymentReference,
  });
}
