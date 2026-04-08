import { useState, useEffect, useRef } from "react";

/* ── Intersection Observer hook ──── */
function useInView(t = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setV(true); io.disconnect(); } }, { threshold: t });
    io.observe(el); return () => io.disconnect();
  }, [t]);
  return { ref, visible: v };
}

/* ── Animated counter ──── */
function AnimNum({ target, suffix = "", prefix = "" }: { target: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useInView(0.3);
  useEffect(() => {
    if (!visible) return; let start = 0;
    const step = (ts: number) => { if (!start) start = ts; const p = Math.min((ts - start) / 1800, 1); setVal(Math.floor(p * target)); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [visible, target]);
  return <span ref={ref}>{prefix}{val.toLocaleString("de-DE")}{suffix}</span>;
}

/* ── Icons ──── */
const Chk = ({ s = 14, c = "#2563EB" }: { s?: number; c?: string }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 12 10 16 18 8"/></svg>
);
const ArrowR = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-2 inline-block group-hover:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
);

/* ── Package data ──── */
const PACKS = [
  { key:"start", name:"FIAON Starter", tag:"Einstieg", rec:false, price:"7,99", lim:"500", bg:"linear-gradient(145deg,#1E40AF,#3B82F6,#60A5FA)", feats:["Limit bis 500 \u20AC","E-Mail Support","NFC kontaktlos","Online-Banking App"] },
  { key:"pro", name:"FIAON Pro", tag:"Empfohlen", rec:true, price:"59,99", lim:"5.000", bg:"linear-gradient(145deg,#5B21B6,#7C3AFF,#A78BFA)", feats:["Limit bis 5.000 \u20AC","Priority Support","NFC kontaktlos","Cashback-Programm"] },
  { key:"ultra", name:"FIAON Ultra", tag:"Mehr Limit", rec:false, price:"79,99", lim:"15.000", bg:"linear-gradient(145deg,#0E7490,#06B6D4,#22D3EE)", feats:["Limit bis 15.000 \u20AC","Priority Support","Reise-Versicherung","Lounge-Zugang"] },
  { key:"highend", name:"FIAON High End", tag:"Maximum", rec:false, price:"99,99", lim:"25.000", bg:"linear-gradient(145deg,#111827,#1F2937,#374151)", feats:["Limit bis 25.000 \u20AC","24/7 VIP Support","Concierge-Service","Premium Lounge"] },
];

/* ═══════════════════════════════════════
   CREDIT CARD — 3D tilt + realistic
   ═══════════════════════════════════════ */
function FiaonCard({ bg, limit, className = "", tilt = true }: { bg: string; limit: string; className?: string; tilt?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [rot, setRot] = useState({ x: 0, y: 0 });
  const onMove = (e: React.MouseEvent) => {
    if (!tilt || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setRot({ x: ((e.clientY - r.top) / r.height - 0.5) * -14, y: ((e.clientX - r.left) / r.width - 0.5) * 14 });
  };

  return (
    <div ref={ref} className={`relative ${className}`} onMouseMove={onMove} onMouseLeave={() => setRot({ x: 0, y: 0 })} style={{ perspective: "800px" }}>
      <div className="w-full aspect-[1.586/1] rounded-[18px] overflow-hidden relative select-none" style={{
        background: bg, border: "1px solid rgba(255,255,255,0.15)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset",
        transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`,
        transition: rot.x === 0 ? "transform 0.6s cubic-bezier(.22,1,.36,1)" : "none",
      }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.45), transparent 55%)", mixBlendMode: "overlay" }} />
        <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-10 h-7 rounded-md" style={{ background: "linear-gradient(135deg,#C4A962,#E8D5A0,#C4A962)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }} />
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2"><path d="M8.5 16.5a5 5 0 0 1 0-9M12 19a9 9 0 0 0 0-14M5 13.5a1 1 0 0 1 0-3"/></svg>
            </div>
            <span className="text-[15px] font-black tracking-tight lowercase" style={{ color: "rgba(255,255,255,0.88)" }}>fiaon</span>
          </div>
          <div className="text-center">
            <span className="text-sm sm:text-base tracking-[0.22em] font-mono" style={{ color: "rgba(255,255,255,0.65)" }}>5232 **** **** 9012</span>
          </div>
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Kreditlimit</div>
              <div className="font-mono font-bold text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>bis {limit} &euro;</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-[0.14em] font-bold" style={{ color: "rgba(255,255,255,0.4)" }}>Valid Thru</div>
              <div className="font-mono font-bold text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>12/29</div>
            </div>
            <span className="text-lg font-black tracking-wider" style={{ color: "rgba(255,255,255,0.55)" }}>VISA</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   NAVBAR
   ═══════════════════════════════════════ */
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mob, setMob] = useState(false);
  useEffect(() => { const fn = () => setScrolled(window.scrollY > 20); window.addEventListener("scroll", fn, { passive: true }); return () => window.removeEventListener("scroll", fn); }, []);
  const links = [{ href:"#pakete", l:"Pakete" },{ href:"#features", l:"Vorteile" },{ href:"#how", l:"So geht\u2019s" },{ href:"#faq", l:"FAQ" }];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${scrolled ? "bg-white/80 backdrop-blur-2xl shadow-[0_1px_0_rgba(0,0,0,0.04)]" : ""}`}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 sm:h-[72px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 fiaon-dot-pulse" />
          <span className="text-xl font-black tracking-tight text-gray-900">FIAON</span>
        </a>
        <div className="hidden md:flex items-center gap-7">
          {links.map(l => <a key={l.href} href={l.href} className="text-[13px] font-semibold text-gray-500 hover:text-gray-900 transition-colors">{l.l}</a>)}
          <a href="#cta" className="group inline-flex items-center gap-1 px-5 py-2.5 rounded-full text-[13px] font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-[1.03] active:scale-[0.97] transition-all">
            Limit-Check starten <ArrowR />
          </a>
        </div>
        <button className="md:hidden p-2 -mr-2" onClick={() => setMob(!mob)} aria-label="Menu">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">
            {mob ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></> : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}
          </svg>
        </button>
      </div>
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mob ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="bg-white/95 backdrop-blur-xl border-t border-gray-100 px-5 pb-6 pt-4 space-y-3">
          {links.map(l => <a key={l.href} href={l.href} onClick={() => setMob(false)} className="block py-2 text-base font-semibold text-gray-700">{l.l}</a>)}
          <a href="#cta" onClick={() => setMob(false)} className="block w-full text-center py-3.5 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600">Limit-Check starten</a>
        </div>
      </div>
    </nav>
  );
}

/* ═══════════════════════════════════════
   HERO
   ═══════════════════════════════════════ */
function HeroSection() {
  return (
    <section className="relative pt-28 sm:pt-36 pb-8 sm:pb-16 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] pointer-events-none opacity-30" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.18) 0%, rgba(124,58,255,0.08) 40%, transparent 70%)" }} />
      <div className="max-w-6xl mx-auto px-5 sm:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.12em] border border-blue-100 bg-blue-50/60 text-blue-600 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" /> Bereits 1.200+ aktive Nutzer
            </div>
            <h1 className="text-[clamp(2.2rem,5.5vw,4.2rem)] font-black leading-[1.05] tracking-tight text-gray-900 mb-5">
              Dein Finanz-Limit.<br/>
              <span className="fiaon-gradient-text">Ohne Kompromisse.</span>
            </h1>
            <p className="text-base sm:text-lg text-gray-500 leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              FIAON verbindet erstklassige Finanzdienstleistungen mit modernster Technologie &ndash; f&uuml;r Privatpersonen und Unternehmen. Erlebe Premium-Service, der sich an dein Leben anpasst.
            </p>
            <div className="flex flex-col items-center lg:items-start gap-3">
              <a href="#cta" className="group relative inline-flex items-center px-8 py-4 rounded-full text-[15px] font-bold text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-2xl hover:shadow-blue-500/30 hover:scale-[1.03] active:scale-[0.97] transition-all overflow-hidden">
                <span className="fiaon-shimmer" />
                <span className="relative flex items-center">Jetzt mein Limit pr&uuml;fen (Kostenlos) <ArrowR /></span>
              </a>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-400">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                Keine SCHUFA-Abfrage &middot; SSL-verschl&uuml;sselt
              </span>
            </div>
          </div>
          <div className="relative flex justify-center order-1 lg:order-2">
            <div className="relative w-[300px] sm:w-[370px] h-[300px] sm:h-[370px]">
              <div className="absolute inset-0 rounded-full" style={{ background: "conic-gradient(from 0deg, rgba(37,99,235,0.15), rgba(124,58,255,0.1), rgba(6,182,212,0.1), rgba(37,99,235,0.15))", filter: "blur(30px)" }} />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[260px] sm:w-[320px] fiaon-card-float">
                <div className="absolute top-3 left-3 sm:top-4 sm:left-4 w-full opacity-40 blur-[1px]" style={{ transform: "rotate(8deg) scale(0.92)" }}>
                  <FiaonCard bg={PACKS[3].bg} limit={PACKS[3].lim} tilt={false} />
                </div>
                <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 w-full opacity-60" style={{ transform: "rotate(4deg) scale(0.96)" }}>
                  <FiaonCard bg={PACKS[2].bg} limit={PACKS[2].lim} tilt={false} />
                </div>
                <div className="relative w-full">
                  <FiaonCard bg={PACKS[1].bg} limit={PACKS[1].lim} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   TRUST BAR
   ═══════════════════════════════════════ */
function TrustBar() {
  const stats = [{ n:25000, suf:"\u20AC", l:"Max. Kreditlimit" },{ n:0, suf:"\u20AC", l:"Jahresgeb\u00FChr*" },{ n:0, suf:"%", l:"Auslandsgeb\u00FChren*" },{ n:2, pre:"< ", suf:" Min", l:"Sofort-Pr\u00FCfung" }];
  return (
    <section className="py-10 sm:py-14 border-y border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4">
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900"><AnimNum target={s.n} prefix={s.pre || ""} suffix={s.suf} /></div>
            <div className="text-xs sm:text-sm text-gray-400 mt-1 font-semibold">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   PACKAGES — emotional centerpiece
   ═══════════════════════════════════════ */
function PackagesSection() {
  const obs = useInView(0.05);
  return (
    <section id="pakete" className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4"><span className="w-7 h-0.5 rounded bg-gradient-to-r from-blue-500 to-purple-500" />Pakete</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">W&auml;hle dein FIAON Paket</h2>
          <p className="text-base sm:text-lg text-gray-400 mt-4 max-w-2xl mx-auto">Von Einsteiger bis High End &ndash; das endg&uuml;ltige Limit wird individuell festgelegt.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {PACKS.map((p, i) => (
            <div key={p.key} className={`relative group rounded-[22px] border bg-white overflow-hidden transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl ${p.rec ? "border-purple-200 shadow-xl shadow-purple-500/10 ring-1 ring-purple-100" : "border-gray-100 hover:border-blue-100 hover:shadow-blue-500/10"} ${obs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 100}ms` }}>
              {p.rec && <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-400" />}
              <div className="p-5 pb-3"><FiaonCard bg={p.bg} limit={p.lim} className="w-full" /></div>
              <div className="px-5 pb-6 flex flex-col flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-black tracking-tight text-gray-900">{p.name}</h3>
                  <span className={`text-[10px] font-black uppercase tracking-[0.12em] px-2.5 py-1 rounded-full border ${p.rec ? "border-purple-200 bg-purple-50 text-purple-600" : "border-gray-100 bg-gray-50 text-gray-400"}`}>{p.tag}</span>
                </div>
                <div className="flex items-baseline gap-1.5 mb-4">
                  <span className="font-mono font-black text-3xl tracking-tight text-gray-900">{p.price}</span>
                  <span className="text-sm font-bold text-gray-400">&euro; / Monat</span>
                </div>
                <ul className="space-y-2.5 mb-5 flex-1">
                  {p.feats.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-[13px] font-semibold text-gray-600">
                      <span className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center shrink-0"><Chk s={12} /></span>{f}
                    </li>
                  ))}
                </ul>
                <a href="#cta" className={`block w-full text-center py-3 rounded-xl text-[13px] font-bold transition-all ${p.rec ? "text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:shadow-lg hover:shadow-purple-500/25" : "text-gray-700 bg-gray-50 border border-gray-100 hover:bg-gray-100"}`}>
                  Paket w&auml;hlen
                </a>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-gray-400 mt-8">* Abh&auml;ngig vom gew&auml;hlten Paket. Das endg&uuml;ltige Kreditlimit wird individuell berechnet.</p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════ */
const FICONS = [
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7C3AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M16 12h.01"/><path d="M2 10h20"/></svg>,
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>,
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
];

function FeaturesSection() {
  const obs = useInView(0.05);
  const ff = [
    { t:"H\u00F6chste Sicherheit", d:"3D Secure, biometrische Authentifizierung und Echtzeit-Alerts bei jeder Transaktion." },
    { t:"Weltweit einsetzbar", d:"In \u00FCber 200 L\u00E4ndern akzeptiert \u2013 online und offline, ohne Auslandsgeb\u00FChren." },
    { t:"Apple Pay & Google Pay", d:"F\u00FCge deine FIAON Card in Sekunden hinzu und bezahle kontaktlos \u00FCberall." },
    { t:"Reiseschutz inklusive", d:"Umfassende Reiseversicherung und Lounge-Zugang an 1.300+ Flugh\u00E4fen." },
    { t:"Flexibles Limit", d:"Dein Limit w\u00E4chst mit dir. Je mehr du nutzt, desto mehr Spielraum." },
    { t:"DSGVO-konform", d:"Europ\u00E4ische Server, volle Transparenz, volle Kontrolle \u00FCber deine Daten." },
  ];
  return (
    <section id="features" className="py-20 sm:py-28 bg-gradient-to-b from-gray-50/50 to-white" ref={obs.ref}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4"><span className="w-7 h-0.5 rounded bg-gradient-to-r from-blue-500 to-purple-500" />Vorteile</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">Alles, was du brauchst</h2>
          <p className="text-base sm:text-lg text-gray-400 mt-4 max-w-xl mx-auto">Jede Funktion f&uuml;r maximale Freiheit und Sicherheit &ndash; f&uuml;r Privat und Business.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {ff.map((f, i) => (
            <div key={i} className={`group p-6 rounded-2xl border border-gray-100 bg-white hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500 ${obs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-gradient-to-br from-gray-50 to-white border border-gray-100 group-hover:scale-110 transition-transform">{FICONS[i]}</div>
              <h3 className="text-base font-bold text-gray-900 mb-1.5">{f.t}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{f.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   B2B / B2C
   ═══════════════════════════════════════ */
function B2Section() {
  const obs = useInView();
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4"><span className="w-7 h-0.5 rounded bg-gradient-to-r from-blue-500 to-purple-500" />Privat & Business</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">L&ouml;sungen f&uuml;r jeden Bedarf</h2>
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <div className={`relative p-8 sm:p-10 rounded-3xl border border-gray-100 bg-white overflow-hidden transition-all duration-700 ${obs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #2563EB, transparent)" }} />
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">F&uuml;r Privatpersonen</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">Vom Studenten bis zum Vielreisenden &ndash; flexible Limits, die sich deinem Lebensstil anpassen.</p>
            <ul className="space-y-2">{["Bis 25.000\u20AC Limit","Weltweit geb\u00FChrenfrei","Sofort digitale Karte","Cashback & Rewards"].map((t,i) => <li key={i} className="flex items-center gap-2.5 text-sm font-semibold text-gray-600"><Chk s={14}/> {t}</li>)}</ul>
          </div>
          <div className={`relative p-8 sm:p-10 rounded-3xl border border-gray-100 bg-white overflow-hidden transition-all duration-700 ${obs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: "150ms" }}>
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-5" style={{ background: "radial-gradient(circle, #7C3AFF, transparent)" }} />
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AFF" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-8v4h8V3z"/></svg>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">F&uuml;r Unternehmen</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">Team-Karten, Ausgabenmanagement und dedizierter Account-Manager f&uuml;r Ihr Business.</p>
            <ul className="space-y-2">{["Team-Karten mit Limits","Echtzeit-Ausgabenkontrolle","Dedizierter Account-Manager","API & Integrationen"].map((t,i) => <li key={i} className="flex items-center gap-2.5 text-sm font-semibold text-gray-600"><Chk s={14} c="#7C3AFF"/> {t}</li>)}</ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════ */
function HowItWorks() {
  const obs = useInView(0.1);
  const steps = [
    { n:"01", t:"Limit pr\u00FCfen", d:"In unter 2 Min dein Limit erfahren \u2013 ohne SCHUFA.", ic:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="1.8" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> },
    { n:"02", t:"Identit\u00E4t best\u00E4tigen", d:"Bequem per Video-Ident von zu Hause.", ic:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#7C3AFF" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-7 8-7s8 3 8 7"/></svg> },
    { n:"03", t:"Karte nutzen", d:"Digitale Karte sofort. Physisch in 3\u20135 Werktagen.", ic:<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg> },
  ];
  return (
    <section id="how" className="py-20 sm:py-28 bg-gradient-to-b from-white to-gray-50/50" ref={obs.ref}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4"><span className="w-7 h-0.5 rounded bg-gradient-to-r from-blue-500 to-purple-500" />So geht&rsquo;s</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">In 3 Schritten starten</h2>
          <p className="text-base sm:text-lg text-gray-400 mt-4 max-w-xl mx-auto">Kein Papierkram, keine Wartezeit. Alles digital.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 relative">
          <div className="hidden md:block absolute top-[52px] left-[16.67%] right-[16.67%] h-px bg-gradient-to-r from-blue-200 via-purple-200 to-green-200" />
          {steps.map((s, i) => (
            <div key={i} className={`relative text-center p-8 rounded-2xl bg-white border border-gray-100 transition-all duration-500 ${obs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 150}ms` }}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center bg-gradient-to-br from-gray-50 to-white border border-gray-100 relative z-10">{s.ic}</div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-300 mb-2">Schritt {s.n}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{s.t}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════ */
function Testimonials() {
  const obs = useInView(0.1);
  const rev = [
    { n:"Lena M.", r:"Unternehmerin", t:"Endlich ein Service, der so flexibel ist wie mein Business. Das Limit hat sich in 3 Monaten verdoppelt." },
    { n:"Tobias K.", r:"Freelancer", t:"Keine Auslandsgeb\u00FChren auf Reisen \u2013 spart mir 500\u20AC/Jahr. Die App ist unglaublich smooth." },
    { n:"Sara W.", r:"Studentin", t:"Ich dachte, Premium w\u00E4re unerreichbar. Bei FIAON habe ich sofort Top-Konditionen bekommen." },
    { n:"Marcus H.", r:"CEO", t:"Die B2B-L\u00F6sung war in 24h eingerichtet. Ausgabenkontrolle in Echtzeit \u2013 genial." },
  ];
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4"><span className="w-7 h-0.5 rounded bg-gradient-to-r from-blue-500 to-purple-500" />Kundenstimmen</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">Was unsere Nutzer sagen</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {rev.map((r, i) => (
            <div key={i} className={`p-6 rounded-2xl bg-white border border-gray-100 hover:shadow-lg hover:border-blue-50 transition-all duration-500 ${obs.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${i * 80}ms` }}>
              <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, j) => <svg key={j} width="15" height="15" viewBox="0 0 18 18" fill="#FBBF24"><path d="M9 1l2.47 5.01L17 6.76l-4 3.9.94 5.49L9 13.77l-4.94 2.38L5 10.66l-4-3.9 5.53-.75z"/></svg>)}</div>
              <p className="text-sm text-gray-600 leading-relaxed mb-5">&bdquo;{r.t}&ldquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-br from-blue-500 to-purple-600">{r.n[0]}</div>
                <div><div className="text-sm font-bold text-gray-900">{r.n}</div><div className="text-xs text-gray-400">{r.r}</div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   FAQ
   ═══════════════════════════════════════ */
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = [
    { q:"Wird eine SCHUFA-Abfrage durchgef\u00FChrt?", a:"Bei der Limit-Pr\u00FCfung wird keine harte SCHUFA-Anfrage gestellt. Erst nach endg\u00FCltiger Beantragung erfolgt eine Pr\u00FCfung." },
    { q:"Wie schnell erhalte ich meine Karte?", a:"Digitale Karte sofort nach Identit\u00E4tspr\u00FCfung. Physische Karte in 3\u20135 Werktagen." },
    { q:"Welche Pakete gibt es?", a:"Starter (7,99\u20AC/Mt.), Pro (59,99\u20AC/Mt.), Ultra (79,99\u20AC/Mt.) und High End (99,99\u20AC/Mt.) mit verschiedenen Limits und Features." },
    { q:"Wie hoch ist mein Limit?", a:"Individuell berechnet \u2013 bis zu 25.000\u20AC beim High End Paket." },
    { q:"Kann ich als Selbstst\u00E4ndiger beantragen?", a:"Ja. FIAON ist f\u00FCr Privatpersonen, Freelancer und Unternehmen verf\u00FCgbar." },
    { q:"Wie k\u00FCndige ich?", a:"Jederzeit kostenlos in der App. Keine Mindestlaufzeit, keine K\u00FCndigungsfrist." },
  ];
  return (
    <section id="faq" className="py-20 sm:py-28 bg-gradient-to-b from-gray-50/50 to-white">
      <div className="max-w-3xl mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] text-blue-600 mb-4"><span className="w-7 h-0.5 rounded bg-gradient-to-r from-blue-500 to-purple-500" />FAQ</div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900">H&auml;ufige Fragen</h2>
        </div>
        <div className="space-y-2.5">
          {faqs.map((f, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white overflow-hidden transition-all hover:border-blue-100">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left px-6 py-5 flex items-center justify-between gap-4">
                <span className="text-[15px] font-bold text-gray-900">{f.q}</span>
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${open === i ? "bg-blue-50 rotate-180" : "bg-gray-50"}`}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={open === i ? "#2563EB" : "#999"} strokeWidth="2.5" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-48 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-6 pb-5"><p className="text-sm text-gray-500 leading-relaxed">{f.a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   FINAL CTA
   ═══════════════════════════════════════ */
function FinalCTA() {
  return (
    <section id="cta" className="py-20 sm:py-28">
      <div className="max-w-4xl mx-auto px-5 sm:px-8">
        <div className="relative p-10 sm:p-16 rounded-[28px] overflow-hidden" style={{ background: "linear-gradient(135deg, #0f172a, #1e293b)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 30% 50%, rgba(37,99,235,0.2) 0%, transparent 60%)" }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 70% 50%, rgba(124,58,255,0.12) 0%, transparent 60%)" }} />
          <div className="relative z-10 text-center">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4">
              Bereit f&uuml;r dein<br/>neues Finanz-Limit?
            </h2>
            <p className="text-base sm:text-lg text-blue-200/50 mb-8 max-w-lg mx-auto">
              Pr&uuml;fe jetzt kostenlos dein Limit &ndash; in unter 2 Minuten. Ohne SCHUFA-Eintrag.
            </p>
            <a href="#" className="group relative inline-flex items-center px-8 py-4 rounded-full text-[15px] font-bold text-gray-900 bg-white hover:bg-gray-50 transition-all hover:shadow-2xl hover:scale-[1.03] active:scale-[0.97]">
              Jetzt Limit-Check starten <ArrowR />
            </a>
            <div className="flex flex-wrap items-center justify-center gap-5 mt-6 text-sm text-blue-200/40">
              <span className="flex items-center gap-1.5"><Chk s={14} c="rgba(147,197,253,0.5)"/> Kostenlos</span>
              <span className="flex items-center gap-1.5"><Chk s={14} c="rgba(147,197,253,0.5)"/> Kein SCHUFA-Eintrag</span>
              <span className="flex items-center gap-1.5"><Chk s={14} c="rgba(147,197,253,0.5)"/> In 2 Min.</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════ */
function Footer() {
  return (
    <footer className="border-t border-gray-100 py-12 sm:py-16">
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3"><span className="w-2 h-2 rounded-full bg-gradient-to-br from-blue-500 to-purple-600" /><span className="text-lg font-black text-gray-900">FIAON</span></div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">Premium-Finanzdienstleistungen f&uuml;r Privatpersonen und Unternehmen. Bis zu 25.000&euro; Limit.</p>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-4">Produkt</div>
            <ul className="space-y-2.5">
              {[["#pakete","Pakete"],["#features","Vorteile"],["#how","So geht\u2019s"],["#faq","FAQ"]].map(([h,l]) => <li key={h}><a href={h} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>)}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-4">Rechtliches</div>
            <ul className="space-y-2.5">
              {[["/terms","AGB"],["/privacy","Datenschutz"],["#","Impressum"]].map(([h,l]) => <li key={h}><a href={h} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>)}
            </ul>
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 mb-4">Kontakt</div>
            <ul className="space-y-2.5">
              <li><a href="mailto:support@fiaon.com" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">support@fiaon.com</a></li>
              <li><span className="text-sm text-gray-500">Mo&ndash;Fr, 9&ndash;18 Uhr</span></li>
            </ul>
          </div>
        </div>
        <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-400">&copy; {new Date().getFullYear()} FIAON. Alle Rechte vorbehalten.</span>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>Visa Partner</span><span className="w-1 h-1 rounded-full bg-gray-300" /><span>PCI DSS</span><span className="w-1 h-1 rounded-full bg-gray-300" /><span>EU Server</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════
   MAIN EXPORT
   ═══════════════════════════════════════ */
export default function FiaonLanding() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Outfit', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <Navbar />
      <HeroSection />
      <TrustBar />
      <PackagesSection />
      <FeaturesSection />
      <B2Section />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
