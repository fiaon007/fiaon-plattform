/**
 * Campaign Studio Types
 * Draft state, wizard state, and step definitions
 */

export type CampaignStudioStepId =
  | 'identity'
  | 'company-scan'
  | 'use-case'
  | 'volume-pricing'
  | 'voice-gallery'
  | 'leads'
  | 'goals'
  | 'review-checkout';

export interface LeadFilters {
  region?: string;
  industry?: string;
  roleLevel?: string;
  companySize?: string;
}

export interface CompanySnapshot {
  domain?: string;
  industryGuess?: string;
  offerSummary?: string;
  toneSuggestion?: 'executive' | 'friendly' | 'direct';
  suggestedUseCases?: string[];
  confidence?: number;
}

export interface CampaignStudioDraft {
  // Step 1: Identity
  customerType?: 'company' | 'agency';
  
  // Step 2: Company Scan
  contactName?: string;
  contactEmail?: string;
  companyName?: string;
  websiteUrl?: string;
  companySnapshot?: CompanySnapshot;
  
  // Step 3: Use Case
  useCaseId?: string;
  
  // Step 4: Volume & Pricing
  callVolume?: number;
  pricePerCallCents?: number;
  
  // Step 5: Voice
  voiceId?: string;
  
  // Step 6: Leads
  leadsMode?: 'have' | 'need';
  leadPackageSize?: number;
  leadFilters?: LeadFilters;
  
  // Step 7: Goals
  goalPrimary?: string;
  goalMetric?: string;
  goalBrief?: string;
  goalGuardrails?: string[];
  tone?: 'executive' | 'friendly' | 'direct';
  calendarLink?: string;
  
  // Computed
  computedTotalCents?: number;
  currency?: 'eur';
}

export interface CampaignStudioWizardState {
  currentStepIndex: number;
  draft: CampaignStudioDraft;
  hydrated: boolean;
}

export interface PersistedWizardData {
  version: number;
  currentStepIndex: number;
  draft: CampaignStudioDraft;
  updatedAt: string;
}

export const INITIAL_DRAFT: CampaignStudioDraft = {
  currency: 'eur',
};

export const STORAGE_KEY = 'aras_campaign_studio_draft_v1';
export const STORAGE_VERSION = 1;
