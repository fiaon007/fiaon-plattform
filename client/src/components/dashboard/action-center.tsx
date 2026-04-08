/**
 * ARAS Action Center - Gemini AI Recommendations
 * Shows top actions from recent calls with 1-click execution
 * Premium ARAS CI design
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, ChevronRight, Phone, Mail, Calendar, 
  FileText, User, Zap, AlertTriangle, TrendingUp,
  MessageSquare, ExternalLink, Loader2, AlertCircle, RefreshCw
} from 'lucide-react';
import type { RecentCall } from '@/lib/dashboard/overview.schema';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

interface ActionCenterProps {
  calls: RecentCall[];
  isLoading?: boolean;
  onOpenCall?: (callId: string) => void;
  onOpenContact?: (contactId: string) => void;
  geminiEnabled?: boolean;
  error?: string | null;
}

interface ActionItem {
  callId: string;
  contactName: string;
  action: string;
  priority: number;
  reasoning?: string;
  riskFlags?: string[];
}

function PriorityBadge({ priority }: { priority: number }) {
  const color = priority >= 70 ? '#ef4444' : priority >= 40 ? '#f59e0b' : '#22c55e';
  const label = priority >= 70 ? 'Hoch' : priority >= 40 ? 'Mittel' : 'Normal';
  
  return (
    <span 
      className="text-[9px] px-1.5 py-0.5 rounded font-medium"
      style={{ background: `${color}20`, color }}
    >
      {label}
    </span>
  );
}

function ActionCard({ 
  action, 
  index,
  onOpenCall,
  onOpenContact,
}: { 
  action: ActionItem; 
  index: number;
  onOpenCall?: (callId: string) => void;
  onOpenContact?: (contactId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="group"
    >
      <div 
        className="p-3 rounded-xl transition-all cursor-pointer hover:bg-white/5"
        style={{ 
          borderLeft: `3px solid ${action.priority >= 70 ? '#ef4444' : action.priority >= 40 ? '#f59e0b' : DT.orange}`,
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          {/* Priority indicator */}
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: `${DT.orange}15` }}
          >
            <Zap size={14} style={{ color: DT.orange }} />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-white truncate">
                {action.contactName}
              </span>
              <PriorityBadge priority={action.priority} />
            </div>
            
            <p className="text-[11px] text-white/70 leading-relaxed">
              {action.action}
            </p>
            
            {/* Risk flags */}
            {action.riskFlags && action.riskFlags.length > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <AlertTriangle size={10} className="text-yellow-500" />
                <span className="text-[9px] text-yellow-500/80">
                  {action.riskFlags.join(', ')}
                </span>
              </div>
            )}
          </div>
          
          {/* Arrow */}
          <ChevronRight 
            size={14} 
            className={`text-white/30 transition-transform ${expanded ? 'rotate-90' : ''}`} 
          />
        </div>
        
        {/* Expanded actions */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 mt-3 border-t border-white/5 flex items-center gap-2 flex-wrap">
                {onOpenCall && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onOpenCall(action.callId); }}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors hover:bg-white/10"
                    style={{ color: DT.orange }}
                  >
                    <Phone size={10} />
                    Call öffnen
                  </button>
                )}
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-white/50 transition-colors hover:bg-white/10"
                >
                  <Mail size={10} />
                  E-Mail
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-white/50 transition-colors hover:bg-white/10"
                >
                  <Calendar size={10} />
                  Follow-up
                </button>
                <button
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-white/50 transition-colors hover:bg-white/10"
                >
                  <FileText size={10} />
                  Notiz
                </button>
              </div>
              
              {action.reasoning && (
                <p className="text-[10px] text-white/40 mt-2 italic">
                  "{action.reasoning}"
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function EmptyState({ hasCalls, onGenerate }: { hasCalls: boolean; onGenerate?: () => void }) {
  if (hasCalls) {
    // Has calls but no recommendations yet - show CTA to generate
    return (
      <div className="text-center py-6">
        <div 
          className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: `${DT.orange}15` }}
        >
          <Sparkles size={20} style={{ color: DT.orange }} />
        </div>
        <p className="text-xs text-white/60 mb-1">Empfehlungen verfügbar</p>
        <p className="text-[10px] text-white/40 mb-4">
          Lasse KI-Aktionen aus deinen Calls generieren
        </p>
        {onGenerate && (
          <button
            onClick={onGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium text-white transition-all hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
          >
            <Sparkles size={12} />
            Jetzt generieren
          </button>
        )}
      </div>
    );
  }

  // No calls at all - show hint to make calls first
  return (
    <div className="text-center py-6">
      <div 
        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.05)' }}
      >
        <Phone size={20} className="text-white/30" />
      </div>
      <p className="text-xs text-white/50 mb-1">Noch keine Calls</p>
      <p className="text-[10px] text-white/30 mb-4">
        Starte deinen ersten Anruf für KI-Empfehlungen
      </p>
      <a
        href="/app/power/einzelanruf"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-medium transition-colors hover:bg-white/10"
        style={{ color: DT.orange, border: `1px solid ${DT.orange}30` }}
      >
        <Phone size={12} />
        Ersten Call starten
      </a>
    </div>
  );
}

function AIDisabledState() {
  return (
    <div className="text-center py-6">
      <div 
        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(251,191,36,0.1)' }}
      >
        <AlertCircle size={20} className="text-yellow-500" />
      </div>
      <p className="text-xs text-yellow-500/80 mb-1">ARAS AI nicht verfügbar</p>
      <p className="text-[10px] text-white/30">
        KI-Empfehlungen sind für diese Umgebung deaktiviert
      </p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="text-center py-6">
      <div 
        className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center"
        style={{ background: 'rgba(239,68,68,0.1)' }}
      >
        <AlertTriangle size={20} className="text-red-400" />
      </div>
      <p className="text-xs text-red-400/80 mb-1">Fehler beim Laden</p>
      <p className="text-[10px] text-white/30 mb-3">{error}</p>
      {onRetry && (
        <button 
          onClick={onRetry}
          className="text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-1 mx-auto transition-colors hover:bg-white/10"
          style={{ color: DT.orange }}
        >
          <RefreshCw size={10} />
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className="p-3 rounded-xl animate-pulse" style={{ borderLeft: '3px solid rgba(255,106,0,0.3)' }}>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/10" />
            <div className="flex-1">
              <div className="h-3 w-24 bg-white/10 rounded mb-2" />
              <div className="h-2.5 w-full bg-white/5 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ActionCenter({ calls, isLoading, onOpenCall, onOpenContact, geminiEnabled = true, error }: ActionCenterProps) {
  // Extract top actions from calls with Gemini data - ROBUST (no undefined errors)
  const actions: ActionItem[] = [];
  
  // Safe iteration with null checks
  const safeCalls = Array.isArray(calls) ? calls : [];
  
  for (const call of safeCalls) {
    // Safe access to geminiActions
    const geminiActions = Array.isArray(call?.geminiActions) ? call.geminiActions : [];
    const riskFlags = Array.isArray(call?.geminiRiskFlags) ? call.geminiRiskFlags : [];
    
    if (geminiActions.length > 0) {
      actions.push({
        callId: call.id || '',
        contactName: call.contact?.name || call.contact?.phone || 'Unbekannt',
        action: geminiActions[0] || 'Follow-up planen',
        priority: typeof call.geminiPriority === 'number' ? call.geminiPriority : 50,
        reasoning: call.geminiSuggestedMessage || undefined,
        riskFlags: riskFlags.length > 0 ? riskFlags : undefined,
      });
    } else if (call?.nextStep && typeof call.nextStep === 'string') {
      // Fallback to nextStep if no Gemini data
      actions.push({
        callId: call.id || '',
        contactName: call.contact?.name || call.contact?.phone || 'Unbekannt',
        action: call.nextStep,
        priority: 50,
      });
    }
  }
  
  // Sort by priority and take top 5
  const topActions = actions
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 5);
  
  // Determine content state
  const hasGeminiData = actions.some(a => a.priority !== 50 || a.riskFlags);
  const showCachedBadge = hasGeminiData && !isLoading;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div 
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
            >
              <Sparkles size={12} className="text-white" />
            </div>
            <h3 
              className="text-sm font-bold uppercase tracking-wide"
              style={{
                background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Handlungsempfehlungen
            </h3>
          </div>
          
          <span className="text-[9px] text-white/30 flex items-center gap-1">
            <Sparkles size={10} />
            {showCachedBadge ? 'Cached' : 'ARAS AI'}
          </span>
        </div>
        <p className="text-[10px] text-white/40 mt-1">
          Top Aktionen basierend auf deinen letzten Calls
        </p>
      </div>

      {/* Content */}
      <div className="p-3 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState error={error} />
        ) : !geminiEnabled && topActions.length === 0 ? (
          <AIDisabledState />
        ) : topActions.length === 0 ? (
          <EmptyState hasCalls={safeCalls.length > 0} />
        ) : (
          <div className="space-y-2">
            {topActions.map((action, index) => (
              <ActionCard 
                key={`${action.callId}-${index}`}
                action={action}
                index={index}
                onOpenCall={onOpenCall}
                onOpenContact={onOpenContact}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {topActions.length > 0 && (
        <div className="px-4 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-white/30">
              {topActions.length} von {calls.length} Calls mit Empfehlungen
            </span>
            <a 
              href="/app/power"
              className="text-[10px] flex items-center gap-1 transition-colors hover:text-white/70"
              style={{ color: DT.orange }}
            >
              Alle Calls <ExternalLink size={10} />
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default ActionCenter;
