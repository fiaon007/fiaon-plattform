/**
 * ============================================================================
 * CEO MIND-OS "IRON MAN HUD" — Vollendetes JARVIS-Erlebnis
 * ============================================================================
 * Features:
 *   - Pulsing Neural Core (Arc Reactor) als Ladeanzeige
 *   - Glassmorphism 3.0 mit Iridescent-Glow Effekt
 *   - Smooth Layout Transitions (Framer Motion AnimatePresence)
 *   - Voice-to-Strategy mit Web Speech API + Whisper
 *   - Ripple-Effekt am Voice-Button im Rhythmus der Stimme
 *   - Proactive Polling für neue E-Mails (60s Intervall)
 *   - Glühender Notification-Punkt am Brain-Icon
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Brain,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Mail,
  TrendingUp,
  X,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
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

    // Proactive Polling: Prüfe alle 60s auf neue Mails
    const pollInterval = setInterval(() => {
      loadInbox();
    }, 60000);

    return () => clearInterval(pollInterval);
  }, []);

  const loadStrategies = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStrategies(data.strategies || []);
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
  // VOICE RECORDING (WEB SPEECH API + WHISPER)
  // ============================================================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm",
      });

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
      // Convert Blob to Base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      reader.onloadend = async () => {
        const base64Audio = reader.result as string;

        // Send to backend
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
          // Reload strategies nach Voice-Input
          await loadStrategies();
          setThought("");
          alert(`✅ Voice-Strategie erstellt: "${data.transcription.slice(0, 60)}..."`);
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
      const res = await fetch("/api/ceo-mind-os/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ thought: thought.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setStrategies((prev) => [data.strategy, ...prev]);
        setThought("");
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto";
        }
      } else {
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

  // ============================================================================
  // AUTO-GROW TEXTAREA
  // ============================================================================

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setThought(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const toggleCardExpansion = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="space-y-6 font-['Inter_Variable',_system-ui,_sans-serif]">
      {/* MORNING BRIEFING — JARVIS MODE */}
      {morningBriefing && morningBriefing.stats.newMails > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-6 glass-iridescent"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-violet-600" />
                <h3 className="text-lg font-semibold text-gray-900">Priority One</h3>
              </div>
              <p className="text-gray-700 leading-relaxed">{morningBriefing.briefing}</p>
              <div className="flex gap-4 mt-3 text-sm text-gray-600">
                <span>📧 {morningBriefing.stats.newMails} Mails</span>
                <span>🎯 {morningBriefing.stats.openStrategies} Tasks</span>
                {morningBriefing.stats.criticalMails > 0 && (
                  <span className="text-red-600 font-medium">
                    ⚠️ {morningBriefing.stats.criticalMails} Critical
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowInboxModal(true)}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all font-medium shadow-lg hover:shadow-xl"
            >
              Zeigen
            </button>
          </div>
        </motion.div>
      )}

      {/* SHADOW INBOX — Daten-Fragmente */}
      {inboxMails.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {inboxMails.slice(0, 3).map((mail) => (
            <motion.button
              key={mail.id}
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              whileHover={{ scale: 1.05, y: -2 }}
              onClick={() => setShowInboxModal(true)}
              className="relative px-4 py-2 rounded-full text-sm font-medium transition-all data-fragment"
              style={{
                background:
                  mail.priorityLevel === "critical"
                    ? "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))"
                    : "linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(37, 99, 235, 0.2))",
                backdropFilter: "blur(15px)",
                border:
                  mail.priorityLevel === "critical"
                    ? "1px solid rgba(239, 68, 68, 0.5)"
                    : "1px solid rgba(59, 130, 246, 0.5)",
              }}
            >
              <Mail className="w-3 h-3 inline mr-1" />
              {mail.sender.split(" ")[0]}
            </motion.button>
          ))}
          {inboxMails.length > 3 && (
            <button
              onClick={() => setShowInboxModal(true)}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              +{inboxMails.length - 3} mehr
            </button>
          )}
        </div>
      )}

      {/* INPUT AREA — Glassmorphism 3.0 + Voice Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl p-6 glass-iridescent"
      >
        <div className="flex items-start gap-3">
          <div className="mt-3 relative">
            <Brain className="w-6 h-6 text-violet-600" />
            {/* Notification Dot für neue Mails */}
            {hasNewMails && (
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"
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
              placeholder="Was beschäftigt dich gerade? Schreib oder sprich deine Gedanken..."
              className="w-full bg-transparent border-none outline-none resize-none text-gray-900 placeholder-gray-500 text-base leading-relaxed"
              style={{ minHeight: "60px", maxHeight: "300px" }}
              disabled={analyzing || isRecording || isTranscribing}
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">
                  {isRecording
                    ? "🎤 Aufnahme läuft..."
                    : isTranscribing
                    ? "🔄 Transkribiere..."
                    : analyzing
                    ? "KI denkt nach..."
                    : "⌘+Enter zum Analysieren"}
                </span>
                {/* Voice Button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={analyzing || isTranscribing}
                  className={`relative p-2 rounded-full transition-all ${
                    isRecording
                      ? "bg-red-500 text-white"
                      : "bg-gradient-to-r from-violet-600 to-blue-600 text-white hover:shadow-lg"
                  } disabled:opacity-40`}
                >
                  {isRecording ? (
                    <MicOff className="w-5 h-5" />
                  ) : (
                    <Mic className="w-5 h-5" />
                  )}
                  {/* Ripple Effect bei Recording */}
                  {isRecording && (
                    <>
                      <motion.div
                        animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-red-500"
                      />
                      <motion.div
                        animate={{ scale: [1, 2, 1], opacity: [0.3, 0, 0.3] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                        className="absolute inset-0 rounded-full bg-red-500"
                      />
                    </>
                  )}
                </button>
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!thought.trim() || analyzing || isRecording || isTranscribing}
                className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-2xl transition-all flex items-center gap-2 hover:-translate-y-0.5"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analysiere...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Analysieren
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* PULSING NEURAL CORE (Arc Reactor) */}
        {analyzing && (
          <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
            <div className="neural-core" />
            <div className="neural-beam" />
          </div>
        )}
      </motion.div>

      {/* STRATEGIES — Layout Transitions */}
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
        {showFailureModal && (
          <Modal onClose={() => setShowFailureModal(false)}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-600" />
                Warum nicht umgesetzt?
              </h3>
              <p className="text-gray-600 mb-4">
                Die KI erstellt eine Opportunitätskosten-Rechnung basierend auf deinem Grund.
              </p>
              <textarea
                value={failureReason}
                onChange={(e) => setFailureReason(e.target.value)}
                placeholder="z.B. Zu teuer, kein ROI erkennbar, andere Priorität..."
                className="w-full border border-gray-300 rounded-lg p-3 text-gray-900 min-h-[100px]"
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSubmitFailure}
                  disabled={!failureReason.trim() || loading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-40"
                >
                  {loading ? "Analysiere..." : "Analysieren"}
                </button>
                <button
                  onClick={() => setShowFailureModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </Modal>
        )}

        {showTemplateModal && (
          <Modal onClose={() => setShowTemplateModal(false)}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-violet-600" />
                Magic Template
              </h3>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
                </div>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 max-h-96 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono">
                      {generatedTemplate}
                    </pre>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedTemplate);
                      alert("Template in Zwischenablage kopiert!");
                    }}
                    className="w-full px-4 py-2 bg-violet-600 text-white rounded-lg font-medium hover:bg-violet-700"
                  >
                    In Zwischenablage kopieren
                  </button>
                </>
              )}
            </div>
          </Modal>
        )}

        {showInboxModal && (
          <Modal onClose={() => setShowInboxModal(false)}>
            <div className="p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Mail className="w-6 h-6 text-blue-600" />
                Shadow Inbox
              </h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {inboxMails.map((mail) => (
                  <motion.div
                    key={mail.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="p-4 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${
                              mail.priorityLevel === "critical"
                                ? "bg-red-100 text-red-700"
                                : mail.priorityLevel === "high"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {mail.priorityLevel.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {mail.aiActionTaken}
                          </span>
                        </div>
                        <p className="font-semibold text-gray-900">{mail.sender}</p>
                        <p className="text-sm text-gray-700 mt-1">{mail.subject}</p>
                        <p className="text-xs text-gray-600 mt-2">
                          {mail.contentSummary}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkMailRead(mail.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                      >
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {inboxMails.length === 0 && (
                  <p className="text-gray-500 text-center py-8">Keine neuen Mails</p>
                )}
              </div>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* STYLES */}
      <style>{`
        /* Glassmorphism 3.0 mit Iridescent-Glow */
        .glass-iridescent {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(30px);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 
            0 20px 50px rgba(0, 0, 0, 0.05),
            inset 0 0 20px rgba(255, 255, 255, 0.1),
            0 0 40px rgba(139, 92, 246, 0.1);
        }

        .glass-iridescent::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, 
            rgba(255, 107, 107, 0.2),
            rgba(255, 200, 87, 0.2),
            rgba(119, 221, 119, 0.2),
            rgba(79, 172, 254, 0.2),
            rgba(186, 104, 200, 0.2)
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
          opacity: 0.3;
        }

        /* Pulsing Neural Core (Arc Reactor) */
        @keyframes coreGlow {
          0%, 100% { 
            transform: scale(1);
            opacity: 0.3;
            box-shadow: 0 0 40px rgba(139, 92, 246, 0.5);
          }
          50% { 
            transform: scale(1.2);
            opacity: 0.6;
            box-shadow: 0 0 80px rgba(139, 92, 246, 0.8);
          }
        }

        .neural-core {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 120px;
          height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, 
            rgba(139, 92, 246, 0.6),
            rgba(59, 130, 246, 0.4),
            transparent
          );
          animation: coreGlow 3s ease-in-out infinite;
        }

        .neural-core::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(255, 255, 255, 0.8),
            rgba(139, 92, 246, 0.6),
            transparent
          );
          animation: coreGlow 1.5s ease-in-out infinite reverse;
        }

        /* Neural Processing Beam */
        @keyframes beam {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }

        .neural-beam {
          position: absolute;
          top: 0;
          left: 0;
          width: 30%;
          height: 100%;
          background: linear-gradient(90deg, 
            transparent,
            rgba(139, 92, 246, 0.4),
            rgba(59, 130, 246, 0.4),
            transparent
          );
          animation: beam 2s ease-in-out infinite;
        }

        /* Data Fragment Glow */
        .data-fragment {
          box-shadow: 0 0 20px currentColor;
        }

        @keyframes fragmentPulse {
          0%, 100% { box-shadow: 0 0 20px currentColor; }
          50% { box-shadow: 0 0 40px currentColor; }
        }

        .data-fragment:hover {
          animation: fragmentPulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// MIND CARD — 3D Tilt + Layout Transitions
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
  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useTransform(mouseY, [-300, 300], [5, -5]);
  const rotateY = useTransform(mouseX, [-300, 300], [-5, 5]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set(e.clientX - centerX);
    mouseY.set(e.clientY - centerY);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  const analysis = strategy.aiAnalysis;
  const isDone = strategy.status === "done";
  const isFailed = strategy.status === "failed";

  return (
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ 
        layout: { duration: 0.3, type: "spring", stiffness: 100 },
        delay: index * 0.05 
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      className={`rounded-2xl p-6 cursor-pointer transition-all hover:shadow-2xl glass-iridescent ${
        isFailed ? "opacity-70" : isDone ? "opacity-80" : ""
      }`}
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {isFailed && <AlertCircle className="w-5 h-5 text-red-600" />}
            {isDone && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            {!isFailed && !isDone && <TrendingUp className="w-5 h-5 text-violet-600" />}
            <span className="text-xs font-medium text-gray-600">
              {strategy.category || "Strategie"}
            </span>
            {analysis?.confidence && (
              <span className="text-xs text-gray-500">
                {Math.round(analysis.confidence * 100)}% Confidence
              </span>
            )}
          </div>
          <p className="text-gray-900 font-medium leading-relaxed">
            {strategy.userThought}
          </p>
        </div>
        <button onClick={onToggleExpand} className="p-1 hover:bg-gray-100 rounded">
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-600" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-600" />
          )}
        </button>
      </div>

      {/* ANALYSIS (Expandable with Layout Animation) */}
      <AnimatePresence>
        {expanded && analysis && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-4"
          >
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-1">Zusammenfassung</h4>
              <p className="text-sm text-gray-700">{analysis.summary}</p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-1">Rückfrage</h4>
              <p className="text-sm text-gray-700">{analysis.followUpQuestion}</p>
            </div>

            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-1">ROI-Check</h4>
              <p className="text-sm text-gray-700">{analysis.roiCheck}</p>
            </div>

            {analysis.nextSteps && analysis.nextSteps.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">Next Steps</h4>
                <ul className="space-y-1">
                  {analysis.nextSteps.map((step, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="text-sm text-gray-700 flex items-start gap-2"
                    >
                      <span className="text-violet-600 font-bold">→</span>
                      {step}
                    </motion.li>
                  ))}
                </ul>
              </div>
            )}

            {analysis.resources && analysis.resources.length > 0 && (
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-2">Ressourcen</h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.resources.map((res, i) => (
                    <motion.a
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      href={res.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors"
                    >
                      {res.label}
                    </motion.a>
                  ))}
                </div>
              </div>
            )}

            {isFailed && strategy.failureReason && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 bg-red-50 rounded-lg border border-red-200"
              >
                <h4 className="text-sm font-bold text-red-900 mb-1">
                  Opportunitätskosten-Analyse
                </h4>
                <p className="text-sm text-red-800">{strategy.failureReason}</p>
              </motion.div>
            )}

            {/* ACTION BUTTONS */}
            <motion.div
              layout
              className="flex gap-2 pt-2"
            >
              {!isDone && !isFailed && (
                <>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onMarkDone}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Erledigt
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onOpenFailure}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-all shadow-md hover:shadow-lg"
                  >
                    Nicht umgesetzt
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05, rotate: 5 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onGenerateTemplate}
                    className="px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MODAL COMPONENT
// ============================================================================

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

function Modal({ onClose, children }: ModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0, 0, 0, 0.5)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors z-10"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
