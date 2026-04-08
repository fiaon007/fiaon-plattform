// ============================================================================
// ARAS Command Center - Notification Service
// ============================================================================
// Real-time notifications with SSE and DB persistence
// ============================================================================

import { db } from "../db";
import { adminNotifications } from "@shared/schema";
import { eq, desc, and, or, isNull, sql } from "drizzle-orm";
import { EventEmitter } from "events";
import { logger } from "../logger";

// Event Emitter for Real-time Updates
export const notificationEmitter = new EventEmitter();
notificationEmitter.setMaxListeners(100);

// ============================================================================
// Notification Type Definitions
// ============================================================================

export const NOTIFICATION_TYPES = {
  NEW_USER: { type: "success", category: "user", icon: "UserPlus", color: "#10B981" },
  USER_UPDATED: { type: "info", category: "user", icon: "UserCog", color: "#6366F1" },
  USER_CANCELED: { type: "warning", category: "billing", icon: "UserX", color: "#F59E0B" },
  USER_DELETED: { type: "error", category: "user", icon: "Trash2", color: "#EF4444" },
  PAYMENT_FAILED: { type: "error", category: "billing", icon: "CreditCard", color: "#EF4444" },
  PAYMENT_SUCCESS: { type: "success", category: "billing", icon: "CreditCard", color: "#10B981" },
  NEW_SUBSCRIPTION: { type: "success", category: "billing", icon: "Crown", color: "#FF6A00" },
  SUBSCRIPTION_UPGRADED: { type: "success", category: "billing", icon: "TrendingUp", color: "#10B981" },
  SUBSCRIPTION_DOWNGRADED: { type: "warning", category: "billing", icon: "TrendingDown", color: "#F59E0B" },
  CALL_COMPLETED: { type: "info", category: "call", icon: "Phone", color: "#06B6D4" },
  CALL_FAILED: { type: "error", category: "call", icon: "PhoneOff", color: "#EF4444" },
  CRITICAL_CALL: { type: "error", category: "call", icon: "AlertTriangle", color: "#EF4444" },
  NEW_LEAD: { type: "success", category: "leads", icon: "TrendingUp", color: "#8B5CF6" },
  LEAD_CONVERTED: { type: "success", category: "leads", icon: "CheckCircle", color: "#10B981" },
  SYSTEM_ALERT: { type: "warning", category: "system", icon: "AlertTriangle", color: "#F59E0B" },
  SYSTEM_ERROR: { type: "error", category: "system", icon: "XCircle", color: "#EF4444" },
  EXPORT_COMPLETED: { type: "success", category: "data", icon: "Download", color: "#10B981" },
  EXPORT_FAILED: { type: "error", category: "data", icon: "Download", color: "#EF4444" },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;

// ============================================================================
// Create Notification Parameters
// ============================================================================

interface CreateNotificationParams {
  recipientId?: string; // NULL = all admins
  notificationType: NotificationType;
  title: string;
  message?: string;
  actionUrl?: string;
  actionLabel?: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// Notification Service Class
// ============================================================================

class NotificationService {
  /**
   * Create a new notification
   */
  async create(params: CreateNotificationParams) {
    try {
      const typeDef = NOTIFICATION_TYPES[params.notificationType];

      const [notification] = await db
        .insert(adminNotifications)
        .values({
          recipientId: params.recipientId || null,
          type: typeDef.type,
          category: typeDef.category,
          icon: typeDef.icon,
          color: typeDef.color,
          title: params.title,
          message: params.message || null,
          actionUrl: params.actionUrl || null,
          actionLabel: params.actionLabel || null,
          metadata: params.metadata || null,
        })
        .returning();

      logger.info("[NOTIFICATION] Created:", { id: notification.id, title: params.title });

      // Emit for real-time updates
      notificationEmitter.emit("new-notification", notification);

      return notification;
    } catch (error: any) {
      logger.error("[NOTIFICATION] Error creating:", error);
      throw error;
    }
  }

  /**
   * Get notifications for a specific user (includes broadcasts)
   */
  async getForUser(userId: string, options: { limit?: number; unreadOnly?: boolean } = {}) {
    const { limit = 50, unreadOnly = false } = options;

    const conditions = [
      or(
        isNull(adminNotifications.recipientId), // Broadcast to all
        eq(adminNotifications.recipientId, userId) // Specific to this user
      ),
    ];

    if (unreadOnly) {
      conditions.push(eq(adminNotifications.isRead, false));
    }

    return db
      .select()
      .from(adminNotifications)
      .where(and(...conditions))
      .orderBy(desc(adminNotifications.createdAt))
      .limit(limit);
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(adminNotifications)
      .where(
        and(
          or(
            isNull(adminNotifications.recipientId),
            eq(adminNotifications.recipientId, userId)
          ),
          eq(adminNotifications.isRead, false)
        )
      );
    return result?.count || 0;
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(notificationId: number, userId: string) {
    await db
      .update(adminNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          eq(adminNotifications.id, notificationId),
          or(
            isNull(adminNotifications.recipientId),
            eq(adminNotifications.recipientId, userId)
          )
        )
      );

    notificationEmitter.emit("notification-read", { id: notificationId, userId });
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const result = await db
      .update(adminNotifications)
      .set({ isRead: true, readAt: new Date() })
      .where(
        and(
          or(
            isNull(adminNotifications.recipientId),
            eq(adminNotifications.recipientId, userId)
          ),
          eq(adminNotifications.isRead, false)
        )
      )
      .returning({ id: adminNotifications.id });

    notificationEmitter.emit("all-notifications-read", { userId, count: result.length });
    
    return result.length;
  }

  /**
   * Delete old notifications (cleanup job)
   */
  async deleteOldNotifications(daysOld = 30) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(adminNotifications)
      .where(
        and(
          eq(adminNotifications.isRead, true),
          sql`${adminNotifications.createdAt} < ${cutoffDate}`
        )
      )
      .returning({ id: adminNotifications.id });

    logger.info("[NOTIFICATION] Cleaned up old notifications:", { count: result.length });
    return result.length;
  }
}

export const notificationService = new NotificationService();
