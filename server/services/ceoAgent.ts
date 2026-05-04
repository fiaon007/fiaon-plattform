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

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

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

const SYSTEM_PROMPT = `Du bist der persönliche CEO-Unternehmensberater von Justin, dem Gründer von FIAON. Du sprichst ihn direkt mit "Justin" an und antwortest IMMER auf Deutsch.

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

  // Step 1: decide whether we need web research
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

  const userPrompt = `Justin schreibt dir folgenden Brain-Dump:
"""
${thoughtTrim}
"""${historyBlock}${webContext}

Analysiere das jetzt. Antworte NUR im geforderten JSON-Schema.`;

  try {
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.55,
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
        model: GROQ_MODEL,
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
      model: GROQ_MODEL,
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
      meta: { model: GROQ_MODEL, durationMs: Date.now() - start },
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
      model: GROQ_MODEL,
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
