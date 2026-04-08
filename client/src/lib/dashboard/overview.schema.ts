/**
 * ARAS Mission Control - Dashboard Overview Schema
 * Zod validation + TypeScript types for dashboard data contract
 * All fields have safe defaults - UI never crashes on missing data
 */

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// KPI SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const KpiPeriodSchema = z.object({
  today: z.number().default(0),
  week: z.number().default(0),
  month: z.number().default(0),
});

export const CallKpisSchema = z.object({
  started: KpiPeriodSchema.default({}),
  connected: KpiPeriodSchema.default({}),
  successful: KpiPeriodSchema.default({}),
  failed: KpiPeriodSchema.default({}),
  avgDuration: z.number().default(0),
});

export const CampaignKpisSchema = z.object({
  active: z.number().default(0),
  paused: z.number().default(0),
  completed: z.number().default(0),
  errors: z.number().default(0),
  conversionRate: z.number().default(0),
});

export const ContactKpisSchema = z.object({
  total: z.number().default(0),
  new: KpiPeriodSchema.default({}),
  enriched: z.number().default(0),
  hot: z.number().default(0),
});

export const SpaceKpisSchema = z.object({
  active: z.number().default(0),
  lastUsed: z.string().nullable().default(null),
  totalMessages: z.number().default(0),
});

export const KnowledgeKpisSchema = z.object({
  totalDocuments: z.number().default(0),
  newUploads: KpiPeriodSchema.default({}),
  errorSources: z.number().default(0),
});

export const QuotaSchema = z.object({
  calls: z.object({
    used: z.number().default(0),
    limit: z.number().default(0),
  }).default({}),
  spaces: z.object({
    used: z.number().default(0),
    limit: z.number().default(0),
  }).default({}),
  storage: z.object({
    used: z.number().default(0),
    limit: z.number().default(0),
  }).default({}),
});

export const AllKpisSchema = z.object({
  calls: CallKpisSchema.default({}),
  campaigns: CampaignKpisSchema.default({}),
  contacts: ContactKpisSchema.default({}),
  spaces: SpaceKpisSchema.default({}),
  knowledge: KnowledgeKpisSchema.default({}),
  quotas: QuotaSchema.default({}),
});

// ═══════════════════════════════════════════════════════════════
// ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const ActionTypeEnum = z.enum([
  'NAVIGATE',
  'OPEN_MODAL',
  'API_CALL',
  'CREATE_ENTITY',
  'START_CALL',
  'START_CAMPAIGN',
  'IMPORT_CONTACTS',
  'ADD_KB_SOURCE',
  'CREATE_SPACE',
  'CREATE_TASK',
  'FIX_ERROR',
]);

export const ActionCategoryEnum = z.enum([
  'calls',
  'campaigns',
  'contacts',
  'spaces',
  'knowledge',
  'tasks',
  'system',
]);

export const CtaSchema = z.object({
  label: z.string(),
  actionType: ActionTypeEnum,
  payload: z.record(z.unknown()).optional().default({}),
});

export const ActionItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(''),
  category: ActionCategoryEnum,
  icon: z.string().default('Zap'),
  primaryCta: CtaSchema,
  secondaryCta: CtaSchema.optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  requires: z.array(z.string()).default([]),
});

// ═══════════════════════════════════════════════════════════════
// ACTIVITY SCHEMAS
// ═══════════════════════════════════════════════════════════════

export const ActivityTypeEnum = z.enum([
  'call_started',
  'call_completed',
  'call_failed',
  'campaign_started',
  'campaign_paused',
  'campaign_completed',
  'contact_added',
  'contact_enriched',
  'kb_uploaded',
  'kb_error',
  'space_created',
  'space_message',
  'task_created',
  'task_completed',
  'system_alert',
  'system_info',
]);

export const ActivityItemSchema = z.object({
  id: z.string(),
  type: ActivityTypeEnum,
  title: z.string(),
  description: z.string().default(''),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).default({}),
  actionable: z.boolean().default(false),
  actionCta: CtaSchema.optional(),
});

// ═══════════════════════════════════════════════════════════════
// MODULE SCHEMAS (Contact Radar, Today OS, Matrix)
// ═══════════════════════════════════════════════════════════════

export const RadarItemSchema = z.object({
  id: z.string(),
  contactKey: z.string(),
  name: z.string(),
  company: z.string().default(''),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).default('medium'),
  nextAction: z.string().default(''),
  lastContact: z.string().nullable().default(null),
  openTasks: z.number().default(0),
  pendingCalls: z.number().default(0),
  tags: z.array(z.string()).default([]),
});

export const TodayItemSchema = z.object({
  id: z.string(),
  type: z.enum(['task', 'call', 'meeting', 'followup', 'deadline']),
  title: z.string(),
  time: z.string().nullable().default(null),
  done: z.boolean().default(false),
  priority: z.enum(['urgent', 'high', 'medium', 'low']).default('medium'),
  contactName: z.string().optional(),
  actionCta: CtaSchema.optional(),
});

export const MatrixCellSchema = z.object({
  category: z.string(),
  status: z.string(),
  count: z.number().default(0),
  trend: z.enum(['up', 'down', 'stable']).default('stable'),
});

export const MatrixDataSchema = z.object({
  cells: z.array(MatrixCellSchema).default([]),
  summary: z.object({
    healthy: z.number().default(0),
    warning: z.number().default(0),
    critical: z.number().default(0),
  }).default({}),
});

export const ModulesSchema = z.object({
  contactRadar: z.array(RadarItemSchema).default([]),
  todayOS: z.array(TodayItemSchema).default([]),
  matrix: MatrixDataSchema.default({}),
});

// ═══════════════════════════════════════════════════════════════
// RECENT CALLS (with audio, transcript, summary)
// ═══════════════════════════════════════════════════════════════

export const RecentCallContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
});

export const RecentCallCampaignSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

// Normalized Summary structure (matches Power's metadata.summary object)
export const NormalizedSummarySchema = z.object({
  hasSummary: z.boolean().default(false),
  outcome: z.string().optional(),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  bullets: z.array(z.string()).optional(),
  objections: z.array(z.string()).optional(),
  nextStep: z.string().optional(),
  short: z.string().optional(),  // 1-liner for collapsed row (max 140 chars)
  fullText: z.string().optional(),
});

export type NormalizedSummary = z.infer<typeof NormalizedSummarySchema>;

export const RecentCallSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  status: z.enum(['running', 'completed', 'failed', 'initiated']).default('initiated'),
  contact: RecentCallContactSchema.optional(),
  campaign: RecentCallCampaignSchema.optional(),
  duration: z.number().optional(),
  hasAudio: z.boolean().default(false),
  audioUrl: z.string().optional(),
  hasTranscript: z.boolean().default(false),
  transcript: z.string().optional(),
  // Summary as structured object (not just text)
  summary: NormalizedSummarySchema.default({ hasSummary: false }),
  // Gemini AI recommendations (cached)
  geminiActions: z.array(z.string()).optional(),
  geminiPriority: z.number().optional(),
  geminiSuggestedMessage: z.string().optional(),
  geminiRiskFlags: z.array(z.string()).optional(),
});

// ═══════════════════════════════════════════════════════════════
// SYSTEM ALERTS
// ═══════════════════════════════════════════════════════════════

export const SystemAlertSchema = z.object({
  id: z.string(),
  type: z.enum(['error', 'warning', 'info', 'success']),
  title: z.string(),
  description: z.string().default(''),
  service: z.string().default(''),
  actionCta: CtaSchema.optional(),
  dismissible: z.boolean().default(true),
  timestamp: z.string(),
});

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD OVERVIEW SCHEMA
// ═══════════════════════════════════════════════════════════════

export const UserInfoSchema = z.object({
  id: z.string().default('unknown'),
  name: z.string().default('User'),
  email: z.string().default(''),
  plan: z.string().default('free'),
  timezone: z.string().default('Europe/Berlin'),
});

export const DashboardOverviewSchema = z.object({
  user: UserInfoSchema.default({}),
  kpis: AllKpisSchema.default({}),
  recentCalls: z.array(RecentCallSchema).default([]),
  nextActions: z.array(ActionItemSchema).default([]),
  activity: z.array(ActivityItemSchema).default([]),
  modules: ModulesSchema.default({}),
  systemAlerts: z.array(SystemAlertSchema).default([]),
  lastUpdated: z.string().default(new Date().toISOString()),
  errors: z.array(z.string()).default([]),
});

// ═══════════════════════════════════════════════════════════════
// TYPE EXPORTS
// ═══════════════════════════════════════════════════════════════

export type KpiPeriod = z.infer<typeof KpiPeriodSchema>;
export type CallKpis = z.infer<typeof CallKpisSchema>;
export type CampaignKpis = z.infer<typeof CampaignKpisSchema>;
export type ContactKpis = z.infer<typeof ContactKpisSchema>;
export type SpaceKpis = z.infer<typeof SpaceKpisSchema>;
export type KnowledgeKpis = z.infer<typeof KnowledgeKpisSchema>;
export type Quota = z.infer<typeof QuotaSchema>;
export type AllKpis = z.infer<typeof AllKpisSchema>;

export type ActionType = z.infer<typeof ActionTypeEnum>;
export type ActionCategory = z.infer<typeof ActionCategoryEnum>;
export type Cta = z.infer<typeof CtaSchema>;
export type ActionItem = z.infer<typeof ActionItemSchema>;

export type ActivityType = z.infer<typeof ActivityTypeEnum>;
export type ActivityItem = z.infer<typeof ActivityItemSchema>;

export type RadarItem = z.infer<typeof RadarItemSchema>;
export type TodayItem = z.infer<typeof TodayItemSchema>;
export type MatrixCell = z.infer<typeof MatrixCellSchema>;
export type MatrixData = z.infer<typeof MatrixDataSchema>;
export type Modules = z.infer<typeof ModulesSchema>;

export type RecentCall = z.infer<typeof RecentCallSchema>;
export type RecentCallContact = z.infer<typeof RecentCallContactSchema>;
export type RecentCallCampaign = z.infer<typeof RecentCallCampaignSchema>;
export type SystemAlert = z.infer<typeof SystemAlertSchema>;
export type UserInfo = z.infer<typeof UserInfoSchema>;
export type DashboardOverview = z.infer<typeof DashboardOverviewSchema>;

// ═══════════════════════════════════════════════════════════════
// SAFE PARSE HELPER
// ═══════════════════════════════════════════════════════════════

/**
 * Parse and validate dashboard data with safe defaults
 * NEVER throws - always returns valid data structure
 * Uses safeParse to prevent UI crashes
 */
export function parseDashboardOverview(data: unknown): DashboardOverview {
  const result = DashboardOverviewSchema.safeParse(data);
  
  if (result.success) {
    return result.data;
  }
  
  // Log in dev mode only
  if (import.meta.env.DEV) {
    console.warn('[Dashboard] safeParse failed:', result.error.issues);
    console.warn('[Dashboard] Raw data snippet:', JSON.stringify(data)?.slice(0, 200));
  }
  
  // Return safe defaults - never crash
  return createDefaultOverview();
}

/**
 * Create a fully valid default overview
 * Used when parse fails or no data available
 */
export function createDefaultOverview(userId?: string, userName?: string): DashboardOverview {
  return {
    user: {
      id: userId || 'unknown',
      name: userName || 'User',
      email: '',
      plan: 'free',
      timezone: 'Europe/Berlin',
    },
    kpis: {
      calls: { started: { today: 0, week: 0, month: 0 }, connected: { today: 0, week: 0, month: 0 }, successful: { today: 0, week: 0, month: 0 }, failed: { today: 0, week: 0, month: 0 }, avgDuration: 0 },
      campaigns: { active: 0, paused: 0, completed: 0, errors: 0, conversionRate: 0 },
      contacts: { total: 0, new: { today: 0, week: 0, month: 0 }, enriched: 0, hot: 0 },
      spaces: { active: 0, lastUsed: null, totalMessages: 0 },
      knowledge: { totalDocuments: 0, newUploads: { today: 0, week: 0, month: 0 }, errorSources: 0 },
      quotas: { calls: { used: 0, limit: 100 }, spaces: { used: 0, limit: 10 }, storage: { used: 0, limit: 1000 } },
    },
    recentCalls: [],
    nextActions: getSetupActions(),
    activity: [],
    modules: {
      contactRadar: [],
      todayOS: [],
      matrix: { cells: [], summary: { healthy: 0, warning: 0, critical: 0 } },
    },
    systemAlerts: [],
    lastUpdated: new Date().toISOString(),
    errors: [],
  };
}

/**
 * Get empty dashboard with setup actions for new users
 * Uses createDefaultOverview to avoid any parse exceptions
 */
export function getEmptyDashboard(user?: Partial<UserInfo>): DashboardOverview {
  const overview = createDefaultOverview(user?.id, user?.name);
  overview.activity = [{
    id: 'welcome',
    type: 'system_info',
    title: 'Willkommen bei ARAS AI',
    description: 'Starte mit deinen ersten Aktionen um ARAS optimal zu nutzen.',
    timestamp: new Date().toISOString(),
    metadata: {},
    actionable: false,
  }];
  return overview;
}

/**
 * Default setup actions for empty/new dashboards
 */
export function getSetupActions(): ActionItem[] {
  return [
    {
      id: 'setup-contacts',
      title: 'Kontakte importieren',
      description: 'Lade deine Kontakte hoch um mit Calls und Kampagnen zu starten.',
      category: 'contacts',
      icon: 'Users',
      priority: 'high',
      primaryCta: {
        label: 'Kontakte importieren',
        actionType: 'NAVIGATE',
        payload: { path: '/app/contacts' },
      },
      requires: [],
    },
    {
      id: 'setup-call',
      title: 'Ersten Call starten',
      description: 'Teste ARAS Voice mit einem Einzelanruf.',
      category: 'calls',
      icon: 'Phone',
      priority: 'high',
      primaryCta: {
        label: 'Call starten',
        actionType: 'NAVIGATE',
        payload: { path: '/app/power/einzelanruf' },
      },
      requires: [],
    },
    {
      id: 'setup-campaign',
      title: 'Erste Kampagne anlegen',
      description: 'Starte eine automatisierte Outbound-Kampagne.',
      category: 'campaigns',
      icon: 'Megaphone',
      priority: 'medium',
      primaryCta: {
        label: 'Kampagne erstellen',
        actionType: 'NAVIGATE',
        payload: { path: '/app/power/kampagnen' },
      },
      requires: ['contacts'],
    },
    {
      id: 'setup-space',
      title: 'Space erstellen',
      description: 'Erstelle einen AI-Chat Space für dein Team.',
      category: 'spaces',
      icon: 'MessageSquare',
      priority: 'medium',
      primaryCta: {
        label: 'Space erstellen',
        actionType: 'CREATE_SPACE',
        payload: {},
      },
      requires: [],
    },
    {
      id: 'setup-kb',
      title: 'Wissensquelle hinzufügen',
      description: 'Füge Dokumente oder URLs zur Wissensdatenbank hinzu.',
      category: 'knowledge',
      icon: 'Database',
      priority: 'medium',
      primaryCta: {
        label: 'Quelle hinzufügen',
        actionType: 'NAVIGATE',
        payload: { path: '/app/leads' },
      },
      requires: [],
    },
  ];
}
