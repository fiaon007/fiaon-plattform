import { Building2, Users, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CampaignStudioDraft } from "../types";

interface IdentityStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

// Simple email validation
const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function IdentityStep({ draft, setDraft, attemptedNext }: IdentityStepProps) {
  // Validation states (only show errors after attempted next)
  const showErrors = attemptedNext === true;
  const typeError = showErrors && !draft.customerType;
  const nameError = showErrors && (!draft.contactName || draft.contactName.length < 2);
  const emailError = showErrors && (!draft.contactEmail || !isValidEmail(draft.contactEmail));
  const companyError = showErrors && (!draft.companyName || draft.companyName.length < 2);

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Who are you?</h1>
      <p className="cs-subtitle">
        In 8 quick steps you'll configure your call volume, voice, and launch details.
      </p>

      {/* Customer Type Selection */}
      <div className="cs-section-label">Choose your setup</div>
      <div className="cs-choices cs-choices--identity">
        <button
          type="button"
          className={`cs-choice-card cs-choice-card--identity ${draft.customerType === 'company' ? 'cs-choice-card--selected' : ''} ${typeError ? 'cs-choice-card--error' : ''}`}
          onClick={() => setDraft({ customerType: 'company' })}
          aria-pressed={draft.customerType === 'company'}
        >
          {draft.customerType === 'company' && (
            <span className="cs-choice-badge">
              <Check size={12} strokeWidth={2.5} />
            </span>
          )}
          <div className="cs-choice-icon">
            <Building2 size={26} strokeWidth={1.5} />
          </div>
          <span className="cs-choice-label">I'm a company</span>
          <span className="cs-choice-desc">Single brand, direct outreach</span>
        </button>

        <button
          type="button"
          className={`cs-choice-card cs-choice-card--identity ${draft.customerType === 'agency' ? 'cs-choice-card--selected' : ''} ${typeError ? 'cs-choice-card--error' : ''}`}
          onClick={() => setDraft({ customerType: 'agency' })}
          aria-pressed={draft.customerType === 'agency'}
        >
          {draft.customerType === 'agency' && (
            <span className="cs-choice-badge">
              <Check size={12} strokeWidth={2.5} />
            </span>
          )}
          <div className="cs-choice-icon">
            <Users size={26} strokeWidth={1.5} />
          </div>
          <span className="cs-choice-label">I'm an agency</span>
          <span className="cs-choice-desc">Multiple clients, white-label</span>
        </button>
      </div>
      {typeError && (
        <p className="cs-field-error">Please select company or agency</p>
      )}

      {/* Contact Card */}
      <div className="cs-contact-card">
        <div className="cs-section-label">Contact & company</div>
        <p className="cs-helper-text">Used for your campaign setup & invoices.</p>
        
        <div className="cs-contact-fields">
          <div className="cs-contact-row">
            <div className="cs-field">
              <label htmlFor="contactName" className="cs-field-label">Full name</label>
              <Input
                id="contactName"
                type="text"
                placeholder="John Smith"
                value={draft.contactName || ''}
                onChange={(e) => setDraft({ contactName: e.target.value })}
                className={`cs-input ${nameError ? 'cs-input--error' : ''}`}
              />
              {nameError && (
                <p className="cs-field-error">Name is required (min 2 characters)</p>
              )}
            </div>

            <div className="cs-field">
              <label htmlFor="contactEmail" className="cs-field-label">Work email</label>
              <Input
                id="contactEmail"
                type="email"
                placeholder="john@company.com"
                value={draft.contactEmail || ''}
                onChange={(e) => setDraft({ contactEmail: e.target.value })}
                className={`cs-input ${emailError ? 'cs-input--error' : ''}`}
              />
              {emailError && (
                <p className="cs-field-error">Valid email is required</p>
              )}
            </div>
          </div>

          <div className="cs-field cs-field--full">
            <label htmlFor="companyName" className="cs-field-label">Company name</label>
            <Input
              id="companyName"
              type="text"
              placeholder="Acme Inc."
              value={draft.companyName || ''}
              onChange={(e) => setDraft({ companyName: e.target.value })}
              className={`cs-input ${companyError ? 'cs-input--error' : ''}`}
            />
            {companyError && (
              <p className="cs-field-error">Company name is required (min 2 characters)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
