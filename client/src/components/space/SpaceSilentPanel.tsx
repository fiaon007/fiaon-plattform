import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import { X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import type { TileId, TileStatus } from "./SpaceSilentTile";

interface SpaceSilentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tileId: TileId | null;
}

const TILE_CONTENT: Record<
  TileId,
  {
    title: string;
    status: TileStatus;
    description: string;
    systemNote: string;
    primaryLink?: { href: string; label: string };
    secondaryLink?: { href: string; label: string };
  }
> = {
  outbound: {
    title: "Outbound-Logik",
    status: "READY",
    description:
      "Routing, compliance guards und Sequencing sind geladen. Du kannst Kampagnen sofort starten.",
    systemNote: "Call routing optimiert für DE/AT/CH Nummern.",
    primaryLink: { href: "/app/campaigns", label: "Open Campaign Studio" },
  },
  voice: {
    title: "Voice Engine",
    status: "LIVE",
    description:
      "Voice engine läuft in realtime. Übergänge, Pausen und Tonalität sind bereit.",
    systemNote: "Latenz < 180ms · Neural TTS aktiv.",
    primaryLink: { href: "/app/power", label: "Open Power Calls" },
  },
  campaign: {
    title: "Campaign Mode",
    status: "READY",
    description:
      "Massencalls, Tracking und Ergebnis-Streams stehen bereit. Öffne das Campaign Studio.",
    systemNote: "Batch-Verarbeitung bis 500 Calls/Kampagne.",
    primaryLink: { href: "/app/campaigns", label: "Open Campaign Studio" },
    secondaryLink: { href: "/app/power", label: "Power Calls starten" },
  },
  power: {
    title: "Power Calls",
    status: "READY",
    description:
      "Single-call Aufgaben wie Reservierungen oder Follow-ups kannst du direkt ausführen.",
    systemNote: "Schnellstart ohne Kampagnen-Setup.",
    primaryLink: { href: "/app/power", label: "Open Power Calls" },
    secondaryLink: { href: "/app/campaigns", label: "Kampagne starten" },
  },
};

const SIGNAL_BAR_HEIGHTS = [0.4, 0.7, 0.5, 0.85, 0.6, 0.75];

export function SpaceSilentPanel({
  open,
  onOpenChange,
  tileId,
}: SpaceSilentPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const content = tileId ? TILE_CONTENT[tileId] : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const [ignitionPhase, setIgnitionPhase] = useState(0);
  const [auraOffset, setAuraOffset] = useState({ x: 0, y: 0 });
  const rafRef = useRef<number | null>(null);
  const [buttonSheen, setButtonSheen] = useState(false);

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      setIgnitionPhase(0);
      const t1 = setTimeout(() => setIgnitionPhase(1), 260);
      const t2 = setTimeout(() => setIgnitionPhase(2), 380);
      const t3 = setTimeout(() => setIgnitionPhase(3), 1100);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (open && prefersReducedMotion) {
      setIgnitionPhase(3);
    } else {
      setIgnitionPhase(0);
    }
  }, [open, prefersReducedMotion]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (prefersReducedMotion || !panelRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = panelRef.current!.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width - 0.5) * 12;
        const y = ((e.clientY - rect.top) / rect.height - 0.5) * 12;
        setAuraOffset({ x, y });
      });
    },
    [prefersReducedMotion]
  );

  const handlePointerLeave = useCallback(() => {
    if (!prefersReducedMotion) {
      setAuraOffset({ x: 0, y: 0 });
    }
  }, [prefersReducedMotion]);

  const signalBars = useMemo(() => {
    return SIGNAL_BAR_HEIGHTS.map((h, i) => ({
      id: i,
      baseHeight: h,
    }));
  }, []);

  if (!content) return null;

  const isLive = content.status === "LIVE";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[460px] p-0 border-l-0 overflow-hidden focus:outline-none"
        style={{
          background: "linear-gradient(180deg, rgba(18,18,20,0.88), rgba(10,10,12,0.78))",
          borderLeft: "1px solid rgba(233,215,196,0.14)",
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06), -30px 0 140px rgba(0,0,0,0.72)",
        }}
        ref={panelRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* AURA LAYER (parallax) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `
              radial-gradient(520px 260px at calc(20% + ${auraOffset.x}px) calc(10% + ${auraOffset.y}px), rgba(254,145,0,0.18), transparent 60%),
              radial-gradient(380px 220px at calc(84% + ${auraOffset.x * 0.5}px) calc(24% + ${auraOffset.y * 0.5}px), rgba(233,215,196,0.10), transparent 62%),
              radial-gradient(520px 300px at calc(40% + ${auraOffset.x * 0.7}px) calc(92% + ${auraOffset.y * 0.7}px), rgba(163,78,0,0.12), transparent 70%)
            `,
            transition: prefersReducedMotion ? "none" : "background-position 80ms ease-out",
            zIndex: 0,
          }}
        />

        {/* NOISE MASK */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,.04) 1px, transparent 1px)",
            backgroundSize: "14px 14px",
            opacity: 0.10,
            zIndex: 1,
          }}
        />

        {/* RIM SWEEP (Ignition Phase 1-2) */}
        {!prefersReducedMotion && ignitionPhase >= 1 && ignitionPhase < 3 && (
          <div
            className="absolute inset-0 pointer-events-none overflow-hidden"
            style={{ zIndex: 10 }}
          >
            <div
              className="absolute inset-[-2px]"
              style={{
                background: "conic-gradient(from 90deg, rgba(254,145,0,0) 0% 70%, rgba(254,145,0,0.85) 78%, rgba(233,215,196,0.85) 82%, rgba(254,145,0,0) 92% 100%)",
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "xor",
                WebkitMaskComposite: "xor",
                padding: "1px",
                borderRadius: "inherit",
                animation: "rimSweep 680ms cubic-bezier(0.16,1,0.3,1) forwards",
              }}
            />
          </div>
        )}

        {/* SCANLINE (Ignition Phase 2) */}
        {!prefersReducedMotion && ignitionPhase >= 2 && ignitionPhase < 3 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent, rgba(254,145,0,0.55), transparent)",
              boxShadow: "0 0 18px rgba(254,145,0,0.18)",
              animation: "scanLine 720ms cubic-bezier(0.16,1,0.3,1) forwards",
              zIndex: 11,
            }}
          />
        )}

        {/* HEADER */}
        <div
          className="relative flex items-center justify-between px-5 pt-5 pb-3"
          style={{ zIndex: 20 }}
        >
          {/* Title + Status */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={tileId}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <SheetHeader className="text-left space-y-0.5">
                  <SheetTitle
                    className="text-left"
                    style={{
                      fontFamily: "Orbitron, sans-serif",
                      fontSize: "18px",
                      fontWeight: 860,
                      color: "rgba(245,245,247,0.95)",
                    }}
                  >
                    {content.title}
                  </SheetTitle>
                  <SheetDescription className="text-left flex items-center gap-2">
                    <span style={{ fontSize: "11px", color: "rgba(245,245,247,0.50)" }}>
                      System status:
                    </span>
                    <span
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
                      style={{
                        fontSize: "10px",
                        letterSpacing: "0.14em",
                        fontWeight: 500,
                        background: "rgba(0,0,0,0.28)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        color: isLive ? "#FE9100" : "rgba(233,215,196,0.88)",
                      }}
                    >
                      {isLive && !prefersReducedMotion && (
                        <motion.span
                          className="w-1.5 h-1.5 rounded-full bg-orange-500"
                          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
                          transition={{ duration: 1.4, repeat: Infinity }}
                        />
                      )}
                      {isLive && prefersReducedMotion && (
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                      )}
                      {content.status}
                    </span>
                  </SheetDescription>
                </SheetHeader>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Close Button */}
          <button
            onClick={() => onOpenChange(false)}
            className="relative flex items-center justify-center transition-all duration-160 hover:bg-white/8 active:scale-95"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* SIGNAL STRIP */}
        <div
          className="w-full overflow-hidden"
          style={{ height: "10px", zIndex: 20, position: "relative" }}
        >
          {!prefersReducedMotion ? (
            <motion.div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, rgba(233,215,196,0.0), rgba(233,215,196,0.18), rgba(254,145,0,0.32), rgba(163,78,0,0.22), rgba(233,215,196,0.0))",
                backgroundSize: "220% 100%",
              }}
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 3.8, ease: "linear", repeat: Infinity }}
            />
          ) : (
            <div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, rgba(233,215,196,0.0), rgba(233,215,196,0.18), rgba(254,145,0,0.32), rgba(163,78,0,0.22), rgba(233,215,196,0.0))",
              }}
            />
          )}
        </div>

        {/* BODY MODULES */}
        <div className="relative px-5 py-5 space-y-4" style={{ zIndex: 20 }}>
          {/* Module A: What This Means */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.06, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{
              borderRadius: "18px",
              border: "1px solid rgba(233,215,196,0.10)",
              background: "rgba(255,255,255,0.012)",
              padding: "14px 16px",
            }}
          >
            <span
              className="block uppercase mb-2"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "rgba(233,215,196,0.72)",
              }}
            >
              Was das bedeutet
            </span>
            <p
              style={{
                fontSize: "13.6px",
                lineHeight: 1.65,
                color: "rgba(245,245,247,0.78)",
              }}
            >
              {content.description}
            </p>
          </motion.div>

          {/* Module B: Live Signals */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.12, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            style={{
              borderRadius: "18px",
              border: "1px solid rgba(233,215,196,0.10)",
              background: "rgba(255,255,255,0.012)",
              padding: "14px 16px",
            }}
          >
            <span
              className="block uppercase mb-3"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "rgba(233,215,196,0.72)",
              }}
            >
              System Signal
            </span>
            <div className="flex items-end justify-between gap-2" style={{ height: "32px" }}>
              {signalBars.map((bar) => (
                <motion.div
                  key={bar.id}
                  className="flex-1 rounded-sm"
                  style={{
                    background: isLive
                      ? "linear-gradient(180deg, rgba(254,145,0,0.65), rgba(254,145,0,0.25))"
                      : "linear-gradient(180deg, rgba(233,215,196,0.45), rgba(233,215,196,0.18))",
                    height: `${bar.baseHeight * 100}%`,
                  }}
                  animate={
                    isLive && !prefersReducedMotion
                      ? {
                          height: [
                            `${bar.baseHeight * 100}%`,
                            `${(bar.baseHeight + 0.2) * 100}%`,
                            `${bar.baseHeight * 100}%`,
                          ],
                        }
                      : undefined
                  }
                  transition={
                    isLive && !prefersReducedMotion
                      ? {
                          duration: 1.2 + bar.id * 0.1,
                          ease: "easeInOut",
                          repeat: Infinity,
                          repeatType: "mirror",
                        }
                      : undefined
                  }
                />
              ))}
            </div>
            <span
              className="block mt-2"
              style={{
                fontSize: "11px",
                color: "rgba(245,245,247,0.50)",
              }}
            >
              {content.systemNote}
            </span>
          </motion.div>

          {/* Module C: Next Actions */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.18, duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-3"
          >
            <span
              className="block uppercase"
              style={{
                fontSize: "10px",
                letterSpacing: "0.22em",
                color: "rgba(233,215,196,0.72)",
              }}
            >
              Nächste Aktion
            </span>

            {content.primaryLink && (
              <Link href={content.primaryLink.href}>
                <motion.a
                  className="relative flex items-center justify-center w-full overflow-hidden"
                  style={{
                    height: "44px",
                    borderRadius: "16px",
                    background: "linear-gradient(180deg, rgba(254,145,0,0.22), rgba(254,145,0,0.10))",
                    border: "1px solid rgba(254,145,0,0.28)",
                    color: "rgba(255,255,255,0.92)",
                    fontSize: "14px",
                    fontWeight: 600,
                  }}
                  onMouseEnter={() => {
                    if (!prefersReducedMotion) {
                      setButtonSheen(true);
                      setTimeout(() => setButtonSheen(false), 600);
                    }
                  }}
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : {
                          boxShadow: "0 0 0 1px rgba(254,145,0,0.14), 0 24px 80px rgba(254,145,0,0.10)",
                        }
                  }
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  {/* Button Sheen */}
                  {!prefersReducedMotion && (
                    <span
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.12) 35%, transparent 70%)",
                        transform: buttonSheen ? "translateX(120%) skewX(-15deg)" : "translateX(-120%) skewX(-15deg)",
                        transition: buttonSheen ? "transform 600ms cubic-bezier(0.16,1,0.3,1)" : "none",
                        opacity: 0.5,
                      }}
                    />
                  )}
                  {content.primaryLink.label}
                </motion.a>
              </Link>
            )}

            {content.secondaryLink && (
              <Link href={content.secondaryLink.href}>
                <motion.a
                  className="flex items-center justify-center w-full"
                  style={{
                    height: "44px",
                    borderRadius: "16px",
                    background: "transparent",
                    border: "1px solid rgba(233,215,196,0.12)",
                    color: "rgba(233,215,196,0.88)",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : {
                          background: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(233,215,196,0.20)",
                        }
                  }
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
                >
                  {content.secondaryLink.label}
                </motion.a>
              </Link>
            )}
          </motion.div>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes rimSweep {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes scanLine {
            from { top: -6%; }
            to { top: 106%; }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  );
}
