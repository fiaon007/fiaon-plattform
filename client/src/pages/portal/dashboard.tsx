/**
 * ============================================================================
 * ARAS CLIENT PORTAL - Premium Dashboard
 * ============================================================================
 * STEP 2: ARAS Intelligence Analysis (on-demand, cached)
 * STEP 3: Premium Experience (animated gradients, KPI filters, typing)
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient, useMutation, useInfiniteQuery } from '@tanstack/react-query';
import { 
  Building2, User, Mail, MapPin, FileText, Phone, Clock, 
  ChevronRight, X, Play, Pause, Volume2, VolumeX,
  LogOut, RefreshCw, Search, Loader2, Copy, Info,
  MessageSquare, Mic, CheckCircle, XCircle, AlertCircle,
  Sparkles, TrendingUp, Zap, Target, BarChart3,
  FileDown, Activity, ChevronDown, AlertTriangle,
  Link2, HelpCircle, Tag, Gauge,  // STEP 11 + STEP 15 + STEP 16/17
  CheckCircle2, SearchX  // STEP 29B: Empty state icons
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================================================
// TYPES
// ============================================================================

interface PortalBranding {
  mode: 'white_label' | 'co_branded';
  productName: string;
  showPoweredBy: boolean;
  accent: string;
  locationLabel?: string;
  supportLabel?: string;
  supportEmail?: string;
}

interface PortalCopy {
  welcomeTitle: string;
  welcomeSubtitle: string;
  packageExplainer: string;
  signalExplainerShort: string;
  signalExplainerLong: string;
  privacyNoteShort: string;
}

interface PortalInfoHints {
  signalScore: string;
  nextBestAction: string;
  riskFlags: string;
  exportCsv: string;
  pdfReport: string;
  autoAnalyze: string;
  insights: string;
  companyCard: string;
  packageCard: string;
  reviewed: string;
  bulkAnalyze: string;
  // STEP 13: Saved Views hints
  saveView?: string;
  loadView?: string;
  shareView?: string;
  clearFilters?: string;
  tabs?: {
    all: string;
    needsReview: string;
    starred: string;
    highSignal: string;
    failed: string;
  };
  successChance?: string;
  pipeline?: string;
  quotaForecast?: string;
}

// STEP 14: Portal Permission Type (matches server)
type PortalPermission = 
  | 'calls.read'
  | 'calls.write'
  | 'analysis.run'
  | 'export.csv'
  | 'export.pdf'
  | 'audit.read'
  | 'views.manage';

interface PortalSession {
  portalKey: string;
  displayName: string;
  role: string;
  permissions: PortalPermission[];  // STEP 14: Permissions array
  company: {
    name: string;
    ceo: string;
    email: string;
    addressLine: string;
    zipCity: string;
    vatId: string;
  };
  package: {
    includedCalls: number;
    label: string;
    notes: string;
  };
  ui: {
    portalTitle: string;
    tooltipMode: string;
    kpiFocus: string;
    branding: PortalBranding;
    copy: PortalCopy;
    infoHints: PortalInfoHints;
    teamMembers?: string[];
  };
}

interface CallStats {
  totalCalls: number;
  includedCalls: number;
  remainingCalls: number;
  usagePercent: number;
}

interface CallItem {
  id: number;
  startedAt: string;
  durationSec: number | null;
  to: string;
  contactName: string | null;
  status: string;
  outcome: string | null;
  hasTranscript: boolean;
  hasRecording: boolean;
  signalScore?: number | null;
  hasAnalysis?: boolean;
  // STEP 8: Portal metadata
  starred?: boolean;
  reviewedAt?: string;
  note?: string;
  // STEP 11: Outcome tag
  outcomeTag?: 'appointment' | 'callback' | 'follow_up' | 'not_interested' | 'wrong_number' | 'unclear' | null;
  // STEP 16: Success chance
  successChance?: number | null;
  // STEP 26: Owner assignment
  nextActionOwner?: string | null;
}

// ARAS Intelligence Analysis v1
interface AnalysisV1 {
  version: string;
  signalScore: number;
  confidence: number;
  intent: string;
  sentiment: string;
  keyMoments: Array<{ tSec: number; title: string; why: string }>;
  objections: Array<{ type: string; quote?: string; response: string }>;
  nextBestAction: string;
  followUpDraft: string;
  riskFlags: string[];
  generatedAt: string;
  transcriptHash: string;
}

// STEP 9+11+26: Extended tab types (added outcome-based tabs + myQueue)
type TabFilter = 'all' | 'needsReview' | 'starred' | 'highSignal' | 'failed' | 'appointments' | 'callbacks' | 'followUp' | 'myQueue';
type OutcomeTag = 'appointment' | 'callback' | 'follow_up' | 'not_interested' | 'wrong_number' | 'unclear';
type KPIFilter = 'all' | 'connected' | 'completed' | 'high_signal';

// STEP 12: Range type
type RangePreset = '14d' | '30d' | '90d' | 'all' | 'custom';

// STEP 12: Server-side counts response
interface CountsData {
  range: string;
  from: string | null;
  to: string | null;
  counts: {
    all: number;
    needsReview: number;
    starred: number;
    highSignal: number;
    failed: number;
    appointment: number;
    callback: number;
    follow_up: number;
  };
  pipeline?: {
    appointment: number;
    callback: number;
    follow_up: number;
    not_interested: number;
    wrong_number: number;
    unclear: number;
  };
}

const HIGH_SIGNAL_THRESHOLD = 70;

// ============================================================================
// STEP 22B: CSRF Token Helper (Double Submit Cookie)
// ============================================================================

/**
 * Get the CSRF token from the aras_portal_csrf cookie.
 * Returns null if cookie is missing (session error).
 */
function getPortalCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)aras_portal_csrf=([^;]+)/);
  return match ? match[1] : null;
}

/**
 * Portal fetch wrapper that automatically adds CSRF header for state-changing requests.
 * Returns { ok: false, csrfError: true } if CSRF token is missing.
 */
async function portalFetch(
  url: string, 
  options: RequestInit & { method?: string } = {}
): Promise<Response & { csrfError?: boolean }> {
  const method = (options.method || 'GET').toUpperCase();
  const needsCsrf = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);
  
  if (needsCsrf) {
    const csrfToken = getPortalCsrfToken();
    if (!csrfToken) {
      // Return a fake response indicating CSRF error
      return {
        ok: false,
        status: 403,
        csrfError: true,
        json: async () => ({ error: 'CSRF_MISSING' }),
        text: async () => 'CSRF token missing'
      } as Response & { csrfError: boolean };
    }
    
    options.headers = {
      ...options.headers,
      'x-portal-csrf': csrfToken
    };
  }
  
  options.credentials = 'include';
  return fetch(url, options);
}

// ============================================================================
// STEP 13: Saved Views (LocalStorage)
// ============================================================================

interface SavedView {
  id: string;
  name: string;
  createdAt: string;
  state: {
    range: RangePreset;
    from?: string;
    to?: string;
    tab: TabFilter;
    q?: string;
  };
}

const SAVED_VIEWS_KEY = 'portal.savedViews.v1';
const MAX_SAVED_VIEWS = 20;

function generateViewId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getSavedViews(): SavedView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const views = JSON.parse(raw) as SavedView[];
    return Array.isArray(views) ? views.slice(0, MAX_SAVED_VIEWS) : [];
  } catch {
    return [];
  }
}

function saveSavedViews(views: SavedView[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views.slice(0, MAX_SAVED_VIEWS)));
  } catch {
    // Ignore storage errors
  }
}

function sanitizeViewName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 32);
}

// ============================================================================
// STEP 15C: First-login Tour
// ============================================================================

function getTourKey(portalKey: string, username: string): string {
  return `portal.tour.v1:${portalKey}:${username}`;
}

function hasDismissedTour(portalKey: string, username: string): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return localStorage.getItem(getTourKey(portalKey, username)) === 'done';
  } catch {
    return true;
  }
}

function dismissTour(portalKey: string, username: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getTourKey(portalKey, username), 'done');
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// STEP 25: Score Breakdown & Flag Reasons (client-side heuristics)
// ============================================================================

interface ScoreBreakdown {
  outcomeImpact: { value: number; label: string } | null;
  signalImpact: { value: number; label: string } | null;
  sentimentImpact: { value: number; label: string } | null;
  durationImpact: { value: number; label: string } | null;
  explainedScore: number;
}

interface FlagReason {
  key: string;
  label: string;
  severity: 'warning' | 'info';
}

function deriveScoreBreakdown(call: {
  outcomeTag?: string | null;
  signalScore?: number | null;
  sentiment?: string | null;
  durationSec?: number | null;
  reviewedAt?: string | null;
  status?: string | null;
}): ScoreBreakdown {
  let total = 50; // Start at neutral baseline
  
  // Outcome impact
  let outcomeImpact: ScoreBreakdown['outcomeImpact'] = null;
  if (call.outcomeTag) {
    const impacts: Record<string, number> = {
      'appointment': 25,
      'callback': 15,
      'follow_up': 10,
      'not_interested': -25,
      'wrong_number': -40,
      'unclear': -10
    };
    const impact = impacts[call.outcomeTag] ?? 0;
    if (impact !== 0) {
      outcomeImpact = { value: impact, label: call.outcomeTag.replace('_', ' ') };
      total += impact;
    }
  }
  
  // Signal impact (map 0-100 to -10..+10)
  let signalImpact: ScoreBreakdown['signalImpact'] = null;
  if (call.signalScore != null) {
    const impact = Math.round((call.signalScore - 50) / 5); // -10 to +10
    signalImpact = { value: impact, label: `${call.signalScore}%` };
    total += impact;
  }
  
  // Sentiment impact
  let sentimentImpact: ScoreBreakdown['sentimentImpact'] = null;
  if (call.sentiment) {
    const impacts: Record<string, number> = {
      'positive': 8,
      'neutral': 2,
      'mixed': 0,
      'negative': -8
    };
    const impact = impacts[call.sentiment.toLowerCase()] ?? 0;
    sentimentImpact = { value: impact, label: call.sentiment };
    total += impact;
  }
  
  // Duration impact
  let durationImpact: ScoreBreakdown['durationImpact'] = null;
  if (call.durationSec != null) {
    let impact = 0;
    let label = '';
    if (call.durationSec < 30) {
      impact = -8;
      label = '<30s';
    } else if (call.durationSec <= 90) {
      impact = 2;
      label = '30-90s';
    } else if (call.durationSec <= 240) {
      impact = 6;
      label = '90-240s';
    } else {
      impact = 2;
      label = '>240s';
    }
    durationImpact = { value: impact, label };
    total += impact;
  }
  
  return {
    outcomeImpact,
    signalImpact,
    sentimentImpact,
    durationImpact,
    explainedScore: Math.max(0, Math.min(100, total))
  };
}

function deriveFlagReasons(call: {
  durationSec?: number | null;
  sentiment?: string | null;
  outcomeTag?: string | null;
  reviewedAt?: string | null;
  status?: string | null;
}): FlagReason[] {
  const flags: FlagReason[] = [];
  
  if (call.durationSec != null && call.durationSec < 30) {
    flags.push({ key: 'short', label: 'Kurzgespräch', severity: 'warning' });
  }
  if (call.sentiment?.toLowerCase() === 'negative') {
    flags.push({ key: 'negative', label: 'Negatives Sentiment', severity: 'warning' });
  }
  if (!call.outcomeTag) {
    flags.push({ key: 'no_outcome', label: 'Kein Outcome Tag', severity: 'info' });
  }
  if (!call.reviewedAt) {
    flags.push({ key: 'needs_review', label: 'Needs Review', severity: 'info' });
  }
  if (call.status?.toLowerCase() === 'failed') {
    flags.push({ key: 'failed', label: 'Failed Call', severity: 'warning' });
  }
  
  return flags;
}

// Insights API response type
interface InsightsData {
  range: string;
  totals: {
    total: number;
    completed: number;
    failed: number;
    initiated: number;
    avgDurationSec: number;
    sentiment: { positive: number; neutral: number; negative: number; mixed: number };
    analyzedCount: number;
    highSignalCount: number;
  };
  series: Array<{ date: string; total: number; completed: number; failed: number; highSignal: number; analyzed: number }>;
}

interface CallDetail {
  id: number;
  overview: {
    startedAt: string;
    updatedAt: string;
    durationSec: number | null;
    to: string;
    contactName: string | null;
    status: string;
    outcome: string | null;
  };
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
  analysis: {
    sentiment: string | null;
    nextStep: string | null;
    purpose: string | null;
  };
  successChance?: number | null;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return '#22c55e';
    case 'failed':
    case 'error':
      return '#ef4444';
    case 'initiated':
    case 'in_progress':
      return '#f59e0b';
    default:
      return '#6b7280';
  }
}

function getStatusIcon(status: string) {
  switch (status?.toLowerCase()) {
    case 'completed':
    case 'done':
      return <CheckCircle className="w-4 h-4" />;
    case 'failed':
    case 'error':
      return <XCircle className="w-4 h-4" />;
    default:
      return <AlertCircle className="w-4 h-4" />;
  }
}

function getSignalColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#FE9100';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function getIntentLabel(intent: string): string {
  const labels: Record<string, string> = {
    info: 'Information',
    appointment: 'Terminwunsch',
    objection: 'Einwand',
    not_interested: 'Kein Interesse',
    follow_up: 'Follow-up',
    unclear: 'Unklar'
  };
  return labels[intent] || intent;
}

function getSentimentLabel(sentiment: string): string {
  const labels: Record<string, string> = {
    positive: 'Positiv',
    neutral: 'Neutral',
    negative: 'Negativ',
    mixed: 'Gemischt'
  };
  return labels[sentiment] || sentiment;
}

// ============================================================================
// PREFERS REDUCED MOTION HOOK (portal-scope)
// ============================================================================

function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);
  
  return prefersReducedMotion;
}

// ============================================================================
// TYPING TEXT COMPONENT (reduced-motion aware)
// ============================================================================

function TypingText({ 
  text, 
  speed = 20, 
  onComplete,
  className = ''
}: { 
  text: string; 
  speed?: number; 
  onComplete?: () => void;
  className?: string;
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const prefersReduced = usePrefersReducedMotion();
  
  useEffect(() => {
    if (prefersReduced) {
      setDisplayedText(text);
      setIsComplete(true);
      onComplete?.();
      return;
    }
    
    let index = 0;
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText(text.slice(0, index + 1));
        index++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, 1000 / speed);
    
    return () => clearInterval(interval);
  }, [text, speed, onComplete]);
  
  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-0.5 h-4 bg-[#FE9100] ml-0.5 animate-pulse" />
      )}
    </span>
  );
}

// ============================================================================
// SIGNAL GAUGE COMPONENT
// ============================================================================

function SignalGauge({ score, size = 'normal' }: { score: number; size?: 'normal' | 'small' }) {
  const dimension = size === 'small' ? 80 : 120;
  const strokeWidth = size === 'small' ? 6 : 8;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  
  return (
    <div className="relative" style={{ width: dimension, height: dimension }}>
      <svg width={dimension} height={dimension} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={getSignalColor(score)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span 
          className="font-bold"
          style={{ 
            fontSize: size === 'small' ? '20px' : '32px',
            color: getSignalColor(score)
          }}
        >
          {score}
        </span>
        <span 
          className="uppercase tracking-[0.16em] text-white/40"
          style={{ fontSize: size === 'small' ? '8px' : '11px' }}
        >
          Signal
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 1600);
    return () => clearTimeout(timer);
  }, [onClose]);
  
  return (
    <div 
      className="fixed bottom-4 right-4 z-[60] px-4 py-3 rounded-[14px] text-sm text-white/90 animate-in slide-in-from-bottom-2 fade-in duration-200"
      style={{
        background: 'rgba(0,0,0,0.85)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)'
      }}
    >
      {message}
    </div>
  );
}

// ============================================================================
// INFO TIP COMPONENT
// ============================================================================

function InfoTip({ content }: { content: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors">
          <Info className="w-3.5 h-3.5 text-white/30" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[320px]">
        <p className="text-sm leading-relaxed">{content}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// ============================================================================
// SPARKLINE COMPONENT (SVG, no lib)
// ============================================================================

function Sparkline({ 
  data, 
  height = 44, 
  className = '' 
}: { 
  data: number[]; 
  height?: number; 
  className?: string;
}) {
  const prefersReduced = usePrefersReducedMotion();
  
  if (!data || data.length < 2) {
    return <div className={className} style={{ height }} />;
  }
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  // Create path points
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = height - ((value - min) / range) * (height - 8) - 4;
    return `${x},${y}`;
  });
  
  const pathD = `M ${points.join(' L ')}`;
  
  return (
    <svg 
      viewBox={`0 0 100 ${height}`} 
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          opacity: 0.6,
          strokeDasharray: prefersReduced ? 'none' : '200',
          strokeDashoffset: prefersReduced ? '0' : '200',
          animation: prefersReduced ? 'none' : 'sparklineDraw 1s ease-out forwards'
        }}
      />
      <style>{`
        @keyframes sparklineDraw {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </svg>
  );
}

// ============================================================================
// STEP 19C: TYPEWRITER HOOK (reduced-motion aware)
// ============================================================================

function useTypewriter(text: string, speedMs: number = 16): string {
  const [displayedText, setDisplayedText] = useState('');
  const prefersReduced = usePrefersReducedMotion();
  
  useEffect(() => {
    if (prefersReduced) {
      setDisplayedText(text);
      return;
    }
    
    setDisplayedText('');
    let index = 0;
    const interval = setInterval(() => {
      index++;
      setDisplayedText(text.slice(0, index));
      if (index >= text.length) {
        clearInterval(interval);
      }
    }, speedMs);
    
    return () => clearInterval(interval);
  }, [text, speedMs, prefersReduced]);
  
  return displayedText;
}

// ============================================================================
// AUTO-ANALYZE TOGGLE HELPERS
// ============================================================================

function getAutoAnalyze(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('portal.autoAnalyze') === 'true';
}

function setAutoAnalyze(value: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('portal.autoAnalyze', value ? 'true' : 'false');
}

// ============================================================================
// STEP 19: EXECUTIVE INSIGHTS CARD
// ============================================================================

function ExecutiveInsightsCard({
  countsData,
  insights,
  allCalls,
  onOpenCall,
  hasPermission
}: {
  countsData?: CountsData;
  insights?: InsightsData;
  allCalls: CallItem[];
  onOpenCall: (id: number) => void;
  hasPermission: (perm: PortalPermission) => boolean;
}) {
  const reducedMotion = usePrefersReducedMotion();
  
  // STEP 19A: Calculate funnel data from existing endpoints
  const total = countsData?.counts?.all ?? 0;
  const analyzed = insights?.totals?.total ?? 0;
  const highSignal = countsData?.counts?.highSignal ?? 0;
  const appointments = countsData?.pipeline?.appointment ?? 0;
  const callbacks = countsData?.pipeline?.callback ?? 0;
  const followUps = countsData?.pipeline?.follow_up ?? 0;
  
  // STEP 19B: Build narrative text (German, Sie-Form, ~220 chars)
  const narrativeText = useMemo(() => {
    if (total === 0) return 'Noch keine Gespräche im aktuellen Zeitraum.';
    return `Im aktuellen Zeitraum wurden ${total} Gespräche geführt. ${highSignal} sind High-Signal, daraus entstanden ${appointments} Termine und ${callbacks} Rückrufe. Empfehlung: zuerst 'Needs Review' mit Success ≥ 70% bearbeiten.`;
  }, [total, highSignal, appointments, callbacks]);
  
  const displayedNarrative = useTypewriter(narrativeText, 16);
  
  // STEP 19D: Daily Focus - Top 5 calls (needs review, not failed, high success)
  const dailyFocus = useMemo(() => {
    return allCalls
      .filter(c => !c.reviewedAt && c.status?.toLowerCase() !== 'failed' && c.successChance != null)
      .sort((a, b) => {
        const scoreDiff = (b.successChance ?? 0) - (a.successChance ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      })
      .slice(0, 5);
  }, [allCalls]);
  
  // Funnel steps
  const funnelSteps = [
    { label: 'Total Calls', value: total, color: '#FE9100' },
    { label: 'Analyzed', value: analyzed, color: '#3b82f6' },
    { label: 'High Signal', value: highSignal, color: '#22c55e' },
    { label: 'Appointments', value: appointments, color: '#10b981' },
    { label: 'Callbacks', value: callbacks, color: '#6366f1' },
    { label: 'Follow-ups', value: followUps, color: '#8b5cf6' }
  ];
  
  const maxFunnel = Math.max(...funnelSteps.map(s => s.value), 1);
  
  if (total === 0) return null;
  
  return (
    <div 
      className="p-5 rounded-2xl transition-shadow hover:shadow-[0_0_0_1px_rgba(255,106,0,0.18),0_0_22px_rgba(255,106,0,0.10)]"
      style={{
        background: 'rgba(20,20,20,0.6)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)'
      }}
    >
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp className="w-4 h-4 text-[#FE9100]" />
        <h3 
          className="text-sm font-medium bg-gradient-to-r from-[#E9D7C4] via-[#FE9100] to-white bg-clip-text text-transparent"
        >
          Executive Insights
        </h3>
      </div>
      <p className="text-xs text-white/40 mb-4">Verdichtung der wichtigsten Kennzahlen im aktuellen Zeitraum.</p>
      
      {/* Desktop: 2 columns, Mobile: stacked */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left: Narrative */}
        <div className="space-y-3">
          <div className="text-xs text-white/70 leading-relaxed min-h-[60px]">
            {displayedNarrative.split(/(\d+)/).map((part, i) => {
              if (/^\d+$/.test(part)) {
                return (
                  <span 
                    key={i}
                    className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-full text-xs font-medium"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {part}
                  </span>
                );
              }
              return <span key={i}>{part}</span>;
            })}
            {/* STEP 29D: Typewriter Cursor (hidden when complete or reduced motion) */}
            {displayedNarrative.length < narrativeText.length && (
              <span 
                className="inline-block align-baseline ml-1 w-[2px] h-[10px] bg-[#FE9100] animate-pulse motion-reduce:hidden"
                aria-hidden="true"
              />
            )}
          </div>
          
          {/* Daily Focus Panel */}
          <div className="pt-3 border-t border-white/5">
            <div className="flex items-center gap-1.5 mb-2">
              <Target className="w-3 h-3 text-[#FE9100]" />
              <span className="text-xs font-medium text-white/60">Daily Focus</span>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3 h-3 text-white/20" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[200px]">Priorisiert Needs-Review Gespräche mit hoher Erfolgschance.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {dailyFocus.length > 0 ? (
              <div className="space-y-1.5">
                {dailyFocus.map(call => (
                  <div 
                    key={call.id}
                    className="flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors hover:bg-white/5"
                    onClick={() => onOpenCall(call.id)}
                  >
                    <span 
                      className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ 
                        background: (call.successChance ?? 0) >= 70 ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                        color: (call.successChance ?? 0) >= 70 ? '#22c55e' : '#eab308'
                      }}
                    >
                      {call.successChance}%
                    </span>
                    <span className="text-xs text-white/70 truncate flex-1">
                      {call.contactName || call.to}
                    </span>
                    <ChevronRight className="w-3 h-3 text-white/20" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-white/30 py-2">
                Keine offenen High-Priority Gespräche.
              </div>
            )}
          </div>
        </div>
        
        {/* Right: Funnel */}
        <div className="space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 cursor-help">
                Funnel
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-[200px]">Funnel zeigt den Weg von Gesamtvolumen zu verwertbaren Ergebnissen.</p>
            </TooltipContent>
          </Tooltip>
          
          {funnelSteps.map(({ label, value, color }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-20 text-[10px] text-white/50 truncate">{label}</div>
              <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                <div 
                  className="h-full rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(value / maxFunnel) * 100}%`, 
                    background: color,
                    animation: reducedMotion ? 'none' : undefined
                  }}
                />
              </div>
              <div className="w-8 text-[10px] text-white/60 text-right font-medium">{value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// STEP 30B: QA PANEL (debug gated)
// ============================================================================

interface QaCheckItem {
  id: string;
  label: string;
  checked: boolean;
}

function QaPanel({ 
  isOpen, 
  onClose, 
  portalKey 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  portalKey: string;
}) {
  const [checks, setChecks] = useState<QaCheckItem[]>([
    { id: 'login_wrong', label: '1. Login wrong pw → error', checked: false },
    { id: 'login_ok', label: '2. Login ok → dashboard', checked: false },
    { id: 'session_expired', label: '3. Session expired → login', checked: false },
    { id: 'calls_list', label: '4. Calls list + infinite scroll', checked: false },
    { id: 'drawer', label: '5. Drawer open/close + deep link', checked: false },
    { id: 'audio', label: '6. Audio play via proxy', checked: false },
    { id: 'analyze', label: '7. Analyze single + bulk', checked: false },
    { id: 'write_actions', label: '8. Write actions (note/star/review/outcome)', checked: false },
    { id: 'exports', label: '9. Exports CSV + Report (masked)', checked: false },
    { id: 'audit', label: '10. Audit access (CEO yes / Marketing no)', checked: false },
    { id: 'views', label: '11. Views save/load/share', checked: false },
    { id: 'compact', label: '12. Compact toggle persistence', checked: false },
  ]);
  
  const [apiStatus, setApiStatus] = useState<{ me: 'ok' | 'fail' | 'pending'; counts: 'ok' | 'fail' | 'pending'; calls: 'ok' | 'fail' | 'pending'; health: 'ok' | 'fail' | 'pending' }>({
    me: 'pending',
    counts: 'pending',
    calls: 'pending',
    health: 'pending'
  });
  
  // STEP 32D: Health check status
  const [healthData, setHealthData] = useState<{ ok: boolean; portalConfigOk: boolean; portals: string[] } | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  
  const reducedMotion = usePrefersReducedMotion();
  
  // Live status checks including health endpoint
  useEffect(() => {
    if (!isOpen) return;
    
    const checkApis = async () => {
      // Check /api/portal/health (STEP 32D)
      try {
        const healthRes = await fetch('/api/portal/health', { credentials: 'include' });
        const healthJson = await healthRes.json();
        setHealthData(healthJson);
        setApiStatus(prev => ({ ...prev, health: healthRes.ok && healthJson.ok ? 'ok' : 'fail' }));
      } catch { 
        setApiStatus(prev => ({ ...prev, health: 'fail' })); 
        setHealthData(null);
      }
      
      // Check /api/portal/me
      try {
        const meRes = await fetch(`/api/portal/${portalKey}/me`, { credentials: 'include' });
        setApiStatus(prev => ({ ...prev, me: meRes.ok ? 'ok' : 'fail' }));
      } catch { setApiStatus(prev => ({ ...prev, me: 'fail' })); }
      
      // Check /api/portal/calls/counts
      try {
        const countsRes = await fetch(`/api/portal/${portalKey}/calls/counts`, { credentials: 'include' });
        setApiStatus(prev => ({ ...prev, counts: countsRes.ok ? 'ok' : 'fail' }));
      } catch { setApiStatus(prev => ({ ...prev, counts: 'fail' })); }
      
      // Check /api/portal/calls?limit=1
      try {
        const callsRes = await fetch(`/api/portal/${portalKey}/calls?limit=1`, { credentials: 'include' });
        setApiStatus(prev => ({ ...prev, calls: callsRes.ok ? 'ok' : 'fail' }));
      } catch { setApiStatus(prev => ({ ...prev, calls: 'fail' })); }
    };
    
    checkApis();
  }, [isOpen, portalKey]);
  
  const toggleCheck = (id: string) => {
    setChecks(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c));
  };
  
  const completedCount = checks.filter(c => c.checked).length;
  const configOk = healthData?.portalConfigOk ?? false;
  const isReady = configOk && completedCount === checks.length;
  
  const handleCopyNotes = () => {
    const timestamp = new Date().toISOString().split('T')[0];
    const checkedItems = checks.filter(c => c.checked).map(c => `[x] ${c.label}`).join('\n');
    const uncheckedItems = checks.filter(c => !c.checked).map(c => `[ ] ${c.label}`).join('\n');
    const apiStatusText = `API Status: health=${apiStatus.health}, me=${apiStatus.me}, counts=${apiStatus.counts}, calls=${apiStatus.calls}`;
    const notes = `ARAS Portal QA — ${timestamp}\n${apiStatusText}\n\nCompleted:\n${checkedItems || '(none)'}\n\nPending:\n${uncheckedItems || '(none)'}`;
    navigator.clipboard.writeText(notes);
    setCopyToast('QA Notes kopiert');
    setTimeout(() => setCopyToast(null), 2500);
  };
  
  // STEP 32D: Copy Go-Live Summary (dynamic base URL, no secrets)
  const handleCopyGoLiveSummary = () => {
    const baseUrl = window.location.origin;
    const timestamp = new Date().toISOString();
    const summary = `ARAS Portal Go-Live Summary
===========================
Timestamp: ${timestamp}
Status: ${isReady ? 'READY' : 'NOT READY'}

Links:
- Login: ${baseUrl}/portal/${portalKey}/login
- Dashboard: ${baseUrl}/portal/${portalKey}
- Report: ${baseUrl}/portal/${portalKey}/report

Health Check:
- Config OK: ${configOk ? 'YES' : 'NO'}
- Portals: ${healthData?.portals?.join(', ') || 'none'}

QA Progress: ${completedCount}/${checks.length}`;
    navigator.clipboard.writeText(summary);
    setCopyToast('Go-Live Summary kopiert');
    setTimeout(() => setCopyToast(null), 2500);
  };
  
  if (!isOpen) return null;
  
  return (
    <div 
      className={`fixed inset-0 z-50 flex justify-end ${reducedMotion ? '' : 'transition-opacity duration-200'}`}
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      {/* STEP 32D: Toast notification */}
      {copyToast && (
        <div 
          className="fixed bottom-4 right-4 z-[60] px-4 py-2 rounded-xl text-sm font-medium max-w-[320px]"
          style={{ background: 'rgba(34,197,94,0.9)', color: 'white' }}
        >
          {copyToast}
        </div>
      )}
      <div 
        className="w-[420px] max-w-[92vw] h-full max-h-[80vh] my-auto mr-4 rounded-2xl overflow-y-auto"
        style={{ 
          background: 'linear-gradient(180deg, rgba(18,18,18,0.98) 0%, rgba(12,12,12,0.99) 100%)',
          border: '1px solid rgba(255,255,255,0.08)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header with Ready Badge */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[16px] font-semibold text-white" style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}>Release QA</h2>
              {/* STEP 32D: Ready Badge */}
              <span 
                className="px-2.5 text-xs font-semibold flex items-center"
                style={{ 
                  height: '22px', 
                  borderRadius: '999px',
                  background: isReady ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                  color: isReady ? '#22c55e' : '#ef4444',
                  border: isReady ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(239,68,68,0.4)'
                }}
              >
                {isReady ? 'READY' : 'NOT READY'}
              </span>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          </div>
          
          {/* STEP 32D: Config status warning if not ok */}
          {!configOk && healthData && (
            <div className="mb-4 p-3 rounded-xl text-xs" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
              <strong>Portal config missing</strong> — Check /api/portal/health for details.
            </div>
          )}
          
          {/* API Status Pills */}
          <div className="mb-6 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-xs text-white/50 mb-3 font-medium">Live API Status</div>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'health', label: '/health' },
                { key: 'me', label: '/me' },
                { key: 'counts', label: '/counts' },
                { key: 'calls', label: '/calls' }
              ].map(({ key, label }) => (
                <span 
                  key={key}
                  className="px-2 py-1 rounded-lg text-xs font-medium"
                  style={{
                    background: apiStatus[key as keyof typeof apiStatus] === 'ok' ? 'rgba(34,197,94,0.15)' : 
                               apiStatus[key as keyof typeof apiStatus] === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                    color: apiStatus[key as keyof typeof apiStatus] === 'ok' ? '#22c55e' : 
                           apiStatus[key as keyof typeof apiStatus] === 'fail' ? '#ef4444' : 'rgba(255,255,255,0.5)'
                  }}
                >
                  {label}: {apiStatus[key as keyof typeof apiStatus].toUpperCase()}
                </span>
              ))}
            </div>
          </div>
          
          {/* Progress */}
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-white/50">Progress</span>
              <span className="text-white font-medium">{completedCount} / {checks.length}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div 
                className="h-full rounded-full transition-all duration-300"
                style={{ 
                  width: `${(completedCount / checks.length) * 100}%`,
                  background: completedCount === checks.length ? '#22c55e' : '#FE9100'
                }}
              />
            </div>
          </div>
          
          {/* Checklist */}
          <div className="space-y-2 mb-6">
            {checks.map(check => (
              <button
                key={check.id}
                onClick={() => toggleCheck(check.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors hover:bg-white/5"
                style={{ background: check.checked ? 'rgba(34,197,94,0.08)' : 'transparent' }}
              >
                <div 
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-colors"
                  style={{ 
                    background: check.checked ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.08)',
                    border: check.checked ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.15)'
                  }}
                >
                  {check.checked && <CheckCircle className="w-3 h-3 text-green-400" />}
                </div>
                <span className={`text-sm ${check.checked ? 'text-white/60 line-through' : 'text-white/80'}`}>
                  {check.label}
                </span>
              </button>
            ))}
          </div>
          
          {/* Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleCopyNotes}
              className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy QA Notes
            </button>
            
            {/* STEP 32D: Go-Live Summary Button */}
            <button
              onClick={handleCopyGoLiveSummary}
              className="w-full h-10 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              style={{
                background: isReady ? 'rgba(34,197,94,0.2)' : 'rgba(254,145,0,0.2)',
                border: isReady ? '1px solid rgba(34,197,94,0.4)' : '1px solid rgba(254,145,0,0.4)',
                color: isReady ? '#22c55e' : '#FE9100'
              }}
            >
              <CheckCircle className="w-4 h-4" />
              Copy Go-Live Summary
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// CALL DETAIL DRAWER
// ============================================================================

function CallDetailDrawer({ 
  callId, 
  onClose,
  portalKey,
  onAnalysisComplete,
  session,
  onCsrfError,
  // STEP 24C: Queue navigation props
  queueIndex,
  queueTotal,
  onPrevious,
  onNext,
  // STEP 24D: Keyboard action handlers
  onKeyboardAction
}: { 
  callId: number; 
  onClose: () => void;
  portalKey: string;
  onAnalysisComplete?: () => void;
  session?: PortalSession;
  onCsrfError?: () => void;
  // STEP 24C: Queue navigation
  queueIndex?: number;
  queueTotal?: number;
  onPrevious?: () => void;
  onNext?: () => void;
  // STEP 24D: Keyboard action callback (for toasts)
  onKeyboardAction?: (action: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hasAnimatedAnalysis, setHasAnimatedAnalysis] = useState(false);
  const [autoAnalyzeEnabled, setAutoAnalyzeEnabled] = useState(getAutoAnalyze);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  // STEP 8: Review Panel state
  const [noteValue, setNoteValue] = useState('');
  const [starred, setStarred] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle');
  const noteDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const reducedMotion = usePrefersReducedMotion();
  
  // STEP 11: Outcome tag state
  const [outcomeTag, setOutcomeTag] = useState<OutcomeTag | null>(null);
  
  // STEP 26: Owner assignment state
  const [owner, setOwner] = useState<string | null>(null);
  
  // Fetch call details
  const { data: call, isLoading, refetch: refetchCall } = useQuery<CallDetail>({
    queryKey: ['portal-call', callId],
    queryFn: async () => {
      const res = await fetch(`/api/portal/calls/${callId}`, {
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to fetch call');
      return res.json();
    }
  });
  
  // STEP 8+11+26: Initialize review state from call metadata
  useEffect(() => {
    if (call) {
      const portal = (call as any).portal || {};
      setNoteValue(portal.note || '');
      setStarred(!!portal.starred);
      setReviewed(!!portal.reviewedAt);
      setOutcomeTag(portal.outcomeTag || null);
      setOwner(portal.nextActionOwner || null);
    }
  }, [call]);
  
  // STEP 8: Save metadata helper
  const saveMetadata = useCallback(async (updates: { starred?: boolean; reviewed?: boolean; note?: string }) => {
    setSaveState('saving');
    try {
      const res = await portalFetch(`/api/portal/calls/${callId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      // STEP 22B: Handle CSRF error
      if ((res as any).csrfError) {
        onCsrfError?.();
        return;
      }
      if (!res.ok) throw new Error('Save failed');
      setSaveState('idle');
      // Invalidate calls list to reflect changes
      queryClient.invalidateQueries({ queryKey: ['portal-calls'] });
    } catch {
      setSaveState('error');
    }
  }, [callId, queryClient, onCsrfError]);
  
  // STEP 8: Debounced note save
  const handleNoteChange = useCallback((value: string) => {
    setNoteValue(value);
    if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current);
    noteDebounceRef.current = setTimeout(() => {
      saveMetadata({ note: value });
    }, 600);
  }, [saveMetadata]);
  
  // STEP 8: Toggle handlers
  const handleStarToggle = useCallback(() => {
    const newVal = !starred;
    setStarred(newVal);
    saveMetadata({ starred: newVal });
  }, [starred, saveMetadata]);
  
  const handleReviewedToggle = useCallback(() => {
    const newVal = !reviewed;
    setReviewed(newVal);
    saveMetadata({ reviewed: newVal });
  }, [reviewed, saveMetadata]);
  
  // STEP 11: Outcome tag change handler
  const handleOutcomeTagChange = useCallback(async (tag: OutcomeTag) => {
    const newTag = outcomeTag === tag ? null : tag; // Toggle off if same
    setOutcomeTag(newTag as OutcomeTag | null);
    setSaveState('saving');
    try {
      const res = await portalFetch(`/api/portal/calls/${callId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcomeTag: newTag || '' })
      });
      // STEP 22B: Handle CSRF error
      if ((res as any).csrfError) {
        onCsrfError?.();
        return;
      }
      if (!res.ok) throw new Error('Failed to save');
      setSaveState('idle');
      queryClient.invalidateQueries({ queryKey: ['portal-calls'] });
    } catch {
      setSaveState('error');
    }
  }, [callId, outcomeTag, queryClient, onCsrfError]);
  
  // STEP 11: Copy share link handler
  const handleCopyShareLink = useCallback(() => {
    const url = `${window.location.origin}/portal/${portalKey}/calls/${callId}`;
    navigator.clipboard.writeText(url);
    setToast('Share link copied');
  }, [portalKey, callId]);
  
  // STEP 26: Owner change handler
  const handleOwnerChange = useCallback(async (newOwner: string | null) => {
    setOwner(newOwner);
    setSaveState('saving');
    try {
      const res = await portalFetch(`/api/portal/calls/${callId}/metadata`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nextActionOwner: newOwner || '' })
      });
      if ((res as any).csrfError) {
        onCsrfError?.();
        return;
      }
      if (!res.ok) throw new Error('Failed to save');
      setSaveState('idle');
      setToast('Zuständigkeit gespeichert');
      queryClient.invalidateQueries({ queryKey: ['portal-calls'] });
    } catch {
      setSaveState('error');
    }
  }, [callId, queryClient, onCsrfError]);
  
  // STEP 24D: Keyboard shortcuts listener
  useEffect(() => {
    const outcomeTagMap: Record<string, OutcomeTag> = {
      '1': 'appointment',
      '2': 'callback',
      '3': 'follow_up',
      '4': 'not_interested',
      '5': 'wrong_number',
      '6': 'unclear'
    };
    const outcomeLabels: Record<OutcomeTag, string> = {
      'appointment': 'Appointment',
      'callback': 'Callback',
      'follow_up': 'Follow-up',
      'not_interested': 'Not Interested',
      'wrong_number': 'Wrong Number',
      'unclear': 'Unclear'
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focus is in input/textarea
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      
      switch (e.key.toLowerCase()) {
        case 'j': // Next
          e.preventDefault();
          onNext?.();
          break;
        case 'k': // Previous
          e.preventDefault();
          onPrevious?.();
          break;
        case 's': // Star toggle
          e.preventDefault();
          handleStarToggle();
          onKeyboardAction?.(starred ? 'Unstarred' : 'Starred');
          break;
        case 'r': // Reviewed toggle
          e.preventDefault();
          handleReviewedToggle();
          onKeyboardAction?.(reviewed ? 'Unreviewed' : 'Reviewed');
          break;
        case 'escape':
          e.preventDefault();
          onClose();
          break;
        default:
          // 1-6 for outcome tags
          if (outcomeTagMap[e.key]) {
            e.preventDefault();
            const tag = outcomeTagMap[e.key];
            handleOutcomeTagChange(tag);
            onKeyboardAction?.(`Outcome: ${outcomeLabels[tag]}`);
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onPrevious, onClose, handleStarToggle, handleReviewedToggle, handleOutcomeTagChange, onKeyboardAction, starred, reviewed]);
  
  // Fetch cached analysis
  const { data: analysisData, refetch: refetchAnalysis } = useQuery<{ analysis: AnalysisV1; cached: boolean }>({
    queryKey: ['portal-analysis', callId],
    queryFn: async () => {
      const res = await fetch(`/api/portal/calls/${callId}/analysis`, {
        credentials: 'include'
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!call
  });
  
  // Analyze mutation (STEP 22B: with CSRF, STEP 22D: 429 handling)
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await portalFetch(`/api/portal/calls/${callId}/analyze`, {
        method: 'POST'
      });
      // STEP 22B: Handle CSRF error
      if ((res as any).csrfError) {
        onCsrfError?.();
        throw new Error('Session error');
      }
      // STEP 22D: Handle rate limit
      if (res.status === 429) {
        throw new Error('RATE_LIMITED');
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Analysis failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['portal-analysis', callId], data);
      setHasAnimatedAnalysis(false); // Enable typing animation for new analysis
      onAnalysisComplete?.();
    },
    onError: (error: Error) => {
      // STEP 22D: Show generic rate-limit toast (no info leaks)
      if (error.message === 'RATE_LIMITED') {
        setToast('Zu viele Anfragen. Bitte kurz warten.');
      }
    }
  });
  
  const analysis = analysisData?.analysis;
  
  // Auto-analyze on open (if enabled and no cached analysis)
  useEffect(() => {
    if (autoAnalyzeEnabled && call && !analysis && !analyzeMutation.isPending) {
      analyzeMutation.mutate();
    }
  }, [autoAnalyzeEnabled, call, analysis, analyzeMutation]);
  
  // Toggle auto-analyze (persist to localStorage)
  const handleToggleAutoAnalyze = useCallback(() => {
    const newValue = !autoAnalyzeEnabled;
    setAutoAnalyzeEnabled(newValue);
    setAutoAnalyze(newValue);
  }, [autoAnalyzeEnabled]);
  
  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);
  
  // Audio controls
  const togglePlay = useCallback(() => {
    if (!audioRef) return;
    if (isPlaying) {
      audioRef.pause();
    } else {
      audioRef.play();
    }
    setIsPlaying(!isPlaying);
  }, [audioRef, isPlaying]);
  
  const toggleMute = useCallback(() => {
    if (!audioRef) return;
    audioRef.muted = !isMuted;
    setIsMuted(!isMuted);
  }, [audioRef, isMuted]);
  
  // Copy to clipboard
  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setToast(`${label} kopiert`);
  }, []);
  
  // Scroll to key moment position in transcript
  const scrollToMoment = useCallback((tSec: number) => {
    if (!transcriptRef.current || !call?.transcript) return;
    const container = transcriptRef.current;
    const totalDuration = call.overview.durationSec || 1;
    const scrollRatio = tSec / totalDuration;
    const scrollPosition = container.scrollHeight * scrollRatio;
    container.scrollTo({ top: scrollPosition, behavior: 'smooth' });
  }, [call]);
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="fixed top-0 right-0 h-full w-full md:w-[600px] z-50 overflow-y-auto"
        style={{
          background: 'rgba(15,15,15,0.98)',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)'
        }}
      >
        {/* Header */}
        <div 
          className="sticky top-0 flex items-center justify-between p-4 border-b border-white/5 backdrop-blur-xl"
          style={{ background: 'rgba(15,15,15,0.9)' }}
        >
          <div className="flex items-center gap-3">
            {/* STEP 24C: Queue Navigation */}
            {queueTotal !== undefined && queueTotal > 0 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={onPrevious}
                  disabled={queueIndex === 0}
                  className="h-9 px-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous call (K)"
                >
                  ← Prev
                </button>
                <span className="px-2 text-xs text-white/40">
                  {(queueIndex ?? 0) + 1} / {queueTotal}
                </span>
                <button
                  onClick={onNext}
                  disabled={queueIndex === queueTotal - 1}
                  className="h-9 px-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Next call (J)"
                >
                  Next →
                </button>
              </div>
            )}
            <h2 className="font-orbitron text-lg font-semibold text-white">
              Call Details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Close (ESC)"
          >
            <X className="w-5 h-5 text-white/60" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-[#FE9100] animate-spin" />
            </div>
          ) : call ? (
            <>
              {/* Overview */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                  Overview
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-white/40 mb-1">Contact</div>
                    <div className="text-white font-medium">
                      {call.overview.contactName || call.overview.to}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-white/40 mb-1">Duration</div>
                    <div className="text-white font-medium">
                      {formatDuration(call.overview.durationSec)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-white/40 mb-1">Date</div>
                    <div className="text-white font-medium text-sm">
                      {formatDate(call.overview.startedAt)}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5">
                    <div className="text-xs text-white/40 mb-1">Status</div>
                    <div 
                      className="flex items-center gap-2 font-medium"
                      style={{ color: getStatusColor(call.overview.status) }}
                    >
                      {getStatusIcon(call.overview.status)}
                      <span className="capitalize">{call.overview.status}</span>
                    </div>
                  </div>
                  {call.successChance != null && (
                    <div className="p-4 rounded-xl bg-white/5">
                      <div className="text-xs text-white/40 mb-1">Success</div>
                      <div 
                        className="flex items-center gap-2 font-bold"
                        style={{ 
                          color: call.successChance >= 70 ? '#22c55e' : call.successChance >= 40 ? '#eab308' : '#ef4444'
                        }}
                      >
                        <Gauge className="w-4 h-4" />
                        {call.successChance}%
                      </div>
                    </div>
                  )}
                </div>
                
                {/* STEP 25A: Score Breakdown Card */}
                {(() => {
                  const breakdown = deriveScoreBreakdown({
                    outcomeTag: outcomeTag,
                    signalScore: analysis?.signalScore,
                    sentiment: analysis?.sentiment,
                    durationSec: call.overview.durationSec,
                    reviewedAt: reviewed ? 'yes' : null,
                    status: call.overview.status
                  });
                  const flags = deriveFlagReasons({
                    durationSec: call.overview.durationSec,
                    sentiment: analysis?.sentiment,
                    outcomeTag: outcomeTag,
                    reviewedAt: reviewed ? 'yes' : null,
                    status: call.overview.status
                  });
                  const hasFactors = breakdown.outcomeImpact || breakdown.signalImpact || breakdown.sentimentImpact || breakdown.durationImpact;
                  
                  if (!hasFactors && flags.length === 0) return null;
                  
                  return (
                    <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h4 className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1 cursor-help">
                            Score Breakdown
                            <Info className="w-3 h-3" />
                          </h4>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[280px]">
                          <p className="text-xs">Erklärung basiert auf Portal-Daten. Kein Ersatz für manuelle Prüfung.</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <div className="space-y-2">
                        {breakdown.outcomeImpact && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Outcome Tag</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${Math.abs(breakdown.outcomeImpact.value) * 2}%`,
                                    background: breakdown.outcomeImpact.value >= 0 ? '#22c55e' : '#ef4444'
                                  }}
                                />
                              </div>
                              <span className={breakdown.outcomeImpact.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {breakdown.outcomeImpact.value > 0 ? '+' : ''}{breakdown.outcomeImpact.value}
                              </span>
                            </div>
                          </div>
                        )}
                        {breakdown.signalImpact && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Signal Score</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${Math.abs(breakdown.signalImpact.value) * 5}%`,
                                    background: breakdown.signalImpact.value >= 0 ? '#22c55e' : '#ef4444'
                                  }}
                                />
                              </div>
                              <span className={breakdown.signalImpact.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {breakdown.signalImpact.value > 0 ? '+' : ''}{breakdown.signalImpact.value}
                              </span>
                            </div>
                          </div>
                        )}
                        {breakdown.sentimentImpact && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Sentiment</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${Math.abs(breakdown.sentimentImpact.value) * 6}%`,
                                    background: breakdown.sentimentImpact.value >= 0 ? '#22c55e' : '#ef4444'
                                  }}
                                />
                              </div>
                              <span className={breakdown.sentimentImpact.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {breakdown.sentimentImpact.value > 0 ? '+' : ''}{breakdown.sentimentImpact.value}
                              </span>
                            </div>
                          </div>
                        )}
                        {breakdown.durationImpact && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-white/50">Duration ({breakdown.durationImpact.label})</span>
                            <div className="flex items-center gap-2">
                              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                <div 
                                  className="h-full rounded-full"
                                  style={{ 
                                    width: `${Math.abs(breakdown.durationImpact.value) * 6}%`,
                                    background: breakdown.durationImpact.value >= 0 ? '#22c55e' : '#ef4444'
                                  }}
                                />
                              </div>
                              <span className={breakdown.durationImpact.value >= 0 ? 'text-green-400' : 'text-red-400'}>
                                {breakdown.durationImpact.value > 0 ? '+' : ''}{breakdown.durationImpact.value}
                              </span>
                            </div>
                          </div>
                        )}
                        
                        {/* Explained Score Sum */}
                        {hasFactors && (
                          <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-white/5">
                            <span className="text-white/60 font-medium">Explained Score</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/10 text-white/70">
                              {breakdown.explainedScore}% (informativ)
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* STEP 25C: Flag Reasons */}
                      {flags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-white/5">
                          {flags.map(flag => (
                            <span 
                              key={flag.key}
                              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                              style={{
                                background: flag.severity === 'warning' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)',
                                border: flag.severity === 'warning' ? '1px solid rgba(239,68,68,0.2)' : '1px solid rgba(255,255,255,0.08)',
                                color: flag.severity === 'warning' ? '#fca5a5' : 'rgba(255,255,255,0.5)'
                              }}
                            >
                              {flag.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              
              {/* Recording Player */}
              {call.recordingUrl && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                    Recording
                  </h3>
                  <div 
                    className="flex items-center gap-4 p-4 rounded-xl"
                    style={{ background: 'rgba(254,145,0,0.1)', border: '1px solid rgba(254,145,0,0.2)' }}
                  >
                    <button
                      onClick={togglePlay}
                      className="w-12 h-12 flex items-center justify-center rounded-full bg-[#FE9100] text-white transition-transform hover:scale-105"
                    >
                      {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm text-white/80">Audio Recording</div>
                      <div className="text-xs text-white/40">
                        {formatDuration(call.overview.durationSec)}
                      </div>
                    </div>
                    <button
                      onClick={toggleMute}
                      className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {isMuted ? (
                        <VolumeX className="w-5 h-5 text-white/40" />
                      ) : (
                        <Volume2 className="w-5 h-5 text-white/60" />
                      )}
                    </button>
                    <audio
                      ref={setAudioRef}
                      src={call.recordingUrl}
                      onEnded={() => setIsPlaying(false)}
                      preload="metadata"
                    />
                  </div>
                </div>
              )}
              
              {/* Summary */}
              {call.summary && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                    Summary
                  </h3>
                  <div className="p-4 rounded-xl bg-white/5 text-white/80 text-sm leading-relaxed">
                    {call.summary}
                  </div>
                </div>
              )}
              
              {/* Transcript */}
              {call.transcript && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                    Transcript
                  </h3>
                  <div 
                    ref={transcriptRef}
                    className="p-4 rounded-[14px] bg-white/5 text-white/70 text-sm leading-[1.65] max-h-[320px] overflow-y-auto"
                    style={{ whiteSpace: 'pre-wrap' }}
                  >
                    {call.transcript}
                  </div>
                </div>
              )}
              
              {/* ARAS Intelligence Analysis */}
              <div 
                className="p-4 rounded-2xl space-y-4"
                style={{
                  background: 'rgba(20,20,20,0.8)',
                  border: '1px solid rgba(255,255,255,0.08)'
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-orbitron text-sm font-semibold uppercase tracking-[0.08em] text-white">
                    ARAS Intelligence
                  </h3>
                  <InfoTip content="Automatische Analyse des Gesprächsverlaufs mit Signal Score, Einwänden und nächsten Schritten." />
                </div>
                
                {/* Analysis States */}
                {analyzeMutation.isPending ? (
                  // Loading state
                  <div className="py-8 text-center">
                    <div className="inline-flex items-center gap-3">
                      <Loader2 className="w-5 h-5 text-[#FE9100] animate-spin" />
                      <span className="text-white/60 text-sm">Analyse wird erstellt...</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="h-3 bg-white/5 rounded animate-pulse" />
                      <div className="h-3 bg-white/5 rounded animate-pulse w-4/5" />
                      <div className="h-3 bg-white/5 rounded animate-pulse w-3/5" />
                    </div>
                  </div>
                ) : analyzeMutation.isError ? (
                  // Error state
                  <div className="py-6 text-center">
                    <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
                    <p className="text-white/60 text-sm mb-4">{analyzeMutation.error?.message || 'Analyse fehlgeschlagen'}</p>
                    <button
                      onClick={() => analyzeMutation.mutate()}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-white/10 hover:bg-white/15 transition-colors"
                    >
                      Nochmal versuchen
                    </button>
                  </div>
                ) : analysis ? (
                  // Analysis result
                  <div className="space-y-5">
                    {/* Top row: Signal + Chips */}
                    <div className="flex items-start gap-6">
                      <SignalGauge score={analysis.signalScore} />
                      <div className="flex-1 space-y-3">
                        {/* Intent & Sentiment badges */}
                        <div className="flex flex-wrap gap-2">
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100' }}
                          >
                            {getIntentLabel(analysis.intent)}
                          </span>
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-medium"
                            style={{ 
                              background: analysis.sentiment === 'positive' ? 'rgba(34,197,94,0.15)' : 
                                         analysis.sentiment === 'negative' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.1)',
                              color: analysis.sentiment === 'positive' ? '#22c55e' : 
                                     analysis.sentiment === 'negative' ? '#ef4444' : 'rgba(255,255,255,0.7)'
                            }}
                          >
                            {getSentimentLabel(analysis.sentiment)}
                          </span>
                          <span 
                            className="px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}
                          >
                            {Math.round(analysis.confidence * 100)}% Confidence
                          </span>
                        </div>
                        
                        {/* Risk flags */}
                        {analysis.riskFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {analysis.riskFlags.map((flag, i) => (
                              <span 
                                key={i}
                                className="px-2 py-0.5 rounded text-xs"
                                style={{ background: 'rgba(239,68,68,0.1)', color: '#fca5a5' }}
                              >
                                ⚠ {flag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Next Best Action */}
                    <div className="p-3 rounded-xl bg-[#FE9100]/10 border border-[#FE9100]/20">
                      <div className="flex items-start gap-2">
                        <Target className="w-4 h-4 text-[#FE9100] mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-xs text-[#FE9100] font-medium mb-1">Nächster Schritt</div>
                          <div className="text-sm text-white/90">
                            {!hasAnimatedAnalysis && !analysisData?.cached ? (
                              <TypingText 
                                text={analysis.nextBestAction} 
                                onComplete={() => setHasAnimatedAnalysis(true)}
                              />
                            ) : (
                              analysis.nextBestAction
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Key Moments */}
                    {analysis.keyMoments.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-white/40 uppercase tracking-wider">Key Moments</div>
                        <div className="space-y-2">
                          {analysis.keyMoments.map((moment, i) => (
                            <button
                              key={i}
                              onClick={() => scrollToMoment(moment.tSec)}
                              className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-[#FE9100] font-mono">
                                  {formatDuration(moment.tSec)}
                                </span>
                                <span className="text-sm text-white/90 font-medium">
                                  {moment.title}
                                </span>
                              </div>
                              <p className="text-xs text-white/50">{moment.why}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Objections */}
                    {analysis.objections.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs text-white/40 uppercase tracking-wider">Einwände & Antworten</div>
                        <div className="space-y-2">
                          {analysis.objections.map((obj, i) => (
                            <div key={i} className="p-3 rounded-xl bg-white/5">
                              <div className="text-xs text-red-400 font-medium mb-1">{obj.type}</div>
                              {obj.quote && (
                                <p className="text-xs text-white/50 italic mb-2">"{obj.quote}"</p>
                              )}
                              <p className="text-sm text-white/80">{obj.response}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Follow-up Draft */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-white/40 uppercase tracking-wider">Follow-up Vorlage</div>
                        <button
                          onClick={() => copyToClipboard(analysis.followUpDraft, 'Follow-up')}
                          className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                          title="Kopieren"
                        >
                          <Copy className="w-4 h-4 text-white/40" />
                        </button>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 text-sm text-white/80 leading-relaxed">
                        {analysis.followUpDraft}
                      </div>
                    </div>
                  </div>
                ) : (
                  // No analysis - show button
                  <div className="py-6 text-center">
                    <Sparkles className="w-8 h-8 text-[#FE9100]/50 mx-auto mb-3" />
                    <p className="text-white/50 text-sm mb-4">
                      Erstelle eine detaillierte Analyse mit Signal Score, Einwänden und nächsten Schritten.
                    </p>
                    <button
                      onClick={() => analyzeMutation.mutate()}
                      disabled={!call.transcript}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        background: 'linear-gradient(135deg, #FE9100 0%, #FF6B00 100%)',
                        boxShadow: '0 4px 20px rgba(254,145,0,0.3)'
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Analyse starten
                      </span>
                    </button>
                    {!call.transcript && (
                      <p className="text-xs text-white/30 mt-2">Transcript erforderlich</p>
                    )}
                  </div>
                )}
              </div>
              
              {/* STEP 8: Review Panel */}
              <div 
                className="p-4 rounded-2xl space-y-4"
                style={{
                  background: 'rgba(20,20,20,0.8)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-white/40 uppercase tracking-wider">
                    Team Review
                  </h3>
                  <div className="flex items-center gap-3">
                    {/* Star Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleStarToggle}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
                        >
                          {starred ? (
                            <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-white/30" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">{starred ? 'Markierung entfernen' : 'Für Follow-up markieren'}</p>
                      </TooltipContent>
                    </Tooltip>
                    
                    {/* Reviewed Toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={handleReviewedToggle}
                          className="flex items-center gap-2 px-3 h-8 rounded-lg text-xs font-medium transition-colors"
                          style={{
                            background: reviewed ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                            color: reviewed ? '#22c55e' : 'rgba(255,255,255,0.5)',
                            border: reviewed ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.08)'
                          }}
                        >
                          {reviewed ? <CheckCircle className="w-3.5 h-3.5" /> : <div className="w-3.5 h-3.5 rounded-full border border-current" />}
                          Reviewed
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[280px]">
                        <p className="text-xs">{session?.ui?.infoHints?.reviewed || 'Markiert den Call als geprüft. Für euer Team-Review.'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
                
                {/* Note Textarea */}
                <div className="space-y-2">
                  <textarea
                    value={noteValue}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    placeholder="Notiz für das Team… (z.B. Einwand, nächster Schritt, Termin)"
                    maxLength={800}
                    className="w-full min-h-[96px] p-3 rounded-xl text-sm text-white/90 placeholder-white/30 resize-none outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      lineHeight: '1.6'
                    }}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <span className={saveState === 'error' ? 'text-red-400' : 'text-white/30'}>
                      {saveState === 'saving' ? (reducedMotion ? 'Saving…' : '● Saving…') : 
                       saveState === 'error' ? '✕ Couldn\'t save' : 
                       '✓ Saved'}
                    </span>
                    <span className="text-white/30">{noteValue.length}/800</span>
                  </div>
                </div>
                
                {/* STEP 11: Outcome Tags */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-white/40 uppercase tracking-wider">Outcome Tag</div>
                  <div className="flex flex-wrap gap-2">
                    {([
                      { key: 'appointment' as OutcomeTag, label: 'Appointment', tooltip: 'Termin fixiert oder klar vereinbart.' },
                      { key: 'callback' as OutcomeTag, label: 'Callback', tooltip: 'Rückruf explizit gewünscht.' },
                      { key: 'follow_up' as OutcomeTag, label: 'Follow-up', tooltip: 'Interesse da, nächster Schritt nötig.' },
                      { key: 'not_interested' as OutcomeTag, label: 'Not Interested', tooltip: 'Kein Interesse signalisiert.' },
                      { key: 'wrong_number' as OutcomeTag, label: 'Wrong Number', tooltip: 'Falsche Nummer oder Person.' },
                      { key: 'unclear' as OutcomeTag, label: 'Unclear', tooltip: 'Ergebnis nicht eindeutig.' }
                    ]).map(tag => {
                      const isActive = outcomeTag === tag.key;
                      return (
                        <Tooltip key={tag.key}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleOutcomeTagChange(tag.key)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              style={{
                                background: isActive ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)',
                                border: isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(255,255,255,0.06)',
                                color: isActive ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
                              }}
                            >
                              {tag.label}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent><p className="text-xs">{tag.tooltip}</p></TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
                
                {/* STEP 26: Owner Assignment */}
                {session?.permissions?.includes('calls.write') && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-white/40 uppercase tracking-wider">Zuständig</div>
                    <select
                      value={owner || ''}
                      onChange={(e) => handleOwnerChange(e.target.value || null)}
                      className="w-full h-9 px-3 rounded-lg text-sm bg-white/5 border border-white/10 text-white/80 outline-none focus:border-[#FE9100]/50 cursor-pointer"
                      style={{ appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'rgba(255,255,255,0.4)\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'2\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px' }}
                    >
                      <option value="">Nicht zugewiesen</option>
                      {session?.displayName && (
                        <option value={session.displayName}>{session.displayName} (ich)</option>
                      )}
                      {session?.ui?.teamMembers?.filter(m => m !== session.displayName).map(member => (
                        <option key={member} value={member}>{member}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* STEP 11: Share / Copy Kit */}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleCopyShareLink}
                        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/8 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Share Link
                      </button>
                    </TooltipTrigger>
                    <TooltipContent><p className="text-xs">Deep-Link zu diesem Call kopieren</p></TooltipContent>
                  </Tooltip>
                  
                  {analysis?.nextBestAction && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(analysis.nextBestAction);
                            setToast('Next Action copied');
                          }}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/8 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Next Action
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Next Best Action kopieren</p></TooltipContent>
                    </Tooltip>
                  )}
                  
                  {analysis?.followUpDraft && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(analysis.followUpDraft);
                            setToast('Follow-up draft copied');
                          }}
                          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 bg-white/5 hover:bg-white/8 transition-colors"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Follow-up
                        </button>
                      </TooltipTrigger>
                      <TooltipContent><p className="text-xs">Follow-up Draft kopieren</p></TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
              
              {/* STEP 23A: Privacy & Handling Section */}
              <details className="group">
                <summary 
                  className="flex items-center justify-between p-4 rounded-2xl cursor-pointer list-none"
                  style={{
                    background: 'rgba(20,20,20,0.6)',
                    border: '1px solid rgba(255,255,255,0.06)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 text-white/40" />
                    <span className="text-sm font-medium text-white/60">Datenschutz & Handling</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/40 transition-transform group-open:rotate-180" />
                </summary>
                <div className="mt-2 p-4 rounded-2xl space-y-2 text-xs text-white/50" style={{ background: 'rgba(20,20,20,0.4)' }}>
                  <p>• Telefonnummern sind im Portal maskiert.</p>
                  <p>• Audio wird über einen sicheren Proxy geladen.</p>
                  <p>• Exports enthalten nur maskierte Daten.</p>
                </div>
              </details>
            </>
          ) : (
            <div className="text-center py-20 text-white/40">
              Call not found
            </div>
          )}
        </div>
      </div>
      
      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </>
  );
}

// ============================================================================
// MAIN DASHBOARD COMPONENT
// ============================================================================

// STEP 12: Parse URL query params (STEP 24: add queue)
function parseUrlQuery(): { range: RangePreset; from: string | null; to: string | null; tab: TabFilter; q: string; queue: boolean } {
  if (typeof window === 'undefined') return { range: '14d', from: null, to: null, tab: 'all', q: '', queue: false };
  const params = new URLSearchParams(window.location.search);
  const range = (params.get('range') as RangePreset) || '14d';
  const from = params.get('from');
  const to = params.get('to');
  const tab = (params.get('tab') as TabFilter) || 'all';
  const q = params.get('q') || '';
  const queue = params.get('queue') === '1';
  return { range: from && to ? 'custom' : range, from, to, tab, q, queue };
}

// STEP 12: Update URL without reload (STEP 24: add queue)
function updateUrlQuery(state: { range: RangePreset; from?: string | null; to?: string | null; tab: TabFilter; q: string; queue?: boolean }) {
  if (typeof window === 'undefined') return;
  const params = new URLSearchParams();
  if (state.range !== '14d') params.set('range', state.range);
  if (state.from) params.set('from', state.from);
  if (state.to) params.set('to', state.to);
  if (state.tab !== 'all') params.set('tab', state.tab);
  if (state.q) params.set('q', state.q);
  if (state.queue) params.set('queue', '1');
  const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
  window.history.replaceState({}, '', newUrl);
}

// ============================================================================
// STEP 28B: Memoized CallsRow Component (Minimal Props, Stable Handlers)
// ============================================================================

interface CallsRowProps {
  id: number;
  createdAt: string;
  contactName: string | null;
  phoneMasked: string;
  status: string;
  durationSec: number | null;
  signalScore: number | null;
  successChance: number | null;
  outcomeTag: string | null;
  starred: boolean;
  reviewedAt: string | null;
  nextActionOwner: string | null;
  hasTranscript: boolean;
  hasRecording: boolean;
  hasAnalysis: boolean;
  isCompact: boolean;
  showOwnerColumn: boolean;
  onOpen: (id: number) => void;
  onPrefetch: (id: number) => void;
}

const CallsRow = memo(function CallsRow({
  id, createdAt, contactName, phoneMasked, status, durationSec,
  signalScore, successChance, outcomeTag, starred, reviewedAt,
  nextActionOwner, hasTranscript, hasRecording, hasAnalysis,
  isCompact, showOwnerColumn, onOpen, onPrefetch
}: CallsRowProps) {
  const cellPadding = isCompact ? 'px-3 py-2' : 'px-4 py-3';
  const rowHeight = isCompact ? '44px' : '52px';
  
  return (
    <tr 
      onClick={() => onOpen(id)}
      onMouseEnter={() => onPrefetch(id)}
      onFocus={() => onPrefetch(id)}
      className="border-b border-white/5 cursor-pointer transition-colors hover:bg-white/[0.04] group motion-reduce:transition-none"
      style={{ height: rowHeight }}
      tabIndex={0}
    >
      <td className={cellPadding}>
        <div className="flex items-center gap-2">
          <div 
            className="w-0.5 h-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity motion-reduce:transition-none"
            style={{ background: '#FE9100' }}
          />
          <div className="text-sm text-white/80">
            {formatDate(createdAt)}
          </div>
        </div>
      </td>
      <td className={cellPadding}>
        <div className="text-sm text-white/80">
          {contactName || phoneMasked}
        </div>
        {contactName && (
          <div className="text-xs text-white/40">{phoneMasked}</div>
        )}
      </td>
      <td className={cellPadding}>
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Clock className="w-3.5 h-3.5" />
          {formatDuration(durationSec)}
        </div>
      </td>
      <td className={cellPadding}>
        <span 
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium"
          style={{
            background: `${getStatusColor(status)}15`,
            color: getStatusColor(status)
          }}
        >
          {getStatusIcon(status)}
          <span className="capitalize">{status}</span>
        </span>
      </td>
      {showOwnerColumn && (
        <td className={cellPadding}>
          {nextActionOwner ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span 
                  className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium cursor-help"
                  style={{ 
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'rgba(255,255,255,0.8)'
                  }}
                >
                  {nextActionOwner}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[320px]">
                <p className="text-sm leading-snug">Zuweisung für interne Abarbeitung. 'My Queue' zeigt nur Ihre Gespräche.</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <span className="text-white/30 text-xs">—</span>
          )}
        </td>
      )}
      <td className={cellPadding}>
        {signalScore != null ? (
          <span 
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold"
            style={{ 
              background: `${getSignalColor(signalScore)}15`,
              color: getSignalColor(signalScore)
            }}
          >
            <BarChart3 className="w-3 h-3" />
            {signalScore}
          </span>
        ) : (
          <Tooltip>
            <TooltipTrigger>
              <span className="text-white/30 text-sm">—</span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Analyse im Call-Detail starten</p>
            </TooltipContent>
          </Tooltip>
        )}
      </td>
      <td className={cellPadding}>
        {successChance != null ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span 
                className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold cursor-help"
                style={{ 
                  background: successChance >= 70 ? 'rgba(34,197,94,0.15)' : successChance >= 40 ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                  color: successChance >= 70 ? '#22c55e' : successChance >= 40 ? '#eab308' : '#ef4444'
                }}
              >
                {successChance}%
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[320px]">
              <p className="text-sm leading-snug">Schätzung basierend auf Signalen, Tags und Verlauf. Empfehlung: kurz manuell prüfen.</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-white/30 text-sm">—</span>
        )}
      </td>
      <td className={cellPadding}>
        <div className="flex items-center gap-1.5">
          {starred && (
            <Tooltip>
              <TooltipTrigger>
                <div 
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: 'rgba(234,179,8,0.1)' }}
                >
                  <svg className="w-3 h-3 text-yellow-400 fill-current" viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Follow-up markiert</p></TooltipContent>
            </Tooltip>
          )}
          {reviewedAt && (
            <Tooltip>
              <TooltipTrigger>
                <div 
                  className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.1)' }}
                >
                  <CheckCircle className="w-3 h-3 text-green-400" />
                </div>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Reviewed</p></TooltipContent>
            </Tooltip>
          )}
          {outcomeTag && (
            <Tooltip>
              <TooltipTrigger>
                <span 
                  className="px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide"
                  style={{ 
                    background: outcomeTag === 'appointment' ? 'rgba(34,197,94,0.15)' :
                               outcomeTag === 'callback' ? 'rgba(59,130,246,0.15)' :
                               outcomeTag === 'follow_up' ? 'rgba(254,145,0,0.15)' :
                               'rgba(255,255,255,0.08)',
                    color: outcomeTag === 'appointment' ? '#22c55e' :
                           outcomeTag === 'callback' ? '#3b82f6' :
                           outcomeTag === 'follow_up' ? '#FE9100' :
                           'rgba(255,255,255,0.5)'
                  }}
                >
                  {outcomeTag === 'appointment' ? 'Appt' :
                   outcomeTag === 'callback' ? 'CB' :
                   outcomeTag === 'follow_up' ? 'F/U' :
                   outcomeTag === 'not_interested' ? 'N/I' :
                   outcomeTag === 'wrong_number' ? 'W/N' :
                   'Unc'}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">
                  {outcomeTag === 'appointment' ? 'Appointment' :
                   outcomeTag === 'callback' ? 'Callback' :
                   outcomeTag === 'follow_up' ? 'Follow-up' :
                   outcomeTag === 'not_interested' ? 'Not Interested' :
                   outcomeTag === 'wrong_number' ? 'Wrong Number' :
                   'Unclear'}
                </p>
              </TooltipContent>
            </Tooltip>
          )}
          {hasTranscript && (
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              title="Transcript"
            >
              <MessageSquare className="w-3 h-3 text-white/40" />
            </div>
          )}
          {hasRecording && (
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.05)' }}
              title="Recording"
            >
              <Mic className="w-3 h-3 text-white/40" />
            </div>
          )}
          {hasAnalysis && (
            <div 
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'rgba(254,145,0,0.1)' }}
              title="Analysis"
            >
              <Sparkles className="w-3 h-3 text-[#FE9100]" />
            </div>
          )}
        </div>
      </td>
      <td className={cellPadding}>
        <ChevronRight className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors motion-reduce:transition-none" />
      </td>
    </tr>
  );
});

// ============================================================================
// STEP 28F: Compact Mode Persistence
// ============================================================================

const COMPACT_MODE_KEY = 'portal.compact.v1';

function getCompactMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(COMPACT_MODE_KEY) === '1';
  } catch {
    return false;
  }
}

function setCompactMode(value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COMPACT_MODE_KEY, value ? '1' : '0');
  } catch {
    // Ignore storage errors
  }
}

export default function PortalDashboard() {
  const { portalKey, callId: urlCallId } = useParams<{ portalKey: string; callId?: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  // STEP 12: Initialize state from URL
  const initialQuery = useMemo(() => parseUrlQuery(), []);
  
  const [selectedCallId, setSelectedCallId] = useState<number | null>(null);
  
  // STEP 20A: Debounced search (rawQ for input, debouncedQ for queries)
  const [rawSearchQuery, setRawSearchQuery] = useState(initialQuery.q);
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(initialQuery.q);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
  // STEP 20A: Debounce effect (200ms)
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setDebouncedSearchQuery(rawSearchQuery);
      }
    }, 200);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [rawSearchQuery]);
  
  // STEP 20C: Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  // STEP 20A: Commit search on Enter
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      setDebouncedSearchQuery(rawSearchQuery);
    }
  }, [rawSearchQuery]);
  
  const [activeFilter, setActiveFilter] = useState<KPIFilter>('all');
  const [showActivityDrawer, setShowActivityDrawer] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  
  // STEP 28F: Compact mode state (persisted)
  const [isCompact, setIsCompact] = useState(() => getCompactMode());
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const handleToggleCompact = useCallback(() => {
    setIsCompact(prev => {
      const next = !prev;
      setCompactMode(next);
      return next;
    });
  }, []);
  
  // STEP 22B: CSRF error handler - redirect to login with message
  const handleCsrfError = useCallback(() => {
    setViewToast('Session-Fehler. Bitte neu einloggen.');
    setLocation(`/portal/${portalKey}/login?session_expired=1`);
  }, [portalKey, setLocation]);
  
  // STEP 12: Range state
  const [rangePreset, setRangePreset] = useState<RangePreset>(initialQuery.range);
  const [customFrom, setCustomFrom] = useState<string>(initialQuery.from || '');
  const [customTo, setCustomTo] = useState<string>(initialQuery.to || '');
  const [showCustomRange, setShowCustomRange] = useState(initialQuery.range === 'custom');
  
  // STEP 12: Sync state to URL
  const [activeTab, setActiveTab] = useState<TabFilter>(initialQuery.tab);
  
  // STEP 24: Queue Mode state (URL-synced)
  const [queueMode, setQueueMode] = useState(initialQuery.queue);
  
  useEffect(() => {
    updateUrlQuery({
      range: rangePreset,
      from: rangePreset === 'custom' ? customFrom : null,
      to: rangePreset === 'custom' ? customTo : null,
      tab: activeTab,
      q: debouncedSearchQuery,
      queue: queueMode
    });
  }, [rangePreset, customFrom, customTo, activeTab, debouncedSearchQuery, queueMode]);
  
  // STEP 11: Deep-link support - open drawer from URL
  useEffect(() => {
    if (urlCallId) {
      const callIdNum = parseInt(urlCallId);
      if (!isNaN(callIdNum)) {
        setSelectedCallId(callIdNum);
      }
    }
  }, [urlCallId]);
  
  // STEP 9: Bulk Analyze state
  const [bulkAnalyzeState, setBulkAnalyzeState] = useState<{
    running: boolean;
    progress: number;
    total: number;
    okCount: number;
    failedCount: number;
    cancelled: boolean;
  } | null>(null);
  const bulkCancelRef = useRef(false);
  
  // STEP 13: Saved Views state
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => getSavedViews());
  const [showSavePopover, setShowSavePopover] = useState(false);
  const [showViewsDropdown, setShowViewsDropdown] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [viewToast, setViewToast] = useState<string | null>(null);
  
  // STEP 15C: First-login Tour state
  const [showTour, setShowTour] = useState(false);
  
  // STEP 13: Save View handler
  const handleSaveView = useCallback(() => {
    const name = sanitizeViewName(newViewName);
    if (!name) return;
    
    const view: SavedView = {
      id: generateViewId(),
      name,
      createdAt: new Date().toISOString(),
      state: {
        range: rangePreset,
        from: rangePreset === 'custom' ? customFrom : undefined,
        to: rangePreset === 'custom' ? customTo : undefined,
        tab: activeTab,
        q: debouncedSearchQuery || undefined
      }
    };
    
    const updated = [view, ...savedViews].slice(0, MAX_SAVED_VIEWS);
    setSavedViews(updated);
    saveSavedViews(updated);
    setNewViewName('');
    setShowSavePopover(false);
    setViewToast('View saved');
  }, [newViewName, rangePreset, customFrom, customTo, activeTab, debouncedSearchQuery, savedViews]);
  
  // STEP 13: Load View handler
  const handleLoadView = useCallback((view: SavedView) => {
    setRangePreset(view.state.range);
    if (view.state.range === 'custom') {
      setCustomFrom(view.state.from || '');
      setCustomTo(view.state.to || '');
      setShowCustomRange(true);
    } else {
      setCustomFrom('');
      setCustomTo('');
      setShowCustomRange(false);
    }
    setActiveTab(view.state.tab);
    setRawSearchQuery(view.state.q || '');
    setDebouncedSearchQuery(view.state.q || '');
    setShowViewsDropdown(false);
    setViewToast(`Loaded "${view.name}"`);
  }, []);
  
  // STEP 13: Delete View handler
  const handleDeleteView = useCallback((viewId: string) => {
    const updated = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updated);
    saveSavedViews(updated);
  }, [savedViews]);
  
  // STEP 13: Share View Link handler
  const handleShareViewLink = useCallback(() => {
    const params = new URLSearchParams();
    if (rangePreset !== '14d') params.set('range', rangePreset);
    if (rangePreset === 'custom' && customFrom) params.set('from', customFrom);
    if (rangePreset === 'custom' && customTo) params.set('to', customTo);
    if (activeTab !== 'all') params.set('tab', activeTab);
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
    const url = params.toString() 
      ? `${window.location.origin}/portal/${portalKey}?${params}`
      : `${window.location.origin}/portal/${portalKey}`;
    navigator.clipboard.writeText(url);
    setViewToast('View link copied');
  }, [portalKey, rangePreset, customFrom, customTo, activeTab, debouncedSearchQuery]);
  
  // STEP 13D: Clear handler (keeps range, clears tab + search)
  const handleClearFilters = useCallback(() => {
    setActiveTab('all');
    setRawSearchQuery('');
    setDebouncedSearchQuery('');
    setViewToast('Filters cleared');
  }, []);
  
  // STEP 21C: Track if we've already redirected for session expiry (prevent loops)
  const hasRedirectedRef = useRef(false);
  
  // Fetch session/config
  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery<PortalSession>({
    queryKey: ['portal-session', portalKey],
    queryFn: async () => {
      const res = await fetch('/api/portal/me', { credentials: 'include' });
      if (res.status === 401) {
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) throw new Error('Failed to fetch session');
      return res.json();
    },
    retry: false
  });
  
  // STEP 21C: Session expiry redirect (once per navigation, no loops)
  useEffect(() => {
    if (sessionError?.message === 'UNAUTHORIZED' && !hasRedirectedRef.current) {
      hasRedirectedRef.current = true;
      // Add session_expired param for login page to show message
      setLocation(`/portal/${portalKey}/login?session_expired=1`);
    }
  }, [sessionError, portalKey, setLocation]);
  
  // STEP 14: Permission check helper
  const hasPermission = useCallback((perm: PortalPermission): boolean => {
    return session?.permissions?.includes(perm) ?? false;
  }, [session?.permissions]);
  
  // STEP 30B: QA Panel debug mode (qa=1 param + CEO role)
  const isQaDebugMode = useMemo(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hasQaParam = urlParams.get('qa') === '1';
    const isCeo = session?.role === 'CEO';
    return hasQaParam && isCeo;
  }, [session?.role]);
  const [showQaPanel, setShowQaPanel] = useState(false);
  
  // STEP 14: Convenience flags for common permission checks
  const canWrite = hasPermission('calls.write');
  const canAnalyze = hasPermission('analysis.run');
  const canExportCsv = hasPermission('export.csv');
  const canExportPdf = hasPermission('export.pdf');
  const canViewAudit = hasPermission('audit.read');
  
  // STEP 15C: Show tour on first login
  useEffect(() => {
    if (session && portalKey) {
      // Extract username from displayName (safe approximation)
      const username = session.displayName.replace(/\s+/g, '_').toLowerCase();
      if (!hasDismissedTour(portalKey, username)) {
        setShowTour(true);
      }
    }
  }, [session, portalKey]);
  
  // STEP 15C: Dismiss tour handler
  const handleDismissTour = useCallback(() => {
    if (session && portalKey) {
      const username = session.displayName.replace(/\s+/g, '_').toLowerCase();
      dismissTour(portalKey, username);
      setShowTour(false);
    }
  }, [session, portalKey]);
  
  // Fetch call stats
  const { data: stats } = useQuery<CallStats>({
    queryKey: ['portal-stats', portalKey],
    queryFn: async () => {
      const res = await fetch('/api/portal/calls/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!session
  });
  
  // STEP 12: Build query params for API calls
  const buildApiParams = useCallback((cursor?: string) => {
    const params = new URLSearchParams({ limit: '50' });
    if (rangePreset === 'custom' && customFrom && customTo) {
      params.set('from', customFrom);
      params.set('to', customTo);
    } else if (rangePreset !== 'custom') {
      params.set('range', rangePreset);
    }
    if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
    if (cursor) params.set('cursor', cursor);
    return params;
  }, [rangePreset, customFrom, customTo, debouncedSearchQuery]);
  
  // STEP 20B: Stable view key serializer (fixed order: range|from|to|tab|q)
  const stableViewKey = useMemo(() => {
    const r = rangePreset || '';
    const f = customFrom || '';
    const t = customTo || '';
    const tb = activeTab || '';
    const q = debouncedSearchQuery || '';
    return `${r}|${f}|${t}|${tb}|${q}`;
  }, [rangePreset, customFrom, customTo, activeTab, debouncedSearchQuery]);
  
  // STEP 18: Scroll restore refs
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const hasRestoredScroll = useRef(false);
  const scrollSaveThrottleRef = useRef<NodeJS.Timeout | null>(null);
  
  // STEP 18B: Fetch calls list with useInfiniteQuery
  // STEP 28E: Tuned query settings for performance
  const { 
    data: callsData, 
    isLoading: callsLoading, 
    refetch: refetchCalls,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery<{ items: CallItem[]; nextCursor: string | null }>({
    queryKey: ['portal-calls', portalKey, stableViewKey],
    queryFn: async ({ pageParam }) => {
      const params = buildApiParams(pageParam as string | undefined);
      const res = await fetch(`/api/portal/calls?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch calls');
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!session,
    staleTime: 30_000, // STEP 28E: 30s stale time
    gcTime: 5 * 60_000, // STEP 28E: 5 min garbage collection
    refetchOnWindowFocus: false // STEP 28E: No auto-refetch on focus
  });
  
  // STEP 18: Flatten pages into single array
  const allCalls = useMemo(() => 
    callsData?.pages.flatMap(p => p.items) ?? [],
    [callsData?.pages]
  );
  
  // STEP 24B: Queue Mode - derive prioritized calls
  // Rules: needsReview + status!=failed + successChance>=70 + exclude starred + exclude not_interested/wrong_number
  // STEP 26D: When activeTab === 'myQueue', also filter by owner === me
  const queueCalls = useMemo(() => {
    if (!queueMode) return allCalls;
    return allCalls.filter(call => {
      // Must not be reviewed (use CallItem.reviewedAt directly)
      if (call.reviewedAt) return false;
      // Must not be failed
      if (call.status === 'failed') return false;
      // Must not be starred (queue is for unworked items)
      if (call.starred) return false;
      // Exclude not_interested and wrong_number outcomes
      if (call.outcomeTag === 'not_interested' || call.outcomeTag === 'wrong_number') return false;
      // Must have successChance >= 70
      const successChance = call.successChance ?? call.signalScore ?? 0;
      if (successChance < 70) return false;
      // STEP 26D: When My Queue tab is active, also filter by owner
      if (activeTab === 'myQueue' && call.nextActionOwner !== session?.displayName) return false;
      
      return true;
    });
  }, [allCalls, queueMode, activeTab, session?.displayName]);
  
  // STEP 24: Display calls (queue or all based on mode)
  const displayCalls = queueMode ? queueCalls : allCalls;
  
  // STEP 18C + 20C: IntersectionObserver for infinite scroll with cleanup guards
  useEffect(() => {
    if (!sentinelRef.current) return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        // STEP 20C: Guard against unmounted state and no more pages
        if (!isMountedRef.current || !hasNextPage || isFetchingNextPage) return;
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: '600px', threshold: 0 }
    );
    
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);
  
  // STEP 18E: Scroll restore - save position (throttled)
  useEffect(() => {
    const handleScroll = () => {
      if (scrollSaveThrottleRef.current) return;
      scrollSaveThrottleRef.current = setTimeout(() => {
        scrollSaveThrottleRef.current = null;
        const scrollY = window.scrollY;
        try {
          sessionStorage.setItem(`portal.scroll.v1:${portalKey}:${stableViewKey}`, String(scrollY));
        } catch {}
      }, 200);
    };
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [portalKey, stableViewKey]);
  
  // STEP 18E: Scroll restore - restore position after first load
  useEffect(() => {
    if (!callsData?.pages.length || hasRestoredScroll.current || urlCallId) return;
    hasRestoredScroll.current = true;
    
    try {
      const savedScroll = sessionStorage.getItem(`portal.scroll.v1:${portalKey}:${stableViewKey}`);
      if (savedScroll) {
        const scrollY = Math.max(0, Math.min(parseInt(savedScroll, 10), document.body.scrollHeight - window.innerHeight));
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
      }
    } catch {}
  }, [callsData?.pages.length, portalKey, stableViewKey, urlCallId]);
  
  // STEP 18E: Reset scroll restore flag when view changes
  useEffect(() => {
    hasRestoredScroll.current = false;
  }, [stableViewKey]);
  
  // STEP 20D: Cancel in-flight queries when view changes rapidly
  useEffect(() => {
    return () => {
      queryClient.cancelQueries({ queryKey: ['portal-calls', portalKey] });
      queryClient.cancelQueries({ queryKey: ['portal-counts', portalKey] });
    };
  }, [stableViewKey, queryClient, portalKey]);
  
  // STEP 18D: Prefetch call detail on hover
  // STEP 28B: Stable handler for memoized rows
  const handleRowPrefetch = useCallback((callId: number) => {
    queryClient.prefetchQuery({
      queryKey: ['portal-call', callId],
      queryFn: async () => {
        const res = await fetch(`/api/portal/calls/${callId}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to fetch call');
        return res.json();
      },
      staleTime: 60_000
    });
  }, [queryClient]);
  
  // STEP 28B: Stable handler for row open (no inline arrow functions)
  const handleRowOpen = useCallback((callId: number) => {
    setSelectedCallId(callId);
  }, []);
  
  // STEP 28E: Unified refresh handler
  const handleUnifiedRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portal-calls', portalKey] }),
        queryClient.invalidateQueries({ queryKey: ['portal-counts', portalKey] }),
        queryClient.invalidateQueries({ queryKey: ['portal-insights', portalKey] })
      ]);
      await refetchCalls();
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient, portalKey, refetchCalls]);
  
  // STEP 12E: Fetch server-side counts (STEP 20: uses debouncedSearchQuery)
  // STEP 28E: Tuned query settings
  const { data: countsData, isLoading: countsLoading, error: countsError } = useQuery<CountsData>({
    queryKey: ['portal-counts', portalKey, stableViewKey],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rangePreset === 'custom' && customFrom && customTo) {
        params.set('from', customFrom);
        params.set('to', customTo);
      } else if (rangePreset !== 'custom') {
        params.set('range', rangePreset);
      }
      if (debouncedSearchQuery) params.set('q', debouncedSearchQuery);
      const res = await fetch(`/api/portal/calls/counts?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch counts');
      return res.json();
    },
    enabled: !!session,
    staleTime: 30_000, // STEP 28E: 30s stale time
    refetchOnWindowFocus: false
  });
  
  // Fetch insights (14 day trends)
  // STEP 28E: Tuned query settings
  const { data: insights } = useQuery<InsightsData>({
    queryKey: ['portal-insights', portalKey],
    queryFn: async () => {
      const res = await fetch('/api/portal/calls/insights?range=14d', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch insights');
      return res.json();
    },
    enabled: !!session,
    staleTime: 60_000, // STEP 28E: 60s stale time for insights
    refetchOnWindowFocus: false
  });
  
  // STEP 12: CSV Export handler (uses current view state)
  const handleExportCSV = useCallback(() => {
    const params = buildApiParams();
    window.open(`/api/portal/calls/export.csv?${params}`, '_blank');
  }, [buildApiParams]);
  
  // STEP 13D: PDF Report handler (uses current view state)
  const handleOpenReport = useCallback(() => {
    const params = buildApiParams();
    params.delete('limit'); // Not needed for report
    if (activeFilter === 'high_signal') params.set('highSignal', '1');
    window.open(`/portal/${portalKey}/report?${params}`, '_blank');
  }, [portalKey, activeFilter, buildApiParams]);
  
  // STEP 14: Fetch audit log (only if user has permission)
  const { data: auditData } = useQuery<{ entries: Array<{ ts: string; action: string; metaSafe: { callId?: number } }> }>({
    queryKey: ['portal-audit', portalKey],
    queryFn: async () => {
      const res = await fetch('/api/portal/audit?limit=50', { credentials: 'include' });
      if (!res.ok) return { entries: [] };
      return res.json();
    },
    enabled: !!session && canViewAudit,
    staleTime: 30 * 1000 // 30 sec cache
  });
  
  // STEP 9+11: Filter calls by tab first, then by KPI filter (STEP 18: use allCalls, STEP 24: queue mode uses displayCalls)
  const tabFilteredCalls = useMemo(() => {
    // STEP 24: When queue mode is active, use queue-filtered calls directly
    if (queueMode) return queueCalls;
    
    if (!allCalls.length) return [];
    
    switch (activeTab) {
      case 'needsReview':
        return allCalls.filter(c => !c.reviewedAt);
      case 'starred':
        return allCalls.filter(c => c.starred);
      case 'highSignal':
        return allCalls.filter(c => c.signalScore && c.signalScore >= HIGH_SIGNAL_THRESHOLD);
      case 'failed':
        return allCalls.filter(c => c.status?.toLowerCase() === 'failed');
      // STEP 11: Outcome-based tabs
      case 'appointments':
        return allCalls.filter(c => c.outcomeTag === 'appointment');
      case 'callbacks':
        return allCalls.filter(c => c.outcomeTag === 'callback');
      case 'followUp':
        return allCalls.filter(c => c.outcomeTag === 'follow_up');
      // STEP 26: My Queue tab (owner === current user)
      case 'myQueue':
        return allCalls.filter(c => c.nextActionOwner === session?.displayName);
      default:
        return allCalls;
    }
  }, [allCalls, activeTab, queueMode, queueCalls, session?.displayName]);
  
  // Filter calls based on active KPI filter (on top of tab filter)
  const filteredCalls = useMemo(() => {
    if (!tabFilteredCalls.length) return [];
    
    switch (activeFilter) {
      case 'connected':
        return tabFilteredCalls.filter(c => 
          ['initiated', 'completed', 'in_progress'].includes(c.status?.toLowerCase())
        );
      case 'completed':
        return tabFilteredCalls.filter(c => 
          ['completed', 'done'].includes(c.status?.toLowerCase())
        );
      case 'high_signal':
        return tabFilteredCalls.filter(c => 
          c.signalScore && c.signalScore >= HIGH_SIGNAL_THRESHOLD
        );
      default:
        return tabFilteredCalls;
    }
  }, [tabFilteredCalls, activeFilter]);
  
  // STEP 12E: Tab counts from server-side counts (not from loaded page)
  // STEP 26: myQueue count is client-side (owner === me)
  const myQueueCount = useMemo(() => {
    if (!allCalls.length || !session?.displayName) return 0;
    return allCalls.filter(c => c.nextActionOwner === session.displayName).length;
  }, [allCalls, session?.displayName]);
  
  const tabCounts = useMemo(() => {
    if (!countsData?.counts) return { all: 0, needsReview: 0, starred: 0, highSignal: 0, failed: 0, appointments: 0, callbacks: 0, followUp: 0, myQueue: 0 };
    return {
      all: countsData.counts.all,
      needsReview: countsData.counts.needsReview,
      starred: countsData.counts.starred,
      highSignal: countsData.counts.highSignal,
      failed: countsData.counts.failed,
      appointments: countsData.counts.appointment,
      callbacks: countsData.counts.callback,
      followUp: countsData.counts.follow_up,
      myQueue: myQueueCount
    };
  }, [countsData?.counts, myQueueCount]);
  
  // STEP 9: Next Actions - top 8 high signal calls with analysis (STEP 18: use allCalls)
  const nextActions = useMemo(() => {
    if (!allCalls.length) return [];
    return allCalls
      .filter((c: CallItem) => c.hasAnalysis && c.signalScore && c.signalScore >= HIGH_SIGNAL_THRESHOLD)
      .sort((a: CallItem, b: CallItem) => (b.signalScore || 0) - (a.signalScore || 0))
      .slice(0, 8);
  }, [allCalls]);
  
  // Calculate KPI stats (STEP 18: use allCalls)
  const kpiStats = useMemo(() => {
    if (!allCalls.length) return null;
    const items = allCalls;
    
    const connected = items.filter(c => 
      ['initiated', 'completed', 'in_progress'].includes(c.status?.toLowerCase())
    ).length;
    
    const completed = items.filter(c => 
      ['completed', 'done'].includes(c.status?.toLowerCase())
    ).length;
    
    const highSignal = items.filter(c => 
      c.signalScore && c.signalScore >= HIGH_SIGNAL_THRESHOLD
    ).length;
    
    const analyzedCount = items.filter(c => c.hasAnalysis).length;
    
    return { connected, completed, highSignal, analyzedCount };
  }, [allCalls]);
  
  // STEP 17: Quota Forecast calculation
  const quotaForecast = useMemo(() => {
    if (!stats || !insights) return null;
    
    const remainingCalls = stats.remainingCalls;
    const seriesData = insights.series || [];
    const daysWithData = seriesData.filter(s => s.total > 0).length;
    
    const totalFromSeries = seriesData.reduce((sum, s) => sum + s.total, 0);
    const avgCallsPerDay = daysWithData > 0 
      ? Math.round((totalFromSeries / daysWithData) * 10) / 10
      : null;
    
    const daysToDepletion = avgCallsPerDay && avgCallsPerDay > 0
      ? Math.ceil(remainingCalls / avgCallsPerDay)
      : null;
    
    let projectedDepletionDate: string | null = null;
    if (daysToDepletion !== null) {
      const depletionDate = new Date();
      depletionDate.setDate(depletionDate.getDate() + daysToDepletion);
      projectedDepletionDate = depletionDate.toISOString().split('T')[0];
    }
    
    const failureRate = insights.totals.total > 0 
      ? insights.totals.failed / insights.totals.total 
      : 0;
    
    type RiskLevel = 'on_track' | 'warning' | 'critical';
    let riskLevel: RiskLevel = 'on_track';
    let riskReason: string | null = null;
    
    if (remainingCalls <= 100) {
      riskLevel = 'critical';
      riskReason = 'Weniger als 100 Calls übrig';
    } else if (remainingCalls <= 250) {
      riskLevel = 'warning';
      riskReason = 'Weniger als 250 Calls übrig';
    }
    
    if (daysToDepletion !== null) {
      if (daysToDepletion <= 7) {
        riskLevel = 'critical';
        riskReason = `Erschöpfung in ${daysToDepletion} Tagen`;
      } else if (daysToDepletion <= 14 && riskLevel !== 'critical') {
        riskLevel = 'warning';
        riskReason = `Erschöpfung in ${daysToDepletion} Tagen`;
      }
    }
    
    if (failureRate > 0.25) {
      riskLevel = 'critical';
      riskReason = `Hohe Fehlerrate: ${Math.round(failureRate * 100)}%`;
    } else if (failureRate > 0.15 && riskLevel !== 'critical') {
      riskLevel = 'warning';
      riskReason = `Erhöhte Fehlerrate: ${Math.round(failureRate * 100)}%`;
    }
    
    return { remainingCalls, avgCallsPerDay, daysToDepletion, projectedDepletionDate, riskLevel, riskReason };
  }, [stats, insights]);
  
  // STEP 9: Bulk Analyze handler
  const handleBulkAnalyze = useCallback(async () => {
    if (!tabFilteredCalls.length) return;
    
    // Get candidates: no analysis, max 20
    const candidates = tabFilteredCalls
      .filter(c => !c.hasAnalysis && c.hasTranscript)
      .slice(0, 20);
    
    if (candidates.length === 0) return;
    
    bulkCancelRef.current = false;
    setBulkAnalyzeState({
      running: true,
      progress: 0,
      total: candidates.length,
      okCount: 0,
      failedCount: 0,
      cancelled: false
    });
    
    let ok = 0;
    let failed = 0;
    
    for (let i = 0; i < candidates.length; i++) {
      if (bulkCancelRef.current) {
        setBulkAnalyzeState(prev => prev ? { ...prev, running: false, cancelled: true } : null);
        break;
      }
      
      const call = candidates[i];
      try {
        const res = await portalFetch(`/api/portal/calls/${call.id}/analyze`, {
          method: 'POST'
        });
        // STEP 22B: Handle CSRF error - abort bulk and redirect
        if ((res as any).csrfError) {
          setViewToast('Session-Fehler. Bitte neu einloggen.');
          setLocation(`/portal/${portalKey}/login?session_expired=1`);
          setBulkAnalyzeState(null);
          return;
        }
        if (res.ok) {
          ok++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      
      setBulkAnalyzeState(prev => prev ? {
        ...prev,
        progress: i + 1,
        okCount: ok,
        failedCount: failed
      } : null);
      
      // Small delay between requests
      if (i < candidates.length - 1) {
        await new Promise(r => setTimeout(r, 250));
      }
    }
    
    setBulkAnalyzeState(prev => prev ? { ...prev, running: false } : null);
    refetchCalls();
    queryClient.invalidateQueries({ queryKey: ['portal-insights'] });
  }, [tabFilteredCalls, refetchCalls, queryClient]);
  
  const handleBulkCancel = useCallback(() => {
    bulkCancelRef.current = true;
  }, []);
  
  // Handle unauthorized - redirect to login
  useEffect(() => {
    if (sessionError?.message === 'UNAUTHORIZED') {
      setLocation(`/portal/${portalKey}/login`);
    }
  }, [sessionError, portalKey, setLocation]);
  
  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/portal/logout', { 
      method: 'POST', 
      credentials: 'include' 
    });
    setLocation(`/portal/${portalKey}/login`);
  };
  
  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black/40">
        <Loader2 className="w-10 h-10 text-[#FE9100] animate-spin" />
      </div>
    );
  }
  
  if (!session) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-black/40 relative overflow-hidden">
      {/* Animated Gradient Background (STEP 3) */}
      <div 
        className="absolute pointer-events-none"
        style={{
          inset: '-120px -120px auto -120px',
          height: '340px',
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(254,145,0,0.12) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 30%, rgba(255,107,0,0.08) 0%, transparent 45%),
            linear-gradient(180deg, rgba(254,145,0,0.06) 0%, transparent 60%)
          `,
          opacity: 0.28,
          animation: reducedMotion ? 'none' : 'gradientShift 8s ease-in-out infinite alternate',
        }}
      />
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
      `}</style>
      
      {/* Header (STEP 6 — White-Label Branding) */}
      <header 
        className="sticky top-0 z-30 border-b border-white/5 backdrop-blur-xl"
        style={{ background: 'rgba(10,10,10,0.8)' }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 
                className="text-[22px] font-bold text-white"
                style={{ fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.06em' }}
              >
                {session.ui.branding?.productName || session.ui.portalTitle}
              </h1>
              <p className="text-[14px] text-white/60 hidden sm:block">
                {session.ui.copy?.welcomeSubtitle || 'Command Center'}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Activity Button */}
              {/* STEP 14: Audit button (permission-gated) */}
              {canViewAudit && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowActivityDrawer(true)}
                      className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white relative"
                    >
                      <Activity className="w-5 h-5" />
                      {auditData && auditData.entries.length > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#FE9100]" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Aktivitätsprotokoll</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* STEP 14: Read-only badge */}
              {!canWrite && (
                <span 
                  className="px-2.5 h-[22px] rounded-full text-[10px] font-medium flex items-center opacity-80"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                >
                  Read-only
                </span>
              )}
              
              {/* User Chip */}
              <div 
                className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-full h-[32px]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <div className="w-6 h-6 rounded-full bg-[#FE9100]/20 flex items-center justify-center">
                  <User className="w-3 h-3 text-[#FE9100]" />
                </div>
                <div className="text-right">
                  <span className="text-sm text-white font-medium">{session.displayName}</span>
                  <span className="text-white/30 mx-1">·</span>
                  <span className="text-xs text-white/40">{session.role}</span>
                </div>
              </div>
              
              {/* STEP 15B: Help link */}
              <a
                href={`/portal/${portalKey}/help`}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                title="Hilfe"
              >
                <HelpCircle className="w-5 h-5" />
              </a>
              
              {/* Logout */}
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60 hover:text-white"
                title="Abmelden"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Powered by (optional) */}
          {session.ui.branding?.showPoweredBy && (
            <div className="pb-2 text-center">
              <span className="text-[10px] text-white/30">Powered by ARAS AI</span>
            </div>
          )}
        </div>
      </header>
      
      {/* STEP 12C: Range Picker + Tab Bar */}
      <div 
        className="sticky top-16 z-20 border-b border-white/5 backdrop-blur-xl"
        style={{ background: 'rgba(10,10,10,0.7)' }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Range Picker Row */}
          <div className="flex items-center gap-3 py-2 border-b border-white/5">
            <select
              value={rangePreset}
              onChange={(e) => {
                const val = e.target.value as RangePreset;
                setRangePreset(val);
                if (val === 'custom') {
                  setShowCustomRange(true);
                } else {
                  setShowCustomRange(false);
                  setCustomFrom('');
                  setCustomTo('');
                }
              }}
              aria-label="Date range"
              className="h-9 px-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white/80 outline-none focus:border-[#FE9100]/50"
              style={{ minWidth: 140 }}
            >
              <option value="14d">Last 14 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
              <option value="custom">Custom…</option>
            </select>
            
            {showCustomRange && (
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="range-from">From</label>
                <input
                  id="range-from"
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="h-9 px-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white/80 outline-none focus:border-[#FE9100]/50"
                  aria-describedby="range-hint"
                />
                <span className="text-white/40 text-sm">to</span>
                <label className="sr-only" htmlFor="range-to">To</label>
                <input
                  id="range-to"
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="h-9 px-3 rounded-xl text-sm bg-white/5 border border-white/10 text-white/80 outline-none focus:border-[#FE9100]/50"
                />
                <span id="range-hint" className="sr-only">Max 365 days</span>
              </div>
            )}
            
            <div className="flex-1" />
            
            {/* STEP 13B: Workboard Toolbar */}
            <div className="flex items-center gap-2">
              {/* STEP 24A: Queue Mode Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setQueueMode(!queueMode)}
                    className={`h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors motion-reduce:transition-none ${
                      queueMode 
                        ? 'bg-[#FE9100]/20 border border-[#FE9100]/40 text-[#FE9100]' 
                        : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Queue Mode
                    {queueMode && queueCalls.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-[#FE9100]/30">{queueCalls.length}</span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Zeigt nur priorisierte Gespräche zur schnellen Abarbeitung.</p>
                </TooltipContent>
              </Tooltip>
              
              {/* STEP 28F: Compact Mode Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleToggleCompact}
                    className={`h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors motion-reduce:transition-none ${
                      isCompact 
                        ? 'bg-white/10 border border-white/20 text-white/80' 
                        : 'bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8'
                    }`}
                  >
                    Compact
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Kompakte Ansicht für mehr Zeilen.</p>
                </TooltipContent>
              </Tooltip>
              
              {/* STEP 28E: Unified Refresh Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleUnifiedRefresh}
                    disabled={isRefreshing}
                    className="h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-2 bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors motion-reduce:transition-none disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Alle Daten aktualisieren.</p>
                </TooltipContent>
              </Tooltip>
              
              {/* STEP 30B: QA Panel Button (debug gated) */}
              {isQaDebugMode && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowQaPanel(true)}
                      className="h-9 px-3 rounded-xl text-xs font-medium flex items-center gap-2 bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-colors motion-reduce:transition-none"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      QA
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Release QA Panel (Debug Mode)</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* Save View */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowSavePopover(!showSavePopover)}
                      className="h-9 px-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors"
                    >
                      Save View
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{session?.ui?.infoHints?.saveView || 'Aktuelle Filter als View speichern'}</p></TooltipContent>
                </Tooltip>
                
                {showSavePopover && (
                  <div 
                    className="absolute top-full right-0 mt-2 p-3 rounded-xl z-50 min-w-[200px]"
                    style={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
                  >
                    <input
                      type="text"
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      placeholder="View name…"
                      maxLength={32}
                      className="w-full h-9 px-3 rounded-lg text-sm bg-white/5 border border-white/10 text-white/80 placeholder-white/30 outline-none focus:border-[#FE9100]/50 mb-2"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveView()}
                    />
                    <button
                      onClick={handleSaveView}
                      disabled={!newViewName.trim()}
                      className="w-full h-9 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ background: 'linear-gradient(135deg, #FE9100 0%, #FF6B00 100%)' }}
                    >
                      Save
                    </button>
                  </div>
                )}
              </div>
              
              {/* Views Dropdown */}
              <div className="relative">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowViewsDropdown(!showViewsDropdown)}
                      className="h-9 px-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors flex items-center gap-1"
                    >
                      Views
                      {savedViews.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-white/10">{savedViews.length}</span>
                      )}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent><p className="text-xs">{session?.ui?.infoHints?.loadView || 'Gespeicherte Views laden'}</p></TooltipContent>
                </Tooltip>
                
                {showViewsDropdown && (
                  <div 
                    className="absolute top-full right-0 mt-2 rounded-xl z-50 min-w-[240px] max-h-[300px] overflow-y-auto"
                    style={{ background: 'rgba(20,20,20,0.95)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}
                  >
                    {savedViews.length === 0 ? (
                      <div className="p-4 text-center text-xs text-white/40">No saved views</div>
                    ) : (
                      savedViews.map(view => (
                        <div 
                          key={view.id}
                          className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer group"
                          onClick={() => handleLoadView(view)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white/80 font-medium truncate">{view.name}</div>
                            <div className="text-[10px] text-white/40 mt-0.5">
                              {view.state.tab} · {view.state.range}
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteView(view.id); }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 text-white/40 hover:text-red-400 transition-all"
                            title="Delete"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              
              {/* Share View */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleShareViewLink}
                    className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white/80 hover:bg-white/8 transition-colors flex items-center justify-center"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{session?.ui?.infoHints?.shareView || 'View-Link kopieren'}</p></TooltipContent>
              </Tooltip>
              
              {/* Clear */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleClearFilters}
                    className="h-9 px-3 rounded-xl text-xs font-medium text-white/40 hover:text-white/60 transition-colors"
                  >
                    Clear
                  </button>
                </TooltipTrigger>
                <TooltipContent><p className="text-xs">{session?.ui?.infoHints?.clearFilters || 'Tab + Search zurücksetzen (Range bleibt)'}</p></TooltipContent>
              </Tooltip>
              
              {/* Separator */}
              <div className="w-px h-6 bg-white/10" />
              
              {/* STEP 14: Export CSV (permission-gated) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={canExportCsv ? handleExportCSV : undefined}
                    disabled={!canExportCsv}
                    className={`h-9 px-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 flex items-center gap-1.5 transition-colors ${
                      canExportCsv 
                        ? 'text-white/60 hover:text-white/80 hover:bg-white/8 cursor-pointer' 
                        : 'text-white/30 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    CSV
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{canExportCsv ? 'Exports current view' : 'Keine Berechtigung für diese Funktion.'}</p>
                </TooltipContent>
              </Tooltip>
              
              {/* STEP 14: PDF Report (permission-gated) */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={canExportPdf ? handleOpenReport : undefined}
                    disabled={!canExportPdf}
                    className={`h-9 px-3 rounded-xl text-xs font-medium bg-white/5 border border-white/10 flex items-center gap-1.5 transition-colors ${
                      canExportPdf 
                        ? 'text-white/60 hover:text-white/80 hover:bg-white/8 cursor-pointer' 
                        : 'text-white/30 cursor-not-allowed opacity-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Report
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{canExportPdf ? 'Exports current view as PDF' : 'Keine Berechtigung für diese Funktion.'}</p>
                </TooltipContent>
              </Tooltip>
            </div>
            
            {/* Total count indicator */}
            <span className="text-xs text-white/40 ml-2">
              {countsLoading ? '…' : countsError ? '—' : `${tabCounts.all} calls`}
            </span>
          </div>
          
          {/* Tab Bar */}
          <div className="flex items-center gap-1 py-2 overflow-x-auto hide-scrollbar">
            {([
              { key: 'all' as TabFilter, label: 'All', count: tabCounts.all },
              { key: 'needsReview' as TabFilter, label: 'Needs Review', count: tabCounts.needsReview },
              { key: 'starred' as TabFilter, label: 'Starred', count: tabCounts.starred },
              { key: 'highSignal' as TabFilter, label: 'High Signal', count: tabCounts.highSignal },
              { key: 'failed' as TabFilter, label: 'Failed', count: tabCounts.failed },
              // STEP 11: Outcome-based tabs
              { key: 'appointments' as TabFilter, label: 'Appointments', count: tabCounts.appointments },
              { key: 'callbacks' as TabFilter, label: 'Callbacks', count: tabCounts.callbacks },
              { key: 'followUp' as TabFilter, label: 'Follow-up', count: tabCounts.followUp },
              // STEP 26: My Queue tab (only if write permission)
              ...(canWrite ? [{ key: 'myQueue' as TabFilter, label: 'My Queue', count: tabCounts.myQueue, tooltip: 'Gespräche, die Ihnen zugewiesen sind.' }] : [])
            ]).map(tab => (
              <Tooltip key={tab.key}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveTab(tab.key)}
                    className="flex items-center gap-2 px-4 h-[36px] rounded-full text-sm font-medium whitespace-nowrap transition-colors"
                    style={{
                      background: activeTab === tab.key ? 'rgba(255,255,255,0.06)' : 'transparent',
                      border: activeTab === tab.key ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                      color: activeTab === tab.key ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'
                    }}
                  >
                    {tab.label}
                    {/* STEP 12E: Show loading/error state for counts */}
                    {countsLoading ? (
                      <span className="w-6 h-4 rounded-full bg-white/10 animate-pulse" />
                    ) : countsError ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="px-1.5 py-0.5 rounded-full text-xs bg-white/10 text-white/30">—</span>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Counts unavailable</p></TooltipContent>
                      </Tooltip>
                    ) : tab.count > 0 && tab.key !== 'all' ? (
                      <span 
                        className="px-1.5 py-0.5 rounded-full text-xs"
                        style={{ 
                          background: activeTab === tab.key ? 'rgba(254,145,0,0.2)' : 'rgba(255,255,255,0.1)',
                          color: activeTab === tab.key ? '#FE9100' : 'rgba(255,255,255,0.5)'
                        }}
                      >
                        {tab.count}
                      </span>
                    ) : null}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">
                    {tab.key === 'all' && (session?.ui?.infoHints?.tabs?.all || 'Alle Calls anzeigen')}
                    {tab.key === 'needsReview' && (session?.ui?.infoHints?.tabs?.needsReview || 'Calls die noch nicht reviewed wurden')}
                    {tab.key === 'starred' && (session?.ui?.infoHints?.tabs?.starred || 'Für Follow-up markierte Calls')}
                    {tab.key === 'highSignal' && (session?.ui?.infoHints?.tabs?.highSignal || 'Calls mit Signal Score ≥ 70')}
                    {tab.key === 'failed' && (session?.ui?.infoHints?.tabs?.failed || 'Fehlgeschlagene Calls')}
                    {tab.key === 'appointments' && 'Calls mit Termin-Outcome'}
                    {tab.key === 'callbacks' && 'Calls mit Rückruf-Wunsch'}
                    {tab.key === 'followUp' && 'Calls die Follow-up benötigen'}
                  </p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 relative">
        
        {/* Insights Panel (STEP 5) */}
        {insights && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {/* Performance Card */}
            <div 
              className="p-5 rounded-2xl"
              style={{
                background: 'rgba(20,20,20,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white/60">Performance (14 days)</h3>
                <BarChart3 className="w-4 h-4 text-[#FE9100]" />
              </div>
              <div className="flex items-center gap-4 mb-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="text-xs text-white/60">{insights.totals.completed} completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <span className="text-xs text-white/60">{insights.totals.failed} failed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Zap className="w-3 h-3 text-[#FE9100]" />
                  <span className="text-xs text-white/60">{insights.totals.highSignalCount} high signal</span>
                </div>
              </div>
              <Sparkline 
                data={insights.series.map(s => s.total)} 
                height={36}
                className="text-[#FE9100]"
              />
            </div>
            
            {/* Quality Card */}
            <div 
              className="p-5 rounded-2xl"
              style={{
                background: 'rgba(20,20,20,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)'
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white/60">Quality</h3>
                <Target className="w-4 h-4 text-blue-400" />
              </div>
              <div className="space-y-2">
                {/* Sentiment bars */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40 w-16">Sentiment</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden flex">
                    {insights.totals.sentiment.positive > 0 && (
                      <div 
                        className="h-full bg-green-400" 
                        style={{ width: `${(insights.totals.sentiment.positive / insights.totals.total) * 100}%` }}
                      />
                    )}
                    {insights.totals.sentiment.neutral > 0 && (
                      <div 
                        className="h-full bg-white/30" 
                        style={{ width: `${(insights.totals.sentiment.neutral / insights.totals.total) * 100}%` }}
                      />
                    )}
                    {insights.totals.sentiment.negative > 0 && (
                      <div 
                        className="h-full bg-red-400" 
                        style={{ width: `${(insights.totals.sentiment.negative / insights.totals.total) * 100}%` }}
                      />
                    )}
                  </div>
                </div>
                {/* Analyzed bar */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/40 w-16">Analyzed</span>
                  <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                    <div 
                      className="h-full bg-[#FE9100]" 
                      style={{ width: `${insights.totals.total > 0 ? (insights.totals.analyzedCount / insights.totals.total) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-white/40">{insights.totals.analyzedCount}/{insights.totals.total}</span>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/40">
                Avg duration: {Math.floor(insights.totals.avgDurationSec / 60)}:{(insights.totals.avgDurationSec % 60).toString().padStart(2, '0')}
              </div>
            </div>
          </div>
        )}
        
        {/* KPI Row (STEP 3) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Calls Used */}
          <button
            onClick={() => setActiveFilter('all')}
            className="group p-[18px] rounded-[20px] text-left transition-all duration-200"
            style={{
              minHeight: '112px',
              background: activeFilter === 'all' ? 'rgba(254,145,0,0.1)' : 'rgba(20,20,20,0.6)',
              border: activeFilter === 'all' ? '1px solid rgba(254,145,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
              transform: 'translateY(0)',
            }}
            onMouseEnter={(e) => { if (!reducedMotion) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div className="flex items-start justify-between mb-2">
              <Phone className="w-5 h-5 text-[#FE9100]" />
              <InfoTip content="Jeder abgeschlossene Call zählt gegen das Kontingent von 2.000 Calls." />
            </div>
            <div className="text-[28px] font-bold text-white mb-1">
              {stats?.totalCalls ?? '—'}<span className="text-white/40 text-lg">/{stats?.includedCalls ?? 2000}</span>
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Calls Used</div>
            {stats && (
              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div 
                  className="h-full rounded-full"
                  style={{ 
                    width: `${Math.min(stats.usagePercent, 100)}%`,
                    background: 'linear-gradient(90deg, #FE9100, #FF6B00)'
                  }}
                />
              </div>
            )}
          </button>
          
          {/* Connected */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'connected' ? 'all' : 'connected')}
            className="group p-[18px] rounded-[20px] text-left transition-all duration-200"
            style={{
              minHeight: '112px',
              background: activeFilter === 'connected' ? 'rgba(254,145,0,0.1)' : 'rgba(20,20,20,0.6)',
              border: activeFilter === 'connected' ? '1px solid rgba(254,145,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
            onMouseEnter={(e) => { if (!reducedMotion) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div className="flex items-start justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <InfoTip content="Calls die verbunden wurden (initiated, in progress, completed)." />
            </div>
            <div className="text-[28px] font-bold text-white mb-1">{kpiStats?.connected ?? '—'}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Connected</div>
          </button>
          
          {/* Completed */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'completed' ? 'all' : 'completed')}
            className="group p-[18px] rounded-[20px] text-left transition-all duration-200"
            style={{
              minHeight: '112px',
              background: activeFilter === 'completed' ? 'rgba(254,145,0,0.1)' : 'rgba(20,20,20,0.6)',
              border: activeFilter === 'completed' ? '1px solid rgba(254,145,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
            onMouseEnter={(e) => { if (!reducedMotion) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div className="flex items-start justify-between mb-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <InfoTip content="Erfolgreich abgeschlossene Calls mit vollständigem Transcript." />
            </div>
            <div className="text-[28px] font-bold text-white mb-1">{kpiStats?.completed ?? '—'}</div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">Completed</div>
          </button>
          
          {/* High Signal */}
          <button
            onClick={() => setActiveFilter(activeFilter === 'high_signal' ? 'all' : 'high_signal')}
            className="group p-[18px] rounded-[20px] text-left transition-all duration-200"
            style={{
              minHeight: '112px',
              background: activeFilter === 'high_signal' ? 'rgba(254,145,0,0.1)' : 'rgba(20,20,20,0.6)',
              border: activeFilter === 'high_signal' ? '1px solid rgba(254,145,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(20px)',
            }}
            onMouseEnter={(e) => { if (!reducedMotion) e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            <div className="flex items-start justify-between mb-2">
              <Zap className="w-5 h-5 text-[#FE9100]" />
              <InfoTip content={`Signal Score ≥${HIGH_SIGNAL_THRESHOLD} zeigt hohe Abschlusswahrscheinlichkeit. Analyse im Call-Detail starten.`} />
            </div>
            <div className="text-[28px] font-bold text-white mb-1">
              {kpiStats?.highSignal ?? '—'}
              {kpiStats && kpiStats.analyzedCount < allCalls.length && (
                <span className="text-white/30 text-sm ml-1">?</span>
              )}
            </div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-white/40">High Signal (≥{HIGH_SIGNAL_THRESHOLD})</div>
          </button>
        </div>
        
        {/* Active Filter Pill */}
        {activeFilter !== 'all' && (
          <div className="mb-4 flex items-center gap-2">
            <span 
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm"
              style={{ background: 'rgba(254,145,0,0.15)', color: '#FE9100' }}
            >
              Filter: {activeFilter === 'connected' ? 'Connected' : activeFilter === 'completed' ? 'Completed' : 'High Signal'}
              <button 
                onClick={() => setActiveFilter('all')}
                className="hover:bg-white/10 rounded-full p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
            <span className="text-sm text-white/40">{filteredCalls.length} Ergebnisse</span>
          </div>
        )}
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Company & Package */}
          <div className="space-y-6">
            
            {/* Company Card - STEP 29A: Micro-interactions */}
            <div 
              className="p-6 rounded-2xl transition-transform transition-shadow duration-200 ease-out hover:-translate-y-[1px] motion-reduce:transition-none motion-reduce:transform-none"
              style={{
                background: 'rgba(20,20,20,0.6)',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.28)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.38)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.28)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(254,145,0,0.15)' }}
                >
                  <Building2 className="w-5 h-5 text-[#FE9100]" />
                </div>
                <h2 className="font-semibold text-white">{session.company.name}</h2>
              </div>
              
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-white/30 mt-0.5" />
                  <div>
                    <div className="text-white/40 text-xs">Geschäftsführer</div>
                    <div className="text-white/80">{session.company.ceo}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-white/30 mt-0.5" />
                  <div>
                    <div className="text-white/40 text-xs">E-Mail</div>
                    <div className="text-white/80">{session.company.email}</div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-white/30 mt-0.5" />
                  <div>
                    <div className="text-white/40 text-xs">Adresse</div>
                    <div className="text-white/80">
                      {session.company.addressLine}<br />
                      {session.company.zipCity}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <FileText className="w-4 h-4 text-white/30 mt-0.5" />
                  <div>
                    <div className="text-white/40 text-xs">USt-IdNr.</div>
                    <div className="text-white/80">{session.company.vatId}</div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Package Card - STEP 29A: Micro-interactions */}
            <div 
              className="p-6 rounded-2xl transition-transform transition-shadow duration-200 ease-out hover:-translate-y-[1px] motion-reduce:transition-none motion-reduce:transform-none"
              style={{
                background: 'linear-gradient(135deg, rgba(254,145,0,0.1) 0%, rgba(254,145,0,0.02) 100%)',
                border: '1px solid rgba(254,145,0,0.2)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 24px rgba(0,0,0,0.28)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 16px 40px rgba(0,0,0,0.38)'; e.currentTarget.style.borderColor = 'rgba(254,145,0,0.3)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.28)'; e.currentTarget.style.borderColor = 'rgba(254,145,0,0.2)'; }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white">{session.package.label}</h2>
                <Phone className="w-5 h-5 text-[#FE9100]" />
              </div>
              
              {stats && (
                <>
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-white/60">Used</span>
                      <span className="text-white font-medium">
                        {stats.totalCalls} / {stats.includedCalls}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${Math.min(stats.usagePercent, 100)}%`,
                          background: stats.usagePercent > 90 
                            ? 'linear-gradient(90deg, #ef4444, #f87171)' 
                            : 'linear-gradient(90deg, #FE9100, #FF6B00)'
                        }}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <div className="text-2xl font-bold text-white">{stats.remainingCalls}</div>
                      <div className="text-xs text-white/40">Remaining</div>
                    </div>
                    <div className="text-center p-3 rounded-xl bg-white/5">
                      <div className="text-2xl font-bold text-[#FE9100]">{stats.usagePercent}%</div>
                      <div className="text-xs text-white/40">Used</div>
                    </div>
                  </div>
                </>
              )}
              
              {/* STEP 23C: Package explainer micro-copy */}
              <p className="mt-4 text-xs text-white/40 leading-relaxed">
                Ihr Paket umfasst {session.package.includedCalls.toLocaleString('de-DE')} Gespräche. Abgeschlossene Calls zählen gegen das Kontingent.
              </p>
              {session.package.notes && (
                <p className="mt-2 text-xs text-white/30 leading-relaxed">
                  {session.package.notes}
                </p>
              )}
            </div>
            
            {/* STEP 17: Quota & Forecast Card */}
            {quotaForecast && (
              <div 
                className="p-5 rounded-2xl"
                style={{
                  background: quotaForecast.riskLevel === 'critical' 
                    ? 'rgba(239,68,68,0.08)' 
                    : quotaForecast.riskLevel === 'warning' 
                      ? 'rgba(234,179,8,0.08)' 
                      : 'rgba(20,20,20,0.6)',
                  border: quotaForecast.riskLevel === 'critical' 
                    ? '1px solid rgba(239,68,68,0.3)' 
                    : quotaForecast.riskLevel === 'warning' 
                      ? '1px solid rgba(234,179,8,0.3)' 
                      : '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(20px)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[#FE9100]" />
                    <h3 className="text-sm font-medium text-white">Forecast</h3>
                  </div>
                  {/* STEP 29C: Quota Forecast Tooltip */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span 
                        className="px-2 py-0.5 rounded-full text-xs font-medium cursor-help"
                        style={{
                          background: quotaForecast.riskLevel === 'critical' 
                            ? 'rgba(239,68,68,0.2)' 
                            : quotaForecast.riskLevel === 'warning' 
                              ? 'rgba(234,179,8,0.2)' 
                              : 'rgba(34,197,94,0.2)',
                          color: quotaForecast.riskLevel === 'critical' 
                            ? '#ef4444' 
                            : quotaForecast.riskLevel === 'warning' 
                              ? '#eab308' 
                              : '#22c55e'
                        }}
                      >
                        {quotaForecast.riskLevel === 'critical' ? 'Critical' : quotaForecast.riskLevel === 'warning' ? 'At Risk' : 'On Track'}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-[320px]">
                      <p className="text-sm leading-snug">Prognose aus aktuellem Tempo im Zeitraum. Bei Tempo-Änderung passt sich die Prognose an.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-white/50">Pace</span>
                    <span className="text-white font-medium">
                      {quotaForecast.avgCallsPerDay != null ? `~${quotaForecast.avgCallsPerDay}/day` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/50">Est. Depletion</span>
                    <span className="text-white font-medium">
                      {quotaForecast.projectedDepletionDate || '—'}
                    </span>
                  </div>
                </div>
                
                {quotaForecast.riskReason && (
                  <div 
                    className="mt-3 flex items-center gap-2 p-2 rounded-lg text-xs"
                    style={{
                      background: quotaForecast.riskLevel === 'critical' 
                        ? 'rgba(239,68,68,0.1)' 
                        : 'rgba(234,179,8,0.1)'
                    }}
                  >
                    <AlertTriangle 
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: quotaForecast.riskLevel === 'critical' ? '#ef4444' : '#eab308' }}
                    />
                    <span style={{ color: quotaForecast.riskLevel === 'critical' ? '#fca5a5' : '#fde047' }}>
                      {quotaForecast.riskReason}
                    </span>
                  </div>
                )}
              </div>
            )}
            
            {/* STEP 19: Executive Insights Card */}
            <ExecutiveInsightsCard
              countsData={countsData}
              insights={insights}
              allCalls={allCalls}
              onOpenCall={setSelectedCallId}
              hasPermission={hasPermission}
            />
            
            {/* STEP 9: Next Actions Panel */}
            <div 
              className="p-5 rounded-2xl"
              style={{
                background: 'rgba(20,20,20,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)'
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4 text-[#FE9100]" />
                <h3 className="text-sm font-medium text-white">Next Actions</h3>
              </div>
              <p className="text-xs text-white/40 mb-4">Top Gespräche mit klarstem nächsten Schritt.</p>
              
              {nextActions.length > 0 ? (
                <div className="space-y-2">
                  {nextActions.map(call => (
                    <div 
                      key={call.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-colors hover:bg-white/5"
                      onClick={() => setSelectedCallId(call.id)}
                    >
                      <span 
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{ background: `${getSignalColor(call.signalScore || 0)}15`, color: getSignalColor(call.signalScore || 0) }}
                      >
                        {call.signalScore}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/80 truncate">{call.contactName || call.to}</div>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText('Next best action copied');
                            }}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-white/40" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Next Action kopieren</p></TooltipContent>
                      </Tooltip>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-white/40 text-sm">
                  <Zap className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Noch keine analysierten High-Signal Gespräche.
                  <br />
                  <span className="text-xs">Starte Analyse im Call-Detail oder via Bulk.</span>
                </div>
              )}
            </div>
            
            {/* STEP 16: Pipeline Card */}
            {countsData?.pipeline && (
              <div 
                className="p-5 rounded-2xl"
                style={{
                  background: 'rgba(20,20,20,0.6)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(20px)'
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4 text-[#FE9100]" />
                    <h3 className="text-sm font-medium text-white">Pipeline</h3>
                  </div>
                </div>
                <p className="text-xs text-white/40 mb-3">Outcome Tags (aktueller Zeitraum).</p>
                
                <div className="space-y-2">
                  {[
                    { key: 'appointment', label: 'Appointment', color: '#22c55e' },
                    { key: 'callback', label: 'Callback', color: '#3b82f6' },
                    { key: 'follow_up', label: 'Follow-up', color: '#8b5cf6' },
                    { key: 'not_interested', label: 'Not Interested', color: '#f97316' },
                    { key: 'wrong_number', label: 'Wrong Number', color: '#ef4444' },
                    { key: 'unclear', label: 'Unclear', color: '#6b7280' }
                  ].map(({ key, label, color }) => {
                    const count = countsData.pipeline?.[key as keyof typeof countsData.pipeline] || 0;
                    const total = countsData.counts?.all || 1;
                    const percent = Math.round((count / total) * 100);
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-white/60 truncate">{label}</div>
                        <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                          <div 
                            className="h-full rounded-full"
                            style={{ width: `${percent}%`, background: color }}
                          />
                        </div>
                        <div className="w-8 text-xs text-white/60 text-right">{count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          
          {/* Right Column - Calls Table */}
          <div className="lg:col-span-2">
            <div 
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(20,20,20,0.6)',
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)'
              }}
            >
              {/* Table Header */}
              <div className="p-4 border-b border-white/5 flex items-center justify-between gap-4">
                <h2 className="font-semibold text-white">Calls</h2>
                
                <div className="flex items-center gap-2">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                    <input
                      type="text"
                      value={rawSearchQuery}
                      onChange={(e) => setRawSearchQuery(e.target.value)}
                      onKeyDown={handleSearchKeyDown}
                      placeholder="Search..."
                      className="h-9 pl-9 pr-4 rounded-lg text-sm text-white placeholder-white/30 outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        width: '200px'
                      }}
                    />
                  </div>
                  
                  {/* Export CSV */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleExportCSV}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px]">
                      <p className="text-xs">{session.ui.infoHints?.exportCsv || 'Exportiert alle gefilterten Calls als CSV-Datei.'}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* PDF Report (STEP 7) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={handleOpenReport}
                        className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                      >
                        <FileDown className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px]">
                      <p className="text-xs">{session.ui.infoHints?.pdfReport || 'Öffnet einen druckoptimierten Report. Im Druckdialog "Als PDF speichern" wählen.'}</p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* STEP 9+14: Bulk Analyze (permission-gated) */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={canAnalyze ? handleBulkAnalyze : undefined}
                        disabled={!canAnalyze || bulkAnalyzeState?.running}
                        className={`flex items-center gap-1.5 px-3 h-9 rounded-lg text-xs font-medium transition-colors ${
                          !canAnalyze ? 'opacity-50 cursor-not-allowed' : 'disabled:opacity-50'
                        }`}
                        style={{
                          background: 'rgba(254,145,0,0.15)',
                          color: canAnalyze ? '#FE9100' : 'rgba(254,145,0,0.5)',
                          border: '1px solid rgba(254,145,0,0.3)'
                        }}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        Bulk (20)
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[320px]">
                      <p className="text-xs">
                        {!canAnalyze 
                          ? 'Keine Berechtigung für diese Funktion.'
                          : session.ui.infoHints?.bulkAnalyze || 'Analysiert bis zu 20 Gespräche nacheinander. Kein Massenlauf.'}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  
                  {/* Refresh */}
                  <button
                    onClick={() => refetchCalls()}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/40 hover:text-white"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  
                  {/* STEP 18 + 21E: Loaded / Total indicator (consistent format) */}
                  <span className="text-xs text-white/30 ml-2">
                    Geladen: {allCalls.length} · Gesamt: {countsData?.counts?.all ?? '—'}
                  </span>
                </div>
              </div>
              
              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-xs text-white/40 border-b border-white/5">
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">To</th>
                      <th className="px-4 py-3 font-medium">Duration</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      {/* STEP 26: Owner column */}
                      {canWrite && <th className="px-4 py-3 font-medium" style={{ width: '140px' }}>Owner</th>}
                      <th className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1">
                          Signal
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-white/20" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Signal Score zeigt Abschlusswahrscheinlichkeit. Analyse im Detail starten.</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </th>
                      <th className="px-4 py-3 font-medium">
                        <div className="flex items-center gap-1">
                          Success
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3 h-3 text-white/20" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs max-w-[240px]">{session?.ui?.infoHints?.successChance || 'Abgeleitete Erfolgswahrscheinlichkeit basierend auf Signal/Outcome.'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </th>
                      <th className="px-4 py-3 font-medium">Artifacts</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {callsLoading ? (
                      // STEP 18F: Skeleton rows for first load
                      Array.from({ length: 8 }).map((_, i) => (
                        <tr key={`skeleton-${i}`} className="border-b border-white/5" style={{ height: '52px' }}>
                          <td className="px-4 py-3"><div className={`h-4 w-24 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          <td className="px-4 py-3"><div className={`h-4 w-32 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          <td className="px-4 py-3"><div className={`h-4 w-16 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          <td className="px-4 py-3"><div className={`h-4 w-20 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          {canWrite && <td className="px-4 py-3"><div className={`h-4 w-16 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>}
                          <td className="px-4 py-3"><div className={`h-4 w-12 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          <td className="px-4 py-3"><div className={`h-4 w-12 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          <td className="px-4 py-3"><div className={`h-4 w-16 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                          <td className="px-4 py-3"><div className={`h-4 w-4 rounded bg-white/5 ${reducedMotion ? '' : 'animate-pulse'}`} /></td>
                        </tr>
                      ))
                    ) : filteredCalls.length > 0 ? (
                      // STEP 28B: Use memoized CallsRow component
                      filteredCalls.map((call: CallItem) => (
                        <CallsRow
                          key={call.id}
                          id={call.id}
                          createdAt={call.startedAt}
                          contactName={call.contactName}
                          phoneMasked={call.to}
                          status={call.status}
                          durationSec={call.durationSec}
                          signalScore={call.signalScore ?? null}
                          successChance={call.successChance ?? null}
                          outcomeTag={call.outcomeTag ?? null}
                          starred={!!call.starred}
                          reviewedAt={call.reviewedAt ?? null}
                          nextActionOwner={call.nextActionOwner ?? null}
                          hasTranscript={!!call.hasTranscript}
                          hasRecording={!!call.hasRecording}
                          hasAnalysis={!!call.hasAnalysis}
                          isCompact={isCompact}
                          showOwnerColumn={canWrite}
                          onOpen={handleRowOpen}
                          onPrefetch={handleRowPrefetch}
                        />
                      ))
                    ) : (
                      // STEP 29B: Premium Empty States
                      <tr>
                        <td colSpan={canWrite ? 9 : 8} className="px-4 py-8">
                          <div className="flex flex-col items-center justify-center max-w-[520px] mx-auto p-6 rounded-2xl" style={{ background: 'rgba(20,20,20,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {/* Queue Empty State */}
                            {queueMode && queueCalls.length === 0 ? (
                              <>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(34,197,94,0.15)' }}>
                                  <CheckCircle2 className="w-6 h-6 text-green-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Queue ist leer. Sehr gut.</h3>
                                <p className="text-sm text-white/50 text-center mb-4">Alle priorisierten Gespräche sind abgearbeitet.</p>
                                <button
                                  onClick={() => setActiveTab('needsReview')}
                                  className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/15 text-white/80 hover:bg-white/15 transition-colors motion-reduce:transition-none"
                                >
                                  Needs Review öffnen
                                </button>
                              </>
                            ) : debouncedSearchQuery && filteredCalls.length === 0 ? (
                              /* Search No Results State */
                              <>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                  <SearchX className="w-6 h-6 text-white/40" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Keine Treffer.</h3>
                                <p className="text-sm text-white/50 text-center mb-4">Versuchen Sie einen kürzeren Begriff oder setzen Sie Filter zurück.</p>
                                <button
                                  onClick={() => { setRawSearchQuery(''); setDebouncedSearchQuery(''); setActiveTab('all'); }}
                                  className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 border border-white/15 text-white/80 hover:bg-white/15 transition-colors motion-reduce:transition-none"
                                >
                                  Filter zurücksetzen
                                </button>
                              </>
                            ) : (
                              /* Default Empty State */
                              <>
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                  <Phone className="w-6 h-6 text-white/40" />
                                </div>
                                <h3 className="text-lg font-semibold text-white mb-2">Keine Calls gefunden</h3>
                                <p className="text-sm text-white/50 text-center">
                                  {activeFilter !== 'all' ? 'Keine Calls mit diesem Filter.' : 'Keine Gespräche im gewählten Zeitraum.'}
                                </p>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* STEP 18C: Infinite scroll sentinel + Load more button */}
              <div ref={sentinelRef} className="h-1" />
              
              {isFetchingNextPage && (
                <div className="py-4 text-center">
                  <span className="text-xs text-white/40">Loading more…</span>
                </div>
              )}
              
              {hasNextPage && !isFetchingNextPage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => fetchNextPage()}
                      className="w-full py-2.5 rounded-xl text-xs font-medium text-white/60 bg-white/5 hover:bg-white/10 transition-colors"
                      style={{ height: '36px', borderRadius: '12px' }}
                    >
                      Load more
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Lädt weitere Gespräche.</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              {/* STEP 24: Empty Queue state */}
              {!callsLoading && queueMode && queueCalls.length === 0 && allCalls.length > 0 && (
                <div className="py-12 text-center">
                  <div className="text-2xl mb-2">✓</div>
                  <div className="text-white/60 text-sm mb-3">Queue ist leer. Sehr gut.</div>
                  <button
                    onClick={() => setQueueMode(false)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-[#FE9100] bg-[#FE9100]/10 hover:bg-[#FE9100]/20 transition-colors"
                  >
                    Show all calls
                  </button>
                </div>
              )}
              
              {/* STEP 18F: Empty state with clear filters */}
              {!callsLoading && filteredCalls.length === 0 && allCalls.length === 0 && (
                <div className="py-12 text-center">
                  <div className="text-white/40 text-sm mb-3">Keine Gespräche im Zeitraum gefunden.</div>
                  {(activeTab !== 'all' || debouncedSearchQuery) && (
                    <button
                      onClick={handleClearFilters}
                      className="px-4 py-2 rounded-lg text-xs font-medium text-[#FE9100] bg-[#FE9100]/10 hover:bg-[#FE9100]/20 transition-colors"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Call Detail Drawer */}
      {selectedCallId && (
        <CallDetailDrawer
          callId={selectedCallId}
          onClose={() => setSelectedCallId(null)}
          portalKey={portalKey || ''}
          onAnalysisComplete={() => refetchCalls()}
          session={session}
          onCsrfError={handleCsrfError}
          // STEP 24C: Queue navigation props
          queueIndex={queueMode ? queueCalls.findIndex(c => c.id === selectedCallId) : undefined}
          queueTotal={queueMode ? queueCalls.length : undefined}
          onPrevious={queueMode ? () => {
            const idx = queueCalls.findIndex(c => c.id === selectedCallId);
            if (idx > 0) {
              const prevCall = queueCalls[idx - 1];
              setSelectedCallId(prevCall.id);
              setLocation(`/portal/${portalKey}/calls/${prevCall.id}`);
            }
          } : undefined}
          onNext={queueMode ? () => {
            const idx = queueCalls.findIndex(c => c.id === selectedCallId);
            if (idx < queueCalls.length - 1) {
              const nextCall = queueCalls[idx + 1];
              setSelectedCallId(nextCall.id);
              setLocation(`/portal/${portalKey}/calls/${nextCall.id}`);
            }
          } : undefined}
          onKeyboardAction={(action) => setViewToast(action)}
        />
      )}
      
      {/* STEP 30B: QA Panel (debug gated) */}
      <QaPanel 
        isOpen={showQaPanel} 
        onClose={() => setShowQaPanel(false)} 
        portalKey={portalKey || ''} 
      />
      
      {/* STEP 9: Bulk Analyze Progress Modal */}
      {bulkAnalyzeState && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <div 
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[360px] p-6 rounded-2xl z-50"
            style={{
              background: 'rgba(20,20,20,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Zap className="w-5 h-5 text-[#FE9100]" />
              <h3 className="font-semibold text-white">Bulk Analyse</h3>
            </div>
            
            {bulkAnalyzeState.running ? (
              <>
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white/60">Analysiere…</span>
                    <span className="text-white">{bulkAnalyzeState.progress} / {bulkAnalyzeState.total}</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${(bulkAnalyzeState.progress / bulkAnalyzeState.total) * 100}%`,
                        background: 'linear-gradient(90deg, #FE9100, #FF6B00)'
                      }}
                    />
                  </div>
                </div>
                <button
                  onClick={handleBulkCancel}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white/70 bg-white/5 hover:bg-white/10 transition-colors"
                >
                  Abbrechen
                </button>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  {bulkAnalyzeState.cancelled ? (
                    <p className="text-white/60 text-sm">Abgebrochen</p>
                  ) : (
                    <>
                      <p className="text-white/80 text-sm mb-1">
                        <span className="text-green-400 font-medium">{bulkAnalyzeState.okCount}</span> erfolgreich
                        {bulkAnalyzeState.failedCount > 0 && (
                          <>, <span className="text-red-400 font-medium">{bulkAnalyzeState.failedCount}</span> fehlgeschlagen</>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setBulkAnalyzeState(null)}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white bg-[#FE9100] hover:bg-[#FF6B00] transition-colors"
                >
                  Schließen
                </button>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Activity Drawer (STEP 7) */}
      {showActivityDrawer && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={() => setShowActivityDrawer(false)}
          />
          <div 
            className="fixed top-0 right-0 h-full w-full md:w-[380px] z-50 overflow-y-auto"
            style={{
              background: 'rgba(15,15,15,0.98)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '-10px 0 40px rgba(0,0,0,0.4)'
            }}
          >
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-white/5 backdrop-blur-xl" style={{ background: 'rgba(15,15,15,0.9)' }}>
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#FE9100]" />
                <h2 className="font-semibold text-white">Aktivität</h2>
              </div>
              <button
                onClick={() => setShowActivityDrawer(false)}
                className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            
            <div className="p-4 space-y-2">
              {auditData?.entries && auditData.entries.length > 0 ? (
                auditData.entries.map((entry, idx) => {
                  const actionLabels: Record<string, string> = {
                    'portal.login': 'Login',
                    'portal.logout': 'Logout',
                    'portal.export.csv': 'Export (CSV)',
                    'portal.export.pdf': 'Report (PDF)',
                    'portal.analyze.start': 'Analyse gestartet',
                    'portal.analyze.success': 'Analyse erstellt',
                    'portal.analyze.fail': 'Analyse fehlgeschlagen',
                    'portal.call.view': 'Call angesehen',
                    'portal.call.note': 'Notiz gespeichert',
                    'portal.call.review': 'Review-Status geändert',
                    'portal.call.star': 'Markierung geändert',
                    'portal.bulkAnalyze.start': 'Bulk-Analyse gestartet',
                    'portal.bulkAnalyze.finish': 'Bulk-Analyse beendet'
                  };
                  const label = actionLabels[entry.action] || entry.action;
                  const time = new Date(entry.ts).toLocaleString('de-DE', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                  });
                  
                  return (
                    <div 
                      key={idx}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                        {entry.action.includes('login') ? <User className="w-4 h-4 text-green-400" /> :
                         entry.action.includes('export') || entry.action.includes('pdf') ? <FileDown className="w-4 h-4 text-blue-400" /> :
                         entry.action.includes('analyze') ? <Sparkles className="w-4 h-4 text-[#FE9100]" /> :
                         <Activity className="w-4 h-4 text-white/40" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white/90">{label}</div>
                        <div className="text-xs text-white/40">{time}</div>
                      </div>
                      {entry.metaSafe?.callId && (
                        <span className="text-xs text-white/30 font-mono">#{entry.metaSafe.callId}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-12 text-white/40 text-sm">
                  Noch keine Aktivitäten.
                </div>
              )}
            </div>
          </div>
        </>
      )}
      
      {/* STEP 13: View Toast */}
      {viewToast && <Toast message={viewToast} onClose={() => setViewToast(null)} />}
      
      {/* STEP 21D: Footer with support + company legal */}
      <footer className="mt-12 pb-8 px-6">
        <div className="max-w-[1400px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
          <div className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2">
            <span>{session?.company?.name || 'Company'}</span>
            {session?.company?.addressLine && (
              <>
                <span className="hidden sm:inline">·</span>
                <span>{session.company.addressLine}</span>
              </>
            )}
            {session?.company?.zipCity && (
              <>
                <span className="hidden sm:inline">·</span>
                <span>{session.company.zipCity}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {session?.company?.email && (
              <a 
                href={`mailto:${session.company.email}?subject=Support%20Anfrage`}
                className="hover:text-white/60 transition-colors"
              >
                Support
              </a>
            )}
            {hasPermission('export.pdf') && (
              <button
                onClick={handleOpenReport}
                className="hover:text-white/60 transition-colors"
              >
                Report
              </button>
            )}
          </div>
        </div>
      </footer>
      
      {/* STEP 15C: First-login Tour Modal */}
      {showTour && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
          <div 
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-[520px] mx-4 rounded-2xl overflow-hidden"
            style={{ background: 'rgba(20,20,20,0.98)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            {/* Header */}
            <div 
              className="p-6 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(254,145,0,0.15) 0%, rgba(254,145,0,0.05) 100%)' }}
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FE9100]/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-[#FE9100]" />
              </div>
              <h2 
                className="text-2xl font-bold text-white mb-2"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Willkommen, {session?.displayName?.split(' ')[0]}!
              </h2>
              <p className="text-sm text-white/60">
                Hier sind 3 Tipps für den perfekten Start.
              </p>
            </div>
            
            {/* STEP 23D: Tightened Steps - 3 clear bullets */}
            <div className="p-6 space-y-4">
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#FE9100]/20 flex items-center justify-center text-[#FE9100] font-bold text-sm">1</div>
                <div>
                  <h3 className="font-medium text-white">Needs Review zuerst.</h3>
                  <p className="text-sm text-white/40">Ungeprüfte Calls priorisieren.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#FE9100]/20 flex items-center justify-center text-[#FE9100] font-bold text-sm">2</div>
                <div>
                  <h3 className="font-medium text-white">Outcome Tag setzen.</h3>
                  <p className="text-sm text-white/40">Termin, Rückruf oder Follow-up.</p>
                </div>
              </div>
              
              <div className="flex gap-4 items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-[#FE9100]/20 flex items-center justify-center text-[#FE9100] font-bold text-sm">3</div>
                <div>
                  <h3 className="font-medium text-white">Next Action kopieren & umsetzen.</h3>
                  <p className="text-sm text-white/40">Copy Kit für schnelles Follow-up.</p>
                </div>
              </div>
            </div>
            
            {/* STEP 23D: Tightened Actions - "Hilfe" and "Start" */}
            <div className="p-6 pt-0 flex gap-3">
              <a
                href={`/portal/${portalKey}/help`}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-center text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                Hilfe
              </a>
              <button
                onClick={handleDismissTour}
                className="flex-1 py-3 rounded-xl text-sm font-medium text-white"
                style={{ background: 'linear-gradient(135deg, #FE9100 0%, #FF6B00 100%)' }}
              >
                Start
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
