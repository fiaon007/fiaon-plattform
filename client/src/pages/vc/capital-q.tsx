import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Zap,
  Mail,
  ChevronRight,
  Linkedin,
  Forward,
  FileText,
  CheckCircle2,
  Phone,
  BarChart3,
  Users,
  Rocket,
  Building2,
  Star,
  Globe,
  Shield,
  Lock,
  Package,
  Plane,
  Eye,
  Target,
  Layers,
  Brain,
  BookOpen,
  Briefcase,
  TrendingUp,
  Server,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════════════════
   ARAS AI × Capital Q Ventures — Personalized for Trip McCaffrey
   ═══════════════════════════════════════════════════════════════════════════ */

const BRAND = {
  orange: "#FE9100",
  gold: "#e9d7c4",
  goldDark: "#a34e00",
  darkCard: "rgba(255,255,255,0.014)",
  border: "rgba(233,215,196,0.12)",
  borderHover: "rgba(254,145,0,0.22)",
};

const TEAM = [
  { name: "Moritz Schwarzmann", url: "https://www.linkedin.com/in/moritz-schwarzmann/" },
  { name: "Dr. Salim Kraatz", url: "https://www.linkedin.com/in/salimkraatz/" },
  { name: "Martin Daschner", url: "https://www.linkedin.com/in/martin-daschner-08819151/" },
  { name: "Christopher Kyser", url: "https://www.linkedin.com/in/christopherkyser/" },
];

/* ─── CSS KEYFRAMES ─── */
const STYLE_ID = "cq-vc-styles";
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes gradientMove {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    @keyframes auraFloat {
      0%, 100% { transform: translate(-50%, 0) scale(1); opacity: 0.18; }
      50% { transform: translate(-50%, -12px) scale(1.04); opacity: 0.24; }
    }
    @keyframes horizonPulse {
      0%, 100% { opacity: 0.14; }
      50% { opacity: 0.22; }
    }
    .cq-gradient-text {
      background: linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: gradientMove 4s cubic-bezier(0.25,0.8,0.25,1) infinite;
    }
    .cq-aura { animation: auraFloat 6s ease-in-out infinite; }
    .cq-horizon { animation: horizonPulse 8s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

/* ─── REUSABLE COMPONENTS ─── */

function AnimatedSection({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"} variants={{ hidden: { opacity: 0, y: 40 }, visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: "easeOut", delay } } }} className={className}>
      {children}
    </motion.div>
  );
}

function TiltCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-y * 6).toFixed(1)}deg) rotateY(${(x * 8).toFixed(1)}deg)`;
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(0)}%`);
    el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(0)}%`);
  }, []);
  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "40%");
  }, []);
  return (
    <div ref={ref} onPointerMove={onMove} onPointerLeave={onLeave} className={`relative rounded-2xl overflow-hidden transition-[border-color,background] duration-300 ${className}`} style={{ background: BRAND.darkCard, border: `1px solid ${BRAND.border}`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 20px 70px rgba(0,0,0,0.55)", transformStyle: "preserve-3d", transition: "transform 0.18s cubic-bezier(0.16,1,0.3,1), border-color 0.3s, background 0.3s" }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(500px 200px at var(--mx,50%) var(--my,40%), rgba(254,145,0,0.12), transparent 60%)" }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} style={{ background: BRAND.darkCard, border: `1px solid ${BRAND.border}`, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
      {children}
    </div>
  );
}

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-8">
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight cq-gradient-text leading-tight" style={{ fontFamily: "Orbitron, sans-serif" }}>{title}</h2>
      {sub && <p className="text-gray-500 mt-2 text-sm leading-relaxed max-w-3xl">{sub}</p>}
    </div>
  );
}

function CTABlock() {
  return (
    <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
      <a
        href="mailto:ai@aras-ai.com?subject=Capital%20Q%20%E2%80%94%20Internal%20Investment%20Package%20Request"
        className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all hover:translate-y-[-2px]"
        style={{ fontFamily: "Orbitron, sans-serif", background: "linear-gradient(135deg, rgba(254,145,0,0.18), rgba(255,255,255,0.02))", border: "1px solid rgba(254,145,0,0.30)", color: "#fff", boxShadow: "0 18px 64px rgba(254,145,0,0.12)" }}
      >
        <Package className="w-4 h-4" /> Request the Internal Investment Package
      </a>
      <a
        href="mailto:ai@aras-ai.com?subject=Capital%20Q%20%E2%80%94%20On-Site%20Meeting%20Request"
        className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all hover:translate-y-[-2px]"
        style={{ fontFamily: "Orbitron, sans-serif", background: "rgba(255,255,255,0.02)", border: `1px solid ${BRAND.border}`, color: BRAND.gold, backdropFilter: "blur(12px)" }}
      >
        <Plane className="w-4 h-4" /> Request an On-Site Meeting (We Fly to You)
      </a>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

export default function CapitalQPage() {
  useEffect(() => {
    injectStyles();
    document.title = "ARAS AI × Capital Q Ventures — Internal-Grade Overview for Trip McCaffrey";
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">

      {/* ─── PREMIUM BACKGROUND ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        <div className="absolute top-0 left-1/2 w-[1000px] h-[600px] cq-aura" style={{ background: "radial-gradient(ellipse at center, rgba(254,145,0,0.16) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[400px] opacity-[0.08]" style={{ background: "radial-gradient(ellipse at center, rgba(233,215,196,0.3) 0%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute left-1/2 top-[30%] w-[1200px] h-[560px] cq-horizon" style={{ transform: "translateX(-50%) perspective(900px) rotateX(68deg)", transformOrigin: "center top", background: "repeating-linear-gradient(to right, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px), repeating-linear-gradient(to bottom, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px)", maskImage: "radial-gradient(closest-side, rgba(0,0,0,0.9), transparent 74%)", WebkitMaskImage: "radial-gradient(closest-side, rgba(0,0,0,0.9), transparent 74%)" }} />
      </div>

      <div className="relative z-10">

        {/* ═══════════════════════════════════════════════════════════════
           A) HERO — ABOVE THE FOLD
           ═══════════════════════════════════════════════════════════════ */}
        <section className="min-h-[94vh] flex items-center">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 py-20 sm:py-28 w-full">
            {/* Badge */}
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
              <span className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-[10px] tracking-[0.22em] uppercase font-bold" style={{ fontFamily: "Orbitron, sans-serif", color: `${BRAND.gold}ee`, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(233,215,196,0.16)", backdropFilter: "blur(12px)" }}>
                <motion.div className="w-[7px] h-[7px] rounded-full" style={{ background: `linear-gradient(180deg, ${BRAND.orange}, ${BRAND.goldDark})`, boxShadow: "0 0 18px rgba(254,145,0,0.55)" }} animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
                ARAS AI × Capital Q Ventures
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.4rem] font-black tracking-tight mb-4 cq-gradient-text leading-[1.1]"
              style={{ fontFamily: "Orbitron, sans-serif" }}
            >
              Voice Infrastructure for Institutional Velocity.
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25 }}
              className="text-lg sm:text-xl text-gray-300 max-w-3xl mb-8 leading-relaxed"
            >
              The most human AI outbound calling system worldwide — live, monetizing, and built for the kind of structured, high-velocity deployment Capital Q runs.
            </motion.p>

            {/* Personal opening */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.35 }}>
              <TiltCard className="mb-8">
                <div className="p-6 sm:p-8">
                  <p className="text-gray-300 leading-relaxed text-[15px]">
                    Trip — as Director of Venture Capital and the gatekeeper for Seed and Series A transactions at Capital Q, you decide what enters the pipeline for Michael, Bruno, and the internal committee. You operate inside a BDC framework with tri-party governance, public reporting obligations, and a mandate that rewards structured, defensible bets — not hype. This page was written specifically for that context. Everything here is real, verifiable, and prepared for the level of diligence your team expects.
                  </p>
                </div>
              </TiltCard>
            </motion.div>

            {/* CTAs */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.55 }}>
              <CTABlock />
              <p className="text-[11px] text-gray-600 mt-3 tracking-wide" style={{ fontFamily: "Orbitron, sans-serif" }}>
                <Lock className="w-3 h-3 inline-block mr-1 -mt-0.5" style={{ color: BRAND.gold }} />
                Confidential. Sent only on request.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           B) WHY THIS IS A CAPITAL Q FIT
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="Trip, why this is a Capital Q fit — in your language" />
            </AnimatedSection>
            <div className="space-y-4">
              {[
                {
                  keyword: "BDC / NAV",
                  meaning: "Every investment must protect net asset value under public scrutiny.",
                  aras: "ARAS generates recurring SaaS revenue from day one — subscription income that contributes positively to portfolio NAV without requiring narrative-cycle dependent exits.",
                },
                {
                  keyword: "Contra-Market",
                  meaning: "Capital Q favors uncorrelated assets that perform when macro tightens.",
                  aras: "When companies cut headcount, they need more automation, not less. ARAS replaces manual outbound labor at a fraction of the cost — demand increases as budgets shrink.",
                },
                {
                  keyword: "Velocity",
                  meaning: "Your Synthetic Intelligence Growth Agent accelerates portfolio companies through shared infrastructure.",
                  aras: "ARAS is already an AI-native platform. Plugging into Velocity's orchestration layer would extend — not replace — what we've already built. We're infrastructure, not a demo.",
                },
                {
                  keyword: "Tri-Party",
                  meaning: "LP + GP + Venture Partner governance ensures operational accountability at the board level.",
                  aras: "We welcome a Venture Partner with 25+ years of operating experience. Our team is young and executes fast — an experienced operator in governance strengthens our institutional posture.",
                },
                {
                  keyword: "Structured Downside",
                  meaning: "Capital Q uses warrants, options, and tranched deployment to align risk.",
                  aras: "We're open to equity-plus-option structures and KPI-gated tranches. Our growth is measurable weekly — structured deployment actually fits how we operate.",
                },
                {
                  keyword: "Public Reporting Pressure",
                  meaning: "BDC positions must be defensible in quarterly filings and investor communications.",
                  aras: "Real users, real revenue, real retention — not forward projections. Every metric we share is current, auditable, and can withstand the scrutiny of a public vehicle.",
                },
                {
                  keyword: "Diligence Discipline",
                  meaning: "Ravi and Stephen hold the compliance and legal gates; nothing passes without substance.",
                  aras: "We maintain a structured data room with technical, financial, and compliance documentation. Swiss hosting with DSGVO, ISO, and SOC 2 posture. Ready for institutional review.",
                },
              ].map((item, i) => (
                <AnimatedSection key={item.keyword} delay={i * 0.06}>
                  <TiltCard>
                    <div className="p-5 sm:p-6">
                      <div className="flex items-start gap-3 mb-2">
                        <span className="inline-block px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0 mt-0.5" style={{ background: "rgba(254,145,0,0.12)", color: BRAND.orange, fontFamily: "Orbitron, sans-serif" }}>
                          {item.keyword}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-1.5">{item.meaning}</p>
                      <p className="text-sm text-white font-medium leading-relaxed">{item.aras}</p>
                    </div>
                  </TiltCard>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           C) WHAT ARAS ACTUALLY DOES
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="What ARAS actually does (no fluff)" />
            </AnimatedSection>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {[
                {
                  icon: Phone,
                  title: "Power Calls",
                  text: "Single outbound tasks — one call, one objective, immediate outcome. Reservation, callback, qualification, appointment. The atomic unit of the platform.",
                },
                {
                  icon: Rocket,
                  title: "Campaign Mode",
                  text: "One click triggers up to 10,000 outbound calls with consistent quality and routing logic. This is the scale layer — built for teams that need throughput, not experiments.",
                },
                {
                  icon: Layers,
                  title: "Orchestration Layer",
                  text: "Routing, outcome tagging, handoff logic, and disposition tracking. Calls don't just happen — they feed into a structured workflow that produces reportable results.",
                },
                {
                  icon: Brain,
                  title: "Knowledge & Context Layer",
                  text: "The system ingests company context, product information, objection handling, and tone preferences. Each call is informed — not scripted — based on what the organization has taught it.",
                },
                {
                  icon: Shield,
                  title: "Trust Layer",
                  text: "Swiss data hosting. DSGVO-aligned architecture. ISO and SOC 2 compliance posture. Built for organizations that cannot afford a data incident or a regulatory footnote.",
                },
              ].map((item, i) => (
                <AnimatedSection key={item.title} delay={i * 0.08}>
                  <TiltCard className="h-full">
                    <div className="p-5 sm:p-6">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3" style={{ border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", boxShadow: "0 16px 52px rgba(0,0,0,0.42)" }}>
                        <item.icon className="w-[18px] h-[18px]" style={{ color: `${BRAND.gold}ee` }} />
                      </div>
                      <h3 className="text-sm font-bold text-white mb-2" style={{ fontFamily: "Orbitron, sans-serif" }}>{item.title}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.text}</p>
                    </div>
                  </TiltCard>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           D) TRACTION
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="Traction — what is real today" />
            </AnimatedSection>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-8">
              {[
                { label: "1,000+", sub: "Active users", icon: Users },
                { label: "~32%", sub: "Paying (real subscriptions)", icon: BarChart3 },
                { label: "Strong", sub: "Daily usage retention", icon: Star },
                { label: "Growing", sub: "Serious enterprise inquiries", icon: Building2 },
              ].map((item, i) => (
                <AnimatedSection key={item.label} delay={i * 0.08}>
                  <TiltCard className="h-full">
                    <div className="p-5 sm:p-6 text-center">
                      <item.icon className="w-6 h-6 mx-auto mb-3" style={{ color: BRAND.orange }} />
                      <p className="text-xl sm:text-2xl font-black cq-gradient-text mb-1" style={{ fontFamily: "Orbitron, sans-serif" }}>{item.label}</p>
                      <p className="text-[11px] text-gray-500">{item.sub}</p>
                    </div>
                  </TiltCard>
                </AnimatedSection>
              ))}
            </div>
            <AnimatedSection delay={0.3}>
              <p className="text-sm text-gray-400 leading-relaxed max-w-3xl">
                These are current numbers, not projections. People use ARAS daily because it produces outcomes — not because they're testing something novel. The platform is past the "interesting demo" phase and operating as commercial infrastructure.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           E) CONTRA-MARKET CASE
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title={'The "Contra-Market" case: why we grow when budgets tighten'} />
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <TiltCard>
                <div className="p-6 sm:p-8">
                  <div className="space-y-4 text-[15px] text-gray-300 leading-relaxed">
                    <p>
                      Capital Q's Contra-Market thesis favors positions that perform when traditional markets compress. ARAS fits this preference structurally — not by coincidence.
                    </p>
                    <p>
                      When companies face budget pressure, the first response is headcount reduction. Sales development teams — the people who make outbound calls, qualify leads, and set appointments — are expensive, variable, and difficult to scale down gracefully. ARAS replaces that labor cost with predictable SaaS spend at a fraction of the per-seat equivalent.
                    </p>
                    <p>
                      This means demand for ARAS is counter-cyclical in practice: the tighter the environment, the more organizations look for automation that maintains throughput without the cost base. We don't need a favorable macro to grow — we need companies to care about cost per qualified conversation, which they always do, but especially when margins are under pressure.
                    </p>
                    <p>
                      Additionally, ARAS deployments are compliance-friendly by design — Swiss hosting, structured data handling, auditable call logs. This removes one of the main barriers to adoption in regulated industries, which Capital Q already understands well from its portfolio in FinTech, LegalTech, and health.
                    </p>
                    <p>
                      The revenue model is recurring, usage-based, and diversified across tiers — from solo operators at €59/month to enterprise deployments at €1,990/month. No single customer concentration risk. No dependency on a funding environment to sustain growth.
                    </p>
                    <p>
                      In short: ARAS doesn't need a bull market. It needs companies that want results from their outbound motion at lower cost and higher consistency — and that need only grows when conditions tighten.
                    </p>
                  </div>
                </div>
              </TiltCard>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           F) VELOCITY FIT
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="Velocity-Fit: how we would plug into Capital Q® Velocity" sub="Most founders treat the Velocity platform as marketing. We don't. We read how it works, and we think the integration is real — not theoretical." />
            </AnimatedSection>

            {/* 3-step integration */}
            <div className="grid sm:grid-cols-3 gap-4 sm:gap-5 mb-10">
              {[
                {
                  step: "01",
                  title: "Data Connections",
                  text: "ARAS already integrates with Salesforce, HubSpot, and Bitrix24 at the Ultimate tier, plus Make, Zapier, and n8n at Pro and above. Connecting to Velocity's data layer wouldn't require a rebuild — it would extend existing pipelines into the shared orchestration infrastructure.",
                },
                {
                  step: "02",
                  title: "Playbooks",
                  text: "Six playbooks map directly to what Velocity's SI agent already runs: (1) Investor sourcing outreach, (2) Customer lead qualification, (3) Partner/channel activation, (4) Pipeline acceleration sequences, (5) Re-engagement of dormant contacts, (6) Event and market-signal triggered campaigns. Each of these is a native ARAS workflow today.",
                },
                {
                  step: "03",
                  title: "Reporting Cadence",
                  text: "Trip receives a weekly portfolio-level performance summary: call volumes, conversion rates, pipeline value influenced. Bruno gets an operational efficiency rollup tied to cost-per-outcome metrics. Ravi and the compliance function receive audit-ready logs, data residency confirmations, and exception reports — on schedule, not on request.",
                },
              ].map((item, i) => (
                <AnimatedSection key={item.step} delay={i * 0.1}>
                  <TiltCard className="h-full">
                    <div className="p-5 sm:p-6">
                      <span className="text-[10px] font-bold tracking-[0.25em] uppercase mb-2 block" style={{ color: BRAND.orange, fontFamily: "Orbitron, sans-serif" }}>Step {item.step}</span>
                      <h3 className="text-sm font-bold text-white mb-3" style={{ fontFamily: "Orbitron, sans-serif" }}>{item.title}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.text}</p>
                    </div>
                  </TiltCard>
                </AnimatedSection>
              ))}
            </div>

            {/* Trip-respect questions */}
            <AnimatedSection delay={0.3}>
              <GlassCard className="p-6 sm:p-8 mb-6">
                <h3 className="text-sm font-bold text-white mb-4" style={{ fontFamily: "Orbitron, sans-serif" }}>Two questions — because we'd rather ask than assume:</h3>
                <div className="space-y-3">
                  <div className="flex gap-3 items-start">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />
                    <p className="text-sm text-gray-300">Does the Velocity SI agent currently handle outbound voice, or is that a gap your portfolio companies fill individually? If it's a gap, ARAS could become the native voice layer across the portfolio — not just for us, but as shared infrastructure.</p>
                  </div>
                  <div className="flex gap-3 items-start">
                    <ChevronRight className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />
                    <p className="text-sm text-gray-300">When Velocity Associates supervise the SI agent's output, is the cadence weekly or event-driven? We'd calibrate our reporting integration to match — not add noise to a system that already works.</p>
                  </div>
                </div>
              </GlassCard>
            </AnimatedSection>

            <AnimatedSection delay={0.4}>
              <p className="text-sm text-gray-400 leading-relaxed">
                We understand Velocity operates as a central brain with shared infrastructure across the portfolio — including vector databases and orchestration logic. ARAS is designed to be a composable layer within that kind of architecture, not a standalone silo.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           G) TRI-PARTY GOVERNANCE
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="Tri-Party governance — we're prepared (and we welcome it)" sub="We understand that Capital Q's governance model isn't bureaucracy — it's how you protect LPs, maintain BDC discipline, and ensure portfolio companies have adult supervision when they need it." />
            </AnimatedSection>

            <AnimatedSection delay={0.1}>
              <TiltCard className="mb-6">
                <div className="p-6 sm:p-8">
                  <p className="text-[15px] text-gray-300 leading-relaxed mb-6">
                    We explicitly welcome a Venture Partner with 25+ years of operating experience. Our founding team is young, technical, and execution-oriented. Having an experienced operator in governance doesn't slow us down — it makes us investable at the institutional level and gives your internal committee one more reason to approve.
                  </p>
                  <h3 className="text-sm font-bold text-white mb-4" style={{ fontFamily: "Orbitron, sans-serif" }}>Three responsibilities we'd expect from a Venture Partner:</h3>
                  <div className="space-y-4">
                    {[
                      {
                        icon: Building2,
                        title: "Enterprise distribution access & procurement navigation",
                        text: "Opening doors into large organizations that require a known operator's credibility at the procurement table — especially in DACH and regulated verticals.",
                      },
                      {
                        icon: Target,
                        title: "Operating cadence & KPI discipline",
                        text: "Holding us to a quarterly cadence of measurable milestones — not vanity metrics, but revenue, retention, expansion rate, and deployment velocity.",
                      },
                      {
                        icon: Shield,
                        title: "Risk/compliance readiness as a board-level function",
                        text: "Ensuring that our compliance posture, data handling, and reporting practices meet the standard a BDC vehicle requires for public filings and LP communications.",
                      },
                    ].map((item) => (
                      <div key={item.title} className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)" }}>
                          <item.icon className="w-[16px] h-[16px]" style={{ color: `${BRAND.gold}ee` }} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white mb-1">{item.title}</p>
                          <p className="text-xs text-gray-400 leading-relaxed">{item.text}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500 mt-6 italic">
                    This isn't a concession — it's a feature. A Venture Partner strengthens internal approval, accelerates enterprise access, and signals to LPs that the investment is governed at the standard they expect.
                  </p>
                </div>
              </TiltCard>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           H) DEAL STRUCTURE
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="Deal structure — we can match your machine" sub="We're open to structuring this in a way that fits Capital Q's BDC mechanics, not the other way around." />
            </AnimatedSection>

            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5 mb-6">
              {[
                {
                  title: "Equity + Warrants / Option Coverage",
                  text: "Structured downside alignment through warrant coverage or put/call option logic alongside core equity. This protects NAV while preserving upside participation — exactly how Capital Q has structured prior transactions.",
                },
                {
                  title: "Tranche-Based Deployment",
                  text: "Capital deployed in stages tied to measurable KPIs: user growth, revenue milestones, retention benchmarks, enterprise pipeline. Each tranche unlocked by verified progress, not time-based schedules.",
                },
                {
                  title: "BDC-Compatible Visibility",
                  text: "Reporting cadence and data granularity designed to meet the disclosure requirements of a public BDC vehicle. Quarterly performance summaries, fair value inputs, and portfolio-level metrics — formatted for your filings, not just our board deck.",
                },
                {
                  title: "Early-Liquidity / Risk-Hedge Logic",
                  text: "We're open to discussing structures that provide interim visibility on value realization — whether through revenue-based mechanisms, structured preferred terms, or other instruments that reduce binary risk exposure for LP-facing vehicles.",
                },
              ].map((item, i) => (
                <AnimatedSection key={item.title} delay={i * 0.08}>
                  <TiltCard className="h-full">
                    <div className="p-5 sm:p-6">
                      <h3 className="text-sm font-bold text-white mb-2" style={{ fontFamily: "Orbitron, sans-serif" }}>{item.title}</h3>
                      <p className="text-xs text-gray-400 leading-relaxed">{item.text}</p>
                    </div>
                  </TiltCard>
                </AnimatedSection>
              ))}
            </div>
            <AnimatedSection delay={0.4}>
              <p className="text-xs text-gray-600 italic">
                This section describes structural alignment preferences for discussion purposes — not a binding offer or guarantee of any financial terms, yields, or returns.
              </p>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           I) WHAT WE ANALYZED ABOUT YOU
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="What we analyzed about you — so you don't have to guess if we're serious" sub="Internal eyes only. We built this from public sources and your own published materials." />
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <TiltCard>
                <div className="p-6 sm:p-8">
                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
                    {/* Sub-section 1 */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.orange, fontFamily: "Orbitron, sans-serif" }}>Your mandate & incentives</h4>
                      <ul className="space-y-2">
                        {[
                          "BDC framework: public vehicle with NAV protection mandate and distribution expectations",
                          "Reported 22.78% total return in 2025; outperformed S&P for three consecutive years",
                          "Contra-Market thesis: uncorrelated positions in regulated/infrastructure-heavy sectors",
                          "Distribution/yield pressure from LP base — investments must contribute to reportable value",
                        ].map((b) => (
                          <li key={b} className="flex gap-2 items-start text-xs text-gray-400 leading-relaxed">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Sub-section 2 */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.orange, fontFamily: "Orbitron, sans-serif" }}>How you deploy capital</h4>
                      <ul className="space-y-2">
                        {[
                          "Initial tranches from ~$112,500 to $1.5M — sized to stage and milestone gating",
                          "Put/Call options alongside equity for structured downside alignment",
                          "Seed and Series A focus — Trip linked to 41 transactions as gatekeeper",
                          "Exit pattern awareness: EV/SPAC-era momentum and narrative cycles for liquidity events",
                        ].map((b) => (
                          <li key={b} className="flex gap-2 items-start text-xs text-gray-400 leading-relaxed">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Sub-section 3 */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.orange, fontFamily: "Orbitron, sans-serif" }}>Your operating platform (Velocity)</h4>
                      <ul className="space-y-2">
                        {[
                          "Synthetic Intelligence Growth Agent — 24/7 AI partner supervised by Velocity Associates",
                          "Central brain architecture: shared vector DB and orchestration across portfolio",
                          "Automates investor sourcing, customer leads, partner activation, acceleration playbooks",
                          "Portfolio clusters include AI infra (Plato Ai, Gaston Ai, Rito.ai), FinTech/LegalTech, Deep Tech, Health",
                        ].map((b) => (
                          <li key={b} className="flex gap-2 items-start text-xs text-gray-400 leading-relaxed">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {/* Sub-section 4 */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: BRAND.orange, fontFamily: "Orbitron, sans-serif" }}>Who must say yes internally</h4>
                      <ul className="space-y-2">
                        {[
                          "Michael \"Q\" Quatrini — CEO, final decision authority",
                          "Bruno Quatrini — COO, operational alignment and deployment oversight",
                          "Stephen Canter — internal evaluation and strategic fit",
                          "Ravi de Silva — compliance gate, regulatory and data governance sign-off",
                        ].map((b) => (
                          <li key={b} className="flex gap-2 items-start text-xs text-gray-400 leading-relaxed">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />{b}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </TiltCard>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           J) WHAT YOU WILL RECEIVE
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <SectionHeading title="If you signal interest — what you will receive within hours" />
            </AnimatedSection>
            <AnimatedSection delay={0.1}>
              <TiltCard>
                <div className="p-6 sm:p-8">
                  <h3 className="text-sm font-bold text-white mb-5" style={{ fontFamily: "Orbitron, sans-serif" }}>Internal Package Contents</h3>
                  <div className="grid sm:grid-cols-2 gap-3 mb-8">
                    {[
                      { icon: FileText, text: "Pitch deck (concise, investor-grade, already prepared)" },
                      { icon: Globe, text: "Live product demo link (access provided on request)" },
                      { icon: Server, text: "Technical architecture overview (high-level, non-proprietary)" },
                      { icon: BarChart3, text: "Traction & cohort snapshots (current, not projected)" },
                      { icon: TrendingUp, text: "Pricing & unit economics framing" },
                      { icon: Shield, text: "Compliance posture summary (DSGVO, ISO, SOC 2)" },
                      { icon: Target, text: "Go-to-market plan (DACH → EU expansion)" },
                      { icon: Rocket, text: "12–18 month execution plan with measurable milestones" },
                      { icon: Users, text: "Team & roles (with LinkedIn references)" },
                      { icon: BookOpen, text: "Data room index (structured for institutional diligence)" },
                    ].map((item) => (
                      <div key={item.text} className="flex gap-3 items-start">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.015)" }}>
                          <item.icon className="w-3.5 h-3.5" style={{ color: `${BRAND.gold}cc` }} />
                        </div>
                        <p className="text-xs text-gray-400 leading-relaxed pt-1.5">{item.text}</p>
                      </div>
                    ))}
                  </div>

                  {/* On-site option */}
                  <div className="rounded-xl p-5" style={{ background: "rgba(254,145,0,0.04)", border: "1px solid rgba(254,145,0,0.14)" }}>
                    <div className="flex items-start gap-3">
                      <Plane className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />
                      <div>
                        <p className="text-sm font-bold text-white mb-1" style={{ fontFamily: "Orbitron, sans-serif" }}>On-Site Option</p>
                        <p className="text-xs text-gray-400 leading-relaxed">
                          Justin Schwarzott will take the next available flight to the Maitland/Orlando area for an in-person meeting if there is a signal of serious interest. No scheduling overhead required — just confirm, and we'll be there.
                        </p>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-gray-600 mt-5 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" style={{ color: BRAND.gold }} />
                    All materials are confidential and sent only on explicit request. Internal eyes only.
                  </p>
                </div>
              </TiltCard>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           K) THE ASK
           ═══════════════════════════════════════════════════════════════ */}
        <section className="py-20 sm:py-24" id="ask">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <TiltCard>
                <div className="p-6 sm:p-8 md:p-12">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight mb-6 cq-gradient-text" style={{ fontFamily: "Orbitron, sans-serif" }}>The ask</h2>
                  <p className="text-gray-300 mb-8 text-[15px] leading-relaxed max-w-2xl">
                    Trip — no scheduling friction, no follow-up pressure. Three paths, your pace:
                  </p>

                  <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-6">
                    <a href="mailto:ai@aras-ai.com?subject=Capital%20Q%20%E2%80%94%20Internal%20Investment%20Package%20Request" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "linear-gradient(180deg, rgba(254,145,0,0.18), rgba(255,255,255,0.02))", border: "1px solid rgba(254,145,0,0.30)", color: "#fff", boxShadow: "0 18px 64px rgba(254,145,0,0.12)" }}>
                      <Package className="w-4 h-4" /> Request the Internal Investment Package
                    </a>
                    <a href="mailto:ai@aras-ai.com?subject=Capital%20Q%20%E2%80%94%20On-Site%20Meeting%20Request" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "rgba(255,255,255,0.02)", border: `1px solid ${BRAND.border}`, color: BRAND.gold }}>
                      <Plane className="w-4 h-4" /> Request an On-Site Meeting
                    </a>
                    <a href="mailto:ai@aras-ai.com?subject=Capital%20Q%20%E2%80%94%20Forward%20Internally" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "rgba(255,255,255,0.02)", border: `1px solid ${BRAND.border}`, color: BRAND.gold }}>
                      <Forward className="w-4 h-4" /> Forward internally
                    </a>
                  </div>

                  <p className="text-xs text-gray-500 italic mb-2">
                    If out of scope, a quick "not a fit" helps — and is genuinely appreciated.
                  </p>
                  <p className="text-[11px] text-gray-600 flex items-center gap-1.5">
                    <Lock className="w-3 h-3" style={{ color: BRAND.gold }} />
                    Confidential. Sent only on request.
                  </p>
                </div>
              </TiltCard>
            </AnimatedSection>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
           L) FOOTER
           ═══════════════════════════════════════════════════════════════ */}
        <footer className="py-10 sm:py-14 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="text-[11px] text-gray-500 leading-relaxed space-y-1">
                <p><span className="text-white font-semibold">Justin Schwarzott</span> — Founder & CEO. ARAS is named after his daughter Sara. Self-funded from a prior company sale.</p>
                <p>
                  Team:{" "}
                  {TEAM.map((m, i) => (
                    <span key={m.name}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="hover:text-[#FE9100] transition-colors underline underline-offset-2 decoration-gray-700">{m.name}</a>
                      {i < TEAM.length - 1 ? ", " : "."}
                    </span>
                  ))}
                </p>
                <p>Built in Switzerland. DACH trust posture. Compliance-first architecture designed for institutional-grade deployments.</p>
              </div>
              <div className="flex gap-4 flex-shrink-0">
                <a href="https://www.linkedin.com/in/justin-schwarzott-a3560a205" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-[#FE9100] transition-colors">
                  <Linkedin className="w-4 h-4" /> LinkedIn
                </a>
                <a href="mailto:ai@aras-ai.com" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-[#FE9100] transition-colors">
                  <Mail className="w-4 h-4" /> ai@aras-ai.com
                </a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
