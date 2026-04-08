import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// Design Tokens (2026 Control Room - No Icons)
const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  goldDark: '#a34e00',
  panelBg: 'rgba(0,0,0,0.35)',
  panelBorder: 'rgba(255,255,255,0.10)',
  glow: '0 0 0 1px rgba(255,106,0,0.18), 0 0 22px rgba(255,106,0,0.10)',
};

// Legacy CI alias
const CI = {
  goldLight: DT.gold,
  orange: DT.orange,
  goldDark: DT.goldDark
};

// ═══════════════════════════════════════════════════════════════
// TRANSCRIPT NORMALIZER - Handles all possible formats robustly
// ═══════════════════════════════════════════════════════════════
interface TranscriptMessage {
  role: 'user' | 'agent' | 'system';
  text: string;
  ts?: number;
}

interface NormalizedTranscript {
  text: string;                    // Always a clean string
  messages: TranscriptMessage[];   // Parsed messages if available
  isProcessing: boolean;           // True if transcript not yet ready
}

function normalizeTranscript(raw: any): NormalizedTranscript {
  // Case 0: null/undefined/empty
  if (!raw || (typeof raw === 'string' && raw.trim() === '')) {
    return { text: '', messages: [], isProcessing: true };
  }

  // Case 1: Already a clean string
  if (typeof raw === 'string') {
    // Try to parse as JSON first (might be JSON string)
    try {
      const parsed = JSON.parse(raw);
      return normalizeTranscript(parsed); // Recurse with parsed object
    } catch {
      // Not JSON, it's a plain string - clean it up
      const cleaned = raw.trim();
      if (cleaned.length < 10) {
        return { text: cleaned, messages: [], isProcessing: true };
      }
      return { text: cleaned, messages: [], isProcessing: false };
    }
  }

  // Case 2: Array of messages/segments
  if (Array.isArray(raw)) {
    const messages: TranscriptMessage[] = [];
    const textParts: string[] = [];

    for (const item of raw) {
      if (typeof item === 'string') {
        textParts.push(item);
        continue;
      }
      
      // Handle various message formats from different APIs
      const role = item.role || item.speaker || item.type || 'system';
      const text = item.message || item.text || item.content || item.transcript || '';
      
      if (text && typeof text === 'string' && text.trim()) {
        const normalizedRole = 
          role === 'assistant' || role === 'agent' || role === 'ai' || role === 'bot' ? 'agent' :
          role === 'user' || role === 'human' || role === 'customer' ? 'user' : 'system';
        
        messages.push({ role: normalizedRole as any, text: text.trim(), ts: item.timestamp || item.ts });
        
        const label = normalizedRole === 'agent' ? 'ARAS' : normalizedRole === 'user' ? 'Kunde' : 'System';
        textParts.push(`[${label}]: ${text.trim()}`);
      }
    }

    const finalText = textParts.join('\n\n');
    return {
      text: finalText,
      messages,
      isProcessing: finalText.length < 10
    };
  }

  // Case 3: Object with transcript/messages property
  if (typeof raw === 'object') {
    // Check common property names
    const nested = raw.transcript || raw.messages || raw.segments || raw.turns || raw.conversation;
    if (nested) {
      return normalizeTranscript(nested);
    }
    
    // Single message object
    if (raw.text || raw.message || raw.content) {
      const text = raw.text || raw.message || raw.content;
      return { text: String(text), messages: [], isProcessing: false };
    }
    
    // Fallback: stringify but mark as potentially processing
    try {
      const str = JSON.stringify(raw, null, 2);
      return { text: str, messages: [], isProcessing: true };
    } catch {
      return { text: '[Transkript konnte nicht gelesen werden]', messages: [], isProcessing: true };
    }
  }

  return { text: '', messages: [], isProcessing: true };
}

interface CallSummary {
  outcome: string;
  bulletPoints: string[];
  nextStep: string;
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  tags: string[];
}

interface PowerResultCardProps {
  result: {
    id?: string | number;
    callId?: string | number;
    recordingUrl?: string | null;
    transcript?: any;  // Can be string, array, object - we normalize it
    duration?: number | null;
    phoneNumber?: string;
    contactName?: string;
  } | null;
  summary?: CallSummary | null;
  linkedContact?: { id: number; name: string; company?: string } | null;
  onNewCall: () => void;
  onRefresh?: () => void;  // NEW: For refreshing call details
  onLinkToContact?: (phoneNumber: string, contactName?: string) => void;
  onSaveAsNewContact?: (phoneNumber: string, contactName?: string) => void;
}

export function PowerResultCard({
  result,
  summary,
  linkedContact,
  onNewCall,
  onRefresh,
  onLinkToContact,
  onSaveAsNewContact
}: PowerResultCardProps) {
  const [audioError, setAudioError] = useState(false);
  const [downloadingAudio, setDownloadingAudio] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const autoRefreshRef = useRef<NodeJS.Timeout | null>(null);

  // Normalize transcript once
  const normalizedTranscript = useMemo(() => 
    normalizeTranscript(result?.transcript), 
    [result?.transcript]
  );

  // Determine if summary is pending (no summary but onRefresh available)
  const isPending = !summary && typeof onRefresh === 'function' && (result?.id || result?.callId);

  // Auto-refresh when pending - poll every 6s until summary arrives
  useEffect(() => {
    if (isPending && !autoRefreshRef.current) {
      autoRefreshRef.current = setInterval(() => {
        onRefresh?.();
      }, 6000);
    } else if (!isPending && autoRefreshRef.current) {
      clearInterval(autoRefreshRef.current);
      autoRefreshRef.current = null;
    }

    return () => {
      if (autoRefreshRef.current) {
        clearInterval(autoRefreshRef.current);
        autoRefreshRef.current = null;
      }
    };
  }, [isPending, onRefresh]);

  if (!result) return null;

  // Copy transcript to clipboard
  const handleCopyTranscript = async () => {
    if (!normalizedTranscript.text) return;
    try {
      await navigator.clipboard.writeText(normalizedTranscript.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  // Download recording via SAFE server endpoint (always same-origin, no CORS issues)
  const handleDownloadRecording = async () => {
    const callId = result.id || result.callId;
    if (!callId) {
      setDownloadError('Keine Call-ID verfügbar');
      return;
    }
    
    setDownloadingAudio(true);
    setDownloadError(null);
    
    try {
      // Use safe download endpoint - server handles CORS/auth/proxy
      const response = await fetch(`/api/aras-voice/call-recording/${callId}/download`, { 
        credentials: 'include' 
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`);
      }
      
      const blob = await response.blob();
      
      // Get filename from Content-Disposition header or generate
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `ARAS_CALL_${callId}.mp3`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      // Trigger download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Download failed:', err);
      setDownloadError(err.message || 'Download fehlgeschlagen');
    } finally {
      setDownloadingAudio(false);
    }
  };

  // Format duration with client-side normalization (handles ms vs sec if server missed it)
  const formatDuration = (rawSeconds: number) => {
    // Client-side safety: if >= 10000, likely ms not seconds
    const seconds = rawSeconds >= 10000 ? Math.round(rawSeconds / 1000) : Math.round(rawSeconds);
    if (seconds < 0) return '—';
    
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')} Std`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')} Min`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl p-6"
      style={{
        background: 'rgba(8,8,8,0.85)',
        border: '1px solid rgba(233,215,196,0.15)',
        backdropFilter: 'blur(16px)'
      }}
    >
      <div className="space-y-4">
        {/* Header */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="mb-3 mx-auto h-12 w-12 rounded-full flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 30% 20%, rgba(34,197,94,0.85), rgba(10,10,10,0.1) 70%)',
              boxShadow: '0 0 22px rgba(34,197,94,0.45)',
              border: '1px solid rgba(34,197,94,0.30)'
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="h-3 w-3 rounded-full bg-white/70" />
          </motion.div>

          <h3 
            className="text-xl font-black mb-2"
            style={{
              fontFamily: 'Orbitron, sans-serif',
              background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange})`,
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
          >
            Call erfolgreich!
          </h3>
          <p className="text-sm text-gray-300">ARAS hat den Anruf abgeschlossen</p>
          
          {result.duration != null && (
            <div className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold"
              style={{
                background: 'rgba(34,197,94,0.12)',
                border: '1px solid rgba(34,197,94,0.25)',
                color: '#4ade80'
              }}
            >
              Dauer: {formatDuration(result.duration)}
            </div>
          )}
        </motion.div>

        {/* Summary Panel */}
        <div data-mission-section="summary" className="scroll-mt-[140px]">
        {summary ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl px-4 py-4 relative overflow-hidden"
            style={{
              background: 'rgba(10,10,10,0.92)',
              border: '1px solid rgba(254,145,0,0.15)',
              backdropFilter: 'blur(14px)'
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.3), rgba(233,215,196,0.2), rgba(254,145,0,0.3), transparent)'
              }}
            />
            <h4 className="text-[11px] font-bold uppercase tracking-[0.15em] mb-3" style={{ color: DT.gold }}>
              Zusammenfassung
            </h4>
            
            {/* Outcome */}
            <p className="text-sm text-neutral-200 mb-3 leading-relaxed">{summary.outcome}</p>
            
            {/* Bullet Points - CSS dots only */}
            {summary.bulletPoints && summary.bulletPoints.length > 0 && (
              <ul className="space-y-2 mb-3">
                {summary.bulletPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-neutral-400">
                    <span 
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                      style={{ background: `linear-gradient(135deg, ${DT.orange}, ${DT.gold})` }}
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
            
            {/* Next Step */}
            {summary.nextStep && (
              <div className="text-xs px-3 py-2.5 rounded-[12px]" style={{ background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.15)' }}>
                <span className="font-semibold block mb-1 text-[10px] uppercase tracking-wide" style={{ color: DT.orange }}>Nächster Schritt</span>
                <span className="text-neutral-300">{summary.nextStep}</span>
              </div>
            )}
            
            {/* Tags & Sentiment - No Emojis */}
            {(summary.tags?.length > 0 || summary.sentiment) && (
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {summary.sentiment && (
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium uppercase tracking-wide ${
                    summary.sentiment === 'positive' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    summary.sentiment === 'negative' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                    'bg-neutral-500/10 text-neutral-400 border border-neutral-500/20'
                  }`}>
                    {summary.sentiment === 'positive' ? 'Positiv' : 
                     summary.sentiment === 'negative' ? 'Negativ' : 
                     summary.sentiment === 'mixed' ? 'Gemischt' : 'Neutral'}
                  </span>
                )}
                {summary.tags?.map((tag, i) => (
                  <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-neutral-500 border border-white/[0.08]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ) : onRefresh ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-[16px] px-4 py-4 relative overflow-hidden"
            style={{
              background: 'rgba(10,10,10,0.92)',
              border: `1px solid ${DT.panelBorder}`,
              backdropFilter: 'blur(14px)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <span className="w-3 h-3 rounded-full border border-neutral-500 border-t-transparent animate-spin" />
                  <span>Zusammenfassung wird erstellt...</span>
                </div>
                <p className="text-[10px] text-neutral-600 mt-1 ml-5">Aktualisiert automatisch</p>
              </div>
              <button
                onClick={onRefresh}
                className="text-[10px] px-3 py-1.5 rounded-[8px] font-medium hover:bg-white/5 transition-colors"
                style={{ color: DT.orange }}
              >
                Aktualisieren
              </button>
            </div>
          </motion.div>
        ) : null}
        </div>

        {/* Audio Recording - No Icons */}
        <div data-mission-section="audio" className="scroll-mt-[140px]">
        {(result.recordingUrl || result.id || result.callId) ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-[16px] px-4 py-3 relative overflow-hidden"
            style={{
              background: 'rgba(10,10,10,0.92)',
              border: `1px solid ${DT.panelBorder}`,
              backdropFilter: 'blur(14px)'
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 h-px"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(255,106,0,0.15), rgba(233,215,196,0.15), rgba(255,106,0,0.15), transparent)'
              }}
            />
            <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-2">
              <span className="uppercase tracking-wide">Aufzeichnung</span>
              <div className="flex items-center gap-3">
                {result.duration != null && (
                  <span className="font-mono">{formatDuration(result.duration)}</span>
                )}
                {/* Download Button - Text only */}
                <button
                  onClick={handleDownloadRecording}
                  disabled={downloadingAudio}
                  className="px-3 py-1.5 rounded-[8px] text-[10px] font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
                  style={{
                    background: 'rgba(255,106,0,0.12)',
                    border: '1px solid rgba(255,106,0,0.25)',
                    color: DT.orange
                  }}
                >
                  {downloadingAudio ? 'Lädt...' : 'Download'}
                </button>
              </div>
            </div>
            {result.recordingUrl ? (
              <audio
                controls
                className="w-full"
                src={result.recordingUrl}
                style={{
                  height: '40px',
                  borderRadius: '8px',
                  filter: 'invert(0.85)'
                }}
                onError={() => setAudioError(true)}
              />
            ) : (
              <p className="text-[10px] text-neutral-500 py-2">
                Audio-Player nicht verfügbar. Nutze den Download-Button.
              </p>
            )}
            {audioError && (
              <p className="mt-2 text-[10px] text-red-400">
                Die Aufzeichnung konnte nicht geladen werden.
              </p>
            )}
            {downloadError && (
              <p className="mt-2 text-[10px] text-red-400">
                Download-Fehler: {downloadError}
              </p>
            )}
          </motion.div>
        ) : (
          <p className="text-[11px] text-neutral-500 px-2">
            Keine Aufzeichnung verfügbar.
          </p>
        )}
        </div>

        {/* ARAS Core Summary */}
        {summary ? (
          <motion.div
            className="rounded-2xl p-4 md:p-5 relative overflow-hidden"
            style={{
              background: 'rgba(10,10,10,0.88)',
              borderRadius: 18,
              border: '1px solid rgba(255,255,255,0.06)'
            }}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* Animated border shimmer */}
            <div
              className="pointer-events-none absolute inset-[-1px] rounded-2xl"
              style={{
                backgroundImage: 'linear-gradient(120deg, rgba(233,215,196,0.0), rgba(254,145,0,0.45), rgba(233,215,196,0.0))',
                backgroundSize: '200% 100%',
                opacity: 0.35,
                animation: 'aras-border-run 10s linear infinite'
              }}
            />

            <div className="relative space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                    Zusammenfassung von ARAS
                  </div>
                  <div
                    className="mt-1 text-[15px] font-semibold"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      letterSpacing: '0.01em',
                      color: '#e5e7eb'
                    }}
                  >
                    {summary.outcome}
                  </div>
                </div>

                {/* Sentiment-Badge - Modern mit Green-Gold Gradient */}
                <div
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold uppercase tracking-wider flex-shrink-0"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background:
                      summary.sentiment === 'positive'
                        ? 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(233,215,196,0.08))'
                        : summary.sentiment === 'negative'
                        ? 'linear-gradient(135deg, rgba(248,113,113,0.1), rgba(254,145,0,0.08))'
                        : 'rgba(64,64,64,0.3)',
                    border:
                      summary.sentiment === 'positive'
                        ? '1px solid rgba(34,197,94,0.3)'
                        : summary.sentiment === 'negative'
                        ? '1px solid rgba(248,113,113,0.3)'
                        : '1px solid rgba(100,100,100,0.4)',
                    color:
                      summary.sentiment === 'positive'
                        ? '#4ade80'
                        : summary.sentiment === 'negative'
                        ? '#fca5a5'
                        : '#a8a8a8'
                  }}
                >
                  {summary.sentiment === 'positive' && 'Positiv'}
                  {summary.sentiment === 'negative' && 'Kritisch'}
                  {summary.sentiment === 'neutral' && 'Neutral'}
                  {summary.sentiment === 'mixed' && 'Gemischt'}
                </div>
              </div>

              {/* Bulletpoints - Radial Gradient Dots */}
              {summary.bulletPoints?.length > 0 && (
                <ul className="mt-2 space-y-1.5 text-xs text-neutral-300">
                  {summary.bulletPoints.map((bp, idx) => (
                    <li key={idx} className="flex gap-2.5">
                      <span
                        className="mt-[3px] h-[7px] w-[7px] rounded-full flex-shrink-0"
                        style={{
                          background: 'radial-gradient(circle at 30% 30%, #FE9100, #E9D7C4)',
                          boxShadow: '0 0 4px rgba(254,145,0,0.4)'
                        }}
                      />
                      <span>{bp}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Next Step - Custom Border + Task Action */}
              {summary.nextStep && (
                <div
                  className="mt-3 rounded-xl px-3 py-2.5 text-xs text-neutral-200"
                  style={{
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(254,145,0,0.25)',
                    borderLeft: '3px solid rgba(254,145,0,0.65)',
                    boxShadow: '0 0 12px rgba(254,145,0,0.08)'
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span
                        className="text-[10px] uppercase tracking-wider font-semibold block mb-1"
                        style={{
                          color: '#FE9100',
                          fontFamily: 'Orbitron, sans-serif'
                        }}
                      >
                        → NÄCHSTER SCHRITT
                      </span>
                      <span className="leading-relaxed">{summary.nextStep}</span>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetch('/api/user/tasks', {
                            method: 'POST',
                            credentials: 'include',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              title: summary.nextStep.slice(0, 180),
                              sourceType: 'call',
                              sourceId: String(result.callId || result.id),
                            }),
                          });
                          if (res.status === 409) {
                            alert('Aufgabe existiert bereits');
                          } else if (res.ok) {
                            alert('Aufgabe erstellt');
                          }
                        } catch (err) {
                          console.error('Failed to create task:', err);
                        }
                      }}
                      className="flex-shrink-0 text-[9px] font-medium px-2 py-1 rounded-lg transition-all hover:bg-white/[0.08]"
                      style={{ color: DT.orange, border: '1px solid rgba(255,106,0,0.25)' }}
                    >
                      Als Aufgabe
                    </button>
                  </div>
                </div>
              )}

              {/* Tags */}
              {summary.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {summary.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] bg-black/60 text-neutral-400 border border-white/10"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <p className="mt-4 text-[11px] text-neutral-500 px-2">
            Die automatische Zusammenfassung ist aktuell nicht verfügbar.
            Du kannst dir das Transkript und die Aufzeichnung trotzdem ansehen.
          </p>
        )}

        {/* Transkript - Normalized & with Actions */}
        <div data-mission-section="transcript" className="scroll-mt-[140px]">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl p-4"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: DT.gold }}>
              Transkript
            </span>
            <div className="flex items-center gap-2">
              {/* Refresh Button - Text only */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="px-3 py-1.5 rounded-[8px] text-[10px] font-medium transition-all hover:bg-white/[0.06]"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${DT.panelBorder}`,
                    color: '#9ca3af'
                  }}
                >
                  Aktualisieren
                </button>
              )}
              {/* Copy Button - Text only */}
              {normalizedTranscript.text && (
                <button
                  onClick={handleCopyTranscript}
                  className="px-3 py-1.5 rounded-[8px] text-[10px] font-medium transition-all hover:scale-[1.02]"
                  style={{
                    background: copied ? 'rgba(34,197,94,0.12)' : 'rgba(255,106,0,0.12)',
                    border: copied ? '1px solid rgba(34,197,94,0.25)' : '1px solid rgba(255,106,0,0.25)',
                    color: copied ? '#4ade80' : DT.orange
                  }}
                >
                  {copied ? 'Kopiert' : 'Kopieren'}
                </button>
              )}
            </div>
          </div>
          
          <div 
            className="p-4 rounded-[12px] overflow-y-auto"
            style={{ 
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${DT.panelBorder}`,
              maxHeight: '350px'
            }}
          >
            {normalizedTranscript.isProcessing && !normalizedTranscript.text ? (
              <div className="flex items-center gap-3 text-neutral-400">
                <span className="w-4 h-4 rounded-full border border-neutral-500 border-t-transparent animate-spin" />
                <span className="text-xs">Transkript wird verarbeitet...</span>
              </div>
            ) : normalizedTranscript.messages.length > 0 ? (
              /* Chat-style rendering - CSS dots instead of icons */
              <div className="space-y-3">
                {normalizedTranscript.messages.map((msg, idx) => (
                  <div 
                    key={idx} 
                    className={`flex gap-2 ${msg.role === 'agent' ? '' : 'flex-row-reverse'}`}
                  >
                    <div 
                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold"
                      style={{
                        background: msg.role === 'agent' 
                          ? `linear-gradient(135deg, ${DT.orange}40, ${DT.goldDark}40)` 
                          : 'rgba(255,255,255,0.08)',
                        border: msg.role === 'agent' 
                          ? '1px solid rgba(255,106,0,0.35)' 
                          : `1px solid ${DT.panelBorder}`,
                        color: msg.role === 'agent' ? DT.orange : '#888'
                      }}
                    >
                      {msg.role === 'agent' ? 'A' : 'K'}
                    </div>
                    <div 
                      className={`flex-1 px-3 py-2 rounded-[10px] text-xs leading-relaxed ${
                        msg.role === 'agent' ? 'text-right' : ''
                      }`}
                      style={{
                        background: msg.role === 'agent' 
                          ? 'rgba(255,106,0,0.06)' 
                          : 'rgba(255,255,255,0.04)',
                        border: msg.role === 'agent' 
                          ? '1px solid rgba(255,106,0,0.12)' 
                          : `1px solid ${DT.panelBorder}`,
                        color: msg.role === 'agent' ? DT.gold : '#d1d5db'
                      }}
                    >
                      <div className="text-[9px] uppercase tracking-wider mb-1 opacity-50">
                        {msg.role === 'agent' ? 'ARAS' : 'Kunde'}
                      </div>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : normalizedTranscript.text ? (
              /* Plain text rendering */
              <pre className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                {normalizedTranscript.text}
              </pre>
            ) : (
              <p className="text-xs text-neutral-500">
                Kein Transkript verfügbar.
              </p>
            )}
          </div>
        </motion.div>
        </div>

        {/* Next Step Section Marker */}
        {summary?.nextStep && (
          <div data-mission-section="nextstep" className="scroll-mt-[140px]" />
        )}

        {/* Contact Verknüpfung - No emoji comment */}
        {result.phoneNumber && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="p-4 rounded-[14px]"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: `1px solid ${DT.panelBorder}`
            }}
          >
            {linkedContact ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Verknüpft mit</div>
                  <div className="text-sm font-semibold text-white">
                    {linkedContact.name}
                    {linkedContact.company && (
                      <span className="text-xs text-gray-400 ml-2">({linkedContact.company})</span>
                    )}
                  </div>
                </div>
                <div className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80' }}>Gespeichert</div>
              </div>
            ) : (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: DT.gold }}>
                  Kontakt zuordnen
                </div>
                <div className="flex gap-2">
                  {onSaveAsNewContact && (
                    <button
                      onClick={() => onSaveAsNewContact(result.phoneNumber!, result.contactName)}
                      className="flex-1 px-4 py-2.5 rounded-[10px] text-xs font-semibold transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(255,106,0,0.10)',
                        border: '1px solid rgba(255,106,0,0.20)',
                        color: DT.orange
                      }}
                    >
                      Als neuen Kontakt
                    </button>
                  )}
                  {onLinkToContact && (
                    <button
                      onClick={() => onLinkToContact(result.phoneNumber!, result.contactName)}
                      className="flex-1 px-4 py-2.5 rounded-[10px] text-xs font-semibold transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${DT.panelBorder}`,
                        color: '#d1d5db'
                      }}
                    >
                      Verknüpfen
                    </button>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex gap-3 pt-2"
        >
          <button
            onClick={onNewCall}
            className="flex-1 px-6 py-[14px] rounded-[16px] font-bold text-sm transition-all hover:translate-y-[-1px] relative overflow-hidden"
            style={{
              background: `linear-gradient(135deg, ${DT.orange}, ${DT.goldDark})`,
              color: '#000',
              fontFamily: 'Orbitron, sans-serif',
              boxShadow: DT.glow
            }}
          >
            Neuer POWER Call
          </button>
        </motion.div>

        {/* Notification Hint - No emoji */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-3 text-center text-[10px] text-neutral-500"
        >
          Automatische Benachrichtigung bei Abschluss des nächsten Calls
        </motion.p>
      </div>
    </motion.div>
  );
}
