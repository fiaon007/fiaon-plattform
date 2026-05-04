/**
 * ============================================================================
 * CEO MIND-OS — REST API
 * ============================================================================
 * Mounted at /api/ceo-mind-os
 *
 *   POST   /analyze               — analyze thought (no persistence)
 *   POST   /                      — create strategy (persists thought + analysis)
 *   GET    /                      — list strategies (?status=active|done|failed|archived)
 *   GET    /:id                   — single strategy
 *   PATCH  /:id                   — update status / failure_reason
 *   DELETE /:id                   — delete strategy
 *   POST   /:id/failure           — analyze failure + save failure_reason
 *   POST   /:id/template          — (re)generate a magic template for a strategy
 *   GET    /health                — health / config status
 * ============================================================================
 */

import { Router } from 'express';
import { client } from '../db';
import { logger } from '../logger';
import {
  analyzeThought,
  analyzeFailure,
  generateTemplate,
  isCeoAgentConfigured,
  isTavilyConfigured,
  type CeoAnalysis,
  type TemplateKind,
} from '../services/ceoAgent';

const router = Router();

// ============================================================================
// HELPERS
// ============================================================================

function makeId(): string {
  return `strat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type DbStrategy = {
  id: string;
  user_id: string | null;
  user_thought: string;
  ai_analysis: any;
  category: string | null;
  status: 'active' | 'done' | 'failed' | 'archived';
  failure_reason: string | null;
  resources: any;
  created_at: string;
  updated_at: string;
};

function formatStrategy(row: any) {
  return {
    id: String(row.id),
    userId: row.user_id || null,
    thought: row.user_thought,
    analysis: (row.ai_analysis || null) as CeoAnalysis | null,
    category: row.category || row.ai_analysis?.category || 'general',
    status: row.status || 'active',
    failureReason: row.failure_reason || null,
    resources: row.resources || row.ai_analysis?.resources || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getStrategyById(id: string): Promise<any | null> {
  const rows = await client`SELECT * FROM ceo_strategies WHERE id = ${id} LIMIT 1`;
  return rows[0] || null;
}

async function getRecentThoughts(limit = 10): Promise<string[]> {
  try {
    const rows = await client`
      SELECT user_thought FROM ceo_strategies
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;
    return rows.map((r: any) => String(r.user_thought || '')).filter(Boolean);
  } catch {
    return [];
  }
}

// ============================================================================
// HEALTH / CONFIG
// ============================================================================

router.get('/health', (_req, res) => {
  res.json({
    ok: true,
    groq: isCeoAgentConfigured(),
    tavily: isTavilyConfigured(),
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  });
});

// ============================================================================
// ANALYZE (stateless)
// ============================================================================

router.post('/analyze', async (req, res) => {
  try {
    const thought = String(req.body?.thought || '').trim();
    if (!thought) {
      return res.status(400).json({ error: 'thought is required' });
    }
    if (thought.length > 4000) {
      return res.status(400).json({ error: 'thought too long (max 4000 chars)' });
    }

    const history = await getRecentThoughts(8);
    const analysis = await analyzeThought(thought, history);
    res.json({ analysis });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] /analyze error: ${err?.message || err}`);
    res.status(500).json({ error: 'analysis_failed', detail: String(err?.message || err) });
  }
});

// ============================================================================
// CREATE (analyze + persist)
// ============================================================================

router.post('/', async (req, res) => {
  try {
    const thought = String(req.body?.thought || '').trim();
    if (!thought) {
      return res.status(400).json({ error: 'thought is required' });
    }
    if (thought.length > 4000) {
      return res.status(400).json({ error: 'thought too long (max 4000 chars)' });
    }

    // If client already ran /analyze, they can pass the analysis to avoid double-calling Groq.
    const preAnalysis = req.body?.analysis as CeoAnalysis | undefined;
    const history = await getRecentThoughts(8);
    const analysis = preAnalysis || (await analyzeThought(thought, history));

    const userId =
      (req.user as any)?.id || (req.session as any)?.userId || null;

    const id = makeId();
    const analysisJson = JSON.stringify(analysis);
    const resourcesJson = JSON.stringify(analysis.resources || []);

    const rows = await client`
      INSERT INTO ceo_strategies
        (id, user_id, user_thought, ai_analysis, category, status, resources)
      VALUES (
        ${id},
        ${userId},
        ${thought},
        ${analysisJson}::jsonb,
        ${analysis.category},
        'active',
        ${resourcesJson}::jsonb
      )
      RETURNING *
    `;

    res.json(formatStrategy(rows[0]));
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] POST / error: ${err?.message || err}`);
    res.status(500).json({ error: 'create_failed', detail: String(err?.message || err) });
  }
});

// ============================================================================
// LIST
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const limitRaw = parseInt(String(req.query.limit || '100'), 10);
    const limit = Number.isFinite(limitRaw) ? Math.min(500, Math.max(1, limitRaw)) : 100;

    const rows =
      status && ['active', 'done', 'failed', 'archived'].includes(status)
        ? await client`
            SELECT * FROM ceo_strategies
            WHERE status = ${status}
            ORDER BY created_at DESC
            LIMIT ${limit}
          `
        : await client`
            SELECT * FROM ceo_strategies
            ORDER BY created_at DESC
            LIMIT ${limit}
          `;

    res.json(rows.map(formatStrategy));
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] GET / error: ${err?.message || err}`);
    res.status(500).json({ error: 'list_failed', detail: String(err?.message || err) });
  }
});

// ============================================================================
// READ
// ============================================================================

router.get('/:id', async (req, res) => {
  try {
    const row = await getStrategyById(req.params.id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    res.json(formatStrategy(row));
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] GET /:id error: ${err?.message || err}`);
    res.status(500).json({ error: 'read_failed' });
  }
});

// ============================================================================
// UPDATE
// ============================================================================

router.patch('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const row = await getStrategyById(id);
    if (!row) return res.status(404).json({ error: 'not_found' });

    const incomingStatus = req.body?.status;
    const validStatus =
      typeof incomingStatus === 'string' &&
      ['active', 'done', 'failed', 'archived'].includes(incomingStatus)
        ? incomingStatus
        : null;

    const failureReason =
      typeof req.body?.failureReason === 'string' ? req.body.failureReason.trim() : null;

    const updates: Record<string, any> = {};
    if (validStatus) updates.status = validStatus;
    if (failureReason !== null) updates.failure_reason = failureReason;
    updates.updated_at = new Date();

    const keys = Object.keys(updates);
    if (keys.length === 1) {
      // Nur updated_at => nichts zu tun
      return res.json(formatStrategy(row));
    }

    const result = await client`
      UPDATE ceo_strategies
      SET ${client(updates, keys as any)}
      WHERE id = ${id}
      RETURNING *
    `;
    res.json(formatStrategy(result[0]));
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] PATCH /:id error: ${err?.message || err}`);
    res.status(500).json({ error: 'update_failed' });
  }
});

// ============================================================================
// DELETE
// ============================================================================

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const row = await getStrategyById(id);
    if (!row) return res.status(404).json({ error: 'not_found' });
    await client`DELETE FROM ceo_strategies WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] DELETE /:id error: ${err?.message || err}`);
    res.status(500).json({ error: 'delete_failed' });
  }
});

// ============================================================================
// FAILURE ANALYSIS
// ============================================================================

router.post('/:id/failure', async (req, res) => {
  try {
    const id = req.params.id;
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'reason is required' });

    const row = await getStrategyById(id);
    if (!row) return res.status(404).json({ error: 'not_found' });

    const analysis = await analyzeFailure(
      row.user_thought,
      row.ai_analysis || null,
      reason
    );

    const enrichedAnalysis = {
      ...(row.ai_analysis || {}),
      failureAnalysis: analysis,
    };

    const result = await client`
      UPDATE ceo_strategies
      SET
        status = 'failed',
        failure_reason = ${reason},
        ai_analysis = ${JSON.stringify(enrichedAnalysis)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({
      strategy: formatStrategy(result[0]),
      failureAnalysis: analysis,
    });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] POST /:id/failure error: ${err?.message || err}`);
    res.status(500).json({ error: 'failure_analysis_failed', detail: String(err?.message || err) });
  }
});

// ============================================================================
// ON-DEMAND TEMPLATE GENERATION
// ============================================================================

router.post('/:id/template', async (req, res) => {
  try {
    const id = req.params.id;
    const row = await getStrategyById(id);
    if (!row) return res.status(404).json({ error: 'not_found' });

    const requestedKind = req.body?.kind as Exclude<TemplateKind, null> | undefined;
    const template = await generateTemplate(
      row.user_thought,
      row.ai_analysis || null,
      requestedKind
    );

    const enrichedAnalysis = {
      ...(row.ai_analysis || {}),
      magicTemplate: template,
    };

    const result = await client`
      UPDATE ceo_strategies
      SET
        ai_analysis = ${JSON.stringify(enrichedAnalysis)}::jsonb,
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    res.json({
      strategy: formatStrategy(result[0]),
      template,
    });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] POST /:id/template error: ${err?.message || err}`);
    res.status(500).json({ error: 'template_failed', detail: String(err?.message || err) });
  }
});

export default router;
