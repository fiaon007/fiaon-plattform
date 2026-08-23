import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { EmailVorschlaege } from "@/components/EmailVorschlaege";
import { landErkennen, VORWAHL, LANDNAME } from "@/lib/land-erkennen";
import { appViewport } from "@/lib/app-viewport";
import { paketNameFuerDaten } from "@shared/fiaon-paketname";
import { zustandFuerSchritt } from "@shared/fiaon-antrag-schritte";
import GlassNav from "@/components/GlassNav";
import "@/styles/dunkel.css";
import "@/styles/antrag-dunkel.css";
import { AntragStart } from "@/components/antrag/AntragStart";
import { AdresseSuche } from "@/components/antrag/AdresseSuche";
import PremiumFooter from "@/components/PremiumFooter";
import { checkPhone } from "@/lib/phone";

/**
 * Hart nach oben scrollen — umgeht das globale `html { scroll-behavior: smooth }`
 * aus index.css, das sonst `window.scrollTo({ behavior: "auto" })` ignoriert.
 * Funktioniert auch zuverlässig auf iOS Safari und Mobile Chrome.
 */
function scrollToTopHard() {
  if (typeof window === "undefined") return;
  const html = document.documentElement;
  const body = document.body;
  const prev = html.style.scrollBehavior;
  // 1) CSS-Smooth-Scroll deaktivieren
  html.style.scrollBehavior = "auto";
  try { (window as any).history.scrollRestoration = "manual"; } catch {}

  const doScroll = () => {
    try { window.scrollTo(0, 0); } catch {}
    try { html.scrollTop = 0; } catch {}
    try { body.scrollTop = 0; } catch {}
  };

  // 2) Sofort scrollen
  doScroll();
  // 3) Nach Paint nochmal (falls React noch rendert / Layout shiftet)
  requestAnimationFrame(() => {
    doScroll();
    requestAnimationFrame(doScroll);
  });
  // 4) Nach 100ms nachziehen + CSS-Verhalten wiederherstellen
  setTimeout(() => {
    doScroll();
    html.style.scrollBehavior = prev;
  }, 120);
}


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
function PremiumInput({ label, value, onChange, placeholder, isValid, error, className = "", ...rest }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; isValid?: boolean; error?: string; className?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "placeholder" | "className">) {
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
         {...rest} />
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

  // #23: identische Live-Validierung wie auf der Nummer-Update-Seite (@/lib/phone).
  const live = checkPhone(`${countryCode}${phone}`);
  const liveValid = live.valid;
  const liveHint = phone.trim().length >= 4 && !liveValid ? live.reason : null;

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
        {/* #23: Live-Formatprüfung (keine SMS-Verifizierung) — grüner Haken bei gültiger Nummer */}
        {liveValid && (
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

/* === PREMIUM BUTTON COMPONENT === */
function PremiumButton({ children, onClick, disabled = false }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="antrag-weiter relative inline-flex items-center justify-center gap-2 py-2.5 px-5 fiaon-btn-gradient rounded-full text-[14px] font-medium text-white overflow-hidden group transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none"
      style={{ minHeight: 42 }}
    >
      <span className="relative z-10">{children}</span>
      <svg className="relative z-10 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
      <span className="absolute inset-y-0 w-1/3 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,.25), transparent)", animation: "startShimmer 3.2s ease-in-out infinite" }} />
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// NAME UND BEISATZ GETRENNT (19.08.2026)
//
// Hier stand `name:"FIAON High End\n(Das Maximum)"` — ein Feld mit
// Zeilenumbruch, weil die Karte zwei Zeilen zeigen soll. Der Umbruch ging
// mit in die Datenbank: GEMESSEN 6.589 Bestellungen, und im Portal stand in
// der Paket-Kachel nur „Maximum)".
//
// Jetzt zwei Felder. Die Karte setzt sie untereinander (unverändertes Bild),
// die Daten bekommen `${name} (${sub})` — einzeilig.
//
// So machen es `start.tsx` und `fiaon-home.tsx` seit immer. Nur diese Seite
// und `fiaon-landing.tsx` nicht — und genau die schreiben in die Datenbank.
// ══════════════════════════════════════════════════════════════════════════
const PACKS = [
  { key:"start", name:"FIAON Starter", sub:"Das Fundament", fee:7.99, lim:500, bg:"linear-gradient(145deg,#4a7ab5,#6a9fd4,#8ab8e8)", feats:["Ihr 500 € Einstiegs-Setup","Zugang: Basic Karten-Portfolio","Schufaneutrale Profil-Prüfung","Online-Dashboard & Verwaltung"] },
  { key:"pro", name:"FIAON Pro", sub:"Standard", fee:59.99, lim:5000, rec:true, bg:"linear-gradient(145deg,#1a3f6f,#2563eb,#4a8af5)", feats:["Ihr 5.000 € Limit-Protokoll","Zugang: Premium Karten-Netzwerk","Dynamische Limit-Aufstockung","Sofortige Score-Auswertung","Priority-Bearbeitung im System"] },
  { key:"ultra", name:"FIAON Ultra", sub:"Elite Konto", fee:79.99, lim:15000, bg:"linear-gradient(145deg,#1a3050,#2a5580,#3d7ab8)", feats:["Ihr 15.000 € Elite-Portfolio","Zugang: Gold- & Platinum-Karten","Cashback- & Meilen-Aktivierung","Individuelle Freigabe-Roadmap","VIP-Support & Konto-Optimierung"] },
  { key:"highend", name:"FIAON High End", sub:"Das Maximum", fee:99.99, lim:25000, bg:"linear-gradient(145deg,#0d1b2a,#1b2d44,#2a4060)", feats:["Ihr 25.000 € Black-Card Setup","Exklusiver Zugang: Metal- & VIP-Karten","Persönlicher Account Director","Internationale Limit-Strukturen","24/7 Dedicated Concierge-Support"] },
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

// Dubletten-Fix: ref pro Antrag stabil halten (überlebt Reload/Zurück-Navigation).
// Ohne Persistenz erzeugte jeder Seitenaufruf eine neue ref → neue DB-Zeile.
export function getPersistentRef(storageKey: string): string {
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
export function clearPersistentRef(storageKey: string): void {
  try { sessionStorage.removeItem(storageKey); } catch {}
}
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
// ── EHRLICHE SCHRITTZÄHLUNG (22.08.2026) ─────────────────────────────────
// Intern gibt es zehn Zustände (0–9), sichtbar sind fünf Schritte. Vorher
// stand hier „Schritt 7 von 10" neben „Schritt 4 von 5" in der Überschrift.
const SICHTBARER_SCHRITT: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 3, 5: 3, 6: 4, 7: 4, 8: 5, 9: 5 };
const SCHRITT_NAMEN = ["Daten", "Finanzen", "Karte", "Vertrag", "Zugang"];
function Progress({ step }: { step: number; total?: number }) {
  const sichtbar = SICHTBARER_SCHRITT[step] ?? 1;
  return (
    <div className="mb-10">
      <div className="flex gap-1.5 mb-3">
        {SCHRITT_NAMEN.map((name, i) => {
          const nr = i + 1;
          return (
            <div key={name} className="flex-1">
              <div className="h-1.5 rounded-full relative overflow-hidden" style={{ background: nr <= sichtbar ? "rgba(37,99,235,.25)" : "rgba(255,255,255,.08)" }}>
                {nr < sichtbar && <div className="absolute inset-0 rounded-full bg-[#2563eb]" />}
                {nr === sichtbar && <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#2563eb] to-[#288DFA]" style={{ animation: "shimmer 2s ease-in-out infinite", backgroundSize: "200% 100%" }} />}
              </div>
              <span className={`block mt-1.5 text-[10px] font-semibold uppercase tracking-[.12em] ${nr === sichtbar ? "text-[#1d4ed8]" : "text-gray-400"}`}>{name}</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] font-medium text-gray-400">
        <span>Schritt {sichtbar} von 5</span>
        <span>{Math.round((sichtbar / 5) * 100)} % geschafft</span>
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
  return <input type={type} value={value} onChange={(e: any) => onChange(e.target.value)} placeholder={placeholder} className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-base text-gray-900 outline-none placeholder:text-gray-300" {...p} />;
}

function Sel({ value, onChange, children, ...p }: any) {
  return <select value={value} onChange={(e: any) => onChange(e.target.value)} className="w-full px-4 py-3 rounded-xl fiaon-input-glass text-base text-gray-900 outline-none appearance-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center", paddingRight: "38px" }} {...p}>{children}</select>;
}

/* === MAIN COMPONENT === */
export default function AntragPage() {
  const [step, setStep] = useState(0);
  // ── WIEDEREINSTIEG (E-023) ──────────────────────────────────────────────
  // Kommt der Kunde mit ?weiter=<ref.exp.sig> aus der Erinnerungsmail, wird
  // DIESE Referenz die Referenz des Antrags — sonst legte jeder Klick auf den
  // Link einen zweiten Antrag an, und die Kette liefe weiter.
  const [weiterToken] = useState(() => { try { return new URLSearchParams(window.location.search).get("weiter"); } catch { return null; } });
  const [ref] = useState(() => {
    if (weiterToken) { const r = weiterToken.split(".")[0]; try { sessionStorage.setItem("fiaon_antrag_ref", r); } catch { /* egal */ } return r; }
    return getPersistentRef("fiaon_antrag_ref");
  });
  const [wiederEinstieg, setWiederEinstieg] = useState<"laedt" | "fertig" | "abgelaufen" | null>(weiterToken ? "laedt" : null);
  // Das Land des Besuchers — Vorschlag für Land, Vorwahl, Staatsangehörigkeit
  // und Mail-Endungen. Wird NUR gesetzt, solange der Kunde nichts gewählt hat.
  const [land, setLand] = useState<string | null>(null);
  useEffect(() => appViewport(), []);
  useEffect(() => {
    let weg = false;
    void landErkennen().then((l) => {
      if (weg || !l) return;
      setLand(l);
      setD((prev) => {
        if (prev.country || prev.phone || prev.nationality) return prev;
        return {
          ...prev,
          country: ["DE", "AT", "CH", "LI", "LU"].includes(l) ? l : prev.country,
          phoneCountryCode: VORWAHL[l] || prev.phoneCountryCode,
          nationality: LANDNAME[l] || prev.nationality,
        };
      });
    });
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!weiterToken) return;
    let weg = false;
    void (async () => {
      const r = await fetch(`/api/fiaon/antrag/weiter/${encodeURIComponent(weiterToken)}`).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (weg) return;
      if (!r?.ok || !j?.ok) { setWiederEinstieg("abgelaufen"); return; }
      if (j.fertig && j.zahlung) { window.location.href = j.zahlung; return; }
      const pk = PACKS.find((x) => x.key === j.packKey) || null;
      if (pk) setPack(pk);
      setD((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(j.daten || {}).filter(([, v]) => v !== undefined && v !== null && v !== "")) }));
      if (j.approvedLimit) setApproved(Number(j.approvedLimit));
      const st = Number(j.currentStep || 1);
      // Animationsschritte (4, 5, 7) sind kein Wiedereinstiegsziel.
      const ziel = st <= 3 ? Math.max(1, st) : st <= 5 ? 3 : st <= 7 ? 6 : 6;
      setStep(pk ? ziel : 0);
      setWiederEinstieg("fertig");
      try { window.history.replaceState({}, "", window.location.pathname); } catch { /* egal */ }
    })();
    return () => { weg = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weiterToken]);
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
  const [showPackSwitcher, setShowPackSwitcher] = useState(false);

  // Paket wechseln während Antragsprozess (Up- oder Downgrade)
  const switchPack = useCallback((newPack: typeof PACKS[0]) => {
    if (!newPack) return;
    const currentIdx = pack ? PACKS.findIndex((p) => p.key === pack.key) : -1;
    const newIdx = PACKS.findIndex((p) => p.key === newPack.key);
    setPack(newPack);
    // Limit in neue Paket-Range anpassen
    setD((prev) => ({
      ...prev,
      wantedLimit: prev.wantedLimit > newPack.lim ? newPack.lim : prev.wantedLimit,
    }));
    track("pack_switch", { from: pack?.key, to: newPack.key, direction: newIdx > currentIdx ? "upgrade" : "downgrade" }, ref);
    setShowPackSwitcher(false);
  }, [pack, ref]);

  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!sessionStorage.getItem("fiaon_sid")) sessionStorage.setItem("fiaon_sid", Math.random().toString(36).slice(2)); window.scrollTo(0, 0); }, []);

  // Auto-scroll to top on step change — useLayoutEffect läuft synchron nach DOM-Mutation, vor Browser-Paint
  useLayoutEffect(() => {
    scrollToTopHard();
    topRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior, block: "start" });
  }, [step]);

  // Weiter zum Passwort-Setup — danach folgt die Zahlungsseite (Banküberweisung/Vorkasse)
  const [einrichtungLaeuft, setEinrichtungLaeuft] = useState(false);
  const [einrichtungFehler, setEinrichtungFehler] = useState<string | null>(null);
  const handleProceedToPayment = useCallback(async () => {
    if (!pack || einrichtungLaeuft) return;
    setEinrichtungLaeuft(true); setEinrichtungFehler(null);
    try {
      // 1) Antrag speichern (Status: submitted — Zahlung folgt im Bereich)
      await fetch("/api/fiaon/application", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, type: "private", status: "submitted", currentStep: 8, ...d, packKey: pack.key, packName: paketNameFuerDaten(pack.key) ?? pack.name, approvedLimit: approved }),
      });
      // 2) Zahlungsauftrag anlegen (Verwendungszweck, Betrag, Frist)
      await fetch("/api/fiaon/payment-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref }) }).catch(() => null);
      // 3) Einloggen — der frische Antrag darf ohne Passwort hinein; das Passwort folgt im Bereich
      const r = await fetch(`/api/fiaon/antrag/${encodeURIComponent(ref)}/einloggen`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEinrichtungFehler(j?.error || "Der Bereich konnte nicht geöffnet werden. Bitte melden Sie sich mit Ihrer E-Mail an."); setEinrichtungLaeuft(false); return; }
      try { sessionStorage.setItem("fiaon_user", JSON.stringify({ ref })); localStorage.setItem("fiaon_user", JSON.stringify({ ref })); sessionStorage.removeItem("mb_begruesst"); } catch { /* egal */ }
      track("checkout_bank_transfer", { ref, packKey: pack.key }, ref);
      clearPersistentRef("fiaon_antrag_ref");
      window.location.href = "/mein-bereich?einrichten=1";
    } catch (err) {
      console.error("[FIAON] Einrichtung:", err);
      setEinrichtungFehler("Keine Verbindung. Bitte versuchen Sie es gleich noch einmal.");
      setEinrichtungLaeuft(false);
    }
  }, [pack, ref, d, approved, einrichtungLaeuft]);

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
  // Upgrade-Hinweis (23.08.2026, Justin: „dezent, nicht aufdringlich — der Kunde
  // soll dazu gebracht werden, im Antrag upzugraden"): das nächstgrößere Paket.
  const nextPack = useMemo(() => { const i = PACKS.findIndex(p => p.key === pack?.key); return i >= 0 && i < PACKS.length - 1 ? PACKS[i + 1] : null; }, [pack]);
  const upgraden = (np: typeof PACKS[number]) => { setPack(np); track("pack_upgrade", { von: pack?.key, zu: np.key, step }, ref); };
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
    scrollToTopHard();
  }

  function next() {
    const e: Record<string, string> = {};
    if (step === 1) {
      if (!d.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email.trim())) e.email = "Gültige E-Mail eingeben";
      if (!d.firstName) e.firstName = "Vorname eingeben";
      if (!d.lastName) e.lastName = "Nachname eingeben";
      if (!d.birthDay || !d.birthMonth || !d.birthYear || d.birthYear.length < 4) e.birth = "Gültiges Datum eingeben";
      else { const age = new Date().getFullYear() - +d.birthYear; if (age < 18) e.birth = "Sie müssen mindestens 18 Jahre alt sein"; }
      if (!d.phoneCountryCode || !d.phone) e.phone = "Telefonnummer eingeben";
      else if (!checkPhone(`${d.phoneCountryCode}${d.phone}`).valid) e.phone = checkPhone(`${d.phoneCountryCode}${d.phone}`).reason || "Bitte gültige Telefonnummer eingeben";
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

  // ══════════════════════════════════════════════════════════════════════════
  // DER SCHRITT-ZUSTAND — HIER ENTSTAND „ANTRAG NOCH IM FORMULAR" (19.08.2026)
  //
  // Vorher stand hier ein Feldzugriff mit neun Einträgen und
  // `|| "started"` als Rückfall. Bei Schritt 9 (Passwortseite) griff der
  // Rückfall: Der LETZTE Schritt schrieb den ERSTEN Zustand — unmittelbar
  // nachdem `handleProceedToPayment` korrekt `submitted` gespeichert hatte.
  //
  // GEMESSEN: 24 inhaltlich vollständige Anträge standen deshalb auf „started",
  // und ihre Agenten wurden aufgefordert anzurufen und „beim Fertigstellen zu
  // helfen". Die Zuordnung steht jetzt in `shared/fiaon-antrag-schritte.ts`.
  //
  // ── UND DER FEHLER WIRD NICHT MEHR VERSCHLUCKT ──────────────────────────
  // Das `.catch(() => {})` machte aus einem fehlgeschlagenen Speichern ein
  // stilles Nichts: Der Kunde füllt weiter aus, und der Zustand bleibt stehen.
  // Ein Formular soll den Menschen nicht mit einer Fehlermeldung aufhalten —
  // aber die Konsole und die Fehlerspur müssen es sehen (AGENTS.md: „Ein
  // .catch() um eine Abfrage schreibt den Fehler mit").
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (step > 0) {
      const status = zustandFuerSchritt(step);
      fetch("/api/fiaon/application", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref, type: "private", status, currentStep: step, ...d, packKey: pack?.key, packName: pack ? (paketNameFuerDaten(pack.key) ?? pack.name) : null, approvedLimit: approved }) })
        .then((r) => {
          if (!r.ok) console.error(`[FIAON-ANTRAG] Schritt ${step} nicht gespeichert: HTTP ${r.status}`);
        })
        .catch((e) => console.error(`[FIAON-ANTRAG] Schritt ${step} nicht gespeichert:`, e));
    }
  }, [step]);

  // ══ ENTWICKLER-ABKÜRZUNGEN NUR IN DER ENTWICKLUNG (22.08.2026) ══════════
  // Die Produktionsseite druckte „?skip=true — Skip to payment" und
  // „Shift+Alt+P" in die Konsole; jeder Kunde konnte Prüfung und Vertrag
  // überspringen. Ab jetzt: nur mit Vite-Dev-Server.
  const DEV = !!import.meta.env.DEV;
  useEffect(() => {
    if (!DEV) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.altKey && e.key === 'P') {
        e.preventDefault();
        skipToPayment();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Pre-select package from URL (?pack=start|pro|ultra|highend) — WhatsApp/landing traffic
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const packKey = urlParams.get('pack');
      if (packKey) {
        const matched = PACKS.find((p) => p.key === packKey);
        if (matched) {
          setPack(matched);
          setD((prev) => ({ ...prev, wantedLimit: Math.min(prev.wantedLimit || matched.lim, matched.lim) }));
          if (step === 0) setTimeout(() => setStep(1), 250);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Development: Check URL parameter for skip
  useEffect(() => {
    if (!DEV) return;
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
    // Direct step jump via URL parameter
    const stepParam = urlParams.get('step');
    if (stepParam) {
      const targetStep = parseInt(stepParam, 10);
      if (!isNaN(targetStep) && targetStep >= 0 && targetStep <= 9) {
        if (targetStep > 0) skipToPayment();
        setStep(targetStep);
        console.log(`🚀 Dev: Jumped to step ${targetStep}`);
      }
    }
  }, []);

  // Development: Console commands for skipping
  useEffect(() => {
    if (!DEV) return;
    (window as any).skipToPayment = skipToPayment;
    (window as any).goToStep = (n: number) => {
      if (n >= 0 && n <= 9) {
        if (n > 0) skipToPayment();
        setStep(n);
        console.log(`🚀 Dev: Jumped to step ${n}`);
      } else {
        console.warn("❌ Dev: Step must be between 0 and 9");
      }
    };
    // Quick step jumps
    (window as any).s0 = () => setStep(0);
    (window as any).s1 = () => { skipToPayment(); setStep(1); };
    (window as any).s2 = () => { skipToPayment(); setStep(2); };
    (window as any).s3 = () => { skipToPayment(); setStep(3); };
    (window as any).s4 = () => { skipToPayment(); setStep(4); };
    (window as any).s5 = () => { skipToPayment(); setStep(5); };
    (window as any).s6 = () => { skipToPayment(); setStep(6); };
    (window as any).s7 = () => { skipToPayment(); setStep(7); };
    (window as any).s8 = () => { skipToPayment(); setStep(8); };
    (window as any).s9 = () => { skipToPayment(); setStep(9); };

    console.log("💡 Dev Menu:");
    console.log("   • goToStep(n) - Jump to step 0-9");
    console.log("   • s0...s9 - Quick jumps (e.g., s9 for password)");
    console.log("   • skipToPayment() - Fill form & jump to payment");
    console.log("   • URL: ?step=9 - Direct step jump");
    console.log("   • URL: ?skip=true - Skip to payment");
    console.log("   • Shift+Alt+P - Keyboard shortcut");
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
      email: "test@fiaon.com",
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

  const devModeSkipToDashboard = async () => {
    if ((window as any).__devBusy) return;
    (window as any).__devBusy = true;
    try {
      const res = await fetch("/api/fiaon/admin/create-test-user", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem("fiaon_user", JSON.stringify({
          ref: data.ref,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          packName: data.packName,
          approvedLimit: data.approvedLimit,
        }));
        window.location.href = "/dashboard";
      } else {
        alert("Dev mode: " + (data.error || "Fehler"));
        (window as any).__devBusy = false;
      }
    } catch (err) {
      console.error("Dev mode error:", err);
      (window as any).__devBusy = false;
    }
  }

  const sideCard = <LiveCard bg={pack?.bg || PACKS[1].bg} name={cardName} lim={(pack?.lim || 5000).toLocaleString("de-DE")} />;

  return (
    <div className="antrag-dk dk min-h-screen antialiased" style={{ fontFamily: "'Inter',-apple-system,sans-serif" }}>
      {/* Nachtblau mit Lichtnebel — dieselbe Bühne wie die Website */}
      <div className="dk-grund" aria-hidden="true"><span className="dk-nebel a" /><span className="dk-nebel b" /><span className="dk-nebel c" /></div>

      <GlassNav activePage="privatkunden" />

      {/* Dev Mode Button (hidden) */}
      <button
        onClick={devModeSkipToDashboard}
        className="fixed bottom-2 right-2 w-6 h-6 text-[8px] text-slate-200 hover:text-slate-400 opacity-10 hover:opacity-30 transition-opacity z-50"
        title="Dev Mode: Skip to Dashboard"
      >
        ⚡
      </button>

      {/* ── Main Content ── */}
      {step === 0 && (
        <AntragStart packs={PACKS} onWahl={(p) => { setPack(p as typeof PACKS[number]); up("wantedLimit", Math.min(d.wantedLimit, p.lim)); track("pack_select", { pack: p.key }, ref); setTimeout(() => goStep(1), 400); }} />
      )}
      <div ref={topRef} className={`max-w-6xl mx-auto px-4 sm:px-5 pt-24 sm:pt-28 pb-8 sm:pb-12 relative z-10 overflow-x-hidden w-full ${step === 0 ? "hidden" : ""}`}>
        {step > 0 && <Progress step={step} total={10} />}

        {/* === STEP 0: Paketauswahl === (seit 23.08.2026 in components/antrag/AntragStart.tsx — wird vor dem Container gerendert) */}

        {/* === STEPS 1-3 & 6: Form Steps === */}
        {[1, 2, 3, 6].includes(step) && (
          <div className="animate-[fadeInUp_.4s_ease] w-full">
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-6 sm:gap-8 items-start w-full max-w-full">
              {/* Left: Form */}
              <div className="fiaon-glass-panel antrag-panel rounded-2xl p-4 sm:p-6 md:p-8 min-w-0 w-full">
                {/* Paket-Chip — Trigger für Paket-Wechsler (mobile + desktop) */}
                {pack && (
                  <div className="flex justify-end mb-3 -mt-1">
                    <button type="button" onClick={() => setShowPackSwitcher(true)} className="antrag-paketchip" aria-label="Paket ändern">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="12" rx="2"/><path d="M2 11h20"/></svg>
                      <span className="name">{pack.name}</span>
                      {nextPack ? <span className="up">Upgrade · bis {eur(nextPack.lim)}</span> : <span className="aendern">ändern</span>}
                    </button>
                  </div>
                )}
                {step === 1 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 1 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Persönliche Daten</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Verschlüsselt übertragen und validiert.</p>
                  {wiederEinstieg === "fertig" && (
                    <div className="mb-5 px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ background: "rgba(37,99,235,.07)", color: "#1d4ed8" }}>
                      Willkommen zurück — Ihre Angaben sind noch da. Machen Sie einfach weiter.
                    </div>
                  )}
                  {wiederEinstieg === "abgelaufen" && (
                    <div className="mb-5 px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ background: "rgba(217,119,6,.08)", color: "#b45309" }}>
                      Der Link aus der E-Mail ist abgelaufen — kein Problem, der Antrag dauert nur wenige Minuten.
                    </div>
                  )}
                  <div className="space-y-6">
                    {/* ── DIE E-MAIL ZUERST (E-023, 22.08.2026) ──────────────────
                        Vorher erst in Schritt 4 von 5. Wer vorher abbrach, war
                        nicht erreichbar — kein Empfänger, keine Erinnerung. */}
                    <div>
                      <PremiumInput label="E-Mail-Adresse" value={d.email} onChange={(v: string) => up("email", v)}
                                    placeholder={land === "AT" ? "max@gmx.at" : land === "CH" ? "max@bluewin.ch" : "max@beispiel.de"}
                                    isValid={!!d.email && d.email.includes("@") && d.email.includes(".")} error={errors.email}
                                    type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
                      <EmailVorschlaege wert={d.email} land={land || d.country} onWahl={(v) => up("email", v)} />
                      <p className="mt-1.5 text-[11.5px] text-gray-400">Damit Sie jederzeit genau hier weitermachen können.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <PremiumInput label="Vorname" value={d.firstName} onChange={(v: string) => up("firstName", v)} placeholder="Max" isValid={!!d.firstName} error={errors.firstName} />
                      <PremiumInput label="Nachname" value={d.lastName} onChange={(v: string) => up("lastName", v)} placeholder="Mustermann" isValid={!!d.lastName} error={errors.lastName} />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Geburtsdatum</label>
                      <div className="antrag-geburt">
                        <Sel value={d.birthDay} onChange={(v: string) => up("birthDay", v)} aria-label="Tag"><option value="">Tag</option>{Array.from({length:31},(_,i)=><option key={i+1} value={String(i+1)}>{String(i+1).padStart(2,"0")}</option>)}</Sel>
                        <Sel value={d.birthMonth} onChange={(v: string) => up("birthMonth", v)} aria-label="Monat"><option value="">Monat</option>{["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"].map((m,i)=><option key={i} value={String(i+1)}>{m}</option>)}</Sel>
                        <Sel value={d.birthYear} onChange={(v: string) => up("birthYear", v)} aria-label="Jahr"><option value="">Jahr</option>{Array.from({length:100},(_,i)=><option key={i} value={String(new Date().getFullYear() - 18 - i)}>{new Date().getFullYear() - 18 - i}</option>)}</Sel>
                      </div>
                      {errors.birth && <p className="mt-1 text-xs text-red-500">{errors.birth}</p>}
                    </div>
                    <PremiumPhoneInput countryCode={d.phoneCountryCode} phone={d.phone} onCountryCodeChange={(v: string) => up("phoneCountryCode", v)} onPhoneChange={(v: string) => up("phone", v)} error={errors.phone} />
                    <Field label="Wohnsitzland" req error={errors.country}><Sel value={d.country} onChange={(v: string) => up("country", v)}><option value="">Wählen</option><option value="DE">Deutschland</option><option value="AT">Österreich</option><option value="CH">Schweiz</option><option value="AL">Albanien</option><option value="AD">Andorra</option><option value="BY">Belarus</option><option value="BE">Belgien</option><option value="BA">Bosnien und Herzegowina</option><option value="BG">Bulgarien</option><option value="HR">Kroatien</option><option value="CY">Zypern</option><option value="CZ">Tschechien</option><option value="DK">Dänemark</option><option value="EE">Estland</option><option value="FI">Finnland</option><option value="FR">Frankreich</option><option value="GE">Georgien</option><option value="GR">Griechenland</option><option value="HU">Ungarn</option><option value="IS">Island</option><option value="IE">Irland</option><option value="IT">Italien</option><option value="XK">Kosovo</option><option value="LV">Lettland</option><option value="LI">Liechtenstein</option><option value="LT">Litauen</option><option value="LU">Luxemburg</option><option value="MT">Malta</option><option value="MD">Moldawien</option><option value="MC">Monaco</option><option value="ME">Montenegro</option><option value="NL">Niederlande</option><option value="MK">Nordmazedonien</option><option value="NO">Norwegen</option><option value="PL">Polen</option><option value="PT">Portugal</option><option value="RO">Rumänien</option><option value="RU">Russland</option><option value="SM">San Marino</option><option value="RS">Serbien</option><option value="SK">Slowakei</option><option value="SI">Slowenien</option><option value="ES">Spanien</option><option value="SE">Schweden</option><option value="CH">Schweiz</option><option value="TR">Türkei</option><option value="UA">Ukraine</option><option value="GB">Vereinigtes Königreich</option><option value="VA">Vatikanstadt</option></Sel></Field>
                    <AdresseSuche wert={{ street: d.street, zip: d.zip, city: d.city, country: d.country }} land={d.country || land || "DE"}
                                  onChange={(w) => setD(p => ({ ...p, ...w }))} errors={{ street: errors.street, zip: errors.zip, city: errors.city }} platzhalter={addressPlaceholders} />
                    <Field label="Staatsangehörigkeit" req error={errors.nationality}><CountryDropdown value={d.nationality} onChange={(v: string) => up("nationality", v)} error={errors.nationality} /></Field>
                  </div>
                </>}

                {step === 2 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 2 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Beruf & Finanzen</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Helfen bei der Limit-Berechnung.</p>
                  <Field label="Beschäftigungsstatus" req error={errors.employment}><Sel value={d.employment} onChange={(v: string) => up("employment", v)}><option value="">Wählen</option><option>Angestellt</option><option>Selbstständig</option><option>Freiberuflich</option><option>Beamter/in</option><option>Student/in</option><option>Rentner/in</option></Sel></Field>
                  <Field label="Beschäftigt seit" req error={errors.employedSince}><Sel value={d.employedSince} onChange={(v: string) => up("employedSince", v)}><option value="">Wählen</option><option>{"< 6 Monate"}</option><option>6–12 Monate</option><option>1–3 Jahre</option><option>3–5 Jahre</option><option>{"> 5 Jahre"}</option></Sel></Field>
                  <Field label="Monatliches Nettoeinkommen" req>
                    <div className="relative mb-3">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-[15px] pointer-events-none select-none">€</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={500}
                        max={15000}
                        value={d.income || ""}
                        onChange={e => up("income", Math.min(15000, Math.max(0, +e.target.value || 0)))}
                        placeholder="2.500"
                        className="w-full pl-9 pr-16 py-3 rounded-xl fiaon-input-glass text-[15px] text-gray-900 outline-none placeholder:text-gray-300"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[12px] text-gray-400 pointer-events-none">/ Monat</span>
                    </div>
                    <input type="range" min={500} max={15000} step={100} value={d.income || 500} onChange={e => up("income", +e.target.value)} className="fiaon-range w-full cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>€ 500</span><span>€ 15.000</span></div>
                  </Field>
                  <Field label="Wohnsituation" req error={errors.housing}><Sel value={d.housing} onChange={(v: string) => up("housing", v)}><option value="">Wählen</option><option>Zur Miete</option><option>Eigentum</option><option>Bei Familie</option><option>Sonstiges</option></Sel></Field>
                </>}

                {step === 3 && <>
                  <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-2">Schritt 3 von 5</p>
                  <h2 className="text-xl sm:text-2xl font-semibold tracking-tight fiaon-gradient-text-animated mb-1">Karte konfigurieren</h2>
                  <p className="text-[14px] text-gray-400 mb-6">Wählen Sie Ihr Wunschlimit.</p>
                  <Field label="Wunsch-Kreditlimit" req>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl font-semibold fiaon-gradient-text-animated">{d.wantedLimit > 0 ? eur(d.wantedLimit) : "—"}</span>
                      <span className="text-[12px] text-gray-400">max. {eur(pack?.lim || 5000)}</span>
                      <button
                        type="button"
                        onClick={() => up("wantedLimit", pack?.lim || 5000)}
                        className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-1.5 rounded-full bg-blue-50 text-[#2563eb] hover:bg-blue-100 active:scale-95 transition-all border border-blue-100"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 3h14M5 21h14M12 3v18"/></svg>
                        Max wählen
                      </button>
                    </div>
                    <input type="range" min={500} max={pack?.lim || 5000} step={500} value={d.wantedLimit || 500} onChange={e => up("wantedLimit", +e.target.value)} className="fiaon-range fiaon-range-prominent w-full cursor-pointer" />
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1"><span>€ 500</span><span>{eur(pack?.lim || 5000)}</span></div>
                  </Field>
                  
                  {/* Upgrade — dezent immer sichtbar, am Limit betont (23.08.2026) */}
                  {nextPack && (() => {
                    const amLimit = d.wantedLimit >= (pack?.lim || 5000);
                    return (
                      <div className={`antrag-upgrade${amLimit ? " am-limit" : ""}`}>
                        <div className="text">
                          <p className="t">{amLimit ? "Ihr Wunschlimit liegt am Maximum dieses Pakets." : "Mehr Spielraum, wenn Sie ihn brauchen."}</p>
                          <p className="s">{nextPack.name}: Rahmen bis {eur(nextPack.lim)} – für {eur(Math.round((nextPack.fee - (pack?.fee || 0)) * 100) / 100)} mehr im Monat.</p>
                        </div>
                        <div className="rechts">
                          <span className="preis">{eur(nextPack.fee)}<small>/ Monat</small></span>
                          <button type="button" className="dk-knopf" onClick={() => upgraden(nextPack)}>Upgrade wählen</button>
                        </div>
                      </div>
                    );
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
                  <p className="text-[14px] text-gray-400 mb-6">Bestätigen Sie Ihre Daten und nehmen Sie den Vertrag an.</p>
                  
                  <Field label="E-Mail-Adresse" req error={errors.email} hint="Vertragsunterlagen werden hierhin gesendet."><Inp type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={d.email} onChange={(v: string) => up("email", v)} placeholder={land === "AT" ? "max@gmx.at" : land === "CH" ? "max@bluewin.ch" : "max@beispiel.de"} /><EmailVorschlaege wert={d.email} land={land || d.country} onWahl={(v) => up("email", v)} /></Field>
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
                <div className="antrag-knopfzeile flex items-center justify-between gap-3 mt-8 pt-4 border-t border-white/40">
                  <button onClick={() => goStep(step === 6 ? 5 : step - 1)} className="antrag-zurueck px-4 py-2.5 rounded-full text-[13px] font-medium text-gray-600 hover:bg-white/80 transition-all">Zurück</button>
                  <PremiumButton onClick={next}>
                    {step === 3 ? "Prüfen lassen" : step === 6 ? "Vertrag annehmen" : `Weiter · ${SCHRITT_NAMEN[step] || ""}`}
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
                      <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">IHR PAKET</p>
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
                        {nextPack && (
                          <button type="button" className="antrag-upgrade-zeile" onClick={() => upgraden(nextPack)}>
                            <span>Upgrade auf {nextPack.name.replace("FIAON ", "")}</span>
                            <b>bis {eur(nextPack.lim)} · {eur(nextPack.fee)}/Mt.</b>
                          </button>
                        )}
                      </div>
                      
                      <div className="pt-3 mt-3 border-t border-white/40 flex items-center justify-between gap-2">
                        <p className="text-[11px] font-mono text-gray-400 tracking-wider">{ref}</p>
                        <button
                          type="button"
                          onClick={() => setShowPackSwitcher(true)}
                          className="text-[11px] font-semibold text-[#2563eb] hover:text-[#1e40af] underline decoration-dotted decoration-[#2563eb]/40 underline-offset-4 transition-colors"
                        >
                          Paket ändern
                        </button>
                      </div>

                      {/* Real-time data display */}
                      <div className="pt-4 mt-4 border-t border-white/40 space-y-2">
                        <p className="text-[10px] font-semibold text-[#2563eb] uppercase tracking-[.15em] mb-3">Ihre Eingaben</p>
                        
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
          <div className="animate-[fadeInUp_.6s_ease] antrag-pruefung px-2 sm:px-4 py-8 sm:py-14">
            {/* ══ DIE PRÜFUNG ALS BÜHNE (22.08.2026) ═════════════════════════
                Vorher: ein Ring mit Prozentzahl und drei Kacheln. Jetzt eine
                Glasbühne mit Tiefe, in der die Teilschritte nacheinander
                erscheinen — nachvollziehbar, was gerade geprüft wird. Die
                Dauer bleibt (12 s), der Inhalt ist ehrlicher. */}
            {(() => {
              const pz = verifyDone ? 100 : checkProgress;
              const teilschritte = [
                { ab: 4,  t: "Identität abgeglichen", s: `${d.firstName} ${d.lastName}`.trim() || "Name und Geburtsdatum" },
                { ab: 18, t: "Anschrift geprüft", s: [d.zip, d.city].filter(Boolean).join(" ") || "Wohnsitz" },
                { ab: 34, t: "Auskunftei angefragt", s: d.country === "AT" ? "KSV1870 · CRIF Austria" : d.country === "CH" ? "ZEK · CRIF Schweiz" : "SCHUFA · CRIF Bürgel" },
                { ab: 52, t: "Einkommen plausibilisiert", s: d.income ? `${Number(d.income).toLocaleString("de-DE")} € netto` : "Beschäftigung" },
                { ab: 84, t: "Ziel-Rahmen berechnet", s: pack ? `Paket ${pack.name}` : "Paket" },
                { ab: 100, t: "Freigabe", s: "Ihr Programm steht" },
              ];
              return (
                <div className="antrag-buehne mx-auto" style={{ maxWidth: 760 }}>
                  <div className="antrag-glas">
                    <div className="antrag-ring" data-fertig={verifyDone ? "ja" : undefined}>
                      <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
                        <defs><linearGradient id="pr-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#288DFA" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient></defs>
                        <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(29,78,216,.10)" strokeWidth="7" />
                        <circle cx="60" cy="60" r="52" fill="none" stroke="url(#pr-g)" strokeWidth="7" strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 52}`} strokeDashoffset={`${2 * Math.PI * 52 * (1 - pz / 100)}`}
                                transform="rotate(-90 60 60)" style={{ transition: "stroke-dashoffset .35s ease-out" }} />
                      </svg>
                      <div className="antrag-ring-kern">
                        {verifyDone
                          ? <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7" /></svg>
                          : <span className="zahl">{Math.round(pz)}<small>%</small></span>}
                      </div>
                    </div>
                    <h3 className="antrag-pruef-titel">{verifyDone ? "Prüfung abgeschlossen" : "Ihre Angaben werden geprüft"}</h3>
                    <p className="antrag-pruef-text">{verifyDone ? "Ihre Angaben wurden geprüft. Gleich sehen Sie Ihren Rahmen." : "Identität, Auskunftei, Einkommen, Haushalt — Schritt für Schritt, in dieser Reihenfolge."}</p>
                    <ol className="antrag-teilschritte">
                      {teilschritte.map((x, i) => {
                        const zustand = pz >= x.ab ? "fertig" : pz >= x.ab - 16 ? "laeuft" : "wartet";
                        return (
                          <li key={x.t} data-zustand={zustand} style={{ ["--i" as any]: i }}>
                            <span className="marke" aria-hidden="true">{zustand === "fertig" ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round"><polyline points="5 12 10 17 19 7" /></svg> : null}</span>
                            <span className="text"><b>{x.t}</b><small>{x.s}</small></span>
                            <span className="stand">{zustand === "fertig" ? "erledigt" : zustand === "laeuft" ? "läuft" : ""}</span>
                          </li>
                        );
                      })}
                    </ol>
                    {!verifyDone && <p className="antrag-pruef-fuss">Bitte haben Sie einen Moment Geduld — das dauert unter einer Minute.</p>}
                  </div>
                  <div className="antrag-buehne-schatten" aria-hidden="true" />
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
            <p className="text-[15px] text-gray-500 mb-2">Ihre Prüfung war erfolgreich</p>
            <p className="text-[14px] text-gray-400 mb-8">Ihr Ziel-Rahmen im Programm:</p>
            
            <div className="relative inline-block mb-10">
              <div className="absolute inset-0 bg-[#2563eb] blur-3xl opacity-10" />
              <p className="relative text-5xl sm:text-7xl font-bold tracking-tight fiaon-gradient-text-animated">{eur(approved)}</p>
            </div>

            <div className="max-w-sm mx-auto mb-10 p-5 rounded-2xl fiaon-glass-panel">
              <p className="text-sm font-semibold text-gray-800 mb-1">Genehmigt mit {pack?.name}</p>
              <p className="text-xs text-gray-500">Monatliche Gebühr: {eur(pack?.fee || 0)} · Maximales Limit: {eur(pack?.lim || 0)}</p>
            </div>

            <button onClick={() => goStep(6)} className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full fiaon-btn-gradient text-[14px] font-medium text-white transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] w-full sm:w-auto" style={{ minHeight: 48 }}>
              <span>Vertrag annehmen &amp; fortfahren</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
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
            <h3 className="text-xl font-semibold tracking-tight mb-2 fiaon-gradient-text-animated">Ihr Vertrag wird erstellt</h3>
            <p className="text-[14px] text-gray-400">Wir bereiten alles für Sie vor.</p>
          </div>
        )}

        {/* === STEP 8: Vertrag angenommen → direkt in den Bereich (23.08.2026, Justin) ===
            Kein Passwort mehr hier, keine Zahlungsdaten hier: Der Kunde wird eingeloggt,
            sieht seinen Bereich (unscharf), legt dort das Passwort fest und wählt dann
            Zahlung oder Gespräch. Ein Weg, ein Knopf, zentriert. */}
        {step === 8 && (
          <div className="animate-[fadeInUp_.4s_ease] max-w-xl mx-auto w-full px-4 sm:px-6 py-10 sm:py-16 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-5 sm:mb-6 rounded-full relative flex items-center justify-center">
              <div className="absolute inset-[-2px] rounded-full animate-[spin_4s_linear_infinite]" style={{ background: "conic-gradient(#2563eb,#93c5fd,#2563eb)" }} />
              <div className="w-[56px] h-[56px] sm:w-[72px] sm:h-[72px] rounded-full bg-white flex items-center justify-center relative z-10">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.5" className="sm:w-8 sm:h-8"><polyline points="6 12 10 16 18 8"/></svg>
              </div>
            </div>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight fiaon-gradient-text-animated mb-3 leading-tight">Vertrag angenommen</h2>
            <p className="text-[14px] sm:text-[16px] text-gray-500 leading-relaxed max-w-md mx-auto">Ihr Bereich ist angelegt. Dort legen Sie Ihr Passwort fest und entscheiden, wie es weitergeht: jetzt aktivieren – oder zuerst mit einem Mitarbeiter sprechen.</p>
            <p className="text-[12px] sm:text-[13px] text-gray-400 mt-2 break-words px-2">{d.firstName} {d.lastName} · {pack?.name?.replace(/\n/g, " ")} · Ref. {ref}</p>
            <div className="mt-8 flex justify-center">
              <button type="button" onClick={handleProceedToPayment} disabled={einrichtungLaeuft}
                className="relative inline-flex items-center justify-center gap-2.5 overflow-hidden rounded-full fiaon-btn-gradient py-3.5 px-8 text-white font-medium text-[15px] shadow-xl shadow-blue-500/30 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-60"
                style={{ minHeight: 46, minWidth: 300 }}>
                <span className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)", animation: "startShimmer 2.8s ease-in-out infinite" }} />
                <span className="relative z-10">{einrichtungLaeuft ? "Ihr Bereich wird eingerichtet …" : "Weiter in meinen Bereich"}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="relative z-10"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
            {einrichtungFehler && <p className="mt-4 text-[13px] text-red-400">{einrichtungFehler}</p>}
            <p className="text-center text-[12.5px] text-gray-400 mt-5">{pack ? `${pack.fee.toFixed(2).replace(".", ",")} € monatlich · inkl. Kartenversand` : ""} · Zahlung und Termin wählen Sie im Bereich</p>
            <div className="flex items-center justify-center gap-4 sm:gap-6 flex-wrap mt-8">
              {["SSL-verschlüsselt", "SEPA-Überweisung", "Server in der EU"].map((t) => <span key={t} className="text-[11px] text-slate-400">{t}</span>)}
            </div>
            <button type="button" onClick={() => { window.open(`/api/fiaon/contract/${ref}`, '_blank'); track("contract_download", { ref }, ref); }} className="mt-6 text-[12px] text-slate-400 underline underline-offset-4">Vertrag herunterladen</button>
          </div>
        )}

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
              <p className="text-[15px] text-gray-500 mb-2 max-w-md mx-auto">Wählen Sie ein sicheres Passwort für Ihr FIAON Konto.</p>
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
                        packName: pack ? (paketNameFuerDaten(pack.key) ?? pack.name) : null,
                        approvedLimit: approved,
                      }),
                    });

                    // Bestellung anlegen (Vorkasse) und zur Zahlungsseite weiterleiten
                    const orderRes = await fetch("/api/fiaon/payment-order", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ref }),
                    });
                    const orderJson = await orderRes.json().catch(() => null);
                    if (orderRes.ok && orderJson?.ok && orderJson.paymentReference) {
                      // Antrag abgeschlossen → ref freigeben (nächster Antrag = neue ref)
                      clearPersistentRef("fiaon_antrag_ref");
                      window.location.href = `/zahlung/${orderJson.paymentReference}`;
                    } else {
                      // Fallback: Konto ist angelegt, Zahlungsinfos kommen per E-Mail
                      clearPersistentRef("fiaon_antrag_ref");
                      window.location.href = '/login';
                    }
                  } catch (error) {
                    setPasswordError("Fehler beim Speichern des Passworts");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full fiaon-btn-gradient text-[15px] font-medium text-white transition-all duration-300 hover:shadow-[0_8px_24px_rgba(37,99,235,0.35)] hover:-translate-y-0.5"
                style={{ minHeight: 46 }}
              >
                <span>Konto erstellen</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-gray-400 font-mono">Referenz: {ref}</p>
      </div>

      {/* === Paket-Switcher Modal === */}
      {showPackSwitcher && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
          style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(6px)" }}
          onClick={() => setShowPackSwitcher(false)}
        >
          <div
            className="bg-white w-full sm:w-auto sm:max-w-3xl rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] overflow-y-auto animate-[fadeInUp_.3s_ease]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-5 sm:px-8 py-4 sm:py-5 flex items-center justify-between z-10">
              <div>
                <p className="text-[10px] uppercase tracking-[.2em] font-bold text-[#2563eb] mb-1">Paket wechseln</p>
                <h3 className="text-lg sm:text-2xl font-black tracking-tight text-slate-900">Wählen Sie Ihr neues Paket</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPackSwitcher(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all flex-shrink-0"
                aria-label="Schließen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Paket-Liste */}
            <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {PACKS.map((p) => {
                const isCurrent = pack?.key === p.key;
                const currentIdx = pack ? PACKS.findIndex((x) => x.key === pack.key) : -1;
                const thisIdx = PACKS.findIndex((x) => x.key === p.key);
                const isUpgrade = currentIdx >= 0 && thisIdx > currentIdx;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => !isCurrent && switchPack(p)}
                    disabled={isCurrent}
                    className={`relative text-left p-4 sm:p-5 rounded-2xl border-2 transition-all duration-200 ${
                      isCurrent
                        ? "border-[#2563eb] bg-blue-50/50 cursor-default"
                        : "border-slate-200 bg-white hover:border-[#2563eb] hover:shadow-lg hover:-translate-y-0.5 cursor-pointer"
                    }`}
                  >
                    {/* Status-Badge */}
                    {isCurrent && (
                      <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-[#2563eb] bg-white border border-blue-200 px-2 py-0.5 rounded-full">
                        Aktuell
                      </span>
                    )}
                    {!isCurrent && isUpgrade && (
                      <span className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 to-blue-500 px-2 py-0.5 rounded-full shadow">
                        Upgrade
                      </span>
                    )}

                    <div className="mb-3">
                      <p className="text-[14px] sm:text-[15px] font-bold text-slate-900 leading-tight">
                        {p.name}
                        <br />({p.sub})
                      </p>
                    </div>

                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900">{p.fee.toFixed(2).replace(".", ",")}</span>
                      <span className="text-[12px] text-slate-500 font-medium">€/Mt.</span>
                    </div>

                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-blue-600/70">Limit bis</span>
                      <span className="text-[13px] font-black text-[#2563eb]">{p.lim.toLocaleString("de-DE")} €</span>
                    </div>

                    {!isCurrent && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500 font-medium">
                          {isUpgrade ? "Jetzt upgraden" : "Zu diesem Paket wechseln"}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="5" y1="12" x2="19" y2="12"/>
                          <polyline points="12 5 19 12 12 19"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Info */}
            <div className="px-5 sm:px-8 py-4 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Ihr Wunschlimit wird automatisch an das neue Paket angepasst. Eingaben bleiben erhalten.
              </p>
            </div>
          </div>
        </div>
      )}

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
        }
        @keyframes scaleIn{0%{opacity:0;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}}
      `}</style>
    </div>
  );
}
