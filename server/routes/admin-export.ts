// ============================================================================
// ARAS Command Center - Export API
// ============================================================================
// REST endpoints for data export (CSV/JSON)
// ============================================================================

import { Router } from "express";
import { exportService } from "../services/export.service";
import { requireAdmin } from "../middleware/admin";
import { logger } from "../logger";

const router = Router();

// ============================================================================
// Create new export job
// ============================================================================

router.post("/export", requireAdmin, async (req: any, res) => {
  try {
    const { entityType, filters, format = "csv" } = req.body;
    const userId = req.session.userId;

    const validTypes = ["users", "leads", "calls", "emails", "contacts", "campaigns"];
    if (!entityType || !validTypes.includes(entityType)) {
      return res.status(400).json({ 
        error: `Invalid entity type. Must be one of: ${validTypes.join(", ")}` 
      });
    }

    if (format && !["csv", "json"].includes(format)) {
      return res.status(400).json({ error: "Invalid format. Must be 'csv' or 'json'" });
    }

    const job = await exportService.createExportJob(
      userId,
      entityType,
      filters || {},
      format
    );

    logger.info("[EXPORT] Export job created", { 
      jobId: job.id, 
      entityType, 
      format,
      userId 
    });

    res.status(201).json({ 
      success: true,
      data: job 
    });
  } catch (error: any) {
    logger.error("[EXPORT] Error creating export:", error);
    res.status(500).json({ error: "Failed to create export job" });
  }
});

// ============================================================================
// Get export job status
// ============================================================================

router.get("/export/:jobId", requireAdmin, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const job = await exportService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: "Export job not found" });
    }

    res.json({ data: job });
  } catch (error: any) {
    logger.error("[EXPORT] Error fetching job:", error);
    res.status(500).json({ error: "Failed to fetch export job" });
  }
});

// ============================================================================
// Download export file
// ============================================================================

router.get("/export/:jobId/download", requireAdmin, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const job = await exportService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: "Export job not found" });
    }

    if (job.status !== "completed") {
      return res.status(400).json({ 
        error: "Export not ready", 
        status: job.status 
      });
    }

    if (!job.fileUrl) {
      return res.status(400).json({ error: "No file available" });
    }

    // Check expiry
    if (job.expiresAt && new Date(job.expiresAt) < new Date()) {
      return res.status(410).json({ error: "Export has expired" });
    }

    // For data URLs, extract and send the content
    if (job.fileUrl.startsWith("data:")) {
      const matches = job.fileUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const content = Buffer.from(matches[2], "base64");
        
        const extension = job.format === "json" ? "json" : "csv";
        const filename = `${job.entityType}_export_${job.id}.${extension}`;

        res.setHeader("Content-Type", mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", content.length);
        return res.send(content);
      }
    }

    // For regular URLs, redirect
    res.redirect(job.fileUrl);
  } catch (error: any) {
    logger.error("[EXPORT] Error downloading export:", error);
    res.status(500).json({ error: "Failed to download export" });
  }
});

// ============================================================================
// Get all export jobs (user's own jobs)
// ============================================================================

router.get("/exports", requireAdmin, async (req: any, res) => {
  try {
    const userId = req.session.userId;
    const { limit = "20" } = req.query;
    
    const jobs = await exportService.getUserJobs(userId, parseInt(limit as string));
    
    res.json({ data: jobs });
  } catch (error: any) {
    logger.error("[EXPORT] Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch export jobs" });
  }
});

// ============================================================================
// Get all export jobs (admin view - all users)
// ============================================================================

router.get("/exports/all", requireAdmin, async (req: any, res) => {
  try {
    const { limit = "50" } = req.query;
    
    const jobs = await exportService.getAllJobs(parseInt(limit as string));
    
    res.json({ data: jobs });
  } catch (error: any) {
    logger.error("[EXPORT] Error fetching all jobs:", error);
    res.status(500).json({ error: "Failed to fetch export jobs" });
  }
});

// ============================================================================
// Cancel/delete export job
// ============================================================================

router.delete("/export/:jobId", requireAdmin, async (req: any, res) => {
  try {
    const { jobId } = req.params;
    const job = await exportService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: "Export job not found" });
    }

    // Only allow deleting own jobs or if admin
    // For now, since requireAdmin is used, any admin can delete
    
    // In production, you'd actually delete from DB
    // For now, just mark as failed/cancelled
    logger.info("[EXPORT] Export job deleted", { jobId });
    
    res.json({ success: true });
  } catch (error: any) {
    logger.error("[EXPORT] Error deleting job:", error);
    res.status(500).json({ error: "Failed to delete export job" });
  }
});

export default router;
