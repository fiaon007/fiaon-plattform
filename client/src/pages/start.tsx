import { useState, useEffect, useRef, useMemo } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

/* ════════════════════════════════════════════
   FIAON · WhatsApp Landing  /start
   Elite Conversion Page — Mobile First
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

/* ── gradient text ── */
function G({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <span className={`fiaon-heading-gradient ${className}`}>{children}</span>;
}

/* ── cardEnter keyframe injection ── */
if (typeof document !== "undefined" && !document.head.querySelector('style[data-start-anims]')) {
  const s = document.createElement("style");
  s.setAttribute("data-start-anims", "true");
  s.textContent = `
    @keyframes startPulseDot { 0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,.55); } 50% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } }
    @keyframes startCardEnter { from { opacity: 0; transform: translateY(28px) scale(.96); filter: blur(3px); } to { opacity: 1; transform: none; filter: blur(0); } }
    @keyframes startStickyIn { from { transform: translateY(120%); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes startShimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
    @keyframes startGlowPulse { 0%,100% { opacity: .35; } 50% { opacity: .75; } }
    @media (prefers-reduced-motion: reduce) {
      .fiaon-card-float, .start-shimmer, .start-glow-pulse { animation: none !important; }
    }
  `;
  document.head.appendChild(s);
}

/* ── packages (mirror of /antrag) ── */
const PACKS = [
  { key: "start", name: "FIAON Starter", sub: "Das Fundament", fee: "7,99", lim: "500", bg: "linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)",
    feats: ["Dein 500 € Einstiegs-Setup", "Zugang: Basic Karten-Portfolio", "Schufaneutrale Profil-Prüfung", "Online-Dashboard & Verwaltung"] },
  { key: "pro", name: "FIAON Pro", sub: "Standard", fee: "59,99", lim: "5.000", rec: true, bg: "linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)",
    feats: ["Dein 5.000 € Limit-Protokoll", "Zugang: Premium Karten-Netzwerk", "Dynamische Limit-Aufstockung", "Sofortige Score-Auswertung", "Priority-Bearbeitung im System"] },
  { key: "ultra", name: "FIAON Ultra", sub: "Elite Konto", fee: "79,99", lim: "15.000", bg: "linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)",
    feats: ["Dein 15.000 € Elite-Portfolio", "Zugang: Gold- & Platinum-Karten", "Cashback- & Meilen-Aktivierung", "Individuelle Freigabe-Roadmap", "VIP-Support & Konto-Optimierung"] },
  { key: "highend", name: "FIAON High End", sub: "Das Maximum", fee: "99,99", lim: "25.000", bg: "linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)",
    feats: ["Dein 25.000 € Black-Card Setup", "Exklusiver Zugang: Metal- & VIP-Karten", "Persönlicher Account Director", "Internationale Limit-Strukturen", "24/7 Dedicated Concierge-Support"] },
];

/* ── propagate UTM/src to antrag ── */
function antragLink(pack?: string) {
  if (typeof window === "undefined") return pack ? `/antrag?pack=${pack}&src=wa` : "/antrag?src=wa";
  const params = new URLSearchParams(window.location.search);
  const out = new URLSearchParams();
  if (pack) out.set("pack", pack);
  out.set("src", params.get("src") || "wa");
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref"].forEach(k => {
    const v = params.get(k); if (v) out.set(k, v);
  });
  return `/antrag?${out.toString()}`;
}

/* ════════════════════════════════════════════
   CREDIT CARD (3D tilt)
   ════════════════════════════════════════════ */
function Card({ bg, lim, label, className = "", hero = false }: { bg: string; lim: string; label?: string; className?: string; hero?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [r, setR] = useState({ x: 0, y: 0 });
  const move = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const b = ref.current.getBoundingClientRect();
    setR({ x: ((e.clientY - b.top) / b.height - .5) * -10, y: ((e.clientX - b.left) / b.width - .5) * 10 });
  };
  return (
    <div ref={ref} className={className} onMouseMove={move} onMouseLeave={() => setR({ x: 0, y: 0 })} style={{ perspective: 900 }}>
      <div className="w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none" style={{
        background: bg,
        border: "1px solid rgba(255,255,255,.1)",
        boxShadow: hero
          ? "0 50px 100px -25px rgba(10,20,40,.55), 0 24px 48px -12px rgba(37,99,235,.25), 0 0 0 1px rgba(255,255,255,.06) inset"
          : "0 20px 50px -10px rgba(0,0,0,.3), 0 0 0 1px rgba(255,255,255,.05) inset",
        transform: `rotateX(${r.x}deg) rotateY(${r.y}deg)`,
        transition: r.x === 0 ? "transform .6s cubic-bezier(.22,1,.36,1)" : "none",
      }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 25% 15%, rgba(255,255,255,.32), transparent 55%)", mixBlendMode: "overlay" }} />
        <div className="absolute inset-0 fiaon-card-shimmer pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.02]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 50px, rgba(255,255,255,.5) 50px, rgba(255,255,255,.5) 51px)" }} />
        <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-between z-10">
          <div className="flex justify-between items-start">
            <div className={`rounded ${hero ? "w-12 h-9" : "w-10 h-7"}`} style={{ background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", boxShadow: "0 1px 4px rgba(0,0,0,.25)" }} />
            <span className="text-sm font-semibold tracking-wide" style={{ color: "rgba(255,255,255,.65)" }}>FIAON</span>
          </div>
          <div>
            <div className="text-[8px] uppercase tracking-[.14em] font-medium mb-0.5" style={{ color: "rgba(255,255,255,.35)" }}>{label || "Premium Card"}</div>
            <div className="font-mono text-lg font-semibold" style={{ color: "rgba(255,255,255,.9)" }}>ZIEL: {lim} €</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   COUNTDOWN (to midnight)
   ════════════════════════════════════════════ */
function useMidnightCountdown() {
  const [t, setT] = useState({ h: "00", m: "00", s: "00" });
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, end.getTime() - now.getTime());
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1000);
      setT({ h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0"), s: String(s).padStart(2, "0") });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

/* ════════════════════════════════════════════
   SCARCITY BAR
   ════════════════════════════════════════════ */
function ScarcityBar() {
  const t = useMidnightCountdown();
  const [dismiss, setDismiss] = useState(false);
  if (dismiss) return null;
  return (
    <div className="mt-[104px] sm:mt-[112px] border-y border-blue-100/70" style={{
      background: "linear-gradient(90deg, rgba(255,255,255,.82), rgba(240,244,255,.9), rgba(255,255,255,.82))",
      backdropFilter: "blur(12px) saturate(160%)",
      WebkitBackdropFilter: "blur(12px) saturate(160%)",
    }}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-3 sm:gap-5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" style={{ animation: "startPulseDot 1.8s ease-in-out infinite" }} />
          <span className="text-[11px] sm:text-[12px] font-semibold text-gray-700 uppercase tracking-wider">Live</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="hidden sm:flex items-center gap-3">
            <span className="text-[12px] font-medium text-gray-600 whitespace-nowrap">Noch <b className="text-[#2563eb]">7 von 25</b> Slots für das 25.000 € Setup heute</span>
            <div className="flex-1 h-1.5 rounded-full bg-blue-50 overflow-hidden max-w-[180px]">
              <div className="h-full" style={{ width: "72%", background: "linear-gradient(90deg,#2563eb,#3b82f6,#2563eb)", backgroundSize: "200% 100%", animation: "btnGrad 3s ease-in-out infinite" }} />
            </div>
          </div>
          <div className="sm:hidden text-[11px] font-medium text-gray-600 truncate">Noch <b className="text-[#2563eb]">7 / 25</b> Slots · Reset um 00:00</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 font-mono text-[12px] sm:text-[13px] font-semibold text-gray-900 tabular-nums">
          <span className="px-1.5 py-0.5 rounded bg-gray-900 text-white">{t.h}</span>:
          <span className="px-1.5 py-0.5 rounded bg-gray-900 text-white">{t.m}</span>:
          <span className="px-1.5 py-0.5 rounded bg-gray-900 text-white">{t.s}</span>
        </div>
        <button onClick={() => setDismiss(true)} aria-label="Hinweis schließen" className="shrink-0 text-gray-400 hover:text-gray-700 transition p-1 -mr-1">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   HERO
   ════════════════════════════════════════════ */
function Hero({ ctaRef }: { ctaRef: React.RefObject<HTMLDivElement> }) {
  return (
    <section className="relative pt-16 sm:pt-24 pb-20 sm:pb-28 overflow-hidden">
      {/* Blur orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[min(900px,120vw)] h-[500px] opacity-40 pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.14), transparent 70%)" }} />
      <div className="absolute -top-20 -left-20 w-[420px] h-[420px] pointer-events-none start-glow-pulse" style={{ background: "radial-gradient(circle, rgba(37,99,235,.08), transparent 70%)", filter: "blur(60px)", animation: "startGlowPulse 9s ease-in-out infinite" }} />
      <div className="absolute bottom-0 -right-20 w-[380px] h-[380px] pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,.08), transparent 70%)", filter: "blur(60px)", animation: "startGlowPulse 11s ease-in-out infinite", animationDelay: "3s" }} />

      <div className="max-w-[1120px] mx-auto px-5 sm:px-6 text-center relative z-10">
        {/* Trust pill */}
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full border border-gray-200 bg-white/80 backdrop-blur shadow-sm mb-9 sm:mb-10">
          <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-500" style={{ animation: "startPulseDot 1.8s ease-in-out infinite" }} />
          <span className="text-[12px] sm:text-[13px] font-semibold text-gray-600">Aktive April-Slots · Live-Bearbeitung</span>
        </div>

        {/* Headline */}
        <h1 className="text-[2.4rem] sm:text-[3.2rem] md:text-[3.8rem] lg:text-[4.3rem] font-semibold leading-[1.04] tracking-tight mb-7 sm:mb-8">
          <G>25.000 € Sofort-Limit.</G><br />
          <G>Ohne SCHUFA.</G>{" "}
          <span className="text-gray-400">Ohne Warten.</span>
        </h1>

        <p className="text-[15px] sm:text-[17px] text-gray-500 leading-relaxed max-w-[580px] mx-auto mb-10 sm:mb-12">
          Dein internationaler Zugang zu Premium-Kreditkarten. Während deutsche Banken noch Formulare drucken, hast du dein Limit bereits aktiviert. <b className="text-gray-700">Digital. Diskret. Kompromisslos.</b>
        </p>

        {/* CTA */}
        <div ref={ctaRef} className="mb-4 flex flex-col items-center">
          <a href={antragLink("highend")}
            className="fiaon-btn-gradient relative inline-flex items-center gap-2 px-8 py-4 rounded-full text-[15px] sm:text-[16px] font-semibold text-white overflow-hidden group"
            style={{ minHeight: 52 }}
            onClick={() => { try { fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "wa_hero_cta", src: "wa" }) }).catch(() => { }); } catch { } }}>
            <span className="relative z-10">Konto jetzt eröffnen</span>
            <svg className="relative z-10" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)", animation: "startShimmer 3.2s ease-in-out infinite" }} />
          </a>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-4 text-[12px] text-gray-500 font-medium">
            <span className="inline-flex items-center gap-1.5"><Check /> Keine SCHUFA-Abfrage</span>
            <span className="hidden sm:inline-block w-px h-3 bg-gray-200" />
            <span className="inline-flex items-center gap-1.5"><Check /> Keine Vorkasse</span>
            <span className="hidden sm:inline-block w-px h-3 bg-gray-200" />
            <span className="inline-flex items-center gap-1.5"><Check /> EU-Hosting</span>
          </div>
        </div>

        {/* Hero card */}
        <div className="relative max-w-[440px] sm:max-w-[500px] mx-auto mt-20 sm:mt-24">
          <div className="absolute inset-0 blur-3xl opacity-60 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, rgba(37,99,235,.28), transparent 60%)" }} />
          <div className="relative fiaon-card-float">
            <Card bg="linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)" lim="25.000" hero label="Black Edition" />
          </div>
          <p className="mt-5 text-[11.5px] uppercase tracking-[0.18em] text-gray-400 font-semibold">FIAON High End · Metal Card</p>
        </div>
      </div>
    </section>
  );
}

function Check() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round"><polyline points="4 12 10 18 20 6" /></svg>;
}

/* ════════════════════════════════════════════
   TRUST BAR
   ════════════════════════════════════════════ */
function TrustBar() {
  return (
    <section className="py-8 sm:py-10 border-y border-gray-100 bg-white/60">
      <div className="max-w-[1120px] mx-auto px-5 sm:px-6">
        <p className="text-center text-[11px] uppercase tracking-[0.22em] text-gray-400 font-semibold mb-5">Vertraut & referenziert</p>
        <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-12 gap-y-3 opacity-80">
          {["Finanzblatt", "Tech-Insider", "Global Banking Review", "FinTech Weekly", "Handelszeitung"].map(n => (
            <span key={n} className="text-[13px] sm:text-[14px] text-gray-400 font-semibold tracking-wide" style={{ fontFamily: "'Inter',serif" }}>{n}</span>
          ))}
        </div>
        <p className="mt-6 text-center text-[13px] text-gray-500">
          <b className="text-gray-900">+ 1.248 Limit-Freigaben</b> im März 2026 · Ø <b className="text-gray-900">4,9 / 5</b> auf Trustpilot
        </p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   PAIN POINTS
   ════════════════════════════════════════════ */
function Pains() {
  const obs = useReveal();
  const items = [
    { icon: <path d="M3 12l3 3 15-15" />, t: "SCHUFA? Egal.", d: "Wir arbeiten mit dem US-Credit-Building-System. Deine deutsche Vergangenheit ist kein Teil unserer Gleichung." },
    { icon: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, t: "Echtzeit-Freigabe.", d: "Kein Aktenordner. Kein Sachbearbeiter. Algorithmische Bonitäts-Kalibrierung in unter 120 Sekunden." },
    { icon: <><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M3 11h18M7 16h3" /></>, t: "Sofort einsatzbereit.", d: "Virtuelle Karte direkt im Hub. Physische Metal-Card per Express binnen 48 h." },
  ];
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[0.18em] uppercase mb-3">Warum FIAON wirkt</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"><G>Wo Banken versagen, liefern wir.</G></h2>
        </div>
        <div className="grid sm:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <div key={i}
              className={`relative p-7 rounded-2xl bg-white border border-gray-100 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} hover:-translate-y-1 hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-200`}
              style={{ transitionDelay: `${i * 120}ms`, boxShadow: "0 2px 16px rgba(37,99,235,0.05)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: "linear-gradient(135deg, rgba(37,99,235,.08), rgba(59,130,246,.16))" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{it.icon}</svg>
              </div>
              <h3 className="text-[17px] font-semibold text-gray-900 mb-2">{it.t}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed">{it.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   PACKAGES
   ════════════════════════════════════════════ */
function Packages() {
  const obs = useReveal(0.05);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <section id="pakete" className="relative py-20 sm:py-28 overflow-hidden" ref={obs.ref}
      style={{ background: "linear-gradient(180deg, #f0f4ff 0%, #f6f8ff 25%, #ffffff 60%, #f8faff 100%)" }}>
      <div className="absolute w-[600px] h-[600px] -top-32 -left-20 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.08), transparent 68%)", filter: "blur(70px)", animation: "startGlowPulse 9s ease-in-out infinite" }} />
      <div className="absolute w-[480px] h-[480px] -bottom-20 -right-16 pointer-events-none" style={{ background: "radial-gradient(circle, rgba(139,92,246,0.07), transparent 68%)", filter: "blur(60px)", animation: "startGlowPulse 11s ease-in-out infinite", animationDelay: "4.5s" }} />

      <div className="relative z-10 max-w-[1200px] mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto mb-12 text-center">
          <span className="inline-block mb-3 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.14em] uppercase"
            style={{ background: "rgba(37,99,235,0.08)", border: "1px solid rgba(37,99,235,0.18)", color: "#2563eb" }}>Dein Setup</span>
          <h2 className="font-extrabold tracking-tight mb-3" style={{ fontSize: "clamp(2rem, 4vw, 2.8rem)" }}>
            <G>Wähle dein Limit. Start in 5 Minuten.</G>
          </h2>
          <p className="text-gray-500 text-[15px] leading-relaxed max-w-[520px] mx-auto">Vom Fundament bis zur Black Card. Monatlich kündbar. Keine Vorkasse. Zahlung erst nach Limit-Freigabe.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 items-stretch">
          {PACKS.map((p, i) => (
            <div key={p.key}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              className="relative flex flex-col"
              style={{
                background: "#ffffff",
                border: p.rec ? "1.5px solid rgba(37,99,235,0.32)" : "1.5px solid rgba(37,99,235,0.10)",
                borderRadius: 22,
                boxShadow: p.rec ? "0 12px 48px rgba(37,99,235,0.18)" : "0 4px 24px rgba(37,99,235,0.07)",
                transition: "transform .3s cubic-bezier(.22,1,.36,1), box-shadow .3s, opacity .3s",
                opacity: hover !== null && hover !== i ? .7 : 1,
                transform: hover === i ? "translateY(-8px) scale(1.018)" : hover !== null ? "scale(.983)" : "",
                animation: `startCardEnter .55s cubic-bezier(.22,1,.36,1) both`,
                animationDelay: `${0.05 + i * 0.08}s`,
              }}>
              {p.rec && (
                <div className="absolute left-1/2 -translate-x-1/2 -top-px z-10 px-4 py-1 text-[11px] font-bold tracking-wider text-white whitespace-nowrap"
                  style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", borderRadius: "0 0 12px 12px", boxShadow: "0 4px 16px rgba(37,99,235,.38)" }}>✦ BELIEBT</div>
              )}
              <div className="flex flex-col h-full overflow-hidden rounded-[22px]">
                <div className="p-[18px] pb-0">
                  <Card bg={p.bg} lim={p.lim} />
                </div>
                <div className="px-5 pt-4">
                  <div className="text-[17px] font-bold text-gray-900 leading-tight">{p.name}</div>
                  <div className="text-[12px] text-gray-400 font-medium mt-0.5">{p.sub}</div>
                </div>
                <div className="mx-5 mt-3.5">
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-xl"
                    style={{ background: "linear-gradient(135deg, rgba(37,99,235,0.06), rgba(59,130,246,0.09))", border: "1px solid rgba(37,99,235,0.15)" }}>
                    <span className="text-[9px] font-bold tracking-[0.13em] uppercase" style={{ color: "rgba(37,99,235,.65)" }}>Wunschlimit bis</span>
                    <span className="text-[18px] font-extrabold text-[#2563eb] leading-none">{p.lim} €</span>
                  </div>
                </div>
                <div className="px-5 pt-3 flex items-baseline gap-1">
                  <span className="text-[28px] font-extrabold text-gray-900">{p.fee}</span>
                  <span className="text-[13px] text-gray-400 font-medium">€/Mt.</span>
                </div>
                <div className="mx-5 mt-3.5 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.10), transparent)" }} />
                <div className="px-5 pt-3.5 pb-5 flex-1 flex flex-col">
                  {p.feats.map((f, j) => (
                    <div key={j} className="flex items-start gap-2.5 py-[7px]" style={{ borderBottom: j === p.feats.length - 1 ? "none" : "1px solid rgba(0,0,0,0.042)" }}>
                      <svg width="18" height="18" className="shrink-0 mt-0.5" viewBox="0 0 18 18" fill="none">
                        <circle cx="9" cy="9" r="9" fill="rgba(37,99,235,0.10)" />
                        <path d="M5.5 9L7.8 11.5L12.5 6.5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-[13.5px] text-gray-700 font-medium leading-snug">{f}</span>
                    </div>
                  ))}
                </div>
                <div className="px-5 pb-5">
                  <a href={antragLink(p.key)}
                    className="relative block overflow-hidden text-center rounded-xl py-3.5 text-[13.5px] font-semibold tracking-[0.04em] uppercase transition-all"
                    style={{
                      background: p.rec ? "linear-gradient(135deg,#1e40af,#2563eb,#3b82f6)" : "transparent",
                      border: p.rec ? "none" : "1.5px solid rgba(37,99,235,0.25)",
                      color: p.rec ? "#fff" : "#2563eb",
                      boxShadow: p.rec ? "0 8px 24px rgba(37,99,235,0.38)" : "none",
                    }}>
                    <span className="relative z-10">{p.rec ? "Jetzt Pro sichern" : "Paket wählen"}</span>
                    {p.rec && <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.3), transparent)", animation: "startShimmer 3s ease-in-out infinite" }} />}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-[12px] text-gray-400 mt-6">Monatlich kündbar · Keine versteckten Gebühren · Zahlung erst nach Limit-Freigabe</p>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   USE CASES STRIP
   ════════════════════════════════════════════ */
function UseCases() {
  const cases = [
    { t: "Umschuldung", d: "Dispo weg, Zinsen runter." },
    { t: "Liquidität", d: "Sofort flüssig bleiben." },
    { t: "Business-Wachstum", d: "Skalieren statt warten." },
    { t: "Reise & Meilen", d: "Premium-Benefits nutzen." },
    { t: "International Shopping", d: "Keine FX-Gebühren." },
  ];
  const obs = useReveal();
  return (
    <section className="py-16 sm:py-20" ref={obs.ref}>
      <div className="max-w-[1120px] mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mb-10 text-center mx-auto">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[0.18em] uppercase mb-3">Für jeden Weg</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"><G>Vom LKW-Fahrer bis zum CEO.</G></h2>
          <p className="text-[14.5px] text-gray-500 leading-relaxed mt-3">Wir kalibrieren deine Bonitäts-Architektur neu — egal, wo du heute stehst.</p>
        </div>
        <div className="flex sm:grid sm:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto sm:overflow-visible snap-x snap-mandatory -mx-5 px-5 sm:mx-0 sm:px-0 pb-2 sm:pb-0">
          {cases.map((c, i) => (
            <div key={c.t}
              className={`shrink-0 snap-start min-w-[170px] sm:min-w-0 p-5 rounded-2xl border border-gray-100 bg-white transition-all duration-700 hover:border-blue-200 hover:-translate-y-0.5 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: `${i * 70}ms`, boxShadow: "0 2px 14px rgba(37,99,235,0.04)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-3" style={{ background: "linear-gradient(135deg,rgba(37,99,235,.08),rgba(59,130,246,.16))" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </div>
              <div className="text-[14px] font-semibold text-gray-900">{c.t}</div>
              <div className="text-[12.5px] text-gray-500 mt-1 leading-snug">{c.d}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   HOW IT WORKS
   ════════════════════════════════════════════ */
function HowItWorks() {
  const obs = useReveal();
  const steps = [
    { n: "01", t: "Antrag stellen", d: "Daten eingeben, Paket wählen. Unter 2 Minuten. Kein Papierkram." },
    { n: "02", t: "Algorithmische Freigabe", d: "Unsere Engine analysiert dein Profil live. Limit-Ziel in Sekunden kalibriert." },
    { n: "03", t: "Karte aktiv", d: "Virtuelle Karte sofort im Hub. Physische Metal-Card per Express binnen 48 h." },
  ];
  return (
    <section className="py-20 sm:py-28 relative" ref={obs.ref} style={{ background: "linear-gradient(180deg,#ffffff 0%, #f8faff 100%)" }}>
      <div className="max-w-[1120px] mx-auto px-5 sm:px-6">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[0.18em] uppercase mb-3">So läuft's</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"><G>Drei Schritte. Fünf Minuten. Maximum Limit.</G></h2>
        </div>
        <div className="relative grid sm:grid-cols-3 gap-5 sm:gap-6">
          <div className="hidden sm:block absolute top-10 left-[16.66%] right-[16.66%] h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(37,99,235,.35), rgba(37,99,235,.35), transparent)", animation: "startGlowPulse 6s ease-in-out infinite" }} />
          {steps.map((s, i) => (
            <div key={s.n}
              className={`relative p-7 rounded-2xl bg-white border border-gray-100 transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{ transitionDelay: `${i * 130}ms`, boxShadow: "0 2px 16px rgba(37,99,235,0.06)" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center font-mono text-[14px] font-bold text-white mb-4" style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", boxShadow: "0 8px 24px rgba(37,99,235,.35)" }}>{s.n}</div>
              <h3 className="text-[17px] font-semibold text-gray-900 mb-2">{s.t}</h3>
              <p className="text-[14px] text-gray-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   FAQ
   ════════════════════════════════════════════ */
function FAQ() {
  const obs = useReveal();
  const [open, setOpen] = useState<number | null>(0);
  const qas = [
    { q: "Muss ich Vorkasse leisten?", a: "Nein. Niemals. Die Paket-Gebühr wird erst fällig, wenn dein Limit freigegeben wurde. Zero Risiko auf deiner Seite." },
    { q: "Wie lange dauert es wirklich?", a: "Antrag in unter 2 Minuten. Algorithmische Freigabe in unter 120 Sekunden. Virtuelle Karte sofort einsatzbereit." },
    { q: "Ist das in meiner SCHUFA sichtbar?", a: "Nein. Zu 100 % neutral. Wir holen keine Auskunft ein. Dein Score bleibt unangetastet." },
    { q: "Was passiert, wenn ich abgelehnt werde?", a: "Dann zahlst du nichts. Unsere Engine ist transparent – du siehst die Entscheidung direkt und wir geben dir den strategischen Fahrplan zur Nachjustierung." },
    { q: "Kann ich monatlich kündigen?", a: "Ja, jederzeit. Ohne Begründung. Kein Fine-Print, keine Haltefristen." },
    { q: "Funktioniert das auch bei negativem SCHUFA-Score?", a: "Ja. Genau dafür existieren wir. Wir nutzen das US-Credit-Building-System — dein deutscher Score ist für uns kein Ausschlusskriterium." },
  ];
  return (
    <section className="py-20 sm:py-28" ref={obs.ref}>
      <div className="max-w-[760px] mx-auto px-5 sm:px-6">
        <div className="text-center mb-12">
          <p className="text-[12px] font-semibold text-[#2563eb] tracking-[0.18em] uppercase mb-3">Kurz & hart</p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight"><G>Die Fragen, die du wirklich hast.</G></h2>
        </div>
        <div className="space-y-3">
          {qas.map((f, i) => (
            <div key={i}
              className={`fiaon-glass-panel rounded-2xl transition-all duration-500 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: `${i * 60}ms` }}>
              <button onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 text-left px-5 sm:px-6 py-4 sm:py-5"
                aria-expanded={open === i}>
                <span className="text-[15px] sm:text-[16px] font-semibold text-gray-900 pr-2">{f.q}</span>
                <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[#2563eb] transition-transform" style={{ background: "rgba(37,99,235,0.08)", transform: open === i ? "rotate(45deg)" : "rotate(0)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                </span>
              </button>
              <div style={{ maxHeight: open === i ? 260 : 0, overflow: "hidden", transition: "max-height .45s cubic-bezier(.22,1,.36,1)" }}>
                <p className="px-5 sm:px-6 pb-5 text-[14px] text-gray-600 leading-relaxed">{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   RISK REVERSAL
   ════════════════════════════════════════════ */
function Reversal() {
  const obs = useReveal();
  return (
    <section className="relative py-20 sm:py-28 overflow-hidden" ref={obs.ref} style={{ background: "linear-gradient(180deg,#0b1628 0%,#0f1d34 100%)" }}>
      <div className="absolute inset-0 pointer-events-none opacity-40" style={{ background: "radial-gradient(ellipse at top, rgba(37,99,235,.25), transparent 60%)" }} />
      <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[600px] h-[300px] pointer-events-none" style={{ background: "radial-gradient(ellipse, rgba(37,99,235,.22), transparent 70%)", filter: "blur(60px)" }} />
      <div className={`relative z-10 max-w-[800px] mx-auto px-5 sm:px-6 text-center transition-all duration-700 ${obs.v ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
        <span className="inline-block mb-4 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.14em] uppercase text-[#93c5fd]"
          style={{ background: "rgba(37,99,235,0.14)", border: "1px solid rgba(37,99,235,0.28)" }}>Risiko-Umkehr</span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-white leading-[1.08] mb-5">
          Du zahlst keinen Cent,<br /><span className="text-[#93c5fd]">bevor dein Limit aktiv ist.</span>
        </h2>
        <p className="text-[15px] sm:text-[17px] text-gray-300 leading-relaxed max-w-[560px] mx-auto mb-9">
          Keine Einrichtungsgebühr. Keine Vorkasse. Kein versteckter Haken. Wenn wir nicht liefern, zahlst du nichts. Punkt.
        </p>
        <a href={antragLink("highend")}
          className="relative inline-flex items-center gap-2 px-9 py-4 rounded-full text-[16px] font-semibold text-white overflow-hidden group"
          style={{ background: "linear-gradient(135deg,#2563eb,#3b82f6)", boxShadow: "0 20px 50px rgba(37,99,235,.45), 0 0 0 1px rgba(255,255,255,.1) inset", minHeight: 54 }}>
          <span className="relative z-10">Jetzt 25.000 € sichern</span>
          <svg className="relative z-10" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
          <span className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ boxShadow: "0 0 60px rgba(37,99,235,.7)" }} />
          <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.35), transparent)", animation: "startShimmer 3.2s ease-in-out infinite" }} />
        </a>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12.5px] text-gray-400 font-medium">
          <span className="inline-flex items-center gap-1.5"><Check /> Schufaneutral</span>
          <span className="inline-flex items-center gap-1.5"><Check /> Monatlich kündbar</span>
          <span className="inline-flex items-center gap-1.5"><Check /> EU-Hosting · AES-256</span>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════
   STICKY MOBILE CTA
   ════════════════════════════════════════════ */
function StickyCTA({ ctaRef }: { ctaRef: React.RefObject<HTMLDivElement> }) {
  const [visible, setVisible] = useState(false);
  const t = useMidnightCountdown();
  useEffect(() => {
    const el = ctaRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(!e.isIntersecting), { threshold: 0 });
    io.observe(el); return () => io.disconnect();
  }, [ctaRef]);
  if (!visible) return null;
  return (
    <div className="lg:hidden fixed inset-x-0 bottom-0 z-40" style={{ paddingBottom: "env(safe-area-inset-bottom)", animation: "startStickyIn .35s cubic-bezier(.22,1,.36,1)" }}>
      <div className="mx-3 mb-3 rounded-2xl px-3 py-2.5 flex items-center gap-3"
        style={{
          background: "rgba(255,255,255,.92)",
          backdropFilter: "blur(18px) saturate(170%)",
          WebkitBackdropFilter: "blur(18px) saturate(170%)",
          border: "1px solid rgba(37,99,235,.14)",
          boxShadow: "0 20px 50px -10px rgba(10,20,40,.25), 0 8px 24px -8px rgba(37,99,235,.18)",
        }}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: "startPulseDot 1.8s ease-in-out infinite" }} />
            <span className="text-[10.5px] uppercase tracking-wider font-bold text-gray-500">25.000 € bereit</span>
          </div>
          <div className="text-[11.5px] font-mono font-semibold text-gray-800 tabular-nums mt-0.5">Reset in {t.h}:{t.m}:{t.s}</div>
        </div>
        <a href={antragLink("highend")}
          className="fiaon-btn-gradient shrink-0 inline-flex items-center gap-1.5 px-5 py-3 rounded-full text-[13.5px] font-semibold text-white whitespace-nowrap"
          style={{ minHeight: 44 }}
          onClick={() => { try { fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "wa_sticky_cta", src: "wa" }) }).catch(() => { }); } catch { } }}>
          Jetzt sichern
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
        </a>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   PAGE
   ════════════════════════════════════════════ */
export default function StartPage() {
  const heroCtaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = "FIAON · 25.000 € Limit sofort sichern";
    const metaName = 'description';
    let meta = document.querySelector(`meta[name="${metaName}"]`) as HTMLMetaElement | null;
    const prevDesc = meta?.content || "";
    if (!meta) { meta = document.createElement("meta"); meta.name = metaName; document.head.appendChild(meta); }
    meta.content = "Bis 25.000 € Sofort-Limit. Schufaneutral. Keine Vorkasse. In unter 5 Minuten einsatzbereit.";

    let robots = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const prevRobots = robots?.content || "";
    if (!robots) { robots = document.createElement("meta"); robots.name = "robots"; document.head.appendChild(robots); }
    robots.content = "noindex, follow";

    return () => {
      document.title = prevTitle;
      if (meta) meta.content = prevDesc;
      if (robots) robots.content = prevRobots;
    };
  }, []);

  return (
    <div className="min-h-screen text-gray-900 antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: "linear-gradient(180deg,#ffffff 0%,#f8faff 40%,#ffffff 100%)" }}>
      <GlassNav activePage="privatkunden" />
      <ScarcityBar />
      <Hero ctaRef={heroCtaRef} />
      <TrustBar />
      <Pains />
      <Packages />
      <UseCases />
      <HowItWorks />
      <FAQ />
      <Reversal />
      <PremiumFooter />
      <StickyCTA ctaRef={heroCtaRef} />
    </div>
  );
}
