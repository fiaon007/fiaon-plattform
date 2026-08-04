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
  | "agent_feedback_reply"
  | "lead_followup"
  | "lead_application_link"
  | "number_update_request" // #23: Kunde/Lead aktualisiert Telefonnummer selbst
  | "abo_payment_reminder"  // monatliche Paketrate fällig (Abo) — Stufen 1–3
  // ── Registriert für /admin/events (Betreiber kann testen + Make-Zweig bauen).
  //    NOCH KEIN automatischer Versand im Code verdrahtet (Empfehlung, Teil 1.3):
  | "payment_cancelled"       // Bestellung storniert
  | "payment_reactivated"     // abgelaufene Bestellung reaktiviert (neue Frist)
  | "documents_change_request"// Dokumente-Änderung angefordert (changes_requested)
  | "schufa_approved"         // SCHUFA genehmigt
  | "schufa_rejected"         // SCHUFA abgelehnt
  | "schufa_requested"        // neues SCHUFA-Dokument angefordert
  | "account_suspended"       // Konto gesperrt
  | "account_activated"       // Konto aktiviert
  | "profile_query"           // Profil-Rückfrage an den Kunden
  | "gdpr_deleted"            // Löschbestätigung (DSGVO)
  | "contract_signed"         // Agent hat den Handelsvertretervertrag digital signiert (Prompt 2 D)
  | "commission_statement_issued"; // Provisions-Abrechnung/Gutschrift erzeugt (Prompt 2 E)

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

// P5: Diagnose-Bridge — lazy import, non-blocking, wirft nie (kein Zyklus,
// Maskierung passiert im Diagnose-Modul serverseitig vor Speicherung).
function reportDiag(e: { severity: "kritisch" | "warnung" | "info"; code: string; message: string; hint?: string; ref?: string | null }): void {
  import("./lib/fiaon-diagnostics")
    .then((d) => d.logDiagnostic({
      severity: e.severity, category: "email_make", code: e.code, message: e.message, hint: e.hint,
      link: e.ref ? `/admin/zahlungen?ref=${encodeURIComponent(String(e.ref))}` : undefined,
      action: e.ref ? { kind: "resend_event", label: "Event erneut senden", ref: String(e.ref) } : null,
    }))
    .catch(() => {});
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
      // P5: strukturiertes Diagnose-Ereignis (non-blocking, ändert den Flow nicht).
      reportDiag({
        severity: res.status >= 500 ? "kritisch" : "warnung",
        code: "make_webhook_http",
        message: `Make-Webhook für Event '${eventType}' abgelehnt (HTTP ${res.status}) — Empfänger ${payload.email || "?"}${payload.payment_reference ? `, Ref ${payload.payment_reference}` : ""}.`,
        hint: "Prüfe das Make-Szenario (aktiv? Webhook erreichbar?) und ob die Payload-Struktur des Events dort bekannt ist (E-Mail-Events → Test senden).",
        ref: payload.payment_reference || payload.antrag_id,
      });
      return false;
    }
    console.log(`[MAKE-WEBHOOK] '${eventType}' gesendet (${payload.antrag_id}${payload.payment_reference ? `, ${payload.payment_reference}` : ""})`);
    recordLastSent(eventType);
    return true;
  } catch (err) {
    console.error(`[MAKE-WEBHOOK] '${eventType}' (${payload.antrag_id}) fehlgeschlagen:`, err instanceof Error ? err.message : err);
    reportDiag({
      severity: "kritisch",
      code: "make_webhook_error",
      message: `Make-Webhook für Event '${eventType}' nicht erreichbar: ${err instanceof Error ? err.message : String(err)} — Empfänger ${payload.email || "?"}.`,
      hint: "Netzwerk-/Timeout-Problem zu Make. Läuft das Szenario? Ist MAKE_WEBHOOK_URL korrekt? Kunde-Mail ggf. über E-Mail-Events erneut senden.",
      ref: payload.payment_reference || payload.antrag_id,
    });
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
