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

/* ── packages ── */
const PACKS = [
  { name: "FIAON Starter", fee: "7,99", lim: "500", bg: "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats: ["Limit bis 500 \u20AC", "E-Mail Support", "NFC kontaktlos", "Online-Banking"] },
  { name: "FIAON Pro", fee: "59,99", lim: "5.000", rec: true, bg: "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats: ["Limit bis 5.000 \u20AC", "Priority Support", "Cashback-Programm", "NFC kontaktlos"] },
  { name: "FIAON Ultra", fee: "79,99", lim: "15.000", bg: "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats: ["Limit bis 15.000 \u20AC", "Reise-Versicherung", "Lounge-Zugang", "Priority Support"] },
  { name: "FIAON High End", fee: "99,99", lim: "25.000", bg: "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats: ["Limit bis 25.000 \u20AC", "24/7 VIP Support", "Concierge-Service", "Premium Lounge"] },
];

/* ────────────────────────────────
   CREDIT CARD
   ──────────────────────────────── */
function Card({ bg, lim, className = "", size = "normal" }: { bg: string; lim: string; className?: string; size?: "normal" | "hero" }) {
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

        <div className={`absolute inset-0 flex flex-col justify-between z-10 ${isHero ? "p-7 sm:p-8" : "p-4 sm:p-5"}`}>
          {/* top */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className={`rounded ${isHero ? "w-12 h-9" : "w-10 h-7"}`} style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.3)" }} />
              <svg width={isHero ? "22" : "18"} height={isHero ? "22" : "18"} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.8"><path d="M8.5 16.5a5 5 0 0 1 0-9"/><path d="M5 13.5a1 1 0 0 1 0-3"/><path d="M12 19a9 9 0 0 0 0-14"/></svg>
            </div>
            <span className={`font-medium tracking-wide ${isHero ? "text-base" : "text-sm"}`} style={{ color: "rgba(255,255,255,.65)" }}>fiaon</span>
          </div>

          {/* number */}
          <div>
            <div className={`font-mono tracking-[.15em] ${isHero ? "text-base sm:text-lg" : "text-[8px] sm:text-[10px]"}`} style={{ color: "rgba(255,255,255,.5)" }}>
              5232&nbsp;&nbsp;2702&nbsp;&nbsp;5678&nbsp;&nbsp;9012
            </div>
          </div>

          {/* bottom */}
          <div className="flex justify-between items-end">
            <div>
              <div className={`uppercase tracking-[.16em] font-medium ${isHero ? "text-[9px]" : "text-[7px]"}`} style={{ color: "rgba(255,255,255,.3)" }}>Kreditlimit</div>
              <div className={`font-mono font-medium whitespace-nowrap ${isHero ? "text-base" : "text-xs sm:text-sm"}`} style={{ color: "rgba(255,255,255,.8)" }}>bis {lim} &euro;</div>
            </div>
            <div>
              <div className={`uppercase tracking-[.16em] font-medium text-right ${isHero ? "text-[8px]" : "text-[6px]"}`} style={{ color: "rgba(255,255,255,.3)" }}>
                <span className="mr-0.5">Valid</span>Thru
              </div>
              <div className={`font-mono font-medium ${isHero ? "text-sm" : "text-[10px]"}`} style={{ color: "rgba(255,255,255,.8)" }}>12/28</div>
            </div>
            <span className={`font-semibold tracking-[.15em] ${isHero ? "text-xl" : "text-sm"}`} style={{ color: "rgba(255,255,255,.45)" }}>VISA</span>
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
          FIAON ber&auml;t dich unabh&auml;ngig bei der Wahl der richtigen Kreditkarte &ndash; mit Limits bis 25.000&nbsp;&euro;. Kostenlos, transparent, sicher.
        </p>

        {/* CTA */}
        <div className="mb-3">
          <a href="#start" className="fiaon-btn-gradient inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-medium text-white">
            Jetzt mein Limit pr&uuml;fen (Kostenlos)
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>
        <p className="text-[12px] text-gray-400 font-medium mb-14">Keine SCHUFA-Abfrage</p>

        {/* Card */}
        <div className="max-w-[420px] sm:max-w-[480px] mx-auto fiaon-card-float">
          <Card bg="linear-gradient(145deg,#0d1b2a,#1a2d44,#0d1b2a)" lim="25.000" size="hero" />
        </div>
      </div>
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
    { t: "Unabh\u00E4ngige Beratung", d: "Wir sind kein Kreditkartenanbieter. Wir beraten neutral und finden das beste Angebot f\u00FCr dich." },
    { t: "Bis 25.000 \u20AC Limit", d: "Durch unser Partner-Netzwerk vermitteln wir Kreditkarten mit Limits, die zu dir passen." },
    { t: "Keine SCHUFA-Abfrage", d: "Die Erstberatung und Limit-Pr\u00FCfung ist komplett SCHUFA-neutral." },
    { t: "Weltweit einsetzbar", d: "Die von uns vermittelten Karten sind bei \u00FCber 40 Mio. Akzeptanzstellen nutzbar." },
    { t: "Schnell & digital", d: "Keine Filiale, kein Papierkram. Antrag in unter 2 Minuten \u2013 alles online." },
    { t: "DSGVO & Datenschutz", d: "Europ\u00E4ische Server, volle Transparenz, volle Kontrolle \u00FCber deine Daten." },
  ];
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Warum FIAON</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><GradientText>Wir beraten. Du entscheidest.</GradientText></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">FIAON ist dein unabh&auml;ngiger Partner f&uuml;r Kreditkarten-Beratung.</p>
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
  return (
    <section id="pakete" className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Pakete</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><GradientText>Finde dein passendes Paket</GradientText></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">Von Einsteiger bis Premium &ndash; wir beraten dich zum optimalen Kreditkarten-Paket. Das finale Limit wird individuell berechnet.</p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PACKS.map((p, i) => (
            <div key={p.name} className={`rounded-2xl bg-white border overflow-hidden transition-all duration-700 hover:-translate-y-1.5 hover:shadow-xl ${p.rec ? "border-[#2563eb]/25 shadow-lg shadow-blue-500/8 ring-1 ring-[#2563eb]/10" : "border-gray-100 hover:border-gray-200"} ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 90}ms` }}>
              {p.rec && <div className="h-[2px] bg-[#2563eb]" />}

              {/* Card — more padding, not squished */}
              <div className="p-5 sm:p-6">
                <Card bg={p.bg} lim={p.lim} className="w-full" />
              </div>

              {/* Content */}
              <div className="px-5 sm:px-6 pb-6">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-[15px] font-semibold text-gray-900">{p.name}</h3>
                  {p.rec && <span className="text-[9px] font-semibold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded">Empfohlen</span>}
                </div>

                <ul className="space-y-2.5 mb-6">
                  {p.feats.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-[13px] text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <a href="/antrag" className={`block w-full text-center py-3 rounded-xl text-[13px] font-medium transition-all ${p.rec ? "fiaon-btn-gradient text-white" : "text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100"}`}>
                  Antrag starten
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
  const rev = [
    { n: "Lena M.", r: "Unternehmerin", t: "FIAON hat mir in 10 Minuten geholfen, die richtige Karte f\u00FCr mein Business zu finden." },
    { n: "Tobias K.", r: "Freelancer", t: "Die Beratung war wirklich neutral. Keine versteckten Kosten, keine Tricks." },
    { n: "Sara W.", r: "Angestellte", t: "Endlich jemand, der mir erkl\u00E4rt hat, welche Karte zu meiner Situation passt." },
  ];
  return (
    <section className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Kundenstimmen</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight"><GradientText>Was unsere Kunden sagen</GradientText></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {rev.map((r, i) => (
            <div key={i} className={`p-6 rounded-2xl bg-white border border-gray-100 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <svg key={j} width="14" height="14" viewBox="0 0 20 20" fill="#2563eb" opacity=".7"><path d="M10 1l2.47 5.01L18 6.76l-4 3.9.94 5.49L10 13.77l-4.94 2.38L6 10.66l-4-3.9 5.53-.75z"/></svg>)}</div>
              <p className="text-[14px] text-gray-600 leading-relaxed mb-5">&bdquo;{r.t}&ldquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2563eb] flex items-center justify-center text-[11px] font-medium text-white">{r.n[0]}</div>
                <div><div className="text-[13px] font-medium text-gray-900">{r.n}</div><div className="text-[11px] text-gray-400">{r.r}</div></div>
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
   CTA
   ──────────────────────────────── */
function Cta() {
  return (
    <section id="start" className="py-20 sm:py-28 bg-[#f8faff]">
      <div className="max-w-[640px] mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><GradientText>Bereit f&uuml;r deine Kreditkarte?</GradientText></h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8">Starte jetzt deinen Antrag &ndash; kostenlos, ohne SCHUFA-Abfrage, in unter 2 Minuten.</p>
        <a href="#" className="fiaon-btn-gradient inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-medium text-white">
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
      <ApplicationProcess />
      <HowItWorks />
      <Reviews />
      <Faq />
      <Cta />
      <ProcessSection />
      <Foot />
    </div>
  );
}
