// ============================================================================
// ARAS Command Center - Activity Service
// ============================================================================
// Real-time activity logging with AI enrichment via EventEmitter + SSE
// ============================================================================

import { EventEmitter } from "events";
import { logger } from "../logger";

// Event Emitter for Real-time Updates
export const activityEmitter = new EventEmitter();
activityEmitter.setMaxListeners(100); // Support many SSE connections

// ============================================================================
// Action Definitions
// ============================================================================

export const ACTIONS = {
  // User Actions
  USER_VIEWED: { action: "user_viewed", category: "user", icon: "Eye", color: "#6366F1", title: "User angesehen" },
  USER_UPDATED: { action: "user_updated", category: "user", icon: "UserCog", color: "#F59E0B", title: "User aktualisiert" },
  USER_DELETED: { action: "user_deleted", category: "user", icon: "UserX", color: "#EF4444", title: "User gelöscht" },
  USER_CREATED: { action: "user_created", category: "user", icon: "UserPlus", color: "#10B981", title: "User erstellt" },
  
  // Billing Actions
  PLAN_CHANGED: { action: "plan_changed", category: "billing", icon: "CreditCard", color: "#FF6A00", title: "Plan geändert" },
  SUBSCRIPTION_CANCELED: { action: "subscription_canceled", category: "billing", icon: "XCircle", color: "#EF4444", title: "Abo gekündigt" },
  
  // Security Actions
  PASSWORD_RESET: { action: "password_reset", category: "security", icon: "Key", color: "#8B5CF6", title: "Passwort zurückgesetzt" },
  ROLE_CHANGED: { action: "role_changed", category: "security", icon: "Shield", color: "#F59E0B", title: "Rolle geändert" },
  LOGIN_ADMIN: { action: "login_admin", category: "security", icon: "LogIn", color: "#10B981", title: "Admin Login" },
  
  // Automation Actions
  WORKFLOW_TOGGLED: { action: "workflow_toggled", category: "automation", icon: "Zap", color: "#10B981", title: "Workflow umgeschaltet" },
  WORKFLOW_EXECUTED: { action: "workflow_executed", category: "automation", icon: "Play", color: "#06B6D4", title: "Workflow ausgeführt" },
  
  // Communication Actions
  EMAIL_SENT: { action: "email_sent", category: "communication", icon: "Mail", color: "#06B6D4", title: "Email gesendet" },
  SMS_SENT: { action: "sms_sent", category: "communication", icon: "MessageSquare", color: "#8B5CF6", title: "SMS gesendet" },
  
  // Data Actions
  EXPORT_CREATED: { action: "export_created", category: "data", icon: "Download", color: "#78716C", title: "Export erstellt" },
  IMPORT_COMPLETED: { action: "import_completed", category: "data", icon: "Upload", color: "#10B981", title: "Import abgeschlossen" },
  
  // Team Actions
  STAFF_INVITED: { action: "staff_invited", category: "team", icon: "UserPlus", color: "#EC4899", title: "Staff eingeladen" },
  STAFF_REMOVED: { action: "staff_removed", category: "team", icon: "UserMinus", color: "#EF4444", title: "Staff entfernt" },
  
  // Lead Actions
  LEAD_CREATED: { action: "lead_created", category: "leads", icon: "TrendingUp", color: "#8B5CF6", title: "Lead erstellt" },
  LEAD_CONVERTED: { action: "lead_converted", category: "leads", icon: "CheckCircle", color: "#10B981", title: "Lead konvertiert" },
  
  // Call Actions
  CALL_COMPLETED: { action: "call_completed", category: "calls", icon: "Phone", color: "#EF4444", title: "Anruf beendet" },
  CALL_FAILED: { action: "call_failed", category: "calls", icon: "PhoneOff", color: "#EF4444", title: "Anruf fehlgeschlagen" },
  
  // Contract Actions
  CONTRACT_UPLOADED: { action: "contract_uploaded", category: "contracts", icon: "FileText", color: "#FF6A00", title: "Vertrag hochgeladen" },
  CONTRACT_APPROVED: { action: "contract_approved", category: "contracts", icon: "CheckCircle", color: "#10B981", title: "Vertrag freigegeben" },
  CONTRACT_DELETED: { action: "contract_deleted", category: "contracts", icon: "Trash2", color: "#EF4444", title: "Vertrag gelöscht" },
} as const;

export type ActionKey = keyof typeof ACTIONS;

// ============================================================================
// Log Parameters Interface
// ============================================================================

interface LogParams {
  actorId: string;
  actorName?: string;
  actorRole?: string;
  actionKey: ActionKey;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  targetUrl?: string;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Activity Service Class
// ============================================================================

class ActivityService {
  /**
   * Log an activity - never throws, activity logging should never block main function
   * NOTE: DB table not available (no migration), so we just emit events + log
   */
  async log(params: LogParams): Promise<void> {
    try {
      const actionDef = ACTIONS[params.actionKey];
      
      // Create activity object for events (no DB persistence - table doesn't exist)
      const activity = {
        id: Date.now(),
        actorId: params.actorId,
        actorName: params.actorName || null,
        actorRole: params.actorRole || null,
        action: actionDef.action,
        actionCategory: actionDef.category,
        actionIcon: actionDef.icon,
        actionColor: actionDef.color,
        targetType: params.targetType || null,
        targetId: params.targetId || null,
        targetName: params.targetName || null,
        targetUrl: params.targetUrl || null,
        title: actionDef.title,
        description: params.description || null,
        metadata: params.metadata || null,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        createdAt: new Date(),
      };

      logger.info("[ACTIVITY] Logged:", { action: actionDef.action, actorId: params.actorId, target: params.targetName });

      // Emit real-time event for SSE subscribers
      activityEmitter.emit("new-activity", activity);

    } catch (error) {
      logger.error("[ACTIVITY] Error logging:", error);
      // Never throw - activity logging should never block main function
    }
  }

  /**
   * Get activities - stub implementation (no DB table available)
   * NOTE: adminActivityLog table doesn't exist, no migration allowed
   */
  async getActivities(options: {
    limit?: number;
    offset?: number;
    category?: string;
    since?: Date;
    actorId?: string;
  } = {}) {
    // Return empty data since DB table doesn't exist
    return { 
      data: [], 
      total: 0,
      limit: options.limit || 50,
      offset: options.offset || 0,
    };
  }

  /**
   * Get activity statistics - stub implementation
   */
  async getStats(hours = 24) {
    return {
      total: 0, users: 0, billing: 0, security: 0, 
      automation: 0, communication: 0,
      critical: 0, high: 0, medium: 0, low: 0,
    };
  }

  /**
   * Get categories - stub implementation
   */
  async getCategories(hours = 24) {
    return [];
  }
}

export const activityService = new ActivityService();
