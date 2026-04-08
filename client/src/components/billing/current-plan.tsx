import { motion } from "framer-motion";

interface CurrentPlanProps {
  user: any;
  subscription?: any;
}

export function CurrentPlan({ user, subscription }: CurrentPlanProps) {
  const isTrialUser = subscription?.status === "trial" || subscription?.status === "trialing";
  
  const getPlanDetails = (plan: string) => {
    switch (plan) {
      case "free":
        return { name: "ARAS Free – Discover Mode", price: 0, aiMessages: 10, voiceCalls: 2 };
      case "pro":
        return { name: "ARAS Pro – Growth Mode", price: 59, aiMessages: 500, voiceCalls: 100 };
      case "ultra":
        return { name: "ARAS Ultra – Performance Mode", price: 249, aiMessages: 10000, voiceCalls: 1000 };
      case "ultimate":
        return { name: "ARAS Ultimate – Enterprise Mode", price: 1990, aiMessages: null, voiceCalls: 10000 };
      case "starter":
      default:
        return { name: "ARAS Free – Discover Mode", price: 0, aiMessages: 10, voiceCalls: 2 };
    }
  };

  const planDetails = isTrialUser 
    ? { name: "Free Trial", price: 0, aiMessages: 10, voiceCalls: 0 }
    : getPlanDetails(subscription?.plan || "free");

  const trialMessagesRemaining = isTrialUser ? (subscription?.trialMessagesRemaining || 0) : 0;
  const trialMessagesUsed = isTrialUser ? (subscription?.trialMessagesUsed || 0) : 0;

  const aiUsagePercentage = planDetails.aiMessages ? 
    Math.min(((subscription?.aiMessagesUsed || 0) / planDetails.aiMessages) * 100, 100) : 0;
  const voiceUsagePercentage = planDetails.voiceCalls ? 
    Math.min(((subscription?.voiceCallsUsed || 0) / planDetails.voiceCalls) * 100, 100) : 0;

  const orbitron = 'Orbitron, sans-serif';
  const inter = 'Inter, sans-serif';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-[20px] overflow-hidden"
      style={{
        padding: 'clamp(16px, 4vw, 24px)',
        background: 'rgba(255,255,255,0.018)',
        border: '1px solid rgba(233,215,196,0.1)',
      }}
    >
      {/* Subtle inner radial */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(500px 200px at 30% 20%, rgba(254,145,0,0.03), transparent 60%)',
      }} />

      <div className="relative">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <h3 style={{
                fontFamily: orbitron,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#E9D7C4',
                textTransform: 'uppercase',
              }}>{planDetails.name}</h3>
              {isTrialUser && (
                <span className="inline-flex items-center px-2.5 py-[2px] rounded-full" style={{
                  fontFamily: orbitron,
                  fontSize: 8,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: '#FE9100',
                  background: 'rgba(254,145,0,0.08)',
                  border: '1px solid rgba(254,145,0,0.18)',
                  textTransform: 'uppercase',
                }}>Trial</span>
              )}
            </div>
            <p style={{
              fontFamily: inter,
              fontSize: 12,
              color: 'rgba(233,215,196,0.4)',
              lineHeight: 1.5,
            }}>
              {isTrialUser 
                ? `${trialMessagesRemaining} Nachrichten übrig von ${planDetails.aiMessages}`
                : `${planDetails.aiMessages ? `${planDetails.aiMessages} AI Messages` : 'Unlimited AI Messages'} · ${planDetails.voiceCalls ? `${planDetails.voiceCalls} Voice Calls` : 'Unlimited Voice Calls'}`
              }
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <span style={{
              fontFamily: orbitron,
              fontSize: 'clamp(20px, 4vw, 26px)',
              fontWeight: 900,
              color: isTrialUser ? '#FE9100' : '#E9D7C4',
              lineHeight: 1,
            }}>
              {isTrialUser ? 'FREE' : `€${planDetails.price}`}
            </span>
            {!isTrialUser && planDetails.price > 0 && (
              <span style={{
                display: 'block',
                fontFamily: inter,
                fontSize: 11,
                color: 'rgba(233,215,196,0.3)',
                marginTop: 2,
              }}>/ Monat</span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="mb-5" style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(233,215,196,0.08), transparent)',
        }} />

        {/* Usage bars */}
        <div className="space-y-4">
          {/* AI Messages */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{
                fontFamily: inter,
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(233,215,196,0.55)',
              }}>{isTrialUser ? 'Trial-Nachrichten' : 'AI Messages'}</span>
              <span style={{
                fontFamily: inter,
                fontSize: 12,
                fontWeight: 600,
                color: aiUsagePercentage >= 90 ? '#FE9100' : 'rgba(233,215,196,0.65)',
              }}>
                {isTrialUser ? trialMessagesUsed : (subscription?.aiMessagesUsed || 0)} / {planDetails.aiMessages || '∞'}
                {isTrialUser && trialMessagesRemaining === 0 && (
                  <span style={{ color: '#FE9100', marginLeft: 6 }}>· Limit erreicht</span>
                )}
              </span>
            </div>
            <div className="relative h-[6px] rounded-full overflow-hidden" style={{
              background: 'rgba(255,255,255,0.05)',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${aiUsagePercentage}%` }}
                transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #FE9100, #A34E00)',
                  boxShadow: aiUsagePercentage > 5 ? '0 0 8px rgba(254,145,0,0.3)' : 'none',
                }}
              />
            </div>
          </div>

          {/* Voice Calls */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span style={{
                fontFamily: inter,
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(233,215,196,0.55)',
              }}>Voice Calls</span>
              <span style={{
                fontFamily: inter,
                fontSize: 12,
                fontWeight: 600,
                color: voiceUsagePercentage >= 90 ? '#FE9100' : 'rgba(233,215,196,0.65)',
              }}>
                {subscription?.voiceCallsUsed || 0} / {planDetails.voiceCalls || '∞'}
              </span>
            </div>
            <div className="relative h-[6px] rounded-full overflow-hidden" style={{
              background: 'rgba(255,255,255,0.05)',
            }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${voiceUsagePercentage}%` }}
                transition={{ duration: 0.8, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #FE9100, #A34E00)',
                  boxShadow: voiceUsagePercentage > 5 ? '0 0 8px rgba(254,145,0,0.3)' : 'none',
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
