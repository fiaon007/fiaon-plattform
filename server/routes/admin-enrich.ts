/**
 * 🔥 ADMIN ENRICHMENT ROUTES
 * POST /api/admin/users/:id/enrich - Re-enrich a user's profile
 */

import { Router } from "express";
import { requireAdmin } from "../middleware/admin";
import { forceReEnrich } from "../services/enrichment.service";
import { storage } from "../storage";

const router = Router();

/**
 * POST /api/admin/users/:id/enrich
 * Re-enrich a user's AI profile
 * 
 * Body: { force?: boolean }
 * - If profileEnriched=true and force!==true → 409 Conflict
 * - If force=true → reset attempts and start new enrichment
 */
router.post("/users/:id/enrich", requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { force } = req.body;
    
    // Get user first to check status
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    // Check if already enriched and not forcing
    if (user.profileEnriched && force !== true) {
      return res.status(409).json({ 
        success: false, 
        message: "User already has enriched profile. Use force=true to re-enrich.",
        currentStatus: {
          profileEnriched: user.profileEnriched,
          enrichmentStatus: (user.aiProfile as any)?.enrichmentStatus || null,
          lastUpdated: (user.aiProfile as any)?.enrichmentMeta?.lastUpdated || null
        }
      });
    }
    
    // Check if user has company/industry for enrichment
    if (!user.company || !user.industry) {
      return res.status(400).json({ 
        success: false, 
        message: "User has no company or industry data for enrichment" 
      });
    }
    
    // Trigger re-enrichment
    const result = await forceReEnrich(id);
    
    // Log admin action
    console.log('[admin.enrich]', JSON.stringify({
      timestamp: new Date().toISOString(),
      adminUserId: req.adminUser?.id,
      targetUserId: id,
      force: !!force,
      result: result.success ? 'started' : 'failed'
    }));
    
    if (result.success) {
      return res.status(202).json({ 
        success: true, 
        message: "Enrichment job started",
        status: "queued"
      });
    } else {
      return res.status(500).json({ 
        success: false, 
        message: result.message 
      });
    }
    
  } catch (error: any) {
    console.error('[admin.enrich.error]', error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to start enrichment",
      error: error.message 
    });
  }
});

// 🔥 STEP 6B: Status label mapping (same as context-builder.ts)
const STATUS_LABELS: Record<string, string> = {
  'live_research': 'Up to date',
  'queued': 'In progress',
  'in_progress': 'In progress',
  'fallback': 'Limited'
};

/**
 * GET /api/admin/users/:id/enrichment-status
 * Get current enrichment status for a user
 * 🔥 STEP 6B: Includes statusLabel for consistent Admin UI display
 */
router.get("/users/:id/enrichment-status", requireAdmin, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    const user = await storage.getUser(id);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: "User not found" 
      });
    }
    
    const aiProfile = user.aiProfile as any;
    const enrichmentMeta = aiProfile?.enrichmentMeta || {};
    
    // 🔥 STEP 6B: Determine effective status and label
    const effectiveStatus = enrichmentMeta.status || aiProfile?.enrichmentStatus || 'fallback';
    const statusLabel = STATUS_LABELS[effectiveStatus] || 'Limited';
    
    // 🔥 STEP 6B: Ensure profileEnriched is false for queued/in_progress
    const isComplete = effectiveStatus === 'live_research';
    const profileEnrichedActual = isComplete && user.profileEnriched;
    
    return res.json({
      success: true,
      userId: id,
      profileEnriched: profileEnrichedActual,
      enrichmentStatus: effectiveStatus,
      statusLabel,  // 🔥 STEP 6B: Human-readable label for Admin UI
      enrichmentErrorCode: enrichmentMeta.errorCode || aiProfile?.enrichmentErrorCode || null,
      enrichmentMeta: {
        status: enrichmentMeta.status || null,
        errorCode: enrichmentMeta.errorCode || null,
        lastUpdated: enrichmentMeta.lastUpdated || null,
        attempts: enrichmentMeta.attempts || 0,
        nextRetryAt: enrichmentMeta.nextRetryAt || null,
        confidence: enrichmentMeta.confidence || null
      },
      lastEnrichmentDate: user.lastEnrichmentDate
    });
    
  } catch (error: any) {
    console.error('[admin.enrichment-status.error]', error);
    return res.status(500).json({ 
      success: false, 
      message: "Failed to get enrichment status",
      error: error.message 
    });
  }
});

export default router;
