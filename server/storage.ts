import {
  users,
  leads,
  campaigns,
  chatMessages,
  chatSessions,
  voiceAgents,
  voiceTasks,
  callLogs,
  subscriptionPlans,
  usageTracking,
  twilioSettings,
  userTasks,
  mailInbound,
  type User,
  type UpsertUser,
  type Lead,
  type InsertLead,
  type Campaign,
  type InsertCampaign,
  type ChatMessage,
  type InsertChatMessage,
  type ChatSession,
  type InsertChatSession,
  type VoiceAgent,
  type CallLog,
  type SubscriptionPlan,
  type UsageTracking,
  type TwilioSettings,
  type InsertTwilioSettings,
  type UserTask,
  type InsertUserTask,
  type MailInbound,
} from "@shared/schema";
import { db } from "./db";
import { logger } from "./logger";
import { eq, desc, and, sql } from "drizzle-orm";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export interface IStorage {
  // Platform statistics
  getPlatformStats(): Promise<any>;
  
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; customerId?: string; subscriptionId?: string; paymentMethodId?: string; hasPaymentMethod?: boolean }): Promise<User>;
  startUserTrial(userId: string, trialData: { paymentMethodId: string; trialEndDate: string; hasPaymentMethod: boolean }): Promise<User>;
  updateUserProfile(userId: string, profileData: any): Promise<User>;
  updateUserThread(userId: string, threadId: string): Promise<User>;
  
  // Password Reset operations
  setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  getUserByPasswordResetTokenHash(tokenHash: string): Promise<User | undefined>;
  clearPasswordResetToken(userId: string): Promise<void>;
  markPasswordResetUsed(userId: string): Promise<void>;
  
  // Subscription operations
  getSubscriptionStatus(userId: string): Promise<any>;
  getSubscriptionPlan(planId: string): Promise<any>;
  getAllSubscriptionPlans(): Promise<any[]>;
  updateUserSubscription(userId: string, subscriptionData: any): Promise<void>;
  updateUserSubscriptionStatus(userId: string, status: string): Promise<void>;
  trackUsage(userId: string, type: string, description?: string): Promise<void>;
  checkUsageLimit(userId: string, type: string): Promise<{ allowed: boolean; message?: string; requiresPayment?: boolean; requiresUpgrade?: boolean }>;
  resetMonthlyUsage(userId: string): Promise<void>;
  getUsageHistory(userId: string): Promise<any[]>;
  
  // Lead operations
  getLeads(userId: string): Promise<Lead[]>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead>;
  deleteLead(id: number, userId: string): Promise<void>;
  importLeads(userId: string, csvData: any[]): Promise<Lead[]>;
  exportLeadsToCSV(leads: Lead[]): Promise<string>;
  
  // Campaign operations
  getCampaigns(userId: string): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign>;
  deleteCampaign(campaignId: number, userId: string): Promise<void>;
  
  // Chat session operations
  getChatSessions(userId: string): Promise<ChatSession[]>;
  createChatSession(session: InsertChatSession): Promise<ChatSession>;
  getActiveSession(userId: string): Promise<ChatSession | undefined>;
  setActiveSession(userId: string, sessionId: number): Promise<void>;
  archiveSession(sessionId: number): Promise<void>;
  updateChatSessionMetadata(sessionId: number, metadata: any): Promise<void>;
  getChatSessionById(sessionId: number): Promise<ChatSession | undefined>;
  
  // Chat message operations
  getChatMessages(userId: string, sessionId?: number): Promise<ChatMessage[]>;
  getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  updateChatMessage(messageId: number, updates: Partial<InsertChatMessage>): Promise<ChatMessage>;
  clearChatMessages(userId: string): Promise<void>;
  searchChatMessages(userId: string, query: string): Promise<ChatMessage[]>;
  
  // Voice agent operations
  getVoiceAgents(): Promise<VoiceAgent[]>;
  createVoiceAgent(agentData: any): Promise<VoiceAgent>;
  getVoiceAgentById(id: number): Promise<VoiceAgent | null>;
  updateVoiceAgent(id: number, updates: any): Promise<VoiceAgent>;
  deleteVoiceAgent(id: number): Promise<void>;
  
  // Call log operations
  getCallLogs(userId: string): Promise<CallLog[]>;
  createCallLog(callLog: any): Promise<CallLog>;
  
  // Token operations (deprecated - using subscription system)
  getTokenBalance(userId: string): Promise<number>;
  createTokenTransaction(transaction: any): Promise<any>;
  getTokenTransactions(userId: string): Promise<any[]>;
  updateTokenBalance(userId: string, amount: number): Promise<void>;
  addTokens(userId: string, amount: number): Promise<void>;
  
  // Analytics operations
  getDashboardAnalytics(userId: string): Promise<any>;
  getPerformanceAnalytics(userId: string, period: string): Promise<any>;
  
  // User settings operations
  getUserSettings(userId: string): Promise<any>;
  updateUserSettings(userId: string, settings: any): Promise<void>;
  
  // Twilio settings operations
  getTwilioSettings(userId: string): Promise<{ configured: boolean; accountSid?: string; phoneNumber?: string }>;
  getTwilioSettingsRaw(userId: string): Promise<{ accountSid: string; authToken: string; phoneNumber: string } | null>;
  saveTwilioSettings(userId: string, settings: { accountSid: string; authToken: string; phoneNumber: string }): Promise<void>;
  deleteTwilioSettings(userId: string): Promise<void>;
  
  // Call management operations
  updateCallLog(callId: number, updates: any): Promise<void>;
  storeCallMessage(callId: number, messageData: any): Promise<void>;
  getCallMessage(callId: string): Promise<any>;
  logCallInteraction(callId: string, interaction: any): Promise<void>;
  
  // Voice Task operations
  createVoiceTask(data: any): Promise<any>;
  getVoiceTaskById(id: number): Promise<any | null>;
  getVoiceTasksByUser(userId: string): Promise<any[]>;
  updateVoiceTask(id: number, updates: any): Promise<any>;
  deleteVoiceTask(id: number): Promise<void>;
  
  // Retell call log methods
  saveCallLog(data: {
    userId: string;
    phoneNumber: string;
    status: string;
    // New flexible fields
    provider?: string;
    callId?: string;
    purpose?: string;
    details?: string;
    contactName?: string;
    originalMessage?: string;
    // Legacy Retell fields (optional)
    retellCallId?: string;
    duration?: number | null;
    transcript?: string | null;
    customPrompt?: string | null;
    recordingUrl?: string | null;
    metadata?: any;
  }): Promise<number | null>;
  getCallLogByRetellId(retellCallId: string, userId: string): Promise<any>;
  getUserCallLogs(userId: string): Promise<any[]>;
  
  // User Data Sources (Knowledge Base)
  getUserDataSources(userId: string): Promise<any[]>;
  
  // User Tasks (Dashboard Operations)
  listUserTasks(userId: string, filters?: {
    status?: 'open' | 'done' | 'all';
    sourceType?: 'call' | 'space' | 'manual';
    sourceId?: string;
    includeDone?: boolean;
    limit?: number;
    sinceDays?: number;
  }): Promise<UserTask[]>;
  upsertUserTask(task: InsertUserTask): Promise<UserTask>;
  setTaskDone(userId: string, taskId: string, done: boolean): Promise<UserTask | null>;
  snoozeTask(userId: string, taskId: string, snoozedUntil: Date | null): Promise<UserTask | null>;
  createManualTask(userId: string, title: string, dueAt?: Date, priority?: 'low' | 'medium' | 'high'): Promise<UserTask>;
  getTaskByFingerprint(userId: string, fingerprint: string): Promise<UserTask | null>;
  
  // Mail Inbound (Gmail Intake)
  upsertInboundMail(payload: {
    source?: string;
    messageId: string;
    threadId?: string | null;
    mailbox?: string | null;
    fromEmail: string;
    fromName?: string | null;
    toEmails?: string[];
    ccEmails?: string[];
    subject?: string;
    snippet?: string;
    bodyText?: string;
    bodyHtml?: string;
    receivedAt: Date;
    labels?: string[];
    meta?: Record<string, any>;
  }): Promise<{ id: number; status: string; isNew: boolean }>;
  listInboundMail(options?: {
    status?: string;
    q?: string;
    limit?: number;
    cursor?: number;
  }): Promise<MailInbound[]>;
  getInboundMailById(id: number): Promise<MailInbound | null>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    console.log('[DB-DEBUG] Looking up user by ID:', id);
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      console.log('[DB-DEBUG] User lookup result:', user ? `Found: ${user.username}` : 'Not found');
      return user;
    } catch (error) {
      console.log('[DB-DEBUG] Database error in getUser:', error);
      throw error;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log('[DB-DEBUG] Looking up user by username:', username);
    try {
      const [user] = await db.select().from(users).where(eq(users.username, username));
      console.log('[DB-DEBUG] Username lookup result:', user ? `Found: ${user.id}` : 'Not found');
      return user;
    } catch (error) {
      console.log('[DB-DEBUG] Database error in getUserByUsername:', error);
      throw error;
    }
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log('[DB-DEBUG] Looking up user by email:', email);
    try {
      const [user] = await db.select().from(users).where(eq(users.email, email));
      console.log('[DB-DEBUG] Email lookup result:', user ? `Found: ${user.id}` : 'Not found');
      return user;
    } catch (error) {
      console.log('[DB-DEBUG] Database error in getUserByEmail:', error);
      throw error;
    }
  }

  async createUser(userData: UpsertUser): Promise<User> {
    console.log('[DB-DEBUG] Creating new user:', userData.username, 'ID:', userData.id);
    console.log('[DB-DEBUG] Full user data:', JSON.stringify(userData, null, 2));
    try {
      console.log('[DB-DEBUG] About to insert into database...');
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();
      console.log('[DB-DEBUG] User created successfully:', user.id);
      console.log('[DB-DEBUG] Returned user data:', JSON.stringify(user, null, 2));
      return user;
    } catch (error) {
      console.log('[DB-DEBUG] Database error in createUser:', error);
      console.log('[DB-DEBUG] Error details:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; customerId?: string; subscriptionId?: string; paymentMethodId?: string; hasPaymentMethod?: boolean }): Promise<User> {
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (stripeInfo.stripeCustomerId || stripeInfo.customerId) {
      updateData.stripeCustomerId = stripeInfo.stripeCustomerId || stripeInfo.customerId;
    }
    if (stripeInfo.subscriptionId !== undefined) {
      updateData.stripeSubscriptionId = stripeInfo.subscriptionId;
    }
    if (stripeInfo.paymentMethodId !== undefined) {
      updateData.stripePaymentMethodId = stripeInfo.paymentMethodId;
    }
    if (stripeInfo.hasPaymentMethod !== undefined) {
      updateData.hasPaymentMethod = stripeInfo.hasPaymentMethod;
    }

    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async startUserTrial(userId: string, trialData: { paymentMethodId: string; trialEndDate: string; hasPaymentMethod: boolean }): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        stripePaymentMethodId: trialData.paymentMethodId,
        trialStartDate: new Date(),
        trialEndDate: new Date(trialData.trialEndDate),
        hasPaymentMethod: trialData.hasPaymentMethod,
        subscriptionStatus: 'trialing',
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        subscriptionPlan: plan,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Lead operations
  async getLeads(userId: string): Promise<Lead[]> {
    return await db
      .select()
      .from(leads)
      .where(eq(leads.userId, userId))
      .orderBy(desc(leads.createdAt));
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const [newLead] = await db.insert(leads).values(lead).returning();
    return newLead;
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    const [updatedLead] = await db
      .update(leads)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(leads.id, id))
      .returning();
    return updatedLead;
  }



  // Campaign operations
  async getCampaigns(userId: string): Promise<Campaign[]> {
    return await db
      .select()
      .from(campaigns)
      .where(eq(campaigns.userId, userId))
      .orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign> {
    const [updatedCampaign] = await db
      .update(campaigns)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  // Chat session operations
  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.userId, userId))
      .orderBy(desc(chatSessions.updatedAt));
  }

  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    // First deactivate all other sessions for this user
    await db
      .update(chatSessions)
      .set({ isActive: false })
      .where(eq(chatSessions.userId, session.userId));

    const [chatSession] = await db
      .insert(chatSessions)
      .values({ ...session, isActive: true })
      .returning();
    return chatSession;
  }

  async getActiveSession(userId: string): Promise<ChatSession | undefined> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(and(
        eq(chatSessions.userId, userId),
        eq(chatSessions.isActive, true)
      ))
      .orderBy(desc(chatSessions.updatedAt));
    return session;
  }

  async setActiveSession(userId: string, sessionId: number): Promise<void> {
    // Deactivate all other sessions
    await db
      .update(chatSessions)
      .set({ isActive: false })
      .where(eq(chatSessions.userId, userId));

    // Activate the selected session
    await db
      .update(chatSessions)
      .set({ isActive: true })
      .where(eq(chatSessions.id, sessionId));
  }

  async updateChatSessionTitle(sessionId: number, title: string): Promise<void> {
    await db
      .update(chatSessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }

  async updateChatSessionMetadata(sessionId: number, metadata: any): Promise<void> {
    // NOTE: metadata column removed from schema - just update timestamp
    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.id, sessionId));
  }

  async getChatSessionById(sessionId: number): Promise<ChatSession | undefined> {
    const [session] = await db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.id, sessionId));
    return session;
  }

  async archiveSession(sessionId: number): Promise<void> {
    await db
      .update(chatSessions)
      .set({ isActive: false })
      .where(eq(chatSessions.id, sessionId));
  }

  // Chat message operations  
  async getChatMessages(userId: string, sessionId?: number): Promise<ChatMessage[]> {
    if (sessionId) {
      return await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.timestamp)
        .limit(50);
    }

    // Get messages from active session
    const activeSession = await this.getActiveSession(userId);
    if (!activeSession) {
      return [];
    }

    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, activeSession.id))
      .orderBy(chatMessages.timestamp)
      .limit(50);
  }

  async getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.timestamp)
      .limit(50);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async updateChatMessage(messageId: number, updates: Partial<InsertChatMessage>): Promise<ChatMessage> {
    const [updatedMessage] = await db
      .update(chatMessages)
      .set(updates)
      .where(eq(chatMessages.id, messageId))
      .returning();
    return updatedMessage;
  }

  async clearChatMessages(userId: string): Promise<void> {
    await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  }

  async searchChatMessages(userId: string, query: string): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(
        and(
          eq(chatMessages.userId, userId),
          sql`${chatMessages.message} ILIKE ${'%' + query + '%'}`
        )
      )
      .orderBy(desc(chatMessages.timestamp))
      .limit(50);
  }

  // Voice agent operations
  async getVoiceAgents(): Promise<VoiceAgent[]> {
    return await db
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.isActive, true));
  }

  async createVoiceAgent(agentData: any): Promise<VoiceAgent> {
    const [newAgent] = await db.insert(voiceAgents).values(agentData).returning();
    return newAgent;
  }

  async getVoiceAgentById(id: number): Promise<VoiceAgent | null> {
    const [agent] = await db
      .select()
      .from(voiceAgents)
      .where(eq(voiceAgents.id, id));
    return agent || null;
  }

  async updateVoiceAgent(id: number, updates: any): Promise<VoiceAgent> {
    const [updatedAgent] = await db
      .update(voiceAgents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(voiceAgents.id, id))
      .returning();
    return updatedAgent;
  }

  async deleteVoiceAgent(id: number): Promise<void> {
    await db
      .update(voiceAgents)
      .set({ isActive: false })
      .where(eq(voiceAgents.id, id));
  }

  // Call log operations

  // Voice Task operations
  async createVoiceTask(data: any): Promise<any> {
    const [task] = await db.insert(voiceTasks).values({
      ...data,
      status: data.status || 'pending',
      createdAt: new Date()
    }).returning();
    return task;
  }

  async getVoiceTaskById(id: number): Promise<any | null> {
    const [task] = await db
      .select()
      .from(voiceTasks)
      .where(eq(voiceTasks.id, id));
    return task || null;
  }

  async getVoiceTasksByUser(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(voiceTasks)
      .where(eq(voiceTasks.userId, userId))
      .orderBy(desc(voiceTasks.createdAt));
  }

  async updateVoiceTask(id: number, updates: any): Promise<any> {
    const [updated] = await db
      .update(voiceTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(voiceTasks.id, id))
      .returning();
    return updated;
  }

  async deleteVoiceTask(id: number): Promise<void> {
    await db.delete(voiceTasks).where(eq(voiceTasks.id, id));
  }
  async getCallLogs(userId: string): Promise<CallLog[]> {
    return await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.createdAt));
  }

  async createCallLog(callLog: any): Promise<CallLog> {
    const [newCallLog] = await db.insert(callLogs).values(callLog).returning();
    return newCallLog;
  }

  // Subscription operations
  async getSubscriptionStatus(userId: string): Promise<any> {
    const [user] = await db
      .select({
        subscriptionPlan: users.subscriptionPlan,
        subscriptionStatus: users.subscriptionStatus,
        aiMessagesUsed: users.aiMessagesUsed,
        voiceCallsUsed: users.voiceCallsUsed,
        monthlyResetDate: users.monthlyResetDate,
        subscriptionEndDate: users.subscriptionEndDate,
      })
      .from(users)
      .where(eq(users.id, userId));
    return user;
  }

  async getSubscriptionPlan(planId: string): Promise<any> {
    const [plan] = await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.id, planId));
    return plan;
  }

  async getAllSubscriptionPlans(): Promise<any[]> {
    return await db
      .select()
      .from(subscriptionPlans)
      .where(eq(subscriptionPlans.isActive, true))
      .orderBy(subscriptionPlans.price);
  }

  async trackUsage(userId: string, type: string, description?: string, amount: number = 1): Promise<void> {
    // Only log positive usage (not rollbacks)
    if (amount > 0) {
      await db.insert(usageTracking).values({
        userId,
        type,
        description,
      });
    }

    // Update user usage counters
    const updateData: any = { updatedAt: new Date() };
    
    console.log(`[TRACK-USAGE] userId=${userId}, type=${type}, amount=${amount}`);
    
    switch (type) {
      case 'ai_message':
        updateData.aiMessagesUsed = sql`GREATEST(0, ${users.aiMessagesUsed} + ${amount})`;
        break;
      case 'voice_call':
        updateData.voiceCallsUsed = sql`GREATEST(0, ${users.voiceCallsUsed} + ${amount})`;
        break;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
      
    console.log(`[TRACK-USAGE] Counter updated successfully`);
  }

  async checkUsageLimit(userId: string, type: string): Promise<{ allowed: boolean; message?: string; requiresPayment?: boolean; requiresUpgrade?: boolean }> {
    console.log(`[CHECK-LIMIT-DB] Starting check for user=${userId}, type=${type}`);
    
    const userSub = await this.getSubscriptionStatus(userId);
    if (!userSub) {
      console.log(`[CHECK-LIMIT-DB] ERROR: Subscription not found for user=${userId}`);
      return { allowed: false, message: "Subscription not found" };
    }
    
    console.log(`[CHECK-LIMIT-DB] User subscription: plan=${userSub.subscriptionPlan}, status=${userSub.subscriptionStatus}, aiUsed=${userSub.aiMessagesUsed}, voiceUsed=${userSub.voiceCallsUsed}`);

    const plan = await this.getSubscriptionPlan(userSub.subscriptionPlan);
    if (!plan) {
      console.log(`[CHECK-LIMIT-DB] ERROR: Plan not found: ${userSub.subscriptionPlan}`);
      return { allowed: false, message: "Subscription plan not found" };
    }
    
    console.log(`[CHECK-LIMIT-DB] Plan limits: aiLimit=${plan.aiMessagesLimit}, voiceLimit=${plan.voiceCallsLimit}`);

    // Check subscription status - must be active or trialing
    if (userSub.subscriptionStatus !== 'active' && userSub.subscriptionStatus !== 'trialing') {
      console.log(`[CHECK-LIMIT-DB] BLOCKED: Subscription status is '${userSub.subscriptionStatus}', not 'active' or 'trialing'`);
      return { 
        allowed: false, 
        message: "Subscription is not active. Please check your billing status.",
        requiresPayment: true 
      };
    }
    
    console.log(`[CHECK-LIMIT-DB] Subscription is active, checking ${type} usage...`);

    // Check usage limits based on plan
    switch (type) {
      case 'ai_message':
        // Null means unlimited
        if (plan.aiMessagesLimit === null || plan.aiMessagesLimit === -1) {
          console.log(`[CHECK-LIMIT] AI messages UNLIMITED`);
          return { allowed: true };
        }
        
        console.log(`[CHECK-LIMIT] AI check: used=${userSub.aiMessagesUsed}, limit=${plan.aiMessagesLimit}`);
        
        if (userSub.aiMessagesUsed >= plan.aiMessagesLimit) {
          const upgradeMessage = userSub.subscriptionPlan === 'free' 
            ? `💬 Du hast dein kostenloses Limit von ${plan.aiMessagesLimit} AI-Nachrichten erreicht! Upgrade jetzt auf Pro und erhalte 500 Nachrichten pro Monat. 🚀`
            : `💬 Du hast dein Limit von ${plan.aiMessagesLimit} AI-Nachrichten erreicht. Upgrade auf einen höheren Plan für mehr Nachrichten! 🚀`;
          
          console.log(`[CHECK-LIMIT] ❌ BLOCKED AI: ${userSub.aiMessagesUsed} >= ${plan.aiMessagesLimit}`);
          
          return { 
            allowed: false, 
            message: upgradeMessage,
            requiresUpgrade: true,
            requiresPayment: userSub.subscriptionPlan === 'free'
          };
        }
        
        console.log(`[CHECK-LIMIT] ✅ AI ALLOWED: ${userSub.aiMessagesUsed}/${plan.aiMessagesLimit}`);
        break;
        
      case 'voice_call':
        // Null means unlimited
        if (plan.voiceCallsLimit === null || plan.voiceCallsLimit === -1) {
          console.log(`[CHECK-LIMIT] Voice calls UNLIMITED`);
          return { allowed: true };
        }
        
        console.log(`[CHECK-LIMIT] Voice check: used=${userSub.voiceCallsUsed}, limit=${plan.voiceCallsLimit}`);
        
        if (userSub.voiceCallsUsed >= plan.voiceCallsLimit) {
          const upgradeMessage = userSub.subscriptionPlan === 'free'
            ? `📞 Du hast dein kostenloses Limit von ${plan.voiceCallsLimit} Anrufen erreicht! Upgrade jetzt auf Pro und erhalte 100 Anrufe pro Monat. 🚀`
            : `📞 Du hast dein Limit von ${plan.voiceCallsLimit} Anrufen erreicht. Upgrade auf einen höheren Plan für mehr Anrufe! 🚀`;
          
          console.log(`[CHECK-LIMIT] ❌ BLOCKED Voice: ${userSub.voiceCallsUsed} >= ${plan.voiceCallsLimit}`);
          
          return { 
            allowed: false, 
            message: upgradeMessage,
            requiresUpgrade: true,
            requiresPayment: userSub.subscriptionPlan === 'free'
          };
        }
        
        console.log(`[CHECK-LIMIT] ✅ Voice ALLOWED: ${userSub.voiceCallsUsed}/${plan.voiceCallsLimit}`);
        break;
    }

    console.log(`[CHECK-LIMIT] ✅ FINAL: ALLOWED`);
    return { allowed: true };
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    const nextResetDate = new Date();
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);

    await db
      .update(users)
      .set({
        aiMessagesUsed: 0,
        voiceCallsUsed: 0,
        monthlyResetDate: nextResetDate,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserProfile(userId: string, profileData: any): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...profileData, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserThread(userId: string, threadId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ threadId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Password Reset operations
  async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: expiresAt,
        passwordResetUsedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async getUserByPasswordResetTokenHash(tokenHash: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetTokenHash, tokenHash));
    return user;
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        passwordResetUsedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async markPasswordResetUsed(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        passwordResetUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  }

  async updateUserSubscription(userId: string, subscriptionData: any): Promise<void> {
    await db
      .update(users)
      .set({
        subscriptionPlan: subscriptionData.plan,
        subscriptionStatus: subscriptionData.status,
        stripeCustomerId: subscriptionData.stripeCustomerId,
        stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
        subscriptionEndDate: subscriptionData.currentPeriodEnd ? 
          new Date(subscriptionData.currentPeriodEnd * 1000) : null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async updateUserSubscriptionStatus(userId: string, status: string): Promise<void> {
    await db
      .update(users)
      .set({
        subscriptionStatus: status,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }



  async deleteLead(leadId: number, userId: string): Promise<void> {
    await db
      .delete(leads)
      .where(and(eq(leads.id, leadId), eq(leads.userId, userId)));
  }

  async deleteCampaign(campaignId: number, userId: string): Promise<void> {
    await db
      .delete(campaigns)
      .where(and(eq(campaigns.id, campaignId), eq(campaigns.userId, userId)));
  }

  async getUsageHistory(userId: string): Promise<any[]> {
    return await db
      .select()
      .from(usageTracking)
      .where(eq(usageTracking.userId, userId))
      .orderBy(desc(usageTracking.createdAt));
  }

  async importLeads(userId: string, csvData: any[]): Promise<Lead[]> {
    const importedLeads = [];
    for (const leadData of csvData) {
      const lead = await this.createLead({ ...leadData, userId });
      importedLeads.push(lead);
    }
    return importedLeads;
  }

  async exportLeadsToCSV(leads: Lead[]): Promise<string> {
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Status'];
    const rows = leads.map(lead => [
      lead.name,
      lead.phone || '',
      lead.email || '',
      lead.company || '',
      lead.status
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  async getDashboardAnalytics(userId: string): Promise<any> {
    const [leadsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(leads)
      .where(eq(leads.userId, userId));

    const [campaignsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(campaigns)
      .where(eq(campaigns.userId, userId));

    const [callsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(callLogs)
      .where(eq(callLogs.userId, userId));

    return {
      totalLeads: leadsCount.count,
      totalCampaigns: campaignsCount.count,
      totalCalls: callsCount.count,
      conversionRate: 0.12,
    };
  }

  async getPerformanceAnalytics(userId: string, period: string): Promise<any> {
    const leads = await this.getLeads(userId);
    const callLogs = await this.getCallLogs(userId);
    
    return {
      period,
      totalLeads: leads.length,
      contactedLeads: callLogs.length,
      convertedLeads: leads.filter(l => l.status === 'hot').length,
      avgCallDuration: callLogs.reduce((acc, call) => acc + (call.duration || 0), 0) / callLogs.length || 0,
    };
  }

  async getUserSettings(userId: string): Promise<any> {
    return {
      notifications: true,
      autoCall: false,
      voiceSpeed: 'normal',
      language: 'en',
      timezone: 'UTC',
    };
  }

  async updateUserSettings(userId: string, settings: any): Promise<void> {
    // For now, this is a no-op. In the future, this would update a user_settings table
    console.log(`Updated settings for user ${userId}:`, settings);
  }

  // Twilio settings operations
  async getTwilioSettings(userId: string): Promise<{ configured: boolean; accountSid?: string; phoneNumber?: string }> {
    const [settings] = await db.select().from(twilioSettings).where(eq(twilioSettings.userId, userId));
    if (!settings) {
      return { configured: false };
    }
    return {
      configured: true,
      accountSid: settings.accountSid || undefined,
      phoneNumber: settings.phoneNumber || undefined,
    };
  }

  async getTwilioSettingsRaw(userId: string): Promise<{ accountSid: string; authToken: string; phoneNumber: string } | null> {
    const [settings] = await db.select().from(twilioSettings).where(eq(twilioSettings.userId, userId));
    if (!settings || !settings.configured) {
      return null;
    }
    return {
      accountSid: settings.accountSid || '',
      authToken: settings.authToken || '',
      phoneNumber: settings.phoneNumber || '',
    };
  }

  async saveTwilioSettings(userId: string, settingsData: { accountSid: string; authToken: string; phoneNumber: string }): Promise<void> {
    const existingSettings = await db.select().from(twilioSettings).where(eq(twilioSettings.userId, userId));
    
    if (existingSettings.length > 0) {
      await db
        .update(twilioSettings)
        .set({
          ...settingsData,
          configured: true,
          updatedAt: new Date(),
        })
        .where(eq(twilioSettings.userId, userId));
    } else {
      await db
        .insert(twilioSettings)
        .values({
          userId,
          ...settingsData,
          configured: true,
        });
    }
  }

  async deleteTwilioSettings(userId: string): Promise<void> {
    await db.delete(twilioSettings).where(eq(twilioSettings.userId, userId));
  }

  // Call management operations
  async updateCallLog(callId: number, updates: any): Promise<void> {
    await db
      .update(callLogs)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(callLogs.id, callId));
  }

  // Simple in-memory storage for call messages and interactions (could be moved to database in future)
  private callMessages = new Map<number, any>();
  private callInteractions = new Map<string, any[]>();

  // Token operations (deprecated - using subscription system)
  async getTokenBalance(userId: string): Promise<number> {
    return 0; // Deprecated
  }

  async createTokenTransaction(transaction: any): Promise<any> {
    return {}; // Deprecated
  }

  async getTokenTransactions(userId: string): Promise<any[]> {
    return []; // Deprecated
  }

  async updateTokenBalance(userId: string, amount: number): Promise<void> {
    // Deprecated
  }

  async addTokens(userId: string, amount: number): Promise<void> {
    // Deprecated
  }

  async storeCallMessage(callId: number, messageData: any): Promise<void> {
    this.callMessages.set(callId, messageData);
  }

  async getCallMessage(callId: string): Promise<any> {
    return this.callMessages.get(parseInt(callId)) || null;
  }

  async logCallInteraction(callId: string, interaction: any): Promise<void> {
    const interactions = this.callInteractions.get(callId) || [];
    interactions.push({ ...interaction, timestamp: new Date() });
    this.callInteractions.set(callId, interactions);
  }

  // ==========================================
  // RETELL CALL LOG METHODS
  // ==========================================
  
  async saveCallLog(data: {
    userId: string;
    phoneNumber: string;
    status: string;
    // Neue flexible Felder
    provider?: string;           // 'aras-neural-voice (elevenlabs)'
    callId?: string;             // ElevenLabs conversation_id
    purpose?: string;            // 'Terminverschiebung'
    details?: string;            // Original message vom User
    contactName?: string;        // Name des Angerufenen
    originalMessage?: string;    // Die exakte Eingabe
    // Legacy Retell Felder (optional)
    retellCallId?: string;
    duration?: number | null;
    transcript?: string | null;
    customPrompt?: string | null;
    recordingUrl?: string | null;
    metadata?: any;
  }) {
    // Sammle alle wichtigen Daten für metadata
    const enrichedMetadata = {
      ...(data.metadata || {}),
      provider: data.provider || 'unknown',
      callId: data.callId,
      purpose: data.purpose,
      details: data.details,
      contactName: data.contactName,
      originalMessage: data.originalMessage,
      timestamp: new Date().toISOString(),
      // System info
      systemVersion: 'ARAS AI v2.0',
      voiceSystem: 'Neural Voice (Gemini + ElevenLabs)'
    };

    logger.info('[STORAGE] ========== SAVING CALL LOG ==========');
    logger.info('[STORAGE] Input data:', {
      userId: data.userId,
      phoneNumber: data.phoneNumber,
      callId: data.callId,
      retellCallId: data.retellCallId,
      status: data.status,
      provider: data.provider
    });
    
    const valueToInsert = {
      userId: data.userId,
      phoneNumber: data.phoneNumber,
      retellCallId: data.callId || data.retellCallId || null, // Nutze callId als ID
      status: data.status,
      duration: data.duration,
      transcript: data.transcript,
      customPrompt: data.customPrompt || data.originalMessage || null,
      recordingUrl: data.recordingUrl,
      metadata: enrichedMetadata, // Speichere ALLES hier!
    };
    
    logger.info('[STORAGE] 💾 SAVING TO DB with retellCallId:', valueToInsert.retellCallId);
    
    const [insertedLog] = await db.insert(callLogs).values(valueToInsert).returning();
    
    logger.info('[STORAGE] ✅ CALL LOG SAVED!', { 
      databaseId: insertedLog?.id,
      retellCallIdInDB: insertedLog?.retellCallId,
      originalCallId: data.callId,
      userId: data.userId 
    });
    logger.info('[STORAGE] 🔑 Frontend will poll with ID:', insertedLog?.id);
    logger.info('[STORAGE] 🎯 Webhook will search with retellCallId:', insertedLog?.retellCallId);
    
    return insertedLog?.id || null;
  }

  async getCallLogByRetellId(retellCallId: string, userId: string) {
    const result = await db
      .select()
      .from(callLogs)
      .where(and(
        eq(callLogs.retellCallId, retellCallId),
        eq(callLogs.userId, userId)
      ))
      .limit(1);
    return result[0] || null;
  }

  // Update call log by conversation_id (ElevenLabs callId)
  async updateCallLogByConversationId(conversationId: string, updates: {
    transcript?: string;
    recordingUrl?: string;
    status?: string;
    duration?: number;
    metadata?: any;
  }) {
    logger.info('[STORAGE] ===== UPDATING CALL LOG =====', {
      conversationId,
      updates: {
        hasTranscript: !!updates.transcript,
        transcriptLength: updates.transcript?.length || 0,
        hasRecording: !!updates.recordingUrl,
        recordingUrl: updates.recordingUrl || 'null',
        status: updates.status || 'null',
        duration: updates.duration || 'null'
      }
    });
    
    // Find call log by retellCallId (which stores the ElevenLabs conversation_id)
    let [existingLog] = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.retellCallId, conversationId))
      .limit(1);

    // FALLBACK 1: If not found, try searching in metadata
    if (!existingLog) {
      logger.warn('[STORAGE] No call log found by retellCallId, trying metadata search...', { conversationId });
      
      const logsWithMetadata = await db
        .select()
        .from(callLogs)
        .where(sql`metadata->>'callId' = ${conversationId} OR metadata->>'conversationId' = ${conversationId}`);
      
      if (logsWithMetadata.length > 0) {
        existingLog = logsWithMetadata[0];
        logger.info('[STORAGE] ✅ Found call log via metadata search!');
      }
    }
    
    // FALLBACK 2: If still not found, try finding the most recent initiated call
    if (!existingLog) {
      logger.warn('[STORAGE] No call log found by metadata, trying latest initiated call...');
      
      const [latestCall] = await db
        .select()
        .from(callLogs)
        .where(eq(callLogs.status, 'initiated'))
        .orderBy(desc(callLogs.createdAt))
        .limit(1);
      
      if (latestCall && latestCall.createdAt) {
        const timeDiff = Date.now() - new Date(latestCall.createdAt).getTime();
        // If call was initiated in last 5 minutes, probably it's our call
        if (timeDiff < 5 * 60 * 1000) {
          existingLog = latestCall;
          logger.warn('[STORAGE] ⚠️ Using latest initiated call as fallback (created ' + Math.round(timeDiff/1000) + 's ago)');
          
          // Update the retellCallId for future webhook calls
          await db
            .update(callLogs)
            .set({ retellCallId: conversationId })
            .where(eq(callLogs.id, latestCall.id));
        }
      }
    }
    
    if (!existingLog) {
      logger.error('[STORAGE] ❌ FAILED to find call log after all fallback attempts!');
      logger.error('[STORAGE] Conversation ID:', conversationId);
      logger.error('[STORAGE] This webhook data will be lost!');
      return null;
    }
    
    // Normalize transcript - it might be a string, array, or object
    const normalizeTranscript = (transcript: any): string | null => {
      if (!transcript) return null;
      if (typeof transcript === 'string') return transcript;
      if (Array.isArray(transcript)) {
        // If it's an array of message objects, join them
        return transcript.map((item: any) => {
          if (typeof item === 'string') return item;
          if (item.text) return item.text;
          if (item.message) return item.message;
          return JSON.stringify(item);
        }).join('\n');
      }
      // If it's an object, try to extract text or stringify it
      if (transcript.text) return transcript.text;
      if (transcript.messages) return normalizeTranscript(transcript.messages);
      return JSON.stringify(transcript);
    };
    
    const safeSubstring = (text: any, len: number = 50): string => {
      if (!text) return 'null';
      const str = typeof text === 'string' ? text : JSON.stringify(text);
      return str.length > len ? `${str.substring(0, len)}...` : str;
    };
    
    logger.info('[STORAGE] ✅ Found existing call log', {
      id: existingLog.id,
      userId: existingLog.userId,
      currentStatus: existingLog.status,
      currentTranscript: safeSubstring(existingLog.transcript),
      currentRecording: existingLog.recordingUrl || 'null'
    });

    // Merge existing metadata with new data
    const mergedMetadata = {
      ...(existingLog.metadata || {}),
      ...(updates.metadata || {}),
      lastUpdated: new Date().toISOString()
    };
    
    // Normalize the incoming transcript
    const normalizedTranscript = updates.transcript 
      ? normalizeTranscript(updates.transcript) 
      : existingLog.transcript;
    
    logger.info('[STORAGE] 🔄 Transcript processing:', {
      incomingType: typeof updates.transcript,
      incomingIsArray: Array.isArray(updates.transcript),
      normalized: safeSubstring(normalizedTranscript, 100)
    });
    
    const updatedData = {
      transcript: normalizedTranscript,
      recordingUrl: updates.recordingUrl || existingLog.recordingUrl,
      status: updates.status || existingLog.status,
      duration: updates.duration || existingLog.duration,
      metadata: mergedMetadata,
      updatedAt: new Date()
    };
    
    logger.info('[STORAGE] 💾 About to save to database:', {
      callId: existingLog.id,
      newTranscript: safeSubstring(updatedData.transcript, 100),
      newRecording: updatedData.recordingUrl || 'null',
      newStatus: updatedData.status,
      newDuration: updatedData.duration
    });

    // Update the record
    await db
      .update(callLogs)
      .set(updatedData)
      .where(eq(callLogs.id, existingLog.id));

    logger.info('[STORAGE] ✅ Call log UPDATED SUCCESSFULLY in database!', { 
      callId: existingLog.id, 
      conversationId,
      hasTranscript: !!updatedData.transcript,
      hasRecording: !!updatedData.recordingUrl,
      status: updatedData.status
    });

    return existingLog.id;
  }

  // Get single call log by conversation ID
  async getCallLogByConversationId(conversationId: string) {
    const [log] = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.retellCallId, conversationId))
      .limit(1);
    return log || null;
  }
  
  // Get single call log by ID
  async getCallLog(callId: string) {
    const callIdNum = parseInt(callId, 10);
    if (isNaN(callIdNum)) {
      logger.warn('[STORAGE] Invalid callId format', { callId });
      return null;
    }
    
    const [log] = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.id, callIdNum))
      .limit(1);
    return log || null;
  }
  
  // Get all call logs for a user
  async getUserCallLogs(userId: string) {
    logger.info('[STORAGE] Fetching all call logs for user:', userId);
    
    const logs = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.createdAt))
      .limit(100); // Limit to last 100 calls
    
    logger.info('[STORAGE] Found call logs:', { 
      userId, 
      count: logs.length 
    });
    
    return logs;
  }
  
  // Phonebook/Contacts Methods
  async getUserContacts(userId: string) {
    // Return unique contacts from call_logs
    const logs = await db
      .select()
      .from(callLogs)
      .where(eq(callLogs.userId, userId))
      .orderBy(desc(callLogs.createdAt));
    
    const uniqueContacts = new Map();
    logs.forEach((log: any) => {
      if (log.phoneNumber && !uniqueContacts.has(log.phoneNumber)) {
        uniqueContacts.set(log.phoneNumber, {
          name: log.phoneNumber,
          phoneNumber: log.phoneNumber,
          lastCall: log.createdAt
        });
      }
    });
    return Array.from(uniqueContacts.values());
  }
  
  async findContactByName(userId: string, name: string) {
    const contacts = await this.getUserContacts(userId);
    return contacts.find((c: any) => c.name.toLowerCase() === name.toLowerCase()) || null;
  }
  
  async createContact(userId: string, name: string, phoneNumber: string) {
    // Since we don't have a contacts table yet, just return the data
    return { name, phoneNumber, userId };
  }
  
  async getCallHistoryByPhone(userId: string, phoneNumber: string) {
    return await db
      .select()
      .from(callLogs)
      .where(and(
        eq(callLogs.userId, userId),
        eq(callLogs.phoneNumber, phoneNumber)
      ))
      .orderBy(desc(callLogs.createdAt))
      .limit(10);
  }
  
  async getPlatformStats() {
    // Implement platform-wide stats
    const totalUsers = await db.select().from(users);
    const totalCalls = await db.select().from(callLogs);
    return {
      totalUsers: totalUsers.length,
      totalCalls: totalCalls.length,
      totalMessages: 0
    };
  }

  // ============================================
  // User Data Sources (Knowledge Base)
  // ============================================
  
  // Helper: Convert Postgres timestamp to ISO string safely
  private toIsoDate(value: any): string | null {
    if (!value) return null;
    try {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (typeof value === 'string') {
        let iso = value.replace(' ', 'T');
        iso = iso.replace(/\.(\d{3})\d*/, '.$1');
        if (iso.endsWith('+00')) {
          iso = iso.replace('+00', 'Z');
        } else if (!iso.endsWith('Z') && !iso.match(/[+-]\d{2}:\d{2}$/)) {
          iso += 'Z';
        }
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
      }
      return null;
    } catch {
      return null;
    }
  }

  async getUserDataSources(userId: string): Promise<any[]> {
    logger.info(`[STORAGE-DB] getUserDataSources called for userId=${userId}`);
    try {
      const { client } = await import('./db');
      
      const result = await client`
        SELECT * FROM user_data_sources 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC
        LIMIT 200
      `;
      
      logger.info(`[STORAGE-DB] Found ${result.length} rows for userId=${userId}`);
      
      // Transform with robust column mapping
      const transformed = result.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title || '',
        status: row.status || 'active',
        // CRITICAL: Try content_text first, then content_preview, then empty
        contentText: row.content_text ?? row.content_preview ?? '',
        url: row.url || '',
        fileName: row.file_name || null,
        fileMime: row.file_mime || null,
        fileSize: row.file_size || null,
        fileStorageKey: row.file_storage_key || null,
        errorMessage: row.error_message || null,
        createdAt: this.toIsoDate(row.created_at),
        updatedAt: this.toIsoDate(row.updated_at)
      }));
      
      logger.info(`[STORAGE-DB] Transformed ${transformed.length} sources`);
      return transformed;
    } catch (error: any) {
      logger.error(`[STORAGE-DB] ❌ ERROR fetching data sources for userId=${userId}:`, error.message);
      throw error;
    }
  }
}

// In-memory storage class for authentication without database dependency
export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private usersByUsername = new Map<string, User>();
  private leads = new Map<string, Lead[]>();
  private campaigns = new Map<string, Campaign[]>();
  private chatSessions = new Map<string, ChatSession[]>();
  private chatMessages = new Map<string, ChatMessage[]>();
  private callLogs = new Map<string, CallLog[]>();
  private callMessages = new Map<number, any>();
  private callInteractions = new Map<string, any[]>();
  private voiceAgentStorage: VoiceAgent[] | null = null;
  private voiceAgentCounter = 100;
  
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.usersByUsername.get(username);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const id = userData.id || this.generateId();
    
    // Hash the password before storing it
    const hashedPassword = await hashPassword(userData.password);
    
    const user: User = {
      id,
      username: userData.username,
      password: hashedPassword,
      email: userData.email || null,
      firstName: userData.firstName || null,
      lastName: userData.lastName || null,
      profileImageUrl: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionPlan: userData.subscriptionPlan || 'free',
      subscriptionStatus: userData.subscriptionStatus || 'trial',
      subscriptionStartDate: new Date(),
      subscriptionEndDate: null,
      trialStartDate: userData.trialStartDate || null,
      trialEndDate: userData.trialEndDate || null,
      trialMessagesUsed: userData.trialMessagesUsed || 0,
      hasPaymentMethod: userData.hasPaymentMethod || false,
      stripePaymentMethodId: userData.stripePaymentMethodId || null,
      aiMessagesUsed: 0,
      voiceCallsUsed: 0,
      monthlyResetDate: new Date(),
      threadId: null,
      assistantId: null,
      // Business Intelligence Fields
      company: userData.company || null,
      website: userData.website || null,
      industry: userData.industry || null,
      role: userData.role || null,
      phone: userData.phone || null,
      language: userData.language || null,
      primaryGoal: userData.primaryGoal || null,
      aiProfile: userData.aiProfile || null,
      profileEnriched: userData.profileEnriched || false,
      lastEnrichmentDate: userData.lastEnrichmentDate || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    this.users.set(id, user);
    this.usersByUsername.set(userData.username, user);
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existingUser = this.usersByUsername.get(userData.username);
    if (existingUser) {
      // Hash password if it's being updated
      const hashedPassword = userData.password ? await hashPassword(userData.password) : existingUser.password;
      const updatedUser = { 
        ...existingUser, 
        ...userData, 
        password: hashedPassword,
        updatedAt: new Date() 
      };
      this.users.set(existingUser.id, updatedUser);
      this.usersByUsername.set(userData.username, updatedUser);
      return updatedUser;
    }
    return this.createUser(userData);
  }

  async updateUserStripeInfo(userId: string, stripeInfo: { stripeCustomerId?: string; customerId?: string; subscriptionId?: string; paymentMethodId?: string; hasPaymentMethod?: boolean }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updateData: any = {};

    if (stripeInfo.stripeCustomerId || stripeInfo.customerId) {
      updateData.stripeCustomerId = stripeInfo.stripeCustomerId || stripeInfo.customerId;
    }
    if (stripeInfo.subscriptionId !== undefined) {
      updateData.stripeSubscriptionId = stripeInfo.subscriptionId;
    }
    if (stripeInfo.paymentMethodId !== undefined) {
      updateData.stripePaymentMethodId = stripeInfo.paymentMethodId;
    }
    if (stripeInfo.hasPaymentMethod !== undefined) {
      updateData.hasPaymentMethod = stripeInfo.hasPaymentMethod;
    }

    const updatedUser = {
      ...user,
      ...updateData,
      updatedAt: new Date(),
    };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    return updatedUser;
  }

  async updateUserPlan(userId: string, plan: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updatedUser = { ...user, subscriptionPlan: plan, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    return updatedUser;
  }

  async updateUserProfile(userId: string, profileData: any): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updatedUser = { ...user, ...profileData, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    return updatedUser;
  }

  async updateUserThread(userId: string, threadId: string): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updatedUser = { ...user, threadId, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    return updatedUser;
  }

  // Password Reset operations (MemStorage stubs)
  async setPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    const updated = { ...user, passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt, passwordResetUsedAt: null, updatedAt: new Date() };
    this.users.set(userId, updated);
    this.usersByUsername.set(user.username, updated);
  }

  async getUserByPasswordResetTokenHash(tokenHash: string): Promise<User | undefined> {
    const allUsers = Array.from(this.users.values());
    for (let i = 0; i < allUsers.length; i++) {
      if (allUsers[i].passwordResetTokenHash === tokenHash) return allUsers[i];
    }
    return undefined;
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    const updated = { ...user, passwordResetTokenHash: null, passwordResetExpiresAt: null, passwordResetUsedAt: null, updatedAt: new Date() };
    this.users.set(userId, updated);
    this.usersByUsername.set(user.username, updated);
  }

  async markPasswordResetUsed(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    const updated = { ...user, passwordResetUsedAt: new Date(), updatedAt: new Date() };
    this.users.set(userId, updated);
    this.usersByUsername.set(user.username, updated);
  }

  // Subscription operations
  async getSubscriptionStatus(userId: string): Promise<any> {
    const user = this.users.get(userId);
    if (!user) return null;
    
    return {
      subscriptionPlan: user.subscriptionPlan,
      subscriptionStatus: user.subscriptionStatus,
      aiMessagesUsed: user.aiMessagesUsed,
      voiceCallsUsed: user.voiceCallsUsed,
      monthlyResetDate: user.monthlyResetDate,
      subscriptionEndDate: user.subscriptionEndDate,
    };
  }

  async getSubscriptionPlan(planId: string): Promise<any> {
    // Mock subscription plans - only the 4 actual plans
    const plans = {
      free: {
        id: 'free',
        name: 'Free',
        price: 0,
        aiMessagesLimit: 10,
        voiceCallsLimit: 2,
        leadsLimit: 100,
        campaignsLimit: 1,
        features: ['10 AI Messages', '2 Voice Calls', '100 Leads', '1 Campaign'],
        isActive: true,
      },
      pro: {
        id: 'pro',
        name: 'PRO',
        price: 4900, // €49
        aiMessagesLimit: 100,
        voiceCallsLimit: 100,
        leadsLimit: 1000,
        campaignsLimit: 10,
        features: ['100 AI Messages', '100 Voice Calls', '1,000 Leads', '10 Campaigns', 'Priority Support'],
        isActive: true,
      },
      ultra: {
        id: 'ultra',
        name: 'ULTRA',
        price: 9900, // €99
        aiMessagesLimit: 1000,
        voiceCallsLimit: 1000,
        leadsLimit: 10000,
        campaignsLimit: 50,
        features: ['1,000 AI Messages', '1,000 Voice Calls', '10,000 Leads', '50 Campaigns', 'Priority Support', 'Advanced Analytics'],
        isActive: true,
      },
      ultimate: {
        id: 'ultimate',
        name: 'ULTIMATE',
        price: 19900, // €199
        aiMessagesLimit: 20000,
        voiceCallsLimit: 20000,
        leadsLimit: 100000,
        campaignsLimit: 200,
        features: ['20,000 AI Messages', '20,000 Voice Calls', '100,000 Leads', '200 Campaigns', 'Dedicated Account Manager', 'Custom Integrations', 'White Label Options'],
        isActive: true,
      },
    };
    return plans[planId as keyof typeof plans];
  }

  async getAllSubscriptionPlans(): Promise<any[]> {
    return [
      await this.getSubscriptionPlan('free'),
      await this.getSubscriptionPlan('pro'),
      await this.getSubscriptionPlan('ultra'),
      await this.getSubscriptionPlan('ultimate'),
    ];
  }

  async updateUserSubscription(userId: string, subscriptionData: any): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updatedUser = {
      ...user,
      subscriptionPlan: subscriptionData.plan,
      subscriptionStatus: subscriptionData.status,
      stripeCustomerId: subscriptionData.stripeCustomerId,
      stripeSubscriptionId: subscriptionData.stripeSubscriptionId,
      subscriptionEndDate: subscriptionData.currentPeriodEnd ? 
        new Date(subscriptionData.currentPeriodEnd * 1000) : null,
      updatedAt: new Date()
    };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
  }

  async updateUserSubscriptionStatus(userId: string, status: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updatedUser = { ...user, subscriptionStatus: status, updatedAt: new Date() };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
  }

  async trackUsage(userId: string, type: string, description?: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    
    let updatedUser = { ...user };
    switch (type) {
      case 'ai_message':
        updatedUser.aiMessagesUsed = (user.aiMessagesUsed || 0) + 1;
        break;
      case 'voice_call':
        updatedUser.voiceCallsUsed = (user.voiceCallsUsed || 0) + 1;
        break;
    }
    updatedUser.updatedAt = new Date();
    
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
  }

  async checkUsageLimit(userId: string, type: string): Promise<{ allowed: boolean; message?: string; requiresPayment?: boolean; requiresUpgrade?: boolean }> {
    const userSub = await this.getSubscriptionStatus(userId);
    if (!userSub) return { allowed: false, message: "Subscription not found" };

    const plan = await this.getSubscriptionPlan(userSub.subscriptionPlan);
    if (!plan) return { allowed: false, message: "Subscription plan not found" };

    // Check subscription status - must be active
    if (userSub.subscriptionStatus !== 'active') {
      return { 
        allowed: false, 
        message: "Subscription is not active. Please check your billing status.",
        requiresPayment: true 
      };
    }

    // Check usage limits based on plan
    switch (type) {
      case 'ai_message':
        // Null means unlimited
        if (plan.aiMessagesLimit === null || plan.aiMessagesLimit === -1) {
          console.log(`[CHECK-LIMIT] AI messages UNLIMITED`);
          return { allowed: true };
        }
        
        console.log(`[CHECK-LIMIT] AI check: used=${userSub.aiMessagesUsed}, limit=${plan.aiMessagesLimit}`);
        
        if (userSub.aiMessagesUsed >= plan.aiMessagesLimit) {
          const upgradeMessage = userSub.subscriptionPlan === 'free' 
            ? `💬 Du hast dein kostenloses Limit von ${plan.aiMessagesLimit} AI-Nachrichten erreicht! Upgrade jetzt auf Pro und erhalte 500 Nachrichten pro Monat. 🚀`
            : `💬 Du hast dein Limit von ${plan.aiMessagesLimit} AI-Nachrichten erreicht. Upgrade auf einen höheren Plan für mehr Nachrichten! 🚀`;
          
          console.log(`[CHECK-LIMIT] ❌ BLOCKED AI: ${userSub.aiMessagesUsed} >= ${plan.aiMessagesLimit}`);
          
          return { 
            allowed: false, 
            message: upgradeMessage,
            requiresUpgrade: true 
          };
        }
        
        console.log(`[CHECK-LIMIT] ✅ AI ALLOWED: ${userSub.aiMessagesUsed}/${plan.aiMessagesLimit}`);
        break;
        
      case 'voice_call':
        // Null means unlimited
        if (plan.voiceCallsLimit === null || plan.voiceCallsLimit === -1) {
          console.log(`[CHECK-LIMIT] Voice calls UNLIMITED`);
          return { allowed: true };
        }
        
        console.log(`[CHECK-LIMIT] Voice check: used=${userSub.voiceCallsUsed}, limit=${plan.voiceCallsLimit}`);
        
        if (userSub.voiceCallsUsed >= plan.voiceCallsLimit) {
          const upgradeMessage = userSub.subscriptionPlan === 'free'
            ? `📞 Du hast dein kostenloses Limit von ${plan.voiceCallsLimit} Anrufen erreicht! Upgrade jetzt auf Pro und erhalte 100 Anrufe pro Monat. 🚀`
            : `📞 Du hast dein Limit von ${plan.voiceCallsLimit} Anrufen erreicht. Upgrade auf einen höheren Plan für mehr Anrufe! 🚀`;
          
          console.log(`[CHECK-LIMIT] ❌ BLOCKED Voice: ${userSub.voiceCallsUsed} >= ${plan.voiceCallsLimit}`);
          
          return { 
            allowed: false, 
            message: upgradeMessage,
            requiresUpgrade: true 
          };
        }
        
        console.log(`[CHECK-LIMIT] ✅ Voice ALLOWED: ${userSub.voiceCallsUsed}/${plan.voiceCallsLimit}`);
        break;
    }

    console.log(`[CHECK-LIMIT] ✅ FINAL: ALLOWED`);
    return { allowed: true };
  }

  async resetMonthlyUsage(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) return;
    
    const nextResetDate = new Date();
    nextResetDate.setMonth(nextResetDate.getMonth() + 1);
    
    const updatedUser = {
      ...user,
      aiMessagesUsed: 0,
      voiceCallsUsed: 0,
      monthlyResetDate: nextResetDate,
      updatedAt: new Date(),
    };
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
  }

  async startUserTrial(userId: string, trialData: { paymentMethodId: string; trialEndDate: string; hasPaymentMethod: boolean }): Promise<User> {
    const user = this.users.get(userId);
    if (!user) throw new Error('User not found');
    
    const updatedUser = {
      ...user,
      stripePaymentMethodId: trialData.paymentMethodId,
      trialStartDate: new Date(),
      trialEndDate: new Date(trialData.trialEndDate),
      hasPaymentMethod: trialData.hasPaymentMethod,
      subscriptionStatus: 'trialing' as any,
      updatedAt: new Date(),
    };
    
    this.users.set(userId, updatedUser);
    this.usersByUsername.set(user.username, updatedUser);
    return updatedUser;
  }

  // Stub implementations for other operations
  async getLeads(userId: string): Promise<Lead[]> {
    return this.leads.get(userId) || [];
  }

  async createLead(lead: InsertLead): Promise<Lead> {
    const newLead: Lead = {
      ...lead,
      id: parseInt(this.generateId(), 36),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: lead.status || 'cold',
      lastContact: null,
      notes: null,
      email: lead.email || null,
      phone: lead.phone || null,
      company: lead.company || null,
    };
    
    const userLeads = this.leads.get(lead.userId) || [];
    userLeads.push(newLead);
    this.leads.set(lead.userId, userLeads);
    return newLead;
  }

  async updateLead(id: number, updates: Partial<InsertLead>): Promise<Lead> {
    // Find and update lead across all users
    for (const [userId, userLeads] of Array.from(this.leads.entries())) {
      const leadIndex = userLeads.findIndex((l: Lead) => l.id === id);
      if (leadIndex !== -1) {
        const updatedLead = { ...userLeads[leadIndex], ...updates, updatedAt: new Date() };
        userLeads[leadIndex] = updatedLead;
        this.leads.set(userId, userLeads);
        return updatedLead;
      }
    }
    throw new Error('Lead not found');
  }

  async deleteLead(leadId: number, userId: string): Promise<void> {
    const userLeads = this.leads.get(userId) || [];
    const filteredLeads = userLeads.filter(l => l.id !== leadId);
    this.leads.set(userId, filteredLeads);
  }

  async importLeads(userId: string, csvData: any[]): Promise<Lead[]> {
    const importedLeads = [];
    for (const leadData of csvData) {
      const lead = await this.createLead({ ...leadData, userId });
      importedLeads.push(lead);
    }
    return importedLeads;
  }

  async exportLeadsToCSV(leads: Lead[]): Promise<string> {
    const headers = ['Name', 'Phone', 'Email', 'Company', 'Status'];
    const rows = leads.map(lead => [
      lead.name,
      lead.phone || '',
      lead.email || '',
      lead.company || '',
      lead.status
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }

  // Implement remaining interface methods with stubs
  async getCampaigns(userId: string): Promise<Campaign[]> {
    return this.campaigns.get(userId) || [];
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const newCampaign: Campaign = {
      ...campaign,
      id: parseInt(this.generateId(), 36),
      createdAt: new Date(),
      updatedAt: new Date(),
      status: campaign.status || 'draft',
      totalLeads: 0,
      contacted: 0,
      converted: 0,
      description: campaign.description || null,
    };
    
    const userCampaigns = this.campaigns.get(campaign.userId) || [];
    userCampaigns.push(newCampaign);
    this.campaigns.set(campaign.userId, userCampaigns);
    return newCampaign;
  }

  async updateCampaign(id: number, updates: Partial<InsertCampaign>): Promise<Campaign> {
    for (const [userId, userCampaigns] of Array.from(this.campaigns.entries())) {
      const campaignIndex = userCampaigns.findIndex((c: Campaign) => c.id === id);
      if (campaignIndex !== -1) {
        const updatedCampaign = { ...userCampaigns[campaignIndex], ...updates, updatedAt: new Date() };
        userCampaigns[campaignIndex] = updatedCampaign;
        this.campaigns.set(userId, userCampaigns);
        return updatedCampaign;
      }
    }
    throw new Error('Campaign not found');
  }

  async deleteCampaign(campaignId: number, userId: string): Promise<void> {
    const userCampaigns = this.campaigns.get(userId) || [];
    const filteredCampaigns = userCampaigns.filter(c => c.id !== campaignId);
    this.campaigns.set(userId, filteredCampaigns);
  }

  async getChatSessions(userId: string): Promise<ChatSession[]> {
    return this.chatSessions.get(userId) || [];
  }

  async createChatSession(session: InsertChatSession): Promise<ChatSession> {
    const newSession: ChatSession = {
      ...session,
      id: parseInt(this.generateId(), 36),
      createdAt: new Date(),
      updatedAt: new Date(),
      title: session.title || 'New Chat',
      isActive: true,
    };
    
    // Deactivate other sessions
    const userSessions = this.chatSessions.get(session.userId) || [];
    userSessions.forEach(s => s.isActive = false);
    userSessions.push(newSession);
    this.chatSessions.set(session.userId, userSessions);
    return newSession;
  }

  async getActiveSession(userId: string): Promise<ChatSession | undefined> {
    const userSessions = this.chatSessions.get(userId) || [];
    return userSessions.find(s => s.isActive);
  }

  async setActiveSession(userId: string, sessionId: number): Promise<void> {
    const userSessions = this.chatSessions.get(userId) || [];
    userSessions.forEach(s => s.isActive = s.id === sessionId);
    this.chatSessions.set(userId, userSessions);
  }

  async archiveSession(sessionId: number): Promise<void> {
    for (const [userId, userSessions] of Array.from(this.chatSessions.entries())) {
      const session = userSessions.find((s: ChatSession) => s.id === sessionId);
      if (session) {
        session.isActive = false;
        this.chatSessions.set(userId, userSessions);
        break;
      }
    }
  }

  async getChatMessages(userId: string, sessionId?: number): Promise<ChatMessage[]> {
    return this.chatMessages.get(userId) || [];
  }

  async getChatMessagesBySession(sessionId: number): Promise<ChatMessage[]> {
    for (const [userId, messages] of Array.from(this.chatMessages.entries())) {
      const sessionMessages = messages.filter((m: ChatMessage) => m.sessionId === sessionId);
      if (sessionMessages.length > 0) return sessionMessages;
    }
    return [];
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const newMessage: ChatMessage = {
      ...message,
      id: parseInt(this.generateId(), 36),
      timestamp: new Date(),
      isAi: message.isAi || false,
      sessionId: message.sessionId || null,
    };
    
    const userMessages = this.chatMessages.get(message.userId) || [];
    userMessages.push(newMessage);
    this.chatMessages.set(message.userId, userMessages);
    return newMessage;
  }

  async updateChatMessage(messageId: number, updates: Partial<InsertChatMessage>): Promise<ChatMessage> {
    for (const [userId, userMessages] of Array.from(this.chatMessages.entries())) {
      const messageIndex = userMessages.findIndex((m: ChatMessage) => m.id === messageId);
      if (messageIndex !== -1) {
        const updatedMessage = { ...userMessages[messageIndex], ...updates };
        userMessages[messageIndex] = updatedMessage;
        this.chatMessages.set(userId, userMessages);
        return updatedMessage;
      }
    }
    throw new Error('Message not found');
  }

  async clearChatMessages(userId: string): Promise<void> {
    this.chatMessages.set(userId, []);
  }

  async searchChatMessages(userId: string, query: string): Promise<ChatMessage[]> {
    const userMessages = this.chatMessages.get(userId) || [];
    return userMessages.filter(m => m.message.toLowerCase().includes(query.toLowerCase()));
  }

  async getVoiceAgents(): Promise<VoiceAgent[]> {
    if (this.voiceAgentStorage) {
      return this.voiceAgentStorage;
    }
    
    return [
      {
        id: 1,
        name: 'Alex Chen',
        description: 'Professional sales agent with friendly demeanor',
        voice: 'professional',
        personality: 'A warm, professional sales agent who builds rapport quickly and focuses on understanding customer needs. Speaks clearly and confidently.',
        customScript: 'Hello! This is Alex from your sales team. I hope you\'re having a great day. I\'m calling to follow up on your recent interest in our services.',
        ttsVoice: 'nova',
        language: 'en',
        industry: 'general',
        userId: null,
        isSystemAgent: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 2,
        name: 'Sarah Mitchell',
        description: 'Expert business development specialist',
        voice: 'authoritative',
        personality: 'A confident, authoritative business development expert who takes charge of conversations and demonstrates deep industry knowledge.',
        customScript: 'Good day! This is Sarah Mitchell, your business development specialist. I\'m reaching out regarding the strategic opportunities we discussed.',
        ttsVoice: 'alloy',
        language: 'en',
        industry: 'business',
        userId: null,
        isSystemAgent: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 3,
        name: 'David Rodriguez',
        description: 'Senior sales executive with consultative approach',
        voice: 'friendly',
        personality: 'A friendly, consultative senior executive who listens carefully and provides thoughtful, personalized solutions.',
        customScript: 'Hi there! David Rodriguez here. I wanted to personally reach out to discuss how we can best serve your specific needs.',
        ttsVoice: 'onyx',
        language: 'en',
        industry: 'enterprise',
        userId: null,
        isSystemAgent: true,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }

  async getCallLogs(userId: string): Promise<CallLog[]> {
    return this.callLogs.get(userId) || [];
  }

  async createCallLog(callLog: any): Promise<CallLog> {
    const newCallLog: CallLog = {
      ...callLog,
      id: parseInt(this.generateId(), 36),
      createdAt: new Date(),
      status: callLog.status || 'initiated',
      duration: callLog.duration || null,
      transcript: callLog.transcript || null,
    };
    
    const userCallLogs = this.callLogs.get(callLog.userId) || [];
    userCallLogs.push(newCallLog);
    this.callLogs.set(callLog.userId, userCallLogs);
    return newCallLog;
  }

  // Voice agent CRUD operations
  async createVoiceAgent(agentData: any): Promise<VoiceAgent> {
    const newAgent: VoiceAgent = {
      ...agentData,
      id: this.voiceAgentCounter++,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const allAgents = await this.getVoiceAgents();
    allAgents.push(newAgent);
    
    // Update in-memory collection by overriding default data
    this.voiceAgentStorage = allAgents;
    return newAgent;
  }

  async getVoiceAgentById(id: number): Promise<VoiceAgent | null> {
    const agents = await this.getVoiceAgents();
    return agents.find(agent => agent.id === id) || null;
  }

  async updateVoiceAgent(id: number, updates: any): Promise<VoiceAgent> {
    const agents = await this.getVoiceAgents();
    const agentIndex = agents.findIndex(agent => agent.id === id);
    
    if (agentIndex === -1) {
      throw new Error('Voice agent not found');
    }
    
    agents[agentIndex] = {
      ...agents[agentIndex],
      ...updates,
      updatedAt: new Date(),
    };
    
    this.voiceAgentStorage = agents;
    return agents[agentIndex];
  }

  async deleteVoiceAgent(id: number): Promise<void> {
    const agents = await this.getVoiceAgents();
    const filteredAgents = agents.filter(agent => agent.id !== id);
    this.voiceAgentStorage = filteredAgents;
  }

  // Token operations (deprecated)
  async getTokenBalance(userId: string): Promise<number> {
    return 0;
  }

  async createTokenTransaction(transaction: any): Promise<any> {
    return {};
  }

  async getTokenTransactions(userId: string): Promise<any[]> {
    return [];
  }

  async updateTokenBalance(userId: string, amount: number): Promise<void> {
    // Deprecated
  }

  async addTokens(userId: string, amount: number): Promise<void> {
    // Deprecated
  }

  async getUsageHistory(userId: string): Promise<any[]> {
    return [];
  }

  async getDashboardAnalytics(userId: string): Promise<any> {
    const leads = await this.getLeads(userId);
    const campaigns = await this.getCampaigns(userId);
    const callLogs = await this.getCallLogs(userId);
    
    return {
      totalLeads: leads.length,
      totalCampaigns: campaigns.length,
      totalCalls: callLogs.length,
      conversionRate: 0.12,
    };
  }

  async getPerformanceAnalytics(userId: string, period: string): Promise<any> {
    const leads = await this.getLeads(userId);
    const callLogs = await this.getCallLogs(userId);
    
    return {
      period,
      totalLeads: leads.length,
      contactedLeads: callLogs.length,
      convertedLeads: leads.filter(l => l.status === 'hot').length,
      avgCallDuration: callLogs.reduce((acc, call) => acc + (call.duration || 0), 0) / callLogs.length || 0,
    };
  }

  async getUserSettings(userId: string): Promise<any> {
    return {
      notifications: true,
      autoCall: false,
      voiceSpeed: 'normal',
      language: 'en',
      timezone: 'UTC',
    };
  }

  async updateUserSettings(userId: string, settings: any): Promise<void> {
    console.log(`Updated settings for user ${userId}:`, settings);
  }

  async getTwilioSettings(userId: string): Promise<{ configured: boolean; accountSid?: string; phoneNumber?: string }> {
    return { configured: false };
  }

  async getTwilioSettingsRaw(userId: string): Promise<{ accountSid: string; authToken: string; phoneNumber: string } | null> {
    return null;
  }

  async saveTwilioSettings(userId: string, settings: { accountSid: string; authToken: string; phoneNumber: string }): Promise<void> {
    console.log(`Saved Twilio settings for user ${userId}`);
  }

  async deleteTwilioSettings(userId: string): Promise<void> {
    console.log(`Deleted Twilio settings for user ${userId}`);
  }

  async updateCallLog(callId: number, updates: any): Promise<void> {
    for (const [userId, userCallLogs] of Array.from(this.callLogs.entries())) {
      const callLogIndex = userCallLogs.findIndex((c: CallLog) => c.id === callId);
      if (callLogIndex !== -1) {
        userCallLogs[callLogIndex] = { ...userCallLogs[callLogIndex], ...updates };
        this.callLogs.set(userId, userCallLogs);
        break;
      }
    }
  }

  async storeCallMessage(callId: number, messageData: any): Promise<void> {
    this.callMessages.set(callId, messageData);
  }

  async getCallMessage(callId: string): Promise<any> {
    return this.callMessages.get(parseInt(callId)) || null;
  }

  async logCallInteraction(callId: string, interaction: any): Promise<void> {
    const interactions = this.callInteractions.get(callId) || [];
    interactions.push({ ...interaction, timestamp: new Date() });
    this.callInteractions.set(callId, interactions);
  }
  
  // Voice Task operations (stub implementations for MemStorage)
  async createVoiceTask(data: any): Promise<any> {
    return { id: Date.now(), ...data };
  }
  
  async getVoiceTaskById(id: number): Promise<any | null> {
    return null;
  }
  
  async getVoiceTasksByUser(userId: string): Promise<any[]> {
    return [];
  }
  
  async updateVoiceTask(id: number, updates: any): Promise<any> {
    return { id, ...updates };
  }
  
  async deleteVoiceTask(id: number): Promise<void> {
    // Stub
  }
  
  // Retell call log methods (stub implementations)
  async saveCallLog(data: any): Promise<number | null> {
    // Stub implementation for in-memory storage
    return Math.floor(Math.random() * 10000); // Return mock ID
  }
  
  async getCallLogByRetellId(retellCallId: string, userId: string): Promise<any> {
    return null;
  }
  
  async getUserCallLogs(userId: string): Promise<any[]> {
    return this.callLogs.get(userId) || [];
  }
  
  // Phonebook/Contacts Methods (stub implementations)
  async getUserContacts(userId: string): Promise<any[]> {
    return [];
  }
  
  async findContactByName(userId: string, name: string): Promise<any | null> {
    return null;
  }
  
  async createContact(userId: string, name: string, phoneNumber: string): Promise<any> {
    return { name, phoneNumber, userId };
  }
  
  async getCallHistoryByPhone(userId: string, phoneNumber: string): Promise<any[]> {
    return [];
  }
  
  async getPlatformStats(): Promise<any> {
    return {
      totalUsers: this.users.size,
      totalCalls: 0,
      totalMessages: 0
    };
  }
  
  // Helper: Convert Postgres timestamp to ISO string safely
  private toIsoDate(value: any): string | null {
    if (!value) return null;
    try {
      // If already a Date object
      if (value instanceof Date) {
        return value.toISOString();
      }
      // If string like "2025-12-29 22:42:15.305864+00" convert to ISO
      if (typeof value === 'string') {
        // Replace space with T and handle microseconds
        let iso = value.replace(' ', 'T');
        // Truncate microseconds to milliseconds (6 digits -> 3 digits)
        iso = iso.replace(/\.(\d{3})\d*/, '.$1');
        // Ensure timezone format
        if (iso.endsWith('+00')) {
          iso = iso.replace('+00', 'Z');
        } else if (!iso.endsWith('Z') && !iso.match(/[+-]\d{2}:\d{2}$/)) {
          iso += 'Z';
        }
        // Validate by parsing
        const d = new Date(iso);
        if (isNaN(d.getTime())) return null;
        return d.toISOString();
      }
      return null;
    } catch {
      return null;
    }
  }

  // User Data Sources (Knowledge Base) - Query from user_data_sources table
  async getUserDataSources(userId: string): Promise<any[]> {
    logger.info(`[STORAGE] getUserDataSources called with userId=${userId}`);
    try {
      const { client } = await import('./db');
      
      // One-time schema inspection (logged once)
      if (!(globalThis as any).__schemaLogged) {
        (globalThis as any).__schemaLogged = true;
        try {
          const schema = await client`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'user_data_sources'
            ORDER BY ordinal_position
          `;
          logger.info(`[STORAGE] ═══ SCHEMA user_data_sources ═══`);
          schema.forEach((col: any) => logger.info(`  ${col.column_name}: ${col.data_type}`));
        } catch (e) {
          logger.warn(`[STORAGE] Schema inspection failed`);
        }
      }
      
      // Query all rows for this user
      const result = await client`
        SELECT * FROM user_data_sources 
        WHERE user_id = ${userId} 
        ORDER BY created_at DESC
      `;
      
      logger.info(`[STORAGE] getUserDataSources for userId=${userId}: found ${result.length} raw rows`);
      
      // Log first row's actual keys for debugging
      if (result.length > 0) {
        const keys = Object.keys(result[0]);
        logger.info(`[STORAGE] First row KEYS: ${keys.join(', ')}`);
        logger.info(`[STORAGE] First row VALUES: id=${result[0].id} type=${result[0].type} status=${result[0].status} content_text=${result[0].content_text?.length || 'N/A'} content_preview=${result[0].content_preview?.length || 'N/A'}`);
      }
      
      // Transform with ROBUST column mapping (handle both content_text AND content_preview)
      const transformed = result.map((row: any) => ({
        id: row.id,
        userId: row.user_id,
        type: row.type,
        title: row.title || '',
        status: row.status || 'active',
        // CRITICAL: Try content_text first, then content_preview, then empty
        contentText: row.content_text ?? row.content_preview ?? '',
        url: row.url || '',
        fileName: row.file_name || null,
        fileMime: row.file_mime || null,
        fileSize: row.file_size || null,
        fileStorageKey: row.file_storage_key || null,
        errorMessage: row.error_message || null,
        createdAt: this.toIsoDate(row.created_at),
        updatedAt: this.toIsoDate(row.updated_at)
      }));
      
      logger.info(`[STORAGE] Transformed ${transformed.length} sources. First: id=${transformed[0]?.id} contentText.length=${transformed[0]?.contentText?.length || 0}`);
      
      return transformed;
    } catch (error: any) {
      // NO SILENT CATCH - log and RETHROW so callers know something failed
      logger.error(`[STORAGE] ❌ ERROR fetching data sources for userId=${userId}:`, error.message);
      logger.error(`[STORAGE] Stack:`, error.stack);
      throw error; // Rethrow - don't hide errors with empty array
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // USER TASKS - Dashboard Operations (DB-Persistent)
  // ═══════════════════════════════════════════════════════════════

  async listUserTasks(userId: string, filters?: {
    status?: 'open' | 'done' | 'all';
    sourceType?: 'call' | 'space' | 'manual';
    sourceId?: string;
    includeDone?: boolean;
    limit?: number;
    sinceDays?: number;
  }): Promise<UserTask[]> {
    try {
      const conditions = [eq(userTasks.userId, userId)];
      
      // Status filter
      if (filters?.status && filters.status !== 'all') {
        conditions.push(eq(userTasks.status, filters.status));
      } else if (!filters?.includeDone && filters?.status !== 'all') {
        conditions.push(eq(userTasks.status, 'open'));
      }
      
      // Source type filter
      if (filters?.sourceType) {
        conditions.push(eq(userTasks.sourceType, filters.sourceType));
      }
      
      // Source ID filter
      if (filters?.sourceId) {
        conditions.push(eq(userTasks.sourceId, filters.sourceId));
      }
      
      // Since days filter
      if (filters?.sinceDays) {
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - filters.sinceDays);
        conditions.push(sql`${userTasks.createdAt} >= ${sinceDate}`);
      }
      
      let query = db
        .select()
        .from(userTasks)
        .where(and(...conditions))
        .orderBy(desc(userTasks.createdAt));
      
      if (filters?.limit) {
        query = query.limit(filters.limit) as any;
      }
      
      const result = await query;
      logger.info(`[STORAGE] listUserTasks for userId=${userId}: found ${result.length} tasks`);
      return result;
    } catch (error: any) {
      logger.error(`[STORAGE] Error listing user tasks:`, error.message);
      return [];
    }
  }

  async upsertUserTask(task: InsertUserTask): Promise<UserTask> {
    try {
      // Check if task with same fingerprint exists
      const existing = await this.getTaskByFingerprint(task.userId, task.fingerprint);
      
      if (existing) {
        // Update existing task (only certain fields)
        const [updated] = await db
          .update(userTasks)
          .set({
            title: task.title,
            details: task.details,
            priority: task.priority,
            dueAt: task.dueAt,
            updatedAt: new Date(),
          })
          .where(eq(userTasks.id, existing.id))
          .returning();
        logger.info(`[STORAGE] Updated existing task: ${updated.id}`);
        return updated;
      } else {
        // Create new task
        const [created] = await db
          .insert(userTasks)
          .values({
            ...task,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();
        logger.info(`[STORAGE] Created new task: ${created.id}`);
        return created;
      }
    } catch (error: any) {
      logger.error(`[STORAGE] Error upserting task:`, error.message);
      throw error;
    }
  }

  async setTaskDone(userId: string, taskId: string, done: boolean): Promise<UserTask | null> {
    try {
      const [updated] = await db
        .update(userTasks)
        .set({
          status: done ? 'done' : 'open',
          completedAt: done ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(and(eq(userTasks.id, taskId), eq(userTasks.userId, userId)))
        .returning();
      
      if (updated) {
        logger.info(`[STORAGE] Task ${taskId} marked as ${done ? 'done' : 'open'}`);
      }
      return updated || null;
    } catch (error: any) {
      logger.error(`[STORAGE] Error setting task done:`, error.message);
      return null;
    }
  }

  async snoozeTask(userId: string, taskId: string, snoozedUntil: Date | null): Promise<UserTask | null> {
    try {
      const [updated] = await db
        .update(userTasks)
        .set({
          snoozedUntil,
          updatedAt: new Date(),
        })
        .where(and(eq(userTasks.id, taskId), eq(userTasks.userId, userId)))
        .returning();
      
      if (updated) {
        logger.info(`[STORAGE] Task ${taskId} snoozed until ${snoozedUntil?.toISOString() || 'null'}`);
      }
      return updated || null;
    } catch (error: any) {
      logger.error(`[STORAGE] Error snoozing task:`, error.message);
      return null;
    }
  }

  async createManualTask(
    userId: string, 
    title: string, 
    dueAt?: Date, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<UserTask> {
    try {
      const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const fingerprint = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      
      const [created] = await db
        .insert(userTasks)
        .values({
          id: taskId,
          userId,
          sourceType: 'manual',
          sourceId: null,
          fingerprint,
          title: title.slice(0, 180),
          priority,
          dueAt: dueAt || null,
          status: 'open',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      logger.info(`[STORAGE] Created manual task: ${created.id}`);
      return created;
    } catch (error: any) {
      logger.error(`[STORAGE] Error creating manual task:`, error.message);
      throw error;
    }
  }

  async getTaskByFingerprint(userId: string, fingerprint: string): Promise<UserTask | null> {
    try {
      const [task] = await db
        .select()
        .from(userTasks)
        .where(and(eq(userTasks.userId, userId), eq(userTasks.fingerprint, fingerprint)));
      return task || null;
    } catch (error: any) {
      logger.error(`[STORAGE] Error getting task by fingerprint:`, error.message);
      return null;
    }
  }

  // ========================================
  // MAIL INBOUND - Gmail Intake Storage
  // ========================================

  async upsertInboundMail(payload: {
    source?: string;
    messageId: string;
    threadId?: string | null;
    mailbox?: string | null;
    fromEmail: string;
    fromName?: string | null;
    toEmails?: string[];
    ccEmails?: string[];
    subject?: string;
    snippet?: string;
    bodyText?: string;
    bodyHtml?: string;
    receivedAt: Date;
    labels?: string[];
    meta?: Record<string, any>;
  }): Promise<{ id: number; status: string; isNew: boolean }> {
    try {
      const source = payload.source || 'gmail';
      const mailbox = payload.mailbox || null;
      
      // Check if record exists (idempotency check)
      const existing = await db
        .select({ id: mailInbound.id, status: mailInbound.status })
        .from(mailInbound)
        .where(and(
          eq(mailInbound.source, source),
          mailbox ? eq(mailInbound.mailbox, mailbox) : sql`${mailInbound.mailbox} IS NULL`,
          eq(mailInbound.messageId, payload.messageId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Record exists - only update if status is NEW (don't overwrite processed data)
        const record = existing[0];
        if (record.status === 'NEW') {
          // Update labels and meta only (don't overwrite content)
          await db
            .update(mailInbound)
            .set({
              labels: payload.labels || [],
              meta: payload.meta || {},
              updatedAt: new Date(),
            })
            .where(eq(mailInbound.id, record.id));
        }
        logger.info(`[MAIL-INBOUND] Duplicate detected, id=${record.id}, status=${record.status}`);
        return { id: record.id, status: record.status, isNew: false };
      }

      // Insert new record
      const [inserted] = await db
        .insert(mailInbound)
        .values({
          source,
          messageId: payload.messageId,
          threadId: payload.threadId || null,
          mailbox,
          fromEmail: payload.fromEmail,
          fromName: payload.fromName || null,
          toEmails: payload.toEmails || [],
          ccEmails: payload.ccEmails || [],
          subject: payload.subject || '',
          snippet: payload.snippet || '',
          bodyText: payload.bodyText || '',
          bodyHtml: payload.bodyHtml || '',
          receivedAt: payload.receivedAt,
          labels: payload.labels || [],
          status: 'NEW',
          meta: payload.meta || {},
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning({ id: mailInbound.id, status: mailInbound.status });

      logger.info(`[MAIL-INBOUND] Created new mail, id=${inserted.id}`);
      return { id: inserted.id, status: inserted.status, isNew: true };
    } catch (error: any) {
      logger.error(`[MAIL-INBOUND] Error upserting mail:`, error.message);
      throw error;
    }
  }

  async listInboundMail(options: {
    status?: string;
    q?: string;
    limit?: number;
    cursor?: number;
  } = {}): Promise<MailInbound[]> {
    try {
      const limit = Math.min(options.limit || 50, 100);
      const conditions: any[] = [];

      if (options.status) {
        conditions.push(eq(mailInbound.status, options.status));
      }
      if (options.cursor) {
        conditions.push(sql`${mailInbound.id} < ${options.cursor}`);
      }
      if (options.q) {
        const searchTerm = `%${options.q}%`;
        conditions.push(sql`(
          ${mailInbound.subject} ILIKE ${searchTerm} OR
          ${mailInbound.fromEmail} ILIKE ${searchTerm} OR
          ${mailInbound.fromName} ILIKE ${searchTerm} OR
          ${mailInbound.snippet} ILIKE ${searchTerm}
        )`);
      }

      const query = db
        .select()
        .from(mailInbound)
        .orderBy(desc(mailInbound.receivedAt))
        .limit(limit);

      if (conditions.length > 0) {
        return await query.where(and(...conditions));
      }
      return await query;
    } catch (error: any) {
      logger.error(`[MAIL-INBOUND] Error listing mail:`, error.message);
      return [];
    }
  }

  async getInboundMailById(id: number): Promise<MailInbound | null> {
    try {
      const [mail] = await db
        .select()
        .from(mailInbound)
        .where(eq(mailInbound.id, id));
      return mail || null;
    } catch (error: any) {
      logger.error(`[MAIL-INBOUND] Error getting mail by id:`, error.message);
      return null;
    }
  }
}


// Use database storage for persistent data
export const storage = new DatabaseStorage();
