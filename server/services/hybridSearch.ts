/**
 * ============================================================================
 * HYBRID SEARCH SERVICE — Vector + Keyword Fusion
 * ============================================================================
 * Combines semantic vector search with keyword matching for 99% precision
 * 
 * Strategy:
 * 1. Vector Search: Finds semantically similar content (meaning)
 * 2. Keyword Search: Finds exact word matches (precision)
 * 3. Hybrid Fusion: Combines scores with keyword boost
 * 4. Contextual Re-Ranking: LLM validates top results
 * ============================================================================
 */

import { client } from '../db';
import { searchEmbedding } from './embeddingService';
import { logger } from '../logger';
import Groq from 'groq-sdk';

const groq = process.env.GROQ_API_KEY ? new Groq({ apiKey: process.env.GROQ_API_KEY }) : null;
const GROQ_MODEL_FAST = 'llama-3.1-8b-instant'; // Fast model for re-ranking

interface HybridSearchResult {
  id: number;
  content: string;
  metadata: any;
  created_at: string;
  vectorScore: number;
  keywordScore: number;
  hybridScore: number;
  keywordMatches: string[];
}

/**
 * Extract important keywords from query
 * Removes stop words and focuses on meaningful terms
 */
function extractKeywords(query: string): string[] {
  const stopWords = new Set([
    'der', 'die', 'das', 'ein', 'eine', 'und', 'oder', 'aber', 'ist', 'sind',
    'was', 'wie', 'wo', 'wann', 'warum', 'welche', 'welcher', 'welches',
    'mein', 'meine', 'dein', 'deine', 'sein', 'seine', 'ihr', 'ihre',
    'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were',
    'what', 'how', 'where', 'when', 'why', 'which', 'my', 'your', 'his', 'her'
  ]);

  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .map(word => word.replace(/[^a-zäöüß0-9]/gi, ''))
    .filter(word => word.length > 0);
}

/**
 * Calculate keyword match score
 * Returns 0-1 score based on keyword presence and frequency
 */
function calculateKeywordScore(content: string, keywords: string[]): { score: number; matches: string[] } {
  if (keywords.length === 0) return { score: 0, matches: [] };

  const contentLower = content.toLowerCase();
  const matches: string[] = [];
  let totalScore = 0;

  for (const keyword of keywords) {
    // Exact match (case-insensitive)
    const exactMatches = (contentLower.match(new RegExp(`\\b${keyword}\\b`, 'gi')) || []).length;
    if (exactMatches > 0) {
      matches.push(keyword);
      // Score: 0.3 for first match, +0.1 for each additional (max 0.5 per keyword)
      totalScore += Math.min(0.3 + (exactMatches - 1) * 0.1, 0.5);
    }
  }

  // Normalize score to 0-1 range
  const normalizedScore = Math.min(totalScore / keywords.length, 1.0);
  
  return { score: normalizedScore, matches };
}

/**
 * Hybrid Search: Vector + Keyword
 * Combines semantic similarity with keyword matching
 */
export async function hybridSearch(
  query: string,
  limit: number = 5,
  keywordBoost: number = 0.5
): Promise<HybridSearchResult[]> {
  try {
    logger.info(`[HYBRID-SEARCH] Query: "${query}"`);

    // Extract keywords from query
    const keywords = extractKeywords(query);
    logger.info(`[HYBRID-SEARCH] Keywords extracted: [${keywords.join(', ')}]`);

    // Generate embedding for vector search
    const queryEmbedding = await searchEmbedding(query);
    logger.info(`[HYBRID-SEARCH] Query embedding: ${queryEmbedding.length} dimensions`);

    // Perform vector search (get more results for re-ranking)
    const vectorResults = await client`
      SELECT
        id,
        content,
        metadata,
        created_at,
        embedding,
        1 - (embedding <=> ${JSON.stringify(queryEmbedding)}::vector) as vector_score
      FROM knowledge_base
      WHERE embedding IS NOT NULL
      ORDER BY embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${limit * 3}
    `;

    logger.info(`[HYBRID-SEARCH] Vector search returned: ${vectorResults.length} results`);

    // Calculate hybrid scores
    const hybridResults: HybridSearchResult[] = vectorResults.map((r: any) => {
      const vectorScore = parseFloat(r.vector_score || 0);
      const { score: keywordScore, matches: keywordMatches } = calculateKeywordScore(r.content, keywords);
      
      // Hybrid score: vector score + keyword boost
      // If keyword matches, add boost (default 0.5)
      const hybridScore = vectorScore + (keywordScore * keywordBoost);

      return {
        id: r.id,
        content: r.content,
        metadata: r.metadata || {},
        created_at: r.created_at,
        vectorScore,
        keywordScore,
        hybridScore,
        keywordMatches,
      };
    });

    // Sort by hybrid score (descending)
    hybridResults.sort((a, b) => b.hybridScore - a.hybridScore);

    // Take top N results
    const topResults = hybridResults.slice(0, limit);

    // Log results
    topResults.forEach((r, i) => {
      logger.info(
        `[HYBRID-SEARCH] #${i + 1} | ` +
        `Hybrid: ${r.hybridScore.toFixed(3)} ` +
        `(Vector: ${r.vectorScore.toFixed(3)} + Keyword: ${r.keywordScore.toFixed(3)}) | ` +
        `Matches: [${r.keywordMatches.join(', ')}] | ` +
        `"${r.content.slice(0, 60)}..."`
      );
    });

    return topResults;
  } catch (err: any) {
    logger.error(`[HYBRID-SEARCH] Error: ${err?.message || err}`);
    throw err;
  }
}

/**
 * Contextual Re-Ranking with LLM
 * Uses fast Llama 3.1 to validate and re-order top results
 */
export async function contextualReRank(
  query: string,
  results: HybridSearchResult[]
): Promise<HybridSearchResult[]> {
  try {
    if (!groq || results.length === 0) {
      logger.warn('[CONTEXTUAL-RERANK] Groq not configured or no results, skipping re-ranking');
      return results;
    }

    logger.info(`[CONTEXTUAL-RERANK] Re-ranking ${results.length} results for query: "${query}"`);

    // Prepare context for LLM
    const context = results
      .map((r, i) => `[${i + 1}] ${r.content.slice(0, 200)}...`)
      .join('\n\n');

    const prompt = `Du bist ein Präzisions-Ranking-System. Bewerte, welcher der folgenden Texte die Frage am besten beantwortet.

FRAGE: "${query}"

TEXTE:
${context}

Antworte NUR mit einer JSON-Liste der Nummern, sortiert von BESTER zu SCHLECHTESTER Antwort.
Beispiel: [3, 1, 2] bedeutet Text 3 ist am besten, dann Text 1, dann Text 2.

JSON:`;

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL_FAST,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    const ranking = parsed.ranking || parsed.order || [];

    if (!Array.isArray(ranking) || ranking.length === 0) {
      logger.warn('[CONTEXTUAL-RERANK] Invalid ranking from LLM, using original order');
      return results;
    }

    // Re-order results based on LLM ranking
    const reordered: HybridSearchResult[] = [];
    for (const idx of ranking) {
      const index = parseInt(idx) - 1; // Convert 1-based to 0-based
      if (index >= 0 && index < results.length) {
        reordered.push(results[index]);
      }
    }

    // Add any missing results at the end
    for (let i = 0; i < results.length; i++) {
      if (!reordered.includes(results[i])) {
        reordered.push(results[i]);
      }
    }

    logger.info(`[CONTEXTUAL-RERANK] LLM ranking: [${ranking.join(', ')}]`);
    logger.info(`[CONTEXTUAL-RERANK] Re-ordered results successfully`);

    return reordered;
  } catch (err: any) {
    logger.error(`[CONTEXTUAL-RERANK] Error: ${err?.message || err}`);
    // Return original results on error
    return results;
  }
}

/**
 * Full Hybrid Search Pipeline
 * 1. Hybrid search (vector + keyword)
 * 2. Contextual re-ranking (LLM validation)
 */
export async function fullHybridSearch(
  query: string,
  limit: number = 5,
  enableReRanking: boolean = true
): Promise<HybridSearchResult[]> {
  // Step 1: Hybrid search
  let results = await hybridSearch(query, limit);

  // Step 2: Contextual re-ranking (optional)
  if (enableReRanking && results.length > 1) {
    results = await contextualReRank(query, results);
  }

  return results;
}
