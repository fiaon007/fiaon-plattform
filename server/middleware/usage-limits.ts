import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../logger";

export async function checkCallLimit(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Use new storage.checkUsageLimit method
    const limitCheck = await storage.checkUsageLimit(userId, 'voice_call');

    if (!limitCheck.allowed) {
      logger.warn(`[LIMIT] User ${user.username} reached voice call limit`);
      return res.status(403).json({
        error: limitCheck.message || "Voice call limit reached",
        message: limitCheck.message,
        requiresUpgrade: limitCheck.requiresUpgrade,
        requiresPayment: limitCheck.requiresPayment,
        plan: user.subscriptionPlan
      });
    }

    next();
  } catch (error) {
    logger.error("[LIMIT] Error checking call limit:", error);
    res.status(500).json({ error: "Failed to check usage limits" });
  }
}

export async function checkMessageLimit(req: any, res: Response, next: NextFunction) {
  try {
    const userId = req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Use new storage.checkUsageLimit method
    const limitCheck = await storage.checkUsageLimit(userId, 'ai_message');

    if (!limitCheck.allowed) {
      logger.warn(`[LIMIT] User ${user.username} reached AI message limit`);
      return res.status(403).json({
        error: limitCheck.message || "AI message limit reached",
        message: limitCheck.message,
        requiresUpgrade: limitCheck.requiresUpgrade,
        requiresPayment: limitCheck.requiresPayment,
        plan: user.subscriptionPlan
      });
    }

    next();
  } catch (error) {
    logger.error("[LIMIT] Error checking message limit:", error);
    res.status(500).json({ error: "Failed to check usage limits" });
  }
}
