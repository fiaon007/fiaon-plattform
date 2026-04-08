import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'wouter';
import { useEffect, useState, useMemo } from 'react';

interface PageTransitionProps {
  children: React.ReactNode;
}

// Check for reduced motion preference
const prefersReducedMotion = typeof window !== 'undefined' 
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
  : false;

/**
 * HIGH-END Page Transition Component
 * FIXED: Removed delay that caused "video-only" bug
 * Now uses immediate location change with smooth animation
 * Respects reduced motion preference
 */
export function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: prefersReducedMotion ? 0.08 : 0.15, ease: 'easeOut' } }}
        exit={{ opacity: 0, transition: { duration: 0.05 } }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Alternative: Fade-only transition (faster, cleaner)
 * Respects reduced motion preference
 */
export function PageFadeTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          duration: prefersReducedMotion ? 0.1 : 0.15,
          ease: "easeInOut"
        }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Alternative: Slide from bottom (for modal-like pages)
 * Respects reduced motion preference
 */
export function PageSlideTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();

  const variants = useMemo(() => ({
    initial: prefersReducedMotion 
      ? { opacity: 0 } 
      : { opacity: 0, y: 30, scale: 0.98 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: prefersReducedMotion 
      ? { opacity: 0 } 
      : { opacity: 0, y: -20, scale: 0.98 }
  }), []);

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{
          duration: prefersReducedMotion ? 0.15 : 0.25,
          ease: [0.4, 0, 0.2, 1]
        }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
