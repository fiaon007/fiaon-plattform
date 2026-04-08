import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { BookOpen, ArrowRight } from "lucide-react";

export function SpaceKnowledgeBanner() {
  const prefersReducedMotion = useReducedMotion();
  const cardRef = useRef<HTMLAnchorElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 50, y: 30 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenTriggered, setSheenTriggered] = useState(false);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (prefersReducedMotion || !cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setMousePosition({ x, y });
    },
    [prefersReducedMotion]
  );

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      setSheenTriggered(true);
      setTimeout(() => setSheenTriggered(false), 650);
    }
  }, [prefersReducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (!prefersReducedMotion) {
      setMousePosition({ x: 50, y: 30 });
    }
  }, [prefersReducedMotion]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.05, duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className="w-full"
      style={{
        maxWidth: "1120px",
        marginTop: "14px",
        paddingLeft: "12px",
        paddingRight: "12px",
      }}
    >
      <Link href="/app/leads" asChild>
        <motion.a
          ref={cardRef}
          aria-label="Wissensdatenbank öffnen"
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          whileHover={
            prefersReducedMotion
              ? undefined
              : {
                  y: -2,
                  transition: { duration: 0.16, ease: [0.2, 0.8, 0.2, 1] },
                }
          }
          whileTap={
            prefersReducedMotion
              ? undefined
              : {
                  y: 0,
                  transition: { duration: 0.09 },
                }
          }
          className="group relative block rounded-[18px] overflow-hidden cursor-pointer outline-none"
          style={{
            padding: "18px 18px 16px 18px",
            background: `
              linear-gradient(135deg, rgba(254,145,0,0.08), rgba(233,215,196,0.04) 45%, rgba(0,0,0,0) 100%),
              rgba(15,15,15,0.62)
            `,
            border:
              isHovered && !prefersReducedMotion
                ? "1px solid rgba(254,145,0,0.26)"
                : "1px solid rgba(255,255,255,0.10)",
            boxShadow:
              isHovered && !prefersReducedMotion
                ? "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06), 0 0 28px rgba(254,145,0,0.10)"
                : "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
            transition: prefersReducedMotion
              ? "border-color 120ms, background 120ms"
              : "border-color 160ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 160ms cubic-bezier(0.2,0.8,0.2,1)",
          }}
        >
          {/* Pointer-follow Glow */}
          {!prefersReducedMotion && (
            <div
              className="absolute inset-0 pointer-events-none transition-opacity duration-220"
              style={{
                opacity: isHovered ? 1 : 0,
                background: `radial-gradient(240px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(254,145,0,0.14), transparent 55%)`,
              }}
            />
          )}

          {/* Sheen sweep */}
          {!prefersReducedMotion && (
            <div
              className="absolute inset-[-2px] pointer-events-none overflow-hidden rounded-[18px]"
              style={{ zIndex: 10 }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.10) 35%, transparent 70%)",
                  transform: sheenTriggered
                    ? "translateX(120%)"
                    : "translateX(-120%)",
                  transition: sheenTriggered
                    ? "transform 650ms cubic-bezier(0.2,0.8,0.2,1)"
                    : "none",
                }}
              />
            </div>
          )}

          {/* Content */}
          <div className="relative z-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Icon + Text */}
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {/* Icon */}
              <div
                className="flex items-center justify-center shrink-0 rounded-[14px]"
                style={{
                  width: "44px",
                  height: "44px",
                  border: "1px solid rgba(233,215,196,0.14)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <BookOpen
                  className="w-[20px] h-[20px]"
                  style={{
                    color: "#FE9100",
                    filter: "drop-shadow(0 0 14px rgba(254,145,0,0.20))",
                  }}
                />
              </div>

              {/* Text */}
              <div className="min-w-0">
                <h3
                  className="font-semibold leading-[1.15] mb-1"
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "rgba(233,215,196,0.95)",
                  }}
                >
                  Wissensdatenbank für Ihre Agenten
                </h3>
                <p
                  className="leading-[1.45]"
                  style={{
                    fontSize: "13px",
                    color: "rgba(255,255,255,0.62)",
                    maxWidth: "56ch",
                  }}
                >
                  Geben Sie Ihrem Anruf-Agenten eigenes Wissen — z.&nbsp;B.
                  Angebote, Einwände oder Ablauf-Details. ARAS nutzt diese
                  Informationen automatisch im nächsten Telefonat.
                </p>
              </div>
            </div>

            {/* Right: CTA Pill */}
            <motion.div
              className="shrink-0 flex items-center gap-2 rounded-full self-start sm:self-center"
              style={{
                height: "32px",
                padding: "0 14px",
                background: isHovered
                  ? "rgba(254,145,0,0.18)"
                  : "rgba(254,145,0,0.12)",
                border: isHovered
                  ? "1px solid rgba(254,145,0,0.35)"
                  : "1px solid rgba(254,145,0,0.25)",
                transition: "background 160ms, border-color 160ms",
              }}
            >
              <span
                className="font-semibold whitespace-nowrap"
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                Wissensdatenbank öffnen
              </span>
              <ArrowRight
                className="w-3.5 h-3.5"
                style={{
                  color: "rgba(255,255,255,0.88)",
                  transition: "transform 160ms cubic-bezier(0.2,0.8,0.2,1)",
                  transform: isHovered ? "translateX(2px)" : "translateX(0)",
                }}
              />
            </motion.div>
          </div>

          {/* Focus Ring */}
          <style>{`
            .group:focus-visible {
              outline: none;
              box-shadow: 0 0 0 2px rgba(254,145,0,0.55), 0 0 0 5px rgba(0,0,0,0.65) !important;
            }
          `}</style>
        </motion.a>
      </Link>
    </motion.div>
  );
}
