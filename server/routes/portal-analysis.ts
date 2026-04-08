/**
 * ============================================================================
 * ARAS CLIENT PORTAL - Intelligence Analysis API
 * ============================================================================
 * On-demand call analysis with caching in call_logs.metadata
 * ============================================================================
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { callLogs } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { createHash } from 'crypto';
import { requirePortalAuth, requirePortalPermission, requirePortalCsrf } from './portal-auth';
import { z } from 'zod';

const router = Router();

// Apply auth to all routes
router.use(requirePortalAuth);

// ============================================================================
// ANALYSIS SCHEMA (v1)
// ============================================================================

const KeyMomentSchema = z.object({
  tSec: z.number(),
  title: z.string(),
  why: z.string()
});

const ObjectionSchema = z.object({
  type: z.string(),
  quote: z.string().optional(),
  response: z.string()
});

export const AnalysisV1Schema = z.object({
  version: z.literal('v1'),
  signalScore: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  intent: z.enum(['info', 'appointment', 'objection', 'not_interested', 'follow_up', 'unclear']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  keyMoments: z.array(KeyMomentSchema).max(6),
  objections: z.array(ObjectionSchema).max(5),
  nextBestAction: z.string().max(240),
  followUpDraft: z.string(),
  riskFlags: z.array(z.string()).max(5),
  generatedAt: z.string(),
  transcriptHash: z.string()
});

export type AnalysisV1 = z.infer<typeof AnalysisV1Schema>;

// ============================================================================
// RATE LIMITING (in-memory)
// ============================================================================

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(portalKey: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(portalKey);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(portalKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  
  entry.count++;
  return true;
}

// ============================================================================
// HELPERS
// ============================================================================

function hashTranscript(transcript: string): string {
  return createHash('sha256').update(transcript).digest('hex').substring(0, 16);
}

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
  };
  filter: {
    field: string;
    value: string;
  };
}

function buildFilterCondition(config: PortalConfig) {
  const { field, value } = config.filter;
  switch (field) {
    case 'userId':
      return eq(callLogs.userId, value);
    case 'metadata.agentId':
      return sql`${callLogs.metadata}->>'agentId' = ${value}`;
    default:
      return eq(callLogs.userId, value);
  }
}

// ============================================================================
// AI ANALYSIS GENERATION
// ============================================================================

async function generateAnalysis(
  transcript: string,
  durationSec: number | null,
  status: string | null,
  contactName: string | null,
  phoneNumber: string | null,
  companyContext: { name: string; city: string }
): Promise<AnalysisV1> {
  
  // Import AI client dynamically to avoid circular deps
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('AI service not configured');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  
  const transcriptHash = hashTranscript(transcript);
  
  const prompt = `You are ARAS Intelligence, an AI sales call analyst. Analyze the following call transcript and return ONLY valid JSON (no markdown, no backticks, no explanation before or after).

CALL CONTEXT:
- Customer: ${companyContext.name} (${companyContext.city})
- Duration: ${durationSec ? `${Math.round(durationSec / 60)} minutes` : 'Unknown'}
- Status: ${status || 'Unknown'}
- Contact: ${contactName || phoneNumber || 'Unknown'}

TRANSCRIPT:
${transcript.substring(0, 8000)}

ANALYSIS REQUIREMENTS:
1. signalScore (0-100): Based on buying intent, appointment readiness, objection handling, clarity of next steps
2. confidence (0-1): How confident you are in this analysis based on transcript quality
3. intent: One of "info", "appointment", "objection", "not_interested", "follow_up", "unclear"
4. sentiment: One of "positive", "neutral", "negative", "mixed"
5. keyMoments: Up to 6 important moments with approximate timestamp (tSec), title, and why it matters
6. objections: Up to 5 objections raised with type, optional quote, and suggested response
7. nextBestAction: Clear, actionable next step (max 240 chars)
8. followUpDraft: 2-4 sentence professional follow-up message in German, tone: clear, concise, professional
9. riskFlags: Up to 5 risk indicators (e.g., "Price sensitivity", "Decision maker not present")

OUTPUT FORMAT (STRICT JSON):
{
  "version": "v1",
  "signalScore": <number>,
  "confidence": <number>,
  "intent": "<string>",
  "sentiment": "<string>",
  "keyMoments": [{"tSec": <number>, "title": "<string>", "why": "<string>"}],
  "objections": [{"type": "<string>", "quote": "<string>", "response": "<string>"}],
  "nextBestAction": "<string>",
  "followUpDraft": "<string>",
  "riskFlags": ["<string>"],
  "generatedAt": "${new Date().toISOString()}",
  "transcriptHash": "${transcriptHash}"
}`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  const text = response.text();
  
  // Extract JSON from response (handle potential markdown wrapping)
  let jsonStr = text.trim();
  
  // Remove markdown code blocks if present
  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }
  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }
  jsonStr = jsonStr.trim();
  
  // Parse and validate
  const parsed = JSON.parse(jsonStr);
  
  // Ensure required fields
  parsed.version = 'v1';
  parsed.generatedAt = new Date().toISOString();
  parsed.transcriptHash = transcriptHash;
  
  // Validate with schema
  const validated = AnalysisV1Schema.parse(parsed);
  
  return validated;
}

// ============================================================================
// GET /api/portal/calls/:id/analysis
// Returns cached analysis if exists, else 404
// ============================================================================

router.get('/calls/:id/analysis', async (req: Request, res: Response) => {
  try {
    const config = (req as any).portalConfig as PortalConfig;
    const callId = parseInt(req.params.id, 10);
    
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid call ID' });
    }
    
    const baseFilter = buildFilterCondition(config);
    
    const [call] = await db
      .select({
        id: callLogs.id,
        transcript: callLogs.transcript,
        metadata: callLogs.metadata
      })
      .from(callLogs)
      .where(and(baseFilter, eq(callLogs.id, callId)))
      .limit(1);
    
    if (!call) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found' });
    }
    
    const meta = (call.metadata || {}) as Record<string, any>;
    const cached = meta.ai?.analysisV1;
    
    if (!cached) {
      return res.status(404).json({ error: 'NO_ANALYSIS', message: 'No analysis available' });
    }
    
    // Verify cache validity
    const currentHash = call.transcript ? hashTranscript(call.transcript) : null;
    if (cached.transcriptHash !== currentHash || cached.version !== 'v1') {
      return res.status(404).json({ error: 'STALE_ANALYSIS', message: 'Analysis needs refresh' });
    }
    
    return res.json({ analysis: cached, cached: true });
    
  } catch (error: any) {
    console.error('[PORTAL-ANALYSIS] Error fetching analysis:', error.message);
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve analysis' });
  }
});

// ============================================================================
// POST /api/portal/calls/:id/analyze
// Generate analysis (uses cache if valid)
// ============================================================================

router.post('/calls/:id/analyze', requirePortalCsrf, requirePortalPermission('analysis.run'), async (req: Request, res: Response) => {
  try {
    const session = (req as any).portalSession;
    const config = (req as any).portalConfig as PortalConfig;
    const callId = parseInt(req.params.id, 10);
    
    if (isNaN(callId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid call ID' });
    }
    
    // Rate limit check
    if (!checkRateLimit(session.portalKey)) {
      return res.status(429).json({ 
        error: 'RATE_LIMITED', 
        message: 'Too many analysis requests. Please wait a few minutes.' 
      });
    }
    
    const baseFilter = buildFilterCondition(config);
    
    const [call] = await db
      .select()
      .from(callLogs)
      .where(and(baseFilter, eq(callLogs.id, callId)))
      .limit(1);
    
    if (!call) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Call not found' });
    }
    
    if (!call.transcript || call.transcript.trim().length < 50) {
      return res.status(422).json({ 
        error: 'INSUFFICIENT_DATA', 
        message: 'Call transcript is too short for analysis' 
      });
    }
    
    const meta = (call.metadata || {}) as Record<string, any>;
    const currentHash = hashTranscript(call.transcript);
    
    // Check cache
    const cached = meta.ai?.analysisV1;
    if (cached && cached.transcriptHash === currentHash && cached.version === 'v1') {
      return res.json({ analysis: cached, cached: true });
    }
    
    // Generate new analysis
    const analysis = await generateAnalysis(
      call.transcript,
      call.duration,
      call.status,
      call.contactName,
      call.phoneNumber,
      { name: config.company.name, city: config.company.zipCity.split(' ').pop() || 'Münster' }
    );
    
    // Save to metadata
    const updatedMeta = {
      ...meta,
      ai: {
        ...(meta.ai || {}),
        analysisV1: analysis
      }
    };
    
    await db
      .update(callLogs)
      .set({ 
        metadata: updatedMeta,
        updatedAt: new Date()
      })
      .where(eq(callLogs.id, callId));
    
    console.log('[PORTAL-ANALYSIS] Analysis generated and cached for call:', callId);
    
    return res.json({ analysis, cached: false });
    
  } catch (error: any) {
    console.error('[PORTAL-ANALYSIS] Error generating analysis:', error.message);
    
    if (error instanceof z.ZodError) {
      return res.status(422).json({ 
        error: 'VALIDATION_ERROR', 
        message: 'Analysis format invalid. Please try again.' 
      });
    }
    
    if (error instanceof SyntaxError) {
      return res.status(422).json({ 
        error: 'PARSE_ERROR', 
        message: 'Analysis response invalid. Please try again.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'ANALYSIS_FAILED', 
      message: 'Analysis could not be completed. Please try again.' 
    });
  }
});

export default router;
