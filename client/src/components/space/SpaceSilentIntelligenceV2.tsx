import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Link } from "wouter";
import { SpaceSilentTile, type TileId } from "./SpaceSilentTile";
import { SpaceSilentPanel } from "./SpaceSilentPanel";

const TILES_DATA: Array<{
  id: TileId;
  title: string;
  status: "READY" | "LIVE";
  sublabel: string;
}> = [
  { id: "outbound", title: "Outbound-Logik", status: "READY", sublabel: "Routing loaded" },
  { id: "voice", title: "Voice Engine", status: "LIVE", sublabel: "Realtime voice" },
  { id: "campaign", title: "Campaign Mode", status: "READY", sublabel: "Mass calls" },
  { id: "power", title: "Power Calls", status: "READY", sublabel: "Single tasks" },
];

export function SpaceSilentIntelligenceV2() {
  const prefersReducedMotion = useReducedMotion();
  const [selectedTileId, setSelectedTileId] = useState<TileId | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleTileOpen = (id: TileId) => {
    setSelectedTileId(id);
    setPanelOpen(true);
  };

  return (
    <>
      <motion.section
        aria-label="ARAS background operations"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85, duration: 0.5 }}
        className="w-full relative"
        style={{
          maxWidth: "1120px",
          marginTop: "18px",
          paddingLeft: "12px",
          paddingRight: "12px",
          isolation: "isolate",
        }}
      >
        {/* Capsule Container */}
        <div
          className="relative overflow-hidden"
          style={{
            borderRadius: "28px",
            border: "1px solid rgba(233,215,196,0.14)",
            background: `
              radial-gradient(900px 320px at 12% 0%, rgba(254,145,0,0.14), transparent 60%),
              linear-gradient(180deg, rgba(233,215,196,0.06), rgba(0,0,0,0) 42%),
              rgba(255,255,255,0.015)
            `,
            boxShadow:
              "0 28px 90px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.04)",
            padding: "18px",
          }}
        >
          {/* Micro-grain Background */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              opacity: 0.10,
              maskImage:
                "radial-gradient(closest-side, rgba(0,0,0,.9), transparent 70%)",
              WebkitMaskImage:
                "radial-gradient(closest-side, rgba(0,0,0,.9), transparent 70%)",
              borderRadius: "28px",
            }}
          />

          {/* Header Row */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <h3
              className="uppercase"
              style={{
                fontFamily: "Orbitron, sans-serif",
                fontSize: "12px",
                letterSpacing: "0.24em",
                color: "rgba(233,215,196,0.92)",
              }}
            >
              ARAS arbeitet im Hintergrund.
            </h3>

            {/* Operator Label + Dots */}
            <div className="flex items-center gap-2">
              <span
                style={{
                  fontSize: "11px",
                  color: "rgba(245,245,247,0.55)",
                }}
              >
                Operator
              </span>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: "5px",
                      height: "5px",
                      background:
                        i === 0
                          ? "rgba(254,145,0,0.70)"
                          : i === 1
                          ? "rgba(233,215,196,0.50)"
                          : "rgba(233,215,196,0.28)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Tiles Grid */}
          <div
            className="relative z-10 grid gap-3"
            style={{
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
            }}
          >
            {TILES_DATA.map((tile, index) => (
              <motion.div
                key={tile.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : 0.95 + index * 0.08,
                  duration: prefersReducedMotion ? 0 : 0.36,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <SpaceSilentTile
                  id={tile.id}
                  title={tile.title}
                  status={tile.status}
                  sublabel={tile.sublabel}
                  onOpen={() => handleTileOpen(tile.id)}
                />
              </motion.div>
            ))}
          </div>

          {/* Footer */}
          <div
            className="relative z-10 mt-4 pt-3 flex flex-wrap items-center gap-x-4 gap-y-2"
            style={{
              borderTop: "1px solid rgba(233,215,196,0.08)",
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
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                  onFocus={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                >
                  Open Campaign Studio →
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
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                  onFocus={(e) =>
                    (e.currentTarget.style.textDecoration = "underline")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.textDecoration = "none")
                  }
                >
                  Open Power Calls →
                </a>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Responsive Styles */}
        <style>{`
          @media (max-width: 639px) {
            section[aria-label="ARAS background operations"] {
              margin-top: 14px !important;
            }
            section[aria-label="ARAS background operations"] > div {
              border-radius: 22px !important;
              padding: 14px !important;
            }
          }
          @media (max-width: 899px) {
            section[aria-label="ARAS background operations"] .grid {
              gap: 10px !important;
            }
          }
        `}</style>
      </motion.section>

      {/* Slide-Over Panel */}
      <SpaceSilentPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        tileId={selectedTileId}
      />
    </>
  );
}
