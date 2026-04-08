import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

// ═══════════════════════════════════════════════════════════════
// ARAS VOICE LAB - Experimental Voice Command Interface
// ═══════════════════════════════════════════════════════════════

// ARAS CI Colors
const CI = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
  goldDark: '#a34e00',
  dark: '#0a0a0a',
  panel: 'rgba(255,255,255,0.02)',
  border: 'rgba(255,255,255,0.06)',
};

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  action?: {
    type: 'call' | 'schedule' | 'search' | 'info';
    status: 'pending' | 'executing' | 'completed' | 'failed';
    details?: string;
  };
}

interface ConversationSummary {
  summary: string;
  actionRequired: boolean;
  suggestedAction?: string;
}

export default function ArasLab() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  
  // Messages & Summary
  const [messages, setMessages] = useState<Message[]>([]);
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  
  // Audio refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Audio level visualization
  const updateAudioLevel = useCallback(() => {
    if (analyserRef.current && isRecording) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      setAudioLevel(average / 255);
      animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
    }
  }, [isRecording]);

  // Start recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Setup audio analysis
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);
      
      // Setup MediaRecorder
      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
      updateAudioLevel();
      
    } catch (error) {
      console.error('Microphone access error:', error);
      toast({
        title: 'Mikrofon-Fehler',
        description: 'Bitte erlaube den Zugriff auf dein Mikrofon.',
        variant: 'destructive'
      });
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setAudioLevel(0);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  };

  // Process audio with Whisper
  const processAudio = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      const response = await fetch('/api/aras-lab/process', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!response.ok) throw new Error('Processing failed');
      
      const data = await response.json();
      
      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: data.transcript,
        timestamp: new Date()
      };
      
      // Add assistant response
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.response,
        timestamp: new Date(),
        action: data.action
      };
      
      setMessages(prev => [...prev, userMessage, assistantMessage]);
      
      // Update summary if provided
      if (data.summary) {
        setSummary(data.summary);
      }
      
      // Play TTS response
      if (data.audioUrl) {
        await playAudioResponse(data.audioUrl);
      }
      
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: 'Verarbeitungsfehler',
        description: 'Deine Anfrage konnte nicht verarbeitet werden.',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Play TTS audio
  const playAudioResponse = async (audioUrl: string) => {
    setIsSpeaking(true);
    try {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsSpeaking(false);
      await audio.play();
    } catch (error) {
      console.error('Audio playback error:', error);
      setIsSpeaking(false);
    }
  };

  // Toggle recording
  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Action badge component
  const ActionBadge = ({ action }: { action: Message['action'] }) => {
    if (!action) return null;
    
    const icons: Record<string, string> = {
      call: '📞',
      schedule: '📅',
      search: '🔍',
      info: 'ℹ️'
    };
    
    const statusColors: Record<string, string> = {
      pending: 'rgba(255,193,7,0.2)',
      executing: 'rgba(33,150,243,0.2)',
      completed: 'rgba(76,175,80,0.2)',
      failed: 'rgba(244,67,54,0.2)'
    };
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mt-2"
        style={{ background: statusColors[action.status], color: CI.gold }}
      >
        <span>{icons[action.type]}</span>
        <span>{action.details || action.type}</span>
        {action.status === 'executing' && (
          <motion.div
            className="w-2 h-2 rounded-full"
            style={{ background: CI.orange }}
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>
    );
  };

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ background: `linear-gradient(180deg, ${CI.dark} 0%, #111 100%)` }}
    >
      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${CI.border}` }}>
        <div>
          <h1 className="text-lg font-bold" style={{ color: CI.gold }}>ARAS Lab</h1>
          <p className="text-xs text-neutral-500">Experimental Voice Interface</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: CI.orange }} />
          <span className="text-xs text-neutral-500">Prototype v0.1</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 overflow-hidden">
        
        {/* Left: Microphone & Waveform */}
        <div className="lg:w-1/2 flex flex-col items-center justify-center gap-8">
          
          {/* Status Text */}
          <motion.p
            key={isRecording ? 'recording' : isProcessing ? 'processing' : isSpeaking ? 'speaking' : 'idle'}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-medium uppercase tracking-wider"
            style={{ color: isRecording ? CI.orange : CI.gold }}
          >
            {isRecording ? 'Ich höre zu...' : isProcessing ? 'Verarbeite...' : isSpeaking ? 'ARAS spricht...' : 'Tippe zum Sprechen'}
          </motion.p>

          {/* Microphone Button */}
          <div className="relative">
            {/* Outer glow rings */}
            <AnimatePresence>
              {(isRecording || isSpeaking) && (
                <>
                  {[1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${isRecording ? CI.orange : CI.gold}` }}
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ 
                        scale: 1 + (i * 0.3) + (audioLevel * 0.5), 
                        opacity: 0 
                      }}
                      transition={{ 
                        duration: 1.5, 
                        repeat: Infinity, 
                        delay: i * 0.3,
                        ease: 'easeOut'
                      }}
                    />
                  ))}
                </>
              )}
            </AnimatePresence>
            
            {/* Main button */}
            <motion.button
              onClick={toggleRecording}
              disabled={isProcessing}
              className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center transition-all disabled:opacity-50"
              style={{
                background: isRecording 
                  ? `radial-gradient(circle, ${CI.orange} 0%, ${CI.goldDark} 100%)`
                  : `radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)`,
                border: `2px solid ${isRecording ? CI.orange : 'rgba(255,255,255,0.1)'}`,
                boxShadow: isRecording 
                  ? `0 0 60px ${CI.orange}40, 0 0 120px ${CI.orange}20`
                  : '0 0 40px rgba(0,0,0,0.5)'
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={isProcessing ? { opacity: [1, 0.6, 1] } : {}}
              transition={isProcessing ? { duration: 1, repeat: Infinity } : {}}
            >
              {/* Microphone Icon */}
              <svg 
                width="48" 
                height="48" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={isRecording ? '#000' : CI.gold}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" x2="12" y1="19" y2="22" />
              </svg>
            </motion.button>
          </div>

          {/* Waveform Visualization */}
          <div className="w-full max-w-xs h-16 flex items-center justify-center gap-1">
            {Array.from({ length: 20 }).map((_, i) => (
              <motion.div
                key={i}
                className="w-1 rounded-full"
                style={{ background: CI.orange }}
                animate={{
                  height: isRecording 
                    ? `${Math.max(8, Math.random() * 60 * (audioLevel + 0.3))}px`
                    : '4px',
                  opacity: isRecording ? 0.8 : 0.2
                }}
                transition={{ duration: 0.1 }}
              />
            ))}
          </div>

          {/* Quick Hint */}
          <p className="text-xs text-neutral-600 text-center max-w-sm">
            Sage z.B. <span style={{ color: CI.gold }}>"Rufe Martin an"</span> oder <span style={{ color: CI.gold }}>"Verschiebe mein Meeting auf morgen"</span>
          </p>
        </div>

        {/* Right: Chat History & Summary */}
        <div className="lg:w-1/2 flex flex-col gap-4 min-h-0">
          
          {/* Summary Card */}
          <AnimatePresence>
            {summary && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="p-4 rounded-2xl"
                style={{ 
                  background: summary.actionRequired 
                    ? 'rgba(255,106,0,0.1)' 
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${summary.actionRequired ? 'rgba(255,106,0,0.3)' : CI.border}`
                }}
              >
                <div className="flex items-start gap-3">
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: summary.actionRequired ? CI.orange : 'rgba(255,255,255,0.05)' }}
                  >
                    {summary.actionRequired ? '⚡' : '📋'}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-neutral-500 mb-1">
                      {summary.actionRequired ? 'Handlung erforderlich' : 'Zusammenfassung'}
                    </p>
                    <p className="text-sm" style={{ color: CI.gold }}>{summary.summary}</p>
                    {summary.suggestedAction && (
                      <button 
                        className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: CI.orange, color: '#000' }}
                      >
                        {summary.suggestedAction}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Messages */}
          <div 
            className="flex-1 overflow-y-auto rounded-2xl p-4 space-y-4"
            style={{ background: CI.panel, border: `1px solid ${CI.border}` }}
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,106,0,0.1)' }}>
                  <span className="text-2xl">🎙️</span>
                </div>
                <p className="text-sm font-medium" style={{ color: CI.gold }}>Noch keine Konversation</p>
                <p className="text-xs text-neutral-500 mt-1">Sprich mit ARAS um zu starten</p>
              </div>
            ) : (
              messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-[85%]">
                    <div
                      className={`px-4 py-3 rounded-2xl text-sm ${
                        message.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md'
                      }`}
                      style={{
                        background: message.role === 'user'
                          ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`
                          : 'rgba(255,255,255,0.05)',
                        color: message.role === 'user' ? '#000' : CI.gold,
                        border: message.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.08)'
                      }}
                    >
                      {message.content}
                    </div>
                    {message.action && <ActionBadge action={message.action} />}
                    <p className="text-[10px] text-neutral-600 mt-1 px-1">
                      {message.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-6 py-3 text-center" style={{ borderTop: `1px solid ${CI.border}` }}>
        <p className="text-[10px] text-neutral-600">
          ARAS Lab • Whisper STT • Gemini Intent • ElevenLabs TTS
        </p>
      </footer>
    </div>
  );
}
