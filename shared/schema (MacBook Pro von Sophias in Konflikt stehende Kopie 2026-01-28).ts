import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  integer,
  boolean,
  serial,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "nanoid";

// Session storage table for authentication system
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table with simple auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  subscriptionPlan: varchar("subscription_plan").default("starter"), // starter, professional, enterprise
  subscriptionStatus: varchar("subscription_status").default("trial_pending"), // trial_pending, trialing, active, canceled, past_due, requires_payment
  subscriptionStartDate: timestamp("subscription_start_date").defaultNow(),
  subscriptionEndDate: timestamp("subscription_end_date"),
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  trialMessagesUsed: integer("trial_messages_used").default(0),
  hasPaymentMethod: boolean("has_payment_method").default(false),
  stripePaymentMethodId: varchar("stripe_payment_method_id"),
  aiMessagesUsed: integer("ai_messages_used").default(0),
  voiceCallsUsed: integer("voice_calls_used").default(0),
  monthlyResetDate: timestamp("monthly_reset_date").defaultNow(),
  threadId: varchar("thread_id"), // OpenAI Assistant thread ID
  assistantId: varchar("assistant_id"), // OpenAI Assistant ID
  
  // 🔥 BUSINESS INTELLIGENCE FIELDS
  company: varchar("company"),
  website: varchar("website"),
  industry: varchar("industry"),
  jobRole: varchar("job_role"), // Renamed: user's job title
  phone: varchar("phone"),
  
  // 🔐 INTERNAL: Role-Based Access Control (RBAC)
  userRole: varchar("user_role").default("user").notNull(), // "user", "admin", "staff"
  language: varchar("language").default("de"),
  primaryGoal: varchar("primary_goal"),
  
  // 🔥 AI PROFILE - ULTRA-DEEP Intelligence & Personalization
  aiProfile: jsonb("ai_profile").$type<{
    // Core Company Intelligence
    companyDescription?: string;
    products?: string[];
    services?: string[];
    targetAudience?: string;
    competitors?: string[];
    brandVoice?: string;
    valueProp?: string;
    
    // 🔥 ULTRA-DEEP Company Intelligence (Pro Research™)
    uniqueSellingPoints?: string[];
    foundedYear?: string | number | null;
    ceoName?: string | null;
    employeeCount?: string | number | null;
    revenue?: string | null;
    fundingInfo?: string | null;
    onlinePresence?: string | null;
    currentChallenges?: string[];
    opportunities?: string[];
    recentNews?: string[];
    decisionMakers?: string[];
    psychologicalProfile?: string | null;
    salesTriggers?: string[];
    communicationPreferences?: string | null;
    budgetCycles?: string | null;
    insiderInfo?: string | null;
    
    // User Intelligence
    communicationStyle?: string;
    expertise?: string[];
    goals?: string[];
    
    // AI Optimization
    customSystemPrompt?: string;
    effectiveKeywords?: string[];
    bestCallTimes?: string;
    industryInsights?: any;
    
    // Learning & Analytics
    conversationInsights?: any;
    learnedKeywords?: string[];
    preferredStyle?: string;
    lastUpdated?: string;
    
    // 🧠 DEEP PERSONAL INTELLIGENCE (from SPACE chats)
    personalityType?: string;  // e.g. "Analytical, Direct, Results-Driven"
    communicationTone?: string;  // e.g. "Professional but casual"
    decisionMakingStyle?: string;  // e.g. "Data-driven, Fast-paced"
    emotionalTriggers?: string[];  // What motivates/frustrates them
    workingHours?: string;  // Observed active times
    responsePatterns?: string;  // How they typically respond
    interests?: string[];  // Topics they discuss
    painPoints?: string[];  // Problems they mention
    aspirations?: string[];  // Goals they express
    vocabulary?: string[];  // Common words/phrases they use
    urgencyLevel?: string;  // How urgent their needs are
    trustLevel?: string;  // How much they trust AI/automation
    technicalLevel?: string;  // Tech-savvy rating
    collaborationStyle?: string;  // How they work with others
    priorityFocus?: string[];  // What they care about most
    stressIndicators?: string[];  // Signs of stress/pressure
    successMetrics?: string[];  // How they measure success
    learningStyle?: string;  // How they prefer to learn
    feedbackStyle?: string;  // How they give/receive feedback
    chatInsightsSummary?: string;  // Gemini-generated summary of all chats
    lastChatAnalysis?: string;  // Timestamp of last analysis
  }>(),
  
  profileEnriched: boolean("profile_enriched").default(false),
  lastEnrichmentDate: timestamp("last_enrichment_date"),
  
  // User Settings
  notificationSettings: jsonb("notification_settings").$type<{
    emailNotifications?: boolean;
    campaignAlerts?: boolean;
    weeklyReports?: boolean;
    aiSuggestions?: boolean;
  }>(),
  privacySettings: jsonb("privacy_settings").$type<{
    dataCollection?: boolean;
    analytics?: boolean;
    thirdPartySharing?: boolean;
  }>(),
  
  // 🔐 Password Reset Token
  passwordResetToken: varchar("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Leads table
export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  company: varchar("company"),
  status: varchar("status").default("cold"), // cold, warm, hot, contacted, converted
  lastContact: timestamp("last_contact"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contacts table for user's business contacts
export const calendarEvents = pgTable("calendar_events", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").notNull(),
  description: text("description"),
  date: varchar("date").notNull(), // Store as YYYY-MM-DD string
  time: varchar("time").notNull(),
  duration: integer("duration").notNull().default(60), // in minutes
  location: varchar("location"),
  attendees: text("attendees"),
  type: varchar("type", { enum: ["call", "meeting", "reminder", "other"] }).notNull().default("meeting"),
  status: varchar("status", { enum: ["scheduled", "completed", "cancelled"] }).notNull().default("scheduled"),
  callId: varchar("call_id"), // Reference to call if created from call
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  company: varchar("company").notNull(), // Required field
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  email: varchar("email"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Campaigns table
export const campaigns = pgTable("campaigns", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: varchar("name").notNull(),
  description: text("description"),
  status: varchar("status").default("draft"), // draft, active, paused, completed
  totalLeads: integer("total_leads").default(0),
  contacted: integer("contacted").default(0),
  converted: integer("converted").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat sessions table
// NOTE: metadata column removed - DB doesn't have it and causes INSERT errors
export const chatSessions = pgTable("chat_sessions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: varchar("title").default("New Chat"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").references(() => chatSessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isAi: boolean("is_ai").default(false),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Voice agents table - Enhanced for customization
export const voiceAgents = pgTable("voice_agents", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id), // null for system agents, user_id for custom agents
  name: varchar("name").notNull(),
  description: text("description"),
  voice: varchar("voice").notNull(), // professional, friendly, authoritative, custom
  personality: text("personality"), // Detailed personality description
  customScript: text("custom_script"), // Custom greeting/introduction script
  ttsVoice: varchar("tts_voice").default("nova"), // OpenAI TTS voice: alloy, echo, fable, nova, onyx, shimmer
  language: varchar("language").default("en"), // Language code
  industry: varchar("industry"), // Industry specialization (real_estate, finance, healthcare, etc.)
  isSystemAgent: boolean("is_system_agent").default(false), // System vs user-created
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Call logs table - UPDATED for Retell integration
export const callLogs = pgTable("call_logs", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  leadId: integer("lead_id").references(() => leads.id),
  voiceAgentId: integer("voice_agent_id").references(() => voiceAgents.id),
  phoneNumber: varchar("phone_number").notNull(),
  contactName: varchar("contact_name"), // Name of contact for AI processing
  retellCallId: varchar("retell_call_id").unique(),
  status: varchar("status").default("initiated"),
  duration: integer("duration"),
  transcript: text("transcript"),
  customPrompt: text("custom_prompt"),
  recordingUrl: varchar("recording_url"),
  metadata: jsonb("metadata"),
  processedForCalendar: boolean("processed_for_calendar").default(false), // AI calendar processing flag
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: varchar("id").primaryKey(), // free, pro, ultra, ultimate
  name: varchar("name").notNull(),
  price: integer("price").notNull(), // in cents
  aiMessagesLimit: integer("ai_messages_limit"), // null = unlimited
  voiceCallsLimit: integer("voice_calls_limit"), // null = unlimited
  leadsLimit: integer("leads_limit"), // null = unlimited
  campaignsLimit: integer("campaigns_limit"), // null = unlimited
  features: text("features").array(), // array of feature names
  stripePriceId: varchar("stripe_price_id"), // Stripe Price ID for subscription
  stripeProductId: varchar("stripe_product_id"), // Stripe Product ID
  isActive: boolean("is_active").default(true),
});

// Usage tracking table
export const usageTracking = pgTable("usage_tracking", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: varchar("type").notNull(), // ai_message, voice_call, lead_created, campaign_created
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schema exports
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = typeof chatSessions.$inferInsert;

// Twilio settings schema
export const twilioSettings = pgTable("twilio_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  accountSid: varchar("account_sid"),
  authToken: varchar("auth_token"),
  phoneNumber: varchar("phone_number"),
  configured: boolean("configured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type TwilioSettings = typeof twilioSettings.$inferSelect;
export type InsertTwilioSettings = typeof twilioSettings.$inferInsert;

export const voiceTasks = pgTable("voice_tasks", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  taskName: varchar("task_name", { length: 255 }).notNull(),
  taskPrompt: text("task_prompt").notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  callId: varchar("call_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at"),
  executedAt: timestamp("executed_at"),
});

export type VoiceTask = typeof voiceTasks.$inferSelect;
export type InsertVoiceTask = typeof voiceTasks.$inferInsert;

// Subscription response types
export type SubscriptionResponse = {
  plan: string;
  status: string;
  aiMessagesUsed: number;
  voiceCallsUsed: number;
  aiMessagesLimit: number | null;
  voiceCallsLimit: number | null;
  renewalDate: string | null;
  trialMessagesUsed?: number;
  trialEndDate?: string | null;
  hasPaymentMethod: boolean;
  requiresPaymentSetup: boolean;
  isTrialActive: boolean;
  canUpgrade: boolean;
};

// Plan configuration types
export type PlanConfig = {
  id: string;
  name: string;
  price: number;
  trialMessages: number;
  aiMessagesLimit: number | null;
  voiceCallsLimit: number | null;
  features: string[];
  stripePriceId?: string;
  popular?: boolean;
};

// Payment setup requirements
export type PaymentSetupResponse = {
  clientSecret: string;
  setupIntentId: string;
  needsCardSetup: boolean;
};

export type InsertLead = typeof leads.$inferInsert;
export type CalendarEvent = typeof calendarEvents.$inferSelect;
export type InsertCalendarEvent = typeof calendarEvents.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;
export type InsertCampaign = typeof campaigns.$inferInsert;
export type Campaign = typeof campaigns.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type VoiceAgent = typeof voiceAgents.$inferSelect;
export type CallLog = typeof callLogs.$inferSelect;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type UsageTracking = typeof usageTracking.$inferSelect;

// Insert schemas
export const insertLeadSchema = createInsertSchema(leads).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  timestamp: true,
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Login schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginData = z.infer<typeof loginSchema>;

// Sanitized user type that excludes sensitive fields
export type SafeUser = Omit<User, 'password'>;

// Function to sanitize user data for API responses
export function sanitizeUser(user: User): SafeUser {
  const { password, ...safeUser } = user;
  return safeUser;
}

// 🎈 FEEDBACK & BUG REPORTS (Alpha Phase)
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").references(() => users.id),
  type: varchar("type").notNull(), // 'feedback' or 'bug'
  rating: integer("rating"), // 1-5 stars (nur für feedback)
  title: varchar("title"),
  description: text("description").notNull(),
  screenshot: text("screenshot"), // base64 data URL
  pageUrl: varchar("page_url").notNull(),
  userAgent: text("user_agent"),
  browserInfo: jsonb("browser_info").$type<{
    browser?: string;
    version?: string;
    os?: string;
    screen?: string;
  }>(),
  status: varchar("status").default("new"), // new, in_progress, resolved, closed
  priority: varchar("priority").default("medium"), // low, medium, high, critical
  assignedTo: varchar("assigned_to"),
  tags: jsonb("tags").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = typeof feedback.$inferInsert;

// ============================================================================
// 📁 USER DATA SOURCES - Knowledge Base for SPACE/POWER
// ============================================================================
// User-uploaded content: PDFs, text snippets, URLs
// Used to enrich AI context in chat and voice calls
// ============================================================================

export const userDataSources = pgTable("user_data_sources", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Type: "file" | "text" | "url"
  type: varchar("type", { enum: ["file", "text", "url"] }).notNull(),
  
  // Metadata
  title: varchar("title"), // User-provided title (optional)
  status: varchar("status", { enum: ["pending", "processing", "active", "failed"] }).default("active").notNull(),
  
  // Content (for text/url types, or extracted text from files)
  contentText: text("content_text"),
  
  // URL specific
  url: text("url"),
  
  // File specific
  fileName: varchar("file_name"),
  fileMime: varchar("file_mime"),
  fileSize: integer("file_size"), // in bytes
  fileStorageKey: varchar("file_storage_key"), // path or key for file storage
  
  // Error handling
  errorMessage: text("error_message"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("user_data_sources_user_id_idx").on(table.userId),
  index("user_data_sources_user_created_idx").on(table.userId, table.createdAt),
  index("user_data_sources_type_idx").on(table.userId, table.type),
]);

export type UserDataSource = typeof userDataSources.$inferSelect;
export type InsertUserDataSource = typeof userDataSources.$inferInsert;

export const insertUserDataSourceSchema = createInsertSchema(userDataSources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCallLogSchema = createInsertSchema(callLogs).omit({
  id: true,
  createdAt: true,
});

// Voice agent insert schema
export const insertVoiceAgentSchema = createInsertSchema(voiceAgents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertVoiceAgent = z.infer<typeof insertVoiceAgentSchema>;

// ============================================================================
// 🎯 INTERNAL CRM SYSTEM - ARAS COMMAND CENTER
// ============================================================================
// Diese Tabellen sind NUR für interne Team-Nutzung (admin/staff)
// Komplett getrennt vom Public User-System
// ============================================================================

// Internal Companies - für Investoren, Partner, Kunden
export const internalCompanies = pgTable("internal_companies", {
  id: varchar("id").primaryKey().notNull(),
  name: varchar("name").notNull(),
  website: varchar("website"),
  industry: varchar("industry"),
  tags: jsonb("tags").$type<string[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("internal_companies_name_idx").on(table.name),
]);

// Internal Contacts - Ansprechpartner in Companies
export const internalContacts = pgTable("internal_contacts", {
  id: varchar("id").primaryKey().notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  email: varchar("email"),
  phone: varchar("phone"),
  position: varchar("position"),
  companyId: varchar("company_id").references(() => internalCompanies.id),
  source: varchar("source"), // "Investor", "Lead", "Partner", "Customer"
  status: varchar("status", { enum: ["NEW", "ACTIVE", "ARCHIVED"] }).default("NEW").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("internal_contacts_email_idx").on(table.email),
  index("internal_contacts_phone_idx").on(table.phone),
  index("internal_contacts_company_idx").on(table.companyId),
]);

// Internal Deals - Sales Pipeline
export const internalDeals = pgTable("internal_deals", {
  id: varchar("id").primaryKey().notNull(),
  title: varchar("title").notNull(),
  value: integer("value"), // in cents
  currency: varchar("currency").default("EUR").notNull(),
  stage: varchar("stage", { 
    enum: ["IDEA", "CONTACTED", "NEGOTIATION", "COMMITTED", "CLOSED_WON", "CLOSED_LOST"] 
  }).default("IDEA").notNull(),
  contactId: varchar("contact_id").references(() => internalContacts.id),
  companyId: varchar("company_id").references(() => internalCompanies.id),
  ownerUserId: varchar("owner_user_id").references(() => users.id),
  probability: integer("probability"), // 0-100
  closeDate: timestamp("close_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("internal_deals_stage_idx").on(table.stage),
  index("internal_deals_owner_idx").on(table.ownerUserId),
]);

// Internal Tasks - To-Dos für Team
export const internalTasks = pgTable("internal_tasks", {
  id: varchar("id").primaryKey().notNull(),
  title: varchar("title").notNull(),
  description: text("description"),
  status: varchar("status", { 
    enum: ["OPEN", "IN_PROGRESS", "DONE", "CANCELLED"] 
  }).default("OPEN").notNull(),
  dueDate: timestamp("due_date"),
  assignedUserId: varchar("assigned_user_id").references(() => users.id),
  relatedContactId: varchar("related_contact_id").references(() => internalContacts.id),
  relatedDealId: varchar("related_deal_id").references(() => internalDeals.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("internal_tasks_status_idx").on(table.status),
  index("internal_tasks_assigned_idx").on(table.assignedUserId),
  index("internal_tasks_due_date_idx").on(table.dueDate),
]);

// Internal Call Logs - Telefonie-Historie
export const internalCallLogs = pgTable("internal_call_logs", {
  id: varchar("id").primaryKey().notNull(),
  contactId: varchar("contact_id").references(() => internalContacts.id),
  source: varchar("source", { 
    enum: ["RETELL", "ELEVENLABS", "TWILIO", "OTHER"] 
  }).default("OTHER").notNull(),
  externalCallId: varchar("external_call_id"), // ID vom Provider
  phoneNumber: varchar("phone_number"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  durationSeconds: integer("duration_seconds"),
  outcome: varchar("outcome"), // "REACHED", "NO_ANSWER", "VOICEMAIL"
  sentiment: varchar("sentiment", { 
    enum: ["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"] 
  }),
  summary: text("summary"), // KI-generierte Zusammenfassung
  recordingUrl: varchar("recording_url"),
  rawMetadata: jsonb("raw_metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("internal_call_logs_contact_idx").on(table.contactId),
  index("internal_call_logs_phone_idx").on(table.phoneNumber),
  index("internal_call_logs_timestamp_idx").on(table.timestamp),
]);

// Internal Notes - Notizen zu Contacts/Deals
export const internalNotes = pgTable("internal_notes", {
  id: varchar("id").primaryKey().notNull(),
  contactId: varchar("contact_id").references(() => internalContacts.id),
  dealId: varchar("deal_id").references(() => internalDeals.id),
  authorUserId: varchar("author_user_id").references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("internal_notes_contact_idx").on(table.contactId),
  index("internal_notes_deal_idx").on(table.dealId),
]);

// Type Exports für Internal CRM
export type InternalCompany = typeof internalCompanies.$inferSelect;
export type InsertInternalCompany = typeof internalCompanies.$inferInsert;
export type InternalContact = typeof internalContacts.$inferSelect;
export type InsertInternalContact = typeof internalContacts.$inferInsert;
export type InternalDeal = typeof internalDeals.$inferSelect;
export type InsertInternalDeal = typeof internalDeals.$inferInsert;
export type InternalTask = typeof internalTasks.$inferSelect;
export type InsertInternalTask = typeof internalTasks.$inferInsert;
export type InternalCallLog = typeof internalCallLogs.$inferSelect;
export type InsertInternalCallLog = typeof internalCallLogs.$inferInsert;
export type InternalNote = typeof internalNotes.$inferSelect;
export type InsertInternalNote = typeof internalNotes.$inferInsert;

// ============================================================================
// USER TASKS - Dashboard Action Items (DB-Persistent)
// ============================================================================
// Tasks extracted from Call/Space summaries or manually created
// Used in Dashboard Operations panel for 1-click completion
// ============================================================================

export const userTasks = pgTable("user_tasks", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Source tracking
  sourceType: varchar("source_type", { enum: ["call", "space", "manual"] }).notNull(),
  sourceId: varchar("source_id"), // callId or sessionId as string
  fingerprint: varchar("fingerprint").notNull(), // unique per (userId, sourceType, sourceId, fingerprint)
  
  // Task content
  title: varchar("title", { length: 180 }).notNull(),
  details: text("details"), // optional extended info
  
  // Priority & scheduling
  priority: varchar("priority", { enum: ["low", "medium", "high"] }).default("medium").notNull(),
  dueAt: timestamp("due_at"),
  snoozedUntil: timestamp("snoozed_until"),
  
  // Status
  status: varchar("status", { enum: ["open", "done"] }).default("open").notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("user_tasks_user_id_idx").on(table.userId),
  index("user_tasks_user_status_idx").on(table.userId, table.status),
  index("user_tasks_user_source_idx").on(table.userId, table.sourceType),
  index("user_tasks_fingerprint_idx").on(table.userId, table.fingerprint),
  index("user_tasks_due_at_idx").on(table.dueAt),
]);

export type UserTask = typeof userTasks.$inferSelect;
export type InsertUserTask = typeof userTasks.$inferInsert;

export const insertUserTaskSchema = createInsertSchema(userTasks).omit({
  createdAt: true,
  updatedAt: true,
});

// ============================================================================
// DAILY BRIEFINGS - AI-generated Mission Briefings (DB-Cached)
// ============================================================================
// Cached Gemini-generated briefings per user with TTL
// Mode: "cached" (6h TTL) or "realtime" (10min TTL)
// ============================================================================

export const dailyBriefings = pgTable("daily_briefings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Mode and caching
  mode: varchar("mode", { enum: ["cached", "realtime"] }).default("cached").notNull(),
  
  // Briefing payload (JSON)
  payload: jsonb("payload").$type<{
    headline: string;
    missionSummary?: string;
    topPriorities: Array<{
      title: string;
      why: string;
      callId?: string;
      contactId?: string;
      contactName?: string;
      impact?: string;
      action?: string;
    }>;
    quickWins: string[];
    riskFlags: string[];
  }>().notNull(),
  
  // Optional sources from Gemini grounding
  sources: jsonb("sources").$type<Array<{
    title: string;
    url?: string;
    publisher?: string;
    date?: string;
  }>>(),
  
  // Personalization context used
  personalization: jsonb("personalization").$type<{
    industry?: string;
    region?: string;
    persona?: string;
    callsAnalyzed?: number;
    followupsAnalyzed?: number;
  }>(),
  
  // Timestamps and expiry
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
}, (table) => [
  index("daily_briefings_user_id_idx").on(table.userId),
  index("daily_briefings_user_mode_idx").on(table.userId, table.mode),
  index("daily_briefings_expires_at_idx").on(table.expiresAt),
]);

export type DailyBriefing = typeof dailyBriefings.$inferSelect;
export type InsertDailyBriefing = typeof dailyBriefings.$inferInsert;

// ============================================================================
// N8N EMAIL LOGS - Track all emails sent via N8N workflows
// ============================================================================
// Logs all emails sent from N8N workflows for admin dashboard tracking
// Receives webhook data from N8N after each email send
// ============================================================================

export const n8nEmailLogs = pgTable("n8n_email_logs", {
  id: serial("id").primaryKey(),
  
  // Email Data (from webhook)
  recipient: text("recipient").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  content: text("content"), // Optional: Email content or summary
  htmlContent: text("html_content"), // Optional: Full HTML body
  
  // Status & Tracking
  status: text("status").notNull().default("sent"), // 'pending' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'bounced' | 'failed'
  
  // N8N Workflow Reference
  workflowId: text("workflow_id"), // "26fcYVxGxAlswgcW"
  workflowName: text("workflow_name"), // "ARAS Mail DEV"
  executionId: text("execution_id"), // N8N execution ID
  
  // Metadata (flexible additional data)
  metadata: jsonb("metadata").$type<{
    tags?: string[];
    campaign?: string;
    template?: string;
    variables?: Record<string, any>;
    provider?: string;
    errorMessage?: string;
    [key: string]: any;
  }>(),
  
  // Timestamps
  sentAt: timestamp("sent_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("n8n_email_logs_recipient_idx").on(table.recipient),
  index("n8n_email_logs_workflow_idx").on(table.workflowId),
  index("n8n_email_logs_status_idx").on(table.status),
  index("n8n_email_logs_sent_at_idx").on(table.sentAt),
]);

export type N8nEmailLog = typeof n8nEmailLogs.$inferSelect;
export type InsertN8nEmailLog = typeof n8nEmailLogs.$inferInsert;

// ============================================================================
// COMMAND CENTER - Staff & Team Management
// ============================================================================
// Internal tools for admin/staff: invitations, activity logs, chat, tasks
// ============================================================================

// Staff Invitations - Invite new team members
export const staffInvitations = pgTable("staff_invitations", {
  id: text("id").primaryKey().$defaultFn(() => `inv_${nanoid()}`),
  email: text("email").notNull(),
  role: text("role").notNull().default("staff"), // 'staff' | 'admin'
  invitedBy: text("invited_by").references(() => users.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'expired' | 'revoked'
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("staff_invitations_email_idx").on(table.email),
  index("staff_invitations_token_idx").on(table.token),
  index("staff_invitations_status_idx").on(table.status),
]);

export type StaffInvitation = typeof staffInvitations.$inferSelect;
export type InsertStaffInvitation = typeof staffInvitations.$inferInsert;

// Staff Activity Log - Audit trail for all admin actions
export const staffActivityLog = pgTable("staff_activity_log", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // 'user_viewed' | 'user_edited' | 'plan_changed' | 'password_reset' | 'user_deleted' | 'export_created' | 'workflow_toggled' | 'task_created' | 'message_sent' | 'staff_invited' | 'invitation_revoked' | 'role_changed' | 'staff_removed'
  targetType: text("target_type"), // 'user' | 'lead' | 'call' | 'workflow' | 'task' | 'invitation'
  targetId: text("target_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("staff_activity_log_user_idx").on(table.userId),
  index("staff_activity_log_action_idx").on(table.action),
  index("staff_activity_log_target_idx").on(table.targetType, table.targetId),
  index("staff_activity_log_created_idx").on(table.createdAt),
]);

export type StaffActivityLog = typeof staffActivityLog.$inferSelect;
export type InsertStaffActivityLog = typeof staffActivityLog.$inferInsert;

// ============================================================================
// COMMAND CENTER - Team Chat
// ============================================================================

// Chat Channels
export const teamChatChannels = pgTable("team_chat_channels", {
  id: text("id").primaryKey().$defaultFn(() => `channel_${nanoid()}`),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("public"), // 'public' | 'private' | 'direct'
  createdBy: text("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("team_chat_channels_type_idx").on(table.type),
]);

export type TeamChatChannel = typeof teamChatChannels.$inferSelect;
export type InsertTeamChatChannel = typeof teamChatChannels.$inferInsert;

// Chat Messages
export const teamChatMessages = pgTable("team_chat_messages", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").references(() => teamChatChannels.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  replyToId: integer("reply_to_id"),
  attachments: jsonb("attachments").$type<Array<{type: string; url: string; name: string}>>(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("team_chat_messages_channel_idx").on(table.channelId),
  index("team_chat_messages_user_idx").on(table.userId),
  index("team_chat_messages_created_idx").on(table.createdAt),
]);

export type TeamChatMessage = typeof teamChatMessages.$inferSelect;
export type InsertTeamChatMessage = typeof teamChatMessages.$inferInsert;

// Channel Members
export const teamChatChannelMembers = pgTable("team_chat_channel_members", {
  id: serial("id").primaryKey(),
  channelId: text("channel_id").references(() => teamChatChannels.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().default("member"), // 'owner' | 'admin' | 'member'
  lastReadAt: timestamp("last_read_at"),
  mutedUntil: timestamp("muted_until"),
  joinedAt: timestamp("joined_at").defaultNow(),
}, (table) => [
  index("team_chat_members_channel_idx").on(table.channelId),
  index("team_chat_members_user_idx").on(table.userId),
]);

export type TeamChatChannelMember = typeof teamChatChannelMembers.$inferSelect;
export type InsertTeamChatChannelMember = typeof teamChatChannelMembers.$inferInsert;

// ============================================================================
// COMMAND CENTER - Staff Tasks (Internal TODOs)
// ============================================================================

export const staffTasks = pgTable("staff_tasks", {
  id: text("id").primaryKey().$defaultFn(() => `task_${nanoid()}`),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"), // 'low' | 'medium' | 'high' | 'urgent'
  status: text("status").notNull().default("open"), // 'open' | 'in_progress' | 'review' | 'done' | 'archived'
  
  // Assignment
  assignedTo: text("assigned_to").references(() => users.id),
  createdBy: text("created_by").references(() => users.id).notNull(),
  
  // Related entity
  relatedType: text("related_type"), // 'user' | 'lead' | 'call' | 'contact'
  relatedId: text("related_id"),
  
  // Dates
  dueDate: timestamp("due_date"),
  completedAt: timestamp("completed_at"),
  
  // Tags
  tags: jsonb("tags").$type<string[]>(),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("staff_tasks_assigned_idx").on(table.assignedTo),
  index("staff_tasks_created_by_idx").on(table.createdBy),
  index("staff_tasks_status_idx").on(table.status),
  index("staff_tasks_priority_idx").on(table.priority),
  index("staff_tasks_due_date_idx").on(table.dueDate),
  index("staff_tasks_related_idx").on(table.relatedType, table.relatedId),
]);

export type StaffTask = typeof staffTasks.$inferSelect;
export type InsertStaffTask = typeof staffTasks.$inferInsert;

// Task Comments
export const staffTaskComments = pgTable("staff_task_comments", {
  id: serial("id").primaryKey(),
  taskId: text("task_id").references(() => staffTasks.id).notNull(),
  userId: text("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("staff_task_comments_task_idx").on(table.taskId),
]);

export type StaffTaskComment = typeof staffTaskComments.$inferSelect;
export type InsertStaffTaskComment = typeof staffTaskComments.$inferInsert;

// ============================================================================
// COMMAND CENTER - Saved Views & Filters
// ============================================================================

export const staffSavedViews = pgTable("staff_saved_views", {
  id: text("id").primaryKey().$defaultFn(() => `view_${nanoid()}`),
  userId: text("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
  entityType: text("entity_type").notNull(), // 'users' | 'leads' | 'calls'
  filters: jsonb("filters").$type<Record<string, any>>().notNull(),
  columns: jsonb("columns").$type<string[]>(),
  sortBy: text("sort_by"),
  sortOrder: text("sort_order"), // 'asc' | 'desc'
  isDefault: boolean("is_default").default(false),
  isShared: boolean("is_shared").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("staff_saved_views_user_idx").on(table.userId),
  index("staff_saved_views_entity_idx").on(table.entityType),
]);

export type StaffSavedView = typeof staffSavedViews.$inferSelect;
export type InsertStaffSavedView = typeof staffSavedViews.$inferInsert;

// ============================================================================
// COMMAND CENTER - Export Jobs
// ============================================================================

export const exportJobs = pgTable("export_jobs", {
  id: text("id").primaryKey().$defaultFn(() => `export_${nanoid()}`),
  userId: text("user_id").references(() => users.id).notNull(),
  entityType: text("entity_type").notNull(), // 'users' | 'leads' | 'calls' | 'emails'
  filters: jsonb("filters").$type<Record<string, any>>(),
  format: text("format").notNull().default("csv"), // 'csv' | 'xlsx' | 'json'
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
  totalRows: integer("total_rows"),
  processedRows: integer("processed_rows"),
  fileUrl: text("file_url"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("export_jobs_user_idx").on(table.userId),
  index("export_jobs_status_idx").on(table.status),
  index("export_jobs_created_idx").on(table.createdAt),
]);

export type ExportJob = typeof exportJobs.$inferSelect;
export type InsertExportJob = typeof exportJobs.$inferInsert;

// ============================================================================
// COMMAND CENTER - Admin Activity Log (Enhanced for Real-time Feed)
// ============================================================================

export const adminActivityLog = pgTable("admin_activity_log", {
  id: serial("id").primaryKey(),
  actorId: text("actor_id").notNull(),
  actorName: text("actor_name"),
  actorAvatar: text("actor_avatar"),
  actorRole: text("actor_role"),
  action: text("action").notNull(),
  actionCategory: text("action_category").notNull(),
  actionIcon: text("action_icon"),
  actionColor: text("action_color"),
  targetType: text("target_type"),
  targetId: text("target_id"),
  targetName: text("target_name"),
  targetUrl: text("target_url"),
  title: text("title").notNull(),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  aiInsight: text("ai_insight"),
  aiPriority: text("ai_priority"),
  aiSuggestion: text("ai_suggestion"),
  aiProcessedAt: timestamp("ai_processed_at"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  geoLocation: text("geo_location"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_activity_log_actor_idx").on(table.actorId),
  index("admin_activity_log_category_idx").on(table.actionCategory),
  index("admin_activity_log_created_idx").on(table.createdAt),
]);

export type AdminActivityLog = typeof adminActivityLog.$inferSelect;
export type InsertAdminActivityLog = typeof adminActivityLog.$inferInsert;

// ============================================================================
// COMMAND CENTER - Admin Notifications
// ============================================================================

export const adminNotifications = pgTable("admin_notifications", {
  id: serial("id").primaryKey(),
  recipientId: text("recipient_id"), // NULL = all admins
  type: text("type").notNull(), // 'info' | 'success' | 'warning' | 'error'
  category: text("category").notNull(), // 'user' | 'billing' | 'system' | 'call'
  title: text("title").notNull(),
  message: text("message"),
  icon: text("icon"),
  color: text("color"),
  actionUrl: text("action_url"),
  actionLabel: text("action_label"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_notifications_recipient_idx").on(table.recipientId),
  index("admin_notifications_read_idx").on(table.isRead),
  index("admin_notifications_created_idx").on(table.createdAt),
]);

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = typeof adminNotifications.$inferInsert;

// ============================================================================
// SERVICE ORDERS - Done-for-You Onboarding Flow
// ============================================================================
// Client orders for managed call services (e.g., calls_1000, calls_5000)
// Tracks payment, status, assigned staff, and timeline events
// ============================================================================

export const serviceOrders = pgTable("service_orders", {
  id: serial("id").primaryKey(),
  
  // Client/User reference
  clientUserId: varchar("client_user_id").references(() => users.id).notNull(),
  
  // Contact info (for orders without existing user account)
  companyName: varchar("company_name"),
  contactName: varchar("contact_name"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  
  // Package details
  packageCode: varchar("package_code").notNull(), // e.g., 'calls_1000', 'calls_5000'
  targetCalls: integer("target_calls").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: varchar("currency").notNull().default("eur"),
  
  // Order status
  status: varchar("status").notNull().default("draft"), // draft|paid|intake|in_progress|paused|completed|canceled
  
  // Payment tracking
  paymentStatus: varchar("payment_status").notNull().default("unpaid"), // unpaid|paid|failed|refunded
  paymentReference: varchar("payment_reference"), // Stripe payment intent ID or checkout session ID
  
  // Operational references
  campaignId: integer("campaign_id").references(() => campaigns.id), // Link to active campaign
  // TODO: Add lead_import_job_id when import_jobs table is created
  leadImportJobId: integer("lead_import_job_id"), // NULL for now - no import_jobs table yet
  
  // Staff assignment
  assignedStaffId: varchar("assigned_staff_id").references(() => users.id),
  
  // Flexible metadata
  metadata: jsonb("metadata").$type<{
    notes?: string;
    callsCompleted?: number;
    lastCallDate?: string;
    customFields?: Record<string, any>;
  }>(),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("service_orders_status_idx").on(table.status),
  index("service_orders_payment_status_idx").on(table.paymentStatus),
  index("service_orders_created_idx").on(table.createdAt),
  index("service_orders_client_idx").on(table.clientUserId),
  index("service_orders_staff_idx").on(table.assignedStaffId),
]);

export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type InsertServiceOrder = typeof serviceOrders.$inferInsert;

// Service Order Events - Timeline/Audit trail
export const serviceOrderEvents = pgTable("service_order_events", {
  id: serial("id").primaryKey(),
  
  // Parent order reference
  orderId: integer("order_id").references(() => serviceOrders.id).notNull(),
  
  // Event details
  type: varchar("type").notNull(), // created|paid|lead_upload|assigned|started|paused|completed|note
  title: varchar("title").notNull(),
  description: text("description"),
  
  // Actor who triggered the event
  actorId: varchar("actor_id").references(() => users.id),
  
  // Flexible metadata for event-specific data
  metadata: jsonb("metadata").$type<{
    previousStatus?: string;
    newStatus?: string;
    previousStaffId?: string;
    newStaffId?: string;
    paymentAmount?: number;
    [key: string]: any;
  }>(),
  
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("service_order_events_order_idx").on(table.orderId),
  index("service_order_events_type_idx").on(table.type),
  index("service_order_events_created_idx").on(table.createdAt),
]);

export type ServiceOrderEvent = typeof serviceOrderEvents.$inferSelect;
export type InsertServiceOrderEvent = typeof serviceOrderEvents.$inferInsert;
