/**
 * ARAS Mission Control - Call Card Component
 * Displays real call data with audio player, transcript, and summary
 * Premium design with ARAS CI styling
 */

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone, PhoneOff, Play, Pause, Volume2, FileText, 
  MessageSquare, ChevronDown, ChevronUp, ExternalLink,
  User, Clock, Loader2, CheckCircle, XCircle, Zap
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';
import type { RecentCall } from '@/lib/dashboard/overview.schema';

// Design Tokens
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  panelBg: 'rgba(0,0,0,0.42)',
  panelBorder: 'rgba(255,255,255,0.08)',
};

interface CallCardProps {
  call: RecentCall;
  onOpenDetails?: (callId: string) => void;
  onOpenContact?: (contactId: string) => void;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: RecentCall['status'] }) {
  const configs = {
    running: { icon: Loader2, color: '#22c55e', label: 'Läuft', animate: true },
    completed: { icon: CheckCircle, color: '#22c55e', label: 'Abgeschlossen', animate: false },
    failed: { icon: XCircle, color: '#ef4444', label: 'Fehlgeschlagen', animate: false },
    initiated: { icon: Phone, color: '#f59e0b', label: 'Initiiert', animate: false },
  };
  
  const config = configs[status] || configs.initiated;
  const Icon = config.icon;
  
  return (
    <div 
      className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-medium"
      style={{ background: `${config.color}20`, color: config.color }}
    >
      <Icon size={12} className={config.animate ? 'animate-spin' : ''} />
      <span>{config.label}</span>
    </div>
  );
}

function SentimentBadge({ sentiment }: { sentiment?: 'positive' | 'neutral' | 'negative' }) {
  if (!sentiment) return null;
  
  const configs = {
    positive: { color: '#22c55e', label: 'Positiv' },
    neutral: { color: '#6b7280', label: 'Neutral' },
    negative: { color: '#ef4444', label: 'Negativ' },
  };
  
  const config = configs[sentiment];
  
  return (
    <span 
      className="text-[9px] px-1.5 py-0.5 rounded"
      style={{ background: `${config.color}20`, color: config.color }}
    >
      {config.label}
    </span>
  );
}

function AudioPlayer({ audioUrl }: { audioUrl: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current || error) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => {
        setError('Wiedergabe fehlgeschlagen');
        console.error('[AudioPlayer] Play error:', e);
      });
    }
    setIsPlaying(!isPlaying);
  };
  
  const handleError = () => {
    setError('Keine Aufnahme gespeichert');
    setLoading(false);
  };
  
  const handleCanPlay = () => {
    setLoading(false);
    setError(null);
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const percent = (audioRef.current.currentTime / audioRef.current.duration) * 100;
    setProgress(percent);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = percent * audioRef.current.duration;
  };

  // Show error state
  if (error) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
        <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500/10">
          <Volume2 size={14} className="text-red-400" />
        </div>
        <span className="text-[11px] text-white/40">{error}</span>
      </div>
    );
  }
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        onError={handleError}
        onCanPlay={handleCanPlay}
        preload="metadata"
      />
      
      <button
        onClick={togglePlay}
        disabled={loading}
        className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-50"
        style={{ background: `linear-gradient(135deg, ${DT.orange}, #ff8533)` }}
      >
        {loading ? (
          <Loader2 size={14} className="text-white animate-spin" />
        ) : isPlaying ? (
          <Pause size={14} className="text-white" />
        ) : (
          <Play size={14} className="text-white ml-0.5" />
        )}
      </button>
      
      <div className="flex-1">
        <div 
          className="h-1.5 bg-white/10 rounded-full cursor-pointer overflow-hidden"
          onClick={handleSeek}
        >
          <div 
            className="h-full rounded-full transition-all"
            style={{ 
              width: `${progress}%`,
              background: `linear-gradient(90deg, ${DT.orange}, ${DT.gold})`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-white/40">
            {formatDuration(audioRef.current?.currentTime ? Math.floor(audioRef.current.currentTime) : 0)}
          </span>
          <span className="text-[9px] text-white/40">
            {formatDuration(Math.floor(duration))}
          </span>
        </div>
      </div>
      
      <Volume2 size={14} className="text-white/40" />
    </div>
  );
}

export function CallCard({ call, onOpenDetails, onOpenContact }: CallCardProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Safe date parsing
  let timeAgo = '';
  try {
    const startDate = call?.startedAt ? new Date(call.startedAt) : new Date();
    if (!isNaN(startDate.getTime())) {
      timeAgo = formatDistanceToNow(startDate, { addSuffix: true, locale: de });
    }
  } catch {
    timeAgo = '';
  }
  
  // Safe accessors
  const contactName = call?.contact?.name || call?.contact?.phone || 'Unbekannt';
  const contactPhone = call?.contact?.phone || '';
  const callStatus = call?.status || 'initiated';
  const callDuration = typeof call?.duration === 'number' ? call.duration : 0;
  const callTranscript = typeof call?.transcript === 'string' ? call.transcript : '';
  const hasAudio = Boolean(call?.hasAudio && call?.audioUrl);
  const hasTranscript = Boolean(call?.hasTranscript && callTranscript.length > 0);
  
  // Summary is now a NormalizedSummary OBJECT (not string)
  const summary = call?.summary || { hasSummary: false };
  const hasSummary = Boolean(summary?.hasSummary);
  const summaryShort = summary?.short || summary?.outcome || '';
  const summaryOutcome = summary?.outcome || '';
  const summaryBullets = Array.isArray(summary?.bullets) ? summary.bullets : [];
  const summaryNextStep = summary?.nextStep || '';
  const summarySentiment = summary?.sentiment;
  const hasNextStep = Boolean(summaryNextStep);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: DT.panelBg,
        border: `1px solid ${DT.panelBorder}`,
      }}
    >
      {/* Main Row */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Icon + Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ 
                background: call.status === 'completed' 
                  ? 'rgba(34,197,94,0.15)' 
                  : call.status === 'failed'
                    ? 'rgba(239,68,68,0.15)'
                    : `rgba(255,106,0,0.15)`,
              }}
            >
              {call.status === 'failed' ? (
                <PhoneOff size={18} className="text-red-400" />
              ) : (
                <Phone size={18} style={{ color: call.status === 'completed' ? '#22c55e' : DT.orange }} />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-medium text-white truncate">
                  {contactName}
                </h4>
                <StatusBadge status={callStatus} />
                <SentimentBadge sentiment={summarySentiment || call.sentiment} />
              </div>
              
              <div className="flex items-center gap-3 mt-1 text-[11px] text-white/50">
                {contactPhone && (
                  <span>{contactPhone}</span>
                )}
                {call?.campaign?.name && (
                  <span className="flex items-center gap-1">
                    <Zap size={10} />
                    {call.campaign.name}
                  </span>
                )}
                {callDuration > 0 && (
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {formatDuration(callDuration)}
                  </span>
                )}
                {timeAgo && <span>{timeAgo}</span>}
              </div>
              
              {/* Summary Preview - 2 lines max (use short or outcome) */}
              {hasSummary && !expanded && summaryShort && (
                <p className="text-[11px] text-white/60 mt-2 line-clamp-2">
                  {summaryShort}
                </p>
              )}
            </div>
          </div>
          
          {/* Right: Expand + Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {(hasAudio || hasTranscript || hasSummary || hasNextStep) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                {expanded ? (
                  <ChevronUp size={16} className="text-white/50" />
                ) : (
                  <ChevronDown size={16} className="text-white/50" />
                )}
              </button>
            )}
          </div>
        </div>
        
        {/* Indicators */}
        <div className="flex items-center gap-2 mt-3">
          {hasAudio && (
            <div className="flex items-center gap-1 text-[9px] text-white/40 px-2 py-1 rounded bg-white/5">
              <Volume2 size={10} />
              <span>Audio</span>
            </div>
          )}
          {hasTranscript && (
            <div className="flex items-center gap-1 text-[9px] text-white/40 px-2 py-1 rounded bg-white/5">
              <FileText size={10} />
              <span>Transkript</span>
            </div>
          )}
          {hasSummary && (
            <div className="flex items-center gap-1 text-[9px] text-white/40 px-2 py-1 rounded bg-white/5">
              <MessageSquare size={10} />
              <span>Zusammenfassung</span>
            </div>
          )}
          {hasNextStep && (
            <div className="flex items-center gap-1 text-[9px] px-2 py-1 rounded" style={{ background: `${DT.orange}15`, color: DT.orange }}>
              <Zap size={10} />
              <span>Nächster Schritt</span>
            </div>
          )}
        </div>
      </div>
      
      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
              {/* Audio Player */}
              {hasAudio && call.audioUrl && (
                <div>
                  <h5 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                    Aufnahme
                  </h5>
                  <AudioPlayer audioUrl={call.audioUrl} />
                </div>
              )}
              
              {/* Summary - renders NormalizedSummary OBJECT with outcome/bullets/nextStep */}
              <div>
                <h5 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                  Zusammenfassung
                </h5>
                {hasSummary ? (
                  <div className="space-y-3">
                    {/* Outcome (Headline) */}
                    {summaryOutcome && (
                      <p className="text-xs text-white/80 leading-relaxed">
                        {summaryOutcome}
                      </p>
                    )}
                    
                    {/* Bullets/Key Points */}
                    {summaryBullets.length > 0 && (
                      <ul className="space-y-1.5">
                        {summaryBullets.slice(0, 6).map((bullet, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px] text-white/60">
                            <span className="text-white/30 mt-0.5">•</span>
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : call.status === 'completed' ? (
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-[11px] text-white/40 italic">
                      Keine Zusammenfassung verfügbar
                    </p>
                    <p className="text-[10px] text-white/30 mt-1">
                      KI-Zusammenfassung wird bei vollständigem Transcript generiert
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-white/30 italic">
                    Zusammenfassung nach Call-Ende verfügbar
                  </p>
                )}
              </div>
              
              {/* Next Step - from summary.nextStep */}
              {hasNextStep && (
                <div 
                  className="p-3 rounded-lg"
                  style={{ background: `${DT.orange}10`, borderLeft: `3px solid ${DT.orange}` }}
                >
                  <h5 className="text-[10px] uppercase tracking-wider mb-1" style={{ color: DT.orange }}>
                    Nächster Schritt
                  </h5>
                  <p className="text-xs text-white/80">
                    {summaryNextStep}
                  </p>
                </div>
              )}
              
              {/* Transcript Preview */}
              {hasTranscript && (
                <div>
                  <h5 className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
                    Transkript
                  </h5>
                  <div className="bg-white/5 rounded-lg p-3 max-h-32 overflow-y-auto">
                    <p className="text-[11px] text-white/60 whitespace-pre-wrap leading-relaxed">
                      {callTranscript.length > 500 
                        ? callTranscript.substring(0, 500) + '...' 
                        : callTranscript
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {onOpenDetails && (
                  <button
                    onClick={() => onOpenDetails(call.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors hover:bg-white/10"
                    style={{ color: DT.orange }}
                  >
                    <ExternalLink size={12} />
                    Details öffnen
                  </button>
                )}
                {call.contact?.id && onOpenContact && (
                  <button
                    onClick={() => onOpenContact(call.contact!.id!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10"
                  >
                    <User size={12} />
                    Kontakt öffnen
                  </button>
                )}
                <a
                  href={`/app/power?call=${call.id}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white/60 transition-colors hover:bg-white/10"
                >
                  <Zap size={12} />
                  In Power öffnen
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default CallCard;
