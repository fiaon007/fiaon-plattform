"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, Eye, UserCog, UserX, CreditCard, Key, Zap, Mail,
  Download, UserPlus, Clock, Filter, RefreshCw, Sparkles,
  ChevronRight, AlertTriangle, CheckCircle2, Info, Play,
  Phone, PhoneOff, MessageSquare, Shield, TrendingUp, Upload,
  UserMinus, XCircle, LogIn, Wifi, WifiOff
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

// ============================================================================
// Icon Mapping
// ============================================================================

const ICONS: Record<string, React.ElementType> = {
  Eye, UserCog, UserX, CreditCard, Key, Zap, Mail, Download, UserPlus,
  Play, Phone, PhoneOff, MessageSquare, Shield, TrendingUp, Upload,
  UserMinus, XCircle, LogIn, Activity, CheckCircle: CheckCircle2,
};

// ============================================================================
// Category Definitions
// ============================================================================

const CATEGORIES = [
  { id: "all", label: "Alle", color: "#FFFFFF", icon: Activity },
  { id: "user", label: "Users", color: "#6366F1", icon: UserCog },
  { id: "billing", label: "Billing", color: "#FF6A00", icon: CreditCard },
  { id: "security", label: "Security", color: "#8B5CF6", icon: Shield },
  { id: "automation", label: "Automation", color: "#10B981", icon: Zap },
  { id: "communication", label: "Communication", color: "#06B6D4", icon: Mail },
  { id: "leads", label: "Leads", color: "#8B5CF6", icon: TrendingUp },
  { id: "calls", label: "Calls", color: "#EF4444", icon: Phone },
  { id: "data", label: "Data", color: "#78716C", icon: Download },
  { id: "team", label: "Team", color: "#EC4899", icon: UserPlus },
];

// ============================================================================
// Types
// ============================================================================

interface ActivityItem {
  id: number;
  actorId: string;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  actionCategory: string;
  actionIcon: string | null;
  actionColor: string | null;
  targetType: string | null;
  targetId: string | null;
  targetName: string | null;
  targetUrl: string | null;
  title: string;
  description: string | null;
  metadata: Record<string, any> | null;
  aiInsight: string | null;
  aiPriority: string | null;
  aiSuggestion: string | null;
  createdAt: string;
}

// ============================================================================
// Activity Feed Component (Enhanced with SSE)
// ============================================================================

export function ActivityFeedEnhanced() {
  const [category, setCategory] = useState("all");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  // Initial data fetch
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-activity-feed", category],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (category !== "all") params.append("category", category);
      const res = await fetch(`/api/admin/activity?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch activities");
      return res.json();
    },
  });

  // Set activities from query
  useEffect(() => {
    if (data?.data) {
      setActivities(data.data);
    }
  }, [data]);

  // SSE Connection for real-time updates
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      try {
        const eventSource = new EventSource("/api/admin/activity/stream", {
          withCredentials: true,
        });

        eventSource.onopen = () => {
          setIsConnected(true);
          setConnectionError(false);
          console.log("[SSE] Connected to activity stream");
        };

        eventSource.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);

            if (message.type === "connected") {
              setIsConnected(true);
            }

            if (message.type === "new") {
              // Add new activity to the top
              setActivities((prev) => [message.activity, ...prev.slice(0, 49)]);
            }

            if (message.type === "update") {
              // Update existing activity with AI enrichment
              setActivities((prev) =>
                prev.map((a) =>
                  a.id === message.id
                    ? {
                        ...a,
                        aiInsight: message.aiInsight,
                        aiPriority: message.aiPriority,
                        aiSuggestion: message.aiSuggestion,
                      }
                    : a
                )
              );
            }
          } catch (err) {
            console.warn("[SSE] Failed to parse message:", err);
          }
        };

        eventSource.onerror = () => {
          setIsConnected(false);
          setConnectionError(true);
          eventSource.close();
          
          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };

        eventSourceRef.current = eventSource;
      } catch (err) {
        setConnectionError(true);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      clearTimeout(reconnectTimeout);
      eventSourceRef.current?.close();
    };
  }, []);

  // Activity stats
  const { data: stats } = useQuery({
    queryKey: ["admin-activity-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/activity/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // Filter activities by category
  const filteredActivities = category === "all"
    ? activities
    : activities.filter((a) => a.actionCategory === category);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Activity className="w-7 h-7 text-[#FF6A00]" />
            Activity Feed
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Live-Übersicht aller Admin-Aktionen mit AI Insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
            isConnected 
              ? "bg-emerald-500/20 text-emerald-400" 
              : connectionError 
                ? "bg-red-500/20 text-red-400"
                : "bg-amber-500/20 text-amber-400"
          )}>
            {isConnected ? (
              <>
                <Wifi className="w-3 h-3" />
                Live
              </>
            ) : connectionError ? (
              <>
                <WifiOff className="w-3 h-3" />
                Verbindungsfehler
              </>
            ) : (
              <>
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Verbinde...
              </>
            )}
          </div>

          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats?.data && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Letzte 24h", value: stats.data.total, color: "#FFFFFF" },
            { label: "Users", value: stats.data.users, color: "#6366F1" },
            { label: "Billing", value: stats.data.billing, color: "#FF6A00" },
            { label: "Security", value: stats.data.security, color: "#8B5CF6" },
            { label: "Critical", value: stats.data.critical, color: "#EF4444" },
            { label: "High Priority", value: stats.data.high, color: "#F59E0B" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-4 rounded-xl bg-white/5 border border-white/5"
            >
              <div className="text-xs text-white/40 mb-1">{stat.label}</div>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value || 0}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
              category === cat.id
                ? "bg-white/10 text-white border-l-4"
                : "text-white/50 hover:text-white hover:bg-white/5"
            )}
            style={{
              borderLeftColor: category === cat.id ? cat.color : "transparent",
            }}
          >
            <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
            {cat.label}
          </button>
        ))}
      </div>

      {/* Activity List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredActivities.map((activity, index) => (
            <ActivityCard 
              key={activity.id} 
              activity={activity} 
              index={index} 
            />
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {filteredActivities.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <div className="text-white/50">Keine Aktivitäten in dieser Kategorie</div>
            <p className="text-sm text-white/30 mt-2">
              Neue Aktivitäten erscheinen automatisch hier
            </p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Activity Card Component
// ============================================================================

function ActivityCard({ activity, index }: { activity: ActivityItem; index: number }) {
  const Icon = ICONS[activity.actionIcon || "Activity"] || Activity;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.2) }}
      className="group p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer"
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${activity.actionColor || "#6366F1"}20` }}
        >
          <Icon 
            className="w-5 h-5" 
            style={{ color: activity.actionColor || "#6366F1" }} 
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-white">{activity.title}</span>
            
            {/* Priority Badge */}
            {activity.aiPriority && (
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                activity.aiPriority === "critical" && "bg-red-500/20 text-red-400",
                activity.aiPriority === "high" && "bg-amber-500/20 text-amber-400",
                activity.aiPriority === "medium" && "bg-blue-500/20 text-blue-400",
                activity.aiPriority === "low" && "bg-white/10 text-white/50",
              )}>
                {activity.aiPriority}
              </span>
            )}

            {/* New indicator for recent items */}
            {index === 0 && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 animate-pulse">
                NEU
              </span>
            )}
          </div>

          {/* Actor & Target */}
          <div className="text-sm text-white/60 mb-2">
            <span className="text-white/80">{activity.actorName || activity.actorId}</span>
            {activity.targetName && (
              <>
                <span className="mx-2">→</span>
                <span className="text-white/80">{activity.targetName}</span>
              </>
            )}
          </div>

          {/* Description */}
          {activity.description && (
            <p className="text-sm text-white/50 mb-2">{activity.description}</p>
          )}

          {/* AI Insight */}
          {activity.aiInsight && (
            <div className="flex items-start gap-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20 mb-2">
              <Sparkles className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-xs text-violet-300">{activity.aiInsight}</div>
                {activity.aiSuggestion && (
                  <div className="text-xs text-violet-400/70 mt-1">
                    💡 {activity.aiSuggestion}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(activity.createdAt), {
              addSuffix: true,
              locale: de,
            })}
            {activity.actorRole && (
              <>
                <span>•</span>
                <span className="uppercase">{activity.actorRole}</span>
              </>
            )}
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className="w-5 h-5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </motion.div>
  );
}

export default ActivityFeedEnhanced;
