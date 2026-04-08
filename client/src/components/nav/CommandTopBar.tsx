/**
 * ============================================================================
 * ARAS COMMAND TOP BAR
 * ============================================================================
 * Premium top navigation bar with:
 * - Logo block (ARAS COMMAND + CONTROL CENTER)
 * - Command Search (⌘K)
 * - Quick Actions (Create buttons)
 * - Notifications + Profile
 * Premium ARAS 2026 Design - Glass, Gold, Orange glow
 * ============================================================================
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Command,
  Plus,
  User,
  Building2,
  TrendingUp,
  CheckSquare,
  Phone,
  FileText,
  Bell,
  ChevronDown,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface QuickAction {
  label: string;
  icon: any;
  action: () => void;
  color?: string;
}

export function CommandTopBar() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const quickActions: QuickAction[] = [
    { label: 'New Contact', icon: User, action: () => setLocation('/internal/contacts?action=create') },
    { label: 'New Company', icon: Building2, action: () => setLocation('/internal/companies?action=create') },
    { label: 'New Deal', icon: TrendingUp, action: () => setLocation('/internal/deals?action=create') },
    { label: 'New Task', icon: CheckSquare, action: () => setLocation('/internal/tasks?action=create') },
    { label: 'New Call Log', icon: Phone, action: () => setLocation('/internal/calls?action=create') },
    { label: 'New Contract', icon: FileText, action: () => setLocation('/internal/contracts?action=create') },
  ];

  const openCommandPalette = () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, ctrlKey: true }));
  };

  return (
    <header 
      className="fixed top-0 left-0 right-0 z-[60] h-16"
      style={{
        background: 'rgba(10,10,12,0.72)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: '1px solid rgba(233,215,196,0.10)',
      }}
    >
      {/* Aura line at bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[1px]"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(254,145,0,0.25), rgba(233,215,196,0.18), transparent)',
        }}
      />

      {/* Ambient glow */}
      <div 
        className="absolute -top-10 left-1/2 -translate-x-1/2 w-[600px] h-[150px] pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse, rgba(254,145,0,0.08) 0%, transparent 70%)',
        }}
      />

      <div className="h-full px-4 md:px-6 flex items-center justify-between max-w-[1800px] mx-auto">
        {/* LEFT: Logo Block */}
        <div className="flex items-center gap-4">
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            {/* LED indicator */}
            <div 
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{
                background: '#FE9100',
                boxShadow: '0 0 12px rgba(254,145,0,0.6), 0 0 24px rgba(254,145,0,0.3)',
              }}
            />
            
            <div>
              <h1 
                className="text-sm font-bold tracking-[0.18em] uppercase leading-tight"
                style={{ 
                  fontFamily: 'Orbitron, sans-serif',
                  background: 'linear-gradient(135deg, #e9d7c4, #FE9100, #a34e00)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ARAS COMMAND
              </h1>
              <p 
                className="text-[10px] tracking-[0.22em] uppercase"
                style={{ color: 'rgba(245,245,247,0.45)' }}
              >
                Control Center
              </p>
            </div>
          </motion.div>

          {/* Divider */}
          <div className="hidden lg:block w-px h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          {/* Back to App link */}
          <motion.a
            href="/app"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
            style={{
              color: 'rgba(245,245,247,0.5)',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
            whileHover={{
              color: 'rgba(245,245,247,0.8)',
              borderColor: 'rgba(254,145,0,0.2)',
            }}
          >
            <ExternalLink className="w-3 h-3" />
            <span>Back to App</span>
          </motion.a>
        </div>

        {/* CENTER: Command Search */}
        <motion.button
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={openCommandPalette}
          className="hidden md:flex items-center gap-3 px-4 py-2 rounded-full cursor-pointer transition-all group"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(233,215,196,0.12)',
            minWidth: '280px',
          }}
          whileHover={{
            borderColor: 'rgba(254,145,0,0.22)',
            background: 'rgba(255,255,255,0.04)',
          }}
        >
          <Search className="w-4 h-4" style={{ color: 'rgba(245,245,247,0.4)' }} />
          <span 
            className="flex-1 text-left text-sm"
            style={{ color: 'rgba(245,245,247,0.4)' }}
          >
            Search anything...
          </span>
          <kbd 
            className="px-2 py-0.5 rounded text-[10px] font-medium"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(245,245,247,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            ⌘K
          </kbd>
        </motion.button>

        {/* RIGHT: Quick Actions + Notifications + Profile */}
        <div className="flex items-center gap-2">
          {/* Quick Actions Dropdown */}
          <div className="relative">
            <motion.button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{
                background: showQuickActions ? 'rgba(254,145,0,0.1)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${showQuickActions ? 'rgba(254,145,0,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
              whileHover={{
                borderColor: 'rgba(254,145,0,0.25)',
                background: 'rgba(254,145,0,0.08)',
              }}
              whileTap={{ scale: 0.98 }}
            >
              <Plus className="w-4 h-4" style={{ color: '#FE9100' }} />
              <span 
                className="hidden sm:inline text-xs font-medium"
                style={{ color: 'rgba(245,245,247,0.85)' }}
              >
                Create
              </span>
              <ChevronDown 
                className={`w-3 h-3 transition-transform ${showQuickActions ? 'rotate-180' : ''}`}
                style={{ color: 'rgba(245,245,247,0.5)' }}
              />
            </motion.button>

            {/* Dropdown */}
            <AnimatePresence>
              {showQuickActions && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-40"
                    onClick={() => setShowQuickActions(false)}
                  />
                  
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 z-50 min-w-[200px] py-2 rounded-xl overflow-hidden"
                    style={{
                      background: 'rgba(15,15,17,0.95)',
                      border: '1px solid rgba(233,215,196,0.12)',
                      boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 1px rgba(233,215,196,0.1) inset',
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    {quickActions.map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <motion.button
                          key={action.label}
                          onClick={() => {
                            action.action();
                            setShowQuickActions(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 transition-all"
                          style={{ color: 'rgba(245,245,247,0.8)' }}
                          whileHover={{
                            background: 'rgba(254,145,0,0.08)',
                            color: 'rgba(245,245,247,0.95)',
                          }}
                        >
                          <Icon className="w-4 h-4" style={{ color: '#FE9100' }} />
                          <span className="text-sm">{action.label}</span>
                        </motion.button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Notifications */}
          <motion.button
            className="relative p-2 rounded-xl transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            whileHover={{
              borderColor: 'rgba(254,145,0,0.2)',
              background: 'rgba(255,255,255,0.05)',
            }}
            whileTap={{ scale: 0.95 }}
          >
            <Bell className="w-4 h-4" style={{ color: 'rgba(245,245,247,0.6)' }} />
            {/* Notification dot */}
            <span 
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{
                background: '#FE9100',
                boxShadow: '0 0 8px rgba(254,145,0,0.6)',
              }}
            />
          </motion.button>

          {/* User Profile */}
          <motion.div 
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl cursor-pointer transition-all"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            whileHover={{
              borderColor: 'rgba(254,145,0,0.2)',
              background: 'rgba(255,255,255,0.05)',
            }}
          >
            <div 
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs"
              style={{ 
                background: 'linear-gradient(135deg, #FE9100, #a34e00)',
                boxShadow: '0 2px 8px rgba(254,145,0,0.3)',
              }}
            >
              {(user as any)?.username?.charAt(0).toUpperCase() || 'A'}
            </div>
            <span 
              className="hidden md:block text-xs font-medium max-w-[100px] truncate"
              style={{ color: 'rgba(245,245,247,0.85)' }}
            >
              {(user as any)?.username || 'Admin'}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Orbitron Font */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" 
        rel="stylesheet" 
      />
    </header>
  );
}
