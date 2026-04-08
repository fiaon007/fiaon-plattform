// ============================================================================
// ARAS - Safe Stripe Loader
// ============================================================================
// Lazy loads Stripe with proper error handling to prevent app crashes
// ============================================================================

import { loadStripe, Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;
let stripeLoadAttempted = false;

/**
 * Safely get Stripe instance with error handling
 * Returns null if Stripe is not available (missing key or load failure)
 */
export const getStripe = (): Promise<Stripe | null> => {
  if (stripePromise) {
    return stripePromise;
  }

  const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  
  if (!key) {
    console.warn("[Stripe] No VITE_STRIPE_PUBLIC_KEY found, Stripe disabled");
    stripePromise = Promise.resolve(null);
    return stripePromise;
  }

  if (stripeLoadAttempted) {
    // Already tried and failed
    return Promise.resolve(null);
  }

  stripeLoadAttempted = true;

  stripePromise = loadStripe(key)
    .then((stripe) => {
      if (stripe) {
        console.log("[Stripe] Loaded successfully");
      } else {
        console.warn("[Stripe] Loaded but returned null");
      }
      return stripe;
    })
    .catch((error) => {
      console.error("[Stripe] Failed to load:", error);
      // Don't let this crash the app
      stripePromise = Promise.resolve(null);
      return null;
    });

  return stripePromise;
};

/**
 * Safe stripe promise for Elements provider
 * Use this instead of direct loadStripe calls
 */
export const stripePromiseSafe = getStripe();

/**
 * Check if Stripe is available without loading it
 */
export const isStripeConfigured = (): boolean => {
  return !!import.meta.env.VITE_STRIPE_PUBLIC_KEY;
};
