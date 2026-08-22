// ═══════════════════════════════════════════════════════════════════════════
// SEPA-LASTSCHRIFT ÜBER GOCARDLESS (Scheibe 11, 22.08.2026)
//
// Justins Regel: Jeder Kunde hat mit Antragsabschluss ein 12-Monats-Abo, jede
// Rate fällig genau einen Monat nach der vorigen (Abschluss 01.01. → 01.02. …).
// Zahlt er nicht, geht die Rate ins Forderungsmanagement.
//
// Ablauf: Der Kunde klickt „Lastschrift einrichten" → GoCardless Billing
// Request Flow (GoCardless-gehostete Seite, dort gibt er IBAN ein und
// bestätigt das Mandat; FIAON sieht die IBAN nie) → Rückkehr → Mandat wird an
// der Person gespeichert (gc_customer_ref / gc_mandate_ref / gc_mandate_status,
// Spalten existieren seit Phase 3) → Abonnement mit 12 Raten, Tag = Tag des
// Antragsabschlusses. Webhooks halten Mandat- und Zahlungsstatus aktuell.
//
// Kein SDK: drei REST-Aufrufe, Idempotency-Key je Vorgang. Alles hinter
// `requireKunde`. Token und Umgebung kommen aus GOCARDLESS_ACCESS_TOKEN /
// GOCARDLESS_ENVIRONMENT (live|sandbox).
// ═══════════════════════════════════════════════════════════════════════════
import { Router, type Request, type Response } from "express";
import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import { sqlPool } from "../lib/db-pool";
import { requireKunde, type KundeRequest } from "../lib/fiaon-kunde-session";
import { paket as paketVon } from "@shared/fiaon-pakete";
import { absoluteUrl } from "../fiaon-base-url";

const router = Router();
const BASIS = () => (process.env.GOCARDLESS_ENVIRONMENT === "sandbox" ? "https://api-sandbox.gocardless.com" : "https://api.gocardless.com");

async function gc(pfad: string, init: { method?: string; body?: unknown; idem?: string } = {}): Promise<any> {
  const token = process.env.GOCARDLESS_ACCESS_TOKEN;
  if (!token) throw new Error("GOCARDLESS_ACCESS_TOKEN fehlt.");
  const r = await fetch(`${BASIS()}${pfad}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${token}`, "GoCardless-Version": "2015-07-06",
      "Content-Type": "application/json", ...(init.idem ? { "Idempotency-Key": init.idem } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const m = j?.error?.message || j?.error?.errors?.map((e: any) => e.message).join("; ") || `HTTP ${r.status}`;
    throw new Error(`GoCardless: ${m}`);
  }
  return j;
}

/** Fälligkeitstag = Tag des Antragsabschlusses, auf 1–28 geklemmt (Februar). */
function faelligkeitstag(d: Date): number { return Math.min(28, Math.max(1, d.getDate())); }

/** POST /kunde/:ref/lastschrift/start — Billing Request + Flow, liefert die GoCardless-Seite. */
router.post("/kunde/:ref/lastschrift/start", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const [a] = (await sqlPool`
      SELECT a.ref, a.person_id, a.first_name, a.last_name, a.email, a.street, a.zip, a.city, a.country, a.pack_key,
             p.gc_mandate_ref, p.gc_mandate_status
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
      WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Konto nicht gefunden." });
    if (a.gc_mandate_ref && a.gc_mandate_status === "active") return res.json({ ok: true, bereits: true });

    const br = await gc("/billing_requests", { method: "POST", idem: `br-${ref}-${Date.now()}`, body: {
      billing_requests: { mandate_request: { scheme: "sepa_core", currency: "EUR" }, metadata: { ref } } } });
    const brId = br.billing_requests.id;
    const flow = await gc("/billing_request_flows", { method: "POST", body: { billing_request_flows: {
      redirect_uri: absoluteUrl(`/api/fiaon/kunde/${encodeURIComponent(ref)}/lastschrift/rueckkehr?br=${brId}`),
      exit_uri: absoluteUrl("/dashboard#abo"),
      prefilled_customer: {
        given_name: a.first_name || undefined, family_name: a.last_name || undefined, email: a.email || undefined,
        address_line1: a.street || undefined, postal_code: a.zip || undefined, city: a.city || undefined,
        country_code: (String(a.country || "").length === 2 ? String(a.country).toUpperCase() : undefined),
      },
      links: { billing_request: brId },
    } } });
    res.json({ ok: true, url: flow.billing_request_flows.authorisation_url });
  } catch (err: any) {
    console.error("[LASTSCHRIFT] start:", err);
    res.status(500).json({ ok: false, error: err?.message || "Die Lastschrift konnte nicht gestartet werden." });
  }
});

/** GET /kunde/:ref/lastschrift/rueckkehr — Mandat speichern, Abonnement anlegen, zurück in den Bereich. */
router.get("/kunde/:ref/lastschrift/rueckkehr", requireKunde, async (req: KundeRequest, res: Response) => {
  const zurueck = (q: string) => res.redirect(`/dashboard?lastschrift=${q}#abo`);
  try {
    const ref = req.kundeRef!;
    const brId = String(req.query.br || "");
    if (!brId) return zurueck("fehler");
    const br = (await gc(`/billing_requests/${brId}`)).billing_requests;
    const mandateId = br?.links?.mandate || null;
    if (!mandateId) return zurueck("abgebrochen");
    const mandat = (await gc(`/mandates/${mandateId}`)).mandates;
    const customerId = mandat?.links?.customer || br?.links?.customer || null;

    const [a] = (await sqlPool`SELECT person_id, pack_key, created_at, submitted_at FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
    if (a?.person_id) {
      await sqlPool`UPDATE fiaon_persons SET gc_customer_ref = ${customerId}, gc_mandate_ref = ${mandateId},
        gc_mandate_status = ${String(mandat?.status || "pending_submission")}, updated_at = NOW() WHERE id = ${a.person_id}`;
    }
    // Abonnement: 12 Raten, fällig am Tag des Antragsabschlusses. Bereits
    // bezahlte Raten werden abgezogen — sonst zahlt der Kunde 13 Mal.
    const pk = paketVon(a?.pack_key);
    const [gez] = (await sqlPool`SELECT COUNT(*)::int n FROM fiaon_abo_raten WHERE ref = ${ref} AND status = 'bezahlt'`) as any[];
    const verbleibend = Math.max(1, 12 - Number(gez?.n || 0));
    if (pk?.abo && pk.preisCents > 0) {
      const start = new Date(a?.submitted_at || a?.created_at || Date.now());
      await gc("/subscriptions", { method: "POST", idem: `sub-${ref}-${mandateId}`, body: { subscriptions: {
        amount: pk.preisCents, currency: "EUR", name: `FIAON ${pk.label}`, interval_unit: "monthly",
        day_of_month: faelligkeitstag(start), count: verbleibend, metadata: { ref },
        links: { mandate: mandateId },
      } } });
    }
    return zurueck("eingerichtet");
  } catch (err: any) {
    console.error("[LASTSCHRIFT] rueckkehr:", err);
    return zurueck("fehler");
  }
});

/** POST /gocardless/webhook — Mandats- und Zahlungsstatus. Signatur: HMAC-SHA256 mit GOCARDLESS_WEBHOOK_SECRET. */
router.post("/gocardless/webhook", async (req: Request, res: Response) => {
  try {
    const secret = process.env.GOCARDLESS_WEBHOOK_SECRET;
    const roh = (req as any).rawBody ? String((req as any).rawBody) : JSON.stringify(req.body);
    if (secret) {
      const erwartet = createHmac("sha256", secret).update(roh).digest("hex");
      const ist = String(req.headers["webhook-signature"] || "");
      if (ist.length !== erwartet.length || !timingSafeEqual(Buffer.from(ist), Buffer.from(erwartet))) {
        return res.status(498).json({ ok: false, error: "Signatur passt nicht." });
      }
    } else {
      console.warn("[LASTSCHRIFT] Webhook ohne GOCARDLESS_WEBHOOK_SECRET — Signatur nicht geprüft.");
    }
    for (const ev of (req.body?.events || []) as any[]) {
      if (ev.resource_type === "mandates") {
        const status = ev.action === "active" ? "active" : ev.action === "cancelled" ? "cancelled" : ev.action === "failed" ? "failed" : ev.action === "expired" ? "expired" : null;
        if (status && ev.links?.mandate) {
          await sqlPool`UPDATE fiaon_persons SET gc_mandate_status = ${status}, updated_at = NOW() WHERE gc_mandate_ref = ${ev.links.mandate}`;
        }
      }
      if (ev.resource_type === "payments" && ev.links?.payment) {
        const p = (await gc(`/payments/${ev.links.payment}`)).payments;
        const ref = p?.metadata?.ref || null;
        // Ohne Referenz am Payment: über das Abo (subscription.metadata.ref)
        let r = ref;
        if (!r && p?.links?.subscription) { const s = (await gc(`/subscriptions/${p.links.subscription}`)).subscriptions; r = s?.metadata?.ref || null; }
        if (!r) continue;
        const charge = p?.charge_date ? new Date(p.charge_date) : new Date();
        if (["confirmed", "paid_out"].includes(ev.action)) {
          // Die Rate, die dem Einzugstag am nächsten liegt und noch offen ist.
          await sqlPool`UPDATE fiaon_abo_raten SET status = 'bezahlt', bezahlt_am = NOW(), quelle = 'gocardless', notiz = ${`GoCardless ${p.id}`}, updated_at = NOW()
            WHERE id = (SELECT id FROM fiaon_abo_raten WHERE ref = ${r} AND status <> 'bezahlt' ORDER BY ABS(faellig_am - ${charge.toISOString().slice(0, 10)}::date) LIMIT 1)`;
        } else if (["failed", "charged_back", "late_failure_settled"].includes(ev.action)) {
          await sqlPool`UPDATE fiaon_abo_raten SET status = 'fehlgeschlagen', notiz = ${`GoCardless ${p.id}: ${ev.action}${ev.details?.description ? " — " + ev.details.description : ""}`}, updated_at = NOW()
            WHERE id = (SELECT id FROM fiaon_abo_raten WHERE ref = ${r} AND status <> 'bezahlt' ORDER BY ABS(faellig_am - ${charge.toISOString().slice(0, 10)}::date) LIMIT 1)`;
        }
      }
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[LASTSCHRIFT] webhook:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;
