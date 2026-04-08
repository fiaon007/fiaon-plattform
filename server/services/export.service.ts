// ============================================================================
// ARAS Command Center - Export Service
// ============================================================================
// Async export job system for CSV/JSON data exports
// ============================================================================

import { db } from "../db";
import { 
  exportJobs, 
  users, 
  leads, 
  callLogs, 
  n8nEmailLogs,
  contacts,
  campaigns
} from "@shared/schema";
import { eq, desc, and, gte, lte, like, or, sql } from "drizzle-orm";
import { logger } from "../logger";

type ExportableEntity = "users" | "leads" | "calls" | "emails" | "contacts" | "campaigns";

interface ExportFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  search?: string;
  plan?: string;
}

class ExportService {
  // Create export job
  async createExportJob(
    userId: string,
    entityType: ExportableEntity,
    filters: ExportFilters = {},
    format: "csv" | "json" = "csv"
  ) {
    const [job] = await db
      .insert(exportJobs)
      .values({
        userId,
        entityType,
        filters,
        format,
        status: "pending",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      })
      .returning();

    logger.info("[EXPORT] Created export job", { jobId: job.id, entityType, format });

    // Process job async
    this.processExportJob(job.id).catch((err) => {
      logger.error("[EXPORT] Async job processing failed:", err);
    });

    return job;
  }

  // Process export job
  async processExportJob(jobId: string) {
    try {
      // Set status to processing
      await db
        .update(exportJobs)
        .set({ status: "processing", startedAt: new Date() })
        .where(eq(exportJobs.id, jobId));

      const [job] = await db
        .select()
        .from(exportJobs)
        .where(eq(exportJobs.id, jobId));

      if (!job) throw new Error("Job not found");

      logger.info("[EXPORT] Processing job", { jobId, entityType: job.entityType });

      // Fetch data
      const data = await this.fetchDataForExport(
        job.entityType as ExportableEntity,
        (job.filters as ExportFilters) || {}
      );

      // Convert to CSV/JSON
      let content: string;
      let mimeType: string;

      if (job.format === "csv") {
        content = this.toCSV(data);
        mimeType = "text/csv";
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = "application/json";
      }

      // Store as data URL (for simplicity - production would use S3/R2)
      const fileUrl = `data:${mimeType};base64,${Buffer.from(content).toString("base64")}`;

      // Complete job
      await db
        .update(exportJobs)
        .set({
          status: "completed",
          totalRows: data.length,
          processedRows: data.length,
          fileUrl,
          completedAt: new Date(),
        })
        .where(eq(exportJobs.id, jobId));

      logger.info("[EXPORT] Job completed", { jobId, rows: data.length });

    } catch (error: any) {
      logger.error(`[EXPORT] Job ${jobId} failed:`, error);
      await db
        .update(exportJobs)
        .set({
          status: "failed",
          errorMessage: error.message || "Unknown error",
        })
        .where(eq(exportJobs.id, jobId));
    }
  }

  // Fetch data for export
  private async fetchDataForExport(
    entityType: ExportableEntity,
    filters: ExportFilters
  ): Promise<any[]> {
    switch (entityType) {
      case "users":
        return this.fetchUsersForExport(filters);
      case "leads":
        return this.fetchLeadsForExport(filters);
      case "calls":
        return this.fetchCallsForExport(filters);
      case "emails":
        return this.fetchEmailsForExport(filters);
      case "contacts":
        return this.fetchContactsForExport(filters);
      case "campaigns":
        return this.fetchCampaignsForExport(filters);
      default:
        throw new Error(`Unknown entity type: ${entityType}`);
    }
  }

  // USERS - NO PASSWORDS, NO TOKENS
  private async fetchUsersForExport(filters: ExportFilters) {
    const conditions: any[] = [];
    
    if (filters.plan) {
      conditions.push(eq(users.subscriptionPlan, filters.plan));
    }
    if (filters.status) {
      conditions.push(eq(users.subscriptionStatus, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(users.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(users.createdAt, new Date(filters.dateTo)));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(users.email, `%${filters.search}%`),
          like(users.username, `%${filters.search}%`),
          like(users.company, `%${filters.search}%`)
        )
      );
    }

    const query = db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        company: users.company,
        phone: users.phone,
        industry: users.industry,
        jobRole: users.jobRole,
        subscriptionPlan: users.subscriptionPlan,
        subscriptionStatus: users.subscriptionStatus,
        userRole: users.userRole,
        aiMessagesUsed: users.aiMessagesUsed,
        voiceCallsUsed: users.voiceCallsUsed,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // LEADS
  private async fetchLeadsForExport(filters: ExportFilters) {
    const conditions: any[] = [];
    
    if (filters.status) {
      conditions.push(eq(leads.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(leads.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(leads.createdAt, new Date(filters.dateTo)));
    }

    const query = db
      .select({
        id: leads.id,
        userId: leads.userId,
        name: leads.name,
        email: leads.email,
        phone: leads.phone,
        company: leads.company,
        status: leads.status,
        notes: leads.notes,
        createdAt: leads.createdAt,
        updatedAt: leads.updatedAt,
      })
      .from(leads)
      .orderBy(desc(leads.createdAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // CALLS - No recordings/sensitive data
  private async fetchCallsForExport(filters: ExportFilters) {
    const conditions: any[] = [];
    
    if (filters.status) {
      conditions.push(eq(callLogs.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(callLogs.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(callLogs.createdAt, new Date(filters.dateTo)));
    }

    const query = db
      .select({
        id: callLogs.id,
        userId: callLogs.userId,
        phoneNumber: callLogs.phoneNumber,
        contactName: callLogs.contactName,
        status: callLogs.status,
        duration: callLogs.duration,
        createdAt: callLogs.createdAt,
      })
      .from(callLogs)
      .orderBy(desc(callLogs.createdAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // EMAILS
  private async fetchEmailsForExport(filters: ExportFilters) {
    const conditions: any[] = [];
    
    if (filters.status) {
      conditions.push(eq(n8nEmailLogs.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(n8nEmailLogs.sentAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(n8nEmailLogs.sentAt, new Date(filters.dateTo)));
    }

    const query = db
      .select({
        id: n8nEmailLogs.id,
        recipient: n8nEmailLogs.recipient,
        recipientName: n8nEmailLogs.recipientName,
        subject: n8nEmailLogs.subject,
        status: n8nEmailLogs.status,
        workflowId: n8nEmailLogs.workflowId,
        workflowName: n8nEmailLogs.workflowName,
        sentAt: n8nEmailLogs.sentAt,
        createdAt: n8nEmailLogs.createdAt,
      })
      .from(n8nEmailLogs)
      .orderBy(desc(n8nEmailLogs.sentAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // CONTACTS
  private async fetchContactsForExport(filters: ExportFilters) {
    const conditions: any[] = [];
    
    if (filters.dateFrom) {
      conditions.push(gte(contacts.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(contacts.createdAt, new Date(filters.dateTo)));
    }

    const query = db
      .select({
        id: contacts.id,
        userId: contacts.userId,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        email: contacts.email,
        phone: contacts.phone,
        company: contacts.company,
        createdAt: contacts.createdAt,
      })
      .from(contacts)
      .orderBy(desc(contacts.createdAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // CAMPAIGNS
  private async fetchCampaignsForExport(filters: ExportFilters) {
    const conditions: any[] = [];
    
    if (filters.status) {
      conditions.push(eq(campaigns.status, filters.status));
    }
    if (filters.dateFrom) {
      conditions.push(gte(campaigns.createdAt, new Date(filters.dateFrom)));
    }
    if (filters.dateTo) {
      conditions.push(lte(campaigns.createdAt, new Date(filters.dateTo)));
    }

    const query = db
      .select({
        id: campaigns.id,
        userId: campaigns.userId,
        name: campaigns.name,
        status: campaigns.status,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .orderBy(desc(campaigns.createdAt));

    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  // Convert to CSV
  private toCSV(data: any[]): string {
    if (data.length === 0) return "";

    const headers = Object.keys(data[0]);
    const headerRow = headers.join(",");
    
    const rows = data.map(item => {
      return headers.map(header => {
        const value = item[header];
        if (value === null || value === undefined) return "";
        if (typeof value === "object") return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        if (typeof value === "string" && (value.includes(",") || value.includes('"') || value.includes("\n"))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(",");
    });

    return [headerRow, ...rows].join("\n");
  }

  // Get job status
  async getJobStatus(jobId: string) {
    const [job] = await db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.id, jobId));
    return job;
  }

  // Get user's jobs
  async getUserJobs(userId: string, limit = 20) {
    return db
      .select()
      .from(exportJobs)
      .where(eq(exportJobs.userId, userId))
      .orderBy(desc(exportJobs.createdAt))
      .limit(limit);
  }

  // Get all jobs (admin)
  async getAllJobs(limit = 50) {
    return db
      .select()
      .from(exportJobs)
      .orderBy(desc(exportJobs.createdAt))
      .limit(limit);
  }

  // Clean up expired jobs
  async cleanupExpiredJobs() {
    const result = await db
      .delete(exportJobs)
      .where(
        and(
          lte(exportJobs.expiresAt, new Date()),
          eq(exportJobs.status, "completed")
        )
      );
    
    logger.info("[EXPORT] Cleaned up expired jobs");
    return result;
  }
}

export const exportService = new ExportService();
