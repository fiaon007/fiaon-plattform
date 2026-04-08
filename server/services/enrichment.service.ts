/**
 * 🔥 ENRICHMENT SERVICE
 * Async company intelligence enrichment with retry + quality gate
 * 🔥 POWERED BY GOOGLE GEMINI — zero OpenAI dependency
 */

import { geminiEnrichProfile, type GeminiEnrichInput } from "../lib/gemini-enrich";
import { storage } from "../storage";
import { type EnrichmentStatus, type EnrichmentErrorCode } from "@shared/schema";

// 🔥 ROBUST JSON EXTRACTOR - handles markdown fences, extra text, repair
function extractJsonFromText(rawText: string): { json: any | null; repaired: boolean; error: string | null } {
  if (!rawText || typeof rawText !== 'string') {
    return { json: null, repaired: false, error: 'empty_input' };
  }
  
  let text = rawText.trim();
  
  // Step 1: Remove markdown code fences
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  
  // Step 2: Remove common prefixes like "Here is the JSON:" or "Response:"
  text = text.replace(/^[\s\S]*?(?=\{)/m, '');
  
  // Step 3: Find first { and last } - proper brace matching
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    console.log('[extractJson] No valid braces found', { firstBrace, lastBrace, textLength: text.length });
    return { json: null, repaired: false, error: 'no_braces' };
  }
  
  let jsonString = text.substring(firstBrace, lastBrace + 1);
  
  // Step 4: Try direct parse
  try {
    const parsed = JSON.parse(jsonString);
    console.log('[extractJson] Direct parse success');
    return { json: parsed, repaired: false, error: null };
  } catch (directError: any) {
    console.log('[extractJson] Direct parse failed:', directError.message?.substring(0, 100));
  }
  
  // Step 5: Attempt repairs
  let repaired = false;
  
  // Fix trailing commas before } or ]
  jsonString = jsonString.replace(/,\s*([}\]])/g, '$1');
  
  // Fix single quotes to double quotes (careful with apostrophes)
  jsonString = jsonString.replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":');
  jsonString = jsonString.replace(/:\s*'([^']*)'/g, ': "$1"');
  
  // Fix unquoted keys
  jsonString = jsonString.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
  
  // Try parse again
  try {
    const parsed = JSON.parse(jsonString);
    console.log('[extractJson] Repaired parse success');
    return { json: parsed, repaired: true, error: null };
  } catch (repairError: any) {
    console.log('[extractJson] Repaired parse failed:', repairError.message?.substring(0, 100));
    console.log('[extractJson] First 300 chars:', jsonString.substring(0, 300));
    console.log('[extractJson] Last 300 chars:', jsonString.substring(Math.max(0, jsonString.length - 300)));
    return { json: null, repaired: false, error: 'parse_failed' };
  }
}

// 🔥 SCHEMA REPAIR - ensure all required fields exist with defaults
function repairEnrichmentSchema(data: any): { data: any; fieldsRepaired: string[] } {
  const fieldsRepaired: string[] = [];
  
  // Ensure data is an object
  if (!data || typeof data !== 'object') {
    return { data: {}, fieldsRepaired: ['root'] };
  }
  
  // Required string fields with defaults
  const stringFields: Record<string, string> = {
    companyDescription: 'Unternehmensbeschreibung wird noch analysiert...',
    targetAudience: 'Zielgruppe wird analysiert...',
    brandVoice: 'Neutral und professionell',
    bestCallTimes: 'Vormittags 9-12 Uhr, Nachmittags 14-17 Uhr',
    marketPosition: 'Marktposition wird analysiert...',
    confidence: 'medium'
  };
  
  for (const [field, defaultValue] of Object.entries(stringFields)) {
    if (!data[field] || typeof data[field] !== 'string') {
      data[field] = defaultValue;
      fieldsRepaired.push(field);
    }
  }
  
  // Required array fields with defaults
  const arrayFields: Record<string, string[]> = {
    products: ['Produkte werden analysiert...'],
    services: ['Services werden analysiert...'],
    targetAudienceSegments: ['Zielgruppensegmente werden analysiert...'],
    decisionMakers: ['Entscheider werden identifiziert...'],
    competitors: ['Wettbewerber werden recherchiert...'],
    uniqueSellingPoints: ['USPs werden analysiert...'],
    callAngles: ['Gesprächseinstiege werden generiert...'],
    effectiveKeywords: ['Keywords werden analysiert...'],
    opportunities: ['Chancen werden identifiziert...'],
    recentNews: []
  };
  
  for (const [field, defaultValue] of Object.entries(arrayFields)) {
    if (!Array.isArray(data[field])) {
      // Try to convert string to array
      if (typeof data[field] === 'string' && data[field].length > 0) {
        data[field] = [data[field]];
        fieldsRepaired.push(`${field}_converted`);
      } else {
        data[field] = defaultValue;
        fieldsRepaired.push(field);
      }
    }
  }
  
  // objectionHandling must be array of objects
  if (!Array.isArray(data.objectionHandling)) {
    data.objectionHandling = [
      { objection: 'Kein Interesse', response: 'Verstehe ich. Darf ich kurz fragen, was der Hauptgrund ist?' },
      { objection: 'Keine Zeit', response: 'Natürlich, wann passt es besser? Ich rufe gerne zurück.' },
      { objection: 'Schicken Sie Infos', response: 'Sehr gerne! Welcher Aspekt interessiert Sie am meisten?' }
    ];
    fieldsRepaired.push('objectionHandling');
  } else {
    // Ensure each item has objection and response
    data.objectionHandling = data.objectionHandling.map((item: any, i: number) => {
      if (typeof item === 'string') {
        return { objection: item, response: 'Antwort wird generiert...' };
      }
      return {
        objection: item?.objection || `Einwand ${i + 1}`,
        response: item?.response || 'Antwort wird generiert...'
      };
    });
  }
  
  return { data, fieldsRepaired };
}

// 🔥 ENRICHMENT META: Stored in ai_profile JSONB
export interface EnrichmentMeta {
  status: EnrichmentStatus | 'queued' | 'in_progress';
  errorCode: EnrichmentErrorCode;
  lastUpdated: string | null;
  attempts: number;
  nextRetryAt: string | null;
  confidence: 'low' | 'medium' | 'high' | null;
}

// 🔥 ENRICHMENT INPUT
export interface EnrichmentInput {
  userId: string;
  company: string;
  industry: string;
  role: string;
  website: string | null;
  phone: string;
  language: string;
  primaryGoal: string;
  firstName: string;
  lastName: string;
  email?: string;
}

// 🔥 ENRICHMENT RESULT
export interface EnrichmentResult {
  aiProfile: any;
  enrichmentWasSuccessful: boolean;
  enrichmentStatus: EnrichmentStatus;
  enrichmentErrorCode: EnrichmentErrorCode;
  confidence: 'low' | 'medium' | 'high';
}

// 🔥 PROVIDER: Google Gemini (zero OpenAI dependency)
const ENRICH_PROVIDER = 'gemini' as const;

// 🔥 RETRY CONFIG
const MAX_ATTEMPTS = 3;
const RETRY_BACKOFF_MS = [2 * 60 * 1000, 10 * 60 * 1000, 60 * 60 * 1000]; // 2min, 10min, 60min
const NO_RETRY_ERROR_CODES: EnrichmentErrorCode[] = ['quota', 'auth', 'model_not_allowed'];

// 🔥 QUALITY GATE: Check if enrichment result is actually valuable (WOW-level)
function isEnrichmentValid(profile: any): { valid: boolean; score: number; details: Record<string, number> } {
  if (!profile) return { valid: false, score: 0, details: {} };
  
  const details: Record<string, number> = {};
  let score = 0;
  
  // Company description (max 2 points)
  if (profile.companyDescription && profile.companyDescription.length >= 300) {
    score += 2; details.companyDescription = 2;
  } else if (profile.companyDescription && profile.companyDescription.length >= 120) {
    score += 1; details.companyDescription = 1;
  }
  
  // Products (max 1 point)
  if (Array.isArray(profile.products) && profile.products.length >= 5) {
    score += 1; details.products = 1;
  }
  
  // Services (max 1 point)
  if (Array.isArray(profile.services) && profile.services.length >= 3) {
    score += 1; details.services = 1;
  }
  
  // USPs (max 1 point)
  if (Array.isArray(profile.uniqueSellingPoints) && profile.uniqueSellingPoints.length >= 5) {
    score += 1; details.uniqueSellingPoints = 1;
  }
  
  // Competitors (max 1 point)
  if (Array.isArray(profile.competitors) && profile.competitors.length >= 3) {
    score += 1; details.competitors = 1;
  }
  
  // Target audience (max 1 point)
  if (profile.targetAudience && profile.targetAudience.length >= 100) {
    score += 1; details.targetAudience = 1;
  }
  
  // Call angles (max 1 point) - NEW for WOW
  if (Array.isArray(profile.callAngles) && profile.callAngles.length >= 5) {
    score += 1; details.callAngles = 1;
  }
  
  // Objections (max 1 point) - NEW for WOW
  if (Array.isArray(profile.objectionHandling) && profile.objectionHandling.length >= 5) {
    score += 1; details.objectionHandling = 1;
  }
  
  // Max score: 10, pass threshold: 3 (company desc + audience + 1 more)
  return { valid: score >= 3, score, details };
}

// 🔥 CONFIDENCE FROM SCORE (scaled for WOW-level 10-point system)
function getConfidence(score: number): 'low' | 'medium' | 'high' {
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// 🔥 BUILD FALLBACK PROFILE
function buildFallbackProfile(input: EnrichmentInput, errorCode: EnrichmentErrorCode): any {
  const { company, industry, role, firstName, lastName, primaryGoal, language } = input;
  
  const companyIntel = {
    companyDescription: `${company} ist ein innovatives Unternehmen in der ${industry} Branche. Als ${role} bei ${company} fokussiert sich das Team auf ${primaryGoal?.replace('_', ' ') || 'strategisches Wachstum'}. Das Unternehmen zeichnet sich durch moderne Ansätze und kundenorientierte Lösungen aus.`,
    products: [`${industry} Lösungen`, "Premium Services", "Beratungsleistungen"],
    services: ["Strategieberatung", "Implementierung", "Support & Wartung"],
    targetAudience: `Entscheider in der ${industry} Branche, B2B Kunden mit Fokus auf Innovation und Effizienz`,
    brandVoice: "Professionell, innovativ und kundenorientiert mit persönlicher Note",
    bestCallTimes: "Dienstag-Donnerstag, 14-16 Uhr (optimale Erreichbarkeit)",
    effectiveKeywords: [company, industry, primaryGoal?.replace('_', ' ') || '', "Innovation", "Effizienz", "Lösungen", "Strategie", "Wachstum"].filter(Boolean),
    competitors: ["Branchenführer", "Etablierte Anbieter", "Innovative Startups"],
    uniqueSellingPoints: ["Kundenorientierung", "Expertise in " + industry, "Innovative Ansätze"],
    goals: ["Marktanteil ausbauen", "Kundenzufriedenheit steigern", "Innovation vorantreiben"],
    communicationPreferences: "Professionell, direkt, lösungsorientiert",
    opportunities: ["Digitale Transformation", "Marktexpansion", "Strategische Partnerschaften"]
  };
  
  const customSystemPrompt = `Du bist ARAS AI® – die persönliche KI-Assistenz von ${firstName} ${lastName}.

🧠 ÜBER DEN USER:
Name: ${firstName} ${lastName}
Firma: ${company}
Branche: ${industry}
Position: ${role}

🏢 ÜBER DIE FIRMA:
${companyIntel.companyDescription}

Zielgruppe: ${companyIntel.targetAudience}
Brand Voice: ${companyIntel.brandVoice}

🎯 PRIMÄRES ZIEL: ${primaryGoal}

💬 SPRACHE: ${language === 'de' ? 'Deutsch (du-Form)' : language === 'en' ? 'English' : 'Français'}

Du bist die persönliche KI von ${firstName} bei ${company}. Beziehe dich immer auf den Business Context.

Bleibe immer ARAS AI - entwickelt von der Schwarzott Group.`;

  return {
    companyDescription: companyIntel.companyDescription,
    products: companyIntel.products,
    services: companyIntel.services,
    targetAudience: companyIntel.targetAudience,
    brandVoice: companyIntel.brandVoice,
    customSystemPrompt,
    effectiveKeywords: companyIntel.effectiveKeywords,
    bestCallTimes: companyIntel.bestCallTimes,
    goals: companyIntel.goals,
    competitors: companyIntel.competitors,
    uniqueSellingPoints: companyIntel.uniqueSellingPoints,
    opportunities: companyIntel.opportunities,
    communicationPreferences: companyIntel.communicationPreferences,
    lastUpdated: new Date().toISOString(),
    enrichmentStatus: 'fallback' as EnrichmentStatus,
    enrichmentErrorCode: errorCode,
    enrichmentMeta: {
      status: 'fallback',
      errorCode,
      lastUpdated: new Date().toISOString(),
      attempts: 1,
      nextRetryAt: null,
      confidence: 'low'
    }
  };
}

/**
 * 🔥 RUN ENRICHMENT JOB
 * Pure function that performs the enrichment and returns the result
 * 🔥 POWERED BY GOOGLE GEMINI — zero OpenAI dependency
 */
export async function runEnrichment(input: EnrichmentInput, attemptNumber: number = 1): Promise<EnrichmentResult> {
  const startTime = Date.now();
  const { company, industry, role, website, firstName, lastName, primaryGoal, language } = input;
  
  // Log begin (NO PII)
  console.log('[enrich.job.begin]', JSON.stringify({
    timestamp: new Date().toISOString(),
    userId: input.userId,
    attempt: attemptNumber,
    provider: ENRICH_PROVIDER,
    hasCompany: !!company,
    hasIndustry: !!industry,
    hasWebsite: !!website
  }));
  
  // 🔥 API KEY CHECK — Gemini
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('[enrich.job.fail] No GOOGLE_GEMINI_API_KEY in environment');
    return {
      aiProfile: buildFallbackProfile(input, 'auth'),
      enrichmentWasSuccessful: false,
      enrichmentStatus: 'fallback',
      enrichmentErrorCode: 'auth',
      confidence: 'low'
    };
  }
  
  try {
    // 🔥 CALL GEMINI ENRICHMENT
    const geminiInput: GeminiEnrichInput = {
      company, industry, role, website,
      firstName, lastName, primaryGoal, language,
      email: input.email
    };
    
    const geminiResult = await geminiEnrichProfile(geminiInput);
    
    // Handle Gemini failure
    if (!geminiResult.success || !geminiResult.data) {
      // Map Gemini error to EnrichmentErrorCode
      let errorCode: EnrichmentErrorCode = 'unknown';
      if (geminiResult.error === 'missing_gemini_key') errorCode = 'auth';
      else if (geminiResult.error === 'timeout') errorCode = 'timeout';
      else if (geminiResult.error === 'quota') errorCode = 'quota';
      else if (geminiResult.error === 'auth') errorCode = 'auth';
      else if (geminiResult.error === 'parse_failed') errorCode = 'parse';
      else if (geminiResult.error === 'empty_response') errorCode = 'unknown';
      
      console.log('[enrich.job.fail]', JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: input.userId,
        provider: ENRICH_PROVIDER,
        model: geminiResult.model,
        errorCode,
        geminiError: geminiResult.error,
        attempt: attemptNumber,
        durationMs: geminiResult.durationMs
      }));
      
      return {
        aiProfile: buildFallbackProfile(input, errorCode),
        enrichmentWasSuccessful: false,
        enrichmentStatus: 'fallback',
        enrichmentErrorCode: errorCode,
        confidence: 'low'
      };
    }
    
    // 🔥 SCHEMA REPAIR — ensure all required fields exist
    const repairResult = repairEnrichmentSchema(geminiResult.data);
    const companyIntel = repairResult.data;
    
    if (repairResult.fieldsRepaired.length > 0) {
      console.log('[enrich.parse.repaired]', JSON.stringify({
        userId: input.userId,
        fieldsRepaired: repairResult.fieldsRepaired
      }));
    }
    
    // 🔥 QUALITY GATE
    const { valid, score, details } = isEnrichmentValid(companyIntel);
    const confidence = getConfidence(score);
    
    if (!valid) {
      console.log('[enrich.job.fail]', JSON.stringify({
        timestamp: new Date().toISOString(),
        userId: input.userId,
        provider: ENRICH_PROVIDER,
        errorCode: 'quality_gate_failed',
        qualityScore: score,
        qualityDetails: details,
        attempt: attemptNumber,
        durationMs: Date.now() - startTime
      }));
      
      return {
        aiProfile: buildFallbackProfile(input, 'quality_gate_failed'),
        enrichmentWasSuccessful: false,
        enrichmentStatus: 'fallback',
        enrichmentErrorCode: 'quality_gate_failed',
        confidence: 'low'
      };
    }
    
    // 🔥 BUILD SUCCESSFUL PROFILE
    const customSystemPrompt = `Du bist ARAS AI® – die persönliche KI-Assistenz von ${firstName} ${lastName}.

🧠 ÜBER DEN USER:
Name: ${firstName} ${lastName}
Firma: ${company}
Branche: ${industry}
Position: ${role}

🏢 ÜBER DIE FIRMA:
${companyIntel.companyDescription}

Zielgruppe: ${companyIntel.targetAudience}
Brand Voice: ${companyIntel.brandVoice}

🎯 PRIMÄRES ZIEL: ${primaryGoal}

💬 SPRACHE: ${language === 'de' ? 'Deutsch (du-Form)' : language === 'en' ? 'English' : 'Français'}

Du bist die persönliche KI von ${firstName} bei ${company}. Beziehe dich immer auf den Business Context.

Bleibe immer ARAS AI - entwickelt von der Schwarzott Group.`;

    const aiProfile = {
      // 🔥 CORE COMPANY DATA
      companyDescription: companyIntel.companyDescription,
      products: companyIntel.products || [],
      services: companyIntel.services || [],
      targetAudience: companyIntel.targetAudience,
      targetAudienceSegments: companyIntel.targetAudienceSegments || [],
      decisionMakers: companyIntel.decisionMakers || [],
      brandVoice: companyIntel.brandVoice,
      customSystemPrompt,
      effectiveKeywords: companyIntel.effectiveKeywords || [],
      bestCallTimes: companyIntel.bestCallTimes,
      goals: companyIntel.goals || [primaryGoal],
      competitors: companyIntel.competitors || [],
      uniqueSellingPoints: companyIntel.uniqueSellingPoints || [],
      foundedYear: companyIntel.foundedYear || null,
      ceoName: companyIntel.ceoName || null,
      employeeCount: companyIntel.employeeCount || null,
      headquarters: companyIntel.headquarters || null,
      opportunities: companyIntel.opportunities || [],
      marketPosition: companyIntel.marketPosition || null,
      recentNews: companyIntel.recentNews || [],
      
      // 🔥 WOW-LEVEL OUTBOUND PLAYBOOK
      callAngles: companyIntel.callAngles || [],
      objectionHandling: companyIntel.objectionHandling || [],
      
      // 🔥 META
      lastUpdated: new Date().toISOString(),
      enrichmentStatus: 'live_research' as EnrichmentStatus,
      enrichmentErrorCode: null,
      qualityScore: score,
      enrichmentMeta: {
        status: 'live_research',
        errorCode: null,
        lastUpdated: new Date().toISOString(),
        attempts: attemptNumber,
        nextRetryAt: null,
        confidence,
        qualityScore: score,
        qualityDetails: details
      }
    };
    
    console.log('[enrich.job.ok]', JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      provider: ENRICH_PROVIDER,
      model: geminiResult.model,
      attempt: attemptNumber,
      qualityScore: score,
      confidence,
      tokensUsed: geminiResult.tokensUsed,
      sourcesCount: geminiResult.sources.length,
      durationMs: Date.now() - startTime
    }));
    
    return {
      aiProfile,
      enrichmentWasSuccessful: true,
      enrichmentStatus: 'live_research',
      enrichmentErrorCode: null,
      confidence
    };
    
  } catch (error: any) {
    const errorCode: EnrichmentErrorCode = error?.message?.includes('timeout') ? 'timeout' :
                                           error?.message?.includes('quota') ? 'quota' :
                                           error?.message?.includes('API') ? 'auth' : 'unknown';
    
    console.log('[enrich.job.fail]', JSON.stringify({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      provider: ENRICH_PROVIDER,
      errorCode,
      errorMessage: (error?.message || '').substring(0, 100),
      attempt: attemptNumber,
      durationMs: Date.now() - startTime
    }));
    
    return {
      aiProfile: buildFallbackProfile(input, errorCode),
      enrichmentWasSuccessful: false,
      enrichmentStatus: 'fallback',
      enrichmentErrorCode: errorCode,
      confidence: 'low'
    };
  }
}

/**
 * 🔥 RUN ENRICHMENT JOB ASYNC (with DB update)
 * Called after user creation, updates the user's ai_profile
 * CRITICAL: This function MUST always end in a terminal state (complete/failed/timeout)
 */
export async function runEnrichmentJobAsync(input: EnrichmentInput): Promise<void> {
  const startTime = Date.now();
  let attemptNumber = 1;
  
  try {
    console.log('[enrich.async.start]', JSON.stringify({ userId: input.userId, timestamp: new Date().toISOString() }));
    
    const user = await storage.getUser(input.userId);
    if (!user) {
      console.error('[enrich.async.fail] User not found:', input.userId);
      return;
    }
    
    // Get current attempt count
    const currentMeta = (user.aiProfile as any)?.enrichmentMeta;
    attemptNumber = (currentMeta?.attempts || 0) + 1;
    
    // Check if we should skip (too many attempts or no-retry error)
    if (attemptNumber > MAX_ATTEMPTS) {
      console.log('[enrich.async.skip] Max attempts reached for user:', input.userId);
      return;
    }
    
    if (currentMeta?.errorCode && NO_RETRY_ERROR_CODES.includes(currentMeta.errorCode)) {
      console.log('[enrich.async.skip] No-retry error code:', currentMeta.errorCode);
      return;
    }
    
    // Update status to in_progress
    console.log('[enrich.step] status.in_progress', JSON.stringify({ userId: input.userId, attempt: attemptNumber }));
    await storage.updateUserProfile(input.userId, {
      aiProfile: {
        ...(user.aiProfile || {}),
        enrichmentMeta: {
          ...currentMeta,
          status: 'in_progress',
          errorCode: null,
          attempts: attemptNumber,
          lastUpdated: new Date().toISOString()
        }
      },
      profileEnriched: false
    });
    console.log('[enrich.persist] in_progress_saved', JSON.stringify({ userId: input.userId, attempt: attemptNumber }));
    
    // Run enrichment (Gemini)
    const geminiStart = Date.now();
    console.log('[enrich.step] gemini.calling', JSON.stringify({ userId: input.userId, provider: ENRICH_PROVIDER }));
    const result = await runEnrichment(input, attemptNumber);
    const geminiDurationMs = Date.now() - geminiStart;
    console.log('[enrich.step] gemini.returned', JSON.stringify({ 
      userId: input.userId, 
      provider: ENRICH_PROVIDER,
      geminiDurationMs,
      success: result.enrichmentWasSuccessful,
      status: result.enrichmentStatus,
      errorCode: result.enrichmentErrorCode,
      confidence: result.confidence 
    }));
    
    // Calculate next retry if failed — non-retryable errors MUST NOT schedule
    let nextRetryAt: string | null = null;
    const isRetryableError = !result.enrichmentWasSuccessful &&
      attemptNumber < MAX_ATTEMPTS &&
      !NO_RETRY_ERROR_CODES.includes(result.enrichmentErrorCode);
    
    if (isRetryableError) {
      const backoffMs = RETRY_BACKOFF_MS[attemptNumber - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
    } else if (!result.enrichmentWasSuccessful && NO_RETRY_ERROR_CODES.includes(result.enrichmentErrorCode)) {
      console.log('[enrich.async.retry.skip]', JSON.stringify({
        userId: input.userId,
        errorCode: result.enrichmentErrorCode,
        status: result.enrichmentStatus,
        reason: 'non-retryable'
      }));
    }
    
    // Update user with result - use terminal status
    const terminalStatus = result.enrichmentWasSuccessful ? 'complete' : 
                          result.enrichmentErrorCode === 'timeout' ? 'timeout' : 'failed';
    
    const updatedMeta: EnrichmentMeta = {
      status: terminalStatus as any,
      errorCode: result.enrichmentErrorCode,
      lastUpdated: new Date().toISOString(),
      attempts: attemptNumber,
      nextRetryAt,
      confidence: result.confidence
    };
    
    console.log('[enrich.step] db.updating', JSON.stringify({ userId: input.userId, status: terminalStatus, errorCode: result.enrichmentErrorCode }));
    await storage.updateUserProfile(input.userId, {
      aiProfile: {
        ...result.aiProfile,
        enrichmentMeta: updatedMeta,
        enrichmentStatus: result.enrichmentStatus
      },
      profileEnriched: result.enrichmentWasSuccessful,
      lastEnrichmentDate: result.enrichmentWasSuccessful ? new Date() : user.lastEnrichmentDate
    });
    console.log('[enrich.persist] result_saved', JSON.stringify({
      userId: input.userId,
      status: terminalStatus,
      profileEnriched: result.enrichmentWasSuccessful,
      enrichmentStatus: result.enrichmentStatus
    }));
    
    console.log('[enrich.async.end]', JSON.stringify({
      userId: input.userId,
      status: terminalStatus,
      success: result.enrichmentWasSuccessful,
      errorCode: result.enrichmentErrorCode,
      attempt: attemptNumber,
      durationMs: Date.now() - startTime
    }));
    
    // Schedule retry ONLY if retryable
    if (nextRetryAt && isRetryableError) {
      const backoffMs = RETRY_BACKOFF_MS[attemptNumber - 1] || RETRY_BACKOFF_MS[RETRY_BACKOFF_MS.length - 1];
      console.log('[enrich.async.retry]', JSON.stringify({
        userId: input.userId,
        delaySeconds: backoffMs / 1000,
        attempt: attemptNumber,
        errorCode: result.enrichmentErrorCode
      }));
      
      setTimeout(() => {
        runEnrichmentJobAsync(input).catch(err => {
          console.error('[enrich.async.retry.error]', err);
        });
      }, backoffMs);
    }
    
  } catch (error: any) {
    // CRITICAL: Catch ALL errors and update DB with failed status
    console.error('[enrich.async.crash]', JSON.stringify({
      userId: input.userId,
      error: (error?.message || 'Unknown error').substring(0, 200),
      stack: (error?.stack || '').substring(0, 300),
      attempt: attemptNumber,
      durationMs: Date.now() - startTime
    }));
    
    // Try to update DB with failed status
    try {
      const fallbackProfile = buildFallbackProfile(input, 'unknown');
      await storage.updateUserProfile(input.userId, {
        aiProfile: {
          ...fallbackProfile,
          enrichmentMeta: {
            status: 'failed',
            errorCode: 'unknown',
            lastUpdated: new Date().toISOString(),
            attempts: attemptNumber,
            nextRetryAt: null,
            confidence: 'low'
          }
        },
        profileEnriched: false
      });
      console.log('[enrich.async.crash.recovered] DB updated with failed status');
    } catch (dbError: any) {
      console.error('[enrich.async.crash.db_fail]', dbError?.message);
    }
  }
}

/**
 * 🔥 TRIGGER ENRICHMENT (non-blocking)
 * Called from registration, starts enrichment job asynchronously
 */
export function triggerEnrichmentAsync(input: EnrichmentInput): void {
  setImmediate(() => {
    runEnrichmentJobAsync(input).catch(err => {
      console.error('[enrich.trigger.error]', err);
    });
  });
}

/**
 * 🔥 FORCE RE-ENRICH (Admin)
 * Resets attempts and triggers new enrichment
 */
export async function forceReEnrich(userId: string): Promise<{ success: boolean; message: string }> {
  const user = await storage.getUser(userId);
  if (!user) {
    return { success: false, message: 'User not found' };
  }
  
  // Check if already enriched and not forcing
  if (user.profileEnriched) {
    // Reset for re-enrich
    await storage.updateUserProfile(userId, {
      aiProfile: {
        ...(user.aiProfile || {}),
        enrichmentMeta: {
          status: 'queued',
          errorCode: null,
          lastUpdated: new Date().toISOString(),
          attempts: 0,
          nextRetryAt: null,
          confidence: null
        }
      },
      profileEnriched: false
    });
  }
  
  // Build input from user data
  const input: EnrichmentInput = {
    userId: user.id,
    company: user.company || '',
    industry: user.industry || '',
    role: user.jobRole || '',
    website: user.website,
    phone: user.phone || '',
    language: user.language || 'de',
    primaryGoal: user.primaryGoal || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    email: user.email || undefined
  };
  
  // Trigger async
  triggerEnrichmentAsync(input);
  
  return { success: true, message: 'Enrichment job started' };
}
