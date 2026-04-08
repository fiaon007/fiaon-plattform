import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { CreditCard, Shield, Check } from "lucide-react";
import { motion } from "framer-motion";

// Initialize Stripe with environment guard
const stripePublicKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
if (!stripePublicKey) {
  console.error("VITE_STRIPE_PUBLIC_KEY environment variable is not set");
}
const stripePromise = stripePublicKey ? loadStripe(stripePublicKey) : null;

interface PaymentSetupProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedPlan?: string | null;
}

function PaymentSetupForm({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      // Confirm the setup intent
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
      });

      if (error) {
        // Handle specific Stripe error types with user-friendly messages
        let title = "Payment Setup Failed";
        let description = error.message;

        switch (error.type) {
          case 'card_error':
            if (error.code === 'card_declined') {
              title = "Card Declined";
              description = "Your card was declined. Please try a different payment method or contact your bank.";
            } else if (error.code === 'expired_card') {
              title = "Card Expired";
              description = "Your card has expired. Please enter a valid card.";
            } else if (error.code === 'insufficient_funds') {
              title = "Insufficient Funds";
              description = "Your card was declined due to insufficient funds.";
            } else if (error.code === 'incorrect_cvc') {
              title = "Invalid Security Code";
              description = "The security code (CVC) you entered is incorrect.";
            } else {
              title = "Card Error";
              description = error.message || "There was an issue with your card. Please check your details and try again.";
            }
            break;
          case 'validation_error':
            title = "Invalid Information";
            description = "Please check your payment information and try again.";
            break;
          case 'rate_limit_error':
            title = "Too Many Attempts";
            description = "Too many requests in a short time. Please wait a moment and try again.";
            break;
          case 'api_connection_error':
            title = "Connection Error";
            description = "Unable to connect to payment processor. Please check your internet connection and try again.";
            break;
          case 'api_error':
            title = "Payment Service Error";
            description = "There was an issue with the payment service. Please try again in a few moments.";
            break;
          default:
            description = error.message || "An unexpected error occurred. Please try again.";
        }

        toast({
          title,
          description,
          variant: "destructive",
        });
      } else if (setupIntent && setupIntent.status === "succeeded") {
        // Confirm payment method with backend using existing start-trial endpoint
        try {
          const confirmResponse = await apiRequest("POST", "/api/stripe/start-trial", {
            setupIntentId: setupIntent.id,
          });

          if (!confirmResponse.ok) {
            const errorData = await confirmResponse.json();
            console.error('[PaymentSetup] Confirm failed:', errorData);
            toast({
              title: "Confirmation Failed",
              description: errorData.message || "Failed to confirm payment method",
              variant: "destructive",
            });
            return;
          }

          toast({
            title: "Payment Method Added!",
            description: "Your payment method has been saved successfully.",
          });
          onSuccess();
        } catch (confirmError: any) {
          console.error("Payment confirmation error:", confirmError);
          toast({
            title: "Payment Confirmation Failed",
            description: confirmError.message || "Failed to confirm payment method with server",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Payment setup error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to setup payment method",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-blue-50/10 border border-blue-200/30 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-400">Secure Payment Setup</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Your card will be securely stored and processed using Stripe.
              You can cancel your subscription at any time.
            </p>
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-4">
        <PaymentElement 
          options={{
            layout: "tabs",
          }}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2 text-sm text-green-400">
          <Check className="w-4 h-4" />
          <span>Secure payment processing</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-green-400">
          <Check className="w-4 h-4" />
          <span>Cancel subscription anytime</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-green-400">
          <Check className="w-4 h-4" />
          <span>Secure payment processing by Stripe</span>
        </div>
      </div>

      <div className="flex space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isLoading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!stripe || isLoading}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {isLoading ? (
            <div className="flex items-center space-x-2">
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              <span>Setting up...</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <CreditCard className="w-4 h-4" />
              <span>Add Payment Method</span>
            </div>
          )}
        </Button>
      </div>
    </form>
  );
}

export function PaymentSetup({ isOpen, onClose, onSuccess, selectedPlan }: PaymentSetupProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Get plan details based on selectedPlan
  const getPlanDetails = (planId?: string | null) => {
    switch (planId) {
      case 'free':
        return { name: 'ARAS Free – Discover Mode', price: 0, description: '10 AI messages • 2 voice calls/month' };
      case 'pro':
        return { name: 'ARAS Pro – Growth Mode', price: 59, description: '500 AI messages • 100 voice calls/month' };
      case 'ultra':
        return { name: 'ARAS Ultra – Performance Mode', price: 249, description: '10.000 AI messages • 1.000 voice calls/month' };
      case 'ultimate':
        return { name: 'ARAS Ultimate – Enterprise Mode', price: 1990, description: 'Unbegrenzte AI messages • 10.000 voice calls/month' };
      // Legacy fallback
      case 'starter':
      default:
        return { name: 'ARAS Free – Discover Mode', price: 0, description: '10 AI messages • 2 voice calls/month' };
    }
  };

  const planDetails = getPlanDetails(selectedPlan);

  const initializePaymentSetup = async () => {
    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/stripe/setup-payment-method");
      
      if (response.ok) {
        const data = await response.json();
        setClientSecret(data.clientSecret);
      } else {
        const errorData = await response.json();
        toast({
          title: "Setup Failed",
          description: errorData.message || "Failed to initialize payment setup",
          variant: "destructive",
        });
        onClose();
      }
    } catch (error: any) {
      console.error("Payment setup initialization error:", error);
      
      let title = "Setup Error";
      let description = "Failed to initialize payment setup";

      // Handle different types of initialization errors
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        title = "Connection Error";
        description = "Unable to connect to payment services. Please check your internet connection and try again.";
      } else if (!navigator.onLine) {
        title = "No Internet Connection";
        description = "You appear to be offline. Please check your internet connection.";
      } else if (error.message && error.message.includes('configuration')) {
        title = "Configuration Error";
        description = "Payment services are not properly configured. Please contact support.";
      } else {
        description = error.message || "Unable to initialize payment setup. Please try again or contact support.";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && !clientSecret) {
      initializePaymentSetup();
    }
  }, [isOpen, clientSecret]);

  const handleClose = () => {
    setClientSecret(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Add Payment Method</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pb-4">
          <Card className="border-primary">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-center">{planDetails.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">${planDetails.price}</div>
              <p className="text-sm text-muted-foreground">
                per month • Cancel anytime
              </p>
              <div className="text-sm text-muted-foreground">
                {planDetails.description}
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : clientSecret ? (
            <Elements
              stripe={stripePromise}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#ff6a00",
                  },
                },
              }}
            >
              <PaymentSetupForm onSuccess={onSuccess} onClose={handleClose} />
            </Elements>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load payment form
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}