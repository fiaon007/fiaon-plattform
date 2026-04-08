import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Crown,
  Phone,
  Check,
  ChevronRight,
  Lock,
  Shield,
  Sparkles,
  Info,
} from "lucide-react";

/* ─── Constants ────────────────────────────────────────────────────────── */
const STRIPE_LINK = "https://buy.stripe.com/cNi3cpbUL4Tu6aO6x67Zu01";
const TOTAL_CAP = 500;
const PRODUCT_NAME = "Founding\u2011Zugang";

/* ─── Smooth animated number (rAF easeOutCubic 580ms) ─────────────────── */
function useAnimatedNumber(target: number, duration = 580) {
  const [display, setDisplay] = useState(target);
  const raf = useRef(0);
  const prev = useRef(target);
  useEffect(() => {
    const from = prev.current;
    const delta = target - from;
    if (delta === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(target); prev.current = target; return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(from + (1 - Math.pow(1 - t, 3)) * delta));
      if (t < 1) raf.current = requestAnimationFrame(step);
      else prev.current = target;
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return display;
}

/* ─── Magnetic CTA (fine pointer only, reduced-motion guard) ───────────── */
function useMagnetic(strength = 6) {
  const ref = useRef<HTMLButtonElement>(null);
  const onMove = useCallback((e: React.MouseEvent) => {
    if (!window.matchMedia("(pointer:fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${((e.clientX - r.left) / r.width - 0.5) * strength}px, ${((e.clientY - r.top) / r.height - 0.5) * strength}px)`;
  }, [strength]);
  const onLeave = useCallback(() => { if (ref.current) ref.current.style.transform = ""; }, []);
  return { ref, onMouseMove: onMove, onMouseLeave: onLeave };
}

/* ─── 3D Tilt (fine pointer, reduced-motion guard, CSS vars) ───────────── */
function useTilt(maxDeg = 8) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.PointerEvent) => {
    if (!window.matchMedia("(pointer:fine)").matches || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -maxDeg}deg`);
    el.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * maxDeg}deg`);
  }, [maxDeg]);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (el) { el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); }
  }, []);
  return { ref, onPointerMove: onMove, onPointerLeave: onLeave };
}

/* ─── Intersection-Observer reveal ─────────────────────────────────────── */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setVisible(true); return; }
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ─── Section wrapper ──────────────────────────────────────────────────── */
function RevealSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, visible } = useReveal();
  return (
    <section ref={ref} id={id} className={`transition-all ease-[cubic-bezier(.16,1,.3,1)] ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"} ${className}`} style={{ transitionDuration: "380ms" }}>
      {children}
    </section>
  );
}

/* ─── Glass Card ───────────────────────────────────────────────────────── */
function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[24px] border border-[rgba(233,215,196,0.12)] bg-[rgba(255,255,255,0.015)] backdrop-blur-[12px] shadow-[0_18px_70px_rgba(0,0,0,0.55)] transition-all duration-300 ease-out hover:border-[rgba(254,145,0,0.22)] hover:-translate-y-[2px] hover:shadow-[0_22px_80px_rgba(0,0,0,0.6)] ${className}`}>
      {children}
    </div>
  );
}

/* ─── Gold Gradient Text ───────────────────────────────────────────────── */
function GoldGradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-block bg-clip-text text-transparent founding-gold-gradient ${className}`} style={{ backgroundSize: "200% 100%", animation: "foundingGoldWave 6s ease-in-out infinite" }}>
      {children}
    </span>
  );
}

/* ─── Telemetry Loading Skeleton ───────────────────────────────────────── */
function TelemetrySkeleton() {
  return (
    <div className="rounded-[28px] p-5 md:p-6 space-y-4" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(233,215,196,.10)" }}>
      <div className="h-3 w-20 rounded bg-[rgba(233,215,196,.08)] animate-pulse" />
      <div className="h-12 w-28 rounded bg-[rgba(233,215,196,.06)] animate-pulse" />
      <div className="h-3 w-full rounded-full bg-[rgba(233,215,196,.06)] animate-pulse" />
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-10 rounded bg-[rgba(233,215,196,.05)] animate-pulse" />)}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function FoundingMemberPass() {
  const [lastUpdate, setLastUpdate] = useState(0);
  const reduceMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);

  const { data: stats, dataUpdatedAt, refetch, isError, isLoading } = useQuery<{ cap: number; pending: number; activated: number; total: number }>({
    queryKey: ["/api/public/founding/stats"],
    refetchInterval: 15000,
    staleTime: 8000,
  });

  useEffect(() => { if (dataUpdatedAt) setLastUpdate(dataUpdatedAt); }, [dataUpdatedAt]);

  useEffect(() => {
    const vis = () => { if (document.visibilityState === "visible") refetch(); };
    const foc = () => refetch();
    document.addEventListener("visibilitychange", vis);
    window.addEventListener("focus", foc);
    return () => { document.removeEventListener("visibilitychange", vis); window.removeEventListener("focus", foc); };
  }, [refetch]);

  const [secondsAgo, setSecondsAgo] = useState(0);
  useEffect(() => {
    if (!lastUpdate) return;
    const tick = () => setSecondsAgo(Math.floor((Date.now() - lastUpdate) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastUpdate]);

  const available = useAnimatedNumber(stats ? stats.cap - stats.total : 0);
  const reserved = useAnimatedNumber(stats?.total ?? 0);
  const animActivated = useAnimatedNumber(stats?.activated ?? 0);
  const animPending = useAnimatedNumber(stats?.pending ?? 0);

  const [heroOffset, setHeroOffset] = useState(0);
  useEffect(() => {
    if (reduceMotion) return;
    const onScroll = () => setHeroOffset(Math.min(window.scrollY * 0.12, 30));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduceMotion]);

  const handleCTA = useCallback(() => { window.location.href = STRIPE_LINK; }, []);
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [reduceMotion]);

  const mag = useMagnetic(6);
  const tiltTelemetry = useTilt(8);
  const tiltSystem = useTilt(7);

  const sd = (i: number) => ({ duration: 0.32, delay: 0.04 + i * 0.06, ease: [0.16, 1, 0.3, 1] });

  const pillStyle = (s: string) =>
    s === "LIVE" ? { background: "rgba(254,145,0,.12)", color: "var(--f-orange)" }
    : s === "READY" ? { background: "rgba(233,215,196,.08)", color: "var(--f-gold)" }
    : { background: "rgba(233,215,196,.05)", color: "var(--f-soft)" };

  return (
    <>
      <style>{`
        .founding2026 { --f-gold: var(--aras-gold-light); --f-orange: var(--aras-orange); --f-dark: var(--aras-gold-dark); --f-bg: var(--aras-bg); --f-text: var(--aras-text); --f-muted: var(--aras-muted); --f-soft: var(--aras-soft); }
        @keyframes foundingGoldWave { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        .founding-gold-gradient { background-image: linear-gradient(90deg, var(--f-gold) 0%, var(--f-orange) 30%, var(--f-dark) 55%, var(--f-gold) 100%); }
        @keyframes foundingPulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:.45; transform:scale(1.45); } }
        @keyframes foundingNoise { 0% { transform:translate(0,0); } 20% { transform:translate(-1.5%,-1.5%); } 40% { transform:translate(1.5%,1%); } 60% { transform:translate(-1%,1.5%); } 80% { transform:translate(1%,-1%); } 100% { transform:translate(0,0); } }
        @keyframes foundingScanline { 0% { transform:translateY(-100%); } 100% { transform:translateY(100%); } }
        @keyframes foundingShimmer { 0% { left:-100%; } 100% { left:200%; } }
        .founding2026 .f-tabnum { font-variant-numeric: tabular-nums; }
        .founding2026 .f-cta-shimmer { position:relative; overflow:hidden; }
        .founding2026 .f-cta-shimmer::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.12),transparent); animation:foundingShimmer 3s ease-in-out infinite; pointer-events:none; }
        .founding2026 .f-tilt { --rx:0deg; --ry:0deg; transform:perspective(600px) rotateX(var(--rx)) rotateY(var(--ry)); transition:transform .18s ease-out; }
        @media (prefers-reduced-motion: reduce) {
          .founding-gold-gradient, .founding2026 .f-cta-shimmer::after { animation:none !important; }
          .founding2026 .founding-pulse { animation:none !important; }
          .founding2026 .founding-noise-inner { animation:none !important; }
          .founding2026 .f-scanline { animation:none !important; display:none; }
          .founding2026 .f-tilt { transform:none !important; transition:none !important; }
        }
      `}</style>

      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[10000] focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--aras-orange)]">
        Zum Inhalt springen
      </a>

      <main id="main-content" className="founding2026 relative w-full overflow-x-hidden" style={{ background: "var(--f-bg)" }}>

        {/* ═══ HERO ═══ */}
        <section className="relative px-5 md:px-8" style={{ minHeight: "min(100vh, 980px)" }}>
          {/* BG layers */}
          <div className="absolute inset-0 pointer-events-none will-change-transform" style={{ background: "radial-gradient(1200px circle at 20% 10%, rgba(254,145,0,.16), transparent 60%), radial-gradient(900px circle at 85% 20%, rgba(233,215,196,.09), transparent 65%)", transform: `translateY(${heroOffset}px) translateZ(0)` }} />
          <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ opacity: 0.04 }}>
            <div className="founding-noise-inner absolute -inset-1/2 w-[200%] h-[200%]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: "256px 256px", animation: "foundingNoise 8s steps(5) infinite" }} />
          </div>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(233,215,196,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(233,215,196,.04) 1px, transparent 1px)", backgroundSize: "60px 60px", maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.10) 50%, transparent 85%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,.10) 50%, transparent 85%)" }} />

          {/* Hero grid: 2-col desktop, stacked mobile */}
          <div className="relative z-10 max-w-[1180px] w-full mx-auto grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-10 lg:gap-14 items-center pt-16 md:pt-24 pb-12 md:pb-20">

            {/* LEFT COLUMN */}
            <div className="text-left">
              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 0.85, y: 0 }} transition={sd(0)} className="font-orbitron uppercase text-[11px] tracking-[.24em] mb-5" style={{ color: "var(--f-gold)" }}>
                FOUNDING-ZUGANG · LIMITIERT
              </motion.p>

              <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={sd(1)} className="font-orbitron font-bold leading-[1.04] mb-5" style={{ fontSize: "clamp(2.4rem, 6vw, 4.8rem)" }}>
                <span style={{ color: "var(--f-text)" }}>PRO dauerhaft.</span>{" "}
                <GoldGradientText>Einmal zahlen.</GoldGradientText>
              </motion.h1>

              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={sd(2)} className="font-inter text-base md:text-lg max-w-[520px] mb-8 leading-relaxed" style={{ color: "var(--f-text)", opacity: 0.78 }}>
                Für die, die ARAS nicht nur testen — sondern damit arbeiten wollen.
                <br className="hidden sm:block" />
                {TOTAL_CAP} Plätze, einmaliger Preis, kein Abo.
              </motion.p>

              {/* TL;DR Bento 2x2 */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={sd(3)} className="grid grid-cols-2 gap-2.5 mb-8 max-w-[440px]">
                {[
                  { label: "Einmalig 499 CHF", sub: "Kein Abo" },
                  { label: "PRO dauerhaft", sub: "Solange ARAS existiert" },
                  { label: "500 Calls / Monat", sub: "Inklusive" },
                  { label: `Limitiert auf ${TOTAL_CAP}`, sub: "Founding Runde" },
                ].map(({ label, sub }) => (
                  <div key={label} className="rounded-[16px] px-4 py-3 transition-all duration-200 hover:-translate-y-[1px]" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(233,215,196,.10)" }}>
                    <p className="font-inter font-semibold text-[13px] mb-0.5" style={{ color: "var(--f-text)" }}>{label}</p>
                    <p className="text-[11px]" style={{ color: "var(--f-soft)" }}>{sub}</p>
                  </div>
                ))}
              </motion.div>

              {/* CTA row */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={sd(4)} className="flex flex-col sm:flex-row items-start gap-3 mb-4">
                <button
                  ref={mag.ref}
                  onMouseMove={mag.onMouseMove}
                  onMouseLeave={mag.onMouseLeave}
                  onClick={handleCTA}
                  className="aras-btn--primary f-cta-shimmer h-[54px] px-8 rounded-full font-inter font-semibold text-[15px] cursor-pointer transition-all duration-300 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--f-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--f-bg)]"
                  aria-label={`${PRODUCT_NAME} sichern für 499 CHF — weiter zu Stripe`}
                >
                  {PRODUCT_NAME} sichern (499 CHF)
                  <ChevronRight className="inline-block w-4 h-4 ml-1.5 -mt-0.5" />
                </button>
                <button
                  onClick={() => scrollTo("features")}
                  className="aras-btn--secondary h-[44px] px-6 rounded-full font-inter font-medium text-[13px] cursor-pointer transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--f-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--f-bg)]"
                  aria-label="Details ansehen"
                >
                  Details ansehen
                </button>
              </motion.div>

              {/* Micro trust */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={sd(5)} className="flex flex-col gap-1.5">
                <p className="text-[12px] font-inter" style={{ color: "var(--f-soft)" }}>Sichere Zahlung via Stripe.</p>
                <a href="/founding/success" className="text-[12px] font-inter underline-offset-4 hover:underline transition-opacity opacity-60 hover:opacity-100" style={{ color: "var(--f-gold)" }}>
                  Schon bezahlt? Account zuordnen →
                </a>
              </motion.div>
            </div>

            {/* RIGHT COLUMN — Telemetry + System Panel */}
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-5">

              {/* Telemetry Panel */}
              {isLoading && !stats ? (
                <TelemetrySkeleton />
              ) : stats ? (
                <div
                  ref={tiltTelemetry.ref}
                  onPointerMove={tiltTelemetry.onPointerMove}
                  onPointerLeave={tiltTelemetry.onPointerLeave}
                  className="relative rounded-[28px] overflow-hidden f-tilt"
                  style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(233,215,196,.14)", boxShadow: "0 30px 100px rgba(0,0,0,.6)" }}
                >
                  <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 15% 0%, rgba(254,145,0,.10) 0%, transparent 55%)" }} />
                  <div className="relative p-5 md:p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <span className="founding-pulse inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: "var(--f-orange)", animation: "foundingPulse 1.6s ease-in-out infinite" }} />
                      <span className="text-[10.5px] font-inter font-bold uppercase" style={{ color: "var(--f-orange)", letterSpacing: ".28em" }}>LIVE</span>
                    </div>

                    <p className="text-[11px] font-inter uppercase tracking-wider mb-1" style={{ color: "var(--f-muted)" }}>Noch verfügbar</p>
                    <div className="flex items-baseline gap-2 mb-5">
                      <span className="font-orbitron font-bold text-[40px] md:text-[52px] leading-none founding-gold-gradient bg-clip-text text-transparent f-tabnum" style={{ backgroundSize: "200% 100%", animation: "foundingGoldWave 6s ease-in-out infinite", minWidth: "3ch" }}>{available}</span>
                      <span className="text-[13px] font-inter" style={{ color: "var(--f-soft)" }}>/ {stats.cap}</span>
                    </div>

                    <div className="w-full rounded-[999px] h-[10px] md:h-[12px] overflow-hidden mb-5" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-[999px]" style={{ width: `${Math.min((reserved / (stats.cap || 1)) * 100, 100)}%`, background: "linear-gradient(90deg, var(--f-gold), var(--f-orange), var(--f-dark))", boxShadow: "0 0 24px rgba(254,145,0,.28)", transition: "width 520ms cubic-bezier(.16,1,.3,1)" }} />
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-3">
                      {[
                        { label: "Vergeben", val: reserved, tip: "Gesamtzahl vergebener Zugänge" },
                        { label: "Aktiviert", val: animActivated, tip: "Bereits freigeschaltete Accounts" },
                        { label: "In Bearbeitung", val: animPending, tip: "Zuordnung wird geprüft" },
                      ].map(({ label, val, tip }) => (
                        <div key={label} className="text-center">
                          <p className="font-orbitron font-bold text-[18px] f-tabnum" style={{ color: "var(--f-gold)", minWidth: "2ch" }}>{val}</p>
                          <p className="text-[10px] font-inter inline-flex items-center gap-0.5" style={{ color: "var(--f-soft)" }}>
                            {label}
                            <Info className="w-[10px] h-[10px] opacity-40 cursor-help" title={tip} />
                          </p>
                        </div>
                      ))}
                    </div>

                    {lastUpdate > 0 && (
                      <p className="text-[10.5px] font-inter" style={{ color: "var(--f-soft)", opacity: 0.5 }}>
                        Update vor {secondsAgo < 60 ? `${secondsAgo}s` : `${Math.floor(secondsAgo / 60)}m`}
                      </p>
                    )}
                  </div>
                </div>
              ) : isError ? (
                <div className="rounded-[28px] p-5 text-center" style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(233,215,196,.10)" }}>
                  <p className="text-[13px] font-inter" style={{ color: "var(--f-muted)" }}>Live-Status momentan nicht verfügbar.</p>
                </div>
              ) : null}

              {/* System Preview Panel */}
              <div
                ref={tiltSystem.ref}
                onPointerMove={tiltSystem.onPointerMove}
                onPointerLeave={tiltSystem.onPointerLeave}
                className="relative rounded-[20px] overflow-hidden f-tilt"
                style={{ background: "rgba(255,255,255,.015)", border: "1px solid rgba(233,215,196,.08)", boxShadow: "0 12px 60px rgba(0,0,0,.4)" }}
              >
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <div className="f-scanline absolute left-0 w-full h-[60px]" style={{ background: "linear-gradient(180deg, transparent, rgba(233,215,196,.03), transparent)", animation: "foundingScanline 4s linear infinite" }} />
                </div>
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-[rgba(233,215,196,.06)]">
                  <span className="w-[7px] h-[7px] rounded-full bg-[rgba(254,145,0,.5)]" />
                  <span className="w-[7px] h-[7px] rounded-full bg-[rgba(233,215,196,.15)]" />
                  <span className="w-[7px] h-[7px] rounded-full bg-[rgba(233,215,196,.15)]" />
                  <span className="ml-auto text-[9px] font-inter uppercase tracking-wider" style={{ color: "var(--f-soft)", opacity: 0.5 }}>ARAS PRO</span>
                </div>
                <div className="px-4 py-3.5 space-y-2.5">
                  {[
                    { tag: "VOICE", label: "Outbound Engine", status: "LIVE" },
                    { tag: "LLM", label: "Routing Layer", status: "READY" },
                    { tag: "CRM", label: "Pipeline Sync", status: "SYNCED" },
                    { tag: "MODE", label: "Kampagnen-Modus", status: "LIVE" },
                  ].map(({ tag, label, status }) => (
                    <div key={tag} className="flex items-center gap-3">
                      <span className="text-[9px] font-inter font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: "rgba(254,145,0,.08)", color: "var(--f-orange)", letterSpacing: ".08em" }}>{tag}</span>
                      <span className="text-[12px] font-inter flex-1" style={{ color: "var(--f-muted)" }}>{label}</span>
                      <span className="text-[9px] font-inter font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={pillStyle(status)}>{status}</span>
                    </div>
                  ))}
                </div>
              </div>

            </motion.div>
          </div>
        </section>

        {/* ═══ WAS DU BEKOMMST ═══ */}
        <RevealSection id="features" className="px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-[1180px] mx-auto">
            <h2 className="font-orbitron font-bold text-[24px] md:text-[34px] leading-[1.1] mb-10 text-center" style={{ color: "var(--f-text)" }}>
              Was du bekommst
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {[
                { icon: Crown, title: "PRO dauerhaft", text: "Dein Account bleibt auf PRO — ohne monatliche Abbuchung, ohne Erneuerung." },
                { icon: Phone, title: "500 Calls pro Monat", text: "Jeden Monat 500 ausgehende Anrufe, automatisch verfügbar. Zusätzliches Volumen jederzeit buchbar." },
                { icon: Sparkles, title: "Founding Status", text: "Frühzugang zu neuen Modulen. Du beeinflusst, was wir als Nächstes bauen." },
                { icon: Lock, title: "Planbarkeit", text: "499 CHF, einmalig. Dein Preis ändert sich nicht — auch wenn wir Enterprise-Tarife einführen." },
                { icon: Shield, title: "Sichere Abwicklung", text: "Die Zahlung läuft vollständig über Stripe — verschlüsselt und PCI-konform." },
              ].map(({ icon: Icon, title, text }, i) => (
                <motion.div key={title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ duration: 0.28, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}>
                  <GlassCard className="p-5 md:p-6 h-full">
                    <div className="w-9 h-9 rounded-xl bg-[rgba(254,145,0,0.08)] border border-[rgba(254,145,0,0.18)] flex items-center justify-center mb-3">
                      <Icon className="w-5 h-5" style={{ color: "var(--f-orange)" }} />
                    </div>
                    <h3 className="font-inter font-semibold text-[14px] mb-1.5" style={{ color: "var(--f-text)" }}>{title}</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--f-muted)" }}>{text}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══ SO LÄUFT'S AB ═══ */}
        <RevealSection className="px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-[1180px] mx-auto">
            <h2 className="font-orbitron font-bold text-[24px] md:text-[34px] leading-[1.1] mb-10 text-center" style={{ color: "var(--f-text)" }}>
              So läuft's ab
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-3xl mx-auto">
              {[
                { step: "1", title: "Kaufen", text: "Über Stripe — sicher, sofort, ohne Vorab-Registrierung nötig." },
                { step: "2", title: "Account zuordnen", text: "Nach der Zahlung verknüpfst du den Zugang mit deinem ARAS-Konto." },
                { step: "3", title: "Freischaltung", text: "Wir schalten PRO manuell frei — in der Regel innerhalb von 24 Stunden." },
              ].map(({ step, title, text }, i) => (
                <motion.div key={step} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-30px" }} transition={{ duration: 0.28, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}>
                  <GlassCard className="p-6 text-center">
                    <div className="w-9 h-9 rounded-full border-2 border-[var(--f-orange)] flex items-center justify-center mx-auto mb-3 font-orbitron font-bold text-[13px]" style={{ color: "var(--f-orange)" }}>{step}</div>
                    <h3 className="font-inter font-semibold text-[14px] mb-1.5" style={{ color: "var(--f-text)" }}>{title}</h3>
                    <p className="text-[13px] leading-relaxed" style={{ color: "var(--f-muted)" }}>{text}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══ WARUM JETZT ═══ */}
        <RevealSection className="px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-[720px] mx-auto">
            <h2 className="font-orbitron font-bold text-[24px] md:text-[34px] leading-[1.1] mb-8 text-center" style={{ color: "var(--f-text)" }}>
              Warum jetzt?
            </h2>
            <ul className="space-y-4 mb-8">
              {[
                "Der aktuelle Preis gilt nur in dieser Runde. Danach passen wir die Konditionen an die Enterprise-Struktur an.",
                "500 Calls monatlich inklusive — genug für echte Outbound-Kampagnen, nicht nur Tests.",
                "Wir begrenzen bewusst auf 500 Zugänge, um Qualität und Kapazität sicherzustellen.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-[rgba(254,145,0,0.10)] border border-[rgba(254,145,0,0.22)] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3" style={{ color: "var(--f-orange)" }} />
                  </div>
                  <span className="text-[14px] font-inter leading-relaxed" style={{ color: "var(--f-text)" }}>{item}</span>
                </li>
              ))}
            </ul>
            <div className="rounded-[14px] px-5 py-3 text-center" style={{ background: "rgba(254,145,0,.06)", border: "1px solid rgba(254,145,0,.16)" }}>
              <p className="text-[13px] font-inter font-medium" style={{ color: "var(--f-gold)" }}>Wenn weg, dann weg.</p>
            </div>
          </div>
        </RevealSection>

        {/* ═══ FAQ ═══ */}
        <RevealSection className="px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-[1180px] mx-auto">
            <h2 className="font-orbitron font-bold text-2xl md:text-3xl mb-10 text-center" style={{ color: "var(--f-text)" }}>
              Häufige Fragen
            </h2>
            <div className="max-w-2xl mx-auto">
              <Accordion type="single" collapsible className="space-y-2">
                {[
                  { q: "Was passiert nach dem Kauf?", a: "Du erhältst eine Bestätigung von Stripe. Danach kannst du den Zugang deinem ARAS-Account zuordnen. PRO wird innerhalb von 24 Stunden freigeschaltet." },
                  { q: "Wer kann den Founding-Zugang kaufen?", a: "Jeder — ob bestehendes Team oder Neukunde. Du brauchst nur einen ARAS-Account." },
                  { q: "Wie schnell bin ich startklar?", a: "Nach Freischaltung sofort. Du kannst direkt deine erste Kampagne starten oder bestehende Workflows nutzen." },
                  { q: "Was bedeutet 500 Calls pro Monat?", a: "Jeden Monat stehen dir 500 ausgehende Anrufe zur Verfügung. Zusätzliches Volumen kannst du jederzeit im Account hinzubuchen." },
                  { q: "Gilt PRO wirklich dauerhaft?", a: "Ja — solange ARAS als Plattform betrieben wird." },
                  { q: "Kann ich später upgraden?", a: "Ja. Zusätzliche Module oder höheres Volumen lassen sich jederzeit ergänzen. Dein Founding-Preis bleibt bestehen." },
                  { q: "Ist der Zugang übertragbar?", a: "Nein. Er ist fest an deinen ARAS-Account gebunden." },
                ].map(({ q, a }, i) => (
                  <AccordionItem key={i} value={`faq-${i}`} className="border-b border-[rgba(233,215,196,0.08)]">
                    <AccordionTrigger className="text-left text-sm md:text-base font-inter font-medium py-5 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--f-orange)]" style={{ color: "var(--f-text)" }}>{q}</AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm leading-relaxed pb-2" style={{ color: "var(--f-muted)" }}>{a}</p>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </div>
        </RevealSection>

        {/* ═══ FINAL CTA ═══ */}
        <RevealSection className="px-5 md:px-8 py-16 md:py-24">
          <div className="max-w-[600px] mx-auto text-center">
            <h2 className="font-orbitron font-bold text-[22px] md:text-[28px] leading-[1.1] mb-3" style={{ color: "var(--f-text)" }}>
              Bereit?
            </h2>
            {stats && (
              <p className="text-[13px] font-inter mb-6" style={{ color: "var(--f-muted)" }}>
                Noch <span className="font-semibold f-tabnum" style={{ color: "var(--f-gold)" }}>{stats.cap - stats.total}</span> von {stats.cap} verfügbar.
              </p>
            )}
            <button
              onClick={handleCTA}
              className="aras-btn--primary f-cta-shimmer h-[54px] px-8 rounded-full font-inter font-semibold text-[15px] cursor-pointer transition-all duration-300 hover:-translate-y-[2px] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--f-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--f-bg)]"
              aria-label={`${PRODUCT_NAME} sichern für 499 CHF`}
            >
              {PRODUCT_NAME} sichern (499 CHF)
              <ChevronRight className="inline-block w-4 h-4 ml-1.5 -mt-0.5" />
            </button>
            <p className="text-[12px] mt-3 font-inter" style={{ color: "var(--f-soft)" }}>Sichere Zahlung via Stripe.</p>
          </div>
        </RevealSection>

        {/* ═══ FOOTER ═══ */}
        <footer className="px-5 md:px-8 py-10 md:py-14 border-t border-[rgba(233,215,196,0.06)]">
          <div className="max-w-[1180px] mx-auto text-center">
            <p className="text-xs md:text-[13px] leading-relaxed max-w-xl mx-auto" style={{ color: "var(--f-soft)" }}>
              ARAS AI ist eine Outbound-Telefonie-Plattform. Ergebnisse hängen von Zielgruppe, Datenqualität und Kampagnenaufbau ab.
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <a href="/terms" className="text-xs hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--f-orange)]" style={{ color: "var(--f-soft)" }}>AGB</a>
              <span style={{ color: "var(--f-soft)" }}>·</span>
              <a href="/privacy" className="text-xs hover:underline transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--f-orange)]" style={{ color: "var(--f-soft)" }}>Datenschutz</a>
            </div>
          </div>
        </footer>

        {/* ═══ MOBILE STICKY ═══ */}
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-5 border-t border-[rgba(233,215,196,0.08)] sm:hidden" style={{ height: "68px", background: "rgba(0,0,0,.88)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
          {stats ? (
            <p className="text-[12px] font-inter f-tabnum whitespace-nowrap" style={{ color: "var(--f-gold)" }}>
              Noch <span className="font-orbitron font-bold">{stats.cap - stats.total}</span> verfügbar
            </p>
          ) : (
            <span />
          )}
          <button onClick={handleCTA} className="aras-btn--primary h-[44px] rounded-full px-5 font-inter font-semibold text-[13px] cursor-pointer min-w-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--f-orange)]" aria-label={`${PRODUCT_NAME} sichern`}>
            Zugang sichern
          </button>
        </div>
        <div className="h-[68px] sm:hidden" aria-hidden="true" />
      </main>
    </>
  );
}
