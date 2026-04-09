import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ── scroll reveal ── */
function useReveal(t = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, set] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { set(true); io.disconnect(); } }, { threshold: t });
    io.observe(el); return () => io.disconnect();
  }, [t]);
  return { ref, v };
}

export default function WasIstFiaonPage() {
  const heroObs = useReveal(0.1);
  const paradigmObs = useReveal(0.1);
  const architectureObs = useReveal(0.1);
  const methodikObs = useReveal(0.1);
  
  return (
    <div className="min-h-screen text-gray-900 antialiased relative overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "linear-gradient(180deg, #f8fafc 0%, #e0e7ff 30%, #f8fafc 60%, #e0e7ff 100%)" }}>
      {/* Background mesh gradient with blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] opacity-40" style={{ 
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.15), transparent 70%)",
          filter: "blur(100px)"
        }} />
        <div className="absolute bottom-0 right-0 w-[800px] h-[600px] opacity-30" style={{ 
          background: "radial-gradient(ellipse at center, rgba(15,23,42,0.2), transparent 70%)",
          filter: "blur(80px)"
        }} />
      </div>

      <GlassNav activePage="was-ist-fiaon" />
      
      <div className="relative z-10">
        {/* Hero Section */}
        <section ref={heroObs.ref} className="min-h-screen flex flex-col items-center justify-center px-6 pt-28 pb-20">
          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-center tracking-tight mb-8 max-w-5xl leading-[1.2] fiaon-gradient-text-animated">
            Die erste KI-Plattform,<br/>
            die für dich arbeitet.<br/>
            Nicht für die Bank.
          </h1>

          {/* Subline */}
          <p className="text-sm sm:text-base lg:text-lg text-gray-600 text-center max-w-3xl leading-relaxed mb-12">
            Du bist es gewohnt, dass Finanz-Tools kostenlos sind, weil sie dich als Lead an Banken verkaufen. FIAON bricht dieses System. Wir sind eine 100 % unabhängige SaaS-Plattform um DIR zu helfen. Keine Affiliate-Links. Keine Provisionen. Nur Technologie, Insider-Strategien und dein direkter Weg zum Wunschlimit.
          </p>

          {/* CTA Button */}
          <a href="/antrag" className="fiaon-btn-gradient inline-flex items-center gap-3 px-10 py-5 rounded-full text-[17px] font-semibold text-white shadow-2xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 transform hover:scale-105 mb-16">
            Jetzt starten
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>

          {/* 3D Dashboard Mockup */}
          <div className="relative w-full max-w-5xl mx-auto perspective-1000" style={{ perspective: "1000px" }}>
            <div className="fiaon-glass-panel rounded-3xl p-8 border border-white/40 shadow-2xl shadow-blue-900/10 transform rotate-x-12 transition-transform duration-700 hover:rotate-x-8" style={{ 
              background: "linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.8) 100%)",
              transform: "rotateX(12deg) translateY(20px)",
              animation: "float 6s ease-in-out infinite"
            }}>
              {/* Dashboard Header */}
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                </div>
                <div className="text-sm text-gray-500 font-medium">FIAON Dashboard</div>
              </div>

              {/* Dashboard Content Grid */}
              <div className="grid grid-cols-3 gap-6">
                {/* Score Simulator Card */}
                <div className="bg-white/50 rounded-2xl p-6 border border-gray-200/50 backdrop-blur-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Score Simulator</div>
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                      <circle cx="64" cy="64" r="56" stroke="#3b82f6" strokeWidth="8" fill="none" 
                        strokeDasharray="352" 
                        strokeDashoffset="88"
                        strokeLinecap="round"
                        style={{ animation: "progressRing 2s ease-out forwards" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">75%</span>
                    </div>
                  </div>
                  <div className="text-center text-sm text-gray-600">Optimiert</div>
                </div>

                {/* Limit Timeline Card */}
                <div className="bg-white/50 rounded-2xl p-6 border border-gray-200/50 backdrop-blur-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Limit-Aufbau</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Start</span>
                      <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: "100%" }}></div>
                      </div>
                      <span className="text-xs font-medium text-gray-900">500€</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Ziel</span>
                      <div className="flex-1 mx-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-purple-500 to-purple-600 rounded-full" style={{ width: "80%", animation: "progressGrow 2s ease-out forwards 0.5s" }}></div>
                      </div>
                      <span className="text-xs font-medium text-gray-900">20k€</span>
                    </div>
                  </div>
                </div>

                {/* Strategy Card */}
                <div className="bg-white/50 rounded-2xl p-6 border border-gray-200/50 backdrop-blur-sm">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-4">Strategie</div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500"></div>
                      <span className="text-xs text-gray-700">KI-Analyse aktiv</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                      <span className="text-xs text-gray-700">Limit-Optimierung</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                      <span className="text-xs text-gray-700">Scoring-Boost</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Paradigmenwechsel Section */}
        <section ref={paradigmObs.ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0a1628 0%, #1a3560 50%, #0a1628 100%)" }}>
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[800px] h-[500px] opacity-20" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.15), transparent 70%)", filter: "blur(100px)" }} />
            <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] opacity-15" style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.1), transparent 70%)", filter: "blur(80px)" }} />
          </div>

          <div className={`max-w-[1120px] mx-auto px-6 relative z-10 transition-all duration-700 ${paradigmObs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {/* Section Badge */}
            <div className="mb-12">
              <span className="inline-block px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-white/20 text-blue-400 text-[13px] font-semibold tracking-widest uppercase rounded-full">
                DAS PROBLEM MIT DEM MARKT
              </span>
            </div>

            {/* Split Layout */}
            <div className="grid lg:grid-cols-2 gap-16 items-start mb-12">
              {/* Left side - Massive Headline */}
              <div className="text-white">
                <h2 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] fiaon-gradient-text-animated -ml-4">
                  Das System war nie<br/>
                  für dich ausgelegt.<br/>
                  Wir haben ein neues<br/>
                  gebaut.
                </h2>
              </div>

              {/* Right side - Text Block */}
              <div className="text-gray-300 text-lg leading-relaxed space-y-6">
                <p>
                  Banken verdienen an deinen Zinsen, nicht an deinem Fortschritt. Vergleichsportale verdienen an deinem Klick, egal ob die Karte wirklich zu dir passt oder nicht. Du bist in der Finanzindustrie traditionell das Produkt.
                </p>
                <p>
                  Bei FIAON drehen wir den Spieß um. Du bezahlst unsere Software, damit unsere Software ausschließlich für dich arbeitet. Kein Algorithmus, der von Banken bezahlt wird. Keine versteckten Agenden.
                </p>
              </div>
            </div>

            {/* Checkmarks */}
            <div className="grid md:grid-cols-3 gap-8 mt-16">
              <div className="flex items-center gap-3" style={{
                animation: paradigmObs.v ? "fadeInUp 0.6s ease-out forwards 0.3s" : "none",
                opacity: paradigmObs.v ? 1 : 0,
                transform: paradigmObs.v ? "translateY(0)" : "translateY(20px)"
              }}>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-lg shadow-white/20">
                  <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white font-medium">100 % unabhängig von Banken</span>
              </div>

              <div className="flex items-center gap-3" style={{
                animation: paradigmObs.v ? "fadeInUp 0.6s ease-out forwards 0.5s" : "none",
                opacity: paradigmObs.v ? 1 : 0,
                transform: paradigmObs.v ? "translateY(0)" : "translateY(20px)"
              }}>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-lg shadow-white/20">
                  <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white font-medium">Keine Affiliate-Provisionen</span>
              </div>

              <div className="flex items-center gap-3" style={{
                animation: paradigmObs.v ? "fadeInUp 0.6s ease-out forwards 0.7s" : "none",
                opacity: paradigmObs.v ? 1 : 0,
                transform: paradigmObs.v ? "translateY(0)" : "translateY(20px)"
              }}>
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-lg shadow-white/20">
                  <svg className="w-4 h-4 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-white font-medium">Fokus auf deinen Score, nicht auf Sales</span>
              </div>
            </div>
          </div>
        </section>

        {/* Die Drei Säulen Section */}
        <section ref={architectureObs.ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)" }}>
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[800px] h-[500px] opacity-20" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.08), transparent 70%)", filter: "blur(120px)" }} />
            <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] opacity-15" style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.06), transparent 70%)", filter: "blur(100px)" }} />
          </div>

          <div className={`max-w-[1120px] mx-auto px-6 relative z-10 transition-all duration-700 ${architectureObs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            {/* Section Badge */}
            <div className="mb-12">
              <span className="inline-block px-5 py-2.5 bg-white/60 backdrop-blur-xl border border-blue-200 text-[#2563eb] text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
                DIE ARCHITEKTUR
              </span>
            </div>

            {/* Headline */}
            <div className="text-center mb-16">
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 fiaon-gradient-text-animated mb-4">
                Nicht nur ein Tool.<br/>
                Ein komplettes Ökosystem.
              </h2>
            </div>

            {/* Bento-Box Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1 - Left, Tall */}
              <div className="fiaon-glass-panel rounded-3xl p-8 border border-white/60 shadow-xl shadow-blue-900/5 hover:shadow-blue-900/10 transition-all duration-300 md:row-span-2"
                   style={{
                     animation: architectureObs.v ? "fadeInUp 0.6s ease-out forwards" : "none",
                     opacity: architectureObs.v ? 1 : 0,
                     transform: architectureObs.v ? "translateY(0)" : "translateY(20px)"
                   }}>
                {/* Premium Data Visualization */}
                <div className="mb-6 relative">
                  <div className="w-full aspect-square rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 flex items-center justify-center relative overflow-hidden p-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-600/5" />
                    {/* Network visualization */}
                    <div className="relative z-10 w-full h-full">
                      {/* Center node */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 shadow-2xl shadow-blue-500/30 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm" />
                      </div>
                      {/* Orbiting nodes */}
                      <div className="absolute top-1/4 left-1/4 w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-500/20" style={{ animation: "orbit 4s linear infinite" }} />
                      <div className="absolute bottom-1/4 right-1/4 w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 shadow-lg shadow-purple-500/20" style={{ animation: "orbit 5s linear infinite reverse" }} />
                      <div className="absolute top-1/3 right-1/3 w-5 h-5 rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 shadow-lg shadow-indigo-500/20" style={{ animation: "orbit 6s linear infinite" }} />
                      {/* Connection lines */}
                      <svg className="absolute inset-0 w-full h-full opacity-30">
                        <line x1="50%" y1="50%" x2="25%" y2="25%" stroke="url(#gradient1)" strokeWidth="2" />
                        <line x1="50%" y1="50%" x2="75%" y2="75%" stroke="url(#gradient2)" strokeWidth="2" />
                        <line x1="50%" y1="50%" x2="66%" y2="33%" stroke="url(#gradient3)" strokeWidth="2" />
                        <defs>
                          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#3b82f6" />
                            <stop offset="100%" stopColor="#8b5cf6" />
                          </linearGradient>
                          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                          <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#3b82f6" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3 fiaon-gradient-text-animated">Die KI-Engine</h3>
                <p className="text-sm text-blue-500 font-semibold tracking-wide uppercase mb-4">Der Navigator</p>
                <p className="text-gray-600 leading-relaxed">
                  Die FIAON-Engine gleicht dein Finanzprofil in Millisekunden mit hunderten Parametern des Marktes ab. Sie zeigt dir blind, wo dein Limit-Potenzial wirklich liegt und warum du bisher unter Wert liegst.
                </p>
              </div>

              {/* Card 2 - Right Top, Wide */}
              <div className="fiaon-glass-panel rounded-3xl p-8 border border-white/60 shadow-xl shadow-blue-900/5 hover:shadow-blue-900/10 transition-all duration-300"
                   style={{
                     animation: architectureObs.v ? "fadeInUp 0.6s ease-out forwards 0.2s" : "none",
                     opacity: architectureObs.v ? 1 : 0,
                     transform: architectureObs.v ? "translateY(0)" : "translateY(20px)"
                   }}>
                {/* Premium Growth Chart */}
                <div className="mb-6 relative">
                  <div className="w-full aspect-[2/1] rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-600/10 flex items-center justify-center relative overflow-hidden p-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-600/5" />
                    <div className="relative z-10 w-full h-full">
                      {/* Chart bars */}
                      <div className="flex items-end justify-between h-full gap-3 px-2">
                        <div className="flex-1 bg-gradient-to-t from-purple-500/30 to-purple-400/60 rounded-t-lg" style={{ height: "40%" }} />
                        <div className="flex-1 bg-gradient-to-t from-purple-500/40 to-purple-400/70 rounded-t-lg" style={{ height: "55%" }} />
                        <div className="flex-1 bg-gradient-to-t from-purple-500/50 to-purple-400/80 rounded-t-lg" style={{ height: "70%" }} />
                        <div className="flex-1 bg-gradient-to-t from-purple-500/60 to-pink-500/90 rounded-t-lg" style={{ height: "85%" }} />
                        <div className="flex-1 bg-gradient-to-t from-pink-500/70 to-pink-400/95 rounded-t-lg" style={{ height: "100%" }} />
                      </div>
                      {/* Growth line */}
                      <svg className="absolute inset-0 w-full h-full">
                        <path d="M 10 80 Q 30 60 50 50 T 90 30 T 130 20" stroke="url(#growthGradient)" strokeWidth="3" fill="none" strokeLinecap="round" />
                        <defs>
                          <linearGradient id="growthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#8b5cf6" />
                            <stop offset="100%" stopColor="#ec4899" />
                          </linearGradient>
                        </defs>
                      </svg>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3 fiaon-gradient-text-animated">Das Credit-Building</h3>
                <p className="text-sm text-purple-500 font-semibold tracking-wide uppercase mb-4">Der Muskel</p>
                <p className="text-gray-600 leading-relaxed">
                  Das Herzstück. Wir haben die effektivsten US-Kreditkarten-Strategien für den europäischen Markt adaptiert. Du lernst, wann du Anträge stellst, wie du Limits hebelst und Cashflow durch Karten optimierst.
                </p>
              </div>

              {/* Card 3 - Right Bottom, Wide */}
              <div className="fiaon-glass-panel rounded-3xl p-8 border border-white/60 shadow-xl shadow-blue-900/5 hover:shadow-blue-900/10 transition-all duration-300"
                   style={{
                     animation: architectureObs.v ? "fadeInUp 0.6s ease-out forwards 0.4s" : "none",
                     opacity: architectureObs.v ? 1 : 0,
                     transform: architectureObs.v ? "translateY(0)" : "translateY(20px)"
                   }}>
                {/* Premium Dashboard UI */}
                <div className="mb-6 relative">
                  <div className="w-full aspect-[2/1] rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 flex items-center justify-center relative overflow-hidden p-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-orange-600/5" />
                    <div className="relative z-10 w-full h-full">
                      {/* Dashboard mockup */}
                      <div className="grid grid-cols-2 gap-3 h-full">
                        {/* Metric card 1 */}
                        <div className="bg-white/40 rounded-lg p-3 backdrop-blur-sm border border-white/50">
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Score</div>
                          <div className="text-lg font-bold text-gray-900">78%</div>
                        </div>
                        {/* Metric card 2 */}
                        <div className="bg-white/40 rounded-lg p-3 backdrop-blur-sm border border-white/50">
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Limit</div>
                          <div className="text-lg font-bold text-gray-900">12.5k</div>
                        </div>
                        {/* Progress bar */}
                        <div className="col-span-2 bg-white/40 rounded-lg p-3 backdrop-blur-sm border border-white/50">
                          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Fortschritt</div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-amber-500 to-orange-600 rounded-full" style={{ width: "75%" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-3 fiaon-gradient-text-animated">Das Dashboard</h3>
                <p className="text-sm text-amber-500 font-semibold tracking-wide uppercase mb-4">Das Cockpit</p>
                <p className="text-gray-600 leading-relaxed">
                  Deine Fortschritte, deine Timeline, deine nächsten Schritte. Das FIAON-Dashboard ist dein persönlicher Kommando-Stand, der sich jeden Monat mit dir weiterentwickelt.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* DIE METHODIK Section */}
        <section ref={methodikObs.ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 50%, #f8fafc 100%)" }}>
          {/* Background effects */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-[800px] h-[500px] opacity-20" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.08), transparent 70%)", filter: "blur(120px)" }} />
            <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] opacity-15" style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.06), transparent 70%)", filter: "blur(100px)" }} />
          </div>

          <div className="max-w-[1280px] mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Premium Dashboard Mockup */}
              <div className="relative lg:col-span-1">
                <div className="relative -ml-6 lg:-ml-12">
                  {/* Dashboard container with overlapping effect */}
                  <div className="fiaon-glass-panel rounded-3xl p-8 border border-white/60 shadow-2xl shadow-blue-900/10 relative overflow-hidden"
                       style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)" }}>
                    {/* Dashboard Header */}
                    <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200/50">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                      </div>
                      <div className="text-sm text-gray-500 font-medium">FIAON Methodik</div>
                    </div>

                    {/* Timeline Visualization */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
                          01
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900 mb-1">US-Systematik</div>
                          <div className="text-xs text-gray-500">Credit-Building als Wissenschaft</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-purple-500/20">
                          02
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900 mb-1">Europäische Anpassung</div>
                          <div className="text-xs text-gray-500">Schufa-Mechanismen integriert</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-amber-500/20">
                          03
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-900 mb-1">Software-Implementierung</div>
                          <div className="text-xs text-gray-500">Automatisierte Strategie</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Progress indicator */}
                    <div className="mt-6 pt-6 border-t border-gray-200/50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">System-Integration</span>
                        <span className="text-xs font-bold text-gray-900">100%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-amber-500 rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>
                  </div>

                  {/* Decorative overlapping elements */}
                  <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-600/10 backdrop-blur-sm border border-white/60 shadow-xl" />
                  <div className="absolute -top-4 -left-4 w-16 h-16 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/10 backdrop-blur-sm border border-white/60 shadow-lg" />
                </div>
              </div>

              {/* Right: Text Block */}
              <div className="lg:col-span-1">
                {/* Section Badge */}
                <div className="mb-8">
                  <span className="inline-block px-5 py-2.5 bg-white/60 backdrop-blur-xl border border-blue-200 text-[#2563eb] text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
                    UNSERE METHODIK
                  </span>
                </div>

                {/* Headline */}
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 fiaon-gradient-text-animated mb-8 leading-[1.1]">
                  Credit-Building:<br/>
                  Der Import eines<br/>
                  Milliarden-Dollar-Systems.
                </h2>

                {/* Text */}
                <div className="text-lg text-gray-600 leading-relaxed space-y-6">
                  <p>
                    In den USA ist "Credit-Building" kein Fremdwort, sondern Schulfach. Der strategische Aufbau von Kreditlinien und Bonitäts-Scores ist dort eine systematische Wissenschaft. Wer die Regeln kennt, fliegt First Class und hebelt sein Business. Wer sie nicht kennt, zahlt drauf.
                  </p>
                  <p>
                    Europa hing hier jahrelang zurück. "Kreditkarte beantragen und hoffen" war die Norm. FIAON beendet das. Wir haben die Systematik des US-Marktes entschlüsselt, auf die europäische Scoring-Landschaft (inklusive Schufa-Mechanismen) übertragen und in eine Software gegossen. Du musst die Banken nicht mehr bitten. Du musst sie nur verstehen.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% {
            transform: rotateX(12deg) translateY(20px);
          }
          50% {
            transform: rotateX(12deg) translateY(10px);
          }
        }
        
        @keyframes progressRing {
          from {
            stroke-dashoffset: 352;
          }
          to {
            stroke-dashoffset: 88;
          }
        }
        
        @keyframes progressGrow {
          from {
            width: 0%;
          }
          to {
            width: 80%;
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes orbit {
          from {
            transform: rotate(0deg) translateX(30px) rotate(0deg);
          }
          to {
            transform: rotate(360deg) translateX(30px) rotate(-360deg);
          }
        }
      `}</style>

      <PremiumFooter />
    </div>
  );
}
