import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";

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

      <GlassNav />
      
      <div className="relative z-10">
        {/* Hero Section */}
        <section ref={useReveal(0.1).ref} className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
          {/* Section Badge */}
          <div className="mb-8">
            <span className="inline-block px-6 py-3 bg-white/60 backdrop-blur-xl border border-blue-200 text-[#2563eb] text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
              ● DIE PLATTFORM
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold text-center tracking-tight mb-8 max-w-5xl leading-[1.2] fiaon-gradient-text-animated">
            Die erste KI-Plattform,<br/>
            die für dich arbeitet.<br/>
            Nicht für die Bank.
          </h1>

          {/* Subline */}
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 text-center max-w-3xl leading-relaxed mb-12">
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
      `}</style>
    </div>
  );
}
