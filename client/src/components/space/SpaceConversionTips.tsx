import { motion } from "framer-motion";
import { LayoutGrid, Zap } from "lucide-react";
import { SpaceTipCard } from "./SpaceTipCard";

const TIPS_DATA = [
  {
    id: "campaigns",
    title: "Bis zu 10.000 Calls gleichzeitig.",
    subline:
      "Starte Outbound-Kampagnen im Massencall-Modus — mit einem Klick, skalierbar, messbar.",
    ctaText: "Campaign Studio",
    href: "/app/campaigns",
    icon: LayoutGrid,
    ariaLabel: "Open Campaign Studio",
  },
  {
    id: "power",
    title: "Einzelanrufe, die Arbeit abnehmen.",
    subline:
      "Tisch reservieren, Angebot nachsprechen, Vertrag prüfen, Bewerber vorqualifizieren — ARAS übernimmt den Call.",
    ctaText: "Power Calls",
    href: "/app/power",
    icon: Zap,
    ariaLabel: "Open Power Calls",
  },
];

export function SpaceConversionTips() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.7, duration: 0.5 }}
      className="w-full"
      style={{
        maxWidth: "1120px",
        marginTop: "18px",
        paddingLeft: "12px",
        paddingRight: "12px",
      }}
    >
      {/* Grid Container */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
        }}
      >
        {TIPS_DATA.map((tip, index) => (
          <motion.div
            key={tip.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.8 + index * 0.12,
              duration: 0.5,
              ease: [0.2, 0.8, 0.2, 1],
            }}
          >
            <SpaceTipCard
              title={tip.title}
              subline={tip.subline}
              ctaText={tip.ctaText}
              href={tip.href}
              icon={tip.icon}
              ariaLabel={tip.ariaLabel}
            />
          </motion.div>
        ))}
      </div>

      {/* Responsive Styles */}
      <style>{`
        @media (max-width: 1023px) {
          .grid {
            gap: 14px !important;
          }
        }
        @media (max-width: 639px) {
          .grid {
            gap: 12px !important;
          }
        }
      `}</style>
    </motion.div>
  );
}
