/**
 * ============================================================================
 * FOUNDING MEMBER PASS — API Routes (Phase 2)
 * ============================================================================
 * Public:  POST /api/public/founding/claim
 *          GET  /api/public/founding/stats
 * Admin:   GET  /api/internal/founding/claims
 *          PATCH /api/internal/founding/claims/:id
 * ============================================================================
 */

import { Router, Request, Response } from "express";
import { createHash } from "crypto";
import { db } from "../db";
import { foundingMemberClaims } from "../../shared/schema";
import { eq, desc, sql, and, gt, or, ilike } from "drizzle-orm";

const FOUNDING_CAP = 500;
const IP_SECRET = process.env.SESSION_SECRET || "aras-founding-secret";

// ── In-memory rate limit (no deps) ──────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 60 min

function checkRateLimit(ipHash: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ipHash);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ipHash, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function hashIP(ip: string): string {
  return createHash("sha256").update(IP_SECRET + ip).digest("hex").slice(0, 32);
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function padRef(id: number): string {
  return `FM-${String(id).padStart(6, "0")}`;
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════════
export const publicRouter = Router();

// POST /api/public/founding/claim
publicRouter.post("/claim", async (req: Request, res: Response) => {
  try {
    const { arasLogin, stripeEmail, notes, alphaConfirm, hp } = req.body || {};

    // Honeypot — silent drop
    if (hp && String(hp).trim() !== "") {
      return res.status(204).send();
    }

    // Validate alphaConfirm
    if (alphaConfirm !== true) {
      return res.status(400).json({ error: "Alpha confirmation required." });
    }

    // Validate arasLogin
    const login = String(arasLogin || "").trim().toLowerCase();
    if (login.length < 3 || login.length > 120) {
      return res.status(400).json({ error: "ARAS Login must be 3–120 characters." });
    }

    // Validate stripeEmail (optional)
    let email: string | null = null;
    if (stripeEmail && String(stripeEmail).trim() !== "") {
      email = String(stripeEmail).trim().toLowerCase();
      if (email.length > 120 || !isValidEmail(email)) {
        return res.status(400).json({ error: "Invalid email format." });
      }
    }

    // Validate notes (optional)
    let noteText: string | null = null;
    if (notes && String(notes).trim() !== "") {
      noteText = String(notes).trim().slice(0, 500);
    }

    // IP hash + rate limit
    const rawIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "unknown";
    const ipHash = hashIP(rawIp);

    if (!checkRateLimit(ipHash)) {
      return res.status(429).json({ error: "Too many attempts. Please try again in 60 minutes." });
    }

    // Duplicate guard: same aras_login in last 24h
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await db
      .select({ id: foundingMemberClaims.id })
      .from(foundingMemberClaims)
      .where(
        and(
          eq(foundingMemberClaims.arasLogin, login),
          gt(foundingMemberClaims.createdAt, twentyFourHoursAgo)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.json({
        ok: true,
        ref: padRef(existing[0].id),
        alreadySubmitted: true,
      });
    }

    // Insert claim
    const [claim] = await db
      .insert(foundingMemberClaims)
      .values({
        arasLogin: login,
        stripeEmail: email,
        notes: noteText,
        ipHash,
        userAgent: String(req.headers["user-agent"] || "").slice(0, 500) || null,
      })
      .returning({ id: foundingMemberClaims.id });

    console.log(`[FOUNDING] New claim: ${padRef(claim.id)} for ${login}`);

    return res.json({ ok: true, ref: padRef(claim.id) });
  } catch (error: any) {
    console.error("[FOUNDING] Claim error:", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// GET /api/public/founding/stats
publicRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        status: foundingMemberClaims.status,
        cnt: sql<number>`count(*)::int`,
      })
      .from(foundingMemberClaims)
      .groupBy(foundingMemberClaims.status);

    let pending = 0;
    let activated = 0;
    for (const r of rows) {
      if (r.status === "pending") pending = r.cnt;
      if (r.status === "activated") activated = r.cnt;
    }

    return res.json({
      cap: FOUNDING_CAP,
      pending,
      activated,
      total: pending + activated,
    });
  } catch (error: any) {
    console.error("[FOUNDING] Stats error:", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN / INTERNAL ROUTES (must be mounted behind requireInternal)
// ════════════════════════════════════════════════════════════════════════════
export const adminRouter = Router();

// GET /api/internal/founding/claims?status=pending&query=...&limit=50&offset=0
adminRouter.get("/claims", async (req: Request, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;
    const query = req.query.query as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const conditions = [];

    if (statusFilter && ["pending", "activated", "rejected"].includes(statusFilter)) {
      conditions.push(eq(foundingMemberClaims.status, statusFilter));
    }

    if (query && query.trim().length > 0) {
      const q = `%${query.trim()}%`;
      conditions.push(
        or(
          ilike(foundingMemberClaims.arasLogin, q),
          ilike(foundingMemberClaims.stripeEmail, q)
        )!
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const claims = await db
      .select()
      .from(foundingMemberClaims)
      .where(where)
      .orderBy(desc(foundingMemberClaims.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ cnt: sql<number>`count(*)::int` })
      .from(foundingMemberClaims)
      .where(where);

    return res.json({
      claims,
      total: countResult?.cnt ?? 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("[FOUNDING ADMIN] List error:", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});

// PATCH /api/internal/founding/claims/:id
adminRouter.patch("/claims/:id", async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid ID." });

    const { status, adminNote } = req.body || {};

    if (!status || !["activated", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Status must be 'activated' or 'rejected'." });
    }

    const adminUserId = (req as any).user?.id || (req as any).adminUser?.id || (req.session as any)?.userId || null;

    const updateData: Record<string, any> = { status };
    if (adminNote !== undefined) updateData.adminNote = String(adminNote).slice(0, 500);

    if (status === "activated") {
      updateData.activatedAt = new Date().toISOString();
      updateData.activatedByUserId = adminUserId;
    }

    const [updated] = await db
      .update(foundingMemberClaims)
      .set(updateData)
      .where(eq(foundingMemberClaims.id, id))
      .returning();

    if (!updated) return res.status(404).json({ error: "Claim not found." });

    console.log(`[FOUNDING ADMIN] Claim ${id} → ${status} by ${adminUserId}`);
    return res.json(updated);
  } catch (error: any) {
    console.error("[FOUNDING ADMIN] Update error:", error.message);
    return res.status(500).json({ error: "Internal server error." });
  }
});
