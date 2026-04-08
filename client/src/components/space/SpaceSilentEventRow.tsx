import { motion, useReducedMotion } from "framer-motion";

interface SpaceSilentEventRowProps {
  text: string;
  highlightWord?: string;
  tag?: string;
  index: number;
}

export function SpaceSilentEventRow({
  text,
  highlightWord,
  tag,
  index,
}: SpaceSilentEventRowProps) {
  const prefersReducedMotion = useReducedMotion();

  const renderText = () => {
    if (!highlightWord) {
      return <span>{text}</span>;
    }
    const parts = text.split(new RegExp(`(${highlightWord})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === highlightWord.toLowerCase() ? (
        <span key={i} style={{ color: "rgba(233,215,196,0.92)" }}>
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <motion.li
      initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: prefersReducedMotion ? 0 : 0.1 + index * 0.11,
        duration: prefersReducedMotion ? 0 : 0.32,
        ease: [0.16, 1, 0.3, 1],
      }}
      className="flex items-center justify-between gap-3 transition-colors duration-160"
      style={{
        minHeight: "44px",
        borderRadius: "18px",
        padding: "12px 12px",
        background: "rgba(255,255,255,0.012)",
        border: "1px solid rgba(233,215,196,0.10)",
      }}
      whileHover={
        prefersReducedMotion
          ? undefined
          : {
              borderColor: "rgba(254,145,0,0.18)",
              background: "rgba(255,255,255,0.018)",
            }
      }
    >
      <div className="flex items-center gap-3">
        {/* Pulsing Status Dot */}
        <div className="relative flex items-center justify-center">
          <motion.div
            className="rounded-full"
            style={{
              width: "10px",
              height: "10px",
              background: "rgba(254,145,0,0.75)",
              boxShadow: "0 0 18px rgba(254,145,0,0.35)",
            }}
            animate={
              prefersReducedMotion
                ? undefined
                : {
                    scale: [1, 1.35, 1],
                    opacity: [1, 0.55, 1],
                  }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 1.65,
                    ease: "easeInOut",
                    repeat: Infinity,
                  }
            }
          />
        </div>

        {/* Event Text */}
        <span
          style={{
            fontSize: "13.6px",
            lineHeight: 1.55,
            color: "rgba(245,245,247,0.78)",
          }}
        >
          {renderText()}
        </span>
      </div>

      {/* Optional Tag */}
      {tag && (
        <span
          className="shrink-0 flex items-center justify-center uppercase"
          style={{
            height: "26px",
            padding: "0 10px",
            borderRadius: "999px",
            border: "1px solid rgba(254,145,0,0.22)",
            background: "rgba(254,145,0,0.07)",
            fontSize: "11.5px",
            letterSpacing: "0.12em",
            color: "rgba(233,215,196,0.90)",
          }}
        >
          {tag}
        </span>
      )}
    </motion.li>
  );
}
