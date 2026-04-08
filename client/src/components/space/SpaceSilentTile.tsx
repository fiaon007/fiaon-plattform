import { useRef, useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

export type TileId = "outbound" | "voice" | "campaign" | "power";
export type TileStatus = "READY" | "LIVE";

interface SpaceSilentTileProps {
  id: TileId;
  title: string;
  status: TileStatus;
  sublabel: string;
  onOpen: () => void;
}

export function SpaceSilentTile({
  id,
  title,
  status,
  sublabel,
  onOpen,
}: SpaceSilentTileProps) {
  const prefersReducedMotion = useReducedMotion();
  const tileRef = useRef<HTMLButtonElement>(null);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);
  const [sheenTriggered, setSheenTriggered] = useState(false);
  const [clickConfirm, setClickConfirm] = useState(false);
  const [orbFlash, setOrbFlash] = useState(false);
  const rafRef = useRef<number | null>(null);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (prefersReducedMotion || !tileRef.current) return;

      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        const rect = tileRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        setMousePos({ x, y });
      });
    },
    [prefersReducedMotion]
  );

  const handlePointerEnter = useCallback(() => {
    setIsHovered(true);
    if (!prefersReducedMotion) {
      setSheenTriggered(true);
      setTimeout(() => setSheenTriggered(false), 650);
    }
  }, [prefersReducedMotion]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    if (!prefersReducedMotion) {
      setMousePos({ x: 50, y: 50 });
    }
  }, [prefersReducedMotion]);

  const handleClick = useCallback(() => {
    if (!prefersReducedMotion) {
      setClickConfirm(true);
      setOrbFlash(true);
      setTimeout(() => setClickConfirm(false), 70);
      setTimeout(() => setOrbFlash(false), 180);
      setTimeout(() => onOpen(), 90);
    } else {
      onOpen();
    }
  }, [prefersReducedMotion, onOpen]);

  const isLive = status === "LIVE";

  return (
    <motion.button
      ref={tileRef}
      onClick={handleClick}
      onPointerMove={handlePointerMove}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.36,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="relative w-full text-left cursor-pointer outline-none overflow-hidden"
      style={{
        minHeight: "68px",
        borderRadius: "20px",
        border: (isHovered || clickConfirm) && !prefersReducedMotion
          ? "1px solid rgba(254,145,0,0.18)"
          : "1px solid rgba(233,215,196,0.10)",
        background: isHovered && !prefersReducedMotion
          ? "linear-gradient(180deg, rgba(255,255,255,0.024), rgba(255,255,255,0.014))"
          : "linear-gradient(180deg, rgba(255,255,255,0.018), rgba(255,255,255,0.010))",
        padding: "14px",
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        alignItems: "center",
        gap: "12px",
        boxShadow: isHovered && !prefersReducedMotion
          ? "0 18px 60px rgba(0,0,0,0.55), 0 0 0 1px rgba(254,145,0,0.10)"
          : "none",
        transform: clickConfirm && !prefersReducedMotion
          ? "scale(0.99)"
          : isHovered && !prefersReducedMotion
          ? "translateY(-1px)"
          : "translateY(0)",
        transition: prefersReducedMotion
          ? "border-color 120ms, background 120ms"
          : "all 70ms cubic-bezier(0.2,0.8,0.2,1)",
      }}
    >
      {/* Cursor Spotlight */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: isHovered ? 1 : 0,
            background: `radial-gradient(220px 120px at ${mousePos.x}% ${mousePos.y}%, rgba(254,145,0,0.12), transparent 60%)`,
            borderRadius: "20px",
          }}
        />
      )}

      {/* Sheen Sweep */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-[-1px] pointer-events-none overflow-hidden"
          style={{ borderRadius: "20px", zIndex: 5 }}
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
                ? "transform 650ms cubic-bezier(0.16, 1, 0.3, 1)"
                : "none",
              opacity: 0.35,
            }}
          />
        </div>
      )}

      {/* Left: Orb Icon */}
      <div
        className="relative flex items-center justify-center"
        style={{
          width: "34px",
          height: "34px",
          borderRadius: "14px",
          background: `
            radial-gradient(10px 10px at 35% 30%, rgba(255,255,255,0.22), rgba(255,255,255,0) 55%),
            radial-gradient(22px 22px at 60% 70%, rgba(254,145,0,0.22), rgba(0,0,0,0) 70%),
            rgba(255,255,255,0.02)
          `,
          border: orbFlash && !prefersReducedMotion
            ? "1px solid rgba(254,145,0,0.55)"
            : "1px solid rgba(254,145,0,0.20)",
          boxShadow: orbFlash && !prefersReducedMotion
            ? "0 0 28px rgba(254,145,0,0.45)"
            : "0 0 18px rgba(254,145,0,0.14)",
          transition: "border-color 80ms, box-shadow 80ms",
        }}
      >
        {/* Status Core Dot */}
        <motion.div
          className="rounded-full"
          style={{
            width: "6px",
            height: "6px",
            background: isLive ? "#FE9100" : "#e9d7c4",
          }}
          animate={
            isLive && !prefersReducedMotion
              ? {
                  scale: [1, 1.4, 1],
                  opacity: [1, 0.6, 1],
                }
              : undefined
          }
          transition={
            isLive && !prefersReducedMotion
              ? {
                  duration: 1.65,
                  ease: "easeInOut",
                  repeat: Infinity,
                }
              : undefined
          }
        />
      </div>

      {/* Main Text */}
      <div className="relative z-10 flex flex-col min-w-0">
        <span
          className="truncate"
          style={{
            fontSize: "14.6px",
            fontWeight: 820,
            color: "rgba(245,245,247,0.92)",
            lineHeight: 1.2,
          }}
        >
          {title}
        </span>
        <span
          className="truncate"
          style={{
            fontSize: "12.4px",
            color: "rgba(245,245,247,0.58)",
            marginTop: "2px",
            lineHeight: 1.3,
          }}
        >
          {sublabel}
        </span>
      </div>

      {/* Right: Status Capsule */}
      <div
        className="relative z-10 flex items-center gap-2 shrink-0"
        style={{
          height: "26px",
          padding: "0 10px",
          borderRadius: "999px",
          background: "rgba(0,0,0,0.22)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Tiny Status Dot */}
        <div
          className="rounded-full shrink-0"
          style={{
            width: "6px",
            height: "6px",
            background: isLive ? "#FE9100" : "#e9d7c4",
          }}
        />
        <span
          className="uppercase"
          style={{
            fontSize: "11px",
            letterSpacing: "0.18em",
            color: "rgba(233,215,196,0.88)",
            fontWeight: 500,
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
      `}</style>
    </motion.button>
  );
}
