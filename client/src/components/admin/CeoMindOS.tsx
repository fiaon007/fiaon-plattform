/**
 * ============================================================================
 * FIAON COMMAND CENTER — STARK EDITION (Ultra-Luxury)
 * ============================================================================
 * The Iron Man Dashboard - Richard Mille meets High-Tech
 *
 * CRITICAL FIXES:
 * - FIX: Backend returns { thought, analysis } - NOT { userThought, aiAnalysis }
 * - FIX: Border-Beam now ACTUALLY rotates around the input border (SVG)
 * - FIX: Auto-expand + auto-scroll for new strategies
 * - FIX: Strict dark theme (Slate-950 ONLY, no white mixing)
 *
 * FEATURES:
 * - Full-bleed dark theme (covers parent page)
 * - Hero Morning Briefing with Violet→Blue gradient text
 * - Border-Beam Pill Input (rotating gold glow on rim)
 * - Intelligent Inbox: 4 categories (Priority/Partners/Clients/Filtered)
 * - Action Steps Generator (Top 3 daily actions)
 * - Monochrome + Gold/Silver accents only
 * - Bottom-sheets on mobile, modals on desktop
 * - Shimmer loading effects
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
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
  CheckCircle2,
} from "lucide-react";

// ============================================================================
// TYPES — Matching BACKEND format (formatStrategy in routes/ceo-mind-os.ts)
// ============================================================================

interface CeoAnalysis {
  summary?: string;
  followUpQuestion?: string;
  roiCheck?: string;
  nextSteps?: string[];
  category?: string;
  magicTemplate?: string | null;
  resources?: Array<{ label: string; url: string; type: string }>;
  confidence?: number;
}

// IMPORTANT: Backend returns these EXACT field names!
interface CeoStrategy {
  id: string;
  userId?: string | null;
  thought: string;            // ← Backend field: "thought" (NOT userThought!)
  analysis?: CeoAnalysis | null; // ← Backend field: "analysis" (NOT aiAnalysis!)
  category?: string | null;
  status: "active" | "done" | "failed" | "archived";
  failureReason?: string | null;
  resources?: any[];
  createdAt: string;
  updatedAt: string;
}

interface InboundMail {
  id: string;
  sender: string;
  senderEmail?: string;
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
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingStrategies, setLoadingStrategies] = useState(true);
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({});

  // Modals
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
  const newStrategyRef = useRef<HTMLDivElement>(null);

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  useEffect(() => {
    loadAll();
    const pollInterval = setInterval(loadAll, 60000);
    return () => clearInterval(pollInterval);
  }, []);

  const loadAll = () => {
    loadStrategies();
    loadInbox();
    loadMorningBriefing();
  };

  const loadStrategies = async () => {
    setLoadingStrategies(true);
    try {
      const res = await fetch("/api/ceo-mind-os", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        // Backend returns array directly
        const list = Array.isArray(data) ? data : data?.strategies || [];
        setStrategies(list);
      }
    } catch (err) {
      console.error("[CMD-CENTER] Load strategies error:", err);
    } finally {
      setLoadingStrategies(false);
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
      console.error("[CMD-CENTER] Load inbox error:", err);
    }
  };

  const loadMorningBriefing = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/morning-briefing", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setMorningBriefing(data);
      }
    } catch (err) {
      console.error("[CMD-CENTER] Load briefing error:", err);
    }
  };

  // ============================================================================
  // INBOX CATEGORIZATION
  // ============================================================================

  const categorizedInbox = {
    priority: inboxMails.filter((m) => m.priorityLevel === "critical"),
    partners: inboxMails.filter((m) => {
      const s = (m.sender || "").toLowerCase();
      const a = (m.aiActionTaken || "").toLowerCase();
      return s.includes("partner") || s.includes("investor") || a.includes("partner") || a.includes("investor");
    }),
    clients: inboxMails.filter((m) => {
      const s = (m.sender || "").toLowerCase();
      const a = (m.aiActionTaken || "").toLowerCase();
      return s.includes("kunde") || s.includes("client") || a.includes("client") || a.includes("kunde");
    }),
    filtered: inboxMails.filter(
      (m) =>
        m.priorityLevel === "low" ||
        (m.aiActionTaken || "").toLowerCase().includes("spam") ||
        (m.aiActionTaken || "").toLowerCase().includes("info")
    ),
  };

  // Action Steps from inbox + strategies
  const actionSteps: ActionStep[] = [
    ...inboxMails
      .filter((m) => m.priorityLevel === "critical" || m.priorityLevel === "high")
      .slice(0, 2)
      .map((mail, idx) => ({
        id: `mail-${idx}`,
        text: `Antworte auf "${mail.subject}" von ${mail.sender}`,
        type: "email" as const,
        urgency: mail.priorityLevel === "critical" ? ("high" as const) : ("medium" as const),
      })),
    ...strategies
      .filter((s) => s.status === "active")
      .slice(0, 1)
      .map((s) => ({
        id: `strat-${s.id}`,
        text: s.analysis?.nextSteps?.[0] || `Strategie umsetzen: ${(s.thought || "").slice(0, 50)}...`,
        type: "strategy" as const,
        urgency: "medium" as const,
      })),
  ].slice(0, 3);

  // ============================================================================
  // VOICE RECORDING
  // ============================================================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processVoiceInput(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("[CMD-CENTER] Voice recording error:", err);
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
          body: JSON.stringify({ audioData: base64Audio, audioFormat: "webm" }),
        });
        if (res.ok) {
          await loadStrategies();
          setThought("");
        }
      };
    } catch (err) {
      console.error("[CMD-CENTER] Voice processing error:", err);
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

    try {
      const res = await fetch("/api/ceo-mind-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ thought: thought.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        // Backend returns formatStrategy() directly: { id, thought, analysis, ... }
        if (data && data.id) {
          setStrategies((prev) => [data, ...prev]);
          // AUTO-EXPAND so user sees the new card
          setExpandedCards((prev) => ({ ...prev, [data.id]: true }));
          setThought("");
          if (textareaRef.current) textareaRef.current.style.height = "auto";
          // AUTO-SCROLL to new card
          setTimeout(() => {
            newStrategyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 200);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[CMD-CENTER] Save error:", err);
        alert(`Fehler: ${err.detail || err.error || "Unbekannt"}`);
      }
    } catch (err) {
      console.error("[CMD-CENTER] Analyze error:", err);
      alert("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateReply = async (mail: InboundMail) => {
    setSelectedMail(mail);
    setShowReplyModal(true);
    setGeneratingReply(true);
    setReplyDraft("");

    try {
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
        setReplyDraft("Fehler beim Generieren. Bitte manuell schreiben.");
      }
    } catch (err) {
      console.error("[CMD-CENTER] Generate reply error:", err);
      setReplyDraft("Netzwerkfehler.");
    } finally {
      setGeneratingReply(false);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setThought(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // ============================================================================
  // RENDER — STARK EDITION
  // ============================================================================

  return (
    <div className="stark-root">
      {/* ANIMATED ATMOSPHERE BACKGROUND */}
      <div className="stark-atmosphere" aria-hidden="true">
        <div className="atmosphere-orb atmosphere-orb-1" />
        <div className="atmosphere-orb atmosphere-orb-2" />
        <div className="atmosphere-grid" />
      </div>

      <div className="stark-container">
        {/* ====== HERO: EXECUTIVE BRIEFING ====== */}
        <motion.section
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="stark-hero"
        >
          <div className="stark-hero-meta">
            <span className="stark-overline">FIAON COMMAND CENTER</span>
            <span className="stark-overline-divider">·</span>
            <span className="stark-overline-time">
              {new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
            </span>
          </div>

          <h1 className="stark-hero-title">
            <span className="stark-gradient-text">Executive Briefing</span>
          </h1>

          {morningBriefing?.briefing ? (
            <p className="stark-hero-briefing">{morningBriefing.briefing}</p>
          ) : (
            <p className="stark-hero-briefing stark-hero-briefing-muted">
              System bereit. Keine kritischen Vorgänge.
            </p>
          )}

          {/* GOLD STATS */}
          <div className="stark-stats-row">
            <div className="stark-stat">
              <div className="stark-stat-value-gold">
                {morningBriefing?.stats.newMails ?? inboxMails.length}
              </div>
              <div className="stark-stat-label">Inbox</div>
            </div>
            <div className="stark-stat-divider" />
            <div className="stark-stat">
              <div className="stark-stat-value-gold">
                {morningBriefing?.stats.criticalMails ?? categorizedInbox.priority.length}
              </div>
              <div className="stark-stat-label">Critical</div>
            </div>
            <div className="stark-stat-divider" />
            <div className="stark-stat">
              <div className="stark-stat-value-gold">
                {morningBriefing?.stats.openStrategies ??
                  strategies.filter((s) => s.status === "active").length}
              </div>
              <div className="stark-stat-label">Active</div>
            </div>
          </div>

          {/* ACTION STEPS */}
          {actionSteps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="stark-action-steps"
            >
              <div className="stark-action-header">
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Today's Priorities</span>
              </div>
              <div className="stark-action-list">
                {actionSteps.map((step, idx) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + idx * 0.1 }}
                    className="stark-action-item"
                  >
                    <div className="stark-action-number">0{idx + 1}</div>
                    <div className="stark-action-text">{step.text}</div>
                    <ArrowRight className="w-4 h-4 text-slate-500 stark-action-arrow" />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </motion.section>

        {/* ====== BORDER-BEAM PILL INPUT ====== */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="stark-input-section"
        >
          <div className="border-beam-wrapper">
            {/* SVG-based Border Beam — ROTATES AROUND THE ACTUAL BORDER */}
            <svg className="border-beam-svg" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(251, 191, 36, 0)" />
                  <stop offset="50%" stopColor="rgba(251, 191, 36, 0.9)" />
                  <stop offset="100%" stopColor="rgba(251, 191, 36, 0)" />
                </linearGradient>
              </defs>
              <rect
                className="border-beam-rect"
                x="1"
                y="1"
                width="calc(100% - 2px)"
                height="calc(100% - 2px)"
                rx="999"
                ry="999"
                fill="none"
                stroke="url(#beamGradient)"
                strokeWidth="2"
                pathLength="100"
              />
            </svg>

            <div className="stark-pill">
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
                className="stark-textarea"
                disabled={analyzing || isRecording || isTranscribing}
                rows={1}
              />

              <div className="stark-pill-actions">
                <button
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={analyzing || isTranscribing}
                  className={`stark-icon-button ${isRecording ? "is-recording" : ""}`}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                >
                  {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>

                <button
                  onClick={handleAnalyze}
                  disabled={!thought.trim() || analyzing || isRecording || isTranscribing}
                  className="stark-execute-button"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Execute</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <p className="stark-input-hint">
            {isRecording
              ? "● Recording..."
              : isTranscribing
              ? "○ Transcribing..."
              : analyzing
              ? "○ Analyzing..."
              : "⌘ + Enter to execute"}
          </p>
        </motion.section>

        {/* ====== INTELLIGENT INBOX (4 CATEGORIES) ====== */}
        {inboxMails.length > 0 && (
          <motion.section
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="stark-inbox-grid"
          >
            <InboxCategory
              title="PRIORITY"
              icon={<AlertCircle className="w-4 h-4" />}
              count={categorizedInbox.priority.length}
              accent="red"
              mails={categorizedInbox.priority}
              onMailClick={handleGenerateReply}
            />
            <InboxCategory
              title="PARTNERS"
              icon={<Shield className="w-4 h-4" />}
              count={categorizedInbox.partners.length}
              accent="silver"
              mails={categorizedInbox.partners}
              onMailClick={handleGenerateReply}
            />
            <InboxCategory
              title="CLIENTS"
              icon={<Users className="w-4 h-4" />}
              count={categorizedInbox.clients.length}
              accent="silver"
              mails={categorizedInbox.clients}
              onMailClick={handleGenerateReply}
            />
            <InboxCategory
              title="FILTERED"
              icon={<Filter className="w-4 h-4" />}
              count={categorizedInbox.filtered.length}
              accent="muted"
              mails={categorizedInbox.filtered}
              onMailClick={handleGenerateReply}
            />
          </motion.section>
        )}

        {/* ====== STRATEGIES TIMELINE ====== */}
        <section className="stark-timeline">
          {strategies.length > 0 && (
            <div className="stark-section-header">
              <span className="stark-overline">Timeline</span>
              <h2 className="stark-section-title">Strategien & Gedanken</h2>
            </div>
          )}

          {loadingStrategies && strategies.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="stark-shimmer h-32 rounded-2xl" />
              ))}
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {strategies.map((strategy, idx) => (
                <div ref={idx === 0 ? newStrategyRef : undefined} key={strategy.id}>
                  <StrategyCard
                    strategy={strategy}
                    expanded={expandedCards[strategy.id] || false}
                    onToggle={() => toggleCard(strategy.id)}
                  />
                </div>
              ))}
            </AnimatePresence>
          )}

          {!loadingStrategies && strategies.length === 0 && (
            <div className="stark-empty">
              <p className="text-slate-500 text-center text-sm">
                Noch keine Strategien. Beginne mit deinem ersten Gedanken oben.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ====== REPLY MODAL ====== */}
      <AnimatePresence>
        {showReplyModal && selectedMail && (
          <BottomSheetModal onClose={() => setShowReplyModal(false)}>
            <div className="p-8">
              <div className="stark-overline mb-2">REPLY DRAFT</div>
              <h3 className="text-2xl font-semibold text-white mb-1">{selectedMail.sender}</h3>
              <p className="text-sm text-slate-400 mb-6">Re: {selectedMail.subject}</p>

              {generatingReply ? (
                <div className="stark-shimmer h-48 rounded-xl mb-6" />
              ) : (
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  className="w-full bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-white text-sm leading-relaxed min-h-[220px] focus:border-amber-400 focus:outline-none resize-none mb-6"
                />
              )}

              <div className="flex gap-3">
                <button className="stark-execute-button flex-1 justify-center">
                  <Mail className="w-4 h-4" />
                  <span>Senden</span>
                </button>
                <button
                  onClick={() => setShowReplyModal(false)}
                  className="px-6 py-3 bg-white/5 text-slate-300 rounded-full font-medium hover:bg-white/10 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </BottomSheetModal>
        )}
      </AnimatePresence>

      {/* ====== STARK EDITION STYLES ====== */}
      <style>{starkStyles}</style>
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
  accent: "red" | "silver" | "muted";
  mails: InboundMail[];
  onMailClick: (m: InboundMail) => void;
}

function InboxCategory({ title, icon, count, accent, mails, onMailClick }: InboxCategoryProps) {
  const [open, setOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`stark-inbox-card stark-inbox-${accent}`}
      onClick={() => mails.length > 0 && setOpen(!open)}
    >
      <div className="stark-inbox-head">
        <div className="stark-inbox-icon">{icon}</div>
        <div className="stark-inbox-count">{count}</div>
      </div>
      <div className="stark-inbox-title">{title}</div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="stark-inbox-list"
            onClick={(e) => e.stopPropagation()}
          >
            {mails.slice(0, 4).map((mail) => (
              <button
                key={mail.id}
                onClick={() => onMailClick(mail)}
                className="stark-inbox-mail"
              >
                <div className="stark-inbox-mail-sender">{mail.sender}</div>
                <div className="stark-inbox-mail-subject">{mail.subject}</div>
              </button>
            ))}
            {mails.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-3">Leer</p>
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
  expanded: boolean;
  onToggle: () => void;
}

function StrategyCard({ strategy, expanded, onToggle }: StrategyCardProps) {
  // CRITICAL: Backend returns "thought" and "analysis" - NOT "userThought"/"aiAnalysis"
  const thoughtText = strategy.thought || "(kein Inhalt)";
  const analysis = strategy.analysis;
  const isDone = strategy.status === "done";
  const isFailed = strategy.status === "failed";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`stark-strategy-card ${isDone ? "is-done" : ""} ${isFailed ? "is-failed" : ""}`}
    >
      <div className="stark-strategy-header" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="stark-strategy-meta">
            <span className="stark-overline">
              {strategy.category || "Strategie"}
            </span>
            {analysis?.confidence !== undefined && (
              <span className="text-[10px] text-amber-300/60 tracking-widest">
                {Math.round((analysis.confidence || 0) * 100)}% CONFIDENCE
              </span>
            )}
          </div>
          <p className="stark-strategy-thought">{thoughtText}</p>
        </div>
        <button className="stark-icon-button-plain" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="stark-strategy-body"
          >
            {analysis?.summary && (
              <div className="stark-analysis-block">
                <div className="stark-overline mb-2">Analyse</div>
                <p className="stark-analysis-text">{analysis.summary}</p>
              </div>
            )}

            {analysis?.followUpQuestion && (
              <div className="stark-analysis-block">
                <div className="stark-overline mb-2">Rückfrage</div>
                <p className="stark-analysis-text italic">{analysis.followUpQuestion}</p>
              </div>
            )}

            {analysis?.roiCheck && (
              <div className="stark-analysis-block">
                <div className="stark-overline mb-2">ROI</div>
                <p className="stark-analysis-text">{analysis.roiCheck}</p>
              </div>
            )}

            {analysis?.nextSteps && analysis.nextSteps.length > 0 && (
              <div className="stark-analysis-block">
                <div className="stark-overline mb-3">Next Steps</div>
                <ul className="space-y-2">
                  {analysis.nextSteps.map((step, i) => (
                    <li key={i} className="stark-step-item">
                      <span className="stark-step-bullet">{String(i + 1).padStart(2, "0")}</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!analysis && (
              <p className="text-sm text-slate-500 italic">
                Analyse wird verarbeitet...
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// BOTTOM-SHEET MODAL (mobile) / CENTERED MODAL (desktop)
// ============================================================================

function BottomSheetModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end md:items-center justify-center"
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 250 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full md:max-w-2xl md:mx-4 stark-modal-shell"
      >
        <button onClick={onClose} className="absolute top-5 right-5 stark-icon-button-plain z-10">
          <X className="w-5 h-5" />
        </button>
        <div className="stark-modal-grip md:hidden" />
        <div className="overflow-y-auto max-h-[85vh]">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// STARK EDITION STYLESHEET
// ============================================================================

const starkStyles = `
  /* === ROOT === */
  .stark-root {
    position: relative;
    min-height: 100vh;
    width: 100%;
    margin-left: calc(-1 * (100vw - 100%) / 2);
    margin-right: calc(-1 * (100vw - 100%) / 2);
    width: 100vw;
    background: #020617;
    color: #f1f5f9;
    font-family: 'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;
    font-feature-settings: 'cv11', 'ss01';
    overflow: hidden;
    isolation: isolate;
  }

  .stark-container {
    position: relative;
    z-index: 1;
    max-width: 1280px;
    margin: 0 auto;
    padding: 48px 24px 96px;
  }

  @media (min-width: 768px) {
    .stark-container { padding: 80px 48px 120px; }
  }

  /* === ATMOSPHERE BACKGROUND === */
  .stark-atmosphere {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
    z-index: 0;
  }

  .atmosphere-orb {
    position: absolute;
    border-radius: 50%;
    filter: blur(120px);
    opacity: 0.5;
  }

  .atmosphere-orb-1 {
    top: -10%;
    left: -10%;
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(30, 58, 138, 0.45), transparent 65%);
    animation: orbFloat1 18s ease-in-out infinite;
  }

  .atmosphere-orb-2 {
    bottom: -20%;
    right: -10%;
    width: 600px;
    height: 600px;
    background: radial-gradient(circle, rgba(76, 29, 149, 0.35), transparent 65%);
    animation: orbFloat2 22s ease-in-out infinite;
  }

  @keyframes orbFloat1 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(60px, 80px) scale(1.15); }
  }

  @keyframes orbFloat2 {
    0%, 100% { transform: translate(0, 0) scale(1); }
    50% { transform: translate(-80px, -60px) scale(1.1); }
  }

  .atmosphere-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(148, 163, 184, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(148, 163, 184, 0.04) 1px, transparent 1px);
    background-size: 64px 64px;
    mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);
  }

  /* === HERO === */
  .stark-hero {
    margin-bottom: 48px;
  }

  .stark-hero-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }

  .stark-overline {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #64748b;
  }

  .stark-overline-divider {
    color: #334155;
  }

  .stark-overline-time {
    font-size: 10px;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #94a3b8;
  }

  .stark-hero-title {
    font-size: clamp(2.5rem, 6vw, 4.5rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.04em;
    margin-bottom: 24px;
  }

  .stark-gradient-text {
    background: linear-gradient(135deg, #c4b5fd 0%, #93c5fd 45%, #67e8f9 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    filter: drop-shadow(0 0 40px rgba(147, 197, 253, 0.15));
  }

  .stark-hero-briefing {
    font-size: clamp(1rem, 1.5vw, 1.125rem);
    line-height: 1.7;
    color: #cbd5e1;
    max-width: 720px;
    margin-bottom: 40px;
    font-weight: 400;
  }

  .stark-hero-briefing-muted {
    color: #64748b;
    font-style: italic;
  }

  /* === STATS ROW === */
  .stark-stats-row {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 24px 0;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    border-bottom: 1px solid rgba(148, 163, 184, 0.08);
    margin-bottom: 32px;
  }

  .stark-stat {
    flex: 1;
  }

  .stark-stat-divider {
    width: 1px;
    height: 40px;
    background: linear-gradient(to bottom, transparent, rgba(148, 163, 184, 0.2), transparent);
  }

  .stark-stat-value-gold {
    font-size: clamp(2rem, 4vw, 2.75rem);
    font-weight: 700;
    line-height: 1;
    background: linear-gradient(135deg, #fde68a 0%, #fbbf24 50%, #d97706 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
    letter-spacing: -0.03em;
    margin-bottom: 6px;
  }

  .stark-stat-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #64748b;
  }

  /* === ACTION STEPS === */
  .stark-action-steps {
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.6), rgba(15, 23, 42, 0.3));
    border: 1px solid rgba(251, 191, 36, 0.12);
    border-radius: 20px;
    padding: 24px;
    backdrop-filter: blur(20px);
  }

  .stark-action-header {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #fcd34d;
    margin-bottom: 16px;
  }

  .stark-action-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .stark-action-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 14px 12px;
    border-radius: 12px;
    transition: background 0.2s ease;
    cursor: pointer;
  }

  .stark-action-item:hover {
    background: rgba(251, 191, 36, 0.04);
  }

  .stark-action-item:hover .stark-action-arrow {
    color: #fcd34d;
    transform: translateX(2px);
  }

  .stark-action-number {
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    color: #fbbf24;
    letter-spacing: 0.05em;
    min-width: 24px;
  }

  .stark-action-text {
    flex: 1;
    font-size: 14px;
    color: #e2e8f0;
    font-weight: 400;
  }

  .stark-action-arrow {
    transition: all 0.2s ease;
  }

  /* === BORDER-BEAM PILL INPUT === */
  .stark-input-section {
    margin-bottom: 56px;
  }

  .border-beam-wrapper {
    position: relative;
    border-radius: 9999px;
    background: linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(15, 23, 42, 0.7));
    backdrop-filter: blur(40px) saturate(180%);
    border: 1px solid rgba(148, 163, 184, 0.1);
    box-shadow:
      0 24px 60px -20px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.04);
    overflow: hidden;
  }

  /* SVG-based Border Beam — actually rotates on the rim! */
  .border-beam-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }

  @keyframes beamRotate {
    0% { stroke-dasharray: 25 75; stroke-dashoffset: 100; }
    100% { stroke-dasharray: 25 75; stroke-dashoffset: 0; }
  }

  .border-beam-rect {
    animation: beamRotate 4s linear infinite;
    filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.6));
  }

  .stark-pill {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    gap: 16px;
    padding: 14px 14px 14px 28px;
  }

  .stark-textarea {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    color: #f1f5f9;
    font-size: 16px;
    line-height: 1.6;
    font-family: inherit;
    padding: 12px 0;
    min-height: 28px;
    max-height: 200px;
  }

  .stark-textarea::placeholder {
    color: #64748b;
    font-weight: 400;
  }

  .stark-pill-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .stark-icon-button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .stark-icon-button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .stark-icon-button.is-recording {
    background: rgba(239, 68, 68, 0.15);
    color: #fca5a5;
    border-color: rgba(239, 68, 68, 0.3);
    animation: recordPulse 1.5s ease-in-out infinite;
  }

  @keyframes recordPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
  }

  .stark-icon-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .stark-icon-button-plain {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .stark-icon-button-plain:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #f1f5f9;
  }

  .stark-execute-button {
    height: 40px;
    padding: 0 22px;
    border-radius: 9999px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    border: 1px solid rgba(251, 191, 36, 0.4);
    color: #fde68a;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.05em;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.25s ease;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 0 20px rgba(251, 191, 36, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  }

  .stark-execute-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%);
    color: #0f172a;
    border-color: #fbbf24;
    box-shadow: 0 0 30px rgba(251, 191, 36, 0.4);
    transform: translateY(-1px);
  }

  .stark-execute-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .stark-input-hint {
    font-size: 11px;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    color: #475569;
    text-align: center;
    margin-top: 14px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }

  /* === INTELLIGENT INBOX === */
  .stark-inbox-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 56px;
  }

  @media (min-width: 768px) {
    .stark-inbox-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
  }

  .stark-inbox-card {
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(148, 163, 184, 0.08);
    border-radius: 18px;
    padding: 20px;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .stark-inbox-card:hover {
    border-color: rgba(148, 163, 184, 0.15);
    background: rgba(15, 23, 42, 0.7);
    transform: translateY(-2px);
  }

  .stark-inbox-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .stark-inbox-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .stark-inbox-red .stark-inbox-icon { color: #fca5a5; background: rgba(239, 68, 68, 0.08); }
  .stark-inbox-silver .stark-inbox-icon { color: #cbd5e1; }
  .stark-inbox-muted .stark-inbox-icon { color: #64748b; }

  .stark-inbox-count {
    font-size: 28px;
    font-weight: 700;
    color: #f1f5f9;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .stark-inbox-red .stark-inbox-count {
    background: linear-gradient(135deg, #fca5a5, #ef4444);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .stark-inbox-title {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #64748b;
  }

  .stark-inbox-list {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(148, 163, 184, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .stark-inbox-mail {
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 8px;
    transition: background 0.2s ease;
    cursor: pointer;
  }

  .stark-inbox-mail:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .stark-inbox-mail-sender {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .stark-inbox-mail-subject {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* === TIMELINE === */
  .stark-timeline {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .stark-section-header {
    margin-bottom: 8px;
  }

  .stark-section-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #f1f5f9;
    letter-spacing: -0.02em;
    margin-top: 4px;
  }

  /* === STRATEGY CARD === */
  .stark-strategy-card {
    background: rgba(15, 23, 42, 0.55);
    backdrop-filter: blur(20px);
    border: 1px solid rgba(148, 163, 184, 0.08);
    border-radius: 20px;
    overflow: hidden;
    transition: all 0.3s ease;
  }

  .stark-strategy-card:hover {
    border-color: rgba(251, 191, 36, 0.15);
    box-shadow: 0 0 40px rgba(251, 191, 36, 0.04);
  }

  .stark-strategy-card.is-done {
    opacity: 0.55;
  }

  .stark-strategy-header {
    display: flex;
    align-items: flex-start;
    gap: 16px;
    padding: 24px 24px 20px;
    cursor: pointer;
  }

  .stark-strategy-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }

  .stark-strategy-thought {
    font-size: 16px;
    line-height: 1.6;
    color: #f1f5f9;
    font-weight: 400;
  }

  .stark-strategy-body {
    padding: 0 24px 24px;
    border-top: 1px solid rgba(148, 163, 184, 0.06);
    margin-top: 4px;
  }

  .stark-analysis-block {
    padding-top: 20px;
  }

  .stark-analysis-text {
    font-size: 14px;
    line-height: 1.65;
    color: #cbd5e1;
  }

  .stark-step-item {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    font-size: 14px;
    color: #cbd5e1;
    line-height: 1.55;
  }

  .stark-step-bullet {
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
    font-size: 11px;
    color: #fbbf24;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    padding-top: 2px;
    min-width: 22px;
  }

  /* === EMPTY STATE === */
  .stark-empty {
    padding: 40px 20px;
    background: rgba(15, 23, 42, 0.3);
    border: 1px dashed rgba(148, 163, 184, 0.12);
    border-radius: 16px;
  }

  /* === SHIMMER === */
  @keyframes shimmer {
    0% { background-position: -1000px 0; }
    100% { background-position: 1000px 0; }
  }

  .stark-shimmer {
    background: linear-gradient(
      90deg,
      rgba(15, 23, 42, 0.6) 0%,
      rgba(30, 41, 59, 0.8) 50%,
      rgba(15, 23, 42, 0.6) 100%
    );
    background-size: 1000px 100%;
    animation: shimmer 2.5s infinite;
  }

  /* === MODAL === */
  .stark-modal-shell {
    position: relative;
    background: linear-gradient(180deg, #0f172a 0%, #020617 100%);
    border-top: 1px solid rgba(251, 191, 36, 0.15);
    border-radius: 24px 24px 0 0;
    box-shadow: 0 -20px 60px rgba(0, 0, 0, 0.6);
  }

  @media (min-width: 768px) {
    .stark-modal-shell {
      border-radius: 24px;
      border: 1px solid rgba(148, 163, 184, 0.12);
    }
  }

  .stark-modal-grip {
    width: 40px;
    height: 4px;
    background: rgba(148, 163, 184, 0.3);
    border-radius: 999px;
    margin: 12px auto 0;
  }
`;
