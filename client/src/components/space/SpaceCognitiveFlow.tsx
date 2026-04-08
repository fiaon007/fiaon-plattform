import { useRef, useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";

const FLOW_STEPS = [
  {
    id: "input",
    label: "INPUT",
    text: "Du gibst ein Ziel vor. Mehr nicht.",
    glowIntensity: 0.22,
    color: "rgba(233,215,196,0.8)",
  },
  {
    id: "context",
    label: "CONTEXT",
    text: "ARAS sammelt Wissen, Regeln und Tonalität.",
    glowIntensity: 0.28,
    color: "rgba(233,215,196,0.85)",
  },
  {
    id: "decision",
    label: "DECISION",
    text: "Jeder Anruf wird individuell entschieden.",
    glowIntensity: 0.38,
    color: "rgba(254,145,0,0.9)",
    pulse: true,
  },
  {
    id: "execution",
    label: "EXECUTION",
    text: "Gespräche laufen parallel – ohne Qualitätsverlust.",
    glowIntensity: 0.32,
    color: "rgba(254,145,0,0.85)",
  },
  {
    id: "feedback",
    label: "FEEDBACK",
    text: "Ergebnisse fließen zurück ins System.",
    glowIntensity: 0.24,
    color: "rgba(233,215,196,0.8)",
    fadeDelay: true,
  },
];

export function SpaceCognitiveFlow() {
  const prefersReducedMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [hasEntered, setHasEntered] = useState(false);

  useEffect(() => {
    if (!sectionRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            setHasEntered(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(sectionRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      aria-label="How ARAS thinks"
      className="relative w-full overflow-hidden"
      style={{
        maxWidth: "1120px",
        marginTop: "42px",
        marginBottom: "54px",
        paddingLeft: "12px",
        paddingRight: "12px",
        isolation: "isolate",
      }}
    >
      {/* Layer 1: Base Background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundColor: "#0f0f0f",
          zIndex: 0,
        }}
      />

      {/* Layer 2: Matrix Vertical Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: "repeating-linear-gradient(to bottom, rgba(233,215,196,0.06) 0 1px, transparent 1px 48px)",
          opacity: 0.18,
          transform: "skewX(-1.5deg)",
          maskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.9) 18%, rgba(0,0,0,0.9) 82%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.9) 18%, rgba(0,0,0,0.9) 82%, transparent 100%)",
          zIndex: 1,
        }}
      />

      {/* Layer 3: Gold/Orange Aura */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(900px 600px at 50% 0%, rgba(254,145,0,0.14), transparent 65%)",
          zIndex: 2,
        }}
      />

      {/* Content Container */}
      <div
        className="relative"
        style={{
          paddingTop: "32px",
          paddingBottom: "48px",
          zIndex: 10,
        }}
      >
        {/* Header */}
        <h3
          className="uppercase"
          style={{
            fontFamily: "Orbitron, sans-serif",
            fontSize: "12px",
            letterSpacing: "0.32em",
            color: "rgba(233,215,196,0.88)",
            marginBottom: "28px",
          }}
        >
          HOW ARAS THINKS
        </h3>

        {/* Flow Container */}
        <div
          className="relative"
          style={{ minHeight: "420px" }}
        >
          {/* Center Axis Line (Desktop) */}
          <div
            className="absolute hidden md:block pointer-events-none"
            style={{
              left: "50%",
              top: 0,
              bottom: 0,
              width: "2px",
              transform: "translateX(-50%)",
              zIndex: 5,
            }}
          >
            {!prefersReducedMotion ? (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(233,215,196,0.18), rgba(254,145,0,0.42), rgba(233,215,196,0.18))",
                  backgroundSize: "100% 200%",
                }}
                animate={{ backgroundPositionY: ["0%", "100%", "0%"] }}
                transition={{ duration: 9, ease: "linear", repeat: Infinity }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(233,215,196,0.18), rgba(254,145,0,0.42), rgba(233,215,196,0.18))",
                }}
              />
            )}
          </div>

          {/* Mobile Axis Line (Left-aligned) */}
          <div
            className="absolute md:hidden pointer-events-none"
            style={{
              left: "24px",
              top: 0,
              bottom: 0,
              width: "2px",
              zIndex: 5,
            }}
          >
            {!prefersReducedMotion ? (
              <motion.div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(233,215,196,0.18), rgba(254,145,0,0.42), rgba(233,215,196,0.18))",
                  backgroundSize: "100% 200%",
                }}
                animate={{ backgroundPositionY: ["0%", "100%", "0%"] }}
                transition={{ duration: 9, ease: "linear", repeat: Infinity }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to bottom, rgba(233,215,196,0.18), rgba(254,145,0,0.42), rgba(233,215,196,0.18))",
                }}
              />
            )}
          </div>

          {/* Flow Steps */}
          <ul
            role="list"
            className="relative flex flex-col"
            style={{ gap: "64px" }}
          >
            {FLOW_STEPS.map((step, index) => (
              <motion.li
                key={step.id}
                role="listitem"
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, y: 6 }
                }
                animate={
                  hasEntered
                    ? prefersReducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, y: 0 }
                    : undefined
                }
                transition={{
                  delay: hasEntered ? index * 0.12 : 0,
                  duration: 0.26,
                  ease: [0.25, 0.8, 0.25, 1],
                }}
                className="relative"
              >
                {/* Desktop Layout */}
                <div className="hidden md:grid" style={{ gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: "32px" }}>
                  {/* Left: Label */}
                  <div className="text-right">
                    <span
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                        fontSize: "11px",
                        letterSpacing: "0.28em",
                        color: "rgba(233,215,196,0.56)",
                      }}
                    >
                      {step.label}
                    </span>
                  </div>

                  {/* Center: Node */}
                  <div className="relative flex items-center justify-center" style={{ width: "32px", height: "32px" }}>
                    {step.pulse && !prefersReducedMotion ? (
                      <motion.div
                        className="rounded-full"
                        style={{
                          width: "10px",
                          height: "10px",
                          background: step.color,
                          boxShadow: `0 0 18px rgba(254,145,0,${step.glowIntensity})`,
                        }}
                        animate={{ scale: [1, 1.15, 1], opacity: [1, 0.85, 1] }}
                        transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
                      />
                    ) : (
                      <div
                        className="rounded-full"
                        style={{
                          width: "10px",
                          height: "10px",
                          background: step.color,
                          boxShadow: `0 0 18px rgba(233,215,196,${step.glowIntensity})`,
                          transition: step.fadeDelay ? "opacity 300ms 200ms" : undefined,
                        }}
                      />
                    )}
                  </div>

                  {/* Right: Text */}
                  <div className="text-left">
                    <p
                      style={{
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "rgba(245,245,247,0.88)",
                        lineHeight: 1.6,
                      }}
                    >
                      {step.text}
                    </p>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden relative" style={{ paddingLeft: "52px" }}>
                  {/* Node (left of text) */}
                  <div
                    className="absolute flex items-center justify-center"
                    style={{ left: "18px", top: "4px", width: "16px", height: "16px" }}
                  >
                    {step.pulse && !prefersReducedMotion ? (
                      <motion.div
                        className="rounded-full"
                        style={{
                          width: "10px",
                          height: "10px",
                          background: step.color,
                          boxShadow: `0 0 18px rgba(254,145,0,${step.glowIntensity})`,
                        }}
                        animate={{ scale: [1, 1.15, 1], opacity: [1, 0.85, 1] }}
                        transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
                      />
                    ) : (
                      <div
                        className="rounded-full"
                        style={{
                          width: "10px",
                          height: "10px",
                          background: step.color,
                          boxShadow: `0 0 18px rgba(233,215,196,${step.glowIntensity})`,
                        }}
                      />
                    )}
                  </div>

                  {/* Label above text */}
                  <span
                    className="block mb-1"
                    style={{
                      fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                      fontSize: "11px",
                      letterSpacing: "0.28em",
                      color: "rgba(233,215,196,0.56)",
                    }}
                  >
                    {step.label}
                  </span>

                  {/* Text */}
                  <p
                    style={{
                      fontSize: "15px",
                      fontWeight: 500,
                      color: "rgba(245,245,247,0.88)",
                      lineHeight: 1.6,
                    }}
                  >
                    {step.text}
                  </p>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 767px) {
          section[aria-label="How ARAS thinks"] {
            margin-top: 26px !important;
            margin-bottom: 42px !important;
          }
          section[aria-label="How ARAS thinks"] ul {
            gap: 48px !important;
          }
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          section[aria-label="How ARAS thinks"] {
            margin-top: 34px !important;
          }
        }
      `}</style>
    </section>
  );
}
