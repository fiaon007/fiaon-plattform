/**
 * ============================================================================
 * ARAS AI INTELLIGENCE PANEL
 * ============================================================================
 * Premium AI-powered insights panel for Team Command Center
 * Displays: Key Signals, Risks & Bottlenecks, Recommended Actions
 * ============================================================================
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, AlertTriangle, Zap, TrendingUp, ChevronRight,
  CheckCircle, Clock, RefreshCw, Brain, Target, AlertCircle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface Highlight {
  id: string;
  title: string;
  severity: 'info' | 'warning' | 'success';
  tag: string;
  entityType?: string;
  entityId?: string;
  text: string;
}

interface Risk {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  entityType?: string;
  entityId?: string;
  text: string;
}

interface Action {
  id: string;
  title: string;
  dueAt?: string;
  entityType?: string;
  entityId?: string;
  ctaLabel: string;
}

interface IntelligenceData {
  range: string;
  generatedAt: string;
  stats: {
    deals: number;
    tasks: number;
    calls: number;
    contacts: number;
    feedItems: number;
  };
  highlights: Highlight[];
  risks: Risk[];
  actions: Action[];
}

interface AIIntelligencePanelProps {
  onNavigate?: (entityType: string, entityId: string) => void;
  onActionClick?: (action: Action) => void;
}

// ============================================================================
// SKELETON COMPONENT
// ============================================================================

function IntelligenceSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex gap-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 w-16 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }} />
        ))}
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIIntelligencePanel({ onNavigate, onActionClick }: AIIntelligencePanelProps) {
  const [range, setRange] = useState<'today' | '24h' | '7d'>('24h');

  const { data, isLoading, error, refetch, isFetching } = useQuery<IntelligenceData>({
    queryKey: ['ai-intelligence', range],
    queryFn: async () => {
      const res = await fetch(`/api/internal/command-center/ai-intelligence?range=${range}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch intelligence');
      return res.json();
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refresh every 10 minutes
  });

  const severityColors = {
    info: { bg: 'rgba(59,130,246,0.1)', border: 'rgba(59,130,246,0.2)', text: '#3B82F6' },
    warning: { bg: 'rgba(234,179,8,0.1)', border: 'rgba(234,179,8,0.2)', text: '#EAB308' },
    success: { bg: 'rgba(34,197,94,0.1)', border: 'rgba(34,197,94,0.2)', text: '#22C55E' },
  };

  const riskColors = {
    low: { bg: 'rgba(107,114,128,0.1)', text: '#9CA3AF' },
    medium: { bg: 'rgba(234,179,8,0.1)', text: '#EAB308' },
    high: { bg: 'rgba(239,68,68,0.1)', text: '#EF4444' },
  };

  return (
    <div 
      className="rounded-2xl p-5 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(254,145,0,0.05), rgba(163,78,0,0.02))',
        border: '1px solid rgba(254,145,0,0.15)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(254,145,0,0.1)',
      }}
    >
      {/* Background Glow */}
      <div 
        className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FE9100, transparent)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(254,145,0,0.15)' }}
          >
            <Brain className="w-4 h-4" style={{ color: '#FE9100' }} />
          </div>
          <div>
            <h3 
              className="text-sm font-semibold"
              style={{ fontFamily: 'Orbitron, sans-serif', color: 'rgba(255,255,255,0.95)' }}
            >
              ARAS AI Intelligence
            </h3>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {data?.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : 'Loading...'}
            </p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} style={{ color: 'rgba(255,255,255,0.4)' }} />
        </button>
      </div>

      {/* Range Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
        {(['today', '24h', '7d'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setRange(tab)}
            className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={{
              background: range === tab ? 'rgba(254,145,0,0.2)' : 'transparent',
              color: range === tab ? '#FE9100' : 'rgba(255,255,255,0.5)',
              border: range === tab ? '1px solid rgba(254,145,0,0.3)' : '1px solid transparent',
            }}
          >
            {tab === 'today' ? 'Today' : tab === '24h' ? '24h' : '7 Days'}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <IntelligenceSkeleton />
      ) : error ? (
        <div className="text-center py-8">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'rgba(239,68,68,0.5)' }} />
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
            Intelligence temporarily unavailable
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Key Signals */}
          {data?.highlights && data.highlights.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-3.5 h-3.5" style={{ color: '#FE9100' }} />
                <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Key Signals
                </span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {data.highlights.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-xl transition-colors hover:bg-white/[0.02]"
                      style={{
                        background: severityColors[item.severity].bg,
                        border: `1px solid ${severityColors[item.severity].border}`,
                      }}
                    >
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        {item.severity === 'success' ? (
                          <CheckCircle className="w-3.5 h-3.5" style={{ color: severityColors[item.severity].text }} />
                        ) : item.severity === 'warning' ? (
                          <AlertTriangle className="w-3.5 h-3.5" style={{ color: severityColors[item.severity].text }} />
                        ) : (
                          <TrendingUp className="w-3.5 h-3.5" style={{ color: severityColors[item.severity].text }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                            {item.title}
                          </span>
                          <span 
                            className="text-[9px] px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,255,255,0.05)', color: severityColors[item.severity].text }}
                          >
                            {item.tag}
                          </span>
                        </div>
                        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
                          {item.text}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Risks & Bottlenecks */}
          {data?.risks && data.risks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Risks & Bottlenecks
                </span>
              </div>
              <div className="space-y-2">
                {data.risks.map((risk, index) => (
                  <motion.button
                    key={risk.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => risk.entityType && risk.entityId && onNavigate?.(risk.entityType, risk.entityId)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01]"
                    style={{
                      background: riskColors[risk.severity].bg,
                      border: `1px solid ${riskColors[risk.severity].text}20`,
                    }}
                  >
                    <div 
                      className="w-2 h-8 rounded-full"
                      style={{ background: riskColors[risk.severity].text }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {risk.title}
                      </p>
                      <p className="text-[10px] truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {risk.text}
                      </p>
                    </div>
                    {risk.entityId && (
                      <ChevronRight className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Actions */}
          {data?.actions && data.actions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                <span className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Recommended Actions
                </span>
              </div>
              <div className="space-y-2">
                {data.actions.map((action, index) => (
                  <motion.button
                    key={action.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => onActionClick?.(action)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:bg-white/[0.04] group"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(16,185,129,0.1)' }}
                    >
                      <Zap className="w-4 h-4" style={{ color: '#10B981' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'rgba(255,255,255,0.9)' }}>
                        {action.title}
                      </p>
                      {action.dueAt && (
                        <div className="flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.4)' }} />
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            {new Date(action.dueAt).toLocaleDateString('de-DE')}
                          </span>
                        </div>
                      )}
                    </div>
                    <span 
                      className="px-2 py-1 rounded-lg text-[10px] font-medium transition-all opacity-0 group-hover:opacity-100"
                      style={{ 
                        background: 'linear-gradient(135deg, #FE9100, #a34e00)', 
                        color: 'white' 
                      }}
                    >
                      {action.ctaLabel}
                    </span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {(!data?.highlights?.length && !data?.risks?.length && !data?.actions?.length) && (
            <div className="text-center py-8">
              <Sparkles className="w-10 h-10 mx-auto mb-3" style={{ color: 'rgba(254,145,0,0.3)' }} />
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Alles im grünen Bereich
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Keine dringenden Insights für diesen Zeitraum
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <p className="text-[10px] text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>
          Powered by <span style={{ color: 'rgba(254,145,0,0.6)' }}>ARAS AI</span> • Real-time computed insights
        </p>
      </div>
    </div>
  );
}

export default AIIntelligencePanel;
