/**
 * 🔥 GEMINI ENRICHMENT MODULE
 * Company intelligence enrichment via Google Gemini API
 * Uses @google/genai SDK with Structured Output (JSON Schema)
 * Tools: googleSearch (grounding) + urlContext
 * Model auto-resolution via ListModels with 15min cache
 *
 * NO OpenAI dependency. Zero.
 */

import { GoogleGenAI } from "@google/genai";

// ============================================================================
// CONFIGURATION
// ============================================================================

const PREFERRED_MODEL = "gemini-3-pro-preview";
const TIMEOUT_MS = 60_000; // 60s hard timeout
const MAX_OUTPUT_TOKENS = 4096;
const MODEL_CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_RETRIES = 1; // 1 retry for transient errors (429/503)
const RETRY_DELAY_MS = 3_000;

// ============================================================================
// MODEL RESOLVER — ListModels + 15min in-memory cache
// ============================================================================

let _cachedModel: string | null = null;
let _cachedAt = 0;

export async function resolveGeminiModel(apiKey: string): Promise<string> {
  // Return cached if still valid
  if (_cachedModel && Date.now() - _cachedAt < MODEL_CACHE_TTL_MS) {
    return _cachedModel;
  }

  // ENV override always wins
  const envModel = process.env.GEMINI_ENRICH_MODEL;
  if (envModel) {
    _cachedModel = envModel;
    _cachedAt = Date.now();
    console.log('[enrich.gemini.model] Using ENV override:', envModel);
    return envModel;
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) {
      console.error('[enrich.gemini.model] ListModels HTTP error:', resp.status);
      _cachedModel = PREFERRED_MODEL;
      _cachedAt = Date.now();
      return PREFERRED_MODEL;
    }

    const body = await resp.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const models = body.models || [];

    // Check if preferred model exists and supports generateContent
    const preferred = models.find(
      (m) => m.name === `models/${PREFERRED_MODEL}` &&
             m.supportedGenerationMethods?.includes('generateContent')
    );
    if (preferred) {
      _cachedModel = PREFERRED_MODEL;
      _cachedAt = Date.now();
      console.log('[enrich.gemini.model] Resolved preferred:', PREFERRED_MODEL);
      return PREFERRED_MODEL;
    }

    // Fallback: first model containing "pro" that supports generateContent
    const fallback = models.find(
      (m) => m.name.includes('pro') &&
             m.supportedGenerationMethods?.includes('generateContent')
    );
    if (fallback) {
      const fbName = fallback.name.replace('models/', '');
      _cachedModel = fbName;
      _cachedAt = Date.now();
      console.log('[enrich.gemini.model] Preferred not found, fallback:', fbName);
      return fbName;
    }

    // Last resort
    console.warn('[enrich.gemini.model] No suitable model found in ListModels, using preferred as-is');
    _cachedModel = PREFERRED_MODEL;
    _cachedAt = Date.now();
    return PREFERRED_MODEL;

  } catch (err: any) {
    console.error('[enrich.gemini.model] ListModels failed:', err?.message?.substring(0, 200));
    _cachedModel = PREFERRED_MODEL;
    _cachedAt = Date.now();
    return PREFERRED_MODEL;
  }
}

// Force cache invalidation (used when model_not_found is hit)
function invalidateModelCache(): void {
  _cachedModel = null;
  _cachedAt = 0;
}

// ============================================================================
// JSON SCHEMA for Structured Output
// ============================================================================

const ENRICHMENT_JSON_SCHEMA = {
  type: "object" as const,
  properties: {
    companyDescription: { type: "string" as const },
    foundedYear: { type: "string" as const },
    ceoName: { type: "string" as const },
    employeeCount: { type: "string" as const },
    headquarters: { type: "string" as const },
    products: { type: "array" as const, items: { type: "string" as const } },
    services: { type: "array" as const, items: { type: "string" as const } },
    targetAudience: { type: "string" as const },
    targetAudienceSegments: { type: "array" as const, items: { type: "string" as const } },
    decisionMakers: { type: "array" as const, items: { type: "string" as const } },
    competitors: { type: "array" as const, items: { type: "string" as const } },
    uniqueSellingPoints: { type: "array" as const, items: { type: "string" as const } },
    brandVoice: { type: "string" as const },
    callAngles: { type: "array" as const, items: { type: "string" as const } },
    objectionHandling: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          objection: { type: "string" as const },
          response: { type: "string" as const }
        },
        required: ["objection", "response"]
      }
    },
    bestCallTimes: { type: "string" as const },
    effectiveKeywords: { type: "array" as const, items: { type: "string" as const } },
    opportunities: { type: "array" as const, items: { type: "string" as const } },
    marketPosition: { type: "string" as const },
    recentNews: { type: "array" as const, items: { type: "string" as const } },
    confidence: { type: "number" as const }
  },
  required: [
    "companyDescription", "products", "services", "targetAudience",
    "brandVoice", "effectiveKeywords", "confidence"
  ]
};

// ============================================================================
// TYPES
// ============================================================================

export interface GeminiEnrichInput {
  company: string;
  industry: string;
  role: string;
  website: string | null;
  firstName: string;
  lastName: string;
  primaryGoal: string;
  language: string;
  email?: string;
}

export interface GeminiEnrichResult {
  success: boolean;
  data: any | null;
  sources: string[];
  confidence: number;
  error: string | null;
  durationMs: number;
  model: string;
  tokensUsed: number | null;
}

// ============================================================================
// ERROR CLASSIFICATION
// ============================================================================

function classifyError(msg: string): { code: string; retryable: boolean } {
  if (msg.includes('not found') || msg.includes('404') || msg.includes('NOT_FOUND')) {
    return { code: 'model_not_found', retryable: false };
  }
  if (msg.includes('API key') || msg.includes('401') || msg.includes('403') || msg.includes('PERMISSION_DENIED')) {
    return { code: 'auth', retryable: false };
  }
  if (msg.includes('aborted') || msg.includes('abort') || msg.includes('timeout') || msg.includes('TimeoutError')) {
    return { code: 'timeout', retryable: true };
  }
  if (msg.includes('quota') || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    return { code: 'quota', retryable: true };
  }
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('overloaded')) {
    return { code: 'unavailable', retryable: true };
  }
  return { code: 'unknown', retryable: true };
}

// ============================================================================
// SINGLE GEMINI CALL (no retry logic — caller handles retries)
// ============================================================================

async function callGemini(
  ai: InstanceType<typeof GoogleGenAI>,
  model: string,
  prompt: string,
  tools: any[]
): Promise<{ rawText: string; tokensUsed: number | null; sources: string[] }> {

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools,
      responseMimeType: "application/json",
      responseSchema: ENRICHMENT_JSON_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS
    }
  });

  const rawText = response.text || '';
  const tokensUsed = (response as any)?.usageMetadata?.totalTokenCount ?? null;

  // Extract grounding sources
  const sources: string[] = [];
  try {
    const groundingMeta = (response as any)?.candidates?.[0]?.groundingMetadata;
    if (groundingMeta?.groundingChunks) {
      for (const chunk of groundingMeta.groundingChunks) {
        if (chunk?.web?.uri) sources.push(chunk.web.uri);
      }
    }
  } catch { /* ignore */ }

  return { rawText, tokensUsed, sources };
}

// ============================================================================
// CORE FUNCTION — with smart retry + model fallback
// ============================================================================

export async function geminiEnrichProfile(input: GeminiEnrichInput): Promise<GeminiEnrichResult> {
  const startTime = Date.now();

  // 1. API Key check
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[enrich.gemini.error] No GOOGLE_GEMINI_API_KEY set');
    return {
      success: false, data: null, sources: [], confidence: 0,
      error: 'missing_gemini_key', durationMs: Date.now() - startTime,
      model: PREFERRED_MODEL, tokensUsed: null
    };
  }

  // 2. Resolve model via ListModels (cached 15min)
  let model = await resolveGeminiModel(apiKey);

  // 3. Normalize website URL
  let websiteUrl = input.website || null;
  if (websiteUrl && !websiteUrl.startsWith('http://') && !websiteUrl.startsWith('https://')) {
    websiteUrl = 'https://' + websiteUrl;
  }

  // 4. Build tools — Google Search (grounding) + urlContext
  const tools: any[] = [{ googleSearch: {} }];
  if (websiteUrl) {
    tools.push({ urlContext: {} });
  }

  // 5. Build prompt
  const prompt = buildEnrichPrompt(input, websiteUrl);

  console.log('[enrich.gemini.calling]', JSON.stringify({
    model,
    hasWebsite: !!websiteUrl,
    websiteUrl: websiteUrl || null,
    tools: tools.map((t: any) => Object.keys(t)[0]),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    timeoutMs: TIMEOUT_MS
  }));

  const ai = new GoogleGenAI({ apiKey });

  // 6. Retry loop: max MAX_RETRIES+1 attempts total
  let lastError: string = 'unknown';
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Timeout wrapper
      const result = await Promise.race([
        callGemini(ai, model, prompt, tools),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('TimeoutError: Gemini call exceeded ' + TIMEOUT_MS + 'ms')), TIMEOUT_MS)
        )
      ]);

      const durationMs = Date.now() - startTime;

      // Empty response check
      if (!result.rawText || result.rawText.length < 20) {
        console.error('[enrich.gemini.error] Empty response', JSON.stringify({
          attempt, model, textLength: result.rawText.length, durationMs
        }));
        lastError = 'empty_response';
        continue; // retry
      }

      // Parse JSON
      let parsed: any;
      try {
        parsed = JSON.parse(result.rawText);
      } catch (parseErr: any) {
        console.error('[enrich.gemini.error] JSON parse failed', JSON.stringify({
          attempt, model, error: parseErr.message,
          textPreview: result.rawText.substring(0, 200), durationMs
        }));
        lastError = 'parse_failed';
        continue; // retry
      }

      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5;

      console.log('[enrich.gemini.success]', JSON.stringify({
        model, attempt, durationMs,
        tokensUsed: result.tokensUsed, confidence,
        sourcesCount: result.sources.length,
        hasCompanyDesc: !!parsed.companyDescription,
        productsCount: Array.isArray(parsed.products) ? parsed.products.length : 0,
        competitorsCount: Array.isArray(parsed.competitors) ? parsed.competitors.length : 0
      }));

      return {
        success: true, data: parsed, sources: result.sources,
        confidence, error: null, durationMs, model,
        tokensUsed: result.tokensUsed
      };

    } catch (err: any) {
      const msg = err?.message || String(err);
      const { code, retryable } = classifyError(msg);
      const durationMs = Date.now() - startTime;

      console.error('[enrich.gemini.error]', JSON.stringify({
        errorCode: code, attempt, model, retryable,
        errorMessage: msg.substring(0, 300), durationMs
      }));

      // model_not_found → invalidate cache, re-resolve, retry ONCE with fallback
      if (code === 'model_not_found' && attempt === 0) {
        console.log('[enrich.gemini.model] Model not found, invalidating cache and re-resolving...');
        invalidateModelCache();
        // Force a re-resolve that skips the preferred model
        model = await resolveGeminiModelFallback(apiKey, model);
        console.log('[enrich.gemini.model] Retrying with fallback model:', model);
        continue; // retry with new model
      }

      // Non-retryable → bail immediately
      if (!retryable) {
        return {
          success: false, data: null, sources: [], confidence: 0,
          error: code, durationMs, model, tokensUsed: null
        };
      }

      lastError = code;

      // Retryable + not last attempt → wait and retry
      if (attempt < MAX_RETRIES) {
        console.log('[enrich.gemini.retry]', JSON.stringify({ attempt, delayMs: RETRY_DELAY_MS, code }));
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }

  // All attempts exhausted
  return {
    success: false, data: null, sources: [], confidence: 0,
    error: lastError, durationMs: Date.now() - startTime,
    model, tokensUsed: null
  };
}

// ============================================================================
// FALLBACK MODEL RESOLVER (skips the failed model)
// ============================================================================

async function resolveGeminiModelFallback(apiKey: string, failedModel: string): Promise<string> {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!resp.ok) return PREFERRED_MODEL;

    const body = await resp.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
    const models = body.models || [];

    // Find first "pro" model that supports generateContent AND is not the failed one
    const fallback = models.find(
      (m) => m.name.includes('pro') &&
             m.name !== `models/${failedModel}` &&
             m.supportedGenerationMethods?.includes('generateContent')
    );

    if (fallback) {
      const fbName = fallback.name.replace('models/', '');
      _cachedModel = fbName;
      _cachedAt = Date.now();
      console.log('[enrich.gemini.model] Fallback resolved:', fbName);
      return fbName;
    }

    // Log available models for debugging
    const available = models
      .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name.replace('models/', ''))
      .slice(0, 10);
    console.warn('[enrich.gemini.model] No pro fallback found. Available:', available.join(', '));

    // Pick first available generateContent model as absolute last resort
    const any = models.find(m => m.supportedGenerationMethods?.includes('generateContent'));
    if (any) {
      const name = any.name.replace('models/', '');
      _cachedModel = name;
      _cachedAt = Date.now();
      return name;
    }

    return PREFERRED_MODEL;
  } catch (err: any) {
    console.error('[enrich.gemini.model] Fallback ListModels failed:', err?.message?.substring(0, 200));
    return PREFERRED_MODEL;
  }
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildEnrichPrompt(input: GeminiEnrichInput, websiteUrl: string | null): string {
  const { company, industry, role, firstName, lastName, primaryGoal, language } = input;

  const websiteLine = websiteUrl
    ? `Website: ${websiteUrl}`
    : `Website: Nicht angegeben (suche nach "${company}" online)`;

  return `Du bist ein Elite-Business-Intelligence-Agent für ARAS AI.

AUFGABE: Erstelle ein VOLLSTÄNDIGES Unternehmens- und Outbound-Profil.
Nutze Google Search um aktuelle Informationen über das Unternehmen zu recherchieren.

📋 UNTERNEHMENSDATEN:
Unternehmen: ${company}
${websiteLine}
Branche: ${industry}
Kontaktperson: ${firstName} ${lastName} (${role})
Primäres Ziel: ${primaryGoal}
Sprache: ${language === 'de' ? 'Deutsch' : language === 'en' ? 'English' : language}

📊 ANALYSIERE FOLGENDES:

1. UNTERNEHMENS-DNA:
- Beschreibung (mindestens 300 Zeichen), Gründungsjahr, CEO/Geschäftsführer
- Mitarbeiterzahl, Standorte, Unternehmenskultur

2. PRODUKTE & SERVICES (je mindestens 5):
- Alle Produkte und Services mit kurzer Beschreibung

3. ZIELGRUPPEN:
- Primäre Zielgruppe (Branche, Größe, Entscheider)
- Zielgruppensegmente (mindestens 3)
- Pain Points und Kaufmotive

4. WETTBEWERB (mindestens 3 Konkurrenten):
- Direkte Wettbewerber, Marktposition, Differenzierung

5. OUTBOUND PLAYBOOK:
- 5+ Call-Angles (Gesprächseinstiege für Kaltakquise)
- 5+ Einwandbehandlungen (objection + response)
- Beste Kontaktzeiten
- Empfohlene Brand Voice / Tonalität

6. KEYWORDS (mindestens 10):
- Branchenspezifisch, produktbezogen, problemorientiert

7. CHANCEN & NEWS:
- Aktuelle Marktchancen
- Neueste Unternehmensnachrichten

WICHTIG:
- confidence: Zahl zwischen 0 und 1 (1 = höchstes Vertrauen in die Datenqualität)
- Bei unbekannten Feldern: leerer String "" oder leeres Array []
- Alle Texte auf ${language === 'de' ? 'Deutsch' : language === 'en' ? 'Englisch' : language}`;
}
