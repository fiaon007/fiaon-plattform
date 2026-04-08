/**
 * ============================================================================
 * INBOUND MAIL TYPES
 * ============================================================================
 * Status Machine: NEW → OPEN → TRIAGED → APPROVED → SENDING → SENT
 *                                                  ↘ ERROR (retry)
 *                 Any → ARCHIVED
 * ============================================================================
 */

export type InboundMailStatus = 'NEW' | 'OPEN' | 'TRIAGED' | 'APPROVED' | 'SENDING' | 'SENT' | 'ARCHIVED' | 'ERROR';
export type InboundMailCategory = 'SALES' | 'SUPPORT' | 'MEETING' | 'BILLING' | 'PARTNERSHIP' | 'LEGAL' | 'SPAM' | 'OTHER';
export type InboundMailPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type InboundMailAction = 'REPLY' | 'SCHEDULE_MEETING' | 'ASK_CLARIFY' | 'FORWARD_TO_HUMAN' | 'ARCHIVE' | 'DELETE';

export interface InboundMailListItem {
  id: number;
  mailbox?: string | null;
  subject: string;
  fromEmail: string;
  fromName?: string | null;
  receivedAt: string;
  status: InboundMailStatus;
  snippet: string;
  labels: string[];
  category?: InboundMailCategory | null;
  priority?: InboundMailPriority | null;
  aiAction?: InboundMailAction | null;
}

export interface InboundMailDetail extends InboundMailListItem {
  messageId: string;
  threadId?: string | null;
  bodyText: string;
  bodyHtml: string;
  toEmails?: string[];
  ccEmails?: string[];
  // AI Fields
  aiConfidence?: number | null;
  aiReason?: string;
  aiSummary?: string;
  needsClarification?: boolean;
  clarifyingQuestions?: string[];
  // Draft Fields
  draftSubject?: string;
  draftHtml?: string;
  draftText?: string;
  operatorNotes?: string;
  // Workflow
  triagedAt?: string | null;
  triagedBy?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  sentAt?: string | null;
  sentBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  // Meta
  meta?: Record<string, any>;
  updatedAt?: string;
  createdAt?: string;
}

export interface InboundMailCounts {
  NEW: number;
  OPEN: number;
  TRIAGED: number;
  APPROVED: number;
  SENDING: number;
  SENT: number;
  ARCHIVED: number;
  ERROR: number;
  total: number;
}

export interface InboundMailFilters {
  status?: InboundMailStatus;
  q?: string;
  mailbox?: string;
  limit?: number;
}
