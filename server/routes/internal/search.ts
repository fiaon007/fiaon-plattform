/**
 * ============================================================================
 * ARAS COMMAND CENTER - GLOBAL SEARCH API
 * ============================================================================
 * Server-side search across all internal CRM entities
 * Safe, fast, no PII leakage
 * ============================================================================
 */

import { Router } from "express";
import { db } from "../../db";
import { 
  internalCompanies, 
  internalContacts, 
  internalDeals, 
  internalTasks,
  internalCallLogs 
} from "@shared/schema";
import { or, like, desc, sql } from "drizzle-orm";
import { requireInternal } from "../../middleware/role-guard";

const router = Router();

// Search result type
interface SearchHit {
  type: 'contact' | 'company' | 'deal' | 'task' | 'call';
  id: string;
  title: string;
  subtitle?: string;
  meta?: {
    stage?: string;
    status?: string;
    dueDate?: string;
    updatedAt?: string;
    value?: number;
  };
  route: string;
}

/**
 * GET /api/internal/search
 * Global search across all CRM entities
 * 
 * Query params:
 * - q: search query (min 2 chars)
 * - limit: max results per type (default 5, max 10)
 * - types: optional CSV filter (contacts,companies,deals,tasks,calls)
 */
router.get("/", requireInternal, async (req, res) => {
  try {
    const { q, limit = "5", types } = req.query;
    
    // Validate query
    const query = String(q || "").trim();
    if (query.length < 2) {
      return res.status(400).json({ 
        error: "Query must be at least 2 characters",
        results: [],
        totalResults: 0
      });
    }

    // Parse limit (cap at 10 per type)
    const maxPerType = Math.min(Math.max(1, parseInt(String(limit), 10) || 5), 10);

    // Parse types filter
    const typeFilter = types 
      ? String(types).split(",").map(t => t.trim().toLowerCase())
      : ["contacts", "companies", "deals", "tasks", "calls"];

    const searchPattern = `%${query}%`;
    const results: SearchHit[] = [];

    // Search Contacts
    if (typeFilter.includes("contacts")) {
      const contacts = await db
        .select({
          id: internalContacts.id,
          firstName: internalContacts.firstName,
          lastName: internalContacts.lastName,
          email: internalContacts.email,
          position: internalContacts.position,
          status: internalContacts.status,
          updatedAt: internalContacts.updatedAt,
        })
        .from(internalContacts)
        .where(
          or(
            like(internalContacts.firstName, searchPattern),
            like(internalContacts.lastName, searchPattern),
            like(internalContacts.email, searchPattern),
            like(internalContacts.position, searchPattern)
          )
        )
        .orderBy(desc(internalContacts.updatedAt))
        .limit(maxPerType);

      for (const c of contacts) {
        results.push({
          type: "contact",
          id: c.id,
          title: `${c.firstName} ${c.lastName}`,
          subtitle: c.position || c.email || undefined,
          meta: {
            status: c.status || undefined,
            updatedAt: c.updatedAt?.toISOString(),
          },
          route: `/internal/contacts?contactId=${c.id}`,
        });
      }
    }

    // Search Companies
    if (typeFilter.includes("companies")) {
      const companies = await db
        .select({
          id: internalCompanies.id,
          name: internalCompanies.name,
          industry: internalCompanies.industry,
          website: internalCompanies.website,
          updatedAt: internalCompanies.updatedAt,
        })
        .from(internalCompanies)
        .where(
          or(
            like(internalCompanies.name, searchPattern),
            like(internalCompanies.industry, searchPattern),
            like(internalCompanies.website, searchPattern)
          )
        )
        .orderBy(desc(internalCompanies.updatedAt))
        .limit(maxPerType);

      for (const c of companies) {
        results.push({
          type: "company",
          id: c.id,
          title: c.name,
          subtitle: c.industry || c.website || undefined,
          meta: {
            updatedAt: c.updatedAt?.toISOString(),
          },
          route: `/internal/companies?companyId=${c.id}`,
        });
      }
    }

    // Search Deals
    if (typeFilter.includes("deals")) {
      const deals = await db
        .select({
          id: internalDeals.id,
          title: internalDeals.title,
          stage: internalDeals.stage,
          value: internalDeals.value,
          updatedAt: internalDeals.updatedAt,
        })
        .from(internalDeals)
        .where(like(internalDeals.title, searchPattern))
        .orderBy(desc(internalDeals.updatedAt))
        .limit(maxPerType);

      for (const d of deals) {
        results.push({
          type: "deal",
          id: d.id,
          title: d.title,
          subtitle: d.stage || undefined,
          meta: {
            stage: d.stage || undefined,
            value: d.value || undefined,
            updatedAt: d.updatedAt?.toISOString(),
          },
          route: `/internal/deals?dealId=${d.id}`,
        });
      }
    }

    // Search Tasks
    if (typeFilter.includes("tasks")) {
      const tasks = await db
        .select({
          id: internalTasks.id,
          title: internalTasks.title,
          status: internalTasks.status,
          dueDate: internalTasks.dueDate,
          updatedAt: internalTasks.updatedAt,
        })
        .from(internalTasks)
        .where(like(internalTasks.title, searchPattern))
        .orderBy(desc(internalTasks.updatedAt))
        .limit(maxPerType);

      for (const t of tasks) {
        results.push({
          type: "task",
          id: t.id,
          title: t.title,
          subtitle: t.status || undefined,
          meta: {
            status: t.status || undefined,
            dueDate: t.dueDate?.toISOString(),
            updatedAt: t.updatedAt?.toISOString(),
          },
          route: `/internal/tasks?taskId=${t.id}`,
        });
      }
    }

    // Search Call Logs
    if (typeFilter.includes("calls")) {
      const calls = await db
        .select({
          id: internalCallLogs.id,
          phoneNumber: internalCallLogs.phoneNumber,
          summary: internalCallLogs.summary,
          outcome: internalCallLogs.outcome,
          timestamp: internalCallLogs.timestamp,
        })
        .from(internalCallLogs)
        .where(
          or(
            like(internalCallLogs.phoneNumber, searchPattern),
            like(internalCallLogs.summary, searchPattern),
            like(internalCallLogs.outcome, searchPattern)
          )
        )
        .orderBy(desc(internalCallLogs.timestamp))
        .limit(maxPerType);

      for (const c of calls) {
        // Truncate summary to avoid PII leakage
        const shortSummary = c.summary 
          ? c.summary.substring(0, 50) + (c.summary.length > 50 ? "…" : "")
          : undefined;
        
        results.push({
          type: "call",
          id: c.id,
          title: c.phoneNumber || "Unknown Number",
          subtitle: shortSummary || c.outcome || undefined,
          meta: {
            status: c.outcome || undefined,
            updatedAt: c.timestamp?.toISOString(),
          },
          route: `/internal/calls?callId=${c.id}`,
        });
      }
    }

    // Sort by relevance (exact matches first, then by update time)
    results.sort((a, b) => {
      const aExact = a.title.toLowerCase().includes(query.toLowerCase());
      const bExact = b.title.toLowerCase().includes(query.toLowerCase());
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      const aTime = a.meta?.updatedAt ? new Date(a.meta.updatedAt).getTime() : 0;
      const bTime = b.meta?.updatedAt ? new Date(b.meta.updatedAt).getTime() : 0;
      return bTime - aTime;
    });

    res.json({
      query,
      results,
      totalResults: results.length,
      searchedTypes: typeFilter,
    });

  } catch (error: any) {
    console.error("[INTERNAL-SEARCH] Error:", error.message);
    res.status(500).json({ 
      error: "Search temporarily unavailable",
      results: [],
      totalResults: 0
    });
  }
});

export default router;
