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

      {/* THE ENGINE Section */}
      <section className="relative z-10 py-20 sm:py-28 px-6">
        <div className="max-w-[1280px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left: Text Block */}
            <div className="lg:col-span-1">
              {/* Section Badge */}
              <div className="mb-8">
                <span className="inline-block px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-blue-400/30 text-blue-300 text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/20">
                  DEEP TECH
                </span>
              </div>

              {/* Headline */}
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8 leading-[1.1] fiaon-gradient-text-animated">
                200 Datenpunkte.<br/>
                Ein Algorithmus.<br/>
                Keine Kompromisse.
              </h2>

              {/* Text */}
              <div className="text-lg text-gray-400 leading-relaxed space-y-6">
                <p>
                  Unsere proprietäre Engine basiert nicht auf einfachen Filtern. Wir haben komplexe Scoring-Modelle aus dem US-amerikanischen Credit-Building adaptiert und für den europäischen Markt digitalisiert. Die KI berechnet Wahrscheinlichkeiten, Cashflow-Gaps und Scoring-Hebel in Echtzeit.
                </p>
                <p>
                  Wir bearbeiten keine "Kreditanträge". Wir betreiben keine Schuldenberatung. Wir sind dein persönlicher, datengetriebener Analyst. Die Software liefert dir die rohen Fakten und die strategische Auswertung. Die Umsetzung liegt bei dir.
                </p>
              </div>
            </div>

            {/* Right: Data Processing Visualization */}
            <div className="lg:col-span-1">
              <div className="relative">
                {/* Glassmorphism Card */}
                <div className="fiaon-glass-panel rounded-3xl p-8 border border-white/20 shadow-2xl shadow-blue-500/20 relative overflow-hidden"
                     style={{ background: "rgba(15, 23, 42, 0.6)", backdropFilter: "blur(20px)" }}>
                  
                  {/* Processing Ring */}
                  <div className="relative w-full aspect-square flex items-center justify-center mb-6">
                    {/* Outer Ring */}
                    <div className="absolute inset-0 rounded-full border-2 border-blue-500/30" style={{ animation: "spin 8s linear infinite" }} />
                    {/* Middle Ring */}
                    <div className="absolute inset-4 rounded-full border border-blue-400/40" style={{ animation: "spin 6s linear infinite reverse" }} />
                    {/* Inner Ring */}
                    <div className="absolute inset-8 rounded-full border border-blue-300/50" style={{ animation: "spin 4s linear infinite" }} />
                    
                    {/* Processing Center */}
                    <div className="relative z-10 w-32 h-32 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-2xl shadow-blue-500/40 flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-white mb-1">200</div>
                        <div className="text-xs text-blue-200 uppercase tracking-wider">Datenpunkte</div>
                      </div>
                    </div>
                  </div>

                  {/* Data Flow Animation */}
                  <div className="space-y-3">
                    {/* Data Block 1 */}
                    <div className="relative h-12 rounded-lg overflow-hidden" style={{ background: "rgba(37, 99, 235, 0.1)" }}>
                      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-l" />
                      <div className="absolute inset-y-0 left-4 flex items-center">
                        <div className="w-full h-1 bg-gradient-to-r from-blue-500/60 to-transparent rounded" style={{ animation: "dataFlow 3s ease-in-out infinite" }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-blue-300 font-mono">SCORING_MODEL_V2.0</span>
                      </div>
                    </div>

                    {/* Data Block 2 */}
                    <div className="relative h-12 rounded-lg overflow-hidden" style={{ background: "rgba(37, 99, 235, 0.08)" }}>
                      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-blue-400 to-blue-500 rounded-l" />
                      <div className="absolute inset-y-0 left-4 flex items-center">
                        <div className="w-3/4 h-1 bg-gradient-to-r from-blue-400/60 to-transparent rounded" style={{ animation: "dataFlow 3.5s ease-in-out infinite 0.5s" }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-blue-300 font-mono">CASHFLOW_ANALYSIS</span>
                      </div>
                    </div>

                    {/* Data Block 3 */}
                    <div className="relative h-12 rounded-lg overflow-hidden" style={{ background: "rgba(37, 99, 235, 0.06)" }}>
                      <div className="absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-blue-300 to-blue-400 rounded-l" />
                      <div className="absolute inset-y-0 left-4 flex items-center">
                        <div className="w-1/2 h-1 bg-gradient-to-r from-blue-300/60 to-transparent rounded" style={{ animation: "dataFlow 4s ease-in-out infinite 1s" }} />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-blue-300 font-mono">PROBABILITY_ENGINE</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Decorative Elements */}
                <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm border border-white/20 shadow-xl" />
                <div className="absolute -top-4 -left-4 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-400/20 to-blue-500/20 backdrop-blur-sm border border-white/20 shadow-lg" />
              </div>
            </div>
          </div>
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
        
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes dataFlow {
          0% {
            transform: translateX(-100%);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateX(200%);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
