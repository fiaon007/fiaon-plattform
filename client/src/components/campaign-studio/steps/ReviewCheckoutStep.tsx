import { useState, useEffect, useCallback } from "react";
import { 
  Building2, 
  Phone, 
  Mic, 
  Users, 
  Target, 
  CreditCard, 
  Shield, 
  Check, 
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  RotateCcw,
  Plus
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CampaignStudioDraft } from "../types";
import { InfoDot } from "../InfoDot";

// ============================================================================
// Label Mappings
// ============================================================================
const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  company: 'Direct Company',
  agency: 'Agency / Partner',
};

const USE_CASE_LABELS: Record<string, string> = {
  'appointment-setting': 'Appointment Setting',
  'lead-qualification': 'Lead Qualification',
  'winback': 'Customer Winback',
  'event-invite': 'Event Invitation',
  'payment-reminder': 'Payment Reminder',
};

const VOICE_LABELS: Record<string, string> = {
  'voice-a': 'Aurora',
  'voice-b': 'Noah',
  'voice-c': 'Mara',
  'voice-d': 'Elias',
};

const GOAL_LABELS: Record<string, string> = {
  'book-meetings': 'Book meetings',
  'qualify-leads': 'Qualify interest',
  'winback': 'Win back customers',
  'event-invite': 'Invite to event',
};

const TONE_LABELS: Record<string, string> = {
  executive: 'Executive',
  friendly: 'Friendly',
  direct: 'Direct',
};

const LEAD_PRICE_CENTS = 5;
const RECEIPT_KEY = 'aras_campaign_studio_receipt_v1';
const RECEIPT_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Order status whitelist for "ready" states
const READY_STATUSES = ['paid', 'intake', 'in_progress', 'completed'];

// ============================================================================
// Types
// ============================================================================
interface Receipt {
  orderId: number;
  paid: boolean;
  lastSeenAt: number;
  createdAt: number; // For expiry check
  version: number;   // For future migrations
}

interface OrderEvent {
  id: number;
  type: string;
  title: string;
  description?: string | null;
  createdAt: string;
}

interface OrderFromServer {
  id: number;
  status: string;
  paymentStatus: string;
  packageCode?: string;
  targetCalls?: number;
  priceCents?: number;
  currency?: string;
  companyName?: string;
  contactName?: string;
  contactEmail?: string;
  createdAt: string;
  updatedAt: string;
  metadata?: any;
}

type TimelineStatus = 'idle' | 'loading' | 'ready' | 'error';

// ============================================================================
// Helpers
// ============================================================================
function formatPrice(cents?: number, currency = 'EUR'): string {
  if (!cents) return '€0';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatNumber(n?: number): string {
  if (!n) return '—';
  return new Intl.NumberFormat('de-DE').format(n);
}

function formatEventTime(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function loadReceipt(): Receipt | null {
  try {
    const raw = localStorage.getItem(RECEIPT_KEY);
    if (!raw) return null;
    const receipt = JSON.parse(raw) as Receipt;
    
    // Check for expiry (14 days)
    if (receipt.createdAt && Date.now() - receipt.createdAt > RECEIPT_EXPIRY_MS) {
      localStorage.removeItem(RECEIPT_KEY);
      return null;
    }
    
    return receipt;
  } catch {
    return null;
  }
}

function saveReceipt(orderId: number, paid: boolean): void {
  try {
    const now = Date.now();
    const receipt: Receipt = {
      orderId,
      paid,
      lastSeenAt: now,
      createdAt: now,
      version: 1,
    };
    localStorage.setItem(RECEIPT_KEY, JSON.stringify(receipt));
  } catch {
    // Ignore storage errors
  }
}

// ============================================================================
// Component
// ============================================================================
type CheckoutStatus = 'idle' | 'creatingOrder' | 'orderReady' | 'startingCheckout' | 'error' | 'success';

interface ReviewCheckoutStepProps {
  draft: CampaignStudioDraft;
  setDraft: (patch: Partial<CampaignStudioDraft>) => void;
  goNext?: () => void;
  goBack?: () => void;
  attemptedNext?: boolean;
}

export default function ReviewCheckoutStep({ draft }: ReviewCheckoutStepProps) {
  // State
  const [status, setStatus] = useState<CheckoutStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [orderId, setOrderId] = useState<number | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showBriefDialog, setShowBriefDialog] = useState(false);

  // Server timeline state
  const [timelineStatus, setTimelineStatus] = useState<TimelineStatus>('idle');
  const [serverEvents, setServerEvents] = useState<OrderEvent[]>([]);
  const [serverOrder, setServerOrder] = useState<OrderFromServer | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);

  // Check URL params on mount for success/cancel + hydrate from receipt
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlOrderId = params.get('order_id');
    
    if (params.get('success') === 'true') {
      setStatus('success');
      // Save receipt as paid
      if (urlOrderId) {
        const oid = parseInt(urlOrderId, 10);
        if (!isNaN(oid)) {
          setOrderId(oid);
          saveReceipt(oid, true);
        }
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('canceled') === 'true') {
      // Restore orderId from URL if available
      if (urlOrderId) {
        const oid = parseInt(urlOrderId, 10);
        if (!isNaN(oid)) {
          setOrderId(oid);
          setStatus('orderReady');
        }
      }
      setErrorMessage('Checkout was canceled. You can try again when ready.');
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else {
      // No success/cancel → try hydrating from receipt
      const receipt = loadReceipt();
      if (receipt && receipt.orderId) {
        setOrderId(receipt.orderId);
        if (receipt.paid) {
          setStatus('success');
        } else {
          setStatus('orderReady');
        }
      }
    }
  }, []);

  // Fetch order detail + events when orderId changes
  useEffect(() => {
    if (!orderId) return;

    const fetchOrderDetail = async () => {
      setTimelineStatus('loading');
      try {
        const response = await fetch(`/api/service-orders/${orderId}`, {
          credentials: 'include',
        });

        if (!response.ok) {
          setTimelineStatus('error');
          return;
        }

        const data = await response.json();
        setServerOrder(data.order);
        setServerEvents(data.events || []);
        setTimelineStatus('ready');

        // Trust server for paid status
        if (data.order?.paymentStatus === 'paid' && status !== 'success') {
          setStatus('success');
          saveReceipt(orderId, true);
        }
      } catch {
        setTimelineStatus('error');
      }
    };

    fetchOrderDetail();
  }, [orderId, status]);

  // Compute totals
  const callsTotalCents = draft.computedTotalCents || 0;
  const leadsTotalCents = draft.leadsMode === 'need' && draft.leadPackageSize 
    ? draft.leadPackageSize * LEAD_PRICE_CENTS 
    : 0;
  const grandTotalCents = callsTotalCents + leadsTotalCents;

  // Create order
  const handleCreateOrder = useCallback(async () => {
    if (status === 'creatingOrder') return;
    
    setStatus('creatingOrder');
    setErrorMessage('');

    try {
      // Generate packageCode from callVolume (server-authoritative pricing)
      const packageCode = `calls_${draft.callVolume}`;

      const response = await fetch('/api/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName: draft.companyName,
          contactName: draft.contactName,
          contactEmail: draft.contactEmail,
          packageCode,
          targetCalls: draft.callVolume,
          currency: 'eur',
          // Leads fields (server validates)
          leadsMode: draft.leadsMode,
          leadPackageSize: draft.leadPackageSize,
          leadFilters: draft.leadFilters,
          // Metadata for campaign config (no pricing - server computes)
          metadata: {
            customerType: draft.customerType,
            useCaseId: draft.useCaseId,
            voiceId: draft.voiceId,
            goalPrimary: draft.goalPrimary,
            goalMetric: draft.goalMetric,
            goalBrief: draft.goalBrief,
            goalGuardrails: draft.goalGuardrails,
            tone: draft.tone,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error codes
        if (errorData.code === 'INVALID_PRICING') {
          setStatus('error');
          setErrorMessage('Please re-check your call package selection.');
          return;
        }
        if (errorData.code === 'MISSING_FIELDS') {
          setStatus('error');
          setErrorMessage('Missing required information. Please complete all steps.');
          return;
        }
        
        throw new Error(errorData.error || 'Failed to create order');
      }

      const order = await response.json();
      setOrderId(order.id);
      setStatus('orderReady');
      // Save receipt (not yet paid)
      saveReceipt(order.id, false);
    } catch (err) {
      console.error('Create order error:', err);
      setStatus('error');
      setErrorMessage('We couldn\'t create your order. Please try again.');
    }
  }, [status, draft]);

  // Start checkout
  const handleStartCheckout = useCallback(async () => {
    if (!orderId || status === 'startingCheckout' || !consentChecked) return;

    setStatus('startingCheckout');
    setErrorMessage('');

    try {
      const response = await fetch(`/api/service-orders/${orderId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle 409 Already Paid → show success
        if (response.status === 409 && errorData.code === 'ALREADY_PAID') {
          setStatus('success');
          return;
        }
        
        throw new Error(errorData.error || 'Failed to start checkout');
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setStatus('error');
      setErrorMessage('We couldn\'t start checkout. Please try again.');
    }
  }, [orderId, status, consentChecked]);

  // Retry handler
  const handleRetry = useCallback(() => {
    setStatus('idle');
    setErrorMessage('');
    setOrderId(null);
  }, []);

  // Success state
  if (status === 'success') {
    // Build admin dashboard links
    const deepLink = orderId 
      ? `/admin-dashboard?tab=service-orders&orderId=${orderId}`
      : '/admin-dashboard';
    const fallbackLink = '/admin-dashboard';

    // Navigate handler with fallback guard
    const handleGoToDashboard = () => {
      window.location.href = deepLink;
      // Fallback after 800ms if navigation blocked
      setTimeout(() => {
        if (document.visibilityState === 'visible' && window.location.pathname.includes('/campaign-studio')) {
          window.location.href = fallbackLink;
        }
      }, 800);
    };

    // Check if order is being prepared (paid but not in ready status)
    const isPreparing = serverOrder && 
      serverOrder.paymentStatus === 'paid' && 
      !READY_STATUSES.includes(serverOrder.status);

    return (
      <div className="cs-step-content">
        <div className="cs-result-card">
          <div className="cs-result-icon cs-result-icon--success">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="cs-result-title">Payment received!</h2>
          <p className="cs-result-text">
            Your campaign order is ready for launch. Our team will begin setup shortly.
          </p>

          {/* Status Banner: Preparing */}
          {isPreparing && (
            <div className="cs-status-banner" style={{
              padding: '14px 16px',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 'var(--aras-r-md)',
              background: 'rgba(255,255,255,0.02)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              marginBottom: 16,
              width: '100%',
              maxWidth: 320,
            }}>
              <Loader2 size={18} style={{ opacity: 0.7, flexShrink: 0, marginTop: 2 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                  We're preparing your campaign setup.
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                  You can already review your order in the dashboard.
                </span>
              </div>
            </div>
          )}

          <div className="cs-result-actions">
            <button
              type="button"
              className="cs-result-btn-primary"
              onClick={handleGoToDashboard}
            >
              Go to Admin Dashboard
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="cs-result-btn-secondary"
              onClick={() => {
                // Clear receipt and reload wizard
                localStorage.removeItem(RECEIPT_KEY);
                window.location.href = '/campaign-studio';
              }}
            >
              <Plus size={14} />
              Start another campaign
            </button>
          </div>

          {/* Fallback micro-link */}
          <p style={{ 
            fontSize: 13, 
            color: 'rgba(255,255,255,0.5)', 
            marginTop: 16,
            textAlign: 'center',
          }}>
            If the order doesn't open automatically,{' '}
            <a 
              href={fallbackLink}
              style={{ 
                color: 'rgba(255,255,255,0.75)', 
                textDecoration: 'underline',
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.75'}
            >
              open the dashboard
            </a>.
          </p>

          {/* Server Timeline on Success */}
          {orderId && timelineStatus === 'ready' && serverEvents.length > 0 && (
            <div className="cs-timeline" style={{ marginTop: 24, width: '100%', maxWidth: 300 }}>
              <p className="cs-sectionTitle" style={{ marginBottom: 8, textAlign: 'left' }}>Order Timeline</p>
              {serverEvents.slice(0, 5).map((event) => (
                <div key={event.id} className="cs-timeline-item">
                  <div className={`cs-timeline-dot ${event.type === 'paid' ? 'cs-timeline-dot--done' : 'cs-timeline-dot--done'}`} />
                  <span className="cs-timeline-text">
                    {event.title}
                    <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 11 }}>
                      {formatEventTime(event.createdAt)}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Canceled state (show gentle retry card)
  if (errorMessage && errorMessage.includes('canceled')) {
    return (
      <div className="cs-step-content">
        <div className="cs-result-card">
          <div className="cs-result-icon cs-result-icon--cancel">
            <RotateCcw size={32} />
          </div>
          <h2 className="cs-result-title">Checkout canceled</h2>
          <p className="cs-result-text">
            No worries — your order is saved. You can retry checkout when ready.
          </p>
          <div className="cs-result-actions">
            <button
              type="button"
              className="cs-result-btn-primary"
              onClick={handleRetry}
            >
              Retry checkout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cs-step-content">
      <h1 className="cs-title arasWaveTitle">Review & Launch</h1>
      <p className="cs-subtitle">
        Review your campaign configuration before checkout.
      </p>

      {errorMessage && !errorMessage.includes('canceled') && (
        <div className="cs-review-error" role="alert">
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
          <button type="button" onClick={handleRetry} className="cs-review-error-retry">
            Retry
          </button>
        </div>
      )}

      <div className="cs-review-layout">
        {/* Left: Summary Sections */}
        <div className="cs-review-summary">
          {/* Identity */}
          <div className="cs-review-section">
            <div className="cs-review-section-header">
              <Building2 size={16} />
              <h3>Identity</h3>
            </div>
            <div className="cs-review-grid">
              <div className="cs-review-item">
                <span className="cs-review-label">Type</span>
                <span className="cs-review-value">{CUSTOMER_TYPE_LABELS[draft.customerType || ''] || '—'}</span>
              </div>
              <div className="cs-review-item">
                <span className="cs-review-label">Contact</span>
                <span className="cs-review-value">{draft.contactName || '—'}</span>
              </div>
              <div className="cs-review-item">
                <span className="cs-review-label">Email</span>
                <span className="cs-review-value">{draft.contactEmail || '—'}</span>
              </div>
              <div className="cs-review-item">
                <span className="cs-review-label">Company</span>
                <span className="cs-review-value">{draft.companyName || '—'}</span>
              </div>
            </div>
          </div>

          {/* Playbook */}
          <div className="cs-review-section">
            <div className="cs-review-section-header">
              <Target size={16} />
              <h3>Playbook</h3>
            </div>
            <div className="cs-review-grid">
              <div className="cs-review-item">
                <span className="cs-review-label">Use Case</span>
                <span className="cs-review-value">{USE_CASE_LABELS[draft.useCaseId || ''] || draft.useCaseId || '—'}</span>
              </div>
            </div>
          </div>

          {/* Volume */}
          <div className="cs-review-section">
            <div className="cs-review-section-header">
              <Phone size={16} />
              <h3>Volume & Pricing</h3>
            </div>
            <div className="cs-review-grid">
              <div className="cs-review-item">
                <span className="cs-review-label">Calls</span>
                <span className="cs-review-value">{formatNumber(draft.callVolume)}</span>
              </div>
              <div className="cs-review-item">
                <span className="cs-review-label">Price/Call</span>
                <span className="cs-review-value">{draft.pricePerCallCents ? `€${(draft.pricePerCallCents / 100).toFixed(2)}` : '—'}</span>
              </div>
              <div className="cs-review-item">
                <span className="cs-review-label">Calls Total</span>
                <span className="cs-review-value cs-review-value--highlight">{formatPrice(callsTotalCents)}</span>
              </div>
            </div>
          </div>

          {/* Voice */}
          <div className="cs-review-section">
            <div className="cs-review-section-header">
              <Mic size={16} />
              <h3>Voice</h3>
            </div>
            <div className="cs-review-grid">
              <div className="cs-review-item">
                <span className="cs-review-label">Selected Voice</span>
                <span className="cs-review-value">{VOICE_LABELS[draft.voiceId || ''] || draft.voiceId || '—'}</span>
              </div>
            </div>
          </div>

          {/* Leads */}
          <div className="cs-review-section">
            <div className="cs-review-section-header">
              <Users size={16} />
              <h3>Leads</h3>
            </div>
            <div className="cs-review-grid">
              <div className="cs-review-item">
                <span className="cs-review-label">Mode</span>
                <span className="cs-review-value">
                  {draft.leadsMode === 'have' ? 'Own leads' : draft.leadsMode === 'need' ? 'ARAS leads' : '—'}
                </span>
              </div>
              {draft.leadsMode === 'need' && draft.leadPackageSize && (
                <>
                  <div className="cs-review-item">
                    <span className="cs-review-label">Lead Package</span>
                    <span className="cs-review-value">{formatNumber(draft.leadPackageSize)} leads</span>
                  </div>
                  <div className="cs-review-item">
                    <span className="cs-review-label">Leads Total</span>
                    <span className="cs-review-value cs-review-value--highlight">{formatPrice(leadsTotalCents)}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Goals */}
          <div className="cs-review-section">
            <div className="cs-review-section-header">
              <Target size={16} />
              <h3>Goals</h3>
            </div>
            <div className="cs-review-grid">
              <div className="cs-review-item">
                <span className="cs-review-label">Primary Goal</span>
                <span className="cs-review-value">{GOAL_LABELS[draft.goalPrimary || ''] || draft.goalPrimary || '—'}</span>
              </div>
              <div className="cs-review-item">
                <span className="cs-review-label">Tone</span>
                <span className="cs-review-value">{TONE_LABELS[draft.tone || ''] || '—'}</span>
              </div>
              {draft.goalBrief && (
                <div className="cs-review-item cs-review-item--full">
                  <span className="cs-review-label">Brief</span>
                  <span className="cs-review-value cs-review-brief">
                    {draft.goalBrief.length > 150 
                      ? `${draft.goalBrief.slice(0, 150)}...` 
                      : draft.goalBrief}
                    {draft.goalBrief.length > 150 && (
                      <button 
                        type="button" 
                        className="cs-review-show-more"
                        onClick={() => setShowBriefDialog(true)}
                      >
                        Show more
                      </button>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Total & Checkout */}
        <div className="cs-review-checkout">
          <div className="cs-review-total-card">
            <h3 className="cs-review-total-title">Total today</h3>
            
            <div className="cs-review-total-rows">
              <div className="cs-review-total-row">
                <span>Calls ({formatNumber(draft.callVolume)})</span>
                <span>{formatPrice(callsTotalCents)}</span>
              </div>
              {leadsTotalCents > 0 && (
                <div className="cs-review-total-row">
                  <span>Leads ({formatNumber(draft.leadPackageSize)})</span>
                  <span>{formatPrice(leadsTotalCents)}</span>
                </div>
              )}
              <div className="cs-review-total-divider" />
              <div className="cs-review-total-row cs-review-total-row--grand">
                <span>Grand Total</span>
                <span>{formatPrice(grandTotalCents)}</span>
              </div>
            </div>

            <p className="cs-review-total-vat">Taxes may apply based on your location.</p>

            {/* Consent */}
            <label className="cs-review-consent">
              <Checkbox
                checked={consentChecked}
                onCheckedChange={(checked) => setConsentChecked(checked === true)}
              />
              <span>
                I confirm I'm authorized to run outbound campaigns for this company.
                <InfoDot 
                  title="Authorization" 
                  body="You confirm you have permission to contact these leads on behalf of the company." 
                />
              </span>
            </label>

            {/* Action Button */}
            {!orderId ? (
              <Button
                className="cs-review-pay-btn"
                onClick={handleCreateOrder}
                disabled={status === 'creatingOrder'}
              >
                {status === 'creatingOrder' ? (
                  <>
                    <Loader2 size={18} className="cs-spin" />
                    Creating order...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    Create order
                  </>
                )}
              </Button>
            ) : (
              <Button
                className="cs-review-pay-btn"
                onClick={handleStartCheckout}
                disabled={!consentChecked || status === 'startingCheckout'}
              >
                {status === 'startingCheckout' ? (
                  <>
                    <Loader2 size={18} className="cs-spin" />
                    Starting checkout...
                  </>
                ) : (
                  <>
                    <CreditCard size={18} />
                    Pay & launch
                  </>
                )}
              </Button>
            )}

            {/* Trust badges */}
            <div className="cs-review-trust">
              <Shield size={14} />
              <span>Secure checkout • GDPR compliant</span>
            </div>

            {/* Status Banner: Payment Pending */}
            {orderId && serverOrder && serverOrder.paymentStatus !== 'paid' && (
              <div className="cs-status-banner" style={{
                padding: '14px 16px',
                border: '1px solid rgba(255, 191, 36, 0.2)',
                borderRadius: 'var(--aras-r-md)',
                background: 'rgba(251, 191, 36, 0.08)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                marginTop: 16,
                marginBottom: 8,
              }}>
                <AlertCircle size={18} style={{ color: '#fbbf24', flexShrink: 0, marginTop: 2 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' }}>
                    Payment pending — complete checkout to launch.
                  </span>
                  <button
                    type="button"
                    onClick={handleStartCheckout}
                    disabled={!consentChecked || status === 'startingCheckout'}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--aras-orange)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      padding: 0,
                      textAlign: 'left',
                      opacity: (!consentChecked || status === 'startingCheckout') ? 0.5 : 1,
                    }}
                  >
                    {status === 'startingCheckout' ? 'Starting checkout...' : 'Retry checkout →'}
                  </button>
                </div>
              </div>
            )}

            {/* Order Timeline - Server Events */}
            {orderId && (
              <div className="cs-timeline">
                <p className="cs-sectionTitle" style={{ marginBottom: 8 }}>Order Timeline</p>
                
                {timelineStatus === 'loading' && (
                  <>
                    <div className="cs-timeline-item">
                      <div className="cs-timeline-dot" />
                      <span className="cs-timeline-text" style={{ opacity: 0.4 }}>Loading...</span>
                    </div>
                  </>
                )}

                {timelineStatus === 'error' && (
                  <div className="cs-timeline-item">
                    <span className="cs-timeline-text" style={{ color: 'rgba(255,100,100,0.8)' }}>
                      Failed to load timeline.{' '}
                      <button 
                        type="button" 
                        onClick={() => setOrderId(orderId)} 
                        style={{ color: 'var(--aras-orange)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Retry
                      </button>
                    </span>
                  </div>
                )}

                {timelineStatus === 'ready' && serverEvents.length === 0 && (
                  <div className="cs-timeline-item">
                    <div className="cs-timeline-dot" />
                    <span className="cs-timeline-text">No events yet</span>
                  </div>
                )}

                {timelineStatus === 'ready' && serverEvents.length > 0 && (
                  <>
                    {(showAllEvents ? serverEvents : serverEvents.slice(0, 6)).map((event, idx) => {
                      const isPaid = event.type === 'paid';
                      const isLast = idx === (showAllEvents ? serverEvents.length : Math.min(serverEvents.length, 6)) - 1;
                      return (
                        <div key={event.id} className="cs-timeline-item">
                          <div className={`cs-timeline-dot ${isPaid ? 'cs-timeline-dot--done' : isLast ? 'cs-timeline-dot--active' : 'cs-timeline-dot--done'}`} />
                          <span className={`cs-timeline-text ${isLast ? 'cs-timeline-text--active' : ''}`}>
                            {event.title}
                            <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 11 }}>
                              {formatEventTime(event.createdAt)}
                            </span>
                          </span>
                        </div>
                      );
                    })}
                    {serverEvents.length > 6 && !showAllEvents && (
                      <button 
                        type="button"
                        onClick={() => setShowAllEvents(true)}
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--aras-orange)', 
                          cursor: 'pointer', 
                          fontSize: 12, 
                          marginTop: 4 
                        }}
                      >
                        Show all ({serverEvents.length})
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Brief Dialog */}
      <Dialog open={showBriefDialog} onOpenChange={setShowBriefDialog}>
        <DialogContent className="cs-review-brief-dialog">
          <DialogHeader>
            <DialogTitle>Campaign Brief</DialogTitle>
          </DialogHeader>
          <p className="cs-review-brief-full">{draft.goalBrief}</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
