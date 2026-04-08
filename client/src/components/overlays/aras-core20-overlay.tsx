import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STYLE_ID = 'aras-core20-css';
const STYLES = `
@keyframes a20Sheen {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}
@keyframes a20Glow {
  0%, 100% {
    box-shadow: 0 0 30px rgba(254,145,0,0.05), 0 0 60px rgba(254,145,0,0.025), 0 18px 60px rgba(0,0,0,0.4);
  }
  50% {
    box-shadow: 0 0 50px rgba(254,145,0,0.1), 0 0 100px rgba(254,145,0,0.04), 0 18px 60px rgba(0,0,0,0.4);
  }
}
@keyframes a20Pulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 8px rgba(254,145,0,0.9); }
  50% { opacity: 0.3; box-shadow: 0 0 3px rgba(254,145,0,0.3); }
}
@keyframes a20Border {
  0%, 100% { opacity: 0.14; }
  50% { opacity: 0.34; }
}
.a20-accept:hover {
  box-shadow: 0 8px 40px rgba(254,145,0,0.45), inset 0 1px 0 rgba(255,255,255,0.15) !important;
}
.a20-ghost:hover {
  border-color: rgba(254,145,0,0.28) !important;
  color: rgba(233,215,196,0.7) !important;
}
`;

if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = STYLES;
  document.head.appendChild(el);
}

const STORAGE_PREFIX = 'aras:core20pro:';

interface ArasCore20OverlayProps {
  userId?: string;
  onDecision?: (accepted: boolean) => void;
}

export function ArasCore20Overlay({ userId, onDecision }: ArasCore20OverlayProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const key = STORAGE_PREFIX + userId;
    if (localStorage.getItem(key)) return;
    setVisible(true);
    requestAnimationFrame(() => setOpen(true));
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const timers = [
      setTimeout(() => setPhase(1), 350),
      setTimeout(() => setPhase(2), 750),
      setTimeout(() => setPhase(3), 1250),
    ];
    return () => timers.forEach(clearTimeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const handleDecision = useCallback((accepted: boolean) => {
    if (userId) {
      localStorage.setItem(STORAGE_PREFIX + userId, accepted ? 'accepted' : 'declined');
    }
    onDecision?.(accepted);
    setOpen(false);
    setTimeout(() => setVisible(false), 650);
  }, [userId, onDecision]);

  if (!visible) return null;

  const orbitron = 'Orbitron, sans-serif';
  const inter = 'Inter, sans-serif';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="aras-core20-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="fixed inset-0 z-[10000] flex items-center justify-center"
          style={{ background: '#0a0a0a' }}
        >
          {/* Radial gradient atmosphere */}
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

          {/* Backdrop blur depth */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)' }}
          />

          {/* Noise texture */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.028]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
            }}
          />

          {/* Center card */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 10 }}
            animate={
              phase >= 1
                ? { scale: 1, opacity: 1, y: 0 }
                : { scale: 0.96, opacity: 0, y: 10 }
            }
            transition={{ type: 'spring', stiffness: 240, damping: 26, mass: 0.9 }}
            className="relative w-[92%] max-w-[520px] z-10"
            style={{
              animation: phase >= 1 ? 'a20Glow 4s ease-in-out infinite' : 'none',
            }}
          >
            {/* Animated border glow */}
            <div
              className="absolute -inset-px rounded-[21px] pointer-events-none"
              style={{
                background: 'linear-gradient(135deg, rgba(254,145,0,0.28), rgba(233,215,196,0.08), rgba(254,145,0,0.18))',
                animation: 'a20Border 3s ease-in-out infinite',
              }}
            />

            {/* Card body */}
            <div
              className="relative rounded-[20px] px-6 py-7 sm:px-8 sm:py-8 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, rgba(254,145,0,0.07), rgba(255,255,255,0.008))',
                border: '1px solid rgba(254,145,0,0.18)',
              }}
            >
              {/* Top radial highlight */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(450px 200px at 50% -5%, rgba(254,145,0,0.055), transparent 70%)',
                }}
              />

              {/* ── HEADER ── */}
              <div className="relative text-center mb-7">
                {/* System Update badge with live dot */}
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.35, ease: 'easeOut' }}
                  className="inline-flex items-center gap-2.5 px-4 py-[7px] rounded-full mb-6"
                  style={{
                    background: 'rgba(255,255,255,0.018)',
                    border: '1px solid rgba(233,215,196,0.1)',
                  }}
                >
                  <div
                    className="w-[5px] h-[5px] rounded-full flex-shrink-0"
                    style={{
                      background: '#FE9100',
                      animation: 'a20Pulse 2s ease-in-out infinite',
                    }}
                  />
                  <span
                    style={{
                      fontFamily: orbitron,
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: '0.22em',
                      color: '#E9D7C4',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    System Update
                  </span>
                </motion.div>

                {/* Headline with gradient sheen */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                  transition={{ duration: 0.5, delay: 0.08, ease: 'easeOut' }}
                  style={{
                    fontFamily: orbitron,
                    fontWeight: 900,
                    fontSize: 'clamp(21px, 5.5vw, 28px)',
                    lineHeight: 1.15,
                    letterSpacing: '0.03em',
                    background: 'linear-gradient(90deg, #e9d7c4 0%, #FE9100 30%, #a34e00 55%, #FE9100 75%, #e9d7c4 100%)',
                    backgroundSize: '200% auto',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: phase >= 2 ? 'a20Sheen 5s linear infinite' : 'none',
                    marginBottom: 18,
                  }}
                >
                  ARAS Core 2.0 PRO
                  <br />
                  <span style={{ fontSize: '0.68em', letterSpacing: '0.1em' }}>
                    is now online
                  </span>
                </motion.h1>

                {/* Divider line */}
                <motion.div
                  initial={{ scaleX: 0 }}
                  animate={phase >= 2 ? { scaleX: 1 } : { scaleX: 0 }}
                  transition={{ duration: 0.55, delay: 0.15, ease: 'easeOut' }}
                  className="mx-auto mb-5"
                  style={{
                    width: 56,
                    height: 1,
                    background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.45), transparent)',
                  }}
                />

                {/* Subtext lines */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
                  transition={{ duration: 0.45, delay: 0.22 }}
                  className="space-y-[5px]"
                >
                  {[
                    'Mehr Echtheit der Stimme.',
                    'Natürlicherer Gesprächsfluss.',
                    'Tiefere kontextuelle Intelligenz.',
                  ].map((line, i) => (
                    <motion.p
                      key={i}
                      initial={{ opacity: 0, x: -6 }}
                      animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: -6 }}
                      transition={{ duration: 0.35, delay: 0.26 + i * 0.1, ease: 'easeOut' }}
                      style={{
                        fontFamily: inter,
                        fontSize: 13,
                        lineHeight: '1.65',
                        color: 'rgba(233,215,196,0.62)',
                      }}
                    >
                      {line}
                    </motion.p>
                  ))}
                </motion.div>
              </div>

              {/* ── MEMORY SECTION ── */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={{ duration: 0.45, delay: 0.3, ease: 'easeOut' }}
                className="relative rounded-[14px] mb-7"
                style={{
                  padding: 'clamp(16px, 4vw, 24px)',
                  background: 'rgba(255,255,255,0.018)',
                  border: '1px solid rgba(233,215,196,0.1)',
                }}
              >
                {/* Inner glow */}
                <div
                  className="absolute inset-0 rounded-[14px] pointer-events-none"
                  style={{
                    background: 'radial-gradient(280px 130px at 50% 15%, rgba(254,145,0,0.035), transparent 65%)',
                  }}
                />

                <div className="relative flex items-center gap-3 mb-3">
                  {/* Brain icon box */}
                  <div
                    className="w-8 h-8 rounded-[10px] flex items-center justify-center flex-shrink-0"
                    style={{
                      background: 'rgba(254,145,0,0.07)',
                      border: '1px solid rgba(254,145,0,0.18)',
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#FE9100"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 2c1.1 0 2 .9 2 2v0a2 2 0 0 1-2 2 2 2 0 0 1-2-2v0c0-1.1.9-2 2-2z" />
                      <path d="M17 7c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
                      <path d="M7 7c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2z" />
                      <path d="M12 22v-6" />
                      <path d="M12 16c-3.3 0-6-2.2-6-5" />
                      <path d="M12 16c3.3 0 6-2.2 6-5" />
                      <path d="M9 4.5C7.3 5.4 6 7 6 9" />
                      <path d="M15 4.5c1.7.9 3 2.5 3 4.5" />
                    </svg>
                  </div>

                  <h3
                    style={{
                      fontFamily: orbitron,
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: '0.18em',
                      color: '#E9D7C4',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    ARAS Langzeitgedächtnis
                  </h3>
                </div>

                <p
                  className="relative"
                  style={{
                    fontFamily: inter,
                    fontSize: 12.5,
                    lineHeight: '1.75',
                    color: 'rgba(233,215,196,0.5)',
                  }}
                >
                  ARAS verwendet alle Informationen aus der Unternehmensanalyse, um
                  Gespräche kontinuierlich zu verbessern, Entscheidungsfindung zu
                  optimieren und kontextuelles Verständnis zu vertiefen.
                </p>
              </motion.div>

              {/* ── BUTTONS ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={phase >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                transition={{ type: 'spring', stiffness: 220, damping: 22, mass: 0.85 }}
                className="relative flex flex-col sm:flex-row items-stretch gap-3"
              >
                {/* Accept */}
                <motion.button
                  whileHover={{ scale: 1.025 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDecision(true)}
                  className="a20-accept relative flex-1 group overflow-hidden rounded-xl py-[14px] px-6 font-semibold cursor-pointer"
                  style={{
                    fontFamily: inter,
                    fontSize: 13,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    background: 'linear-gradient(135deg, #FE9100 0%, #C06800 50%, #A34E00 100%)',
                    color: '#0a0a0a',
                    boxShadow: '0 4px 24px rgba(254,145,0,0.22)',
                    transition: 'box-shadow 0.3s ease',
                    border: 'none',
                  }}
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-xl"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%)',
                    }}
                  />
                  <span className="relative z-10">Gedächtnis aktivieren</span>
                </motion.button>

                {/* Decline */}
                <motion.button
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleDecision(false)}
                  className="a20-ghost flex-1 rounded-xl py-3 px-6 font-medium cursor-pointer"
                  style={{
                    fontFamily: inter,
                    fontSize: 12,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(233,215,196,0.42)',
                    background: 'transparent',
                    border: '1px solid rgba(233,215,196,0.08)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  Ohne Gedächtnis fortfahren
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
