import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, Play, Pause, Loader2, RotateCcw } from "lucide-react";
import type { CampaignStudioDraft } from "../types";

// ============================================================================
// Voice Personas
// ============================================================================
interface Voice {
  id: string;
  name: string;
  persona: string;
  description: string;
}

const VOICES: Voice[] = [
  { id: 'voice-a', name: 'Aurora', persona: 'Executive • calm', description: 'Perfect for C-level outreach and consultative selling.' },
  { id: 'voice-b', name: 'Noah', persona: 'Friendly • energetic', description: 'Ideal for appointment setting and lead engagement.' },
  { id: 'voice-c', name: 'Mara', persona: 'Direct • sharp', description: 'Best for qualification calls and time-sensitive offers.' },
  { id: 'voice-d', name: 'Elias', persona: 'Warm • consultative', description: 'Great for relationship building and complex solutions.' },
];

const SAMPLE_SCRIPT = `"Hi — quick question. I'm calling because we can take a chunk of outbound calls off your team. If I ask you two things, I can tell you in 30 seconds whether it's a fit. Fair?"`;

const TOTAL_DURATION_MS = 12000;

// ============================================================================
// Component
// ============================================================================
type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface VoiceGalleryStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export default function VoiceGalleryStep({ draft, setDraft, attemptedNext }: VoiceGalleryStepProps) {
  const prefersReducedMotion = useReducedMotion();
  
  // Player state
  const [activeVoiceId, setActiveVoiceId] = useState<string | null>(draft.voiceId || null);
  const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('idle');
  const [progressMs, setProgressMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showError = attemptedNext && !draft.voiceId;

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // Stop playback when switching voices
  const stopPlayback = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setProgressMs(0);
    setPlayerStatus('idle');
  }, []);

  // Handle voice selection
  const handleSelectVoice = useCallback((voice: Voice) => {
    // If switching voice, stop current playback
    if (activeVoiceId !== voice.id) {
      stopPlayback();
    }
    setActiveVoiceId(voice.id);
    setDraft({ voiceId: voice.id });
  }, [activeVoiceId, stopPlayback, setDraft]);

  // Handle play
  const handlePlay = useCallback(() => {
    if (!activeVoiceId) return;
    
    setPlayerStatus('loading');
    
    // Simulate loading delay
    loadingTimeoutRef.current = setTimeout(() => {
      setPlayerStatus('playing');
      
      // Start progress ticker
      intervalRef.current = setInterval(() => {
        setProgressMs(prev => {
          const next = prev + 250;
          if (next >= TOTAL_DURATION_MS) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPlayerStatus('paused');
            return TOTAL_DURATION_MS;
          }
          return next;
        });
      }, 250);
    }, 600);
  }, [activeVoiceId]);

  // Handle pause
  const handlePause = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setPlayerStatus('paused');
  }, []);

  // Handle retry
  const handleRetry = useCallback(() => {
    setProgressMs(0);
    handlePlay();
  }, [handlePlay]);

  // Format time
  const formatTime = (ms: number): string => {
    const secs = Math.floor(ms / 1000);
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  // Get active voice
  const activeVoice = VOICES.find(v => v.id === activeVoiceId);

  // Animation variants
  const cardVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
  };

  const transition = {
    duration: prefersReducedMotion ? 0.08 : 0.18,
    ease: [0.32, 0.72, 0, 1],
  };

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Pick the voice for your campaign</h1>
      <p className="cs-subtitle">
        Preview four ARAS voices. You can refine tone later.
      </p>

      {showError && (
        <p className="cs-field-error cs-field-error--centered">
          Please select a voice to continue.
        </p>
      )}

      <div className="cs-voice-layout">
        {/* Voice Cards Grid */}
        <div className="cs-voice-grid">
          {VOICES.map((voice) => {
            const isSelected = draft.voiceId === voice.id;
            const isActive = activeVoiceId === voice.id;

            return (
              <button
                key={voice.id}
                type="button"
                className={`cs-voice-card ${isSelected ? 'cs-voice-card--selected' : ''} ${isActive ? 'cs-voice-card--active' : ''}`}
                onClick={() => handleSelectVoice(voice)}
                aria-pressed={isSelected}
              >
                {/* Selected badge */}
                {isSelected && (
                  <span className="cs-voice-badge cs-voice-badge--selected">
                    <Check size={12} strokeWidth={2.5} />
                    Selected
                  </span>
                )}

                {/* Avatar */}
                <div className="cs-voice-avatar">
                  {voice.name.charAt(0)}
                </div>

                {/* Info */}
                <div className="cs-voice-info">
                  <span className="cs-voice-name">{voice.name}</span>
                  <span className="cs-voice-persona">{voice.persona}</span>
                </div>

                {/* Preview hint */}
                <span className="cs-voice-preview-hint">
                  <Play size={12} />
                  Preview
                </span>
              </button>
            );
          })}
        </div>

        {/* Preview Panel */}
        <div className="cs-voice-preview">
          <AnimatePresence mode="wait">
            {activeVoice ? (
              <motion.div
                key={activeVoice.id}
                className="cs-voice-preview-content"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={transition}
              >
                {/* Header */}
                <div className="cs-voice-preview-header">
                  <div className="cs-voice-preview-avatar">
                    {activeVoice.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="cs-voice-preview-name">{activeVoice.name}</h3>
                    <p className="cs-voice-preview-persona">{activeVoice.persona}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="cs-voice-preview-desc">{activeVoice.description}</p>

                {/* Sample script */}
                <div className="cs-voice-preview-script">
                  <span className="cs-voice-preview-script-label">Sample</span>
                  <p className="cs-voice-preview-script-text">{SAMPLE_SCRIPT}</p>
                </div>

                {/* Player Controls */}
                <div className="cs-voice-player">
                  {playerStatus === 'error' ? (
                    <div className="cs-voice-player-error">
                      <span>Preview unavailable. Try again.</span>
                      <button
                        type="button"
                        className="cs-voice-player-retry"
                        onClick={handleRetry}
                        aria-label="Retry preview"
                      >
                        <RotateCcw size={14} />
                        Retry
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Play/Pause Button */}
                      <button
                        type="button"
                        className="cs-voice-player-btn"
                        onClick={playerStatus === 'playing' ? handlePause : handlePlay}
                        disabled={playerStatus === 'loading'}
                        aria-label={playerStatus === 'playing' ? 'Pause preview' : 'Play preview'}
                      >
                        {playerStatus === 'loading' ? (
                          <Loader2 size={18} className="cs-spin" />
                        ) : playerStatus === 'playing' ? (
                          <Pause size={18} />
                        ) : (
                          <Play size={18} />
                        )}
                      </button>

                      {/* Timeline */}
                      <div className="cs-voice-player-timeline">
                        <div 
                          className="cs-voice-player-progress"
                          style={{ width: `${(progressMs / TOTAL_DURATION_MS) * 100}%` }}
                        />
                      </div>

                      {/* Time */}
                      <span className="cs-voice-player-time">
                        {formatTime(progressMs)} / {formatTime(TOTAL_DURATION_MS)}
                      </span>
                    </>
                  )}
                </div>

                {/* Status text */}
                {playerStatus === 'loading' && (
                  <p className="cs-voice-player-status">Generating preview…</p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                className="cs-voice-preview-idle"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                exit="hidden"
                transition={transition}
              >
                <Play size={24} strokeWidth={1.5} />
                <span>Select a voice to preview.</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
