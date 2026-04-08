import { useState, useEffect, useRef, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Globe, Building2, Briefcase, MessageSquare, Target, Loader2, SkipForward, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { CampaignStudioDraft, CompanySnapshot } from "../types";

type ScanStatus = 'idle' | 'scanning' | 'done' | 'error';

interface CompanyScanStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

// ============================================================================
// Helpers
// ============================================================================
function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }
  return url;
}

function isValidUrl(input: string): boolean {
  try {
    const normalized = normalizeUrl(input);
    if (!normalized) return false;
    new URL(normalized);
    return true;
  } catch {
    return false;
  }
}

function extractDomain(url: string): string {
  try {
    const normalized = normalizeUrl(url);
    const parsed = new URL(normalized);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function guessIndustry(domain: string): string {
  const d = domain.toLowerCase();
  if (/solar|pv|energy|power|green/.test(d)) return 'Energy / Solar';
  if (/real|immo|estate|property|home/.test(d)) return 'Real Estate';
  if (/law|legal|attorney|anwalt/.test(d)) return 'Legal Services';
  if (/finance|bank|invest|versicher/.test(d)) return 'Finance & Insurance';
  if (/tech|software|app|digital|saas/.test(d)) return 'Technology';
  if (/health|medical|clinic|arzt|doctor/.test(d)) return 'Healthcare';
  return 'Business Services';
}

function generateSnapshot(websiteUrl: string): CompanySnapshot {
  const domain = extractDomain(websiteUrl);
  const industry = guessIndustry(domain);
  return {
    domain,
    industryGuess: industry,
    offerSummary: `Services and solutions from ${domain}`,
    toneSuggestion: 'executive',
    suggestedUseCases: ['Appointment setting', 'Lead qualification', 'Winback'],
    confidence: 0.62 + Math.random() * 0.13, // 0.62-0.75
  };
}

// ============================================================================
// Component
// ============================================================================
export default function CompanyScanStep({ draft, setDraft }: CompanyScanStepProps) {
  const prefersReducedMotion = useReducedMotion();
  
  // Local state
  const [websiteInput, setWebsiteInput] = useState(draft.websiteUrl || '');
  const [status, setStatus] = useState<ScanStatus>(draft.companySnapshot ? 'done' : 'idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressIndex, setProgressIndex] = useState(draft.companySnapshot ? 4 : 0);
  const scanRunIdRef = useRef(0);
  
  // Insight cards data
  const [snapshot, setSnapshot] = useState<CompanySnapshot | null>(draft.companySnapshot || null);

  // Sync websiteInput to draft when changed
  useEffect(() => {
    if (websiteInput !== draft.websiteUrl) {
      setDraft({ websiteUrl: websiteInput });
    }
  }, [websiteInput, draft.websiteUrl, setDraft]);

  // Scan handler
  const handleScan = useCallback(() => {
    // Validate
    if (!websiteInput.trim()) {
      setErrorMsg('Please enter a website URL');
      setStatus('error');
      return;
    }
    
    if (!isValidUrl(websiteInput)) {
      setErrorMsg('Please enter a valid URL (e.g., company.com)');
      setStatus('error');
      return;
    }

    // Reset and start scan
    setErrorMsg(null);
    setStatus('scanning');
    setProgressIndex(0);
    
    const currentRunId = ++scanRunIdRef.current;
    const newSnapshot = generateSnapshot(websiteInput);
    setSnapshot(newSnapshot);

    // Staged reveal: 4 cards at 450ms intervals
    const totalCards = 4;
    let currentIndex = 0;

    const interval = setInterval(() => {
      // Check if this run is still valid
      if (scanRunIdRef.current !== currentRunId) {
        clearInterval(interval);
        return;
      }

      currentIndex++;
      setProgressIndex(currentIndex);

      if (currentIndex >= totalCards) {
        clearInterval(interval);
        // Complete
        setStatus('done');
        setDraft({ 
          websiteUrl: websiteInput,
          companySnapshot: newSnapshot,
          tone: newSnapshot.toneSuggestion, // Pre-fill tone from suggestion
        });
      }
    }, 450);

    return () => clearInterval(interval);
  }, [websiteInput, setDraft]);

  // Skip handler
  const handleSkip = useCallback(() => {
    setStatus('done');
    setSnapshot(null);
    setDraft({ 
      websiteUrl: websiteInput || undefined,
      companySnapshot: undefined,
    });
  }, [websiteInput, setDraft]);

  // Rescan handler
  const handleRescan = useCallback(() => {
    setStatus('idle');
    setProgressIndex(0);
    setSnapshot(null);
  }, []);

  // Animation variants
  const cardVariants = {
    hidden: prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
    visible: prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
  };

  const transition = {
    duration: prefersReducedMotion ? 0.08 : 0.18,
    ease: [0.32, 0.72, 0, 1],
  };

  // Insight cards config
  const insightCards = snapshot ? [
    { icon: Globe, label: 'Domain detected', value: snapshot.domain },
    { icon: Building2, label: 'Industry guess', value: snapshot.industryGuess },
    { icon: Target, label: 'Suggested use cases', chips: snapshot.suggestedUseCases },
    { icon: MessageSquare, label: 'Recommended tone', chip: snapshot.toneSuggestion },
  ] : [];

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Let ARAS understand your business</h1>
      <p className="cs-subtitle">
        Paste your website — ARAS Engine will suggest the best campaign setup.
      </p>

      {/* Website Input */}
      <div className="cs-scan-input-section">
        <label htmlFor="websiteUrl" className="cs-field-label">Website</label>
        <Input
          id="websiteUrl"
          type="text"
          placeholder="company.com"
          value={websiteInput}
          onChange={(e) => {
            setWebsiteInput(e.target.value);
            if (status === 'error') setErrorMsg(null);
          }}
          disabled={status === 'scanning'}
          className={`cs-input cs-input--large ${status === 'error' ? 'cs-input--error' : ''}`}
        />
        <p className="cs-helper-text cs-helper-text--subtle">
          No technical details are ever shown externally.
        </p>
        {errorMsg && <p className="cs-field-error">{errorMsg}</p>}
      </div>

      {/* Actions */}
      <div className="cs-scan-actions">
        {status === 'done' ? (
          <button
            type="button"
            className="cs-btn cs-btn--scan"
            onClick={handleRescan}
          >
            <RefreshCw size={18} />
            <span>Rescan</span>
          </button>
        ) : (
          <button
            type="button"
            className="cs-btn cs-btn--scan"
            onClick={handleScan}
            disabled={status === 'scanning'}
          >
            {status === 'scanning' ? (
              <>
                <Loader2 size={18} className="cs-spin" />
                <span>Scanning…</span>
              </>
            ) : (
              <>
                <Globe size={18} />
                <span>Scan with ARAS Engine</span>
              </>
            )}
          </button>
        )}
        
        {status !== 'done' && (
          <button
            type="button"
            className="cs-btn cs-btn--skip"
            onClick={handleSkip}
            disabled={status === 'scanning'}
          >
            <SkipForward size={16} />
            <span>Skip</span>
          </button>
        )}
      </div>

      {/* Scanning Progress */}
      {status === 'scanning' && (
        <div className="cs-scan-progress">
          <div className="cs-scan-progress-track">
            <div 
              className="cs-scan-progress-fill"
              style={{ width: `${(progressIndex / 4) * 100}%` }}
            />
          </div>
          <p className="cs-scan-status-text">Analyzing website…</p>
        </div>
      )}

      {/* Insight Cards (staged reveal during scan, full display when done) */}
      {(status === 'scanning' || status === 'done') && snapshot && (
        <div className="cs-insight-cards">
          {insightCards.map((card, index) => (
            (status === 'done' || index < progressIndex) && (
              <motion.div
                key={card.label}
                className="cs-insight-card"
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ ...transition, delay: status === 'done' ? 0 : 0 }}
              >
                <div className="cs-insight-icon">
                  <card.icon size={20} strokeWidth={1.5} />
                </div>
                <div className="cs-insight-content">
                  <span className="cs-insight-label">{card.label}</span>
                  {card.value && <span className="cs-insight-value">{card.value}</span>}
                  {card.chips && (
                    <div className="cs-insight-chips">
                      {card.chips.map(chip => (
                        <span key={chip} className="cs-insight-chip">{chip}</span>
                      ))}
                    </div>
                  )}
                  {card.chip && (
                    <span className="cs-insight-chip cs-insight-chip--tone">{card.chip}</span>
                  )}
                </div>
              </motion.div>
            )
          ))}
        </div>
      )}

      {/* Done State Summary */}
      {status === 'done' && snapshot && (
        <p className="cs-scan-summary-note">
          You can refine these suggestions in the next steps.
        </p>
      )}

      {/* Skipped State */}
      {status === 'done' && !snapshot && (
        <div className="cs-skipped-note">
          <Briefcase size={20} strokeWidth={1.5} />
          <p>Scan skipped. You can configure everything manually.</p>
        </div>
      )}
    </div>
  );
}
