import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TOKEN_PRICE = 0.12;
const BONUS_BASE = 0.15;
const EXTRA_THRESHOLD = 125000;
const EXTRA_BONUS = 0.05;
const EXISTING_INVESTMENT = 100000;
const EXISTING_TOKENS = 479166;
const PRICE_NOW = 0.57;
const PRICE_TARGET = 1.14;
const PRICE_AMBITIOUS = 2.20;
const PRICE_CONSERVATIVE = 0.78;

const formatEUR = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatToken = (value: number) => {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

const formatMultiplier = (value: number) => {
  return value.toFixed(1) + "x";
};

const tippingTexts = [
  "Ihre Entscheidung jetzt bestimmt Ihren Faktor.",
  "Vor dem Marktstart haben nur Sie Zugang zu 0,12 EUR.",
  "Ihre Bonus-Stufe erhoeht sich ab 125.000 EUR Gesamtinvest.",
  "0% Risiko durch vertragliche Rueckkaufgarantie.",
  "Token-Zuteilung sofort nach Vertragsunterzeichnung."
];

function TippingText() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % tippingTexts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="h-8 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="text-sm text-[#FE9100] italic"
        >
          {tippingTexts[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function AnimatedCounter({ value, prefix = "", suffix = "" }: { value: number; prefix?: string; suffix?: string }) {
  const [displayValue, setDisplayValue] = useState(value);
  useEffect(() => {
    const duration = 800;
    const steps = 30;
    const stepDuration = duration / steps;
    const increment = (value - displayValue) / steps;
    let current = displayValue;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      current += increment;
      if (step >= steps) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(current);
      }
    }, stepDuration);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{prefix}{formatToken(Math.round(displayValue))}{suffix}</span>;
}

export default function InvestorSchwabPage() {
  const [investmentEUR, setInvestmentEUR] = useState(25000);

  const totalInvestment = EXISTING_INVESTMENT + investmentEUR;
  const baseTokens = investmentEUR / TOKEN_PRICE;
  const bonus15 = baseTokens * BONUS_BASE;
  
  let extraBonus = 0;
  if (totalInvestment > EXTRA_THRESHOLD) {
    const extraAmount = totalInvestment - EXTRA_THRESHOLD;
    extraBonus = (extraAmount / TOKEN_PRICE) * EXTRA_BONUS;
  }
  
  const newTokens = baseTokens + bonus15 + extraBonus;
  const totalTokens = EXISTING_TOKENS + newTokens;
  
  const valueNow = totalTokens * PRICE_NOW;
  const valueTarget = totalTokens * PRICE_TARGET;
  const valueAmbitious = totalTokens * PRICE_AMBITIOUS;
  const valueConservative = totalTokens * PRICE_CONSERVATIVE;
  
  const totalInvested = totalInvestment;
  const roiNow = totalInvested > 0 ? valueNow / totalInvested : 0;
  const roiTarget = totalInvested > 0 ? valueTarget / totalInvested : 0;
  const roiAmbitious = totalInvested > 0 ? valueAmbitious / totalInvested : 0;
  
  const missingToBonus = Math.max(0, EXTRA_THRESHOLD - totalInvestment);
  const bonusUnlocked = totalInvestment >= EXTRA_THRESHOLD;

  const scenarios = [
    { label: "Konservativ", desc: "Solide Entwicklung, niedrige Schwankung.", price: PRICE_CONSERVATIVE, color: "from-blue-500/20 to-blue-600/10", borderColor: "border-blue-500/30" },
    { label: "Realistisch", desc: "Interne Zielsetzung zum Launch.", price: PRICE_TARGET, color: "from-[#FE9100]/20 to-[#FE9100]/10", borderColor: "border-[#FE9100]/50" },
    { label: "Ambitioniert", desc: "Volle Skalierung von ARAS AI in Europa.", price: PRICE_AMBITIOUS, color: "from-emerald-500/20 to-emerald-600/10", borderColor: "border-emerald-500/30" }
  ];

  return (
    <div className="min-h-screen bg-[#020309] text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{backgroundImage: "radial-gradient(circle at 50% 50%, rgba(254,145,0,0.03) 0%, transparent 50%)"}} />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#FE9100] opacity-[0.02] blur-[150px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#E9D7C4] opacity-[0.02] blur-[100px] rounded-full" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-3 sm:px-4 md:px-6 py-8 sm:py-12 md:py-16">
        
        <motion.section initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="mb-12 sm:mb-16 md:mb-20">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-12 items-start">
            <div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="inline-block px-4 py-2 rounded-full mb-6" style={{background: 'rgba(254, 145, 0, 0.1)', border: '1px solid rgba(254, 145, 0, 0.3)'}}>
                <span className="text-xs font-bold text-[#FE9100] uppercase tracking-wider">Private Allocation</span>
              </motion.div>
              <motion.h1 
                className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-black mb-4 sm:mb-6 leading-tight" 
                style={{fontFamily: 'Orbitron, sans-serif'}}
                animate={{
                  backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']
                }}
                transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
              >
                <span style={{
                  background: 'linear-gradient(135deg, #E9D7C4, #FE9100, #FFD700, #FE9100, #E9D7C4)',
                  backgroundSize: '200% 100%',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  Herr Schwab, Ihre Position in ARAS hat sich deutlich vermehrt!
                </span>
              </motion.h1>
              <div className="space-y-2 sm:space-y-3 text-sm sm:text-base md:text-lg text-white/70 mb-4 sm:mb-6">
                <p className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
                  <span className="text-white/50">Sie sind zu</span>
                  <motion.span className="text-xl sm:text-2xl md:text-3xl font-bold text-white" style={{fontFamily: 'Orbitron, sans-serif'}} animate={{textShadow: ['0 0 10px rgba(254,145,0,0.3)', '0 0 20px rgba(254,145,0,0.5)', '0 0 10px rgba(254,145,0,0.3)']}} transition={{duration: 2, repeat: Infinity}}>0,12 EUR</motion.span>
                  <span className="text-white/50">eingestiegen.</span>
                </p>
                <p className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
                  <span className="text-white/50">Heute stehen wir bei</span>
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-[#FE9100]" style={{fontFamily: 'Orbitron, sans-serif'}}>0,57 EUR</span>
                </p>
                <p className="flex items-baseline gap-1.5 sm:gap-2 md:gap-3 flex-wrap">
                  <span className="text-white/50">Nach Launch:</span>
                  <span className="text-xl sm:text-2xl md:text-3xl font-bold text-[#FFD700]" style={{fontFamily: 'Orbitron, sans-serif'}}>1,14 EUR+</span>
                </p>
              </div>
              <div className="mb-4 sm:mb-6 min-h-[32px] sm:min-h-[40px]">
                <TippingText />
              </div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="p-4 rounded-xl" style={{background: 'rgba(254, 145, 0, 0.05)', border: '1px solid rgba(254, 145, 0, 0.2)'}}>
                <p className="text-sm text-white/80">Sie haben bereits <span className="text-[#FE9100] font-bold">{formatEUR(EXISTING_INVESTMENT)}</span> investiert und besitzen <span className="text-white font-bold">{formatToken(EXISTING_TOKENS)} ARAS Token</span>.</p>
                <p className="text-sm text-white/60 mt-2">Aktueller Wert Ihrer Position: <span className="text-[#FE9100] font-bold">{formatEUR(EXISTING_TOKENS * PRICE_NOW)}</span></p>
              </motion.div>
            </div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 relative overflow-hidden" style={{background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(254, 145, 0, 0.2)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'}}>
              <motion.div className="absolute top-0 left-0 right-0 h-[2px]" style={{background: 'linear-gradient(90deg, transparent, #FE9100, #FFD700, #FE9100, transparent)', backgroundSize: '200% 100%'}} animate={{backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']}} transition={{duration: 4, repeat: Infinity, ease: 'linear'}} />
              <h3 className="text-lg md:text-xl font-bold mb-2" style={{fontFamily: 'Orbitron, sans-serif'}}>Private Allocation</h3>
              <p className="text-lg sm:text-xl md:text-3xl font-bold text-white mb-4 sm:mb-6" style={{fontFamily: 'Orbitron, sans-serif'}}>Only for Christian Schwab</p>
              <div className="space-y-4">
                <div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-[#FE9100] mt-1.5 shrink-0" /><p className="text-sm text-white/70">Letzte Direktzuteilung vor dem DEX-Listing</p></div>
                <div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-[#FE9100] mt-1.5 shrink-0" /><p className="text-sm text-white/70"><span className="text-[#FE9100] font-bold">+15 % Bonus-Token</span> auf jede Nachzeichnung</p></div>
                <div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-[#FFD700] mt-1.5 shrink-0" /><p className="text-sm text-white/70"><span className="text-[#FFD700] font-bold">+5-7 % Zusatzbonus</span> ab 125.000 EUR Gesamtinvest</p></div>
                <div className="flex items-start gap-3"><div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0" /><p className="text-sm text-white/70"><span className="text-emerald-400 font-bold">Rueckkaufgarantie 14 Tage</span> - 0% Risiko</p></div>
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Deadline</p>
                <p className="text-lg font-bold text-[#FE9100]" style={{fontFamily: 'Orbitron, sans-serif'}}>Freitag, 12. Dezember 2025</p>
              </div>
            </motion.div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-12 sm:mb-16 md:mb-20">
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-8" style={{background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255, 255, 255, 0.1)'}}>
            <h3 className="text-lg md:text-xl font-bold mb-2" style={{fontFamily: 'Orbitron, sans-serif'}}>Die Preisreise</h3>
            <p className="text-sm text-white/50 mb-8">Vom Einstieg bis zur vollen Skalierung</p>
            <div className="relative">
              {/* Mobile Vertical Line */}
              <motion.div 
                className="absolute top-0 bottom-0 left-1/2 w-[2px] md:hidden rounded-full -translate-x-1/2"
                style={{background: 'linear-gradient(180deg, #E9D7C4, #FE9100, #FFD700, #22c55e)'}}
                animate={{boxShadow: ['0 0 10px rgba(254,145,0,0.3)', '0 0 20px rgba(254,145,0,0.5)', '0 0 10px rgba(254,145,0,0.3)']}}
                transition={{duration: 2, repeat: Infinity}}
              />
              {/* Desktop Horizontal Line */}
              <motion.div 
                className="absolute top-6 left-0 right-0 h-[3px] hidden md:block rounded-full"
                style={{background: 'linear-gradient(90deg, #E9D7C4, #FE9100, #FFD700, #22c55e)'}}
                animate={{boxShadow: ['0 0 10px rgba(254,145,0,0.3)', '0 0 20px rgba(254,145,0,0.5)', '0 0 10px rgba(254,145,0,0.3)']}}
                transition={{duration: 2, repeat: Infinity}}
              />
              
              <div className="flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 md:gap-0">
                <div className="flex flex-col items-center text-center relative z-10 bg-[#020309] md:bg-transparent px-4 py-2 md:p-0">
                  <motion.div animate={{boxShadow: ['0 0 15px rgba(233,215,196,0.3)', '0 0 25px rgba(233,215,196,0.5)', '0 0 15px rgba(233,215,196,0.3)']}} transition={{duration: 2, repeat: Infinity}} className="w-12 h-12 rounded-full bg-[#E9D7C4] flex items-center justify-center mb-4 text-black font-bold text-lg" style={{fontFamily: 'Orbitron, sans-serif'}}>1</motion.div>
                  <p className="text-xs text-white/50 mb-1">Ihr Einstieg</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-white" style={{fontFamily: 'Orbitron, sans-serif'}}>0,12 EUR</p>
                </div>
                <div className="flex flex-col items-center text-center relative z-10 bg-[#020309] md:bg-transparent px-4 py-2 md:p-0">
                  <motion.div animate={{boxShadow: ['0 0 20px rgba(254,145,0,0.4)', '0 0 35px rgba(254,145,0,0.6)', '0 0 20px rgba(254,145,0,0.4)']}} transition={{duration: 2, repeat: Infinity}} className="w-12 h-12 rounded-full bg-[#FE9100] flex items-center justify-center mb-4 text-black font-bold text-lg" style={{fontFamily: 'Orbitron, sans-serif'}}>2</motion.div>
                  <p className="text-xs text-white/50 mb-1">Aktuell</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-[#FE9100]" style={{fontFamily: 'Orbitron, sans-serif'}}>0,57 EUR</p>
                  <div className="mt-2 px-3 py-1 rounded-full bg-[#FE9100]/20 border border-[#FE9100]/30"><span className="text-xs font-bold text-[#FE9100]">4,75x</span></div>
                </div>
                <div className="flex flex-col items-center text-center relative z-10 bg-[#020309] md:bg-transparent px-4 py-2 md:p-0">
                  <motion.div animate={{boxShadow: ['0 0 20px rgba(255,215,0,0.4)', '0 0 35px rgba(255,215,0,0.6)', '0 0 20px rgba(255,215,0,0.4)']}} transition={{duration: 2, repeat: Infinity}} className="w-12 h-12 rounded-full bg-[#FFD700] flex items-center justify-center mb-4 text-black font-bold text-lg" style={{fontFamily: 'Orbitron, sans-serif'}}>3</motion.div>
                  <p className="text-xs text-white/50 mb-1">Zielband Launch</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-[#FFD700]" style={{fontFamily: 'Orbitron, sans-serif'}}>1,14 EUR</p>
                  <div className="mt-2 px-3 py-1 rounded-full bg-[#FFD700]/20 border border-[#FFD700]/30"><span className="text-xs font-bold text-[#FFD700]">9,5x</span></div>
                </div>
                <div className="flex flex-col items-center text-center relative z-10 bg-[#020309] md:bg-transparent px-4 py-2 md:p-0">
                  <motion.div animate={{boxShadow: ['0 0 20px rgba(34,197,94,0.4)', '0 0 35px rgba(34,197,94,0.6)', '0 0 20px rgba(34,197,94,0.4)']}} transition={{duration: 2, repeat: Infinity}} className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center mb-4 text-black font-bold text-lg" style={{fontFamily: 'Orbitron, sans-serif'}}>4</motion.div>
                  <p className="text-xs text-white/50 mb-1">Volle Skalierung</p>
                  <p className="text-lg sm:text-xl md:text-2xl font-bold text-emerald-400" style={{fontFamily: 'Orbitron, sans-serif'}}>2,20 EUR</p>
                  <div className="mt-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30"><span className="text-xs font-bold text-emerald-400">18x</span></div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-12 sm:mb-16 md:mb-20">
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-12" style={{background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(254, 145, 0, 0.2)', boxShadow: '0 20px 60px rgba(254, 145, 0, 0.1)'}}>
            <h2 className="text-lg sm:text-xl md:text-3xl font-bold mb-2" style={{fontFamily: 'Orbitron, sans-serif'}}>Wie viel moechten Sie nachzeichnen?</h2>
            <p className="text-white/60 text-sm md:text-base mb-8">Ihre Gesamtposition wird live berechnet - inklusive aller Boni.</p>
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8 md:gap-12">
              <div>
                <label className="block text-sm font-bold text-white/70 mb-3 uppercase tracking-wider">Zusaetzliches Investment (EUR)</label>
                <input type="number" value={investmentEUR} onChange={(e) => setInvestmentEUR(Number(e.target.value) || 0)} placeholder="z.B. 25.000" className="w-full px-3 sm:px-4 md:px-6 py-3 sm:py-4 rounded-xl text-lg sm:text-xl md:text-2xl font-bold bg-black/40 border border-white/10 focus:border-[#FE9100] focus:outline-none transition-colors" style={{fontFamily: 'Orbitron, sans-serif'}} />
                <p className="text-xs text-white/40 mt-2">Empfohlen: mindestens 25.000 EUR</p>
                
                <div className="mt-6 space-y-3 text-sm text-white/60">
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-white/50" /><span>Preis pro Token: <span className="text-white font-bold">0,12 EUR</span></span></div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FE9100]" /><span><span className="text-[#FE9100] font-bold">+15 % Bonus-Token</span> auf das gesamte Investment</span></div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-[#FFD700]" /><span><span className="text-[#FFD700] font-bold">+5-7 % Zusatzbonus</span> ab 125.000 EUR Gesamtinvest</span></div>
                  <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span><span className="text-emerald-400 font-bold">Rueckkaufgarantie</span> - 0% Risiko, 14 Tage</span></div>
                </div>
                
                {!bonusUnlocked && investmentEUR > 0 && investmentEUR < 25000 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-4 rounded-xl bg-[#FE9100]/10 border border-[#FE9100]/30">
                    <p className="text-sm text-[#FE9100]">Um Ihre Bonusstufe freizuschalten, fehlen Ihnen nur <span className="font-bold">{formatEUR(missingToBonus)}</span>.</p>
                  </motion.div>
                )}
                
                {bonusUnlocked && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="mt-4 p-4 rounded-xl bg-[#FFD700]/10 border border-[#FFD700]/30">
                    <p className="text-sm text-[#FFD700] font-bold">Zusatzbonus aktiviert!</p>
                    <p className="text-xs text-[#FFD700]/80 mt-1">Sie erhalten +5% Bonus auf {formatEUR(totalInvestment - EXTRA_THRESHOLD)} ueber der Schwelle.</p>
                  </motion.div>
                )}
                
                <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Ihre bestehende Position</p>
                  <p className="text-sm text-white/70">Bereits investiert: <span className="text-white font-bold">{formatEUR(EXISTING_INVESTMENT)}</span></p>
                  <p className="text-sm text-white/70">Bestehende Token: <span className="text-white font-bold">{formatToken(EXISTING_TOKENS)} ARAS</span></p>
                </div>
              </div>
              <div className="space-y-4 md:space-y-5">
                <motion.div key={totalTokens} initial={{ scale: 0.98 }} animate={{ scale: 1 }} transition={{ duration: 0.3 }} className="p-4 sm:p-5 md:p-6 rounded-xl" style={{background: 'linear-gradient(135deg, rgba(254,145,0,0.15), rgba(233,215,196,0.05))', border: '1px solid rgba(254, 145, 0, 0.4)'}}>
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Ihre Gesamtposition (nach Nachzeichnung)</p>
                  <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black text-white" style={{fontFamily: 'Orbitron, sans-serif'}}><AnimatedCounter value={totalTokens} suffix=" ARAS" /></p>
                  <p className="text-xs text-white/50 mt-2">Davon neu: +{formatToken(newTokens)} Token (inkl. Boni)</p>
                </motion.div>
                <div className="p-4 md:p-5 rounded-xl bg-black/40 border border-[#FE9100]/30">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Wert bei 0,57 EUR (heute)</p>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#FE9100]" style={{fontFamily: 'Orbitron, sans-serif'}}>{formatEUR(valueNow)}</p>
                  <p className="text-sm text-white/60 mt-2">Multiplikator: <span className="text-[#FE9100] font-bold">{formatMultiplier(roiNow)}</span></p>
                </div>
                <div className="p-4 md:p-5 rounded-xl bg-black/40 border border-[#FFD700]/30">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Wert bei 1,14 EUR (Zielband)</p>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-[#FFD700]" style={{fontFamily: 'Orbitron, sans-serif'}}>{formatEUR(valueTarget)}</p>
                  <p className="text-sm text-white/60 mt-2">Multiplikator: <span className="text-[#FFD700] font-bold">{formatMultiplier(roiTarget)}</span></p>
                </div>
                <div className="p-4 md:p-5 rounded-xl bg-black/40 border border-emerald-500/30">
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-2">Wert bei 2,20 EUR (Ambitioniert)</p>
                  <p className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-emerald-400" style={{fontFamily: 'Orbitron, sans-serif'}}>{formatEUR(valueAmbitious)}</p>
                  <p className="text-sm text-white/60 mt-2">Multiplikator: <span className="text-emerald-400 font-bold">{formatMultiplier(roiAmbitious)}</span></p>
                </div>
              </div>
            </div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="mt-6 sm:mt-8 p-3 sm:p-4 md:p-6 rounded-xl text-center" style={{background: 'linear-gradient(135deg, rgba(254,145,0,0.05), rgba(34,197,94,0.05))', border: '1px solid rgba(254, 145, 0, 0.2)'}}>
              <p className="text-white/80 text-sm md:text-base">Wenn Ihre Position sich nur auf das interne Zielband entwickelt (1,14 EUR), entsteht ein Wert von <span className="text-[#FFD700] font-bold">{formatEUR(valueTarget)}</span> - ein Mehrfaches Ihres gesamten Investments von <span className="text-white font-bold">{formatEUR(totalInvested)}</span>.</p>
            </motion.div>
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-12 sm:mb-16 md:mb-20">
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 text-center" style={{fontFamily: 'Orbitron, sans-serif'}}>Szenarien fuer Ihre Gesamtposition</h3>
          <p className="text-white/50 text-sm text-center mb-8">Basierend auf {formatToken(totalTokens)} ARAS Token</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {scenarios.map((scenario, idx) => {
              const valueScenario = totalTokens * scenario.price;
              const roiScenario = totalInvested > 0 ? valueScenario / totalInvested : 0;
              return (
                <motion.div 
                  key={scenario.label} 
                  initial={{ opacity: 0, y: 20 }} 
                  whileInView={{ opacity: 1, y: 0 }} 
                  viewport={{ once: true }} 
                  transition={{ delay: idx * 0.1 }} 
                  whileHover={{ scale: 1.03, y: -8 }} 
                  className={`p-4 sm:p-5 md:p-6 rounded-xl cursor-pointer transition-all border ${scenario.borderColor}`} 
                  style={{backdropFilter: 'blur(10px)', background: `linear-gradient(135deg, ${scenario.color.replace('from-', '').replace(' to-', ', ')})`}}
                >
                  <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{scenario.label}</p>
                  <p className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2" style={{fontFamily: 'Orbitron, sans-serif'}}>{scenario.price.toFixed(2)} EUR</p>
                  <p className="text-xs text-white/50 mb-4">{scenario.desc}</p>
                  <div className="space-y-2 text-sm border-t border-white/10 pt-4">
                    <p className="text-white/70">Wert Ihrer Position:</p>
                    <p className="text-xl font-bold text-white" style={{fontFamily: 'Orbitron, sans-serif'}}>{formatEUR(valueScenario)}</p>
                    <p className="text-white/70 mt-2">Multiplikator: <span className="text-white font-bold">{formatMultiplier(roiScenario)}</span></p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="mb-8">
          <div className="rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-12 relative overflow-hidden" style={{background: 'rgba(255, 255, 255, 0.02)', backdropFilter: 'blur(20px)', border: '1px solid rgba(233, 215, 196, 0.2)'}}>
            <motion.div className="absolute top-0 left-0 right-0 h-[2px]" style={{background: 'linear-gradient(90deg, #E9D7C4, #FE9100, #FFD700, #FE9100, #E9D7C4)', backgroundSize: '200% 100%'}} animate={{backgroundPosition: ['0% 50%', '100% 50%', '0% 50%']}} transition={{duration: 8, repeat: Infinity, ease: 'linear'}} />
            <motion.div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{background: 'linear-gradient(90deg, #E9D7C4, #FE9100, #FFD700, #FE9100, #E9D7C4)', backgroundSize: '200% 100%'}} animate={{backgroundPosition: ['100% 50%', '0% 50%', '100% 50%']}} transition={{duration: 8, repeat: Infinity, ease: 'linear'}} />
            <div className="max-w-3xl mx-auto">
              <p className="text-sm sm:text-base md:text-lg leading-relaxed text-white/80 mb-4 sm:mb-6">Lieber Herr Schwab,</p>
              <p className="text-sm sm:text-base md:text-lg leading-relaxed text-white/80 mb-4 sm:mb-6">Sie gehoeren zu den ersten Investoren, die ARAS AI ueberhaupt moeglich gemacht haben. Ich danke Ihnen aufrichtig.</p>
              <p className="text-sm sm:text-base md:text-lg leading-relaxed text-white/80 mb-4 sm:mb-6">Wir haben Ihre Zuteilung exklusiv bis <span className="text-[#FE9100] font-bold">Freitag</span> verlaengert - weiterhin zu Ihrem historischen Einstiegspreis von <span className="text-white font-bold">0,12 EUR</span>. Dazu kommt Ihr <span className="text-[#FE9100] font-bold">15%-Circle-Bonus</span> und ein zusaetzlicher Bonus, sobald Ihr Gesamtinvest 125.000 EUR ueberschreitet.</p>
              <p className="text-sm sm:text-base md:text-lg leading-relaxed text-white/80 mb-4 sm:mb-6">Viele Investoren waehlen derzeit bewusst, die Zahlung erst im neuen Geschaeftsjahr zu leisten - die Token werden dennoch <span className="text-emerald-400 font-bold">sofort uebertragen</span>. Keine Sperrfrist, garantierte Zuteilung.</p>
              <p className="text-sm sm:text-base md:text-lg leading-relaxed text-white/80 mb-4 sm:mb-6">Abwicklung, Dokumente, Onboarding - wir uebernehmen alles.</p>
              <div className="p-3 sm:p-4 rounded-xl mb-6 sm:mb-8" style={{background: 'rgba(254, 145, 0, 0.05)', border: '1px solid rgba(254, 145, 0, 0.2)'}}>
                <p className="text-sm text-white/70">Sie haben bereits <span className="text-[#FE9100] font-bold">{formatEUR(EXISTING_INVESTMENT)}</span> in ARAS investiert. Mit nur <span className="text-white font-bold">25.000 EUR</span> zusaetzlicher Zeichnung ueberschreiten Sie die Bonus-Schwelle und erhoehen Ihre Gesamtzahl an Bonus-Token signifikant - bei gleichzeitig <span className="text-emerald-400 font-bold">0% Risiko</span> durch die Rueckkaufgarantie.</p>
              </div>
              <div className="pt-6 border-t border-white/10 text-center">
                <p className="text-white/80 mb-2 text-lg">- Justin Schwarzott</p>
                <p className="text-sm text-white/50">Verwaltungsratspraesident</p>
                <p className="text-sm text-white/50">Schwarzott Capital Partners AG</p>
                <p className="text-sm text-[#FE9100] font-bold mt-2" style={{fontFamily: 'Orbitron, sans-serif'}}>Founder ARAS AI</p>
              </div>
            </div>
          </div>
        </motion.section>

        <style dangerouslySetInnerHTML={{__html: `@keyframes borderRun { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } }`}} />
      </div>
    </div>
  );
}
