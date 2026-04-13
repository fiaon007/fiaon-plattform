import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ── scroll reveal ── */
function useReveal(t = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, set] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { set(true); io.disconnect(); } }, { threshold: t });
    io.observe(el); return () => io.disconnect();
  }, [t]);
  return { ref, v };
}

/* ── gradient text ── */
function G({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

/* Nav is now the shared GlassNav component */

/* ── business card ── */
function BizCard({ bg, lim, label, className = "" }: { bg: string; lim: string; label: string; className?: string }) {
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
        <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className="w-10 h-7 rounded" style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
            <span className="text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>FIAON</span>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-[.14em] font-medium mb-0.5" style={{ color: "rgba(255,255,255,.35)" }}>{label}</div>
            <div className="font-mono text-lg font-semibold" style={{ color: "rgba(255,255,255,.9)" }}>ZIEL: {lim} &euro;</div>
          </div>
        </div>
        {/* shimmer */}
        <div className="absolute inset-0 fiaon-card-shimmer pointer-events-none" />
      </div>
    </div>
  );
}

/* ── packages data ── */
const PACKS = [
  { name: "FIAON Starter", tier: "Paket 1", lim: "10.000", bg: "linear-gradient(135deg,#64748b,#94a3b8,#cbd5e1)", feats: ["KI-Unternehmensanalyse (Basis)", "Business-Kartenkompass", "Credit-Building für Gründer", "Digitales Finance-Dashboard"] },
  { name: "FIAON Business", tier: "Paket 2", lim: "25.000", bg: "linear-gradient(135deg,#b8923a,#d4af37,#e8d085)", dark: true, feats: ["Erweiterte Cashflow-Analyse", "Strategie für Limit-Aufstockungen", "Strikte Trennung von Privat & Business", "Monatliches Business-Coaching"] },
  { name: "FIAON Executive", tier: "Paket 3", lim: "50.000", rec: true, bg: "linear-gradient(135deg,#0b1628,#1a3560,#1e4070)", feats: ["Multi-Karten-Struktur (z.B. für GmbHs)", "Cashflow-Strategieberatung", "Meilen- & Reisekosten-Optimierung", "Priority Business Support"] },
  { name: "FIAON Black", tier: "Paket 4", lim: "100.000", bg: "linear-gradient(135deg,#111,#1a1a1a,#2a2a2a)", feats: ["Dedizierter Account Manager", "Sub-Account- & Mitarbeiter-Strategie", "Premium-Module (Internationale Limits)", "24/7 VIP Business-Support"] },
];

/* ════════════════════════════════════════
   HERO
   ════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative pt-[110px] sm:pt-[130px] pb-12 sm:pb-20 overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-25 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.12), transparent 70%)" }} />
      <div className="max-w-[1120px] mx-auto px-6 text-center relative z-10">
        {/* chip */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-gray-200 bg-white shadow-sm mb-8">
          <span className="w-2 h-2 rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 8px rgba(37,99,235,.4)" }} />
          <span className="text-[13px] font-semibold text-gray-500">Jetzt verf&uuml;gbar &middot; Business Kreditkarten</span>
        </div>

        <h1 className="text-[2.5rem] sm:text-[3.2rem] md:text-[3.8rem] lg:text-[4.2rem] font-semibold leading-[1.08] tracking-tight mb-6">
          <G>Dein Unternehmen.</G><br/>
          <G><em className="italic">Dein Limit.</em></G>
        </h1>

        <p className="text-[15px] sm:text-[16px] text-gray-400 leading-relaxed max-w-[600px] mx-auto mb-10">
          Kreditkarten mit hohen Limits, einfacher Antragstellung und voller Kontrolle &mdash; speziell f&uuml;r Unternehmer, Gr&uuml;nder und Gesch&auml;ftsf&uuml;hrer.
        </p>

        <div className="max-w-[440px] mx-auto fiaon-card-float">
          <BizCard bg="linear-gradient(135deg,#0b1628,#1a3560,#0b1628)" lim="100.000" label="Business Karte" />
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════
   PACKAGES
   ════════════════════════════════════════ */
function Packages() {
  const obs = useReveal(0.05);
  return (
    <section className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Pakete</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><G>W&auml;hlen Sie Ihr Business-Paket</G></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">Von 10.000&nbsp;&euro; bis 100.000&nbsp;&euro; &mdash; strukturiert, skalierbar, auf Ihr Unternehmen zugeschnitten.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {PACKS.map((p, i) => (
            <div key={p.name} className={`relative rounded-2xl bg-white border overflow-hidden transition-all duration-700 hover:-translate-y-1.5 hover:shadow-xl ${p.rec ? "border-[#2563eb]/25 shadow-lg shadow-blue-500/8 ring-1 ring-[#2563eb]/10" : "border-gray-100 hover:border-gray-200"} ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`} style={{ transitionDelay: `${i * 90}ms` }}>
              {p.rec && <div className="absolute -top-0 left-0 right-0 h-[2px] bg-[#2563eb]" />}
              {p.rec && <div className="absolute top-3 right-4 text-[9px] font-bold uppercase tracking-wider text-white bg-[#2563eb] px-2.5 py-1 rounded-full z-10">Beliebt</div>}
              <div className="p-5 sm:p-6"><BizCard bg={p.bg} lim={p.lim} label={p.tier} className="w-full" /></div>
              <div className="px-5 sm:px-6 pb-6">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">{p.tier}</p>
                <h3 className="text-[17px] font-semibold text-gray-900 mb-2">{p.name}</h3>
                <ul className="space-y-2.5 mb-6">
                  {p.feats.map((f, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-[13px] text-gray-600">
                      <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="/business-antrag" className={`block w-full text-center py-3 rounded-xl text-[13px] font-semibold transition-all ${p.rec ? "fiaon-btn-gradient text-white" : p.name === "FIAON Business" || p.name === "FIAON Black" ? "bg-[#0b1628] text-white hover:bg-[#142744] hover:shadow-lg" : "text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-100"}`} style={{ letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600 }}>
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

/* ════════════════════════════════════════
   COMPARE — Banks vs FIAON
   ════════════════════════════════════════ */
function Compare() {
  const obs = useReveal();
  const bankItems = ["Standardisierte Kreditkarten ohne Strategie", "Limits werden einzeln betrachtet, nicht als System", "Keine Abstimmung auf Zahlungszyklen", "Wenig Flexibilit\u00E4t bei Wachstum", "Reaktive statt strategische Betreuung"];
  const fiaonItems = ["Kreditkarten werden als Gesamtstruktur aufgebaut", "Limits greifen strategisch ineinander", "Zahlungszyklen werden gezielt genutzt", "Modell w\u00E4chst mit Ihrem Unternehmen", "Aktive Begleitung statt passiver Bereitstellung"];

  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mb-14">
          <p className="text-[13px] font-medium text-[#2563eb] tracking-wide uppercase mb-3">Positionierung</p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><G>Warum Unternehmen auf Strukturen setzen.</G></h2>
          <p className="text-[15px] text-gray-500 leading-relaxed">Klassische Banken bieten Produkte. FIAON entwickelt Systeme. Der Unterschied entscheidet &uuml;ber echten finanziellen Spielraum.</p>
        </div>

        <div className={`grid md:grid-cols-2 gap-5 mb-6 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          {/* Bank */}
          <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/50 p-6 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Klassische Banken</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Produktorientiert</h3>
            <ul className="space-y-3">
              {bankItems.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] text-gray-500 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-gray-300 mt-2 shrink-0" />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          {/* FIAON */}
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/30 to-white p-6 sm:p-7">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#2563eb] mb-2">FIAON Business</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-5">Systemorientiert</h3>
            <ul className="space-y-3">
              {fiaonItems.map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-[14px] text-gray-600 leading-relaxed">
                  <span className="w-2 h-2 rounded-full bg-[#2563eb] mt-2 shrink-0" style={{ boxShadow: "0 0 0 4px rgba(37,99,235,.1)" }} />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Core message */}
        <div className={`rounded-2xl p-7 sm:p-8 text-white transition-all duration-700 delay-200 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ background: "linear-gradient(135deg,#2563eb,#1a4fd4)", boxShadow: "0 18px 40px rgba(37,99,235,.25)" }}>
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-70 mb-3">Der entscheidende Unterschied</p>
          <h3 className="text-xl sm:text-2xl font-semibold mb-3 leading-tight">Sie bekommen keine Karte &mdash; Sie bekommen ein System.</h3>
          <p className="text-[14px] sm:text-[15px] leading-relaxed opacity-90 max-w-[700px]">Der gr&ouml;&szlig;te Hebel liegt nicht in einer einzelnen Kreditkarte, sondern in der Art, wie mehrere Karten, Limits und Zahlungsstr&ouml;me miteinander kombiniert werden. Genau hier setzt FIAON an.</p>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════
   PROCESS — 4 steps
   ════════════════════════════════════════ */
function Process() {
  const obs = useReveal(0.05);
  const steps = [
    { n: "01", label: "Analyse", title: "Ausgangslage verstehen", desc: "Wir pr\u00FCfen gemeinsam bestehende Karten, Limit-Struktur, Zahlungsabl\u00E4ufe und Liquidit\u00E4tsengp\u00E4sse.", meta: "Fokus: Ist-Zustand, Engp\u00E4sse, Potenziale" },
    { n: "02", label: "Struktur", title: "Strategie entwickeln", desc: "Auf Basis Ihrer Situation entsteht eine konkrete Kreditkarten- und Liquidit\u00E4tsstrategie.", meta: "Fokus: Limits, Zyklen, Kartenmix" },
    { n: "03", label: "Umsetzung", title: "Modell aufbauen", desc: "Wir begleiten die Umsetzung Schritt f\u00FCr Schritt \u2013 bis alles operativ funktioniert.", meta: "Fokus: Begleitung, Integration" },
    { n: "04", label: "Optimierung", title: "Laufend verfeinern", desc: "Wenn Ihr Unternehmen w\u00E4chst, passen wir die Struktur laufend an.", meta: "Fokus: Skalierung, Anpassung" },
  ];
  const pills = ["Bessere Planbarkeit", "Saubere Limit-Logik", "Mehr Flexibilit\u00E4t", "Unternehmerisch gedacht"];
  const forWhom = ["Wachsende Unternehmen mit Liquidit\u00E4tsbedarf", "Gesch\u00E4ftsf\u00FChrer, die Zahlungszyklen steuern m\u00F6chten", "Unternehmer, die Karten strategisch nutzen wollen", "Firmen, die ein System statt nur eine Karte suchen"];

  return (
    <section className="py-20 sm:py-28 bg-[#f8faff]" ref={obs.ref}>
      <div className="max-w-[1200px] mx-auto px-6">
        {/* Shell */}
        <div className="relative bg-white/90 backdrop-blur-sm border border-gray-100 rounded-[28px] p-6 sm:p-10 shadow-xl shadow-blue-500/3 overflow-hidden">
          {/* Ambient orbs */}
          <div className="absolute -top-24 -right-20 w-60 h-60 rounded-full opacity-[0.06] pointer-events-none" style={{ background: "radial-gradient(circle,#2563eb,transparent 70%)" }} />
          <div className="absolute -bottom-28 -left-20 w-64 h-64 rounded-full opacity-[0.05] pointer-events-none" style={{ background: "radial-gradient(circle,#2563eb,transparent 70%)" }} />

          {/* Top */}
          <div className="grid lg:grid-cols-[1fr,380px] gap-8 mb-10 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-gray-200 bg-white text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-5 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" /> So funktioniert FIAON Business
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><G>Von der Analyse zur sauberen Liquidit&auml;tsstruktur.</G></h2>
              <p className="text-[15px] text-gray-500 leading-relaxed max-w-[600px]">Unser Ansatz ist nicht zuf&auml;llig und nicht standardisiert. Wir arbeiten strukturiert und mit einem klaren Ziel: echten finanziellen Spielraum schaffen.</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/30 p-5 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />Strategischer Ansatz</p>
              <p className="text-[15px] font-semibold text-gray-900 mb-2 leading-snug">Keine Karte von der Stange. Sondern ein System f&uuml;r Ihr Unternehmen.</p>
              <p className="text-[13px] text-gray-500 leading-relaxed">FIAON begleitet Sie von der Ausgangsanalyse bis zur konkreten Strukturierung.</p>
            </div>
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
            {steps.map((s, i) => (
              <div key={i} className={`rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/30 p-5 shadow-md hover:-translate-y-1 hover:shadow-lg hover:border-blue-100 transition-all duration-500 flex flex-col ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`} style={{ transitionDelay: `${i * 100}ms` }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[13px] font-bold text-[#2563eb] mb-4" style={{ background: "linear-gradient(180deg,#eef6ff,#dbeaff)", border: "1px solid #cfe1fb", boxShadow: "0 6px 16px rgba(37,99,235,.1)" }}>{s.n}</div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2 flex items-center gap-1.5"><span className="w-1 h-1 rounded-full bg-[#2563eb]" />{s.label}</p>
                <h3 className="text-[16px] font-semibold text-gray-900 mb-2 leading-snug">{s.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed mb-4 flex-1">{s.desc}</p>
                <div className="pt-3 border-t border-gray-100 text-[11px] font-semibold text-gray-400">{s.meta}</div>
              </div>
            ))}
          </div>

          {/* Result */}
          <div className={`grid lg:grid-cols-[1fr,340px] gap-4 relative z-10 transition-all duration-700 delay-300 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/30 p-6 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />Ergebnis</p>
              <h3 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-3 leading-tight max-w-[500px]">Am Ende steht keine Theorie, sondern ein nutzbarer Finanzierungsspielraum.</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-5">Mehr Planbarkeit, bessere Zahlungsfenster, klarere Spielr&auml;ume und professionellere Steuerung Ihrer Liquidit&auml;t.</p>
              <div className="flex flex-wrap gap-2">
                {pills.map((p, i) => (
                  <span key={i} className="inline-flex items-center h-9 px-3.5 rounded-full bg-white border border-gray-100 text-[12px] font-semibold text-gray-600 shadow-sm">{p}</span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/30 p-6 shadow-md">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />F&uuml;r wen geeignet</p>
              <h4 className="text-[16px] font-semibold text-gray-900 mb-4 leading-snug">Besonders passend f&uuml;r Unternehmen mit Dynamik.</h4>
              <ul className="space-y-3">
                {forWhom.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13px] text-gray-500 leading-relaxed">
                    <span className="w-2 h-2 rounded-full bg-[#2563eb] mt-1.5 shrink-0" style={{ boxShadow: "0 0 0 4px rgba(37,99,235,.08)" }} />{t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════
   CTA
   ════════════════════════════════════════ */
function Cta() {
  return (
    <section id="start" className="py-20 sm:py-28">
      <div className="max-w-[640px] mx-auto px-6 text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-4"><G>Bereit f&uuml;r Ihr Business-Limit?</G></h2>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-8">Starten Sie Ihren Antrag &mdash; kostenlos, ohne SCHUFA-Abfrage, in unter 5 Minuten.</p>
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

/* ════════════════════════════════════════
   FOOTER
   ════════════════════════════════════════ */
function Foot() {
  return (
    <footer className="border-t border-gray-100 py-10 sm:py-12">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-3"><div className="w-6 h-6 rounded bg-[#2563eb] flex items-center justify-center"><span className="text-white text-[10px] font-semibold">F</span></div><span className="text-[15px] font-semibold text-gray-900">FIAON</span></div>
            <p className="text-[13px] text-gray-500 leading-relaxed max-w-[240px]">Unabh&auml;ngige Kreditkarten-Beratung f&uuml;r Unternehmen.</p>
          </div>
          <div><div className="text-[13px] font-medium text-gray-900 mb-3">Seiten</div><ul className="space-y-2"><li><a href="/" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">Startseite</a></li><li><a href="/business" className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors">Business</a></li></ul></div>
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

/* ════════════════════════════════════════
   PAGE EXPORT
   ════════════════════════════════════════ */
export default function BusinessPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav activePage="business" />
      <Hero />
      <Packages />
      <Compare />
      <Process />
      <Cta />
      <PremiumFooter />
    </div>
  );
}
