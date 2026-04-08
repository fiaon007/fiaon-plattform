import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/topbar";
import { CurrentPlan } from "@/components/billing/current-plan";
import { PricingCards } from "@/components/billing/pricing-cards";
import { PaymentSetup } from "@/components/billing/payment-setup";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Sparkles } from "lucide-react";
import type { User, SubscriptionResponse } from "@shared/schema";
import arasLogo from "@/assets/aras_logo_1755067745303.png";

export default function Billing() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [showPaymentSetup, setShowPaymentSetup] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [hasOffer, setHasOffer] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('offer') === 'calls15') {
      setHasOffer(true);
    }
  }, []);

  const { data: userSubscription, refetch: refetchSubscription } = useQuery<SubscriptionResponse>({
    queryKey: ["/api/user/subscription"],
    enabled: !!user && !authLoading,
    retry: false,
  });

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <img src={arasLogo} alt="Loading" className="w-16 h-16 object-contain" />
        </motion.div>
      </div>
    );
  }

  const subscriptionData: SubscriptionResponse = userSubscription || {
    plan: 'free',
    status: 'active',
    aiMessagesUsed: 0,
    voiceCallsUsed: 0,
    aiMessagesLimit: 10,
    voiceCallsLimit: 2,
    renewalDate: null,
    trialMessagesUsed: 0,
    trialEndDate: null,
    hasPaymentMethod: false,
    requiresPaymentSetup: false,
    isTrialActive: false,
    canUpgrade: true
  };

  const handlePaymentSetup = (planId?: string) => {
    if (planId) {
      setSelectedPlanId(planId);
    } else {
      setSelectedPlanId(null);
    }
    setShowPaymentSetup(true);
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentSetup(false);
    
    if (selectedPlanId) {
      try {
        const response = await fetch("/api/upgrade-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: selectedPlanId }),
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          toast({
            title: "Plan erfolgreich aktualisiert",
            description: `Willkommen beim ${selectedPlanId.toUpperCase()} Plan!`,
          });
        } else {
          try {
            const errorData = await response.json();
            toast({
              title: "Upgrade fehlgeschlagen",
              description: errorData.message || "Das Upgrade konnte nicht abgeschlossen werden",
              variant: "destructive",
            });
          } catch (jsonError) {
            toast({
              title: "Upgrade fehlgeschlagen",
              description: "Das Upgrade konnte nicht abgeschlossen werden",
              variant: "destructive",
            });
          }
        }
      } catch (error: any) {
        console.error("Payment completion error:", error);
        toast({
          title: "Fehler",
          description: "Das Upgrade konnte nach der Zahlungseinrichtung nicht abgeschlossen werden",
          variant: "destructive",
        });
      }
    } else {
      toast({
        title: "Zahlungsmethode hinzugefügt",
        description: "Ihre Zahlungsmethode wurde erfolgreich gespeichert",
      });
    }
    
    setSelectedPlanId(null);
    queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
  };

  const handlePlanUpgrade = async (planId: string) => {
    try {
      const response = await fetch("/api/upgrade-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        toast({
          title: "Plan erfolgreich aktualisiert",
          description: `Willkommen beim ${planId.toUpperCase()} Plan!`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/user/subscription"] });
      } else if (response.status === 402) {
        handlePaymentSetup(planId);
        return;
      } else {
        let title = "Upgrade fehlgeschlagen";
        let description = "Das Abonnement konnte nicht aktualisiert werden";

        try {
          const errorData = await response.json();
          description = errorData.message || description;

          switch (response.status) {
            case 401:
              title = "Authentifizierung erforderlich";
              description = "Bitte melden Sie sich erneut an, um fortzufahren";
              break;
            case 403:
              title = "Zugriff verweigert";
              description = "Sie haben keine Berechtigung für diese Aktion";
              break;
            case 404:
              title = "Plan nicht gefunden";
              description = "Der ausgewählte Plan ist nicht mehr verfügbar. Bitte aktualisieren Sie die Seite";
              break;
            case 409:
              title = "Upgrade-Konflikt";
              description = "Ihr Abonnementstatus hat sich geändert. Bitte aktualisieren Sie die Seite";
              break;
            case 422:
              title = "Ungültige Plan-Auswahl";
              description = errorData.message || "Der ausgewählte Plan kann nicht aktiviert werden";
              break;
            case 429:
              title = "Zu viele Anfragen";
              description = "Bitte warten Sie einen Moment und versuchen Sie es erneut";
              break;
            case 500:
              title = "Serverfehler";
              description = "Ein Problem ist aufgetreten. Bitte versuchen Sie es in einigen Momenten erneut";
              break;
            case 503:
              title = "Service nicht verfügbar";
              description = "Der Abrechnungsservice ist vorübergehend nicht verfügbar";
              break;
            default:
              title = "Upgrade fehlgeschlagen";
              description = errorData.message || `Upgrade fehlgeschlagen mit Fehler ${response.status}`;
          }
        } catch (jsonError) {
          if (response.status === 0 || !navigator.onLine) {
            title = "Verbindungsfehler";
            description = "Bitte überprüfen Sie Ihre Internetverbindung";
          } else {
            title = "Upgrade fehlgeschlagen";
            description = `Server-Fehler ${response.status}. Bitte kontaktieren Sie den Support`;
          }
        }

        toast({
          title,
          description,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Plan upgrade error:', error);
      
      let title = "Upgrade-Fehler";
      let description = "Plan-Upgrade fehlgeschlagen";

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        title = "Verbindungsfehler";
        description = "Verbindung zum Server nicht möglich. Bitte überprüfen Sie Ihre Internetverbindung";
      } else if (error.name === 'AbortError') {
        title = "Zeitüberschreitung";
        description = "Die Anfrage wurde unterbrochen. Bitte versuchen Sie es erneut";
      } else if (!navigator.onLine) {
        title = "Keine Internetverbindung";
        description = "Sie scheinen offline zu sein. Bitte überprüfen Sie Ihre Verbindung";
      } else {
        description = error.message || "Ein unerwarteter Fehler ist aufgetreten";
      }

      toast({
        title,
        description,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen relative overflow-hidden" style={{ background: '#0a0a0a' }}>
      {/* Premium CI Background — quiet radial auras */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(1200px 500px at 18% 10%, rgba(254,145,0,0.08), transparent 62%), radial-gradient(800px 400px at 86% 18%, rgba(233,215,196,0.05), transparent 64%), radial-gradient(600px 300px at 50% 90%, rgba(163,78,0,0.06), transparent 70%)'
      }} />
      {/* Noise texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`
      }} />

      <Sidebar 
        activeSection="billing" 
        onSectionChange={() => {}}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <div className="flex-1 flex flex-col relative z-10 content-zoom">
        <TopBar 
          currentSection="billing" 
          subscriptionData={subscriptionData}
          user={user as User}
          isVisible={true}
        />

        <div className="flex-1 overflow-y-auto billing-scroll">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-10 sm:py-14 space-y-8">

            {/* ── PAGE HEADER ── */}
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-center mb-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="inline-flex items-center gap-2.5 px-3.5 py-[6px] rounded-full mb-5"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(233,215,196,0.1)',
                }}
              >
                <div className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{
                  background: '#FE9100',
                  boxShadow: '0 0 8px rgba(254,145,0,0.7)',
                  animation: 'billingPulse 2s ease-in-out infinite',
                }} />
                <span style={{
                  fontFamily: 'Orbitron, sans-serif',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  color: 'rgba(233,215,196,0.8)',
                  textTransform: 'uppercase',
                }}>Abonnement</span>
              </motion.div>

              <h1 style={{
                fontFamily: 'Orbitron, sans-serif',
                fontWeight: 900,
                fontSize: 'clamp(24px, 5vw, 32px)',
                lineHeight: 1.15,
                letterSpacing: '0.02em',
                background: 'linear-gradient(90deg, #E9D7C4, #FE9100, #A34E00, #FE9100, #E9D7C4)',
                backgroundSize: '300% auto',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'billingSheen 6s linear infinite',
                marginBottom: 12,
              }}>
                Wähle deinen ARAS Modus
              </h1>
              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 'clamp(14px, 3vw, 16px)',
                color: 'rgba(233,215,196,0.5)',
                lineHeight: 1.5,
                maxWidth: 480,
                margin: '0 auto',
              }}>
                Skaliere deine Outbound-Prozesse mit maximaler Effizienz und Kontrolle.
              </p>
            </motion.div>

            {/* ── OFFER BANNER ── */}
            {hasOffer && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-[16px] relative overflow-hidden"
                style={{
                  padding: '14px 18px',
                  background: 'rgba(254,145,0,0.06)',
                  border: '1px solid rgba(254,145,0,0.16)',
                }}
              >
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: 'radial-gradient(400px 100px at 15% 50%, rgba(254,145,0,0.05), transparent 60%)',
                }} />
                <div className="relative flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{
                    background: 'linear-gradient(180deg, #FE9100, #a34e00)',
                    boxShadow: '0 0 10px rgba(254,145,0,0.5)',
                    animation: 'billingPulse 2s ease-in-out infinite',
                  }} />
                  <p style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 13,
                    color: 'rgba(233,215,196,0.8)',
                    lineHeight: 1.5,
                  }}>
                    <span style={{ fontWeight: 600, color: '#E9D7C4' }}>Dein ARAS Upgrade-Vorteil ist aktiv:</span>{' '}
                    15&nbsp;% auf alle Pläne bis 01.04.2026.
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── CURRENT PLAN STATUS ── */}
            <CurrentPlan user={user} subscription={subscriptionData} />

            {/* ── PRICING SECTION ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <PricingCards 
                subscription={subscriptionData}
                onPaymentSetup={handlePaymentSetup}
                onPlanUpgrade={handlePlanUpgrade}
              />
            </motion.div>

            {/* ── TRUST ROW ── */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-3 pt-6 pb-4"
            >
              {[
                { label: 'DSGVO-konform', dot: '#FE9100' },
                { label: 'Swiss Hosting', dot: '#E9D7C4' },
                { label: '24/7 Support', dot: '#A34E00' },
              ].map((item, i) => (
                <div key={i} className="inline-flex items-center gap-2 px-3.5 py-[6px] rounded-full" style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(233,215,196,0.08)',
                }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.dot, opacity: 0.7 }} />
                  <span style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 11,
                    fontWeight: 500,
                    color: 'rgba(233,215,196,0.5)',
                    letterSpacing: '0.02em',
                  }}>{item.label}</span>
                </div>
              ))}
            </motion.div>

            {/* ── MICRO COPY ── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-center pb-8"
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 12,
                color: 'rgba(233,215,196,0.3)',
                letterSpacing: '0.04em',
              }}
            >
              Jederzeit kündbar&ensp;•&ensp;Sofort aktiv&ensp;•&ensp;Keine versteckten Kosten
            </motion.p>

          </div>
        </div>

        <PaymentSetup
          isOpen={showPaymentSetup}
          onClose={() => {
            setShowPaymentSetup(false);
            setSelectedPlanId(null);
          }}
          onSuccess={handlePaymentSuccess}
          selectedPlan={selectedPlanId}
        />
      </div>

      {/* Billing Page Styles */}
      <style>{`
        @keyframes billingSheen{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes billingPulse{0%,100%{opacity:1;box-shadow:0 0 8px rgba(254,145,0,0.7)}50%{opacity:0.35;box-shadow:0 0 3px rgba(254,145,0,0.25)}}
        .billing-scroll::-webkit-scrollbar{width:5px}
        .billing-scroll::-webkit-scrollbar-track{background:transparent}
        .billing-scroll::-webkit-scrollbar-thumb{background:rgba(254,145,0,0.2);border-radius:10px}
        .billing-scroll::-webkit-scrollbar-thumb:hover{background:rgba(254,145,0,0.35)}
      `}</style>
    </div>
  );
}