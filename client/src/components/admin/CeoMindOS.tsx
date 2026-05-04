"use client";

/**
 * ============================================================================
 * CEO Mind-OS — Executive Strategy Notebook
 * ============================================================================
 * - Glassmorphism bento card zwischen Begrüßung und Todo-Liste
 * - Auto-growing textarea (Fokus-State)
 * - Mind-Cards mit KI-Rückfrage, ROI-Check, Magic-Button, Failure-Flow
 * - Framer-Motion Animationen
 * - Groq + Tavily Backend: /api/ceo-mind-os
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Archive,
  Copy,
  Check,
  ExternalLink,
  Globe,
  AlertTriangle,
  Lightbulb,
  Target,
  Briefcase,
  Megaphone,
  TrendingUp,
  Wallet,
  Settings2,
  Compass,
  Package,
  Scale,
  ArrowRight,
  X,
  Trash2,
} from "lucide-react";

// ============================================================================
// TYPES (mirror server/services/ceoAgent.ts)
// ============================================================================

type MindCategory =
  | "personal"
  | "marketing"
  | "sales"
  | "finance"
  | "operations"
  | "strategy"
  | "product"
  | "legal"
  | "general";

type TemplateKind =
  | "job_posting"
  | "marketing_script"
  | "cold_email"
  | "contract"
  | "sales_script";

interface MagicTemplate {
  kind: TemplateKind;
  title: string;
  content: string;
  cta?: string;
}

interface ResourceLink {
  label: string;
  url: string;
  type?: "portal" | "article" | "tool" | "reference";
}

interface FailureAnalysis {
  empathy: string;
  opportunityCost: string;
  alternatives: string[];
  recommendation: string;
}

interface CeoAnalysis {
  summary: string;
  followUpQuestion: string;
  roiCheck: string;
  nextSteps: string[];
  category: MindCategory;
  magicTemplate: MagicTemplate | null;
  resources: ResourceLink[];
  confidence: number;
  failureAnalysis?: FailureAnalysis;
  meta?: { model: string; usedWebSearch: boolean; searchQuery?: string };
}

interface Strategy {
  id: string;
  thought: string;
  analysis: CeoAnalysis | null;
  category: MindCategory;
  status: "active" | "done" | "failed" | "archived";
  failureReason: string | null;
  resources: ResourceLink[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// UI CONSTANTS
// ============================================================================

const CATEGORY_META: Record<
  MindCategory,
  { label: string; icon: any; gradient: string; tint: string }
> = {
  personal: {
    label: "Personal",
    icon: Briefcase,
    gradient: "from-violet-500 to-indigo-600",
    tint: "bg-violet-50 text-violet-700 border-violet-100",
  },
  marketing: {
    label: "Marketing",
    icon: Megaphone,
    gradient: "from-pink-500 to-rose-600",
    tint: "bg-pink-50 text-pink-700 border-pink-100",
  },
  sales: {
    label: "Sales",
    icon: TrendingUp,
    gradient: "from-emerald-500 to-teal-600",
    tint: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  finance: {
    label: "Finance",
    icon: Wallet,
    gradient: "from-amber-500 to-orange-600",
    tint: "bg-amber-50 text-amber-700 border-amber-100",
  },
  operations: {
    label: "Operations",
    icon: Settings2,
    gradient: "from-slate-500 to-slate-700",
    tint: "bg-slate-50 text-slate-700 border-slate-100",
  },
  strategy: {
    label: "Strategie",
    icon: Compass,
    gradient: "from-blue-500 to-indigo-600",
    tint: "bg-blue-50 text-blue-700 border-blue-100",
  },
  product: {
    label: "Produkt",
    icon: Package,
    gradient: "from-cyan-500 to-sky-600",
    tint: "bg-cyan-50 text-cyan-700 border-cyan-100",
  },
  legal: {
    label: "Legal",
    icon: Scale,
    gradient: "from-stone-500 to-neutral-700",
    tint: "bg-stone-50 text-stone-700 border-stone-100",
  },
  general: {
    label: "Gedanke",
    icon: Lightbulb,
    gradient: "from-indigo-500 to-purple-600",
    tint: "bg-indigo-50 text-indigo-700 border-indigo-100",
  },
};

const TEMPLATE_KIND_LABEL: Record<TemplateKind, string> = {
  job_posting: "Stellenausschreibung generieren",
  marketing_script: "Marketing-Skript generieren",
  cold_email: "Cold-Email generieren",
  contract: "Vertragsentwurf generieren",
  sales_script: "Sales-Skript generieren",
};

const PLACEHOLDERS = [
  "Was hast du gerade im Kopf? (Strategie, Idee, Reminder …)",
  "z.B. „Call-Setter einstellen, 2k Budget …“",
  "z.B. „Reichweite verdoppeln in 90 Tagen“",
  "z.B. „Neuer Vertrag mit Zahlungsdienstleister“",
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function CeoMindOS() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [thought, setThought] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [placeholder, setPlaceholder] = useState(PLACEHOLDERS[0]);
  const [openTemplate, setOpenTemplate] = useState<{
    strategyId: string;
    template: MagicTemplate;
  } | null>(null);
  const [failureFor, setFailureFor] = useState<string | null>(null);
  const [loadingTemplateFor, setLoadingTemplateFor] = useState<string | null>(
    null
  );
  const [loadingFailureFor, setLoadingFailureFor] = useState<string | null>(
    null
  );
  const [config, setConfig] = useState<{ groq: boolean; tavily: boolean } | null>(
    null
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Rotate placeholders (fokus-state microdelight)
  useEffect(() => {
    let i = 0;
    const t = setInterval(() => {
      i = (i + 1) % PLACEHOLDERS.length;
      setPlaceholder(PLACEHOLDERS[i]);
    }, 4200);
    return () => clearInterval(t);
  }, []);

  // Fetch strategies + health
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [listRes, healthRes] = await Promise.all([
          fetch("/api/ceo-mind-os?status=active", { credentials: "include" }),
          fetch("/api/ceo-mind-os/health", { credentials: "include" }),
        ]);
        if (!cancelled && listRes.ok) {
          const data = (await listRes.json()) as Strategy[];
          setStrategies(Array.isArray(data) ? data : []);
        }
        if (!cancelled && healthRes.ok) {
          const h = await healthRes.json();
          setConfig({ groq: !!h.groq, tavily: !!h.tavily });
        }
      } catch (err) {
        // Silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 260)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [thought, autoGrow]);

  const activeStrategies = useMemo(
    () => strategies.filter((s) => s.status === "active"),
    [strategies]
  );
  const resolvedStrategies = useMemo(
    () => strategies.filter((s) => s.status !== "active"),
    [strategies]
  );

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const submitThought = useCallback(async () => {
    const trimmed = thought.trim();
    if (!trimmed || analyzing) return;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/ceo-mind-os", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thought: trimmed }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("[CEO-MIND-OS] Analyze failed:", err);
        alert(
          `KI-Analyse fehlgeschlagen: ${err?.detail || err?.error || res.status}`
        );
        return;
      }
      const newStrategy = (await res.json()) as Strategy;
      setStrategies((prev) => [newStrategy, ...prev]);
      setThought("");
    } catch (err: any) {
      console.error("[CEO-MIND-OS] Network error:", err);
      alert("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setAnalyzing(false);
    }
  }, [thought, analyzing]);

  const updateStatus = useCallback(
    async (id: string, next: Strategy["status"]) => {
      const prev = strategies;
      // optimistic
      setStrategies((list) =>
        list.map((s) => (s.id === id ? { ...s, status: next } : s))
      );
      try {
        const res = await fetch(`/api/ceo-mind-os/${id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: next }),
        });
        if (!res.ok) throw new Error(String(res.status));
      } catch {
        setStrategies(prev); // rollback
      }
    },
    [strategies]
  );

  const deleteStrategy = useCallback(async (id: string) => {
    const ok = window.confirm("Diesen Gedanken wirklich löschen?");
    if (!ok) return;
    setStrategies((list) => list.filter((s) => s.id !== id));
    try {
      await fetch(`/api/ceo-mind-os/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
    } catch {
      // ignore
    }
  }, []);

  const generateTemplate = useCallback(
    async (id: string, kind?: TemplateKind) => {
      setLoadingTemplateFor(id);
      try {
        const res = await fetch(`/api/ceo-mind-os/${id}/template`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(kind ? { kind } : {}),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const updated = data.strategy as Strategy;
        const tpl = data.template as MagicTemplate;
        setStrategies((list) =>
          list.map((s) => (s.id === id ? updated : s))
        );
        setOpenTemplate({ strategyId: id, template: tpl });
      } catch (err) {
        console.error("[CEO-MIND-OS] generateTemplate failed", err);
        alert("Template konnte nicht generiert werden.");
      } finally {
        setLoadingTemplateFor(null);
      }
    },
    []
  );

  const submitFailure = useCallback(
    async (id: string, reason: string) => {
      setLoadingFailureFor(id);
      try {
        const res = await fetch(`/api/ceo-mind-os/${id}/failure`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        setStrategies((list) =>
          list.map((s) => (s.id === id ? (data.strategy as Strategy) : s))
        );
        setFailureFor(null);
      } catch (err) {
        console.error("[CEO-MIND-OS] submitFailure failed", err);
        alert("Analyse des Fehlschlags fehlgeschlagen.");
      } finally {
        setLoadingFailureFor(null);
      }
    },
    []
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits, Shift+Enter = newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitThought();
    }
  };

  return (
    <section className="mb-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative bg-white/80 backdrop-blur-xl rounded-[2rem] p-8 sm:p-10 border border-slate-100 shadow-xl overflow-hidden"
      >
        {/* Ambient tint orbs */}
        <div className="pointer-events-none absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full opacity-[0.08] blur-3xl"
             style={{ background: "radial-gradient(circle, #6366f1, transparent 70%)" }} />
        <div className="pointer-events-none absolute -bottom-32 -left-20 w-[380px] h-[380px] rounded-full opacity-[0.06] blur-3xl"
             style={{ background: "radial-gradient(circle, #a855f7, transparent 70%)" }} />

        {/* Header */}
        <div className="relative flex items-start justify-between gap-4 mb-6">
          <div className="flex items-start gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Brain className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-white animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400 font-bold mb-1">
                CEO MIND-OS
              </p>
              <h2 className="text-[22px] sm:text-2xl font-semibold text-slate-900 tracking-tight">
                Digitales Gehirn & Strategie
              </h2>
              <p className="text-[13px] text-slate-500 mt-1 max-w-xl leading-relaxed">
                Tippe eine Idee. Ich analysiere, rechne ROI, suche live Marktdaten und
                liefere Vorlagen.
              </p>
            </div>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1.5 shrink-0">
            <HealthPill config={config} />
            {activeStrategies.length > 0 && (
              <span className="text-[11px] font-semibold text-slate-500">
                {activeStrategies.length} aktiv · {resolvedStrategies.length} archiviert
              </span>
            )}
          </div>
        </div>

        {/* Input (Fokus-State) */}
        <div className="relative mb-6">
          <div
            className={`relative rounded-2xl transition-all duration-300 ${
              analyzing
                ? "bg-gradient-to-r from-indigo-50 via-violet-50 to-fuchsia-50 ring-2 ring-indigo-200"
                : "bg-white/90 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-300 focus-within:shadow-lg focus-within:shadow-indigo-500/5"
            }`}
          >
            <textarea
              ref={textareaRef}
              value={thought}
              onChange={(e) => setThought(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              rows={1}
              disabled={analyzing}
              className="w-full resize-none bg-transparent px-6 py-5 pr-36 text-[17px] text-slate-800 placeholder-slate-400 outline-none rounded-2xl leading-relaxed"
              style={{ fontFamily: "inherit" }}
            />
            <div className="absolute right-3 bottom-3 flex items-center gap-2">
              <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 py-1 rounded-md bg-slate-100">
                ⏎ Analysieren
              </span>
              <button
                onClick={submitThought}
                disabled={!thought.trim() || analyzing}
                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white text-sm font-semibold shadow-lg shadow-slate-900/10 transition-all duration-200 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Denke nach…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    <span>Analysieren</span>
                  </>
                )}
              </button>
            </div>

            {/* Shimmer rail while analyzing */}
            <AnimatePresence>
              {analyzing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-x-4 bottom-0 h-[2px] overflow-hidden rounded-full"
                >
                  <motion.div
                    className="h-full w-1/3 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                    animate={{ x: ["-100%", "300%"] }}
                    transition={{ duration: 1.3, repeat: Infinity, ease: "linear" }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Mind-Cards */}
        <div className="relative">
          {loading ? (
            <div className="py-10 flex items-center justify-center gap-2 text-slate-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Lade Strategien…</span>
            </div>
          ) : activeStrategies.length === 0 && resolvedStrategies.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-4">
              <AnimatePresence initial={false}>
                {activeStrategies.map((s) => (
                  <MindCard
                    key={s.id}
                    strategy={s}
                    onGenerateTemplate={(kind) => generateTemplate(s.id, kind)}
                    onMarkDone={() => updateStatus(s.id, "done")}
                    onOpenFailure={() => setFailureFor(s.id)}
                    onArchive={() => updateStatus(s.id, "archived")}
                    onDelete={() => deleteStrategy(s.id)}
                    onOpenTemplate={(tpl) =>
                      setOpenTemplate({ strategyId: s.id, template: tpl })
                    }
                    templateLoading={loadingTemplateFor === s.id}
                  />
                ))}
                {resolvedStrategies.length > 0 && (
                  <motion.div
                    key="resolved-divider"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-3 pt-2 pb-1"
                  >
                    <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 font-bold">
                      Deep-Archive
                    </span>
                    <div className="h-px flex-1 bg-slate-100" />
                    <span className="text-[11px] text-slate-400">
                      {resolvedStrategies.length} Einträge
                    </span>
                  </motion.div>
                )}
                {resolvedStrategies.map((s) => (
                  <MindCard
                    key={s.id}
                    strategy={s}
                    onGenerateTemplate={(kind) => generateTemplate(s.id, kind)}
                    onMarkDone={() => updateStatus(s.id, "active")}
                    onOpenFailure={() => setFailureFor(s.id)}
                    onArchive={() => updateStatus(s.id, "active")}
                    onDelete={() => deleteStrategy(s.id)}
                    onOpenTemplate={(tpl) =>
                      setOpenTemplate({ strategyId: s.id, template: tpl })
                    }
                    templateLoading={loadingTemplateFor === s.id}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>

      {/* Failure Modal */}
      <AnimatePresence>
        {failureFor && (
          <FailureModal
            strategy={strategies.find((s) => s.id === failureFor) || null}
            onClose={() => setFailureFor(null)}
            onSubmit={(reason) => submitFailure(failureFor, reason)}
            loading={loadingFailureFor === failureFor}
          />
        )}
      </AnimatePresence>

      {/* Template Modal */}
      <AnimatePresence>
        {openTemplate && (
          <TemplateModal
            template={openTemplate.template}
            onClose={() => setOpenTemplate(null)}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

// ============================================================================
// HEALTH PILL
// ============================================================================

function HealthPill({ config }: { config: { groq: boolean; tavily: boolean } | null }) {
  if (!config) return null;
  const ok = config.groq;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
        ok
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-amber-50 text-amber-700 border-amber-100"
      }`}
      title={
        ok
          ? `Groq aktiv${config.tavily ? " · Tavily Research an" : " · Tavily aus"}`
          : "GROQ_API_KEY fehlt — Fallback-Modus aktiv"
      }
    >
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`} />
      {ok ? "Llama 3.3 70B" : "Fallback-Modus"}
      {ok && config.tavily && <Globe className="w-3 h-3 opacity-70" />}
    </span>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <div className="w-12 h-12 mx-auto rounded-2xl bg-white flex items-center justify-center shadow-sm mb-3">
        <Sparkles className="w-5 h-5 text-indigo-500" />
      </div>
      <p className="text-sm font-semibold text-slate-700">Noch kein Gedanke erfasst</p>
      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
        Tippe einfach deine nächste Idee, Strategie oder dein Bauchgefühl ein —
        ich analysiere und gebe dir eine ehrliche Einschätzung zurück.
      </p>
    </div>
  );
}

// ============================================================================
// MIND CARD
// ============================================================================

function MindCard(props: {
  strategy: Strategy;
  onGenerateTemplate: (kind?: TemplateKind) => void;
  onOpenTemplate: (tpl: MagicTemplate) => void;
  onMarkDone: () => void;
  onOpenFailure: () => void;
  onArchive: () => void;
  onDelete: () => void;
  templateLoading: boolean;
}) {
  const {
    strategy,
    onGenerateTemplate,
    onOpenTemplate,
    onMarkDone,
    onOpenFailure,
    onArchive,
    onDelete,
    templateLoading,
  } = props;

  const a = strategy.analysis;
  const cat = CATEGORY_META[strategy.category] || CATEGORY_META.general;
  const Icon = cat.icon;
  const isFailed = strategy.status === "failed";
  const isDone = strategy.status === "done";
  const isArchived = strategy.status === "archived";
  const isResolved = isFailed || isDone || isArchived;

  const templateKind =
    a?.magicTemplate?.kind ||
    (strategy.category === "personal"
      ? "job_posting"
      : strategy.category === "marketing"
      ? "marketing_script"
      : strategy.category === "sales"
      ? "sales_script"
      : strategy.category === "legal"
      ? "contract"
      : null);

  const magicLabel = templateKind
    ? a?.magicTemplate
      ? "Vorlage anzeigen"
      : TEMPLATE_KIND_LABEL[templateKind]
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`relative rounded-2xl border bg-white p-5 sm:p-6 transition-all ${
        isResolved
          ? "border-slate-100 opacity-70 hover:opacity-100"
          : "border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200"
      }`}
    >
      {/* Category accent */}
      <div
        aria-hidden
        className={`absolute left-0 top-6 bottom-6 w-1 rounded-r-full bg-gradient-to-b ${cat.gradient}`}
      />

      <div className="flex items-start gap-4 pl-2">
        <div
          className={`hidden sm:flex w-10 h-10 rounded-xl items-center justify-center bg-gradient-to-br ${cat.gradient} shadow-sm shrink-0`}
        >
          <Icon className="w-5 h-5 text-white" strokeWidth={2.2} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${cat.tint}`}
            >
              <Icon className="w-3 h-3" />
              {cat.label}
            </span>
            {a?.meta?.usedWebSearch && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 bg-sky-50 border border-sky-100 px-2 py-0.5 rounded-full">
                <Globe className="w-3 h-3" />
                Live-Research
              </span>
            )}
            {isFailed && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                <XCircle className="w-3 h-3" />
                Nicht erledigt
              </span>
            )}
            {isDone && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Erledigt
              </span>
            )}
            {isArchived && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                <Archive className="w-3 h-3" />
                Archiv
              </span>
            )}
            {typeof a?.confidence === "number" && (
              <span className="ml-auto text-[10px] font-semibold text-slate-400">
                Confidence {Math.round((a.confidence || 0) * 100)}%
              </span>
            )}
          </div>

          {/* Thought */}
          <p className="text-[15px] font-semibold text-slate-900 leading-snug mb-3">
            {strategy.thought}
          </p>

          {/* Insight: followUpQuestion */}
          {a?.followUpQuestion && (
            <div className="mb-3 flex items-start gap-2.5 text-[13.5px] text-indigo-700 bg-indigo-50/70 border border-indigo-100 rounded-xl px-3.5 py-2.5">
              <Target className="w-4 h-4 mt-0.5 shrink-0" />
              <span className="leading-relaxed">{a.followUpQuestion}</span>
            </div>
          )}

          {/* ROI Check */}
          {a?.roiCheck && (
            <div className="mb-3 flex items-start gap-2.5 text-[13px] text-slate-700 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5">
              <TrendingUp className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
              <span className="leading-relaxed whitespace-pre-wrap">{a.roiCheck}</span>
            </div>
          )}

          {/* Next steps */}
          {a?.nextSteps && a.nextSteps.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {a.nextSteps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[13px] text-slate-600"
                >
                  <ArrowRight className="w-3.5 h-3.5 mt-1 text-slate-400 shrink-0" />
                  <span className="leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Failure analysis (if present) */}
          {isFailed && a?.failureAnalysis && (
            <div className="mb-3 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span className="text-[11px] uppercase tracking-wider font-bold text-rose-700">
                  Realitäts-Check
                </span>
              </div>
              {a.failureAnalysis.empathy && (
                <p className="text-[13px] text-slate-700 mb-2 leading-relaxed">
                  {a.failureAnalysis.empathy}
                </p>
              )}
              {a.failureAnalysis.opportunityCost && (
                <p className="text-[13px] font-semibold text-rose-900 mb-2 leading-relaxed">
                  {a.failureAnalysis.opportunityCost}
                </p>
              )}
              {a.failureAnalysis.alternatives?.length > 0 && (
                <ul className="space-y-1 mb-2">
                  {a.failureAnalysis.alternatives.map((alt, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-[13px] text-slate-700"
                    >
                      <Lightbulb className="w-3.5 h-3.5 mt-1 text-amber-500 shrink-0" />
                      <span>{alt}</span>
                    </li>
                  ))}
                </ul>
              )}
              {a.failureAnalysis.recommendation && (
                <div className="text-[13px] text-slate-800 font-medium bg-white/60 border border-rose-100 rounded-lg px-3 py-2 mt-2">
                  <span className="text-[10px] uppercase tracking-wider text-rose-600 font-bold block mb-0.5">
                    Empfehlung
                  </span>
                  {a.failureAnalysis.recommendation}
                </div>
              )}
              {strategy.failureReason && (
                <p className="text-[11px] text-slate-500 mt-3 italic">
                  Grund: „{strategy.failureReason}“
                </p>
              )}
            </div>
          )}

          {/* Resources */}
          {strategy.resources && strategy.resources.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              {strategy.resources.slice(0, 6).map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-white border border-slate-200 rounded-full px-2.5 py-1 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  {r.label}
                </a>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {magicLabel && (
              <MagicButton
                onClick={() =>
                  a?.magicTemplate
                    ? onOpenTemplate(a.magicTemplate)
                    : onGenerateTemplate(templateKind as TemplateKind)
                }
                loading={templateLoading}
                label={magicLabel}
              />
            )}

            {!isDone && !isFailed && (
              <button
                onClick={onMarkDone}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 hover:bg-emerald-100 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Erledigt
              </button>
            )}

            {!isFailed && !isDone && (
              <button
                onClick={onOpenFailure}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-rose-700 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Nicht erledigt
              </button>
            )}

            {!isArchived && (
              <button
                onClick={onArchive}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-slate-600 bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors"
              >
                <Archive className="w-3.5 h-3.5" />
                Archivieren
              </button>
            )}

            <button
              onClick={onDelete}
              title="Löschen"
              className="ml-auto inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAGIC BUTTON (shimmering gradient)
// ============================================================================

function MagicButton({
  onClick,
  loading,
  label,
}: {
  onClick: () => void;
  loading: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="relative inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-bold text-white overflow-hidden disabled:opacity-60 disabled:cursor-not-allowed"
      style={{
        background:
          "linear-gradient(120deg, #6366f1 0%, #a855f7 45%, #ec4899 100%)",
        backgroundSize: "200% 200%",
      }}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 opacity-60"
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        style={{
          background:
            "linear-gradient(120deg, #6366f1 0%, #a855f7 45%, #ec4899 100%)",
          backgroundSize: "200% 200%",
        }}
      />
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/3 bg-white/25 blur-sm skew-x-12"
        animate={{ x: ["-30%", "260%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <span className="relative flex items-center gap-1.5">
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {loading ? "Generiere…" : label}
      </span>
    </button>
  );
}

// ============================================================================
// FAILURE MODAL — "Warum gescheitert?"
// ============================================================================

function FailureModal({
  strategy,
  onClose,
  onSubmit,
  loading,
}: {
  strategy: Strategy | null;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  if (!strategy) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-rose-500 font-bold">
              Realitäts-Check
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              Warum gescheitert?
            </h3>
          </div>
        </div>

        <p className="text-[13px] text-slate-500 mb-4 italic border-l-2 border-slate-200 pl-3">
          „{strategy.thought}“
        </p>

        <textarea
          autoFocus
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="z.B. „Zu teuer“, „Kein Bock“, „Timing passt nicht“ …"
          rows={4}
          disabled={loading}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 resize-none"
        />

        <p className="text-[12px] text-slate-500 mt-2">
          Die KI rechnet dir Opportunitätskosten vor und schlägt Alternativen vor.
        </p>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            onClick={() => reason.trim() && onSubmit(reason.trim())}
            disabled={!reason.trim() || loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-rose-500 to-rose-600 hover:shadow-lg hover:shadow-rose-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analysiere…
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gegenrechnung erstellen
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// TEMPLATE MODAL — Stellenanzeige / Skript / Vertrag
// ============================================================================

function TemplateModal({
  template,
  onClose,
}: {
  template: MagicTemplate;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(template.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // silent
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100 overflow-hidden flex flex-col"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 z-10"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-4 shrink-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-500 font-bold">
              Magic Template
            </p>
            <h3 className="text-lg font-semibold text-slate-900 leading-tight">
              {template.title}
            </h3>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-[13.5px] text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
          {template.content}
        </div>

        {template.cta && (
          <p className="text-[12px] text-slate-500 mt-3 italic shrink-0">
            {template.cta}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 mt-4 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            Schließen
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 hover:shadow-lg hover:shadow-indigo-500/20 transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Kopiert
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Kopieren
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
