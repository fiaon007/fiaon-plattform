/**
 * ============================================================================
 * CEO MIND-OS — ULTRA-CLEAN EXECUTIVE HUD
 * ============================================================================
 * Clean. White. Blue. Transparent. High-End (ChatGPT/Gemini style).
 *
 * Layout:
 *   1. Greeting (Guten Morgen, Justin!)
 *   2. Neural Pill Input (white + animated blue border-glow)
 *   3. Three-Pillar Overview: Inbox | Brain | Tasks
 *
 * Backend mapping (CRITICAL — do not change):
 *   Backend returns: { id, thought, analysis, status, ... }
 *   NOT: { userThought, aiAnalysis }
 * ============================================================================
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  Mail,
  X,
  ChevronRight,
  Mic,
  MicOff,
  Inbox,
  Brain,
  CheckCircle2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface CeoAnalysis {
  summary?: string;
  followUpQuestion?: string;
  roiCheck?: string;
  nextSteps?: string[];
  category?: string;
  resources?: Array<{ label: string; url: string; type: string }>;
  confidence?: number;
}

interface CeoStrategy {
  id: string;
  thought: string;
  analysis?: CeoAnalysis | null;
  category?: string | null;
  status: "active" | "done" | "failed" | "archived";
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

interface TeamTodo {
  id: string;
  title: string;
  status: string;
  urgency_score?: number;
  due_date?: string | null;
}

interface MorningBriefing {
  briefing: string;
  stats: { newMails: number; criticalMails: number; openStrategies: number };
}

// ============================================================================
// UTIL
// ============================================================================

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Gute Nacht";
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Guten Tag";
  if (h < 22) return "Guten Abend";
  return "Gute Nacht";
}

function formatDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CeoMindOS() {
  const [thought, setThought] = useState("");
  const [strategies, setStrategies] = useState<CeoStrategy[]>([]);
  const [inboxMails, setInboxMails] = useState<InboundMail[]>([]);
  const [todos, setTodos] = useState<TeamTodo[]>([]);
  const [briefing, setBriefing] = useState<MorningBriefing | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const [selectedStrategy, setSelectedStrategy] = useState<CeoStrategy | null>(null);

  // Reply modal
  const [selectedMail, setSelectedMail] = useState<InboundMail | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [generatingReply, setGeneratingReply] = useState(false);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================================
  // DATA LOAD
  // ============================================================================

  useEffect(() => {
    loadAll();
    const t = setInterval(loadAll, 60000);
    return () => clearInterval(t);
  }, []);

  const loadAll = async () => {
    await Promise.all([loadStrategies(), loadInbox(), loadTodos(), loadBriefing()]);
    setLoadingData(false);
  };

  const loadStrategies = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setStrategies(Array.isArray(data) ? data : data?.strategies || []);
      }
    } catch (e) {
      console.error("[CEO-HUD] strategies:", e);
    }
  };

  const loadInbox = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/inbox", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setInboxMails(data.mails || []);
      }
    } catch (e) {
      console.error("[CEO-HUD] inbox:", e);
    }
  };

  const loadTodos = async () => {
    try {
      const res = await fetch("/api/todos", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTodos(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("[CEO-HUD] todos:", e);
    }
  };

  const loadBriefing = async () => {
    try {
      const res = await fetch("/api/ceo-mind-os/morning-briefing", { credentials: "include" });
      if (res.ok) setBriefing(await res.json());
    } catch (e) {
      console.error("[CEO-HUD] briefing:", e);
    }
  };

  // ============================================================================
  // VOICE RECORDING
  // ============================================================================

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await processVoice(blob);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setIsRecording(true);
    } catch (err) {
      console.error("[CEO-HUD] recording:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsTranscribing(true);
    }
  };

  const processVoice = async (audioBlob: Blob) => {
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
        if (res.ok) await loadStrategies();
      };
    } catch (err) {
      console.error("[CEO-HUD] voice processing:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ============================================================================
  // EXECUTE / ANALYZE
  // ============================================================================

  const handleExecute = async () => {
    const txt = thought.trim();
    if (!txt || analyzing) return;
    setAnalyzing(true);

    try {
      const res = await fetch("/api/ceo-mind-os", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ thought: txt }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          // PERSISTENCE GUARANTEE: new card appears at top instantly
          setStrategies((prev) => [data, ...prev]);
          setSelectedStrategy(data); // auto-open detail pane
          setThought("");
          if (textareaRef.current) textareaRef.current.style.height = "auto";
        }
      } else {
        const err = await res.json().catch(() => ({}));
        console.error("[CEO-HUD] save error:", err);
        alert(`Fehler: ${err.detail || err.error || "Unbekannt"}`);
      }
    } catch (err) {
      console.error("[CEO-HUD] execute:", err);
      alert("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateReply = async (mail: InboundMail) => {
    setSelectedMail(mail);
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
        const d = await res.json();
        setReplyDraft(d.reply || "");
      } else {
        setReplyDraft("Fehler beim Generieren. Bitte manuell formulieren.");
      }
    } catch (err) {
      console.error("[CEO-HUD] reply:", err);
      setReplyDraft("Netzwerkfehler.");
    } finally {
      setGeneratingReply(false);
    }
  };

  const onTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setThought(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 180)}px`;
  };

  // ============================================================================
  // DERIVED DATA
  // ============================================================================

  const topInbox = inboxMails
    .slice()
    .sort((a, b) => {
      const r = { critical: 0, high: 1, normal: 2, low: 3 } as const;
      return (r[a.priorityLevel] ?? 4) - (r[b.priorityLevel] ?? 4);
    })
    .slice(0, 3);

  const topStrategies = strategies.filter((s) => s.status === "active").slice(0, 3);

  const topTodos = todos
    .filter((t) => t.status !== "done" && t.status !== "resolved")
    .slice()
    .sort((a, b) => (b.urgency_score ?? 50) - (a.urgency_score ?? 50))
    .slice(0, 3);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="ceo-hud">
      {/* === GREETING === */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="ceo-hud-greeting"
      >
        <h2 className="ceo-hud-title">
          {getGreeting()}, <span className="ceo-hud-title-accent">Justin</span>
        </h2>
        <p className="ceo-hud-date">{formatDate()}</p>

        {briefing?.briefing && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="ceo-hud-briefing"
          >
            {briefing.briefing}
          </motion.p>
        )}
      </motion.div>

      {/* === NEURAL PILL INPUT === */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        className="ceo-hud-input-wrap"
      >
        <div className="neural-pill">
          {/* SVG border beam that follows the actual pill border */}
          <svg className="neural-pill-beam" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="ceoBeamGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(37, 99, 235, 0)" />
                <stop offset="50%" stopColor="rgba(37, 99, 235, 0.9)" />
                <stop offset="100%" stopColor="rgba(37, 99, 235, 0)" />
              </linearGradient>
            </defs>
            <rect
              className="neural-pill-rect"
              x="0.5"
              y="0.5"
              width="calc(100% - 1px)"
              height="calc(100% - 1px)"
              rx="999"
              ry="999"
              fill="none"
              stroke="url(#ceoBeamGrad)"
              strokeWidth="1"
              pathLength="100"
            />
          </svg>

          <div className="neural-pill-inner">
            <Sparkles className="neural-pill-spark" />
            <textarea
              ref={textareaRef}
              value={thought}
              onChange={onTextareaInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
              placeholder="Was beschäftigt dich strategisch? Tippe oder sprich deinen Gedanken ein…"
              className="neural-pill-input"
              disabled={analyzing || isRecording || isTranscribing}
              rows={1}
            />

            <div className="neural-pill-actions">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={analyzing || isTranscribing}
                className={`neural-icon-btn ${isRecording ? "is-recording" : ""}`}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                onClick={handleExecute}
                disabled={!thought.trim() || analyzing || isRecording || isTranscribing}
                className="neural-execute-btn"
              >
                {analyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>{analyzing ? "Denke nach…" : "Execute"}</span>
              </button>
            </div>
          </div>
        </div>

        <p className="neural-hint">
          {isRecording
            ? "● Aufnahme läuft…"
            : isTranscribing
            ? "○ Transkribiere…"
            : analyzing
            ? "○ KI analysiert…"
            : "⌘ + Enter zum Ausführen"}
        </p>
      </motion.div>

      {/* === THREE-PILLAR OVERVIEW === */}
      <div className="ceo-hud-pillars">
        {/* INBOX */}
        <PillarCard
          title="Postfach"
          subtitle="Top 3 priorisiert"
          accent="blue"
          icon={<Inbox className="w-4 h-4" />}
          count={inboxMails.length}
          loading={loadingData}
          empty={topInbox.length === 0 ? "Keine Mails" : undefined}
        >
          {topInbox.map((mail) => (
            <button
              key={mail.id}
              onClick={() => handleGenerateReply(mail)}
              className="pillar-item"
            >
              <div className="pillar-item-row">
                <span className="pillar-item-title">{mail.sender}</span>
                {mail.priorityLevel === "critical" && (
                  <span className="pillar-badge pillar-badge-red">KRITISCH</span>
                )}
                {mail.priorityLevel === "high" && (
                  <span className="pillar-badge pillar-badge-amber">WICHTIG</span>
                )}
              </div>
              <p className="pillar-item-sub">{mail.subject}</p>
              <div className="pillar-item-cta">
                Draft erstellen <ArrowUpRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </PillarCard>

        {/* BRAIN */}
        <PillarCard
          title="Gedanken"
          subtitle="Letzte Strategien"
          accent="indigo"
          icon={<Brain className="w-4 h-4" />}
          count={strategies.filter((s) => s.status === "active").length}
          loading={loadingData}
          empty={topStrategies.length === 0 ? "Noch keine Gedanken" : undefined}
        >
          {topStrategies.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedStrategy(s)}
              className="pillar-item"
            >
              <div className="pillar-item-row">
                <span className="pillar-item-title pillar-item-title-clamp">
                  {s.thought || "(kein Inhalt)"}
                </span>
              </div>
              {s.analysis?.summary && (
                <p className="pillar-item-sub">{s.analysis.summary}</p>
              )}
              <div className="pillar-item-cta">
                Details öffnen <ArrowUpRight className="w-3 h-3" />
              </div>
            </button>
          ))}
        </PillarCard>

        {/* TODOS */}
        <PillarCard
          title="Aufgaben"
          subtitle="Dringlichste Todos"
          accent="emerald"
          icon={<CheckCircle2 className="w-4 h-4" />}
          count={todos.filter((t) => t.status !== "done" && t.status !== "resolved").length}
          loading={loadingData}
          empty={topTodos.length === 0 ? "Alles erledigt" : undefined}
        >
          {topTodos.map((t) => (
            <div key={t.id} className="pillar-item">
              <div className="pillar-item-row">
                <span className="pillar-item-title pillar-item-title-clamp">{t.title}</span>
                {(t.urgency_score ?? 0) >= 80 && (
                  <span className="pillar-badge pillar-badge-red">HIGH</span>
                )}
              </div>
              {t.due_date && (
                <p className="pillar-item-sub">
                  Fällig: {new Date(t.due_date).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          ))}
        </PillarCard>
      </div>

      {/* === STRATEGY DETAIL MODAL === */}
      <AnimatePresence>
        {selectedStrategy && (
          <CleanModal onClose={() => setSelectedStrategy(null)}>
            <div className="p-8 sm:p-10">
              <span className="ceo-hud-overline ceo-hud-overline-blue">
                {selectedStrategy.category || "STRATEGIE"}
              </span>
              <p className="text-xl text-slate-900 font-semibold mt-3 mb-6 leading-snug">
                {selectedStrategy.thought}
              </p>

              {!selectedStrategy.analysis && (
                <div className="clean-shimmer h-28 rounded-xl" />
              )}

              {selectedStrategy.analysis?.summary && (
                <AnalysisBlock label="Analyse">
                  {selectedStrategy.analysis.summary}
                </AnalysisBlock>
              )}

              {selectedStrategy.analysis?.followUpQuestion && (
                <AnalysisBlock label="Rückfrage">
                  <em className="text-slate-700">
                    {selectedStrategy.analysis.followUpQuestion}
                  </em>
                </AnalysisBlock>
              )}

              {selectedStrategy.analysis?.roiCheck && (
                <AnalysisBlock label="ROI">
                  {selectedStrategy.analysis.roiCheck}
                </AnalysisBlock>
              )}

              {selectedStrategy.analysis?.nextSteps &&
                selectedStrategy.analysis.nextSteps.length > 0 && (
                  <AnalysisBlock label="Next Steps">
                    <ol className="space-y-2.5 mt-1">
                      {selectedStrategy.analysis.nextSteps.map((step, i) => (
                        <li key={i} className="flex gap-3 items-start text-slate-700 text-sm leading-relaxed">
                          <span className="font-mono text-xs text-blue-600 font-semibold pt-0.5 min-w-[20px]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </AnalysisBlock>
                )}
            </div>
          </CleanModal>
        )}
      </AnimatePresence>

      {/* === REPLY DRAFT MODAL === */}
      <AnimatePresence>
        {selectedMail && (
          <CleanModal onClose={() => setSelectedMail(null)}>
            <div className="p-8 sm:p-10">
              <span className="ceo-hud-overline ceo-hud-overline-blue">REPLY DRAFT</span>
              <h3 className="text-xl font-semibold text-slate-900 mt-3 mb-1">
                {selectedMail.sender}
              </h3>
              <p className="text-sm text-slate-500 mb-6">Re: {selectedMail.subject}</p>

              {generatingReply ? (
                <div className="clean-shimmer h-44 rounded-xl mb-6" />
              ) : (
                <textarea
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 text-sm leading-relaxed min-h-[200px] focus:border-blue-400 focus:ring-4 focus:ring-blue-50 focus:outline-none resize-none mb-6"
                />
              )}

              <div className="flex gap-3">
                <button className="neural-execute-btn flex-1 justify-center">
                  <Mail className="w-4 h-4" />
                  <span>Senden</span>
                </button>
                <button
                  onClick={() => setSelectedMail(null)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-full text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </div>
          </CleanModal>
        )}
      </AnimatePresence>

      <style>{hudStyles}</style>
    </div>
  );
}

// ============================================================================
// PILLAR CARD
// ============================================================================

interface PillarCardProps {
  title: string;
  subtitle: string;
  accent: "blue" | "indigo" | "emerald";
  icon: React.ReactNode;
  count: number;
  loading?: boolean;
  empty?: string;
  children?: React.ReactNode;
}

function PillarCard({ title, subtitle, accent, icon, count, loading, empty, children }: PillarCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 180 }}
      className={`pillar-card pillar-card-${accent}`}
    >
      <div className="pillar-head">
        <div className={`pillar-icon pillar-icon-${accent}`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <h3 className="pillar-title">{title}</h3>
          <p className="pillar-subtitle">{subtitle}</p>
        </div>
        <div className={`pillar-count pillar-count-${accent}`}>{count}</div>
      </div>

      <div className="pillar-body">
        {loading ? (
          <div className="space-y-2">
            <div className="clean-shimmer h-14 rounded-lg" />
            <div className="clean-shimmer h-14 rounded-lg" />
          </div>
        ) : empty ? (
          <p className="pillar-empty">{empty}</p>
        ) : (
          <div className="space-y-2">{children}</div>
        )}
      </div>
    </motion.div>
  );
}

// ============================================================================
// ANALYSIS BLOCK
// ============================================================================

function AnalysisBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="ceo-hud-overline ceo-hud-overline-blue mb-2">{label}</div>
      <div className="text-sm text-slate-700 leading-relaxed">{children}</div>
    </div>
  );
}

// ============================================================================
// CLEAN MODAL
// ============================================================================

function CleanModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-end sm:items-center justify-center"
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 28, stiffness: 260 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-2xl sm:mx-4 bg-white/95 backdrop-blur-2xl border border-white/60 rounded-t-[28px] sm:rounded-[28px] shadow-[0_20px_60px_-15px_rgba(31,38,135,0.25)] max-h-[90vh] overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors z-10"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="sm:hidden w-10 h-1 bg-slate-200 rounded-full mx-auto mt-3" />
        <div className="overflow-y-auto max-h-[90vh]">{children}</div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const hudStyles = `
  .ceo-hud {
    position: relative;
    width: 100%;
    padding: 0;
    margin: 0 0 56px;
    font-family: 'Inter', 'Inter Variable', -apple-system, BlinkMacSystemFont, sans-serif;
  }

  /* === GREETING === */
  .ceo-hud-greeting {
    margin-bottom: 36px;
  }

  .ceo-hud-title {
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: -0.035em;
    color: #0f172a;
    margin-bottom: 10px;
  }

  .ceo-hud-title-accent {
    background: linear-gradient(135deg, #2563eb 0%, #6366f1 100%);
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    color: transparent;
  }

  .ceo-hud-date {
    font-size: 14px;
    color: #2563eb;
    font-weight: 500;
    letter-spacing: 0.01em;
    text-transform: capitalize;
    margin-bottom: 20px;
  }

  .ceo-hud-briefing {
    font-size: 15px;
    line-height: 1.7;
    color: #475569;
    max-width: 760px;
    font-weight: 400;
  }

  .ceo-hud-overline {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #64748b;
  }

  .ceo-hud-overline-blue { color: #2563eb; }

  /* === NEURAL PILL INPUT === */
  .ceo-hud-input-wrap {
    margin-bottom: 40px;
    max-width: 720px;
    margin-left: auto;
    margin-right: auto;
  }

  .neural-pill {
    position: relative;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(24px) saturate(180%);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    box-shadow:
      0 8px 32px 0 rgba(31, 38, 135, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
    overflow: visible;
  }

  .neural-pill-beam {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }

  @keyframes neuralBeamRotate {
    0%   { stroke-dasharray: 22 78; stroke-dashoffset: 100; }
    100% { stroke-dasharray: 22 78; stroke-dashoffset: 0; }
  }

  .neural-pill-rect {
    animation: neuralBeamRotate 5s linear infinite;
    filter: drop-shadow(0 0 6px rgba(37, 99, 235, 0.6));
  }

  .neural-pill-inner {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: flex-end;
    gap: 12px;
    padding: 12px 12px 12px 22px;
  }

  .neural-pill-spark {
    width: 18px;
    height: 18px;
    color: #6366f1;
    flex-shrink: 0;
    margin-bottom: 13px;
    opacity: 0.6;
  }

  .neural-pill-input {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    color: #0f172a;
    padding: 11px 0;
    min-height: 24px;
    max-height: 180px;
  }

  .neural-pill-input::placeholder {
    color: #94a3b8;
    font-weight: 400;
  }

  .neural-pill-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .neural-icon-btn {
    width: 38px;
    height: 38px;
    border-radius: 50%;
    background: #f1f5f9;
    border: 1px solid rgba(148, 163, 184, 0.15);
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.18s ease;
    cursor: pointer;
  }

  .neural-icon-btn:hover:not(:disabled) {
    background: #e2e8f0;
    color: #0f172a;
  }

  .neural-icon-btn.is-recording {
    background: #fee2e2;
    color: #dc2626;
    border-color: rgba(220, 38, 38, 0.2);
    animation: neuralRecPulse 1.4s ease-in-out infinite;
  }

  @keyframes neuralRecPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.3); }
    50%      { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0); }
  }

  .neural-icon-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .neural-execute-btn {
    height: 38px;
    padding: 0 20px;
    border-radius: 9999px;
    background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
    border: none;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.01em;
    display: flex;
    align-items: center;
    gap: 7px;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: 0 4px 14px -2px rgba(37, 99, 235, 0.35);
    white-space: nowrap;
  }

  .neural-execute-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 22px -4px rgba(37, 99, 235, 0.5);
  }

  .neural-execute-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
    box-shadow: none;
  }

  .neural-hint {
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #94a3b8;
    text-align: center;
    margin-top: 12px;
    font-family: 'JetBrains Mono', 'SF Mono', monospace;
  }

  /* === THREE PILLARS === */
  .ceo-hud-pillars {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
  }

  @media (min-width: 1024px) {
    .ceo-hud-pillars {
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }
  }

  .pillar-card {
    position: relative;
    background: rgba(255, 255, 255, 0.75);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.7);
    border-radius: 24px;
    padding: 24px;
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.06);
    transition: box-shadow 0.3s ease, transform 0.3s ease;
  }

  .pillar-card:hover {
    box-shadow: 0 12px 40px 0 rgba(31, 38, 135, 0.1);
    transform: translateY(-2px);
  }

  .pillar-head {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 18px;
  }

  .pillar-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .pillar-icon-blue    { background: #eff6ff; color: #2563eb; }
  .pillar-icon-indigo  { background: #eef2ff; color: #4f46e5; }
  .pillar-icon-emerald { background: #ecfdf5; color: #059669; }

  .pillar-title {
    font-size: 15px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  .pillar-subtitle {
    font-size: 11px;
    color: #94a3b8;
    letter-spacing: 0.02em;
    margin-top: 2px;
  }

  .pillar-count {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.04em;
    line-height: 1;
  }

  .pillar-count-blue    { color: #2563eb; }
  .pillar-count-indigo  { color: #4f46e5; }
  .pillar-count-emerald { color: #059669; }

  .pillar-body { min-height: 60px; }

  .pillar-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(226, 232, 240, 0.8);
    border-radius: 12px;
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .pillar-item:hover {
    background: #fff;
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -4px rgba(15, 23, 42, 0.08);
  }

  .pillar-item-row {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  .pillar-item-title {
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    letter-spacing: -0.005em;
  }

  .pillar-item-title-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
  }

  .pillar-item-sub {
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .pillar-item-cta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #2563eb;
    margin-top: 6px;
    letter-spacing: 0.01em;
  }

  .pillar-badge {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    padding: 3px 7px;
    border-radius: 999px;
    flex-shrink: 0;
  }

  .pillar-badge-red   { background: #fef2f2; color: #dc2626; }
  .pillar-badge-amber { background: #fffbeb; color: #d97706; }

  .pillar-empty {
    font-size: 13px;
    color: #94a3b8;
    text-align: center;
    padding: 20px 0;
    font-style: italic;
  }

  /* === SHIMMER === */
  @keyframes cleanShimmer {
    0%   { background-position: -800px 0; }
    100% { background-position: 800px 0; }
  }

  .clean-shimmer {
    background: linear-gradient(90deg, #f1f5f9 0%, #f8fafc 50%, #f1f5f9 100%);
    background-size: 800px 100%;
    animation: cleanShimmer 2.2s infinite linear;
  }
`;
