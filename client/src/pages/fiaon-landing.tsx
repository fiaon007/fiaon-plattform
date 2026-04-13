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

/* ── animated gradient headline ── */
function GradientText({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

/* ── packages ── */
const PACKS = [
  { name: "FIAON Starter", fee: "7,99", lim: "500", bg: "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats: ["KI-Profilanalyse (Basis-Scan)", "Kartenkompass: Markt-Matching", "Credit-Building Grundmodul", "Digitales Strategie-Dashboard"] },
  { name: "FIAON Pro", fee: "59,99", lim: "5.000", rec: true, bg: "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats: ["Vollst&auml;ndiges Credit-Building System", "KI-Matching mit Score-Prognose", "Dynamischer Score-Simulator", "Limit-Aufbau-Strategie (12 Monate)"] },
  { name: "FIAON Ultra", fee: "79,99", lim: "15.000", bg: "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats: ["Premium Coaching (Meilen & Cashback)", "Multi-Karten-Portfolio-Struktur", "Individueller Optimierungs-Algorithmus", "Exklusive Strategie-Sessions"] },
  { name: "FIAON High End", fee: "99,99", lim: "25.000", bg: "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats: ["1-on-1 Strategy-Director (Monatlich)", "VIP International Credit Building", "Individuelle Limit-Roadmap (High-End)", "24/7 Dedicated Concierge-Support"] },
];

const BUSINESS_PACKS = [
  { name: "FIAON Starter", tier: "Paket 1", lim: "10.000", bg: "linear-gradient(135deg,#64748b,#94a3b8,#cbd5e1)", feats: ["KI-Unternehmensanalyse (Basis)", "Business-Kartenkompass", "Credit-Building f&uuml;r Gr&uuml;nder", "Digitales Finance-Dashboard"] },
  { name: "FIAON Business", tier: "Paket 2", lim: "25.000", bg: "linear-gradient(135deg,#b8923a,#d4af37,#e8d085)", feats: ["Erweiterte Cashflow-Analyse", "Strategie f&uuml;r Limit-Aufstockungen", "Strikte Trennung von Privat & Business", "Monatliches Business-Coaching"] },
  { name: "FIAON Executive", tier: "Paket 3", lim: "50.000", rec: true, bg: "linear-gradient(135deg,#0b1628,#1a3560,#1e4070)", feats: ["Multi-Karten-Struktur (z.B. f&uuml;r GmbHs)", "Cashflow-Strategieberatung", "Meilen- & Reisekosten-Optimierung", "Priority Business Support"] },
  { name: "FIAON Black", tier: "Paket 4", lim: "100.000", bg: "linear-gradient(135deg,#111,#1a1a1a,#2a2a2a)", feats: ["Dedizierter Account Manager", "Sub-Account- & Mitarbeiter-Strategie", "Premium-Module (Internationale Limits)", "24/7 VIP Business-Support"] },
];

/* ────────────────────────────────
   CREDIT CARD
   ──────────────────────────────── */
function Card({ bg, lim, label, className = "", size = "normal" }: { bg: string; lim: string; label?: string; className?: string; size?: "normal" | "hero" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const move = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const b = ref.current.getBoundingClientRect();
    setR({ x: ((e.clientY - b.top) / b.height - .5) * -10, y: ((e.clientX - b.left) / b.width - .5) * 10 });
  };
  const isHero = size === "hero";

  return (
    <div ref={ref} className={className} onMouseMove={move} onMouseLeave={() => setR({ x: 0, y: 0 })} style={{ perspective: 900 }}>
      <div className="w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none" style={{
        background: bg, border: "1px solid rgba(255,255,255,.1)",
        boxShadow: isHero
          ? "0 40px 80px -20px rgba(0,0,0,.35), 0 20px 40px -10px rgba(0,0,0,.2), 0 0 0 1px rgba(255,255,255,.05) inset"
          : "0 20px 50px -10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.05) inset",
        transform: `rotateX(${r.x}deg) rotateY(${r.y}deg)`,
        transition: r.x === 0 ? "transform .5s cubic-bezier(.22,1,.36,1)" : "none",
      }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,.3), transparent 55%)", mixBlendMode: "overlay" }} />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,.5) 50px, rgba(255,255,255,.5) 51px)" }} />

        <div className={`absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10`}>
          <div className="flex justify-between items-start">
            <div className={`rounded ${isHero ? "w-12 h-9" : "w-10 h-7"}`} style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
            <span className="text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>FIAON</span>
          </div>
          <div>
            <div className={`text-[8px] uppercase tracking-[.14em] font-medium mb-0.5`} style={{ color: "rgba(255,255,255,.35)" }}>{label || ""}</div>
            <div className={`font-mono text-lg font-semibold`} style={{ color: "rgba(255,255,255,.9)" }}>ZIEL: {lim} €</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Nav is now the shared GlassNav component */

/* ────────────────────────────────
   HERO — centered, like screenshot
   ──────────────────────────────── */
function Hero() {
  const [showModal, setShowModal] = useState(false);

  return (
    <section className="relative pt-[110px] sm:pt-[130px] pb-12 sm:pb-20 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-30 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.1), transparent 70%)" }} />

      <div className="max-w-[1120px] mx-auto px-6 text-center relative z-10">
        {/* Badge */}
        <a href="#pakete" className="inline-flex items-center gap-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors mb-8 group">
          Bereits &uuml;ber + 1.200 aktive Nutzer diesen Monat.
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>

        {/* Headline */}
        <h1 className="text-[2.5rem] sm:text-[3.2rem] md:text-[3.8rem] lg:text-[4.2rem] font-semibold leading-[1.08] tracking-tight mb-6">
          <GradientText>Dein 25.000&euro; Limit.</GradientText><br/>
          <GradientText>Ohne Kompromisse.</GradientText>
        </h1>

        {/* Sub */}
        <p className="text-[15px] sm:text-[16px] text-gray-400 leading-relaxed max-w-[520px] mx-auto mb-8">
          Schluss mit dem Blindflug bei Banken. FIAON ist die KI-gest&uuml;tzte Credit-Building-Software, die dein Finanzprofil analysiert und dir den exakten strategischen Fahrplan f&uuml;r Premium-Limits aufzeigt.
        </p>

        {/* CTA */}
        <div className="mb-3">
          <button onClick={() => setShowModal(true)} className="fiaon-btn-gradient inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-medium text-white transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-blue-500/30 animate-[gradientShift_3s_ease-in-out_infinite]">
            Konto er&ouml;ffnen
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
        <p className="text-[12px] text-gray-400 font-medium mb-14">Keine SCHUFA-Abfrage</p>

        {/* Card */}
        <div className="max-w-[420px] sm:max-w-[480px] mx-auto fiaon-card-float">
          <Card bg="linear-gradient(145deg,#0d1b2a,#1a2d44,#0d1b2a)" lim="25.000" size="hero" />
        </div>
      </div>

      {/* Customer Type Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-md p-8 rounded-3xl fiaon-glass-panel animate-[scaleIn_.3s_ease]">
            {/* Animated gradient overlay */}
            <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
              <div className="absolute inset-0 opacity-20" style={{
                background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(147,197,253,0.25), rgba(37,99,235,0.12), rgba(147,197,253,0.18))",
                backgroundSize: "300% 300%",
                animation: "limitGlow 8s ease-in-out infinite"
              }} />
            </div>

            <div className="relative z-10">
              <h3 className="text-2xl font-semibold tracking-tight mb-2 fiaon-gradient-text-animated">Kundenart wählen</h3>
              <p className="text-[14px] text-gray-500 mb-8">Für wen möchtest du einen Antrag stellen?</p>

              <div className="space-y-4">
                <a
                  href="/antrag"
                  onClick={() => setShowModal(false)}
                  className="group relative block p-5 rounded-2xl fiaon-glass-panel hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
                >
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity" style={{
                      background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.08))",
                      backgroundSize: "200% 200%",
                      animation: "limitGlow 6s ease-in-out infinite"
                    }} />
                  </div>
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#3b82f6] flex items-center justify-center text-white">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-gray-900">Privatkunde</p>
                      <p className="text-[13px] text-gray-500">Für persönliche Anliegen</p>
                    </div>
                  </div>
                </a>

                <a
                  href="/business-antrag"
                  onClick={() => setShowModal(false)}
                  className="group relative block p-5 rounded-2xl fiaon-glass-panel hover:scale-[1.02] hover:shadow-xl transition-all duration-300"
                >
                  <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                    <div className="absolute inset-0 opacity-15 group-hover:opacity-25 transition-opacity" style={{
                      background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.08))",
                      backgroundSize: "200% 200%",
                      animation: "limitGlow 6s ease-in-out infinite"
                    }} />
                  </div>
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#1e40af] to-[#2563eb] flex items-center justify-center text-white">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
                    </div>
                    <div>
                      <p className="text-[16px] font-semibold text-gray-900">Geschäftskunde</p>
                      <p className="text-[13px] text-gray-500">Für Unternehmen & Firmenkunden</p>
                    </div>
                  </div>
                </a>
              </div>

              <button onClick={() => setShowModal(false)} className="mt-6 w-full py-3 rounded-xl fiaon-glass-panel text-[13px] font-medium text-gray-600 hover:bg-white/60 transition-all">
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ────────────────────────────────
   NUMBERS
   ──────────────────────────────── */
function Numbers() {
  const items = [["12.400+","Beratungen"],["25.000 \u20AC","Max. Limit"],["< 2 Min","Antrag starten"],["4,9 / 5","Bewertung"]];
  return (
    <section className="py-10 sm:py-12 border-y border-gray-100">
      <div className="max-w-[1120px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
        {items.map(([v,l],i) => <div key={i} className="text-center"><div className="text-lg sm:text-xl font-semibold text-gray-900 tracking-tight">{v}</div><div className="text-[11px] sm:text-[12px] text-gray-400 mt-0.5 font-medium">{l}</div></div>)}
      </div>
    </section>
  );
}

/* ────────────────────────────────
   WHY FIAON
   ──────────────────────────────── */
function WhySection() {
  const obs = useReveal();
  const items = [
    { t: "Radikal unabh&auml;ngig", d: "Wir sind kein Makler und nehmen null Provisionen von Banken. Unsere Engine scannt dein Profil neutral und liefert dir ungesch&ouml;nte, datenbasierte Insights statt versteckter Affiliate-Deals." },
    { t: "Ziel-Limits bis 25.000 &euro;", d: "Statt auf Gl&uuml;ck zu hoffen, nutzt du unser US-erprobtes Credit-Building-System. Wir zeigen dir den exakten strategischen Fahrplan, um dir Premium-Limits systematisch selbst aufzubauen." },
    { t: "100 % Schufaneutral", d: "Unsere KI-Profilanalyse und der Score-Simulator arbeiten v&ouml;llig isoliert. Wir holen keine Ausk&uuml;nfte ein &ndash; dein echter SCHUFA-Score bleibt zu 100 % unangetastet und sicher." },
    { t: "Das globale Premium-Setup", d: "Wir analysieren Kartenstrategien f&uuml;r maximale finanzielle Freiheit. Lerne, wie du dir Portfolios aufbaust, die dir weltweit Akzeptanz, Lounge-Zug&auml;nge und fehlende Fremdw&auml;hrungsgeb&uuml;hren sichern." },
    { t: "Setup in unter 2 Minuten", d: "Keine Filiale, kein Papierkram, keine Bankberater. Du erstellst dein Profil, und die Software generiert dein pers&ouml;nliches Analyse-Dashboard in unter 120 Sekunden. Alles online." },
    { t: "Banken-Niveau Sicherheit", d: "Deine Finanzdaten sind dein wertvollstes Asset. AES-256 Verschl&uuml;sselung, ausschlie&szlig;lich europ&auml;ische Server (EU-Hosting) und die jederzeitige One-Click-L&ouml;schung garantieren volle Kontrolle." },
  ];
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">DAS FIAON SYSTEM</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">&gt; <GradientText>Wir liefern die Technologie. Du holst das Limit.</GradientText></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">FIAON ist deine unabh&auml;ngige Software-Plattform f&uuml;r datenbasiertes Credit-Building. Keine Bank, kein Makler &ndash; nur reine Strategie.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {items.map((f, i) => (
            <div key={i} className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
              </div>
              <h3 className="text-[15px] font-semibold text-gray-900 mb-1">{f.t}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   PACKAGES — more space, bigger cards
   ──────────────────────────────── */
function Packages() {
  const obs = useReveal(0.05);
  const [customerType, setCustomerType] = useState<"private" | "business">("private");
  const currentPacks = customerType === "private" ? PACKS : BUSINESS_PACKS;
  const applicationUrl = customerType === "private" ? "/antrag" : "/business-antrag";

  return (
    <section id="pakete" className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-10">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">{customerType === "business" ? "BUSINESS SETUP" : "DEIN SETUP"}</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4">
            {customerType === "business" ? <GradientText>Ihre strategische Firmen-Bonit&auml;t</GradientText> : <GradientText>W&auml;hle deine Strategie</GradientText>}
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">
            {customerType === "business" ? "Von 10.000 &euro; bis 100.000 &euro; Limit-Ziel &mdash; strukturiert, skalierbar und sauber getrennt vom Privatverm&ouml;gen." : "Vom ersten Score-Aufbau bis zum Premium-Portfolio. W&auml;hle das Software-Setup, das zu deinem Limit-Ziel passt."}
          </p>
        </div>

        {/* Customer Type Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex rounded-xl p-1 fiaon-glass-panel">
            <button
              onClick={() => setCustomerType("private")}
              className={`px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-300 ${customerType === "private" ? "bg-white text-[#2563eb] shadow-md" : "text-gray-500 hover:text-gray-700"}`}
            >
              Privatkunde
            </button>
            <button
              onClick={() => setCustomerType("business")}
              className={`px-6 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-300 ${customerType === "business" ? "bg-white text-[#2563eb] shadow-md" : "text-gray-500 hover:text-gray-700"}`}
            >
              Geschäftskunde
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {currentPacks.map((p, i) => (
            <div key={p.name} className={`relative rounded-2xl bg-white border overflow-hidden transition-all duration-700 hover:-translate-y-1.5 hover:shadow-xl ${p.rec ? "border-[#2563eb]/25 shadow-lg shadow-blue-500/8 ring-1 ring-[#2563eb]/10" : "border-gray-100 hover:border-gray-200"} ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 90}ms` }}>
              {p.rec && <div className="absolute -top-0 left-0 right-0 h-[2px] bg-[#2563eb]" />}
              {p.rec && customerType === "business" && <div className="absolute top-3 right-4 text-[9px] font-bold uppercase tracking-wider text-white bg-[#2563eb] px-2.5 py-1 rounded-full z-10">Beliebt</div>}

              {/* Card */}
              <div className="p-5 sm:p-6">
                <Card bg={p.bg} lim={p.lim} label={customerType === "business" && "tier" in p ? p.tier : undefined} className="w-full" />
              </div>

              {/* Content */}
              <div className="px-5 sm:px-6 pb-6">
                {customerType === "business" && "tier" in p && <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{p.tier}</p>}
                <h3 className={`${customerType === "business" ? "text-[17px]" : "text-[15px]"} font-semibold text-gray-900 mb-2`}>{p.name}</h3>
                {customerType === "business" ? (
                  <p className="text-[14px] text-gray-500 mb-4 pb-4 border-b border-gray-100">Limits bis zu <span className="text-[#2563eb] font-semibold">{p.lim}&nbsp;€</span></p>
                ) : (
                  <div className="flex items-center gap-3 mb-3">
                    {p.rec && <span className="text-[9px] font-semibold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded">Empfohlen</span>}
                  </div>
                )}

                <ul className="space-y-2.5 mb-6">
                  {p.feats.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                      <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <a href={applicationUrl} className={`block w-full text-center py-3 rounded-xl text-[13px] font-semibold transition-all ${customerType === "business" ? (p.rec ? "fiaon-btn-gradient text-white hover:shadow-lg" : (p.name === "FIAON Business" || p.name === "FIAON Black" ? "bg-[#0b1628] text-white hover:bg-[#142744] hover:shadow-lg" : "text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100")) : (p.rec ? "fiaon-btn-gradient text-white hover:shadow-lg" : "text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100")}`} style={{ letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
                  Konto er&ouml;ffnen &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   APPLICATION PROCESS — HIGH END
   ──────────────────────────────── */
function ApplicationProcess() {
  const obs = useReveal(0.1);
  const steps = [
    { n: "01", t: "Paket wählen", d: "Wähle dein gewünschtes FIAON Paket mit passendem Limit." },
    { n: "02", t: "Daten eingeben", d: "Persönliche Daten, Beruf & Finanzen – verschlüsselt übertragen." },
    { n: "03", t: "Bonitätsprüfung", d: "Echtzeit-Analyse deiner Daten – dauert nur wenige Sekunden." },
    { n: "04", t: "Limit erhalten", d: "Dein personalisiertes Kreditlimit wird sofort angezeigt." },
    { n: "05", t: "Vertrag annehmen", d: "Unterschrift digital – dein Vertrag ist sofort bereit." },
  ];
  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={obs.ref}>
      {/* Premium animated background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] opacity-[0.04]" style={{ 
          background: "radial-gradient(ellipse, #2563eb, transparent 70%)",
          animation: "pulse 10s ease-in-out infinite"
        }} />
        <div className="absolute top-0 right-0 w-[400px] h-[400px] opacity-[0.02]" style={{
          background: "radial-gradient(circle, #3b82f6, transparent 60%)",
          animation: "pulse 8s ease-in-out infinite reverse"
        }} />
      </div>

      <div className="max-w-[1280px] mx-auto px-6 relative z-10">
        <div className="max-w-3xl mb-20 text-center">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[.2em] uppercase mb-4">Antragprozess</p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-6">
            <span className="fiaon-gradient-text-animated">In 5 Schritten zur Karte</span>
          </h2>
          <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-2xl mx-auto">
            Digital, sicher und in unter 2 Minuten – so einfach geht's.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
          {steps.map((s, i) => (
            <div key={i} className={`relative transition-all duration-1000 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`} style={{ transitionDelay: `${i * 120}ms` }}>
              {/* Premium card with enhanced effects */}
              <div className="relative p-8 rounded-3xl fiaon-glass-panel hover:scale-[1.03] hover:shadow-2xl transition-all duration-500 group">
                {/* Multi-layer gradient overlay */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 opacity-20" style={{
                    background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(147,197,253,0.25), rgba(37,99,235,0.12), rgba(147,197,253,0.18))",
                    backgroundSize: "300% 300%",
                    animation: "limitGlow 8s ease-in-out infinite"
                  }} />
                  <div className="absolute inset-0 opacity-10" style={{
                    background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8), transparent 70%)"
                  }} />
                </div>

                <div className="relative z-10">
                  {/* Premium step number */}
                  <div className="text-[48px] font-bold mb-5 tracking-tight" style={{
                    background: "linear-gradient(135deg, #1e40af, #2563eb, #3b82f6, #60a5fa)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    opacity: 0.25,
                    letterSpacing: "-0.02em"
                  }}>
                    {s.n}
                  </div>

                  {/* Title */}
                  <h3 className="text-[16px] font-semibold text-gray-900 mb-3 tracking-tight">{s.t}</h3>

                  {/* Description */}
                  <p className="text-[14px] text-gray-500 leading-relaxed font-medium">{s.d}</p>
                </div>

                {/* Premium connector line */}
                {i < steps.length - 1 && (
                  <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-[2px] hidden lg:block" style={{
                    background: "linear-gradient(90deg, #2563eb, rgba(37,99,235,0.2))",
                    boxShadow: "0 0 20px rgba(37,99,235,0.3)"
                  }} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Premium CTA */}
        <div className="mt-20 text-center">
          <a href="/antrag" className="fiaon-btn-outline-animated inline-flex items-center gap-3 px-10 py-4.5 rounded-full text-[16px] font-semibold text-[#2563eb] border-2 border-[#2563eb]/20 hover:border-[#2563eb]/40 transition-all duration-300 hover:scale-105">
            Jetzt starten
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   HOW IT WORKS
   ──────────────────────────────── */
function HowItWorks() {
  const obs = useReveal(0.1);
  const steps = [
    { n: "01", t: "Antrag starten", d: "Beantworte ein paar einfache Fragen. Dauert unter 2 Minuten." },
    { n: "02", t: "Angebot erhalten", d: "Wir pr\u00FCfen dein Profil und empfehlen die passende Kreditkarte." },
    { n: "03", t: "Karte beantragen", d: "Zufrieden? Wir leiten dich direkt zum Anbieter weiter." },
  ];
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Ablauf</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><GradientText>In 3 Schritten zur passenden Karte</GradientText></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">Kein Papierkram, keine Filiale. Alles digital.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 120}ms` }}>
              <div className="text-[48px] font-semibold text-blue-50 leading-none mb-3">{s.n}</div>
              <h3 className="text-[15px] font-semibold text-gray-900 mb-2">{s.t}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   TESTIMONIALS
   ──────────────────────────────── */
function Reviews() {
  const obs = useReveal(0.1);
  const [visibleReviews, setVisibleReviews] = useState(0);
  
  const allReviews = [
    { n: "Lena M.", r: "Unternehmerin", t: "FIAON hat mir in 10 Minuten geholfen, die richtige Karte für mein Business zu finden." },
    { n: "Tobias K.", r: "Freelancer", t: "Die Beratung war wirklich neutral. Keine versteckten Kosten, keine Tricks." },
    { n: "Sara W.", r: "Angestellte", t: "Endlich jemand, der mir erklärt hat, welche Karte zu meiner Situation passt." },
    { n: "Markus R.", r: "Selbstständiger", t: "Der Vergleich ist transparent. Ich weiß genau, was ich bekomme." },
    { n: "Julia B.", r: "Studentin", t: "Auch als Studentin habe ich eine passende Karte gefunden." },
    { n: "Alexander P.", r: "Geschäftsführer", t: "Für unser Unternehmen genau das Richtige. Schnelle Abwicklung." },
    { n: "Nina S.", r: "Designerin", t: "Das Design der Seite ist modern, die Beratung ist professionell." },
    { n: "David H.", r: "IT-Spezialist", t: "Alles digital, keine Papierkram. Genau wie ich es wollte." },
    { n: "Maria L.", r: "Lehrerin", t: "Endlich durchblick im Kreditkarten-Dschungel. Danke FIAON!" },
    { n: "Stefan K.", r: "Vertriebler", t: "Die Cashback-Features sind genial. Spare jeden Monat Geld." },
    { n: "Anna M.", r: "Architektin", t: "Der Lounge-Zugang bei Reisen ist ein echtes Highlight." },
    { n: "Christian W.", r: "Consultant", t: "Der VIP-Support ist erstklassig. Immer schnell erreichbar." },
    { n: "Laura D.", r: "Marketing", t: "Die Empfehlung war perfekt. Genau das, was ich suchte." },
    { n: "Felix B.", r: "Developer", t: "Transparente Kosten, keine Überraschungen. So sollte es sein." },
    { n: "Sophie T.", r: "HR-Managerin", t: "Auch für unsere Mitarbeiter hat FIAON passende Lösungen." },
    { n: "Patrick S.", r: "Unternehmer", t: "Die Limit-Empfehlung war realistisch und fair." },
    { n: "Isabella R.", r: "Reisebegeisterte", t: "Mit der Reise-Versicherung fühle ich mich sicher unterwegs." },
    { n: "Maximilian H.", r: "Investor", t: "Professionelle Beratung, kein Verkaufsgespräch. Sehr gut." },
    { n: "Emma K.", r: "Studentin", t: "Kostenlos und unverbindlich – das überzeugt." },
    { n: "Jonas M.", r: "Musiker", t: "Der Concierge-Service ist ein echtes Premium-Feature." },
    { n: "Carla P.", r: "Freiberuflerin", t: "Schnell, einfach, transparent. So habe ich es mir gewünscht." },
    { n: "Leon W.", r: "Start-up-Gründer", t: "Für Start-ups die beste Lösung. Flexible Limits." },
    { n: "Vanessa G.", r: "Designerin", t: "Die Seite ist einzigartig. Modern und übersichtlich." },
    { n: "Tim L.", r: "Athlet", t: "NFC funktioniert perfekt. Bezahlen war noch nie so einfach." },
  ];

  const [currentReviews, setCurrentReviews] = useState(allReviews.slice(0, 3));

  useEffect(() => {
    if (!obs.v) return;
    
    const interval = setInterval(() => {
      setCurrentReviews(prev => {
        const currentIndex = allReviews.findIndex(r => r === prev[0]);
        const nextIndex = (currentIndex + 3) % allReviews.length;
        return allReviews.slice(nextIndex, nextIndex + 3);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [obs.v, allReviews]);

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden" ref={obs.ref}>
      {/* Subtle background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] opacity-8" style={{
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.08), transparent 70%)",
          filter: "blur(60px)",
          animation: "limitGlow 12s ease-in-out infinite"
        }} />
      </div>

      <div className="relative z-10 max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[.2em] uppercase mb-3">Kundenstimmen</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4 fiaon-gradient-text-animated">
            Was unsere Kunden sagen
          </h2>
        </div>

        <div className={`grid md:grid-cols-3 gap-6 ${obs.v ? "animate-[fadeInUp_.6s_ease]" : "opacity-0"}`}>
          {currentReviews.map((r, i) => (
            <div 
              key={r.n}
              className={`relative p-6 rounded-2xl fiaon-glass-panel hover:scale-[1.02] hover:shadow-xl transition-all duration-500`}
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              {/* Animated gradient overlay */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-15" style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.2), rgba(37,99,235,0.08), rgba(147,197,253,0.15))",
                  backgroundSize: "300% 300%",
                  animation: "limitGlow 8s ease-in-out infinite"
                }} />
              </div>

              <div className="relative z-10">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} width="14" height="14" viewBox="0 0 20 20" fill="#2563eb" opacity=".7">
                      <path d="M10 1l2.47 5.01L18 6.76l-4 3.9.94 5.49L10 13.77l-4.94 2.38L6 10.66l-4-3.9 5.53-.75z"/>
                    </svg>
                  ))}
                </div>
                <p className="text-[14px] text-gray-600 leading-relaxed mb-5">&bdquo;{r.t}&ldquo;</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#3b82f6] flex items-center justify-center text-[12px] font-medium text-white">
                    {r.n[0]}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium text-gray-900">{r.n}</div>
                    <div className="text-[11px] text-gray-400">{r.r}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   FAQ
   ──────────────────────────────── */
function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    ["Vergibt FIAON selbst Kreditkarten?", "Nein. FIAON ist ein Beratungsservice. Die Karte wird vom jeweiligen Partnerinstitut ausgegeben."],
    ["Wird eine SCHUFA-Abfrage durchgef\u00FChrt?", "Bei der Erstberatung nicht. Erst bei der finalen Beantragung beim Anbieter kann eine Pr\u00FCfung stattfinden."],
    ["Was kostet die Beratung?", "Die Erstberatung ist kostenlos. Die Geb\u00FChren beziehen sich auf das Kreditkarten-Paket beim Anbieter."],
    ["Welche Limits sind m\u00F6glich?", "Je nach Paket: 500 \u20AC bis 25.000 \u20AC."],
    ["F\u00FCr wen ist FIAON geeignet?", "F\u00FCr Privatpersonen, Selbstst\u00E4ndige und Unternehmen."],
    ["Wie schnell erhalte ich meine Karte?", "Digitale Karte oft sofort. Physische Karte in 3\u20135 Werktagen."],
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-[680px] mx-auto px-6">
        <div className="mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight"><GradientText>H&auml;ufige Fragen</GradientText></h2>
        </div>
        <div className="space-y-2">
          {items.map(([q, a], i) => (
            <div key={i} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4">
                <span className="text-[14px] font-medium text-gray-900">{q}</span>
                <svg className={`shrink-0 w-4 h-4 text-gray-400 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-5 pb-4"><p className="text-[13px] text-gray-500 leading-relaxed">{a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   PROBLEMSTELLUNG
   ──────────────────────────────── */
function ProblemSection() {
  const obs = useReveal(0.1);
  
  const painCards = [
    {
      title: "Ihr Antrag wurde abgelehnt.",
      description: "Millionen Deutsche werden jedes Jahr von ihrer Hausbank abgelehnt. Nicht weil sie kein Geld haben — sondern weil sie keine Strategie haben.",
      highlight: "ABGELEHNT"
    },
    {
      title: "Welche Karte ist die richtige?",
      description: "Hunderte Angebote. Unverständliche Konditionen. Vergleichsportale, die an deinem Klick verdienen — nicht an deinem Erfolg.",
      highlight: "VERWIRRT"
    },
    {
      title: "Mein Limit ist ein Witz.",
      description: "500 € Limit bei 3.000 € Nettoeinkommen. Kommt dir bekannt vor? Das Problem ist nicht dein Gehalt. Es ist dein Scoring-Profil.",
      highlight: "FRUSTRIERT"
    }
  ];

  return (
    <section id="problem" ref={obs.ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #0a1628 0%, #1a3560 50%, #0a1628 100%)" }}>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[400px] opacity-20" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.15), transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[350px] opacity-15" style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.1), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className={`max-w-[1120px] mx-auto px-6 relative z-10 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left side - Headline */}
          <div className="text-white">
            <div className="mb-6">
              <span className="text-[13px] font-medium text-blue-400 tracking-wide uppercase">PROBLEMSTELLUNG</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-[1.15] tracking-tight mb-6">
              Du suchst keine Kreditkarte.<br/>
              Du suchst jemanden, der dir zeigt,<br/>
              wie du sie bekommst.
            </h2>
          </div>

          {/* Right side - Pain Cards */}
          <div className="space-y-5">
            {painCards.map((card, index) => (
              <div 
                key={index}
                className="fiaon-glass-panel rounded-2xl p-8 border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden"
                style={{
                  animationDelay: `${index * 150}ms`,
                  animation: obs.v ? "fadeInUp 0.6s ease-out forwards" : "none",
                  opacity: obs.v ? 1 : 0,
                  transform: obs.v ? "translateY(0)" : "translateY(20px)"
                }}
              >
                {/* Animated highlight text */}
                <div className="absolute top-4 right-4 text-[72px] font-bold text-white/5 leading-none select-none"
                     style={{
                       animation: `pulse 3s ease-in-out infinite ${index * 0.5}s`
                     }}>
                  {card.highlight}
                </div>
                
                {/* Content */}
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold mb-3 tracking-tight fiaon-gradient-text-animated" 
                      style={{
                        animation: obs.v ? `slideIn 0.8s ease-out ${index * 0.2 + 0.3}s forwards` : "none",
                        opacity: 0
                      }}>
                    {card.title}
                  </h3>
                  <p className="text-[15px] text-gray-200 leading-relaxed"
                     style={{
                       animation: obs.v ? `fadeIn 0.8s ease-out ${index * 0.2 + 0.5}s forwards` : "none",
                       opacity: 0
                     }}>
                    {card.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
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
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 0.05;
          }
          50% {
            opacity: 0.08;
          }
        }
      `}</style>
    </section>
  );
}

/* ────────────────────────────────
   WAS IST FIAON
   ──────────────────────────────── */
function WasIstFiaonSection() {
  const obs = useReveal(0.1);
  
  const features = [
    {
      title: "KI-Analyse",
      description: "Intelligente Algorithmen analysieren dein Profil"
    },
    {
      title: "Finance-Dashboard",
      description: "Persönliche Übersicht und Kontrolle"
    },
    {
      title: "Strategisches Coaching",
      description: "Insider-Strategien für deinen Erfolg"
    }
  ];
  
  return (
    <section ref={obs.ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #e0e7ff 50%, #f8fafc 100%)" }}>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[500px] opacity-30" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.1), transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] opacity-20" style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.08), transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <div className={`max-w-[1120px] mx-auto px-6 relative z-10 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {/* Section Badge */}
        <div className="mb-12">
          <span className="inline-block px-5 py-2.5 bg-white/60 backdrop-blur-xl border border-blue-200 text-[#2563eb] text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
            DIE PLATTFORM
          </span>
        </div>

        {/* Split Layout */}
        <div className="grid lg:grid-cols-2 gap-16 items-center mb-16">
          {/* Left side - Text */}
          <div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8 text-gray-900 fiaon-gradient-text-animated">
              FIAON ist kein Vergleichsportal.<br/>
              FIAON ist dein System.
            </h2>
            
            <div className="space-y-6">
              <p className="text-xl text-gray-700 leading-relaxed">
                Eine KI-Analyse-Software, ein strategisches Coaching-Programm und ein persönliches Finance-Dashboard — in einer Plattform.
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Wir zeigen dir nicht einfach Karten. Wir zeigen dir, wie du die bekommst, die du wirklich willst.
              </p>
              <p className="text-xl text-gray-700 leading-relaxed">
                Wir verkaufen keine Finanzprodukte. Wir verkaufen das Wissen, die Tools und die Strategie, damit du sie dir selbst holst.
              </p>
            </div>

            {/* Button */}
            <div className="mt-10">
              <a href="/was-ist-fiaon" className="fiaon-btn-gradient inline-flex items-center gap-3 px-10 py-4 rounded-full text-[17px] font-semibold text-white shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-300 transform hover:scale-105">
                Mehr erfahren
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
            </div>
          </div>

          {/* Right side - Feature Cards */}
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="fiaon-glass-panel rounded-2xl p-8 border border-white/50 hover:border-blue-200 transition-all duration-300 relative overflow-hidden"
                style={{
                  animationDelay: `${index * 150}ms`,
                  animation: obs.v ? `fadeInUp 0.6s ease-out forwards` : "none",
                  opacity: obs.v ? 1 : 0,
                  transform: obs.v ? "translateY(0)" : "translateY(20px)"
                }}
              >
                {/* Animated gradient background */}
                <div className="absolute inset-0 opacity-0 hover:opacity-10 transition-opacity duration-300"
                     style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(147,197,253,0.3))" }}
                />
                
                <div className="relative z-10">
                  <h3 className="text-2xl font-bold text-gray-900 mb-3 fiaon-gradient-text-animated">{feature.title}</h3>
                  <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
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
      `}</style>
    </section>
  );
}

/* ────────────────────────────────
   FEATURES OVERVIEW
   ──────────────────────────────── */
function FeaturesOverview() {
  const obs = useReveal(0.1);
  
  const features = [
    {
      title: "KI-Profilanalyse",
      subtitle: "Der Scanner",
      description: "Unsere Software scannt dein Finanzprofil und zeigt dir, wo du stehst — und wo du hinkönntest.",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      title: "Credit-Building-Strategien",
      subtitle: "Der Aufbau",
      description: "Aus dem US-System adaptiert, für den europäischen Markt optimiert. Schritt-für-Schritt-Module, die funktionieren.",
      gradient: "from-blue-600 to-blue-700"
    },
    {
      title: "Limit-Tracker Dashboard",
      subtitle: "Der Monitor",
      description: "Verfolge deinen Fortschritt in Echtzeit. Sieh, was sich verändert hat und was dein nächster Move ist.",
      gradient: "from-blue-700 to-blue-800"
    },
    {
      title: "Kartenkompass",
      subtitle: "Der Navigator",
      description: "Welche Produkte am Markt passen zu deinem Profil? Datenbasierte Übersicht — ohne Affiliate-Links, ohne Werbung.",
      gradient: "from-blue-500 to-blue-600"
    },
    {
      title: "Score-Simulator",
      subtitle: "Der Simulator",
      description: "Was passiert mit deiner Bonität, wenn du X machst? Simuliere Szenarien, bevor du handelst.",
      gradient: "from-blue-600 to-blue-700"
    },
    {
      title: "Monats-Coaching",
      subtitle: "Der Guide",
      description: "Jeden Monat neue Insights, Aufgaben und Strategieanpassungen. Kein einmaliger Vergleich — ein laufendes Programm.",
      gradient: "from-blue-700 to-blue-800"
    }
  ];
  
  return (
    <section ref={obs.ref} className="py-20 sm:py-28 relative overflow-hidden" style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 50%, #ffffff 100%)" }}>
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[800px] h-[500px] opacity-20" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.08), transparent 70%)", filter: "blur(120px)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[400px] opacity-15" style={{ background: "radial-gradient(ellipse, rgba(212,175,55,0.06), transparent 70%)", filter: "blur(100px)" }} />
      </div>

      <div className={`max-w-[1280px] mx-auto px-6 relative z-10 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
        {/* Section Badge */}
        <div className="mb-12">
          <span className="inline-block px-5 py-2.5 bg-white/60 backdrop-blur-xl border border-blue-200 text-[#2563eb] text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
            ALLES IN EINER PLATTFORM
          </span>
        </div>

        {/* Headline */}
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 fiaon-gradient-text-animated mb-4">
            Software. Coaching. Strategie.<br/>
            Alles drin.
          </h2>
        </div>

        {/* 3x2 Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <div 
              key={index}
              className="fiaon-glass-panel rounded-2xl p-6 border border-white/60 hover:border-blue-200 transition-all duration-300 relative overflow-hidden"
              style={{
                animationDelay: `${index * 100}ms`,
                animation: obs.v ? "fadeInUp 0.6s ease-out forwards" : "none",
                opacity: obs.v ? 1 : 0,
                transform: obs.v ? "translateY(0)" : "translateY(20px)"
              }}
            >
              {/* Animated gradient background on hover */}
              <div className="absolute inset-0 opacity-0 hover:opacity-10 transition-opacity duration-300"
                   style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.3), rgba(147,197,253,0.3))" }}
              />
              
              <div className="relative z-10">
                {/* Premium Visualization */}
                <div className="mb-5 relative">
                  <div className="w-full aspect-[2/1] rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center relative overflow-hidden p-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent" />
                    {/* Different visualization for each feature */}
                    {index === 0 && (
                      <div className="relative z-10 w-full h-full flex items-center justify-center">
                        {/* Scanner visualization */}
                        <div className="relative w-full h-full">
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-xl shadow-blue-500/30 flex items-center justify-center">
                            <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm" />
                          </div>
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-2 border-blue-500/30" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 rounded-full border border-blue-500/20" style={{ animation: "pulse 2s ease-in-out infinite 0.5s" }} />
                        </div>
                      </div>
                    )}
                    {index === 1 && (
                      <div className="relative z-10 w-full h-full flex items-end justify-center gap-2 px-4">
                        <div className="flex-1 bg-gradient-to-t from-blue-500/40 to-blue-400/60 rounded-t" style={{ height: "60%" }} />
                        <div className="flex-1 bg-gradient-to-t from-blue-500/50 to-blue-400/70 rounded-t" style={{ height: "80%" }} />
                        <div className="flex-1 bg-gradient-to-t from-blue-500/60 to-blue-400/80 rounded-t" style={{ height: "100%" }} />
                      </div>
                    )}
                    {index === 2 && (
                      <div className="relative z-10 w-full h-full grid grid-cols-2 gap-2 p-2">
                        <div className="bg-white/60 rounded-lg p-2 border border-white/50">
                          <div className="text-[8px] text-gray-500 uppercase">Score</div>
                          <div className="text-sm font-bold text-gray-900">78%</div>
                        </div>
                        <div className="bg-white/60 rounded-lg p-2 border border-white/50">
                          <div className="text-[8px] text-gray-500 uppercase">Limit</div>
                          <div className="text-sm font-bold text-gray-900">12k</div>
                        </div>
                      </div>
                    )}
                    {index === 3 && (
                      <div className="relative z-10 w-full h-full flex items-center justify-center">
                        <div className="grid grid-cols-3 gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20" />
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-500/20" />
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-300 to-blue-400 shadow-lg shadow-blue-500/20" />
                        </div>
                      </div>
                    )}
                    {index === 4 && (
                      <div className="relative z-10 w-full h-full flex items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                          <div className="text-white text-xs font-bold">85</div>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-400 to-blue-500 shadow-lg shadow-blue-500/20 flex items-center justify-center">
                          <div className="text-white text-xs font-bold">92</div>
                        </div>
                      </div>
                    )}
                    {index === 5 && (
                      <div className="relative z-10 w-full h-full flex items-center justify-center">
                        <div className="grid grid-cols-7 gap-1 p-2">
                          {/* Mini calendar visualization */}
                          {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                            <div key={day} className="flex flex-col items-center gap-1">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold ${
                                day <= 5 ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                              }`}>
                                {day}
                              </div>
                              {day <= 5 && (
                                <div className="w-1 h-1 rounded-full bg-green-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Title */}
                <h3 className="text-xl font-bold text-gray-900 mb-1 fiaon-gradient-text-animated">{feature.title}</h3>
                <p className={`text-sm font-semibold tracking-wide uppercase mb-3 bg-gradient-to-r ${feature.gradient} bg-clip-text text-transparent`}>{feature.subtitle}</p>
                
                {/* Description */}
                <p className="text-gray-600 leading-relaxed text-sm">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
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
        
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.5;
          }
        }
      `}</style>
    </section>
  );
}

/* ────────────────────────────────
   CTA
   ──────────────────────────────── */
function Cta() {
  return (
    <section id="start" className="py-20 sm:py-28 bg-[#f8faff]">
      <div className="max-w-[640px] mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><GradientText>Bereit f&uuml;r deine Kreditkarte?</GradientText></h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8">Starte jetzt deinen Antrag &ndash; kostenlos, ohne SCHUFA-Abfrage, in unter 2 Minuten.</p>
        <a href="/antrag" className="fiaon-btn-gradient inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-medium text-white">
          Jetzt starten
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <div className="flex items-center justify-center gap-4 mt-5 text-[12px] text-gray-400 font-medium">
          <span>Kostenlos</span><span className="w-px h-3 bg-gray-200" /><span>Keine SCHUFA</span><span className="w-px h-3 bg-gray-200" /><span>Unverbindlich</span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   PRODUCT COMPARISON SECTION
   ──────────────────────────────── */
function ComparisonSection() {
  const obs = useReveal(0.1);
  const [selected, setSelected] = useState(1);
  const products = [
    { 
      id: 0,
      name: "FIAON Starter", 
      fee: "7,99", 
      lim: "500", 
      recommended: false,
      features: ["E-Mail Support", "NFC kontaktlos", "Online-Banking", "Limit bis 500€"] 
    },
    { 
      id: 1,
      name: "FIAON Pro", 
      fee: "59,99", 
      lim: "5.000", 
      recommended: true,
      features: ["Priority Support", "Cashback-Programm", "NFC kontaktlos", "Limit bis 5.000€"] 
    },
    { 
      id: 2,
      name: "FIAON Ultra", 
      fee: "79,99", 
      lim: "15.000", 
      recommended: false,
      features: ["Reise-Versicherung", "Lounge-Zugang", "Priority Support", "Limit bis 15.000€"] 
    },
    { 
      id: 3,
      name: "FIAON High End", 
      fee: "99,99", 
      lim: "25.000", 
      recommended: false,
      features: ["24/7 VIP Support", "Concierge-Service", "Premium Lounge", "Limit bis 25.000€"] 
    },
  ];

  const selectedProduct = products[selected];

  return (
    <section className="py-16 sm:py-20 relative overflow-hidden" ref={obs.ref}>
      {/* Subtle background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] opacity-8" style={{
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.08), transparent 70%)",
          filter: "blur(50px)",
          animation: "limitGlow 12s ease-in-out infinite"
        }} />
      </div>

      <div className="relative z-10 max-w-[1000px] mx-auto px-6">
        <div className="text-center mb-10">
          <p className="text-[11px] font-semibold text-[#2563eb] tracking-[.2em] uppercase mb-3">Produktvergleich</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4 fiaon-gradient-text-animated">
            Finde das perfekte Paket für dich
          </h2>
          <p className="text-[15px] text-gray-500 leading-relaxed max-w-xl mx-auto">
            Wähle ein Paket und sieh alle Details.
          </p>
        </div>

        {/* Interactive comparison */}
        <div className={`relative ${obs.v ? "animate-[fadeInUp_.6s_ease]" : "opacity-0"}`}>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: Package Selection */}
            <div className="space-y-3">
              {products.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className={`w-full text-left p-4 rounded-xl transition-all duration-300 ${
                    selected === p.id
                      ? "bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg"
                      : "fiaon-glass-panel text-gray-700 hover:bg-white/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-[15px] font-semibold mb-1 ${selected === p.id ? "text-white" : ""}`}>
                        {p.name}
                      </div>
                      <div className={`text-[13px] ${selected === p.id ? "text-white/80" : "text-gray-500"}`}>
                        bis {p.lim} €
                      </div>
                    </div>
                    {p.recommended && (
                      <span className="text-[9px] font-semibold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">
                        Empfohlen
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Right: Package Details */}
            <div className="fiaon-glass-panel rounded-2xl p-6">
              <div className="mb-6">
                <h3 className={`text-[22px] font-bold mb-2 ${selectedProduct.recommended ? "fiaon-gradient-text-animated" : "text-gray-900"}`}>
                  {selectedProduct.name}
                </h3>
                {selectedProduct.recommended && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-3 py-1 rounded-full border border-[#2563eb]/20">
                    Empfohlen
                  </span>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-[.1em] mb-1">Kreditlimit</p>
                  <p className="text-[24px] font-bold fiaon-gradient-text-animated">bis {selectedProduct.lim} €</p>
                </div>
                <div>
                  <p className="text-[11px] text-gray-400 uppercase tracking-[.1em] mb-1">Gebühr/Monat</p>
                  <p className="text-[18px] font-semibold text-gray-900">{selectedProduct.fee} €</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-[11px] text-gray-400 uppercase tracking-[.1em] mb-3">Features</p>
                <ul className="space-y-2">
                  {selectedProduct.features.map((f, j) => (
                    <li key={j} className="text-[13px] text-gray-600 flex items-center gap-2">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href="/antrag"
                className={`block w-full py-3 rounded-xl text-[13px] font-semibold transition-all duration-300 text-center ${
                  selectedProduct.recommended
                    ? "bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-lg hover:shadow-xl hover:scale-[1.02]"
                    : "fiaon-glass-panel text-gray-700 hover:bg-white/60"
                }`}
              >
                {selectedProduct.name} wählen
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   PREMIUM PROCESS SECTION
   ──────────────────────────────── */
function ProcessSection() {
  const obs = useReveal(0.1);
  const steps = [
    { n: "01", t: "Antrag starten", d: "Beantworte ein paar einfache Fragen. Dauert unter 2 Minuten.", icon: "→" },
    { n: "02", t: "Angebot erhalten", d: "Wir prüfen dein Profil und empfehlen die passende Kreditkarte.", icon: "✓" },
    { n: "03", t: "Karte beantragen", d: "Zufrieden? Wir leiten dich direkt zum Anbieter weiter.", icon: "→" },
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={obs.ref}>
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] opacity-20" style={{
          background: "radial-gradient(ellipse at center, rgba(37,99,235,0.15), transparent 70%)",
          filter: "blur(100px)",
          animation: "limitGlow 10s ease-in-out infinite"
        }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6">
        <div className="text-center mb-20">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[.2em] uppercase mb-4">Ablauf</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 fiaon-gradient-text-animated">
            In 3 Schritten zur passenden Karte
          </h2>
          <p className="text-[17px] sm:text-[18px] text-gray-500 leading-relaxed max-w-2xl mx-auto">
            Kein Papierkram, keine Filiale. Alles digital.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((s, i) => (
            <div key={i} className={`relative ${obs.v ? "animate-[fadeInUp_.8s_ease]" : "opacity-0"}`} style={{ animationDelay: `${i * 0.2}s` }}>
              <div className="relative p-8 lg:p-10 rounded-3xl fiaon-glass-panel hover:scale-[1.04] hover:shadow-2xl transition-all duration-500 group">
                {/* Animated gradient overlay */}
                <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 opacity-20" style={{
                    background: "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(147,197,253,0.22), rgba(37,99,235,0.1), rgba(147,197,253,0.16))",
                    backgroundSize: "400% 400%",
                    animation: "limitGlow 10s ease-in-out infinite"
                  }} />
                  <div className="absolute inset-0 opacity-15" style={{
                    background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.9), transparent 70%)"
                  }} />
                </div>

                {/* Glow effect on hover */}
                <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{
                  background: "radial-gradient(circle at center, rgba(37,99,235,0.1), transparent 70%)"
                }} />

                <div className="relative z-10">
                  {/* Step number */}
                  <div className="text-[56px] font-bold mb-6 tracking-tight" style={{
                    background: "linear-gradient(135deg, #1e40af, #2563eb, #3b82f6, #60a5fa, #2563eb)",
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    opacity: 0.3,
                    letterSpacing: "-0.03em",
                    backgroundSize: "200% 200%",
                    animation: "limitGlow 6s ease-in-out infinite"
                  }}>
                    {s.n}
                  </div>

                  <h3 className="text-[19px] lg:text-[20px] font-semibold text-gray-900 mb-4 tracking-tight">{s.t}</h3>
                  <p className="text-[15px] text-gray-500 leading-relaxed font-medium mb-6">{s.d}</p>

                  {/* Icon indicator */}
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl" style={{
                    background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.15))",
                    border: "1px solid rgba(37,99,235,0.2)"
                  }}>
                    <span style={{ color: "#2563eb" }}>{s.icon}</span>
                  </div>
                </div>
              </div>

              {/* Connector line */}
              {i < 2 && (
                <div className="hidden md:block absolute top-1/2 -right-4 lg:-right-6 w-8 lg:w-12 h-[2px]" style={{
                  background: "linear-gradient(90deg, #2563eb, rgba(37,99,235,0.2))",
                  boxShadow: "0 0 20px rgba(37,99,235,0.4)",
                  opacity: 0.5
                }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   FOOTER
   ──────────────────────────────── */
function Foot() {
  return (
    <footer className="relative py-16 sm:py-20 overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(249,250,251,0.8) 50%, rgba(243,244,246,1) 100%)"
      }} />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-30" style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.1), transparent 70%)",
          filter: "blur(60px)"
        }} />
      </div>

      <div className="relative z-10 max-w-[1280px] mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Logo & Description */}
          <div>
            <div className="mb-6">
              <span className="text-2xl font-bold tracking-tight fiaon-gradient-text-animated">FIAON</span>
            </div>
            <p className="text-[14px] text-gray-500 leading-relaxed max-w-[260px]">
              Unabhängige Kreditkarten-Beratung für Privatpersonen und Unternehmen.
            </p>
          </div>

          {/* Pages */}
          <div>
            <div className="text-[13px] font-semibold text-gray-900 uppercase tracking-[.15em] mb-5">Seiten</div>
            <ul className="space-y-3">
              <li><a href="/" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Startseite</a></li>
              <li><a href="/privatkunden" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Privatkunden</a></li>
              <li><a href="/business" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Business</a></li>
              <li><a href="/plattform-konzept" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Plattform-Konzept</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <div className="text-[13px] font-semibold text-gray-900 uppercase tracking-[.15em] mb-5">Rechtliches</div>
            <ul className="space-y-3">
              <li><a href="/terms" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">AGB</a></li>
              <li><a href="/privacy" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Datenschutz</a></li>
              <li><a href="#" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Impressum</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <div className="text-[13px] font-semibold text-gray-900 uppercase tracking-[.15em] mb-5">Kontakt</div>
            <ul className="space-y-3">
              <li><a href="mailto:support@fiaon.com" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">support@fiaon.com</a></li>
              <li><span className="text-[14px] text-gray-500">Mo–Fr, 9–18 Uhr</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[13px] text-gray-400">&copy; {new Date().getFullYear()} FIAON. Alle Rechte vorbehalten.</span>
          <span className="text-[12px] text-gray-400">FIAON ist ein Beratungsservice und kein Kreditinstitut.</span>
        </div>
      </div>
    </footer>
  );
}

/* ════════════════════════════════
   EXPORT
   ════════════════════════════════ */
export default function FiaonLanding() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav activePage="startseite" />
      <Hero />
      <Numbers />
      <WhySection />
      <Packages />
      <ComparisonSection />
      <HowItWorks />
      <Reviews />
      <Faq />
      <ProblemSection />
      <WasIstFiaonSection />
      <FeaturesOverview />
      <Cta />
      <ProcessSection />
      <PremiumFooter />
    </div>
  );
}
