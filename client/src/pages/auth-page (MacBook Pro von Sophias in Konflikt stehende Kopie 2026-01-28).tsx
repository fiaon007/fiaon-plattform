import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowRight, Phone, Calendar, Sparkles, Building, Globe, User, Target, ChevronLeft, ChevronDown, Search, Mic, TrendingUp, Shield, ShieldCheck, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { trackLogin, trackSignup, captureUTMParameters } from "@/lib/analytics";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { T } from "@/lib/auto-translate";

const TYPED_LINES = [
  "Die Stimme, die verkauft.",
  "Echte Gespräche. Echte Resultate.",
  "ARAS AI führt tausende Anrufe gleichzeitig.",
  "Du liest nicht über die Zukunft.",
  "Du hörst sie."
];

// Auth Subtitle Lines for Typing Animation
const AUTH_SUBLINES = [
  "Alpha Zugang ist kostenlos.",
  "Dein Account bleibt auch nach dem Marktstart bestehen.",
  "Wenn du eine E-Mail von uns bekommen hast, bist du bereits Alpha-Kunde."
];

// Live Date and Time Component with Milliseconds
function LiveDateTime() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Update every second

    return () => clearInterval(timer);
  }, []);

  const formatDateTime = (date: Date) => {
    const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    const months = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];

    const dayName = days[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return {
      date: `${dayName}. ${day}. ${month} ${year}`,
      time: `${hours}:${minutes}:${seconds}`
    };
  };

  const { date, time } = formatDateTime(currentTime);

  return (
    <div className="flex justify-center w-full">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        {/* Subtle Glow Effect */}
        <motion.div
          className="absolute inset-0 rounded-xl blur-lg"
          style={{
            background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1), rgba(233, 215, 196, 0.1))',
          }}
          animate={{
            opacity: [0.2, 0.3, 0.2]
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        
        {/* Main Container */}
        <div
          className="relative px-6 py-3 rounded-xl backdrop-blur-sm"
          style={{
            background: 'rgba(0, 0, 0, 0.15)',
            border: '1px solid rgba(254, 145, 0, 0.15)',
          }}
        >
          <div className="flex flex-col items-center gap-1">
            {/* Date */}
            <div
              className="text-xs tracking-wide opacity-60"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                color: '#e9d7c4'
              }}
            >
              {date}
            </div>
            
            {/* Time without Milliseconds */}
            <div className="flex items-center gap-1.5">
              <span
                className="text-lg font-semibold"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4',
                  opacity: 0.8
                }}
              >
                {time}
              </span>
              <span
                className="text-xs tracking-wide opacity-50"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Uhr
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// 📞 Call Flow Timeline Component
function CallFlowTimeline() {
  const steps = [
    {
      step: 1,
      title: "Auftrag geben",
      description: "Sie definieren das Ziel – per natürlicher Sprache oder strukturierter Form:",
      quote: '"Rufe alle Leads aus Kampagne A an und qualifiziere nach Kriterium B."'
    },
    {
      step: 2,
      title: "Kontextanalyse",
      description: "ARAS verarbeitet CRM-Daten, bisherige Interaktionen & Lead-Informationen. Das System erkennt Absicht, Emotion & Gesprächssituation."
    },
    {
      step: 3,
      title: "Der Anruf läuft",
      description: "ARAS spricht mit einer ruhigen, strukturierten Stimme. Dialoge sind kontextbezogen, präzise und nachvollziehbar. Einwände werden logisch behandelt."
    },
    {
      step: 4,
      title: "Ergebnis & Zusammenfassung",
      description: "Direkt nach dem Gespräch erhalten Sie: qualifiziertes Ergebnis, Gesprächszusammenfassung, Empfehlung für den nächsten Schritt & Gesprächston."
    }
  ];

  return (
    <div className="space-y-12 relative">
      {/* Vertical Line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-[#FE9100]/50 via-[#FE9100]/20 to-transparent z-0" />

      {steps.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.2 }}
          className="relative z-10 flex gap-6"
        >
          {/* Number Bubble */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1a1a1a] border border-[#FE9100]/30 flex items-center justify-center text-[#FE9100] font-bold shadow-[0_0_15px_rgba(254,145,0,0.15)]">
            {item.step}
          </div>

          {/* Content */}
          <div className="pt-1">
            <h3 className="text-xl font-bold text-white mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              {item.title}
            </h3>
            <p className="text-white/60 leading-relaxed max-w-md">
              {item.description}
            </p>
            {item.quote && (
              <div className="mt-3 p-3 bg-[#FE9100]/5 border-l-2 border-[#FE9100] rounded-r-lg">
                <p className="text-sm text-[#FE9100] italic">
                  {item.quote}
                </p>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// 📞 Live Call Window Component
function LiveCallWindow() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0A0A0A]/80 backdrop-blur-xl shadow-2xl"
    >
      {/* Window Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
          </div>
          <div className="pl-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold text-white/60 tracking-wider">LIVE CALL — ARAS OPERATING</span>
          </div>
        </div>
        <div className="font-mono text-xs text-[#FE9100]">01:45</div>
      </div>

      {/* Chat Area */}
      <div className="p-6 space-y-6 max-h-[400px] overflow-y-auto">
        {/* ARAS */}
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FE9100] to-[#a34e00] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-[0_0_10px_rgba(254,145,0,0.4)]">
            AI
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-[#FE9100]">ARAS AI</div>
            <div className="bg-white/5 p-3 rounded-r-xl rounded-bl-xl border border-white/5 text-sm text-gray-300 leading-relaxed">
              Guten Tag, hier spricht ARAS AI im Auftrag von Ihrer Firma. Haben Sie eine Minute Zeit?
            </div>
          </div>
        </div>

        {/* Lead */}
        <div className="flex gap-4 flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
            L
          </div>
          <div className="space-y-1 text-right">
            <div className="text-[10px] font-bold text-gray-500">LEAD</div>
            <div className="bg-[#FE9100]/10 p-3 rounded-l-xl rounded-br-xl border border-[#FE9100]/20 text-sm text-white/90 leading-relaxed text-left">
              Ja, worum geht es?
            </div>
          </div>
        </div>

        {/* ARAS */}
        <div className="flex gap-4">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FE9100] to-[#a34e00] flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-[0_0_10px_rgba(254,145,0,0.4)]">
            AI
          </div>
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-[#FE9100]">ARAS AI</div>
            <div className="bg-white/5 p-3 rounded-r-xl rounded-bl-xl border border-white/5 text-sm text-gray-300 leading-relaxed">
              Es geht um eine Optimierung Ihrer Outbound-Prozesse. Wir haben gesehen, dass Sie im B2B-Bereich tätig sind.
            </div>
          </div>
        </div>

        {/* Lead */}
        <div className="flex gap-4 flex-row-reverse">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
            L
          </div>
          <div className="space-y-1 text-right">
            <div className="text-[10px] font-bold text-gray-500">LEAD</div>
            <div className="bg-[#FE9100]/10 p-3 rounded-l-xl rounded-br-xl border border-[#FE9100]/20 text-sm text-white/90 leading-relaxed text-left">
              Interessant. Erzählen Sie mehr.
            </div>
          </div>
        </div>

        {/* Typing Indicator */}
        <div className="flex gap-4 items-end">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FE9100] to-[#a34e00] flex items-center justify-center text-white text-xs font-bold shrink-0 opacity-50">
            AI
          </div>
          <div className="bg-white/5 px-4 py-3 rounded-r-xl rounded-bl-xl border border-white/5">
            <div className="flex gap-1">
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                className="w-1.5 h-1.5 rounded-full bg-[#FE9100]"
              />
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                className="w-1.5 h-1.5 rounded-full bg-[#FE9100]"
              />
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                className="w-1.5 h-1.5 rounded-full bg-[#FE9100]"
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// 🏷️ Pricing Section
function PricingSection() {
  const plans = [
    {
      name: "FREE",
      role: "ARAS Free",
      price: "Kostenlos",
      priceValue: 0,
      features: ["2 Outbound Calls", "10 Chatnachrichten", "Zugriff auf ARAS Basic Console"],
      isPopular: false,
      isFree: true
    },
    {
      name: "STARTER",
      role: "ARAS Pro",
      price: "CHF 59",
      priceValue: 59,
      features: ["100 Outbound Calls pro Monat", "500 Chatnachrichten", "ARAS Konsole (Basic)", "Automatische Zusammenfassungen", "E-Mail Support"],
      isPopular: false,
      isFree: false
    },
    {
      name: "PRO",
      role: "ARAS Ultra",
      price: "CHF 249",
      priceValue: 249,
      features: ["1.000 Outbound Calls pro Monat", "10.000 Chatnachrichten", "ARAS Voice Model (erweitert)", "Mehrbenutzerzugang", "Erweiterte Analysen", "Priorisierter Support"],
      isPopular: true,
      isFree: false
    },
    {
      name: "ENTERPRISE",
      role: "ARAS Ultimate",
      price: "CHF 1.990",
      priceValue: 1990,
      features: ["10.000 Outbound Calls pro Monat", "Unbegrenzte Chatnachrichten", "Dediziertes ARAS Enterprise-LLM", "API & CRM Integrationen", "Swiss Hosting", "24/7 Support", "Early Access zu neuen Modulen"],
      isPopular: false,
      isFree: false
    }
  ];

  return (
    <section className="relative py-20 px-4 md:px-8">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4 sm:mb-6 bg-clip-text text-transparent bg-gradient-to-r from-[#e9d7c4] via-[#FE9100] to-[#a34e00]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
            ARAS Pricing
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-white/70 max-w-2xl mx-auto">
            Wähle den Plan, der zu deinem Unternehmen passt.
          </p>
        </motion.div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-2xl p-4 sm:p-6 flex flex-col h-full ${
                plan.isPopular 
                  ? 'bg-gradient-to-b from-[#FE9100]/15 to-[#0a0a0a] border-[#FE9100] shadow-[0_0_40px_rgba(254,145,0,0.2)]' 
                  : 'bg-[#0a0a0a] border-white/10 hover:border-white/20'
              } border transition-all duration-300`}
            >
              {plan.isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#FE9100] to-[#ffaa33] text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-lg">
                  ⭐ Beliebt
                </div>
              )}

              {/* Header */}
              <div className="mb-4 sm:mb-6">
                <div className="text-[10px] sm:text-xs font-bold text-[#FE9100]/70 uppercase tracking-widest mb-1">{plan.name}</div>
                <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-white mb-3 sm:mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>{plan.role}</h3>
                
                {/* Price Display */}
                <div className="bg-white/5 p-3 sm:p-4 rounded-xl border border-white/5">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-2xl sm:text-3xl font-black ${plan.isFree ? 'text-green-400' : 'text-white'}`}>
                      {plan.isFree ? 'Kostenlos' : plan.price}
                    </span>
                    {!plan.isFree && (
                      <span className="text-xs sm:text-sm text-gray-500">/ Monat</span>
                    )}
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-400 mt-2">
                    {plan.isFree 
                      ? 'Perfekt zum Testen' 
                      : plan.priceValue < 100 
                        ? 'Ideal für Einsteiger'
                        : plan.priceValue < 1000
                          ? 'Für wachsende Teams'
                          : 'Enterprise-Lösung'
                    }
                  </p>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 flex-grow">
                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2">Enthalten</div>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-gray-300">
                    <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FE9100] shrink-0 mt-0.5" />
                    <span className="text-[11px] sm:text-xs">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <button 
                className={`w-full py-2.5 sm:py-3 rounded-xl font-bold text-xs sm:text-sm transition-all duration-300 ${
                  plan.isPopular 
                    ? 'bg-gradient-to-r from-[#FE9100] to-[#ffaa33] text-black hover:shadow-[0_0_25px_rgba(254,145,0,0.4)] transform hover:scale-[1.02]' 
                    : plan.isFree
                      ? 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
                      : 'bg-white text-black hover:bg-gray-100'
                }`}
              >
                {plan.isFree ? 'Kostenlos starten' : 'Plan wählen'}
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// 🏢 Premium Footer Component
function PremiumFooter() {
  const [showSupportPanel, setShowSupportPanel] = useState(false);
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);
  const [typedText, setTypedText] = useState('');
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  const words = ['100% DSGVO-konform', 'Eigenes LLM', '500+ parallele Anrufe', 'Schweizer Qualität'];

  useEffect(() => {
    const currentWord = words[currentWordIndex];
    const timeout = setTimeout(() => {
      if (!isDeleting) {
        if (typedText.length < currentWord.length) {
          setTypedText(currentWord.substring(0, typedText.length + 1));
        } else {
          setTimeout(() => setIsDeleting(true), 2000);
        }
      } else {
        if (typedText.length > 0) {
          setTypedText(currentWord.substring(0, typedText.length - 1));
        } else {
          setIsDeleting(false);
          setCurrentWordIndex((prev) => (prev + 1) % words.length);
        }
      }
    }, isDeleting ? 50 : 100);

    return () => clearTimeout(timeout);
  }, [typedText, isDeleting, currentWordIndex]);

  const footerLinks = {
    produkt: [
      { name: 'KI-Outbound-Telefonie', href: '#ki-outbound-telefonie' },
      { name: 'Voice AI für Vertrieb', href: '#voice-ai-vertrieb' },
      { name: 'B2B Telefonakquise', href: '#b2b-telefonakquise' },
      { name: 'CRM-Integration', href: '#crm-integration' },
      { name: 'Preise & Pakete', href: '#preise-pakete' }
    ],
    ressourcen: [
      { name: 'Blog: KI im Vertrieb', href: 'https://platform.aras.ai/blog' },
      { name: 'Use Cases & Branchen', href: 'https://platform.aras.ai/use-cases' },
      { name: 'API-Dokumentation', href: 'https://api.aras-ai.com' },
      { name: 'Whitepaper: ARAS Core LLM', href: 'https://www.aras-ai.com/whitepaper' },
      { name: 'ROI-Rechner', href: 'https://platform.aras.ai/roi-calculator' }
    ],
    support: [
      { name: 'Demo vereinbaren', href: 'https://platform.aras.ai/demo' },
      { name: 'support@aras-plattform.ai', href: 'mailto:support@aras-plattform.ai' },
      { name: 'Live-Chat', action: 'openSupport' },
      { name: 'Knowledge Base', href: 'https://help.aras-ai.com' },
      { name: 'ARAS AI Community', href: 'https://discord.gg/aras-ai' }
    ],
    rechtliches: [
      { name: 'Impressum', href: 'https://www.aras-ai.com/legal-notice' },
      { name: 'Datenschutzerklärung', href: 'https://www.aras-ai.com/privacy-policy' },
      { name: 'AGB', href: 'https://www.aras-ai.com/terms-and-conditions' },
      { name: 'Nutzungsbedingungen', href: 'https://www.aras-ai.com/terms-of-use' },
      { name: 'Cookie-Richtlinie', href: 'https://www.aras-ai.com/cookie-policy' },
      { name: 'Haftungsausschluss', href: 'https://www.aras-ai.com/disclaimer' },
      { name: 'Risikohinweis', href: 'https://www.aras-ai.com/risk-disclosure' },
      { name: 'KYC/AML Compliance', href: 'https://www.aras-ai.com/kycaml-compliance-notice' },
      { name: 'Token-Bedingungen', href: 'https://www.aras-ai.com/token-terms-conditions' }
    ]
  };

  const badges = [
    {
      id: 'swiss-made',
      text: 'SWISS ENGINEERED',
      tooltip: 'Entwickelt und betrieben in Zürich. Schweizer Qualität und Präzision für Ihre KI-Telefonie.'
    },
    {
      id: 'dsgvo-certified',
      text: '100% DSGVO-KONFORM',
      tooltip: 'Vollständige EU-DSGVO und Schweizer nDSG Compliance. Ihre Daten verlassen niemals die europäischen Server.'
    },
    {
      id: 'own-llm',
      text: 'EIGENES LLM (ARAS CORE)',
      tooltip: 'Keine Abhängigkeit von externen AI-Anbietern. Unser proprietäres Sprachmodell wurde speziell für Business-Telefonie entwickelt.'
    },
    {
      id: 'enterprise-ready',
      text: 'ENTERPRISE READY',
      tooltip: 'ISO-27001 zertifizierte Infrastruktur, SOC2 Typ II konform, mit 99.9% SLA Uptime-Garantie.'
    }
  ];

  return (
    <>
      <footer className="relative" style={{ background: 'transparent' }}>
        {/* Animated Top Border */}
        <motion.div
          className="h-[2px] w-full"
          style={{
            background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4)',
            backgroundSize: '300% 100%'
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
          }}
          transition={{
            duration: 18,
            repeat: Infinity,
            ease: 'linear'
          }}
        />

        <div className="max-w-[1400px] mx-auto px-12 pt-[120px] pb-[80px]">
          {/* EBENE 1: Brand Signature */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="mb-24"
          >
            <h2
              className="text-4xl font-black mb-3"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                color: '#e9d7c4'
              }}
            >
              ARAS AI – Die erste KI-Outbound-Telefonie-Plattform für skalierbaren B2B-Vertrieb
            </h2>
            <p className="text-white/50 mb-6">
              Powered by Schwarzott Capital Partners AG – Löwenstrasse 20, 8001 Zürich
            </p>
            
            {/* Typewriter Effect */}
            <div
              className="text-lg font-semibold"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #ffd700)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              {typedText}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                style={{ color: '#FE9100' }}
              >
                .
              </motion.span>
            </div>
          </motion.div>

          {/* EBENE 2: Navigation Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-24">
            {/* Produkt */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.05 }}
            >
              <h3
                className="text-lg font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Produkt
              </h3>
              <ul className="space-y-3">
                {footerLinks.produkt.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.href}
                      className="text-white/70 hover:text-[#FE9100] transition-colors duration-300 text-[15px]"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Ressourcen */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <h3
                className="text-lg font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Ressourcen
              </h3>
              <ul className="space-y-3">
                {footerLinks.ressourcen.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/70 hover:text-[#FE9100] transition-colors duration-300 text-[15px]"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Support */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.15 }}
            >
              <h3
                className="text-lg font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Support
              </h3>
              <ul className="space-y-3">
                {footerLinks.support.map((link, i) => (
                  <li key={i}>
                    {link.action === 'openSupport' ? (
                      <button
                        onClick={() => setShowSupportPanel(true)}
                        className="text-white/70 hover:text-[#FE9100] transition-colors duration-300 text-[15px] text-left"
                      >
                        {link.name}
                      </button>
                    ) : (
                      <a
                        href={link.href}
                        target={link.href?.startsWith('http') ? '_blank' : undefined}
                        rel={link.href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="text-white/70 hover:text-[#FE9100] transition-colors duration-300 text-[15px]"
                      >
                        {link.name}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Rechtliches */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <h3
                className="text-lg font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Rechtliches
              </h3>
              <ul className="space-y-3">
                {footerLinks.rechtliches.map((link, i) => (
                  <li key={i}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white/70 hover:text-[#FE9100] transition-colors duration-300 text-[15px]"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>

          {/* EBENE 3: Trust Badges */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-6 mb-16"
          >
            {badges.map((badge, index) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.7, delay: index * 0.1 }}
                whileHover={{ scale: 1.05 }}
                onMouseEnter={() => setHoveredBadge(badge.id)}
                onMouseLeave={() => setHoveredBadge(null)}
                className="relative px-6 py-3 rounded-lg border cursor-help"
                style={{
                  borderColor: hoveredBadge === badge.id ? '#FE9100' : 'rgba(254, 145, 0, 0.3)',
                  background: 'rgba(254, 145, 0, 0.05)',
                  transition: 'all 0.3s'
                }}
              >
                <div
                  className="text-xs font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    color: '#e9d7c4'
                  }}
                >
                  {badge.text}
                </div>

                {/* Tooltip */}
                <AnimatePresence>
                  {hoveredBadge === badge.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.25 }}
                      className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-4 rounded-xl border z-50"
                      style={{
                        background: 'rgba(15, 15, 15, 0.95)',
                        backdropFilter: 'blur(12px)',
                        borderColor: '#FE9100'
                      }}
                    >
                      <p className="text-sm text-white/80 leading-relaxed">
                        {badge.tooltip}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>

          {/* EBENE 4: Copyright */}
          <div className="border-t border-white/10 pt-8">
            <p className="text-center text-sm text-white/40">
              © 2025 ARAS AI – KI-gestützte Vertriebsautomatisierung by Schwarzott Capital Partners AG, Zürich.
              <br />
              Eigenes LLM • 500+ parallele Anrufe • DSGVO-konform • Swiss Made
            </p>
          </div>
        </div>
      </footer>

      {/* Support Panel */}
      <AnimatePresence>
        {showSupportPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSupportPanel(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-lg w-full rounded-2xl border-t-4 p-8"
              style={{
                background: 'rgba(15, 15, 15, 0.65)',
                backdropFilter: 'blur(12px)',
                borderColor: '#FE9100'
              }}
            >
              <h3
                className="text-2xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Support Center
              </h3>
              
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-[#FE9100] focus:outline-none transition-colors"
                    placeholder="Ihr Name"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">E-Mail</label>
                  <input
                    type="email"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-[#FE9100] focus:outline-none transition-colors"
                    placeholder="ihre.email@beispiel.de"
                  />
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Anliegen</label>
                  <textarea
                    rows={4}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:border-[#FE9100] focus:outline-none transition-colors resize-none"
                    placeholder="Beschreiben Sie Ihr Anliegen..."
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex-1 py-3 rounded-xl font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background: 'linear-gradient(135deg, #FE9100, #ffd700)',
                    color: '#000'
                  }}
                >
                  Ticket senden
                </motion.button>
                <button
                  onClick={() => setShowSupportPanel(false)}
                  className="px-6 py-3 rounded-xl text-white/60 hover:text-white/80 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// 📋 FAQ Accordion Component  
function FAQAccordion() {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null);

  const faqs = [
    {
      id: 1,
      question: "Klingt ARAS wirklich wie ein Mensch?",
      answer: `ARAS arbeitet mit einer eigenen Voice-Engine, die klar, ruhig und professionell klingt.

Wir versprechen keine „perfekte Menschlichkeit", sondern realistische, verständliche und strukturierte Gespräche – ohne Roboterklang oder monotone Intonation.`
    },
    {
      id: 2,
      question: "Wie zuverlässig funktioniert ARAS bei echten Anrufen?",
      answer: `Die Plattform ist für den täglichen Betrieb in Unternehmen gebaut.

Typische Kennzahlen (Alpha-Durchschnitt):
• STT-Verständnis: >95%
• Drop-Rate: <3%
• Gesprächsverzögerung minimal (durchschnittlich 180–240ms)

ARAS prüft jede Antwort auf Logik, Kontext und Stabilität.`
    },
    {
      id: 3,
      question: "Kann ARAS mit schwierigen Gesprächspartnern umgehen?",
      answer: `Ja, ARAS erkennt:
• Unsicherheit
• Unterbrechungen
• Einwände
• Gesprächsabbrüche
• Füllwörter

ARAS reagiert mit definierter Struktur, nicht mit unkontrollierten Aussagen.`
    },
    {
      id: 4,
      question: "Ist ARAS für Kaltakquise rechtlich erlaubt?",
      answer: `ARAS hält sich vollständig an europäische Vorgaben.

Unternehmen dürfen Kaltakquise nur durchführen, wenn eine rechtliche Grundlage besteht (B2B-Interesse oder Opt-in).

ARAS setzt das technisch um:
• optionaler Hinweis „dies ist ein automatisierter Anruf"
• definierbare Gesprächsöffner
• Ereignisprotokollierung`
    },
    {
      id: 5,
      question: "Wo werden meine Daten gespeichert?",
      answer: `Ausschließlich in zertifizierten EU-Rechenzentren.

Keine US-Server, keine amerikanischen Clouds, kein externer Zugriff.

ARAS unterliegt dem Schweizer Datenschutz (nDSG) und der DSGVO.`
    },
    {
      id: 6,
      question: "Zeichnet ARAS Gespräche auf?",
      answer: `Nur wenn Sie das explizit aktivieren und die rechtliche Grundlage besteht.

Standardmäßig speichert ARAS keine Audiodaten, sondern nur:
• Zusammenfassung
• Gesprächsergebnis
• technische Metadaten`
    },
    {
      id: 7,
      question: "Wie sicher ist die Plattform technisch?",
      answer: `ARAS arbeitet mit:
• TLS 1.3
• AES-256 Datenverschlüsselung
• automatischer Schlüsselrotation
• Multi-Layer-Encryption bei sensiblen Daten
• Audit Trails`
    },
    {
      id: 8,
      question: "Wie viele Anrufe kann ARAS gleichzeitig führen?",
      answer: `Technisch möglich: bis zu 500 parallele Leitungen je Projekt.

In der Alpha sind die Werte kontrolliert limitiert, um Qualität sicherzustellen.`
    },
    {
      id: 9,
      question: "Welche Zahlungsmethoden werden akzeptiert?",
      answer: `Wir akzeptieren alle gängigen Zahlungsmethoden:

• Kreditkarte (Visa, Mastercard, Amex)
• SEPA-Lastschrift
• Banküberweisung (Enterprise)`
    },
    {
      id: 10,
      question: "Brauche ich ein CRM oder spezielle Software?",
      answer: `Nein. ARAS funktioniert eigenständig.

Optional können angebunden werden:
• Salesforce
• HubSpot
• Make
• Zapier
• n8n`
    },
    {
      id: 11,
      question: "Kann ich ARAS für Inbound-Anrufe nutzen?",
      answer: `Inbound befindet sich in Entwicklung.

Alpha-Tester erhalten als Erste Zugang.`
    },
    {
      id: 12,
      question: "Wie läuft das Onboarding ab?",
      answer: `1. Registrierung
2. Projektanlage
3. Zieldefinition
4. Testanruf
5. Automatisierung oder Integration

Alpha-Nutzer erhalten bevorzugten Support und individuelle Erklärung der ersten Einrichtung.`
    }
  ];

  const toggleFAQ = (id: number) => {
    setOpenFAQ(openFAQ === id ? null : id);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {faqs.map((faq, index) => (
        <motion.div
          key={faq.id}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            duration: 0.5,
            delay: index * 0.1,
            ease: [0.25, 0.8, 0.25, 1]
          }}
          className="relative group cursor-pointer"
          onClick={() => toggleFAQ(faq.id)}
        >
          {/* Animated Border */}
          <motion.div
            className="absolute inset-0 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #e9d7c4)',
              backgroundSize: '200% 200%',
              padding: '1px'
            }}
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
              opacity: openFAQ === faq.id ? 1.1 : 1
            }}
            transition={{
              backgroundPosition: {
                duration: 16,
                repeat: Infinity,
                ease: 'linear'
              },
              opacity: {
                duration: 0.35
              }
            }}
          >
            <div className="w-full h-full rounded-2xl" style={{ background: '#151515' }} />
          </motion.div>

          {/* Card Content */}
          <div
            className="relative rounded-2xl p-8"
            style={{
              background: '#151515',
              boxShadow: openFAQ === faq.id 
                ? '0 0 20px rgba(254, 145, 0, 0.2)' 
                : '0 8px 24px rgba(0, 0, 0, 0.08)'
            }}
          >
            {/* Question */}
            <div className="flex items-start justify-between gap-4">
              <h3
                className="text-lg font-black flex-1"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4',
                  letterSpacing: '0.5px'
                }}
              >
                {faq.question}
              </h3>
              <motion.div
                animate={{ rotate: openFAQ === faq.id ? 180 : 0 }}
                transition={{ duration: 0.35, ease: [0.25, 0.8, 0.25, 1] }}
              >
                <ChevronDown
                  className="w-6 h-6 flex-shrink-0 transition-colors duration-300"
                  style={{
                    color: openFAQ === faq.id ? '#FE9100' : '#e9d7c4'
                  }}
                />
              </motion.div>
            </div>

            {/* Answer */}
            <AnimatePresence>
              {openFAQ === faq.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.25, 0.8, 0.25, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 text-[16px] text-white/70 leading-[1.55] whitespace-pre-line">
                    {faq.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// 💎 Pricing Cards Component
function PricingCards() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const plans = [
    {
      id: 'starter',
      name: 'STARTER',
      subtitle: 'ARAS Pro',
      price: 59,
      currency: 'CHF',
      description: 'Ideal für Einsteiger',
      features: [
        '100 Outbound Calls pro Monat',
        '500 Chatnachrichten',
        'ARAS Konsole (Basic)',
        'Automatische Zusammenfassungen',
        'E-Mail Support'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'PRO',
      subtitle: 'ARAS Ultra',
      price: 249,
      currency: 'CHF',
      description: 'Für wachsende Teams',
      features: [
        '1.000 Outbound Calls pro Monat',
        '10.000 Chatnachrichten',
        'ARAS Voice Model (erweitert)',
        'Mehrbenutzerzugang',
        'Erweiterte Analysen',
        'Priorisierter Support'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'ENTERPRISE',
      subtitle: 'ARAS Ultimate',
      price: 1990,
      currency: 'CHF',
      description: 'Enterprise-Lösung',
      features: [
        '10.000 Outbound Calls pro Monat',
        'Unbegrenzte Chatnachrichten',
        'Dediziertes ARAS Enterprise-LLM',
        'API & CRM Integrationen',
        'Swiss Hosting',
        '24/7 Support',
        'Early Access zu neuen Modulen'
      ],
      popular: false
    }
  ];

  return (
    <>
      {/* Main Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ 
              duration: 0.6, 
              delay: index * 0.12,
              ease: [0.25, 0.8, 0.25, 1]
            }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedPlan(plan.id)}
            className="cursor-pointer relative group"
          >
            {/* Popular Badge */}
            {plan.popular && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10"
              >
                <div
                  className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background: 'linear-gradient(135deg, #FE9100, #ffd700)',
                    color: '#000'
                  }}
                >
                  ⭐ Beliebteste Wahl
                </div>
              </motion.div>
            )}

            {/* Animated Border */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4)',
                backgroundSize: '300% 100%',
                padding: '1.5px'
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{
                duration: 14,
                repeat: Infinity,
                ease: 'linear'
              }}
            >
              <div className="w-full h-full rounded-2xl" style={{ background: '#151515' }} />
            </motion.div>

            {/* Card Content */}
            <div className="relative rounded-2xl" style={{ 
              background: '#151515',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
              padding: '48px 36px'
            }}>
              {/* Plan Name */}
              <h3
                className="text-2xl font-black mb-1"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                {plan.name}
              </h3>
              <p className="text-sm text-[#FE9100]/70 mb-8">
                {plan.subtitle}
              </p>

              {/* Price Display */}
              <div className="mb-8">
                <motion.div
                  animate={{
                    textShadow: [
                      '0 0 0px rgba(254, 145, 0, 0)',
                      '0 0 8px rgba(254, 145, 0, 0.3)',
                      '0 0 0px rgba(254, 145, 0, 0)'
                    ]
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="flex items-baseline gap-2"
                >
                  <span
                    className="text-4xl sm:text-5xl font-black"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      color: '#e9d7c4'
                    }}
                  >
                    {plan.currency} {plan.price.toLocaleString()}
                  </span>
                  <span className="text-white/50">/ Monat</span>
                </motion.div>
                <p className="text-sm text-white/50 mt-3">
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <div className="mb-8">
                <div className="text-xs text-white/50 uppercase tracking-wider mb-4">
                  Enthalten
                </div>
                <ul className="space-y-3">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-[#FE9100] mt-0.5" />
                      <span className="text-[15px] text-white/70">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <motion.button
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #FE9100, #ffd700)',
                  color: '#000',
                  boxShadow: '0 4px 16px rgba(254, 145, 0, 0.3)'
                }}
              >
                Plan wählen
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ARAS Free Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="max-w-3xl mx-auto"
      >
        <div
          className="rounded-2xl p-8 border"
          style={{
            background: 'rgba(21, 21, 21, 0.5)',
            borderColor: 'rgba(254, 145, 0, 0.2)'
          }}
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex-1">
              <h3
                className="text-xl font-black mb-2"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                ARAS Free
              </h3>
              <p className="text-white/60 mb-4">
                Kostenlos – dauerhaft
              </p>
              <p className="text-sm text-white/50 mb-4">
                Für alle Nutzer, die ARAS in kleinem Rahmen testen wollen.
              </p>
              <ul className="space-y-2">
                {['2 Outbound Calls', '10 Chatnachrichten', 'Zugriff auf ARAS Basic Console'].map((feature, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-white/60">
                    <CheckCircle2 className="w-4 h-4 text-[#FE9100]" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 rounded-lg border font-semibold text-sm"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                borderColor: '#FE9100',
                color: '#FE9100'
              }}
            >
              Kostenlos starten
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Upgrade Panel */}
      <AnimatePresence>
        {selectedPlan && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedPlan(null)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              transition={{ duration: 0.4, ease: [0.25, 0.8, 0.25, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-md w-full rounded-2xl border-t-4 p-8"
              style={{
                background: 'rgba(15, 15, 15, 0.65)',
                backdropFilter: 'blur(12px)',
                borderColor: '#FE9100'
              }}
            >
              <h3
                className="text-2xl font-black mb-4"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                {plans.find(p => p.id === selectedPlan)?.subtitle}
              </h3>
              <p className="text-white/70 mb-6 leading-relaxed">
                CHF {plans.find(p => p.id === selectedPlan)?.price.toLocaleString()} / Monat
              </p>
              <p className="text-sm text-white/60 mb-8">
                {plans.find(p => p.id === selectedPlan)?.description}
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 rounded-xl font-bold uppercase tracking-wider"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #FE9100, #ffd700)',
                  color: '#000'
                }}
              >
                Zugang aktivieren
              </motion.button>
              <button
                onClick={() => setSelectedPlan(null)}
                className="w-full mt-4 py-2 text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                Abbrechen
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// 🔒 Compliance Cards Component
function ComplianceCards() {
  const [selectedCard, setSelectedCard] = useState<number | null>(null);

  const securityPillars = [
    {
      icon: Globe,
      title: "Swiss Data Hosting",
      subtitle: "EU + CH Regulatorik",
      description: "Alle Daten werden ausschließlich in zertifizierten europäischen Rechenzentren gespeichert.",
      bullets: [
        "Keine Datenübertragung in die USA",
        "Kein Zugriff externer Dienstleister"
      ],
      details: `ARAS nutzt ausschließlich ISO-27001-zertifizierte Rechenzentren in der EU und der Schweiz. 
      
Ihre Daten verlassen niemals den europäischen Rechtsraum. Es gibt keine automatischen Backups in Drittländer, keine Cloud-Provider mit US-Muttergesellschaften und keine versteckten Datenpipelines.

Alle Hosting-Partner unterliegen der DSGVO und dem Schweizer Datenschutzgesetz (nDSG). Sie haben das Recht, jederzeit Auskunft über den Speicherort Ihrer Daten zu erhalten.`
    },
    {
      icon: Shield,
      title: "DSGVO- & nDSG-Konformität",
      subtitle: "Vollständige Compliance",
      description: "ARAS erfüllt sämtliche Anforderungen der EU-DSGVO sowie des Schweizer Datenschutzgesetzes.",
      bullets: [
        "Zweckbindung",
        "Datensparsamkeit",
        "Löschkonzepte",
        "dokumentierte Verarbeitungsprozesse",
        "Auditierbarkeit"
      ],
      details: `ARAS AI verarbeitet Telefonate, Texte und Systemmeldungen ausschließlich zweckgebunden und gemäß den europäischen Datenschutzstandards.

Dazu gehören:
• definierte Speicherfristen
• dokumentierte technische & organisatorische Maßnahmen
• Löschprozesse
• Datenschutzfolgeabschätzung (falls erforderlich)

Daten dürfen nur mit expliziter Freigabe exportiert oder übertragen werden. Jede Verarbeitung ist nachvollziehbar dokumentiert.`
    },
    {
      icon: Target,
      title: "Vollständige Protokollierung",
      subtitle: "Audit Trails",
      description: "Jeder relevante Vorgang wird revisionssicher erfasst:",
      bullets: [
        "Anrufe",
        "Systemzugriffe",
        "Datenverarbeitungen",
        "Aktualisierungen",
        "Nutzeraktionen"
      ],
      details: `ARAS protokolliert alle sicherheitsrelevanten Ereignisse in einem unveränderlichen Audit-Log.

Sie können jederzeit nachvollziehen:
• Wer hat wann auf welche Daten zugegriffen?
• Welche Anrufe wurden geführt?
• Welche Systemänderungen wurden vorgenommen?

Die Logs werden verschlüsselt gespeichert und können für Compliance-Prüfungen exportiert werden. Aufbewahrungsdauer: mindestens 12 Monate, konfigurierbar.`
    },
    {
      icon: Shield,
      title: "Verschlüsselung auf Bankniveau",
      subtitle: "Multi-Layer Encryption",
      description: "Schutz auf höchstem Niveau:",
      bullets: [
        "Transport: TLS 1.3",
        "Daten im Ruhezustand: AES-256",
        "Schlüsselrotation automatisch",
        "Multi-Layer Encryption für sensible Inhalte"
      ],
      details: `ARAS nutzt die gleichen Verschlüsselungsstandards wie Schweizer Banken.

Transport-Layer:
• TLS 1.3 für alle Verbindungen
• Perfect Forward Secrecy
• Certificate Pinning

Data-at-Rest:
• AES-256 Verschlüsselung
• Automatische Schlüsselrotation alle 90 Tage
• Hardware Security Modules (HSM) für Schlüsselverwaltung

Sensible Gesprächsinhalte werden zusätzlich mit kundenspezifischen Schlüsseln verschlüsselt.`
    },
    {
      icon: CheckCircle2,
      title: "Kontrollierbare KI",
      subtitle: "Keine Blackbox",
      description: "ARAS arbeitet mit einer transparenten Entscheidungslogik:",
      bullets: [
        "nachvollziehbare Antworten",
        "erklärbare Einwandbehandlung",
        "definierbare Gesprächsregeln",
        "keine unkontrollierten LLM-Ausgaben"
      ],
      details: `ARAS nutzt eine kombinierte Architektur:

• eigene Entscheidungslogik (Rulesets)
• gesicherte Prompt-Frameworks
• parameterisierte Gesprächspfade
• definierte Fallbacks

Die KI darf keine unkontrollierten Aussagen treffen – jede Antwort ist prüfbar.

Sie können jederzeit:
• Gesprächsregeln definieren
• Verbotene Themen festlegen
• Eskalationspfade konfigurieren
• Ausgaben validieren

Transparenz statt Blackbox.`
    }
  ];

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {securityPillars.map((pillar, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ 
              duration: 0.7, 
              delay: index * 0.15,
              ease: [0.25, 0.8, 0.25, 1]
            }}
            whileHover={{ scale: 1.02 }}
            onClick={() => setSelectedCard(selectedCard === index ? null : index)}
            className="group cursor-pointer relative"
          >
            {/* Animated Border */}
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{
                background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #e9d7c4)',
                backgroundSize: '200% 200%',
                padding: '1px'
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: 'linear'
              }}
            >
              <div className="w-full h-full rounded-2xl" style={{ background: '#151515' }} />
            </motion.div>

            {/* Card Content */}
            <div className="relative p-9 rounded-2xl" style={{ 
              background: '#151515',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)'
            }}>
              {/* Icon */}
              <motion.div
                whileHover={{ scale: 1.1 }}
                transition={{ duration: 0.25 }}
                className="mb-6"
              >
                <pillar.icon 
                  className="w-12 h-12 transition-colors duration-300"
                  style={{
                    color: selectedCard === index ? '#FE9100' : '#e9d7c4'
                  }}
                />
              </motion.div>

              {/* Title */}
              <h3
                className="text-2xl font-black mb-2"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                {pillar.title}
              </h3>

              {/* Subtitle */}
              <p className="text-sm text-[#FE9100]/80 mb-4 font-semibold">
                {pillar.subtitle}
              </p>

              {/* Description */}
              <p className="text-[17px] text-white/70 leading-relaxed mb-4">
                {pillar.description}
              </p>

              {/* Bullets */}
              {pillar.bullets && (
                <ul className="space-y-2">
                  {pillar.bullets.map((bullet, i) => (
                    <li key={i} className="text-[15px] text-white/60 flex items-start gap-2">
                      <span className="text-[#FE9100] mt-1">•</span>
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Click Indicator */}
              <motion.div
                className="mt-6 text-xs text-[#FE9100]/60 font-semibold uppercase tracking-wider"
                animate={{ opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {selectedCard === index ? '← Details ausblenden' : 'Klicken für Details →'}
              </motion.div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Panel */}
      <AnimatePresence>
        {selectedCard !== null && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 32 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            transition={{ duration: 0.5, ease: [0.25, 0.8, 0.25, 1] }}
            className="overflow-hidden"
          >
            <motion.div
              className="rounded-2xl border-t-4 p-10"
              style={{
                background: 'rgba(15, 15, 15, 0.7)',
                backdropFilter: 'blur(14px)',
                borderColor: '#FE9100'
              }}
            >
              <h4
                className="text-2xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                {securityPillars[selectedCard].title} — Technische Details
              </h4>
              <div className="text-[17px] text-white/70 leading-relaxed whitespace-pre-line">
                {securityPillars[selectedCard].details}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function AuthPage() {
  const [authMode, setAuthMode] = useState<'idle' | 'login' | 'signup'>('idle');
  const [subtitleIndex, setSubtitleIndex] = useState(0);
  const [typedLength, setTypedLength] = useState(0);
  const [showFeaturesPanel, setShowFeaturesPanel] = useState(false);
  const [, setLocation] = useLocation();
  const { user, isLoading, loginMutation, registerMutation } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [registerData, setRegisterData] = useState({
    username: "",
    email: "",
    password: "",
    firstName: "",
    lastName: "",
    // 🔥 BUSINESS INTELLIGENCE FIELDS
    company: "",
    website: "",
    industry: "",
    role: "",
    phone: "",
    language: "de",
    primaryGoal: ""
  });

  const [typedIndex, setTypedIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [emailError, setEmailError] = useState("");
  
  // 🔥 HERO FEATURE STATES
  const [benefitIndex, setBenefitIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0 });
  
  const HERO_BENEFITS = [
    { title: "10.000+ CALLS", subtitle: "Mit nur einem Klick starten" },
    { title: "NIE WIEDER", subtitle: "Kalte Akquise selbst machen" },
    { title: "24/7 SALES", subtitle: "Dein Vertrieb schläft nie" }
  ];

  // Rotate Benefits
  useEffect(() => {
    const interval = setInterval(() => {
      setBenefitIndex((prev) => (prev + 1) % HERO_BENEFITS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Countdown to 01.03.2026
  useEffect(() => {
    const targetDate = new Date('2026-03-01T00:00:00').getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;
      
      if (distance < 0) {
        clearInterval(interval);
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Real typewriter effect
  useEffect(() => {
    if (authMode !== 'idle') return;

    const currentText = AUTH_SUBLINES[subtitleIndex];
    
    if (typedLength < currentText.length) {
      // Typing character by character
      const timeout = setTimeout(() => {
        setTypedLength((prev) => prev + 1);
      }, 35);

      return () => clearTimeout(timeout);
    } else {
      // Pause after complete, then next sentence
      const timeout = setTimeout(() => {
        setTypedLength(0);
        setSubtitleIndex((prev) => (prev + 1) % AUTH_SUBLINES.length);
      }, 2200);

      return () => clearTimeout(timeout);
    }
  }, [authMode, subtitleIndex, typedLength]);

  // Reset when switching to form mode
  useEffect(() => {
    if (authMode !== 'idle') {
      setTypedLength(0);
      setSubtitleIndex(0);
    }
  }, [authMode]);
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [websiteError, setWebsiteError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  const [registrationStep, setRegistrationStep] = useState(1); // 1: Personal, 2: Business, 3: AI Config, 4: Live Research
  const [isResearching, setIsResearching] = useState(false);
  const [researchStatus, setResearchStatus] = useState<string>("");
  const [researchProgress, setResearchProgress] = useState<number>(0);
  
  // Industry & Goal Options
  const industries = [
    { value: "real_estate", label: "Immobilien" },
    { value: "insurance", label: "Versicherungen" },
    { value: "b2b_services", label: "B2B Services" },
    { value: "healthcare", label: "Healthcare" },
    { value: "finance", label: "Finanzwesen" },
    { value: "ecommerce", label: "E-Commerce" },
    { value: "technology", label: "Technologie" },
    { value: "consulting", label: "Beratung" },
    { value: "other", label: "Andere" }
  ];
  
  const primaryGoals = [
    { value: "lead_generation", label: "Lead Generierung" },
    { value: "appointment_booking", label: "Terminbuchung" },
    { value: "customer_support", label: "Kundensupport" },
    { value: "sales_outreach", label: "Vertrieb" },
    { value: "market_research", label: "Marktforschung" },
    { value: "follow_up", label: "Nachfassen" }
  ];
  
  const roles = [
    { value: "ceo", label: "CEO / Geschäftsführer" },
    { value: "sales_manager", label: "Sales Manager" },
    { value: "marketing", label: "Marketing Manager" },
    { value: "founder", label: "Founder" },
    { value: "freelancer", label: "Freelancer" },
    { value: "other", label: "Andere" }
  ];

  // Animated counter for stats
  const [callsCount, setCallsCount] = useState(0);
  const [accuracyCount, setAccuracyCount] = useState(0);

  useEffect(() => {
    // Count up animation for calls
    const callsTimer = setInterval(() => {
      setCallsCount(prev => {
        if (prev >= 10000) {
          clearInterval(callsTimer);
          return 10000;
        }
        return prev + 150;
      });
    }, 20);

    // Count up animation for accuracy
    const accuracyTimer = setInterval(() => {
      setAccuracyCount(prev => {
        if (prev >= 99) {
          clearInterval(accuracyTimer);
          return 99;
        }
        return prev + 1;
      });
    }, 30);

    return () => {
      clearInterval(callsTimer);
      clearInterval(accuracyTimer);
    };
  }, []);

  // Real-time validators for ALL fields
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setEmailError("");
      return true;
    }
    if (!emailRegex.test(email)) {
      setEmailError("❌ Ungültige E-Mail (z.B. max@firma.de)");
      return false;
    }
    setEmailError("✅ E-Mail ist gültig");
    return true;
  };

  const validateUsername = (username: string) => {
    if (!username) {
      setUsernameError("");
      return true;
    }
    if (username.length < 3) {
      setUsernameError("❌ Mindestens 3 Zeichen");
      return false;
    }
    if (username.length > 50) {
      setUsernameError("❌ Maximal 50 Zeichen");
      return false;
    }
    setUsernameError("✅ Username ist verfügbar");
    return true;
  };

  const validateWebsite = (website: string) => {
    if (!website || website.trim() === '') {
      setWebsiteError("");
      return true; // Optional field
    }
    
    // FLEXIBLE URL VALIDATION - accepts ALL formats
    // - https://firma.de
    // - http://firma.de
    // - www.firma.de
    // - firma.de
    const flexibleUrlRegex = /^(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;
    
    if (!flexibleUrlRegex.test(website)) {
      setWebsiteError("❌ Ungültig (z.B. firma.de oder www.firma.de)");
      return false;
    }
    
    setWebsiteError("✅ Website ist gültig");
    return true;
  };

  const validateFirstName = (name: string) => {
    if (!name || name.trim() === '') {
      setFirstNameError("❌ Vorname ist erforderlich");
      return false;
    }
    if (name.trim().length < 2) {
      setFirstNameError("❌ Mindestens 2 Zeichen");
      return false;
    }
    setFirstNameError("✅ Sieht gut aus!");
    return true;
  };

  const validateLastName = (name: string) => {
    if (!name || name.trim() === '') {
      setLastNameError("❌ Nachname ist erforderlich");
      return false;
    }
    if (name.trim().length < 2) {
      setLastNameError("❌ Mindestens 2 Zeichen");
      return false;
    }
    setLastNameError("✅ Sieht gut aus!");
    return true;
  };

  const validateCompany = (company: string) => {
    if (!company || company.trim() === '') {
      setCompanyError("❌ Firmenname ist erforderlich");
      return false;
    }
    if (company.trim().length < 2) {
      setCompanyError("❌ Mindestens 2 Zeichen");
      return false;
    }
    setCompanyError("✅ Perfekt!");
    return true;
  };

  const checkPasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength(null);
      setPasswordError("");
      return;
    }
    if (password.length < 6) {
      setPasswordStrength('weak');
      setPasswordError("⚠️ Zu kurz - mindestens 6 Zeichen");
    } else if (password.length < 10) {
      setPasswordStrength('medium');
      setPasswordError("✅ Akzeptabel - besser wären 10+ Zeichen");
    } else {
      setPasswordStrength('strong');
      setPasswordError("✅ Stark und sicher!");
    }
  };

  useEffect(() => {
    captureUTMParameters();
  }, []);

  useEffect(() => {
    const current = TYPED_LINES[typedIndex];
    const speed = isDeleting ? 50 : 100;

    const timer = setTimeout(() => {
      const currentLine = TYPED_LINES[typedIndex];

      if (!isDeleting && typedText === currentLine) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (!isDeleting) {
        setTypedText(currentLine.substring(0, typedText.length + 1));
      } else if (typedText.length > 0) {
        setTypedText(currentLine.substring(0, typedText.length - 1));
      } else {
        setIsDeleting(false);
        setTypedIndex((prev) => (prev + 1) % TYPED_LINES.length);
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, typedIndex]);

  // Redirect after login
  useEffect(() => {
    if (!isLoading && user) {
      setLocation("/space");
    }
  }, [isLoading, user, setLocation]);

  // Show loader during auth check or redirect
  if (isLoading || (!isLoading && user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="h-10 w-10 text-[#FE9100]" />
        </motion.div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await loginMutation.mutateAsync(loginData);
      trackLogin('email', result?.id);
      toast({
        title: "Welcome back!",
        description: "You have been successfully logged in."
      });
      setLocation("/space");
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive"
      });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // STEP 1 VALIDATION - Personal Data
    if (registrationStep === 1) {
      // Check required fields
      if (!registerData.firstName) {
        toast({
          title: "Hey, wir brauchen deinen Vornamen! 😊",
          description: "Damit deine KI dich persönlich ansprechen kann.",
          variant: "destructive"
        });
        return;
      }
      if (!registerData.lastName) {
        toast({
          title: "Und deinen Nachnamen bitte! 👤",
          description: "Das macht's offizieller und persönlicher.",
          variant: "destructive"
        });
        return;
      }
      if (!registerData.email) {
        toast({
          title: "E-Mail fehlt noch! 📧",
          description: "Wir brauchen sie für wichtige Updates und Login.",
          variant: "destructive"
        });
        return;
      }
      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(registerData.email)) {
        toast({
          title: "Hmm, die E-Mail sieht komisch aus 🤔",
          description: "Bitte gib eine gültige E-Mail-Adresse ein (z.B. max@firma.de)",
          variant: "destructive"
        });
        return;
      }
      if (!registerData.username) {
        toast({
          title: "Username vergessen! 💭",
          description: "Wähle einen coolen Usernamen für dein Login.",
          variant: "destructive"
        });
        return;
      }
      if (!registerData.password) {
        toast({
          title: "Passwort fehlt! 🔐",
          description: "Ein sicheres Passwort schützt deinen Account.",
          variant: "destructive"
        });
        return;
      }
      // Password strength check
      if (registerData.password.length < 6) {
        toast({
          title: "Passwort zu kurz! ⚠️",
          description: "Mindestens 6 Zeichen sind nötig für deine Sicherheit.",
          variant: "destructive"
        });
        return;
      }
      
      setRegistrationStep(2);
      return;
    }
    
    // STEP 2 VALIDATION - Business Intelligence
    if (registrationStep === 2) {
      if (!registerData.company) {
        toast({
          title: "Firmenname fehlt! 🏢",
          description: "Damit deine KI weiß, für wen sie arbeitet.",
          variant: "destructive"
        });
        return;
      }
      if (!registerData.industry) {
        toast({
          title: "Branche wählen! 🎯",
          description: "Das hilft der KI, sich auf deine Branche zu spezialisieren.",
          variant: "destructive"
        });
        return;
      }
      if (!registerData.role) {
        toast({
          title: "Deine Position fehlt! 👔",
          description: "Sag uns, welche Rolle du im Unternehmen hast.",
          variant: "destructive"
        });
        return;
      }
      
      // Website validation (optional, but if provided must be valid)
      if (registerData.website && registerData.website.trim() !== '') {
        if (!validateWebsite(registerData.website)) {
          toast({
            title: "Website-Format nicht korrekt 🌐",
            description: "Bitte gib eine gültige URL ein (z.B. firma.de, www.firma.de oder https://firma.de). Alle Formate sind akzeptiert!",
            variant: "destructive"
          });
          return;
        }
        // Auto-add https:// ONLY if no protocol is present
        if (!registerData.website.startsWith('http://') && !registerData.website.startsWith('https://')) {
          setRegisterData(prev => ({ 
            ...prev, 
            website: `https://${prev.website}` 
          }));
        }
      }
      
      setRegistrationStep(3);
      return;
    }
    
    // STEP 3 - Move to Live Research
    if (registrationStep === 3) {
      if (!registerData.primaryGoal) {
        toast({
          title: "Was ist dein Hauptziel?",
          description: "Wähle aus, wobei die KI dir am meisten helfen soll.",
          variant: "destructive"
        });
        return;
      }
      
      // Move to Step 4: Live Research
      setRegistrationStep(4);
      setIsResearching(true);
      
      // START ARAS AI RESEARCH ANIMATION - NO ICONS!
      const researchSteps = [
        "Verbindung zu globalen Datenbanken wird hergestellt",
        `ARAS AI analysiert über 500+ Datenquellen zu ${registerData.company}`,
        "Scanne Unternehmenswebsite und Social Media Präsenz",
        "ARAS AI durchsucht Branchendatenbanken",
        "ARAS AI analysiert Unternehmens-DNA und Marktposition",
        "Analysiere Wettbewerber und Zielgruppen",
        "Identifiziere Kundenprofile und USPs",
        "Extrahiere Produkte, Services und Alleinstellungsmerkmale",
        "ARAS AI generiert personalisiertes Profil",
        "Fast fertig"
      ];
      
      let currentStep = 0;
      const stepInterval = setInterval(() => {
        if (currentStep < researchSteps.length) {
          setResearchStatus(researchSteps[currentStep]);
          setResearchProgress(Math.min(((currentStep + 1) / researchSteps.length) * 100, 95));
          currentStep++;
        }
      }, 2000);
      
      // Start actual registration after animation starts
      setTimeout(async () => {
        try {
          const result = await registerMutation.mutateAsync(registerData);
          trackSignup('email', result?.id);
          
          // FIXED: Show animation but redirect much faster (research continues in background)
          // The AI analysis happens server-side and will be ready when user arrives at /space
          setTimeout(() => {
            clearInterval(stepInterval);
            setResearchProgress(100);
            setResearchStatus("ULTRA-DEEP Research abgeschlossen! ARAS AI kennt jetzt ALLES über " + registerData.company + "!");
            
            // Redirect faster - research is done server-side
            setTimeout(() => {
              toast({
                title: "🎉 Willkommen bei ARAS AI Pro Research™!",
                description: `Hey ${registerData.firstName}! Deine KI hat ${registerData.company} komplett analysiert. Ready to blow your mind! 💪🔥`
              });
              setLocation("/space");
            }, 2000); // Reduced from 3000ms
          }, 12000); // Reduced from 28000ms - much faster but still shows animation
          
        } catch (error: any) {
          clearInterval(stepInterval);
          setIsResearching(false);
          
          console.error('[REGISTER-ERROR]', error);
          
          // Better error messages from server with DETAILED feedback
          let errorMessage = "Ups, da ist was schief gelaufen. Versuch's nochmal!";
          let errorTitle = "Registrierung fehlgeschlagen 😕";
          
          // Check if error message contains specific keywords
          const errorText = error.message || error.toString() || '';
          
          if (errorText.includes('email') || errorText.includes('E-Mail')) {
            errorTitle = "E-Mail bereits registriert! 📧";
            errorMessage = `Die E-Mail-Adresse "${registerData.email}" ist bereits bei uns registriert. Möchtest du dich stattdessen einloggen?`;
          } else if (errorText.includes('username') || errorText.includes('Benutzername')) {
            errorTitle = "Username bereits vergeben! 👤";
            errorMessage = `Der Username "${registerData.username}" ist leider schon vergeben. Bitte wähle einen anderen!`;
          } else if (errorText) {
            errorMessage = errorText;
          }
          
          // Show PROMINENT error toast
          toast({
            title: errorTitle,
            description: errorMessage,
            variant: "destructive",
            duration: 8000 // Show longer for errors
          });
          
          // Go back to appropriate step based on error
          if (errorText.includes('email') || errorText.includes('username')) {
            setRegistrationStep(1); // Go back to step 1 for user info
          } else {
            setRegistrationStep(3); // Go back to step 3 for other errors
          }
          
          setResearchStatus("");
          setResearchProgress(0);
        }
      }, 2000); // Start registration after 2 seconds of animation
      
      return;
    }
  };

  const goToPreviousStep = () => {
    if (registrationStep > 1) {
      setRegistrationStep(registrationStep - 1);
    }
  };

  return (
    <div className="min-h-screen w-full text-white relative overflow-x-hidden">
      {/* Language Switcher */}
      <LanguageSwitcher />
      
      {/* Simple Dark Background with Subtle Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {/* Film Grain Texture for Premium Look */}
        <div 
          className="absolute inset-0 opacity-[0.015] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='2.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />

        {/* Premium Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/80 to-black/70" />
        
        {/* Subtle Radial Glow */}
        <div 
          className="absolute inset-0 opacity-20"
          style={{
            background: 'radial-gradient(circle at 50% 100%, rgba(254, 145, 0, 0.15) 0%, transparent 60%)'
          }}
        />
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col p-8">
        {/* Auth Form Section - Centered */}
        <div className="flex items-center justify-center py-20">
          <div className="w-full max-w-7xl mx-auto">
            {/* Live Date and Time - CENTERED ABOVE GRID */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="flex justify-center mb-10"
            >
              <LiveDateTime />
            </motion.div>

            {/* MAIN GRID */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
          
            {/* LEFT SIDE - Hero Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="space-y-10"
            >
              {/* Pre-Launch Badge */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="relative inline-block">
                <motion.div
                  className="absolute -inset-[2px] rounded-full"
                  style={{
                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                    backgroundSize: '300% 100%',
                    filter: 'blur(6px)',
                    opacity: 0.5
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                />
                <div className="relative flex items-center gap-2.5 px-4 py-2 rounded-full"
                  style={{
                    background: 'rgba(0, 0, 0, 0.7)',
                    border: '1px solid rgba(254, 145, 0, 0.25)',
                    backdropFilter: 'blur(20px)'
                  }}
                >
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full bg-[#FE9100]"
                    animate={{
                      scale: [1, 1.3, 1],
                      opacity: [1, 0.6, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-[10px] tracking-[0.25em] uppercase font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}>
                    PRE-LAUNCH PHASE
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Main Logo */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              <h1
                className="text-7xl font-black tracking-tight mb-3"
                style={{ 
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 60px rgba(254, 145, 0, 0.2)'
                }}
              >
                ARAS AI
              </h1>
              <p
                className="text-xs uppercase tracking-[0.3em] font-bold text-[#e9d7c4] opacity-80"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                Die Outbound-KI
              </p>
            </motion.div>

            {/* Typewriter Effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="min-h-[50px] flex items-center"
            >
              <span
                className="text-xl font-bold"
                style={{ 
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                {typedText}
                <motion.span
                  className="inline-block w-[2px] h-[22px] bg-[#FE9100] ml-1.5 align-middle"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                />
              </span>
            </motion.div>

            {/* 🔥 SPEKTAKULÄRE FEATURE CARDS - BENTO GRID STYLE */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="grid grid-cols-2 gap-4"
            >
              {/* Card 1 - Rotating Benefits (Simultane Anrufe) */}
              <motion.div
                whileHover={{ scale: 1.02, y: -5 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="col-span-2 relative overflow-hidden rounded-2xl p-6"
                style={{
                  background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.08), rgba(163, 78, 0, 0.05))',
                  border: '1px solid rgba(254, 145, 0, 0.2)',
                  backdropFilter: 'blur(30px)'
                }}
              >
                <div className="relative flex flex-col justify-center h-full min-h-[80px]">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs uppercase tracking-widest font-bold text-gray-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      SCALE & AUTOMATION
                    </span>
                  </div>
                  
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={benefitIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div 
                        className="text-2xl md:text-3xl font-black mb-1"
                        style={{ 
                          fontFamily: 'Orbitron, sans-serif',
                          background: 'linear-gradient(135deg, #e9d7c4, #FE9100)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        {HERO_BENEFITS[benefitIndex].title}
                      </div>
                      <p className="text-sm text-gray-400 leading-relaxed font-medium">
                        {HERO_BENEFITS[benefitIndex].subtitle}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Card 2 - Kostenloser Zugang */}
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="relative overflow-hidden rounded-2xl p-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(233, 215, 196, 0.06), rgba(254, 145, 0, 0.03))',
                  border: '1px solid rgba(233, 215, 196, 0.15)',
                  backdropFilter: 'blur(30px)'
                }}
              >
                <div className="relative h-full flex flex-col justify-center">
                  <div className="mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">ENTRY</span>
                  </div>
                  
                  <div 
                    className="text-xl font-bold mb-1 text-[#e9d7c4]"
                    style={{ fontFamily: 'Orbitron, sans-serif' }}
                  >
                    Kostenlos
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-relaxed font-medium">
                    Keine Kreditkarte erforderlich.
                  </p>
                </div>
              </motion.div>

              {/* Card 3 - Launch Countdown */}
              <motion.div
                whileHover={{ scale: 1.05, y: -5 }}
                transition={{ type: 'spring', stiffness: 300 }}
                className="relative overflow-hidden rounded-2xl p-5"
                style={{
                  background: 'linear-gradient(135deg, rgba(163, 78, 0, 0.08), rgba(254, 145, 0, 0.05))',
                  border: '1px solid rgba(163, 78, 0, 0.2)',
                  backdropFilter: 'blur(30px)'
                }}
              >
                <div className="relative h-full flex flex-col justify-center">
                  <div className="mb-2">
                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">OFFICIAL LAUNCH</span>
                  </div>
                  
                  <div className="flex items-baseline gap-1 mb-1">
                    <span 
                      className="text-xl font-bold text-[#FE9100]"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      01.03.26
                    </span>
                  </div>
                  
                  <div className="flex gap-2 text-xs text-gray-400 font-mono">
                    <span>{timeLeft.days}d</span>
                    <span>{timeLeft.hours}h</span>
                    <span>{timeLeft.minutes}m</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
              className="text-[10px] text-gray-700 leading-relaxed space-y-0.5 pt-6"
            >
              <p>Entwickelt von der Schwarzott Group</p>
              <p>Gebaut in der Schweiz. Betrieben von einem eigenen Sprachmodell.</p>
              <p className="text-[#e9d7c4] font-semibold opacity-60">Präzision. Eleganz. Kraft.</p>
            </motion.div>
          </motion.div>

          {/* RIGHT SIDE - Auth Form */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="w-full max-w-md mx-auto"
            style={{ marginTop: '-72px' }}
          >
            {/* Card Container */}
            <div className="relative">
              {/* Ambient Glow */}
              <motion.div
                className="absolute -inset-[2px] rounded-3xl"
                style={{
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                  filter: 'blur(25px)',
                  opacity: 0.3
                }}
                animate={{
                  opacity: [0.2, 0.4, 0.2]
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              {/* Main Card */}
              <div
                className="relative rounded-3xl p-8 md:p-9"
                style={{
                  background: 'rgba(0, 0, 0, 0.15)', // Schwächerer Background für mehr Kontrast zu Buttons
                  backdropFilter: 'blur(32px)',
                  WebkitBackdropFilter: 'blur(32px)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  boxShadow: '0 40px 80px rgba(0, 0, 0, 0.6)',
                  overflow: 'hidden' // Damit das Licht nicht aus der Card rausläuft
                }}
              >
                {/* ✨ DIVINE LIGHT EFFECT - WOW MOMENT */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: [0, 0.6, 0.4],
                    scale: [0.8, 1.1, 1]
                  }}
                  transition={{ 
                    duration: 2.5,
                    ease: "easeOut",
                    delay: 0.5,
                    opacity: {
                      repeat: Infinity,
                      repeatType: "reverse",
                      duration: 4,
                      delay: 0.5
                    }
                  }}
                  className="absolute -top-[150px] -right-[100px] w-[500px] h-[500px] pointer-events-none"
                  style={{
                    background: 'radial-gradient(circle, rgba(254,145,0,0.3) 0%, rgba(255,255,255,0.1) 20%, transparent 60%)',
                    filter: 'blur(50px)',
                    zIndex: 0,
                    mixBlendMode: 'overlay'
                  }}
                />
                
                {/* 🔦 SUBTLE BEAM */}
                <motion.div
                  initial={{ opacity: 0, rotate: -45 }}
                  animate={{ opacity: 0.3 }}
                  transition={{ duration: 2, delay: 1 }}
                  className="absolute -top-20 -right-20 w-[600px] h-[200px] pointer-events-none"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.15), transparent)',
                    filter: 'blur(40px)',
                    transform: 'rotate(-45deg)',
                    zIndex: 1
                  }}
                />

                <style dangerouslySetInnerHTML={{
                  __html: `
                    @keyframes aras-border-run {
                      0% { background-position: 0% 50%; }
                      50% { background-position: 100% 50%; }
                      100% { background-position: 0% 50%; }
                    }
                  `
                }} />
                {/* IDLE STATE - CTA PANEL */}
                <AnimatePresence>
                  {authMode === "idle" && (
                    <div className="flex flex-col gap-3">
                      {/* PRIMARY: Alpha Zugang beitreten – NEON GLOW */}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("signup");
                          setActiveTab("register");
                        }}
                        className="relative w-full rounded-full overflow-hidden uppercase tracking-[0.08em] font-bold text-sm md:text-base"
                        style={{ 
                          fontFamily: "Orbitron, sans-serif", 
                          color: "#FFFFFF", // Helles Weiß
                          textShadow: "0 0 15px rgba(254,145,0,0.8), 0 0 30px rgba(254,145,0,0.4)", // Starkes Leuchten
                          boxShadow: "0 0 30px rgba(254,145,0,0.25)" 
                        }}
                      >
                        {/* Outline-Gradient (nur Rand) */}
                        <span
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{
                            padding: "2px",
                            background:
                              "linear-gradient(120deg, #FE9100, #FFD700, #FE9100)", // Kräftigeres Gold/Orange
                            backgroundSize: "200% 100%",
                            animation: "aras-border-run 3s linear infinite", // Schnellerer Flow
                          }}
                        />

                        {/* Innen transparent, Glow außen */}
                        <motion.span
                          className="relative flex items-center justify-center rounded-full px-6 py-3.5"
                          style={{
                            background: "rgba(0,0,0,0.2)", // Leicht abgedunkelt für Kontrast
                          }}
                          whileHover={{
                            backgroundColor: "rgba(254,145,0,0.15)",
                            scale: 1.02,
                            textShadow: "0 0 25px rgba(254,145,0,1)"
                          }}
                          whileTap={{ scale: 0.97 }}
                        >
                          Kostenlos starten
                        </motion.span>
                      </button>

                      {/* SECONDARY: Login – Leuchtendes Weiß */}
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("login");
                          setActiveTab("login");
                        }}
                        className="relative w-full rounded-full overflow-hidden uppercase tracking-[0.08em] font-bold text-xs md:text-sm"
                        style={{ 
                          fontFamily: "Orbitron, sans-serif", 
                          color: "#FFFFFF",
                          textShadow: "0 0 12px rgba(255,255,255,0.6)" // Weißes Leuchten
                        }}
                      >
                        {/* Orange/Gold Outline-Gradient */}
                        <span
                          className="absolute inset-0 rounded-full pointer-events-none"
                          style={{
                            padding: "1px",
                            background:
                              "linear-gradient(120deg, rgba(255,255,255,0.5), rgba(254,145,0,0.8), rgba(255,255,255,0.5))",
                            backgroundSize: "260% 100%",
                            animation: "aras-border-run 6s linear infinite",
                          }}
                        />

                        {/* Innen transparent */}
                        <motion.span
                          className="relative flex items-center justify-center rounded-full px-6 py-3"
                          style={{
                            background: "rgba(0,0,0,0)", 
                          }}
                          whileHover={{
                            backgroundColor: "rgba(255,255,255,0.05)",
                            scale: 1.02,
                            textShadow: "0 0 20px rgba(255,255,255,0.9)"
                          }}
                          whileTap={{ scale: 0.97 }}
                        >
                          Login
                        </motion.span>
                      </button>

                      {/* Untertitel unter Buttons – statisch, clean */}
                      <p className="mt-2 text-[11px] text-center text-neutral-400">
                        Alpha Zugang ist kostenlos. Dein Account bleibt auch nach dem offiziellen Marktstart bestehen.
                      </p>
                    </div>
                  )}
                </AnimatePresence>

                {/* FORM STATE */}
                {authMode !== 'idle' && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    {/* Tab Switcher */}
                    <div className="mb-7">
                  <div className="flex gap-1.5 p-1 rounded-full"
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setActiveTab('login')}
                      className={`flex-1 py-2.5 rounded-full font-bold text-xs transition-all ${
                        activeTab === 'login'
                          ? 'text-black'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        background: activeTab === 'login'
                          ? 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)'
                          : 'transparent',
                        boxShadow: activeTab === 'login' ? '0 4px 15px rgba(254, 145, 0, 0.3)' : 'none'
                      }}
                    >
                      SIGN IN
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => setActiveTab('register')}
                      className={`flex-1 py-2.5 rounded-full font-bold text-xs transition-all ${
                        activeTab === 'register'
                          ? 'text-black'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        background: activeTab === 'register'
                          ? 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)'
                          : 'transparent',
                        boxShadow: activeTab === 'register' ? '0 4px 15px rgba(254, 145, 0, 0.3)' : 'none'
                      }}
                    >
                      SIGN UP
                    </motion.button>
                  </div>
                </div>

                {/* Forms */}
                <AnimatePresence mode="wait">
                  {activeTab === 'login' ? (
                    <motion.div
                      key="login"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="mb-6">
                        <h2 className="text-xl font-black mb-1" style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}>
                          Welcome Back
                        </h2>
                        <p className="text-xs text-gray-500">
                          Melde dich mit deinen Zugangsdaten an
                        </p>
                      </div>

                      <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-400">Username</Label>
                          <div className="relative group">
                            <motion.div
                              className="absolute -inset-[1px] rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
                              style={{
                                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                backgroundSize: '200% 100%'
                              }}
                              animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                              }}
                              transition={{ duration: 3, repeat: Infinity }}
                            />
                            <Input
                              type="text"
                              value={loginData.username}
                              onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                              placeholder="Dein Username"
                              required
                              className="relative bg-black/30 border-0 text-white rounded-xl px-4 py-3 text-sm"
                              style={{
                                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                              }}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label className="text-xs font-bold text-gray-400">Passwort</Label>
                          <div className="relative group">
                            <motion.div
                              className="absolute -inset-[1px] rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity"
                              style={{
                                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                backgroundSize: '200% 100%'
                              }}
                              animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                              }}
                              transition={{ duration: 3, repeat: Infinity }}
                            />
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={loginData.password}
                              onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                              placeholder="Passwort eingeben"
                              required
                              className="relative bg-black/70 border-0 text-white rounded-xl px-4 py-3 pr-12 text-sm"
                              style={{
                                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-white/10 rounded-lg"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4 text-gray-500" /> : <Eye className="h-4 w-4 text-gray-500" />}
                            </Button>
                          </div>
                        </div>

                        <AnimatePresence>
                          {loginMutation.isError && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-2 p-2.5 rounded-lg"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                              <p className="text-xs text-red-400 font-medium">
                                Login fehlgeschlagen
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <motion.div className="pt-3">
                          <motion.button
                            type="submit"
                            disabled={loginMutation.isPending}
                            whileHover={{ scale: loginMutation.isPending ? 1 : 1.01 }}
                            whileTap={{ scale: loginMutation.isPending ? 1 : 0.99 }}
                            className="relative w-full py-3.5 rounded-xl font-black text-sm overflow-hidden flex items-center justify-center gap-2"
                            style={{
                              fontFamily: 'Orbitron, sans-serif',
                              background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                              color: '#000000',
                              boxShadow: '0 10px 30px rgba(254, 145, 0, 0.3)',
                              cursor: loginMutation.isPending ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {loginMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                SIGNING IN...
                              </>
                            ) : (
                              <>
                                SIGN IN
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </motion.button>
                        </motion.div>

                        {/* Passwort vergessen Link */}
                        <div className="text-center pt-4">
                          <button
                            type="button"
                            onClick={() => setLocation('/forgot-password')}
                            className="text-sm text-white/50 hover:text-[#FE9100] transition-colors"
                          >
                            Passwort vergessen?
                          </button>
                        </div>
                      </form>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="register"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* 🔥 PROGRESS INDICATOR */}
                      <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                          {[1, 2, 3, 4].map((step) => (
                            <div key={step} className="flex items-center">
                              <motion.div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                                style={{
                                  background: registrationStep >= step 
                                    ? 'linear-gradient(135deg, #e9d7c4, #FE9100)' 
                                    : 'rgba(255, 255, 255, 0.1)',
                                  color: registrationStep >= step ? '#000' : '#666',
                                  fontFamily: 'Orbitron, sans-serif'
                                }}
                                animate={{
                                  scale: registrationStep === step ? [1, 1.1, 1] : 1
                                }}
                                transition={{ duration: 0.3 }}
                              >
                                {step}
                              </motion.div>
                              {step < 4 && (
                                <div 
                                  className="w-12 h-0.5 mx-1" 
                                  style={{
                                    background: registrationStep > step 
                                      ? 'linear-gradient(90deg, #FE9100, #e9d7c4)'
                                      : 'rgba(255, 255, 255, 0.1)'
                                  }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="text-[10px] text-gray-500 text-center">
                          {registrationStep === 1 && "Persönliche Daten"}
                          {registrationStep === 2 && "Business Intelligence"}
                          {registrationStep === 3 && "AI Konfiguration"}
                          {registrationStep === 4 && "Live Research"}
                        </div>
                      </div>
                      
                      <div className="mb-5">
                        <h2 className="text-xl font-black mb-1" style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}>
                          {registrationStep === 1 && "Join Alpha"}
                          {registrationStep === 2 && "Dein Business"}
                          {registrationStep === 3 && "KI personalisieren"}
                          {registrationStep === 4 && "Live Research"}
                        </h2>
                        <p className="text-xs text-gray-500">
                          {registrationStep === 1 && "Du wurdest ausgewählt"}
                          {registrationStep === 2 && "Erzähle uns von deinem Unternehmen"}
                          {registrationStep === 3 && "Konfiguriere deine persönliche KI"}
                          {registrationStep === 4 && "Wir analysieren dein Unternehmen"}
                        </p>
                      </div>

                      <form onSubmit={handleRegister} className="space-y-3.5">
                        {registrationStep === 1 && (
                          <>
                            {/* STEP 1: Personal Information */}
                            <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-gray-400">Vorname</Label>
                            <div className="relative group">
                              <motion.div
                                className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                style={{
                                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                  backgroundSize: '200% 100%'
                                }}
                                animate={{
                                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                              />
                              <Input
                                type="text"
                                value={registerData.firstName}
                                onChange={(e) => {
                                  setRegisterData(prev => ({ ...prev, firstName: e.target.value }));
                                  if (e.target.value) validateFirstName(e.target.value);
                                  else setFirstNameError("");
                                }}
                                onBlur={(e) => validateFirstName(e.target.value)}
                                placeholder="Vorname"
                                required
                                className="relative bg-black/30 border-0 text-white rounded-lg px-3 py-2 text-xs"
                                style={{
                                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                }}
                              />
                            </div>
                            <AnimatePresence>
                              {firstNameError && (
                                <motion.p
                                  initial={{ opacity: 0, y: -3 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -3 }}
                                  className={`text-[10px] flex items-center gap-1 ${
                                    firstNameError.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {!firstNameError.startsWith('✅') && <AlertCircle className="w-2.5 h-2.5" />}
                                  {firstNameError.startsWith('✅') && <CheckCircle2 className="w-2.5 h-2.5" />}
                                  {firstNameError}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-gray-400">Nachname</Label>
                            <div className="relative group">
                              <motion.div
                                className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                style={{
                                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                  backgroundSize: '200% 100%'
                                }}
                                animate={{
                                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                }}
                                transition={{ duration: 3, repeat: Infinity }}
                              />
                              <Input
                                type="text"
                                value={registerData.lastName}
                                onChange={(e) => {
                                  setRegisterData(prev => ({ ...prev, lastName: e.target.value }));
                                  if (e.target.value) validateLastName(e.target.value);
                                  else setLastNameError("");
                                }}
                                onBlur={(e) => validateLastName(e.target.value)}
                                placeholder="Nachname"
                                required
                                className="relative bg-black/30 border-0 text-white rounded-lg px-3 py-2 text-xs"
                                style={{
                                  boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                }}
                              />
                            </div>
                            <AnimatePresence>
                              {lastNameError && (
                                <motion.p
                                  initial={{ opacity: 0, y: -3 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -3 }}
                                  className={`text-[10px] flex items-center gap-1 ${
                                    lastNameError.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                                  }`}
                                >
                                  {!lastNameError.startsWith('✅') && <AlertCircle className="w-2.5 h-2.5" />}
                                  {lastNameError.startsWith('✅') && <CheckCircle2 className="w-2.5 h-2.5" />}
                                  {lastNameError}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-gray-400">Username</Label>
                          <div className="relative group">
                            <motion.div
                              className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                              style={{
                                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                backgroundSize: '200% 100%'
                              }}
                              animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                              }}
                              transition={{ duration: 3, repeat: Infinity }}
                            />
                            <Input
                              type="text"
                              value={registerData.username}
                              onChange={(e) => {
                                setRegisterData(prev => ({ ...prev, username: e.target.value }));
                                validateUsername(e.target.value);
                              }}
                              placeholder="Wähle einen Username"
                              required
                              className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 text-xs"
                              style={{
                                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                              }}
                            />
                          </div>
                          <AnimatePresence>
                            {usernameError && (
                              <motion.p
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                className={`text-[10px] flex items-center gap-1 ${
                                  usernameError.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                {!usernameError.startsWith('✅') && <AlertCircle className="w-2.5 h-2.5" />}
                                {!usernameError.startsWith('✅') && <CheckCircle2 className="w-2.5 h-2.5" />}
                                {usernameError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-gray-400">E-Mail</Label>
                          <div className="relative group">
                            <motion.div
                              className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                              style={{
                                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                backgroundSize: '200% 100%'
                              }}
                              animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                              }}
                              transition={{ duration: 3, repeat: Infinity }}
                            />
                            <Input
                              type="email"
                              value={registerData.email}
                              onChange={(e) => {
                                setRegisterData(prev => ({ ...prev, email: e.target.value }));
                                validateEmail(e.target.value);
                              }}
                              placeholder="name@example.com"
                              required
                              className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 text-xs"
                              style={{
                                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                              }}
                            />
                          </div>
                          <AnimatePresence>
                            {emailError && (
                              <motion.p
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                className={`text-[10px] flex items-center gap-1 ${
                                  emailError.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                                }`}
                              >
                                {!emailError.startsWith('✅') && <AlertCircle className="w-2.5 h-2.5" />}
                                {emailError.startsWith('✅') && <CheckCircle2 className="w-2.5 h-2.5" />}
                                {emailError}
                              </motion.p>
                            )}
                          </AnimatePresence>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-[10px] font-bold text-gray-400">Passwort</Label>
                          <div className="relative group">
                            <motion.div
                              className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                              style={{
                                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                backgroundSize: '200% 100%'
                              }}
                              animate={{
                                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                              }}
                              transition={{ duration: 3, repeat: Infinity }}
                            />
                            <Input
                              type={showPassword ? "text" : "password"}
                              value={registerData.password}
                              onChange={(e) => {
                                setRegisterData(prev => ({ ...prev, password: e.target.value }));
                                checkPasswordStrength(e.target.value);
                              }}
                              placeholder="Sicheres Passwort"
                              required
                              minLength={6}
                              className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 pr-10 text-xs"
                              style={{
                                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-white/10 rounded"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              {showPassword ? <EyeOff className="h-3.5 w-3.5 text-gray-500" /> : <Eye className="h-3.5 w-3.5 text-gray-500" />}
                            </Button>
                          </div>
                          
                          <AnimatePresence>
                            {passwordStrength && (
                              <motion.div
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -3 }}
                                className="space-y-1.5"
                              >
                                <div className="flex items-center gap-1.5 text-[10px]">
                                  <div className="flex gap-0.5 flex-1">
                                    {[1, 2, 3].map((i) => (
                                      <div
                                        key={i}
                                        className="h-0.5 flex-1 rounded-full"
                                        style={{
                                          background: i <= (passwordStrength === 'weak' ? 1 : passwordStrength === 'medium' ? 2 : 3)
                                            ? passwordStrength === 'weak' ? '#ef4444' : passwordStrength === 'medium' ? '#f59e0b' : '#22c55e'
                                            : 'rgba(255,255,255,0.1)'
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <span
                                    className="font-semibold"
                                    style={{
                                      color: passwordStrength === 'weak' ? '#ef4444' : passwordStrength === 'medium' ? '#f59e0b' : '#22c55e'
                                    }}
                                  >
                                    {passwordStrength === 'weak' ? 'Schwach' : passwordStrength === 'medium' ? 'Mittel' : 'Stark'}
                                  </span>
                                </div>
                                {passwordError && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className={`text-[10px] flex items-center gap-1 ${
                                      passwordError.startsWith('✅') ? 'text-green-400' : passwordError.startsWith('⚠️') ? 'text-yellow-400' : 'text-red-400'
                                    }`}
                                  >
                                    {passwordError}
                                  </motion.p>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                          </>
                        )}
                        
                        {registrationStep === 2 && (
                          <>
                            {/* STEP 2: Business Intelligence 🚀 */}
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-gray-400">Firma</Label>
                              <div className="relative group">
                                <motion.div
                                  className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                  style={{
                                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                    backgroundSize: '200% 100%'
                                  }}
                                  animate={{
                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                  }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                />
                                <Input
                                  type="text"
                                  value={registerData.company}
                                  onChange={(e) => {
                                    setRegisterData(prev => ({ ...prev, company: e.target.value }));
                                    if (e.target.value) validateCompany(e.target.value);
                                    else setCompanyError("");
                                  }}
                                  onBlur={(e) => validateCompany(e.target.value)}
                                  placeholder="Deine Firma"
                                  required
                                  className="relative bg-black/30 border-0 text-white rounded-lg px-3 py-2 text-xs"
                                  style={{
                                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                  }}
                                />
                              </div>
                              <AnimatePresence>
                                {companyError && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    className={`text-[10px] flex items-center gap-1 ${
                                      companyError.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {!companyError.startsWith('✅') && <AlertCircle className="w-2.5 h-2.5" />}
                                    {companyError.startsWith('✅') && <CheckCircle2 className="w-2.5 h-2.5" />}
                                    {companyError}
                                  </motion.p>
                                )}
                              </AnimatePresence>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-gray-400">Website (optional)</Label>
                              <div className="relative group">
                                <motion.div
                                  className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                  style={{
                                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                    backgroundSize: '200% 100%'
                                  }}
                                  animate={{
                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                  }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                />
                                <Input
                                  type="text"
                                  value={registerData.website}
                                  onChange={(e) => {
                                    setRegisterData(prev => ({ ...prev, website: e.target.value }));
                                    validateWebsite(e.target.value);
                                  }}
                                  placeholder="firma.de oder www.firma.de"
                                  className="relative bg-black/30 border-0 text-white rounded-lg px-3 py-2 text-xs"
                                  style={{
                                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                  }}
                                />
                              </div>
                              <AnimatePresence>
                                {websiteError && (
                                  <motion.p
                                    initial={{ opacity: 0, y: -3 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -3 }}
                                    className={`text-[10px] flex items-center gap-1 ${
                                      websiteError.startsWith('✅') ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {!websiteError.startsWith('✅') && <AlertCircle className="w-2.5 h-2.5" />}
                                    {websiteError.startsWith('✅') && <CheckCircle2 className="w-2.5 h-2.5" />}
                                    {websiteError}
                                  </motion.p>
                                )}
                              </AnimatePresence>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-gray-400">Branche</Label>
                                <div className="relative group">
                                  <motion.div
                                    className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                    style={{
                                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                      backgroundSize: '200% 100%'
                                    }}
                                    animate={{
                                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                  />
                                  <select
                                    value={registerData.industry}
                                    onChange={(e) => setRegisterData(prev => ({ ...prev, industry: e.target.value }))}
                                    required
                                    className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 text-xs w-full appearance-none"
                                    style={{
                                      boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                    }}
                                  >
                                    <option value="" className="bg-black">Wähle Branche...</option>
                                    {industries.map(ind => (
                                      <option key={ind.value} value={ind.value} className="bg-black">
                                        {ind.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-gray-400">Position</Label>
                                <div className="relative group">
                                  <motion.div
                                    className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                    style={{
                                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                      backgroundSize: '200% 100%'
                                    }}
                                    animate={{
                                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                    }}
                                    transition={{ duration: 3, repeat: Infinity }}
                                  />
                                  <select
                                    value={registerData.role}
                                    onChange={(e) => setRegisterData(prev => ({ ...prev, role: e.target.value }))}
                                    required
                                    className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 text-xs w-full appearance-none"
                                    style={{
                                      boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                    }}
                                  >
                                    <option value="" className="bg-black">Deine Rolle...</option>
                                    {roles.map(role => (
                                      <option key={role.value} value={role.value} className="bg-black">
                                        {role.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-gray-400">Telefon (optional)</Label>
                              <div className="relative group">
                                <motion.div
                                  className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                  style={{
                                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                    backgroundSize: '200% 100%'
                                  }}
                                  animate={{
                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                  }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                />
                                <Input
                                  type="tel"
                                  value={registerData.phone}
                                  onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                                  placeholder="+49 123 456789"
                                  className="relative bg-black/30 border-0 text-white rounded-lg px-3 py-2 text-xs"
                                  style={{
                                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                  }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                        
                        {registrationStep === 3 && (
                          <>
                            {/* STEP 3: AI Configuration 🤖 */}
                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-gray-400">Primäres Ziel</Label>
                              <div className="relative group">
                                <motion.div
                                  className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                  style={{
                                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                    backgroundSize: '200% 100%'
                                  }}
                                  animate={{
                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                  }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                />
                                <select
                                  value={registerData.primaryGoal}
                                  onChange={(e) => setRegisterData(prev => ({ ...prev, primaryGoal: e.target.value }))}
                                  required
                                  className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 text-xs w-full appearance-none"
                                  style={{
                                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                  }}
                                >
                                  <option value="" className="bg-black">Was ist dein Hauptziel?</option>
                                  {primaryGoals.map(goal => (
                                    <option key={goal.value} value={goal.value} className="bg-black">
                                      {goal.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-[10px] font-bold text-gray-400">Sprache</Label>
                              <div className="relative group">
                                <motion.div
                                  className="absolute -inset-[1px] rounded-lg opacity-0 group-focus-within:opacity-100 transition-opacity"
                                  style={{
                                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                                    backgroundSize: '200% 100%'
                                  }}
                                  animate={{
                                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                                  }}
                                  transition={{ duration: 3, repeat: Infinity }}
                                />
                                <select
                                  value={registerData.language}
                                  onChange={(e) => setRegisterData(prev => ({ ...prev, language: e.target.value }))}
                                  className="relative bg-black/70 border-0 text-white rounded-lg px-3 py-2 text-xs w-full appearance-none"
                                  style={{
                                    boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.6)'
                                  }}
                                >
                                  <option value="de" className="bg-black">Deutsch</option>
                                  <option value="en" className="bg-black">English</option>
                                  <option value="fr" className="bg-black">Français</option>
                                </select>
                              </div>
                            </div>

                            {isResearching && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 rounded-xl bg-gradient-to-r from-[#FE9100]/10 to-[#e9d7c4]/10 border border-[#FE9100]/20"
                              >
                                <div className="flex items-center gap-3">
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                  >
                                    <Search className="w-5 h-5 text-[#FE9100]" />
                                  </motion.div>
                                  <div>
                                    <p className="text-xs font-bold text-[#e9d7c4]">KI wird personalisiert...</p>
                                    <p className="text-[10px] text-gray-500 mt-1">
                                      Analysiere {registerData.company} in Echtzeit
                                    </p>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </>
                        )}
                        
                        {registrationStep === 4 && (
                          <>
                            {/* STEP 4: LIVE RESEARCH */}
                            <div className="text-center space-y-4">
                              <div className="space-y-2">
                                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">LIVE INTELLIGENCE RESEARCH</div>
                                <div className="text-2xl font-black">
                                  <motion.span
                                    animate={{ opacity: [1, 0.5, 1] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                    style={{ 
                                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)', 
                                      backgroundClip: 'text', 
                                      WebkitBackgroundClip: 'text', 
                                      WebkitTextFillColor: 'transparent' 
                                    }}
                                  >
                                    ARAS AI analysiert {registerData.company}
                                  </motion.span>
                                </div>
                              </div>
                              
                              {isResearching ? (
                                <div className="space-y-4 py-4">
                                  {/* Progress Bar */}
                                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                    <motion.div
                                      className="h-full bg-gradient-to-r from-[#e9d7c4] to-[#FE9100]"
                                      initial={{ width: "0%" }}
                                      animate={{ width: `${researchProgress}%` }}
                                      transition={{ duration: 0.5 }}
                                    />
                                  </div>
                                  
                                  {/* Live Status */}
                                  <motion.div
                                    key={researchStatus}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    className="text-sm text-gray-300 min-h-[60px] flex items-center justify-center"
                                  >
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2 justify-center">
                                        <motion.div
                                          animate={{ rotate: 360 }}
                                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                          className="w-4 h-4 border-2 border-[#FE9100] border-t-transparent rounded-full"
                                        />
                                        <span className="font-medium">{researchStatus}</span>
                                      </div>
                                      {researchProgress > 30 && (
                                        <div className="text-xs text-gray-400 text-center">
                                          {researchProgress > 70 ? "🚀 Fast fertig..." : researchProgress > 50 ? "🤖 Deep Learning aktiviert..." : "🔥 Analyse läuft..."}
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                  
                                  {/* Research Facts */}
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-black/40 p-2 rounded border border-gray-800">
                                      <div className="text-[#FE9100] font-bold">500+</div>
                                      <div className="text-gray-500">Datenquellen</div>
                                    </div>
                                    <div className="bg-black/40 p-2 rounded border border-gray-800">
                                      <div className="text-[#FE9100] font-bold">LIVE</div>
                                      <div className="text-gray-500">Echtzeit Analyse</div>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-sm text-gray-300 space-y-2">
                                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                    <p className="text-green-400 font-bold">✓ Research abgeschlossen!</p>
                                    <p className="text-xs text-gray-400 mt-1">
                                      AI-Profil wurde erfolgreich erstellt
                                    </p>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-semibold text-white">{registerData.firstName} {registerData.lastName}</p>
                                    <p>{registerData.company}</p>
                                    <p className="text-xs text-gray-400">{registerData.email}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        <AnimatePresence>
                          {registerMutation.isError && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="flex items-center gap-2 p-2 rounded-lg"
                              style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)'
                              }}
                            >
                              <AlertCircle className="w-3 h-3 text-red-400" />
                              <p className="text-[10px] text-red-400 font-medium">
                                Registrierung fehlgeschlagen
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="pt-3 space-y-2">
                          {/* Back Button for Step 2 & 3 */}
                          {registrationStep > 1 && (
                            <motion.button
                              type="button"
                              onClick={goToPreviousStep}
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              className="relative w-full py-2.5 rounded-xl font-bold text-xs overflow-hidden flex items-center justify-center gap-2 text-gray-400 hover:text-gray-300"
                              style={{
                                fontFamily: 'Orbitron, sans-serif',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)'
                              }}
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                              Zurück
                            </motion.button>
                          )}
                          
                          {/* Submit/Next Button */}
                          <motion.button
                            type="submit"
                            disabled={registerMutation.isPending || isResearching}
                            whileHover={{ scale: (registerMutation.isPending || isResearching) ? 1 : 1.01 }}
                            whileTap={{ scale: (registerMutation.isPending || isResearching) ? 1 : 0.99 }}
                            className="relative w-full py-3.5 rounded-xl font-black text-sm overflow-hidden flex items-center justify-center gap-2"
                            style={{
                              fontFamily: 'Orbitron, sans-serif',
                              background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                              color: '#000000',
                              boxShadow: '0 10px 30px rgba(254, 145, 0, 0.3)',
                              cursor: (registerMutation.isPending || isResearching) ? 'not-allowed' : 'pointer'
                            }}
                          >
                            {isResearching ? (
                              <>
                                <motion.div
                                  animate={{ rotate: 360 }}
                                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                >
                                  <Search className="w-4 h-4" />
                                </motion.div>
                                PERSONALISIERE KI...
                              </>
                            ) : registerMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                CREATING...
                              </>
                            ) : (
                              <>
                                {registrationStep === 1 && "WEITER"}
                                {registrationStep === 2 && "WEITER"}
                                {registrationStep === 3 && "ACCOUNT ERSTELLEN"}
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </motion.button>
                        </div>
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
            </div> {/* Close grid */}
          </div> {/* Close max-w-7xl */}
        </div> {/* Close py-20 */}

        {/* PRICING SECTION */}
        <PricingSection />

        {/* 📞 CALL-FLOW SECTION - Wie ARAS telefoniert */}
        <section className="relative py-32 px-8" style={{ background: 'transparent' }}>
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <h2
                className="text-5xl md:text-6xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #ffd700)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                So führt ARAS AI ein echtes Gespräch – Schritt für Schritt
              </h2>
              <p className="text-xl text-white/70 max-w-4xl mx-auto leading-relaxed mb-4">
                Der gesamte Telefonie-Prozess läuft autonom, transparent und nachvollziehbar ab.
              </p>
              <p className="text-lg text-white/60 max-w-3xl mx-auto">
                Sie kontrollieren jeden Schritt – ARAS übernimmt die Ausführung.
              </p>
            </motion.div>

            {/* Main Content: Timeline + Live Call Window */}
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              {/* LEFT: Timeline */}
              <CallFlowTimeline />

              {/* RIGHT: Live Call Window */}
              <LiveCallWindow />
            </div>
          </div>
        </section>

        {/* ⭐ HERO SECTION - Ultra Clean Minimal Design */}
        <section className="relative min-h-screen w-full flex items-center justify-center" style={{ background: 'transparent' }}>
          <div className="relative max-w-5xl mx-auto px-8 text-center">
            
            {/* Typing Headline */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="mb-12"
            >
              <h1 
                className="text-5xl md:text-6xl lg:text-7xl font-black mb-6 leading-tight text-white"
                style={{ fontFamily: 'Orbitron, sans-serif' }}
              >
                {'ARAS AI'.split('').map((char, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.05, delay: i * 0.08 }}
                  >
                    {char}
                  </motion.span>
                ))}
                <br />
                <motion.span
                  style={{
                    background: 'linear-gradient(90deg, #666666, #e9d7c4, #FE9100, #ff8c00, #FE9100, #e9d7c4, #666666)',
                    backgroundSize: '300% 100%',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                  initial={{ opacity: 0 }}
                  animate={{ 
                    opacity: 1,
                    backgroundPosition: ['0% 50%', '50% 50%', '100% 50%', '50% 50%', '0% 50%']
                  }}
                  transition={{ 
                    opacity: { duration: 0.8, delay: 0.6 },
                    backgroundPosition: { duration: 12, repeat: Infinity, ease: 'easeInOut' }
                  }}
                >
                  <T>The New Standard</T>
                </motion.span>
              </h1>
            </motion.div>
            
            {/* Typing Animation Below */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 1.2 }}
              className="mb-12 min-h-[40px] flex items-center justify-center"
            >
              <span className="text-2xl text-white/80" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                {typedText}
                <motion.span
                  className="inline-block w-0.5 h-6 bg-white ml-1"
                  animate={{ opacity: [1, 0, 1] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
              </span>
            </motion.div>
            
            {/* Subtitle with Fade In */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1 }}
              className="text-xl md:text-2xl text-white/70 leading-relaxed mb-8 max-w-4xl mx-auto"
            >
              <T>Natürlich klingende KI-Telefonate, präzise Automation und Schweizer Datensicherheit – entwickelt für Unternehmen, die skalieren wollen, ohne Kompromisse einzugehen.</T>
            </motion.p>
            
            {/* Value Props */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="text-lg text-white/60 leading-relaxed mb-6 max-w-3xl mx-auto"
            >
              <p>
                <T>ARAS AI führt echte Outbound-Gespräche, qualifiziert Leads, verarbeitet Nachrichten und integriert sich nahtlos in bestehende Systeme.</T>
              </p>
            </motion.div>
            
            {/* Alpha Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 1.6 }}
              className="inline-block mb-12"
            >
              <div className="px-6 py-3 rounded-full border border-white/20 bg-transparent">
                <p className="text-sm text-white/80">
                  <T>Aktuell in der streng limitierten Alpha-Phase – mit dauerhaft gesicherten Early-Access-Preisen</T>
                </p>
              </div>
            </motion.div>
            
            {/* CTA Buttons - Animated */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 1.9 }}
              className={`flex gap-4 justify-center ${showFeaturesPanel ? 'opacity-40 pointer-events-none' : ''} transition-opacity duration-300`}
            >
              <motion.button
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-12 py-5 text-lg font-bold overflow-hidden rounded-xl"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)'
                }}
              >
                {/* Animated Border */}
                <motion.div
                  className="absolute inset-0 p-[2px] rounded-xl"
                  style={{
                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4)',
                    backgroundSize: '200% 100%'
                  }}
                  animate={{
                    backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                  }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                >
                  <div className="w-full h-full bg-black rounded-xl" />
                </motion.div>
                
                {/* Button Content */}
                <span className="relative z-10 text-white group-hover:text-white transition-colors">
                  <T>→ Zugang aktivieren</T>
                </span>
                
                {/* Hover Glow */}
                <motion.div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'radial-gradient(circle at center, rgba(254, 145, 0, 0.2), transparent 70%)',
                    filter: 'blur(20px)'
                  }}
                />
              </motion.button>
              
              <motion.button
                onClick={() => setShowFeaturesPanel(true)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="group relative px-12 py-5 text-lg font-bold overflow-hidden rounded-xl border border-white/20"
                style={{ fontFamily: 'Orbitron, sans-serif', cursor: 'pointer', background: 'transparent' }}
              >
                <span className="relative z-10 text-white group-hover:text-white transition-colors">
                  ARAS AI Funktionen
                </span>
              </motion.button>
            </motion.div>
            
          </div>
          
          {/* Features Panel */}
          <AnimatePresence>
            {showFeaturesPanel && (
              <>
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                  onClick={() => setShowFeaturesPanel(false)}
                />
                
                {/* Slide-in Panel */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ duration: 0.45, ease: 'easeOut' }}
                  className="fixed right-0 top-0 bottom-0 w-full md:w-[600px] z-50 overflow-y-auto"
                  style={{
                    background: 'rgba(15, 15, 15, 0.95)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderLeft: '2px solid transparent',
                    borderImage: 'linear-gradient(180deg, #e9d7c4, #FE9100, #a34e00) 1'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Animated Top Border */}
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{
                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4)',
                      backgroundSize: '200% 100%'
                    }}
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  />
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setShowFeaturesPanel(false)}
                    className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center rounded-full border border-white/20 hover:bg-white/5 transition-colors z-10"
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="text-white text-2xl">×</span>
                  </button>
                  
                  <div className="p-12">
                    {/* Header */}
                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="text-4xl font-black mb-4 text-white"
                      style={{ fontFamily: 'Orbitron, sans-serif' }}
                    >
                      <T>Funktionen von ARAS AI</T>
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="text-white/60 mb-12 text-lg"
                    >
                      <T>Die komplette Plattform für intelligente Kommunikation</T>
                    </motion.p>
                    
                    {/* Features List */}
                    <div className="space-y-10">
                      {/* 1. Outbound-KI-Telefonie */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Phone className="w-6 h-6 text-[#FE9100]" />
                          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            <T>Outbound-KI-Telefonie</T>
                          </h3>
                        </div>
                        <ul className="space-y-2 pl-9">
                          {['natürliche Stimme', 'Lead-Qualifizierung', 'Terminbuchung', 'Einwandbehandlung', 'parallele Anrufe'].map((item, i) => (
                            <li key={i} className="text-white/70 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FE9100]/60" />
                              <span><T>{item}</T></span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                      
                      {/* 2. Chat-Automation */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Sparkles className="w-6 h-6 text-[#FE9100]" />
                          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            <T>Chat-Automation</T>
                          </h3>
                        </div>
                        <ul className="space-y-2 pl-9">
                          {['Inbox-Verarbeitung', 'Antworten im eigenen Stil', 'tägliche Zusammenfassungen'].map((item, i) => (
                            <li key={i} className="text-white/70 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FE9100]/60" />
                              <span><T>{item}</T></span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                      
                      {/* 3. Integrationen */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.6 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Globe className="w-6 h-6 text-[#FE9100]" />
                          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            <T>Integrationen</T>
                          </h3>
                        </div>
                        <ul className="space-y-2 pl-9">
                          {['Make', 'Zapier', 'n8n', 'API', 'Salesforce / HubSpot / Bitrix24'].map((item, i) => (
                            <li key={i} className="text-white/70 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FE9100]/60" />
                              <span><T>{item}</T></span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                      
                      {/* 4. Reporting & Analysen */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.7 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <TrendingUp className="w-6 h-6 text-[#FE9100]" />
                          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            <T>Reporting & Analysen</T>
                          </h3>
                        </div>
                        <ul className="space-y-2 pl-9">
                          {['Erfolg', 'Emotion', 'Drop-Rate', 'Call Insights'].map((item, i) => (
                            <li key={i} className="text-white/70 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FE9100]/60" />
                              <span><T>{item}</T></span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                      
                      {/* 5. Sicherheit / Compliance */}
                      <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.8 }}
                      >
                        <div className="flex items-center gap-3 mb-4">
                          <Shield className="w-6 h-6 text-[#FE9100]" />
                          <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                            <T>Sicherheit / Compliance</T>
                          </h3>
                        </div>
                        <ul className="space-y-2 pl-9">
                          {['Swiss Hosting', 'DSGVO', 'Audit Trails', 'kein US-Transfer'].map((item, i) => (
                            <li key={i} className="text-white/70 flex items-center gap-2">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#FE9100]/60" />
                              <span><T>{item}</T></span>
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </section>
        
        
        {/* ⭐ SECTION 3 - WARUM ARAS? - Ultra Clean Redesign */}
        <section className="relative py-32" style={{ background: 'transparent' }}>
          <div className="max-w-7xl mx-auto">
            {/* Header with Typing Animation */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              {/* Animated Gradient Headline */}
              <motion.h2 
                className="text-5xl md:text-6xl font-black mb-8"
                style={{ 
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(90deg, #ffffff, #e9d7c4, #FE9100, #ff8c00, #FE9100, #e9d7c4, #ffffff)',
                  backgroundSize: '300% 100%',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '50% 50%', '100% 50%', '50% 50%', '0% 50%']
                }}
                transition={{
                  duration: 15,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              >
                <T>Warum Unternehmen ARAS AI einsetzen</T>
              </motion.h2>
              
              {/* Typing Subtitle */}
              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 }}
                className="text-xl md:text-2xl text-white/80 max-w-4xl mx-auto leading-relaxed"
              >
                <p className="mb-4">
                  <T>ARAS AI ist nicht experimentelle KI-Telefonie.</T>
                </p>
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.8 }}
                  className="text-white/60"
                >
                  <T>Es ist eine präzise, stabile, Schweizer Plattform für echte Geschäftsprozesse.</T>
                </motion.p>
              </motion.div>
            </motion.div>
            
            {/* Transparent Cards Grid */}
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  icon: <Mic className="w-10 h-10" />,
                  title: 'Natürlich klingende Stimme',
                  subtitle: 'ohne Übertreibung',
                  desc: 'Die Stimme wirkt ruhig, strukturiert und authentisch – ohne Roboterklang.'
                },
                {
                  icon: <TrendingUp className="w-10 h-10" />,
                  title: 'Skalierung ohne Personalabhängigkeit',
                  subtitle: null,
                  desc: 'Von einzelnen Anrufen bis zu hunderten parallelen Gesprächen, 24/7, konstant.'
                },
                {
                  icon: <Shield className="w-10 h-10" />,
                  title: 'Schweizer Datensicherheit',
                  subtitle: null,
                  desc: 'Alle Daten bleiben in Europa. Keine US-Clouds. Keine Risikoarchitektur. Bereit für interne Audits & Compliance-Abteilungen.'
                }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15, type: 'spring', stiffness: 100 }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className="group relative"
                >
                  {/* Animated Border Container */}
                  <div className="relative p-[2px] rounded-2xl overflow-hidden">
                    {/* Animated Gradient Border */}
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00, #e9d7c4)',
                        backgroundSize: '300% 300%'
                      }}
                      animate={{
                        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                      }}
                      transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                    />
                    
                    {/* Transparent Card Content */}
                    <div 
                      className="relative rounded-2xl p-8"
                      style={{ background: 'rgba(0, 0, 0, 0.9)' }}
                    >
                      {/* Icon with Gradient */}
                      <motion.div 
                        className="mb-6 text-white"
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                      >
                        {item.icon}
                      </motion.div>
                      
                      {/* Title with Gradient on Hover */}
                      <h3 
                        className="text-2xl font-bold mb-3 text-white transition-all duration-300"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        <T>{item.title}</T>
                      </h3>
                      
                      {/* Subtitle */}
                      {item.subtitle && (
                        <motion.p 
                          className="text-sm mb-4 font-semibold"
                          style={{
                            background: 'linear-gradient(90deg, #e9d7c4, #FE9100)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                          }}
                        >
                          <T>{item.subtitle}</T>
                        </motion.p>
                      )}
                      
                      {/* Description */}
                      <p className="text-white/70 leading-relaxed text-base">
                        <T>{item.desc}</T>
                      </p>
                      
                      {/* Subtle Glow on Hover */}
                      <motion.div
                        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 pointer-events-none"
                        style={{
                          background: 'radial-gradient(circle at 50% 50%, rgba(254, 145, 0, 0.1), transparent 70%)',
                          filter: 'blur(20px)'
                        }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* 🎯 FEATURES SECTION - Was ARAS AI heute tut */}
        <section className="relative py-32 px-8 border-t-4 border-[#FE9100]" style={{ background: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="max-w-7xl mx-auto">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-20"
            >
              <h2
                className="text-5xl md:text-6xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #ffd700)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 0 40px rgba(254, 145, 0, 0.3)'
                }}
              >
                Was ARAS AI heute für Ihr Unternehmen tut
              </h2>
              <p className="text-xl text-white/70 max-w-4xl mx-auto leading-relaxed">
                Die Alpha-Version von ARAS vereint Telefonie, Chat-Automatisierung, Analyse und Integrationen in einer einzigen Plattform – entwickelt für echte Geschäftsprozesse, nicht für Experimente.
              </p>
            </motion.div>

            {/* Outbound Telefonie Feature Card */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative group"
            >
              {/* Glow Effect */}
              <motion.div
                className="absolute -inset-4 rounded-3xl blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.2), rgba(255, 215, 0, 0.2))'
                }}
              />

              {/* Main Card */}
              <div
                className="relative rounded-2xl p-10 backdrop-blur-sm border"
                style={{
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderColor: 'rgba(254, 145, 0, 0.2)'
                }}
              >
                {/* Feature Icon & Title */}
                <div className="flex items-center gap-4 mb-6">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                    className="w-16 h-16 rounded-xl flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, #FE9100, #ffd700)',
                    }}
                  >
                    <Phone className="w-8 h-8 text-black" />
                  </motion.div>
                  <div>
                    <h3
                      className="text-3xl font-black"
                      style={{
                        fontFamily: 'Orbitron, sans-serif',
                        background: 'linear-gradient(135deg, #e9d7c4, #FE9100)',
                        backgroundClip: 'text',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                      }}
                    >
                      Outbound Telefonie
                    </h3>
                    <p className="text-white/60 text-sm mt-1">
                      ARAS führt echte Gespräche: klar, strukturiert und natürlich.
                    </p>
                  </div>
                </div>

                {/* Features List */}
                <div className="space-y-4 mb-8">
                  {[
                    'Automatische Lead-Telefonate',
                    'Einwandbehandlung & Gesprächslogik',
                    'Menschlich klingende ARAS Voice Engine',
                    'Terminbuchungen & Weiterleitungen',
                    'Gesprächszusammenfassungen in Echtzeit'
                  ].map((feature, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.1 * index }}
                      className="flex items-center gap-3 group/item"
                    >
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 90 }}
                        className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{
                          background: 'linear-gradient(135deg, #FE9100, #ffd700)'
                        }}
                      >
                        <CheckCircle2 className="w-4 h-4 text-black" />
                      </motion.div>
                      <span className="text-white/80 group-hover/item:text-white transition-colors">
                        {feature}
                      </span>
                    </motion.div>
                  ))}
                </div>

                {/* Highlight Banner */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.8 }}
                  className="relative overflow-hidden rounded-xl p-6"
                  style={{
                    background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.15), rgba(255, 215, 0, 0.15))',
                    border: '2px solid rgba(254, 145, 0, 0.3)'
                  }}
                >
                  <motion.div
                    className="absolute inset-0"
                    animate={{
                      backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                    }}
                    transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
                    style={{
                      background: 'linear-gradient(90deg, transparent, rgba(254, 145, 0, 0.1), transparent)',
                      backgroundSize: '200% 100%'
                    }}
                  />
                  <div className="relative flex items-center gap-4">
                    <motion.div
                      animate={{
                        scale: [1, 1.2, 1],
                        rotate: [0, 5, -5, 0]
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Sparkles className="w-8 h-8 text-[#FE9100]" />
                    </motion.div>
                    <div>
                      <p
                        className="text-xl font-black"
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          background: 'linear-gradient(135deg, #FE9100, #ffd700)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}
                      >
                        Bis zu 10.000 parallele Anrufe mit nur einem Klick möglich!
                      </p>
                      <p className="text-sm text-white/60 mt-1">
                        Skaliere dein Outbound ohne Grenzen – von 1 bis 10.000 Anrufen gleichzeitig.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 🔒 COMPLIANCE & SECURITY SECTION */}
        <section className="relative px-8" style={{ background: 'transparent', paddingTop: '160px', paddingBottom: '160px' }}>
          <div className="max-w-[1500px] mx-auto">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-24"
            >
              <h2
                className="text-5xl md:text-6xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Schweizer Standards für Datenschutz & Sicherheit
              </h2>
              <p className="text-xl text-white/70 max-w-4xl mx-auto leading-relaxed">
                ARAS AI verarbeitet sensible Unternehmens- und Kundenkommunikation.
                Darum basiert die gesamte Plattform auf einem Sicherheitsmodell, das für europäische Unternehmen entwickelt wurde – ohne Abhängigkeit von US-Clouds oder externen Datenpipelines.
              </p>
            </motion.div>

            {/* Security Cards Grid */}
            <ComplianceCards />

            {/* Security Footer Badges */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-wrap justify-center gap-8 mt-24"
            >
              {['ISO-27001 Infrastruktur', 'SOC2 Typ II Hosting', 'EU-only Data Processing'].map((badge, index) => (
                <motion.div
                  key={index}
                  whileHover={{ scale: 1.05 }}
                  className="px-6 py-3 rounded-lg border"
                  style={{
                    borderColor: 'rgba(254, 145, 0, 0.3)',
                    background: 'rgba(254, 145, 0, 0.05)'
                  }}
                >
                  <div
                    className="text-sm font-bold uppercase tracking-wider"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(135deg, #e9d7c4, #FE9100)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    {badge}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* 💎 PRICING & ALPHA ADVANTAGES SECTION */}
        <section className="relative px-8" style={{ background: 'transparent', paddingTop: '160px', paddingBottom: '160px' }}>
          <div className="max-w-[1400px] mx-auto">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-24"
            >
              <h2
                className="text-5xl md:text-6xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #ffd700)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                ARAS Pricing
              </h2>
              <p className="text-xl text-white/70 max-w-2xl mx-auto">
                Wähle den Plan, der zu deinem Unternehmen passt.
              </p>
            </motion.div>

            {/* Pricing Cards */}
            <PricingCards />

            {/* Footer Statement */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-32 text-center"
            >
              <h3
                className="text-2xl font-black mb-4"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Transparent. Fair. Swiss Made.
              </h3>
              <p className="text-lg text-white/70 max-w-3xl mx-auto leading-relaxed">
                Keine versteckten Kosten. Jederzeit kündbar.
                <br />
                <span className="text-white/80 font-semibold">
                  Starte kostenlos und upgrade wenn du bereit bist.
                </span>
              </p>
            </motion.div>
          </div>
        </section>

        {/* 📋 FAQ SECTION */}
        <section className="relative px-8" style={{ background: 'transparent', paddingTop: '160px', paddingBottom: '160px' }}>
          <div className="max-w-[1200px] mx-auto">
            {/* Section Header */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="text-center mb-24"
            >
              <h2
                className="text-5xl md:text-6xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #ffd700)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Häufige Fragen – klar und transparent beantwortet
              </h2>
              <p className="text-xl text-white/70 max-w-4xl mx-auto leading-relaxed">
                Die wichtigsten Fragen rund um ARAS AI, Sicherheit, Telefonie, Preise und technische Funktionsweise.
                <br />
                <span className="text-white/80 font-semibold">Ohne Marketing – nur Fakten.</span>
              </p>
            </motion.div>

            {/* FAQ Accordion */}
            <FAQAccordion />

            {/* Section Footer */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="mt-32 text-center"
            >
              <h3
                className="text-2xl font-black"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  color: '#e9d7c4'
                }}
              >
                Weitere Fragen? Wir sind für Sie da.
              </h3>
            </motion.div>
          </div>
        </section>

        {/* 🏢 TECHNICAL FOOTER & LEGAL COMPLIANCE */}
        <PremiumFooter />

      </div>

      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    </div>
  );
}

// 🔥 ARAS LANDING PAGE CONTENT - Complete Sections
function ArasLandingContent() {
  return (
    <div className="w-full" style={{ background: '#0A0A0C' }}>
      {/* Section 1 - Hero */}
      <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Glow */}
        <div 
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at 65% 50%, rgba(255, 106, 0, 0.15) 0%, transparent 50%)'
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-8 py-32">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            {/* Left Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-10"
            >
              <h1 
                className="text-7xl font-black mb-6"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #fff 0%, #ff6a00 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  lineHeight: 1.1
                }}
              >
                ARAS AI
              </h1>
              <p className="text-3xl text-white/90 font-light leading-relaxed">
                Die neue Generation der KI-Telefonie.
              </p>
              <p className="text-xl text-white/70 leading-relaxed">
                Natürlich klingende Outbound-Calls, intelligente Chat-Automation und ein Schweizer Sicherheitsstandard, dem Unternehmen vertrauen.
              </p>
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-[#ff6a00]/10 border border-[#ff6a00]/30">
                <motion.div
                  className="w-2 h-2 rounded-full bg-[#ff6a00]"
                  animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-sm font-bold text-[#ff6a00]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  ALPHA-PHASE • BEGRENZTE PLÄTZE • LEBENSLANGE PREISE
                </span>
              </div>

              {/* CTA Buttons */}
              <div className="flex gap-4 pt-6">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-lg font-bold text-white"
                  style={{
                    fontFamily: 'Orbitron, sans-serif',
                    background: 'linear-gradient(135deg, #ff6a00, #ff4500)',
                    boxShadow: '0 0 20px rgba(255, 106, 0, 0.4)'
                  }}
                >
                  → Zugang aktivieren
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03, background: 'rgba(255, 106, 0, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  className="px-8 py-4 rounded-lg font-bold border-2 border-[#ff6a00] text-[#ff6a00]"
                  style={{ fontFamily: 'Orbitron, sans-serif' }}
                >
                  → Dokumentation öffnen
                </motion.button>
              </div>
            </motion.div>

            {/* Right - Waveform */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative h-96"
            >
              <svg className="w-full h-full" viewBox="0 0 400 200">
                {[...Array(40)].map((_, i) => (
                  <motion.line
                    key={i}
                    x1={i * 10}
                    x2={i * 10}
                    y1={100}
                    y2={100}
                    stroke="#ff6a00"
                    strokeWidth="2"
                    strokeOpacity="0.4"
                    animate={{
                      y2: [100, 100 - Math.random() * 40 - 10, 100 + Math.random() * 40 + 10, 100]
                    }}
                    transition={{ duration: 2 + Math.random(), repeat: Infinity, ease: 'easeInOut' }}
                  />
                ))}
              </svg>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 2 - Warum ARAS */}
      <section className="relative w-full py-32" style={{ background: 'transparent' }}>
        <div className="max-w-7xl mx-auto px-8">
          <motion.h2 
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl font-black mb-20 text-center"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            Warum Unternehmen ARAS AI einsetzen
          </motion.h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Sparkles className="w-8 h-8" />,
                title: "Menschliche Gesprächsqualität",
                subtitle: "ohne Übertreibung",
                desc: "ARAS AI führt natürliche, kontextbezogene Dialoge. Keine Roboter-Floskeln, keine starren Skripte."
              },
              {
                icon: <Phone className="w-8 h-8" />,
                title: "Skalierbare Telefonie",
                subtitle: "24/7 einsatzbereit",
                desc: "Von Einzelanrufen bis zu parallelen Outbound-Kampagnen. Eine Plattform, die mit deinem Unternehmen mitwächst."
              },
              {
                icon: <Globe className="w-8 h-8" />,
                title: "Schweizer Datensicherheit",
                subtitle: "DSGVO-Konformität",
                desc: "Hosting in zertifizierten EU-Rechenzentren + Schweizer Rechtsrahmen. Keine US-Datenübertragung."
              }
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                whileHover={{ scale: 1.03, y: -5 }}
                className="p-8 rounded-2xl"
                style={{
                  background: '#000',
                  border: '2px solid #ff6a00',
                  boxShadow: '0 4px 20px rgba(255, 106, 0, 0.1)'
                }}
              >
                <div className="mb-6 text-[#ff6a00]">{item.icon}</div>
                <h3 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {item.title}
                </h3>
                <p className="text-sm text-white/70">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3 - Alpha Features */}
      <section className="relative w-full py-32" style={{ background: '#0A0A0C' }}>
        <div className="max-w-7xl mx-auto px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left - Bulletpoints */}
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              <h2 className="text-5xl font-black mb-6" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                Die ARAS Alpha-Version
              </h2>
              <p className="text-xl text-white/90 mb-8">
                voll funktionsfähig, jeden Tag besser.
              </p>
              <p className="text-white/70 leading-relaxed mb-8">
                Wir entwickeln ARAS seit 2021 – jetzt öffnen wir die Plattform erstmals für ausgewählte Unternehmen.
              </p>

              <div className="space-y-4">
                {[
                  "Outbound Calls mit natürlich klingender Stimme",
                  "Chat-Automation (500–10.000 Nachrichten je nach Plan)",
                  "Telefon-Workflows über Make, Zapier oder n8n",
                  "Live-Metriken: Drop-Rate, STT-Qualität, Emotion, Erfolg",
                  "Automatische Gesprächszusammenfassungen",
                  "Erste Version der ARAS Voice Engine"
                ].map((feature, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-6 h-6 text-[#ff6a00] flex-shrink-0 mt-1" />
                    <p className="text-white/80">{feature}</p>
                  </motion.div>
                ))}
              </div>

              <div className="pt-8">
                <div className="p-6 rounded-xl bg-[#ff6a00]/10 border border-[#ff6a00]/30">
                  <p className="text-xl font-bold text-[#ff6a00] mb-2" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Dein Vorteil:
                  </p>
                  <p className="text-white/90">
                    Alle Alpha-Nutzer behalten ihre jetzigen Preise – dauerhaft.
                  </p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.03 }}
                className="px-8 py-4 rounded-lg font-bold text-white"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #ff6a00, #ff4500)',
                  boxShadow: '0 0 20px rgba(255, 106, 0, 0.4)'
                }}
              >
                Alpha-Zugang sichern
              </motion.button>
            </motion.div>

            {/* Right - Dashboard Screenshot Placeholder */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative h-[600px] rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 106, 0, 0.1), rgba(0, 0, 0, 0.5))',
                border: '1px solid rgba(255, 106, 0, 0.3)',
                boxShadow: '0 20px 60px rgba(255, 106, 0, 0.2)'
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <Target className="w-32 h-32 text-[#ff6a00]/20" />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 4 - Pricing */}
      <section className="relative w-full py-32" style={{ background: '#070709' }}>
        <div className="max-w-7xl mx-auto px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <h2 className="text-5xl font-black mb-6" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Unsere Pläne
            </h2>
            <p className="text-xl text-white/70">
              Transparent und fair – für jede Unternehmensgrösse.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            {[
              { name: "ARAS Pro", price: "CHF 59", calls: "100", features: ["Zusammenfassungen", "Voller Plattformzugang"] },
              { name: "ARAS Ultra", price: "CHF 249", calls: "1.000", features: ["200 parallel", "CRM-Integration", "Individuelle Stimme"] },
              { name: "ARAS Ultimate", price: "CHF 1.990", calls: "10.000", features: ["500 parallel", "Eigene Instanz", "24/7 Onboarding"] }
            ].map((plan, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.02, y: -5 }}
                className="relative p-8 rounded-2xl"
                style={{
                  background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.05), rgba(0, 0, 0, 0.8))',
                  border: '2px solid #FE9100',
                  boxShadow: '0 10px 40px rgba(254, 145, 0, 0.15)'
                }}
              >
                <h3 className="text-3xl font-black mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-2 mb-6">
                  <p className="text-4xl font-black text-[#FE9100]">{plan.price}</p>
                  <span className="text-white/50">/ Monat</span>
                </div>
                <p className="text-sm text-white/60 mb-6">{plan.calls} Anrufe pro Monat</p>
                <div className="space-y-3">
                  {plan.features.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-1 h-1 rounded-full bg-[#FE9100]" />
                      <p className="text-sm text-white/70">{f}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center p-10 rounded-2xl"
            style={{
              background: 'linear-gradient(135deg, rgba(254, 145, 0, 0.1), transparent)',
              border: '1px solid rgba(254, 145, 0, 0.3)'
            }}
          >
            <p className="text-2xl font-bold mb-4" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Kostenlos testen
            </p>
            <p className="text-xl text-white/80">
              Starte mit ARAS Free – 2 Calls, 10 Nachrichten, keine Kreditkarte.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Section 5 - Platform Features */}
      <section className="relative w-full py-32" style={{ background: '#0A0A0C' }}>
        <div className="max-w-7xl mx-auto px-8">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl font-black mb-20 text-center"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            Was ARAS AI heute kann
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-12">
            {/* Left - Features */}
            <div className="space-y-8">
              {[
                { title: "Outbound Telefonie", items: ["bis 500 parallele Calls", "menschliche Stimme (ARAS Voice)", "Einwandbehandlung", "Terminbuchung", "Gesprächszusammenfassungen"] },
                { title: "Chat-Automation", items: ["Inbox-Verarbeitung", "Antworten im eigenen Sprachstil", "automatische Kategorisierung", "tägliche Zusammenfassungen"] },
                { title: "Integrationen", items: ["Make", "Zapier", "n8n", "CRM-Sync (Salesforce, HubSpot, Bitrix24)"] },
                { title: "Compliance", items: ["DSGVO", "Schweizer Datenschutz", "EU-Rechenzentren", "Protokollierung & Audit Trails"] }
              ].map((category, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="mb-4">
                    <div className="h-px w-12 bg-[#ff6a00] mb-3" />
                    <h3 className="text-2xl font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                      {category.title}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {category.items.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-white/70">
                        <ArrowRight className="w-4 h-4 text-[#ff6a00]" />
                        <p>{item}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right - Demo Window */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative h-[700px] rounded-2xl p-8 flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255, 106, 0, 0.05), rgba(0, 0, 0, 0.8))',
                border: '1px solid rgba(255, 106, 0, 0.3)',
                boxShadow: '0 0 60px rgba(255, 106, 0, 0.3)'
              }}
            >
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Phone className="w-24 h-24 text-[#ff6a00] mx-auto mb-6" />
                </motion.div>
                <p className="text-xl font-bold" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                  Call läuft...
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Section 6 - Call Flow */}
      <section className="relative w-full py-32" style={{ background: '#070709' }}>
        <div className="max-w-5xl mx-auto px-8">
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-5xl font-black mb-20 text-center"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
          >
            So telefoniert ARAS AI für dich
          </motion.h2>

          <div className="space-y-16">
            {[
              { step: "1", title: "Du gibst einen Auftrag ein", desc: "„Ruf alle Leads aus der Kampagne X an und qualifiziere sie nach Y.“" },
              { step: "2", title: "ARAS analysiert Kontext & Daten", desc: "System erkennt Branche, Position, CRM-Einträge, Priorität." },
              { step: "3", title: "Der Anruf startet automatisch", desc: "Natürlich klingende Stimme, dynamischer Dialog, Einwandbehandlung." },
              { step: "4", title: "Ergebnis in Sekunden", desc: "Gesprächszusammenfassung • Gesprächston • Empfehlung für nächste Schritte" }
            ].map((stage, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.2 }}
                className="flex items-start gap-8"
              >
                <div 
                  className="flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl"
                  style={{
                    background: 'linear-gradient(135deg, #ff6a00, #ff4500)',
                    fontFamily: 'Orbitron, sans-serif',
                    boxShadow: '0 0 30px rgba(255, 106, 0, 0.4)'
                  }}
                >
                  {stage.step}
                </div>
                <div className="flex-1 pt-3">
                  <h3 className="text-2xl font-bold mb-3" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {stage.title}
                  </h3>
                  <p className="text-lg text-white/70">{stage.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 7 - Compliance */}
      <section className="relative w-full py-32" style={{ background: '#0A0A0C' }}>
        <div className="max-w-7xl mx-auto px-8">
          <div 
            className="p-12 rounded-2xl"
            style={{
              background: '#000',
              borderTop: '3px solid #ff6a00'
            }}
          >
            <motion.h2
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-5xl font-black mb-6 text-center"
              style={{ fontFamily: 'Orbitron, sans-serif' }}
            >
              Warum ARAS AI für Compliance-Abteilungen akzeptabel ist
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-xl text-center text-white/70 mb-16 max-w-4xl mx-auto"
            >
              ARAS AI wird vollständig durch eine Schweizer Aktiengesellschaft betrieben. Alle Daten werden in zertifizierten europäischen Rechenzentren verarbeitet.
            </motion.p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { title: "DSGVO-konform", desc: "Datensparsamkeit, Zweckbindung, Löschkonzept." },
                { title: "Swiss Data Hosting", desc: "ISO-27001 • SOC2 • End-to-End verschlüsselt." },
                { title: "Keine US-Datenübertragung", desc: "Kein Transfer in amerikanische Clouds (Schrems II)." },
                { title: "Revisionssichere Protokollierung", desc: "Zugriffe, Anrufe, Ereignisse – alles dokumentiert." },
                { title: "Individuelles Einwilligungs-Management", desc: "Auf Wunsch mit Opt-in-Hinweis & Gesprächsmarkierung." }
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="p-6 rounded-xl bg-white/5 border border-white/10"
                >
                  <h3 className="text-xl font-bold mb-3 text-[#ff6a00]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    {item.title}
                  </h3>
                  <p className="text-white/60 leading-relaxed">{item.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 8 - Final CTA */}
      <section className="relative w-full py-32" style={{ background: '#070709' }}>
        <div className="max-w-5xl mx-auto px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="space-y-10"
          >
            <h2 
              className="text-6xl font-black mb-8"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #fff, #ff6a00)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Teste ARAS AI jetzt in der Alpha
            </h2>
            <p className="text-2xl text-white/80 max-w-3xl mx-auto leading-relaxed">
              Sichere dir lebenslange Early-Access-Preise.
            </p>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Echte Technologie, reale Telefonate, sofort einsetzbar.
            </p>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-12 py-6 rounded-xl font-black text-xl text-white mt-8"
              style={{
                fontFamily: 'Orbitron, sans-serif',
                background: 'linear-gradient(135deg, #ff6a00, #ff4500)',
                boxShadow: '0 0 40px rgba(255, 106, 0, 0.5)'
              }}
            >
              → JETZT KOSTENLOS STARTEN
            </motion.button>

            <p className="text-sm text-white/40 mt-8">
              Begrenzte Plätze • Lebenslange Preise • Keine Vertragsbindung
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

// 🚀 ARAS AI HERO SECTION - Ultra Premium Design
export function ArasHeroSection() {
  const [currentText, setCurrentText] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [displayedText, setDisplayedText] = useState('');
  const [cursorBlink, setCursorBlink] = useState(true);
  const [particleCount] = useState(8);
  
  const typewriterTexts = [
    "a Software",
    "a Token", 
    "an Agent",
    "an Ecosystem",
    "a Revolution"
  ];

  // Typewriter Effect
  useEffect(() => {
    const currentWord = typewriterTexts[currentText];
    const typingSpeed = isDeleting ? 50 : 100;
    
    const timer = setTimeout(() => {
      if (!isDeleting && displayedText === currentWord) {
        setTimeout(() => setIsDeleting(true), 2000);
      } else if (!isDeleting) {
        setDisplayedText(currentWord.substring(0, displayedText.length + 1));
      } else if (displayedText.length > 0) {
        setDisplayedText(currentWord.substring(0, displayedText.length - 1));
      } else {
        setIsDeleting(false);
        setCurrentText((prev) => (prev + 1) % typewriterTexts.length);
      }
    }, typingSpeed);

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, currentText]);

  // Cursor Blink
  useEffect(() => {
    const interval = setInterval(() => {
      setCursorBlink(prev => !prev);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full min-h-screen overflow-hidden" style={{ background: '#0f0f0f' }}>
      {/* Radial Glow Background */}
      <div 
        className="absolute inset-0" 
        style={{
          background: 'radial-gradient(circle at 65% 75%, rgba(254, 145, 0, 0.2) 0%, transparent 50%)',
          filter: 'blur(100px)'
        }}
      />

      {/* Subtle Particles */}
      <div className="absolute inset-0">
        {[...Array(particleCount)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full"
            style={{
              background: i % 2 === 0 ? '#FE9100' : '#e9d7c4',
              opacity: 0.3,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`
            }}
            animate={{
              x: [0, Math.random() * 50 - 25, 0],
              y: [0, Math.random() * 50 - 25, 0],
              opacity: [0.3, 0.6, 0.3]
            }}
            transition={{
              duration: 10 + Math.random() * 5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.5
            }}
          />
        ))}
      </div>

      {/* Main Container with Animated Border */}
      <div className="relative mx-auto max-w-[1600px] px-[180px] py-[120px]">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1 }}
          className="relative rounded-lg p-[1px]"
          style={{
            background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
            backgroundSize: '400% 100%'
          }}
        >
          <motion.div
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
            }}
            transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
            className="absolute inset-0 rounded-lg"
            style={{
              background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
              backgroundSize: '400% 100%',
              filter: 'blur(1px)'
            }}
          />

          <div className="relative rounded-lg" style={{ background: '#0f0f0f' }}>
            <div className="grid grid-cols-2 gap-20 items-center px-16 py-20">
              
              {/* Left Content */}
              <motion.div 
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="space-y-8"
              >
                {/* Main Headline with Gold Gradient */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                >
                  <h1 
                    className="font-black mb-4"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
                      fontWeight: 700,
                      lineHeight: 1.1,
                      background: 'linear-gradient(135deg, #e9d7c4 0%, #FE9100 50%, #a34e00 100%)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundSize: '200% 200%',
                      animation: 'gradientShift 8s ease infinite',
                      textShadow: '0 0 30px rgba(254, 145, 0, 0.2)'
                    }}
                  >
                    ARAS AI
                  </h1>
                  <style dangerouslySetInnerHTML={{
                    __html: `
                      @keyframes gradientShift {
                        0% { background-position: 0% 50%; }
                        50% { background-position: 100% 50%; }
                        100% { background-position: 0% 50%; }
                      }
                    `
                  }} />
                  <p className="text-2xl text-white/90 font-light mt-2">
                    The New Standard of Intelligent Communication
                  </p>
                </motion.div>

                {/* Typewriter Subheadline */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="h-12 flex items-center"
                >
                  <span
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      fontSize: '1.25rem',
                      fontWeight: 500,
                      background: 'linear-gradient(90deg, #e9d7c4, #FE9100)',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent'
                    }}
                  >
                    ARAS is {displayedText}
                    <span 
                      className="inline-block ml-1 w-[3px] h-[24px] bg-[#FE9100] align-middle"
                      style={{ opacity: cursorBlink ? 1 : 0 }}
                    />
                  </span>
                </motion.div>

                {/* Main Description */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="space-y-4 text-white/80 leading-relaxed"
                >
                  <p className="text-lg">
                    Natürlich klingende KI-Telefonate, präzise Automation und Schweizer Datensicherheit.
                  </p>
                  <p className="text-base text-white/60">
                    Eine Plattform für Unternehmen, die modern skalieren – nicht experimentieren.
                  </p>
                </motion.div>

                {/* Alpha Phase Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.2, type: 'spring' }}
                  className="inline-flex items-center gap-3 px-5 py-3 rounded-full"
                  style={{
                    background: 'rgba(254, 145, 0, 0.1)',
                    border: '1px solid rgba(254, 145, 0, 0.3)'
                  }}
                >
                  <motion.div
                    className="w-2 h-2 rounded-full bg-[#FE9100]"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [1, 0.5, 1]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <span className="text-sm font-bold text-[#FE9100]" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    ALPHA PHASE • LEBENSLANGE BESTPREISE
                  </span>
                </motion.div>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.4 }}
                  className="flex gap-4 pt-4"
                >
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-9 py-4 rounded-lg font-semibold text-white transition-all"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'linear-gradient(90deg, #FE9100, #a34e00)',
                      border: '1px solid #FE9100',
                      boxShadow: '0 0 12px rgba(254, 145, 0, 0.35)',
                      letterSpacing: '1px'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(254, 145, 0, 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 0 12px rgba(254, 145, 0, 0.35)';
                    }}
                  >
                    → Zugang aktivieren
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-9 py-4 rounded-lg font-semibold text-[#FE9100] transition-all"
                    style={{
                      fontFamily: 'Orbitron, sans-serif',
                      background: 'transparent',
                      border: '1px solid #FE9100'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(254, 145, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    → Funktionen ansehen
                  </motion.button>
                </motion.div>

                {/* Value Statement */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.6 }}
                  className="pt-8 space-y-2"
                >
                  <p className="text-sm text-white/50 leading-relaxed">
                    ARAS AI führt echte Outbound-Gespräche, qualifiziert Leads, liest E-Mails,<br/>
                    versteht Kontext und verbindet sich nahtlos mit CRM- und Automatisierungs-Systemen.
                  </p>
                  <p className="text-xs text-[#FE9100]/60 font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    Jetzt in der Alpha-Phase. Early Access. Dauerhaft günstige Preise.
                  </p>
                </motion.div>
              </motion.div>

              {/* Right Side - Animated Waveform */}
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.6 }}
                className="relative h-[500px] flex items-center justify-center"
              >
                {/* Waveform Container */}
                <div className="relative w-full h-64">
                  {/* Voice Active Badge */}
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full mb-4"
                  >
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full" 
                      style={{ 
                        border: '1px solid rgba(254, 145, 0, 0.3)',
                        background: 'rgba(254, 145, 0, 0.05)'
                      }}
                    >
                      <motion.div
                        className="w-2 h-2 rounded-full bg-[#FE9100]"
                        animate={{
                          scale: [1, 1.3, 1],
                          opacity: [1, 0.6, 1]
                        }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                      <span className="text-xs font-bold text-[#FE9100] uppercase tracking-wider" 
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        VOICE ACTIVE
                      </span>
                    </div>
                  </motion.div>

                  {/* Animated Waveform Lines */}
                  <svg className="w-full h-full" viewBox="0 0 400 200">
                    {[...Array(40)].map((_, i) => (
                      <motion.line
                        key={i}
                        x1={i * 10}
                        x2={i * 10}
                        y1={100}
                        y2={100}
                        stroke={i % 3 === 0 ? '#FE9100' : '#e9d7c4'}
                        strokeWidth="2"
                        strokeOpacity={i % 3 === 0 ? 0.6 : 0.3}
                        animate={{
                          y2: [
                            100,
                            100 - Math.random() * 60 - 20,
                            100 + Math.random() * 60 + 20,
                            100
                          ]
                        }}
                        transition={{
                          duration: 2 + Math.random() * 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                          delay: i * 0.05
                        }}
                      />
                    ))}
                  </svg>

                  {/* Pulse Effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: 'radial-gradient(circle, rgba(254, 145, 0, 0.1) 0%, transparent 70%)',
                      filter: 'blur(40px)'
                    }}
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.3, 0.6, 0.3]
                    }}
                    transition={{
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  />
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Fine horizontal lines animation */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-full h-[1px]"
            style={{
              background: 'linear-gradient(90deg, transparent, #FE9100, transparent)',
              top: `${30 + i * 20}%`
            }}
            animate={{
              x: [-200, 200, -200]
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>
    </div>
  );
}