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
import { loadStripe } from "@stripe/stripe-js";
import { useQuery } from "@tanstack/react-query";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

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

  const isCurrentPlan = (planId: string) =>
    subscription?.plan === planId && subscription?.status === 'active';

  const orbitron = 'Orbitron, sans-serif';
  const inter = 'Inter, sans-serif';

  if (plansLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[1,2,3,4].map(i => (
          <div key={i} className="rounded-[20px] p-6 animate-pulse" style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
            border: '1px solid rgba(233,215,196,0.08)',
          }}>
            <div className="h-4 rounded-full w-2/3 mb-4" style={{ background: 'rgba(233,215,196,0.06)' }} />
            <div className="h-8 rounded-full w-1/2 mb-6" style={{ background: 'rgba(233,215,196,0.04)' }} />
            <div className="space-y-3">
              {[1,2,3].map(j => <div key={j} className="h-3 rounded-full" style={{ background: 'rgba(233,215,196,0.04)' }} />)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {plans.map((plan: any, index: number) => {
          const isCurrent = isCurrentPlan(plan.id);
          const isPopular = plan.popular;
          const isFree = plan.id === 'free';

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: index * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className="relative group"
            >
              {/* Popular glow border */}
              {isPopular && (
                <div className="absolute -inset-px rounded-[21px] pointer-events-none" style={{
                  background: 'linear-gradient(135deg, rgba(254,145,0,0.3), rgba(233,215,196,0.1), rgba(254,145,0,0.2))',
                  opacity: 0.8,
                }} />
              )}

              <div
                className="relative rounded-[20px] p-6 h-full flex flex-col transition-all duration-200"
                style={{
                  background: isPopular
                    ? 'linear-gradient(135deg, rgba(254,145,0,0.06), rgba(255,255,255,0.015))'
                    : 'linear-gradient(135deg, rgba(255,255,255,0.02), rgba(255,255,255,0.008))',
                  border: isPopular
                    ? '1px solid rgba(254,145,0,0.3)'
                    : isCurrent
                    ? '1px solid rgba(254,145,0,0.2)'
                    : '1px solid rgba(233,215,196,0.1)',
                  boxShadow: isPopular
                    ? '0 0 0 1px rgba(254,145,0,0.12), 0 20px 60px rgba(0,0,0,0.5)'
                    : '0 12px 40px rgba(0,0,0,0.25)',
                }}
                onMouseEnter={(e) => {
                  if (!isPopular) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.borderColor = 'rgba(254,145,0,0.25)';
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPopular) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = isCurrent ? 'rgba(254,145,0,0.2)' : 'rgba(233,215,196,0.1)';
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)';
                  }
                }}
              >
                {/* Inner radial for popular */}
                {isPopular && (
                  <div className="absolute inset-0 rounded-[20px] pointer-events-none" style={{
                    background: 'radial-gradient(300px 150px at 50% 0%, rgba(254,145,0,0.05), transparent 65%)',
                  }} />
                )}

                {/* ── Badges ── */}
                <div className="relative mb-5">
                  {isPopular && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-[4px] rounded-full mb-3" style={{
                      background: 'rgba(254,145,0,0.1)',
                      border: '1px solid rgba(254,145,0,0.25)',
                    }}>
                      <Sparkles className="w-3 h-3" style={{ color: '#FE9100' }} />
                      <span style={{
                        fontFamily: orbitron,
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: '0.2em',
                        color: '#FE9100',
                        textTransform: 'uppercase',
                      }}>Empfohlen</span>
                    </div>
                  )}
                  {isCurrent && (
                    <div className="inline-flex items-center gap-1.5 px-3 py-[4px] rounded-full mb-3" style={{
                      background: 'rgba(254,145,0,0.06)',
                      border: '1px solid rgba(254,145,0,0.15)',
                    }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#FE9100', boxShadow: '0 0 6px rgba(254,145,0,0.6)' }} />
                      <span style={{
                        fontFamily: orbitron,
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: '0.18em',
                        color: 'rgba(254,145,0,0.8)',
                        textTransform: 'uppercase',
                      }}>Aktueller Plan</span>
                    </div>
                  )}

                  {/* Plan name */}
                  <h3 className="relative" style={{
                    fontFamily: orbitron,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: isPopular ? '#E9D7C4' : 'rgba(233,215,196,0.75)',
                    textTransform: 'uppercase',
                  }}>{plan.name}</h3>
                </div>

                {/* ── Price ── */}
                <div className="relative mb-6">
                  <div className="flex items-baseline gap-1">
                    <span style={{
                      fontFamily: orbitron,
                      fontSize: 'clamp(28px, 5vw, 36px)',
                      fontWeight: 900,
                      color: isPopular ? '#FE9100' : '#E9D7C4',
                      lineHeight: 1,
                    }}>
                      €{plan.price}
                    </span>
                    {plan.price > 0 && (
                      <span style={{
                        fontFamily: inter,
                        fontSize: 13,
                        fontWeight: 400,
                        color: 'rgba(233,215,196,0.35)',
                      }}>/ Monat</span>
                    )}
                  </div>
                  {plan.price === 0 && (
                    <span style={{
                      fontFamily: inter,
                      fontSize: 12,
                      color: 'rgba(233,215,196,0.35)',
                    }}>Kostenlos</span>
                  )}
                </div>

                {/* ── Divider ── */}
                <div className="mb-5" style={{
                  height: 1,
                  background: isPopular
                    ? 'linear-gradient(90deg, transparent, rgba(254,145,0,0.25), transparent)'
                    : 'linear-gradient(90deg, transparent, rgba(233,215,196,0.08), transparent)',
                }} />

                {/* ── Features ── */}
                <ul className="space-y-[10px] mb-6 flex-1 relative">
                  {plan.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-[1px]" style={{
                        background: isPopular ? 'rgba(254,145,0,0.12)' : 'rgba(233,215,196,0.05)',
                        border: isPopular ? '1px solid rgba(254,145,0,0.2)' : '1px solid rgba(233,215,196,0.08)',
                      }}>
                        <Check className="w-2.5 h-2.5" style={{ color: isPopular ? '#FE9100' : 'rgba(233,215,196,0.5)' }} />
                      </div>
                      <span style={{
                        fontFamily: inter,
                        fontSize: 13,
                        lineHeight: '1.45',
                        color: isPopular ? 'rgba(233,215,196,0.8)' : 'rgba(233,215,196,0.55)',
                      }}>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* ── CTA Button ── */}
                <div className="relative mt-auto">
                  {isCurrent ? (
                    <button
                      disabled
                      className="w-full rounded-[14px] py-3 px-4 cursor-not-allowed"
                      style={{
                        fontFamily: inter,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'rgba(233,215,196,0.35)',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(233,215,196,0.08)',
                      }}
                    >
                      Aktueller Plan
                    </button>
                  ) : isFree ? (
                    <button
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isLoading === plan.id || subscription?.plan === 'free'}
                      className="w-full rounded-[14px] py-3 px-4 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        fontFamily: inter,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'rgba(233,215,196,0.6)',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(233,215,196,0.1)',
                      }}
                    >
                      {isLoading === plan.id ? 'Wird geladen...' :
                       subscription?.plan === 'free' ? 'Aktueller Plan' : 'Zu Free wechseln'}
                    </button>
                  ) : !plan.available ? (
                    <button
                      disabled
                      className="w-full rounded-[14px] py-3 px-4 cursor-not-allowed"
                      style={{
                        fontFamily: inter,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: 'rgba(233,215,196,0.25)',
                        background: 'rgba(255,255,255,0.015)',
                        border: '1px solid rgba(233,215,196,0.06)',
                      }}
                    >
                      Bald verfügbar
                    </button>
                  ) : plan.trialAvailable && subscription?.requiresPaymentSetup ? (
                    <button
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isLoading === plan.id}
                      className="w-full rounded-[14px] py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer disabled:opacity-50"
                      style={{
                        fontFamily: inter,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: '#E9D7C4',
                        background: 'rgba(254,145,0,0.08)',
                        border: '1px solid rgba(254,145,0,0.2)',
                      }}
                    >
                      {isLoading === plan.id ? (
                        <>
                          <div className="animate-spin w-4 h-4 border-2 border-[#FE9100] border-t-transparent rounded-full" />
                          <span>Setup...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-4 h-4" style={{ color: '#FE9100' }} />
                          <span>Trial starten</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isLoading === plan.id}
                      className="pricing-cta w-full rounded-[14px] py-3.5 px-4 transition-all duration-200 cursor-pointer disabled:opacity-50 group relative overflow-hidden"
                      style={{
                        fontFamily: inter,
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        minHeight: 44,
                        color: isPopular ? '#0a0a0a' : '#E9D7C4',
                        background: isPopular
                          ? 'linear-gradient(135deg, #FE9100, #A34E00)'
                          : 'rgba(254,145,0,0.06)',
                        border: isPopular
                          ? 'none'
                          : '1px solid rgba(254,145,0,0.18)',
                        boxShadow: isPopular
                          ? '0 10px 24px rgba(254,145,0,0.2)'
                          : 'none',
                      }}
                    >
                      {isPopular && (
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[14px]" style={{
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 55%)',
                        }} />
                      )}
                      {isLoading === plan.id ? (
                        <span className="relative z-10 flex items-center justify-center gap-2">
                          <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                          Wird geladen...
                        </span>
                      ) : (
                        <span className="relative z-10">Jetzt upgraden</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .pricing-cta:hover{transform:translateY(-1px)}
        .pricing-cta:active{transform:translateY(0)}
      `}</style>
    </>
  );
}
