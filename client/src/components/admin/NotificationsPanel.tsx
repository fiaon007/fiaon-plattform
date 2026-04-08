"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bell, X, Check, CheckCheck, Users, TrendingUp, Phone,
  Mail, AlertTriangle, AlertCircle, Info, CheckCircle,
  ExternalLink, Clock, Sparkles, Trash2, Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

// ============================================================================
// Icon Mapping
// ============================================================================
const ICON_MAP: Record<string, any> = {
  "user-plus": Users,
  "trending-up": TrendingUp,
  "phone": Phone,
  "phone-off": Phone,
  "mail": Mail,
  "mail-x": Mail,
  "check-circle": CheckCircle,
  "alert-triangle": AlertTriangle,
  "alert-circle": AlertCircle,
  "info": Info,
};

const TYPE_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  info: { bg: "bg-blue-500/10", border: "border-blue-500/20", icon: "text-blue-400" },
  success: { bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: "text-emerald-400" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "text-amber-400" },
  error: { bg: "bg-red-500/10", border: "border-red-500/20", icon: "text-red-400" },
};

// ============================================================================
// Types
// ============================================================================
interface Notification {
  id: string;
  type: "info" | "success" | "warning" | "error";
  category: string;
  title: string;
  message: string;
  icon: string;
  color: string;
  priority: "low" | "normal" | "high" | "urgent";
  read: boolean;
  readAt?: string;
  timestamp: string;
  action?: {
    label: string;
    url: string;
  };
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ============================================================================
// Notifications Panel Component
// ============================================================================
export function NotificationsPanel({ isOpen, onClose }: NotificationsPanelProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  // Fetch notifications
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const notifications: Notification[] = data?.data || [];
  const unreadCount = data?.unreadCount || 0;

  // Filter notifications
  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.read)
    : notifications;

  // Mark as read mutation
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/admin/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  // Mark all as read mutation
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await fetch("/api/admin/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 20 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed right-4 top-20 z-50 w-96 max-h-[calc(100vh-6rem)] bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#FF6A00]" />
            <h2 className="font-semibold">Notifications</h2>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs font-bold bg-[#FF6A00] text-black rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllReadMutation.mutate()}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-white/50 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-2 border-b border-white/5">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1 text-xs rounded-lg transition-colors",
              filter === "all"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter("unread")}
            className={cn(
              "px-3 py-1 text-xs rounded-lg transition-colors",
              filter === "unread"
                ? "bg-white/10 text-white"
                : "text-white/50 hover:text-white hover:bg-white/5"
            )}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="flex gap-3 p-3 rounded-xl bg-white/5">
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-3/4 bg-white/10 rounded" />
                      <div className="h-3 w-1/2 bg-white/10 rounded" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-3 text-white/10" />
              <p className="text-sm text-white/40">
                {filter === "unread" ? "No unread notifications" : "No notifications yet"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              <AnimatePresence mode="popLayout">
                {filteredNotifications.map((notification, index) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                    index={index}
                    onMarkRead={() => markReadMutation.mutate(notification.id)}
                    onClose={onClose}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 bg-white/[0.02]">
          <a
            href="/admin-dashboard/activity"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg text-sm text-white/50 hover:text-white hover:bg-white/5 transition-colors"
            onClick={onClose}
          >
            <Sparkles className="w-4 h-4" />
            View all activity
          </a>
        </div>
      </motion.div>
    </>
  );
}

// ============================================================================
// Notification Card Component
// ============================================================================
function NotificationCard({
  notification,
  index,
  onMarkRead,
  onClose,
}: {
  notification: Notification;
  index: number;
  onMarkRead: () => void;
  onClose: () => void;
}) {
  const Icon = ICON_MAP[notification.icon] || Info;
  const styles = TYPE_STYLES[notification.type] || TYPE_STYLES.info;
  const timestamp = notification.timestamp ? new Date(notification.timestamp) : new Date();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15, delay: index * 0.02 }}
      className={cn(
        "relative p-3 rounded-xl border transition-all cursor-pointer group",
        notification.read
          ? "bg-white/[0.01] border-white/5 hover:border-white/10"
          : cn(styles.bg, styles.border, "hover:brightness-110"),
        notification.priority === "urgent" && !notification.read && "ring-1 ring-red-500/50"
      )}
      onClick={() => {
        if (!notification.read) onMarkRead();
        if (notification.action?.url) {
          window.location.href = notification.action.url;
          onClose();
        }
      }}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div 
          className={cn(
            "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center",
            notification.read ? "bg-white/5" : styles.bg
          )}
        >
          <Icon 
            className={cn("w-5 h-5", notification.read ? "text-white/30" : styles.icon)} 
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn(
              "text-sm font-medium",
              notification.read ? "text-white/50" : "text-white"
            )}>
              {notification.title}
            </h3>
            {!notification.read && (
              <div className="w-2 h-2 rounded-full bg-[#FF6A00] flex-shrink-0 mt-1.5" />
            )}
          </div>
          
          <p className={cn(
            "text-xs mt-0.5 line-clamp-2",
            notification.read ? "text-white/30" : "text-white/60"
          )}>
            {notification.message}
          </p>

          <div className="flex items-center gap-3 mt-2">
            <span className="text-[10px] text-white/30 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(timestamp, { addSuffix: true })}
            </span>
            
            {notification.action && (
              <span className="text-[10px] text-[#FF6A00] flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {notification.action.label}
                <ExternalLink className="w-3 h-3" />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Priority indicator */}
      {notification.priority === "urgent" && !notification.read && (
        <div className="absolute -top-1 -right-1">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// Notification Bell with Badge (for header)
// ============================================================================
export function NotificationBell({ onClick }: { onClick: () => void }) {
  const { data } = useQuery({
    queryKey: ["admin-notifications-count"],
    queryFn: async () => {
      const res = await fetch("/api/admin/notifications/count", {
        credentials: "include",
      });
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 15000,
  });

  const unreadCount = data?.unreadCount || 0;
  const hasUrgent = data?.hasUrgent || false;

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-white/5 transition-colors"
    >
      <Bell className={cn(
        "w-5 h-5",
        hasUrgent ? "text-red-400 animate-pulse" : "text-white/60"
      )} />
      
      {unreadCount > 0 && (
        <span className={cn(
          "absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center",
          "text-[10px] font-bold rounded-full",
          hasUrgent 
            ? "bg-red-500 text-white animate-pulse" 
            : "bg-[#FF6A00] text-black"
        )}>
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </button>
  );
}

export default NotificationsPanel;
