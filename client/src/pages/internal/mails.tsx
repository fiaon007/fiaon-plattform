/**
 * ============================================================================
 * ARAS INTERNAL MAILS PAGE
 * ============================================================================
 * Premium email inbox with AI triage, draft preview, and send workflow
 * Route: /internal/mails
 * ============================================================================
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Search, RefreshCw, X, Clock, Tag, CheckCircle, Archive, 
  Send, Eye, Sparkles, Copy, ChevronRight, AlertCircle, ExternalLink,
  Inbox, Filter, Zap, FileText, User
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import InternalLayout from '@/components/internal/internal-layout';
import { useToast } from '@/hooks/use-toast';

// ============================================================================
// TYPES
// ============================================================================

type MailStatus = 'NEW' | 'OPEN' | 'TRIAGED' | 'APPROVED' | 'SENDING' | 'SENT' | 'ARCHIVED' | 'ERROR';
type MailCategory = 'SALES' | 'SUPPORT' | 'MEETING' | 'BILLING' | 'PARTNERSHIP' | 'LEGAL' | 'SPAM' | 'OTHER';
type MailPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface MailItem {
  id: number;
  subject: string;
  fromEmail: string;
  fromName?: string | null;
  mailbox?: string | null;
  receivedAt: string;
  status: MailStatus;
  snippet: string;
  category?: MailCategory | null;
  priority?: MailPriority | null;
  aiConfidence?: number | null;
  aiReason?: string;
  aiSummary?: string;
  aiAction?: string | null;
  needsClarification?: boolean;
  clarifyingQuestions?: string[];
  draftSubject?: string;
  draftHtml?: string;
  draftText?: string;
  bodyText?: string;
  bodyHtml?: string;
  triagedAt?: string | null;
  approvedAt?: string | null;
  sentAt?: string | null;
  messageId?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  contactId?: string | null;
  archivedAt?: string | null;
  threadId?: string | null;
  lastActionAt?: string | null;
  meta?: Record<string, any> | null;
}

interface ThreadHistoryItem {
  id: number;
  subject: string;
  fromEmail: string;
  status: MailStatus;
  receivedAt: string;
  snippet: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_CONFIG: Record<MailStatus, { label: string; color: string; bg: string }> = {
  NEW: { label: 'Neu', color: '#FE9100', bg: 'rgba(254,145,0,0.15)' },
  OPEN: { label: 'Open', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  TRIAGED: { label: 'Triaged', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  APPROVED: { label: 'Approved', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  SENDING: { label: 'Sending...', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  SENT: { label: 'Sent', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  ARCHIVED: { label: 'Archived', color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
  ERROR: { label: 'Error', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
};

const CATEGORY_CONFIG: Record<MailCategory, { label: string; color: string }> = {
  SALES: { label: 'Sales', color: '#FE9100' },
  SUPPORT: { label: 'Support', color: '#3B82F6' },
  MEETING: { label: 'Meeting', color: '#8B5CF6' },
  BILLING: { label: 'Billing', color: '#10B981' },
  PARTNERSHIP: { label: 'Partner', color: '#EC4899' },
  LEGAL: { label: 'Legal', color: '#6366F1' },
  SPAM: { label: 'Spam', color: '#EF4444' },
  OTHER: { label: 'Other', color: '#6B7280' },
};

const PRIORITY_CONFIG: Record<MailPriority, { label: string; color: string }> = {
  URGENT: { label: 'Urgent', color: '#EF4444' },
  HIGH: { label: 'High', color: '#F97316' },
  MEDIUM: { label: 'Medium', color: '#EAB308' },
  LOW: { label: 'Low', color: '#6B7280' },
};

const STATUS_FILTERS: MailStatus[] = ['NEW', 'OPEN', 'TRIAGED', 'APPROVED', 'SENT', 'ERROR', 'ARCHIVED'];

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`rounded-lg ${className}`}
      style={{ 
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.8s ease-in-out infinite',
      }}
    />
  );
}

// ============================================================================
// BADGE COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: MailStatus }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
  return (
    <span 
      className="text-[10px] uppercase px-2 py-0.5 rounded font-medium"
      style={{ 
        background: config.bg, 
        color: config.color,
        boxShadow: status === 'NEW' ? `0 0 8px ${config.color}40` : 
                   status === 'ERROR' ? `0 0 6px ${config.color}30` : 'none',
      }}
    >
      {config.label}
    </span>
  );
}

function CategoryBadge({ category }: { category: MailCategory }) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.OTHER;
  return (
    <span 
      className="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium"
      style={{ background: `${config.color}15`, color: config.color }}
    >
      {config.label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: MailPriority }) {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.MEDIUM;
  return (
    <span 
      className="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium"
      style={{ background: `${config.color}15`, color: config.color }}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// MAIL LIST ITEM
// ============================================================================

function MailListItem({ 
  mail, 
  isSelected, 
  onClick 
}: { 
  mail: MailItem; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true, locale: de });
    } catch { return ''; }
  }, [mail.receivedAt]);

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl transition-all duration-200 group"
      style={{
        background: isSelected ? 'rgba(254,145,0,0.08)' : 'rgba(255,255,255,0.015)',
        border: isSelected ? '1px solid rgba(254,145,0,0.3)' : '1px solid rgba(233,215,196,0.04)',
      }}
      whileHover={{ 
        scale: 1.008,
        y: -1,
        transition: { duration: 0.15 },
      }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div 
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
          style={{ 
            background: mail.status === 'NEW' 
              ? 'linear-gradient(135deg, #FE9100, #a34e00)' 
              : 'rgba(255,255,255,0.06)',
            color: mail.status === 'NEW' ? '#fff' : 'rgba(255,255,255,0.5)',
            boxShadow: mail.status === 'NEW' ? '0 2px 8px rgba(254,145,0,0.25)' : 'none',
          }}
        >
          {(mail.fromName || mail.fromEmail)?.[0]?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p 
            className="text-sm font-medium truncate mb-0.5"
            style={{ color: mail.status === 'NEW' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)' }}
          >
            {mail.subject || '(Kein Betreff)'}
          </p>
          <p className="text-xs truncate mb-1.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {mail.fromName || mail.fromEmail}
          </p>
          <p className="text-[11px] line-clamp-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {mail.snippet || '—'}
          </p>
          
          {/* Tags Row */}
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            <StatusBadge status={mail.status} />
            {mail.category && <CategoryBadge category={mail.category} />}
            {mail.priority && <PriorityBadge priority={mail.priority} />}
          </div>
        </div>

        {/* Time */}
        <span className="text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {timeAgo}
        </span>
      </div>
    </motion.button>
  );
}

// ============================================================================
// DETAIL PANEL
// ============================================================================

function DetailPanel({ 
  mail, 
  onTriage,
  onApprove,
  onSend,
  onArchive,
  onRegenerateDraft,
  onClose,
  isTriaging,
  isSending,
  isRegenerating,
  threadHistory,
}: { 
  mail: MailItem | null;
  onTriage: () => void;
  onApprove: () => void;
  onSend: () => void;
  onArchive: () => void;
  onRegenerateDraft: (notes: string) => void;
  onClose: () => void;
  isTriaging: boolean;
  isSending: boolean;
  isRegenerating: boolean;
  threadHistory: ThreadHistoryItem[];
}) {
  const [activeTab, setActiveTab] = useState<'mail' | 'ai' | 'draft'>('mail');
  const [operatorNotes, setOperatorNotes] = useState('');
  const { toast } = useToast();

  if (!mail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Inbox className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(255,255,255,0.08)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Wähle eine E-Mail aus
          </p>
        </div>
      </div>
    );
  }

  const handleCopySummary = () => {
    const text = [
      `Subject: ${mail.subject}`,
      `From: ${mail.fromEmail}`,
      `Category: ${mail.category || 'N/A'}`,
      `Priority: ${mail.priority || 'N/A'}`,
      '',
      'AI Summary:',
      mail.aiSummary || 'Not triaged',
    ].join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: '✓ Summary kopiert' });
  };

  const hasDraft = (mail.draftText && mail.draftText.length > 0) || (mail.draftHtml && mail.draftHtml.length > 0);
  const isTriaged = mail.status !== 'NEW';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b flex-shrink-0" style={{ borderColor: 'rgba(233,215,196,0.08)' }}>
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-lg font-semibold pr-4" style={{ color: 'rgba(255,255,255,0.95)' }}>
            {mail.subject || '(Kein Betreff)'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" />
            {mail.fromEmail}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(mail.receivedAt), 'dd.MM.yyyy HH:mm')}
          </span>
          <StatusBadge status={mail.status} />
        </div>

        {/* Actions — status-gated */}
        <div className="flex flex-wrap gap-2">
          {['NEW', 'OPEN'].includes(mail.status) && (
            <ActionButton 
              icon={Sparkles} 
              label={isTriaging ? 'Triaging...' : 'ARAS Engine Triage'} 
              onClick={onTriage}
              variant="primary"
              disabled={isTriaging}
            />
          )}
          {mail.status === 'TRIAGED' && hasDraft && (
            <ActionButton 
              icon={CheckCircle} 
              label="Approve" 
              onClick={onApprove}
              variant="success"
            />
          )}
          {mail.status === 'APPROVED' && (
            <ActionButton 
              icon={Send} 
              label={isSending ? 'Sende...' : 'Senden'} 
              onClick={onSend}
              variant="primary"
              disabled={isSending}
            />
          )}
          {mail.status === 'ERROR' && (
            <ActionButton 
              icon={RefreshCw} 
              label={isSending ? 'Retry...' : 'Erneut senden'} 
              onClick={onSend}
              variant="primary"
              disabled={isSending}
            />
          )}
          <ActionButton icon={Copy} label="Zusammenfassung" onClick={handleCopySummary} />
          {mail.status !== 'ARCHIVED' && (
            <ActionButton icon={Archive} label="Archivieren" onClick={onArchive} />
          )}
        </div>

        {/* Error State */}
        {mail.status === 'ERROR' && mail.errorMessage && (
          <div 
            className="mt-3 p-3 rounded-lg flex items-start gap-2"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#EF4444' }} />
            <div>
              <p className="text-xs font-medium" style={{ color: '#EF4444' }}>
                {mail.errorCode || 'ERROR'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {mail.errorMessage}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-5 pt-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(233,215,196,0.06)' }}>
        <TabButton active={activeTab === 'mail'} onClick={() => setActiveTab('mail')} label="Mail" icon={Mail} />
        <TabButton active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} label="AI" icon={Sparkles} disabled={!isTriaged} />
        <TabButton active={activeTab === 'draft'} onClick={() => setActiveTab('draft')} label="Draft" icon={FileText} disabled={!hasDraft} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'mail' && (
            <motion.div key="mail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {mail.bodyHtml ? (
                <iframe
                  sandbox=""
                  srcDoc={mail.bodyHtml}
                  className="w-full min-h-[400px] rounded-lg"
                  style={{ background: 'white', border: '1px solid rgba(233,215,196,0.1)' }}
                  title="Email Content"
                />
              ) : (
                <div 
                  className="text-sm whitespace-pre-wrap"
                  style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}
                >
                  {mail.bodyText || mail.snippet || 'Kein Inhalt verfügbar'}
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'ai' && (
            <motion.div key="ai" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Classification Grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="Category" value={mail.category || '—'} color={mail.category ? CATEGORY_CONFIG[mail.category]?.color : undefined} />
                <InfoCard label="Priority" value={mail.priority || '—'} color={mail.priority ? PRIORITY_CONFIG[mail.priority]?.color : undefined} />
                <InfoCard label="Recommended Action" value={mail.aiAction || '—'} />
                <InfoCard label="Confidence" value={mail.aiConfidence ? `${Math.round(mail.aiConfidence * 100)}%` : '—'} />
              </div>

              {/* Confidence Bar */}
              {mail.aiConfidence != null && mail.aiConfidence > 0 && (
                <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(233,215,196,0.06)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>Sicherheit</span>
                    <span className="text-xs font-medium" style={{ color: '#FE9100' }}>{Math.round(mail.aiConfidence * 100)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${Math.round(mail.aiConfidence * 100)}%`,
                        background: `linear-gradient(90deg, #FE9100, ${mail.aiConfidence > 0.7 ? '#10B981' : mail.aiConfidence > 0.4 ? '#F59E0B' : '#EF4444'})`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Reason */}
              {mail.aiReason && (
                <div 
                  className="p-4 rounded-xl"
                  style={{ background: 'rgba(254,145,0,0.05)', border: '1px solid rgba(254,145,0,0.15)' }}
                >
                  <h4 className="text-xs font-semibold uppercase mb-2 flex items-center gap-2" style={{ color: '#FE9100' }}>
                    <Zap className="w-3.5 h-3.5" />
                    ARAS Engine Einschätzung
                  </h4>
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.6 }}>
                    {mail.aiReason}
                  </p>
                </div>
              )}

              {/* Summary */}
              <div 
                className="p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(233,215,196,0.08)' }}
              >
                <h4 className="text-xs font-semibold uppercase mb-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Zusammenfassung
                </h4>
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
                  {mail.aiSummary || 'Noch nicht triaged'}
                </p>
              </div>

              {/* Clarification Questions + Operator Notes Input */}
              {mail.needsClarification && mail.clarifyingQuestions && mail.clarifyingQuestions.length > 0 && (
                <div 
                  className="p-4 rounded-xl"
                  style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  <h4 className="text-xs font-semibold uppercase mb-3 flex items-center gap-2" style={{ color: '#EF4444' }}>
                    <AlertCircle className="w-3.5 h-3.5" />
                    Klärungsbedarf
                  </h4>
                  <ul className="space-y-2 mb-4">
                    {mail.clarifyingQuestions.map((q, i) => (
                      <li key={i} className="text-sm flex items-start gap-2" style={{ color: 'rgba(255,255,255,0.8)' }}>
                        <span className="text-[10px] px-1.5 py-0.5 rounded mt-0.5" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                          {i + 1}
                        </span>
                        {q}
                      </li>
                    ))}
                  </ul>

                  {/* Operator Notes Input */}
                  <div className="space-y-3 pt-3" style={{ borderTop: '1px solid rgba(239,68,68,0.15)' }}>
                    <label className="text-xs font-semibold uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
                      Deine Antworten / Notizen
                    </label>
                    <textarea
                      value={operatorNotes}
                      onChange={(e) => setOperatorNotes(e.target.value)}
                      placeholder="Beantworte die Fragen hier, um einen neuen Draft zu generieren..."
                      rows={4}
                      className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        color: 'rgba(255,255,255,0.9)',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={() => {
                        if (operatorNotes.trim()) {
                          onRegenerateDraft(operatorNotes);
                          setOperatorNotes('');
                        }
                      }}
                      disabled={!operatorNotes.trim() || isRegenerating}
                      className="w-full py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                      style={{
                        background: operatorNotes.trim() ? 'linear-gradient(135deg, #FE9100, #a34e00)' : 'rgba(255,255,255,0.05)',
                        color: operatorNotes.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                        cursor: operatorNotes.trim() && !isRegenerating ? 'pointer' : 'not-allowed',
                      }}
                    >
                      <Sparkles className="w-4 h-4" />
                      {isRegenerating ? 'Generiere...' : 'Draft neu generieren'}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'draft' && (
            <motion.div key="draft" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* Subject */}
              <div>
                <label className="text-xs font-semibold uppercase mb-1 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Subject
                </label>
                <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                  {mail.draftSubject || `Re: ${mail.subject}`}
                </p>
              </div>

              {/* HTML Preview */}
              {mail.draftHtml ? (
                <div>
                  <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    HTML Preview
                  </label>
                  <iframe
                    sandbox=""
                    srcDoc={mail.draftHtml}
                    className="w-full min-h-[400px] rounded-lg"
                    style={{ background: 'white', border: '1px solid rgba(233,215,196,0.1)' }}
                    title="Draft Preview"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-semibold uppercase mb-2 block" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Text
                  </label>
                  <div 
                    className="text-sm whitespace-pre-wrap p-4 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)', color: 'rgba(255,255,255,0.8)' }}
                  >
                    {mail.draftText || 'Kein Draft verfügbar'}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thread History / Verlauf */}
        {threadHistory.length > 0 && (
          <div className="mt-6 pt-4" style={{ borderTop: '1px solid rgba(233,215,196,0.06)' }}>
            <h4 className="text-xs font-semibold uppercase mb-3 flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <Clock className="w-3.5 h-3.5" />
              Verlauf ({threadHistory.length})
            </h4>
            <div className="space-y-2">
              {threadHistory.map((item) => (
                <div 
                  key={item.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg transition-colors hover:bg-white/[0.03] cursor-default"
                  style={{ border: '1px solid rgba(233,215,196,0.04)' }}
                >
                  <div 
                    className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: STATUS_CONFIG[item.status]?.color || 'rgba(255,255,255,0.2)' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.7)' }}>
                      {item.subject || '(Kein Betreff)'}
                    </p>
                    <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {item.fromEmail} · {(() => { try { return formatDistanceToNow(new Date(item.receivedAt), { addSuffix: true, locale: de }); } catch { return ''; } })()}
                    </p>
                  </div>
                  <StatusBadge status={item.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function ActionButton({ 
  icon: Icon, 
  label, 
  onClick, 
  variant = 'default',
  disabled = false
}: { 
  icon: any; 
  label: string; 
  onClick: () => void;
  variant?: 'default' | 'primary' | 'success';
  disabled?: boolean;
}) {
  const styles = {
    default: { bg: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.6)', border: 'transparent' },
    primary: { bg: 'rgba(254,145,0,0.1)', color: '#FE9100', border: 'rgba(254,145,0,0.2)' },
    success: { bg: 'rgba(16,185,129,0.1)', color: '#10B981', border: 'rgba(16,185,129,0.2)' },
  };
  const style = styles[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 disabled:opacity-40"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function TabButton({ 
  active, 
  onClick, 
  label,
  icon: Icon,
  disabled = false
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  icon: any;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-all -mb-px disabled:opacity-40"
      style={{
        color: active ? '#FE9100' : 'rgba(255,255,255,0.5)',
        borderBottom: active ? '2px solid #FE9100' : '2px solid transparent',
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function InfoCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div 
      className="p-3 rounded-lg"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(233,215,196,0.06)' }}
    >
      <p className="text-[10px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
      <p className="text-sm font-medium" style={{ color: color || 'rgba(255,255,255,0.9)' }}>{value}</p>
    </div>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export default function MailsPage() {
  const [activeStatus, setActiveStatus] = useState<MailStatus>('NEW');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMailId, setSelectedMailId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch mail list
  const { data: listData, isLoading: listLoading, isError: listError, refetch } = useQuery({
    queryKey: ['mails-list', activeStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('status', activeStatus);
      if (searchQuery) params.set('q', searchQuery);
      params.set('limit', '50');
      
      const res = await fetch(`/api/internal/mail/inbound?${params}`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    refetchInterval: 15000,
    retry: 1,
  });

  // Fetch counts
  const { data: counts } = useQuery({
    queryKey: ['mails-counts'],
    queryFn: async () => {
      const res = await fetch('/api/internal/mail/inbound/count', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    refetchInterval: 30000,
  });

  // Fetch selected mail detail (includes threadHistory)
  const { data: selectedMailResponse } = useQuery({
    queryKey: ['mail-detail', selectedMailId],
    queryFn: async () => {
      if (!selectedMailId) return null;
      const res = await fetch(`/api/internal/mail/inbound/${selectedMailId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      return { data: json.data as MailItem, threadHistory: (json.threadHistory || []) as ThreadHistoryItem[] };
    },
    enabled: !!selectedMailId,
  });
  const selectedMail = selectedMailResponse?.data || null;
  const selectedThreadHistory = selectedMailResponse?.threadHistory || [];

  // Triage mutation
  const triageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/internal/mail/inbound/${id}/triage`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Triage failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails-list'] });
      queryClient.invalidateQueries({ queryKey: ['mail-detail', selectedMailId] });
      queryClient.invalidateQueries({ queryKey: ['mails-counts'] });
      toast({ title: '✓ Triage abgeschlossen' });
    },
    onError: (err: any) => {
      toast({ title: 'Triage fehlgeschlagen', description: err.message, variant: 'destructive' });
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/internal/mail/inbound/${id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Approve failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails-list'] });
      queryClient.invalidateQueries({ queryKey: ['mail-detail', selectedMailId] });
      toast({ title: '✓ Approved' });
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/internal/mail/inbound/${id}/send`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Send failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails-list'] });
      queryClient.invalidateQueries({ queryKey: ['mail-detail', selectedMailId] });
      queryClient.invalidateQueries({ queryKey: ['mails-counts'] });
      toast({ title: '✓ E-Mail gesendet!' });
    },
    onError: (err: any) => {
      toast({ title: 'Senden fehlgeschlagen', description: err.message, variant: 'destructive' });
    },
  });

  // Archive mutation
  const archiveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/internal/mail/inbound/${id}/archive`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Archive failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails-list'] });
      queryClient.invalidateQueries({ queryKey: ['mail-detail', selectedMailId] });
      queryClient.invalidateQueries({ queryKey: ['mails-counts'] });
      toast({ title: '✓ Archiviert' });
    },
  });

  // Draft regenerate mutation
  const regenerateDraftMutation = useMutation({
    mutationFn: async ({ id, operatorNotes }: { id: number; operatorNotes: string }) => {
      const res = await fetch(`/api/internal/mail/inbound/${id}/draft`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorNotes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Draft regeneration failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mails-list'] });
      queryClient.invalidateQueries({ queryKey: ['mail-detail', selectedMailId] });
      toast({ title: '✓ Draft neu generiert' });
    },
    onError: (err: any) => {
      toast({ title: 'Draft-Generierung fehlgeschlagen', description: err.message, variant: 'destructive' });
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      if (!selectedMailId || !selectedMail) return;

      switch (e.key.toLowerCase()) {
        case 'r': // Triage
          if (['NEW', 'OPEN'].includes(selectedMail.status)) triageMutation.mutate(selectedMailId);
          break;
        case 'a': // Approve
          if (selectedMail.status === 'TRIAGED') approveMutation.mutate(selectedMailId);
          break;
        case 's': // Send
          if (selectedMail.status === 'APPROVED' || selectedMail.status === 'ERROR') sendMutation.mutate(selectedMailId);
          break;
        case 'escape':
          setSelectedMailId(null);
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedMailId, selectedMail]);

  // Debounced search
  const [searchInput, setSearchInput] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setSearchQuery(value), 250);
  }, []);

  const mails: MailItem[] = listData?.data || [];
  const mailCounts = counts?.counts || {};

  return (
    <InternalLayout>
      <div className="h-[calc(100vh-120px)] flex flex-col">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div>
            <h1 
              className="text-2xl font-bold mb-1"
              style={{ 
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              INBOUND · MAIL
            </h1>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              AI-gestütztes E-Mail Triage & Response System
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: '#FE9100' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: '#FE9100' }} />
              </span>
              <span className="text-[10px] font-medium tracking-wider uppercase" style={{ color: 'rgba(254,145,0,0.6)' }}>Live</span>
            </div>
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg transition-colors hover:bg-white/5"
              style={{ color: 'rgba(255,255,255,0.4)' }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Main Content — Glass Panel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex-1 rounded-2xl overflow-hidden flex relative"
          style={{
            background: 'rgba(12,12,14,0.6)',
            border: '1px solid rgba(233,215,196,0.10)',
            boxShadow: '0 12px 48px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Top gradient accent line */}
          <div 
            className="absolute top-0 left-8 right-8 h-[1px] z-10"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.3), transparent)' }}
          />
          {/* Left: List Panel */}
          <div className="w-[400px] flex-shrink-0 flex flex-col" style={{ borderRight: '1px solid rgba(233,215,196,0.06)' }}>
            {/* Search + Filters */}
            <div className="p-4 space-y-3" style={{ borderBottom: '1px solid rgba(233,215,196,0.06)' }}>
              {/* Search */}
              <div 
                className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(233,215,196,0.08)' }}
              >
                <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Suchen: Absender, Betreff, Text…"
                  className="bg-transparent outline-none text-sm flex-1"
                  style={{ color: 'rgba(255,255,255,0.8)' }}
                />
                {searchInput && (
                  <button onClick={() => { setSearchInput(''); setSearchQuery(''); }}>
                    <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
                  </button>
                )}
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-1.5">
                {STATUS_FILTERS.map((status) => (
                  <button
                    key={status}
                    onClick={() => { setActiveStatus(status); setSelectedMailId(null); }}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      background: activeStatus === status ? STATUS_CONFIG[status].bg : 'transparent',
                      color: activeStatus === status ? STATUS_CONFIG[status].color : 'rgba(255,255,255,0.5)',
                      border: activeStatus === status ? `1px solid ${STATUS_CONFIG[status].color}30` : '1px solid transparent',
                    }}
                  >
                    {STATUS_CONFIG[status].label}
                    {mailCounts[status] > 0 && (
                      <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        {mailCounts[status]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Mail List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {listError ? (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <AlertCircle className="w-10 h-10 mb-3" style={{ color: '#EF4444' }} />
                  <p className="text-sm font-medium mb-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                    Fehler beim Laden
                  </p>
                  <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    API nicht erreichbar oder Sitzung abgelaufen
                  </p>
                  <button
                    onClick={() => refetch()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all"
                    style={{ background: 'rgba(254,145,0,0.1)', color: '#FE9100', border: '1px solid rgba(254,145,0,0.2)' }}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Erneut versuchen
                  </button>
                </div>
              ) : listLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))
              ) : mails.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12">
                  <Inbox className="w-12 h-12 mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
                  <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                    Keine {STATUS_CONFIG[activeStatus].label} E-Mails
                  </p>
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchInput(''); setSearchQuery(''); }}
                      className="mt-2 text-xs underline"
                      style={{ color: 'rgba(254,145,0,0.7)' }}
                    >
                      Suche zurücksetzen
                    </button>
                  )}
                </div>
              ) : (
                mails.map((mail) => (
                  <MailListItem
                    key={mail.id}
                    mail={mail}
                    isSelected={selectedMailId === mail.id}
                    onClick={() => setSelectedMailId(mail.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <DetailPanel
            mail={selectedMail || null}
            onTriage={() => selectedMailId && triageMutation.mutate(selectedMailId)}
            onApprove={() => selectedMailId && approveMutation.mutate(selectedMailId)}
            onSend={() => selectedMailId && sendMutation.mutate(selectedMailId)}
            onArchive={() => selectedMailId && archiveMutation.mutate(selectedMailId)}
            onRegenerateDraft={(notes) => selectedMailId && regenerateDraftMutation.mutate({ id: selectedMailId, operatorNotes: notes })}
            onClose={() => setSelectedMailId(null)}
            isTriaging={triageMutation.isPending}
            isSending={sendMutation.isPending}
            isRegenerating={regenerateDraftMutation.isPending}
            threadHistory={selectedThreadHistory}
          />
        </motion.div>
      </div>
      {/* Shimmer keyframe for skeleton loading */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </InternalLayout>
  );
}
