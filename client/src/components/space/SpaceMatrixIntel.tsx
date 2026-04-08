import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { SpaceMatrixIntelRow, type MatrixRowId } from "./SpaceMatrixIntelRow";
import { SpaceMatrixPanel } from "./SpaceMatrixPanel";

const MATRIX_ROWS: Array<{
  id: MatrixRowId;
  title: string;
  subtitle: string;
  status: "READY" | "LIVE";
}> = [
  { id: "outbound", title: "Outbound-Logik", subtitle: "routing loaded", status: "READY" },
  { id: "voice", title: "Voice Engine", subtitle: "realtime voice", status: "LIVE" },
  { id: "campaign", title: "Campaign Mode", subtitle: "mass calls", status: "READY" },
  { id: "power", title: "Power Calls", subtitle: "single tasks", status: "READY" },
];

const CODE_RAIN_GLYPHS = `▓░▒█▄▀■□◆◇○●◎★☆△▽▲▼◁▷◀▶♦♢⬡⬢⎔⎕⌘⌥⌃⇧⏎⌫⎋⏏⏩⏪⏫⏬⏭⏮⏯⏸⏹⏺⏻⏼⏽⚙⚡`;

export function SpaceMatrixIntel() {
  const prefersReducedMotion = useReducedMotion();
  const [selectedRowId, setSelectedRowId] = useState<MatrixRowId | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleRowOpen = (id: MatrixRowId) => {
    setSelectedRowId(id);
    setPanelOpen(true);
  };

  return (
    <>
      <motion.section
        aria-label="ARAS Matrix Command Deck"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9, duration: 0.5 }}
        className="w-full relative"
        style={{
          maxWidth: "1120px",
          marginTop: "34px",
          marginBottom: "22px",
          paddingLeft: "12px",
          paddingRight: "12px",
          isolation: "isolate",
        }}
      >
        {/* MATRIX DECK CONTAINER */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: "28px",
            border: "1px solid rgba(233,215,196,0.14)",
            background: "rgba(255,255,255,0.012)",
            boxShadow: "0 28px 96px rgba(0,0,0,0.68), 0 0 0 1px rgba(255,255,255,0.04)",
            padding: "18px",
          }}
        >
          {/* Layer 1: Top Sheen */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(180deg, rgba(233,215,196,0.07), rgba(0,0,0,0) 45%)",
              borderRadius: "28px",
              zIndex: 1,
            }}
          />

          {/* Layer 2: Matrix Grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                repeating-linear-gradient(to right, rgba(233,215,196,0.06) 0 1px, transparent 1px 46px),
                repeating-linear-gradient(to bottom, rgba(233,215,196,0.04) 0 1px, transparent 1px 46px)
              `,
              maskImage: "radial-gradient(closest-side, rgba(0,0,0,.92), transparent 72%)",
              WebkitMaskImage: "radial-gradient(closest-side, rgba(0,0,0,.92), transparent 72%)",
              borderRadius: "28px",
              zIndex: 2,
            }}
          />

          {/* Layer 3: Orange Aura */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(900px 420px at 12% 0%, rgba(254,145,0,0.14), transparent 62%)",
              borderRadius: "28px",
              zIndex: 3,
            }}
          />

          {/* Layer 4: Scanlines */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0 10px, rgba(0,0,0,0.22) 10px 11px)",
              opacity: 0.28,
              borderRadius: "28px",
              zIndex: 4,
            }}
          />

          {/* Layer 5: Code Rain */}
          {!prefersReducedMotion && (
            <div
              className="absolute inset-0 pointer-events-none overflow-hidden"
              style={{
                borderRadius: "28px",
                zIndex: 5,
                maskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 18%, rgba(0,0,0,0.85) 82%, transparent 100%)",
                WebkitMaskImage: "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.85) 18%, rgba(0,0,0,0.85) 82%, transparent 100%)",
              }}
            >
              <div
                className="absolute w-full"
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                  fontSize: "11px",
                  letterSpacing: "0.12em",
                  lineHeight: 1.6,
                  color: "rgba(233,215,196,0.16)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  animation: "codeRainFall 12s linear infinite",
                  top: "-100%",
                }}
              >
                {CODE_RAIN_GLYPHS.repeat(8).split("").map((char, i) => (
                  <span
                    key={i}
                    style={{
                      color: i % 17 === 0 ? "rgba(254,145,0,0.18)" : undefined,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* HEADER ROW */}
          <div
            className="relative flex items-center justify-between mb-4"
            style={{ zIndex: 10 }}
          >
            <h3
              className="uppercase"
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "12px",
                letterSpacing: "0.28em",
                color: "rgba(233,215,196,0.92)",
              }}
            >
              ARAS ARBEITET IM HINTERGRUND.
            </h3>

            <div className="flex items-center gap-2">
              <span
                style={{
                  fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
                  fontSize: "11px",
                  letterSpacing: "0.22em",
                  color: "rgba(245,245,247,0.44)",
                }}
              >
                MATRIX / OPERATOR
              </span>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: "4px",
                      height: "4px",
                      background:
                        i === 0
                          ? "rgba(254,145,0,0.75)"
                          : i === 1
                          ? "rgba(233,215,196,0.55)"
                          : "rgba(233,215,196,0.30)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ROWS GRID */}
          <div
            className="relative grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
              zIndex: 10,
            }}
          >
            {MATRIX_ROWS.map((row, index) => (
              <motion.div
                key={row.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : 1.0 + index * 0.07,
                  duration: prefersReducedMotion ? 0 : 0.32,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <SpaceMatrixIntelRow
                  id={row.id}
                  title={row.title}
                  subtitle={row.subtitle}
                  status={row.status}
                  onOpen={() => handleRowOpen(row.id)}
                />
              </motion.div>
            ))}
          </div>

          {/* FOOTER */}
          <div
            className="relative mt-4 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{
              borderTop: "1px solid rgba(233,215,196,0.08)",
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontSize: "12.4px",
                color: "rgba(245,245,247,0.56)",
              }}
            >
              Wenn du bereit bist: Massencalls starten oder Power Calls nutzen.
            </span>

            <div className="flex items-center gap-4">
              <Link href="/app/campaigns">
                <a
                  className="transition-all duration-160 hover:text-white focus:text-white focus:outline-none"
                  style={{
                    fontSize: "12.4px",
                    color: "rgba(233,215,196,0.88)",
                    textDecoration: "none",
                    textUnderlineOffset: "3px",
                    textDecorationThickness: "1px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  onFocus={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onBlur={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Kampagnen starten →
                </a>
              </Link>

              <Link href="/app/power">
                <a
                  className="transition-all duration-160 hover:text-white focus:text-white focus:outline-none"
                  style={{
                    fontSize: "12.4px",
                    color: "rgba(233,215,196,0.88)",
                    textDecoration: "none",
                    textUnderlineOffset: "3px",
                    textDecorationThickness: "1px",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
                  onFocus={(e) => (e.currentTarget.style.textDecoration = "underline")}
                  onBlur={(e) => (e.currentTarget.style.textDecoration = "none")}
                >
                  Power Calls öffnen →
                </a>
              </Link>
            </div>
          </div>
        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes codeRainFall {
            from { transform: translateY(0); }
            to { transform: translateY(100%); }
          }
          @media (max-width: 767px) {
            section[aria-label="ARAS Matrix Command Deck"] {
              margin-top: 22px !important;
              margin-bottom: 18px !important;
            }
            section[aria-label="ARAS Matrix Command Deck"] > div {
              border-radius: 22px !important;
              padding: 14px !important;
            }
          }
          @media (min-width: 768px) and (max-width: 1023px) {
            section[aria-label="ARAS Matrix Command Deck"] {
              margin-top: 28px !important;
            }
          }
        `}</style>
      </motion.section>

      {/* Matrix Panel */}
      <SpaceMatrixPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        rowId={selectedRowId}
      />
    </>
  );
}
