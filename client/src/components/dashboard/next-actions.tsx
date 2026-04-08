/**
 * ARAS Mission Control - Next Actions Panel
 * Interactive 1-click actions with real functionality
 * Premium ARAS CI design with micro-animations
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, Megaphone, Users, MessageSquare, Database, 
  Calendar, Zap, AlertTriangle, ChevronRight, Sparkles,
  Plus, ArrowRight
} from 'lucide-react';
import type { ActionItem, ActionCategory } from '@/lib/dashboard/overview.schema';
import { useActionDispatch } from '@/lib/actions/dispatch';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
  glow: '0 0 20px rgba(255,106,0,0.15)',
};

// Icon mapping
const categoryIcons: Record<ActionCategory, React.ReactNode> = {
  calls: <Phone size={16} />,
  campaigns: <Megaphone size={16} />,
  contacts: <Users size={16} />,
  spaces: <MessageSquare size={16} />,
  knowledge: <Database size={16} />,
  tasks: <Calendar size={16} />,
  system: <AlertTriangle size={16} />,
};

const categoryColors: Record<ActionCategory, string> = {
  calls: '#ff6a00',
  campaigns: '#f59e0b',
  contacts: '#22c55e',
  spaces: '#3b82f6',
  knowledge: '#8b5cf6',
  tasks: '#e9d7c4',
  system: '#ef4444',
};

interface NextActionsProps {
  actions: ActionItem[];
  isLoading?: boolean;
}

function ActionCard({ action, index }: { action: ActionItem; index: number }) {
  const dispatch = useActionDispatch();
  const [isExecuting, setIsExecuting] = useState(false);
  
  const color = categoryColors[action.category] || DT.orange;
  const icon = categoryIcons[action.category] || <Zap size={16} />;

  const handleClick = async () => {
    if (isExecuting) return;
    setIsExecuting(true);
    try {
      await dispatch(action.primaryCta);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="group relative"
    >
      <button
        onClick={handleClick}
        disabled={isExecuting}
        className="w-full text-left rounded-xl p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]"
        style={{
          background: DT.panelBg,
          border: `1px solid ${DT.panelBorder}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Priority indicator */}
        {action.priority === 'high' && (
          <div 
            className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse"
            style={{ background: color }}
          />
        )}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div 
            className="p-2 rounded-lg shrink-0 transition-transform group-hover:scale-110"
            style={{ 
              background: `${color}20`,
              color: color,
            }}
          >
            {icon}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-semibold text-white/90 truncate">
                {action.title}
              </h4>
              {action.priority === 'high' && (
                <Sparkles size={12} style={{ color }} className="shrink-0" />
              )}
            </div>
            
            {action.description && (
              <p className="text-[11px] text-white/50 line-clamp-2 mb-2">
                {action.description}
              </p>
            )}

            {/* CTA Button */}
            <div className="flex items-center gap-2">
              <span 
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all group-hover:gap-2"
                style={{ 
                  background: `${color}20`,
                  color: color,
                  border: `1px solid ${color}40`,
                }}
              >
                {isExecuting ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Wird ausgeführt...
                  </>
                ) : (
                  <>
                    {action.primaryCta.label}
                    <ArrowRight size={10} className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Chevron */}
          <ChevronRight 
            size={18} 
            className="shrink-0 text-white/20 group-hover:text-white/40 transition-colors" 
          />
        </div>

        {/* Hover glow effect */}
        <div 
          className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ 
            boxShadow: `0 0 30px ${color}20`,
          }}
        />
      </button>
    </motion.div>
  );
}

function EmptyState() {
  const dispatch = useActionDispatch();

  const defaultActions = [
    {
      title: 'Ersten Call starten',
      description: 'Teste ARAS Voice mit einem Einzelanruf',
      icon: <Phone size={20} />,
      color: '#ff6a00',
      path: '/app/power/einzelanruf',
    },
    {
      title: 'Kontakte importieren',
      description: 'Lade deine Kontakte für Kampagnen hoch',
      icon: <Users size={20} />,
      color: '#22c55e',
      path: '/app/contacts',
    },
    {
      title: 'Space erstellen',
      description: 'Starte einen AI-Chat Space',
      icon: <MessageSquare size={20} />,
      color: '#3b82f6',
      path: '/app/space',
    },
  ];

  return (
    <div className="text-center py-8">
      <div 
        className="w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center"
        style={{ background: 'rgba(255,106,0,0.15)' }}
      >
        <Sparkles size={24} style={{ color: DT.orange }} />
      </div>
      
      <h3 className="text-sm font-semibold text-white/80 mb-2">
        Willkommen bei ARAS AI
      </h3>
      <p className="text-[11px] text-white/50 mb-6 max-w-xs mx-auto">
        Starte mit diesen Aktionen, um ARAS optimal zu nutzen.
      </p>

      <div className="grid gap-3">
        {defaultActions.map((action, index) => (
          <motion.button
            key={action.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={() => dispatch({ 
              label: action.title, 
              actionType: 'NAVIGATE', 
              payload: { path: action.path } 
            })}
            className="flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: `${action.color}10`,
              border: `1px solid ${action.color}30`,
            }}
          >
            <div 
              className="p-2 rounded-lg"
              style={{ background: `${action.color}20`, color: action.color }}
            >
              {action.icon}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-white/90">{action.title}</div>
              <div className="text-[10px] text-white/50">{action.description}</div>
            </div>
            <ChevronRight size={16} className="text-white/30" />
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div 
          key={i}
          className="rounded-xl p-4 animate-pulse"
          style={{ background: 'rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10" />
            <div className="flex-1">
              <div className="h-4 w-32 bg-white/10 rounded mb-2" />
              <div className="h-3 w-48 bg-white/5 rounded mb-3" />
              <div className="h-6 w-24 bg-white/10 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NextActions({ actions, isLoading }: NextActionsProps) {
  const [filter, setFilter] = useState<ActionCategory | 'all'>('all');

  const filteredActions = filter === 'all' 
    ? actions 
    : actions.filter(a => a.category === filter);

  const categories = Array.from(new Set(actions.map(a => a.category)));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 
            className="text-sm font-bold uppercase tracking-wide"
            style={{
              background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Nächste Aktionen
          </h3>
          
          <span className="text-[10px] text-white/40 font-medium">
            {actions.length} verfügbar
          </span>
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider rounded-md transition-all shrink-0 ${
                filter === 'all' 
                  ? 'bg-[#ff6a00]/20 text-[#ff6a00]' 
                  : 'bg-white/5 text-white/40 hover:bg-white/10'
              }`}
            >
              Alle
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-2.5 py-1 text-[9px] font-medium uppercase tracking-wider rounded-md transition-all shrink-0 ${
                  filter === cat 
                    ? `bg-[${categoryColors[cat]}]/20 text-[${categoryColors[cat]}]` 
                    : 'bg-white/5 text-white/40 hover:bg-white/10'
                }`}
                style={filter === cat ? { 
                  background: `${categoryColors[cat]}20`, 
                  color: categoryColors[cat] 
                } : {}}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <LoadingSkeleton />
        ) : filteredActions.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {filteredActions.map((action, index) => (
                <ActionCard key={action.id} action={action} index={index} />
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default NextActions;
