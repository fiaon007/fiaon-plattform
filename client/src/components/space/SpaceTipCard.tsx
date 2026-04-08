import { useState, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface SpaceTipCardProps {
  title: string;
  subline: string;
  ctaText: string;
  href: string;
  icon: LucideIcon;
  ariaLabel: string;
}

export function SpaceTipCard({
  title,
  subline,
  ctaText,
  href,
  icon: Icon,
  ariaLabel,
}: SpaceTipCardProps) {
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
    <Link href={href} asChild>
      <motion.a
        ref={cardRef}
        aria-label={ariaLabel}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
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
          minHeight: "138px",
          padding: "18px 18px 16px 18px",
          background: `
            linear-gradient(135deg, rgba(254,145,0,0.10), rgba(233,215,196,0.06) 45%, rgba(0,0,0,0) 100%),
            rgba(15,15,15,0.62)
          `,
          border: isHovered && !prefersReducedMotion
            ? "1px solid rgba(254,145,0,0.26)"
            : "1px solid rgba(255,255,255,0.10)",
          boxShadow: isHovered && !prefersReducedMotion
            ? "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06), 0 0 28px rgba(254,145,0,0.10)"
            : "0 10px 30px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06)",
          transition: prefersReducedMotion
            ? "border-color 120ms, background 120ms"
            : "border-color 160ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 160ms cubic-bezier(0.2,0.8,0.2,1)",
        }}
      >
        {/* Pointer-follow Glow (Desktop only, reduced-motion respecting) */}
        {!prefersReducedMotion && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-220"
            style={{
              opacity: isHovered ? 1 : 0,
              background: `radial-gradient(180px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(254,145,0,0.16), transparent 55%)`,
            }}
          />
        )}

        {/* Sheen sweep (trigger once on hover) */}
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
                transform: sheenTriggered ? "translateX(120%)" : "translateX(-120%)",
                transition: sheenTriggered
                  ? "transform 650ms cubic-bezier(0.2,0.8,0.2,1)"
                  : "none",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="relative z-20 flex flex-col h-full">
          {/* Top Row: Icon + Title + CTA Chip */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div
                className="flex items-center justify-center shrink-0"
                style={{
                  width: "22px",
                  height: "22px",
                  filter: "drop-shadow(0 0 18px rgba(254,145,0,0.20))",
                }}
              >
                <Icon
                  className="w-[22px] h-[22px]"
                  style={{ color: "#FE9100" }}
                />
              </div>

              {/* Title */}
              <h3
                className="font-semibold leading-[1.15]"
                style={{
                  fontSize: "16px",
                  fontWeight: 650,
                  color: "rgba(233,215,196,0.95)",
                }}
              >
                {title}
              </h3>
            </div>

            {/* CTA Chip */}
            <motion.div
              className="shrink-0 flex items-center gap-1.5 rounded-full"
              style={{
                height: "28px",
                padding: "0 10px",
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
                className="font-semibold"
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "rgba(255,255,255,0.88)",
                }}
              >
                {ctaText}
              </span>
              <ArrowUpRight
                className="w-3.5 h-3.5"
                style={{ color: "rgba(255,255,255,0.88)" }}
              />
            </motion.div>
          </div>

          {/* Subline */}
          <p
            className="leading-[1.35]"
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,0.70)",
              maxWidth: "52ch",
            }}
          >
            {subline}
          </p>
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
  );
}
