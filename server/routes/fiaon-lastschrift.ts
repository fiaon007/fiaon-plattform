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
import { aboAnker, rateBezahltBuchen } from "./fiaon-abo";

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
function faelligkeitstag(d: Date): number { return Math.min(28, Math.max(1, d.getUTCDate())); }

// ═══════════════════════════════════════════════════════════════════════════
// DER DIREKTLINK AUS DER MAIL (01.09.2026, E-072)
//
// ── DER BEFUND, AUS DEM DAS HIER ENTSTANDEN IST ───────────────────────────
// Die Vorlage `sepa_einrichten` ging bis zum 01.09. genau 23-mal raus (zum
// Vergleich: payment_reminder 15.934-mal in vierzehn Tagen). Von diesen 23
// wurden FÜNF geklickt — eine sehr gute Quote. Mandate entstanden: null.
// Der Grund steht in der Vorlage: Ihr Knopf zeigte auf /kundenbereich. Wer
// klickte, landete auf der Anmeldung, musste sich einloggen, „Abo &
// Zahlungen“ finden und dort den kleinen Knopf suchen. Fünf Schritte für
// eine Zwei-Minuten-Sache — auf jedem davon bricht jemand ab.
//
// ── DIE ANTWORT ───────────────────────────────────────────────────────────
// Ein signierter Link führt aus der Mail DIREKT auf die GoCardless-Seite.
// Kein Login, kein Suchen. Muster und Geheimnis sind dieselben wie beim
// „Antrag weiter“-Link (fiaon-antrag-erinnerung.ts) — kein zweiter Mechanismus.
//
// ── WARUM DAS VERTRETBAR IST ──────────────────────────────────────────────
// Der Link kann genau EINES: für diese Referenz eine Mandatsstrecke öffnen.
// Er zeigt keine Kundendaten, öffnet keinen Bereich, ändert nichts. Die IBAN
// gibt der Kunde bei GoCardless ein, FIAON sieht sie nie, und das Mandat
// bestätigt am Ende die kontoführende Bank. Wer einen fremden Link abfängt,
// könnte allenfalls sein EIGENES Konto für fremde Raten belasten.
// Gültigkeit 21 Tage — lang genug für eine Mahnkette, kurz genug, dass ein
// alter Mailanhang nicht ewig offensteht.
// ═══════════════════════════════════════════════════════════════════════════
function geheim(): string {
  return process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || "fiaon-dev-sepa-secret";
}
export function sepaSignatur(ref: string, exp: number): string {
  return createHmac("sha256", geheim()).update(`sepa.${ref}.${exp}`).digest("hex").slice(0, 32);
}
/** Der Link aus der Mail direkt in die Mandatsstrecke — 21 Tage gültig. */
export function sepaLink(ref: string, ttlMs = 21 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  return absoluteUrl(`/api/fiaon/lastschrift/direkt/${encodeURIComponent(`${ref}.${exp}.${sepaSignatur(ref, exp)}`)}`);
}
export function sepaPruefen(token: string): string | null {
  const teile = String(token || "").split(".");
  if (teile.length < 3) return null;
  const sig = teile.pop()!; const exp = Number(teile.pop()); const ref = teile.join(".");
  if (!ref || !exp || exp < Date.now()) return null;
  return sepaSignatur(ref, exp) === sig ? ref : null;
}

/**
 * Die Mandatsstrecke öffnen — für den angemeldeten Kunden UND für den
 * Direktlink. Eine Quelle, damit die Vorbelegung und die Sperren nicht
 * auseinanderlaufen. `rueckkehrPfad` bestimmt, wohin GoCardless zurückschickt.
 */
async function flowStarten(ref: string, rueckkehrPfad: (brId: string) => string): Promise<
  { ok: true; url: string } | { ok: true; bereits: true } | { ok: false; code: string; error: string }
> {
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.first_name, a.last_name, a.email, a.street, a.zip, a.city, a.country, a.pack_key,
           a.payment_status, p.gc_mandate_ref, p.gc_mandate_status
    FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
  if (!a) return { ok: false, code: "UNBEKANNT", error: "Konto nicht gefunden." };
  if (a.gc_mandate_ref && a.gc_mandate_status === "active") return { ok: true, bereits: true };
  // ── ERST ZAHLEN, DANN LASTSCHRIFT (Justin, 22.08.2026) ──────────────────
  // Wer noch nichts überwiesen hat, richtet keine Lastschrift ein: Sonst
  // richtet jeder eine ein, die erste Abbuchung schlägt fehl, und die
  // Rücklastgebühr zahlt FIAON. Die Tür steht hier, nicht nur im Browser.
  if (String(a.payment_status) !== "paid") {
    return { ok: false, code: "ERST_ZAHLEN",
      error: "Die Lastschrift können Sie einrichten, sobald Ihre erste Zahlung eingegangen ist." };
  }

  const br = await gc("/billing_requests", { method: "POST", idem: `br-${ref}-${Date.now()}`, body: {
    billing_requests: { mandate_request: { scheme: "sepa_core", currency: "EUR" }, metadata: { ref } } } });
  const brId = br.billing_requests.id;
  const flow = await gc("/billing_request_flows", { method: "POST", body: { billing_request_flows: {
    redirect_uri: absoluteUrl(rueckkehrPfad(brId)),
    exit_uri: absoluteUrl("/dashboard#abo"),
    prefilled_customer: {
      given_name: a.first_name || undefined, family_name: a.last_name || undefined, email: a.email || undefined,
      address_line1: a.street || undefined, postal_code: a.zip || undefined, city: a.city || undefined,
      country_code: (String(a.country || "").length === 2 ? String(a.country).toUpperCase() : undefined),
    },
    links: { billing_request: brId },
  } } });
  return { ok: true, url: flow.billing_request_flows.authorisation_url };
}

/** Mandat an der Person festschreiben und das GoCardless-Abo anlegen. */
async function mandatUebernehmen(ref: string, brId: string): Promise<"eingerichtet" | "abgebrochen" | "fehler"> {
  const br = (await gc(`/billing_requests/${brId}`)).billing_requests;
  const mandateId = br?.links?.mandate || null;
  if (!mandateId) return "abgebrochen";
  const mandat = (await gc(`/mandates/${mandateId}`)).mandates;
  const customerId = mandat?.links?.customer || br?.links?.customer || null;

  const [a] = (await sqlPool`SELECT person_id FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL LIMIT 1`) as any[];
  if (a?.person_id) {
    await sqlPool`UPDATE fiaon_persons SET gc_customer_ref = ${customerId}, gc_mandate_ref = ${mandateId},
      gc_mandate_status = ${String(mandat?.status || "pending_submission")}, updated_at = NOW() WHERE id = ${a.person_id}`;
  }
  await gcAboAnlegen(ref, mandateId);
  return "eingerichtet";
}

/** POST /kunde/:ref/lastschrift/start — Billing Request + Flow, liefert die GoCardless-Seite. */
router.post("/kunde/:ref/lastschrift/start", requireKunde, async (req: KundeRequest, res: Response) => {
  try {
    const ref = req.kundeRef!;
    const erg = await flowStarten(ref, (brId) =>
      `/api/fiaon/kunde/${encodeURIComponent(ref)}/lastschrift/rueckkehr?br=${brId}`);
    if (!erg.ok) {
      return res.status(erg.code === "UNBEKANNT" ? 404 : 409).json({ ok: false, code: erg.code, error: erg.error });
    }
    res.json(erg);
  } catch (err: any) {
    console.error("[LASTSCHRIFT] start:", err);
    res.status(500).json({ ok: false, error: err?.message || "Die Lastschrift konnte nicht gestartet werden." });
  }
});

/**
 * GET /lastschrift/direkt/:token — der Weg aus der Mail. Ohne Anmeldung,
 * ohne Zwischenseite: Prüfen, Strecke öffnen, weiterleiten. Was schiefgeht,
 * landet im Kundenbereich mit einer Meldung in Klartext — nie in einer
 * leeren Fehlerseite, denn hier steht ein Kunde vor dem Bildschirm.
 */
router.get("/lastschrift/direkt/:token", async (req: Request, res: Response) => {
  const heim = (q: string) => res.redirect(`/dashboard?lastschrift=${q}`);
  try {
    const ref = sepaPruefen(String(req.params.token || ""));
    if (!ref) return heim("link_abgelaufen");
    const erg = await flowStarten(ref, (brId) =>
      `/api/fiaon/lastschrift/direkt/${encodeURIComponent(String(req.params.token))}/zurueck?br=${brId}`);
    if (!erg.ok) return heim(erg.code === "ERST_ZAHLEN" ? "erst_zahlen" : "fehler");
    if ("bereits" in erg) return heim("bereits");
    return res.redirect(erg.url);
  } catch (err) {
    console.error("[LASTSCHRIFT] direkt:", err);
    return heim("fehler");
  }
});

/** GET /lastschrift/direkt/:token/zurueck — Rückkehr aus dem Direktlink, ebenfalls ohne Anmeldung. */
router.get("/lastschrift/direkt/:token/zurueck", async (req: Request, res: Response) => {
  const heim = (q: string) => res.redirect(`/dashboard?lastschrift=${q}`);
  try {
    const ref = sepaPruefen(String(req.params.token || ""));
    if (!ref) return heim("link_abgelaufen");
    const brId = String(req.query.br || "");
    if (!brId) return heim("fehler");
    return heim(await mandatUebernehmen(ref, brId));
  } catch (err) {
    console.error("[LASTSCHRIFT] direkt-zurueck:", err);
    return heim("fehler");
  }
});

/** GET /kunde/:ref/lastschrift/rueckkehr — Mandat speichern, Abonnement anlegen, zurück in den Bereich. */
router.get("/kunde/:ref/lastschrift/rueckkehr", requireKunde, async (req: KundeRequest, res: Response) => {
  const zurueck = (q: string) => res.redirect(`/dashboard?lastschrift=${q}#abo`);
  try {
    const ref = req.kundeRef!;
    const brId = String(req.query.br || "");
    if (!brId) return zurueck("fehler");
    return zurueck(await mandatUebernehmen(ref, brId));
  } catch (err: any) {
    console.error("[LASTSCHRIFT] rueckkehr:", err);
    return zurueck("fehler");
  }
});

/**
 * Das GoCardless-Abo anlegen — aus der Rückkehr UND aus der Verlängerung
 * (E-024). 12 Raten abzüglich der schon bezahlten in dieser Laufzeit.
 */
export async function gcAboAnlegen(ref: string, mandateIdVorgabe?: string | null): Promise<boolean> {
  const [a] = (await sqlPool`SELECT a.pack_key, a.created_at, a.submitted_at, a.abo_verlaengert_raten, p.gc_mandate_ref, p.gc_mandate_status
    FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
  const mandateId = mandateIdVorgabe || a?.gc_mandate_ref || null;
  if (!a || !mandateId) return false;
  if (!mandateIdVorgabe && a.gc_mandate_status !== "active") return false;
  {
    // Abonnement: 12 Raten, fällig am Tag des Abo-Ankers. Bereits bezahlte
    // Raten dieser Laufzeit werden abgezogen — sonst zahlt der Kunde 13 Mal.
    const pk = paketVon(a?.pack_key);
    const [gez] = (await sqlPool`SELECT COUNT(*)::int n FROM fiaon_abo_raten WHERE ref = ${ref} AND status = 'bezahlt'`) as any[];
    const laufzeitStart = Number(a.abo_verlaengert_raten || 0); // Raten der vorigen Laufzeiten
    const verbleibend = Math.max(1, 12 - Math.max(0, Number(gez?.n || 0) - laufzeitStart));
    if (pk?.abo && pk.preisCents > 0) {
      // ── EIN FÄLLIGKEITSTAG, NICHT ZWEI (22.08.2026, K8) ──────────────
      // Der interne Zyklus rechnet vom Anker (`aboAnker`: Buchungstag der
      // ersten Zahlung). Der erste Entwurf nahm hier den Antragstag — dann
      // zog GoCardless am 3., während die Rate intern am 7. fällig wurde,
      // und das Forderungsmanagement mahnte eine Rate, die vier Tage später
      // ohnehin eingezogen worden wäre. Dieselbe Quelle für beide.
      const { tag: anker } = await aboAnker(ref);
      const start = new Date(anker ? `${anker}T12:00:00Z` : (a?.submitted_at || a?.created_at || Date.now()));
      await gc("/subscriptions", { method: "POST", idem: `sub-${ref}-${mandateId}-${Number(a.abo_verlaengert_raten || 0)}`, body: { subscriptions: {
        amount: pk.preisCents, currency: "EUR", name: `FIAON ${pk.label}`, interval_unit: "monthly",
        day_of_month: faelligkeitstag(start), count: verbleibend, metadata: { ref },
        links: { mandate: mandateId },
      } } });
      return true;
    }
  }
  return false;
}

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
          const betroffen = (await sqlPool`UPDATE fiaon_persons SET gc_mandate_status = ${status}, updated_at = NOW()
            WHERE gc_mandate_ref = ${ev.links.mandate} RETURNING id`) as any[];
          // Das Ende eines Mandats gehört in die Akte: Wer anruft, muss wissen,
          // dass ab jetzt nichts mehr automatisch eingezogen wird.
          if (status !== "active") {
            for (const p of betroffen) {
              await sqlPool`
                INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
                SELECT a.ref, a.person_id, NULL, 'System', 'system',
                       ${`Lastschrift-Mandat ${status === "cancelled" ? "gekündigt" : status === "failed" ? "fehlgeschlagen" : "abgelaufen"} (GoCardless ${ev.links.mandate}${ev.details?.description ? ": " + ev.details.description : ""}). Ab jetzt kein automatischer Einzug mehr.`}
                FROM fiaon_applications a WHERE a.person_id = ${p.id} AND a.merged_into IS NULL
                ORDER BY a.created_at DESC LIMIT 1
              `.catch(() => {});
            }
          }
        }
      }
      if (ev.resource_type === "payments" && ev.links?.payment) {
        const p = (await gc(`/payments/${ev.links.payment}`)).payments;
        const ref = p?.metadata?.ref || null;
        // Ohne Referenz am Payment: über das Abo (subscription.metadata.ref)
        let r = ref;
        if (!r && p?.links?.subscription) { const s = (await gc(`/subscriptions/${p.links.subscription}`)).subscriptions; r = s?.metadata?.ref || null; }
        if (!r) { console.warn(`[LASTSCHRIFT] Payment ${p?.id} ohne Referenz — nicht zuordenbar.`); continue; }
        const chargeTag = String(p?.charge_date || new Date().toISOString().slice(0, 10)).slice(0, 10);
        const betrag = Number(p?.amount || 0);

        // ── DIE RICHTIGE RATE (K7) ──────────────────────────────────────
        // Erst die, die dieses Payment schon trägt (Webhook-Wiederholung),
        // dann die nicht stornierte, unbezahlte Rate mit GLEICHEM Betrag, die
        // dem Einzugstag am nächsten liegt. Ein Betrag, der zu keiner Rate
        // passt, wird nicht irgendwo verbucht, sondern gemeldet.
        let [rate] = (await sqlPool`SELECT id, status FROM fiaon_abo_raten WHERE gc_payment_id = ${p.id} LIMIT 1`) as any[];
        if (!rate) {
          [rate] = (await sqlPool`
            SELECT id, status FROM fiaon_abo_raten
            WHERE ref = ${r} AND status <> 'bezahlt' AND storniert_am IS NULL
              AND (${betrag} = 0 OR betrag_cents = ${betrag})
            ORDER BY ABS(faellig_am - ${chargeTag}::date) LIMIT 1`) as any[];
        }
        if (!rate) {
          console.warn(`[LASTSCHRIFT] Payment ${p.id} (${betrag} ct, ${ev.action}) passt zu keiner offenen Rate von ${r}.`);
          await sqlPool`
            INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
            VALUES (${r}, NULL, 'System', 'system',
                    ${`Lastschrift ${ev.action} über ${(betrag / 100).toFixed(2).replace(".", ",")} € (GoCardless ${p.id}) — keine passende offene Rate gefunden. Bitte von Hand prüfen.`})
          `.catch(() => {});
          continue;
        }

        if (["created", "submitted", "pending_submission"].includes(ev.action)) {
          await sqlPool`UPDATE fiaon_abo_raten SET lastschrift_status = 'eingereicht', lastschrift_am = NOW(),
            gc_payment_id = COALESCE(gc_payment_id, ${p.id}), updated_at = NOW()
            WHERE id = ${rate.id} AND status <> 'bezahlt'`;
        } else if (["confirmed", "paid_out"].includes(ev.action)) {
          // Dieselbe Buchung wie der Admin-Knopf: Folge-Rate, Prämie, Akte.
          await rateBezahltBuchen({ rateId: Number(rate.id), zahlungsdatum: chargeTag, quelle: "gocardless",
            notiz: `GoCardless ${p.id}`, gcPaymentId: String(p.id) });
        } else if (["failed", "charged_back", "late_failure_settled", "customer_approval_denied"].includes(ev.action)) {
          const grund = `${ev.action}${ev.details?.description ? " — " + ev.details.description : ""}`;
          // Die Rate bleibt OFFEN. Sie trägt jetzt eine Geschichte, und das
          // Forderungsmanagement sieht sie als eigenen Fall („Lastschrift
          // geplatzt") — mit Vorrang, denn hier hat schon ein Einzug versagt.
          await sqlPool`UPDATE fiaon_abo_raten
            SET status = CASE WHEN status = 'fehlgeschlagen' THEN 'offen' ELSE status END,
                lastschrift_status = 'fehlgeschlagen', lastschrift_am = NOW(), lastschrift_grund = ${grund},
                gc_payment_id = COALESCE(gc_payment_id, ${p.id}),
                notiz = CONCAT_WS(' · ', NULLIF(notiz, ''), ${`GoCardless ${p.id}: ${grund}`}), updated_at = NOW()
            WHERE id = ${rate.id}`;
          await sqlPool`
            INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
            VALUES (${r}, NULL, 'System', 'system',
                    ${`Lastschrift geplatzt (GoCardless ${p.id}: ${grund}). Die Rate bleibt offen und liegt beim Forderungsmanagement.`})
          `.catch(() => {});
        } else if (ev.action === "cancelled") {
          await sqlPool`UPDATE fiaon_abo_raten SET lastschrift_status = 'abgebrochen', lastschrift_am = NOW(),
            lastschrift_grund = ${ev.details?.description || "cancelled"}, updated_at = NOW()
            WHERE id = ${rate.id} AND status <> 'bezahlt'`;
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
