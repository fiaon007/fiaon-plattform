import { useState } from "react";
import { Calendar, Target, RotateCcw, Ticket, Shield, Check, Eye } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { CampaignStudioDraft } from "../types";

// ============================================================================
// Use Case Definitions
// ============================================================================
interface UseCase {
  id: string;
  title: string;
  tagline: string;
  outcomes: string[];
  exampleScript: string;
  kpiHint: string;
  toneDefault: 'executive' | 'friendly' | 'direct';
  icon: LucideIcon;
}

const USE_CASES: UseCase[] = [
  {
    id: 'appointment-setting',
    title: 'Appointment Setting',
    tagline: 'Book qualified meetings directly into your calendar.',
    outcomes: [
      'Convert cold leads into scheduled calls',
      'Sync with your calendar in real-time',
      'Pre-qualify before the meeting',
    ],
    exampleScript: `"Hi, this is Sarah from Acme Solutions.
I'm reaching out because I noticed you downloaded our guide.
Do you have 15 minutes this week to discuss how we can help?
I have availability on Thursday at 2pm or Friday at 10am.
Which works better for you?"`,
    kpiHint: 'Optimized for booked meetings.',
    toneDefault: 'friendly',
    icon: Calendar,
  },
  {
    id: 'lead-qualification',
    title: 'Lead Qualification',
    tagline: 'Score and qualify inbound leads automatically.',
    outcomes: [
      'Identify high-intent prospects',
      'Gather key qualification data',
      'Route hot leads to your team instantly',
    ],
    exampleScript: `"Thanks for your interest in our platform.
To connect you with the right specialist, may I ask:
What's your current monthly volume?
And what's your timeline for making a decision?
Great, based on that I'll have our team reach out today."`,
    kpiHint: 'Optimized for qualified lead rate.',
    toneDefault: 'executive',
    icon: Target,
  },
  {
    id: 'winback',
    title: 'Winback Campaign',
    tagline: 'Re-engage churned or inactive customers.',
    outcomes: [
      'Reconnect with past customers',
      'Offer personalized incentives',
      'Understand churn reasons',
    ],
    exampleScript: `"Hi, this is Max from Acme.
We noticed you haven't used your account recently.
Is there anything we could have done better?
We'd love to offer you a special return offer.
Would you be open to a quick conversation?"`,
    kpiHint: 'Optimized for reactivation rate.',
    toneDefault: 'friendly',
    icon: RotateCcw,
  },
  {
    id: 'event-invite',
    title: 'Event Invitation',
    tagline: 'Drive registrations for webinars and events.',
    outcomes: [
      'Maximize event attendance',
      'Handle RSVPs and questions',
      'Send reminders automatically',
    ],
    exampleScript: `"Hi, I'm calling about our upcoming webinar on sales automation.
It's a 30-minute session with actionable insights.
Would you like me to reserve your spot?
I can also send you a calendar invite right now.
What email should I use?"`,
    kpiHint: 'Optimized for registration rate.',
    toneDefault: 'friendly',
    icon: Ticket,
  },
  {
    id: 'payment-reminder',
    title: 'Payment Reminder',
    tagline: 'Recover overdue payments professionally.',
    outcomes: [
      'Reduce outstanding receivables',
      'Maintain customer relationships',
      'Offer flexible payment options',
    ],
    exampleScript: `"Hello, this is a courtesy call from Acme Billing.
I'm following up on invoice #1234 from last month.
Would you like me to resend the invoice details?
We can also discuss payment plan options if helpful.
What works best for you?"`,
    kpiHint: 'Optimized for collection rate.',
    toneDefault: 'executive',
    icon: Shield,
  },
];

// Map snapshot suggestions to use case IDs
const SUGGESTION_MAP: Record<string, string> = {
  'appointment setting': 'appointment-setting',
  'lead qualification': 'lead-qualification',
  'winback': 'winback',
  'event invite': 'event-invite',
  'payment reminder': 'payment-reminder',
};

function getRecommendedIds(suggestedUseCases?: string[]): Set<string> {
  if (!suggestedUseCases) return new Set();
  const ids = new Set<string>();
  for (const suggestion of suggestedUseCases) {
    const key = suggestion.toLowerCase();
    if (SUGGESTION_MAP[key]) {
      ids.add(SUGGESTION_MAP[key]);
    }
  }
  return ids;
}

// ============================================================================
// Component
// ============================================================================
interface UseCaseStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export default function UseCaseStep({ draft, setDraft, attemptedNext }: UseCaseStepProps) {
  const [previewCase, setPreviewCase] = useState<UseCase | null>(null);
  
  const recommendedIds = getRecommendedIds(draft.companySnapshot?.suggestedUseCases);
  const showError = attemptedNext && !draft.useCaseId;

  const handleSelect = (useCase: UseCase) => {
    setDraft({ 
      useCaseId: useCase.id,
      // Pre-fill tone if not already set
      ...(draft.tone ? {} : { tone: useCase.toneDefault }),
    });
    setPreviewCase(null);
  };

  const handleCardClick = (useCase: UseCase) => {
    setPreviewCase(useCase);
  };

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Choose your playbook</h1>
      <p className="cs-subtitle">
        Pick the outcome you want. You'll tune voice, volume, and leads next.
      </p>
      
      {showError && (
        <p className="cs-field-error cs-field-error--centered">
          Please select a playbook to continue.
        </p>
      )}

      {/* Use Case Cards Grid */}
      <div className="cs-usecase-grid">
        {USE_CASES.map((useCase) => {
          const isSelected = draft.useCaseId === useCase.id;
          const isRecommended = recommendedIds.has(useCase.id);
          const IconComponent = useCase.icon;

          return (
            <button
              key={useCase.id}
              type="button"
              className={`cs-usecase-card ${isSelected ? 'cs-usecase-card--selected' : ''}`}
              onClick={() => handleCardClick(useCase)}
              aria-pressed={isSelected}
            >
              {/* Badges */}
              <div className="cs-usecase-badges">
                {isRecommended && !isSelected && (
                  <span className="cs-usecase-badge cs-usecase-badge--recommended">
                    Recommended
                  </span>
                )}
                {isSelected && (
                  <span className="cs-usecase-badge cs-usecase-badge--selected">
                    <Check size={12} strokeWidth={2.5} />
                    Selected
                  </span>
                )}
              </div>

              {/* Header */}
              <div className="cs-usecase-header">
                <div className="cs-usecase-icon">
                  <IconComponent size={20} strokeWidth={1.5} />
                </div>
                <h3 className="cs-usecase-title">{useCase.title}</h3>
              </div>

              {/* Tagline */}
              <p className="cs-usecase-tagline">{useCase.tagline}</p>

              {/* Outcomes */}
              <ul className="cs-usecase-outcomes">
                {useCase.outcomes.slice(0, 2).map((outcome, i) => (
                  <li key={i}>{outcome}</li>
                ))}
              </ul>

              {/* Preview hint */}
              <span className="cs-usecase-preview-hint">
                <Eye size={14} />
                Preview
              </span>
            </button>
          );
        })}
      </div>

      {/* Preview Dialog */}
      <Dialog open={!!previewCase} onOpenChange={(open) => !open && setPreviewCase(null)}>
        <DialogContent className="cs-preview-dialog">
          {previewCase && (
            <>
              <DialogHeader>
                <DialogTitle className="cs-preview-title">
                  <previewCase.icon size={22} strokeWidth={1.5} />
                  {previewCase.title}
                </DialogTitle>
                <DialogDescription className="cs-preview-tagline">
                  {previewCase.tagline}
                </DialogDescription>
              </DialogHeader>

              {/* Example Script */}
              <div className="cs-preview-section">
                <h4 className="cs-preview-section-title">Example call</h4>
                <div className="cs-preview-script">
                  {previewCase.exampleScript}
                </div>
              </div>

              {/* Outcomes */}
              <div className="cs-preview-section">
                <h4 className="cs-preview-section-title">Expected outcomes</h4>
                <ul className="cs-preview-outcomes">
                  {previewCase.outcomes.map((outcome, i) => (
                    <li key={i}>{outcome}</li>
                  ))}
                </ul>
              </div>

              {/* KPI Hint */}
              <p className="cs-preview-kpi">{previewCase.kpiHint}</p>

              <DialogFooter className="cs-preview-footer">
                <button
                  type="button"
                  className="cs-btn cs-btn--back"
                  onClick={() => setPreviewCase(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="cs-btn cs-btn--next"
                  onClick={() => handleSelect(previewCase)}
                >
                  <Check size={16} />
                  Select this playbook
                </button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
