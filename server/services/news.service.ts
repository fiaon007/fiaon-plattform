/**
 * ============================================================================
 * ARAS NEWS SERVICE — Daily Industry News Digest
 * ============================================================================
 * Flash model (NOT pro) + 12s hard timeout + inflight dedupe +
 * stale-while-revalidate cache (fresh 15min, stale up to 24h).
 * Single Gemini call per request — no scope narrowing retries.
 * ============================================================================
 */

import { GoogleGenAI } from "@google/genai";
import { logger } from "../logger";

// ============================================================================
// CONFIG (ENV-overridable)
// ============================================================================

const NEWS_MODEL = process.env.NEWS_GEMINI_MODEL || "gemini-2.0-flash";
const NEWS_TIMEOUT_MS = parseInt(process.env.NEWS_GEMINI_TIMEOUT_MS || "12000", 10);
const CACHE_FRESH_MS = 15 * 60 * 1000;   // 15 min → fresh
const CACHE_STALE_MS = 24 * 60 * 60 * 1000; // 24h → stale but usable

// ============================================================================
// TYPES
// ============================================================================

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  scope: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative";
  whyItMatters: string;
}

export interface NewsDigestResponse {
  industryLabel: string;
  scopes: string[];
  mode: "top" | "breaking";
  generatedAt: string;
  items: NewsItem[];
  sources: string[];
  fromCache: boolean;
  stale: boolean;
  provider: string;
  error: { code: string; message: string } | null;
}

export interface NewsDigestRequest {
  userId: string;
  industry: string;
  company?: string;
  aiProfile?: any;
  mode: "top" | "breaking";
  scopes: string[];
}

// ============================================================================
// CACHE — in-memory, stale-while-revalidate
// ============================================================================

interface CacheEntry { data: NewsDigestResponse; timestamp: number; }
const NEWS_CACHE = new Map<string, CacheEntry>();

function makeCacheKey(req: NewsDigestRequest): string {
  return `news:${req.industry}:${req.mode}:${[...req.scopes].sort().join(",")}:${new Date().toISOString().slice(0, 10)}`;
}

function readCache(key: string): { data: NewsDigestResponse; fresh: boolean } | null {
  const e = NEWS_CACHE.get(key);
  if (!e) return null;
  const age = Date.now() - e.timestamp;
  if (age > CACHE_STALE_MS) { NEWS_CACHE.delete(key); return null; }
  return { data: { ...e.data, fromCache: true }, fresh: age <= CACHE_FRESH_MS };
}

function writeCache(key: string, data: NewsDigestResponse): void {
  if (NEWS_CACHE.size > 100) {
    const old = Array.from(NEWS_CACHE.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp).slice(0, 30);
    old.forEach(([k]) => NEWS_CACHE.delete(k));
  }
  NEWS_CACHE.set(key, { data, timestamp: Date.now() });
}

// ============================================================================
// INFLIGHT DEDUPE — same key → same promise
// ============================================================================

const INFLIGHT = new Map<string, Promise<NewsDigestResponse>>();

// ============================================================================
// LABELS
// ============================================================================

const INDUSTRY_LABELS: Record<string, string> = {
  real_estate: "Immobilien", immobilien: "Immobilien",
  insurance: "Versicherungen", versicherung: "Versicherungen",
  finance: "Finanzen & Banking", technology: "Technologie & Software",
  healthcare: "Gesundheitswesen", consulting: "Unternehmensberatung",
  legal: "Recht & Kanzleien", marketing: "Marketing & Werbung",
  automotive: "Automobil & Mobilität", energy: "Energie & Nachhaltigkeit",
  retail: "Einzelhandel & E-Commerce", construction: "Bauwesen & Architektur",
  education: "Bildung & Weiterbildung", food: "Gastronomie & Lebensmittel",
  travel: "Tourismus & Reisen", logistics: "Logistik & Transport",
  manufacturing: "Produktion & Industrie", media: "Medien & Unterhaltung",
  b2b_services: "B2B Dienstleistungen", general: "Wirtschaft & Märkte",
  saas: "SaaS & Cloud", ai: "Künstliche Intelligenz",
};

const SCOPE_LABELS: Record<string, string> = {
  global: "International", AT: "Österreich", DE: "Deutschland", CH: "Schweiz",
  US: "USA", UK: "Großbritannien", FR: "Frankreich", IT: "Italien",
  ES: "Spanien", NL: "Niederlande", BE: "Belgien", LU: "Luxemburg",
};

function toLabel(key: string): string {
  return INDUSTRY_LABELS[key?.toLowerCase().replace(/[\s-]/g, "_")] || key || "Wirtschaft & Märkte";
}

// ============================================================================
// ROBUST JSON EXTRACTOR
// ============================================================================

function extractJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {}
  const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fence) { try { return JSON.parse(fence[1]); } catch {} }
  const b1 = raw.indexOf("{"), b2 = raw.lastIndexOf("}");
  if (b1 !== -1 && b2 > b1) { try { return JSON.parse(raw.slice(b1, b2 + 1)); } catch {} }
  const a1 = raw.indexOf("["), a2 = raw.lastIndexOf("]");
  if (a1 !== -1 && a2 > a1) { try { return { items: JSON.parse(raw.slice(a1, a2 + 1)) }; } catch {} }
  return null;
}

// ============================================================================
// PROMPT (compact — flash model, small output)
// ============================================================================

function buildPrompt(req: NewsDigestRequest): string {
  const label = toLabel(req.industry);
  const scopes = req.scopes.map((s) => SCOPE_LABELS[s] || s).join(", ");
  const today = new Date().toISOString().slice(0, 10);
  const ai = req.aiProfile || {};

  return `Nachrichten-Kurator. Nutze Google Search für AKTUELLE Nachrichten.

DATUM: ${today}
BRANCHE: ${label}
${req.company ? `UNTERNEHMEN: ${req.company}` : ""}
${ai.companyDescription ? `INFO: ${String(ai.companyDescription).slice(0, 200)}` : ""}
REGIONEN: ${scopes}
MODUS: ${req.mode === "breaking" ? "BREAKING (letzte 24h)" : "TOP (letzte 7 Tage)"}

Liefere 5 echte News-Artikel als JSON:
{"items":[{"title":"...","summary":"1-2 Sätze DE","source":"Quellenname","url":"Link","date":"YYYY-MM-DD","scope":"${req.scopes[0]}","tags":["a","b"],"sentiment":"positive|neutral|negative","whyItMatters":"1 Satz"}]}

Scope-Werte: ${req.scopes.map(s => `"${s}"`).join(",")}
NUR JSON. Keine Erklärungen.`;
}

// ============================================================================
// CORE — with inflight dedupe + stale-while-revalidate
// ============================================================================

export async function generateNewsDigest(req: NewsDigestRequest): Promise<NewsDigestResponse> {
  const key = makeCacheKey(req);

  // 1. Check cache
  const cached = readCache(key);
  if (cached?.fresh) {
    console.log("[NEWS] fresh cache hit", JSON.stringify({ key, itemCount: cached.data.items.length }));
    return cached.data;
  }

  // 2. If stale cache exists → return it immediately, refresh async in background
  if (cached && !cached.fresh) {
    console.log("[NEWS] stale cache → returning + async refresh");
    void refreshInBackground(req, key).catch((e) => console.error("[NEWS] bg-refresh error:", e?.message?.slice(0, 100)));
    return { ...cached.data, stale: true };
  }

  // 3. No cache → fetch (with inflight dedupe)
  return fetchWithDedupe(req, key);
}

async function refreshInBackground(req: NewsDigestRequest, key: string): Promise<void> {
  // Don't duplicate if already inflight
  if (INFLIGHT.has(key)) return;
  await fetchWithDedupe(req, key);
}

async function fetchWithDedupe(req: NewsDigestRequest, key: string): Promise<NewsDigestResponse> {
  // Inflight dedupe: if same key is already being fetched, await that promise
  const existing = INFLIGHT.get(key);
  if (existing) {
    console.log("[NEWS] inflight dedupe hit", JSON.stringify({ key }));
    return existing;
  }

  const promise = callGeminiForNews(req, key);
  INFLIGHT.set(key, promise);
  try {
    return await promise;
  } finally {
    INFLIGHT.delete(key);
  }
}

// ============================================================================
// GEMINI CALL — single call, hard timeout, flash model
// ============================================================================

async function callGeminiForNews(req: NewsDigestRequest, key: string): Promise<NewsDigestResponse> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[NEWS] No Gemini API key");
    return mkError(req, "MISSING_KEY", "Kein AI-Service konfiguriert.");
  }

  const model = NEWS_MODEL;
  const startTime = Date.now();

  console.log("[NEWS] calling Gemini", JSON.stringify({ model, mode: req.mode, scopes: req.scopes, industry: req.industry, timeoutMs: NEWS_TIMEOUT_MS }));

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = buildPrompt(req);

    const response = await Promise.race([
      ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.2,
          maxOutputTokens: 1500,
        },
      }),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error("TIMEOUT")), NEWS_TIMEOUT_MS)
      ),
    ]);

    // Extract text
    let rawText = "";
    try { rawText = response.text || ""; } catch {
      try {
        const parts = (response as any)?.candidates?.[0]?.content?.parts || [];
        rawText = parts.map((p: any) => p.text || "").join("");
      } catch {}
    }

    // Extract grounding sources
    const sources: string[] = [];
    try {
      const gm = (response as any)?.candidates?.[0]?.groundingMetadata;
      if (gm?.groundingChunks) {
        for (const c of gm.groundingChunks) { if (c?.web?.uri) sources.push(c.web.uri); }
      }
    } catch {}

    const durationMs = Date.now() - startTime;

    if (!rawText || rawText.length < 10) {
      console.warn("[NEWS] empty response", JSON.stringify({ durationMs, model, textLen: rawText.length }));
      return mkError(req, "EMPTY", "Leere AI-Antwort.");
    }

    const parsed = extractJSON(rawText);
    if (!parsed) {
      console.warn("[NEWS] JSON parse failed", JSON.stringify({ durationMs, model, preview: rawText.slice(0, 200) }));
      return mkError(req, "PARSE", "JSON-Parsing fehlgeschlagen.");
    }

    const rawItems = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
    const today = new Date().toISOString().slice(0, 10);

    const items: NewsItem[] = rawItems.slice(0, 10).map((item: any, idx: number) => ({
      id: `news-${req.mode}-${Date.now()}-${idx}`,
      title: String(item.title || "Unbekannter Titel"),
      summary: String(item.summary || item.summaryDe || ""),
      source: String(item.source || item.sourceName || "Unbekannt"),
      url: String(item.url || item.sourceUrl || "#"),
      date: String(item.date || item.publishedAt || today),
      scope: req.scopes.includes(item.scope) ? item.scope : req.scopes[0] || "global",
      tags: Array.isArray(item.tags) ? item.tags.map(String).slice(0, 4) : [],
      sentiment: ["positive", "neutral", "negative"].includes(item.sentiment) ? item.sentiment : "neutral",
      whyItMatters: String(item.whyItMatters || item.why_it_matters || ""),
    }));

    const result: NewsDigestResponse = {
      industryLabel: toLabel(req.industry),
      scopes: req.scopes,
      mode: req.mode,
      generatedAt: new Date().toISOString(),
      items,
      sources,
      fromCache: false,
      stale: false,
      provider: `gemini (${model})`,
      error: null,
    };

    console.log("[NEWS] OK", JSON.stringify({ model, durationMs, itemCount: items.length, sourcesCount: sources.length }));
    writeCache(key, result);
    return result;

  } catch (error: any) {
    const durationMs = Date.now() - startTime;
    const msg = error?.message || "unknown";
    const code = msg.includes("TIMEOUT") ? "TIMEOUT" : "UPSTREAM";
    console.error("[NEWS] Gemini error", JSON.stringify({ code, model, durationMs, error: msg.slice(0, 200) }));
    return mkError(req, code, msg.slice(0, 120));
  }
}

// ============================================================================
// ERROR / FALLBACK BUILDER
// ============================================================================

function mkError(req: NewsDigestRequest, code: string, message: string): NewsDigestResponse {
  return {
    industryLabel: toLabel(req.industry),
    scopes: req.scopes,
    mode: req.mode,
    generatedAt: new Date().toISOString(),
    items: [],
    sources: [],
    fromCache: false,
    stale: false,
    provider: "fallback",
    error: { code, message },
  };
}

// ============================================================================
// SCOPE MAPPING
// ============================================================================

export function deriveDefaultScopes(user: any): string[] {
  const scopes: string[] = ["global"];
  const hq = String(user?.aiProfile?.headquarters || "").toLowerCase();

  if (hq.includes("österreich") || hq.includes("austria") || hq.includes("wien")) scopes.push("AT");
  if (hq.includes("deutschland") || hq.includes("germany") || hq.includes("berlin") || hq.includes("münchen") || hq.includes("frankfurt")) scopes.push("DE");
  if (hq.includes("schweiz") || hq.includes("switzerland") || hq.includes("zürich")) scopes.push("CH");

  if (scopes.length === 1) scopes.push("AT", "DE", "CH");
  return scopes.slice(0, 4);
}
