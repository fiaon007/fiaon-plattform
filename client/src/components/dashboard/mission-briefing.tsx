/**
 * MissionBriefing - Dashboard Onboarding Component
 * Explains Mission Control on first visit, dismissible
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'aras.dashboard.briefing.dismissed';

interface MissionBriefingProps {
  onStartTour?: () => void;
}

export function MissionBriefing({ onStartTour }: MissionBriefingProps) {
  const [isDismissed, setIsDismissed] = useState(true); // Start hidden to prevent flash

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === '1';
    setIsDismissed(dismissed);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setIsDismissed(true);
  };

  const handleStartTour = () => {
    handleDismiss();
    onStartTour?.();
  };

  // Allow reopening via window event
  useEffect(() => {
    const handleShow = () => setIsDismissed(false);
    window.addEventListener('aras:show-briefing', handleShow);
    return () => window.removeEventListener('aras:show-briefing', handleShow);
  }, []);

  return (
    <AnimatePresence>
      {!isDismissed && (
        <motion.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          className="mb-4 overflow-hidden"
        >
          <div 
            className="rounded-2xl p-5 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(255,106,0,0.08) 0%, rgba(233,215,196,0.04) 100%)',
              border: '1px solid rgba(255,106,0,0.2)',
            }}
          >
            {/* Subtle gradient overlay */}
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'radial-gradient(ellipse at 0% 0%, rgba(255,106,0,0.1) 0%, transparent 50%)',
              }}
            />

            <div className="relative z-10">
              {/* Title */}
              <h3 
                className="text-sm font-bold mb-3"
                style={{ color: '#e9d7c4' }}
              >
                So nutzt du Mission Control
              </h3>

              {/* Explanation */}
              <div className="space-y-2 mb-4">
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  <span className="text-neutral-300 font-medium">Inbox</span> zeigt dir Aktionen, laufende Summaries und Fehler — ohne Raten.
                </p>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  <span className="text-neutral-300 font-medium">Contact Radar</span> zeigt dir, wen du als Nächstes bewegen solltest — Fokus macht daraus einen Arbeitsmodus.
                </p>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  <span className="text-neutral-300 font-medium">Today OS</span> bündelt Termine, Aktionen und fällige Aufgaben in einer Timeline — ohne Rätselraten.
                </p>
                <p className="text-[13px] text-neutral-400 leading-relaxed">
                  Wenn irgendwo <span className="text-neutral-500 font-mono">—</span> steht, fehlen Daten oder es ist noch nichts passiert.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                {onStartTour && (
                  <button
                    onClick={handleStartTour}
                    className="text-[12px] font-semibold px-4 py-2 rounded-lg transition-all hover:translate-y-[-1px]"
                    style={{
                      background: 'linear-gradient(135deg, #ff6a00, #a34e00)',
                      color: '#000',
                      boxShadow: '0 4px 16px rgba(255,106,0,0.2)',
                    }}
                  >
                    Tour starten
                  </button>
                )}
                <button
                  onClick={handleDismiss}
                  className="text-[12px] font-medium px-4 py-2 rounded-lg transition-colors hover:bg-white/[0.06]"
                  style={{
                    color: 'rgba(255,255,255,0.5)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  Ausblenden
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper to show briefing programmatically
export function showMissionBriefing() {
  window.dispatchEvent(new CustomEvent('aras:show-briefing'));
}

export default MissionBriefing;
