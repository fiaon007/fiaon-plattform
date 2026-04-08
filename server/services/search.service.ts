// ============================================================================
// ARAS Command Center - Search Service
// ============================================================================
// AI-powered global search across all entities
// ============================================================================

import { db } from "../db";
import { users, leads, contacts, callLogs, n8nEmailLogs, campaigns } from "@shared/schema";
import { or, ilike, desc, sql } from "drizzle-orm";
import { logger } from "../logger";

// ============================================================================
// Types
// ============================================================================

export interface SearchResult {
  id: string;
  type: "user" | "lead" | "contact" | "call" | "email" | "campaign";
  title: string;
  subtitle: string;
  description?: string;
  icon: string;
  color: string;
  url: string;
  score: number;
  metadata?: Record<string, any>;
}

export interface SearchResponse {
  results: SearchResult[];
  searchTime: number;
  total: number;
  aiInterpretation?: {
    intent: string;
    filters: any;
    searchTerms: string[];
  };
}

// ============================================================================
// Search Service Class
// ============================================================================

class SearchService {
  /**
   * Basic search across all entities
   */
  async search(query: string, options: { limit?: number; types?: string[] } = {}): Promise<SearchResponse> {
    const startTime = Date.now();
    const { limit = 20, types } = options;
    const searchTerm = `%${query}%`;

    const results: SearchResult[] = [];

    try {
      // Parallel search across all entities
      const [userResults, leadResults, contactResults, callResults, emailResults] = await Promise.all([
        // Users
        (!types || types.includes("user")) ? db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            company: users.company,
            subscriptionPlan: users.subscriptionPlan,
            subscriptionStatus: users.subscriptionStatus,
          })
          .from(users)
          .where(or(
            ilike(users.email, searchTerm),
            ilike(users.username, searchTerm),
            ilike(users.firstName, searchTerm),
            ilike(users.lastName, searchTerm),
            ilike(users.company, searchTerm),
          ))
          .limit(10) : [],

        // Leads
        (!types || types.includes("lead")) ? db
          .select({
            id: leads.id,
            name: leads.name,
            email: leads.email,
            phone: leads.phone,
            company: leads.company,
            status: leads.status,
          })
          .from(leads)
          .where(or(
            ilike(leads.name, searchTerm),
            ilike(leads.email, searchTerm),
            ilike(leads.company, searchTerm),
            ilike(leads.phone, searchTerm),
          ))
          .limit(10) : [],

        // Contacts
        (!types || types.includes("contact")) ? db
          .select({
            id: contacts.id,
            firstName: contacts.firstName,
            lastName: contacts.lastName,
            email: contacts.email,
            phone: contacts.phone,
            company: contacts.company,
          })
          .from(contacts)
          .where(or(
            ilike(contacts.firstName, searchTerm),
            ilike(contacts.lastName, searchTerm),
            ilike(contacts.email, searchTerm),
            ilike(contacts.company, searchTerm),
            ilike(contacts.phone, searchTerm),
          ))
          .limit(10) : [],

        // Calls
        (!types || types.includes("call")) ? db
          .select({
            id: callLogs.id,
            phoneNumber: callLogs.phoneNumber,
            contactName: callLogs.contactName,
            status: callLogs.status,
            duration: callLogs.duration,
            createdAt: callLogs.createdAt,
          })
          .from(callLogs)
          .where(or(
            ilike(callLogs.phoneNumber, searchTerm),
            ilike(callLogs.contactName, searchTerm),
          ))
          .orderBy(desc(callLogs.createdAt))
          .limit(10) : [],

        // Emails
        (!types || types.includes("email")) ? db
          .select({
            id: n8nEmailLogs.id,
            recipient: n8nEmailLogs.recipient,
            recipientName: n8nEmailLogs.recipientName,
            subject: n8nEmailLogs.subject,
            status: n8nEmailLogs.status,
            sentAt: n8nEmailLogs.sentAt,
          })
          .from(n8nEmailLogs)
          .where(or(
            ilike(n8nEmailLogs.recipient, searchTerm),
            ilike(n8nEmailLogs.recipientName, searchTerm),
            ilike(n8nEmailLogs.subject, searchTerm),
          ))
          .orderBy(desc(n8nEmailLogs.sentAt))
          .limit(10) : [],
      ]);

      // Format user results
      userResults.forEach((u: any) => {
        const name = `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.username;
        results.push({
          id: u.id,
          type: "user",
          title: name,
          subtitle: u.email,
          description: u.company || undefined,
          icon: "User",
          color: "#FF6A00",
          url: `/admin-dashboard?selected=${u.id}`,
          score: this.calculateScore(query, [u.email, u.username, u.firstName, u.lastName, u.company]),
          metadata: { plan: u.subscriptionPlan, status: u.subscriptionStatus },
        });
      });

      // Format lead results
      leadResults.forEach((l: any) => {
        results.push({
          id: String(l.id),
          type: "lead",
          title: l.name || l.email || "Unknown Lead",
          subtitle: l.company || l.email || "",
          description: l.status ? `Status: ${l.status}` : undefined,
          icon: "TrendingUp",
          color: "#8B5CF6",
          url: `/admin-dashboard/leads?selected=${l.id}`,
          score: this.calculateScore(query, [l.name, l.email, l.company]),
        });
      });

      // Format contact results
      contactResults.forEach((c: any) => {
        const name = `${c.firstName || ""} ${c.lastName || ""}`.trim();
        results.push({
          id: c.id,
          type: "contact",
          title: name || c.email || "Unknown Contact",
          subtitle: c.email || c.phone || "",
          description: c.company || undefined,
          icon: "Building2",
          color: "#06B6D4",
          url: `/admin-dashboard/contacts?selected=${c.id}`,
          score: this.calculateScore(query, [c.firstName, c.lastName, c.email, c.company]),
        });
      });

      // Format call results
      callResults.forEach((c: any) => {
        results.push({
          id: String(c.id),
          type: "call",
          title: c.contactName || c.phoneNumber || "Unknown",
          subtitle: c.phoneNumber || "",
          description: c.status ? `${c.status} - ${c.duration || 0}s` : undefined,
          icon: "Phone",
          color: "#EF4444",
          url: `/admin-dashboard/calls?selected=${c.id}`,
          score: this.calculateScore(query, [c.contactName, c.phoneNumber]),
        });
      });

      // Format email results
      emailResults.forEach((e: any) => {
        results.push({
          id: String(e.id),
          type: "email",
          title: e.recipientName || e.recipient || "Unknown",
          subtitle: e.subject || "",
          description: e.status || undefined,
          icon: "Mail",
          color: "#10B981",
          url: `/admin-dashboard/emails?selected=${e.id}`,
          score: this.calculateScore(query, [e.recipient, e.recipientName, e.subject]),
        });
      });

      // Sort by score (highest first)
      results.sort((a, b) => b.score - a.score);

      return {
        results: results.slice(0, limit),
        searchTime: Date.now() - startTime,
        total: results.length,
      };
    } catch (error: any) {
      logger.error("[SEARCH] Error:", error);
      return {
        results: [],
        searchTime: Date.now() - startTime,
        total: 0,
      };
    }
  }

  /**
   * AI-powered natural language search
   */
  async searchWithAI(query: string, options: { limit?: number } = {}): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      if (!process.env.GOOGLE_GEMINI_API_KEY) {
        // Fallback to basic search
        return this.search(query, options);
      }

      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Du bist ein Such-Interpreter für ein CRM Dashboard.

Interpretiere diese Suchanfrage: "${query}"

Antworte NUR in JSON (kein Markdown):
{
  "intent": "Was der User sucht (kurz, max 50 Zeichen)",
  "searchTerms": ["extrahierte", "suchbegriffe"],
  "filters": {
    "types": ["user", "lead", "contact", "call", "email"] oder null für alle,
    "status": "active|canceled|trial|completed|failed" oder null
  }
}

Beispiele:
- "alle user die letzte woche gecancelled haben" → types: ["user"], searchTerms: ["canceled"]
- "calls von max müller" → types: ["call"], searchTerms: ["max", "müller"]
- "emails an test@example.com" → types: ["email"], searchTerms: ["test@example.com"]`;

      // Race between AI and timeout
      const aiResult = await Promise.race([
        model.generateContent(prompt),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 500)),
      ]);

      if (!aiResult) {
        // AI timed out, use basic search
        logger.info("[SEARCH] AI timeout, using basic search");
        return this.search(query, options);
      }

      const text = (aiResult as any).response.text()
        .replace(/```json\n?/g, "")
        .replace(/```\n?/g, "")
        .trim();

      const aiInterpretation = JSON.parse(text);
      
      // Search with interpreted terms
      const searchQuery = aiInterpretation.searchTerms?.length > 0 
        ? aiInterpretation.searchTerms.join(" ")
        : query;

      const searchResults = await this.search(searchQuery, {
        limit: options.limit,
        types: aiInterpretation.filters?.types,
      });

      return {
        ...searchResults,
        aiInterpretation,
        searchTime: Date.now() - startTime,
      };

    } catch (error: any) {
      logger.warn("[SEARCH] AI interpretation failed:", error.message);
      // Fallback to basic search
      return this.search(query, options);
    }
  }

  /**
   * Calculate relevance score for a result
   */
  private calculateScore(query: string, fields: (string | null | undefined)[]): number {
    const q = query.toLowerCase();
    let score = 0;

    for (const field of fields) {
      if (!field) continue;
      const f = field.toLowerCase();
      
      if (f === q) score += 100; // Exact match
      else if (f.startsWith(q)) score += 75; // Starts with
      else if (f.includes(q)) score += 50; // Contains
      
      // Bonus for word match
      const words = f.split(/\s+/);
      for (const word of words) {
        if (word === q) score += 25;
        else if (word.startsWith(q)) score += 15;
      }
    }

    return score;
  }

  /**
   * Get search suggestions based on partial query
   */
  async getSuggestions(query: string, limit = 5): Promise<string[]> {
    if (query.length < 2) return [];

    try {
      const searchTerm = `${query}%`;
      
      const [userSuggestions, leadSuggestions] = await Promise.all([
        db
          .select({ value: users.email })
          .from(users)
          .where(ilike(users.email, searchTerm))
          .limit(limit),
        db
          .select({ value: leads.name })
          .from(leads)
          .where(ilike(leads.name, searchTerm))
          .limit(limit),
      ]);

      const suggestions = [
        ...userSuggestions.map(s => s.value),
        ...leadSuggestions.map(s => s.value),
      ].filter(Boolean) as string[];

      return Array.from(new Set(suggestions)).slice(0, limit);
    } catch (error) {
      logger.error("[SEARCH] Suggestions error:", error);
      return [];
    }
  }
}

export const searchService = new SearchService();
