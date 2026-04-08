// ============================================================================
// ARAS Command Center - Activity Feed API (Enhanced)
// ============================================================================
// Real-time activity tracking with SSE and AI enrichment
// ============================================================================

import { Router } from "express";
import { activityService, activityEmitter } from "../services/activity.service";
import { requireAdmin } from "../middleware/admin";
import { requireStaffOrAdmin } from "../middleware/staff";
import { logger } from "../logger";

const router = Router();

// ============================================================================
// GET /activity - Get activities with filtering
// ============================================================================

router.get("/activity", requireAdmin, async (req: any, res) => {
  try {
    const { limit, offset, category, since, actorId } = req.query;
    
    const result = await activityService.getActivities({
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
      category: category as string,
      since: since ? new Date(since as string) : undefined,
      actorId: actorId as string,
    });

    res.json(result);
  } catch (error: any) {
    // Graceful handling wenn Tabelle nicht existiert
    if (error.code === "42P01") {
      logger.warn("[ACTIVITY] Table does not exist yet, returning empty");
      return res.json({ data: [], total: 0 });
    }
    logger.error("[ACTIVITY] Error fetching activities:", error);
    res.status(500).json({ error: "Failed to fetch activities" });
  }
});

// ============================================================================
// GET /activity/stats - Get activity statistics
// ============================================================================

router.get("/activity/stats", requireAdmin, async (req: any, res) => {
  try {
    const { hours } = req.query;
    const stats = await activityService.getStats(hours ? Number(hours) : 24);
    res.json({ data: stats });
  } catch (error: any) {
    if (error.code === "42P01") {
      logger.warn("[ACTIVITY] Table does not exist yet, returning empty stats");
      return res.json({ data: { total: 0, byCategory: {}, byHour: [] } });
    }
    logger.error("[ACTIVITY] Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============================================================================
// GET /activity/categories - Get categories with counts
// ============================================================================

router.get("/activity/categories", requireAdmin, async (req: any, res) => {
  try {
    const { hours } = req.query;
    const categories = await activityService.getCategories(hours ? Number(hours) : 24);
    res.json({ data: categories });
  } catch (error: any) {
    if (error.code === "42P01") {
      logger.warn("[ACTIVITY] Table does not exist yet, returning empty categories");
      return res.json({ data: [] });
    }
    logger.error("[ACTIVITY] Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ============================================================================
// GET /activity/stream - Server-Sent Events for Real-time Updates
// ============================================================================

router.get("/activity/stream", requireAdmin, (req: any, res) => {
  // Set SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date() })}\n\n`);

  // Handler for new activities
  const onNewActivity = (activity: any) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "new", activity })}\n\n`);
    } catch (err) {
      logger.warn("[SSE] Failed to send new activity");
    }
  };

  // Handler for activity updates (AI enrichment)
  const onActivityUpdated = (update: any) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "update", ...update })}\n\n`);
    } catch (err) {
      logger.warn("[SSE] Failed to send activity update");
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
  activityEmitter.on("new-activity", onNewActivity);
  activityEmitter.on("activity-updated", onActivityUpdated);

  // Cleanup on connection close
  req.on("close", () => {
    clearInterval(heartbeat);
    activityEmitter.off("new-activity", onNewActivity);
    activityEmitter.off("activity-updated", onActivityUpdated);
    logger.info("[SSE] Activity stream connection closed");
  });

  logger.info("[SSE] Activity stream connection opened");
});

// ============================================================================
// POST /activity/log - Manually log an activity (for testing)
// ============================================================================

router.post("/activity/log", requireAdmin, async (req: any, res) => {
  try {
    const { actionKey, targetType, targetId, targetName, description, metadata } = req.body;

    if (!actionKey) {
      return res.status(400).json({ error: "actionKey is required" });
    }

    await activityService.log({
      actorId: req.session.userId,
      actorName: (req as any).user?.username || "Admin",
      actorRole: (req as any).user?.userRole || "admin",
      actionKey,
      targetType,
      targetId,
      targetName,
      description,
      metadata,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });

    res.json({ success: true, message: "Activity logged" });
  } catch (error: any) {
    if (error.code === "42P01") {
      return res.status(503).json({ error: "Activity table not yet created. Run migration first." });
    }
    logger.error("[ACTIVITY] Error logging activity:", error);
    res.status(500).json({ error: "Failed to log activity" });
  }
});

export default router;
