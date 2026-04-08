/**
 * ============================================================================
 * ARAS COMMAND CENTER - DEBUG OVERLAY
 * ============================================================================
 * Dev-only debug panel showing auth/API status
 * Only visible when localStorage.aras_debug = "1"
 * ============================================================================
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, Copy, Check, X, RefreshCw, User, Shield, Wifi, WifiOff, Activity, Server } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { apiGet } from '@/lib/api';

interface AuthUser {
  id?: string;
  username?: string;
  userRole?: string;
  user_role?: string;
}

interface ApiStatus {
  endpoint: string;
  status: number | null;
  error?: string;
  timestamp: Date;
}

interface HealthData {
  ok: boolean;
  env: string;
  hasSession: boolean;
  user: { id: string; username: string; role: string } | null;
  cookieSeen: boolean;
  host: string | null;
  origin: string | null;
  time: string;
}

export function DebugOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(true);
  const [copied, setCopied] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<ApiStatus[]>([]);
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const { user: rawUser } = useAuth();
  const user = rawUser as AuthUser | null;

  // Check if debug mode is enabled
  useEffect(() => {
    const checkDebugMode = () => {
      const debugEnabled = localStorage.getItem('aras_debug') === '1';
      setIsVisible(debugEnabled);
    };
    
    checkDebugMode();
    window.addEventListener('storage', checkDebugMode);
    
    // Also check on focus (in case localStorage was changed in another tab)
    window.addEventListener('focus', checkDebugMode);
    
    return () => {
      window.removeEventListener('storage', checkDebugMode);
      window.removeEventListener('focus', checkDebugMode);
    };
  }, []);

  // Track API calls (intercept fetch)
  useEffect(() => {
    if (!isVisible) return;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
      
      // Only track internal API calls
      if (url.includes('/api/internal/') || url.includes('/api/admin/')) {
        try {
          const response = await originalFetch(...args);
          setApiStatuses(prev => {
            const newStatus: ApiStatus = {
              endpoint: url.replace(/^.*\/api/, '/api'),
              status: response.status,
              timestamp: new Date(),
            };
            // Keep last 5 statuses
            return [newStatus, ...prev.slice(0, 4)];
          });
          return response;
        } catch (error: any) {
          setApiStatuses(prev => {
            const newStatus: ApiStatus = {
              endpoint: url.replace(/^.*\/api/, '/api'),
              status: null,
              error: error.message,
              timestamp: new Date(),
            };
            return [newStatus, ...prev.slice(0, 4)];
          });
          throw error;
        }
      }
      
      return originalFetch(...args);
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [isVisible]);

  const copyDiagnostics = () => {
    const diagnostics = {
      user: user ? {
        id: user.id,
        username: user.username,
        role: (user as any).userRole || (user as any).user_role || 'unknown',
      } : null,
      apiStatuses: apiStatuses.map(s => ({
        endpoint: s.endpoint,
        status: s.status,
        error: s.error,
        time: s.timestamp.toISOString(),
      })),
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };
    
    navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const refreshStatuses = () => {
    setApiStatuses([]);
  };

  const fetchHealth = async () => {
    setHealthLoading(true);
    try {
      const result = await apiGet<HealthData>('/api/internal/health');
      if (result.ok && result.data) {
        setHealthData(result.data);
      } else {
        setHealthData({ ok: false, env: 'unknown', hasSession: false, user: null, cookieSeen: false, host: null, origin: null, time: new Date().toISOString() });
      }
    } catch (e) {
      setHealthData({ ok: false, env: 'error', hasSession: false, user: null, cookieSeen: false, host: null, origin: null, time: new Date().toISOString() });
    }
    setHealthLoading(false);
  };

  // Fetch health on mount when visible
  useEffect(() => {
    if (isVisible && !isMinimized && !healthData) {
      fetchHealth();
    }
  }, [isVisible, isMinimized]);

  if (!isVisible) return null;

  const userRole = user ? ((user as any).userRole || (user as any).user_role || 'none') : 'not logged in';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        transition={{ duration: 0.16, ease: 'easeOut' }}
        className="fixed top-16 right-6 z-[9999] w-[340px]"
        style={{
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
        }}
      >
        <div 
          className="rounded-[20px] border border-white/[0.12] bg-black/80 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-2.5 border-b border-white/10 cursor-pointer"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <div className="flex items-center gap-2">
              <Bug className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-medium text-white/90">Debug Panel</span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={(e) => { e.stopPropagation(); copyDiagnostics(); }}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Copy diagnostics"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-white/60" />
                )}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); refreshStatuses(); }}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Clear statuses"
              >
                <RefreshCw className="w-3.5 h-3.5 text-white/60" />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); localStorage.removeItem('aras_debug'); setIsVisible(false); }}
                className="p-1 hover:bg-white/10 rounded transition-colors"
                title="Close debug mode"
              >
                <X className="w-3.5 h-3.5 text-white/60" />
              </button>
            </div>
          </div>

          {/* Content */}
          <AnimatePresence>
            {!isMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="overflow-hidden"
              >
                <div className="p-3 space-y-3">
                  {/* User Info */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-white/50 uppercase tracking-wide">
                      <User className="w-3 h-3" />
                      <span>User</span>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">ID</span>
                        <span className="text-white/90 font-mono">{user?.id || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Username</span>
                        <span className="text-white/90">{user?.username || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-white/60">Role</span>
                        <span className={`font-medium ${
                          userRole === 'admin' ? 'text-orange-400' :
                          userRole === 'staff' ? 'text-blue-400' :
                          userRole === 'user' ? 'text-green-400' :
                          'text-red-400'
                        }`}>
                          {userRole}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Health Check */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-white/50 uppercase tracking-wide">
                        <Server className="w-3 h-3" />
                        <span>Server Health</span>
                      </div>
                      <button
                        onClick={fetchHealth}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                        disabled={healthLoading}
                      >
                        <RefreshCw className={`w-3 h-3 text-white/60 ${healthLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 space-y-1">
                      {healthData ? (
                        <>
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Status</span>
                            <span className={healthData.ok ? 'text-green-400' : 'text-red-400'}>
                              {healthData.ok ? 'OK' : 'ERROR'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Env</span>
                            <span className="text-white/90">{healthData.env}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Session</span>
                            <span className={healthData.hasSession ? 'text-green-400' : 'text-red-400'}>
                              {healthData.hasSession ? 'Active' : 'None'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Cookie</span>
                            <span className={healthData.cookieSeen ? 'text-green-400' : 'text-yellow-400'}>
                              {healthData.cookieSeen ? 'Yes' : 'No'}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-white/60">Host</span>
                            <span className="text-white/70 font-mono text-[10px] truncate max-w-[140px]">
                              {healthData.host || 'N/A'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs text-white/40 italic">Click refresh to check</div>
                      )}
                    </div>
                  </div>

                  {/* API Statuses */}
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-[11px] text-white/50 uppercase tracking-wide">
                      <Activity className="w-3 h-3" />
                      <span>Recent API Calls</span>
                    </div>
                    <div className="space-y-1 max-h-[120px] overflow-y-auto">
                      {apiStatuses.length === 0 ? (
                        <div className="text-xs text-white/40 italic p-2">
                          No API calls tracked yet
                        </div>
                      ) : (
                        apiStatuses.map((status, i) => (
                          <div 
                            key={i}
                            className="bg-white/5 rounded-lg p-2 flex items-center justify-between gap-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              {status.status === null ? (
                                <WifiOff className="w-3 h-3 text-red-500 flex-shrink-0" />
                              ) : status.status < 300 ? (
                                <Wifi className="w-3 h-3 text-green-500 flex-shrink-0" />
                              ) : (
                                <Wifi className="w-3 h-3 text-red-500 flex-shrink-0" />
                              )}
                              <span className="text-[11px] text-white/80 truncate font-mono">
                                {status.endpoint.split('?')[0]}
                              </span>
                            </div>
                            <span className={`text-[11px] font-medium flex-shrink-0 ${
                              status.status === null ? 'text-red-400' :
                              status.status < 300 ? 'text-green-400' :
                              status.status < 500 ? 'text-yellow-400' :
                              'text-red-400'
                            }`}>
                              {status.status || 'ERR'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Help text */}
                  <div className="text-[10px] text-white/30 pt-1">
                    Disable: <code className="bg-white/10 px-1 rounded">localStorage.removeItem('aras_debug')</code>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
