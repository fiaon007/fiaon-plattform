import { useState, useEffect, useCallback, useMemo } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

const PACKS = [
  { key:"start", name:"FIAON Starter\n(Das Fundament)", fee:7.99, lim:500, bg:"linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats:["KI-Profilanalyse (Basis-Scan)","Kartenkompass: Markt-Matching","Credit-Building Grundmodul","Digitales Strategie-Dashboard"], pay:"https://buy.stripe.com/7sY5kDbfRdT06fagh9bMQ01" },
  { key:"pro", name:"FIAON Pro\n(Standard – EMPFOHLEN)", fee:59.99, lim:5000, rec:true, bg:"linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats:["Vollständiges Credit-Building System","KI-Matching mit Score-Prognose","Dynamischer Score-Simulator","Limit-Hebel-Strategie (12 Monate)","Priority Support-Zugang"], pay:"https://buy.stripe.com/cNieVdcjVeX4fPK4yrbMQ02" },
  { key:"ultra", name:"FIAON Ultra\n(Elite Konto)", fee:79.99, lim:15000, bg:"linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats:["Premium Coaching (Meilen & Cashback)","Multi-Karten-Portfolio-Struktur","Individueller Optimierungs-Algorithmus","Exklusive Strategie-Sessions"], pay:"https://buy.stripe.com/eVq4gz83F02a5b68OHbMQ03" },
  { key:"highend", name:"FIAON High End\n(Das Maximum)", fee:99.99, lim:25000, bg:"linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats:["1-on-1 Strategy-Director (Monatlich)","VIP International Credit Building","24/7 Dedicated Concierge-Support","Individuelle Limit-Roadmap (Hochend)"], pay:"https://buy.stripe.com/7sYdR9abNcOW5b6c0TbMQ04" },
];

function mkRef() { return "FIAON-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function eur(n: number) { return "€ " + n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

async function track(event: string, data?: any, ref?: string) {
  try { await fetch("/api/fiaon/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, data, ref, sessionId: sessionStorage.getItem("fiaon_sid") || "", page: location.pathname }) }); } catch {}
}

/* === LIVE CREDIT CARD — HYPER-REALISTIC DESIGN === */
function LiveCard({ bg, name, lim, className = "", compact = false }: { bg: string; name: string; lim: string; className?: string; compact?: boolean }) {
  const displayName = name || "MAX MUSTERMANN";
  const nameLen = displayName.length;
  const nameFontSize = useMemo(() => {
    if (compact) return Math.max(7, Math.min(10, 120 / Math.max(nameLen, 1)));
    return Math.max(8, Math.min(12, 160 / Math.max(nameLen, 1)));
  }, [nameLen, compact]);

  return (
    <div className={`w-full aspect-[1.586/1] rounded-xl relative overflow-hidden select-none transition-all duration-500 ${className}`} style={{ 
      background: bg, 
      boxShadow: compact 
        ? "0 8px 24px -4px rgba(0,0,0,.2), 0 4px 12px -2px rgba(0,0,0,.15), inset 0 1px 0 rgba(255,255,255,.15), inset 0 -1px 0 rgba(0,0,0,.1)" 
        : "0 16px 48px -8px rgba(0,0,0,.25), 0 8px 24px -4px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.2), inset 0 -1px 0 rgba(0,0,0,.12)",
      border: "1px solid rgba(255,255,255,.1)"
    }}>
      {/* Animated gradient overlay for premium look */}
      <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
        background: "linear-gradient(135deg, rgba(255,255,255,0.2), rgba(37,99,235,0.1), rgba(147,197,253,0.15), rgba(37,99,235,0.08), rgba(255,255,255,0.2))",
        backgroundSize: "300% 300%",
        animation: "cardGradientAnim 6s ease-in-out infinite"
      }} />
      
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.25), transparent 60%)", mixBlendMode: "overlay" }} />
      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,.6) 40px, rgba(255,255,255,.6) 41px)" }} />

      <div className={`absolute inset-0 flex flex-col justify-between z-10 ${compact ? "p-4" : "p-5"}`}>
        <div className="flex justify-between items-start">
          <div className={`rounded ${compact ? "w-9 h-6" : "w-11 h-7"}`} style={{ 
            background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", 
            boxShadow: "0 2px 6px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.4)" 
          }}>
            <div className="w-full h-full rounded opacity-25" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,.2) 3px, rgba(0,0,0,.2) 4px)" }} />
          </div>
          <span className={`font-semibold tracking-[.08em] ${compact ? "text-xs" : "text-sm"}`} style={{ color: "rgba(255,255,255,.75)", textShadow: "0 1px 2px rgba(0,0,0,.2)" }}>FIAON</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`${compact ? "text-xl" : "text-2xl"} font-bold tracking-tight`} style={{ 
              color: "rgba(255,255,255,.95)", 
              textShadow: "0 2px 8px rgba(0,0,0,.3), 0 1px 2px rgba(0,0,0,.2)",
              letterSpacing: "0.02em"
            }}>
              {lim}€
            </div>
          </div>
        </div>

        <div className="flex justify-between items-end">
          <div className="min-w-0 flex-1">
            <div className={`font-medium ${compact ? "text-[8px]" : "text-[9px]"} mb-0.5`} style={{ 
              color: "rgba(255,255,255,.95)", 
              textShadow: "0 1px 3px rgba(0,0,0,.3)",
              letterSpacing: "0.05em",
              fontSize: `${nameFontSize}px`
            }}>
              {displayName}
            </div>
            <div className={`uppercase tracking-[.12em] font-medium ${compact ? "text-[7px]" : "text-[8px]"}`} style={{ color: "rgba(255,255,255,.4)" }}>
              FIAON
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === PROGRESS BAR === */
function Progress({ step, total }: { step: number; total: number }) {
  const progress = ((step + 1) / total) * 100;
  return (
    <div className="mb-10">
      <div className="flex gap-1.5 mb-3">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-1.5 rounded-full relative overflow-hidden" style={{ background: i <= step ? "rgba(37,99,235,.15)" : "rgba(0,0,0,.04)" }}>
            {i < step && <div className="absolute inset-0 rounded-full bg-[#2563eb]" />}
            {i === step && <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#2563eb] to-[#3b82f6]" style={{ animation: "shimmer 2s ease-in-out infinite", backgroundSize: "200% 100%" }} />}
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[11px] font-medium text-gray-400">
        <span>Schritt {step + 1} von {total}</span>
        <span>{Math.round(progress)}% abgeschlossen</span>
      </div>
    </div>
  );
}

/* === FORM HELPERS === */
function Field({ label, req, error, hint, children }: { label: string; req?: boolean; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="flex justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}{req && <span className="text-[#2563eb]">*</span>}</label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
      {error && <p className="mt-1.5 text-[11px] font-semibold text-red-500 bg-red-50/80 px-2.5 py-1 rounded-lg">{error}</p>}
    </div>
  );
}

function Inp({ value, onChange, placeholder, type = "text", ...p }: any) {
  return <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300" {...p} />;
}

function Sel({ value, onChange, children, ...p }: any) {
  return <select value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none appearance-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "38px" }} {...p}>{children}</select>;
}

/* === MAIN COMPONENT === */
export default function AntragPage() {
  const [step, setStep] = useState(0);
  const [ref] = useState(mkRef);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pack, setPack] = useState<typeof PACKS[0] | null>(null);

  const [d, setD] = useState({ firstName: "", lastName: "", birthDay: "", birthMonth: "", birthYear: "1990", phoneCountryCode: "+49", phone: "", street: "", zip: "", city: "", country: "", nationality: "", employment: "", employer: "", employedSince: "", income: 0, rent: 0, debts: 0, housing: "", wantedLimit: 0, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja", email: "", iban: "", billingMethod: "iban", ag1: false, ag2: false, ag3: false });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); window.scrollTo(0, 0); }, []);

  // Counter animation for score section
  useEffect(() => {
    if (step === 0) {
      const counter = document.getElementById("scoreCounter");
      if (counter) {
        let start = 82;
        const end = 98;
        const duration = 2000;
        const increment = (end - start) / (duration / 16);
        let current = start;
        
        const animate = () => {
          current += increment;
          if (current < end) {
            counter.textContent = Math.round(current) + "%";
            requestAnimationFrame(animate);
          } else {
            counter.textContent = end + "%";
          }
        };
        
        animate();
      }
    }
  }, [step]);

  const up = useCallback((k: string, v: any) => setD(p => ({ ...p, [k]: v })), []);
  const cardName = (d.firstName + " " + d.lastName).trim().toUpperCase();

  function goStep(n: number) { setStep(n); setErrors({}); track("step_change", { from: step, to: n }, ref); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function next() {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.firstName) e.firstName = "Vorname eingeben";
      if (!d.lastName) e.lastName = "Nachname eingeben";
      if (!d.birthDay || !d.birthMonth || !d.birthYear || d.birthYear.length < 4) e.birth = "Gültiges Datum eingeben";
      else { const age = new Date().getFullYear() - +d.birthYear; if (age < 18) e.birth = "Du musst mind. 18 sein"; }
      if (!d.phoneCountryCode || !d.phone) e.phone = "Telefonnummer eingeben";
      if (!d.street) e.street = "Adresse eingeben";
      if (!d.zip) e.zip = "PLZ eingeben";
      if (!d.city) e.city = "Ort eingeben";
      if (!d.country) e.country = "Land wählen";
      if (!d.nationality) e.nationality = "Bitte wählen";
    } else if (step === 2) {
      if (!d.employment) e.employment = "Status wählen";
      if (!d.employedSince) e.employedSince = "Bitte wählen";
      if (!d.housing) e.housing = "Bitte wählen";
    } else if (step === 3) {
      if (!d.purpose) e.purpose = "Bitte wählen";
    } else if (step === 6) {
      if (!d.email || !d.email.includes("@")) e.email = "Gültige E-Mail eingeben";
      if (d.billingMethod === "iban" && !d.iban) e.iban = "IBAN eingeben";
      if (!d.ag1 || !d.ag2 || !d.ag3) e.consent = "Bitte allen Bedingungen zustimmen";
    }
    if (Object.keys(e).length) { setErrors(e); return; }
    if (step === 3) { goStep(4); runVerify(); return; }
    if (step === 6) { goStep(7); setTimeout(() => goStep(8), 6000); return; }
    goStep(step + 1);
  }

  function runVerify() {
    setVerifyDone(false);
    setTimeout(() => {
      const mx = pack?.lim || 5000;
      let a = Math.round(d.wantedLimit * (1 + (Math.random() > .5 ? 1 : -1) * (0.05 + Math.random() * 0.1)) / 50) * 50;
      if (a > mx) a = mx; if (a < 250) a = 250;
      setApproved(a); setVerifyDone(true);
      setTimeout(() => goStep(5), 2500);
    }, 12000);
  }

  useEffect(() => {
    if (step > 0) {
      const status = ["started","personal_data","finances","config","verifying","approved","contract","processing","completed"][step] || "started";
      fetch("/api/fiaon/application", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, type: "private", status, currentStep: step, ...d, packKey: pack?.key, packName: pack?.name, approvedLimit: approved }) }).catch(() => {});
    }
  }, [step]);

  const sideCard = <LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={(pack?.lim || 5000).toLocaleString("de-DE")} />;

  return (
    <div className="min-h-screen text-gray-900 antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: "linear-gradient(180deg, #f0f4ff 0%, #f8faff 30%, #ffffff 60%)" }}>
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <GlassNav activePage="privatkunden" />

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-5 pt-24 sm:pt-28 pb-8 sm:pb-12 relative z-10">
        {step > 0 && <Progress step={step} total={9} />}

        {/* === STEP 0: Paketauswahl === */}
        {step === 0 && (
          <div className="animate-[fadeInUp_.4s_ease]">
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Paket wählen</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight fiaon-gradient-text-animated mb-4">Wähle dein FIAON Paket</h1>
              <p className="text-[15px] text-gray-400 max-w-lg mx-auto leading-relaxed">Entscheide dich für das passende Paket — du gelangst automatisch zum nächsten Schritt.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
              {PACKS.map((p, idx) => (
                <button 
                  key={p.key} 
                  onClick={() => { setPack(p); up("wantedLimit", Math.min(d.wantedLimit, p.lim)); track("pack_select", { pack: p.key }, ref); setTimeout(() => goStep(1), 400); }} 
                  className={`group text-left rounded-2xl overflow-hidden transition-all duration-500 h-full flex flex-col ${pack?.key === p.key ? "fiaon-glass-card-selected scale-[1.02]" : "fiaon-glass-card"}`}
                  style={{ animation: `smoothScaleIn 0.5s ease ${idx * 80}ms both` }}
                >
                  {/* Card area with generous padding */}
                  <div className="p-5 sm:p-6">
                    <LiveCard bg={p.bg} name="" lim={p.lim.toLocaleString("de-DE")} compact className="w-full" />
                  </div>
                  <div className="px-5 sm:px-6 pb-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[15px] font-semibold text-gray-900" style={{ whiteSpace: "pre-line" }}>{p.name}</span>
                      {p.rec && <span className="text-[9px] font-semibold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded">Empfohlen</span>}
                    </div>
                    
                    {/* HIGH END Limit Highlight */}
                    <div className="relative mb-5 p-4 rounded-xl overflow-hidden" style={{
                      background: "rgba(255, 255, 255, 0.6)",
                      backdropFilter: "blur(20px) saturate(180%)",
                      WebkitBackdropFilter: "blur(20px) saturate(180%)",
                      border: "1px solid rgba(37, 99, 235, 0.2)",
                      boxShadow: "0 8px 32px rgba(37, 99, 235, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)"
                    }}>
                      <div className="absolute inset-0 opacity-40 pointer-events-none" style={{
                        background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.15), rgba(37,99,235,0.1))",
                        backgroundSize: "200% 200%",
                        animation: "limitGlow 4s ease-in-out infinite"
                      }} />
                      <div className="relative z-10 text-center">
                        <div className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#2563eb] mb-1.5" style={{ textShadow: "0 1px 2px rgba(37,99,235,0.1)" }}>Wunschlimit bis</div>
                        <div className="text-[22px] sm:text-[24px] font-bold tracking-tight whitespace-nowrap" style={{
                          background: "linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)",
                          backgroundClip: "text",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          textShadow: "0 2px 12px rgba(37,99,235,0.15)"
                        }}>
                          {p.lim.toLocaleString("de-DE")} €
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-1.5 mb-5">
                      <span className="text-[28px] font-semibold text-gray-900 tracking-tight">{p.fee.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[13px] text-gray-400">€/Mt.</span>
                    </div>
                    <ul className="space-y-2.5 mb-6 flex-1">
                      {p.feats.map((f, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-[13px] text-gray-600">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-3 border-t border-gray-100/80">
                      <button className="w-full py-3 px-4 rounded-lg text-[13px] font-semibold text-[#2563eb] border-2 border-[#2563eb] bg-transparent hover:bg-[#2563eb] hover:text-white transition-all duration-300">
                        Konto eröffnen
                      </button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-8">Das endgültige Kreditlimit wird individuell festgelegt.</p>
          </div>
        )}

        {/* === DARK MODE SCORE SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.6s_ease]">
            <div className="relative py-24 sm:py-32 px-6 -mx-5 overflow-hidden" style={{ background: "#0A0F1C" }}>
              {/* Mesh Gradient Background */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-[1000px] h-[600px] opacity-30" style={{
                  background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.15), rgba(147, 197, 253, 0.1), transparent 70%)",
                  filter: "blur(80px)",
                  animation: "meshGradient 15s ease-in-out infinite"
                }} />
                <div className="absolute bottom-0 right-0 w-[800px] h-[500px] opacity-25" style={{
                  background: "radial-gradient(ellipse at center, rgba(147, 197, 253, 0.12), rgba(139, 92, 246, 0.08), transparent 70%)",
                  filter: "blur(60px)",
                  animation: "meshGradient 20s ease-in-out infinite reverse"
                }} />
              </div>

              {/* Content */}
              <div className="relative z-10 max-w-4xl mx-auto text-center">
                {/* Section Badge */}
                <div className="mb-8">
                  <span className="inline-block px-5 py-2.5 bg-white/10 backdrop-blur-xl border border-violet-400/30 text-violet-300 text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-violet-500/20">
                    PRIVATKUNDEN SETUP
                  </span>
                </div>

                {/* Headline */}
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1] fiaon-gradient-text-animated">
                  Dein Limit ist keine Glückssache.<br/>
                  Es ist Mathematik.
                </h2>

                {/* Subline */}
                <p className="text-lg text-gray-400 mb-16 max-w-2xl mx-auto leading-relaxed">
                  Die Bank bewertet dich nach einem starren Algorithmus. Es ist Zeit, deinen eigenen zu nutzen. Wähle dein strategisches Setup und erhalte Zugang zur führenden Limit-Building-Software Europas.
                </p>

                {/* Score Circle Visualization */}
                <div className="relative flex items-center justify-center">
                  {/* Glow Effect */}
                  <div className="absolute w-64 h-64 rounded-full bg-gradient-to-r from-violet-500/20 to-blue-400/20 blur-3xl" style={{ animation: "glowPulse 3s ease-in-out infinite" }} />
                  
                  {/* Score Circle */}
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    {/* Outer Ring */}
                    <div className="absolute inset-0 rounded-full border-4 border-violet-500/30" style={{ animation: "spin 8s linear infinite" }} />
                    {/* Middle Ring */}
                    <div className="absolute inset-4 rounded-full border border-blue-400/40" style={{ animation: "spin 6s linear infinite reverse" }} />
                    {/* Inner Ring */}
                    <div className="absolute inset-8 rounded-full border border-violet-300/50" style={{ animation: "spin 4s linear infinite" }} />
                    
                    {/* Score Text */}
                    <div className="relative z-10 text-center">
                      <div className="text-5xl font-bold text-white fiaon-gradient-text-animated mb-2" id="scoreCounter">82%</div>
                      <div className="text-xs text-gray-400 uppercase tracking-wider">Score</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === EDGE-TO-EDGE DASHBOARD MOCKUP SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.8s_ease]">
            <div className="relative w-full overflow-hidden" style={{ background: "#ffffff" }}>
              {/* Background Effects */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 right-0 w-[800px] h-[600px] opacity-20" style={{
                  background: "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.15), transparent 70%)",
                  filter: "blur(80px)"
                }} />
                <div className="absolute bottom-0 left-0 w-[600px] h-[500px] opacity-15" style={{
                  background: "radial-gradient(ellipse at center, rgba(139, 92, 246, 0.1), transparent 70%)",
                  filter: "blur(60px)"
                }} />
              </div>

              <div className="max-w-[1600px] mx-auto px-6 py-24 sm:py-32">
                <div className="grid lg:grid-cols-2 gap-16 items-center">
                  {/* Left: Text Block */}
                  <div className="lg:col-span-1">
                    {/* Section Badge */}
                    <div className="mb-8">
                      <span className="inline-block px-5 py-2.5 bg-blue-50 backdrop-blur-xl border border-blue-200 text-blue-600 text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
                        DIE SOFTWARE
                      </span>
                    </div>

                    {/* Headline */}
                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8 leading-[1.1] fiaon-gradient-text-animated">
                      Du kaufst keine PDF.<br/>
                      Du kaufst dein persönliches Finanz-Cockpit.
                    </h2>

                    {/* Text */}
                    <p className="text-lg text-gray-600 leading-relaxed">
                      Sobald du dein Setup wählst, öffnet sich das FIAON-Dashboard. Keine verstaubten Ratgeber, sondern interaktive Daten. Du siehst deine persönliche Limit-Roadmap, simulierst Entscheidungen, bevor du sie triffst, und trackst deinen monatlichen Fortschritt. Die KI liefert die Insights – du triffst die Entscheidungen.
                    </p>
                  </div>

                  {/* Right: Dashboard Mockup */}
                  <div className="lg:col-span-1">
                    <div className="relative">
                      {/* Glass Dashboard */}
                      <div className="fiaon-glass-panel rounded-2xl p-6 border border-white/20 shadow-2xl shadow-blue-500/20 relative overflow-hidden"
                           style={{ background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(20px)" }}>
                        
                        {/* Dashboard Header */}
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full bg-green-500" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                            <span className="text-sm font-semibold text-white">FIAON Dashboard</span>
                          </div>
                          <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-lg bg-white/10" />
                            <div className="w-8 h-8 rounded-lg bg-white/10" />
                          </div>
                        </div>

                        {/* Score-Simulator Graph */}
                        <div className="mb-6 p-4 rounded-xl" style={{ background: "rgba(15, 23, 42, 0.6)" }}>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Score-Simulator</span>
                            <span className="text-xs text-green-400">+12.5%</span>
                          </div>
                          {/* Graph Visualization */}
                          <div className="relative h-24">
                            {/* Gradient Fill */}
                            <div className="absolute inset-0 rounded-lg" style={{
                              background: "linear-gradient(180deg, rgba(37, 99, 235, 0.3) 0%, rgba(37, 99, 235, 0.05) 100%)"
                            }} />
                            {/* Curved Line */}
                            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 80" preserveAspectRatio="none">
                              <defs>
                                <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#2563eb" />
                                  <stop offset="50%" stopColor="#3b82f6" />
                                  <stop offset="100%" stopColor="#60a5fa" />
                                </linearGradient>
                              </defs>
                              <path
                                d="M0,60 Q25,50 50,45 T100,35 T150,25 T200,15"
                                fill="none"
                                stroke="url(#lineGradient)"
                                strokeWidth="3"
                                style={{ animation: "dash 2s ease-in-out infinite" }}
                              />
                            </svg>
                            {/* Grid Lines */}
                            <div className="absolute inset-0 flex flex-col justify-between opacity-20">
                              <div className="w-full h-px bg-white/30" />
                              <div className="w-full h-px bg-white/30" />
                              <div className="w-full h-px bg-white/30" />
                            </div>
                          </div>
                        </div>

                        {/* Next Action Card */}
                        <div className="p-4 rounded-xl" style={{ background: "rgba(37, 99, 235, 0.1)" }}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                              <span className="text-xl font-bold text-white">14</span>
                            </div>
                            <div>
                              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Next Action</div>
                              <div className="text-sm text-white">Warte 14 Tage bis zur nächsten Anfrage</div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Decorative Elements */}
                      <div className="absolute -bottom-4 -right-4 w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 backdrop-blur-sm border border-white/20 shadow-xl" />
                      <div className="absolute -top-4 -left-4 w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-600/20 backdrop-blur-sm border border-white/20 shadow-lg" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === BENTO-BOX FEATURES SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.8s_ease]">
            <div className="max-w-[1400px] mx-auto px-6">
              {/* Section Badge */}
              <div className="mb-8">
                <span className="inline-block px-5 py-2.5 bg-blue-50 backdrop-blur-xl border border-blue-200/50 text-blue-600 text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-500/10">
                  DIE BENTO-BOX
                </span>
              </div>

              {/* Headline */}
              <div className="text-center mb-12">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4 fiaon-gradient-text-animated">
                  Die Features im Detail
                </h2>
                <p className="text-[15px] text-gray-500 max-w-2xl mx-auto leading-relaxed">
                  Wir brechen die abstrakten Begriffe in messbare Werkzeuge herunter.
                </p>
              </div>

              {/* Bento Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Tile 1: Score-Simulator (Left, Large) */}
                <div className="lg:col-span-1 lg:row-span-2">
                  <div className="fiaon-glass-panel rounded-2xl p-8 h-full border border-white/40 shadow-xl hover:shadow-2xl transition-all duration-300"
                       style={{ background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(20px)" }}>
                    
                    {/* Visual: Slider */}
                    <div className="mb-8 p-6 rounded-xl" style={{ background: "rgba(15, 23, 42, 0.05)" }}>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Simulieren</span>
                        <span className="text-2xl font-bold text-blue-600">+14</span>
                      </div>
                      {/* Slider Track */}
                      <div className="relative h-2 rounded-full" style={{ background: "linear-gradient(90deg, #e0e7ff 0%, #3b82f6 100%)" }}>
                        {/* Slider Thumb */}
                        <div className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-lg border-2 border-blue-500"
                             style={{ left: "70%", transform: "translate(-50%, -50%)" }} />
                      </div>
                      {/* Glow Path */}
                      <div className="absolute inset-0 rounded-full opacity-30 blur-sm" style={{
                        background: "linear-gradient(90deg, transparent, rgba(59, 130, 246, 0.5))",
                        animation: "glowPulse 2s ease-in-out infinite"
                      }} />
                    </div>

                    {/* Headline */}
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">Der Score-Simulator</h3>

                    {/* Text */}
                    <p className="text-[15px] text-gray-600 leading-relaxed">
                      Was passiert, wenn du heute einen Antrag stellst? Was passiert in 90 Tagen? Simuliere die Auswirkungen auf dein Profil, bevor du in der realen Welt handelst. Vermeide fatale Timing-Fehler.
                    </p>
                  </div>
                </div>

                {/* Tile 2: Kartenkompass (Right Top, Wide) */}
                <div className="lg:col-span-1">
                  <div className="fiaon-glass-panel rounded-2xl p-6 h-full border border-white/40 shadow-xl hover:shadow-2xl transition-all duration-300"
                       style={{ background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(20px)" }}>
                    
                    {/* Visual: Overlapping Cards with Scan Line */}
                    <div className="mb-6 relative h-32">
                      {/* Card 1 */}
                      <div className="absolute top-4 left-4 w-32 h-20 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 opacity-80 blur-sm" />
                      {/* Card 2 */}
                      <div className="absolute top-6 left-8 w-32 h-20 rounded-xl bg-gradient-to-br from-violet-100 to-violet-200 opacity-80 blur-sm" />
                      {/* Scan Line */}
                      <div className="absolute inset-0 overflow-hidden rounded-xl">
                        <div className="w-full h-0.5 bg-blue-500 shadow-lg shadow-blue-500/50"
                             style={{ animation: "scan 2s ease-in-out infinite" }} />
                      </div>
                    </div>

                    {/* Headline */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Der Kartenkompass</h3>

                    {/* Text */}
                    <p className="text-[14px] text-gray-600 leading-relaxed">
                      Unsere Engine gleicht dein Profil blind mit dem Markt ab. Du siehst sofort, bei welchen Anbietern deine Wahrscheinlichkeiten am höchsten sind. 100 % redaktionell. 0 % Affiliate-getrieben.
                    </p>
                  </div>
                </div>

                {/* Tile 3: Coaching-Matrix (Right Bottom, Wide) */}
                <div className="lg:col-span-1">
                  <div className="fiaon-glass-panel rounded-2xl p-6 h-full border border-white/40 shadow-xl hover:shadow-2xl transition-all duration-300"
                       style={{ background: "rgba(255, 255, 255, 0.7)", backdropFilter: "blur(20px)" }}>
                    
                    {/* Visual: Timeline */}
                    <div className="mb-6">
                      <div className="space-y-3">
                        {/* Month 1 - Active */}
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" style={{ animation: "pulse 2s ease-in-out infinite" }} />
                          <span className="text-sm font-semibold text-blue-600">Monat 1</span>
                        </div>
                        {/* Month 2 - Inactive */}
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                          <span className="text-sm text-gray-400">Monat 2</span>
                        </div>
                        {/* Month 3 - Inactive */}
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                          <span className="text-sm text-gray-400">Monat 3</span>
                        </div>
                        {/* Month 4 - Inactive */}
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full bg-gray-300" />
                          <span className="text-sm text-gray-400">Monat 4</span>
                        </div>
                      </div>
                    </div>

                    {/* Headline */}
                    <h3 className="text-xl font-bold text-gray-900 mb-3">Die Limit-Roadmap</h3>

                    {/* Text */}
                    <p className="text-[14px] text-gray-600 leading-relaxed">
                      Das US-amerikanische Credit-Building-System, übersetzt in einen 12-Monats-Plan. Du weißt immer genau, was im aktuellen Monat deine wichtigste Aufgabe ist.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === ROI CALCULATOR SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.8s_ease]">
            <div className="relative py-24 sm:py-32 px-6 rounded-3xl overflow-hidden" style={{ background: "#ffffff" }}>
              {/* Background Effects */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] opacity-20" style={{
                  background: "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.15), transparent 70%)",
                  filter: "blur(80px)"
                }} />
              </div>

              <div className="relative z-10 max-w-4xl mx-auto text-center">
                {/* Section Badge */}
                <div className="mb-8">
                  <span className="inline-block px-5 py-2.5 bg-violet-50 backdrop-blur-xl border border-violet-200 text-violet-600 text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-violet-500/10">
                    DER RETURN ON INVESTMENT
                  </span>
                </div>

                {/* Headline */}
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-8 leading-[1.1] fiaon-gradient-text-animated">
                  Eine Investition, die sich selbst refinanziert.
                </h2>

                {/* Text */}
                <p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto leading-relaxed">
                  Warum 59 Euro im Monat zahlen? Weil dich Unwissenheit ein Vielfaches kostet. Eine optimierte 2-Karten-Strategie spart dir durchschnittlich 300 € Fremdwährungsgebühren im Jahr, generiert Hunderte Euros an Cashback und gibt dir Zugang zu zinsfreien Zahlungszielen, die deine Liquidität massiv erhöhen. FIAON ist kein Kostenpunkt. Es ist dein Hebel.
                </p>

                {/* Scale Visualization */}
                <div className="relative flex items-center justify-center gap-8 px-8">
                  {/* Left Bar: FIAON Setup (Short, Red/Orange) */}
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-32 rounded-lg relative overflow-hidden" style={{ background: "linear-gradient(180deg, #f97316 0%, #ef4444 100%)" }}>
                      {/* Glow Effect */}
                      <div className="absolute inset-0 opacity-30" style={{
                        background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.3), transparent)",
                        animation: "glowPulse 3s ease-in-out infinite"
                      }} />
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-3xl font-bold text-orange-600 mb-1">59 €</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wider">FIAON Setup</div>
                    </div>
                  </div>

                  {/* Balance Point */}
                  <div className="w-4 h-4 rounded-full bg-gray-400 shadow-lg shadow-gray-400/50" style={{ animation: "pulse 2s ease-in-out infinite" }} />

                  {/* Right Bar: Potential Value (Long, Blue/Violet) */}
                  <div className="flex flex-col items-center">
                    <div className="w-24 h-48 rounded-lg relative overflow-hidden" style={{ background: "linear-gradient(180deg, #8b5cf6 0%, #3b82f6 100%)" }}>
                      {/* Glow Effect */}
                      <div className="absolute inset-0 opacity-30" style={{
                        background: "radial-gradient(circle at center, rgba(255, 255, 255, 0.3), transparent)",
                        animation: "glowPulse 3s ease-in-out infinite"
                      }} />
                    </div>
                    <div className="mt-4 text-center">
                      <div className="text-3xl font-bold text-blue-600 mb-1">1.200 €+</div>
                      <div className="text-xs text-gray-600 uppercase tracking-wider">Jährlicher Wert</div>
                    </div>
                  </div>
                </div>

                {/* Scale Base */}
                <div className="mt-8 flex items-center justify-center gap-4">
                  <div className="w-32 h-1 bg-gradient-to-r from-orange-500 to-red-500 rounded" />
                  <div className="w-4 h-1 bg-gray-400 rounded" />
                  <div className="w-48 h-1 bg-gradient-to-r from-blue-500 to-violet-500 rounded" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === FAQ SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.8s_ease]">
            <div className="max-w-3xl mx-auto px-6">
              {/* Headline */}
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-12 text-center fiaon-gradient-text-animated">
                Fragen zum Setup?
              </h2>

              {/* FAQ Accordion */}
              <div className="space-y-0">
                {/* FAQ 1 */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={() => setOpenFaq(openFaq === 0 ? null : 0)}
                    className="w-full py-6 text-left flex items-center justify-between group"
                  >
                    <span className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Ist das eine Garantie für mein 25.000 € Limit?
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${openFaq === 0 ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === 0 ? 'max-h-40 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                    <p className="text-[14px] text-gray-600 leading-relaxed">
                      Nein. Wer dir in der Finanzwelt Garantien gibt, lügt. Wir liefern dir die präziseste Software, die besten Daten und die erfolgreichsten US-Strategien. Den Weg gehst du selbst. Die Entscheidung trifft die Bank.
                    </p>
                  </div>
                </div>

                {/* FAQ 2 */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={() => setOpenFaq(openFaq === 1 ? null : 1)}
                    className="w-full py-6 text-left flex items-center justify-between group"
                  >
                    <span className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Kann ich mein Paket später upgraden?
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${openFaq === 1 ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === 1 ? 'max-h-40 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                    <p className="text-[14px] text-gray-600 leading-relaxed">
                      Jederzeit. Wenn dein Finanzprofil wächst und du komplexere Multi-Karten-Strategien (z.B. aus dem Ultra-Paket) benötigst, kannst du per One-Click im Dashboard wechseln.
                    </p>
                  </div>
                </div>

                {/* FAQ 3 */}
                <div className="border-b border-gray-200">
                  <button
                    onClick={() => setOpenFaq(openFaq === 2 ? null : 2)}
                    className="w-full py-6 text-left flex items-center justify-between group"
                  >
                    <span className="text-[15px] font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                      Wie schnell habe ich Zugriff?
                    </span>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform duration-300 ${openFaq === 2 ? 'rotate-180' : ''}`}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openFaq === 2 ? 'max-h-40 opacity-100 pb-6' : 'max-h-0 opacity-0'}`}>
                    <p className="text-[14px] text-gray-600 leading-relaxed">
                      In 60 Sekunden. Nach Abschluss deines Setups wird dein Account generiert, die Engine gestartet und dein initialer Profil-Scan beginnt sofort.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* === FINAL CHECKOUT CTA SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.8s_ease]">
            <div className="relative py-24 sm:py-32 px-6 rounded-3xl overflow-hidden">
              {/* Animated Gradient Background */}
              <div className="absolute inset-0" style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #8b5cf6 100%)",
                backgroundSize: "200% 200%",
                animation: "gradientShift 8s ease-in-out infinite"
              }} />
              
              {/* Overlay for depth */}
              <div className="absolute inset-0 bg-black/20" />

              <div className="relative z-10 max-w-3xl mx-auto text-center">
                {/* Headline */}
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 text-white leading-[1.1]">
                  Die Maschine ist bereit.<br/>
                  Du auch?
                </h2>

                {/* Subline */}
                <p className="text-lg text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
                  Keine Schufa-Abfrage. DSGVO-konformes Hosting. Monatlich kündbar.
                </p>

                {/* CTA Button */}
                <button
                  onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-white text-gray-900 rounded-full text-[15px] font-semibold shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300"
                >
                  Setup abschließen & Engine starten
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-pulse">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* === STEPS 1-3 & 6: Form Steps === */}
        {[1, 2, 3, 6].includes(step) && (
          <div className="animate-[fadeInUp_.4s_ease]">
            <div className="grid lg:grid-cols-[1fr,320px] gap-8 items-start">
              {/* Left: Form */}
              <div className="fiaon-glass-panel rounded-2xl p-6 sm:p-8">
                {step === 1 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 1 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Persönliche Daten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Verschlüsselt übertragen und validiert.</p>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Vorname" req error={errors.firstName}><Inp value={d.firstName} onChange={(v: string) => up("firstName", v)} placeholder="Max" /></Field>
                    <Field label="Nachname" req error={errors.lastName}><Inp value={d.lastName} onChange={(v: string) => up("lastName", v)} placeholder="Mustermann" /></Field>
                  </div>
                  <Field label="Geburtsdatum" req error={errors.birth}>
                    <div className="grid grid-cols-3 gap-2">
                      <Sel value={d.birthDay} onChange={(v: string) => up("birthDay", v)}><option value="">Tag</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,"0")}</option>)}</Sel>
                      <Sel value={d.birthMonth} onChange={(v: string) => up("birthMonth", v)}><option value="">Monat</option>{["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}</Sel>
                      <Inp type="number" value={d.birthYear} onChange={(v: string) => up("birthYear", v)} placeholder="1990" />
                    </div>
                  </Field>
                  <Field label="Telefon" req error={errors.phone}>
                    <div className="flex gap-2">
                      <Sel value={d.phoneCountryCode} onChange={(v: string) => up("phoneCountryCode", v)} className="w-24">
                        <option value="+49">+49</option>
                        <option value="+43">+43</option>
                        <option value="+41">+41</option>
                        <option value="+31">+31</option>
                        <option value="+32">+32</option>
                        <option value="+33">+33</option>
                        <option value="+34">+34</option>
                        <option value="+351">+351</option>
                        <option value="+352">+352</option>
                        <option value="+353">+353</option>
                        <option value="+354">+354</option>
                        <option value="+355">+355</option>
                        <option value="+356">+356</option>
                        <option value="+357">+357</option>
                        <option value="+358">+358</option>
                        <option value="+359">+359</option>
                        <option value="+36">+36</option>
                        <option value="+370">+370</option>
                        <option value="+371">+371</option>
                        <option value="+372">+372</option>
                        <option value="+373">+373</option>
                        <option value="+374">+374</option>
                        <option value="+375">+375</option>
                        <option value="+376">+376</option>
                        <option value="+377">+377</option>
                        <option value="+378">+378</option>
                        <option value="+380">+380</option>
                        <option value="+381">+381</option>
                        <option value="+382">+382</option>
                        <option value="+383">+383</option>
                        <option value="+385">+385</option>
                        <option value="+386">+386</option>
                        <option value="+387">+387</option>
                        <option value="+389">+389</option>
                        <option value="+39">+39</option>
                        <option value="+40">+40</option>
                        <option value="+420">+420</option>
                        <option value="+421">+421</option>
                        <option value="+423">+423</option>
                        <option value="+44">+44</option>
                        <option value="+45">+45</option>
                        <option value="+46">+46</option>
                        <option value="+47">+47</option>
                        <option value="+48">+48</option>
                        <option value="+49">+49</option>
                      </Sel>
                      <Inp type="tel" value={d.phone} onChange={(v: string) => up("phone", v)} placeholder="170 1234567" className="flex-1" />
                    </div>
                  </Field>
                  <Field label="Straße & Hausnummer" req error={errors.street}><Inp value={d.street} onChange={(v: string) => up("street", v)} placeholder="Musterstraße 12" /></Field>
                  <div className="grid grid-cols-3 gap-3">
                    <Field label="PLZ" req error={errors.zip}><Inp value={d.zip} onChange={(v: string) => up("zip", v)} placeholder="10115" /></Field>
                    <Field label="Ort" req error={errors.city}><Inp value={d.city} onChange={(v: string) => up("city", v)} placeholder="Berlin" /></Field>
                    <Field label="Land" req error={errors.country}><Sel value={d.country} onChange={(v: string) => up("country", v)}><option value="">Wählen</option><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option></Sel></Field>
                  </div>
                  <Field label="Staatsangehörigkeit" req error={errors.nationality}><Sel value={d.nationality} onChange={(v: string) => up("nationality", v)}><option value="">Wählen</option><option>Deutsch</option><option>Österreichisch</option><option>Schweizerisch</option><option>Andere EU</option><option>Nicht-EU</option></Sel></Field>
                </>}

                {step === 2 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 2 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Beruf & Finanzen</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Helfen bei der Limit-Berechnung.</p>
                  <Field label="Beschäftigungsstatus" req error={errors.employment}><Sel value={d.employment} onChange={(v: string) => up("employment", v)}><option value="">Wählen</option><option>Angestellt</option><option>Selbstständig</option><option>Freiberuflich</option><option>Beamter/in</option><option>Student/in</option><option>Rentner/in</option></Sel></Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Arbeitgeber"><Inp value={d.employer} onChange={(v: string) => up("employer", v)} placeholder="Optional" /></Field>
                    <Field label="Beschäftigt seit" req error={errors.employedSince}><Sel value={d.employedSince} onChange={(v: string) => up("employedSince", v)}><option value="">Wählen</option><option>{"< 6 Monate"}</option><option>6–12 Monate</option><option>1–3 Jahre</option><option>3–5 Jahre</option><option>{"> 5 Jahre"}</option></Sel></Field>
                  </div>
                  <Field label="Monatliches Nettoeinkommen" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.income > 0 ? eur(d.income) : "—"}</span><span className="text-[12px] text-gray-400">/ Monat</span></div>
                    <input type="range" min={500} max={15000} step={100} value={d.income || 500} onChange={e => up("income", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>€ 500</span><span>€ 15.000</span></div>
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Monatliche Miete" hint="Kaltmiete in EUR"><Inp type="number" value={d.rent || ""} onChange={(v: string) => up("rent", +v || 0)} placeholder="z.B. 850" /></Field>
                    <Field label="Verbindlichkeiten" hint="Ratenkredite etc."><Inp type="number" value={d.debts || ""} onChange={(v: string) => up("debts", +v || 0)} placeholder="z.B. 200" /></Field>
                  </div>
                  <Field label="Wohnsituation" req error={errors.housing}><Sel value={d.housing} onChange={(v: string) => up("housing", v)}><option value="">Wählen</option><option>Zur Miete</option><option>Eigentum</option><option>Bei Familie</option><option>Sonstiges</option></Sel></Field>
                </>}

                {step === 3 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 3 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Karte konfigurieren</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Wähle dein Wunschlimit.</p>
                  <Field label="Wunsch-Kreditlimit" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.wantedLimit > 0 ? eur(d.wantedLimit) : "—"}</span><span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 5000)}</span></div>
                    <input type="range" min={500} max={pack?.lim || 5000} step={500} value={d.wantedLimit || 500} onChange={e => up("wantedLimit", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                  </Field>
                  <Field label="Verwendungszweck" req error={errors.purpose}><Sel value={d.purpose} onChange={(v: string) => up("purpose", v)}><option value="">Wählen</option><option>Tägliche Ausgaben</option><option>Online-Shopping</option><option>Reisen</option><option>Geschäftlich</option><option>Finanzielle Reserve</option></Sel></Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Abrechnungsart"><Sel value={d.billing} onChange={(v: string) => up("billing", v)}><option>Vollzahlung (100%)</option><option>Teilzahlung</option><option>Revolving</option></Sel></Field>
                    <Field label="NFC kontaktlos"><Sel value={d.nfc} onChange={(v: string) => up("nfc", v)}><option>Ja, aktivieren</option><option>Nein</option></Sel></Field>
                  </div>
                </>}

                {step === 6 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 4 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Vertrag annehmen</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Bestätige deine Daten und nimm den Vertrag an.</p>
                  
                  <div className="mb-6 p-5 rounded-xl fiaon-glass-panel">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Ihr Kreditkartenvertrag</p>
                    <p className="text-xs text-gray-500 mb-2">Nach Annahme können Sie Ihren personalisierten Vertrag als PDF herunterladen.</p>
                    <p className="text-xs font-medium text-[#2563eb]">Automatisch personalisiert mit Ihren Daten</p>
                  </div>
                  
                  <Field label="E-Mail-Adresse" req error={errors.email} hint="Vertragsunterlagen werden hierhin gesendet."><Inp type="email" value={d.email} onChange={(v: string) => up("email", v)} placeholder="max@beispiel.de" /></Field>
                  <div className="flex gap-0 rounded-xl overflow-hidden mb-5 fiaon-glass-panel">
                    {[["iban","SEPA-Lastschrift"],["paper","Papierrechnung"]].map(([k,l]) => (
                      <button key={k} onClick={() => up("billingMethod", k)} className={`flex-1 py-3 text-center text-[13px] font-semibold transition-all ${d.billingMethod === k ? "bg-white/80 text-[#2563eb]" : "text-gray-400"}`}>{l}</button>
                    ))}
                  </div>
                  {d.billingMethod === "iban" && <Field label="IBAN" error={errors.iban}><Inp value={d.iban} onChange={(v: string) => up("iban", v)} placeholder="DE89 3704 0044 0532 0130 00" /></Field>}
                  {[["ag1","AGB & Datenschutz","Ich stimme zu und habe die vorvertraglichen Informationen erhalten."],["ag2","Bonitätsprüfung","Ich willige in die Übermittlung meiner Daten ein."],["ag3","Vertragsannahme","Ich nehme den Vertrag verbindlich an."]].map(([key,title,desc]) => (
                    <button key={key} onClick={() => up(key, !(d as any)[key])} className={`w-full flex gap-3 items-start p-4 rounded-xl mb-3 text-left transition-all ${(d as any)[key] ? "fiaon-glass-card-selected" : "fiaon-glass-panel hover:bg-white/60"}`}>
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all ${(d as any)[key] ? "border-[#2563eb] bg-[#2563eb]" : "border-gray-300"}`}>
                        {(d as any)[key] && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="6 12 10 16 18 8"/></svg>}
                      </div>
                      <div><p className="text-[13px] font-semibold text-gray-900">{title}</p><p className="text-[12px] text-gray-500">{desc}</p></div>
                    </button>
                  ))}
                  {errors.consent && <p className="text-[11px] font-semibold text-red-500 bg-red-50/80 px-3 py-2 rounded-lg mb-3">{errors.consent}</p>}
                </>}

                {/* Buttons */}
                <div className="flex gap-3 mt-6 pt-4 border-t border-white/40">
                  <button onClick={() => goStep(step === 6 ? 5 : step - 1)} className="px-5 py-3 rounded-xl fiaon-glass-panel text-[13px] font-medium text-gray-600 hover:bg-white/80 transition-all">Zurück</button>
                  <button onClick={next} className="flex-1 py-3 rounded-xl text-[14px] font-semibold text-white transition-all fiaon-btn-gradient">
                    {step === 3 ? "Prüfen lassen" : step === 6 ? "Vertrag annehmen" : "Weiter"}
                  </button>
                </div>
              </div>

              {/* Right: Sidebar */}
              <div className="hidden lg:block">
                <div className="sticky top-20 space-y-5">
                  {sideCard}
                  <div className="rounded-2xl fiaon-glass-panel p-6 space-y-4 relative overflow-hidden">
                    {/* Animated gradient overlay */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                      <div className="absolute inset-0 opacity-20" style={{
                        background: "linear-gradient(135deg, rgba(37,99,235,0.1), rgba(147,197,253,0.15), rgba(37,99,235,0.1))",
                        backgroundSize: "200% 200%",
                        animation: "limitGlow 6s ease-in-out infinite"
                      }} />
                    </div>
                    
                    <div className="relative z-10">
                      <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">DEIN PAKET</p>
                      <p className="text-[18px] font-semibold text-gray-900 mb-4 tracking-tight">{pack?.name}</p>
                      
                      <div className="space-y-3">
                        <div>
                          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[.1em] mb-1">Gebühr</p>
                          <p className="text-[16px] font-bold fiaon-gradient-text-animated">{eur(pack?.fee || 0)}/Mt.</p>
                        </div>
                        
                        <div className="h-px bg-white/50" />
                        
                        <div>
                          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-[.1em] mb-1">Limit</p>
                          <p className="text-[16px] font-bold fiaon-gradient-text-animated">bis {(pack?.lim || 0).toLocaleString("de-DE")} €</p>
                        </div>
                      </div>
                      
                      <div className="pt-3 mt-3 border-t border-white/40">
                        <p className="text-[11px] font-mono text-gray-400 tracking-wider">{ref}</p>
                      </div>

                      {/* Real-time data display */}
                      <div className="pt-4 mt-4 border-t border-white/40 space-y-2">
                        <p className="text-[10px] font-semibold text-[#2563eb] uppercase tracking-[.15em] mb-3">Deine Eingaben</p>
                        
                        {d.firstName && d.lastName && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Name</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.firstName} {d.lastName}</span>
                          </div>
                        )}
                        
                        {d.birthDay && d.birthMonth && d.birthYear && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Geburtsdatum</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.birthDay} {["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][parseInt(d.birthMonth)-1]} {d.birthYear}</span>
                          </div>
                        )}
                        
                        {d.phone && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Telefon</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.phoneCountryCode} {d.phone}</span>
                          </div>
                        )}
                        
                        {d.street && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Adresse</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.street}</span>
                          </div>
                        )}
                        
                        {d.zip && d.city && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Ort</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.zip} {d.city}</span>
                          </div>
                        )}
                        
                        {d.employment && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Beschäftigung</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.employment}</span>
                          </div>
                        )}
                        
                        {d.income > 0 && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Einkommen</span>
                            <span className="text-[12px] font-semibold text-gray-900">{eur(d.income)}/Mt.</span>
                          </div>
                        )}
                        
                        {d.housing && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Wohnsituation</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.housing}</span>
                          </div>
                        )}
                        
                        {d.wantedLimit > 0 && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Wunschlimit</span>
                            <span className="text-[12px] font-semibold text-gray-900">{eur(d.wantedLimit)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile card */}
              <div className="lg:hidden">{sideCard}</div>
            </div>
          </div>
        )}

        {/* === STEP 4: Verification === */}
        {step === 4 && (
          <div className="animate-[fadeInUp_.6s_ease] flex flex-col items-center text-center py-16 sm:py-24 px-4">
            <div className="w-32 h-32 mb-10 relative">
              <div className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-[#2563eb] animate-spin" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-3 rounded-full border-[2px] border-transparent border-r-blue-300 animate-[spin_2.5s_linear_infinite_reverse]" />
              <div className="absolute inset-6 rounded-full border-[1.5px] border-transparent border-b-blue-200 animate-spin" style={{ animationDuration: '3s' }} />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]" style={{ boxShadow: "0 0 40px rgba(37,99,235,.3)" }} />
              
              {verifyDone && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[scaleIn_.5s_ease]">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="6 12 10 16 18 8"/></svg>
                </div>
              )}
            </div>

            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3 fiaon-gradient-text-animated">
              {verifyDone ? "Prüfung abgeschlossen" : "Bonitätsprüfung läuft"}
            </h3>
            
            <p className="text-[15px] text-gray-500 mb-8 max-w-md">
              {verifyDone 
                ? "Ihre Daten wurden erfolgreich verifiziert." 
                : "Wir analysieren Ihre Bonität in Echtzeit."}
            </p>

            <div className="w-full max-w-sm mb-8">
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div 
                  className={`h-full rounded-full bg-[#2563eb] transition-all relative overflow-hidden ${verifyDone ? "w-full duration-700" : "w-[92%] duration-[8000ms]"} ease-out`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-[slide_1.5s_ease-in-out_infinite]" />
                </div>
              </div>
              <div className="flex justify-between mt-2 text-[11px] font-medium text-gray-400">
                <span>Wird geprüft</span>
                <span>{verifyDone ? "100%" : "92%"}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
              {[
                { label: "SCHUFA-Prüfung", status: verifyDone ? "done" : "active" },
                { label: "Einkommenscheck", status: verifyDone ? "done" : "pending" },
                { label: "Freigabe", status: verifyDone ? "done" : "pending" }
              ].map((item, i) => (
                <div key={i} className={`p-3 rounded-xl transition-all duration-500 ${item.status === 'done' ? 'fiaon-glass-card-selected' : item.status === 'active' ? 'fiaon-glass-panel animate-pulse' : 'fiaon-glass-panel opacity-50'}`}>
                  <div className={`w-6 h-6 rounded-full mx-auto mb-2 flex items-center justify-center ${item.status === 'done' ? 'bg-[#2563eb]' : 'bg-gray-200'}`}>
                    {item.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="6 12 10 16 18 8"/></svg>}
                  </div>
                  <div className="text-[11px] font-medium text-gray-600">{item.label}</div>
                </div>
              ))}
            </div>

            {!verifyDone && (
              <p className="mt-10 text-[12px] text-gray-400 max-w-sm">Bitte haben Sie einen Moment Geduld. Die Prüfung dauert wenige Sekunden.</p>
            )}
          </div>
        )}

        {/* === STEP 5: Result === */}
        {step === 5 && (
          <div className="animate-[fadeInUp_.6s_ease] text-center py-16 sm:py-24 px-4">
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-full bg-[#2563eb] animate-[scaleIn_.6s_ease]" style={{ boxShadow: "0 0 60px rgba(37,99,235,.25)" }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="animate-[scaleIn_.8s_ease]"><polyline points="6 12 10 16 18 8"/></svg>
              </div>
            </div>
            
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3 fiaon-gradient-text-animated">Herzlichen Glückwunsch</h2>
            <p className="text-[15px] text-gray-500 mb-2">Ihre Bonitätsprüfung war erfolgreich</p>
            <p className="text-[14px] text-gray-400 mb-8">Ihr bewilligter Kreditrahmen:</p>
            
            <div className="relative inline-block mb-10">
              <div className="absolute inset-0 bg-[#2563eb] blur-3xl opacity-10" />
              <p className="relative text-5xl sm:text-7xl font-bold tracking-tight fiaon-gradient-text-animated">{eur(approved)}</p>
            </div>
            
            <div className="max-w-sm mx-auto mb-10 p-5 rounded-2xl fiaon-glass-panel">
              <p className="text-sm font-semibold text-gray-800 mb-1">Genehmigt mit {pack?.name}</p>
              <p className="text-xs text-gray-500">Monatliche Gebühr: {eur(pack?.fee || 0)} · Maximales Limit: {eur(pack?.lim || 0)}</p>
            </div>
            
            <button onClick={() => goStep(6)} className="group relative px-10 py-4 rounded-2xl text-[15px] font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] fiaon-btn-gradient">
              <span className="relative">Vertrag annehmen & fortfahren</span>
            </button>
          </div>
        )}

        {/* === STEP 7: Processing === */}
        {step === 7 && (
          <div className="animate-[fadeInUp_.4s_ease] flex flex-col items-center text-center py-20 sm:py-28">
            <div className="w-20 h-20 mb-8 relative">
              <div className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-[#2563eb] animate-spin" />
              <div className="absolute inset-3 rounded-full border-[2px] border-transparent border-b-blue-300 animate-[spin_1.5s_linear_infinite_reverse]" />
            </div>
            <h3 className="text-xl font-semibold tracking-tight mb-2 fiaon-gradient-text-animated">Dein Vertrag wird erstellt</h3>
            <p className="text-[14px] text-gray-400">Wir bereiten alles für dich vor.</p>
          </div>
        )}

        {/* === STEP 8: Welcome === */}
        {step === 8 && (
          <div className="animate-[fadeInUp_.4s_ease] text-center py-12 sm:py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full relative flex items-center justify-center">
              <div className="absolute inset-[-2px] rounded-full animate-[spin_4s_linear_infinite]" style={{ background: "conic-gradient(#2563eb,#93c5fd,#2563eb)" }} />
              <div className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center relative z-10">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5"><polyline points="6 12 10 16 18 8"/></svg>
              </div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight fiaon-gradient-text-animated mb-3">Herzlich Willkommen</h2>
            <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Deine FIAON Kreditkarte wird in Kürze aktiviert.</p>
            <p className="text-[13px] text-gray-400 mb-10">{d.firstName} {d.lastName} · {pack?.name} · Ref. {ref}</p>

            <div className="max-w-[320px] mx-auto mb-8">{sideCard}</div>

            <div className="rounded-2xl fiaon-glass-panel p-4 max-w-sm mx-auto mb-5">
              <p className="text-xs font-semibold text-gray-600 mb-1">Ihr Vertrag</p>
              <div className="flex items-center gap-3">
                <p className="text-[11px] text-gray-400">Personalisiertes PDF herunterladen</p>
                <button 
                  onClick={() => { window.open(`/api/fiaon/contract/${ref}`, '_blank'); track("contract_download", { ref }, ref); }} 
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold text-[#2563eb] border border-[#2563eb]/20 hover:border-[#2563eb]/40 hover:bg-[#2563eb]/5 transition-all"
                >
                  Vertrag herunterladen
                </button>
              </div>
            </div>

            <div className="relative rounded-2xl overflow-hidden max-w-sm mx-auto">
              {/* Animated gradient background */}
              <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                <div className="absolute inset-0 opacity-30" style={{
                  background: "linear-gradient(135deg, rgba(37,99,235,0.15), rgba(147,197,253,0.25), rgba(37,99,235,0.12), rgba(147,197,253,0.18))",
                  backgroundSize: "300% 300%",
                  animation: "limitGlow 8s ease-in-out infinite"
                }} />
                <div className="absolute inset-0 opacity-10" style={{
                  background: "radial-gradient(circle at 50% 0%, rgba(255,255,255,0.8), transparent 70%)"
                }} />
              </div>

              <div className="relative z-10 fiaon-glass-panel p-6 rounded-2xl">
                <p className="text-[10px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Aktivierung abschließen</p>
                <p className="text-[14px] text-gray-600 mb-5">Schließe die Zahlung für dein {pack?.name} Paket ab.</p>
                <button 
                  onClick={() => { if (pack?.pay) window.open(pack.pay, "_blank"); track("payment_click", { pack: pack?.key }, ref); }} 
                  className="w-full py-4 rounded-xl text-[15px] font-semibold text-white fiaon-btn-gradient shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all duration-300"
                >
                  Jetzt bezahlen & Karte aktivieren
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-400 font-mono mt-6">Referenz: {ref}</p>
          </div>
        )}
      </div>

      <PremiumFooter />

      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes scaleIn{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}
        @keyframes meshGradient{
          0%,100%{transform:translate(0,0) scale(1)}
          25%{transform:translate(30px,-30px) scale(1.1)}
          50%{transform:translate(-20px,20px) scale(1)}
          75%{transform:translate(20px,30px) scale(1.05)}
        }
        @keyframes glowPulse{
          0%,100%{opacity:0.5;transform:scale(1)}
          50%{opacity:0.8;transform:scale(1.2)}
        }
        @keyframes spin{
          from{transform:rotate(0deg)}
          to{transform:rotate(360deg)}
        }
        @keyframes dash{
          0%{stroke-dashoffset:200}
          100%{stroke-dashoffset:0}
        }
        @keyframes scan{
          0%{transform:translateY(0)}
          100%{transform:translateY(100%)}
        }
        @keyframes gradientShift{
          0%{background-position:0% 50%}
          50%{background-position:100% 50%}
          100%{background-position:0% 50%}
        }}
        @keyframes scaleIn{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}
