"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { 
  Users, Mail, TrendingUp, Calendar, Building2, Megaphone,
  MessageSquare, Phone, Zap, Bug, Crown, Clock, Settings,
  LayoutDashboard, UserPlus, Download, Activity, Search,
  Bell, ChevronLeft, ChevronRight, Command, Sparkles,
  MessageCircle, ListTodo, Shield, X, Menu, Keyboard, Receipt
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { GlobalSearch } from "./GlobalSearch";
import { KeyboardShortcutsProvider } from "./KeyboardShortcuts";
import { NotificationsPanel, NotificationBell } from "./NotificationsPanel";

// ============================================================================
// ARAS Design System 2026
// ============================================================================
const DESIGN = {
  bg: {
    primary: "#050507",
    card: "rgba(255,255,255,0.03)",
    hover: "rgba(255,255,255,0.05)",
    active: "rgba(255,255,255,0.10)",
  },
  border: {
    subtle: "rgba(255,255,255,0.05)",
    default: "rgba(255,255,255,0.10)",
    hover: "rgba(255,255,255,0.20)",
  },
  accent: {
    primary: "#FF6A00",
    secondary: "#FFB200",
    gradient: "linear-gradient(135deg, #FF6A00 0%, #FFB200 100%)",
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255,255,255,0.5)",
    muted: "rgba(255,255,255,0.3)",
  },
  radius: {
    sm: "8px",
    md: "12px",
    lg: "20px",
  },
};

// ============================================================================
// Navigation Configuration
// ============================================================================
const NAV_SECTIONS = [
  {
    title: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/admin-dashboard", color: "#FF6A00" },
      { id: "activity", label: "Activity Feed", icon: Activity, path: "/admin-dashboard/activity", color: "#10B981" },
    ]
  },
  {
    title: "Users & CRM",
    items: [
      { id: "users", label: "Users", icon: Users, path: "/admin-dashboard/users", color: "#FF6A00", badge: "live" },
      { id: "leads", label: "Leads", icon: TrendingUp, path: "/admin-dashboard/leads", color: "#8B5CF6" },
      { id: "contacts", label: "Contacts", icon: Building2, path: "/admin-dashboard/contacts", color: "#06B6D4" },
    ]
  },
  {
    title: "Communication",
    items: [
      { id: "emails", label: "N8N Emails", icon: Mail, path: "/admin-dashboard/emails", color: "#FF6A00" },
      { id: "calls", label: "Voice Calls", icon: Phone, path: "/admin-dashboard/calls", color: "#EF4444" },
      { id: "campaigns", label: "Campaigns", icon: Megaphone, path: "/admin-dashboard/campaigns", color: "#EC4899" },
    ]
  },
  {
    title: "AI & Automation",
    items: [
      { id: "agents", label: "Voice Agents", icon: Zap, path: "/admin-dashboard/agents", color: "#F97316" },
      { id: "chats", label: "AI Chats", icon: MessageSquare, path: "/admin-dashboard/chats", color: "#06B6D4" },
    ]
  },
  {
    title: "Team",
    items: [
      { id: "team-chat", label: "Team Chat", icon: MessageCircle, path: "/admin-dashboard/team-chat", color: "#10B981", badge: "new" },
      { id: "tasks", label: "Tasks", icon: ListTodo, path: "/admin-dashboard/tasks", color: "#F59E0B" },
      { id: "staff", label: "Staff Management", icon: Shield, path: "/admin-dashboard/staff", color: "#8B5CF6" },
    ]
  },
  {
    title: "System",
    items: [
      { id: "service-orders", label: "Service Orders", icon: Receipt, path: "/admin-dashboard/service-orders", color: "#F59E0B" },
      { id: "feedback", label: "Feedback & Bugs", icon: Bug, path: "/admin-dashboard/feedback", color: "#F43F5E" },
      { id: "plans", label: "Subscription Plans", icon: Crown, path: "/admin-dashboard/plans", color: "#0EA5E9" },
      { id: "exports", label: "Data Exports", icon: Download, path: "/admin-dashboard/exports", color: "#78716C" },
      { id: "settings", label: "Settings", icon: Settings, path: "/admin-dashboard/settings", color: "#6B7280" },
    ]
  },
];

// ============================================================================
// Animation Variants (GPU-optimized)
// ============================================================================
const sidebarVariants = {
  expanded: { width: 260 },
  collapsed: { width: 72 },
};

const fadeInOut = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const slideIn = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -10 },
};

// ============================================================================
// Command Center Layout Component
// ============================================================================
interface CommandCenterLayoutProps {
  children: React.ReactNode;
}

export function CommandCenterLayout({ children }: CommandCenterLayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K = Search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Cmd/Ctrl + B = Toggle Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
      }
      // Cmd/Ctrl + N = Notifications
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setNotificationsOpen(prev => !prev);
      }
      // Escape = Close modals
      if (e.key === "Escape") {
        setSearchOpen(false);
        setMobileMenuOpen(false);
        setNotificationsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  // Online users count
  const { data: onlineData } = useQuery({
    queryKey: ["admin-online"],
    queryFn: async () => {
      const res = await fetch("/api/admin/online-users", { credentials: "include" });
      return res.ok ? res.json() : { onlineUserIds: [] };
    },
    refetchInterval: 30000,
  });

  const onlineCount = onlineData?.onlineUserIds?.length || 0;

  // Animation transition settings
  const transition = prefersReducedMotion 
    ? { duration: 0 } 
    : { duration: 0.2, ease: "easeInOut" };

  return (
    <div className="min-h-screen text-white flex" style={{ backgroundColor: DESIGN.bg.primary }}>
      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={sidebarCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={transition}
        className={cn(
          "fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r bg-[#050507]",
          "lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
        style={{ borderColor: DESIGN.border.subtle }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b" style={{ borderColor: DESIGN.border.subtle }}>
          <motion.div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: DESIGN.accent.gradient }}
            >
              <Command className="w-5 h-5 text-black" />
            </div>
            <AnimatePresence mode="wait">
              {!sidebarCollapsed && (
                <motion.div {...slideIn} transition={transition} className="flex flex-col">
                  <span className="font-bold text-sm">ARAS</span>
                  <span className="text-[10px]" style={{ color: DESIGN.text.muted }}>Command Center</span>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          
          {/* Mobile close button */}
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-6 scrollbar-thin scrollbar-thumb-white/10">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title}>
              <AnimatePresence mode="wait">
                {!sidebarCollapsed && (
                  <motion.div
                    {...fadeInOut}
                    transition={transition}
                    className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: DESIGN.text.muted }}
                  >
                    {section.title}
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location === item.path || 
                    (item.path !== "/admin-dashboard" && location.startsWith(item.path));
                  const Icon = item.icon;
                  
                  return (
                    <motion.div
                      key={item.id}
                      onClick={() => setLocation(item.path)}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors",
                        isActive ? "text-white" : "hover:bg-white/5"
                      )}
                      style={{ 
                        backgroundColor: isActive ? DESIGN.bg.active : undefined,
                        color: isActive ? DESIGN.text.primary : DESIGN.text.secondary,
                      }}
                      whileHover={prefersReducedMotion ? {} : { x: 2 }}
                      whileTap={prefersReducedMotion ? {} : { scale: 0.98 }}
                    >
                      {/* Active indicator */}
                      {isActive && (
                        <motion.div
                          layoutId={prefersReducedMotion ? undefined : "nav-indicator"}
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                          style={{ backgroundColor: item.color }}
                          transition={transition}
                        />
                      )}
                      
                      <Icon 
                        className="w-5 h-5 flex-shrink-0" 
                        style={{ color: isActive ? item.color : undefined }}
                      />
                      
                      <AnimatePresence mode="wait">
                        {!sidebarCollapsed && (
                          <motion.span
                            {...slideIn}
                            transition={transition}
                            className="text-sm font-medium flex-1 truncate"
                          >
                            {item.label}
                          </motion.span>
                        )}
                      </AnimatePresence>

                      {/* Badge */}
                      {item.badge && !sidebarCollapsed && (
                        <span className={cn(
                          "px-1.5 py-0.5 text-[9px] font-bold uppercase rounded",
                          item.badge === "live" && "bg-emerald-500/20 text-emerald-400",
                          item.badge === "new" && "bg-blue-500/20 text-blue-400"
                        )}>
                          {item.badge}
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Collapse Button */}
        <div className="p-2 border-t hidden lg:block" style={{ borderColor: DESIGN.border.subtle }}>
          <button
            onClick={() => setSidebarCollapsed(prev => !prev)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-colors hover:bg-white/5"
            style={{ color: DESIGN.text.muted }}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main 
        className="flex-1 min-h-screen transition-all duration-200 lg:ml-0"
        style={{ marginLeft: typeof window !== "undefined" && window.innerWidth >= 1024 ? (sidebarCollapsed ? 72 : 260) : 0 }}
      >
        {/* Top Bar */}
        <header 
          className="sticky top-0 z-30 h-16 backdrop-blur-xl border-b flex items-center justify-between px-4 lg:px-6"
          style={{ 
            backgroundColor: `${DESIGN.bg.primary}cc`,
            borderColor: DESIGN.border.subtle,
          }}
        >
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-white/5"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors w-64 lg:w-80"
            style={{ 
              backgroundColor: DESIGN.bg.hover,
              borderColor: DESIGN.border.default,
              color: DESIGN.text.muted,
            }}
          >
            <Search className="w-4 h-4" />
            <span className="text-sm truncate">Search users, leads...</span>
            <kbd className="ml-auto px-2 py-0.5 text-[10px] bg-white/10 rounded hidden lg:inline">⌘K</kbd>
          </button>

          {/* Mobile Search Button */}
          <button
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-lg hover:bg-white/5"
          >
            <Search className="w-5 h-5" style={{ color: DESIGN.text.secondary }} />
          </button>

          {/* Right Side */}
          <div className="flex items-center gap-2 lg:gap-4">
            {/* Online Indicator */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs text-emerald-400 font-medium">
                {onlineCount} online
              </span>
            </div>

            {/* Notifications */}
            <NotificationBell onClick={() => setNotificationsOpen(true)} />

            {/* User Menu */}
            <div className="flex items-center gap-3 pl-2 lg:pl-4 border-l" style={{ borderColor: DESIGN.border.default }}>
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black"
                style={{ background: DESIGN.accent.gradient }}
              >
                AD
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Global Search Modal */}
      <GlobalSearch 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)} 
      />

      {/* Notifications Panel */}
      <AnimatePresence>
        {notificationsOpen && (
          <NotificationsPanel 
            isOpen={notificationsOpen}
            onClose={() => setNotificationsOpen(false)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default CommandCenterLayout;
