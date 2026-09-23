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
// Bezahlt wird seit dem 19.09.2026 ausschließlich per Überweisung (E-194).
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";
import { BANK } from "@shared/fiaon-bank";
import { epcQrNutzlast } from "@shared/fiaon-epc-qr";
import { istGlobalPaket, paket as katalogPaket } from "@shared/fiaon-pakete";
import { globalPaket } from "@shared/fiaon-global";

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
  /**
   * E-188 (17.09.2026): ein Firmenauftrag über FIAON Global — Einmalpreis, kein
   * Konto, das „aktiviert" wird, keine Karte „unterwegs". Die Zahlungsseite
   * spricht dann das Unternehmen an (der Firmenname ist keine Personenangabe)
   * und lässt alle Sätze der Privatkundenlinie weg.
   */
  firmenauftrag?: boolean;
  firmenName?: string;
  /**
   * Nur beim Firmenauftrag: die Sprache, in der das Unternehmen seinen Auftrag geführt hat
   * (fiaon_global_auftraege.vertrag_sprache). Wer auf /en/business/start unterschrieben hat,
   * liest die Zahlungsseite englisch (kleines Wörterbuch in client/src/pages/zahlung.tsx).
   */
  sprache?: "de" | "en";
}

// E-230: Auch das neue Bestellformat ohne Bindestrich (FIAONXXXXXX-N). Vorher
// führte jede Rate dieser Bestellungen auf „Bestellung nicht gefunden" (404) —
// 135 Bestellungen im neuen Format, auch die Links in den Raten-Mails.
const RATEN_MUSTER = /^FIAON-?[A-Z0-9]{6}-(\d{1,2})$/i;

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
    SELECT ref, payment_reference, payment_status, payment_due_date, amount_due, currency, first_name, pack_name, pack_key, company_name
    FROM fiaon_applications WHERE payment_reference = ${ref} LIMIT 1
  `) as any[];
  if (!a) return null;
  const firmenauftrag = istGlobalPaket(a.pack_key);
  // Die Sprache steht in der Auftragsakte. Fehlt die Akte (Bestellung außerhalb des Bestellwegs) oder
  // die Tabelle, bleibt die Seite deutsch — die Zahlungsseite darf daran nie scheitern.
  let sprache: "de" | "en" = "de";
  if (firmenauftrag) {
    const [g] = (await sqlPool`SELECT vertrag_sprache FROM fiaon_global_auftraege WHERE ref = ${a.ref} LIMIT 1`.catch(() => [])) as any[];
    if (String(g?.vertrag_sprache ?? "").toLowerCase() === "en") sprache = "en";
  }
  const enName = sprache === "en" ? globalPaket(a.pack_key)?.en.name : null;
  return {
    art: "bestellung",
    paymentReference: a.payment_reference,
    status: a.payment_status,
    dueDate: a.payment_due_date ? new Date(a.payment_due_date).toISOString() : null,
    amountDue: String(a.amount_due),
    currency: a.currency || "EUR",
    // Beim Firmenauftrag steht oben die Firma, nicht ein Vorname.
    firstName: firmenauftrag ? "" : (a.first_name || ""),
    packName: firmenauftrag ? (enName ? `FIAON ${enName}` : (katalogPaket(a.pack_key)?.label ?? a.pack_name ?? "")) : (a.pack_name || ""),
    ...(firmenauftrag ? { firmenauftrag: true, firmenName: String(a.company_name || ""), sprache } : {}),
  };
}

// ── KEINE SOFORTZAHLUNG MEHR (19.09.2026, E-194) ─────────────────────────────
// Die „Sofortzahlung per Bank-App" lief über GoCardless (Instant Bank Pay). Die
// Zusammenarbeit ist beendet — bezahlt wird per Überweisung mit den Daten unten
// (Zahlungsmail, Zahlungsseite, GiroCode). sofortUrlFuer/sofortErlaubt sind
// entfernt; Mails und Seiten bieten keinen Bank-App-Knopf mehr an.

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
