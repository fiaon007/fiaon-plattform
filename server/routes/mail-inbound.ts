import { Router, Request, Response } from 'express';
import { db } from '../db';
import { 
  mailInbound, 
  internalContacts,
  MAIL_INBOUND_STATUSES, 
  MAIL_STATUS_TRANSITIONS,
  MAIL_CATEGORIES, 
  MAIL_PRIORITIES,
  MailInboundStatus 
} from '@shared/schema';
import { randomUUID } from 'crypto';
import { eq, desc, and, sql, ilike, or, lt } from 'drizzle-orm';
import { logger } from '../logger';
import { requireAdmin } from '../middleware/admin';
import { requireStaffOrAdmin } from '../middleware/staff';
import { triageEmail } from '../services/mail-ai';

const router = Router();

// Startup log (once)
logger.info('[MAIL-INBOUND] Routes initialized (direct db mode)');

// ============================================================================
// STATUS TRANSITION GUARD
// ============================================================================
// Validates that a status transition is allowed per the state machine
// Returns null if valid, or error message if invalid

function validateStatusTransition(
  currentStatus: string,
  targetStatus: MailInboundStatus
): string | null {
  // ARCHIVED is always allowed from any state (except itself)
  if (targetStatus === 'ARCHIVED' && currentStatus !== 'ARCHIVED') {
    return null;
  }
  
  const allowed = MAIL_STATUS_TRANSITIONS[currentStatus as MailInboundStatus];
  if (!allowed) {
    return `Unknown current status: ${currentStatus}`;
  }
  
  if (!allowed.includes(targetStatus)) {
    return `Action not allowed in current state.`;  // UI-safe, no tech details
  }
  
  return null;
}

// Helper to get current user identifier (for audit trail)
function getActorId(req: Request): string {
  const user = (req as any).user;
  return user?.username || user?.email || 'unknown';
}

// ============================================================================
// SIZE LIMITS for payload fields (truncate if exceeded)
// ============================================================================
const LIMITS = {
  subject: 200,
  snippet: 500,
  bodyText: 50_000,
  bodyHtml: 100_000,
};

function truncate(str: string | undefined | null, limit: number): string {
  if (!str) return '';
  return str.length > limit ? str.slice(0, limit) : str;
}

// Helper: Extract email from various formats like "Name <email@example.com>" or plain email
function extractEmail(input: string | undefined | null): string {
  if (!input) return '';
  const match = String(input).match(/<([^>]+)>/);
  if (match) return match[1].trim();
  return String(input).replace(/[<>]/g, '').trim();
}

// Debug mode toggle
const DEBUG_RESPONSE = process.env.DEBUG_MAIL_INBOUND_RESPONSE === 'true';

// ============================================================================
// SAFE STRING HELPERS (prevent Buffer.byteLength / .length crashes on Date/Object)
// ============================================================================
const toSafeString = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  try { return JSON.stringify(v); } catch { return String(v); }
};

const safeLen = (v: unknown): number => {
  return toSafeString(v).length;
};

// Convert any timestamp value to ISO string for postgres-js driver
const toIso = (v: unknown): string | null => {
  if (v == null) return null;
  if (typeof v === 'string') return v; // ISO string already ok
  if (v instanceof Date) return v.toISOString();
  // numbers: unix ms / seconds
  if (typeof v === 'number') {
    const ms = v < 1e12 ? v * 1000 : v;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  // anything else
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const nowIso = (): string => new Date().toISOString();

// ============================================================================
// CONTACT AUTO-CREATE: upsert internal_contacts by email, return contact_id
// ============================================================================
// Non-blocking: failures are logged but never prevent mail storage
async function upsertContactByEmail(
  email: string,
  name: string | null
): Promise<string | null> {
  try {
    // Check if contact exists by email
    const [existing] = await db
      .select({ id: internalContacts.id, firstName: internalContacts.firstName })
      .from(internalContacts)
      .where(eq(internalContacts.email, email))
      .limit(1);

    if (existing) {
      // Update last seen (updatedAt) + fill name if empty
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (name && !existing.firstName) {
        const parts = name.split(' ');
        updates.firstName = parts[0] || name;
        updates.lastName = parts.slice(1).join(' ') || '';
      }
      await db
        .update(internalContacts)
        .set(updates)
        .where(eq(internalContacts.id, existing.id));
      return existing.id;
    }

    // Create new contact
    const contactId = randomUUID();
    const nameParts = (name || email.split('@')[0]).split(' ');
    const domain = email.split('@')[1] || '';

    await db
      .insert(internalContacts)
      .values({
        id: contactId,
        firstName: nameParts[0] || email.split('@')[0],
        lastName: nameParts.slice(1).join(' ') || '',
        email,
        source: 'Inbound Mail',
        status: 'NEW',
        notes: domain ? `Auto-created from inbound mail. Domain: ${domain}` : 'Auto-created from inbound mail.',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    logger.info(`[CONTACT-AUTOCREATE] Created contact id=${contactId} for ${email}`);
    return contactId;
  } catch (err: any) {
    // Non-critical - log and return null
    logger.warn(`[CONTACT-AUTOCREATE] Failed for ${email}: ${err.message}`);
    return null;
  }
}

// ============================================================================
// SHARED HANDLER: Gmail Inbound Webhook
// ============================================================================
// Used by both /webhook/gmail-inbound and /n8n/webhook/gmail-inbound
async function handleGmailInbound(req: Request, res: Response) {
  try {

    // 1. Secret check
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    const providedSecret = req.headers['x-aras-webhook-secret'];

    if (!webhookSecret) {
      logger.warn('[MAIL-INBOUND-WEBHOOK] N8N_WEBHOOK_SECRET not configured');
      return res.status(500).json({ ok: false, error: 'Webhook secret not configured' });
    }

    if (providedSecret !== webhookSecret) {
      logger.warn('[MAIL-INBOUND-WEBHOOK] Invalid webhook secret');
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    // 2. Parse payload with ROBUST MAPPING (all variants)
    const raw = req.body || {};
    const rawKeys = Object.keys(raw);
    
    // --- ROBUST FIELD EXTRACTION ---
    // messageId: multiple fallbacks
    const messageId = raw.messageId || raw.message_id || raw.id || '';
    
    // from.email: multiple fallbacks with <email> parsing
    const fromEmailRaw = raw.from?.email 
      || raw.fromEmail 
      || raw.from_email 
      || raw.From 
      || raw.headers?.from 
      || raw.headers?.From 
      || (typeof raw.from === 'string' ? raw.from : '');
    const fromEmail = extractEmail(fromEmailRaw);
    
    // from.name: multiple fallbacks
    const fromName = raw.from?.name || raw.fromName || raw.from_name || null;
    
    // subject: multiple fallbacks (camelCase, PascalCase, headers)
    const subjectRaw = raw.subject 
      || raw.Subject 
      || raw.headers?.subject 
      || raw.headers?.Subject 
      || '';
    
    // snippet: multiple fallbacks
    const snippetRaw = raw.snippet || raw.Snippet || '';
    
    // bodyText: multiple fallbacks (n8n uses textPlain, also try text, body)
    const bodyTextRaw = raw.bodyText 
      || raw.textPlain 
      || raw.text 
      || raw.body_text 
      || raw.body 
      || raw.Body 
      || '';
    
    // bodyHtml: multiple fallbacks (n8n uses textHtml)
    const bodyHtmlRaw = raw.bodyHtml 
      || raw.textHtml 
      || raw.html 
      || raw.body_html 
      || raw.Html 
      || '';
    
    // receivedAt: multiple fallbacks
    const receivedAtRaw = raw.receivedAt || raw.received_at || raw.date || raw.internalDate;

    // --- DEBUG LOGGING ---
    const snipLen = safeLen(snippetRaw);
    const txtLen = safeLen(bodyTextRaw);
    const htmlLen = safeLen(bodyHtmlRaw);
    
    logger.info('[MAIL-INBOUND-WEBHOOK] Incoming payload debug', {
      messageId: messageId || '(missing)',
      subject: (subjectRaw || '').slice(0, 50),
      fromEmail: fromEmail || '(missing)',
      snipLen,
      txtLen,
      htmlLen,
      rawKeys,
    });

    // Validate required fields
    if (!messageId) {
      logger.warn('[MAIL-INBOUND-WEBHOOK] Missing required field: messageId');
      return res.status(400).json({ ok: false, error: 'Missing required field: messageId' });
    }
    if (!fromEmail) {
      logger.warn('[MAIL-INBOUND-WEBHOOK] Missing required field: from.email', { rawKeys });
      return res.status(400).json({ ok: false, error: 'Missing required field: from.email' });
    }

    // Parse receivedAt - Drizzle ORM handles Date to string conversion
    const receivedAtIso = toIso(receivedAtRaw) ?? nowIso();
    const receivedAtDate = new Date(receivedAtIso);

    // 3. Build payload with truncation (using robustly mapped values)
    const payload = {
      source: raw.source || 'gmail',
      messageId: String(messageId),
      threadId: raw.threadId || raw.thread_id || null,
      mailbox: raw.mailbox || raw.to?.[0]?.email || null,
      fromEmail: String(fromEmail),
      fromName,
      toEmails: Array.isArray(raw.to) 
        ? raw.to.map((t: any) => t.email || t).filter(Boolean)
        : (raw.toEmails || raw.to_emails || []),
      ccEmails: Array.isArray(raw.cc)
        ? raw.cc.map((c: any) => c.email || c).filter(Boolean)
        : (raw.ccEmails || raw.cc_emails || []),
      subject: truncate(subjectRaw, LIMITS.subject),
      snippet: truncate(snippetRaw, LIMITS.snippet),
      bodyText: truncate(bodyTextRaw, LIMITS.bodyText),
      bodyHtml: truncate(bodyHtmlRaw, LIMITS.bodyHtml),
      receivedAt: receivedAtDate,
      labels: Array.isArray(raw.labels) ? raw.labels : (raw.labelIds || []),
      meta: {
        rawPayloadHash: raw.rawPayloadHash,
        attachmentsCount: raw.attachments?.length || 0,
        hasAttachments: (raw.attachments?.length || 0) > 0,
        webhookReceivedAt: new Date().toISOString(),
      },
    };
    
    // Store lengths for optional debug response
    const debugInfo = { snipLen, txtLen, htmlLen };

    // 4. Persist (idempotent upsert) - DIRECT DB WRITE
    let resultId: number;
    let resultStatus: string;
    let isNew: boolean;
    let migrationWarning: string | null = null;

    // Try insert first, if conflict (message_id exists) then select existing
    try {
      const [inserted] = await db
        .insert(mailInbound)
        .values({
          source: payload.source,
          messageId: payload.messageId,
          threadId: payload.threadId,
          mailbox: payload.mailbox,
          fromEmail: payload.fromEmail,
          fromName: payload.fromName,
          toEmails: payload.toEmails,
          ccEmails: payload.ccEmails,
          subject: payload.subject,
          snippet: payload.snippet,
          bodyText: payload.bodyText,
          bodyHtml: payload.bodyHtml,
          receivedAt: payload.receivedAt,
          labels: payload.labels,
          status: 'NEW',
          meta: payload.meta,
          lastActionAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ id: mailInbound.id, status: mailInbound.status });

      if (inserted) {
        resultId = inserted.id;
        resultStatus = inserted.status;
        isNew = true;
      } else {
        // Conflict - record exists, fetch it
        const [existing] = await db
          .select({ id: mailInbound.id, status: mailInbound.status })
          .from(mailInbound)
          .where(eq(mailInbound.messageId, payload.messageId))
          .limit(1);
        
        if (existing) {
          resultId = existing.id;
          resultStatus = existing.status;
          isNew = false;
        } else {
          throw new Error('Insert failed and no existing record found');
        }
      }
    } catch (dbError: any) {
      // Check for missing column error - schema drift scenario
      const errorMsg = dbError.message || '';
      const colMatch = errorMsg.match(/column "([^"]+)" of relation "mail_inbound" does not exist/);
      
      if (colMatch) {
        const missingColumn = colMatch[1];
        logger.warn(`[MAIL-INBOUND-WEBHOOK] MIGRATION_REQUIRED missingColumn=${missingColumn}`);
        migrationWarning = 'migration_required';
        
        // Fallback: Insert with ONLY baseline columns (no new workflow columns)
        try {
          const fallbackResult = await db.execute<{ id: number; status: string }>(sql`
            INSERT INTO mail_inbound (
              source, mailbox, message_id, thread_id, 
              from_email, from_name, to_emails, cc_emails, 
              subject, snippet, body_text, body_html, 
              received_at, labels, status, meta, 
              created_at, updated_at
            ) VALUES (
              ${payload.source}, ${payload.mailbox}, ${payload.messageId}, ${payload.threadId},
              ${payload.fromEmail}, ${payload.fromName}, ${JSON.stringify(payload.toEmails)}::jsonb, ${JSON.stringify(payload.ccEmails)}::jsonb,
              ${payload.subject}, ${payload.snippet}, ${payload.bodyText}, ${payload.bodyHtml},
              ${receivedAtIso}, ${JSON.stringify(payload.labels)}::jsonb, 'NEW', ${JSON.stringify(payload.meta)}::jsonb,
              NOW(), NOW()
            )
            ON CONFLICT (message_id) DO NOTHING
            RETURNING id, status
          `);
          
          const rows = fallbackResult as unknown as Array<{ id: number; status: string }>;
          if (rows && rows.length > 0) {
            resultId = rows[0].id;
            resultStatus = rows[0].status;
            isNew = true;
            logger.info(`[MAIL-INBOUND-WEBHOOK] Fallback insert succeeded: id=${resultId}`);
          } else {
            // Conflict in fallback - fetch existing
            const [existing] = await db
              .select({ id: mailInbound.id, status: mailInbound.status })
              .from(mailInbound)
              .where(eq(mailInbound.messageId, payload.messageId))
              .limit(1);
            
            if (existing) {
              resultId = existing.id;
              resultStatus = existing.status;
              isNew = false;
              logger.info(`[MAIL-INBOUND-WEBHOOK] Fallback found existing: id=${resultId}`);
            } else {
              throw new Error('Fallback insert failed and no existing record found');
            }
          }
        } catch (fallbackError: any) {
          logger.error('[MAIL-INBOUND-WEBHOOK] Fallback DB error:', fallbackError.message);
          throw fallbackError;
        }
      } else {
        // Not a missing column error - re-throw
        logger.error('[MAIL-INBOUND-WEBHOOK] DB error:', dbError.message);
        throw dbError;
      }
    }

    // 4b. Contact auto-create + link (non-blocking, only for new mails)
    if (isNew && payload.fromEmail) {
      const contactId = await upsertContactByEmail(payload.fromEmail, payload.fromName);
      if (contactId) {
        try {
          await db
            .update(mailInbound)
            .set({ contactId })
            .where(eq(mailInbound.id, resultId));
        } catch (linkErr: any) {
          logger.warn(`[MAIL-INBOUND-WEBHOOK] Failed to link contact: ${linkErr.message}`);
        }
      }
    }

    logger.info(`[MAIL-INBOUND-WEBHOOK] Processed mail: id=${resultId}, isNew=${isNew}, from=${payload.fromEmail}, snipLen=${debugInfo.snipLen}, txtLen=${debugInfo.txtLen}, htmlLen=${debugInfo.htmlLen}`);

    // 5. Response (with optional debug info)
    const response: Record<string, any> = {
      ok: true,
      id: resultId,
      status: resultStatus,
      isNew,
    };
    
    if (DEBUG_RESPONSE) {
      response.debug = debugInfo;
      if (migrationWarning) {
        response.warning = migrationWarning;
      }
    }
    
    return res.json(response);

  } catch (error: any) {
    // ALWAYS-200 policy: n8n must never get 500 (prevents retry loops)
    logger.error('[MAIL-INBOUND-WEBHOOK] ERROR (returning 200 to prevent n8n retry):', error.message);
    return res.status(200).json({
      ok: true,
      accepted: true,
      stored: false,
      error: 'processing_error',
      severity: 'error',
    });
  }
}

// ============================================================================
// WEBHOOK ROUTES (both paths supported for compatibility)
// ============================================================================
// Primary: POST /api/webhook/gmail-inbound
// Alias:   POST /api/n8n/webhook/gmail-inbound
// ============================================================================

router.post('/webhook/gmail-inbound', handleGmailInbound);
router.post('/n8n/webhook/gmail-inbound', handleGmailInbound);

// ============================================================================
// READ: GET /api/internal/mail/inbound
// ============================================================================
// List inbound emails with optional filters
// Protected by admin/staff auth
// ============================================================================

// Status label → enum map (UI may send label or lowercase variant)
const STATUS_NORMALIZE: Record<string, string> = {
  'neu': 'NEW', 'new': 'NEW',
  'open': 'OPEN', 'offen': 'OPEN',
  'triaged': 'TRIAGED',
  'approved': 'APPROVED',
  'sending': 'SENDING',
  'sent': 'SENT', 'gesendet': 'SENT',
  'error': 'ERROR', 'fehler': 'ERROR',
  'archived': 'ARCHIVED', 'archiviert': 'ARCHIVED',
  'done': 'SENT', // widget compat: map DONE→SENT
};

router.get('/internal/mail/inbound', requireStaffOrAdmin, async (req, res) => {
  try {
    const rawStatus = (req.query.status as string | undefined)?.trim();
    const q = (req.query.q as string | undefined)?.trim();
    const mailboxFilter = req.query.mailbox as string | undefined;
    const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const limitCapped = Math.min(limitParam, 100);
    const cursor = req.query.cursor ? parseInt(req.query.cursor as string, 10) : undefined;

    // Normalize status: accept lowercase, labels, or exact enum
    const statusFilter = rawStatus
      ? (MAIL_INBOUND_STATUSES.includes(rawStatus) ? rawStatus : STATUS_NORMALIZE[rawStatus.toLowerCase()] || rawStatus.toUpperCase())
      : undefined;

    // Build conditions array
    const conditions: any[] = [];
    
    if (statusFilter && MAIL_INBOUND_STATUSES.includes(statusFilter)) {
      conditions.push(eq(mailInbound.status, statusFilter));
    }
    if (mailboxFilter) {
      conditions.push(eq(mailInbound.mailbox, mailboxFilter));
    }
    if (cursor) {
      conditions.push(lt(mailInbound.id, cursor));
    }
    if (q && q.length > 0) {
      const searchTerm = `%${q}%`;
      conditions.push(or(
        ilike(mailInbound.subject, searchTerm),
        ilike(mailInbound.fromEmail, searchTerm),
        ilike(mailInbound.fromName, searchTerm),
        ilike(mailInbound.snippet, searchTerm)
      ));
    }

    // Execute query — NULLS LAST so null received_at don't sort first
    const orderExpr = sql`${mailInbound.receivedAt} DESC NULLS LAST`;
    let mails;
    if (conditions.length > 0) {
      mails = await db
        .select()
        .from(mailInbound)
        .where(and(...conditions))
        .orderBy(orderExpr)
        .limit(limitCapped);
    } else {
      mails = await db
        .select()
        .from(mailInbound)
        .orderBy(orderExpr)
        .limit(limitCapped);
    }

    // Calculate next cursor for pagination
    const nextCursor = mails.length === limitCapped && mails.length > 0
      ? mails[mails.length - 1].id
      : null;

    return res.json({
      ok: true,
      data: mails,
      pagination: {
        count: mails.length,
        limit: limitCapped,
        nextCursor,
      },
    });

  } catch (error: any) {
    logger.error('[MAIL-INBOUND-LIST] Error listing mails:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to list inbound mails',
      message: error.message,
    });
  }
});

// ============================================================================
// READ: GET /api/internal/mail/inbound/:id
// ============================================================================
// Get single inbound email by ID
// Protected by admin/staff auth
// ============================================================================

router.get('/internal/mail/inbound/:id', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    // Direct db query
    const [mail] = await db
      .select()
      .from(mailInbound)
      .where(eq(mailInbound.id, id))
      .limit(1);

    if (!mail) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    // Auto-OPEN: when a NEW mail is viewed, mark it as OPEN
    if (mail.status === 'NEW') {
      const now = new Date();
      await db
        .update(mailInbound)
        .set({ status: 'OPEN', lastActionAt: now, updatedAt: now })
        .where(eq(mailInbound.id, id));
      mail.status = 'OPEN';
      mail.lastActionAt = now;
      mail.updatedAt = now;
    }

    // Thread history: last 20 mails with same thread_id or from_email
    let threadHistory: any[] = [];
    try {
      const threadConditions = [];
      if (mail.threadId) {
        threadConditions.push(eq(mailInbound.threadId, mail.threadId));
      }
      threadConditions.push(eq(mailInbound.fromEmail, mail.fromEmail));
      
      threadHistory = await db
        .select({
          id: mailInbound.id,
          subject: mailInbound.subject,
          fromEmail: mailInbound.fromEmail,
          status: mailInbound.status,
          receivedAt: mailInbound.receivedAt,
          snippet: mailInbound.snippet,
        })
        .from(mailInbound)
        .where(and(
          or(...threadConditions),
          sql`${mailInbound.id} != ${id}`
        ))
        .orderBy(desc(mailInbound.receivedAt))
        .limit(20);
    } catch (e) {
      // Non-critical - don't fail detail view for thread history
    }

    return res.json({
      ok: true,
      data: mail,
      threadHistory,
    });

  } catch (error: any) {
    logger.error('[MAIL-INBOUND-DETAIL] Error getting mail:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to get inbound mail',
      message: error.message,
    });
  }
});

// ============================================================================
// UPDATE: PATCH /api/internal/mail/inbound/:id
// ============================================================================
// Update mail fields: status, assigned_to, notes, draft fields
// Protected by admin/staff auth
// ============================================================================

router.patch('/internal/mail/inbound/:id', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    const { status, assignedTo, notes, draftSubject, draftHtml, draftText, meta } = req.body;

    // Validate status if provided
    if (status && !MAIL_INBOUND_STATUSES.includes(status)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid status. Must be one of: ${MAIL_INBOUND_STATUSES.join(', ')}` 
      });
    }

    // Build update object
    const updateData: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (status) updateData.status = status;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
    if (notes !== undefined) updateData.notes = notes;
    if (draftSubject !== undefined) updateData.draftSubject = draftSubject;
    if (draftHtml !== undefined) updateData.draftHtml = draftHtml;
    if (draftText !== undefined) updateData.draftText = draftText;

    if (meta && typeof meta === 'object') {
      const [existing] = await db
        .select({ meta: mailInbound.meta })
        .from(mailInbound)
        .where(eq(mailInbound.id, id))
        .limit(1);
      
      updateData.meta = { ...(existing?.meta || {}), ...meta };
    }

    const [updated] = await db
      .update(mailInbound)
      .set(updateData)
      .where(eq(mailInbound.id, id))
      .returning({ id: mailInbound.id, status: mailInbound.status });

    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    logger.info(`[MAIL-INBOUND-UPDATE] Updated mail id=${id}, status=${updated.status}`);

    return res.json({
      ok: true,
      id: updated.id,
      status: updated.status,
    });

  } catch (error: any) {
    logger.error('[MAIL-INBOUND-UPDATE] Error updating mail:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to update inbound mail',
      message: error.message,
    });
  }
});

// ============================================================================
// TRIAGE: POST /api/internal/mail/inbound/:id/triage
// ============================================================================
// Run Gemini AI triage + draft generation
// ============================================================================

router.post('/internal/mail/inbound/:id/triage', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    const actorId = getActorId(req);

    // Fetch the mail
    const [mail] = await db
      .select()
      .from(mailInbound)
      .where(eq(mailInbound.id, id))
      .limit(1);

    if (!mail) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    // Transition guard: only NEW or OPEN can be triaged
    const transitionError = validateStatusTransition(mail.status, 'TRIAGED');
    if (transitionError) {
      return res.status(409).json({ ok: false, error: transitionError });
    }

    logger.info(`[MAIL-TRIAGE] Starting triage for mail id=${id}, actor=${actorId}`);

    // Run ARAS Engine triage
    const result = await triageEmail({
      fromEmail: mail.fromEmail,
      fromName: mail.fromName,
      subject: mail.subject,
      snippet: mail.snippet,
      bodyText: mail.bodyText,
      bodyHtml: mail.bodyHtml,
      mailbox: mail.mailbox,
    });

    // Determine target status based on AI action
    const targetStatus: MailInboundStatus = 
      result.action === 'ARCHIVE' || result.action === 'DELETE' ? 'ARCHIVED' : 'TRIAGED';

    // Update the mail with triage results
    const nowStr = nowIso();
    const [updated] = await db
      .update(mailInbound)
      .set({
        category: result.category,
        priority: result.priority,
        aiConfidence: result.confidence,
        aiReason: result.reason,
        aiSummary: result.summary,
        aiAction: result.action,
        needsClarification: result.needsClarification,
        clarifyingQuestions: result.clarifyingQuestions,
        draftSubject: result.reply.subject,
        draftHtml: result.reply.html,
        draftText: result.reply.text,
        status: targetStatus,
        triagedAt: new Date(nowStr),
        triagedBy: actorId,
        lastActionAt: new Date(nowStr),
        updatedAt: new Date(nowStr),
      })
      .where(eq(mailInbound.id, id))
      .returning();

    logger.info(`[MAIL-TRIAGE] Completed for mail id=${id}: category=${result.category}, action=${result.action}`);

    return res.json({
      ok: true,
      id: updated.id,
      triage: {
        category: result.category,
        priority: result.priority,
        confidence: result.confidence,
        action: result.action,
        summary: result.summary,
        hasDraft: result.reply.text.length > 0,
      },
    });

  } catch (error: any) {
    logger.error('[MAIL-TRIAGE] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Triage request failed. Please try again.',
    });
  }
});

// ============================================================================
// DRAFT REGENERATE: POST /api/internal/mail/inbound/:id/draft
// ============================================================================
// Regenerate draft using operator notes for clarification
// ============================================================================

router.post('/internal/mail/inbound/:id/draft', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    const { operatorNotes } = req.body || {};
    if (!operatorNotes || typeof operatorNotes !== 'string' || operatorNotes.trim().length === 0) {
      return res.status(400).json({ ok: false, error: 'Operator notes required for draft regeneration.' });
    }

    const actorId = getActorId(req);

    // Fetch the mail
    const [mail] = await db
      .select()
      .from(mailInbound)
      .where(eq(mailInbound.id, id))
      .limit(1);

    if (!mail) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    // Allow regeneration from TRIAGED, OPEN, or NEW states
    if (!['NEW', 'OPEN', 'TRIAGED'].includes(mail.status)) {
      return res.status(409).json({ ok: false, error: 'Action not allowed in current state.' });
    }

    logger.info(`[MAIL-DRAFT] Regenerating draft for mail id=${id} with operator notes, actor=${actorId}`);

    // Run ARAS Engine triage with operator notes appended
    const result = await triageEmail({
      fromEmail: mail.fromEmail,
      fromName: mail.fromName,
      subject: mail.subject,
      snippet: mail.snippet,
      bodyText: mail.bodyText + '\n\n---\nOPERATOR NOTES:\n' + operatorNotes.trim(),
      bodyHtml: mail.bodyHtml,
      mailbox: mail.mailbox,
    });

    // Update the mail with new draft
    const now = new Date();
    const [updated] = await db
      .update(mailInbound)
      .set({
        category: result.category,
        priority: result.priority,
        aiConfidence: result.confidence,
        aiReason: result.reason,
        aiSummary: result.summary,
        aiAction: result.action,
        needsClarification: result.needsClarification,
        clarifyingQuestions: result.clarifyingQuestions,
        operatorNotes: operatorNotes.trim(),
        draftSubject: result.reply.subject,
        draftHtml: result.reply.html,
        draftText: result.reply.text,
        status: 'TRIAGED',
        triagedAt: now,
        triagedBy: actorId,
        lastActionAt: now,
        updatedAt: now,
      })
      .where(eq(mailInbound.id, id))
      .returning();

    logger.info(`[MAIL-DRAFT] Draft regenerated for mail id=${id}`);

    return res.json({
      ok: true,
      id: updated.id,
      status: updated.status,
      hasDraft: result.reply.text.length > 0 || result.reply.html.length > 0,
    });

  } catch (error: any) {
    logger.error('[MAIL-DRAFT] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Draft regeneration failed. Please try again.',
    });
  }
});

// ============================================================================
// APPROVE: POST /api/internal/mail/inbound/:id/approve
// ============================================================================
// Mark mail as approved for sending
// ============================================================================

router.post('/internal/mail/inbound/:id/approve', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    const actorId = getActorId(req);

    // Fetch current mail to check status and draft
    const [mail] = await db
      .select()
      .from(mailInbound)
      .where(eq(mailInbound.id, id))
      .limit(1);

    if (!mail) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    // Transition guard: only TRIAGED can be approved
    const transitionError = validateStatusTransition(mail.status, 'APPROVED');
    if (transitionError) {
      return res.status(409).json({ ok: false, error: transitionError });
    }

    // Require draft before approval
    if (!mail.draftText && !mail.draftHtml) {
      return res.status(409).json({ ok: false, error: 'No draft available. Run triage first.' });
    }

    const now = new Date();
    const [updated] = await db
      .update(mailInbound)
      .set({
        status: 'APPROVED',
        approvedAt: now,
        approvedBy: actorId,
        lastActionAt: now,
        updatedAt: now,
      })
      .where(eq(mailInbound.id, id))
      .returning({ id: mailInbound.id, status: mailInbound.status, approvedBy: mailInbound.approvedBy });

    logger.info(`[MAIL-APPROVE] Mail id=${id} approved by ${actorId}`);

    return res.json({
      ok: true,
      id: updated.id,
      status: updated.status,
      approvedBy: updated.approvedBy,
    });

  } catch (error: any) {
    logger.error('[MAIL-APPROVE] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to approve mail',
      message: error.message,
    });
  }
});

// ============================================================================
// SEND: POST /api/internal/mail/inbound/:id/send
// ============================================================================
// Trigger n8n webhook to send reply via Gmail
// ============================================================================

const N8N_SEND_WEBHOOK_URL = process.env.N8N_SEND_MAIL_WEBHOOK_URL || '';

router.post('/internal/mail/inbound/:id/send', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    const actorId = getActorId(req);

    // Fetch the mail with draft
    const [mail] = await db
      .select()
      .from(mailInbound)
      .where(eq(mailInbound.id, id))
      .limit(1);

    if (!mail) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    // Transition guard: only APPROVED or ERROR (retry) can be sent
    const transitionError = validateStatusTransition(mail.status, 'SENDING');
    if (transitionError) {
      return res.status(409).json({ ok: false, error: transitionError });
    }

    // Validate draft exists
    if (!mail.draftText && !mail.draftHtml) {
      return res.status(409).json({ ok: false, error: 'No draft to send. Run triage first.' });
    }

    // Check n8n webhook URL
    if (!N8N_SEND_WEBHOOK_URL) {
      logger.error('[MAIL-SEND] N8N_SEND_MAIL_WEBHOOK_URL not configured');
      return res.status(500).json({ ok: false, error: 'Send service not configured.' });
    }

    // Set status to SENDING before attempting
    const now = new Date();
    await db
      .update(mailInbound)
      .set({
        status: 'SENDING',
        lastActionAt: now,
        updatedAt: now,
      })
      .where(eq(mailInbound.id, id));

    // Prepare payload for n8n
    const payload = {
      inboundId: mail.id,
      gmailMessageId: mail.messageId,
      threadId: mail.threadId,
      mailbox: mail.mailbox || 'info@aras-ai.com',
      to: mail.fromEmail,
      subject: mail.draftSubject || `Re: ${mail.subject}`,
      html: mail.draftHtml,
      text: mail.draftText,
      sentBy: actorId,
    };

    logger.info(`[MAIL-SEND] Triggering n8n webhook for mail id=${id} to ${mail.fromEmail}`);

    // Call n8n webhook
    const webhookResponse = await fetch(N8N_SEND_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-aras-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
      },
      body: JSON.stringify(payload),
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      logger.error(`[MAIL-SEND] n8n webhook failed: ${webhookResponse.status} - ${errorText}`);
      
      // Update status to ERROR
      const errorNow = new Date();
      await db
        .update(mailInbound)
        .set({
          status: 'ERROR',
          errorCode: `HTTP_${webhookResponse.status}`,
          errorMessage: 'Send failed. Retry available.',
          lastActionAt: errorNow,
          updatedAt: errorNow,
        })
        .where(eq(mailInbound.id, id));

      return res.status(500).json({
        ok: false,
        error: 'Failed to send via n8n',
        details: errorText,
      });
    }

    // Success - update status
    const successNow = new Date();
    const [updated] = await db
      .update(mailInbound)
      .set({
        status: 'SENT',
        sentAt: successNow,
        sentBy: actorId,
        errorCode: null,
        errorMessage: null,
        lastActionAt: successNow,
        updatedAt: successNow,
      })
      .where(eq(mailInbound.id, id))
      .returning({ id: mailInbound.id, status: mailInbound.status, sentAt: mailInbound.sentAt });

    logger.info(`[MAIL-SEND] Successfully sent mail id=${id} by ${actorId}`);

    return res.json({
      ok: true,
      id: updated.id,
      status: updated.status,
      sentAt: updated.sentAt,
    });

  } catch (error: any) {
    logger.error('[MAIL-SEND] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to send mail',
      message: error.message,
    });
  }
});

// ============================================================================
// COUNT: GET /api/internal/mail/inbound/count
// ============================================================================
// Get count of mails by status
// ============================================================================

router.get('/internal/mail/inbound/count', requireStaffOrAdmin, async (req, res) => {
  try {
    const counts = await db
      .select({
        status: mailInbound.status,
        count: sql<number>`count(*)::int`,
      })
      .from(mailInbound)
      .groupBy(mailInbound.status);

    const result: Record<string, number> = {
      NEW: 0,
      OPEN: 0,
      TRIAGED: 0,
      APPROVED: 0,
      SENDING: 0,
      SENT: 0,
      ARCHIVED: 0,
      ERROR: 0,
      total: 0,
    };

    for (const row of counts) {
      result[row.status] = row.count;
      result.total += row.count;
    }

    return res.json({
      ok: true,
      counts: result,
    });

  } catch (error: any) {
    logger.error('[MAIL-INBOUND-COUNT] Error counting mails:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to count inbound mails',
      message: error.message,
    });
  }
});

// ============================================================================
// ARCHIVE: POST /api/internal/mail/inbound/:id/archive
// ============================================================================
// Archive mail from any non-terminal state
// ============================================================================

router.post('/internal/mail/inbound/:id/archive', requireStaffOrAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid mail ID' });
    }

    const actorId = getActorId(req);

    const [mail] = await db
      .select({ id: mailInbound.id, status: mailInbound.status })
      .from(mailInbound)
      .where(eq(mailInbound.id, id))
      .limit(1);

    if (!mail) {
      return res.status(404).json({ ok: false, error: 'Mail not found' });
    }

    if (mail.status === 'ARCHIVED') {
      return res.json({ ok: true, id: mail.id, status: 'ARCHIVED', alreadyArchived: true });
    }

    const now = new Date();
    const [updated] = await db
      .update(mailInbound)
      .set({
        status: 'ARCHIVED',
        archivedAt: now,
        archivedBy: actorId,
        lastActionAt: now,
        updatedAt: now,
      })
      .where(eq(mailInbound.id, id))
      .returning({ id: mailInbound.id, status: mailInbound.status });

    logger.info(`[MAIL-ARCHIVE] Mail id=${id} archived by ${actorId}`);

    return res.json({
      ok: true,
      id: updated.id,
      status: updated.status,
    });

  } catch (error: any) {
    logger.error('[MAIL-ARCHIVE] Error:', error.message);
    return res.status(500).json({
      ok: false,
      error: 'Failed to archive mail',
    });
  }
});

export default router;
