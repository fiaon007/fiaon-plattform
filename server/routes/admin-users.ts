// ============================================================================
// ARAS Command Center - User Deep-Dive API + Role Management
// ============================================================================
// Complete user data for the Deep-Dive Panel
// Enhanced with role management, bulk actions, and audit logging
// ============================================================================

import { Router } from "express";
import { db } from "../db";
import { client } from "../db";
import { 
  users, 
  leads, 
  contacts, 
  callLogs, 
  chatSessions,
  campaigns,
  staffActivityLog,
  adminAuditLog,
  sessions,
  userDataSources,
} from "@shared/schema";
import { eq, desc, and, gte, sql, count } from "drizzle-orm";
import { requireAdmin, VALID_ROLES, type UserRole } from "../middleware/admin";
import { logger } from "../logger";

/**
 * Helper: Get client IP from request
 */
function getClientIp(req: any): string {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
         req.socket?.remoteAddress || 
         'unknown';
}

/**
 * Helper: Log audit entry for admin actions
 */
async function logAudit(
  actorUserId: string,
  action: 'role_change' | 'password_reset' | 'user_delete' | 'plan_change' | 'bulk_role_change',
  targetUserId: string | null,
  beforeState: Record<string, any> | null,
  afterState: Record<string, any> | null,
  req: any
): Promise<void> {
  try {
    await db.insert(adminAuditLog).values({
      actorUserId,
      targetUserId,
      action,
      beforeState,
      afterState,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (err) {
    logger.error("[AUDIT] Failed to log audit entry:", err);
  }
}

/**
 * Helper: Non-fatal staff activity log insert.
 * If the staff_activity_log table has a schema mismatch (e.g. missing columns),
 * the insert will fail silently with a warning — never crashing the request.
 */
async function safeStaffLog(input: {
  userId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, any>;
}): Promise<void> {
  try {
    await db.insert(staffActivityLog).values(input);
  } catch (err: any) {
    logger.warn("[ADMIN] staff_activity_log insert failed (non-fatal)", { action: input.action, error: err.message });
  }
}

const router = Router();

// ============================================================================
// GET /users - List all users (replaces generic CRUD, strips password hashes)
// ============================================================================

router.get("/users", requireAdmin, async (req: any, res) => {
  try {
    const records = await db.select().from(users).orderBy(desc(users.createdAt));
    // Strip sensitive fields
    const safe = records.map(({ password, ...rest }) => rest);
    res.json(safe);
  } catch (error: any) {
    logger.error("[ADMIN] Error fetching users:", error);
    res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: 'Failed to fetch users' });
  }
});

// ============================================================================
// GET /users/:userId/deep-dive - Complete user data
// ============================================================================

router.get("/users/:userId/deep-dive", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Parallel fetch all user data for performance
    const [
      userResult,
      callsResult,
      chatSessionsResult,
      leadsResult,
      contactsResult,
    ] = await Promise.all([
      // User with all fields
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      
      // Last 20 calls
      db.select({
        id: callLogs.id,
        phoneNumber: callLogs.phoneNumber,
        contactName: callLogs.contactName,
        status: callLogs.status,
        duration: callLogs.duration,
        createdAt: callLogs.createdAt,
        metadata: callLogs.metadata,
      })
      .from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.createdAt))
      .limit(20),
      
      // Last 10 chat sessions
      db.select({
        id: chatSessions.id,
        title: chatSessions.title,
        createdAt: chatSessions.createdAt,
      })
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.createdAt))
      .limit(10),
      
      // User's leads
      db.select().from(leads).where(eq(leads.userId, userId)).orderBy(desc(leads.createdAt)).limit(20),
      
      // User's contacts
      db.select().from(contacts).where(eq(contacts.userId, userId)).orderBy(desc(contacts.createdAt)).limit(20),
    ]);

    if (!userResult[0]) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = userResult[0];

    // Fetch Stripe data if customer ID exists
    let stripeData = null;
    if (user.stripeCustomerId) {
      stripeData = await fetchStripeCustomer(user.stripeCustomerId);
    }

    // Calculate stats
    const stats = {
      totalCalls: callsResult.length,
      totalChats: chatSessionsResult.length,
      totalLeads: leadsResult.length,
      totalContacts: contactsResult.length,
      avgCallDuration: callsResult.length > 0 
        ? Math.round(callsResult.reduce((sum, c) => sum + (c.duration || 0), 0) / callsResult.length) 
        : 0,
    };

    // Log activity
    await db.insert(staffActivityLog).values({
      userId: req.session.userId,
      action: "user_viewed",
      targetType: "user",
      targetId: userId,
      metadata: { viewedUser: user.username },
    }).catch(() => {}); // Non-blocking

    logger.info("[ADMIN] User deep-dive fetched", { userId, by: req.session.userId });

    res.json({
      user: {
        ...user,
        // Remove sensitive fields
        password: undefined,
        passwordResetToken: undefined,
        passwordResetExpires: undefined,
      },
      calls: callsResult,
      chatSessions: chatSessionsResult.map(cs => ({
        ...cs,
        messageCount: 0, // Would need separate query
      })),
      leads: leadsResult,
      contacts: contactsResult,
      stripe: stripeData ? {
        customerId: stripeData.id,
        email: stripeData.email,
        balance: stripeData.balance,
        currency: stripeData.currency,
        created: stripeData.created,
        subscriptions: stripeData.subscriptions?.data || [],
        paymentMethods: stripeData.sources?.total_count || 0,
      } : null,
      stats,
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error fetching user deep-dive:", error);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

// ============================================================================
// GET /users/:userId/ai-insight - AI-generated user analysis
// ============================================================================

router.get("/users/:userId/ai-insight", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Fetch user data
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Fetch activity counts
    const [callCount] = await db.select({ count: count() }).from(callLogs).where(eq(callLogs.userId, userId));
    const [chatCount] = await db.select({ count: count() }).from(chatSessions).where(eq(chatSessions.userId, userId));

    // Generate AI insight
    const insight = await generateUserInsight(user, callCount?.count || 0, chatCount?.count || 0);

    if (!insight) {
      return res.status(503).json({ error: "AI insight generation failed" });
    }

    res.json(insight);

  } catch (error: any) {
    logger.error("[ADMIN] Error generating AI insight:", error);
    res.status(500).json({ error: "Failed to generate AI insight" });
  }
});

// ============================================================================
// POST /users/:userId/password - Reset user password
// ============================================================================

router.post("/users/:userId/password", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Hash password
    const { scrypt, randomBytes } = await import("crypto");
    const { promisify } = await import("util");
    const scryptAsync = promisify(scrypt);
    
    const salt = randomBytes(16).toString("hex");
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    const hashedPassword = `${salt}.${derivedKey.toString("hex")}`;

    // Update user
    await db
      .update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));

    // Log activity (non-fatal)
    await safeStaffLog({
      userId: req.session.userId,
      action: "password_reset",
      targetType: "user",
      targetId: userId,
    });

    logger.info("[ADMIN] Password reset", { userId, by: req.session.userId });
    res.json({ success: true, message: "Password has been reset" });

  } catch (error: any) {
    logger.error("[ADMIN] Error resetting password:", error);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ============================================================================
// PATCH /users/:userId/role - Update user role (ENHANCED with protections)
// ============================================================================

router.patch("/users/:userId/role", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const actorId = req.session.userId;

    // Validate role
    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!VALID_ROLES.includes(normalizedRole as UserRole)) {
      return res.status(400).json({ 
        error: "Invalid role", 
        message: `Role must be one of: ${VALID_ROLES.join(', ')}`,
        received: role
      });
    }

    // Fetch target user
    const [targetUser] = await client`
      SELECT id, username, user_role FROM users WHERE id = ${userId}
    `;

    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const oldRole = String(targetUser.user_role || 'user').toLowerCase();

    // Self-demotion protection
    if (userId === actorId && normalizedRole !== 'admin') {
      return res.status(400).json({ 
        error: "Self-demotion blocked",
        message: "Cannot demote yourself. Another admin must do this."
      });
    }

    // Last-admin protection: if demoting an admin, ensure at least one admin remains
    if (oldRole === 'admin' && normalizedRole !== 'admin') {
      const [adminCount] = await client`
        SELECT COUNT(*) as count FROM users WHERE LOWER(user_role) = 'admin'
      `;
      
      if (parseInt(adminCount?.count || '0') <= 1) {
        return res.status(400).json({ 
          error: "Last admin protection",
          message: "Cannot demote the last admin. Promote another user to admin first."
        });
      }
    }

    // Perform update
    await client`
      UPDATE users SET user_role = ${normalizedRole}, updated_at = NOW() WHERE id = ${userId}
    `;

    // Log to audit
    await logAudit(
      actorId,
      'role_change',
      userId,
      { role: oldRole, username: targetUser.username },
      { role: normalizedRole },
      req
    );

    logger.info("[ADMIN] Role updated", { 
      target: targetUser.username, 
      oldRole, 
      newRole: normalizedRole, 
      by: actorId 
    });

    res.json({ 
      success: true, 
      user: { 
        id: userId, 
        username: targetUser.username, 
        role: normalizedRole 
      }
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error updating role:", error);
    res.status(500).json({ error: "Failed to update role", message: error.message });
  }
});

// ============================================================================
// PATCH /users/bulk-role - Bulk update user roles
// ============================================================================

router.patch("/users/bulk-role", requireAdmin, async (req: any, res) => {
  try {
    const { userIds, role } = req.body;
    const actorId = req.session.userId;

    // Validate input
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: "userIds must be a non-empty array" });
    }

    const normalizedRole = String(role || '').trim().toLowerCase();
    if (!VALID_ROLES.includes(normalizedRole as UserRole)) {
      return res.status(400).json({ 
        error: "Invalid role", 
        message: `Role must be one of: ${VALID_ROLES.join(', ')}`
      });
    }

    // Prevent self-demotion via bulk
    if (userIds.includes(actorId) && normalizedRole !== 'admin') {
      return res.status(400).json({ 
        error: "Self-demotion blocked",
        message: "Cannot include yourself in bulk demotion"
      });
    }

    // Last-admin protection for bulk demotion
    if (normalizedRole !== 'admin') {
      const [adminCount] = await client`
        SELECT COUNT(*) as count FROM users 
        WHERE LOWER(user_role) = 'admin' AND id != ALL(${userIds})
      `;
      
      if (parseInt(adminCount?.count || '0') < 1) {
        return res.status(400).json({ 
          error: "Last admin protection",
          message: "This action would remove all admins. At least one admin must remain."
        });
      }
    }

    // Fetch users for audit
    const targetUsers = await client`
      SELECT id, username, user_role FROM users WHERE id = ANY(${userIds})
    `;

    // Perform bulk update
    await client`
      UPDATE users SET user_role = ${normalizedRole}, updated_at = NOW() 
      WHERE id = ANY(${userIds})
    `;

    // Log audit
    await logAudit(
      actorId,
      'bulk_role_change',
      null,
      { 
        userIds, 
        users: targetUsers.map((u: any) => ({ id: u.id, username: u.username, oldRole: u.user_role }))
      },
      { role: normalizedRole, count: userIds.length },
      req
    );

    logger.info("[ADMIN] Bulk role update", { 
      count: userIds.length, 
      newRole: normalizedRole, 
      by: actorId 
    });

    res.json({ 
      success: true, 
      updated: userIds.length,
      role: normalizedRole
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error in bulk role update:", error);
    res.status(500).json({ error: "Failed to update roles", message: error.message });
  }
});

// ============================================================================
// GET /audit - Get admin audit log with pagination
// ============================================================================

router.get("/audit", requireAdmin, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = (page - 1) * limit;
    const action = req.query.action as string;

    // Build query
    let query = `
      SELECT 
        a.*,
        actor.username as actor_username,
        target.username as target_username
      FROM admin_audit_log a
      LEFT JOIN users actor ON a.actor_user_id = actor.id
      LEFT JOIN users target ON a.target_user_id = target.id
    `;

    const params: any[] = [];
    
    if (action && ['role_change', 'password_reset', 'user_delete', 'plan_change', 'bulk_role_change'].includes(action)) {
      query += ` WHERE a.action = $1`;
      params.push(action);
    }

    query += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const entries = await client.unsafe(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) as count FROM admin_audit_log`;
    if (action) {
      countQuery += ` WHERE action = $1`;
    }
    const [countResult] = action 
      ? await client.unsafe(countQuery, [action])
      : await client.unsafe(countQuery);

    res.json({
      entries,
      pagination: {
        page,
        limit,
        total: parseInt(countResult?.count || '0'),
        totalPages: Math.ceil(parseInt(countResult?.count || '0') / limit)
      }
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error fetching audit log:", error);
    res.status(500).json({ error: "Failed to fetch audit log", message: error.message });
  }
});

// ============================================================================
// GET /roles/stats - Get role distribution stats
// ============================================================================

router.get("/roles/stats", requireAdmin, async (req: any, res) => {
  try {
    const stats = await client`
      SELECT 
        LOWER(COALESCE(user_role, 'user')) as role,
        COUNT(*) as count
      FROM users
      GROUP BY LOWER(COALESCE(user_role, 'user'))
      ORDER BY count DESC
    `;

    const distribution: Record<string, number> = {
      admin: 0,
      staff: 0,
      user: 0
    };

    stats.forEach((row: any) => {
      const role = row.role || 'user';
      distribution[role] = parseInt(row.count);
    });

    res.json({
      distribution,
      total: Object.values(distribution).reduce((a, b) => a + b, 0)
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error fetching role stats:", error);
    res.status(500).json({ error: "Failed to fetch role stats" });
  }
});

// ============================================================================
// DELETE /users/:userId - Disable user (soft-delete: sets subscriptionStatus='disabled')
// ============================================================================

router.delete("/users/:userId", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-disable
    if (userId === req.session.userId) {
      return res.status(400).json({ error: "Cannot disable yourself" });
    }

    // Get user info for logging
    const [user] = await db
      .select({ username: users.username, userRole: users.userRole, subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .where(eq(users.id, userId));
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Prevent disabling other admins (safety)
    if (user.userRole === 'admin') {
      return res.status(400).json({ error: "Cannot disable an admin account. Demote to user first." });
    }

    // Idempotent: already disabled → 200
    if (user.subscriptionStatus === 'disabled') {
      return res.json({ ok: true, success: true, action: "ALREADY_DISABLED" });
    }

    const previousStatus = user.subscriptionStatus;

    // Soft-disable: set subscriptionStatus to 'disabled'
    await db
      .update(users)
      .set({ subscriptionStatus: 'disabled', updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Invalidate all sessions for this user
    try {
      await db.delete(sessions).where(
        sql`sess::jsonb -> 'passport' ->> 'user' = ${userId}`
      );
      logger.info("[ADMIN] Sessions invalidated for disabled user", { userId });
    } catch (sessionErr: any) {
      logger.warn("[ADMIN] Could not invalidate sessions for user", { userId, error: sessionErr.message });
    }

    // Log activity (non-fatal)
    await safeStaffLog({
      userId: req.session.userId,
      action: "user_disabled",
      targetType: "user",
      targetId: userId,
      metadata: { disabledUsername: user.username, previousStatus },
    });

    logger.info("[ADMIN] User disabled", { userId, username: user.username, by: req.session.userId });
    res.json({ success: true, action: "DISABLED" });

  } catch (error: any) {
    logger.error("[ADMIN] Error disabling user:", error);
    res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: "Failed to disable user" });
  }
});

// ============================================================================
// POST /users/:userId/enable - Re-enable a disabled user
// ============================================================================

router.post("/users/:userId/enable", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db
      .select({ username: users.username, subscriptionStatus: users.subscriptionStatus })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Idempotent: already enabled → 200
    if (user.subscriptionStatus !== 'disabled') {
      return res.json({ ok: true, success: true, action: "ALREADY_ENABLED" });
    }

    // Re-enable: set back to 'active'
    await db
      .update(users)
      .set({ subscriptionStatus: 'active', updatedAt: new Date() })
      .where(eq(users.id, userId));

    // Log activity (non-fatal)
    await safeStaffLog({
      userId: req.session.userId,
      action: "user_enabled",
      targetType: "user",
      targetId: userId,
      metadata: { enabledUsername: user.username },
    });

    logger.info("[ADMIN] User re-enabled", { userId, username: user.username, by: req.session.userId });
    res.json({ success: true, action: "ENABLED" });

  } catch (error: any) {
    logger.error("[ADMIN] Error enabling user:", error);
    res.status(500).json({ ok: false, code: 'INTERNAL_ERROR', message: "Failed to enable user" });
  }
});

// ============================================================================
// PATCH /users/:userId - Update user identity (username, email)
// ============================================================================

router.patch("/users/:userId", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { username, email } = req.body;

    // Must provide at least one field
    if (!username && !email) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Provide username or email" });
    }

    // Fetch current user
    const [user] = await db.select({ id: users.id, username: users.username, email: users.email })
      .from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    const before: Record<string, any> = {};
    const after: Record<string, any> = {};

    if (username && username !== user.username) {
      const trimmed = String(username).trim();
      if (trimmed.length < 2 || trimmed.length > 50) {
        return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Username must be 2-50 characters" });
      }
      // Check uniqueness
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.username, trimmed), sql`${users.id} != ${userId}`));
      if (existing) return res.status(409).json({ ok: false, code: "CONFLICT", message: "Username already taken" });
      before.username = user.username;
      after.username = trimmed;
      updates.username = trimmed;
    }

    if (email && email !== user.email) {
      const trimmed = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Invalid email format" });
      }
      // Check uniqueness
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.email, trimmed), sql`${users.id} != ${userId}`));
      if (existing) return res.status(409).json({ ok: false, code: "CONFLICT", message: "Email already in use" });
      before.email = user.email;
      after.email = trimmed;
      updates.email = trimmed;
    }

    if (Object.keys(before).length === 0) {
      return res.json({ ok: true, action: "NO_CHANGE" });
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    await safeStaffLog({
      userId: req.session.userId,
      action: "user_identity_edit",
      targetType: "user",
      targetId: userId,
      metadata: { before, after },
    });

    logger.info("[ADMIN] User identity updated", { userId, changes: after, by: req.session.userId });
    res.json({ ok: true, action: "UPDATED", changes: after });

  } catch (error: any) {
    logger.error("[ADMIN] Error updating user identity:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to update user" });
  }
});

// ============================================================================
// POST /users/:userId/reset-usage - Reset usage counters
// ============================================================================

router.post("/users/:userId/reset-usage", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db.select({
      id: users.id, username: users.username,
      aiMessagesUsed: users.aiMessagesUsed,
      voiceCallsUsed: users.voiceCallsUsed,
      trialMessagesUsed: users.trialMessagesUsed,
    }).from(users).where(eq(users.id, userId));

    if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });

    const before = {
      aiMessagesUsed: user.aiMessagesUsed,
      voiceCallsUsed: user.voiceCallsUsed,
      trialMessagesUsed: user.trialMessagesUsed,
    };

    await db.update(users).set({
      aiMessagesUsed: 0,
      voiceCallsUsed: 0,
      trialMessagesUsed: 0,
      monthlyResetDate: new Date(),
      updatedAt: new Date(),
    }).where(eq(users.id, userId));

    await safeStaffLog({
      userId: req.session.userId,
      action: "usage_reset",
      targetType: "user",
      targetId: userId,
      metadata: { username: user.username, before },
    });

    logger.info("[ADMIN] Usage reset", { userId, username: user.username, before, by: req.session.userId });
    res.json({ ok: true, action: "USAGE_RESET", before });

  } catch (error: any) {
    logger.error("[ADMIN] Error resetting usage:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to reset usage" });
  }
});

// ============================================================================
// GET /users/:userId/settings - Get user settings
// ============================================================================

const SETTINGS_WHITELIST = ["language", "primaryGoal", "notificationSettings", "privacySettings"] as const;

router.get("/users/:userId/settings", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    const [user] = await db.select({
      id: users.id,
      language: users.language,
      primaryGoal: users.primaryGoal,
      notificationSettings: users.notificationSettings,
      privacySettings: users.privacySettings,
    }).from(users).where(eq(users.id, userId));

    if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });

    res.json({
      ok: true,
      settings: {
        language: user.language,
        primaryGoal: user.primaryGoal,
        notificationSettings: user.notificationSettings || {},
        privacySettings: user.privacySettings || {},
      },
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error fetching settings:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to fetch settings" });
  }
});

// ============================================================================
// PATCH /users/:userId/settings - Update user settings
// ============================================================================

router.patch("/users/:userId/settings", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const body = req.body;

    const [user] = await db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    const changes: Record<string, any> = {};

    // Only allow whitelisted keys
    if (body.language !== undefined) {
      updates.language = String(body.language).slice(0, 10);
      changes.language = updates.language;
    }
    if (body.primaryGoal !== undefined) {
      updates.primaryGoal = body.primaryGoal ? String(body.primaryGoal).slice(0, 200) : null;
      changes.primaryGoal = updates.primaryGoal;
    }
    if (body.notificationSettings !== undefined && typeof body.notificationSettings === "object") {
      updates.notificationSettings = {
        emailNotifications: !!body.notificationSettings.emailNotifications,
        campaignAlerts: !!body.notificationSettings.campaignAlerts,
        weeklyReports: !!body.notificationSettings.weeklyReports,
        aiSuggestions: !!body.notificationSettings.aiSuggestions,
      };
      changes.notificationSettings = updates.notificationSettings;
    }
    if (body.privacySettings !== undefined && typeof body.privacySettings === "object") {
      updates.privacySettings = {
        dataCollection: !!body.privacySettings.dataCollection,
        analytics: !!body.privacySettings.analytics,
        thirdPartySharing: !!body.privacySettings.thirdPartySharing,
      };
      changes.privacySettings = updates.privacySettings;
    }

    if (Object.keys(changes).length === 0) {
      return res.json({ ok: true, action: "NO_CHANGE" });
    }

    await db.update(users).set(updates).where(eq(users.id, userId));

    await safeStaffLog({
      userId: req.session.userId,
      action: "settings_edit",
      targetType: "user",
      targetId: userId,
      metadata: { username: user.username, changes },
    });

    logger.info("[ADMIN] Settings updated", { userId, changes, by: req.session.userId });
    res.json({ ok: true, action: "UPDATED", changes });

  } catch (error: any) {
    logger.error("[ADMIN] Error updating settings:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to update settings" });
  }
});

// ============================================================================
// GET /users/:userId/kb - List user knowledge base entries
// ============================================================================

router.get("/users/:userId/kb", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const search = (req.query.search as string || "").trim();
    const type = req.query.type as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Verify user exists
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });

    // Build query with filters
    let conditions = [eq(userDataSources.userId, userId)];
    if (type && ["file", "text", "url"].includes(type)) {
      conditions.push(eq(userDataSources.type, type as any));
    }

    if (search) {
      conditions.push(sql`(${userDataSources.title} ILIKE ${'%' + search + '%'} OR ${userDataSources.contentText} ILIKE ${'%' + search + '%'})`);
    }

    const entries = await db.select({
      id: userDataSources.id,
      type: userDataSources.type,
      title: userDataSources.title,
      status: userDataSources.status,
      url: userDataSources.url,
      fileName: userDataSources.fileName,
      fileMime: userDataSources.fileMime,
      fileSize: userDataSources.fileSize,
      contentPreview: sql<string>`LEFT(${userDataSources.contentText}, 200)`.as("content_preview"),
      createdAt: userDataSources.createdAt,
      updatedAt: userDataSources.updatedAt,
    })
    .from(userDataSources)
    .where(and(...conditions))
    .orderBy(desc(userDataSources.updatedAt))
    .limit(limit)
    .offset(offset);

    // Get total count
    const [countResult] = await db.select({ total: count() })
      .from(userDataSources)
      .where(and(...conditions));

    res.json({
      ok: true,
      entries,
      pagination: { limit, offset, total: countResult?.total || 0 },
    });

  } catch (error: any) {
    logger.error("[ADMIN] Error fetching KB:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to fetch KB" });
  }
});

// ============================================================================
// POST /users/:userId/kb - Create KB entry
// ============================================================================

router.post("/users/:userId/kb", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { type, title, contentText, url } = req.body;

    // Verify user
    const [user] = await db.select({ id: users.id, username: users.username })
      .from(users).where(eq(users.id, userId));
    if (!user) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "User not found" });

    // Validate
    if (!type || !["text", "url"].includes(type)) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Type must be 'text' or 'url'" });
    }
    if (title && String(title).length > 200) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Title max 200 chars" });
    }
    if (contentText && String(contentText).length > 50000) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Content max 50000 chars" });
    }
    if (type === "url" && !url) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "URL required for type 'url'" });
    }
    if (type === "text" && !contentText) {
      return res.status(400).json({ ok: false, code: "VALIDATION_ERROR", message: "Content required for type 'text'" });
    }

    const [entry] = await db.insert(userDataSources).values({
      userId,
      type: type as "text" | "url",
      title: title ? String(title).slice(0, 200) : null,
      contentText: contentText ? String(contentText).slice(0, 50000) : null,
      url: url ? String(url).slice(0, 2000) : null,
      status: "active",
    }).returning();

    await safeStaffLog({
      userId: req.session.userId,
      action: "kb_create",
      targetType: "user",
      targetId: userId,
      metadata: { username: user.username, entryId: entry.id, type, title },
    });

    logger.info("[ADMIN] KB entry created", { userId, entryId: entry.id, by: req.session.userId });
    res.json({ ok: true, action: "CREATED", entry: { ...entry, contentText: undefined } });

  } catch (error: any) {
    logger.error("[ADMIN] Error creating KB entry:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to create KB entry" });
  }
});

// ============================================================================
// PATCH /users/:userId/kb/:entryId - Edit KB entry
// ============================================================================

router.patch("/users/:userId/kb/:entryId", requireAdmin, async (req: any, res) => {
  try {
    const { userId, entryId } = req.params;
    const { title, contentText, url, status } = req.body;

    // Verify entry belongs to user
    const [entry] = await db.select()
      .from(userDataSources)
      .where(and(eq(userDataSources.id, parseInt(entryId)), eq(userDataSources.userId, userId)));
    if (!entry) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "KB entry not found" });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title ? String(title).slice(0, 200) : null;
    if (contentText !== undefined) updates.contentText = contentText ? String(contentText).slice(0, 50000) : null;
    if (url !== undefined) updates.url = url ? String(url).slice(0, 2000) : null;
    if (status && ["active", "pending", "failed"].includes(status)) updates.status = status;

    await db.update(userDataSources).set(updates)
      .where(eq(userDataSources.id, parseInt(entryId)));

    await safeStaffLog({
      userId: req.session.userId,
      action: "kb_edit",
      targetType: "user",
      targetId: userId,
      metadata: { entryId: parseInt(entryId), fields: Object.keys(updates).filter(k => k !== "updatedAt") },
    });

    logger.info("[ADMIN] KB entry updated", { userId, entryId, by: req.session.userId });
    res.json({ ok: true, action: "UPDATED" });

  } catch (error: any) {
    logger.error("[ADMIN] Error updating KB entry:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to update KB entry" });
  }
});

// ============================================================================
// DELETE /users/:userId/kb/:entryId - Delete KB entry
// ============================================================================

router.delete("/users/:userId/kb/:entryId", requireAdmin, async (req: any, res) => {
  try {
    const { userId, entryId } = req.params;

    // Verify entry belongs to user
    const [entry] = await db.select({ id: userDataSources.id, title: userDataSources.title, type: userDataSources.type })
      .from(userDataSources)
      .where(and(eq(userDataSources.id, parseInt(entryId)), eq(userDataSources.userId, userId)));
    if (!entry) return res.status(404).json({ ok: false, code: "NOT_FOUND", message: "KB entry not found" });

    await db.delete(userDataSources).where(eq(userDataSources.id, parseInt(entryId)));

    await safeStaffLog({
      userId: req.session.userId,
      action: "kb_delete",
      targetType: "user",
      targetId: userId,
      metadata: { entryId: parseInt(entryId), title: entry.title, type: entry.type },
    });

    logger.info("[ADMIN] KB entry deleted", { userId, entryId, by: req.session.userId });
    res.json({ ok: true, action: "DELETED" });

  } catch (error: any) {
    logger.error("[ADMIN] Error deleting KB entry:", error);
    res.status(500).json({ ok: false, code: "INTERNAL_ERROR", message: "Failed to delete KB entry" });
  }
});

// ============================================================================
// Helper: Fetch Stripe Customer
// ============================================================================

async function fetchStripeCustomer(customerId: string): Promise<any> {
  try {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    
    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    
    const customer = await stripe.customers.retrieve(customerId, {
      expand: ["subscriptions"],
    });
    
    // Check if customer is deleted
    if ((customer as any).deleted) return null;
    
    return customer;
  } catch (error) {
    logger.error("[STRIPE] Error fetching customer:", error);
    return null;
  }
}

// ============================================================================
// Helper: Generate AI User Insight with Gemini
// ============================================================================

async function generateUserInsight(user: any, callCount: number, chatCount: number) {
  try {
    if (!process.env.GOOGLE_GEMINI_API_KEY) {
      logger.warn("[AI] Gemini API key not configured");
      return getDefaultInsight(user);
    }

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Du bist ein Business Intelligence Analyst für ein SaaS CRM. Analysiere diesen User und gib actionable Insights.

USER DATA:
- Name: ${user.firstName || ""} ${user.lastName || ""}
- Username: ${user.username}
- Company: ${user.company || "Unbekannt"}
- Industry: ${user.industry || "Unbekannt"}
- Job Role: ${user.jobRole || "Unbekannt"}
- Plan: ${user.subscriptionPlan || "free"}
- Status: ${user.subscriptionStatus || "unknown"}
- AI Messages Used: ${user.aiMessagesUsed || 0}
- Voice Calls Used: ${user.voiceCallsUsed || 0}
- Total Calls Made: ${callCount}
- Total Chat Sessions: ${chatCount}
- Member since: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString("de-DE") : "Unknown"}

Antworte NUR mit diesem JSON (kein Markdown, keine Erklärung):
{
  "healthScore": [0-100 Zahl],
  "healthLabel": "[Excellent|Good|At Risk|Critical]",
  "churnRisk": "[low|medium|high]",
  "upsellPotential": "[low|medium|high]",
  "keyInsight": "[Ein prägnanter Satz über den wichtigsten Insight]",
  "recommendations": ["[Empfehlung 1]", "[Empfehlung 2]", "[Empfehlung 3]"],
  "nextBestAction": "[Die eine konkrete Aktion die jetzt am wichtigsten ist]"
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text()
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    
    const parsed = JSON.parse(text);
    
    // Validate response structure
    if (typeof parsed.healthScore !== "number" || !parsed.healthLabel) {
      throw new Error("Invalid AI response structure");
    }

    return parsed;

  } catch (error) {
    logger.error("[AI] Error generating user insight:", error);
    return getDefaultInsight(user);
  }
}

// Fallback insight when AI fails
function getDefaultInsight(user: any) {
  const isActive = user.subscriptionStatus === "active";
  const hasUsage = (user.aiMessagesUsed || 0) + (user.voiceCallsUsed || 0) > 0;
  
  let healthScore = 50;
  let healthLabel = "Good";
  let churnRisk = "medium";
  let upsellPotential = "medium";

  if (isActive && hasUsage) {
    healthScore = 75;
    healthLabel = "Good";
    churnRisk = "low";
  } else if (!isActive) {
    healthScore = 30;
    healthLabel = "At Risk";
    churnRisk = "high";
    upsellPotential = "low";
  }

  if (user.subscriptionPlan === "free" && hasUsage) {
    upsellPotential = "high";
  }

  return {
    healthScore,
    healthLabel,
    churnRisk,
    upsellPotential,
    keyInsight: hasUsage 
      ? "User zeigt aktive Nutzung der Plattform."
      : "User hat die Plattform noch nicht aktiv genutzt.",
    recommendations: [
      "Engagement-Email senden",
      "Persönlichen Onboarding-Call anbieten",
      "Feature-Highlights teilen",
    ],
    nextBestAction: hasUsage 
      ? "Feedback zur Nutzung einholen"
      : "Onboarding-Reminder senden",
  };
}

export default router;
