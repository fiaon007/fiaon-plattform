import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";

// Stripe Payment Links (externes Checkout — ersetzt das eingebettete Stripe SDK)
const STRIPE_PAYMENT_LINKS: Record<string, string> = {
  start: "https://buy.stripe.com/14AaEZ65h4Pkb6z0wifnO01",
  pro: "https://buy.stripe.com/4gM4gB51d4Pk2A3baWfnO02",
  ultra: "https://buy.stripe.com/6oU28t0KX81wfmP0wifnO03",
  highend: "https://buy.stripe.com/dRmeVf51dftYdeHcf0fnO04",
};

/* === CUSTOM ANIMATIONS === */
const styleElement = document.createElement("style");
styleElement.textContent = `
  @keyframes pulseEnergy {
    0%, 100% { transform: scale(1); opacity: 0.8; }
    50% { transform: scale(1.05); opacity: 1; }
  }
  @keyframes gradient {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }
  @keyframes cardEnter {
    from {
      opacity: 0;
      transform: translateY(32px) scale(0.96);
      filter: blur(4px);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
      filter: blur(0);
    }
  }
  .animate-gradient {
    background-size: 200% 200%;
    animation: gradient 3s ease infinite;
  }

  /* === FIAON Range Slider === */
  .fiaon-range {
    -webkit-appearance: none;
    appearance: none;
    height: 8px;
    border-radius: 999px;
    background: linear-gradient(90deg, #dbeafe 0%, #93c5fd 100%);
    outline: none;
    box-shadow: inset 0 1px 2px rgba(15,23,42,0.08);
    transition: all 0.2s ease;
  }
  .fiaon-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ffffff;
    border: 3px solid #2563eb;
    box-shadow: 0 4px 12px rgba(37,99,235,0.35), 0 0 0 4px rgba(37,99,235,0.10);
    cursor: grab;
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }
  .fiaon-range::-webkit-slider-thumb:hover { transform: scale(1.08); }
  .fiaon-range::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.12); box-shadow: 0 6px 20px rgba(37,99,235,0.5), 0 0 0 6px rgba(37,99,235,0.15); }
  .fiaon-range::-moz-range-thumb {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: #ffffff;
    border: 3px solid #2563eb;
    box-shadow: 0 4px 12px rgba(37,99,235,0.35), 0 0 0 4px rgba(37,99,235,0.10);
    cursor: grab;
  }
  .fiaon-range::-moz-range-thumb:active { cursor: grabbing; }

  /* Prominent Variante (Step 3 "Karte konfigurieren") — etwas auffälliger mit sanftem Pulse */
  .fiaon-range-prominent {
    height: 10px;
    background: linear-gradient(90deg, #bfdbfe 0%, #3b82f6 50%, #2563eb 100%);
  }
  .fiaon-range-prominent::-webkit-slider-thumb {
    width: 28px;
    height: 28px;
    border: 3px solid #2563eb;
    box-shadow: 0 6px 16px rgba(37,99,235,0.45), 0 0 0 6px rgba(37,99,235,0.12);
    animation: rangeThumbPulse 2s ease-in-out infinite;
  }
  .fiaon-range-prominent::-moz-range-thumb {
    width: 28px;
    height: 28px;
    border: 3px solid #2563eb;
    box-shadow: 0 6px 16px rgba(37,99,235,0.45), 0 0 0 6px rgba(37,99,235,0.12);
    animation: rangeThumbPulse 2s ease-in-out infinite;
  }
  @keyframes rangeThumbPulse {
    0%, 100% { box-shadow: 0 6px 16px rgba(37,99,235,0.45), 0 0 0 6px rgba(37,99,235,0.12); }
    50% { box-shadow: 0 6px 18px rgba(37,99,235,0.55), 0 0 0 10px rgba(37,99,235,0.06); }
  }
`;
if (!document.head.querySelector('style[data-pulse-energy]')) {
  styleElement.setAttribute('data-pulse-energy', 'true');
  document.head.appendChild(styleElement);
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

/* === PREMIUM INPUT COMPONENT === */
function PremiumInput({ label, value, onChange, placeholder, isValid, error, className = "" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; isValid?: boolean; error?: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none transition-all duration-300 ease-in-out focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300 ${error ? "border-red-500" : ""}`}
        />
        {isValid && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-100 transition">
            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

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
    { code: "+31", country: "Niederlande" },
    { code: "+32", country: "Belgien" },
    { code: "+33", country: "Frankreich" },
    { code: "+34", country: "Spanien" },
    { code: "+351", country: "Portugal" },
    { code: "+39", country: "Italien" },
    { code: "+44", country: "UK" },
    { code: "+46", country: "Schweden" },
    { code: "+47", country: "Norwegen" },
    { code: "+45", country: "Dänemark" },
    { code: "+358", country: "Finnland" },
    { code: "+370", country: "Litauen" },
    { code: "+371", country: "Lettland" },
    { code: "+372", country: "Estland" },
    { code: "+48", country: "Polen" },
    { code: "+420", country: "Tschechien" },
    { code: "+421", country: "Slowakei" },
    { code: "+36", country: "Ungarn" },
    { code: "+40", country: "Rumänien" },
    { code: "+30", country: "Griechenland" },
    { code: "+352", country: "Luxemburg" },
    { code: "+353", country: "Irland" },
    { code: "+386", country: "Slowenien" },
    { code: "+385", country: "Kroatien" },
    { code: "+387", country: "Bosnien" },
    { code: "+381", country: "Serbien" },
    { code: "+389", country: "Nordmazedonien" },
    { code: "+359", country: "Bulgarien" },
    { code: "+380", country: "Ukraine" },
    { code: "+375", country: "Belarus" },
    { code: "+374", country: "Armenien" },
    { code: "+373", country: "Moldau" },
    { code: "+995", country: "Georgien" },
    { code: "+90", country: "Türkei" },
    { code: "+357", country: "Zypern" },
    { code: "+354", country: "Island" },
    { code: "+1", country: "USA/Kanada" },
  ];

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Telefon</label>
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
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}

/* === PREMIUM BUTTON COMPONENT === */
function PremiumButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="relative w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl overflow-hidden group transition-all duration-300 ease-in-out hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
      <span className="relative uppercase tracking-wider font-bold text-sm text-white">
        {children}
      </span>
    </button>
  );
}

const PACKS = [
  { key:"start", name:"FIAON Starter\n(Das Fundament)", fee:7.99, lim:500, bg:"linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats:["Dein 500 € Einstiegs-Setup","Zugang: Basic Karten-Portfolio","Schufaneutrale Profil-Prüfung","Online-Dashboard & Verwaltung"], pay:"https://buy.stripe.com/7sY5kDbfRdT06fagh9bMQ01" },
  { key:"pro", name:"FIAON Pro\n(Standard)", fee:59.99, lim:5000, rec:true, bg:"linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats:["Dein 5.000 € Limit-Protokoll","Zugang: Premium Karten-Netzwerk","Dynamische Limit-Aufstockung","Sofortige Score-Auswertung","Priority-Bearbeitung im System"], pay:"https://buy.stripe.com/cNieVdcjVeX4fPK4yrbMQ02" },
  { key:"ultra", name:"FIAON Ultra\n(Elite Konto)", fee:79.99, lim:15000, bg:"linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats:["Dein 15.000 € Elite-Portfolio","Zugang: Gold- & Platinum-Karten","Cashback- & Meilen-Aktivierung","Individuelle Freigabe-Roadmap","VIP-Support & Konto-Optimierung"], pay:"https://buy.stripe.com/eVq4gz83F02a5b68OHbMQ03" },
  { key:"highend", name:"FIAON High End\n(Das Maximum)", fee:99.99, lim:25000, bg:"linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats:["Dein 25.000 € Black-Card Setup","Exklusiver Zugang: Metal- & VIP-Karten","Persönlicher Account Director","Internationale Limit-Strukturen","24/7 Dedicated Concierge-Support"], pay:"https://buy.stripe.com/7sYdR9abNcOW5b6c0TbMQ04" },
];

/* === CHECK ICON COMPONENT === */
const CheckIcon = ({ isHighEnd = false }: { isHighEnd?: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="9" fill={isHighEnd ? "rgba(37,99,235,0.15)" : "rgba(37,99,235,0.10)"}/>
    <path 
      d="M5.5 9L7.8 11.5L12.5 6.5" 
      stroke={isHighEnd ? "#3b82f6" : "#2563eb"} 
      strokeWidth="1.8" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    />
  </svg>
);

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
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [expandedCard, setExpandedCard] = useState<number | null>(null);

  const [d, setD] = useState({ firstName: "", lastName: "", birthDay: "", birthMonth: "", birthYear: "1990", phoneCountryCode: "+49", phone: "", street: "", zip: "", city: "", country: "", nationality: "", employment: "", employer: "", employedSince: "", income: 0, rent: 0, debts: 0, housing: "", wantedLimit: 0, purpose: "", billing: "Vollzahlung (100%)", addon: "Keine", nfc: "Ja", email: "", salaryReceiptDay: "", iban: "", billingMethod: "iban", ag1: false, ag2: false, ag3: false });
  const [approved, setApproved] = useState(0);
  const [verifyDone, setVerifyDone] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); window.scrollTo(0, 0); }, []);

  // Auto-scroll to top on step change — robust, instant + smooth fallback
  useEffect(() => {
    // Instant, damit es auf mobile nicht vom User unterbrochen werden kann
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    try {
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
    // Nachziehen (falls Content asynchron rendert)
    const t = setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: "auto" }), 50);
    return () => clearTimeout(t);
  }, [step]);

  // Weiterleitung zu externem Stripe Payment Link (statt eingebettetem SDK)
  const handleProceedToStripe = useCallback(async () => {
    if (!pack) return;
    try {
      // Antrag vor Redirect in DB speichern (Status: pending_payment)
      await fetch("/api/fiaon/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref,
          type: "private",
          status: "pending_payment",
          currentStep: 8,
          ...d,
          packKey: pack.key,
          packName: pack.name,
          approvedLimit: approved,
        }),
      }).catch(() => {});

      // Daten im localStorage sichern für Wiedererkennung nach Stripe-Return
      try {
        localStorage.setItem("fiaon_pending_ref", ref);
        localStorage.setItem("fiaon_pending_email", d.email || "");
        localStorage.setItem("fiaon_pending_packKey", pack.key);
        localStorage.setItem("fiaon_pending_data", JSON.stringify({ ...d, approved, packKey: pack.key, packName: pack.name }));
      } catch {}

      track("checkout_redirect_stripe", { ref, packKey: pack.key }, ref);

      const link = STRIPE_PAYMENT_LINKS[pack.key] || STRIPE_PAYMENT_LINKS.ultra;
      const url = `${link}?client_reference_id=${encodeURIComponent(ref)}&prefilled_email=${encodeURIComponent(d.email || "")}`;
      window.location.href = url;
    } catch (err) {
      console.error("[FIAON] handleProceedToStripe failed:", err);
    }
  }, [pack, ref, d, approved]);

  // Synchronized progress for verification screen
  useEffect(() => {
    if (step === 4 && !verifyDone) {
      setCheckProgress(0);
      const duration = 12000; // 12 seconds matching backend timer
      const interval = 50; // Update every 50ms
      const increment = 100 / (duration / interval);
      
      const timer = setInterval(() => {
        setCheckProgress(prev => {
          const next = prev + increment;
          return next >= 100 ? 100 : next;
        });
      }, interval);
      
      return () => clearInterval(timer);
    }
  }, [step, verifyDone]);

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
    setStep(n); setErrors({}); track("step_change", { from: step, to: n }, ref);
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    try { document.documentElement.scrollTop = 0; document.body.scrollTop = 0; } catch {}
  }

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
      if (!d.salaryReceiptDay) e.salaryReceiptDay = "Bitte wählen";
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
    setCheckProgress(0);
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

  // Development: Skip to payment step with Shift+Alt+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.key === 'P') {
        e.preventDefault();
        skipToPayment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Development: Check URL parameter for skip
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('skip') === 'true') {
      if (urlParams.get('skipPayment') === 'true') {
        // Skip payment and go directly to password step
        skipToPayment();
        setStep(9);
      } else {
        skipToPayment();
      }
    }
  }, []);

  // Check for payment success and redirect to password step (Stripe Return)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('payment_success') === 'true') {
      try {
        const pendingRef = localStorage.getItem("fiaon_pending_ref");
        const pendingDataRaw = localStorage.getItem("fiaon_pending_data");
        const pendingPackKey = localStorage.getItem("fiaon_pending_packKey");

        if (pendingDataRaw) {
          const parsed = JSON.parse(pendingDataRaw);
          // Stelle Formulardaten (d) wieder her
          setD((prev) => ({ ...prev, ...parsed }));
          if (typeof parsed.approved === "number") setApproved(parsed.approved);
        }

        // Pack-State aus pendingPackKey wiederherstellen
        if (pendingPackKey) {
          const matchedPack = PACKS.find((p) => p.key === pendingPackKey);
          if (matchedPack) setPack(matchedPack);
        }

        if (pendingRef) {
          // Referenz-State bleibt (ref ist stabil via useState-initializer)
          // Markiere Antrag in DB als bezahlt
          fetch("/api/fiaon/application", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ref: pendingRef,
              type: "private",
              status: "payment_completed",
              currentStep: 9,
            }),
          }).catch(() => {});
          track("payment_success", { ref: pendingRef }, pendingRef);
        }
      } catch (err) {
        console.error("[FIAON] Failed to restore pending data:", err);
      }
      setStep(9);
    }
  }, []);

  // Development: Console command for skipping
  useEffect(() => {
    (window as any).skipToPayment = skipToPayment;
    console.log("💡 Tip: Type skipToPayment() in console to jump to payment step");
    console.log("💡 Tip: Add ?skip=true to URL to jump to payment step");
    console.log("💡 Tip: Press Shift+Alt+P to jump to payment step");
  }, []);

  function skipToPayment() {
    // Prefill required data for payment step
    setD({
      firstName: "Max",
      lastName: "Mustermann",
      birthDay: "1",
      birthMonth: "1",
      birthYear: "1990",
      phoneCountryCode: "+49",
      phone: "01234567890",
      street: "Musterstraße",
      zip: "12345",
      city: "Musterstadt",
      country: "Deutschland",
      nationality: "Deutsch",
      employment: "employed",
      employer: "Musterfirma",
      employedSince: "2020",
      income: 50000,
      rent: 1000,
      debts: 0,
      housing: "rent",
      purpose: "shopping",
      wantedLimit: 5000,
      email: "max@mustermann.de",
      salaryReceiptDay: "1",
      billingMethod: "iban",
      iban: "DE89370400440532013000",
      billing: "iban",
      addon: "Keine",
      nfc: "Nein",
      ag1: true,
      ag2: true,
      ag3: true,
    });
    setPack(PACKS[0]);
    setApproved(500);
    setStep(8);
    console.log("🚀 Skipped to payment step");
  }

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
      <div className="max-w-6xl mx-auto px-4 sm:px-5 pt-24 sm:pt-28 pb-8 sm:pb-12 relative z-10 overflow-x-hidden w-full">
        {step > 0 && <Progress step={step} total={10} />}

        {/* === STEP 0: Paketauswahl === */}
        {step === 0 && (
          <div className="animate-[fadeInUp_.4s_ease] relative px-0 sm:px-6" style={{
            background: "linear-gradient(180deg, #f0f4ff 0%, #f5f8ff 30%, #ffffff 70%, #f8faff 100%)",
            maxWidth: "100%",
            width: "100%",
            boxSizing: "border-box"
          }}>
            {/* Blur-Orbs im Hintergrund */}
            <div style={{
              position: "absolute",
              width: "500px",
              height: "500px",
              background: "radial-gradient(circle, rgba(37,99,235,0.07) 0%, transparent 70%)",
              top: "-100px",
              left: "-100px",
              filter: "blur(60px)",
              pointerEvents: "none",
              zIndex: "0",
              animation: "limitGlow 8s ease-in-out infinite"
            }}></div>
            <div style={{
              position: "absolute",
              width: "400px",
              height: "400px",
              background: "radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)",
              bottom: "-80px",
              right: "-80px",
              filter: "blur(50px)",
              pointerEvents: "none",
              zIndex: "0",
              animation: "limitGlow 8s ease-in-out infinite",
              animationDelay: "4s"
            }}></div>

            {/* Content-Container mit relativ position und z-index */}
            <div style={{ position: "relative", zIndex: "1" }}>
              <div className="text-center mb-12">
              <span className="inline-block" style={{
                background: "rgba(37,99,235,0.08)",
                color: "#2563eb",
                fontSize: "11px",
                fontWeight: "700",
                letterSpacing: "0.13em",
                textTransform: "uppercase",
                padding: "5px 14px",
                borderRadius: "20px",
                border: "1px solid rgba(37,99,235,0.18)"
              }}>PAKET WÄHLEN</span>
              <h1 className="mt-3" style={{
                fontSize: "clamp(2rem, 4vw, 3rem)",
                fontWeight: "800",
                background: "linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text"
              }}>Wähle dein FIAON Paket</h1>
              <p style={{
                color: "#6b7280",
                fontSize: "15px",
                maxWidth: "480px",
                margin: "0 auto",
                lineHeight: "1.7"
              }}>Entscheide dich für das passende Paket — du gelangst automatisch zum nächsten Schritt.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 w-full max-w-[1380px] mx-auto px-0 sm:px-5 box-border items-stretch">
              {PACKS.map((p, idx) => (
                <button
                  key={p.key}
                  onClick={() => { setPack(p); up("wantedLimit", Math.min(d.wantedLimit, p.lim)); track("pack_select", { pack: p.key }, ref); setTimeout(() => goStep(1), 400); }}
                  className="relative"
                  style={{
                    background: "#ffffff",
                    border: p.key === "pro" ? "1.5px solid rgba(37,99,235,0.35)" : "1.5px solid rgba(37,99,235,0.10)",
                    borderRadius: "24px",
                    padding: "0",
                    boxShadow: p.key === "pro" ? "0 8px 40px rgba(37,99,235,0.13)" : "0 4px 24px rgba(37,99,235,0.07)",
                    transition: "transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s, border-color 0.28s, opacity 0.28s, filter 0.28s",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    minWidth: "0",
                    opacity: hoveredCard !== null && hoveredCard !== idx ? 0.75 : 1,
                    transform: hoveredCard !== null && hoveredCard !== idx ? "scale(0.985)" : hoveredCard === idx ? "translateY(-8px) scale(1.018)" : "",
                    filter: hoveredCard !== null && hoveredCard !== idx ? "brightness(0.97)" : "",
                    animation: `cardEnter 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                    animationDelay: `${idx === 0 ? 0.05 : idx === 1 ? 0.15 : idx === 2 ? 0.25 : 0.35}s`
                  }}
                  onMouseEnter={() => setHoveredCard(idx)}
                  onMouseLeave={() => setHoveredCard(null)}
                >
                  {/* Beliebt Badge für Pro */}
                  {p.key === "pro" && (
                    <div style={{
                      position: "absolute",
                      top: "-1px",
                      right: "20px",
                      background: "linear-gradient(135deg, #2563eb, #3b82f6)",
                      color: "#fff",
                      fontSize: "11px",
                      fontWeight: "700",
                      padding: "4px 12px",
                      borderRadius: "0 0 10px 10px",
                      boxShadow: "0 4px 12px rgba(37,99,235,0.35)",
                      zIndex: "10"
                    }}>✦ Beliebt</div>
                  )}

                  {/* SECTION A: Mini-Kreditkarte */}
                  <div style={{ padding: "20px 20px 0 20px" }} className="sm:px-[20px] sm:pt-[20px] px-[18px] pt-[18px]">
                    <LiveCard bg={p.bg} name="" lim={p.lim.toLocaleString("de-DE")} compact className="w-full" />
                  </div>

                  {/* SECTION B: Paket-Name & Untertitel */}
                  <div style={{ padding: "18px 24px 0 24px" }} className="sm:px-[24px] sm:pt-[18px] px-[20px] pt-[16px]">
                    <div style={{
                      fontSize: "17px",
                      fontWeight: "700",
                      color: "#111827",
                      lineHeight: "1.3",
                      whiteSpace: "pre-line"
                    }}>{p.name}</div>
                  </div>

                  {/* SECTION C: WUNSCHLIMIT-BOX (Kompakt) */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', margin: '14px 24px 0 24px' }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px',
                      background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(59,130,246,0.09))',
                      border: '1px solid rgba(37,99,235,0.15)',
                      borderRadius: '10px',
                      flexShrink: 0,
                      width: 'fit-content',
                      maxWidth: 'fit-content'
                    }}>
                      <span style={{
                        fontSize: '9px',
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        color: 'rgba(37,99,235,0.65)',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap'
                      }}>
                        WUNSCHLIMIT BIS
                      </span>
                      <span style={{
                        fontSize: '17px',
                        fontWeight: 800,
                        color: '#2563eb',
                        whiteSpace: 'nowrap',
                        lineHeight: 1
                      }}>
                        {p.lim.toLocaleString("de-DE")} €
                      </span>
                    </div>
                  </div>

                  {/* SECTION D: Preis-Zeile */}
                  <div style={{
                    padding: "14px 24px 0 24px",
                    display: "flex",
                    alignItems: "baseline",
                    gap: "4px"
                  }} className="sm:px-[24px] sm:pt-[14px] px-[20px] pt-[12px]">
                    <span style={{
                      fontSize: "28px",
                      fontWeight: "800",
                      color: "#111827"
                    }}>{p.fee.toLocaleString("de-DE", { minimumFractionDigits: 2 })}</span>
                    <span style={{
                      fontSize: "13px",
                      color: "#6b7280",
                      fontWeight: "500"
                    }}>€/Mt.</span>
                  </div>

                  {/* Trennlinie zwischen Preis und Features */}
                  <div style={{
                    height: "1px",
                    background: "linear-gradient(90deg, transparent, rgba(37,99,235,0.10), transparent)",
                    margin: "14px 24px 0 24px"
                  }} className="sm:mx-[24px] sm:mt-[14px] mx-[20px] mt-[12px]"></div>

                  {/* SECTION E: Feature-Liste */}
                  <div style={{
                    padding: "14px 24px 22px 24px",
                    flex: "1",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0"
                  }} className="sm:px-[24px] sm:pt-[14px] sm:pb-[22px] px-[20px] pt-[12px] pb-[18px]">
                    {/* Feature 1 - IMMER sichtbar */}
                    <div style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      padding: "7px 0",
                      borderBottom: "1px solid rgba(0,0,0,0.04)"
                    }}>
                      <CheckIcon isHighEnd={p.key === "highend"} />
                      <span style={{
                        fontSize: "13.5px",
                        color: "#374151",
                        fontWeight: "500",
                        lineHeight: "1.5",
                        textAlign: "left"
                      }}>{p.feats[0]}</span>
                    </div>
                    
                    {/* Feature 2 - IMMER sichtbar */}
                    {p.feats[1] && (
                      <div style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "7px 0",
                        borderBottom: "1px solid rgba(0,0,0,0.04)"
                      }}>
                        <CheckIcon isHighEnd={p.key === "highend"} />
                        <span style={{
                          fontSize: "13.5px",
                          color: "#374151",
                          fontWeight: "500",
                          lineHeight: "1.5",
                          textAlign: "left"
                        }}>{p.feats[1]}</span>
                      </div>
                    )}
                    
                    {/* Wrapper für Features 3-5 - kollapierbar */}
                    <div style={{
                      maxHeight: expandedCard === idx ? "200px" : "0",
                      overflow: "hidden",
                      opacity: expandedCard === idx ? "1" : "0",
                      transition: "max-height 0.38s cubic-bezier(0.22,1,0.36,1), opacity 0.28s ease"
                    }}>
                      {p.feats.slice(2).map((f, i) => (
                        <div key={i + 2} style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          padding: "7px 0",
                          borderBottom: i === p.feats.slice(2).length - 1 ? "none" : "1px solid rgba(0,0,0,0.04)"
                        }}>
                          <CheckIcon isHighEnd={p.key === "highend"} />
                          <span style={{
                            fontSize: "13.5px",
                            color: "#374151",
                            fontWeight: "500",
                            lineHeight: "1.5",
                            textAlign: "left"
                          }}>{f}</span>
                        </div>
                      ))}
                      {/* Unsichtbarer Platzhalter für Starter (4 Features vs 5) */}
                      {p.key === "start" && <div style={{ height: "28px" }}></div>}
                    </div>

                    {/* Toggle-Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedCard(expandedCard === idx ? null : idx);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "8px",
                        padding: "4px 0",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: "#2563eb",
                        fontSize: "13px",
                        fontWeight: "600",
                        transition: "color 0.15s, gap 0.2s"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#1d4ed8";
                        e.currentTarget.style.gap = "8px";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#2563eb";
                        e.currentTarget.style.gap = "6px";
                      }}
                    >
                      {expandedCard === idx ? "Weniger anzeigen" : "Alle Features anzeigen"}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{
                        transition: "transform 0.3s cubic-bezier(0.22,1,0.36,1)",
                        transform: expandedCard === idx ? "rotate(180deg)" : "rotate(0deg)"
                      }}>
                        <path d="M2.5 5L7 9.5L11.5 5" stroke="#2563eb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>

                    {/* "Konto eröffnen" Button */}
                    <div style={{ padding: "4px 24px 24px 24px", marginTop: "14px" }} className="sm:px-[24px] sm:py-[4px] sm:pb-[24px] sm:mt-[14px] px-[20px] py-[4px] pb-[20px] mt-[12px]">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPack(p);
                          up("wantedLimit", Math.min(d.wantedLimit, p.lim));
                          track("pack_select", { pack: p.key }, ref);
                          setTimeout(() => goStep(1), 400);
                        }}
                        style={{
                          width: "100%",
                          padding: "13px 0",
                          background: p.key === "pro" 
                            ? "linear-gradient(135deg, #1e40af, #2563eb, #3b82f6)" 
                            : "transparent",
                          backgroundSize: "200% 200%",
                          animation: p.key === "pro" ? "gradient 3s ease infinite" : "none",
                          border: p.key === "pro" ? "none" : "1.5px solid rgba(37,99,235,0.25)",
                          borderRadius: "12px",
                          color: p.key === "pro" ? "#fff" : "#2563eb",
                          fontSize: "14px",
                          fontWeight: "600",
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                          transition: "all 0.22s cubic-bezier(0.22,1,0.36,1)",
                          position: "relative",
                          overflow: "hidden",
                          boxShadow: p.key === "pro" ? "0 6px 24px rgba(37,99,235,0.35)" : "none"
                        }}
                        onMouseEnter={(e) => {
                          if (p.key === "pro") {
                            e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                            e.currentTarget.style.boxShadow = "0 10px 32px rgba(37,99,235,0.45)";
                          } else {
                            e.currentTarget.style.background = "rgba(37,99,235,0.06)";
                            e.currentTarget.style.borderColor = "#2563eb";
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "0 6px 20px rgba(37,99,235,0.12)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (p.key === "pro") {
                            e.currentTarget.style.transform = "translateY(0) scale(1)";
                            e.currentTarget.style.boxShadow = "0 6px 24px rgba(37,99,235,0.35)";
                          } else {
                            e.currentTarget.style.background = "transparent";
                            e.currentTarget.style.borderColor = "rgba(37,99,235,0.25)";
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }
                        }}
                      >
                        {p.key === "pro" && (
                          <div style={{
                            position: "absolute",
                            top: "0",
                            left: "-100%",
                            width: "50%",
                            height: "100%",
                            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                            animation: "sweep 2.5s ease-in-out infinite"
                          }}></div>
                        )}
                        Konto eröffnen →
                      </button>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-8">Das endgültige Kreditlimit wird individuell festgelegt.</p>
            </div>
          </div>
        )}

        {/* === DARK MODE SCORE SECTION === */}
        {step === 0 && (
          <div className="mt-20 animate-[fadeInUp_.6s_ease]">
            <div className="relative py-24 sm:py-32 px-6 -mx-5 overflow-hidden" style={{ background: "transparent" }}>
              {/* Mesh Gradient Background - Light */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="absolute top-0 left-0 w-[1000px] h-[600px] opacity-20" style={{
                  background: "radial-gradient(ellipse at center, rgba(59, 130, 246, 0.08), rgba(147, 197, 253, 0.05), transparent 70%)",
                  filter: "blur(80px)",
                  animation: "meshGradient 15s ease-in-out infinite"
                }} />
                <div className="absolute bottom-0 right-0 w-[800px] h-[500px] opacity-15" style={{
                  background: "radial-gradient(ellipse at center, rgba(147, 197, 253, 0.06), rgba(59, 130, 246, 0.04), transparent 70%)",
                  filter: "blur(60px)",
                  animation: "meshGradient 20s ease-in-out infinite reverse"
                }} />
              </div>

              {/* Content */}
              <div className="relative z-10 max-w-4xl mx-auto text-center">
                {/* Section Badge */}
                <div className="mb-8">
                  <span className="inline-block px-5 py-2.5 bg-blue-50 backdrop-blur-xl border border-blue-200 text-blue-700 text-[13px] font-semibold tracking-widest uppercase rounded-full shadow-lg shadow-blue-200/50">
                    PRIVATKUNDEN SETUP
                  </span>
                </div>

                {/* Headline */}
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-[1.1] fiaon-gradient-text-animated">
                  Dein Limit ist keine Glückssache.<br/>
                  Es ist Mathematik.
                </h2>

                {/* Subline */}
                <p className="text-lg text-gray-600 mb-16 max-w-2xl mx-auto leading-relaxed">
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
          <div className="animate-[fadeInUp_.4s_ease] w-full">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 sm:gap-8 items-start w-full max-w-full">
              {/* Left: Form */}
              <div className="fiaon-glass-panel rounded-2xl p-4 sm:p-6 md:p-8 min-w-0 w-full">
                {step === 1 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 1 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Persönliche Daten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Verschlüsselt übertragen und validiert.</p>
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumInput label="Vorname" value={d.firstName} onChange={(v: string) => up("firstName", v)} placeholder="Max" isValid={!!d.firstName} error={errors.firstName} />
                      <PremiumInput label="Nachname" value={d.lastName} onChange={(v: string) => up("lastName", v)} placeholder="Mustermann" isValid={!!d.lastName} error={errors.lastName} />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Geburtsdatum</label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="relative">
                          <select
                            value={d.birthDay}
                            onChange={(e) => up("birthDay", e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none appearance-none transition-all duration-300 ease-in-out focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                          >
                            <option value="">Tag</option>
                            {Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,"0")}</option>)}
                          </select>
                          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <div className="relative">
                          <select
                            value={d.birthMonth}
                            onChange={(e) => up("birthMonth", e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none appearance-none transition-all duration-300 ease-in-out focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                          >
                            <option value="">Monat</option>
                            {["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"].map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}
                          </select>
                          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                        <div className="relative">
                          <select
                            value={d.birthYear}
                            onChange={(e) => up("birthYear", e.target.value)}
                            className="w-full px-4 py-3 bg-slate-50/50 border border-slate-200 rounded-xl text-slate-900 font-medium text-base outline-none appearance-none transition-all duration-300 ease-in-out focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-300"
                          >
                            <option value="">Jahr</option>
                            {Array.from({length:100},(_,i)=><option key={i} value={String(new Date().getFullYear() - i)}>{new Date().getFullYear() - i}</option>)}
                          </select>
                          <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>
                      {errors.birth && <p className="mt-1 text-xs text-red-500">{errors.birth}</p>}
                    </div>
                    <PremiumPhoneInput countryCode={d.phoneCountryCode} phone={d.phone} onCountryCodeChange={(v: string) => up("phoneCountryCode", v)} onPhoneChange={(v: string) => up("phone", v)} error={errors.phone} />
                    <Field label="Wohnsitzland" req error={errors.country}><Sel value={d.country} onChange={(v: string) => up("country", v)}><option value="">Wählen</option><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option><option value="AL">Albanien</option><option value="AD">Andorra</option><option value="BY">Belarus</option><option value="BE">Belgien</option><option value="BA">Bosnien und Herzegowina</option><option value="BG">Bulgarien</option><option value="HR">Kroatien</option><option value="CY">Zypern</option><option value="CZ">Tschechien</option><option value="DK">Dänemark</option><option value="EE">Estland</option><option value="FI">Finnland</option><option value="FR">Frankreich</option><option value="GE">Georgien</option><option value="GR">Griechenland</option><option value="HU">Ungarn</option><option value="IS">Island</option><option value="IE">Irland</option><option value="IT">Italien</option><option value="XK">Kosovo</option><option value="LV">Lettland</option><option value="LI">Liechtenstein</option><option value="LT">Litauen</option><option value="LU">Luxemburg</option><option value="MT">Malta</option><option value="MD">Moldawien</option><option value="MC">Monaco</option><option value="ME">Montenegro</option><option value="NL">Niederlande</option><option value="MK">Nordmazedonien</option><option value="NO">Norwegen</option><option value="PL">Polen</option><option value="PT">Portugal</option><option value="RO">Rumänien</option><option value="RU">Russland</option><option value="SM">San Marino</option><option value="RS">Serbien</option><option value="SK">Slowakei</option><option value="SI">Slowenien</option><option value="ES">Spanien</option><option value="SE">Schweden</option><option value="CH">Schweiz</option><option value="TR">Türkei</option><option value="UA">Ukraine</option><option value="GB">Vereinigtes Königreich</option><option value="VA">Vatikanstadt</option></Sel></Field>
                    <PremiumInput label="Straße & Hausnummer" value={d.street} onChange={(v: string) => up("street", v)} placeholder={addressPlaceholders.street} isValid={!!d.street} error={errors.street} />
                    <div className="grid grid-cols-2 gap-3">
                      <PremiumInput label="PLZ" value={d.zip} onChange={(v: string) => up("zip", v)} placeholder={addressPlaceholders.zip} isValid={!!d.zip} error={errors.zip} />
                      <PremiumInput label="Ort" value={d.city} onChange={(v: string) => up("city", v)} placeholder={addressPlaceholders.city} isValid={!!d.city} error={errors.city} />
                    </div>
                    <Field label="Staatsangehörigkeit" req error={errors.nationality}><CountryDropdown value={d.nationality} onChange={(v: string) => up("nationality", v)} error={errors.nationality} /></Field>
                  </div>
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
                    <input type="range" min={500} max={15000} step={100} value={d.income || 500} onChange={e => up("income", +e.target.value)} className="fiaon-range w-full cursor-pointer" />
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
                    <input type="range" min={500} max={pack?.lim || 5000} step={500} value={d.wantedLimit || 500} onChange={e => up("wantedLimit", +e.target.value)} className="fiaon-range fiaon-range-prominent w-full cursor-pointer" />
                  </Field>
                  
                  {/* Package Suggestion when at max limit */}
                  {d.wantedLimit >= (pack?.lim || 5000) && (() => {
                    const currentIndex = PACKS.findIndex(p => p.key === pack?.key);
                    const nextPack = currentIndex < PACKS.length - 1 ? PACKS[currentIndex + 1] : null;
                    return nextPack ? (
                      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 animate-[fadeInUp_.4s_ease]">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900 mb-1">Upgrade verfügbar</p>
                            <p className="text-xs text-blue-700 mb-2">Mit dem {nextPack.name.replace('\n', ' ')} erhältst du ein Limit bis zu {eur(nextPack.lim)}</p>
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
                  
                  <Field label="E-Mail-Adresse" req error={errors.email} hint="Vertragsunterlagen werden hierhin gesendet."><Inp type="email" value={d.email} onChange={(v: string) => up("email", v)} placeholder="max@beispiel.de" /></Field>
                  <Field label="Gehaltseingang" req error={errors.salaryReceiptDay} hint="An welchem Tag erhalten Sie Ihr Gehalt?"><Sel value={d.salaryReceiptDay} onChange={(v: string) => up("salaryReceiptDay", v)}><option value="">Tag auswählen</option>{Array.from({length: 31}, (_, i) => <option key={i + 1} value={`${i + 1}`}>{i + 1}. Tag im Monat</option>)}<option value="last">Letzter Tag im Monat</option></Sel></Field>
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
                <div className="flex gap-3 mt-8 pt-4 border-t border-white/40">
                  <button onClick={() => goStep(step === 6 ? 5 : step - 1)} className="px-5 py-3 rounded-xl fiaon-glass-panel text-[13px] font-medium text-gray-600 hover:bg-white/80 transition-all">Zurück</button>
                  <PremiumButton onClick={next}>
                    {step === 3 ? "Prüfen lassen" : step === 6 ? "Vertrag annehmen" : "Weiter zu Schritt " + (step + 1)}
                  </PremiumButton>
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
          <div className="animate-[fadeInUp_.6s_ease] flex flex-col items-center text-center py-16 sm:py-24 px-4" style={{ background: "#FDFDFD" }}>
            {/* Premium Spinner */}
            <div className="relative w-56 h-56 mb-12">
              {/* Outer Glass Ring */}
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 border border-slate-200/50 shadow-lg shadow-slate-200/50 transition-transform duration-[8000ms] animate-spin" />
              
              {/* Inner Ring */}
              <div className="absolute inset-4 rounded-full border border-blue-100/30 bg-gradient-to-br from-blue-50/50 to-transparent shadow-sm" />
              
              {/* Haptic Core */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 border-4 border-white/90 shadow-[0_0_30px_rgba(37,99,235,0.4),0_0_60px_rgba(37,99,235,0.2)] animate-pulse" style={{ animation: "pulseEnergy 2s ease-in-out infinite" }}>
                  <span className="absolute inset-0 flex items-center justify-center font-black tracking-tight text-white text-3xl bg-gradient-to-r from-blue-100 via-white to-blue-100 bg-clip-text text-transparent animate-gradient">
                    {verifyDone ? "100" : Math.round(checkProgress)}%
                  </span>
                </div>
              </div>
              
              {verifyDone && (
                <div className="absolute inset-0 flex items-center justify-center animate-[scaleIn_.5s_ease]">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3}><polyline points="6 12 10 16 18 8"/></svg>
                </div>
              )}
            </div>

            <h3 className="text-xl sm:text-3xl font-black tracking-tight text-slate-900 mb-2 px-4 text-center">
              {verifyDone ? "Prüfung abgeschlossen" : "Bonitätsprüfung läuft"}
            </h3>
            
            <p className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed mb-8 sm:mb-10 max-w-md text-center px-4">
              {verifyDone 
                ? "Ihre Daten wurden erfolgreich verifiziert." 
                : "Wir analysieren Ihre Bonität in Echtzeit."}
            </p>

            {/* Progress Bar */}
            <div className="w-full max-w-sm mb-8">
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative mb-4 shadow-inner">
                <div 
                  className={`h-full rounded-full bg-gradient-to-r from-blue-400 via-blue-500 via-blue-600 to-blue-700 transition-all duration-300 ease-out relative overflow-hidden shadow-[0_0_20px_rgba(37,99,235,0.3)]`}
                  style={{ width: `${verifyDone ? 100 : checkProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-[slide_1.5s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>

            {/* Micro-Milestone Tiles */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 max-w-md mx-auto w-full px-4">
              {[
                { label: "SCHUFA-Prüfung", status: checkProgress >= 33 ? (verifyDone ? "done" : "done") : (checkProgress > 0 ? "active" : "pending") },
                { label: "Einkommenscheck", status: checkProgress >= 66 ? (verifyDone ? "done" : "done") : (checkProgress >= 33 ? "active" : "pending") },
                { label: "Freigabe", status: checkProgress >= 100 ? "done" : (checkProgress >= 66 ? "active" : "pending") }
              ].map((item, i) => (
                <div key={i} className={`bg-white/90 backdrop-blur-xl border rounded-xl p-2 sm:p-3 flex flex-col items-center gap-1.5 sm:gap-2 w-full min-w-0 transition-all duration-500 shadow-sm ${
                  item.status === 'done' ? 'border-green-200 bg-gradient-to-br from-green-50 to-white shadow-green-100/50' : 
                  item.status === 'active' ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-blue-100/50 animate-pulse' : 
                  'border-slate-200 bg-gradient-to-br from-slate-50 to-white opacity-60'
                }`}>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shadow-sm flex-shrink-0 ${
                    item.status === 'done' ? 'bg-gradient-to-br from-green-400 to-green-500' : 
                    item.status === 'active' ? 'bg-gradient-to-br from-blue-400 to-blue-500 animate-spin' : 
                    'bg-slate-200'
                  }`}>
                    {item.status === 'done' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="sm:w-[14px] sm:h-[14px]"><polyline points="6 12 10 16 18 8"/></svg>}
                    {item.status === 'active' && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} className="sm:w-[14px] sm:h-[14px]"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>}
                  </div>
                  <div className="text-[9px] sm:text-xs text-slate-600 font-medium leading-tight text-center break-words hyphens-auto w-full" style={{ wordBreak: 'break-word' }}>{item.label}</div>
                </div>
              ))}
            </div>

            {!verifyDone && (
              <p className="mt-12 text-xs text-slate-400 font-mono text-center mb-20">Bitte haben Sie einen Moment Geduld...</p>
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

        {/* === STEP 8: Welcome + Konto aktivieren === */}
        {step === 8 && (
          <div className="animate-[fadeInUp_.4s_ease] max-w-2xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-16">
            {/* HERO: Checkmark + Heading + Namen */}
            <div className="text-center mb-8 sm:mb-10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 sm:mb-6 rounded-full relative flex items-center justify-center">
                <div className="absolute inset-[-2px] rounded-full animate-[spin_4s_linear_infinite]" style={{ background: "conic-gradient(#2563eb,#93c5fd,#2563eb)" }} />
                <div className="w-[56px] h-[56px] sm:w-[72px] sm:h-[72px] rounded-full bg-white flex items-center justify-center relative z-10">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" className="sm:w-8 sm:h-8"><polyline points="6 12 10 16 18 8"/></svg>
                </div>
              </div>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight fiaon-gradient-text-animated mb-3 leading-tight">Herzlich Willkommen</h2>
              <p className="text-[14px] sm:text-[16px] text-gray-500 leading-relaxed max-w-md mx-auto">
                Deine FIAON Kreditkarte wird in Kürze aktiviert.
              </p>
              <p className="text-[12px] sm:text-[13px] text-gray-400 mt-2 break-words px-2">
                {d.firstName} {d.lastName} · {pack?.name?.replace(/\n/g, " ")} · Ref. {ref}
              </p>
            </div>

            {/* PRIMARY CTA — direkt unter Welcome */}
            {pack && (
              <div className="mb-6 sm:mb-8">
                <button
                  type="button"
                  onClick={handleProceedToStripe}
                  className="relative w-full overflow-hidden rounded-2xl py-4 sm:py-5 px-5 sm:px-6 text-white font-bold tracking-wide text-[15px] sm:text-[16px] uppercase shadow-xl shadow-blue-500/40 transition-all duration-300 hover:shadow-2xl hover:shadow-blue-600/50 hover:-translate-y-0.5 active:translate-y-0 focus:outline-none focus:ring-4 focus:ring-blue-300"
                  style={{
                    background: "linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)",
                    backgroundSize: "200% 200%",
                    animation: "gradient 3s ease infinite",
                  }}
                >
                  <span className="absolute inset-0 pointer-events-none" style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)",
                    transform: "translateX(-100%)",
                    animation: "sweep 2.8s ease-in-out infinite",
                    width: "60%",
                  }} />
                  <span className="relative flex items-center justify-center gap-2 sm:gap-3">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span>Konto aktivieren</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12 5 19 12 12 19"/>
                    </svg>
                  </span>
                </button>

                {/* Preis direkt unter Button */}
                <p className="text-center text-[13px] sm:text-[14px] text-slate-500 mt-3">
                  <span className="font-bold text-slate-900">{pack.fee.toFixed(2)} €</span>
                  <span className="mx-1.5 text-slate-300">·</span>
                  <span>monatlich</span>
                </p>
              </div>
            )}

            {/* Dezente Info: Sichere Zahlungsabwicklung */}
            <div className="rounded-xl bg-slate-50/70 border border-slate-100 p-4 sm:p-5 mb-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] sm:text-[13px] font-semibold text-slate-700 mb-0.5">Sichere Zahlungsabwicklung</p>
                  <p className="text-[11px] sm:text-[12px] text-slate-500 leading-relaxed">
                    Weiterleitung zu Stripe · SSL-verschlüsselt · 3D Secure · nach der Zahlung geht's zurück zum Passwort-Setup.
                  </p>
                </div>
              </div>
            </div>

            {/* Trust-Badges Mini-Row */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap mb-6">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                SSL-Verschlüsselt
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
                Powered by Stripe
              </div>
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-400 font-medium">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Sofortige Aktivierung
              </div>
            </div>

            {/* Contract Download Link */}
            <div className="flex items-center justify-center gap-2">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" className="flex-shrink-0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              <button 
                onClick={() => { window.open(`/api/fiaon/contract/${ref}`, '_blank'); track("contract_download", { ref }, ref); }} 
                className="text-[11px] sm:text-[12px] text-gray-400 hover:text-[#2563eb] transition-colors underline decoration-gray-300 hover:decoration-[#2563eb]"
              >
                Vertrag herunterladen
              </button>
            </div>
          </div>
        )}

        {/* === STEP 9: Password Selection === */}
        {step === 9 && (
          <div className="animate-[fadeInUp_.4s_ease] max-w-md mx-auto py-12 sm:py-20">
            <div className="text-center mb-12">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full relative flex items-center justify-center">
                <div className="absolute inset-[-2px] rounded-full animate-[spin_4s_linear_infinite]" style={{ background: "conic-gradient(#2563eb,#93c5fd,#2563eb)" }} />
                <div className="w-[72px] h-[72px] rounded-full bg-white flex items-center justify-center relative z-10">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
                </div>
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight fiaon-gradient-text-animated mb-3">Passwort wählen</h2>
              <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Wähle ein sicheres Passwort für dein FIAON Konto.</p>
              <p className="text-[13px] text-gray-400">{d.firstName} {d.lastName} · {pack?.name} · Ref. {ref}</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-6">
              <div>
                <label className="flex justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Passwort
                  <span className="text-[#2563eb]">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                  placeholder="Mindestens 8 Zeichen"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-all text-[15px]"
                />
              </div>

              <div>
                <label className="flex justify-between text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Passwort bestätigen
                  <span className="text-[#2563eb]">*</span>
                </label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => { setPasswordConfirm(e.target.value); setPasswordError(null); }}
                  placeholder="Passwort wiederholen"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-[#2563eb] focus:ring-2 focus:ring-[#2563eb]/10 outline-none transition-all text-[15px]"
                />
              </div>

              {passwordError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-red-600 text-sm font-medium">
                  {passwordError}
                </div>
              )}

              <button
                onClick={async () => {
                  if (password.length < 8) {
                    setPasswordError("Passwort muss mindestens 8 Zeichen haben");
                    return;
                  }
                  if (password !== passwordConfirm) {
                    setPasswordError("Passwörter stimmen nicht überein");
                    return;
                  }
                  
                  // Save password to database
                  try {
                    await fetch("/api/fiaon/application", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        ref,
                        type: "private",
                        status: "completed",
                        currentStep: 9,
                        password,
                        ...d,
                        packKey: pack?.key,
                        packName: pack?.name,
                        approvedLimit: approved,
                      }),
                    });
                    window.location.href = '/login';
                  } catch (error) {
                    setPasswordError("Fehler beim Speichern des Passworts");
                  }
                }}
                className="w-full py-5 rounded-xl text-[15px] font-bold text-white relative overflow-hidden transition-all duration-300 flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                  boxShadow: "0 4px 20px rgba(37, 99, 235, 0.3)"
                }}
              >
                <div className="absolute inset-0 rounded-xl" style={{
                  background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent 30%)",
                  animation: "borderRotate 3s linear infinite"
                }} />
                <div className="absolute inset-[2px] rounded-xl" style={{
                  background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
                }} />
                <span className="relative z-10 tracking-widest uppercase">Konto erstellen</span>
              </button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-gray-400 font-mono">Referenz: {ref}</p>
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
