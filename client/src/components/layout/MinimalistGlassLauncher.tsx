/**
 * ============================================================================
 * MINIMALIST GLASS LAUNCHER
 * ============================================================================
 * Ultra-compact, centered app launcher with glass morphism.
 * Replaces the bulky sidebar with a single trigger icon.
 * 
 * Features:
 * - Trigger: 48px circular glass icon, vertically centered
 * - Menu: 2-column grid, compact 60x60px app icons
 * - Animation: Smooth pop-out with AnimatePresence
 * - Style: Minimal, monochrome icons, blue accent on hover
 * ============================================================================
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard,
  Database,
  Brain,
  Users,
  Mail,
  Calendar,
  FileText,
  Settings,
  Menu,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface AppItem {
  id: string;
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

// ============================================================================
// APP ITEMS (2-COLUMN GRID)
// ============================================================================

const APP_ITEMS: AppItem[] = [
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { id: 'database', label: 'Database', path: '/admin/database', icon: Database },
  { id: 'brain', label: 'CEO Mind', path: '/admin/ceo-mind', icon: Brain },
  { id: 'users', label: 'Users', path: '/admin/users', icon: Users },
  { id: 'mail', label: 'Mail', path: '/admin/mail', icon: Mail },
  { id: 'calendar', label: 'Calendar', path: '/admin/calendar', icon: Calendar },
  { id: 'docs', label: 'Docs', path: '/admin/docs', icon: FileText },
  { id: 'settings', label: 'Settings', path: '/admin/settings', icon: Settings },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function MinimalistGlassLauncher() {
  const [isOpen, setIsOpen] = useState(false);
  const [location] = useLocation();

  // Determine active app
  const activeApp = APP_ITEMS.find(item => item.path === location) || APP_ITEMS[0];

  return (
    <>
      {/* ================================================================
          TRIGGER ICON (Vertically Centered, Apple Glass Style)
          ================================================================ */}
      <motion.div
        className="fixed left-8 top-1/2 -translate-y-1/2 z-50"
        initial={{ opacity: 0, x: -30 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-16 h-16 rounded-2xl cursor-pointer group"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
        >
          {/* Apple Glass Background */}
          <div className="absolute inset-0 bg-white/20 backdrop-blur-2xl border border-white/40 rounded-2xl shadow-2xl" />
          
          {/* Enhanced Breathing Blue Glow Ring */}
          <motion.div
            className="absolute -inset-1 rounded-2xl"
            style={{
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.4) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 80%)',
              filter: 'blur(8px)',
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [0.95, 1.05, 0.95],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Menu Icon */}
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <Menu className="w-7 h-7 text-blue-600" strokeWidth={2.5} />
          </div>

          {/* Hover Glow */}
          <motion.div
            className="absolute inset-0 rounded-2xl bg-gradient-to-br from-blue-500/30 to-blue-600/20"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          />
        </motion.button>
      </motion.div>

      {/* ================================================================
          APP MENU (Pop-Out Grid)
          ================================================================ */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop (Click to Close) */}
            <motion.div
              className="fixed inset-0 z-40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
            />

            {/* Menu Panel (Apple Glass Style) */}
            <motion.div
              className="fixed left-28 top-1/2 -translate-y-1/2 z-50"
              initial={{ opacity: 0, x: -30, scale: 0.85 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -30, scale: 0.85 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 30,
              }}
            >
              {/* Apple Glass Container */}
              <div className="w-80 bg-white/25 backdrop-blur-3xl border border-white/30 rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.3)] p-6">
                {/* 2-Column Grid with Better Spacing */}
                <div className="grid grid-cols-2 gap-4">
                  {APP_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === activeApp.id;

                    return (
                      <Link key={item.id} href={item.path}>
                        <a onClick={() => setIsOpen(false)}>
                          <motion.div
                            className={`
                              relative w-full aspect-square rounded-2xl cursor-pointer
                              flex flex-col items-center justify-center gap-2
                              transition-all duration-300
                              ${isActive 
                                ? 'bg-gradient-to-br from-blue-500/30 to-blue-600/20 border-2 border-blue-400/60 shadow-lg' 
                                : 'bg-white/15 border border-white/25 hover:bg-gradient-to-br hover:from-blue-500/15 hover:to-blue-600/10 hover:border-blue-400/40 hover:shadow-md'
                              }
                            `}
                            whileHover={{ scale: 1.08, y: -4 }}
                            whileTap={{ scale: 0.92 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 28 }}
                          >
                            {/* Icon */}
                            <Icon 
                              className={`
                                w-7 h-7 
                                ${isActive ? 'text-blue-600' : 'text-gray-600'}
                              `}
                              strokeWidth={2}
                            />
                            
                            {/* Label */}
                            <span 
                              className={`
                                text-[10px] font-semibold tracking-wide
                                ${isActive ? 'text-blue-600' : 'text-gray-600'}
                              `}
                            >
                              {item.label}
                            </span>

                            {/* Active Indicator */}
                            {isActive && (
                              <motion.div
                                className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-lg"
                                layoutId="activeIndicator"
                                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                              />
                            )}
                          </motion.div>
                        </a>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ================================================================
          CSS ANIMATIONS
          ================================================================ */}
      <style>{`
        @keyframes breatheGlow {
          0%, 100% {
            opacity: 0.4;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.1);
          }
        }
      `}</style>
    </>
  );
}
