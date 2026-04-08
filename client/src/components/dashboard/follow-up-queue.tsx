/**
 * Follow-Up Queue - Prioritized next actions from calls
 * Mission Control V5 — One-click done, proper states
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowRight, Phone, MessageSquare, Calendar, 
  Sparkles, Clock, Copy, Check, ChevronRight, 
  ExternalLink, AlertCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import { useToast } from '../ui/toast-provider';

// ARAS Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(20,20,25,0.85)',
  panelBorder: 'rgba(255,255,255,0.06)',
};


interface FollowUpItem {
  id: string;
  callId: string;
  contactId?: string;
  contactName: string;
  contactPhone?: string;
  lastCallAt: string;
  action: string;
  reason: string;
  priority: number;
  sentiment?: 'positive' | 'neutral' | 'negative';
  hasGeminiInsights: boolean;
}

interface FollowUpQueueProps {
  followups: FollowUpItem[];
  total: number;
  loading?: boolean;
  onOpenCall?: (callId: string) => void;
  onOpenContact?: (contactId: string) => void;
  onCopyMessage?: (action: string, contactName: string) => void;
  onCreateTask?: (followup: FollowUpItem) => void;
  onGenerateFollowups?: () => void;
}

function SentimentDot({ sentiment }: { sentiment?: string }) {
  const colors = {
    positive: '#22c55e',
    neutral: '#f59e0b',
    negative: '#ef4444',
  };
  const color = colors[sentiment as keyof typeof colors] || colors.neutral;
  
  return (
    <span 
      className="w-2 h-2 rounded-full flex-shrink-0"
      style={{ background: color }}
    />
  );
}

function FollowUpCard({ 
  followup, 
  onOpenCall, 
  onOpenContact,
  onCopyMessage,
  onCreateTask,
  taskCreationEnabled = false, // Feature flag for task creation
}: { 
  followup: FollowUpItem;
  onOpenCall?: (id: string) => void;
  onOpenContact?: (id: string) => void;
  onCopyMessage?: (action: string, name: string) => void;
  onCreateTask?: (f: FollowUpItem) => void;
  taskCreationEnabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  let timeAgo = '';
  try {
    timeAgo = formatDistanceToNow(new Date(followup.lastCallAt), { addSuffix: true, locale: de });
  } catch { /* ignore */ }

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const message = `Hallo ${followup.contactName},\n\nbezüglich unseres letzten Gesprächs: ${followup.action}\n\nMit freundlichen Grüßen`;
    
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      showToast('Follow-up Text kopiert', 'success');
      setTimeout(() => setCopied(false), 1200);
      onCopyMessage?.(followup.action, followup.contactName);
    } catch (err) {
      showToast('Kopieren nicht möglich', 'error', 'Browser Rechte prüfen');
    }
  }, [followup, onCopyMessage, showToast]);

  const handleRowClick = useCallback(() => {
    // Open contact drawer if contactId exists, otherwise open call
    if (followup.contactId && onOpenContact) {
      onOpenContact(followup.contactId);
    } else if (onOpenCall) {
      onOpenCall(followup.callId);
    }
  }, [followup, onOpenCall, onOpenContact]);

  const handleTaskClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (taskCreationEnabled && onCreateTask) {
      onCreateTask(followup);
      showToast('Task erstellt', 'success');
    }
  }, [followup, taskCreationEnabled, onCreateTask, showToast]);

  const handleOpenClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (followup.contactId && onOpenContact) {
      onOpenContact(followup.contactId);
    }
  }, [followup, onOpenContact]);

  // Priority badge
  const priorityLabel = followup.priority >= 80 ? 'P1' : followup.priority >= 50 ? 'P2' : 'P3';
  const priorityColor = followup.priority >= 80 ? '#ef4444' : followup.priority >= 50 ? DT.orange : '#6b7280';

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={handleRowClick}
      className="group p-3 rounded-xl transition-all hover:bg-white/5 cursor-pointer"
      style={{ 
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${DT.panelBorder}`,
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleRowClick()}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex items-center gap-2">
          <SentimentDot sentiment={followup.sentiment} />
          <span 
            className="px-1.5 py-0.5 rounded text-[9px] font-bold"
            style={{ background: `${priorityColor}20`, color: priorityColor }}
          >
            {priorityLabel}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white truncate">
              {followup.contactName}
            </span>
            {followup.hasGeminiInsights && (
              <Sparkles size={12} style={{ color: DT.orange }} />
            )}
          </div>
          
          <p className="text-[11px] text-white/50 mt-0.5 flex items-center gap-1">
            <Clock size={10} />
            {timeAgo}
          </p>
        </div>

        <ChevronRight size={14} className="text-white/30 group-hover:text-white/50 transition-colors" />
      </div>

      {/* Action Preview */}
      <div className="mt-2 pl-7">
        <p className="text-xs text-white/70 line-clamp-1">
          {followup.action}
        </p>
      </div>

      {/* Quick Actions - Icon buttons */}
      <div className="mt-3 pl-7 flex items-center gap-1">
        {/* Copy Button */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
          style={{ color: copied ? '#22c55e' : DT.orange }}
          title="Follow-up Text kopieren"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? 'Kopiert' : 'Nachricht'}
        </button>
        
        {/* Task Button - Disabled with tooltip if not enabled */}
        <div className="relative group/task">
          <button
            onClick={handleTaskClick}
            disabled={!taskCreationEnabled}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all focus:outline-none ${
              taskCreationEnabled 
                ? 'text-white/60 hover:bg-white/10 focus:ring-1 focus:ring-white/20' 
                : 'text-white/30 cursor-not-allowed'
            }`}
            title={taskCreationEnabled ? 'Task erstellen' : 'Task creation coming next'}
          >
            <Calendar size={10} />
            Task
          </button>
          {!taskCreationEnabled && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-black/90 text-[9px] text-white/70 whitespace-nowrap opacity-0 group-hover/task:opacity-100 transition-opacity pointer-events-none z-10">
              Coming next
            </span>
          )}
        </div>

        {/* Open Contact Button */}
        {followup.contactId && (
          <button
            onClick={handleOpenClick}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-white/60 transition-all hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-white/20"
            title="Kontakt öffnen"
          >
            <ExternalLink size={10} />
            Öffnen
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({ onGenerate }: { onGenerate?: () => void }) {
  return (
    <div className="text-center py-8 px-4">
      <div 
        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: `${DT.orange}15` }}
      >
        <MessageSquare size={20} style={{ color: DT.orange }} />
      </div>
      <p className="text-xs text-white/60 mb-1">Keine Follow-ups erkannt</p>
      <p className="text-[10px] text-white/40 mb-4">
        Starte Anrufe für automatische Empfehlungen
      </p>
      {onGenerate && (
        <button
          onClick={onGenerate}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium text-white transition-all hover:scale-105"
          style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
        >
          <Sparkles size={12} />
          Aus Calls generieren
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-white/10" />
            <div className="flex-1">
              <div className="h-4 bg-white/10 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/2 mt-1" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function FollowUpQueue({
  followups,
  total,
  loading,
  onOpenCall,
  onOpenContact,
  onCopyMessage,
  onCreateTask,
  onGenerateFollowups,
}: FollowUpQueueProps) {

  return (
    <div 
      className="rounded-2xl overflow-hidden"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div 
        className="px-4 py-3 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${DT.panelBorder}` }}
      >
        <div className="flex items-center gap-2">
          <div 
            className="w-6 h-6 rounded-lg flex items-center justify-center"
            style={{ background: `${DT.orange}20` }}
          >
            <ArrowRight size={12} style={{ color: DT.orange }} />
          </div>
          <h3 
            className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: DT.gold }}
          >
            Follow-up Queue
          </h3>
        </div>
        
        {total > 0 && (
          <span className="text-[10px] text-white/40">
            {total} offen
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : followups.length === 0 ? (
        <EmptyState onGenerate={onGenerateFollowups} />
      ) : (
        <div className="p-3 space-y-2 max-h-[400px] overflow-y-auto">
          <AnimatePresence>
            {followups.map((followup) => (
              <FollowUpCard
                key={followup.id}
                followup={followup}
                onOpenCall={onOpenCall}
                onOpenContact={onOpenContact}
                onCopyMessage={onCopyMessage}
                onCreateTask={onCreateTask}
                taskCreationEnabled={false} // Set to true when backend is ready
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Footer */}
      {followups.length > 0 && total > followups.length && (
        <div 
          className="px-4 py-2 text-center"
          style={{ borderTop: `1px solid ${DT.panelBorder}` }}
        >
          <p className="text-[10px] text-white/30">
            +{total - followups.length} weitere
          </p>
        </div>
      )}
    </div>
  );
}

export default FollowUpQueue;
