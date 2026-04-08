/**
 * ARAS AI Recommendations API
 * Gemini-powered call analysis and action recommendations
 * Caches results in callLogs.metadata.gemini
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { callLogs, contacts, dailyBriefings, users } from '@shared/schema';
import { eq, and, gte, desc, lt } from 'drizzle-orm';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = Router();

// Initialize Gemini (may be disabled if no API key)
// CRITICAL: Use GOOGLE_GEMINI_API_KEY (primary) with fallback to GOOGLE_AI_API_KEY
const GOOGLE_AI_KEY = process.env.GOOGLE_GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';
const genAI = GOOGLE_AI_KEY ? new GoogleGenerativeAI(GOOGLE_AI_KEY) : null;
const GEMINI_ENABLED = Boolean(genAI && GOOGLE_AI_KEY.length > 10);

// Log Gemini status at startup (no key leak)
console.log(`[AI] Gemini status: ${GEMINI_ENABLED ? 'ENABLED' : 'DISABLED (no API key configured)'}`);

// Cache TTL in hours
const CACHE_TTL_HOURS = 24;

// Rate limit tracking (in-memory, per-user)
const rateLimitMap = new Map<string, { lastRequest: number; mode: string }>();
const RATE_LIMIT_CACHED_MS = 5 * 60 * 1000;    // 5 min for cached mode
const RATE_LIMIT_REALTIME_MS = 2 * 60 * 1000;  // 2 min for realtime mode
const TTL_CACHED_MS = 6 * 60 * 60 * 1000;      // 6 hours
const TTL_REALTIME_MS = 10 * 60 * 1000;        // 10 minutes

// Check if Gemini is available
function checkGeminiAvailable(res: Response): boolean {
  if (!GEMINI_ENABLED) {
    res.status(503).json({ 
      error: 'GEMINI_DISABLED', 
      message: 'Gemini AI ist für diese Umgebung nicht konfiguriert',
      enabled: false,
    });
    return false;
  }
  return true;
}

interface GeminiRecommendations {
  actions: string[];
  priority: number;
  suggestedMessage: string;
  riskFlags: string[];
  reasoning: string;
  generatedAt: string;
}

// ═══════════════════════════════════════════════════════════════
// GENERATE RECOMMENDATIONS FOR A CALL
// ═══════════════════════════════════════════════════════════════

router.post('/recommendations', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const { callId, forceRefresh } = req.body;

  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Unauthorized' });
  }

  if (!callId) {
    return res.status(400).json({ error: 'MISSING_CALL_ID', message: 'callId required' });
  }
  
  // Check Gemini availability (but still allow cached results)
  const geminiAvailable = GEMINI_ENABLED;

  try {
    // Fetch call from DB
    const [call] = await db.select().from(callLogs)
      .where(eq(callLogs.id, parseInt(callId, 10)))
      .limit(1);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (call.userId !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Parse existing metadata
    let metadata: Record<string, any> = {};
    if (call.metadata) {
      if (typeof call.metadata === 'string') {
        try { metadata = JSON.parse(call.metadata); } catch {}
      } else if (typeof call.metadata === 'object') {
        metadata = call.metadata as Record<string, any>;
      }
    }

    // Check cache - return if fresh (unless forceRefresh)
    if (metadata.gemini?.generatedAt && !forceRefresh) {
      const generatedAt = new Date(metadata.gemini.generatedAt);
      const hoursSinceGenerated = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceGenerated < CACHE_TTL_HOURS) {
        return res.json({
          cached: true,
          cacheAge: Math.round(hoursSinceGenerated * 10) / 10,
          recommendations: metadata.gemini,
          geminiEnabled: geminiAvailable,
        });
      }
    }
    
    // If Gemini is disabled and no cache, return error
    if (!geminiAvailable) {
      return res.status(503).json({ 
        error: 'GEMINI_DISABLED', 
        message: 'Gemini AI ist nicht verfügbar und keine gecachten Empfehlungen vorhanden',
        cached: false,
        geminiEnabled: false,
      });
    }

    // Prepare context for Gemini
    const transcript = call.transcript || '';
    const summary = metadata.summary || metadata.ai_summary || '';
    const contactName = call.contactName || 'Unbekannt';
    const status = call.status || 'unknown';
    const duration = call.duration || 0;

    // Fetch contact info if available
    let contactInfo = '';
    if (call.leadId) {
      try {
        const [contact] = await db.select().from(contacts)
          .where(eq(contacts.id, String(call.leadId)))
          .limit(1);
        if (contact) {
          contactInfo = `Firma: ${contact.company || 'N/A'}, Position: ${(contact as any).position || 'N/A'}`;
        }
      } catch {}
    }

    // Build Gemini prompt
    const prompt = `Du bist ein Sales-Intelligence-Assistent für ARAS AI, eine B2B-Vertriebsplattform.

Analysiere diesen Anruf und generiere konkrete Handlungsempfehlungen:

ANRUF-DATEN:
- Kontakt: ${contactName}
- Status: ${status}
- Dauer: ${Math.round(duration / 60)} Minuten
${contactInfo ? `- Kontaktinfo: ${contactInfo}` : ''}

${summary ? `ZUSAMMENFASSUNG:\n${summary}\n` : ''}

${transcript ? `TRANSKRIPT (Auszug):\n${transcript.substring(0, 2000)}\n` : ''}

Generiere eine JSON-Antwort mit:
1. "actions": Array von 3-5 konkreten nächsten Schritten (z.B. "Follow-up E-Mail senden", "Termin für Demo vereinbaren")
2. "priority": Prioritätsscore 0-100 (wie wichtig ist schnelles Handeln?)
3. "suggestedMessage": Ein kurzer Vorschlag für die nächste Nachricht/E-Mail an den Kontakt
4. "riskFlags": Array von erkannten Risiken/Einwänden (z.B. "Preisbedenken", "Konkurrenzdruck", "Zeitdruck")
5. "reasoning": Kurze Begründung deiner Empfehlungen (1-2 Sätze)

Antworte NUR mit validem JSON, keine Erklärungen.`;

    // Call Gemini
    const model = genAI!.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // Parse Gemini response
    let recommendations: GeminiRecommendations;
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);
      
      recommendations = {
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 7) : [],
        priority: typeof parsed.priority === 'number' ? Math.min(100, Math.max(0, parsed.priority)) : 50,
        suggestedMessage: typeof parsed.suggestedMessage === 'string' ? parsed.suggestedMessage : '',
        riskFlags: Array.isArray(parsed.riskFlags) ? parsed.riskFlags : [],
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        generatedAt: new Date().toISOString(),
      };
    } catch (parseError) {
      console.error('[AI] Failed to parse Gemini response:', parseError);
      
      // Fallback recommendations
      recommendations = {
        actions: ['Follow-up planen', 'Notizen vervollständigen', 'Nächsten Kontakt terminieren'],
        priority: 50,
        suggestedMessage: `Hallo ${contactName}, vielen Dank für unser Gespräch. Ich melde mich wie besprochen.`,
        riskFlags: [],
        reasoning: 'Automatische Empfehlungen basierend auf Anrufstatus.',
        generatedAt: new Date().toISOString(),
      };
    }

    // Cache in metadata
    metadata.gemini = recommendations;
    
    await db.update(callLogs)
      .set({ 
        metadata: metadata,
        updatedAt: new Date(),
      })
      .where(eq(callLogs.id, call.id));

    res.json({
      cached: false,
      recommendations,
      geminiEnabled: true,
    });

  } catch (error: any) {
    console.error('[AI] Recommendations error:', error);
    
    // Check if it's a Gemini API error
    const isGeminiError = error.message?.includes('API') || error.message?.includes('quota') || error.message?.includes('key');
    
    res.status(isGeminiError ? 503 : 500).json({ 
      error: isGeminiError ? 'GEMINI_API_ERROR' : 'GENERATION_FAILED',
      message: 'Empfehlungen konnten nicht generiert werden', 
      detail: error.message,
      geminiEnabled: GEMINI_ENABLED,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// BATCH RECOMMENDATIONS FOR DASHBOARD (top 5 calls)
// ═══════════════════════════════════════════════════════════════

// Status endpoint - check if Gemini is available
router.get('/status', async (_req: Request, res: Response) => {
  res.json({
    geminiEnabled: GEMINI_ENABLED,
    cacheTtlHours: CACHE_TTL_HOURS,
  });
});

router.get('/dashboard-actions', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  const range = req.query.range as string || '7d';

  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Unauthorized' });
  }

  try {
    // Calculate date range
    const now = new Date();
    let rangeStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (range === 'today') rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    else if (range === '30d') rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    // Get recent calls with existing Gemini recommendations
    const recentCalls = await db.select().from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(callLogs.createdAt)
      .limit(20);

    const topActions: Array<{
      callId: number;
      contactName: string;
      action: string;
      priority: number;
      reasoning: string;
    }> = [];

    for (const call of recentCalls) {
      let metadata: Record<string, any> = {};
      if (call.metadata) {
        if (typeof call.metadata === 'string') {
          try { metadata = JSON.parse(call.metadata); } catch {}
        } else if (typeof call.metadata === 'object') {
          metadata = call.metadata as Record<string, any>;
        }
      }

      if (metadata.gemini?.actions?.length > 0) {
        topActions.push({
          callId: call.id,
          contactName: call.contactName || call.phoneNumber || 'Unbekannt',
          action: metadata.gemini.actions[0],
          priority: metadata.gemini.priority || 50,
          reasoning: metadata.gemini.reasoning || '',
        });
      }
    }

    // Sort by priority descending
    topActions.sort((a, b) => b.priority - a.priority);

    res.json({
      actions: topActions.slice(0, 5),
      totalCalls: recentCalls.length,
      callsWithGemini: topActions.length,
      geminiEnabled: GEMINI_ENABLED,
      range,
    });

  } catch (error: any) {
    console.error('[AI] Dashboard actions error:', error);
    res.status(500).json({ 
      error: 'FETCH_ERROR',
      message: 'Dashboard-Aktionen konnten nicht geladen werden', 
      detail: error.message,
      geminiEnabled: GEMINI_ENABLED,
    });
  }
});

// ═══════════════════════════════════════════════════════════════
// DAILY BRIEFING V5 - Realtime Gemini + DB Cache + Rate Limits
// ═══════════════════════════════════════════════════════════════

interface BriefingPayload {
  headline: string;
  missionSummary?: string;
  topPriorities: Array<{
    title: string;
    why: string;
    callId?: string;
    contactId?: string;
    contactName?: string;
    impact?: string;
    action?: string;
  }>;
  quickWins: string[];
  riskFlags: string[];
}

interface BriefingResponse extends BriefingPayload {
  generatedAt: string;
  cached: boolean;
  mode: 'cached' | 'realtime';
  sourceCount?: number;
  sources?: Array<{ title: string; url?: string; publisher?: string; date?: string }>;
  meta?: {
    ttlSeconds: number;
    personalization?: { industry?: string; region?: string; callsAnalyzed?: number };
    fallbackUsed?: boolean;
  };
}

// Helper: Check rate limit
function checkRateLimit(userId: string, mode: 'cached' | 'realtime'): { allowed: boolean; retryAfterMs?: number } {
  const key = `${userId}-${mode}`;
  const limit = rateLimitMap.get(key);
  const limitMs = mode === 'realtime' ? RATE_LIMIT_REALTIME_MS : RATE_LIMIT_CACHED_MS;
  
  if (limit && Date.now() - limit.lastRequest < limitMs) {
    return { allowed: false, retryAfterMs: limitMs - (Date.now() - limit.lastRequest) };
  }
  return { allowed: true };
}

function setRateLimit(userId: string, mode: 'cached' | 'realtime') {
  const key = `${userId}-${mode}`;
  rateLimitMap.set(key, { lastRequest: Date.now(), mode });
}

// Helper: Generate briefing with Gemini (realtime mode)
async function generateGeminiBriefing(
  userId: string,
  callData: any[],
  userProfile: any
): Promise<{ payload: BriefingPayload; sources?: any[] } | null> {
  if (!genAI || !GEMINI_ENABLED) return null;

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    
    // Build context from calls
    const callSummaries = callData.slice(0, 10).map(call => {
      let metadata: any = {};
      try {
        metadata = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata || {};
      } catch {}
      const summary = metadata.summary || {};
      return {
        contact: call.contactName || call.phoneNumber || 'Unbekannt',
        sentiment: summary.sentiment || 'neutral',
        nextStep: summary.nextStep || summary.next_step || null,
        objections: summary.objections || [],
        outcome: summary.outcome || null,
      };
    });

    const systemPrompt = `Du bist ein hocheffizienter B2B-Sales-AI-Assistent für ARAS AI, eine Outbound-Calling-Plattform.
Erstelle ein Daily Mission Briefing basierend auf den folgenden Daten.

REGELN:
- Keine Floskeln, keine Superlative
- Jede Priority muss eine konkrete Action enthalten
- Sprache: Deutsch, Sie-Form, modern und klar
- Keine erfundenen Quellen - nur wenn echte URLs vorhanden sind

USER KONTEXT:
- Branche: ${userProfile?.industry || 'Nicht angegeben'}
- Produkt: B2B Outbound Calling Platform
- Calls analysiert: ${callData.length}

CALLS (letzte ${callData.length}):
${JSON.stringify(callSummaries, null, 2)}

OUTPUT FORMAT (JSON only, keine Erklärung):
{
  "headline": "Kurze Headline (max 60 Zeichen)",
  "missionSummary": "1-2 Sätze Mission Summary",
  "topPriorities": [
    { "title": "Kontaktname", "why": "Grund", "action": "Konkrete Aktion" }
  ],
  "quickWins": ["Quick Win 1", "Quick Win 2"],
  "riskFlags": ["Risk 1 wenn vorhanden"]
}`;

    const result = await model.generateContent(systemPrompt);
    const text = result.response.text();
    
    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      payload: {
        headline: parsed.headline || 'Daily Briefing',
        missionSummary: parsed.missionSummary,
        topPriorities: (parsed.topPriorities || []).slice(0, 5),
        quickWins: (parsed.quickWins || []).slice(0, 3),
        riskFlags: parsed.riskFlags || [],
      },
      sources: parsed.sources || undefined,
    };
  } catch (error: any) {
    console.error('[AI] Gemini briefing error:', error.message);
    return null;
  }
}

// Helper: Generate local briefing (fallback, no Gemini)
function generateLocalBriefing(callData: any[]): BriefingPayload {
  let positiveCount = 0;
  let negativeCount = 0;
  let withObjections = 0;
  let withNextStep = 0;
  const priorities: BriefingPayload['topPriorities'] = [];

  for (const call of callData) {
    let metadata: any = {};
    try {
      metadata = typeof call.metadata === 'string' ? JSON.parse(call.metadata) : call.metadata || {};
    } catch {}

    const summary = metadata.summary || {};
    const sentiment = summary.sentiment || metadata.sentiment;
    const nextStep = summary.nextStep || summary.next_step;
    const objections = summary.objections || [];

    if (sentiment === 'positive') positiveCount++;
    if (sentiment === 'negative') negativeCount++;
    if (objections.length > 0) withObjections++;
    if (nextStep) withNextStep++;

    if (nextStep || objections.length > 0 || sentiment === 'positive') {
      priorities.push({
        title: call.contactName || call.phoneNumber || 'Kontakt',
        why: nextStep 
          ? `Nächster Schritt: ${String(nextStep).substring(0, 60)}` 
          : objections.length > 0 
            ? `Einwand: ${String(objections[0]).substring(0, 60)}`
            : 'Positives Gespräch - nachfassen',
        callId: String(call.id),
        contactName: call.contactName || undefined,
        action: nextStep ? 'Follow-up durchführen' : 'Kontakt priorisieren',
      });
    }
  }

  // Build headline
  let headline = '';
  if (positiveCount > 0 && withObjections > 0) {
    headline = `${positiveCount} positive${positiveCount > 1 ? ' Leads' : 'r Lead'}, ${withObjections} offene${withObjections > 1 ? ' Einwände' : 'r Einwand'}`;
  } else if (positiveCount > 0) {
    headline = `${positiveCount} vielversprechende${positiveCount > 1 ? ' Gespräche' : 's Gespräch'} - Follow-up priorisieren`;
  } else if (withNextStep > 0) {
    headline = `${withNextStep} Anrufe mit konkreten nächsten Schritten`;
  } else {
    headline = `${callData.length} Anrufe analysiert`;
  }

  // Quick wins
  const quickWins: string[] = [];
  if (withNextStep > 0) quickWins.push('Follow-up Tasks erstellen');
  if (positiveCount > 0) quickWins.push('Positive Leads priorisieren');
  if (withObjections > 0) quickWins.push('Einwände dokumentieren');
  if (quickWins.length === 0) quickWins.push('Gesprächsnotizen vervollständigen');

  // Risk flags
  const riskFlags: string[] = [];
  if (negativeCount > 2) riskFlags.push(`${negativeCount} negative Gespräche - Strategie prüfen`);
  if (withObjections > 3) riskFlags.push('Viele offene Einwände - FAQ erweitern');

  return {
    headline,
    missionSummary: `Basierend auf ${callData.length} Anrufen habe ich ${priorities.length} priorisierte Aktionen identifiziert.`,
    topPriorities: priorities.slice(0, 5),
    quickWins: quickWins.slice(0, 3),
    riskFlags,
  };
}

router.post('/daily-briefing', async (req: Request, res: Response) => {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { mode = 'cached', force = false } = req.body;
    const requestMode = mode === 'realtime' && GEMINI_ENABLED ? 'realtime' : 'cached';
    const now = new Date();

    // Check rate limit (only on force refresh)
    if (force) {
      const rateCheck = checkRateLimit(userId, requestMode);
      if (!rateCheck.allowed) {
        const retryAfterSeconds = Math.ceil((rateCheck.retryAfterMs || 0) / 1000);
        const nextAllowedAt = new Date(Date.now() + (rateCheck.retryAfterMs || 0)).toISOString();
        return res.status(429).json({
          error: 'RATE_LIMITED',
          message: `Bitte warten: ${requestMode === 'realtime' ? 'Realtime' : 'Cache'} wieder möglich ab ${new Date(nextAllowedAt).toLocaleTimeString('de-AT', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit' })}`,
          retryAfterMs: rateCheck.retryAfterMs,
          retryAfterSeconds,
          nextAllowedAt,
        });
      }
    }

    // Check DB cache first (unless force refresh)
    if (!force) {
      const [cached] = await db.select()
        .from(dailyBriefings)
        .where(and(
          eq(dailyBriefings.userId, userId),
          eq(dailyBriefings.mode, requestMode),
          gte(dailyBriefings.expiresAt, now)
        ))
        .orderBy(desc(dailyBriefings.createdAt))
        .limit(1);

      if (cached && cached.payload) {
        const response: BriefingResponse = {
          ...cached.payload,
          generatedAt: cached.createdAt.toISOString(),
          cached: true,
          mode: cached.mode as 'cached' | 'realtime',
          sourceCount: cached.sources?.length,
          sources: cached.sources || undefined,
          meta: {
            ttlSeconds: Math.floor((cached.expiresAt.getTime() - now.getTime()) / 1000),
            personalization: cached.personalization || undefined,
          },
        };
        return res.json(response);
      }
    }

    // Set rate limit
    setRateLimit(userId, requestMode);

    // Calculate date range (7 days)
    const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get recent calls
    const recentCalls = await db.select()
      .from(callLogs)
      .where(and(
        eq(callLogs.userId, userId),
        gte(callLogs.createdAt, startDate),
        eq(callLogs.status, 'completed')
      ))
      .orderBy(desc(callLogs.createdAt))
      .limit(50);

    // Handle empty state
    if (recentCalls.length === 0) {
      const emptyResponse: BriefingResponse = {
        headline: 'Noch keine Anrufe in diesem Zeitraum',
        missionSummary: 'Starte deinen ersten Anruf um personalisierte Empfehlungen zu erhalten.',
        topPriorities: [],
        quickWins: ['Ersten Anruf starten', 'Kontakte importieren'],
        riskFlags: [],
        generatedAt: now.toISOString(),
        cached: false,
        mode: requestMode,
        meta: { ttlSeconds: 0 },
      };
      return res.json(emptyResponse);
    }

    // Get user profile for personalization
    const [userProfile] = await db.select({
      industry: users.industry,
      company: users.company,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Generate briefing
    let payload: BriefingPayload;
    let sources: any[] | undefined;
    let fallbackUsed = false;

    if (requestMode === 'realtime' && GEMINI_ENABLED) {
      const geminiResult = await generateGeminiBriefing(userId, recentCalls, userProfile);
      if (geminiResult) {
        payload = geminiResult.payload;
        sources = geminiResult.sources;
      } else {
        // Fallback to local generation
        payload = generateLocalBriefing(recentCalls);
        fallbackUsed = true;
      }
    } else {
      payload = generateLocalBriefing(recentCalls);
    }

    // Calculate TTL
    const ttlMs = requestMode === 'realtime' ? TTL_REALTIME_MS : TTL_CACHED_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);

    // Store in DB
    try {
      await db.insert(dailyBriefings).values({
        userId,
        mode: requestMode,
        payload,
        sources: sources || null,
        personalization: {
          industry: userProfile?.industry || undefined,
          callsAnalyzed: recentCalls.length,
        },
        expiresAt,
      });
    } catch (dbError: any) {
      console.error('[AI] Failed to cache briefing:', dbError.message);
      // Continue even if caching fails
    }

    // Build response with geminiEnabled, expiresAt, and nextAllowedAt
    const rateLimitMs = requestMode === 'realtime' ? RATE_LIMIT_REALTIME_MS : RATE_LIMIT_CACHED_MS;
    const nextAllowedAt = new Date(now.getTime() + rateLimitMs).toISOString();
    
    const response: BriefingResponse & { expiresAt: string; meta: { geminiEnabled: boolean; rateLimit: { minIntervalSeconds: number; nextAllowedAt: string } } } = {
      ...payload,
      generatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      cached: false,
      mode: requestMode,
      sourceCount: sources?.length,
      sources,
      meta: {
        ttlSeconds: Math.floor(ttlMs / 1000),
        personalization: {
          industry: userProfile?.industry || undefined,
          callsAnalyzed: recentCalls.length,
        },
        fallbackUsed,
        geminiEnabled: GEMINI_ENABLED,
        rateLimit: {
          minIntervalSeconds: Math.floor(rateLimitMs / 1000),
          nextAllowedAt,
        },
      },
    };

    res.json(response);

  } catch (error: any) {
    console.error('[AI] Daily briefing error:', error);
    res.status(500).json({ 
      error: 'BRIEFING_ERROR',
      message: 'Briefing konnte nicht erstellt werden',
      detail: error.message,
      geminiEnabled: GEMINI_ENABLED,
    });
  }
});

// Endpoint to check Gemini availability
router.get('/status', async (req: Request, res: Response) => {
  res.json({
    geminiEnabled: GEMINI_ENABLED,
    geminiModel: GEMINI_ENABLED ? 'gemini-pro' : null,
  });
});

export default router;
