import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

interface PremiumCheckoutFormProps {
  packageName: string;
  price: number;
  clientSecret: string;
  onSuccess: () => void;
}

export default function PremiumCheckoutForm({ packageName, price, clientSecret, onSuccess }: PremiumCheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/dashboard',
      },
    });

    if (submitError) {
      setError(submitError.message || "Ein Fehler ist aufgetreten");
      setIsLoading(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Zahlungsmethode</p>
            <PaymentElement />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 rounded-lg p-4 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || isLoading}
            className="w-full py-4 rounded-xl text-[15px] font-semibold text-white bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 shadow-2xl hover:shadow-3xl hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Verarbeitung...</span>
              </>
            ) : (
              "ZAHLUNG PFLICHTIG ABSCHLIESSEN"
            )}
          </button>
    </form>
  );
}
