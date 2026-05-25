import { useState, useEffect, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ════════════════════════════════════════════
   FIAON · Bonitäts-Auszug  /bonitaet
   Schufa Vollauskunft Express — 74 EUR
   ════════════════════════════════════════════ */

/* ── Keyframe injection ── */
if (typeof document !== "undefined" && !document.head.querySelector('style[data-bonitaet-anims]')) {
  const s = document.createElement("style");
  s.setAttribute("data-bonitaet-anims", "true");
  s.textContent = `
    @keyframes bonPulseDot { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.6);}50%{box-shadow:0 0 0 8px rgba(16,185,129,0);} }
    @keyframes bonShimmer { 0%{transform:translateX(-130%);}100%{transform:translateX(230%);} }
    @keyframes bonGlowPulse { 0%,100%{opacity:.35;}50%{opacity:.75;} }
    @keyframes bonFadeUp { from{opacity:0;transform:translateY(24px) scale(.97);}to{opacity:1;transform:none;} }
    @keyframes bonCardFloat { 0%,100%{transform:translateY(0) rotate(-2deg);}50%{transform:translateY(-12px) rotate(-2deg);} }
    @keyframes bonDocAppear { from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:none;} }
    @keyframes ampelFloat   { 0%,100%{transform:translateY(0);}50%{transform:translateY(-10px);} }
    @keyframes ampelRedGlow { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,0);}50%{box-shadow:0 0 28px 8px rgba(239,68,68,0.55);} }
    @keyframes ampelYelGlow { 0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,0);}50%{box-shadow:0 0 28px 8px rgba(245,158,11,0.55);} }
    @keyframes ampelGrnGlow { 0%,100%{box-shadow:0 0 12px 4px rgba(16,185,129,0.3);}50%{box-shadow:0 0 32px 12px rgba(16,185,129,0.6);} }
    @keyframes ampelBadge   { from{opacity:0;transform:scale(.7) translateY(8px);}to{opacity:1;transform:scale(1) translateY(0);} }
    @keyframes ampelSweep   { 0%{width:0%;}100%{width:100%;} }
    @keyframes bonLockOpen { 0%,60%{transform:rotate(0deg);}80%{transform:rotate(-12deg);}100%{transform:rotate(0deg);} }
    @keyframes bonLineFill { from{width:0;}to{width:100%;} }
    @keyframes bonNeonPulse { 0%,100%{opacity:.6;filter:blur(4px);}50%{opacity:1;filter:blur(2px);} }
    @keyframes bonSeal { from{opacity:0;transform:scale(.7) rotate(-8deg);}to{opacity:1;transform:scale(1) rotate(0deg);} }
    @media (prefers-reduced-motion:reduce) { * { animation-duration:.01ms!important; } }
  `;
  document.head.appendChild(s);
}

/* ── Scroll reveal ── */
function useReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); io.disconnect(); } },
      { threshold }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ── Gradient text ── */
function G({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

/* ── Check icon ── */
function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className="shrink-0">
      <circle cx="10" cy="10" r="10" fill="rgba(37,99,235,0.12)" />
      <path d="M6 10l3 3 5-5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Shield / Lock ── */
function ShieldIcon() {
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
      <path d="M32 6L10 16v16c0 14.5 9.6 27.2 22 30 12.4-2.8 22-15.5 22-30V16L32 6z"
        fill="url(#shieldGrad)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <defs>
        <linearGradient id="shieldGrad" x1="10" y1="6" x2="54" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2563eb" /><stop offset="1" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <path d="M22 32l6 6 14-12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ── Document visual (Hero right side) ── */
function DocumentVisual() {
  const [unlocked, setUnlocked] = useState(false);
  return (
    <div className="relative flex items-center justify-center">
      {/* Glow backdrop */}
      <div className="absolute w-[340px] h-[340px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.18), transparent 65%)", filter: "blur(50px)", animation: "bonGlowPulse 6s ease-in-out infinite" }} />
      {/* Document card */}
      <div
        className="relative cursor-pointer select-none"
        style={{ animation: "bonCardFloat 7s ease-in-out infinite" }}
        onClick={() => setUnlocked(!unlocked)}
        title="Klicken zum Öffnen"
      >
        <div className="w-[280px] sm:w-[320px] rounded-3xl overflow-hidden"
          style={{
            background: "rgba(15,23,42,0.85)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(37,99,235,0.3)",
            boxShadow: "0 40px 80px -20px rgba(10,20,40,0.55), 0 0 0 1px rgba(37,99,235,0.15) inset, 0 1px 0 rgba(255,255,255,0.06) inset",
          }}>
          {/* Doc header */}
          <div className="px-6 pt-6 pb-4 border-b border-white/10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-blue-400">SCHUFA Vollauskunft</span>
              <div style={{ animation: `bonLockOpen ${unlocked ? "0.6s ease forwards" : "none"}` }}>
                {unlocked ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </div>
            </div>
            <div className="text-white font-semibold text-[15px]">Max Mustermann</div>
            <div className="text-white/40 text-[12px] mt-0.5">Bonitätsprofil · Tagesaktuell</div>
          </div>
          {/* Doc body */}
          <div className="px-6 py-4 space-y-3">
            {[
              { label: "Basis-Score", val: unlocked ? "847 / 1.000" : "●●● / ●●●", col: unlocked ? "#10b981" : "rgba(255,255,255,0.25)" },
              { label: "Offene Einträge", val: unlocked ? "2 (behebbar)" : "●●●●●●●●", col: unlocked ? "#f59e0b" : "rgba(255,255,255,0.25)" },
              { label: "Letzte Anfragen", val: unlocked ? "1 (Eigenabfrage)" : "●●●●●●●", col: unlocked ? "#3b82f6" : "rgba(255,255,255,0.25)" },
              { label: "Branchen-Scores", val: unlocked ? "Vollständig" : "●●●●●●●●●", col: unlocked ? "#10b981" : "rgba(255,255,255,0.25)" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <span className="text-white/50 text-[12px]">{row.label}</span>
                <span className="text-[13px] font-semibold font-mono transition-all duration-700" style={{ color: row.col }}>{row.val}</span>
              </div>
            ))}
          </div>
          {/* Doc footer */}
          <div className="px-6 pb-6">
            <div className={`w-full rounded-xl py-2.5 text-center text-[12px] font-bold tracking-wider transition-all duration-500 ${unlocked ? "text-white" : "text-white/40"}`}
              style={{ background: unlocked ? "linear-gradient(135deg,#2563eb,#3b82f6)" : "rgba(255,255,255,0.06)", border: unlocked ? "none" : "1px solid rgba(255,255,255,0.1)" }}>
              {unlocked ? "✓ FIAON ANALYSE BEREIT" : "KLICKEN ZUM ENTSPERREN"}
            </div>
          </div>
        </div>
        {/* Shimmer overlay */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
          <div className="absolute inset-y-0 w-1/3" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent)", animation: "bonShimmer 4s ease-in-out infinite" }} />
        </div>
      </div>
      {/* Click hint */}
      {!unlocked && (
        <div className="absolute -bottom-8 text-center">
          <span className="text-[11px] text-gray-400 font-medium tracking-wider">↑ Tippen zum Freischalten</span>
        </div>
      )}
    </div>
  );
}

/* ── SCHUFA-Ampel visual (Hero) ── */
function SchufahAmpel() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0); // 0=rot, 1=gelb, 2=grün
  const [score, setScore] = useState(285);
  const targetScores = [285, 541, 847];

  /* Auto-run the sequence */
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2400);
    const t2 = setTimeout(() => setPhase(2), 4800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  /* Animate score counter when phase changes */
  useEffect(() => {
    const target = targetScores[phase];
    const start = score;
    const steps = 40;
    const diff = target - start;
    let i = 0;
    const id = setInterval(() => {
      i++;
      setScore(Math.round(start + diff * (i / steps)));
      if (i >= steps) clearInterval(id);
    }, 22);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const lights = [
    { color: "#ef4444", glow: "ampelRedGlow", label: "Kritisch",    active: phase === 0 },
    { color: "#f59e0b", glow: "ampelYelGlow", label: "Ausreichend", active: phase === 1 },
    { color: "#10b981", glow: "ampelGrnGlow", label: "Sehr gut",    active: phase === 2 },
  ];

  const phaseLabel  = ["Kritisch",    "Ausreichend",  "Sehr gut"][phase];
  const phaseSub    = ["Dringend handeln", "Verbesserung läuft", "Ziel erreicht ✓"][phase];
  const phaseColor  = ["#ef4444",     "#f59e0b",      "#10b981"][phase];
  const barWidth    = ["22%",         "54%",          "88%"][phase];

  return (
    <div className="relative flex items-center justify-center select-none"
      style={{ animation: "ampelFloat 7s ease-in-out infinite" }}>

      {/* Glow backdrop */}
      <div className="absolute w-[360px] h-[360px] rounded-full pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${phaseColor}28, transparent 65%)`,
          filter: "blur(55px)",
          transition: "background 1.2s ease",
          animation: "bonGlowPulse 5s ease-in-out infinite",
        }} />

      {/* Card */}
      <div className="relative z-10 w-[290px] sm:w-[330px] rounded-3xl overflow-hidden"
        style={{
          background: "rgba(10,16,30,0.88)",
          backdropFilter: "blur(24px)",
          border: `1px solid ${phaseColor}44`,
          boxShadow: `0 40px 80px -20px rgba(5,10,20,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset`,
          transition: "border-color 1s ease, box-shadow 1s ease",
        }}>

        {/* Header */}
        <div className="px-7 pt-7 pb-4 border-b border-white/[0.07]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-blue-400">SCHUFA Ampel</span>
            <span className="text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full"
              style={{ background: `${phaseColor}22`, color: phaseColor, transition: "all .8s ease" }}>
              {phaseSub}
            </span>
          </div>
          <div className="text-white/30 text-[11px] font-medium">Bonitätsstatus · Live-Analyse</div>
        </div>

        {/* Main content: Ampel + Score */}
        <div className="px-7 py-6 flex items-center gap-6">
          {/* Traffic light housing */}
          <div className="flex-shrink-0 w-14 rounded-[20px] py-3 px-3 flex flex-col gap-3 items-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {lights.map((l) => (
              <div
                key={l.label}
                className="w-8 h-8 rounded-full transition-all duration-700"
                style={{
                  background: l.active ? l.color : `${l.color}22`,
                  animation: l.active ? `${l.glow} 1.4s ease-in-out infinite` : "none",
                  boxShadow: l.active ? `0 0 18px 4px ${l.color}55` : "none",
                  transition: "background .7s ease, box-shadow .7s ease",
                }}
              />
            ))}
          </div>

          {/* Score display */}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-white/35 mb-1 uppercase tracking-wider">SCHUFA-Score</div>
            <div className="font-mono text-[34px] font-extrabold leading-none transition-colors duration-700 mb-1"
              style={{ color: phaseColor }}>
              {score}
            </div>
            <div className="text-[11.5px] font-bold transition-colors duration-700"
              style={{ color: phaseColor }}>{phaseLabel}</div>

            {/* Score bar */}
            <div className="mt-3 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-[1200ms] ease-out"
                style={{ width: barWidth, background: `linear-gradient(90deg, ${phaseColor}99, ${phaseColor})` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-white/25 font-medium">0</span>
              <span className="text-[9px] text-white/25 font-medium">1.000</span>
            </div>
          </div>
        </div>

        {/* FIAON Effect badge — appears at green phase */}
        <div className="px-7 pb-7">
          <div
            className="w-full py-3 rounded-2xl text-center text-[12px] font-bold tracking-wider transition-all duration-700"
            style={{
              background: phase === 2
                ? "linear-gradient(135deg,#059669,#10b981)"
                : phase === 1 ? "rgba(245,158,11,0.12)" : "rgba(239,68,68,0.10)",
              border: phase === 2 ? "none" : `1px solid ${phaseColor}30`,
              color: phase === 2 ? "white" : phaseColor,
              boxShadow: phase === 2 ? "0 8px 24px rgba(16,185,129,0.38)" : "none",
              animation: phase === 2 ? "ampelBadge .5s cubic-bezier(.22,1,.36,1)" : "none",
            }}>
            {phase === 2 ? "✓ FIAON ZIEL ERREICHT" : phase === 1 ? "↑ FIAON ANALYSE LÄUFT" : "⚠ HANDLUNGSBEDARF"}
          </div>
        </div>

        {/* Shimmer */}
        <div className="absolute inset-0 pointer-events-none rounded-3xl overflow-hidden">
          <div className="absolute inset-y-0 w-1/3"
            style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.03),transparent)", animation: "bonShimmer 5s ease-in-out infinite" }} />
        </div>
      </div>

      {/* Floating "+562 Punkte" badge at green phase */}
      {phase === 2 && (
        <div className="absolute -top-4 -right-4 z-20 px-3.5 py-1.5 rounded-full font-bold text-[12.5px] text-white"
          style={{
            background: "linear-gradient(135deg,#059669,#10b981)",
            boxShadow: "0 8px 20px rgba(16,185,129,0.45)",
            animation: "ampelBadge .55s cubic-bezier(.22,1,.36,1)",
          }}>
          +562 Punkte
        </div>
      )}

      {phase === 0 && (
        <div className="absolute -bottom-6 text-center w-full">
          <span className="text-[11px] text-gray-400 font-medium tracking-wider">↑ FIAON analysiert automatisch</span>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   SECTION 1 — HERO
   ════════════════════════════════════════════ */
function Hero() {
  return (
    <section className="relative pt-28 sm:pt-36 pb-24 sm:pb-32 overflow-hidden">
      {/* Background orbs */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] pointer-events-none"
        style={{ background: "radial-gradient(circle at 20% 30%, rgba(37,99,235,0.1), transparent 60%)", filter: "blur(80px)", animation: "bonGlowPulse 10s ease-in-out infinite" }} />
      <div className="absolute top-20 right-0 w-[500px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(circle at 80% 20%, rgba(16,185,129,0.06), transparent 60%)", filter: "blur(80px)", animation: "bonGlowPulse 14s ease-in-out infinite", animationDelay: "4s" }} />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
        {/* Live indicator bar */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full border border-emerald-200/60 bg-white/90 shadow-sm"
            style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>
            <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500"
              style={{ animation: "bonPulseDot 1.8s ease-in-out infinite" }} />
            <span className="text-[12px] sm:text-[13px] font-semibold text-gray-700 tracking-wide uppercase">
              EXPRESS-BEARBEITUNG AKTIV: Lieferung noch heute am Werktag
            </span>
          </div>
        </div>

        {/* Split layout */}
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
          {/* Left — Text */}
          <div className="text-center lg:text-left" style={{ animation: "bonFadeUp 0.7s cubic-bezier(.22,1,.36,1) both" }}>
            <h1 className="text-[2.6rem] sm:text-[3.4rem] lg:text-[3.8rem] font-extrabold leading-[1.03] tracking-tight mb-6">
              <G>Deine Schufa-Vollauskunft.</G>
              <br />
              <span className="text-gray-900">Express am</span>{" "}
              <G>selben Werktag.</G>
            </h1>

            <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-[520px] mx-auto lg:mx-0 mb-10">
              Keine wochenlange Wartezeit. Wir holen deine tagesaktuelle Schufa-Akte und liefern dir die exakte, sofort umsetzbare Roadmap, um deinen Score massiv zu verbessern.{" "}
              <b className="text-gray-800">Komplett. Diskret. Digital.</b>
            </p>

            {/* CTA */}
            <div className="flex flex-col items-center lg:items-start gap-4">
              <a
                href="/bonitaet-antrag"
                className="fiaon-btn-gradient relative inline-flex items-center justify-center gap-3 px-9 py-4 rounded-full text-[15px] sm:text-[16px] font-bold text-white overflow-hidden group"
                style={{ minHeight: 56, letterSpacing: "0.04em" }}
              >
                <span className="relative z-10">JETZT VOLLAUSKUNFT EINFORDERN</span>
                <svg className="relative z-10" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent)", animation: "bonShimmer 3s ease-in-out infinite" }} />
              </a>

              {/* Trust subtext */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-x-4 gap-y-1.5 text-[12.5px] text-gray-500 font-medium">
                <span className="inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round"><polyline points="4 12 10 18 20 6" /></svg>
                  Einmalig nur 74 €
                </span>
                <span className="hidden sm:block w-px h-3 bg-gray-200" />
                <span className="inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.8" strokeLinecap="round"><polyline points="4 12 10 18 20 6" /></svg>
                  Keine Abo-Falle
                </span>
                <span className="hidden sm:block w-px h-3 bg-gray-200" />
                <span className="inline-flex items-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.8" strokeLinecap="round"><polyline points="4 12 10 18 20 6" /></svg>
                  Schufa-neutraler Abruf
                </span>
              </div>
            </div>
          </div>

          {/* Right — SCHUFA Ampel */}
          <div className="flex items-center justify-center" style={{ animation: "bonFadeUp 0.85s cubic-bezier(.22,1,.36,1) both", animationDelay: "0.15s" }}>
            <SchufahAmpel />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 2 — PAIN POINTS
   ════════════════════════════════════════════ */
function PainPoints() {
  const { ref, visible } = useReveal();
  const pains = [
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
        </svg>
      ),
      accent: "#f59e0b",
      accentBg: "rgba(245,158,11,0.1)",
      title: "Wochenlanges Warten.",
      text: "Wer die kostenlose Auskunft beantragt, wartet oft Wochen per Post. In dieser Zeit ist das Traumauto, die Wohnung oder das Business-Investment längst weg.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" />
        </svg>
      ),
      accent: "#ef4444",
      accentBg: "rgba(239,68,68,0.1)",
      title: "Unwissenheit kostet Geld.",
      text: "Fast 35 % aller Schufa-Einträge sind fehlerhaft, veraltet oder schlichtweg falsch. Du wirst abgelehnt und weißt nicht einmal, warum.",
    },
    {
      icon: (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round">
          <path d="M9 12h6M9 16h6M13 4H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9z" /><path d="M13 4v5h5" />
        </svg>
      ),
      accent: "#8b5cf6",
      accentBg: "rgba(139,92,246,0.1)",
      title: "Nur Daten, keine Lösung.",
      text: "Ein nackter Schufa-Zettel sagt dir nicht, wie du den Score hochbekommst. Du bleibst mit deinen Problemen allein im Regen stehen.",
    },
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#ffffff 0%,#f8faff 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.05), transparent 60%)" }} />
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-4">Das Problem</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] font-extrabold tracking-tight leading-tight">
            <G>Warum die meisten an ihrer Schufa verzweifeln.</G>
          </h2>
        </div>

        <div className="grid sm:grid-cols-3 gap-6">
          {pains.map((p, i) => (
            <div
              key={p.title}
              className={`relative p-8 rounded-3xl transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{
                transitionDelay: `${i * 130}ms`,
                background: "rgba(15,23,42,0.82)",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                border: `1px solid ${p.accent}22`,
                boxShadow: `0 20px 60px rgba(10,20,40,0.3), 0 0 0 1px rgba(255,255,255,0.04) inset`,
              }}
            >
              {/* Glow corner */}
              <div className="absolute top-0 left-0 w-32 h-32 rounded-3xl pointer-events-none"
                style={{ background: `radial-gradient(circle at 0% 0%, ${p.accent}18, transparent 70%)` }} />

              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                  style={{ background: p.accentBg, border: `1px solid ${p.accent}30` }}>
                  {p.icon}
                </div>
                <h3 className="text-[18px] font-bold text-white mb-3">{p.title}</h3>
                <p className="text-[14.5px] text-white/55 leading-relaxed">{p.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 3 — FIAON SOLUTION
   ════════════════════════════════════════════ */
function Solution() {
  const { ref, visible } = useReveal();
  const features = [
    {
      bold: "100% tagesaktuelle Vollauskunft:",
      text: "Alle gespeicherten Branchen-Scores, Banken-Anfragen, Zahlungsstörungen und Einträge auf einen Blick.",
    },
    {
      bold: "Express-Abruf am selben Werktag:",
      text: "Wenn du heute bis 15:00 Uhr bestellst, liegt deine Akte noch heute digital in deinem Hub.",
    },
    {
      bold: "FIAON Handlungsanweisung (Der Gamechanger):",
      text: "Unsere Experten analysieren deine Akte. Du erhältst eine glasklare Anleitung, welche Einträge du sofort löschen lassen kannst, wie du Fristen verkürzt und wie du deinen Score aktiv nach oben schraubst.",
    },
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={ref}>
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(135deg, #f0f4ff 0%, #ffffff 50%, #f0f7ff 100%)" }} />
      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[500px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(37,99,235,0.09), transparent 65%)", filter: "blur(80px)", animation: "bonGlowPulse 10s ease-in-out infinite" }} />

      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-4">Die Lösung</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] font-extrabold tracking-tight leading-tight mb-5">
            <G>Die Vollauskunft + Deine maßgeschneiderte Sanierungs-Roadmap.</G>
          </h2>
          <p className="text-[16px] text-gray-500 leading-relaxed">
            Wir liefern dir nicht nur die nackten Zahlen. Wir geben dir die exakte Waffe an die Hand, um deine Bonität gezielt zu reparieren.
          </p>
        </div>

        {/* Central graphic + features */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Feature list */}
          <div className={`space-y-5 transition-all duration-700 ${visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
            style={{ transitionDelay: "0.1s" }}>
            {features.map((f, i) => (
              <div
                key={i}
                className={`flex gap-4 p-6 rounded-2xl transition-all duration-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/10 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
                style={{
                  transitionDelay: `${0.15 + i * 0.12}s`,
                  background: "white",
                  border: "1px solid rgba(37,99,235,0.1)",
                  boxShadow: "0 4px 20px rgba(37,99,235,0.06)",
                }}
              >
                <CheckIcon size={22} />
                <p className="text-[14.5px] text-gray-600 leading-relaxed">
                  <b className="text-gray-900">{f.bold}</b>{" "}{f.text}
                </p>
              </div>
            ))}
          </div>

          {/* Right: Interactive Document visual */}
          <div className={`flex justify-center transition-all duration-700 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
            style={{ transitionDelay: "0.2s" }}>
            <DocumentVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 4 — STEPS
   ════════════════════════════════════════════ */
function Steps() {
  const { ref, visible } = useReveal(0.08);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveStep(s => (s + 1) % 3), 3000);
    return () => clearInterval(timer);
  }, []);

  const steps = [
    {
      n: "01",
      title: "Express-Formular ausfüllen.",
      text: "Gib deine Daten in unter 2 Minuten sicher ein. Unser System verifiziert deine Identität komplett schufaneutral.",
    },
    {
      n: "02",
      title: "Live-Abruf & Analyse.",
      text: "Unsere Engine fordert deine Vollauskunft an und filtert sofort alle fehlerhaften und optimierbaren Einträge heraus.",
    },
    {
      n: "03",
      title: "Lieferung & Umsetzung.",
      text: "Du erhältst deine Akte und deine persönliche Handlungsanweisung direkt als Download. Du weißt ab Sekunde eins exakt, was zu tun ist.",
    },
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#f8faff 0%,#ffffff 100%)" }}>
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-4">So einfach geht's</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] font-extrabold tracking-tight leading-tight">
            <G>In 3 Schritten zu deiner sauberen Bonität.</G>
          </h2>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting line (desktop) */}
          <div className="hidden sm:block absolute top-[52px] left-[calc(16.66%+24px)] right-[calc(16.66%+24px)] h-[2px] z-0"
            style={{ background: "rgba(37,99,235,0.12)" }}>
            <div className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                background: "linear-gradient(90deg,#2563eb,#60a5fa)",
                width: visible ? "100%" : "0%",
                boxShadow: "0 0 12px rgba(37,99,235,0.5)",
                animation: visible ? "bonNeonPulse 3s ease-in-out infinite" : "none",
              }} />
          </div>

          <div className="grid sm:grid-cols-3 gap-8 relative z-10">
            {steps.map((step, i) => (
              <div
                key={step.n}
                className={`relative p-8 rounded-3xl transition-all duration-700 cursor-pointer ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
                style={{
                  transitionDelay: `${i * 150}ms`,
                  background: activeStep === i ? "white" : "white",
                  border: activeStep === i ? "1.5px solid rgba(37,99,235,0.25)" : "1px solid rgba(37,99,235,0.08)",
                  boxShadow: activeStep === i ? "0 20px 60px rgba(37,99,235,0.15)" : "0 4px 20px rgba(37,99,235,0.05)",
                  transform: visible ? (activeStep === i ? "translateY(-4px)" : "translateY(0)") : "translateY(32px)",
                }}
                onClick={() => setActiveStep(i)}
              >
                {/* Step number */}
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center font-mono text-[16px] font-extrabold text-white mb-5 transition-all duration-500"
                  style={{
                    background: activeStep === i
                      ? "linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)"
                      : "linear-gradient(135deg,rgba(37,99,235,0.2),rgba(59,130,246,0.3))",
                    boxShadow: activeStep === i ? "0 8px 28px rgba(37,99,235,0.45)" : "none",
                    color: activeStep === i ? "white" : "#2563eb",
                  }}
                >
                  {step.n}
                </div>
                <h3 className="text-[17px] font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-[14px] text-gray-500 leading-relaxed">{step.text}</p>

                {/* Active glow */}
                {activeStep === i && (
                  <div className="absolute inset-0 rounded-3xl pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.04), transparent 60%)" }} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 5 — COMPARISON TABLE
   ════════════════════════════════════════════ */
function Comparison() {
  const { ref, visible } = useReveal();
  const rows = [
    { criterion: "Zeit", left: "Bis zu 4 Wochen", leftSub: "Klassischer Postweg", right: "Am selben Werktag", rightSub: "Digital & sofort" },
    { criterion: "Inhalt", left: "Nur nackte Daten", leftSub: "Keine Hilfe, kein Plan", right: "Vollauskunft + konkrete Lösch-Anleitung", rightSub: "Sofort umsetzbar" },
    { criterion: "Score-Auswirkung", left: "Risiko von Fehleinträgen", leftSub: "Unkontrolliert", right: "Zu 100 % scoreneutraler Abruf", rightSub: "Keine Auswirkung" },
    { criterion: "Support", left: "Kein Ansprechpartner", leftSub: "Allein gelassen", right: "Personal Advisor Support", rightSub: "Bei allen Rückfragen" },
  ];

  return (
    <section className="py-24 sm:py-32 relative overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#0b1628 0%,#0f1e38 100%)" }}>
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(37,99,235,0.2), transparent 55%)" }} />

      <div className="max-w-[1000px] mx-auto px-5 sm:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <p className="text-[12px] font-bold text-blue-400 tracking-[0.22em] uppercase mb-4">Der direkte Vergleich</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] font-extrabold tracking-tight text-white leading-tight">
            Warum warten, wenn es auch{" "}
            <span className="fiaon-heading-gradient">sofort</span>{" "}geht?
          </h2>
        </div>

        {/* Table */}
        <div className={`rounded-3xl overflow-hidden transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
          style={{ border: "1px solid rgba(37,99,235,0.2)", boxShadow: "0 40px 100px rgba(0,0,0,0.3)" }}>
          {/* Header */}
          <div className="grid grid-cols-3"
            style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="p-5 text-[12px] font-bold text-white/40 uppercase tracking-wider">Kriterium</div>
            <div className="p-5 border-l border-white/5 text-center">
              <span className="text-[12px] font-semibold text-white/40 uppercase tracking-wider">Klassische Post-Auskunft</span>
            </div>
            <div className="p-5 border-l text-center relative"
              style={{ borderColor: "rgba(37,99,235,0.3)", background: "rgba(37,99,235,0.1)" }}>
              <div className="absolute top-0 inset-x-0 h-[2px]" style={{ background: "linear-gradient(90deg,transparent,#2563eb,#60a5fa,transparent)", animation: "bonNeonPulse 3s ease-in-out infinite" }} />
              <span className="text-[12px] font-bold text-blue-300 uppercase tracking-wider">FIAON Express-Akte</span>
            </div>
          </div>
          {/* Rows */}
          {rows.map((row, i) => (
            <div
              key={row.criterion}
              className={`grid grid-cols-3 transition-all duration-700 ${visible ? "opacity-100" : "opacity-0"}`}
              style={{
                transitionDelay: `${0.1 + i * 0.08}s`,
                borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined,
              }}
            >
              <div className="p-5 sm:p-6">
                <div className="text-[13px] font-semibold text-white/70">{row.criterion}</div>
              </div>
              <div className="p-5 sm:p-6 border-l border-white/5 text-center">
                <div className="text-[13.5px] font-medium text-white/40">{row.left}</div>
                <div className="text-[11px] text-white/25 mt-0.5">{row.leftSub}</div>
              </div>
              <div className="p-5 sm:p-6 border-l text-center"
                style={{ borderColor: "rgba(37,99,235,0.15)", background: "rgba(37,99,235,0.06)" }}>
                <div className="flex items-center justify-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" className="shrink-0"><polyline points="4 12 10 18 20 6" /></svg>
                  <span className="text-[13.5px] font-semibold text-white">{row.right}</span>
                </div>
                <div className="text-[11px] text-blue-400/60 mt-0.5">{row.rightSub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 6 — FAQ
   ════════════════════════════════════════════ */
function FAQ() {
  const { ref, visible } = useReveal();
  const [open, setOpen] = useState<number | null>(0);
  const qas = [
    {
      q: "Verschlechtert dieser Abruf meinen Schufa-Score?",
      a: `Nein. Absolut nicht. Wir rufen deine Daten über ein spezielles Verfahren ab, das als \u201EAnfrage des Kunden\u201C deklariert ist. Das ist für Banken unsichtbar und beeinträchtigt deinen Score zu null Prozent.`,
    },
    {
      q: "Was genau beinhaltet die Handlungsanweisung?",
      a: "Wir prüfen, welche Einträge unberechtigt oder veraltet sind. Du erhältst vorgefertigte Textbausteine und eine Schritt-für-Schritt-Anleitung, wie du diese sofort und ohne teuren Anwalt löschen lassen kannst.",
    },
    {
      q: "Gibt es hier versteckte Kosten oder ein Abo?",
      a: "Nein. Du zahlst einmalig 74 EUR für den Express-Abruf und die Analyse. Es gibt kein Abonnement, keine versteckten Gebühren und keine Folgekosten.",
    },
  ];

  return (
    <section className="py-24 sm:py-32" ref={ref}
      style={{ background: "linear-gradient(180deg,#ffffff 0%,#f8faff 100%)" }}>
      <div className="max-w-[760px] mx-auto px-5 sm:px-8">
        <div className="text-center mb-14">
          <p className="text-[12px] font-bold text-[#2563eb] tracking-[0.22em] uppercase mb-4">FAQ</p>
          <h2 className="text-[2rem] sm:text-[2.6rem] font-extrabold tracking-tight leading-tight">
            <G>Kurz &amp; Hart. Deine Fragen.</G>
          </h2>
        </div>

        <div className="space-y-3">
          {qas.map((item, i) => (
            <div
              key={i}
              className={`fiaon-glass-panel rounded-2xl overflow-hidden transition-all duration-600 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 text-left px-6 py-5"
                aria-expanded={open === i}
              >
                <span className="text-[15.5px] font-semibold text-gray-900 pr-2">{item.q}</span>
                <span
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[#2563eb] transition-transform duration-300"
                  style={{
                    background: "rgba(37,99,235,0.08)",
                    transform: open === i ? "rotate(45deg)" : "rotate(0deg)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </button>
              <div style={{ maxHeight: open === i ? 280 : 0, overflow: "hidden", transition: "max-height .45s cubic-bezier(.22,1,.36,1)" }}>
                <p className="px-6 pb-6 text-[14.5px] text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   SECTION 7 — FINAL CTA / RISK REVERSAL
   ════════════════════════════════════════════ */
function FinalCTA() {
  const { ref, visible } = useReveal(0.08);
  return (
    <section className="relative py-24 sm:py-36 overflow-hidden" ref={ref}
      style={{ background: "linear-gradient(180deg,#0b1628 0%,#0c1a30 60%,#0a1220 100%)" }}>
      {/* Glow orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] pointer-events-none"
        style={{ background: "radial-gradient(ellipse, rgba(37,99,235,0.28), transparent 60%)", filter: "blur(80px)", animation: "bonGlowPulse 8s ease-in-out infinite" }} />
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[300px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(16,185,129,0.08), transparent 65%)", filter: "blur(80px)", animation: "bonGlowPulse 12s ease-in-out infinite", animationDelay: "4s" }} />

      <div className="max-w-[800px] mx-auto px-5 sm:px-8 relative z-10 text-center">
        {/* FIAON Verified seal */}
        <div
          className={`inline-flex flex-col items-center mb-10 transition-all duration-900 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
          style={{ transitionDelay: "0.05s", animation: visible ? "bonSeal 0.8s cubic-bezier(.22,1,.36,1) both" : "none" }}
        >
          <div className="relative">
            <div className="w-28 h-28 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg,rgba(37,99,235,0.25),rgba(37,99,235,0.1))",
                border: "2px solid rgba(37,99,235,0.35)",
                boxShadow: "0 0 60px rgba(37,99,235,0.3), 0 0 0 8px rgba(37,99,235,0.06)",
              }}>
              <ShieldIcon />
            </div>
            {/* Rotating ring */}
            <div className="absolute inset-0 rounded-full pointer-events-none"
              style={{
                border: "1px dashed rgba(37,99,235,0.25)",
                animation: "bonLockOpen 8s linear infinite",
              }} />
          </div>
          <div className="mt-4 px-5 py-1.5 rounded-full text-[11px] font-bold tracking-[0.22em] uppercase"
            style={{ background: "rgba(37,99,235,0.15)", border: "1px solid rgba(37,99,235,0.3)", color: "#60a5fa" }}>
            FIAON VERIFIED
          </div>
        </div>

        <h2
          className={`text-[2.4rem] sm:text-[3.2rem] font-extrabold tracking-tight text-white leading-tight mb-6 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "0.15s" }}
        >
          Null Risiko. Volle Klarheit.{" "}
          <span className="fiaon-heading-gradient">Noch heute.</span>
        </h2>

        <p
          className={`text-[16px] sm:text-[17px] text-white/55 leading-relaxed max-w-[580px] mx-auto mb-10 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "0.22s" }}
        >
          Wir wissen, wie dringend finanzielle Angelegenheiten sind. Deshalb garantieren wir dir die Bearbeitung am selben Werktag. Schließe deine Ungewissheit ab und hol dir die Kontrolle über deine Finanzen zurück.
        </p>

        {/* Final CTA */}
        <div
          className={`flex flex-col items-center gap-4 transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
          style={{ transitionDelay: "0.3s" }}
        >
          <a
            href="/bonitaet-antrag"
            className="fiaon-btn-gradient relative inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full text-[16px] sm:text-[17px] font-bold text-white overflow-hidden"
            style={{ minHeight: 60, letterSpacing: "0.03em", boxShadow: "0 20px 60px rgba(37,99,235,0.4)" }}
          >
            <span className="relative z-10">VOLLAUSKUNFT JETZT ANFORDERN (74 €)</span>
            <svg className="relative z-10" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(255,255,255,.32),transparent)", animation: "bonShimmer 3s ease-in-out infinite" }} />
          </a>

          {/* Trust badge row */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-2">
            <div className="flex items-center gap-2 text-[12.5px] text-white/50 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3L4 7v6c0 5.5 3.8 10.7 8 12 4.2-1.3 8-6.5 8-12V7z" />
              </svg>
              Verschlüsselt mit AES-256
            </div>
            <span className="w-px h-3 bg-white/15" />
            <div className="flex items-center gap-2 text-[12.5px] text-white/50 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"><polyline points="4 12 10 18 20 6" /></svg>
              Höchste deutsche Datenschutzstandards
            </div>
            <span className="w-px h-3 bg-white/15" />
            <div className="flex items-center gap-2 text-[12.5px] text-white/50 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round"><polyline points="4 12 10 18 20 6" /></svg>
              Einmalig — Kein Abo
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   PAGE EXPORT
   ════════════════════════════════════════════ */
export default function BonitaetPage() {
  return (
    <div className="relative min-h-screen bg-white">
      <GlassNav />
      <Hero />
      <PainPoints />
      <Solution />
      <Steps />
      <Comparison />
      <FAQ />
      <FinalCTA />
      <PremiumFooter />
    </div>
  );
}
