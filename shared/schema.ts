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
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// 🔥 ENRICHMENT TYPE CONSTANTS (Single Source of Truth)
export const ENRICHMENT_STATUSES = ['live_research', 'fallback'] as const;
export type EnrichmentStatus = (typeof ENRICHMENT_STATUSES)[number];

export const ENRICHMENT_ERROR_CODES = [
  'timeout',
  'auth', 
  'quota',
  'model_not_found',
  'model_not_allowed',
  'parse',
  'missing_fields',
  'quality_gate_failed',
  'unknown'
] as const;
export type EnrichmentErrorCode = (typeof ENRICHMENT_ERROR_CODES)[number] | null;

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
    
    // 🔥 ENRICHMENT METADATA (tracks real vs fallback enrichment)
    enrichmentStatus?: EnrichmentStatus | null;  // Was real AI research or fallback used?
    enrichmentErrorCode?: EnrichmentErrorCode;  // Error type if fallback
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
  
  // Password Reset
  passwordResetTokenHash: varchar("password_reset_token_hash", { length: 64 }),
  passwordResetExpiresAt: timestamp("password_reset_expires_at"),
  passwordResetUsedAt: timestamp("password_reset_used_at"),
  
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
// ADMIN AUDIT LOG - Role changes and admin actions
// ============================================================================
// Tracks all role changes and sensitive admin actions for security audit
// ============================================================================

export const adminAuditLog = pgTable("admin_audit_log", {
  id: serial("id").primaryKey(),
  
  // Who performed the action
  actorUserId: varchar("actor_user_id").notNull().references(() => users.id),
  
  // Who was affected (for user-related actions)
  targetUserId: varchar("target_user_id").references(() => users.id),
  
  // Action type
  action: varchar("action", { 
    enum: ["role_change", "password_reset", "user_delete", "plan_change", "bulk_role_change"] 
  }).notNull(),
  
  // Before/after state as JSON
  beforeState: jsonb("before_state").$type<Record<string, any>>(),
  afterState: jsonb("after_state").$type<Record<string, any>>(),
  
  // Request metadata
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("admin_audit_log_actor_idx").on(table.actorUserId),
  index("admin_audit_log_target_idx").on(table.targetUserId),
  index("admin_audit_log_action_idx").on(table.action),
  index("admin_audit_log_created_idx").on(table.createdAt),
]);

export type AdminAuditLog = typeof adminAuditLog.$inferSelect;
export type InsertAdminAuditLog = typeof adminAuditLog.$inferInsert;

// ============================================================================
// STAFF ACTIVITY LOG - General staff/admin activity tracking
// ============================================================================

export const staffActivityLog = pgTable("staff_activity_log", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  action: varchar("action").notNull(),
  targetType: varchar("target_type"), // "user", "contact", "deal", etc.
  targetId: varchar("target_id"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("staff_activity_log_user_idx").on(table.userId),
  index("staff_activity_log_created_idx").on(table.createdAt),
]);

export type StaffActivityLog = typeof staffActivityLog.$inferSelect;
export type InsertStaffActivityLog = typeof staffActivityLog.$inferInsert;

// ============================================================================
// TEAM FEED - Real-time activity stream for team communication
// ============================================================================

export const teamFeed = pgTable("team_feed", {
  id: serial("id").primaryKey(),
  authorUserId: varchar("author_user_id").notNull().references(() => users.id),
  type: varchar("type").notNull().default('note'), // 'note', 'update', 'announcement', 'system'
  message: text("message").notNull(),
  category: varchar("category"), // 'CRM', 'Contract', 'Deal', 'Task', etc.
  targetType: varchar("target_type"), // 'contact', 'company', 'deal', 'contract'
  targetId: varchar("target_id"),
  targetName: varchar("target_name"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_feed_author_idx").on(table.authorUserId),
  index("team_feed_created_idx").on(table.createdAt),
  index("team_feed_type_idx").on(table.type),
]);

export type TeamFeed = typeof teamFeed.$inferSelect;
export type InsertTeamFeed = typeof teamFeed.$inferInsert;

// ============================================================================
// TEAM CALENDAR - Shared calendar events for team (v2 - Extended)
// ============================================================================

// Event type enum values
export const TEAM_CALENDAR_EVENT_TYPES = [
  'INTERN',
  'TEAM_MEETING', 
  'VERWALTUNGSRAT',
  'AUFSICHTSRAT',
  'FEIERTAG',
  'DEADLINE',
  'EXTERNAL',
] as const;
export type TeamCalendarEventType = (typeof TEAM_CALENDAR_EVENT_TYPES)[number];

export const teamCalendar = pgTable("team_calendar", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  // Original columns (match actual DB)
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  location: text("location"),
  createdBy: text("created_by"), // original creator field
  attendees: jsonb("attendees").$type<any[]>().default([]),
  meta: jsonb("meta").$type<Record<string, any>>().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  // New columns added via migration
  startsAt: timestamp("starts_at", { withTimezone: true }), // alias for filtering
  endsAt: timestamp("ends_at", { withTimezone: true }),
  allDay: boolean("all_day").default(false),
  color: text("color").default('#FE9100'),
  eventType: text("event_type").default('INTERN'),
  isReadOnly: boolean("is_read_only").default(false),
  visibility: text("visibility").default('TEAM'),
  recurrence: jsonb("recurrence").$type<{
    freq?: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'YEARLY';
    interval?: number;
    byweekday?: string[];
    bymonthday?: number;
    bysetpos?: number;
    until?: string;
    count?: number;
  }>(),
  internalNotes: text("internal_notes"),
  contextTags: jsonb("context_tags").$type<string[]>(),
  createdByUserId: text("created_by_user_id"),
  updatedByUserId: text("updated_by_user_id"),
}, (table) => [
  index("team_calendar_start_at_idx").on(table.startAt),
  index("team_calendar_event_type_idx").on(table.eventType),
]);

export type TeamCalendar = typeof teamCalendar.$inferSelect;
export type InsertTeamCalendar = typeof teamCalendar.$inferInsert;

// ============================================================================
// TEAM CALENDAR PARTICIPANTS - Event attendees
// ============================================================================

export const teamCalendarParticipants = pgTable("team_calendar_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => teamCalendar.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  roleLabel: varchar("role_label"), // "Board", "Staff", "Guest", etc.
  status: varchar("status").default('pending'), // pending, accepted, declined
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_calendar_participants_event_idx").on(table.eventId),
  index("team_calendar_participants_user_idx").on(table.userId),
]);

export type TeamCalendarParticipant = typeof teamCalendarParticipants.$inferSelect;
export type InsertTeamCalendarParticipant = typeof teamCalendarParticipants.$inferInsert;

// ============================================================================
// TEAM TODOS - Shared task list for team
// ============================================================================

export const teamTodos = pgTable("team_todos", {
  id: serial("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description"),
  dueAt: timestamp("due_at"),
  priority: varchar("priority").default('medium'), // 'low', 'medium', 'high', 'critical'
  status: varchar("status").default('pending'), // 'pending', 'in_progress', 'done'
  assignedToUserId: varchar("assigned_to_user_id").references(() => users.id),
  createdByUserId: varchar("created_by_user_id").notNull().references(() => users.id),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("team_todos_status_idx").on(table.status),
  index("team_todos_due_idx").on(table.dueAt),
  index("team_todos_assigned_idx").on(table.assignedToUserId),
  index("team_todos_creator_idx").on(table.createdByUserId),
]);

export type TeamTodo = typeof teamTodos.$inferSelect;
export type InsertTeamTodo = typeof teamTodos.$inferInsert;

// ============================================================================
// TEAM CHAT - Internal messaging system for staff/admin
// ============================================================================

export const teamChatChannels = pgTable("team_chat_channels", {
  id: varchar("id").primaryKey().notNull().$defaultFn(() => `channel_${Math.random().toString(36).slice(2, 11)}`),
  name: varchar("name").notNull(),
  description: text("description"),
  type: varchar("type").default('public'), // 'public', 'private', 'dm'
  createdByUserId: varchar("created_by_user_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("team_chat_channels_type_idx").on(table.type),
  index("team_chat_channels_created_idx").on(table.createdAt),
]);

export type TeamChatChannel = typeof teamChatChannels.$inferSelect;
export type InsertTeamChatChannel = typeof teamChatChannels.$inferInsert;

export const teamChatMessages = pgTable("team_chat_messages", {
  id: serial("id").primaryKey(),
  channelId: varchar("channel_id").references(() => teamChatChannels.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  replyToId: integer("reply_to_id"),
  attachments: jsonb("attachments").$type<Array<{ name: string; url: string; type: string }>>(),
  editedAt: timestamp("edited_at"),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("team_chat_messages_channel_idx").on(table.channelId),
  index("team_chat_messages_user_idx").on(table.userId),
  index("team_chat_messages_created_idx").on(table.createdAt),
]);

export type TeamChatMessage = typeof teamChatMessages.$inferSelect;
export type InsertTeamChatMessage = typeof teamChatMessages.$inferInsert;

export const teamChatChannelMembers = pgTable("team_chat_channel_members", {
  id: serial("id").primaryKey(),
  channelId: varchar("channel_id").references(() => teamChatChannels.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  role: varchar("role").default('member'), // 'owner', 'admin', 'member'
  lastReadAt: timestamp("last_read_at"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
}, (table) => [
  index("team_chat_members_channel_idx").on(table.channelId),
  index("team_chat_members_user_idx").on(table.userId),
]);

export type TeamChatChannelMember = typeof teamChatChannelMembers.$inferSelect;
export type InsertTeamChatChannelMember = typeof teamChatChannelMembers.$inferInsert;

// ============================================================================
// MAIL INBOUND - Gmail Intake for Internal Dashboard
// ============================================================================
// Stores incoming business emails from Gmail via n8n webhook
// Used by Internal CRM for triage, draft responses, and tracking
// ============================================================================

// ============================================================================
// MAIL INBOUND STATUS MACHINE (Single Source of Truth)
// ============================================================================
// Allowed transitions:
//   NEW → OPEN → TRIAGED → APPROVED → SENDING → SENT
//                                   ↘ ERROR (retry → SENDING)
//   Any → ARCHIVED
// ============================================================================
export const MAIL_INBOUND_STATUSES = ['NEW', 'OPEN', 'TRIAGED', 'APPROVED', 'SENDING', 'SENT', 'ARCHIVED', 'ERROR'] as const;
export type MailInboundStatus = (typeof MAIL_INBOUND_STATUSES)[number];

// Valid status transitions (from → allowed destinations)
export const MAIL_STATUS_TRANSITIONS: Record<MailInboundStatus, readonly MailInboundStatus[]> = {
  NEW: ['OPEN', 'TRIAGED', 'ARCHIVED'],
  OPEN: ['TRIAGED', 'ARCHIVED'],
  TRIAGED: ['APPROVED', 'ARCHIVED'],
  APPROVED: ['SENDING', 'ARCHIVED'],
  SENDING: ['SENT', 'ERROR'],
  SENT: ['ARCHIVED'],
  ERROR: ['SENDING', 'ARCHIVED'],  // retry allowed
  ARCHIVED: [],  // terminal state
} as const;

export const MAIL_CATEGORIES = ['SALES', 'SUPPORT', 'MEETING', 'BILLING', 'PARTNERSHIP', 'LEGAL', 'SPAM', 'OTHER'] as const;
export type MailCategory = (typeof MAIL_CATEGORIES)[number];

export const MAIL_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type MailPriority = (typeof MAIL_PRIORITIES)[number];

export const MAIL_ACTIONS = ['REPLY', 'SCHEDULE_MEETING', 'ASK_CLARIFY', 'FORWARD_TO_HUMAN', 'ARCHIVE', 'DELETE'] as const;
export type MailAction = (typeof MAIL_ACTIONS)[number];

export const mailInbound = pgTable("mail_inbound", {
  id: serial("id").primaryKey(),
  
  // Source identification
  source: text("source").default("gmail").notNull(),
  messageId: text("message_id").notNull(),
  threadId: text("thread_id"),
  mailbox: text("mailbox"), // e.g. "info@aras-ai.com"
  
  // Sender info
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  
  // Recipients (JSONB arrays)
  toEmails: jsonb("to_emails").$type<string[]>().default([]).notNull(),
  ccEmails: jsonb("cc_emails").$type<string[]>().default([]).notNull(),
  
  // Email content
  subject: text("subject").default("").notNull(),
  snippet: text("snippet").default("").notNull(),
  bodyText: text("body_text").default("").notNull(),
  bodyHtml: text("body_html").default("").notNull(),
  
  // Timing
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
  
  // Labels & status
  labels: jsonb("labels").$type<string[]>().default([]).notNull(),
  status: text("status").default("NEW").notNull(),
  
  // AI Classification
  category: text("category").$type<MailCategory>(),
  priority: text("priority").$type<MailPriority>(),
  aiConfidence: real("ai_confidence"),
  aiReason: text("ai_reason").default("").notNull(),
  aiSummary: text("ai_summary").default("").notNull(),
  aiAction: text("ai_action").$type<MailAction>(),
  
  // Draft Response
  draftSubject: text("draft_subject").default("").notNull(),
  draftHtml: text("draft_html").default("").notNull(),
  draftText: text("draft_text").default("").notNull(),
  
  // Workflow timestamps & actors
  triagedAt: timestamp("triaged_at", { withTimezone: true }),
  triagedBy: text("triaged_by"),
  approvedAt: timestamp("approved_at", { withTimezone: true }),
  approvedBy: text("approved_by"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  sentBy: text("sent_by"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedBy: text("archived_by"),
  lastActionAt: timestamp("last_action_at", { withTimezone: true }),
  
  // Error handling
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  
  // Clarification workflow
  needsClarification: boolean("needs_clarification").default(false),
  clarifyingQuestions: jsonb("clarifying_questions").$type<string[]>().default([]),
  operatorNotes: text("operator_notes").default("").notNull(),
  
  // Assignment & Notes
  assignedTo: text("assigned_to"),
  notes: text("notes").default("").notNull(),
  
  // Contact Link (Internal CRM)
  contactId: varchar("contact_id").references(() => internalContacts.id),
  
  // Extensible metadata (raw payload hashes, attachments meta, etc.)
  meta: jsonb("meta").$type<Record<string, any>>().default({}).notNull(),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  // Idempotency constraint: same source + mailbox + messageId = 1 row
  index("mail_inbound_unique_idx").on(table.source, table.mailbox, table.messageId),
  index("mail_inbound_received_at_idx").on(table.receivedAt),
  index("mail_inbound_status_idx").on(table.status),
  index("mail_inbound_from_email_idx").on(table.fromEmail),
  index("mail_inbound_category_idx").on(table.category),
  index("mail_inbound_priority_idx").on(table.priority),
]);

export type MailInbound = typeof mailInbound.$inferSelect;
export type InsertMailInbound = typeof mailInbound.$inferInsert;

// ============================================================================
// 🏆 FOUNDING MEMBER PASS — Claim Queue (Phase 2)
// ============================================================================
export const foundingMemberClaims = pgTable("founding_member_claims", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  status: text("status").default("pending").notNull(), // pending | activated | rejected
  arasLogin: text("aras_login").notNull(),
  stripeEmail: text("stripe_email"),
  notes: text("notes"),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  activatedAt: timestamp("activated_at"),
  activatedByUserId: text("activated_by_user_id"),
  adminNote: text("admin_note"),
}, (table) => [
  index("founding_claims_status_idx").on(table.status),
  index("founding_claims_aras_login_idx").on(table.arasLogin),
]);

export type FoundingMemberClaim = typeof foundingMemberClaims.$inferSelect;
export type InsertFoundingMemberClaim = typeof foundingMemberClaims.$inferInsert;

// ============================================================================
// 🔒 NDA ACCEPTANCES — Digital NDA Gate for Data Room
// ============================================================================
// Logs every NDA acceptance with full audit trail
// Used to gate access to /data-room
// ============================================================================

export const NDA_CURRENT_VERSION = "2026-02-13-v1";

export const ndaAcceptances = pgTable("nda_acceptances", {
  id: serial("id").primaryKey(),
  ndaVersion: text("nda_version").notNull().default(NDA_CURRENT_VERSION),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  company: text("company"),
  title: text("title"),
  acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  ipHash: text("ip_hash"),
  userAgent: text("user_agent"),
  ipAddress: text("ip_address"),
  pagePath: text("page_path"),
  consent: boolean("consent").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("nda_acceptances_email_idx").on(table.email),
  index("nda_acceptances_email_version_idx").on(table.email, table.ndaVersion),
  index("nda_acceptances_accepted_at_idx").on(table.acceptedAt),
]);

export type NdaAcceptance = typeof ndaAcceptances.$inferSelect;
export type InsertNdaAcceptance = typeof ndaAcceptances.$inferInsert;
