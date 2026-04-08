import { useRef, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { SpaceSilentEventRow } from "./SpaceSilentEventRow";

const EVENTS_DATA = [
  { text: "Outbound-Logik initialisiert", highlightWord: "Outbound", tag: "READY" },
  { text: "Voice-Engine bereit", highlightWord: "Voice-Engine", tag: "LIVE" },
  { text: "Campaign-Modus verfügbar", highlightWord: "Campaign", tag: "READY" },
  { text: "Power Calls einsatzbereit", highlightWord: "Power Calls", tag: "READY" },
];

export function SpaceSilentIntelligence() {
  const prefersReducedMotion = useReducedMotion();
  const wrapperRef = useRef<HTMLElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 35 });
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenTriggered, setSheenTriggered] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (prefersReducedMotion || !wrapperRef.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const rect = wrapperRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setMousePos({ x, y });

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const deltaX = (e.clientX - rect.left - centerX) / centerX;
        const deltaY = (e.clientY - rect.top - centerY) / centerY;
        setTilt({
          rotateY: deltaX * 5,
          rotateX: -deltaY * 3,
        });
      });
    },
    [prefersReducedMotion]
  );

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      setSheenTriggered(true);
      setTimeout(() => setSheenTriggered(false), 700);
    }
  }, [prefersReducedMotion]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    if (!prefersReducedMotion) {
      setMousePos({ x: 50, y: 35 });
      setTilt({ rotateX: 0, rotateY: 0 });
    }
  }, [prefersReducedMotion]);

  return (
    <motion.section
      ref={wrapperRef}
      aria-label="ARAS background operations"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.9, duration: 0.5 }}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className="w-full relative overflow-hidden"
      style={{
        maxWidth: "1120px",
        marginTop: "18px",
        paddingLeft: "12px",
        paddingRight: "12px",
        perspective: prefersReducedMotion ? "none" : "900px",
      }}
    >
      {/* Card Wrapper with Tilt */}
      <motion.div
        className="relative overflow-hidden"
        style={{
          borderRadius: "24px",
          border: "1px solid rgba(233,215,196,0.12)",
          background: `
            linear-gradient(135deg, rgba(254,145,0,0.10), rgba(233,215,196,0.05) 45%, rgba(0,0,0,0) 100%),
            rgba(255,255,255,0.016)
          `,
          boxShadow:
            "0 28px 86px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.04)",
          padding: "18px 18px 16px 18px",
          transformStyle: "preserve-3d",
          transform: prefersReducedMotion
            ? "none"
            : `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: isHovered
            ? "transform 80ms linear"
            : "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Cursor Spotlight Overlay */}
        {!prefersReducedMotion && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-220"
            style={{
              opacity: isHovered ? 1 : 0,
              background: `radial-gradient(460px 240px at ${mousePos.x}% ${mousePos.y}%, rgba(254,145,0,0.12), transparent 62%)`,
              borderRadius: "24px",
            }}
          />
        )}

        {/* Sheen Sweep */}
        {!prefersReducedMotion && (
          <div
            className="absolute inset-[-2px] pointer-events-none overflow-hidden"
            style={{ borderRadius: "24px", zIndex: 10 }}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.08) 35%, transparent 70%)",
                transform: sheenTriggered
                  ? "translateX(120%) skewX(-15deg)"
                  : "translateX(-120%) skewX(-15deg)",
                transition: sheenTriggered
                  ? "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)"
                  : "none",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative z-20">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-4">
            <h3
              className="uppercase"
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "12px",
                letterSpacing: "0.22em",
                color: "rgba(233,215,196,0.88)",
              }}
            >
              ARAS arbeitet im Hintergrund.
            </h3>

            {/* Decorative Dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-full"
                  style={{
                    width: "6px",
                    height: "6px",
                    background:
                      i === 0
                        ? "rgba(254,145,0,0.65)"
                        : i === 1
                        ? "rgba(233,215,196,0.45)"
                        : "rgba(233,215,196,0.25)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Events List */}
          <ul className="flex flex-col gap-2.5" role="list">
            {EVENTS_DATA.map((event, index) => (
              <SpaceSilentEventRow
                key={event.text}
                text={event.text}
                highlightWord={event.highlightWord}
                tag={event.tag}
                index={index}
              />
            ))}
          </ul>

          {/* Footer */}
          <div
            className="mt-4 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{
              borderTop: "1px solid rgba(233,215,196,0.08)",
            }}
          >
            <span
              style={{
                fontSize: "12.4px",
                color: "rgba(245,245,247,0.58)",
              }}
            >
              Wenn du bereit bist, starte im Massencall-Modus.
            </span>

            <div className="flex items-center gap-4">
              <Link href="/app/campaigns">
                <a
                  className="transition-all duration-160 hover:underline focus:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FE9100]/50"
                  style={{
                    fontSize: "12.4px",
                    color: "rgba(233,215,196,0.86)",
                    textDecoration: "none",
                  }}
                >
                  Open Campaign Studio →
                </a>
              </Link>

              <Link href="/app/power">
                <a
                  className="transition-all duration-160 hover:underline focus:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FE9100]/50"
                  style={{
                    fontSize: "12.4px",
                    color: "rgba(233,215,196,0.86)",
                    textDecoration: "none",
                  }}
                >
                  Open Power Calls →
                </a>
              </Link>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Mobile Responsive Styles */}
      <style>{`
        @media (max-width: 639px) {
          section[aria-label="ARAS background operations"] {
            margin-top: 14px !important;
          }
          section[aria-label="ARAS background operations"] > div {
            border-radius: 20px !important;
            padding: 16px 14px 14px 14px !important;
          }
          section[aria-label="ARAS background operations"] span[style*="13.6px"] {
            font-size: 13.2px !important;
          }
        }
      `}</style>
    </motion.section>
  );
}
