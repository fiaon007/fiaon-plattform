import { Router } from 'express';
import { db } from '../db';
import { n8nEmailLogs } from '@shared/schema';
import { desc, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/admin';
import { n8nService } from '../n8n-service';
import { logger } from '../logger';

const router = Router();

// ==========================================
// EMAIL LOGS - Tracking & Analytics
// ==========================================

/**
 * GET /api/admin/n8n/emails
 * Get paginated list of all sent emails
 */
router.get('/emails', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    logger.info('[N8N-ADMIN] Fetching emails', { page, limit });

    // Get paginated emails
    const emails = await db
      .select()
      .from(n8nEmailLogs)
      .orderBy(desc(n8nEmailLogs.sentAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(n8nEmailLogs);

    const totalCount = Number(count);
    const totalPages = Math.ceil(totalCount / limit);

    res.json({
      data: emails,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching emails:', error);
    res.status(500).json({
      error: 'Failed to fetch emails',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/n8n/emails/stats
 * Get aggregated email statistics
 */
router.get('/emails/stats', requireAdmin, async (req, res) => {
  try {
    logger.info('[N8N-ADMIN] Fetching email stats');

    // Get aggregated stats
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        sent: sql<number>`count(*) filter (where status = 'sent')::int`,
        delivered: sql<number>`count(*) filter (where status = 'delivered')::int`,
        opened: sql<number>`count(*) filter (where status = 'opened')::int`,
        clicked: sql<number>`count(*) filter (where status = 'clicked')::int`,
        bounced: sql<number>`count(*) filter (where status = 'bounced')::int`,
        failed: sql<number>`count(*) filter (where status = 'failed')::int`,
        todayCount: sql<number>`count(*) filter (where sent_at >= current_date)::int`,
        last7DaysCount: sql<number>`count(*) filter (where sent_at >= current_date - interval '7 days')::int`,
        last30DaysCount: sql<number>`count(*) filter (where sent_at >= current_date - interval '30 days')::int`,
      })
      .from(n8nEmailLogs);

    // Get last email
    const [lastEmail] = await db
      .select()
      .from(n8nEmailLogs)
      .orderBy(desc(n8nEmailLogs.sentAt))
      .limit(1);

    // Calculate success rate
    const successRate = stats.total > 0
      ? Math.round(((stats.delivered + stats.opened + stats.clicked) / stats.total) * 100)
      : 0;

    // Calculate open rate
    const openRate = stats.delivered > 0
      ? Math.round((stats.opened / stats.delivered) * 100)
      : 0;

    res.json({
      ...stats,
      successRate,
      openRate,
      lastEmailAt: lastEmail?.sentAt || null,
      lastEmailRecipient: lastEmail?.recipient || null,
      lastEmailSubject: lastEmail?.subject || null
    });

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching email stats:', error);
    res.status(500).json({
      error: 'Failed to fetch email stats',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/n8n/emails/:id
 * Get single email by ID
 */
router.get('/emails/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const emailId = parseInt(id);

    if (isNaN(emailId)) {
      return res.status(400).json({ error: 'Invalid email ID' });
    }

    const [email] = await db
      .select()
      .from(n8nEmailLogs)
      .where(sql`${n8nEmailLogs.id} = ${emailId}`)
      .limit(1);

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(email);

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching email:', error);
    res.status(500).json({
      error: 'Failed to fetch email',
      message: error.message
    });
  }
});

// ==========================================
// WORKFLOWS - Management & Control
// ==========================================

/**
 * GET /api/admin/n8n/workflows
 * Get all N8N workflows with status
 */
router.get('/workflows', requireAdmin, async (req, res) => {
  try {
    logger.info('[N8N-ADMIN] Fetching workflows');

    const workflows = await n8nService.getWorkflows();

    res.json(workflows);

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching workflows:', error);
    res.status(500).json({
      error: 'Failed to fetch workflows',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/n8n/workflows/:id
 * Get single workflow details
 */
router.get('/workflows/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[N8N-ADMIN] Fetching workflow', { id });

    const workflow = await n8nService.getWorkflow(id);

    res.json(workflow);

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching workflow:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/n8n/workflows/:id/activate
 * Activate a workflow
 */
router.post('/workflows/:id/activate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[N8N-ADMIN] Activating workflow', { id });

    const result = await n8nService.activateWorkflow(id);

    res.json({
      success: true,
      workflow: result,
      message: `Workflow ${result.name} activated`
    });

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error activating workflow:', error);
    res.status(500).json({
      error: 'Failed to activate workflow',
      message: error.message
    });
  }
});

/**
 * POST /api/admin/n8n/workflows/:id/deactivate
 * Deactivate a workflow
 */
router.post('/workflows/:id/deactivate', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[N8N-ADMIN] Deactivating workflow', { id });

    const result = await n8nService.deactivateWorkflow(id);

    res.json({
      success: true,
      workflow: result,
      message: `Workflow ${result.name} deactivated`
    });

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error deactivating workflow:', error);
    res.status(500).json({
      error: 'Failed to deactivate workflow',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/n8n/workflows/:id/stats
 * Get workflow statistics
 */
router.get('/workflows/:id/stats', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[N8N-ADMIN] Fetching workflow stats', { id });

    const stats = await n8nService.getWorkflowStats(id);

    res.json(stats);

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching workflow stats:', error);
    res.status(500).json({
      error: 'Failed to fetch workflow stats',
      message: error.message
    });
  }
});

// ==========================================
// EXECUTIONS - Workflow Run History
// ==========================================

/**
 * GET /api/admin/n8n/executions
 * Get workflow executions with optional filtering
 */
router.get('/executions', requireAdmin, async (req, res) => {
  try {
    const workflowId = req.query.workflowId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    logger.info('[N8N-ADMIN] Fetching executions', { workflowId, limit });

    const executions = await n8nService.getExecutions(workflowId, limit);

    res.json(executions);

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching executions:', error);
    res.status(500).json({
      error: 'Failed to fetch executions',
      message: error.message
    });
  }
});

/**
 * GET /api/admin/n8n/executions/:id
 * Get single execution details
 */
router.get('/executions/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    logger.info('[N8N-ADMIN] Fetching execution', { id });

    const execution = await n8nService.getExecution(id);

    res.json(execution);

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Error fetching execution:', error);
    res.status(500).json({
      error: 'Failed to fetch execution',
      message: error.message
    });
  }
});

// ==========================================
// HEALTH CHECK
// ==========================================

/**
 * GET /api/admin/n8n/health
 * Check N8N API connectivity
 */
router.get('/health', requireAdmin, async (req, res) => {
  try {
    logger.info('[N8N-ADMIN] Health check');

    const isHealthy = await n8nService.healthCheck();

    res.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[N8N-ADMIN] Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
