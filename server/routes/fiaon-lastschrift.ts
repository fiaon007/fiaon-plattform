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
import { zahlungsauftragFinden, registriereSofortLink } from "../lib/fiaon-zahlungsauftrag";

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
  // Abnahme-Fund 02.09.: Ein frisch erteiltes Mandat steht tagelang auf
  // pending_submission/submitted, bevor der Webhook "active" meldet. In diesem
  // Fenster darf die Strecke KEIN zweites Abo anlegen — jedes erteilte,
  // nicht gescheiterte Mandat gilt als "bereits eingerichtet".
  if (a.gc_mandate_ref && !["failed", "cancelled", "expired", ""].includes(String(a.gc_mandate_status || ""))) {
    return { ok: true, bereits: true };
  }
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

// ── DER FUND VOM 02.09.2026 (11 verwaiste Mandate) ───────────────────────
// Die Rückkehr las das Mandat aus `billing_request.links.mandate` — dieses
// Feld gibt es in der GoCardless-Antwort NICHT. Das Mandat hängt an
// `links.mandate_request_mandate` (bzw. `mandate_request.links.mandate`).
// Folge seit dem 22.08.: Jede Rückkehr endete als „abgebrochen", kein Mandat
// wurde gespeichert, kein Abo angelegt; Kunden versuchten es erneut (eine
// Kundin dreimal am 31.08.) — bei GoCardless lagen 11 Mandate, die Datenbank
// kannte keines. Dazu kommt: Die Erfüllung ist asynchron. Direkt nach der
// Rückkehr kann das Mandat noch fehlen — deshalb kurz nachfassen, und wenn
// GoCardless „ready_to_fulfil" meldet, die Erfüllung selbst anstoßen.
function mandatAusBillingRequest(br: any): string | null {
  return br?.links?.mandate_request_mandate ?? br?.mandate_request?.links?.mandate ?? br?.links?.mandate ?? null;
}

/** Mandat an der Person festschreiben und das GoCardless-Abo anlegen. */
async function mandatUebernehmen(ref: string, brId: string): Promise<"eingerichtet" | "abgebrochen" | "ausstehend" | "fehler"> {
  let br = (await gc(`/billing_requests/${brId}`)).billing_requests;
  let mandateId = mandatAusBillingRequest(br);
  for (let versuch = 0; !mandateId && versuch < 5; versuch++) {
    if (String(br?.status) === "cancelled") return "abgebrochen";
    if (String(br?.status) === "ready_to_fulfil") {
      await gc(`/billing_requests/${brId}/actions/fulfil`, { method: "POST", body: { data: {} } }).catch((e) =>
        console.warn(`[LASTSCHRIFT] ${ref}: fulfil ${brId}:`, String(e?.message || e).slice(0, 160)));
    }
    await new Promise((r) => setTimeout(r, 1500));
    br = (await gc(`/billing_requests/${brId}`)).billing_requests;
    mandateId = mandatAusBillingRequest(br);
  }
  if (!mandateId) {
    // Nicht abgebrochen, aber noch kein Mandat: Der Webhook (billing_requests
    // fulfilled) holt es nach — der Kunde sieht „in Arbeit", nicht „abgebrochen".
    console.warn(`[LASTSCHRIFT] ${ref}: Billing Request ${brId} noch ohne Mandat (Status ${br?.status}) — Webhook holt nach.`);
    return String(br?.status) === "pending" ? "abgebrochen" : "ausstehend";
  }
  return mandatSpeichern(ref, mandateId, br?.links?.customer || null);
}

/** Mandat + Kunde an der Person festschreiben, Abo anlegen — idempotent. */
async function mandatSpeichern(ref: string, mandateId: string, customerVorgabe: string | null): Promise<"eingerichtet" | "fehler"> {
  const mandat = (await gc(`/mandates/${mandateId}`)).mandates;
  const customerId = mandat?.links?.customer || customerVorgabe || null;
  const [a] = (await sqlPool`SELECT person_id, gc_mandate_ref FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
  if (!a?.person_id) return "fehler";
  const schonDieses = String(a.gc_mandate_ref || "") === String(mandateId);
  await sqlPool`UPDATE fiaon_persons SET gc_customer_ref = ${customerId}, gc_mandate_ref = ${mandateId},
    gc_mandate_status = ${String(mandat?.status || "pending_submission")}, updated_at = NOW() WHERE id = ${a.person_id}`;
  if (!schonDieses) {
    await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${ref}, ${a.person_id}, NULL, 'System', 'system', ${`Lastschrift-Mandat erteilt (GoCardless ${mandateId}, Status ${mandat?.status || "pending_submission"}).`})`.catch(() => {});
  }
  await gcAboAnlegen(ref, mandateId);
  return "eingerichtet";
}

/**
 * Ein Mandat, das ohne unsere Rückkehr entstand, über die Kunden-E-Mail an die
 * Person hängen (Webhook mandates.created, Abgleich). Bringt nur etwas, wenn
 * die Person noch kein lebendes Mandat hat — sonst bleibt das erste führend.
 */
async function mandatNachEmailVerknuepfen(mandateId: string): Promise<{ ref: string | null; grund: string }> {
  const [schon] = (await sqlPool`SELECT id FROM fiaon_persons WHERE gc_mandate_ref = ${mandateId} LIMIT 1`) as any[];
  if (schon) return { ref: null, grund: "schon verknüpft" };
  const mandat = (await gc(`/mandates/${mandateId}`)).mandates;
  if (["cancelled", "failed", "expired"].includes(String(mandat?.status))) return { ref: null, grund: `Mandat ${mandat?.status}` };
  const customerId = mandat?.links?.customer;
  if (!customerId) return { ref: null, grund: "kein Kunde am Mandat" };
  const kunde = (await gc(`/customers/${customerId}`)).customers;
  const email = String(kunde?.email || "").trim().toLowerCase();
  if (!email) return { ref: null, grund: "Kunde ohne E-Mail" };
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, p.gc_mandate_ref, p.gc_mandate_status
    FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.merged_into IS NULL AND a.payment_status = 'paid'
      AND (LOWER(a.email) = ${email} OR LOWER(p.primary_email) = ${email})
    ORDER BY a.created_at DESC LIMIT 1`) as any[];
  if (!a) return { ref: null, grund: `keine bezahlte Bestellung zu ${email}` };
  if (a.gc_mandate_ref && !["failed", "cancelled", "expired", ""].includes(String(a.gc_mandate_status || ""))) {
    return { ref: a.ref, grund: `Person hat schon Mandat ${a.gc_mandate_ref}` };
  }
  const erg = await mandatSpeichern(a.ref, mandateId, customerId);
  return { ref: a.ref, grund: erg };
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

// ═══════════════════════════════════════════════════════════════════════════
// DIE DOPPELBUCHUNGSFALLE (01.09.2026, E-072) — bitte vor jeder Änderung lesen
//
// Die Raten stehen NICHT alle zwölf im Voraus in `fiaon_abo_raten`. Sie werden
// nachgezogen: `rateBezahltBuchen` legt beim Buchen die Folgerate an. Gemessen
// am 01.09.2026 hatte der typische Kunde ZWEI Zeilen (eine bezahlt, eine
// offen), nicht zwölf. Von 409 bezahlten Abos hatte KEIN einziges
// „12 − bezahlt = offene Zeilen“.
//
// Das Abonnement rechnet dagegen im Vertrag: `12 − bezahlte` Einzüge. Beides
// ist für sich richtig. Zusammen wird es gefährlich, sobald eine überfällige
// Rate ZUSÄTZLICH einzeln eingezogen wird: Das Abo deckt bereits alle elf
// verbleibenden Vertragsraten ab, der Einzelabruf käme obendrauf — der Kunde
// zahlte zwölfmal für elf Raten.
//
// DESHALB die Aufteilung hier: Überfälliges wird einzeln und sofort abgerufen,
// das Abonnement deckt nur noch den REST. Die Summe bleibt exakt der Vertrag.
// Wer eine der beiden Zahlen ändert, muss die andere mitändern.
// ═══════════════════════════════════════════════════════════════════════════

/** Offene, nicht stornierte Raten, deren Fälligkeit in der Vergangenheit liegt. */
async function ueberfaelligeRaten(ref: string): Promise<{ id: number; betrag_cents: number; rate_nr: number; faellig_am: string }[]> {
  return (await sqlPool`
    SELECT id, betrag_cents, rate_nr, faellig_am
      FROM fiaon_abo_raten
     WHERE ref = ${ref} AND status = 'offen' AND storniert_am IS NULL
       AND faellig_am < CURRENT_DATE AND gc_payment_id IS NULL
     ORDER BY faellig_am ASC`) as any[];
}

/**
 * Überfällige Raten einzeln abrufen — gestaffelt, nie alles an einem Tag.
 *
 * Warum gestaffelt: 193 Kunden hatten am 01.09. überfällige Raten, einzelne bis
 * zu drei. Drei Abbuchungen an einem Tag bei Menschen mit knapper Kasse heißt
 * drei geplatzte Lastschriften, drei Gebühren und einen verlorenen Kunden.
 * Der erste Abruf startet nach `ERSTER_ABRUF_IN_TAGEN`, jeder weitere eine
 * Woche später — und die Einladungsmail sagt das vorher an.
 *
 * Die Idempotenz-Kennung hängt an der RATEN-ID: Ein zweiter Lauf über dieselbe
 * Rate erzeugt bei GoCardless keine zweite Zahlung, selbst wenn die Spalte
 * `gc_payment_id` noch nicht geschrieben war.
 */
const ERSTER_ABRUF_IN_TAGEN = 3;
const ABSTAND_ABRUFE_TAGE = 7;

export async function ueberfaelligesAbrufen(ref: string, mandateId: string): Promise<number> {
  const raten = await ueberfaelligeRaten(ref);
  let angelegt = 0;
  // Klassische Zählschleife statt .entries(): Das Ziel des Übersetzers ist
  // älter als ES2015, ein Iterator über Indexpaare wird dort nicht übersetzt.
  for (let i = 0; i < raten.length; i++) {
    const r = raten[i];
    const tag = new Date(Date.now() + (ERSTER_ABRUF_IN_TAGEN + i * ABSTAND_ABRUFE_TAGE) * 86400_000)
      .toISOString().slice(0, 10);
    try {
      const p = await gc("/payments", { method: "POST", idem: `rate-${r.id}`, body: { payments: {
        amount: Number(r.betrag_cents), currency: "EUR", charge_date: tag,
        description: `FIAON Rate ${r.rate_nr}`,
        metadata: { ref, rate_id: String(r.id) },
        links: { mandate: mandateId },
      } } });
      await sqlPool`UPDATE fiaon_abo_raten
        SET gc_payment_id = COALESCE(gc_payment_id, ${String(p?.payments?.id || "")}),
            lastschrift_status = 'eingereicht', lastschrift_am = NOW(), updated_at = NOW()
        WHERE id = ${r.id} AND status <> 'bezahlt'`;
      angelegt++;
    } catch (e) {
      // Ein fehlgeschlagener Abruf darf die übrigen nicht aufhalten und schon
      // gar nicht das Anlegen des Abonnements — das ist der wichtigere Teil.
      console.error(`[LASTSCHRIFT] Abruf Rate ${r.id} (${ref}):`, e);
    }
  }
  return angelegt;
}

/**
 * Das GoCardless-Abo anlegen — aus der Rückkehr UND aus der Verlängerung
 * (E-024). 12 Raten abzüglich der schon bezahlten in dieser Laufzeit UND
 * abzüglich der überfälligen, die einzeln abgerufen werden (siehe oben).
 */
export async function gcAboAnlegen(ref: string, mandateIdVorgabe?: string | null): Promise<boolean> {
  const [a] = (await sqlPool`SELECT a.pack_key, a.created_at, a.submitted_at, a.abo_verlaengert_raten, p.gc_mandate_ref, p.gc_mandate_status
    FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
  const mandateId = mandateIdVorgabe || a?.gc_mandate_ref || null;
  if (!a || !mandateId) return false;
  if (!mandateIdVorgabe && a.gc_mandate_status !== "active") return false;

  // ERST die überfälligen Raten abrufen, DANN das Abo um genau diese Zahl
  // kürzen. Die Reihenfolge ist Absicht: Was hier nicht angelegt wurde, darf
  // auch nicht abgezogen werden, sonst fehlt am Ende eine Rate.
  const einzeln = await ueberfaelligesAbrufen(ref, mandateId);

  {
    const pk = paketVon(a?.pack_key);
    const [gez] = (await sqlPool`SELECT COUNT(*)::int n FROM fiaon_abo_raten WHERE ref = ${ref} AND status = 'bezahlt'`) as any[];
    const laufzeitStart = Number(a.abo_verlaengert_raten || 0); // Raten der vorigen Laufzeiten
    const vertraglich = Math.max(0, 12 - Math.max(0, Number(gez?.n || 0) - laufzeitStart));
    const verbleibend = vertraglich - einzeln;
    if (verbleibend < 1) {
      // Alles Offene läuft bereits als Einzelabruf — ein Abo obendrauf wäre
      // genau die Doppelbuchung, die der Kasten oben beschreibt.
      console.log(`[LASTSCHRIFT] ${ref}: ${einzeln} Rate(n) einzeln abgerufen, kein Abo nötig.`);
      return einzeln > 0;
    }
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
  return einzeln > 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOFORTZAHLUNG PER BANK-APP — GoCardless Instant Bank Pay (02.09.2026, E-088)
//
// ── WARUM ─────────────────────────────────────────────────────────────────
// Justin, wörtlich: „Zahlungsmail so optimieren, dass sie die Überweisung
// einfach tätigen können — so innovativ wie möglich, damit es nicht lange
// dauert." Gemessen: 70 % aller Zahlungen fallen in die ersten drei Tage nach
// Antrag; jede Stunde Reibung kostet Abschlüsse. Das Wise-Konto ist gesperrt,
// jede fehlgetippte IBAN geht ins Leere. Der Kunde soll nichts abtippen:
// Knopf → Bank wählen → in der Banking-App bestätigen → Geld ist da → gebucht.
//
// ── WIE ───────────────────────────────────────────────────────────────────
// Ein signierter Link (gleiches Muster wie sepaLink) öffnet eine Billing
// Request mit `payment_request` (kein Mandat). Betrag, Art und Verwendungs-
// zweck kommen AUSSCHLIESSLICH aus zahlungsauftragFinden() — eine Quelle für
// Bestellung UND Rate (FIAON-XXXXXX bzw. FIAON-XXXXXX-N).
//
// ── DIE WEICHE `zweck` UND DIE BANKBUCH-ZEILE ─────────────────────────────
// Ein Payment kennt laut Doku KEINEN Link zurück zur Billing Request, und
// Metadaten sind auf drei Schlüssel begrenzt. Deshalb schreibt der Webhook
// beim Ereignis billing_requests.fulfilled eine Zeile in fiaon_bank_txns
// (txn_id „GC-<payment_id>", applied=false, Zweck in der Notiz) — und bucht
// erst bei payments.confirmed/paid_out über genau diese Zeile: Erstzahlung
// über alsBezahltBuchen, Rate über rateBezahltBuchen. Damit sehen
// Kontoabgleich, Bankbuch und der Rückhol-Bankschutz dieselbe Wahrheit,
// und `txn_id UNIQUE` + `applied` machen jede Buchung genau einmal.
// Sofortzahlungen dürfen NIE in die Raten-Zuordnung der Lastschrift laufen —
// der `zweck` ist die Weiche, und dieser Zweig steht davor.
// ═══════════════════════════════════════════════════════════════════════════
export function sofortSignatur(ref: string, exp: number): string {
  return createHmac("sha256", geheim()).update(`sofort.${ref}.${exp}`).digest("hex").slice(0, 32);
}
/**
 * Der Link aus Mail und Zahlungsseite — 21 Tage gültig. Synchron, weil der
 * Mail-Motor ihn beim Rendern braucht: Hier wird nur die Form geprüft; ob der
 * Auftrag noch offen ist, entscheidet der Klick (Weiterleitung mit Klartext).
 */
export function sofortLink(ref: string, ttlMs = 21 * 24 * 60 * 60 * 1000): string | null {
  const r = String(ref || "").trim().toUpperCase();
  if (!/^FIAON-[A-Z0-9]{4,12}(-\d{1,2})?$/.test(r)) return null;
  const exp = Date.now() + ttlMs;
  return absoluteUrl(`/api/fiaon/zahlung/sofort/${encodeURIComponent(`${r}.${exp}.${sofortSignatur(r, exp)}`)}`);
}
export function sofortPruefen(token: string): { ref: string; gueltig: boolean } | null {
  const teile = String(token || "").split(".");
  if (teile.length < 3) return null;
  const sig = teile.pop()!; const exp = Number(teile.pop()); const ref = teile.join(".");
  if (!ref || !exp || sofortSignatur(ref, exp) !== sig) return null;
  return { ref, gueltig: exp >= Date.now() };
}

/** Billing Request mit payment_request anlegen — Instant zuerst, sonst Standard-Überweisung. */
async function sofortAnlegen(z: Awaited<ReturnType<typeof zahlungsauftragFinden>> & object, rateId: number | null, tag: string): Promise<{ brId: string; url: string }> {
  const cents = Math.round(Number(z.amountDue) * 100);
  const beschreibung = `FIAON ${String(z.packName || "").split("\n")[0]} ${z.paymentReference}`.slice(0, 100);
  const metadata: Record<string, string> = { ref: z.paymentReference, zweck: z.art === "rate" ? "rate" : "erstzahlung", rate_id: rateId ? String(rateId) : "" };
  const [app] = (await sqlPool`
    SELECT first_name, last_name, email, street, zip, city, country
      FROM fiaon_applications WHERE payment_reference = ${z.paymentReference} AND merged_into IS NULL LIMIT 1`) as any[];
  const anlegen = async (scheme: string, idem: string) => (await gc("/billing_requests", { method: "POST", idem, body: {
    billing_requests: { payment_request: { amount: cents, currency: "EUR", description: beschreibung, scheme, metadata }, metadata } } })).billing_requests;
  let br: any;
  try {
    br = await anlegen("sepa_instant_credit_transfer", `sofort-${z.paymentReference}-${tag}`);
  } catch (e: any) {
    // Rückfall auf die normale SEPA-Überweisung, falls Instant für diese Bank
    // oder dieses Konto nicht angeboten wird — der Kunde merkt keinen Unterschied
    // außer ein paar Stunden bis zur Gutschrift.
    if (!/scheme|instant/i.test(String(e?.message || ""))) throw e;
    br = await anlegen("sepa_credit_transfer", `sofort-${z.paymentReference}-${tag}-sct`);
  }
  const flow = (await gc("/billing_request_flows", { method: "POST", body: { billing_request_flows: {
    redirect_uri: absoluteUrl(`/api/fiaon/zahlung/sofort/zurueck/${encodeURIComponent(z.paymentReference)}?br=${br.id}`),
    exit_uri: absoluteUrl(`/zahlung/${encodeURIComponent(z.paymentReference)}?sofort=abgebrochen`),
    prefilled_customer: {
      given_name: app?.first_name || z.firstName || undefined, family_name: app?.last_name || undefined,
      email: app?.email || undefined, address_line1: app?.street || undefined, postal_code: app?.zip || undefined,
      city: app?.city || undefined, country_code: (String(app?.country || "").length === 2 ? String(app.country).toUpperCase() : undefined),
    },
    links: { billing_request: br.id },
  } } })).billing_request_flows;
  return { brId: br.id, url: flow.authorisation_url };
}

/** GET /zahlung/sofort/:token — Bank wählen, in der App bestätigen. Ohne Anmeldung. */
router.get("/zahlung/sofort/:token", async (req: Request, res: Response) => {
  const t = sofortPruefen(String(req.params.token || ""));
  const heim = (ref: string, q: string) => res.redirect(`/zahlung/${encodeURIComponent(ref)}?sofort=${q}`);
  if (!t) return res.redirect("/zahlung?sofort=fehler");
  if (!t.gueltig) return heim(t.ref, "abgelaufen");
  try {
    const z = await zahlungsauftragFinden(t.ref);
    if (!z) return heim(t.ref, "fehler");
    if (z.status === "paid") return heim(z.paymentReference, "bereits");
    if (z.status === "cancelled" || !(Number(z.amountDue) > 0)) return heim(z.paymentReference, "fehler");
    let rateId: number | null = null;
    if (z.art === "rate") {
      const [r] = (await sqlPool`SELECT id FROM fiaon_abo_raten WHERE UPPER(zahlungsreferenz) = ${z.paymentReference} AND status = 'offen' ORDER BY id DESC LIMIT 1`) as any[];
      if (!r) return heim(z.paymentReference, "bereits");
      rateId = Number(r.id);
    }
    const tag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const { url } = await sofortAnlegen(z, rateId, tag);
    return res.redirect(url);
  } catch (err) {
    console.error("[SOFORT] start:", err);
    return heim(t.ref, "fehler");
  }
});

/** GET /zahlung/sofort/zurueck/:ref — zurück von der Bank. Buchung macht der Webhook, hier nur Anzeige. */
router.get("/zahlung/sofort/zurueck/:ref", async (req: Request, res: Response) => {
  const ref = String(req.params.ref || "").toUpperCase();
  const heim = (q: string) => res.redirect(`/zahlung/${encodeURIComponent(ref)}?sofort=${q}`);
  try {
    const brId = String(req.query.br || "");
    if (!brId) return heim("fehler");
    const br = (await gc(`/billing_requests/${brId}`)).billing_requests;
    if (br?.status === "fulfilled") return heim("erfolg");
    if (br?.status === "cancelled") return heim("abgebrochen");
    return heim("ausstehend");
  } catch (err) {
    console.error("[SOFORT] zurueck:", err);
    return heim("fehler");
  }
});

/** Die Bankbuch-Zeile zur Sofortzahlung — genau einmal je GoCardless-Payment. */
async function sofortZeileAnlegen(paymentId: string, ref: string, cents: number, zweck: string, rateId: string, payerName: string | null): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_bank_txns (txn_id, booked_at, amount_cents, currency, payer_name, reference_raw, extracted_ref, matched_ref, match_status, amount_ok, applied, note)
    VALUES (${`GC-${paymentId}`}, NULL, ${cents}, 'EUR', ${payerName}, ${ref}, ${ref}, ${ref}, 'matched', TRUE, FALSE,
            ${`GoCardless Sofortzahlung · zweck=${zweck} · rate_id=${rateId || "-"}`})
    ON CONFLICT (txn_id) DO NOTHING`;
}

/**
 * Eine bestätigte Sofortzahlung buchen. Liefert true, wenn das Payment eine
 * Sofortzahlung war (egal ob jetzt gebucht oder schon vorher) — dann darf die
 * Raten-Zuordnung der Lastschrift NICHT mehr greifen.
 */
async function sofortZahlungBuchen(p: any, action: string): Promise<boolean> {
  const md = p?.metadata || {};
  let zweck: string | null = md.zweck || null; let ref: string | null = md.ref || null; let rateId: string = md.rate_id || "";
  const [zeile] = (await sqlPool`SELECT note, matched_ref, applied FROM fiaon_bank_txns WHERE txn_id = ${`GC-${p?.id}`} LIMIT 1`) as any[];
  if (!zweck && zeile?.note) {
    const m = /zweck=(\w+)/.exec(zeile.note); const r = /rate_id=([\d-]+)/.exec(zeile.note);
    zweck = m?.[1] || null; ref = zeile.matched_ref || ref; rateId = r?.[1] && r[1] !== "-" ? r[1] : "";
  }
  // ── HÄRTUNG (02.09.2026, Hinweis fiaon-17): Ging das fulfilled-Ereignis
  // verloren UND kopiert GoCardless die Metadaten nicht aufs Payment, kennt
  // dieser Zweig weder Zweck noch Referenz — das Payment fiele in die alte
  // Warnung „ohne Referenz“ und bliebe ungebucht. Ein Payment trägt laut Doku
  // keinen Link zur Billing Request, aber die Billing Request trägt den Link
  // zum Payment: Wir suchen sie rückwärts in den jüngsten Requests.
  if ((!zweck || !ref) && p?.id && !p?.links?.subscription) {
    try {
      const liste = (await gc("/billing_requests?limit=100")).billing_requests || [];
      const br = liste.find((b: any) => b?.links?.payment_request_payment === p.id);
      const md = br?.payment_request?.metadata || br?.metadata || {};
      if (br && md.ref) {
        zweck = zweck || md.zweck || "erstzahlung"; ref = ref || md.ref; rateId = rateId || md.rate_id || "";
        console.log(`[SOFORT] Payment ${p.id} über Billing Request ${br.id} zugeordnet (${zweck} ${ref}).`);
      }
    } catch (e) {
      console.warn("[SOFORT] Rückwärtssuche Billing Request:", (e as any)?.message || e);
    }
  }
  if (!zweck || !ref) return false;
  if (!["confirmed", "paid_out"].includes(action)) {
    if (["failed", "cancelled", "customer_approval_denied", "charged_back"].includes(action)) {
      await sqlPool`UPDATE fiaon_bank_txns SET match_status = 'ignored', note = CONCAT_WS(' · ', note, ${`GoCardless ${action}`}), updated_at = NOW()
        WHERE txn_id = ${`GC-${p.id}`} AND applied = FALSE`.catch(() => {});
    }
    return true;
  }
  const tag = String(p?.charge_date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const cents = Number(p?.amount || 0);
  await sofortZeileAnlegen(String(p.id), ref, cents, zweck, rateId, null);
  // Genau einmal: Wer die Zeile von applied=false auf true dreht, bucht.
  const [gedreht] = (await sqlPool`UPDATE fiaon_bank_txns SET applied = TRUE, applied_at = NOW(), booked_at = ${tag}::date, updated_at = NOW()
    WHERE txn_id = ${`GC-${p.id}`} AND applied = FALSE RETURNING txn_id`) as any[];
  if (!gedreht) return true; // schon gebucht (Webhook-Wiederholung)
  try {
    if (zweck === "rate" && rateId) {
      await rateBezahltBuchen({ rateId: Number(rateId), zahlungsdatum: tag, quelle: "gocardless", notiz: `GoCardless Sofortzahlung ${p.id}`, gcPaymentId: String(p.id) });
    } else {
      const { alsBezahltBuchen } = await import("./fiaon-antrag");
      const erg = await alsBezahltBuchen(ref, { zahlungsdatum: tag, quelle: "gocardless_sofort" });
      // 404 heißt hier „keine offene Bestellung mehr“ — sie ist schon bezahlt
      // (alsBezahltBuchen trifft nur pending_payment/claimed_paid). Das ist kein
      // Fehler, sondern die zweite Bestätigung derselben Zahlung.
      if (!erg.ok && erg.status !== 404) throw new Error(erg.error);
      if (!erg.ok) console.log(`[SOFORT] ${ref} war bereits bezahlt — Zahlung ${p.id} nur im Bankbuch vermerkt.`);
    }
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      SELECT a.ref, NULL, 'System', 'system', ${`Sofortzahlung per Bank-App eingegangen: ${(cents / 100).toFixed(2).replace(".", ",")} € (GoCardless ${p.id}).`}
        FROM fiaon_applications a WHERE a.payment_reference = ${ref} AND a.merged_into IS NULL LIMIT 1`.catch(() => {});
    console.log(`[SOFORT] gebucht ${zweck} ${ref} ${cents} ct (${p.id})`);
  } catch (e) {
    await sqlPool`UPDATE fiaon_bank_txns SET applied = FALSE, applied_at = NULL, note = CONCAT_WS(' · ', note, ${"Buchung fehlgeschlagen: " + String((e as any)?.message || e).slice(0, 120)}), updated_at = NOW()
      WHERE txn_id = ${`GC-${p.id}`}`.catch(() => {});
    console.error("[SOFORT] Buchung:", e);
  }
  return true;
}

/** POST /gocardless/webhook — Mandats- und Zahlungsstatus. Signatur: HMAC-SHA256 mit GOCARDLESS_WEBHOOK_SECRET. */
/**
 * POST /admin/lastschrift/abgleich {schreiben:false} — alle lebenden Mandate
 * bei GoCardless gegen die Datenbank halten und Verwaiste über die
 * Kunden-E-Mail an die Person hängen (02.09.2026). Ohne `schreiben` nur zählen.
 */
router.post("/admin/lastschrift/abgleich", async (req: Request, res: Response) => {
  try {
    const schreiben = req.body?.schreiben === true;
    const mandate: any[] = [];
    let after: string | null = null;
    for (let seite = 0; seite < 20; seite++) {
      const j = await gc(`/mandates?limit=100${after ? `&after=${encodeURIComponent(after)}` : ""}`);
      mandate.push(...(j?.mandates || []));
      after = j?.meta?.cursors?.after || null;
      if (!after) break;
    }
    const lebend = mandate.filter((m) => !["cancelled", "failed", "expired"].includes(String(m.status)));
    const bekannt = new Set(((await sqlPool`SELECT gc_mandate_ref FROM fiaon_persons WHERE gc_mandate_ref IS NOT NULL`) as any[]).map((r) => String(r.gc_mandate_ref)));
    const verwaist = lebend.filter((m) => !bekannt.has(String(m.id)));
    const ergebnisse: any[] = [];
    if (schreiben) {
      for (const m of verwaist) {
        try { ergebnisse.push({ mandat: m.id, status: m.status, ...(await mandatNachEmailVerknuepfen(String(m.id))) }); }
        catch (e: any) { ergebnisse.push({ mandat: m.id, status: m.status, ref: null, grund: String(e?.message || e).slice(0, 160) }); }
      }
    }
    res.json({ ok: true, schreiben, gesamt: mandate.length, lebend: lebend.length, bekannt: bekannt.size, verwaist: verwaist.map((m) => ({ id: m.id, status: m.status, erstellt: m.created_at })), ergebnisse });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: String(e?.message || e).slice(0, 300) });
  }
});

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
      // 02.09.2026: Die Erfüllung eines Billing Requests ist der verlässliche
      // Moment, an dem das Mandat existiert — unabhängig davon, ob der Kunde
      // je zu uns zurückkam (Rückkehr abgebrochen, Cookie weg, Tab zu).
      // ── SOFORTZAHLUNG: Billing Request MIT payment_request (kein Mandat) ────
      if (ev.resource_type === "billing_requests" && ev.action === "fulfilled" && ev.links?.billing_request) {
        const brS = (await gc(`/billing_requests/${ev.links.billing_request}`)).billing_requests;
        if (brS?.payment_request) {
          const payId = brS.links?.payment_request_payment || null;
          const md = brS.payment_request.metadata || brS.metadata || {};
          if (payId && md.ref) {
            await sofortZeileAnlegen(String(payId), String(md.ref), Number(brS.payment_request.amount || 0), String(md.zweck || "erstzahlung"), String(md.rate_id || ""), null).catch((e) => console.error("[SOFORT] Zeile:", e));
          }
          continue;
        }
      }
      if (ev.resource_type === "billing_requests" && ev.action === "fulfilled" && ev.links?.billing_request) {
        try {
          const br = (await gc(`/billing_requests/${ev.links.billing_request}`)).billing_requests;
          const ref = String(br?.metadata?.ref || "");
          const mandateId = mandatAusBillingRequest(br);
          if (ref && mandateId) await mandatSpeichern(ref, mandateId, br?.links?.customer || null);
          else if (mandateId) await mandatNachEmailVerknuepfen(mandateId);
        } catch (e: any) { console.error("[LASTSCHRIFT] Webhook billing_request:", String(e?.message || e).slice(0, 200)); }
      }
      if (ev.resource_type === "mandates" && ev.action === "created" && ev.links?.mandate) {
        mandatNachEmailVerknuepfen(String(ev.links.mandate))
          .then((r) => { if (r.ref) console.log(`[LASTSCHRIFT] Mandat ${ev.links.mandate} → ${r.ref}: ${r.grund}`); })
          .catch((e) => console.error("[LASTSCHRIFT] Webhook mandate created:", String(e?.message || e).slice(0, 200)));
      }
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
        // Sofortzahlungen zuerst — sie tragen zweck/ref in den Metadaten oder eine
        // Bankbuch-Zeile GC-<id>; sie dürfen nie als Abo-Rate verbucht werden.
        if (await sofortZahlungBuchen(p, String(ev.action || ""))) continue;
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

// Der Mail-Motor und die Zahlungsseite holen sich den Sofort-Link über den
// Steckplatz in fiaon-zahlungsauftrag.ts — ohne Kreisimport.
registriereSofortLink(sofortLink);

export default router;
