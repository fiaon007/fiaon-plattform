import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  motion,
  useReducedMotion,
  useInView,
  useScroll,
  useMotionValueEvent,
} from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SEOHead } from "@/components/seo-head";
import { useLanguage } from "@/lib/auto-translate";
import { getInvestorCopy, type Lang } from "@/config/investor-copy";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Shield,
  Settings2,
  Layers,
  ArrowRight,
  Loader2,
  CheckCircle2,
  ChevronRight,
  Users,
  Target,
  Rocket,
  Building2,
  AlertTriangle,
  BarChart3,
  Phone,
  ShieldCheck,
  Cpu,
  Eye,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Injected styles — component-scoped CSS for cinematic effects
// ---------------------------------------------------------------------------
function InvestorStyles() {
  return (
    <style>{`
      .inv-glow-card {
        position: relative;
        border-radius: 20px;
        border: 1px solid rgba(233,215,196,0.12);
        background: rgba(255,255,255,0.014);
        box-shadow: 0 18px 70px rgba(0,0,0,0.52);
        overflow: hidden;
        transform: perspective(900px) rotateX(var(--rx,0deg)) rotateY(var(--ry,0deg));
        transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), border-color 0.22s ease, background 0.22s ease;
        will-change: transform;
      }
      .inv-glow-card::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(520px 220px at var(--mx,50%) var(--my,35%), rgba(254,145,0,0.14), transparent 60%);
        opacity: 0.9;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      .inv-glow-card:hover {
        border-color: rgba(254,145,0,0.22);
        background: rgba(255,255,255,0.018);
        transition: transform 0.08s linear, border-color 0.22s ease, background 0.22s ease;
      }
      .inv-glow-card:hover::before { opacity: 1; }
      .inv-glow-inner { position: relative; z-index: 1; padding: 20px; }
      @media (max-width: 768px) { .inv-glow-inner { padding: 16px; } }

      .inv-instrument {
        position: relative;
        border-radius: 20px;
        border: 1px solid rgba(233,215,196,0.10);
        background: linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008));
        box-shadow: 0 18px 60px rgba(0,0,0,0.5);
        overflow: hidden;
        text-align: center;
        padding: 28px 16px;
      }
      .inv-instrument::before {
        content: "";
        position: absolute;
        inset: 0;
        background: radial-gradient(300px 180px at 50% 20%, rgba(254,145,0,0.08), transparent 70%);
        pointer-events: none;
      }
      .inv-instrument::after {
        content: "";
        position: absolute;
        top: 0; left: 50%; transform: translateX(-50%);
        width: 60%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(254,145,0,0.4), transparent);
      }

      .inv-led {
        width: 6px; height: 6px;
        border-radius: 50%;
        background: #FE9100;
        box-shadow: 0 0 12px rgba(254,145,0,0.6);
        animation: inv-pulse 2s ease-in-out infinite;
        display: inline-block;
      }
      @keyframes inv-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.4); }
      }

      .inv-btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 28px;
        border-radius: 999px;
        font-family: 'Orbitron', sans-serif;
        font-weight: 700;
        font-size: 13px;
        letter-spacing: 0.02em;
        border: 1px solid rgba(254,145,0,0.30);
        background: linear-gradient(180deg, rgba(254,145,0,0.16), rgba(255,255,255,0.02));
        color: rgba(255,255,255,0.96);
        box-shadow: 0 18px 64px rgba(254,145,0,0.10);
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease;
        white-space: nowrap;
      }
      .inv-btn-primary::before {
        content: '';
        position: absolute;
        top: 0; left: -75%;
        width: 50%; height: 100%;
        background: rgba(255,255,255,0.12);
        transform: skewX(-25deg);
        transition: left 0.6s cubic-bezier(0.25,0.8,0.25,1);
      }
      .inv-btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 26px 92px rgba(254,145,0,0.14), 0 22px 74px rgba(0,0,0,0.60);
      }
      .inv-btn-primary:hover::before { left: 175%; }
      .inv-btn-primary:focus-visible {
        outline: 2px solid rgba(254,145,0,0.55);
        outline-offset: 3px;
      }

      .inv-btn-secondary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        padding: 14px 28px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: 0.01em;
        border: 1px solid rgba(233,215,196,0.18);
        background: rgba(255,255,255,0.02);
        color: rgba(245,245,247,0.92);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        cursor: pointer;
        white-space: nowrap;
        transition: transform 0.22s cubic-bezier(0.16,1,0.3,1), box-shadow 0.22s ease, border-color 0.22s ease, background 0.22s ease;
      }
      .inv-btn-secondary:hover {
        transform: translateY(-2px);
        border-color: rgba(254,145,0,0.26);
        box-shadow: 0 20px 72px rgba(0,0,0,0.58);
        background: rgba(255,255,255,0.028);
      }
      .inv-btn-secondary:focus-visible {
        outline: 2px solid rgba(254,145,0,0.35);
        outline-offset: 3px;
      }

      .inv-horizon {
        position: absolute;
        left: 50%; top: 18%;
        width: min(1200px, 92vw);
        height: 560px;
        transform: translateX(-50%) perspective(900px) rotateX(68deg);
        transform-origin: center top;
        opacity: 0.12;
        pointer-events: none;
        background:
          repeating-linear-gradient(to right, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px),
          repeating-linear-gradient(to bottom, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px);
        mask-image: radial-gradient(closest-side, rgba(0,0,0,0.85), transparent 74%);
        -webkit-mask-image: radial-gradient(closest-side, rgba(0,0,0,0.85), transparent 74%);
      }

      .inv-dock {
        position: fixed;
        right: 20px;
        top: 50%;
        transform: translateY(-50%);
        z-index: 50;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
      }
      .inv-dock-btn {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        background: none;
        border: none;
        padding: 5px 6px;
        border-radius: 20px;
        transition: background 0.2s ease;
      }
      .inv-dock-btn:hover { background: rgba(255,255,255,0.04); }
      .inv-dock-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: rgba(233,215,196,0.20);
        transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
        flex-shrink: 0;
      }
      .inv-dock-btn.active .inv-dock-dot {
        background: #FE9100;
        box-shadow: 0 0 14px rgba(254,145,0,0.55);
        width: 10px; height: 10px;
      }
      .inv-dock-label {
        font-size: 11px;
        font-family: 'Orbitron', sans-serif;
        letter-spacing: 0.04em;
        color: transparent;
        transition: color 0.25s ease;
        white-space: nowrap;
        user-select: none;
      }
      .inv-dock-btn:hover .inv-dock-label { color: rgba(233,215,196,0.65); }
      .inv-dock-btn.active .inv-dock-label { color: rgba(254,145,0,0.85); }

      .inv-dock-progress {
        width: 2px;
        height: 40px;
        background: rgba(233,215,196,0.08);
        border-radius: 2px;
        overflow: hidden;
        align-self: center;
        margin-bottom: 4px;
      }
      .inv-dock-progress-fill {
        width: 100%;
        background: linear-gradient(180deg, #FE9100, #a34e00);
        border-radius: 2px;
        transition: height 0.15s ease;
      }

      .inv-kicker {
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 16px;
        border-radius: 999px;
        border: 1px solid rgba(233,215,196,0.16);
        background: rgba(255,255,255,0.02);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        font-size: 11px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        color: rgba(233,215,196,0.92);
        font-family: 'Orbitron', sans-serif;
      }

      .inv-gold-text {
        font-family: 'Orbitron', sans-serif;
        font-weight: 700;
        position: relative;
        color: #e9d7c4;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
      }
      .inv-gold-text::before {
        content: attr(data-text);
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4);
        background-size: 300% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: inv-gradient-move 4s cubic-bezier(0.25,0.8,0.25,1) infinite;
      }
      @keyframes inv-gradient-move {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      .inv-section-divider {
        width: 60px;
        height: 1px;
        background: linear-gradient(90deg, rgba(254,145,0,0.5), transparent);
        margin-bottom: 20px;
      }

      .inv-timeline-node {
        width: 12px; height: 12px;
        border-radius: 50%;
        background: #FE9100;
        box-shadow: 0 0 16px rgba(254,145,0,0.5);
        position: relative;
        flex-shrink: 0;
      }
      .inv-timeline-node::after {
        content: "";
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        border: 1px solid rgba(254,145,0,0.3);
        animation: inv-pulse 2.5s ease-in-out infinite;
      }

      .inv-input {
        width: 100%;
        border-radius: 16px;
        border: 1px solid rgba(233,215,196,0.10);
        background: rgba(255,255,255,0.025);
        padding: 14px 16px;
        font-size: 14px;
        color: rgba(245,245,247,0.92);
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        outline: none;
      }
      .inv-input::placeholder { color: rgba(245,245,247,0.25); }
      .inv-input:focus {
        border-color: rgba(254,145,0,0.35);
        box-shadow: 0 0 0 3px rgba(254,145,0,0.08);
      }

      @media (max-width: 1100px) {
        .inv-dock { display: none; }
        .inv-horizon { top: 12%; opacity: 0.08; }
      }
      @media (prefers-reduced-motion: reduce) {
        .inv-glow-card { transform: none !important; transition: border-color 0.2s ease; }
        .inv-glow-card::before { display: none; }
        .inv-btn-primary::before { display: none; }
        .inv-btn-primary, .inv-btn-secondary { transition: none; }
        .inv-gold-text::before { animation: none; }
        .inv-led { animation: none; }
        .inv-timeline-node::after { animation: none; }
      }
    `}</style>
  );
}

// ---------------------------------------------------------------------------
// Motion constants
// ---------------------------------------------------------------------------
const ease = [0.32, 0.72, 0, 1] as const;

function sectionVariants(reduced: boolean | null) {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 18 },
    visible: { opacity: 1, y: 0, transition: { duration: reduced ? 0.05 : 0.65, ease } },
  };
}

function staggerContainer(reduced: boolean | null) {
  return { hidden: {}, visible: { transition: { staggerChildren: reduced ? 0 : 0.06 } } };
}

function itemVariant(reduced: boolean | null) {
  return {
    hidden: { opacity: 0, y: reduced ? 0 : 12 },
    visible: { opacity: 1, y: 0, transition: { duration: reduced ? 0.05 : 0.5, ease } },
  };
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.section ref={ref} id={id} variants={sectionVariants(reduced)} initial="hidden" animate={inView ? "visible" : "hidden"} className={cn("relative", className)}>
      {children}
    </motion.section>
  );
}

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="inv-section-divider" />
      <span style={{ fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(254,145,0,0.85)", fontFamily: "'Orbitron', sans-serif" }}>
        {children}
      </span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="inv-gold-text mb-8" data-text={typeof children === "string" ? children : ""} style={{ fontSize: "clamp(1.7rem, 2.8vw, 2.8rem)", lineHeight: 1.08, letterSpacing: "-0.01em" }}>
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// GlowCard — cursor-tracking radial gradient + tilt
// ---------------------------------------------------------------------------
function GlowCard({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width * 100).toFixed(1);
    const my = ((e.clientY - r.top) / r.height * 100).toFixed(1);
    const ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
    const rx = -((e.clientY - r.top) / r.height - 0.5) * 5;
    const el = ref.current;
    el.style.setProperty("--mx", mx + "%");
    el.style.setProperty("--my", my + "%");
    el.style.setProperty("--rx", rx.toFixed(2) + "deg");
    el.style.setProperty("--ry", ry.toFixed(2) + "deg");
  }, [reduced]);

  const onPointerLeave = useCallback(() => {
    if (!ref.current) return;
    const el = ref.current;
    el.style.setProperty("--mx", "50%");
    el.style.setProperty("--my", "40%");
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }, []);

  return (
    <div ref={ref} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className={cn("inv-glow-card", className)}>
      <div className="inv-glow-inner">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scroll Progress
// ---------------------------------------------------------------------------
function ScrollProgress() {
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const [progress, setProgress] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => { if (!reduced) setProgress(v); });
  if (reduced) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9998] h-[2px]">
      <motion.div className="h-full origin-left" style={{ scaleX: progress, background: "linear-gradient(90deg, #FE9100, #e9d7c4)" }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Investor Dock — floating right-side navigation with dots
// ---------------------------------------------------------------------------
function InvestorDock({ sections, activeId, progress }: { sections: { id: string; label: string }[]; activeId: string; progress: number }) {
  return (
    <nav className="inv-dock" aria-label="Sections">
      <div className="inv-dock-progress"><div className="inv-dock-progress-fill" style={{ height: `${(progress * 100).toFixed(0)}%` }} /></div>
      {sections.map((s) => (
        <button key={s.id} onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" })} className={cn("inv-dock-btn", activeId === s.id && "active")}>
          <span className="inv-dock-label">{s.label}</span>
          <span className="inv-dock-dot" />
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Floating mobile CTA
// ---------------------------------------------------------------------------
function FloatingCTA({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden fixed bottom-6 right-6 z-50 inv-btn-primary !p-3 !rounded-full" style={{ width: 52, height: 52 }} aria-label={label}>
      <ArrowRight className="w-5 h-5" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Language Toggle
// ---------------------------------------------------------------------------
function LangToggle() {
  const { language, setLanguage } = useLanguage();
  return (
    <div className="flex items-center gap-1 p-1 rounded-full bg-black/80 border border-white/10 backdrop-blur-xl shadow-2xl">
      {(["de", "en"] as const).map((l) => (
        <button key={l} onClick={() => setLanguage(l)} className={cn("px-5 py-2 rounded-full text-xs font-bold transition-all duration-200")} style={{
          fontFamily: "'Orbitron', sans-serif",
          background: language === l ? "linear-gradient(135deg, #e9d7c4, #FE9100)" : "transparent",
          color: language === l ? "#0f0f0f" : "rgba(255,255,255,0.45)",
          boxShadow: language === l ? "0 0 20px rgba(254,145,0,0.35)" : "none",
        }}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// useActiveSection
// ---------------------------------------------------------------------------
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0] || "");
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) setActive(id); }, { rootMargin: "-30% 0px -60% 0px" });
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [ids]);
  return active;
}

// ---------------------------------------------------------------------------
// Lead form
// ---------------------------------------------------------------------------
const leadSchema = z.object({
  name: z.string().min(2),
  firm: z.string().min(2),
  email: z.string().email(),
  ticketSize: z.string().optional(),
  thesis: z.string().max(800).optional(),
  website: z.string().optional(),
  requestType: z.enum(["data_room", "intro_call"]).optional(),
  lang: z.string().optional(),
  companyWebsite2: z.string().optional(),
});
type LeadData = z.infer<typeof leadSchema>;

function LeadForm({ formType, lang }: { formType: "data_room" | "intro_call"; lang: Lang }) {
  const copy = getInvestorCopy(lang);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<LeadData>({
    resolver: zodResolver(leadSchema),
    defaultValues: { requestType: formType, lang },
  });

  useEffect(() => { setValue("requestType", formType); setValue("lang", lang); }, [formType, lang, setValue]);

  const onSubmit = async (data: LeadData) => {
    if (data.companyWebsite2) { setStatus("success"); return; }
    setStatus("loading"); setErrorMsg("");
    try {
      const res = await fetch("/api/investors/lead", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...data, companyWebsite2: undefined }) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.message || "Error");
      setStatus("success"); reset();
    } catch (err: any) { setErrorMsg(err.message || "Request failed"); setStatus("error"); }
  };

  if (status === "success") {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
        </div>
        <p className="text-lg font-semibold text-white">{copy.form.success}</p>
        <p className="text-sm text-white/50">{copy.form.successSub}</p>
        <button onClick={() => setStatus("idle")} className="mt-2 text-xs text-[#FE9100] underline underline-offset-4 hover:text-white transition-colors">{copy.form.another}</button>
      </div>
    );
  }

  const lbl = "block text-[11px] font-semibold tracking-[0.15em] uppercase mb-1.5" as const;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="absolute opacity-0 h-0 w-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
        <input {...register("companyWebsite2")} tabIndex={-1} autoComplete="off" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={lbl} style={{ color: "rgba(233,215,196,0.7)" }}>{copy.form.fields.name}</label>
          <input {...register("name")} placeholder="Max Mustermann" className="inv-input" />
          {errors.name && <p className="text-[12px] mt-1" style={{ color: "#FE9100" }}>{copy.form.errors.name}</p>}
        </div>
        <div>
          <label className={lbl} style={{ color: "rgba(233,215,196,0.7)" }}>{copy.form.fields.firm}</label>
          <input {...register("firm")} placeholder="Firm / Family Office" className="inv-input" />
          {errors.firm && <p className="text-[12px] mt-1" style={{ color: "#FE9100" }}>{copy.form.errors.firm}</p>}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={lbl} style={{ color: "rgba(233,215,196,0.7)" }}>{copy.form.fields.email}</label>
          <input {...register("email")} type="email" placeholder="you@firm.com" className="inv-input" />
          {errors.email && <p className="text-[12px] mt-1" style={{ color: "#FE9100" }}>{copy.form.errors.email}</p>}
        </div>
        <div>
          <label className={lbl} style={{ color: "rgba(233,215,196,0.7)" }}>{copy.form.fields.ticketSize}</label>
          <select {...register("ticketSize")} className="inv-input">
            <option value="">—</option>
            {copy.form.fields.ticketOptions.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </div>
      </div>
      <div>
        <label className={lbl} style={{ color: "rgba(233,215,196,0.7)" }}>{copy.form.fields.website}</label>
        <input {...register("website")} placeholder="https://..." className="inv-input" />
      </div>
      <div>
        <label className={lbl} style={{ color: "rgba(233,215,196,0.7)" }}>{copy.form.fields.thesis}</label>
        <textarea {...register("thesis")} rows={3} placeholder={copy.form.fields.thesisPlaceholder} className="inv-input" style={{ resize: "none" }} />
      </div>
      {status === "error" && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300">{errorMsg}</div>
      )}
      <button type="submit" disabled={status === "loading"} className="inv-btn-primary w-full" style={{ padding: "16px 28px", fontSize: "14px" }}>
        {status === "loading" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
        {status === "loading" ? "…" : formType === "intro_call" ? copy.form.submit.introCall : copy.form.submit.dataRoom}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Icon maps
// ---------------------------------------------------------------------------
const moatIcons = [ShieldCheck, Eye, Settings2, Cpu];
const fundingIcons = [Layers, Rocket, Shield, BarChart3];
const layerIcons = [Cpu, Phone, Settings2, ShieldCheck];

// ===========================================================================
// MAIN PAGE
// ===========================================================================
export default function InvestorsV2Page() {
  const reduced = useReducedMotion();
  const { language } = useLanguage();
  const lang = language as Lang;
  const copy = useMemo(() => getInvestorCopy(lang), [lang]);
  const [formType, setFormType] = useState<"data_room" | "intro_call">("data_room");
  const formRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const [scrollProg, setScrollProg] = useState(0);
  useMotionValueEvent(scrollYProgress, "change", (v) => setScrollProg(v));

  const scrollToForm = useCallback((type: "data_room" | "intro_call") => {
    setFormType(type);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }, []);

  const sectionIds = useMemo(() => copy.nav.sections.map((s) => s.id), [copy.nav.sections]);
  const activeSection = useActiveSection(sectionIds);

  return (
    <div className="relative min-h-screen" style={{ background: "#0f0f0f" }}>
      <InvestorStyles />
      <SEOHead title={copy.seo.title} description={copy.seo.description} url="https://www.plattform-aras.ai/investors" />
      <ScrollProgress />
      <InvestorDock sections={copy.nav.sections} activeId={activeSection} progress={scrollProg} />
      <FloatingCTA label={copy.hero.ctaPrimary} onClick={() => scrollToForm("data_room")} />

      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="inv-horizon" />
        <div className="absolute inset-0" style={{ background: "radial-gradient(1200px 700px at 18% 8%, rgba(254,145,0,0.14), transparent 62%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(900px 560px at 86% 16%, rgba(233,215,196,0.08), transparent 64%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(820px 560px at 52% 92%, rgba(163,78,0,0.10), transparent 70%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(600px 400px at 50% 50%, rgba(254,145,0,0.03), transparent 60%)" }} />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundRepeat: "repeat", backgroundSize: "256px" }} />
      </div>

      {/* ── Content ── */}
      <div className="relative z-[1]" style={{ maxWidth: 1080, margin: "0 auto", paddingInline: "clamp(16px, 3.2vw, 38px)" }}>

        {/* ═══ HERO ═══ */}
        <section id="hero" style={{ paddingTop: "clamp(40px, 6vh, 80px)", paddingBottom: "clamp(80px, 12vh, 140px)" }}>
          <div className="flex justify-end mb-10">
            <LangToggle />
          </div>
          <motion.div initial={{ opacity: 0, y: reduced ? 0 : 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0.05 : 0.8, ease }}>
            <div className="inv-kicker mb-8">
              <span className="inv-led" />
              {copy.hero.eyebrow}
            </div>

            <h1 className="inv-gold-text whitespace-pre-line mb-8" data-text={copy.hero.headline.replace(/\n/g, " ")} style={{ fontSize: "clamp(2.4rem, 5.6vw, 4.8rem)", lineHeight: 1.02, letterSpacing: "-0.02em" }}>
              {copy.hero.headline}
            </h1>

            <p style={{ fontSize: "clamp(1rem, 1.3vw, 1.25rem)", lineHeight: 1.75, maxWidth: 720, color: "rgba(245,245,247,0.65)" }}>
              {copy.hero.subheadline}
            </p>

            <div className="flex flex-wrap gap-3 mt-10">
              {copy.hero.microfacts.map((f) => (
                <span key={f} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-medium border" style={{ borderColor: "rgba(233,215,196,0.12)", background: "rgba(255,255,255,0.02)", color: "rgba(233,215,196,0.75)" }}>
                  <span className="inv-led" style={{ width: 5, height: 5 }} />
                  {f}
                </span>
              ))}
            </div>

            <div className="flex flex-wrap gap-4 mt-12">
              <button onClick={() => scrollToForm("data_room")} className="inv-btn-primary">
                <ArrowRight className="w-4 h-4" />
                {copy.hero.ctaPrimary}
              </button>
              <button onClick={() => scrollToForm("intro_call")} className="inv-btn-secondary">
                {copy.hero.ctaSecondary}
              </button>
            </div>

            <p className="mt-8" style={{ fontSize: 12, color: "rgba(245,245,247,0.35)", maxWidth: 520 }}>
              {copy.hero.note}
            </p>
          </motion.div>
        </section>

        {/* ═══ PROBLEM ═══ */}
        <Section id="problem" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.problem.eyebrow}</Eyebrow>
          <SectionTitle>{copy.problem.title}</SectionTitle>
          <div className="max-w-3xl space-y-6 mb-14">
            {copy.problem.paragraphs.map((p, i) => (
              <p key={i} style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{p}</p>
            ))}
          </div>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {copy.problem.stats.map((s) => (
              <motion.div key={s.label} variants={itemVariant(reduced)}>
                <div className="inv-instrument">
                  <div className="relative z-[1]">
                    <span className="inv-led mb-3 block mx-auto" />
                    <p className="font-bold" style={{ fontFamily: "'Orbitron', sans-serif", fontSize: "clamp(1.4rem, 2.2vw, 2rem)", color: "#e9d7c4" }}>{s.value}</p>
                    <p className="mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: "rgba(245,245,247,0.50)" }}>{s.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ═══ PLATFORM ═══ */}
        <Section id="platform" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.whatArasIs.eyebrow}</Eyebrow>
          <SectionTitle>{copy.whatArasIs.title}</SectionTitle>
          <p className="max-w-3xl mb-12" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{copy.whatArasIs.intro}</p>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
            {copy.whatArasIs.layers.map((layer, i) => {
              const Icon = layerIcons[i] || Cpu;
              return (
                <motion.div key={layer.title} variants={itemVariant(reduced)}>
                  <GlowCard className="h-full">
                    <div className="flex items-center gap-3 mb-3">
                      <div style={{ width: 44, height: 44, borderRadius: 16, border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: "rgba(233,215,196,0.92)" }} />
                      </div>
                      <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: "14.6px", color: "rgba(245,245,247,0.94)" }}>{layer.title}</h3>
                    </div>
                    <p style={{ fontSize: "13.8px", lineHeight: 1.6, color: "rgba(245,245,247,0.60)" }}>{layer.description}</p>
                  </GlowCard>
                </motion.div>
              );
            })}
          </motion.div>
        </Section>

        {/* ═══ WHY WE WIN ═══ */}
        <Section id="moat" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.whyWeWin.eyebrow}</Eyebrow>
          <SectionTitle>{copy.whyWeWin.title}</SectionTitle>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {copy.whyWeWin.cards.map((card, i) => {
              const Icon = moatIcons[i] || Shield;
              return (
                <motion.div key={card.title} variants={itemVariant(reduced)}>
                  <GlowCard className="h-full">
                    <div className="flex items-center gap-3 mb-3">
                      <div style={{ width: 44, height: 44, borderRadius: 16, border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                        <Icon className="w-[18px] h-[18px]" style={{ color: "rgba(233,215,196,0.92)" }} />
                      </div>
                      <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: "14.6px", color: "rgba(245,245,247,0.94)" }}>{card.title}</h3>
                    </div>
                    <p style={{ fontSize: "13.8px", lineHeight: 1.65, color: "rgba(245,245,247,0.60)" }}>{card.description}</p>
                  </GlowCard>
                </motion.div>
              );
            })}
          </motion.div>
        </Section>

        {/* ═══ TRACTION ═══ */}
        <Section id="traction" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.traction.eyebrow}</Eyebrow>
          <SectionTitle>{copy.traction.title}</SectionTitle>
          <p className="max-w-3xl mb-10" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{copy.traction.intro}</p>
          <GlowCard className="max-w-2xl mb-14">
            <ul className="space-y-4">
              {copy.traction.bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-3" style={{ fontSize: 14, lineHeight: 1.65, color: "rgba(245,245,247,0.65)" }}>
                  <span className="inv-led mt-1.5" style={{ width: 6, height: 6, flexShrink: 0 }} />
                  {b}
                </li>
              ))}
            </ul>
          </GlowCard>
          <h3 className="mb-7" style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: "clamp(0.9rem, 1.2vw, 1.1rem)", color: "rgba(245,245,247,0.92)" }}>{copy.traction.timelineTitle}</h3>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="space-y-0 max-w-lg">
            {copy.traction.timeline.map((item, i) => (
              <motion.div key={item.label} variants={itemVariant(reduced)} className="flex items-start gap-5">
                <div className="flex flex-col items-center">
                  <div className="inv-timeline-node" />
                  {i < copy.traction.timeline.length - 1 && <div style={{ width: 2, height: 48, background: "linear-gradient(180deg, rgba(254,145,0,0.35), transparent)" }} />}
                </div>
                <div className="-mt-1 pb-4">
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#FE9100" }}>{item.label}</span>
                  <p className="mt-1" style={{ fontSize: 14, color: "rgba(245,245,247,0.55)" }}>{item.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ═══ GO-TO-MARKET ═══ */}
        <Section id="gtm" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.gtm.eyebrow}</Eyebrow>
          <SectionTitle>{copy.gtm.title}</SectionTitle>
          <p className="max-w-3xl mb-12" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{copy.gtm.intro}</p>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
            {copy.gtm.phases.map((phase) => (
              <motion.div key={phase.time} variants={itemVariant(reduced)}>
                <GlowCard className="h-full">
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 11, fontWeight: 700, color: "#FE9100", letterSpacing: "0.05em" }}>{phase.time}</span>
                  <h3 className="mt-2 mb-3" style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: "14.6px", color: "rgba(245,245,247,0.94)" }}>{phase.title}</h3>
                  <p style={{ fontSize: "13.8px", lineHeight: 1.65, color: "rgba(245,245,247,0.60)" }}>{phase.description}</p>
                </GlowCard>
              </motion.div>
            ))}
          </motion.div>
          <div className="inv-glow-card" style={{ display: "inline-block" }}>
            <div className="inv-glow-inner flex items-center gap-2" style={{ padding: "14px 20px" }}>
              <Target className="w-4 h-4" style={{ color: "#FE9100" }} />
              <p style={{ fontSize: 14, color: "rgba(245,245,247,0.65)" }}>{copy.gtm.beachhead}</p>
            </div>
          </div>
        </Section>

        {/* ═══ BUSINESS MODEL ═══ */}
        <Section id="model" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.businessModel.eyebrow}</Eyebrow>
          <SectionTitle>{copy.businessModel.title}</SectionTitle>
          <p className="max-w-3xl mb-12" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{copy.businessModel.intro}</p>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {copy.businessModel.models.map((m, i) => {
              const icons = [Building2, Phone, Users];
              const Icon = icons[i] || Building2;
              return (
                <motion.div key={m.title} variants={itemVariant(reduced)}>
                  <GlowCard className="h-full">
                    <div style={{ width: 44, height: 44, borderRadius: 16, border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", display: "grid", placeItems: "center", marginBottom: 14 }}>
                      <Icon className="w-[18px] h-[18px]" style={{ color: "rgba(233,215,196,0.92)" }} />
                    </div>
                    <h3 className="mb-2" style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: "14.6px", color: "rgba(245,245,247,0.94)" }}>{m.title}</h3>
                    <p style={{ fontSize: "13.8px", lineHeight: 1.65, color: "rgba(245,245,247,0.60)" }}>{m.description}</p>
                  </GlowCard>
                </motion.div>
              );
            })}
          </motion.div>
          <p style={{ fontSize: 12, color: "rgba(245,245,247,0.35)", maxWidth: 540 }}>{copy.businessModel.note}</p>
        </Section>

        {/* ═══ FUNDING ═══ */}
        <Section id="funding" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.funding.eyebrow}</Eyebrow>
          <SectionTitle>{copy.funding.title}</SectionTitle>
          <p className="max-w-3xl mb-12" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{copy.funding.intro}</p>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-14">
            {copy.funding.areas.map((area, i) => {
              const Icon = fundingIcons[i] || Layers;
              return (
                <motion.div key={area.label} variants={itemVariant(reduced)}>
                  <div className="inv-instrument">
                    <div className="relative z-[1]">
                      <Icon className="w-6 h-6 mx-auto mb-3" style={{ color: "#FE9100" }} />
                      <p style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "rgba(245,245,247,0.92)" }}>{area.label}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
          <h3 className="mb-7" style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: "clamp(0.9rem, 1.2vw, 1.1rem)", color: "rgba(245,245,247,0.92)" }}>{copy.funding.milestoneTitle}</h3>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="space-y-0 max-w-lg mb-10">
            {copy.funding.milestones.map((ms, i) => (
              <motion.div key={ms.time} variants={itemVariant(reduced)} className="flex items-start gap-5">
                <div className="flex flex-col items-center">
                  <div className="inv-timeline-node" />
                  {i < copy.funding.milestones.length - 1 && <div style={{ width: 2, height: 48, background: "linear-gradient(180deg, rgba(254,145,0,0.35), transparent)" }} />}
                </div>
                <div className="-mt-1 pb-4">
                  <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 12, fontWeight: 700, color: "#FE9100" }}>{ms.time}</span>
                  <p className="mt-1" style={{ fontSize: 14, color: "rgba(245,245,247,0.60)" }}>{ms.label}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(245,245,247,0.40)", maxWidth: 580 }}>{copy.funding.terms}</p>
        </Section>

        {/* ═══ RISKS ═══ */}
        <Section id="risks" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.risks.eyebrow}</Eyebrow>
          <SectionTitle>{copy.risks.title}</SectionTitle>
          <p className="max-w-3xl mb-12" style={{ fontSize: "clamp(15px, 1.1vw, 17px)", lineHeight: 1.8, color: "rgba(245,245,247,0.58)" }}>{copy.risks.intro}</p>
          <motion.div variants={staggerContainer(reduced)} initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-40px" }} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {copy.risks.items.map((item) => (
              <motion.div key={item.risk} variants={itemVariant(reduced)}>
                <GlowCard className="h-full">
                  <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "#FE9100" }} />
                    <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 800, fontSize: "14px", color: "rgba(245,245,247,0.94)" }}>{item.risk}</h3>
                  </div>
                  <p style={{ fontSize: "13.8px", lineHeight: 1.65, color: "rgba(245,245,247,0.60)" }}>{item.mitigation}</p>
                </GlowCard>
              </motion.div>
            ))}
          </motion.div>
        </Section>

        {/* ═══ FAQ ═══ */}
        <Section id="faq" className="pb-28 lg:pb-36">
          <Eyebrow>{copy.faq.eyebrow}</Eyebrow>
          <SectionTitle>{copy.faq.title}</SectionTitle>
          <div className="max-w-3xl">
            <Accordion type="single" collapsible className="space-y-3">
              {copy.faq.items.map((item, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="rounded-2xl overflow-hidden transition-all duration-300" style={{ border: "1px solid rgba(233,215,196,0.10)", background: "rgba(255,255,255,0.012)" }}>
                  <AccordionTrigger className="text-left text-[14.5px] font-semibold hover:no-underline transition-colors px-6 py-5" style={{ color: "rgba(245,245,247,0.88)" }}>
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-6 pb-5" style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(245,245,247,0.55)" }}>
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </Section>

        {/* ═══ CONTACT / FORM ═══ */}
        <Section id="contact" className="pb-28 lg:pb-36">
          <div ref={formRef} className="max-w-xl mx-auto">
            <div className="text-center mb-10">
              <Eyebrow>{copy.form.eyebrow}</Eyebrow>
              <SectionTitle>{copy.form.title}</SectionTitle>
              <p style={{ fontSize: 14, color: "rgba(245,245,247,0.50)", maxWidth: 420, margin: "0 auto" }}>{copy.form.subtitle}</p>
            </div>
            <div className="flex gap-2 mb-8 p-1.5 rounded-full" style={{ border: "1px solid rgba(233,215,196,0.12)", background: "rgba(255,255,255,0.015)" }}>
              {([{ value: "data_room" as const, label: copy.form.tabs.dataRoom }, { value: "intro_call" as const, label: copy.form.tabs.introCall }]).map((opt) => (
                <button key={opt.value} onClick={() => setFormType(opt.value)} className="flex-1 py-3 rounded-full text-sm font-semibold transition-all duration-200" style={{
                  background: formType === opt.value ? "linear-gradient(180deg, rgba(254,145,0,0.14), rgba(255,255,255,0.02))" : "transparent",
                  border: formType === opt.value ? "1px solid rgba(254,145,0,0.25)" : "1px solid transparent",
                  color: formType === opt.value ? "#FE9100" : "rgba(245,245,247,0.40)",
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <div className="inv-glow-card">
              <div className="inv-glow-inner" style={{ padding: "28px" }}>
                <LeadForm formType={formType} lang={lang} />
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{ borderTop: "1px solid rgba(233,215,196,0.06)", padding: "40px 0 48px" }}>
          <p style={{ fontSize: 11, lineHeight: 1.7, color: "rgba(245,245,247,0.20)", maxWidth: 700 }}>{copy.footer}</p>
        </footer>
      </div>
    </div>
  );
}
