/**
 * ============================================================================
 * 3D GLASS CAROUSEL SIDEBAR — PREMIUM HIGH-END NAVIGATION
 * ============================================================================
 * Ultra-luxury glassmorphism + neumorphism navigation with 3D stacking
 * Breathing blue gradients, fluid Framer Motion transitions
 * iOS-inspired premium feel with physical glass material simulation
 * ============================================================================
 */

import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  Users,
  Mail,
  Calendar,
  FileText,
  Settings,
  Brain,
  Database,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard },
  { id: "database", label: "Database", path: "/admin/database", icon: Database },
  { id: "brain", label: "CEO Mind", path: "/admin/ceo-mind", icon: Brain },
  { id: "users", label: "Users", path: "/admin/users", icon: Users },
  { id: "mail", label: "Mail", path: "/admin/mail", icon: Mail },
  { id: "calendar", label: "Calendar", path: "/admin/calendar", icon: Calendar },
  { id: "docs", label: "Docs", path: "/admin/docs", icon: FileText },
  { id: "settings", label: "Settings", path: "/admin/settings", icon: Settings },
];

export default function GlassCarouselSidebar() {
  const [location] = useLocation();

  // Find active index
  const activeIndex = NAV_ITEMS.findIndex((item) => {
    if (item.path === "/") return location === "/";
    return location.startsWith(item.path);
  });

  const currentIndex = activeIndex >= 0 ? activeIndex : 0;

  // Calculate positions for stacking effect
  const getItemPosition = (index: number) => {
    const distance = index - currentIndex;
    const isFocused = distance === 0;
    const isAbove = distance < 0;
    const isBelow = distance > 0;

    return {
      isFocused,
      isAbove,
      isBelow,
      distance: Math.abs(distance),
    };
  };

  return (
    <>
      <style>{`
        @keyframes breatheBlue {
          0%, 100% {
            background-position: 0% 50%;
            opacity: 0.6;
          }
          50% {
            background-position: 100% 50%;
            opacity: 0.9;
          }
        }

        @keyframes shimmer {
          0% {
            background-position: -200% center;
          }
          100% {
            background-position: 200% center;
          }
        }

        .glass-icon-container {
          position: relative;
          perspective: 1000px;
          transform-style: preserve-3d;
        }

        .glass-icon {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(40px) saturate(180%);
          -webkit-backdrop-filter: blur(40px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow:
            0 8px 32px 0 rgba(31, 38, 135, 0.15),
            0 2px 8px 0 rgba(31, 38, 135, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.8),
            inset 0 -1px 0 rgba(0, 0, 0, 0.05);
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .glass-icon::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 50%;
          background: radial-gradient(
            ellipse at top,
            rgba(255, 255, 255, 0.8) 0%,
            rgba(255, 255, 255, 0.3) 40%,
            transparent 70%
          );
          pointer-events: none;
          z-index: 2;
        }

        .glass-icon::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(37, 99, 235, 0.4) 0%,
            rgba(59, 130, 246, 0.6) 50%,
            rgba(96, 165, 250, 0.4) 100%
          );
          background-size: 200% 200%;
          animation: breatheBlue 8s ease-in-out infinite;
          opacity: 0;
          transition: opacity 0.4s ease;
          z-index: 1;
        }

        .glass-icon.active::after {
          opacity: 1;
        }

        .glass-icon:hover::after {
          opacity: 0.7;
        }

        .glass-icon-shimmer {
          position: absolute;
          inset: -2px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.6) 50%,
            transparent 100%
          );
          background-size: 200% 100%;
          animation: shimmer 3s linear infinite;
          opacity: 0;
          pointer-events: none;
          z-index: 3;
          border-radius: 20px;
        }

        .glass-icon.active .glass-icon-shimmer {
          opacity: 0.4;
        }

        .glass-icon-content {
          position: relative;
          z-index: 2;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1e293b;
          transition: all 0.3s ease;
        }

        .glass-icon.active .glass-icon-content {
          color: #1e40af;
          filter: drop-shadow(0 2px 4px rgba(37, 99, 235, 0.3));
        }

        .glass-icon-label {
          position: absolute;
          left: 88px;
          top: 50%;
          transform: translateY(-50%);
          white-space: nowrap;
          font-size: 13px;
          font-weight: 600;
          color: #334155;
          opacity: 0;
          pointer-events: none;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          text-shadow: 0 1px 2px rgba(255, 255, 255, 0.8);
        }

        .glass-icon-container:hover .glass-icon-label {
          opacity: 1;
          left: 92px;
        }

        .glass-icon.active .glass-icon-label {
          color: #1e40af;
          font-weight: 700;
        }

        /* Neumorphic depth shadows */
        .glass-icon.focused {
          box-shadow:
            0 16px 48px 0 rgba(31, 38, 135, 0.25),
            0 4px 16px 0 rgba(37, 99, 235, 0.2),
            inset 0 2px 0 rgba(255, 255, 255, 0.9),
            inset 0 -2px 0 rgba(0, 0, 0, 0.08);
        }

        .glass-icon.stacked {
          box-shadow:
            0 4px 16px 0 rgba(31, 38, 135, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }
      `}</style>

      <motion.div
        className="fixed left-0 top-0 h-screen w-40 flex flex-col items-center justify-center gap-6 z-50"
        initial={{ opacity: 0, x: -100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <AnimatePresence mode="sync">
          {NAV_ITEMS.map((item, index) => {
            const { isFocused, isAbove, isBelow, distance } = getItemPosition(index);
            const Icon = item.icon;

            // Calculate stacking transforms
            let scale = 1;
            let opacity = 1;
            let translateY = 0;
            let translateZ = 0;
            let blur = 0;

            if (!isFocused) {
              scale = Math.max(0.7, 1 - distance * 0.15);
              opacity = Math.max(0.4, 1 - distance * 0.2);
              translateZ = -distance * 40;
              blur = Math.min(distance * 2, 6);

              if (isAbove) {
                translateY = -distance * 8;
              } else if (isBelow) {
                translateY = distance * 8;
              }
            } else {
              scale = 1.2;
            }

            return (
              <motion.div
                key={item.id}
                className="glass-icon-container"
                layout
                layoutId={`nav-${item.id}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  scale,
                  opacity,
                  y: translateY,
                  z: translateZ,
                  filter: `blur(${blur}px)`,
                }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 20,
                  mass: 0.8,
                }}
                style={{
                  zIndex: isFocused ? 100 : 50 - distance,
                }}
              >
                <Link href={item.path}>
                  <a className="block">
                    <motion.div
                      className={`glass-icon ${isFocused ? "active focused" : "stacked"}`}
                      whileHover={{
                        scale: isFocused ? 1.05 : 0.95,
                        x: isFocused ? 0 : 8,
                      }}
                      whileTap={{ scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 15,
                      }}
                    >
                      <div className="glass-icon-shimmer" />
                      <div className="glass-icon-content">
                        <Icon className={isFocused ? "w-8 h-8" : "w-6 h-6"} />
                      </div>
                    </motion.div>
                    <div className="glass-icon-label">{item.label}</div>
                  </a>
                </Link>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Ambient glow background */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(circle at center, rgba(37, 99, 235, 0.05) 0%, transparent 70%)",
          }}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </>
  );
}
