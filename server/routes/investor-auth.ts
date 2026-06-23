// ============================================================================
// SCHWARZOTT GROUP — INVESTOR BANKING AUTH & PORTAL
// ============================================================================
// Fully self-contained, isolated from the main user/passport auth system.
//  - scrypt password hashing
//  - stateless HMAC-signed session cookie (fiaon_investor_session)
//  - requireInvestor middleware
//  - portfolio / documents endpoints for the logged-in investor
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from "crypto";
import { client } from "../db";
import { logger } from "../logger";

const router = Router();

// ----------------------------------------------------------------------------
// Config
// ----------------------------------------------------------------------------
const COOKIE_NAME = "fiaon_investor_session";
const SESSION_SECRET =
  process.env.INVESTOR_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "fiaon-investor-dev-secret-local-only";
const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60; // 7 days
const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ----------------------------------------------------------------------------
// Password hashing (scrypt) — format: <hashHex>.<saltHex>
// ----------------------------------------------------------------------------
export function hashInvestorPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${hash}.${salt}`;
}

function verifyInvestorPassword(plain: string, stored: string): boolean {
  try {
    const [hashHex, salt] = stored.split(".");
    if (!hashHex || !salt) return false;
    const hashedBuf = Buffer.from(hashHex, "hex");
    const suppliedBuf = scryptSync(plain, salt, 64);
    return hashedBuf.length === suppliedBuf.length && timingSafeEqual(hashedBuf, suppliedBuf);
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// Signed session token (stateless, HMAC-SHA256)
// ----------------------------------------------------------------------------
interface InvestorSession {
  sub: string; // investor id
  email: string;
  name: string;
  iat: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signSession(payload: Omit<InvestorSession, "iat" | "exp">): string {
  const now = Math.floor(Date.now() / 1000);
  const full: InvestorSession = { ...payload, iat: now, exp: now + SESSION_MAX_AGE_S };
  const body = b64url(JSON.stringify(full));
  const sig = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySession(token: string | undefined): InvestorSession | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const session = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InvestorSession;
    if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}

function buildCookie(value: string, maxAge: number): string {
  return [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    IS_PRODUCTION ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

// ----------------------------------------------------------------------------
// Idempotent table setup (safe to run anytime; mirrors migration 031)
// ----------------------------------------------------------------------------
let tablesReady: Promise<void> | null = null;
export function ensureInvestorTables(): Promise<void> {
  if (tablesReady) return tablesReady;
  tablesReady = (async () => {
    await client`
      CREATE TABLE IF NOT EXISTS investors (
        id VARCHAR PRIMARY KEY,
        email VARCHAR NOT NULL UNIQUE,
        password_hash VARCHAR NOT NULL,
        salutation VARCHAR,
        first_name VARCHAR NOT NULL,
        last_name VARCHAR NOT NULL,
        phone VARCHAR,
        company VARCHAR,
        investor_type VARCHAR NOT NULL DEFAULT 'private',
        status VARCHAR NOT NULL DEFAULT 'active',
        street VARCHAR,
        zip VARCHAR,
        city VARCHAR,
        country VARCHAR DEFAULT 'Deutschland',
        iban VARCHAR,
        tax_id VARCHAR,
        notes TEXT,
        last_login_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investors_email_idx ON investors(email)`;
    await client`CREATE INDEX IF NOT EXISTS investors_status_idx ON investors(status)`;

    await client`
      CREATE TABLE IF NOT EXISTS investor_investments (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        name VARCHAR NOT NULL,
        investment_type VARCHAR NOT NULL DEFAULT 'fund',
        principal_cents BIGINT NOT NULL DEFAULT 0,
        current_value_cents BIGINT,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        interest_rate REAL,
        status VARCHAR NOT NULL DEFAULT 'active',
        start_date DATE,
        maturity_date DATE,
        payout_frequency VARCHAR DEFAULT 'yearly',
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_investments_investor_idx ON investor_investments(investor_id)`;

    await client`
      CREATE TABLE IF NOT EXISTS investor_transactions (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        investment_id INTEGER REFERENCES investor_investments(id) ON DELETE SET NULL,
        transaction_type VARCHAR NOT NULL DEFAULT 'interest',
        amount_cents BIGINT NOT NULL DEFAULT 0,
        currency VARCHAR(3) NOT NULL DEFAULT 'EUR',
        description VARCHAR,
        transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
        status VARCHAR NOT NULL DEFAULT 'completed',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_transactions_investor_idx ON investor_transactions(investor_id)`;

    await client`
      CREATE TABLE IF NOT EXISTS investor_documents (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        investment_id INTEGER REFERENCES investor_investments(id) ON DELETE SET NULL,
        title VARCHAR NOT NULL,
        document_type VARCHAR NOT NULL DEFAULT 'contract',
        file_name VARCHAR,
        mime_type VARCHAR,
        file_size INTEGER,
        file_data BYTEA,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_documents_investor_idx ON investor_documents(investor_id)`;

    // ---- tier (membership level): standard | premium | circle ----
    await client`ALTER TABLE investors ADD COLUMN IF NOT EXISTS tier VARCHAR NOT NULL DEFAULT 'standard'`;

    // ---- card orders ----
    await client`
      CREATE TABLE IF NOT EXISTS investor_card_orders (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        cardholder_name VARCHAR,
        card_design VARCHAR NOT NULL DEFAULT 'classic',
        status VARCHAR NOT NULL DEFAULT 'requested',
        price_cents BIGINT NOT NULL DEFAULT 49900,
        is_free BOOLEAN NOT NULL DEFAULT FALSE,
        shipping_street VARCHAR,
        shipping_zip VARCHAR,
        shipping_city VARCHAR,
        shipping_country VARCHAR DEFAULT 'Deutschland',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_card_orders_investor_idx ON investor_card_orders(investor_id)`;

    // ---- benefits (per-investor enabled perks) ----
    await client`
      CREATE TABLE IF NOT EXISTS investor_benefits (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        benefit_key VARCHAR NOT NULL,
        status VARCHAR NOT NULL DEFAULT 'active',
        note TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(investor_id, benefit_key)
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_benefits_investor_idx ON investor_benefits(investor_id)`;

    // ---- capital requests (deposit top-up / withdrawal) — all manually reviewed ----
    await client`
      CREATE TABLE IF NOT EXISTS investor_requests (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        investment_id INTEGER,
        request_type VARCHAR NOT NULL,
        amount_cents BIGINT,
        currency VARCHAR NOT NULL DEFAULT 'EUR',
        note TEXT,
        status VARCHAR NOT NULL DEFAULT 'pending',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_requests_investor_idx ON investor_requests(investor_id)`;

    // ---- demo flag (clearly marks the showcase / demo account) ----
    await client`ALTER TABLE investors ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE`;

    // ---- token investments (e.g. ARAS Token) — quantity + dual price ----
    await client`ALTER TABLE investor_investments ADD COLUMN IF NOT EXISTS token_quantity NUMERIC(20,6)`;
    await client`ALTER TABLE investor_investments ADD COLUMN IF NOT EXISTS token_purchase_price_cents BIGINT`;
    await client`ALTER TABLE investor_investments ADD COLUMN IF NOT EXISTS token_current_price_cents BIGINT`;
    // token_meta: per-investment contract metadata (allocation breakdown, contract ref, wallet, blockchain, …)
    await client`ALTER TABLE investor_investments ADD COLUMN IF NOT EXISTS token_meta JSONB`;

    // ---- benefit activity (bookings, consultations, cancellations) — all tracked ----
    await client`
      CREATE TABLE IF NOT EXISTS investor_benefit_activity (
        id SERIAL PRIMARY KEY,
        investor_id VARCHAR NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
        benefit_key VARCHAR NOT NULL,
        kind VARCHAR NOT NULL DEFAULT 'request',
        title VARCHAR NOT NULL,
        details TEXT,
        status VARCHAR NOT NULL DEFAULT 'requested',
        scheduled_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await client`CREATE INDEX IF NOT EXISTS investor_benefit_activity_idx ON investor_benefit_activity(investor_id, benefit_key)`;

    logger.info?.("[INVESTOR] Tables ready");
  })().catch((err) => {
    tablesReady = null; // allow retry on next call
    throw err;
  });
  return tablesReady;
}

// ----------------------------------------------------------------------------
// requireInvestor middleware — attaches req.investor
// ----------------------------------------------------------------------------
export interface InvestorRequest extends Request {
  investor?: { id: string; email: string; name: string };
}

export function requireInvestor(req: InvestorRequest, res: Response, next: NextFunction) {
  const token = (req as any).cookies?.[COOKIE_NAME];
  const session = verifySession(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: "Nicht angemeldet" });
  }
  req.investor = { id: session.sub, email: session.email, name: session.name };
  next();
}

// ============================================================================
// POST /api/investor/login
// ============================================================================
router.post("/login", async (req: Request, res: Response) => {
  try {
    await ensureInvestorTables();
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "E-Mail und Passwort erforderlich" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [investor] = await client`
      SELECT * FROM investors WHERE LOWER(email) = ${normalizedEmail} LIMIT 1
    `;

    // Constant-ish time: still run a verify even if not found
    const storedHash = investor?.password_hash || "0".repeat(128) + "." + "0".repeat(32);
    const passwordValid = verifyInvestorPassword(String(password), storedHash);

    if (!investor || !passwordValid) {
      return res.status(401).json({ ok: false, error: "Ungültige Anmeldedaten" });
    }

    if (investor.status === "inactive") {
      return res.status(403).json({ ok: false, error: "Dieser Zugang ist deaktiviert. Bitte kontaktieren Sie Ihren Betreuer." });
    }

    await client`UPDATE investors SET last_login_at = NOW() WHERE id = ${investor.id}`;

    const name = `${investor.first_name} ${investor.last_name}`.trim();
    const token = signSession({ sub: investor.id, email: investor.email, name });
    res.setHeader("Set-Cookie", buildCookie(token, SESSION_MAX_AGE_S));

    return res.json({
      ok: true,
      investor: {
        id: investor.id,
        email: investor.email,
        firstName: investor.first_name,
        lastName: investor.last_name,
        salutation: investor.salutation,
      },
    });
  } catch (err) {
    logger.error("[INVESTOR-LOGIN] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// POST /api/investor/logout
// ============================================================================
router.post("/logout", (_req: Request, res: Response) => {
  res.setHeader("Set-Cookie", buildCookie("", 0));
  return res.json({ ok: true });
});

// ============================================================================
// GET /api/investor/me — current investor profile
// ============================================================================
router.get("/me", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const [investor] = await client`
      SELECT id, email, salutation, first_name, last_name, phone, company,
             investor_type, tier, status, street, zip, city, country, iban, tax_id,
             is_demo, last_login_at, created_at
      FROM investors WHERE id = ${req.investor!.id} LIMIT 1
    `;
    if (!investor) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    return res.json({ ok: true, investor });
  } catch (err) {
    logger.error("[INVESTOR-ME] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// GET /api/investor/portfolio — investments + transactions + documents + KPIs
// ============================================================================
router.get("/portfolio", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;

    const investments = await client`
      SELECT * FROM investor_investments
      WHERE investor_id = ${investorId}
      ORDER BY status ASC, created_at DESC
    `;

    const transactions = await client`
      SELECT * FROM investor_transactions
      WHERE investor_id = ${investorId}
      ORDER BY transaction_date DESC, created_at DESC
      LIMIT 200
    `;

    const documents = await client`
      SELECT id, investment_id, title, document_type, file_name, mime_type, file_size, created_at
      FROM investor_documents
      WHERE investor_id = ${investorId}
      ORDER BY created_at DESC
    `;

    // ---- KPIs ----
    let totalInvested = 0;
    let currentValue = 0;
    let weightedYieldNum = 0;
    let weightedYieldDen = 0;
    let activeCount = 0;

    // Only count completed deposit transactions as confirmed capital
    const confirmedDeposits: Record<number, number> = {};
    for (const tx of transactions) {
      if (tx.status !== "completed" || tx.transaction_type !== "deposit" || !tx.investment_id) continue;
      const invId = Number(tx.investment_id);
      confirmedDeposits[invId] = (confirmedDeposits[invId] || 0) + (Number(tx.amount_cents) || 0);
    }

    for (const inv of investments) {
      if (inv.status !== "active") continue;
      activeCount += 1;

      // Token investments (e.g. ARAS Token) are confirmed by allocation, not by a deposit
      // booking: use their explicit principal (capital invested) and live market value.
      if (inv.investment_type === "token") {
        const tokenPrincipal = Number(inv.principal_cents) || 0;
        const tokenValue = inv.current_value_cents != null ? Number(inv.current_value_cents) : tokenPrincipal;
        totalInvested += tokenPrincipal;
        currentValue += tokenValue;
        continue;
      }

      const confirmedPrincipal = confirmedDeposits[Number(inv.id)] || 0;
      totalInvested += confirmedPrincipal;
      currentValue += confirmedPrincipal;
      if (inv.interest_rate != null && confirmedPrincipal > 0) {
        weightedYieldNum += Number(inv.interest_rate) * confirmedPrincipal;
        weightedYieldDen += confirmedPrincipal;
      }
    }

    let totalReturns = 0;
    for (const tx of transactions) {
      if (tx.status !== "completed") continue;
      const amt = Number(tx.amount_cents) || 0;
      if (tx.transaction_type === "interest" || tx.transaction_type === "payout") {
        totalReturns += amt;
      }
    }

    const avgYield = weightedYieldDen > 0 ? weightedYieldNum / weightedYieldDen : 0;
    const unrealizedGain = currentValue - totalInvested;

    return res.json({
      ok: true,
      investments,
      transactions,
      documents,
      summary: {
        totalInvestedCents: totalInvested,
        currentValueCents: currentValue,
        totalReturnsCents: totalReturns,
        unrealizedGainCents: unrealizedGain,
        avgYieldPct: Math.round(avgYield * 100) / 100,
        activeCount,
        currency: "EUR",
      },
    });
  } catch (err) {
    logger.error("[INVESTOR-PORTFOLIO] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// GET /api/investor/documents/:id/download — stream a document the investor owns
// ============================================================================
router.get("/documents/:id/download", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Ungültige ID" });

    const [doc] = await client`
      SELECT title, file_name, mime_type, file_data
      FROM investor_documents
      WHERE id = ${id} AND investor_id = ${req.investor!.id}
      LIMIT 1
    `;
    if (!doc || !doc.file_data) {
      return res.status(404).json({ ok: false, error: "Dokument nicht gefunden" });
    }

    const buffer = Buffer.isBuffer(doc.file_data) ? doc.file_data : Buffer.from(doc.file_data);
    const safeName = (doc.file_name || doc.title || "dokument").replace(/[^\w.\-]/g, "_");
    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", String(buffer.length));
    return res.end(buffer);
  } catch (err) {
    logger.error("[INVESTOR-DOC-DOWNLOAD] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// CARD — pricing helper
// ============================================================================
const CARD_PRICE_CENTS = 49900; // 499,00 €

// ============================================================================
// GET /api/investor/card — current card order + eligibility/pricing
// ============================================================================
router.get("/card", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const [investor] = await client`SELECT tier FROM investors WHERE id = ${investorId} LIMIT 1`;
    const tier = investor?.tier || "standard";
    const isFree = tier === "circle";

    const [order] = await client`
      SELECT * FROM investor_card_orders
      WHERE investor_id = ${investorId}
      ORDER BY created_at DESC LIMIT 1
    `;

    return res.json({
      ok: true,
      tier,
      pricing: { priceCents: CARD_PRICE_CENTS, isFree, currency: "EUR" },
      order: order || null,
    });
  } catch (err) {
    logger.error("[INVESTOR-CARD-GET] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// POST /api/investor/card — order a card
// ============================================================================
router.post("/card", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const { cardholderName, cardDesign, shippingStreet, shippingZip, shippingCity, shippingCountry } = req.body ?? {};

    const [investor] = await client`SELECT tier FROM investors WHERE id = ${investorId} LIMIT 1`;
    const tier = investor?.tier || "standard";
    const isFree = tier === "circle";

    // Prevent duplicate active orders
    const [active] = await client`
      SELECT id FROM investor_card_orders
      WHERE investor_id = ${investorId} AND status NOT IN ('cancelled')
      ORDER BY created_at DESC LIMIT 1
    `;
    if (active) {
      return res.status(409).json({ ok: false, error: "Es liegt bereits eine Kartenbestellung vor." });
    }

    const design = ["classic", "gold", "circle"].includes(cardDesign) ? cardDesign : (tier === "circle" ? "circle" : "classic");

    const [order] = await client`
      INSERT INTO investor_card_orders (
        investor_id, cardholder_name, card_design, status, price_cents, is_free,
        shipping_street, shipping_zip, shipping_city, shipping_country
      ) VALUES (
        ${investorId}, ${cardholderName ?? req.investor!.name}, ${design}, 'requested',
        ${isFree ? 0 : CARD_PRICE_CENTS}, ${isFree},
        ${shippingStreet ?? null}, ${shippingZip ?? null}, ${shippingCity ?? null}, ${shippingCountry ?? "Deutschland"}
      ) RETURNING *
    `;
    return res.status(201).json({ ok: true, order });
  } catch (err) {
    logger.error("[INVESTOR-CARD-POST] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// GET /api/investor/benefits — enabled perks for this investor
// ============================================================================
router.get("/benefits", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const [investor] = await client`SELECT tier FROM investors WHERE id = ${investorId} LIMIT 1`;
    const benefits = await client`
      SELECT benefit_key, status, note FROM investor_benefits
      WHERE investor_id = ${investorId}
      ORDER BY created_at ASC
    `;
    return res.json({ ok: true, tier: investor?.tier || "standard", benefits });
  } catch (err) {
    logger.error("[INVESTOR-BENEFITS] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// PUT /api/investor/profile — update own contact details
// ============================================================================
router.put("/profile", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const { salutation, phone, street, zip, city, country } = req.body ?? {};
    const [updated] = await client`
      UPDATE investors SET
        salutation = COALESCE(${salutation ?? null}, salutation),
        phone      = ${phone ?? null},
        street     = ${street ?? null},
        zip        = ${zip ?? null},
        city       = ${city ?? null},
        country    = COALESCE(${country ?? null}, country)
      WHERE id = ${investorId}
      RETURNING id, email, salutation, first_name, last_name, phone, company,
                investor_type, tier, status, street, zip, city, country, iban, tax_id
    `;
    if (!updated) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    return res.json({ ok: true, investor: updated });
  } catch (err) {
    logger.error("[INVESTOR-PROFILE] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// POST /api/investor/change-password — change own password
// ============================================================================
router.post("/change-password", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ ok: false, error: "Aktuelles und neues Passwort erforderlich" });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ ok: false, error: "Das neue Passwort muss mindestens 8 Zeichen lang sein" });
    }
    const [investor] = await client`SELECT password_hash FROM investors WHERE id = ${investorId} LIMIT 1`;
    if (!investor) return res.status(404).json({ ok: false, error: "Nicht gefunden" });
    if (!verifyInvestorPassword(String(currentPassword), investor.password_hash)) {
      return res.status(403).json({ ok: false, error: "Das aktuelle Passwort ist nicht korrekt" });
    }
    const newHash = hashInvestorPassword(String(newPassword));
    await client`UPDATE investors SET password_hash = ${newHash} WHERE id = ${investorId}`;
    return res.json({ ok: true });
  } catch (err) {
    logger.error("[INVESTOR-CHANGE-PW] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// GET /api/investor/requests — list own capital requests
// ============================================================================
router.get("/requests", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const rows = await client`
      SELECT id, investment_id, request_type, amount_cents, currency, note, status, created_at
      FROM investor_requests WHERE investor_id = ${req.investor!.id}
      ORDER BY created_at DESC LIMIT 100
    `;
    return res.json({ ok: true, requests: rows });
  } catch (err) {
    logger.error("[INVESTOR-REQUESTS-LIST] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// POST /api/investor/requests — submit a deposit top-up or withdrawal request
//   Nothing is executed automatically — every request is reviewed by staff.
// ============================================================================
router.post("/requests", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const { requestType, investmentId, amountCents, note } = req.body ?? {};
    if (requestType !== "deposit" && requestType !== "withdrawal") {
      return res.status(400).json({ ok: false, error: "Ungültiger Anfragetyp" });
    }
    const amount = Number(amountCents);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: "Bitte einen gültigen Betrag angeben" });
    }
    const [request] = await client`
      INSERT INTO investor_requests (investor_id, investment_id, request_type, amount_cents, currency, note, status)
      VALUES (
        ${investorId}, ${investmentId ? Number(investmentId) : null}, ${requestType},
        ${Math.round(amount)}, 'EUR', ${note ?? null}, 'pending'
      )
      RETURNING id, investment_id, request_type, amount_cents, currency, note, status, created_at
    `;
    return res.status(201).json({ ok: true, request });
  } catch (err) {
    logger.error("[INVESTOR-REQUESTS-CREATE] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// ============================================================================
// BENEFIT ACTIVITY — bookings, consultations, cancellations (all tracked)
// ============================================================================
const VALID_BENEFIT_KEYS = [
  "relationship", "consulting", "card", "flights", "insurance",
  "legal", "tax", "concierge", "realestate", "events",
];

// GET /api/investor/benefits/:key/activity — history for one benefit
router.get("/benefits/:key/activity", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const key = String(req.params.key);
    if (!VALID_BENEFIT_KEYS.includes(key)) {
      return res.status(400).json({ ok: false, error: "Unbekannte Leistung" });
    }
    // Must have the benefit enabled
    const [enabled] = await client`
      SELECT 1 FROM investor_benefits WHERE investor_id = ${investorId} AND benefit_key = ${key} LIMIT 1
    `;
    if (!enabled) {
      return res.status(403).json({ ok: false, error: "Diese Leistung ist für Sie nicht freigeschaltet" });
    }
    const rows = await client`
      SELECT id, benefit_key, kind, title, details, status, scheduled_at, created_at
      FROM investor_benefit_activity
      WHERE investor_id = ${investorId} AND benefit_key = ${key}
      ORDER BY COALESCE(scheduled_at, created_at) DESC, created_at DESC
      LIMIT 100
    `;
    return res.json({ ok: true, activity: rows });
  } catch (err) {
    logger.error("[INVESTOR-BENEFIT-ACTIVITY-LIST] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// POST /api/investor/benefits/:key/activity — create a booking / consultation / request
//   Nothing is executed automatically — every request is reviewed by staff.
router.post("/benefits/:key/activity", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const key = String(req.params.key);
    if (!VALID_BENEFIT_KEYS.includes(key)) {
      return res.status(400).json({ ok: false, error: "Unbekannte Leistung" });
    }
    const [enabled] = await client`
      SELECT 1 FROM investor_benefits WHERE investor_id = ${investorId} AND benefit_key = ${key} LIMIT 1
    `;
    if (!enabled) {
      return res.status(403).json({ ok: false, error: "Diese Leistung ist für Sie nicht freigeschaltet" });
    }
    const { kind, title, details, scheduledAt } = req.body ?? {};
    if (!title || String(title).trim().length === 0) {
      return res.status(400).json({ ok: false, error: "Bitte geben Sie einen Betreff an" });
    }
    const [row] = await client`
      INSERT INTO investor_benefit_activity (investor_id, benefit_key, kind, title, details, status, scheduled_at)
      VALUES (
        ${investorId}, ${key}, ${kind ? String(kind) : "request"},
        ${String(title).trim()}, ${details ? String(details) : null},
        'requested', ${scheduledAt ? new Date(scheduledAt) : null}
      )
      RETURNING id, benefit_key, kind, title, details, status, scheduled_at, created_at
    `;
    logger.info?.(`[INVESTOR-BENEFIT-ACTIVITY] ${investorId} requested ${key}: ${title}`);
    return res.status(201).json({ ok: true, activity: row });
  } catch (err) {
    logger.error("[INVESTOR-BENEFIT-ACTIVITY-CREATE] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// POST /api/investor/benefit-activity/:id/cancel — cancel an own request
router.post("/benefit-activity/:id/cancel", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Ungültige ID" });
    const [row] = await client`
      UPDATE investor_benefit_activity
      SET status = 'cancelled', updated_at = NOW()
      WHERE id = ${id} AND investor_id = ${investorId} AND status IN ('requested', 'confirmed')
      RETURNING id, benefit_key, kind, title, details, status, scheduled_at, created_at
    `;
    if (!row) return res.status(404).json({ ok: false, error: "Nicht stornierbar" });
    return res.json({ ok: true, activity: row });
  } catch (err) {
    logger.error("[INVESTOR-BENEFIT-ACTIVITY-CANCEL] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

// POST /api/investor/benefit-activity/:id/respond — accept or decline a staff proposal
//   A 'proposed' booking is only finalised once the investor explicitly accepts it.
router.post("/benefit-activity/:id/respond", requireInvestor, async (req: InvestorRequest, res: Response) => {
  try {
    const investorId = req.investor!.id;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: "Ungültige ID" });
    const action = String(req.body?.action || "");
    if (action !== "accept" && action !== "decline") {
      return res.status(400).json({ ok: false, error: "Ungültige Aktion" });
    }
    const newStatus = action === "accept" ? "confirmed" : "declined";
    const [row] = await client`
      UPDATE investor_benefit_activity
      SET status = ${newStatus}, updated_at = NOW()
      WHERE id = ${id} AND investor_id = ${investorId} AND status = 'proposed'
      RETURNING id, benefit_key, kind, title, details, status, scheduled_at, created_at
    `;
    if (!row) return res.status(404).json({ ok: false, error: "Vorschlag nicht gefunden oder bereits bearbeitet" });
    logger.info?.(`[INVESTOR-BENEFIT-ACTIVITY] ${investorId} ${action}ed proposal ${id} (${row.benefit_key})`);
    return res.json({ ok: true, activity: row });
  } catch (err) {
    logger.error("[INVESTOR-BENEFIT-ACTIVITY-RESPOND] error", err);
    return res.status(500).json({ ok: false, error: "Serverfehler" });
  }
});

export default router;
