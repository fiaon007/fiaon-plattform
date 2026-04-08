// ============================================================================
// ARAS Command Center - Staff Management API
// ============================================================================
// Endpoints for managing staff users, invitations, roles, and activity logging
// ============================================================================

import { Router } from "express";
import { db } from "../db";
import { 
  staffInvitations, 
  users, 
  staffActivityLog 
} from "@shared/schema";
import { eq, desc, and, gt, or } from "drizzle-orm";
import { nanoid } from "nanoid";
import { requireAdmin } from "../middleware/admin";
import { logger } from "../logger";

const router = Router();

// ============================================================================
// STAFF USERS - List all staff/admin users
// ============================================================================

router.get("/staff", requireAdmin, async (req: any, res) => {
  try {
    const staff = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        userRole: users.userRole,
        profileImageUrl: users.profileImageUrl,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(
        or(eq(users.userRole, "admin"), eq(users.userRole, "staff"))
      )
      .orderBy(desc(users.createdAt));

    logger.info("[STAFF] Fetched staff list", { count: staff.length });
    res.json({ data: staff });
  } catch (error: any) {
    logger.error("[STAFF] Error fetching staff:", error);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// ============================================================================
// STAFF INVITATIONS - Create new invitation
// ============================================================================

router.post("/staff/invite", requireAdmin, async (req: any, res) => {
  try {
    const { email, role = "staff" } = req.body;
    const invitedBy = req.session.userId;

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (!["staff", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'staff' or 'admin'" });
    }

    // Check if email already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "User with this email already exists" });
    }

    // Check for pending invitation
    const existingInvite = await db
      .select()
      .from(staffInvitations)
      .where(
        and(
          eq(staffInvitations.email, email),
          eq(staffInvitations.status, "pending"),
          gt(staffInvitations.expiresAt, new Date())
        )
      )
      .limit(1);

    if (existingInvite.length > 0) {
      return res.status(400).json({ error: "Pending invitation already exists for this email" });
    }

    // Generate token and expiry
    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const [invitation] = await db
      .insert(staffInvitations)
      .values({
        email,
        role,
        invitedBy,
        token,
        expiresAt,
      })
      .returning();

    // Log activity
    await db.insert(staffActivityLog).values({
      userId: invitedBy,
      action: "staff_invited",
      targetType: "invitation",
      targetId: invitation.id,
      metadata: { email, role },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Generate invite URL
    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "https://www.plattform-aras.ai";
    const inviteUrl = `${appUrl}/admin/accept-invite?token=${token}`;

    logger.info("[STAFF] Created invitation", { 
      invitationId: invitation.id, 
      email, 
      role,
      invitedBy 
    });

    res.status(201).json({
      success: true,
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        expiresAt: invitation.expiresAt,
        inviteUrl,
      },
    });
  } catch (error: any) {
    logger.error("[STAFF] Error creating invitation:", error);
    res.status(500).json({ error: "Failed to create invitation" });
  }
});

// ============================================================================
// STAFF INVITATIONS - List all invitations
// ============================================================================

router.get("/staff/invitations", requireAdmin, async (req: any, res) => {
  try {
    const invitations = await db
      .select({
        id: staffInvitations.id,
        email: staffInvitations.email,
        role: staffInvitations.role,
        status: staffInvitations.status,
        expiresAt: staffInvitations.expiresAt,
        acceptedAt: staffInvitations.acceptedAt,
        createdAt: staffInvitations.createdAt,
        invitedById: staffInvitations.invitedBy,
      })
      .from(staffInvitations)
      .orderBy(desc(staffInvitations.createdAt));

    // Fetch inviter info separately to avoid complex joins
    const invitationsWithInviter = await Promise.all(
      invitations.map(async (inv) => {
        let invitedBy = null;
        if (inv.invitedById) {
          const [inviter] = await db
            .select({ id: users.id, username: users.username })
            .from(users)
            .where(eq(users.id, inv.invitedById))
            .limit(1);
          invitedBy = inviter || null;
        }
        return { ...inv, invitedBy };
      })
    );

    logger.info("[STAFF] Fetched invitations", { count: invitations.length });
    res.json({ data: invitationsWithInviter });
  } catch (error: any) {
    logger.error("[STAFF] Error fetching invitations:", error);
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

// ============================================================================
// STAFF INVITATIONS - Revoke invitation
// ============================================================================

router.post("/staff/invitations/:id/revoke", requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;

    const [updated] = await db
      .update(staffInvitations)
      .set({ status: "revoked" })
      .where(
        and(
          eq(staffInvitations.id, id),
          eq(staffInvitations.status, "pending")
        )
      )
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "Invitation not found or already processed" });
    }

    // Log activity
    await db.insert(staffActivityLog).values({
      userId: req.session.userId,
      action: "invitation_revoked",
      targetType: "invitation",
      targetId: id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("[STAFF] Revoked invitation", { invitationId: id });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[STAFF] Error revoking invitation:", error);
    res.status(500).json({ error: "Failed to revoke invitation" });
  }
});

// ============================================================================
// STAFF INVITATIONS - Resend invitation
// ============================================================================

router.post("/staff/invitations/:id/resend", requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;

    // Get existing invitation
    const [invitation] = await db
      .select()
      .from(staffInvitations)
      .where(eq(staffInvitations.id, id))
      .limit(1);

    if (!invitation) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ error: "Can only resend pending invitations" });
    }

    // Generate new token and extend expiry
    const newToken = nanoid(32);
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [updated] = await db
      .update(staffInvitations)
      .set({ 
        token: newToken, 
        expiresAt: newExpiresAt 
      })
      .where(eq(staffInvitations.id, id))
      .returning();

    const appUrl = process.env.APP_URL || process.env.FRONTEND_URL || "https://www.plattform-aras.ai";
    const inviteUrl = `${appUrl}/admin/accept-invite?token=${newToken}`;

    logger.info("[STAFF] Resent invitation", { invitationId: id });
    res.json({ 
      success: true, 
      invitation: {
        ...updated,
        inviteUrl,
      }
    });
  } catch (error: any) {
    logger.error("[STAFF] Error resending invitation:", error);
    res.status(500).json({ error: "Failed to resend invitation" });
  }
});

// ============================================================================
// STAFF ROLE - Change user role
// ============================================================================

router.patch("/staff/:userId/role", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["staff", "admin", "user"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'user', 'staff', or 'admin'" });
    }

    // Prevent self-demotion
    if (userId === req.session.userId && role !== "admin") {
      return res.status(400).json({ error: "Cannot change your own role" });
    }

    const [updated] = await db
      .update(users)
      .set({ userRole: role, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log activity
    await db.insert(staffActivityLog).values({
      userId: req.session.userId,
      action: "role_changed",
      targetType: "user",
      targetId: userId,
      metadata: { newRole: role, previousRole: updated.userRole },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("[STAFF] Changed user role", { targetUserId: userId, newRole: role });
    res.json({ success: true, user: updated });
  } catch (error: any) {
    logger.error("[STAFF] Error changing role:", error);
    res.status(500).json({ error: "Failed to change role" });
  }
});

// ============================================================================
// STAFF - Remove staff access (demote to regular user)
// ============================================================================

router.post("/staff/:userId/remove", requireAdmin, async (req: any, res) => {
  try {
    const { userId } = req.params;

    // Prevent self-removal
    if (userId === req.session.userId) {
      return res.status(400).json({ error: "Cannot remove yourself from staff" });
    }

    const [updated] = await db
      .update(users)
      .set({ userRole: "user", updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: "User not found" });
    }

    // Log activity
    await db.insert(staffActivityLog).values({
      userId: req.session.userId,
      action: "staff_removed",
      targetType: "user",
      targetId: userId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    logger.info("[STAFF] Removed staff access", { targetUserId: userId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[STAFF] Error removing staff:", error);
    res.status(500).json({ error: "Failed to remove staff access" });
  }
});

// ============================================================================
// ACTIVITY LOG - Get recent activity
// ============================================================================

router.get("/activity", requireAdmin, async (req: any, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const activities = await db
      .select({
        id: staffActivityLog.id,
        action: staffActivityLog.action,
        targetType: staffActivityLog.targetType,
        targetId: staffActivityLog.targetId,
        metadata: staffActivityLog.metadata,
        createdAt: staffActivityLog.createdAt,
        userId: staffActivityLog.userId,
      })
      .from(staffActivityLog)
      .orderBy(desc(staffActivityLog.createdAt))
      .limit(limit)
      .offset(offset);

    // Fetch user info for each activity
    const activitiesWithUser = await Promise.all(
      activities.map(async (activity) => {
        const [user] = await db
          .select({ 
            id: users.id, 
            username: users.username,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          })
          .from(users)
          .where(eq(users.id, activity.userId))
          .limit(1);
        return { ...activity, user: user || null };
      })
    );

    logger.info("[STAFF] Fetched activity log", { count: activities.length });
    res.json({ data: activitiesWithUser });
  } catch (error: any) {
    logger.error("[STAFF] Error fetching activity:", error);
    res.status(500).json({ error: "Failed to fetch activity log" });
  }
});

// ============================================================================
// ACTIVITY LOG - Log custom activity (for tracking user views, etc.)
// ============================================================================

router.post("/activity", requireAdmin, async (req: any, res) => {
  try {
    const { action, targetType, targetId, metadata } = req.body;

    if (!action) {
      return res.status(400).json({ error: "Action is required" });
    }

    const [activity] = await db
      .insert(staffActivityLog)
      .values({
        userId: req.session.userId,
        action,
        targetType,
        targetId,
        metadata,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      })
      .returning();

    res.status(201).json({ success: true, activity });
  } catch (error: any) {
    logger.error("[STAFF] Error logging activity:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

export default router;
