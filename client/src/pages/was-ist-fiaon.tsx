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

/* ── animated gradient headline ── */
function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

export default function WasIstFiaonPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav />
      
      <div className="max-w-[1120px] mx-auto px-6 py-20">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-4 inline-block">ÜBER FIAON</span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6">
            <GradientText>Was ist FIAON?</GradientText>
          </h1>
          <p className="text-xl text-gray-500 max-w-3xl mx-auto">
            Entdecke die Plattform, die deine finanzielle Zukunft verändert
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-16">
          {/* Section 1 */}
          <section ref={useReveal(0.1).ref} className="fiaon-glass-panel rounded-3xl p-8 sm:p-12">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-6 fiaon-gradient-text-animated">
              FIAON ist kein Vergleichsportal. FIAON ist dein System.
            </h2>
            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              Eine KI-Analyse-Software, ein strategisches Coaching-Programm und ein persönliches Finance-Dashboard — in einer Plattform. Wir zeigen dir nicht einfach Karten. Wir zeigen dir, wie du die bekommst, die du wirklich willst.
            </p>
            <p className="text-lg text-gray-600 leading-relaxed">
              Wir verkaufen keine Finanzprodukte. Wir verkaufen das Wissen, die Tools und die Strategie, damit du sie dir selbst holst.
            </p>
          </section>

          {/* Section 2 - Three Pillars */}
          <section ref={useReveal(0.1).ref} className="grid md:grid-cols-3 gap-8">
            <div className="fiaon-glass-panel rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">KI-Analyse</h3>
              <p className="text-gray-600">
                Intelligente Algorithmen analysieren dein Profil und zeigen dir den optimalen Weg.
              </p>
            </div>

            <div className="fiaon-glass-panel rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Strategisches Coaching</h3>
              <p className="text-gray-600">
                Persönliche Beratung und Strategien, die dich langfristig erfolgreich machen.
              </p>
            </div>

            <div className="fiaon-glass-panel rounded-2xl p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3">Finance-Dashboard</h3>
              <p className="text-gray-600">
                Alles an einem Ort: Übersicht, Analyse und Kontrolle deiner finanziellen Situation.
              </p>
            </div>
          </section>

          {/* Section 3 - Mission */}
          <section ref={useReveal(0.1).ref} className="fiaon-glass-panel rounded-3xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold mb-6 fiaon-gradient-text-animated">
              Unsere Mission
            </h2>
            <p className="text-xl text-gray-600 leading-relaxed max-w-3xl mx-auto mb-8">
              Wir glauben, dass jeder Zugang zu fairen Finanzprodukten verdient — unabhängig von Scoring, Einkommen oder Vorgeschichte. FIAON gibt dir die Werkzeuge, die du brauchst, um deine Ziele zu erreichen.
            </p>
            <a href="/antrag" className="fiaon-btn-gradient inline-flex items-center gap-2 px-8 py-4 rounded-full text-[16px] font-medium text-white">
              Jetzt starten
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </section>
        </div>
      </div>
    </div>
  );
}
