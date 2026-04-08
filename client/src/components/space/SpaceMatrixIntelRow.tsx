import { useRef, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type MatrixRowId = "outbound" | "voice" | "campaign" | "power";
export type MatrixRowStatus = "READY" | "LIVE";

interface SpaceMatrixIntelRowProps {
  id: MatrixRowId;
  title: string;
  subtitle: string;
  status: MatrixRowStatus;
  onOpen: () => void;
}

export function SpaceMatrixIntelRow({
  id,
  title,
  subtitle,
  status,
  onOpen,
}: SpaceMatrixIntelRowProps) {
  const prefersReducedMotion = useReducedMotion();
  const rowRef = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [clickLock, setClickLock] = useState(false);
  const [shimmerActive, setShimmerActive] = useState(false);

  const isLive = status === "LIVE";

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      setShimmerActive(true);
      setTimeout(() => setShimmerActive(false), 580);
    }
  }, [prefersReducedMotion]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const handleClick = useCallback(() => {
    if (!prefersReducedMotion) {
      setClickLock(true);
      setTimeout(() => {
        setClickLock(false);
        onOpen();
      }, 80);
    } else {
      onOpen();
    }
  }, [prefersReducedMotion, onOpen]);

  return (
    <motion.button
      ref={rowRef}
      onClick={handleClick}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative w-full text-left cursor-pointer outline-none overflow-hidden group"
      style={{
        height: "74px",
        borderRadius: "20px",
        border: isHovered && !prefersReducedMotion
          ? "1px solid rgba(254,145,0,0.18)"
          : "1px solid rgba(233,215,196,0.10)",
        background: isHovered && !prefersReducedMotion
          ? "rgba(0,0,0,0.28)"
          : "rgba(0,0,0,0.22)",
        padding: "14px",
        display: "grid",
        gridTemplateColumns: "18px 1fr auto",
        alignItems: "center",
        gap: "14px",
        transform: clickLock && !prefersReducedMotion
          ? "scale(0.99)"
          : isHovered && !prefersReducedMotion
          ? "translateY(-1px)"
          : "translateY(0)",
        transition: prefersReducedMotion
          ? "border-color 120ms, background 120ms"
          : "all 80ms cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      {/* Decrypt Shimmer */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          style={{ borderRadius: "20px" }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(90deg, transparent 0%, rgba(254,145,0,0.08) 50%, transparent 100%)",
              transform: shimmerActive
                ? "translateX(100%)"
                : "translateX(-100%)",
              transition: shimmerActive
                ? "transform 580ms cubic-bezier(0.16,1,0.3,1)"
                : "none",
            }}
          />
        </div>
      )}

      {/* Signal Column (Carrier Line + Dot) */}
      <div
        className="relative flex flex-col items-center justify-center"
        style={{ height: "46px", width: "2px" }}
      >
        {/* Carrier Line */}
        <div
          className="absolute inset-0"
          style={{
            width: "2px",
            background: clickLock && !prefersReducedMotion
              ? "linear-gradient(180deg, rgba(254,145,0,0.0), rgba(254,145,0,0.95), rgba(233,215,196,0.45))"
              : "linear-gradient(180deg, rgba(254,145,0,0.0), rgba(254,145,0,0.65), rgba(233,215,196,0.20))",
            borderRadius: "1px",
            transition: "background 80ms",
          }}
        />

        {/* Carrier Dot */}
        <motion.div
          className="absolute rounded-full"
          style={{
            width: "6px",
            height: "6px",
            left: "-2px",
            background: isLive ? "#FE9100" : "#e9d7c4",
            boxShadow: isLive
              ? "0 0 12px rgba(254,145,0,0.55)"
              : "0 0 8px rgba(233,215,196,0.35)",
          }}
          animate={
            isLive && !prefersReducedMotion
              ? { top: ["20%", "75%", "20%"] }
              : { top: "50%" }
          }
          transition={
            isLive && !prefersReducedMotion
              ? { duration: 1.4, ease: "easeInOut", repeat: Infinity }
              : undefined
          }
        />
      </div>

      {/* Main Text */}
      <div className="relative z-10 flex flex-col min-w-0">
        <span
          className="truncate"
          style={{
            fontSize: "15px",
            fontWeight: 840,
            color: "rgba(245,245,247,0.92)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          className="truncate"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            fontSize: "12.4px",
            color: "rgba(233,215,196,0.62)",
            marginTop: "4px",
            lineHeight: 1.3,
          }}
        >
          {subtitle}
        </span>
      </div>

      {/* Status Tag (Terminal Style) */}
      <div
        className="relative z-10 flex items-center gap-2 shrink-0"
        style={{
          height: "26px",
          padding: "0 10px",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <div
          className="rounded-full shrink-0"
          style={{
            width: "6px",
            height: "6px",
            background: isLive ? "#FE9100" : "#e9d7c4",
          }}
        />
        <span
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
            fontSize: "11px",
            letterSpacing: "0.22em",
            color: isLive ? "rgba(254,145,0,0.92)" : "rgba(233,215,196,0.88)",
            fontWeight: 500,
            textTransform: "uppercase",
          }}
        >
          {status}
        </span>
      </div>

      {/* Focus Ring */}
      <style>{`
        button:focus-visible {
          outline: none;
          box-shadow: 0 0 0 2px rgba(254,145,0,0.50), 0 0 0 6px rgba(0,0,0,0.70) !important;
        }
        @media (max-width: 639px) {
          button { height: 70px !important; }
        }
      `}</style>
    </motion.button>
  );
}
