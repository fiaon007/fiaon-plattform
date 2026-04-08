import { useState, useEffect, useRef } from "react";

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

/* ── packages ── */
const PACKS = [
  { name: "Starter", fee: "7,99", lim: "500", bg: "linear-gradient(135deg,#1e3a5f,#2d6a9f,#4a90c4)", feats: ["Limit bis 500 \u20AC", "E-Mail Support", "NFC kontaktlos", "Online-Banking"] },
  { name: "Pro", fee: "59,99", lim: "5.000", bg: "linear-gradient(135deg,#0f2847,#1a4a7a,#2563eb)", rec: true, feats: ["Limit bis 5.000 \u20AC", "Priority Support", "Cashback-Programm", "NFC kontaktlos"] },
  { name: "Ultra", fee: "79,99", lim: "15.000", bg: "linear-gradient(135deg,#0c1e3a,#163560,#1e4d8c)", feats: ["Limit bis 15.000 \u20AC", "Reise-Versicherung", "Lounge-Zugang", "Priority Support"] },
  { name: "High End", fee: "99,99", lim: "25.000", bg: "linear-gradient(135deg,#080f1a,#0f1c30,#1a2a44)", feats: ["Limit bis 25.000 \u20AC", "24/7 VIP Support", "Concierge-Service", "Premium Lounge"] },
];

/* ────────────────────────────────
   CREDIT CARD — realistic
   ──────────────────────────────── */
function Card({ bg, lim, className = "" }: { bg: string; lim: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const move = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const b = ref.current.getBoundingClientRect();
    setR({ x: ((e.clientY - b.top) / b.height - .5) * -12, y: ((e.clientX - b.left) / b.width - .5) * 12 });
  };
  return (
    <div ref={ref} className={className} onMouseMove={move} onMouseLeave={() => setR({ x: 0, y: 0 })} style={{ perspective: 800 }}>
      <div className="w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none" style={{
        background: bg, border: "1px solid rgba(255,255,255,.12)",
        boxShadow: "0 30px 60px -12px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.06) inset",
        transform: `rotateX(${r.x}deg) rotateY(${r.y}deg)`, transition: r.x === 0 ? "transform .5s cubic-bezier(.22,1,.36,1)" : "none",
      }}>
        {/* specular */}
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,.35), transparent 60%)", mixBlendMode: "overlay" }} />
        {/* subtle pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,.5) 50px, rgba(255,255,255,.5) 51px)" }} />
        <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-11 h-8 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.3), inset 0 1px 0 rgba(255,255,255,.3)" }} />
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.8"><path d="M8.5 16.5a5 5 0 0 1 0-9"/><path d="M5 13.5a1 1 0 0 1 0-3"/><path d="M12 19a9 9 0 0 0 0-14"/></svg>
            </div>
            <span className="text-sm font-medium tracking-wide" style={{ color: "rgba(255,255,255,.7)" }}>fiaon</span>
          </div>
          <div className="font-mono text-[13px] sm:text-sm tracking-[.22em]" style={{ color: "rgba(255,255,255,.55)" }}>5232 &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 9012</div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[8px] uppercase tracking-[.16em] font-medium" style={{ color: "rgba(255,255,255,.35)" }}>Kreditlimit</div>
              <div className="font-mono text-sm font-medium" style={{ color: "rgba(255,255,255,.8)" }}>bis {lim} &euro;</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-[.16em] font-medium text-right" style={{ color: "rgba(255,255,255,.35)" }}>G&uuml;ltig bis</div>
              <div className="font-mono text-sm font-medium" style={{ color: "rgba(255,255,255,.8)" }}>12 / 29</div>
            </div>
            <span className="text-base font-semibold tracking-widest" style={{ color: "rgba(255,255,255,.4)" }}>VISA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────
   NAVBAR
   ──────────────────────────────── */
function Nav() {
  const [s, setS] = useState(false);
  const [m, setM] = useState(false);
  useEffect(() => { const f = () => setS(scrollY > 30); addEventListener("scroll", f, { passive: true }); return () => removeEventListener("scroll", f); }, []);
  const lk = [["#beratung","Beratung"],["#pakete","Pakete"],["#ablauf","Ablauf"],["#faq","FAQ"]];
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${s ? "bg-white/80 backdrop-blur-2xl border-b border-gray-100" : ""}`}>
      <div className="max-w-[1120px] mx-auto px-6 h-[64px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center"><span className="text-white text-xs font-semibold">F</span></div>
          <span className="text-[17px] font-semibold tracking-tight text-gray-900">FIAON</span>
        </a>
        <div className="hidden md:flex items-center gap-8">
          {lk.map(([h,l]) => <a key={h} href={h} className="text-[13px] font-medium text-gray-500 hover:text-gray-900 transition-colors">{l}</a>)}
          <a href="#start" className="px-5 py-2 rounded-lg text-[13px] font-medium text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-colors">Kostenlose Beratung</a>
        </div>
        <button className="md:hidden" onClick={() => setM(!m)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">{m ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></> : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}</svg></button>
      </div>
      {m && <div className="md:hidden bg-white border-t border-gray-100 px-6 py-4 space-y-3">{lk.map(([h,l]) => <a key={h} href={h} onClick={() => setM(false)} className="block text-sm font-medium text-gray-700 py-1">{l}</a>)}<a href="#start" onClick={() => setM(false)} className="block text-center py-2.5 rounded-lg text-sm font-medium text-white bg-[#2563eb]">Kostenlose Beratung</a></div>}
    </nav>
  );
}

/* ────────────────────────────────
   HERO
   ──────────────────────────────── */
function Hero() {
  return (
    <section className="relative pt-[120px] sm:pt-[140px] pb-16 sm:pb-24 overflow-hidden bg-gradient-to-b from-[#f8faff] to-white">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-40 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.12), transparent 70%)" }} />
      <div className="max-w-[1120px] mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* copy */}
          <div className="order-2 lg:order-1">
            <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-4">Kreditkarten-Beratung</p>
            <h1 className="text-[2.4rem] sm:text-[3rem] lg:text-[3.4rem] font-semibold leading-[1.1] tracking-tight text-gray-900 mb-6">
              Wir finden die<br/>Kreditkarte, die zu<br/>
              <span className="text-[#2563eb]">deinem Leben passt.</span>
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-relaxed text-gray-500 max-w-[480px] mb-8">
              FIAON berät dich unabhängig und kostenlos bei der Wahl der richtigen Kreditkarte &ndash; mit Limits bis 25.000&nbsp;&euro;, ohne versteckte Kosten. Pers&ouml;nlich, transparent, sicher.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <a href="#start" className="inline-flex items-center justify-center px-7 py-3.5 rounded-lg text-[15px] font-medium text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-all hover:shadow-lg hover:shadow-blue-500/20">
                Jetzt kostenlos beraten lassen
              </a>
              <a href="#ablauf" className="inline-flex items-center justify-center px-7 py-3.5 rounded-lg text-[15px] font-medium text-gray-600 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all">
                So funktioniert&apos;s
              </a>
            </div>
            <div className="flex items-center gap-4 text-[12px] text-gray-400 font-medium">
              <span className="flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Keine SCHUFA-Abfrage
              </span>
              <span className="w-px h-3 bg-gray-200" />
              <span>SSL-verschl&uuml;sselt</span>
              <span className="w-px h-3 bg-gray-200" />
              <span>100% kostenlos</span>
            </div>
          </div>

          {/* cards stack */}
          <div className="order-1 lg:order-2 flex justify-center">
            <div className="relative w-[300px] sm:w-[360px] h-[280px] sm:h-[340px]">
              <div className="absolute top-8 left-6 w-[260px] sm:w-[310px] opacity-30 blur-[2px] fiaon-card-float" style={{ transform: "rotate(6deg)", animationDelay: ".3s" }}>
                <Card bg={PACKS[3].bg} lim={PACKS[3].lim} />
              </div>
              <div className="absolute top-4 left-3 w-[260px] sm:w-[310px] opacity-50 fiaon-card-float" style={{ transform: "rotate(3deg)", animationDelay: ".15s" }}>
                <Card bg={PACKS[2].bg} lim={PACKS[2].lim} />
              </div>
              <div className="relative w-[260px] sm:w-[310px] fiaon-card-float">
                <Card bg={PACKS[1].bg} lim={PACKS[1].lim} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────────
   NUMBERS
   ──────────────────────────────── */
function Numbers() {
  const items = [["12.400+","Beratungen durchgef\u00FChrt"],["25.000 \u20AC","Maximales Kreditlimit"],["< 2 Min","Beratung starten"],["4,9 / 5","Kundenbewertung"]];
  return (
    <section className="py-12 border-y border-gray-100">
      <div className="max-w-[1120px] mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
        {items.map(([v,l],i) => <div key={i} className="text-center"><div className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-tight">{v}</div><div className="text-[12px] text-gray-400 mt-1 font-medium">{l}</div></div>)}
      </div>
    </section>
  );
}

/* ────────────────────────────────
   WHY FIAON — advisory framing
   ──────────────────────────────── */
function WhySection() {
  const obs = useReveal();
  const items = [
    { t: "Unabh\u00E4ngige Beratung", d: "Wir sind kein Kreditkartenanbieter. Wir beraten dich neutral und finden das beste Angebot f\u00FCr deine Situation." },
    { t: "Bis 25.000 \u20AC Limit", d: "Durch unsere Partner-Netzwerke vermitteln wir Kreditkarten mit Limits, die zu deinem Bedarf passen." },
    { t: "Keine SCHUFA-Abfrage", d: "Die Erstberatung und Limit-Pr\u00FCfung ist komplett SCHUFA-neutral. Dein Score bleibt unber\u00FChrt." },
    { t: "Weltweit einsetzbar", d: "Die von uns vermittelten Karten sind bei \u00FCber 40 Mio. Akzeptanzstellen weltweit nutzbar." },
    { t: "Schnell & digital", d: "Keine Filiale, kein Papierkram. Deine Beratung ist in unter 2 Minuten gestartet \u2013 alles online." },
    { t: "DSGVO & Datenschutz", d: "Alle Daten werden auf europ\u00E4ischen Servern verarbeitet. Volle Kontrolle, volle Transparenz." },
  ];
  return (
    <section id="beratung" className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Warum FIAON</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-4">Wir beraten. Du entscheidest.</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">FIAON ist dein unabh&auml;ngiger Partner f&uuml;r Kreditkarten-Beratung &ndash; f&uuml;r Privatpersonen und Unternehmen.</p>
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
   PACKAGES
   ──────────────────────────────── */
function Packages() {
  const obs = useReveal(0.05);
  return (
    <section id="pakete" className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Pakete</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-4">Finde dein passendes Paket</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">Von Einsteiger bis Premium &ndash; wir beraten dich zum optimalen Kreditkarten-Paket. Das finale Limit wird individuell berechnet.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PACKS.map((p, i) => (
            <div key={p.name} className={`rounded-2xl bg-white border overflow-hidden transition-all duration-700 hover:-translate-y-1 hover:shadow-xl ${p.rec ? "border-[#2563eb]/30 shadow-lg shadow-blue-500/5 ring-1 ring-[#2563eb]/10" : "border-gray-100 hover:border-gray-200"} ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 90}ms` }}>
              {p.rec && <div className="h-px bg-[#2563eb]" />}
              <div className="p-4 pb-2"><Card bg={p.bg} lim={p.lim} className="w-full" /></div>
              <div className="p-5 pt-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[15px] font-semibold text-gray-900">FIAON {p.name}</h3>
                  {p.rec && <span className="text-[10px] font-semibold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded">Empfohlen</span>}
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-semibold text-gray-900">{p.fee}</span>
                  <span className="text-[13px] text-gray-400">&euro; / Monat</span>
                </div>
                <ul className="space-y-2 mb-5">
                  {p.feats.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-[13px] text-gray-600">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="#start" className={`block text-center py-2.5 rounded-lg text-[13px] font-medium transition-all ${p.rec ? "text-white bg-[#2563eb] hover:bg-[#1d4ed8]" : "text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100"}`}>
                  Beratung starten
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
   HOW IT WORKS
   ──────────────────────────────── */
function HowItWorks() {
  const obs = useReveal(0.1);
  const steps = [
    { n: "01", t: "Beratung starten", d: "Beantworte ein paar einfache Fragen zu deiner Situation. Dauert unter 2 Minuten." },
    { n: "02", t: "Angebot erhalten", d: "Wir pr\u00FCfen dein Profil und empfehlen dir die passende Kreditkarte \u2013 ohne SCHUFA-Eintrag." },
    { n: "03", t: "Karte beantragen", d: "Wenn du zufrieden bist, leiten wir dich direkt zum Anbieter weiter. Digital, schnell, sicher." },
  ];
  return (
    <section id="ablauf" className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Ablauf</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-4">In 3 Schritten zur passenden Karte</h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">Kein Papierkram, keine Filiale. Alles digital, alles transparent.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((s, i) => (
            <div key={i} className={`relative transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 120}ms` }}>
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
    { n: "Lena M.", r: "Unternehmerin", t: "FIAON hat mir in 10 Minuten geholfen, die richtige Karte f\u00FCr mein Business zu finden. Professionell und unkompliziert." },
    { n: "Tobias K.", r: "Freelancer", t: "Ich war skeptisch, aber die Beratung war wirklich neutral. Keine versteckten Kosten, keine Tricks." },
    { n: "Sara W.", r: "Angestellte", t: "Endlich jemand, der mir erkl\u00E4rt hat, welche Karte zu meiner Situation passt. Kann ich nur empfehlen." },
  ];
  return (
    <section className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Kundenstimmen</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Was unsere Kunden sagen</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {rev.map((r, i) => (
            <div key={i} className={`p-6 rounded-2xl bg-white border border-gray-100 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="flex gap-1 mb-4">{[...Array(5)].map((_, j) => <svg key={j} width="14" height="14" viewBox="0 0 20 20" fill="#2563eb" opacity=".8"><path d="M10 1l2.47 5.01L18 6.76l-4 3.9.94 5.49L10 13.77l-4.94 2.38L6 10.66l-4-3.9 5.53-.75z"/></svg>)}</div>
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
    ["Vergibt FIAON selbst Kreditkarten?", "Nein. FIAON ist ein unabh\u00E4ngiger Beratungsservice. Wir vermitteln und beraten \u2013 die Karte selbst wird vom jeweiligen Partnerinstitut ausgegeben."],
    ["Wird eine SCHUFA-Abfrage durchgef\u00FChrt?", "Bei der Erstberatung und Limit-Pr\u00FCfung erfolgt keine SCHUFA-Abfrage. Erst bei der finalen Beantragung beim Kartenanbieter kann eine Pr\u00FCfung stattfinden."],
    ["Was kostet die Beratung?", "Die Erstberatung und Limit-Pr\u00FCfung ist kostenlos. Die monatlichen Geb\u00FChren beziehen sich auf das jeweilige Kreditkarten-Paket beim Anbieter."],
    ["Welche Limits sind m\u00F6glich?", "Je nach Bonit\u00E4t und Paket vermitteln wir Karten mit Limits von 500 \u20AC bis 25.000 \u20AC."],
    ["F\u00FCr wen ist FIAON geeignet?", "F\u00FCr Privatpersonen, Selbstst\u00E4ndige und Unternehmen. Ob Einsteiger oder Premium \u2013 wir finden die passende L\u00F6sung."],
    ["Wie schnell erhalte ich meine Karte?", "Nach erfolgreicher Beratung und Beantragung ist die digitale Karte oft sofort verf\u00FCgbar. Die physische Karte kommt in 3\u20135 Werktagen."],
  ];
  return (
    <section id="faq" className="py-20 sm:py-28">
      <div className="max-w-[680px] mx-auto px-6">
        <div className="mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">H&auml;ufige Fragen</h2>
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
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900 mb-4">Bereit f&uuml;r die passende Kreditkarte?</h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8">Starte jetzt deine kostenlose Beratung &ndash; unverbindlich, ohne SCHUFA-Abfrage, in unter 2 Minuten.</p>
        <a href="#" className="inline-flex items-center px-8 py-3.5 rounded-lg text-[15px] font-medium text-white bg-[#2563eb] hover:bg-[#1d4ed8] transition-all hover:shadow-lg hover:shadow-blue-500/20">
          Kostenlose Beratung starten
        </a>
        <div className="flex items-center justify-center gap-5 mt-5 text-[12px] text-gray-400 font-medium">
          <span>Kostenlos</span>
          <span className="w-px h-3 bg-gray-200" />
          <span>Keine SCHUFA</span>
          <span className="w-px h-3 bg-gray-200" />
          <span>Unverbindlich</span>
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
    <footer className="border-t border-gray-100 py-12">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center"><span className="text-white text-[10px] font-semibold">F</span></div><span className="text-[15px] font-semibold text-gray-900">FIAON</span></div>
            <p className="text-[13px] text-gray-500 leading-relaxed max-w-[240px]">Unabh&auml;ngige Kreditkarten-Beratung f&uuml;r Privatpersonen und Unternehmen.</p>
          </div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Beratung</div><ul className="space-y-2">{[["#beratung","Warum FIAON"],["#pakete","Pakete"],["#ablauf","Ablauf"],["#faq","FAQ"]].map(([h,l]) => <li key={h}><a href={h} className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>)}</ul></div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Rechtliches</div><ul className="space-y-2">{[["/terms","AGB"],["/privacy","Datenschutz"],["#","Impressum"]].map(([h,l]) => <li key={h}><a href={h} className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>)}</ul></div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Kontakt</div><ul className="space-y-2"><li><a href="mailto:support@fiaon.com" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">support@fiaon.com</a></li><li><span className="text-[13px] text-gray-500">Mo&ndash;Fr, 9&ndash;18 Uhr</span></li></ul></div>
        </div>
        <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-[12px] text-gray-400">&copy; {new Date().getFullYear()} FIAON. Alle Rechte vorbehalten.</span>
          <span className="text-[11px] text-gray-400">FIAON ist ein Beratungsservice und kein Kreditinstitut.</span>
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
      <Nav />
      <Hero />
      <Numbers />
      <WhySection />
      <Packages />
      <HowItWorks />
      <Reviews />
      <Faq />
      <Cta />
      <Foot />
    </div>
  );
}
