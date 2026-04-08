import { Check, MessageCircle } from "lucide-react";
import type { CampaignStudioDraft } from "../types";
import { InfoDot } from "../InfoDot";

// ============================================================================
// Package Definitions
// ============================================================================
interface CallPackage {
  calls: number;
  pricePerCallCents: number;
  label: string;
  badge?: string;
}

const CALL_PACKAGES: CallPackage[] = [
  { calls: 2500, pricePerCallCents: 39, label: 'Starter' },
  { calls: 5000, pricePerCallCents: 35, label: 'Growth', badge: 'Popular' },
  { calls: 10000, pricePerCallCents: 32, label: 'Scale' },
  { calls: 20000, pricePerCallCents: 28, label: 'Pro', badge: 'Best value' },
  { calls: 50000, pricePerCallCents: 24, label: 'Enterprise' },
  { calls: 100000, pricePerCallCents: 20, label: 'Mass' },
];

// ============================================================================
// Formatters
// ============================================================================
const formatCalls = (calls: number): string => {
  return new Intl.NumberFormat('de-DE').format(calls);
};

const formatPricePerCall = (cents: number): string => {
  return `€${(cents / 100).toFixed(2)}`;
};

const formatTotal = (cents: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
};

// ============================================================================
// Component
// ============================================================================
interface VolumePricingStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export default function VolumePricingStep({ draft, setDraft, attemptedNext }: VolumePricingStepProps) {
  const showError = attemptedNext && !draft.callVolume;

  const handleSelect = (pkg: CallPackage) => {
    setDraft({
      callVolume: pkg.calls,
      pricePerCallCents: pkg.pricePerCallCents,
      computedTotalCents: pkg.calls * pkg.pricePerCallCents,
      currency: 'eur',
    });
  };

  // Find selected package for summary
  const selectedPkg = CALL_PACKAGES.find(p => p.calls === draft.callVolume);

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Choose your call volume</h1>
      <p className="cs-subtitle">
        You pay per call volume. Conversations are unlimited.
      </p>

      {showError && (
        <p className="cs-field-error cs-field-error--centered">
          Please choose a call package to continue.
        </p>
      )}

      {/* Package Cards Grid */}
      <div className="cs-volume-grid">
        {CALL_PACKAGES.map((pkg) => {
          const isSelected = draft.callVolume === pkg.calls;
          const total = pkg.calls * pkg.pricePerCallCents;

          return (
            <button
              key={pkg.calls}
              type="button"
              className={`cs-volume-card ${isSelected ? 'cs-volume-card--selected' : ''}`}
              onClick={() => handleSelect(pkg)}
              aria-pressed={isSelected}
            >
              {/* Badges */}
              <div className="cs-volume-badges">
                {pkg.badge && !isSelected && (
                  <span className="cs-volume-badge cs-volume-badge--highlight">
                    {pkg.badge}
                  </span>
                )}
                {isSelected && (
                  <span className="cs-volume-badge cs-volume-badge--selected">
                    <Check size={12} strokeWidth={2.5} />
                    Selected
                  </span>
                )}
              </div>

              {/* Label */}
              <span className="cs-volume-label">{pkg.label}</span>

              {/* Calls (big number) */}
              <span className="cs-volume-calls">{formatCalls(pkg.calls)}</span>
              <span className="cs-volume-calls-unit">calls</span>

              {/* Price per call */}
              <span className="cs-volume-price-per">
                {formatPricePerCall(pkg.pricePerCallCents)} / call
              </span>

              {/* Divider */}
              <div className="cs-volume-divider" />

              {/* Total */}
              <span className="cs-volume-total">{formatTotal(total)}</span>
            </button>
          );
        })}
      </div>

      {/* Summary Panel */}
      <div className="cs-volume-summary">
        {selectedPkg ? (
          <>
            <div className="cs-volume-summary-row">
              <span className="cs-volume-summary-label">Selected volume</span>
              <span className="cs-volume-summary-value">{formatCalls(selectedPkg.calls)} calls</span>
            </div>
            <div className="cs-volume-summary-row">
              <span className="cs-volume-summary-label">Price per call</span>
              <span className="cs-volume-summary-value">{formatPricePerCall(selectedPkg.pricePerCallCents)}</span>
            </div>
            <div className="cs-volume-summary-divider" />
            <div className="cs-volume-summary-row cs-volume-summary-row--total">
              <span className="cs-volume-summary-label">Total</span>
              <span className="cs-volume-summary-value cs-volume-summary-value--total">
                {formatTotal(selectedPkg.calls * selectedPkg.pricePerCallCents)}
              </span>
            </div>
            <div className="cs-volume-summary-chip">
              <MessageCircle size={14} />
              Unlimited conversations
              <InfoDot 
                title="Unlimited conversations" 
                body="You only pay for purchased call volume. Conversations per call aren't capped." 
              />
            </div>
            <p className="cs-volume-summary-note">
              VAT may apply based on your location.
              <InfoDot 
                title="Tax information" 
                body="Final tax amount will be calculated at checkout based on your billing address." 
              />
            </p>
          </>
        ) : (
          <p className="cs-volume-summary-empty">Select a package to see pricing.</p>
        )}
      </div>
    </div>
  );
}
