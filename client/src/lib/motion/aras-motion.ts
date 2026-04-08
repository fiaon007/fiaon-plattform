/**
 * ARAS Motion Primitives - 2026 Edition
 * Consistent, accessible animations across the platform
 */

// Core timing values
export const ARAS_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
export const ARAS_EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)';

export const DURATIONS = {
  fast: 180,
  normal: 260,
  slow: 420,
} as const;

// Check for reduced motion preference
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Get duration respecting reduced motion
export function getDuration(base: number): number {
  return prefersReducedMotion() ? 0 : base;
}

// Framer Motion variants for common patterns
export const motionVariants = {
  // Soft enter from below
  softEnter: {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: {
      duration: DURATIONS.normal / 1000,
      ease: [0.32, 0.72, 0, 1],
    },
  },

  // Fade in only
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: {
      duration: DURATIONS.fast / 1000,
      ease: 'easeOut',
    },
  },

  // Scale up from center
  scaleIn: {
    initial: { opacity: 0, scale: 0.96 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.98 },
    transition: {
      duration: DURATIONS.normal / 1000,
      ease: [0.32, 0.72, 0, 1],
    },
  },

  // Slide in from right (for drawers)
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 10 },
    transition: {
      duration: DURATIONS.slow / 1000,
      ease: [0.16, 1, 0.3, 1],
    },
  },

  // Matrix phosphor effect
  phosphorIn: {
    initial: { 
      opacity: 0, 
      filter: 'brightness(1.5) blur(1px)' 
    },
    animate: { 
      opacity: 1, 
      filter: 'brightness(1) blur(0px)',
    },
    transition: {
      duration: DURATIONS.slow / 1000,
      ease: [0.32, 0.72, 0, 1],
    },
  },
};

// Stagger children animation
export function getStaggerConfig(staggerDelay = 0.05, delayStart = 0) {
  return {
    animate: {
      transition: {
        staggerChildren: prefersReducedMotion() ? 0 : staggerDelay,
        delayChildren: prefersReducedMotion() ? 0 : delayStart,
      },
    },
  };
}

// Hover lift styles (for inline use)
export const hoverLiftStyles = {
  transition: `transform ${DURATIONS.normal}ms ${ARAS_EASE}, box-shadow ${DURATIONS.normal}ms ${ARAS_EASE}`,
};

export const hoverLiftHoverStyles = {
  transform: prefersReducedMotion() ? 'none' : 'translateY(-2px)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
};

// Focus ring styles
export const focusRingStyles = {
  outline: 'none',
  boxShadow: '0 0 0 2px #0b0c0f, 0 0 0 4px #ff6a00',
};

// Create CSS transition string
export function createTransition(
  properties: string[],
  duration: keyof typeof DURATIONS = 'normal'
): string {
  const ms = getDuration(DURATIONS[duration]);
  return properties
    .map(prop => `${prop} ${ms}ms ${ARAS_EASE}`)
    .join(', ');
}

// Animation delay helper for staggered items
export function staggerDelay(index: number, baseDelay = 0.05, startDelay = 0): number {
  if (prefersReducedMotion()) return 0;
  return startDelay + index * baseDelay;
}
