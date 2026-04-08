/**
 * ============================================================================
 * ARAS AI - DESIGN SYSTEM PRIMITIVES
 * ============================================================================
 * High-end UI components following ARAS CI (Apple x Neural aesthetic)
 * Use these for consistent, premium styling across the Command Center
 * ============================================================================
 */

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { LucideIcon, RefreshCw, LogIn, AlertCircle, Inbox } from 'lucide-react';
import { ApiError, getErrorTitle, getErrorDescription, isUnauthorized } from '@/lib/api';

// ============================================================================
// GLASS CARD - Premium container with blur and subtle border
// ============================================================================

interface AGlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'subtle';
  noPadding?: boolean;
}

export const AGlassCard = React.forwardRef<HTMLDivElement, AGlassCardProps>(
  ({ className, variant = 'default', noPadding = false, children, ...props }, ref) => {
    const variants = {
      default: 'bg-[var(--aras-glass)] border-[var(--aras-glass-border)]',
      elevated: 'bg-black/60 border-[var(--aras-stroke-accent)] shadow-lg shadow-black/20',
      subtle: 'bg-white/[0.03] border-white/[0.06]',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-[22px] border backdrop-blur-xl transition-all duration-200',
          'hover:border-white/[0.12]',
          variants[variant],
          !noPadding && 'p-6',
          className
        )}
        style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AGlassCard.displayName = 'AGlassCard';

// ============================================================================
// GRADIENT TITLE - Orbitron headline with animated gradient
// ============================================================================

interface AGradientTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AGradientTitle = React.forwardRef<HTMLHeadingElement, AGradientTitleProps>(
  ({ className, as: Tag = 'h2', size = 'md', children, ...props }, ref) => {
    const sizes = {
      sm: 'text-lg',
      md: 'text-xl',
      lg: 'text-2xl',
      xl: 'text-3xl',
    };

    return (
      <Tag
        ref={ref}
        className={cn(
          'font-bold tracking-tight',
          'bg-gradient-to-r from-[var(--aras-gold-light)] via-[var(--aras-orange)] to-[var(--aras-gold-dark)]',
          'bg-clip-text text-transparent',
          'font-orbitron',
          sizes[size],
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
AGradientTitle.displayName = 'AGradientTitle';

// ============================================================================
// BUTTON - Primary/Secondary/Ghost with gradient border option
// ============================================================================

interface AButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  icon?: LucideIcon;
  loading?: boolean;
}

export const AButton = React.forwardRef<HTMLButtonElement, AButtonProps>(
  ({ className, variant = 'primary', size = 'md', icon: Icon, loading, children, disabled, ...props }, ref) => {
    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-5 text-sm',
      lg: 'h-12 px-6 text-base',
    };

    // Primary: Premium animated gradient border + glow
    if (variant === 'primary') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'aras-btn aras-btn--primary',
            'relative inline-flex items-center justify-center gap-2',
            'font-semibold rounded-full',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aras-orange)] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
            sizes[size],
            className
          )}
          style={{ fontFamily: 'Orbitron, sans-serif' }}
          {...props}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : Icon ? (
            <Icon className="w-4 h-4" />
          ) : null}
          <span className="relative z-10">{children}</span>
        </button>
      );
    }

    // Secondary: Subtle glass with gradient text on hover
    if (variant === 'secondary') {
      return (
        <button
          ref={ref}
          disabled={disabled || loading}
          className={cn(
            'aras-btn aras-btn--secondary',
            'relative inline-flex items-center justify-center gap-2',
            'font-medium rounded-full',
            'bg-white/[0.06] border border-white/[0.12]',
            'text-[var(--aras-text)] hover:text-white hover:bg-white/[0.1] hover:border-white/[0.2]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-black',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'transition-all duration-200',
            sizes[size],
            className
          )}
          {...props}
        >
          {loading ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : Icon ? (
            <Icon className="w-4 h-4" />
          ) : null}
          {children}
        </button>
      );
    }

    // Ghost: Minimal, text only
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-full',
          'text-[var(--aras-muted)] hover:text-[var(--aras-text)] hover:bg-white/[0.06]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'transition-all duration-200',
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : Icon ? (
          <Icon className="w-4 h-4" />
        ) : null}
        {children}
      </button>
    );
  }
);
AButton.displayName = 'AButton';

// ============================================================================
// STATUS BADGE - Pending/Approved/Error with subtle glow
// ============================================================================

interface AStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'pending' | 'approved' | 'error' | 'info' | 'warning';
}

export const AStatusBadge = React.forwardRef<HTMLSpanElement, AStatusBadgeProps>(
  ({ className, status, children, ...props }, ref) => {
    const styles = {
      pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      error: 'bg-red-500/10 text-red-400 border-red-500/20',
      info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      warning: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
          styles[status],
          className
        )}
        {...props}
      >
        <span className={cn(
          'w-1.5 h-1.5 rounded-full',
          status === 'pending' && 'bg-yellow-400',
          status === 'approved' && 'bg-emerald-400',
          status === 'error' && 'bg-red-400',
          status === 'info' && 'bg-blue-400',
          status === 'warning' && 'bg-orange-400',
        )} />
        {children}
      </span>
    );
  }
);
AStatusBadge.displayName = 'AStatusBadge';

// ============================================================================
// STATE PANEL - Loading skeleton, Empty CTA, Error with retry
// ============================================================================

interface AStatePanelProps {
  state: 'loading' | 'empty' | 'error';
  title?: string;
  description?: string;
  error?: ApiError | null;
  onRetry?: () => void;
  onLogin?: () => void;
  emptyIcon?: LucideIcon;
  emptyAction?: {
    label: string;
    onClick: () => void;
  };
  showDebug?: boolean;
  className?: string;
}

export function AStatePanel({
  state,
  title,
  description,
  error,
  onRetry,
  onLogin,
  emptyIcon: EmptyIcon = Inbox,
  emptyAction,
  showDebug = false,
  className,
}: AStatePanelProps) {
  // Loading State
  if (state === 'loading') {
    return (
      <div className={cn('space-y-4', className)}>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-white/[0.04] animate-pulse"
            style={{ animationDelay: `${i * 100}ms` }}
          />
        ))}
      </div>
    );
  }

  // Empty State
  if (state === 'empty') {
    return (
      <AGlassCard variant="subtle" className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="w-14 h-14 rounded-2xl bg-white/[0.06] flex items-center justify-center mb-4">
          <EmptyIcon className="w-7 h-7 text-[var(--aras-muted)]" />
        </div>
        <h3 className="text-lg font-medium text-[var(--aras-text)] mb-1">
          {title || 'Keine Daten'}
        </h3>
        <p className="text-sm text-[var(--aras-soft)] max-w-xs mb-4">
          {description || 'Es wurden noch keine Einträge erstellt.'}
        </p>
        {emptyAction && (
          <AButton variant="primary" onClick={emptyAction.onClick}>
            {emptyAction.label}
          </AButton>
        )}
      </AGlassCard>
    );
  }

  // Error State
  const isAuthError = error && isUnauthorized(error.status);
  const errorTitle = error ? getErrorTitle(error) : (title || 'Fehler');
  const errorDesc = error ? getErrorDescription(error) : (description || 'Ein Fehler ist aufgetreten.');

  return (
    <AGlassCard variant="subtle" className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className={cn(
        'w-14 h-14 rounded-2xl flex items-center justify-center mb-4',
        isAuthError ? 'bg-orange-500/10' : 'bg-red-500/10'
      )}>
        <AlertCircle className={cn('w-7 h-7', isAuthError ? 'text-orange-400' : 'text-red-400')} />
      </div>
      <h3 className="text-lg font-medium text-[var(--aras-text)] mb-1">
        {errorTitle}
      </h3>
      <p className="text-sm text-[var(--aras-soft)] max-w-xs mb-4">
        {errorDesc}
      </p>
      <div className="flex gap-3">
        {isAuthError && onLogin && (
          <AButton variant="primary" icon={LogIn} onClick={onLogin}>
            Neu anmelden
          </AButton>
        )}
        {onRetry && (
          <AButton variant="secondary" icon={RefreshCw} onClick={onRetry}>
            Neu laden
          </AButton>
        )}
      </div>
      {showDebug && error && (
        <div className="mt-4 p-3 rounded-lg bg-black/40 text-left w-full max-w-md">
          <p className="text-[10px] text-[var(--aras-soft)] font-mono">
            {error.status} · {error.url}
          </p>
          {error.message && (
            <p className="text-[10px] text-[var(--aras-soft)] font-mono truncate">
              {error.message}
            </p>
          )}
        </div>
      )}
    </AGlassCard>
  );
}

// ============================================================================
// KPI CARD - Metric display with icon and trend
// ============================================================================

interface AKPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: 'orange' | 'blue' | 'green' | 'purple' | 'pink';
  className?: string;
}

export function AKPICard({ title, value, icon: Icon, trend, color = 'orange', className }: AKPICardProps) {
  const colors = {
    orange: 'from-orange-500 to-orange-600',
    blue: 'from-blue-500 to-blue-600',
    green: 'from-emerald-500 to-emerald-600',
    purple: 'from-purple-500 to-purple-600',
    pink: 'from-pink-500 to-pink-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <AGlassCard className="relative overflow-hidden group">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-[var(--aras-soft)] uppercase tracking-wider mb-1">
              {title}
            </p>
            <p className="text-3xl font-bold text-[var(--aras-text)]">
              {value}
            </p>
            {trend && (
              <p className={cn(
                'text-xs mt-1',
                trend.value >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          <div className={cn(
            'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center',
            colors[color]
          )}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
        {/* Subtle glow effect */}
        <div className={cn(
          'absolute -bottom-8 -right-8 w-24 h-24 rounded-full blur-2xl opacity-20 transition-opacity group-hover:opacity-30',
          `bg-gradient-to-br ${colors[color]}`
        )} />
      </AGlassCard>
    </motion.div>
  );
}

// ============================================================================
// SECTION HEADER - Consistent heading with optional action
// ============================================================================

interface ASectionHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}

export function ASectionHeader({ title, subtitle, action, className }: ASectionHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between mb-6', className)}>
      <div>
        <h2 className="text-xl font-semibold text-[var(--aras-text)] font-orbitron">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-[var(--aras-soft)] mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

// ============================================================================
// LIST ROW - Consistent row styling for lists/tables
// ============================================================================

interface AListRowProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  selected?: boolean;
}

export const AListRow = React.forwardRef<HTMLDivElement, AListRowProps>(
  ({ className, hoverable = true, selected = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'px-4 py-3 border-b transition-colors duration-150',
          hoverable && 'hover:bg-white/[0.03] cursor-pointer',
          selected && 'bg-[var(--aras-orange)]/10 border-l-2 border-l-[var(--aras-orange)]',
          className
        )}
        style={{ borderColor: 'var(--aras-stroke)' }}
        {...props}
      >
        {children}
      </div>
    );
  }
);
AListRow.displayName = 'AListRow';

// ============================================================================
// TABLE SHELL - Premium wrapper for tables/lists
// ============================================================================

interface ATableShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  action?: React.ReactNode;
}

export function ATableShell({ title, action, className, children, ...props }: ATableShellProps) {
  return (
    <AGlassCard noPadding className={cn('overflow-hidden', className)} {...props}>
      {(title || action) && (
        <div 
          className="px-5 py-4 flex items-center justify-between border-b"
          style={{ borderColor: 'var(--aras-stroke)' }}
        >
          {title && (
            <h3 className="text-base font-semibold" style={{ color: 'var(--aras-text)' }}>
              {title}
            </h3>
          )}
          {action}
        </div>
      )}
      <div className="divide-y" style={{ borderColor: 'var(--aras-stroke)' }}>
        {children}
      </div>
    </AGlassCard>
  );
}

// ============================================================================
// REDUCED MOTION HOOK - Respect user preferences
// ============================================================================

export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// ============================================================================
// SKELETON LOADER - Premium shimmer effect
// ============================================================================

interface ASkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'card' | 'avatar' | 'button';
}

export function ASkeleton({ variant = 'text', className, ...props }: ASkeletonProps) {
  const variants = {
    text: 'h-4 rounded-md',
    card: 'h-24 rounded-xl',
    avatar: 'w-10 h-10 rounded-full',
    button: 'h-10 w-24 rounded-xl',
  };

  return (
    <div
      className={cn(
        'bg-white/[0.06] animate-pulse',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

// ============================================================================
// TOOLTIP - Simple hover tooltip
// ============================================================================

interface ATooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function ATooltip({ content, children, position = 'top' }: ATooltipProps) {
  const positions = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className="relative group inline-block">
      {children}
      <div
        className={cn(
          'absolute z-50 px-2 py-1 text-xs rounded-lg whitespace-nowrap',
          'opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none',
          'bg-black/90 border border-white/10',
          positions[position]
        )}
        style={{ color: 'var(--aras-text)' }}
      >
        {content}
      </div>
    </div>
  );
}
