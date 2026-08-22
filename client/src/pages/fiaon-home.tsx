import { useState, useEffect, useRef, useCallback } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import NeuralSphere from "@/components/home3d/NeuralSphere";
import ArasCore from "@/components/home3d/ArasCore";
import { paket as paketVon, SCHUFA_PREIS_EURO } from "@shared/fiaon-pakete";

/* ════════════════════════════════════════════
   FIAON Startseite v3.0 — "Finanzintelligenz"
   Copy Deck v3.0 · CI: Zurich Glass Light (Blau #2563eb)
   ════════════════════════════════════════════ */

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

/* ── count-up on reveal ── */
function useCountUp(target: number, visible: boolean, duration = 1600) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let raf = 0; const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [visible, target, duration]);
  return val;
}

/* ── scroll progress (0..1) over a section ── */
function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const fn = () => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh * 0.4;
      const done = Math.min(Math.max(vh * 0.85 - r.top, 0), total);
      setP(Math.min(done / total, 1));
    };
    window.addEventListener("scroll", fn, { passive: true });
    fn();
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return { ref, p };
}

/* ── gradient text ── */
function G({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

/* ── eyebrow kicker ── */
function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.22em] mb-5 ${light ? "text-blue-300" : "text-[#2563eb]"}`}>
      <span className={`w-6 h-[1.5px] rounded-full ${light ? "bg-blue-400/60" : "bg-[#2563eb]/50"}`} />
      {children}
    </div>
  );
}

/* ── page keyframes (scoped, injected once) ── */
const HOME_KEYFRAMES = `
@keyframes fiaonHeroRise {
  from { opacity: 0; transform: translateY(34px); filter: blur(6px); }
  to { opacity: 1; transform: none; filter: blur(0); }
}
@keyframes fiaonFloatY {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-12px); }
}
@keyframes fiaonSpinSlow {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes fiaonRing3dA {
  from { transform: rotateX(64deg) rotateZ(0deg); }
  to { transform: rotateX(64deg) rotateZ(360deg); }
}
@keyframes fiaonRing3dB {
  from { transform: rotateX(-58deg) rotateY(12deg) rotateZ(360deg); }
  to { transform: rotateX(-58deg) rotateY(12deg) rotateZ(0deg); }
}
@keyframes fiaonPulse {
  0%, 100% { opacity: .45; transform: scale(1); }
  50% { opacity: .9; transform: scale(1.12); }
}
@keyframes fiaonFragment {
  0% { opacity: 0; transform: translate(var(--fx), var(--fy)) scale(1) rotate(0deg); }
  35% { opacity: .75; }
  70% { opacity: .75; transform: translate(0, 0) scale(.92) rotate(80deg); }
  100% { opacity: 0; transform: translate(0, 0) scale(.2) rotate(140deg); }
}
@keyframes fiaonShieldSheen {
  0%, 100% { opacity: .25; }
  50% { opacity: .6; }
}
@keyframes fiaonDashFlow {
  to { stroke-dashoffset: -24; }
}
`;
if (typeof document !== "undefined" && !document.head.querySelector("style[data-fiaon-home]")) {
  const s = document.createElement("style");
  s.setAttribute("data-fiaon-home", "true");
  s.textContent = HOME_KEYFRAMES;
  document.head.appendChild(s);
}

/* ── Kundenart-Modal (Privat / Geschäft) ── */
function CustomerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center" style={{ animation: "modalFadeIn .2s ease" }}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: "rgba(15,23,42,.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className="relative w-full sm:max-w-[440px] bg-white rounded-t-[28px] sm:rounded-[28px] px-6 pt-5 pb-7 sm:p-8 sm:mx-4 overflow-hidden"
        style={{ boxShadow: "0 30px 80px rgba(15,23,42,.28)", animation: "sheetUp .38s cubic-bezier(.22,1,.36,1)" }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[380px] h-[240px]" style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,.12), transparent 70%)" }} />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors"
          aria-label="Schließen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className="relative z-10">
          {/* Drag handle (mobile) */}
          <div className="sm:hidden w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-[#2563eb] text-[11px] font-bold uppercase tracking-[.16em] mb-4">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#2563eb] opacity-60 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
              </span>
              Profil analysieren
            </div>
            <h3 className="text-[24px] font-semibold tracking-tight text-gray-900 leading-snug">
              F&uuml;r wen m&ouml;chten Sie <span className="fiaon-gradient-text-animated">starten</span>?
            </h3>
          </div>

          <div className="space-y-3">
            <a
              href="/antrag"
              className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_12px_32px_rgba(37,99,235,.10)] active:scale-[.99] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(37,99,235,.28)] group-hover:scale-105 transition-transform duration-300">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[15.5px] font-semibold text-gray-900">Privatkunde</p>
                <p className="text-[13px] text-gray-500">Bonit&auml;t einsehen, reparieren, Zugang erhalten</p>
              </div>
              <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </a>
            <a
              href="/business-antrag"
              className="group flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-[0_12px_32px_rgba(37,99,235,.10)] active:scale-[.99] transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#1e40af] to-[#2563eb] flex items-center justify-center text-white shrink-0 shadow-[0_8px_20px_rgba(30,64,175,.28)] group-hover:scale-105 transition-transform duration-300">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[15.5px] font-semibold text-gray-900">Gesch&auml;ftskunde</p>
                <p className="text-[13px] text-gray-500">Firmenbonit&auml;t und Gesch&auml;ftskonto</p>
              </div>
              <span className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#2563eb] flex items-center justify-center text-gray-400 group-hover:text-white transition-all duration-300 shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </span>
            </a>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-[11.5px] text-gray-400">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Kostenlos &amp; unverbindlich · SSL-verschl&uuml;sselt
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════
   SEKTION 1 — HERO
   ════════════════════════════════ */
function Hero({ onCta }: { onCta: () => void }) {
  const rise = (i: number): React.CSSProperties => ({
    animation: `fiaonHeroRise .9s cubic-bezier(.22,1,.36,1) ${0.08 + i * 0.12}s both`,
  });
  return (
    <section className="relative pt-[104px] sm:pt-[120px] pb-8 sm:pb-16 overflow-hidden">
      {/* ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] opacity-40 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,.12), transparent 65%)" }} />
      <div className="absolute top-[30%] right-[-200px] w-[500px] h-[500px] opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(147,197,253,.35), transparent 70%)", filter: "blur(40px)" }} />

      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-[1fr_0.92fr] gap-6 lg:gap-10 items-center">
          {/* Copy */}
          <div className="text-center lg:text-left pt-6 lg:pt-0">
            <div style={rise(0)} className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-gray-200 bg-white/80 shadow-sm mb-7 backdrop-blur">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-[#2563eb] opacity-60 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#2563eb]" style={{ boxShadow: "0 0 8px rgba(37,99,235,.5)" }} />
              </span>
              <span className="text-[12.5px] font-medium text-gray-500">Das Betriebssystem f&uuml;r Bonit&auml;t &middot; Deutschland, &Ouml;sterreich, Schweiz</span>
            </div>

            <h1 style={rise(1)} className="text-[2.35rem] sm:text-[3.1rem] lg:text-[3.5rem] xl:text-[3.9rem] font-semibold leading-[1.06] tracking-tight mb-6">
              <G>Wissen, was die Auskunfteien</G><br />
              <G>&uuml;ber Sie wissen.</G><br />
              <span className="text-gray-400">Und es &auml;ndern.</span>
            </h1>

            <p style={rise(2)} className="text-[15px] sm:text-[16.5px] text-gray-500 leading-relaxed max-w-[560px] mx-auto lg:mx-0 mb-7">
              FIAON zeigt Ihnen Ihre Bonit&auml;t, repariert sie mit Ihnen &ndash; und &ouml;ffnet dann die T&uuml;r zu Konto, Karte und Finanzierung. Im Kern arbeitet <strong className="font-medium text-gray-800">ARAS AI</strong>, unser Modell f&uuml;r Bonit&auml;t im DACH-Raum: Es liest Ihre Auskunft und Ihren Kontoauszug und erkl&auml;rt jeden Eintrag in Klartext.
            </p>

            <ul style={rise(3)} className="flex flex-col items-center lg:items-start gap-2.5 mb-8">
              {[
                "Auskunft aus SCHUFA, KSV und CRIF – beantragt durch FIAON",
                "Löschanträge und Widersprüche – vorbereitet und versendet",
                "Girokonto und Kreditkarte bis 25.000 € bei guter Bonität",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-[13.5px] font-medium text-gray-600">
                  <span className="w-[18px] h-[18px] rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>

            <div style={rise(4)} className="flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-4 sm:gap-6 mb-3">
              <button onClick={onCta} className="fiaon-btn-gradient inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-[15px] font-semibold text-white w-full sm:w-auto hover:scale-[1.03] transition-transform">
                Jetzt starten
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
              <a href="#aras" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#2563eb] hover:text-[#1d4ed8] transition-colors py-4 sm:py-4 group">
                So funktioniert es
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-y-0.5 transition-transform"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
              </a>
            </div>
            <p style={rise(5)} className="text-[12px] text-gray-400 font-medium">Konto in zwei Minuten. Erste Einsicht innerhalb von 24 Stunden.</p>
          </div>

          {/* 3D: Neurale Glaskugel */}
          <div style={rise(2)} className="relative h-[340px] sm:h-[420px] lg:h-[560px] -mx-6 lg:mx-0">
            <NeuralSphere variant="hero" className="absolute inset-0" />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 2 — TRUST- & ZAHLEN-LEISTE
   ════════════════════════════════ */
function StatsBar() {
  const obs = useReveal(0.3);
  const stats = [
    { end: 3, fmt: (v: number) => `${v}`, label: "Auskunfteien: SCHUFA, KSV und CRIF – beantragt durch FIAON" },
    { end: 24, fmt: (v: number) => `< ${v} h`, label: "Von der Anmeldung bis zur ersten Einsicht" },
    { end: 25000, fmt: (v: number) => `${v.toLocaleString("de-DE")} €`, label: "Kreditkartenrahmen bei guter Bonität" },
    { end: 100, fmt: (v: number) => `${v} Mio.`, label: "Menschen im DACH-Raum, für die FIAON gebaut ist" },
  ];
  const v0 = useCountUp(stats[0].end, obs.v);
  const v1 = useCountUp(stats[1].end, obs.v);
  const v3 = useCountUp(stats[3].end, obs.v);
  const vals = [v0, v1, stats[2].end, v3];

  return (
    <section className="relative py-10 sm:py-14" ref={obs.ref}>
      <div className="max-w-[1200px] mx-auto px-6">
        <p className={`text-center text-[11px] font-bold uppercase tracking-[.22em] text-gray-400 mb-8 transition-all duration-700 ${obs.v ? "opacity-100" : "opacity-0"}`}>
          FIAON in Zahlen
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5" style={{ perspective: 1400 }}>
          {stats.map((s, i) => (
            <div
              key={s.label}
              className="relative rounded-2xl fiaon-glass-panel px-4 py-6 sm:px-6 sm:py-8 text-center overflow-hidden transition-all duration-700 hover:shadow-xl hover:-translate-y-1"
              style={{
                transform: obs.v ? "rotateX(0deg) translateY(0)" : "rotateX(18deg) translateY(30px)",
                opacity: obs.v ? 1 : 0,
                transitionDelay: `${i * 110}ms`,
                transformStyle: "preserve-3d",
              }}
            >
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#2563eb]/50 to-transparent" />
              <div className="text-[1.7rem] sm:text-[2.2rem] font-semibold tracking-tight fiaon-gradient-text-animated tabular-nums">
                {s.fmt(vals[i])}
              </div>
              <p className="text-[11.5px] sm:text-[12.5px] text-gray-500 font-medium mt-1.5 leading-snug">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 3 — DAS PROBLEM (dark)
   3D: Labyrinth aus Monolithen + leuchtender Pfad
   ════════════════════════════════ */
function ProblemSection() {
  const { ref, p } = useScrollProgress();
  const obs = useReveal(0.1);
  const pathLen = 1400;

  const cards = [
    { title: "„Abgelehnt. Ohne Erklärung.“", text: "Banken entscheiden nach einer Auskunft, die Sie nie gesehen haben. Wer seinen eigenen Eintrag nicht kennt, kann ihn auch nicht ändern." },
    { title: "„Ein Eintrag, der längst erledigt ist.“", text: "Bezahlte Forderungen, veraltete Daten, falsche Zuordnungen: Millionen Einträge im DACH-Raum sind löschbar – wenn jemand den Antrag stellt." },
    { title: "„Apps, die anzeigen. Und nichts tun.“", text: "Score-Apps zeigen eine Zahl. Dann lassen sie Sie allein. Der schwere Teil – Widerspruch, Berichtigung, Ratenvereinbarung – bleibt an Ihnen hängen." },
  ];

  return (
    <section ref={ref} className="relative py-20 sm:py-28 overflow-hidden" style={{ background: "linear-gradient(180deg,#0b1628 0%,#0f1d34 60%,#0b1628 100%)" }}>
      {/* Monolith-Labyrinth (CSS 3D backdrop) */}
      <div className="absolute inset-0 pointer-events-none" style={{ perspective: 900 }} aria-hidden="true">
        <div className="absolute inset-x-0 bottom-[-8%] h-[70%] opacity-[0.55]" style={{ transform: "rotateX(38deg)", transformStyle: "preserve-3d" }}>
          {[
            { l: "6%", w: 70, h: 220, d: 0 }, { l: "16%", w: 46, h: 300, d: 1 }, { l: "26%", w: 84, h: 180, d: 2 },
            { l: "38%", w: 52, h: 340, d: 0 }, { l: "52%", w: 92, h: 210, d: 1 }, { l: "64%", w: 48, h: 320, d: 2 },
            { l: "76%", w: 76, h: 240, d: 0 }, { l: "88%", w: 54, h: 300, d: 1 },
          ].map((m, i) => (
            <div key={i} className="absolute bottom-0 rounded-t-md" style={{
              left: m.l, width: m.w, height: m.h,
              background: "linear-gradient(180deg, rgba(37,99,235,.16), rgba(15,29,52,.05) 70%)",
              border: "1px solid rgba(96,165,250,.12)",
              boxShadow: "0 0 40px rgba(37,99,235,.06) inset",
              transform: `translateZ(${(m.d - 1) * 60}px)`,
            }} />
          ))}
        </div>
        {/* leuchtender Pfad — zeichnet sich beim Scrollen */}
        <svg className="absolute inset-x-0 bottom-0 w-full h-[55%]" viewBox="0 0 1200 400" fill="none" preserveAspectRatio="none">
          <path
            d="M-20 380 C 150 370, 200 290, 320 300 S 520 360, 640 290 S 800 170, 950 200 S 1150 130, 1230 60"
            stroke="url(#fiaonPathGrad)" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={pathLen}
            strokeDashoffset={pathLen * (1 - p)}
            style={{ transition: "stroke-dashoffset .15s linear", filter: "drop-shadow(0 0 8px rgba(59,130,246,.8))" }}
          />
          <defs>
            <linearGradient id="fiaonPathGrad" x1="0" y1="400" x2="1200" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1d4ed8" stopOpacity=".3" />
              <stop offset=".5" stopColor="#3b82f6" />
              <stop offset="1" stopColor="#93c5fd" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div ref={obs.ref} className="relative z-10 max-w-[1120px] mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow light>Das Problem</Eyebrow>
          </div>
          <h2 className={`text-[1.7rem] sm:text-3xl md:text-[2.6rem] font-semibold tracking-tight text-white leading-[1.15] mb-6 transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            Ihre Bonit&auml;t entscheidet &uuml;ber Konto, Karte und Kredit.<br className="hidden sm:block" />
            <span className="text-blue-300/80"> Nur Sie selbst sehen sie nie.</span>
          </h2>
          <p className={`text-[15px] sm:text-[16px] text-gray-400 leading-relaxed max-w-[680px] mx-auto transition-all duration-700 delay-200 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            100 Millionen Menschen in Deutschland, &Ouml;sterreich und der Schweiz haben einen Eintrag bei SCHUFA, KSV oder CRIF. Allein in Deutschland gelten sechs Millionen als &uuml;berschuldet. Die meisten wissen nicht, was dort steht &ndash; und niemand hilft ihnen, es zu &auml;ndern.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {cards.map((item, i) => (
            <div
              key={i}
              className={`group rounded-2xl p-6 sm:p-7 border border-white/[0.07] bg-white/[0.03] backdrop-blur-sm hover:bg-white/[0.06] hover:border-blue-400/20 transition-all duration-500 hover:-translate-y-1.5 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              style={{ transitionDelay: `${250 + i * 120}ms` }}
            >
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-400/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round">
                  {i === 0 && <><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></>}
                  {i === 1 && <><path d="M3 6h18M3 12h18M3 18h18"/><path d="M17 3l4 3-4 3" strokeLinejoin="round"/></>}
                  {i === 2 && <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>}
                </svg>
              </div>
              <p className="text-[15px] font-semibold text-white mb-2.5 leading-snug">{item.title}</p>
              <p className="text-[13.5px] text-gray-400 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        <p className={`text-center text-[15px] sm:text-[16px] font-medium text-blue-200/90 transition-all duration-700 delay-500 ${obs.v ? "opacity-100" : "opacity-0"}`}>
          Genau hier setzt FIAON an: <span className="text-white font-medium">Einsicht. Aktion. Zugang.</span>
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 4 — ARAS AI (Herzstück)
   3D: Gyroskop-Kern (ArasCore)
   ════════════════════════════════ */
function ArasSection() {
  const obs = useReveal(0.08);
  const blocks = [
    {
      title: "Einsicht – zuerst Klarheit.",
      text: "FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF und liest Ihren Kontoauszug. Sie sehen Ihren Wert als Bogen, jeden Eintrag erklärt, Ihre Einnahmen, Fixkosten und Ihren monatlichen Spielraum.",
      icon: <><circle cx="12" cy="12" r="3"/><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/></>,
    },
    {
      title: "Aktion – dann Bewegung.",
      text: "Löschanträge, Berichtigungen, Widersprüche, Ratenvereinbarungen: vorbereitet, anwaltlich geprüft, mit einem Klick versendet. FIAON erinnert Sie an jede Frist und verfolgt jede Antwort.",
      icon: <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>,
    },
    {
      title: "Zugang – dann die Tür.",
      text: "Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität, Finanzierung später. Niemand geht leer aus. Jeder hat ein nächstes Ziel.",
      icon: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></>,
    },
  ];
  return (
    <section id="aras" ref={obs.ref} className="relative py-20 sm:py-28 overflow-hidden scroll-mt-20">
      <div className="absolute top-[10%] left-[-250px] w-[600px] h-[600px] opacity-25 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,.14), transparent 70%)", filter: "blur(50px)" }} />
      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          {/* 3D links auf Desktop, oben auf Mobile */}
          <div className={`relative h-[320px] sm:h-[400px] lg:h-[600px] order-1 lg:order-none -mx-6 lg:mx-0 transition-all duration-1000 ${obs.v ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
            <ArasCore className="absolute inset-0" />
          </div>

          <div className="order-2 lg:order-none">
            <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <Eyebrow>So funktioniert es</Eyebrow>
            </div>
            <h2 className={`text-[1.8rem] sm:text-[2.4rem] lg:text-[2.7rem] font-semibold tracking-tight leading-[1.12] mb-5 transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              <G>Drei Schichten.</G><br />
              <span className="text-gray-900">Ein Weg.</span>
            </h2>
            <p className={`text-[15px] text-gray-500 leading-relaxed mb-9 transition-all duration-700 delay-200 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
              Score-Apps zeigen Ihnen eine Zahl. FIAON geht drei Schritte weiter: Wir zeigen, was dahintersteht, wir &auml;ndern es mit Ihnen &ndash; und wir &ouml;ffnen danach die T&uuml;r. Im Kern arbeitet <strong className="font-medium text-gray-800">ARAS AI</strong>, unser Modell f&uuml;r Bonit&auml;t im DACH-Raum.
            </p>

            <div className="space-y-4 mb-8">
              {blocks.map((b, i) => (
                <div
                  key={b.title}
                  className={`group flex gap-4 rounded-2xl fiaon-glass-panel p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-500 ${obs.v ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
                  style={{ transitionDelay: `${300 + i * 130}ms` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition-transform" style={{ boxShadow: "0 8px 20px rgba(37,99,235,.25)" }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{b.icon}</svg>
                  </div>
                  <div>
                    <h3 className="text-[15.5px] font-semibold text-gray-900 mb-1">{b.title}</h3>
                    <p className="text-[13.5px] text-gray-500 leading-relaxed">{b.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className={`text-[12px] text-gray-400 leading-relaxed border-l-2 border-blue-200 pl-4 mb-8 transition-all duration-700 delay-700 ${obs.v ? "opacity-100" : "opacity-0"}`}>
              ARAS AI liefert Analysen und vorbereitete Schreiben, keine Rechts- oder Steuerberatung. Jedes Schreiben geht erst hinaus, wenn Sie es freigeben.
            </p>

            <a href="/was-ist-fiaon" className={`inline-flex items-center gap-2 text-[14.5px] font-medium text-[#2563eb] hover:text-[#1d4ed8] transition-all duration-700 delay-700 group ${obs.v ? "opacity-100" : "opacity-0"}`}>
              Die Plattform kennenlernen
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 5 — SCHUTZSCHILD
   3D: facettierter Glas-Schild, Fragmente prallen ab
   ════════════════════════════════ */
function ShieldVisual() {
  const fragments = [
    { fx: "-180px", fy: "-120px", delay: 0, size: 14 },
    { fx: "200px", fy: "-90px", delay: 1.4, size: 10 },
    { fx: "-160px", fy: "140px", delay: 2.6, size: 12 },
    { fx: "190px", fy: "120px", delay: 3.8, size: 9 },
    { fx: "0px", fy: "-200px", delay: 5, size: 11 },
  ];
  return (
    <div className="relative w-full h-[340px] sm:h-[420px] flex items-center justify-center" aria-hidden="true">
      {/* Glow */}
      <div className="absolute w-[320px] h-[320px] rounded-full" style={{ background: "radial-gradient(circle, rgba(37,99,235,.16), transparent 65%)", animation: "fiaonPulse 5s ease-in-out infinite" }} />

      {/* Schild (SVG Facetten) */}
      <svg width="290" height="330" viewBox="0 0 290 330" fill="none" className="relative z-10 drop-shadow-[0_24px_50px_rgba(37,99,235,0.22)]">
        <defs>
          <linearGradient id="shieldA" x1="0" y1="0" x2="290" y2="330" gradientUnits="userSpaceOnUse">
            <stop stopColor="#dbeafe" stopOpacity=".9" />
            <stop offset=".5" stopColor="#bfdbfe" stopOpacity=".55" />
            <stop offset="1" stopColor="#93c5fd" stopOpacity=".75" />
          </linearGradient>
          <linearGradient id="shieldEdge" x1="0" y1="0" x2="290" y2="330" gradientUnits="userSpaceOnUse">
            <stop stopColor="#2563eb" />
            <stop offset="1" stopColor="#60a5fa" />
          </linearGradient>
        </defs>
        <path d="M145 8 L272 55 V160 C272 245 215 300 145 322 C75 300 18 245 18 160 V55 Z" fill="url(#shieldA)" stroke="url(#shieldEdge)" strokeWidth="2.5" />
        {/* Facetten */}
        <g stroke="#2563eb" strokeOpacity=".22" strokeWidth="1.2">
          <path d="M145 8 V322" /><path d="M18 55 L272 160" /><path d="M272 55 L18 160" />
          <path d="M145 8 L18 160" /><path d="M145 8 L272 160" />
          <path d="M18 160 C 80 240 210 240 272 160" fill="none" />
        </g>
        {/* Sheen */}
        <path d="M145 8 L272 55 V160 C272 200 260 235 240 262 L60 80 Z" fill="white" opacity=".22" style={{ animation: "fiaonShieldSheen 6s ease-in-out infinite" }} />
        {/* Check */}
        <circle cx="145" cy="158" r="40" fill="white" fillOpacity=".85" stroke="url(#shieldEdge)" strokeWidth="2" />
        <path d="M128 158 L140 171 L164 144" stroke="#2563eb" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>

      {/* Profil-Datenkarten hinter dem Schild */}
      <div className="absolute z-0 flex flex-col gap-2 opacity-70" style={{ transform: "translate(70px, -10px) rotate(6deg)" }}>
        {[64, 82, 52].map((w, i) => (
          <div key={i} className="rounded-lg fiaon-glass-panel px-3 py-2" style={{ width: 120, animation: `fiaonFloatY ${5 + i}s ease-in-out infinite` }}>
            <div className="h-1.5 rounded-full bg-blue-200" style={{ width: w }} />
            <div className="h-1.5 rounded-full bg-gray-200 mt-1.5" style={{ width: w * 0.6 }} />
          </div>
        ))}
      </div>

      {/* Abprallende Fragmente */}
      {fragments.map((f, i) => (
        <span
          key={i}
          className="absolute z-20 rounded-[3px]"
          style={{
            width: f.size, height: f.size,
            background: "linear-gradient(135deg,#94a3b8,#475569)",
            opacity: 0,
            ["--fx" as string]: f.fx,
            ["--fy" as string]: f.fy,
            animation: `fiaonFragment 4.5s cubic-bezier(.3,.7,.4,1) ${f.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function ShieldSection() {
  const obs = useReveal(0.08);
  const feats = [
    { n: "1", title: "Anwaltlich geprüft", text: "Löschanträge, Widersprüche und Ratenvereinbarungen entstehen aus Vorlagen, die unser Anwaltsteam geprüft hat – und gehen erst hinaus, wenn Sie sie freigeben." },
    { n: "2", title: "SEPA-Lastschrift", text: "Monatliche Raten per SEPA über einen verifizierten Kreditor. Keine Kreditkarte nötig, keine Vorkasse, jede Abbuchung angekündigt." },
    { n: "3", title: "Verschlüsselt und DSGVO-konform", text: "Ihre Auskunft und Ihr Kontoauszug liegen verschlüsselt auf Servern in der EU. Sie entscheiden, was Sie hochladen – und können es jederzeit löschen lassen." },
    { n: "4", title: "Ein Mensch am Telefon", text: "Jeder Kunde beginnt mit einem Startgespräch. Danach kennen Sie Ihren Ansprechpartner mit Namen – und er kennt Ihre Akte." },
  ];
  return (
    <section ref={obs.ref} className="relative py-20 sm:py-28 overflow-hidden" style={{ background: "linear-gradient(180deg,#ffffff 0%,#f4f8ff 50%,#ffffff 100%)" }}>
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center mb-4">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow>Ihr Vertrauen</Eyebrow>
          </div>
          <h2 className={`text-[1.7rem] sm:text-[2.4rem] font-semibold tracking-tight leading-[1.15] mb-5 transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <G>Gef&uuml;hrt wie ein Finanzinstitut.</G><br />
            <span className="text-gray-400">Gebaut wie eine App.</span>
          </h2>
          <p className={`text-[15px] text-gray-500 leading-relaxed max-w-[620px] mx-auto transition-all duration-700 delay-200 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            FIAON LTD mit Sitz in London, Kunden in Deutschland, &Ouml;sterreich und der Schweiz. Jedes Schreiben, das Sie &uuml;ber FIAON versenden, ist anwaltlich gepr&uuml;ft. Jede Zahlung l&auml;uft per SEPA-Lastschrift &uuml;ber einen verifizierten Kreditor.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className={`transition-all duration-1000 delay-200 ${obs.v ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
            <ShieldVisual />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {feats.map((f, i) => (
              <div
                key={f.n}
                className={`rounded-2xl fiaon-glass-panel p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${250 + i * 110}ms` }}
              >
                <div className="text-[11px] font-bold text-[#2563eb] tracking-[.18em] mb-3">0{f.n}</div>
                <h3 className="text-[15.5px] font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-[13px] text-gray-500 leading-relaxed">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 6 — DIE PLATTFORM (6 Module)
   3D: modulares Glas-Dashboard mit Tilt
   ════════════════════════════════ */
function TiltCard({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const move = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const b = ref.current.getBoundingClientRect();
    setR({ x: ((e.clientY - b.top) / b.height - 0.5) * -7, y: ((e.clientX - b.left) / b.width - 0.5) * 7 });
  };
  return (
    <div ref={ref} onMouseMove={move} onMouseLeave={() => setR({ x: 0, y: 0 })} style={{ perspective: 800, ...style }} className={className}>
      <div style={{ transform: `rotateX(${r.x}deg) rotateY(${r.y}deg)`, transition: r.x === 0 ? "transform .5s cubic-bezier(.22,1,.36,1)" : "none", transformStyle: "preserve-3d", height: "100%" }}>
        {children}
      </div>
    </div>
  );
}

function PlatformSection() {
  const obs = useReveal(0.06);
  const modules = [
    { tag: "Die Auskunft", title: "Bonitätsauskunft", text: "FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF – Sie füllen kein Formular aus. Innerhalb von 24 Stunden wissen Sie, was dort steht.", icon: <><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/><path d="M8 11h6M11 8v6"/></> },
    { tag: "Die Analyse", title: "Kontoauszug-Analyse", text: "Laden Sie Ihren Kontoauszug hoch. ARAS AI erkennt Einnahmen, Fixkosten, Abos und Risiken – und zeigt Ihren monatlichen Spielraum.", icon: <><path d="M3 3v18h18"/><path d="M7 13l3-3 4 4 6-7"/><circle cx="20" cy="7" r="1.5" fill="currentColor"/></> },
    { tag: "Die Aktion", title: "Löschanträge und Widersprüche", text: "Jeder Eintrag bekommt eine Einschätzung: erledigt, löschbar, berichtigbar, angreifbar. Das Schreiben ist vorbereitet – Sie geben frei, FIAON versendet.", icon: <><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></> },
    { tag: "Die Einigung", title: "Ratenvereinbarungen", text: "Offene Forderungen werden zu Plänen: FIAON schlägt Raten vor, die zu Ihrem Spielraum passen, und verfolgt die Antwort des Gläubigers.", icon: <><path d="M4 20h16"/><path d="M6 20V12M11 20V8M16 20V4"/></> },
    { tag: "Der Zugang", title: "Konto und Karte", text: "Girokonto für jeden Kunden, Kreditkarte bis 25.000 € bei guter Bonität. Ihr Fahrplan zeigt, wie weit Sie noch davon entfernt sind.", icon: <><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/><path d="M6 15h4"/></> },
    { tag: "Der Mensch", title: "Startgespräch und Betreuung", text: "Ein Startgespräch zu Beginn, ein fester Ansprechpartner danach. Fragen beantwortet ein Mensch – am Telefon oder in Ihrem Bereich.", icon: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.72 3.5a2 2 0 0 1-.45 1.95L8 10.5a16 16 0 0 0 5.5 5.5l1.33-1.38a2 2 0 0 1 1.95-.45l3.5.72A2 2 0 0 1 22 16.92z"/></> },
  ];
  return (
    <section ref={obs.ref} className="relative py-20 sm:py-28 overflow-hidden">
      <div className="absolute bottom-0 right-[-200px] w-[550px] h-[550px] opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,.15), transparent 70%)", filter: "blur(50px)" }} />
      <div className="max-w-[1200px] mx-auto px-6 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow>Die Plattform</Eyebrow>
          </div>
          <h2 className={`text-[1.8rem] sm:text-[2.5rem] font-semibold tracking-tight leading-[1.12] transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <G>Einsicht. Aktion. Zugang.</G><br />
            <span className="text-gray-400">Alles in Ihrem Bereich.</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {modules.map((m, i) => (
            <TiltCard
              key={m.title}
              className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <div className="group h-full rounded-2xl fiaon-glass-panel p-6 sm:p-7 relative overflow-hidden hover:shadow-2xl transition-shadow duration-500">
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#2563eb]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300" style={{ boxShadow: "0 10px 24px rgba(37,99,235,.28)", transform: "translateZ(24px)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{m.icon}</svg>
                </div>
                <div className="text-[10.5px] font-bold uppercase tracking-[.18em] text-[#2563eb] mb-1.5">{m.tag}</div>
                <h3 className="text-[16.5px] font-semibold text-gray-900 mb-2.5">{m.title}</h3>
                <p className="text-[13.5px] text-gray-500 leading-relaxed">{m.text}</p>
              </div>
            </TiltCard>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 7 — FÜR PRIVAT & BUSINESS
   3D: zwei ineinandergreifende Ring-Systeme
   ════════════════════════════════ */
function DualRings() {
  return (
    <div className="relative w-[280px] h-[200px] sm:w-[340px] sm:h-[230px] mx-auto" style={{ perspective: 900 }} aria-hidden="true">
      {/* Ring Privat */}
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[170px] h-[170px] sm:w-[210px] sm:h-[210px]" style={{ transformStyle: "preserve-3d" }}>
        <div className="absolute inset-0 rounded-full border-[3px] border-[#2563eb]/70" style={{ animation: "fiaonRing3dA 14s linear infinite", boxShadow: "0 0 30px rgba(37,99,235,.2), inset 0 0 20px rgba(37,99,235,.12)" }} />
        <div className="absolute inset-[14%] rounded-full border-[1.5px] border-[#60a5fa]/50" style={{ animation: "fiaonRing3dA 20s linear infinite reverse" }} />
      </div>
      {/* Ring Business */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[170px] h-[170px] sm:w-[210px] sm:h-[210px]" style={{ transformStyle: "preserve-3d" }}>
        <div className="absolute inset-0 rounded-full border-[3px] border-[#0f172a]/50" style={{ animation: "fiaonRing3dB 16s linear infinite", boxShadow: "0 0 30px rgba(15,23,42,.14), inset 0 0 20px rgba(15,23,42,.08)" }} />
        <div className="absolute inset-[14%] rounded-full border-[1.5px] border-[#334155]/40" style={{ animation: "fiaonRing3dB 22s linear infinite reverse" }} />
      </div>
      {/* ARAS-Nukleus in der Schnittmenge */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center" style={{ boxShadow: "0 0 40px rgba(37,99,235,.5), 0 12px 30px rgba(37,99,235,.3)", animation: "fiaonPulse 4s ease-in-out infinite" }}>
          <span className="text-[9px] font-bold text-white tracking-widest">ARAS</span>
        </div>
      </div>
    </div>
  );
}

function AudienceSection({ onChoose }: { onChoose: (tab: "privat" | "business") => void }) {
  const obs = useReveal(0.08);
  const cols = [
    {
      key: "privat" as const,
      title: "Für Privatkunden",
      text: "Vom ersten Eintrag bis zur Kreditkarte: Sie sehen Ihre Auskunft, räumen auf, was nicht hineingehört, und arbeiten Etappe für Etappe auf Konto und Karte zu – mit einem Ansprechpartner, der Ihre Akte kennt.",
      goals: "Typische Ziele: Eintrag löschen lassen · Ratenvereinbarung treffen · Girokonto eröffnen · Kreditkarte bis 25.000 €",
      icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    },
    {
      key: "business" as const,
      title: "Für Geschäftskunden",
      text: "Firmenbonität entscheidet über Lieferantenkredit, Leasing und Geschäftskonto. FIAON Business zeigt Selbstständigen und Unternehmen, was Auskunfteien über sie führen – und hilft, es in Ordnung zu bringen.",
      goals: "Typische Ziele: Firmeneintrag prüfen · Geschäftskonto eröffnen · Firmenkarte mit Rahmen · Privat und Geschäft trennen",
      icon: <><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></>,
    },
  ];
  return (
    <section ref={obs.ref} className="relative py-20 sm:py-28 overflow-hidden" style={{ background: "linear-gradient(180deg,#ffffff 0%,#f6f9ff 55%,#ffffff 100%)" }}>
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-6">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow>F&uuml;r wen</Eyebrow>
          </div>
          <h2 className={`text-[1.8rem] sm:text-[2.5rem] font-semibold tracking-tight leading-[1.12] mb-2 transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <G>Eine Plattform. Zwei Welten.</G>
          </h2>
        </div>

        <div className={`mb-10 transition-all duration-1000 delay-200 ${obs.v ? "opacity-100 scale-100" : "opacity-0 scale-90"}`}>
          <DualRings />
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {cols.map((c, i) => (
            <div
              key={c.key}
              className={`group rounded-3xl fiaon-glass-panel p-7 sm:p-9 flex flex-col hover:shadow-2xl hover:-translate-y-1.5 transition-all duration-500 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
              style={{ transitionDelay: `${300 + i * 150}ms` }}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform ${i === 0 ? "bg-gradient-to-br from-[#2563eb] to-[#60a5fa]" : "bg-gradient-to-br from-[#0f172a] to-[#334155]"}`} style={{ boxShadow: i === 0 ? "0 10px 24px rgba(37,99,235,.28)" : "0 10px 24px rgba(15,23,42,.25)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{c.icon}</svg>
              </div>
              <h3 className="text-[19px] font-semibold text-gray-900 mb-3">{c.title}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed mb-4">{c.text}</p>
              <p className="text-[12.5px] text-gray-400 italic leading-relaxed mb-7">{c.goals}</p>
              <button
                onClick={() => onChoose(c.key)}
                className="mt-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-[14px] font-semibold fiaon-btn-outline-animated w-full sm:w-auto group/btn"
              >
                Paket w&auml;hlen
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="group-hover/btn:translate-x-1 transition-transform"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 8 — SETUPS & PREISE
   3D: aufsteigende Podeste mit wachsender Komplexität
   ════════════════════════════════ */
/* Preise kommen aus dem Paketkatalog (shared/fiaon-pakete.ts) — eine Quelle für Website, Antrag und Akte. */
const preisText = (key: string) => ((paketVon(key)?.preisCents ?? 0) / 100).toFixed(2).replace(".", ",");

const PRIVATE_PACKS = [
  { key: "start", name: "FIAON Start", sub: "Der Einstieg", scenario: "Einsicht in Ihre Bonität", feats: ["Bonitätsauskunft einsehen und verstehen", "Kontoauszug-Analyse mit Spielraum", "Ihr Bereich mit Fahrplan", "Unterstützung per E-Mail"] },
  { key: "pro", name: "FIAON Pro", sub: "Standard", scenario: "Einträge bereinigen, Konto eröffnen", rec: true, feats: ["Alles aus Start", "Löschanträge und Widersprüche – vorbereitet und versendet", "Ratenvereinbarungen mit Antwort-Verfolgung", "Startgespräch und fester Ansprechpartner"] },
  { key: "ultra", name: "FIAON Ultra", sub: "Mit Karte", scenario: "Kreditkarte bis 25.000 € bei guter Bonität", feats: ["Alles aus Pro", "Begleitung bis zur Kreditkarte", "Bevorzugte Bearbeitung Ihrer Schreiben", "Telefonische Betreuung"] },
  { key: "highend", name: "FIAON High End", sub: "Das Maximum", scenario: "Finanzierung und persönliche Betreuung", feats: ["Alles aus Ultra", "Persönlicher Betreuer für Ihre Akte", "Vorbereitung auf Finanzierungen", "Erreichbar auch außerhalb der Bürozeiten"] },
];

const BUSINESS_PACKS = [
  { key: "business_starter", name: "FIAON Business Starter", sub: "", scenario: "Firmenrahmen bis 5.000 €", feats: ["Firmeneintrag prüfen und verstehen", "Geschäftskonto-Zugang", "Unterstützung für Ihr Unternehmen", "Monatliche Übersicht"] },
  { key: "business_pro", name: "FIAON Business Pro", sub: "", scenario: "Firmenrahmen bis 25.000 €", rec: true, feats: ["Alles aus Starter", "Löschanträge und Widersprüche für das Unternehmen", "Firmenkarte mit Rahmen", "Bevorzugte Bearbeitung"] },
  { key: "business_ultra", name: "FIAON Business Ultra", sub: "", scenario: "Firmenrahmen bis 75.000 €", feats: ["Alles aus Pro", "Fester Ansprechpartner", "Mehrere Nutzer im Bereich", "Vorbereitung auf Finanzierungen"] },
  { key: "business_enterprise", name: "FIAON Business Enterprise", sub: "", scenario: "Firmenrahmen bis 250.000 €", feats: ["Alles aus Ultra", "Betreuung auch außerhalb der Bürozeiten", "Schnittstelle zu Ihrer Buchhaltung", "Unbegrenzte Nutzer"] },
];

/* Podest-Objekt: wachsende geometrische Komplexität */
function PodiumShape({ level }: { level: number }) {
  const shapes = [
    /* Würfel */
    <div key="0" className="w-9 h-9 rounded-md bg-gradient-to-br from-[#93c5fd] to-[#60a5fa]" style={{ transform: "rotate(12deg)", boxShadow: "0 8px 20px rgba(37,99,235,.3)" }} />,
    /* Doppel-Diamant */
    <div key="1" className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-md bg-gradient-to-br from-[#60a5fa] to-[#2563eb]" style={{ transform: "rotate(45deg)", boxShadow: "0 8px 20px rgba(37,99,235,.35)" }} />
      <div className="absolute inset-[18%] rounded-sm bg-white/40" style={{ transform: "rotate(45deg)" }} />
    </div>,
    /* Facetten-Polygon */
    <svg key="2" width="44" height="44" viewBox="0 0 44 44" style={{ filter: "drop-shadow(0 8px 16px rgba(37,99,235,.35))" }}>
      <polygon points="22,2 40,13 40,31 22,42 4,31 4,13" fill="url(#podGradA)" stroke="#2563eb" strokeWidth="1" />
      <path d="M22 2 V42 M4 13 L40 31 M40 13 L4 31" stroke="#fff" strokeOpacity=".5" strokeWidth="1" />
      <defs><linearGradient id="podGradA" x1="0" y1="0" x2="44" y2="44"><stop stopColor="#3b82f6"/><stop offset="1" stopColor="#1d4ed8"/></linearGradient></defs>
    </svg>,
    /* Vielschichtiger Polyeder */
    <svg key="3" width="48" height="48" viewBox="0 0 48 48" style={{ filter: "drop-shadow(0 10px 20px rgba(15,23,42,.4))" }}>
      <polygon points="24,1 43,12 47,30 33,46 15,46 1,30 5,12" fill="url(#podGradB)" stroke="#0f172a" strokeWidth="1" />
      <path d="M24 1 L24 47 M1 30 L47 30 M5 12 L43 36 M43 12 L5 36" stroke="#93c5fd" strokeOpacity=".55" strokeWidth="1" />
      <defs><linearGradient id="podGradB" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#1e3a8a"/><stop offset="1" stopColor="#0f172a"/></linearGradient></defs>
    </svg>,
  ];
  return (
    <div className="h-12 flex items-end justify-center mb-4" style={{ animation: `fiaonFloatY ${5 + level}s ease-in-out infinite` }}>
      {shapes[level]}
    </div>
  );
}

function PricingSection({ tab, setTab }: { tab: "privat" | "business"; setTab: (t: "privat" | "business") => void }) {
  const obs = useReveal(0.05);
  const packs = tab === "privat" ? PRIVATE_PACKS : BUSINESS_PACKS;
  const antragHref = tab === "privat" ? "/antrag" : "/business-antrag";
  return (
    <section id="setups" ref={obs.ref} className="relative py-20 sm:py-28 overflow-hidden scroll-mt-20">
      <div className="absolute top-[15%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] opacity-25 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.12), transparent 70%)" }} />
      <div className="max-w-[1240px] mx-auto px-6 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-10">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow>Ihr Paket</Eyebrow>
          </div>
          <h2 className={`text-[1.8rem] sm:text-[2.5rem] font-semibold tracking-tight leading-[1.12] mb-5 transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <G>W&auml;hlen Sie, wie weit Sie gehen.</G><br />
            <span className="text-gray-400">Nicht, ob.</span>
          </h2>
          <p className={`text-[14.5px] text-gray-500 leading-relaxed max-w-[640px] mx-auto transition-all duration-700 delay-200 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            Jedes Paket beginnt mit Ihrer Auskunft. Je weiter Sie gehen, desto mehr nimmt FIAON Ihnen ab &ndash; bis zu Konto, Karte und Finanzierung. &Uuml;ber die Vergabe entscheidet immer die Bank; FIAON bereitet Sie darauf vor.
          </p>
        </div>

        {/* Tab-Schalter */}
        <div className={`flex justify-center mb-12 transition-all duration-700 delay-300 ${obs.v ? "opacity-100" : "opacity-0"}`}>
          <div className="inline-flex p-1 rounded-full fiaon-glass-panel">
            {(["privat", "business"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-6 sm:px-8 py-2.5 rounded-full text-[13.5px] font-semibold transition-all duration-300 ${tab === t ? "text-white fiaon-btn-gradient shadow-md" : "text-gray-500 hover:text-gray-800"}`}
              >
                {t === "privat" ? "Privatkunde" : "Geschäftskunde"}
              </button>
            ))}
          </div>
        </div>

        {/* Podest-Formation: aufsteigende Karten */}
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 items-end">
          {packs.map((p, i) => (
            <div
              key={`${tab}-${p.name}`}
              className={`relative rounded-3xl p-[1.5px] transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-16"}`}
              style={{
                transitionDelay: `${350 + i * 110}ms`,
                background: p.rec ? "linear-gradient(160deg,#2563eb,#93c5fd,#2563eb)" : "linear-gradient(160deg,rgba(229,231,235,1),rgba(243,244,246,1))",
                marginBottom: `${(3 - i) * 0}px`,
              }}
            >
              {p.rec && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 px-4 py-1 rounded-full text-[11px] font-bold text-white fiaon-btn-gradient shadow-lg tracking-wide">
                  Beliebt
                </div>
              )}
              <div className={`h-full rounded-3xl bg-white/95 backdrop-blur p-6 sm:p-7 flex flex-col ${p.rec ? "shadow-2xl shadow-blue-500/10" : "shadow-lg shadow-gray-200/50"} hover:-translate-y-2 transition-transform duration-400`}
                style={{ paddingTop: 28 + (3 - i) * 0 }}>
                <PodiumShape level={i} />
                <div className="text-center mb-5">
                  <h3 className="text-[17px] font-semibold text-gray-900">{p.name}</h3>
                  {p.sub && <p className="text-[12px] text-gray-400 font-medium">({p.sub})</p>}
                </div>
                <div className="text-center mb-1">
                  <span className="text-[2rem] font-semibold tracking-tight fiaon-gradient-text-animated">{preisText(p.key)} &euro;</span>
                  <span className="text-[13px] text-gray-400 font-medium"> / Monat</span>
                </div>
                <p className="text-center text-[11.5px] text-gray-400 leading-snug mb-6 min-h-[32px]">
                  {tab === "privat" ? `Ziel: ${p.scenario}` : p.scenario}
                </p>
                <ul className="space-y-3 mb-7 flex-1">
                  {p.feats.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[13px] text-gray-600 leading-snug">
                      <span className="w-[16px] h-[16px] mt-0.5 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <a
                  href={antragHref}
                  className={`block text-center px-6 py-3 rounded-full text-[14px] font-semibold transition-all ${p.rec ? "fiaon-btn-gradient text-white hover:scale-[1.02]" : "border border-gray-200 text-gray-700 hover:border-[#2563eb]/40 hover:text-[#2563eb] bg-white"}`}
                >
                  Konto er&ouml;ffnen &rarr;
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className={`text-center text-[11.5px] text-gray-400 leading-relaxed max-w-[720px] mx-auto mt-10 transition-all duration-700 delay-700 ${obs.v ? "opacity-100" : "opacity-0"}`}>
          {tab === "privat"
            ? `Alle Pakete: monatlich per SEPA-Lastschrift · zwölf Raten, danach entscheiden Sie, ob Sie bleiben · Nur die Auskunft? Bonitätsauskunft ${SCHUFA_PREIS_EURO.toFixed(2).replace(".", ",")} € einmalig. Über Konto, Karte und Rahmen entscheidet die jeweilige Bank.`
            : "Alle Pakete: monatlich per SEPA-Lastschrift · zwölf Raten, danach entscheiden Sie, ob Sie bleiben. Über Konto, Karte und Rahmen entscheidet die jeweilige Bank."}
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 9 — ABLAUF (3 Schritte)
   3D: verbundene Stationen entlang leuchtendem Pfad
   ════════════════════════════════ */
function StepsSection() {
  const { ref, p } = useScrollProgress();
  const obs = useReveal(0.1);
  const steps = [
    { n: "01", title: "Konto anlegen", text: "E-Mail-Adresse, wenige Angaben, zwei Minuten. Ihr Bereich ist sofort aktiv – am Handy wie am Rechner.", icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></> },
    { n: "02", title: "Auskunft erhalten", text: "FIAON beantragt Ihre Auskunft. Innerhalb von 24 Stunden sehen Sie, was SCHUFA, KSV oder CRIF über Sie führen – und was sich ändern lässt.", icon: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12l2.5 2.5L16 9"/></> },
    { n: "03", title: "Handeln und Zugang erhalten", text: "Schreiben freigeben, Raten vereinbaren, Etappen abschließen. Am Ende stehen Konto, Karte und – wenn Sie möchten – die Finanzierung.", icon: <><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></> },
  ];
  const lineLen = 1000;
  return (
    <section id="ablauf" ref={ref} className="relative py-20 sm:py-28 overflow-hidden" style={{ background: "linear-gradient(180deg,#ffffff,#f4f8ff 50%,#ffffff)" }}>
      <div ref={obs.ref} className="max-w-[1120px] mx-auto px-6 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow>Ablauf</Eyebrow>
          </div>
          <h2 className={`text-[1.8rem] sm:text-[2.5rem] font-semibold tracking-tight leading-[1.12] transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <G>In drei Schritten zu Ihrer Bonit&auml;t.</G>
          </h2>
        </div>

        <div className="relative">
          {/* Verbindungspfad (Desktop horizontal) */}
          <svg className="hidden md:block absolute top-[56px] left-0 w-full h-[60px] pointer-events-none" viewBox="0 0 1000 60" fill="none" preserveAspectRatio="none">
            <path d="M60 30 C 250 30, 280 10, 500 30 S 750 55, 940 30" stroke="#dbeafe" strokeWidth="2.5" strokeDasharray="6 8" style={{ animation: "fiaonDashFlow 1.2s linear infinite" }} />
            <path
              d="M60 30 C 250 30, 280 10, 500 30 S 750 55, 940 30"
              stroke="url(#stepGrad)" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={lineLen}
              strokeDashoffset={lineLen * (1 - Math.min(p * 1.4, 1))}
              style={{ transition: "stroke-dashoffset .15s linear", filter: "drop-shadow(0 0 6px rgba(37,99,235,.5))" }}
            />
            <defs>
              <linearGradient id="stepGrad" x1="0" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
                <stop stopColor="#2563eb" /><stop offset="1" stopColor="#93c5fd" />
              </linearGradient>
            </defs>
          </svg>
          {/* Mobile: vertikale Linie */}
          <div className="md:hidden absolute left-[27px] top-4 bottom-4 w-[2px] bg-gradient-to-b from-[#2563eb] via-[#93c5fd] to-transparent opacity-40" />

          <div className="grid md:grid-cols-3 gap-8 md:gap-6">
            {steps.map((s, i) => (
              <div
                key={s.n}
                className={`relative flex md:flex-col md:items-center md:text-center gap-5 md:gap-0 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
                style={{ transitionDelay: `${200 + i * 180}ms` }}
              >
                <div className="relative z-10 w-14 h-14 md:w-[112px] md:h-[112px] shrink-0 md:mb-6">
                  <div className="absolute inset-0 rounded-2xl md:rounded-3xl fiaon-glass-panel" style={{ animation: `fiaonFloatY ${5 + i}s ease-in-out infinite` }} />
                  <div className="absolute inset-0 flex items-center justify-center" style={{ animation: `fiaonFloatY ${5 + i}s ease-in-out infinite` }}>
                    <div className="w-9 h-9 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white" style={{ boxShadow: "0 10px 26px rgba(37,99,235,.32)" }}>
                      <svg className="w-4.5 h-4.5 md:w-6 md:h-6" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">{s.icon}</svg>
                    </div>
                  </div>
                  <span className="absolute -top-2 -right-2 z-10 px-2 py-0.5 rounded-full bg-white border border-blue-100 text-[10px] font-bold text-[#2563eb] shadow-sm">{s.n}</span>
                </div>
                <div>
                  <h3 className="text-[16.5px] font-semibold text-gray-900 mb-2">Schritt {s.n} &ndash; {s.title}</h3>
                  <p className="text-[13.5px] text-gray-500 leading-relaxed max-w-[300px] md:mx-auto">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className={`text-center text-[12.5px] text-gray-400 font-medium mt-14 transition-all duration-700 delay-700 ${obs.v ? "opacity-100" : "opacity-0"}`}>
          Kein Papierkram. Keine Filiale. Ein Ansprechpartner, der Ihre Akte kennt.
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   SEKTION 10 — KUNDENSTIMMEN + FAQ + FINAL CTA
   ════════════════════════════════ */
function TestimonialsSection() {
  const obs = useReveal(0.1);
  const items = [
    { quote: "Zum ersten Mal habe ich gesehen, was die SCHUFA über mich gespeichert hat – und zwei Einträge waren längst erledigt. Der Löschantrag war in einer Minute unterwegs.", name: "Sara W.", role: "Angestellte" },
    { quote: "Als Selbstständiger bin ich überall durchgefallen. Mit der Ratenvereinbarung über FIAON ist die Forderung vom Tisch, und das Geschäftskonto steht.", name: "Markus R.", role: "Selbstständiger" },
    { quote: "Ich dachte, meine Bonität sei ein Urteil. Sie ist ein Zustand. Den kann man ändern – das hat mir vorher niemand gesagt.", name: "Julia B.", role: "Studentin" },
  ];
  return (
    <section ref={obs.ref} className="relative py-20 sm:py-24">
      <div className="max-w-[1120px] mx-auto px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <div className={`transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <Eyebrow>Kundenstimmen</Eyebrow>
          </div>
          <h2 className={`text-[1.7rem] sm:text-[2.3rem] font-semibold tracking-tight leading-[1.15] transition-all duration-700 delay-100 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <G>Klarheit,</G>{" "}
            <span className="text-gray-400">die bleibt.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {items.map((t, i) => (
            <div
              key={t.name}
              className={`rounded-2xl fiaon-glass-panel p-7 flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-500 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
              style={{ transitionDelay: `${150 + i * 130}ms` }}
            >
              <div className="flex gap-1 mb-4">
                {Array.from({ length: 5 }).map((_, s) => (
                  <svg key={s} width="15" height="15" viewBox="0 0 24 24" fill="#2563eb"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                ))}
              </div>
              <p className="text-[14px] text-gray-600 leading-relaxed flex-1 mb-6">&bdquo;{t.quote}&ldquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#60a5fa] flex items-center justify-center text-white text-[13px] font-bold">
                  {t.name.charAt(0)}
                </div>
                <div>
                  <p className="text-[13.5px] font-semibold text-gray-900">{t.name}</p>
                  <p className="text-[12px] text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FaqSection() {
  const obs = useReveal(0.1);
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    { q: "Beantragt FIAON die Auskunft für mich?", a: "Ja. Sie geben uns einmal Ihre Daten, FIAON beantragt Ihre Auskunft bei SCHUFA, KSV oder CRIF. Sie müssen kein Formular ausfüllen und nichts hochladen. Innerhalb von 24 Stunden sehen Sie in Ihrem Bereich, was dort steht." },
    { q: "Was passiert mit meinen Einträgen?", a: "Jeder Eintrag bekommt eine Einschätzung: erledigt, löschbar, berichtigbar oder angreifbar. Für alles, was sich ändern lässt, bereitet FIAON das Schreiben vor. Sie geben es frei – FIAON versendet es und verfolgt die Antwort." },
    { q: "Bekomme ich eine Kreditkarte?", a: "Über die Vergabe entscheidet immer die Bank. FIAON bringt Ihre Bonität in Ordnung und bereitet Sie vor: Ein Girokonto ist für jeden Kunden erreichbar, eine Kreditkarte mit Rahmen bis 25.000 € bei guter Bonität. Ihr Fahrplan zeigt, wie weit Sie noch entfernt sind." },
    { q: "Was ist ARAS AI?", a: "ARAS AI ist das Modell hinter FIAON. Es liest Auskünfte und Kontoauszüge, erklärt Einträge in Klartext und bereitet Schreiben vor. Es ersetzt keine Rechts- oder Steuerberatung – jedes Schreiben ist anwaltlich geprüft und geht erst hinaus, wenn Sie es freigeben." },
    { q: "Wie lange läuft ein Paket?", a: "Zwölf monatliche Raten per SEPA-Lastschrift. Nach der zwölften Rate fragen wir Sie, ob Sie bleiben möchten – keine stille Verlängerung." },
    { q: "Wo liegen meine Daten?", a: "Verschlüsselt auf Servern in der EU, DSGVO-konform. Sie entscheiden, was Sie hochladen, und können es jederzeit löschen lassen." },
  ];
  return (
    <section id="faq" ref={obs.ref} className="relative py-16 sm:py-20">
      <div className="max-w-[760px] mx-auto px-6">
        <h2 className={`text-center text-[1.6rem] sm:text-[2.1rem] font-semibold tracking-tight mb-10 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
          <G>H&auml;ufige Fragen</G>
        </h2>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <div
              key={i}
              className={`rounded-2xl fiaon-glass-panel overflow-hidden transition-all duration-500 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="text-[14.5px] font-semibold text-gray-900">{f.q}</span>
                <span className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-all duration-300 ${open === i ? "bg-[#2563eb] border-[#2563eb] rotate-45" : "border-gray-200 bg-white"}`}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={open === i ? "#fff" : "#6b7280"} strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                </span>
              </button>
              <div className="grid transition-all duration-400 ease-out" style={{ gridTemplateRows: open === i ? "1fr" : "0fr" }}>
                <div className="overflow-hidden">
                  <p className="px-6 pb-5 text-[13.5px] text-gray-500 leading-relaxed">{f.a}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onCta }: { onCta: () => void }) {
  const obs = useReveal(0.15);
  return (
    <section ref={obs.ref} className="relative py-20 sm:py-32 overflow-hidden">
      {/* Signature-Objekt kehrt zurück — geordnet & ruhig */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 ease-out ${obs.v ? "opacity-100 scale-100" : "opacity-0 scale-110"}`}>
        <NeuralSphere variant="calm" className="absolute inset-0 opacity-60" />
      </div>
      <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0) 20%, rgba(255,255,255,.88) 72%, #fff 100%)" }} />

      <div className="relative z-10 max-w-[720px] mx-auto px-6 text-center">
        <h2 className={`text-[2rem] sm:text-[2.9rem] font-semibold tracking-tight leading-[1.1] mb-6 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <G>Ihr Weg beginnt</G><br />
          <G>mit einer E-Mail-Adresse.</G>
        </h2>
        <p className={`text-[15px] sm:text-[16px] text-gray-500 leading-relaxed max-w-[520px] mx-auto mb-9 transition-all duration-700 delay-150 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          Konto in zwei Minuten. Ihre Auskunft innerhalb von 24 Stunden. Ein Mensch, der Sie durch alles Weitere begleitet.
        </p>
        <div className={`transition-all duration-700 delay-300 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <button onClick={onCta} className="fiaon-btn-gradient inline-flex items-center gap-2 px-9 py-4 rounded-full text-[15.5px] font-semibold text-white hover:scale-[1.04] transition-transform">
            Jetzt starten
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-6 text-[12px] text-gray-400 font-medium">
            {["SEPA-Lastschrift", "EU-Hosting", "DSGVO-konform", "Anwaltlich geprüft"].map((t, i) => (
              <span key={t} className="flex items-center gap-4">
                {i > 0 && <span className="w-px h-3 bg-gray-200 hidden sm:block" />}
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════
   EXPORT
   ════════════════════════════════ */
export default function FiaonHome() {
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<"privat" | "business">("privat");
  const openModal = useCallback(() => setShowModal(true), []);

  const chooseSetup = useCallback((t: "privat" | "business") => {
    setTab(t);
    document.getElementById("setups")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased overflow-x-hidden" style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <GlassNav activePage="startseite" />
      <Hero onCta={openModal} />
      <StatsBar />
      <ProblemSection />
      <ArasSection />
      <ShieldSection />
      <PlatformSection />
      <AudienceSection onChoose={chooseSetup} />
      <PricingSection tab={tab} setTab={setTab} />
      <StepsSection />
      <TestimonialsSection />
      <FaqSection />
      <FinalCta onCta={openModal} />
      <CustomerModal open={showModal} onClose={() => setShowModal(false)} />
      <PremiumFooter />
    </div>
  );
}
