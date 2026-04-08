/**
 * ============================================================================
 * ARAS COMMAND CENTER - Gemini AI Service
 * ============================================================================
 * AI-powered insights using Google Gemini API
 * Supports env vars: GOOGLE_GEMINI_API_KEY (preferred) or GEMINI_API_KEY (fallback)
 * Default model: gemini-2.5-flash (override via GEMINI_MODEL)
 * ============================================================================
 */

import { logger } from '../logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get Gemini API key from environment
 * Prefers GOOGLE_GEMINI_API_KEY, falls back to GEMINI_API_KEY
 */
export function getGeminiKey(): string | null {
  const key = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    logger.warn('[GEMINI] No API key found. Set GOOGLE_GEMINI_API_KEY or GEMINI_API_KEY');
    return null;
  }
  return key;
}

const GEMINI_API_KEY = getGeminiKey();
const AI_PROVIDER = process.env.AI_PROVIDER || (GEMINI_API_KEY ? 'gemini' : 'openai');
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CACHE_TTL_MS = 60 * 1000; // 60 seconds cache

// Simple in-memory cache
interface CacheEntry {
  data: AIInsightResponse;
  timestamp: number;
}

const insightCache = new Map<string, CacheEntry>();

// ============================================================================
// TYPES
// ============================================================================

export interface AIInsightRequest {
  range: '24h' | '7d' | 'today';
  data: {
    deals: any[];
    tasks: any[];
    calls: any[];
    contacts: any[];
    feedItems: any[];
    pendingContracts: any[];
  };
}

export interface AIInsightResponse {
  summary: string;
  keyChanges: string[];
  risksAndBlockers: string[];
  nextBestActions: string[];
  whoShouldDoWhat: Array<{ who: string; what: string }>;
  generatedAt: string;
  provider: string;
  cached: boolean;
}

// ============================================================================
// GEMINI API INTEGRATION
// ============================================================================

async function callGeminiAPI(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.9,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[GEMINI] API error:', errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const result = await response.json();
  
  if (!result.candidates?.[0]?.content?.parts?.[0]?.text) {
    throw new Error('Invalid Gemini response structure');
  }

  return result.candidates[0].content.parts[0].text;
}

// ============================================================================
// INSIGHT GENERATION
// ============================================================================

function buildInsightPrompt(request: AIInsightRequest): string {
  const { range, data } = request;
  const rangeLabel = range === 'today' ? 'heute' : range === '7d' ? 'den letzten 7 Tagen' : 'den letzten 24 Stunden';

  return `Du bist ein Business Intelligence Analyst für ARAS AI, ein Schweizer Premium-Technologieunternehmen.

Analysiere die folgenden Geschäftsdaten aus ${rangeLabel} und erstelle eine prägnante Executive Summary auf Deutsch.

DATEN:
- ${data.deals.length} Deals (${data.deals.filter((d: any) => d.stage === 'CLOSED_WON').length} gewonnen, ${data.deals.filter((d: any) => d.stage === 'CLOSED_LOST').length} verloren)
- ${data.tasks.length} Tasks (${data.tasks.filter((t: any) => t.status === 'DONE').length} erledigt, ${data.tasks.filter((t: any) => t.status === 'OPEN').length} offen)
- ${data.calls.length} Anrufe
- ${data.contacts.length} neue Kontakte
- ${data.feedItems.length} Team-Aktivitäten
- ${data.pendingContracts.length} Verträge warten auf Freigabe

${data.deals.length > 0 ? `Top Deals: ${data.deals.slice(0, 3).map((d: any) => `${d.title} (${d.stage})`).join(', ')}` : ''}
${data.tasks.filter((t: any) => t.status === 'OPEN' && t.dueDate).length > 0 ? `Dringende Tasks: ${data.tasks.filter((t: any) => t.status === 'OPEN').slice(0, 3).map((t: any) => t.title).join(', ')}` : ''}

Antworte NUR im folgenden JSON-Format (keine Markdown, kein Code-Block):
{
  "summary": "Eine kurze Executive Summary in 2-3 Sätzen",
  "keyChanges": ["Änderung 1", "Änderung 2", "Änderung 3"],
  "risksAndBlockers": ["Risiko 1", "Risiko 2"],
  "nextBestActions": ["Aktion 1", "Aktion 2", "Aktion 3"],
  "whoShouldDoWhat": [{"who": "Sales Team", "what": "Follow-up mit Top-Leads"}, {"who": "Admin", "what": "Verträge freigeben"}]
}`;
}

function parseAIResponse(text: string): Partial<AIInsightResponse> {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No JSON found in response');
  } catch (error) {
    logger.warn('[GEMINI] Failed to parse AI response, using fallback');
    return {
      summary: 'KI-Analyse konnte nicht vollständig verarbeitet werden.',
      keyChanges: ['Daten wurden erfasst'],
      risksAndBlockers: [],
      nextBestActions: ['Dashboard prüfen für Details'],
      whoShouldDoWhat: [],
    };
  }
}

// ============================================================================
// PUBLIC API
// ============================================================================

export function isAIConfigured(): boolean {
  return AI_PROVIDER === 'gemini' && !!GEMINI_API_KEY;
}

export function getAIProvider(): string {
  return AI_PROVIDER;
}

export async function generateInsights(request: AIInsightRequest): Promise<AIInsightResponse> {
  const cacheKey = `insights_${request.range}`;
  
  // Check cache
  const cached = insightCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    logger.info('[GEMINI] Returning cached insights');
    return { ...cached.data, cached: true };
  }

  // Check if Gemini is configured
  if (!isAIConfigured()) {
    logger.warn('[GEMINI] AI not configured, returning fallback insights');
    return generateFallbackInsights(request);
  }

  try {
    const prompt = buildInsightPrompt(request);
    const aiText = await callGeminiAPI(prompt);
    const parsed = parseAIResponse(aiText);

    const response: AIInsightResponse = {
      summary: parsed.summary || 'Analyse abgeschlossen.',
      keyChanges: parsed.keyChanges || [],
      risksAndBlockers: parsed.risksAndBlockers || [],
      nextBestActions: parsed.nextBestActions || [],
      whoShouldDoWhat: parsed.whoShouldDoWhat || [],
      generatedAt: new Date().toISOString(),
      provider: 'gemini',
      cached: false,
    };

    // Cache the result
    insightCache.set(cacheKey, { data: response, timestamp: Date.now() });
    
    return response;
  } catch (error: any) {
    logger.error('[GEMINI] Error generating insights:', error.message);
    return generateFallbackInsights(request, error.message);
  }
}

function generateFallbackInsights(request: AIInsightRequest, errorMessage?: string): AIInsightResponse {
  const { data } = request;
  
  const summary = data.deals.length > 0 || data.tasks.length > 0
    ? `${data.deals.length} Deals und ${data.tasks.length} Tasks in diesem Zeitraum. ${data.pendingContracts.length > 0 ? `${data.pendingContracts.length} Verträge warten auf Freigabe.` : ''}`
    : 'Keine neuen Aktivitäten in diesem Zeitraum.';

  const keyChanges: string[] = [];
  if (data.contacts.length > 0) keyChanges.push(`${data.contacts.length} neue Kontakte hinzugefügt`);
  if (data.deals.filter((d: any) => d.stage === 'CLOSED_WON').length > 0) {
    keyChanges.push(`${data.deals.filter((d: any) => d.stage === 'CLOSED_WON').length} Deals gewonnen`);
  }
  if (data.tasks.filter((t: any) => t.status === 'DONE').length > 0) {
    keyChanges.push(`${data.tasks.filter((t: any) => t.status === 'DONE').length} Tasks abgeschlossen`);
  }

  const risksAndBlockers: string[] = [];
  if (data.pendingContracts.length > 0) {
    risksAndBlockers.push(`${data.pendingContracts.length} Verträge warten auf Genehmigung`);
  }
  const overdueTasks = data.tasks.filter((t: any) => t.status !== 'DONE' && t.dueDate && new Date(t.dueDate) < new Date());
  if (overdueTasks.length > 0) {
    risksAndBlockers.push(`${overdueTasks.length} überfällige Tasks`);
  }

  return {
    summary,
    keyChanges: keyChanges.length > 0 ? keyChanges : ['Keine signifikanten Änderungen'],
    risksAndBlockers,
    nextBestActions: data.pendingContracts.length > 0 
      ? ['Ausstehende Verträge prüfen und freigeben'] 
      : ['Dashboard regelmäßig prüfen'],
    whoShouldDoWhat: [],
    generatedAt: new Date().toISOString(),
    provider: errorMessage ? 'fallback' : 'rule-based',
    cached: false,
  };
}

export function clearInsightCache(): void {
  insightCache.clear();
  logger.info('[GEMINI] Insight cache cleared');
}
