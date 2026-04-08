/**
 * ============================================================================
 * SPACE — NEWS INTELLIGENCE (Premium Newspaper Card)
 * ============================================================================
 * Click-to-load: shows CTA first → user clicks → Gemini fetches live news.
 * Newspaper-style layout in ARAS CI (dark glass, gold/orange accents).
 * ============================================================================
 */

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import {
  Newspaper,
  RefreshCw,
  ExternalLink,
  Globe,
  Zap,
  TrendingUp,
  AlertCircle,
  Loader2,
  ArrowRight,
  ThumbsUp,
  Minus,
  ThumbsDown,
  Link2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { format, parseISO, isToday, isYesterday } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// TYPES
// ============================================================================

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  date: string;
  scope: string;
  tags: string[];
  sentiment: "positive" | "neutral" | "negative";
  whyItMatters: string;
}

interface NewsDigestResponse {
  industryLabel: string;
  scopes: string[];
  mode: "top" | "breaking";
  generatedAt: string;
  items: NewsItem[];
  sources: string[];
  fromCache: boolean;
  stale: boolean;
  provider: string;
  error: { code: string; message: string } | null;
}

interface ScopesResponse {
  scopes: string[];
  industry: string;
}

type NewsMode = "top" | "breaking";

// ============================================================================
// CONSTANTS
// ============================================================================

const SCOPE_LABELS: Record<string, string> = {
  global: "Global", AT: "AT", DE: "DE", CH: "CH", US: "US", UK: "UK",
  FR: "FR", IT: "IT", ES: "ES", NL: "NL",
};

const SCOPE_FULL: Record<string, string> = {
  global: "International", AT: "Österreich", DE: "Deutschland", CH: "Schweiz",
};

const INDUSTRY_LABELS: Record<string, string> = {
  real_estate: "Immobilien", immobilien: "Immobilien",
  insurance: "Versicherungen", versicherung: "Versicherungen",
  finance: "Finanzen", technology: "Technologie",
  healthcare: "Gesundheit", consulting: "Beratung",
  legal: "Recht", marketing: "Marketing", automotive: "Automobil",
  energy: "Energie", retail: "Handel", construction: "Bauwesen",
  education: "Bildung", general: "Wirtschaft & Märkte",
  b2b_services: "B2B Services", saas: "SaaS & Cloud",
  ai: "KI & Tech", manufacturing: "Industrie",
};

function labelFor(key: string): string {
  return INDUSTRY_LABELS[key?.toLowerCase().replace(/[\s-]/g, "_")] || key || "Wirtschaft";
}

const SENTIMENT_CONFIG = {
  positive: { icon: ThumbsUp, color: "rgba(34,197,94,0.7)", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.18)" },
  neutral: { icon: Minus, color: "rgba(255,255,255,0.45)", bg: "rgba(255,255,255,0.04)", border: "rgba(255,255,255,0.10)" },
  negative: { icon: ThumbsDown, color: "rgba(239,68,68,0.7)", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.18)" },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function SpaceDailyNews() {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 30 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenTriggered, setSheenTriggered] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Click-to-load state
  const [activated, setActivated] = useState(false);
  const [mode, setMode] = useState<NewsMode>("top");
  const [activeScopes, setActiveScopes] = useState<Set<string>>(new Set(["global"]));
  const [showSources, setShowSources] = useState(false);

  // Debounce: only fire query after user stops toggling for 400ms
  const [debouncedMode, setDebouncedMode] = useState<NewsMode>("top");
  const [debouncedScopes, setDebouncedScopes] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch scopes (lightweight, always runs)
  const { data: scopesData } = useQuery<ScopesResponse>({
    queryKey: ["/api/news/scopes"],
    queryFn: async () => {
      const res = await fetch("/api/news/scopes", { credentials: "include" });
      if (!res.ok) return { scopes: ["global", "AT", "DE", "CH"], industry: "general" };
      return res.json();
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (scopesData?.scopes) setActiveScopes(new Set(scopesData.scopes));
  }, [scopesData]);

  const availableScopes = scopesData?.scopes || ["global", "AT", "DE", "CH"];
  const industryKey = scopesData?.industry || (user as any)?.industry || "general";
  const scopesQuery = useMemo(() => {
    const arr = Array.from(activeScopes);
    return arr.length > 0 ? arr.join(",") : "global";
  }, [activeScopes]);

  // Debounce mode + scopes changes (400ms) to prevent rapid API calls
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedMode(mode);
      setDebouncedScopes(scopesQuery);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [mode, scopesQuery]);

  // Initialize debounced values on first activation
  useEffect(() => {
    if (activated && !debouncedScopes) {
      setDebouncedMode(mode);
      setDebouncedScopes(scopesQuery);
    }
  }, [activated, mode, scopesQuery, debouncedScopes]);

  // Fetch news — ONLY when activated (click-to-load), uses debounced values
  const { data: newsData, isLoading, isError, error, refetch } = useQuery<NewsDigestResponse>({
    queryKey: ["/api/news/daily", debouncedMode, debouncedScopes],
    queryFn: async () => {
      const res = await fetch(`/api/news/daily?mode=${debouncedMode}&scopes=${debouncedScopes}`, { credentials: "include" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any)?.error || "Fehler"); }
      return res.json();
    },
    enabled: !!user && activated && !!debouncedScopes,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  });

  const handleActivate = useCallback(() => setActivated(true), []);
  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["/api/news/daily"] });
    await refetch();
  }, [queryClient, refetch]);

  const toggleScope = useCallback((scope: string) => {
    setActiveScopes((prev) => {
      const next = new Set(prev);
      if (next.has(scope)) { if (next.size > 1) next.delete(scope); }
      else next.add(scope);
      return next;
    });
  }, []);

  // Mouse handlers
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion || !cardRef.current) return;
    const r = cardRef.current.getBoundingClientRect();
    setMousePos({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
  }, [prefersReducedMotion]);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (!prefersReducedMotion) { setSheenTriggered(true); setTimeout(() => setSheenTriggered(false), 650); }
  }, [prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!prefersReducedMotion) setMousePos({ x: 50, y: 30 });
  }, [prefersReducedMotion]);

  const fmtDate = (s: string) => {
    try { const d = parseISO(s); if (isToday(d)) return "Heute"; if (isYesterday(d)) return "Gestern"; return format(d, "d. MMM", { locale: de }); } catch { return s; }
  };

  const fmtTime = useMemo(() => {
    if (!newsData?.generatedAt) return "";
    try { return format(parseISO(newsData.generatedAt), "HH:mm", { locale: de }); } catch { return ""; }
  }, [newsData]);

  const hasItems = newsData && newsData.items.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.25, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full"
      style={{ maxWidth: "1120px", marginTop: "14px", paddingLeft: "12px", paddingRight: "12px" }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="group relative rounded-[18px] overflow-hidden"
        style={{
          padding: "20px 20px 18px",
          background: `linear-gradient(135deg, rgba(254,145,0,0.06), rgba(233,215,196,0.03) 45%, rgba(0,0,0,0) 100%), rgba(15,15,15,0.62)`,
          border: isHovered && !prefersReducedMotion ? "1px solid rgba(254,145,0,0.26)" : "1px solid rgba(255,255,255,0.10)",
          boxShadow: isHovered && !prefersReducedMotion
            ? "0 10px 30px rgba(0,0,0,0.35), 0 0 28px rgba(254,145,0,0.08)"
            : "0 10px 30px rgba(0,0,0,0.35)",
          transition: "border-color 160ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 160ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        {/* Pointer glow */}
        {!prefersReducedMotion && (
          <div className="absolute inset-0 pointer-events-none" style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(260px circle at ${mousePos.x}% ${mousePos.y}%, rgba(254,145,0,0.12), transparent 55%)`,
            transition: "opacity 220ms",
          }} />
        )}
        {/* Sheen */}
        {!prefersReducedMotion && (
          <div className="absolute inset-[-2px] pointer-events-none overflow-hidden rounded-[18px]" style={{ zIndex: 10 }}>
            <div className="absolute inset-0" style={{
              background: "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.08) 35%, transparent 70%)",
              transform: sheenTriggered ? "translateX(120%)" : "translateX(-120%)",
              transition: sheenTriggered ? "transform 650ms cubic-bezier(0.2,0.8,0.2,1)" : "none",
            }} />
          </div>
        )}

        <div className="relative z-20 flex flex-col gap-3">
          {/* ===== MASTHEAD ===== */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <div className="flex items-center justify-center shrink-0 rounded-[14px]"
                style={{ width: 44, height: 44, border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)" }}>
                <Newspaper className="w-5 h-5" style={{ color: "#FE9100", filter: "drop-shadow(0 0 12px rgba(254,145,0,0.20))" }} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 style={{ fontSize: 15, fontWeight: 800, color: "rgba(233,215,196,0.95)", letterSpacing: "0.03em", fontFamily: "'Orbitron', system-ui, sans-serif" }}>
                    NEWS INTELLIGENCE
                  </h3>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 999,
                    background: "linear-gradient(135deg, rgba(254,145,0,0.18), rgba(254,145,0,0.08))",
                    border: "1px solid rgba(254,145,0,0.28)", color: "#FE9100", letterSpacing: "0.06em",
                  }}>LIVE</span>
                </div>
                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", lineHeight: 1.45 }}>
                  Top-Stories für{" "}
                  <span style={{ color: "rgba(254,145,0,0.85)", fontWeight: 600 }}>{labelFor(industryKey)}</span>
                  {" "}— kuratiert von ARAS AI mit Google Search
                </p>
              </div>
            </div>

            {/* Actions: only show after activation */}
            {activated && (
              <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                {fmtTime && (
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.30)" }}>
                    {fmtTime} {newsData?.fromCache ? "(Cache)" : ""}{newsData?.stale ? " · aktualisiert…" : ""}
                  </span>
                )}
                <button onClick={handleRefresh} disabled={isLoading} aria-label="Aktualisieren"
                  className="flex items-center gap-1.5 rounded-full outline-none"
                  style={{
                    height: 30, padding: "0 12px",
                    background: isLoading ? "rgba(254,145,0,0.18)" : "rgba(254,145,0,0.10)",
                    border: "1px solid rgba(254,145,0,0.22)",
                    cursor: isLoading ? "wait" : "pointer", opacity: isLoading ? 0.7 : 1,
                    transition: "background 160ms",
                  }}>
                  {isLoading ? <Loader2 className="w-3 h-3 animate-spin" style={{ color: "rgba(255,255,255,0.8)" }} />
                    : <RefreshCw className="w-3 h-3" style={{ color: "rgba(255,255,255,0.8)" }} />}
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>
                    {isLoading ? "Lädt…" : "Refresh"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* ===== PRE-ACTIVATION CTA ===== */}
          {!activated && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-6 gap-4"
            >
              {/* Decorative line */}
              <div style={{ width: 60, height: 1, background: "linear-gradient(90deg, transparent, rgba(254,145,0,0.40), transparent)" }} />
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", textAlign: "center", maxWidth: "42ch", lineHeight: 1.55 }}>
                Klicke um die aktuellsten Branchennachrichten per AI zu recherchieren und zusammenzufassen.
              </p>
              <button
                onClick={handleActivate}
                className="flex items-center gap-2 rounded-full outline-none"
                style={{
                  height: 40, padding: "0 22px",
                  background: "linear-gradient(135deg, rgba(254,145,0,0.16), rgba(254,145,0,0.06))",
                  border: "1px solid rgba(254,145,0,0.30)",
                  boxShadow: "0 8px 32px rgba(254,145,0,0.08), 0 0 0 1px rgba(255,255,255,0.04)",
                  cursor: "pointer",
                  transition: "transform 180ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 180ms",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(254,145,0,0.14), 0 0 0 1px rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(254,145,0,0.08), 0 0 0 1px rgba(255,255,255,0.04)"; }}
              >
                <Newspaper className="w-4 h-4" style={{ color: "#FE9100" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.92)", letterSpacing: "0.02em" }}>
                  Nachrichten laden
                </span>
                <ArrowRight className="w-3.5 h-3.5" style={{ color: "rgba(254,145,0,0.7)" }} />
              </button>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
                Powered by Gemini AI + Google Search Grounding
              </p>
            </motion.div>
          )}

          {/* ===== FILTER ROW (after activation) ===== */}
          {activated && (
            <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="News-Filter">
              <div className="flex items-center gap-1">
                <FilterChip active={mode === "top"} onClick={() => setMode("top")} icon={<TrendingUp className="w-3 h-3" />} label="Top" activeColor="rgba(254,145,0," />
                <FilterChip active={mode === "breaking"} onClick={() => setMode("breaking")} icon={<Zap className="w-3 h-3" />} label="Breaking" activeColor="rgba(239,68,68," />
              </div>
              <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.08)" }} />
              {availableScopes.map((scope) => (
                <FilterChip key={scope} active={activeScopes.has(scope)} onClick={() => toggleScope(scope)}
                  icon={scope === "global" ? <Globe className="w-3 h-3" /> : undefined}
                  label={SCOPE_LABELS[scope] || scope} title={SCOPE_FULL[scope]}
                />
              ))}
            </div>
          )}

          {/* ===== NEWS CONTENT (after activation) ===== */}
          {activated && (
            <div className="rounded-[14px] overflow-hidden" style={{ background: "rgba(255,255,255,0.015)", border: "1px solid rgba(233,215,196,0.08)" }}>
              <AnimatePresence mode="wait">
                {/* Loading */}
                {isLoading && (
                  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="px-4 py-3.5" style={{ borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.035)" : "none" }}>
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="rounded mb-2" style={{ width: `${60 + i * 8}%`, height: 13, ...shimmerStyle(prefersReducedMotion) }} />
                            <div className="rounded mb-1.5" style={{ width: `${90 - i * 10}%`, height: 10, ...shimmerStyle(prefersReducedMotion), animationDelay: "0.15s" }} />
                            <div className="rounded" style={{ width: `${40 + i * 5}%`, height: 8, ...shimmerStyle(prefersReducedMotion), animationDelay: "0.3s" }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {/* Error */}
                {!isLoading && isError && (
                  <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 px-4 py-5">
                    <AlertCircle className="w-5 h-5 shrink-0" style={{ color: "rgba(239,68,68,0.60)" }} />
                    <div className="flex-1 min-w-0">
                      <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.70)", marginBottom: 2 }}>News konnten nicht geladen werden.</p>
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{(error as any)?.message || "Bitte versuche es erneut."}</p>
                    </div>
                    <button onClick={handleRefresh} style={{ fontSize: 11, padding: "5px 12px", borderRadius: 8, background: "rgba(254,145,0,0.10)", border: "1px solid rgba(254,145,0,0.20)", color: "#FE9100", cursor: "pointer" }}>
                      Retry
                    </button>
                  </motion.div>
                )}

                {/* Empty */}
                {!isLoading && !isError && newsData && newsData.items.length === 0 && (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-8 px-4 text-center">
                    <Newspaper className="w-8 h-8 mb-2" style={{ color: "rgba(255,255,255,0.10)" }} />
                    <p style={{ fontSize: 13, fontWeight: 600, color: "rgba(255,255,255,0.50)", marginBottom: 4 }}>Keine News gefunden.</p>
                    <p style={{ fontSize: 11, color: "rgba(255,255,255,0.30)" }}>Versuche andere Filter oder klicke Refresh.</p>
                  </motion.div>
                )}

                {/* NEWS ITEMS — Newspaper Layout */}
                {!isLoading && !isError && hasItems && (
                  <motion.div
                    key={`${mode}-${scopesQuery}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col"
                  >
                    {/* Newspaper header bar */}
                    <div className="px-4 py-2 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(233,215,196,0.08)" }}>
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "rgba(233,215,196,0.55)", textTransform: "uppercase" as const }}>
                          {mode === "breaking" ? "BREAKING NEWS" : "TOP STORIES"}
                        </span>
                        <span style={{ width: 4, height: 4, borderRadius: 99, background: mode === "breaking" ? "rgba(239,68,68,0.6)" : "rgba(254,145,0,0.5)" }} />
                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.30)" }}>{newsData!.items.length} Artikel</span>
                      </div>
                      <span style={{ fontSize: 10, color: "rgba(233,215,196,0.35)", fontStyle: "italic" as const }}>{newsData!.industryLabel}</span>
                    </div>

                    {/* Items */}
                    {newsData!.items.map((item, idx) => {
                      const sentCfg = SENTIMENT_CONFIG[item.sentiment] || SENTIMENT_CONFIG.neutral;
                      const SentIcon = sentCfg.icon;
                      return (
                        <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                          className="group/item flex gap-3 px-4 py-3.5 outline-none"
                          style={{
                            borderBottom: idx < newsData!.items.length - 1 ? "1px solid rgba(255,255,255,0.035)" : "none",
                            textDecoration: "none", transition: "background 140ms",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(254,145,0,0.035)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                        >
                          {/* Number */}
                          <div className="shrink-0 pt-0.5" style={{ width: 20, textAlign: "right" as const }}>
                            <span style={{ fontSize: 18, fontWeight: 800, color: "rgba(254,145,0,0.18)", fontFamily: "'Orbitron', system-ui" }}>
                              {idx + 1}
                            </span>
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p style={{
                              fontSize: 14, fontWeight: 700, color: "rgba(255,255,255,0.90)", lineHeight: 1.35, marginBottom: 4,
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                            }}>{item.title}</p>

                            <p style={{
                              fontSize: 12, color: "rgba(255,255,255,0.50)", lineHeight: 1.5, marginBottom: 5,
                              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
                            }}>{item.summary}</p>

                            {/* Why it matters */}
                            {item.whyItMatters && (
                              <p style={{ fontSize: 11, color: "rgba(254,145,0,0.55)", lineHeight: 1.45, marginBottom: 6, fontStyle: "italic" as const }}>
                                → {item.whyItMatters}
                              </p>
                            )}

                            {/* Meta row */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(254,145,0,0.65)" }}>{item.source}</span>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.20)" }}>·</span>
                              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.38)" }}>{fmtDate(item.date)}</span>

                              {/* Scope */}
                              <span style={{
                                fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
                                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.50)",
                              }}>{SCOPE_LABELS[item.scope] || item.scope}</span>

                              {/* Sentiment */}
                              <span style={{
                                display: "inline-flex", alignItems: "center", gap: 3,
                                fontSize: 9, fontWeight: 600, padding: "1px 6px", borderRadius: 99,
                                background: sentCfg.bg, border: `1px solid ${sentCfg.border}`, color: sentCfg.color,
                              }}>
                                <SentIcon style={{ width: 9, height: 9 }} />
                                {item.sentiment}
                              </span>

                              {/* Tags */}
                              {item.tags.slice(0, 2).map((tag) => (
                                <span key={tag} style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "rgba(254,145,0,0.05)", color: "rgba(254,145,0,0.50)" }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* External link */}
                          <div className="shrink-0 pt-1">
                            <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/item:opacity-100 transition-opacity" style={{ color: "rgba(255,255,255,0.30)" }} />
                          </div>
                        </a>
                      );
                    })}

                    {/* Sources footer */}
                    {newsData!.sources && newsData!.sources.length > 0 && (
                      <div style={{ borderTop: "1px solid rgba(233,215,196,0.06)" }}>
                        <button onClick={() => setShowSources(!showSources)}
                          className="w-full flex items-center gap-1.5 px-4 py-2 outline-none"
                          style={{ cursor: "pointer", background: "transparent" }}>
                          <Link2 className="w-3 h-3" style={{ color: "rgba(255,255,255,0.30)" }} />
                          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>
                            {showSources ? "Quellen ausblenden" : `${newsData!.sources.length} Quellen anzeigen`}
                          </span>
                        </button>
                        {showSources && (
                          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                            {newsData!.sources.slice(0, 12).map((src, i) => {
                              let domain = src;
                              try { domain = new URL(src).hostname.replace("www.", ""); } catch {}
                              return (
                                <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                                  style={{ fontSize: 9, padding: "2px 6px", borderRadius: 6, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.40)", textDecoration: "none" }}>
                                  {domain}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <style>{`
          @keyframes newsSkeleton { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        `}</style>
      </div>
    </motion.div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function FilterChip({ active, onClick, icon, label, activeColor, title }: {
  active: boolean; onClick: () => void; icon?: React.ReactNode; label: string; activeColor?: string; title?: string;
}) {
  const isCustomColor = activeColor && activeColor !== "rgba(255,255,255,";
  const bgActive = activeColor ? `${activeColor}0.15)` : "rgba(255,255,255,0.08)";
  const borderActive = activeColor ? `${activeColor}0.30)` : "rgba(255,255,255,0.18)";
  const colorActive = activeColor ? `${activeColor}0.90)` : "rgba(255,255,255,0.85)";

  return (
    <button onClick={onClick} aria-pressed={active} title={title}
      className="flex items-center gap-1 transition-all duration-150"
      style={{
        height: 28, padding: "0 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: active ? bgActive : "rgba(255,255,255,0.025)",
        border: active ? `1px solid ${borderActive}` : "1px solid rgba(255,255,255,0.07)",
        color: active ? (isCustomColor ? colorActive : "rgba(255,255,255,0.85)") : "rgba(255,255,255,0.42)",
        cursor: "pointer",
      }}>
      {icon}{label}
    </button>
  );
}

function shimmerStyle(reduced: boolean | null): React.CSSProperties {
  return {
    background: "linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.03) 75%)",
    backgroundSize: "200% 100%",
    animation: reduced ? "none" : "newsSkeleton 1.5s ease-in-out infinite",
  };
}
