import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Phone, MessageSquare, Sparkles, ArrowRight, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { trackCTAClick, trackPageView, captureUTMParameters } from "@/lib/analytics";

export default function Welcome() {
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  const steps = [
    {
      number: "01",
      title: "Deine ersten zwei Testanrufe starten",
      description: "Erlebe selbst, wie ARAS klingt, reagiert und Gespräche führt.",
      icon: <Phone className="w-6 h-6" />,
    },
    {
      number: "02",
      title: "Die Chatfunktion ausprobieren",
      description: "Teste das ARAS-LLM direkt im Browser und stelle beliebige Fragen.",
      icon: <MessageSquare className="w-6 h-6" />,
    },
    {
      number: "03",
      title: "Feedback geben",
      description: "In der Alpha zählt jede Erfahrung. Jede Rückmeldung macht ARAS intelligenter.",
      icon: <Sparkles className="w-6 h-6" />,
    },
  ];

  // Capture UTM parameters and track page view on mount
  useEffect(() => {
    captureUTMParameters();
    trackPageView('/welcome', 'Welcome to ARAS AI');
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  // Countdown Timer Effect
  useEffect(() => {
    const calculateCountdown = () => {
      const launchDate = new Date('2026-01-01T00:00:00').getTime();
      const now = new Date().getTime();
      const distance = launchDate - now;

      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        });
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="h-screen overflow-y-auto bg-black text-white content-zoom">
      {/* Premium Background */}
      <div className="fixed inset-0 opacity-25 pointer-events-none z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-[#FE9100]/12 via-transparent to-[#a34e00]/12" />
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(254, 145, 0, 0.1) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(233, 215, 196, 0.08) 0%, transparent 50%),
                           radial-gradient(circle at 50% 50%, rgba(163, 78, 0, 0.06) 0%, transparent 65%)`
        }} />
        <div className="absolute inset-0 opacity-15" style={{
          backgroundImage: "radial-gradient(#444 1px, transparent 1px)",
          backgroundSize: "25px 25px"
        }} />
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 py-20 md:py-32 pb-32">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.25, 0.8, 0.25, 1] }}
          className="text-center mb-20"
        >
          {/* Main Title */}
          <motion.h1
            className="text-6xl md:text-7xl font-black mb-8 tracking-tight"
            style={{ fontFamily: 'Orbitron, sans-serif' }}
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 0.8, 0.25, 1] }}
          >
            <motion.span
              className="inline-block relative"
              style={{
                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                backgroundSize: '300% 100%',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 40px rgba(254, 145, 0, 0.3))'
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            >
              Willkommen bei ARAS AI
              <motion.div
                className="absolute -inset-8 blur-[60px] opacity-20"
                style={{
                  background: 'radial-gradient(circle, #FE9100 0%, #a34e00 50%, transparent 70%)',
                  zIndex: -1
                }}
                animate={{
                  opacity: [0.15, 0.35, 0.15],
                  scale: [0.95, 1.05, 0.95]
                }}
                transition={{ duration: 4, repeat: Infinity }}
              />
            </motion.span>
          </motion.h1>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.8 }}
            className="space-y-6 text-lg md:text-xl text-gray-300 leading-relaxed max-w-3xl mx-auto"
          >
            <p className="text-2xl font-semibold" style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}>
              Du bist jetzt Teil der Alpha-Generation.
            </p>
            <p>
              Nur ein kleiner Kreis ausgewählter Nutzer erhält Zugang zu dieser Phase. 
              Dein Account ist aktiviert — und ab jetzt formst du aktiv mit, wie die menschlichste 
              KI-Stimme der Welt entsteht.
            </p>
          </motion.div>
        </motion.div>

        {/* CTA Section - MOVED BEFORE ALPHA */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-center mb-20"
        >
          <div className="mb-8">
            <h3 
              className="text-3xl md:text-4xl font-black mb-3"
              style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}
            >
              Bereit? Dann starten wir.
            </h3>
            <p className="text-xl text-gray-400" style={{ fontFamily: 'Orbitron, sans-serif' }}>
              Deine Reise beginnt jetzt.
            </p>
          </div>

          {/* Main CTA Button - ONLY Animated Border, Fully Transparent Inside */}
          <Link href="/space">
            <motion.div className="relative inline-block cursor-pointer">
              {/* Animated Border */}
              <motion.div
                className="absolute -inset-[2px] rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                  backgroundSize: '300% 100%'
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'linear'
                }}
              />
              
              {/* Glow Effect */}
              <motion.div
                className="absolute -inset-[3px] rounded-full opacity-60"
                style={{
                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                  backgroundSize: '300% 100%',
                  filter: 'blur(15px)'
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
                  opacity: [0.5, 0.8, 0.5]
                }}
                transition={{
                  backgroundPosition: { duration: 4, repeat: Infinity, ease: 'linear' },
                  opacity: { duration: 2, repeat: Infinity }
                }}
              />
              
              <motion.div
                onClick={() => {
                  trackCTAClick(
                    'ARAS AI starten!',
                    'welcome',
                    '/space'
                  );
                }}
                whileHover={{ scale: 1.05, y: -3 }}
                whileTap={{ scale: 0.95 }}
                className="relative px-12 py-5 rounded-full font-black text-xl tracking-wide"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'rgba(0, 0, 0, 0.3)',
                  color: '#e9d7c4',
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <span className="relative flex items-center gap-3">
                  ARAS AI starten!
                  <ArrowRight className="w-6 h-6" />
                </span>
              </motion.div>
            </motion.div>
          </Link>
        </motion.div>

        {/* Alpha Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="mb-20"
        >
          <div className="relative">
            <motion.div
              className="absolute -inset-[2px] rounded-3xl opacity-40"
              style={{
                background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                backgroundSize: '300% 100%',
                filter: 'blur(15px)'
              }}
              animate={{
                backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
              }}
              transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            />
            
            <div
              className="relative p-10 md:p-12 rounded-3xl text-center"
              style={{
                background: 'rgba(0, 0, 0, 0.7)',
                backdropFilter: 'blur(30px)',
                border: '1px solid rgba(255, 255, 255, 0.1)'
              }}
            >
              <h3 
                className="text-2xl md:text-3xl font-black mb-6"
                style={{ fontFamily: 'Orbitron, sans-serif', color: '#FE9100' }}
              >
                Alpha bedeutet: echtes Produkt – nicht perfekt.
              </h3>
              
              <div className="space-y-4 text-base md:text-lg text-gray-300 leading-relaxed max-w-3xl mx-auto mb-8">
                <p>
                  Alles, was du hier siehst, ist live in Entwicklung. Updates können täglich erscheinen. 
                  Funktionen können sich verändern. Wir optimieren mit dir — und für dich.
                </p>
              </div>

              {/* Launch Date Badge */}
              <motion.div
                className="inline-flex items-center gap-3 px-8 py-4 rounded-full"
                style={{
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100)',
                  boxShadow: '0 10px 40px rgba(254, 145, 0, 0.3)'
                }}
                animate={{
                  boxShadow: [
                    '0 10px 40px rgba(254, 145, 0, 0.3)',
                    '0 15px 50px rgba(254, 145, 0, 0.5)',
                    '0 10px 40px rgba(254, 145, 0, 0.3)'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <CheckCircle className="w-6 h-6 text-black" />
                <div className="text-left">
                  <p className="text-xs font-semibold text-black/70 uppercase tracking-wider">
                    Offizieller Launch
                  </p>
                  <p className="text-2xl font-black text-black" style={{ fontFamily: 'Orbitron, sans-serif' }}>
                    01.01.2026
                  </p>
                </div>
              </motion.div>

              {/* Countdown Timer */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="mt-8 grid grid-cols-4 gap-4 max-w-md mx-auto"
              >
                {[
                  { label: 'Tage', value: countdown.days },
                  { label: 'Stunden', value: countdown.hours },
                  { label: 'Minuten', value: countdown.minutes },
                  { label: 'Sekunden', value: countdown.seconds }
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + index * 0.1, duration: 0.4 }}
                    className="relative"
                  >
                    <motion.div
                      className="absolute -inset-[1px] rounded-xl opacity-40"
                      style={{
                        background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                        filter: 'blur(6px)'
                      }}
                      animate={{
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: index * 0.2 }}
                    />
                    <div
                      className="relative p-4 rounded-xl text-center"
                      style={{
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(254, 145, 0, 0.3)'
                      }}
                    >
                      <motion.div
                        key={item.value}
                        initial={{ scale: 1.2, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                        className="text-3xl font-black mb-1"
                        style={{
                          fontFamily: 'Orbitron, sans-serif',
                          color: '#FE9100'
                        }}
                      >
                        {String(item.value).padStart(2, '0')}
                      </motion.div>
                      <div className="text-xs uppercase tracking-wider text-gray-400 font-semibold">
                        {item.label}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>

              <p className="text-sm text-gray-400 mt-6">
                Du gehörst zu den Ersten, die ARAS testen. Zum offiziellen Launch erhältst du besondere Vorteile, 
                exklusive Early-Access-Features und einen reduzierten Einstiegspreis.
              </p>
            </div>
          </div>
        </motion.div>


        {/* What You Can Do Section - MOVED DOWN */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.0 }}
          className="mb-20"
        >
          <h2 
            className="text-3xl md:text-4xl font-black mb-12 text-center"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#FE9100' }}
          >
            Was du jetzt tun kannst
          </h2>

          {/* Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.8 + index * 0.15 }}
                className="relative group"
              >
                {/* Animated Border */}
                <motion.div
                  className="absolute -inset-[2px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: activeStep === index 
                      ? 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)'
                      : 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                    backgroundSize: '200% 200%',
                    filter: 'blur(8px)'
                  }}
                  animate={activeStep === index ? {
                    backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
                  } : {}}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />

                {/* Card */}
                <div
                  className={`relative h-full p-8 rounded-2xl transition-all duration-500 ${
                    activeStep === index
                      ? 'bg-gradient-to-br from-[#FE9100]/10 to-[#a34e00]/10'
                      : 'bg-black/60'
                  }`}
                  style={{
                    backdropFilter: 'blur(20px)',
                    border: activeStep === index 
                      ? '1px solid rgba(254, 145, 0, 0.3)' 
                      : '1px solid rgba(255, 255, 255, 0.1)'
                  }}
                >
                  {/* Number Badge */}
                  <motion.div
                    className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-6"
                    style={{
                      background: activeStep === index
                        ? 'linear-gradient(135deg, #e9d7c4, #FE9100)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}
                    animate={activeStep === index ? {
                      boxShadow: [
                        '0 0 20px rgba(254, 145, 0, 0.3)',
                        '0 0 40px rgba(254, 145, 0, 0.5)',
                        '0 0 20px rgba(254, 145, 0, 0.3)'
                      ]
                    } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <span 
                      className="text-2xl font-black"
                      style={{ 
                        fontFamily: 'Orbitron, sans-serif',
                        color: activeStep === index ? '#000000' : '#e9d7c4'
                      }}
                    >
                      {step.number}
                    </span>
                  </motion.div>

                  {/* Icon */}
                  <div className="mb-4" style={{ color: activeStep === index ? '#FE9100' : '#888' }}>
                    {step.icon}
                  </div>

                  {/* Title */}
                  <h3 
                    className="text-xl font-bold mb-4 leading-tight"
                    style={{ 
                      fontFamily: 'Orbitron, sans-serif',
                      color: activeStep === index ? '#e9d7c4' : '#ffffff'
                    }}
                  >
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>


        {/* Recent Updates - Clean Glass Design */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
          className="mb-20"
        >
          <h2 
            className="text-3xl md:text-4xl font-black mb-3 text-center"
            style={{ fontFamily: 'Orbitron, sans-serif', color: '#FE9100' }}
          >
            Was ist neu in ARAS AI?
          </h2>
          <p className="text-center text-gray-400 mb-12 text-sm">
            Täglich neue Features. Live in der Alpha-Phase.
          </p>

          {/* Clean Update Cards - No Icons, Pure Glass */}
          <div className="max-w-5xl mx-auto space-y-3">
            {[
              { title: "Transparent CTA Button Design", desc: "Clean button mit animated border und glow effect", date: "20. Nov" },
              { title: "Welcome Page Flow Optimierung", desc: "CTA positionierung für bessere conversion", date: "20. Nov" },
              { title: "Chat Typing Animation Fix", desc: "Smooth typing ohne message flash", date: "20. Nov" },
              { title: "Message Animation Pipeline", desc: "Optimierte animation trigger ohne doppelte renders", date: "20. Nov" },
              { title: "Chat Streaming UX", desc: "Clean 'denkt nach' state während streaming", date: "20. Nov" },
              { title: "Sidebar Logout Button Fix", desc: "Perfekte positionierung mit flex-shrink-0", date: "19. Nov" },
              { title: "Content Zoom System", desc: "Globale skalierung mit font-size control", date: "19. Nov" },
              { title: "VSCode Tailwind Settings", desc: "Clean IDE ohne CSS warnings", date: "19. Nov" },
              { title: "Premium Auth Design", desc: "Glassmorphism und animated gradients", date: "14. Nov" },
              { title: "ElevenLabs Voice Integration", desc: "Ultra-realistische AI stimme", date: "13. Nov" },
              { title: "Call Audio Recording", desc: "Automatische aufzeichnung aller gespräche", date: "12. Nov" },
              { title: "Live Transkription", desc: "Echtzeit text von allen calls", date: "12. Nov" },
              { title: "Webhook System", desc: "ElevenLabs status updates", date: "12. Nov" },
              { title: "Admin Dashboard", desc: "User management und analytics", date: "11. Nov" },
              { title: "4-Tier Subscription", desc: "Free, Pro, Business, Enterprise", date: "10. Nov" },
              { title: "Usage Tracking", desc: "AI messages und voice calls", date: "10. Nov" },
              { title: "Session Management", desc: "Secure cookie-based auth", date: "10. Nov" },
              { title: "Power Page Redesign", desc: "Animated status und call timer", date: "10. Nov" }
            ].map((update, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.8 + index * 0.05 }}
                className="relative group"
              >
                {/* Subtle hover glow */}
                <motion.div
                  className="absolute -inset-[1px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00)',
                    filter: 'blur(8px)'
                  }}
                />
                
                {/* Glass card */}
                <div
                  className="relative px-6 py-4 rounded-xl transition-all duration-300"
                  style={{
                    background: 'rgba(0, 0, 0, 0.4)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid rgba(255, 255, 255, 0.06)'
                  }}
                >
                  <div className="flex items-center justify-between gap-6">
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 
                        className="font-bold text-white mb-1 text-sm"
                        style={{ fontFamily: 'Orbitron, sans-serif' }}
                      >
                        {update.title}
                      </h4>
                      <p className="text-xs text-gray-500">
                        {update.desc}
                      </p>
                    </div>
                    
                    {/* Date badge */}
                    <div
                      className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap"
                      style={{
                        background: 'rgba(254, 145, 0, 0.08)',
                        border: '1px solid rgba(254, 145, 0, 0.2)',
                        color: '#FE9100'
                      }}
                    >
                      {update.date}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Coming Soon Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.5, duration: 0.6 }}
            className="text-center mt-12"
          >
            <div className="relative inline-block">
              <motion.div
                className="absolute -inset-[2px] rounded-full opacity-40"
                style={{
                  background: 'linear-gradient(90deg, #e9d7c4, #FE9100, #a34e00, #FE9100, #e9d7c4)',
                  backgroundSize: '300% 100%',
                  filter: 'blur(12px)'
                }}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
              />
              <div
                className="relative px-8 py-3 rounded-full"
                style={{
                  background: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(30px)',
                  border: '1px solid rgba(254, 145, 0, 0.2)'
                }}
              >
                <span className="text-sm font-bold" style={{ fontFamily: 'Orbitron, sans-serif', color: '#e9d7c4' }}>
                  Weitere Updates folgen täglich
                </span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Load Orbitron Font */}
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
    </div>
  );
}