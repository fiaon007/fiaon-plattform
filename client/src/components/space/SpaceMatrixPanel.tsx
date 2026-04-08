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
import type { MatrixRowId, MatrixRowStatus } from "./SpaceMatrixIntelRow";

interface SpaceMatrixPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowId: MatrixRowId | null;
}

const ROW_CONTENT: Record<
  MatrixRowId,
  {
    title: string;
    status: MatrixRowStatus;
    summary: string;
    systemNote: string;
    primaryLink: { href: string; label: string };
    secondaryLink?: { href: string; label: string };
  }
> = {
  outbound: {
    title: "Outbound-Logik",
    status: "READY",
    summary: "Routing, Sequencing und Guards sind geladen. ARAS kann Outbound-Flows sofort ausführen.",
    systemNote: "Call routing optimiert für DE/AT/CH Nummern.",
    primaryLink: { href: "/app/campaigns", label: "Open Campaign Studio →" },
  },
  voice: {
    title: "Voice Engine",
    status: "LIVE",
    summary: "Voice Engine läuft in Realtime. Tonalität, Pausen und Übergänge sind aktiv.",
    systemNote: "Latenz < 180ms · Neural TTS aktiv.",
    primaryLink: { href: "/app/power", label: "Open Power Calls →" },
  },
  campaign: {
    title: "Campaign Mode",
    status: "READY",
    summary: "Massencalls sind vorbereitet. Öffne das Campaign Studio, um Listen zu starten.",
    systemNote: "Batch-Verarbeitung bis 500 Calls/Kampagne.",
    primaryLink: { href: "/app/campaigns", label: "Open Campaign Studio →" },
    secondaryLink: { href: "/app/power", label: "Power Calls starten" },
  },
  power: {
    title: "Power Calls",
    status: "READY",
    summary: "Einzelaufgaben wie Reservierung, Follow-up oder Rückruf sind sofort ausführbar.",
    systemNote: "Schnellstart ohne Kampagnen-Setup.",
    primaryLink: { href: "/app/power", label: "Open Power Calls →" },
    secondaryLink: { href: "/app/campaigns", label: "Kampagne starten" },
  },
};

const SIGNAL_TICKS = [0.35, 0.7, 0.45, 0.9, 0.55, 0.75, 0.4, 0.85];

function useTypewriter(text: string, enabled: boolean, speed = 22) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setDisplayText(text);
      setIsComplete(true);
      return;
    }

    setDisplayText("");
    setIsComplete(false);

    let index = 0;
    const charDelay = 1000 / speed;

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayText(text.slice(0, index + 1));
        index++;
      } else {
        setIsComplete(true);
        clearInterval(interval);
      }
    }, charDelay);

    return () => clearInterval(interval);
  }, [text, enabled, speed]);

  return { displayText, isComplete };
}

export function SpaceMatrixPanel({
  open,
  onOpenChange,
  rowId,
}: SpaceMatrixPanelProps) {
  const prefersReducedMotion = useReducedMotion();
  const content = rowId ? ROW_CONTENT[rowId] : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const [decryptPhase, setDecryptPhase] = useState(0);
  const [buttonSheen, setButtonSheen] = useState(false);

  const { displayText: typedTitle } = useTypewriter(
    content?.title || "",
    open && !prefersReducedMotion && decryptPhase >= 2
  );

  useEffect(() => {
    if (open && !prefersReducedMotion) {
      setDecryptPhase(0);
      const t1 = setTimeout(() => setDecryptPhase(1), 150);
      const t2 = setTimeout(() => setDecryptPhase(2), 320);
      const t3 = setTimeout(() => setDecryptPhase(3), 1000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else if (open && prefersReducedMotion) {
      setDecryptPhase(3);
    } else {
      setDecryptPhase(0);
    }
  }, [open, prefersReducedMotion]);

  const signalTicks = useMemo(() => {
    return SIGNAL_TICKS.map((h, i) => ({ id: i, baseHeight: h }));
  }, []);

  if (!content) return null;

  const isLive = content.status === "LIVE";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[440px] p-0 border-l-0 overflow-hidden focus:outline-none"
        style={{
          background: "rgba(10,10,12,0.86)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          borderLeft: "1px solid rgba(233,215,196,0.14)",
          boxShadow: "-30px 0 140px rgba(0,0,0,0.72)",
        }}
        ref={panelRef}
      >
        {/* Internal Grid Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `
              repeating-linear-gradient(to right, rgba(233,215,196,0.04) 0 1px, transparent 1px 38px),
              repeating-linear-gradient(to bottom, rgba(233,215,196,0.03) 0 1px, transparent 1px 38px)
            `,
            opacity: 0.08,
            zIndex: 0,
          }}
        />

        {/* Glyph Burst (Decrypt Phase 1) */}
        {!prefersReducedMotion && decryptPhase >= 1 && decryptPhase < 3 && (
          <div
            className="absolute top-0 left-0 right-0 h-24 pointer-events-none overflow-hidden"
            style={{ zIndex: 5 }}
          >
            <div
              className="absolute inset-0"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "10px",
                lineHeight: 1.4,
                color: "rgba(254,145,0,0.25)",
                letterSpacing: "0.08em",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                animation: "glyphBurst 150ms ease-out forwards",
                opacity: decryptPhase === 1 ? 1 : 0,
                transition: "opacity 120ms",
              }}
            >
              {`▓░▒█▄▀■□◆◇○●◎★☆△▽▲▼◁▷◀▶♦♢⬡⬢⎔⎕⌘⌥⌃⇧⏎`.repeat(12)}
            </div>
          </div>
        )}

        {/* Scanline (Decrypt Phase 2) */}
        {!prefersReducedMotion && decryptPhase >= 2 && decryptPhase < 3 && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              height: "2px",
              background: "linear-gradient(90deg, transparent, rgba(254,145,0,0.65), transparent)",
              boxShadow: "0 0 22px rgba(254,145,0,0.25)",
              animation: "matrixScan 680ms cubic-bezier(0.16,1,0.3,1) forwards",
              zIndex: 10,
            }}
          />
        )}

        {/* HEADER */}
        <div
          className="relative flex items-center justify-between px-5 pt-5 pb-3"
          style={{ zIndex: 20 }}
        >
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={rowId}
                initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <SheetHeader className="text-left space-y-1">
                  <SheetTitle
                    className="text-left"
                    style={{
                      fontFamily: "Orbitron, sans-serif",
                      fontSize: "18px",
                      fontWeight: 860,
                      color: "rgba(245,245,247,0.95)",
                      minHeight: "24px",
                    }}
                  >
                    {prefersReducedMotion ? content.title : typedTitle}
                    {!prefersReducedMotion && decryptPhase >= 2 && decryptPhase < 3 && (
                      <span
                        className="inline-block ml-0.5"
                        style={{
                          width: "2px",
                          height: "16px",
                          background: "#FE9100",
                          animation: "cursorBlink 530ms step-end infinite",
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                  </SheetTitle>
                  <SheetDescription className="text-left flex items-center gap-2">
                    <span
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                        fontSize: "12px",
                        letterSpacing: "0.14em",
                        color: "rgba(245,245,247,0.45)",
                      }}
                    >
                      SYSTEM STATUS:
                    </span>
                    <span
                      className="flex items-center gap-1.5"
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                        fontSize: "12px",
                        letterSpacing: "0.14em",
                        fontWeight: 600,
                        color: isLive ? "#FE9100" : "rgba(233,215,196,0.88)",
                      }}
                    >
                      {isLive && !prefersReducedMotion && (
                        <motion.span
                          className="w-1.5 h-1.5 rounded-full bg-orange-500"
                          animate={{ scale: [1, 1.3, 1], opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
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
          style={{ height: "8px", zIndex: 20, position: "relative" }}
        >
          {!prefersReducedMotion ? (
            <motion.div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, rgba(233,215,196,0.0), rgba(254,145,0,0.35), rgba(163,78,0,0.25), rgba(233,215,196,0.0))",
                backgroundSize: "240% 100%",
              }}
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 4.2, ease: "linear", repeat: Infinity }}
            />
          ) : (
            <div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, rgba(233,215,196,0.0), rgba(254,145,0,0.35), rgba(163,78,0,0.25), rgba(233,215,196,0.0))",
              }}
            />
          )}
        </div>

        {/* BODY MODULES */}
        <div className="relative px-5 py-5 space-y-4" style={{ zIndex: 20 }}>
          {/* Module A: Decrypted Summary */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.08, duration: 0.28 }}
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
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "11px",
                letterSpacing: "0.26em",
                color: "rgba(233,215,196,0.70)",
              }}
            >
              DECRYPTED SUMMARY
            </span>
            <p
              style={{
                fontSize: "13.6px",
                lineHeight: 1.65,
                color: "rgba(245,245,247,0.74)",
              }}
            >
              {content.summary}
            </p>
          </motion.div>

          {/* Module B: Live Signal */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.14, duration: 0.28 }}
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
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "11px",
                letterSpacing: "0.26em",
                color: "rgba(233,215,196,0.70)",
              }}
            >
              LIVE SIGNAL
            </span>
            <div className="flex items-end justify-between gap-1.5" style={{ height: "28px" }}>
              {signalTicks.map((tick) => (
                <motion.div
                  key={tick.id}
                  className="flex-1 rounded-sm"
                  style={{
                    background: isLive
                      ? "linear-gradient(180deg, rgba(254,145,0,0.70), rgba(254,145,0,0.20))"
                      : "linear-gradient(180deg, rgba(233,215,196,0.50), rgba(233,215,196,0.15))",
                    height: `${tick.baseHeight * 100}%`,
                  }}
                  animate={
                    isLive && !prefersReducedMotion
                      ? {
                          height: [
                            `${tick.baseHeight * 100}%`,
                            `${(tick.baseHeight + 0.15) * 100}%`,
                            `${tick.baseHeight * 100}%`,
                          ],
                        }
                      : undefined
                  }
                  transition={
                    isLive && !prefersReducedMotion
                      ? {
                          duration: 1.0 + tick.id * 0.08,
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
                fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                fontSize: "11px",
                color: "rgba(245,245,247,0.45)",
              }}
            >
              {content.systemNote}
            </span>
          </motion.div>

          {/* Module C: Actions */}
          <motion.div
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: prefersReducedMotion ? 0 : 0.20, duration: 0.28 }}
            className="space-y-3"
          >
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
                    setTimeout(() => setButtonSheen(false), 550);
                  }
                }}
                whileHover={
                  prefersReducedMotion
                    ? undefined
                    : { boxShadow: "0 0 0 1px rgba(254,145,0,0.14), 0 20px 70px rgba(254,145,0,0.12)" }
                }
                whileTap={prefersReducedMotion ? undefined : { scale: 0.98 }}
              >
                {!prefersReducedMotion && (
                  <span
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.10) 40%, transparent 70%)",
                      transform: buttonSheen ? "translateX(120%) skewX(-15deg)" : "translateX(-120%) skewX(-15deg)",
                      transition: buttonSheen ? "transform 550ms cubic-bezier(0.16,1,0.3,1)" : "none",
                    }}
                  />
                )}
                {content.primaryLink.label}
              </motion.a>
            </Link>

            {content.secondaryLink && (
              <Link href={content.secondaryLink.href}>
                <motion.a
                  className="flex items-center justify-center w-full"
                  style={{
                    height: "44px",
                    borderRadius: "16px",
                    background: "transparent",
                    border: "1px solid rgba(233,215,196,0.14)",
                    color: "rgba(233,215,196,0.88)",
                    fontSize: "14px",
                    fontWeight: 500,
                  }}
                  whileHover={
                    prefersReducedMotion
                      ? undefined
                      : { background: "rgba(255,255,255,0.04)", borderColor: "rgba(233,215,196,0.22)" }
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
          @keyframes glyphBurst {
            from { opacity: 0.8; transform: translateY(-4px); }
            to { opacity: 0; transform: translateY(8px); }
          }
          @keyframes matrixScan {
            from { top: -4%; }
            to { top: 104%; }
          }
          @keyframes cursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  );
}
