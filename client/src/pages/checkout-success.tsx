import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GradientText } from "@/components/ui/gradient-text";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Zap, Users, MessageSquare } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function CheckoutSuccess() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Get session ID from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdParam = urlParams.get('session_id');
    if (sessionIdParam) {
      setSessionId(sessionIdParam);
    }
  }, []);

  // Verify the payment and update subscription
  const { data: paymentResult, isLoading, error } = useQuery({
    queryKey: ["/api/stripe/verify-payment", sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      const response = await apiRequest("POST", "/api/stripe/verify-payment", {
        sessionId
      });
      return response.json();
    },
    enabled: !!sessionId,
    retry: false
  });

  // Handle success and error states with useEffect
  useEffect(() => {
    if (paymentResult && !error) {
      queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated.",
      });
    }
    if (error) {
      toast({
        title: "Payment Verification Failed",
        description: (error as any).message || "Unable to verify payment",
        variant: "destructive",
      });
    }
  }, [paymentResult, error, queryClient, toast]);

  const getPlanDetails = (plan: string) => {
    switch (plan) {
      case "pro":
        return { 
          name: "Pro Plan", 
          price: 99, 
          aiMessages: 500, 
          voiceCalls: 100,
          color: "text-blue-400"
        };
      case "enterprise":
        return { 
          name: "Enterprise Plan", 
          price: 299, 
          aiMessages: null, 
          voiceCalls: null,
          color: "text-purple-400"
        };
      default:
        return { 
          name: "Starter Plan", 
          price: 29, 
          aiMessages: 100, 
          voiceCalls: 10,
          color: "text-orange-400"
        };
    }
  };

  const planDetails = paymentResult?.subscription ? 
    getPlanDetails(paymentResult.subscription.plan) : 
    getPlanDetails("starter");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-space space-pattern circuit-pattern flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Verifying Payment...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we confirm your subscription
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-space space-pattern circuit-pattern flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Success Header */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-4xl font-orbitron font-bold mb-4">
            <GradientText>Payment Successful!</GradientText>
          </h1>
          <p className="text-lg text-muted-foreground">
            Welcome to ARAS AI {planDetails.name}
          </p>
        </motion.div>

        {/* Subscription Details */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6"
        >
          <Card className="border-green-500/20">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center space-x-2">
                <span>Your Subscription</span>
                <div className={`w-3 h-3 rounded-full bg-green-500 animate-pulse`} />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Plan Info */}
              <div className="text-center space-y-2">
                <h3 className={`text-2xl font-bold ${planDetails.color}`}>
                  {planDetails.name}
                </h3>
                <div className="text-2xl font-bold">
                  ${planDetails.price}
                  <span className="text-base font-normal text-muted-foreground">/month</span>
                </div>
                <p className="text-sm text-green-400">Active Now</p>
              </div>

              {/* Usage Limits */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center p-4 bg-card/50 rounded-lg border border-border/20">
                  <MessageSquare className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-lg font-semibold">
                    {planDetails.aiMessages || '∞'}
                  </div>
                  <div className="text-sm text-muted-foreground">AI Messages</div>
                </div>
                <div className="text-center p-4 bg-card/50 rounded-lg border border-border/20">
                  <Users className="w-8 h-8 text-primary mx-auto mb-2" />
                  <div className="text-lg font-semibold">
                    {planDetails.voiceCalls || '∞'}
                  </div>
                  <div className="text-sm text-muted-foreground">Voice Calls</div>
                </div>
              </div>

              {/* Next Billing */}
              {paymentResult?.subscription?.currentPeriodEnd && (
                <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/10">
                  <p className="text-sm text-muted-foreground">
                    Next billing date: {new Date(paymentResult.subscription.currentPeriodEnd * 1000).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* What's Next */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-primary" />
                <span>What's Next?</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Start using AI Chat</p>
                    <p className="text-sm text-muted-foreground">
                      Access our powerful AI assistant in the SPACE module
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Make Voice Calls</p>
                    <p className="text-sm text-muted-foreground">
                      Launch AI-powered voice campaigns in the POWER module
                    </p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Track Results</p>
                    <p className="text-sm text-muted-foreground">
                      Monitor your campaigns and leads in the RESULTS module
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="space-y-4"
        >
          <Button
            onClick={() => setLocation("/")}
            className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90"
          >
            Start Using ARAS AI
            <ArrowRight className="w-5 h-5 ml-3" />
          </Button>

          <div className="text-center">
            <Button
              variant="ghost"
              onClick={() => setLocation("/billing")}
              className="text-muted-foreground hover:text-foreground"
            >
              Manage Subscription
            </Button>
          </div>
        </motion.div>

        {/* Support */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-center mt-8"
        >
          <p className="text-xs text-muted-foreground">
            Need help? Contact our support team for assistance with your new subscription.
          </p>
        </motion.div>
      </div>
    </div>
  );
}