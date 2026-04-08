// ============================================================================
// ARAS Command Center - AI-Powered Global Search API
// ============================================================================
// Semantic search across all entities with AI understanding
// ============================================================================

import { Router } from "express";
import { searchService } from "../services/search.service";
import { requireAdmin } from "../middleware/admin";
import { logger } from "../logger";

const router = Router();

// ============================================================================
// GET /search - Global search with optional AI interpretation
// ============================================================================

router.get("/search", requireAdmin, async (req: any, res) => {
  try {
    const { q, limit, types, ai } = req.query;

    if (!q || typeof q !== "string" || q.length < 2) {
      return res.json({ results: [], searchTime: 0, total: 0 });
    }

    // Use AI search if explicitly enabled and query is long enough
    if (ai === "true" && q.length > 10) {
      const result = await searchService.searchWithAI(q, {
        limit: limit ? Number(limit) : 20,
      });
      return res.json(result);
    }

    // Basic search
    const result = await searchService.search(q, {
      limit: limit ? Number(limit) : 20,
      types: types ? String(types).split(",") : undefined,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("[SEARCH] Error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// ============================================================================
// POST /search - Global search (POST variant for complex queries)
// ============================================================================

router.post("/search", requireAdmin, async (req: any, res) => {
  try {
    const { query, limit, types, ai } = req.body;

    if (!query || query.length < 2) {
      return res.json({ results: [], searchTime: 0, total: 0 });
    }

    // Use AI search if enabled
    if (ai && query.length > 10) {
      const result = await searchService.searchWithAI(query, {
        limit: limit || 20,
      });
      return res.json(result);
    }

    // Basic search
    const result = await searchService.search(query, {
      limit: limit || 20,
      types,
    });

    res.json(result);
  } catch (error: any) {
    logger.error("[SEARCH] Error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// ============================================================================
// GET /search/suggestions - Get search suggestions
// ============================================================================

router.get("/search/suggestions", requireAdmin, async (req: any, res) => {
  try {
    const { q } = req.query;

    if (!q || (q as string).length < 2) {
      return res.json({ suggestions: [] });
    }

    const suggestions = await searchService.getSuggestions(q as string, 5);
    res.json({ suggestions });
  } catch (error: any) {
    logger.error("[SEARCH] Suggestions error:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

export default router;
