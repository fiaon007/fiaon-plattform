import { Router } from "express";
import { db } from "../db";
import { fiaonApplications, fiaonClickEvents } from "@shared/schema";
import { PAKET_PREISE_EURO, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";
import { eq } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { ZipArchive } from "archiver";
import postgres from "postgres";
import { sqlPool } from "../lib/db-pool";
import { antragsSpaltenOhneAnhaenge } from "../lib/fiaon-antrag-spalten";
// Die zwei Reinigungen — eine Definition, ein Ort (siehe AGENTS.md).
import { paketNameEinzeilig } from "../../shared/fiaon-paketname";
import { nameSauber } from "../../shared/fiaon-namen";
import multer from "multer";
import { randomBytes, createHash } from "crypto";
import { sendMakeWebhook, makePayloadFromRow } from "../make-webhook";
import { ensureInvoiceNumber, renderInvoicePdf, signInvoiceUrl, verifyInvoiceSig } from "../fiaon-invoice";
import { absoluteUrl } from "../fiaon-base-url";
import { normalizePhone } from "./fiaon-agent";
import { verifyNumberToken, markNumberUpdated } from "../fiaon-number-update";
// P1-C Dauerschutz: jede neue Antragszeile ist eine BESTELLUNG an einer Person,
// kein neuer Mensch. Ohne diese Bindung entstehen wieder ~90 Zeilen pro Tag ohne
// Zuordnung (gemessen: scripts/person-nachlauf.ts).
import { bindePersonAnAntrag } from "../fiaon-person-model";
import {
  LOGIN_ACCESS_STATUSES,
  LOGIN_CODES,
  decideLogin,
  maskEmailForLog,
  pickAccountRow,
  storedPasswordOf,
  birthdateKey,
} from "../fiaon-login-logic";

const router = Router();

// In-memory store for identity-verify tokens (15 min TTL)
const verifyTokens = new Map<string, { ref: string; expiresAt: number }>();
setInterval(() => {
  const now = Date.now();
  verifyTokens.forEach((v, k) => { if (v.expiresAt < now) verifyTokens.delete(k); });
}, 60_000);

// Configure multer for KYC document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max per file
  },
  // 27.08.2026: Nahm bis heute AUSSCHLIESSLICH PDF an — der Kundenbereich
  // verspricht daneben „PDF, JPG oder PNG, ein Handyfoto genügt". Jedes Foto
  // scheiterte, und zwar mit einer englischen Meldung in einer deutschen
  // Oberfläche. Bilder werden jetzt angenommen und vor dem Speichern in ein
  // PDF gelegt (server/lib/fiaon-bild-zu-pdf.ts), damit alles Nachgelagerte
  // weiterhin ein PDF vorfindet.
  fileFilter: (req, file, cb) => {
    const art = String(file.mimetype || "").toLowerCase();
    if (art === "application/pdf" || art === "image/jpeg" || art === "image/jpg" || art === "image/png") {
      cb(null, true);
    } else if (art === "image/heic" || art === "image/heif") {
      // iPhone-Standardformat. Es lässt sich hier nicht einbetten, deshalb ein
      // Rat statt einer Fehlermeldung: Der Weg über „Teilen → Als PDF sichern"
      // dauert zehn Sekunden und ist besser als ein Kunde, der aufgibt.
      cb(new Error("Dieses Foto liegt im iPhone-Format HEIC vor. Bitte öffnen Sie es in der Fotos-App, tippen auf Teilen und wählen „Drucken\u201c \u2013 dort erzeugt „Als PDF sichern\u201c eine Datei, die wir lesen können. Oder stellen Sie in den iPhone-Einstellungen unter Kamera → Formate auf „Maximale Kompatibilität\u201c um."));
    } else {
      cb(new Error("Wir können PDF-Dateien sowie Fotos im Format JPG oder PNG lesen. Bitte laden Sie Ihre Unterlage in einem dieser Formate hoch."));
    }
  },
});

// Create a single postgres connection pool for direct SQL queries

// ═══════════════════════════════════════════════════════════════════
// ZAHLUNG PER BANKÜBERWEISUNG (VORKASSE) — ersetzt Stripe komplett
// Siehe MIGRATION_INVENTORY.md
// ═══════════════════════════════════════════════════════════════════

export const FIAON_BANK_DETAILS = {
  recipient: "Fiaon Ltd",
  iban: "BE09905892763957",
  ibanDisplay: "BE09 9058 9276 3957",
  bic: "TRWIBEB1XXX",
};

// Serverseitige Preisliste — Beträge werden NIE vom Client übernommen.
//
// Seit dem 16.08.2026 steht sie nicht mehr hier, sondern in
// `shared/fiaon-pakete.ts`. Es gab zwei Listen mit vertauschten Preisen für
// Ultra und High End: Der Kunde kaufte für 79,99 € und bekam Rechnungen über
// 99,99 €. Zwei Preislisten sind schlimmer als eine falsche — bei einer
// falschen merkt man es.
const PACK_PRICES: Record<string, number> = PAKET_PREISE_EURO;
const SCHUFA_PRICE = SCHUFA_PREIS_EURO;
const PAYMENT_DUE_DAYS = 7;

// ── #20: Kanonische Paket-Kreditlimits (Headline „bis zu X €", identisch zu den
// PACKS/BUSINESS_PACKS im Frontend). Quelle der Wahrheit fürs Portal, falls das
// pro-Antrag berechnete `approved_limit` fehlt oder auf den Funnel-Mindestwert
// (250 €) geklemmt wurde (Bug: Ultra-Kunde sah 250 € statt 15.000 €).
export const PACK_LIMITS: Record<string, number> = {
  start: 500, pro: 5000, ultra: 15000, highend: 25000,
  business_starter: 5000, business_pro: 25000, business_ultra: 75000, business_enterprise: 250000,
};
// Untergrenze, ab der ein berechnetes approved_limit als „echt personalisiert"
// gilt. Der Funnel klemmt auf min. 250 € — genau dieser Wert (und null/0) ist das
// Bug-Signal „nie ein echtes Limit vergeben".
const FUNNEL_LIMIT_FLOOR = 250;

/** Anzuzeigendes Kreditlimit fürs Kundenportal: das personalisierte
 * `approved_limit`, sofern es > Funnel-Floor ist; sonst das Paket-Headline-Limit.
 * Verändert NICHTS in der DB — reine Anzeige-Ableitung (kein Geld-/Provisionsbezug). */
export function effectiveLimit(packKey: string | null | undefined, approvedLimit: any): number | null {
  const n = Number(approvedLimit);
  if (Number.isFinite(n) && n > FUNNEL_LIMIT_FLOOR) return n;
  const packLimit = packKey ? PACK_LIMITS[packKey] : undefined;
  if (packLimit != null) return packLimit;
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Zeichensatz ohne verwechselbare Zeichen: keine 0, 1, O, I, L
const PAYMENT_REF_CHARSET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomPaymentCode(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += PAYMENT_REF_CHARSET[bytes[i] % PAYMENT_REF_CHARSET.length];
  return out;
}

/**
 * Ein Verwendungszweck — aus der EINEN Quelle.
 *
 * Vorher stand die Erzeugung hier: würfeln, Tabelle fragen, hoffen. Seit dem
 * 08.08.2026 liegt sie in der Datenbank (`fiaon_verwendungszweck_neu()`, siehe
 * db/migrations/037) und wird von einem BEFORE-INSERT-Trigger benutzt. Damit
 * bekommt JEDE Bestellung eine Referenz — auch die aus einem Import oder einem
 * `INSERT` von Hand, an die hier niemand denken kann.
 *
 * Diese Funktion bleibt als benannter Weg für den Anwendungscode bestehen.
 */
async function generateUniquePaymentReference(): Promise<string> {
  const { neuerVerwendungszweck } = await import("../lib/fiaon-verwendungszweck");
  return await neuerVerwendungszweck(sqlPool);
}

// Auto-Migration der neuen Zahlungsspalten (idempotent)
let paymentColumnsEnsured = false;
async function ensurePaymentColumns(): Promise<void> {
  if (paymentColumnsEnsured) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS payment_reference VARCHAR,
    ADD COLUMN IF NOT EXISTS payment_due_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS amount_due NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS currency VARCHAR DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS reminder_sent_at_24h TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_sent_at_72h TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claimed_paid_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS welcome_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS payment_email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS followup_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS merged_into VARCHAR,
    ADD COLUMN IF NOT EXISTS promised_pay_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS agent_email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS invoice_number VARCHAR,
    ADD COLUMN IF NOT EXISTS invoice_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS claim_email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS confirmed_email_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS account_status VARCHAR DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS access_backfilled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS superseded_by VARCHAR,
    ADD COLUMN IF NOT EXISTS allow_reminders_despite_paid BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS gdpr_deleted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS dismissed_by INTEGER,
    ADD COLUMN IF NOT EXISTS dismissed_reason VARCHAR,
    ADD COLUMN IF NOT EXISTS number_corrected_at TIMESTAMPTZ,
    -- Archiv (Teil 3): die „Lösch"-Funktion, die keine ist. Eine archivierte
    -- Bestellung verschwindet aus Arbeitslisten und bleibt in der Akte lesbar.
    -- Doppelt zu db/migrations/034 — die Spalten müssen auch dann existieren,
    -- wenn der Prozess vor dem Migrationslauf hochkommt (wie bei allen
    -- Zahlungsspalten hier).
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS archived_reason TEXT,
    ADD COLUMN IF NOT EXISTS archived_note TEXT,
    ADD COLUMN IF NOT EXISTS archived_by TEXT,
    ADD COLUMN IF NOT EXISTS archived_by_agent_id INTEGER;
  `;
  await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_app_invoice_no_idx ON fiaon_applications(invoice_number)`;
  await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_app_payment_ref_idx ON fiaon_applications(payment_reference)`;
  paymentColumnsEnsured = true;
  console.log("[FIAON-PAYMENT] Zahlungsspalten sichergestellt");
  // Paket Y: Einmalige rückwirkende Freischaltung bereits bezahlter Kunden (idempotent).
  backfillPaidAccessOnce().catch((e) => console.error("[FIAON-ACCESS-BACKFILL] Startlauf fehlgeschlagen:", e));
}

// Hinweis: LOGIN_ACCESS_STATUSES (Zugangs-Gate) liegt jetzt in
// ../fiaon-login-logic — dort, wo auch die Login-Entscheidung getestet wird.

/**
 * Rückwirkende Reparatur (Paket Y): schaltet alle BEZAHLTEN Bestellungen frei,
 * deren Konto (durch den früheren Bug) nie aktiviert wurde — OHNE erneute
 * payment_confirmed-Mails. Idempotent über `access_backfilled_at IS NULL`.
 * Suspendierte Konten werden NICHT reaktiviert.
 */
async function backfillPaidAccess(): Promise<{ count: number; refs: string[] }> {
  const rows = await sqlPool`
    UPDATE fiaon_applications SET
      status = CASE WHEN status IN ('completed','documents_submitted','payment_completed')
                    THEN status ELSE 'payment_completed' END,
      account_status = CASE WHEN account_status = 'suspended' THEN account_status ELSE 'active' END,
      access_backfilled_at = NOW(),
      updated_at = NOW()
    WHERE payment_status = 'paid'
      AND merged_into IS NULL
      AND access_backfilled_at IS NULL
      AND (
        status NOT IN ('completed','documents_submitted','payment_completed')
        OR (account_status IS DISTINCT FROM 'active' AND account_status IS DISTINCT FROM 'suspended')
      )
    RETURNING ref
  `;
  return { count: rows.length, refs: rows.map((r) => r.ref) };
}

let accessBackfillDone = false;
async function backfillPaidAccessOnce(): Promise<void> {
  if (accessBackfillDone) return;
  accessBackfillDone = true;
  const result = await backfillPaidAccess();
  if (result.count > 0) {
    console.log(`[FIAON-ACCESS-BACKFILL] ${result.count} bezahlte Kunden nachträglich freigeschaltet (keine Mails): ${result.refs.join(", ")}`);
  } else {
    console.log("[FIAON-ACCESS-BACKFILL] Keine offenen Altfälle — nichts zu tun");
  }
}

// ── Paket AD1: Dubletten-Automatik beim Bezahlt-Markieren ───────────────────
// Wird eine Bestellung `paid`, werden ALLE anderen offenen Bestellungen
// (pending_payment/claimed_paid) derselben E-Mail-Adresse (case-insensitive)
// auf `superseded` gesetzt: kein Reminder mehr, raus aus Agent-Listen und
// Offen-Kacheln. Timeline-Eintrag verweist auf die bezahlte Referenz.
// superseded erzeugt KEINE Provision (onCustomerPaid läuft nur für die bezahlte ref).
//
// Paket DA/DB (Root-Cause-Fix „verschwundene Kunden"): War die BEZAHLTE
// Bestellung unzugewiesen, eine geschlossene Schwester aber einem Agent
// zugewiesen (er hat den Kunden betreut), wird `assigned_agent_id` auf die
// bezahlte Bestellung ÜBERTRAGEN. Der Agent behält damit die Sichtbarkeit
// (Gesamtbestand „Bezahlt") und die Attribution — ohne dass hier automatisch
// Provision gebucht wird (bewusst: Provision nur über mark-paid-Hook oder
// manuelle Admin-Buchung, siehe /admin/agents/:id/commissions/manual).
//
// ── UMSTELLUNG 08.08.2026: DIE PERSON IST DER SCHLÜSSEL, NICHT DIE E-MAIL ────
// Der Abgleich lief über `LOWER(TRIM(email))`. Das war die beste verfügbare
// Näherung, bevor es ein Personenmodell gab — und sie ist zweifach falsch:
//
//   ZU BREIT: Eine E-Mail kann zwei Menschen tragen. Im Bestand lief ein Antrag
//   unter „Magdalena" und gehörte zu Konstantinos Nikoloudis. Über die E-Mail
//   hätte eine Zahlung des einen die offene Bestellung des anderen stillgelegt.
//
//   ZU SCHMAL: Derselbe Mensch bestellt beim zweiten Mal mit einer anderen
//   Adresse. Dann blieben zwei offene Paketbestellungen stehen, der Kunde bekam
//   zwei Rechnungen, und im Bestand liegen 9 Personen mit genau diesem Zustand.
//
// Seit Teil A gibt es die Person (`person_id`) und den verlustfreien Merge. Der
// Schlüssel ist ab jetzt die Person; die E-Mail bleibt nur als Rückfall für
// Zeilen ohne Person (Altbestand, Funnel-Abbrecher).
export async function supersedeSisterOrders(paidRef: string): Promise<{ count: number; refs: string[] }> {
  const paid = await sqlPool`
    SELECT ref, payment_reference, email, assigned_agent_id, pack_name, type, person_id,
           payment_status
    FROM fiaon_applications WHERE ref = ${paidRef}
  `;
  if (paid.length === 0) return { count: 0, refs: [] };
  const personId = paid[0].person_id != null ? Number(paid[0].person_id) : null;
  const em = paid[0].email ? String(paid[0].email).trim().toLowerCase() : null;
  // Ohne Person UND ohne E-Mail gibt es keinen belastbaren Schlüssel. Dann wird
  // nichts stillgelegt — lieber eine Dublette als eine fremde Bestellung töten.
  if (personId == null && !em) return { count: 0, refs: [] };

  // ── KATEGORIEGRENZE (Korrektur 03.08.2026) ───────────────────────────────
  // Es gibt zwei Arten von Bestellungen, und nur INNERHALB einer Art kann eine
  // Dublette entstehen:
  //
  //   Stufenpaket   Starter/Pro/Ultra/High End/Business — ein Konto hat GENAU
  //                 eine Stufe. Bezahlt der Kunde Ultra, ist seine offene
  //                 Pro-Bestellung erledigt (Upgrade). Stilllegen ist richtig.
  //   Zusatzprodukt Bonitätsauskunft (74 €, `type='schufa'`) — unabhängig vom
  //                 Konto. Der Verkaufsweg macht das zwingend: Der Kunde
  //                 bezahlt zuerst die Aktivierung, erhält Kontozugriff und
  //                 sieht ERST DANN im Dashboard den Upsell. Diese Bestellung
  //                 ist immer ein Zweitprodukt — niemals eine Dublette.
  //
  // Vorher fehlte diese Grenze ganz: JEDE offene Bestellung derselben E-Mail
  // starb, protokolliert als „Dublette, gleiche E-Mail". Betroffen waren 12
  // lebende Bestellungen — 8 davon fälschlich, 583,98 € offener Umsatz bei
  // genau den kaufwilligsten Bestandskunden. Es traf beide Richtungen: eine
  // Bonitätszahlung von 74 € tötete auch schon eine Ultra-Bestellung zu 79,99 €.
  //
  // Die Kategorie kommt aus `type`/`ref`-Präfix, NICHT aus `pack_name`: derselbe
  // Tarif existiert im Bestand unter zwei Schreibweisen („FIAON Pro" und
  // „FIAON Pro | (Standard)"), ein Namensvergleich würde echte Dubletten
  // übersehen. `type='schufa'` ist die Marke, die die Bestellanlage selbst setzt
  // (siehe POST /payment-order) und die `isAddonOrderRow` bereits auswertet.
  const istZusatzprodukt =
    String(paid[0].type || "").toLowerCase() === "schufa" || String(paid[0].ref || "").startsWith("FIAON-SCHUFA-");
  const kategorie = istZusatzprodukt ? "Zusatzprodukt (Bonitätsauskunft)" : "Stufenpaket (Kontoaktivierung)";
  // Der Auslöser steht im Protokoll, wie er ist: Beim Aufruf aus /payment-order
  // ist die Bestellung noch NICHT bezahlt, und „durch bezahlte Bestellung
  // ersetzt" wäre dort eine falsche Auskunft in der Kundenakte.
  const anlass = String(paid[0].payment_status || "") === "paid"
    ? "bezahlte Bestellung"
    : "neuere Bestellung";

  // ── ZEIGER-PRÜFUNG ───────────────────────────────────────────────────────
  // `superseded_by` speicherte bevorzugt die kurze payment_reference. Ändert
  // sie sich später oder verschwindet die Bestellung, zeigt der Zeiger ins
  // Leere — genau so entstanden zwei Phantom-Fälle, bei denen niemand mehr
  // nachvollziehen konnte, wodurch eine Bestellung ersetzt wurde.
  // Deshalb: Zeiger nur verwenden, wenn er auch zurückführt. Sonst die `ref`,
  // die als Primärschlüssel immer auflösbar ist.
  const zeigerKandidat = paid[0].payment_reference || paid[0].ref;
  const [zeigerOk] = await sqlPool`
    SELECT 1 AS treffer FROM fiaon_applications
    WHERE payment_reference = ${zeigerKandidat} OR ref = ${zeigerKandidat}
    LIMIT 1
  `;
  const zeiger = zeigerOk ? zeigerKandidat : paid[0].ref;
  if (!zeigerOk) {
    console.warn(`[FIAON-DUBLETTE] ${paidRef}: Zeiger „${zeigerKandidat}" ist nicht auflösbar → es wird die ref gespeichert`);
  }

  const rows = await sqlPool`
    UPDATE fiaon_applications SET
      payment_status = 'superseded',
      superseded_by = ${zeiger},
      updated_at = NOW()
    WHERE ref != ${paidRef}
      AND merged_into IS NULL
      AND archived_at IS NULL
      AND payment_status IN ('pending_payment', 'claimed_paid')
      -- DERSELBE MENSCH: über die Person, wenn es eine gibt. Die E-Mail greift
      -- nur, wenn KEINE Person am bezahlten Antrag hängt (Altbestand) — dann ist
      -- sie das Einzige, was wir haben.
      AND (
        (${personId}::int IS NOT NULL AND person_id = ${personId}::int)
        OR (${personId}::int IS NULL AND ${em}::text IS NOT NULL
            AND person_id IS NULL AND LOWER(TRIM(email)) = ${em}::text)
      )
      -- Nur dieselbe Kategorie. Ein bezahltes Stufenpaket beendet offene
      -- Stufenpakete (Upgrade), lässt die Bonitätsauskunft aber unberührt —
      -- und umgekehrt.
      AND (COALESCE(type, '') = 'schufa' OR ref LIKE 'FIAON-SCHUFA-%') = ${istZusatzprodukt}
    RETURNING ref, assigned_agent_id, pack_name
  `;
  for (const r of rows) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${r.ref}, NULL, 'System', 'system',
              ${`Durch ${anlass} ${zeiger} ersetzt — ${personId != null ? "dieselbe Person" : "gleiche E-Mail"} und dieselbe Produktkategorie \u201e${kategorie}\u201c. Keine weiteren Erinnerungen.`})
    `;
  }
  // Attributions-Übertrag: bezahlte Bestellung erbt den betreuenden Agent der Dublette
  if (!paid[0].assigned_agent_id) {
    const donor = rows.find((r) => r.assigned_agent_id);
    if (donor) {
      await sqlPool`
        UPDATE fiaon_applications SET assigned_agent_id = ${donor.assigned_agent_id}, updated_at = NOW()
        WHERE ref = ${paidRef} AND assigned_agent_id IS NULL
      `;
      const agentRows = await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${donor.assigned_agent_id}`;
      const agentName = agentRows[0]?.name || `Agent #${donor.assigned_agent_id}`;
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${paidRef}, NULL, 'System', 'system',
                ${`Zuweisung von Dublette ${donor.ref} übernommen: ${agentName} betreute diesen Kunden (Provision ggf. manuell prüfen)`})
      `;
      console.log(`[FIAON-DUBLETTE] Attribution übertragen: ${paidRef} → Agent ${donor.assigned_agent_id} (${agentName}) aus ${donor.ref}`);
    }
  }
  if (rows.length > 0) {
    console.log(`[FIAON-DUBLETTE] ${rows.length} offene Schwester-Bestellung(en) von ${personId != null ? `Person #${personId}` : em} superseded (bezahlt: ${paidRef})`);
  }
  return { count: rows.length, refs: rows.map((r) => r.ref) };
}

// ── P3-A: Dubletten-ERKENNUNG beim Antrags-Intake (E-Mail ODER Telefon) ──────
// Vorgesetzten-Entscheidung (Ticket P3-A): NUR ERKENNEN + FLAGGEN.
// Es findet KEIN automatischer Merge/Reuse im Zahlungsfluss statt — Zahlungs-
// referenz, Rechnungsnummer und Provision bleiben unangetastet. Gefundene
// Dubletten werden ausschließlich per Audit-Log dokumentiert und erscheinen in
// der Admin-Dubletten-Verwaltung (E-Mail- UND Telefon-Gruppen).

/**
 * Normalisiert die Telefonnummer eines Antragsdatensatzes zu E.164 (+49…),
 * damit Dubletten formatunabhängig (0170…, +49170…, 0049170…) erkannt werden.
 * Prüft Privat- (phone_country_code+phone) und Geschäftsfeld (contact_phone).
 */
export function normalizeApplicationPhone(row: {
  phone?: string | null;
  phone_country_code?: string | null;
  contact_phone?: string | null;
}): string | null {
  const candidates = [
    (row.phone_country_code || row.phone) ? `${row.phone_country_code || ""}${row.phone || ""}` : null,
    row.contact_phone || null,
  ];
  for (const c of candidates) {
    if (!c) continue;
    const n = normalizePhone(String(c));
    if (n) return n; // "" (leer) und null (ungültig) überspringen
  }
  return null;
}

/**
 * Erkennt aktive Schwester-Anträge (andere ref, gleiche E-Mail ODER normalisiertes
 * Telefon, Status pending/claimed/paid, nicht gemerged). Schreibt bei Fund einen
 * Audit-Eintrag in fiaon_contact_log. Wirft NIE — Aufruf ist fire-and-forget aus
 * dem Zahlungsfluss und darf diesen niemals blockieren.
 */
export async function detectAndFlagDuplicateApplication(
  ref: string,
): Promise<{ sisters: string[]; byEmail: string[]; byPhone: string[] }> {
  const empty = { sisters: [], byEmail: [], byPhone: [] };
  try {
    const rows = await sqlPool`
      SELECT ref, email, contact_email, billing_email, phone, phone_country_code, contact_phone
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
    `;
    if (rows.length === 0) return empty;
    const me = rows[0];
    const email = String(me.email || me.contact_email || me.billing_email || "").trim().toLowerCase() || null;
    const phone = normalizeApplicationPhone(me);
    if (!email && !phone) return empty;

    const byEmailSet = new Set<string>();
    const byPhoneSet = new Set<string>();

    // E-Mail-Treffer direkt in SQL (case-insensitive, getrimmt).
    if (email) {
      const emailRows = await sqlPool`
        SELECT ref FROM fiaon_applications
        WHERE ref <> ${ref} AND merged_into IS NULL
          AND payment_status IN ('pending_payment','claimed_paid','paid')
          AND LOWER(TRIM(COALESCE(NULLIF(email,''), NULLIF(contact_email,''), NULLIF(billing_email,'')))) = ${email}
      `;
      for (const r of emailRows) byEmailSet.add(r.ref);
    }

    // Telefon-Treffer: Kandidaten mit vorhandener Nummer in JS normalisieren + vergleichen.
    if (phone) {
      const phoneCandidates = await sqlPool`
        SELECT ref, phone, phone_country_code, contact_phone FROM fiaon_applications
        WHERE ref <> ${ref} AND merged_into IS NULL
          AND payment_status IN ('pending_payment','claimed_paid','paid')
          AND (COALESCE(NULLIF(phone,''), NULLIF(contact_phone,'')) IS NOT NULL)
      `;
      for (const c of phoneCandidates) {
        const cPhone = normalizeApplicationPhone(c);
        if (cPhone && cPhone === phone) byPhoneSet.add(c.ref);
      }
    }

    const sisters = Array.from(new Set([...Array.from(byEmailSet), ...Array.from(byPhoneSet)]));
    if (sisters.length === 0) return empty;

    const reasons: string[] = [];
    if (byEmailSet.size > 0) reasons.push(`E-Mail: ${email}`);
    if (byPhoneSet.size > 0) reasons.push(`Telefon: ${phone}`);
    const note = `Mögliche Dublette erkannt (${reasons.join(" / ")}). Dieselbe Person existiert bereits als: ${sisters.join(", ")}. `
      + `KEINE automatische Zusammenführung — bitte in der Dubletten-Verwaltung prüfen.`;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system', ${note})
    `;
    console.log(`[FIAON-DUBLETTE] Erkennung: ${ref} → Schwestern ${sisters.join(", ")} (${reasons.join(" / ")})`);
    return { sisters, byEmail: Array.from(byEmailSet), byPhone: Array.from(byPhoneSet) };
  } catch (err) {
    console.error("[FIAON-DUBLETTE] Erkennung fehlgeschlagen:", err);
    return empty;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SOFT-MERGE (Dubletten zusammenführen) — KEIN HARD-DELETE (Direktive).
// Der Gewinner erbt fehlende Felder + die Kontakthistorie + Lead-Verknüpfungen
// des Verlierers; der Verlierer bleibt als Zeile erhalten (merged_into = Gewinner),
// verschwindet aber aus allen Listen. Jeder Merge ist vollständig protokolliert
// und per undoMergeApplications() exakt umkehrbar.
//
// Provisionen (fiaon_commissions) bleiben BEWUSST an ihrer ursprünglichen ref
// (Buchhaltungs-Spur): sie werden pro agent_id gezählt, unabhängig vom Merge —
// so geht KEIN Anspruch verloren und es entsteht KEINER doppelt.
// ═══════════════════════════════════════════════════════════════════════════

let mergeLogEnsured = false;
async function ensureMergeLog(): Promise<void> {
  if (mergeLogEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_merge_log (
      id SERIAL PRIMARY KEY,
      batch VARCHAR NOT NULL,             -- gruppiert eine Merge-Aktion (mehrere Verlierer)
      primary_ref VARCHAR NOT NULL,       -- Gewinner
      loser_ref VARCHAR NOT NULL,         -- zusammengeführter Datensatz
      filled_fields JSONB,                -- { spalte: alterGewinnerWert } für exaktes Undo der Feld-Füllung
      moved_log_ids JSONB,                -- fiaon_contact_log-IDs, die von loser→primary umgehängt wurden
      moved_lead_ids JSONB,               -- fiaon_leads-IDs, deren converted_order_id umgehängt wurde
      actor VARCHAR,
      undone_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_merge_log_batch_idx ON fiaon_merge_log(batch)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_merge_log_primary_idx ON fiaon_merge_log(primary_ref)`;
  mergeLogEnsured = true;
}

// Felder, die beim Merge NIE aus dem Verlierer übernommen werden (Identität/Technik).
const MERGE_SKIP_COLS = new Set([
  "id", "ref", "created_at", "updated_at", "merged_into", "superseded_by",
  "payment_status", "payment_reference", "invoice_number", "invoice_date",
  "amount_due", "confirmed_email_sent_at", "cancelled_at", "gdpr_deleted_at",
]);
// KYC-Dokumente separat behandelt (bytea) — nur füllen, wenn Gewinner leer.
const MERGE_DOC_COLS = ["bank_statement_pdf", "id_card_pdf", "schufa_pdf"];

export interface MergeResult {
  ok: boolean;
  batch?: string;
  primaryRef: string;
  merged: string[];
  fieldsFilled: string[];
  movedContactLogs: number;
  movedLeadLinks: number;
  error?: string;
}

/**
 * Führt duplicateRefs in primaryRef zusammen (Soft-Merge). Reihenfolge der
 * Verlierer bestimmt, welcher zuerst ein leeres Gewinner-Feld füllt.
 * NUR FÜLLEN, NIE ÜBERSCHREIBEN. Vollständig umkehrbar (fiaon_merge_log).
 */
export async function mergeApplications(
  primaryRef: string,
  duplicateRefs: string[],
  actor: string,
): Promise<MergeResult> {
  await ensurePaymentColumns();
  await ensureMergeLog();
  const loserRefs = Array.from(new Set(duplicateRefs.filter((r) => r && r !== primaryRef)));
  const base: MergeResult = { ok: false, primaryRef, merged: [], fieldsFilled: [], movedContactLogs: 0, movedLeadLinks: 0 };
  if (loserRefs.length === 0) return { ...base, error: "Keine Verlierer-Refs" };

  const allRefs = [primaryRef, ...loserRefs];
  const rows = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ANY(${allRefs})`;
  const primary = rows.find((r: any) => r.ref === primaryRef);
  if (!primary) return { ...base, error: "Gewinner-Datensatz nicht gefunden" };
  const losers = rows.filter((r: any) => r.ref !== primaryRef && loserRefs.includes(r.ref));
  if (losers.length === 0) return { ...base, error: "Keine Verlierer-Datensätze gefunden" };

  const batch = `merge_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const fieldsFilledAll = new Set<string>();

  // Nur EINMAL pro leerem Gewinner-Feld füllen: hier den zusammengeführten Wert bestimmen.
  const isEmpty = (v: any) => v === null || v === undefined || v === "";
  const updates: Record<string, any> = {};
  const oldPrimaryVals: Record<string, any> = {};
  for (const dup of losers) {
    for (const [col, val] of Object.entries(dup as Record<string, any>)) {
      if (MERGE_SKIP_COLS.has(col) || MERGE_DOC_COLS.includes(col)) continue;
      if (col in updates) continue; // bereits durch früheren Verlierer gefüllt
      if (isEmpty((primary as any)[col]) && !isEmpty(val)) {
        updates[col] = val;
        oldPrimaryVals[col] = (primary as any)[col] ?? null;
      }
    }
  }
  for (const docCol of MERGE_DOC_COLS) {
    if ((primary as any)[docCol] == null) {
      const donor = losers.find((d: any) => d[docCol] != null);
      if (donor) { updates[docCol] = (donor as any)[docCol]; oldPrimaryVals[docCol] = null; }
    }
  }

  // 1) Fehlende Gewinner-Felder füllen (nur füllen, nie überschreiben).
  if (Object.keys(updates).length > 0) {
    const cols = Object.keys(updates);
    const setClauses = cols.map((col, i) => `${col} = $${i + 2}`).join(", ");
    await sqlPool.unsafe(
      `UPDATE fiaon_applications SET ${setClauses}, updated_at = NOW() WHERE ref = $1`,
      [primaryRef, ...cols.map((c) => updates[c])],
    );
    cols.forEach((c) => fieldsFilledAll.add(c));
  }

  // 2) Pro Verlierer: Kontakthistorie + Lead-Verknüpfungen umhängen, dann soft-mergen.
  for (const loser of losers) {
    const movedLogs = await sqlPool`
      UPDATE fiaon_contact_log SET ref = ${primaryRef}
      WHERE ref = ${loser.ref} RETURNING id
    `;
    const movedLeads = await sqlPool`
      UPDATE fiaon_leads SET converted_order_id = ${primaryRef}, updated_at = NOW()
      WHERE converted_order_id = ${loser.ref} RETURNING id
    `;
    await sqlPool`
      UPDATE fiaon_applications
      SET merged_into = ${primaryRef}, updated_at = NOW()
      WHERE ref = ${loser.ref} AND merged_into IS NULL
    `;
    // Nur die Felder protokollieren, die AUS DIESEM Verlierer stammen (für lesbares Undo/Audit).
    const filledFromThis: Record<string, any> = {};
    for (const [col, val] of Object.entries(updates)) {
      if ((loser as any)[col] === val && col in oldPrimaryVals) filledFromThis[col] = oldPrimaryVals[col];
    }
    await sqlPool`
      INSERT INTO fiaon_merge_log (batch, primary_ref, loser_ref, filled_fields, moved_log_ids, moved_lead_ids, actor)
      VALUES (${batch}, ${primaryRef}, ${loser.ref},
              ${sqlPool.json(filledFromThis)},
              ${sqlPool.json(movedLogs.map((r: any) => r.id))},
              ${sqlPool.json(movedLeads.map((r: any) => r.id))},
              ${actor})
    `;
    base.movedContactLogs += movedLogs.length;
    base.movedLeadLinks += movedLeads.length;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${loser.ref}, NULL, ${actor}, 'system',
              ${`Als Dublette zusammengeführt in ${primaryRef} (Soft-Merge, Batch ${batch}). Kein Datenverlust — rückgängig machbar.`})
    `;
  }

  await sqlPool`
    INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
    VALUES (${primaryRef}, NULL, ${actor}, 'system',
            ${`Dubletten zusammengeführt: ${loserRefs.join(", ")} → dieser Datensatz. Gefüllte Felder: ${Array.from(fieldsFilledAll).join(", ") || "keine"}. Batch ${batch}.`})
  `;

  console.log(`[FIAON-MERGE] Soft-Merge ${loserRefs.length} → ${primaryRef} (Batch ${batch}); Felder: ${Array.from(fieldsFilledAll).join(", ") || "keine"}; ${base.movedContactLogs} Log-Einträge, ${base.movedLeadLinks} Leads umgehängt`);
  return { ok: true, batch, primaryRef, merged: loserRefs, fieldsFilled: Array.from(fieldsFilledAll), movedContactLogs: base.movedContactLogs, movedLeadLinks: base.movedLeadLinks };
}

/**
 * Macht einen Merge-Batch exakt rückgängig: merged_into zurück auf NULL,
 * gefüllte Felder zurück auf den alten Gewinner-Wert, umgehängte Kontakt-Logs
 * und Lead-Verknüpfungen zurück auf den Verlierer.
 */
export async function undoMergeApplications(
  batch: string,
  actor: string,
): Promise<{ ok: boolean; restored: string[]; error?: string }> {
  await ensureMergeLog();
  const entries = await sqlPool`SELECT * FROM fiaon_merge_log WHERE batch = ${batch} AND undone_at IS NULL`;
  if (entries.length === 0) return { ok: false, restored: [], error: "Kein rückgängig machbarer Merge-Batch gefunden" };
  const restored: string[] = [];
  for (const e of entries) {
    // Kontakt-Logs zurück auf den Verlierer
    const logIds: number[] = Array.isArray(e.moved_log_ids) ? e.moved_log_ids : [];
    if (logIds.length > 0) {
      await sqlPool`UPDATE fiaon_contact_log SET ref = ${e.loser_ref} WHERE id = ANY(${logIds})`;
    }
    // Lead-Verknüpfungen zurück auf den Verlierer
    const leadIds: number[] = Array.isArray(e.moved_lead_ids) ? e.moved_lead_ids : [];
    if (leadIds.length > 0) {
      await sqlPool`UPDATE fiaon_leads SET converted_order_id = ${e.loser_ref}, updated_at = NOW() WHERE id = ANY(${leadIds})`;
    }
    // Gefüllte Felder auf dem Gewinner zurücksetzen (nur die aus diesem Verlierer stammenden)
    const filled: Record<string, any> = e.filled_fields || {};
    const cols = Object.keys(filled);
    if (cols.length > 0) {
      const setClauses = cols.map((col, i) => `${col} = $${i + 2}`).join(", ");
      await sqlPool.unsafe(
        `UPDATE fiaon_applications SET ${setClauses}, updated_at = NOW() WHERE ref = $1`,
        [e.primary_ref, ...cols.map((c) => filled[c])],
      );
    }
    // Verlierer reaktivieren
    await sqlPool`UPDATE fiaon_applications SET merged_into = NULL, updated_at = NOW() WHERE ref = ${e.loser_ref}`;
    await sqlPool`UPDATE fiaon_merge_log SET undone_at = NOW() WHERE id = ${e.id}`;
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${e.loser_ref}, NULL, ${actor}, 'system',
              ${`Merge rückgängig gemacht (Batch ${batch}) — Datensatz wieder eigenständig.`})
    `;
    restored.push(e.loser_ref);
  }
  console.log(`[FIAON-MERGE] Undo Batch ${batch}: ${restored.length} Datensätze wiederhergestellt (${actor})`);
  return { ok: true, restored };
}

// ═══════════════════════════════════════════════════════════════════════════
// P1 — PRÄVENTION, DIE WIRKLICH GREIFT (Prompt „Dubletten & verschwundene Kunden")
//
// Bevor ein Antrag als eigenständiger „Kunde" in Umlauf geht (Übergang zu
// pending_payment in POST /payment-order), wird geprüft, ob bereits ein Antrag
// DERSELBEN PERSON (gleiche E-Mail ODER normalisiertes Telefon) BEZAHLT oder in
// AKTIVER BETREUUNG (pending_payment/claimed_paid) existiert. Wenn ja, wird der
// neue Antrag SOFORT als Dublette an den bestehenden verknüpft (Soft-Merge,
// merged_into) — kein zweiter Kunde, kein zweiter Agent, keine zweite Anrufliste.
//
// GELD-SICHERHEIT (Direktive, unverhandelbar): Der Merge berührt NIEMALS eine
// bestehende Zahlung, Provision oder Rechnungsnummer — MERGE_SKIP_COLS schützt
// payment_status/payment_reference/invoice_number/amount_due etc.; Provisionen
// bleiben an ihrer ref. Nur der neue, unbezahlte Doppel-Antrag wird angehängt.
//
// UNSICHERHEIT: Existieren ZWEI oder mehr BEZAHLTE Schwester-Datensätze, findet
// KEIN Automatik-Merge statt — der Fall wird als „prüfen" geflaggt (Audit-Log)
// und erscheint in /admin/dubletten zur manuellen Entscheidung des Vorgesetzten.
//
// SCHUFA/Bonitäts-Bestellungen sind ein EIGENES Produkt (dieselbe Person kann
// Aktivierung UND SCHUFA kaufen) → werden bewusst NIE automatisch verknüpft.
//
// Wirft nie. Bei Verknüpfung: { linked:true, winnerRef, winnerPaymentReference,
// winnerPaymentStatus } — der Zahlungsfluss verwendet dann die bestehende
// Bestellung wieder, statt eine zweite anzulegen.
// ═══════════════════════════════════════════════════════════════════════════
export async function linkDuplicateToPaidOrActive(
  newRef: string,
  actor = "System (Prävention)",
): Promise<{
  linked: boolean;
  ambiguous?: boolean;
  winnerRef?: string;
  winnerPaymentReference?: string | null;
  winnerPaymentStatus?: string;
}> {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT ref, type, email, contact_email, billing_email, phone, phone_country_code, contact_phone,
             payment_status, merged_into
      FROM fiaon_applications WHERE ref = ${newRef} LIMIT 1
    `;
    if (rows.length === 0) return { linked: false };
    const me = rows[0];
    // Bereits gemergt oder selbst bezahlt → nichts tun (bestehendes Geld nie anfassen).
    if (me.merged_into) return { linked: false };
    if (me.payment_status === "paid") return { linked: false };
    // SCHUFA/Bonität ist ein eigenes Produkt — nie automatisch verknüpfen.
    if (String(me.type || "").toLowerCase() === "schufa" || newRef.startsWith("FIAON-SCHUFA-")) return { linked: false };

    const email = String(me.email || me.contact_email || me.billing_email || "").trim().toLowerCase() || null;
    const phone = normalizeApplicationPhone(me);
    if (!email && !phone) return { linked: false };

    // Kandidaten: andere, nicht-gemergte, nicht-SCHUFA Anträge in aktivem Zustand
    // (bezahlt oder in aktiver Betreuung). Telefon-Vergleich in JS (formatunabhängig).
    const candidates = await sqlPool`
      SELECT ref, type, email, contact_email, billing_email, phone, phone_country_code, contact_phone,
             payment_status, payment_reference, assigned_agent_id, created_at
      FROM fiaon_applications
      WHERE ref <> ${newRef} AND merged_into IS NULL
        AND COALESCE(type,'') <> 'schufa' AND ref NOT LIKE 'FIAON-SCHUFA-%'
        AND payment_status IN ('paid','pending_payment','claimed_paid')
    `;
    const sameParty = candidates.filter((c: any) => {
      const cEmail = String(c.email || c.contact_email || c.billing_email || "").trim().toLowerCase() || null;
      if (email && cEmail && cEmail === email) return true;
      const cPhone = normalizeApplicationPhone(c);
      if (phone && cPhone && cPhone === phone) return true;
      return false;
    });
    if (sameParty.length === 0) return { linked: false };

    const paid = sameParty.filter((c: any) => c.payment_status === "paid");
    // Unsicherheit: mehr als EIN bezahlter Schwester-Datensatz → NICHT automatisch
    // mergen (Geld-Risiko). Als „prüfen" flaggen; erscheint in /admin/dubletten.
    if (paid.length > 1) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${newRef}, NULL, 'System', 'system',
                ${`Prävention: mehrere BEZAHLTE Schwester-Datensätze gefunden (${paid.map((p: any) => p.ref).join(", ")}) — KEIN Automatik-Merge (Geld-Sicherheit). Bitte in /admin/dubletten prüfen.`})
      `.catch(() => {});
      console.log(`[FIAON-PRÄVENTION] ${newRef}: ${paid.length} bezahlte Schwestern → prüfen (kein Auto-Merge)`);
      return { linked: false, ambiguous: true };
    }

    // Gewinner: der bezahlte; sonst der aktiv betreute (mit Agent); sonst der älteste aktive.
    const byAgeAsc = (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    let winner: any = paid[0];
    if (!winner) {
      const active = sameParty.filter((c: any) => c.assigned_agent_id).sort(byAgeAsc);
      winner = active[0] || [...sameParty].sort(byAgeAsc)[0];
    }
    if (!winner) return { linked: false };

    // Soft-Merge des NEUEN (unbezahlten) Antrags in den bestehenden Datensatz.
    // mergeApplications füllt nur leere Gewinner-Felder (z. B. fehlende Kontaktdaten),
    // schützt Zahlung/Provision/Rechnung (MERGE_SKIP_COLS) und ist per Batch umkehrbar.
    const result = await mergeApplications(winner.ref, [newRef], actor);
    if (!result.ok) return { linked: false };
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${winner.ref}, NULL, 'System', 'system',
              ${`Prävention: Kunde hat erneut einen Antrag gestellt (${newRef}) — automatisch mit diesem ${winner.payment_status === "paid" ? "bezahlten" : "bestehenden"} Datensatz verknüpft. Kein zweiter Kunde, kein zweiter Agent, kein Doppelanruf. Zahlung/Provision/Rechnung unverändert.`})
    `.catch(() => {});
    console.log(`[FIAON-PRÄVENTION] ${newRef} → verknüpft mit ${winner.ref} (${winner.payment_status})`);
    return {
      linked: true,
      winnerRef: winner.ref,
      winnerPaymentReference: winner.payment_reference,
      winnerPaymentStatus: winner.payment_status,
    };
  } catch (err) {
    console.error("[FIAON-PRÄVENTION] linkDuplicateToPaidOrActive:", err);
    return { linked: false };
  }
}

// Paket X/DB: Bezahlt-Bestätigung (Make 'payment_confirmed' mit login_url) —
// genau 1× pro Bestellung über atomaren Flag-Claim (confirmed_email_sent_at).
// Wiederverwendbar für mark-paid UND Kontoabgleich (fiaon-reconcile.ts).
export async function sendPaymentConfirmedOnce(ref: string): Promise<boolean> {
  try {
    const confirmed = await sqlPool`
      UPDATE fiaon_applications SET confirmed_email_sent_at = NOW()
      WHERE ref = ${ref} AND confirmed_email_sent_at IS NULL
        AND COALESCE(NULLIF(email, ''), NULLIF(contact_email, ''), NULLIF(billing_email, '')) IS NOT NULL
      RETURNING ref, payment_reference, amount_due, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name
    `;
    if (confirmed.length === 0) return false;
    sendMakeWebhook("payment_confirmed", {
      ...makePayloadFromRow(confirmed[0]),
      login_url: absoluteUrl("/login"),
    }).catch(() => {});
    return true;
  } catch (whErr) {
    console.error("[MAKE-WEBHOOK] payment_confirmed claim:", whErr);
    return false;
  }
}

// Bestellung anlegen (nach Antragsabschluss). Idempotent pro ref.
// kind: "activation" (Standard, Betrag aus Paket) | "schufa" (74 € Einmalzahlung, eigene Bestellzeile)
router.post("/payment-order", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const { ref: refInput, kind, email, firstName, lastName } = req.body || {};
    let ref: string | null = refInput || null;

    if (kind === "schufa") {
      // SCHUFA/Bonitätsauskunft: eigene Bestellzeile, unabhängig vom ABO
      ref = `FIAON-SCHUFA-${Date.now().toString(36).toUpperCase()}-${randomPaymentCode(4)}`;
      // ── ALLE ANGABEN KOMMEN AN (22.08.2026, Justins Kundentest) ───────────
      // Das Formular fragte Adresse, Geburtsdatum und Telefon ab — und schickte
      // nur E-Mail und Name. Neun Felder gingen verloren. Jetzt werden sie
      // gespeichert; und kommt die Bestellung aus dem Kundenbereich (kundeRef
      // + Sitzungs-Cookie), hängt sie an derselben Person wie das Paket.
      const b = req.body || {};
      let personId: number | null = null;
      let vorlage: any = null;
      if (b.kundeRef) {
        const { kundeAusCookie } = await import("../lib/fiaon-kunde-session");
        if (kundeAusCookie(req) === String(b.kundeRef)) {
          const [v] = (await sqlPool`SELECT person_id, first_name, last_name, email, street, zip, city, country, birthdate, phone, phone_country_code
            FROM fiaon_applications WHERE ref = ${String(b.kundeRef)} AND merged_into IS NULL LIMIT 1`) as any[];
          if (v) { personId = v.person_id ?? null; vorlage = v; }
        }
      }
      const geburt = typeof b.birthDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.birthDate) ? b.birthDate : (vorlage?.birthdate ?? null);
      // `payment_reference` wird hier NICHT mitgegeben und trotzdem gesetzt: Der
      // Trigger aus db/migrations/037 füllt sie. Genau das ist der Punkt — eine
      // neue Anlagestelle kann den Verwendungszweck nicht mehr vergessen.
      await sqlPool`
        INSERT INTO fiaon_applications (ref, type, status, first_name, last_name, email, pack_name,
                                        street, zip, city, country, birthdate, phone, person_id, created_at, updated_at)
        VALUES (${ref}, 'schufa', 'submitted',
                ${firstName || vorlage?.first_name || null}, ${lastName || vorlage?.last_name || null}, ${email || vorlage?.email || null},
                'Bonitätsauskunft inkl. Handlungsplan',
                ${b.street || vorlage?.street || null}, ${b.plz || b.zip || vorlage?.zip || null}, ${b.city || vorlage?.city || null},
                ${b.country || vorlage?.country || null}, ${geburt}, ${b.phone || vorlage?.phone || null}, ${personId},
                NOW(), NOW())
      `;
    }

    if (!ref) return res.status(400).json({ ok: false, error: "ref fehlt" });

    const rows = await sqlPool`
      SELECT ref, type, pack_key, pack_name, first_name, contact_name, email, contact_email, billing_email,
             payment_reference, payment_status, payment_due_date, amount_due, currency
      FROM fiaon_applications WHERE ref = ${ref} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });
    const app = rows[0];

    // Idempotenz: bestehende offene/gemeldete/bezahlte Bestellung wiederverwenden
    if (app.payment_reference && ["pending_payment", "claimed_paid", "paid"].includes(app.payment_status)) {
      return res.json({ ok: true, paymentReference: app.payment_reference, existing: true });
    }

    // ── P1 PRÄVENTION: Bevor dieser Antrag als eigenständiger Kunde in Umlauf
    // geht, prüfen, ob dieselbe Person (E-Mail ODER Telefon) bereits bezahlt hat
    // oder in aktiver Betreuung ist. Wenn ja: neuen Antrag verknüpfen (Soft-Merge)
    // und die BESTEHENDE Bestellung wiederverwenden — kein zweiter Kunde/Agent/Anruf.
    // Berührt keine bestehende Zahlung/Provision/Rechnung. Bei Unsicherheit (zwei
    // Bezahlte) wird NICHT gemergt, sondern für /admin/dubletten geflaggt.
    const link = await linkDuplicateToPaidOrActive(ref);
    if (link.linked && link.winnerRef) {
      const w = await sqlPool`
        SELECT payment_reference, payment_status FROM fiaon_applications WHERE ref = ${link.winnerRef} LIMIT 1
      `;
      const winnerPaid = (w[0]?.payment_status || link.winnerPaymentStatus) === "paid";
      console.log(`[FIAON-PAYMENT] ${ref} an bestehenden Kunden ${link.winnerRef} verknüpft (${w[0]?.payment_status}) — keine zweite Bestellung`);
      return res.json({
        ok: true,
        paymentReference: w[0]?.payment_reference || link.winnerPaymentReference || null,
        existing: true,
        linkedToExisting: true,
        alreadyPaid: winnerPaid,
      });
    }

    const amount = app.type === "schufa" ? SCHUFA_PRICE : PACK_PRICES[app.pack_key];
    if (!amount) return res.status(400).json({ ok: false, error: `Unbekanntes Paket: ${app.pack_key}` });

    const paymentReference = app.payment_reference || (await generateUniquePaymentReference());
    const dueDate = new Date(Date.now() + PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000);

    await sqlPool`
      UPDATE fiaon_applications SET
        payment_reference = ${paymentReference},
        payment_status = 'pending_payment',
        payment_due_date = ${dueDate},
        amount_due = ${amount.toFixed(2)},
        currency = 'EUR',
        reminder_sent_at_24h = NULL,
        reminder_sent_at_72h = NULL,
        updated_at = NOW()
      WHERE ref = ${ref}
    `;

    console.log(`[FIAON-PAYMENT] Bestellung angelegt: ${paymentReference} (ref=${ref}, ${amount.toFixed(2)} EUR, fällig ${dueDate.toISOString()})`);

    // ── EIN KUNDE, EINE STUFE (08.08.2026) ────────────────────────────────
    // Fordert derselbe Mensch eine Rechnung für ein Stufenpaket an, ist seine
    // ÄLTERE offene Stufenpaket-Bestellung damit erledigt — er hat sich gerade
    // neu entschieden. Vorher passierte das erst beim Bezahlen; bis dahin lagen
    // zwei offene Rechnungen beim Kunden, er bekam zwei Mahnketten, und im
    // Bestand liegen 9 Personen mit genau diesem Zustand.
    //
    // Der Auslöser ist bewusst die RECHNUNGSANFORDERUNG und nicht die Anlage
    // der Zeile: Beim reinen Öffnen des Formulars hat der Kunde nichts
    // entschieden, und eine stillgelegte Bestellung mit einer Referenz, die er
    // schon per Mail hat, wäre eine Zahlung ohne Zuordnung.
    // Zusatzprodukte (Bonitätsauskunft) bleiben unberührt — dieselbe
    // Kategoriegrenze wie beim Bezahlen.
    supersedeSisterOrders(ref).catch((e) => console.error("[FIAON-DUBLETTE] supersede bei Anlage:", e));

    // ══ P1-C DAUERSCHUTZ: Bestellung an bestehender Person ════════════════
    // Besonders wichtig beim Bonitäts-Kauf: Der legt bewusst eine EIGENE
    // Antragszeile an (`FIAON-SCHUFA-…`, oben in dieser Route). Genau diese
    // Zeile hat den Login-Ausfall ausgelöst — sie war die jüngste Zeile der
    // E-Mail und trug kein Passwort.
    //
    // Sie wird jetzt derselben Person zugeordnet wie das Konto. Damit zählt der
    // Bonitäts-Käufer strukturell nur noch EINMAL, und der Ausfall kann sich
    // nicht wiederholen: Das Passwort hängt an der Person, nicht an der Zeile.
    await bindePersonAnAntrag(ref).catch((e) =>
      console.error("[FIAON-PERSON] Zuordnung nach /payment-order:", e));

    // Paket AE1: neue Bestellung sofort fair verteilen (Round-Robin, fire-and-forget)
    import("./fiaon-agent").then((m) => m.distributeUnassignedOrders()).catch((e) => console.error("[FIAON-VERTEILUNG]", e));

    // P3-A: Dubletten-ERKENNUNG (E-Mail ODER Telefon) — nur erkennen + flaggen,
    // KEIN Merge/Reuse. Fire-and-forget: blockiert oder verändert den Zahlungsfluss nie.
    detectAndFlagDuplicateApplication(ref).catch((e) => console.error("[FIAON-DUBLETTE] Erkennung:", e));

    // Paket BA3: Auto-Konversion (Sicherheitsnetz) — Lead per E-Mail/Telefon konvertieren.
    try {
      const convPhone = (app.phone_country_code || app.phone) ? `${app.phone_country_code || ""}${app.phone || ""}` : (app.contact_phone || null);
      import("./fiaon-leads").then((m) => m.convertLeadsForContact(app.email || app.contact_email || app.billing_email || null, convPhone, ref)).catch(() => {});
    } catch { /* fire-and-forget */ }

    // Rechnung: fortlaufende, lückenlose Nummer genau einmal beim Übergang zu pending_payment
    try {
      await ensureInvoiceNumber(sqlPool, ref);
    } catch (invErr) {
      console.error("[FIAON-INVOICE] Nummernvergabe:", invErr);
    }

    // Make-Webhook 'payment_details' — genau einmal beim Übergang nach pending_payment.
    // Atomarer Flag-Claim verhindert Doppelversand; Fehler blockieren den Flow nicht.
    try {
      const claimed = await sqlPool`
        UPDATE fiaon_applications SET payment_email_sent_at = NOW()
        WHERE ref = ${ref} AND payment_email_sent_at IS NULL
        RETURNING ref, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name, payment_reference, amount_due
      `;
      if (claimed.length > 0) {
        // invoice_url: signierter, ablaufender Download-Link (Brevo-Template: „Rechnung herunterladen"-Button)
        const payload = { ...makePayloadFromRow(claimed[0]), invoice_url: signInvoiceUrl(paymentReference) };
        sendMakeWebhook("payment_details", payload)
          .catch((e) => console.error(`[MAKE-WEBHOOK] payment_details für ${ref} nicht `
            + "abgesetzt — der Kunde bekommt seine Zahlungsdaten NICHT:", e));

        // ══════════════════════════════════════════════════════════════════
        // DIE AKTE ERFÄHRT AUCH VON DER AUTOMATISCHEN RECHNUNG
        //
        // ── DER BEFUND (21.08.2026) ─────────────────────────────────────
        // Dieser Weg — der Kunde stellt seinen Antrag selbst fertig — hat die
        // Zahlungsdaten immer verschickt und NIE einen Verlaufseintrag
        // hinterlassen. `rechnungStellen` (der Weg über den Mitarbeiter) tut
        // es; dieser nicht.
        //
        // Die Folge ist dieselbe wie beim geschluckten SQL-Fehler vom 19.08.:
        // Ein Mitarbeiter öffnet die Akte, sieht keine Rechnung — und schickt
        // sie ein zweites Mal. GEMESSEN: zwei Fälle allein am 21.08. zwischen
        // 12:53 und 13:05 Uhr; über die ganze Woche 5 von 63.
        //
        // Kein `.catch(() => {})`: Bleibt der Eintrag aus, steht es im Log.
        // Genau dieses stumme catch hat den 19.08. drei Tage lang verdeckt.
        // ══════════════════════════════════════════════════════════════════
        const c = claimed[0] as any;
        const betrag = c.amount_due != null
          ? `${Number(c.amount_due).toFixed(2)} €` : "Betrag unbekannt";
        const empfaenger = c.email || c.contact_email || c.billing_email || "die hinterlegte Adresse";
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          SELECT ${ref}, a.person_id, NULL, 'System', 'system',
                 ${`Erste Rechnung gestellt (automatisch beim Antragsabschluss): ${betrag}, `
                   + `Verwendungszweck ${c.payment_reference ?? paymentReference} — `
                   + `verschickt an ${empfaenger}.`}
          FROM fiaon_applications a WHERE a.ref = ${ref}
        `.catch((e) => console.error(`[ANTRAG] Verlaufseintrag zur automatischen Rechnung `
          + `${ref} nicht geschrieben — die Akte zeigt sie nicht, und jemand schickt sie `
          + "ein zweites Mal:", e));
      }
    } catch (whErr) {
      console.error("[MAKE-WEBHOOK] payment_details claim:", whErr);
    }

    res.json({ ok: true, paymentReference });
  } catch (err) {
    console.error("[FIAON-PAYMENT] payment-order:", err);
    res.status(500).json({ ok: false, error: "Bestellung konnte nicht angelegt werden" });
  }
});

// Öffentliche Zahlungsdaten für /zahlung/[payment_reference] — kein Login nötig,
// keine sensiblen Kundendaten außer Vorname.
router.get("/payment-order/:paymentRef", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT payment_reference, payment_status, payment_due_date, amount_due, currency, first_name, pack_name
      FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef} LIMIT 1
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    const r = rows[0];
    res.json({
      ok: true,
      paymentReference: r.payment_reference,
      status: r.payment_status,
      dueDate: r.payment_due_date,
      amountDue: String(r.amount_due),
      currency: r.currency || "EUR",
      firstName: r.first_name || "",
      packName: r.pack_name || "",
      bank: FIAON_BANK_DETAILS,
    });
  } catch (err) {
    console.error("[FIAON-PAYMENT] payment-order/:ref:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Admin: Zahlungsverwaltung (manuelle Freischaltung) ──────────────

router.get("/admin/payments", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const allowed = ["pending_payment", "claimed_paid", "expired", "paid", "superseded", "cancelled"];
    const status = allowed.includes(String(req.query.status)) ? String(req.query.status) : "pending_payment";
    const rows = await sqlPool`
      SELECT ref, type, payment_reference, payment_status, payment_due_date, amount_due, currency,
             first_name, last_name, contact_name, company_name, email, contact_email, billing_email,
             phone, phone_country_code, contact_phone, street, zip, city,
             pack_name, updated_at, created_at,
             claimed_paid_at, promised_pay_date, invoice_number, welcome_sent_at,
             payment_email_sent_at, followup_sent_at, agent_email_sent_at, completed_at,
             superseded_by, allow_reminders_despite_paid, cancelled_at, gdpr_deleted_at
      FROM fiaon_applications
      WHERE payment_status = ${status} AND payment_reference IS NOT NULL AND merged_into IS NULL
      ORDER BY (payment_status = 'claimed_paid') DESC, claimed_paid_at ASC NULLS LAST, payment_due_date ASC NULLS LAST
    `;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-PAYMENT] admin/payments:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Kunde meldet "Ich habe die Überweisung getätigt" — reines Tracking.
// KRITISCH: Löst NIEMALS Freischaltung oder Willkommensmail aus.
router.post("/payment-order/:paymentRef/claim-paid", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        payment_status = 'claimed_paid',
        claimed_paid_at = COALESCE(claimed_paid_at, NOW()),
        updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef}
        AND payment_status IN ('pending_payment', 'claimed_paid')
      RETURNING payment_reference
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden oder bereits abgeschlossen" });
    console.log(`[FIAON-PAYMENT] Zahlung gemeldet (claimed_paid): ${req.params.paymentRef}`);
    // Einstufung sofort nachziehen: „Zahlung gemeldet" ist Tier 1 und damit der
    // Zustand, der einen Kunden ganz oben in die Anrufliste hebt. Käme das erst
    // im Tageslauf, würde der dringendste Fall einen Tag zu spät sichtbar.
    try {
      const { personTierAktualisieren } = await import("../lib/tier");
      const [row] = await sqlPool`SELECT ref FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef}`;
      if (row?.ref) await personTierAktualisieren(sqlPool, { ref: row.ref });
    } catch (e) {
      console.error("[FIAON-TIER] nach claim-paid:", e);
    }
    // Paket U: Bestätigungsmail 'claim_received' — genau 1× pro Bestellung
    // (atomarer Flag-Claim; Mehrfachklick feuert NICHT erneut). Fehler blockieren nie.
    try {
      const claimed = await sqlPool`
        UPDATE fiaon_applications SET claim_email_sent_at = NOW()
        WHERE payment_reference = ${req.params.paymentRef} AND claim_email_sent_at IS NULL
          AND COALESCE(NULLIF(email, ''), NULLIF(contact_email, ''), NULLIF(billing_email, '')) IS NOT NULL
        RETURNING ref, payment_reference, amount_due, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name
      `;
      if (claimed.length > 0) {
        sendMakeWebhook("claim_received", {
          ...makePayloadFromRow(claimed[0]),
          invoice_url: signInvoiceUrl(req.params.paymentRef),
        }).catch(() => {});
      }
    } catch (whErr) {
      console.error("[MAKE-WEBHOOK] claim_received claim:", whErr);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-PAYMENT] claim-paid:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Forecast-Kennzahlen: offen / erwartet (unbestätigt) / bestätigt + Bestätigungsquote
router.get("/admin/payments/stats", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const [stats] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE payment_status = 'pending_payment')                      AS pending_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'pending_payment'), 0)  AS pending_sum,
        COUNT(*) FILTER (WHERE payment_status = 'claimed_paid')                         AS claimed_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'claimed_paid'), 0)     AS claimed_sum,
        COUNT(*) FILTER (WHERE payment_status = 'paid')                                 AS paid_count,
        COALESCE(SUM(amount_due) FILTER (WHERE payment_status = 'paid'), 0)             AS paid_sum,
        COUNT(*) FILTER (WHERE claimed_paid_at IS NOT NULL)                             AS claims_total,
        COUNT(*) FILTER (WHERE claimed_paid_at IS NOT NULL AND payment_status = 'paid') AS claims_confirmed,
        COUNT(*) FILTER (WHERE (last_reminder_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date) AS reminders_today
      FROM fiaon_applications
      WHERE payment_reference IS NOT NULL AND merged_into IS NULL
    `;
    const claimsTotal = Number(stats.claims_total);
    res.json({
      ok: true,
      pending: { count: Number(stats.pending_count), sum: Number(stats.pending_sum) },
      claimed: { count: Number(stats.claimed_count), sum: Number(stats.claimed_sum) },
      paid: { count: Number(stats.paid_count), sum: Number(stats.paid_sum) },
      confirmationRate: claimsTotal > 0 ? Math.round((Number(stats.claims_confirmed) / claimsTotal) * 100) : null,
      remindersToday: Number(stats.reminders_today),
    });
  } catch (err) {
    console.error("[FIAON-PAYMENT] admin/payments/stats:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Detail-Timeline: alle Ereignisse eines Antrags (Spalten-Flags + Agent-Kontakt-Log)
router.get("/admin/payments/:paymentRef/timeline", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT ref, created_at, welcome_sent_at, payment_email_sent_at, claimed_paid_at,
             followup_sent_at, agent_email_sent_at, promised_pay_date, completed_at,
             payment_status, payment_due_date, invoice_number, invoice_date,
             claim_email_sent_at, confirmed_email_sent_at, last_reminder_at, reminder_count,
             access_backfilled_at
      FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef}
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    const a = rows[0];
    const events: Array<{ at: string; label: string; type: string; meta?: string }> = [];
    const push = (at: any, label: string, type: string, meta?: string) => {
      if (at) events.push({ at: new Date(at).toISOString(), label, type, meta });
    };
    push(a.created_at, "Antrag erstellt", "created");
    push(a.welcome_sent_at, "Welcome-Webhook gesendet (Make)", "webhook");
    push(a.invoice_date, `Rechnung erzeugt${a.invoice_number ? ` (${a.invoice_number})` : ""}`, "invoice");
    push(a.payment_email_sent_at, "Zahlungsdaten-Webhook gesendet (Make) — Zahlungsseite erreicht", "webhook");
    push(a.claimed_paid_at, "Kunde: „Ich habe überwiesen“ geklickt", "claimed");
    push(a.followup_sent_at, "48h-Follow-up-Webhook gesendet (Make)", "webhook");
    push(a.claim_email_sent_at, "Bestätigung der Ankündigung gesendet (Make: claim_received)", "webhook");
    push(a.last_reminder_at, `Letzte Zahlungserinnerung gesendet (Make: payment_reminder${a.reminder_count ? `, Nr. ${a.reminder_count}` : ""})`, "webhook");
    push(a.confirmed_email_sent_at, "Bezahlt-Bestätigung mit Login gesendet (Make: payment_confirmed)", "webhook");
    push(a.promised_pay_date, "Zahlungs-Zusage (durch Mitarbeiter erfasst)", "promise");
    if (a.payment_status === "paid") push(a.completed_at, "Als bezahlt markiert — Zugang freigeschaltet", "paid");
    push(a.access_backfilled_at, "Zugang freigeschaltet (Nachtrag)", "paid");

    // Agent-Aktionen aus dem Kontakt-Log (Tabelle existiert ggf. noch nicht → tolerant)
    try {
      const log = await sqlPool`
        SELECT type, outcome, note, agent_name, scheduled_at, promised_date, created_at
        FROM fiaon_contact_log WHERE ref = ${a.ref} ORDER BY created_at ASC
      `;
      for (const l of log) {
        const label = l.type === "note" ? `Notiz von ${l.agent_name}`
          : l.type === "email_sent" ? `Zahlungsdaten-Mail ausgelöst von ${l.agent_name}`
          : `Kontakt-Ergebnis (${l.agent_name}): ${l.outcome || "—"}`;
        events.push({ at: new Date(l.created_at).toISOString(), label, type: "agent", meta: l.note || undefined });
      }
    } catch { /* Kontakt-Log-Tabelle noch nicht angelegt */ }

    events.sort((x, y) => x.at.localeCompare(y.at));
    res.json({ ok: true, ref: a.ref, events });
  } catch (err) {
    console.error("[FIAON-PAYMENT] timeline:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Admin: Rechnungs-PDF (Download in Zahlungen-Tabelle + Detail)
router.get("/admin/payments/:paymentRef/invoice.pdf", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`SELECT * FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    let row = rows[0];
    if (!row.invoice_number) {
      await ensureInvoiceNumber(sqlPool, row.ref);
      row = (await sqlPool`SELECT * FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef}`)[0];
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${row.invoice_number || "FIAON-Rechnung"}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);
    renderInvoicePdf(doc, row);
    doc.end();
  } catch (err) {
    console.error("[FIAON-INVOICE] admin download:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Admin: ALLE Rechnungen mit einem Klick als ZIP (ein PDF je Rechnungsnummer + CSV-Übersicht).
// Enthält jede Bestellung mit vergebener Rechnungsnummer; sortiert nach Rechnungsnummer.
router.get("/admin/invoices/download-all", async (req, res) => {
  try {
    await ensurePaymentColumns();
    // Der Rechnungslauf brauchte kein einziges Byte der Anhaenge und zog
    // trotzdem 329 MB mit.
    const spalten = await antragsSpaltenOhneAnhaenge();
    const apps = (await sqlPool.unsafe(`
      SELECT ${spalten} FROM fiaon_applications
      WHERE invoice_number IS NOT NULL
      ORDER BY invoice_number ASC
    `)) as any[];
    if (apps.length === 0) {
      return res.status(404).json({ ok: false, error: "Keine Rechnungen vorhanden" });
    }

    const dateTag = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="FIAON_Rechnungen_${dateTag}.zip"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", (err: Error) => {
      console.error("[FIAON-INVOICES-ZIP] Archiver error:", err);
      try { res.end(); } catch { }
    });
    archive.pipe(res);

    // 1) CSV-Übersicht (BOM für Excel, Semikolon-getrennt, deutsche Formatierung)
    const csvHeader = [
      "Rechnungsnummer", "Rechnungsdatum", "Zahlungsreferenz", "Antrags-Nr.",
      "Kunde", "E-Mail", "Paket", "Betrag (EUR)", "Zahlungsstatus",
    ].join(";");
    const csvRows = apps.map((a: any) => [
      csvCell(a.invoice_number),
      a.invoice_date ? new Date(a.invoice_date).toLocaleDateString("de-DE") : "",
      csvCell(a.payment_reference), csvCell(a.ref),
      csvCell([a.first_name, a.last_name].filter(Boolean).join(" ") || a.contact_name || a.company_name || ""),
      csvCell(a.email), csvCell(a.pack_name ? String(a.pack_name).replace(/\n/g, " ") : ""),
      csvCell(a.amount_due != null ? Number(a.amount_due).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""),
      csvCell(a.payment_status),
    ].join(";"));
    const csv = "\uFEFF" + csvHeader + "\r\n" + csvRows.join("\r\n");
    archive.append(csv, { name: "Rechnungen_Uebersicht.csv" });

    // 2) Ein Rechnungs-PDF je Kunde
    for (const a of apps) {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const fileName = `Rechnungen/${a.invoice_number || a.payment_reference || a.ref}.pdf`;
      archive.append(doc as any, { name: fileName });
      renderInvoicePdf(doc, a);
      doc.end();
    }

    await archive.finalize();
    console.log(`[FIAON-INVOICES-ZIP] ${apps.length} Rechnungen als ZIP exportiert`);
  } catch (err) {
    console.error("[FIAON-INVOICES-ZIP]", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Fehler beim Erstellen des ZIP-Archivs" });
  }
});

// Öffentlicher, SIGNIERTER Rechnungs-Link mit Ablauf (für E-Mail-Anhänge via Make, invoice_url)
router.get("/invoice/:paymentRef.pdf", async (req, res) => {
  try {
    const { exp, sig } = req.query as { exp?: string; sig?: string };
    if (!exp || !sig || !verifyInvoiceSig(req.params.paymentRef, exp, sig)) {
      return res.status(403).json({ ok: false, error: "Link ungültig oder abgelaufen" });
    }
    await ensurePaymentColumns();
    const rows = await sqlPool`SELECT * FROM fiaon_applications WHERE payment_reference = ${req.params.paymentRef}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${rows[0].invoice_number || "FIAON-Rechnung"}.pdf"`);
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);
    renderInvoicePdf(doc, rows[0]);
    doc.end();
  } catch (err) {
    console.error("[FIAON-INVOICE] signed download:", err);
    if (!res.headersSent) res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Als bezahlt markieren → Freischaltung (Logik des früheren Stripe-Webhooks) + Willkommensmail
//
// `zahlungsdatum` (YYYY-MM-DD, optional, Vorgabe heute) ist das TATSÄCHLICHE
// Datum des Geldeingangs. Seit der Kontoabgleich abgeschaltet ist, wird manuell
// gebucht — zwischen Eingang und Klick können Tage liegen. `completed_at` ist
// der Ankerpunkt der Abo-Fälligkeit (+30 Tage); ohne dieses Feld würde jede
// verspätete Buchung den ganzen Zahlungszyklus des Kunden nach hinten schieben.
/**
 * DIE EINE BUCHUNG (herausgelöst am 06.08.2026).
 *
 * Seit die Vertriebsleitung Zahlungen buchen darf, gibt es zwei Aufrufer: die
 * Zahlungszentrale des Vorgesetzten und `/agent/vertrieb`. Eine zweite, „kleine"
 * Buchung im Vertriebsmodul wäre der sichere Weg in auseinanderlaufende
 * Zustände — eine Bestellung, die bezahlt ist, aber keine Provision auslöst,
 * oder ein Konto, das bezahlt ist und trotzdem nicht aufgeht.
 *
 * Deshalb steht hier ALLES, was „bezahlt" bedeutet, und nirgends sonst:
 * Zahlungsstatus, Antragsstatus, Konto-Freischaltung, Eingangsdatum als Anker
 * der Abo-Fälligkeit, Stilllegung der Schwesterbestellungen, Bestätigungsmail
 * (genau einmal) und die Provision für den berechtigten Betreuer.
 *
 * `quelle` wandert nur ins Protokoll — sie darf die Wirkung nicht verändern.
 * Eine Buchung der Vertriebsleitung muss dasselbe bewirken wie eine des
 * Vorgesetzten, sonst wäre sie eine halbe Buchung.
 */
export async function alsBezahltBuchen(
  paymentRef: string,
  opts: { zahlungsdatum?: string | null; quelle?: string } = {},
): Promise<{ ok: true; data: any; zahlungsdatum: string; naechsteAboFaelligkeit: string }
         | { ok: false; status: number; error: string }> {
  await ensurePaymentColumns();
  const { pruefeZahlungsdatum } = await import("./fiaon-abo");
  const pruefung = pruefeZahlungsdatum(opts.zahlungsdatum);
  if (pruefung.fehler) return { ok: false, status: 400, error: pruefung.fehler };
  // 12:00 UTC: liegt in jeder Zeitzone am gemeinten Tag — mit 00:00 wäre der
  // Eingang in Berliner Anzeige der Vortag.
  const eingang = `${pruefung.datum}T12:00:00Z`;

  // Paket Y: ATOMAR alles setzen, was der Login verlangt — kein zweiter Schritt.
  // payment_status='paid' + finaler Antragsstatus + Konto-Aktivierung. Ein bereits
  // suspendiertes Konto wird NICHT automatisch reaktiviert (Admin-Not-Aus bleibt).
  const rows = await sqlPool`
    UPDATE fiaon_applications SET
      payment_status = 'paid',
      status = 'payment_completed',
      account_status = CASE WHEN account_status = 'suspended' THEN account_status ELSE 'active' END,
      completed_at = COALESCE(completed_at, ${eingang}),
      updated_at = NOW()
    WHERE payment_reference = ${paymentRef}
    RETURNING ref, payment_reference, payment_due_date, amount_due, first_name, contact_name, email, contact_email, billing_email, pack_name, account_status, completed_at
  `;
  if (rows.length === 0) return { ok: false, status: 404, error: "Bestellung nicht gefunden" };

  console.log(`[FIAON-PAYMENT] Als bezahlt markiert: ${paymentRef} (ref=${rows[0].ref}, Quelle: ${opts.quelle || "admin"})`);
  // Paket AD1: offene Schwester-Bestellungen derselben E-Mail automatisch superseden
  supersedeSisterOrders(rows[0].ref).catch((e) => console.error("[FIAON-DUBLETTE] supersede:", e));
  // Paket X: Bestätigung läuft über Make ('payment_confirmed' mit login_url) —
  // ersetzt die frühere direkte Plattform-Freischaltmail. Genau 1× pro Bestellung
  // (atomarer Flag-Claim), damit ALLE Kundenmails einheitlich über Make/Brevo laufen.
  await sendPaymentConfirmedOnce(rows[0].ref);
  // Provisions-Engine (G3): fester Eintrag für den zugewiesenen Agent (Satz wird eingefroren).
  // Der Hook legt auch die Abo-Ratenkette an — sie rechnet ab `completed_at`.
  import("./fiaon-agent").then((m) => m.onCustomerPaid(rows[0].ref)).catch((e) => console.error("[FIAON-COMMISSION]", e));

  return {
    ok: true,
    data: rows[0],
    zahlungsdatum: pruefung.datum,
    // Damit die Oberfläche sofort sagen kann, wann die erste Monatsrate fällig ist.
    naechsteAboFaelligkeit: new Date(new Date(rows[0].completed_at || eingang).getTime() + 30 * 86_400_000)
      .toISOString().slice(0, 10),
  };
}

router.post("/admin/payments/:paymentRef/mark-paid", async (req, res) => {
  try {
    const e = await alsBezahltBuchen(req.params.paymentRef, {
      zahlungsdatum: req.body?.zahlungsdatum, quelle: "admin",
    });
    if (!e.ok) return res.status(e.status).json({ ok: false, error: e.error });
    res.json({ ok: true, data: e.data, zahlungsdatum: e.zahlungsdatum, naechsteAboFaelligkeit: e.naechsteAboFaelligkeit });
  } catch (err) {
    console.error("[FIAON-PAYMENT] mark-paid:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Paket Y: Manueller Backfill-Trigger — schaltet alle bezahlten, aber nie
// aktivierten Konten nachträglich frei (idempotent, KEINE Mails). Läuft zusätzlich
// automatisch einmal beim Serverstart (backfillPaidAccessOnce).
router.post("/admin/payments/backfill-access", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const result = await backfillPaidAccess();
    console.log(`[FIAON-ACCESS-BACKFILL] Manuell: ${result.count} freigeschaltet: ${result.refs.join(", ") || "—"}`);
    res.json({ ok: true, count: result.count, refs: result.refs });
  } catch (err) {
    console.error("[FIAON-ACCESS-BACKFILL] manuell:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Paket DB: Einmalige Daten-Reparatur — bezahlte, UNZUGEWIESENE Bestellungen
// erben die Agent-Zuweisung ihrer superseded Schwester (gleiche E-Mail).
// Heilt die Altfälle vor dem Root-Cause-Fix (Attribution ging beim Dubletten-
// Schließen verloren). KEINE automatische Provision — nur Sichtbarkeit/Zuordnung;
// Provision bucht der Admin bewusst über die manuelle Buchung im Agent-Detail.
// Paket EC: Vorschau für den „Zuordnung reparieren"-Button — zeigt, welche
// bezahlten Bestellungen ohne Agent eine zuordenbare Dublette haben (nur SELECT).
// Idempotent-Nachweis: nach erfolgtem Repair liefert diese Vorschau 0.
router.get("/admin/payments/repair-attribution/preview", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT p.ref, p.payment_reference,
             COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''), p.company_name, p.contact_name, p.email) AS customer_name,
             s.assigned_agent_id, ag.name AS agent_name, s.ref AS donor_ref
      FROM fiaon_applications p
      JOIN (
        SELECT DISTINCT ON (LOWER(TRIM(email))) LOWER(TRIM(email)) AS em, assigned_agent_id, ref
        FROM fiaon_applications
        WHERE payment_status = 'superseded' AND assigned_agent_id IS NOT NULL
          AND email IS NOT NULL AND TRIM(email) != ''
        ORDER BY LOWER(TRIM(email)), updated_at DESC
      ) s ON LOWER(TRIM(p.email)) = s.em
      LEFT JOIN fiaon_agents ag ON ag.id = s.assigned_agent_id
      WHERE p.payment_status = 'paid' AND p.assigned_agent_id IS NULL AND p.merged_into IS NULL
      ORDER BY p.updated_at DESC
    `;
    res.json({ ok: true, count: rows.length, refs: rows });
  } catch (err) {
    console.error("[FIAON-REPAIR-ATTRIBUTION] preview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/payments/repair-attribution", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const repaired = await sqlPool`
      UPDATE fiaon_applications p SET assigned_agent_id = s.assigned_agent_id, updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (LOWER(TRIM(email))) LOWER(TRIM(email)) AS em, assigned_agent_id, ref
        FROM fiaon_applications
        WHERE payment_status = 'superseded' AND assigned_agent_id IS NOT NULL
          AND email IS NOT NULL AND TRIM(email) != ''
        ORDER BY LOWER(TRIM(email)), updated_at DESC
      ) s
      WHERE p.payment_status = 'paid' AND p.assigned_agent_id IS NULL AND p.merged_into IS NULL
        AND LOWER(TRIM(p.email)) = s.em
      RETURNING p.ref, s.assigned_agent_id, s.ref AS donor_ref
    `;
    for (const r of repaired) {
      const agents = await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${r.assigned_agent_id}`;
      const agentName = agents[0]?.name || `Agent #${r.assigned_agent_id}`;
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${r.ref}, NULL, 'System', 'system',
                ${`Zuweisung nachträglich von Dublette ${r.donor_ref} übernommen: ${agentName} betreute diesen Kunden (Reparatur; Provision ggf. manuell prüfen)`})
      `;
    }
    console.log(`[FIAON-REPAIR-ATTRIBUTION] ${repaired.length} bezahlte Bestellung(en) nachträglich zugeordnet`);
    res.json({ ok: true, count: repaired.length, refs: repaired.map((r: any) => ({ ref: r.ref, agentId: r.assigned_agent_id, donor: r.donor_ref })) });
  } catch (err) {
    console.error("[FIAON-REPAIR-ATTRIBUTION]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * Abgelaufene Bestellung reaktivieren — EINE geteilte Quelle für Admin UND Agent.
 * Geschäftsleitungs-Direktive: Kein Kunde wird je „deaktiviert"; „abgelaufen" ist
 * nur ein Zahlungsfenster-Zustand und bleibt jederzeit reaktivierbar. Setzt neue
 * 7-Tage-Frist, weckt die Erinnerungs-Kette (Zähler zurück) und stößt die
 * Zahlungsdaten-Mail erneut an. Optional: unzugewiesene Bestellung dem handelnden
 * Agent zuordnen (er hat gerade telefoniert / den Abschluss gemacht).
 */
export async function reactivateOrderByRef(
  ref: string,
  opts: { assignAgentId?: number | null } = {},
): Promise<any | null> {
  await ensurePaymentColumns();
  const dueDate = new Date(Date.now() + PAYMENT_DUE_DAYS * 24 * 60 * 60 * 1000);
  const assign = opts.assignAgentId ?? null;
  const rows = await sqlPool`
    UPDATE fiaon_applications SET
      payment_status = 'pending_payment',
      payment_due_date = ${dueDate},
      reminder_sent_at_24h = NULL,
      reminder_sent_at_72h = NULL,
      reminder_count = 0,
      last_reminder_at = NULL,
      payment_email_sent_at = NOW(),
      followup_sent_at = NULL,
      assigned_agent_id = CASE WHEN assigned_agent_id IS NULL AND ${assign}::int IS NOT NULL
                               THEN ${assign}::int ELSE assigned_agent_id END,
      updated_at = NOW()
    WHERE ref = ${ref} AND payment_status = 'expired' AND merged_into IS NULL
    RETURNING ref, payment_reference, payment_due_date, amount_due, first_name, last_name,
              contact_name, email, contact_email, billing_email, pack_name, assigned_agent_id
  `;
  if (rows.length === 0) return null;
  console.log(`[FIAON-PAYMENT] Reaktiviert: ${ref} (neue Frist ${dueDate.toISOString()}${assign ? `, Agent #${assign}` : ""})`);
  sendMakeWebhook("payment_details", makePayloadFromRow(rows[0])).catch(() => {});
  return rows[0];
}

// Abgelaufene Bestellung reaktivieren (Admin): neue 7-Tage-Frist + Template 1 erneut
router.post("/admin/payments/:paymentRef/reactivate", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const [found] = await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE payment_reference = ${req.params.paymentRef} AND payment_status = 'expired' AND merged_into IS NULL
      LIMIT 1
    `;
    if (!found) return res.status(404).json({ ok: false, error: "Keine abgelaufene Bestellung mit dieser Referenz gefunden" });
    const data = await reactivateOrderByRef(found.ref);
    if (!data) return res.status(404).json({ ok: false, error: "Keine abgelaufene Bestellung mit dieser Referenz gefunden" });
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[FIAON-PAYMENT] reactivate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Reminder & Ablauf — TÄGLICHE REMINDER-ENGINE (Paket V) ──────────
// Ersetzt die alte einmalige 48h-Logik ('followup_48h', deprecated):
// Jede unbezahlte Bestellung (pending_payment/claimed_paid) erhält EINMAL
// pro Tag das Event 'payment_reminder' — erste Erinnerung 24h nach
// Bestellung, danach täglich im Versandfenster (Default 10:00–11:00 Uhr
// Europe/Berlin, NIE außerhalb 08:00–20:00). Kanalübergreifende Dedupe:
// max. 1 Reminder pro 20h via last_reminder_at (Engine + Bulk + Agent-
// Mail zählen zusammen). Obergrenze MAX_REMINDERS (Default 6) — das ist
// eine Mengenbremse gegen Belästigung, keine Abschaltung: Der Kunde bleibt
// danach in jeder Arbeits- und Zahlungsliste und ist ein Anruf-Kandidat.
//
// Seit dem 08.08.2026 beendet der Fristablauf die Erinnerungen NICHT mehr:
// Es wird kein 'expired' mehr geschrieben, die Bestellung bleibt
// 'pending_payment' und läuft regulär bis zur Obergrenze weiter (Teil 0).
// paid stoppt sofort; die 196 Altbestand-Zeilen mit 'expired' bleiben aus
// dem Versand heraus, damit aus der Umstellung keine Mail-Welle an lange
// zurückliegende Bestellungen wird.

/** Aktuelle Stunde in Europe/Berlin (0–23). formatToParts, weil format()
 *  je nach Locale Text anhängt (de-DE: „14 Uhr“ → NaN). */
export function berlinHour(): number {
  const parts = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(new Date());
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "", 10);
  return Number.isFinite(h) ? h % 24 : new Date().getUTCHours(); // Fallback: UTC (konservativ)
}

/** Hartes Sicherheitsfenster: Engine + Bulk versenden NIE außerhalb 08–20 Uhr Berlin. */
function withinHardWindow(): boolean {
  const h = berlinHour();
  return h >= 8 && h < 20;
}

const REMINDER_BATCH = 50;

/** Atomarer Batch-Claim erinnerungswürdiger Bestellungen (stempelt last_reminder_at + reminder_count). */
async function claimReminderBatch(
  limit: number,
  opts: { requireAge24h: boolean; maxReminders: number | null; abstandStunden?: number },
) {
  // Wie lange muss die letzte Erinnerung her sein? 20 h = einmal am Tag;
  // 5 h = zweimal am Tag (Justins Vorgabe 28.08.: offene Rechnungen 2×/Tag).
  // Der Wert kommt aus runPaymentReminders (Einstellung mahn_takte_pro_tag).
  const abstand = Math.max(2, Math.round(opts.abstandStunden ?? 20));
  return sqlPool`
    UPDATE fiaon_applications
    SET last_reminder_at = NOW(), reminder_count = COALESCE(reminder_count, 0) + 1, updated_at = NOW()
    WHERE ref IN (
      SELECT fa.ref FROM fiaon_applications fa
      WHERE fa.payment_status IN ('pending_payment', 'claimed_paid')
        AND fa.payment_reference IS NOT NULL AND fa.merged_into IS NULL
        -- Archivierte Bestellungen bekommen nichts mehr: Eine Erinnerung an
        -- einen Testeintrag oder eine doppelt angelegte Bestellung ist eine
        -- Mail, die der Kunde nicht versteht.
        AND fa.archived_at IS NULL
        AND COALESCE(NULLIF(fa.email, ''), NULLIF(fa.contact_email, ''), NULLIF(fa.billing_email, '')) IS NOT NULL
        AND (fa.last_reminder_at IS NULL OR fa.last_reminder_at < NOW() - make_interval(hours => ${abstand}))
        AND (${!opts.requireAge24h} OR COALESCE(fa.payment_email_sent_at, fa.created_at) < NOW() - INTERVAL '24 hours')
        AND (${opts.maxReminders == null} OR COALESCE(fa.reminder_count, 0) < ${opts.maxReminders ?? 0})
        -- Paket AD2 (doppelter Boden): keine Erinnerung an Menschen, die schon
        -- bezahlt haben. GEMESSEN am 28.08.2026: 896 Erinnerungen in 30 Tagen an
        -- 221 Menschen mit bezahlter Bestellung — der alte Wächter verglich NUR
        -- fa.email gegen p.email. Wer über contact_email/billing_email lief oder
        -- über die PERSON verbunden war, rutschte durch. Jetzt zählt beides:
        -- dieselbe Person (059: fiaon_persons ist die Wahrheit) ODER irgendeine
        -- der drei Adressen. Admin-Override pro Bestellung bleibt:
        -- allow_reminders_despite_paid (echter Zweitkauf).
        AND (fa.allow_reminders_despite_paid = TRUE OR NOT EXISTS (
          SELECT 1 FROM fiaon_applications p
          WHERE p.payment_status = 'paid' AND p.merged_into IS NULL
            AND (
              (fa.person_id IS NOT NULL AND p.person_id = fa.person_id)
              OR (COALESCE(NULLIF(TRIM(fa.email), ''), NULLIF(TRIM(fa.contact_email), ''), NULLIF(TRIM(fa.billing_email), '')) IS NOT NULL
                  AND LOWER(COALESCE(NULLIF(TRIM(p.email), ''), NULLIF(TRIM(p.contact_email), ''), NULLIF(TRIM(p.billing_email), '')))
                    = LOWER(COALESCE(NULLIF(TRIM(fa.email), ''), NULLIF(TRIM(fa.contact_email), ''), NULLIF(TRIM(fa.billing_email), ''))))
            )
        ))
      ORDER BY fa.created_at ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING ref, payment_reference, amount_due, first_name, last_name, contact_name,
              email, contact_email, billing_email, pack_name, reminder_count
  `;
}

function reminderPayload(r: any) {
  return {
    ...makePayloadFromRow(r),
    invoice_url: r.payment_reference ? signInvoiceUrl(r.payment_reference) : null,
    reminder_number: Number(r.reminder_count || 1),
  };
}

async function runPaymentReminders(opts: { force?: boolean } = {}): Promise<{ expired: number; fristAbgelaufen: number; remindersSent: number; skippedWindow: boolean }> {
  await ensurePaymentColumns();
  const result = { expired: 0, fristAbgelaufen: 0, remindersSent: 0, skippedWindow: false };

  // 1) Abgelaufene Fristen ZÄHLEN — nicht mehr schreiben.
  //
  // Bis zum 08.08.2026 stand hier ein UPDATE auf payment_status='expired'.
  // Das war die einzige Stelle im Haus, an der sich ein Kunde ohne jede
  // menschliche Entscheidung selbst abgeschaltet hat: Mit 'expired' fiel er aus
  // der Erinnerungs-Engine (Status-Filter in claimReminderBatch) und wurde in
  // Anzeigen zum Altfall. Ein Kunde, der zahlen will und drei Tage zu spät
  // dran ist, ist ein ANRUF — kein Abfall.
  //
  // „Frist abgelaufen" ist seither ein ETIKETT, das aus payment_due_date
  // abgeleitet wird (fristAbgelaufenSql in lib/fiaon-bestand-filter.ts). Es
  // färbt Anzeigen und speist Filter, ändert aber keinen Zustand. Die 196
  // Altbestand-Zeilen mit 'expired' bleiben unangetastet und werden von
  // demselben Etikett weiterhin erfasst.
  const [frist] = await sqlPool`
    SELECT COUNT(*)::int AS n
    FROM fiaon_applications
    WHERE payment_status = 'pending_payment'
      AND payment_due_date IS NOT NULL AND payment_due_date < NOW()
      AND merged_into IS NULL AND archived_at IS NULL
  `;
  result.fristAbgelaufen = Number(frist?.n || 0);
  if (result.fristAbgelaufen > 0) {
    console.log(`[FIAON-PAYMENT] Frist abgelaufen (Etikett, kein Zustand): ${result.fristAbgelaufen} Bestellung(en) — bleiben in Arbeits- und Zahlungslisten`);
  }

  // 2) Tägliche Reminder-Engine (Not-Aus + Versandfenster aus Admin-Einstellungen)
  const { getSettings } = await import("./fiaon-agent");
  const settings = await getSettings();
  if (settings.reminder_engine_enabled !== "1") {
    result.skippedWindow = true;
    return result;
  }
  const winStart = Math.min(19, Math.max(8, Math.round(Number(settings.reminder_window_start)) || 10));
  const winEnd = Math.min(20, Math.max(winStart + 1, Math.round(Number(settings.reminder_window_end)) || winStart + 1));
  const hour = berlinHour();
  const inWindow = hour >= winStart && hour < winEnd;
  // Manueller Trigger (force) darf das kleine Fenster ignorieren — das harte 08–20-Fenster NIE.
  if ((!opts.force && !inWindow) || !withinHardWindow()) {
    result.skippedWindow = true;
    return result;
  }
  const maxReminders = Math.max(0, Math.round(Number(settings.max_reminders)) || 6);
  // Justins Vorgabe (28.08.2026): offene Rechnungen 2× am Tag anmahnen.
  // mahn_takte_pro_tag steuert das aus dem Mailwerk: 2 → Mindestabstand 5 h
  // (der stündliche Lauf trifft damit vormittags und nachmittags je einmal),
  // 1 → wie früher 20 h. Das harte 08–20-Fenster oben bleibt unberührt.
  const takte = Math.min(3, Math.max(1, Math.round(Number(settings.mahn_takte_pro_tag)) || 2));
  const abstandStunden = takte >= 2 ? Math.floor(10 / takte) : 20;

  // Batch-Schleife: speicherschonend, atomarer Claim verhindert Doppelversand
  for (;;) {
    const batch = await claimReminderBatch(REMINDER_BATCH, { requireAge24h: true, maxReminders, abstandStunden });
    if (batch.length === 0) break;
    for (const r of batch) {
      await sendMakeWebhook("payment_reminder", reminderPayload(r));
      result.remindersSent++;
    }
    if (batch.length < REMINDER_BATCH) break;
  }
  if (result.remindersSent) console.log(`[FIAON-PAYMENT] Reminder-Engine: ${result.remindersSent} Zahlungserinnerung(en) versendet`);

  return result;
}

// Stündlicher Reminder-Lauf (fail-safe). Nur im Betrieb: Diese Schleife
// verschickt Zahlungserinnerungen an echte Kunden — auf einem
// Entwicklungsrechner hat sie nichts verloren (server/lib/fiaon-crons.ts).
import("../lib/fiaon-crons").then(({ tageslauf }) => {
  tageslauf("zahlungserinnerungen", () => {
    runPaymentReminders().catch((err) => console.error("[FIAON-PAYMENT] Reminder-Cron:", err));
  }, 60 * 60 * 1000);
  // Die Abbruch-Kette (E-023) prüft alle fünf Minuten — die 10-Minuten-Mail
  // und die Tagesfenster (07:30, 15:00, 16:30, 19:00) brauchen diesen Takt.
  tageslauf("antrag-erinnerungen", () => {
    void import("../lib/fiaon-antrag-erinnerung")
      .then(({ antragErinnerungenLauf }) => antragErinnerungenLauf())
      .catch((err) => console.error("[ANTRAG-ERINNERUNG] Lauf:", err));
  }, 5 * 60 * 1000, { beimStartNach: 60_000 });
});

/**
 * GET /antrag/weiter/:token — der Wiedereinstieg aus der Erinnerungsmail.
 * Liefert den gespeicherten Stand (ohne Passwort), damit der Antrag genau dort
 * weitergeht, wo der Kunde aufgehört hat.
 */
router.get("/antrag/weiter/:token", async (req, res) => {
  try {
    const { weiterPruefen } = await import("../lib/fiaon-antrag-erinnerung");
    const ref = weiterPruefen(String(req.params.token || ""));
    if (!ref) return res.status(410).json({ ok: false, error: "Dieser Link ist abgelaufen. Bitte starten Sie den Antrag neu — es dauert nur wenige Minuten." });
    const [a] = (await sqlPool`
      SELECT ref, type, status, current_step, pack_key, first_name, last_name, birthdate, phone, phone_country_code,
             street, zip, city, country, nationality, employment, employer, employed_since, income, rent, debts, housing,
             wanted_limit, purpose, billing, addon, nfc, email, salary_receipt_day, billing_method, approved_limit,
             payment_reference, payment_status
      FROM fiaon_applications WHERE ref = ${ref} AND merged_into IS NULL AND gdpr_deleted_at IS NULL LIMIT 1
    `) as any[];
    if (!a) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden." });
    if (a.payment_reference || a.payment_status === "paid") {
      return res.json({ ok: true, fertig: true, zahlung: a.payment_reference ? `/zahlung/${a.payment_reference}` : "/login" });
    }
    const g = a.birthdate ? String(a.birthdate).slice(0, 10).split("-") : null;
    res.json({
      ok: true, ref: a.ref, type: a.type, status: a.status, currentStep: Number(a.current_step || 1), packKey: a.pack_key || null,
      daten: {
        firstName: a.first_name || "", lastName: a.last_name || "",
        birthYear: g?.[0] || "", birthMonth: g ? String(Number(g[1])) : "", birthDay: g ? String(Number(g[2])) : "",
        phone: a.phone || "", phoneCountryCode: a.phone_country_code || "", street: a.street || "", zip: a.zip || "", city: a.city || "",
        country: a.country || "", nationality: a.nationality || "", employment: a.employment || "", employer: a.employer || "",
        employedSince: a.employed_since || "", income: Number(a.income || 0), rent: Number(a.rent || 0), debts: Number(a.debts || 0),
        housing: a.housing || "", wantedLimit: Number(a.wanted_limit || 0), purpose: a.purpose || "", billing: a.billing || undefined,
        addon: a.addon || undefined, nfc: a.nfc || undefined, email: a.email || "", salaryReceiptDay: a.salary_receipt_day || "",
        billingMethod: a.billing_method || undefined,
      },
      approvedLimit: Number(a.approved_limit || 0),
    });
  } catch (err) {
    console.error("[ANTRAG] weiter:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Manueller Trigger für Tests / Admin (inkl. Rückruf-Erinnerungen, J2)
router.post("/admin/payments/run-reminders", async (_req, res) => {
  try {
    const result = await runPaymentReminders({ force: true });
    const callbackReminders = await import("./fiaon-agent").then((m) => m.runCallbackReminders()).catch(() => 0);

    // ── DIE ERSTEN RECHNUNGEN ─────────────────────────────────────────────
    // Der Vorgesetzte: „ALLE die einen Antrag bei uns gestellt haben brauchen
    // eine Rechnung und müssen täglich versendet werden."
    //
    // OHNE OBERGRENZE. Hier standen fuenfzig am Tag; der Vorgesetzte am
    // 11.08.2026: „Die 50 am Tag erhoehen wir auf unlimitiert." Die Antraege
    // sind im Schnitt 48 Tage alt — wer zwei Monate auf eine Rechnung wartet,
    // wartet nicht noch eine Woche, weil ein Zustellrisiko besteht.
    const rechnungen = await import("../lib/fiaon-rechnung-stellen")
      .then((m) => m.rechnungenTageslauf({ schreiben: true }))
      .catch((e) => { console.error("[RECHNUNG] Tageslauf:", e); return { versendet: 0 }; });
    res.json({ ok: true, ...result, callbackReminders });
  } catch (err) {
    console.error("[FIAON-PAYMENT] run-reminders:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PAKET W: BULK „AN ALLE UNBEZAHLTEN ERINNERN" ═══════════════
// Hintergrund-Job: versendet 'payment_reminder' an alle offenen Bestellungen,
// in Batches von max. 20 Events/Minute (Rate-Limit-Schutz Richtung Make),
// speicherschonend über atomare Batch-Claims (kein Full-Table-Load).
// Dieselbe 20h-Dedupe wie die Engine (last_reminder_at, kanalübergreifend).

const BULK_BATCH = 20; // = max. Events pro Minute

interface BulkJobState {
  running: boolean;
  startedAt: string;
  finishedAt: string | null;
  planned: number;
  sent: number;
  errors: number;
}
let bulkJob: BulkJobState | null = null;

/** Zählung für den Bestätigungsdialog: wer bekommt die Erinnerung, wer wird übersprungen. */
// ═══════════════════════════════════════════════════════════════════════════
// ERSTE RECHNUNGEN — DER KNOPF FÜR ALLE
//
// ── DER AUFTRAG (11.08.2026) ───────────────────────────────────────────────
// Der Vorgesetzte: „Ich möchte als Admin eine eigene Seite, wo ich ALLE
// Rechnungen mit einem Knopfdruck versenden kann (oder in der Zahlungszentrale
// hinzufügen, da gibt es schon einen — aber schau, dass der dann für alle
// anderen geht, also ALLE die einen Antrag gestellt haben!)"
//
// ── WARUM NICHT DER BESTEHENDE KNOPF ───────────────────────────────────────
// „Zahlungserinnerung an alle offenen senden" schickt `payment_reminder` an
// Kunden mit `pending_payment` — also an solche, die eine Rechnung HABEN und
// nicht zahlen. Das ist eine Mahnung.
//
// Die 264 hier haben nie eine bekommen. Eine Mahnung an jemanden, dem man nie
// eine Rechnung geschickt hat, ist eine Unverschämtheit — und der Text der
// Vorlage („Ihre Zahlung steht noch aus") wäre schlicht falsch.
//
// Deshalb ein eigener Lauf mit eigener Vorlage (`payment_details`). Danach
// stehen sie auf `pending_payment` und der bestehende Mahnlauf greift von
// selbst.
// ═══════════════════════════════════════════════════════════════════════════

/** GET /admin/rechnungen/erste/vorschau — wer bekäme eine erste Rechnung? */
router.get("/admin/rechnungen/erste/vorschau", async (_req, res) => {
  try {
    const { rechnungsKandidaten } = await import("../lib/fiaon-rechnung-stellen");
    const alle = await rechnungsKandidaten({ grenze: 5000 });
    const versendbar = alle.filter((k) => !k.hindernis);
    // Die Hindernisse gruppiert — damit der Betreiber sieht, was fehlt.
    const hindernisse: Record<string, number> = {};
    for (const k of alle) {
      if (!k.hindernis) continue;
      const kurz = k.hindernis.split("—")[0].trim();
      hindernisse[kurz] = (hindernisse[kurz] ?? 0) + 1;
    }
    const summe = versendbar.reduce((s, k) => s + k.betragCents, 0);
    res.json({
      ok: true,
      gesamt: alle.length,
      versendbar: versendbar.length,
      summeCents: summe,
      hindernisse,
      // Die ältesten zuerst — sie warten am längsten.
      aelteste: versendbar.slice(0, 5).map((k) => ({
        name: k.name, paket: k.bezeichnung, tageAlt: k.tageAlt,
        betragCents: k.betragCents,
      })),
      laeuft: ersteRechnungenLaeuft,
      letzterLauf: ersteRechnungenErgebnis,
    });
  } catch (err) {
    console.error("[RECHNUNG] vorschau:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Läuft gerade ein Lauf? Ein zweiter parallel wäre doppelter Versand. */
let ersteRechnungenLaeuft = false;
let ersteRechnungenErgebnis: { am: string; versendet: number; gescheitert: number } | null = null;

/**
 * POST /admin/rechnungen/erste/senden — alle auf einen Knopfdruck.
 *
 * ── WARUM IM HINTERGRUND ───────────────────────────────────────────────────
 * 264 Rechnungen brauchen bei einer Sekunde je Mail über vier Minuten. Eine
 * HTTP-Antwort, die so lange offen bleibt, läuft in jedes Zeitlimit — und der
 * Betreiber sieht einen Fehler, während der Lauf weiterläuft.
 *
 * Deshalb: sofort antworten, im Hintergrund arbeiten, Fortschritt über die
 * Vorschau-Route.
 */
router.post("/admin/rechnungen/erste/senden", async (_req, res) => {
  if (ersteRechnungenLaeuft) {
    return res.status(409).json({ ok: false, error: "Es läuft bereits ein Versand." });
  }
  ersteRechnungenLaeuft = true;
  res.json({ ok: true, meldung: "Der Versand läuft. Der Fortschritt steht oben auf der Seite." });

  void (async () => {
    try {
      const { rechnungenTageslauf } = await import("../lib/fiaon-rechnung-stellen");
      const erg = await rechnungenTageslauf({ schreiben: true });
      ersteRechnungenErgebnis = {
        am: new Date().toISOString(),
        versendet: erg.versendet, gescheitert: erg.gescheitert,
      };
    } catch (err) {
      console.error("[RECHNUNG] Massenversand:", err);
    } finally {
      ersteRechnungenLaeuft = false;
    }
  })();
});

router.get("/admin/payments/bulk-reminder/preview", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const [row] = await sqlPool`
      SELECT
        COUNT(*) FILTER (WHERE (last_reminder_at IS NULL OR last_reminder_at < NOW() - INTERVAL '20 hours')) AS eligible,
        COUNT(*) FILTER (WHERE last_reminder_at IS NOT NULL AND last_reminder_at >= NOW() - INTERVAL '20 hours') AS skipped
      FROM fiaon_applications fa
      WHERE fa.payment_status IN ('pending_payment', 'claimed_paid')
        AND fa.payment_reference IS NOT NULL AND fa.merged_into IS NULL
        -- Archivierte Bestellungen bekommen nichts mehr: Eine Erinnerung an
        -- einen Testeintrag oder eine doppelt angelegte Bestellung ist eine
        -- Mail, die der Kunde nicht versteht.
        AND fa.archived_at IS NULL
        AND COALESCE(NULLIF(fa.email, ''), NULLIF(fa.contact_email, ''), NULLIF(fa.billing_email, '')) IS NOT NULL
        -- Paket AD2: E-Mails mit bezahlter Bestellung sind ausgeschlossen (wie Engine)
        AND (fa.allow_reminders_despite_paid = TRUE OR fa.email IS NULL OR TRIM(fa.email) = '' OR NOT EXISTS (
          SELECT 1 FROM fiaon_applications p
          WHERE p.payment_status = 'paid' AND p.email IS NOT NULL
            AND LOWER(TRIM(p.email)) = LOWER(TRIM(fa.email))
        ))
    `;
    res.json({
      ok: true,
      eligible: Number(row.eligible),
      skipped: Number(row.skipped),
      withinWindow: withinHardWindow(),
      jobRunning: Boolean(bulkJob?.running),
    });
  } catch (err) {
    console.error("[FIAON-BULK] preview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Startet den Hintergrund-Job (nur einer gleichzeitig; nur 08–20 Uhr Berlin). */
router.post("/admin/payments/bulk-reminder/start", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    if (bulkJob?.running) return res.status(409).json({ ok: false, error: "Es läuft bereits ein Bulk-Versand" });
    if (!withinHardWindow()) {
      return res.status(400).json({ ok: false, error: "Versand nur zwischen 08:00 und 20:00 Uhr (Europa/Berlin) möglich" });
    }
    const [row] = await sqlPool`
      SELECT COUNT(*) AS eligible FROM fiaon_applications fa
      WHERE fa.payment_status IN ('pending_payment', 'claimed_paid')
        AND fa.payment_reference IS NOT NULL AND fa.merged_into IS NULL
        -- Archivierte Bestellungen bekommen nichts mehr: Eine Erinnerung an
        -- einen Testeintrag oder eine doppelt angelegte Bestellung ist eine
        -- Mail, die der Kunde nicht versteht.
        AND fa.archived_at IS NULL
        AND COALESCE(NULLIF(fa.email, ''), NULLIF(fa.contact_email, ''), NULLIF(fa.billing_email, '')) IS NOT NULL
        AND (fa.last_reminder_at IS NULL OR fa.last_reminder_at < NOW() - INTERVAL '20 hours')
        -- Paket AD2: E-Mails mit bezahlter Bestellung sind ausgeschlossen (wie Engine)
        AND (fa.allow_reminders_despite_paid = TRUE OR fa.email IS NULL OR TRIM(fa.email) = '' OR NOT EXISTS (
          SELECT 1 FROM fiaon_applications p
          WHERE p.payment_status = 'paid' AND p.email IS NOT NULL
            AND LOWER(TRIM(p.email)) = LOWER(TRIM(fa.email))
        ))
    `;
    const planned = Number(row.eligible);
    bulkJob = { running: true, startedAt: new Date().toISOString(), finishedAt: null, planned, sent: 0, errors: 0 };
    res.json({ ok: true, planned });

    // Hintergrund-Schleife (fire-and-forget; Status via /bulk-reminder/status)
    (async () => {
      const job = bulkJob!;
      try {
        for (;;) {
          if (!withinHardWindow()) break; // Fenster während des Laufs verlassen → sauber stoppen
          const batch = await claimReminderBatch(BULK_BATCH, { requireAge24h: false, maxReminders: null });
          if (batch.length === 0) break;
          for (const r of batch) {
            const ok = await sendMakeWebhook("payment_reminder", reminderPayload(r));
            if (ok) job.sent++;
            else job.errors++;
          }
          if (batch.length < BULK_BATCH) break;
          // Rate-Limit: max. 20 Events/Minute Richtung Make
          await new Promise((r) => setTimeout(r, 60_000));
        }
      } catch (err) {
        console.error("[FIAON-BULK] Job-Fehler:", err);
      } finally {
        job.running = false;
        job.finishedAt = new Date().toISOString();
        // Audit-Log-Eintrag (erscheint im Admin-Audit über den bestehenden agent-log-Endpoint)
        try {
          await sqlPool`
            INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
            VALUES ('SYSTEM', NULL, 'Admin', 'system',
                    ${`Bulk-Zahlungserinnerung: ${job.sent} versendet, ${Math.max(0, job.planned - job.sent - job.errors)} übrig/übersprungen, ${job.errors} Fehler (geplant: ${job.planned})`})
          `;
        } catch (logErr) {
          console.error("[FIAON-BULK] Audit-Log:", logErr);
        }
        console.log(`[FIAON-BULK] Abgeschlossen: ${job.sent}/${job.planned} versendet, ${job.errors} Fehler`);
      }
    })();
  } catch (err) {
    console.error("[FIAON-BULK] start:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Fortschritt des laufenden/letzten Bulk-Jobs. */
router.get("/admin/payments/bulk-reminder/status", async (_req, res) => {
  res.json({ ok: true, job: bulkJob });
});

// ═══════════ PAKET AD3 — Dubletten-Werkzeuge, Storno & DSGVO ═══════════

// Bestellung stornieren: Status 'cancelled', stoppt Reminder/Listen sofort,
// storniert vorhandene Provisionen (bestehende Clawback-Mechanik). Mit Audit.
router.post("/admin/payments/:paymentRef/cancel", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        payment_status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef}
        AND payment_status IN ('pending_payment', 'claimed_paid', 'expired', 'paid')
      RETURNING ref, payment_status
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden oder bereits storniert" });
    const commissions = await import("./fiaon-agent").then((m) => m.onCustomerRefunded(rows[0].ref)).catch(() => ({ cancelled: 0, clawback: 0 }));
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${rows[0].ref}, NULL, 'Admin', 'system',
              ${`Bestellung storniert (Admin) — Provisionen: ${commissions.cancelled} storniert, ${commissions.clawback} verrechnet`})
    `;
    console.log(`[FIAON-CANCEL] ${req.params.paymentRef} storniert (Provision: ${JSON.stringify(commissions)})`);
    res.json({ ok: true, ref: rows[0].ref, commissions });
  } catch (err) {
    console.error("[FIAON-CANCEL]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Reminder-Override für echten Zweitkauf: „Erinnerungen trotz bezahlter
// Schwester-Bestellung erlauben“ (Paket AD2, Admin-Detailansicht).
router.post("/admin/payments/:paymentRef/allow-reminders", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const allow = Boolean(req.body?.allow);
    const rows = await sqlPool`
      UPDATE fiaon_applications SET allow_reminders_despite_paid = ${allow}, updated_at = NOW()
      WHERE payment_reference = ${req.params.paymentRef}
      RETURNING ref
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Bestellung nicht gefunden" });
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${rows[0].ref}, NULL, 'Admin', 'system',
              ${allow ? "Erinnerungen trotz bezahlter Schwester-Bestellung ERLAUBT (echter Zweitkauf)" : "Reminder-Override wieder entfernt"})
    `;
    res.json({ ok: true, allow });
  } catch (err) {
    console.error("[FIAON-ALLOW-REMINDERS]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── #15/#22 (Admin): Kunde aus der Arbeitsliste aussortieren / zurückholen ──
// Kein echtes Löschen — nur raus aus den Agenten-Listen, vollständig in der DB,
// im Admin unter „Aussortiert" sichtbar. Berührt keine Zahlung/Provision.
const ADMIN_CUST_DISMISS_LABEL: Record<string, string> = {
  keine_nummer: "keine Telefonnummer", nummer_ungueltig: "ungültige Nummer",
  abgelehnt: "100 % abgelehnt", kein_interesse: "kein Interesse", dublette: "Dublette",
};
router.post("/admin/applications/:ref/dismiss", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const reason = String(req.body?.reason || "").trim();
    if (!ADMIN_CUST_DISMISS_LABEL[reason]) return res.status(400).json({ ok: false, error: "Grund erforderlich (keine_nummer, nummer_ungueltig, abgelehnt, kein_interesse, dublette)." });
    const rows = await sqlPool`
      UPDATE fiaon_applications SET dismissed_at = NOW(), dismissed_by = NULL, dismissed_reason = ${reason}, updated_at = NOW()
      WHERE ref = ${req.params.ref} AND merged_into IS NULL AND dismissed_at IS NULL
      RETURNING ref
    `;
    if (rows.length === 0) return res.status(409).json({ ok: false, error: "Kunde nicht gefunden oder bereits aussortiert." });
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${req.params.ref}, NULL, 'Admin', 'system',
              ${`Aus der Arbeitsliste entfernt (Admin, Grund: ${ADMIN_CUST_DISMISS_LABEL[reason]}). Wird NIE gelöscht — jederzeit zurückholbar.`})
    `.catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ADMIN] applications dismiss:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
router.post("/admin/applications/:ref/restore", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      UPDATE fiaon_applications SET dismissed_at = NULL, dismissed_by = NULL, dismissed_reason = NULL, updated_at = NOW()
      WHERE ref = ${req.params.ref} AND dismissed_at IS NOT NULL
      RETURNING ref
    `;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Kein aussortierter Kunde unter dieser Referenz." });
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${req.params.ref}, NULL, 'Admin', 'system', 'Kunde zurückgeholt (nicht mehr aussortiert) — steht wieder in der Arbeitsliste.')
    `.catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ADMIN] applications restore:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Kunde löschen (DSGVO): Soft-Delete + Anonymisierung der personenbezogenen
// Felder. Rechnungsdaten (Nummer, Betrag, Referenz, Datum) bleiben aus
// Buchhaltungspflicht erhalten — Nummernkreis unangetastet. KYC-PDFs werden
// gelöscht (personenbezogen). Offene Zahlung wird storniert.
router.post("/admin/applications/:ref/gdpr-delete", async (req, res) => {
  try {
    await ensurePaymentColumns();
    if (!req.body?.confirmed) return res.status(400).json({ ok: false, error: "Bestätigung erforderlich (confirmed=true)" });
    const existing = await sqlPool`SELECT id, ref, payment_status FROM fiaon_applications WHERE ref = ${req.params.ref}`;
    if (existing.length === 0) return res.status(404).json({ ok: false, error: "Kunde nicht gefunden" });
    const anonEmail = `geloescht-${existing[0].id}@anonym.invalid`;
    const rows = await sqlPool`
      UPDATE fiaon_applications SET
        first_name = 'Gelöscht', last_name = '(DSGVO)', contact_name = NULL,
        email = ${anonEmail}, contact_email = NULL, billing_email = NULL,
        phone = NULL, phone_country_code = NULL, contact_phone = NULL,
        street = NULL, zip = NULL, city = NULL,
        bank_statement_pdf = NULL, id_card_pdf = NULL, schufa_pdf = NULL,
        utm = NULL,
        payment_status = CASE WHEN payment_status IN ('pending_payment','claimed_paid','expired') THEN 'cancelled' ELSE payment_status END,
        cancelled_at = CASE WHEN payment_status IN ('pending_payment','claimed_paid','expired') THEN NOW() ELSE cancelled_at END,
        account_status = 'suspended',
        gdpr_deleted_at = NOW(),
        updated_at = NOW()
      WHERE ref = ${req.params.ref}
      RETURNING ref, invoice_number, payment_reference
    `;
    await import("./fiaon-agent").then((m) => m.onCustomerRefunded(rows[0].ref)).catch(() => {});
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${rows[0].ref}, NULL, 'Admin', 'system',
              ${`Kunde gelöscht (DSGVO): personenbezogene Daten anonymisiert, KYC-Dokumente entfernt. Rechnungsdaten (${rows[0].invoice_number || "keine Rechnung"}) bleiben aus Buchhaltungspflicht erhalten.`})
    `;
    console.log(`[FIAON-GDPR] ${req.params.ref} anonymisiert (Rechnung ${rows[0].invoice_number || "—"} bleibt)`);
    res.json({ ok: true, ref: rows[0].ref });
  } catch (err) {
    console.error("[FIAON-GDPR]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Einmaliger Aufräumlauf (Paket AD3): wendet die AD1-Logik rückwirkend auf den
// Bestand an — für JEDE bezahlte Bestellung werden offene Schwestern superseded.
// KEINE Mails (supersede versendet grundsätzlich nichts). Idempotent.
router.post("/admin/duplicates/supersede-run", async (req, res) => {
  try {
    await ensurePaymentColumns();
    if (!req.body?.confirmed) return res.status(400).json({ ok: false, error: "Bestätigung erforderlich (confirmed=true)" });
    const paidRefs = await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE payment_status = 'paid' AND merged_into IS NULL
        AND email IS NOT NULL AND TRIM(email) != ''
    `;
    let total = 0;
    const affected: string[] = [];
    for (const p of paidRefs) {
      const r = await supersedeSisterOrders(p.ref);
      total += r.count;
      affected.push(...r.refs);
    }
    console.log(`[FIAON-DUBLETTE] Aufräumlauf: ${total} Bestellungen superseded (${paidRefs.length} bezahlte geprüft)`);
    res.json({ ok: true, superseded: total, refs: affected, paidChecked: paidRefs.length });
  } catch (err) {
    console.error("[FIAON-DUBLETTE] Aufräumlauf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Dubletten-Gruppen für die Admin-Ansicht: gruppiert nach E-Mail UND nach
// normalisiertem Telefon (P3-A). Telefon-Gruppen werden nur gezeigt, wenn sie
// eine Verbindung aufdecken, die die E-Mail-Gruppierung NICHT bereits abdeckt
// (z. B. gleiche Nummer bei unterschiedlichen/fehlenden E-Mails).
// Gewinner-Score (Dubletten): bezahlt > angekündigt > offen; mit Agent > ohne;
// vollständiger > unvollständiger. Höchster Score = Vorschlag „behalten“.
function winnerScore(a: any): number {
  let s = 0;
  if (a.payment_status === "paid") s += 5000;
  else if (a.payment_status === "claimed_paid") s += 3000;
  else if (a.payment_status === "pending_payment") s += 2000;
  else if (a.payment_status === "cancelled" || a.payment_status === "expired") s += 100;
  if (a.payment_reference) s += 400;
  if (a.assigned_agent_id) s += 300;              // mit Agent > ohne
  if (a.invoice_number) s += 200;
  // Vollständigkeit: gefüllte Kernfelder zählen
  for (const f of ["email", "phone", "contact_phone", "street", "zip", "city", "birthdate", "first_name", "last_name"]) {
    if (a[f] !== null && a[f] !== undefined && a[f] !== "") s += 10;
  }
  return s;
}
function appPhone(a: any): string | null { return normalizeApplicationPhone(a); }
function appHasAddress(a: any): boolean { return !!(String(a.street || "").trim() && String(a.city || "").trim()); }
function normLast(a: any): string { return String(a.last_name || "").trim().toLowerCase(); }

router.get("/admin/duplicates/groups", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT ref, payment_reference, payment_status, superseded_by, amount_due, pack_name,
             first_name, last_name, contact_name, email, phone, phone_country_code, contact_phone,
             street, zip, city, birthdate, assigned_agent_id, status, account_status,
             invoice_number, created_at, gdpr_deleted_at, person_id
      FROM fiaon_applications
      WHERE merged_into IS NULL
      ORDER BY created_at DESC NULLS LAST
    `;

    /**
     * Gehören diese Antragszeilen zu MEHR ALS EINEM Menschen?
     *
     * Seit der Massen-Zusammenführung (08.08.2026) ist die Antwort meistens
     * nein: Ein Kunde mit fünf Bestellungen ist ein Kunde mit fünf
     * Bestellungen — seine Historie, keine Dublette. Vorher hieß dieselbe Lage
     * „44 Dubletten" im Menü, während der Personen-Arbeitsplatz daneben leer
     * war. Zwei Zahlen für denselben Sachverhalt sind schlimmer als eine
     * fehlende.
     *
     * Was eine Dublette bleibt: dieselbe Adresse oder Nummer bei ZWEI
     * verschiedenen Personensätzen — dann ist wirklich etwas zu entscheiden.
     */
    const mehrereMenschen = (apps: any[]): boolean =>
      new Set(apps.map((a) => a.person_id).filter((v) => v != null)).size > 1;

    // ── E-Mail-Gruppen ──
    const byEmail = new Map<string, any[]>();
    for (const r of rows) {
      const em = String(r.email || "").trim().toLowerCase();
      if (!em) continue;
      if (!byEmail.has(em)) byEmail.set(em, []);
      byEmail.get(em)!.push(r);
    }
    const emailGroups = Array.from(byEmail.entries())
      .filter(([, apps]) => apps.length > 1 && mehrereMenschen(apps))
      .map(([email, apps]) => ({ matchType: "email" as const, key: `email:${email}`, label: email, email, apps }));
    // Refs, die bereits über eine E-Mail-Gruppe erfasst sind (für Redundanz-Prüfung).
    const emailRefSets = emailGroups.map((g) => new Set(g.apps.map((a) => a.ref)));

    // ── Telefon-Gruppen (normalisiert) ──
    const byPhone = new Map<string, any[]>();
    for (const r of rows) {
      const p = normalizeApplicationPhone(r);
      if (!p) continue;
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(r);
    }
    const phoneGroups = Array.from(byPhone.entries())
      .filter(([, apps]) => apps.length > 1 && mehrereMenschen(apps))
      .filter(([, apps]) => {
        // Redundant, wenn alle Anträge dieselbe (nicht-leere) E-Mail teilen → E-Mail-Gruppe deckt es ab.
        const emails = new Set(apps.map((a) => String(a.email || "").trim().toLowerCase()));
        const hasEmpty = apps.some((a) => !String(a.email || "").trim());
        if (!hasEmpty && emails.size === 1) return false;
        // Redundant, wenn diese exakte Ref-Menge bereits als E-Mail-Gruppe existiert.
        const refSet = new Set(apps.map((a) => a.ref));
        return !emailRefSets.some((es) => es.size === refSet.size && Array.from(refSet).every((r) => es.has(r)));
      })
      .map(([phone, apps]) => ({ matchType: "phone" as const, key: `phone:${phone}`, label: phone, email: null, apps }));

    // ── Anreicherung: Gewinner-Vorschlag, Konfidenz, Feld-/Anrufbarkeits-Vorschau ──
    const enrich = (g: any) => {
      const apps = [...g.apps].sort((x: any, y: any) => winnerScore(y) - winnerScore(x)
        || new Date(y.created_at || 0).getTime() - new Date(x.created_at || 0).getTime());
      const winner = apps[0];
      const losers = apps.slice(1);

      // Konfidenz: gleiche E-Mail + gleicher Nachname = sicher; sonst wahrscheinlich/prüfen.
      const lastNames = new Set(apps.map(normLast).filter(Boolean));
      const sameLast = lastNames.size <= 1 && lastNames.size > 0;
      let confidence: "sicher" | "wahrscheinlich" | "pruefen";
      if (g.matchType === "email") confidence = sameLast ? "sicher" : "wahrscheinlich";
      else confidence = sameLast ? "wahrscheinlich" : "pruefen";

      // Feld-Vorschau: was würde der Gewinner beim Merge dazugewinnen (nur füllen)?
      const gainable: string[] = [];
      const winnerPhone = appPhone(winner);
      const loserPhone = losers.map(appPhone).find(Boolean);
      const callableGain = !winnerPhone && !!loserPhone;   // Gewinner wird anrufbar
      if (callableGain) gainable.push("Telefon");
      if (!String(winner.email || "").trim() && losers.some((l: any) => String(l.email || "").trim())) gainable.push("E-Mail");
      if (!appHasAddress(winner) && losers.some(appHasAddress)) gainable.push("Adresse");
      if (!winner.birthdate && losers.some((l: any) => l.birthdate)) gainable.push("Geburtsdatum");

      // Anzahl bezahlter Datensätze in der Gruppe (Doppelzahler-Signal)
      const paidCount = apps.filter((a: any) => a.payment_status === "paid").length;

      return { ...g, apps, winnerRef: winner.ref, confidence, gainable, callableGain, paidCount };
    };

    let groups = [...emailGroups, ...phoneGroups].map(enrich);

    // ── P3: Erkennung ÜBER LEADS HINWEG (Lead + Antrag derselben Person) ──
    // Die gemeldeten Fälle (#19/#24/#26 …) wurden per reiner E-Mail-Gruppierung
    // NICHT erfasst — oft existiert ein offener Lead neben einem bereits
    // bezahlten/aktiven Antrag (gleiche Person, andere/fehlende E-Mail, gleiche
    // Nummer). Wir hängen passende offene Leads an bestehende Gruppen an UND
    // erzeugen neue „Lead ↔ Antrag"-Gruppen, wo eine Person als Lead UND als
    // bezahlter/aktiver Kunde existiert. Read-only — reine Sichtbarkeit.
    // `created_at` gibt es in fiaon_leads nicht — die Spalte heißt `erstellt_am`.
    // Diese Abfrage warf deshalb bei JEDEM Aufruf einen 500er, und der Bereich
    // „Bestellungen" in /admin/dubletten war unbenutzbar (gefunden am
    // 08.08.2026 beim Bau des Personen-Arbeitsplatzes).
    const openLeads = await sqlPool`
      SELECT id, vorname, nachname, email, telefon, status, assigned_agent_id,
             converted_order_id, in_sequence, erstellt_am
      FROM fiaon_leads
      WHERE status IN ('neu','kontaktiert','nicht_erreichbar')
        AND converted_order_id IS NULL
    `;
    const leadKey = (l: any) => ({
      email: String(l.email || "").trim().toLowerCase() || null,
      phone: l.telefon ? normalizePhone(String(l.telefon)) : null,
    });
    // Index der Anträge nach E-Mail/Telefon für schnelles Nachschlagen.
    const appByEmail = new Map<string, any[]>();
    const appByPhone = new Map<string, any[]>();
    for (const r of rows) {
      const em = String(r.email || "").trim().toLowerCase();
      if (em) { if (!appByEmail.has(em)) appByEmail.set(em, []); appByEmail.get(em)!.push(r); }
      const p = normalizeApplicationPhone(r);
      if (p) { if (!appByPhone.has(p)) appByPhone.set(p, []); appByPhone.get(p)!.push(r); }
    }
    // 1) Leads an bestehende Gruppen anhängen (gleiche E-Mail ODER Telefon).
    const attachLeadRow = (l: any) => ({
      leadId: l.id, name: [l.vorname, l.nachname].filter(Boolean).join(" ") || null,
      email: l.email || null, telefon: l.telefon || null, status: l.status,
      assigned_agent_id: l.assigned_agent_id, in_sequence: l.in_sequence,
    });
    const usedLeadIds = new Set<number>();
    for (const g of groups) {
      const groupEmails = new Set(g.apps.map((a: any) => String(a.email || "").trim().toLowerCase()).filter(Boolean));
      const groupPhones = new Set(g.apps.map((a: any) => normalizeApplicationPhone(a)).filter(Boolean));
      const matched = openLeads.filter((l: any) => {
        const k = leadKey(l);
        return (k.email && groupEmails.has(k.email)) || (k.phone && groupPhones.has(k.phone));
      });
      (g as any).leads = matched.map(attachLeadRow);
      matched.forEach((l: any) => usedLeadIds.add(Number(l.id)));
    }
    // 2) NEUE Lead↔Antrag-Gruppen: offener Lead trifft einen bezahlten/aktiven
    //    Antrag, der (noch) in KEINER App-Dubletten-Gruppe steht.
    const crossGroups: any[] = [];
    const seenCrossKey = new Set<string>();
    for (const l of openLeads) {
      if (usedLeadIds.has(Number(l.id))) continue;
      const k = leadKey(l);
      const hits = [
        ...(k.email ? (appByEmail.get(k.email) || []) : []),
        ...(k.phone ? (appByPhone.get(k.phone) || []) : []),
      ];
      const active = hits.filter((a: any) => ["paid", "pending_payment", "claimed_paid"].includes(a.payment_status));
      if (active.length === 0) continue;
      const anchor = active.sort((x: any, y: any) => winnerScore(y) - winnerScore(x))[0];
      const ck = `cross:${anchor.ref}:${l.id}`;
      if (seenCrossKey.has(ck)) continue;
      seenCrossKey.add(ck);
      usedLeadIds.add(Number(l.id));
      const confidence = k.email && String(anchor.email || "").trim().toLowerCase() === k.email
        ? "wahrscheinlich" : "pruefen";
      crossGroups.push({
        matchType: "lead_cross",
        key: ck,
        label: `${[l.vorname, l.nachname].filter(Boolean).join(" ") || l.email || l.telefon} (Lead ↔ ${anchor.payment_status === "paid" ? "bezahlt" : "aktiv"})`,
        email: k.email,
        apps: [anchor],
        winnerRef: anchor.ref,
        confidence,
        gainable: [],
        callableGain: false,
        paidCount: anchor.payment_status === "paid" ? 1 : 0,
        leads: [attachLeadRow(l)],
        note: "Offener Lead trifft einen bereits bezahlten/aktiven Kunden — dieser Lead sollte nicht erneut angerufen werden (konvertieren oder aus der Queue nehmen).",
      });
    }
    groups = [...groups, ...crossGroups];

    // Sortierung: Doppelzahler (paidCount>1) zuerst, dann Anrufbarkeits-Gewinn, dann sichere.
    const confRank: Record<string, number> = { sicher: 0, wahrscheinlich: 1, pruefen: 2 };
    groups.sort((a, b) =>
      (b.paidCount > 1 ? 1 : 0) - (a.paidCount > 1 ? 1 : 0)
      || (b.callableGain ? 1 : 0) - (a.callableGain ? 1 : 0)
      || confRank[a.confidence] - confRank[b.confidence]);

    res.json({ ok: true, groups });
  } catch (err) {
    console.error("[FIAON-DUBLETTE] groups:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// „Alle offenen stornieren“ für eine Dubletten-Gruppe. Akzeptiert entweder
// eine E-Mail (E-Mail-Gruppe) ODER eine explizite Ref-Liste (Telefon-Gruppe,
// P3-A) — so lassen sich auch Gruppen ohne gemeinsame E-Mail behandeln.
router.post("/admin/duplicates/cancel-open", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const refs: string[] = Array.isArray(req.body?.refs) ? req.body.refs.map((r: any) => String(r)) : [];
    if (!req.body?.confirmed || (!email && refs.length === 0)) {
      return res.status(400).json({ ok: false, error: "confirmed + (email ODER refs[]) erforderlich" });
    }
    const rows = email
      ? await sqlPool`
          UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
          WHERE LOWER(TRIM(email)) = ${email} AND merged_into IS NULL
            AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
          RETURNING ref
        `
      : await sqlPool`
          UPDATE fiaon_applications SET payment_status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
          WHERE ref = ANY(${refs}) AND merged_into IS NULL
            AND payment_status IN ('pending_payment', 'claimed_paid', 'expired')
          RETURNING ref
        `;
    for (const r of rows) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${r.ref}, NULL, 'Admin', 'system', 'Offene Dubletten-Bestellung storniert (Gruppen-Aktion)')
      `;
    }
    console.log(`[FIAON-DUBLETTE] cancel-open: ${rows.length} Bestellungen storniert (${email || `refs=${refs.length}`})`);
    res.json({ ok: true, cancelled: rows.length, refs: rows.map((r) => r.ref) });
  } catch (err) {
    console.error("[FIAON-DUBLETTE] cancel-open:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════ PAKET AC6 — Admin: Stammdaten bearbeiten (mit Audit) ═══════════
router.post("/admin/applications/:ref/contact", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const { updateCustomerContact } = await import("./fiaon-agent");
    const result = await updateCustomerContact(req.params.ref, req.body || {}, { id: null, name: "Admin" });
    if (result.error) return res.status(result.error.code).json({ ok: false, error: result.error.msg });
    res.json({ ok: true, changes: result.changes, duplicate: result.duplicate });
  } catch (err) {
    console.error("[FIAON-ADMIN-CONTACT]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── Stillgelegte Stripe-Endpoints (410 Gone, nicht 500) ─────────────

router.post("/create-payment-intent", (_req, res) => {
  res.status(410).json({
    error: "Kartenzahlung wurde eingestellt. Aktivierung erfolgt per Banküberweisung – Zugang nach Zahlungseingang.",
    gone: true,
  });
});

// Stillgelegter Stripe-Webhook — Zahlungseingang wird jetzt manuell über
// /admin/payments (mark-paid) verbucht. 410 Gone statt 500.
// Track click events
router.post("/track", async (req, res) => {
  try {
    const { event, data, ref, sessionId, page } = req.body;
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    await db.insert(fiaonClickEvents).values({
      event, data, applicationRef: ref || null, sessionId: sessionId || null, page: page || null, ip, userAgent: req.headers["user-agent"] || "",
    });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-TRACK]", err);
    res.json({ ok: false });
  }
});

// Save/update application
router.post("/application", async (req, res) => {
  try {
    // Nie ein Passwort ins Log — auch nicht „nur zum Prüfen".
    console.log("[FIAON-APP] Received application save request. Body keys:", Object.keys(req.body).filter((k) => k !== "password"));

    // Neue Zahlungs-/Webhook-Spalten müssen vor dem Drizzle-SELECT existieren
    await ensurePaymentColumns();
    const { ensureAntragErinnerungSpalten } = await import("../lib/fiaon-antrag-erinnerung");
    await ensureAntragErinnerungSpalten();
    
    const { 
      ref, type, status, currentStep, packKey, packName, 
      // Private customer fields
      firstName, lastName, birthDay, birthMonth, birthYear, phone, phoneCountryCode, street, zip, city, country, nationality, employment, employer, employedSince, income, rent, debts, housing,
      // Password for login
      password,
      // Business customer fields
      companyName, legalForm, taxId, establishedYear, contactFirstName, contactLastName, contactEmail, contactPhone, businessType, industry, annualRevenue, employees, monthlyExpenses, billingEmail,
      // Common fields
      wantedLimit, purpose, billing, addon, nfc, approvedLimit, email, iban, billingMethod, salaryReceiptDay, erreichbarkeit, ag1, ag2, ag3 
    } = req.body;
    
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
    const birthdate = birthDay && birthMonth && birthYear ? `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}` : null;
    const contactName = contactFirstName && contactLastName ? `${contactFirstName} ${contactLastName}` : contactFirstName || contactLastName || null;

    // Auto-run migration for new fields if they don't exist
    try {
      const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
      const columns = await sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'fiaon_applications' 
        AND table_schema = 'public'
        AND column_name IN ('phone_country_code', 'salary_receipt_day', 'password')
      `;
      
      const columnNames = columns.map(c => c.column_name);
      console.log("[FIAON-APP] Existing columns:", columnNames);
      
      const needsMigration = !columnNames.includes('phone_country_code') || 
                             !columnNames.includes('salary_receipt_day') || 
                             !columnNames.includes('password');
      
      if (needsMigration) {
        console.log("[FIAON-APP] Running auto-migration for phoneCountryCode, salaryReceiptDay, and password...");
        await sql`
          ALTER TABLE fiaon_applications 
          ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR,
          ADD COLUMN IF NOT EXISTS salary_receipt_day VARCHAR,
          ADD COLUMN IF NOT EXISTS password VARCHAR;
        `;
        console.log("[FIAON-APP] Auto-migration completed successfully");
      }
      await sql.end();
    } catch (migrateErr) {
      console.error("[FIAON-APP] Auto-migration failed:", migrateErr);
      // Continue with the application save even if migration fails
    }

    // Auto-run migration for business fields if type is business
    if (type === "business") {
      try {
        const sql = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
        const columns = await sql`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'fiaon_applications' 
          AND table_schema = 'public'
          AND column_name = 'company_name'
        `;
        
        if (columns.length === 0) {
          console.log("[FIAON-APP] Running auto-migration for business fields...");
          await sql`
            ALTER TABLE fiaon_applications 
            ADD COLUMN IF NOT EXISTS company_name VARCHAR,
            ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
            ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
            ADD COLUMN IF NOT EXISTS established_year VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
            ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
            ADD COLUMN IF NOT EXISTS business_type VARCHAR,
            ADD COLUMN IF NOT EXISTS industry VARCHAR,
            ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
            ADD COLUMN IF NOT EXISTS employees INTEGER,
            ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
            ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
          `;
          await sql`
            CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
          `;
          console.log("[FIAON-APP] Auto-migration completed successfully");
        }
        await sql.end();
      } catch (migrateErr) {
        console.error("[FIAON-APP] Auto-migration failed:", migrateErr);
        // Continue with the application save even if migration fails
      }
    }

    // Try update first
    const existing = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    
    // ══════════════════════════════════════════════════════════════════════
    // DIE REINIGUNG AN DER SCHREIBSTELLE (19.08.2026)
    //
    // ── ZWEI BEFUNDE, EINE STELLE ────────────────────────────────────────
    // GEMESSEN: 6.589 Bestellungen mit ZEILENUMBRUCH im Paketnamen
    // („FIAON High End\n(Das Maximum)") und 1.247 Vornamen mit Leerraum am
    // Rand („Violeta "). Im Portal stand deshalb in der Paket-Kachel nur
    // „Maximum)" und in der Begrüßung „Guten Abend, Vitor Manuel .".
    //
    // ── WARUM HIER UND NICHT IM FORMULAR ─────────────────────────────────
    // Es gibt vier Antragsstrecken, mehrere Editoren, einen Lead-Import und
    // eine Selbstauskunft. Wer im Formular reinigt, hat den nächsten Weg schon
    // vergessen — und den Import sowieso. Diese Stelle ist die, durch die alles
    // geht, was ein Kunde selbst einträgt.
    //
    // Und man darf dem Client ohnehin nicht glauben: Selbst wenn alle vier
    // Strecken sauber senden würden, ist die Wand hier die einzige, die hält.
    // ══════════════════════════════════════════════════════════════════════
    const values: any = {
      ref, type: type || "private", status: status || "started", currentStep: currentStep || 0,
      packKey, packName: paketNameEinzeilig(packName),
      // Private customer fields
      firstName: nameSauber(firstName), lastName: nameSauber(lastName),
      birthdate, phone, phoneCountryCode, street, zip, city, country, nationality,
      employment, employer, employedSince, income: income || null, rent: rent || null, debts: debts || null, housing,
      // Password for login
      password,
      // Business customer fields
      companyName: nameSauber(companyName), legalForm, taxId, establishedYear,
      contactName: nameSauber(contactName), contactEmail, contactPhone, businessType, industry, annualRevenue: annualRevenue || null, employees: employees || null, monthlyExpenses: monthlyExpenses || null, billingEmail,
      // Common fields
      wantedLimit: wantedLimit || null, purpose, billing, addon, nfc,
      approvedLimit: approvedLimit || null, email, iban, billingMethod, salaryReceiptDay,
      // P18 (28.08.2026): Wann der Kunde telefonisch erreichbar sein will.
      erreichbarkeit: erreichbarkeit || null,
      consentAgb: ag1 || false, consentSchufa: ag2 || false, consentContract: ag3 || false,
      ip, userAgent: req.headers["user-agent"] || "",
      updatedAt: new Date(),
    };

    console.log("[FIAON-APP] Saving application with ref:", ref, "status:", status, "password length:", password?.length, "email:", email);

    if (existing.length > 0) {
      console.log("[FIAON-APP] Updating existing application via direct SQL only to prevent password overwrite");
      
      // Use direct SQL for ALL fields to prevent Drizzle from overwriting password
      // Convert undefined to null to avoid UNDEFINED_VALUE error
      await sqlPool`
        UPDATE fiaon_applications 
        SET 
          type = ${values.type ?? null},
          status = ${values.status ?? null},
          current_step = ${values.currentStep ?? null},
          -- Der Stempel, an dem die Erinnerungskette (E-023) misst: „zuletzt weitergemacht am".
          antrag_stand_am = NOW(),
          pack_key = ${values.packKey ?? null},
          pack_name = ${values.packName ?? null},
          first_name = COALESCE(NULLIF(${values.firstName ?? ''}, ''), first_name),
          last_name = COALESCE(NULLIF(${values.lastName ?? ''}, ''), last_name),
          birthdate = ${values.birthdate ?? null},
          phone = ${values.phone ?? null},
          phone_country_code = ${values.phoneCountryCode ?? null},
          street = ${values.street ?? null},
          zip = ${values.zip ?? null},
          city = ${values.city ?? null},
          country = ${values.country ?? null},
          nationality = ${values.nationality ?? null},
          employment = ${values.employment ?? null},
          employer = ${values.employer ?? null},
          employed_since = ${values.employedSince ?? null},
          income = ${values.income ?? null},
          rent = ${values.rent ?? null},
          debts = ${values.debts ?? null},
          housing = ${values.housing ?? null},
          -- URSACHE (Notfall 29.07.2026): hier wurde das Passwort ungeprueft
          -- durchgeschrieben (null, wenn keines im Body war). Der Antrags-Funnel
          -- speichert bei JEDEM Schritt-Wechsel zwischen (antrag.tsx, useEffect
          -- auf [step]) - OHNE Passwort. Jeder dieser Zwischenspeicher setzte das
          -- Passwort des Kunden auf NULL: Der Kunde kannte sein Passwort, der
          -- Datensatz nicht mehr. Jetzt gilt: nur SETZEN, niemals loeschen.
          password = COALESCE(NULLIF(${password ?? ''}, ''), password),
          company_name = ${values.companyName ?? null},
          legal_form = ${values.legalForm ?? null},
          tax_id = ${values.taxId ?? null},
          established_year = ${values.establishedYear ?? null},
          contact_name = ${values.contactName ?? null},
          contact_email = ${values.contactEmail ?? null},
          contact_phone = ${values.contactPhone ?? null},
          business_type = ${values.businessType ?? null},
          industry = ${values.industry ?? null},
          annual_revenue = ${values.annualRevenue ?? null},
          employees = ${values.employees ?? null},
          monthly_expenses = ${values.monthlyExpenses ?? null},
          billing_email = ${values.billingEmail ?? null},
          wanted_limit = ${values.wantedLimit ?? null},
          purpose = ${values.purpose ?? null},
          billing = ${values.billing ?? null},
          addon = ${values.addon ?? null},
          nfc = ${values.nfc ?? null},
          approved_limit = ${values.approvedLimit ?? null},
          email = COALESCE(NULLIF(${values.email ?? ''}, ''), email),
          iban = ${values.iban ?? null},
          billing_method = ${values.billingMethod ?? null},
          salary_receipt_day = ${values.salaryReceiptDay ?? null},
          erreichbarkeit = COALESCE(${values.erreichbarkeit ?? null}, erreichbarkeit),
          consent_agb = ${values.consentAgb ?? null},
          consent_schufa = ${values.consentSchufa ?? null},
          consent_contract = ${values.consentContract ?? null},
          ip = ${values.ip ?? null},
          user_agent = ${values.userAgent ?? null},
          updated_at = ${values.updatedAt ?? null},
          -- Dieselbe Ursache im Rueckfall-Speicher: utm wurde komplett durch
          -- ein Objekt mit nur dem Passwort ersetzt. Ohne Passwort im Body
          -- schrieb das ein leeres Objekt und loeschte die zweite Kopie.
          -- (Beweis im Bestand: Vorgesetzten-Datensatz FIAON-MNPTDV19-QYAJ hat utm leer.)
          -- Jetzt wird der Schluessel nur ERGAENZT, wenn ein Passwort mitkommt.
          utm = CASE
                  WHEN ${password ?? ''} = '' THEN utm
                  ELSE COALESCE(utm, '{}'::jsonb) || ${JSON.stringify({ password: password ?? "" })}::jsonb
                END
        WHERE ref = ${ref}
      `;
      console.log("[FIAON-APP] Direct SQL update completed");
    } else {
      console.log("[FIAON-APP] Inserting new application");
      await db.insert(fiaonApplications).values(values);
      console.log("[FIAON-APP] Insert completed");
      
      // Rückfall-Kopie des Passworts (Altbestand-Kompatibilität) — nur ergänzend.
      if (password) {
        await sqlPool`
          UPDATE fiaon_applications
          SET utm = COALESCE(utm, '{}'::jsonb) || ${JSON.stringify({ password })}::jsonb,
              status = ${status}, email = ${email}
          WHERE ref = ${ref}
        `;
        console.log("[FIAON-APP] Passwort gespeichert (Spalte + utm-Rückfall)");
      }
    }

    // Make-Webhook 'welcome' — genau einmal, sobald der E-Mail-Schritt abgeschlossen ist
    // (erste Speicherung mit E-Mail-Adresse). Atomarer Flag-Claim: Vor/Zurück-Navigation
    // oder parallele Saves lösen NICHT erneut aus. Fehler blockieren den Antrag nicht.
    try {
      await ensurePaymentColumns();
      const claimed = await sqlPool`
        UPDATE fiaon_applications SET welcome_sent_at = NOW()
        WHERE ref = ${ref} AND welcome_sent_at IS NULL
          AND COALESCE(NULLIF(email, ''), NULLIF(contact_email, ''), NULLIF(billing_email, '')) IS NOT NULL
        RETURNING ref, first_name, last_name, contact_name, email, contact_email, billing_email, pack_name, payment_reference, amount_due
      `;
      if (claimed.length > 0) sendMakeWebhook("welcome", makePayloadFromRow(claimed[0])).catch(() => {});
    } catch (whErr) {
      console.error("[MAKE-WEBHOOK] welcome claim:", whErr);
    }

    // Paket BA3: Auto-Konversion — passenden offenen Lead (E-Mail/Telefon) auf
    // 'konvertiert' setzen. Additiv, fire-and-forget, blockiert den Antrag nie.
    try {
      const convEmail = email || contactEmail || billingEmail || null;
      const convPhone = (phoneCountryCode || phone) ? `${phoneCountryCode || ""}${phone || ""}` : (contactPhone || null);
      import("./fiaon-leads").then((m) => m.convertLeadsForContact(convEmail, convPhone, ref)).catch(() => {});
    } catch { /* fire-and-forget */ }

    // ══ P1-C DAUERSCHUTZ: diese Zeile an ihre PERSON binden ══════════════
    // Ohne diesen Aufruf entstünde hier wieder eine Zeile ohne Person — gemessen
    // rund 90 pro Tag. Eine neue Antragszeile ist eine BESTELLUNG an einer
    // bestehenden Person, kein neuer Mensch.
    //
    // Der Funnel speichert bei jedem Schritt-Wechsel. Solange weder E-Mail noch
    // Telefon eingegeben sind, gibt `personFuerZeile` bewusst `null` zurück: Das
    // ist ein Entwurf, kein Kunde. Sobald der Kontaktschritt ausgefüllt ist,
    // wird die Person gefunden oder angelegt — und bleibt es bei jedem weiteren
    // Speichern (nur `person_id`, immer derselbe Wert).
    //
    // Das Passwort wird hier NICHT geschrieben, wenn es fehlt: `personFuerZeile`
    // füllt nur leere Felder. Dieselbe Regel wie oben im Antrags-Speicher — sie
    // war die Ursache des Login-Ausfalls.
    await bindePersonAnAntrag(ref).catch((e) =>
      console.error("[FIAON-PERSON] Zuordnung nach /application:", e));

    res.json({ ok: true, ref });
  } catch (err) {
    console.error("[FIAON-APP]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KUNDEN-LOGIN (Notfall 29.07.2026) — Kontoauflösung statt „neueste Zeile"
//
// URSACHE des Massen-Aussperrens: Der Login suchte
//   WHERE email = ? ORDER BY created_at DESC LIMIT 1
// — also NUR die jüngste Antragszeile einer E-Mail. Eine Bonitäts-/SCHUFA-
// Bestellung legt aber bewusst eine EIGENE Antragszeile an (`FIAON-SCHUFA-…`,
// siehe POST /payment-order) — ohne Passwort, weil sie kein Konto ist. Ab der
// Sekunde, in der ein Kunde den Bonitäts-Check bestellte, war seine jüngste
// Zeile diese Bestellzeile: Der Login las sie, fand kein Passwort und
// antwortete „Ungültige Anmeldedaten". Konto und Passwort waren unversehrt —
// sie wurden nur nie angesehen. Dasselbe galt für zusammengeführte Dubletten.
//
// Jetzt wird die gesamte „Familie" einer E-Mail betrachtet (inkl. der Gewinner
// von Merges); das Passwort darf in JEDER Zeile der Familie liegen, und für
// Zugang/Status entscheidet die Zeile, die wirklich das Konto ist.
//
// Das Zugangs-Gate selbst ist UNVERÄNDERT (LOGIN_ACCESS_STATUSES bzw.
// payment_status='paid'). Keine Zahlungsprüfung wird umgangen.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Alle Antragszeilen, die zu einer Login-E-Mail gehören („Familie"):
 * `email`, `contact_email` und `billing_email` werden normalisiert verglichen
 * (kleingeschrieben, getrimmt) — die alte Exakt-Suche scheiterte an
 * Großschreibung und Leerzeichen. Zusätzlich werden die GEWINNER von Merges
 * geladen: nach einem Zusammenführen lebt das Konto dort weiter.
 */
/**
 * EXPORTIERT (06.08.2026), damit die Zugangs-Diagnose der Vertriebsleitung
 * dieselbe Kontoauflösung liest wie der Login selbst. Eine zweite, ähnliche
 * Abfrage würde irgendwann etwas anderes behaupten als das, was der Kunde
 * erlebt — und genau daran ist die Login-Sperre 2026 monatelang unentdeckt
 * geblieben.
 */
export async function loadLoginFamily(normalizedEmail: string): Promise<any[]> {
  // Ohne die Anhang-Spalten: dieser Weg laeuft bei JEDEM Login, und
  // Unterlagen hat nur, wer zahlt — der schwerste Fall zog 38 MB durch
  // die Anmeldung, im Schnitt 3 MB. Fuer die Anmeldung ist davon nichts
  // noetig; ob etwas da ist, sagen die has_*-Kennzeichen.
  const spalten = await antragsSpaltenOhneAnhaenge();
  const rows = (await sqlPool.unsafe(`
    SELECT ${spalten}, utm::text AS utm_string
    FROM fiaon_applications
    WHERE gdpr_deleted_at IS NULL
      AND (
        LOWER(TRIM(COALESCE(email, ''))) = $1
        OR LOWER(TRIM(COALESCE(contact_email, ''))) = $1
        OR LOWER(TRIM(COALESCE(billing_email, ''))) = $1
        -- ── DIE PERSON GEHÖRT ZUR FAMILIE (29.08.2026, Fall Olga C.) ──────
        -- In der Bestellung stand „yagoo.ca" (Tippfehler), an der PERSON die
        -- richtige Adresse. Die Kundin tippte richtig — und wurde in zwei
        -- Telefonaten abgewiesen, weil diese Suche die Person nie ansah.
        -- fiaon_persons ist die Wahrheit (059); wer sich mit der Adresse der
        -- Person anmeldet, findet ab jetzt seine Bestellungen.
        OR person_id IN (
          SELECT id FROM fiaon_persons
          WHERE LOWER(TRIM(COALESCE(primary_email, ''))) = $1
            AND merged_into_person_id IS NULL
        )
      )
    ORDER BY created_at DESC NULLS LAST, id DESC
  `, [normalizedEmail])) as any[];
  const known = new Set(rows.map((r: any) => r.ref));
  const winnerRefs = Array.from(
    new Set(rows.map((r: any) => r.merged_into).filter((r: any): r is string => !!r && !known.has(r))),
  );
  if (winnerRefs.length === 0) return rows;
  const winners = (await sqlPool.unsafe(`
    SELECT ${spalten}, utm::text AS utm_string
    FROM fiaon_applications
    WHERE ref = ANY($1) AND gdpr_deleted_at IS NULL
  `, [winnerRefs])) as any[];
  return [...rows, ...winners];
}

// ── Protokoll jedes Login-Versuchs ──────────────────────────────────────────
// Damit ein Aussperren nie wieder unbemerkt läuft: Grund, Zeit, maskierte
// E-Mail. Zusätzlich ein Pseudonym (SHA-256 der E-Mail), damit der Vorgesetzte
// Versuche gruppieren kann, ohne Klartext-Adressen zu speichern.
let loginLogEnsured = false;
async function ensureLoginLog(): Promise<void> {
  if (loginLogEnsured) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_login_log (
      id SERIAL PRIMARY KEY,
      at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      email_masked VARCHAR NOT NULL,
      email_hash VARCHAR NOT NULL,
      ref VARCHAR,
      code VARCHAR NOT NULL,
      reason VARCHAR NOT NULL,
      ip VARCHAR,
      user_agent VARCHAR
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_login_log_at_idx ON fiaon_login_log(at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_login_log_code_idx ON fiaon_login_log(code)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_login_log_hash_idx ON fiaon_login_log(email_hash)`;
  loginLogEnsured = true;
}

/** Feuert und vergisst: ein Protokollfehler darf einen Login niemals stören. */
function logLoginAttempt(args: {
  email: string;
  code: string;
  reason: string;
  ref?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}): void {
  const masked = maskEmailForLog(args.email);
  console.log(
    `[FIAON-LOGIN] ${args.code} ${args.reason} — ${masked}${args.ref ? ` (${args.ref})` : ""}`,
  );
  void (async () => {
    try {
      await ensureLoginLog();
      const hash = createHash("sha256").update(String(args.email || "").trim().toLowerCase()).digest("hex");
      await sqlPool`
        INSERT INTO fiaon_login_log (email_masked, email_hash, ref, code, reason, ip, user_agent)
        VALUES (${masked}, ${hash}, ${args.ref ?? null}, ${args.code}, ${args.reason},
                ${args.ip ?? null}, ${String(args.userAgent ?? "").slice(0, 300) || null})
      `;
    } catch (err) {
      console.error("[FIAON-LOGIN-LOG] konnte nicht schreiben:", err instanceof Error ? err.message : err);
    }
  })();
}

// Login endpoint for fiaon applications
router.post("/login", async (req, res) => {
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "";
  const userAgent = String(req.headers["user-agent"] || "");
  const rawEmail = String(req.body?.email ?? "");
  const password = String(req.body?.password ?? "");
  const normalizedEmail = rawEmail.trim().toLowerCase();

  try {
    if (!normalizedEmail || !password) {
      return res.status(400).json({
        ok: false,
        code: LOGIN_CODES.BAD_CREDENTIALS,
        error: "Bitte E-Mail-Adresse und Passwort eingeben.",
      });
    }

    await ensurePaymentColumns();
    const family = await loadLoginFamily(normalizedEmail);

    // Die Entscheidung selbst liegt in ../fiaon-login-logic — rein, ohne
    // Datenbank, und dort mit Tests abgedeckt (scripts/login-notfall-test.ts).
    const verdict = decideLogin(family, password);

    if (!verdict.granted) {
      logLoginAttempt({ email: normalizedEmail, code: verdict.code, reason: verdict.reason, ref: verdict.ref, ip, userAgent });
      return res.status(verdict.status).json({
        ok: false,
        code: verdict.code,
        error: verdict.error,
        hint: verdict.hint,
        action: verdict.action,
        actionHref: verdict.actionHref,
        reference: verdict.reference,
      });
    }

    const account = verdict.account;
    logLoginAttempt({ email: normalizedEmail, code: "LOGIN-OK", reason: "Anmeldung erfolgreich", ref: account.ref, ip, userAgent });

    // ── KUNDENSITZUNG + PASSWORTHYGIENE (22.08.2026) ───────────────────────
    // Signiertes Cookie für die neuen Kunden-Endpunkte. Und: Lag das Passwort
    // noch im Klartext, wird es JETZT nachgehasht — der Kunde hat es gerade
    // richtig eingegeben, besser wird die Gelegenheit nicht.
    try {
      const { kundenSitzungSetzen, istGehasht, passwortHashen } = await import("../lib/fiaon-kunde-session");
      kundenSitzungSetzen(res, account.ref, { bleiben: req.body?.bleiben !== false });
      if (!istGehasht(account.password) && typeof account.password === "string" && account.password) {
        await sqlPool`UPDATE fiaon_applications SET password = ${passwortHashen(password)}, updated_at = NOW()
                      WHERE ref = ${account.ref} AND password = ${account.password}`;
      }
    } catch (e) {
      console.error("[FIAON-LOGIN] Sitzung/Nachhashen:", e);
    }

    // Return success with application data
    res.json({
      ok: true,
      ref: account.ref,
      firstName: account.first_name,
      lastName: account.last_name,
      email: account.email,
      packName: account.pack_name,
      // #20: Portal zeigt das Paket-Limit, wenn approved_limit fehlt/auf 250 € geklemmt ist.
      approvedLimit: effectiveLimit(account.pack_key, account.approved_limit),
    });
  } catch (err) {
    // Ein technischer Fehler darf NIEMALS wie ein falsches Passwort aussehen.
    const incident = randomBytes(4).toString("hex").toUpperCase();
    console.error(`[FIAON-LOGIN] ${LOGIN_CODES.TECHNICAL}-${incident} technischer Fehler:`, err);
    logLoginAttempt({
      email: normalizedEmail,
      code: `${LOGIN_CODES.TECHNICAL}-${incident}`,
      reason: `technischer Fehler: ${err instanceof Error ? err.message : String(err)}`.slice(0, 300),
      ip,
      userAgent,
    });
    res.status(503).json({
      ok: false,
      code: `${LOGIN_CODES.TECHNICAL}-${incident}`,
      error: "Technisches Problem — bitte in einem Moment erneut versuchen.",
      hint: `Deine Anmeldedaten sind in Ordnung. Bleibt das Problem, nenne dem Support diesen Fehlercode: ${LOGIN_CODES.TECHNICAL}-${incident}`,
      retryable: true,
    });
  }
});

// ═══════════════ #23 — Telefonnummer-Selbstaktualisierung (öffentlich, signiert) ═══════════════
// Kunde/Lead öffnet den signierten Link aus der „Falsche Nummer"-Mail und trägt
// seine korrekte Nummer ein. Kein Login nötig; Token ist HMAC-signiert + läuft ab.

/** Maskierte Anzeige der hinterlegten Nummer, z. B. „+49 176 •••••• 52".
 *  Zeigt nur Ländervorwahl + erste 3 + letzte 2 Ziffern — genug zum Wiedererkennen. */
function maskPhoneDisplay(e164: string | null): string | null {
  if (!e164) return null;
  const cc = e164.startsWith("+49") ? "+49" : e164.slice(0, 3);
  const rest = e164.slice(cc.length);
  if (rest.length < 5) return null;
  const prefix = rest.slice(0, 3);
  const last2 = rest.slice(-2);
  const mid = "•".repeat(Math.max(3, rest.length - 5));
  return `${cc} ${prefix} ${mid} ${last2}`;
}

router.get("/number-update/:token", async (req, res) => {
  try {
    const t = verifyNumberToken(req.params.token);
    if (!t) return res.status(400).json({ ok: false, error: "Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an." });
    if (t.kind === "app") {
      const [a] = await sqlPool`
        SELECT first_name, contact_name, phone, phone_country_code, contact_phone FROM fiaon_applications WHERE ref = ${t.id} AND merged_into IS NULL
      `;
      if (!a) return res.status(404).json({ ok: false, error: "Datensatz nicht gefunden" });
      const masked = maskPhoneDisplay(normalizeApplicationPhone(a));
      return res.json({ ok: true, firstName: a.first_name || a.contact_name || "", hasNumber: !!(a.phone || a.contact_phone), maskedPhone: masked });
    } else {
      const [l] = await sqlPool`SELECT vorname, telefon FROM fiaon_leads WHERE id = ${Number(t.id)}`;
      if (!l) return res.status(404).json({ ok: false, error: "Datensatz nicht gefunden" });
      const masked = maskPhoneDisplay(l.telefon ? normalizePhone(String(l.telefon)) : null);
      return res.json({ ok: true, firstName: l.vorname || "", hasNumber: !!l.telefon, maskedPhone: masked });
    }
  } catch (err) {
    console.error("[FIAON-NUMUPDATE] get:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/number-update/:token", async (req, res) => {
  try {
    await ensurePaymentColumns();
    const t = verifyNumberToken(req.params.token);
    if (!t) return res.status(400).json({ ok: false, error: "Der Link ist ungültig oder abgelaufen." });
    const normalized = normalizePhone(String(req.body?.phone || "").trim());
    if (!normalized) return res.status(400).json({ ok: false, error: "Bitte eine gültige Telefonnummer eingeben (z. B. 0170 1234567)." });

    if (t.kind === "app") {
      // Volle E.164-Nummer in `phone`, Ländervorwahl leeren (Anzeige/Suche verketten beides).
      // Aussortierung wegen Nummer-Problem wird aufgehoben → Kunde wieder anrufbar.
      const rows = await sqlPool`
        UPDATE fiaon_applications SET
          phone = ${normalized}, phone_country_code = '',
          dismissed_at = CASE WHEN dismissed_reason IN ('keine_nummer','nummer_ungueltig') THEN NULL ELSE dismissed_at END,
          dismissed_reason = CASE WHEN dismissed_reason IN ('keine_nummer','nummer_ungueltig') THEN NULL ELSE dismissed_reason END,
          number_corrected_at = NOW(),
          updated_at = NOW()
        WHERE ref = ${t.id} AND merged_into IS NULL
        RETURNING ref
      `;
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "Datensatz nicht gefunden" });
      // Die PERSON mitpflegen. Sonst korrigiert der Kunde seine Nummer, die
      // Bestellung ist aktuell — und die Anrufliste der Agenten (die auf der
      // Person arbeitet) zeigt weiter die alte, falsche Nummer.
      await sqlPool`
        UPDATE fiaon_persons SET primary_phone = ${normalized}, updated_at = NOW()
        WHERE id = (SELECT person_id FROM fiaon_applications WHERE ref = ${t.id})
      `.catch(() => {});
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${t.id}, NULL, 'System', 'system',
                ${`Telefonnummer vom Kunden selbst aktualisiert (über „Nummer aktualisieren"-Link): ${normalized}. Kunde ist wieder anrufbar.`})
      `.catch(() => {});
    } else {
      // number_corrected_at auf Leads defensiv sicherstellen (Migration zur Laufzeit).
      await sqlPool`ALTER TABLE fiaon_leads ADD COLUMN IF NOT EXISTS number_corrected_at TIMESTAMPTZ`.catch(() => {});
      const rows = await sqlPool`
        UPDATE fiaon_leads SET
          telefon = ${normalized},
          dismissed_at = NULL, dismissed_by = NULL, dismissed_reason = NULL,
          requeue_at = NULL, in_sequence = TRUE,
          number_corrected_at = NOW(),
          status = CASE WHEN status IN ('tot','nicht_erreichbar') THEN 'neu' ELSE status END,
          updated_at = NOW()
        WHERE id = ${Number(t.id)}
        RETURNING id
      `.catch(() => [] as any[]);
      if (rows.length === 0) return res.status(404).json({ ok: false, error: "Datensatz nicht gefunden" });
      await sqlPool`
        INSERT INTO fiaon_lead_log (lead_id, agent_id, agent_name, type, note)
        VALUES (${Number(t.id)}, NULL, 'System', 'system',
                ${`Telefonnummer vom Interessenten selbst aktualisiert (über „Nummer aktualisieren"-Link): ${normalized}. Lead ist wieder anrufbar und zurück in der Warteschlange.`})
      `.catch(() => {});
    }
    await markNumberUpdated(t.kind, t.id);
    console.log(`[FIAON-NUMUPDATE] ${t.kind}:${t.id} → Nummer aktualisiert`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-NUMUPDATE] post:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Upload KYC documents
router.post("/upload-kyc", (req, res, next) => {
  upload.fields([
    { name: 'bankStatement', maxCount: 1 },
    { name: 'idCard', maxCount: 1 },
    { name: 'schufaDoc', maxCount: 1 },
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: "Diese Datei ist größer als 25 MB. Bitte fotografieren Sie die Seite noch einmal mit geringerer Auflösung oder laden Sie eine kleinere PDF-Datei hoch." });
      }
      return res.status(400).json({ error: err.message || "Upload-Fehler" });
    }
    next();
  });
}, async (req, res) => {
  try {
    // ══════════════════════════════════════════════════════════════════════
    // WESSEN AKTE? (27.08.2026)
    //
    // Die Referenz kam bisher ausschliesslich aus dem Formular. Wer eine
    // fremde Referenz kennt — sie steht in Zahlungsreferenzen und in jeder
    // Rechnung —, konnte Unterlagen in eine fremde Akte laden.
    //
    // Ganz zusperren geht nicht: Im Antragsweg lädt der Kunde hoch, BEVOR er
    // ein Passwort hat; eine Anmeldepflicht hier würde den Weg abschneiden,
    // über den das Geschäft entsteht. Deshalb die Regel: Ist eine
    // Kundensitzung vorhanden, gilt IHRE Referenz — was im Formular steht,
    // wird dann ignoriert. Ohne Sitzung bleibt der Antragsweg offen, aber
    // jeder solche Upload wird vermerkt.
    // ══════════════════════════════════════════════════════════════════════
    const { kundeAusCookie } = await import("../lib/fiaon-kunde-session");
    const ausSitzung = kundeAusCookie(req as any);
    const ausFormular = String(req.body?.ref ?? "").trim();
    // ── WER MITARBEITER IST, LAEDT FUER DEN KUNDEN AUS DEM FORMULAR HOCH ──
    // (27.08.2026, Team-Punkt 4: „Dokument hochgeladen, danach nicht in der
    // Kundenakte.") Die Kundensitzung schlug IMMER das Formular — richtig
    // fuer den Kundenweg (niemand beschreibt per Formular-ref fremde Akten),
    // aber toedlich fuer einen Mitarbeiter, der selbst Kunde ist oder eine
    // Als-Kunde-Sitzung im Browser hatte: Sein eigenes Kunden-Cookie gewann,
    // und der Kontoauszug von Kunde X landete kommentarlos in Akte Y.
    // Mit gueltiger MITARBEITER-Sitzung gilt deshalb das Formular.
    const { hasAgentToken } = await import("./fiaon-agent");
    const mitarbeiterLaedt = hasAgentToken(req as any) && !!ausFormular;
    const ref = mitarbeiterLaedt ? ausFormular : (ausSitzung || ausFormular);
    if (mitarbeiterLaedt && ausSitzung && ausSitzung !== ausFormular) {
      console.log(`[FIAON-KYC] Mitarbeiter-Upload: Formular-Ref ${ausFormular} gewinnt ueber Kundensitzung ${ausSitzung}.`);
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!ref) {
      return res.status(400).json({ error: "Referenznummer fehlt" });
    }
    if (ausSitzung && ausFormular && ausSitzung !== ausFormular) {
      console.warn(`[FIAON-KYC] Referenz im Formular (${ausFormular}) weicht von der Sitzung (${ausSitzung}) ab — es gilt die Sitzung.`);
    }
    if (!ausSitzung) {
      console.log(`[FIAON-KYC] Upload ohne Kundensitzung für ${ref} (Antragsweg) von ${String(req.headers["x-forwarded-for"] || req.ip || "?").split(",")[0]}`);
    }
    
    // Get application
    const apps = await sqlPool`
      SELECT * FROM fiaon_applications 
      WHERE ref = ${ref}
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    // Prepare update values
    const updates: string[] = [];
    const values: any = {};

    // Ein Foto wird zum PDF, bevor es in eine Spalte namens `_pdf` geht.
    // Schlägt die Wandlung fehl, bricht der ganze Upload ab: Ein halb
    // gespeicherter Vorgang wäre schlimmer als eine ehrliche Fehlermeldung.
    const { istBild, bildAlsPdf } = await import("../lib/fiaon-bild-zu-pdf");
    const alsPdf = async (f: Express.Multer.File): Promise<Buffer> => {
      if (!istBild(f.mimetype)) return f.buffer;
      try {
        const pdf = await bildAlsPdf(f.buffer, f.originalname || "Foto");
        console.log(`[FIAON-KYC] Foto gewandelt: ${f.originalname} (${Math.round(f.size / 1024)} KB) → PDF ${Math.round(pdf.length / 1024)} KB`);
        return pdf;
      } catch (e) {
        console.error("[FIAON-KYC] Wandlung fehlgeschlagen:", String(e).slice(0, 160));
        throw new Error("Dieses Bild konnten wir nicht verarbeiten. Bitte versuchen Sie es mit einem anderen Foto oder laden Sie eine PDF-Datei hoch.");
      }
    };

    if (files.bankStatement && files.bankStatement[0]) {
      updates.push('bank_statement_pdf = $bankStatementPdf');
      values.bankStatementPdf = await alsPdf(files.bankStatement[0]);
    }
    
    if (files.idCard && files.idCard[0]) {
      updates.push('id_card_pdf = $idCardPdf');
      values.idCardPdf = await alsPdf(files.idCard[0]);
    }

    if (files.schufaDoc && files.schufaDoc[0]) {
      updates.push('schufa_pdf = $schufaPdf');
      values.schufaPdf = await alsPdf(files.schufaDoc[0]);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: "Keine Dokumente hochgeladen" });
    }
    
    // Add timestamp
    updates.push('documents_uploaded_at = NOW()');
    
    // Check if both documents are now present
    const currentApp = apps[0];
    const hasBankStatement = files.bankStatement || currentApp.bank_statement_pdf;
    const hasIdCard = files.idCard || currentApp.id_card_pdf;
    
    if (hasBankStatement && hasIdCard) {
      updates.push("status = 'documents_submitted'");
    }

    // Build dynamic SQL update
    let sql = 'UPDATE fiaon_applications SET ';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (values.bankStatementPdf) {
      sql += `bank_statement_pdf = $${paramIndex++}, `;
      params.push(values.bankStatementPdf);
    }
    
    if (values.idCardPdf) {
      sql += `id_card_pdf = $${paramIndex++}, `;
      params.push(values.idCardPdf);
    }

    if (values.schufaPdf) {
      sql += `schufa_pdf = $${paramIndex++}, `;
      params.push(values.schufaPdf);
    }
    
    sql += `documents_uploaded_at = NOW()`;
    
    if (hasBankStatement && hasIdCard) {
      sql += `, status = 'documents_submitted'`;
    }
    
    sql += ` WHERE ref = $${paramIndex}`;
    params.push(ref);
    
    // Execute update
    await sqlPool.unsafe(sql, params);

    // Reset reupload flags and kycStatus when re-uploading after changes_requested
    let newKycStatus = currentApp.kyc_status;
    if (currentApp.kyc_status === 'changes_requested') {
      const newBankFlag = files.bankStatement ? false : !!(currentApp.reupload_bank_statement);
      const newIdFlag   = files.idCard        ? false : !!(currentApp.reupload_id_card);
      newKycStatus = (newBankFlag || newIdFlag) ? 'changes_requested' : 'pending';
      await sqlPool`
        UPDATE fiaon_applications SET
          kyc_status              = ${newKycStatus},
          reupload_bank_statement = ${newBankFlag},
          reupload_id_card        = ${newIdFlag},
          updated_at              = NOW()
        WHERE ref = ${ref}
      `.catch(() => {});
    }

    console.log(`[FIAON-KYC] Documents uploaded for ${ref}, kycStatus=${newKycStatus}`);

    // ══════════════════════════════════════════════════════════════════════
    // EIN UPLOAD IST EIN VORGANG, KEIN ABLEGEN (22.08.2026, Justins Kundentest)
    //
    // Justin lud als Kunde seinen Kontoauszug hoch — und nichts passierte:
    // keine Bestätigung mit Frist, kein Eintrag in der Akte, keine Aufgabe im
    // Haus. Die Datei lag in der Datenbank, und niemand wusste es. Jetzt:
    // Akteneintrag (der Betreuer sieht es), Aufgabe an die Verwaltung (die
    // prüft), und die Antwort nennt die Frist.
    // ══════════════════════════════════════════════════════════════════════
    const was = [files.bankStatement ? "Kontoauszug" : null, files.idCard ? "Ausweis" : null, files.schufaDoc ? "eigene Bonitätsauskunft" : null]
      .filter(Boolean).join(", ");

    // ── AUTOMATISCHE DOKUMENTPRÜFUNG (P9, 01.09.2026) ─────────────────────
    // Synchron mit hartem Timeout: Der Kunde erfährt SOFORT, wenn die Datei
    // nicht nach dem verlangten Dokument aussieht oder ein Zeitraum fehlt —
    // statt Tage später bei der Handprüfung. Die Prüfung meldet nur; sie
    // weist nie zurück und darf den Upload nie scheitern lassen.
    const { pruefungAnstossen } = await import("../lib/fiaon-dokument-pruefung");
    const pruefungen: any[] = [];
    const kundenSaetze: string[] = [];
    const internWarnungen: string[] = [];
    const zuPruefen: Array<[any, "kontoauszug" | "ausweis" | "schufa"]> = [];
    if (files.bankStatement?.[0]) zuPruefen.push([values.bankStatementPdf, "kontoauszug"]);
    if (files.idCard?.[0]) zuPruefen.push([values.idCardPdf, "ausweis"]);
    if (files.schufaDoc?.[0]) zuPruefen.push([values.schufaPdf, "schufa"]);
    for (const [pdf, art] of zuPruefen) {
      const u = await pruefungAnstossen(String(ref), art, pdf as Buffer).catch(() => null);
      if (!u) continue;
      pruefungen.push(u);
      if (u.hinweisKunde) kundenSaetze.push(u.hinweisKunde);
      if (u.erkannt === false || u.vollstaendig === false) internWarnungen.push(u.hinweisIntern || `${art}: auffällig`);
    }

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
      VALUES (${ref}, ${currentApp.person_id ?? null}, NULL, 'System', 'system',
              ${`Kunde hat hochgeladen: ${was}. Prüfung durch die Verwaltung steht aus.${internWarnungen.length ? ` AUTOMATISCHE PRÜFUNG: ${internWarnungen.join(" · ")}` : ""}`}, NOW())
    `.catch(() => {});
    await sqlPool`
      INSERT INTO fiaon_vermerke (art, ref, text, sicht, fuer_betreiber, dringend, status, autor_art, autor_name, faellig_am)
      VALUES ('aufgabe', ${ref},
              ${`Unterlagen eingegangen (${was}) — bitte prüfen und freigeben (Verwaltung → Kunden → Prüfung). Der Kunde wurde informiert, dass die Prüfung bis zu zwei Werktage dauert.${internWarnungen.length ? ` ⚠ Automatische Prüfung meldet: ${internWarnungen.join(" · ")}` : ""}`},
              'betreiber', TRUE, ${internWarnungen.length > 0}, 'offen', 'system', 'System',
              ((NOW() AT TIME ZONE 'Europe/Berlin')::date + 2))
    `.catch((e) => console.error("[FIAON-KYC] Aufgabe nicht angelegt:", e?.message));

    // Die Auswertung läuft sofort los — der Kunde sieht sie in wenigen Minuten
    // unter „Ihre Finanzen". Nicht awaited: Der Upload ist fertig, die Analyse
    // ist ein Folgeschritt und darf die Antwort nicht aufhalten.
    if (files.bankStatement) {
      void import("../lib/fiaon-kontoauszug-analyse")
        .then(({ kontoauszugAnalysieren }) => kontoauszugAnalysieren(String(ref), { erzwingen: true }))
        .catch((e) => console.error("[FIAON-KYC] Analyse:", e));
    }

    const hasSchufa = !!(files.schufaDoc || currentApp.schufa_pdf);
    res.json({ 
      ok: true, 
      // P9: Steht ein Sofort-Befund an, führt ER die Meldung an — der Kunde
      // soll die falsche Datei JETZT tauschen, nicht in zwei Werktagen.
      message: (kundenSaetze.length ? `${kundenSaetze.join(" ")} ` : "") + (files.bankStatement
        ? "Eingegangen. Ihr Kontoauszug wird jetzt ausgewertet — in wenigen Minuten sehen Sie das Ergebnis unter „Ihre Finanzen“. Die Prüfung Ihrer Unterlagen dauert bis zu zwei Werktage."
        : "Eingegangen. Wir prüfen Ihre Unterlagen innerhalb von zwei Werktagen und melden uns."),
      pruefungen,
      hasBankStatement: !!hasBankStatement,
      hasIdCard: !!hasIdCard,
      hasSchufa,
      allDocumentsUploaded: !!(hasBankStatement && hasIdCard),
      kycStatus: newKycStatus,
      reuploadBankStatement: files.bankStatement ? false : !!(currentApp.reupload_bank_statement),
      reuploadIdCard: files.idCard ? false : !!(currentApp.reupload_id_card),
    });
  } catch (err) {
    console.error("[FIAON-KYC]", err);
    res.status(500).json({ error: "Fehler beim Hochladen der Dokumente" });
  }
});

/** Verwaltung: Kontoauszug (erneut) auswerten / Ergebnis lesen. */
router.post("/admin/kontoauszug/:ref/analysieren", async (req, res) => {
  try {
    const { kontoauszugAnalysieren } = await import("../lib/fiaon-kontoauszug-analyse");
    const a = await kontoauszugAnalysieren(String(req.params.ref), { erzwingen: true });
    if (!a) return res.status(404).json({ ok: false, error: "Kein Kontoauszug hinterlegt." });
    res.json({ ok: true, analyse: a });
  } catch (err) {
    console.error("[ADMIN] kontoauszug analysieren:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});
router.get("/admin/kontoauszug/:ref", async (req, res) => {
  try {
    const { analyseFuer } = await import("../lib/fiaon-kontoauszug-analyse");
    res.json({ ok: true, analyse: await analyseFuer(String(req.params.ref)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Check KYC document status
router.get("/kyc-status/:ref", async (req, res) => {
  try {
    const { ref } = req.params;

    // Ensure profile + schufa columns exist
    await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP, ADD COLUMN IF NOT EXISTS admin_profile_note TEXT, ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS schufa_pdf BYTEA`.catch(() => {});

    const apps = await sqlPool`
      SELECT
        CASE WHEN bank_statement_pdf IS NOT NULL THEN true ELSE false END as has_bank_statement,
        CASE WHEN id_card_pdf IS NOT NULL THEN true ELSE false END as has_id_card,
        CASE WHEN schufa_pdf IS NOT NULL THEN true ELSE false END as has_schufa,
        documents_uploaded_at,
        status,
        kyc_status,
        account_status,
        admin_note,
        admin_reviewed_at,
        reupload_bank_statement,
        reupload_id_card,
        admin_profile_note,
        profile_changes_requested,
        profile_completed_at
      FROM fiaon_applications
      WHERE ref = ${ref}
      LIMIT 1
    `;

    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }

    const app = apps[0];
    res.json({
      hasBankStatement: app.has_bank_statement,
      hasIdCard: app.has_id_card,
      documentsUploadedAt: app.documents_uploaded_at,
      status: app.status,
      kycStatus: app.kyc_status ?? 'pending',
      accountStatus: app.account_status ?? 'pending',
      adminNote: app.admin_note ?? null,
      adminReviewedAt: app.admin_reviewed_at ?? null,
      reuploadBankStatement: app.reupload_bank_statement ?? false,
      reuploadIdCard: app.reupload_id_card ?? false,
      hasSchufa: app.has_schufa ?? false,
      adminProfileNote: app.admin_profile_note ?? null,
      profileChangesRequested: app.profile_changes_requested ?? false,
      profileCompletedAt: app.profile_completed_at ?? null,
    });
  } catch (err) {
    console.error("[FIAON-KYC-STATUS]", err);
    res.status(500).json({ error: "Fehler beim Abrufen des Status" });
  }
});

// ── GET /bonitaet-status/:ref — Zustand des Bonitäts-Checks (NUR LESEN) ─────
//
// Hintergrund (SYSTEM_DIAGNOSE.md, Abschnitt B0): Der Kauf der Bonitätsauskunft
// erzeugt eine EIGENE Antragszeile (ref = FIAON-SCHUFA-…, type = 'schufa'), die
// bewusst nicht mit dem Kundendatensatz verknüpft wird — sonst entstünde ein
// zweiter Kunde inkl. Agentenzuteilung. Folge: Das Dashboard konnte bisher nicht
// wissen, ob ein Kunde bereits gekauft oder bezahlt hat, und forderte auch nach
// Zahlung weiter zum Hochladen auf.
//
// Dieser Endpunkt schließt genau diese Wissenslücke — und NUR sie:
//   - Er liest ausschließlich (kein UPDATE, kein INSERT).
//   - Er verändert weder Zahlungs- noch Freischaltungslogik. Ob ein bezahlter
//     Kauf den Freischaltungs-Nachweis erfüllt, entscheidet der Vorgesetzte
//     (SYSTEM_DIAGNOSE.md, Abschnitt B3) — hier wird nur berichtet, was ist.
//   - Zuordnung über die E-Mail des Kunden, weil es keine andere Verbindung gibt.
//
// Zustände: 'offen' (nicht gekauft) → 'zahlung_offen' → 'bezahlt' (Auskunft wird
// beschafft) → 'geliefert' (liegt im Kundendatensatz).
router.get("/bonitaet-status/:ref", async (req, res) => {
  try {
    const { ref } = req.params;

    // ══════════════════════════════════════════════════════════════════════
    // EINE ABLEITUNG STATT DREI TEILWAHRHEITEN (22.08.2026)
    //
    // Hier stand eine eigene Rechnung: Sie las `schufa_pdf`, suchte die
    // Auskunft-Bestellung über die E-MAIL und setzte daraus vier Zustände
    // zusammen. Dieselbe Rechnung stand in anderer Form in der Kundenakte, in
    // der Verwalten-Tabelle und im Gate — jede etwas anders.
    //
    // GEMESSEN: 30 zahlende Kunden hatten die Auskunft BEZAHLT, aber kein
    // Dokument — und das Portal forderte sie weiter zum Kaufen auf. 31 hatten
    // selbst hochgeladen und sahen ebenfalls „kaufen". 35 Dokumente lagen zur
    // Prüfung, 0 waren geprüft.
    //
    // Jetzt rechnet `server/lib/fiaon-bonitaet-status.ts` — eine Stelle, sechs
    // Stufen, mit Klartext für Verwaltung UND Kunde, und mit `darfKaufen`.
    // Die Zuordnung läuft über die PERSON (die E-Mail bleibt Rückfall für die
    // 9 alten Bestellungen ohne person_id).
    // ══════════════════════════════════════════════════════════════════════
    const { bonitaetFuer, BONITAET_MARKE, BONITAET_TON } =
      await import("../lib/fiaon-bonitaet-status");
    const stand = await bonitaetFuer(ref);
    if (!stand) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });

    // Die Bestelldaten für die Anzeige (Verwendungszweck, Frist).
    let bestellung: any = null;
    if (stand.bestellRef) {
      const [o] = await sqlPool`
        SELECT payment_reference, payment_status, amount_due, payment_due_date, created_at
        FROM fiaon_applications WHERE ref = ${stand.bestellRef} LIMIT 1
      `;
      if (o) {
        bestellung = {
          paymentReference: o.payment_reference,
          status: o.payment_status,
          betrag: o.amount_due != null ? String(o.amount_due) : null,
          faelligAm: o.payment_due_date,
          bestelltAm: o.created_at,
        };
      }
    }

    // Fahrplan-Anschluss: Ist für diesen Kunden schon eine Analyse freigegeben?
    // Die Tabellen gehören zum Fahrplan-Produkt und existieren evtl. noch nicht —
    // ein Fehlschlag darf den Zustand nicht kippen.
    let analyse = "keine";
    let fahrplanSchritte = 0;
    try {
      const a2 = await sqlPool`SELECT status FROM fiaon_analysis WHERE ref = ${ref} LIMIT 1`;
      if (a2[0]?.status === "approved") analyse = "fertig";
      else if (a2[0]) analyse = "laeuft";
      const st = await sqlPool`SELECT COUNT(*)::int AS c FROM fiaon_roadmap_steps WHERE ref = ${ref}`;
      fahrplanSchritte = st[0]?.c ?? 0;
    } catch { /* Fahrplan noch nie benutzt — bleibt 'keine' */ }

    res.json({
      ok: true,
      // ── DIE ALTEN NAMEN BLEIBEN BEDIENT ────────────────────────────────
      // `zustand` lesen zwei Oberflächen (naechste-schritte.tsx,
      // StartgespraechGate.tsx). Ein Umbenennen hätte sie stumm kaputt
      // gemacht — die alten Werte werden also weiter geliefert, abgeleitet
      // aus der neuen Stufe.
      zustand: stand.stufe === "geprueft" || stand.stufe === "liegt_zur_pruefung"
        ? "geliefert"
        : stand.stufe === "beschaffung_laeuft" ? "bezahlt"
        : stand.stufe === "zahlung_offen" ? "zahlung_offen"
        : "offen",
      // ── UND DAS NEUE, VOLLSTÄNDIGE BILD ───────────────────────────────
      stufe: stand.stufe,
      marke: BONITAET_MARKE[stand.stufe],
      ton: BONITAET_TON[stand.stufe],
      grund: stand.grund,
      fuerKunden: stand.fuerKunden,
      naechsterSchritt: stand.naechsterSchritt,
      // Der Kern: Das Portal fragt DIESES Feld, statt selbst zu rechnen.
      darfKaufen: stand.darfKaufen,
      darfHochladen: stand.darfHochladen,
      bezahlt: stand.bezahlt,
      hatDokument: stand.hatDokument,
      preisEuro: SCHUFA_PRICE,
      bestellung,
      analyse,
      fahrplanSchritte,
    });
  } catch (err) {
    console.error("[FIAON-BONITAET-STATUS]", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ── GET /profile/:ref — Vollständiges Kundenprofil ──────────────────────────
router.get("/profile/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    // Auto-migrate profile fields
    await sqlPool`
      ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS moved_recently BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS previous_street VARCHAR,
      ADD COLUMN IF NOT EXISTS previous_zip VARCHAR,
      ADD COLUMN IF NOT EXISTS previous_city VARCHAR,
      ADD COLUMN IF NOT EXISTS previous_country VARCHAR,
      ADD COLUMN IF NOT EXISTS passport_number VARCHAR,
      ADD COLUMN IF NOT EXISTS passport_expiry DATE,
      ADD COLUMN IF NOT EXISTS has_additional_income BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS additional_income_sources TEXT,
      ADD COLUMN IF NOT EXISTS additional_income_amount INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_food INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_transport INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_insurance INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_loans INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_subscriptions INTEGER,
      ADD COLUMN IF NOT EXISTS expenses_other INTEGER,
      ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS admin_profile_note TEXT,
      ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE
    `.catch(() => {});

    const apps = await sqlPool`SELECT * FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`;
    if (apps.length === 0) return res.status(404).json({ ok: false, error: "Antrag nicht gefunden" });
    const a = apps[0];
    res.json({
      ok: true,
      firstName: a.first_name, lastName: a.last_name,
      birthdate: a.birthdate, nationality: a.nationality,
      email: a.email, phone: a.phone, phoneCountryCode: a.phone_country_code,
      street: a.street, zip: a.zip, city: a.city, country: a.country, housing: a.housing,
      income: a.income, rent: a.rent, debts: a.debts,
      employment: a.employment, employer: a.employer, employedSince: a.employed_since,
      wantedLimit: a.wanted_limit, purpose: a.purpose, billing: a.billing,
      billingMethod: a.billing_method, salaryReceiptDay: a.salary_receipt_day,
      iban: a.iban, packName: a.pack_name, packKey: a.pack_key,
      // #20: Portal zeigt das Paket-Limit, wenn approved_limit fehlt/auf 250 € geklemmt ist.
      approvedLimit: effectiveLimit(a.pack_key, a.approved_limit), accountStatus: a.account_status, kycStatus: a.kyc_status,
      movedRecently: a.moved_recently ?? false,
      previousStreet: a.previous_street ?? '', previousZip: a.previous_zip ?? '',
      previousCity: a.previous_city ?? '', previousCountry: a.previous_country ?? 'Deutschland',
      passportNumber: a.passport_number ?? '', passportExpiry: a.passport_expiry ? String(a.passport_expiry).slice(0,10) : '',
      hasAdditionalIncome: a.has_additional_income ?? false,
      additionalIncomeSources: a.additional_income_sources ?? '',
      additionalIncomeAmount: a.additional_income_amount ?? '',
      expensesFood: a.expenses_food ?? '', expensesTransport: a.expenses_transport ?? '',
      expensesInsurance: a.expenses_insurance ?? '', expensesLoans: a.expenses_loans ?? '',
      expensesSubscriptions: a.expenses_subscriptions ?? '', expensesOther: a.expenses_other ?? '',
      profileCompletedAt: a.profile_completed_at,
      adminProfileNote: a.admin_profile_note ?? null,
      profileChangesRequested: a.profile_changes_requested ?? false,
    });
  } catch (err) {
    console.error("[FIAON-PROFILE-GET]", err);
    res.status(500).json({ ok: false, error: "Fehler beim Laden" });
  }
});

// ── PATCH /profile/:ref — Profil-Ergänzungen speichern ──────────────────────
router.patch("/profile/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    const { movedRecently, previousStreet, previousZip, previousCity, previousCountry,
      passportNumber, passportExpiry, hasAdditionalIncome,
      additionalIncomeSources, additionalIncomeAmount,
      expensesFood, expensesTransport, expensesInsurance,
      expensesLoans, expensesSubscriptions, expensesOther } = req.body;
    const toInt = (v: any) => (v !== '' && v != null) ? parseInt(String(v)) : null;
    await sqlPool`
      UPDATE fiaon_applications SET
        moved_recently             = ${!!movedRecently},
        previous_street            = ${previousStreet || null},
        previous_zip               = ${previousZip || null},
        previous_city              = ${previousCity || null},
        previous_country           = ${previousCountry || null},
        passport_number            = ${passportNumber || null},
        passport_expiry            = ${passportExpiry || null},
        has_additional_income      = ${!!hasAdditionalIncome},
        additional_income_sources  = ${additionalIncomeSources || null},
        additional_income_amount   = ${toInt(additionalIncomeAmount)},
        expenses_food              = ${toInt(expensesFood)},
        expenses_transport         = ${toInt(expensesTransport)},
        expenses_insurance         = ${toInt(expensesInsurance)},
        expenses_loans             = ${toInt(expensesLoans)},
        expenses_subscriptions     = ${toInt(expensesSubscriptions)},
        expenses_other             = ${toInt(expensesOther)},
        profile_completed_at       = NOW(),
        profile_changes_requested  = FALSE,
        updated_at                 = NOW()
      WHERE ref = ${ref}
    `;
    console.log(`[FIAON-PROFILE-PATCH] ${ref} — Profil aktualisiert`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-PROFILE-PATCH]", err);
    res.status(500).json({ ok: false, error: "Fehler beim Speichern" });
  }
});

// Admin: review application — set kyc_status, account_status, admin_note
router.patch("/admin/applications/:ref/review", async (req, res) => {
  try {
    const { ref } = req.params;
    const { kycStatus, accountStatus, adminNote, reuploadBankStatement, reuploadIdCard, adminProfileNote, profileChangesRequested, schufaStatus, adminSchufaNote } = req.body;

    const validKyc = ['pending', 'approved', 'changes_requested'];
    const validAccount = ['pending', 'active', 'suspended'];

    if (kycStatus && !validKyc.includes(kycStatus)) {
      return res.status(400).json({ error: "Ungültiger kycStatus" });
    }
    if (accountStatus && !validAccount.includes(accountStatus)) {
      return res.status(400).json({ error: "Ungültiger accountStatus" });
    }

    // Ensure all columns exist (idempotent migration)
    await sqlPool`
      ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS kyc_status VARCHAR DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS account_status VARCHAR DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS admin_note TEXT,
      ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS reupload_bank_statement BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS reupload_id_card BOOLEAN DEFAULT false
    `.catch(() => {});

    // When approving docs, always clear reupload flags
    const clearReupload = kycStatus === 'approved';
    const setReuploadBank = reuploadBankStatement !== undefined
      ? !!reuploadBankStatement
      : (clearReupload ? false : null);
    const setReuploadId = reuploadIdCard !== undefined
      ? !!reuploadIdCard
      : (clearReupload ? false : null);

    // Also migrate profile + schufa review columns if needed
    await sqlPool`ALTER TABLE fiaon_applications ADD COLUMN IF NOT EXISTS admin_profile_note TEXT, ADD COLUMN IF NOT EXISTS profile_changes_requested BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS schufa_status VARCHAR DEFAULT 'pending', ADD COLUMN IF NOT EXISTS admin_schufa_note TEXT`.catch(() => {});

    await sqlPool`
      UPDATE fiaon_applications SET
        kyc_status                 = COALESCE(${kycStatus ?? null}, kyc_status),
        account_status             = COALESCE(${accountStatus ?? null}, account_status),
        admin_note                 = ${adminNote !== undefined ? (adminNote || null) : null},
        admin_reviewed_at          = NOW(),
        reupload_bank_statement    = COALESCE(${setReuploadBank}, reupload_bank_statement),
        reupload_id_card           = COALESCE(${setReuploadId}, reupload_id_card),
        admin_profile_note         = ${adminProfileNote !== undefined ? (adminProfileNote || null) : null},
        profile_changes_requested  = COALESCE(${profileChangesRequested ?? null}, profile_changes_requested),
        schufa_status              = COALESCE(${schufaStatus ?? null}, schufa_status),
        admin_schufa_note          = ${adminSchufaNote !== undefined ? (adminSchufaNote || null) : null},
        updated_at                 = NOW()
      WHERE ref = ${ref}
    `;

    // Ein Kontozustand ist eine Entscheidung — also braucht er einen
    // Verantwortlichen. Vorher stand eine Sperre nur in der Spalte, ohne Spur:
    // Beim Reaktivierungslauf (Teil 0) war deshalb bei zwei gesperrten Konten
    // nicht mehr feststellbar, ob ein Mensch das entschieden hatte oder eine
    // Automatik. Ab jetzt ist das für jede künftige Sperrung beantwortbar.
    if (accountStatus) {
      await sqlPool`
        INSERT INTO fiaon_agent_events (agent_id, type, meta, actor, reason)
        VALUES (NULL, 'konto_status_geaendert',
                ${JSON.stringify({ ref, accountStatus, quelle: "admin_review" })},
                'Vorgesetzter (Admin-Prüfung)',
                ${`Kontozustand auf '${accountStatus}' gesetzt`})
      `.catch((e) => console.error("[FIAON-REVIEW] Protokoll:", e));
    }

    console.log(`[FIAON-REVIEW] ${ref} → kycStatus=${kycStatus} accountStatus=${accountStatus} reuploadBank=${setReuploadBank} reuploadId=${setReuploadId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-REVIEW]", err);
    res.status(500).json({ error: "Fehler beim Review-Update" });
  }
});

// Download KYC document
/**
 * POST /document-link — ein kurzlebiger Link für den KUNDEN.
 *
 * Prüft dieselbe Familie wie der Login: Wer die Referenz UND die zugehörige
 * E-Mail nennt, ist mit hoher Wahrscheinlichkeit der Kontoinhaber. Das ist
 * kein Passwort — es ist der zweite Faktor, den es vorher gar nicht gab.
 */
router.post("/document-link", async (req, res) => {
  try {
    const ref = String(req.body?.ref || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const art = String(req.body?.art || "");
    const { artAusKurz, dokumentTokenErzeugen, LINK_MINUTEN } = await import("../lib/fiaon-dokumente");
    const gewaehlt = artAusKurz(art);
    if (!ref || !email || !gewaehlt) return res.status(400).json({ ok: false, error: "Unvollständige Anfrage." });

    const [a] = await sqlPool`
      SELECT ref FROM fiaon_applications
      WHERE ref = ${ref} AND gdpr_deleted_at IS NULL
        AND (LOWER(TRIM(COALESCE(email, ''))) = ${email}
          OR LOWER(TRIM(COALESCE(contact_email, ''))) = ${email}
          OR LOWER(TRIM(COALESCE(billing_email, ''))) = ${email})
      LIMIT 1
    `;
    if (!a) return res.status(403).json({ ok: false, error: "Zugang nicht möglich." });
    res.json({
      ok: true,
      url: `/api/fiaon/document/${encodeURIComponent(ref)}/${art}?t=${dokumentTokenErzeugen(ref, gewaehlt)}`,
      gueltigMinuten: LINK_MINUTEN,
    });
  } catch (err) {
    console.error("[FIAON-DOK] link:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/**
 * ── ABGESICHERT AM 10.08.2026 ──────────────────────────────────────────────
 * Diese Route lag unter „Public (no auth)". Wer eine Bestellreferenz kannte —
 * sie steht in jeder Zahlungs-Mail, auf jeder Rechnung, in jedem Screenshot —
 * konnte den AUSWEIS des Kunden herunterladen. Ohne Anmeldung, ohne Spur.
 *
 * Sie bleibt öffentlich erreichbar, weil das Kundenportal keine Server-Sitzung
 * hat (die Anmeldung liegt im Browser). Statt einer Sitzung verlangt sie jetzt
 * ein SIGNIERTES, 15 Minuten gültiges Token — dasselbe Muster wie bei
 * Rechnungs-, Termin- und Zugangslinks. Der Kunde holt es sich über
 * POST /api/fiaon/document-link; wer nur die Referenz hat, kommt nicht weiter.
 */
router.get("/document/:ref/:type", async (req, res) => {
  try {
    const { ref, type } = req.params;

    if (type !== "bank-statement" && type !== "id-card") {
      return res.status(400).json({ error: "Ungültiger Dokumenttyp" });
    }

    const { artAusKurz, dokumentTokenPruefen } = await import("../lib/fiaon-dokumente");
    const art = artAusKurz(String(type));
    const token = String(req.query.t || "");
    if (!art || !dokumentTokenPruefen(ref, art, token)) {
      return res.status(403).json({
        ok: false,
        error: "Dieser Link ist abgelaufen oder ungültig. Öffne die Unterlagen bitte erneut aus deinem Konto.",
      });
    }

    const apps = await sqlPool`
      SELECT
        bank_statement_pdf,
        id_card_pdf
      FROM fiaon_applications
      WHERE ref = ${ref}
      LIMIT 1
    `;

    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }

    const app = apps[0];
    const buffer = type === "bank-statement" ? app.bank_statement_pdf : app.id_card_pdf;

    if (!buffer) {
      return res.status(404).json({ error: "Dokument nicht gefunden" });
    }

    const filename = type === "bank-statement" ? "Kontoauszüge.pdf" : "Ausweis.pdf";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error("[FIAON-DOCUMENT-DOWNLOAD]", err);
    res.status(500).json({ error: "Fehler beim Herunterladen des Dokuments" });
  }
});

// Create test user (admin only) — always creates a fresh unique user
router.post("/admin/create-test-user", async (req, res) => {
  try {
    const ts = Date.now();
    const testRef = `FIA-DEV-${ts}`;
    const testEmail = `dev.test.${ts}@fiaon-internal.dev`;
    const testPassword = "DevTest123!";

    await sqlPool`
      INSERT INTO fiaon_applications (
        ref, type, status, current_step, pack_key, pack_name,
        first_name, last_name, birthdate, phone, phone_country_code,
        street, zip, city, country, nationality,
        employment, employer, employed_since, income, rent, debts, housing,
        wanted_limit, purpose, billing, addon, nfc,
        approved_limit, email, iban, billing_method, salary_receipt_day,
        consent_agb, consent_schufa, consent_contract,
        ip, user_agent, utm, created_at, updated_at
      ) VALUES (
        ${testRef}, 'private', 'approved', 5, 'standard', 'FIAON Standard',
        'Dev', 'User', '1985-03-15', '+491701234567', '+49',
        'Musterstraße 42', '10115', 'Berlin', 'Deutschland', 'deutsch',
        'Angestellt', 'Tech Solutions GmbH', '2020-01-01', 65000, 1200, 0, 'Miete',
        10000, 'Allgemeine Nutzung', 'Vollzahlung', false, true,
        10000, ${testEmail}, 'DE89 3704 0044 0532 0130 00', 'SEPA', 15,
        true, true, true,
        '127.0.0.1', 'Mozilla/5.0 (Test)', ${JSON.stringify({ password: testPassword })}, NOW(), NOW()
      )
    `;

    console.log("[FIAON-ADMIN] Dev-User erstellt:", testEmail);
    return res.json({ ok: true, ref: testRef, email: testEmail, password: testPassword, firstName: "Dev", lastName: "User", packName: "FIAON Standard", approvedLimit: 10000 });
  } catch (err) {
    console.error("[FIAON-ADMIN]", err);
    res.status(500).json({ error: "Fehler beim Erstellen des Dev-Users" });
  }
});

// Generate and download contract PDF
router.get("/contract/:ref", async (req, res) => {
  try {
    const { ref } = req.params;
    
    // Get application data
    const apps = await db.select().from(fiaonApplications).where(eq(fiaonApplications.ref, ref)).limit(1);
    if (apps.length === 0) {
      return res.status(404).json({ error: "Antrag nicht gefunden" });
    }
    
    const app = apps[0];
    
    // Create PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FIAON_Vertrag_${ref}.pdf"`);
    
    // Pipe PDF to response
    doc.pipe(res);
    
    // Header
    doc.fontSize(24).font('Helvetica-Bold').text('FIAON Kreditkartenvertrag', { align: 'center' });
    doc.moveDown();
    doc.fontSize(10).font('Helvetica').text(`Vertragsnummer: ${ref}`, { align: 'center' });
    doc.text(`Datum: ${new Date().toLocaleDateString('de-DE')}`, { align: 'center' });
    doc.moveDown(2);
    
    // Vertragsparteien
    doc.fontSize(14).font('Helvetica-Bold').text('§1 Vertragsparteien');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('Anbieterin:', { continued: true }).font('Helvetica-Bold').text(' FIAON LTD');
    doc.font('Helvetica').text('128 City Road, London, EC1V 2NX, United Kingdom');
    doc.font('Helvetica').text('Companies House (England and Wales), Company No. 17318250 · Director: Justin Schwarzott');
    doc.moveDown();
    doc.text('Kreditnehmer:', { continued: true }).font('Helvetica-Bold').text(` ${app.firstName || ''} ${app.lastName || ''}`);
    if (app.street) doc.font('Helvetica').text(`${app.street}, ${app.zip || ''} ${app.city || ''}`);
    if (app.birthdate) doc.text(`Geburtsdatum: ${new Date(app.birthdate).toLocaleDateString('de-DE')}`);
    doc.moveDown(1.5);
    
    // Vertragsgegenstand
    doc.fontSize(14).font('Helvetica-Bold').text('§2 Vertragsgegenstand');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Der Kreditgeber stellt dem Kreditnehmer eine ${app.packName || 'FIAON'} Kreditkarte mit folgenden Konditionen zur Verfügung:`);
    doc.moveDown(0.5);
    doc.list([
      `Kreditlimit: bis zu ${app.approvedLimit ? (app.approvedLimit.toLocaleString('de-DE') + ' €') : 'individuell festgelegt'}`,
      `Monatliche Grundgebühr: gemäß Preisverzeichnis`,
      `Verwendungszweck: ${app.purpose || 'allgemeine Nutzung'}`,
      `Abrechnungsart: ${app.billing || 'Vollzahlung'}`,
      `NFC kontaktlos: ${app.nfc || 'aktiviert'}`
    ]);
    doc.moveDown(1.5);
    
    // Kreditkonditionen
    doc.fontSize(14).font('Helvetica-Bold').text('§3 Kreditkonditionen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('3.1 Der Kreditnehmer kann die Kreditkarte im Rahmen des vereinbarten Kreditlimits nutzen.');
    doc.text('3.2 Die Abrechnung erfolgt monatlich zum Ende des Abrechnungszeitraums.');
    doc.text('3.3 Bei Vollzahlung fallen keine Sollzinsen an. Bei Teilzahlung gelten die Konditionen gemäß Preisverzeichnis.');
    doc.moveDown(1.5);
    
    // Zahlungsbedingungen
    doc.fontSize(14).font('Helvetica-Bold').text('§4 Zahlungsbedingungen');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    if (app.billingMethod === 'iban' && app.iban) {
      doc.text(`4.1 Die Abbuchung erfolgt per SEPA-Lastschrift von folgendem Konto:`);
      doc.text(`IBAN: ${app.iban}`);
    } else {
      doc.text('4.1 Die Abrechnung erfolgt per Papierrechnung.');
    }
    doc.text('4.2 Die Zahlung ist innerhalb von 14 Tagen nach Rechnungsstellung fällig.');
    doc.moveDown(1.5);
    
    // Kündigungsrecht
    doc.fontSize(14).font('Helvetica-Bold').text('§5 Kündigungsrecht');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('5.1 Beide Vertragsparteien können diesen Vertrag jederzeit mit einer Frist von 4 Wochen kündigen.');
    doc.text('5.2 Die Kündigung bedarf der Schriftform.');
    doc.moveDown(1.5);
    
    // Datenschutz
    doc.fontSize(14).font('Helvetica-Bold').text('§6 Datenschutz');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text('6.1 Der Kreditgeber verarbeitet personenbezogene Daten gemäß DSGVO.');
    doc.text('6.2 Eine Bonitätsprüfung bei der SCHUFA wurde durchgeführt.');
    doc.moveDown(2);
    
    // Unterschriften
    doc.fontSize(12).font('Helvetica-Bold').text('Vertragsannahme');
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Der Kreditnehmer ${app.firstName || ''} ${app.lastName || ''} bestätigt hiermit:`);
    doc.moveDown(0.5);
    doc.list([
      app.consentAgb ? '✓ AGB und Datenschutzerklärung akzeptiert' : '☐ AGB und Datenschutzerklärung',
      app.consentSchufa ? '✓ Einwilligung zur Bonitätsprüfung erteilt' : '☐ Einwilligung zur Bonitätsprüfung',
      app.consentContract ? '✓ Vertrag verbindlich angenommen' : '☐ Vertrag angenommen'
    ]);
    doc.moveDown(2);
    
    doc.text(`Ort, Datum: London, ${new Date().toLocaleDateString('de-DE')}`);
    doc.moveDown(2);
    doc.text('_'.repeat(40));
    doc.text('Unterschrift Kreditnehmer (digital bestätigt)');
    
    // Footer
    doc.fontSize(8).text('\n\nFIAON LTD | 128 City Road | London, EC1V 2NX | United Kingdom | Companies House No. 17318250 | Director: Justin Schwarzott | support@fiaon.com', { align: 'center' });
    
    // Finalize PDF
    doc.end();
    
  } catch (err) {
    console.error('[FIAON-CONTRACT-PDF]', err);
    res.status(500).json({ error: 'PDF-Generierung fehlgeschlagen' });
  }
});

// ── Helper: render a contract PDF for one application (snake_case DB row) ──
function renderContractPdf(doc: PDFKit.PDFDocument, a: any) {
  const acceptedAt = a.completed_at || a.submitted_at || a.updated_at || a.created_at;
  const acceptedDate = acceptedAt ? new Date(acceptedAt) : new Date();
  const dateStr = acceptedDate.toLocaleDateString('de-DE');
  const timeStr = acceptedDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  // Header
  doc.fontSize(24).font('Helvetica-Bold').text('FIAON Kreditkartenvertrag', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).font('Helvetica').text(`Vertragsnummer: ${a.ref}`, { align: 'center' });
  doc.text(`Datum: ${dateStr}`, { align: 'center' });
  doc.moveDown(2);

  // Vertragsparteien
  doc.fontSize(14).font('Helvetica-Bold').text('§1 Vertragsparteien');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('Anbieterin:', { continued: true }).font('Helvetica-Bold').text(' FIAON LTD');
  doc.font('Helvetica').text('128 City Road, London, EC1V 2NX, United Kingdom');
  doc.font('Helvetica').text('Companies House (England and Wales), Company No. 17318250 · Director: Justin Schwarzott');
  doc.moveDown();
  doc.text('Kreditnehmer:', { continued: true }).font('Helvetica-Bold').text(` ${a.first_name || ''} ${a.last_name || ''}`);
  if (a.street) doc.font('Helvetica').text(`${a.street}, ${a.zip || ''} ${a.city || ''}`);
  if (a.birthdate) doc.font('Helvetica').text(`Geburtsdatum: ${new Date(a.birthdate).toLocaleDateString('de-DE')}`);
  if (a.email) doc.font('Helvetica').text(`E-Mail: ${a.email}`);
  doc.moveDown(1.5);

  // Vertragsgegenstand
  doc.fontSize(14).font('Helvetica-Bold').text('§2 Vertragsgegenstand');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Der Kreditgeber stellt dem Kreditnehmer eine ${a.pack_name || 'FIAON'} Kreditkarte mit folgenden Konditionen zur Verfügung:`);
  doc.moveDown(0.5);
  doc.list([
    `Kreditlimit: bis zu ${a.approved_limit ? (Number(a.approved_limit).toLocaleString('de-DE') + ' €') : 'individuell festgelegt'}`,
    `Monatliche Grundgebühr: gemäß Preisverzeichnis`,
    `Verwendungszweck: ${a.purpose || 'allgemeine Nutzung'}`,
    `Abrechnungsart: ${a.billing || 'Vollzahlung'}`,
    `NFC kontaktlos: ${a.nfc || 'aktiviert'}`,
  ]);
  doc.moveDown(1.5);

  // Kreditkonditionen
  doc.fontSize(14).font('Helvetica-Bold').text('§3 Kreditkonditionen');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('3.1 Der Kreditnehmer kann die Kreditkarte im Rahmen des vereinbarten Kreditlimits nutzen.');
  doc.text('3.2 Die Abrechnung erfolgt monatlich zum Ende des Abrechnungszeitraums.');
  doc.text('3.3 Bei Vollzahlung fallen keine Sollzinsen an. Bei Teilzahlung gelten die Konditionen gemäß Preisverzeichnis.');
  doc.moveDown(1.5);

  // Zahlungsbedingungen
  doc.fontSize(14).font('Helvetica-Bold').text('§4 Zahlungsbedingungen');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  if (a.billing_method === 'iban' && a.iban) {
    doc.text('4.1 Die Abbuchung erfolgt per SEPA-Lastschrift von folgendem Konto:');
    doc.text(`IBAN: ${a.iban}`);
  } else {
    doc.text('4.1 Die Abrechnung erfolgt per Papierrechnung.');
  }
  doc.text('4.2 Die Zahlung ist innerhalb von 14 Tagen nach Rechnungsstellung fällig.');
  doc.moveDown(1.5);

  // Kündigungsrecht
  doc.fontSize(14).font('Helvetica-Bold').text('§5 Kündigungsrecht');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('5.1 Beide Vertragsparteien können diesen Vertrag jederzeit mit einer Frist von 4 Wochen kündigen.');
  doc.text('5.2 Die Kündigung bedarf der Schriftform.');
  doc.moveDown(1.5);

  // Datenschutz
  doc.fontSize(14).font('Helvetica-Bold').text('§6 Datenschutz');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text('6.1 Der Kreditgeber verarbeitet personenbezogene Daten gemäß DSGVO.');
  doc.text('6.2 Eine Bonitätsprüfung bei der SCHUFA wurde durchgeführt.');
  doc.moveDown(2);

  // Vertragsannahme + digitaler Nachweis
  doc.fontSize(12).font('Helvetica-Bold').text('Vertragsannahme');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica');
  doc.text(`Der Kreditnehmer ${a.first_name || ''} ${a.last_name || ''} bestätigt hiermit:`);
  doc.moveDown(0.5);
  doc.list([
    a.consent_agb ? '✓ AGB und Datenschutzerklärung akzeptiert' : '☐ AGB und Datenschutzerklärung',
    a.consent_schufa ? '✓ Einwilligung zur Bonitätsprüfung erteilt' : '☐ Einwilligung zur Bonitätsprüfung',
    a.consent_contract ? '✓ Vertrag verbindlich angenommen' : '☐ Vertrag angenommen',
  ]);
  doc.moveDown(2);

  doc.text(`Ort, Datum: London, ${dateStr}`);
  doc.moveDown(2);
  doc.text('_'.repeat(40));
  doc.text('Unterschrift Kreditnehmer (digital bestätigt)');
  doc.moveDown(1);

  // Digitaler Akzeptanz-Nachweis (Audit-Trail)
  doc.fontSize(8).font('Helvetica-Bold').text('Digitaler Akzeptanz-Nachweis:');
  doc.fontSize(8).font('Helvetica');
  doc.text(`Bestätigt am ${dateStr} um ${timeStr} Uhr`);
  if (a.ip) doc.text(`IP-Adresse: ${a.ip}`);
  if (a.user_agent) doc.text(`Gerät/Browser: ${String(a.user_agent).slice(0, 160)}`);

  // Footer
  doc.fontSize(8).text('\n\nFIAON LTD | 128 City Road | London, EC1V 2NX | United Kingdom | Companies House No. 17318250 | Director: Justin Schwarzott | support@fiaon.com', { align: 'center' });
}

// ── CSV escaping helper ──
function csvCell(v: any): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Admin: download ALL contract acceptances as ZIP (one PDF per customer + CSV audit list)
router.get("/admin/contracts/download-all", async (req, res) => {
  try {
    const apps = await sqlPool`
      SELECT
        ref, first_name, last_name, birthdate, street, zip, city, email,
        pack_name, approved_limit, purpose, billing, nfc, iban, billing_method,
        consent_agb, consent_schufa, consent_contract,
        ip, user_agent, submitted_at, completed_at, created_at, updated_at, status
      FROM fiaon_applications
      WHERE consent_contract = TRUE
      ORDER BY created_at ASC
    `;

    if (apps.length === 0) {
      return res.status(404).json({ error: "Keine Vertragsakzeptierungen gefunden" });
    }

    const dateTag = new Date().toISOString().slice(0, 10);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="FIAON_Vertraege_${dateTag}.zip"`);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", (err: Error) => {
      console.error("[FIAON-CONTRACTS-ZIP] Archiver error:", err);
      try { res.end(); } catch { }
    });
    archive.pipe(res);

    // 1) CSV audit list of all acceptances (BOM for Excel, semicolon-separated)
    const csvHeader = [
      "Vertragsnummer", "Vorname", "Nachname", "E-Mail", "Paket", "Limit (EUR)",
      "AGB akzeptiert", "SCHUFA-Einwilligung", "Vertrag akzeptiert",
      "IP-Adresse", "Ger\u00e4t/Browser", "Antrag erstellt", "Abgeschlossen am", "Status",
    ].join(";");
    const csvRows = apps.map((a: any) => [
      csvCell(a.ref), csvCell(a.first_name), csvCell(a.last_name), csvCell(a.email),
      csvCell(a.pack_name), csvCell(a.approved_limit ?? ""),
      a.consent_agb ? "Ja" : "Nein", a.consent_schufa ? "Ja" : "Nein", a.consent_contract ? "Ja" : "Nein",
      csvCell(a.ip), csvCell(a.user_agent),
      a.created_at ? new Date(a.created_at).toLocaleString("de-DE") : "",
      (a.completed_at || a.submitted_at) ? new Date(a.completed_at || a.submitted_at).toLocaleString("de-DE") : "",
      csvCell(a.status),
    ].join(";"));
    const csv = "\uFEFF" + csvHeader + "\r\n" + csvRows.join("\r\n");
    archive.append(csv, { name: "Vertragsakzeptierungen_Uebersicht.csv" });

    // 2) One contract PDF per customer
    for (const a of apps) {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const safeName = [a.last_name, a.first_name].filter(Boolean).join("_").replace(/[^a-zA-Z0-9äöüÄÖÜß_-]/g, "") || "Kunde";
      archive.append(doc as any, { name: `Vertraege/FIAON_Vertrag_${a.ref}_${safeName}.pdf` });
      renderContractPdf(doc, a);
      doc.end();
    }

    await archive.finalize();
    console.log(`[FIAON-CONTRACTS-ZIP] ${apps.length} Verträge als ZIP exportiert`);
  } catch (err) {
    console.error("[FIAON-CONTRACTS-ZIP]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Fehler beim Erstellen des ZIP-Archivs" });
    }
  }
});

// Run migration endpoint (temporary for setup)
router.post("/run-migration", async (req, res) => {
  try {
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: "DATABASE_URL not set" });
    }
    
    const sql = postgres(process.env.DATABASE_URL, { ssl: 'require' });
    
    // Check if columns already exist
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'fiaon_applications' 
      AND table_schema = 'public'
      AND column_name = 'company_name'
    `;
    
    if (columns.length > 0) {
      await sql.end();
      return res.json({ ok: true, message: "Migration already run - business fields exist" });
    }
    
    // Run migration
    await sql`
      ALTER TABLE fiaon_applications 
      ADD COLUMN IF NOT EXISTS company_name VARCHAR,
      ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
      ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
      ADD COLUMN IF NOT EXISTS established_year VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_name VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_email VARCHAR,
      ADD COLUMN IF NOT EXISTS contact_phone VARCHAR,
      ADD COLUMN IF NOT EXISTS business_type VARCHAR,
      ADD COLUMN IF NOT EXISTS industry VARCHAR,
      ADD COLUMN IF NOT EXISTS annual_revenue INTEGER,
      ADD COLUMN IF NOT EXISTS employees INTEGER,
      ADD COLUMN IF NOT EXISTS monthly_expenses INTEGER,
      ADD COLUMN IF NOT EXISTS billing_email VARCHAR;
    `;
    
    // Create index
    await sql`
      CREATE INDEX IF NOT EXISTS fiaon_app_type_idx ON fiaon_applications(type);
    `;
    
    await sql.end();
    res.json({ ok: true, message: "Migration completed successfully" });
  } catch (err) {
    console.error("[FIAON-MIGRATION]", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ============================================================
// ADMIN ENDPOINTS — Lean list (no bytea PDFs) for Dashboard UI
// ============================================================

// Admin: Antragsliste, neueste zuerst, ohne die Anhang-Spalten.
// Die Spaltenliste wird zur Laufzeit aus dem Katalog gelesen (lib/fiaon-
// antrag-spalten.ts) — dadurch bleibt sie auch dann vollstaendig, wenn eine
// Wanderung (KYC- oder Stripe-Felder) in dieser Umgebung noch nicht gelaufen
// ist, und die schweren bytea-Spalten fahren trotzdem nie mit.
router.get("/admin/applications", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    // merged_into IS NULL: soft-gelöschte Duplikate (Bereinigung) ausblenden — Datenbestand bleibt in der DB rekonstruierbar
    // Die drei Anhang-Spalten bleiben, wo sie sind. Diese Liste holte sie
    // vorher aus Frankfurt mit — 323 MB ueber 2.656 Zeilen — nur um sie
    // gleich darauf Zeile fuer Zeile wieder wegzuwerfen. Das waren die
    // 26,5 Sekunden, die jeder Aufruf gekostet hat. Die has_*-Kennzeichen
    // kommen jetzt aus der Abfrage selbst; die Antwort bleibt dieselbe.
    const spalten = await antragsSpaltenOhneAnhaenge();
    const data = (await sqlPool.unsafe(`
      SELECT ${spalten}
      FROM fiaon_applications
      WHERE merged_into IS NULL
      ORDER BY created_at DESC NULLS LAST, id DESC
    `)) as any[];

    // Detect duplicate groups by email (case-insensitive, trimmed)
    const emailMap = new Map<string, any[]>();
    for (const app of data) {
      const email = (app.email || '').trim().toLowerCase();
      if (!email) continue;
      if (!emailMap.has(email)) emailMap.set(email, []);
      emailMap.get(email)!.push(app);
    }
    const duplicateGroups: { email: string; count: number; refs: string[] }[] = [];
    emailMap.forEach((apps, email) => {
      if (apps.length > 1) {
        duplicateGroups.push({ email, count: apps.length, refs: apps.map((a: any) => a.ref) });
      }
    });

    // Zentrale „ein System": un-konvertierte Leads (noch KEIN Antrag) als
    // normalisierte Datensätze mitliefern, damit /admin/database den vollen
    // Lebenszyklus Lead → Antrag → bezahlt/abgelaufen in EINER Ansicht zeigt.
    // Konvertierte Leads (converted_order_id gesetzt) sind bereits als Antrag da.
    let leads: any[] = [];
    try {
      const leadRows = await sqlPool`
        SELECT l.id, l.vorname, l.nachname, l.email, l.telefon, l.status, l.quelle,
               l.assigned_agent_id, l.erstellt_am, l.updated_at, ag.name AS assigned_agent_name
        FROM fiaon_leads l
        LEFT JOIN fiaon_agents ag ON ag.id = l.assigned_agent_id
        WHERE l.converted_order_id IS NULL AND COALESCE(l.status,'') <> 'konvertiert'
        ORDER BY l.erstellt_am DESC NULLS LAST, l.id DESC
        LIMIT 5000
      `;
      leads = leadRows.map((l: any) => ({
        record_type: "lead",
        lead_id: l.id,
        ref: `LEAD-${l.id}`,
        first_name: l.vorname,
        last_name: l.nachname,
        email: l.email,
        phone: l.telefon,
        pack_name: null,
        status: "lead",
        payment_status: "lead",
        lead_status: l.status || "neu",
        quelle: l.quelle,
        assigned_agent_id: l.assigned_agent_id,
        assigned_agent_name: l.assigned_agent_name,
        created_at: l.erstellt_am,
        updated_at: l.updated_at,
      }));
    } catch { /* Lead-Tabelle ggf. nicht vorhanden — Zentrale zeigt dann nur Anträge */ }

    console.log(`[FIAON-ADMIN-APPS] returning ${data.length} applications, ${leads.length} offene Leads, ${duplicateGroups.length} duplicate groups`);
    res.json({ ok: true, data, count: data.length, duplicateGroups, leads });
  } catch (err: any) {
    console.error("[FIAON-ADMIN-APPS] ERROR:", err?.message || err);
    res.status(500).json({
      ok: false,
      error: "Failed to fetch applications",
      detail: String(err?.message || err),
    });
  }
});

// Admin: merge duplicate applications into a single record.
// Keeps the "primary" ref (newest with most data), deletes the others.
// Requires explicit confirmation from admin (reviewed = true).
router.post("/admin/applications/merge", async (req, res) => {
  try {
    const { primaryRef, duplicateRefs, reviewed } = req.body;

    if (!reviewed) {
      return res.status(400).json({ ok: false, error: "Zusammenführung muss von einem MA geprüft werden (reviewed=true)" });
    }
    if (!primaryRef || !Array.isArray(duplicateRefs) || duplicateRefs.length === 0) {
      return res.status(400).json({ ok: false, error: "primaryRef und duplicateRefs[] erforderlich" });
    }

    // Soft-Merge (KEIN Hard-Delete): Verlierer bleiben als merged_into-Zeile erhalten,
    // Historie + Lead-Verknüpfungen wandern zum Gewinner, alles umkehrbar (Batch).
    const actor = String((req as any).fiaonAdmin?.name || (req as any).adminName || "Admin");
    const result = await mergeApplications(primaryRef, duplicateRefs, actor);
    if (!result.ok) {
      return res.status(404).json({ ok: false, error: result.error || "Merge fehlgeschlagen" });
    }
    res.json({
      ok: true,
      mergedInto: result.primaryRef,
      merged: result.merged,           // soft-merged (NICHT gelöscht)
      batch: result.batch,             // für Undo
      fieldsUpdated: result.fieldsFilled,
      movedContactLogs: result.movedContactLogs,
      movedLeadLinks: result.movedLeadLinks,
    });
  } catch (err: any) {
    console.error("[FIAON-MERGE] ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Merge fehlgeschlagen", detail: String(err?.message || err) });
  }
});

// Merge rückgängig machen (Undo per Batch aus fiaon_merge_log).
router.post("/admin/applications/merge/undo", async (req, res) => {
  try {
    const batch = String(req.body?.batch || "").trim();
    if (!batch) return res.status(400).json({ ok: false, error: "batch erforderlich" });
    const actor = String((req as any).fiaonAdmin?.name || (req as any).adminName || "Admin");
    const result = await undoMergeApplications(batch, actor);
    if (!result.ok) return res.status(404).json({ ok: false, error: result.error });
    res.json({ ok: true, restored: result.restored });
  } catch (err: any) {
    console.error("[FIAON-MERGE] UNDO ERROR:", err?.message || err);
    res.status(500).json({ ok: false, error: "Undo fehlgeschlagen", detail: String(err?.message || err) });
  }
});

// ── Duplikat-Altbestand: sichere Massen-Bereinigung (Soft-Delete, KEIN Hard-Delete) ──
// Pro E-Mail-Gruppe bleibt der vollständigste/neueste Datensatz; der Rest wird per
// merged_into = <keeper.ref> markiert und verschwindet aus allen Listen.
// Datensätze mit aktiver Zahlung (paid/pending_payment/claimed_paid) werden NIE wegmarkiert.

function duplicateScore(a: any): number {
  let s = 0;
  if (a.payment_status === "paid") s += 4000;
  else if (a.payment_status === "claimed_paid") s += 3000;
  else if (a.payment_status === "pending_payment") s += 2000;
  if (a.payment_reference) s += 500;
  if (a.consent_contract) s += 200;
  if (a.utm) s += 100; // enthält Passwort → Konto angelegt
  for (const v of Object.values(a)) { if (v !== null && v !== undefined && v !== "") s += 1; }
  return s;
}

const PROTECTED_PAYMENT_STATUS = new Set(["paid", "pending_payment", "claimed_paid"]);

router.get("/admin/duplicates/preview", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT id, ref, email, first_name, last_name, payment_status, payment_reference,
             consent_contract, utm, current_step, status, created_at, updated_at
      FROM fiaon_applications
      WHERE merged_into IS NULL AND email IS NOT NULL AND email != ''
    `;
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const key = String(r.email).trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    let groupCount = 0, mergeable = 0;
    const preview: any[] = [];
    groups.forEach((apps, email) => {
      if (apps.length < 2) return;
      groupCount++;
      const sorted = [...apps].sort((x, y) => duplicateScore(y) - duplicateScore(x) || new Date(y.updated_at || y.created_at).getTime() - new Date(x.updated_at || x.created_at).getTime());
      const keeper = sorted[0];
      const losers = sorted.slice(1).filter((l) => !PROTECTED_PAYMENT_STATUS.has(l.payment_status));
      mergeable += losers.length;
      if (preview.length < 20) preview.push({ email, keep: keeper.ref, merge: losers.map((l) => l.ref) });
    });
    res.json({ ok: true, groups: groupCount, mergeable, preview });
  } catch (err) {
    console.error("[FIAON-DEDUP] preview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.post("/admin/duplicates/cleanup-all", async (req, res) => {
  try {
    if (!req.body?.confirmed) {
      return res.status(400).json({ ok: false, error: "Bestätigung erforderlich (confirmed=true)" });
    }
    await ensurePaymentColumns();
    const rows = await sqlPool`
      SELECT id, ref, email, payment_status, payment_reference, consent_contract, utm,
             current_step, status, created_at, updated_at
      FROM fiaon_applications
      WHERE merged_into IS NULL AND email IS NOT NULL AND email != ''
    `;
    const groups = new Map<string, any[]>();
    for (const r of rows) {
      const key = String(r.email).trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(r);
    }
    let groupsProcessed = 0, merged = 0, skippedProtected = 0;
    for (const apps of Array.from(groups.values())) {
      if (apps.length < 2) continue;
      const sorted = [...apps].sort((x, y) => duplicateScore(y) - duplicateScore(x) || new Date(y.updated_at || y.created_at).getTime() - new Date(x.updated_at || x.created_at).getTime());
      const keeper = sorted[0];
      const loserRefs: string[] = [];
      for (const l of sorted.slice(1)) {
        if (PROTECTED_PAYMENT_STATUS.has(l.payment_status)) { skippedProtected++; continue; }
        loserRefs.push(l.ref);
      }
      if (loserRefs.length === 0) continue;
      await sqlPool`
        UPDATE fiaon_applications
        SET merged_into = ${keeper.ref}, updated_at = NOW()
        WHERE ref = ANY(${loserRefs}) AND merged_into IS NULL
      `;
      groupsProcessed++;
      merged += loserRefs.length;
    }
    console.log(`[FIAON-DEDUP] Bereinigung: ${groupsProcessed} Gruppen, ${merged} Einträge als merged markiert, ${skippedProtected} geschützt übersprungen`);
    res.json({ ok: true, groupsProcessed, merged, skippedProtected });
  } catch (err) {
    console.error("[FIAON-DEDUP] cleanup:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// Admin: stream a KYC document PDF inline
router.get("/admin/applications/:ref/document/:type", async (req, res) => {
  try {
    const { ref, type } = req.params;
    const column =
      type === "bank_statement" ? "bank_statement_pdf" :
      type === "id_card" ? "id_card_pdf" :
      type === "schufa" ? "schufa_pdf" : null;

    if (!column) {
      return res.status(400).json({ error: "Invalid document type" });
    }

    const rows = await sqlPool`
      SELECT ${sqlPool.unsafe(column)} AS doc
      FROM fiaon_applications
      WHERE ref = ${ref}
      LIMIT 1
    `;
    if (rows.length === 0 || !rows[0].doc) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${ref}_${type}.pdf"`);
    res.send(rows[0].doc);
  } catch (err) {
    console.error("[FIAON-ADMIN-DOC]", err);
    res.status(500).json({ error: "Failed to fetch document" });
  }
});

// ── „Passwort vergessen" (Notfall 29.07.2026) ────────────────────────────────
// Dieser Weg war für praktisch alle zahlenden Kunden ebenfalls versperrt:
//   1. `AND status = 'completed'` — bezahlte Konten stehen aber auf
//      'payment_completed' bzw. 'documents_submitted' (siehe LOGIN_ACCESS_STATUSES).
//      Gemessen: 263 von 268 bezahlten Kunden fielen aus diesem Filter heraus und
//      bekamen „Kein Konto mit dieser E-Mail gefunden" — der Rettungsweg für die
//      ausgesperrten Kunden war also selbst zu.
//   2. Nur `email` wurde verglichen — Geschäftskunden hinterlegen `billing_email`.
//   3. `ORDER BY created_at DESC LIMIT 1` — dieselbe „neueste Zeile"-Falle wie im
//      Login: geprüft wurde eine Bonitäts-Bestellzeile ohne Namen/Geburtsdatum.
// Die Identitätsprüfung selbst (Vorname + Nachname + E-Mail + Geburtsdatum)
// bleibt unverändert streng — nur der Status-Filter ist weg.

/** Eine Meldung für „E-Mail unbekannt" UND „Angaben passen nicht" — keine Auskunft
 *  darüber, ob eine E-Mail-Adresse bei uns existiert. */
const VERIFY_NEUTRAL_MESSAGE =
  "Die Angaben stimmen nicht mit einem Konto überein. Bitte prüfe Vorname, Nachname, E-Mail-Adresse und Geburtsdatum — genau so, wie du sie im Antrag angegeben hast.";

// POST /api/fiaon/verify-identity — prüft Name + Geb. + Email, gibt Token zurück
router.post("/verify-identity", async (req, res) => {
  const emailForLog = String(req.body?.email ?? "");
  try {
    const { firstName, lastName, birthDay, birthMonth, birthYear, email } = req.body;
    if (!firstName || !lastName || !email || !birthDay || !birthMonth || !birthYear) {
      return res.status(400).json({ ok: false, error: "Bitte alle Felder ausfüllen." });
    }

    await ensurePaymentColumns();
    const trimEmail = String(email).trim().toLowerCase();
    const birthdate = `${birthYear}-${String(birthMonth).padStart(2, "0")}-${String(birthDay).padStart(2, "0")}`;

    // Dieselbe Kontoauflösung wie im Login: die ganze Familie der E-Mail.
    const family = await loadLoginFamily(trimEmail);
    const wantFirst = String(firstName).trim().toLowerCase();
    const wantLast = String(lastName).trim().toLowerCase();

    const candidates = family.filter((r: any) => {
      const first = String(r.first_name ?? "").trim().toLowerCase();
      const last = String(r.last_name ?? "").trim().toLowerCase();
      return first === wantFirst && last === wantLast && birthdateKey(r.birthdate) === birthdate;
    });

    if (candidates.length === 0) {
      logLoginAttempt({
        email: trimEmail,
        code: "RESET-01",
        reason: family.length === 0 ? "Reset: kein Datensatz zur E-Mail" : "Reset: Name/Geburtsdatum passen nicht",
        ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "",
        userAgent: String(req.headers["user-agent"] || ""),
      });
      return res.status(401).json({ ok: false, error: VERIFY_NEUTRAL_MESSAGE });
    }

    // Das Passwort gehört an das KONTO, nicht an eine Zusatzbestellung oder eine
    // zusammengeführte Dublette.
    const account = pickAccountRow(candidates)!;
    const token = randomBytes(32).toString("hex");
    verifyTokens.set(token, { ref: account.ref, expiresAt: Date.now() + 15 * 60 * 1000 });

    logLoginAttempt({
      email: trimEmail,
      code: "RESET-OK",
      reason: "Identität bestätigt, Passwort darf gesetzt werden",
      ref: account.ref,
      ip: (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "",
      userAgent: String(req.headers["user-agent"] || ""),
    });
    return res.json({ ok: true, token });
  } catch (err) {
    const incident = randomBytes(4).toString("hex").toUpperCase();
    console.error(`[FIAON-VERIFY-IDENTITY] RESET-05-${incident}`, err);
    logLoginAttempt({ email: emailForLog, code: `RESET-05-${incident}`, reason: "technischer Fehler beim Identitätsabgleich" });
    // Ein technischer Fehler darf nicht wie „falsche Angaben" aussehen.
    return res.status(503).json({
      ok: false,
      code: `RESET-05-${incident}`,
      error: "Technisches Problem — bitte in einem Moment erneut versuchen.",
      hint: `Bleibt das Problem, nenne dem Support diesen Fehlercode: RESET-05-${incident}`,
    });
  }
});

// POST /api/fiaon/reset-password-direct — setzt Passwort nach Identity-Verify
router.post("/reset-password-direct", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ ok: false, error: "Ungültige Anfrage oder Passwort zu kurz (mind. 8 Zeichen)." });
    }

    const entry = verifyTokens.get(token);
    if (!entry || entry.expiresAt < Date.now()) {
      verifyTokens.delete(token);
      return res.status(401).json({ ok: false, error: "Sitzung abgelaufen. Bitte erneut verifizieren." });
    }

    const { ref } = entry;
    // utm wird ERGÄNZT, nicht ersetzt — das Ersetzen war Teil der Ursache
    // (es löschte die Rückfall-Kopie und alle übrigen utm-Schlüssel).
    const updated = await sqlPool`
      UPDATE fiaon_applications
      SET password = ${newPassword},
          utm = COALESCE(utm, '{}'::jsonb) || ${JSON.stringify({ password: newPassword })}::jsonb,
          updated_at = NOW()
      WHERE ref = ${ref}
      RETURNING ref
    `;
    if (updated.length === 0) {
      return res.status(410).json({ ok: false, error: "Konto nicht mehr auffindbar. Bitte kontaktiere den Support." });
    }

    verifyTokens.delete(token);
    console.log("[FIAON-RESET-DIRECT] Passwort gesetzt für", ref);

    // ══════════════════════════════════════════════════════════════════════
    // SAG IHM JETZT, OB DIE TÜR OFFEN IST (27.08.2026)
    //
    // Daniel: „Man kann sich aktuell nicht einloggen."
    //
    // GEMESSEN im Anmeldeprotokoll über 30 Tage: 81 Menschen haben ein
    // Passwort gesetzt, 16 davon wurden binnen zwei Stunden danach
    // abgewiesen — jeder Fünfte. Der Ablauf sagte „Identität bestätigt,
    // setz dein Passwort", und Sekunden später „Deine Zahlung ist noch
    // nicht eingegangen". Aus Kundensicht ist das ein kaputtes Portal,
    // und genau so wird es gemeldet.
    //
    // Das Passwort wird trotzdem gesetzt — es ist sein Konto, und er wird
    // es brauchen. Aber er erfährt SOFORT, woran er ist, statt gegen eine
    // Tür zu laufen. (Nachtrag 27.08. abends: Das Zahlungs-Tor selbst ist
    // seither weg — abgewiesen wird nur noch die Hand-Sperre, s. u.)
    // ══════════════════════════════════════════════════════════════════════
    // ── SEIT 27.08.2026 SPERRT NUR NOCH DIE HAND-SPERRE ───────────────────
    // Vorher wies dieser Weg nach dem Zahlungsstatus ab (16 von 81 Resets
    // endeten so — „Passwort gesetzt, aber Zahlung offen"). Entscheidung des
    // Inhabers: Wer sein Passwort setzt, kommt hinein; die einzige Ausnahme
    // ist account_status='suspended' (vom Mitarbeiter gesetzt, mit Grund).
    const [konto] = (await sqlPool`
      SELECT status, payment_status, payment_reference, account_status
        FROM fiaon_applications WHERE ref = ${ref} LIMIT 1`) as any[];
    const gesperrt = konto?.account_status === "suspended";

    if (!gesperrt) return res.json({ ok: true, zugangOffen: true });

    return res.json({
      ok: true,
      zugangOffen: false,
      // Bewusst dieselben Worte wie am Zugangstor — zwei Formulierungen für
      // dieselbe Lage sind der Anfang jeder Verwirrung.
      hinweis: "Dein Passwort ist gesetzt, aber dein Konto ist derzeit gesperrt.",
      erklaerung: "Bitte kontaktiere den Support — wir klären das mit dir persönlich.",
      referenz: konto?.payment_reference || null,
      weiter: null,
    });
  } catch (err) {
    const incident = randomBytes(4).toString("hex").toUpperCase();
    console.error(`[FIAON-RESET-DIRECT] RESET-05-${incident}`, err);
    return res.status(503).json({
      ok: false,
      code: `RESET-05-${incident}`,
      error: "Technisches Problem — dein Passwort wurde NICHT geändert. Bitte in einem Moment erneut versuchen.",
      hint: `Bleibt das Problem, nenne dem Support diesen Fehlercode: RESET-05-${incident}`,
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEIL B — ARBEITSLISTE: BEZAHLTE KUNDEN, DIE NICHT INS KONTO KOMMEN
//
// NUR LESEND. Kein UPDATE, keine Mail, kein Webhook. Die Liste benutzt genau
// dieselbe Kontoauflösung wie der Login (loadLoginFamily/pickAccountRow) —
// sonst würde sie etwas anderes behaupten als das, was der Kunde erlebt.
//
// `behoben: true` heißt: Dieser Kunde war durch den „neueste Zeile"-Bug
// ausgesperrt, sein Passwort liegt aber in einer anderen Zeile seiner Familie —
// er kann sich nach diesem Fix sofort wieder anmelden, ohne dass jemand etwas
// tun muss. `behoben: false` heißt: Es gibt nirgends ein Passwort — dieser
// Kunde braucht den Weg über „Passwort vergessen".
// ═══════════════════════════════════════════════════════════════════════════

/** Normalisierter Kontakt-Schlüssel einer Zeile (wie der Login vergleicht). */
function loginKeyOf(row: any): string | null {
  const raw = row?.email || row?.contact_email || row?.billing_email || "";
  const key = String(raw).trim().toLowerCase();
  return key || null;
}

router.get("/admin/login-lockouts", async (_req, res) => {
  try {
    await ensurePaymentColumns();
    // EINE schlanke Abfrage (ohne die schweren bytea-Spalten), Gruppierung in JS.
    // Ein `LOWER(TRIM(...)) = ANY(...)` über drei Spalten kann keinen Index
    // nutzen und läuft auf dem echten Bestand ins Zeitlimit.
    const rows = await sqlPool`
      SELECT id, ref, type, status, account_status, payment_status, payment_reference,
             merged_into, email, contact_email, billing_email,
             first_name, last_name, contact_name, pack_key, pack_name,
             password, utm::text AS utm_string, created_at
      FROM fiaon_applications
      WHERE gdpr_deleted_at IS NULL
      ORDER BY created_at DESC NULLS LAST, id DESC
    `;

    // Nur Familien betrachten, in denen überhaupt bezahlt wurde.
    const paidKeys = new Set<string>();
    for (const row of rows) {
      if (row.payment_status !== "paid") continue;
      const key = loginKeyOf(row);
      if (key) paidKeys.add(key);
    }
    if (paidKeys.size === 0) return res.json({ ok: true, count: 0, summary: {}, data: [] });

    const families = new Map<string, any[]>();
    for (const row of rows) {
      const key = loginKeyOf(row);
      if (!key || !paidKeys.has(key)) continue;
      if (!families.has(key)) families.set(key, []);
      families.get(key)!.push(row);
    }

    const data: any[] = [];
    families.forEach((family, key) => {
      const account = pickAccountRow(family);
      if (!account) return;
      const familyHasPassword = family.some((r) => storedPasswordOf(r) !== null);
      const accountHasPassword = storedPasswordOf(account) !== null;
      // Was der ALTE Login gelesen hätte: die schlicht neueste Zeile.
      const newest = family[0];
      const oldWouldFail = storedPasswordOf(newest) === null;
      const suspended = account.account_status === "suspended";

      let reason: string | null = null;
      let behoben = false;
      if (!familyHasPassword) {
        reason = "kein Passwort hinterlegt — Kunde muss es über „Passwort vergessen\" neu setzen";
      } else if (suspended) {
        reason = "Konto gesperrt (Sperr-Knopf in der Akte) — Entscheidung eines Mitarbeiters";
      // Seit 27.08.2026 sperrt der Zahlungsstatus den Zugang nicht mehr —
      // der frühere Zweig „Zugang am Konto nicht frei" entfällt deshalb.
      } else if (oldWouldFail) {
        reason = accountHasPassword
          ? "war ausgesperrt: Login las die neueste Zeile (Bonitäts-Bestellung/Dublette) statt des Kontos — jetzt behoben"
          : "war ausgesperrt: Passwort liegt in einer anderen Zeile der Familie — jetzt behoben";
        behoben = true;
      }
      if (!reason) return; // Kunde kommt normal rein — nicht in die Arbeitsliste.

      data.push({
        ref: account.ref,
        name: [account.first_name, account.last_name].filter(Boolean).join(" ") || account.contact_name || null,
        email: account.email || account.contact_email || account.billing_email || key,
        packName: account.pack_name,
        status: account.status,
        accountStatus: account.account_status,
        paymentStatus: account.payment_status,
        paymentReference: account.payment_reference,
        mergedInto: account.merged_into,
        familyRefs: family.map((r) => r.ref),
        grund: reason,
        behoben,
      });
    });

    data.sort((a, b) => Number(a.behoben) - Number(b.behoben) || String(a.grund).localeCompare(String(b.grund)));
    const summary = {
      gesamt: data.length,
      durchFixBehoben: data.filter((d) => d.behoben).length,
      brauchenPasswortReset: data.filter((d) => !d.behoben && d.grund.startsWith("kein Passwort")).length,
      gesperrt: data.filter((d) => d.grund.startsWith("Konto gesperrt")).length,
      zugangNichtFrei: data.filter((d) => d.grund.startsWith("Zugang am Konto")).length,
    };
    console.log(`[FIAON-LOGIN-LOCKOUTS] ${summary.gesamt} betroffen (${summary.durchFixBehoben} durch Fix behoben, ${summary.brauchenPasswortReset} brauchen Reset)`);
    res.json({ ok: true, count: data.length, summary, data });
  } catch (err) {
    console.error("[FIAON-LOGIN-LOCKOUTS]", err);
    res.status(500).json({ ok: false, error: "Arbeitsliste konnte nicht erstellt werden" });
  }
});

/** Protokoll der Login-Versuche (maskiert). Damit ein Aussperren sichtbar wird. */
router.get("/admin/login-log", async (req, res) => {
  try {
    await ensureLoginLog();
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 1000);
    const rows = await sqlPool`
      SELECT at, email_masked, ref, code, reason, ip
      FROM fiaon_login_log ORDER BY at DESC LIMIT ${limit}
    `;
    const counts = await sqlPool`
      SELECT code, COUNT(*)::int AS n
      FROM fiaon_login_log WHERE at > NOW() - INTERVAL '24 hours'
      GROUP BY code ORDER BY n DESC
    `;
    res.json({ ok: true, data: rows, letzte24h: counts });
  } catch (err) {
    console.error("[FIAON-LOGIN-LOG]", err);
    res.status(500).json({ ok: false, error: "Protokoll konnte nicht gelesen werden" });
  }
});

// ═══════════════════════════════════════════════════════════════════
// STRIPE SYNC: Full revenue & transaction sync
// ═══════════════════════════════════════════════════════════════════


export default router;
