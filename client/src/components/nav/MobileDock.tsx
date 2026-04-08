/**
 * ============================================================================
 * ARAS MOBILE DOCK
 * ============================================================================
 * Bottom navigation dock for mobile devices
 * - 5 primary items + "More" sheet
 * Premium ARAS 2026 Design - Glass, Gold, Orange glow
 * ============================================================================
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  CheckSquare, 
  MoreHorizontal,
  Building2,
  Phone,
  FileText,
  Settings,
  X,
  LogOut,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface DockItem {
  path: string;
  label: string;
  icon: any;
  primary?: boolean;
}

const PRIMARY_ITEMS: DockItem[] = [
  { path: "/internal/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { path: "/internal/contacts", label: "Contacts", icon: Users, primary: true },
  { path: "/internal/deals", label: "Deals", icon: TrendingUp, primary: true },
  { path: "/internal/tasks", label: "Tasks", icon: CheckSquare, primary: true },
];

const SECONDARY_ITEMS: DockItem[] = [
  { path: "/internal/companies", label: "Companies", icon: Building2 },
  { path: "/internal/calls", label: "Call Logs", icon: Phone },
  { path: "/internal/contracts", label: "Contracts", icon: FileText },
  { path: "/internal/settings", label: "Settings", icon: Settings },
];

export function MobileDock() {
  const [location, setLocation] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const { user } = useAuth();
  
  const userRole = (user as any)?.userRole || (user as any)?.user_role || 'staff';

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/auth';
    } catch (error) {
      console.error('Logout failed:', error);
      window.location.href = '/auth';
    }
  };

  return (
    <>
      {/* Bottom Dock - Mobile Only */}
      <nav 
        className="fixed bottom-0 left-0 right-0 z-[70] md:hidden"
        style={{
          background: 'rgba(10,10,12,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(233,215,196,0.10)',
        }}
      >
        {/* Top glow line */}
        <div 
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.2), transparent)',
          }}
        />

        <div className="flex items-center justify-around px-2 py-2 safe-area-pb">
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || location.startsWith(item.path + '/');
            
            return (
              <motion.button
                key={item.path}
                onClick={() => setLocation(item.path)}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[60px] transition-all"
                style={{
                  background: isActive ? 'rgba(254,145,0,0.1)' : 'transparent',
                }}
                whileTap={{ scale: 0.95 }}
              >
                <div className="relative">
                  <Icon 
                    className="w-5 h-5 transition-colors"
                    style={{ color: isActive ? '#FE9100' : 'rgba(245,245,247,0.5)' }}
                  />
                  {isActive && (
                    <motion.div
                      layoutId="mobile-nav-indicator"
                      className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                      style={{
                        background: '#FE9100',
                        boxShadow: '0 0 8px rgba(254,145,0,0.6)',
                      }}
                    />
                  )}
                </div>
                <span 
                  className="text-[10px] font-medium"
                  style={{ 
                    color: isActive ? '#FE9100' : 'rgba(245,245,247,0.5)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}

          {/* More Button */}
          <motion.button
            onClick={() => setShowMore(true)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl min-w-[60px] transition-all"
            whileTap={{ scale: 0.95 }}
          >
            <MoreHorizontal 
              className="w-5 h-5"
              style={{ color: 'rgba(245,245,247,0.5)' }}
            />
            <span 
              className="text-[10px] font-medium"
              style={{ color: 'rgba(245,245,247,0.5)' }}
            >
              More
            </span>
          </motion.button>
        </div>
      </nav>

      {/* More Sheet */}
      <AnimatePresence>
        {showMore && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[80] md:hidden"
              style={{ background: 'rgba(0,0,0,0.6)' }}
              onClick={() => setShowMore(false)}
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[90] md:hidden rounded-t-3xl overflow-hidden"
              style={{
                background: 'rgba(15,15,17,0.98)',
                border: '1px solid rgba(233,215,196,0.12)',
                borderBottom: 'none',
                maxHeight: '70vh',
              }}
            >
              {/* Handle */}
              <div className="flex justify-center py-3">
                <div 
                  className="w-10 h-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.2)' }}
                />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4 border-b" style={{ borderColor: 'rgba(233,215,196,0.08)' }}>
                <h3 
                  className="text-base font-bold"
                  style={{ 
                    fontFamily: 'Orbitron, sans-serif',
                    color: 'rgba(245,245,247,0.9)',
                  }}
                >
                  More Options
                </h3>
                <motion.button
                  onClick={() => setShowMore(false)}
                  className="p-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.05)' }}
                  whileTap={{ scale: 0.95 }}
                >
                  <X className="w-4 h-4" style={{ color: 'rgba(245,245,247,0.6)' }} />
                </motion.button>
              </div>

              {/* Menu Items */}
              <div className="p-4 space-y-1">
                {SECONDARY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.path || location.startsWith(item.path + '/');
                  
                  // Hide settings for non-admin
                  if (item.path === '/internal/settings' && userRole !== 'admin') {
                    return null;
                  }
                  
                  return (
                    <motion.button
                      key={item.path}
                      onClick={() => {
                        setLocation(item.path);
                        setShowMore(false);
                      }}
                      className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all"
                      style={{
                        background: isActive ? 'rgba(254,145,0,0.1)' : 'transparent',
                        border: isActive ? '1px solid rgba(254,145,0,0.2)' : '1px solid transparent',
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Icon 
                        className="w-5 h-5"
                        style={{ color: isActive ? '#FE9100' : 'rgba(245,245,247,0.6)' }}
                      />
                      <span 
                        className="text-sm font-medium"
                        style={{ color: isActive ? '#FE9100' : 'rgba(245,245,247,0.8)' }}
                      >
                        {item.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {/* User Section */}
              <div className="px-4 pt-2 pb-4 border-t" style={{ borderColor: 'rgba(233,215,196,0.08)' }}>
                <div 
                  className="flex items-center gap-3 p-3 rounded-xl mb-3"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold"
                    style={{ 
                      background: 'linear-gradient(135deg, #FE9100, #a34e00)',
                      boxShadow: '0 4px 12px rgba(254,145,0,0.3)',
                    }}
                  >
                    {(user as any)?.username?.charAt(0).toUpperCase() || 'A'}
                  </div>
                  <div className="flex-1">
                    <p 
                      className="text-sm font-medium"
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
                  </div>
                </div>

                {/* Logout */}
                <motion.button
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl"
                  style={{
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.2)',
                  }}
                  whileTap={{ scale: 0.98 }}
                >
                  <LogOut className="w-4 h-4" style={{ color: '#ef4444' }} />
                  <span className="text-sm font-medium" style={{ color: '#ef4444' }}>
                    Logout
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
