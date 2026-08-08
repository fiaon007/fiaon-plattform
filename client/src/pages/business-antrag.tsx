import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { downloadContract } from "@/utils/contractTemplate";
import { checkPhone } from "@/lib/phone";

/* === PREMIUM PHONE INPUT COMPONENT === */
function PremiumPhoneInput({ countryCode, phone, onCountryCodeChange, onPhoneChange, error }: { countryCode: string; phone: string; onCountryCodeChange: (v: string) => void; onPhoneChange: (v: string) => void; error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const PHONE_CODES = [
    { code: "+49", country: "Deutschland" },
    { code: "+43", country: "Österreich" },
    { code: "+41", country: "Schweiz" },
    { code: "+1", country: "USA" },
    { code: "+44", country: "UK" },
    { code: "+33", country: "Frankreich" },
    { code: "+31", country: "Niederlande" },
    { code: "+39", country: "Italien" },
    { code: "+34", country: "Spanien" },
    { code: "+46", country: "Schweden" },
    { code: "+47", country: "Norwegen" },
    { code: "+45", country: "Dänemark" },
    { code: "+358", country: "Finnland" },
    { code: "+352", country: "Luxemburg" },
    { code: "+32", country: "Belgien" },
    { code: "+48", country: "Polen" },
    { code: "+420", country: "Tschechien" },
    { code: "+421", country: "Slowakei" },
    { code: "+36", country: "Ungarn" },
    { code: "+40", country: "Rumänien" },
    { code: "+30", country: "Griechenland" },
    { code: "+353", country: "Irland" },
    { code: "+351", country: "Portugal" },
    { code: "+386", country: "Slowenien" },
    { code: "+385", country: "Kroatien" },
    { code: "+381", country: "Serbien" },
    { code: "+389", country: "Nordmazedonien" },
    { code: "+359", country: "Bulgarien" },
    { code: "+380", country: "Ukraine" },
    { code: "+90", country: "Türkei" },
    { code: "+357", country: "Zypern" },
    { code: "+354", country: "Island" },
  ];

  // #23: identische Live-Validierung wie auf der Nummer-Update-Seite (@/lib/phone).
  const live = checkPhone(`${countryCode}${phone}`);
  const liveHint = phone.trim().length >= 4 && !live.valid ? live.reason : null;

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={`flex bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-300 ${error ? "border-red-500" : ""}`}>
        <div className="relative flex items-center px-4 py-3 border-r border-slate-200 bg-slate-50/50 cursor-pointer w-24 shrink-0" onClick={() => setIsOpen(!isOpen)}>
          <span className="text-slate-900 font-medium text-base">{countryCode}</span>
          <svg className="w-4 h-4 text-slate-400 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        <input
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          placeholder="170 1234567"
          className="flex-1 px-4 py-3 bg-transparent outline-none text-slate-900 font-medium text-base placeholder:text-slate-400"
        />
        {live.valid && (
          <span className="flex items-center pr-3 text-emerald-500 shrink-0" aria-hidden>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </span>
        )}
      </div>
      {isOpen && (
        <ul className="absolute top-full left-0 w-48 mt-2 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-xl shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] max-h-60 overflow-y-auto overflow-x-hidden z-50">
          {PHONE_CODES.map((item, index) => (
            <li
              key={index}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
              onClick={() => { onCountryCodeChange(item.code); setIsOpen(false); }}
            >
              {item.code} {item.country}
            </li>
          ))}
        </ul>
      )}
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p>
        : liveHint ? <p className="mt-1 text-xs text-amber-600">{liveHint}</p>
        : null}
    </div>
  );
}

/* === PREMIUM COUNTRY SELECT COMPONENT === */
function PremiumCountrySelect({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const COUNTRIES = [
    { code: "DE", name: "🇩🇪 Deutschland" },
    { code: "AT", name: "🇦🇹 Österreich" },
    { code: "CH", name: "🇨🇭 Schweiz" },
    { code: "GB", name: "🇬🇧 Vereinigtes Königreich" },
    { code: "US-FL", name: "🇺🇸 USA - Florida" },
    { code: "US-CA", name: "🇺🇸 USA - Kalifornien" },
  ];

  const selectedCountry = COUNTRIES.find(c => c.code === value);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={`flex bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-300 ${error ? "border-red-500" : ""}`}>
        <div className="relative flex items-center px-4 py-3 bg-slate-50/50 cursor-pointer flex-1" onClick={() => setIsOpen(!isOpen)}>
          <span className="text-slate-900 font-medium text-base">{selectedCountry ? selectedCountry.name : "Wählen"}</span>
          <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isOpen && (
        <ul className="absolute top-full left-0 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-xl shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] max-h-60 overflow-y-auto overflow-x-hidden z-50">
          {COUNTRIES.map((item, index) => (
            <li
              key={index}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
              onClick={() => { onChange(item.code); setIsOpen(false); }}
            >
              {item.name}
            </li>
          ))}
          <li className="px-4 py-2 text-sm text-gray-400 italic cursor-default">✨ Wir erweitern uns ständig – bald auch in deinem Land</li>
        </ul>
      )}
    </div>
  );
}

/* === PREMIUM SELECT COMPONENT === */
function PremiumSelect({ value, onChange, options, error }: { value: string; onChange: (v: string) => void; options: string[]; error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div className={`flex bg-slate-50/50 border border-slate-200 rounded-xl overflow-hidden transition-all duration-300 ease-in-out focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-300 ${error ? "border-red-500" : ""}`}>
        <div className="relative flex items-center px-4 py-3 bg-slate-50/50 cursor-pointer flex-1" onClick={() => setIsOpen(!isOpen)}>
          <span className="text-slate-900 font-medium text-base">{value || "Wählen"}</span>
          <svg className="w-4 h-4 text-slate-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isOpen && (
        <ul className="absolute top-full left-0 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-xl shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] max-h-60 overflow-y-auto overflow-x-hidden z-50">
          {options.map((item, index) => (
            <li
              key={index}
              className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
              onClick={() => { onChange(item); setIsOpen(false); }}
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


const COUNTRIES = [
  // DACH Region (Priorisiert)
  "Deutschland",
  "Österreich",
  "Schweiz",
  "---", // Visueller Trenner im UI
  // Rest der Welt (Alphabetisch)
  "Afghanistan", "Ägypten", "Albanien", "Algerien", "Andorra", "Angola", "Antigua und Barbuda", "Äquatorialguinea", "Argentinien", "Armenien", "Aserbaidschan", "Äthiopien", "Australien", "Bahamas", "Bahrain", "Bangladesch", "Barbados", "Belarus", "Belgien", "Belize", "Benin", "Bhutan", "Bolivien", "Bosnien und Herzegowina", "Botswana", "Brasilien", "Brunei", "Bulgarien", "Burkina Faso", "Burundi", "Cabo Verde", "Chile", "China", "Costa Rica", "Côte d'Ivoire", "Dänemark", "Dominica", "Dominikanische Republik", "Dschibuti", "Ecuador", "El Salvador", "Eritrea", "Estland", "Eswatini", "Fidschi", "Finnland", "Frankreich", "Gabun", "Gambia", "Georgien", "Ghana", "Grenada", "Griechenland", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Indien", "Indonesien", "Irak", "Iran", "Irland", "Island", "Israel", "Italien", "Jamaika", "Japan", "Jemen", "Jordanien", "Kambodscha", "Kamerun", "Kanada", "Kasachstan", "Katar", "Kenia", "Kirgisistan", "Kiribati", "Kolumbien", "Komoren", "Kongo (Demokratische Republik)", "Kongo (Republik)", "Kroatien", "Kuba", "Kuwait", "Laos", "Lesotho", "Lettland", "Libanon", "Liberia", "Libyen", "Liechtenstein", "Litauen", "Luxemburg", "Madagaskar", "Malawi", "Malaysia", "Malediven", "Mali", "Malta", "Marokko", "Marshallinseln", "Mauretanien", "Mauritius", "Mexiko", "Mikronesien", "Moldau", "Monaco", "Mongolei", "Montenegro", "Mosambik", "Myanmar", "Namibia", "Nauru", "Nepal", "Neuseeland", "Nicaragua", "Niederlande", "Niger", "Nigeria", "Nordkorea", "Nordmazedonien", "Norwegen", "Oman", "Pakistan", "Palau", "Panama", "Papua-Neuguinea", "Paraguay", "Peru", "Philippinen", "Polen", "Portugal", "Ruanda", "Rumänien", "Russland", "Salomonen", "Sambia", "Samoa", "San Marino", "São Tomé und Príncipe", "Saudi-Arabien", "Schweden", "Senegal", "Serbien", "Seychellen", "Sierra Leone", "Simbabwe", "Singapur", "Slowakei", "Slowenien", "Somalia", "Spanien", "Sri Lanka", "St. Kitts und Nevis", "St. Lucia", "St. Vincent und die Grenadinen", "Südafrika", "Sudan", "Südkorea", "Südsudan", "Suriname", "Syrien", "Tadschikistan", "Tansania", "Thailand", "Togo", "Tonga", "Trinidad und Tobago", "Tschad", "Tschechien", "Tunesien", "Türkei", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "Ungarn", "Uruguay", "Usbekistan", "Vanuatu", "Vatikanstadt", "Venezuela", "Vereinigte Arabische Emirate", "Vereinigte Staaten", "Vereinigtes Königreich", "Vietnam", "Zentralafrikanische Republik", "Zypern"
];

/* === CUSTOM DROPDOWN COMPONENT === */
function CountryDropdown({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <div 
        className={`w-full px-4 py-3 bg-white border rounded-xl text-left text-slate-900 font-inter cursor-pointer transition-all ${error ? "border-red-500" : "border-slate-200"}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex justify-between items-center">
          <span className={value ? "" : "text-slate-400"}>{value || "Wählen"}</span>
          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {isOpen && (
        <ul className="absolute top-full left-0 w-full mt-2 bg-white/90 backdrop-blur-xl border border-slate-100 rounded-xl shadow-[0_20px_40px_-15px_rgba(15,23,42,0.1)] max-h-60 overflow-y-auto overflow-x-hidden z-50">
          {COUNTRIES.map((country, index) => (
            country === "---" ? (
              <div key={index} className="h-px bg-slate-100 my-1 mx-2" />
            ) : (
              <li 
                key={index}
                className="px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer transition-colors"
                onClick={() => { onChange(country); setIsOpen(false); }}
              >
                {country}
              </li>
            )
          ))}
        </ul>
      )}
    </div>
  );
}

const BUSINESS_PACKS = [
  { key:"business_starter", name:"FIAON Business Starter", fee:49.99, lim:5000, bg:"linear-gradient(145deg,#2c5282,#3b82f6,#4a90e2)", feats:["Limit bis 5.000 €","Business Support","Multi-User Access","Monthly Reports"] },
  { key:"business_pro", name:"FIAON Business Pro", fee:99.99, lim:25000, rec:true, bg:"linear-gradient(145deg,#1a365d,#2563eb,#4a8af5)", feats:["Limit bis 25.000 €","Priority Business Support","Expense Tracking","Employee Cards"] },
  { key:"business_ultra", name:"FIAON Business Ultra", fee:149.99, lim:75000, bg:"linear-gradient(145deg,#1e3a5f,#2a5580,#3d7ab8)", feats:["Limit bis 75.000 €","Dedicated Account Manager","Advanced Analytics","Custom Limits"] },
  { key:"business_enterprise", name:"FIAON Business Enterprise", fee:249.99, lim:250000, bg:"linear-gradient(145deg,#0f172a,#1e293b,#334155)", feats:["Limit bis 250.000 €","24/7 Enterprise Support","API Integration","Unlimited Users"] },
];

function mkRef() { return "FIAON-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }

// Dubletten-Fix: ref pro Antrag stabil halten (überlebt Reload/Zurück-Navigation).
function getPersistentRef(storageKey: string): string {
  try {
    const existing = sessionStorage.getItem(storageKey);
    if (existing) return existing;
    const fresh = mkRef();
    sessionStorage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    return mkRef();
  }
}
function clearPersistentRef(storageKey: string): void {
  try { sessionStorage.removeItem(storageKey); } catch {}
}
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
    <div className={`w-full aspect-[1.586/1] rounded-2xl relative overflow-hidden select-none transition-all duration-500 ${className}`} style={{ 
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
          <div className={`rounded ${compact ? "w-9 h-6" : "w-10 h-7"}`} style={{ 
            background: "linear-gradient(135deg,#d4af37,#f0d875,#c9a227)", 
            boxShadow: "0 1px 4px rgba(0,0,0,.25)"
          }}>
            <div className="w-full h-full rounded opacity-25" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(0,0,0,.2) 3px, rgba(0,0,0,.2) 4px)" }} />
          </div>
          <span className={`font-semibold tracking-wide ${compact ? "text-xs" : "text-sm"}`} style={{ color: "rgba(255,255,255,.65)" }}>FIAON</span>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className={`uppercase tracking-[.14em] font-medium ${compact ? "text-[7px]" : "text-[8px]"} mb-0.5`} style={{ 
              color: "rgba(255,255,255,.35)"
            }}>
              {compact ? "Limit" : "Wunschlimit"}
            </div>
            <div className={`font-mono ${compact ? "text-xs" : "text-xs"} font-semibold whitespace-nowrap`} style={{ 
              color: "rgba(255,255,255,.9)"
            }}>
              {lim} €
            </div>
          </div>
        </div>
      </div>
      
      {/* shimmer */}
      <div className="absolute inset-0 fiaon-card-shimmer pointer-events-none" />
    </div>
  );
}

/* === MAIN COMPONENT === */
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
    <div className="mb-5" data-error={error ? "true" : undefined}>
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

/* === COST SIMULATION COMPONENT === */
function CostSimulation({ maxLimit, packName }: { maxLimit: number; packName: string }) {
  const [simAmount, setSimAmount] = useState(Math.round(maxLimit / 2));
  const monthly = Math.round(simAmount / 24);

  return (
    <div className="p-5 rounded-2xl fiaon-glass-panel border border-[#2563eb]/10 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ background: "linear-gradient(135deg, #2563eb, #93c5fd)" }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-[#2563eb]/10 flex items-center justify-center shrink-0">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <p className="text-[13px] font-semibold text-gray-800">Kostensimulation</p>
          </div>
          <div className="relative group">
            <button className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-400 hover:bg-[#2563eb]/10 hover:text-[#2563eb] transition-all">?</button>
            <div className="absolute right-0 bottom-full mb-2 w-64 bg-gray-900 text-white text-[11px] rounded-xl p-3 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 shadow-2xl">
              Diese Simulation zeigt, wie hoch deine monatliche Teilzahlungsrate wäre, wenn du den gewählten Betrag über 24 Monate abbezahlen. Der tatsächliche Betrag kann variieren – Du wirst per E-Mail benachrichtigt.
              <div className="absolute right-2 bottom-[-5px] w-2.5 h-2.5 bg-gray-900 rotate-45" />
            </div>
          </div>
        </div>
        
        <p className="text-[12px] text-gray-400 mb-4">Schieb den Regler, um zu sehen, was du monatlich zahlen würdest.</p>
        
        <input
          type="range"
          min={1000}
          max={maxLimit}
          step={500}
          value={simAmount}
          onChange={(e) => setSimAmount(Number(e.target.value))}
          className="w-full h-2 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb] mb-4"
        />
        
        <div className="flex justify-between text-[11px] text-gray-400 font-mono mb-5">
          <span>€ 1.000</span>
          <span className="font-semibold text-gray-700">{eur(simAmount)}</span>
          <span>{eur(maxLimit)}</span>
        </div>
        
        <div className="flex items-end justify-between p-4 rounded-xl bg-gradient-to-r from-[#2563eb]/8 to-[#93c5fd]/8 border border-[#2563eb]/10">
          <div>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">Monatliche Rate</p>
            <p className="text-[28px] font-bold fiaon-gradient-text-animated">{eur(monthly)}<span className="text-[13px] font-normal text-gray-400 ml-1">/ Monat</span></p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-400">über 24 Monate</p>
            <p className="text-[12px] text-gray-500 font-medium">{packName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === MAIN COMPONENT === */
export default function BusinessAntragPage() {
  const [step, setStep] = useState(0);
  const [ref] = useState(() => getPersistentRef("fiaon_business_antrag_ref"));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pack, setPack] = useState<typeof BUSINESS_PACKS[0] | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const [d, setD] = useState({
    companyName: "", legalForm: "", taxId: "", establishedYear: "2010", contactSalutation: "", contactFirstName: "", contactLastName: "", contactEmail: "", contactPhoneCountryCode: "+49", contactPhone: "", street: "", zip: "", city: "", country: "", businessType: "", industry: "", annualRevenue: 0, employees: 0, monthlyExpenses: 0, wantedLimit: 0, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja", billingEmail: "", iban: "", billingMethod: "paper", ag1: false, ag2: false, ag3: false
  });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [useContactEmail, setUseContactEmail] = useState(false);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); }, []);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: "start" });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [step]);

  // Read package parameter from URL and pre-select
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const packageParam = urlParams.get('package');
    
    if (packageParam) {
      // Map tier names to package keys
      const packageMap: Record<string, string> = {
        'paket 1': 'business_starter',
        'paket 2': 'business_pro',
        'paket 3': 'business_ultra',
        'paket 4': 'business_enterprise'
      };
      
      const packageKey = packageMap[packageParam.toLowerCase()] || packageParam;
      const selectedPack = BUSINESS_PACKS.find(p => p.key === packageKey);
      
      if (selectedPack) {
        setPack(selectedPack);
        up("wantedLimit", selectedPack.lim);
        track("pack_select", { pack: selectedPack.key, source: "url_param" }, ref);
        // Skip to step 1 (company data)
        setStep(1);
      }
    }
  }, []);

  // Auto-scroll to top on step change
  useEffect(() => {
    if (step > 0) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [step]);

  // Bestellung anlegen (Vorkasse per Banküberweisung) und zur Zahlungsseite weiterleiten
  const [paymentRedirecting, setPaymentRedirecting] = useState(false);
  const handleProceedToPayment = useCallback(async () => {
    if (!pack || paymentRedirecting) return;
    setPaymentRedirecting(true);
    try {
      const orderRes = await fetch("/api/fiaon/payment-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref }),
      });
      const orderJson = await orderRes.json().catch(() => null);
      if (orderRes.ok && orderJson?.ok && orderJson.paymentReference) {
        track("checkout_bank_transfer", { ref, packKey: pack.key }, ref);
        // Antrag abgeschlossen → ref freigeben (nächster Antrag = neue ref)
        clearPersistentRef("fiaon_business_antrag_ref");
        window.location.href = `/zahlung/${orderJson.paymentReference}`;
      } else if (orderRes.ok && orderJson?.ok && orderJson.linkedToExisting) {
        // P1: bereits bezahlter Kunde ohne Zahlungsreferenz (Alt-Bestand) →
        // keine zweite Bestellung; zum Login (Konto ist bereits aktiv).
        clearPersistentRef("fiaon_business_antrag_ref");
        window.location.href = "/login";
      } else {
        console.error("[FIAON] payment-order failed:", orderJson);
        setPaymentRedirecting(false);
      }
    } catch (error) {
      console.error("[FIAON] payment-order error:", error);
      setPaymentRedirecting(false);
    }
  }, [pack, ref, paymentRedirecting]);

  const up = useCallback((k: string, v: any) => {
    setD(p => ({ ...p, [k]: v }));
    setErrors(e => {
      const newErrors = { ...e };
      delete newErrors[k];
      return newErrors;
    });
  }, []);
  const cardName = d.companyName.trim().toUpperCase();

  // Dynamic placeholders based on country
  const getAddressPlaceholders = (countryCode: string) => {
    switch (countryCode) {
      case "DE":
        return { street: "Musterstraße 12", zip: "10115", city: "Berlin" };
      case "AT":
        return { street: "Wienergasse 2", zip: "1010", city: "Wien" };
      case "CH":
        return { street: "Löwengasse 20", zip: "8001", city: "Zürich" };
      default:
        return { street: "Main Street 1", zip: "1000", city: "Capital City" };
    }
  };
  const addressPlaceholders = getAddressPlaceholders(d.country);

  function goStep(n: number) {
    setIsTransitioning(true);
    setTimeout(() => {
      setStep(n);
      setErrors({});
      track("step_change", { from: step, to: n }, ref);
      setTimeout(() => setIsTransitioning(false), 50);
    }, 200);
  }

  function next() {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.companyName) e.companyName = "Unternehmensname eingeben";
      if (!d.legalForm) e.legalForm = "Rechtsform wählen";
      if (!d.taxId) e.taxId = "Registernummer eingeben";
      if (!d.contactFirstName) e.contactFirstName = "Vorname eingeben";
      if (!d.contactLastName) e.contactLastName = "Nachname eingeben";
      if (!d.contactEmail || !d.contactEmail.includes("@")) e.contactEmail = "Gültige E-Mail eingeben";
      if (!d.contactPhoneCountryCode || !d.contactPhone) e.contactPhone = "Telefonnummer eingeben";
      else if (!checkPhone(`${d.contactPhoneCountryCode}${d.contactPhone}`).valid) e.contactPhone = checkPhone(`${d.contactPhoneCountryCode}${d.contactPhone}`).reason || "Bitte gültige Telefonnummer eingeben";
      if (!d.street) e.street = "Adresse eingeben";
      if (!d.zip) e.zip = "PLZ eingeben";
      if (!d.city) e.city = "Ort eingeben";
      if (!d.country) e.country = "Land wählen";
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
    if (Object.keys(e).length) {
      setErrors(e);
      setTimeout(() => {
        const firstError = document.querySelector('[data-error="true"]');
        if (firstError) firstError.scrollIntoView({ behavior: "smooth", block: "center" });
        else { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; }
      }, 50);
      return;
    }
    if (step === 3) { goStep(4); runVerify(); return; }
    if (step === 6) {
      fetch("/api/fiaon/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref, type: "business", status: "submitted", currentStep: 6,
          packKey: pack?.key, packName: pack?.name,
          companyName: d.companyName, legalForm: d.legalForm, taxId: d.taxId,
          establishedYear: d.establishedYear,
          contactFirstName: d.contactFirstName, contactLastName: d.contactLastName,
          contactEmail: d.contactEmail,
          contactPhone: `${d.contactPhoneCountryCode}${d.contactPhone}`,
          industry: d.industry, annualRevenue: d.annualRevenue, employees: d.employees,
          street: d.street, zip: d.zip, city: d.city, country: d.country,
          wantedLimit: d.wantedLimit, approvedLimit: approved || d.wantedLimit,
          purpose: d.purpose, billing: d.billing, nfc: d.nfc,
          billingEmail: d.billingEmail, billingMethod: d.billingMethod, iban: d.iban,
          email: d.billingEmail || d.contactEmail,
          ag1: d.ag1, ag2: d.ag2, ag3: d.ag3,
        }),
      }).catch(() => {});
      goStep(7); setTimeout(() => goStep(8), 6000); return;
    }
    goStep(step + 1);
  }

  const [verifyStep, setVerifyStep] = useState(0);

  function runVerify() {
    setVerifyDone(false);
    setVerifyStep(0);
    const totalSteps = 8;
    const stepDuration = 1200; // 1.2 seconds per step = ~9.6 seconds total

    const checkNext = (currentStep: number) => {
      if (currentStep < totalSteps) {
        setTimeout(() => {
          setVerifyStep(currentStep + 1);
          checkNext(currentStep + 1);
        }, stepDuration);
      } else {
        setTimeout(() => {
          const mx = pack?.lim || 25000;
          let a = d.wantedLimit;
          if (a > mx) a = mx; if (a < 1000) a = 1000;
          setApproved(a); setVerifyDone(true);
          setTimeout(() => goStep(5), 2000);
        }, 500);
      }
    };

    checkNext(0);
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

      <div ref={topRef} style={{ position: "absolute", top: 0 }} />

      {/* ── Main Content ── */}
      <div className="max-w-6xl mx-auto px-5 pt-24 sm:pt-28 pb-8 sm:pb-12 relative z-10">
        <div className={isTransitioning ? "animate-[slideOutLeft_.2s_ease_forwards]" : "animate-[slideInRight_.3s_ease]"}>
          {/* === STEP 0: Paketauswahl === */}
          {step === 0 && (
            <div className="animate-[fadeInUp_.4s_ease]">
            <div className="text-center mb-12">
              <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Paket wählen</p>
              <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight fiaon-gradient-text-animated mb-4">Wähle dein FIAON Business Paket</h1>
              <p className="text-[15px] text-gray-400 max-w-lg mx-auto leading-relaxed">Entscheide dich für das passende Business-Paket — du gelangst automatisch zum nächsten Schritt.</p>
              <p className="text-[12.5px] text-slate-400 mt-2.5">Aktivierung per Banküberweisung – Zugang nach Zahlungseingang</p>
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

              <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-6">
                {[
                  { n: "01", t: "Paket wählen", d: "Wähle dein gewünschtes FIAON Business-Paket mit passendem Limit." },
                  { n: "02", t: "Unternehmensdaten", d: "Firmeninformationen, Kontaktdaten – verschlüsselt übertragen." },
                  { n: "03", t: "Bonitätsprüfung", d: "Echtzeit-Analyse deiner Unternehmensdaten – dauert nur wenige Sekunden." },
                  { n: "04", t: "Limit erhalten", d: "Dein personalisiertes Business-Kreditlimit wird sofort angezeigt." },
                  { n: "05", t: "Vertrag annehmen", d: "Unterschrift digital – dein Vertrag ist sofort bereit." },
                ].map((s, i) => (
                  <div key={i} className="relative">
                    <div className="relative p-6 rounded-2xl fiaon-glass-panel hover:scale-[1.02] hover:shadow-xl hover:border-[#2563eb]/20 transition-all duration-500 group h-full">

                      <div className="relative z-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 relative overflow-hidden" style={{
                          background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                          boxShadow: "0 4px 12px rgba(37,99,235,0.3)"
                        }}>
                          <div className="absolute inset-0 opacity-30" style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.2), transparent)" }} />
                          <span className="relative z-10 text-[18px] font-bold text-white tracking-tight">{s.n}</span>
                        </div>

                        <h3 className="text-[15px] font-semibold text-gray-900 mb-2 tracking-tight">{s.t}</h3>
                        <p className="text-[13px] text-gray-500 leading-relaxed">{s.d}</p>
                      </div>

                      {i < 4 && (
                        <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-[2px] hidden lg:block opacity-30" style={{
                          background: "linear-gradient(90deg, #2563eb, rgba(37,99,235,0.1))"
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
                  <Field label="Anrede" req error={errors.contactSalutation}>
                    <PremiumSelect
                      value={d.contactSalutation}
                      onChange={(v) => up("contactSalutation", v)}
                      options={["Herr", "Frau"]}
                    />
                  </Field>
                  <Field label="Vorname" req error={errors.contactFirstName}><Inp value={d.contactFirstName} onChange={(v: string) => up("contactFirstName", v)} placeholder="Max" /></Field>
                  <Field label="Nachname" req error={errors.contactLastName}><Inp value={d.contactLastName} onChange={(v: string) => up("contactLastName", v)} placeholder="Mustermann" /></Field>
                  <Field label="Rechtsform" req error={errors.legalForm}>
                    <PremiumSelect
                      value={d.legalForm}
                      onChange={(v) => up("legalForm", v)}
                      options={["GmbH", "AG", "UG (haftungsbeschränkt)", "GbR", "Einzelfirma", "KG", "OHG"]}
                    />
                  </Field>
                  <Field label="Sitz der Gesellschaft" req error={errors.country}>
                    <PremiumCountrySelect
                      value={d.country}
                      onChange={(v) => up("country", v)}
                    />
                  </Field>
                  <Field label="Registernummer (Handelsregister / Firmenbuch)" req error={errors.taxId}><Inp value={d.taxId} onChange={(v: string) => up("taxId", v)} placeholder="z. B. HRB 123456" /></Field>
                  <Field label="E-Mail Ansprechpartner" req error={errors.contactEmail}><Inp type="email" value={d.contactEmail} onChange={(v: string) => up("contactEmail", v)} placeholder="max@muster.de" /></Field>
                  <Field label="Telefonnummer" req error={errors.contactPhone}>
                    <PremiumPhoneInput
                      countryCode={d.contactPhoneCountryCode}
                      phone={d.contactPhone}
                      onCountryCodeChange={(v) => up("contactPhoneCountryCode", v)}
                      onPhoneChange={(v) => up("contactPhone", v)}
                    />
                  </Field>
                  <Field label="Straße & Hausnummer" req error={errors.street}><Inp value={d.street} onChange={(v: string) => up("street", v)} placeholder={addressPlaceholders.street} /></Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="PLZ" req error={errors.zip}><Inp value={d.zip} onChange={(v: string) => up("zip", v)} placeholder={addressPlaceholders.zip} /></Field>
                    <Field label="Ort" req error={errors.city}><Inp value={d.city} onChange={(v: string) => up("city", v)} placeholder={addressPlaceholders.city} /></Field>
                  </div>
                </>}

                {step === 2 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 2 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Wirtschaftliche Daten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Helfen bei der Limit-Berechnung.</p>
                  <Field label="Branche" req error={errors.industry}>
                    <PremiumSelect
                      value={d.industry}
                      onChange={(v) => up("industry", v)}
                      options={["IT & Tech", "Handel", "Dienstleistung", "Produktion", "Finanzdienstleistungen", "Gesundheitswesen", "Bildung", "Sonstiges"]}
                    />
                  </Field>
                  <Field label="Gründungsjahr" req error={errors.establishedYear}>
                    <PremiumSelect
                      value={d.establishedYear}
                      onChange={(v) => up("establishedYear", v)}
                      options={Array.from({ length: 2026 - 1910 + 1 }, (_, i) => (2026 - i).toString())}
                    />
                  </Field>
                  <Field label="Jährlicher Umsatz" req>
                    <PremiumSelect
                      value={d.annualRevenue > 0 ? (d.annualRevenue >= 1000000 ? "mehr als 1.000.000 €" : d.annualRevenue >= 500000 ? "bis zu 1.000.000 €" : d.annualRevenue >= 100000 ? "bis zu 500.000 €" : "bis zu 100.000 €") : ""}
                      onChange={(v) => {
                        const revenueMap: Record<string, number> = {
                          "bis zu 100.000 €": 100000,
                          "bis zu 500.000 €": 500000,
                          "bis zu 1.000.000 €": 1000000,
                          "mehr als 1.000.000 €": 1500000
                        };
                        up("annualRevenue", revenueMap[v] || 0);
                      }}
                      options={["bis zu 100.000 €", "bis zu 500.000 €", "bis zu 1.000.000 €", "mehr als 1.000.000 €"]}
                    />
                  </Field>
                  <Field label="Anzahl Mitarbeiter" req>
                    <PremiumSelect
                      value={d.employees > 0 ? (d.employees > 100 ? "mehr als 100+" : d.employees > 50 ? "50-100" : d.employees > 10 ? "10-50" : "1-10") : ""}
                      onChange={(v) => {
                        const employeeMap: Record<string, number> = {
                          "1-10": 10,
                          "10-50": 50,
                          "50-100": 100,
                          "mehr als 100+": 150
                        };
                        up("employees", employeeMap[v] || 0);
                      }}
                      options={["1-10", "10-50", "50-100", "mehr als 100+"]}
                    />
                  </Field>
                </>}

                {step === 3 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 3 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Karte konfigurieren</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Wähle dein Wunschlimit.</p>
                  <Field label="Wunsch-Kreditlimit" req>
                    <div className="flex items-center gap-3 mb-2"><span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.wantedLimit > 0 ? eur(d.wantedLimit) : "—"}</span><span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 25000)}</span></div>
                    <input type="range" min={1000} max={pack?.lim || 25000} step={1000} value={d.wantedLimit || 1000} onChange={e => up("wantedLimit", +e.target.value)} className="w-full h-1.5 rounded-full bg-gray-100 appearance-none cursor-pointer accent-[#2563eb]" />
                  </Field>
                  
                  {/* Package Suggestion when at max limit */}
                  {d.wantedLimit >= (pack?.lim || 25000) && (() => {
                    const currentIndex = BUSINESS_PACKS.findIndex(p => p.key === pack?.key);
                    const nextPack = currentIndex < BUSINESS_PACKS.length - 1 ? BUSINESS_PACKS[currentIndex + 1] : null;
                    return nextPack ? (
                      <div className="mt-8 mb-8 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 animate-[fadeInUp_.4s_ease]">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900 mb-1">Upgrade verfügbar</p>
                            <p className="text-xs text-blue-700 mb-2">Mit dem {nextPack.name} erhältst du ein Limit bis zu {eur(nextPack.lim)}</p>
                            <button 
                              onClick={() => {
                                setPack(nextPack);
                                // Adjust limit to be within new package range (keep current limit if valid, otherwise set to minimum)
                                const newLimit = d.wantedLimit > nextPack.lim ? nextPack.lim : d.wantedLimit;
                                up("wantedLimit", newLimit);
                              }}
                              className="text-xs font-semibold text-white bg-blue-600 px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-all"
                            >
                              Jetzt wechseln
                            </button>
                          </div>
                          <div className="ml-4 text-right">
                            <p className="text-lg font-bold text-blue-900">{eur(nextPack.fee)}</p>
                            <p className="text-[10px] text-blue-600">/ Monat</p>
                          </div>
                        </div>
                      </div>
                    ) : null;
                  })()}
                  
                  <Field label="Verwendungszweck" req error={errors.purpose}>
                    <PremiumSelect
                      value={d.purpose}
                      onChange={(v) => up("purpose", v)}
                      options={["Geschäftsausgaben", "Reisekosten", "Lieferantenzahlungen", "Mitarbeiterkarten", "Liquiditätsreserve"]}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Abrechnungsart">
                      <PremiumSelect
                        value={d.billing}
                        onChange={(v) => up("billing", v)}
                        options={["Vollzahlung", "Teilzahlung (24 Monate)"]}
                      />
                    </Field>
                    <Field label="NFC kontaktlos">
                      <PremiumSelect
                        value={d.nfc}
                        onChange={(v) => up("nfc", v)}
                        options={["Ja, aktivieren", "Nein"]}
                      />
                    </Field>
                  </div>
                </>}

                {step === 6 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 4 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Vertrag annehmen</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Bestätige deine Daten und nimm den Vertrag an.</p>
                  
                  <div className="mb-6 p-5 rounded-xl fiaon-glass-panel">
                    <p className="text-sm font-semibold text-gray-900 mb-1">Dein Business-Vertrag</p>
                    <p className="text-xs text-gray-500 mb-2">Nach Annahme kannst du deinen personalisierten Vertrag als PDF herunterladen.</p>
                    <p className="text-xs font-medium text-[#2563eb]">Automatisch personalisiert mit deinen Unternehmensdaten</p>
                  </div>
                  
                  <div className="mb-5">
                    <label className="flex justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">E-Mail-Adresse für Rechnungen<span className="text-[#2563eb]">*</span></label>
                    <div className="flex items-center gap-3 mb-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useContactEmail}
                          onChange={(e) => {
                            setUseContactEmail(e.target.checked);
                            if (e.target.checked) {
                              up("billingEmail", d.contactEmail);
                            } else {
                              up("billingEmail", "");
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-[#2563eb] focus:ring-[#2563eb]"
                        />
                        <span className="text-[12px] text-gray-600">Gleich wie im Antragsprozess</span>
                      </label>
                    </div>
                    <input
                      type="email"
                      value={d.billingEmail}
                      onChange={(e) => up("billingEmail", e.target.value)}
                      placeholder="billing@muster.de"
                      disabled={useContactEmail}
                      className={`w-full px-4 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300 ${useContactEmail ? "bg-gray-100 cursor-not-allowed" : ""}`}
                    />
                    {errors.billingEmail && <p className="mt-1.5 text-[11px] font-semibold text-red-500 bg-red-50/80 px-2.5 py-1 rounded-lg">{errors.billingEmail}</p>}
                    <p className="mt-1 text-[11px] text-gray-400">Rechnungen werden hierhin gesendet.</p>
                  </div>

                  <div className="flex gap-0 rounded-xl overflow-hidden mb-5 fiaon-glass-panel">
                    {[["iban","SEPA-Lastschrift"],["paper","Rechnung per E-Mail"]].map(([k,l]) => (
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
                  <button onClick={() => goStep(step === 6 ? 5 : step - 1)} className="px-5 py-2.5 rounded-xl fiaon-glass-panel text-[13px] font-medium text-gray-600 hover:bg-white/80 transition-all">Zurück</button>
                  <button onClick={next} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-all fiaon-btn-gradient hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(37,99,235,0.4)] relative overflow-hidden">
                    <span className="relative z-10">{step === 3 ? "Prüfen lassen" : step === 6 ? "Vertrag annehmen" : "Weiter"}</span>
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
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
            <div className="w-20 h-20 mb-8 relative">
              <div className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-[#2563eb] animate-spin" style={{ animationDuration: '2s' }} />
              <div className="absolute inset-3 rounded-full border-[2px] border-transparent border-r-blue-300 animate-[spin_2.5s_linear_infinite_reverse]" />
              <div className="absolute inset-6 rounded-full border-[1.5px] border-transparent border-b-blue-200 animate-spin" style={{ animationDuration: '3s' }} />
              
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-gradient-to-br from-[#2563eb] to-[#1d4ed8]" style={{ boxShadow: "0 0 40px rgba(37,99,235,.3)" }} />
              
              {verifyDone && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-[scaleIn_.5s_ease]">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="6 12 10 16 18 8"/></svg>
                </div>
              )}
            </div>

            <h3 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-2 fiaon-gradient-text-animated">
              {verifyDone ? "Prüfung abgeschlossen" : "Wir prüfen gerade das Unternehmen"}
            </h3>
            
            <p className="text-[15px] text-gray-500 mb-8 max-w-md">
              {verifyDone 
                ? "Deine Unternehmensdaten wurden erfolgreich verifiziert." 
                : d.companyName}
            </p>

            <div className="w-full max-w-lg space-y-2.5 mb-8">
              {[
                { label: "Unternehmensname", value: d.companyName, step: 0 },
                { label: "Rechtsform", value: d.legalForm, step: 1 },
                { label: "Registernummer", value: d.taxId, step: 2 },
                { label: "Adresse", value: `${d.street}, ${d.zip} ${d.city}`, step: 3 },
                { label: "Land", value: d.country, step: 4 },
                { label: "Branche", value: d.industry, step: 5 },
                { label: "Gründungsjahr", value: d.establishedYear, step: 6 },
                { label: "Jährlicher Umsatz", value: eur(d.annualRevenue), step: 7 }
              ].map((item, i) => {
                const isDone = verifyDone || verifyStep > item.step;
                const isActive = verifyStep === item.step;
                const isPending = verifyStep < item.step;
                return (
                  <div key={i} className={`flex items-center justify-between p-3.5 rounded-xl transition-all duration-700 ${isDone ? 'fiaon-glass-card-selected' : isActive ? 'fiaon-glass-panel' : 'fiaon-glass-panel opacity-40'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-700 ${isDone ? 'bg-[#2563eb]' : isActive ? 'bg-[#2563eb]/50' : 'bg-gray-200'}`}>
                        {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="6 12 10 16 18 8"/></svg>}
                        {isActive && <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />}
                      </div>
                      <div className="text-left">
                        <div className="text-[11px] font-medium text-gray-600">{item.label}</div>
                        <div className="text-[12px] text-gray-400">{item.value}</div>
                      </div>
                    </div>
                    <div className="text-[11px] font-medium text-gray-400">
                      {isDone ? 'verifiziert' : isActive ? 'wird geprüft' : 'wartet'}
                    </div>
                  </div>
                );
              })}
            </div>

            {!verifyDone && (
              <p className="mt-10 text-[12px] text-gray-400 max-w-sm">Bitte hab einen Moment Geduld. Die Prüfung dauert ca. 10 Sekunden.</p>
            )}

            {verifyDone && (
              <button
                onClick={() => goStep(5)}
                className="mt-10 py-2.5 px-8 rounded-xl text-[13px] font-semibold text-white transition-all fiaon-btn-gradient hover:scale-[1.02] hover:shadow-[0_8px_24px_rgba(37,99,235,0.4)] relative overflow-hidden"
              >
                <span className="relative z-10">Weiter</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite]"></div>
              </button>
            )}

            {verifyDone && (() => {
              const maxLimit = approved || d.wantedLimit || 1000;
              return (
                <div className="w-full max-w-md mt-8">
                  <CostSimulation maxLimit={maxLimit} packName={pack?.name || ""} />
                </div>
              );
            })()}
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
            <p className="text-[15px] text-gray-500 mb-2">Deine Unternehmensprüfung für {d.companyName} war erfolgreich</p>
            <p className="text-[14px] text-gray-400 mb-8">Dein bewilligter Kreditrahmen:</p>
            
            <div className="relative inline-block mb-10">
              <div className="absolute inset-0 bg-[#2563eb] blur-3xl opacity-10" />
              <p className="relative text-5xl sm:text-7xl font-bold tracking-tight fiaon-gradient-text-animated">{eur(approved)}</p>
            </div>
            
            <div className="max-w-sm mx-auto mb-10 p-5 rounded-2xl fiaon-glass-panel">
              <p className="text-sm font-semibold text-gray-800 mb-1">Genehmigt mit {pack?.name}</p>
              <p className="text-xs text-gray-500">Monatliche Gebühr: {eur(pack?.fee || 0)} · Maximales Limit: {eur(pack?.lim || 0)}</p>
            </div>
            
            <button onClick={() => goStep(6)} className="group relative px-10 py-4 rounded-2xl text-[15px] font-semibold text-white overflow-hidden transition-all duration-300 hover:scale-[1.02] fiaon-btn-gradient">
              <span className="relative">Fortfahren</span>
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
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight fiaon-gradient-text-animated mb-3">Herzlichen Glückwunsch!</h2>
            <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Das Konto für {d.companyName} wird soeben erstellt. Bitte aktiviere dein Konto indem du deine monatliche Gebühr in Höhe von {(pack?.fee || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € bestätigst.</p>
            <p className="text-[13px] text-gray-400 mb-10">Ref. {ref}</p>

            <div className="max-w-[320px] mx-auto mb-6">{sideCard}</div>

            <div className="relative rounded-2xl overflow-hidden max-w-sm mx-auto mb-8">
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
                <p className="text-[14px] text-gray-600 mb-5">
                  Aktivierung per Banküberweisung – Zugang nach Zahlungseingang. Du erhältst alle Zahlungsdaten inkl. QR-Code für deine Banking-App.
                </p>

                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={paymentRedirecting}
                  className="w-full inline-flex items-center justify-center gap-2.5 rounded-full fiaon-btn-gradient py-4 px-6 text-white font-semibold text-[15px] shadow-xl shadow-blue-500/30 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-600/40 hover:-translate-y-0.5 disabled:opacity-60"
                  style={{ minHeight: 52 }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <span>{paymentRedirecting ? "Einen Moment…" : "Weiter zur Zahlung"}</span>
                </button>

                <p className="text-[12px] text-gray-400 mt-4">
                  {(pack?.fee || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € monatlich · inkl. Kartenversand · SEPA-Überweisung
                </p>
              </div>
            </div>

            <div className="rounded-xl fiaon-glass-panel p-4 max-w-sm mx-auto mt-6 opacity-70">
              <p className="text-[11px] font-semibold text-gray-500 mb-2">Dein Vertrag</p>
              <button
                onClick={() => {
                  const now = new Date();
                  const dateStr = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
                  downloadContract({
                    contractNumber: `FIAON-${ref}`,
                    date: dateStr,
                    companyName: d.companyName,
                    legalForm: d.legalForm,
                    address: `${d.street}, ${d.zip} ${d.city}, Deutschland`,
                    representativeName: `${d.contactFirstName} ${d.contactLastName}`.trim(),
                    selectedPackage: pack?.name || '',
                    maximumTargetLimit: (approved || d.wantedLimit).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
                    monthlyFee: (pack?.fee || 0).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
                    minimumTerm: '24',
                    billingMethod: d.billingMethod === 'iban' ? 'SEPA-Lastschrift' : 'Rechnung per E-Mail',
                    billingEmail: d.billingEmail,
                    signatureData: `FIAON-SIG-${ref}-${now.getTime()}`,
                  });
                  track("contract_download", { ref }, ref);
                }}
                className="w-full py-2.5 rounded-lg text-[12px] font-semibold text-gray-500 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all"
              >
                Vertrag als PDF herunterladen
              </button>
            </div>

            <p className="text-[11px] text-gray-400 font-mono mt-6">Referenz: {ref}</p>
          </div>
        )}
        </div>
      </div>

      <PremiumFooter />

      <style>{`
        @keyframes fadeInUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
        @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        @keyframes shimmer_2s{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes slide{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes scaleIn{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}
        @keyframes slideInRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
        @keyframes slideOutLeft{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(-30px)}}
      `}</style>
    </div>
  );
}
