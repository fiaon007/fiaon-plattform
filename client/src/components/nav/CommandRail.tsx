/**
 * ============================================================================
 * ARAS COMMAND RAIL
 * ============================================================================
 * Floating icon rail navigation - Modern Linear/Tesla style
 * - 72px collapsed, 240px expanded on hover (desktop only)
 * - Inset position with rounded glass container
 * - Premium ARAS 2026 Design
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  TrendingUp, 
  CheckSquare, 
  Phone,
  Settings,
  LogOut,
  Shield,
  FileText,
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react";
import { NavItem } from "./NavItem";
import { useAuth } from "@/hooks/useAuth";

interface NavItemConfig {
  path: string;
  label: string;
  icon: any;
  enabled: boolean;
  section?: 'core' | 'crm' | 'ops' | 'admin';
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  // Core
  { path: "/internal/dashboard", label: "Dashboard", icon: LayoutDashboard, enabled: true, section: 'core' },
  { path: "/internal/mails", label: "Mails", icon: Mail, enabled: true, section: 'core' },
  
  // CRM
  { path: "/internal/contacts", label: "Contacts", icon: Users, enabled: true, section: 'crm' },
  { path: "/internal/companies", label: "Companies", icon: Building2, enabled: true, section: 'crm' },
  { path: "/internal/deals", label: "Deals & Pipeline", icon: TrendingUp, enabled: true, section: 'crm' },
  
  // Ops
  { path: "/internal/tasks", label: "Tasks", icon: CheckSquare, enabled: true, section: 'ops' },
  { path: "/internal/calls", label: "Call Logs", icon: Phone, enabled: true, section: 'ops' },
  { path: "/internal/contracts", label: "Contracts", icon: FileText, enabled: true, section: 'ops' },
  
  // Admin
  { path: "/internal/settings", label: "Settings", icon: Settings, enabled: true, section: 'admin', adminOnly: true },
];

export function CommandRail() {
  const [location, setLocation] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const { user } = useAuth();
  
  const userRole = (user as any)?.userRole || (user as any)?.user_role || 'staff';
  const isAdmin = userRole === 'admin';

  // Filter items based on role
  const visibleItems = NAV_ITEMS.filter(item => {
    if (!item.enabled) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  });

  // Group items by section
  const sections = {
    core: visibleItems.filter(i => i.section === 'core'),
    crm: visibleItems.filter(i => i.section === 'crm'),
    ops: visibleItems.filter(i => i.section === 'ops'),
    admin: visibleItems.filter(i => i.section === 'admin'),
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/auth';
    }
  };

  const isCollapsed = !isExpanded && !isPinned;

  return (
    <motion.aside
      className="fixed z-50 hidden md:flex flex-col"
      style={{
        top: '80px',
        left: '16px',
        bottom: '16px',
      }}
      initial={{ width: 72 }}
      animate={{ width: isExpanded || isPinned ? 240 : 72 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={() => !isPinned && setIsExpanded(true)}
      onMouseLeave={() => !isPinned && setIsExpanded(false)}
    >
      {/* Glass Container */}
      <div 
        className="relative flex-1 flex flex-col rounded-[28px] overflow-hidden"
        style={{
          background: 'rgba(12,12,14,0.72)',
          border: '1px solid rgba(233,215,196,0.10)',
          boxShadow: '0 30px 120px rgba(0,0,0,0.70), 0 0 1px rgba(233,215,196,0.1) inset',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {/* Subtle top highlight */}
        <div 
          className="absolute top-0 left-4 right-4 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(233,215,196,0.15), transparent)',
          }}
        />

        {/* Pin/Expand Toggle */}
        <div className="p-3 flex justify-end">
          <motion.button
            onClick={() => setIsPinned(!isPinned)}
            className="p-1.5 rounded-lg transition-all"
            style={{
              background: isPinned ? 'rgba(254,145,0,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isPinned ? 'rgba(254,145,0,0.3)' : 'rgba(255,255,255,0.06)'}`,
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? (
              <ChevronLeft className="w-3.5 h-3.5" style={{ color: '#FE9100' }} />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.5)' }} />
            )}
          </motion.button>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 px-2.5 pb-3 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* Core Section */}
          {sections.core.length > 0 && (
            <div className="mb-2">
              {sections.core.map((item, index) => (
                <NavItem
                  key={item.path}
                  icon={item.icon}
                  label={item.label}
                  path={item.path}
                  isActive={location === item.path || location.startsWith(item.path + '/')}
                  isCollapsed={isCollapsed}
                  onClick={() => setLocation(item.path)}
                  disabled={!item.enabled}
                />
              ))}
            </div>
          )}

          {/* CRM Section */}
          {sections.crm.length > 0 && (
            <>
              <div 
                className="mx-2 my-3 h-[1px]"
                style={{ background: 'rgba(233,215,196,0.08)' }}
              />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2"
                  >
                    <span 
                      className="text-[9px] font-semibold tracking-[0.15em] uppercase"
                      style={{ color: 'rgba(233,215,196,0.4)' }}
                    >
                      CRM
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {sections.crm.map((item) => (
                  <NavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    isActive={location === item.path || location.startsWith(item.path + '/')}
                    isCollapsed={isCollapsed}
                    onClick={() => setLocation(item.path)}
                    disabled={!item.enabled}
                  />
                ))}
              </div>
            </>
          )}

          {/* Ops Section */}
          {sections.ops.length > 0 && (
            <>
              <div 
                className="mx-2 my-3 h-[1px]"
                style={{ background: 'rgba(233,215,196,0.08)' }}
              />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2"
                  >
                    <span 
                      className="text-[9px] font-semibold tracking-[0.15em] uppercase"
                      style={{ color: 'rgba(233,215,196,0.4)' }}
                    >
                      Operations
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {sections.ops.map((item) => (
                  <NavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    isActive={location === item.path || location.startsWith(item.path + '/')}
                    isCollapsed={isCollapsed}
                    onClick={() => setLocation(item.path)}
                    disabled={!item.enabled}
                  />
                ))}
              </div>
            </>
          )}

          {/* Admin Section */}
          {sections.admin.length > 0 && (
            <>
              <div 
                className="mx-2 my-3 h-[1px]"
                style={{ background: 'rgba(233,215,196,0.08)' }}
              />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="px-3 mb-2"
                  >
                    <span 
                      className="text-[9px] font-semibold tracking-[0.15em] uppercase"
                      style={{ color: 'rgba(233,215,196,0.4)' }}
                    >
                      Admin
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="space-y-0.5">
                {sections.admin.map((item) => (
                  <NavItem
                    key={item.path}
                    icon={item.icon}
                    label={item.label}
                    path={item.path}
                    isActive={location === item.path || location.startsWith(item.path + '/')}
                    isCollapsed={isCollapsed}
                    onClick={() => setLocation(item.path)}
                    disabled={!item.enabled}
                  />
                ))}
              </div>
            </>
          )}
        </nav>

        {/* Bottom: User Profile Capsule */}
        <div 
          className="p-2.5 border-t"
          style={{ borderColor: 'rgba(233,215,196,0.08)' }}
        >
          <motion.div 
            className={`flex items-center gap-3 p-2 rounded-2xl transition-all cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}
            style={{ background: 'rgba(255,255,255,0.03)' }}
            whileHover={{ background: 'rgba(255,255,255,0.05)' }}
          >
            {/* Avatar */}
            <div 
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
              style={{ 
                background: 'linear-gradient(135deg, #FE9100, #a34e00)',
                boxShadow: '0 4px 12px rgba(254,145,0,0.3)',
              }}
            >
              {(user as any)?.username?.charAt(0).toUpperCase() || 'A'}
            </div>

            {/* User Info (expanded only) */}
            <AnimatePresence>
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="flex-1 min-w-0 overflow-hidden"
                >
                  <p 
                    className="text-sm font-medium truncate"
                    style={{ color: 'rgba(245,245,247,0.9)' }}
                  >
                    {(user as any)?.username || 'Admin'}
                  </p>
                  <div className="flex items-center gap-1">
                    <Shield className="w-3 h-3" style={{ color: '#FE9100' }} />
                    <span 
                      className="text-[10px] font-semibold tracking-wide uppercase"
                      style={{ color: '#FE9100' }}
                    >
                      {userRole}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Logout Button */}
          <motion.button
            onClick={handleLogout}
            className={`w-full mt-2 flex items-center gap-2 p-2 rounded-xl transition-all ${isCollapsed ? 'justify-center' : ''}`}
            style={{
              background: 'rgba(239,68,68,0.06)',
              border: '1px solid rgba(239,68,68,0.15)',
            }}
            whileHover={{
              background: 'rgba(239,68,68,0.1)',
              borderColor: 'rgba(239,68,68,0.25)',
            }}
            whileTap={{ scale: 0.98 }}
          >
            <LogOut className="w-4 h-4" style={{ color: '#ef4444' }} />
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="text-xs font-medium"
                  style={{ color: '#ef4444' }}
                >
                  Logout
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>

      {/* Orbitron Font */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" 
        rel="stylesheet" 
      />
    </motion.aside>
  );
}
