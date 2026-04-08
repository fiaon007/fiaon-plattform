import type { ComponentType } from "react";
import type { CampaignStudioDraft, CampaignStudioStepId } from "../types";

import IdentityStep from "./IdentityStep";
import CompanyScanStep from "./CompanyScanStep";
import UseCaseStep from "./UseCaseStep";
import VolumePricingStep from "./VolumePricingStep";
import VoiceGalleryStep from "./VoiceGalleryStep";
import LeadsStep from "./LeadsStep";
import GoalsStep from "./GoalsStep";
import ReviewCheckoutStep from "./ReviewCheckoutStep";

export interface StepComponentProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export interface StepDefinition {
  id: CampaignStudioStepId;
  title: string;
  subtitle: string;
  component: ComponentType<StepComponentProps>;
}

export const CAMPAIGN_STUDIO_STEPS: StepDefinition[] = [
  {
    id: 'identity',
    title: 'Identity',
    subtitle: 'Tell us who you are to personalize your experience.',
    component: IdentityStep,
  },
  {
    id: 'company-scan',
    title: 'Company Scan',
    subtitle: 'We analyze your brand to configure optimal settings.',
    component: CompanyScanStep,
  },
  {
    id: 'use-case',
    title: 'Use Case',
    subtitle: 'Select your primary objective for the campaign.',
    component: UseCaseStep,
  },
  {
    id: 'volume-pricing',
    title: 'Volume & Pricing',
    subtitle: 'Choose your call volume and see transparent pricing.',
    component: VolumePricingStep,
  },
  {
    id: 'voice-gallery',
    title: 'Voice Gallery',
    subtitle: 'Select a premium voice for your campaign.',
    component: VoiceGalleryStep,
  },
  {
    id: 'leads',
    title: 'Leads',
    subtitle: 'Bring your own leads or source new ones.',
    component: LeadsStep,
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Define success metrics and communication style.',
    component: GoalsStep,
  },
  {
    id: 'review-checkout',
    title: 'Review & Checkout',
    subtitle: 'Review your configuration and launch.',
    component: ReviewCheckoutStep,
  },
];

export const TOTAL_STEPS = CAMPAIGN_STUDIO_STEPS.length;
