/**
 * Google Analytics 4 Utility Functions
 * Handles event tracking, page views, and UTM parameter capture
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string,
      config?: any
    ) => void;
    dataLayer?: any[];
  }
}

/**
 * Track a custom event in Google Analytics
 * @param eventName - Name of the event (e.g., 'signup_completed', 'cta_clicked')
 * @param params - Optional parameters to send with the event
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
    console.log(`[Analytics] Event tracked: ${eventName}`, params);
  }
}

/**
 * Track a page view in Google Analytics
 * @param url - The page URL to track
 * @param title - Optional page title
 */
export function trackPageView(url: string, title?: string) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', 'G-K51SNZ2K5S', {
      page_path: url,
      page_title: title,
    });
    console.log(`[Analytics] Page view tracked: ${url}`);
  }
}

/**
 * Capture UTM parameters from the current URL
 * @returns Object containing all UTM parameters
 */
export function captureUTMParameters(): Record<string, string | null> {
  if (typeof window === 'undefined') return {};
  
  const params = new URLSearchParams(window.location.search);
  const utmParams = {
    utm_source: params.get('utm_source'),
    utm_medium: params.get('utm_medium'),
    utm_campaign: params.get('utm_campaign'),
    utm_term: params.get('utm_term'),
    utm_content: params.get('utm_content'),
  };

  // Store in sessionStorage for later use
  if (Object.values(utmParams).some(v => v !== null)) {
    sessionStorage.setItem('utm_params', JSON.stringify(utmParams));
    console.log('[Analytics] UTM parameters captured:', utmParams);
  }

  return utmParams;
}

/**
 * Get stored UTM parameters from sessionStorage
 * @returns Object containing stored UTM parameters
 */
export function getStoredUTMParameters(): Record<string, string | null> {
  if (typeof window === 'undefined') return {};
  
  const stored = sessionStorage.getItem('utm_params');
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.error('[Analytics] Failed to parse stored UTM params:', e);
      return {};
    }
  }
  return {};
}

/**
 * Track user signup with UTM parameters
 * @param method - Signup method (e.g., 'email', 'google', 'github')
 * @param userId - Optional user ID
 */
export function trackSignup(method: string = 'email', userId?: string) {
  const utmParams = getStoredUTMParameters();
  trackEvent('signup_completed', {
    method,
    user_id: userId,
    ...utmParams,
  });
}

/**
 * Track user login
 * @param method - Login method (e.g., 'email', 'google', 'github')
 * @param userId - Optional user ID
 */
export function trackLogin(method: string = 'email', userId?: string) {
  trackEvent('login_completed', {
    method,
    user_id: userId,
  });
}

/**
 * Track CTA button clicks
 * @param buttonText - Text of the button clicked
 * @param page - Page where the button was clicked
 * @param destination - Where the button leads to
 */
export function trackCTAClick(buttonText: string, page: string, destination?: string) {
  trackEvent('cta_clicked', {
    button_text: buttonText,
    page,
    destination,
  });
}

/**
 * Track form submissions
 * @param formName - Name of the form submitted
 * @param success - Whether the submission was successful
 */
export function trackFormSubmit(formName: string, success: boolean = true) {
  trackEvent('form_submit', {
    form_name: formName,
    success,
  });
}

/**
 * Initialize analytics and capture UTM parameters on page load
 */
export function initializeAnalytics() {
  if (typeof window !== 'undefined') {
    // Capture UTM parameters on initial load
    captureUTMParameters();
    
    // Track initial page view
    trackPageView(window.location.pathname + window.location.search);
    
    console.log('[Analytics] Google Analytics initialized');
  }
}
