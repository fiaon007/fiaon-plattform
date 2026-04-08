"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import "./campaign-studio.css";

import { CAMPAIGN_STUDIO_STEPS, TOTAL_STEPS } from "./steps/registry";
import type { CampaignStudioDraft, PersistedWizardData, CampaignStudioStepId } from "./types";
import { INITIAL_DRAFT, STORAGE_KEY, STORAGE_VERSION } from "./types";

// ============================================================================
// Validation helpers
// ============================================================================
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

function isStepValid(stepId: CampaignStudioStepId, draft: CampaignStudioDraft): boolean {
  switch (stepId) {
    case 'identity':
      return (
        !!draft.customerType &&
        !!draft.contactName && draft.contactName.length >= 2 &&
        !!draft.contactEmail && isValidEmail(draft.contactEmail) &&
        !!draft.companyName && draft.companyName.length >= 2
      );
    case 'use-case':
      return Boolean(draft.useCaseId);
    case 'volume-pricing':
      return Boolean(draft.callVolume && draft.pricePerCallCents && draft.computedTotalCents);
    case 'voice-gallery':
      return Boolean(draft.voiceId);
    case 'leads':
      // Mode required; if 'need', package required
      return Boolean(draft.leadsMode) && (draft.leadsMode === 'have' || Boolean(draft.leadPackageSize));
    case 'goals':
      // Primary goal + brief (min 40 chars) required
      return Boolean(draft.goalPrimary) && Boolean(draft.goalBrief) && (draft.goalBrief?.length || 0) >= 40;
    // Other steps: always valid for now (will implement later)
    default:
      return true;
  }
}

// ============================================================================
// localStorage helpers
// ============================================================================
function loadPersistedData(): { stepIndex: number; draft: CampaignStudioDraft } | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const data: PersistedWizardData = JSON.parse(stored);
    if (data.version !== STORAGE_VERSION) return null;
    return {
      stepIndex: data.currentStepIndex ?? 0,
      draft: data.draft ?? INITIAL_DRAFT,
    };
  } catch {
    return null;
  }
}

function persistData(stepIndex: number, draft: CampaignStudioDraft) {
  try {
    const data: PersistedWizardData = {
      version: STORAGE_VERSION,
      currentStepIndex: stepIndex,
      draft,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silent fail
  }
}

// ============================================================================
// Shell Component
// ============================================================================
export default function CampaignStudioShell() {
  const prefersReducedMotion = useReducedMotion();
  
  // Wizard state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [draft, setDraftState] = useState<CampaignStudioDraft>(INITIAL_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [attemptedNext, setAttemptedNext] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const persisted = loadPersistedData();
    if (persisted) {
      setCurrentStepIndex(persisted.stepIndex);
      setDraftState(persisted.draft);
    }
    setHydrated(true);
  }, []);

  // Persist on state change (after hydration)
  useEffect(() => {
    if (hydrated) {
      persistData(currentStepIndex, draft);
    }
  }, [currentStepIndex, draft, hydrated]);

  // Draft updater (partial merge)
  const setDraft = useCallback((patch: Partial<CampaignStudioDraft>) => {
    setDraftState(prev => ({ ...prev, ...patch }));
  }, []);

  // Navigation
  const goNext = useCallback(() => {
    const currentStepId = CAMPAIGN_STUDIO_STEPS[currentStepIndex].id;
    
    // Check validation
    if (!isStepValid(currentStepId, draft)) {
      setAttemptedNext(true);
      return;
    }
    
    if (currentStepIndex < TOTAL_STEPS - 1) {
      setDirection(1);
      setAttemptedNext(false); // Reset for next step
      setCurrentStepIndex(prev => prev + 1);
    }
  }, [currentStepIndex, draft]);

  const goBack = useCallback(() => {
    if (currentStepIndex > 0) {
      setDirection(-1);
      setAttemptedNext(false); // Reset when going back
      setCurrentStepIndex(prev => prev - 1);
    }
  }, [currentStepIndex]);

  // Current step
  const currentStep = CAMPAIGN_STUDIO_STEPS[currentStepIndex];
  const StepComponent = currentStep.component;
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOTAL_STEPS - 1;
  const progressPercent = ((currentStepIndex + 1) / TOTAL_STEPS) * 100;
  const stepIsValid = isStepValid(currentStep.id, draft);

  // Animation variants
  const stepVariants = {
    initial: (dir: number) => prefersReducedMotion 
      ? { opacity: 0 } 
      : { opacity: 0, x: dir * 30 },
    animate: prefersReducedMotion 
      ? { opacity: 1 } 
      : { opacity: 1, x: 0 },
    exit: (dir: number) => prefersReducedMotion 
      ? { opacity: 0 } 
      : { opacity: 0, x: dir * -30 },
  };

  const transition = {
    duration: prefersReducedMotion ? 0.08 : 0.22,
    ease: [0.32, 0.72, 0, 1],
  };

  // Don't render until hydrated to prevent flash
  if (!hydrated) {
    return (
      <div className="cs-container">
        <div className="cs-bg-layer cs-bg-gradient" aria-hidden="true" />
        <div className="cs-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="cs-container">
      {/* Background layers */}
      <div className="cs-bg-layer cs-bg-gradient" aria-hidden="true" />
      <div className="cs-bg-layer cs-bg-noise" aria-hidden="true" />

      {/* Header */}
      <header className="cs-header">
        <div className="cs-header-inner">
          <span className="cs-header-label">Campaign Studio</span>
          <span className="cs-header-step">Step {currentStepIndex + 1}/{TOTAL_STEPS}</span>
        </div>
        <div className="cs-progress-track">
          <div 
            className="cs-progress-fill" 
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      {/* Main content area */}
      <main className="cs-main">
        <div className="cs-card">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep.id}
              custom={direction}
              variants={stepVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={transition}
            >
              <StepComponent 
                draft={draft} 
                setDraft={setDraft}
                goNext={goNext}
                goBack={goBack}
                attemptedNext={attemptedNext}
              />
            </motion.div>
          </AnimatePresence>

          {/* Action buttons (desktop) */}
          <div className="cs-actions cs-actions--desktop">
            <button 
              type="button" 
              className="cs-btn cs-btn--back" 
              disabled={isFirstStep}
              onClick={goBack}
            >
              <ArrowLeft size={18} />
              <span>Back</span>
            </button>
            
            <button 
              type="button" 
              className={`cs-btn cs-btn--next ${!stepIsValid ? 'cs-btn--next-hint' : ''}`}
              onClick={goNext}
              disabled={isLastStep}
            >
              <span>{isLastStep ? 'Launch' : 'Continue'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </main>

      {/* Bottom action bar (mobile) */}
      <div className="cs-bottom-bar">
        <button 
          type="button" 
          className="cs-btn cs-btn--back" 
          disabled={isFirstStep}
          onClick={goBack}
        >
          <ArrowLeft size={18} />
          <span>Back</span>
        </button>
        <button 
          type="button" 
          className={`cs-btn cs-btn--next ${!stepIsValid ? 'cs-btn--next-hint' : ''}`}
          onClick={goNext}
          disabled={isLastStep}
        >
          <span>{isLastStep ? 'Launch' : 'Continue'}</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
