import { useState, useEffect, useRef } from "react";

function useReveal(t = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, set] = useState(false);
  useEffect(() => { const el = ref.current; if (!el) return; const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { set(true); io.disconnect(); } }, { threshold: t }); io.observe(el); return () => io.disconnect(); }, [t]);
  return { ref, v };
}

function G({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

/* ── nav ── */
function Nav() {
  const [vis, setVis] = useState(true);
  const [bg, setBg] = useState(false);
  const lastY = useRef(0);
  const [mob, setMob] = useState(false);
  useEffect(() => { const fn = () => { const y = scrollY; setVis(y < 60 || y < lastY.current); setBg(y > 30); lastY.current = y; }; addEventListener("scroll", fn, { passive: true }); return () => removeEventListener("scroll", fn); }, []);
  const pages = [{ label: "Startseite", href: "/", active: false }, { label: "Privatkunden", href: "/privatkunden", active: true }, { label: "Business", href: "/business", active: false }];
  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${vis ? "translate-y-0" : "-translate-y-full"} ${bg ? "bg-white/85 backdrop-blur-2xl border-b border-gray-100/80" : ""}`}>
      <div className="max-w-[1120px] mx-auto px-6 h-[60px] flex items-center justify-between">
        <a href="/" className="flex items-center gap-2"><div className="w-7 h-7 rounded-lg bg-[#2563eb] flex items-center justify-center"><span className="text-white text-xs font-semibold">F</span></div><span className="text-[17px] font-semibold tracking-tight text-gray-900">FIAON</span></a>
        <div className="hidden md:flex items-center gap-8">
          {pages.map(p => <a key={p.label} href={p.href} className="relative text-[13px] font-medium text-gray-900 pb-1">{p.label}{p.active && <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 8px rgba(37,99,235,.5)" }} />}</a>)}
          <a href="#start" className="fiaon-btn-gradient px-5 py-2 rounded-lg text-[13px] font-medium text-white">Potenzial-Analyse starten</a>
        </div>
        <button className="md:hidden" onClick={() => setMob(!mob)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round">{mob ? <><path d="M18 6L6 18"/><path d="M6 6l12 12"/></> : <><path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/></>}</svg></button>
      </div>
      <div className={`md:hidden overflow-hidden transition-all duration-300 ${mob ? "max-h-[350px]" : "max-h-0"}`}>
        <div className="bg-white border-t border-gray-100 px-6 py-4 space-y-3">
          {pages.map(p => <a key={p.label} href={p.href} onClick={() => setMob(false)} className="flex items-center gap-2 text-sm font-medium text-gray-700 py-1">{p.label}{p.active && <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 6px rgba(37,99,235,.5)" }} />}</a>)}
          <a href="#start" onClick={() => setMob(false)} className="block text-center py-2.5 rounded-lg text-sm font-medium text-white fiaon-btn-gradient">Potenzial-Analyse starten</a>
        </div>
      </div>
    </nav>
  );
}

/* ── card ── */
function FCard({ bg, lim, label, className = "" }: { bg: string; lim: string; label: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const move = (e: React.MouseEvent) => { if (!ref.current) return; const b = ref.current.getBoundingClientRect(); setR({ x: ((e.clientY - b.top) / b.height - .5) * -10, y: ((e.clientX - b.left) / b.width - .5) * 10 }); };
  return (
    <div ref={ref} className={className} onMouseMove={move} onMouseLeave={() => setR({ x: 0, y: 0 })} style={{ perspective: 900 }}>
      <div className="w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none" style={{
        background: bg, border: "1px solid rgba(255,255,255,.1)",
        boxShadow: "0 24px 48px -8px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.05) inset",
        transform: `rotateX(${r.x}deg) rotateY(${r.y}deg)`, transition: r.x === 0 ? "transform .5s cubic-bezier(.22,1,.36,1)" : "none",
      }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,.25), transparent 55%)", mixBlendMode: "overlay" }} />
        <div className="absolute inset-0 fiaon-card-shimmer pointer-events-none" />
        <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="w-10 h-7 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
            <span className="text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>FIAON</span>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-[.14em] font-medium mb-0.5" style={{ color: "rgba(255,255,255,.35)" }}>{label}</div>
            <div className="font-mono text-lg font-semibold" style={{ color: "rgba(255,255,255,.9)" }}>{lim}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── packages ── */
const PACKS = [
  { name: "FIAON Restart", tier: "Schneller Aufbau", lim: "Prepaid + Limit-Option", bg: "linear-gradient(135deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats: ["Prepaid-Basis mit sp\u00E4terer Limit-Option", "Idealer Einstieg f\u00FCr den Neustart", "Kontaktlos & Apple Pay / Google Pay", "Sofort nutzbar nach Aktivierung"] },
  { name: "FIAON Freedom", tier: "Echte Kreditkarte", lim: "Cashflow-basiertes Limit", rec: true, bg: "linear-gradient(135deg,#0b1628,#1a3560,#1e4070)", feats: ["Echte Kreditkarte \u00FCber Auslandspartner", "Limit basierend auf Cashflow, nicht Schufa", "Strategisches Coaching inklusive", "Monatliche Limit-\u00DCberpr\u00FCfung"] },
  { name: "FIAON Premium", tier: "Volle Struktur", lim: "Individuelle Vereinbarung", bg: "linear-gradient(135deg,#111,#1a1a1a,#2a2a2a)", feats: ["Zus\u00E4tzliche Kontenstrukturen", "Pf\u00E4ndungsschutz-Beratung im Ausland", "VIP Support & pers\u00F6nlicher Berater", "Kompletter Finanz-Neuaufbau"] },
];

/* ═══════════════════════════════
   HERO
   ═══════════════════════════════ */
function Hero() {
  return (
    <section className="relative pt-[110px] sm:pt-[130px] pb-12 sm:pb-20 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-25 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.12), transparent 70%)" }} />
      <div className="max-w-[1120px] mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 8px rgba(37,99,235,.4)" }} />
          <span className="text-[13px] font-semibold text-gray-500">Exklusiv f&uuml;r Privatkunden &middot; Europaweites Banking</span>
        </div>

        <h1 className="text-[2.2rem] sm:text-[3rem] md:text-[3.6rem] lg:text-[4rem] font-semibold leading-[1.08] tracking-tight mb-6">
          <G>Deine Hausbank sagt Nein.</G><br/>
          <span className="text-gray-400">Wir sagen: Lass uns arbeiten.</span>
        </h1>

        <p className="text-[15px] sm:text-[16px] text-gray-500 leading-relaxed max-w-[600px] mx-auto mb-8">
          Der Schufa-Score definiert nicht deinen Wert. Wir er&ouml;ffnen dir den Zugang zu Premium-Kreditkarten und internationalen Finanzstrukturen, f&uuml;r die du in Deutschland abgelehnt wirst. Ohne falsche Versprechungen. Nur echte L&ouml;sungen.
        </p>

        <div className="mb-3">
          <a href="#start" className="fiaon-btn-gradient inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-[15px] font-medium text-white">
            Kostenlose Potenzial-Analyse starten
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </a>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4 text-[12px] text-gray-400 font-medium mb-14">
          <span>100% Schufaneutrale Anfrage</span>
          <span className="w-px h-3 bg-gray-200 hidden sm:block" />
          <span>Kein Vorkosten-Betrug</span>
          <span className="w-px h-3 bg-gray-200 hidden sm:block" />
          <span>Gepr&uuml;fte Partnerbanken im Ausland</span>
        </div>

        <div className="max-w-[440px] mx-auto fiaon-card-float">
          <FCard bg="linear-gradient(135deg,#0b1628,#1a3560,#0b1628)" lim="bis 25.000 &euro;" label="Premium Kreditkarte" />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════
   AGITATION — dark section
   ═══════════════════════════════ */
function Agitation() {
  const obs = useReveal();
  return (
    <section className="py-20 sm:py-28" style={{ background: "linear-gradient(180deg,#0b1628,#0f1d34)" }} ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className={`text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight mb-6 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            Gefangen im System?<br/>Wir brechen die Regeln. Legal.
          </h2>
          <p className={`text-[15px] sm:text-[16px] text-gray-400 leading-relaxed max-w-[640px] mx-auto transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            Du hast Visionen, du hast Pl&auml;ne &ndash; aber ein einziger negativer Eintrag aus der Vergangenheit versperrt dir jede T&uuml;r. Deutsche Banken schauen nur auf Algorithmen, nicht auf den Menschen. Gleichzeitig wimmelt es im Internet von &bdquo;Kredit-Vermittlern&ldquo;, die nur deine Daten oder Vorkasse wollen. Schluss damit.
          </p>
        </div>

        <div className={`grid md:grid-cols-3 gap-5 transition-all duration-700 delay-200 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {[
            { title: "Das Problem", text: "Algorithmen entscheiden \u00FCber deine finanzielle Freiheit. Dein Score ist ein Relikt \u2013 aber er kontrolliert dein ganzes Leben." },
            { title: "Die Scammer", text: "Dubiose Angebote, die dich noch tiefer in die Schuldenfalle treiben. Vorkasse, falsche Versprechen, gestohlene Daten." },
            { title: "Der FIAON-Weg", text: "Wir nutzen unser Netzwerk zu etablierten, ausl\u00E4ndischen Finanzinstituten, die andere Bewertungskriterien anlegen als die deutsche Schufa." },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl p-6 sm:p-7 border border-white/[0.06] bg-white/[0.03]" style={{ transitionDelay: `${200 + i * 80}ms` }}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb] mb-3">{item.title}</p>
              <p className="text-[14px] text-gray-400 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════
   SOLUTION — the "aha" moment
   ═══════════════════════════════ */
function Solution() {
  const obs = useReveal();
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left — visual */}
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}>
            <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-[#f8faff] to-white p-6 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb] mb-6 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />Der FIAON Weg
              </p>
              <div className="space-y-4">
                {["Deutsche Schufa-Abfrage", "Standardisierte Ablehnung", "Keine Alternativen"].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-[14px] text-gray-400">
                    <span className="w-5 h-px bg-gray-300 shrink-0" />
                    <span className="line-through">{t}</span>
                  </div>
                ))}
                <div className="h-px bg-gray-100 my-5" />
                {["Europ\u00E4ische Partnerbanken", "Cashflow-basierte Bewertung", "Individuelle Limit-Struktur", "Langfristiger Bonit\u00E4tsaufbau"].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-[14px] text-gray-900 font-medium">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0" style={{ boxShadow: "0 0 0 4px rgba(37,99,235,.1)" }} />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right — copy */}
          <div className={`transition-all duration-700 delay-150 ${obs.v ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}>
            <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Die L&ouml;sung</p>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4 leading-tight">
              <G>Internationale Strukturen.</G><br/>
              <G>Dein lokaler Vorteil.</G>
            </h2>
            <p className="text-[15px] text-gray-500 leading-relaxed mb-8">
              Wir erfinden kein Geld. Wir wissen einfach, wie der internationale Finanzmarkt funktioniert. Es gibt renommierte Banken im europ&auml;ischen Ausland, f&uuml;r die die deutsche Schufa schlichtweg irrelevant ist. Sie bewerten deinen Cashflow, dein Potenzial und deine aktuelle Situation.
            </p>

            <div className="space-y-5">
              {[
                { title: "Grenzenloses Banking", text: "Setup bei ausl\u00E4ndischen Instituten mit eigenen Kreditkarten-Limits." },
                { title: "Absolute Diskretion", text: "Deine finanzielle Neuaufstellung bleibt privat. Kein Schufa-Eintrag bei Anfrage." },
                { title: "Strategisches Coaching", text: "Nicht nur eine Karte \u2013 wir zeigen dir, wie du deine Bonit\u00E4t langfristig aufbaust." },
              ].map((f, i) => (
                <div key={i}>
                  <p className="text-[14px] font-semibold text-gray-900 mb-1">{f.title}</p>
                  <p className="text-[13px] text-gray-500 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════
   PACKAGES
   ═══════════════════════════════ */
function Packages() {
  const obs = useReveal(0.05);
  return (
    <section className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Dein Setup</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><G>Dein neues finanzielles Setup.</G></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">W&auml;hle das Paket, das zu deiner Situation passt. Jedes Setup wird individuell auf dich zugeschnitten.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {PACKS.map((p, i) => (
            <div key={p.name} className={`relative rounded-2xl bg-white border overflow-hidden transition-all duration-700 hover:-translate-y-1.5 hover:shadow-xl ${p.rec ? "border-[#2563eb]/25 shadow-lg shadow-blue-500/8 ring-1 ring-[#2563eb]/10" : "border-gray-100 hover:border-gray-200"} ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 100}ms` }}>
              {p.rec && <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#2563eb]" />}
              {p.rec && <div className="absolute top-3 right-4 text-[9px] font-bold uppercase tracking-wider text-white bg-[#2563eb] px-2.5 py-1 rounded-full z-10">Empfohlen</div>}

              <div className="p-5 sm:p-6">
                <FCard bg={p.bg} lim={p.lim} label={p.tier} className="w-full" />
              </div>

              <div className="px-5 sm:px-6 pb-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{p.tier}</p>
                <h3 className="text-[17px] font-semibold text-gray-900 mb-4">{p.name}</h3>

                <ul className="space-y-2.5 mb-6">
                  {p.feats.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                      <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>

                <a href="#start" className={`block w-full text-center py-3 rounded-xl text-[13px] font-medium transition-all ${p.rec ? "fiaon-btn-gradient text-white" : "text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100"}`}>
                  Jetzt starten
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════
   FAQ
   ═══════════════════════════════ */
function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  const items: [string, string][] = [
    ["Seid ihr wieder nur so ein Vorkassen-Betrug?", "Nein. Du zahlst f\u00FCr die Einrichtungs-Dienstleistung und das strategische Coaching. Wenn wir im Erstgespr\u00E4ch sehen, dass unser Setup bei dir nicht funktioniert, nehmen wir dich nicht als Kunden an. Punkt."],
    ["Ist das \u00FCberhaupt legal?", "Zu 100%. Die europ\u00E4ische Dienstleistungs- und Kapitalverkehrsfreiheit erlaubt es dir als EU-B\u00FCrger, Konten und Kreditkarten im gesamten SEPA-Raum zu er\u00F6ffnen. Wir navigieren dich durch diesen Prozess."],
    ["Bekomme ich garantiert ein Limit von 10.000 \u20AC?", "Wer dir das trotz harter Schufa-Eintr\u00E4ge garantiert, l\u00FCgt dich an. Das Limit h\u00E4ngt von der ausl\u00E4ndischen Partnerbank und deiner aktuellen Leistungsf\u00E4higkeit ab. Wir bauen die Struktur, die dir die h\u00F6chste Wahrscheinlichkeit auf einen starken Kreditrahmen bietet."],
    ["Was genau ist FIAON?", "FIAON ist ein unabh\u00E4ngiger Beratungsservice. Wir vermitteln Zugang zu internationalen Finanzstrukturen und Kreditkarten \u00FCber europ\u00E4ische Partnerbanken. Wir sind kein Kreditinstitut."],
    ["Wie l\u00E4uft der Prozess ab?", "Nach deiner kostenlosen Potenzial-Analyse bewerten wir deine Situation, erstellen eine individuelle Strategie und begleiten dich durch den gesamten Aufbauprozess \u2013 von der Kontener\u00F6ffnung bis zur Limit-Optimierung."],
    ["Wird die Schufa bei der Anfrage abgefragt?", "Nein. Die Erstberatung und Potenzial-Analyse ist zu 100% schufaneutral. Erst bei einer konkreten Beantragung bei der Partnerbank kann eine lokale Pr\u00FCfung stattfinden \u2013 aber nicht bei der deutschen Schufa."],
  ];
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-[680px] mx-auto px-6">
        <div className="mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight"><G>Die Fragen, die du wirklich hast.</G></h2>
        </div>
        <div className="space-y-2">
          {items.map(([q, a], i) => (
            <div key={i} className="border border-gray-100 rounded-xl bg-white overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full text-left px-5 py-4 flex items-center justify-between gap-4">
                <span className="text-[14px] font-medium text-gray-900">{q}</span>
                <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 ${open === i ? "bg-blue-50 rotate-180" : "bg-gray-50"}`}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke={open === i ? "#2563eb" : "#999"} strokeWidth="2.5" strokeLinecap="round"><path d="M5 8l5 5 5-5"/></svg>
                </span>
              </button>
              <div className={`overflow-hidden transition-all duration-300 ${open === i ? "max-h-60 opacity-100" : "max-h-0 opacity-0"}`}>
                <div className="px-5 pb-4"><p className="text-[13px] text-gray-500 leading-relaxed">{a}</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════
   FINAL CTA — dark
   ═══════════════════════════════ */
function FinalCta() {
  return (
    <section id="start" className="py-20 sm:py-28" style={{ background: "linear-gradient(180deg,#0b1628,#0f1d34)" }}>
      <div className="max-w-[640px] mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-white leading-tight mb-4">
          Deine Vergangenheit schreibt<br/>nicht deine Zukunft.
        </h2>
        <p className="text-[15px] text-gray-400 leading-relaxed mb-8 max-w-[500px] mx-auto">
          Lass dich nicht l&auml;nger von veralteten Systemen ausbremsen. Hol dir die finanzielle Flexibilit&auml;t zur&uuml;ck, die du verdienst.
        </p>
        <a href="#" className="fiaon-btn-gradient inline-flex items-center gap-2 px-8 py-3.5 rounded-full text-[15px] font-medium text-white">
          Jetzt Chancen pr&uuml;fen lassen
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </a>
        <p className="text-[12px] text-gray-500 mt-4 font-medium">100% Schufaneutral</p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════
   FOOTER
   ═══════════════════════════════ */
function Foot() {
  return (
    <footer className="border-t border-gray-100 py-10 sm:py-12">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center"><span className="text-white text-[10px] font-semibold">F</span></div><span className="text-[15px] font-semibold text-gray-900">FIAON</span></div>
            <p className="text-[13px] text-gray-500 leading-relaxed max-w-[240px]">Unabh&auml;ngige Finanz-Beratung &ndash; international, diskret, seri&ouml;s.</p>
          </div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Seiten</div><ul className="space-y-2"><li><a href="/" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">Startseite</a></li><li><a href="/privatkunden" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">Privatkunden</a></li><li><a href="/business" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">Business</a></li></ul></div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Rechtliches</div><ul className="space-y-2">{[["/terms","AGB"],["/privacy","Datenschutz"],["#","Impressum"]].map(([h,l]) => <li key={h}><a href={h} className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>)}</ul></div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Kontakt</div><ul className="space-y-2"><li><a href="mailto:support@fiaon.com" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">support@fiaon.com</a></li></ul></div>
        </div>
        <div className="pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[12px] text-gray-400">&copy; {new Date().getFullYear()} FIAON. Alle Rechte vorbehalten.</span>
          <span className="text-[11px] text-gray-400">FIAON ist ein Beratungsservice und kein Kreditinstitut.</span>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════
   EXPORT
   ═══════════════════════════════ */
export default function PrivatkundenPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <Nav />
      <Hero />
      <Agitation />
      <Solution />
      <Packages />
      <Faq />
      <FinalCta />
      <Foot />
    </div>
  );
}
