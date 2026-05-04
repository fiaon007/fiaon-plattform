/**
 * ============================================================================
 * ULTIMATE LUXURY CEO COMMAND CENTER
 * ============================================================================
 * The Executive Hub with Iron Man Intelligence
 * 
 * Features:
 * - Border-Beam Animated Pill Input (Glow-Beam wandert um Rand)
 * - Infinite Pulse Background (atmender blauer Nebel)
 * - Intelligent Inbox Categorization (4 Widgets)
 * - Email Reply Drafting (AI-generiert)
 * - Action Steps Generator (Top 3 aus Mails + Todos)
 * - Auto-Scroll to New Items
 * - Shimmer Loading Effects
 * - Bottom-Sheets for Mobile
 * - Monochrome + Gold/Silber Accents
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Mail,
  X,
  ChevronDown,
  ChevronUp,
  Mic,
  MicOff,
  Sparkles,
  ArrowRight,
  Users,
  Shield,
  Filter,
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
  senderEmail: string;
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

interface ActionStep {
  id: string;
  text: string;
  type: "email" | "todo" | "strategy";
  urgency: "high" | "medium" | "low";
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CeoMindOS() {
  const [thought, setThought] = useState("");
  const [strategies, setStrategies] = useState<CeoStrategy[]>([]);
  const [inboxMails, setInboxMails] = useState<InboundMail[]>([]);
  const [morningBriefing, setMorningBriefing] = useState<MorningBriefing | null>(null);
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});
  
  // Modals
  const [showInboxModal, setShowInboxModal] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [selectedMail, setSelectedMail] = useState<InboundMail | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [generatingReply, setGeneratingReply] = useState(false);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const strategiesRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    loadStrategies();
    loadInbox();
    loadMorningBriefing();
    loadActionSteps();

    const pollInterval = setInterval(() => {
      loadInbox();
      loadMorningBriefing();
      loadActionSteps();
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
      console.error("[CEO-HUB] Load strategies error:", err);
    }
  };

  const loadInbox = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/inbox", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInboxMails(data.mails || []);
      }
    } catch (err) {
      console.error("[CEO-HUB] Load inbox error:", err);
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
      console.error("[CEO-HUB] Load briefing error:", err);
    }
  };

  const loadActionSteps = async () => {
    // Generate action steps from inbox + todos
    try {
      // For now, create from inbox (can be enhanced with AI later)
      const steps: ActionStep[] = inboxMails
        .filter(m => m.priorityLevel === "critical" || m.priorityLevel === "high")
        .slice(0, 3)
        .map((mail, idx) => ({
          id: `step-${idx}`,
          text: `Respond to ${mail.sender}: ${mail.subject}`,
          type: "email" as const,
          urgency: mail.priorityLevel === "critical" ? "high" : "medium",
        }));
      
      setActionSteps(steps);
    } catch (err) {
      console.error("[CEO-HUB] Load action steps error:", err);
    }
  };

  // ============================================================================
  // INBOX CATEGORIZATION
  // ============================================================================

  const categorizedInbox = {
    priority: inboxMails.filter(m => m.priorityLevel === "critical"),
    partners: inboxMails.filter(m => 
      m.sender.toLowerCase().includes("partner") || 
      m.sender.toLowerCase().includes("investor") ||
      m.aiActionTaken.toLowerCase().includes("partner")
    ),
    clients: inboxMails.filter(m => 
      m.sender.toLowerCase().includes("kunde") || 
      m.sender.toLowerCase().includes("client") ||
      m.aiActionTaken.toLowerCase().includes("client")
    ),
    filtered: inboxMails.filter(m => 
      m.priorityLevel === "low" || 
      m.aiActionTaken.toLowerCase().includes("spam") ||
      m.aiActionTaken.toLowerCase().includes("info")
    ),
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
      console.error("[CEO-HUB] Voice recording error:", err);
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
          if (data.strategyId) {
            setExpandedCards((prev) => ({ ...prev, [data.strategyId]: true }));
            scrollToNewStrategy();
          }
          setThought("");
        }
      };
    } catch (err) {
      console.error("[CEO-HUB] Voice processing error:", err);
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
          setExpandedCards((prev) => ({ ...prev, [data.id]: true }));
          setThought("");
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
          }
          scrollToNewStrategy();
        }
      }
    } catch (err) {
      console.error("[CEO-HUB] Analyze error:", err);
    } finally {
      setAnalyzing(false);
      setLoading(false);
    }
  };

  const scrollToNewStrategy = () => {
    setTimeout(() => {
      if (strategiesRef.current) {
        strategiesRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 300);
  };

  const handleGenerateReply = async (mail: InboundMail) => {
    setSelectedMail(mail);
    setShowReplyModal(true);
    setGeneratingReply(true);
    setReplyDraft("");

    try {
      // Call backend to generate reply (you'll need to implement this endpoint)
      const res = await fetch("/api/ceo-mind-os/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mailId: mail.id,
          sender: mail.sender,
          subject: mail.subject,
          content: mail.contentSummary,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setReplyDraft(data.reply || "");
      } else {
        setReplyDraft("Fehler beim Generieren der Antwort. Bitte manuell schreiben.");
      }
    } catch (err) {
      console.error("[CEO-HUB] Generate reply error:", err);
      setReplyDraft("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setGeneratingReply(false);
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
  // RENDER — ULTIMATE LUXURY INTERFACE
  // ============================================================================

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">
      {/* INFINITE PULSE BACKGROUND */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="infinite-pulse"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* THE ANIMATED PILL INPUT */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative group"
        >
          <div className="pill-container relative">
            {/* Border Beam Animation */}
            <div className="border-beam"></div>
            
            <div className="pill-glass relative z-10 flex items-center gap-4 p-6">
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
                  placeholder="Command Center ready. What's on your mind?"
                  className="w-full bg-transparent border-none outline-none resize-none text-white placeholder-slate-500 text-lg"
                  style={{ minHeight: "60px", maxHeight: "200px" }}
                  disabled={analyzing || isRecording || isTranscribing}
                />
              </div>

              <div className="flex items-center gap-3">
                {/* Voice Button */}
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={analyzing || isTranscribing}
                  className={`p-3 rounded-full transition-all ${
                    isRecording
                      ? "bg-red-500/20 text-red-400 animate-pulse"
                      : "bg-white/5 text-white hover:bg-white/10"
                  } disabled:opacity-40`}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Send Button */}
                <button
                  onClick={handleAnalyze}
                  disabled={!thought.trim() || analyzing || isRecording || isTranscribing}
                  className="luxury-button px-8 py-3 rounded-full font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Execute
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Status Text */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-slate-500 mt-2 text-center"
          >
            {isRecording
              ? "🎤 Listening..."
              : isTranscribing
              ? "🔄 Transcribing..."
              : analyzing
              ? "⚡ AI analyzing..."
              : "⌘+Enter to execute"}
          </motion.p>
        </motion.div>

        {/* ACTION STEPS GENERATOR */}
        {actionSteps.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="luxury-card p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <h3 className="text-xl font-bold text-white">YOUR DAY: ACTION STEPS</h3>
            </div>

            <div className="space-y-3">
              {actionSteps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="flex items-start gap-4 p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-all group cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-sm">{idx + 1}</span>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{step.text}</p>
                    <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">{step.type}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition-colors" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* INTELLIGENT INBOX — 4 CATEGORIES */}
        {inboxMails.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* PRIORITY */}
            <InboxCategory
              title="PRIORITY"
              icon={<AlertCircle className="w-5 h-5" />}
              count={categorizedInbox.priority.length}
              color="red"
              mails={categorizedInbox.priority}
              onMailClick={handleGenerateReply}
            />

            {/* PARTNERS & INVESTORS */}
            <InboxCategory
              title="PARTNERS"
              icon={<Shield className="w-5 h-5" />}
              count={categorizedInbox.partners.length}
              color="blue"
              mails={categorizedInbox.partners}
              onMailClick={handleGenerateReply}
            />

            {/* CLIENTS */}
            <InboxCategory
              title="CLIENTS"
              icon={<Users className="w-5 h-5" />}
              count={categorizedInbox.clients.length}
              color="green"
              mails={categorizedInbox.clients}
              onMailClick={handleGenerateReply}
            />

            {/* FILTERED */}
            <InboxCategory
              title="FILTERED"
              icon={<Filter className="w-5 h-5" />}
              count={categorizedInbox.filtered.length}
              color="gray"
              mails={categorizedInbox.filtered}
              onMailClick={handleGenerateReply}
            />
          </div>
        )}

        {/* STRATEGIES TIMELINE */}
        <div ref={strategiesRef} className="space-y-4">
          <AnimatePresence mode="popLayout">
            {strategies.map((strategy, idx) => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                index={idx}
                expanded={expandedCards[strategy.id] || false}
                onToggleExpand={() => toggleCardExpansion(strategy.id)}
              />
            ))}
          </AnimatePresence>

          {loading && strategies.length === 0 && (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="shimmer-card h-32 rounded-2xl"></div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* REPLY MODAL */}
      <AnimatePresence>
        {showReplyModal && selectedMail && (
          <LuxuryModal onClose={() => setShowReplyModal(false)}>
            <div className="p-8">
              <h3 className="text-2xl font-bold text-white mb-4">Reply Draft</h3>
              <div className="mb-4">
                <p className="text-sm text-slate-400">To: {selectedMail.sender}</p>
                <p className="text-sm text-slate-400">Re: {selectedMail.subject}</p>
              </div>

              {generatingReply ? (
                <div className="shimmer-card h-48 rounded-xl mb-4"></div>
              ) : (
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  className="w-full bg-white/5 border border-slate-700 rounded-xl p-4 text-white min-h-[200px] focus:border-amber-500 focus:outline-none transition-colors"
                />
              )}

              <div className="flex gap-3">
                <button className="flex-1 luxury-button py-3 rounded-xl font-semibold text-white">
                  <Mail className="w-5 h-5 inline mr-2" />
                  Send Reply
                </button>
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="px-6 py-3 bg-white/5 text-white rounded-xl font-semibold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </LuxuryModal>
        )}
      </AnimatePresence>

      {/* STYLES */}
      <style>{`
        /* INFINITE PULSE BACKGROUND */
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1) translate(-50%, -50%);
            opacity: 0.3;
          }
          50% { 
            transform: scale(1.5) translate(-50%, -50%);
            opacity: 0.6;
          }
        }

        .infinite-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, 
            rgba(59, 130, 246, 0.4) 0%,
            rgba(59, 130, 246, 0.2) 40%,
            transparent 70%
          );
          animation: pulse 8s ease-in-out infinite;
          filter: blur(80px);
        }

        /* BORDER BEAM ANIMATION */
        @keyframes beam {
          0% { 
            transform: rotate(0deg);
          }
          100% { 
            transform: rotate(360deg);
          }
        }

        .pill-container {
          border-radius: 9999px;
          padding: 2px;
          position: relative;
        }

        .border-beam {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          padding: 2px;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 270deg,
            rgba(251, 191, 36, 0.8) 315deg,
            rgba(251, 191, 36, 0.6) 360deg
          );
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: beam 3s linear infinite;
          filter: blur(1px);
        }

        .pill-glass {
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(40px) saturate(180%);
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        /* LUXURY CARD */
        .luxury-card {
          background: rgba(15, 23, 42, 0.6);
          backdrop-filter: blur(20px);
          border-radius: 1.5rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
        }

        /* LUXURY BUTTON */
        .luxury-button {
          background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
          box-shadow: 0 10px 30px rgba(251, 191, 36, 0.3);
          transition: all 0.3s ease;
        }

        .luxury-button:hover:not(:disabled) {
          box-shadow: 0 15px 40px rgba(251, 191, 36, 0.5);
          transform: translateY(-2px);
        }

        /* SHIMMER LOADING */
        @keyframes shimmer {
          0% { background-position: -1000px 0; }
          100% { background-position: 1000px 0; }
        }

        .shimmer-card {
          background: linear-gradient(
            90deg,
            rgba(15, 23, 42, 0.6) 0%,
            rgba(59, 130, 246, 0.1) 50%,
            rgba(15, 23, 42, 0.6) 100%
          );
          background-size: 1000px 100%;
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}

// ============================================================================
// INBOX CATEGORY WIDGET
// ============================================================================

interface InboxCategoryProps {
  title: string;
  icon: React.ReactNode;
  count: number;
  color: "red" | "blue" | "green" | "gray";
  mails: InboundMail[];
  onMailClick: (mail: InboundMail) => void;
}

function InboxCategory({ title, icon, count, color, mails, onMailClick }: InboxCategoryProps) {
  const [expanded, setExpanded] = useState(false);

  const colorClasses = {
    red: "from-red-500/20 to-red-600/20 text-red-400",
    blue: "from-blue-500/20 to-blue-600/20 text-blue-400",
    green: "from-emerald-500/20 to-emerald-600/20 text-emerald-400",
    gray: "from-slate-500/20 to-slate-600/20 text-slate-400",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="luxury-card p-4 cursor-pointer"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center`}>
          {icon}
        </div>
        <span className="text-3xl font-bold text-white">{count}</span>
      </div>

      <h4 className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-2">{title}</h4>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2 mt-4 pt-4 border-t border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            {mails.slice(0, 3).map((mail) => (
              <button
                key={mail.id}
                onClick={() => onMailClick(mail)}
                className="w-full text-left p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-all"
              >
                <p className="text-sm text-white font-medium truncate">{mail.sender}</p>
                <p className="text-xs text-slate-400 truncate">{mail.subject}</p>
              </button>
            ))}
            {mails.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">No messages</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// STRATEGY CARD
// ============================================================================

interface StrategyCardProps {
  strategy: CeoStrategy;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
}

function StrategyCard({ strategy, index, expanded, onToggleExpand }: StrategyCardProps) {
  const analysis = strategy.aiAnalysis;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: index * 0.05 }}
      className="luxury-card p-6 cursor-pointer hover:border-amber-500/40 transition-all"
      onClick={onToggleExpand}
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <p className="text-white font-medium leading-relaxed flex-1">{strategy.userThought}</p>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </button>
      </div>

      <AnimatePresence>
        {expanded && analysis && (
          <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-4 pt-4 border-t border-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h5 className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2">Analysis</h5>
              <p className="text-slate-300 leading-relaxed">{analysis.summary || "No analysis available"}</p>
            </div>

            {analysis.nextSteps && analysis.nextSteps.length > 0 && (
              <div>
                <h5 className="text-xs text-amber-400 uppercase tracking-wider font-semibold mb-2">Next Steps</h5>
                <ul className="space-y-2">
                  {analysis.nextSteps.map((step, i) => (
                    <li key={i} className="text-slate-300 flex items-start gap-2">
                      <span className="text-amber-400">→</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// LUXURY MODAL
// ============================================================================

interface LuxuryModalProps {
  children: React.ReactNode;
  onClose: () => void;
}

function LuxuryModal({ children, onClose }: LuxuryModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-end md:items-center justify-center p-0 md:p-4"
    >
      <motion.div
        initial={{ y: "100%", scale: 0.95 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: "100%", scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-2xl md:rounded-3xl rounded-t-3xl luxury-card max-h-[90vh] overflow-y-auto"
      >
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <X className="w-6 h-6 text-slate-400" />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
