import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Loader2, Eye, EyeOff, AlertCircle, ArrowRight, RefreshCw,
  ChevronDown, Phone, CalendarCheck, Bell, UserCheck, Clock, Zap,
  ShieldCheck, Scan, Target, Sparkles,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// CI Tokens
// ═══════════════════════════════════════════════════════════════════════════
const CI = {
  goldLight: "#e9d7c4",
  orange: "#FE9100",
  goldDark: "#a34e00",
  bgDark: "#0b0b0d",
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
};

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════
type AuthTab = "register" | "login";
type PageState = "form" | "analysis";

interface RegisterFields {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  company: string;
  website: string;
}

interface LoginFields { username: string; password: string; }

interface BriefingData {
  status: "polling" | "ready" | "timeout";
  enrichmentStatus: string;
  qualityScore: number;
  companySnapshot: string;
  targetAudience: string[];
  targetAudienceSegments: string[];
  callAngles: string[];
  objections: { objection: string; response: string }[];
  competitors: string[];
  uniqueSellingPoints: string[];
  decisionMakers: string[];
  nextActions: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════
const ANALYSIS_STEPS = [
  { label: "Website & Domain scannen", sub: "Öffentliche Daten werden gelesen" },
  { label: "Zielgruppe identifizieren", sub: "Marktsegmente werden analysiert" },
  { label: "Call-Strategie generieren", sub: "Gesprächseinstiege werden erstellt" },
  { label: "Einwandbehandlung aufbauen", sub: "Antworten werden optimiert" },
];

const FAQ_ITEMS = [
  { q: "Ist ARAS wirklich kostenlos?", a: "Ja. Kostenlose Registrierung, Free-Plan ohne Kreditkarte, keine versteckten Kosten." },
  { q: "Wie funktioniert die Lead-Qualifizierung?", a: "ARAS ruft deine Leads automatisch an, stellt deine Qualifizierungsfragen (Dachfläche, Budget, Zeitrahmen) und bewertet in Echtzeit." },
  { q: "Kann ARAS Termine direkt buchen?", a: "Ja. Qualifizierte Termine landen direkt im Kalender deines Außendienstes." },
  { q: "Wie klingt die KI am Telefon?", a: "Natürliche, professionelle Stimme — optimiert für B2B. Gesprächspartner nehmen den Anruf als seriös wahr." },
  { q: "Ist das DSGVO-konform?", a: "Ja. Alle Daten DSGVO-konform. Keine Aufnahmen ohne Zustimmung." },
  { q: "Welche Lead-Quellen kann ich anbinden?", a: "Manueller Import, API-Schnittstellen oder direkt aus Web-Formularen." },
  { q: "Wie schnell ist ARAS einsatzbereit?", a: "Nach Registrierung analysiert ARAS dein Unternehmen. Erste Leads in wenigen Minuten qualifizierbar." },
  { q: "Was passiert bei unerreichbaren Leads?", a: "ARAS versucht es automatisch zu verschiedenen Tageszeiten erneut. Kein Lead geht verloren." },
  { q: "CRM-Anbindung möglich?", a: "Ja. Gängige CRM-Systeme werden unterstützt. Lead-Daten + Gesprächsprotokolle werden synchronisiert." },
];

// ═══════════════════════════════════════════════════════════════════════════
// Error mappers
// ═══════════════════════════════════════════════════════════════════════════
function mapRegErr(msg: string): string {
  const l = msg.toLowerCase();
  if (l.includes("e-mail") || l.includes("email")) return "Diese E-Mail ist bereits registriert.";
  if (l.includes("benutzername") || l.includes("username")) return "Benutzername vergeben. Bitte erneut versuchen.";
  if (l.includes("telefon") || l.includes("phone")) return "Gültige Telefonnummer nötig (mind. 8 Zeichen).";
  if (l.includes("failed to fetch") || l.includes("load failed")) return "Netzwerkfehler. Bitte erneut versuchen.";
  return msg || "Etwas ist schiefgelaufen.";
}
function mapLoginErr(msg: string, code?: string): string {
  if (code === "ACCOUNT_DISABLED") return "Account deaktiviert. Bitte Support kontaktieren.";
  if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("ungültig")) return "Ungültige Anmeldedaten.";
  if (msg.toLowerCase().includes("fetch")) return "Netzwerkfehler. Bitte erneut versuchen.";
  return msg || "Login fehlgeschlagen.";
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════
export default function SolarLandingPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const skipRedirectRef = useRef(false);

  useEffect(() => {
    if (!authLoading && user && !skipRedirectRef.current) setLocation("/space");
  }, [authLoading, user, setLocation]);

  // ── Page state ──
  const [pageState, setPageState] = useState<PageState>("form");
  const [tab, setTab] = useState<AuthTab>("register");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [companyName, setCompanyName] = useState("");

  // ── Register fields ──
  const [reg, setReg] = useState<RegisterFields>({ firstName: "", lastName: "", email: "", password: "", phone: "", company: "", website: "" });
  const [login, setLogin] = useState<LoginFields>({ username: "", password: "" });

  // ── Analysis / Briefing state (mirrors /auth exactly) ──
  const [briefingData, setBriefingData] = useState<BriefingData | null>(null);
  const [onboardingPhase, setOnboardingPhase] = useState<"signup" | "briefing" | "complete">("signup");
  const [briefingTimelineStep, setBriefingTimelineStep] = useState(0);
  const [briefingPollCount, setBriefingPollCount] = useState(0);

  // ── UTM tracking ──
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      const utm: Record<string, string> = {};
      for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
        const v = p.get(k); if (v) utm[k] = v;
      }
      if (Object.keys(utm).length > 0) localStorage.setItem("aras_utm", JSON.stringify({ ...utm, ts: Date.now() }));
    } catch { /* noop */ }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════
  // BRIEFING POLLING (identical to /auth state machine)
  // ═══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (onboardingPhase !== "briefing" || !briefingData || briefingData.status !== "polling") return;
    const controller = new AbortController();
    let count = 0;
    const MAX = 90;

    const poll = async () => {
      try {
        const res = await fetch("/api/user/profile-context", { signal: controller.signal, credentials: "include", cache: "no-store" });
        if (!res.ok || !(res.headers.get("content-type") || "").includes("json")) {
          count++;
          if (count < MAX) setTimeout(poll, 2500); else { setBriefingData(p => p ? { ...p, status: "timeout" } : p); setOnboardingPhase("complete"); }
          return;
        }
        const data = await res.json();
        count++; setBriefingPollCount(count);
        const eStatus = data.enrichmentMeta?.status || data.aiProfile?.enrichmentMeta?.status || "unknown";
        const enriched = data.profileEnriched === true;

        if (data.aiProfile) {
          const pr = data.aiProfile;
          setBriefingData(prev => {
            if (!prev) return prev;
            return {
              ...prev, enrichmentStatus: eStatus,
              qualityScore: pr.enrichmentMeta?.qualityScore || pr.qualityScore || prev.qualityScore,
              companySnapshot: pr.companyDescription || prev.companySnapshot,
              callAngles: Array.isArray(pr.callAngles) && pr.callAngles.length ? pr.callAngles : prev.callAngles,
              objections: Array.isArray(pr.objectionHandling) && pr.objectionHandling.length ? pr.objectionHandling : prev.objections,
              targetAudience: Array.isArray(pr.targetAudienceSegments) ? pr.targetAudienceSegments : pr.targetAudience ? [pr.targetAudience] : prev.targetAudience,
              targetAudienceSegments: pr.targetAudienceSegments || prev.targetAudienceSegments,
              competitors: Array.isArray(pr.competitors) ? pr.competitors : prev.competitors,
              uniqueSellingPoints: Array.isArray(pr.uniqueSellingPoints) ? pr.uniqueSellingPoints : prev.uniqueSellingPoints,
              decisionMakers: Array.isArray(pr.decisionMakers) ? pr.decisionMakers : prev.decisionMakers,
              nextActions: prev.nextActions,
            };
          });
        }

        if (enriched || ["complete", "live_research", "ok", "limited"].includes(eStatus)) {
          setBriefingData(p => p ? { ...p, status: "ready", enrichmentStatus: eStatus } : p); setOnboardingPhase("complete"); return;
        }
        if (["failed", "timeout", "error"].includes(eStatus)) {
          setBriefingData(p => p ? { ...p, status: "ready", enrichmentStatus: eStatus } : p); setOnboardingPhase("complete"); return;
        }
        if (count >= MAX) { setBriefingData(p => p ? { ...p, status: "timeout" } : p); setOnboardingPhase("complete"); return; }
        setTimeout(poll, 3000);
      } catch (e: any) {
        if (e.name === "AbortError") return;
        setTimeout(poll, 2500);
      }
    };

    const t1 = setTimeout(poll, 2000);
    const t2 = setInterval(() => setBriefingTimelineStep(p => Math.min(p + 1, 4)), 3000);
    return () => { controller.abort(); clearTimeout(t1); clearInterval(t2); };
  }, [onboardingPhase, briefingData?.status]);

  // ═══════════════════════════════════════════════════════════════════════
  // Register mutation
  // ═══════════════════════════════════════════════════════════════════════
  const registerMutation = useMutation({
    mutationFn: async (data: RegisterFields) => {
      const username = data.email.split("@")[0] + "_" + Math.random().toString(36).substring(2, 6);
      const res = await fetch("/api/register", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ username, password: data.password, email: data.email, firstName: data.firstName, lastName: data.lastName, phone: data.phone, company: data.company, website: data.website || undefined, industry: "Solar / Erneuerbare Energien", role: "", language: "de", primaryGoal: "lead_generation" }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({ message: "Registration failed" })); const e = new Error(b.message || "Registration failed"); (e as any).status = res.status; throw e; }
      return res.json();
    },
    onSuccess: (userData) => { queryClient.setQueryData(["/api/auth/user"], userData); },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Login mutation
  // ═══════════════════════════════════════════════════════════════════════
  const loginMutation = useMutation({
    mutationFn: async (data: LoginFields) => {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(data) });
      if (!res.ok) { const b = await res.json().catch(() => ({ message: "Login failed" })); const e = new Error(b.message || "Login failed"); (e as any).code = b.code; throw e; }
      return res.json();
    },
    onSuccess: (userData) => { queryClient.setQueryData(["/api/auth/user"], userData); setLocation("/space"); },
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Handlers
  // ═══════════════════════════════════════════════════════════════════════
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (honeypot) return;
    if (!reg.firstName.trim()) { setError("Bitte gib deinen Vornamen ein."); return; }
    if (!reg.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reg.email)) { setError("Gültige E-Mail-Adresse nötig."); return; }
    if (!reg.password || reg.password.length < 6) { setError("Passwort mind. 6 Zeichen."); return; }
    if (!reg.phone.trim() || reg.phone.trim().length < 8) { setError("Telefonnummer mind. 8 Zeichen."); return; }

    try {
      skipRedirectRef.current = true;
      await registerMutation.mutateAsync(reg);
      setCompanyName(reg.company || "");
      setBriefingData({ status: "polling", enrichmentStatus: "in_progress", qualityScore: 0, companySnapshot: "", targetAudience: [], targetAudienceSegments: [], callAngles: [], objections: [], competitors: [], uniqueSellingPoints: [], decisionMakers: [], nextActions: [] });
      setOnboardingPhase("briefing");
      setBriefingTimelineStep(0);
      setPageState("analysis");
    } catch (err: any) {
      skipRedirectRef.current = false;
      setError(mapRegErr(err.message || ""));
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(null);
    if (!login.username.trim()) { setError("Benutzername nötig."); return; }
    if (!login.password) { setError("Passwort nötig."); return; }
    try { await loginMutation.mutateAsync(login); } catch (err: any) { setError(mapLoginErr(err.message || "", (err as any).code)); }
  };

  const handleRetryEnrichment = async () => {
    try {
      setBriefingData(p => p ? { ...p, status: "polling", enrichmentStatus: "retrying" } : p);
      setOnboardingPhase("briefing");
      setBriefingTimelineStep(0);
      await fetch("/api/user/enrich/retry", { method: "POST", credentials: "include" });
    } catch { /* noop */ }
  };

  const handleEnterSpace = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    skipRedirectRef.current = false;
    setLocation("/space");
  };

  const isPending = registerMutation.isPending || loginMutation.isPending;

  // ═══════════════════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════════════════
  if (authLoading) return (
    <div className="flex h-screen items-center justify-center" style={{ background: CI.bgDark }}>
      <div className="animate-spin w-10 h-10 border-4 border-t-transparent rounded-full" style={{ borderColor: `${CI.orange} transparent ${CI.orange} ${CI.orange}` }} />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // ANALYSIS STATE
  // ═══════════════════════════════════════════════════════════════════════
  if (pageState === "analysis") return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: CI.bgDark, fontFamily: "Inter, system-ui, sans-serif" }}>
      {/* Premium aura */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(1200px 700px at 18% 10%, rgba(254,145,0,0.14), transparent 62%), radial-gradient(900px 560px at 86% 18%, rgba(233,215,196,0.08), transparent 64%), radial-gradient(820px 560px at 52% 92%, rgba(163,78,0,0.10), transparent 70%)" }} />
      {/* Horizon grid */}
      <div className="absolute left-1/2 top-[30%] pointer-events-none" aria-hidden="true" style={{ width: "min(1200px, 92vw)", height: 560, transform: "translateX(-50%) perspective(900px) rotateX(68deg)", transformOrigin: "center top", opacity: 0.15, background: "repeating-linear-gradient(to right, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px), repeating-linear-gradient(to bottom, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px)", maskImage: "radial-gradient(closest-side, rgba(0,0,0,0.95), transparent 74%)", WebkitMaskImage: "radial-gradient(closest-side, rgba(0,0,0,0.95), transparent 74%)" }} />

      <div className="relative z-10 mx-auto max-w-[720px] px-6 py-16 lg:py-24">
        <AnimatePresence mode="wait">
          {/* ── Header ── */}
          <motion.div key="analysis-header" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 mb-8">
            <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full" style={{ border: `1px solid rgba(233,215,196,0.16)`, background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)" }}>
              <motion.div className="w-2 h-2 rounded-full" style={{ background: `linear-gradient(180deg, ${CI.orange}, ${CI.goldDark})`, boxShadow: `0 0 14px rgba(254,145,0,0.6)` }} animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }} />
              <span className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ fontFamily: "Orbitron, sans-serif", color: "rgba(233,215,196,0.92)" }}>
                {onboardingPhase === "complete" ? "ANALYSE ABGESCHLOSSEN" : "LIVE ANALYSE"}
              </span>
            </motion.div>

            <motion.h2 initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.25, type: "spring", stiffness: 200 }} className="text-2xl md:text-3xl font-black" style={{ fontFamily: "Orbitron, sans-serif", background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark}, ${CI.goldLight})`, backgroundSize: "300% 100%", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "solarGradFlow 4s ease infinite" }}>
              {companyName || "ARAS AI"}
            </motion.h2>
            <style>{`@keyframes solarGradFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>

            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="text-sm max-w-md mx-auto" style={{ color: "rgba(245,245,247,0.56)" }}>
              {onboardingPhase === "complete" ? "Dein Intelligence-Profil ist bereit." : `ARAS AI analysiert ${companyName || "dein Unternehmen"} mit Live-Recherche…`}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* ── Timeline (polling) ── */}
        {briefingData?.status === "polling" && (
          <motion.div className="rounded-2xl overflow-hidden mb-6" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)", boxShadow: "0 18px 60px rgba(0,0,0,0.4)" }} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            {ANALYSIS_STEPS.map((step, i) => {
              const active = briefingTimelineStep === i;
              const done = briefingTimelineStep > i;
              const pending = briefingTimelineStep < i;
              return (
                <motion.div key={step.label} initial={{ opacity: 0 }} animate={{ opacity: pending ? 0.35 : 1 }} transition={{ delay: 0.35 + i * 0.12 }} className="flex items-center gap-3 px-5 py-3.5 relative" style={{ borderBottom: i < 3 ? "1px solid rgba(233,215,196,0.06)" : "none", background: active ? "rgba(254,145,0,0.06)" : "transparent" }}>
                  {active && <motion.div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(254,145,0,0.04), transparent)" }} animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 z-[1]" style={{ background: done ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})` : active ? "rgba(254,145,0,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${done ? "transparent" : active ? "rgba(254,145,0,0.3)" : "rgba(233,215,196,0.08)"}`, boxShadow: done ? "0 0 16px rgba(254,145,0,0.3)" : "none" }}>
                    {done ? <Check className="w-3.5 h-3.5 text-black" /> : active ? <motion.div className="w-2 h-2 rounded-full" style={{ background: CI.orange }} animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1, repeat: Infinity }} /> : <span className="text-[10px] font-bold" style={{ color: "rgba(245,245,247,0.3)" }}>{i + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0 z-[1]">
                    <p className={`text-[13px] font-semibold ${done || active ? "text-white" : "text-gray-500"}`}>{step.label}</p>
                    {active && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-[11px] mt-0.5" style={{ color: "rgba(254,145,0,0.7)" }}>{step.sub}</motion.p>}
                  </div>
                  {active && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} className="z-[1]"><div className="w-4 h-4 rounded-full border-2 border-[#FE9100]/30 border-t-[#FE9100]" /></motion.div>}
                </motion.div>
              );
            })}
            <div className="h-[2px] w-full relative overflow-hidden" style={{ background: "rgba(233,215,196,0.06)" }}>
              <motion.div className="absolute top-0 left-0 h-full" style={{ background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldDark})` }} initial={{ width: "0%" }} animate={{ width: `${Math.min((briefingTimelineStep + 1) / 4 * 100, 100)}%` }} transition={{ duration: 0.8, ease: CI.ease }} />
            </div>
          </motion.div>
        )}

        {/* ── Intelligence cards ── */}
        {briefingData && (
          <div className="space-y-3">
            {briefingData.companySnapshot && briefingData.companySnapshot.length > 10 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl p-5 overflow-hidden" style={{ border: `1px solid rgba(254,145,0,0.2)`, background: "linear-gradient(135deg, rgba(254,145,0,0.08), rgba(255,255,255,0.012))", boxShadow: "0 18px 60px rgba(0,0,0,0.4)" }}>
                <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2" style={{ color: "rgba(233,215,196,0.9)" }}>COMPANY INTELLIGENCE</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.78)" }}>{briefingData.companySnapshot.slice(0, 350)}{briefingData.companySnapshot.length > 350 ? "…" : ""}</p>
              </motion.div>
            )}
            {briefingData.targetAudience.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="rounded-xl p-5" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)", boxShadow: "0 16px 52px rgba(0,0,0,0.35)" }}>
                <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2.5" style={{ color: "rgba(233,215,196,0.7)" }}>ZIELGRUPPE</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.72)" }}>{briefingData.targetAudience.join(" ")}</p>
              </motion.div>
            )}
            {(briefingData.callAngles.length > 0 || briefingData.objections.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {briefingData.callAngles.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="rounded-xl p-5" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)", boxShadow: "0 16px 52px rgba(0,0,0,0.35)" }}>
                    <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2.5" style={{ color: "rgba(233,215,196,0.7)" }}>CALL ANGLES</h3>
                    <ul className="space-y-1.5">{briefingData.callAngles.slice(0, 4).map((a, i) => <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "rgba(245,245,247,0.68)" }}><div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: CI.orange }} />{a}</li>)}</ul>
                  </motion.div>
                )}
                {briefingData.objections.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className="rounded-xl p-5" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)", boxShadow: "0 16px 52px rgba(0,0,0,0.35)" }}>
                    <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2.5" style={{ color: "rgba(233,215,196,0.7)" }}>EINWANDBEHANDLUNG</h3>
                    <div className="space-y-2.5">{briefingData.objections.slice(0, 3).map((o, i) => <div key={i}><p className="text-[11px] font-medium mb-0.5" style={{ color: "rgba(254,145,0,0.7)" }}>{o.objection}</p><p className="text-[12px] pl-2.5" style={{ color: "rgba(245,245,247,0.62)", borderLeft: "2px solid rgba(254,145,0,0.2)" }}>{o.response}</p></div>)}</div>
                  </motion.div>
                )}
              </div>
            )}
            {(briefingData.competitors.length > 0 || briefingData.uniqueSellingPoints.length > 0) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {briefingData.competitors.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="rounded-xl p-5" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)" }}>
                    <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2.5" style={{ color: "rgba(233,215,196,0.7)" }}>WETTBEWERBER</h3>
                    <ul className="space-y-1.5">{briefingData.competitors.slice(0, 5).map((c, i) => <li key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(245,245,247,0.68)" }}><div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: "rgba(233,215,196,0.4)" }} />{c}</li>)}</ul>
                  </motion.div>
                )}
                {briefingData.uniqueSellingPoints.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="rounded-xl p-5" style={{ border: `1px solid rgba(254,145,0,0.15)`, background: "linear-gradient(135deg, rgba(254,145,0,0.04), rgba(255,255,255,0.01))" }}>
                    <h3 className="text-[11px] font-bold tracking-[0.18em] uppercase mb-2.5" style={{ color: "rgba(254,145,0,0.8)" }}>UNIQUE SELLING POINTS</h3>
                    <ul className="space-y-1.5">{briefingData.uniqueSellingPoints.slice(0, 5).map((u, i) => <li key={i} className="flex items-center gap-2 text-[12px]" style={{ color: "rgba(245,245,247,0.78)" }}><div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: CI.orange }} />{u}</li>)}</ul>
                  </motion.div>
                )}
              </div>
            )}
            {onboardingPhase === "complete" && briefingData.qualityScore > 0 && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="flex justify-center pt-1">
                <div className="px-4 py-1.5 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase" style={{ fontFamily: "Orbitron, sans-serif", background: "rgba(254,145,0,0.08)", border: "1px solid rgba(254,145,0,0.2)", color: "rgba(233,215,196,0.9)" }}>Intelligence Score {briefingData.qualityScore}/10</div>
              </motion.div>
            )}
          </div>
        )}

        {/* ── CTA: Enter Space ── */}
        {onboardingPhase === "complete" && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="pt-6 space-y-3">
            <motion.button onClick={handleEnterSpace} whileHover={{ y: -2, boxShadow: "0 26px 92px rgba(254,145,0,0.18)" }} whileTap={{ y: 0, scale: 0.99 }} className="relative w-full h-14 rounded-full font-extrabold text-sm uppercase overflow-hidden flex items-center justify-center gap-3" style={{ fontFamily: "Orbitron, sans-serif", letterSpacing: "0.08em", background: "linear-gradient(180deg, rgba(254,145,0,0.22), rgba(255,255,255,0.04))", border: "1px solid rgba(254,145,0,0.4)", color: "rgba(255,255,255,0.98)", boxShadow: "0 18px 64px rgba(254,145,0,0.15), 0 22px 74px rgba(0,0,0,0.60)" }}>
              ENTER SPACE <ArrowRight className="w-5 h-5" />
            </motion.button>
            {briefingData && (briefingData.enrichmentStatus === "failed" || briefingData.enrichmentStatus === "timeout" || briefingData.status === "timeout") && (
              <div className="p-3 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <p className="text-[11px] mb-2" style={{ color: "rgba(239,68,68,0.7)" }}>Enrichment {briefingData.enrichmentStatus === "timeout" ? "hat zu lange gedauert" : "ist fehlgeschlagen"}</p>
                <button onClick={handleRetryEnrichment} className="w-full py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider" style={{ background: "rgba(254,145,0,0.1)", border: "1px solid rgba(254,145,0,0.25)", color: "rgba(254,145,0,0.9)" }}>ERNEUT VERSUCHEN</button>
              </div>
            )}
            {briefingData && briefingData.status !== "timeout" && briefingData.enrichmentStatus !== "failed" && (
              <p className="text-[11px] text-center" style={{ color: "rgba(245,245,247,0.36)" }}>Dein personalisiertes Intelligence-Profil ist bereit.</p>
            )}
          </motion.div>
        )}

        {/* Polling progress bar */}
        {briefingData?.status === "polling" && (
          <div className="pt-6 px-2">
            <div className="h-[3px] w-full rounded-full overflow-hidden" style={{ background: "rgba(233,215,196,0.06)" }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${CI.orange}, ${CI.goldDark}, ${CI.orange})`, backgroundSize: "200% 100%" }}
                initial={{ width: "2%" }}
                animate={{ width: `${Math.min(Math.max((briefingPollCount / 30) * 100, 5), 95)}%`, backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
                transition={{ width: { duration: 1.2, ease: CI.ease }, backgroundPosition: { duration: 2.4, repeat: Infinity, ease: "linear" } }}
              />
            </div>
            <p className="text-[10px] text-center mt-2" style={{ color: "rgba(245,245,247,0.22)" }}>Analyse läuft…</p>
          </div>
        )}
      </div>
    </div>
  );

  // ═══════════════════════════════════════════════════════════════════════
  // FORM STATE (Landing Page)
  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: CI.bgDark }}>
      {/* Premium aura overlay */}
      <div className="absolute inset-0 pointer-events-none z-0" style={{ background: "radial-gradient(1200px 700px at 18% 10%, rgba(254,145,0,0.14), transparent 62%), radial-gradient(900px 560px at 86% 18%, rgba(233,215,196,0.08), transparent 64%), radial-gradient(820px 560px at 52% 92%, rgba(163,78,0,0.10), transparent 70%)" }} />
      {/* Horizon grid */}
      <div className="absolute left-1/2 top-[18%] pointer-events-none z-0" aria-hidden="true" style={{ width: "min(1200px, 92vw)", height: 560, transform: "translateX(-50%) perspective(900px) rotateX(68deg)", transformOrigin: "center top", opacity: 0.12, background: "repeating-linear-gradient(to right, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px), repeating-linear-gradient(to bottom, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px)", maskImage: "radial-gradient(closest-side, rgba(0,0,0,0.95), transparent 74%)", WebkitMaskImage: "radial-gradient(closest-side, rgba(0,0,0,0.95), transparent 74%)" }} />
      {/* Noise texture */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-[0.035]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundRepeat: "repeat", backgroundSize: 256 }} />

      {/* ══════════════ HERO ══════════════ */}
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 md:px-10 pt-12 md:pt-20 pb-8">
        <div className="grid lg:grid-cols-[1.15fr_0.85fr] gap-10 lg:gap-14 items-start">
          {/* Left */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: CI.ease }} className="flex flex-col gap-6">
            {/* Kicker pill */}
            <div className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-full w-fit" style={{ border: "1px solid rgba(233,215,196,0.16)", background: "rgba(255,255,255,0.02)", backdropFilter: "blur(12px)" }}>
              <span className="w-[7px] h-[7px] rounded-full flex-shrink-0" style={{ background: `linear-gradient(180deg, ${CI.orange}, ${CI.goldDark})`, boxShadow: "0 0 18px rgba(254,145,0,0.55)" }} />
              <span className="text-[11px] font-bold tracking-[0.22em] uppercase" style={{ fontFamily: "Orbitron, sans-serif", color: "rgba(233,215,196,0.92)" }}>ARAS AI® Solar Outbound</span>
            </div>

            {/* Headline */}
            <h1 className="text-[clamp(30px,5vw,52px)] font-[860] leading-[1.05] tracking-[0.02em]" style={{ fontFamily: "Orbitron, Inter, sans-serif", color: "rgba(245,245,247,0.96)" }}>
              Deine Solar-Leads.{" "}
              <span style={{ background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark}, ${CI.goldLight})`, backgroundSize: "300% 100%", backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", animation: "solarGradFlow 4s ease infinite" }}>Automatisch qualifiziert.</span>
            </h1>
            <style>{`@keyframes solarGradFlow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}`}</style>

            {/* Sub */}
            <p className="text-[clamp(15px,1.2vw,17px)] leading-[1.75] max-w-[60ch]" style={{ color: "rgba(245,245,247,0.72)" }}>
              ARAS AI® kontaktiert deine Leads <b style={{ color: "rgba(233,215,196,0.96)", fontWeight: 760 }}>sofort nach Eingang</b>, qualifiziert automatisch und bucht Vor-Ort-Termine direkt in den Kalender deines Außendienstes. <b style={{ color: "rgba(233,215,196,0.96)", fontWeight: 760 }}>24/7, ohne manuellen Aufwand.</b>
            </p>

            {/* Mini KPIs */}
            <div className="flex flex-wrap gap-3 mt-1">
              {[
                { icon: <Clock className="w-4 h-4" />, label: "24/7 Erreichbarkeit" },
                { icon: <ShieldCheck className="w-4 h-4" />, label: "Auto-Qualifizierung" },
                { icon: <CalendarCheck className="w-4 h-4" />, label: "Terminrouting" },
              ].map((kpi, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ border: "1px solid rgba(233,215,196,0.12)", background: "rgba(255,255,255,0.02)", color: "rgba(233,215,196,0.82)", fontSize: "12px", fontWeight: 600 }}>
                  <span style={{ color: CI.orange }}>{kpi.icon}</span>{kpi.label}
                </div>
              ))}
            </div>

            {/* Trust */}
            <p className="text-[12px] mt-1" style={{ color: "rgba(245,245,247,0.36)" }}>Kostenlos starten · Keine Kreditkarte · DSGVO-konform</p>
          </motion.div>

          {/* Right: Form Card */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.15, ease: CI.ease }} id="solar-form" className="w-full max-w-[440px] lg:max-w-none rounded-[26px] p-6 lg:p-7 relative overflow-hidden" style={{ border: "1px solid rgba(233,215,196,0.12)", background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.010))", boxShadow: "0 28px 86px rgba(0,0,0,0.55)" }}>
            {/* Card glow */}
            <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(400px 200px at 50% 0%, rgba(254,145,0,0.08), transparent 60%)" }} />

            {/* Tabs */}
            <div className="relative z-10 flex mb-6 rounded-full overflow-hidden p-1" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(233,215,196,0.08)" }}>
              {(["register", "login"] as const).map(t => (
                <button key={t} type="button" onClick={() => { setTab(t); setError(null); }} className="flex-1 py-2 rounded-full text-center transition-all duration-200" style={{ fontFamily: "Orbitron, sans-serif", fontSize: "11px", letterSpacing: "0.1em", fontWeight: 700, background: tab === t ? "rgba(254,145,0,0.12)" : "transparent", color: tab === t ? CI.orange : "rgba(245,245,247,0.5)", border: tab === t ? "1px solid rgba(254,145,0,0.2)" : "1px solid transparent" }}>
                  {t === "register" ? "REGISTRIEREN" : "EINLOGGEN"}
                </button>
              ))}
            </div>

            {/* Error */}
            {error && (
              <div className="relative z-10 rounded-xl p-3 mb-4 flex items-start gap-2" style={{ border: "1px solid rgba(239,68,68,0.25)", background: "rgba(239,68,68,0.06)" }}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "rgba(239,68,68,0.7)" }} />
                <span className="text-[13px]" style={{ color: "rgba(245,245,247,0.85)" }}>{error}</span>
              </div>
            )}

            {/* Register form */}
            <div className="relative z-10">
              {tab === "register" && (
                <form onSubmit={handleRegister} className="flex flex-col gap-3.5" noValidate>
                  <div className="grid grid-cols-2 gap-3">
                    <SolarField label="Vorname" id="r-fn" required><input id="r-fn" type="text" autoComplete="given-name" value={reg.firstName} onChange={e => setReg(p => ({ ...p, firstName: e.target.value }))} placeholder="Max" disabled={isPending} className="s-input" /></SolarField>
                    <SolarField label="Nachname" id="r-ln"><input id="r-ln" type="text" autoComplete="family-name" value={reg.lastName} onChange={e => setReg(p => ({ ...p, lastName: e.target.value }))} placeholder="Mustermann" disabled={isPending} className="s-input" /></SolarField>
                  </div>
                  <SolarField label="E-Mail" id="r-em" required><input id="r-em" type="email" autoComplete="email" value={reg.email} onChange={e => setReg(p => ({ ...p, email: e.target.value }))} placeholder="max@solarfirma.de" disabled={isPending} className="s-input" /></SolarField>
                  <SolarField label="Passwort" id="r-pw" required>
                    <div className="relative">
                      <input id="r-pw" type={showPassword ? "text" : "password"} autoComplete="new-password" value={reg.password} onChange={e => setReg(p => ({ ...p, password: e.target.value }))} placeholder="Mindestens 6 Zeichen" disabled={isPending} className="s-input pr-10" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,245,247,0.35)" }} aria-label={showPassword ? "Verbergen" : "Anzeigen"}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </SolarField>
                  <SolarField label="Telefon" id="r-ph" required><input id="r-ph" type="tel" autoComplete="tel" value={reg.phone} onChange={e => setReg(p => ({ ...p, phone: e.target.value }))} placeholder="+49 170 1234567" disabled={isPending} className="s-input" /></SolarField>
                  <SolarField label="Firma" id="r-co"><input id="r-co" type="text" autoComplete="organization" value={reg.company} onChange={e => setReg(p => ({ ...p, company: e.target.value }))} placeholder="SolarTech GmbH" disabled={isPending} className="s-input" /></SolarField>
                  <SolarField label="Website" id="r-ws"><input id="r-ws" type="text" autoComplete="url" value={reg.website} onChange={e => setReg(p => ({ ...p, website: e.target.value }))} placeholder="www.solartech.de" disabled={isPending} className="s-input" /></SolarField>
                  {/* Honeypot */}
                  <div aria-hidden="true" style={{ position: "absolute", left: -9999, top: -9999, opacity: 0, height: 0, overflow: "hidden" }}><input tabIndex={-1} autoComplete="off" value={honeypot} onChange={e => setHoneypot(e.target.value)} /></div>
                  <motion.button type="submit" disabled={isPending} whileHover={isPending ? {} : { y: -2, boxShadow: `0 22px 72px rgba(254,145,0,0.18)` }} whileTap={isPending ? {} : { y: 0, scale: 0.99 }} className="mt-1 w-full h-12 rounded-full font-extrabold text-sm uppercase flex items-center justify-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-0" style={{ fontFamily: "Orbitron, sans-serif", letterSpacing: "0.06em", background: `linear-gradient(180deg, rgba(254,145,0,0.20), rgba(255,255,255,0.03))`, border: "1px solid rgba(254,145,0,0.35)", color: isPending ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.96)", boxShadow: "0 14px 52px rgba(254,145,0,0.10)", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}>
                    {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Wird erstellt…</> : <>Kostenlos registrieren <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                  <p className="text-[11px] text-center" style={{ color: "rgba(245,245,247,0.36)" }}>Mit Registrierung akzeptierst du <a href="/terms" className="underline hover:text-white/60">AGB</a> & <a href="/privacy" className="underline hover:text-white/60">Datenschutz</a>.</p>
                </form>
              )}

              {tab === "login" && (
                <form onSubmit={handleLogin} className="flex flex-col gap-3.5" noValidate>
                  <SolarField label="Benutzername" id="l-un" required><input id="l-un" type="text" autoComplete="username" value={login.username} onChange={e => setLogin(p => ({ ...p, username: e.target.value }))} placeholder="Dein Benutzername" disabled={isPending} className="s-input" /></SolarField>
                  <SolarField label="Passwort" id="l-pw" required>
                    <div className="relative">
                      <input id="l-pw" type={showPassword ? "text" : "password"} autoComplete="current-password" value={login.password} onChange={e => setLogin(p => ({ ...p, password: e.target.value }))} placeholder="Dein Passwort" disabled={isPending} className="s-input pr-10" />
                      <button type="button" tabIndex={-1} onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(245,245,247,0.35)" }}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    </div>
                  </SolarField>
                  <motion.button type="submit" disabled={isPending} whileHover={isPending ? {} : { y: -2 }} whileTap={isPending ? {} : { y: 0, scale: 0.99 }} className="mt-1 w-full h-12 rounded-full font-extrabold text-sm uppercase flex items-center justify-center gap-2.5" style={{ fontFamily: "Orbitron, sans-serif", letterSpacing: "0.06em", background: "linear-gradient(180deg, rgba(254,145,0,0.20), rgba(255,255,255,0.03))", border: "1px solid rgba(254,145,0,0.35)", color: isPending ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.96)", boxShadow: "0 14px 52px rgba(254,145,0,0.10)", cursor: isPending ? "not-allowed" : "pointer", opacity: isPending ? 0.6 : 1 }}>
                    {isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Anmeldung…</> : <>Einloggen <ArrowRight className="w-4 h-4" /></>}
                  </motion.button>
                  <p className="text-[11px] text-center" style={{ color: "rgba(245,245,247,0.36)" }}><a href="/forgot-password" className="underline hover:text-white/60">Passwort vergessen?</a></p>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ══════════════ COMMAND SECTION (After Hero) ══════════════ */}
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 md:px-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-start">
          {/* Left: Features */}
          <div className="flex flex-col gap-5">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full w-fit" style={{ border: "1px solid rgba(233,215,196,0.12)", background: "rgba(255,255,255,0.02)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(233,215,196,0.82)", fontFamily: "Orbitron, sans-serif" }}>
              <Sparkles className="w-3.5 h-3.5" style={{ color: CI.orange }} /> SO FUNKTIONIERT ARAS
            </div>
            <h2 className="text-[clamp(24px,3.5vw,40px)] font-[860] leading-[1.08]" style={{ fontFamily: "Orbitron, Inter, sans-serif", color: "rgba(245,245,247,0.96)" }}>Vom Lead zum Termin — <span style={{ color: CI.orange }}>in Minuten.</span></h2>
            <p className="text-[15px] leading-[1.7] max-w-[54ch]" style={{ color: "rgba(245,245,247,0.6)" }}>ARAS scannt dein Unternehmen, versteht dein Angebot und kontaktiert Leads mit einer personalisierten Gesprächsstrategie. Kein Setup, kein Skript schreiben.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {[
                { icon: <Scan className="w-[18px] h-[18px]" />, title: "Auto-Company-Scan", desc: "ARAS versteht dein Business sofort — ohne Setup." },
                { icon: <Target className="w-[18px] h-[18px]" />, title: "Realtime Lead-Context", desc: "Kontext-Recherche vor jedem Anruf." },
                { icon: <Phone className="w-[18px] h-[18px]" />, title: "Outbound in Scale", desc: "Hunderte Calls parallel — wie echte Mitarbeiter." },
                { icon: <CalendarCheck className="w-[18px] h-[18px]" />, title: "Termin direkt gebucht", desc: "Qualifizierte Termine im Kalender deines Teams." },
              ].map((c, i) => (
                <TiltCard key={i}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)" }}><span style={{ color: "rgba(233,215,196,0.92)" }}>{c.icon}</span></div>
                    <div><h4 className="text-[14px] font-[800] mb-1" style={{ color: "rgba(245,245,247,0.94)", letterSpacing: "0.01em" }}>{c.title}</h4><p className="text-[13px] leading-[1.55]" style={{ color: "rgba(245,245,247,0.60)" }}>{c.desc}</p></div>
                  </div>
                </TiltCard>
              ))}
            </div>
          </div>

          {/* Right: Live Preview Panel */}
          <TiltCard className="rounded-[26px]" style={{ border: "1px solid rgba(233,215,196,0.12)", background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))", boxShadow: "0 28px 86px rgba(0,0,0,0.55)" }}>
            <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: "1px solid rgba(233,215,196,0.08)" }}>
              <div className="flex items-center gap-2.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: "rgba(254,145,0,0.7)", boxShadow: "0 0 18px rgba(254,145,0,0.45)" }} /><span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: "rgba(233,215,196,0.9)", fontFamily: "Orbitron, sans-serif" }}>Live Preview</span></div>
              <div className="flex gap-[7px]">{[0, 1, 2].map(i => <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ border: "1px solid rgba(233,215,196,0.12)", background: "rgba(255,255,255,0.05)" }} />)}</div>
            </div>
            <div className="p-5 space-y-3">
              {[
                { icon: <ArrowRight className="w-[18px] h-[18px]" />, title: "Outbound in Scale", desc: "Liste rein → ARAS ruft an → Ergebnisse live.", tag: "1 Klick" },
                { icon: <Target className="w-[18px] h-[18px]" />, title: "Vor dem Call: Kontext", desc: "Realtime Research — natürlicher Einstieg.", tag: "Live" },
                { icon: <Scan className="w-[18px] h-[18px]" />, title: "Deine Knowledge Base", desc: "Produkte, Regeln, Angebote — ARAS nutzt es.", tag: "Synced" },
              ].map((row, i) => (
                <div key={i} className="rounded-[18px] p-4 flex items-start justify-between gap-3 transition-colors duration-200 hover:border-[rgba(254,145,0,0.22)]" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)" }}>
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", boxShadow: "0 16px 52px rgba(0,0,0,0.42)" }}><span style={{ color: "rgba(233,215,196,0.92)" }}>{row.icon}</span></div>
                    <div><h4 className="text-[14px] font-[820] mb-1" style={{ color: "rgba(245,245,247,0.92)" }}>{row.title}</h4><p className="text-[13px] leading-[1.55]" style={{ color: "rgba(245,245,247,0.60)" }}>{row.desc}</p></div>
                  </div>
                  <span className="flex-shrink-0 mt-0.5 px-2.5 py-1.5 rounded-full text-[11px] whitespace-nowrap" style={{ border: "1px solid rgba(254,145,0,0.22)", background: "rgba(254,145,0,0.07)", color: "rgba(233,215,196,0.92)" }}>{row.tag}</span>
                </div>
              ))}
            </div>
          </TiltCard>
        </div>
      </div>

      {/* ══════════════ PROBLEM / SOLUTION ══════════════ */}
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 md:px-10 pb-20">
        <SectionHeading>Problem: Leads gehen verloren</SectionHeading>
        <p className="text-center max-w-2xl mx-auto mb-10 text-[15px] leading-relaxed" style={{ color: "rgba(245,245,247,0.56)" }}>Jede Minute zählt. Ohne sofortige Kontaktaufnahme sinkt die Abschlussquote dramatisch.</p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { icon: <Clock className="w-5 h-5" />, title: "Langsame Reaktionszeit", body: "Anfragen bleiben stundenlang unbearbeitet. Der Interessent unterschreibt beim Wettbewerber." },
            { icon: <Phone className="w-5 h-5" />, title: "Kein Rückruf, kein Termin", body: "Außendienst unterwegs, Büro überlastet. Rückrufe vergessen, Termine nicht gebucht." },
            { icon: <Zap className="w-5 h-5" />, title: "Manuelle Nachfassung", body: "Dein Team telefoniert Listen ab statt zu beraten. Qualifizierung ohne System." },
          ].map((c, i) => (
            <div key={i} className="rounded-[20px] p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.014)", transition: "border-color 0.2s, background 0.2s" }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(254,145,0,0.08)", border: "1px solid rgba(254,145,0,0.15)" }}><span style={{ color: CI.orange }}>{c.icon}</span></div>
              <h3 className="text-[14px] font-bold" style={{ fontFamily: "Orbitron, sans-serif", color: "rgba(245,245,247,0.94)" }}>{c.title}</h3>
              <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.56)" }}>{c.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <SectionHeading>Was ARAS für dich übernimmt</SectionHeading>
          <p className="text-center max-w-2xl mx-auto mb-10 text-[15px] leading-relaxed" style={{ color: "rgba(245,245,247,0.56)" }}>Vom ersten Kontakt bis zum gebuchten Termin — vollautomatisch.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: <ShieldCheck className="w-5 h-5" />, title: "Qualify", body: "Automatische Qualifizierung nach deinen Kriterien." },
              { icon: <CalendarCheck className="w-5 h-5" />, title: "Termin buchen", body: "Vor-Ort-Termin direkt im Außendienst-Kalender." },
              { icon: <Bell className="w-5 h-5" />, title: "Reminder", body: "Auto-Erinnerungen reduzieren No-Shows auf <5 %." },
              { icon: <UserCheck className="w-5 h-5" />, title: "Übergabe", body: "Gesprächsprotokoll + Lead-Daten in deinem CRM." },
            ].map((c, i) => (
              <div key={i} className="rounded-[20px] p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(254,145,0,0.12)", background: "rgba(254,145,0,0.02)", transition: "border-color 0.2s" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(254,145,0,0.08)", border: "1px solid rgba(254,145,0,0.15)" }}><span style={{ color: CI.orange }}>{c.icon}</span></div>
                <h3 className="text-[13px] font-bold" style={{ fontFamily: "Orbitron, sans-serif", color: "rgba(245,245,247,0.94)" }}>{c.title}</h3>
                <p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.56)" }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════ TIMELINE ══════════════ */}
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 md:px-10 pb-20">
        <SectionHeading>So startest du</SectionHeading>
        <div className="max-w-xl mx-auto flex flex-col gap-10 relative mt-10">
          <div className="absolute left-[19px] top-5 bottom-5 w-[2px]" style={{ background: `linear-gradient(to bottom, rgba(254,145,0,0.5), rgba(254,145,0,0.15), transparent)` }} />
          {[
            { n: 1, title: "Kostenlos registrieren", body: "Account in unter 60 Sekunden. Keine Kreditkarte." },
            { n: 2, title: "ARAS analysiert dein Unternehmen", body: "Automatische Profil-Erstellung mit Live-Recherche zu deiner Zielgruppe." },
            { n: 3, title: "Leads automatisch qualifizieren", body: "Lead-Quellen verbinden und ARAS übernimmt Erstkontakt + Terminbuchung." },
          ].map(s => (
            <div key={s.n} className="relative flex gap-5">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm z-10" style={{ fontFamily: "Orbitron, sans-serif", border: "1px solid rgba(254,145,0,0.3)", background: CI.bgDark, color: CI.orange, boxShadow: "0 0 15px rgba(254,145,0,0.12)" }}>{s.n}</div>
              <div className="pt-1"><h3 className="text-[15px] font-semibold mb-1" style={{ fontFamily: "Orbitron, sans-serif", color: "rgba(245,245,247,0.94)" }}>{s.title}</h3><p className="text-sm leading-relaxed" style={{ color: "rgba(245,245,247,0.56)" }}>{s.body}</p></div>
            </div>
          ))}
        </div>
        <div className="flex justify-center mt-10">
          <motion.a href="#solar-form" whileHover={{ y: -2 }} className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm uppercase" style={{ fontFamily: "Orbitron, sans-serif", letterSpacing: "0.06em", background: "linear-gradient(180deg, rgba(254,145,0,0.20), rgba(255,255,255,0.03))", border: "1px solid rgba(254,145,0,0.35)", color: "rgba(255,255,255,0.96)", boxShadow: "0 14px 52px rgba(254,145,0,0.10)" }}>Jetzt kostenlos starten <ArrowRight className="w-4 h-4" /></motion.a>
        </div>
      </div>

      {/* ══════════════ FAQ ══════════════ */}
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 md:px-10 pb-20">
        <SectionHeading>Häufige Fragen</SectionHeading>
        <div className="max-w-2xl mx-auto flex flex-col gap-2 mt-10">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="rounded-xl overflow-hidden transition-colors" style={{ border: "1px solid rgba(233,215,196,0.08)", background: openFaq === i ? "rgba(254,145,0,0.04)" : "rgba(255,255,255,0.015)" }}>
              <button type="button" onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left" aria-expanded={openFaq === i}>
                <span className="text-[14px] font-medium pr-4" style={{ color: "rgba(245,245,247,0.88)" }}>{item.q}</span>
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${openFaq === i ? "rotate-180" : ""}`} style={{ color: CI.orange }} />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: CI.ease }}>
                    <div className="px-5 pb-4"><p className="text-[13px] leading-relaxed" style={{ color: "rgba(245,245,247,0.56)" }}>{item.a}</p></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Scoped input styles */}
      <style>{`
        .s-input{width:100%;padding:0.6rem 0.75rem;border-radius:12px;border:1px solid rgba(233,215,196,0.10);background:rgba(255,255,255,0.03);color:#fff;font-size:0.875rem;line-height:1.5;font-family:Inter,sans-serif;outline:none;transition:border-color 160ms ease,box-shadow 160ms ease;}
        .s-input::placeholder{color:rgba(245,245,247,0.25);}
        .s-input:focus{border-color:rgba(254,145,0,0.5);box-shadow:0 0 0 2px rgba(254,145,0,0.15),0 0 20px rgba(254,145,0,0.05);}
        .s-input:disabled{opacity:0.45;cursor:not-allowed;}
        @media(prefers-reduced-motion:reduce){.s-input:focus{box-shadow:0 0 0 2px rgba(254,145,0,0.15);}}
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════════════

function SolarField({ label, id, required, children }: { label: string; id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium" style={{ color: "rgba(245,245,247,0.50)", fontFamily: "Inter, sans-serif" }}>
        {label}{required && <span style={{ color: CI.orange, marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-center text-[clamp(24px,4vw,36px)] font-[860] mb-3" style={{ fontFamily: "Orbitron, Inter, sans-serif", background: `linear-gradient(90deg, ${CI.goldLight}, ${CI.orange}, ${CI.goldDark})`, backgroundClip: "text", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
      {children}
    </h2>
  );
}

function TiltCard({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  const handleMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      const ry = Math.max(-10, Math.min(10, x * 10));
      const rx = Math.max(-7, Math.min(7, -y * 7));
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    });
  }, []);

  const handleLeave = useCallback(() => {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }, []);

  const prefersReduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div ref={ref} onPointerMove={prefersReduced ? undefined : handleMove} onPointerLeave={prefersReduced ? undefined : handleLeave} className={`relative overflow-hidden ${className}`} style={{ ...style, transformStyle: "preserve-3d", transition: "transform 0.18s cubic-bezier(0.16,1,0.3,1)", willChange: "transform", borderRadius: style.borderRadius || 20, border: style.border || "1px solid rgba(233,215,196,0.12)", background: style.background || "rgba(255,255,255,0.014)", padding: style.padding || "14px", boxShadow: style.boxShadow || "0 18px 70px rgba(0,0,0,0.52)" }}>
      {children}
    </div>
  );
}
