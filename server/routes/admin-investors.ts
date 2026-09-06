// ============================================================================
// SCHWARZOTT GROUP — INVESTOR BANKING (ADMIN MANAGEMENT)
// ============================================================================
// Full CRUD for investors, their investments, transactions and documents.
// Mounted at /api/admin/investors — protected by adminAccess (token OR session),
// mirroring the security model of the rest of the admin section.
// ============================================================================

import { Router, Request, Response, NextFunction } from "express";
import multer from "multer";
import { randomBytes } from "crypto";
import { client } from "../db";
import { logger } from "../logger";
import { adminZugriff } from "../lib/fiaon-admin-wache";
import { ensureInvestorTables, hashInvestorPassword } from "./investor-auth";

const router = Router();

// ----------------------------------------------------------------------------
// Admin access (same model as admin-accounting): static token OR logged-in admin
// ----------------------------------------------------------------------------
// 06.09.2026: kein festes Kennwort mehr im Quelltext — Admin-Code, Chef-Token „inhaber“ oder ADMIN_TOKEN
// aus der Umgebung. Siehe lib/fiaon-admin-wache.ts.
router.use(adminZugriff);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max per document
});

function genInvestorId(): string {
  return `INV-${randomBytes(5).toString("hex").toUpperCase()}`;
}

// ============================================================================
// GET /api/admin/investors — list with aggregated KPIs per investor
// ============================================================================
router.get("/", async (_req, res) => {
  try {
    await ensureInvestorTables();
    const rows = await client`
      SELECT
        i.id, i.email, i.salutation, i.first_name, i.last_name, i.phone, i.company,
        i.investor_type, i.tier, i.status, i.last_login_at, i.created_at,
        COALESCE(SUM(CASE WHEN inv.status = 'active' THEN inv.principal_cents ELSE 0 END), 0) AS total_invested_cents,
        COALESCE(SUM(CASE WHEN inv.status = 'active' THEN COALESCE(inv.current_value_cents, inv.principal_cents) ELSE 0 END), 0) AS current_value_cents,
        COUNT(DISTINCT inv.id) FILTER (WHERE inv.status = 'active') AS active_investments
      FROM investors i
      LEFT JOIN investor_investments inv ON inv.investor_id = i.id
      GROUP BY i.id
      ORDER BY i.created_at DESC
    `;
    res.json({ ok: true, investors: rows });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] list error", err);
    res.status(500).json({ ok: false, error: "Failed to load investors" });
  }
});

// ============================================================================
// POST /api/admin/investors — create investor
// ============================================================================
router.post("/", async (req, res) => {
  try {
    await ensureInvestorTables();
    const {
      email, password, salutation, firstName, lastName, phone, company,
      investorType = "private", tier = "standard", status = "active",
      street, zip, city, country, iban, taxId, notes,
    } = req.body ?? {};

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ ok: false, error: "E-Mail, Passwort, Vor- und Nachname sind erforderlich" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ ok: false, error: "Passwort muss mindestens 6 Zeichen haben" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [existing] = await client`SELECT id FROM investors WHERE LOWER(email) = ${normalizedEmail} LIMIT 1`;
    if (existing) {
      return res.status(409).json({ ok: false, error: "Ein Investor mit dieser E-Mail existiert bereits" });
    }

    const id = genInvestorId();
    const passwordHash = hashInvestorPassword(String(password));

    const validTier = ["standard", "premium", "circle"].includes(tier) ? tier : "standard";
    const [investor] = await client`
      INSERT INTO investors (
        id, email, password_hash, salutation, first_name, last_name, phone, company,
        investor_type, tier, status, street, zip, city, country, iban, tax_id, notes
      ) VALUES (
        ${id}, ${normalizedEmail}, ${passwordHash}, ${salutation ?? null}, ${firstName}, ${lastName},
        ${phone ?? null}, ${company ?? null}, ${investorType}, ${validTier}, ${status},
        ${street ?? null}, ${zip ?? null}, ${city ?? null}, ${country ?? "Deutschland"},
        ${iban ?? null}, ${taxId ?? null}, ${notes ?? null}
      )
      RETURNING id, email, first_name, last_name, tier, status, created_at
    `;

    res.status(201).json({ ok: true, investor });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] create error", err);
    res.status(500).json({ ok: false, error: "Failed to create investor" });
  }
});

// ============================================================================
// GET /api/admin/investors/:id — full detail
// ============================================================================
router.get("/:id", async (req, res) => {
  try {
    await ensureInvestorTables();
    const { id } = req.params;

    const [investor] = await client`SELECT * FROM investors WHERE id = ${id} LIMIT 1`;
    if (!investor) return res.status(404).json({ ok: false, error: "Investor nicht gefunden" });
    delete (investor as any).password_hash;

    const investments = await client`
      SELECT * FROM investor_investments WHERE investor_id = ${id}
      ORDER BY created_at DESC
    `;
    const transactions = await client`
      SELECT * FROM investor_transactions WHERE investor_id = ${id}
      ORDER BY transaction_date DESC, created_at DESC
    `;
    const documents = await client`
      SELECT id, investment_id, title, document_type, file_name, mime_type, file_size, created_at
      FROM investor_documents WHERE investor_id = ${id}
      ORDER BY created_at DESC
    `;
    const cardOrders = await client`
      SELECT * FROM investor_card_orders WHERE investor_id = ${id}
      ORDER BY created_at DESC
    `;
    const benefits = await client`
      SELECT benefit_key, status, note FROM investor_benefits WHERE investor_id = ${id}
      ORDER BY created_at ASC
    `;
    const benefitActivity = await client`
      SELECT id, benefit_key, kind, title, details, status, scheduled_at, created_at
      FROM investor_benefit_activity WHERE investor_id = ${id}
      ORDER BY COALESCE(scheduled_at, created_at) DESC, created_at DESC
    `;
    const requests = await client`
      SELECT id, investment_id, request_type, amount_cents, currency, note, status, created_at
      FROM investor_requests WHERE investor_id = ${id}
      ORDER BY created_at DESC
    `;

    res.json({ ok: true, investor, investments, transactions, documents, cardOrders, benefits, benefitActivity, requests });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] detail error", err);
    res.status(500).json({ ok: false, error: "Failed to load investor" });
  }
});

// ============================================================================
// PATCH /api/admin/investors/:id — update profile
// ============================================================================
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const map: Record<string, string> = {
      salutation: "salutation", firstName: "first_name", lastName: "last_name",
      phone: "phone", company: "company", investorType: "investor_type", tier: "tier", status: "status",
      street: "street", zip: "zip", city: "city", country: "country",
      iban: "iban", taxId: "tax_id", notes: "notes", email: "email",
    };
    const updates: Record<string, any> = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in req.body) updates[col] = req.body[k] === "" ? null : req.body[k];
    }
    if (updates.email) updates.email = String(updates.email).trim().toLowerCase();
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "Keine gültigen Felder" });
    }

    const cols = Object.keys(updates);
    const [investor] = await client`
      UPDATE investors SET ${client(updates, ...cols)}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, email, first_name, last_name, status
    `;
    if (!investor) return res.status(404).json({ ok: false, error: "Investor nicht gefunden" });
    res.json({ ok: true, investor });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] update error", err);
    res.status(500).json({ ok: false, error: "Failed to update investor" });
  }
});

// ============================================================================
// POST /api/admin/investors/:id/password — reset password
// ============================================================================
router.post("/:id/password", async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body ?? {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({ ok: false, error: "Passwort muss mindestens 6 Zeichen haben" });
    }
    const hash = hashInvestorPassword(String(password));
    const [investor] = await client`
      UPDATE investors SET password_hash = ${hash}, updated_at = NOW()
      WHERE id = ${id} RETURNING id
    `;
    if (!investor) return res.status(404).json({ ok: false, error: "Investor nicht gefunden" });
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] password reset error", err);
    res.status(500).json({ ok: false, error: "Failed to reset password" });
  }
});

// ============================================================================
// DELETE /api/admin/investors/:id — delete investor (cascade)
// ============================================================================
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await client`DELETE FROM investors WHERE id = ${id}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] delete error", err);
    res.status(500).json({ ok: false, error: "Failed to delete investor" });
  }
});

// ============================================================================
// INVESTMENTS
// ============================================================================
router.post("/:id/investments", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, investmentType = "fund", principalCents = 0, currentValueCents,
      currency = "EUR", interestRate, status = "active",
      startDate, maturityDate, payoutFrequency = "yearly", description,
      tokenQuantity, tokenPurchasePriceCents, tokenCurrentPriceCents,
      investmentAmountCents, tokenMeta,
    } = req.body ?? {};
    if (!name) return res.status(400).json({ ok: false, error: "Name ist erforderlich" });

    let finalPrincipalCents = Number(principalCents) || 0;
    let finalCurrentValueCents = currentValueCents == null || currentValueCents === "" ? null : Number(currentValueCents);
    const qty = tokenQuantity != null && tokenQuantity !== "" ? Number(tokenQuantity) : null;
    const buyPrice = tokenPurchasePriceCents != null && tokenPurchasePriceCents !== "" ? Number(tokenPurchasePriceCents) : null;
    const curPrice = tokenCurrentPriceCents != null && tokenCurrentPriceCents !== "" ? Number(tokenCurrentPriceCents) : null;
    const explicitAmount = investmentAmountCents != null && investmentAmountCents !== "" ? Number(investmentAmountCents) : null;

    // Token investments: principal = capital actually invested (explicit, accounts for bonus tokens);
    // falls back to quantity × purchase price. Current value always tracks quantity × current price.
    if (investmentType === "token") {
      if (explicitAmount != null) finalPrincipalCents = explicitAmount;
      else if (qty != null && buyPrice != null) finalPrincipalCents = Math.round(qty * buyPrice);
      if (qty != null && curPrice != null) finalCurrentValueCents = Math.round(qty * curPrice);
    }
    const metaJson = tokenMeta != null ? JSON.stringify(tokenMeta) : null;

    const [investment] = await client`
      INSERT INTO investor_investments (
        investor_id, name, investment_type, principal_cents, current_value_cents,
        currency, interest_rate, status, start_date, maturity_date, payout_frequency, description,
        token_quantity, token_purchase_price_cents, token_current_price_cents, token_meta
      ) VALUES (
        ${id}, ${name}, ${investmentType}, ${finalPrincipalCents},
        ${finalCurrentValueCents},
        ${currency}, ${interestRate == null || interestRate === "" ? null : Number(interestRate)},
        ${status}, ${startDate || null}, ${maturityDate || null}, ${payoutFrequency}, ${description ?? null},
        ${qty}, ${buyPrice}, ${curPrice}, ${metaJson}
      ) RETURNING *
    `;
    res.status(201).json({ ok: true, investment });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] create investment error", err);
    res.status(500).json({ ok: false, error: "Failed to create investment" });
  }
});

router.patch("/:id/investments/:invId", async (req, res) => {
  try {
    const { invId } = req.params;
    const map: Record<string, string> = {
      name: "name", investmentType: "investment_type", principalCents: "principal_cents",
      investmentAmountCents: "principal_cents",
      currentValueCents: "current_value_cents", currency: "currency", interestRate: "interest_rate",
      status: "status", startDate: "start_date", maturityDate: "maturity_date",
      payoutFrequency: "payout_frequency", description: "description",
      tokenQuantity: "token_quantity", tokenPurchasePriceCents: "token_purchase_price_cents",
      tokenCurrentPriceCents: "token_current_price_cents",
    };
    const numeric = new Set(["principal_cents", "current_value_cents", "interest_rate", "token_quantity", "token_purchase_price_cents", "token_current_price_cents"]);
    const updates: Record<string, any> = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in req.body) {
        let v = req.body[k];
        if (v === "" || v === null) v = null;
        else if (numeric.has(col)) v = Number(v);
        updates[col] = v;
      }
    }
    // token_meta (JSONB) — stored as-is
    if ("tokenMeta" in req.body) {
      updates["token_meta"] = req.body.tokenMeta != null ? JSON.stringify(req.body.tokenMeta) : null;
    }

    // For token investments, always keep current value = quantity × current price in sync.
    // Principal is the explicit invested capital (accounts for bonus tokens) and is only
    // changed when the admin sends an explicit amount.
    const qty = updates["token_quantity"] ?? null;
    const curP = updates["token_current_price_cents"] ?? null;
    if (qty != null || curP != null) {
      const [existing] = await client`SELECT investment_type, token_quantity, token_current_price_cents FROM investor_investments WHERE id = ${Number(invId)}`;
      if (existing && (existing.investment_type === "token" || updates["investment_type"] === "token")) {
        const q = qty ?? (existing.token_quantity != null ? Number(existing.token_quantity) : null);
        const cp = curP ?? (existing.token_current_price_cents != null ? Number(existing.token_current_price_cents) : null);
        if (q != null && cp != null) updates["current_value_cents"] = Math.round(q * cp);
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "Keine gültigen Felder" });
    }
    const cols = Object.keys(updates);
    const [investment] = await client`
      UPDATE investor_investments SET ${client(updates, ...cols)}, updated_at = NOW()
      WHERE id = ${Number(invId)} RETURNING *
    `;
    if (!investment) return res.status(404).json({ ok: false, error: "Investment nicht gefunden" });
    res.json({ ok: true, investment });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] update investment error", err);
    res.status(500).json({ ok: false, error: "Failed to update investment" });
  }
});

router.delete("/:id/investments/:invId", async (req, res) => {
  try {
    const { invId } = req.params;
    await client`DELETE FROM investor_investments WHERE id = ${Number(invId)}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] delete investment error", err);
    res.status(500).json({ ok: false, error: "Failed to delete investment" });
  }
});

// ============================================================================
// TRANSACTIONS (Rendite-Historie)
// ============================================================================
router.post("/:id/transactions", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      investmentId, transactionType = "interest", amountCents = 0,
      currency = "EUR", description, transactionDate, status = "completed",
    } = req.body ?? {};

    const [transaction] = await client`
      INSERT INTO investor_transactions (
        investor_id, investment_id, transaction_type, amount_cents, currency,
        description, transaction_date, status
      ) VALUES (
        ${id}, ${investmentId == null || investmentId === "" ? null : Number(investmentId)},
        ${transactionType}, ${Number(amountCents) || 0}, ${currency},
        ${description ?? null}, ${transactionDate || new Date().toISOString().split("T")[0]}, ${status}
      ) RETURNING *
    `;
    res.status(201).json({ ok: true, transaction });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] create transaction error", err);
    res.status(500).json({ ok: false, error: "Failed to create transaction" });
  }
});

router.put("/:id/transactions/:txId", async (req, res) => {
  try {
    const { txId } = req.params;
    const { status, description, transactionDate, amountCents } = req.body ?? {};
    const [tx] = await client`
      UPDATE investor_transactions SET
        status           = COALESCE(${status ?? null}, status),
        description      = COALESCE(${description ?? null}, description),
        transaction_date = COALESCE(${transactionDate ?? null}, transaction_date),
        amount_cents     = COALESCE(${amountCents ?? null}, amount_cents)
      WHERE id = ${Number(txId)}
      RETURNING *
    `;
    res.json({ ok: true, transaction: tx });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] update transaction error", err);
    res.status(500).json({ ok: false, error: "Failed to update transaction" });
  }
});

router.delete("/:id/transactions/:txId", async (req, res) => {
  try {
    const { txId } = req.params;
    await client`DELETE FROM investor_transactions WHERE id = ${Number(txId)}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] delete transaction error", err);
    res.status(500).json({ ok: false, error: "Failed to delete transaction" });
  }
});

// ============================================================================
// DOCUMENTS (Verträge & co.)
// ============================================================================
router.post("/:id/documents", upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, documentType = "contract", investmentId } = req.body ?? {};
    const file = (req as any).file as Express.Multer.File | undefined;
    if (!title) return res.status(400).json({ ok: false, error: "Titel ist erforderlich" });
    if (!file) return res.status(400).json({ ok: false, error: "Datei ist erforderlich" });

    const [doc] = await client`
      INSERT INTO investor_documents (
        investor_id, investment_id, title, document_type, file_name, mime_type, file_size, file_data
      ) VALUES (
        ${id}, ${investmentId == null || investmentId === "" ? null : Number(investmentId)},
        ${title}, ${documentType}, ${file.originalname}, ${file.mimetype}, ${file.size}, ${file.buffer}
      )
      RETURNING id, title, document_type, file_name, mime_type, file_size, created_at
    `;
    res.status(201).json({ ok: true, document: doc });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] upload document error", err);
    res.status(500).json({ ok: false, error: "Failed to upload document" });
  }
});

router.get("/:id/documents/:docId/download", async (req, res) => {
  try {
    const { docId } = req.params;
    const [doc] = await client`
      SELECT title, file_name, mime_type, file_data FROM investor_documents WHERE id = ${Number(docId)} LIMIT 1
    `;
    if (!doc || !doc.file_data) return res.status(404).json({ ok: false, error: "Dokument nicht gefunden" });
    const buffer = Buffer.isBuffer(doc.file_data) ? doc.file_data : Buffer.from(doc.file_data);
    const safeName = (doc.file_name || doc.title || "dokument").replace(/[^\w.\-]/g, "_");
    res.setHeader("Content-Type", doc.mime_type || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.end(buffer);
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] download document error", err);
    res.status(500).json({ ok: false, error: "Failed to download document" });
  }
});

router.delete("/:id/documents/:docId", async (req, res) => {
  try {
    const { docId } = req.params;
    await client`DELETE FROM investor_documents WHERE id = ${Number(docId)}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] delete document error", err);
    res.status(500).json({ ok: false, error: "Failed to delete document" });
  }
});

// ============================================================================
// CARD ORDERS — admin management
// ============================================================================
const CARD_STATUSES = ["requested", "approved", "in_production", "shipped", "active", "cancelled"];

// Create a card order on behalf of the investor
router.post("/:id/card", async (req, res) => {
  try {
    const { id } = req.params;
    const { cardholderName, cardDesign = "classic", status = "requested", priceCents, isFree = false } = req.body ?? {};
    const validStatus = CARD_STATUSES.includes(status) ? status : "requested";
    const [order] = await client`
      INSERT INTO investor_card_orders (
        investor_id, cardholder_name, card_design, status, price_cents, is_free
      ) VALUES (
        ${id}, ${cardholderName ?? null}, ${cardDesign}, ${validStatus},
        ${isFree ? 0 : Number(priceCents ?? 49900)}, ${!!isFree}
      ) RETURNING *
    `;
    res.status(201).json({ ok: true, order });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] create card error", err);
    res.status(500).json({ ok: false, error: "Failed to create card order" });
  }
});

// Update card order (status, design, price, cardholder, shipping)
router.patch("/:id/card/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    const map: Record<string, string> = {
      cardholderName: "cardholder_name", cardDesign: "card_design", status: "status",
      priceCents: "price_cents", isFree: "is_free",
      shippingStreet: "shipping_street", shippingZip: "shipping_zip",
      shippingCity: "shipping_city", shippingCountry: "shipping_country", notes: "notes",
    };
    const numeric = new Set(["price_cents"]);
    const updates: Record<string, any> = {};
    for (const [k, col] of Object.entries(map)) {
      if (k in req.body) {
        let v = req.body[k];
        if (col === "is_free") v = !!v;
        else if (v === "" || v === null) v = null;
        else if (numeric.has(col)) v = Number(v);
        updates[col] = v;
      }
    }
    if (updates.status && !CARD_STATUSES.includes(updates.status)) {
      return res.status(400).json({ ok: false, error: "Ungültiger Status" });
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ ok: false, error: "Keine gültigen Felder" });
    }
    const cols = Object.keys(updates);
    const [order] = await client`
      UPDATE investor_card_orders SET ${client(updates, ...cols)}, updated_at = NOW()
      WHERE id = ${Number(orderId)} RETURNING *
    `;
    if (!order) return res.status(404).json({ ok: false, error: "Kartenbestellung nicht gefunden" });
    res.json({ ok: true, order });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] update card error", err);
    res.status(500).json({ ok: false, error: "Failed to update card order" });
  }
});

router.delete("/:id/card/:orderId", async (req, res) => {
  try {
    const { orderId } = req.params;
    await client`DELETE FROM investor_card_orders WHERE id = ${Number(orderId)}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] delete card error", err);
    res.status(500).json({ ok: false, error: "Failed to delete card order" });
  }
});

// ============================================================================
// BENEFITS — admin sets the enabled perks for an investor (full replace)
// ============================================================================
router.put("/:id/benefits", async (req, res) => {
  try {
    const { id } = req.params;
    const { benefits } = req.body ?? {};
    if (!Array.isArray(benefits)) {
      return res.status(400).json({ ok: false, error: "benefits muss ein Array sein" });
    }
    // Replace all benefits for this investor
    await client`DELETE FROM investor_benefits WHERE investor_id = ${id}`;
    for (const b of benefits) {
      const key = typeof b === "string" ? b : b?.benefit_key;
      if (!key) continue;
      const status = (typeof b === "object" && b?.status) ? b.status : "active";
      const note = (typeof b === "object" && b?.note) ? b.note : null;
      await client`
        INSERT INTO investor_benefits (investor_id, benefit_key, status, note)
        VALUES (${id}, ${key}, ${status}, ${note})
        ON CONFLICT (investor_id, benefit_key) DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note
      `;
    }
    const rows = await client`
      SELECT benefit_key, status, note FROM investor_benefits WHERE investor_id = ${id} ORDER BY created_at ASC
    `;
    res.json({ ok: true, benefits: rows });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] set benefits error", err);
    res.status(500).json({ ok: false, error: "Failed to set benefits" });
  }
});

// ============================================================================
// CAPITAL REQUESTS — deposit top-up / withdrawal review
// ============================================================================
const REQUEST_STATUSES = ["pending", "approved", "rejected", "completed"];

router.patch("/:id/requests/:reqId", async (req, res) => {
  try {
    const { reqId } = req.params;
    const { status, note } = req.body ?? {};
    if (status && !REQUEST_STATUSES.includes(status)) {
      return res.status(400).json({ ok: false, error: "Ungültiger Status" });
    }
    const [request] = await client`
      UPDATE investor_requests SET
        status = COALESCE(${status ?? null}, status),
        note   = COALESCE(${note ?? null}, note)
      WHERE id = ${Number(reqId)}
      RETURNING id, investment_id, request_type, amount_cents, currency, note, status, created_at
    `;
    if (!request) return res.status(404).json({ ok: false, error: "Anfrage nicht gefunden" });
    res.json({ ok: true, request });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] update request error", err);
    res.status(500).json({ ok: false, error: "Failed to update request" });
  }
});

router.delete("/:id/requests/:reqId", async (req, res) => {
  try {
    const { reqId } = req.params;
    await client`DELETE FROM investor_requests WHERE id = ${Number(reqId)}`;
    res.json({ ok: true });
  } catch (err) {
    logger.error("[ADMIN-INVESTORS] delete request error", err);
    res.status(500).json({ ok: false, error: "Failed to delete request" });
  }
});

export default router;
