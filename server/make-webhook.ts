// ═══════════════════════════════════════════════════════════════════
// Make.com Webhook-Versand — löst dort automatisierte E-Mails aus.
// Die Plattform versendet für diese Ereignisse KEINE E-Mails direkt.
// Events: welcome | payment_details | followup_48h
// Siehe MIGRATION_INVENTORY.md
// ═══════════════════════════════════════════════════════════════════

import postgres from "postgres";

// WICHTIG: Jeder neue Event-Typ MUSS zusätzlich in die Registry
// (server/make-events-registry.ts) eingetragen werden — sie ist die
// Quelle für die Event-Test-Konsole /admin/events (Paket T).
export type MakeEventType =
  | "welcome"
  | "payment_details"
  | "followup_48h" // deprecated — ersetzt durch payment_reminder (Paket V)
  | "payment_reminder"
  | "claim_received"
  | "payment_confirmed"
  | "agent_payment_reminder"
  | "agent_invite"
  | "agent_password_reset"
  | "agent_payout_done"
  | "agent_payout_rejected"
  | "agent_callback_reminder"
  | "agent_feedback_rewarded"
  | "lead_followup"
  | "lead_application_link";

export interface MakeWebhookPayload {
  email: string;
  vorname?: string | null;
  nachname?: string | null;
  antrag_id?: string;
  payment_reference?: string | null;
  betrag?: string | null;
  paket?: string | null;
  [key: string]: unknown;
}

/**
 * Sendet einen Webhook an Make.com (URL aus env MAKE_WEBHOOK_URL).
 * Fehler blockieren NIEMALS den Nutzer-/Zahlungsflow — sie werden nur geloggt.
 */
export async function sendMakeWebhook(eventType: MakeEventType, payload: MakeWebhookPayload): Promise<boolean> {
  const url = process.env.MAKE_WEBHOOK_URL;
  if (!url) {
    console.warn(`[MAKE-WEBHOOK] MAKE_WEBHOOK_URL nicht gesetzt — Event '${eventType}' (${payload.antrag_id}) übersprungen`);
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        timestamp: new Date().toISOString(),
        ...payload,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[MAKE-WEBHOOK] '${eventType}' (${payload.antrag_id}) → HTTP ${res.status}`);
      return false;
    }
    console.log(`[MAKE-WEBHOOK] '${eventType}' gesendet (${payload.antrag_id}${payload.payment_reference ? `, ${payload.payment_reference}` : ""})`);
    recordLastSent(eventType);
    return true;
  } catch (err) {
    console.error(`[MAKE-WEBHOOK] '${eventType}' (${payload.antrag_id}) fehlgeschlagen:`, err instanceof Error ? err.message : err);
    return false;
  }
}

// ── Diagnose: letzter erfolgreicher Versand je Event-Typ ─────────────────────
// Für /admin/einstellungen (System-Status). Fire-and-forget, blockiert nie.
// Kein Import aus fiaon-agent.ts (Zyklus) — eigener Lazy-Pool.
let diagPool: ReturnType<typeof postgres> | null = null;

function recordLastSent(eventType: MakeEventType): void {
  (async () => {
    try {
      if (!process.env.DATABASE_URL) return;
      if (!diagPool) diagPool = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1 });
      const rows = await diagPool`SELECT value FROM fiaon_settings WHERE key = 'make_last_events'`;
      const map = rows[0] ? JSON.parse(rows[0].value) : {};
      map[eventType] = new Date().toISOString();
      const value = JSON.stringify(map);
      await diagPool`
        INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('make_last_events', ${value}, NOW())
        ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()
      `;
    } catch (err) {
      // Diagnose darf niemals den Versand stören — nur leise loggen
      console.warn(`[MAKE-WEBHOOK] Diagnose-Write fehlgeschlagen:`, err instanceof Error ? err.message : err);
    }
  })();
}

/** Baut den Standard-Payload aus einer fiaon_applications-Zeile. */
export function makePayloadFromRow(row: any): MakeWebhookPayload {
  const contactParts = (row.contact_name || "").split(" ");
  return {
    email: row.email || row.contact_email || row.billing_email || "",
    vorname: row.first_name || contactParts[0] || null,
    nachname: row.last_name || (contactParts.length > 1 ? contactParts.slice(1).join(" ") : null),
    antrag_id: row.ref,
    payment_reference: row.payment_reference || null,
    betrag: row.amount_due != null ? String(row.amount_due) : null,
    paket: row.pack_name ? String(row.pack_name).replace(/\n/g, " ") : null,
  };
}
