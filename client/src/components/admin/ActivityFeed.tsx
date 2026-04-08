"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, Users, TrendingUp, Phone, Mail, MessageSquare,
  LogIn, LogOut, UserPlus, UserCheck, UserMinus, CreditCard,
  Key, Send, XCircle, MessageCircle, Download, Settings,
  RefreshCw, Filter, Clock, Zap, ChevronDown, Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Icon Mapping
// ============================================================================
const ICON_MAP: Record<string, any> = {
  "activity": Activity,
  "user": Users,
  "user-plus": UserPlus,
  "user-check": UserCheck,
  "user-minus": UserMinus,
  "trending-up": TrendingUp,
  "phone": Phone,
  "mail": Mail,
  "message-square": MessageSquare,
  "log-in": LogIn,
  "log-out": LogOut,
  "credit-card": CreditCard,
  "key": Key,
  "send": Send,
  "x-circle": XCircle,
  "message-circle": MessageCircle,
  "download": Download,
  "settings": Settings,
};

// ============================================================================
// Types
// ============================================================================
interface ActivityItem {
  id: string;
  type: string;
  action: string;
  description: string;
  targetType: string | null;
  targetId: string | null;
  metadata: any;
  timestamp: string;
  user: { id: string; name: string } | null;
  icon: string;
  color: string;
}

interface ActivityFeedProps {
  limit?: number;
  compact?: boolean;
  showFilters?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

// ============================================================================
// Activity Feed Component
// ============================================================================
export function ActivityFeed({
  limit = 50,
  compact = false,
  showFilters = true,
  autoRefresh = true,
  refreshInterval = 30000,
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<string>("all");
  const [isLive, setIsLive] = useState(autoRefresh);

  // Fetch activity data
  const { data, isLoading, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-activity", limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity?limit=${limit}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    refetchInterval: isLive ? refreshInterval : false,
  });

  const activities: ActivityItem[] = data?.data || [];
  const stats = data?.stats || {};

  // Filter activities
  const filteredActivities = useMemo(() => {
    if (filter === "all") return activities;
    return activities.filter(a => a.type === filter);
  }, [activities, filter]);

  // Filter options
  const filterOptions = [
    { value: "all", label: "All Activity", count: activities.length },
    { value: "user_registered", label: "Users", count: stats.byType?.user_registered || 0 },
    { value: "lead_created", label: "Leads", count: stats.byType?.lead_created || 0 },
    { value: "call_made", label: "Calls", count: stats.byType?.call_made || 0 },
    { value: "email_sent", label: "Emails", count: stats.byType?.email_sent || 0 },
    { value: "staff_action", label: "Staff", count: stats.byType?.staff_action || 0 },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      {showFilters && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#FF6A00]" />
            <h2 className="font-semibold">Activity Feed</h2>
            <span className="text-xs text-white/40 px-2 py-0.5 bg-white/5 rounded-full">
              {stats.todayCount || 0} today
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Live Toggle */}
            <button
              onClick={() => setIsLive(!isLive)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors",
                isLive 
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                  : "bg-white/5 text-white/50 border border-white/10"
              )}
            >
              <div className={cn(
                "w-2 h-2 rounded-full",
                isLive ? "bg-emerald-400 animate-pulse" : "bg-white/30"
              )} />
              {isLive ? "Live" : "Paused"}
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => refetch()}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-colors",
                filter === opt.value
                  ? "bg-[#FF6A00]/20 text-[#FF6A00] border border-[#FF6A00]/30"
                  : "bg-white/5 text-white/50 border border-white/10 hover:border-white/20"
              )}
            >
              {opt.label}
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10">
                {opt.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-2">
        {isLoading ? (
          // Loading skeleton
          [...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/5 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-1/2 bg-white/10 rounded" />
              </div>
            </div>
          ))
        ) : filteredActivities.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No activity to show</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredActivities.map((activity, index) => (
              <ActivityCard 
                key={activity.id} 
                activity={activity} 
                index={index}
                compact={compact}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Last Updated */}
      {dataUpdatedAt && (
        <div className="text-center text-xs text-white/30">
          Updated {formatDistanceToNow(dataUpdatedAt, { addSuffix: true })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Activity Card Component
// ============================================================================
function ActivityCard({ 
  activity, 
  index,
  compact 
}: { 
  activity: ActivityItem; 
  index: number;
  compact: boolean;
}) {
  const Icon = ICON_MAP[activity.icon] || Activity;
  const timestamp = activity.timestamp ? new Date(activity.timestamp) : new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, delay: index * 0.02 }}
      className={cn(
        "group relative flex items-start gap-3 p-3 rounded-xl",
        "bg-white/[0.02] border border-white/5",
        "hover:bg-white/[0.04] hover:border-white/10 transition-all cursor-pointer"
      )}
    >
      {/* Icon */}
      <div 
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${activity.color}20` }}
      >
        <Icon className="w-5 h-5" style={{ color: activity.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/90 leading-snug">
          {activity.description}
        </p>
        
        <div className="flex items-center gap-3 mt-1">
          {activity.user && (
            <span className="text-xs text-white/50">
              by {activity.user.name}
            </span>
          )}
          <span className="text-xs text-white/30 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>

        {/* Metadata tags */}
        {!compact && activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {(Object.entries(activity.metadata) as [string, unknown][]).slice(0, 3).map(([key, value]) => (
              value ? (
                <span 
                  key={key}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40"
                >
                  {key}: {String(value)}
                </span>
              ) : null
            ))}
          </div>
        )}
      </div>

      {/* Hover indicator */}
      <div 
        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronDown className="w-4 h-4 text-white/30 -rotate-90" />
      </div>
    </motion.div>
  );
}

// ============================================================================
// Mini Activity Widget (for Dashboard)
// ============================================================================
export function ActivityWidget() {
  const { data } = useQuery({
    queryKey: ["admin-activity-widget"],
    queryFn: async () => {
      const res = await fetch("/api/admin/activity?limit=5", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const activities: ActivityItem[] = data?.data || [];

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#FF6A00]" />
          <span className="text-sm font-medium">Recent Activity</span>
        </div>
        <a 
          href="/admin-dashboard/activity"
          className="text-xs text-[#FF6A00] hover:underline"
        >
          View all
        </a>
      </div>
      
      <div className="divide-y divide-white/5">
        {activities.slice(0, 5).map((activity) => {
          const Icon = ICON_MAP[activity.icon] || Activity;
          return (
            <div 
              key={activity.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${activity.color}15` }}
              >
                <Icon className="w-4 h-4" style={{ color: activity.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white/70 truncate">{activity.description}</p>
                <p className="text-[10px] text-white/30">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ActivityFeed;
