// ============================================================================
// ARAS Command Center - Notifications API (Enhanced)
// ============================================================================
// Real-time notifications with SSE and DB persistence
// ============================================================================

import { Router } from "express";
import { notificationService, notificationEmitter } from "../services/notification.service";
import { requireAdmin } from "../middleware/admin";
import { logger } from "../logger";

const router = Router();

// ============================================================================
// GET /notifications - Get user's notifications
// ============================================================================

router.get("/notifications", requireAdmin, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const { limit, unreadOnly } = req.query;

    const notifications = await notificationService.getForUser(userId, {
      limit: limit ? Number(limit) : 50,
      unreadOnly: unreadOnly === "true",
    });

    const unreadCount = await notificationService.getUnreadCount(userId);

    res.json({
      data: notifications,
      unreadCount,
      total: notifications.length,
    });
  } catch (error: any) {
    // Graceful handling wenn Tabelle nicht existiert
    if (error.code === "42P01") {
      logger.warn("[NOTIFICATIONS] Table does not exist yet, returning empty");
      return res.json({ data: [], unreadCount: 0, total: 0 });
    }
    logger.error("[NOTIFICATIONS] Error fetching:", error);
    res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

// ============================================================================
// GET /notifications/count - Get unread count
// ============================================================================

router.get("/notifications/count", requireAdmin, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ count });
  } catch (error: any) {
    // Graceful handling wenn Tabelle nicht existiert
    if (error.code === "42P01") {
      logger.warn("[NOTIFICATIONS] Table does not exist yet, returning 0");
      return res.json({ count: 0 });
    }
    logger.error("[NOTIFICATIONS] Count error:", error);
    res.status(500).json({ error: "Failed to fetch count" });
  }
});

// ============================================================================
// POST /notifications/:id/read - Mark single notification as read
// ============================================================================

router.post("/notifications/:id/read", requireAdmin, async (req: any, res) => {
  try {
    const notificationId = Number(req.params.id);
    const userId = req.session.userId;

    await notificationService.markAsRead(notificationId, userId);
    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "42P01") {
      return res.json({ success: true });
    }
    logger.error("[NOTIFICATIONS] Mark read error:", error);
    res.status(500).json({ error: "Failed to mark as read" });
  }
});

// ============================================================================
// POST /notifications/read-all - Mark all notifications as read
// ============================================================================

router.post("/notifications/read-all", requireAdmin, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const count = await notificationService.markAllAsRead(userId);
    res.json({ success: true, count });
  } catch (error: any) {
    if (error.code === "42P01") {
      return res.json({ success: true, count: 0 });
    }
    logger.error("[NOTIFICATIONS] Mark all read error:", error);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

// ============================================================================
// GET /notifications/stream - SSE for real-time notifications
// ============================================================================

router.get("/notifications/stream", requireAdmin, (req: any, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  const userId = req.session.userId;

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date() })}\n\n`);

  // Handler for new notifications
  const onNewNotification = (notification: any) => {
    // Only send if for this user or broadcast (null recipientId)
    if (!notification.recipientId || notification.recipientId === userId) {
      try {
        res.write(`data: ${JSON.stringify({ type: "new", notification })}\n\n`);
      } catch (err) {
        logger.warn("[SSE] Failed to send notification");
      }
    }
  };

  // Handler for notification read
  const onNotificationRead = (data: any) => {
    if (data.userId === userId) {
      try {
        res.write(`data: ${JSON.stringify({ type: "read", id: data.id })}\n\n`);
      } catch (err) {
        logger.warn("[SSE] Failed to send read update");
      }
    }
  };

  // Handler for all notifications read
  const onAllRead = (data: any) => {
    if (data.userId === userId) {
      try {
        res.write(`data: ${JSON.stringify({ type: "all-read", count: data.count })}\n\n`);
      } catch (err) {
        logger.warn("[SSE] Failed to send all-read update");
      }
    }
  };

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: "heartbeat", timestamp: new Date() })}\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
    }
  }, 30000);

  // Subscribe to events
  notificationEmitter.on("new-notification", onNewNotification);
  notificationEmitter.on("notification-read", onNotificationRead);
  notificationEmitter.on("all-notifications-read", onAllRead);

  // Cleanup on connection close
  req.on("close", () => {
    clearInterval(heartbeat);
    notificationEmitter.off("new-notification", onNewNotification);
    notificationEmitter.off("notification-read", onNotificationRead);
    notificationEmitter.off("all-notifications-read", onAllRead);
    logger.info("[SSE] Notification stream connection closed");
  });

  logger.info("[SSE] Notification stream connection opened", { userId });
});

// ============================================================================
// POST /notifications/test - Create test notification (dev only)
// ============================================================================

router.post("/notifications/test", requireAdmin, async (req: any, res) => {
  try {
    const { notificationType, title, message } = req.body;

    const notification = await notificationService.create({
      notificationType: notificationType || "SYSTEM_ALERT",
      title: title || "Test Notification",
      message: message || "This is a test notification",
      recipientId: req.session.userId,
    });

    res.json({ success: true, notification });
  } catch (error: any) {
    if (error.code === "42P01") {
      return res.status(503).json({ error: "Notifications table not yet created. Run migration first." });
    }
    logger.error("[NOTIFICATIONS] Test error:", error);
    res.status(500).json({ error: "Failed to create test notification" });
  }
});

export default router;
