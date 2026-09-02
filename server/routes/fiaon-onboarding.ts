// ═══════════════════════════════════════════════════════════════════════════
// FIAON Onboarding-Gate (Prompt 1) + Digitaler Agentenvertrag & Provisions-
// Abrechnungen (Prompt 2).
//
// Prompt 1 — Pflicht-Gate beim Login:
//   A) Zustimmung (Datenschutz/Vertraulichkeit, Verhalten/Compliance, Nutzung)
//      — versioniert, protokolliert (Agent-ID, Doc-Version, Berlin-Zeit, IP).
//   B) Vertrags-Unterzeichnung (Prompt 2). Erst wenn BEIDES erledigt ist,
//      erhält der Agent Zugriff auf Kundendaten (Gate: customerDataGate).
//   C) Admin-Nachweis (Zustimmungsprotokoll + Vertrag als PDF).
//
// Prompt 2 — Vertrag (EN) + Abrechnungen:
//   - Admin-konfigurierbare, versionierte Vertragsvorlage (Entwurf/Aktiv).
//   - Pro Agent gesetzte Vertragsvariablen speisen die Platzhalter [[…]].
//   - Digitale Signatur (Zeichnung ODER getippter Name), eingebettet ins PDF
//     inkl. Zeitstempel (Berlin), IP, Version, Dokument-Hash.
//   - PDF-Erzeugung serverseitig via Playwright/Chromium im FIAON-CI.
//   - Provisions-Abrechnung (Commission Statement / Gutschrift) automatisch bei
//     jeder bestätigten Auszahlung — Zahlen NUR aus der Commission-Engine.
//
// STRIKT: nichts hart löschen (Versionierung/Soft-Delete), Berlin-Zeit, eine
// Wahrheit (Commission-Engine), keine Heredocs.
// ═══════════════════════════════════════════════════════════════════════════

import { Router, type Request, type Response, type NextFunction } from "express";
import { absenderBlock, firmierung, fussZeile } from "../lib/fiaon-firmierung";
import { sqlPool } from "../lib/db-pool";
import { requireAgent, logAgentEvent, getSettings, type AgentRequest } from "./fiaon-agent";
import { sendMakeWebhook } from "../make-webhook";
import { formatBerlin } from "../lib/fiaon-time";
import { renderDocumentPdf, wrapFiaonDocument, docHash, escapeHtml } from "../lib/fiaon-html-pdf";
import { abrechnungPdf, type AbrechnungDaten } from "../lib/fiaon-abrechnung-pdf";
import { DEFAULT_CONTRACT_HTML, DEFAULT_CONTRACT_VERSION, ONBOARDING_DOCS, type OnboardingDoc } from "./fiaon-onboarding-content";

const router = Router();

export { ONBOARDING_DOCS };

// ── Helfer ───────────────────────────────────────────────────────────────────
function clientIp(req: Request): string {
  return (
    ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() ||
    req.socket?.remoteAddress ||
    ""
  );
}

function berlinYear(): string {
  return new Intl.DateTimeFormat("en", { timeZone: "Europe/Berlin", year: "numeric" }).format(new Date());
}

function fmtEurCents(c: number): string {
  return `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

// ── Schema (idempotent) ──────────────────────────────────────────────────────
let ensured = false;
export async function ensureOnboardingTables(): Promise<void> {
  if (ensured) return;
  // Zustimmungs-Protokoll (Prompt 1 A) — versioniert & auditiert
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_consents (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      doc_key VARCHAR NOT NULL,
      doc_version INTEGER NOT NULL,
      accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip VARCHAR,
      user_agent TEXT,
      UNIQUE (agent_id, doc_key, doc_version)
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_agent_consents_agent_idx ON fiaon_agent_consents(agent_id)`;

  // Vertragsvorlagen (Prompt 2 A) — versioniert, Entwurf/Aktiv/Archiviert
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_contract_templates (
      id SERIAL PRIMARY KEY,
      version INTEGER NOT NULL UNIQUE,
      title VARCHAR NOT NULL,
      body_html TEXT NOT NULL,
      status VARCHAR NOT NULL DEFAULT 'draft',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      activated_at TIMESTAMPTZ
    )
  `;

  // Signierte Verträge (Prompt 2 C/D) — Snapshot + Signatur + Audit + PDF
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_agent_contracts (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      template_version INTEGER NOT NULL,
      variables_json TEXT NOT NULL,
      rendered_html TEXT NOT NULL,
      signature_png TEXT,
      signature_name VARCHAR NOT NULL,
      signature_mode VARCHAR NOT NULL,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ip VARCHAR,
      user_agent TEXT,
      doc_hash VARCHAR NOT NULL,
      pdf_base64 TEXT,
      status VARCHAR NOT NULL DEFAULT 'signed',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_agent_contracts_agent_idx ON fiaon_agent_contracts(agent_id, created_at)`;

  // Provisions-Abrechnungen (Prompt 2 E) — genau eine je Auszahlung
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_commission_statements (
      id SERIAL PRIMARY KEY,
      agent_id INTEGER NOT NULL,
      payout_id INTEGER NOT NULL UNIQUE,
      statement_no VARCHAR NOT NULL UNIQUE,
      period_start TIMESTAMPTZ,
      period_end TIMESTAMPTZ,
      issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gross_cents INTEGER NOT NULL,
      net_cents INTEGER NOT NULL,
      variables_json TEXT NOT NULL,
      lines_json TEXT NOT NULL,
      doc_hash VARCHAR NOT NULL,
      pdf_base64 TEXT
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_commission_statements_agent_idx ON fiaon_commission_statements(agent_id, issued_at)`;

  // Vertragsvariablen am Agent (Prompt 2 A)
  await sqlPool.unsafe(`
    ALTER TABLE fiaon_agents
      ADD COLUMN IF NOT EXISTS partner_type VARCHAR NOT NULL DEFAULT 'private',
      ADD COLUMN IF NOT EXISTS legal_name VARCHAR,
      ADD COLUMN IF NOT EXISTS address_line VARCHAR,
      ADD COLUMN IF NOT EXISTS postal_code VARCHAR,
      ADD COLUMN IF NOT EXISTS city VARCHAR,
      ADD COLUMN IF NOT EXISTS country VARCHAR,
      ADD COLUMN IF NOT EXISTS birth_date DATE,
      ADD COLUMN IF NOT EXISTS founding_date DATE,
      ADD COLUMN IF NOT EXISTS tax_id VARCHAR,
      ADD COLUMN IF NOT EXISTS vat_id VARCHAR,
      ADD COLUMN IF NOT EXISTS company_name VARCHAR,
      ADD COLUMN IF NOT EXISTS legal_form VARCHAR,
      ADD COLUMN IF NOT EXISTS register_no VARCHAR,
      ADD COLUMN IF NOT EXISTS authorised_rep VARCHAR,
      ADD COLUMN IF NOT EXISTS contract_start_date DATE,
      ADD COLUMN IF NOT EXISTS payout_terms VARCHAR,
      ADD COLUMN IF NOT EXISTS notice_period VARCHAR,
      ADD COLUMN IF NOT EXISTS governing_law VARCHAR,
      ADD COLUMN IF NOT EXISTS jurisdiction VARCHAR,
      ADD COLUMN IF NOT EXISTS activity_description TEXT
  `);

  // Standardvorlage seeden bzw. auf die aktuelle Default-Version anheben.
  // Solange keine Vorlage mit Version >= DEFAULT_CONTRACT_VERSION existiert,
  // wird die neue Fassung als aktiv angelegt und die bisherige aktive
  // archiviert. Admin-eigene, höhere Versionen bleiben unberührt. Das erneute
  // Aktivieren erzwingt über computeOnboardingStatus die Neu-Unterschrift.
  const maxV = await sqlPool`SELECT COALESCE(MAX(version), 0)::int AS v FROM fiaon_contract_templates`;
  if (maxV[0].v < DEFAULT_CONTRACT_VERSION) {
    await sqlPool`UPDATE fiaon_contract_templates SET status = 'archived' WHERE status = 'active'`;
    await sqlPool`
      INSERT INTO fiaon_contract_templates (version, title, body_html, status, activated_at)
      VALUES (${DEFAULT_CONTRACT_VERSION}, ${"Self-Employed Commercial Agent Agreement"}, ${DEFAULT_CONTRACT_HTML}, 'active', NOW())
    `;
    console.log(`[FIAON-ONBOARDING] Standard-Vertragsvorlage v${DEFAULT_CONTRACT_VERSION} (aktiv) angelegt — bestehende Agenten müssen erneut unterschreiben`);
  }
  ensured = true;
  console.log("[FIAON-ONBOARDING] Onboarding-/Vertrags-Tabellen sichergestellt");
}

// ── Vertragsvariablen auflösen ───────────────────────────────────────────────
interface ContractVars {
  EFFECTIVE_DATE: string;
  START_DATE: string;
  AGENT_LEGAL_NAME: string;
  AGENT_TYPE: string;
  AGENT_ADDRESS: string;
  COMPANY_BLOCK: string;
  COMMISSION_RATE: string;
  PAYOUT_TERMS: string;
  NOTICE_PERIOD: string;
  GOVERNING_LAW: string;
  JURISDICTION: string;
  ACTIVITY: string;
  MIN_PAYOUT_THRESHOLD: string;
  MAX_RETAINED_BALANCE: string;
}

function fmtDateEN(v: string | Date | null | undefined, fallbackToday = false): string {
  const d = v ? new Date(v) : fallbackToday ? new Date() : null;
  if (!d || isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", day: "numeric", month: "long", year: "numeric" }).format(d);
}

/** Auszahlungs-Schwellen in EUR für die Vertrags-Platzhalter (z. B. „€50.00“). */
function fmtEurThreshold(cents: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR" }).format(cents / 100);
}

/**
 * Löst die Vertragsvariablen eines Agenten auf. Die Auszahlungs-Schwellen
 * (Minimum Payout Threshold / Maximum Retained Balance) kommen aus den globalen
 * Einstellungen — dieselben Werte, die auch die Selbst-Auszahlung und der
 * Admin-Hinweis nutzen (eine Wahrheit; Vertrag = System). `settingsArg`
 * optional, sonst werden die Einstellungen geladen.
 */
export async function resolveContractVars(
  a: any,
  settingsArg?: Record<string, string>,
): Promise<{ vars: ContractVars; missing: string[] }> {
  const settings = settingsArg || (await getSettings());
  const minCents = Number(settings.payout_min_cents);
  const maxCents = Number(settings.payout_max_retained_cents);
  const isCompany = String(a.partner_type || "private") === "company";
  const missing: string[] = [];

  const legalName = (isCompany ? a.company_name : a.legal_name) || a.name || "";
  if (isCompany && !a.company_name) missing.push("Firmenname");
  if (!isCompany && !a.legal_name && !a.name) missing.push("Rechtlicher Name");

  const addrParts = [a.address_line, [a.postal_code, a.city].filter(Boolean).join(" "), a.country].filter(Boolean);
  const address = addrParts.join(", ");
  if (!a.address_line || !a.city) missing.push("Anschrift");

  let companyBlock = "";
  if (isCompany) {
    const bits: string[] = [];
    if (a.legal_form) bits.push(`a ${a.legal_form}`); else missing.push("Rechtsform");
    if (a.register_no) bits.push(`registered under company/register number ${a.register_no}`); else missing.push("Register-Nr.");
    if (a.vat_id) bits.push(`VAT identification number ${a.vat_id}`);
    if (a.authorised_rep) bits.push(`duly represented by ${a.authorised_rep}`); else missing.push("Vertretungsberechtigter");
    if (bits.length) companyBlock = `, ${bits.join(", ")}`;
  }

  const rateBp = Number(a.commission_rate_bp);
  const rate = Number.isFinite(rateBp) && rateBp > 0 ? (rateBp / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "";
  if (!rate) missing.push("Provisionssatz");

  const vars: ContractVars = {
    EFFECTIVE_DATE: fmtDateEN(a.contract_start_date, true),
    START_DATE: fmtDateEN(a.contract_start_date, true),
    AGENT_LEGAL_NAME: legalName,
    AGENT_TYPE: isCompany ? "a company" : "an individual",
    AGENT_ADDRESS: address || "—",
    COMPANY_BLOCK: companyBlock,
    COMMISSION_RATE: rate || "—",
    PAYOUT_TERMS: a.payout_terms || "monthly in arrears, by bank transfer to the Agent's nominated account",
    NOTICE_PERIOD: a.notice_period || "one (1) month",
    GOVERNING_LAW: a.governing_law || "the laws of England and Wales",
    JURISDICTION: a.jurisdiction || "London, England",
    ACTIVITY: a.activity_description || "promotion and solicitation of orders for the FIAON Products",
    MIN_PAYOUT_THRESHOLD: Number.isFinite(minCents) ? fmtEurThreshold(minCents) : "EUR 50.00",
    MAX_RETAINED_BALANCE: Number.isFinite(maxCents) ? fmtEurThreshold(maxCents) : "EUR 1,000.00",
  };
  return { vars, missing };
}

const PLACEHOLDER_RE = /\[\[([A-Z_]+)(?::[^\]]*)?\]\]/g;

/** Ersetzt [[KEY]] / [[KEY: Hinweis]] durch Variablenwerte (HTML-escaped). */
function fillPlaceholders(templateHtml: string, vars: Record<string, string>): string {
  return templateHtml.replace(PLACEHOLDER_RE, (_m, key: string) => {
    if (key === "SIGNATURE_PANEL") return "[[SIGNATURE_PANEL]]"; // separat behandelt
    const val = vars[key];
    return val != null ? escapeHtml(val) : `<span style="color:#b91c1c">[${key} — nicht gesetzt]</span>`;
  });
}

/** Signatur-Panel (unsigned = Leerfelder, signed = eingebettete Signatur + Audit). */
function signaturePanel(opts: {
  signed: boolean;
  agentLegalName: string;
  signatureName?: string;
  signaturePng?: string | null;
  signatureMode?: string;
  signedAt?: Date | string | null;
  ip?: string | null;
  templateVersion?: number;
  docHashValue?: string | null;
} = { signed: false, agentLegalName: "" }): string {
  const { signed } = opts;
  const agentSig = signed
    ? (opts.signaturePng
        ? `<img class="sig-img" src="${escapeHtml(opts.signaturePng)}" alt="signature" />`
        : `<span style="font-family:'Brush Script MT',cursive;font-size:20pt;">${escapeHtml(opts.signatureName || "")}</span>`)
    : "";
  const agentMeta = signed
    ? `<div class="meta">
         Signed electronically by ${escapeHtml(opts.signatureName || opts.agentLegalName)}
         (${opts.signatureMode === "drawn" ? "hand-drawn" : "typed confirmation"})<br/>
         Timestamp (Europe/Berlin): ${escapeHtml(formatBerlin(opts.signedAt))}<br/>
         IP address: ${escapeHtml(opts.ip || "—")} · Contract version: v${opts.templateVersion ?? "—"}<br/>
         Document hash (SHA-256): <span class="hash">${escapeHtml(opts.docHashValue || "—")}</span>
       </div>`
    : `<div class="meta">To be signed electronically via the FIAON Platform.</div>`;

  return `
  <div class="sig-grid">
    <div class="sig-col">
      <div style="font-weight:700;">For and on behalf of the Principal — FIAON LTD</div>
      <div class="sig-line">Name: FIAON LTD, by its authorised representative</div>
      <div class="sig-line">Position: Director</div>
      <div class="sig-line">Signature: <span style="font-family:'Brush Script MT',cursive;font-size:18pt;">FIAON LTD</span></div>
      <div class="sig-line">Date: ${signed ? escapeHtml(formatBerlin(opts.signedAt, false)) : "________________"}</div>
    </div>
    <div class="sig-col">
      <div style="font-weight:700;">The Agent — ${escapeHtml(opts.agentLegalName)}</div>
      <div class="sig-line">Name / Company: ${signed ? escapeHtml(opts.signatureName || opts.agentLegalName) : "________________"}</div>
      <div class="sig-line" style="min-height:40px;">Signature: ${agentSig}</div>
      <div class="sig-line">Date: ${signed ? escapeHtml(formatBerlin(opts.signedAt, false)) : "________________"}</div>
      ${agentMeta}
    </div>
  </div>`;
}

/** Rendert den Vertrags-Body (ohne CI-Wrapper) für Vorschau ODER signiert. */
function renderContractBody(templateHtml: string, vars: Record<string, string>, signPanel: string): string {
  const filled = fillPlaceholders(templateHtml, vars);
  return filled.replace(/\[\[SIGNATURE_PANEL\]\]/g, signPanel);
}

async function getActiveTemplate(): Promise<any | null> {
  const rows = await sqlPool`SELECT * FROM fiaon_contract_templates WHERE status = 'active' ORDER BY version DESC LIMIT 1`;
  return rows[0] || null;
}

// ── Onboarding-Status ────────────────────────────────────────────────────────
export interface OnboardingStatus {
  complete: boolean;
  consent: {
    complete: boolean;
    docs: { key: string; title: string; version: number; accepted: boolean; acceptedAt: string | null }[];
  };
  contract: {
    complete: boolean;
    hasActiveTemplate: boolean;
    templateVersion: number | null;
    signedAt: string | null;
    contractId: number | null;
  };
}

export async function computeOnboardingStatus(agentId: number): Promise<OnboardingStatus> {
  await ensureOnboardingTables();
  const consents = await sqlPool`
    SELECT doc_key, doc_version, accepted_at FROM fiaon_agent_consents WHERE agent_id = ${agentId}
  `;
  const docs = ONBOARDING_DOCS.map((d: OnboardingDoc) => {
    const hit = consents.find((c: any) => c.doc_key === d.key && Number(c.doc_version) === d.version);
    return {
      key: d.key,
      title: d.title,
      version: d.version,
      accepted: !!hit,
      acceptedAt: hit ? new Date(hit.accepted_at).toISOString() : null,
    };
  });
  const consentComplete = docs.every((d) => d.accepted);

  const active = await getActiveTemplate();
  let signed: any = null;
  if (active) {
    const rows = await sqlPool`
      SELECT id, signed_at FROM fiaon_agent_contracts
      WHERE agent_id = ${agentId} AND template_version = ${active.version} AND status = 'signed'
      ORDER BY signed_at DESC LIMIT 1
    `;
    signed = rows[0] || null;
  }
  const contractComplete = !!active && !!signed;

  return {
    complete: consentComplete && contractComplete,
    consent: { complete: consentComplete, docs },
    contract: {
      complete: contractComplete,
      hasActiveTemplate: !!active,
      templateVersion: active ? active.version : null,
      signedAt: signed ? new Date(signed.signed_at).toISOString() : null,
      contractId: signed ? signed.id : null,
    },
  };
}

// ── GATE: kein Kundendatenzugriff ohne abgeschlossenes Onboarding ────────────
// In routes.ts VOR den Agent-Routern auf /api/fiaon eingehängt. Blockt alle
// /agent/*-Pfade außer der Allowlist (Auth + Onboarding-Flow) mit 403, solange
// das Onboarding nicht abgeschlossen ist.
const GATE_ALLOW = [
  "/agent/login", "/agent/logout", "/agent/me",
  "/agent/setup", "/agent/forgot-password", "/agent/reset-password",
  "/agent/onboarding",
];
function isAllowed(path: string): boolean {
  return GATE_ALLOW.some((a) => path === a || path.startsWith(a + "/"));
}

export function customerDataGate(req: Request, res: Response, next: NextFunction) {
  // Kleingeschrieben, aus demselben Grund wie in fiaon-admin-zugang.ts:
  // Express routet ohne Rücksicht auf Groß- und Kleinschreibung, ein
  // case-sensitiver Vergleich hier wäre also eine Attrappe. (Abnahme 02.09.2026)
  const p = String(req.path || "").toLowerCase();
  // Nur das Agent-Portal betrifft das Gate; Admin-/öffentliche Routen unberührt.
  if (p !== "/agent" && !p.startsWith("/agent/")) return next();
  if (p === "/agent" || isAllowed(p)) return next();
  // Geschützt: Agent muss angemeldet UND onboarded sein.
  requireAgent(req as AgentRequest, res, async () => {
    try {
      const status = await computeOnboardingStatus((req as AgentRequest).agent!.id);
      if (!status.complete) {
        return res.status(403).json({
          ok: false,
          onboarding: "incomplete",
          error: "Onboarding nicht abgeschlossen — bitte Zustimmung und Vertrag abschließen.",
        });
      }
      next();
    } catch (err) {
      console.error("[FIAON-ONBOARDING] gate:", err);
      res.status(500).json({ ok: false, error: "Serverfehler" });
    }
  });
}

// ═══════════════ AGENT: Onboarding-Flow ═══════════════

/** Status + Volltexte + Vertrags-Vorschau (befüllt) für den Onboarding-Flow. */
router.get("/agent/onboarding", requireAgent, async (req: AgentRequest, res) => {
  try {
    const status = await computeOnboardingStatus(req.agent!.id);
    const active = await getActiveTemplate();
    let contractHtml: string | null = null;
    let contractMissing: string[] = [];
    if (active) {
      const agentRows = await sqlPool`SELECT * FROM fiaon_agents WHERE id = ${req.agent!.id}`;
      const { vars, missing } = await resolveContractVars(agentRows[0]);
      contractMissing = missing;
      contractHtml = renderContractBody(
        active.body_html,
        vars as unknown as Record<string, string>,
        signaturePanel({ signed: false, agentLegalName: vars.AGENT_LEGAL_NAME }),
      );
    }
    res.json({
      ok: true,
      status,
      documents: ONBOARDING_DOCS.map((d) => ({ key: d.key, title: d.title, version: d.version, summary: d.summary, html: d.html })),
      contract: {
        hasActiveTemplate: !!active,
        templateVersion: active ? active.version : null,
        title: active ? active.title : null,
        html: contractHtml,
        missing: contractMissing,
      },
    });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] get onboarding:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zustimmung zu EINEM Dokument protokollieren (versioniert, IP, Berlin-Zeit). */
router.post("/agent/onboarding/consent", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureOnboardingTables();
    const docKey = String(req.body?.docKey || "");
    const doc = ONBOARDING_DOCS.find((d) => d.key === docKey);
    if (!doc) return res.status(400).json({ ok: false, error: "Unbekanntes Dokument" });
    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] || "").slice(0, 500);
    await sqlPool`
      INSERT INTO fiaon_agent_consents (agent_id, doc_key, doc_version, ip, user_agent)
      VALUES (${req.agent!.id}, ${doc.key}, ${doc.version}, ${ip}, ${ua})
      ON CONFLICT (agent_id, doc_key, doc_version) DO NOTHING
    `;
    await logAgentEvent(req.agent!.id, "consent_accepted", { doc: doc.key, version: doc.version, ip });
    const status = await computeOnboardingStatus(req.agent!.id);
    res.json({ ok: true, status });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] consent:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Vertrag digital unterzeichnen — erst nach vollständiger Zustimmung. */
router.post("/agent/onboarding/sign", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureOnboardingTables();
    const { signatureName, signatureMode, signaturePng, confirm } = req.body || {};
    if (confirm !== true) return res.status(400).json({ ok: false, error: "Verbindliche Bestätigung erforderlich" });
    const name = String(signatureName || "").trim();
    if (name.length < 3) return res.status(400).json({ ok: false, error: "Bitte vollständigen Namen zur Signatur angeben" });
    const mode = signatureMode === "drawn" ? "drawn" : "typed";
    if (mode === "drawn" && !/^data:image\/(png|jpeg);base64,/.test(String(signaturePng || ""))) {
      return res.status(400).json({ ok: false, error: "Signaturbild fehlt" });
    }

    // Zustimmung muss vollständig sein (Reihenfolge A → B).
    const pre = await computeOnboardingStatus(req.agent!.id);
    if (!pre.consent.complete) return res.status(409).json({ ok: false, error: "Bitte zuerst alle Zustimmungen bestätigen" });

    const active = await getActiveTemplate();
    if (!active) return res.status(409).json({ ok: false, error: "Es ist noch keine aktive Vertragsvorlage hinterlegt. Bitte den Administrator kontaktieren." });

    const agentRows = await sqlPool`SELECT * FROM fiaon_agents WHERE id = ${req.agent!.id}`;
    const agent = agentRows[0];
    const { vars } = await resolveContractVars(agent);

    const ip = clientIp(req);
    const ua = String(req.headers["user-agent"] || "").slice(0, 500);
    const signedAt = new Date();

    // Body OHNE Signatur → Hash-Basis (Vertragsinhalt + harte Metadaten).
    const bodyUnsigned = renderContractBody(active.body_html, vars as any, "");
    const hash = docHash(
      `${active.version}|${req.agent!.id}|${name}|${signedAt.toISOString()}|${ip}|${bodyUnsigned}`,
    );

    const panel = signaturePanel({
      signed: true,
      agentLegalName: vars.AGENT_LEGAL_NAME,
      signatureName: name,
      signaturePng: mode === "drawn" ? String(signaturePng) : null,
      signatureMode: mode,
      signedAt,
      ip,
      templateVersion: active.version,
      docHashValue: hash,
    });
    const renderedBody = renderContractBody(active.body_html, vars as any, panel);
    let pdfBase64: string | null = null;
    try {
      const pdf = await renderDocumentPdf({
        documentTitle: active.title,
        subtitle: "Self-Employed Commercial Agent Agreement · Independent Sales Agency",
        bodyHtml: renderedBody,
      });
      pdfBase64 = pdf.toString("base64");
    } catch (e) {
      console.error("[FIAON-ONBOARDING] contract PDF render failed:", e);
    }

    const rows = await sqlPool`
      INSERT INTO fiaon_agent_contracts
        (agent_id, template_version, variables_json, rendered_html, signature_png, signature_name,
         signature_mode, signed_at, ip, user_agent, doc_hash, pdf_base64, status)
      VALUES
        (${req.agent!.id}, ${active.version}, ${JSON.stringify(vars)}, ${renderedBody},
         ${mode === "drawn" ? String(signaturePng) : null}, ${name}, ${mode}, ${signedAt},
         ${ip}, ${ua}, ${hash}, ${pdfBase64}, 'signed')
      RETURNING id
    `;
    await logAgentEvent(req.agent!.id, "contract_signed", { contract_id: rows[0].id, version: active.version, hash, ip });
    sendMakeWebhook("contract_signed", {
      email: agent.email,
      vorname: agent.first_name || agent.name,
      agent_name: vars.AGENT_LEGAL_NAME,
      contract_version: active.version,
      signed_at: signedAt.toISOString(),
      signed_at_text: formatBerlin(signedAt),
      doc_hash: hash,
      download_url: `/api/fiaon/agent/documents/contract/${rows[0].id}.pdf`,
    }).catch(() => {});

    const status = await computeOnboardingStatus(req.agent!.id);
    res.json({ ok: true, status, contractId: rows[0].id });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] sign:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ AGENT: „Meine Dokumente" (nur nach Onboarding erreichbar) ═══

router.get("/agent/documents", requireAgent, async (req: AgentRequest, res) => {
  try {
    await ensureOnboardingTables();
    const contracts = await sqlPool`
      SELECT id, template_version, signature_name, signature_mode, signed_at, doc_hash, status,
             (pdf_base64 IS NOT NULL) AS has_pdf
      FROM fiaon_agent_contracts WHERE agent_id = ${req.agent!.id} ORDER BY signed_at DESC
    `;
    const statements = await sqlPool`
      SELECT id, statement_no, period_start, period_end, issued_at, gross_cents, net_cents, doc_hash,
             (pdf_base64 IS NOT NULL) AS has_pdf
      FROM fiaon_commission_statements WHERE agent_id = ${req.agent!.id} ORDER BY issued_at DESC
    `;
    res.json({ ok: true, contracts, statements });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] documents:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

async function servePdf(res: Response, base64: string | null, filename: string) {
  if (!base64) return res.status(404).json({ ok: false, error: "PDF nicht verfügbar" });
  const buf = Buffer.from(base64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(buf);
}

router.get("/agent/documents/contract/:id.pdf", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`SELECT pdf_base64, template_version FROM fiaon_agent_contracts WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    await servePdf(res, rows[0].pdf_base64, `FIAON_Agent_Agreement_v${rows[0].template_version}.pdf`);
  } catch (err) {
    console.error("[FIAON-ONBOARDING] contract pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/agent/documents/statement/:id.pdf", requireAgent, async (req: AgentRequest, res) => {
  try {
    const rows = await sqlPool`SELECT pdf_base64, statement_no FROM fiaon_commission_statements WHERE id = ${Number(req.params.id)} AND agent_id = ${req.agent!.id}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    await servePdf(res, rows[0].pdf_base64, `${rows[0].statement_no}.pdf`);
  } catch (err) {
    console.error("[FIAON-ONBOARDING] statement pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ═══════════════ PROVISIONS-ABRECHNUNG (Prompt 2 E) ═══════════════
// Wird bei bestätigter Auszahlung aufgerufen (fiaon-team.ts mark-paid).
// Zieht ausschließlich die Werte der Commission-Engine + des Auszahlungssatzes.

/**
 * Die Abrechnung zu einer Auszahlung anlegen — samt PDF.
 *
 * ── DER RÜCKGABEWERT SAGT JETZT, OB DER BELEG DA IST ──────────────────────
 * Vorher gab die Funktion `{ ok: true }` zurück, auch wenn das PDF gescheitert
 * war — der Fehler stand nur in der Konsole. Der Aufrufer (die
 * Auszahlungs-Freigabe) konnte ihn also nicht weitergeben, und genau so entstand
 * FIAON-COM-2026-0011: ausgezahlt, kein Beleg, niemand informiert.
 *
 * `pdfFehlt` und `pdfGrund` gehören deshalb in die Antwort. Die Zeile entsteht
 * weiterhin — eine Abrechnung ohne PDF ist besser als keine Abrechnung, weil sie
 * die Nummer und die Positionen festhält und nachträglich gedruckt werden kann.
 */
export async function generateCommissionStatement(payoutId: number): Promise<{
  ok: boolean; statementNo?: string; skipped?: boolean; pdfFehlt?: boolean; pdfGrund?: string;
}> {
  await ensureOnboardingTables();
  const existing = await sqlPool`SELECT statement_no FROM fiaon_commission_statements WHERE payout_id = ${payoutId}`;
  if (existing.length > 0) return { ok: true, statementNo: existing[0].statement_no, skipped: true };

  const payoutRows = await sqlPool`SELECT * FROM fiaon_payouts WHERE id = ${payoutId}`;
  if (payoutRows.length === 0) return { ok: false };
  const payout = payoutRows[0];

  const agentRows = await sqlPool`SELECT * FROM fiaon_agents WHERE id = ${payout.agent_id}`;
  const agent = agentRows[0];
  const { vars } = await resolveContractVars(agent);

  // Positionen — genau die Commission-Einträge dieser Auszahlung (eine Wahrheit).
  const entries = await sqlPool`
    SELECT id, ref, payment_reference, pack_name, base_amount_cents, rate_bp, amount_cents, kind, note, created_at
    FROM fiaon_commissions WHERE payout_id = ${payoutId} ORDER BY created_at ASC
  `;
  const lines = entries.map((e: any) => ({
    date: new Date(e.created_at).toISOString(),
    reference: e.payment_reference || e.ref,
    pack: e.pack_name || "",
    saleCents: Number(e.base_amount_cents) || 0,
    rateBp: Number(e.rate_bp) || 0,
    commissionCents: Number(e.amount_cents) || 0,
    negative: Number(e.amount_cents) < 0,
    note: e.note || (Number(e.amount_cents) < 0 ? "Clawback / correction" : ""),
    kind: e.kind || "own",
  }));

  const grossCents = lines.reduce((s, l) => s + l.commissionCents, 0);
  const netCents = Number(payout.amount_cents);
  const periods = entries.map((e: any) => new Date(e.created_at).getTime());
  const periodStart = periods.length ? new Date(Math.min(...periods)) : null;
  const periodEnd = periods.length ? new Date(Math.max(...periods)) : null;

  const year = berlinYear();
  const cnt = await sqlPool`SELECT COUNT(*)::int AS n FROM fiaon_commission_statements WHERE statement_no LIKE ${"FIAON-COM-" + year + "-%"}`;
  const statementNo = `FIAON-COM-${year}-${String(cnt[0].n + 1).padStart(4, "0")}`;

  const issuedAt = new Date();
  const paidAt = payout.processed_at ? new Date(payout.processed_at) : issuedAt;

  // USt-Behandlung je Partner-Typ (anpassbarer Textbaustein — steuerlich vom
  // Vorgesetzter mit Steuerberater final zu bestätigen).
  const isCompany = String(agent.partner_type || "private") === "company";
  const vatNote = isCompany && agent.vat_id
    ? `Reverse charge — Steuerschuldnerschaft des Leistungsempfängers (VAT-ID ${escapeHtml(agent.vat_id)}). No VAT is charged by FIAON LTD; the recipient accounts for VAT under the reverse-charge mechanism.`
    : `The Agent is a private individual / not VAT-registered for this activity. No VAT is charged; the Agent is responsible for its own taxation.`;

  // ══════════════════════════════════════════════════════════════════════════
  // DAS PDF KOMMT AUS EINEM RENDERER — FÜR ALLE WEGE (19.08.2026)
  //
  // ── WAS HIER VORHER STAND ────────────────────────────────────────────────
  // Rund 70 Zeilen HTML im Fließtext dieser Funktion: eine Tabelle mit den
  // Spalten „Sale value" und „Rate", Beschriftungen auf Englisch, und
  // `markenzeile: fussZeile(firma), fusszeile: fussZeile(firma)` — dieselbe
  // Firmenzeile an zwei Stellen.
  //
  // GEMESSEN am erzeugten Dokument (scripts/mess-abrechnung.ts,
  // FIAON-COM-2026-0010): vier Seiten für sechs Positionen, zwei davon mit je
  // 82 Zeichen; „FIAON LTD" sechsmal; 20 von 20 Beschriftungen englisch; das
  // Datum zehnmal; alle sechs Positionen Pauschalen in einer Tabelle mit
  // Prozentspalte.
  //
  // Jetzt baut `server/lib/fiaon-abrechnung-pdf.ts` das Dokument — durchgehend
  // deutsch, zwei getrennte Positionstabellen, laufende Fußzeile aus Chromium.
  // Freigabe, Abrechnungs-Zentrale und Mail-Anhang holen es aus DERSELBEN
  // Funktion; `scripts/pruef-abrechnung.ts` prüft, dass es keine zweite gibt.
  // ══════════════════════════════════════════════════════════════════════════
  // ── FIRMIERUNG UND STEUERHINWEIS AUS DEN EINSTELLUNGEN ─────────────────
  // Beide standen einmal hart im Code. Beim Umzug in ein anderes Büro hätte
  // jemand eine TypeScript-Datei ändern müssen — für eine Hausnummer. Und der
  // Steuerhinweis, dessen Wortlaut vom Steuerberater kommt, wäre nur von einem
  // Entwickler änderbar gewesen. Ein solcher Text wird dann nicht geändert; er
  // bleibt falsch stehen.
  const firma = await firmierung();

  const empfaengerAnschrift = [vars.AGENT_ADDRESS]
    .map((x) => String(x ?? "").trim()).filter((x) => x.length > 0).join(", ") || null;

  const daten: AbrechnungDaten = {
    nummer: statementNo,
    ausstellungsdatum: issuedAt,
    zeitraumVon: periodStart,
    zeitraumBis: periodEnd,
    firma,
    empfaenger: {
      name: String(vars.AGENT_LEGAL_NAME || agent.name || "—"),
      rolle: agent.rolle ?? null,
      email: String(agent.email ?? "—"),
      anschrift: empfaengerAnschrift,
      vatId: agent.vat_id ?? null,
      steuerNr: agent.tax_id ?? null,
      istFirma: isCompany,
    },
    // Die Positionen kommen unverändert aus dem Provisionsmotor. Ob eine Zeile
    // in die Verkaufs- oder in die Pauschaltabelle geht, entscheidet der Satz —
    // das ist keine Darstellungsfrage, sondern die Natur der Position.
    positionen: lines.map((l) => ({
      datum: l.date,
      referenz: String(l.reference ?? ""),
      paket: l.pack || null,
      anlass: l.note || null,
      grundlageCents: Number(l.saleCents) || 0,
      satzBp: Number(l.rateBp) || 0,
      betragCents: Number(l.commissionCents) || 0,
    })),
    auszahlungCents: netCents,
    auszahlungsdatum: paidAt,
    ibanMaskiert: payout.iban_masked ?? null,
    verwendungszweck: statementNo,
    auszahlungId: payoutId,
  };

  let pdfBase64: string | null = null;
  let hash = docHash(`${statementNo}|${payout.agent_id}|${grossCents}|${netCents}|${JSON.stringify(lines)}`);
  let pdfGrund: string | undefined;
  try {
    const erg = await abrechnungPdf(daten);
    pdfBase64 = erg.pdf.toString("base64");
    hash = erg.hash;
  } catch (e) {
    // Ein Beleg ohne PDF ist ein halber Beleg. Die Zeile entsteht trotzdem
    // (Nummer und Positionen sind damit festgehalten und nachträglich
    // druckbar) — aber der Grund GEHT MIT NACH OBEN, damit die Freigabe ihn
    // dem Menschen zeigen kann. Vorher endete er hier in der Konsole.
    pdfGrund = e instanceof Error ? e.message : String(e);
    console.error(`[ABRECHNUNG] ${statementNo}: PDF konnte nicht erzeugt werden:`, e);
  }

  await sqlPool`
    INSERT INTO fiaon_commission_statements
      (agent_id, payout_id, statement_no, period_start, period_end, gross_cents, net_cents, variables_json, lines_json, doc_hash, pdf_base64)
    VALUES
      (${payout.agent_id}, ${payoutId}, ${statementNo}, ${periodStart}, ${periodEnd}, ${grossCents}, ${netCents},
       ${JSON.stringify(vars)}, ${JSON.stringify(lines)}, ${hash}, ${pdfBase64})
    ON CONFLICT (payout_id) DO NOTHING
  `;
  await logAgentEvent(payout.agent_id, "commission_statement_issued", { statement_no: statementNo, payout_id: payoutId, net_cents: netCents });
  sendMakeWebhook("commission_statement_issued", {
    email: agent.email,
    vorname: agent.first_name || agent.name,
    statement_no: statementNo,
    betrag: (netCents / 100).toFixed(2),
    issued_at: issuedAt.toISOString(),
    doc_hash: hash,
  }).catch(() => {});

  console.log(`[FIAON-ONBOARDING] Provisions-Abrechnung erzeugt: ${statementNo} `
    + `(${fmtEurCents(netCents)})${pdfBase64 ? "" : " — OHNE PDF"}`);
  return { ok: true, statementNo, pdfFehlt: !pdfBase64, pdfGrund };
}

/**
 * Eine bestehende Abrechnung mit dem AKTUELLEN Layout neu drucken.
 *
 * ── WARUM DAS EINE EIGENE FUNKTION IST ────────────────────────────────────
 * `generateCommissionStatement` steigt bei einer vorhandenen Abrechnung sofort
 * aus (`skipped: true`) — richtig so, sonst entstünden zwei Belege mit zwei
 * Nummern für eine Auszahlung. Zum Nachdrucken braucht es deshalb einen zweiten
 * Weg, der die NUMMER BEHÄLT und nur das PDF ersetzt.
 *
 * Die Grenze („nicht bei ausgezahlt") steht in der Route
 * (`fiaon-abrechnungen.ts`) UND hier: Wer diese Funktion später von anderswo
 * aufruft, soll nicht versehentlich einen Beleg überschreiben.
 */
export async function abrechnungNeuErzeugen(
  statementId: number, wer = "Verwaltung",
): Promise<{ ok: boolean; grund?: string; ersterDruck?: boolean }> {
  const [s] = (await sqlPool`
    SELECT s.*, p.status AS auszahlung_status, p.amount_cents, p.processed_at, p.iban_masked,
           ag.name, ag.rolle, ag.email, ag.partner_type, ag.vat_id, ag.tax_id, ag.first_name
      FROM fiaon_commission_statements s
      LEFT JOIN fiaon_payouts p ON p.id = s.payout_id
      LEFT JOIN fiaon_agents ag ON ag.id = s.agent_id
     WHERE s.id = ${statementId}
  `) as any[];
  if (!s) return { ok: false, grund: "Abrechnung nicht gefunden." };

  // ══════════════════════════════════════════════════════════════════════════
  // DIE WAND SCHÜTZT VOR ÜBERSCHREIBEN, NICHT VOR ERSTELLEN (20.08.2026)
  //
  // ── DER BEFUND AUS PRODUKTION ────────────────────────────────────────────
  // FIAON-COM-2026-0011 (386,40 €, ausgezahlt) hatte kein PDF. Der Abruf
  // antwortete „über Neu erzeugen erstellbar, solange die Auszahlung nicht
  // abgeschlossen ist" — und sie WAR abgeschlossen. Damit existierte eine
  // ausgezahlte Provision ohne Beleg, und das System verweigerte die Herstellung.
  //
  // Der Denkfehler war meiner: Ich habe „Belege ändert man nicht" richtig
  // gedacht und falsch umgesetzt — nämlich auch auf den Fall angewandt, in dem
  // es noch gar keinen Beleg gibt. Eine Erst-Erzeugung ist kein Eingriff in ein
  // Dokument, sondern seine Herstellung.
  //
  // Drei Fälle, drei Antworten:
  //   kein PDF                  → IMMER erzeugen, auch bei „ausgezahlt"
  //   PDF da + ausgezahlt       → verweigern (der Beleg bleibt, wie er ist)
  //   PDF da + nicht ausgezahlt → neu drucken, alte Fassung archivieren
  // ══════════════════════════════════════════════════════════════════════════
  const hatPdf = !!s.pdf_base64;
  const ausgezahlt = String(s.auszahlung_status ?? "") === "ausgezahlt";
  if (hatPdf && ausgezahlt) {
    return {
      ok: false,
      grund: "Die Auszahlung ist erfolgt und ein Beleg liegt vor — er wird nicht "
        + "überschrieben. Änderungen an einem Buchungsbeleg sind nicht zulässig.",
    };
  }

  const firma = await firmierung();
  const lines = JSON.parse(String(s.lines_json || "[]"));
  const daten: AbrechnungDaten = {
    nummer: String(s.statement_no),
    ausstellungsdatum: new Date(s.issued_at),
    zeitraumVon: s.period_start ? new Date(s.period_start) : null,
    zeitraumBis: s.period_end ? new Date(s.period_end) : null,
    firma,
    empfaenger: {
      name: String(s.name ?? "—"),
      rolle: s.rolle ?? null,
      email: String(s.email ?? "—"),
      anschrift: null,
      vatId: s.vat_id ?? null,
      steuerNr: s.tax_id ?? null,
      istFirma: String(s.partner_type || "private") === "company",
    },
    positionen: lines.map((l: any) => ({
      datum: l.date,
      referenz: String(l.reference ?? ""),
      paket: l.pack || null,
      anlass: l.note || null,
      grundlageCents: Number(l.saleCents) || 0,
      satzBp: Number(l.rateBp) || 0,
      betragCents: Number(l.commissionCents) || 0,
    })),
    auszahlungCents: Number(s.net_cents),
    auszahlungsdatum: s.processed_at ? new Date(s.processed_at) : null,
    ibanMaskiert: s.iban_masked ?? null,
    verwendungszweck: String(s.statement_no),
    auszahlungId: s.payout_id != null ? Number(s.payout_id) : null,
  };

  try {
    const erg = await abrechnungPdf(daten);
    if (hatPdf) {
      // ── ERSETZEN: DIE ALTE FASSUNG WIRD ARCHIVIERT ──────────────────────
      // Kein Hard-Delete eines Dokuments, auch nicht eines noch nicht
      // ausgezahlten. Wer später fragt „wie sah der Beleg vorher aus", bekommt
      // eine Antwort.
      await sqlPool`
        UPDATE fiaon_commission_statements
           SET pdf_base64_ersetzt = pdf_base64,
               doc_hash_ersetzt = doc_hash,
               pdf_ersetzt_am = NOW(),
               pdf_ersetzt_von = ${wer},
               pdf_base64 = ${erg.pdf.toString("base64")},
               doc_hash = ${erg.hash},
               neu_erzeugt_am = NOW(),
               neu_erzeugt_anzahl = COALESCE(neu_erzeugt_anzahl, 0) + 1
         WHERE id = ${statementId}
      `;
      console.log(`[ABRECHNUNG] ${s.statement_no} ersetzt — alte Fassung archiviert `
        + `(${Math.round(erg.pdf.length / 1024)} kB neu).`);
    } else {
      // ── ERST-ERZEUGUNG ─────────────────────────────────────────────────
      // `pdf_nachtraeglich` hält fest, dass der Beleg NACH der Auszahlung
      // hergestellt wurde. Inhaltlich zeigt er den Stand von damals
      // (lines_json, issued_at, processed_at) — nur sein Druckdatum liegt
      // später, und das ist eine Tatsache und keine Kleinigkeit.
      await sqlPool`
        UPDATE fiaon_commission_statements
           SET pdf_base64 = ${erg.pdf.toString("base64")},
               doc_hash = ${erg.hash},
               pdf_erzeugt_am = NOW(),
               pdf_nachtraeglich = ${ausgezahlt}
         WHERE id = ${statementId}
      `;
      console.log(`[ABRECHNUNG] ${s.statement_no} ERSTMALS erzeugt`
        + `${ausgezahlt ? " (nachträglich — die Auszahlung war schon erfolgt)" : ""} `
        + `(${Math.round(erg.pdf.length / 1024)} kB).`);
    }
    await logAgentEvent(Number(s.agent_id), "commission_statement_pdf", {
      statement_no: s.statement_no,
      art: hatPdf ? "ersetzt" : (ausgezahlt ? "nachtraeglich erstellt" : "erstellt"),
      doc_hash: erg.hash, wer, at: new Date().toISOString(),
    }).catch(() => {});
    return { ok: true, ersterDruck: !hatPdf };
  } catch (e) {
    const grund = e instanceof Error ? e.message : String(e);
    console.error(`[ABRECHNUNG] ${s.statement_no} Druck fehlgeschlagen:`, e);
    return { ok: false, grund: `Der Druck ist gescheitert: ${grund}` };
  }
}

// ═══════════════ ADMIN: Vorlagen, Variablen, Vorschau, Nachweise ═══════════════

router.get("/admin/contract-templates", async (_req, res) => {
  try {
    await ensureOnboardingTables();
    const rows = await sqlPool`SELECT id, version, title, status, created_at, activated_at FROM fiaon_contract_templates ORDER BY version DESC`;
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] templates list:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/contract-templates/:id", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const rows = await sqlPool`SELECT * FROM fiaon_contract_templates WHERE id = ${Number(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    res.json({ ok: true, template: rows[0] });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] template get:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Neuer Entwurf (neue Version = max+1). */
router.post("/admin/contract-templates", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const title = String(req.body?.title || "").trim() || "Self-Employed Commercial Agent Agreement";
    const bodyHtml = String(req.body?.bodyHtml || "").trim();
    if (bodyHtml.length < 50) return res.status(400).json({ ok: false, error: "Vertragstext zu kurz" });
    const maxV = await sqlPool`SELECT COALESCE(MAX(version), 0)::int AS v FROM fiaon_contract_templates`;
    const version = maxV[0].v + 1;
    const rows = await sqlPool`
      INSERT INTO fiaon_contract_templates (version, title, body_html, status)
      VALUES (${version}, ${title}, ${bodyHtml}, 'draft') RETURNING id, version
    `;
    res.json({ ok: true, id: rows[0].id, version: rows[0].version });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] template create:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Entwurf bearbeiten (nur solange Status 'draft'). */
router.post("/admin/contract-templates/:id/update", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const id = Number(req.params.id);
    const cur = await sqlPool`SELECT status FROM fiaon_contract_templates WHERE id = ${id}`;
    if (cur.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    if (cur[0].status !== "draft") return res.status(409).json({ ok: false, error: "Nur Entwürfe sind bearbeitbar" });
    const title = String(req.body?.title || "").trim();
    const bodyHtml = String(req.body?.bodyHtml || "").trim();
    await sqlPool`
      UPDATE fiaon_contract_templates
      SET title = COALESCE(NULLIF(${title}, ''), title), body_html = COALESCE(NULLIF(${bodyHtml}, ''), body_html)
      WHERE id = ${id}
    `;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] template update:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Entwurf aktivieren → wird zur gültigen Version; vorher aktive wird archiviert. */
router.post("/admin/contract-templates/:id/activate", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const id = Number(req.params.id);
    const cur = await sqlPool`SELECT * FROM fiaon_contract_templates WHERE id = ${id}`;
    if (cur.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    await sqlPool`UPDATE fiaon_contract_templates SET status = 'archived' WHERE status = 'active'`;
    await sqlPool`UPDATE fiaon_contract_templates SET status = 'active', activated_at = NOW() WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] template activate:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Vertragsvariablen eines Agenten setzen. */
router.post("/admin/agents/:id/contract-variables", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const id = Number(req.params.id);
    const b = req.body || {};
    const partnerType = b.partnerType === "company" ? "company" : "private";
    const s = (v: any) => (v == null || v === "" ? null : String(v).trim());
    await sqlPool`
      UPDATE fiaon_agents SET
        partner_type = ${partnerType},
        legal_name = ${s(b.legalName)},
        address_line = ${s(b.addressLine)},
        postal_code = ${s(b.postalCode)},
        city = ${s(b.city)},
        country = ${s(b.country)},
        birth_date = ${s(b.birthDate)},
        founding_date = ${s(b.foundingDate)},
        tax_id = ${s(b.taxId)},
        vat_id = ${s(b.vatId)},
        company_name = ${s(b.companyName)},
        legal_form = ${s(b.legalForm)},
        register_no = ${s(b.registerNo)},
        authorised_rep = ${s(b.authorisedRep)},
        contract_start_date = ${s(b.contractStartDate)},
        payout_terms = ${s(b.payoutTerms)},
        notice_period = ${s(b.noticePeriod)},
        governing_law = ${s(b.governingLaw)},
        jurisdiction = ${s(b.jurisdiction)},
        activity_description = ${s(b.activityDescription)}
      WHERE id = ${id}
    `;
    await logAgentEvent(id, "contract_variables_updated", { by: "admin" });
    res.json({ ok: true });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] set variables:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Aktuelle Variablen + Live-Vorschau (befüllter Vertrag) für einen Agenten. */
router.get("/admin/agents/:id/contract-preview", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const id = Number(req.params.id);
    const agentRows = await sqlPool`SELECT * FROM fiaon_agents WHERE id = ${id}`;
    if (agentRows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    const agent = agentRows[0];
    const { vars, missing } = await resolveContractVars(agent);
    // optional: bestimmte Vorlage; sonst aktive (oder neuester Entwurf zur Vorschau)
    let tpl: any = null;
    if (req.query.templateId) {
      const t = await sqlPool`SELECT * FROM fiaon_contract_templates WHERE id = ${Number(req.query.templateId)}`;
      tpl = t[0] || null;
    } else {
      tpl = (await getActiveTemplate()) || (await sqlPool`SELECT * FROM fiaon_contract_templates ORDER BY version DESC LIMIT 1`)[0] || null;
    }
    const html = tpl
      ? wrapFiaonDocument({
          documentTitle: tpl.title,
          subtitle: `Preview · v${tpl.version} (${tpl.status})`,
          bodyHtml: renderContractBody(tpl.body_html, vars as any, signaturePanel({ signed: false, agentLegalName: vars.AGENT_LEGAL_NAME })),
          watermark: tpl.status !== "active" ? "DRAFT" : null,
        })
      : null;
    const variables = {
      partnerType: agent.partner_type, legalName: agent.legal_name, addressLine: agent.address_line,
      postalCode: agent.postal_code, city: agent.city, country: agent.country,
      birthDate: agent.birth_date, foundingDate: agent.founding_date, taxId: agent.tax_id, vatId: agent.vat_id,
      companyName: agent.company_name, legalForm: agent.legal_form, registerNo: agent.register_no,
      authorisedRep: agent.authorised_rep, contractStartDate: agent.contract_start_date,
      payoutTerms: agent.payout_terms, noticePeriod: agent.notice_period,
      governingLaw: agent.governing_law, jurisdiction: agent.jurisdiction, activityDescription: agent.activity_description,
      commissionRateBp: agent.commission_rate_bp,
      // Auszahlungs-Schwellen (global, nur Anzeige — im Team-Bereich pflegbar)
      minPayoutThreshold: vars.MIN_PAYOUT_THRESHOLD,
      maxRetainedBalance: vars.MAX_RETAINED_BALANCE,
    };
    res.json({ ok: true, html, missing, variables, templateStatus: tpl ? tpl.status : null, templateVersion: tpl ? tpl.version : null });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] preview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Admin-Spiegel: Onboarding-Status eines Agenten (Zustimmung + Vertrag). */
router.get("/admin/agents/:id/onboarding", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = await computeOnboardingStatus(id);
    const consents = await sqlPool`
      SELECT doc_key, doc_version, accepted_at, ip FROM fiaon_agent_consents WHERE agent_id = ${id} ORDER BY accepted_at DESC
    `;
    const contracts = await sqlPool`
      SELECT id, template_version, signature_name, signature_mode, signed_at, doc_hash, status, ip,
             (pdf_base64 IS NOT NULL) AS has_pdf
      FROM fiaon_agent_contracts WHERE agent_id = ${id} ORDER BY signed_at DESC
    `;
    const statements = await sqlPool`
      SELECT id, statement_no, period_start, period_end, issued_at, gross_cents, net_cents, doc_hash,
             (pdf_base64 IS NOT NULL) AS has_pdf
      FROM fiaon_commission_statements WHERE agent_id = ${id} ORDER BY issued_at DESC
    `;
    res.json({ ok: true, status, consents, contracts, statements });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] admin onboarding:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Admin-Übersicht: Onboarding-Status ALLER Agenten (Team-Liste). */
router.get("/admin/onboarding-overview", async (_req, res) => {
  try {
    await ensureOnboardingTables();
    const agents = await sqlPool`SELECT id, name, email, active FROM fiaon_agents ORDER BY created_at ASC`;
    const active = await getActiveTemplate();
    const out = [];
    for (const a of agents) {
      const st = await computeOnboardingStatus(a.id);
      out.push({
        id: a.id, name: a.name, email: a.email, active: a.active,
        consentComplete: st.consent.complete,
        contractComplete: st.contract.complete,
        contractSignedAt: st.contract.signedAt,
        templateVersion: st.contract.templateVersion,
        complete: st.complete,
      });
    }
    res.json({ ok: true, data: out, activeTemplateVersion: active ? active.version : null });
  } catch (err) {
    console.error("[FIAON-ONBOARDING] overview:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/agents/:id/contract/:contractId.pdf", async (req, res) => {
  try {
    const rows = await sqlPool`SELECT pdf_base64, template_version FROM fiaon_agent_contracts WHERE id = ${Number(req.params.contractId)} AND agent_id = ${Number(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    await servePdf(res, rows[0].pdf_base64, `FIAON_Agent_Agreement_v${rows[0].template_version}.pdf`);
  } catch (err) {
    console.error("[FIAON-ONBOARDING] admin contract pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

router.get("/admin/agents/:id/statement/:sid.pdf", async (req, res) => {
  try {
    const rows = await sqlPool`SELECT pdf_base64, statement_no FROM fiaon_commission_statements WHERE id = ${Number(req.params.sid)} AND agent_id = ${Number(req.params.id)}`;
    if (rows.length === 0) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    await servePdf(res, rows[0].pdf_base64, `${rows[0].statement_no}.pdf`);
  } catch (err) {
    console.error("[FIAON-ONBOARDING] admin statement pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

/** Zustimmungsprotokoll als PDF (Nachweis für LEXR/Prüfung). */
router.get("/admin/agents/:id/consent-protocol.pdf", async (req, res) => {
  try {
    await ensureOnboardingTables();
    const id = Number(req.params.id);
    const agentRows = await sqlPool`SELECT id, name, email FROM fiaon_agents WHERE id = ${id}`;
    if (agentRows.length === 0) return res.status(404).json({ ok: false, error: "Agent nicht gefunden" });
    const agent = agentRows[0];
    const consents = await sqlPool`
      SELECT doc_key, doc_version, accepted_at, ip, user_agent FROM fiaon_agent_consents WHERE agent_id = ${id} ORDER BY accepted_at ASC
    `;
    const rowsHtml = consents.map((c: any) => {
      const doc = ONBOARDING_DOCS.find((d) => d.key === c.doc_key);
      return `<tr>
        <td>${escapeHtml(doc ? doc.title : c.doc_key)}</td>
        <td class="num">v${c.doc_version}</td>
        <td>${escapeHtml(formatBerlin(c.accepted_at))}</td>
        <td>${escapeHtml(c.ip || "—")}</td>
      </tr>`;
    }).join("");
    const body = `
      <div class="box">
        <div><strong>Agent:</strong> ${escapeHtml(agent.name)} (#${agent.id})</div>
        <div><strong>Email:</strong> ${escapeHtml(agent.email)}</div>
        <div class="muted" style="margin-top:4px;">Generated ${escapeHtml(formatBerlin(new Date()))} (Europe/Berlin)</div>
      </div>
      <h2>Recorded consents</h2>
      <table>
        <thead><tr><th>Document</th><th class="num">Version</th><th>Accepted (Berlin time)</th><th>IP</th></tr></thead>
        <tbody>${rowsHtml || `<tr><td colspan="4" class="muted">No consents recorded yet.</td></tr>`}</tbody>
      </table>
      <p class="muted" style="font-size:8pt;margin-top:12px;">System-generated audit record. Each consent is stored versioned; a change to any document requires renewed consent.</p>
    `;
    const pdf = await renderDocumentPdf({ documentTitle: "Consent Protocol", subtitle: `Agent #${agent.id} · ${escapeHtml(agent.email)}`, bodyHtml: body });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="FIAON_Consent_Protocol_${agent.id}.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("[FIAON-ONBOARDING] consent protocol pdf:", err);
    res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
