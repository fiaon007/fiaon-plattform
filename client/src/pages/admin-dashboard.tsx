import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Users, Database, Calendar, Phone, MessageSquare, 
  Megaphone, Bug, TrendingUp, Search, Trash2, RefreshCw, 
  Shield, Clock, Key, CreditCard, RotateCcw, X, Check, Eye,
  Zap, Crown, Star, Sparkles, Mail, Building2, AlertCircle, Wifi, Loader2,
  UserCog, History, ShieldCheck, ChevronDown, LayoutGrid
} from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

// ═══════════════════════════════════════════════════════════════
// ARAS ADMIN DASHBOARD v3.3 - PORTAL MODAL + ALL PLANS (2024-12-29)
// ═══════════════════════════════════════════════════════════════

const DB_TABLES = [
  { id: 'users', name: 'Users', icon: Users, color: '#FE9100' },
  { id: 'leads', name: 'Leads', icon: TrendingUp, color: '#10B981' },
  { id: 'calendar_events', name: 'Calendar', icon: Calendar, color: '#F59E0B' },
  { id: 'contacts', name: 'Contacts', icon: Building2, color: '#8B5CF6' },
  { id: 'campaigns', name: 'Campaigns', icon: Megaphone, color: '#EC4899' },
  { id: 'chat_sessions', name: 'Chats', icon: MessageSquare, color: '#06B6D4' },
  { id: 'call_logs', name: 'Calls', icon: Phone, color: '#EF4444' },
  { id: 'voice_agents', name: 'Agents', icon: Zap, color: '#F97316' },
  { id: 'feedback', name: 'Feedback', icon: Bug, color: '#F43F5E' },
  { id: 'subscription_plans', name: 'Plans', icon: Crown, color: '#0EA5E9' },
  { id: 'sessions', name: 'Sessions', icon: Clock, color: '#78716C' }
];

// Plan options with keys that match the database
// These are the ONLY valid plan values - sent directly to API
const PLAN_OPTIONS: { key: string; label: string }[] = [
  { key: 'free', label: 'Free' },
  { key: 'pro', label: 'Pro' },
  { key: 'ultra', label: 'Ultra' },
  { key: 'ultimate', label: 'Ultimate' }
];
const STATUS_OPTIONS = ['active', 'trialing', 'canceled', 'past_due'] as const;

// Role options for RBAC
const ROLE_OPTIONS = [
  { key: 'user', label: 'User', color: '#6B7280', icon: Users },
  { key: 'staff', label: 'Staff', color: '#8B5CF6', icon: Shield },
  { key: 'admin', label: 'Admin', color: '#FE9100', icon: Crown },
] as const;

// Type for valid plan keys
type PlanKey = 'free' | 'pro' | 'ultra' | 'ultimate';
type RoleKey = 'user' | 'staff' | 'admin';

// ═══════════════════════════════════════════════════════════════
// UTILITY: Convert snake_case to camelCase for frontend compatibility
// ═══════════════════════════════════════════════════════════════
function snakeToCamel(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(snakeToCamel);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.keys(obj).reduce((acc, key) => {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      acc[camelKey] = snakeToCamel(obj[key]);
      return acc;
    }, {} as any);
  }
  return obj;
}

// ═══════════════════════════════════════════════════════════════
// UTILITY: Extract array from various API response formats
// ═══════════════════════════════════════════════════════════════
function extractArray(data: any): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.users && Array.isArray(data.users)) return data.users;
  if (data.data && Array.isArray(data.data)) return data.data;
  if (data.records && Array.isArray(data.records)) return data.records;
  // If it's an object with success flag, try to find the array
  if (typeof data === 'object') {
    const keys = Object.keys(data).filter(k => k !== 'success' && k !== 'message');
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

export default function AdminDashboard() {
  const [selectedTable, setSelectedTable] = useState(DB_TABLES[0]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal state - explicitly typed for clarity
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'plan' | 'password' | 'details' | 'role' | 'audit' | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Form state for modals
  const [formPlan, setFormPlan] = useState('free');
  const [formStatus, setFormStatus] = useState('active');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<RoleKey>('user');
  
  // Active tab for main view
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // ═══════════════════════════════════════════════════════════════
  // MODAL HANDLERS - Explicit and debuggable
  // ═══════════════════════════════════════════════════════════════
  const openModal = useCallback((type: 'plan' | 'password' | 'details' | 'role' | 'audit', user?: any) => {
    console.log('[AdminDashboard] Opening modal:', type, 'for user:', user?.username || user?.id);
    
    // Set user first
    setSelectedUser(user || null);
    
    // Set form defaults based on user data
    if (user) {
      setFormPlan(user?.subscriptionPlan || user?.subscription_plan || 'free');
      setFormStatus(user?.subscriptionStatus || user?.subscription_status || 'active');
      setFormRole((user?.userRole || user?.user_role || 'user').toLowerCase() as RoleKey);
    }
    setFormPassword('');
    
    // Set modal type and open
    setModalType(type);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    console.log('[AdminDashboard] Closing modal');
    setModalOpen(false);
    // Delay clearing data to allow animation
    setTimeout(() => {
      setModalType(null);
      setSelectedUser(null);
      setFormPassword('');
    }, 150);
  }, []);

  // Handle ESC key to close modal + scroll lock
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleEsc);
    
    // Scroll lock when modal is open
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [modalOpen, closeModal]);

  const getEndpoint = (tableId: string) => {
    const map: Record<string, string> = {
      'users': '/api/admin/users',
      'leads': '/api/admin/leads',
      'calendar_events': '/api/admin/calendar-events',
      'contacts': '/api/admin/contacts',
      'campaigns': '/api/admin/campaigns',
      'chat_sessions': '/api/admin/chat-sessions',
      'voice_agents': '/api/admin/voice-agents',
      'call_logs': '/api/admin/call-logs',
      'feedback': '/api/admin/feedback',
      'subscription_plans': '/api/admin/subscription-plans',
      'sessions': '/api/admin/sessions'
    };
    return map[tableId] || `/api/admin/${tableId}`;
  };

  // ═══════════════════════════════════════════════════════════════
  // DATA FETCHING - Robust handling of various response formats
  // ═══════════════════════════════════════════════════════════════

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats', { credentials: 'include' });
      if (!res.ok) return {};
      const data = await res.json();
      return data.stats || data;
    },
    refetchInterval: 30000
  });

  // Fetch online users
  const { data: onlineData } = useQuery({
    queryKey: ['admin-online'],
    queryFn: async () => {
      const res = await fetch('/api/admin/online-users', { credentials: 'include' });
      return res.ok ? res.json() : { onlineUserIds: [] };
    },
    refetchInterval: 10000
  });

  // Fetch table data with robust extraction and conversion
  const { data: tableData = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-table', selectedTable.id],
    queryFn: async () => {
      const res = await fetch(getEndpoint(selectedTable.id), { credentials: 'include' });
      if (!res.ok) {
        console.error('[AdminDashboard] Failed to fetch:', res.status);
        return [];
      }
      const rawData = await res.json();
      const arrayData = extractArray(rawData);
      const camelData = snakeToCamel(arrayData);
      console.log('[AdminDashboard] Fetched', camelData.length, 'records for', selectedTable.id);
      return camelData;
    }
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}`, { 
        method: 'DELETE', credentials: 'include' 
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Disable failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-table'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
      toast({ title: "✅ User deaktiviert", description: "Login gesperrt. Daten bleiben erhalten." });
    },
    onError: (error: any) => toast({ title: "❌ Fehler", description: error.message, variant: "destructive" })
  });

  const enableUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/enable`, {
        method: 'POST', credentials: 'include'
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || err.message || 'Enable failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-table'] });
      toast({ title: "✅ User reaktiviert" });
    },
    onError: (error: any) => toast({ title: "❌ Fehler", description: error.message, variant: "destructive" })
  });

  const changePlanMutation = useMutation({
    mutationFn: async ({ id, plan, status }: { id: string; plan: string; status: string }) => {
      console.log('[AdminDashboard] API Request - Changing plan:', { userId: id, plan, status });
      
      const res = await fetch(`/api/admin/users/${id}/change-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ plan, status })
      });
      
      const responseData = await res.json().catch(() => ({ error: 'Invalid response' }));
      console.log('[AdminDashboard] API Response:', { status: res.status, data: responseData });
      
      if (!res.ok) {
        throw new Error(responseData.error || `HTTP ${res.status}: Failed to change plan`);
      }
      
      // Verify the plan was actually changed
      if (responseData.user && responseData.user.subscription_plan !== plan) {
        console.warn('[AdminDashboard] Plan mismatch! Expected:', plan, 'Got:', responseData.user.subscription_plan);
      }
      
      return responseData;
    },
    onSuccess: (data) => {
      console.log('[AdminDashboard] Plan changed successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['admin-table'] });
      const savedPlan = data?.user?.subscription_plan || formPlan;
      toast({ title: "✅ Plan erfolgreich geändert!", description: `Neuer Plan: ${savedPlan.toUpperCase()}` });
      closeModal();
    },
    onError: (error: any) => {
      console.error('[AdminDashboard] Plan change FAILED:', error);
      toast({ 
        title: "❌ Plan konnte nicht geändert werden", 
        description: error.message || 'Unbekannter Fehler - siehe Console', 
        variant: "destructive" 
      });
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      console.log('[AdminDashboard] Changing password for', id);
      const res = await fetch(`/api/admin/users/${id}/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: password })
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      console.log('[AdminDashboard] Password changed successfully');
      toast({ title: "✅ Passwort erfolgreich geändert!" });
      closeModal();
    },
    onError: (error: any) => {
      console.error('[AdminDashboard] Password change error:', error);
      toast({ title: "❌ Fehler beim Passwort-Ändern", description: error.message, variant: "destructive" });
    }
  });

  const resetUsageMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/users/${id}/reset-usage`, {
        method: 'POST',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-table'] });
      toast({ title: "✅ Usage reset!" });
    },
    onError: () => toast({ title: "❌ Fehler", variant: "destructive" })
  });

  // ═══════════════════════════════════════════════════════════════
  // ROLE MANAGEMENT MUTATION
  // ═══════════════════════════════════════════════════════════════
  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: RoleKey }) => {
      console.log('[AdminDashboard] Changing role:', { userId: id, role });
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || `HTTP ${res.status}`);
      }
      return data;
    },
    onSuccess: (data) => {
      console.log('[AdminDashboard] Role changed successfully:', data);
      queryClient.invalidateQueries({ queryKey: ['admin-table'] });
      queryClient.invalidateQueries({ queryKey: ['admin-role-stats'] });
      toast({ 
        title: "✅ Rolle geändert!", 
        description: `${data.user?.username || 'User'} ist jetzt ${data.user?.role?.toUpperCase() || formRole.toUpperCase()}`
      });
      closeModal();
    },
    onError: (error: any) => {
      console.error('[AdminDashboard] Role change error:', error);
      toast({ 
        title: "❌ Rolle konnte nicht geändert werden", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Fetch role distribution stats
  const { data: roleStats } = useQuery({
    queryKey: ['admin-role-stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/roles/stats', { credentials: 'include' });
      return res.ok ? res.json() : { distribution: { admin: 0, staff: 0, user: 0 }, total: 0 };
    },
    refetchInterval: 30000
  });

  // Fetch audit log
  const { data: auditLog, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: async () => {
      const res = await fetch('/api/admin/audit?limit=50', { credentials: 'include' });
      return res.ok ? res.json() : { entries: [], pagination: {} };
    },
    enabled: activeTab === 'audit'
  });

  const isOnline = (id: string) => onlineData?.onlineUserIds?.includes(id);
  
  // Get role color helper
  const getRoleColor = (role: string) => {
    const r = ROLE_OPTIONS.find(o => o.key === role?.toLowerCase());
    return r?.color || '#6B7280';
  };
  
  const filteredData = Array.isArray(tableData) 
    ? tableData.filter((item: any) =>
        Object.values(item).some(v => String(v || '').toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#FE9100] flex items-center justify-center">
            <Shield className="w-5 h-5 text-black" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard v3.3</h1>
            <p className="text-sm text-white/40">Manage everything</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Founding Claims Button */}
          <button 
            onClick={() => navigate('/admin/founding-claims')}
            className="flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all duration-300"
            style={{
              background: 'rgba(233,215,196,0.08)',
              border: '1px solid rgba(233,215,196,0.2)',
              color: '#e9d7c4',
            }}
          >
            <Crown className="w-3.5 h-3.5" />
            <span>Founding Claims</span>
          </button>
          {/* Command Center Button - Premium Pill */}
          <button 
            onClick={() => navigate('/internal/dashboard')}
            className="group flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(254,145,0,0.15), rgba(163,78,0,0.15))',
              border: '1px solid rgba(254,145,0,0.3)',
              color: '#FE9100',
              fontFamily: 'Orbitron, sans-serif',
              boxShadow: '0 0 0 0 rgba(254,145,0,0)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 0 20px rgba(254,145,0,0.3)';
              e.currentTarget.style.borderColor = 'rgba(254,145,0,0.6)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 0 0 0 rgba(254,145,0,0)';
              e.currentTarget.style.borderColor = 'rgba(254,145,0,0.3)';
            }}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Command Center</span>
          </button>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm">
            {onlineData?.onlineUserIds?.length || 0} online
          </div>
          <button onClick={() => refetch()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Users', value: stats?.users || 0, color: '#FE9100' },
          { label: 'Online', value: onlineData?.onlineUserIds?.length || 0, color: '#10B981' },
          { label: 'Leads', value: stats?.leads || 0, color: '#8B5CF6' },
          { label: 'Calls', value: stats?.callLogs || 0, color: '#06B6D4' },
          { label: 'Messages', value: stats?.totalAiMessages || 0, color: '#EC4899' },
          { label: 'Feedback', value: stats?.feedback || 0, color: '#F43F5E' },
        ].map(s => (
          <div key={s.label} className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/40 mb-1">{s.label}</div>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Main Layout */}
      <div className="flex gap-4">
        {/* Sidebar */}
        <div className="w-48 flex-shrink-0">
          <div className="rounded-xl bg-white/5 p-3 space-y-1">
            {DB_TABLES.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTable(t)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                  selectedTable.id === t.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5'
                }`}
              >
                <t.icon className="w-4 h-4" style={{ color: selectedTable.id === t.id ? t.color : '' }} />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Search */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm"
              />
            </div>
            <span className="text-sm text-white/40">{filteredData.length} items</span>
          </div>

          {/* Table */}
          <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
            {isLoading ? (
              <div className="p-10 text-center text-white/40">Loading...</div>
            ) : selectedTable.id === 'users' ? (
              <div className="divide-y divide-white/10">
                {filteredData.map((user: any) => (
                  <div key={user.id} className="p-4 flex items-center gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center font-bold">
                        {(user.username?.[0] || '?').toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0b] ${
                        isOnline(user.id) ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{user.username}</span>
                        {/* Role Badge - clickable */}
                        <button
                          onClick={() => openModal('role', user)}
                          className="text-xs px-2 py-0.5 rounded flex items-center gap-1 hover:opacity-80 transition-opacity"
                          style={{ 
                            backgroundColor: `${getRoleColor(user.userRole || user.user_role)}20`,
                            color: getRoleColor(user.userRole || user.user_role)
                          }}
                        >
                          {(user.userRole || user.user_role || 'user').toUpperCase()}
                          <ChevronDown className="w-3 h-3" />
                        </button>
                        <span className="text-xs px-2 py-0.5 rounded bg-[#FE9100]/20 text-[#FE9100]">
                          {user.subscriptionPlan || 'free'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                          {user.subscriptionStatus || 'active'}
                        </span>
                        {isOnline(user.id) && (
                          <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 animate-pulse">
                            ● ONLINE
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/40">{user.email}</div>
                    </div>

                    {/* Stats */}
                    <div className="text-center px-4">
                      <div className="font-bold">{user.aiMessagesUsed || 0}</div>
                      <div className="text-[10px] text-white/30">AI</div>
                    </div>
                    <div className="text-center px-4">
                      <div className="font-bold">{user.voiceCallsUsed || 0}</div>
                      <div className="text-[10px] text-white/30">Calls</div>
                    </div>

                    {/* BUTTONS - SIMPLE ONCLICK */}
                    <div className="flex gap-1">
                      <button
                        className="p-2 rounded bg-white/10 hover:bg-white/20 text-white"
                        onClick={() => openModal('details', user)}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400"
                        onClick={() => openModal('plan', user)}
                      >
                        <CreditCard className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded bg-violet-500/20 hover:bg-violet-500/30 text-violet-400"
                        onClick={() => openModal('password', user)}
                      >
                        <Key className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
                        onClick={() => {
                          if (confirm('Reset usage?')) resetUsageMutation.mutate(user.id);
                        }}
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      {(user.subscriptionStatus || user.subscription_status) === 'disabled' ? (
                        <button
                          className="p-2 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400"
                          title="Re-enable user"
                          onClick={() => {
                            if (confirm('Re-enable this user? Login will be allowed again.')) enableUserMutation.mutate(user.id);
                          }}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          className="p-2 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400"
                          title="Disable user — blocks login, data stays preserved"
                          onClick={() => {
                            if (confirm('Disable this user? Login will be blocked immediately. Data stays preserved.')) deleteMutation.mutate(user.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs text-white/40">ID</th>
                    {filteredData[0] && Object.keys(filteredData[0]).filter(k => k !== 'id' && k !== 'password').slice(0, 4).map(k => (
                      <th key={k} className="text-left p-3 text-xs text-white/40">{k}</th>
                    ))}
                    <th className="text-right p-3 text-xs text-white/40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.map((item: any) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="p-3 text-xs text-white/50 font-mono">{String(item.id).slice(0, 8)}</td>
                      {Object.entries(item).filter(([k]) => k !== 'id' && k !== 'password').slice(0, 4).map(([k, v]) => (
                        <td key={k} className="p-3 text-sm text-white/70 max-w-[150px] truncate">
                          {v === null ? '-' : typeof v === 'object' ? 'JSON' : String(v).slice(0, 30)}
                        </td>
                      ))}
                      <td className="p-3 text-right">
                        <button
                          className="p-1.5 rounded bg-red-500/20 text-red-400"
                          onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(item.id); }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODALS v3.3 - PORTAL-BASED, ALWAYS CENTERED IN VIEWPORT */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      
      {modalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="bg-[#1a1a1c] rounded-2xl w-full max-w-lg border border-white/20 shadow-2xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ zIndex: 100000 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#1a1a1c]">
              <h2 className="text-lg font-bold flex items-center gap-2">
                {modalType === 'plan' ? (
                  <><CreditCard className="w-5 h-5 text-[#FE9100]" /> Plan ändern</>
                ) : modalType === 'password' ? (
                  <><Key className="w-5 h-5 text-violet-400" /> Passwort ändern</>
                ) : modalType === 'details' ? (
                  <><Eye className="w-5 h-5 text-white/60" /> User Details</>
                ) : modalType === 'role' ? (
                  <><UserCog className="w-5 h-5 text-[#FE9100]" /> Rolle ändern</>
                ) : (
                  <><AlertCircle className="w-5 h-5 text-red-500" /> Modal (type: {String(modalType)})</>
                )}
              </h2>
              <button 
                type="button"
                onClick={closeModal} 
                className="p-2 hover:bg-white/10 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* CONTENT */}
            <div className="p-4">
              {/* Case: No user selected */}
              {!selectedUser && (
                <div className="text-center py-8 text-white/40">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>Keine User-Daten</p>
                </div>
              )}

              {/* Case: User selected + Plan modal */}
              {selectedUser && modalType === 'plan' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-sm text-white/50">User</div>
                    <div className="text-lg font-bold">{selectedUser.username || selectedUser.email || '?'}</div>
                    <div className="text-xs text-white/40 font-mono">ID: {selectedUser.id}</div>
                    <div className="text-xs text-white/40 mt-1">Aktueller Plan: <span className="text-[#FE9100] font-medium">{selectedUser.subscriptionPlan || 'free'}</span></div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-white/50 mb-2">Plan auswählen</div>
                    <div className="grid grid-cols-2 gap-2">
                      {PLAN_OPTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            console.log('[Plan Button] Selected:', key);
                            setFormPlan(key);
                          }}
                          className={`p-3 rounded-xl text-center font-medium transition-all ${
                            formPlan === key 
                              ? 'bg-[#FE9100] text-black font-bold ring-2 ring-[#FE9100]/50' 
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-white/30 mt-2 text-center">
                      Gewählt: <span className="text-[#FE9100] font-mono">{formPlan}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-white/50 mb-2">Status</div>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setFormStatus(s)}
                          className={`p-2 rounded-xl text-center text-sm transition-all ${
                            formStatus === s 
                              ? 'bg-emerald-500 text-black font-bold' 
                              : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        console.log('[Save Button] Submitting:', { id: selectedUser.id, plan: formPlan, status: formStatus });
                        changePlanMutation.mutate({
                          id: selectedUser.id,
                          plan: formPlan,
                          status: formStatus
                        });
                      }}
                      disabled={changePlanMutation.isPending}
                      className="flex-1 py-3 rounded-xl bg-[#FE9100] text-black font-bold hover:bg-[#ff8000] disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {changePlanMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</>
                      ) : (
                        <><Check className="w-4 h-4" /> Speichern</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Case: User selected + Password modal */}
              {selectedUser && modalType === 'password' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-sm text-white/50">User</div>
                    <div className="text-lg font-bold">{selectedUser.username || selectedUser.email || '?'}</div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-white/50 mb-2">Neues Passwort</div>
                    <input
                      type="password"
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      placeholder="Min. 6 Zeichen"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-lg"
                      autoFocus
                    />
                    {formPassword.length > 0 && formPassword.length < 6 && (
                      <p className="text-red-400 text-xs mt-1">Mindestens 6 Zeichen</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (formPassword.length >= 6) {
                          changePasswordMutation.mutate({
                            id: selectedUser.id,
                            password: formPassword
                          });
                        }
                      }}
                      disabled={changePasswordMutation.isPending || formPassword.length < 6}
                      className="flex-1 py-3 rounded-xl bg-violet-500 text-white font-bold hover:bg-violet-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {changePasswordMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</>
                      ) : (
                        <><Check className="w-4 h-4" /> Speichern</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Case: User selected + Details modal */}
              {selectedUser && modalType === 'details' && (
                <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                  {Object.entries(selectedUser)
                    .filter(([k]) => k !== 'password')
                    .map(([k, v]) => (
                      <div key={k} className="flex gap-2 p-2 rounded-lg bg-white/5">
                        <div className="w-32 text-xs text-white/40 flex-shrink-0 font-mono">{k}</div>
                        <div className="text-sm break-all flex-1">
                          {v === null ? <span className="text-white/30">null</span> : 
                           typeof v === 'object' ? <pre className="text-xs">{JSON.stringify(v, null, 2)}</pre> : 
                           String(v)}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* Case: User selected + Role modal */}
              {selectedUser && modalType === 'role' && (
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-white/5">
                    <div className="text-sm text-white/50">User</div>
                    <div className="text-lg font-bold">{selectedUser.username || selectedUser.email || '?'}</div>
                    <div className="text-xs text-white/40 font-mono">ID: {selectedUser.id}</div>
                    <div className="text-xs text-white/40 mt-1">
                      Aktuelle Rolle: <span style={{ color: getRoleColor(selectedUser.userRole || selectedUser.user_role) }} className="font-medium">
                        {(selectedUser.userRole || selectedUser.user_role || 'user').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-sm text-white/50 mb-2">Neue Rolle auswählen</div>
                    <div className="grid grid-cols-3 gap-2">
                      {ROLE_OPTIONS.map(({ key, label, color, icon: Icon }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setFormRole(key as RoleKey)}
                          className={`p-4 rounded-xl text-center transition-all flex flex-col items-center gap-2 ${
                            formRole === key 
                              ? 'ring-2 font-bold' 
                              : 'bg-white/10 hover:bg-white/20'
                          }`}
                          style={{ 
                            backgroundColor: formRole === key ? `${color}20` : undefined,
                            color: formRole === key ? color : 'white',
                            boxShadow: formRole === key ? `0 0 0 2px ${color}` : undefined
                          }}
                        >
                          <Icon className="w-5 h-5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Warning for admin demotion */}
                  {(selectedUser.userRole || selectedUser.user_role)?.toLowerCase() === 'admin' && formRole !== 'admin' && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 inline mr-2" />
                      <strong>Achtung:</strong> Du bist dabei, einen Admin herabzustufen. 
                      Das System verhindert, dass der letzte Admin entfernt wird.
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20"
                    >
                      Abbrechen
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        changeRoleMutation.mutate({
                          id: selectedUser.id,
                          role: formRole
                        });
                      }}
                      disabled={changeRoleMutation.isPending || formRole === (selectedUser.userRole || selectedUser.user_role || 'user').toLowerCase()}
                      className="flex-1 py-3 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                      style={{ 
                        backgroundColor: getRoleColor(formRole),
                        color: formRole === 'admin' ? 'black' : 'white'
                      }}
                    >
                      {changeRoleMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Speichere...</>
                      ) : (
                        <><UserCog className="w-4 h-4" /> Rolle ändern</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Case: Unknown modalType */}
              {selectedUser && modalType !== 'plan' && modalType !== 'password' && modalType !== 'details' && modalType !== 'role' && (
                <div className="text-center py-8 text-red-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>Unbekannter Modal-Typ: {String(modalType)}</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
