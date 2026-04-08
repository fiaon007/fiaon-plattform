import { useState, useRef, useEffect, useCallback } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SEOHead } from "@/components/seo-head";
import { investorMetrics } from "@/config/investorMetrics";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Shield,
  Mic,
  Settings2,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Zap,
  Globe,
  TrendingUp,
  Users,
  Target,
  Rocket,
  Building2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Motion helpers (reuse repo presets)
// ---------------------------------------------------------------------------
const ease = [0.32, 0.72, 0, 1] as const;
const STAGGER = 0.045;

function useSectionAnimation() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return { ref, inView };
}

function sectionVariants(reduced: boolean | null) {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.08 : 0.5, ease },
    },
  };
}

function staggerContainer(reduced: boolean | null) {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reduced ? 0 : STAGGER,
      },
    },
  };
}

function itemVariant(reduced: boolean | null) {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: reduced ? 0.08 : 0.4, ease },
    },
  };
}

// ---------------------------------------------------------------------------
// Section wrapper with scroll-reveal
// ---------------------------------------------------------------------------
function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  const reduced = useReducedMotion();
  const { ref, inView } = useSectionAnimation();
  return (
    <motion.section
      ref={ref}
      id={id}
      variants={sectionVariants(reduced)}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      className={cn("py-16 lg:py-24", className)}
    >
      {children}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Eyebrow label
// ---------------------------------------------------------------------------
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-block font-orbitron text-[11px] sm:text-[12px] tracking-[0.25em] uppercase text-[var(--aras-orange)]"
      style={{ letterSpacing: "0.25em" }}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Headline with animated wave gradient
// ---------------------------------------------------------------------------
function WaveHeadline({ children }: { children: React.ReactNode }) {
  return (
    <h1
      className="font-orbitron font-bold leading-[1.05] aras-headline-gradient"
      style={{
        fontSize: "clamp(40px, 5vw, 72px)",
      }}
    >
      {children}
    </h1>
  );
}

// ---------------------------------------------------------------------------
// Glass card component (inline, consistent with repo pattern)
// ---------------------------------------------------------------------------
function GlassCard({
  children,
  className,
  hover = false,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[rgba(254,145,0,0.18)] p-6",
        "backdrop-blur-[20px]",
        hover && "glass-card-hover cursor-default",
        className
      )}
      style={{
        background:
          "linear-gradient(135deg, rgba(254,145,0,0.04) 0%, rgba(10,10,10,0.8) 50%, rgba(233,215,196,0.02) 100%)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tilt card for credibility strip
// ---------------------------------------------------------------------------
function TiltCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  const reduced = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (reduced || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cardRef.current.style.transform = `perspective(600px) rotateX(${-y * 4}deg) rotateY(${x * 6}deg) translateY(-2px)`;
    },
    [reduced]
  );

  const handleMouseLeave = useCallback(() => {
    if (!cardRef.current) return;
    cardRef.current.style.transform = "perspective(600px) rotateX(0) rotateY(0) translateY(0)";
  }, []);

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="rounded-2xl border border-[rgba(254,145,0,0.14)] p-6 min-h-[112px] transition-shadow duration-300 hover:shadow-[0_0_24px_rgba(254,145,0,0.12)] hover:border-[rgba(254,145,0,0.3)]"
      style={{
        background:
          "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(10,10,10,0.7) 100%)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        transition: "transform 0.25s cubic-bezier(0.32,0.72,0,1), box-shadow 0.3s ease, border-color 0.3s ease",
        willChange: "transform",
      }}
    >
      <Icon className="w-6 h-6 text-[var(--aras-orange)] mb-3" />
      <h3 className="font-orbitron text-sm font-semibold text-white mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-[var(--aras-muted)] leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact form schema
// ---------------------------------------------------------------------------
const leadFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  firm: z.string().min(2, "Firm name is required"),
  email: z.string().email("Valid email required"),
  ticketSize: z.string().optional(),
  thesis: z.string().max(800).optional(),
  website: z.string().optional(),
  requestType: z.enum(["data_room", "intro_call"]).optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

// ---------------------------------------------------------------------------
// Lead capture form
// ---------------------------------------------------------------------------
function InvestorForm({ defaultType = "data_room" }: { defaultType?: "data_room" | "intro_call" }) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { requestType: defaultType },
  });

  useEffect(() => {
    setValue("requestType", defaultType);
  }, [defaultType, setValue]);

  const onSubmit = async (data: LeadFormData) => {
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/investors/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.message || "Something went wrong");
      }
      setStatus("success");
      reset();
    } catch (err: any) {
      setErrorMsg(err.message || "Request failed. Please try again.");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-emerald-400" />
        <p className="text-lg font-semibold text-white">Request received</p>
        <p className="text-sm text-[var(--aras-muted)]">
          We'll respond within 24–48 hours.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-2 text-xs text-[var(--aras-orange)] underline underline-offset-4 hover:text-white transition-colors"
        >
          Submit another request
        </button>
      </div>
    );
  }

  const inputCls =
    "w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[var(--aras-orange)]/50 focus:border-[var(--aras-orange)]/40 transition-all duration-200";
  const labelCls = "block text-xs font-medium text-[var(--aras-gold)] mb-1.5 tracking-wide";
  const errorCls = "text-xs text-red-400 mt-1";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Name *</label>
          <input {...register("name")} placeholder="Full name" className={inputCls} />
          {errors.name && <p className={errorCls}>{errors.name.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Firm *</label>
          <input {...register("firm")} placeholder="Investment firm" className={inputCls} />
          {errors.firm && <p className={errorCls}>{errors.firm.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Email *</label>
          <input {...register("email")} type="email" placeholder="you@firm.com" className={inputCls} />
          {errors.email && <p className={errorCls}>{errors.email.message}</p>}
        </div>
        <div>
          <label className={labelCls}>Ticket size</label>
          <select {...register("ticketSize")} className={inputCls}>
            <option value="">Select range</option>
            <option value="<250k">&lt; €250K</option>
            <option value="250k-500k">€250K – €500K</option>
            <option value="500k-1m">€500K – €1M</option>
            <option value="1m+">€1M+</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelCls}>Website</label>
        <input {...register("website")} placeholder="https://..." className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Investment thesis / notes</label>
        <textarea
          {...register("thesis")}
          rows={3}
          placeholder="What draws your interest in ARAS?"
          className={cn(inputCls, "resize-none")}
        />
        {errors.thesis && <p className={errorCls}>{errors.thesis.message}</p>}
      </div>

      {status === "error" && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        className="aras-btn--primary w-full h-12 rounded-xl font-orbitron text-sm font-semibold relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aras-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="relative z-10 flex items-center justify-center gap-2">
          {status === "loading" ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4" />
          )}
          {status === "loading" ? "Sending…" : defaultType === "intro_call" ? "Book Intro Call" : "Request Data Room"}
        </span>
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Milestone timeline item
// ---------------------------------------------------------------------------
function MilestoneItem({
  time,
  label,
  index,
}: {
  time: string;
  label: string;
  index: number;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      variants={itemVariant(reduced)}
      className="flex items-start gap-4"
    >
      <div className="flex flex-col items-center">
        <div className="w-3 h-3 rounded-full bg-[var(--aras-orange)] shadow-[0_0_8px_rgba(254,145,0,0.5)]" />
        {index < 4 && (
          <div className="w-px h-10 bg-gradient-to-b from-[var(--aras-orange)]/40 to-transparent" />
        )}
      </div>
      <div className="-mt-0.5">
        <span className="font-orbitron text-xs text-[var(--aras-orange)]">
          {time}
        </span>
        <p className="text-sm text-white/80 mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Stack layer card
// ---------------------------------------------------------------------------
function StackCard({
  title,
  description,
  index,
}: {
  title: string;
  description: string;
  index: number;
}) {
  return (
    <div
      className="rounded-xl border border-white/10 p-5 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, rgba(254,145,0,${0.03 + index * 0.02}) 0%, rgba(10,10,10,0.85) 100%)`,
      }}
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="w-7 h-7 rounded-lg bg-[var(--aras-orange)]/10 flex items-center justify-center text-[var(--aras-orange)] font-orbitron text-xs font-bold">
          {index + 1}
        </div>
        <h4 className="font-orbitron text-sm font-semibold text-white">
          {title}
        </h4>
      </div>
      <p className="text-sm text-white/60 leading-relaxed pl-10">
        {description}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FAQ data
// ---------------------------------------------------------------------------
const faqItems = [
  {
    q: "Do you build your own models?",
    a: "We own ARAS Core intelligence — the proprietary policy, memory, scoring, and routing layer purpose-built for real-time voice conversations. We run a modular model layer with multiple backends, continuously benchmark performance, and can swap components without affecting customer workflows.",
  },
  {
    q: "Why does Swiss / EU data posture matter?",
    a: "Enterprise buyers in regulated industries require clear data residency and processing guarantees. Our infrastructure is designed for EU/Swiss compliance from day one — covering GDPR alignment, data sovereignty, and auditability — giving us a structural advantage in these markets without making legal absolutes.",
  },
  {
    q: "How do you monetize 500+ alpha users?",
    a: "Our monetization ramp is deliberate: we validated product-market fit in alpha, refined the conversation intelligence engine, and are now activating paid pilots, usage-based billing, and conversion experiments. The 500+ user base gives us direct feedback loops and a built-in cohort for paid conversion.",
  },
  {
    q: "What makes ARAS different from general AI assistants?",
    a: "ARAS is purpose-built for real-time business voice conversations — not chat, not copilots. Our Core layer handles policy enforcement, conversation memory, live scoring, and intelligent routing in a single integrated stack, something general-purpose assistants cannot replicate without significant custom engineering.",
  },
  {
    q: "What is the current funding status?",
    a: "We are raising a Seed round to fund product scaling, go-to-market expansion, compliance certification, and team growth. Details are available in our data room upon request.",
  },
];

// ===========================================================================
// MAIN PAGE
// ===========================================================================
export default function InvestorsPage() {
  const reduced = useReducedMotion();
  const [formType, setFormType] = useState<"data_room" | "intro_call">("data_room");
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = (type: "data_room" | "intro_call") => {
    setFormType(type);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const visibleMetrics = investorMetrics.filter((m) => m.visible);

  return (
    <div className="relative min-h-screen">
      <SEOHead
        title="ARAS · Investor Brief"
        description="Investor relations for ARAS — the proprietary conversation intelligence platform for enterprise voice workflows. Alpha live, 500+ users, Seed round open."
        keywords="ARAS, investor relations, conversation intelligence, voice AI, seed round"
        url="https://www.plattform-aras.ai/investors"
      />

      {/* Background layers */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: -1 }}>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(254,145,0,0.12) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 40% at 50% 100%, rgba(233,215,196,0.07) 0%, transparent 60%)",
          }}
        />
      </div>

      {/* ================================================================ */}
      {/* HERO                                                            */}
      {/* ================================================================ */}
      <div className="relative max-w-[1200px] mx-auto px-6 lg:px-10 pt-12 lg:pt-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-10 lg:gap-16 items-start">
          {/* Left: text */}
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduced ? 0.08 : 0.6, ease }}
          >
            <Eyebrow>Investor Brief</Eyebrow>
            <WaveHeadline>
              Conversation Intelligence,{" "}
              <span className="block">Built for Voice</span>
            </WaveHeadline>
            <p className="mt-6 text-lg sm:text-xl max-w-[720px] text-[var(--aras-gold)]/70 leading-relaxed">
              ARAS is building the operating layer for enterprise voice
              conversations — proprietary policy engine, real-time scoring,
              modular model backends. Live in alpha with 500+ users. Seed round
              now open.
            </p>
          </motion.div>

          {/* Right: sticky quick facts */}
          <motion.div
            initial={{ opacity: 0, y: reduced ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reduced ? 0.08 : 0.7,
              delay: reduced ? 0 : 0.15,
              ease,
            }}
            className="lg:sticky lg:top-[96px]"
          >
            <GlassCard className="space-y-5">
              <h2 className="font-orbitron text-sm font-semibold text-white tracking-wide">
                Quick Facts
              </h2>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2 text-white/80">
                  <Zap className="w-4 h-4 text-[var(--aras-orange)]" />
                  Live in Alpha
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <Users className="w-4 h-4 text-[var(--aras-orange)]" />
                  500+ users (heavy engagement, pre-revenue)
                </li>
                <li className="flex items-center gap-2 text-white/80">
                  <Globe className="w-4 h-4 text-[var(--aras-orange)]" />
                  Swiss / EU-ready data posture
                </li>
              </ul>
              <div className="flex flex-col gap-3 pt-2">
                <button
                  onClick={() => scrollToForm("data_room")}
                  className="aras-btn--primary h-11 rounded-xl font-orbitron text-sm font-semibold relative overflow-hidden w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aras-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Request Data Room
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </button>
                <button
                  onClick={() => scrollToForm("intro_call")}
                  className="aras-btn--secondary h-11 rounded-xl text-sm font-medium w-full backdrop-blur-md bg-white/[0.06] border border-white/[0.12] text-white hover:bg-white/[0.1] hover:border-white/[0.2] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
                >
                  Book Intro Call
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 lg:px-10">
        {/* ================================================================ */}
        {/* CREDIBILITY STRIP                                               */}
        {/* ================================================================ */}
        <Section>
          <motion.div
            variants={staggerContainer(reduced)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            {[
              {
                icon: Shield,
                title: "Proprietary ARAS Core",
                description:
                  "Conversation policy engine, scoring, memory, and routing — built from scratch for real-time voice.",
              },
              {
                icon: Mic,
                title: "Real-time Voice Engine",
                description:
                  "Sub-second streaming pipeline optimized for natural, low-latency business conversations.",
              },
              {
                icon: Settings2,
                title: "Enterprise Control Layer",
                description:
                  "Role-based access, audit trails, usage limits, and compliance tooling for regulated industries.",
              },
              {
                icon: Layers,
                title: "Modular Model Backends",
                description:
                  "Vendor-agnostic architecture. We continuously benchmark and swap components for best performance.",
              },
            ].map((card, i) => (
              <motion.div key={card.title} variants={itemVariant(reduced)}>
                <TiltCard {...card} />
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ================================================================ */}
        {/* WHY NOW                                                         */}
        {/* ================================================================ */}
        <Section id="why-now">
          <Eyebrow>Why Now</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-8 aras-headline-gradient inline-block">
            The Timing Advantage
          </h2>
          <motion.div
            variants={staggerContainer(reduced)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="grid grid-cols-1 md:grid-cols-3 gap-5"
          >
            {[
              {
                icon: TrendingUp,
                title: "Enterprise voice AI is nascent",
                body: "Most enterprise communication still runs on legacy telephony. The shift to intelligent, AI-augmented voice workflows is just beginning — early movers capture disproportionate market share.",
              },
              {
                icon: Target,
                title: "Regulation favors prepared players",
                body: "EU AI Act and data sovereignty requirements are raising the bar for compliance. ARAS is designed with these constraints from day one, not retrofitted.",
              },
              {
                icon: Rocket,
                title: "Foundation models commoditize fast",
                body: "As base model capabilities converge, the value shifts to proprietary application layers — exactly where ARAS Core sits: policy, memory, scoring, routing.",
              },
            ].map((item) => (
              <motion.div key={item.title} variants={itemVariant(reduced)}>
                <GlassCard className="h-full">
                  <item.icon className="w-6 h-6 text-[var(--aras-orange)] mb-4" />
                  <h3 className="font-orbitron text-sm font-semibold text-white mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-white/60 leading-relaxed">
                    {item.body}
                  </p>
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ================================================================ */}
        {/* WHAT ARAS IS — 4-layer stack                                    */}
        {/* ================================================================ */}
        <Section id="platform">
          <Eyebrow>Platform Architecture</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-8 aras-headline-gradient inline-block">
            What ARAS Is
          </h2>
          <motion.div
            variants={staggerContainer(reduced)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="space-y-3 max-w-2xl"
          >
            {[
              {
                title: "ARAS Core",
                description:
                  "Proprietary policy engine, conversation memory, real-time scoring, and intelligent routing — the brain of every call.",
              },
              {
                title: "Voice Runtime",
                description:
                  "Sub-second streaming pipeline with noise handling, interruption management, and natural turn-taking.",
              },
              {
                title: "Orchestration Layer",
                description:
                  "Workflow automation, tool integrations, CRM sync, campaign management, and calendar scheduling.",
              },
              {
                title: "Data & Compliance Posture",
                description:
                  "EU/Swiss data residency design, GDPR alignment, audit logging, and role-based access controls.",
              },
            ].map((layer, i) => (
              <motion.div key={layer.title} variants={itemVariant(reduced)}>
                <StackCard {...layer} index={i} />
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ================================================================ */}
        {/* TRACTION                                                        */}
        {/* ================================================================ */}
        <Section id="traction">
          <Eyebrow>Alpha Traction</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-8 aras-headline-gradient inline-block">
            Where We Stand
          </h2>

          {/* Metrics grid — only renders visible ones */}
          {visibleMetrics.length > 0 && (
            <motion.div
              variants={staggerContainer(reduced)}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-40px" }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12"
            >
              {visibleMetrics.map((m) => (
                <motion.div key={m.label} variants={itemVariant(reduced)}>
                  <GlassCard className="text-center">
                    <p className="font-orbitron text-3xl font-bold aras-headline-gradient inline-block">
                      {m.value}
                    </p>
                    <p className="text-sm font-medium text-white/80 mt-1">
                      {m.label}
                    </p>
                    {m.note && (
                      <p className="text-xs text-white/40 mt-1">{m.note}</p>
                    )}
                  </GlassCard>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Monetization ramp */}
          <h3 className="font-orbitron text-lg font-semibold text-white mb-5">
            90-Day Monetization Ramp
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "Paid Pilots",
                body: "Structured pilot programs with qualified enterprise prospects. Validate willingness-to-pay and refine pricing.",
              },
              {
                title: "Usage Billing Activation",
                body: "Activate per-minute and per-seat billing across the alpha user base. Measure conversion and optimize onboarding.",
              },
              {
                title: "Conversion Experiments",
                body: "Systematic A/B testing of trial-to-paid funnels, packaging, and onboarding flows to maximize conversion rates.",
              },
            ].map((item) => (
              <GlassCard key={item.title} className="h-full">
                <h4 className="font-orbitron text-sm font-semibold text-[var(--aras-orange)] mb-2">
                  {item.title}
                </h4>
                <p className="text-sm text-white/60 leading-relaxed">
                  {item.body}
                </p>
              </GlassCard>
            ))}
          </div>
        </Section>

        {/* ================================================================ */}
        {/* BUSINESS MODEL                                                  */}
        {/* ================================================================ */}
        <Section id="business-model">
          <Eyebrow>Business Model</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-8 aras-headline-gradient inline-block">
            How ARAS Monetizes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
            <GlassCard>
              <Building2 className="w-6 h-6 text-[var(--aras-orange)] mb-3" />
              <h3 className="font-orbitron text-sm font-semibold text-white mb-2">
                Subscription
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Tiered SaaS plans (Starter → Professional → Enterprise) with
                increasing feature access, seats, and compliance tooling.
              </p>
            </GlassCard>
            <GlassCard>
              <Mic className="w-6 h-6 text-[var(--aras-orange)] mb-3" />
              <h3 className="font-orbitron text-sm font-semibold text-white mb-2">
                Usage (Minutes)
              </h3>
              <p className="text-sm text-white/60 leading-relaxed">
                Pay-per-minute voice billing on top of base plans. Aligns
                revenue directly with customer value and scales naturally.
              </p>
            </GlassCard>
          </div>
        </Section>

        {/* ================================================================ */}
        {/* USE OF FUNDS                                                    */}
        {/* ================================================================ */}
        <Section id="use-of-funds">
          <Eyebrow>Use of Funds</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-3 aras-headline-gradient inline-block">
            Seed Round Now Open
          </h2>
          <p className="text-sm text-white/50 mb-8 max-w-xl">
            Capital allocation details available in the data room. Below is
            our high-level allocation framework and milestone plan.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12">
            {[
              { label: "Product", icon: Layers },
              { label: "Go-to-Market", icon: Rocket },
              { label: "Compliance", icon: Shield },
              { label: "Operations", icon: Settings2 },
            ].map((item) => (
              <GlassCard key={item.label} className="text-center py-5">
                <item.icon className="w-6 h-6 text-[var(--aras-orange)] mx-auto mb-2" />
                <p className="font-orbitron text-xs font-semibold text-white">
                  {item.label}
                </p>
              </GlassCard>
            ))}
          </div>

          <h3 className="font-orbitron text-lg font-semibold text-white mb-6">
            Milestone Roadmap
          </h3>
          <motion.div
            variants={staggerContainer(reduced)}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            className="space-y-1 max-w-lg"
          >
            {[
              { time: "M3", label: "Paid pilots live, billing infrastructure complete" },
              { time: "M6", label: "First recurring revenue cohort, compliance certification initiated" },
              { time: "M9", label: "GTM engine operational, channel partnerships signed" },
              { time: "M12", label: "ARR milestone, Series A readiness" },
              { time: "M18", label: "Market expansion, enterprise tier launch" },
            ].map((ms, i) => (
              <MilestoneItem key={ms.time} {...ms} index={i} />
            ))}
          </motion.div>
        </Section>

        {/* ================================================================ */}
        {/* TEAM                                                            */}
        {/* ================================================================ */}
        <Section id="team">
          <Eyebrow>Team & Governance</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-8 aras-headline-gradient inline-block">
            Who We Are
          </h2>
          <GlassCard className="max-w-2xl">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-[var(--aras-orange)]/10 flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-[var(--aras-orange)]" />
              </div>
              <div>
                <h3 className="font-orbitron text-sm font-semibold text-white mb-2">
                  Core Team
                </h3>
                <p className="text-sm text-white/60 leading-relaxed">
                  Technical founding team with deep experience in enterprise
                  SaaS, voice/telephony systems, and AI infrastructure.
                  Full team details, backgrounds, and advisory board are
                  available in the data room.
                </p>
              </div>
            </div>
          </GlassCard>
        </Section>

        {/* ================================================================ */}
        {/* FAQ                                                             */}
        {/* ================================================================ */}
        <Section id="faq">
          <Eyebrow>Frequently Asked</Eyebrow>
          <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 mb-8 aras-headline-gradient inline-block">
            Investor FAQ
          </h2>
          <div className="max-w-3xl">
            <Accordion type="single" collapsible className="space-y-2">
              {faqItems.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-white/10 rounded-xl px-5 overflow-hidden data-[state=open]:border-[var(--aras-orange)]/30 transition-colors"
                >
                  <AccordionTrigger className="text-left text-sm font-medium text-white hover:no-underline hover:text-[var(--aras-orange)] transition-colors py-4">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-white/60 leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Section>

        {/* ================================================================ */}
        {/* LEAD CAPTURE FORM                                               */}
        {/* ================================================================ */}
        <Section id="contact">
          <div
            ref={formRef}
            className="max-w-xl mx-auto"
          >
            <div className="text-center mb-8">
              <Eyebrow>Get in Touch</Eyebrow>
              <h2 className="font-orbitron text-2xl sm:text-3xl font-bold text-white mt-3 aras-headline-gradient inline-block">
                Request Access
              </h2>
              <p className="text-sm text-white/50 mt-3 max-w-md mx-auto">
                Interested in learning more? Request our data room or book an
                intro call. We respond within 24–48 hours.
              </p>
            </div>

            {/* Type toggle */}
            <div className="flex gap-2 mb-6 p-1 rounded-xl bg-white/[0.04] border border-white/10">
              {(
                [
                  { value: "data_room", label: "Data Room" },
                  { value: "intro_call", label: "Intro Call" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setFormType(opt.value)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    formType === opt.value
                      ? "bg-[var(--aras-orange)]/15 text-[var(--aras-orange)] border border-[var(--aras-orange)]/30"
                      : "text-white/50 hover:text-white/70 border border-transparent"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <GlassCard>
              <InvestorForm defaultType={formType} />
            </GlassCard>
          </div>
        </Section>

        {/* ================================================================ */}
        {/* FOOTER DISCLAIMER                                               */}
        {/* ================================================================ */}
        <footer className="border-t border-white/[0.06] py-10 mt-8">
          <p className="text-xs text-white/30 leading-relaxed max-w-3xl">
            This page is for informational purposes only and does not constitute
            an offer to sell, a solicitation of an offer to buy, or a
            recommendation of any security or investment product. Information
            presented may contain forward-looking statements that involve risks
            and uncertainties. Confidential materials are available upon request
            and subject to NDA. ARAS AI © {new Date().getFullYear()}
          </p>
        </footer>
      </div>
    </div>
  );
}
