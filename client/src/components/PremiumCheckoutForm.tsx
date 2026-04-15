import { useState } from "react";
import { PaymentElement, ExpressCheckoutElement, useStripe, useElements } from "@stripe/react-stripe-js";

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
        return_url: window.location.origin + '/antrag?payment_success=true',
      },
    });

    if (submitError) {
      setError(submitError.message || "Ein Fehler ist aufgetreten");
      setIsLoading(false);
    } else {
      onSuccess();
    }
  };

  const handleExpressCheckout = async (event: any) => {
    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const { error: submitError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.origin + '/antrag?payment_success=true',
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
            <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Express Checkout</p>
            <ExpressCheckoutElement
              onConfirm={handleExpressCheckout}
              options={{
                buttonType: {
                  applePay: 'buy',
                  googlePay: 'buy',
                },
                buttonTheme: {
                  type: 'dark',
                },
              }}
            />
          </div>

          <div className="flex items-center my-6">
            <div className="flex-1 border-t border-slate-200"></div>
            <span className="px-4 text-[10px] uppercase tracking-widest text-slate-400 font-semibold">Oder mit Karte zahlen</span>
            <div className="flex-1 border-t border-slate-200"></div>
          </div>

          <div>
            <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Kreditkarte</p>
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
            className="w-full py-5 rounded-xl text-[15px] font-bold text-white relative overflow-hidden transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              boxShadow: "0 4px 20px rgba(37, 99, 235, 0.3)"
            }}
          >
            {/* Animated border effect */}
            <div className="absolute inset-0 rounded-xl" style={{
              background: "conic-gradient(from 0deg, transparent, rgba(255,255,255,0.3), transparent 30%)",
              animation: "borderRotate 3s linear infinite"
            }} />
            <div className="absolute inset-[2px] rounded-xl" style={{
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)"
            }} />
            
            <span className="relative z-10 tracking-widest uppercase">
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Verarbeitung...</span>
                </>
              ) : (
                "ZAHLUNGSPFLICHTIG BESTELLEN"
              )}
            </span>
          </button>
    </form>
  );
}

// Add animation keyframes for border rotation
const style = document.createElement('style');
style.textContent = `
  @keyframes borderRotate {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
if (!document.head.querySelector('style[data-border-rotate]')) {
  style.setAttribute('data-border-rotate', 'true');
  document.head.appendChild(style);
}
