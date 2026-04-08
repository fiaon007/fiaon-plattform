import { useState } from "react";
import { Phone, MessageSquare, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

interface UsageData {
  calls: { used: number; limit: number; remaining: number };
  messages: { used: number; limit: number; remaining: number };
  plan: string;
  planName: string;
}

export default function UsageWidget() {
  const [showDetails, setShowDetails] = useState(false);

  // Use React Query for automatic updates when queries are invalidated
  const { data: usageData } = useQuery<{ success: boolean; usage: UsageData }>({
    queryKey: ["/api/user/usage"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/user/usage", { credentials: 'include' });
        if (!res.ok) {
          console.warn('[UsageWidget] API Error:', res.status);
          return null as any;
        }
        return await res.json();
      } catch (err) {
        console.error('[UsageWidget] Fetch error:', err);
        return null as any;
      }
    },
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true,
    retry: false,
  });

  const usage = usageData?.usage;
  if (!usage) return null;

  const callsPercent = usage.calls.limit === -1 ? 0 : (usage.calls.used / usage.calls.limit) * 100;
  const msgsPercent = usage.messages.limit === -1 ? 0 : (usage.messages.used / usage.messages.limit) * 100;
  const showWarning = callsPercent > 80 || msgsPercent > 80;

  if (usage.messages.limit === -1) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300"
      >
        <div className="flex items-center gap-1.5">
          <Phone className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400">
            {usage.calls.used}/{usage.calls.limit}
          </span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <span className="text-xs text-gray-400">
            {usage.messages.used}/{usage.messages.limit}
          </span>
        </div>
        {showWarning && (
          <div className="w-2 h-2 rounded-full bg-[#FE9100] animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full right-0 mt-2 w-80 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl p-4 shadow-2xl z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-[#FE9100]/10 to-transparent rounded-xl pointer-events-none" />
            
            <div className="relative">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-[#FE9100]" />
                  Deine Nutzung
                </h3>
                <span className="text-xs px-2 py-1 rounded-full bg-[#FE9100]/20 text-[#FE9100] border border-[#FE9100]/30">
                  {usage.planName}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">Anrufe</span>
                    </div>
                    <span className="text-sm text-white font-medium">
                      {usage.calls.used} / {usage.calls.limit}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        callsPercent > 90 ? "bg-red-500" :
                        callsPercent > 70 ? "bg-yellow-500" :
                        "bg-[#FE9100]"
                      }`}
                      style={{ width: `${Math.min(callsPercent, 100)}%` }}
                    />
                  </div>
                  {usage.calls.remaining <= 2 && usage.calls.remaining > 0 && (
                    <p className="text-xs text-yellow-500 mt-1">
                      ⚠️ Nur noch {usage.calls.remaining} Anruf{usage.calls.remaining !== 1 ? "e" : ""} verfügbar
                    </p>
                  )}
                  {usage.calls.remaining === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      🚫 Limit erreicht - Upgrade erforderlich
                    </p>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-400">Nachrichten</span>
                    </div>
                    <span className="text-sm text-white font-medium">
                      {usage.messages.used} / {usage.messages.limit}
                    </span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        msgsPercent > 90 ? "bg-red-500" :
                        msgsPercent > 70 ? "bg-yellow-500" :
                        "bg-[#FE9100]"
                      }`}
                      style={{ width: `${Math.min(msgsPercent, 100)}%` }}
                    />
                  </div>
                  {usage.messages.remaining <= 5 && usage.messages.remaining > 0 && (
                    <p className="text-xs text-yellow-500 mt-1">
                      ⚠️ Nur noch {usage.messages.remaining} Nachricht{usage.messages.remaining !== 1 ? "en" : ""} verfügbar
                    </p>
                  )}
                  {usage.messages.remaining === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      🚫 Limit erreicht - Upgrade erforderlich
                    </p>
                  )}
                </div>
              </div>

              {(usage.calls.remaining === 0 || usage.messages.remaining === 0) && (
                <button
                  onClick={() => window.location.href = "/billing"}
                  className="w-full mt-4 px-4 py-2 rounded-lg bg-gradient-to-r from-[#FE9100] to-[#a34e00] text-white font-medium hover:opacity-90 transition-opacity"
                >
                  Jetzt upgraden
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
