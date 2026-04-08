/**
 * ============================================================================
 * ARAS DRAWER - Premium Right-Side Panel
 * ============================================================================
 * Reusable drawer component for Team Command Center detail views
 * - Desktop: Right-side drawer (400px)
 * - Mobile: Fullscreen modal
 * - ARAS CI: Glass effect, orange accents, Orbitron headings
 * ============================================================================
 */

import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ExternalLink } from 'lucide-react';

interface ArasDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  breadcrumb?: string;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: 'default' | 'wide' | 'narrow';
  onOpenInCRM?: () => void;
}

export function ArasDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  breadcrumb = 'Command Center',
  actions,
  footer,
  children,
  size = 'default',
  onOpenInCRM,
}: ArasDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Size mapping
  const widthClasses = {
    narrow: 'w-full sm:w-[360px]',
    default: 'w-full sm:w-[420px]',
    wide: 'w-full sm:w-[540px]',
  };

  // Handle escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  // Focus trap and escape handling
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      
      // Focus the drawer
      setTimeout(() => {
        drawerRef.current?.focus();
      }, 100);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      
      // Restore focus
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const drawerVariants = prefersReducedMotion
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        hidden: { x: '100%', opacity: 0.5 },
        visible: { x: 0, opacity: 1 },
        exit: { x: '100%', opacity: 0.5 },
      };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={backdropVariants}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.div
            ref={drawerRef}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={drawerVariants}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={`fixed right-0 top-0 bottom-0 z-[101] flex flex-col ${widthClasses[size]}`}
            style={{
              background: 'linear-gradient(180deg, rgba(20,20,22,0.98) 0%, rgba(12,12,14,0.99) 100%)',
              borderLeft: '1px solid rgba(233,215,196,0.1)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
            }}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby="drawer-title"
          >
            {/* Header */}
            <div 
              className="flex-shrink-0 px-5 py-4 border-b"
              style={{ borderColor: 'rgba(233,215,196,0.08)' }}
            >
              {/* Breadcrumb + Close */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  <button 
                    onClick={onClose}
                    className="flex items-center gap-1 hover:text-white/60 transition-colors"
                  >
                    <ChevronLeft className="w-3 h-3" />
                    {breadcrumb}
                  </button>
                  <span>/</span>
                  <span style={{ color: 'rgba(254,145,0,0.7)' }}>Details</span>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
                  style={{ color: 'rgba(255,255,255,0.5)' }}
                  aria-label="Close drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Title */}
              <h2 
                id="drawer-title"
                className="text-lg font-semibold mb-1 pr-8"
                style={{ 
                  fontFamily: 'Orbitron, sans-serif',
                  color: 'rgba(255,255,255,0.95)',
                }}
              >
                {title}
              </h2>
              {subtitle && (
                <p className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  {subtitle}
                </p>
              )}

              {/* Actions */}
              {(actions || onOpenInCRM) && (
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {onOpenInCRM && (
                    <button
                      onClick={onOpenInCRM}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(254,145,0,0.15)',
                        border: '1px solid rgba(254,145,0,0.3)',
                        color: '#FE9100',
                      }}
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open in CRM
                    </button>
                  )}
                  {actions}
                </div>
              )}
            </div>

            {/* Body - Scrollable */}
            <div 
              className="flex-1 overflow-y-auto px-5 py-4"
              style={{ scrollbarWidth: 'thin' }}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div 
                className="flex-shrink-0 px-5 py-3 border-t"
                style={{ 
                  borderColor: 'rgba(233,215,196,0.08)',
                  background: 'rgba(0,0,0,0.2)',
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

// ============================================================================
// DRAWER SECTION COMPONENT
// ============================================================================

interface DrawerSectionProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function DrawerSection({ title, children, className = '' }: DrawerSectionProps) {
  return (
    <div className={`mb-5 ${className}`}>
      {title && (
        <h3 
          className="text-xs font-semibold uppercase tracking-wider mb-3"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

// ============================================================================
// DRAWER INFO ROW COMPONENT
// ============================================================================

interface DrawerInfoRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

export function DrawerInfoRow({ label, value, icon }: DrawerInfoRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
      <span className="text-sm flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
        {value}
      </span>
    </div>
  );
}

// ============================================================================
// DRAWER ACTION BUTTON
// ============================================================================

interface DrawerActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function DrawerActionButton({ 
  onClick, 
  children, 
  variant = 'secondary',
  disabled = false,
  loading = false,
  icon,
}: DrawerActionButtonProps) {
  const styles = {
    primary: {
      background: 'linear-gradient(135deg, #FE9100, #a34e00)',
      border: 'none',
      color: 'white',
    },
    secondary: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: 'rgba(255,255,255,0.8)',
    },
    danger: {
      background: 'rgba(239,68,68,0.15)',
      border: '1px solid rgba(239,68,68,0.3)',
      color: '#EF4444',
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
      style={styles[variant]}
    >
      {loading ? (
        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : icon}
      {children}
    </button>
  );
}

// ============================================================================
// DRAWER BADGE
// ============================================================================

interface DrawerBadgeProps {
  children: React.ReactNode;
  color?: 'orange' | 'green' | 'red' | 'blue' | 'gray' | 'yellow';
}

export function DrawerBadge({ children, color = 'gray' }: DrawerBadgeProps) {
  const colors = {
    orange: { bg: 'rgba(254,145,0,0.15)', text: '#FE9100' },
    green: { bg: 'rgba(34,197,94,0.15)', text: '#22C55E' },
    red: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444' },
    blue: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
    yellow: { bg: 'rgba(234,179,8,0.15)', text: '#EAB308' },
    gray: { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' },
  };

  return (
    <span 
      className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium uppercase"
      style={{ background: colors[color].bg, color: colors[color].text }}
    >
      {children}
    </span>
  );
}

// ============================================================================
// DRAWER TIMELINE ITEM
// ============================================================================

interface DrawerTimelineItemProps {
  title: string;
  timestamp: string;
  icon?: React.ReactNode;
  description?: string;
  isLast?: boolean;
}

export function DrawerTimelineItem({ 
  title, 
  timestamp, 
  icon, 
  description,
  isLast = false 
}: DrawerTimelineItemProps) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div 
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(254,145,0,0.1)' }}
        >
          {icon || <div className="w-2 h-2 rounded-full bg-orange-500" />}
        </div>
        {!isLast && (
          <div className="w-px flex-1 my-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
        )}
      </div>
      <div className="pb-4">
        <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {title}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {timestamp}
        </p>
        {description && (
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

export default ArasDrawer;
