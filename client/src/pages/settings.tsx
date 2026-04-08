import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { 
  probeCapabilities, 
  isCapabilityAvailable,
  getAvailableSections,
  SETTINGS_SECTIONS,
  type SettingsSection,
} from '@/lib/capabilities/settingsCapabilities';
import type { SubscriptionResponse } from '@shared/schema';
import { 
  User, Shield, Database, Activity, Trash2, Key, ChevronRight, 
  CheckCircle, AlertCircle, Loader2, RefreshCw, ExternalLink,
  Zap, Clock, MessageSquare, Phone, FileText, Eye
} from 'lucide-react';

// ARAS CI Colors
const CI = {
  orange: '#FE9100',
  goldLight: '#E9D7C4',
  goldDark: '#A34E00',
};

// Icon map for sections
const SECTION_ICONS: Record<string, React.ElementType> = {
  User, Shield, Database, Activity,
};

// Error Boundary Fallback
function SettingsErrorFallback({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
      <AlertCircle className="w-16 h-16 mb-4" style={{ color: CI.orange }} />
      <h2 className="text-xl font-bold mb-2 font-['Orbitron']" style={{ color: CI.goldLight }}>
        Einstellungen konnten nicht geladen werden
      </h2>
      <p className="text-sm mb-6 text-center" style={{ color: `${CI.goldLight}80` }}>
        Bitte versuche es erneut oder kontaktiere den Support.
      </p>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all hover:scale-105"
        style={{
          background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
          color: '#000',
        }}
      >
        <RefreshCw className="w-4 h-4" />
        Neu laden
      </button>
    </div>
  );
}

// Loading Skeleton
function SettingsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-10 w-56 rounded-lg bg-white/5" />
          <div className="h-4 w-80 rounded bg-white/5 mt-3" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-full bg-white/5" />
          <div className="h-8 w-32 rounded-full bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-8">
        <div className="space-y-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-14 rounded-xl bg-white/5" />
          ))}
        </div>
        <div className="lg:col-span-3 space-y-4">
          <div className="h-40 rounded-2xl bg-white/5" />
          <div className="h-56 rounded-2xl bg-white/5" />
        </div>
      </div>
    </div>
  );
}

// Glass Panel Component
function GlassPanel({ 
  children, 
  className = '',
  hover = true,
  danger = false,
}: { 
  children: React.ReactNode; 
  className?: string;
  hover?: boolean;
  danger?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      whileHover={hover ? { scale: 1.002, boxShadow: `0 0 30px ${danger ? 'rgba(239,68,68,0.15)' : `${CI.orange}15`}` } : undefined}
      className={`p-6 rounded-2xl transition-all ${className}`}
      style={{
        background: 'rgba(0,0,0,0.55)',
        border: `1px solid ${danger ? 'rgba(239,68,68,0.3)' : `${CI.orange}20`}`,
        backdropFilter: 'blur(20px)',
      }}
    >
      {children}
    </motion.div>
  );
}

// Section Navigation Item
function NavItem({ 
  section,
  active, 
  onClick 
}: { 
  section: SettingsSection;
  active: boolean; 
  onClick: () => void;
}) {
  const Icon = SECTION_ICONS[section.icon] || User;
  
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all group"
      style={{
        background: active ? `${CI.orange}15` : 'transparent',
        borderLeft: active ? `3px solid ${CI.orange}` : '3px solid transparent',
      }}
    >
      <Icon 
        className="w-5 h-5 flex-shrink-0 transition-colors" 
        style={{ color: active ? CI.orange : `${CI.goldLight}80` }}
      />
      <div className="flex-1 min-w-0">
        <span 
          className="block font-medium text-sm truncate"
          style={{ color: active ? CI.orange : CI.goldLight }}
        >
          {section.label}
        </span>
        <span 
          className="block text-xs truncate"
          style={{ color: `${CI.goldLight}50` }}
        >
          {section.description}
        </span>
      </div>
      {active && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: CI.orange }} />}
    </button>
  );
}

// Input Field
function InputField({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  disabled = false,
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  disabled?: boolean;
  helper?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold mb-2" style={{ color: CI.goldLight }}>
        {label} {required && <span style={{ color: CI.orange }}>*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-4 py-3 rounded-xl text-white text-sm focus:outline-none focus:ring-2 transition-all disabled:opacity-50"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid ${CI.orange}20`,
        }}
      />
      {helper && (
        <p className="text-xs mt-1.5" style={{ color: `${CI.goldLight}60` }}>{helper}</p>
      )}
    </div>
  );
}

// Stat Card
function StatCard({ icon: Icon, label, value, color }: { 
  icon: React.ElementType; 
  label: string; 
  value: string; 
  color: string;
}) {
  return (
    <div 
      className="p-4 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${CI.orange}10` }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs" style={{ color: `${CI.goldLight}60` }}>{label}</span>
      </div>
      <p className="text-lg font-bold font-['Orbitron']" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

// Main Settings Page
export default function SettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeSection, setActiveSection] = useState('account');
  const [capabilities, setCapabilities] = useState<Record<string, boolean>>({});
  const [capabilitiesLoading, setCapabilitiesLoading] = useState(true);
  const [capabilitiesError, setCapabilitiesError] = useState(false);
  const [availableSections, setAvailableSections] = useState<SettingsSection[]>([]);

  // Dialogs
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDiagnoseModal, setShowDiagnoseModal] = useState(false);
  const [diagnoseData, setDiagnoseData] = useState<any>(null);
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);

  // Form States
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
    firstName: '',
    lastName: '',
  });
  const [profileDirty, setProfileDirty] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch subscription data
  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ['/api/user/subscription'],
    enabled: !!user && !authLoading,
  });

  // Fetch usage stats
  const { data: usageStats } = useQuery<any>({
    queryKey: ['/api/user/usage'],
    enabled: !!user && !authLoading && isCapabilityAvailable(capabilities, 'usage'),
  });

  // Fetch data sources count
  const { data: dataSources } = useQuery<any>({
    queryKey: ['/api/user/data-sources'],
    enabled: !!user && !authLoading && isCapabilityAvailable(capabilities, 'dataSources'),
  });

  // Probe capabilities on mount
  useEffect(() => {
    async function loadCapabilities() {
      try {
        setCapabilitiesLoading(true);
        setCapabilitiesError(false);
        const results = await probeCapabilities();
        setCapabilities(results);
        const sections = getAvailableSections(results);
        setAvailableSections(sections);
        if (sections.length > 0 && !sections.find(s => s.id === activeSection)) {
          setActiveSection(sections[0].id);
        }
      } catch {
        setCapabilitiesError(true);
      } finally {
        setCapabilitiesLoading(false);
      }
    }
    if (user) {
      loadCapabilities();
    }
  }, [user]);

  // Initialize profile form from user data
  useEffect(() => {
    if (user) {
      const newForm = {
        username: (user as any).username || '',
        email: (user as any).email || '',
        firstName: (user as any).firstName || '',
        lastName: (user as any).lastName || '',
      };
      setProfileForm(newForm);
      setProfileDirty(false);
    }
  }, [user]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof profileForm) => {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Fehler beim Speichern');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ Profil aktualisiert', description: 'Änderungen wurden gespeichert.' });
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      setProfileDirty(false);
    },
    onError: (error: Error) => {
      toast({ title: '❌ Fehler', description: error.message, variant: 'destructive' });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: typeof passwordForm) => {
      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'Fehler beim Ändern');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ Passwort geändert', description: 'Dein Passwort wurde aktualisiert.' });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: '❌ Fehler', description: error.message, variant: 'destructive' });
    },
  });

  // Delete account mutation
  const deleteAccountMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Fehler beim Löschen');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: '✅ Account gelöscht', description: 'Auf Wiedersehen!' });
      window.location.href = '/';
    },
    onError: (error: Error) => {
      toast({ title: '❌ Fehler', description: error.message, variant: 'destructive' });
    },
  });

  // Handle profile form change
  const handleProfileChange = useCallback((key: keyof typeof profileForm, value: string) => {
    setProfileForm(prev => ({ ...prev, [key]: value }));
    setProfileDirty(true);
  }, []);

  // Retry loading capabilities
  const retryCapabilities = useCallback(async () => {
    setCapabilitiesLoading(true);
    setCapabilitiesError(false);
    try {
      const results = await probeCapabilities();
      setCapabilities(results);
      setAvailableSections(getAvailableSections(results));
    } catch {
      setCapabilitiesError(true);
    } finally {
      setCapabilitiesLoading(false);
    }
  }, []);

  // Load diagnose data
  const loadDiagnoseData = async () => {
    setDiagnoseLoading(true);
    try {
      const [profileContext, knowledgeHealth] = await Promise.all([
        fetch('/api/user/profile-context', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
        fetch('/api/user/knowledge/health', { credentials: 'include' }).then(r => r.ok ? r.json() : null),
      ]);
      setDiagnoseData({
        profileContext,
        knowledgeHealth,
        user: {
          id: (user as any)?.id,
          email: (user as any)?.email,
          plan: subscription?.plan,
          status: subscription?.status,
        },
        timestamp: new Date().toISOString(),
      });
      setShowDiagnoseModal(true);
    } catch (err) {
      toast({ title: '❌ Fehler', description: 'Diagnose konnte nicht geladen werden', variant: 'destructive' });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  // Loading state
  if (authLoading || capabilitiesLoading) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <SettingsSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (capabilitiesError) {
    return (
      <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto">
          <SettingsErrorFallback onRetry={retryCapabilities} />
        </div>
      </div>
    );
  }

  // Last sync time
  const lastSync = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const planLabel = subscription?.plan?.toUpperCase() || 'FREE';

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 pb-32">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 
                className="text-3xl sm:text-4xl font-bold font-['Orbitron']"
                style={{
                  background: `linear-gradient(135deg, ${CI.goldLight}, ${CI.orange})`,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Einstellungen
              </h1>
              <p className="text-sm mt-2" style={{ color: `${CI.goldLight}80` }}>
                Kontrolle, Sicherheit, Integrationen – alles an einem Ort.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span 
                className="px-3 py-1.5 rounded-full text-xs font-bold"
                style={{ 
                  background: `${CI.orange}20`, 
                  color: CI.orange,
                  border: `1px solid ${CI.orange}40`,
                }}
              >
                {planLabel}
              </span>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: `${CI.goldLight}60` }}>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                LIVE
              </span>
              <span className="text-xs" style={{ color: `${CI.goldLight}50` }}>
                Sync: {lastSync}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation - Desktop */}
          <div className="hidden lg:block">
            <div 
              className="sticky top-4 p-4 rounded-2xl"
              style={{
                background: 'rgba(0,0,0,0.55)',
                border: `1px solid ${CI.orange}20`,
                backdropFilter: 'blur(20px)',
              }}
            >
              <nav className="space-y-1">
                {availableSections.map(section => (
                  <NavItem
                    key={section.id}
                    section={section}
                    active={activeSection === section.id}
                    onClick={() => setActiveSection(section.id)}
                  />
                ))}
              </nav>
            </div>
          </div>

          {/* Mobile Navigation */}
          <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
            {availableSections.map(section => {
              const Icon = SECTION_ICONS[section.icon] || User;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full whitespace-nowrap text-sm font-medium transition-all flex-shrink-0"
                  style={{
                    background: activeSection === section.id 
                      ? `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})` 
                      : 'rgba(255,255,255,0.05)',
                    color: activeSection === section.id ? '#000' : CI.goldLight,
                    border: `1px solid ${activeSection === section.id ? 'transparent' : `${CI.orange}30`}`,
                  }}
                >
                  <Icon className="w-4 h-4" />
                  {section.label}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3 space-y-6 min-h-0">
            <AnimatePresence mode="wait">
              {/* ACCOUNT SECTION */}
              {activeSection === 'account' && (
                <motion.div
                  key="account"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Subscription Card */}
                  {isCapabilityAvailable(capabilities, 'subscription') && (
                    <GlassPanel>
                      <div className="flex items-center gap-3 mb-6">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${CI.orange}20` }}
                        >
                          <Zap className="w-5 h-5" style={{ color: CI.orange }} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                            Dein Plan
                          </h2>
                          <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                            Aktuelle Nutzung und Limits
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                        <StatCard 
                          icon={CheckCircle} 
                          label="Status" 
                          value={subscription?.status === 'active' ? 'Aktiv' : 'Trial'}
                          color={subscription?.status === 'active' ? '#22c55e' : CI.orange}
                        />
                        <StatCard 
                          icon={Zap} 
                          label="Plan" 
                          value={planLabel}
                          color={CI.orange}
                        />
                        <StatCard 
                          icon={MessageSquare} 
                          label="AI Nachrichten" 
                          value={`${usageStats?.ai_messages_used || subscription?.aiMessagesUsed || 0}`}
                          color={CI.goldLight}
                        />
                        <StatCard 
                          icon={Phone} 
                          label="Voice Calls" 
                          value={`${usageStats?.voice_calls_used || 0}`}
                          color={CI.goldLight}
                        />
                      </div>

                      <button
                        onClick={() => window.location.href = '/app/billing'}
                        className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                        style={{
                          background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                          color: '#000',
                        }}
                      >
                        Plan upgraden →
                      </button>
                    </GlassPanel>
                  )}

                  {/* Profile Card */}
                  {isCapabilityAvailable(capabilities, 'profile') && (
                    <GlassPanel>
                      <div className="flex items-center gap-3 mb-6">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${CI.orange}20` }}
                        >
                          <User className="w-5 h-5" style={{ color: CI.orange }} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                            Profil bearbeiten
                          </h2>
                          <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                            Deine persönlichen Daten
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <InputField
                          label="Benutzername"
                          value={profileForm.username}
                          onChange={(v) => handleProfileChange('username', v)}
                          required
                          disabled={updateProfileMutation.isPending}
                        />
                        <InputField
                          label="Email"
                          value={profileForm.email}
                          onChange={(v) => handleProfileChange('email', v)}
                          type="email"
                          required
                          disabled={updateProfileMutation.isPending}
                        />
                        <InputField
                          label="Vorname"
                          value={profileForm.firstName}
                          onChange={(v) => handleProfileChange('firstName', v)}
                          disabled={updateProfileMutation.isPending}
                        />
                        <InputField
                          label="Nachname"
                          value={profileForm.lastName}
                          onChange={(v) => handleProfileChange('lastName', v)}
                          disabled={updateProfileMutation.isPending}
                        />
                      </div>

                      {profileDirty && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-6 flex justify-end"
                        >
                          <button
                            onClick={() => updateProfileMutation.mutate(profileForm)}
                            disabled={updateProfileMutation.isPending}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                            style={{
                              background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                              color: '#000',
                            }}
                          >
                            {updateProfileMutation.isPending ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Speichere...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Änderungen speichern
                              </>
                            )}
                          </button>
                        </motion.div>
                      )}
                    </GlassPanel>
                  )}
                </motion.div>
              )}

              {/* SECURITY SECTION */}
              {activeSection === 'security' && (
                <motion.div
                  key="security"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Password Card */}
                  {isCapabilityAvailable(capabilities, 'password') && (
                    <GlassPanel>
                      <div className="flex items-center gap-3 mb-4">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${CI.orange}20` }}
                        >
                          <Key className="w-5 h-5" style={{ color: CI.orange }} />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                            Passwort ändern
                          </h2>
                          <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                            Schütze deinen Account mit einem starken Passwort
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowPasswordDialog(true)}
                        className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                        style={{
                          background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                          color: '#000',
                        }}
                      >
                        Passwort ändern
                      </button>
                    </GlassPanel>
                  )}

                  {/* Delete Account Card */}
                  {isCapabilityAvailable(capabilities, 'deleteAccount') && (
                    <GlassPanel danger>
                      <div className="flex items-center gap-3 mb-4">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: 'rgba(239,68,68,0.15)' }}
                        >
                          <Trash2 className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <h2 className="text-lg font-bold font-['Orbitron'] text-red-400">
                            Account löschen
                          </h2>
                          <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                            ⚠️ Diese Aktion kann nicht rückgängig gemacht werden
                          </p>
                        </div>
                      </div>

                      <p className="text-sm mb-4" style={{ color: `${CI.goldLight}80` }}>
                        Alle deine Daten, Kontakte und Einstellungen werden permanent gelöscht.
                      </p>

                      <button
                        onClick={() => setShowDeleteDialog(true)}
                        className="px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                        style={{
                          background: 'linear-gradient(135deg, #ef4444, #991b1b)',
                          color: '#fff',
                        }}
                      >
                        Account löschen
                      </button>
                    </GlassPanel>
                  )}
                </motion.div>
              )}

              {/* DATA SECTION */}
              {activeSection === 'data' && (
                <motion.div
                  key="data"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {/* Data Sources Card */}
                  {isCapabilityAvailable(capabilities, 'dataSources') && (
                    <GlassPanel>
                      <div className="flex items-center gap-3 mb-4">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ background: `${CI.orange}20` }}
                        >
                          <FileText className="w-5 h-5" style={{ color: CI.orange }} />
                        </div>
                        <div className="flex-1">
                          <h2 className="text-lg font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                            Datenquellen
                          </h2>
                          <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                            Deine Wissensbasis für ARAS AI
                          </p>
                        </div>
                        <div 
                          className="px-3 py-1 rounded-full text-sm font-bold"
                          style={{ background: `${CI.orange}20`, color: CI.orange }}
                        >
                          {Array.isArray(dataSources) ? dataSources.length : 0} Quellen
                        </div>
                      </div>

                      <p className="text-sm mb-4" style={{ color: `${CI.goldLight}80` }}>
                        Verwalte die Informationen, die ARAS AI über dein Unternehmen kennt.
                      </p>

                      <button
                        onClick={() => window.location.href = '/app/space'}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                        style={{
                          background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                          color: '#000',
                        }}
                      >
                        <Database className="w-4 h-4" />
                        Wissen verwalten
                      </button>
                    </GlassPanel>
                  )}

                  {/* Account Info Card */}
                  <GlassPanel>
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${CI.orange}20` }}
                      >
                        <Clock className="w-5 h-5" style={{ color: CI.orange }} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                          Kontoinformationen
                        </h2>
                        <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                          Was ARAS AI über dein Konto weiß
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      {[
                        { label: 'User ID', value: (user as any)?.id?.slice(0, 8) + '...' || '—' },
                        { label: 'Email', value: (user as any)?.email || '—' },
                        { label: 'Plan', value: subscription?.plan || 'free' },
                        { label: 'Status', value: subscription?.status || 'trial' },
                      ].map(item => (
                        <div key={item.label}>
                          <p className="text-xs mb-1" style={{ color: `${CI.goldLight}60` }}>{item.label}</p>
                          <p className="font-mono text-xs truncate" style={{ color: CI.goldLight }}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </GlassPanel>
                </motion.div>
              )}

              {/* DIAGNOSE SECTION */}
              {activeSection === 'diagnose' && (
                <motion.div
                  key="diagnose"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <GlassPanel>
                    <div className="flex items-center gap-3 mb-4">
                      <div 
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${CI.orange}20` }}
                      >
                        <Activity className="w-5 h-5" style={{ color: CI.orange }} />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                          Diagnose & Transparenz
                        </h2>
                        <p className="text-xs" style={{ color: `${CI.goldLight}60` }}>
                          Debug-Informationen für Support
                        </p>
                      </div>
                    </div>

                    <p className="text-sm mb-6" style={{ color: `${CI.goldLight}80` }}>
                      Zeige alle Daten, die ARAS AI über dein Konto gespeichert hat.
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={loadDiagnoseData}
                        disabled={diagnoseLoading}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-50"
                        style={{
                          background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                          color: '#000',
                        }}
                      >
                        {diagnoseLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                        Diagnose anzeigen
                      </button>

                      {isCapabilityAvailable(capabilities, 'knowledgeDigest') && (
                        <a
                          href="/api/user/knowledge/digest?mode=space"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            color: CI.goldLight,
                            border: `1px solid ${CI.orange}30`,
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Knowledge Digest (Space)
                        </a>
                      )}

                      {isCapabilityAvailable(capabilities, 'knowledgeHealth') && (
                        <a
                          href="/api/user/knowledge/health"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02]"
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            color: CI.goldLight,
                            border: `1px solid ${CI.orange}30`,
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Knowledge Health
                        </a>
                      )}
                    </div>
                  </GlassPanel>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Password Change Dialog */}
      <AnimatePresence>
        {showPasswordDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowPasswordDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-2xl"
              style={{
                background: 'rgba(0,0,0,0.95)',
                border: `2px solid ${CI.orange}`,
                boxShadow: `0 0 40px ${CI.orange}40`,
              }}
            >
              <h2 className="text-2xl font-bold mb-6 font-['Orbitron']" style={{ color: CI.goldLight }}>
                Passwort ändern
              </h2>

              <div className="space-y-4">
                <InputField
                  label="Aktuelles Passwort"
                  value={passwordForm.currentPassword}
                  onChange={(v) => setPasswordForm(prev => ({ ...prev, currentPassword: v }))}
                  type="password"
                  required
                  disabled={changePasswordMutation.isPending}
                />
                <InputField
                  label="Neues Passwort"
                  value={passwordForm.newPassword}
                  onChange={(v) => setPasswordForm(prev => ({ ...prev, newPassword: v }))}
                  type="password"
                  required
                  disabled={changePasswordMutation.isPending}
                  helper="Mindestens 8 Zeichen"
                />
                <InputField
                  label="Passwort bestätigen"
                  value={passwordForm.confirmPassword}
                  onChange={(v) => setPasswordForm(prev => ({ ...prev, confirmPassword: v }))}
                  type="password"
                  required
                  disabled={changePasswordMutation.isPending}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => changePasswordMutation.mutate(passwordForm)}
                  disabled={changePasswordMutation.isPending}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                  style={{
                    background: `linear-gradient(135deg, ${CI.orange}, ${CI.goldDark})`,
                    color: '#000',
                  }}
                >
                  {changePasswordMutation.isPending ? 'Ändere...' : 'Passwort ändern'}
                </button>
                <button
                  onClick={() => setShowPasswordDialog(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: CI.goldLight,
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Account Dialog */}
      <AnimatePresence>
        {showDeleteDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowDeleteDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-2xl"
              style={{
                background: 'rgba(20,0,0,0.95)',
                border: '2px solid #ef4444',
                boxShadow: '0 0 40px rgba(239,68,68,0.4)',
              }}
            >
              <h2 className="text-2xl font-bold mb-4 text-red-400 font-['Orbitron']">
                ⚠️ Account löschen?
              </h2>
              <p className="text-sm mb-6" style={{ color: `${CI.goldLight}80` }}>
                Diese Aktion ist <strong>permanent</strong> und kann nicht rückgängig gemacht werden. 
                Alle deine Daten werden unwiederbringlich gelöscht.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => deleteAccountMutation.mutate()}
                  disabled={deleteAccountMutation.isPending}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #ef4444, #991b1b)',
                    color: '#fff',
                  }}
                >
                  {deleteAccountMutation.isPending ? 'Lösche...' : 'Ja, Account löschen'}
                </button>
                <button
                  onClick={() => setShowDeleteDialog(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: '#fff',
                  }}
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Diagnose Modal */}
      <AnimatePresence>
        {showDiagnoseModal && diagnoseData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)' }}
            onClick={() => setShowDiagnoseModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl flex flex-col"
              style={{
                background: 'rgba(0,0,0,0.95)',
                border: `2px solid ${CI.orange}`,
                boxShadow: `0 0 40px ${CI.orange}40`,
              }}
            >
              <div className="p-6 border-b" style={{ borderColor: `${CI.orange}30` }}>
                <h2 className="text-xl font-bold font-['Orbitron']" style={{ color: CI.goldLight }}>
                  Diagnose-Daten
                </h2>
                <p className="text-xs mt-1" style={{ color: `${CI.goldLight}60` }}>
                  Read-only • Für Support-Zwecke
                </p>
              </div>
              <div className="flex-1 overflow-auto p-6">
                <pre 
                  className="text-xs font-mono whitespace-pre-wrap break-all"
                  style={{ color: CI.goldLight }}
                >
                  {JSON.stringify(diagnoseData, null, 2)}
                </pre>
              </div>
              <div className="p-4 border-t" style={{ borderColor: `${CI.orange}30` }}>
                <button
                  onClick={() => setShowDiagnoseModal(false)}
                  className="w-full py-3 rounded-xl font-bold text-sm"
                  style={{
                    background: 'rgba(255,255,255,0.1)',
                    color: CI.goldLight,
                  }}
                >
                  Schließen
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
