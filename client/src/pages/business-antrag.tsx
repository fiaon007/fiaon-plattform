import { useState, useEffect, useCallback, useMemo } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

const BUSINESS_PACKS = [
  { key:"business_starter", name:"FIAON Business Starter", fee:49.99, lim:5000, bg:"linear-gradient(145deg,#2c5282,#3b82f6,#4a90e2)", feats:["Limit bis 5.000 €","Business Support","Multi-User Access","Monthly Reports"], pay:"https://buy.stripe.com/7sY5kDbfRdT06fagh9bMQ05" },
  { key:"business_pro", name:"FIAON Business Pro", fee:99.99, lim:25000, rec:true, bg:"linear-gradient(145deg,#1a365d,#2563eb,#4a8af5)", feats:["Limit bis 25.000 €","Priority Business Support","Expense Tracking","Employee Cards"], pay:"https://buy.stripe.com/cNieVdcjVeX4fPK4yrbMQ06" },
  { key:"business_ultra", name:"FIAON Business Ultra", fee:149.99, lim:75000, bg:"linear-gradient(145deg,#1e3a5f,#2a5580,#3d7ab8)", feats:["Limit bis 75.000 €","Dedicated Account Manager","Advanced Analytics","Custom Limits"], pay:"https://buy.stripe.com/eVq4gz83F02a5b68OHbMQ07" },
  { key:"business_enterprise", name:"FIAON Business Enterprise", fee:249.99, lim:250000, bg:"linear-gradient(145deg,#0f172a,#1e293b,#334155)", feats:["Limit bis 250.000 €","24/7 Enterprise Support","API Integration","Unlimited Users"], pay:"https://buy.stripe.com/7sYdR9abNcOW5b6c0TbMQ08" },
];

function mkRef() { return "FIAON-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
function eur(n: number) { return "€ " + n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); }

async function track(event: string, data?: any, ref?: string) {
  try { await fetch("/api/fiaon/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, data, ref, sessionId: sessionStorage.getItem("fiaon_sid") || "", page: location.pathname }) }); } catch {}
}

/* === LIVE CREDIT CARD — HYPER-REALISTIC DESIGN === */
function LiveCard({ bg, name, lim, className = "", compact = false }: { bg: string; name: string; lim: string; className?: string; compact?: boolean }) {
  const displayName = name || "COMPANY NAME";
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
              {displayName ? "Unternehmen" : "FIAON Business"}
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

/* === FORM FIELD === */
function Field({ label, req, children, error, hint }: { label: string; req?: boolean; children: any; error?: string; hint?: string }) {
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
export default function BusinessAntragPage() {
  const [step, setStep] = useState(0);
  const [ref] = useState(mkRef);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pack, setPack] = useState<typeof BUSINESS_PACKS[0] | null>(null);

  const [d, setD] = useState({ 
    companyName: "", legalForm: "", taxId: "", establishedYear: "2010", contactName: "", contactEmail: "", contactPhoneCountryCode: "+49", contactPhone: "", street: "", zip: "", city: "", country: "", businessType: "", industry: "", annualRevenue: 0, employees: 0, monthlyExpenses: 0, wantedLimit: 0, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja", billingEmail: "", iban: "", billingMethod: "iban", ag1: false, ag2: false, ag3: false 
  });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); window.scrollTo(0, 0); }, []);

  const up = useCallback((k: string, v: any) => setD(p => ({ ...p, [k]: v })), []);
  const cardName = d.companyName.trim().toUpperCase();

  function goStep(n: number) { setStep(n); setErrors({}); track("step_change", { from: step, to: n }, ref); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function next() {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.companyName) e.companyName = "Unternehmensname eingeben";
      if (!d.legalForm) e.legalForm = "Rechtsform wählen";
      if (!d.taxId) e.taxId = "Steuernummer eingeben";
      if (!d.contactName) e.contactName = "Ansprechpartner eingeben";
      if (!d.contactEmail || !d.contactEmail.includes("@")) e.contactEmail = "Gültige E-Mail eingeben";
      if (!d.contactPhoneCountryCode || !d.contactPhone) e.contactPhone = "Telefonnummer eingeben";
      if (!d.street) e.street = "Adresse eingeben";
      if (!d.zip) e.zip = "PLZ eingeben";
      if (!d.city) e.city = "Ort eingeben";
      if (!d.country) e.country = "Land wählen";
      if (!d.businessType) e.businessType = "Unternehmensart wählen";
    } else if (step === 2) {
      if (!d.industry) e.industry = "Branche wählen";
      if (!d.establishedYear || d.establishedYear.length < 4) e.establishedYear = "Gültiges Jahr eingeben";
    } else if (step === 3) {
      if (!d.purpose) e.purpose = "Bitte wählen";
    } else if (step === 6) {
      if (!d.billingEmail || !d.billingEmail.includes("@")) e.billingEmail = "Gültige E-Mail eingeben";
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
      const mx = pack?.lim || 25000;
      let a = Math.round(d.wantedLimit * (1 + (Math.random() > .5 ? 1 : -1) * (0.05 + Math.random() * 0.1)) / 50) * 50;
      if (a > mx) a = mx; if (a < 1000) a = 1000;
      setApproved(a); setVerifyDone(true);
    }, 4000);
  }

  const sideCard = <LiveCard bg={pack?.bg || BUSINESS_PACKS[1].bg} name={cardName} lim={(pack?.lim || 25000).toLocaleString("de-DE")} />;

  return (
    <div className="min-h-screen text-gray-900 antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif", background: "linear-gradient(180deg, #f0f4ff 0%, #f8faff 30%, #ffffff 60%)" }}>
      {/* Ambient background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full opacity-[0.03]" style={{ background: "radial-gradient(circle, #2563eb, transparent 70%)" }} />
      </div>

      <GlassNav activePage="business" />

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-5 pt-24 sm:pt-28 pb-8 sm:pb-12 relative z-10">
        <Progress step={step} total={9} />

        {/* === STEP 0: Paketauswahl === */}
        {step === 0 && (
          <div className="animate-[fadeInUp_.4s_ease]">
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Paket wählen</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight fiaon-gradient-text-animated mb-4">Wähle dein FIAON Business Paket</h1>
              <p className="text-[15px] text-gray-400 max-w-lg mx-auto leading-relaxed">Entscheide dich für das passende Business-Paket — du gelangst automatisch zum nächsten Schritt.</p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1400px] mx-auto">
              {BUSINESS_PACKS.map((p, idx) => (
                <button 
                  key={p.key} 
                  onClick={() => { setPack(p); up("wantedLimit", Math.min(d.wantedLimit, p.lim)); track("pack_select", { pack: p.key }, ref); setTimeout(() => goStep(1), 400); }} 
                  className={`group text-left rounded-2xl overflow-visible transition-all duration-500 ${pack?.key === p.key ? "fiaon-glass-card-selected scale-[1.02]" : "fiaon-glass-card"}`}
                  style={{ animation: `smoothScaleIn 0.5s ease ${idx * 80}ms both` }}
                >
                  <div className="p-5 sm:p-6">
                    <LiveCard bg={p.bg} name="" lim={p.lim.toLocaleString("de-DE")} compact className="w-full" />
                  </div>
                  <div className="px-5 sm:px-6 pb-6">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-[15px] font-semibold text-gray-900">{p.name}</span>
                      {p.rec && <span className="text-[9px] font-semibold uppercase tracking-wider text-[#2563eb] bg-blue-50 px-2 py-0.5 rounded">Empfohlen</span>}
                    </div>
                    
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
                  In 5 Schritten zur Business-Karte
                </h2>
                <p className="text-[16px] sm:text-[17px] text-gray-500 leading-relaxed max-w-2xl mx-auto">
                  Digital, sicher und in unter 2 Minuten – so einfach geht's für Unternehmen.
                </p>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-8">
                {[
                  { n: "01", t: "Paket wählen", d: "Wähle dein gewünschtes FIAON Business-Paket mit passendem Limit." },
                  { n: "02", t: "Unternehmensdaten", d: "Firmeninformationen, Kontaktdaten – verschlüsselt übertragen." },
                  { n: "03", t: "Bonitätsprüfung", d: "Echtzeit-Analyse deiner Unternehmensdaten – dauert nur wenige Sekunden." },
                  { n: "04", t: "Limit erhalten", d: "Dein personalisiertes Business-Kreditlimit wird sofort angezeigt." },
                  { n: "05", t: "Vertrag annehmen", d: "Unterschrift digital – dein Vertrag ist sofort bereit." },
                ].map((s, i) => (
                  <div key={i} className="relative">
                    <div className="relative p-8 rounded-3xl fiaon-glass-panel hover:scale-[1.03] hover:shadow-2xl transition-all duration-500 group">

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
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Unternehmensdaten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Verschlüsselt übertragen und validiert.</p>
                  <Field label="Unternehmensname" req error={errors.companyName}><Inp value={d.companyName} onChange={(v: string) => up("companyName", v)} placeholder="Muster GmbH" /></Field>
                  <Field label="Rechtsform" req error={errors.legalForm}><Sel value={d.legalForm} onChange={(v: string) => up("legalForm", v)}><option value="">Wählen</option><option>GmbH</option><option>AG</option><option>UG (haftungsbeschränkt)</option><option>GbR</option><option>Einzelfirma</option><option>KG</option><option>OHG</option></Sel></Field>
                  <Field label="Steuernummer" req error={errors.taxId}><Inp value={d.taxId} onChange={(v: string) => up("taxId", v)} placeholder="DE123456789" /></Field>
                  <Field label="Ansprechpartner" req error={errors.contactName}><Inp value={d.contactName} onChange={(v: string) => up("contactName", v)} placeholder="Max Mustermann" /></Field>
                  <Field label="E-Mail Ansprechpartner" req error={errors.contactEmail}><Inp type="email" value={d.contactEmail} onChange={(v: string) => up("contactEmail", v)} placeholder="max@muster.de" /></Field>
                  <Field label="Telefon" req error={errors.contactPhone}>
                    <div className="flex gap-2">
                      <Sel value={d.contactPhoneCountryCode} onChange={(v: string) => up("contactPhoneCountryCode", v)} className="w-24">
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
                      <Inp type="tel" value={d.contactPhone} onChange={(v: string) => up("contactPhone", v)} placeholder="170 1234567" className="flex-1" />
                    </div>
                  </Field>
                  <Field label="Land" req error={errors.country}><Sel value={d.country} onChange={(v: string) => up("country", v)}><option value="">Wählen</option><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option><option value="AL">Albanien</option><option value="AD">Andorra</option><option value="BY">Belarus</option><option value="BE">Belgien</option><option value="BA">Bosnien und Herzegowina</option><option value="BG">Bulgarien</option><option value="HR">Kroatien</option><option value="CY">Zypern</option><option value="CZ">Tschechien</option><option value="DK">Dänemark</option><option value="EE">Estland</option><option value="FI">Finnland</option><option value="FR">Frankreich</option><option value="GE">Georgien</option><option value="GR">Griechenland</option><option value="HU">Ungarn</option><option value="IS">Island</option><option value="IE">Irland</option><option value="IT">Italien</option><option value="XK">Kosovo</option><option value="LV">Lettland</option><option value="LI">Liechtenstein</option><option value="LT">Litauen</option><option value="LU">Luxemburg</option><option value="MT">Malta</option><option value="MD">Moldawien</option><option value="MC">Monaco</option><option value="ME">Montenegro</option><option value="NL">Niederlande</option><option value="MK">Nordmazedonien</option><option value="NO">Norwegen</option><option value="PL">Polen</option><option value="PT">Portugal</option><option value="RO">Rumänien</option><option value="RU">Russland</option><option value="SM">San Marino</option><option value="RS">Serbien</option><option value="SK">Slowakei</option><option value="SI">Slowenien</option><option value="ES">Spanien</option><option value="SE">Schweden</option><option value="CH">Schweiz</option><option value="TR">Türkei</option><option value="UA">Ukraine</option><option value="GB">Vereinigtes Königreich</option><option value="VA">Vatikanstadt</option></Sel></Field>
                  <Field label="Straße & Hausnummer" req error={errors.street}><Inp value={d.street} onChange={(v: string) => up("street", v)} placeholder="Musterstraße 12" /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="PLZ" req error={errors.zip}><Inp value={d.zip} onChange={(v: string) => up("zip", v)} placeholder={d.country === "AT" || d.country === "CH" ? "1010" : "10115"} /></Field>
                    <Field label="Ort" req error={errors.city}><Inp value={d.city} onChange={(v: string) => up("city", v)} placeholder="Berlin" /></Field>
                  </div>
                  <Field label="Unternehmensart" req error={errors.businessType}><Sel value={d.businessType} onChange={(v: string) => up("businessType", v)}><option value="">Wählen</option><option>KMU</option><option>Startup</option><option>Mittelstand</option><option>Unternehmensgruppe</option><option>Einzelfirma</option></Sel></Field>
                </>}

                {step === 2 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 2 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Wirtschaftliche Daten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Helfen bei der Limit-Berechnung.</p>
                  <Field label="Branche" req error={errors.industry}><Sel value={d.industry} onChange={(v: string) => up("industry", v)}><option value="">Wählen</option><option>IT & Tech</option><option>Handel</option><option>Dienstleistung</option><option>Produktion</option><option>Finanzdienstleistungen</option><option>Gesundheitswesen</option><option>Bildung</option><option>Sonstiges</option></Sel></Field>
                  <Field label="Gründungsjahr" req error={errors.establishedYear}><Inp type="number" value={d.establishedYear} onChange={(v: string) => up("establishedYear", v)} placeholder="2010" /></Field>
                  <Field label="Jährlicher Umsatz" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.annualRevenue > 0 ? eur(d.annualRevenue) : "—"}</span><span className="text-[12px] text-gray-400">/ Jahr</span></div>
                    <input type="range" min={10000} max={1000000} step={5000} value={d.annualRevenue || 10000} onChange={e => up("annualRevenue", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>€ 10.000</span><span>€ 1.000.000</span></div>
                  </Field>
                  <Field label="Anzahl Mitarbeiter" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.employees > 0 ? d.employees : "—"}</span><span className="text-[12px] text-gray-400">Mitarbeiter</span></div>
                    <input type="range" min={1} max={500} step={1} value={d.employees || 1} onChange={e => up("employees", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>1</span><span>500</span></div>
                  </Field>
                  <Field label="Monatliche Betriebsausgaben" hint="in EUR"><Inp type="number" value={d.monthlyExpenses || ""} onChange={(v: string) => up("monthlyExpenses", +v || 0)} placeholder="z.B. 10000" /></Field>
                </>}

                {step === 3 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 3 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Karte konfigurieren</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Wähle dein Wunschlimit.</p>
                  <Field label="Wunsch-Kreditlimit" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.wantedLimit > 0 ? eur(d.wantedLimit) : "—"}</span><span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 25000)}</span></div>
                    <input type="range" min={1000} max={pack?.lim || 25000} step={1000} value={d.wantedLimit || 1000} onChange={e => up("wantedLimit", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                  </Field>
                  <Field label="Verwendungszweck" req error={errors.purpose}><Sel value={d.purpose} onChange={(v: string) => up("purpose", v)}><option value="">Wählen</option><option>Geschäftsausgaben</option><option>Reisekosten</option><option>Lieferantenzahlungen</option><option>Mitarbeiterkarten</option><option>Liquiditätsreserve</option></Sel></Field>
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
                    <p className="text-sm font-semibold text-gray-900 mb-1">Ihr Business-Kreditkartenvertrag</p>
                    <p className="text-xs text-gray-500 mb-2">Nach Annahme können Sie Ihren personalisierten Vertrag als PDF herunterladen.</p>
                    <p className="text-xs font-medium text-[#2563eb]">Automatisch personalisiert mit Ihren Unternehmensdaten</p>
                  </div>
                  
                  <Field label="E-Mail-Adresse für Rechnungen" req error={errors.billingEmail} hint="Rechnungen werden hierhin gesendet."><Inp type="email" value={d.billingEmail} onChange={(v: string) => up("billingEmail", v)} placeholder="billing@muster.de" /></Field>
                  <div className="flex gap-0 rounded-xl overflow-hidden mb-5 fiaon-glass-panel">
                    {[["iban","SEPA-Lastschrift"],["paper","Papierrechnung"]].map(([k,l]) => (
                      <button key={k} onClick={() => up("billingMethod", k)} className={`flex-1 py-3 text-center text-[13px] font-semibold transition-all ${d.billingMethod === k ? "bg-white/80 text-[#2563eb]" : "text-gray-400"}`}>{l}</button>
                    ))}
                  </div>
                  {d.billingMethod === "iban" && <Field label="IBAN" error={errors.iban}><Inp value={d.iban} onChange={(v: string) => up("iban", v)} placeholder="DE89 3704 0044 0532 0130 00" /></Field>}
                  {[["ag1","AGB & Datenschutz","Ich stimme zu und habe die vorvertraglichen Informationen erhalten."],["ag2","Bonitätsprüfung","Ich willige in die Übermittlung meiner Unternehmensdaten ein."],["ag3","Vertragsannahme","Ich nehme den Vertrag verbindlich an."]].map(([key,title,desc]) => (
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

                      <div className="pt-4 mt-4 border-t border-white/40 space-y-2">
                        <p className="text-[10px] font-semibold text-[#2563eb] uppercase tracking-[.15em] mb-3">Deine Eingaben</p>
                        
                        {d.companyName && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Unternehmen</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.companyName}</span>
                          </div>
                        )}
                        
                        {d.legalForm && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Rechtsform</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.legalForm}</span>
                          </div>
                        )}
                        
                        {d.contactEmail && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">E-Mail</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.contactEmail}</span>
                          </div>
                        )}
                        
                        {d.contactPhone && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Telefon</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.contactPhoneCountryCode} {d.contactPhone}</span>
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
                        
                        {d.businessType && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Unternehmensart</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.businessType}</span>
                          </div>
                        )}
                        
                        {d.industry && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Branche</span>
                            <span className="text-[12px] font-semibold text-gray-900">{d.industry}</span>
                          </div>
                        )}
                        
                        {d.annualRevenue > 0 && (
                          <div className="flex justify-between items-center py-1.5">
                            <span className="text-[11px] text-gray-400">Umsatz</span>
                            <span className="text-[12px] font-semibold text-gray-900">{eur(d.annualRevenue)}/Jahr</span>
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
                ? "Ihre Unternehmensdaten wurden erfolgreich verifiziert." 
                : "Wir analysieren Ihre Unternehmensbonität in Echtzeit."}
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
                { label: "Unternehmensprüfung", status: verifyDone ? "done" : "active" },
                { label: "Umsatzcheck", status: verifyDone ? "done" : "pending" },
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
            <p className="text-[15px] text-gray-500 mb-2">Ihre Unternehmensbonitätsprüfung war erfolgreich</p>
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
            <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Deine FIAON Business Kreditkarte wird in Kürze aktiviert.</p>
            <p className="text-[13px] text-gray-400 mb-10">{d.companyName} · {pack?.name} · Ref. {ref}</p>

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
      `}</style>
    </div>
  );
}
