/**
 * CoachTour - Guided Dashboard Tour
 * Non-destructive spotlight overlay with keyboard navigation
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'aras.dashboard.tour.completed';

// Tour step definitions
const TOUR_STEPS = [
  {
    target: 'mc-command-hint',
    title: 'Command Palette',
    description: 'Cmd/Ctrl+K öffnet dein Kontrollzentrum — schneller als Menüs. Navigiere, suche, fokussiere direkt per Tastatur.',
  },
  {
    target: 'mc-header',
    title: 'Mission Control',
    description: 'Dein zentrales Dashboard für alle ARAS-Aktivitäten. Hier siehst du auf einen Blick, was passiert ist und was als Nächstes ansteht.',
  },
  {
    target: 'mc-kpis',
    title: 'Aktivitäts-Übersicht',
    description: 'Calls heute, letzte 7 Tage und ausstehende Zusammenfassungen. So behältst du den Überblick über deine Kommunikation.',
  },
  {
    target: 'mc-inbox-tabs',
    title: 'Smart Inbox',
    description: 'So priorisiert ARAS deine Arbeit: Aktionen, laufende Verarbeitungen, Fehler und reine Infos — klar getrennt für schnelles Handeln.',
  },
  {
    target: 'mc-inbox-actions',
    title: 'Batch-Aktionen',
    description: 'Mit einem Klick: Aufgaben erstellen, alle Items durchgehen oder Fehlgeschlagenes prüfen. Effizient arbeiten ohne Einzelklicks.',
  },
  {
    target: 'mc-inbox-list',
    title: 'Inbox Liste',
    description: 'Deine Anrufe und Space-Chats, gefiltert nach Kategorie. Klicke auf einen Eintrag für Details im Cinematic Drawer.',
  },
  {
    target: 'mc-contact-radar',
    title: 'Contact Radar',
    description: 'Hier priorisiert ARAS Kontakte nach offenen Aufgaben, Fehlern und Next Steps. Dein Mini-CRM für schnelle Entscheidungen.',
  },
  {
    target: 'mc-focus',
    title: 'Fokus-Modus',
    description: 'Fokus filtert Inbox, Feed und Aufgaben auf genau diesen Kontakt. So arbeitest du konzentriert an einem Thema.',
  },
  {
    target: 'mc-today-os',
    title: 'Today OS',
    description: 'Hier siehst du deinen Tag als Arbeitsfluss — nur echte Zeiten. Ohne Zeit bleibt ohne Zeit.',
  },
  {
    target: 'mc-snapshot',
    title: 'Business Snapshot',
    description: 'Zeigt die Vollständigkeit deines Profils. Je mehr Infos du hinterlegst, desto besser kann ARAS für dich arbeiten.',
  },
  {
    target: 'mc-ops',
    title: 'Operations',
    description: 'Hier bündeln wir Handlungsschritte. Aufgaben entstehen automatisch aus deinen Anruf-Zusammenfassungen.',
  },
  {
    target: 'mc-calendar',
    title: 'Kalender-Vorschau',
    description: 'Die nächsten 7 Tage deines verbundenen Kalenders. Schneller Überblick ohne die Seite zu wechseln.',
  },
  {
    target: 'mc-matrix',
    title: 'System Status',
    description: 'Technische Übersicht: Datenquellen, Systemstatus und Inventar. Im Matrix-Terminal-Stil für schnelles Scannen.',
  },
];

interface CoachTourProps {
  onComplete?: () => void;
  autoStart?: boolean;
}

export function CoachTour({ onComplete, autoStart = false }: CoachTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Check if tour was completed
  useEffect(() => {
    const completed = localStorage.getItem(STORAGE_KEY) === '1';
    if (!completed && autoStart) {
      // Delay start to ensure DOM is ready
      const timer = setTimeout(() => setIsActive(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [autoStart]);

  // Listen for external start trigger
  useEffect(() => {
    const handleStart = () => {
      setCurrentStep(0);
      setIsActive(true);
    };
    window.addEventListener('aras:start-tour', handleStart);
    return () => window.removeEventListener('aras:start-tour', handleStart);
  }, []);

  // Update target element position
  const updateTargetRect = useCallback(() => {
    if (!isActive) return;
    
    const step = TOUR_STEPS[currentStep];
    if (!step) return;

    const element = document.querySelector(`[data-tour="${step.target}"]`);
    if (element) {
      const rect = element.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isActive, currentStep]);

  useEffect(() => {
    updateTargetRect();
    window.addEventListener('resize', updateTargetRect);
    window.addEventListener('scroll', updateTargetRect, true);
    return () => {
      window.removeEventListener('resize', updateTargetRect);
      window.removeEventListener('scroll', updateTargetRect, true);
    };
  }, [updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          handleClose();
          break;
        case 'Enter':
        case ' ':
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          handlePrev();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep]);

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setIsActive(false);
    setCurrentStep(0);
  };

  const handleComplete = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setIsActive(false);
    setCurrentStep(0);
    onComplete?.();
  };

  const step = TOUR_STEPS[currentStep];
  const padding = 8;

  return (
    <AnimatePresence>
      {isActive && step && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999]"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard Tour"
        >
          {/* Dark overlay with spotlight cutout */}
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <rect
                    x={targetRect.left - padding}
                    y={targetRect.top - padding}
                    width={targetRect.width + padding * 2}
                    height={targetRect.height + padding * 2}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.85)"
              mask="url(#spotlight-mask)"
            />
          </svg>

          {/* Spotlight border glow */}
          {targetRect && (
            <div
              className="absolute pointer-events-none rounded-xl"
              style={{
                left: targetRect.left - padding,
                top: targetRect.top - padding,
                width: targetRect.width + padding * 2,
                height: targetRect.height + padding * 2,
                border: '2px solid rgba(255,106,0,0.6)',
                boxShadow: '0 0 0 1px rgba(255,106,0,0.3), 0 0 30px rgba(255,106,0,0.2)',
              }}
            />
          )}

          {/* Tooltip card */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute max-w-sm w-full mx-4"
            style={{
              left: targetRect 
                ? Math.min(Math.max(targetRect.left, 16), window.innerWidth - 400)
                : '50%',
              top: targetRect
                ? targetRect.bottom + padding + 16
                : '50%',
              transform: targetRect ? 'none' : 'translate(-50%, -50%)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div
              className="rounded-2xl p-5 relative"
              style={{
                background: 'rgba(18,18,18,0.98)',
                backdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,106,0,0.3)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
              }}
            >
              {/* Step indicator */}
              <div className="flex items-center gap-1 mb-3">
                {TOUR_STEPS.map((_, idx) => (
                  <div
                    key={idx}
                    className="h-1 rounded-full transition-all"
                    style={{
                      width: idx === currentStep ? '20px' : '8px',
                      background: idx === currentStep 
                        ? '#ff6a00' 
                        : idx < currentStep 
                          ? 'rgba(255,106,0,0.4)' 
                          : 'rgba(255,255,255,0.15)',
                    }}
                  />
                ))}
              </div>

              {/* Content */}
              <h4 
                className="text-base font-bold mb-2"
                style={{ color: '#e9d7c4' }}
              >
                {step.title}
              </h4>
              <p className="text-[13px] text-neutral-400 leading-relaxed mb-4">
                {step.description}
              </p>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {currentStep > 0 && (
                    <button
                      onClick={handlePrev}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/[0.06]"
                      style={{ color: 'rgba(255,255,255,0.5)' }}
                    >
                      Zurück
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClose}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:bg-white/[0.06]"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Schließen
                  </button>
                  <button
                    onClick={handleNext}
                    className="text-[12px] font-semibold px-4 py-1.5 rounded-lg transition-all hover:translate-y-[-1px]"
                    style={{
                      background: 'linear-gradient(135deg, #ff6a00, #a34e00)',
                      color: '#000',
                    }}
                  >
                    {currentStep === TOUR_STEPS.length - 1 ? 'Fertig' : 'Weiter'}
                  </button>
                </div>
              </div>

              {/* Keyboard hint */}
              <p className="text-[10px] text-neutral-600 mt-3 text-center">
                ESC zum Schließen, Enter/Pfeiltasten zur Navigation
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Helper to start tour programmatically
export function startDashboardTour() {
  window.dispatchEvent(new CustomEvent('aras:start-tour'));
}

// Check if tour was completed
export function isTourCompleted(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem(STORAGE_KEY) === '1';
}

// Reset tour completion (for testing)
export function resetTourCompletion() {
  localStorage.removeItem(STORAGE_KEY);
}

export default CoachTour;
