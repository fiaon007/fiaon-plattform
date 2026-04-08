"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, User, Mail, Phone, Building2, Globe, Calendar, CreditCard,
  MessageSquare, PhoneCall, TrendingUp, Users, Activity, Sparkles,
  ChevronRight, ExternalLink, Copy, Check, AlertTriangle, Zap,
  Clock, DollarSign, BarChart3, Shield, Key, Trash2, RefreshCw,
  Download, Send, Star, Target, Brain, Lightbulb
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// Types
// ============================================================================

interface UserDeepDivePanelProps {
  userId: string | null;
  onClose: () => void;
}

type TabId = "overview" | "activity" | "billing" | "ai-profile" | "settings";

interface AIInsight {
  healthScore: number;
  healthLabel: string;
  churnRisk: string;
  upsellPotential: string;
  keyInsight: string;
  recommendations: string[];
  nextBestAction: string;
}

// ============================================================================
// User Deep-Dive Panel Component
// ============================================================================

export function UserDeepDivePanel({ userId, onClose }: UserDeepDivePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [copied, setCopied] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch User Deep-Dive Data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["user-deep-dive", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/deep-dive`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch user data");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 30000,
  });

  // AI Insight (separate call for better UX)
  const { data: aiInsight, isLoading: aiLoading, refetch: refetchAI } = useQuery({
    queryKey: ["user-ai-insight", userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/users/${userId}/ai-insight`, {
        credentials: "include",
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!userId && activeTab === "ai-profile",
    staleTime: 60000,
  });

  // Copy to clipboard
  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Reset tab when opening new user
  useEffect(() => {
    setActiveTab("overview");
  }, [userId]);

  const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "billing", label: "Billing", icon: CreditCard },
    { id: "ai-profile", label: "AI Profile", icon: Brain },
    { id: "settings", label: "Settings", icon: Shield },
  ];

  return (
    <AnimatePresence>
      {userId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-[640px] bg-[#0a0a0c] border-l border-white/10 z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-white/10 bg-[#0a0a0c]/80 backdrop-blur-xl">
              {/* Close & User Info */}
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  {isLoading ? (
                    <div className="w-14 h-14 rounded-2xl bg-white/10 animate-pulse" />
                  ) : (
                    <div className="relative">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FF6A00] to-[#FFB200] flex items-center justify-center text-xl font-bold text-black">
                        {data?.user?.firstName?.[0] || data?.user?.username?.[0] || "?"}
                      </div>
                      <div className={cn(
                        "absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0a0a0c]",
                        data?.user?.subscriptionStatus === "active" ? "bg-emerald-400" : "bg-zinc-500"
                      )} />
                    </div>
                  )}
                  
                  {/* Name & Meta */}
                  <div>
                    {isLoading ? (
                      <>
                        <div className="h-6 w-32 bg-white/10 rounded animate-pulse mb-1" />
                        <div className="h-4 w-24 bg-white/10 rounded animate-pulse" />
                      </>
                    ) : (
                      <>
                        <h2 className="text-lg font-bold text-white">
                          {data?.user?.firstName} {data?.user?.lastName}
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-white/50">
                          <span>@{data?.user?.username}</span>
                          <span>•</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs font-medium",
                            data?.user?.subscriptionPlan === "ultimate" && "bg-amber-500/20 text-amber-400",
                            data?.user?.subscriptionPlan === "ultra" && "bg-violet-500/20 text-violet-400",
                            data?.user?.subscriptionPlan === "pro" && "bg-blue-500/20 text-blue-400",
                            (!data?.user?.subscriptionPlan || data?.user?.subscriptionPlan === "free") && "bg-zinc-500/20 text-zinc-400",
                          )}>
                            {data?.user?.subscriptionPlan?.toUpperCase() || "FREE"}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-white/60" />
                </button>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2 px-4 pb-4">
                {[
                  { label: "Calls", value: data?.stats?.totalCalls || 0, icon: PhoneCall, color: "#EF4444" },
                  { label: "Chats", value: data?.stats?.totalChats || 0, icon: MessageSquare, color: "#06B6D4" },
                  { label: "Leads", value: data?.stats?.totalLeads || 0, icon: TrendingUp, color: "#8B5CF6" },
                  { label: "Contacts", value: data?.stats?.totalContacts || 0, icon: Users, color: "#10B981" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                      <span className="text-xs text-white/40">{stat.label}</span>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {isLoading ? "-" : stat.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-1 px-4 pb-2 overflow-x-auto scrollbar-none">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      activeTab === tab.id
                        ? "bg-white/10 text-white"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <LoadingSkeleton />
              ) : error ? (
                <ErrorState onRetry={() => refetch()} />
              ) : (
                <>
                  {activeTab === "overview" && (
                    <OverviewTab user={data.user} copyToClipboard={copyToClipboard} copied={copied} />
                  )}
                  {activeTab === "activity" && (
                    <ActivityTab calls={data.calls} chats={data.chatSessions} />
                  )}
                  {activeTab === "billing" && (
                    <BillingTab user={data.user} stripe={data.stripe} />
                  )}
                  {activeTab === "ai-profile" && (
                    <AIProfileTab 
                      user={data.user} 
                      insight={aiInsight} 
                      isLoading={aiLoading}
                      onRefresh={() => refetchAI()}
                    />
                  )}
                  {activeTab === "settings" && (
                    <SettingsTab user={data.user} onClose={onClose} />
                  )}
                </>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex-shrink-0 border-t border-white/10 p-4 bg-[#0a0a0c]/80 backdrop-blur-xl">
              <div className="flex items-center gap-2">
                <a
                  href={`mailto:${data?.user?.email}`}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors text-sm font-medium"
                >
                  <Mail className="w-4 h-4" />
                  Email senden
                </a>
                {data?.user?.phone && (
                  <a
                    href={`tel:${data?.user?.phone}`}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#FFB200] text-black font-bold text-sm hover:opacity-90 transition-opacity"
                  >
                    <PhoneCall className="w-4 h-4" />
                    Anrufen
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ============================================================================
// Overview Tab
// ============================================================================

function OverviewTab({ user, copyToClipboard, copied }: any) {
  const fields = [
    { label: "Email", value: user?.email, icon: Mail, copyable: true },
    { label: "Telefon", value: user?.phone, icon: Phone, copyable: true },
    { label: "Firma", value: user?.company, icon: Building2 },
    { label: "Website", value: user?.website, icon: Globe, link: true },
    { label: "Branche", value: user?.industry, icon: Target },
    { label: "Rolle", value: user?.jobRole, icon: User },
    { label: "User ID", value: user?.id, icon: Key, copyable: true, mono: true },
    { label: "Registriert", value: user?.createdAt ? format(new Date(user.createdAt), "dd.MM.yyyy", { locale: de }) : "-", icon: Calendar },
  ];

  return (
    <div className="space-y-4">
      {/* Info Fields */}
      <div className="space-y-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 group"
          >
            <div className="flex items-center gap-3">
              <field.icon className="w-4 h-4 text-white/40" />
              <div>
                <div className="text-xs text-white/40">{field.label}</div>
                <div className={cn(
                  "text-sm text-white",
                  field.mono && "font-mono text-xs"
                )}>
                  {field.value || "-"}
                </div>
              </div>
            </div>
            
            {field.copyable && field.value && (
              <button
                onClick={() => copyToClipboard(field.value, field.label)}
                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
              >
                {copied === field.label ? (
                  <Check className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/40" />
                )}
              </button>
            )}
            
            {field.link && field.value && (
              <a
                href={field.value.startsWith("http") ? field.value : `https://${field.value}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all"
              >
                <ExternalLink className="w-4 h-4 text-white/40" />
              </a>
            )}
          </div>
        ))}
      </div>

      {/* Usage Stats */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-[#FF6A00]/10 to-[#FFB200]/10 border border-[#FF6A00]/20">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-[#FF6A00]" />
          Nutzung diesen Monat
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-white">{user?.aiMessagesUsed || 0}</div>
            <div className="text-xs text-white/50">AI Messages</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{user?.voiceCallsUsed || 0}</div>
            <div className="text-xs text-white/50">Voice Calls</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Activity Tab
// ============================================================================

function ActivityTab({ calls, chats }: any) {
  return (
    <div className="space-y-4">
      {/* Recent Calls */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <PhoneCall className="w-4 h-4 text-red-400" />
          Letzte Calls ({calls?.length || 0})
        </h3>
        <div className="space-y-2">
          {calls?.slice(0, 5).map((call: any) => (
            <div
              key={call.id}
              className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    {call.contactName || call.phoneNumber}
                  </div>
                  <div className="text-xs text-white/40">
                    {call.duration ? `${Math.floor(call.duration / 60)}:${(call.duration % 60).toString().padStart(2, "0")}` : "-"} • {formatDistanceToNow(new Date(call.createdAt), { addSuffix: true, locale: de })}
                  </div>
                </div>
                <span className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  call.status === "completed" && "bg-emerald-500/20 text-emerald-400",
                  call.status === "failed" && "bg-red-500/20 text-red-400",
                  call.status === "running" && "bg-blue-500/20 text-blue-400",
                )}>
                  {call.status}
                </span>
              </div>
            </div>
          ))}
          {(!calls || calls.length === 0) && (
            <div className="text-center py-8 text-white/40 text-sm">
              Keine Calls vorhanden
            </div>
          )}
        </div>
      </div>

      {/* Recent Chats */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-cyan-400" />
          Letzte Chat Sessions ({chats?.length || 0})
        </h3>
        <div className="space-y-2">
          {chats?.slice(0, 5).map((chat: any) => (
            <div
              key={chat.id}
              className="p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-white">
                    {chat.title || "Untitled Chat"}
                  </div>
                  <div className="text-xs text-white/40">
                    {chat.messageCount || 0} Nachrichten • {formatDistanceToNow(new Date(chat.createdAt), { addSuffix: true, locale: de })}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-white/20" />
              </div>
            </div>
          ))}
          {(!chats || chats.length === 0) && (
            <div className="text-center py-8 text-white/40 text-sm">
              Keine Chat Sessions vorhanden
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Billing Tab
// ============================================================================

function BillingTab({ user, stripe }: any) {
  return (
    <div className="space-y-4">
      {/* Current Plan */}
      <div className="p-4 rounded-xl bg-gradient-to-br from-[#FF6A00]/10 to-[#FFB200]/10 border border-[#FF6A00]/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#FF6A00]" />
            Aktueller Plan
          </h3>
          <span className={cn(
            "px-3 py-1 rounded-full text-xs font-bold",
            user?.subscriptionStatus === "active" && "bg-emerald-500/20 text-emerald-400",
            user?.subscriptionStatus === "trialing" && "bg-blue-500/20 text-blue-400",
            user?.subscriptionStatus === "canceled" && "bg-red-500/20 text-red-400",
            user?.subscriptionStatus === "past_due" && "bg-amber-500/20 text-amber-400",
          )}>
            {user?.subscriptionStatus?.toUpperCase() || "UNKNOWN"}
          </span>
        </div>
        
        <div className="text-3xl font-bold text-white mb-1">
          {user?.subscriptionPlan?.toUpperCase() || "FREE"}
        </div>
        
        {user?.subscriptionEndDate && (
          <div className="text-sm text-white/50">
            {user.subscriptionStatus === "canceled" ? "Endet am" : "Verlängert am"}: {format(new Date(user.subscriptionEndDate), "dd.MM.yyyy", { locale: de })}
          </div>
        )}
      </div>

      {/* Stripe Info */}
      {stripe && (
        <div className="space-y-2">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="text-xs text-white/40">Stripe Customer ID</div>
            <div className="text-sm text-white font-mono">{stripe.customerId}</div>
          </div>
          
          {stripe.subscriptions?.length > 0 && (
            <div className="p-3 rounded-xl bg-white/5 border border-white/5">
              <div className="text-xs text-white/40 mb-2">Aktive Subscriptions</div>
              {stripe.subscriptions.map((sub: any) => (
                <div key={sub.id} className="text-sm text-white">
                  {sub.plan?.nickname || sub.plan?.id} - {sub.status}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!stripe && (
        <div className="text-center py-8 text-white/40 text-sm">
          Keine Stripe-Daten vorhanden
        </div>
      )}
    </div>
  );
}

// ============================================================================
// AI Profile Tab
// ============================================================================

function AIProfileTab({ user, insight, isLoading, onRefresh }: any) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3 text-white/50">
          <Sparkles className="w-5 h-5 animate-pulse text-[#FF6A00]" />
          <span>AI analysiert User...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          Neu analysieren
        </button>
      </div>

      {/* AI Health Score */}
      {insight && (
        <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10 border border-violet-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Brain className="w-4 h-4 text-violet-400" />
              AI Health Score
            </h3>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold",
              insight.healthScore >= 80 && "bg-emerald-500/20 text-emerald-400",
              insight.healthScore >= 50 && insight.healthScore < 80 && "bg-amber-500/20 text-amber-400",
              insight.healthScore < 50 && "bg-red-500/20 text-red-400",
            )}>
              {insight.healthLabel}
            </span>
          </div>
          
          {/* Score Bar */}
          <div className="h-3 bg-white/10 rounded-full overflow-hidden mb-4">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${insight.healthScore}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                insight.healthScore >= 80 && "bg-gradient-to-r from-emerald-500 to-emerald-400",
                insight.healthScore >= 50 && insight.healthScore < 80 && "bg-gradient-to-r from-amber-500 to-amber-400",
                insight.healthScore < 50 && "bg-gradient-to-r from-red-500 to-red-400",
              )}
            />
          </div>
          
          <div className="text-4xl font-bold text-white mb-2">{insight.healthScore}</div>
          <div className="text-sm text-white/60">{insight.keyInsight}</div>
        </div>
      )}

      {/* Risk Indicators */}
      {insight && (
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="text-xs text-white/40 mb-1">Churn Risk</div>
            <div className={cn(
              "text-sm font-semibold",
              insight.churnRisk === "low" && "text-emerald-400",
              insight.churnRisk === "medium" && "text-amber-400",
              insight.churnRisk === "high" && "text-red-400",
            )}>
              {insight.churnRisk?.toUpperCase()}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <div className="text-xs text-white/40 mb-1">Upsell Potential</div>
            <div className={cn(
              "text-sm font-semibold",
              insight.upsellPotential === "high" && "text-emerald-400",
              insight.upsellPotential === "medium" && "text-amber-400",
              insight.upsellPotential === "low" && "text-white/60",
            )}>
              {insight.upsellPotential?.toUpperCase()}
            </div>
          </div>
        </div>
      )}

      {/* AI Recommendations */}
      {insight?.recommendations && insight.recommendations.length > 0 && (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            AI Empfehlungen
          </h3>
          <ul className="space-y-2">
            {insight.recommendations.map((rec: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <ChevronRight className="w-4 h-4 text-[#FF6A00] flex-shrink-0 mt-0.5" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Best Action */}
      {insight?.nextBestAction && (
        <button className="w-full p-4 rounded-xl bg-gradient-to-r from-[#FF6A00] to-[#FFB200] text-black font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
          <Zap className="w-4 h-4" />
          {insight.nextBestAction}
        </button>
      )}

      {!insight && (
        <div className="text-center py-8 text-white/40 text-sm">
          <Brain className="w-12 h-12 mx-auto mb-3 opacity-30" />
          AI Insights nicht verfügbar
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Settings Tab
// ============================================================================

function SettingsTab({ user, onClose }: any) {
  const queryClient = useQueryClient();
  
  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const newPassword = Math.random().toString(36).slice(-12);
      const res = await fetch(`/api/admin/users/${user.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to reset password");
      return { password: newPassword };
    },
    onSuccess: (data) => {
      alert(`Neues Passwort: ${data.password}\n\nBitte dem User mitteilen!`);
    },
    onError: () => {
      alert("Fehler beim Zurücksetzen des Passworts");
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async (role: string) => {
      const res = await fetch(`/api/admin/users/${user.id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update role");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-deep-dive", user.id] });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      onClose();
    },
  });

  return (
    <div className="space-y-4">
      {/* User Role */}
      <div className="p-4 rounded-xl bg-white/5 border border-white/5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          User Role
        </h3>
        <div className="flex gap-2">
          {["user", "staff", "admin"].map((role) => (
            <button
              key={role}
              onClick={() => {
                if (user.userRole !== role) {
                  updateRoleMutation.mutate(role);
                }
              }}
              disabled={updateRoleMutation.isPending}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                user?.userRole === role
                  ? "bg-[#FF6A00] text-black"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              )}
            >
              {role.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
        <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h3>
        <div className="space-y-2">
          <button
            onClick={() => {
              if (confirm("Passwort wirklich zurücksetzen? Ein neues Passwort wird generiert.")) {
                resetPasswordMutation.mutate();
              }
            }}
            disabled={resetPasswordMutation.isPending}
            className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            {resetPasswordMutation.isPending ? "Wird zurückgesetzt..." : "Passwort zurücksetzen"}
          </button>
          
          <button
            onClick={() => {
              if (confirm(`User "${user?.username}" wirklich LÖSCHEN?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`)) {
                deleteUserMutation.mutate();
              }
            }}
            disabled={deleteUserMutation.isPending}
            className="w-full p-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {deleteUserMutation.isPending ? "Wird gelöscht..." : "User löschen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-16 bg-white/5 rounded-xl" />
      ))}
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
      <h3 className="text-lg font-semibold text-white mb-2">Fehler beim Laden</h3>
      <p className="text-sm text-white/50 mb-4">Die User-Daten konnten nicht geladen werden.</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors flex items-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Erneut versuchen
      </button>
    </div>
  );
}

export default UserDeepDivePanel;
