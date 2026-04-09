import GlassNav from "@/components/GlassNav";

export default function PlattformKonzept() {
  return (
    <div className="min-h-screen text-white antialiased relative overflow-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Deep Navy to Black Background with Mesh Gradient Animation */}
      <div className="fixed inset-0" style={{ background: "linear-gradient(135deg, #0a1628 0%, #1a1a2e 50%, #0f0f23 100%)" }}>
        {/* Mesh Gradient Animation */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-[1200px] h-[800px] opacity-30" style={{
            background: "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.1), transparent 70%)",
            filter: "blur(120px)",
            animation: "meshGradient 20s ease-in-out infinite"
          }} />
          <div className="absolute bottom-0 right-0 w-[1000px] h-[700px] opacity-25" style={{
            background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.12), rgba(59, 130, 246, 0.08), transparent 70%)",
            filter: "blur(100px)",
            animation: "meshGradient 25s ease-in-out infinite reverse"
          }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] opacity-20" style={{
            background: "radial-gradient(ellipse at center, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.08), transparent 70%)",
            filter: "blur(80px)",
            animation: "meshGradient 30s ease-in-out infinite"
          }} />
        </div>
      </div>

      <GlassNav activePage="plattform-konzept" />

      {/* Hero Section */}
      <section className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Section Badge */}
          <div className="mb-8">
            <span className="inline-block px-6 py-3 bg-white/10 backdrop-blur-xl border border-blue-400/30 text-blue-300 text-[14px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/20">
              UNSER KONZEPT
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8 leading-[1.1] fiaon-gradient-text-animated">
            Wir bauen Technologie.<br/>
            Keine Vermittlungs-Fallen.
          </h1>

          {/* Subline */}
          <p className="text-lg sm:text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
            Erfahre, wie die FIAON-Engine unter der Haube funktioniert. Keine Affiliate-Links, keine versteckten Provisionen, keine regulatorischen Grauzonen. Wir sind ein 100 % reines Software- und Daten-Unternehmen. Deine Finanzen, unsere Algorithmen.
          </p>
        </div>
      </section>

      <style>{`
        @keyframes meshGradient {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(30px, -30px) scale(1.1);
          }
          50% {
            transform: translate(-20px, 20px) scale(1);
          }
          75% {
            transform: translate(20px, 30px) scale(1.05);
          }
        }
      `}</style>
    </div>
  );
}
