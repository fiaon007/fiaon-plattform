/**
 * ============================================================================
 * CEO MIND-OS — PREMIUM HIGH-END DASHBOARD
 * ============================================================================
 * Design Philosophy: LUXUS, EDEL, CLEAN - WOW-Moment beim Öffnen
 * - Dark Premium Theme mit animierten Farbverläufen
 * - Morning Briefing: Prominent, eigenes Luxus-Design
 * - Keine bunten Icons, monochrome Eleganz
 * - Glassmorphism 4.0: Noch subtiler, noch edler
 * - Auto-Expand neue Strategien (Bug Fix)
 * - Perfekt responsive: Mobile & Desktop
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  X,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Clock,
  Target,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface CeoAnalysis {
  summary: string;
  followUpQuestion: string;
  roiCheck: string;
  nextSteps: string[];
  category: string;
  magicTemplate: string | null;
  resources: Array<{ label: string; url: string; type: string }>;
  confidence: number;
  meta?: {
    model?: string;
    usedWebSearch?: boolean;
    searchQuery?: string;
    durationMs?: number;
  };
}

interface CeoStrategy {
  id: string;
  userThought: string;
  aiAnalysis?: CeoAnalysis | null;
  category?: string | null;
  status: "active" | "done" | "failed" | "archived";
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InboundMail {
  id: string;
  sender: string;
  subject: string;
  contentSummary: string;
  priorityLevel: "low" | "normal" | "high" | "critical";
  aiActionTaken: string;
  createdAt: string;
}

interface MorningBriefing {
  briefing: string;
  stats: {
    newMails: number;
    criticalMails: number;
    openStrategies: number;
  };
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CeoMindOS() {
  const [thought, setThought] = useState("");
  const [strategies, setStrategies] = useState<CeoStrategy[]>([]);
  const [inboxMails, setInboxMails] = useState<InboundMail[]>([]);
  const [morningBriefing, setMorningBriefing] = useState<MorningBriefing | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showFailureModal, setShowFailureModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<CeoStrategy | null>(null);
  const [generatedTemplate, setGeneratedTemplate] = useState("");
  const [failureReason, setFailureReason] = useState("");
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  const [hasNewMails, setHasNewMails] = useState(false);

  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    loadStrategies();
    loadInbox();
    loadMorningBriefing();

    const pollInterval = setInterval(() => {
      loadInbox();
      loadMorningBriefing();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, []);

  const loadStrategies = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStrategies(data || []);
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Load strategies error:", err);
    }
  };

  const loadInbox = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/inbox", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const newMails = data.mails || [];
        setInboxMails(newMails);
        setHasNewMails(newMails.length > 0);
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Load inbox error:", err);
    }
  };

  const loadMorningBriefing = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/morning-briefing", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setMorningBriefing(data);
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Load briefing error:", err);
    }
  };

  // ============================================================================
  // VOICE RECORDING
  // ============================================================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processVoiceInput(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("[CEO-MIND-OS] Voice recording error:", err);
      alert("Mikrofon-Zugriff verweigert. Bitte Berechtigungen prüfen.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const processVoiceInput = async (audioBlob: Blob) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        const res = await fetch("/api/ceo-mind-os/voice-input", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            audioData: base64Audio,
            audioFormat: "webm",
          }),
        });

        if (res.ok) {
          const data = await res.json();
          await loadStrategies();
          // Auto-expand voice strategy
          if (data.strategyId) {
            setExpandedCards((prev) => ({ ...prev, [data.strategyId]: true }));
          }
          setThought("");
        } else {
          const error = await res.json();
          alert(`❌ Voice-Fehler: ${error.detail || "Unbekannter Fehler"}`);
        }
      };
    } catch (err) {
      console.error("[CEO-MIND-OS] Voice processing error:", err);
      alert("Voice-Verarbeitung fehlgeschlagen.");
    } finally {
      setIsTranscribing(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleAnalyze = async () => {
    if (!thought.trim() || analyzing) return;

    setAnalyzing(true);
    setLoading(true);

    try {
      const res = await fetch("/api/ceo-mind-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ thought: thought.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          setStrategies((prev) => [data, ...prev]);
          // AUTO-EXPAND die neue Strategie (FIX!)
          setExpandedCards((prev) => ({ ...prev, [data.id]: true }));
          setThought("");
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
        } else {
          console.error("[CEO-MIND-OS] Invalid response format:", data);
          alert("Ungültige Antwort vom Server.");
        }
      } else {
        const error = await res.json().catch(() => ({}));
        console.error("[CEO-MIND-OS] API error:", error);
        alert("Fehler beim Analysieren. Bitte erneut versuchen.");
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Analyze error:", err);
      alert("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const handleMarkDone = async (id: string) => {
    try {
      const res = await fetch(`/api/ceo-mind-os/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "done" }),
      });

      if (res.ok) {
        setStrategies((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status: "done" } : s))
        );
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Mark done error:", err);
    }
  };

  const handleOpenFailureModal = (strategy: CeoStrategy) => {
    setSelectedStrategy(strategy);
    setFailureReason("");
    setShowFailureModal(true);
  };

  const handleSubmitFailure = async () => {
    if (!selectedStrategy || !failureReason.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/ceo-mind-os/${selectedStrategy.id}/failure`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: failureReason.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setStrategies((prev) =>
          prev.map((s) => (s.id === selectedStrategy.id ? data.strategy : s))
        );
        setShowFailureModal(false);
        setSelectedStrategy(null);
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Submit failure error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTemplate = async (strategy: CeoStrategy) => {
    setSelectedStrategy(strategy);
    setLoading(true);
    setShowTemplateModal(true);

    try {
      const res = await fetch(`/api/ceo-mind-os/${strategy.id}/template`, {
        method: "POST",
        credentials: "include",
      });

      if (res.ok) {
        const data = await res.json();
        setGeneratedTemplate(data.template || "");
        setStrategies((prev) =>
          prev.map((s) => (s.id === strategy.id ? data.strategy : s))
        );
      }
    } catch (err) {
      console.error("[CEO-MIND-OS] Generate template error:", err);
      setGeneratedTemplate("Fehler beim Generieren des Templates.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkMailRead = async (mailId: string) => {
    try {
      await fetch(`/api/ceo-mind-os/inbox/${mailId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "processed" }),
      });
      setInboxMails((prev) => prev.filter((m) => m.id !== mailId));
      setHasNewMails(inboxMails.length - 1 > 0);
    } catch (err) {
      console.error("[CEO-MIND-OS] Mark mail read error:", err);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setThought(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ============================================================================
  // RENDER — PREMIUM LUXUS DESIGN
  // ============================================================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* MORNING BRIEFING — PREMIUM HERO SECTION */}
        {morningBriefing && (
          <motion.div
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative group"
          >
            {/* Animated Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-violet-600/20 to-blue-600/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-700 animate-gradient"></div>
            
            <div className="relative premium-glass rounded-3xl p-8 md:p-10">
              <div className="flex items-start justify-between gap-6 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-1">
                      Executive Briefing
                    </h2>
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-lg text-slate-200 leading-relaxed mb-6 font-light">
                {morningBriefing.briefing}
              </p>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="premium-card-dark p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Mail className="w-4 h-4 text-blue-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Inbox</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{morningBriefing.stats.newMails}</p>
                  {morningBriefing.stats.criticalMails > 0 && (
                    <p className="text-xs text-red-400 mt-1">{morningBriefing.stats.criticalMails} critical</p>
                  )}
                </div>

                <div className="premium-card-dark p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-violet-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Active</span>
                  </div>
                  <p className="text-3xl font-bold text-white">{morningBriefing.stats.openStrategies}</p>
                </div>

                <div className="premium-card-dark p-4 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-slate-400 uppercase tracking-wider">Status</span>
                  </div>
                  <p className="text-3xl font-bold text-emerald-400">Active</p>
                </div>
              </div>

              {/* Inbox Button */}
              {inboxMails.length > 0 && (
                <button
                  onClick={() => setShowInboxModal(true)}
                  className="mt-6 w-full premium-button py-4 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform"
                >
                  <Mail className="w-5 h-5" />
                  {inboxMails.length} Neue Nachrichten ansehen
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* INPUT AREA — MINIMALIST LUXURY */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 via-blue-600/10 to-violet-600/10 rounded-3xl blur-xl"></div>
          
          <div className="relative premium-glass rounded-3xl p-6 md:p-8">
            <div className="flex items-start gap-4">
              <div className="mt-2 relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-600/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
                {hasNewMails && (
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-900"
                  />
                )}
              </div>

              <div className="flex-1">
                <textarea
                  ref={textareaRef}
                  value={thought}
                  onChange={handleTextareaInput}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAnalyze();
                    }
                  }}
                  placeholder="Was beschäftigt dich? Deine Gedanken, Ideen, Strategien..."
                  className="w-full bg-transparent border-none outline-none resize-none text-white placeholder-slate-500 text-lg leading-relaxed"
                  style={{ minHeight: "80px", maxHeight: "300px" }}
                  disabled={analyzing || isRecording || isTranscribing}
                />

                <div className="flex items-center justify-between mt-6">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500">
                      {isRecording
                        ? "🎤 Aufnahme..."
                        : isTranscribing
                        ? "🔄 Transkribiere..."
                        : analyzing
                        ? "⚡ KI analysiert..."
                        : "⌘+Enter zum Analysieren"}
                    </span>

                    {/* Voice Button */}
                    <button
                      onClick={isRecording ? stopRecording : startRecording}
                      disabled={analyzing || isTranscribing}
                      className={`relative p-3 rounded-xl transition-all ${
                        isRecording
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      } disabled:opacity-40`}
                    >
                      {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      {isRecording && (
                        <motion.div
                          animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="absolute inset-0 rounded-xl bg-red-500"
                        />
                      )}
                    </button>
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={!thought.trim() || analyzing || isRecording || isTranscribing}
                    className="premium-button px-8 py-3 rounded-xl font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-transform flex items-center gap-2"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analysiere...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Analysieren
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Analyzing Animation */}
            {analyzing && (
              <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                <motion.div
                  animate={{ x: ["-100%", "400%"] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="absolute top-0 left-0 w-1/3 h-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent"
                />
              </div>
            )}
          </div>
        </motion.div>

        {/* STRATEGIES — PREMIUM CARDS */}
        <AnimatePresence mode="popLayout">
          {strategies.map((strategy, idx) => (
            <MindCard
              key={strategy.id}
              strategy={strategy}
              index={idx}
              expanded={expandedCards[strategy.id] || false}
              onToggleExpand={() => toggleCardExpansion(strategy.id)}
              onMarkDone={() => handleMarkDone(strategy.id)}
              onOpenFailure={() => handleOpenFailureModal(strategy)}
              onGenerateTemplate={() => handleGenerateTemplate(strategy)}
            />
          ))}
        </AnimatePresence>

        {/* MODALS */}
        <AnimatePresence>
          {showInboxModal && (
            <Modal onClose={() => setShowInboxModal(false)}>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-blue-400" />
                  </div>
                  Inbox
                </h3>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                  {inboxMails.map((mail) => (
                    <motion.div
                      key={mail.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="premium-card-dark p-6 rounded-2xl hover:bg-slate-800/60 transition-all"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                mail.priorityLevel === "critical"
                                  ? "bg-red-500/20 text-red-400"
                                  : mail.priorityLevel === "high"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : "bg-blue-500/20 text-blue-400"
                              }`}
                            >
                              {mail.priorityLevel.toUpperCase()}
                            </span>
                          </div>
                          <p className="font-semibold text-white mb-1">{mail.sender}</p>
                          <p className="text-sm text-slate-300 mb-2">{mail.subject}</p>
                          <p className="text-xs text-slate-500">{mail.contentSummary}</p>
                        </div>
                        <button
                          onClick={() => handleMarkMailRead(mail.id)}
                          className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                        >
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {inboxMails.length === 0 && (
                    <p className="text-slate-500 text-center py-12">Keine neuen Nachrichten</p>
                  )}
                </div>
              </div>
            </Modal>
          )}

          {showFailureModal && (
            <Modal onClose={() => setShowFailureModal(false)}>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  Warum nicht umgesetzt?
                </h3>
                <p className="text-slate-400 mb-6">
                  Die KI erstellt eine Opportunitätskosten-Rechnung basierend auf deinem Grund.
                </p>
                <textarea
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  placeholder="z.B. Zu teuer, kein ROI erkennbar, andere Priorität..."
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 min-h-[120px] focus:border-blue-500 focus:outline-none transition-colors"
                />
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSubmitFailure}
                    disabled={!failureReason.trim() || loading}
                    className="flex-1 premium-button py-3 rounded-xl font-semibold text-white disabled:opacity-40"
                  >
                    {loading ? "Analysiere..." : "Analysieren"}
                  </button>
                  <button
                    onClick={() => setShowFailureModal(false)}
                    className="px-6 py-3 bg-slate-800 text-slate-300 rounded-xl font-semibold hover:bg-slate-700 transition-colors"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </Modal>
          )}

          {showTemplateModal && (
            <Modal onClose={() => setShowTemplateModal(false)}>
              <div className="p-8">
                <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-violet-400" />
                  </div>
                  Magic Template
                </h3>
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
                  </div>
                ) : (
                  <>
                    <div className="bg-slate-900/50 rounded-xl p-6 mb-6 max-h-[50vh] overflow-y-auto">
                      <pre className="whitespace-pre-wrap text-sm text-slate-300 font-mono">
                        {generatedTemplate}
                      </pre>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTemplate);
                        alert("Template in Zwischenablage kopiert!");
                      }}
                      className="w-full premium-button py-3 rounded-xl font-semibold text-white"
                    >
                      In Zwischenablage kopieren
                    </button>
                  </>
                )}
              </div>
            </Modal>
          )}
        </AnimatePresence>
      </div>

      {/* PREMIUM STYLES */}
      <style>{`
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }

        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 8s ease infinite;
        }

        .premium-glass {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px) saturate(180%);
          border: 1px solid rgba(59, 130, 246, 0.2);
          box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .premium-card-dark {
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(51, 65, 85, 0.5);
        }

        .premium-button {
          background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
          box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
        }

        .premium-button:hover {
          box-shadow: 0 15px 40px rgba(59, 130, 246, 0.4);
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MIND CARD — PREMIUM EDITION
// ============================================================================

interface MindCardProps {
  strategy: CeoStrategy;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onMarkDone: () => void;
  onOpenFailure: () => void;
  onGenerateTemplate: () => void;
}

function MindCard({
  strategy,
  index,
  expanded,
  onToggleExpand,
  onMarkDone,
  onOpenFailure,
  onGenerateTemplate,
}: MindCardProps) {
  const analysis = strategy.aiAnalysis;
  const isDone = strategy.status === "done";
  const isFailed = strategy.status === "failed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        layout: { duration: 0.3, type: "spring", stiffness: 80 },
        delay: index * 0.05 
      }}
      className={`relative group ${isDone ? "opacity-60" : ""}`}
    >
      <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 via-violet-600/5 to-blue-600/5 rounded-3xl blur-lg"></div>
      
      <div className="relative premium-glass rounded-3xl p-6 md:p-8 cursor-pointer hover:border-blue-500/40 transition-all"
        onClick={onToggleExpand}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              {isFailed && (
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                </div>
              )}
              {isDone && (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
              )}
              {!isFailed && !isDone && (
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Target className="w-4 h-4 text-blue-400" />
                </div>
              )}
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
                {strategy.category || "Strategie"}
              </span>
              {analysis?.confidence && (
                <span className="text-xs text-slate-500">
                  {Math.round(analysis.confidence * 100)}%
                </span>
              )}
            </div>
            <p className="text-lg text-white font-medium leading-relaxed">
              {strategy.userThought}
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="p-2 hover:bg-slate-800/50 rounded-lg transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>
        </div>

        {/* Analysis (Expandable) */}
        <AnimatePresence>
          {expanded && analysis && (
            <motion.div
              layout
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6 pt-6 border-t border-slate-800"
              onClick={(e) => e.stopPropagation()}
            >
              <div>
                <h4 className="text-sm font-semibold text-blue-400 mb-2 uppercase tracking-wider">Zusammenfassung</h4>
                <p className="text-slate-300 leading-relaxed">{analysis.summary || "Keine Zusammenfassung verfügbar"}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-violet-400 mb-2 uppercase tracking-wider">Rückfrage</h4>
                <p className="text-slate-300 leading-relaxed">{analysis.followUpQuestion || "Keine Rückfrage"}</p>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-emerald-400 mb-2 uppercase tracking-wider">ROI-Check</h4>
                <p className="text-slate-300 leading-relaxed">{analysis.roiCheck || "Keine ROI-Analyse verfügbar"}</p>
              </div>

              {analysis.nextSteps && analysis.nextSteps.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-blue-400 mb-3 uppercase tracking-wider">Next Steps</h4>
                  <ul className="space-y-2">
                    {analysis.nextSteps.map((step, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className="text-slate-300 flex items-start gap-3"
                      >
                        <span className="text-blue-400 font-bold mt-1">→</span>
                        {step}
                      </motion.li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-3 pt-4">
                {!isDone && !isFailed && (
                  <button
                    onClick={onMarkDone}
                    className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg font-semibold hover:bg-emerald-500/30 transition-all flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Erledigt
                  </button>
                )}
                {!isDone && !isFailed && (
                  <button
                    onClick={onOpenFailure}
                    className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg font-semibold hover:bg-red-500/30 transition-all flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4" />
                    Nicht umgesetzt
                  </button>
                )}
                <button
                  onClick={onGenerateTemplate}
                  className="px-4 py-2 bg-violet-500/20 text-violet-400 rounded-lg font-semibold hover:bg-violet-500/30 transition-all flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Template
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MODAL — PREMIUM OVERLAY
// ============================================================================

interface ModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

function Modal({ children, onClose }: ModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 via-violet-600/20 to-blue-600/20 rounded-3xl blur-xl"></div>
        
        <div className="relative bg-slate-900 rounded-3xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-hidden">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 p-2 hover:bg-slate-800 rounded-lg transition-colors z-10"
          >
            <X className="w-6 h-6 text-slate-400" />
          </button>
          
          <div className="overflow-y-auto max-h-[90vh]">
            {children}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
