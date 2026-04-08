import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GlowButton } from "@/components/ui/glow-button";
import { GradientText } from "@/components/ui/gradient-text";
import { Button } from "@/components/ui/button";
import { Check, CreditCard, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import type { SubscriptionResponse } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { getStripe } from "@/lib/stripe";

interface PricingCardsProps {
  subscription?: SubscriptionResponse;
  onPaymentSetup?: (planId?: string) => void;
  onPlanUpgrade?: (planId: string) => void;
}

export function PricingCards({ subscription, onPaymentSetup, onPlanUpgrade }: PricingCardsProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  
  // Load plans from database
  const { data: dbPlans, isLoading: plansLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/subscription-plans');
        if (!response.ok) {
          console.warn('[PricingCards] Failed to fetch plans:', response.status);
          return null;
        }
        return await response.json();
      } catch (err) {
        console.error('[PricingCards] Error fetching plans:', err);
        return null;
      }
    },
    retry: false
  });

  // Map database plans to UI format with proper pricing
  const plans = dbPlans ? dbPlans.map((plan: any) => ({
    id: plan.id,
    name: plan.name,
    price: plan.price / 100, // Convert cents to euros
    trialMessages: 0,
    aiMessages: plan.aiMessagesLimit,
    voiceCalls: plan.voiceCallsLimit,
    features: plan.features || [],
    popular: plan.id === 'ultra', // Mark Ultra as popular
    trialAvailable: false,
    stripePriceId: plan.stripePriceId, // Include Stripe info
    available: plan.id === 'free' || !!plan.stripePriceId // Available if free or has Stripe config
  })) : [];

  const handlePlanSelect = async (planId: string) => {
    const plan = plans.find((p: any) => p.id === planId);
    if (!plan) return;

    setIsLoading(planId);

    try {
      // Check if already on this plan
      if (subscription?.plan === planId && subscription?.status === "active") {
        toast({
          title: "Already Subscribed",
          description: `You're already on the ${plan.name} plan.`,
        });
        setIsLoading(null);
        return;
      }

      // Handle free plan - direct upgrade without payment
      if (planId === 'free') {
        const response = await apiRequest("POST", "/api/upgrade-plan", { planId });
        if (response.ok) {
          toast({
            title: "Plan Updated",
            description: "Switched to Free plan",
          });
          window.location.reload();
        }
        setIsLoading(null);
        return;
      }

      // Check if plan is available for purchase
      if (!plan.available && planId !== 'free') {
        toast({
          title: "Noch nicht verfügbar",
          description: "Dieser Plan wird bald verfügbar sein. Stripe-Konfiguration steht aus.",
          variant: "default"
        });
        setIsLoading(null);
        return;
      }

      // For paid plans, create Stripe checkout session
      const response = await apiRequest("POST", "/api/create-checkout-session", {
        planId
      });

        if (response.ok) {
          const data = await response.json();
          
          // Redirect to Stripe Checkout
          if (data.url) {
            window.location.href = data.url;
          } else {
            toast({
              title: "Plan Upgraded!",
              description: `Successfully upgraded to ${plan.name} plan!`,
            });
            window.location.reload();
          }
        } else if (response.status === 402) {
          const errorData = await response.json();
          
          // Handle SCA (3D Secure) authentication requirement
          if (errorData.requiresAction && errorData.clientSecret) {
            toast({
              title: "Payment Authentication Required",
              description: "Please complete payment verification...",
            });
            
            try {
              const stripe = await stripePromise;
              if (!stripe) {
                throw new Error("Stripe failed to load");
              }
              
              // Confirm the payment with 3D Secure
              const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
                errorData.clientSecret
              );
              
              if (confirmError) {
                toast({
                  title: "Payment Authentication Failed",
                  description: confirmError.message || "Failed to verify payment",
                  variant: "destructive",
                });
              } else if (paymentIntent && paymentIntent.status === 'succeeded') {
                toast({
                  title: "Payment Verified!",
                  description: `Successfully upgraded to ${plan.name} plan!`,
                });
                // Refresh to show updated subscription
                setTimeout(() => window.location.reload(), 1000);
              }
            } catch (scaError: any) {
              toast({
                title: "Authentication Error",
                description: scaError.message || "Failed to complete payment verification",
                variant: "destructive",
              });
            }
          } 
          // Handle payment method required (user needs to add card)
          else if (errorData.requiresPaymentSetup || errorData.message?.includes("Payment method")) {
            if (onPaymentSetup) {
              toast({
                title: "Payment Method Required",
                description: "Please add a payment method to upgrade to paid plans.",
              });
              onPaymentSetup(planId);
            } else {
              toast({
                title: "Payment Method Required",
                description: "Please add a payment method before upgrading to paid plans.",
                variant: "destructive",
              });
            }
          }
          // Handle other payment failures
          else {
            toast({
              title: "Payment Failed",
              description: errorData.message || "Payment could not be processed",
              variant: "destructive",
            });
          }
        } else {
          const errorData = await response.json();
          toast({
            title: "Upgrade Failed",
            description: errorData.message || "Failed to upgrade subscription",
            variant: "destructive",
          });
        }
    } catch (error: any) {
      console.error('Plan selection error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to process plan selection",
        variant: "destructive",
      });
    } finally {
      setIsLoading(null);
    }
  };

  if (plansLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-muted rounded w-3/4 mb-2" />
              <div className="h-8 bg-muted rounded w-1/2" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {[1,2,3].map(j => <div key={j} className="h-4 bg-muted rounded" />)}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Get current plan price for upgrade/downgrade logic
  const currentPlanData = plans.find((p: any) => p.id === subscription?.plan);
  const currentPlanPrice = currentPlanData?.price || 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
      {plans.map((plan: any, index: number) => {
        const isCurrentPlan = subscription?.plan === plan.id && subscription?.status === "active";
        const isFree = plan.id === 'free';
        const isDowngrade = plan.price < currentPlanPrice;
        const isUpgrade = plan.price > currentPlanPrice;
        
        return (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: index * 0.08 }}
            whileHover={{ y: -3 }}
            className={`relative rounded-xl border transition-all duration-300 ${
              isCurrentPlan 
                ? 'border-[#FE9100]/60 bg-[#FE9100]/5' 
                : plan.popular
                  ? 'border-[#FE9100]/40 bg-[#0d0d0d]'
                  : 'border-white/10 bg-[#0a0a0a] hover:border-white/20'
            }`}
          >
            {/* Badge - nur für aktuellen Plan oder beliebten Plan */}
            {(isCurrentPlan || plan.popular) && (
              <div className="absolute -top-2.5 left-4 z-10">
                <span className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider rounded ${
                  isCurrentPlan 
                    ? 'bg-[#FE9100] text-black' 
                    : 'bg-[#FE9100]/20 text-[#FE9100] border border-[#FE9100]/30'
                }`}>
                  {isCurrentPlan ? 'Aktuell' : 'Beliebt'}
                </span>
              </div>
            )}

            {/* Card Content */}
            <div className="p-4 sm:p-5 pt-5 sm:pt-6 flex flex-col h-full">
              {/* Plan Name */}
              <h3 className="text-sm sm:text-base font-bold text-white mb-1">
                {plan.name}
              </h3>
              
              {/* Price */}
              <div className="mb-4 sm:mb-5">
                <span className={`text-xl sm:text-2xl font-bold ${isFree ? 'text-emerald-400' : 'text-white'}`}>
                  {isFree ? 'Kostenlos' : `CHF ${plan.price}`}
                </span>
                {!isFree && (
                  <span className="text-[10px] sm:text-xs text-gray-500 ml-1">/ Monat</span>
                )}
              </div>

              {/* Features - alle anzeigen */}
              <div className="flex-grow mb-4 sm:mb-5">
                <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Enthalten
                </div>
                <ul className="space-y-1.5 sm:space-y-2">
                  {plan.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#FE9100] flex-shrink-0 mt-0.5" />
                      <span className="text-[11px] sm:text-xs text-gray-400 leading-tight">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Button */}
              <button
                onClick={() => !isCurrentPlan && handlePlanSelect(plan.id)}
                disabled={isLoading === plan.id || isCurrentPlan || (isFree && subscription?.plan === 'free')}
                className={`w-full py-2 sm:py-2.5 px-3 sm:px-4 rounded-lg text-[10px] sm:text-xs font-semibold uppercase tracking-wide transition-all duration-200 ${
                  isCurrentPlan
                    ? 'bg-[#FE9100]/10 text-[#FE9100] border border-[#FE9100]/30 cursor-default'
                    : isDowngrade
                      ? 'bg-transparent text-gray-400 border border-white/10 hover:border-white/20 hover:text-white'
                      : !plan.available
                        ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                        : 'bg-[#FE9100] text-black hover:bg-[#ff9f1a] active:scale-[0.98]'
                }`}
              >
                {isLoading === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Laden...
                  </span>
                ) : isCurrentPlan ? (
                  'Aktueller Plan'
                ) : !plan.available ? (
                  'Bald verfügbar'
                ) : isDowngrade ? (
                  'Downgrade'
                ) : (
                  'Upgraden'
                )}
              </button>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
