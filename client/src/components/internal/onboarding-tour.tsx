/**
 * ============================================================================
 * ARAS COMMAND CENTER - Internal Onboarding Tour
 * ============================================================================
 * 3-step non-blocking tour for new staff/admin users
 * Shows once per user (persisted via localStorage, server flag if available)
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, CheckSquare, Sparkles, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STORAGE_KEY = 'aras.internal.tour.completed';

interface TourStep {
  icon: typeof LayoutDashboard;
  title: string;
  description: string;
  color: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    icon: LayoutDashboard,
    title: 'Welcome to Command Center',
    description: 'Your central hub for managing companies, contacts, deals, and tasks. Everything you need to run operations is here.',
    color: 'from-blue-500 to-blue-600',
  },
  {
    icon: CheckSquare,
    title: 'Tasks & Pipeline',
    description: 'Track deals through stages, create tasks, and never miss a follow-up. The pipeline gives you a clear view of all opportunities.',
    color: 'from-green-500 to-green-600',
  },
  {
    icon: Sparkles,
    title: 'ARAS AI Insights',
    description: 'Get AI-powered summaries and next-step suggestions. Click the sparkle icon on any contact or deal for instant analysis.',
    color: 'from-orange-500 to-orange-600',
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
  forceShow?: boolean;
}

export function OnboardingTour({ onComplete, forceShow = false }: OnboardingTourProps) {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (forceShow) {
      setIsActive(true);
      return;
    }

    const completed = localStorage.getItem(STORAGE_KEY) === '1';
    if (!completed) {
      const timer = setTimeout(() => setIsActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [forceShow]);

  const handleNext = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, []);

  const handleComplete = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, '1');
    setIsActive(false);
    onComplete?.();
  }, [onComplete]);

  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  if (!isActive) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={handleSkip}
        />

        {/* Card */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="relative w-full max-w-md mx-4 bg-gray-900 border border-white/10 rounded-2xl overflow-hidden"
        >
          {/* Skip Button */}
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 text-gray-500 hover:text-white transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Icon Header */}
          <div className={`p-8 bg-gradient-to-r ${step.color}`}>
            <motion.div
              key={currentStep}
              initial={prefersReducedMotion ? {} : { scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto"
            >
              <Icon className="w-8 h-8 text-white" />
            </motion.div>
          </div>

          {/* Content */}
          <div className="p-6">
            <motion.div
              key={`content-${currentStep}`}
              initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <h2 className="text-xl font-semibold text-white text-center mb-3">
                {step.title}
              </h2>
              <p className="text-gray-400 text-center leading-relaxed">
                {step.description}
              </p>
            </motion.div>

            {/* Progress Dots */}
            <div className="flex justify-center gap-2 mt-6 mb-6">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentStep 
                      ? 'bg-orange-500 w-6' 
                      : i < currentStep 
                        ? 'bg-orange-500/50' 
                        : 'bg-white/20'
                  }`}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSkip}
                className="flex-1 border-white/10 text-gray-400 hover:text-white"
              >
                Skip Tour
              </Button>
              <Button
                onClick={handleNext}
                className={`flex-1 bg-gradient-to-r ${step.color} text-white`}
              >
                {currentStep < TOUR_STEPS.length - 1 ? (
                  <>
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  "Get Started"
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function useTourCompleted() {
  const [completed, setCompleted] = useState(true);
  
  useEffect(() => {
    setCompleted(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);
  
  const reset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setCompleted(false);
  };
  
  return { completed, reset };
}

export default OnboardingTour;
