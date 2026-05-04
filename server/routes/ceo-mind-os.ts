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
import Groq from 'groq-sdk';
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
// SPECIFIC ROUTES (must be before /:id parameterized routes)
// ============================================================================

/**
 * GET /api/ceo-mind-os/inbox
 */
router.get('/inbox', async (req, res) => {
  try {
    const rows = await client`
      SELECT * FROM ceo_inbound_mails
      WHERE status = 'new'
      ORDER BY 
        CASE priority_level
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
      LIMIT 50
    `;

    const mails = rows.map((r: any) => ({
      id: r.id,
      sender: r.sender,
      senderEmail: r.sender_email,
      subject: r.subject,
      contentSummary: r.content_summary,
      aiActionTaken: r.ai_action_taken,
      priorityLevel: r.priority_level,
      status: r.status,
      linkedStrategyId: r.linked_strategy_id,
      linkedTodoId: r.linked_todo_id,
      createdAt: r.created_at,
    }));

    res.json({ mails, count: mails.length });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] GET /inbox error: ${err?.message || err}`);
    res.status(500).json({ error: 'inbox_fetch_failed', detail: String(err?.message || err) });
  }
});

/**
 * PATCH /api/ceo-mind-os/inbox/:id
 */
router.patch('/inbox/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatus =
      typeof status === 'string' && ['new', 'processing', 'processed', 'archived'].includes(status)
        ? status
        : 'processed';

    await client`
      UPDATE ceo_inbound_mails
      SET
        status = ${validStatus},
        processed_at = ${validStatus === 'processed' ? new Date() : null}
      WHERE id = ${id}
    `;

    res.json({ success: true, id, status: validStatus });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] PATCH /inbox/:id error: ${err?.message || err}`);
    res.status(500).json({ error: 'inbox_update_failed', detail: String(err?.message || err) });
  }
});

/**
 * GET /api/ceo-mind-os/morning-briefing
 */
router.get('/morning-briefing', async (req, res) => {
  try {
    const [newMailsCount] = await client`
      SELECT COUNT(*) as count FROM ceo_inbound_mails WHERE status = 'new'
    `;
    const [criticalMailsCount] = await client`
      SELECT COUNT(*) as count FROM ceo_inbound_mails 
      WHERE status = 'new' AND priority_level = 'critical'
    `;
    const [openStrategiesCount] = await client`
      SELECT COUNT(*) as count FROM ceo_strategies WHERE status = 'active'
    `;

    const recentEmailRows = await client`
      SELECT sender, subject, priority_level
      FROM ceo_inbound_mails
      WHERE status = 'new'
      ORDER BY created_at DESC
      LIMIT 5
    `;

    const recentEmails = recentEmailRows.map((r: any) => ({
      sender: r.sender || 'Unknown',
      subject: r.subject || '',
      priority_level: r.priority_level || 'normal',
    }));

    const { generateMorningBriefing } = await import('../services/ceoAgent');
    const briefing = await generateMorningBriefing(
      Number(newMailsCount.count) || 0,
      Number(criticalMailsCount.count) || 0,
      Number(openStrategiesCount.count) || 0,
      recentEmails
    );

    res.json({
      briefing,
      stats: {
        newMails: Number(newMailsCount.count) || 0,
        criticalMails: Number(criticalMailsCount.count) || 0,
        openStrategies: Number(openStrategiesCount.count) || 0,
      },
    });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] GET /morning-briefing error: ${err?.message || err}`);
    res.status(500).json({ error: 'briefing_failed', detail: String(err?.message || err) });
  }
});

/**
 * POST /api/ceo-mind-os/inbound-mail
 * CloudMailin Webhook - EXTREMELY TOLERANT (accepts all formats)
 */
router.post('/inbound-mail', async (req, res) => {
  // ============================================================================
  // TEIL 1: DEBUG LOGGING (BEFORE ANYTHING ELSE)
  // ============================================================================
  console.log('\n========== [JARVIS-MAIL] INCOMING WEBHOOK ==========');
  console.log('[JARVIS-MAIL] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[JARVIS-MAIL] Received Body:', JSON.stringify(req.body, null, 2));
  console.log('====================================================\n');

  // ============================================================================
  // TEIL 2: IMMEDIATE 200 OK (CloudMailin needs fast response)
  // ============================================================================
  res.status(200).send('OK');

  // ============================================================================
  // TEIL 3: ASYNC PROCESSING (after response sent)
  // ============================================================================
  setImmediate(async () => {
    try {
      // Tolerant parsing for CloudMailin formats
      const body = req.body;
      
      // Extract subject (multiple possible locations)
      let subject = 
        body.subject || 
        body.Subject ||
        body.headers?.Subject || 
        body.headers?.subject ||
        body.envelope?.to ||
        'Kein Betreff';

      // Extract sender (multiple possible locations)
      let sender = 
        body.from || 
        body.From ||
        body.headers?.From || 
        body.headers?.from ||
        body.envelope?.from ||
        'Unknown Sender';

      // Extract sender email
      let senderEmail = sender;
      // If sender is in format "Name <email@example.com>", extract email
      const emailMatch = sender.match(/<(.+?)>/);
      if (emailMatch) {
        senderEmail = emailMatch[1];
      }

      // Extract body content (multiple possible locations)
      let content = 
        body.plain || 
        body.text ||
        body.body ||
        body.html ||
        body['body-plain'] ||
        body['body-html'] ||
        '';

      // If content is still empty, try to extract from nested structures
      if (!content && typeof body === 'object') {
        // CloudMailin sometimes nests content
        content = JSON.stringify(body).slice(0, 500);
      }

      console.log('[JARVIS-MAIL] Parsed:');
      console.log('  Subject:', subject);
      console.log('  Sender:', sender);
      console.log('  Email:', senderEmail);
      console.log('  Content length:', content.length);

      // Skip processing if no meaningful data
      if (!subject || subject === 'Kein Betreff') {
        logger.warn('[JARVIS-MAIL] Skipped: No valid subject found');
        return;
      }

      const mailId = `mail_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      // Context-Awareness: Get recent emails
      const recentRows = await client`
        SELECT sender, subject, content_summary
        FROM ceo_inbound_mails
        ORDER BY created_at DESC
        LIMIT 10
      `;
      const recentEmails = recentRows.map((r: any) => ({
        sender: r.sender || '',
        subject: r.subject || '',
        content_summary: r.content_summary || '',
      }));

      // AI Analysis
      const { analyzeEmail } = await import('../services/ceoAgent');
      const analysis = await analyzeEmail(sender, subject, content, recentEmails);

      // Save to database
      await client`
        INSERT INTO ceo_inbound_mails (
          id, sender, sender_email, subject, content_summary, full_body,
          ai_action_taken, priority_level, status, created_at
        )
        VALUES (
          ${mailId}, ${sender}, ${senderEmail}, ${subject},
          ${analysis.summary}, ${content}, ${analysis.actionType},
          ${analysis.priorityLevel}, 'new', NOW()
        )
      `;

      let linkedStrategyId: string | null = null;
      let linkedTodoId: string | null = null;

      // Auto-create TODO if needed
      if (analysis.shouldCreateTodo && analysis.todoTitle) {
        const todoId = `todo_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await client`
          INSERT INTO team_todos (id, title, description, status, urgency_score, created_at)
          VALUES (
            ${todoId}, ${analysis.todoTitle},
            ${'E-Mail von ' + sender + ': ' + subject}, 'pending',
            ${analysis.priorityLevel === 'critical' ? 95 : analysis.priorityLevel === 'high' ? 80 : 60},
            NOW()
          )
        `;
        linkedTodoId = todoId;
      }

      // Auto-create STRATEGY if needed
      if (analysis.shouldCreateStrategy && analysis.strategyThought) {
        const strategyId = `strat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        await client`
          INSERT INTO ceo_strategies (id, user_thought, status, created_at, updated_at)
          VALUES (${strategyId}, ${analysis.strategyThought}, 'active', NOW(), NOW())
        `;
        linkedStrategyId = strategyId;
      }

      // Update links
      if (linkedStrategyId || linkedTodoId) {
        await client`
          UPDATE ceo_inbound_mails
          SET
            linked_strategy_id = ${linkedStrategyId},
            linked_todo_id = ${linkedTodoId}
          WHERE id = ${mailId}
        `;
      }

      logger.info(`[JARVIS-MAIL] ✅ Processed: ${analysis.actionType} (${analysis.priorityLevel}) - "${subject.slice(0, 50)}"`);
      
    } catch (err: any) {
      logger.error(`[JARVIS-MAIL] ❌ Async processing error: ${err?.message || err}`);
      logger.error(err.stack);
    }
  });
});

/**
 * POST /api/ceo-mind-os/generate-reply
 * Generates AI draft reply for an email
 */
router.post('/generate-reply', async (req, res) => {
  try {
    const { mailId, sender, subject, content } = req.body;

    if (!mailId || !sender || !subject) {
      return res.status(400).json({ error: 'mailId, sender, and subject required' });
    }

    // Generate reply using Groq
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
    
    const prompt = `You are a professional executive assistant. Generate a polite, professional email reply.

Original Email:
From: ${sender}
Subject: ${subject}
Content: ${content}

Generate a professional German reply that:
- Addresses the sender's concerns
- Is polite and executive-level professional
- Keeps it concise (2-3 paragraphs max)
- Uses "Sehr geehrte/r" greeting and "Mit freundlichen Grüßen" closing

Reply:`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.7,
      max_tokens: 500,
    });

    const reply = completion.choices[0]?.message?.content || 'Sehr geehrte/r ' + sender + ',\n\nvielen Dank für Ihre Nachricht.\n\nMit freundlichen Grüßen';

    logger.info(`[CEO-HUB] Generated reply for: ${mailId}`);

    res.json({ reply });
  } catch (err: any) {
    logger.error(`[CEO-HUB] Generate reply error: ${err?.message || err}`);
    res.status(500).json({ error: 'reply_generation_failed', detail: String(err?.message || err) });
  }
});

/**
 * POST /api/ceo-mind-os/voice-input
 */
router.post('/voice-input', async (req, res) => {
  try {
    const { audioData, audioFormat } = req.body;

    if (!audioData) {
      return res.status(400).json({ error: 'audioData required' });
    }

    const { transcribeAudio } = await import('../services/ceoAgent');
    const transcription = await transcribeAudio(audioData, audioFormat || 'webm');

    if (!transcription || !transcription.trim()) {
      return res.status(400).json({ 
        error: 'transcription_empty', 
        detail: 'Keine Sprache erkannt. Bitte erneut versuchen.' 
      });
    }

    const analysis = await analyzeThought(transcription);

    const strategyId = `strat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await client`
      INSERT INTO ceo_strategies (
        id, user_thought, ai_analysis, category, status, created_at, updated_at
      )
      VALUES (
        ${strategyId}, ${transcription}, ${JSON.stringify(analysis)}::jsonb,
        ${analysis.category || null}, 'active', NOW(), NOW()
      )
    `;

    logger.info(`[CEO-MIND-OS] Voice input processed: "${transcription.slice(0, 50)}..."`);

    res.json({
      transcription,
      analysis,
      strategyId,
    });
  } catch (err: any) {
    logger.error(`[CEO-MIND-OS] POST /voice-input error: ${err?.message || err}`);
    res.status(500).json({ error: 'voice_input_failed', detail: String(err?.message || err) });
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
