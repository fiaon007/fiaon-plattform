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
} from "lucide-react";

// ---------------------------------------------------------------------------
// b2venture — Personalized for Andreas Goeldi
// ---------------------------------------------------------------------------

const BRAND = {
  orange: "#FE9100",
  gold: "#e9d7c4",
  goldDark: "#a34e00",
  darkCard: "rgba(255,255,255,0.014)",
  border: "rgba(233,215,196,0.12)",
  borderHover: "rgba(254,145,0,0.22)",
};

const TEAM = [
  { name: "Justin Schwarzott", role: { en: "Founder & CEO — self-funded from prior exit", de: "Gründer & CEO — selbstfinanziert aus früherem Exit" }, url: "https://www.linkedin.com/in/justin-schwarzott-a3560a205" },
  { name: "Moritz Schwarzmann", role: { en: "Commercial & strategic support", de: "Kommerziell & strategische Unterstützung" }, url: "https://www.linkedin.com/in/moritz-schwarzmann/" },
  { name: "Dr. Salim Kraatz", role: { en: "Commercial & strategic support", de: "Kommerziell & strategische Unterstützung" }, url: "https://www.linkedin.com/in/salimkraatz/" },
  { name: "Martin Daschner", role: { en: "Technical infrastructure", de: "Technische Infrastruktur" }, url: "https://www.linkedin.com/in/martin-daschner-08819151/" },
  { name: "Christopher Kyser", role: { en: "Technical infrastructure", de: "Technische Infrastruktur" }, url: "https://www.linkedin.com/in/christopherkyser/" },
];

const copy = {
  en: {
    badge: "ARAS AI × b2venture",
    heroPersonal: "Andreas — Peter Cullom suggested I reach out to you.",
    heroIntro: "I'm Justin Schwarzott, founder of ARAS AI (named after my daughter Sara). We're building a DACH-ready voice platform that companies actually use in production — because it sounds human, performs, and doesn't break trust.",
    heroVision: "Our goal is simple: Build ARAS into a Unicorn within 5 years — with real revenue, real retention, and a product that gets better weekly.",
    whyTitle: "Why this should matter to you",
    whySub: "(DACH reality)",
    whyText: "In DACH, voice automation isn't just a growth tool — it's a trust decision. Teams won't adopt \"cool AI\" if it feels risky, unstable, or embarrassing on the phone.",
    whyText2: "ARAS wins because it's built for serious usage: clear workflows, clear reporting, predictable quality, compliance mindset, and pricing that scales from solo to enterprise.",
    sellsTitle: "What ARAS really sells",
    sellsSub: "(not \"calls\")",
    sellsIntro: "Most startups sell \"AI calls\". ARAS sells outcomes:",
    sellsBullets: ["Qualified leads", "Booked meetings", "Routed conversations", "Less manual workload", "Measurable conversion lifts"],
    sellsOutro: "Voice is just the surface. The product is the operating layer behind it.",
    tractionTitle: "Traction (today)",
    traction1: "1,000+ users",
    traction2: "~32% paying",
    traction3: "High daily usage",
    traction4: "Growing interest from larger companies (real budgets, real projects)",
    wowTitle: "The spearhead",
    wowSub: "The WOW, in one line.",
    wowLine: "One click → up to 10,000 outbound calls — without losing the human feel.",
    wowText: "That's the wedge. From there we expand into broader voice-first workflows.",
    pricingTitle: "Pricing",
    pricingSub: "Showing this is already a business.",
    priceFree: "Free — Discover Mode",
    priceFreeCost: "€0",
    priceFreeItems: ["2 free outbound calls", "10 chat messages", "Basic console + stats", "No payment details required"],
    pricePro: "Pro — Growth Mode",
    priceProCost: "€59 / mo",
    priceProItems: ["100 outbound calls / month", "500 chat messages", "Make / Zapier / n8n integrations", "Performance dashboard + 24h support"],
    priceUltra: "Ultra — Performance",
    priceUltraCost: "€249 / mo",
    priceUltraItems: ["1,000 outbound calls / month", "10,000 chat messages", "Advanced ARAS voice model", "Multi-user (up to 5) + priority support"],
    priceUltimate: "Ultimate — Enterprise",
    priceUltimateCost: "€1,990 / mo",
    priceUltimateItems: ["10,000 outbound calls / month", "Unlimited chat", "Dedicated enterprise LLM + API/CRM", "Swiss data hosting + premium support"],
    priceMostPopular: "Most Popular",
    earlyTitle: "Early Access — honest, no marketing",
    earlyText: "ARAS is live and commercially used — and we still ship fast. So yes: sometimes things change quickly. But the direction is stable: more quality, more performance, more automation, more scalability.",
    teamTitle: "The team",
    teamSub: "Simple + credible.",
    askTitle: "The ask",
    askText: "Andreas — if this is relevant for b2venture's DACH / Deep Tech lens:",
    askCTA: "20 minutes for:",
    askBullet1: "A short demo",
    askBullet2: "The metrics",
    askBullet3: "A calm discussion on defensibility + scaling to a Unicorn",
    askFallback: "If you're not the right partner, who should I speak with?",
    cta1: "20-min demo",
    cta2: "Send deck (10–12 slides)",
    cta3: "Forward internally",
    contextNote: "Side note: We had several acquisition offers at Web Summit 2026 in Doha. We're not interested in selling — we want to grow. Peter's recommendation is why we're considering outside capital for the first time.",
    footerLine1: "Developed by the Schwarzott Group",
    footerLine2: "Built in Switzerland. Powered by a proprietary language model.",
    footerLine3: "Precision. Elegance. Power.",
  },
  de: {
    badge: "ARAS AI × b2venture",
    heroPersonal: "Andreas — Peter Cullom hat mir empfohlen, dich zu kontaktieren.",
    heroIntro: "Ich bin Justin Schwarzott, Gründer von ARAS AI (benannt nach meiner Tochter Sara). Wir bauen eine DACH-ready Voice-Plattform, die Unternehmen tatsächlich produktiv einsetzen — weil sie menschlich klingt, performt und Vertrauen nicht bricht.",
    heroVision: "Unser Ziel ist einfach: ARAS in 5 Jahren zum Unicorn aufbauen — mit echtem Umsatz, echter Retention und einem Produkt, das jede Woche besser wird.",
    whyTitle: "Warum dich das interessieren sollte",
    whySub: "(DACH-Realität)",
    whyText: "Im DACH-Raum ist Voice-Automatisierung nicht nur ein Growth-Tool — es ist eine Vertrauensentscheidung. Teams adoptieren keine \"coole KI\", wenn sie sich riskant, instabil oder peinlich am Telefon anfühlt.",
    whyText2: "ARAS gewinnt, weil es für ernsthaften Einsatz gebaut ist: klare Workflows, klares Reporting, vorhersehbare Qualität, Compliance-Mindset und Pricing, das von Solo bis Enterprise skaliert.",
    sellsTitle: "Was ARAS wirklich verkauft",
    sellsSub: "(keine \"Anrufe\")",
    sellsIntro: "Die meisten Startups verkaufen \"KI-Calls\". ARAS verkauft Ergebnisse:",
    sellsBullets: ["Qualifizierte Leads", "Gebuchte Meetings", "Geroutete Gespräche", "Weniger manuelle Arbeit", "Messbare Conversion-Steigerungen"],
    sellsOutro: "Voice ist nur die Oberfläche. Das Produkt ist der Operating Layer dahinter.",
    tractionTitle: "Traktion (heute)",
    traction1: "1.000+ Nutzer",
    traction2: "~32% zahlend",
    traction3: "Hohe tägliche Nutzung",
    traction4: "Wachsendes Interesse größerer Unternehmen (echte Budgets, echte Projekte)",
    wowTitle: "Die Speerspitze",
    wowSub: "Der WOW, in einer Zeile.",
    wowLine: "Ein Klick → bis zu 10.000 Outbound-Calls — ohne das menschliche Feeling zu verlieren.",
    wowText: "Das ist der Hebel. Von dort expandieren wir in breitere Voice-first Workflows.",
    pricingTitle: "Pricing",
    pricingSub: "Der Beweis: das ist bereits ein Business.",
    priceFree: "Free — Discover Mode",
    priceFreeCost: "€0",
    priceFreeItems: ["2 kostenlose Outbound Calls", "10 Chat-Nachrichten", "Basis-Konsole + Statistiken", "Keine Zahlungsdaten erforderlich"],
    pricePro: "Pro — Growth Mode",
    priceProCost: "€59 / Mo",
    priceProItems: ["100 Outbound Calls / Monat", "500 Chat-Nachrichten", "Make / Zapier / n8n Integrationen", "Performance-Dashboard + 24h Support"],
    priceUltra: "Ultra — Performance",
    priceUltraCost: "€249 / Mo",
    priceUltraItems: ["1.000 Outbound Calls / Monat", "10.000 Chat-Nachrichten", "Erweitertes ARAS Voice Model", "Multi-User (bis 5) + Priority Support"],
    priceUltimate: "Ultimate — Enterprise",
    priceUltimateCost: "€1.990 / Mo",
    priceUltimateItems: ["10.000 Outbound Calls / Monat", "Unbegrenzte Chat-Nachrichten", "Dediziertes Enterprise-LLM + API/CRM", "Swiss Data Hosting + Premium Support"],
    priceMostPopular: "Beliebtester Plan",
    earlyTitle: "Early Access — ehrlich, kein Marketing",
    earlyText: "ARAS ist live und wird kommerziell genutzt — und wir liefern schnell weiter. Ja: manchmal ändern sich Dinge schnell. Aber die Richtung ist stabil: mehr Qualität, mehr Performance, mehr Automatisierung, mehr Skalierbarkeit.",
    teamTitle: "Das Team",
    teamSub: "Einfach + glaubwürdig.",
    askTitle: "Die Bitte",
    askText: "Andreas — falls das für b2ventures DACH / Deep-Tech-Perspektive relevant ist:",
    askCTA: "20 Minuten für:",
    askBullet1: "Eine kurze Demo",
    askBullet2: "Die Metriken",
    askBullet3: "Eine ruhige Diskussion über Defensibility + Skalierung zum Unicorn",
    askFallback: "Falls du nicht der richtige Partner bist — an wen soll ich mich wenden?",
    cta1: "20-min Demo",
    cta2: "Deck senden (10–12 Slides)",
    cta3: "Intern weiterleiten",
    contextNote: "Nebenbei: Wir hatten mehrere Kaufangebote auf dem Web Summit 2026 in Doha. Wir wollen nicht verkaufen — wir wollen wachsen. Peters Empfehlung ist der Grund, warum wir erstmals externes Kapital in Betracht ziehen.",
    footerLine1: "Entwickelt von der Schwarzott Group",
    footerLine2: "Gebaut in der Schweiz. Betrieben von einem eigenen Sprachmodell.",
    footerLine3: "Präzision. Eleganz. Kraft.",
  },
};

type Lang = "en" | "de";

const STYLE_ID = "b2-vc-styles";
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
    .vc-gradient-text-b2 {
      background: linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4);
      background-size: 300% 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: gradientMove 4s cubic-bezier(0.25,0.8,0.25,1) infinite;
    }
    .vc-aura-b2 { animation: auraFloat 6s ease-in-out infinite; }
    .vc-horizon-b2 { animation: horizonPulse 8s ease-in-out infinite; }
  `;
  document.head.appendChild(style);
}

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

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="fixed top-[72px] sm:top-6 right-4 sm:right-6 z-50">
      <div className="flex items-center rounded-full p-1 gap-0.5" style={{ background: "rgba(0,0,0,0.75)", border: `1px solid ${BRAND.border}`, backdropFilter: "blur(20px)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
        {(["en", "de"] as const).map((l) => (
          <button key={l} onClick={() => setLang(l)} className="relative px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300" style={{ fontFamily: "Orbitron, sans-serif", color: lang === l ? "#fff" : "rgba(255,255,255,0.4)" }}>
            {lang === l && (
              <motion.div layoutId="lang-b2" className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(135deg, ${BRAND.orange}, ${BRAND.goldDark})`, boxShadow: "0 0 18px rgba(254,145,0,0.4)" }} transition={{ type: "spring", stiffness: 400, damping: 30 }} />
            )}
            <span className="relative z-10">{l.toUpperCase()}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function PricingCard({ title, cost, items, highlight = false, popularLabel }: { title: string; cost: string; items: string[]; highlight?: boolean; popularLabel?: string }) {
  return (
    <TiltCard className={`h-full ${highlight ? "ring-1 ring-[#FE9100]/40" : ""}`}>
      <div className="p-6 flex flex-col h-full">
        {highlight && popularLabel && (
          <span className="inline-block self-start px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider mb-3" style={{ background: "rgba(254,145,0,0.15)", color: BRAND.orange, fontFamily: "Orbitron, sans-serif", boxShadow: "0 0 12px rgba(254,145,0,0.2)" }}>
            {popularLabel}
          </span>
        )}
        <h4 className="text-sm font-bold text-white mb-1" style={{ fontFamily: "Orbitron, sans-serif" }}>{title}</h4>
        <span className="text-2xl font-black mb-4 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{cost}</span>
        <ul className="space-y-2 flex-1">
          {items.map((item) => (
            <li key={item} className="flex gap-2 items-start text-xs text-gray-400">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: BRAND.orange }} />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </TiltCard>
  );
}

export default function B2VenturePage() {
  const [lang, setLang] = useState<Lang>("en");
  const t = copy[lang];

  useEffect(() => {
    injectStyles();
    document.title = lang === "en" ? "ARAS AI × b2venture — Voice AI for DACH enterprises" : "ARAS AI × b2venture — Voice AI für DACH-Unternehmen";
  }, [lang]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      <LanguageToggle lang={lang} setLang={setLang} />

      {/* ─── PREMIUM BACKGROUND ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 opacity-[0.015]" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
        <div className="absolute top-0 left-1/2 w-[1000px] h-[600px] vc-aura-b2" style={{ background: "radial-gradient(ellipse at center, rgba(254,145,0,0.16) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[20%] right-[10%] w-[600px] h-[400px] opacity-[0.08]" style={{ background: "radial-gradient(ellipse at center, rgba(233,215,196,0.3) 0%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute left-1/2 top-[30%] w-[1200px] h-[560px] vc-horizon-b2" style={{ transform: "translateX(-50%) perspective(900px) rotateX(68deg)", transformOrigin: "center top", background: "repeating-linear-gradient(to right, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px), repeating-linear-gradient(to bottom, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px)", maskImage: "radial-gradient(closest-side, rgba(0,0,0,0.9), transparent 74%)", WebkitMaskImage: "radial-gradient(closest-side, rgba(0,0,0,0.9), transparent 74%)" }} />
      </div>

      <div className="relative z-10">
        {/* ─── HERO ─── */}
        <section className="min-h-[92vh] flex items-center">
          <div className="max-w-5xl mx-auto px-5 sm:px-6 py-20 sm:py-24 w-full">
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8">
              <span className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-[10px] tracking-[0.22em] uppercase font-bold" style={{ fontFamily: "Orbitron, sans-serif", color: `${BRAND.gold}ee`, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(233,215,196,0.16)", backdropFilter: "blur(12px)" }}>
                <motion.div className="w-[7px] h-[7px] rounded-full" style={{ background: `linear-gradient(180deg, ${BRAND.orange}, ${BRAND.goldDark})`, boxShadow: "0 0 18px rgba(254,145,0,0.55)" }} animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
                {t.badge}
              </span>
            </motion.div>

            <AnimatePresence mode="wait">
              <motion.div key={lang + "-hero"} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
                <TiltCard className="mb-8">
                  <div className="p-6 sm:p-8">
                    <p className="text-xl sm:text-2xl font-bold text-white mb-4" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.heroPersonal}</p>
                    <p className="text-gray-300 leading-relaxed mb-4 text-[15px]">{t.heroIntro}</p>
                    <p className="text-white font-semibold text-lg">{t.heroVision}</p>
                  </div>
                </TiltCard>
                <p className="text-xs text-gray-500 italic mb-8 max-w-3xl leading-relaxed">{t.contextNote}</p>
              </motion.div>
            </AnimatePresence>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8 }} className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <a href="mailto:ai@aras-ai.com?subject=b2venture%20%E2%80%94%2020-min%20demo" className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-sm uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "linear-gradient(135deg, rgba(254,145,0,0.18), rgba(255,255,255,0.02))", border: "1px solid rgba(254,145,0,0.30)", color: "#fff", boxShadow: "0 18px 64px rgba(254,145,0,0.12)" }}>
                {t.cta1} <ArrowRight className="w-4 h-4" />
              </a>
              <a href="https://www.linkedin.com/in/justin-schwarzott-a3560a205" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-full font-bold text-sm transition-all hover:translate-y-[-2px]" style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${BRAND.border}`, color: BRAND.gold, backdropFilter: "blur(12px)" }}>
                <Linkedin className="w-4 h-4" /> Justin Schwarzott
              </a>
            </motion.div>
          </div>
        </section>

        {/* ─── WHY B2VENTURE ─── */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <AnimatePresence mode="wait">
                <motion.div key={lang + "-why"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.whyTitle}</h2>
                  <p className="text-gray-500 mb-8 text-sm">{t.whySub}</p>
                  <TiltCard>
                    <div className="p-6 sm:p-8">
                      <p className="text-gray-300 leading-relaxed text-lg mb-4">{t.whyText}</p>
                      <p className="text-white leading-relaxed font-medium text-[15px]">{t.whyText2}</p>
                    </div>
                  </TiltCard>
                </motion.div>
              </AnimatePresence>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── WHAT ARAS REALLY SELLS ─── */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <AnimatePresence mode="wait">
                <motion.div key={lang + "-sells"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.sellsTitle}</h2>
                  <p className="text-gray-500 mb-8 text-sm">{t.sellsSub}</p>
                  <TiltCard>
                    <div className="p-6 sm:p-8">
                      <p className="text-gray-300 leading-relaxed mb-6">{t.sellsIntro}</p>
                      <div className="grid sm:grid-cols-2 gap-3 mb-6">
                        {t.sellsBullets.map((b) => (
                          <div key={b} className="flex gap-3 items-center">
                            <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: BRAND.orange }} />
                            <span className="text-white font-semibold text-sm">{b}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-lg text-white font-medium italic">{t.sellsOutro}</p>
                    </div>
                  </TiltCard>
                </motion.div>
              </AnimatePresence>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── TRACTION ─── */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-8 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.tractionTitle}</h2>
            </AnimatedSection>
            <AnimatePresence mode="wait">
              <motion.div key={lang + "-traction"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
                  {[
                    { text: t.traction1, icon: Users },
                    { text: t.traction2, icon: BarChart3 },
                    { text: t.traction3, icon: Star },
                    { text: t.traction4, icon: Building2 },
                  ].map((item, i) => (
                    <AnimatedSection key={item.text} delay={i * 0.1}>
                      <TiltCard>
                        <div className="p-5 sm:p-6">
                          <item.icon className="w-6 h-6 mb-3" style={{ color: BRAND.orange }} />
                          <p className="text-sm text-gray-300 leading-relaxed">{item.text}</p>
                        </div>
                      </TiltCard>
                    </AnimatedSection>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ─── THE WOW ─── */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <AnimatePresence mode="wait">
                <motion.div key={lang + "-wow"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.wowTitle}</h2>
                  <p className="text-gray-500 mb-8 text-sm">{t.wowSub}</p>
                  <motion.div whileHover={{ scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }}>
                    <TiltCard>
                      <div className="p-6 sm:p-8">
                        <div className="flex items-start gap-4 mb-4">
                          <Zap className="w-8 h-8 flex-shrink-0 mt-1" style={{ color: BRAND.orange }} />
                          <p className="text-2xl sm:text-3xl font-black vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.wowLine}</p>
                        </div>
                        <p className="text-gray-400 leading-relaxed">{t.wowText}</p>
                      </div>
                    </TiltCard>
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── PRICING ─── */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.pricingTitle}</h2>
              <p className="text-gray-500 mb-10 text-sm">{t.pricingSub}</p>
            </AnimatedSection>
            <AnimatePresence mode="wait">
              <motion.div key={lang + "-price"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                  <AnimatedSection delay={0}><PricingCard title={t.priceFree} cost={t.priceFreeCost} items={t.priceFreeItems} /></AnimatedSection>
                  <AnimatedSection delay={0.1}><PricingCard title={t.pricePro} cost={t.priceProCost} items={t.priceProItems} /></AnimatedSection>
                  <AnimatedSection delay={0.2}><PricingCard title={t.priceUltra} cost={t.priceUltraCost} items={t.priceUltraItems} highlight popularLabel={t.priceMostPopular} /></AnimatedSection>
                  <AnimatedSection delay={0.3}><PricingCard title={t.priceUltimate} cost={t.priceUltimateCost} items={t.priceUltimateItems} /></AnimatedSection>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </section>

        {/* ─── EARLY ACCESS ─── */}
        <section className="py-12 sm:py-16">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <AnimatePresence mode="wait">
                <motion.div key={lang + "-early"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <GlassCard className="p-6 sm:p-8">
                    <h3 className="text-xl font-bold text-white mb-3" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.earlyTitle}</h3>
                    <p className="text-sm text-gray-400 leading-relaxed">{t.earlyText}</p>
                  </GlassCard>
                </motion.div>
              </AnimatePresence>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── TEAM ─── */}
        <section className="py-20 sm:py-24">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.teamTitle}</h2>
              <p className="text-gray-500 mb-10 text-sm">{t.teamSub}</p>
            </AnimatedSection>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {TEAM.map((m, i) => (
                <AnimatedSection key={m.name} delay={i * 0.08}>
                  <a href={m.url} target="_blank" rel="noopener noreferrer" className="block group">
                    <TiltCard>
                      <div className="p-5">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ border: "1px solid rgba(233,215,196,0.14)", background: "rgba(255,255,255,0.02)", boxShadow: "0 16px 52px rgba(0,0,0,0.42)" }}>
                            <Linkedin className="w-4 h-4" style={{ color: `${BRAND.gold}ee` }} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white group-hover:text-[#FE9100] transition-colors">{m.name}</p>
                            <p className="text-[10px] text-gray-500">{m.role[lang]}</p>
                          </div>
                        </div>
                      </div>
                    </TiltCard>
                  </a>
                </AnimatedSection>
              ))}
            </div>
          </div>
        </section>

        {/* ─── THE ASK ─── */}
        <section className="py-20 sm:py-24" id="ask">
          <div className="max-w-5xl mx-auto px-5 sm:px-6">
            <AnimatedSection>
              <AnimatePresence mode="wait">
                <motion.div key={lang + "-ask"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                  <TiltCard>
                    <div className="p-6 sm:p-8 md:p-12">
                      <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-6 vc-gradient-text-b2" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.askTitle}</h2>
                      <p className="text-gray-300 mb-2 text-lg">{t.askText}</p>
                      <p className="text-xl sm:text-2xl font-black text-white mb-6" style={{ fontFamily: "Orbitron, sans-serif" }}>{t.askCTA}</p>

                      <ul className="space-y-3 mb-6">
                        {[t.askBullet1, t.askBullet2, t.askBullet3].map((b) => (
                          <li key={b} className="flex gap-3 items-start">
                            <ChevronRight className="w-4 h-4 mt-1 flex-shrink-0" style={{ color: BRAND.orange }} />
                            <span className="text-sm text-gray-300">{b}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-gray-500 italic mb-8">{t.askFallback}</p>

                      <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                        <a href="mailto:ai@aras-ai.com?subject=b2venture%20%E2%80%94%2020-min%20demo" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "linear-gradient(180deg, rgba(254,145,0,0.18), rgba(255,255,255,0.02))", border: "1px solid rgba(254,145,0,0.30)", color: "#fff", boxShadow: "0 18px 64px rgba(254,145,0,0.12)" }}>
                          <Mail className="w-4 h-4" /> {t.cta1}
                        </a>
                        <a href="mailto:ai@aras-ai.com?subject=b2venture%20%E2%80%94%20Deck" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "rgba(255,255,255,0.02)", border: `1px solid ${BRAND.border}`, color: BRAND.gold }}>
                          <FileText className="w-4 h-4" /> {t.cta2}
                        </a>
                        <a href="mailto:ai@aras-ai.com?subject=b2venture%20%E2%80%94%20Forward" className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-full font-bold text-xs uppercase tracking-wider transition-all hover:translate-y-[-2px]" style={{ fontFamily: "Orbitron, sans-serif", background: "rgba(255,255,255,0.02)", border: `1px solid ${BRAND.border}`, color: BRAND.gold }}>
                          <Forward className="w-4 h-4" /> {t.cta3}
                        </a>
                      </div>
                    </div>
                  </TiltCard>
                </motion.div>
              </AnimatePresence>
            </AnimatedSection>
          </div>
        </section>

        {/* ─── FOOTER ─── */}
        <footer className="py-10 sm:py-12 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="max-w-5xl mx-auto px-5 sm:px-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-[10px] text-gray-600 leading-relaxed text-center md:text-left">
              <p>{t.footerLine1}</p>
              <p>{t.footerLine2}</p>
              <p className="font-semibold" style={{ color: `${BRAND.gold}99` }}>{t.footerLine3}</p>
            </div>
            <div className="flex gap-4">
              <a href="https://www.linkedin.com/in/justin-schwarzott-a3560a205" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-[#FE9100] transition-colors">
                <Linkedin className="w-4 h-4" /> Justin Schwarzott
              </a>
              <a href="mailto:ai@aras-ai.com" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-[#FE9100] transition-colors">
                <Mail className="w-4 h-4" /> ai@aras-ai.com
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
