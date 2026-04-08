import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';

const CAMPAIGN_ID = 'aras-space-offer-2026-03-calls-15';
const STORAGE_KEY = `aras:offer:${CAMPAIGN_ID}`;
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MIN_DELAY = 30000;
const MAX_DELAY = 50000;

const STYLE_ID = 'aras-offer-css';
const STYLES = `
@keyframes aofSheen {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes aofSweep {
  0% { transform: translateX(-100%); opacity: 0; }
  20% { opacity: 0.7; }
  100% { transform: translateX(200%); opacity: 0; }
}
@keyframes aofPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(254,145,0,0.8); }
  50% { opacity: 0.35; box-shadow: 0 0 4px rgba(254,145,0,0.3); }
}
@keyframes aofGlow {
  0%, 100% { box-shadow: 0 18px 60px rgba(0,0,0,0.4), 0 0 30px rgba(254,145,0,0.04); }
  50% { box-shadow: 0 18px 60px rgba(0,0,0,0.4), 0 0 50px rgba(254,145,0,0.08); }
}
.aof-accept:hover {
  box-shadow: 0 14px 32px rgba(254,145,0,0.28), inset 0 1px 0 rgba(255,255,255,0.12) !important;
  transform: translateY(-1px);
}
.aof-accept:active {
  transform: translateY(0);
  box-shadow: 0 6px 16px rgba(254,145,0,0.18) !important;
}
.aof-ghost:hover {
  border-color: rgba(254,145,0,0.22) !important;
  color: rgba(233,215,196,0.82) !important;
  background: rgba(255,255,255,0.03) !important;
}
`;

if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = STYLES;
  document.head.appendChild(el);
}

interface OfferState {
  seen?: boolean;
  dismissedAt?: number;
  acceptedAt?: number;
  campaignId?: string;
}

function getOfferState(): OfferState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function setOfferState(state: OfferState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, campaignId: CAMPAIGN_ID }));
}

function shouldShowOffer(): boolean {
  const state = getOfferState();
  if (!state) return true;
  if (state.acceptedAt) return false;
  if (state.dismissedAt) {
    return Date.now() - state.dismissedAt > DISMISS_COOLDOWN_MS;
  }
  return true;
}

interface SpaceUpgradeOfferOverlayProps {
  isSpaceVisible?: boolean;
  hasBlockingOverlay?: boolean;
}

export function SpaceUpgradeOfferOverlay({
  isSpaceVisible = true,
  hasBlockingOverlay = false,
}: SpaceUpgradeOfferOverlayProps) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elapsedRef = useRef(0);
  const startTimeRef = useRef(0);
  const firedRef = useRef(false);
  const [, navigate] = useLocation();

  const delay = useRef(
    MIN_DELAY + Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY))
  ).current;

  const startTimer = useCallback(() => {
    if (firedRef.current || timerRef.current) return;
    const remaining = delay - elapsedRef.current;
    if (remaining <= 0) {
      firedRef.current = true;
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
      return;
    }
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      timerRef.current = null;
      setVisible(true);
      requestAnimationFrame(() => setOpen(true));
    }, remaining);
  }, [delay]);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      elapsedRef.current += Date.now() - startTimeRef.current;
    }
  }, []);

  useEffect(() => {
    if (!shouldShowOffer()) return;
    if (firedRef.current) return;
    if (!isSpaceVisible || hasBlockingOverlay) {
      pauseTimer();
      return;
    }

    if (document.visibilityState === 'visible') {
      startTimer();
    }

    const onVisChange = () => {
      if (document.visibilityState === 'visible') {
        startTimer();
      } else {
        pauseTimer();
      }
    };
    document.addEventListener('visibilitychange', onVisChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisChange);
      pauseTimer();
    };
  }, [isSpaceVisible, hasBlockingOverlay, startTimer, pauseTimer]);

  useEffect(() => {
    if (!open) return;
    const timers = [
      setTimeout(() => setPhase(1), 250),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1050),
    ];
    return () => timers.forEach(clearTimeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleAccept = useCallback(() => {
    setOfferState({ seen: true, acceptedAt: Date.now() });
    setOpen(false);
    setTimeout(() => {
      setVisible(false);
      navigate('/app/billing?offer=calls15');
    }, 500);
  }, [navigate]);

  const handleDismiss = useCallback(() => {
    setOfferState({ seen: true, dismissedAt: Date.now() });
    setOpen(false);
    setTimeout(() => setVisible(false), 500);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') handleDismiss();
  }, [handleDismiss]);

  if (!visible) return null;

  const orbitron = 'Orbitron, sans-serif';
  const inter = 'Inter, sans-serif';
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const springCard = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'spring' as const, stiffness: 240, damping: 26, mass: 0.9 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="space-upgrade-offer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="aof-title"
          aria-describedby="aof-desc"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.26 }}
          className="fixed inset-0 z-[9500] flex items-center justify-center"
          style={{ background: '#0a0a0a' }}
        >
          {/* Radial atmosphere */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: [
                'radial-gradient(1200px 500px at 18% 10%, rgba(254,145,0,0.08), transparent 62%)',
                'radial-gradient(800px 400px at 86% 18%, rgba(233,215,196,0.05), transparent 64%)',
                'radial-gradient(600px 300px at 50% 90%, rgba(163,78,0,0.06), transparent 70%)',
              ].join(','),
            }}
          />

          {/* Glass depth */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backdropFilter: 'blur(30px)',
              WebkitBackdropFilter: 'blur(30px)',
              background: 'rgba(0,0,0,0.15)',
            }}
          />

          {/* Noise */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.025]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
            }}
          />

          {/* Card */}
          <motion.div
            initial={{ scale: 0.985, opacity: 0, y: 10 }}
            animate={
              phase >= 1
                ? { scale: 1, opacity: 1, y: 0 }
                : { scale: 0.985, opacity: 0, y: 10 }
            }
            transition={springCard}
            className="relative z-10"
            style={{
              width: 'min(560px, calc(100vw - 48px))',
              maxWidth: '560px',
              animation: phase >= 1 && !prefersReducedMotion ? 'aofGlow 4s ease-in-out infinite' : 'none',
            }}
          >
            {/* Border shimmer */}
            <div
              className="absolute -inset-px rounded-[23px] pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(254,145,0,0.24), rgba(233,215,196,0.06), rgba(254,145,0,0.16))',
                opacity: phase >= 1 ? 0.8 : 0,
                transition: 'opacity 0.5s',
              }}
            />

            {/* Card body */}
            <div
              className="relative rounded-[22px] overflow-hidden"
              style={{
                padding: 'clamp(20px, 4vw, 28px) clamp(18px, 4vw, 28px) clamp(18px, 4vw, 24px)',
                background: 'linear-gradient(135deg, rgba(254,145,0,0.07), rgba(255,255,255,0.014), rgba(255,255,255,0.01))',
                border: '1px solid rgba(254,145,0,0.18)',
              }}
            >
              {/* Top radial */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(500px 200px at 50% -10%, rgba(254,145,0,0.05), transparent 65%)',
                }}
              />

              {/* Light sweep WOW effect */}
              {!prefersReducedMotion && phase >= 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute top-0 left-0 right-0 h-px pointer-events-none overflow-hidden"
                >
                  <div
                    style={{
                      width: '60%',
                      height: '100%',
                      background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.5), rgba(233,215,196,0.3), transparent)',
                      animation: 'aofSweep 3s ease-in-out 0.5s 1 forwards',
                    }}
                  />
                </motion.div>
              )}

              {/* ── HEADER ── */}
              <div className="relative text-center mb-6">
                {/* Eyebrow badge */}
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.3 }}
                  className="inline-flex items-center gap-2.5 px-3 py-[6px] rounded-full mb-5"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(233,215,196,0.16)',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: 'linear-gradient(180deg, #FE9100, #a34e00)',
                      boxShadow: '0 0 12px rgba(254,145,0,0.5)',
                      animation: prefersReducedMotion ? 'none' : 'aofPulse 2s ease-in-out infinite',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: orbitron,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.2em',
                      color: 'rgba(233,215,196,0.92)',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Limited Upgrade Window
                  </span>
                </motion.div>

                {/* Headline */}
                <motion.h1
                  id="aof-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.45, delay: 0.06 }}
                  style={{
                    fontFamily: orbitron,
                    fontWeight: 900,
                    lineHeight: 1.08,
                    letterSpacing: '0.02em',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'clamp(24px, 6vw, 30px)',
                      background: 'linear-gradient(90deg, #E9D7C4, #FE9100, #A34E00, #E9D7C4)',
                      backgroundSize: '300% auto',
                      backgroundClip: 'text',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      animation: prefersReducedMotion ? 'none' : 'aofSheen 6s linear infinite',
                    }}
                  >
                    10.000 Calls mit ARAS AI?
                  </span>
                  <span
                    style={{
                      display: 'block',
                      fontSize: 'clamp(16px, 3.8vw, 20px)',
                      color: '#E9D7C4',
                      letterSpacing: '0.06em',
                      marginTop: 6,
                    }}
                  >
                    Jetzt –15 % auf alle Pläne.
                  </span>
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.12 }}
                  style={{
                    fontFamily: orbitron,
                    fontSize: 'clamp(9px, 2.2vw, 10.5px)',
                    fontWeight: 600,
                    letterSpacing: '0.16em',
                    color: 'rgba(254,145,0,0.7)',
                    textTransform: 'uppercase' as const,
                    marginTop: 10,
                  }}
                >
                  Preis sichern bis 01.04.2026
                </motion.p>

                {/* Divider */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
                  transition={{ duration: prefersReducedMotion ? 0.01 : 0.5, delay: 0.18 }}
                  className="mx-auto mt-5 mb-5"
                  style={{
                    width: 48,
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.4), transparent)',
                  }}
                />
              </div>

              {/* ── BODY COPY ── */}
              <motion.p
                id="aof-desc"
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.35, delay: 0.2 }}
                className="relative text-center mb-5"
                style={{
                  fontFamily: inter,
                  fontSize: 'clamp(14px, 3.5vw, 15px)',
                  lineHeight: 1.55,
                  color: 'rgba(233,215,196,0.78)',
                  maxWidth: 440,
                  margin: '0 auto',
                  marginBottom: 20,
                }}
              >
                Skaliere deine Outbound-Prozesse mit bis zu 10.000 Calls und sichere
                dir jetzt für kurze Zeit 15&nbsp;% auf alle verfügbaren Pläne.
                <br />
                <span style={{ color: 'rgba(233,215,196,0.52)', fontSize: '0.9em' }}>
                  Das Angebot ist direkt in deinem Billing-Bereich hinterlegt.
                </span>
              </motion.p>

              {/* ── BENEFIT CHIPS ── */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                transition={{ duration: 0.3, delay: 0.26 }}
                className="flex flex-wrap items-center justify-center gap-2 mb-7"
              >
                {['Mehr Reichweite', 'Mehr Gesprächsvolumen', 'Sofort im Billing verfügbar'].map(
                  (chip, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center px-3 py-[5px] rounded-full"
                      style={{
                        fontFamily: inter,
                        fontSize: 11,
                        fontWeight: 500,
                        color: 'rgba(233,215,196,0.65)',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(233,215,196,0.08)',
                      }}
                    >
                      {chip}
                    </span>
                  )
                )}
              </motion.div>

              {/* ── BUTTONS ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.01 }
                    : { type: 'spring', stiffness: 220, damping: 22 }
                }
                className="relative flex flex-col sm:flex-row items-stretch gap-[10px]"
              >
                {/* Accept */}
                <motion.button
                  whileHover={prefersReducedMotion ? {} : { scale: 1.02 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.975 }}
                  onClick={handleAccept}
                  className="aof-accept flex-1 group relative overflow-hidden rounded-[14px] cursor-pointer"
                  style={{
                    fontFamily: inter,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    minHeight: 44,
                    padding: '12px 18px',
                    background: 'linear-gradient(135deg, #FE9100, #A34E00)',
                    color: '#fffaf5',
                    boxShadow: '0 10px 24px rgba(254,145,0,0.20)',
                    border: 'none',
                    transition: 'box-shadow 0.3s, transform 0.2s',
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[14px]"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 55%)',
                    }}
                  />
                  <span className="relative z-10">Angebot sichern</span>
                </motion.button>

                {/* Dismiss */}
                <motion.button
                  whileHover={prefersReducedMotion ? {} : { scale: 1.01 }}
                  whileTap={prefersReducedMotion ? {} : { scale: 0.975 }}
                  onClick={handleDismiss}
                  className="aof-ghost flex-1 rounded-[14px] cursor-pointer"
                  style={{
                    fontFamily: inter,
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                    minHeight: 44,
                    padding: '12px 18px',
                    color: 'rgba(233,215,196,0.65)',
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(233,215,196,0.12)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  Später ansehen
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
