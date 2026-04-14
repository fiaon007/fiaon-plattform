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
    <div className="w-full max-w-2xl mx-auto p-8 rounded-2xl bg-white shadow-xl shadow-slate-200/50 border border-slate-100">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Order Summary */}
        <div className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Zusammenfassung</p>
            <h3 className="text-2xl font-black tracking-tight text-slate-900 mb-2">{packageName}</h3>
            <p className="text-3xl font-black text-slate-900">{price.toFixed(2)} €</p>
            <p className="text-sm text-gray-500 mt-1">/ Monat</p>
          </div>
          
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span className="text-sm font-semibold text-slate-900">Sichere Zahlung</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Ihre Zahlung wird über SSL-verschlüsselt verarbeitet. Wir speichern keine Kartendaten.
            </p>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <p className="text-[11px] font-semibold text-[#2563eb] uppercase tracking-[.2em] mb-3">Zahlungsmethode</p>
            <PaymentElement 
              options={{
                appearance: {
                  theme: 'stripe',
                  variables: {
                    fontFamily: 'Inter, system-ui, sans-serif',
                    borderRadius: '12px',
                    colorPrimary: '#2563eb',
                    colorBackground: '#ffffff',
                    colorText: '#0f172a',
                    colorDanger: '#ef4444',
                    spacingUnit: '4px',
                  },
                  rules: {
                    '.Input': {
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    },
                    '.Input:focus': {
                      boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.2)',
                      borderColor: '#2563eb',
                    },
                    '.Label': {
                      color: '#64748b',
                      fontWeight: '500',
                      fontSize: '14px',
                    },
                  },
                },
              }}
            />
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
      </div>
    </div>
  );
}
