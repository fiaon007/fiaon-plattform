import { useMemo } from "react";
import { Upload, Users, Check, FileUp, Link2, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CampaignStudioDraft, LeadFilters } from "../types";
import { InfoDot } from "../InfoDot";

// ============================================================================
// Constants
// ============================================================================
const LEAD_PRICE_CENTS = 5; // €0.05 per lead

const REGIONS = ['DACH', 'Germany', 'Austria', 'Switzerland', 'EU', 'US'];
const INDUSTRIES = ['Any', 'Real Estate', 'Energy/Solar', 'Healthcare', 'Legal', 'Finance', 'Tech', 'Hospitality'];
const ROLE_LEVELS = ['Owner/Founder', 'C-Level', 'Director/Head', 'Any'];
const COMPANY_SIZES = ['1–10', '11–50', '51–200', '201–1000', '1000+', 'Any'];

// ============================================================================
// Helpers
// ============================================================================
function roundToNearest500(n: number, min = 1000): number {
  const rounded = Math.round(n / 500) * 500;
  return Math.max(rounded, min);
}

function computeLeadPackages(callVolume?: number): number[] {
  const base = callVolume || 10000;
  const packages = [
    roundToNearest500(base * 0.25),
    roundToNearest500(base * 0.5),
    roundToNearest500(base * 1.0),
  ];
  
  // Add 150% package only if callVolume >= 10,000
  if (base >= 10000) {
    packages.push(roundToNearest500(base * 1.5));
  }
  
  // Remove duplicates and sort
  return Array.from(new Set(packages)).sort((a, b) => a - b);
}

function formatLeads(count: number): string {
  return new Intl.NumberFormat('de-DE').format(count);
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

// ============================================================================
// Component
// ============================================================================
interface LeadsStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export default function LeadsStep({ draft, setDraft, attemptedNext }: LeadsStepProps) {
  const leadPackages = useMemo(() => computeLeadPackages(draft.callVolume), [draft.callVolume]);
  
  // Validation
  const modeError = attemptedNext && !draft.leadsMode;
  const packageError = attemptedNext && draft.leadsMode === 'need' && !draft.leadPackageSize;

  // Clear leadPackageSize if it's no longer in the computed packages
  useMemo(() => {
    if (draft.leadPackageSize && !leadPackages.includes(draft.leadPackageSize)) {
      setDraft({ leadPackageSize: undefined });
    }
  }, [leadPackages, draft.leadPackageSize, setDraft]);

  const handleModeSelect = (mode: 'have' | 'need') => {
    if (mode === 'have') {
      setDraft({ leadsMode: 'have', leadPackageSize: undefined });
    } else {
      setDraft({ leadsMode: 'need' });
    }
  };

  const handlePackageSelect = (size: number) => {
    setDraft({ leadPackageSize: size });
  };

  const handleFilterChange = (key: keyof LeadFilters, value: string) => {
    const newFilters = { ...draft.leadFilters, [key]: value === 'Any' ? undefined : value };
    setDraft({ leadFilters: newFilters });
  };

  const selectedPackage = draft.leadPackageSize;
  const selectedPriceCents = selectedPackage ? selectedPackage * LEAD_PRICE_CENTS : 0;

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Do you need leads?</h1>
      <p className="cs-subtitle">
        Bring your own list — or add curated decision-maker leads.
      </p>

      {modeError && (
        <p className="cs-field-error cs-field-error--centered">
          Please choose an option to continue.
        </p>
      )}

      {/* Mode Choice Cards */}
      <div className="cs-leads-mode-grid">
        <button
          type="button"
          className={`cs-leads-mode-card ${draft.leadsMode === 'have' ? 'cs-leads-mode-card--selected' : ''}`}
          onClick={() => handleModeSelect('have')}
          aria-pressed={draft.leadsMode === 'have'}
        >
          {draft.leadsMode === 'have' && (
            <span className="cs-leads-badge cs-leads-badge--selected">
              <Check size={12} strokeWidth={2.5} />
              Selected
            </span>
          )}
          <div className="cs-leads-mode-icon">
            <Upload size={24} strokeWidth={1.5} />
          </div>
          <span className="cs-leads-mode-title">I already have leads</span>
          <span className="cs-leads-mode-desc">Upload / integrate later.</span>
        </button>

        <button
          type="button"
          className={`cs-leads-mode-card ${draft.leadsMode === 'need' ? 'cs-leads-mode-card--selected' : ''}`}
          onClick={() => handleModeSelect('need')}
          aria-pressed={draft.leadsMode === 'need'}
        >
          {draft.leadsMode === 'need' && (
            <span className="cs-leads-badge cs-leads-badge--selected">
              <Check size={12} strokeWidth={2.5} />
              Selected
            </span>
          )}
          <div className="cs-leads-mode-icon">
            <Users size={24} strokeWidth={1.5} />
          </div>
          <span className="cs-leads-mode-title">I need leads from ARAS</span>
          <span className="cs-leads-mode-desc">Curated decision-maker contacts.</span>
        </button>
      </div>

      {/* HAVE LEADS Panel */}
      {draft.leadsMode === 'have' && (
        <div className="cs-leads-have-panel">
          <div className="cs-leads-info-card">
            <h4 className="cs-leads-info-title">Bring your own list</h4>
            <p className="cs-leads-info-text">
              You can upload or integrate leads after checkout.
            </p>
            <ul className="cs-leads-info-list">
              <li><FileUp size={14} /> CSV / Excel import</li>
              <li><Link2 size={14} /> CRM sync available</li>
            </ul>
          </div>
        </div>
      )}

      {/* NEED LEADS Panel */}
      {draft.leadsMode === 'need' && (
        <div className="cs-leads-need-panel">
          {packageError && (
            <p className="cs-field-error cs-field-error--centered">
              Please select a lead package to continue.
            </p>
          )}

          {/* Lead Packages */}
          <div className="cs-leads-section">
            <h4 className="cs-leads-section-title">Select lead package</h4>
            <p className="cs-leads-section-desc">Lead packages are optional add-ons. Exclusive pricing for ARAS customers.</p>
            
            <div className="cs-leads-packages-grid">
              {leadPackages.map((size) => {
                const isSelected = draft.leadPackageSize === size;
                const price = size * LEAD_PRICE_CENTS;

                return (
                  <button
                    key={size}
                    type="button"
                    className={`cs-leads-package-card ${isSelected ? 'cs-leads-package-card--selected' : ''}`}
                    onClick={() => handlePackageSelect(size)}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <span className="cs-leads-badge cs-leads-badge--selected">
                        <Check size={12} strokeWidth={2.5} />
                        Selected
                      </span>
                    )}
                    <span className="cs-leads-package-count">{formatLeads(size)}</span>
                    <span className="cs-leads-package-unit">leads</span>
                    <span className="cs-leads-package-price">{formatPrice(price)}</span>
                    <span className="cs-leads-package-note">One-time add-on</span>
                  </button>
                );
              })}
            </div>

            {/* Summary */}
            {selectedPackage && (
              <div className="cs-leads-summary">
                Selected: {formatLeads(selectedPackage)} leads · {formatPrice(selectedPriceCents)} one-time
              </div>
            )}
          </div>

          {/* Filters */}
          <div className="cs-leads-section">
            <h4 className="cs-leads-section-title">Filter leads (optional)</h4>
            
            <div className="cs-leads-filters-grid">
              <div className="cs-leads-filter">
                <label className="cs-leads-filter-label">Region</label>
                <Select
                  value={draft.leadFilters?.region || 'Any'}
                  onValueChange={(v) => handleFilterChange('region', v)}
                >
                  <SelectTrigger className="cs-leads-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Any">Any</SelectItem>
                    {REGIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="cs-leads-filter">
                <label className="cs-leads-filter-label">Industry</label>
                <Select
                  value={draft.leadFilters?.industry || 'Any'}
                  onValueChange={(v) => handleFilterChange('industry', v)}
                >
                  <SelectTrigger className="cs-leads-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="cs-leads-filter">
                <label className="cs-leads-filter-label">Role level</label>
                <Select
                  value={draft.leadFilters?.roleLevel || 'Any'}
                  onValueChange={(v) => handleFilterChange('roleLevel', v)}
                >
                  <SelectTrigger className="cs-leads-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_LEVELS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="cs-leads-filter">
                <label className="cs-leads-filter-label">Company size</label>
                <Select
                  value={draft.leadFilters?.companySize || 'Any'}
                  onValueChange={(v) => handleFilterChange('companySize', v)}
                >
                  <SelectTrigger className="cs-leads-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Trust Info */}
          <div className="cs-leads-info-card cs-leads-info-card--compact">
            <div className="cs-leads-info-header">
              <Sparkles size={16} />
              <h4 className="cs-leads-info-title">What you get</h4>
            </div>
            <ul className="cs-leads-info-list cs-leads-info-list--inline">
              <li>Decision-maker level contacts</li>
              <li>Structured for outbound campaigns</li>
              <li>
                Exclusive customer pricing
                <InfoDot 
                  title="Lead pricing" 
                  body="Optional add-on. Filters refine targeting. Availability may vary by region." 
                />
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
