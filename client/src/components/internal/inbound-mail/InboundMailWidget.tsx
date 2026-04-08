/**
 * ============================================================================
 * ARAS INBOUND MAIL WIDGET
 * ============================================================================
 * Premium "INBOUND · MAIL" Inbox for Internal Dashboard
 * Glass design with ARAS CI - "Apple meets Neuralink"
 * ============================================================================
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Search, RefreshCw, Copy, UserPlus, Database, 
  ChevronRight, Clock, Tag, CheckCircle, Archive, Eye,
  FileText, X, ExternalLink, AlertCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';
import { 
  useInboundMailList, 
  useInboundMailDetail, 
  useInboundMailCounts,
  useUpdateMailStatus,
  usePollingIndicator 
} from './hooks';
import type { InboundMailStatus, InboundMailListItem } from './types';

// ============================================================================
// CONSTANTS
// ============================================================================

const STATUS_TABS: { key: InboundMailStatus; label: string; color: string }[] = [
  { key: 'NEW', label: 'New', color: '#FE9100' },
  { key: 'OPEN', label: 'Open', color: '#F59E0B' },
  { key: 'TRIAGED', label: 'Triaged', color: '#3B82F6' },
  { key: 'SENT', label: 'Sent', color: '#10B981' },
  { key: 'ARCHIVED', label: 'Archived', color: '#6B7280' },
];

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse rounded-lg ${className}`}
      style={{ 
        background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }}
    />
  );
}

// ============================================================================
// LIVE DOT COMPONENT
// ============================================================================

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span 
        className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
        style={{ backgroundColor: '#FE9100' }}
      />
      <span 
        className="relative inline-flex rounded-full h-2 w-2"
        style={{ backgroundColor: '#FE9100' }}
      />
    </span>
  );
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: InboundMailStatus }) {
  const config = STATUS_TABS.find(t => t.key === status) || STATUS_TABS[0];
  return (
    <span 
      className="text-[9px] uppercase px-1.5 py-0.5 rounded font-medium"
      style={{ background: `${config.color}20`, color: config.color }}
    >
      {config.label}
    </span>
  );
}

// ============================================================================
// LABEL CHIPS COMPONENT
// ============================================================================

function LabelChips({ labels, max = 2 }: { labels: string[]; max?: number }) {
  if (!labels || labels.length === 0) return null;
  
  const visible = labels.slice(0, max);
  const remaining = labels.length - max;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map((label, i) => (
        <span 
          key={i}
          className="text-[9px] px-1.5 py-0.5 rounded"
          style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}
        >
          {label.replace('CATEGORY_', '').replace('INBOX', '📥')}
        </span>
      ))}
      {remaining > 0 && (
        <span 
          className="text-[9px] px-1 py-0.5 rounded"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          +{remaining}
        </span>
      )}
    </div>
  );
}

// ============================================================================
// MAIL LIST ITEM COMPONENT
// ============================================================================

function MailListItem({ 
  mail, 
  isSelected, 
  onClick 
}: { 
  mail: InboundMailListItem; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const timeAgo = useMemo(() => {
    try {
      return formatDistanceToNow(new Date(mail.receivedAt), { addSuffix: true, locale: de });
    } catch {
      return '';
    }
  }, [mail.receivedAt]);

  const exactTime = useMemo(() => {
    try {
      return format(new Date(mail.receivedAt), 'dd.MM.yyyy HH:mm');
    } catch {
      return '';
    }
  }, [mail.receivedAt]);

  return (
    <motion.button
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl transition-all duration-200 group"
      style={{
        background: isSelected ? 'rgba(254,145,0,0.08)' : 'rgba(255,255,255,0.02)',
        border: isSelected ? '1px solid rgba(254,145,0,0.3)' : '1px solid transparent',
      }}
      whileHover={{ 
        scale: 1.005,
        borderColor: 'rgba(254,145,0,0.2)',
      }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div 
          className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold flex-shrink-0"
          style={{ 
            background: mail.status === 'NEW' 
              ? 'linear-gradient(135deg, #FE9100, #a34e00)' 
              : 'rgba(255,255,255,0.06)',
            color: mail.status === 'NEW' ? 'white' : 'rgba(255,255,255,0.5)',
          }}
        >
          {mail.fromEmail?.[0]?.toUpperCase() || '?'}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Subject */}
          <p 
            className="text-sm font-medium truncate mb-0.5"
            style={{ 
              color: mail.status === 'NEW' ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.7)',
            }}
          >
            {mail.subject || '(No Subject)'}
          </p>
          
          {/* From */}
          <p 
            className="text-xs truncate mb-1"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            {mail.fromName || mail.fromEmail}
          </p>
          
          {/* Snippet */}
          <p 
            className="text-[11px] line-clamp-2"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {mail.snippet || '—'}
          </p>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span 
            className="text-[10px]"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            title={exactTime}
          >
            {timeAgo}
          </span>
          <StatusBadge status={mail.status} />
        </div>
      </div>

      {/* Labels row */}
      {mail.labels && mail.labels.length > 0 && (
        <div className="mt-2 pl-12">
          <LabelChips labels={mail.labels} max={3} />
        </div>
      )}
    </motion.button>
  );
}

// ============================================================================
// DETAIL PANEL COMPONENT
// ============================================================================

function DetailPanel({ 
  mailId, 
  onClose,
  onStatusChange 
}: { 
  mailId: number | null;
  onClose: () => void;
  onStatusChange: (id: number, status: InboundMailStatus) => void;
}) {
  const { data: mail, isLoading, error } = useInboundMailDetail(mailId);
  const [activeTab, setActiveTab] = useState<'text' | 'html'>('text');
  const { toast } = useToast();

  const handleCopySummary = useCallback(() => {
    if (!mail) return;
    
    const summary = [
      `Subject: ${mail.subject}`,
      `From: ${mail.fromEmail}`,
      `Received: ${format(new Date(mail.receivedAt), 'dd.MM.yyyy HH:mm')}`,
      `Snippet: ${mail.snippet}`,
      '',
      'Body:',
      (mail.bodyText || '').slice(0, 500),
    ].join('\n');

    navigator.clipboard.writeText(summary);
    toast({ title: '✓ Summary copied to clipboard' });
  }, [mail, toast]);

  if (!mailId) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
            Select a message to preview
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="pt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (error || !mail) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-2" style={{ color: '#EF4444' }} />
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Failed to load mail
          </p>
        </div>
      </div>
    );
  }

  const bodyTextEmpty = !mail.bodyText || mail.bodyText.length === 0;
  const bodyHtmlEmpty = !mail.bodyHtml || mail.bodyHtml.length === 0;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div 
        className="p-4 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(233,215,196,0.08)' }}
      >
        <div className="flex items-start justify-between mb-3">
          <h3 
            className="text-base font-semibold pr-4"
            style={{ color: 'rgba(255,255,255,0.95)' }}
          >
            {mail.subject || '(No Subject)'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs mb-3" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <span className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            {mail.fromEmail}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(mail.receivedAt), 'dd.MM.yyyy HH:mm')}
          </span>
          <StatusBadge status={mail.status} />
        </div>

        {/* Labels */}
        {mail.labels && mail.labels.length > 0 && (
          <div className="mb-3">
            <LabelChips labels={mail.labels} max={5} />
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {mail.status === 'NEW' && (
            <ActionButton 
              icon={Eye} 
              label="Mark Open" 
              onClick={() => onStatusChange(mail.id, 'OPEN')} 
            />
          )}
          {(mail.status === 'NEW' || mail.status === 'OPEN') && (
            <ActionButton 
              icon={CheckCircle} 
              label="Mark Sent" 
              onClick={() => onStatusChange(mail.id, 'SENT')} 
              variant="success"
            />
          )}
          {mail.status !== 'ARCHIVED' && (
            <ActionButton 
              icon={Archive} 
              label="Archive" 
              onClick={() => onStatusChange(mail.id, 'ARCHIVED')} 
            />
          )}
          <ActionButton icon={Copy} label="Copy Summary" onClick={handleCopySummary} />
          <ActionButton 
            icon={UserPlus} 
            label="Create Lead" 
            onClick={() => toast({ title: '🚧 Coming next sprint' })} 
            disabled
          />
          <ActionButton 
            icon={Database} 
            label="Add to KB" 
            onClick={() => toast({ title: '🚧 Coming next sprint' })} 
            disabled
          />
        </div>
      </div>

      {/* Content Tabs */}
      <div 
        className="flex gap-1 px-4 pt-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(233,215,196,0.06)' }}
      >
        <TabButton 
          active={activeTab === 'text'} 
          onClick={() => setActiveTab('text')}
          label="Text"
        />
        <TabButton 
          active={activeTab === 'html'} 
          onClick={() => setActiveTab('html')}
          label="HTML"
          disabled={bodyHtmlEmpty}
        />
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-auto p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'text' ? (
            <motion.div
              key="text"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {bodyTextEmpty && mail.snippet ? (
                <div>
                  <p 
                    className="text-xs mb-2 px-2 py-1 rounded inline-block"
                    style={{ background: 'rgba(254,145,0,0.1)', color: '#FE9100' }}
                  >
                    Body empty — showing snippet
                  </p>
                  <p 
                    className="text-sm whitespace-pre-wrap"
                    style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.7 }}
                  >
                    {mail.snippet}
                  </p>
                </div>
              ) : bodyTextEmpty ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No text content available
                </p>
              ) : (
                <p 
                  className="text-sm whitespace-pre-wrap"
                  style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.7 }}
                >
                  {mail.bodyText}
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="html"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              {bodyHtmlEmpty ? (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  No HTML content available
                </p>
              ) : (
                <iframe
                  sandbox=""
                  srcDoc={mail.bodyHtml}
                  className="w-full h-full min-h-[300px] rounded-lg"
                  style={{ 
                    background: 'white',
                    border: '1px solid rgba(233,215,196,0.1)',
                  }}
                  title="Email HTML Content"
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ============================================================================
// ACTION BUTTON COMPONENT
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
  variant?: 'default' | 'success';
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: variant === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
        color: variant === 'success' ? '#10B981' : 'rgba(255,255,255,0.6)',
        border: '1px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = variant === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(254,145,0,0.2)';
          e.currentTarget.style.background = variant === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.background = variant === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)';
      }}
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

// ============================================================================
// TAB BUTTON COMPONENT
// ============================================================================

function TabButton({ 
  active, 
  onClick, 
  label,
  disabled = false
}: { 
  active: boolean; 
  onClick: () => void; 
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-2 text-xs font-medium transition-all duration-200 -mb-px disabled:opacity-40"
      style={{
        color: active ? '#FE9100' : 'rgba(255,255,255,0.5)',
        borderBottom: active ? '2px solid #FE9100' : '2px solid transparent',
      }}
    >
      {label}
    </button>
  );
}

// ============================================================================
// MAIN WIDGET COMPONENT
// ============================================================================

export function InboundMailWidget() {
  const [activeStatus, setActiveStatus] = useState<InboundMailStatus>('NEW');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMailId, setSelectedMailId] = useState<number | null>(null);

  const { data: listData, isLoading: listLoading, refetch } = useInboundMailList({
    status: activeStatus,
    q: searchQuery || undefined,
    limit: 30,
  });

  const { data: counts } = useInboundMailCounts();
  const { isLive } = usePollingIndicator();
  const updateStatus = useUpdateMailStatus();
  const { toast } = useToast();

  const handleStatusChange = useCallback((id: number, status: InboundMailStatus) => {
    updateStatus.mutate(
      { id, status },
      {
        onSuccess: () => {
          toast({ title: `✓ Marked as ${status.toLowerCase()}` });
          // If we just changed the status of selected mail, it will disappear from current list
          if (selectedMailId === id && status !== activeStatus) {
            setSelectedMailId(null);
          }
        },
        onError: () => {
          toast({ title: 'Failed to update status', variant: 'destructive' });
        },
      }
    );
  }, [updateStatus, toast, selectedMailId, activeStatus]);

  const mails = listData?.items || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(233,215,196,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div 
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(233,215,196,0.08)' }}
      >
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5" style={{ color: '#FE9100' }} />
          <h2 
            className="text-base font-bold tracking-wide"
            style={{ 
              fontFamily: 'Orbitron, sans-serif',
              background: 'linear-gradient(135deg, #e9d7c4, #FE9100)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            INBOUND · MAIL
          </h2>
          {counts && counts.NEW > 0 && (
            <span 
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100' }}
            >
              NEW {counts.NEW}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {isLive && (
            <div className="flex items-center gap-2">
              <LiveDot />
              <span className="text-[10px] uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Synced
              </span>
            </div>
          )}
          <button
            onClick={() => refetch()}
            className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: 'rgba(255,255,255,0.4)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search + Status Tabs */}
      <div 
        className="px-5 py-3 flex items-center gap-4 flex-wrap"
        style={{ borderBottom: '1px solid rgba(233,215,196,0.06)' }}
      >
        {/* Search */}
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg flex-1 min-w-[200px]"
          style={{ 
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(233,215,196,0.08)',
          }}
        >
          <Search className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject, from..."
            className="bg-transparent outline-none text-sm flex-1"
            style={{ color: 'rgba(255,255,255,0.8)' }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}>
              <X className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>
          )}
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => {
                setActiveStatus(tab.key);
                setSelectedMailId(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
              style={{
                background: activeStatus === tab.key ? `${tab.color}15` : 'transparent',
                color: activeStatus === tab.key ? tab.color : 'rgba(255,255,255,0.5)',
                border: activeStatus === tab.key ? `1px solid ${tab.color}30` : '1px solid transparent',
              }}
            >
              {tab.label}
              {counts && counts[tab.key] > 0 && (
                <span 
                  className="ml-1.5 px-1.5 py-0.5 rounded text-[10px]"
                  style={{ 
                    background: activeStatus === tab.key ? `${tab.color}20` : 'rgba(255,255,255,0.08)',
                  }}
                >
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content: List + Detail Split */}
      <div className="flex" style={{ height: '520px' }}>
        {/* Mail List */}
        <div 
          className="w-[380px] flex-shrink-0 overflow-y-auto p-3 space-y-2"
          style={{ borderRight: '1px solid rgba(233,215,196,0.06)' }}
        >
          {listLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                <div className="flex gap-3">
                  <Skeleton className="w-9 h-9 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : mails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <Mail className="w-10 h-10 mb-3" style={{ color: 'rgba(255,255,255,0.1)' }} />
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
                No {activeStatus.toLowerCase()} mails
              </p>
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

        {/* Detail Panel */}
        <DetailPanel
          mailId={selectedMailId}
          onClose={() => setSelectedMailId(null)}
          onStatusChange={handleStatusChange}
        />
      </div>
    </motion.div>
  );
}

export default InboundMailWidget;
