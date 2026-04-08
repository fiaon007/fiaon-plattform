import { useState, useEffect } from "react";

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M7 10L9 12L13 8" stroke="#288DFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ArrowRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline ml-2">
    <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ShieldIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#288DFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
  </svg>
);

const GlobeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#288DFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);

const WalletIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#288DFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/>
  </svg>
);

const SparkleIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#288DFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v18M3 12h18M5.636 5.636l12.728 12.728M18.364 5.636L5.636 18.364"/>
  </svg>
);

const PlaneIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#288DFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
  </svg>
);

const LockIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#288DFA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

function CreditCard({ className = "", style = {} }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`relative ${className}`} style={style}>
      <div className="w-full aspect-[1.586/1] rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1a2744, #1e3050, #162844)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}>
        <div className="absolute inset-0 p-6 sm:p-8 flex flex-col justify-between">
          {/* Top Row */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {/* Chip */}
              <div className="w-10 h-7 rounded-md" style={{ background: "linear-gradient(135deg, #C4A962, #E8D5A0, #C4A962)" }} />
              {/* Contactless */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
                <path d="M8.5 16.5a5 5 0 0 1 0-9M12 19a9 9 0 0 0 0-14M5 13.5a1 1 0 0 1 0-3"/>
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight" style={{ color: "#288DFA" }}>fiaon</span>
          </div>
          
          {/* Card Number */}
          <div className="text-center">
            <span className="text-base sm:text-lg tracking-[0.25em] font-mono" style={{ color: "rgba(255,255,255,0.7)" }}>
              5232&nbsp;&nbsp;2702&nbsp;&nbsp;5678&nbsp;&nbsp;9012
            </span>
          </div>
          
          {/* Bottom Row */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Karteninhaber</div>
              <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>MAX MUSTERMANN</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.3)" }}>Valid Thru</div>
              <div className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.75)" }}>12/28</div>
            </div>
            <span className="text-xl font-extrabold tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>VISA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/90 backdrop-blur-xl shadow-sm" : "bg-transparent"}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between">
        <a href="/" className="text-xl sm:text-2xl font-extrabold tracking-tight" style={{ color: "#288DFA" }}>
          FIAON
        </a>
        
        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Vorteile</a>
          <a href="#card" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">Deine Karte</a>
          <a href="#how" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">So funktioniert's</a>
          <a href="#faq" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">FAQ</a>
          <a href="#cta" className="inline-flex items-center px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]" style={{ background: "#288DFA" }}>
            Limit-Check starten <ArrowRight />
          </a>
        </div>

        {/* Mobile Hamburger */}
        <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></> : <><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></>}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100 px-5 pb-6 pt-4 space-y-4">
          <a href="#features" onClick={() => setMobileOpen(false)} className="block text-base font-medium text-gray-700">Vorteile</a>
          <a href="#card" onClick={() => setMobileOpen(false)} className="block text-base font-medium text-gray-700">Deine Karte</a>
          <a href="#how" onClick={() => setMobileOpen(false)} className="block text-base font-medium text-gray-700">So funktioniert's</a>
          <a href="#faq" onClick={() => setMobileOpen(false)} className="block text-base font-medium text-gray-700">FAQ</a>
          <a href="#cta" onClick={() => setMobileOpen(false)} className="block w-full text-center px-5 py-3 rounded-full text-base font-semibold text-white" style={{ background: "#288DFA" }}>
            Limit-Check starten
          </a>
        </div>
      )}
    </nav>
  );
}

function HeroSection() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-24 overflow-hidden">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(40,141,250,0.06) 0%, transparent 60%)" }} />
      
      <div className="max-w-6xl mx-auto px-5 sm:px-8 text-center relative z-10">
        {/* Trust badge */}
        <a href="#how" className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium text-gray-600 border border-gray-200 bg-white/80 backdrop-blur-sm hover:border-blue-200 transition-all mb-8 group">
          Bereits über + 1.200 aktive Nutzer diesen Monat
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="group-hover:translate-x-0.5 transition-transform"><path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </a>
        
        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-gray-900 leading-[1.05] mb-6">
          Dein 25.000€ Limit.<br/>
          <span className="text-gray-900">Ohne Kompromisse.</span>
        </h1>
        
        <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto leading-relaxed mb-10">
          FIAON ist die Kreditkarte der neuen Generation – mit einem Limit, das sich an dein Leben anpasst. Keine versteckten Gebühren. Keine Wartezeit.
        </p>
        
        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#cta" className="inline-flex items-center px-8 py-4 rounded-full text-base font-semibold text-white transition-all hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98]" style={{ background: "#288DFA" }}>
            Jetzt mein Limit prüfen (Kostenlos) <ArrowRight />
          </a>
          <span className="text-sm text-gray-400">Keine SCHUFA-Abfrage</span>
        </div>
        
        {/* Card Visual */}
        <div className="relative max-w-md mx-auto">
          <div className="absolute inset-0 blur-3xl opacity-20 rounded-full" style={{ background: "#288DFA" }} />
          <CreditCard className="relative z-10 w-full max-w-[420px] mx-auto" />
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  const stats = [
    { value: "25.000€", label: "Max. Kreditlimit" },
    { value: "0€", label: "Jahresgebühr" },
    { value: "0%", label: "Auslandsgebühren" },
    { value: "< 2 Min", label: "Sofort-Prüfung" },
  ];

  return (
    <section className="py-12 sm:py-16 border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1 font-medium">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    { icon: <ShieldIcon />, title: "Höchste Sicherheit", desc: "3D Secure, biometrische Authentifizierung und Echtzeit-Benachrichtigungen bei jeder Transaktion. Dein Geld ist geschützt." },
    { icon: <GlobeIcon />, title: "Weltweit kostenlos", desc: "Bezahle überall auf der Welt – ohne Auslandsgebühren oder versteckte Kosten. In über 200 Ländern akzeptiert." },
    { icon: <WalletIcon />, title: "Apple Pay & Google Pay", desc: "Füge deine FIAON Card in Sekunden zu Apple Pay oder Google Pay hinzu und bezahle kontaktlos." },
    { icon: <PlaneIcon />, title: "Reiseschutz inklusive", desc: "Umfassende Reiseversicherung, Lounge-Zugang an 1.300+ Flughäfen und Priority Boarding – ohne Aufpreis." },
    { icon: <SparkleIcon />, title: "Flexibles Limit", desc: "Dein Limit wächst mit dir. Je mehr du FIAON nutzt, desto mehr Spielraum bekommst du – automatisch." },
    { icon: <LockIcon />, title: "DSGVO-konform", desc: "Alle Daten werden auf europäischen Servern gespeichert. Volle Transparenz, volle Kontrolle über deine Daten." },
  ];

  return (
    <section id="features" className="py-20 sm:py-32">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "#288DFA" }}>
            <span className="w-8 h-0.5" style={{ background: "#288DFA" }} />
            Vorteile
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-tight">
            Alles, was eine Karte<br/>können sollte
          </h2>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">
            Keine Kompromisse. Jede Funktion wurde für maximale Freiheit und Sicherheit entwickelt.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {features.map((f, i) => (
            <div key={i} className="group p-6 sm:p-8 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(40,141,250,0.08)" }}>
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{f.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CardShowcase() {
  return (
    <section id="card" className="py-20 sm:py-32" style={{ background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)" }}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Card Visual with Ring */}
          <div className="flex justify-center order-1 lg:order-none">
            <div className="relative">
              {/* Rotating ring */}
              <div className="w-[280px] h-[280px] sm:w-[380px] sm:h-[380px] md:w-[420px] md:h-[420px] rounded-full border border-gray-200 flex items-center justify-center animate-spin-slow relative">
                <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full shadow-lg" style={{ background: "#288DFA", boxShadow: "0 0 18px rgba(40,141,250,0.6)" }} />
                {/* Card inside ring - counter-rotate to stay still */}
                <div className="animate-spin-slow-reverse">
                  <CreditCard className="w-[220px] sm:w-[280px] md:w-[310px]" />
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="max-w-lg">
            <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "#288DFA" }}>
              <span className="w-8 h-0.5" style={{ background: "#288DFA" }} />
              Deine Karte
            </div>
            
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 leading-[1.08] mb-5">
              Eine Karte, die mit<br/>dir wächst
            </h2>
            
            <p className="text-lg text-gray-500 leading-relaxed mb-8">
              Dein Limit ist kein starrer Rahmen – es entwickelt sich mit dir. Je mehr du FIAON nutzt, desto mehr Spielraum bekommst du.
            </p>

            <ul className="space-y-5">
              {[
                "Bis zu 25.000€ Kreditlimit – individuell auf dich zugeschnitten",
                "Kompatibel mit Apple Pay, Google Pay und allen gängigen Wallets",
                "Kontaktlos bezahlen – weltweit und ohne Gebühren im Ausland",
                "Exklusiver Reiseschutz und Lounge-Zugang inklusive",
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3.5">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "rgba(40,141,250,0.08)", border: "1px solid rgba(40,141,250,0.15)" }}>
                    <CheckIcon />
                  </div>
                  <span className="text-base text-gray-600 leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { step: "01", title: "Limit prüfen", desc: "Gib deine Daten ein und erfahre in unter 2 Minuten dein persönliches Kreditlimit – ohne SCHUFA-Eintrag." },
    { step: "02", title: "Identität bestätigen", desc: "Verifiziere dich bequem per Video-Ident von zu Hause. Kein Postident, kein Papierkram." },
    { step: "03", title: "Karte erhalten", desc: "Deine digitale Karte ist sofort einsatzbereit. Die physische Karte kommt innerhalb von 3-5 Werktagen." },
  ];

  return (
    <section id="how" className="py-20 sm:py-32">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "#288DFA" }}>
            <span className="w-8 h-0.5" style={{ background: "#288DFA" }} />
            So funktioniert's
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">
            In 3 Schritten zur Karte
          </h2>
          <p className="text-lg text-gray-500 mt-4 max-w-xl mx-auto">
            Kein Papierkram, keine Wartezeit. Alles digital, alles einfach.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className="relative p-8 rounded-2xl bg-white border border-gray-100 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-300">
              <div className="text-5xl font-black mb-4" style={{ color: "rgba(40,141,250,0.1)" }}>{s.step}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{s.title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 text-gray-300">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Comparison() {
  const rows = [
    { feature: "Jahresgebühr", fiaon: "0 €", others: "ab 89 €" },
    { feature: "Auslandsgebühren", fiaon: "0 %", others: "1,5 – 2 %" },
    { feature: "Max. Kreditlimit", fiaon: "25.000 €", others: "5.000 – 10.000 €" },
    { feature: "Sofortige Freischaltung", fiaon: true, others: false },
    { feature: "Apple Pay & Google Pay", fiaon: true, others: "Teilweise" },
    { feature: "Reiseschutz inkl.", fiaon: true, others: false },
    { feature: "Lounge-Zugang", fiaon: true, others: false },
  ];

  return (
    <section className="py-20 sm:py-32" style={{ background: "#f8fafc" }}>
      <div className="max-w-4xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "#288DFA" }}>
            <span className="w-8 h-0.5" style={{ background: "#288DFA" }} />
            Vergleich
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">
            FIAON vs. Andere
          </h2>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-3 bg-gray-50 border-b border-gray-100">
            <div className="p-4 sm:p-6 text-sm font-semibold text-gray-500">Feature</div>
            <div className="p-4 sm:p-6 text-center text-sm font-bold" style={{ color: "#288DFA" }}>FIAON</div>
            <div className="p-4 sm:p-6 text-center text-sm font-semibold text-gray-400">Andere</div>
          </div>
          
          {rows.map((row, i) => (
            <div key={i} className={`grid grid-cols-3 ${i < rows.length - 1 ? "border-b border-gray-50" : ""}`}>
              <div className="p-4 sm:p-5 text-sm font-medium text-gray-700">{row.feature}</div>
              <div className="p-4 sm:p-5 text-center text-sm font-semibold text-gray-900">
                {row.fiaon === true ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full" style={{ background: "rgba(40,141,250,0.1)" }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="#288DFA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                ) : row.fiaon}
              </div>
              <div className="p-4 sm:p-5 text-center text-sm text-gray-400">
                {row.others === false ? (
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="#ccc" strokeWidth="2" strokeLinecap="round"/></svg>
                  </span>
                ) : row.others}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  const reviews = [
    { name: "Lena M.", role: "Unternehmerin", text: "Endlich eine Karte, die so flexibel ist wie mein Business. Das Limit hat sich innerhalb von 3 Monaten verdoppelt.", rating: 5 },
    { name: "Tobias K.", role: "Freelancer", text: "Keine Auslandsgebühren auf meinen Reisen – das spart mir locker 500€ im Jahr. Und die App ist unglaublich smooth.", rating: 5 },
    { name: "Sara W.", role: "Studentin", text: "Ich dachte, eine Premium-Karte wäre unerreichbar für mich. Bei FIAON habe ich sofort 5.000€ Limit bekommen.", rating: 5 },
  ];

  return (
    <section className="py-20 sm:py-32">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "#288DFA" }}>
            <span className="w-8 h-0.5" style={{ background: "#288DFA" }} />
            Kundenstimmen
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">
            Was unsere Nutzer sagen
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
          {reviews.map((r, i) => (
            <div key={i} className="p-6 sm:p-8 rounded-2xl bg-white border border-gray-100 hover:shadow-lg transition-all duration-300">
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: r.rating }).map((_, j) => (
                  <svg key={j} width="18" height="18" viewBox="0 0 18 18" fill="#FBBF24"><path d="M9 1l2.47 5.01L17 6.76l-4 3.9.94 5.49L9 13.77l-4.94 2.38L5 10.66l-4-3.9 5.53-.75z"/></svg>
                ))}
              </div>
              <p className="text-base text-gray-600 leading-relaxed mb-6">"{r.text}"</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "#288DFA" }}>
                  {r.name.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{r.name}</div>
                  <div className="text-xs text-gray-500">{r.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  
  const faqs = [
    { q: "Wird eine SCHUFA-Abfrage durchgeführt?", a: "Bei der Limit-Prüfung wird keine harte SCHUFA-Anfrage gestellt. Erst nach deiner endgültigen Beantragung erfolgt eine reguläre Bonitätsprüfung." },
    { q: "Wie schnell erhalte ich meine Karte?", a: "Deine digitale Karte ist sofort nach der Identitätsprüfung einsatzbereit – für Apple Pay, Google Pay und Online-Shopping. Die physische Karte kommt in 3-5 Werktagen." },
    { q: "Kostet die Karte wirklich 0€?", a: "Ja. Es gibt keine Jahresgebühr, keine Kontoführungsgebühr und keine Auslandsgebühren. FIAON finanziert sich über Transaktionsgebühren der Händler." },
    { q: "Wie hoch ist mein Kreditlimit?", a: "Dein Limit wird individuell basierend auf deiner Bonität berechnet – bis zu 25.000€. Das Limit wächst automatisch mit deiner Nutzung." },
    { q: "Kann ich die Karte auch als Selbstständiger beantragen?", a: "Ja, absolut. FIAON ist für Privatpersonen, Freelancer und Selbstständige verfügbar. Du brauchst lediglich ein regelmäßiges Einkommen." },
    { q: "Wie kündige ich, wenn ich die Karte nicht mehr möchte?", a: "Du kannst jederzeit kostenlos kündigen – direkt in der App mit einem Klick. Keine Mindestlaufzeit, keine Kündigungsfrist." },
  ];

  return (
    <section id="faq" className="py-20 sm:py-32" style={{ background: "#f8fafc" }}>
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 text-xs font-bold uppercase tracking-[3px] mb-4" style={{ color: "#288DFA" }}>
            <span className="w-8 h-0.5" style={{ background: "#288DFA" }} />
            FAQ
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">
            Häufige Fragen
          </h2>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left p-5 sm:p-6 flex items-center justify-between gap-4">
                <span className="text-base font-semibold text-gray-900">{faq.q}</span>
                <svg className={`shrink-0 w-5 h-5 text-gray-400 transition-transform duration-200 ${open === i ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="none">
                  <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {open === i && (
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 -mt-1">
                  <p className="text-sm text-gray-500 leading-relaxed">{faq.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section id="cta" className="py-20 sm:py-32">
      <div className="max-w-4xl mx-auto px-5 sm:px-8 text-center">
        <div className="relative p-10 sm:p-16 rounded-3xl overflow-hidden" style={{ background: "linear-gradient(135deg, #1a2744, #1e3050)" }}>
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(40,141,250,0.15) 0%, transparent 60%)" }} />
          
          <div className="relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              Bereit für dein<br/>neues Kreditlimit?
            </h2>
            <p className="text-lg text-blue-200/60 mb-8 max-w-lg mx-auto">
              Prüfe jetzt kostenlos dein Limit – in unter 2 Minuten. Ohne SCHUFA-Eintrag.
            </p>
            <a href="#" className="inline-flex items-center px-8 py-4 rounded-full text-base font-semibold text-gray-900 bg-white hover:bg-gray-50 transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
              Jetzt Limit-Check starten <ArrowRight />
            </a>
            <div className="flex items-center justify-center gap-6 mt-6 text-sm text-blue-200/40">
              <span className="flex items-center gap-1.5"><CheckIcon /> Kostenlos</span>
              <span className="flex items-center gap-1.5"><CheckIcon /> Kein SCHUFA-Eintrag</span>
              <span className="flex items-center gap-1.5"><CheckIcon /> In 2 Min.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-gray-100 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="text-xl font-extrabold tracking-tight mb-3" style={{ color: "#288DFA" }}>FIAON</div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Die Kreditkarte der neuen Generation. Bis zu 25.000€ Limit, weltweit gebührenfrei.
            </p>
          </div>
          
          {/* Links */}
          <div>
            <div className="text-sm font-bold text-gray-900 mb-4">Produkt</div>
            <ul className="space-y-2.5">
              <li><a href="#features" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Vorteile</a></li>
              <li><a href="#card" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Deine Karte</a></li>
              <li><a href="#how" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">So funktioniert's</a></li>
              <li><a href="#faq" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">FAQ</a></li>
            </ul>
          </div>
          
          <div>
            <div className="text-sm font-bold text-gray-900 mb-4">Rechtliches</div>
            <ul className="space-y-2.5">
              <li><a href="/terms" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">AGB</a></li>
              <li><a href="/privacy" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Datenschutz</a></li>
              <li><a href="#" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Impressum</a></li>
            </ul>
          </div>
          
          <div>
            <div className="text-sm font-bold text-gray-900 mb-4">Kontakt</div>
            <ul className="space-y-2.5">
              <li><a href="mailto:support@fiaon.com" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">support@fiaon.com</a></li>
              <li><span className="text-sm text-gray-500">Mo–Fr, 9–18 Uhr</span></li>
            </ul>
          </div>
        </div>
        
        {/* Bottom */}
        <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-400">&copy; {new Date().getFullYear()} FIAON. Alle Rechte vorbehalten.</span>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>Visa Partner</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>PCI DSS zertifiziert</span>
            <span className="w-1 h-1 rounded-full bg-gray-300" />
            <span>Europäische Server</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function FiaonLanding() {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Navbar />
      <HeroSection />
      <TrustBar />
      <FeaturesSection />
      <CardShowcase />
      <HowItWorks />
      <Comparison />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
