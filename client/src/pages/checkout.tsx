import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, Check, X } from "lucide-react";
import { GradientText } from "@/components/ui/gradient-text";

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [planId, setPlanId] = useState<string>("");

  const plans = {
    starter: {
      name: "Starter",
      price: 29,
      features: ["100 AI messages/month", "10 voice calls/month", "Basic AI chat", "Email support", "Basic analytics"]
    },
    professional: {
      name: "Professional", 
      price: 99,
      features: ["500 AI messages/month", "100 voice calls/month", "Advanced AI features", "Priority support", "API access", "Advanced analytics"]
    },
    enterprise: {
      name: "Enterprise",
      price: 299,
      features: ["Unlimited AI messages", "Unlimited voice calls", "All Pro features", "24/7 support", "Custom integrations", "Advanced security"]
    }
  };

  useEffect(() => {
    // Get plan from URL params
    const urlParams = new URLSearchParams(window.location.search);
    const plan = urlParams.get('plan');
    if (plan && plans[plan as keyof typeof plans]) {
      setPlanId(plan);
    } else {
      // Redirect to billing if no valid plan
      setLocation('/billing');
    }
  }, [setLocation]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      setLocation('/login');
    }
  }, [user, authLoading, setLocation]);

  const handleCheckout = async () => {
    if (!planId || !user) return;

    setIsLoading(true);
    try {
      const response = await apiRequest("POST", "/api/stripe/create-checkout-session", {
        planId: planId
      });

      const data = await response.json();
      
      if (data.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error(data.message || "Failed to create checkout session");
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Checkout Failed",
        description: error.message || "Unable to start checkout process. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-space space-pattern circuit-pattern flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login
  }

  if (!planId || !plans[planId as keyof typeof plans]) {
    return (
      <div className="min-h-screen bg-space space-pattern circuit-pattern flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Invalid Plan</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="mb-4">The selected plan is not valid.</p>
            <Button onClick={() => setLocation('/billing')}>
              Back to Billing
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedPlan = plans[planId as keyof typeof plans];

  return (
    <div className="min-h-screen bg-space space-pattern circuit-pattern p-6">
      <div className="container mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-orbitron font-bold mb-2">
            <GradientText>Complete Your Subscription</GradientText>
          </h1>
          <p className="text-muted-foreground">
            You're about to subscribe to the {selectedPlan.name} plan
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{selectedPlan.name} Plan</span>
              <span className="text-2xl font-bold">
                ${selectedPlan.price}
                <span className="text-sm text-muted-foreground font-normal">/month</span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <h4 className="font-semibold">What's included:</h4>
              <ul className="space-y-2">
                {selectedPlan.features.map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>Payment Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Plan:</span>
                  <span>{selectedPlan.name}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">Billing:</span>
                  <span>Monthly</span>
                </div>
                <div className="flex items-center justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${selectedPlan.price}/month</span>
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="flex-1"
                  data-testid="button-checkout"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Proceed to Payment
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  onClick={() => setLocation('/billing')}
                  disabled={isLoading}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>

              <div className="text-xs text-muted-foreground text-center">
                <p>Your payment will be processed securely by Stripe.</p>
                <p>You can cancel your subscription at any time.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}