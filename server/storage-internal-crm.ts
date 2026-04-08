/**
 * ============================================================================
 * ARAS COMMAND CENTER - INTERNAL CRM STORAGE LAYER
 * ============================================================================
 * Datenbank-Operationen für das interne CRM-System
 * NUR für admin/staff zugänglich
 * ============================================================================
 */

import { db } from "./db";
import { 
  internalCompanies, 
  internalContacts, 
  internalDeals, 
  internalTasks,
  internalCallLogs,
  internalNotes,
  type InternalCompany,
  type InsertInternalCompany,
  type InternalContact,
  type InsertInternalContact,
  type InternalDeal,
  type InsertInternalDeal,
  type InternalTask,
  type InsertInternalTask,
  type InternalCallLog,
  type InsertInternalCallLog,
  type InternalNote,
  type InsertInternalNote
} from "@shared/schema";
import { eq, desc, and, or, like, gte, lte, sql } from "drizzle-orm";

// ============================================================================
// COMPANIES
// ============================================================================

export async function getAllCompanies(): Promise<InternalCompany[]> {
  return await db.select().from(internalCompanies).orderBy(desc(internalCompanies.createdAt));
}

export async function getCompanyById(id: string): Promise<InternalCompany | undefined> {
  const [company] = await db.select().from(internalCompanies).where(eq(internalCompanies.id, id));
  return company;
}

export async function createCompany(data: InsertInternalCompany): Promise<InternalCompany> {
  const [company] = await db.insert(internalCompanies).values(data).returning();
  return company;
}

export async function updateCompany(id: string, data: Partial<InsertInternalCompany>): Promise<InternalCompany | undefined> {
  const [company] = await db
    .update(internalCompanies)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(internalCompanies.id, id))
    .returning();
  return company;
}

export async function deleteCompany(id: string): Promise<boolean> {
  const result = await db.delete(internalCompanies).where(eq(internalCompanies.id, id));
  return result.rowCount > 0;
}

export async function searchCompanies(query: string): Promise<InternalCompany[]> {
  return await db
    .select()
    .from(internalCompanies)
    .where(
      or(
        like(internalCompanies.name, `%${query}%`),
        like(internalCompanies.website, `%${query}%`),
        like(internalCompanies.industry, `%${query}%`)
      )
    )
    .orderBy(desc(internalCompanies.createdAt));
}

// ============================================================================
// CONTACTS
// ============================================================================

export async function getAllContacts(): Promise<InternalContact[]> {
  return await db.select().from(internalContacts).orderBy(desc(internalContacts.createdAt));
}

export async function getContactById(id: string): Promise<InternalContact | undefined> {
  const [contact] = await db.select().from(internalContacts).where(eq(internalContacts.id, id));
  return contact;
}

export async function getContactsByCompany(companyId: string): Promise<InternalContact[]> {
  return await db
    .select()
    .from(internalContacts)
    .where(eq(internalContacts.companyId, companyId))
    .orderBy(desc(internalContacts.createdAt));
}

export async function createContact(data: InsertInternalContact): Promise<InternalContact> {
  const [contact] = await db.insert(internalContacts).values(data).returning();
  return contact;
}

export async function updateContact(id: string, data: Partial<InsertInternalContact>): Promise<InternalContact | undefined> {
  const [contact] = await db
    .update(internalContacts)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(internalContacts.id, id))
    .returning();
  return contact;
}

export async function deleteContact(id: string): Promise<boolean> {
  const result = await db.delete(internalContacts).where(eq(internalContacts.id, id));
  return result.rowCount > 0;
}

export async function searchContacts(query: string): Promise<InternalContact[]> {
  return await db
    .select()
    .from(internalContacts)
    .where(
      or(
        like(internalContacts.firstName, `%${query}%`),
        like(internalContacts.lastName, `%${query}%`),
        like(internalContacts.email, `%${query}%`),
        like(internalContacts.phone, `%${query}%`)
      )
    )
    .orderBy(desc(internalContacts.createdAt));
}

export async function findContactByPhone(phone: string): Promise<InternalContact | undefined> {
  const [contact] = await db.select().from(internalContacts).where(eq(internalContacts.phone, phone));
  return contact;
}

// ============================================================================
// DEALS
// ============================================================================

export async function getAllDeals(): Promise<InternalDeal[]> {
  return await db.select().from(internalDeals).orderBy(desc(internalDeals.createdAt));
}

export async function getDealById(id: string): Promise<InternalDeal | undefined> {
  const [deal] = await db.select().from(internalDeals).where(eq(internalDeals.id, id));
  return deal;
}

export async function getDealsByStage(stage: string): Promise<InternalDeal[]> {
  return await db
    .select()
    .from(internalDeals)
    .where(eq(internalDeals.stage, stage))
    .orderBy(desc(internalDeals.createdAt));
}

export async function getDealsByContact(contactId: string): Promise<InternalDeal[]> {
  return await db
    .select()
    .from(internalDeals)
    .where(eq(internalDeals.contactId, contactId))
    .orderBy(desc(internalDeals.createdAt));
}

export async function createDeal(data: InsertInternalDeal): Promise<InternalDeal> {
  const [deal] = await db.insert(internalDeals).values(data).returning();
  return deal;
}

export async function updateDeal(id: string, data: Partial<InsertInternalDeal>): Promise<InternalDeal | undefined> {
  const [deal] = await db
    .update(internalDeals)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(internalDeals.id, id))
    .returning();
  return deal;
}

export async function deleteDeal(id: string): Promise<boolean> {
  const result = await db.delete(internalDeals).where(eq(internalDeals.id, id));
  return result.rowCount > 0;
}

// Pipeline Stats
export async function getDealStats() {
  const stages = ['IDEA', 'CONTACTED', 'NEGOTIATION', 'COMMITTED', 'CLOSED_WON', 'CLOSED_LOST'];
  const stats: any = {};
  
  for (const stage of stages) {
    const deals = await getDealsByStage(stage);
    const totalValue = deals.reduce((sum, deal) => sum + (deal.value || 0), 0);
    stats[stage] = {
      count: deals.length,
      value: totalValue
    };
  }
  
  return stats;
}

// ============================================================================
// TASKS
// ============================================================================

export async function getAllTasks(): Promise<InternalTask[]> {
  return await db.select().from(internalTasks).orderBy(desc(internalTasks.createdAt));
}

export async function getTaskById(id: string): Promise<InternalTask | undefined> {
  const [task] = await db.select().from(internalTasks).where(eq(internalTasks.id, id));
  return task;
}

export async function getTasksByStatus(status: string): Promise<InternalTask[]> {
  return await db
    .select()
    .from(internalTasks)
    .where(eq(internalTasks.status, status))
    .orderBy(internalTasks.dueDate);
}

export async function getTasksByContact(contactId: string): Promise<InternalTask[]> {
  return await db
    .select()
    .from(internalTasks)
    .where(eq(internalTasks.relatedContactId, contactId))
    .orderBy(internalTasks.dueDate);
}

export async function getTasksDueToday(): Promise<InternalTask[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  return await db
    .select()
    .from(internalTasks)
    .where(
      and(
        gte(internalTasks.dueDate, today),
        lte(internalTasks.dueDate, tomorrow)
      )
    )
    .orderBy(internalTasks.dueDate);
}

export async function createTask(data: InsertInternalTask): Promise<InternalTask> {
  const [task] = await db.insert(internalTasks).values(data).returning();
  return task;
}

export async function updateTask(id: string, data: Partial<InsertInternalTask>): Promise<InternalTask | undefined> {
  const [task] = await db
    .update(internalTasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(internalTasks.id, id))
    .returning();
  return task;
}

export async function deleteTask(id: string): Promise<boolean> {
  const result = await db.delete(internalTasks).where(eq(internalTasks.id, id));
  return result.rowCount > 0;
}

// ============================================================================
// CALL LOGS
// ============================================================================

export async function getAllCallLogs(): Promise<InternalCallLog[]> {
  return await db.select().from(internalCallLogs).orderBy(desc(internalCallLogs.timestamp));
}

export async function getCallLogById(id: string): Promise<InternalCallLog | undefined> {
  const [callLog] = await db.select().from(internalCallLogs).where(eq(internalCallLogs.id, id));
  return callLog;
}

export async function getCallLogsByContact(contactId: string): Promise<InternalCallLog[]> {
  return await db
    .select()
    .from(internalCallLogs)
    .where(eq(internalCallLogs.contactId, contactId))
    .orderBy(desc(internalCallLogs.timestamp));
}

export async function getRecentCallLogs(hours: number = 24): Promise<InternalCallLog[]> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - hours);
  
  return await db
    .select()
    .from(internalCallLogs)
    .where(gte(internalCallLogs.timestamp, cutoff))
    .orderBy(desc(internalCallLogs.timestamp));
}

export async function createCallLog(data: InsertInternalCallLog): Promise<InternalCallLog> {
  const [callLog] = await db.insert(internalCallLogs).values(data).returning();
  return callLog;
}

export async function updateCallLog(id: string, data: Partial<InsertInternalCallLog>): Promise<InternalCallLog | undefined> {
  const [callLog] = await db
    .update(internalCallLogs)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(internalCallLogs.id, id))
    .returning();
  return callLog;
}

// ============================================================================
// NOTES
// ============================================================================

export async function getNotesByContact(contactId: string): Promise<InternalNote[]> {
  return await db
    .select()
    .from(internalNotes)
    .where(eq(internalNotes.contactId, contactId))
    .orderBy(desc(internalNotes.createdAt));
}

export async function getNotesByDeal(dealId: string): Promise<InternalNote[]> {
  return await db
    .select()
    .from(internalNotes)
    .where(eq(internalNotes.dealId, dealId))
    .orderBy(desc(internalNotes.createdAt));
}

export async function createNote(data: InsertInternalNote): Promise<InternalNote> {
  const [note] = await db.insert(internalNotes).values(data).returning();
  return note;
}

export async function deleteNote(id: string): Promise<boolean> {
  const result = await db.delete(internalNotes).where(eq(internalNotes.id, id));
  return result.rowCount > 0;
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export async function getDashboardStats() {
  const [
    totalCompanies,
    totalContacts,
    activeDeals,
    tasksDueToday,
    recentCalls
  ] = await Promise.all([
    db.select({ count: sql<number>`count(*)::int` }).from(internalCompanies),
    db.select({ count: sql<number>`count(*)::int` }).from(internalContacts),
    db.select({ count: sql<number>`count(*)::int` }).from(internalDeals)
      .where(sql`stage NOT IN ('CLOSED_WON', 'CLOSED_LOST')`),
    getTasksDueToday(),
    getRecentCallLogs(24)
  ]);
  
  const dealStats = await getDealStats();
  
  return {
    companies: totalCompanies[0].count,
    contacts: totalContacts[0].count,
    activeDeals: activeDeals[0].count,
    tasksDueToday: tasksDueToday.length,
    recentCalls: recentCalls.length,
    pipeline: dealStats
  };
}
