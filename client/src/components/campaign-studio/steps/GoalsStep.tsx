import { useCallback } from "react";
import { 
  CalendarCheck, 
  UserCheck, 
  RefreshCw, 
  Users, 
  BarChart3, 
  MessageCircle, 
  Clock, 
  Check,
  Briefcase,
  Smile,
  Zap,
  Shield
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { CampaignStudioDraft } from "../types";

// ============================================================================
// Options Data
// ============================================================================
interface GoalOption {
  id: string;
  label: string;
  icon: React.ElementType;
}

const PRIMARY_GOALS: GoalOption[] = [
  { id: 'book-meetings', label: 'Book meetings', icon: CalendarCheck },
  { id: 'qualify-leads', label: 'Qualify interest', icon: UserCheck },
  { id: 'winback', label: 'Win back customers', icon: RefreshCw },
  { id: 'event-invite', label: 'Invite to event', icon: Users },
];

const SUCCESS_METRICS: GoalOption[] = [
  { id: 'meetings-booked', label: 'Meetings booked', icon: CalendarCheck },
  { id: 'qualified-leads', label: 'Qualified leads', icon: BarChart3 },
  { id: 'positive-conversations', label: 'Positive conversations', icon: MessageCircle },
  { id: 'followups-scheduled', label: 'Follow-ups scheduled', icon: Clock },
];

interface ToneOption {
  id: 'executive' | 'friendly' | 'direct';
  label: string;
  desc: string;
  icon: React.ElementType;
}

const TONE_OPTIONS: ToneOption[] = [
  { id: 'executive', label: 'Executive', desc: 'Formal & professional', icon: Briefcase },
  { id: 'friendly', label: 'Friendly', desc: 'Warm & approachable', icon: Smile },
  { id: 'direct', label: 'Direct', desc: 'Efficient & to the point', icon: Zap },
];

const GUARDRAILS = [
  'No pressure language',
  'Respect opt-out instantly',
  'No competitor mentions',
  'Keep under 60 seconds intro',
  'Ask permission before details',
];

const BRIEF_MIN_LENGTH = 40;
const BRIEF_PLACEHOLDER = `Example: We help mid-sized logistics companies reduce shipping costs by 20% through our AI-powered route optimization. Target decision-makers in operations who feel the pain of rising fuel costs.`;

// ============================================================================
// Component
// ============================================================================
interface GoalsStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export default function GoalsStep({ draft, setDraft, attemptedNext }: GoalsStepProps) {
  const briefLength = draft.goalBrief?.length || 0;
  
  // Validation errors
  const primaryError = attemptedNext && !draft.goalPrimary;
  const briefError = attemptedNext && briefLength < BRIEF_MIN_LENGTH;

  // Handlers
  const handlePrimarySelect = useCallback((id: string) => {
    setDraft({ goalPrimary: id });
  }, [setDraft]);

  const handleMetricSelect = useCallback((id: string) => {
    setDraft({ goalMetric: id });
  }, [setDraft]);

  const handleToneSelect = useCallback((id: 'executive' | 'friendly' | 'direct') => {
    setDraft({ tone: id });
  }, [setDraft]);

  const handleBriefChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft({ goalBrief: e.target.value });
  }, [setDraft]);

  const handleGuardrailToggle = useCallback((guardrail: string) => {
    const current = draft.goalGuardrails || [];
    const updated = current.includes(guardrail)
      ? current.filter(g => g !== guardrail)
      : [...current, guardrail];
    setDraft({ goalGuardrails: updated });
  }, [draft.goalGuardrails, setDraft]);

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Define your mission</h1>
      <p className="cs-subtitle">
        A short brief helps ARAS tune the campaign.
      </p>

      {/* Section 1: Primary Goal */}
      <div className="cs-goals-section">
        <h3 className="cs-goals-section-title">Primary goal</h3>
        {primaryError && (
          <p className="cs-field-error">Please choose a primary goal.</p>
        )}
        <div className="cs-goals-grid cs-goals-grid--2col">
          {PRIMARY_GOALS.map((goal) => {
            const isSelected = draft.goalPrimary === goal.id;
            const Icon = goal.icon;
            return (
              <button
                key={goal.id}
                type="button"
                className={`cs-goals-card ${isSelected ? 'cs-goals-card--selected' : ''}`}
                onClick={() => handlePrimarySelect(goal.id)}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="cs-goals-badge">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
                <Icon size={20} strokeWidth={1.5} />
                <span className="cs-goals-card-label">{goal.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Success Metric */}
      <div className="cs-goals-section">
        <h3 className="cs-goals-section-title">Success metric (optional)</h3>
        <div className="cs-goals-grid cs-goals-grid--2col">
          {SUCCESS_METRICS.map((metric) => {
            const isSelected = draft.goalMetric === metric.id;
            const Icon = metric.icon;
            return (
              <button
                key={metric.id}
                type="button"
                className={`cs-goals-card ${isSelected ? 'cs-goals-card--selected' : ''}`}
                onClick={() => handleMetricSelect(metric.id)}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="cs-goals-badge">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
                <Icon size={20} strokeWidth={1.5} />
                <span className="cs-goals-card-label">{metric.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 3: Brief */}
      <div className="cs-goals-section">
        <h3 className="cs-goals-section-title">Campaign brief</h3>
        <p className="cs-goals-section-desc">
          Describe your offer, target audience, and key value proposition.
        </p>
        {briefError && (
          <p className="cs-field-error">Please add a short brief (min 40 characters).</p>
        )}
        <div className="cs-goals-brief-container">
          <Textarea
            className="cs-goals-brief-textarea"
            placeholder={BRIEF_PLACEHOLDER}
            value={draft.goalBrief || ''}
            onChange={handleBriefChange}
            aria-label="Campaign brief"
          />
          <span className={`cs-goals-brief-hint ${briefLength >= BRIEF_MIN_LENGTH ? 'cs-goals-brief-hint--valid' : ''}`}>
            {briefLength} / {BRIEF_MIN_LENGTH} min
          </span>
        </div>
      </div>

      {/* Section 4: Tone */}
      <div className="cs-goals-section">
        <h3 className="cs-goals-section-title">Communication tone</h3>
        <div className="cs-goals-grid cs-goals-grid--3col">
          {TONE_OPTIONS.map((option) => {
            const isSelected = draft.tone === option.id;
            const Icon = option.icon;
            return (
              <button
                key={option.id}
                type="button"
                className={`cs-goals-card cs-goals-card--tone ${isSelected ? 'cs-goals-card--selected' : ''}`}
                onClick={() => handleToneSelect(option.id)}
                aria-pressed={isSelected}
              >
                {isSelected && (
                  <span className="cs-goals-badge">
                    <Check size={12} strokeWidth={2.5} />
                  </span>
                )}
                <Icon size={20} strokeWidth={1.5} />
                <span className="cs-goals-card-label">{option.label}</span>
                <span className="cs-goals-card-desc">{option.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 5: Guardrails */}
      <div className="cs-goals-section">
        <h3 className="cs-goals-section-title">Guardrails (optional)</h3>
        <div className="cs-goals-chips">
          {GUARDRAILS.map((guardrail) => {
            const isActive = draft.goalGuardrails?.includes(guardrail);
            return (
              <button
                key={guardrail}
                type="button"
                className={`cs-goals-chip ${isActive ? 'cs-goals-chip--active' : ''}`}
                onClick={() => handleGuardrailToggle(guardrail)}
                aria-pressed={isActive}
              >
                {isActive && <Check size={12} strokeWidth={2.5} />}
                {guardrail}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compliance Info */}
      <div className="cs-goals-compliance">
        <div className="cs-goals-compliance-icon">
          <Shield size={18} />
        </div>
        <div>
          <h4 className="cs-goals-compliance-title">Compliance</h4>
          <p className="cs-goals-compliance-text">
            Your campaign respects opt-out and clear intent. No technical details are shown externally.
          </p>
        </div>
      </div>
    </div>
  );
}
