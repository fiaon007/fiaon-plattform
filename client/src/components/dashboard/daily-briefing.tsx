/**
 * Daily Briefing Card - AI-generated summary of priorities
 * Mission Control V5 — Premium Hero + Realtime Mode
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { 
  Sparkles, RefreshCw, AlertTriangle, CheckCircle, 
  ChevronRight, Zap, Info, ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { PrioritiesSkeleton, QuickWinsSkeleton, RiskFlagsSkeleton } from './daily-briefing-skeletons';

// ARAS Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(20,20,25,0.85)',
  panelBorder: 'rgba(255,255,255,0.06)',
  heroBg: 'rgba(255,255,255,0.03)',
  heroGlow: 'rgba(255,106,0,0.08)',
};

interface BriefingPriority {
  title: string;
  why: string;
  callId?: string;
  contactName?: string;
  contactId?: string;
  impact?: string;
  action?: string;
}

interface DailyBriefingData {
  headline: string;
  missionSummary?: string;
  topPriorities: BriefingPriority[];
  quickWins: string[];
  riskFlags: string[];
  generatedAt: string;
  expiresAt?: string;
  cached?: boolean;
  mode?: 'cached' | 'realtime';
  sourceCount?: number;
  sources?: Array<{ title: string; url?: string; publisher?: string; date?: string }>;
  meta?: {
    ttlSeconds?: number;
    fallbackUsed?: boolean;
    geminiEnabled?: boolean;
    rateLimit?: { minIntervalSeconds: number; nextAllowedAt?: string };
  };
}

interface DailyBriefingProps {
  briefing?: DailyBriefingData;
  loading?: boolean;
  onRefresh?: (mode?: 'cached' | 'realtime', force?: boolean) => void;
  onOpenCall?: (callId: string) => void;
  onOpenContact?: (contactId: string) => void;
  stats?: { callsCount?: number; followupsCount?: number; contactsCount?: number };
}

// ═══════════════════════════════════════════════════════════════
// MISSION HERO - Premium tipping card with animated gradient
// ═══════════════════════════════════════════════════════════════

interface MissionHeroProps {
  briefing?: DailyBriefingData;
  onStartMission: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  stats?: { callsCount?: number; followupsCount?: number; contactsCount?: number };
}

function MissionHero({ briefing, onStartMission, onRefresh, refreshing, stats }: MissionHeroProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  
  // Motion values for 3D tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  
  // Spring physics for smooth tilt
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [4, -4]), { stiffness: 300, damping: 30 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-4, 4]), { stiffness: 300, damping: 30 });
  
  // Specular highlight position
  const highlightX = useSpring(useTransform(mouseX, [-0.5, 0.5], [20, 80]), { stiffness: 200, damping: 25 });
  const highlightY = useSpring(useTransform(mouseY, [-0.5, 0.5], [20, 80]), { stiffness: 200, damping: 25 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    mouseX.set(x);
    mouseY.set(y);
  }, [mouseX, mouseY]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // Format today's date (Europe/Vienna timezone)
  const todayFormatted = new Date().toLocaleDateString('de-AT', { 
    timeZone: 'Europe/Vienna',
    day: '2-digit',
    month: '2-digit', 
    year: 'numeric'
  });
  const lastUpdated = briefing?.generatedAt 
    ? new Date(briefing.generatedAt).toLocaleTimeString('de-AT', { 
        timeZone: 'Europe/Vienna', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    : '--:--';
  
  const modeLabel = briefing?.mode === 'realtime' ? 'ARAS AI Live' : 'Cache';
  
  // Detect mobile + reduced motion preference
  const [isMobile, setIsMobile] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Check prefers-reduced-motion
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handleChange = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);
  
  // Disable animations when reduced motion is preferred
  const shouldAnimate = !prefersReducedMotion;
  const shouldTilt = !isMobile && shouldAnimate;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: shouldAnimate ? 10 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldAnimate ? 0.32 : 0, ease: 'easeOut' }}
      onMouseMove={shouldTilt ? handleMouseMove : undefined}
      onMouseEnter={shouldTilt ? () => setIsHovered(true) : undefined}
      onMouseLeave={shouldTilt ? handleMouseLeave : undefined}
      style={shouldTilt ? {
        rotateX: rotateX,
        rotateY: rotateY,
        transformStyle: 'preserve-3d',
        perspective: 900,
      } : {}}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Animated border gradient (desktop: sheen, mobile: breathing glow, reduced-motion: static) */}
      <motion.div 
        className="absolute inset-0 rounded-2xl pointer-events-none"
        animate={shouldAnimate && isMobile ? { 
          opacity: [0.10, 0.18, 0.10] 
        } : { 
          opacity: 0.40 
        }}
        transition={shouldAnimate && isMobile ? { 
          duration: 1.8, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        } : {}}
        style={{
          background: `linear-gradient(135deg, ${DT.gold}40, ${DT.orange}60, rgba(255,255,255,0.3), ${DT.orange}60, ${DT.gold}40)`,
          backgroundSize: '300% 300%',
          animation: shouldAnimate && !isMobile ? 'borderSheen 4.8s linear infinite' : undefined,
          padding: '1px',
          mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          maskComposite: 'xor',
          WebkitMaskComposite: 'xor',
        }}
      />
      
      {/* Glass background */}
      <div 
        className="relative p-6 md:p-6"
        style={{
          background: `linear-gradient(135deg, ${DT.heroBg}, ${DT.heroGlow})`,
          backdropFilter: 'blur(20px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Specular highlight */}
        <motion.div
          className="absolute inset-0 pointer-events-none opacity-0 transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.6 : 0,
            background: useTransform(
              [highlightX, highlightY],
              ([x, y]) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.08) 0%, transparent 50%)`
            ),
          }}
        />

        {/* Eyebrow */}
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2 font-medium">
          ARAS AI • Daily Mission
        </p>

        {/* Headline */}
        <h2 
          className="text-lg md:text-xl font-bold tracking-tight mb-2"
          style={{
            fontFamily: "'Orbitron', sans-serif",
            background: `linear-gradient(90deg, ${DT.gold}, ${DT.orange}, #fff)`,
            backgroundSize: '200% auto',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            animation: 'sheen 6s linear infinite',
          }}
        >
          Heutige Handlungsempfehlung
        </h2>

        {/* Subline */}
        <p className="text-xs text-white/60 leading-relaxed max-w-lg mb-4">
          {briefing?.missionSummary || 
            'Ich habe deine neuesten Calls, Follow-ups und Signale ausgewertet und daraus eine klare Mission für heute gebaut.'}
        </p>

        {/* Mission Intelligence Line - WOW V8 */}
        <div className="text-[12px] text-white/35 mb-4 leading-relaxed">
          Stand: {todayFormatted} (Europe/Vienna) • {' '}
          {briefing?.sourceCount && briefing.sourceCount > 0 
            ? `${briefing.sourceCount}+ Quellen` 
            : 'Nur Accountdaten ausgewertet'} • {' '}
          Modus: {modeLabel}
        </div>

        {/* Stats Microline - Only render if data exists */}
        {(stats?.callsCount || stats?.followupsCount || stats?.contactsCount) && (
          <p className="text-[10px] text-white/30 mb-4">
            Basierend auf {stats.callsCount || 0} Calls, {stats.followupsCount || 0} Follow-ups, {stats.contactsCount || 0} Kontakten
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Primary Action */}
          <button
            onClick={onStartMission}
            disabled={refreshing}
            className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:translate-y-[-1px] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/55 focus:ring-offset-2 focus:ring-offset-black/80 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: `linear-gradient(135deg, ${DT.orange}, #ff8533)`,
              boxShadow: `0 4px 14px ${DT.orange}40`,
            }}
          >
            Mission starten
            <ArrowDown size={14} className="transition-transform group-hover:translate-y-0.5" />
          </button>

          {/* Secondary Action - Refresh */}
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 hover:translate-y-[-1px] active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-[#ff6a00]/55 focus:ring-offset-2 focus:ring-offset-black/80 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                color: refreshing ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.70)',
              }}
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
              {refreshing ? 'Aktualisiere…' : 'Briefing aktualisieren'}
            </button>
          )}
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes borderSheen {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes sheen {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero skeleton */}
      <div className="animate-pulse rounded-2xl p-6" style={{ background: DT.heroBg }}>
        <div className="h-3 bg-white/10 rounded w-24 mb-3" />
        <div className="h-6 bg-white/10 rounded w-3/4 mb-3" />
        <div className="h-4 bg-white/5 rounded w-full mb-2" />
        <div className="h-4 bg-white/5 rounded w-5/6 mb-4" />
        <div className="h-10 bg-white/10 rounded w-36" />
      </div>
      {/* Content skeleton */}
      <div className="animate-pulse rounded-2xl p-4" style={{ background: DT.panelBg }}>
        <div className="h-4 bg-white/10 rounded w-1/2 mb-4" />
        <div className="space-y-2">
          <div className="h-12 bg-white/5 rounded" />
          <div className="h-12 bg-white/5 rounded" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PRIORITY ITEM - Expandable with details
// ═══════════════════════════════════════════════════════════════

function PriorityItem({
  priority,
  index,
  isHighlighted,
  onOpenCall,
  onOpenContact,
}: {
  priority: BriefingPriority;
  index: number;
  isHighlighted: boolean;
  onOpenCall?: (id: string) => void;
  onOpenContact?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const handleClick = () => {
    if (priority.contactId && onOpenContact) {
      onOpenContact(priority.contactId);
    } else if (priority.callId && onOpenCall) {
      onOpenCall(priority.callId);
    } else {
      setExpanded(!expanded);
    }
  };

  return (
    <motion.button
      layout
      onClick={handleClick}
      className={`w-full text-left p-3 rounded-xl transition-all group ${
        isHighlighted ? 'ring-2 ring-offset-2 ring-offset-transparent' : ''
      }`}
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${isHighlighted ? DT.orange : DT.panelBorder}`,
        boxShadow: isHighlighted ? `0 0 20px ${DT.orange}30` : 'none',
      }}
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <div 
          className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
          style={{ background: `${DT.orange}20`, color: DT.orange }}
        >
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/90">
            {priority.title}
          </p>
          <p className="text-[10px] text-white/50 mt-0.5 line-clamp-1">
            {priority.why}
          </p>
          
          {/* Expanded details */}
          {expanded && (priority.impact || priority.action) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.22 }}
              className="mt-2 pt-2 border-t border-white/5"
            >
              {priority.impact && (
                <p className="text-[10px] text-white/40 mb-1">
                  <span className="text-white/60">Impact:</span> {priority.impact}
                </p>
              )}
              {priority.action && (
                <p className="text-[10px] text-white/40">
                  <span className="text-white/60">Aktion:</span> {priority.action}
                </p>
              )}
            </motion.div>
          )}
        </div>
        <ChevronRight 
          size={14} 
          className={`text-white/20 transition-all ${
            expanded ? 'rotate-90' : 'group-hover:translate-x-0.5'
          }`}
        />
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════
// MODE TOGGLE - Cache vs Realtime
// ═══════════════════════════════════════════════════════════════

function ModeToggle({
  currentMode,
  pendingMode,
  onModeChange,
  geminiEnabled,
}: {
  currentMode: 'cached' | 'realtime';
  pendingMode: 'cached' | 'realtime';
  onModeChange: (mode: 'cached' | 'realtime') => void;
  geminiEnabled: boolean;
}) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <button
        onClick={() => onModeChange('cached')}
        className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
          pendingMode === 'cached' 
            ? 'bg-white/10 text-white' 
            : 'text-white/40 hover:text-white/60'
        }`}
      >
        Cache
      </button>
      <div className="relative">
        <button
          onClick={() => geminiEnabled && onModeChange('realtime')}
          disabled={!geminiEnabled}
          className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
            pendingMode === 'realtime' 
              ? 'text-white' 
              : geminiEnabled 
                ? 'text-white/40 hover:text-white/60' 
                : 'text-white/20 cursor-not-allowed'
          }`}
          style={{
            background: pendingMode === 'realtime' ? `${DT.orange}30` : 'transparent',
          }}
        >
          Realtime
        </button>
        {!geminiEnabled && (
          <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded bg-black/90 text-[9px] text-white/70 whitespace-nowrap opacity-0 hover:opacity-100 pointer-events-none z-10">
            ARAS AI Live nicht verfügbar
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SOURCES DISPLAY - Only shown if real sources exist
// ═══════════════════════════════════════════════════════════════

function SourcesDisplay({ sources }: { sources?: DailyBriefingData['sources'] }) {
  const [expanded, setExpanded] = useState(false);
  
  // CRITICAL: Only show sources that have real URLs - never fake sources
  const validSources = sources?.filter(s => s.url && s.url.startsWith('http')) || [];
  
  // If no valid sources with URLs, show "Account-Daten" indicator
  if (validSources.length === 0) {
    return (
      <span className="text-[10px] text-white/30">
        Nur Accountdaten ausgewertet
      </span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-[10px] text-white/40 hover:text-white/60 transition-colors focus:outline-none focus:ring-1 focus:ring-white/20 rounded"
      >
        <span>Quellen: {validSources.length}</span>
        <ChevronRight size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      
      {expanded && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 mt-2 w-72 p-3 rounded-xl z-20"
          style={{
            background: 'rgba(15,15,18,0.98)',
            border: `1px solid ${DT.panelBorder}`,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <p className="text-[9px] uppercase tracking-wider text-white/30 mb-2">Externe Quellen</p>
          <div className="space-y-2.5 max-h-48 overflow-y-auto">
            {validSources.map((source, i) => (
              <div key={i} className="text-[10px] pb-2 border-b border-white/5 last:border-0 last:pb-0">
                <a 
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white/70 hover:text-white line-clamp-1 underline underline-offset-2"
                >
                  {source.title}
                </a>
                {source.publisher && (
                  <p className="text-white/30 mt-0.5">
                    {source.publisher} {source.date && `• ${source.date}`}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ERROR BANNER - Inline error with retry
// ═══════════════════════════════════════════════════════════════

function ErrorBanner({
  message,
  onRetry,
  onFallback,
  showFallback = false,
}: {
  message: string;
  onRetry: () => void;
  onFallback?: () => void;
  showFallback?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-4 mb-4 p-3 rounded-xl flex items-start gap-3"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
    >
      <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-xs text-red-300">{message}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onRetry}
            className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Erneut versuchen
          </button>
          {showFallback && onFallback && (
            <button
              onClick={onFallback}
              className="px-2.5 py-1 rounded-lg text-[10px] text-white/50 hover:text-white/70 transition-colors"
            >
              Cache nutzen
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DAILY BRIEFING COMPONENT
// ═══════════════════════════════════════════════════════════════

export function DailyBriefing({
  briefing,
  loading,
  onRefresh,
  onOpenCall,
  onOpenContact,
  stats,
}: DailyBriefingProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingMode, setPendingMode] = useState<'cached' | 'realtime'>(briefing?.mode || 'cached');
  const [highlightedPriority, setHighlightedPriority] = useState<number | null>(null);
  const [geminiEnabled, setGeminiEnabled] = useState<boolean | null>(null);
  const [geminiModel, setGeminiModel] = useState<string | null>(null);
  const prioritiesRef = useRef<HTMLDivElement>(null);

  // Fetch Gemini status on mount
  useEffect(() => {
    const fetchGeminiStatus = async () => {
      try {
        const response = await fetch('/api/ai/status', { credentials: 'include' });
        if (response.ok) {
          const data = await response.json();
          setGeminiEnabled(data.geminiEnabled);
          setGeminiModel(data.geminiModel);
        }
      } catch (err) {
        // Fallback to meta.geminiEnabled from briefing if status call fails
        console.warn('[DailyBriefing] Failed to fetch Gemini status, using fallback');
      }
    };
    fetchGeminiStatus();
  }, []);

  // Sync pending mode with briefing mode when briefing updates
  useEffect(() => {
    if (briefing?.mode) {
      setPendingMode(briefing.mode);
    }
  }, [briefing?.mode]);

  const handleRefresh = async (mode: 'cached' | 'realtime' = pendingMode, force = true) => {
    setRefreshing(true);
    setError(null);
    try {
      await onRefresh?.(mode, force);
    } catch (e: any) {
      setError(e?.message || 'Briefing konnte nicht aktualisiert werden. Prüfe Verbindung und versuche es erneut.');
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };

  const handleFallbackToCache = () => {
    setPendingMode('cached');
    handleRefresh('cached', true);
  };

  const handleStartMission = useCallback(() => {
    // Scroll to priorities section
    if (prioritiesRef.current) {
      prioritiesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      
      // Highlight first priority for 1.2s
      setHighlightedPriority(0);
      setTimeout(() => setHighlightedPriority(null), 1200);
      
      // Focus first priority for a11y
      const firstButton = prioritiesRef.current.querySelector('button');
      if (firstButton) {
        setTimeout(() => firstButton.focus(), 300);
      }
    }
  }, []);

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (!briefing) return null;

  const hasPriorities = briefing.topPriorities.length > 0;
  const hasQuickWins = briefing.quickWins.length > 0;
  const hasRiskFlags = briefing.riskFlags.length > 0;

  return (
    <div className="space-y-4">
      {/* Mission Hero */}
      <MissionHero 
        briefing={briefing} 
        onStartMission={handleStartMission} 
        onRefresh={() => handleRefresh(pendingMode, true)}
        refreshing={refreshing}
        stats={stats} 
      />

      {/* Briefing Content */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl overflow-hidden"
        style={{
          background: DT.panelBg,
          border: `1px solid ${DT.panelBorder}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header with Mode Toggle + Refresh */}
        <div 
          className="px-5 py-3 flex flex-wrap items-center justify-between gap-3"
          style={{ borderBottom: `1px solid ${DT.panelBorder}` }}
        >
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles size={14} style={{ color: DT.orange }} />
              <h3 className="text-xs font-semibold text-white/70">
                {briefing.headline}
              </h3>
            </div>
            
            {/* Sources - only if real sources exist */}
            <SourcesDisplay sources={briefing.sources} />
          </div>
          
          <div className="flex items-center gap-2">
            {/* Mode Toggle */}
            <ModeToggle
              currentMode={briefing.mode || 'cached'}
              pendingMode={pendingMode}
              onModeChange={(mode) => {
                setPendingMode(mode);
              }}
              geminiEnabled={geminiEnabled ?? briefing?.meta?.geminiEnabled ?? false}
            />
            
            {/* Refresh Button */}
            <button
              onClick={() => handleRefresh(pendingMode, true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg transition-all hover:bg-white/10 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-white/20"
              aria-label="Briefing aktualisieren"
              title={`Aktualisieren (${pendingMode === 'realtime' ? 'Realtime' : 'Cache'})`}
            >
              <RefreshCw 
                size={12} 
                className={`text-white/40 ${refreshing ? 'animate-spin' : ''}`} 
              />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => handleRefresh(pendingMode, true)}
            onFallback={handleFallbackToCache}
            showFallback={pendingMode === 'realtime'}
          />
        )}

        {/* Pending Mode Status */}
        {pendingMode !== (briefing.mode || 'cached') && !error && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg text-[10px] text-white/50" style={{ background: 'rgba(255,255,255,0.03)' }}>
            Nächste Aktualisierung: <span className="text-white/70 font-medium">{pendingMode === 'realtime' ? 'ARAS AI Live' : 'Cache'}</span>
          </div>
        )}

        {/* Top Priorities Section */}
        <div ref={prioritiesRef} className="p-4">
          <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-3 flex items-center gap-2">
            <Zap size={10} style={{ color: DT.orange }} />
            Top Prioritäten
          </h4>

          {refreshing ? (
            <PrioritiesSkeleton />
          ) : hasPriorities ? (
            <div className="space-y-2">
              {briefing.topPriorities.slice(0, 5).map((priority, i) => (
                <PriorityItem
                  key={i}
                  priority={priority}
                  index={i}
                  isHighlighted={highlightedPriority === i}
                  onOpenCall={onOpenCall}
                  onOpenContact={onOpenContact}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 px-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <p className="text-xs text-white/50 mb-1">Noch keine Prioritäten</p>
              <p className="text-[10px] text-white/30">
                Führe 1–2 Calls aus oder bearbeite Follow-ups für ein personalisiertes Briefing.
              </p>
            </div>
          )}
        </div>

        {/* Quick Wins Section */}
        {hasQuickWins && (
          <div 
            className="px-4 pb-4"
          >
            <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
              <CheckCircle size={10} className="text-green-500" />
              Quick Wins
            </h4>
            {refreshing ? (
              <QuickWinsSkeleton />
            ) : (
              <div className="flex flex-wrap gap-2">
                {briefing.quickWins.map((win, i) => (
                  <span
                    key={`win-${i}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors hover:bg-green-500/20 cursor-default"
                    style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e' }}
                  >
                    <CheckCircle size={10} />
                    {win}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Risk Flags Section */}
        {hasRiskFlags && (
          <div 
            className="px-4 pb-4"
          >
            <h4 className="text-[10px] uppercase tracking-wider text-white/40 mb-2 flex items-center gap-2">
              <AlertTriangle size={10} className="text-red-500" />
              Risiken
            </h4>
            {refreshing ? (
              <RiskFlagsSkeleton />
            ) : (
              <div className="flex flex-wrap gap-2">
                {briefing.riskFlags.map((flag, i) => (
                  <span
                    key={`risk-${i}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium"
                    style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                  >
                    <AlertTriangle size={10} />
                    {flag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state if no content */}
        {!hasPriorities && !hasQuickWins && !hasRiskFlags && (
          <div className="px-4 pb-4">
            <div className="text-center py-6 px-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <Sparkles size={20} className="mx-auto text-white/20 mb-2" />
              <p className="text-xs text-white/50 mb-1">Briefing wird vorbereitet</p>
              <p className="text-[10px] text-white/30">
                Starte Calls oder importiere Kontakte für personalisierte Insights.
              </p>
            </div>
          </div>
        )}

        {/* Meta Strip - Bottom */}
        <div 
          className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[9px] text-white/30"
          style={{ borderTop: `1px solid ${DT.panelBorder}` }}
        >
          <span>
            Modus: <span className="text-white/50">{briefing.mode === 'realtime' ? 'Realtime' : 'Cache'}</span>
          </span>
          {briefing.expiresAt && (
            <span>
              Gültig bis: <span className="text-white/50">
                {new Date(briefing.expiresAt).toLocaleTimeString('de-AT', { 
                  timeZone: 'Europe/Vienna', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </span>
            </span>
          )}
          {briefing.meta?.fallbackUsed && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-medium" style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24' }}>
              Fallback
            </span>
          )}
          {briefing.meta?.rateLimit?.nextAllowedAt && (
            <span className="text-white/25">
              Nächste Aktualisierung: {new Date(briefing.meta.rateLimit.nextAllowedAt).toLocaleTimeString('de-AT', { 
                timeZone: 'Europe/Vienna', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}

export default DailyBriefing;
