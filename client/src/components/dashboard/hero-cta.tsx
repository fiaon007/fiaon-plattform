/**
 * ARAS Mission Control - Hero CTA Panel
 * "Vertrieb starten?" - Main action panel
 * Premium ARAS CI design with glow effects
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Rocket, ChevronRight, Settings, Zap } from 'lucide-react';

const DT = {
  orange: '#ff6a00',
  gold: '#e9d7c4',
};

interface HeroCtaProps {
  onOpenSetup?: () => void;
}

export function HeroCta({ onOpenSetup }: HeroCtaProps) {
  const handleStartCampaign = () => {
    window.location.href = '/app/campaigns';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,106,0,0.12) 0%, rgba(0,0,0,0.6) 50%, rgba(233,215,196,0.08) 100%)',
        border: '1px solid rgba(255,106,0,0.2)',
      }}
    >
      {/* Animated glow background */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${DT.orange}30 0%, transparent 60%)`,
          animation: 'pulse 4s ease-in-out infinite',
        }}
      />
      
      {/* Content */}
      <div className="relative z-10 p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left: Text */}
          <div className="flex-1">
            {/* Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium uppercase tracking-wider mb-4"
              style={{ background: `${DT.orange}20`, color: DT.orange }}
            >
              <Zap size={10} />
              KI-gesteuerte Vertriebsautomation
            </div>

            {/* Title */}
            <h2 
              className="text-2xl sm:text-3xl lg:text-4xl font-black font-['Orbitron'] tracking-wide mb-3"
              style={{
                background: `linear-gradient(90deg, ${DT.orange}, #ffb15a, ${DT.gold})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Vertrieb starten?
            </h2>

            {/* Subline */}
            <p className="text-base sm:text-lg text-white/70 max-w-xl leading-relaxed">
              Starte jetzt mit nur <span className="font-bold text-white">1 Klick</span>{' '}
              <span style={{ color: DT.orange }} className="font-bold">10.000 Anrufe</span>{' '}
              <span className="uppercase font-bold text-white">GLEICHZEITIG!</span>
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex flex-col sm:flex-row gap-3 lg:flex-col xl:flex-row">
            {/* Primary CTA */}
            <motion.button
              onClick={handleStartCampaign}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group relative px-6 py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-2 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${DT.orange}, #ff8533)`,
                boxShadow: `0 0 30px ${DT.orange}40, 0 4px 20px rgba(0,0,0,0.3)`,
              }}
            >
              {/* Shine effect */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{
                  background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)',
                  transform: 'translateX(-100%)',
                  animation: 'shine 1.5s ease-in-out infinite',
                }}
              />
              <Rocket size={18} className="relative z-10" />
              <span className="relative z-10">Kampagnen öffnen</span>
              <ChevronRight size={18} className="relative z-10 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            {/* Secondary CTA */}
            {onOpenSetup && (
              <button
                onClick={onOpenSetup}
                className="px-5 py-3 rounded-xl text-sm font-medium transition-all hover:bg-white/10 flex items-center justify-center gap-2"
                style={{ 
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.7)',
                }}
              >
                <Settings size={14} />
                Setup prüfen
              </button>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex flex-wrap gap-6 mt-6 pt-6 border-t border-white/10">
          <div>
            <p className="text-2xl font-bold" style={{ color: DT.orange }}>∞</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Parallele Calls</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-white">24/7</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">KI-Verfügbarkeit</p>
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ color: DT.gold }}>90%</p>
            <p className="text-[10px] text-white/40 uppercase tracking-wider">Zeitersparnis</p>
          </div>
        </div>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes shine {
          0% { transform: translateX(-100%); }
          50%, 100% { transform: translateX(100%); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </motion.div>
  );
}

export default HeroCta;
