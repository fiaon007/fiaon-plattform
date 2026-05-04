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
  Sparkles,
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
          TRIGGER ICON (Vertically Centered, Left Edge)
          ================================================================ */}
      <motion.div
        className="fixed left-4 top-1/2 -translate-y-1/2 z-50"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      >
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-12 h-12 rounded-full cursor-pointer group"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
        >
          {/* Glass Background */}
          <div className="absolute inset-0 bg-white/40 backdrop-blur-xl border border-white/50 rounded-full shadow-lg" />
          
          {/* Breathing Blue Glow Ring */}
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(37, 99, 235, 0.3) 0%, transparent 70%)',
            }}
            animate={{
              opacity: [0.4, 0.8, 0.4],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          {/* Icon */}
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            <Sparkles className="w-6 h-6 text-blue-600" />
          </div>

          {/* Hover Glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-blue-500/20"
            initial={{ opacity: 0 }}
            whileHover={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
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

            {/* Menu Panel */}
            <motion.div
              className="fixed left-20 top-1/2 -translate-y-1/2 z-50"
              initial={{ opacity: 0, x: -20, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -20, scale: 0.9 }}
              transition={{
                type: 'spring',
                stiffness: 300,
                damping: 25,
              }}
            >
              {/* Glass Container */}
              <div className="bg-white/30 backdrop-blur-2xl border border-white/40 rounded-2xl shadow-2xl p-3">
                {/* 2-Column Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {APP_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = item.id === activeApp.id;

                    return (
                      <Link key={item.id} href={item.path}>
                        <a onClick={() => setIsOpen(false)}>
                          <motion.div
                            className={`
                              relative w-[60px] h-[60px] rounded-xl cursor-pointer
                              flex flex-col items-center justify-center gap-1
                              transition-all duration-200
                              ${isActive 
                                ? 'bg-blue-500/20 border border-blue-400/50' 
                                : 'bg-white/20 border border-white/30 hover:bg-blue-500/10 hover:border-blue-400/30'
                              }
                            `}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          >
                            {/* Icon */}
                            <Icon 
                              className={`
                                w-5 h-5 
                                ${isActive ? 'text-blue-600' : 'text-gray-700'}
                              `} 
                            />
                            
                            {/* Label */}
                            <span 
                              className={`
                                text-[9px] font-medium 
                                ${isActive ? 'text-blue-600' : 'text-gray-600'}
                              `}
                            >
                              {item.label}
                            </span>

                            {/* Active Indicator */}
                            {isActive && (
                              <motion.div
                                className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-500 rounded-full"
                                layoutId="activeIndicator"
                                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
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
