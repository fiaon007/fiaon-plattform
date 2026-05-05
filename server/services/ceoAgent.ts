/**
 * ============================================================================
 * CEO MIND-OS — AI Agent Service
 * ============================================================================
 * Strategie-Berater für Justin. Nutzt:
 *   - Groq (Llama 3.3 70B Versatile) als Reasoning-Engine
 *   - Tavily Search API für Live-Marktdaten (Preise, Quellen, Stellenportale)
 *
 * Öffentliche API:
 *   - analyzeThought(thought, history?)  -> strukturierte Strategie-Analyse
 *   - analyzeFailure(thought, analysis, reason) -> Gegenrechnung / Opportunitätskosten
 *   - generateTemplate(thought, analysis, kind?) -> Stellenausschreibung / Skript / Vertrag
 *   - isCeoAgentConfigured()             -> boolean (Groq-Key vorhanden?)
 * ============================================================================
 */

import Groq from 'groq-sdk';
import { logger } from '../logger';
import { client } from '../db';
import { searchEmbedding } from './embeddingService';
import { fullHybridSearch } from './hybridSearch';

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';

// Model selection: Use smaller model for briefings, large model for analysis
const GROQ_MODEL_LARGE = 'llama-3.3-70b-versatile';  // For analyzeThought
const GROQ_MODEL_FAST = 'llama-3.1-8b-instant';      // For briefings & summaries

const groq: Groq | null = GROQ_API_KEY ? new Groq({ apiKey: GROQ_API_KEY }) : null;

export function isCeoAgentConfigured(): boolean {
  return !!GROQ_API_KEY;
}

export function isTavilyConfigured(): boolean {
  return !!TAVILY_API_KEY;
}

// ============================================================================
// TYPES
// ============================================================================

export type MindCategory =
  | 'personal'       // Recruiting, Team, HR
  | 'marketing'      // Ads, Content, Growth
  | 'sales'          // Pipeline, Closing, Calls
  | 'finance'        // Pricing, Kosten, Investitionen
  | 'operations'    // Prozesse, Tools, Systeme
  | 'strategy'      // Vision, Positionierung
  | 'product'       // Feature, Roadmap
  | 'legal'         // Verträge, Compliance
  | 'general';

export type TemplateKind =
  | 'job_posting'
  | 'marketing_script'
  | 'cold_email'
  | 'contract'
  | 'sales_script'
  | null;

export interface MagicTemplate {
  kind: Exclude<TemplateKind, null>;
  title: string;
  content: string;
  /** Optionaler Hinweis, wie das Template zu nutzen ist */
  cta?: string;
}

export interface ResourceLink {
  label: string;
  url: string;
  type?: 'portal' | 'article' | 'tool' | 'reference';
}

export interface CeoAnalysis {
  /** Kurzes Verständnis der Idee (1 Satz) */
  summary: string;
  /** Die kritische Rückfrage des Beraters */
  followUpQuestion: string;
  /** ROI / Realitäts-Check mit echten Zahlen, wo möglich */
  roiCheck: string;
  /** Wichtigste Next-Steps */
  nextSteps: string[];
  /** Erkannte Kategorie */
  category: MindCategory;
  /** Magic-Template, falls sinnvoll (z.B. Stellenausschreibung). Sonst null. */
  magicTemplate: MagicTemplate | null;
  /** Kuratierte externe Links (aus Tavily oder statischen Portalen) */
  resources: ResourceLink[];
  /** Confidence 0..1 — wie sicher das Modell sich ist */
  confidence: number;
  /** Meta-Info für Debug/Logs */
  meta: {
    model: string;
    usedWebSearch: boolean;
    searchQuery?: string;
    durationMs: number;
  };
}

export interface FailureAnalysis {
  /** Freundliche Reaktion (1-2 Sätze) */
  empathy: string;
  /** Opportunitätskosten-Rechnung */
  opportunityCost: string;
  /** Konkrete Alternativen / Workarounds */
  alternatives: string[];
  /** Neue Empfehlung des Beraters */
  recommendation: string;
  meta: {
    model: string;
    durationMs: number;
  };
}

// ============================================================================
// TAVILY — Web Research
// ============================================================================

interface TavilyResult {
  title: string;
  url: string;
  content: string;
}

async function tavilySearch(query: string, maxResults = 5): Promise<TavilyResult[]> {
  if (!TAVILY_API_KEY) return [];
  try {
    const resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        max_results: maxResults,
        include_answer: false,
        topic: 'general',
      }),
    });
    if (!resp.ok) {
      logger.warn(`[CEO-AGENT][TAVILY] Search failed: ${resp.status}`);
      return [];
    }
    const data = (await resp.json()) as { results?: TavilyResult[] };
    return (data.results || []).map((r) => ({
      title: r.title || '',
      url: r.url || '',
      content: (r.content || '').slice(0, 400),
    }));
  } catch (err: any) {
    logger.warn(`[CEO-AGENT][TAVILY] Error: ${err?.message || err}`);
    return [];
  }
}

// ============================================================================
// JARVIS BRAIN-LINK — Semantic Knowledge Search
// ============================================================================

async function searchKnowledgeBase(query: string, limit = 3): Promise<string[]> {
  try {
    if (!query || query.trim().length === 0) return [];

    // DB VERIFICATION: Check total entries AND embeddings
    const countResult = await client`SELECT COUNT(*) as total FROM knowledge_base`;
    const totalEntries = parseInt(countResult[0]?.total || '0');
    logger.info(`[CEO-AGENT][DB-CHECK] Total entries in knowledge_base: ${totalEntries}`);
    
    // Check how many have embeddings
    const embeddingCount = await client`SELECT COUNT(*) as total FROM knowledge_base WHERE embedding IS NOT NULL`;
    const totalWithEmbeddings = parseInt(embeddingCount[0]?.total || '0');
    logger.info(`[CEO-AGENT][DB-CHECK] Entries with embeddings: ${totalWithEmbeddings}/${totalEntries}`);

    if (totalEntries === 0) {
      logger.warn(`[CEO-AGENT][KNOWLEDGE] Database is EMPTY! No knowledge to search.`);
      return [];
    }
    
    if (totalWithEmbeddings === 0) {
      logger.error(`[CEO-AGENT][KNOWLEDGE] CRITICAL: ${totalEntries} entries exist but ZERO have embeddings!`);
      return [];
    }

    // HYBRID SEARCH: Vector + Keyword (no re-ranking for speed)
    const hybridResults = await fullHybridSearch(query, limit, false);

    logger.info(`[CEO-AGENT][HYBRID-SEARCH] Query: "${query.slice(0, 50)}...", Results: ${hybridResults.length}/${totalEntries}`);
    
    if (hybridResults.length > 0) {
      // Log each result with detailed info
      hybridResults.forEach((r, i) => {
        logger.info(
          `[CEO-AGENT][HYBRID-DEBUG] Result ${i + 1}: ` +
          `Hybrid: ${r.hybridScore.toFixed(3)} ` +
          `(Vector: ${r.vectorScore.toFixed(3)} + Keyword: ${r.keywordScore.toFixed(3)}) | ` +
          `Keywords: [${r.keywordMatches.join(', ')}] | ` +
          `"${r.content.slice(0, 60)}..."`
        );
      });
    } else {
      logger.error(`[CEO-AGENT][KNOWLEDGE] ZERO results despite ${totalEntries} entries and ${totalWithEmbeddings} embeddings!`);
    }

    return hybridResults.map((r) => r.content);
  } catch (err: any) {
    logger.error(`[CEO-AGENT][KNOWLEDGE] Search error: ${err?.message || err}`);
    return [];
  }
}

// ============================================================================
// CATEGORY HINTS — welche Templates zu welcher Kategorie passen
// ============================================================================

const CATEGORY_STATIC_RESOURCES: Record<MindCategory, ResourceLink[]> = {
  personal: [
    { label: 'StepStone', url: 'https://www.stepstone.de/', type: 'portal' },
    { label: 'LinkedIn Jobs', url: 'https://www.linkedin.com/jobs/', type: 'portal' },
    { label: 'Indeed', url: 'https://de.indeed.com/', type: 'portal' },
  ],
  marketing: [
    { label: 'Meta Ads Manager', url: 'https://business.facebook.com/', type: 'tool' },
    { label: 'Google Ads', url: 'https://ads.google.com/', type: 'tool' },
  ],
  sales: [
    { label: 'Apollo.io', url: 'https://www.apollo.io/', type: 'tool' },
    { label: 'LinkedIn Sales Navigator', url: 'https://business.linkedin.com/sales-solutions', type: 'tool' },
  ],
  finance: [],
  operations: [],
  strategy: [],
  product: [],
  legal: [
    { label: 'Smartlaw Vertragsgenerator', url: 'https://www.smartlaw.de/', type: 'tool' },
  ],
  general: [],
};

// ============================================================================
// PROMPT BUILDING
// ============================================================================

// BUSINESS STRATEGY PROMPT (for strategic/business questions)
const SYSTEM_PROMPT_BUSINESS = `Du bist der persönliche CEO-Unternehmensberater von Justin, dem Gründer von FIAON. Du sprichst ihn direkt mit "Justin" an und antwortest IMMER auf Deutsch.

Deine DNA:
- Du denkst wie ein Private-Equity-Partner: Daten > Bauchgefühl.
- Du bist direkt, respektvoll, ehrlich. Keine Floskeln, keine Business-Coach-Sprache.
- Du rechnest JEDE Idee durch (Kosten, Upside, Opportunitätskosten, Zeit-Invest).
- Du stellst GENAU eine kritische Rückfrage, die die Entscheidung schärft.
- Wenn du Marktzahlen nutzt, beziehe dich auf die dir mitgegebenen Web-Research-Snippets.
- Du kennst den deutschen/europäischen Markt (Stellenanzeigen ~800-2.500€ pro Portal, Call-Setter 1.800-2.400€ Fixum etc.).
- Wenn eine Stellenausschreibung, ein Marketing-Skript, ein Sales-Skript oder ein Vertragsentwurf SINNVOLL wäre, lieferst du ihn als fertiges Magic-Template mit.

Antworte AUSSCHLIESSLICH in diesem JSON-Schema (kein Markdown-Code-Block, keine Kommentare):
{
  "summary": "1 Satz: was Justin eigentlich vorhat",
  "followUpQuestion": "Die EINE kritische Rückfrage",
  "roiCheck": "2-4 Sätze: Kosten vs. Nutzen mit konkreten Zahlen, wenn möglich",
  "nextSteps": ["konkreter Schritt 1", "konkreter Schritt 2", "konkreter Schritt 3"],
  "category": "personal|marketing|sales|finance|operations|strategy|product|legal|general",
  "magicTemplate": {
    "kind": "job_posting|marketing_script|cold_email|contract|sales_script",
    "title": "Kurzer Titel",
    "content": "Der fertige, verwendbare Text (Markdown erlaubt)",
    "cta": "Optionaler Hinweis wie 'Kopieren und auf LinkedIn posten'"
  } | null,
  "resources": [{"label": "Name", "url": "https://...", "type": "portal|article|tool|reference"}],
  "confidence": 0.0-1.0
}

Regeln:
- "magicTemplate" NUR, wenn ein fertiger Text einen echten Mehrwert hat (Personal, Marketing, Vertrieb, Legal).
- Die "content"-Felder sollen produktionsreif sein, nicht "Entwurf" oder "Platzhalter".
- Keine erfundenen Zahlen. Lieber "üblicherweise 1.800-2.400€" als eine exakte Fantasiezahl.`;

// PERSONAL KNOWLEDGE PROMPT (for personal/factual questions with strong knowledge match)
const SYSTEM_PROMPT_PERSONAL = `Du bist JARVIS, Justins persönlicher AI-Assistent. Du hast Zugriff auf sein persönliches Wissen und beantwortest Fragen direkt und natürlich.

WICHTIG: Du hast gerade relevantes Wissen aus Justins Datenbank gefunden. Nutze es, um die Frage DIREKT zu beantworten.

Deine DNA:
- Du bist persönlich, warm, und hilfreich - kein steifer Berater.
- Du antwortest DIREKT mit dem Wissen, das du gefunden hast.
- KEINE ROI-Analysen für persönliche Fakten (Name der Tochter, Lieblingsauto, etc.).
- KEINE "Next Steps" für einfache Wissensfragen.
- Beginne deine Antwort mit "Basierend auf deinem Wissen..." oder "Ich erinnere mich..."

Antworte AUSSCHLIESSLICH in diesem JSON-Schema:
{
  "summary": "Die direkte Antwort auf die Frage, basierend auf dem gefundenen Wissen",
  "followUpQuestion": "Eine natürliche, persönliche Folgefrage (optional)",
  "roiCheck": "Leer lassen für persönliche Fragen",
  "nextSteps": [],
  "category": "personal",
  "magicTemplate": null,
  "resources": [],
  "confidence": 0.9
}

Beispiel:
Frage: "Wie heißt meine Tochter?"
Wissen: "Meine Tochter heißt Emma und ist 5 Jahre alt."
Antwort:
{
  "summary": "Basierend auf deinem Wissen heißt deine Tochter Emma und ist 5 Jahre alt.",
  "followUpQuestion": "Möchtest du eine Notiz über Emma hinzufügen?",
  "roiCheck": "",
  "nextSteps": [],
  "category": "personal",
  "magicTemplate": null,
  "resources": [],
  "confidence": 0.95
}`;

// Heuristik: bei welchen Stichworten schicken wir eine Tavily-Suche raus?
function shouldSearch(thought: string): { search: boolean; query: string } {
  const lc = thought.toLowerCase();
  const triggers: Array<{ re: RegExp; qFn: (t: string) => string }> = [
    {
      re: /(stellenausschreibung|stellenanzeig|mitarbeiter|einstellen|recruiting|call[- ]?setter|closer|vertriebler|werkstudent)/,
      qFn: () => 'aktuelle Kosten Stellenanzeige Deutschland 2025 StepStone LinkedIn Indeed',
    },
    {
      re: /(ads|werbung|facebook|google ads|meta|tiktok|paid)/,
      qFn: (t) => `aktuelle CPM CPC Kosten ${t} Deutschland 2025`,
    },
    { re: /(saas|abo|subscription|preis|pricing)/, qFn: (t) => `pricing benchmark ${t} europe 2025` },
    {
      re: /(steuer|rechts|vertrag|gmbh|agb|dsgvo)/,
      qFn: (t) => `Deutschland rechtliche Anforderungen ${t} 2025`,
    },
  ];
  for (const trig of triggers) {
    if (trig.re.test(lc)) {
      return { search: true, query: trig.qFn(thought) };
    }
  }
  return { search: false, query: '' };
}

// ============================================================================
// JSON PARSING
// ============================================================================

function safeParseJson(text: string): any | null {
  if (!text) return null;
  // Strip fences if any
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to extract the first {...} block
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeCategory(c: any): MindCategory {
  const valid: MindCategory[] = [
    'personal',
    'marketing',
    'sales',
    'finance',
    'operations',
    'strategy',
    'product',
    'legal',
    'general',
  ];
  return valid.includes(c) ? c : 'general';
}

function normalizeTemplate(t: any): MagicTemplate | null {
  if (!t || typeof t !== 'object') return null;
  const kind = t.kind;
  const valid: TemplateKind[] = [
    'job_posting',
    'marketing_script',
    'cold_email',
    'contract',
    'sales_script',
  ];
  if (!valid.includes(kind)) return null;
  if (!t.content || typeof t.content !== 'string') return null;
  return {
    kind,
    title: String(t.title || 'Vorlage'),
    content: String(t.content),
    cta: t.cta ? String(t.cta) : undefined,
  };
}

function normalizeResources(r: any): ResourceLink[] {
  if (!Array.isArray(r)) return [];
  return r
    .map((x) => ({
      label: String(x?.label || x?.title || '').trim(),
      url: String(x?.url || '').trim(),
      type: (x?.type as ResourceLink['type']) || 'reference',
    }))
    .filter((x) => x.label && /^https?:\/\//.test(x.url))
    .slice(0, 6);
}

// ============================================================================
// PUBLIC API — analyzeThought
// ============================================================================

export async function analyzeThought(
  thought: string,
  history: string[] = []
): Promise<CeoAnalysis> {
  const start = Date.now();
  const thoughtTrim = (thought || '').trim();
  if (!thoughtTrim) {
    throw new Error('thought is required');
  }

  // If Groq is not configured, return a rule-based fallback so the UI still works.
  if (!groq) {
    logger.warn('[CEO-AGENT] GROQ_API_KEY not set — returning fallback analysis.');
    return fallbackAnalysis(thoughtTrim, start);
  }

  // Step 1: Search JARVIS knowledge base for relevant context
  const knowledgeResults = await fullHybridSearch(thoughtTrim, 3, false);
  const hasStrongKnowledgeMatch = knowledgeResults.length > 0 && knowledgeResults[0].hybridScore > 0.6;
  
  const knowledgeContext = knowledgeResults.map(r => r.content);
  const knowledgeBlock =
    knowledgeContext.length > 0
      ? `\n\n### KONTEXT AUS DEINEM WISSEN (JARVIS Brain-Link) ###\n` +
        knowledgeContext.map((k, i) => `[${i + 1}] ${k}`).join('\n---\n') +
        `\n### ENDE WISSEN ###\n`
      : '';
  
  logger.info(`[CEO-AGENT] Knowledge match: ${hasStrongKnowledgeMatch ? 'STRONG' : 'WEAK'} (top score: ${knowledgeResults[0]?.hybridScore.toFixed(3) || 'N/A'})`);

  // Step 2: decide whether we need web research
  const { search, query } = shouldSearch(thoughtTrim);
  let tavilyResults: TavilyResult[] = [];
  if (search && TAVILY_API_KEY) {
    tavilyResults = await tavilySearch(query, 5);
  }

  const webContext =
    tavilyResults.length > 0
      ? `\n\nWEB-RESEARCH (Tavily, Query="${query}"):\n` +
        tavilyResults
          .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.content}`)
          .join('\n---\n')
      : '';

  const historyBlock =
    history.length > 0
      ? `\n\nBISHERIGE NOTIZEN (älteste zuerst, für Kontext):\n- ${history.slice(-5).join('\n- ')}`
      : '';

  // INTELLIGENT PROMPT SWITCH: Personal vs Business
  const systemPrompt = hasStrongKnowledgeMatch ? SYSTEM_PROMPT_PERSONAL : SYSTEM_PROMPT_BUSINESS;
  const mode = hasStrongKnowledgeMatch ? 'PERSONAL' : 'BUSINESS';
  
  logger.info(`[CEO-AGENT] Mode: ${mode} (knowledge score: ${knowledgeResults[0]?.hybridScore.toFixed(3) || 'N/A'})`);

  const userPrompt = `Justin schreibt dir folgenden Brain-Dump:
"""
${thoughtTrim}
"""${knowledgeBlock}${historyBlock}${webContext}

Analysiere das jetzt. Nutze das Wissen aus JARVIS Brain-Link, falls relevant. Antworte NUR im geforderten JSON-Schema.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_LARGE,  // Use large model for strategic analysis
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: hasStrongKnowledgeMatch ? 0.3 : 0.55,  // Lower temp for factual answers
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = safeParseJson(raw);

    if (!parsed) {
      logger.warn('[CEO-AGENT] Could not parse model JSON, using fallback');
      return fallbackAnalysis(thoughtTrim, start, tavilyResults, query);
    }

    const category = normalizeCategory(parsed.category);
    const modelResources = normalizeResources(parsed.resources);
    const staticResources = CATEGORY_STATIC_RESOURCES[category] || [];
    // Merge, prefer model resources, dedupe by URL
    const seen = new Set<string>();
    const merged: ResourceLink[] = [];
    for (const r of [...modelResources, ...staticResources]) {
      if (seen.has(r.url)) continue;
      seen.add(r.url);
      merged.push(r);
    }

    const confidence =
      typeof parsed.confidence === 'number'
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.7;

    const analysis: CeoAnalysis = {
      summary: String(parsed.summary || thoughtTrim.slice(0, 120)).trim(),
      followUpQuestion: String(
        parsed.followUpQuestion ||
          'Was ist genau das Ziel dahinter — und woran misst du den Erfolg?'
      ).trim(),
      roiCheck: String(parsed.roiCheck || 'Ohne mehr Kontext keine belastbare ROI-Rechnung.').trim(),
      nextSteps: Array.isArray(parsed.nextSteps)
        ? parsed.nextSteps.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5)
        : [],
      category,
      magicTemplate: normalizeTemplate(parsed.magicTemplate),
      resources: merged.slice(0, 6),
      confidence,
      meta: {
        model: GROQ_MODEL_LARGE,
        usedWebSearch: search && tavilyResults.length > 0,
        searchQuery: search ? query : undefined,
        durationMs: Date.now() - start,
      },
    };
    return analysis;
  } catch (err: any) {
    logger.error(`[CEO-AGENT] Groq error: ${err?.message || err}`);
    return fallbackAnalysis(thoughtTrim, start, tavilyResults, search ? query : undefined);
  }
}

// ============================================================================
// PUBLIC API — analyzeFailure
// ============================================================================

export async function analyzeFailure(
  thought: string,
  originalAnalysis: Partial<CeoAnalysis> | null,
  reason: string
): Promise<FailureAnalysis> {
  const start = Date.now();
  const reasonTrim = (reason || '').trim();
  if (!reasonTrim) {
    throw new Error('reason is required');
  }

  if (!groq) {
    return {
      empathy:
        'Okay, verstanden. Das passiert — wichtig ist, dass du bewusst entscheidest statt aus dem Bauch.',
      opportunityCost:
        'Ohne KI-Key kann ich die Opportunitätskosten nicht präzise rechnen. Trage die Zahlen kurz nach — ich liefere dann die Gegenrechnung.',
      alternatives: ['Grund dokumentieren, um später Muster zu erkennen'],
      recommendation:
        'Lege GROQ_API_KEY in die Umgebungsvariablen, damit ich dir eine echte Gegenrechnung liefern kann.',
      meta: { model: 'fallback', durationMs: Date.now() - start },
    };
  }

  const system = `Du bist der CEO-Berater von Justin. Er hat eine Idee NICHT umgesetzt oder abgebrochen. Deine Aufgabe:
1. Kurz empathisch reagieren (1-2 Sätze, kein Psycho-Gelaber).
2. Ihm die OPPORTUNITÄTSKOSTEN konkret vorrechnen (z.B. "2.000€ Kosten vs. 10.000€ Umsatzpotenzial = 8.000€ entgangener Gewinn pro Monat").
3. 2-3 echte Alternativen oder Workarounds vorschlagen.
4. EINE klare Empfehlung formulieren.

Antworte AUSSCHLIESSLICH im JSON-Schema:
{
  "empathy": "...",
  "opportunityCost": "...",
  "alternatives": ["...", "..."],
  "recommendation": "..."
}`;

  const userPrompt = `URSPRÜNGLICHE IDEE:
"""${thought}"""

BISHERIGE ANALYSE:
${originalAnalysis?.roiCheck || '(keine vorhanden)'}
${originalAnalysis?.followUpQuestion ? `Rückfrage war: ${originalAnalysis.followUpQuestion}` : ''}

GRUND, WARUM JUSTIN ES NICHT UMSETZT:
"""${reasonTrim}"""

Rechne ihm die Opportunitätskosten vor und gib eine ehrliche Empfehlung.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_LARGE,  // Use large model for failure analysis
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = safeParseJson(raw) || {};

    return {
      empathy: String(parsed.empathy || 'Verstanden.').trim(),
      opportunityCost: String(parsed.opportunityCost || '').trim(),
      alternatives: Array.isArray(parsed.alternatives)
        ? parsed.alternatives.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 5)
        : [],
      recommendation: String(parsed.recommendation || '').trim(),
      meta: { model: GROQ_MODEL_LARGE, durationMs: Date.now() - start },
    };
  } catch (err: any) {
    logger.error(`[CEO-AGENT] Groq failure-analysis error: ${err?.message || err}`);
    return {
      empathy: 'Okay, das dokumentiere ich.',
      opportunityCost: '',
      alternatives: [],
      recommendation: reasonTrim,
      meta: { model: 'error', durationMs: Date.now() - start },
    };
  }
}

// ============================================================================
// PUBLIC API — generateTemplate (on-demand Magic-Button)
// ============================================================================

export async function generateTemplate(
  thought: string,
  analysis: Partial<CeoAnalysis> | null,
  kind?: Exclude<TemplateKind, null>
): Promise<MagicTemplate> {
  if (!groq) {
    return {
      kind: kind || 'job_posting',
      title: 'Vorlage',
      content:
        'GROQ_API_KEY ist nicht konfiguriert. Hinterlege deinen Groq-Key in den Environment Variables, um Magic-Templates zu generieren.',
    };
  }

  const pickedKind: Exclude<TemplateKind, null> =
    kind || (analysis?.magicTemplate?.kind as Exclude<TemplateKind, null>) || 'job_posting';

  const kindLabels: Record<Exclude<TemplateKind, null>, string> = {
    job_posting: 'eine fertige Stellenausschreibung für LinkedIn/StepStone',
    marketing_script: 'ein fertiges 30-Sekunden Marketing-Skript',
    cold_email: 'eine fertige Cold-Email (3 Varianten: kurz, mittel, lang)',
    contract: 'einen sauberen Vertragsentwurf / eine Eckpunkte-Vorlage',
    sales_script: 'ein fertiges Sales-Gesprächs-Skript (Discovery + Pitch + Close)',
  };

  const system = `Du bist ein Copywriter & Business Consultant in einer Person. Liefere ${kindLabels[pickedKind]} für Justins Kontext. Schreibe produktionsreif — kein "Entwurf", keine Platzhalter wie [Firmenname], sondern fertiger, kopierbarer Text. Deutsch.

Antworte AUSSCHLIESSLICH in JSON:
{
  "kind": "${pickedKind}",
  "title": "Kurzer Titel",
  "content": "Der fertige Text (Markdown erlaubt)",
  "cta": "Hinweis wie man es einsetzt"
}`;

  const userPrompt = `IDEE:
"""${thought}"""

KURZE ANALYSE:
${analysis?.summary || ''}
${analysis?.roiCheck || ''}

Liefere jetzt die Vorlage.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_LARGE,  // Use large model for template generation
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1800,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '';
    const parsed = safeParseJson(raw);
    const normalized = normalizeTemplate(parsed);
    if (normalized) return normalized;

    return {
      kind: pickedKind,
      title: 'Vorlage',
      content: raw || 'Leider konnte keine Vorlage generiert werden.',
    };
  } catch (err: any) {
    logger.error(`[CEO-AGENT] generateTemplate error: ${err?.message || err}`);
    return {
      kind: pickedKind,
      title: 'Vorlage',
      content: 'Beim Generieren ist ein Fehler aufgetreten. Bitte erneut versuchen.',
    };
  }
}

// ============================================================================
// FALLBACK — wenn Groq nicht erreichbar ist
// ============================================================================

function fallbackAnalysis(
  thought: string,
  start: number,
  tavilyResults: TavilyResult[] = [],
  searchQuery?: string
): CeoAnalysis {
  const lc = thought.toLowerCase();
  let category: MindCategory = 'general';
  if (/mitarbeiter|einstellen|recruiting|closer|setter|werkstudent/.test(lc)) category = 'personal';
  else if (/ads|werbung|marketing|kampagne|reichweite/.test(lc)) category = 'marketing';
  else if (/sales|pipeline|closing|calls|leads/.test(lc)) category = 'sales';
  else if (/vertrag|agb|rechts|gmbh|dsgvo/.test(lc)) category = 'legal';
  else if (/preis|pricing|kosten|budget|finanzierung/.test(lc)) category = 'finance';

  const resources: ResourceLink[] = [
    ...tavilyResults.slice(0, 4).map<ResourceLink>((r) => ({
      label: r.title.slice(0, 80),
      url: r.url,
      type: 'article' as const,
    })),
    ...(CATEGORY_STATIC_RESOURCES[category] || []),
  ].slice(0, 6);

  return {
    summary: thought.slice(0, 120),
    followUpQuestion:
      'Was ist genau das Ziel dahinter — und wie misst du, ob es funktioniert hat?',
    roiCheck:
      'Für eine belastbare Rechnung brauche ich noch Zahlen: Kosten (einmalig / pro Monat) und erwarteter Umsatz-Impact. Nenne sie mir und ich liefere die Kalkulation.',
    nextSteps: [
      'Klares Erfolgskriterium definieren (z.B. Umsatz in 90 Tagen)',
      'Budget-Rahmen festlegen',
      'Kleinsten Test-Schritt planen, bevor groß investiert wird',
    ],
    category,
    magicTemplate: null,
    resources,
    confidence: 0.35,
    meta: {
      model: 'fallback',
      usedWebSearch: tavilyResults.length > 0,
      searchQuery,
      durationMs: Date.now() - start,
    },
  };
}

// ============================================================================
// SHADOW INBOX — E-Mail Intelligence (STARK EDITION)
// ============================================================================

export interface EmailAnalysis {
  actionType: 'invoice' | 'lead' | 'info' | 'todo_created' | 'strategy_created' | 'archived';
  priorityLevel: 'low' | 'normal' | 'high' | 'critical';
  summary: string;
  suggestedResponse?: string;
  shouldCreateTodo: boolean;
  shouldCreateStrategy: boolean;
  todoTitle?: string;
  strategyThought?: string;
  confidence: number;
}

/**
 * Analysiert eine eingehende E-Mail und entscheidet, welche Action die KI nehmen soll.
 * Nutzt Context-Awareness: Hat Zugriff auf die letzten Inbound-Mails.
 */
export async function analyzeEmail(
  sender: string,
  subject: string,
  body: string,
  recentEmails: Array<{ sender: string; subject: string; content_summary?: string }> = []
): Promise<EmailAnalysis> {
  const start = Date.now();

  if (!groq) {
    return fallbackEmailAnalysis(sender, subject, body);
  }

  try {
    // Context-Awareness: Letzte 10 E-Mails als Kontext
    const contextBlock = recentEmails.length > 0
      ? `\n\nRECENT EMAIL CONTEXT (for pattern detection):\n${recentEmails.map((e, i) => 
          `${i + 1}. From: ${e.sender} | Subject: ${e.subject}${e.content_summary ? ` | Summary: ${e.content_summary}` : ''}`
        ).join('\n')}`
      : '';

    const prompt = `Du bist JARVIS für den CEO Justin. Analysiere diese eingehende E-Mail und entscheide die optimale Action.

FROM: ${sender}
SUBJECT: ${subject}
BODY: ${body.slice(0, 2000)}${contextBlock}

CLASSIFICATION RULES:
- INVOICE: Enthält Rechnung, Zahlungsaufforderung, Abo-Kosten, Subscription
- LEAD: Neue Business-Anfrage, Kooperationsvorschlag, Sales-Opportunity
- INFO: Newsletter, Update, FYI ohne Action
- TODO_CREATED: Dringender Task (z.B. "bitte Feedback bis Freitag", "Dokument unterschreiben")
- STRATEGY_CREATED: Strategische Entscheidung nötig (z.B. "Sollen wir diese Plattform nutzen?", "Was hältst du von diesem Ansatz?")

PRIORITY RULES:
- CRITICAL: Zahlungsfrist läuft ab, dringender Kunde-Request, rechtliche Deadline
- HIGH: Lead mit Budget, strategische Chance, wichtiger Partner
- NORMAL: Standard-Info, Newsletter, Routine-Updates
- LOW: Spam-verdächtig, irrelevant

Antworte NUR mit einem JSON-Objekt:
{
  "actionType": "invoice" | "lead" | "info" | "todo_created" | "strategy_created" | "archived",
  "priorityLevel": "low" | "normal" | "high" | "critical",
  "summary": "1-Satz-Zusammenfassung",
  "suggestedResponse": "Optionaler Response-Entwurf (falls Lead/Todo)",
  "shouldCreateTodo": true/false,
  "shouldCreateStrategy": true/false,
  "todoTitle": "Optional: Todo-Titel",
  "strategyThought": "Optional: Strategie-Gedanke",
  "confidence": 0.0-1.0
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL_FAST,  // Use fast model for briefings (rate limit protection)
      temperature: 0.3,
      max_tokens: 800,
    });

    const rawResponse = completion.choices[0]?.message?.content || '{}';
    const parsed = safeParseJson(rawResponse) as EmailAnalysis | null;

    if (!parsed || !parsed.actionType) {
      logger.warn('[CEO-AGENT] Email analysis parsing failed, using fallback');
      return fallbackEmailAnalysis(sender, subject, body);
    }

    logger.info(`[CEO-AGENT] Email analyzed: ${parsed.actionType} (${parsed.priorityLevel}) in ${Date.now() - start}ms`);
    return parsed;
  } catch (error: any) {
    logger.error('[CEO-AGENT] Email analysis error:', error?.message || error);
    return fallbackEmailAnalysis(sender, subject, body);
  }
}

function fallbackEmailAnalysis(sender: string, subject: string, body: string): EmailAnalysis {
  const lc = `${subject} ${body}`.toLowerCase();
  
  let actionType: EmailAnalysis['actionType'] = 'info';
  let priorityLevel: EmailAnalysis['priorityLevel'] = 'normal';
  let shouldCreateTodo = false;
  let shouldCreateStrategy = false;

  // Rechnung?
  if (/rechnung|invoice|zahlung|payment|abo|subscription|fällig|due/.test(lc)) {
    actionType = 'invoice';
    priorityLevel = 'high';
    shouldCreateTodo = true;
  }
  // Lead?
  else if (/anfrage|kooperation|partnership|zusammenarbeit|interesse|gespräch|call/.test(lc)) {
    actionType = 'lead';
    priorityLevel = 'high';
    shouldCreateStrategy = true;
  }
  // Todo?
  else if (/bitte|deadline|bis|frist|unterschreiben|freigabe|approval/.test(lc)) {
    actionType = 'todo_created';
    shouldCreateTodo = true;
  }
  // Strategie?
  else if (/meinung|feedback|empfehlung|was hältst du|sollen wir/.test(lc)) {
    actionType = 'strategy_created';
    shouldCreateStrategy = true;
  }

  return {
    actionType,
    priorityLevel,
    summary: `${sender}: ${subject.slice(0, 60)}`,
    shouldCreateTodo,
    shouldCreateStrategy,
    todoTitle: shouldCreateTodo ? subject : undefined,
    strategyThought: shouldCreateStrategy ? `Email-Anfrage von ${sender}: ${subject}` : undefined,
    confidence: 0.4,
  };
}

/**
 * Generiert ein Morning Briefing basierend auf neuen E-Mails und offenen Strategien.
 */
export async function generateMorningBriefing(
  newEmailsCount: number,
  criticalEmailsCount: number,
  openStrategiesCount: number,
  recentEmails: Array<{ sender: string; subject: string; priority_level: string }> = []
): Promise<string> {
  if (!groq) {
    return fallbackMorningBriefing(newEmailsCount, criticalEmailsCount, openStrategiesCount);
  }

  try {
    const emailSummary = recentEmails.slice(0, 5).map((e, i) => 
      `${i + 1}. [${e.priority_level.toUpperCase()}] ${e.sender}: ${e.subject}`
    ).join('\n');

    const prompt = `Du bist JARVIS. Erstelle ein kurzes, prägnantes Morning Briefing für CEO Justin.

DATEN:
- ${newEmailsCount} neue E-Mails (${criticalEmailsCount} kritisch)
- ${openStrategiesCount} offene Strategie-Tasks

TOP EMAILS:
${emailSummary || 'Keine neuen E-Mails'}

STYLE: Direkt, knapp, handlungsorientiert. Max 3 Sätze. Nutze Emojis sparsam (max 2).

Beispiel: "Guten Morgen Justin. 3 kritische Mails erhalten — 1 Rechnung fällig (PayPal), 2 neue Leads. 1 Strategie-Task offen. Soll ich die Entwürfe zeigen?"

Antworte NUR mit dem Briefing-Text (kein JSON):`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL_FAST,  // Use fast model for email analysis (rate limit protection)
      temperature: 0.7,
      max_tokens: 200,
    });

    return completion.choices[0]?.message?.content?.trim() || fallbackMorningBriefing(newEmailsCount, criticalEmailsCount, openStrategiesCount);
  } catch (error: any) {
    // Check for rate limit (429) error
    if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('rate limit')) {
      logger.warn('[CEO-AGENT] Rate limit hit (429), returning fallback briefing');
    } else {
      logger.error('[CEO-AGENT] Morning briefing error:', error?.message || error);
    }
    return fallbackMorningBriefing(newEmailsCount, criticalEmailsCount, openStrategiesCount);
  }
}

function fallbackMorningBriefing(newEmailsCount: number, criticalEmailsCount: number, openStrategiesCount: number): string {
  if (newEmailsCount === 0 && openStrategiesCount === 0) {
    return '☀️ Guten Morgen Justin. Inbox sauber, keine offenen Tasks. Du kannst proaktiv arbeiten.';
  }
  
  const parts: string[] = ['Guten Morgen Justin.'];
  
  if (criticalEmailsCount > 0) {
    parts.push(`${criticalEmailsCount} kritische Mail${criticalEmailsCount > 1 ? 's' : ''} erhalten.`);
  } else if (newEmailsCount > 0) {
    parts.push(`${newEmailsCount} neue Mail${newEmailsCount > 1 ? 's' : ''}.`);
  }
  
  if (openStrategiesCount > 0) {
    parts.push(`${openStrategiesCount} Strategie-Task${openStrategiesCount > 1 ? 's' : ''} offen.`);
  }
  
  parts.push('Soll ich die Details zeigen?');
  
  return parts.join(' ');
}

// ============================================================================
// VOICE-TO-STRATEGY — Whisper Speech-to-Text (IRON MAN HUD)
// ============================================================================

/**
 * Transkribiert Audio-Daten mittels Groq Whisper (whisper-large-v3-turbo).
 * @param audioData Base64-encoded Audio oder Buffer
 * @param format Audio-Format (webm, mp3, wav, etc.)
 * @returns Transkribierter Text
 */
export async function transcribeAudio(audioData: string, format: string = 'webm'): Promise<string> {
  if (!groq) {
    logger.warn('[CEO-AGENT] Groq not configured, cannot transcribe audio');
    return '';
  }

  try {
    // Konvertiere Base64 zu Buffer falls nötig
    let audioBuffer: Buffer;
    if (typeof audioData === 'string' && audioData.startsWith('data:')) {
      // Data URL Format: data:audio/webm;base64,<data>
      const base64Data = audioData.split(',')[1];
      audioBuffer = Buffer.from(base64Data, 'base64');
    } else if (typeof audioData === 'string') {
      // Pure Base64
      audioBuffer = Buffer.from(audioData, 'base64');
    } else {
      audioBuffer = audioData as any;
    }

    // Erstelle temporäre Datei für Groq API (benötigt File-Object)
    const fs = await import('fs');
    const path = await import('path');
    const os = await import('os');
    
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, `voice_${Date.now()}.${format}`);
    fs.writeFileSync(tmpFile, audioBuffer);

    logger.info(`[CEO-AGENT] Transcribing audio file (${format}, ${audioBuffer.length} bytes)...`);

    // Groq Whisper API Call
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpFile) as any,
      model: 'whisper-large-v3-turbo',
      language: 'de', // Deutsch
      response_format: 'text',
      temperature: 0.0,
    });

    // Cleanup
    fs.unlinkSync(tmpFile);

    const text = typeof transcription === 'string' ? transcription : (transcription as any).text || '';
    logger.info(`[CEO-AGENT] Transcription successful: "${text.slice(0, 80)}..."`);

    return text.trim();
  } catch (error: any) {
    logger.error('[CEO-AGENT] Transcription error:', error?.message || error);
    throw new Error(`Whisper transcription failed: ${error?.message || 'Unknown error'}`);
  }
}
