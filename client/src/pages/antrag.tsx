import { useState, useEffect, useCallback, useMemo } from "react";
import GlassNav from "@/components/GlassNav";

const PACKS = [
  { key:"start", name:"FIAON Starter", fee:7.99, lim:500, bg:"linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats:["Limit bis 500 €","E-Mail Support","NFC kontaktlos","Online-Banking"], pay:"https://buy.stripe.com/7sY5kDbfRdT06fagh9bMQ01" },
  { key:"pro", name:"FIAON Pro", fee:59.99, lim:5000, rec:true, bg:"linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats:["Limit bis 5.000 €","Priority Support","Cashback-Programm","NFC kontaktlos"], pay:"https://buy.stripe.com/cNieVdcjVeX4fPK4yrbMQ02" },
  { key:"ultra", name:"FIAON Ultra", fee:79.99, lim:15000, bg:"linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats:["Limit bis 15.000 €","Reise-Versicherung","Lounge-Zugang","Priority Support"], pay:"https://buy.stripe.com/eVq4gz83F02a5b68OHbMQ03" },
  { key:"highend", name:"FIAON High End", fee:99.99, lim:25000, bg:"linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats:["Limit bis 25.000 €","24/7 VIP Support","Concierge-Service","Premium Lounge"], pay:"https://buy.stripe.com/7sYdR9abNcOW5b6c0TbMQ04" },
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
            <div className={`uppercase tracking-[.1em] font-medium ${compact ? "text-[8px]" : "text-[9px]"} mb-1`} style={{ 
              color: "rgba(255,255,255,.5)", 
              textShadow: "0 1px 2px rgba(0,0,0,.15)"
            }}>
              Limit bis
            </div>
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
            <div className={`uppercase tracking-[.12em] font-medium ${compact ? "text-[7px]" : "text-[8px]"} mb-0.5`} style={{ color: "rgba(255,255,255,.4)" }}>
              {displayName ? "Karteninhaber" : "FIAON Starter"}
            </div>
            {displayName && (
              <div className="font-medium truncate" style={{ 
                color: "rgba(255,255,255,.9)", 
                fontSize: `${nameFontSize}px`, 
                lineHeight: 1.2, 
                whiteSpace: "nowrap", 
                overflow: "hidden", 
                textOverflow: "ellipsis",
                textShadow: "0 1px 2px rgba(0,0,0,.2)"
              }}>{displayName}</div>
            )}
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

  const [d, setD] = useState({ firstName: "", lastName: "", birthDay: "", birthMonth: "", birthYear: "1990", phone: "", street: "", zip: "", city: "", country: "", nationality: "", employment: "", employer: "", employedSince: "", income: 2500, rent: 0, debts: 0, housing: "", wantedLimit: 3000, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja", email: "", iban: "", billingMethod: "iban", ag1: false, ag2: false, ag3: false });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); window.scrollTo(0, 0); }, []);

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
      if (!d.phone) e.phone = "Telefonnummer eingeben";
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
        <Progress step={step} total={9} />

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
                  className={`group text-left rounded-2xl overflow-visible transition-all duration-500 ${pack?.key === p.key ? "fiaon-glass-card-selected scale-[1.02]" : "fiaon-glass-card"}`}
                  style={{ animation: `smoothScaleIn 0.5s ease ${idx * 80}ms both` }}
                >
                  {/* Card area with generous padding */}
                  <div className="p-5 sm:p-6">
                    <LiveCard bg={p.bg} name="" lim={p.lim.toLocaleString("de-DE")} compact className="w-full" />
                  </div>
                  <div className="px-5 sm:px-6 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[15px] font-semibold text-gray-900">{p.name}</span>
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
                        <div className="text-[10px] font-semibold uppercase tracking-[.15em] text-[#2563eb] mb-1.5" style={{ textShadow: "0 1px 2px rgba(37,99,235,0.1)" }}>Kreditlimit</div>
                        <div className="text-[22px] sm:text-[24px] font-bold tracking-tight whitespace-nowrap" style={{
                          background: "linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)",
                          backgroundClip: "text",
                          WebkitBackgroundClip: "text",
                          WebkitTextFillColor: "transparent",
                          textShadow: "0 2px 12px rgba(37,99,235,0.15)"
                        }}>
                          bis {p.lim.toLocaleString("de-DE")} €
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-baseline gap-1.5 mb-5">
                      <span className="text-[28px] font-semibold text-gray-900 tracking-tight">{p.fee.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                      <span className="text-[13px] text-gray-400">€/Mt.</span>
                    </div>
                    <ul className="space-y-2.5 mb-6">
                      {p.feats.map((f, i) => (
                        <li key={i} className="flex items-center gap-2.5 text-[13px] text-gray-600">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 12 10 16 18 8"/></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-3 border-t border-gray-100/80">
                      <span className="text-[13px] font-semibold text-[#2563eb] group-hover:translate-x-1 transition-transform inline-block">Jetzt wählen →</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-8">Das endgültige Kreditlimit wird individuell festgelegt.</p>
          </div>
        )}

        {/* === APPLICATION PROCESS SECTION === */}
        {step === 0 && (
          <div className="mt-16 animate-[fadeInUp_.6s_ease]">
            <div className="max-w-[1280px] mx-auto px-6">
              <div className="max-w-3xl mb-16 text-center">
                <p className="text-[12px] font-semibold text-[#2563eb] tracking-[.2em] uppercase mb-4">Antragprozess</p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight mb-6 fiaon-gradient-text-animated">
                  In 5 Schritten zur Karte
                </h2>
                <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-2xl mx-auto">
                  Digital, sicher und in unter 2 Minuten – so einfach geht's.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
                {[
                  { n: "01", t: "Paket wählen", d: "Wähle dein gewünschtes FIAON Paket mit passendem Limit." },
                  { n: "02", t: "Daten eingeben", d: "Persönliche Daten, Beruf & Finanzen – verschlüsselt übertragen." },
                  { n: "03", t: "Bonitätsprüfung", d: "Echtzeit-Analyse deiner Daten – dauert nur wenige Sekunden." },
                  { n: "04", t: "Limit erhalten", d: "Dein personalisiertes Kreditlimit wird sofort angezeigt." },
                  { n: "05", t: "Vertrag annehmen", d: "Unterschrift digital – dein Vertrag ist sofort bereit." },
                ].map((s, i) => (
                  <div key={i} className="relative">
                    <div className="relative p-8 rounded-3xl fiaon-glass-panel hover:scale-[1.03] hover:shadow-2xl transition-all duration-500 group">
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

                        <h3 className="text-[16px] font-semibold text-gray-900 mb-3 tracking-tight">{s.t}</h3>
                        <p className="text-[14px] text-gray-500 leading-relaxed font-medium">{s.d}</p>
                      </div>

                      {i < 4 && (
                        <div className="absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-[2px] hidden lg:block" style={{
                          background: "linear-gradient(90deg, #2563eb, rgba(37,99,235,0.2))",
                          boxShadow: "0 0 20px rgba(37,99,235,0.3)"
                        }} />
                      )}
                    </div>
                  </div>
                ))}
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
                  <Field label="Telefon" req error={errors.phone}><Inp type="tel" value={d.phone} onChange={(v: string) => up("phone", v)} placeholder="+49 170 1234567" /></Field>
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
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{eur(d.income)}</span><span className="text-[12px] text-gray-400">/ Monat</span></div>
                    <input type="range" min={500} max={15000} step={100} value={d.income} onChange={e => up("income", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
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
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{eur(d.wantedLimit)}</span><span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 5000)}</span></div>
                    <input type="range" min={500} max={pack?.lim || 5000} step={500} value={d.wantedLimit} onChange={e => up("wantedLimit", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
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
                            <span className="text-[12px] font-semibold text-gray-900">{d.birthDay}.{d.birthMonth}.{d.birthYear}</span>
                          </div>
                        )}
                        
                        {d.phone && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Telefon</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.phone}</span>
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

      {/* Footer */}
      <footer className="relative py-16 sm:py-20 overflow-hidden mt-20">
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
            <div>
              <div className="mb-6">
                <span className="text-2xl font-bold tracking-tight fiaon-gradient-text-animated">FIAON</span>
              </div>
              <p className="text-[14px] text-gray-500 leading-relaxed max-w-[260px]">
                Unabhängige Kreditkarten-Beratung für Privatpersonen und Unternehmen.
              </p>
            </div>

            <div>
              <div className="text-[13px] font-semibold text-gray-900 uppercase tracking-[.15em] mb-5">Seiten</div>
              <ul className="space-y-3">
                <li><a href="/" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Startseite</a></li>
                <li><a href="/antrag" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Privatkunden</a></li>
                <li><a href="/business" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Business</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[13px] font-semibold text-gray-900 uppercase tracking-[.15em] mb-5">Rechtliches</div>
              <ul className="space-y-3">
                <li><a href="/terms" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">AGB</a></li>
                <li><a href="/privacy" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Datenschutz</a></li>
                <li><a href="#" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">Impressum</a></li>
              </ul>
            </div>

            <div>
              <div className="text-[13px] font-semibold text-gray-900 uppercase tracking-[.15em] mb-5">Kontakt</div>
              <ul className="space-y-3">
                <li><a href="mailto:support@fiaon.com" className="text-[14px] text-gray-500 hover:text-gray-900 transition-colors">support@fiaon.com</a></li>
                <li><span className="text-[14px] text-gray-500">Mo–Fr, 9–18 Uhr</span></li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-[13px] text-gray-400">&copy; {new Date().getFullYear()} FIAON. Alle Rechte vorbehalten.</span>
            <span className="text-[12px] text-gray-400">FIAON ist ein Beratungsservice und kein Kreditinstitut.</span>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes scaleIn{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}
