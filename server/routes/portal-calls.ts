/**
 * ============================================================================
 * ARAS CLIENT PORTAL - Calls API
 * ============================================================================
 * Read-only access to call logs for client portals
 * Strictly filtered by portal config
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { callLogs } from '@shared/schema';
import { eq, desc, and, sql, ilike, or, lt } from 'drizzle-orm';
import { requirePortalAuth, requirePortalPermission, requirePortalCsrf } from './portal-auth';

const router = Router();

// Apply auth to all routes
router.use(requirePortalAuth);

// ============================================================================
// TYPES
// ============================================================================

/**
 * PortalCallFilter — Flexible filter modes for portal call isolation
 * Supports: userId, voiceAgentId, metadata key match, or compound (AND)
 */
type PortalCallFilter =
  | { mode: 'userId'; value: string }
  | { mode: 'voiceAgentId'; value: number }
  | { mode: 'metadata'; key: string; value: string }
  | { mode: 'compound'; all: PortalCallFilter[] };

interface PortalConfig {
  company: {
    name: string;
    ceo: string;
    email: string;
    addressLine: string;
    zipCity: string;
    vatId: string;
  };
  package: {
    includedCalls: number;
    label: string;
    notes: string;
  };
  ui: {
    portalTitle: string;
    tooltipMode: string;
    kpiFocus: string;
    infoHints?: Record<string, string>;
  };
  filter: PortalCallFilter | { field: string; value: string }; // backward compat
}

// ============================================================================
// HELPER: Parse legacy filter format to new PortalCallFilter
// ============================================================================

function normalizeFilter(rawFilter: PortalConfig['filter']): PortalCallFilter {
  // New format: already has 'mode'
  if ('mode' in rawFilter) {
    return rawFilter as PortalCallFilter;
  }
  
  // Legacy format: { field, value }
  const { field, value } = rawFilter as { field: string; value: string };
  
  if (field === 'userId') {
    return { mode: 'userId', value };
  }
  if (field === 'voiceAgentId') {
    return { mode: 'voiceAgentId', value: Number(value) };
  }
  if (field.startsWith('metadata.')) {
    return { mode: 'metadata', key: field.replace('metadata.', ''), value };
  }
  
  // Default fallback: treat as userId
  return { mode: 'userId', value };
}

// ============================================================================
// HELPER: Build Drizzle WHERE clause from PortalCallFilter
// Supports userId, voiceAgentId, metadata jsonb key, compound AND
// ============================================================================

function buildPortalCallWhere(filter: PortalCallFilter): ReturnType<typeof eq> {
  switch (filter.mode) {
    case 'userId':
      return eq(callLogs.userId, filter.value);
    
    case 'voiceAgentId':
      return eq(callLogs.voiceAgentId, filter.value);
    
    case 'metadata':
      return sql`(${callLogs.metadata} ->> ${filter.key}) = ${filter.value}`;
    
    case 'compound':
      if (filter.all.length === 0) {
        // Empty compound = match nothing for safety
        return sql`FALSE`;
      }
      if (filter.all.length === 1) {
        return buildPortalCallWhere(filter.all[0]);
      }
      // AND all sub-filters
      const conditions = filter.all.map(f => buildPortalCallWhere(f));
      return and(...conditions)!;
    
    default:
      // Safety fallback: match nothing
      return sql`FALSE`;
  }
}

// Legacy wrapper for backward compat
function buildFilterCondition(config: PortalConfig) {
  const normalized = normalizeFilter(config.filter);
  return buildPortalCallWhere(normalized);
}

// ============================================================================
// GET /api/portal/calls
// List calls with pagination and optional filters
// ============================================================================

router.get('/calls', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    
    // Parse query params
    const cursor = req.query.cursor as string | undefined;
    const limitParam = parseInt(req.query.limit as string) || 50;
    const limit = Math.min(Math.max(limitParam, 1), 200); // 1-200
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    
    // STEP 12B: Range params
    const range = (req.query.range as string) || '14d';
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    
    // Build base filter from portal config
    const baseFilter = buildFilterCondition(config);
    
    // Build conditions array
    const conditions = [baseFilter];
    
    // STEP 12B: Add date range filter
    if (fromParam && toParam) {
      const rangeStart = new Date(fromParam);
      const rangeEnd = new Date(toParam);
      rangeEnd.setHours(23, 59, 59, 999);
      
      // Validate
      if (rangeStart > rangeEnd) {
        return res.status(400).json({ error: 'INVALID_RANGE', message: 'from must be <= to' });
      }
      const daysDiff = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'RANGE_TOO_LARGE', message: 'Max range is 365 days' });
      }
      
      conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
      conditions.push(sql`${callLogs.createdAt} <= ${rangeEnd.toISOString()}`);
    } else if (range !== 'all') {
      const now = new Date();
      let rangeStart: Date;
      switch (range) {
        case '30d':
          rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90d':
          rangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default: // 14d
          rangeStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      }
      conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
    }
    
    // Add status filter if provided
    if (status && status !== 'all') {
      conditions.push(eq(callLogs.status, status));
    }
    
    // STEP 12B: Enhanced search filter (safe fields only)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      const searchLike = `%${searchTerm}%`;
      const digitsOnly = searchTerm.replace(/\D/g, '');
      
      // Check if q matches an outcomeTag exactly
      const outcomeTagMatch = ['appointment', 'callback', 'follow_up', 'not_interested', 'wrong_number', 'unclear'].includes(searchTerm.toLowerCase())
        ? searchTerm.toLowerCase()
        : null;
      
      if (outcomeTagMatch) {
        conditions.push(sql`(${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = ${outcomeTagMatch}`);
      } else if (digitsOnly.length >= 4) {
        conditions.push(
          or(
            ilike(callLogs.contactName, searchLike),
            sql`${callLogs.phoneNumber} LIKE ${'%' + digitsOnly}`,
            sql`(${callLogs.metadata}->>'portal')::jsonb->>'note' ILIKE ${searchLike}`
          )!
        );
      } else {
        conditions.push(
          or(
            ilike(callLogs.contactName, searchLike),
            sql`(${callLogs.metadata}->>'portal')::jsonb->>'note' ILIKE ${searchLike}`
          )!
        );
      }
    }
    
    // Add cursor filter if provided
    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      if (!isNaN(cursorId)) {
        conditions.push(lt(callLogs.id, cursorId));
      }
    }
    
    // Execute query
    const calls = await db
      .select({
        id: callLogs.id,
        phoneNumber: callLogs.phoneNumber,
        contactName: callLogs.contactName,
        status: callLogs.status,
        duration: callLogs.duration,
        transcript: callLogs.transcript,
        recordingUrl: callLogs.recordingUrl,
        metadata: callLogs.metadata,
        createdAt: callLogs.createdAt,
        updatedAt: callLogs.updatedAt
      })
      .from(callLogs)
      .where(and(...conditions))
      .orderBy(desc(callLogs.id))
      .limit(limit + 1); // Fetch one extra to check for next page
    
    // Check if there's a next page
    const hasMore = calls.length > limit;
    const items = hasMore ? calls.slice(0, limit) : calls;
    const nextCursor = hasMore && items.length > 0 
      ? String(items[items.length - 1].id) 
      : null;
    
    // Transform items for response (STEP 8: include portal metadata)
    const transformedItems = items.map(call => {
      const meta = (call.metadata || {}) as Record<string, any>;
      const analysis = meta.ai?.analysisV1;
      const portal = getPortalMeta(meta);
      
      const successChance = deriveSuccessChance({
        status: call.status,
        outcomeTag: portal.outcomeTag,
        signalScore: analysis?.signalScore
      });
      
      return {
        id: call.id,
        startedAt: call.createdAt,
        durationSec: call.duration || null,
        to: call.phoneNumber,
        contactName: call.contactName || null,
        status: call.status || 'unknown',
        outcome: meta.outcome || meta.call_status || null,
        hasTranscript: !!(call.transcript && call.transcript.length > 0),
        hasRecording: !!(call.recordingUrl && call.recordingUrl.length > 0),
        signalScore: analysis?.signalScore ?? null,
        hasAnalysis: !!analysis,
        // STEP 8: Portal review data
        starred: portal.starred || false,
        reviewedAt: portal.reviewedAt || null,
        note: portal.note || null,
        // STEP 11: Outcome tag
        outcomeTag: portal.outcomeTag || null,
        // STEP 16: Success chance
        successChance
      };
    });
    
    return res.json({
      items: transformedItems,
      nextCursor
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Error listing calls:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to retrieve calls' 
    });
  }
});

// ============================================================================
// GET /api/portal/calls/stats
// Get call statistics for package usage
// ============================================================================

router.get('/calls/stats', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const baseFilter = buildFilterCondition(config);
    
    // Count total calls
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(baseFilter);
    
    const totalCalls = countResult?.count || 0;
    const includedCalls = config.package.includedCalls;
    const remainingCalls = Math.max(0, includedCalls - totalCalls);
    
    return res.json({
      totalCalls,
      includedCalls,
      remainingCalls,
      usagePercent: Math.round((totalCalls / includedCalls) * 100)
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Error getting stats:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to retrieve statistics' 
    });
  }
});

// ============================================================================
// STEP 12: GET /api/portal/calls/counts
// Server-side counts for tabs (performant, works with 2000+ calls)
// ============================================================================

const HIGH_SIGNAL_THRESHOLD = 70; // Server const for signal score threshold

router.get('/calls/counts', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const baseFilter = buildFilterCondition(config);
    
    // Parse range params
    const range = (req.query.range as string) || '14d';
    const fromParam = req.query.from as string | undefined;
    const toParam = req.query.to as string | undefined;
    const q = req.query.q as string | undefined;
    
    // Build date range condition
    const conditions: any[] = [baseFilter];
    let rangeStart: Date | null = null;
    let rangeEnd: Date | null = null;
    
    if (fromParam && toParam) {
      // Custom date range
      rangeStart = new Date(fromParam);
      rangeEnd = new Date(toParam);
      rangeEnd.setHours(23, 59, 59, 999); // Include full end day
      
      // Validate: from <= to, max 365 days
      if (rangeStart > rangeEnd) {
        return res.status(400).json({ error: 'INVALID_RANGE', message: 'from must be <= to' });
      }
      const daysDiff = (rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 365) {
        return res.status(400).json({ error: 'RANGE_TOO_LARGE', message: 'Max range is 365 days' });
      }
      
      conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
      conditions.push(sql`${callLogs.createdAt} <= ${rangeEnd.toISOString()}`);
    } else {
      // Preset range
      const now = new Date();
      switch (range) {
        case '14d':
          rangeStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
          break;
        case '30d':
          rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
          break;
        case '90d':
          rangeStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
          break;
        case 'all':
          // No date filter
          break;
        default:
          // Default to 14d
          rangeStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
          conditions.push(sql`${callLogs.createdAt} >= ${rangeStart.toISOString()}`);
      }
    }
    
    // STEP 12A: Search filter (safe fields only - NO transcript)
    if (q && q.trim()) {
      const searchTerm = q.trim();
      const searchLike = `%${searchTerm}%`;
      const digitsOnly = searchTerm.replace(/\D/g, '');
      
      // Check if q matches an outcomeTag exactly
      const outcomeTagMatch = VALID_OUTCOME_TAGS.includes(searchTerm.toLowerCase() as OutcomeTag)
        ? searchTerm.toLowerCase()
        : null;
      
      if (outcomeTagMatch) {
        // Exact outcomeTag match
        conditions.push(sql`(${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = ${outcomeTagMatch}`);
      } else if (digitsOnly.length >= 4) {
        // Phone number search (last 4+ digits)
        conditions.push(
          or(
            ilike(callLogs.contactName, searchLike),
            sql`${callLogs.phoneNumber} LIKE ${'%' + digitsOnly}`,
            sql`(${callLogs.metadata}->>'portal')::jsonb->>'note' ILIKE ${searchLike}`
          )!
        );
      } else {
        // Text search on contactName and note
        conditions.push(
          or(
            ilike(callLogs.contactName, searchLike),
            sql`(${callLogs.metadata}->>'portal')::jsonb->>'note' ILIKE ${searchLike}`
          )!
        );
      }
    }
    
    // Single DB roundtrip with conditional aggregation
    const [counts] = await db
      .select({
        all: sql<number>`count(*)::int`,
        needsReview: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'reviewedAt' IS NULL)::int`,
        starred: sql<number>`count(*) FILTER (WHERE ((${callLogs.metadata}->>'portal')::jsonb->>'starred')::boolean = true)::int`,
        highSignal: sql<number>`count(*) FILTER (WHERE ((${callLogs.metadata}->>'ai')::jsonb->'analysisV1'->>'signalScore')::int >= ${HIGH_SIGNAL_THRESHOLD})::int`,
        failed: sql<number>`count(*) FILTER (WHERE lower(${callLogs.status}) = 'failed')::int`,
        appointment: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = 'appointment')::int`,
        callback: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = 'callback')::int`,
        follow_up: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = 'follow_up')::int`,
        not_interested: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = 'not_interested')::int`,
        wrong_number: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = 'wrong_number')::int`,
        unclear: sql<number>`count(*) FILTER (WHERE (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' = 'unclear' OR (${callLogs.metadata}->>'portal')::jsonb->>'outcomeTag' IS NULL)::int`
      })
      .from(callLogs)
      .where(and(...conditions));
    
    return res.json({
      range,
      from: fromParam || null,
      to: toParam || null,
      counts: {
        all: counts?.all || 0,
        needsReview: counts?.needsReview || 0,
        starred: counts?.starred || 0,
        highSignal: counts?.highSignal || 0,
        failed: counts?.failed || 0,
        appointment: counts?.appointment || 0,
        callback: counts?.callback || 0,
        follow_up: counts?.follow_up || 0
      },
      pipeline: {
        appointment: counts?.appointment || 0,
        callback: counts?.callback || 0,
        follow_up: counts?.follow_up || 0,
        not_interested: counts?.not_interested || 0,
        wrong_number: counts?.wrong_number || 0,
        unclear: counts?.unclear || 0
      }
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Error getting counts:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to retrieve counts' 
    });
  }
});

// ============================================================================
// GET /api/portal/calls/:id
// Get single call details
// ============================================================================

router.get('/calls/:id', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const callId = parseInt(req.params.id, 10);
    
    if (isNaN(callId)) {
      return res.status(400).json({ 
        error: 'INVALID_ID', 
        message: 'Invalid call ID' 
      });
    }
    
    // Build filter with portal config + call ID
    const baseFilter = buildFilterCondition(config);
    
    const [call] = await db
      .select()
      .from(callLogs)
      .where(and(
        baseFilter,
        eq(callLogs.id, callId)
      ))
      .limit(1);
    
    if (!call) {
      return res.status(404).json({ 
        error: 'NOT_FOUND', 
        message: 'Call not found' 
      });
    }
    
    // Parse metadata
    const meta = (call.metadata || {}) as Record<string, any>;
    const analysis = meta.ai?.analysisV1;
    const portal = getPortalMeta(meta);
    
    const successChance = deriveSuccessChance({
      status: call.status,
      outcomeTag: portal.outcomeTag,
      signalScore: analysis?.signalScore
    });
    
    // Clean transcript - remove any JSON artifacts
    let cleanTranscript = call.transcript || null;
    if (cleanTranscript && typeof cleanTranscript === 'string') {
      const jsonIndex = cleanTranscript.indexOf('{"role":');
      if (jsonIndex > 0) {
        cleanTranscript = cleanTranscript.substring(0, jsonIndex).trim();
      }
    }
    
    // Build recording URL (use proxy endpoint to avoid CORS)
    const recordingUrl = call.recordingUrl 
      ? `/api/portal/calls/${call.id}/audio`
      : null;
    
    return res.json({
      id: call.id,
      overview: {
        startedAt: call.createdAt,
        updatedAt: call.updatedAt,
        durationSec: call.duration || null,
        to: call.phoneNumber,
        contactName: call.contactName || null,
        status: call.status || 'unknown',
        outcome: meta.outcome || meta.call_status || null
      },
      transcript: cleanTranscript,
      summary: meta.summary || meta.ai_summary || null,
      recordingUrl,
      analysis: {
        sentiment: meta.sentiment || null,
        nextStep: meta.nextStep || meta.next_action || null,
        purpose: meta.purpose || null
      },
      successChance
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Error getting call:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to retrieve call details' 
    });
  }
});

// ============================================================================
// GET /api/portal/calls/:id/audio
// Proxy audio stream (avoids CORS issues)
// ============================================================================

router.get('/calls/:id/audio', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const callId = parseInt(req.params.id, 10);
    
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid call ID' });
    }
    
    // Verify call belongs to portal
    const baseFilter = buildFilterCondition(config);
    
    const [call] = await db
      .select({ recordingUrl: callLogs.recordingUrl })
      .from(callLogs)
      .where(and(
        baseFilter,
        eq(callLogs.id, callId)
      ))
      .limit(1);
    
    if (!call) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found' });
    }
    
    if (!call.recordingUrl) {
      return res.status(404).json({ error: 'NO_AUDIO', message: 'No recording available' });
    }
    
    // Stream audio from external URL
    const audioResponse = await fetch(call.recordingUrl);
    
    if (!audioResponse.ok) {
      return res.status(502).json({ error: 'UPSTREAM_ERROR', message: 'Failed to fetch audio' });
    }
    
    // Forward headers
    const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
    const contentLength = audioResponse.headers.get('content-length');
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }
    
    // Pipe the audio stream
    if (audioResponse.body) {
      const reader = audioResponse.body.getReader();
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      };
      pump().catch(err => {
        console.error('[PORTAL-CALLS] Audio stream error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'STREAM_ERROR', message: 'Audio streaming failed' });
        }
      });
    } else {
      res.status(500).json({ error: 'NO_BODY', message: 'No audio body' });
    }
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Audio proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'STREAM_ERROR', message: 'Audio streaming failed' });
    }
  }
});

// ============================================================================
// GET /api/portal/debug/filter
// Diagnostics: show filter config and matched count (no sensitive data)
// ============================================================================

router.get('/debug/filter', async (req: Request, res: Response) => {
  try {
    const session = (req as any).portalSession;
    const config = (req as any).portalConfig as PortalConfig;
    const normalized = normalizeFilter(config.filter);
    const baseFilter = buildPortalCallWhere(normalized);
    
    // Count matched calls
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(callLogs)
      .where(baseFilter);
    
    const matchedCount = countResult?.count || 0;
    
    // Sample 5 newest (safe fields only)
    const sample = await db
      .select({
        id: callLogs.id,
        createdAt: callLogs.createdAt,
        phoneNumber: callLogs.phoneNumber,
        status: callLogs.status,
        voiceAgentId: callLogs.voiceAgentId,
        userId: callLogs.userId
      })
      .from(callLogs)
      .where(baseFilter)
      .orderBy(desc(callLogs.id))
      .limit(5);
    
    return res.json({
      portalKey: session.portalKey,
      filter: normalized,
      matchedCount,
      sample
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Debug filter error:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to run filter diagnostics' 
    });
  }
});

// ============================================================================
// GET /api/portal/calls/insights
// Aggregated insights for dashboard (trends, KPIs, sentiment)
// ============================================================================

// HIGH_SIGNAL_THRESHOLD already defined at line 337

router.get('/calls/insights', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const baseFilter = buildFilterCondition(config);
    
    // Parse range param
    const rangeParam = (req.query.range as string) || '14d';
    let dateFilter = sql`TRUE`;
    
    if (rangeParam === '14d') {
      dateFilter = sql`${callLogs.createdAt} >= NOW() - INTERVAL '14 days'`;
    } else if (rangeParam === '30d') {
      dateFilter = sql`${callLogs.createdAt} >= NOW() - INTERVAL '30 days'`;
    }
    // 'all' = no date filter
    
    // Fetch calls in range (lightweight fields only)
    const calls = await db
      .select({
        id: callLogs.id,
        createdAt: callLogs.createdAt,
        status: callLogs.status,
        duration: callLogs.duration,
        metadata: callLogs.metadata
      })
      .from(callLogs)
      .where(and(baseFilter, dateFilter))
      .orderBy(desc(callLogs.createdAt))
      .limit(2000);
    
    // Aggregate totals
    let completed = 0, failed = 0, initiated = 0;
    let totalDuration = 0, durationCount = 0;
    let positive = 0, neutral = 0, negative = 0, mixed = 0;
    let analyzedCount = 0, highSignalCount = 0;
    
    // Daily series map
    const dailyMap = new Map<string, { total: number; completed: number; failed: number; highSignal: number; analyzed: number }>();
    
    for (const call of calls) {
      const meta = (call.metadata || {}) as Record<string, any>;
      const analysis = meta.ai?.analysisV1;
      const dateKey = new Date(call.createdAt!).toISOString().split('T')[0];
      
      // Initialize daily bucket
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { total: 0, completed: 0, failed: 0, highSignal: 0, analyzed: 0 });
      }
      const day = dailyMap.get(dateKey)!;
      day.total++;
      
      // Status counts
      const status = call.status?.toLowerCase();
      if (status === 'completed' || status === 'done') {
        completed++;
        day.completed++;
      } else if (status === 'failed' || status === 'error') {
        failed++;
        day.failed++;
      } else if (status === 'initiated' || status === 'in_progress') {
        initiated++;
      }
      
      // Duration
      if (call.duration && call.duration > 0) {
        totalDuration += call.duration;
        durationCount++;
      }
      
      // Sentiment
      const sentiment = analysis?.sentiment || meta.sentiment;
      if (sentiment === 'positive') positive++;
      else if (sentiment === 'neutral') neutral++;
      else if (sentiment === 'negative') negative++;
      else if (sentiment === 'mixed') mixed++;
      
      // Analysis
      if (analysis) {
        analyzedCount++;
        day.analyzed++;
        if (analysis.signalScore >= HIGH_SIGNAL_THRESHOLD) {
          highSignalCount++;
          day.highSignal++;
        }
      }
    }
    
    // Build series array (sorted by date)
    const series = Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, data]) => ({ date, ...data }));
    
    return res.json({
      range: rangeParam,
      totals: {
        total: calls.length,
        completed,
        failed,
        initiated,
        avgDurationSec: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
        sentiment: { positive, neutral, negative, mixed },
        analyzedCount,
        highSignalCount
      },
      series
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Insights error:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to generate insights' 
    });
  }
});

// ============================================================================
// GET /api/portal/calls/export.csv
// Export calls as CSV (respects filters, max 5000 rows)
// ============================================================================

router.get('/calls/export.csv', requirePortalPermission('export.csv'), async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const baseFilter = buildFilterCondition(config);
    
    // Parse query params
    const status = req.query.status as string | undefined;
    const q = req.query.q as string | undefined;
    const range = req.query.range as string | undefined;
    
    const conditions = [baseFilter];
    
    // Date range filter
    if (range === '14d') {
      conditions.push(sql`${callLogs.createdAt} >= NOW() - INTERVAL '14 days'`);
    } else if (range === '30d') {
      conditions.push(sql`${callLogs.createdAt} >= NOW() - INTERVAL '30 days'`);
    }
    
    // Status filter
    if (status && status !== 'all') {
      conditions.push(eq(callLogs.status, status));
    }
    
    // Search filter
    if (q && q.trim()) {
      const searchTerm = `%${q.trim()}%`;
      conditions.push(
        or(
          ilike(callLogs.phoneNumber, searchTerm),
          ilike(callLogs.contactName, searchTerm)
        )!
      );
    }
    
    // Fetch calls (max 5000)
    const calls = await db
      .select({
        createdAt: callLogs.createdAt,
        phoneNumber: callLogs.phoneNumber,
        contactName: callLogs.contactName,
        status: callLogs.status,
        duration: callLogs.duration,
        metadata: callLogs.metadata
      })
      .from(callLogs)
      .where(and(...conditions))
      .orderBy(desc(callLogs.createdAt))
      .limit(5000);
    
    // Build CSV (STEP 8: include reviewedAt, starred, note; STEP 11: outcomeTag)
    // STEP 23B: Add masked export comment header
    const today = new Date().toISOString().split('T')[0];
    const rangeLabel = range || 'all';
    const maskedHeader = `# Masked Export, range=${rangeLabel}, generated=${today}`;
    
    const headers = ['createdAt', 'phoneNumber', 'contactName', 'status', 'durationSec', 'signalScore', 'successChance', 'intent', 'sentiment', 'nextBestAction', 'reviewedAt', 'starred', 'note', 'outcomeTag'];
    const rows = [maskedHeader, headers.join(',')];
    
    for (const call of calls) {
      const meta = (call.metadata || {}) as Record<string, any>;
      const analysis = meta.ai?.analysisV1;
      const portal = getPortalMeta(meta);
      
      const successChance = deriveSuccessChance({
        status: call.status,
        outcomeTag: portal.outcomeTag,
        signalScore: analysis?.signalScore
      });
      
      const row = [
        call.createdAt ? new Date(call.createdAt).toISOString() : '',
        escapeCSV(call.phoneNumber || ''),
        escapeCSV(call.contactName || ''),
        call.status || '',
        call.duration?.toString() || '',
        analysis?.signalScore?.toString() || '',
        successChance != null ? successChance.toString() : '',
        analysis?.intent || '',
        analysis?.sentiment || '',
        escapeCSV(analysis?.nextBestAction || ''),
        portal.reviewedAt || '',
        portal.starred ? 'true' : '',
        escapeCSV(portal.note || ''),
        portal.outcomeTag || ''
      ];
      rows.push(row.join(','));
    }
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="calls-export-${new Date().toISOString().split('T')[0]}.csv"`);
    return res.send(rows.join('\n'));
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Export error:', error);
    return res.status(500).json({ 
      error: 'INTERNAL_ERROR', 
      message: 'Failed to export calls' 
    });
  }
});

function escapeCSV(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function maskPhoneNumber(phone: string): string {
  if (!phone || phone.length < 8) return phone;
  const last4 = phone.slice(-4);
  const prefix = phone.slice(0, phone.length > 10 ? 4 : 3);
  return `${prefix}******${last4}`;
}

// ============================================================================
// AUDIT LOG (in-memory ring buffer, no migration required)
// ============================================================================

interface AuditEntry {
  ts: string;
  portalKey: string;
  action: string;
  metaSafe: { 
    callId?: number; 
    range?: string; 
    success?: boolean; 
    count?: number; 
    ok?: number; 
    failed?: number; 
    starred?: boolean; 
    reviewed?: boolean;
    ipHash?: string;       // STEP 10: Hashed IP for login events
    outcomeTag?: string;   // STEP 11: Outcome tag for call.tag events
    feature?: string;      // STEP 14: Feature name for auth.denied events
  };
}

// ============================================================================
// PORTAL METADATA V1 — Client notes/review/star stored in metadata.portal
// ============================================================================

// STEP 11: Outcome tag enum
type OutcomeTag = 'appointment' | 'callback' | 'follow_up' | 'not_interested' | 'wrong_number' | 'unclear';
type NextActionOwner = 'leadely' | 'internal';

const VALID_OUTCOME_TAGS: OutcomeTag[] = ['appointment', 'callback', 'follow_up', 'not_interested', 'wrong_number', 'unclear'];
const VALID_NEXT_ACTION_OWNERS: NextActionOwner[] = ['leadely', 'internal'];

interface PortalMetadataV1 {
  version: 'v1';
  starred?: boolean;
  reviewedAt?: string;  // ISO timestamp
  reviewedBy?: string;  // displayName or username
  note?: string;        // max 800 chars, trimmed
  updatedAt?: string;   // ISO timestamp
  outcomeTag?: OutcomeTag;           // STEP 11: Outcome classification
  nextActionOwner?: NextActionOwner; // STEP 11: Who owns the next action
}

function getPortalMeta(metadata: Record<string, any>): PortalMetadataV1 {
  const portal = metadata?.portal;
  if (portal && portal.version === 'v1') {
    return portal as PortalMetadataV1;
  }
  return { version: 'v1' };
}

function sanitizeNote(note: string | undefined): string | undefined {
  if (!note) return undefined;
  return note.trim().replace(/\s+/g, ' ').slice(0, 800);
}

// ============================================================================
// STEP 16: Success Chance Derivation Helper
// ============================================================================

interface SuccessChanceInput {
  status: string | null;
  outcomeTag: OutcomeTag | null | undefined;
  signalScore: number | null | undefined;
}

function deriveSuccessChance(input: SuccessChanceInput): number | null {
  const { status, outcomeTag, signalScore } = input;
  
  if (status?.toLowerCase() === 'failed') return 0;
  
  if (outcomeTag) {
    switch (outcomeTag) {
      case 'wrong_number': return 0;
      case 'not_interested': return 10;
      case 'appointment': return 95;
      case 'callback': return 75;
      case 'follow_up': return 65;
    }
  }
  
  if (typeof signalScore === 'number' && !isNaN(signalScore)) {
    return Math.round(Math.max(0, Math.min(100, signalScore)));
  }
  
  return null;
}

const auditBuffer: AuditEntry[] = [];
const AUDIT_MAX = 300;
const callViewRateLimit = new Map<string, number>(); // key: portalKey:callId, value: timestamp

export function logPortalAudit(portalKey: string, action: string, meta: AuditEntry['metaSafe'] = {}) {
  const entry: AuditEntry = {
    ts: new Date().toISOString(),
    portalKey,
    action,
    metaSafe: meta
  };
  auditBuffer.push(entry);
  if (auditBuffer.length > AUDIT_MAX) {
    auditBuffer.shift();
  }
}

// ============================================================================
// GET /api/portal/audit — Activity log for portal
// ============================================================================

router.get('/audit', requirePortalPermission('audit.read'), (req: Request, res: Response) => {
  const session = (req as any).portalSession;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  
  const entries = auditBuffer
    .filter(e => e.portalKey === session.portalKey)
    .slice(-limit)
    .reverse();
  
  return res.json({ entries });
});

// ============================================================================
// GET /api/portal/calls/report — Report data for PDF
// ============================================================================

router.get('/calls/report', requirePortalPermission('export.pdf'), async (req: Request, res: Response) => {
  const config = (req as any).portalConfig as PortalConfig;
  const session = (req as any).portalSession;
  
  logPortalAudit(session.portalKey, 'portal.export.pdf', { success: true });
  
  try {
    const range = (req.query.range as string) || '14d';
    const status = req.query.status as string | undefined;
    const highSignal = req.query.highSignal === '1';
    const analyzed = req.query.analyzed === '1';
    const q = req.query.q as string | undefined;
    
    const filter = normalizeFilter(config.filter);
    const baseCondition = buildPortalCallWhere(filter);
    const conditions = [baseCondition];
    
    // Date range
    if (range === '14d') {
      conditions.push(sql`${callLogs.createdAt} >= NOW() - INTERVAL '14 days'`);
    } else if (range === '30d') {
      conditions.push(sql`${callLogs.createdAt} >= NOW() - INTERVAL '30 days'`);
    }
    
    // Status filter
    if (status) {
      conditions.push(eq(callLogs.status, status));
    }
    
    // Search
    if (q) {
      const searchPattern = `%${q}%`;
      conditions.push(or(
        ilike(callLogs.phoneNumber, searchPattern),
        ilike(callLogs.contactName, searchPattern)
      )!);
    }
    
    // Fetch calls (max 200 for report)
    const calls = await db
      .select({
        id: callLogs.id,
        createdAt: callLogs.createdAt,
        phoneNumber: callLogs.phoneNumber,
        contactName: callLogs.contactName,
        status: callLogs.status,
        duration: callLogs.duration,
        metadata: callLogs.metadata
      })
      .from(callLogs)
      .where(and(...conditions))
      .orderBy(desc(callLogs.createdAt))
      .limit(200);
    
    // Filter by analysis if needed
    let filteredCalls = calls;
    if (highSignal || analyzed) {
      filteredCalls = calls.filter(c => {
        const meta = (c.metadata || {}) as Record<string, any>;
        const analysis = meta.ai?.analysisV1;
        if (analyzed && !analysis) return false;
        if (highSignal && (!analysis || analysis.signalScore < 70)) return false;
        return true;
      });
    }
    
    // Format calls for report (STEP 8: include note short + review/star markers; STEP 11: outcomeTag; STEP 16: successChance)
    const reportCalls = filteredCalls.map(c => {
      const meta = (c.metadata || {}) as Record<string, any>;
      const analysis = meta.ai?.analysisV1;
      const portal = getPortalMeta(meta);
      
      const successChance = deriveSuccessChance({
        status: c.status,
        outcomeTag: portal.outcomeTag,
        signalScore: analysis?.signalScore
      });
      
      return {
        createdAt: c.createdAt,
        phoneNumberMasked: maskPhoneNumber(c.phoneNumber || ''),
        contactName: c.contactName || '',
        status: c.status || '',
        durationSec: c.duration || 0,
        signalScore: analysis?.signalScore || null,
        successChance,
        nextBestAction: analysis?.nextBestAction ? 
          (analysis.nextBestAction.length > 60 ? analysis.nextBestAction.slice(0, 60) + '…' : analysis.nextBestAction) : null,
        starred: portal.starred || false,
        reviewed: !!portal.reviewedAt,
        noteShort: portal.note ? (portal.note.length > 80 ? portal.note.slice(0, 80) + '…' : portal.note) : null,
        outcomeTag: portal.outcomeTag || null
      };
    });
    
    // Compute insights totals
    const allCalls = await db
      .select({ id: callLogs.id, status: callLogs.status, duration: callLogs.duration, metadata: callLogs.metadata })
      .from(callLogs)
      .where(and(baseCondition, range === '14d' ? sql`${callLogs.createdAt} >= NOW() - INTERVAL '14 days'` : 
                 range === '30d' ? sql`${callLogs.createdAt} >= NOW() - INTERVAL '30 days'` : sql`1=1`));
    
    const totals = {
      total: allCalls.length,
      completed: allCalls.filter(c => ['completed', 'done'].includes(c.status?.toLowerCase() || '')).length,
      failed: allCalls.filter(c => c.status?.toLowerCase() === 'failed').length,
      avgDurationSec: allCalls.length > 0 ? Math.round(allCalls.reduce((sum, c) => sum + (c.duration || 0), 0) / allCalls.length) : 0,
      analyzedCount: allCalls.filter(c => (c.metadata as any)?.ai?.analysisV1).length,
      highSignalCount: allCalls.filter(c => (c.metadata as any)?.ai?.analysisV1?.signalScore >= 70).length
    };
    
    // STEP 17: Calculate forecast for report header
    const remainingCalls = Math.max(0, config.package.includedCalls - totals.total);
    const seriesDays = 14;
    const avgCallsPerDay = totals.total > 0 ? Math.round((totals.total / seriesDays) * 10) / 10 : 0;
    const daysToDepletion = avgCallsPerDay > 0 ? Math.ceil(remainingCalls / avgCallsPerDay) : null;
    let projectedDepletionDate: string | null = null;
    if (daysToDepletion !== null) {
      const depletionDate = new Date();
      depletionDate.setDate(depletionDate.getDate() + daysToDepletion);
      projectedDepletionDate = depletionDate.toISOString().split('T')[0];
    }
    
    // STEP 23B: Add masked export metadata for PDF header
    const generatedAt = new Date().toISOString();
    const maskedExportLabel = `Masked Export · ${range || 'all'} · Generated ${generatedAt.split('T')[0]}`;
    
    // STEP 27: Executive Summary - Top 5 Next Actions
    // Rule: High Signal OR has nextBestAction
    const topNextActions = filteredCalls
      .map(c => {
        const meta = (c.metadata || {}) as Record<string, any>;
        const analysis = meta.ai?.analysisV1;
        const portal = getPortalMeta(meta);
        const successChance = deriveSuccessChance({
          status: c.status,
          outcomeTag: portal.outcomeTag,
          signalScore: analysis?.signalScore
        });
        return {
          contactName: c.contactName || 'Kontakt',
          phoneMasked: maskPhoneNumber(c.phoneNumber || ''),
          nextBestAction: analysis?.nextBestAction ? 
            (analysis.nextBestAction.length > 120 ? analysis.nextBestAction.slice(0, 120) + '…' : analysis.nextBestAction) : null,
          successChance,
          signalScore: analysis?.signalScore || null
        };
      })
      .filter(c => c.successChance >= 70 || c.nextBestAction)
      .sort((a, b) => (b.successChance || 0) - (a.successChance || 0))
      .slice(0, 5);
    
    // STEP 27: Pipeline counts for exec summary
    const pipelineCounts = {
      appointments: filteredCalls.filter(c => getPortalMeta((c.metadata || {}) as Record<string, any>).outcomeTag === 'appointment').length,
      callbacks: filteredCalls.filter(c => getPortalMeta((c.metadata || {}) as Record<string, any>).outcomeTag === 'callback').length,
      followUps: filteredCalls.filter(c => getPortalMeta((c.metadata || {}) as Record<string, any>).outcomeTag === 'follow_up').length
    };
    
    // STEP 27: Exec Summary object
    const execSummary = {
      rangeLabel: range === '14d' ? 'Letzte 14 Tage' : range === '30d' ? 'Letzte 30 Tage' : 'Alle',
      totals,
      pipeline: pipelineCounts,
      forecast: { remainingCalls, avgCallsPerDay, daysToDepletion, projectedDepletionDate },
      topNextActions
    };
    
    return res.json({
      generatedAt,
      maskedExportLabel,
      range,
      company: config.company,
      package: config.package,
      forecast: { remainingCalls, avgCallsPerDay, projectedDepletionDate },
      totals,
      execSummary,
      calls: reportCalls
    });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Report error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to generate report' });
  }
});

// ============================================================================
// PATCH /api/portal/calls/:id/metadata — Update note/star/reviewed
// ============================================================================

router.patch('/calls/:id/metadata', requirePortalCsrf, requirePortalPermission('calls.write'), async (req: Request, res: Response) => {
  const config = (req as any).portalConfig as PortalConfig;
  const session = (req as any).portalSession;
  const callId = parseInt(req.params.id);
  
  if (!callId || isNaN(callId)) {
    return res.status(400).json({ error: 'INVALID_ID' });
  }
  
  try {
    const { starred, reviewed, note, outcomeTag, nextActionOwner } = req.body as {
      starred?: boolean;
      reviewed?: boolean;
      note?: string;
      outcomeTag?: string;         // STEP 11
      nextActionOwner?: string;    // STEP 11
    };
    
    // STEP 11: Validate outcomeTag if provided
    if (outcomeTag !== undefined && !VALID_OUTCOME_TAGS.includes(outcomeTag as OutcomeTag)) {
      return res.status(400).json({ error: 'INVALID_OUTCOME_TAG' });
    }
    
    // STEP 11: Validate nextActionOwner if provided
    if (nextActionOwner !== undefined && !VALID_NEXT_ACTION_OWNERS.includes(nextActionOwner as NextActionOwner)) {
      return res.status(400).json({ error: 'INVALID_NEXT_ACTION_OWNER' });
    }
    
    // Verify call belongs to this portal
    const filter = normalizeFilter(config.filter);
    const baseCondition = buildPortalCallWhere(filter);
    
    const [existing] = await db
      .select({ id: callLogs.id, metadata: callLogs.metadata })
      .from(callLogs)
      .where(and(baseCondition, eq(callLogs.id, callId)))
      .limit(1);
    
    if (!existing) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    
    // Build updated portal metadata
    const currentMeta = (existing.metadata || {}) as Record<string, any>;
    const currentPortal = getPortalMeta(currentMeta);
    const now = new Date().toISOString();
    
    const updatedPortal: PortalMetadataV1 = {
      ...currentPortal,
      version: 'v1',
      updatedAt: now
    };
    
    // Handle starred
    if (typeof starred === 'boolean') {
      updatedPortal.starred = starred;
      logPortalAudit(session.portalKey, 'portal.call.star', { callId, starred });
    }
    
    // Handle reviewed
    if (typeof reviewed === 'boolean') {
      if (reviewed) {
        updatedPortal.reviewedAt = now;
        updatedPortal.reviewedBy = session.displayName || session.username || 'User';
      } else {
        updatedPortal.reviewedAt = undefined;
        updatedPortal.reviewedBy = undefined;
      }
      logPortalAudit(session.portalKey, 'portal.call.review', { callId, reviewed });
    }
    
    // Handle note
    if (note !== undefined) {
      updatedPortal.note = sanitizeNote(note);
      logPortalAudit(session.portalKey, 'portal.call.note', { callId });
    }
    
    // STEP 11: Handle outcomeTag
    if (outcomeTag !== undefined) {
      updatedPortal.outcomeTag = outcomeTag as OutcomeTag;
      logPortalAudit(session.portalKey, 'portal.call.tag', { callId, outcomeTag });
    }
    
    // STEP 11: Handle nextActionOwner
    if (nextActionOwner !== undefined) {
      updatedPortal.nextActionOwner = nextActionOwner as NextActionOwner;
    }
    
    // Merge into existing metadata (preserve other keys like ai, summary, etc.)
    const mergedMeta = {
      ...currentMeta,
      portal: updatedPortal
    };
    
    // Update in DB
    await db
      .update(callLogs)
      .set({ metadata: mergedMeta })
      .where(eq(callLogs.id, callId));
    
    return res.json({ portal: updatedPortal });
    
  } catch (error: any) {
    console.error('[PORTAL-CALLS] Metadata update error:', error);
    return res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
});

export default router;
