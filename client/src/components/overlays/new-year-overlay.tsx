/**
 * NewYearOverlay - Happy New Year 2026
 * Global overlay shown once per user within date window (Jan 1-7, 2026)
 * Premium ARAS style: glass, gradient, particles, typing, tilt
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ═══════════════════════════════════════════════════════════════
// CSS KEYFRAMES (injected once)
// ═══════════════════════════════════════════════════════════════
const nyCSS = `
@keyframes ny_sheen {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes ny_particle {
  0% { transform: translateY(0) scale(1); opacity: 0.6; }
  50% { opacity: 1; }
  100% { transform: translateY(-120px) scale(0.5); opacity: 0; }
}
@keyframes ny_typing {
  from { width: 0; }
  to { width: 100%; }
}
@keyframes ny_blink {
  50% { border-color: transparent; }
}
@keyframes ny_border_glow {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes ny_sheen { 0%, 100% { background-position: 0 center; } }
  @keyframes ny_particle { 0%, 100% { transform: none; opacity: 0.4; } }
  @keyframes ny_typing { from, to { width: 100%; } }
  .ny-particle { animation: none !important; opacity: 0.3; }
  .ny-tilt-container { transform: none !important; }
}
`;

if (typeof document !== 'undefined' && !document.getElementById('aras-ny-css')) {
  const style = document.createElement('style');
  style.id = 'aras-ny-css';
  style.textContent = nyCSS;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════
const DATE_WINDOW_START = new Date('2026-01-01T00:00:00');
const DATE_WINDOW_END = new Date('2026-01-07T23:59:59');
const STORAGE_KEY_PREFIX = 'aras:newyear:2026:dismissed:';

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════
const isWithinDateWindow = (): boolean => {
  const now = new Date();
  return now >= DATE_WINDOW_START && now <= DATE_WINDOW_END;
};

const isDismissed = (userId: string): boolean => {
  if (typeof localStorage === 'undefined') return false;
  return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`) === 'true';
};

const setDismissed = (userId: string): void => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, 'true');
};

const getQueryParam = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
};

// ═══════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════
interface NewYearOverlayProps {
  userId?: string;
}

export function NewYearOverlay({ userId }: NewYearOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Check reduced motion preference
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Determine if overlay should show
  useEffect(() => {
    if (!userId) return;
    
    const forceShow = getQueryParam('newyear') === '1';
    const withinWindow = isWithinDateWindow();
    const alreadyDismissed = isDismissed(userId);
    
    const show = forceShow || (withinWindow && !alreadyDismissed);
    
    if (show) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setShouldRender(true);
      // Small delay for mount animation
      requestAnimationFrame(() => {
        setIsOpen(true);
      });
    }
  }, [userId]);

  // Handle close
  const handleClose = useCallback(() => {
    setIsOpen(false);
    // After animation, persist dismissal and cleanup
    setTimeout(() => {
      if (userId) {
        setDismissed(userId);
      }
      setShouldRender(false);
      // Return focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }, 300);
  }, [userId]);

  // ESC key handler
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Focus trap
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    buttonRef.current.focus();
  }, [isOpen]);

  // Mouse tilt effect (desktop only, respects reduced motion)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (prefersReducedMotion) return;
    
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const deltaX = (e.clientX - centerX) / rect.width;
    const deltaY = (e.clientY - centerY) / rect.height;
    
    setTilt({
      x: deltaY * 5, // max 5 degrees
      y: -deltaX * 5,
    });
  }, [prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 });
  }, []);

  if (!shouldRender) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ny-headline"
          onClick={handleClose}
        >
          {/* Backdrop: radial vignette + blur + noise */}
          <div 
            className="absolute inset-0"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.95) 100%)',
              backdropFilter: 'blur(16px)',
            }}
          />
          
          {/* Noise layer */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Particles (CSS-only, light) */}
          {!prefersReducedMotion && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="ny-particle absolute rounded-full"
                  style={{
                    width: `${3 + (i % 3) * 2}px`,
                    height: `${3 + (i % 3) * 2}px`,
                    left: `${10 + (i * 7) % 80}%`,
                    bottom: `${-10 - (i * 5) % 20}%`,
                    background: i % 2 === 0 
                      ? 'rgba(255,106,0,0.7)' 
                      : 'rgba(233,215,196,0.6)',
                    boxShadow: i % 2 === 0 
                      ? '0 0 8px rgba(255,106,0,0.5)' 
                      : '0 0 6px rgba(233,215,196,0.4)',
                    animation: `ny_particle ${6 + (i % 4) * 2}s ease-in-out infinite`,
                    animationDelay: `${(i * 0.5) % 3}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Main Card */}
          <motion.div
            ref={overlayRef}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            className="ny-tilt-container relative max-w-lg w-full"
            style={{
              transform: prefersReducedMotion 
                ? 'none' 
                : `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: 'transform 0.1s ease-out',
            }}
            onClick={e => e.stopPropagation()}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Animated gradient border */}
            <div 
              className="absolute -inset-[1px] rounded-[20px] opacity-80"
              style={{
                background: 'linear-gradient(135deg, #ff6a00, #e9d7c4, #ff6a00, #e9d7c4)',
                backgroundSize: '300% 300%',
                animation: prefersReducedMotion ? 'none' : 'ny_border_glow 3s ease-in-out infinite',
              }}
            />
            
            {/* Glass panel */}
            <div 
              className="relative rounded-[20px] p-8 sm:p-10 text-center"
              style={{
                background: 'linear-gradient(180deg, rgba(20,20,20,0.95) 0%, rgba(12,12,12,0.98) 100%)',
                backdropFilter: 'blur(20px)',
              }}
            >
              {/* Top accent line with sheen */}
              <div 
                className="absolute top-0 left-8 right-8 h-[2px] rounded-full overflow-hidden"
                style={{ 
                  background: 'linear-gradient(90deg, transparent, #ff6a00, #e9d7c4, #ff6a00, transparent)',
                }}
              />

              {/* Headline with gradient + sheen */}
              <h1 
                id="ny-headline"
                className="text-3xl sm:text-4xl font-black tracking-wider mb-4"
                style={{
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(90deg, #ff6a00, #ffb15a, #e9d7c4, #ffb15a, #ff6a00)',
                  backgroundSize: '200% auto',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  animation: prefersReducedMotion ? 'none' : 'ny_sheen 4s linear infinite',
                }}
              >
                HAPPY NEW YEAR 2026
              </h1>

              {/* Subline with typing effect */}
              <div className="relative inline-block mb-6">
                <p 
                  className="text-lg sm:text-xl text-white/90 font-medium overflow-hidden whitespace-nowrap"
                  style={{
                    animation: prefersReducedMotion ? 'none' : 'ny_typing 2s steps(40) forwards',
                    borderRight: prefersReducedMotion ? 'none' : '2px solid rgba(255,106,0,0.6)',
                    animationDelay: '0.5s',
                    width: prefersReducedMotion ? '100%' : '0',
                  }}
                >
                  wünscht euch das gesamte ARAS AI Team
                </p>
              </div>

              {/* Optional tiny line */}
              <p className="text-sm text-white/50 mb-8">
                Danke für euer Vertrauen. 2026 wird groß.
              </p>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  ref={buttonRef}
                  onClick={handleClose}
                  className="px-8 py-3 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: 'linear-gradient(135deg, #ff6a00, #a34e00)',
                    color: '#000',
                    boxShadow: '0 4px 20px rgba(255,106,0,0.3)',
                  }}
                >
                  Weiter
                </button>
                <button
                  onClick={handleClose}
                  className="px-6 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-white/70 transition-colors"
                >
                  Nicht mehr anzeigen
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
