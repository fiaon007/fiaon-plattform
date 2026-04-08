/**
 * ============================================================================
 * ARAS COMMAND NAV ITEM
 * ============================================================================
 * Individual navigation item with tooltip, active state, and hover effects
 * Premium ARAS 2026 Design - Glass, Gold, Orange glow
 * ============================================================================
 */

import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  path: string;
  isActive: boolean;
  isCollapsed: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: number | string;
}

export function NavItem({
  icon: Icon,
  label,
  path,
  isActive,
  isCollapsed,
  onClick,
  disabled = false,
  badge,
}: NavItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="relative group">
      <motion.button
        onClick={onClick}
        disabled={disabled}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          relative w-full flex items-center gap-3 
          ${isCollapsed ? 'justify-center px-0 py-3' : 'px-3 py-2.5'}
          rounded-2xl transition-all duration-200
          ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FE9100]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black
        `}
        style={{
          background: isActive 
            ? 'rgba(254,145,0,0.08)' 
            : isHovered && !disabled
              ? 'rgba(255,255,255,0.03)'
              : 'transparent',
          border: isActive 
            ? '1px solid rgba(254,145,0,0.22)' 
            : '1px solid transparent',
        }}
        whileTap={disabled ? {} : { scale: 0.98 }}
      >
        {/* Active glow bar (left edge) */}
        {isActive && (
          <motion.div
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
            style={{
              background: 'linear-gradient(180deg, #FE9100, #a34e00)',
              boxShadow: '0 0 12px rgba(254,145,0,0.6), 0 0 24px rgba(254,145,0,0.3)',
            }}
            layoutId="nav-active-indicator"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          />
        )}

        {/* Icon */}
        <div className="relative flex-shrink-0">
          <Icon 
            className="w-[18px] h-[18px] transition-colors duration-200"
            style={{
              color: isActive 
                ? '#FE9100' 
                : isHovered && !disabled
                  ? '#e9d7c4'
                  : 'rgba(245,245,247,0.65)'
            }}
          />
          
          {/* Badge */}
          {badge && (
            <span 
              className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full"
              style={{
                background: 'linear-gradient(135deg, #FE9100, #a34e00)',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(254,145,0,0.4)',
              }}
            >
              {badge}
            </span>
          )}
        </div>

        {/* Label (only when expanded) */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="text-[13px] font-semibold whitespace-nowrap overflow-hidden"
              style={{
                fontFamily: 'Inter, sans-serif',
                color: isActive 
                  ? 'rgba(233,215,196,0.95)' 
                  : isHovered && !disabled
                    ? 'rgba(245,245,247,0.9)'
                    : 'rgba(245,245,247,0.72)'
              }}
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Tooltip (only when collapsed) */}
      <AnimatePresence>
        {isCollapsed && isHovered && !disabled && (
          <motion.div
            initial={{ opacity: 0, x: -8, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute left-full ml-3 top-1/2 -translate-y-1/2 z-[100] pointer-events-none"
          >
            <div 
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
              style={{
                background: 'rgba(20,20,22,0.95)',
                border: '1px solid rgba(233,215,196,0.12)',
                color: 'rgba(245,245,247,0.9)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {label}
              {/* Arrow */}
              <div 
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45"
                style={{
                  background: 'rgba(20,20,22,0.95)',
                  borderLeft: '1px solid rgba(233,215,196,0.12)',
                  borderBottom: '1px solid rgba(233,215,196,0.12)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
